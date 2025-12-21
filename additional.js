// Additional features for Gaming Connect App - FIXED VERSION
// Profile picture navigation, game animation library, and animated stickers

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
    limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Firebase configuration (same as your app.js)
const firebaseConfig = {
    apiKey: "AIzaSyC9uL_BX14Z6rRpgG4MT9Tca1opJl8EviQ",
    authDomain: "dating-connect.firebaseapp.com",
    projectId: "dating-connect",
    storageBucket: "dating-connect.appspot.com",
    messagingSenderId: "1062172180210",
    appId: "1:1062172180210:web:0c9b3c1578a5dbae58da6b"
};

// Initialize Firebase
const app = window.app || (() => {
    try {
        return window.initializeApp(firebaseConfig);
    } catch (e) {
        return window.app;
    }
})();

const auth = getAuth(app);
const db = getFirestore(app);

// Animation library configuration - GAMING THEME
const ANIMATION_EMOJIS = [
    { emoji: '🎮', name: 'game_start', animation: 'gameStart' },
    { emoji: '🏆', name: 'victory', animation: 'victoryTrophy' },
    { emoji: '🌟', name: 'star_power', animation: 'starPower' },
    { emoji: '🎯', name: 'bullseye', animation: 'bullseyeHit' },
    { emoji: '⚡', name: 'power_up', animation: 'powerUp' },
    { emoji: '💥', name: 'explosion', animation: 'explosionEffect' },
    { emoji: '🎪', name: 'party_popper', animation: 'partyPopper' },
    { emoji: '🔮', name: 'magic_spell', animation: 'magicSpell' },
    { emoji: '🌀', name: 'vortex', animation: 'vortexSpin' },
    { emoji: '🎲', name: 'dice_roll', animation: 'diceRoll' },
    { emoji: '🎺', name: 'victory_fanfare', animation: 'victoryFanfare' },
    { emoji: '✨', name: 'sparkle_burst', animation: 'sparkleBurst' }
];

// Animated Stickers configuration - GAMING THEME
const ANIMATED_STICKERS = [
    { name: 'dancing_game', emoji: '🕹️💃', animation: 'danceGame', type: 'sticker' },
    { name: 'jumping_joy', emoji: '🎮🦘', animation: 'jumpJoy', type: 'sticker' },
    { name: 'fireworks_win', emoji: '🎆🏆', animation: 'fireworksWin', type: 'sticker' },
    { name: 'spinning_coin', emoji: '🪙🌀', animation: 'spinCoin', type: 'sticker' },
    { name: 'floating_power', emoji: '⚡🌟', animation: 'floatPower', type: 'sticker' },
    { name: 'pulsing_heart', emoji: '❤️🎯', animation: 'pulseHeart', type: 'sticker' },
    { name: 'bouncing_ball', emoji: '🏀⚡', animation: 'bounceBall', type: 'sticker' },
    { name: 'swaying_flag', emoji: '🚩🎮', animation: 'swayFlag', type: 'sticker' },
    { name: 'twinkling_star', emoji: '⭐✨', animation: 'twinkleStar', type: 'sticker' },
    { name: 'fluttering_confetti', emoji: '🎊🎉', animation: 'flutterConfetti', type: 'sticker' },
    { name: 'glowing_achievement', emoji: '🏅🌟', animation: 'glowAchievement', type: 'sticker' },
    { name: 'rocket_launch', emoji: '🚀⚡', animation: 'rocketLaunch', type: 'sticker' }
];

// Global variables
let animationLibraryOpen = false;
let userHasPremium = false;
let currentUser = null;
let chatPartnerId = null;
let playedAnimations = new Set();
let animationListenerUnsubscribe = null;
let lastProcessedMessageTime = 0;
let currentThreadId = null;

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    loadAnimationStyles();
    
    // Load played animations from localStorage
    loadPlayedAnimations();
    
    // Set up auth state listener
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            initializeFeatures();
        } else {
            currentUser = null;
            cleanupAnimationListener();
            playedAnimations.clear();
        }
    });
});

// Load played animations from localStorage
function loadPlayedAnimations() {
    try {
        const stored = localStorage.getItem('playedAnimations');
        if (stored) {
            const data = JSON.parse(stored);
            playedAnimations = new Set(data.animations || []);
            lastProcessedMessageTime = data.lastProcessedTime || 0;
        }
    } catch (error) {
        console.error('Error loading played animations:', error);
    }
}

// Save played animations to localStorage
function savePlayedAnimations() {
    try {
        const data = {
            animations: Array.from(playedAnimations),
            lastProcessedTime: lastProcessedMessageTime,
            timestamp: Date.now()
        };
        localStorage.setItem('playedAnimations', JSON.stringify(data));
    } catch (error) {
        console.error('Error saving played animations:', error);
    }
}

