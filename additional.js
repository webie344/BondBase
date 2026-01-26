// Additional features for Dating Connect App - PROFESSIONAL STICKERS VERSION
// Profile picture navigation, animation library, and animated stickers

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

// REAL-LIFE ANIMATIONS - WhatsApp style
const ANIMATION_EMOJIS = [
    { emoji: '❤️', name: 'heart_love', animation: 'heartLove' },
    { emoji: '😊', name: 'smile_blush', animation: 'smileBlush' },
    { emoji: '😂', name: 'laughing', animation: 'laughingTears' },
    { emoji: '😍', name: 'heart_eyes', animation: 'heartEyes' },
    { emoji: '🤗', name: 'hugging', animation: 'huggingFace' },
    { emoji: '😘', name: 'kiss_heart', animation: 'kissHeart' },
    { emoji: '🥰', name: 'smiling_hearts', animation: 'smilingHearts' },
    { emoji: '😇', name: 'angel_halo', animation: 'angelHalo' },
    { emoji: '🤩', name: 'star_struck', animation: 'starStruck' },
    { emoji: '🥺', name: 'pleading_face', animation: 'pleadingFace' },
    { emoji: '🤭', name: 'hand_mouth', animation: 'handOverMouth' },
    { emoji: '🙏', name: 'praying_hands', animation: 'prayingHands' }
];

// PROFESSIONAL ANIMATED STICKERS - Real-life expressions
const ANIMATED_STICKERS = [
    { name: 'love_heart', emoji: '❤️', animation: 'loveHeart', type: 'sticker' },
    { name: 'wink_kiss', emoji: '😉💋', animation: 'winkKiss', type: 'sticker' },
    { name: 'happy_dance', emoji: '💃😄', animation: 'happyDance', type: 'sticker' },
    { name: 'thinking_face', emoji: '🤔💭', animation: 'thinkingFace', type: 'sticker' },
    { name: 'coffee_love', emoji: '☕❤️', animation: 'coffeeLove', type: 'sticker' },
    { name: 'music_vibes', emoji: '🎵🎶', animation: 'musicVibes', type: 'sticker' },
    { name: 'thumbs_up', emoji: '👍👌', animation: 'thumbsUp', type: 'sticker' },
    { name: 'rainbow_heart', emoji: '🌈❤️', animation: 'rainbowHeart', type: 'sticker' },
    { name: 'night_sky', emoji: '🌙✨', animation: 'nightSky', type: 'sticker' },
    { name: 'camera_flash', emoji: '📸✨', animation: 'cameraFlash', type: 'sticker' },
    { name: 'gift_heart', emoji: '🎁❤️', animation: 'giftHeart', type: 'sticker' },
    { name: 'message_bubble', emoji: '💬💭', animation: 'messageBubble', type: 'sticker' }
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
    animationBtn.innerHTML = '<i class="fas fa-smile"></i>';
    animationBtn.title = 'Expressions & Stickers';
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
                <h3>Expressions & Stickers</h3>
                <button class="close-animation-modal">&times;</button>
            </div>
            <div class="animation-tabs">
                <button class="tab-button active" data-tab="animations">Reactions</button>
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
                <p>Premium feature: Upgrade to send animations & stickers</p>
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
        showNotification('Premium feature: Upgrade to send animations', 'warning');
        return;
    }

    try {
        const animationData = ANIMATION_EMOJIS.find(anim => anim.animation === animationType);
        if (!animationData) return;

        await sendAnimationMessage(animationData);
        closeAnimationLibrary();
        showNotification('Reaction sent!', 'success');
    } catch (error) {
        showNotification('Error sending animation', 'error');
    }
}

// Select sticker
async function selectSticker(stickerType) {
    if (!userHasPremium) {
        showNotification('Premium feature: Upgrade to send stickers', 'warning');
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
            text: `Sent ${animationData.name.replace('_', ' ')} reaction`,
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
                text: `Sent ${animationData.name.replace('_', ' ')} reaction`,
                senderId: currentUser.uid,
                timestamp: serverTimestamp()
            },
            updatedAt: serverTimestamp()
        }, { merge: true });

    } catch (error) {
        throw error;
    }
}

// Send sticker message
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
            text: stickerData.emoji,
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

