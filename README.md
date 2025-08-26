<div align="center">
  <img src="https://raw.githubusercontent.com/Mool-Integration/5mChat/main/logo.png" alt="5mChat Logo" width="150">
  <h1>5mChat - Ephemeral Chat Application</h1>
  <p>
    <strong>A modern, real-time chat application where messages automatically disappear after 5 minutes.</strong>
  </p>
  <p>
    <a href="#features">✨ Features</a> •
    <a href="#tech-stack">🛠️ Tech Stack</a> •
    <a href="#local-development">🚀 Local Development</a> •
    <a href="#deployment">☁️ Deployment</a> •
    <a href="#api-endpoints">🔌 API Endpoints</a> •
    <a href="#contributing">🤝 Contributing</a> •
    <a href="#license">📄 License</a>
  </p>
</div>

## ✨ Features

- 🕐 **Ephemeral Messaging**: Messages automatically delete after 5 minutes.
- 💬 **Real-time Communication**: Instant message delivery using Socket.IO.
- 🏠 **Room-based Chat**: Create and join different chat rooms.
- 📱 **Responsive Design**: Works seamlessly on desktop, tablet, and mobile.
- 🔄 **Auto-reconnection**: Automatically reconnects when the connection is lost.
- ✨ **Clean UI**: Modern and intuitive user interface.
- 🚀 **Easy Deployment**: Ready-to-deploy configurations included for various platforms.

## 🛠️ Tech Stack

### Backend
- **Framework**: 🐍 FastAPI
- **Real-time**: ⚡ Socket.IO
- **Database**: 🗄️ SQLite
- **Scheduling**: 🕒 APScheduler
- **Server**:  ASGI Uvicorn

### Frontend
- **Language**: 📜 Vanilla JavaScript (ES6+)
- **Real-time**: ⚡ Socket.IO Client
- **Styling**: 🎨 CSS Variables
- **Icons**: Font Awesome

## 🚀 Local Development

### Prerequisites
- Python 3.8+
- A modern web browser

### Backend Setup
1.  Navigate to the `backend` directory:
    ```bash
    cd backend
    ```
2.  Create and activate a virtual environment:
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows: venv\Scripts\activate
    ```
3.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
4.  Run the server:
    ```bash
    python main.py
    ```
    The backend will be available at `http://localhost:8000`.

### Frontend Setup
1.  Navigate to the `frontend` directory:
    ```bash
    cd frontend
    ```
2.  Serve the files using a local server. For example:
    ```bash
    # Using Python
    python -m http.server 3000
    ```
    The frontend will be available at `http://localhost:3000`.

## ☁️ Deployment

### Backend Deployment
Choose your preferred platform:

- **Railway.app (Recommended)**: Deploy with `railway deploy` from the `backend` directory.
- **Render.com**: Connect your repository, and Render will use `render.yaml`.
- **Heroku**: Use `git subtree push --prefix backend heroku main`.

### Frontend Deployment
- **Netlify (Recommended)**: Drag and drop the `frontend` folder or connect your repository.
- **Vercel**: Connect your repository and set the root directory to `frontend`.

### Configuration
1.  **Update API URL**: In `frontend/script.js`, set `API_URL` to your deployed backend URL.
2.  **Environment Variables**: Set `ALLOWED_ORIGINS` on your backend hosting platform to your frontend URL.

## 🔌 API Endpoints

- `GET /` - Health check
- `GET /rooms` - Get active rooms
- `POST /rooms` - Create a new room
- `GET /rooms/{room_name}/messages` - Get room messages

### Socket.IO Events
- **Client to Server**: `join_room`, `leave_room`, `send_message`
- **Server to Client**: `connected`, `room_history`, `new_message`, `user_joined`, `user_left`, `error`

## 🤝 Contributing

Contributions are welcome! Please follow these steps:
1.  Fork the repository.
2.  Create a new feature branch.
3.  Make your changes and test thoroughly.
4.  Submit a pull request.

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---
<div align="right">
  <small><em>README enhanced by Gemini AI ✨</em></small>
</div>