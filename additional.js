// Additional features for Dating Connect App - STICKER CREATION VERSION
// Profile picture navigation and custom sticker creation like WhatsApp/Telegram

// Import Firebase modules directly
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { 
    getFirestore, 
    doc, 
    getDoc,
    collection,
    addDoc,
    serverTimestamp,
    setDoc,
    onSnapshot,
    updateDoc,
    query,
    orderBy,
    limit,
    arrayUnion,
    getDocs,
    Timestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyC9jF-ocy6HjsVzWVVlAyXW-4aIFgA79-A",
    authDomain: "crypto-6517d.firebaseapp.com",
    projectId: "crypto-6517d",
    storageBucket: "crypto-6517d.firebasestorage.app",
    messagingSenderId: "60263975159",
    appId: "1:60263975159:web:bd53dcaad86d6ed9592bf2"
  };


// Cloudinary configuration
const CLOUDINARY_CLOUD_NAME = "ddtdqrh1b";
const CLOUDINARY_UPLOAD_PRESET = "profile-pictures";

// Initialize Firebase
let app;
let auth;
let db;

try {
    if (!window.firebaseApps) {
        window.firebaseApps = {};
    }
    
    const appName = '[DEFAULT]';
    
    if (!window.firebaseApps[appName]) {
        app = initializeApp(firebaseConfig, appName);
        window.firebaseApps[appName] = app;
    } else {
        app = window.firebaseApps[appName];
    }
    
    auth = getAuth(app);
    db = getFirestore(app);
    
} catch (error) {
    console.error('Error initializing Firebase:', error);
    app = { name: 'DEFAULT', options: {} };
    auth = { currentUser: null };
    db = {};
}

// Global variables
let currentUser = null;
let chatPartnerId = null;
let currentThreadId = null;
let userStickers = [];
let stickerPickerOpen = false;
let stickerCreatorVars = {
    currentStep: 1,
    stickerType: '',
    selectedImage: null,
    selectedEmoji: '😊',
    imageFile: null
};

const sentStickerIds = new Set();
let isStickerSending = false;
let stickerListenerUnsubscribe = null;

// CRITICAL: Flag to prevent main chat system from processing stickers
window.isStickerMessage = false;

// Message tracking to prevent duplicates
const displayedMessageIds = new Set();
let isLoadingMessages = false;

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    loadStickerStyles();
    
    if (auth && typeof onAuthStateChanged === 'function') {
        onAuthStateChanged(auth, (user) => {
            if (user) {
                currentUser = user;
                initializeFeatures();
            } else {
                currentUser = null;
                try {
                    initializeBasicFeatures();
                } catch (e) {
                    console.log('User not authenticated');
                }
            }
        }, (error) => {
            console.error('Auth state error:', error);
            initializeBasicFeatures();
        });
    } else {
        console.log('Auth not available');
        initializeBasicFeatures();
    }
});

// Initialize basic UI features without Firebase
function initializeBasicFeatures() {
    if (window.location.pathname.includes('chat.html')) {
        setTimeout(() => {
            try {
                initProfilePictureNavigation();
                loadStickerStyles();
                addStickerButton();
                setupStickerPickerEvents();
                interceptMainChatSystem();
            } catch (e) {
                console.log('Could not initialize all features:', e);
            }
        }, 1000);
    }
}

// Initialize features after auth
function initializeFeatures() {
    if (window.location.pathname.includes('chat.html')) {
        const urlParams = new URLSearchParams(window.location.search);
        chatPartnerId = urlParams.get('id');
        currentThreadId = [currentUser.uid, chatPartnerId].sort().join('_');
    }
    
    initProfilePictureNavigation();
    initStickerSystem();
    loadUserStickers();
    
    if (window.location.pathname.includes('chat.html') && chatPartnerId) {
        setTimeout(() => {
            interceptMainChatSystem();
            loadAllMessagesInOrder(); // FIXED: Load ALL messages in order
            setupStickerListener();
            setupStickerMessageEnhancer();
        }, 1500); // Increased delay to ensure main chat system is ready
    }
}

// ============================================
// FIXED: Load ALL messages (both sticker and text) in correct order
// ============================================
async function loadAllMessagesInOrder() {
    if (!currentUser || !chatPartnerId || !currentThreadId || !db) {
        console.log('Cannot load messages: missing required data');
        return;
    }

    if (isLoadingMessages) {
        console.log('Already loading messages, skipping...');
        return;
    }

    isLoadingMessages = true;
    
    try {
        console.log('Loading ALL messages for thread:', currentThreadId);
        
        const messagesQuery = query(
            collection(db, 'conversations', currentThreadId, 'messages'),
            orderBy('timestamp', 'asc'), // Changed to asc for chronological order
            limit(150) // Increased limit
        );

        const querySnapshot = await getDocs(messagesQuery);
        const allMessages = [];
        
        // First, collect all messages
        querySnapshot.forEach((doc) => {
            const message = doc.data();
            message.id = doc.id;
            message.firestoreId = doc.id;
            
            // Convert timestamp
            let timestamp = null;
            if (message.timestamp && message.timestamp.toDate) {
                timestamp = message.timestamp.toDate();
            } else if (message.timestamp && message.timestamp.seconds) {
                timestamp = new Date(message.timestamp.seconds * 1000);
            } else if (message.createdAt) {
                timestamp = new Date(message.createdAt);
            } else {
                timestamp = new Date(); // Fallback
            }
            
            message.timestampValue = timestamp.getTime();
            message.timestampObj = timestamp;
            
            allMessages.push(message);
        });

        console.log(`Found ${allMessages.length} total messages`);
        
        // Sort by timestamp in ASCENDING order (oldest first)
        allMessages.sort((a, b) => a.timestampValue - b.timestampValue);
        
        // Clear existing messages first
        const messagesContainer = document.getElementById('chatMessages');
        if (messagesContainer) {
            messagesContainer.innerHTML = '';
            displayedMessageIds.clear();
        }
        
        // Display all messages in correct order
        allMessages.forEach(message => {
            if (displayedMessageIds.has(message.id)) {
                return; // Skip already displayed messages
            }
            
            if (message.type === 'sticker' || 
                message.text === '[STICKER-IGNORE]' || 
                message.text === '[STICKER]' ||
                message.stickerId ||
                message.isSticker) {
                // This is a sticker message
                displayStickerFromDatabase(message);
            } else if (message.text && 
                      !message.text.includes('[STICKER]') && 
                      message.text !== '[STICKER-IGNORE]') {
                // This is a regular text message
                if (typeof window.displayMessage === 'function') {
                    // Let the main chat system handle it
                    window.displayMessage(message, message.senderId === currentUser.uid);
                } else {
                    displayTextMessageFromDatabase(message);
                }
            }
            
            displayedMessageIds.add(message.id);
        });
        
        // Scroll to bottom after loading
        setTimeout(() => {
            const messagesContainer = document.getElementById('chatMessages');
            if (messagesContainer) {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
        }, 100);

    } catch (error) {
        console.error('Error loading messages:', error);
    } finally {
        isLoadingMessages = false;
    }
}

// Display text message from database (fallback)
function displayTextMessageFromDatabase(message) {
    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) {
        setTimeout(() => displayTextMessageFromDatabase(message), 500);
        return;
    }

    const isSent = message.senderId === currentUser.uid;
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;
    messageDiv.dataset.messageId = message.id;
    
    const p = document.createElement('p');
    p.textContent = message.text || '';
    messageDiv.appendChild(p);
    
    const timeSpan = document.createElement('span');
    timeSpan.className = 'message-time';
    
    if (message.timestampObj) {
        timeSpan.textContent = formatTime(message.timestampObj);
    } else if (message.timestamp && message.timestamp.toDate) {
        timeSpan.textContent = formatTime(message.timestamp.toDate());
    } else {
        timeSpan.textContent = 'Earlier';
    }
    
    messageDiv.appendChild(timeSpan);
    
    messagesContainer.appendChild(messageDiv);
}

