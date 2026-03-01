// additional-group.js - COMPLETE FIXED VERSION WITH PREMIUM
// FIXED: Sticker button disappears when input is active
// FIXED: Prevent duplicate saved stickers
// ADDED: Premium user restriction - only premium users can send stickers
// ADDED: Premium badges on group members

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
    updateDoc,
    query,
    orderBy,
    limit,
    arrayUnion,
    getDocs,
    onSnapshot,
    where
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
const CLOUDINARY_CONFIG = {
    cloudName: "ddtdqrh1b",
    uploadPreset: "profile-pictures"
};

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
let currentGroupId = null;
let userStickers = [];
let savedStickers = new Map(); // Use Map to prevent duplicates (key = stickerId)
let stickerPickerOpen = false;
let stickerDataCache = new Map(); // messageId -> stickerData
let isSendingSticker = false;
let stickerListenerUnsubscribe = null;
let hasLoadedInitialMessages = false;
let messageObserver = null;
let userHasPremium = false; // NEW: Current user premium status
let groupMembers = new Map(); // NEW: Track group members and their premium status

// Sticker creator state
let stickerCreator = {
    currentStep: 1,
    type: '',
    selectedImage: null,
    selectedEmoji: '😊',
    imageFile: null,
    name: '',
    text: ''
};

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    loadStickerStyles();
    
    if (auth && typeof onAuthStateChanged === 'function') {
        onAuthStateChanged(auth, (user) => {
            if (user) {
                currentUser = user;
                
                // Get group ID from URL
                const urlParams = new URLSearchParams(window.location.search);
                currentGroupId = urlParams.get('id');
                
                // Check current user premium status
                checkCurrentUserPremium();
                
                // Wait a bit for the chat to load
                setTimeout(() => {
                    initializeFeatures();
                }, 1000);
            } else {
                currentUser = null;
                userHasPremium = false;
            }
        });
    }
});

// NEW: Check if current user is premium
async function checkCurrentUserPremium() {
    if (!currentUser || !db) return;
    
    try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
            const userData = userSnap.data();
            userHasPremium = (userData.paymentHistory && 
                userData.paymentHistory.some(payment => 
                    (payment.plan === 'lifetime' && payment.status === 'approved')
                )) || (userData.chatPoints >= 9999);
            
            console.log('Current user premium status:', userHasPremium);
            
            // Update sticker button title based on premium status
            updateStickerButtonTitle();
        }
    } catch (error) {
        console.error('Error checking premium status:', error);
    }
}

// NEW: Update sticker button title based on premium status
function updateStickerButtonTitle() {
    const stickerBtn = document.getElementById('stickerPickerBtn');
    if (stickerBtn) {
        stickerBtn.title = userHasPremium ? 'Stickers' : 'Premium feature - Upgrade to $30 lifetime plan to send stickers';
    }
}

// NEW: Load group members and add premium badges
async function loadGroupMembers() {
    if (!currentGroupId || !db) return;
    
    try {
        const groupRef = doc(db, 'groups', currentGroupId);
        const groupSnap = await getDoc(groupRef);
        
        if (groupSnap.exists()) {
            const groupData = groupSnap.data();
            const members = groupData.members || [];
            
            // Clear previous members
            groupMembers.clear();
            
            // Check premium status for each member
            for (const memberId of members) {
                if (memberId === currentUser?.uid) continue; // Skip current user
                
                try {
                    const userRef = doc(db, 'users', memberId);
                    const userSnap = await getDoc(userRef);
                    
                    if (userSnap.exists()) {
                        const userData = userSnap.data();
                        const isPremium = (userData.paymentHistory && 
                            userData.paymentHistory.some(payment => 
                                (payment.plan === 'lifetime' && payment.status === 'approved')
                            )) || (userData.chatPoints >= 9999);
                        
                        groupMembers.set(memberId, {
                            premium: isPremium,
                            name: userData.displayName || userData.email?.split('@')[0] || 'User',
                            photoURL: userData.photoURL
                        });
                    }
                } catch (error) {
                    console.error('Error checking member premium:', error);
                }
            }
            
            console.log(`Loaded ${groupMembers.size} group members with premium status`);
            
            // Add premium badges to member list
            setTimeout(() => {
                addPremiumBadgesToMemberList();
            }, 500);
        }
    } catch (error) {
        console.error('Error loading group members:', error);
    }
}

// NEW: Add premium badges to group member list
function addPremiumBadgesToMemberList() {
    // Look for member list elements - adjust selectors based on your HTML structure
    const memberItems = document.querySelectorAll('.member-item, .group-member, .participant-item, [class*="member"]');
    
    memberItems.forEach(item => {
        // Don't add duplicate badges
        if (item.querySelector('.group-premium-badge')) return;
        
        // Try to get member ID from data attribute or other means
        const memberId = item.dataset.userId || item.dataset.memberId || item.dataset.id;
        
        if (memberId && groupMembers.has(memberId)) {
            const member = groupMembers.get(memberId);
            
            if (member.premium) {
                const premiumBadge = document.createElement('span');
                premiumBadge.className = 'group-premium-badge';
                premiumBadge.innerHTML = '<i class="fas fa-crown"></i>';
                premiumBadge.title = 'Premium Member';
                premiumBadge.style.cssText = `
                    color: #FFD700;
                    font-size: 14px;
                    margin-left: 5px;
                    display: inline-block;
                    filter: drop-shadow(0 2px 4px rgba(255, 215, 0, 0.3));
                `;
                
                // Find member name element
                const nameElement = item.querySelector('.member-name, .participant-name, h4, h5, span:not(.badge)');
                if (nameElement) {
                    nameElement.appendChild(premiumBadge);
                } else {
                    item.appendChild(premiumBadge);
                }
            }
        }
    });
}

