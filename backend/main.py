import asyncio
import sqlite3
import uuid
from datetime import datetime, timedelta
from typing import List, Optional
import json
import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import socketio
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from pydantic import BaseModel
import uvicorn


# Pydantic models
class Message(BaseModel):
    id: str
    username: str
    content: str
    room: str
    timestamp: str


class Room(BaseModel):
    name: str
    created_at: str


class MessageCreate(BaseModel):
    username: str
    content: str
    room: str


# Initialize Socket.IO server with proper ASGI configuration
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins="*",
    logger=False,
    engineio_logger=False
)

# Initialize FastAPI app
app = FastAPI(title="5mChat API", version="1.0.0")

# Combine FastAPI and Socket.IO
socket_app = socketio.ASGIApp(sio, other_asgi_app=app, socketio_path="/socket.io")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize scheduler for message cleanup
scheduler = AsyncIOScheduler()

# Database initialization
def init_db():
    conn = sqlite3.connect('chat.db')
    cursor = conn.cursor()
    
    # Create messages table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            content TEXT NOT NULL,
            room TEXT NOT NULL,
            timestamp DATETIME NOT NULL,
            expires_at DATETIME NOT NULL
        )
    ''')
    
    # Create rooms table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS rooms (
            name TEXT PRIMARY KEY,
            created_at DATETIME NOT NULL
        )
    ''')
    
    conn.commit()
    conn.close()


# Database operations
def get_db_connection():
    conn = sqlite3.connect('chat.db')
    conn.row_factory = sqlite3.Row
    return conn


def create_message(message_data: MessageCreate) -> Message:
    conn = get_db_connection()
    cursor = conn.cursor()
    
    message_id = str(uuid.uuid4())
    timestamp = datetime.now().isoformat()
    expires_at = datetime.now() + timedelta(minutes=5)
    
    cursor.execute('''
        INSERT INTO messages (id, username, content, room, timestamp, expires_at)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (message_id, message_data.username, message_data.content, 
          message_data.room, timestamp, expires_at))
    
    conn.commit()
    conn.close()
    
    return Message(
        id=message_id,
        username=message_data.username,
        content=message_data.content,
        room=message_data.room,
        timestamp=timestamp
    )


def get_room_messages(room: str) -> List[Message]:
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT id, username, content, room, timestamp
        FROM messages
        WHERE room = ? AND expires_at > ?
        ORDER BY timestamp ASC
    ''', (room, datetime.now()))
    
    messages = []
    for row in cursor.fetchall():
        messages.append(Message(
            id=row['id'],
            username=row['username'],
            content=row['content'],
            room=row['room'],
            timestamp=row['timestamp']
        ))
    
    conn.close()
    return messages


def create_room(room_name: str) -> Room:
    conn = get_db_connection()
    cursor = conn.cursor()
    
    created_at = datetime.now().isoformat()
    
    try:
        cursor.execute('''
            INSERT INTO rooms (name, created_at)
            VALUES (?, ?)
        ''', (room_name, created_at))
        conn.commit()
    except sqlite3.IntegrityError:
        pass  # Room already exists
    
    conn.close()
    
    return Room(name=room_name, created_at=created_at)


def get_active_rooms() -> List[Room]:
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT DISTINCT r.name, r.created_at
        FROM rooms r
        WHERE EXISTS (
            SELECT 1 FROM messages m
            WHERE m.room = r.name AND m.expires_at > ?
        )
        ORDER BY r.created_at DESC
    ''', (datetime.now(),))
    
    rooms = []
    for row in cursor.fetchall():
        rooms.append(Room(
            name=row['name'],
            created_at=row['created_at']
        ))
    
    conn.close()
    return rooms


async def cleanup_expired_messages():
    """Remove messages that have expired (older than 5 minutes)"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('DELETE FROM messages WHERE expires_at <= ?', (datetime.now(),))
    deleted_count = cursor.rowcount
    
    conn.commit()
    conn.close()
    
    if deleted_count > 0:
        print(f"Cleaned up {deleted_count} expired messages")


# Socket.IO event handlers
@sio.event
async def connect(sid, environ, auth):
    print(f"Client {sid} connected")
    await sio.emit('connected', {'message': 'Connected to 5mChat!'}, room=sid)


@sio.event
async def disconnect(sid):
    print(f"Client {sid} disconnected")


@sio.event
async def join_room(sid, data):
    room = data.get('room')
    username = data.get('username')
    
    if not room or not username:
        await sio.emit('error', {'message': 'Room and username required'}, room=sid)
        return
    
    # Create room if it doesn't exist
    create_room(room)
    
    # Join the room
    await sio.enter_room(sid, room)
    
    # Send room history
    messages = get_room_messages(room)
    await sio.emit('room_history', {
        'messages': [msg.dict() for msg in messages]
    }, room=sid)
    
    # Notify others
    await sio.emit('user_joined', {
        'username': username,
        'room': room
    }, room=room, skip_sid=sid)
    
    print(f"Client {sid} joined room {room} as {username}")


@sio.event
async def leave_room(sid, data):
    room = data.get('room')
    username = data.get('username')
    
    if room:
        await sio.leave_room(sid, room)
        
        if username:
            await sio.emit('user_left', {
                'username': username,
                'room': room
            }, room=room)


@sio.event
async def send_message(sid, data):
    try:
        message_data = MessageCreate(**data)
        message = create_message(message_data)
        
        # Emit to all clients in the room
        await sio.emit('new_message', message.dict(), room=message_data.room)
        
    except Exception as e:
        await sio.emit('error', {'message': f'Error sending message: {str(e)}'}, room=sid)


# REST API endpoints
@app.get("/")
async def root():
    return {"message": "5mChat API is running!"}


@app.get("/rooms", response_model=List[Room])
async def get_rooms():
    return get_active_rooms()


@app.post("/rooms")
async def create_room_endpoint(room_name: str):
    room = create_room(room_name)
    return room


@app.get("/rooms/{room_name}/messages", response_model=List[Message])
async def get_messages(room_name: str):
    return get_room_messages(room_name)


@app.on_event("startup")
async def startup_event():
    # Initialize database
    init_db()
    
    # Start the cleanup scheduler
    scheduler.add_job(
        cleanup_expired_messages,
        trigger=IntervalTrigger(minutes=1),  # Run every minute
        id='cleanup_messages',
        replace_existing=True
    )
    scheduler.start()
    
    print("5mChat server started!")


@app.on_event("shutdown")
async def shutdown_event():
    scheduler.shutdown()
    print("5mChat server stopped!")


if __name__ == "__main__":
    uvicorn.run(
        "main:socket_app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