// Display sticker from database data
function displayStickerFromDatabase(message) {
    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) {
        setTimeout(() => displayStickerFromDatabase(message), 500);
        return;
    }

    // Check if this sticker is already displayed
    if (displayedMessageIds.has(message.id)) {
        return;
    }

    const stickerData = {
        id: message.stickerId || message.id,
        name: message.stickerName || 'Sticker',
        type: message.stickerType || 'text',
        url: message.stickerUrl || '',
        emoji: message.stickerEmoji || '',
        text: message.stickerText || ''
    };

    const isSent = message.senderId === currentUser.uid;
    
    // Create pure sticker element
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isSent ? 'sent' : 'received'} sticker-message sticker-enhanced`;
    messageDiv.dataset.messageId = message.id;
    messageDiv.dataset.stickerId = stickerData.id;
    messageDiv.dataset.stickerName = stickerData.name;
    messageDiv.dataset.stickerType = stickerData.type;
    messageDiv.dataset.stickerUrl = stickerData.url || '';
    messageDiv.dataset.stickerEmoji = stickerData.emoji || '';
    messageDiv.dataset.stickerText = stickerData.text || '';
    messageDiv.dataset.isCustom = 'true';
    messageDiv.dataset.type = 'sticker';
    messageDiv.dataset.timestamp = message.timestampValue || Date.now();
    
    // Inline styles
    messageDiv.style.cssText = `
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
        padding: 5px !important;
        margin: 5px 0 !important;
        max-width: 200px !important;
        display: block !important;
        clear: both !important;
        float: ${isSent ? 'right' : 'left'} !important;
        margin-${isSent ? 'right' : 'left'}: 10px !important;
        animation: fadeIn 0.3s ease !important;
    `;
    
    let stickerHTML = '';
    
    if (stickerData.type === 'image' && stickerData.url) {
        stickerHTML = `
            <div class="sticker-message-content">
                <div class="sticker-image-container">
                    <img src="${stickerData.url}" 
                         alt="${stickerData.name || 'Sticker'}" 
                         class="sticker-message-image"
                         onerror="this.onerror=null;this.src='https://via.placeholder.com/150/FF6B8B/FFFFFF?text=Sticker'">
                    ${stickerData.text ? `<div class="sticker-text-on-image">${stickerData.text}</div>` : ''}
                </div>
            </div>
        `;
    } else if (stickerData.type === 'text') {
        stickerHTML = `
            <div class="sticker-message-content">
                <div class="text-sticker-message">
                    <span class="sticker-emoji-large">${stickerData.emoji || '🎨'}</span>
                    ${stickerData.text ? `<span class="sticker-text-large">${stickerData.text}</span>` : ''}
                </div>
            </div>
        `;
    } else {
        return;
    }
    
    const stickerContainer = document.createElement('div');
    stickerContainer.className = 'sticker-display-container';
    stickerContainer.innerHTML = stickerHTML;
    
    const content = stickerContainer.querySelector('.sticker-message-content');
    if (content) {
        if (isSent) {
            content.style.background = '#000000';
            content.style.borderColor = '#333333';
            content.style.color = 'white';
        } else {
            content.style.background = 'white';
            content.style.borderColor = '#e8e8e8';
            content.style.color = '#333';
        }
    }
    
    messageDiv.appendChild(stickerContainer);
    
    // Add timestamp
    const timeSpan = document.createElement('span');
    timeSpan.className = 'message-time';
    
    if (message.timestampObj) {
        timeSpan.textContent = formatTime(message.timestampObj);
    } else if (message.timestamp && message.timestamp.toDate) {
        timeSpan.textContent = formatTime(message.timestamp.toDate());
    } else {
        timeSpan.textContent = 'Earlier';
    }
    
    messageDiv.appendChild(timeSpan);
    
    // Insert in correct position based on timestamp
    insertMessageInOrder(messagesContainer, messageDiv, message.timestampValue || Date.now());
    
    displayedMessageIds.add(message.id);
}

// Insert message in chronological order
function insertMessageInOrder(container, messageElement, timestamp) {
    const allMessages = container.querySelectorAll('.message');
    let inserted = false;
    
    // Convert NodeList to Array for easier manipulation
    const messagesArray = Array.from(allMessages);
    
    // Find the correct position
    for (let i = 0; i < messagesArray.length; i++) {
        const existingMsg = messagesArray[i];
        const existingTimestamp = parseInt(existingMsg.dataset.timestamp) || 0;
        
        if (timestamp < existingTimestamp) {
            container.insertBefore(messageElement, existingMsg);
            inserted = true;
            break;
        }
    }
    
    // If not inserted, append to end
    if (!inserted) {
        container.appendChild(messageElement);
    }
    
    // Re-arrange all messages to ensure proper float clearing
    setTimeout(() => {
        arrangeMessages(container);
    }, 10);
}

// Arrange messages to prevent float issues
function arrangeMessages(container) {
    const messages = container.querySelectorAll('.message');
    let lastSender = null;
    let lastTimestamp = 0;
    
    messages.forEach((msg, index) => {
        const isSticker = msg.classList.contains('sticker-message');
        const isSent = msg.classList.contains('sent');
        const currentTimestamp = parseInt(msg.dataset.timestamp) || 0;
        
        // Add clear: both if sender changes or time gap is large
        if (lastSender !== null && lastSender !== isSent) {
            msg.style.clear = 'both';
        } else if (currentTimestamp - lastTimestamp > 300000) { // 5 minutes gap
            msg.style.clear = 'both';
        }
        
        // Add margin for better separation
        if (index > 0) {
            const prevMsg = messages[index - 1];
            const prevIsSticker = prevMsg.classList.contains('sticker-message');
            const prevIsSent = prevMsg.classList.contains('sent');
            
            if (prevIsSent !== isSent || prevIsSticker !== isSticker) {
                msg.style.marginTop = '15px';
            } else {
                msg.style.marginTop = '3px';
            }
        }
        
        lastSender = isSent;
        lastTimestamp = currentTimestamp;
    });
}

// Format time for display
function formatTime(date) {
    if (!(date instanceof Date)) {
        date = new Date(date);
    }
    
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
}

// ============================================
// CRITICAL: Intercept the main chat system
// ============================================
function interceptMainChatSystem() {
    if (!window.location.pathname.includes('chat.html')) return;
    
    console.log('Intercepting main chat system...');
    
    // Method 1: Intercept the send button
    const originalSendFunction = window.sendMessage;
    if (typeof originalSendFunction === 'function') {
        window.sendMessage = function() {
            if (window.isStickerMessage) {
                console.log('Blocked main send function for sticker');
                return false;
            }
            return originalSendFunction.apply(this, arguments);
        };
        console.log('Intercepted sendMessage function');
    }
    
    // Method 2: Intercept message display function
    if (typeof window.displayMessage === 'function') {
        const originalDisplayMessage = window.displayMessage;
        window.displayMessage = function(messageData, isSent) {
            if (messageData.type === 'sticker' || 
                messageData.text === '[STICKER]' || 
                messageData.text === '[STICKER-IGNORE]' ||
                messageData.stickerId ||
                messageData.isSticker) {
                console.log('Blocked displayMessage for sticker');
                return null;
            }
            
            // Check if already displayed
            if (messageData.id && displayedMessageIds.has(messageData.id)) {
                return null;
            }
            
            const result = originalDisplayMessage.apply(this, arguments);
            
            if (messageData.id) {
                displayedMessageIds.add(messageData.id);
            }
            
            // Re-arrange messages after new one is added
            setTimeout(() => {
                const container = document.getElementById('chatMessages');
                if (container) {
                    arrangeMessages(container);
                }
            }, 100);
            
            return result;
        };
        console.log('Intercepted displayMessage function');
    }
    
    // Method 3: Intercept the send button click directly
    const sendButton = document.getElementById('sendButton');
    if (sendButton) {
        const originalClick = sendButton.onclick;
        sendButton.onclick = function(e) {
            if (window.isStickerMessage) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                console.log('Blocked send button click for sticker');
                return false;
            }
            if (originalClick) return originalClick.call(this, e);
        };
        console.log('Intercepted send button click');
    }
    
    // Method 4: Listen for any message additions and remove sticker text bubbles
    const messagesContainer = document.getElementById('chatMessages');
    if (messagesContainer) {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.addedNodes.length) {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === 1 && node.classList && 
                            (node.classList.contains('message') || node.classList.contains('chat-message'))) {
                            
                            // Check if this is a text bubble for a sticker
                            const messageText = node.querySelector('p');
                            if (messageText && (messageText.textContent === '[STICKER]' || 
                                                messageText.textContent === '[STICKER-IGNORE]' ||
                                                messageText.textContent.includes('[STICKER]'))) {
                                console.log('Removing duplicate sticker text bubble');
                                node.style.display = 'none';
                                setTimeout(() => node.remove(), 50);
                            }
                            
                            // Re-arrange messages when new ones are added
                            setTimeout(() => {
                                arrangeMessages(messagesContainer);
                            }, 50);
                        }
                    });
                }
            });
        });
        
        observer.observe(messagesContainer, { childList: true, subtree: true });
        console.log('Set up observer for duplicate message removal');
    }
}

// Setup sticker message enhancer
function setupStickerMessageEnhancer() {
    enhanceStickerMessages();
    
    // Run enhancement every 500ms
    setInterval(enhanceStickerMessages, 500);
    
    const messagesContainer = document.getElementById('chatMessages');
    if (messagesContainer) {
        const observer = new MutationObserver(() => {
            enhanceStickerMessages();
        });
        observer.observe(messagesContainer, {
            childList: true,
            subtree: true
        });
    }
}

// Enhance sticker messages
function enhanceStickerMessages() {
    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) {
        setTimeout(enhanceStickerMessages, 1000);
        return;
    }
    
    const messages = messagesContainer.querySelectorAll('.message:not(.sticker-enhanced)');
    
    messages.forEach(message => {
        const messageText = message.querySelector('p');
        if (!messageText) return;
        
        const text = messageText.textContent || '';
        
        // Check for sticker markers in the text
        if (text.includes('[STICKER]')) {
            message.style.display = 'none';
            setTimeout(() => message.remove(), 100);
            return;
        }
        
        // Check for sticker data attributes
        const stickerData = extractStickerDataFromMessage(message);
        if (stickerData) {
            createStickerDisplay(message, messageText, stickerData);
            message.classList.add('sticker-enhanced', 'sticker-message');
            
            // Add timestamp data attribute
            if (!message.dataset.timestamp) {
                message.dataset.timestamp = Date.now();
            }
        }
    });
    
    // Re-arrange messages after enhancements
    arrangeMessages(messagesContainer);
}

// Extract sticker data from message element
function extractStickerDataFromMessage(message) {
    if (message.dataset.stickerType || message.dataset.stickerId) {
        return {
            id: message.dataset.stickerId,
            name: message.dataset.stickerName || 'Sticker',
            type: message.dataset.stickerType || 'text',
            url: message.dataset.stickerUrl || '',
            emoji: message.dataset.stickerEmoji || '',
            text: message.dataset.stickerText || '',
            isCustom: message.dataset.isCustom === 'true'
        };
    }
    return null;
}

// Create sticker display
function createStickerDisplay(message, messageText, stickerData) {
    let stickerHTML = '';
    
    if (stickerData.type === 'image' && stickerData.url) {
        stickerHTML = `
            <div class="sticker-message-content">
                <div class="sticker-image-container">
                    <img src="${stickerData.url}" 
                         alt="${stickerData.name || 'Sticker'}" 
                         class="sticker-message-image"
                         onerror="this.onerror=null;this.src='https://via.placeholder.com/150/FF6B8B/FFFFFF?text=Sticker'">
                    ${stickerData.text ? `<div class="sticker-text-on-image">${stickerData.text}</div>` : ''}
                </div>
            </div>
        `;
    } else if (stickerData.type === 'text') {
        stickerHTML = `
            <div class="sticker-message-content">
                <div class="text-sticker-message">
                    <span class="sticker-emoji-large">${stickerData.emoji || '🎨'}</span>
                    ${stickerData.text ? `<span class="sticker-text-large">${stickerData.text}</span>` : ''}
                </div>
            </div>
        `;
    } else {
        return;
    }
    
    messageText.innerHTML = '';
    messageText.innerHTML = stickerHTML;
    messageText.classList.add('sticker-display');
    
    const content = messageText.querySelector('.sticker-message-content');
    if (message.classList.contains('sent')) {
        content.style.background = '#000000';
        content.style.borderColor = '#333333';
        content.style.color = 'white';
    } else {
        content.style.background = 'white';
        content.style.borderColor = '#e8e8e8';
        content.style.color = '#333';
    }
}

// Load user's custom stickers
async function loadUserStickers() {
    if (!currentUser || !db) return;
    
    try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
            userStickers = userSnap.data().stickers || [];
            updateStickerPicker();
        }
    } catch (error) {
        console.error('Error loading user stickers:', error);
    }
}

// Initialize profile picture navigation
function initProfilePictureNavigation() {
    if (window.location.pathname.includes('chat.html')) {
        const chatPartnerImage = document.getElementById('chatPartnerImage');
        if (chatPartnerImage) {
            chatPartnerImage.style.cursor = 'pointer';
            chatPartnerImage.title = 'View Profile';
            chatPartnerImage.addEventListener('click', navigateToProfile);
        } else {
            setTimeout(initProfilePictureNavigation, 1000);
        }
    }
}

// Navigate to user profile from chat
function navigateToProfile() {
    const urlParams = new URLSearchParams(window.location.search);
    const profileId = urlParams.get('id');
    if (profileId) {
        window.location.href = `profile.html?id=${profileId}`;
    }
}

// Initialize sticker system
function initStickerSystem() {
    if (window.location.pathname.includes('chat.html')) {
        addStickerButton();
        createStickerPicker();
    }
}

// Add sticker button next to input
function addStickerButton() {
    const chatInputContainer = document.querySelector('.chat-input-container');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    
    if (!chatInputContainer || !messageInput) {
        setTimeout(addStickerButton, 1000);
        return;
    }

    const existingBtn = document.getElementById('stickerPickerBtn');
    if (existingBtn) {
        existingBtn.remove();
    }

    const stickerBtn = document.createElement('button');
    stickerBtn.id = 'stickerPickerBtn';
    stickerBtn.className = 'sticker-picker-btn';
    stickerBtn.innerHTML = '<i class="fas fa-smile"></i>';
    stickerBtn.title = 'Stickers';
    stickerBtn.type = 'button';
    stickerBtn.addEventListener('click', toggleStickerPicker);

    if (sendButton) {
        chatInputContainer.insertBefore(stickerBtn, sendButton);
    } else {
        chatInputContainer.appendChild(stickerBtn);
    }

    messageInput.style.paddingRight = '50px';
}

// Create sticker picker panel
function createStickerPicker() {
    if (document.getElementById('stickerPickerPanel')) return;

    const pickerPanel = document.createElement('div');
    pickerPanel.id = 'stickerPickerPanel';
    pickerPanel.className = 'sticker-picker-panel';
    
    pickerPanel.innerHTML = `
        <div class="sticker-picker-header">
            <h4>My Stickers</h4>
            <button class="create-sticker-btn" id="createStickerBtn">
                <i class="fas fa-plus"></i> Create
            </button>
        </div>
        <div class="sticker-tabs">
            <button class="sticker-tab active" data-tab="my-stickers">My Stickers</button>
            <button class="sticker-tab" data-tab="saved-stickers">Saved</button>
        </div>
        <div class="sticker-content">
            <div class="tab-content active" id="my-stickers-tab">
                <div class="sticker-grid" id="myStickersGrid">
                    <div class="no-stickers" id="noStickersMessage">
                        <i class="fas fa-smile"></i>
                        <p>No stickers yet</p>
                        <button class="create-first-sticker">Create your first sticker</button>
                    </div>
                </div>
            </div>
            <div class="tab-content" id="saved-stickers-tab">
                <div class="sticker-grid" id="savedStickersGrid">
                    <div class="no-stickers">
                        <i class="fas fa-heart"></i>
                        <p>No saved stickers</p>
                    </div>
                </div>
            </div>
        </div>
        <div class="sticker-picker-footer">
            <button class="close-sticker-picker">
                <i class="fas fa-times"></i> Close
            </button>
        </div>
    `;

    const chatContainer = document.querySelector('.chat-container') || 
                         document.querySelector('.chat-messages-container') ||
                         document.body;
    chatContainer.appendChild(pickerPanel);

    setupStickerPickerEvents();
}

// Setup sticker picker event listeners
function setupStickerPickerEvents() {
    const pickerPanel = document.getElementById('stickerPickerPanel');
    if (!pickerPanel) return;
    
    const closeBtn = pickerPanel.querySelector('.close-sticker-picker');
    const createBtn = pickerPanel.querySelector('#createStickerBtn');
    const createFirstBtn = pickerPanel.querySelector('.create-first-sticker');
    const tabButtons = pickerPanel.querySelectorAll('.sticker-tab');
    const tabContents = pickerPanel.querySelectorAll('.tab-content');

    if (closeBtn) {
        closeBtn.addEventListener('click', closeStickerPicker);
    }

    if (createBtn) {
        createBtn.addEventListener('click', openStickerCreator);
    }
    if (createFirstBtn) {
        createFirstBtn.addEventListener('click', openStickerCreator);
    }

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.dataset.tab;
            
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === `${tabName}-tab`) {
                    content.classList.add('active');
                }
            });
            
            if (tabName === 'saved-stickers') {
                loadSavedStickers();
            }
        });
    });

    document.addEventListener('click', (e) => {
        if (stickerPickerOpen && 
            !pickerPanel.contains(e.target) && 
            !e.target.closest('#stickerPickerBtn')) {
            closeStickerPicker();
        }
    });
}

// Toggle sticker picker
function toggleStickerPicker(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    if (stickerPickerOpen) {
        closeStickerPicker();
    } else {
        openStickerPicker();
    }
}

// Open sticker picker
function openStickerPicker() {
    const pickerPanel = document.getElementById('stickerPickerPanel');
    const messageInput = document.getElementById('messageInput');
    
    if (!pickerPanel || !messageInput) return;
    
    messageInput.blur();
    pickerPanel.style.display = 'block';
    
    setTimeout(() => {
        pickerPanel.classList.add('open');
    }, 10);
    
    stickerPickerOpen = true;
    updateStickerPicker();
}

// Close sticker picker
function closeStickerPicker() {
    const pickerPanel = document.getElementById('stickerPickerPanel');
    
    if (!pickerPanel) return;
    
    pickerPanel.classList.remove('open');
    
    setTimeout(() => {
        pickerPanel.style.display = 'none';
    }, 300);
    
    stickerPickerOpen = false;
    
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        setTimeout(() => {
            messageInput.focus();
        }, 350);
    }
}

// Update sticker picker with user's stickers
function updateStickerPicker() {
    const myStickersGrid = document.getElementById('myStickersGrid');
    const noStickersMessage = document.getElementById('noStickersMessage');
    
    if (!myStickersGrid) return;
    
    const existingStickers = myStickersGrid.querySelectorAll('.sticker-item');
    existingStickers.forEach(sticker => sticker.remove());
    
    if (noStickersMessage) {
        noStickersMessage.style.display = userStickers.length > 0 ? 'none' : 'flex';
    }
    
    userStickers.forEach((sticker, index) => {
        const stickerItem = createStickerElement(sticker, index);
        stickerItem.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            window.isStickerMessage = true;
            setTimeout(() => sendSticker(sticker), 10);
        }, true);
        myStickersGrid.appendChild(stickerItem);
    });
}

// Create sticker element
function createStickerElement(sticker, index) {
    const stickerItem = document.createElement('div');
    stickerItem.className = 'sticker-item';
    stickerItem.dataset.stickerId = sticker.id;
    stickerItem.dataset.stickerIndex = index;
    
    if (sticker.type === 'image') {
        stickerItem.innerHTML = `
            <div class="sticker-item-image-container">
                <img src="${sticker.url}" alt="${sticker.name || 'Custom Sticker'}" class="sticker-image">
                ${sticker.text ? `<div class="sticker-text-on-item">${sticker.text}</div>` : ''}
            </div>
        `;
    } else {
        stickerItem.innerHTML = `
            <div class="text-sticker">
                <span class="sticker-emoji">${sticker.emoji || '🎨'}</span>
                ${sticker.text ? `<span class="sticker-text">${sticker.text}</span>` : ''}
            </div>
        `;
    }
    
    return stickerItem;
}

// Open sticker creator
function openStickerCreator() {
    closeStickerPicker();
    
    stickerCreatorVars = {
        currentStep: 1,
        stickerType: '',
        selectedImage: null,
        selectedEmoji: '😊',
        imageFile: null
    };

    const modal = document.createElement('div');
    modal.id = 'stickerCreatorModal';
    modal.className = 'sticker-creator-modal';
    modal.innerHTML = `
        <div class="sticker-creator-content">
            <div class="sticker-creator-header">
                <h3><i class="fas fa-plus-circle"></i> Create New Sticker</h3>
                <button class="close-creator">&times;</button>
            </div>
            
            <div class="sticker-creator-body">
                <div class="creator-step active" id="step1">
                    <h4>Choose Sticker Type</h4>
                    <div class="type-options">
                        <div class="type-option" data-type="image">
                            <div class="type-icon"><i class="fas fa-image"></i></div>
                            <div class="type-info">
                                <h5>Photo Sticker</h5>
                                <p>Upload a photo and add text</p>
                            </div>
                        </div>
                        <div class="type-option" data-type="text">
                            <div class="type-icon"><i class="fas fa-font"></i></div>
                            <div class="type-info">
                                <h5>Text Sticker</h5>
                                <p>Create with emoji and text</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="creator-step" id="step2">
                    <h4>Upload Photo</h4>
                    <div class="upload-area" id="uploadArea">
                        <i class="fas fa-cloud-upload-alt"></i>
                        <p>Click to upload or drag & drop</p>
                        <p class="upload-hint">Max size: 5MB • PNG, JPG, GIF</p>
                        <input type="file" id="imageUpload" accept="image/*" hidden>
                    </div>
                    <div class="image-preview" id="imagePreview" style="display: none;">
                        <img id="previewImage" src="" alt="Preview">
                        <button class="remove-image" id="removeImage"><i class="fas fa-times"></i></button>
                    </div>
                    
                    <div class="form-group">
                        <label for="stickerName">Sticker Name</label>
                        <input type="text" id="stickerName" placeholder="My Awesome Sticker" maxlength="20">
                    </div>
                    
                    <div class="form-group">
                        <label for="stickerText">Add Text (Optional)</label>
                        <input type="text" id="stickerText" placeholder="Add text to your sticker" maxlength="30">
                    </div>
                </div>
                
                <div class="creator-step" id="step3">
                    <h4>Create Text Sticker</h4>
                    
                    <div class="form-group">
                        <label for="textStickerName">Sticker Name</label>
                        <input type="text" id="textStickerName" placeholder="My Text Sticker" maxlength="20">
                    </div>
                    
                    <div class="form-group">
                        <label>Choose Emoji</label>
                        <div class="emoji-grid">
                            <span class="emoji" data-emoji="😊">😊</span>
                            <span class="emoji" data-emoji="❤️">❤️</span>
                            <span class="emoji" data-emoji="😂">😂</span>
                            <span class="emoji" data-emoji="😍">😍</span>
                            <span class="emoji" data-emoji="🥰">🥰</span>
                            <span class="emoji" data-emoji="😎">😎</span>
                            <span class="emoji" data-emoji="🤔">🤔</span>
                            <span class="emoji" data-emoji="🎉">🎉</span>
                            <span class="emoji" data-emoji="🔥">🔥</span>
                            <span class="emoji" data-emoji="💯">💯</span>
                            <span class="emoji" data-emoji="✨">✨</span>
                            <span class="emoji" data-emoji="🌟">🌟</span>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="textStickerText">Sticker Text</label>
                        <input type="text" id="textStickerText" placeholder="Enter your text" maxlength="40">
                    </div>
                    
                    <div class="preview-area">
                        <div class="text-sticker-preview" id="textStickerPreview">
                            <span class="preview-emoji">😊</span>
                            <span class="preview-text">Your Text Here</span>
                        </div>
                    </div>
                </div>
                
                <div class="creator-navigation">
                    <button class="nav-btn prev-btn" id="prevBtn" style="display: none;">
                        <i class="fas fa-arrow-left"></i> Back
                    </button>
                    <button class="nav-btn next-btn" id="nextBtn">
                        Next <i class="fas fa-arrow-right"></i>
                    </button>
                    <button class="nav-btn create-btn" id="createBtn" style="display: none;">
                        <i class="fas fa-check"></i> Create Sticker
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.style.display = 'flex';
    setupStickerCreatorEvents(modal);
}

