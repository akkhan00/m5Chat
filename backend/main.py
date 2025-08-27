import asyncio
import sqlite3
import uuid
from datetime import datetime, timedelta
from typing import List, Optional
import json
import os
from contextlib import asynccontextmanager
import shutil
import mimetypes
import base64

from fastapi import FastAPI, HTTPException, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
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
    message_type: str = "text"  # "text", "image", or "voice"
    image_url: Optional[str] = None
    voice_url: Optional[str] = None


class Room(BaseModel):
    name: str
    created_at: str


class MessageCreate(BaseModel):
    username: str
    content: str
    room: str
    message_type: str = "text"  # "text", "image", or "voice"
    image_url: Optional[str] = None
    voice_url: Optional[str] = None


# Initialize Socket.IO server with proper ASGI configuration
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins="*",
    logger=False,
    engineio_logger=False
)

# Initialize scheduler for message cleanup
scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
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

    yield

    # Shutdown
    scheduler.shutdown()
    print("5mChat server stopped!")


# Initialize FastAPI app with lifespan
app = FastAPI(title="5mChat API", version="1.0.0", lifespan=lifespan)

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


# File storage setup
UPLOADS_DIR = "uploads"
if not os.path.exists(UPLOADS_DIR):
    os.makedirs(UPLOADS_DIR)

# Database initialization
def init_db():
    conn = sqlite3.connect('chat.db')
    cursor = conn.cursor()

    # Create messages table first (with IF NOT EXISTS)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            content TEXT NOT NULL,
            room TEXT NOT NULL,
            timestamp DATETIME NOT NULL,
            expires_at DATETIME NOT NULL,
            message_type TEXT DEFAULT "text",
            image_url TEXT,
            voice_url TEXT,
            file_path TEXT
        )
    ''')

    # Check if we need to add new columns to existing table
    cursor.execute("PRAGMA table_info(messages)")
    columns = [column[1] for column in cursor.fetchall()]

    if 'message_type' not in columns:
        cursor.execute('ALTER TABLE messages ADD COLUMN message_type TEXT DEFAULT "text"')
    if 'image_url' not in columns:
        cursor.execute('ALTER TABLE messages ADD COLUMN image_url TEXT')
    if 'file_path' not in columns:
        cursor.execute('ALTER TABLE messages ADD COLUMN file_path TEXT')
    if 'voice_url' not in columns:
        cursor.execute('ALTER TABLE messages ADD COLUMN voice_url TEXT')

    # Create rooms table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS rooms (
            name TEXT PRIMARY KEY,
            created_at DATETIME NOT NULL
        )
    ''')
    
    # Create user_sessions table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_sessions (
            session_id TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            room TEXT NOT NULL,
            joined_at DATETIME NOT NULL
        )
    ''')

    conn.commit()
    conn.close()


# Database operations
def get_db_connection():
    conn = sqlite3.connect('chat.db')
    conn.row_factory = sqlite3.Row
    return conn


def create_message(message_data: MessageCreate, file_path: Optional[str] = None) -> Message:
    conn = get_db_connection()
    cursor = conn.cursor()

    message_id = str(uuid.uuid4())
    timestamp = datetime.now().isoformat()
    expires_at = datetime.now() + timedelta(minutes=5)

    cursor.execute('''
        INSERT INTO messages (id, username, content, room, timestamp, expires_at, message_type, image_url, voice_url, file_path)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (message_id, message_data.username, message_data.content, 
          message_data.room, timestamp, expires_at, message_data.message_type, 
          message_data.image_url, message_data.voice_url, file_path))

    conn.commit()
    conn.close()

    return Message(
        id=message_id,
        username=message_data.username,
        content=message_data.content,
        room=message_data.room,
        timestamp=timestamp,
        message_type=message_data.message_type,
        image_url=message_data.image_url,
        voice_url=message_data.voice_url
    )


