// Application state
const state = {
    socket: null,
    currentUser: null,
    currentRoom: null,
    isConnected: false
};

// Configuration - Update this URL when you deploy your backend
const API_URL = 'http://localhost:8000';

// DOM elements
const elements = {
    loginScreen: document.getElementById('loginScreen'),
    chatScreen: document.getElementById('chatScreen'),
    loadingScreen: document.getElementById('loadingScreen'),
    errorScreen: document.getElementById('errorScreen'),
    
    loginForm: document.getElementById('loginForm'),
    username: document.getElementById('username'),
    roomName: document.getElementById('roomName'),
    
    currentRoomName: document.getElementById('currentRoomName'),
    connectionStatus: document.getElementById('connectionStatus'),
    messagesContainer: document.getElementById('messagesContainer'),
    messageForm: document.getElementById('messageForm'),
    messageInput: document.getElementById('messageInput'),
    leaveRoomBtn: document.getElementById('leaveRoomBtn'),
    
    errorText: document.getElementById('errorText'),
    retryBtn: document.getElementById('retryBtn')
};

// Utility functions
function showScreen(screenElement) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    screenElement.classList.add('active');
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
        hour12: true, 
        hour: '2-digit', 
        minute: '2-digit' 
    });
}

function scrollToBottom() {
    elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
}

function showError(message, showRetry = true) {
    elements.errorText.textContent = message;
    elements.retryBtn.style.display = showRetry ? 'inline-flex' : 'none';
    showScreen(elements.errorScreen);
}

function updateConnectionStatus(status, message) {
    const statusElement = elements.connectionStatus;
    const icon = statusElement.querySelector('i');
    
    statusElement.className = `status-indicator ${status}`;
    
    switch (status) {
        case 'connected':
            icon.className = 'fas fa-circle';
            statusElement.innerHTML = '<i class="fas fa-circle"></i> Connected';
            break;
        case 'connecting':
            icon.className = 'fas fa-circle';
            statusElement.innerHTML = '<i class="fas fa-circle"></i> Connecting...';
            break;
        case 'disconnected':
            icon.className = 'fas fa-circle';
            statusElement.innerHTML = '<i class="fas fa-circle"></i> Disconnected';
            break;
    }
}

// Message rendering functions
function createMessageElement(message, isOwnMessage = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isOwnMessage ? 'own' : ''}`;
    messageDiv.setAttribute('data-message-id', message.id);
    
    messageDiv.innerHTML = `
        <div class="message-header">
            <span class="message-username">${escapeHtml(message.username)}</span>
            <span class="message-time">${formatTime(message.timestamp)}</span>
        </div>
        <div class="message-content">${escapeHtml(message.content)}</div>
    `;
    
    return messageDiv;
}

function createSystemMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'system-message';
    messageDiv.textContent = text;
    return messageDiv;
}

function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function addMessage(message, isOwnMessage = false) {
    const welcomeMsg = elements.messagesContainer.querySelector('.welcome-message');
    if (welcomeMsg) {
        welcomeMsg.remove();
    }
    
    const messageElement = createMessageElement(message, isOwnMessage);
    elements.messagesContainer.appendChild(messageElement);
    scrollToBottom();
}

function addSystemMessage(text) {
    const systemMessage = createSystemMessage(text);
    elements.messagesContainer.appendChild(systemMessage);
    scrollToBottom();
}

// Socket connection functions
function connectToServer() {
    if (state.socket && state.socket.connected) {
        return;
    }
    
    showScreen(elements.loadingScreen);
    updateConnectionStatus('connecting');
    
    try {
        state.socket = io(API_URL, {
            transports: ['websocket', 'polling'],
            timeout: 10000,
            forceNew: true
        });
        
        setupSocketEventListeners();
        
    } catch (error) {
        console.error('Failed to create socket connection:', error);
        showError('Failed to initialize connection. Please try again.');
    }
}

function setupSocketEventListeners() {
    const socket = state.socket;
    
    // Connection events
    socket.on('connect', () => {
        console.log('Connected to server');
        state.isConnected = true;
        updateConnectionStatus('connected');
        
        // Auto-join room if we have the info
        if (state.currentUser && state.currentRoom) {
            joinRoom();
        }
    });
    
    socket.on('disconnect', (reason) => {
        console.log('Disconnected from server:', reason);
        state.isConnected = false;
        updateConnectionStatus('disconnected');
        
        if (reason === 'io server disconnect') {
            // Server disconnected, need to reconnect manually
            setTimeout(() => connectToServer(), 2000);
        }
    });
    
    socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        state.isConnected = false;
        showError('Unable to connect to the chat server. Please check your internet connection and try again.');
    });
    
    // Chat events
    socket.on('connected', (data) => {
        console.log('Server welcome:', data);
    });
    
    socket.on('room_history', (data) => {
        console.log('Received room history:', data);
        
        // Clear existing messages except welcome message
        const messages = elements.messagesContainer.querySelectorAll('.message, .system-message');
        messages.forEach(msg => msg.remove());
        
        // Add historical messages
        data.messages.forEach(message => {
            const isOwnMessage = message.username === state.currentUser;
            addMessage(message, isOwnMessage);
        });
        
        showScreen(elements.chatScreen);
    });
    
    socket.on('new_message', (message) => {
        console.log('New message:', message);
        const isOwnMessage = message.username === state.currentUser;
        addMessage(message, isOwnMessage);
    });
    
    socket.on('user_joined', (data) => {
        addSystemMessage(`${data.username} joined the chat`);
    });
    
    socket.on('user_left', (data) => {
        addSystemMessage(`${data.username} left the chat`);
    });
    
    socket.on('error', (error) => {
        console.error('Socket error:', error);
        alert('Error: ' + error.message);
    });
}

function joinRoom() {
    if (!state.socket || !state.socket.connected) {
        showError('Not connected to server. Please try again.');
        return;
    }
    
    state.socket.emit('join_room', {
        username: state.currentUser,
        room: state.currentRoom
    });
    
    elements.currentRoomName.textContent = `Room: #${state.currentRoom}`;
}