// Clean up animation listener
function cleanupAnimationListener() {
    if (animationListenerUnsubscribe) {
        animationListenerUnsubscribe();
        animationListenerUnsubscribe = null;
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
    initAnimationLibrary();
    checkPremiumStatus();
    
    // Set up animation listener for chat page
    if (window.location.pathname.includes('chat.html') && chatPartnerId) {
        setTimeout(() => {
            setupAnimationListener();
        }, 2000);
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

// Initialize animation library with improved button placement
function initAnimationLibrary() {
    if (window.location.pathname.includes('chat.html')) {
        addAnimationLibraryButton();
        createAnimationLibraryModal();
        setupInputFocusHandling();
    }
}

// Add animation library button with proper positioning
function addAnimationLibraryButton() {
    const chatInputContainer = document.querySelector('.chat-input-container');
    if (!chatInputContainer) {
        setTimeout(addAnimationLibraryButton, 1000);
        return;
    }

    // Remove existing button if any
    const existingBtn = document.getElementById('animationLibraryBtn');
    if (existingBtn) {
        existingBtn.remove();
    }

    const animationBtn = document.createElement('button');
    animationBtn.id = 'animationLibraryBtn';
    animationBtn.className = 'animation-btn';
    animationBtn.innerHTML = '<i class="fas fa-gamepad"></i>';
    animationBtn.title = 'Game Animations & Stickers';
    animationBtn.addEventListener('click', toggleAnimationLibrary);

    // Insert at the beginning of the chat input container
    const messageInput = document.getElementById('messageInput');
    if (messageInput && messageInput.parentNode === chatInputContainer) {
        chatInputContainer.insertBefore(animationBtn, messageInput);
    } else {
        chatInputContainer.insertBefore(animationBtn, chatInputContainer.firstChild);
    }
}

// Set up input focus handling for responsive width
function setupInputFocusHandling() {
    const messageInput = document.getElementById('messageInput');
    const animationBtn = document.getElementById('animationLibraryBtn');
    
    if (!messageInput || !animationBtn) {
        setTimeout(setupInputFocusHandling, 1000);
        return;
    }

    // Add focus event to hide animation button
    messageInput.addEventListener('focus', () => {
        animationBtn.style.display = 'none';
        // Expand input width when focused
        messageInput.style.width = 'calc(100% - 100px)';
    });

    // Add blur event to show animation button
    messageInput.addEventListener('blur', () => {
        setTimeout(() => {
            animationBtn.style.display = 'flex';
            // Shrink input width when not focused
            messageInput.style.width = 'calc(100% - 150px)';
        }, 100);
    });

    // Initial setup
    animationBtn.style.display = 'flex';
    messageInput.style.width = 'calc(100% - 150px)';
    messageInput.style.transition = 'width 0.3s ease';
}

// Create animation library modal with stickers section
function createAnimationLibraryModal() {
    if (document.getElementById('animationLibraryModal')) return;

    const modal = document.createElement('div');
    modal.id = 'animationLibraryModal';
    modal.className = 'animation-modal';
    modal.innerHTML = `
        <div class="animation-modal-content">
            <div class="animation-modal-header">
                <h3>Game Animations & Stickers</h3>
                <button class="close-animation-modal">&times;</button>
            </div>
            <div class="animation-tabs">
                <button class="tab-button active" data-tab="animations">Animations</button>
                <button class="tab-button" data-tab="stickers">Stickers</button>
            </div>
            <div class="tab-content">
                <div class="tab-pane active" id="animations-tab">
                    <div class="animation-grid">
                        ${ANIMATION_EMOJIS.map(anim => `
                            <div class="animation-item" data-type="animation" data-animation="${anim.animation}">
                                <span class="animation-emoji">${anim.emoji}</span>
                                <span class="animation-name">${anim.name.replace('_', ' ')}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="tab-pane" id="stickers-tab">
                    <div class="sticker-grid">
                        ${ANIMATED_STICKERS.map(sticker => `
                            <div class="sticker-item" data-type="sticker" data-sticker="${sticker.animation}">
                                <div class="sticker-emoji ${sticker.animation}">${sticker.emoji}</div>
                                <span class="sticker-name">${sticker.name.replace('_', ' ')}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
            <div class="animation-premium-notice" id="premiumNotice" style="display: none;">
                <i class="fas fa-crown"></i>
                <p>Premium feature: Upgrade to $200 lifetime plan to send animations & stickers</p>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Tab functionality
    const tabButtons = modal.querySelectorAll('.tab-button');
    const tabPanes = modal.querySelectorAll('.tab-pane');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.dataset.tab;
            
            // Update active tab button
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Show active tab pane
            tabPanes.forEach(pane => pane.classList.remove('active'));
            document.getElementById(`${tabName}-tab`).classList.add('active');
        });
    });

    modal.querySelector('.close-animation-modal').addEventListener('click', closeAnimationLibrary);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeAnimationLibrary();
    });

    // Animation items
    const animationItems = modal.querySelectorAll('.animation-item');
    animationItems.forEach(item => {
        item.addEventListener('click', () => selectAnimation(item.dataset.animation));
    });

    // Sticker items
    const stickerItems = modal.querySelectorAll('.sticker-item');
    stickerItems.forEach(item => {
        item.addEventListener('click', () => selectSticker(item.dataset.sticker));
    });
}

// Toggle animation library
function toggleAnimationLibrary() {
    const modal = document.getElementById('animationLibraryModal');
    if (!modal) return;

    if (animationLibraryOpen) {
        closeAnimationLibrary();
    } else {
        openAnimationLibrary();
    }
}

// Open animation library
function openAnimationLibrary() {
    const modal = document.getElementById('animationLibraryModal');
    if (!modal) return;

    modal.style.display = 'block';
    animationLibraryOpen = true;

    const premiumNotice = document.getElementById('premiumNotice');
    if (premiumNotice) {
        premiumNotice.style.display = userHasPremium ? 'none' : 'flex';
    }

    const animationItems = document.querySelectorAll('.animation-item');
    const stickerItems = document.querySelectorAll('.sticker-item');
    
    animationItems.forEach(item => {
        if (!userHasPremium) {
            item.classList.add('premium-locked');
        } else {
            item.classList.remove('premium-locked');
        }
    });
    
    stickerItems.forEach(item => {
        if (!userHasPremium) {
            item.classList.add('premium-locked');
        } else {
            item.classList.remove('premium-locked');
        }
    });
}

// Close animation library
function closeAnimationLibrary() {
    const modal = document.getElementById('animationLibraryModal');
    if (!modal) return;

    modal.style.display = 'none';
    animationLibraryOpen = false;
}

// Select animation
async function selectAnimation(animationType) {
    if (!userHasPremium) {
        showNotification('Premium feature: Upgrade to $200 lifetime plan to send game animations', 'warning');
        return;
    }

    try {
        const animationData = ANIMATION_EMOJIS.find(anim => anim.animation === animationType);
        if (!animationData) return;

        await sendAnimationMessage(animationData);
        closeAnimationLibrary();
        showNotification('Animation sent!', 'success');
    } catch (error) {
        showNotification('Error sending animation', 'error');
    }
}

// Select sticker
async function selectSticker(stickerType) {
    if (!userHasPremium) {
        showNotification('Premium feature: Upgrade to $200 lifetime plan to send animated stickers', 'warning');
        return;
    }

    try {
        const stickerData = ANIMATED_STICKERS.find(sticker => sticker.animation === stickerType);
        if (!stickerData) return;

        await sendStickerMessage(stickerData);
        closeAnimationLibrary();
        showNotification('Sticker sent!', 'success');
    } catch (error) {
        showNotification('Error sending sticker', 'error');
    }
}

// Send animation message
async function sendAnimationMessage(animationData) {
    if (!currentUser || !chatPartnerId || !currentThreadId) {
        return;
    }

    try {
        const messageData = {
            senderId: currentUser.uid,
            text: `Sent ${animationData.name.replace('_', ' ')} animation`,
            animation: animationData.animation,
            emoji: animationData.emoji,
            animationName: animationData.name,
            read: false,
            timestamp: serverTimestamp(),
            type: 'animation',
            messageId: generateMessageId()
        };

        const docRef = await addDoc(collection(db, 'conversations', currentThreadId, 'messages'), messageData);
        
        // Update conversation
        await setDoc(doc(db, 'conversations', currentThreadId), {
            participants: [currentUser.uid, chatPartnerId],
            lastMessage: {
                text: `Sent ${animationData.name.replace('_', ' ')} animation`,
                senderId: currentUser.uid,
                timestamp: serverTimestamp()
            },
            updatedAt: serverTimestamp()
        }, { merge: true });

    } catch (error) {
        throw error;
    }
}

// Send sticker message - FIXED: This will work with your app.js rendering
async function sendStickerMessage(stickerData) {
    if (!currentUser || !chatPartnerId || !currentThreadId) {
        return;
    }

    try {
        // Check if user has chat points
        const hasPoints = await deductChatPoint();
        if (!hasPoints) {
            return;
        }

        const messageData = {
            senderId: currentUser.uid,
            text: stickerData.emoji, // This is the key - use the emoji as text so app.js can render it
            sticker: stickerData.animation,
            emoji: stickerData.emoji,
            stickerName: stickerData.name,
            read: false,
            timestamp: serverTimestamp(),
            type: 'sticker',
            messageId: generateMessageId()
        };

        const docRef = await addDoc(collection(db, 'conversations', currentThreadId, 'messages'), messageData);
        
        // Update conversation
        await setDoc(doc(db, 'conversations', currentThreadId), {
            participants: [currentUser.uid, chatPartnerId],
            lastMessage: {
                text: `Sent ${stickerData.name.replace('_', ' ')} sticker`,
                senderId: currentUser.uid,
                timestamp: serverTimestamp()
            },
            updatedAt: serverTimestamp()
        }, { merge: true });

    } catch (error) {
        throw error;
    }
}

// FIXED: Deduct chat points function that works with your app.js
async function deductChatPoint() {
    if (!currentUser) return false;
    
    try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
            const currentPoints = userSnap.data().chatPoints || 0;
            
            if (currentPoints <= 0) {
                showNotification('You have no chat points left. Please purchase more to continue chatting.', 'warning');
                return false;
            }
            
            await updateDoc(userRef, {
                chatPoints: currentPoints - 1
            });
            
            // Update the global variable that your app.js uses
            if (window.userChatPoints !== undefined) {
                window.userChatPoints = currentPoints - 1;
            }
            
            // Update display if the function exists
            if (window.updateChatPointsDisplay) {
                window.updateChatPointsDisplay();
            }
            
            return true;
        }
        return false;
    } catch (error) {
        return false;
    }
}

// Generate unique message ID for tracking
function generateMessageId() {
    return 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Check premium status for unlimited chat points
async function checkPremiumStatus() {
    if (!currentUser) return;

    try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
            const userData = userSnap.data();
            userHasPremium = (userData.paymentHistory && 
                userData.paymentHistory.some(payment => 
                    (payment.plan === 'lifetime' && payment.status === 'approved') ||
                    (userData.chatPoints >= 9999)
                ));
            
            addPremiumBadges();
        }
    } catch (error) {
        console.error('Error checking premium status:', error);
    }
}

// Add premium badges to any user with unlimited plan
async function addPremiumBadges() {
    if (window.location.pathname.includes('mingle.html')) {
        setTimeout(async () => {
            const profileCards = document.querySelectorAll('.profile-card');
            for (const card of profileCards) {
                const profileId = card.dataset.profileId;
                if (profileId) {
                    try {
                        const userRef = doc(db, 'users', profileId);
                        const userSnap = await getDoc(userRef);
                        
                        if (userSnap.exists()) {
                            const userData = userSnap.data();
                            const isPremium = userData.paymentHistory && 
                                userData.paymentHistory.some(payment => 
                                    (payment.plan === 'lifetime' && payment.status === 'approved') ||
                                    (userData.chatPoints >= 9999)
                                );
                            
                            if (isPremium && !card.querySelector('.premium-badge')) {
                                const premiumBadge = document.createElement('div');
                                premiumBadge.className = 'premium-badge';
                                premiumBadge.innerHTML = '<i class="fas fa-crown"></i> PREMIUM';
                                card.appendChild(premiumBadge);
                            }
                        }
                    } catch (error) {
                        console.error('Error adding premium badge:', error);
                    }
                }
            }
        }, 1000);
    }

    if (window.location.pathname.includes('profile.html')) {
        setTimeout(async () => {
            const urlParams = new URLSearchParams(window.location.search);
            const profileId = urlParams.get('id');
            
            if (profileId) {
                try {
                    const userRef = doc(db, 'users', profileId);
                    const userSnap = await getDoc(userRef);
                    
                    if (userSnap.exists()) {
                        const userData = userSnap.data();
                        const isPremium = userData.paymentHistory && 
                            userData.paymentHistory.some(payment => 
                                (payment.plan === 'lifetime' && payment.status === 'approved') ||
                                (userData.chatPoints >= 9999)
                            );
                        
                        if (isPremium) {
                            const profileHeader = document.querySelector('.profile-header') || 
                                                document.querySelector('.profile-info') ||
                                                document.querySelector('.profile-details');
                            if (profileHeader && !profileHeader.querySelector('.premium-badge')) {
                                const premiumBadge = document.createElement('div');
                                premiumBadge.className = 'premium-badge';
                                premiumBadge.innerHTML = '<i class="fas fa-crown"></i> PREMIUM MEMBER';
                                profileHeader.appendChild(premiumBadge);
                            }
                        }
                    }
                } catch (error) {
                    console.error('Error adding profile premium badge:', error);
                }
            }
        }, 1000);
    }
}

// Setup animation listener with read status marking
function setupAnimationListener() {
    if (!currentUser || !chatPartnerId || !currentThreadId) {
        return;
    }

    // Clean up existing listener
    cleanupAnimationListener();
    
    const messagesQuery = query(
        collection(db, 'conversations', currentThreadId, 'messages'),
        orderBy('timestamp', 'desc'),
        limit(50)
    );
    
    animationListenerUnsubscribe = onSnapshot(messagesQuery, (snapshot) => {
        snapshot.docChanges().forEach(change => {
            if (change.type === 'added') {
                const message = change.doc.data();
                const messageId = change.doc.id;
                const messageTime = message.timestamp?.toMillis?.() || Date.now();
                
                // Process animation and sticker messages
                if ((message.type === 'animation' || message.type === 'sticker') && 
                    message.senderId !== currentUser.uid &&
                    messageTime > lastProcessedMessageTime) {
                    
                    const animationId = message.messageId || 
                                      `${message.senderId}_${message.animation || message.sticker}_${messageTime}`;
                    
                    // Check if we've already played this animation
                    if (!playedAnimations.has(animationId)) {
                        // Mark as played
                        playedAnimations.add(animationId);
                        lastProcessedMessageTime = Math.max(lastProcessedMessageTime, messageTime);
                        savePlayedAnimations();
                        
                        // MARK MESSAGE AS READ in Firestore if it's from partner
                        if (message.senderId !== currentUser.uid) {
                            markMessageAsRead(messageId);
                        }
                        
                        // Trigger the animation or sticker
                        if (message.type === 'animation') {
                            triggerAnimation(message.animation);
                            showNotification(`${message.emoji} ${message.animationName} animation received!`, 'info');
                        } else if (message.type === 'sticker') {
                            // Stickers are automatically displayed in the chat by app.js
                            // since they're stored as regular messages with emoji text
                            showNotification(`${message.emoji} ${message.stickerName} sticker received!`, 'info');
                        }
                    }
                }
            }
        });
    });
}

// Enhanced sticker display that works with app.js - FIXED ANIMATIONS
function enhanceStickerDisplay() {
    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) return;

    // Find all messages
    const messages = messagesContainer.querySelectorAll('.message');
    
    messages.forEach(message => {
        const messageText = message.querySelector('p');
        if (messageText && !messageText.classList.contains('sticker-enhanced')) {
            const text = messageText.textContent;
            
            // Check if this message contains any of our sticker emojis
            ANIMATED_STICKERS.forEach(sticker => {
                if (text.includes(sticker.emoji)) {
                    // Mark as enhanced to prevent duplicate processing
                    messageText.classList.add('sticker-enhanced');
                    
                    // Add sticker classes - this is key for animations
                    messageText.classList.add('message-sticker', sticker.animation);
                    message.classList.add('sticker-message');
                    
                    // Add data attribute for easier CSS targeting
                    message.setAttribute('data-message-type', 'sticker');
                    
                    // Apply minimal inline styles - don't override CSS animations
                    messageText.style.display = 'inline-block';
                    messageText.style.textAlign = 'center';
                    messageText.style.margin = '5px 0';
                    
                    // Style based on sent/received for positioning only
                    if (message.classList.contains('sent')) {
                        messageText.style.marginLeft = 'auto';
                        messageText.style.marginRight = '10px';
                    } else if (message.classList.contains('received')) {
                        messageText.style.marginLeft = '10px';
                        messageText.style.marginRight = 'auto';
                    }
                }
            });
        }
    });
}

// Mark message as read in Firestore
async function markMessageAsRead(messageId) {
    if (!currentThreadId || !messageId) return;
    
    try {
        const messageRef = doc(db, 'conversations', currentThreadId, 'messages', messageId);
        await updateDoc(messageRef, {
            read: true
        });
    } catch (error) {
        console.error('Error marking message as read:', error);
    }
}

// Trigger animation based on type
function triggerAnimation(animationType) {
    const effectContainer = document.createElement('div');
    effectContainer.className = 'animation-effect';
    document.body.appendChild(effectContainer);

    switch(animationType) {
        case 'gameStart': createGameStart(effectContainer); break;
        case 'victoryTrophy': createVictoryTrophy(effectContainer); break;
        case 'starPower': createStarPower(effectContainer); break;
        case 'bullseyeHit': createBullseyeHit(effectContainer); break;
        case 'powerUp': createPowerUp(effectContainer); break;
        case 'explosionEffect': createExplosionEffect(effectContainer); break;
        case 'partyPopper': createPartyPopper(effectContainer); break;
        case 'magicSpell': createMagicSpell(effectContainer); break;
        case 'vortexSpin': createVortexSpin(effectContainer); break;
        case 'diceRoll': createDiceRoll(effectContainer); break;
        case 'victoryFanfare': createVictoryFanfare(effectContainer); break;
        case 'sparkleBurst': createSparkleBurst(effectContainer); break;
        default: createGameStart(effectContainer);
    }

    setTimeout(() => {
        if (effectContainer.parentNode) {
            effectContainer.parentNode.removeChild(effectContainer);
        }
    }, 5000);
}

// Animation functions (all 12) - GAMING THEME
function createGameStart(container) {
    for (let i = 0; i < 30; i++) {
        setTimeout(() => {
            const gamepad = document.createElement('div');
            gamepad.className = 'gamepad';
            gamepad.innerHTML = '🎮';
            gamepad.style.left = Math.random() * 100 + 'vw';
            gamepad.style.fontSize = (Math.random() * 20 + 15) + 'px';
            gamepad.style.animationDuration = (Math.random() * 2 + 2) + 's';
            container.appendChild(gamepad);
        }, i * 100);
    }
}

function createVictoryTrophy(container) {
    for (let i = 0; i < 25; i++) {
        setTimeout(() => {
            const trophy = document.createElement('div');
            trophy.className = 'trophy';
            trophy.innerHTML = '🏆';
            trophy.style.left = Math.random() * 100 + 'vw';
            trophy.style.fontSize = (Math.random() * 20 + 20) + 'px';
            trophy.style.animationDuration = (Math.random() * 2 + 3) + 's';
            container.appendChild(trophy);
        }, i * 150);
    }
}

function createStarPower(container) {
    for (let i = 0; i < 40; i++) {
        setTimeout(() => {
            const star = document.createElement('div');
            star.className = 'star';
            star.innerHTML = '🌟';
            star.style.left = Math.random() * 100 + 'vw';
            star.style.fontSize = (Math.random() * 20 + 20) + 'px';
            star.style.animationDuration = (Math.random() * 1 + 2) + 's';
            container.appendChild(star);
        }, i * 80);
    }
}

function createBullseyeHit(container) {
    for (let i = 0; i < 35; i++) {
        setTimeout(() => {
            const target = document.createElement('div');
            target.className = 'target';
            target.innerHTML = '🎯';
            target.style.left = Math.random() * 100 + 'vw';
            target.style.fontSize = (Math.random() * 25 + 25) + 'px';
            target.style.animationDuration = (Math.random() * 2 + 2.5) + 's';
            container.appendChild(target);
        }, i * 120);
    }
}

function createPowerUp(container) {
    for (let i = 0; i < 30; i++) {
        setTimeout(() => {
            const power = document.createElement('div');
            power.className = 'power';
            power.innerHTML = '⚡';
            power.style.left = Math.random() * 100 + 'vw';
            power.style.fontSize = (Math.random() * 20 + 18) + 'px';
            power.style.animationDuration = (Math.random() * 2 + 2) + 's';
            container.appendChild(power);
        }, i * 90);
    }
}

function createExplosionEffect(container) {
    for (let i = 0; i < 25; i++) {
        setTimeout(() => {
            const explosion = document.createElement('div');
            explosion.className = 'explosion';
            explosion.innerHTML = '💥';
            explosion.style.left = Math.random() * 100 + 'vw';
            explosion.style.top = Math.random() * 100 + 'vh';
            explosion.style.animationDuration = (Math.random() * 1 + 2) + 's';
            container.appendChild(explosion);
        }, i * 200);
    }
}

function createPartyPopper(container) {
    for (let i = 0; i < 20; i++) {
        setTimeout(() => {
            const popper = document.createElement('div');
            popper.className = 'popper';
            popper.innerHTML = '🎪';
            popper.style.left = Math.random() * 100 + 'vw';
            popper.style.fontSize = (Math.random() * 15 + 20) + 'px';
            popper.style.animationDuration = (Math.random() * 1 + 2.5) + 's';
            container.appendChild(popper);
        }, i * 150);
    }
}

function createMagicSpell(container) {
    for (let i = 0; i < 20; i++) {
        setTimeout(() => {
            const spell = document.createElement('div');
            spell.className = 'spell';
            spell.innerHTML = '🔮';
            spell.style.left = Math.random() * 100 + 'vw';
            spell.style.top = Math.random() * 100 + 'vh';
            spell.style.animationDuration = '1.5s';
            container.appendChild(spell);
        }, i * 200);
    }
}

function createVortexSpin(container) {
    for (let i = 0; i < 25; i++) {
        setTimeout(() => {
            const vortex = document.createElement('div');
            vortex.className = 'vortex';
            vortex.innerHTML = '🌀';
            vortex.style.left = Math.random() * 100 + 'vw';
            vortex.style.top = Math.random() * 100 + 'vh';
            vortex.style.animationDuration = (Math.random() * 1 + 2) + 's';
            container.appendChild(vortex);
        }, i * 150);
    }
}

function createDiceRoll(container) {
    for (let i = 0; i < 18; i++) {
        setTimeout(() => {
            const dice = document.createElement('div');
            dice.className = 'dice';
            dice.innerHTML = '🎲';
            dice.style.left = '50%';
            dice.style.top = '50%';
            dice.style.animationDuration = '3s';
            container.appendChild(dice);
        }, i * 166);
    }
}

function createVictoryFanfare(container) {
    for (let i = 0; i < 30; i++) {
        setTimeout(() => {
            const fanfare = document.createElement('div');
            fanfare.className = 'fanfare';
            fanfare.innerHTML = '🎺';
            fanfare.style.left = Math.random() * 100 + 'vw';
            fanfare.style.top = Math.random() * 100 + 'vh';
            fanfare.style.fontSize = (Math.random() * 15 + 15) + 'px';
            fanfare.style.animationDuration = (Math.random() * 1 + 1.5) + 's';
            container.appendChild(fanfare);
        }, i * 100);
    }
}

function createSparkleBurst(container) {
    for (let i = 0; i < 40; i++) {
        setTimeout(() => {
            const sparkle = document.createElement('div');
            sparkle.className = 'sparkle';
            sparkle.innerHTML = '✨';
            sparkle.style.left = Math.random() * 100 + 'vw';
            sparkle.style.top = Math.random() * 100 + 'vh';
            sparkle.style.fontSize = (Math.random() * 20 + 15) + 'px';
            sparkle.style.animationDuration = (Math.random() * 1 + 2) + 's';
            sparkle.style.animationName = 'magicFloat';
            container.appendChild(sparkle);
        }, i * 75);
    }
}

// Load animation styles with improved responsive design
function loadAnimationStyles() {
    if (document.getElementById('animation-styles')) return;

    const styles = `
        /* Animation Library Styles - IMPROVED */
        .chat-input-container {
            transition: all 0.3s ease;
        }
        
        .animation-btn {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border: none;
            border-radius: 50%;
            width: 35px;
            height: 35px;
            color: white;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            transition: all 0.3s ease;
            flex-shrink: 0;
            margin: 0 5px;
        }
        
        .animation-btn:hover { 
            background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
            transform: scale(1.1); 
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
        }
        
        #messageInput {
            transition: width 0.3s ease;
            flex: 1;
        }
        
        .animation-modal { 
            display: none; 
            position: fixed; 
            top: 0; 
            left: 0; 
            width: 100%; 
            height: 100%; 
            background: rgba(0,0,0,0.8); 
            z-index: 10000; 
        }
        
        .animation-modal-content { 
            position: absolute; 
            top: 50%; 
            left: 50%; 
            transform: translate(-50%,-50%); 
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            border-radius: 20px; 
            width: 90%; 
            max-width: 500px; 
            max-height: 80vh; 
            overflow: hidden; 
            box-shadow: 0 20px 60px rgba(0,0,0,0.5);
            border: 2px solid #667eea;
        }
        
        .animation-modal-header { 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            padding: 20px; 
            border-bottom: 1px solid #667eea; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white; 
        }
        
        .animation-modal-header h3 { 
            margin: 0; 
            font-size: 1.2rem; 
        }
        
        .close-animation-modal { 
            background: none; 
            border: none; 
            color: white; 
            font-size: 24px; 
            cursor: pointer; 
            padding: 0; 
            width: 30px; 
            height: 30px; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
        }
        
        .animation-tabs {
            display: flex;
            border-bottom: 1px solid #667eea;
            background: rgba(102, 126, 234, 0.1);
        }
        
        .tab-button {
            flex: 1;
            padding: 12px 20px;
            border: none;
            background: none;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            color: #a0aec0;
            transition: all 0.3s ease;
        }
        
        .tab-button.active {
            color: white;
            border-bottom: 2px solid #667eea;
            background: rgba(102, 126, 234, 0.2);
        }
        
        .tab-content {
            max-height: 400px;
            overflow-y: auto;
        }
        
        .tab-pane {
            display: none;
            padding: 20px;
        }
        
        .tab-pane.active {
            display: block;
        }
        
        .animation-grid, .sticker-grid { 
            display: grid; 
            grid-template-columns: repeat(3, 1fr); 
            gap: 15px; 
        }
        
        .animation-item, .sticker-item { 
            display: flex; 
            flex-direction: column; 
            align-items: center; 
            padding: 20px 10px; 
            border-radius: 12px; 
            cursor: pointer; 
            transition: all 0.3s ease; 
            border: 2px solid transparent; 
            position: relative; 
            background: rgba(255, 255, 255, 0.05);
            backdrop-filter: blur(10px);
        }
        
        .animation-item:hover, .sticker-item:hover { 
            background: rgba(102, 126, 234, 0.2); 
            transform: translateY(-5px); 
            border-color: #667eea;
            box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
        }
        
        .animation-item.premium-locked, .sticker-item.premium-locked { 
            opacity: 0.5; 
            cursor: not-allowed; 
        }
        
        .animation-item.premium-locked::after, .sticker-item.premium-locked::after { 
            content: '👑'; 
            position: absolute; 
            top: 5px; 
            right: 5px; 
            font-size: 12px; 
        }
        
        .animation-emoji { 
            font-size: 2.5rem; 
            margin-bottom: 10px; 
            filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.3));
        }
        
        .sticker-emoji {
            font-size: 3rem;
            margin-bottom: 10px;
            transition: all 0.3s ease;
            filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.3));
        }
        
        .animation-name, .sticker-name { 
            font-size: 0.85rem; 
            text-align: center; 
            text-transform: capitalize; 
            color: #e2e8f0; 
            font-weight: 500;
        }
        
        .animation-premium-notice { 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            gap: 10px; 
            padding: 15px; 
            background: linear-gradient(135deg, #f6d365 0%, #fda085 100%);
            border-top: 1px solid #f6d365; 
            color: #000; 
            font-weight: bold;
        }
        
        .animation-premium-notice i { 
            color: #ffd700; 
        }
        
        .premium-badge { 
            background: linear-gradient(45deg, #FFD700, #FFA500); 
            color: #000; 
            padding: 8px 15px; 
            border-radius: 20px; 
            font-size: 12px; 
            font-weight: bold; 
            display: inline-flex; 
            align-items: center; 
            gap: 5px; 
            margin: 10px; 
            box-shadow: 0 2px 10px rgba(255, 215, 0, 0.4); 
            z-index: 100; 
        }

        /* Sticker Animations in Library */
        .sticker-item .danceGame { animation: danceGameAnim 2s infinite; }
        .sticker-item .jumpJoy { animation: jumpJoyAnim 2s infinite; }
        .sticker-item .fireworksWin { animation: fireworksWinAnim 2s infinite; }
        .sticker-item .spinCoin { animation: spinCoinAnim 3s infinite linear; }
        .sticker-item .floatPower { animation: floatPowerAnim 2s infinite; }
        .sticker-item .pulseHeart { animation: pulseHeartAnim 1.5s infinite; }
        .sticker-item .bounceBall { animation: bounceBallAnim 2s infinite; }
        .sticker-item .swayFlag { animation: swayFlagAnim 2s infinite; }
        .sticker-item .twinkleStar { animation: twinkleStarAnim 2s infinite; }
        .sticker-item .flutterConfetti { animation: flutterConfettiAnim 2s infinite; }
        .sticker-item .glowAchievement { animation: glowAchievementAnim 2s infinite; }
        .sticker-item .rocketLaunch { animation: rocketLaunchAnim 2s infinite; }

        /* Sticker Animation Keyframes - GAMING THEME */
        @keyframes danceGameAnim {
            0%, 100% { transform: rotate(0deg) scale(1); }
            25% { transform: rotate(-20deg) scale(1.1); }
            75% { transform: rotate(20deg) scale(1.1); }
        }
        
        @keyframes jumpJoyAnim {
            0%, 100% { transform: translateY(0) scale(1); }
            50% { transform: translateY(-20px) scale(1.1); }
        }
        
        @keyframes fireworksWinAnim {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.2); opacity: 0.8; }
        }
        
        @keyframes spinCoinAnim {
            0% { transform: rotateY(0deg) scale(1); }
            50% { transform: rotateY(180deg) scale(1.1); }
            100% { transform: rotateY(360deg) scale(1); }
        }
        
        @keyframes floatPowerAnim {
            0%, 100% { transform: translateY(0) rotate(0deg); }
            50% { transform: translateY(-15px) rotate(10deg); }
        }
        
        @keyframes pulseHeartAnim {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.3); }
        }
        
        @keyframes bounceBallAnim {
            0%, 100% { transform: translateY(0) scale(1); }
            50% { transform: translateY(-15px) scale(1.1); }
        }
        
        @keyframes swayFlagAnim {
            0%, 100% { transform: rotate(-5deg); }
            50% { transform: rotate(5deg); }
        }
        
        @keyframes twinkleStarAnim {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.7; transform: scale(1.1); }
        }
        
        @keyframes flutterConfettiAnim {
            0%, 100% { transform: translateY(0) rotate(0deg); }
            50% { transform: translateY(-10px) rotate(5deg); }
        }
        
        @keyframes glowAchievementAnim {
            0%, 100% { filter: brightness(1) drop-shadow(0 0 5px rgba(255, 215, 0, 0.5)); }
            50% { filter: brightness(1.3) drop-shadow(0 0 15px rgba(255, 215, 0, 0.8)); }
        }
        
        @keyframes rocketLaunchAnim {
            0%, 100% { transform: translateY(0) scale(1); }
            50% { transform: translateY(-15px) scale(1.1); }
        }

        /* Sticker Message Styles with Black Background - FIXED ANIMATIONS */
        .message-sticker {
            background: linear-gradient(135deg, #000000, #222222) !important;
            border-radius: 20px !important;
            padding: 20px 25px !important;
            margin: 10px 0 !important;
            display: inline-block !important;
            max-width: 220px !important;
            text-align: center !important;
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.5) !important;
            border: 3px solid #667eea !important;
            color: white !important;
            text-shadow: 0 0 10px rgba(102, 126, 234, 0.7) !important;
            font-size: 3rem !important;
            animation-duration: 2s !important;
            animation-iteration-count: infinite !important;
            animation-timing-function: ease-in-out !important;
            backdrop-filter: blur(5px);
        }

        /* Sent sticker messages */
        .message.sent .message-sticker {
            background: linear-gradient(135deg, #1a1a2e, #16213e) !important;
            border: 3px solid #764ba2 !important;
            margin-left: auto !important;
            margin-right: 15px !important;
        }

        /* Received sticker messages */
        .message.received .message-sticker {
            background: linear-gradient(135deg, #16213e, #0f3460) !important;
            border: 3px solid #667eea !important;
            margin-left: 15px !important;
            margin-right: auto !important;
        }

        /* Sticker message hover effects */
        .message-sticker:hover {
            transform: scale(1.08) !important;
            transition: transform 0.2s ease !important;
            box-shadow: 0 12px 30px rgba(0, 0, 0, 0.6) !important;
        }

        /* Ensure sticker text/emoji stands out on black background */
        .message-sticker p {
            color: white !important;
            text-shadow: 0 0 15px rgba(102, 126, 234, 0.8) !important;
            margin: 0 !important;
            padding: 0 !important;
        }

        /* Sticker animations - MUST BE PRESERVED */
        .message-sticker.danceGame { animation-name: danceGameAnim !important; }
        .message-sticker.jumpJoy { animation-name: jumpJoyAnim !important; }
        .message-sticker.fireworksWin { animation-name: fireworksWinAnim !important; }
        .message-sticker.spinCoin { animation-name: spinCoinAnim !important; }
        .message-sticker.floatPower { animation-name: floatPowerAnim !important; }
        .message-sticker.pulseHeart { animation-name: pulseHeartAnim !important; }
        .message-sticker.bounceBall { animation-name: bounceBallAnim !important; }
        .message-sticker.swayFlag { animation-name: swayFlagAnim !important; }
        .message-sticker.twinkleStar { animation-name: twinkleStarAnim !important; }
        .message-sticker.flutterConfetti { animation-name: flutterConfettiAnim !important; }
        .message-sticker.glowAchievement { animation-name: glowAchievementAnim !important; }
        .message-sticker.rocketLaunch { animation-name: rocketLaunchAnim !important; }

        /* Sticker message timestamp styling */
        .message.sticker-message .message-time {
            color: #a0aec0 !important;
            font-size: 11px !important;
            margin-top: 8px !important;
            text-align: center !important;
            width: 100% !important;
            text-shadow: 0 1px 2px rgba(0,0,0,0.5);
        }

        /* Make sure sticker messages don't have the normal message background */
        .message[data-message-type="sticker"] {
            background: transparent !important;
        }

        .message[data-message-type="sticker"] .message-content {
            background: transparent !important;
        }

        /* Animation enhancements for stickers on black background */
        .message-sticker {
            filter: drop-shadow(0 0 10px rgba(102, 126, 234, 0.4)) !important;
        }

        .message-sticker.glowAchievement {
            filter: drop-shadow(0 0 20px rgba(255, 215, 0, 0.8)) !important;
        }

        /* Mobile responsiveness for stickers */
        @media (max-width: 768px) {
            .message-sticker {
                max-width: 180px !important;
                padding: 15px 20px !important;
                font-size: 2.5rem !important;
            }
            
            .message.sent .message-sticker {
                margin-right: 8px !important;
            }
            
            .message.received .message-sticker {
                margin-left: 8px !important;
            }
        }

        /* Ensure stickers stand out in the message flow */
        .message.sticker-message {
            margin: 15px 0 !important;
            padding: 8px 0 !important;
        }

        /* Remove any default message backgrounds for stickers */
        .message:has(.message-sticker) {
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
        }

        .message:has(.message-sticker) .message-bubble {
            background: transparent !important;
            border: none !important;
        }

        /* Animation Elements - GAMING THEME */
        .animation-effect { 
            position: fixed; 
            top: 0; 
            left: 0; 
            width: 100%; 
            height: 100%; 
            pointer-events: none; 
            z-index: 9999; 
        }
        
        .gamepad, .trophy, .star, .target, .power, .explosion, .popper, .spell, .vortex, .dice, .fanfare { 
            position: absolute; 
            font-size: 24px; 
            animation: gameFloat 3s ease-in-out forwards; 
            pointer-events: none;
            filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.5));
        }
        
        .sparkle { 
            position: absolute; 
            font-size: 24px; 
            animation: gameSparkle 2s ease-in-out forwards; 
            pointer-events: none;
            filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.5));
        }

        /* Animation Keyframes - GAMING THEME */
        @keyframes gameFloat {
            0% { 
                transform: translateY(100vh) rotate(0deg) scale(0); 
                opacity: 1; 
                filter: brightness(1);
            }
            50% { 
                transform: translateY(50vh) rotate(180deg) scale(1); 
                opacity: 1; 
                filter: brightness(1.5) drop-shadow(0 0 10px currentColor);
            }
            100% { 
                transform: translateY(-100px) rotate(360deg) scale(0); 
                opacity: 0; 
                filter: brightness(1);
            }
        }
        
        @keyframes gameSparkle {
            0% { 
                transform: translateY(100vh) rotate(0deg) scale(0); 
                opacity: 1; 
                filter: brightness(1);
            }
            50% { 
                transform: translateY(50vh) rotate(180deg) scale(1); 
                opacity: 1; 
                filter: brightness(2) drop-shadow(0 0 15px currentColor);
            }
            100% { 
                transform: translateY(-50px) rotate(360deg) scale(0); 
                opacity: 0; 
                filter: brightness(1);
            }
        }
        
        @keyframes magicFloat {
            0% { 
                transform: translateY(100vh) rotate(0deg) scale(0); 
                opacity: 0; 
            }
            50% { 
                transform: translateY(50vh) rotate(180deg) scale(1); 
                opacity: 1; 
            }
            100% { 
                transform: translateY(-100px) rotate(360deg) scale(0); 
                opacity: 0; 
            }
        }
    `;

    const styleSheet = document.createElement('style');
    styleSheet.id = 'animation-styles';
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
}

// Simple notification function if showNotification doesn't exist
if (typeof showNotification === 'undefined') {
    window.showNotification = function(message, type = 'info') {
        // Create a simple notification
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
    };
}

// Enhanced sticker display that runs periodically to catch new messages
function setupStickerEnhancer() {
    // Run immediately
    enhanceStickerDisplay();
    
    // Run every 2 seconds to catch new messages
    setInterval(enhanceStickerDisplay, 2000);
    
    // Also run when new messages are added to the DOM
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.addedNodes.length > 0) {
                enhanceStickerDisplay();
            }
        });
    });
    
    const messagesContainer = document.getElementById('chatMessages');
    if (messagesContainer) {
        observer.observe(messagesContainer, { childList: true, subtree: true });
    }
}

// Initialize sticker enhancer when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(setupStickerEnhancer, 3000);
});

// Clean up when page unloads
window.addEventListener('beforeunload', () => {
    cleanupAnimationListener();
});