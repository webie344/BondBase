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
    arrayUnion
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyC8_PEsfTOr-gJ8P1MoXobOAfqwTVqEZWo",
    authDomain: "usa-dating-23bc3.firebaseapp.com",
    projectId: "usa-dating-23bc3",
    storageBucket: "usa-dating-23bc3.firebasestorage.app",
    messagingSenderId: "423286263327",
    appId: "1:423286263327:web:17f0caf843dc349c144f2a"
};

// Cloudinary configuration - REPLACE WITH YOUR CREDENTIALS
const CLOUDINARY_CLOUD_NAME = "ddtdqrh1b";
const CLOUDINARY_UPLOAD_PRESET = "profile-pictures";

// Initialize Firebase - FIXED
let app;
let auth;
let db;

try {
    // Check if Firebase app is already initialized
    if (!window.firebaseApps) {
        window.firebaseApps = {};
    }
    
    const appName = '[DEFAULT]';
    
    if (!window.firebaseApps[appName]) {
        app = initializeApp(firebaseConfig, appName);
        window.firebaseApps[appName] = app;
        console.log('Firebase app initialized successfully');
    } else {
        app = window.firebaseApps[appName];
        console.log('Using existing Firebase app');
    }
    
    // Initialize auth and firestore
    auth = getAuth(app);
    db = getFirestore(app);
    
} catch (error) {
    console.error('Error initializing Firebase:', error);
    // Create fallback dummy objects to prevent crashes
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

// Track sent sticker IDs to prevent duplicates
const sentStickerIds = new Set();
let isStickerSending = false; // Flag to prevent multiple sticker sends

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    loadStickerStyles();
    
    // Set up auth state listener - with error handling
    if (auth && typeof onAuthStateChanged === 'function') {
        onAuthStateChanged(auth, (user) => {
            if (user) {
                currentUser = user;
                initializeFeatures();
            } else {
                currentUser = null;
                // If not authenticated, still try to initialize basic features
                try {
                    initializeBasicFeatures();
                } catch (e) {
                    console.log('User not authenticated, skipping Firebase features');
                }
            }
        }, (error) => {
            console.error('Auth state error:', error);
            // Still try to initialize basic UI features
            initializeBasicFeatures();
        });
    } else {
        console.log('Auth not available, initializing basic features');
        initializeBasicFeatures();
    }
});

// Initialize basic UI features without Firebase
function initializeBasicFeatures() {
    if (window.location.pathname.includes('chat.html')) {
        // Still try to setup UI elements
        setTimeout(() => {
            try {
                initProfilePictureNavigation();
                loadStickerStyles();
                addStickerButton(); // Add button but with limited functionality
                setupStickerPickerEvents();
                setupMessagePrevention(); // Setup prevention for sticker messages
            } catch (e) {
                console.log('Could not initialize all features:', e);
            }
        }, 1000);
    }
}

// Initialize features after auth
function initializeFeatures() {
    // Get chat partner ID from URL if on chat page
    if (window.location.pathname.includes('chat.html')) {
        const urlParams = new URLSearchParams(window.location.search);
        chatPartnerId = urlParams.get('id');
        currentThreadId = [currentUser.uid, chatPartnerId].sort().join('_');
    }
    
    initProfilePictureNavigation();
    initStickerSystem();
    loadUserStickers();
    
    // Set up sticker listener for chat page
    if (window.location.pathname.includes('chat.html') && chatPartnerId) {
        setTimeout(() => {
            setupStickerListener();
            setupStickerMessageEnhancer();
            setupMessagePrevention(); // CRITICAL: Setup message prevention
            interceptSendButton(); // Intercept send button to handle stickers
        }, 2000);
    }
}

