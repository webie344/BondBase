// Additional features for Dating Connect App - FIXED VERSION
// Profile picture navigation, love animation library, and animated stickers

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

// Animation library configuration
const ANIMATION_EMOJIS = [
    { emoji: '❤️', name: 'love', animation: 'heartRain' },
    { emoji: '🎈', name: 'balloons', animation: 'balloonPop' },
    { emoji: '💖', name: 'sparkling_heart', animation: 'sparklingHearts' },
    { emoji: '😍', name: 'heart_eyes', animation: 'heartEyes' },
    { emoji: '💕', name: 'two_hearts', animation: 'doubleHearts' },
    { emoji: '💘', name: 'cupid', animation: 'cupidArrow' },
    { emoji: '💝', name: 'gift_heart', animation: 'giftHearts' },
    { emoji: '💓', name: 'beating_heart', animation: 'beatingHeart' },
    { emoji: '💗', name: 'growing_heart', animation: 'growingHeart' },
    { emoji: '💞', name: 'revolving_hearts', animation: 'revolvingHearts' },
    { emoji: '🎉', name: 'party', animation: 'partyCelebration' },
    { emoji: '✨', name: 'sparkles', animation: 'magicSparkles' }
];

// Animated Stickers configuration
const ANIMATED_STICKERS = [
    { name: 'waving_heart', emoji: '👋💖', animation: 'waveHeart', type: 'sticker' },
    { name: 'dancing_love', emoji: '💃❤️', animation: 'danceLove', type: 'sticker' },
    { name: 'kissing_hearts', emoji: '😘💕', animation: 'kissHearts', type: 'sticker' },
    { name: 'jumping_joy', emoji: '🦘✨', animation: 'jumpJoy', type: 'sticker' },
    { name: 'floating_angels', emoji: '😇🌟', animation: 'floatAngels', type: 'sticker' },
    { name: 'spinning_stars', emoji: '⭐️🌀', animation: 'spinStars', type: 'sticker' },
    { name: 'pulsing_love', emoji: '💗📈', animation: 'pulseLove', type: 'sticker' },
    { name: 'bouncing_balls', emoji: '🏀🎾', animation: 'bounceBalls', type: 'sticker' },
    { name: 'swaying_flowers', emoji: '🌷💐', animation: 'swayFlowers', type: 'sticker' },
    { name: 'twinkling_eyes', emoji: '😊✨', animation: 'twinkleEyes', type: 'sticker' },
    { name: 'fluttering_birds', emoji: '🐦💕', animation: 'flutterBirds', type: 'sticker' },
    { name: 'glowing_hearts', emoji: '💖🌟', animation: 'glowHearts', type: 'sticker' }
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
    animationBtn.innerHTML = '<i class="fas fa-magic"></i>';
    animationBtn.title = 'Love Animations & Stickers';
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
                <h3>Love Animations & Stickers</h3>
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
        showNotification('Premium feature: Upgrade to $200 lifetime plan to send love animations', 'warning');
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
    }
}

// Trigger animation based on type
function triggerAnimation(animationType) {
    const effectContainer = document.createElement('div');
    effectContainer.className = 'animation-effect';
    document.body.appendChild(effectContainer);

    switch(animationType) {
        case 'heartRain': createHeartRain(effectContainer); break;
        case 'balloonPop': createBalloonPop(effectContainer); break;
        case 'sparklingHearts': createSparklingHearts(effectContainer); break;
        case 'heartEyes': createHeartEyes(effectContainer); break;
        case 'doubleHearts': createDoubleHearts(effectContainer); break;
        case 'cupidArrow': createCupidArrow(effectContainer); break;
        case 'giftHearts': createGiftHearts(effectContainer); break;
        case 'beatingHeart': createBeatingHeart(effectContainer); break;
        case 'growingHeart': createGrowingHeart(effectContainer); break;
        case 'revolvingHearts': createRevolvingHearts(effectContainer); break;
        case 'partyCelebration': createPartyCelebration(effectContainer); break;
        case 'magicSparkles': createMagicSparkles(effectContainer); break;
        default: createHeartRain(effectContainer);
    }

    setTimeout(() => {
        if (effectContainer.parentNode) {
            effectContainer.parentNode.removeChild(effectContainer);
        }
    }, 5000);
}

// Animation functions (all 12)
function createHeartRain(container) {
    for (let i = 0; i < 50; i++) {
        setTimeout(() => {
            const heart = document.createElement('div');
            heart.className = 'heart';
            heart.innerHTML = '❤️';
            heart.style.left = Math.random() * 100 + 'vw';
            heart.style.fontSize = (Math.random() * 20 + 15) + 'px';
            heart.style.animationDuration = (Math.random() * 2 + 2) + 's';
            container.appendChild(heart);
        }, i * 100);
    }
}