// NEW: Add premium badge to message sender
function addPremiumBadgeToMessage(messageElement, senderId) {
    if (!senderId || !groupMembers.has(senderId)) return;
    
    const member = groupMembers.get(senderId);
    if (!member.premium) return;
    
    // Don't add duplicate badges
    if (messageElement.querySelector('.message-premium-badge')) return;
    
    // Find sender name element
    const senderName = messageElement.querySelector('.sender-name, .message-sender, .username, [class*="sender"]');
    
    if (senderName) {
        const premiumBadge = document.createElement('span');
        premiumBadge.className = 'message-premium-badge';
        premiumBadge.innerHTML = '<i class="fas fa-crown"></i>';
        premiumBadge.title = 'Premium Member';
        premiumBadge.style.cssText = `
            color: #FFD700;
            font-size: 12px;
            margin-left: 4px;
            display: inline-block;
            vertical-align: middle;
        `;
        senderName.appendChild(premiumBadge);
    }
}

// Initialize features after auth
function initializeFeatures() {
    console.log('Initializing sticker system for group:', currentGroupId);
    
    // Load group members and check premium status
    loadGroupMembers();
    
    // Add sticker button
    addStickerButton();
    
    // Create sticker picker
    createStickerPicker();
    
    // Load user stickers
    loadUserStickers();
    
    // Load saved stickers with deduplication
    loadSavedStickers();
    
    // Setup sticker listener for new messages
    setupStickerListener();
    
    // Setup sticker interceptor
    setupStickerInterceptor();
    
    // Setup sticker button visibility
    setupStickerButtonVisibility();
    
    // Load all existing messages to populate cache
    loadAllMessagesForCache();
}

// ============================================
// Setup sticker button visibility based on input focus
// ============================================
function setupStickerButtonVisibility() {
    const messageInput = document.getElementById('messageInput');
    const stickerBtn = document.getElementById('stickerPickerBtn');
    
    if (!messageInput || !stickerBtn) {
        setTimeout(setupStickerButtonVisibility, 500);
        return;
    }
    
    // Remove any existing listeners to prevent duplicates
    messageInput.removeEventListener('focus', handleInputFocus);
    messageInput.removeEventListener('blur', handleInputBlur);
    
    // Add focus/blur listeners
    messageInput.addEventListener('focus', handleInputFocus);
    messageInput.addEventListener('blur', handleInputBlur);
    
    console.log('Sticker button visibility listener set up for groups');
}

function handleInputFocus() {
    const stickerBtn = document.getElementById('stickerPickerBtn');
    if (stickerBtn) {
        stickerBtn.style.display = 'none';
    }
}

function handleInputBlur() {
    const stickerBtn = document.getElementById('stickerPickerBtn');
    if (stickerBtn) {
        stickerBtn.style.display = 'flex';
    }
}

// ============================================
// Load ALL messages for cache
// ============================================
async function loadAllMessagesForCache() {
    if (!currentUser || !currentGroupId || !db) {
        return;
    }

    console.log('Loading ALL messages to populate sticker cache...');

    try {
        // Load more messages to ensure we get all stickers
        const messagesQuery = query(
            collection(db, 'groups', currentGroupId, 'messages'),
            orderBy('timestamp', 'asc'),
            limit(200)
        );

        const querySnapshot = await getDocs(messagesQuery);
        let stickerCount = 0;
        
        querySnapshot.forEach((doc) => {
            const message = doc.data();
            const messageId = doc.id;
            
            // If this is a sticker message, store in cache
            if (message.type === 'sticker' || message.isSticker || message.stickerId) {
                
                const stickerData = {
                    id: message.stickerId || `sticker_${Date.now()}`,
                    name: message.stickerName || 'Sticker',
                    type: message.stickerType || 'text',
                    url: message.stickerUrl || '',
                    emoji: message.stickerEmoji || '😊',
                    text: message.stickerText || ''
                };
                
                stickerDataCache.set(messageId, stickerData);
                stickerCount++;
                console.log(`Cached sticker ${stickerCount} for message ${messageId}:`, stickerData.name);
            }
        });
        
        console.log(`✅ Loaded ${stickerCount} stickers into cache out of ${querySnapshot.size} total messages`);
        
        // Process all messages after cache is populated
        setTimeout(() => {
            processAllMessagesForStickers();
            hasLoadedInitialMessages = true;
        }, 500);
        
        // Also run again after 2 seconds to catch any that might have been missed
        setTimeout(() => {
            processAllMessagesForStickers();
        }, 2000);
        
    } catch (error) {
        console.error('Error loading messages for cache:', error);
    }
}

// ============================================
// STICKER INTERCEPTOR
// ============================================
function setupStickerInterceptor() {
    const messagesContainer = document.getElementById('messagesContainer');
    if (!messagesContainer) {
        setTimeout(setupStickerInterceptor, 1000);
        return;
    }

    console.log('Sticker interceptor set up');

    // Process all existing messages
    processAllMessagesForStickers();

    // Watch for new messages
    if (messageObserver) {
        messageObserver.disconnect();
    }
    
    messageObserver = new MutationObserver((mutations) => {
        let hasNewMessages = false;
        
        mutations.forEach((mutation) => {
            if (mutation.addedNodes.length) {
                hasNewMessages = true;
            }
        });
        
        if (hasNewMessages) {
            setTimeout(() => {
                processAllMessagesForStickers();
            }, 200);
        }
    });

    messageObserver.observe(messagesContainer, { childList: true, subtree: true });
}

