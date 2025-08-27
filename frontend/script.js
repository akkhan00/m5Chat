// Application state
const state = {
    socket: null,
    currentUser: null,
    currentRoom: null,
    isConnected: false,
    mediaRecorder: null,
    audioChunks: [],
    isRecording: false
};

// Login history management
const LOGIN_HISTORY_KEY = 'fivemc_login_history';
const MAX_HISTORY_ITEMS = 10;

function saveLoginHistory(username, roomName) {
    let history = getLoginHistory();
    
    // Create new entry
    const newEntry = {
        username,
        roomName,
        timestamp: Date.now()
    };
    
    // Remove duplicate entries (same username + room combination)
    history = history.filter(item => 
        !(item.username === username && item.roomName === roomName)
    );
    
    // Add new entry at the beginning
    history.unshift(newEntry);
    
    // Keep only the latest entries
    history = history.slice(0, MAX_HISTORY_ITEMS);
    
    localStorage.setItem(LOGIN_HISTORY_KEY, JSON.stringify(history));
    updateHistoryDisplay();
}

function getLoginHistory() {
    try {
        const history = localStorage.getItem(LOGIN_HISTORY_KEY);
        return history ? JSON.parse(history) : [];
    } catch (error) {
        console.error('Error loading login history:', error);
        return [];
    }
}

function clearLoginHistory() {
    localStorage.removeItem(LOGIN_HISTORY_KEY);
    updateHistoryDisplay();
}

function updateHistoryDisplay() {
    const historyContainer = document.getElementById('loginHistory');
    const history = getLoginHistory();
    
    if (!historyContainer) return;
    
    if (history.length === 0) {
        historyContainer.style.display = 'none';
        return;
    }
    
    historyContainer.style.display = 'block';
    const historyList = historyContainer.querySelector('.history-list');
    
    historyList.innerHTML = history.map(item => `
        <div class="history-item" onclick="selectFromHistory('${escapeHtml(item.username)}', '${escapeHtml(item.roomName)}')">
            <div class="history-info">
                <span class="history-username">${escapeHtml(item.username)}</span>
                <span class="history-room">#${escapeHtml(item.roomName)}</span>
            </div>
            <div class="history-time">${formatHistoryTime(item.timestamp)}</div>
        </div>
    `).join('');
}

function selectFromHistory(username, roomName) {
    elements.username.value = username;
    elements.roomName.value = roomName;
    
    // Auto-focus the join button or trigger join if both fields are filled
    if (username.trim() && roomName.trim()) {
        const joinButton = elements.loginForm.querySelector('button[type="submit"]');
        if (joinButton) {
            joinButton.focus();
            // Optional: Auto-join after selecting from history
            // setTimeout(() => elements.loginForm.dispatchEvent(new Event('submit')), 100);
        }
    }
}

function formatHistoryTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
        return 'Just now';
    } else if (diffInHours < 24) {
        return `${Math.floor(diffInHours)}h ago`;
    } else {
        const diffInDays = Math.floor(diffInHours / 24);
        return `${diffInDays}d ago`;
    }
}

// Configuration - Update this URL when you deploy your backend
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:8000' 
    : 'https://skillful-laughter-production.up.railway.app';

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
    
    imageUpload: document.getElementById('imageUpload'),
    uploadProgress: document.getElementById('uploadProgress'),
    
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

// Image upload functions
function showUploadProgress(show) {
    elements.uploadProgress.style.display = show ? 'block' : 'none';
    if (show) {
        updateUploadProgress(0);
    }
}

function updateUploadProgress(percentage) {
    const progressFill = elements.uploadProgress.querySelector('.progress-fill');
    const progressText = elements.uploadProgress.querySelector('.progress-text');
    
    progressFill.style.width = `${percentage}%`;
    progressText.textContent = percentage === 100 ? 'Upload complete!' : `Uploading image... ${Math.round(percentage)}%`;
}