function createBalloonPop(container) {
    for (let i = 0; i < 30; i++) {
        setTimeout(() => {
            const balloon = document.createElement('div');
            balloon.className = 'balloon';
            balloon.style.left = Math.random() * 100 + 'vw';
            balloon.style.background = `hsl(${Math.random() * 360}, 100%, 65%)`;
            balloon.style.animationDuration = (Math.random() * 2 + 3) + 's';
            container.appendChild(balloon);
        }, i * 150);
    }
}

function createSparklingHearts(container) {
    for (let i = 0; i < 40; i++) {
        setTimeout(() => {
            const sparkle = document.createElement('div');
            sparkle.className = 'sparkle';
            sparkle.innerHTML = '💖';
            sparkle.style.left = Math.random() * 100 + 'vw';
            sparkle.style.fontSize = (Math.random() * 20 + 20) + 'px';
            sparkle.style.animationDuration = (Math.random() * 1 + 2) + 's';
            container.appendChild(sparkle);
        }, i * 80);
    }
}

function createHeartEyes(container) {
    for (let i = 0; i < 25; i++) {
        setTimeout(() => {
            const heart = document.createElement('div');
            heart.className = 'heart';
            heart.innerHTML = '😍';
            heart.style.left = Math.random() * 100 + 'vw';
            heart.style.fontSize = (Math.random() * 25 + 25) + 'px';
            heart.style.animationDuration = (Math.random() * 2 + 2.5) + 's';
            container.appendChild(heart);
        }, i * 120);
    }
}

function createDoubleHearts(container) {
    for (let i = 0; i < 35; i++) {
        setTimeout(() => {
            const heart = document.createElement('div');
            heart.className = 'heart';
            heart.innerHTML = Math.random() > 0.5 ? '💕' : '❤️';
            heart.style.left = Math.random() * 100 + 'vw';
            heart.style.fontSize = (Math.random() * 20 + 18) + 'px';
            heart.style.animationDuration = (Math.random() * 2 + 2) + 's';
            container.appendChild(heart);
        }, i * 90);
    }
}

function createCupidArrow(container) {
    for (let i = 0; i < 15; i++) {
        setTimeout(() => {
            const arrow = document.createElement('div');
            arrow.className = 'cupid-arrow';
            arrow.innerHTML = '💘';
            arrow.style.left = Math.random() * 100 + 'vw';
            arrow.style.top = Math.random() * 100 + 'vh';
            arrow.style.animationDuration = (Math.random() * 1 + 2) + 's';
            container.appendChild(arrow);
        }, i * 200);
    }
}

function createGiftHearts(container) {
    for (let i = 0; i < 20; i++) {
        setTimeout(() => {
            const gift = document.createElement('div');
            gift.className = 'gift';
            gift.innerHTML = '💝';
            gift.style.left = Math.random() * 100 + 'vw';
            gift.style.fontSize = (Math.random() * 15 + 20) + 'px';
            gift.style.animationDuration = (Math.random() * 1 + 2.5) + 's';
            container.appendChild(gift);
        }, i * 150);
    }
}

function createBeatingHeart(container) {
    for (let i = 0; i < 20; i++) {
        setTimeout(() => {
            const heart = document.createElement('div');
            heart.className = 'beating-heart';
            heart.innerHTML = '💓';
            heart.style.left = Math.random() * 100 + 'vw';
            heart.style.top = Math.random() * 100 + 'vh';
            heart.style.animationDuration = '1.5s';
            container.appendChild(heart);
        }, i * 200);
    }
}

function createGrowingHeart(container) {
    for (let i = 0; i < 25; i++) {
        setTimeout(() => {
            const heart = document.createElement('div');
            heart.className = 'growing-heart';
            heart.innerHTML = '💗';
            heart.style.left = Math.random() * 100 + 'vw';
            heart.style.top = Math.random() * 100 + 'vh';
            heart.style.animationDuration = (Math.random() * 1 + 2) + 's';
            container.appendChild(heart);
        }, i * 150);
    }
}

function createRevolvingHearts(container) {
    for (let i = 0; i < 18; i++) {
        setTimeout(() => {
            const heart = document.createElement('div');
            heart.className = 'revolving-heart';
            heart.innerHTML = '💞';
            heart.style.left = '50%';
            heart.style.top = '50%';
            heart.style.animationDuration = '3s';
            container.appendChild(heart);
        }, i * 166);
    }
}