// ============================================
// Process all messages for stickers
// ============================================
function processAllMessagesForStickers() {
    const messagesContainer = document.getElementById('messagesContainer');
    if (!messagesContainer) return;

    const messages = messagesContainer.querySelectorAll('.message-text, .message-group, .message, [class*="message"]');
    console.log(`Processing ${messages.length} messages for stickers - Cache has ${stickerDataCache.size} items`);
    
    let processed = 0;
    messages.forEach(message => {
        const success = checkAndReplaceWithSticker(message);
        if (success) processed++;
    });
    
    if (processed > 0) {
        console.log(`✅ Processed ${processed} sticker messages`);
    }
    
    // If we have fewer processed than cache items, try again after a delay
    if (stickerDataCache.size > 0 && processed < stickerDataCache.size) {
        console.log(`⚠️ Only processed ${processed}/${stickerDataCache.size} stickers, retrying in 1 second...`);
        setTimeout(() => {
            processAllMessagesForStickers();
        }, 1000);
    }
}

// ============================================
// Check and replace with sticker
// ============================================
function checkAndReplaceWithSticker(messageElement) {
    // Skip if already processed
    if (messageElement.dataset.stickerProcessed === 'true') return false;

    // Try to get sender ID for premium badge
    const senderId = messageElement.dataset.senderId || messageElement.dataset.userId;
    if (senderId) {
        addPremiumBadgeToMessage(messageElement, senderId);
    }

    // Find the text element that might contain [STICKER]
    const messageText = messageElement.querySelector('p, .message-content, .message-content-wrapper, .message-text, .text');
    if (!messageText) return false;

    const text = messageText.textContent || '';
    
    // If it's our sticker marker
    if (text === '[STICKER]' || text.includes('[STICKER]')) {
        // Get message ID from various possible locations
        let messageId = messageElement.dataset.messageId || 
                       messageElement.dataset.id || 
                       messageElement.id;
        
        // If we still don't have an ID, try to find it in the message content
        if (!messageId) {
            const idElement = messageElement.querySelector('[data-message-id]');
            if (idElement) {
                messageId = idElement.dataset.messageId;
            }
        }
        
        // If still no ID, try to extract from the message
        if (!messageId) {
            // Look for any element with an ID that looks like a message ID
            const elementsWithId = messageElement.querySelectorAll('[id^="msg_"], [id^="message_"]');
            if (elementsWithId.length > 0) {
                messageId = elementsWithId[0].id;
            }
        }
        
        // Get sticker data from cache
        let stickerData = null;
        
        if (messageId) {
            stickerData = stickerDataCache.get(messageId);
            if (stickerData) {
                console.log(`✅ Found cached sticker for message ${messageId}:`, stickerData.name);
            }
        }
        
        // If still no sticker data, create a default one
        if (!stickerData) {
            stickerData = {
                id: 'default_sticker',
                name: 'Sticker',
                type: 'text',
                url: '',
                emoji: '😊',
                text: 'Sticker'
            };
            console.log(`⚠️ Using default sticker for message ${messageId || 'unknown'}`);
        }
        
        replaceMessageWithSticker(messageElement, messageText, stickerData);
        messageElement.dataset.stickerProcessed = 'true';
        return true;
    }
    return false;
}

function replaceMessageWithSticker(messageElement, textElement, stickerData) {
    // Create sticker HTML based on type
    let stickerHTML = '';
    
    if (stickerData.type === 'image' && stickerData.url) {
        stickerHTML = `
            <div class="sticker-message-content">
                <div class="sticker-image-container">
                    <img src="${stickerData.url}" 
                         alt="${stickerData.name || 'Sticker'}" 
                         class="sticker-message-image"
                         loading="lazy"
                         onerror="this.onerror=null;this.src='https://via.placeholder.com/150/667eea/FFFFFF?text=Sticker'">
                    ${stickerData.text ? `<div class="sticker-text-on-image">${stickerData.text}</div>` : ''}
                </div>
            </div>
        `;
    } else {
        // Text sticker
        stickerHTML = `
            <div class="sticker-message-content">
                <div class="text-sticker-message">
                    <span class="sticker-emoji-large">${stickerData.emoji || '😊'}</span>
                    <span class="sticker-text-large">${stickerData.text || stickerData.name || 'Sticker'}</span>
                </div>
            </div>
        `;
    }
    
    // Replace the text content with sticker HTML
    textElement.innerHTML = stickerHTML;
    textElement.classList.add('sticker-display');
    
    // Determine if message is sent or received
    const isSent = messageElement.classList.contains('sent') || 
                   messageElement.querySelector('[style*="margin-left: auto"]') !== null ||
                   (messageElement.style.marginLeft === 'auto');
    
    // Style based on sent/received
    const content = textElement.querySelector('.sticker-message-content');
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
    
    // Hide any default message background
    messageElement.style.background = 'transparent';
    messageElement.style.border = 'none';
    messageElement.style.boxShadow = 'none';
    messageElement.style.padding = '5px';
    messageElement.style.maxWidth = '200px';
    messageElement.classList.add('sticker-message');
}

// ============================================
// ADD STICKER BUTTON
// ============================================
function addStickerButton() {
    const findContainer = () => {
        const container = document.querySelector('.message-input-container');
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');
        
        if (!container || !messageInput) {
            setTimeout(findContainer, 500);
            return;
        }

        const existingBtn = document.getElementById('stickerPickerBtn');
        if (existingBtn) {
            existingBtn.remove();
        }

        const stickerBtn = document.createElement('button');
        stickerBtn.id = 'stickerPickerBtn';
        stickerBtn.className = 'sticker-picker-btn';
        stickerBtn.innerHTML = '<i class="fas fa-smile"></i>'; // NO CROWN - keeping original icon
        stickerBtn.title = userHasPremium ? 'Stickers' : 'Premium feature - Upgrade to $30 lifetime plan to send stickers';
        stickerBtn.type = 'button';
        stickerBtn.addEventListener('click', toggleStickerPicker);

        if (sendBtn) {
            container.insertBefore(stickerBtn, sendBtn);
        } else {
            container.appendChild(stickerBtn);
        }

        messageInput.style.paddingRight = '110px';
        
        // Setup visibility listener after button is added
        setupStickerButtonVisibility();
    };
    
    findContainer();
}