// Setup message prevention to stop stickers from being sent as text
function setupMessagePrevention() {
    console.log('Setting up message prevention...');
    
    // Method 1: Override the global sendMessage function if it exists
    if (typeof window.sendMessage === 'function') {
        console.log('Found sendMessage function, overriding...');
        const originalSendMessage = window.sendMessage;
        window.sendMessage = function(text, type = 'text') {
            // Check if this is a sticker message that should be prevented
            if (text && (text.includes('[STICKER]') || text.includes('sticker:'))) {
                console.log('Preventing sticker text from being sent as regular message:', text);
                return false; // Don't send
            }
            return originalSendMessage.call(this, text, type);
        };
        console.log('sendMessage function overridden successfully');
    }
    
    // Method 2: Intercept the send button directly
    function setupSendButtonInterception() {
        const sendButton = document.getElementById('sendButton');
        if (!sendButton) {
            setTimeout(setupSendButtonInterception, 500);
            return;
        }
        
        console.log('Found send button, setting up interception...');
        
        // Remove any existing event listeners first
        const newSendButton = sendButton.cloneNode(true);
        sendButton.parentNode.replaceChild(newSendButton, sendButton);
        
        // Add new click handler
        newSendButton.addEventListener('click', function(e) {
            const messageInput = document.getElementById('messageInput');
            if (messageInput) {
                const text = messageInput.value;
                // Check if this is a sticker message
                if (text && (text.includes('[STICKER]') || text.includes('sticker:'))) {
                    console.log('Preventing sticker from send button:', text);
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    e.stopPropagation();
                    messageInput.value = ''; // Clear the input
                    return false;
                }
            }
            
            // Let the original handler run for normal messages
            return true;
        }, true); // Use capture phase to intercept early
        
        console.log('Send button interception set up');
    }
    
    setupSendButtonInterception();
    
    // Method 3: Also intercept form submission if there's a form
    const chatForm = document.querySelector('.chat-input-container form') || 
                     document.querySelector('form[action*="send"]') ||
                     document.querySelector('form');
    if (chatForm) {
        chatForm.addEventListener('submit', function(e) {
            const messageInput = document.getElementById('messageInput');
            if (messageInput) {
                const text = messageInput.value;
                if (text && (text.includes('[STICKER]') || text.includes('sticker:'))) {
                    console.log('Preventing sticker from form submission');
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    messageInput.value = '';
                    return false;
                }
            }
        }, true);
    }
    
    console.log('Message prevention setup complete');
}

// Intercept the send button to handle stickers properly
function interceptSendButton() {
    const sendButton = document.getElementById('sendButton');
    if (!sendButton) {
        setTimeout(interceptSendButton, 1000);
        return;
    }
    
    // Store original onclick
    const originalOnClick = sendButton.onclick;
    
    // Replace with our own handler
    sendButton.onclick = function(e) {
        // Check if we're in sticker mode
        const messageInput = document.getElementById('messageInput');
        if (messageInput && (messageInput.value.includes('[STICKER]') || messageInput.value.includes('sticker:'))) {
            e.preventDefault();
            e.stopPropagation();
            messageInput.value = ''; // Clear sticker text
            return false;
        }
        
        // Otherwise, call original handler
        if (originalOnClick) {
            return originalOnClick.call(this, e);
        }
    };
}