async function uploadImage(file) {
    if (!state.currentUser || !state.currentRoom) {
        alert('Please join a room first');
        return;
    }
    
    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB');
        return;
    }
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
    }
    
    showUploadProgress(true);
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('username', state.currentUser);
    formData.append('room', state.currentRoom);
    
    try {
        const response = await fetch(`${API_URL}/upload-image`, {
            method: 'POST',
            body: formData
        });
        
        updateUploadProgress(100);
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Upload failed');
        }
        
        const result = await response.json();
        console.log('Image uploaded successfully:', result);
        
        // Hide progress after a short delay
        setTimeout(() => showUploadProgress(false), 1000);
        
    } catch (error) {
        console.error('Upload error:', error);
        alert('Failed to upload image: ' + error.message);
        showUploadProgress(false);
    }
}

// Message rendering functions
function createMessageElement(message, isOwnMessage = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isOwnMessage ? 'own' : ''}`;
    messageDiv.setAttribute('data-message-id', message.id);
    
    let contentHTML = '';
    
    if (message.message_type === 'image' && message.image_url) {
        contentHTML = `
            <div class="message-header">
                <span class="message-username">${escapeHtml(message.username)}</span>
                <span class="message-time">${formatTime(message.timestamp)}</span>
            </div>
            <div class="message-content">
                <div class="image-message-filename">${escapeHtml(message.content)}</div>
                <img src="${API_URL}${message.image_url}" alt="Shared image" class="message-image" onclick="openImageModal('${API_URL}${message.image_url}')">
            </div>
        `;
    } else if (message.message_type === 'voice' && message.voice_url) {
        contentHTML = `
            <div class="message-header">
                <span class="message-username">${escapeHtml(message.username)}</span>
                <span class="message-time">${formatTime(message.timestamp)}</span>
            </div>
            <div class="message-content">
                <div class="voice-message">
                    <button class="voice-play-btn" onclick="toggleVoicePlayback('${message.id}', '${API_URL}${message.voice_url}')">
                        <i class="fas fa-play"></i>
                    </button>
                    <div class="voice-waveform">
                        <div class="voice-progress" id="voice-progress-${message.id}"></div>
                    </div>
                    <span class="voice-duration" id="voice-duration-${message.id}">0:00</span>
                    <audio id="voice-audio-${message.id}" preload="metadata">
                        <source src="${API_URL}${message.voice_url}" type="audio/webm">
                        <source src="${API_URL}${message.voice_url}" type="audio/wav">
                        Your browser does not support the audio element.
                    </audio>
                </div>
            </div>
        `;
    } else {
        contentHTML = `
            <div class="message-header">
                <span class="message-username">${escapeHtml(message.username)}</span>
                <span class="message-time">${formatTime(message.timestamp)}</span>
            </div>
            <div class="message-content">${escapeHtml(message.content)}</div>
        `;
    }
    
    messageDiv.innerHTML = contentHTML;
    return messageDiv;
}

function openImageModal(imageUrl) {
    // Simple image modal - open in new tab for now
    window.open(imageUrl, '_blank');
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

function updateActiveUsers(users) {
    let activeUsersElement = document.getElementById('activeUsers');
    
    if (!activeUsersElement) {
        // Create active users element if it doesn't exist
        const chatHeader = document.querySelector('.chat-header');
        if (chatHeader) {
            activeUsersElement = document.createElement('div');
            activeUsersElement.id = 'activeUsers';
            activeUsersElement.className = 'active-users';
            chatHeader.appendChild(activeUsersElement);
        }
    }
    
    if (activeUsersElement && users && users.length > 0) {
        const userCount = users.length;
        const displayUsers = users.slice(0, 3); // Show max 3 usernames
        const remainingCount = Math.max(0, userCount - 3);
        
        let usersText = displayUsers.join(', ');
        if (remainingCount > 0) {
            usersText += ` +${remainingCount} more`;
        }
        
        activeUsersElement.innerHTML = `
            <i class="fas fa-users"></i>
            <span class="user-count">${userCount}</span>
            <span class="user-names">${usersText}</span>
        `;
        activeUsersElement.style.display = 'flex';
    } else if (activeUsersElement) {
        activeUsersElement.style.display = 'none';
    }
}

// Socket connection functions
function connectToServer() {
    // Clean up any existing socket connection
    if (state.socket) {
        state.socket.disconnect();
        state.socket = null;
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
        
        // Try to reconnect with fallback URL if initial connection fails
        if (API_URL.includes('localhost') && !window.location.hostname.includes('localhost')) {
            // Switch to production URL if localhost fails
            setTimeout(() => {
                state.socket.disconnect();
                state.socket = io('https://skillful-laughter-production.up.railway.app', {
                    transports: ['websocket', 'polling'],
                    timeout: 10000,
                    forceNew: true
                });
                setupSocketEventListeners();
            }, 2000);
        } else {
            showError('Unable to connect to the chat server. Please check your internet connection and try again.');
        }
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
        
        // Update active users if provided
        if (data.active_users) {
            updateActiveUsers(data.active_users);
        }
        
        showScreen(elements.chatScreen);
    });
    
    socket.on('new_message', (message) => {
        console.log('New message:', message);
        const isOwnMessage = message.username === state.currentUser;
        addMessage(message, isOwnMessage);
    });
    
    socket.on('user_joined', (data) => {
        addSystemMessage(`${data.username} joined the chat`);
        if (data.active_users) {
            updateActiveUsers(data.active_users);
        }
    });
    
    socket.on('user_left', (data) => {
        addSystemMessage(`${data.username} left the chat`);
        if (data.active_users) {
            updateActiveUsers(data.active_users);
        }
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
        
        // Disconnect the socket to ensure clean state
        state.socket.disconnect();
        state.socket = null;
    }
    
    // Reset state completely
    state.currentUser = null;
    state.currentRoom = null;
    state.isConnected = false;
    
    // Clear messages
    elements.messagesContainer.innerHTML = `
        <div class="welcome-message">
            <i class="fas fa-info-circle"></i>
            <p>Welcome to 5mChat! Messages in this room will automatically delete after 5 minutes.</p>
        </div>
    `;
    
    // Reset forms but keep the values for convenience
    elements.messageInput.value = '';
    
    // Update connection status
    updateConnectionStatus('disconnected');
    
    showScreen(elements.loginScreen);
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Initialize login history display
    updateHistoryDisplay();
    
    // About modal functionality
    const aboutBtn = document.getElementById('aboutBtn');
    const aboutModal = document.getElementById('aboutModal');
    const closeAbout = document.getElementById('closeAbout');
    
    aboutBtn.addEventListener('click', () => {
        aboutModal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    });
    
    closeAbout.addEventListener('click', () => {
        aboutModal.style.display = 'none';
        document.body.style.overflow = 'auto';
    });
    
    // Close modal when clicking outside
    aboutModal.addEventListener('click', (e) => {
        if (e.target === aboutModal) {
            aboutModal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    });
    
    // Close modal with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && aboutModal.style.display === 'block') {
            aboutModal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    });
    
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
        
        // Validate username (alphanumeric + underscores/hyphens only)
        if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
            alert('Username can only contain letters, numbers, underscores, and hyphens');
            return;
        }
        
        // Validate room name (alphanumeric + underscores/hyphens only)
        if (!/^[a-zA-Z0-9_-]+$/.test(roomName)) {
            alert('Room name can only contain letters, numbers, underscores, and hyphens');
            return;
        }
        
        state.currentUser = username;
        state.currentRoom = roomName;
        
        // Save to history
        saveLoginHistory(username, roomName);
        
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
    
    // Join new room button
    const joinNewRoomBtn = document.getElementById('joinNewRoomBtn');
    if (joinNewRoomBtn) {
        joinNewRoomBtn.addEventListener('click', () => {
            if (confirm('Leave current room and join a new one?')) {
                leaveRoom();
            }
        });
    }
    
    // Retry connection button
    elements.retryBtn.addEventListener('click', () => {
        connectToServer();
    });
    
    // Image upload handler
    elements.imageUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            uploadImage(file);
            // Clear the input so the same file can be selected again
            e.target.value = '';
        }
    });
    
    // Voice recording handler
    const voiceRecordBtn = document.getElementById('voiceRecordBtn');
    if (voiceRecordBtn) {
        voiceRecordBtn.addEventListener('click', toggleVoiceRecording);
    }
    
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

// Voice recording functions
async function toggleVoiceRecording() {
    if (!state.currentUser || !state.currentRoom) {
        alert('Please join a room first');
        return;
    }
    
    const voiceBtn = document.getElementById('voiceRecordBtn');
    
    if (!state.isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            state.mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus'
            });
            
            state.audioChunks = [];
            
            state.mediaRecorder.addEventListener('dataavailable', (event) => {
                if (event.data.size > 0) {
                    state.audioChunks.push(event.data);
                }
            });
            
            state.mediaRecorder.addEventListener('stop', () => {
                const audioBlob = new Blob(state.audioChunks, { type: 'audio/webm' });
                uploadVoice(audioBlob);
                
                // Stop all tracks
                stream.getTracks().forEach(track => track.stop());
            });
            
            state.mediaRecorder.start();
            state.isRecording = true;
            
            voiceBtn.classList.add('recording');
            voiceBtn.innerHTML = '<i class="fas fa-stop"></i>';
            
        } catch (error) {
            console.error('Error accessing microphone:', error);
            alert('Could not access microphone. Please check your permissions.');
        }
    } else {
        state.mediaRecorder.stop();
        state.isRecording = false;
        
        voiceBtn.classList.remove('recording');
        voiceBtn.innerHTML = '<i class="fas fa-microphone"></i>';
    }
}

async function uploadVoice(audioBlob) {
    if (!state.currentUser || !state.currentRoom) {
        alert('Please join a room first');
        return;
    }
    
    const formData = new FormData();
    formData.append('file', audioBlob, 'voice-message.webm');
    formData.append('username', state.currentUser);
    formData.append('room', state.currentRoom);
    
    try {
        const response = await fetch(`${API_URL}/upload-voice`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Upload failed');
        }
        
        const result = await response.json();
        console.log('Voice message uploaded successfully:', result);
        
    } catch (error) {
        console.error('Voice upload error:', error);
        alert('Failed to upload voice message: ' + error.message);
    }
}

// Voice playback functions
function toggleVoicePlayback(messageId, voiceUrl) {
    const audio = document.getElementById(`voice-audio-${messageId}`);
    const playBtn = document.querySelector(`[onclick*="${messageId}"]`);
    const progressBar = document.getElementById(`voice-progress-${messageId}`);
    const durationSpan = document.getElementById(`voice-duration-${messageId}`);
    
    if (!audio) return;
    
    if (audio.paused) {
        // Stop all other playing audio
        document.querySelectorAll('audio').forEach(a => {
            if (a !== audio) {
                a.pause();
                a.currentTime = 0;
            }
        });
        
        // Reset all play buttons
        document.querySelectorAll('.voice-play-btn').forEach(btn => {
            btn.classList.remove('playing');
            btn.innerHTML = '<i class="fas fa-play"></i>';
        });
        
        audio.play();
        playBtn.classList.add('playing');
        playBtn.innerHTML = '<i class="fas fa-pause"></i>';
    } else {
        audio.pause();
        playBtn.classList.remove('playing');
        playBtn.innerHTML = '<i class="fas fa-play"></i>';
    }
    
    // Update duration on load
    audio.addEventListener('loadedmetadata', () => {
        durationSpan.textContent = formatAudioDuration(audio.duration);
    });
    
    // Update progress during playback
    audio.addEventListener('timeupdate', () => {
        if (audio.duration) {
            const progress = (audio.currentTime / audio.duration) * 100;
            progressBar.style.width = `${progress}%`;
        }
    });
    
    // Reset when ended
    audio.addEventListener('ended', () => {
        playBtn.classList.remove('playing');
        playBtn.innerHTML = '<i class="fas fa-play"></i>';
        progressBar.style.width = '0%';
        audio.currentTime = 0;
    });
}

function formatAudioDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Theme Management
const THEME_KEY = 'fivemc_selected_theme';

function initializeTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY) || 'default';
    applyTheme(savedTheme);
    updateThemeSelector(savedTheme);
}

function applyTheme(themeName) {
    document.documentElement.setAttribute('data-theme', themeName);
    localStorage.setItem(THEME_KEY, themeName);
}

function updateThemeSelector(activeTheme) {
    const themeOptions = document.querySelectorAll('.theme-option');
    themeOptions.forEach(option => {
        const theme = option.getAttribute('data-theme');
        option.classList.toggle('active', theme === activeTheme);
    });
}

// Floating Elements Management
function initializeFloatingElements() {
    // Refresh Button
    const refreshButton = document.getElementById('refreshButton');
    const themeToggle = document.getElementById('themeToggle');
    const themeOptions = document.getElementById('themeOptions');
    
    // Refresh button functionality
    refreshButton.addEventListener('click', () => {
        // Add loading animation
        refreshButton.style.transform = 'scale(0.9) rotate(360deg)';
        refreshButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        
        // Reload the page after a short delay
        setTimeout(() => {
            window.location.reload();
        }, 500);
    });
    
    // Theme selector functionality
    let themeOptionsVisible = false;
    
    themeToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        themeOptionsVisible = !themeOptionsVisible;
        themeOptions.classList.toggle('show', themeOptionsVisible);
    });
    
    // Close theme options when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.floating-theme-selector')) {
            themeOptionsVisible = false;
            themeOptions.classList.remove('show');
        }
    });
    
    // Theme option selection
    document.querySelectorAll('.theme-option').forEach(option => {
        option.addEventListener('click', (e) => {
            const selectedTheme = option.getAttribute('data-theme');
            applyTheme(selectedTheme);
            updateThemeSelector(selectedTheme);
            
            // Close theme options
            themeOptionsVisible = false;
            themeOptions.classList.remove('show');
            
            // Add feedback animation
            option.style.transform = 'scale(0.95)';
            setTimeout(() => {
                option.style.transform = 'scale(1)';
            }, 150);
        });
    });
    
    // Prevent scroll reload behavior
    let isScrolling = false;
    let scrollTimeout;
    
    window.addEventListener('scroll', (e) => {
        // Clear the timeout if it's already set
        clearTimeout(scrollTimeout);
        
        // Set isScrolling to true
        isScrolling = true;
        
        // Reset isScrolling after scrolling has stopped
        scrollTimeout = setTimeout(() => {
            isScrolling = false;
        }, 100);
        
        // Prevent any default scroll behaviors that might trigger reload
        if (window.scrollY < -50 || (window.scrollY + window.innerHeight) > document.body.scrollHeight + 50) {
            e.preventDefault();
            window.scrollTo(0, Math.max(0, Math.min(window.scrollY, document.body.scrollHeight - window.innerHeight)));
        }
    });
    
    // Prevent pull-to-refresh on mobile
    document.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        const touchY = e.touches[0].clientY;
        if (touchY <= 10 && window.scrollY === 0) {
            e.preventDefault();
        }
    }, { passive: false });
    
    document.addEventListener('touchmove', (e) => {
        if (window.scrollY === 0 && e.touches[0].clientY > e.touches[0].clientY) {
            e.preventDefault();
        }
    }, { passive: false });
}

// Initialize the app
console.log('5mChat client initialized');

// Initialize theme and floating elements when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initializeTheme();
    initializeFloatingElements();
});

// Handle page refresh/close
window.addEventListener('beforeunload', () => {
    if (state.socket) {
        leaveRoom();
    }
});