// ============================================
// STICKER PICKER UI
// ============================================
function createStickerPicker() {
    if (document.getElementById('stickerPickerPanel')) return;

    const pickerPanel = document.createElement('div');
    pickerPanel.id = 'stickerPickerPanel';
    pickerPanel.className = 'sticker-picker-panel';
    
    pickerPanel.innerHTML = `
        <div class="sticker-picker-header">
            <h4><i class="fas fa-smile"></i> My Stickers</h4>
            <button class="create-sticker-btn" id="createStickerBtn">
                <i class="fas fa-plus"></i> Create
            </button>
        </div>
        
        ${!userHasPremium ? `
        <div class="premium-upgrade-notice" style="
            background: #fff3cd;
            color: #856404;
            padding: 12px 15px;
            text-align: center;
            font-size: 14px;
            border-bottom: 1px solid #ffeaa7;
        ">
            <i class="fas fa-crown" style="color: #FFD700; margin-right: 8px;"></i>
            Upgrade to Premium ($30 lifetime) to send stickers
        </div>
        ` : ''}
        
        <div class="sticker-tabs">
            <button class="sticker-tab active" data-tab="my-stickers">My Stickers</button>
            <button class="sticker-tab" data-tab="saved-stickers">Saved</button>
            <button class="sticker-tab" data-tab="packs">Packs</button>
        </div>
        
        <div class="sticker-content">
            <div class="tab-content active" id="my-stickers-tab">
                <div class="sticker-grid" id="myStickersGrid">
                    <div class="no-stickers" id="noStickersMessage">
                        <i class="fas fa-smile-wink"></i>
                        <p>No stickers yet</p>
                        ${userHasPremium ? 
                            '<button class="create-first-sticker">Create your first sticker</button>' : 
                            '<p class="premium-required" style="color: #667eea; font-size: 14px;">Premium required to create stickers</p>'}
                    </div>
                </div>
            </div>
            
            <div class="tab-content" id="saved-stickers-tab">
                <div class="sticker-grid" id="savedStickersGrid">
                    <div class="no-stickers">
                        <i class="fas fa-heart"></i>
                        <p>No saved stickers</p>
                        <p class="hint">Stickers you receive will appear here</p>
                    </div>
                </div>
            </div>
            
            <div class="tab-content" id="packs-tab">
                <div class="sticker-grid" id="packsStickersGrid">
                    <div class="no-stickers">
                        <i class="fas fa-layer-group"></i>
                        <p>No sticker packs</p>
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

    document.body.appendChild(pickerPanel);
    setupStickerPickerEvents();
}

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
        createBtn.addEventListener('click', () => {
            if (userHasPremium) {
                openStickerCreator();
            } else {
                showNotification('Premium required to create stickers. Upgrade to $30 lifetime plan!', 'warning');
            }
        });
    }
    
    if (createFirstBtn) {
        createFirstBtn.addEventListener('click', () => {
            if (userHasPremium) {
                openStickerCreator();
            } else {
                showNotification('Premium required to create stickers. Upgrade to $30 lifetime plan!', 'warning');
            }
        });
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
                updateSavedStickersDisplay();
            } else if (tabName === 'packs') {
                loadStickerPacks();
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

function toggleStickerPicker(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    // Check premium status before opening
    if (!userHasPremium) {
        showNotification('Premium feature: Upgrade to $30 lifetime plan to use stickers!', 'warning');
        return;
    }
    
    if (stickerPickerOpen) {
        closeStickerPicker();
    } else {
        openStickerPicker();
    }
}

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
    updateStickerGrid();
}

function closeStickerPicker() {
    const pickerPanel = document.getElementById('stickerPickerPanel');
    
    if (!pickerPanel) return;
    
    pickerPanel.classList.remove('open');
    
    setTimeout(() => {
        pickerPanel.style.display = 'none';
    }, 300);
    
    stickerPickerOpen = false;
}

// ============================================
// STICKER MANAGEMENT
// ============================================
async function loadUserStickers() {
    if (!currentUser || !db) return;
    
    try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
            userStickers = userSnap.data().stickers || [];
            updateStickerGrid();
        }
    } catch (error) {
        console.error('Error loading user stickers:', error);
    }
}

// Load saved stickers with deduplication
async function loadSavedStickers() {
    if (!currentUser || !db) return;
    
    try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
            const savedStickersArray = userSnap.data().savedStickers || [];
            
            // Clear the Map and add stickers with deduplication
            savedStickers.clear();
            
            savedStickersArray.forEach(sticker => {
                // Use sticker.id as the key to prevent duplicates
                if (!savedStickers.has(sticker.id)) {
                    savedStickers.set(sticker.id, sticker);
                }
            });
            
            console.log(`Loaded ${savedStickers.size} unique saved stickers`);
            updateSavedStickersDisplay();
        }
    } catch (error) {
        console.error('Error loading saved stickers:', error);
    }
}

// Update display using the Map instead of reloading from Firebase
function updateSavedStickersDisplay() {
    const savedStickersGrid = document.getElementById('savedStickersGrid');
    if (!savedStickersGrid) return;
    
    // Clear current display
    savedStickersGrid.innerHTML = '';
    
    if (savedStickers.size === 0) {
        savedStickersGrid.innerHTML = `
            <div class="no-stickers">
                <i class="fas fa-heart"></i>
                <p>No saved stickers</p>
                <p class="hint">Stickers you receive will appear here</p>
            </div>
        `;
        return;
    }
    
    // Convert Map values to array and display
    const stickersArray = Array.from(savedStickers.values());
    stickersArray.forEach(sticker => {
        const stickerItem = createStickerElement(sticker);
        stickerItem.classList.add('saved');
        stickerItem.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Check premium before sending saved stickers
            if (!userHasPremium) {
                showNotification('Premium required to send stickers. Upgrade to $30 lifetime plan!', 'warning');
                return;
            }
            
            sendSticker(sticker);
        }, true);
        savedStickersGrid.appendChild(stickerItem);
    });
}

function loadStickerPacks() {
    const packs = [
        {
            id: 'pack_emojis',
            name: 'Emoji Pack',
            stickers: [
                { emoji: '😊', text: 'Smile' },
                { emoji: '😂', text: 'Laugh' },
                { emoji: '❤️', text: 'Love' },
                { emoji: '🎉', text: 'Party' },
                { emoji: '🔥', text: 'Fire' },
                { emoji: '✨', text: 'Sparkles' }
            ]
        },
        {
            id: 'pack_animals',
            name: 'Animal Pack',
            stickers: [
                { emoji: '🐶', text: 'Dog' },
                { emoji: '🐱', text: 'Cat' },
                { emoji: '🐼', text: 'Panda' },
                { emoji: '🦊', text: 'Fox' },
                { emoji: '🐨', text: 'Koala' },
                { emoji: '🦁', text: 'Lion' }
            ]
        }
    ];
    
    updatePacksGrid(packs);
}

function updateStickerGrid() {
    const myStickersGrid = document.getElementById('myStickersGrid');
    const noStickersMessage = document.getElementById('noStickersMessage');
    
    if (!myStickersGrid) return;
    
    const existingStickers = myStickersGrid.querySelectorAll('.sticker-item');
    existingStickers.forEach(sticker => sticker.remove());
    
    if (noStickersMessage) {
        noStickersMessage.style.display = userStickers.length > 0 ? 'none' : 'flex';
    }
    
    userStickers.forEach((sticker) => {
        const stickerItem = createStickerElement(sticker);
        stickerItem.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Check premium before sending
            if (!userHasPremium) {
                showNotification('Premium required to send stickers. Upgrade to $30 lifetime plan!', 'warning');
                return;
            }
            
            sendSticker(sticker);
        }, true);
        myStickersGrid.appendChild(stickerItem);
    });
}

function updatePacksGrid(packs) {
    const packsStickersGrid = document.getElementById('packsStickersGrid');
    if (!packsStickersGrid) return;
    
    packsStickersGrid.innerHTML = '';
    
    packs.forEach(pack => {
        const packElement = document.createElement('div');
        packElement.className = 'sticker-pack';
        packElement.innerHTML = `
            <div class="pack-header">
                <h5>${pack.name}</h5>
                ${userHasPremium ? `
                <button class="add-pack-btn" data-pack-id="${pack.id}">
                    <i class="fas fa-plus"></i> Add
                </button>
                ` : ''}
            </div>
            <div class="pack-stickers">
                ${pack.stickers.map(s => `
                    <div class="pack-sticker ${!userHasPremium ? 'premium-locked' : ''}" 
                         data-emoji="${s.emoji}" 
                         data-text="${s.text}"
                         ${!userHasPremium ? 'title="Premium feature"' : ''}>
                        <span class="pack-emoji">${s.emoji}</span>
                        <span class="pack-text">${s.text}</span>
                        ${!userHasPremium ? '<span class="lock-icon">🔒</span>' : ''}
                    </div>
                `).join('')}
            </div>
        `;
        
        packElement.querySelectorAll('.pack-sticker').forEach(el => {
            el.addEventListener('click', () => {
                if (!userHasPremium) {
                    showNotification('Premium required to send stickers. Upgrade to $30 lifetime plan!', 'warning');
                    return;
                }
                
                const sticker = {
                    id: `pack_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    name: el.dataset.text,
                    type: 'text',
                    emoji: el.dataset.emoji,
                    text: el.dataset.text
                };
                sendSticker(sticker);
            });
        });
        
        const addBtn = packElement.querySelector('.add-pack-btn');
        if (addBtn) {
            addBtn.addEventListener('click', async () => {
                await addStickerPack(pack);
            });
        }
        
        packsStickersGrid.appendChild(packElement);
    });
}

