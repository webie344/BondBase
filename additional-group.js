// additional-group.js - Gaming animations and stickers for Group Chat
// Works with group.js - THEME: Free Fire, COD Mobile, and gaming power-ups
// FIXED: Premium checking matches additional.js exactly

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

// Firebase configuration (same as your group.js)
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

// GAMING THEME: Free Fire, COD Mobile, Power-ups
const GAMING_ANIMATIONS = [
    { emoji: '🔥', name: 'fire_strike', animation: 'fireStrike' },
    { emoji: '🎯', name: 'headshot', animation: 'headshotEffect' },
    { emoji: '⚔️', name: 'sword_slash', animation: 'swordSlash' },
    { emoji: '🛡️', name: 'shield_up', animation: 'shieldUp' },
    { emoji: '💣', name: 'grenade', animation: 'grenadeExplosion' },
    { emoji: '🏃‍♂️', name: 'speed_boost', animation: 'speedBoost' },
    { emoji: '🎖️', name: 'rank_up', animation: 'rankUp' },
    { emoji: '💰', name: 'coin_rain', animation: 'coinRain' },
    { emoji: '🎮', name: 'combo_attack', animation: 'comboAttack' },
    { emoji: '🩸', name: 'damage_hit', animation: 'damageHit' },
    { emoji: '🚁', name: 'airdrop', animation: 'airdropFall' },
    { emoji: '🏹', name: 'arrow_shot', animation: 'arrowShot' },
    { emoji: '💀', name: 'kill_feed', animation: 'killFeed' },
    { emoji: '🏃‍♀️', name: 'sprint', animation: 'sprintEffect' },
    { emoji: '🎪', name: 'victory_royale', animation: 'victoryRoyale' }
];

// GAMING STICKERS: Animated gaming stickers
const GAMING_STICKERS = [
    { name: 'free_fire_dance', emoji: '🔥💃', animation: 'freeFireDance', type: 'sticker' },
    { name: 'codm_headshot', emoji: '🎯💥', animation: 'codmHeadshot', type: 'sticker' },
    { name: 'power_up_glow', emoji: '⚡🌟', animation: 'powerUpGlow', type: 'sticker' },
    { name: 'weapon_reload', emoji: '🔫🌀', animation: 'weaponReload', type: 'sticker' },
    { name: 'victory_dance', emoji: '🏆🕺', animation: 'victoryDance', type: 'sticker' },
    { name: 'game_over', emoji: '💀🎮', animation: 'gameOver', type: 'sticker' },
    { name: 'healing_potion', emoji: '🧪💚', animation: 'healingPotion', type: 'sticker' },
    { name: 'sniper_scope', emoji: '🔭🎯', animation: 'sniperScope', type: 'sticker' },
    { name: 'double_kill', emoji: '⚔️⚔️', animation: 'doubleKill', type: 'sticker' },
    { name: 'speed_run', emoji: '🏃‍♂️💨', animation: 'speedRun', type: 'sticker' },
    { name: 'shield_block', emoji: '🛡️💥', animation: 'shieldBlock', type: 'sticker' },
    { name: 'airdrop_open', emoji: '🚁📦', animation: 'airdropOpen', type: 'sticker' }
];

// Global variables
let animationLibraryOpen = false;
let userHasPremium = false;
let currentUser = null;
let currentGroupId = null;
let playedAnimations = new Set();
let animationListenerUnsubscribe = null;
let lastProcessedMessageTime = 0;

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    loadGamingAnimationStyles();
    
    // Load played animations from localStorage
    loadPlayedAnimations();
    
    // Set up auth state listener
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            initializeGroupFeatures();
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
        const stored = localStorage.getItem('gamingPlayedAnimations');
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
        localStorage.setItem('gamingPlayedAnimations', JSON.stringify(data));
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
function initializeGroupFeatures() {
    // Get group ID from URL if on group page
    if (window.location.pathname.includes('group.html')) {
        const urlParams = new URLSearchParams(window.location.search);
        currentGroupId = urlParams.get('id');
    }
    
    initGroupAnimationLibrary();
    checkPremiumStatus();
    
    // Set up animation listener for group page
    if (window.location.pathname.includes('group.html') && currentGroupId) {
        setTimeout(() => {
            setupGroupAnimationListener();
        }, 2000);
    }
}

// Initialize animation library for group chat
function initGroupAnimationLibrary() {
    if (window.location.pathname.includes('group.html')) {
        addGroupAnimationButton();
        createGroupAnimationModal();
        setupGroupInputFocusHandling();
    }
}

// Add animation library button for group chat
function addGroupAnimationButton() {
    const messageInputContainer = document.querySelector('.message-input-container');
    if (!messageInputContainer) {
        setTimeout(addGroupAnimationButton, 1000);
        return;
    }

    // Remove existing button if any
    const existingBtn = document.getElementById('groupAnimationBtn');
    if (existingBtn) {
        existingBtn.remove();
    }

    const animationBtn = document.createElement('button');
    animationBtn.id = 'groupAnimationBtn';
    animationBtn.className = 'gaming-animation-btn';
    animationBtn.innerHTML = '<i class="fas fa-gamepad"></i>';
    animationBtn.title = 'Game Animations & Stickers';
    animationBtn.addEventListener('click', toggleGroupAnimationLibrary);

    // Insert at the beginning of the input container
    const messageInput = document.getElementById('messageInput');
    if (messageInput && messageInput.parentNode === messageInputContainer) {
        messageInputContainer.insertBefore(animationBtn, messageInput);
    } else {
        messageInputContainer.insertBefore(animationBtn, messageInputContainer.firstChild);
    }
}

// Set up input focus handling for group chat
function setupGroupInputFocusHandling() {
    const messageInput = document.getElementById('messageInput');
    const animationBtn = document.getElementById('groupAnimationBtn');
    
    if (!messageInput || !animationBtn) {
        setTimeout(setupGroupInputFocusHandling, 1000);
        return;
    }

    // Add focus event to hide animation button
    messageInput.addEventListener('focus', () => {
        animationBtn.style.display = 'none';
        // Expand input width when focused
        messageInput.style.width = 'calc(100% - 120px)';
    });

    // Add blur event to show animation button
    messageInput.addEventListener('blur', () => {
        setTimeout(() => {
            animationBtn.style.display = 'flex';
            // Shrink input width when not focused
            messageInput.style.width = 'calc(100% - 170px)';
        }, 100);
    });

    // Initial setup
    animationBtn.style.display = 'flex';
    messageInput.style.width = 'calc(100% - 170px)';
    messageInput.style.transition = 'width 0.3s ease';
}

