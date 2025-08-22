# 5mChat - Ephemeral Chat Application

A modern, real-time chat application where messages automatically disappear after 5 minutes. Built with FastAPI (Python) backend and vanilla JavaScript frontend.

## Features

- 🕐 **Ephemeral messaging**: Messages automatically delete after 5 minutes
- 💬 **Real-time communication**: Instant message delivery using Socket.IO
- 🏠 **Room-based chat**: Create and join different chat rooms
- 📱 **Responsive design**: Works on desktop, tablet, and mobile
- 🔄 **Auto-reconnection**: Automatic reconnection when connection is lost
- ✨ **Clean UI**: Modern, intuitive user interface
- 🚀 **Easy deployment**: Ready-to-deploy configurations included

## Tech Stack

### Backend
- **FastAPI**: Modern, fast web framework for Python
- **Socket.IO**: Real-time bidirectional event-based communication
- **SQLite**: Lightweight database for message storage
- **APScheduler**: Background task scheduling for message cleanup
- **Uvicorn**: ASGI server

### Frontend
- **Vanilla JavaScript**: Modern ES6+ features
- **Socket.IO Client**: Real-time communication
- **CSS Variables**: Modern styling with custom properties
- **Font Awesome**: Icon library

## Project Structure

```
5mChat/
├── backend/
│   ├── main.py              # Main FastAPI application
│   ├── requirements.txt     # Python dependencies
│   ├── railway.json         # Railway deployment config
│   ├── render.yaml          # Render deployment config
│   ├── Procfile            # Heroku deployment config
│   └── .env.example        # Environment variables template
├── frontend/
│   ├── index.html          # Main HTML file
│   ├── style.css           # Stylesheet
│   ├── script.js           # JavaScript application
│   └── netlify.toml        # Netlify deployment config
└── README.md
```

## Local Development

### Prerequisites

- Python 3.8 or higher
- Modern web browser

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Run the server:
   ```bash
   python main.py
   ```

The backend will be available at `http://localhost:8000`

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Serve the files using any local server. For example:
   ```bash
   # Using Python
   python -m http.server 3000
   
   # Using Node.js (if you have it)
   npx serve . -l 3000
   ```

The frontend will be available at `http://localhost:3000`

## Deployment

### Backend Deployment Options

#### Option 1: Railway.app (Recommended)

1. Create a Railway account at [railway.app](https://railway.app)
2. Install Railway CLI: `npm install -g @railway/cli`
3. Login: `railway login`
4. Deploy from backend directory:
   ```bash
   cd backend
   railway deploy
   ```

#### Option 2: Render.com

1. Create a Render account at [render.com](https://render.com)
2. Connect your GitHub repository
3. Create a new Web Service
4. Select your repository and the `backend` folder
5. Render will automatically use the `render.yaml` configuration

#### Option 3: Heroku

1. Create a Heroku account at [heroku.com](https://heroku.com)
2. Install Heroku CLI
3. Deploy from backend directory:
   ```bash
   cd backend
   heroku create your-app-name
   git subtree push --prefix backend heroku main
   ```

### Frontend Deployment

#### Netlify (Recommended)

1. Create a Netlify account at [netlify.com](https://netlify.com)
2. Drag and drop the `frontend` folder to Netlify dashboard, or
3. Connect your GitHub repository and set publish directory to `frontend`

#### Vercel

1. Create a Vercel account at [vercel.com](https://vercel.com)
2. Connect your GitHub repository
3. Set the root directory to `frontend`

### Configuration After Deployment

1. **Update Frontend API URL**: In `frontend/script.js`, update the `API_URL` constant with your deployed backend URL:
   ```javascript
   const API_URL = 'https://your-backend-url.railway.app'; // Replace with your actual backend URL
   ```

2. **Environment Variables**: Set the following environment variables on your backend hosting platform:
   - `ALLOWED_ORIGINS`: Your frontend URL (e.g., `https://your-app.netlify.app`)

## API Endpoints

- `GET /` - Health check
- `GET /rooms` - Get active rooms
- `POST /rooms` - Create a new room
- `GET /rooms/{room_name}/messages` - Get room messages

### Socket.IO Events

#### Client to Server
- `join_room` - Join a chat room
- `leave_room` - Leave a chat room  
- `send_message` - Send a message

#### Server to Client
- `connected` - Connection established
- `room_history` - Room message history
- `new_message` - New message received
- `user_joined` - User joined room
- `user_left` - User left room
- `error` - Error message

## Features in Detail

### Automatic Message Deletion

Messages are automatically deleted after 5 minutes using:
- Database-level expiration timestamps
- Background cleanup task running every minute
- Client-side handling of expired messages

### Real-time Communication

- WebSocket connections for instant messaging
- Automatic reconnection on connection loss
- Connection status indicators
- Optimistic UI updates

### Responsive Design

- Mobile-first design approach
- Flexible layouts that work on all screen sizes
- Touch-friendly interface elements
- Progressive Web App capabilities

## Security Considerations

- Input sanitization for all user content
- XSS protection through HTML escaping
- CORS configuration for cross-origin requests
- Rate limiting considerations for production

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is open source and available under the MIT License.

## Support

If you encounter any issues or have questions:
1. Check the browser console for error messages
2. Ensure your backend and frontend URLs are correctly configured
3. Verify that your hosting platforms support WebSocket connections
4. Check that CORS is properly configured for cross-origin requests

## Roadmap

Future enhancements could include:
- User authentication
- Message encryption
- File sharing
- Emoji support
- User avatars
- Push notifications
- Message reactions
- Typing indicators