function createStickerElement(sticker) {
    const stickerItem = document.createElement('div');
    stickerItem.className = 'sticker-item';
    stickerItem.dataset.stickerId = sticker.id;
    
    if (sticker.type === 'image' && sticker.url) {
        stickerItem.innerHTML = `
            <div class="sticker-item-image-container">
                <img src="${sticker.url}" alt="${sticker.name || 'Custom Sticker'}" class="sticker-image" loading="lazy">
                ${sticker.text ? `<div class="sticker-text-on-item">${sticker.text}</div>` : ''}
            </div>
        `;
    } else {
        stickerItem.innerHTML = `
            <div class="text-sticker">
                <span class="sticker-emoji">${sticker.emoji || '😊'}</span>
                <span class="sticker-text">${sticker.text || sticker.name || 'Sticker'}</span>
            </div>
        `;
    }
    
    return stickerItem;
}

// ============================================
// SEND STICKER - MODIFIED for premium
// ============================================
async function sendSticker(sticker) {
    if (!currentUser || !currentGroupId || !db) {
        showNotification('Cannot send sticker', 'error');
        return;
    }

    // Double-check premium status
    if (!userHasPremium) {
        showNotification('Premium required: Upgrade to $30 lifetime plan to send stickers', 'warning');
        return;
    }

    if (isSendingSticker) {
        return;
    }

    isSendingSticker = true;

    try {
        // Create sticker message with ALL data
        const messageData = {
            senderId: currentUser.uid,
            senderName: currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
            senderAvatar: currentUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.uid}`,
            text: '[STICKER]', // Special marker that we'll replace with visual sticker
            
            // Store all sticker data in the message
            stickerId: sticker.id,
            stickerName: sticker.name,
            stickerType: sticker.type,
            stickerUrl: sticker.url || '',
            stickerEmoji: sticker.emoji || '😊',
            stickerText: sticker.text || '',
            
            type: 'sticker',
            isCustom: true,
            timestamp: serverTimestamp(),
            sentByPremium: userHasPremium
        };

        console.log('Sending sticker to Firebase:', messageData);

        // Send to Firebase
        const docRef = await addDoc(collection(db, 'groups', currentGroupId, 'messages'), messageData);
        const firestoreId = docRef.id;
        
        // Store sticker data in cache with the Firestore ID
        stickerDataCache.set(firestoreId, sticker);
        
        // Update group
        await updateDoc(doc(db, 'groups', currentGroupId), {
            lastActivity: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        // Close sticker picker
        closeStickerPicker();
        
        showNotification('Sticker sent!', 'success');
        
    } catch (error) {
        console.error('Error sending sticker:', error);
        showNotification('Error sending sticker', 'error');
    } finally {
        setTimeout(() => {
            isSendingSticker = false;
        }, 1000);
    }
}

// ============================================
// STICKER LISTENER - Cache ALL new messages with deduplication
// ============================================
function setupStickerListener() {
    if (!currentUser || !currentGroupId || !db) {
        return;
    }

    const messagesQuery = query(
        collection(db, 'groups', currentGroupId, 'messages'),
        orderBy('timestamp', 'desc'),
        limit(100)
    );

    if (stickerListenerUnsubscribe) {
        stickerListenerUnsubscribe();
    }

    stickerListenerUnsubscribe = onSnapshot(messagesQuery, (snapshot) => {
        let newStickers = 0;
        
        snapshot.docChanges().forEach(change => {
            if (change.type === 'added') {
                const message = change.doc.data();
                const messageId = change.doc.id;
                
                // If this is a sticker message
                if (message.type === 'sticker' || message.isSticker || message.stickerId) {
                    
                    // Create sticker data from message
                    const stickerData = {
                        id: message.stickerId || `sticker_${Date.now()}`,
                        name: message.stickerName || 'Sticker',
                        type: message.stickerType || 'text',
                        url: message.stickerUrl || '',
                        emoji: message.stickerEmoji || '😊',
                        text: message.stickerText || ''
                    };
                    
                    // Store in cache with the message ID
                    stickerDataCache.set(messageId, stickerData);
                    newStickers++;
                    console.log(`Cached new sticker ${newStickers} for message ${messageId}:`, stickerData.name);
                    
                    // If it's not from current user, save it
                    if (message.senderId !== currentUser.uid) {
                        saveReceivedSticker(message);
                    }
                    
                    // Try to find and replace the message in the DOM
                    setTimeout(() => {
                        findAndReplaceMessageById(messageId);
                    }, 200);
                }
            }
        });
        
        if (newStickers > 0) {
            console.log(`✅ Added ${newStickers} new stickers to cache. Total: ${stickerDataCache.size}`);
        }
    });
}

function findAndReplaceMessageById(messageId) {
    const messagesContainer = document.getElementById('messagesContainer');
    if (!messagesContainer) return;
    
    const messages = messagesContainer.querySelectorAll('.message-text, .message-group, .message, [class*="message"]');
    messages.forEach(msg => {
        if (msg.dataset.messageId === messageId || 
            msg.dataset.id === messageId ||
            msg.id === messageId) {
            checkAndReplaceWithSticker(msg);
        }
    });
}

// Save received sticker with deduplication
async function saveReceivedSticker(message) {
    if (!currentUser || !db) return;
    
    try {
        if (message.isCustom !== true) return;
        
        const stickerData = {
            id: message.stickerId,
            name: message.stickerName,
            type: message.stickerType,
            text: message.stickerText || '',
            emoji: message.stickerEmoji || '',
            url: message.stickerUrl || '',
            savedAt: Date.now(),
            savedFrom: message.senderId
        };

        // Check if sticker already exists in saved stickers Map
        if (savedStickers.has(stickerData.id)) {
            console.log('Sticker already saved, skipping duplicate');
            return;
        }

        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
            savedStickers: arrayUnion(stickerData)
        });

        // Add to local Map to prevent future duplicates
        savedStickers.set(stickerData.id, stickerData);
        
        // Update the display if the saved stickers tab is active
        const savedTab = document.querySelector('.sticker-tab[data-tab="saved-stickers"]');
        if (savedTab && savedTab.classList.contains('active')) {
            updateSavedStickersDisplay();
        }

        showNotification(`Saved "${message.stickerName}" sticker`, 'info');
    } catch (error) {
        console.error('Error saving received sticker:', error);
    }
}

async function addStickerPack(pack) {
    if (!currentUser || !db) return;
    
    const stickers = pack.stickers.map(s => ({
        id: `pack_${pack.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: s.text,
        type: 'text',
        emoji: s.emoji,
        text: s.text,
        packId: pack.id,
        createdAt: Date.now()
    }));
    
    const userRef = doc(db, 'users', currentUser.uid);
    await updateDoc(userRef, {
        stickers: arrayUnion(...stickers)
    });
    
    showNotification(`Added ${pack.name} to your stickers!`, 'success');
    loadUserStickers();
}