// Create animation library modal for group chat
function createGroupAnimationModal() {
    if (document.getElementById('groupAnimationLibraryModal')) return;

    const modal = document.createElement('div');
    modal.id = 'groupAnimationLibraryModal';
    modal.className = 'gaming-animation-modal';
    modal.innerHTML = `
        <div class="gaming-animation-modal-content">
            <div class="gaming-animation-modal-header">
                <h3><i class="fas fa-gamepad"></i> Game Animations & Stickers</h3>
                <button class="close-group-animation-modal">&times;</button>
            </div>
            <div class="gaming-animation-tabs">
                <button class="gaming-tab-button active" data-tab="animations">
                    <i class="fas fa-bolt"></i> Animations
                </button>
                <button class="gaming-tab-button" data-tab="stickers">
                    <i class="fas fa-sticky-note"></i> Stickers
                </button>
            </div>
            <div class="gaming-tab-content">
                <div class="gaming-tab-pane active" id="animations-tab">
                    <div class="gaming-animation-grid">
                        ${GAMING_ANIMATIONS.map(anim => `
                            <div class="gaming-animation-item" data-type="animation" data-animation="${anim.animation}">
                                <span class="gaming-animation-emoji">${anim.emoji}</span>
                                <span class="gaming-animation-name">${anim.name.replace('_', ' ')}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="gaming-tab-pane" id="stickers-tab">
                    <div class="gaming-sticker-grid">
                        ${GAMING_STICKERS.map(sticker => `
                            <div class="gaming-sticker-item" data-type="sticker" data-sticker="${sticker.animation}">
                                <div class="gaming-sticker-emoji ${sticker.animation}">${sticker.emoji}</div>
                                <span class="gaming-sticker-name">${sticker.name.replace('_', ' ')}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
            <div class="gaming-animation-premium-notice" id="groupPremiumNotice" style="display: none;">
                <i class="fas fa-crown"></i>
                <p>Premium feature: Upgrade to send gaming animations & stickers</p>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Tab functionality
    const tabButtons = modal.querySelectorAll('.gaming-tab-button');
    const tabPanes = modal.querySelectorAll('.gaming-tab-pane');
    
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

    modal.querySelector('.close-group-animation-modal').addEventListener('click', closeGroupAnimationLibrary);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeGroupAnimationLibrary();
    });

    // Animation items
    const animationItems = modal.querySelectorAll('.gaming-animation-item');
    animationItems.forEach(item => {
        item.addEventListener('click', () => selectGroupAnimation(item.dataset.animation));
    });

    // Sticker items
    const stickerItems = modal.querySelectorAll('.gaming-sticker-item');
    stickerItems.forEach(item => {
        item.addEventListener('click', () => selectGroupSticker(item.dataset.sticker));
    });
}

// Toggle animation library for group chat
function toggleGroupAnimationLibrary() {
    const modal = document.getElementById('groupAnimationLibraryModal');
    if (!modal) return;

    if (animationLibraryOpen) {
        closeGroupAnimationLibrary();
    } else {
        openGroupAnimationLibrary();
    }
}

// Open animation library for group chat
function openGroupAnimationLibrary() {
    const modal = document.getElementById('groupAnimationLibraryModal');
    if (!modal) return;

    modal.style.display = 'flex';
    animationLibraryOpen = true;

    const premiumNotice = document.getElementById('groupPremiumNotice');
    if (premiumNotice) {
        premiumNotice.style.display = userHasPremium ? 'none' : 'flex';
    }

    const animationItems = document.querySelectorAll('.gaming-animation-item');
    const stickerItems = document.querySelectorAll('.gaming-sticker-item');
    
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

// Close animation library for group chat
function closeGroupAnimationLibrary() {
    const modal = document.getElementById('groupAnimationLibraryModal');
    if (!modal) return;

    modal.style.display = 'none';
    animationLibraryOpen = false;
}

// Select animation for group chat
async function selectGroupAnimation(animationType) {
    if (!userHasPremium) {
        showGamingNotification('Premium feature: Upgrade to send gaming animations', 'warning');
        return;
    }

    if (!currentGroupId) {
        showGamingNotification('No active group chat', 'error');
        return;
    }

    try {
        const animationData = GAMING_ANIMATIONS.find(anim => anim.animation === animationType);
        if (!animationData) return;

        await sendGroupAnimationMessage(animationData);
        closeGroupAnimationLibrary();
        showGamingNotification('Gaming animation sent!', 'success');
    } catch (error) {
        showGamingNotification('Error sending animation', 'error');
    }
}

// Select sticker for group chat
async function selectGroupSticker(stickerType) {
    if (!userHasPremium) {
        showGamingNotification('Premium feature: Upgrade to send gaming stickers', 'warning');
        return;
    }

    if (!currentGroupId) {
        showGamingNotification('No active group chat', 'error');
        return;
    }

    try {
        const stickerData = GAMING_STICKERS.find(sticker => sticker.animation === stickerType);
        if (!stickerData) return;

        await sendGroupStickerMessage(stickerData);
        closeGroupAnimationLibrary();
        showGamingNotification('Gaming sticker sent!', 'success');
    } catch (error) {
        showGamingNotification('Error sending sticker', 'error');
    }
}

// Send animation message to group
async function sendGroupAnimationMessage(animationData) {
    if (!currentUser || !currentGroupId) {
        return;
    }

    try {
        // Get user profile from groupChat
        const userProfile = window.groupChat?.currentUser || { name: 'User', avatar: '' };
        
        // Send through groupChat system
        await window.groupChat.sendMessage(
            currentGroupId,
            `${animationData.emoji} Sent ${animationData.name.replace('_', ' ')} animation`,
            null,
            null,
            window.groupChat.replyingToMessage?.id
        );

    } catch (error) {
        throw error;
    }
}

// Send sticker message to group
async function sendGroupStickerMessage(stickerData) {
    if (!currentUser || !currentGroupId) {
        return;
    }

    try {
        // Get user profile from groupChat
        const userProfile = window.groupChat?.currentUser || { name: 'User', avatar: '' };
        
        // Send through groupChat system
        await window.groupChat.sendMessage(
            currentGroupId,
            stickerData.emoji,
            null,
            null,
            window.groupChat.replyingToMessage?.id
        );

    } catch (error) {
        throw error;
    }
}

// Generate unique message ID for tracking
function generateGamingMessageId() {
    return 'gaming_msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Check premium status - FIXED: Matches your additional.js exactly
async function checkPremiumStatus() {
    if (!currentUser) return;

    try {
        // Check in users collection like your additional.js
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
            const userData = userSnap.data();
            
            // EXACTLY like your additional.js
            userHasPremium = (userData.paymentHistory && 
                userData.paymentHistory.some(payment => 
                    (payment.plan === 'lifetime' && payment.status === 'approved') ||
                    (userData.chatPoints >= 9999)
                ));
            
            console.log('Premium status from users collection:', userHasPremium, 'Payment history:', userData.paymentHistory, 'Chat points:', userData.chatPoints);
            
            // If not premium in users collection, check group_users as fallback
            if (!userHasPremium) {
                const groupUserRef = doc(db, 'group_users', currentUser.uid);
                const groupUserSnap = await getDoc(groupUserRef);
                
                if (groupUserSnap.exists()) {
                    const groupUserData = groupUserSnap.data();
                    userHasPremium = groupUserData.premium || groupUserData.rewardTag || false;
                    console.log('Premium status from group_users fallback:', userHasPremium);
                }
            }
            
            // Add premium badges if user has premium
            if (userHasPremium) {
                addPremiumBadgesToGroup();
            }
        } else {
            // If not in users collection, check group_users
            const groupUserRef = doc(db, 'group_users', currentUser.uid);
            const groupUserSnap = await getDoc(groupUserRef);
            
            if (groupUserSnap.exists()) {
                const groupUserData = groupUserSnap.data();
                userHasPremium = groupUserData.premium || groupUserData.rewardTag || false;
                console.log('Premium status from group_users only:', userHasPremium);
                
                if (userHasPremium) {
                    addPremiumBadgesToGroup();
                }
            }
        }
    } catch (error) {
        console.error('Error checking premium status:', error);
        userHasPremium = false;
    }
}

// Add premium badges to group chat UI
function addPremiumBadgesToGroup() {
    if (!userHasPremium || !currentUser) return;

    // Add premium badge to chat header
    const chatTitle = document.getElementById('chatTitle');
    if (chatTitle && !chatTitle.querySelector('.gaming-premium-badge')) {
        const premiumBadge = document.createElement('span');
        premiumBadge.className = 'gaming-premium-badge';
        premiumBadge.innerHTML = '<i class="fas fa-crown"></i> PREMIUM';
        premiumBadge.style.cssText = `
            margin-left: 10px;
            background: linear-gradient(45deg, #FFD700, #FFA500);
            color: #000;
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: bold;
            display: inline-flex;
            align-items: center;
            gap: 5px;
            box-shadow: 0 2px 8px rgba(255, 215, 0, 0.3);
        `;
        chatTitle.appendChild(premiumBadge);
    }

    // Add premium badge to sidebar
    const groupNameSidebar = document.getElementById('groupNameSidebar');
    if (groupNameSidebar && !groupNameSidebar.querySelector('.gaming-premium-badge')) {
        const premiumBadge = document.createElement('span');
        premiumBadge.className = 'gaming-premium-badge';
        premiumBadge.innerHTML = '<i class="fas fa-crown"></i> PREMIUM';
        premiumBadge.style.cssText = `
            display: inline-block;
            margin-left: 10px;
            background: linear-gradient(45deg, #FFD700, #FFA500);
            color: #000;
            padding: 3px 8px;
            border-radius: 10px;
            font-size: 10px;
            font-weight: bold;
            box-shadow: 0 2px 6px rgba(255, 215, 0, 0.3);
        `;
        groupNameSidebar.appendChild(premiumBadge);
    }
}

// Setup animation listener for group messages
function setupGroupAnimationListener() {
    if (!currentUser || !currentGroupId) {
        return;
    }

    // Clean up existing listener
    cleanupAnimationListener();
    
    // Listen to group messages
    const messagesRef = collection(db, 'groups', currentGroupId, 'messages');
    const messagesQuery = query(messagesRef, orderBy('timestamp', 'desc'), limit(50));
    
    animationListenerUnsubscribe = onSnapshot(messagesQuery, (snapshot) => {
        snapshot.docChanges().forEach(change => {
            if (change.type === 'added') {
                const message = change.doc.data();
                const messageId = change.doc.id;
                const messageTime = message.timestamp?.toMillis?.() || Date.now();
                
                // Check for gaming animations in message text
                if (message.senderId !== currentUser.uid &&
                    messageTime > lastProcessedMessageTime) {
                    
                    const messageText = message.text || '';
                    
                    // Check for gaming animation keywords
                    GAMING_ANIMATIONS.forEach(anim => {
                        if (messageText.includes(anim.emoji) || messageText.includes(anim.name.replace('_', ' '))) {
                            const animationId = `${message.senderId}_${anim.animation}_${messageTime}`;
                            
                            if (!playedAnimations.has(animationId)) {
                                playedAnimations.add(animationId);
                                lastProcessedMessageTime = Math.max(lastProcessedMessageTime, messageTime);
                                savePlayedAnimations();
                                
                                // Trigger the gaming animation
                                triggerGamingAnimation(anim.animation);
                                
                                // Show notification
                                showGamingNotification(`${anim.emoji} ${anim.name.replace('_', ' ')} from ${message.senderName || 'User'}!`, 'info');
                            }
                        }
                    });
                    
                    // Check for gaming sticker emojis
                    GAMING_STICKERS.forEach(sticker => {
                        if (messageText.includes(sticker.emoji)) {
                            const stickerId = `${message.senderId}_${sticker.animation}_${messageTime}`;
                            
                            if (!playedAnimations.has(stickerId)) {
                                playedAnimations.add(stickerId);
                                lastProcessedMessageTime = Math.max(lastProcessedMessageTime, messageTime);
                                savePlayedAnimations();
                                
                                // Enhance sticker display in group chat
                                enhanceGroupStickerDisplay();
                                
                                // Show notification
                                showGamingNotification(`${sticker.emoji} ${sticker.name.replace('_', ' ')} sticker from ${message.senderName || 'User'}!`, 'info');
                            }
                        }
                    });
                }
            }
        });
    });
}

// Enhance sticker display in group chat messages
function enhanceGroupStickerDisplay() {
    const messagesContainer = document.getElementById('messagesContainer');
    if (!messagesContainer) return;

    // Find all message groups
    const messageGroups = messagesContainer.querySelectorAll('.message-group');
    
    messageGroups.forEach(group => {
        const messages = group.querySelectorAll('.message-text, .system-message');
        
        messages.forEach(message => {
            const messageContent = message.textContent || '';
            
            // Check if this message contains any of our gaming sticker emojis
            GAMING_STICKERS.forEach(sticker => {
                if (messageContent.includes(sticker.emoji) && !message.classList.contains('gaming-sticker-enhanced')) {
                    // Mark as enhanced to prevent duplicate processing
                    message.classList.add('gaming-sticker-enhanced', 'gaming-sticker', sticker.animation);
                    
                    // Add gaming styling
                    message.style.fontSize = '2.5rem';
                    message.style.textAlign = 'center';
                    message.style.padding = '15px 20px';
                    message.style.margin = '10px 0';
                    message.style.borderRadius = '20px';
                    message.style.background = 'linear-gradient(135deg, #1a1a1a, #2a2a2a)';
                    message.style.border = '3px solid #ff6b00';
                    message.style.color = 'white';
                    message.style.textShadow = '0 0 10px #ff6b00';
                    message.style.animation = `${sticker.animation}Anim 2s infinite`;
                    message.style.display = 'inline-block';
                    message.style.boxShadow = '0 8px 25px rgba(255, 107, 0, 0.3)';
                }
            });
        });
    });
}

// Trigger gaming animation based on type
function triggerGamingAnimation(animationType) {
    const effectContainer = document.createElement('div');
    effectContainer.className = 'gaming-animation-effect';
    document.body.appendChild(effectContainer);

    switch(animationType) {
        case 'fireStrike': createFireStrike(effectContainer); break;
        case 'headshotEffect': createHeadshotEffect(effectContainer); break;
        case 'swordSlash': createSwordSlash(effectContainer); break;
        case 'shieldUp': createShieldUp(effectContainer); break;
        case 'grenadeExplosion': createGrenadeExplosion(effectContainer); break;
        case 'speedBoost': createSpeedBoost(effectContainer); break;
        case 'rankUp': createRankUp(effectContainer); break;
        case 'coinRain': createCoinRain(effectContainer); break;
        case 'comboAttack': createComboAttack(effectContainer); break;
        case 'damageHit': createDamageHit(effectContainer); break;
        case 'airdropFall': createAirdropFall(effectContainer); break;
        case 'arrowShot': createArrowShot(effectContainer); break;
        case 'killFeed': createKillFeed(effectContainer); break;
        case 'sprintEffect': createSprintEffect(effectContainer); break;
        case 'victoryRoyale': createVictoryRoyale(effectContainer); break;
        default: createFireStrike(effectContainer);
    }

    setTimeout(() => {
        if (effectContainer.parentNode) {
            effectContainer.parentNode.removeChild(effectContainer);
        }
    }, 5000);
}

// GAMING ANIMATION FUNCTIONS - Free Fire/COD Mobile Theme

function createFireStrike(container) {
    for (let i = 0; i < 20; i++) {
        setTimeout(() => {
            const fire = document.createElement('div');
            fire.className = 'gaming-fire';
            fire.innerHTML = '🔥';
            fire.style.left = Math.random() * 100 + 'vw';
            fire.style.fontSize = (Math.random() * 30 + 25) + 'px';
            fire.style.animationDuration = (Math.random() * 1 + 2) + 's';
            container.appendChild(fire);
        }, i * 100);
    }
}

function createHeadshotEffect(container) {
    const headshot = document.createElement('div');
    headshot.className = 'gaming-headshot';
    headshot.innerHTML = '🎯 HEADSHOT!';
    headshot.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 40px;
        font-weight: bold;
        color: #ff0000;
        text-shadow: 0 0 20px #ff0000;
        animation: gamingHeadshotAnim 2s ease-out;
        z-index: 10000;
    `;
    container.appendChild(headshot);
}

function createSwordSlash(container) {
    for (let i = 0; i < 15; i++) {
        setTimeout(() => {
            const slash = document.createElement('div');
            slash.className = 'gaming-slash';
            slash.innerHTML = '⚔️';
            slash.style.left = Math.random() * 100 + 'vw';
            slash.style.fontSize = (Math.random() * 25 + 20) + 'px';
            slash.style.animationDuration = (Math.random() * 0.5 + 1) + 's';
            slash.style.animationName = 'gamingSlashAnim';
            container.appendChild(slash);
        }, i * 150);
    }
}

function createShieldUp(container) {
    const shield = document.createElement('div');
    shield.className = 'gaming-shield';
    shield.innerHTML = '🛡️';
    shield.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 60px;
        animation: gamingShieldAnim 3s ease-in-out;
        z-index: 10000;
        filter: drop-shadow(0 0 20px #00ffff);
    `;
    container.appendChild(shield);
}

function createGrenadeExplosion(container) {
    for (let i = 0; i < 25; i++) {
        setTimeout(() => {
            const explosion = document.createElement('div');
            explosion.className = 'gaming-explosion';
            explosion.innerHTML = '💣';
            explosion.style.left = '50%';
            explosion.style.top = '50%';
            explosion.style.fontSize = (Math.random() * 30 + 20) + 'px';
            explosion.style.animationDuration = '2s';
            container.appendChild(explosion);
        }, i * 80);
    }
}

function createSpeedBoost(container) {
    for (let i = 0; i < 30; i++) {
        setTimeout(() => {
            const speed = document.createElement('div');
            speed.className = 'gaming-speed';
            speed.innerHTML = '⚡';
            speed.style.left = Math.random() * 100 + 'vw';
            speed.style.fontSize = (Math.random() * 20 + 15) + 'px';
            speed.style.animationDuration = (Math.random() * 1 + 1.5) + 's';
            speed.style.animationName = 'gamingSpeedAnim';
            container.appendChild(speed);
        }, i * 50);
    }
}

function createRankUp(container) {
    const rank = document.createElement('div');
    rank.className = 'gaming-rank';
    rank.innerHTML = '🎖️ RANK UP!';
    rank.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 35px;
        font-weight: bold;
        color: #ffd700;
        text-shadow: 0 0 15px #ffd700;
        animation: gamingRankAnim 3s ease-in-out;
        z-index: 10000;
    `;
    container.appendChild(rank);
}

function createCoinRain(container) {
    for (let i = 0; i < 40; i++) {
        setTimeout(() => {
            const coin = document.createElement('div');
            coin.className = 'gaming-coin';
            coin.innerHTML = '💰';
            coin.style.left = Math.random() * 100 + 'vw';
            coin.style.fontSize = (Math.random() * 20 + 15) + 'px';
            coin.style.animationDuration = (Math.random() * 2 + 2) + 's';
            container.appendChild(coin);
        }, i * 75);
    }
}

function createComboAttack(container) {
    for (let i = 0; i < 5; i++) {
        setTimeout(() => {
            const combo = document.createElement('div');
            combo.className = 'gaming-combo';
            combo.innerHTML = 'COMBO x' + (i + 1);
            combo.style.cssText = `
                position: absolute;
                top: ${20 + i * 15}%;
                left: 50%;
                transform: translateX(-50%);
                font-size: ${30 - i * 3}px;
                font-weight: bold;
                color: #ff00ff;
                text-shadow: 0 0 10px #ff00ff;
                animation: gamingComboAnim 1.5s ease-out;
                z-index: 10000;
            `;
            container.appendChild(combo);
        }, i * 300);
    }
}

function createDamageHit(container) {
    for (let i = 0; i < 15; i++) {
        setTimeout(() => {
            const damage = document.createElement('div');
            damage.className = 'gaming-damage';
            damage.innerHTML = '🩸';
            damage.style.left = '50%';
            damage.style.top = '50%';
            damage.style.fontSize = (Math.random() * 25 + 20) + 'px';
            damage.style.animationDuration = '1.5s';
            damage.style.animationName = 'gamingDamageAnim';
            container.appendChild(damage);
        }, i * 100);
    }
}

function createAirdropFall(container) {
    const airdrop = document.createElement('div');
    airdrop.className = 'gaming-airdrop';
    airdrop.innerHTML = '🚁';
    airdrop.style.cssText = `
        position: absolute;
        top: -100px;
        left: 50%;
        transform: translateX(-50%);
        font-size: 50px;
        animation: gamingAirdropAnim 4s ease-in-out;
        z-index: 10000;
        filter: drop-shadow(0 0 10px #00ff00);
    `;
    container.appendChild(airdrop);
}

function createArrowShot(container) {
    for (let i = 0; i < 10; i++) {
        setTimeout(() => {
            const arrow = document.createElement('div');
            arrow.className = 'gaming-arrow';
            arrow.innerHTML = '🏹';
            arrow.style.left = '0%';
            arrow.style.top = Math.random() * 100 + 'vh';
            arrow.style.fontSize = '30px';
            arrow.style.animationDuration = '1s';
            arrow.style.animationName = 'gamingArrowAnim';
            container.appendChild(arrow);
        }, i * 200);
    }
}

function createKillFeed(container) {
    const killfeed = document.createElement('div');
    killfeed.className = 'gaming-killfeed';
    killfeed.innerHTML = '💀 ELIMINATED!';
    killfeed.style.cssText = `
        position: absolute;
        top: 20%;
        right: 10%;
        font-size: 25px;
        font-weight: bold;
        color: #ff0000;
        text-shadow: 0 0 10px #ff0000;
        animation: gamingKillfeedAnim 2s ease-out;
        z-index: 10000;
    `;
    container.appendChild(killfeed);
}

function createSprintEffect(container) {
    for (let i = 0; i < 25; i++) {
        setTimeout(() => {
            const sprint = document.createElement('div');
            sprint.className = 'gaming-sprint';
            sprint.innerHTML = '🏃‍♂️';
            sprint.style.left = Math.random() * 100 + 'vw';
            sprint.style.fontSize = (Math.random() * 20 + 15) + 'px';
            sprint.style.animationDuration = (Math.random() * 1 + 1) + 's';
            sprint.style.animationName = 'gamingSprintAnim';
            container.appendChild(sprint);
        }, i * 50);
    }
}

function createVictoryRoyale(container) {
    const victory = document.createElement('div');
    victory.className = 'gaming-victory';
    victory.innerHTML = '🎮 VICTORY ROYALE!';
    victory.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 45px;
        font-weight: bold;
        color: #ffd700;
        text-shadow: 0 0 20px #ffd700, 0 0 40px #ff6b00;
        animation: gamingVictoryAnim 4s ease-in-out;
        z-index: 10000;
        text-align: center;
    `;
    container.appendChild(victory);
}

// Load gaming animation styles
function loadGamingAnimationStyles() {
    if (document.getElementById('gaming-animation-styles')) return;

    const styles = `
        /* Gaming Animation Library Styles */
        .gaming-animation-btn {
            background: linear-gradient(135deg, #ff6b00 0%, #ff9500 100%);
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
            box-shadow: 0 4px 10px rgba(255, 107, 0, 0.3);
        }
        
        .gaming-animation-btn:hover { 
            background: linear-gradient(135deg, #ff9500 0%, #ff6b00 100%);
            transform: scale(1.1); 
            box-shadow: 0 6px 20px rgba(255, 107, 0, 0.5);
        }
        
        .gaming-animation-modal { 
            display: none; 
            position: fixed; 
            top: 0; 
            left: 0; 
            width: 100%; 
            height: 100%; 
            background: rgba(0,0,0,0.85); 
            z-index: 10000; 
            align-items: center;
            justify-content: center;
        }
        
        .gaming-animation-modal-content { 
            background: linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 100%);
            border-radius: 15px; 
            width: 95%; 
            max-width: 550px; 
            max-height: 85vh; 
            overflow: hidden; 
            box-shadow: 0 20px 60px rgba(255, 107, 0, 0.3);
            border: 3px solid #ff6b00;
        }
        
        .gaming-animation-modal-header { 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            padding: 20px; 
            background: linear-gradient(135deg, #ff6b00 0%, #ff9500 100%);
            color: white; 
        }
        
        .gaming-animation-modal-header h3 { 
            margin: 0; 
            font-size: 1.3rem; 
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .close-group-animation-modal { 
            background: none; 
            border: none; 
            color: white; 
            font-size: 28px; 
            cursor: pointer; 
            padding: 0; 
            width: 35px; 
            height: 35px; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            border-radius: 50%;
            transition: background 0.3s;
        }
        
        .close-group-animation-modal:hover {
            background: rgba(255, 255, 255, 0.2);
        }
        
        .gaming-animation-tabs {
            display: flex;
            background: rgba(255, 107, 0, 0.1);
            border-bottom: 2px solid #ff6b00;
        }
        
        .gaming-tab-button {
            flex: 1;
            padding: 15px 20px;
            border: none;
            background: none;
            cursor: pointer;
            font-size: 15px;
            font-weight: 600;
            color: #a0aec0;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
        }
        
        .gaming-tab-button.active {
            color: white;
            background: rgba(255, 107, 0, 0.2);
            border-bottom: 3px solid #ff6b00;
        }
        
        .gaming-tab-content {
            max-height: 450px;
            overflow-y: auto;
        }
        
        .gaming-tab-pane {
            display: none;
            padding: 25px;
        }
        
        .gaming-tab-pane.active {
            display: block;
        }
        
        .gaming-animation-grid, .gaming-sticker-grid { 
            display: grid; 
            grid-template-columns: repeat(3, 1fr); 
            gap: 20px; 
        }
        
        @media (max-width: 480px) {
            .gaming-animation-grid, .gaming-sticker-grid { 
                grid-template-columns: repeat(2, 1fr); 
            }
        }
        
        .gaming-animation-item, .gaming-sticker-item { 
            display: flex; 
            flex-direction: column; 
            align-items: center; 
            padding: 25px 15px; 
            border-radius: 15px; 
            cursor: pointer; 
            transition: all 0.3s ease; 
            border: 2px solid transparent; 
            position: relative; 
            background: rgba(255, 107, 0, 0.05);
            backdrop-filter: blur(10px);
        }
        
        .gaming-animation-item:hover, .gaming-sticker-item:hover { 
            background: rgba(255, 107, 0, 0.15); 
            transform: translateY(-8px); 
            border-color: #ff6b00;
            box-shadow: 0 12px 25px rgba(255, 107, 0, 0.2);
        }
        
        .gaming-animation-item.premium-locked, .gaming-sticker-item.premium-locked { 
            opacity: 0.6; 
            cursor: not-allowed; 
            filter: grayscale(0.5);
        }
        
        .gaming-animation-item.premium-locked::after, .gaming-sticker-item.premium-locked::after { 
            content: '👑'; 
            position: absolute; 
            top: 10px; 
            right: 10px; 
            font-size: 14px; 
            color: #ffd700;
        }
        
        .gaming-animation-emoji { 
            font-size: 3rem; 
            margin-bottom: 15px; 
            filter: drop-shadow(0 0 8px rgba(255, 107, 0, 0.5));
        }
        
        .gaming-sticker-emoji {
            font-size: 3.5rem;
            margin-bottom: 15px;
            transition: all 0.3s ease;
            filter: drop-shadow(0 0 10px rgba(255, 107, 0, 0.5));
        }
        
        .gaming-animation-name, .gaming-sticker-name { 
            font-size: 0.9rem; 
            text-align: center; 
            text-transform: uppercase; 
            color: #e2e8f0; 
            font-weight: 600;
            letter-spacing: 0.5px;
        }
        
        .gaming-animation-premium-notice { 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            gap: 12px; 
            padding: 20px; 
            background: linear-gradient(135deg, #ffd700 0%, #ff9500 100%);
            color: #000; 
            font-weight: bold;
            font-size: 14px;
        }
        
        .gaming-animation-premium-notice i { 
            color: #000; 
            font-size: 18px;
        }

        /* Gaming Sticker Animations in Library */
        .gaming-sticker-item .freeFireDance { animation: freeFireDanceAnim 2s infinite; }
        .gaming-sticker-item .codmHeadshot { animation: codmHeadshotAnim 2s infinite; }
        .gaming-sticker-item .powerUpGlow { animation: powerUpGlowAnim 2s infinite; }
        .gaming-sticker-item .weaponReload { animation: weaponReloadAnim 3s infinite linear; }
        .gaming-sticker-item .victoryDance { animation: victoryDanceAnim 2s infinite; }
        .gaming-sticker-item .gameOver { animation: gameOverAnim 2s infinite; }
        .gaming-sticker-item .healingPotion { animation: healingPotionAnim 1.5s infinite; }
        .gaming-sticker-item .sniperScope { animation: sniperScopeAnim 2s infinite; }
        .gaming-sticker-item .doubleKill { animation: doubleKillAnim 2s infinite; }
        .gaming-sticker-item .speedRun { animation: speedRunAnim 2s infinite; }
        .gaming-sticker-item .shieldBlock { animation: shieldBlockAnim 2s infinite; }
        .gaming-sticker-item .airdropOpen { animation: airdropOpenAnim 2s infinite; }

        /* Gaming Sticker Animation Keyframes */
        @keyframes freeFireDanceAnim {
            0%, 100% { transform: rotate(0deg) scale(1); }
            25% { transform: rotate(-15deg) scale(1.1); }
            50% { transform: scale(1.2); }
            75% { transform: rotate(15deg) scale(1.1); }
        }
        
        @keyframes codmHeadshotAnim {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.3); opacity: 0.8; }
        }
        
        @keyframes powerUpGlowAnim {
            0%, 100% { filter: brightness(1) drop-shadow(0 0 5px #ff6b00); }
            50% { filter: brightness(1.5) drop-shadow(0 0 20px #ff9500); }
        }
        
        @keyframes weaponReloadAnim {
            0% { transform: rotateY(0deg) scale(1); }
            50% { transform: rotateY(180deg) scale(1.1); }
            100% { transform: rotateY(360deg) scale(1); }
        }
        
        @keyframes victoryDanceAnim {
            0%, 100% { transform: translateY(0) rotate(0deg); }
            25% { transform: translateY(-15px) rotate(-10deg); }
            75% { transform: translateY(-15px) rotate(10deg); }
        }
        
        @keyframes gameOverAnim {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.1); opacity: 0.7; }
        }
        
        @keyframes healingPotionAnim {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.2); }
        }
        
        @keyframes sniperScopeAnim {
            0%, 100% { transform: scale(1) rotate(0deg); }
            50% { transform: scale(1.1) rotate(5deg); }
        }
        
        @keyframes doubleKillAnim {
            0%, 100% { transform: translateX(0) scale(1); }
            25% { transform: translateX(-5px) scale(1.1); }
            75% { transform: translateX(5px) scale(1.1); }
        }
        
        @keyframes speedRunAnim {
            0%, 100% { transform: translateX(0) scale(1); }
            50% { transform: translateX(20px) scale(1.1); }
        }
        
        @keyframes shieldBlockAnim {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.2); }
        }
        
        @keyframes airdropOpenAnim {
            0%, 100% { transform: translateY(0) scale(1); }
            50% { transform: translateY(-10px) scale(1.1); }
        }

        /* Gaming Animation Elements */
        .gaming-animation-effect { 
            position: fixed; 
            top: 0; 
            left: 0; 
            width: 100%; 
            height: 100%; 
            pointer-events: none; 
            z-index: 9999; 
            overflow: hidden;
        }
        
        .gaming-fire, .gaming-slash, .gaming-speed, .gaming-coin, .gaming-damage, .gaming-arrow, .gaming-sprint { 
            position: absolute; 
            font-size: 24px; 
            animation: gamingFloat 3s ease-in-out forwards; 
            pointer-events: none;
            filter: drop-shadow(0 0 5px currentColor);
        }
        
        .gaming-explosion { 
            position: absolute; 
            font-size: 24px; 
            animation: gamingExplosion 2s ease-out forwards; 
            pointer-events: none;
            filter: drop-shadow(0 0 10px #ff0000);
        }

        /* Gaming Animation Keyframes */
        @keyframes gamingFloat {
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
        
        @keyframes gamingExplosion {
            0% { 
                transform: translate(-50%, -50%) scale(0); 
                opacity: 1; 
            }
            50% { 
                transform: translate(-50%, -50%) scale(3); 
                opacity: 0.8; 
            }
            100% { 
                transform: translate(-50%, -50%) scale(5); 
                opacity: 0; 
            }
        }
        
        @keyframes gamingHeadshotAnim {
            0% { 
                transform: translate(-50%, -50%) scale(0.5); 
                opacity: 0; 
                text-shadow: 0 0 0 #ff0000;
            }
            50% { 
                transform: translate(-50%, -50%) scale(1.2); 
                opacity: 1; 
                text-shadow: 0 0 30px #ff0000;
            }
            100% { 
                transform: translate(-50%, -50%) scale(1); 
                opacity: 0; 
                text-shadow: 0 0 10px #ff0000;
            }
        }
        
        @keyframes gamingSlashAnim {
            0% { 
                transform: rotate(0deg) scale(0); 
                opacity: 0; 
            }
            50% { 
                transform: rotate(180deg) scale(1.5); 
                opacity: 1; 
                filter: drop-shadow(0 0 15px #00ff00);
            }
            100% { 
                transform: rotate(360deg) scale(0); 
                opacity: 0; 
            }
        }
        
        @keyframes gamingShieldAnim {
            0% { 
                transform: translate(-50%, -50%) scale(0); 
                opacity: 0; 
                filter: drop-shadow(0 0 0 #00ffff);
            }
            50% { 
                transform: translate(-50%, -50%) scale(1.5); 
                opacity: 1; 
                filter: drop-shadow(0 0 40px #00ffff);
            }
            100% { 
                transform: translate(-50%, -50%) scale(1); 
                opacity: 0; 
                filter: drop-shadow(0 0 20px #00ffff);
            }
        }
        
        @keyframes gamingSpeedAnim {
            0% { 
                transform: translateX(0) scale(0); 
                opacity: 0; 
            }
            50% { 
                transform: translateX(50px) scale(1.5); 
                opacity: 1; 
                filter: drop-shadow(0 0 20px #ffff00);
            }
            100% { 
                transform: translateX(100px) scale(0); 
                opacity: 0; 
            }
        }
        
        @keyframes gamingRankAnim {
            0% { 
                transform: translate(-50%, -50%) scale(0.5); 
                opacity: 0; 
                text-shadow: 0 0 0 #ffd700;
            }
            50% { 
                transform: translate(-50%, -50%) scale(1.3); 
                opacity: 1; 
                text-shadow: 0 0 40px #ffd700;
            }
            100% { 
                transform: translate(-50%, -50%) scale(1); 
                opacity: 0; 
                text-shadow: 0 0 20px #ffd700;
            }
        }
        
        @keyframes gamingComboAnim {
            0% { 
                transform: translateX(-50%) scale(0.5); 
                opacity: 0; 
                text-shadow: 0 0 0 #ff00ff;
            }
            70% { 
                transform: translateX(-50%) scale(1.2); 
                opacity: 1; 
                text-shadow: 0 0 25px #ff00ff;
            }
            100% { 
                transform: translateX(-50%) scale(1); 
                opacity: 0; 
                text-shadow: 0 0 10px #ff00ff;
            }
        }
        
        @keyframes gamingDamageAnim {
            0% { 
                transform: translate(-50%, -50%) scale(0.5); 
                opacity: 0; 
            }
            50% { 
                transform: translate(-50%, -50%) scale(1.5); 
                opacity: 1; 
                filter: drop-shadow(0 0 15px #ff0000);
            }
            100% { 
                transform: translate(-50%, -50%) scale(0.5); 
                opacity: 0; 
            }
        }
        
        @keyframes gamingAirdropAnim {
            0% { 
                top: -100px; 
                opacity: 0; 
                filter: drop-shadow(0 0 0 #00ff00);
            }
            30% { 
                top: 50%; 
                opacity: 1; 
                filter: drop-shadow(0 0 20px #00ff00);
            }
            70% { 
                top: 50%; 
                opacity: 1; 
                filter: drop-shadow(0 0 10px #00ff00);
            }
            100% { 
                top: 150%; 
                opacity: 0; 
                filter: drop-shadow(0 0 0 #00ff00);
            }
        }
        
        @keyframes gamingArrowAnim {
            0% { 
                left: 0%; 
                opacity: 0; 
            }
            20% { 
                opacity: 1; 
            }
            100% { 
                left: 100%; 
                opacity: 0; 
                transform: rotate(45deg);
            }
        }
        
        @keyframes gamingKillfeedAnim {
            0% { 
                right: -100%; 
                opacity: 0; 
                text-shadow: 0 0 0 #ff0000;
            }
            20% { 
                right: 10%; 
                opacity: 1; 
                text-shadow: 0 0 20px #ff0000;
            }
            80% { 
                right: 10%; 
                opacity: 1; 
                text-shadow: 0 0 20px #ff0000;
            }
            100% { 
                right: -100%; 
                opacity: 0; 
                text-shadow: 0 0 0 #ff0000;
            }
        }
        
        @keyframes gamingSprintAnim {
            0% { 
                transform: translateX(0) scale(0); 
                opacity: 0; 
            }
            50% { 
                transform: translateX(30px) scale(1.2); 
                opacity: 1; 
            }
            100% { 
                transform: translateX(60px) scale(0); 
                opacity: 0; 
            }
        }
        
        @keyframes gamingVictoryAnim {
            0% { 
                transform: translate(-50%, -50%) scale(0.2); 
                opacity: 0; 
                text-shadow: 0 0 0 #ffd700;
            }
            30% { 
                transform: translate(-50%, -50%) scale(1.3); 
                opacity: 1; 
                text-shadow: 0 0 50px #ff6b00;
            }
            70% { 
                transform: translate(-50%, -50%) scale(1.1); 
                opacity: 1; 
                text-shadow: 0 0 40px #ffd700, 0 0 80px #ff6b00;
            }
            100% { 
                transform: translate(-50%, -50%) scale(0.5); 
                opacity: 0; 
                text-shadow: 0 0 10px #ffd700;
            }
        }

        /* Sticker messages in group chat */
        .gaming-sticker {
            animation-duration: 2s !important;
            animation-iteration-count: infinite !important;
            animation-timing-function: ease-in-out !important;
        }

        /* Gaming sticker animations for group chat */
        .gaming-sticker.freeFireDance { animation-name: freeFireDanceAnim !important; }
        .gaming-sticker.codmHeadshot { animation-name: codmHeadshotAnim !important; }
        .gaming-sticker.powerUpGlow { animation-name: powerUpGlowAnim !important; }
        .gaming-sticker.weaponReload { animation-name: weaponReloadAnim !important; }
        .gaming-sticker.victoryDance { animation-name: victoryDanceAnim !important; }
        .gaming-sticker.gameOver { animation-name: gameOverAnim !important; }
        .gaming-sticker.healingPotion { animation-name: healingPotionAnim !important; }
        .gaming-sticker.sniperScope { animation-name: sniperScopeAnim !important; }
        .gaming-sticker.doubleKill { animation-name: doubleKillAnim !important; }
        .gaming-sticker.speedRun { animation-name: speedRunAnim !important; }
        .gaming-sticker.shieldBlock { animation-name: shieldBlockAnim !important; }
        .gaming-sticker.airdropOpen { animation-name: airdropOpenAnim !important; }

        /* Responsive adjustments */
        @media (max-width: 768px) {
            .gaming-animation-modal-content {
                width: 98%;
                max-height: 90vh;
            }
            
            .gaming-animation-grid, .gaming-sticker-grid {
                gap: 15px;
            }
            
            .gaming-animation-item, .gaming-sticker-item {
                padding: 20px 10px;
            }
            
            .gaming-animation-emoji {
                font-size: 2.5rem;
            }
            
            .gaming-sticker-emoji {
                font-size: 3rem;
            }
        }
    `;

    const styleSheet = document.createElement('style');
    styleSheet.id = 'gaming-animation-styles';
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
}

// Simple notification function
window.showGamingNotification = function(message, type = 'info') {
    // Create a simple notification
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'error' ? '#ff0000' : type === 'success' ? '#4CAF50' : type === 'warning' ? '#ff9800' : '#2196F3'};
        color: white;
        padding: 15px 25px;
        border-radius: 10px;
        z-index: 10000;
        max-width: 300px;
        box-shadow: 0 5px 20px rgba(0,0,0,0.4);
        font-weight: 600;
        animation: slideIn 0.3s ease;
        border-left: 5px solid ${type === 'error' ? '#cc0000' : type === 'success' ? '#2E7D32' : type === 'warning' ? '#f57c00' : '#1565C0'};
        font-family: Arial, sans-serif;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
};

// Add slideIn and slideOut animations
if (!document.getElementById('gaming-notification-animations')) {
    const animationStyles = document.createElement('style');
    animationStyles.id = 'gaming-notification-animations';
    animationStyles.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(animationStyles);
}

// Setup sticker enhancer for group chat
function setupGroupStickerEnhancer() {
    // Run immediately
    enhanceGroupStickerDisplay();
    
    // Run every 3 seconds to catch new messages
    setInterval(enhanceGroupStickerDisplay, 3000);
    
    // Also run when new messages are added to the DOM
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.addedNodes.length > 0) {
                enhanceGroupStickerDisplay();
            }
        });
    });
    
    const messagesContainer = document.getElementById('messagesContainer');
    if (messagesContainer) {
        observer.observe(messagesContainer, { childList: true, subtree: true });
    }
}

// Initialize sticker enhancer when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(setupGroupStickerEnhancer, 4000);
});

// Clean up when page unloads
window.addEventListener('beforeunload', () => {
    cleanupAnimationListener();
});

// Export for use with group.js
window.gamingAnimations = {
    GAMING_ANIMATIONS,
    GAMING_STICKERS,
    triggerGamingAnimation,
    showGamingNotification,
    initGroupAnimationLibrary,
    enhanceGroupStickerDisplay
};