// Setup sticker message enhancer
function setupStickerMessageEnhancer() {
    // Run immediately
    enhanceStickerMessages();
    
    // Run periodically to catch new messages
    setInterval(enhanceStickerMessages, 500);
    
    // Also listen for DOM changes
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

// Enhance sticker messages in chat
function enhanceStickerMessages() {
    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) {
        setTimeout(enhanceStickerMessages, 1000);
        return;
    }
    
    // Find all messages
    const messages = messagesContainer.querySelectorAll('.message');
    
    messages.forEach(message => {
        // Skip if already enhanced
        if (message.classList.contains('sticker-enhanced')) {
            return;
        }
        
        // Check if this is a sticker message by looking at the content
        const messageText = message.querySelector('p');
        if (!messageText) return;
        
        // Check if message has sticker data attributes
        const stickerData = extractStickerDataFromMessage(message);
        
        if (stickerData) {
            createStickerDisplay(message, messageText, stickerData);
            message.classList.add('sticker-enhanced', 'sticker-message');
            
            // Hide the text content if it's a sticker
            const textContent = messageText.textContent || '';
            if (textContent.includes('[STICKER]') || 
                textContent.includes('sticker:')) {
                messageText.style.display = 'none';
            }
        } else {
            // Check if it's a sticker by text content and hide it
            const textContent = messageText.textContent || '';
            if (textContent.includes('[STICKER]') || textContent.includes('sticker:')) {
                // This is likely a sticker that hasn't been enhanced yet
                // Hide it temporarily until the real sticker loads
                messageText.style.opacity = '0';
                messageText.style.height = '0';
                messageText.style.padding = '0';
                messageText.style.margin = '0';
                messageText.style.overflow = 'hidden';
            }
        }
    });
}

// Extract sticker data from message element
function extractStickerDataFromMessage(message) {
    // Check for explicit sticker data attributes
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
    
    // Check for message text that indicates it's a sticker
    const messageText = message.querySelector('p');
    if (!messageText) return null;
    
    const text = messageText.textContent || '';
    
    // Check if this message contains sticker indicator
    if (text.includes('[STICKER]') && message.dataset.messageId) {
        // This might be a sticker that hasn't been enhanced yet
        // We'll need to check Firebase for the actual sticker data
        return null;
    }
    
    // If message has image URL in data attributes
    if (message.dataset.imageUrl) {
        return {
            id: message.id || `sticker_${Date.now()}`,
            name: 'Image Sticker',
            type: 'image',
            url: message.dataset.imageUrl,
            text: text
        };
    }
    
    return null;
}

// Create sticker display in chat
function createStickerDisplay(message, messageText, stickerData) {
    // Create sticker display
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
        // Fallback to original text if no valid sticker data
        return;
    }
    
    // Replace message content with sticker
    messageText.innerHTML = stickerHTML;
    messageText.classList.add('sticker-display');
    
    // Style for sent vs received
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

// Initialize sticker system (WhatsApp/Telegram style)
function initStickerSystem() {
    if (window.location.pathname.includes('chat.html')) {
        addStickerButton();
        createStickerPicker();
    }
}

// Add sticker button next to input (like WhatsApp/Telegram)
function addStickerButton() {
    const chatInputContainer = document.querySelector('.chat-input-container');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    
    if (!chatInputContainer || !messageInput) {
        setTimeout(addStickerButton, 1000);
        return;
    }

    // Remove existing button if any
    const existingBtn = document.getElementById('stickerPickerBtn');
    if (existingBtn) {
        existingBtn.remove();
    }

    // Create sticker button
    const stickerBtn = document.createElement('button');
    stickerBtn.id = 'stickerPickerBtn';
    stickerBtn.className = 'sticker-picker-btn';
    stickerBtn.innerHTML = '<i class="fas fa-smile"></i>';
    stickerBtn.title = 'Stickers';
    stickerBtn.type = 'button';
    stickerBtn.addEventListener('click', toggleStickerPicker);

    // Insert button before send button
    if (sendButton) {
        chatInputContainer.insertBefore(stickerBtn, sendButton);
    } else {
        chatInputContainer.appendChild(stickerBtn);
    }

    // Adjust input width
    messageInput.style.paddingRight = '50px';
}