function sendMessage(content) {
    if (!state.socket || !state.socket.connected) {
        alert('Not connected to server. Please wait for connection to be restored.');
        return;
    }
    
    if (!content.trim()) {
        return;
    }
    
    state.socket.emit('send_message', {
        username: state.currentUser,
        content: content.trim(),
        room: state.currentRoom
    });
}

function leaveRoom() {
    if (state.socket && state.socket.connected) {
        state.socket.emit('leave_room', {
            username: state.currentUser,
            room: state.currentRoom
        });
    }
    
    // Reset state
    state.currentUser = null;
    state.currentRoom = null;
    
    // Clear messages
    elements.messagesContainer.innerHTML = `
        <div class="welcome-message">
            <i class="fas fa-info-circle"></i>
            <p>Welcome to 5mChat! Messages in this room will automatically delete after 5 minutes.</p>
        </div>
    `;
    
    // Reset forms
    elements.username.value = '';
    elements.roomName.value = '';
    elements.messageInput.value = '';
    
    showScreen(elements.loginScreen);
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Login form
    elements.loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const username = elements.username.value.trim();
        const roomName = elements.roomName.value.trim();
        
        if (!username || !roomName) {
            alert('Please enter both username and room name');
            return;
        }
        
        if (username.length > 20) {
            alert('Username must be 20 characters or less');
            return;
        }
        
        if (roomName.length > 30) {
            alert('Room name must be 30 characters or less');
            return;
        }
        
        state.currentUser = username;
        state.currentRoom = roomName;
        
        connectToServer();
    });
    
    // Message form
    elements.messageForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const content = elements.messageInput.value.trim();
        if (content) {
            sendMessage(content);
            elements.messageInput.value = '';
        }
    });
    
    // Leave room button
    elements.leaveRoomBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to leave this room?')) {
            leaveRoom();
        }
    });
    
    // Retry connection button
    elements.retryBtn.addEventListener('click', () => {
        connectToServer();
    });
    
    // Auto-focus message input when chat screen is active
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.target === elements.chatScreen && 
                mutation.target.classList.contains('active')) {
                elements.messageInput.focus();
            }
        });
    });
    
    observer.observe(elements.chatScreen, {
        attributes: true,
        attributeFilter: ['class']
    });
    
    // Handle window visibility change (reconnect when tab becomes visible)
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && state.currentUser && state.currentRoom && !state.isConnected) {
            setTimeout(() => {
                if (!state.isConnected) {
                    connectToServer();
                }
            }, 1000);
        }
    });
});

// Initialize the app
console.log('5mChat client initialized');

// Handle page refresh/close
window.addEventListener('beforeunload', () => {
    if (state.socket) {
        leaveRoom();
    }
});