// ============================================
// STICKER CREATOR - MODIFIED for premium
// ============================================
function openStickerCreator() {
    // Check premium status
    if (!userHasPremium) {
        showNotification('Premium required: Upgrade to $30 lifetime plan to create stickers', 'warning');
        return;
    }
    
    closeStickerPicker();
    
    stickerCreator = {
        currentStep: 1,
        type: '',
        selectedImage: null,
        selectedEmoji: '😊',
        imageFile: null,
        name: '',
        text: ''
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
            stickerCreator.type = option.dataset.type;
            nextBtn.disabled = false;
        });
    });

    nextBtn.addEventListener('click', () => {
        if (stickerCreator.currentStep === 1 && stickerCreator.type) {
            goToCreatorStep(modal, stickerCreator.type === 'image' ? 2 : 3);
        } else if (stickerCreator.currentStep === 2) {
            const name = stickerNameInput?.value.trim();
            if (!name) {
                showNotification('Please enter a sticker name', 'error');
                return;
            }
            if (!stickerCreator.imageFile) {
                showNotification('Please upload an image', 'error');
                return;
            }
            showCreateButton(modal);
        } else if (stickerCreator.currentStep === 3) {
            const name = textStickerNameInput?.value.trim();
            const text = textStickerText?.value.trim();
            if (!name) {
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
        if (stickerCreator.currentStep === 2 || stickerCreator.currentStep === 3) {
            goToCreatorStep(modal, 1);
        }
    });

    createBtn.addEventListener('click', async () => {
        createBtn.disabled = true;
        createBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
        
        try {
            let stickerData;
            
            if (stickerCreator.type === 'image') {
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
            stickerCreator.imageFile = null;
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
                stickerCreator.selectedEmoji = emoji.dataset.emoji;
                if (previewEmoji) previewEmoji.textContent = stickerCreator.selectedEmoji;
            });
        });
    }

    if (textStickerText && previewText) {
        textStickerText.addEventListener('input', () => {
            previewText.textContent = textStickerText.value || 'Your Text Here';
        });
    }
}