// Deduct chat points function
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
                            showNotification(`${message.emoji} ${message.animationName} received!`, 'info');
                        } else if (message.type === 'sticker') {
                            showNotification(`${message.emoji} ${message.stickerName} sticker received!`, 'info');
                        }
                    }
                }
            }
        });
    });
}

// Enhanced sticker display that works with app.js
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
                    
                    // Add sticker classes
                    messageText.classList.add('message-sticker', sticker.animation);
                    message.classList.add('sticker-message');
                    
                    // Add data attribute for easier CSS targeting
                    message.setAttribute('data-message-type', 'sticker');
                    
                    // Apply styles
                    messageText.style.display = 'inline-block';
                    messageText.style.textAlign = 'center';
                    messageText.style.margin = '5px 0';
                    
                    // Positioning
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
        case 'heartLove': createHeartLove(effectContainer); break;
        case 'smileBlush': createSmileBlush(effectContainer); break;
        case 'laughingTears': createLaughingTears(effectContainer); break;
        case 'heartEyes': createHeartEyes(effectContainer); break;
        case 'huggingFace': createHuggingFace(effectContainer); break;
        case 'kissHeart': createKissHeart(effectContainer); break;
        case 'smilingHearts': createSmilingHearts(effectContainer); break;
        case 'angelHalo': createAngelHalo(effectContainer); break;
        case 'starStruck': createStarStruck(effectContainer); break;
        case 'pleadingFace': createPleadingFace(effectContainer); break;
        case 'handOverMouth': createHandOverMouth(effectContainer); break;
        case 'prayingHands': createPrayingHands(effectContainer); break;
        default: createHeartLove(effectContainer);
    }

    setTimeout(() => {
        if (effectContainer.parentNode) {
            effectContainer.parentNode.removeChild(effectContainer);
        }
    }, 4000);
}

// REAL-LIFE ANIMATION FUNCTIONS
function createHeartLove(container) {
    for (let i = 0; i < 20; i++) {
        setTimeout(() => {
            const heart = document.createElement('div');
            heart.className = 'heart';
            heart.innerHTML = '❤️';
            heart.style.left = Math.random() * 100 + 'vw';
            heart.style.fontSize = (Math.random() * 25 + 20) + 'px';
            heart.style.animationDuration = (Math.random() * 2 + 3) + 's';
            container.appendChild(heart);
        }, i * 150);
    }
}

function createSmileBlush(container) {
    for (let i = 0; i < 15; i++) {
        setTimeout(() => {
            const smile = document.createElement('div');
            smile.className = 'smile';
            smile.innerHTML = '😊';
            smile.style.left = Math.random() * 100 + 'vw';
            smile.style.fontSize = (Math.random() * 20 + 25) + 'px';
            smile.style.animationDuration = (Math.random() * 2 + 2.5) + 's';
            container.appendChild(smile);
        }, i * 200);
    }
}

function createLaughingTears(container) {
    for (let i = 0; i < 12; i++) {
        setTimeout(() => {
            const laugh = document.createElement('div');
            laugh.className = 'laugh';
            laugh.innerHTML = '😂';
            laugh.style.left = Math.random() * 100 + 'vw';
            laugh.style.fontSize = (Math.random() * 20 + 30) + 'px';
            laugh.style.animationDuration = (Math.random() * 2 + 2) + 's';
            container.appendChild(laugh);
        }, i * 250);
    }
}

function createHeartEyes(container) {
    for (let i = 0; i < 18; i++) {
        setTimeout(() => {
            const heartEye = document.createElement('div');
            heartEye.className = 'heart-eye';
            heartEye.innerHTML = '😍';
            heartEye.style.left = Math.random() * 100 + 'vw';
            heartEye.style.fontSize = (Math.random() * 20 + 25) + 'px';
            heartEye.style.animationDuration = (Math.random() * 2 + 2.5) + 's';
            container.appendChild(heartEye);
        }, i * 180);
    }
}

function createHuggingFace(container) {
    for (let i = 0; i < 16; i++) {
        setTimeout(() => {
            const hug = document.createElement('div');
            hug.className = 'hug';
            hug.innerHTML = '🤗';
            hug.style.left = Math.random() * 100 + 'vw';
            hug.style.fontSize = (Math.random() * 20 + 28) + 'px';
            hug.style.animationDuration = (Math.random() * 2 + 2.5) + 's';
            container.appendChild(hug);
        }, i * 220);
    }
}