// Setup sticker creator event listeners
function setupStickerCreatorEvents(modal) {
    const closeBtn = modal.querySelector('.close-creator');
    const typeOptions = modal.querySelectorAll('.type-option');
    const nextBtn = modal.querySelector('#nextBtn');
    const prevBtn = modal.querySelector('#prevBtn');
    const createBtn = modal.querySelector('#createBtn');
    const uploadArea = modal.querySelector('#uploadArea');
    const imageUpload = modal.querySelector('#imageUpload');
    const removeImageBtn = modal.querySelector('#removeImage');
    const emojiElements = modal.querySelectorAll('.emoji');
    const textPreview = modal.querySelector('#textStickerPreview');
    const previewEmoji = textPreview?.querySelector('.preview-emoji');
    const previewText = textPreview?.querySelector('.preview-text');
    const textStickerText = modal.querySelector('#textStickerText');
    const stickerNameInput = modal.querySelector('#stickerName');
    const textStickerNameInput = modal.querySelector('#textStickerName');

    closeBtn.addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });

    typeOptions.forEach(option => {
        option.addEventListener('click', () => {
            typeOptions.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            stickerCreatorVars.stickerType = option.dataset.type;
            nextBtn.disabled = false;
        });
    });

    nextBtn.addEventListener('click', () => {
        if (stickerCreatorVars.currentStep === 1 && stickerCreatorVars.stickerType) {
            goToStep(modal, stickerCreatorVars.stickerType === 'image' ? 2 : 3);
        } else if (stickerCreatorVars.currentStep === 2) {
            const stickerName = stickerNameInput?.value.trim();
            if (!stickerName) {
                showNotification('Please enter a sticker name', 'error');
                return;
            }
            if (!stickerCreatorVars.imageFile) {
                showNotification('Please upload an image', 'error');
                return;
            }
            showCreateButton(modal);
        } else if (stickerCreatorVars.currentStep === 3) {
            const stickerName = textStickerNameInput?.value.trim();
            const text = textStickerText?.value.trim();
            if (!stickerName) {
                showNotification('Please enter a sticker name', 'error');
                return;
            }
            if (!text) {
                showNotification('Please enter sticker text', 'error');
                return;
            }
            showCreateButton(modal);
        }
    });

    prevBtn.addEventListener('click', () => {
        if (stickerCreatorVars.currentStep === 2 || stickerCreatorVars.currentStep === 3) {
            goToStep(modal, 1);
        }
    });

    createBtn.addEventListener('click', async () => {
        createBtn.disabled = true;
        createBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
        
        try {
            let stickerData;
            
            if (stickerCreatorVars.stickerType === 'image') {
                stickerData = await createImageSticker(modal);
            } else {
                stickerData = await createTextSticker(modal);
            }
            
            await saveStickerToFirebase(stickerData);
            
            showNotification('Sticker created successfully!', 'success');
            modal.remove();
            loadUserStickers();
        } catch (error) {
            console.error('Error creating sticker:', error);
            showNotification('Error creating sticker. Please try again.', 'error');
            createBtn.disabled = false;
            createBtn.innerHTML = '<i class="fas fa-check"></i> Create Sticker';
        }
    });

    if (uploadArea && imageUpload) {
        uploadArea.addEventListener('click', () => imageUpload.click());
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) {
                handleImageUpload(e.dataTransfer.files[0], modal);
            }
        });

        imageUpload.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleImageUpload(e.target.files[0], modal);
            }
        });
    }

    if (removeImageBtn) {
        removeImageBtn.addEventListener('click', () => {
            stickerCreatorVars.imageFile = null;
            const imagePreview = modal.querySelector('#imagePreview');
            if (imagePreview) imagePreview.style.display = 'none';
            if (uploadArea) uploadArea.style.display = 'flex';
            nextBtn.disabled = true;
        });
    }

    if (emojiElements.length > 0) {
        emojiElements.forEach(emoji => {
            emoji.addEventListener('click', () => {
                emojiElements.forEach(e => e.classList.remove('selected'));
                emoji.classList.add('selected');
                stickerCreatorVars.selectedEmoji = emoji.dataset.emoji;
                if (previewEmoji) previewEmoji.textContent = stickerCreatorVars.selectedEmoji;
            });
        });
        emojiElements[0].classList.add('selected');
        stickerCreatorVars.selectedEmoji = emojiElements[0].dataset.emoji;
    }

    if (textStickerText && previewText) {
        textStickerText.addEventListener('input', () => {
            previewText.textContent = textStickerText.value || 'Your Text Here';
        });
    }
}