function goToCreatorStep(modal, step) {
    modal.querySelectorAll('.creator-step').forEach(s => s.classList.remove('active'));
    const stepElement = modal.querySelector(`#step${step}`);
    if (stepElement) stepElement.classList.add('active');
    stickerCreator.currentStep = step;
    
    const prevBtn = modal.querySelector('#prevBtn');
    const nextBtn = modal.querySelector('#nextBtn');
    const createBtn = modal.querySelector('#createBtn');
    
    if (prevBtn) prevBtn.style.display = step === 1 ? 'none' : 'inline-flex';
    if (nextBtn) nextBtn.style.display = step === 3 ? 'none' : 'inline-flex';
    if (createBtn) createBtn.style.display = step === 3 ? 'inline-flex' : 'none';
}

function showCreateButton(modal) {
    const prevBtn = modal.querySelector('#prevBtn');
    const nextBtn = modal.querySelector('#nextBtn');
    const createBtn = modal.querySelector('#createBtn');
    
    if (prevBtn) prevBtn.style.display = 'inline-flex';
    if (nextBtn) nextBtn.style.display = 'none';
    if (createBtn) createBtn.style.display = 'inline-flex';
}

function handleImageUpload(file, modal) {
    if (!file.type.match('image.*')) {
        showNotification('Please upload an image file (PNG, JPG, GIF)', 'error');
        return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
        showNotification('Image must be less than 5MB', 'error');
        return;
    }
    
    stickerCreator.imageFile = file;
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

async function uploadToCloudinary(imageFile) {
    if (!CLOUDINARY_CONFIG.cloudName || !CLOUDINARY_CONFIG.uploadPreset) {
        throw new Error('Cloudinary configuration missing');
    }
    
    const formData = new FormData();
    formData.append('file', imageFile);
    formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
    formData.append('folder', 'dating_connect/stickers');
    
    const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`,
        {
            method: 'POST',
            body: formData
        }
    );
    
    if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
    }
    
    const data = await response.json();
    if (!data.secure_url) {
        throw new Error('Upload failed: No URL returned');
    }
    
    return data.secure_url;
}

async function createImageSticker(modal) {
    const nameInput = modal.querySelector('#stickerName');
    const textInput = modal.querySelector('#stickerText');
    
    const name = nameInput ? nameInput.value.trim() : '';
    const text = textInput ? textInput.value.trim() : '';
    
    if (!stickerCreator.imageFile) {
        throw new Error('No image file selected');
    }
    
    const imageUrl = await uploadToCloudinary(stickerCreator.imageFile);
    
    return {
        id: `sticker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: name,
        type: 'image',
        text: text,
        url: imageUrl,
        emoji: '📷',
        createdAt: Date.now(),
        createdBy: currentUser?.uid
    };
}