function createKissHeart(container) {
    for (let i = 0; i < 20; i++) {
        setTimeout(() => {
            const kiss = document.createElement('div');
            kiss.className = 'kiss';
            kiss.innerHTML = '😘';
            kiss.style.left = Math.random() * 100 + 'vw';
            kiss.style.fontSize = (Math.random() * 20 + 22) + 'px';
            kiss.style.animationDuration = (Math.random() * 1 + 2) + 's';
            container.appendChild(kiss);
        }, i * 150);
    }
}

function createSmilingHearts(container) {
    for (let i = 0; i < 25; i++) {
        setTimeout(() => {
            const smileHeart = document.createElement('div');
            smileHeart.className = 'smile-heart';
            smileHeart.innerHTML = '🥰';
            smileHeart.style.left = Math.random() * 100 + 'vw';
            smileHeart.style.fontSize = (Math.random() * 20 + 20) + 'px';
            smileHeart.style.animationDuration = (Math.random() * 2 + 2) + 's';
            container.appendChild(smileHeart);
        }, i * 120);
    }
}

function createAngelHalo(container) {
    for (let i = 0; i < 15; i++) {
        setTimeout(() => {
            const angel = document.createElement('div');
            angel.className = 'angel';
            angel.innerHTML = '😇';
            angel.style.left = Math.random() * 100 + 'vw';
            angel.style.fontSize = (Math.random() * 20 + 24) + 'px';
            angel.style.animationDuration = (Math.random() * 2 + 3) + 's';
            container.appendChild(angel);
        }, i * 200);
    }
}

function createStarStruck(container) {
    for (let i = 0; i < 30; i++) {
        setTimeout(() => {
            const star = document.createElement('div');
            star.className = 'star';
            star.innerHTML = '🤩';
            star.style.left = Math.random() * 100 + 'vw';
            star.style.fontSize = (Math.random() * 15 + 20) + 'px';
            star.style.animationDuration = (Math.random() * 1 + 2) + 's';
            container.appendChild(star);
        }, i * 100);
    }
}

function createPleadingFace(container) {
    for (let i = 0; i < 18; i++) {
        setTimeout(() => {
            const plead = document.createElement('div');
            plead.className = 'plead';
            plead.innerHTML = '🥺';
            plead.style.left = Math.random() * 100 + 'vw';
            plead.style.fontSize = (Math.random() * 20 + 22) + 'px';
            plead.style.animationDuration = (Math.random() * 2 + 2.5) + 's';
            container.appendChild(plead);
        }, i * 180);
    }
}

function createHandOverMouth(container) {
    for (let i = 0; i < 15; i++) {
        setTimeout(() => {
            const hand = document.createElement('div');
            hand.className = 'hand';
            hand.innerHTML = '🤭';
            hand.style.left = Math.random() * 100 + 'vw';
            hand.style.fontSize = (Math.random() * 20 + 25) + 'px';
            hand.style.animationDuration = (Math.random() * 2 + 2) + 's';
            container.appendChild(hand);
        }, i * 200);
    }
}

function createPrayingHands(container) {
    for (let i = 0; i < 12; i++) {
        setTimeout(() => {
            const pray = document.createElement('div');
            pray.className = 'pray';
            pray.innerHTML = '🙏';
            pray.style.left = Math.random() * 100 + 'vw';
            pray.style.fontSize = (Math.random() * 20 + 28) + 'px';
            pray.style.animationDuration = (Math.random() * 2 + 3) + 's';
            container.appendChild(pray);
        }, i * 250);
    }
}