// Navigate between steps
function goToStep(modal, step) {
    modal.querySelectorAll('.creator-step').forEach(s => s.classList.remove('active'));
    const stepElement = modal.querySelector(`#step${step}`);
    if (stepElement) stepElement.classList.add('active');
    stickerCreatorVars.currentStep = step;
    
    const prevBtn = modal.querySelector('#prevBtn');
    const nextBtn = modal.querySelector('#nextBtn');
    const createBtn = modal.querySelector('#createBtn');
    
    if (prevBtn) prevBtn.style.display = step === 1 ? 'none' : 'inline-flex';
    if (nextBtn) nextBtn.style.display = step === 3 ? 'none' : 'inline-flex';
    if (createBtn) createBtn.style.display = step === 3 ? 'inline-flex' : 'none';
}

// Show create button
function showCreateButton(modal) {
    const prevBtn = modal.querySelector('#prevBtn');
    const nextBtn = modal.querySelector('#nextBtn');
    const createBtn = modal.querySelector('#createBtn');
    
    if (prevBtn) prevBtn.style.display = 'inline-flex';
    if (nextBtn) nextBtn.style.display = 'none';
    if (createBtn) createBtn.style.display = 'inline-flex';
}

// Handle image upload
function handleImageUpload(file, modal) {
    if (!file.type.match('image.*')) {
        showNotification('Please upload an image file (PNG, JPG, GIF)', 'error');
        return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
        showNotification('Image must be less than 5MB', 'error');
        return;
    }
    
    stickerCreatorVars.imageFile = file;
    const reader = new FileReader();
    
    reader.onload = (e) => {
        const preview = modal.querySelector('#previewImage');
        const imagePreview = modal.querySelector('#imagePreview');
        const uploadArea = modal.querySelector('#uploadArea');
        const nextBtn = modal.querySelector('#nextBtn');
        
        if (preview) preview.src = e.target.result;
        if (imagePreview) imagePreview.style.display = 'block';
        if (uploadArea) uploadArea.style.display = 'none';
        if (nextBtn) nextBtn.disabled = false;
    };
    
    reader.onerror = () => {
        showNotification('Error reading image file', 'error');
    };
    
    reader.readAsDataURL(file);
}