function createPartyCelebration(container) {
    for (let i = 0; i < 30; i++) {
        setTimeout(() => {
            const party = document.createElement('div');
            party.className = 'party';
            party.innerHTML = '🎉';
            party.style.left = Math.random() * 100 + 'vw';
            party.style.top = Math.random() * 100 + 'vh';
            party.style.fontSize = (Math.random() * 15 + 15) + 'px';
            party.style.animationDuration = (Math.random() * 1 + 1.5) + 's';
            container.appendChild(party);
        }, i * 100);
    }
}

function createMagicSparkles(container) {
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
            background: var(--accent-color);
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
            background: var(--accent-dark); 
            transform: scale(1.1); 
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
            background: rgba(0,0,0,0.5); 
            z-index: 10000; 
        }
        
        .animation-modal-content { 
            position: absolute; 
            top: 50%; 
            left: 50%; 
            transform: translate(-50%,-50%); 
            background: white; 
            border-radius: 15px; 
            width: 90%; 
            max-width: 500px; 
            max-height: 80vh; 
            overflow: hidden; 
            box-shadow: 0 10px 30px rgba(0,0,0,0.3); 
        }
        
        .animation-modal-header { 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            padding: 20px; 
            border-bottom: 1px solid #eee; 
            background: var(--accent-color); 
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
            border-bottom: 1px solid #eee;
            background: #f8f9fa;
        }
        
        .tab-button {
            flex: 1;
            padding: 12px 20px;
            border: none;
            background: none;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            color: #666;
            transition: all 0.3s ease;
        }
        
        .tab-button.active {
            color: var(--accent-color);
            border-bottom: 2px solid var(--accent-color);
            background: white;
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
            gap: 10px; 
        }
        
        .animation-item, .sticker-item { 
            display: flex; 
            flex-direction: column; 
            align-items: center; 
            padding: 15px 10px; 
            border-radius: 10px; 
            cursor: pointer; 
            transition: all 0.3s ease; 
            border: 2px solid transparent; 
            position: relative; 
        }
        
        .animation-item:hover, .sticker-item:hover { 
            background: #f0f0f0; 
            transform: translateY(-2px); 
        }
        
        .animation-item.premium-locked, .sticker-item.premium-locked { 
            opacity: 0.6; 
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
            font-size: 2rem; 
            margin-bottom: 8px; 
        }
        
        .sticker-emoji {
            font-size: 2.5rem;
            margin-bottom: 8px;
            transition: all 0.3s ease;
        }
        
        .animation-name, .sticker-name { 
            font-size: 0.8rem; 
            text-align: center; 
            text-transform: capitalize; 
            color: #666; 
        }
        
        .animation-premium-notice { 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            gap: 10px; 
            padding: 15px; 
            background: #fff3cd; 
            border-top: 1px solid #ffeaa7; 
            color: #856404; 
        }
        
        .animation-premium-notice i { 
            color: #ffd700; 
        }
        
        .premium-badge { 
            background: linear-gradient(45deg, #FFD700, #FFA500); 
            color: white; 
            padding: 8px 15px; 
            border-radius: 20px; 
            font-size: 12px; 
            font-weight: bold; 
            display: inline-flex; 
            align-items: center; 
            gap: 5px; 
            margin: 10px; 
            box-shadow: 0 2px 5px rgba(0,0,0,0.2); 
            z-index: 100; 
        }

        /* Sticker Animations in Library */
        .sticker-item .waveHeart { animation: waveHeartAnim 2s infinite; }
        .sticker-item .danceLove { animation: danceLoveAnim 2s infinite; }
        .sticker-item .kissHearts { animation: kissHeartsAnim 2s infinite; }
        .sticker-item .jumpJoy { animation: jumpJoyAnim 2s infinite; }
        .sticker-item .floatAngels { animation: floatAngelsAnim 2s infinite; }
        .sticker-item .spinStars { animation: spinStarsAnim 3s infinite linear; }
        .sticker-item .pulseLove { animation: pulseLoveAnim 1.5s infinite; }
        .sticker-item .bounceBalls { animation: bounceBallsAnim 2s infinite; }
        .sticker-item .swayFlowers { animation: swayFlowersAnim 2s infinite; }
        .sticker-item .twinkleEyes { animation: twinkleEyesAnim 2s infinite; }
        .sticker-item .flutterBirds { animation: flutterBirdsAnim 2s infinite; }
        .sticker-item .glowHearts { animation: glowHeartsAnim 2s infinite; }

        /* Sticker Animation Keyframes */
        @keyframes waveHeartAnim {
            0%, 100% { transform: rotate(0deg) scale(1); }
            25% { transform: rotate(-15deg) scale(1.1); }
            75% { transform: rotate(15deg) scale(1.1); }
        }
        
        @keyframes danceLoveAnim {
            0%, 100% { transform: translateY(0) rotate(0deg); }
            25% { transform: translateY(-10px) rotate(-5deg); }
            50% { transform: translateY(0) rotate(0deg); }
            75% { transform: translateY(-10px) rotate(5deg); }
        }
        
        @keyframes kissHeartsAnim {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.2); opacity: 0.8; }
        }
        
        @keyframes jumpJoyAnim {
            0%, 100% { transform: translateY(0) scale(1); }
            50% { transform: translateY(-20px) scale(1.1); }
        }
        
        @keyframes floatAngelsAnim {
            0%, 100% { transform: translateY(0) rotate(0deg); }
            50% { transform: translateY(-15px) rotate(10deg); }
        }
        
        @keyframes spinStarsAnim {
            0% { transform: rotate(0deg) scale(1); }
            100% { transform: rotate(360deg) scale(1); }
        }
        
        @keyframes pulseLoveAnim {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.3); }
        }
        
        @keyframes bounceBallsAnim {
            0%, 100% { transform: translateY(0) scale(1); }
            50% { transform: translateY(-15px) scale(1.1); }
        }
        
        @keyframes swayFlowersAnim {
            0%, 100% { transform: rotate(-5deg); }
            50% { transform: rotate(5deg); }
        }
        
        @keyframes twinkleEyesAnim {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.7; transform: scale(1.1); }
        }
        
        @keyframes flutterBirdsAnim {
            0%, 100% { transform: translateY(0) rotate(0deg); }
            50% { transform: translateY(-10px) rotate(5deg); }
        }
        
        @keyframes glowHeartsAnim {
            0%, 100% { filter: brightness(1) drop-shadow(0 0 5px rgba(255, 64, 129, 0.5)); }
            50% { filter: brightness(1.3) drop-shadow(0 0 15px rgba(255, 64, 129, 0.8)); }
        }

        /* Sticker Message Styles with Black Background - FIXED ANIMATIONS */
        .message-sticker {
            background: #000000 !important;
            border-radius: 20px !important;
            padding: 15px 20px !important;
            margin: 5px 0 !important;
            display: inline-block !important;
            max-width: 200px !important;
            text-align: center !important;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
            border: 2px solid #333 !important;
            color: white !important;
            text-shadow: 0 2px 4px rgba(255, 255, 255, 0.3) !important;
            font-size: 2.5rem !important;
            animation-duration: 2s !important;
            animation-iteration-count: infinite !important;
            animation-timing-function: ease-in-out !important;
        }

        /* Sent sticker messages */
        .message.sent .message-sticker {
            background: linear-gradient(135deg, #000000, #333333) !important;
            border: 2px solid #444 !important;
            margin-left: auto !important;
            margin-right: 10px !important;
        }

        /* Received sticker messages */
        .message.received .message-sticker {
            background: linear-gradient(135deg, #000000, #222222) !important;
            border: 2px solid #555 !important;
            margin-left: 10px !important;
            margin-right: auto !important;
        }

        /* Sticker message hover effects */
        .message-sticker:hover {
            transform: scale(1.05) !important;
            transition: transform 0.2s ease !important;
            box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4) !important;
        }

        /* Ensure sticker text/emoji stands out on black background */
        .message-sticker p {
            color: white !important;
            text-shadow: 0 2px 4px rgba(255, 255, 255, 0.3) !important;
            margin: 0 !important;
            padding: 0 !important;
        }

        /* Sticker animations - MUST BE PRESERVED */
        .message-sticker.waveHeart { animation-name: waveHeartAnim !important; }
        .message-sticker.danceLove { animation-name: danceLoveAnim !important; }
        .message-sticker.kissHearts { animation-name: kissHeartsAnim !important; }
        .message-sticker.jumpJoy { animation-name: jumpJoyAnim !important; }
        .message-sticker.floatAngels { animation-name: floatAngelsAnim !important; }
        .message-sticker.spinStars { animation-name: spinStarsAnim !important; }
        .message-sticker.pulseLove { animation-name: pulseLoveAnim !important; }
        .message-sticker.bounceBalls { animation-name: bounceBallsAnim !important; }
        .message-sticker.swayFlowers { animation-name: swayFlowersAnim !important; }
        .message-sticker.twinkleEyes { animation-name: twinkleEyesAnim !important; }
        .message-sticker.flutterBirds { animation-name: flutterBirdsAnim !important; }
        .message-sticker.glowHearts { animation-name: glowHeartsAnim !important; }

        /* Sticker message timestamp styling */
        .message.sticker-message .message-time {
            color: #888 !important;
            font-size: 11px !important;
            margin-top: 5px !important;
            text-align: center !important;
            width: 100% !important;
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
            filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.1)) !important;
        }

        .message-sticker.glowHearts {
            filter: drop-shadow(0 0 12px rgba(255, 64, 129, 0.6)) !important;
        }

        /* Mobile responsiveness for stickers */
        @media (max-width: 768px) {
            .message-sticker {
                max-width: 150px !important;
                padding: 12px 15px !important;
                font-size: 2rem !important;
            }
            
            .message.sent .message-sticker {
                margin-right: 5px !important;
            }
            
            .message.received .message-sticker {
                margin-left: 5px !important;
            }
        }

        /* Ensure stickers stand out in the message flow */
        .message.sticker-message {
            margin: 10px 0 !important;
            padding: 5px 0 !important;
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

        /* Animation Elements */
        .animation-effect { position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 9999; }
        .heart { position: absolute; color: #ff4081; font-size: 20px; animation: floatUp 3s ease-in-out forwards; }
        .balloon { position: absolute; width: 30px; height: 40px; background: #ff4081; border-radius: 50%; animation: floatUp 4s ease-in-out forwards; }
        .balloon::before { content: ''; position: absolute; bottom: -10px; left: 50%; transform: translateX(-50%); width: 2px; height: 20px; background: #ff4081; }
        .sparkle { position: absolute; font-size: 24px; animation: sparkleSpin 2s ease-in-out forwards; }
        .cupid-arrow { position: absolute; font-size: 30px; animation: cupidFly 2s ease-in-out forwards; }
        .gift { position: absolute; font-size: 25px; animation: giftFall 3s ease-in-out forwards; }
        .beating-heart { position: absolute; font-size: 25px; animation: heartbeat 1.5s ease-in-out infinite; }
        .growing-heart { position: absolute; font-size: 20px; animation: growHeart 2s ease-in-out forwards; }
        .revolving-heart { position: absolute; font-size: 22px; animation: revolve 3s linear infinite; }
        .party { position: absolute; font-size: 20px; animation: partyPop 2s ease-out forwards; }

        /* Animation Keyframes */
        @keyframes floatUp {
            0% { transform: translateY(100vh) scale(0); opacity: 1; }
            100% { transform: translateY(-100px) scale(1); opacity: 0; }
        }
        @keyframes sparkleSpin {
            0% { transform: translateY(100vh) rotate(0deg) scale(0); opacity: 1; }
            50% { transform: translateY(50vh) rotate(180deg) scale(1); opacity: 1; }
            100% { transform: translateY(-50px) rotate(360deg) scale(0); opacity: 0; }
        }
        @keyframes cupidFly {
            0% { transform: translateX(-100px) translateY(100vh) rotate(-45deg); opacity: 0; }
            50% { transform: translateX(50vw) translateY(50vh) rotate(0deg); opacity: 1; }
            100% { transform: translateX(100vw) translateY(-100px) rotate(45deg); opacity: 0; }
        }
        @keyframes giftFall {
            0% { transform: translateY(-100px) scale(0) rotate(0deg); opacity: 0; }
            30% { transform: translateY(50vh) scale(1) rotate(180deg); opacity: 1; }
            100% { transform: translateY(100vh) scale(0.5) rotate(360deg); opacity: 0; }
        }
        @keyframes heartbeat {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.3); }
        }
        @keyframes growHeart {
            0% { transform: scale(0.1); opacity: 0; }
            50% { transform: scale(1.5); opacity: 1; }
            100% { transform: scale(1); opacity: 0; }
        }
        @keyframes revolve {
            0% { transform: rotate(0deg) translateX(50px) rotate(0deg); }
            100% { transform: rotate(360deg) translateX(50px) rotate(-360deg); }
        }
        @keyframes partyPop {
            0% { transform: scale(0) rotate(0deg); opacity: 0; }
            50% { transform: scale(1.2) rotate(180deg); opacity: 1; }
            100% { transform: scale(1) rotate(360deg); opacity: 0; }
        }
        @keyframes magicFloat {
            0% { transform: translateY(100vh) rotate(0deg) scale(0); opacity: 0; }
            50% { transform: translateY(50vh) rotate(180deg) scale(1); opacity: 1; }
            100% { transform: translateY(-100px) rotate(360deg) scale(0); opacity: 0; }
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
            background: ${type === 'error' ? '#f44336' : type === 'success' ? '#4CAF50' : '#2196F3'};
            color: white;
            padding: 15px 20px;
            border-radius: 5px;
            z-index: 10000;
            max-width: 300px;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
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