// Load animation styles with improved design
function loadAnimationStyles() {
    if (document.getElementById('animation-styles')) return;

    const styles = `
        /* Animation Library Styles - PROFESSIONAL DESIGN */
        .chat-input-container {
            transition: all 0.3s ease;
        }
        
        .animation-btn {
            background: linear-gradient(135deg, #FF6B8B 0%, #FF8E53 100%);
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
            background: linear-gradient(135deg, #FF8E53 0%, #FF6B8B 100%);
            transform: scale(1.1); 
            box-shadow: 0 5px 15px rgba(255, 107, 139, 0.4);
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
            background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
            border-radius: 20px; 
            width: 90%; 
            max-width: 500px; 
            max-height: 80vh; 
            overflow: hidden; 
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            border: 2px solid #FF6B8B;
        }
        
        .animation-modal-header { 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            padding: 20px; 
            border-bottom: 1px solid #e8e8e8; 
            background: linear-gradient(135deg, #FF6B8B 0%, #FF8E53 100%);
            color: white; 
        }
        
        .animation-modal-header h3 { 
            margin: 0; 
            font-size: 1.2rem; 
            font-weight: 600;
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
            border-bottom: 1px solid #e8e8e8;
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
            color: #6c757d;
            transition: all 0.3s ease;
        }
        
        .tab-button.active {
            color: #FF6B8B;
            border-bottom: 2px solid #FF6B8B;
            background: white;
        }
        
        .tab-content {
            max-height: 400px;
            overflow-y: auto;
            background: white;
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
            border-radius: 15px; 
            cursor: pointer; 
            transition: all 0.3s ease; 
            border: 2px solid transparent; 
            position: relative; 
            background: #f8f9fa;
        }
        
        .animation-item:hover, .sticker-item:hover { 
            background: #FF6B8B15; 
            transform: translateY(-5px); 
            border-color: #FF6B8B;
            box-shadow: 0 10px 20px rgba(255, 107, 139, 0.15);
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
        }
        
        .sticker-emoji {
            font-size: 3rem;
            margin-bottom: 10px;
            transition: all 0.3s ease;
        }
        
        .animation-name, .sticker-name { 
            font-size: 0.85rem; 
            text-align: center; 
            text-transform: capitalize; 
            color: #495057; 
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
            background: linear-gradient(45deg, #FF6B8B, #FF8E53); 
            color: white; 
            padding: 8px 15px; 
            border-radius: 20px; 
            font-size: 12px; 
            font-weight: 600; 
            display: inline-flex; 
            align-items: center; 
            gap: 5px; 
            margin: 10px; 
            box-shadow: 0 2px 10px rgba(255, 107, 139, 0.4); 
            z-index: 100; 
        }

        /* Sticker Animations in Library */
        .sticker-item .loveHeart { animation: loveHeartAnim 2s infinite; }
        .sticker-item .winkKiss { animation: winkKissAnim 2s infinite; }
        .sticker-item .happyDance { animation: happyDanceAnim 2s infinite; }
        .sticker-item .thinkingFace { animation: thinkingFaceAnim 2s infinite; }
        .sticker-item .coffeeLove { animation: coffeeLoveAnim 3s infinite linear; }
        .sticker-item .musicVibes { animation: musicVibesAnim 2s infinite; }
        .sticker-item .thumbsUp { animation: thumbsUpAnim 1.5s infinite; }
        .sticker-item .rainbowHeart { animation: rainbowHeartAnim 2s infinite; }
        .sticker-item .nightSky { animation: nightSkyAnim 2s infinite; }
        .sticker-item .cameraFlash { animation: cameraFlashAnim 2s infinite; }
        .sticker-item .giftHeart { animation: giftHeartAnim 2s infinite; }
        .sticker-item .messageBubble { animation: messageBubbleAnim 2s infinite; }

        /* Sticker Animation Keyframes - REAL LIFE THEME */
        @keyframes loveHeartAnim {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.2); }
        }
        
        @keyframes winkKissAnim {
            0%, 100% { transform: rotate(0deg) scale(1); }
            50% { transform: rotate(-10deg) scale(1.1); }
        }
        
        @keyframes happyDanceAnim {
            0%, 100% { transform: translateY(0) rotate(0deg); }
            25% { transform: translateY(-10px) rotate(-5deg); }
            75% { transform: translateY(-10px) rotate(5deg); }
        }
        
        @keyframes thinkingFaceAnim {
            0%, 100% { transform: rotate(0deg); }
            25% { transform: rotate(-5deg); }
            75% { transform: rotate(5deg); }
        }
        
        @keyframes coffeeLoveAnim {
            0% { transform: rotateY(0deg) scale(1); }
            50% { transform: rotateY(180deg) scale(1.1); }
            100% { transform: rotateY(360deg) scale(1); }
        }
        
        @keyframes musicVibesAnim {
            0%, 100% { transform: translateY(0) scale(1); }
            50% { transform: translateY(-5px) scale(1.1); }
        }
        
        @keyframes thumbsUpAnim {
            0%, 100% { transform: scale(1) rotate(0deg); }
            50% { transform: scale(1.2) rotate(5deg); }
        }
        
        @keyframes rainbowHeartAnim {
            0%, 100% { transform: scale(1); filter: brightness(1); }
            50% { transform: scale(1.1); filter: brightness(1.2); }
        }
        
        @keyframes nightSkyAnim {
            0%, 100% { transform: rotate(0deg) scale(1); }
            50% { transform: rotate(10deg) scale(1.1); }
        }
        
        @keyframes cameraFlashAnim {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.2); opacity: 0.8; }
        }
        
        @keyframes giftHeartAnim {
            0%, 100% { transform: translateY(0) scale(1); }
            50% { transform: translateY(-10px) scale(1.1); }
        }
        
        @keyframes messageBubbleAnim {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
        }

        /* Sticker Message Styles - PROFESSIONAL WHATSAPP STYLE */
        .message-sticker {
            background: white !important;
            border-radius: 18px !important;
            padding: 15px 20px !important;
            margin: 10px 0 !important;
            display: inline-block !important;
            max-width: 200px !important;
            text-align: center !important;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1) !important;
            border: 2px solid #FF6B8B !important;
            font-size: 2.5rem !important;
            animation-duration: 2s !important;
            animation-iteration-count: infinite !important;
            animation-timing-function: ease-in-out !important;
        }

        /* Sent sticker messages */
        .message.sent .message-sticker {
            background: linear-gradient(135deg, #FF6B8B, #FF8E53) !important;
            border: 2px solid #FF8E53 !important;
            margin-left: auto !important;
            margin-right: 15px !important;
            color: white !important;
        }

        /* Received sticker messages */
        .message.received .message-sticker {
            background: white !important;
            border: 2px solid #e8e8e8 !important;
            margin-left: 15px !important;
            margin-right: auto !important;
        }

        /* Sticker message hover effects */
        .message-sticker:hover {
            transform: scale(1.05) !important;
            transition: transform 0.2s ease !important;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
        }

        /* Sticker animations */
        .message-sticker.loveHeart { animation-name: loveHeartAnim !important; }
        .message-sticker.winkKiss { animation-name: winkKissAnim !important; }
        .message-sticker.happyDance { animation-name: happyDanceAnim !important; }
        .message-sticker.thinkingFace { animation-name: thinkingFaceAnim !important; }
        .message-sticker.coffeeLove { animation-name: coffeeLoveAnim !important; }
        .message-sticker.musicVibes { animation-name: musicVibesAnim !important; }
        .message-sticker.thumbsUp { animation-name: thumbsUpAnim !important; }
        .message-sticker.rainbowHeart { animation-name: rainbowHeartAnim !important; }
        .message-sticker.nightSky { animation-name: nightSkyAnim !important; }
        .message-sticker.cameraFlash { animation-name: cameraFlashAnim !important; }
        .message-sticker.giftHeart { animation-name: giftHeartAnim !important; }
        .message-sticker.messageBubble { animation-name: messageBubbleAnim !important; }

        /* Sticker message timestamp styling */
        .message.sticker-message .message-time {
            color: #6c757d !important;
            font-size: 11px !important;
            margin-top: 8px !important;
            text-align: center !important;
            width: 100% !important;
        }

        /* Animation Elements - REAL LIFE THEME */
        .animation-effect { 
            position: fixed; 
            top: 0; 
            left: 0; 
            width: 100%; 
            height: 100%; 
            pointer-events: none; 
            z-index: 9999; 
        }
        
        .heart, .smile, .laugh, .heart-eye, .hug, .kiss, .smile-heart, .angel, .star, .plead, .hand, .pray { 
            position: absolute; 
            font-size: 24px; 
            animation: floatAnim 3s ease-in-out forwards; 
            pointer-events: none;
        }
        
        /* Animation Keyframes - REAL LIFE THEME */
        @keyframes floatAnim {
            0% { 
                transform: translateY(100vh) rotate(0deg) scale(0); 
                opacity: 1; 
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
        
        /* Mobile responsiveness for stickers */
        @media (max-width: 768px) {
            .message-sticker {
                max-width: 160px !important;
                padding: 12px 15px !important;
                font-size: 2rem !important;
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