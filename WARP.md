# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Development Commands

### Backend Development
```bash
# Setup backend environment
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Run backend server (development mode with reload)
python main.py

# Run backend server (production mode)
uvicorn main:socket_app --host 0.0.0.0 --port 8000

# Quick start with shell script
chmod +x run_server.sh
./run_server.sh
```

### Frontend Development
```bash
# Serve frontend locally
cd frontend
python -m http.server 3000

# Alternative with Node.js (if available)
npx serve . -l 3000
```

### Testing & Validation
```bash
# Test backend API health
curl http://localhost:8000/

# Test WebSocket connection (requires backend running)
curl -X POST http://localhost:8000/rooms?room_name=test

# Check active rooms
curl http://localhost:8000/rooms

# Get room messages
curl http://localhost:8000/rooms/test/messages
```

## Architecture Overview

### High-Level Architecture
5mChat is a real-time ephemeral chat application with a clear separation between frontend and backend:

**Backend (FastAPI + Socket.IO)**
- FastAPI for REST API endpoints
- Socket.IO for real-time WebSocket communication
- SQLite database for message persistence
- APScheduler for automated message cleanup (5-minute expiration)
- ASGI server combining HTTP and WebSocket protocols

**Frontend (Vanilla JavaScript SPA)**
- Single-page application with state management
- Socket.IO client for real-time communication
- Screen-based UI navigation (login → loading → chat/error)
- Automatic reconnection and connection status handling

### Core Components

#### Backend (`backend/main.py`)
- **Database Models**: `Message`, `Room`, `MessageCreate` (Pydantic models)
- **Socket.IO Events**: `connect`, `disconnect`, `join_room`, `leave_room`, `send_message`
- **REST Endpoints**: Health check, room management, message retrieval
- **Background Tasks**: `cleanup_expired_messages()` runs every minute
- **Database Layer**: SQLite with connection pooling via `get_db_connection()`

#### Frontend (`frontend/script.js`)
- **State Management**: Global `state` object tracking user, room, connection
- **Screen Management**: Login, chat, loading, error screens with transitions
- **Socket Handling**: Auto-reconnection, error handling, event processing
- **Message Rendering**: HTML escaping, timestamp formatting, own/other message styling
- **Connection Status**: Real-time connection indicator with visual feedback

### Key Technical Details

#### Message Lifecycle
1. Messages stored in SQLite with `expires_at` timestamp (5 minutes from creation)
2. Background scheduler runs every minute to cleanup expired messages
3. Client receives message history when joining room (only non-expired messages)
4. Real-time message broadcasting to all room participants via Socket.IO

#### Connection Management
- Socket.IO handles WebSocket fallback to polling automatically
- Client implements reconnection logic for server disconnects
- Connection status displayed to user with visual indicators
- Auto-rejoin room functionality on reconnection

#### Room System
- Rooms created dynamically when first user joins
- Room persistence in database for message history
- Users can join/leave rooms with broadcast notifications
- Active rooms determined by presence of non-expired messages

## Configuration & Deployment

### Environment Configuration
- Backend uses `.env.example` as template for environment variables
- Key variables: `ALLOWED_ORIGINS` for CORS, `DATABASE_URL` for database
- Frontend API URL configured in `script.js` (line 10): `const API_URL`

### Deployment Configurations
- **Railway**: `railway.toml` with Nixpacks builder
- **Render**: `render.yaml` with Python 3.11 environment
- **Heroku**: `Procfile` for web dyno configuration
- **Netlify**: `netlify.toml` with SPA routing and security headers

### Development Workflow
1. Always start backend first on port 8000
2. Frontend defaults to `localhost:8000` for API calls
3. Update `API_URL` in `frontend/script.js` for production deployments
4. CORS must be configured for cross-origin frontend deployments

## Important Implementation Notes

### Security Considerations
- All user input is HTML-escaped in frontend (`escapeHtml()` function)
- CORS configuration required for cross-origin requests
- No authentication system - username is client-provided only
- Message content limited to 500 characters max

### Database Schema
- Messages: `id`, `username`, `content`, `room`, `timestamp`, `expires_at`
- Rooms: `name`, `created_at`
- SQLite with automatic cleanup of expired data

### Real-time Communication
- Dual protocol support: WebSocket primary, HTTP polling fallback
- Room-based message broadcasting
- System messages for user join/leave events
- Client-side optimistic UI updates

### Debugging Tips
- Backend logs connection events and cleanup operations to console
- Frontend logs socket events and errors to browser console
- Database file (`chat.db`) created in backend directory when server starts
- Connection issues often related to CORS or WebSocket support on hosting platform