// Upload image to Cloudinary
async function uploadToCloudinary(imageFile) {
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
        throw new Error('Cloudinary configuration missing');
    }
    
    return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append('file', imageFile);
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
        formData.append('folder', 'dating_connect/stickers');
        
        fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Upload failed: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.secure_url) {
                resolve(data.secure_url);
            } else {
                reject(new Error('Upload failed: No URL returned'));
            }
        })
        .catch(error => {
            console.error('Cloudinary upload error:', error);
            reject(error);
        });
    });
}

// Create image sticker data
async function createImageSticker(modal) {
    const stickerNameInput = modal.querySelector('#stickerName');
    const stickerTextInput = modal.querySelector('#stickerText');
    
    const stickerName = stickerNameInput ? stickerNameInput.value.trim() : '';
    const stickerText = stickerTextInput ? stickerTextInput.value.trim() : '';
    
    if (!stickerCreatorVars.imageFile) {
        throw new Error('No image file selected');
    }
    
    const imageUrl = await uploadToCloudinary(stickerCreatorVars.imageFile);
    
    return {
        id: `sticker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: stickerName,
        type: 'image',
        text: stickerText,
        url: imageUrl,
        createdAt: Date.now(),
        createdBy: currentUser.uid
    };
}

// Create text sticker data
async function createTextSticker(modal) {
    const stickerNameInput = modal.querySelector('#textStickerName');
    const stickerTextInput = modal.querySelector('#textStickerText');
    
    const stickerName = stickerNameInput ? stickerNameInput.value.trim() : '';
    const stickerText = stickerTextInput ? stickerTextInput.value.trim() : '';
    
    return {
        id: `sticker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: stickerName,
        type: 'text',
        text: stickerText,
        emoji: stickerCreatorVars.selectedEmoji,
        createdAt: Date.now(),
        createdBy: currentUser.uid
    };
}

// Save sticker to Firebase
async function saveStickerToFirebase(stickerData) {
    if (!currentUser || !db) throw new Error('User not authenticated or Firebase not available');

    const userRef = doc(db, 'users', currentUser.uid);
    await updateDoc(userRef, {
        stickers: arrayUnion(stickerData)
    });
}

// ============================================
// ULTIMATE FIX: Send sticker - ONE MESSAGE ONLY
// ============================================
async function sendSticker(sticker) {
    if (!currentUser || !chatPartnerId || !currentThreadId || !db) {
        showNotification('Cannot send sticker', 'error');
        return;
    }

    if (isStickerSending) {
        console.log('Sticker already sending, please wait...');
        return;
    }

    isStickerSending = true;
    window.isStickerMessage = true;

    try {
        // Check chat points
        const hasPoints = await deductChatPoint();
        if (!hasPoints) {
            isStickerSending = false;
            window.isStickerMessage = false;
            return;
        }

        const tempStickerId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const messageId = generateMessageId();
        
        // Create sticker message
        const messageData = {
            senderId: currentUser.uid,
            text: '[STICKER-IGNORE]',
            stickerId: sticker.id,
            stickerName: sticker.name,
            stickerType: sticker.type,
            stickerUrl: sticker.url || '',
            stickerEmoji: sticker.emoji || '',
            stickerText: sticker.text || '',
            read: false,
            timestamp: serverTimestamp(),
            type: 'sticker',
            isCustom: true,
            messageId: messageId,
            tempId: tempStickerId,
            isSticker: true,
            createdAt: Date.now()
        };

        console.log('Sending sticker to Firebase:', messageData);

        // Send to Firebase
        const docRef = await addDoc(collection(db, 'conversations', currentThreadId, 'messages'), messageData);
        const firestoreId = docRef.id;
        
        // Update conversation
        await setDoc(doc(db, 'conversations', currentThreadId), {
            participants: [currentUser.uid, chatPartnerId],
            lastMessage: {
                text: `Sent ${sticker.name} sticker`,
                senderId: currentUser.uid,
                timestamp: serverTimestamp()
            },
            updatedAt: serverTimestamp()
        }, { merge: true });

        // Display sticker IMMEDIATELY with the REAL message ID
        displayStickerImmediately(sticker, true, firestoreId, Date.now());
        
        closeStickerPicker();
        
        showNotification('Sticker sent!', 'success');
        
    } catch (error) {
        console.error('Error sending sticker:', error);
        showNotification('Error sending sticker', 'error');
    } finally {
        setTimeout(() => {
            isStickerSending = false;
            window.isStickerMessage = false;
        }, 1000);
    }
}

// Display sticker immediately
function displayStickerImmediately(sticker, isSent = true, messageId = null, timestamp = null) {
    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) return;
    
    // Remove any duplicate text bubbles
    const existingTextBubbles = messagesContainer.querySelectorAll('.message p');
    existingTextBubbles.forEach(bubble => {
        if (bubble.textContent === '[STICKER-IGNORE]' || 
            bubble.textContent === '[STICKER]') {
            const messageDiv = bubble.closest('.message');
            if (messageDiv) {
                messageDiv.style.display = 'none';
                setTimeout(() => messageDiv.remove(), 50);
            }
        }
    });
    
    // Create pure sticker element
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isSent ? 'sent' : 'received'} sticker-message sticker-enhanced`;
    messageDiv.dataset.stickerId = sticker.id;
    messageDiv.dataset.stickerName = sticker.name;
    messageDiv.dataset.stickerType = sticker.type;
    messageDiv.dataset.stickerUrl = sticker.url || '';
    messageDiv.dataset.stickerEmoji = sticker.emoji || '';
    messageDiv.dataset.stickerText = sticker.text || '';
    messageDiv.dataset.isCustom = 'true';
    messageDiv.dataset.type = 'sticker';
    messageDiv.dataset.timestamp = timestamp || Date.now();
    
    if (messageId) {
        messageDiv.dataset.messageId = messageId;
        displayedMessageIds.add(messageId);
    }
    
    messageDiv.style.cssText = `
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
        padding: 5px !important;
        margin: 5px 0 !important;
        max-width: 200px !important;
        display: block !important;
        clear: both !important;
        float: ${isSent ? 'right' : 'left'} !important;
        margin-${isSent ? 'right' : 'left'}: 10px !important;
        animation: fadeIn 0.3s ease !important;
    `;
    
    let stickerHTML = '';
    
    if (sticker.type === 'image' && sticker.url) {
        stickerHTML = `
            <div class="sticker-message-content">
                <div class="sticker-image-container">
                    <img src="${sticker.url}" 
                         alt="${sticker.name || 'Sticker'}" 
                         class="sticker-message-image"
                         onerror="this.onerror=null;this.src='https://via.placeholder.com/150/FF6B8B/FFFFFF?text=Sticker'">
                    ${sticker.text ? `<div class="sticker-text-on-image">${sticker.text}</div>` : ''}
                </div>
            </div>
        `;
    } else if (sticker.type === 'text') {
        stickerHTML = `
            <div class="sticker-message-content">
                <div class="text-sticker-message">
                    <span class="sticker-emoji-large">${sticker.emoji || '🎨'}</span>
                    ${sticker.text ? `<span class="sticker-text-large">${sticker.text}</span>` : ''}
                </div>
            </div>
        `;
    }
    
    const stickerContainer = document.createElement('div');
    stickerContainer.className = 'sticker-display-container';
    stickerContainer.innerHTML = stickerHTML;
    
    const content = stickerContainer.querySelector('.sticker-message-content');
    if (content) {
        if (isSent) {
            content.style.background = '#000000';
            content.style.borderColor = '#333333';
            content.style.color = 'white';
        } else {
            content.style.background = 'white';
            content.style.borderColor = '#e8e8e8';
            content.style.color = '#333';
        }
    }
    
    messageDiv.appendChild(stickerContainer);
    
    const timeSpan = document.createElement('span');
    timeSpan.className = 'message-time';
    timeSpan.textContent = 'Just now';
    messageDiv.appendChild(timeSpan);
    
    // Insert in correct position
    insertMessageInOrder(messagesContainer, messageDiv, timestamp || Date.now());
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // Remove any duplicate text bubbles
    setTimeout(() => {
        const allMessages = messagesContainer.querySelectorAll('.message');
        allMessages.forEach(msg => {
            const textElement = msg.querySelector('p');
            if (textElement && (textElement.textContent === '[STICKER-IGNORE]' || 
                               textElement.textContent === '[STICKER]')) {
                msg.style.display = 'none';
                setTimeout(() => msg.remove(), 50);
            }
        });
        
        // Re-arrange messages
        arrangeMessages(messagesContainer);
    }, 100);
}

// Generate unique message ID
function generateMessageId() {
    return 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Deduct chat points
async function deductChatPoint() {
    if (!currentUser || !db) return false;
    
    try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
            const userData = userSnap.data();
            const currentPoints = userData.chatPoints || 0;
            
            if (currentPoints <= 0) {
                showNotification('You have no chat points left. Please purchase more.', 'warning');
                return false;
            }
            
            await updateDoc(userRef, {
                chatPoints: currentPoints - 1
            });
            
            if (window.updateChatPointsDisplay) {
                window.updateChatPointsDisplay();
            }
            
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error deducting chat points:', error);
        showNotification('Error processing payment', 'error');
        return false;
    }
}

// Setup sticker listener for received stickers
function setupStickerListener() {
    if (!currentUser || !chatPartnerId || !currentThreadId || !db) {
        return;
    }

    const messagesQuery = query(
        collection(db, 'conversations', currentThreadId, 'messages'),
        orderBy('timestamp', 'desc'),
        limit(50)
    );

    if (stickerListenerUnsubscribe) {
        stickerListenerUnsubscribe();
    }

    stickerListenerUnsubscribe = onSnapshot(messagesQuery, (snapshot) => {
        snapshot.docChanges().forEach(change => {
            if (change.type === 'added') {
                const message = change.doc.data();
                const messageId = change.doc.id;
                
                if (displayedMessageIds.has(messageId)) {
                    return; // Already displayed
                }
                
                if (message.type === 'sticker' || message.text === '[STICKER-IGNORE]' || message.isSticker) {
                    const isOwnMessage = message.senderId === currentUser.uid;
                    
                    if (isOwnMessage && message.tempId) {
                        if (sentStickerIds.has(message.tempId)) {
                            sentStickerIds.delete(message.tempId);
                            updateExistingStickerWithMessageId(message.tempId, messageId, message);
                            return;
                        }
                    }
                    
                    if (!isOwnMessage) {
                        const stickerData = {
                            id: message.stickerId,
                            name: message.stickerName,
                            type: message.stickerType,
                            url: message.stickerUrl,
                            emoji: message.stickerEmoji,
                            text: message.stickerText
                        };
                        
                        const fullMessage = {
                            ...message,
                            id: messageId,
                            timestampValue: message.createdAt || Date.now()
                        };
                        
                        displayStickerFromDatabase(fullMessage);
                        saveReceivedSticker(message);
                    }
                }
            }
        });
    });
}

// Update existing sticker with the real message ID
function updateExistingStickerWithMessageId(tempId, messageId, message) {
    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) return;
    
    const existingSticker = messagesContainer.querySelector(`[data-temp-id="${tempId}"]`);
    if (existingSticker) {
        existingSticker.dataset.messageId = messageId;
        delete existingSticker.dataset.tempId;
        
        if (message.createdAt) {
            existingSticker.dataset.timestamp = message.createdAt;
        }
        
        displayedMessageIds.add(messageId);
    }
}

// Save received sticker automatically
async function saveReceivedSticker(message) {
    if (!currentUser || message.isCustom !== true || !db) return;
    
    try {
        const stickerData = {
            id: message.stickerId,
            name: message.stickerName,
            type: message.stickerType,
            text: message.stickerText || '',
            emoji: message.stickerEmoji || '',
            url: message.stickerUrl || '',
            createdAt: Date.now(),
            createdBy: message.senderId,
            savedFrom: message.senderId
        };

        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
            savedStickers: arrayUnion(stickerData)
        });

        showNotification(`Saved "${message.stickerName}" sticker`, 'info');
    } catch (error) {
        console.error('Error saving received sticker:', error);
    }
}

// Load saved stickers
async function loadSavedStickers() {
    if (!currentUser || !db) return;
    
    try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
            const savedStickers = userSnap.data().savedStickers || [];
            updateSavedStickersDisplay(savedStickers);
        }
    } catch (error) {
        console.error('Error loading saved stickers:', error);
    }
}

// Update saved stickers display
function updateSavedStickersDisplay(savedStickers) {
    const savedStickersGrid = document.getElementById('savedStickersGrid');
    if (!savedStickersGrid) return;
    
    savedStickersGrid.innerHTML = '';
    
    if (savedStickers.length === 0) {
        savedStickersGrid.innerHTML = `
            <div class="no-stickers">
                <i class="fas fa-heart"></i>
                <p>No saved stickers</p>
            </div>
        `;
        return;
    }
    
    savedStickers.forEach(sticker => {
        const stickerItem = createStickerElement(sticker);
        stickerItem.classList.add('saved');
        stickerItem.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            window.isStickerMessage = true;
            setTimeout(() => sendSticker(sticker), 10);
        }, true);
        savedStickersGrid.appendChild(stickerItem);
    });
}

// Simple notification function
if (typeof showNotification === 'undefined') {
    window.showNotification = function(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'error' ? '#f44336' : type === 'success' ? '#4CAF50' : type === 'warning' ? '#ff9800' : '#2196F3'};
            color: white;
            padding: 15px 20px;
            border-radius: 10px;
            z-index: 10000;
            max-width: 300px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
            font-weight: 500;
            animation: slideIn 0.3s ease;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
        
        if (!document.getElementById('notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOut {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
    };
}

// Load COMPLETE sticker styles
function loadStickerStyles() {
    if (document.getElementById('sticker-styles')) return;

    const styles = `
        /* Sticker Picker Styles */
        .sticker-picker-btn {
            background: linear-gradient(135deg, #FF6B8B 0%, #FF8E53 100%);
            border: none;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            color: white;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            transition: all 0.3s ease;
            margin-left: 10px;
            position: absolute;
            right: 60px;
            top: 50%;
            transform: translateY(-50%);
            z-index: 100;
        }
        
        .sticker-picker-btn:hover {
            background: linear-gradient(135deg, #FF8E53 0%, #FF6B8B 100%);
            transform: translateY(-50%) scale(1.1);
            box-shadow: 0 5px 15px rgba(255, 107, 139, 0.4);
        }
        
        .sticker-picker-panel {
            display: none;
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: 70vh;
            background: white;
            border-radius: 20px 20px 0 0;
            box-shadow: 0 -10px 30px rgba(0,0,0,0.2);
            z-index: 1000;
            transform: translateY(100%);
            transition: transform 0.3s ease;
        }
        
        .sticker-picker-panel.open {
            transform: translateY(0);
        }
        
        .sticker-picker-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px 20px;
            border-bottom: 1px solid #e8e8e8;
            background: white;
            border-radius: 20px 20px 0 0;
        }
        
        .sticker-picker-header h4 {
            margin: 0;
            color: #333;
            font-size: 18px;
        }
        
        .create-sticker-btn {
            background: linear-gradient(135deg, #4CAF50, #45a049);
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: all 0.3s ease;
        }
        
        .create-sticker-btn:hover {
            background: linear-gradient(135deg, #45a049, #4CAF50);
            transform: scale(1.05);
        }
        
        .sticker-tabs {
            display: flex;
            border-bottom: 1px solid #e8e8e8;
            background: #f8f9fa;
        }
        
        .sticker-tab {
            flex: 1;
            padding: 15px;
            border: none;
            background: none;
            font-size: 14px;
            font-weight: 600;
            color: #666;
            cursor: pointer;
            position: relative;
            transition: all 0.3s ease;
        }
        
        .sticker-tab.active {
            color: #FF6B8B;
        }
        
        .sticker-tab.active::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: linear-gradient(135deg, #FF6B8B, #FF8E53);
            border-radius: 3px 3px 0 0;
        }
        
        .sticker-content {
            height: calc(100% - 120px);
            overflow-y: auto;
            padding: 20px;
        }
        
        .tab-content {
            display: none;
        }
        
        .tab-content.active {
            display: block;
        }
        
        .sticker-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 15px;
            padding: 10px 0;
        }
        
        @media (max-width: 768px) {
            .sticker-grid {
                grid-template-columns: repeat(3, 1fr);
                gap: 12px;
            }
        }
        
        @media (max-width: 480px) {
            .sticker-grid {
                grid-template-columns: repeat(2, 1fr);
                gap: 10px;
            }
        }
        
        .sticker-item {
            aspect-ratio: 1;
            border-radius: 12px;
            background: white;
            border: 2px solid #e8e8e8;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            transition: all 0.3s ease;
            position: relative;
        }
        
        .sticker-item:hover {
            transform: scale(1.05);
            border-color: #FF6B8B;
            box-shadow: 0 5px 15px rgba(255, 107, 139, 0.2);
        }
        
        .sticker-item-image-container {
            width: 100%;
            height: 100%;
            position: relative;
        }
        
        .sticker-image {
            width: 100%;
            height: 100%;
            object-fit: contain;
            padding: 5px;
        }
        
        .sticker-text-on-item {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            background: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 4px 8px;
            font-size: 11px;
            text-align: center;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        .text-sticker {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 10px;
            width: 100%;
            height: 100%;
        }
        
        .sticker-emoji {
            font-size: 2.5rem;
            margin-bottom: 8px;
        }
        
        .sticker-text {
            font-size: 12px;
            text-align: center;
            color: #333;
            font-weight: 500;
            word-break: break-word;
            max-width: 100%;
        }
        
        .no-stickers {
            grid-column: 1 / -1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 40px 20px;
            text-align: center;
            color: #666;
        }
        
        .no-stickers i {
            font-size: 48px;
            color: #FF6B8B;
            margin-bottom: 15px;
            opacity: 0.7;
        }
        
        .no-stickers p {
            margin: 0 0 15px 0;
            font-size: 16px;
        }
        
        .create-first-sticker {
            background: linear-gradient(135deg, #FF6B8B, #FF8E53);
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 25px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        
        .create-first-sticker:hover {
            transform: scale(1.05);
            box-shadow: 0 5px 15px rgba(255, 107, 139, 0.3);
        }
        
        .sticker-picker-footer {
            padding: 15px 20px;
            border-top: 1px solid #e8e8e8;
            text-align: center;
        }
        
        .close-sticker-picker {
            background: #f0f0f0;
            color: #333;
            border: none;
            padding: 12px 30px;
            border-radius: 25px;
            font-weight: 600;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            transition: all 0.3s ease;
        }
        
        .close-sticker-picker:hover {
            background: #e0e0e0;
            transform: scale(1.05);
        }

        /* STICKER MESSAGE STYLES - NO TEXT BUBBLES */
        .sticker-display-container {
            display: block !important;
            margin: 0 !important;
            padding: 0 !important;
        }
        
        .message.sticker-message {
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
            padding: 5px !important;
            margin: 5px 0 !important;
            max-width: 200px !important;
            display: block !important;
            clear: both !important;
            float: none !important;
            animation: fadeIn 0.3s ease !important;
            transition: all 0.3s ease !important;
        }
        
        .message.sticker-message.sent {
            float: right !important;
            margin-right: 10px !important;
        }
        
        .message.sticker-message.received {
            float: left !important;
            margin-left: 10px !important;
        }
        
        .sticker-message-content {
            display: inline-block;
            border-radius: 18px;
            padding: 12px;
            border: 2px solid #e8e8e8;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 200px;
            background: white;
        }
        
        .message.sent .sticker-message-content {
            background: #000000 !important;
            border-color: #333333;
            color: white;
        }
        
        .message.received .sticker-message-content {
            background: white !important;
            border-color: #e8e8e8;
            color: #333;
        }
        
        .sticker-image-container {
            position: relative;
            width: 150px;
            height: 150px;
            margin: 0 auto;
        }
        
        .sticker-message-image {
            width: 100%;
            height: 100%;
            border-radius: 10px;
            object-fit: cover;
            display: block;
            background: #f5f5f5;
        }
        
        .sticker-text-on-image {
            position: absolute;
            top: 10px;
            left: 0;
            right: 0;
            color: white;
            padding: 6px 10px;
            font-size: 14px;
            text-align: center;
            font-weight: 600;
            margin: 0 10px;
            word-break: break-word;
            z-index: 2;
            text-shadow: 
                1px 1px 3px rgba(0, 0, 0, 0.8),
                0 0 8px rgba(0, 0, 0, 0.6),
                0 0 15px rgba(0, 0, 0, 0.4);
            background: transparent !important;
            -webkit-text-stroke: 0.5px rgba(0, 0, 0, 0.7);
        }
        
        .text-sticker-message {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 15px;
            min-height: 120px;
        }
        
        .sticker-emoji-large {
            font-size: 3rem;
            margin-bottom: 10px;
        }
        
        .sticker-text-large {
            font-size: 16px;
            font-weight: 600;
            text-align: center;
            word-break: break-word;
            max-width: 180px;
            line-height: 1.4;
            background: transparent !important;
        }
        
        .message.sent .sticker-text-large {
            color: white;
        }
        
        .message.received .sticker-text-large {
            color: #333;
        }
        
        .message-time {
            font-size: 11px;
            color: rgba(255, 255, 255, 0.7);
            text-align: center;
            margin-top: 8px;
            opacity: 0.8;
            display: block !important;
        }
        
        .message.received .message-time {
            color: rgba(0, 0, 0, 0.5);
        }
        
        /* Animation for fade in */
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        /* Sticker Creator Modal Styles */
        .sticker-creator-modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            z-index: 1001;
            align-items: center;
            justify-content: center;
        }
        
        .sticker-creator-content {
            background: white;
            border-radius: 20px;
            width: 90%;
            max-width: 500px;
            max-height: 80vh;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        
        .sticker-creator-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px;
            background: linear-gradient(135deg, #FF6B8B, #FF8E53);
            color: white;
        }
        
        .sticker-creator-header h3 {
            margin: 0;
            font-size: 18px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .close-creator {
            background: none;
            border: none;
            color: white;
            font-size: 28px;
            cursor: pointer;
            padding: 0;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .sticker-creator-body {
            padding: 20px;
            max-height: 60vh;
            overflow-y: auto;
        }
        
        .creator-step {
            display: none;
        }
        
        .creator-step.active {
            display: block;
        }
        
        .creator-step h4 {
            margin: 0 0 20px 0;
            color: #333;
            text-align: center;
            font-size: 18px;
        }
        
        .type-options {
            display: flex;
            flex-direction: column;
            gap: 15px;
        }
        
        .type-option {
            display: flex;
            align-items: center;
            padding: 20px;
            border: 2px solid #e8e8e8;
            border-radius: 15px;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        
        .type-option:hover {
            border-color: #FF6B8B;
            background: #fff5f7;
        }
        
        .type-option.selected {
            border-color: #FF6B8B;
            background: linear-gradient(135deg, #fff5f7, #fffaf5);
            box-shadow: 0 5px 15px rgba(255, 107, 139, 0.1);
        }
        
        .type-icon {
            width: 50px;
            height: 50px;
            background: linear-gradient(135deg, #FF6B8B, #FF8E53);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 15px;
            color: white;
            font-size: 24px;
        }
        
        .type-info h5 {
            margin: 0 0 5px 0;
            color: #333;
        }
        
        .type-info p {
            margin: 0;
            color: #666;
            font-size: 14px;
        }
        
        .upload-area {
            border: 2px dashed #FF6B8B;
            border-radius: 15px;
            padding: 40px 20px;
            text-align: center;
            cursor: pointer;
            margin-bottom: 20px;
            background: #fff5f7;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            transition: all 0.3s ease;
        }
        
        .upload-area.dragover {
            background: #ffeef2;
            border-color: #FF8E53;
        }
        
        .upload-area i {
            font-size: 48px;
            color: #FF6B8B;
            margin-bottom: 15px;
        }
        
        .upload-area p {
            margin: 0 0 5px 0;
            color: #333;
        }
        
        .upload-hint {
            color: #666 !important;
            font-size: 12px !important;
        }
        
        .image-preview {
            position: relative;
            margin-bottom: 20px;
            border-radius: 15px;
            overflow: hidden;
        }
        
        .image-preview img {
            width: 100%;
            height: 200px;
            object-fit: contain;
            background: #f8f9fa;
        }
        
        .remove-image {
            position: absolute;
            top: 10px;
            right: 10px;
            width: 30px;
            height: 30px;
            background: rgba(0,0,0,0.7);
            border: none;
            border-radius: 50%;
            color: white;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .form-group {
            margin-bottom: 20px;
        }
        
        .form-group label {
            display: block;
            margin-bottom: 8px;
            font-weight: 600;
            color: #333;
        }
        
        .form-group input {
            width: 100%;
            padding: 12px 15px;
            border: 2px solid #e8e8e8;
            border-radius: 10px;
            font-size: 16px;
            transition: all 0.3s ease;
        }
        
        .form-group input:focus {
            outline: none;
            border-color: #FF6B8B;
            box-shadow: 0 0 0 3px rgba(255, 107, 139, 0.1);
        }
        
        .emoji-grid {
            display: grid;
            grid-template-columns: repeat(6, 1fr);
            gap: 10px;
            margin-bottom: 20px;
        }
        
        .emoji {
            font-size: 24px;
            text-align: center;
            padding: 10px;
            border: 2px solid #e8e8e8;
            border-radius: 10px;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        
        .emoji:hover {
            border-color: #FF6B8B;
            background: #fff5f7;
        }
        
        .emoji.selected {
            border-color: #FF6B8B;
            background: linear-gradient(135deg, #FF6B8B, #FF8E53);
            color: white;
            transform: scale(1.1);
        }
        
        .preview-area {
            text-align: center;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 15px;
            margin-top: 20px;
        }
        
        .text-sticker-preview {
            display: inline-flex;
            align-items: center;
            gap: 15px;
            padding: 20px 30px;
            background: white;
            border: 2px solid #FF6B8B;
            border-radius: 15px;
            box-shadow: 0 5px 15px rgba(255, 107, 139, 0.1);
        }
        
        .preview-emoji {
            font-size: 3rem;
        }
        
        .preview-text {
            font-size: 1.2rem;
            color: #333;
            font-weight: 600;
        }
        
        .creator-navigation {
            display: flex;
            justify-content: space-between;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e8e8e8;
        }
        
        .nav-btn {
            padding: 12px 24px;
            border: none;
            border-radius: 25px;
            font-weight: 600;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 10px;
            transition: all 0.3s ease;
        }
        
        .prev-btn {
            background: #f0f0f0;
            color: #333;
        }
        
        .prev-btn:hover {
            background: #e0e0e0;
        }
        
        .next-btn {
            background: linear-gradient(135deg, #FF6B8B, #FF8E53);
            color: white;
        }
        
        .next-btn:hover:not(:disabled) {
            background: linear-gradient(135deg, #FF8E53, #FF6B8B);
            transform: scale(1.05);
        }
        
        .next-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        .create-btn {
            background: linear-gradient(135deg, #4CAF50, #45a049);
            color: white;
        }
        
        .create-btn:hover:not(:disabled) {
            background: linear-gradient(135deg, #45a049, #4CAF50);
            transform: scale(1.05);
        }
        
        .create-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        /* Animation for notifications */
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;

    const styleSheet = document.createElement('style');
    styleSheet.id = 'sticker-styles';
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
}

// Clean up when page unloads
window.addEventListener('beforeunload', () => {
    closeStickerPicker();
    if (stickerListenerUnsubscribe) {
        stickerListenerUnsubscribe();
    }
});

// Make functions available globally
window.stickerFunctions = {
    openStickerPicker,
    closeStickerPicker,
    loadUserStickers,
    loadSavedStickers
};