// Create sticker picker panel (like WhatsApp/Telegram keyboard replacement)
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
                    <!-- User's stickers will be loaded here -->
                    <div class="no-stickers" id="noStickersMessage">
                        <i class="fas fa-smile"></i>
                        <p>No stickers yet</p>
                        <button class="create-first-sticker">Create your first sticker</button>
                    </div>
                </div>
            </div>
            <div class="tab-content" id="saved-stickers-tab">
                <div class="sticker-grid" id="savedStickersGrid">
                    <!-- Saved stickers will be loaded here -->
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

    // Insert picker panel after chat container
    const chatContainer = document.querySelector('.chat-container') || 
                         document.querySelector('.chat-messages-container') ||
                         document.body;
    chatContainer.appendChild(pickerPanel);

    // Setup event listeners
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

    // Close button
    if (closeBtn) {
        closeBtn.addEventListener('click', closeStickerPicker);
    }

    // Create sticker buttons
    if (createBtn) {
        createBtn.addEventListener('click', openStickerCreator);
    }
    if (createFirstBtn) {
        createFirstBtn.addEventListener('click', openStickerCreator);
    }

    // Tab switching
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.dataset.tab;
            
            // Update active tab button
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Show active tab content
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === `${tabName}-tab`) {
                    content.classList.add('active');
                }
            });
            
            // Load saved stickers if switching to that tab
            if (tabName === 'saved-stickers') {
                loadSavedStickers();
            }
        });
    });

    // Click outside to close
    document.addEventListener('click', (e) => {
        if (stickerPickerOpen && 
            !pickerPanel.contains(e.target) && 
            !e.target.closest('#stickerPickerBtn')) {
            closeStickerPicker();
        }
    });
}

// Toggle sticker picker (show/hide like WhatsApp keyboard)
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

// Open sticker picker (replaces keyboard)
function openStickerPicker() {
    const pickerPanel = document.getElementById('stickerPickerPanel');
    const messageInput = document.getElementById('messageInput');
    
    if (!pickerPanel || !messageInput) return;
    
    // Hide keyboard on mobile by blurring input
    messageInput.blur();
    
    // Show picker panel
    pickerPanel.style.display = 'block';
    
    // Slide up animation
    setTimeout(() => {
        pickerPanel.classList.add('open');
    }, 10);
    
    stickerPickerOpen = true;
    
    // Update sticker display
    updateStickerPicker();
}

// Close sticker picker
function closeStickerPicker() {
    const pickerPanel = document.getElementById('stickerPickerPanel');
    
    if (!pickerPanel) return;
    
    // Slide down animation
    pickerPanel.classList.remove('open');
    
    setTimeout(() => {
        pickerPanel.style.display = 'none';
    }, 300);
    
    stickerPickerOpen = false;
    
    // Focus back on input
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
    
    // Clear existing stickers except the no stickers message
    const existingStickers = myStickersGrid.querySelectorAll('.sticker-item');
    existingStickers.forEach(sticker => sticker.remove());
    
    // Show/hide no stickers message
    if (noStickersMessage) {
        noStickersMessage.style.display = userStickers.length > 0 ? 'none' : 'flex';
    }
    
    // Add user's stickers
    userStickers.forEach((sticker, index) => {
        const stickerItem = createStickerElement(sticker, index);
        stickerItem.addEventListener('click', () => sendSticker(sticker));
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

// Open sticker creator modal
function openStickerCreator() {
    closeStickerPicker();
    
    // Reset creator variables
    stickerCreatorVars = {
        currentStep: 1,
        stickerType: '',
        selectedImage: null,
        selectedEmoji: '😊',
        imageFile: null
    };

    // Create creator modal
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
                <!-- Step 1: Choose type -->
                <div class="creator-step active" id="step1">
                    <h4>Choose Sticker Type</h4>
                    <div class="type-options">
                        <div class="type-option" data-type="image">
                            <div class="type-icon">
                                <i class="fas fa-image"></i>
                            </div>
                            <div class="type-info">
                                <h5>Photo Sticker</h5>
                                <p>Upload a photo and add text</p>
                            </div>
                        </div>
                        <div class="type-option" data-type="text">
                            <div class="type-icon">
                                <i class="fas fa-font"></i>
                            </div>
                            <div class="type-info">
                                <h5>Text Sticker</h5>
                                <p>Create with emoji and text</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Step 2: Image upload -->
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
                        <button class="remove-image" id="removeImage">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <div class="form-group">
                        <label for="stickerName">Sticker Name</label>
                        <input type="text" id="stickerName" 
                               placeholder="My Awesome Sticker" 
                               maxlength="20">
                    </div>
                    
                    <div class="form-group">
                        <label for="stickerText">Add Text (Optional)</label>
                        <input type="text" id="stickerText" 
                               placeholder="Add text to your sticker" 
                               maxlength="30">
                    </div>
                </div>
                
                <!-- Step 3: Text sticker -->
                <div class="creator-step" id="step3">
                    <h4>Create Text Sticker</h4>
                    
                    <div class="form-group">
                        <label for="textStickerName">Sticker Name</label>
                        <input type="text" id="textStickerName" 
                               placeholder="My Text Sticker" 
                               maxlength="20">
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
                        <input type="text" id="textStickerText" 
                               placeholder="Enter your text" 
                               maxlength="40">
                    </div>
                    
                    <div class="preview-area">
                        <div class="text-sticker-preview" id="textStickerPreview">
                            <span class="preview-emoji">😊</span>
                            <span class="preview-text">Your Text Here</span>
                        </div>
                    </div>
                </div>
                
                <!-- Navigation buttons -->
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

    // Setup event listeners for creator
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

    // Close modal
    closeBtn.addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });

    // Type selection
    typeOptions.forEach(option => {
        option.addEventListener('click', () => {
            typeOptions.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            stickerCreatorVars.stickerType = option.dataset.type;
            nextBtn.disabled = false;
        });
    });

    // Next button
    nextBtn.addEventListener('click', () => {
        if (stickerCreatorVars.currentStep === 1 && stickerCreatorVars.stickerType) {
            // Go to step 2 or 3 based on type
            goToStep(modal, stickerCreatorVars.stickerType === 'image' ? 2 : 3);
        } else if (stickerCreatorVars.currentStep === 2) {
            // Validate image sticker
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
            // Validate text sticker
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

    // Previous button
    prevBtn.addEventListener('click', () => {
        if (stickerCreatorVars.currentStep === 2 || stickerCreatorVars.currentStep === 3) {
            goToStep(modal, 1);
        }
    });

    // Create button
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

    // Image upload
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

    // Remove image
    if (removeImageBtn) {
        removeImageBtn.addEventListener('click', () => {
            stickerCreatorVars.imageFile = null;
            const imagePreview = modal.querySelector('#imagePreview');
            if (imagePreview) imagePreview.style.display = 'none';
            if (uploadArea) uploadArea.style.display = 'flex';
            nextBtn.disabled = true;
        });
    }

    // Emoji selection
    if (emojiElements.length > 0) {
        emojiElements.forEach(emoji => {
            emoji.addEventListener('click', () => {
                emojiElements.forEach(e => e.classList.remove('selected'));
                emoji.classList.add('selected');
                stickerCreatorVars.selectedEmoji = emoji.dataset.emoji;
                if (previewEmoji) previewEmoji.textContent = stickerCreatorVars.selectedEmoji;
            });
        });
        // Select first emoji by default
        emojiElements[0].classList.add('selected');
        stickerCreatorVars.selectedEmoji = emojiElements[0].dataset.emoji;
    }

    // Text sticker preview
    if (textStickerText && previewText) {
        textStickerText.addEventListener('input', () => {
            previewText.textContent = textStickerText.value || 'Your Text Here';
        });
    }
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

// Navigate between steps
function goToStep(modal, step) {
    modal.querySelectorAll('.creator-step').forEach(s => {
        s.classList.remove('active');
    });
    
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
    
    // Upload to Cloudinary
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

// Send sticker in chat - FIXED TO PREVENT DUPLICATE TEXT MESSAGES
async function sendSticker(sticker) {
    if (!currentUser || !chatPartnerId || !currentThreadId || !db) {
        showNotification('Cannot send sticker - Firebase not available', 'error');
        return;
    }

    // Prevent multiple clicks
    if (isStickerSending) {
        console.log('Sticker already sending, please wait...');
        return;
    }

    isStickerSending = true;

    try {
        // Check chat points
        const hasPoints = await deductChatPoint();
        if (!hasPoints) {
            isStickerSending = false;
            return;
        }

        // Generate a unique temporary ID for this sticker
        const tempStickerId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Add to sent sticker tracking
        sentStickerIds.add(tempStickerId);

        const messageData = {
            senderId: currentUser.uid,
            text: `[STICKER] ${sticker.name}`, // Use a clear marker
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
            messageId: generateMessageId(),
            tempId: tempStickerId
        };

        console.log('Sending sticker message to Firebase:', messageData);

        const docRef = await addDoc(collection(db, 'conversations', currentThreadId, 'messages'), messageData);
        
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

        closeStickerPicker();
        showNotification('Sticker sent!', 'success');
        
        // Immediately add sticker to chat display with temporary ID
        addStickerToChatDisplay(sticker, true, tempStickerId);
        
        // Clear any text in the input that might trigger regular message sending
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            messageInput.value = '';
        }
        
    } catch (error) {
        console.error('Error sending sticker:', error);
        showNotification('Error sending sticker', 'error');
    } finally {
        isStickerSending = false;
    }
}

// Add sticker to chat display immediately
function addStickerToChatDisplay(sticker, isSent = true, tempId = null) {
    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) return;
    
    // Create sticker message element
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;
    messageDiv.dataset.stickerId = sticker.id;
    messageDiv.dataset.stickerName = sticker.name;
    messageDiv.dataset.stickerType = sticker.type;
    messageDiv.dataset.stickerUrl = sticker.url || '';
    messageDiv.dataset.stickerEmoji = sticker.emoji || '';
    messageDiv.dataset.stickerText = sticker.text || '';
    messageDiv.dataset.isCustom = 'true';
    messageDiv.dataset.type = 'sticker';
    if (tempId) {
        messageDiv.dataset.tempId = tempId;
    }
    
    // Create a paragraph for the message
    const messageText = document.createElement('p');
    messageText.className = 'sticker-message';
    
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
    } else {
        // Fallback
        stickerHTML = `
            <span>${sticker.name}</span>
        `;
    }
    
    messageText.innerHTML = stickerHTML;
    
    // Style for sent vs received
    const content = messageText.querySelector('.sticker-message-content');
    if (isSent) {
        content.style.background = '#000000';
        content.style.borderColor = '#333333';
        content.style.color = 'white';
    } else {
        content.style.background = 'white';
        content.style.borderColor = '#e8e8e8';
        content.style.color = '#333';
    }
    
    // Add to message div
    messageDiv.appendChild(messageText);
    
    // Add timestamp
    const timeSpan = document.createElement('span');
    timeSpan.className = 'message-time';
    timeSpan.textContent = 'Just now';
    messageDiv.appendChild(timeSpan);
    
    // Add to chat
    messagesContainer.appendChild(messageDiv);
    
    // Mark as enhanced
    messageDiv.classList.add('sticker-enhanced', 'sticker-message');
    messageText.classList.add('sticker-display');
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
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
            
            // Update display if function exists
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

    onSnapshot(messagesQuery, (snapshot) => {
        snapshot.docChanges().forEach(change => {
            if (change.type === 'added') {
                const message = change.doc.data();
                const messageId = change.doc.id;
                
                if (message.type === 'sticker' || message.text?.includes('[STICKER]')) {
                    // Check if this is our own message that was just sent
                    const isOwnMessage = message.senderId === currentUser.uid;
                    
                    if (isOwnMessage && message.tempId) {
                        // Check if we already displayed this sticker
                        if (sentStickerIds.has(message.tempId)) {
                            // Remove from tracking set so we don't display it again
                            sentStickerIds.delete(message.tempId);
                            
                            // Find and update the existing sticker with the real message ID
                            updateExistingStickerWithMessageId(message.tempId, messageId);
                            return; // Skip, we already displayed it
                        }
                    }
                    
                    // Display sticker in chat
                    displayReceivedSticker(message, isOwnMessage, messageId);
                    
                    // Auto-save received stickers to user's collection (only if from others)
                    if (!isOwnMessage) {
                        saveReceivedSticker(message);
                    }
                }
            }
        });
    });
}

// Update existing sticker with the real message ID
function updateExistingStickerWithMessageId(tempId, messageId) {
    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) return;
    
    // Find the sticker with the temp ID
    const existingSticker = messagesContainer.querySelector(`[data-temp-id="${tempId}"]`);
    if (existingSticker) {
        // Update with the real message ID
        existingSticker.dataset.messageId = messageId;
        delete existingSticker.dataset.tempId;
    }
}

// Display received sticker
function displayReceivedSticker(message, isOwnMessage = false, messageId = null) {
    const stickerData = {
        id: message.stickerId,
        name: message.stickerName,
        type: message.stickerType,
        url: message.stickerUrl,
        emoji: message.stickerEmoji,
        text: message.stickerText
    };
    
    addStickerToChatDisplay(stickerData, isOwnMessage, message.tempId || messageId);
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

        // Show notification
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
    
    // Clear existing stickers
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
    
    // Add saved stickers
    savedStickers.forEach(sticker => {
        const stickerItem = createStickerElement(sticker);
        stickerItem.classList.add('saved');
        stickerItem.addEventListener('click', () => sendSticker(sticker));
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
        
        // Add CSS for animations if not present
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

// Load sticker styles
function loadStickerStyles() {
    if (document.getElementById('sticker-styles')) return;

    const styles = `
        /* Sticker Picker Styles - WhatsApp/Telegram Style */
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

        /* Sticker Message Display Styles - WhatsApp/Telegram Style */
        .message.sticker-message {
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
            padding: 5px !important;
            max-width: 200px;
            margin: 10px 0;
        }
        
        .message.sticker-message.sent {
            margin-left: auto;
            margin-right: 10px;
        }
        
        .message.sticker-message.received {
            margin-left: 10px;
            margin-right: auto;
        }
        
        .sticker-message-content {
            display: inline-block;
            border-radius: 18px;
            padding: 12px;
            border: 2px solid #e8e8e8;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            transition: all 0.2s ease;
            text-align: center;
            max-width: 200px;
            background: white;
        }
        
        /* Sent stickers - BLACK background */
        .message.sent .sticker-message-content {
            background: #000000 !important;
            border-color: #333333;
            color: white;
        }
        
        /* Received stickers - White background */
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
        
        /* Text overlay on image - TRANSPARENT BACKGROUND */
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
        
        .message.sent .sticker-text-on-image {
            color: white;
            text-shadow: 
                1px 1px 3px rgba(0, 0, 0, 0.8),
                0 0 8px rgba(0, 0, 0, 0.6),
                0 0 15px rgba(0, 0, 0, 0.4);
        }
        
        .message.received .sticker-text-on-image {
            color: white;
            text-shadow: 
                1px 1px 3px rgba(0, 0, 0, 0.8),
                0 0 8px rgba(0, 0, 0, 0.6),
                0 0 15px rgba(0, 0, 0, 0.4);
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
        
        .sticker-display p {
            display: none;
        }
        
        .message-time {
            font-size: 11px;
            color: rgba(255, 255, 255, 0.7);
            text-align: center;
            margin-top: 8px;
            opacity: 0.8;
        }
        
        .message.received .message-time {
            color: rgba(0, 0, 0, 0.5);
        }

        /* Sticker Creator Modal */
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
});

// Make functions available globally
window.stickerFunctions = {
    openStickerPicker,
    closeStickerPicker,
    loadUserStickers,
    loadSavedStickers
};

// Export for module usage if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        firebaseConfig,
        initializeFeatures,
        loadUserStickers,
        sendSticker
    };
}