async function createTextSticker(modal) {
    const nameInput = modal.querySelector('#textStickerName');
    const textInput = modal.querySelector('#textStickerText');
    
    const name = nameInput ? nameInput.value.trim() : '';
    const text = textInput ? textInput.value.trim() : '';
    
    return {
        id: `sticker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: name,
        type: 'text',
        text: text,
        emoji: stickerCreator.selectedEmoji,
        createdAt: Date.now(),
        createdBy: currentUser?.uid
    };
}

async function saveStickerToFirebase(stickerData) {
    if (!currentUser || !db) throw new Error('User not authenticated');

    const userRef = doc(db, 'users', currentUser.uid);
    await updateDoc(userRef, {
        stickers: arrayUnion(stickerData)
    });
}

// ============================================
// NOTIFICATION SYSTEM
// ============================================
function showNotification(message, type = 'info') {
    const existing = document.querySelectorAll('.sticker-notification');
    existing.forEach(n => n.remove());
    
    const notification = document.createElement('div');
    notification.className = 'sticker-notification';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'error' ? '#f44336' : type === 'success' ? '#4CAF50' : type === 'warning' ? '#ff9800' : '#2196F3'};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 10000;
        max-width: 300px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        font-weight: 500;
        animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 300);
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
}

// ============================================
// LOAD STICKER STYLES - ADDED PREMIUM STYLES
// ============================================
function loadStickerStyles() {
    if (document.getElementById('sticker-styles')) return;

    const styles = `
        /* Sticker Picker Button - ORIGINAL STYLES UNCHANGED */
        .sticker-picker-btn {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
            transform: translateY(-50%) scale(1.1);
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
        }
        
        /* Premium badge styles for group members */
        .group-premium-badge, .message-premium-badge {
            display: inline-block;
            vertical-align: middle;
        }
        
        .group-premium-badge i, .message-premium-badge i {
            font-size: inherit;
        }
        
        /* Premium locked items in packs */
        .pack-sticker.premium-locked {
            opacity: 0.6;
            position: relative;
            cursor: not-allowed;
        }
        
        .pack-sticker.premium-locked .lock-icon {
            position: absolute;
            top: 2px;
            right: 2px;
            font-size: 12px;
            opacity: 0.8;
        }
        
        .pack-sticker.premium-locked:hover {
            border-color: #e8e8e8 !important;
            transform: none !important;
        }
        
        /* Premium upgrade notice */
        .premium-upgrade-notice {
            background: #fff3cd;
            color: #856404;
            padding: 12px 15px;
            text-align: center;
            font-size: 14px;
            border-bottom: 1px solid #ffeaa7;
        }
        
        .premium-upgrade-notice i {
            color: #FFD700;
            margin-right: 8px;
        }
        
        .premium-required {
            color: #667eea;
            font-size: 14px;
            margin-top: 10px;
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
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 20px 20px 0 0;
        }
        
        .sticker-picker-header h4 {
            margin: 0;
            font-size: 18px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .create-sticker-btn {
            background: rgba(255,255,255,0.2);
            color: white;
            border: 1px solid rgba(255,255,255,0.3);
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
            background: rgba(255,255,255,0.3);
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
            color: #667eea;
        }
        
        .sticker-tab.active::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 3px 3px 0 0;
        }
        
        .sticker-content {
            height: calc(100% - 130px);
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
            }
        }
        
        @media (max-width: 480px) {
            .sticker-grid {
                grid-template-columns: repeat(2, 1fr);
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
            border-color: #667eea;
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.2);
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
            color: #667eea;
            margin-bottom: 15px;
            opacity: 0.7;
        }
        
        .no-stickers p {
            margin: 0 0 15px 0;
            font-size: 16px;
        }
        
        .no-stickers .hint {
            font-size: 13px;
            color: #999;
            margin: 5px 0 0;
        }
        
        .create-first-sticker {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.3);
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
        
        /* Sticker Pack Styles */
        .sticker-pack {
            background: #f8f9fa;
            border-radius: 12px;
            padding: 15px;
            margin-bottom: 20px;
            border: 2px solid #e8e8e8;
        }
        
        .pack-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }
        
        .pack-header h5 {
            margin: 0;
            font-size: 16px;
            color: #333;
        }
        
        .add-pack-btn {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 6px 12px;
            border-radius: 15px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 4px;
            transition: all 0.3s ease;
        }
        
        .add-pack-btn:hover {
            transform: scale(1.05);
        }
        
        .pack-stickers {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
        }
        
        .pack-sticker {
            background: white;
            border-radius: 8px;
            padding: 10px;
            text-align: center;
            border: 2px solid #e8e8e8;
            cursor: pointer;
            transition: all 0.3s ease;
            position: relative;
        }
        
        .pack-sticker:hover {
            transform: scale(1.05);
            border-color: #667eea;
        }
        
        .pack-emoji {
            font-size: 1.8rem;
            display: block;
            margin-bottom: 5px;
        }
        
        .pack-text {
            font-size: 11px;
            color: #333;
        }
        
        /* Sticker Message Styles */
        .message.sticker-message {
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
            padding: 5px !important;
            margin: 5px 0 !important;
            max-width: 200px !important;
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
            text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
            background: transparent;
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
        }
        
        .message.sent .sticker-text-large {
            color: white;
        }
        
        .message.received .sticker-text-large {
            color: #333;
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
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
            border-color: #667eea;
            background: #f5f7ff;
        }
        
        .type-option.selected {
            border-color: #667eea;
            background: linear-gradient(135deg, #f5f7ff, #f0f3ff);
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.1);
        }
        
        .type-icon {
            width: 50px;
            height: 50px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
            border: 2px dashed #667eea;
            border-radius: 15px;
            padding: 40px 20px;
            text-align: center;
            cursor: pointer;
            margin-bottom: 20px;
            background: #f5f7ff;
            transition: all 0.3s ease;
        }
        
        .upload-area.dragover {
            background: #e0e7ff;
            border-color: #764ba2;
        }
        
        .upload-area i {
            font-size: 48px;
            color: #667eea;
            margin-bottom: 15px;
        }
        
        .upload-hint {
            color: #666;
            font-size: 12px;
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
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
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
            border-color: #667eea;
            background: #f5f7ff;
        }
        
        .emoji.selected {
            border-color: #667eea;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
            border: 2px solid #667eea;
            border-radius: 15px;
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.1);
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
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        
        .next-btn:hover:not(:disabled) {
            transform: scale(1.05);
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.3);
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
            transform: scale(1.05);
        }
        
        .create-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
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
    if (messageObserver) {
        messageObserver.disconnect();
    }
});

// Make functions available globally
window.stickerFunctions = {
    openStickerPicker,
    closeStickerPicker,
    loadUserStickers,
    loadSavedStickers
};