def get_room_messages(room: str) -> List[Message]:
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('''
        SELECT id, username, content, room, timestamp, message_type, image_url, voice_url
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
            timestamp=row['timestamp'],
            message_type=row['message_type'] or "text",
            image_url=row['image_url'],
            voice_url=row['voice_url']
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


def add_user_session(sid: str, username: str, room: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    joined_at = datetime.now().isoformat()
    cursor.execute('''
        INSERT INTO user_sessions (session_id, username, room, joined_at)
        VALUES (?, ?, ?, ?)
    ''', (sid, username, room, joined_at))
    conn.commit()
    conn.close()


def remove_user_session(sid: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM user_sessions WHERE session_id = ?', (sid,))
    conn.commit()
    conn.close()


def get_room_active_users(room: str) -> List[str]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT username FROM user_sessions WHERE room = ?', (room,))
    users = [row['username'] for row in cursor.fetchall()]
    conn.close()
    return users


async def cleanup_expired_messages():
    """Remove messages and associated files that have expired (older than 5 minutes)"""
    conn = get_db_connection()
    cursor = conn.cursor()

    # First, get file paths of expired messages to clean up files
    cursor.execute('SELECT file_path FROM messages WHERE expires_at <= ? AND file_path IS NOT NULL', (datetime.now(),))
    expired_files = [row['file_path'] for row in cursor.fetchall()]

    # Delete expired messages from database
    cursor.execute('DELETE FROM messages WHERE expires_at <= ?', (datetime.now(),))
    deleted_count = cursor.rowcount

    conn.commit()
    conn.close()

    # Clean up associated files
    files_deleted = 0
    for file_path in expired_files:
        try:
            if file_path and os.path.exists(file_path):
                os.remove(file_path)
                files_deleted += 1
        except Exception as e:
            print(f"Error deleting file {file_path}: {e}")

    if deleted_count > 0:
        print(f"Cleaned up {deleted_count} expired messages and {files_deleted} associated files")


# Socket.IO event handlers
@sio.event
async def connect(sid, environ, auth):
    print(f"Client {sid} connected")
    await sio.emit('connected', {'message': 'Connected to 5mChat!'}, room=sid)


@sio.event
async def disconnect(sid):
    # Get user session info before removing
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute('SELECT username, room FROM user_sessions WHERE session_id = ?', (sid,))
        session = cursor.fetchone()

        if session:
            username = session['username']
            room = session['room']

            # Remove session
            remove_user_session(sid)

            # Get updated active users list
            active_users = get_room_active_users(room)

            # Notify others
            await sio.emit('user_left', {
                'username': username,
                'room': room,
                'active_users': active_users
            }, room=room)

            print(f"Client {sid} ({username}) disconnected from room {room}")
        else:
            print(f"Client {sid} disconnected")
    except Exception as e:
        print(f"Error handling disconnect: {e}")
    finally:
        conn.close()


@sio.event
async def join_room(sid, data):
    room = data.get('room')
    username = data.get('username')

    if not room or not username:
        await sio.emit('error', {'message': 'Room and username required'}, room=sid)
        return

    # Create room if it doesn't exist
    create_room(room)

    # Add user session
    add_user_session(sid, username, room)

    # Join the room
    sio.enter_room(sid, room)

    # Send room history
    messages = get_room_messages(room)

    # Get active users in the room
    active_users = get_room_active_users(room)

    await sio.emit('room_history', {
        'messages': [msg.dict() for msg in messages],
        'active_users': active_users
    }, room=sid)

    # Notify others
    await sio.emit('user_joined', {
        'username': username,
        'room': room,
        'active_users': active_users
    }, room=room, skip_sid=sid)

    print(f"Client {sid} joined room {room} as {username}")


@sio.event
async def leave_room(sid, data):
    room = data.get('room')
    username = data.get('username')

    if room:
        sio.leave_room(sid, room)
        remove_user_session(sid)

        if username:
            active_users = get_room_active_users(room)
            await sio.emit('user_left', {
                'username': username,
                'room': room,
                'active_users': active_users
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


# Image upload endpoint
@app.post("/upload-image")
async def upload_image(
    file: UploadFile = File(...),
    username: str = Form(...),
    room: str = Form(...)
):
    # Validate file type
    if not file.content_type or not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="Only image files are allowed")

    # Validate file size (5MB limit)
    file_content = await file.read()
    if len(file_content) > 5 * 1024 * 1024:  # 5MB
        raise HTTPException(status_code=400, detail="File size must be less than 5MB")

    # Generate unique filename
    file_extension = os.path.splitext(file.filename)[1] if file.filename else '.jpg'
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = os.path.join(UPLOADS_DIR, unique_filename)

    # Save file
    try:
        with open(file_path, "wb") as buffer:
            buffer.write(file_content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

    # Create image URL
    image_url = f"/uploads/{unique_filename}"

    # Create message
    message_data = MessageCreate(
        username=username,
        content=file.filename or "Image",
        room=room,
        message_type="image",
        image_url=image_url
    )

    message = create_message(message_data, file_path)

    # Emit to all clients in the room via WebSocket
    await sio.emit('new_message', message.dict(), room=room)

    return {"message": "Image uploaded successfully", "image_url": image_url, "message_id": message.id}


# Voice upload endpoint
@app.post("/upload-voice")
async def upload_voice(
    file: UploadFile = File(...),
    username: str = Form(...),
    room: str = Form(...)
):
    # Validate file type
    allowed_audio_types = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/mpeg']
    if not file.content_type or file.content_type not in allowed_audio_types:
        raise HTTPException(status_code=400, detail="Only audio files are allowed (webm, mp4, ogg, wav, mp3)")

    # Validate file size (10MB limit for voice messages)
    file_content = await file.read()
    if len(file_content) > 10 * 1024 * 1024:  # 10MB
        raise HTTPException(status_code=400, detail="Voice file size must be less than 10MB")

    # Generate unique filename
    file_extension = '.webm'  # Default to webm for web compatibility
    if file.filename:
        file_extension = os.path.splitext(file.filename)[1]

    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = os.path.join(UPLOADS_DIR, unique_filename)

    # Save file
    try:
        with open(file_path, "wb") as buffer:
            buffer.write(file_content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

    # Create voice URL
    voice_url = f"/uploads/{unique_filename}"

    # Create message
    message_data = MessageCreate(
        username=username,
        content="Voice Message",
        room=room,
        message_type="voice",
        voice_url=voice_url
    )

    message = create_message(message_data, file_path)

    # Emit to all clients in the room via WebSocket
    await sio.emit('new_message', message.dict(), room=room)

    return {"message": "Voice message uploaded successfully", "voice_url": voice_url, "message_id": message.id}


# Serve uploaded images
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")


if __name__ == "__main__":
    uvicorn.run(
        "main:socket_app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )