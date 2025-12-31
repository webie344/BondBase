// additional-group.js - Animations with proper 5-6 second duration

import { 
    getAuth,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { 
    getFirestore, 
    doc, 
    getDoc,
    collection,
    query,
    orderBy,
    limit,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Firebase configuration
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

// Pure Visual Animations Configuration with proper durations
const VISUAL_ANIMATIONS = [
    { 
        name: 'fire_strike', 
        displayName: 'Fire Strike',
        animation: 'fireStrike',
        color: '#FF6B00',
        duration: 6.0,
        description: 'Flaming attack'
    },
    { 
        name: 'headshot', 
        displayName: 'Headshot',
        animation: 'headshotEffect',
        color: '#FF0000',
        duration: 5.5,
        description: 'Precision hit'
    },
    { 
        name: 'sword_slash', 
        displayName: 'Sword Slash',
        animation: 'swordSlash',
        color: '#00FF00',
        duration: 5.0,
        description: 'Blade attack'
    },
    { 
        name: 'shield_up', 
        displayName: 'Shield Up',
        animation: 'shieldUp',
        color: '#00FFFF',
        duration: 6.0,
        description: 'Defensive barrier'
    },
    { 
        name: 'grenade', 
        displayName: 'Grenade Blast',
        animation: 'grenadeExplosion',
        color: '#FF4500',
        duration: 5.5,
        description: 'Explosive damage'
    },
    { 
        name: 'speed_boost', 
        displayName: 'Speed Boost',
        animation: 'speedBoost',
        color: '#FFFF00',
        duration: 5.0,
        description: 'Movement speed'
    },
    { 
        name: 'rank_up', 
        displayName: 'Rank Up',
        animation: 'rankUp',
        color: '#FFD700',
        duration: 6.5,
        description: 'Level upgrade'
    },
    { 
        name: 'coin_rain', 
        displayName: 'Coin Rain',
        animation: 'coinRain',
        color: '#FFD700',
        duration: 6.0,
        description: 'Currency shower'
    },
    { 
        name: 'combo_attack', 
        displayName: 'Combo Attack',
        animation: 'comboAttack',
        color: '#FF00FF',
        duration: 5.5,
        description: 'Multi-hit'
    },
    { 
        name: 'damage_hit', 
        displayName: 'Damage Hit',
        animation: 'damageHit',
        color: '#FF1493',
        duration: 5.0,
        description: 'Impact damage'
    },
    { 
        name: 'airdrop', 
        displayName: 'Airdrop Supply',
        animation: 'airdropFall',
        color: '#00FF00',
        duration: 7.0,
        description: 'Supply drop'
    },
    { 
        name: 'arrow_shot', 
        displayName: 'Arrow Shot',
        animation: 'arrowShot',
        color: '#8B4513',
        duration: 5.0,
        description: 'Ranged attack'
    },
    { 
        name: 'kill_feed', 
        displayName: 'Elimination',
        animation: 'killFeed',
        color: '#DC143C',
        duration: 5.5,
        description: 'Player defeated'
    },
    { 
        name: 'sprint', 
        displayName: 'Sprint Dash',
        animation: 'sprintEffect',
        color: '#1E90FF',
        duration: 5.0,
        description: 'Fast movement'
    },
    { 
        name: 'victory_royale', 
        displayName: 'Victory Royale',
        animation: 'victoryRoyale',
        color: '#FFD700',
        duration: 7.5,
        description: 'Match winner'
    }
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
    loadVisualAnimationStyles();
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
        const stored = localStorage.getItem('visualPlayedAnimations');
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
        localStorage.setItem('visualPlayedAnimations', JSON.stringify(data));
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
    if (window.location.pathname.includes('group.html')) {
        const urlParams = new URLSearchParams(window.location.search);
        currentGroupId = urlParams.get('id');
    }
    
    initGroupAnimationLibrary();
    checkPremiumStatus();
    
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

    const existingBtn = document.getElementById('groupAnimationBtn');
    if (existingBtn) {
        existingBtn.remove();
    }

    const animationBtn = document.createElement('button');
    animationBtn.id = 'groupAnimationBtn';
    animationBtn.className = 'visual-animation-btn';
    animationBtn.innerHTML = '<i class="fas fa-bolt"></i>';
    animationBtn.title = 'Visual Animations';
    animationBtn.addEventListener('click', toggleGroupAnimationLibrary);

    const messageInput = document.getElementById('messageInput');
    if (messageInput && messageInput.parentNode === messageInputContainer) {
        messageInputContainer.insertBefore(animationBtn, messageInput);
    } else {
        messageInputContainer.insertBefore(animationBtn, messageInputContainer.firstChild);
    }
}

// Set up input focus handling
function setupGroupInputFocusHandling() {
    const messageInput = document.getElementById('messageInput');
    const animationBtn = document.getElementById('groupAnimationBtn');
    
    if (!messageInput || !animationBtn) {
        setTimeout(setupGroupInputFocusHandling, 1000);
        return;
    }

    messageInput.addEventListener('focus', () => {
        animationBtn.style.display = 'none';
        messageInput.style.width = 'calc(100% - 120px)';
    });

    messageInput.addEventListener('blur', () => {
        setTimeout(() => {
            animationBtn.style.display = 'flex';
            messageInput.style.width = 'calc(100% - 170px)';
        }, 100);
    });

    animationBtn.style.display = 'flex';
    messageInput.style.width = 'calc(100% - 170px)';
    messageInput.style.transition = 'width 0.3s ease';
}

// Create animation library modal for group chat
function createGroupAnimationModal() {
    if (document.getElementById('groupAnimationLibraryModal')) return;

    const modal = document.createElement('div');
    modal.id = 'groupAnimationLibraryModal';
    modal.className = 'visual-animation-modal';
    modal.innerHTML = `
        <div class="visual-animation-modal-content">
            <div class="visual-animation-modal-header">
                <h3><i class="fas fa-bolt"></i> Visual Animations</h3>
                <button class="close-group-animation-modal">&times;</button>
            </div>
            <div class="visual-animation-grid">
                ${VISUAL_ANIMATIONS.map(anim => `
                    <div class="visual-animation-item" data-animation="${anim.animation}">
                        <div class="visual-animation-preview" style="background: ${anim.color}">
                            <div class="visual-animation-effect ${anim.animation}-preview"></div>
                        </div>
                        <span class="visual-animation-name">${anim.displayName}</span>
                        <span class="visual-animation-desc">${anim.description}</span>
                    </div>
                `).join('')}
            </div>
            <div class="visual-animation-premium-notice" id="groupPremiumNotice" style="display: none;">
                <i class="fas fa-crown"></i>
                <p>Premium feature: Upgrade to send visual animations</p>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('.close-group-animation-modal').addEventListener('click', closeGroupAnimationLibrary);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeGroupAnimationLibrary();
    });

    const animationItems = modal.querySelectorAll('.visual-animation-item');
    animationItems.forEach(item => {
        item.addEventListener('click', () => selectGroupAnimation(item.dataset.animation));
    });
}

// Toggle animation library
function toggleGroupAnimationLibrary() {
    const modal = document.getElementById('groupAnimationLibraryModal');
    if (!modal) return;

    if (animationLibraryOpen) {
        closeGroupAnimationLibrary();
    } else {
        openGroupAnimationLibrary();
    }
}

// Open animation library
function openGroupAnimationLibrary() {
    const modal = document.getElementById('groupAnimationLibraryModal');
    if (!modal) return;

    modal.style.display = 'flex';
    animationLibraryOpen = true;

    const premiumNotice = document.getElementById('groupPremiumNotice');
    if (premiumNotice) {
        premiumNotice.style.display = userHasPremium ? 'none' : 'flex';
    }

    const animationItems = document.querySelectorAll('.visual-animation-item');
    animationItems.forEach(item => {
        if (!userHasPremium) {
            item.classList.add('premium-locked');
        } else {
            item.classList.remove('premium-locked');
        }
    });
}

// Close animation library
function closeGroupAnimationLibrary() {
    const modal = document.getElementById('groupAnimationLibraryModal');
    if (!modal) return;

    modal.style.display = 'none';
    animationLibraryOpen = false;
}

// Select animation for group chat
async function selectGroupAnimation(animationType) {
    if (!userHasPremium) {
        showVisualNotification('Premium feature: Upgrade to send visual animations', 'warning');
        return;
    }

    if (!currentGroupId) {
        showVisualNotification('No active group chat', 'error');
        return;
    }

    try {
        const animationData = VISUAL_ANIMATIONS.find(anim => anim.animation === animationType);
        if (!animationData) return;

        await sendGroupAnimationMessage(animationData);
        closeGroupAnimationLibrary();
        showVisualNotification(`${animationData.displayName} animation sent!`, 'success');
    } catch (error) {
        showVisualNotification('Error sending animation', 'error');
    }
}

// Send animation message to group
async function sendGroupAnimationMessage(animationData) {
    if (!currentUser || !currentGroupId) {
        return;
    }

    try {
        if (window.groupChat && window.groupChat.sendMessage) {
            await window.groupChat.sendMessage(
                currentGroupId,
                `🎮 Sent ${animationData.displayName} animation`,
                null,
                null,
                window.groupChat.replyingToMessage?.id
            );
        }
    } catch (error) {
        throw error;
    }
}

// Check premium status
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
            
            if (!userHasPremium) {
                const groupUserRef = doc(db, 'group_users', currentUser.uid);
                const groupUserSnap = await getDoc(groupUserRef);
                
                if (groupUserSnap.exists()) {
                    const groupUserData = groupUserSnap.data();
                    userHasPremium = groupUserData.premium || groupUserData.rewardTag || false;
                }
            }
        } else {
            const groupUserRef = doc(db, 'group_users', currentUser.uid);
            const groupUserSnap = await getDoc(groupUserRef);
            
            if (groupUserSnap.exists()) {
                const groupUserData = groupUserSnap.data();
                userHasPremium = groupUserData.premium || groupUserData.rewardTag || false;
            }
        }
    } catch (error) {
        console.error('Error checking premium status:', error);
        userHasPremium = false;
    }
}

// Setup animation listener for group messages
function setupGroupAnimationListener() {
    if (!currentUser || !currentGroupId) {
        return;
    }

    cleanupAnimationListener();
    
    const messagesRef = collection(db, 'groups', currentGroupId, 'messages');
    const messagesQuery = query(messagesRef, orderBy('timestamp', 'desc'), limit(50));
    
    animationListenerUnsubscribe = onSnapshot(messagesQuery, (snapshot) => {
        snapshot.docChanges().forEach(change => {
            if (change.type === 'added') {
                const message = change.doc.data();
                const messageId = change.doc.id;
                const messageTime = message.timestamp?.toMillis?.() || Date.now();
                
                if (message.senderId !== currentUser.uid &&
                    messageTime > lastProcessedMessageTime) {
                    
                    const messageText = message.text || '';
                    
                    VISUAL_ANIMATIONS.forEach(anim => {
                        if (messageText.includes(anim.displayName) || messageText.includes(anim.name)) {
                            const animationId = `${message.senderId}_${anim.animation}_${messageTime}`;
                            
                            if (!playedAnimations.has(animationId)) {
                                playedAnimations.add(animationId);
                                lastProcessedMessageTime = Math.max(lastProcessedMessageTime, messageTime);
                                savePlayedAnimations();
                                
                                triggerVisualAnimation(anim.animation);
                                
                                showVisualNotification(`${anim.displayName} from ${message.senderName || 'User'}!`, 'info');
                            }
                        }
                    });
                }
            }
        });
    });
}

// Trigger visual animation based on type
function triggerVisualAnimation(animationType) {
    const effectContainer = document.createElement('div');
    effectContainer.className = 'visual-animation-effect-container';
    effectContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 9999;
        overflow: hidden;
    `;
    document.body.appendChild(effectContainer);

    switch(animationType) {
        case 'fireStrike': createFireStrikeEffect(effectContainer); break;
        case 'headshotEffect': createHeadshotEffect(effectContainer); break;
        case 'swordSlash': createSwordSlashEffect(effectContainer); break;
        case 'shieldUp': createShieldUpEffect(effectContainer); break;
        case 'grenadeExplosion': createGrenadeExplosionEffect(effectContainer); break;
        case 'speedBoost': createSpeedBoostEffect(effectContainer); break;
        case 'rankUp': createRankUpEffect(effectContainer); break;
        case 'coinRain': createCoinRainEffect(effectContainer); break;
        case 'comboAttack': createComboAttackEffect(effectContainer); break;
        case 'damageHit': createDamageHitEffect(effectContainer); break;
        case 'airdropFall': createAirdropEffect(effectContainer); break;
        case 'arrowShot': createArrowShotEffect(effectContainer); break;
        case 'killFeed': createKillFeedEffect(effectContainer); break;
        case 'sprintEffect': createSprintEffect(effectContainer); break;
        case 'victoryRoyale': createVictoryRoyaleEffect(effectContainer); break;
        default: createFireStrikeEffect(effectContainer);
    }

    // Remove container after animation duration + 1 second buffer
    const animationData = VISUAL_ANIMATIONS.find(anim => anim.animation === animationType);
    const duration = animationData ? animationData.duration * 1000 : 6000;
    
    setTimeout(() => {
        if (effectContainer.parentNode) {
            effectContainer.style.opacity = '0';
            effectContainer.style.transition = 'opacity 0.5s ease-out';
            setTimeout(() => {
                if (effectContainer.parentNode) {
                    effectContainer.parentNode.removeChild(effectContainer);
                }
            }, 500);
        }
    }, duration);
}

// PURE VISUAL ANIMATION FUNCTIONS (No icons/emojis) - LONG DURATION

function createFireStrikeEffect(container) {
    // Create multiple fire particles
    for (let i = 0; i < 35; i++) {
        const fireParticle = document.createElement('div');
        fireParticle.className = 'fire-particle';
        fireParticle.style.cssText = `
            position: absolute;
            width: ${Math.random() * 15 + 5}px;
            height: ${Math.random() * 15 + 5}px;
            background: linear-gradient(45deg, #FF6B00, #FF9500, #FFD700);
            border-radius: 50%;
            left: ${Math.random() * 100}%;
            top: ${Math.random() * 100}%;
            box-shadow: 0 0 30px #FF6B00;
            animation: fireParticleAnim 6s ease-out forwards;
            filter: blur(${Math.random() * 2}px);
            opacity: 0;
        `;
        container.appendChild(fireParticle);
    }
    
    // Create main fire effect
    const mainFire = document.createElement('div');
    mainFire.className = 'main-fire';
    mainFire.style.cssText = `
        position: absolute;
        width: 300px;
        height: 300px;
        background: radial-gradient(circle, #FF6B00 0%, transparent 70%);
        border-radius: 50%;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        animation: fireExplosion 6s ease-out forwards;
        filter: blur(15px);
        opacity: 0;
    `;
    container.appendChild(mainFire);
    
    // Create secondary explosions
    for (let i = 0; i < 3; i++) {
        setTimeout(() => {
            const secondaryFire = document.createElement('div');
            secondaryFire.className = 'secondary-fire';
            secondaryFire.style.cssText = `
                position: absolute;
                width: ${150 + i * 50}px;
                height: ${150 + i * 50}px;
                background: radial-gradient(circle, #FF9500 0%, transparent 70%);
                border-radius: 50%;
                left: ${30 + i * 20}%;
                top: ${40 + i * 10}%;
                animation: fireExplosion 4s ease-out ${i * 0.5}s forwards;
                filter: blur(10px);
                opacity: 0;
            `;
            container.appendChild(secondaryFire);
        }, i * 800);
    }
}

function createHeadshotEffect(container) {
    const headshot = document.createElement('div');
    headshot.className = 'headshot-effect';
    headshot.innerHTML = '<div class="headshot-text">HEADSHOT</div>';
    headshot.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 10000;
    `;
    
    const text = headshot.querySelector('.headshot-text');
    text.style.cssText = `
        font-size: 72px;
        font-weight: bold;
        color: #FF0000;
        text-shadow: 0 0 40px #FF0000, 0 0 80px #FF0000;
        animation: headshotTextAnim 5.5s ease-out forwards;
        letter-spacing: 8px;
        font-family: 'Arial Black', sans-serif;
        opacity: 0;
    `;
    
    container.appendChild(headshot);
    
    // Create blood splatter effect
    for (let i = 0; i < 25; i++) {
        setTimeout(() => {
            const bloodDrop = document.createElement('div');
            bloodDrop.className = 'blood-drop';
            bloodDrop.style.cssText = `
                position: absolute;
                width: ${Math.random() * 20 + 10}px;
                height: ${Math.random() * 20 + 10}px;
                background: radial-gradient(circle, #FF0000 0%, #8B0000 100%);
                border-radius: 50% 50% 50% 0;
                left: 50%;
                top: 50%;
                transform: translate(-50%, -50%) rotate(${Math.random() * 360}deg);
                animation: bloodSplatterAnim 4s ease-out ${i * 0.1}s forwards;
                filter: blur(${Math.random() * 3}px);
                opacity: 0;
            `;
            container.appendChild(bloodDrop);
        }, i * 150);
    }
    
    // Create crack effect
    for (let i = 0; i < 12; i++) {
        setTimeout(() => {
            const crack = document.createElement('div');
            crack.className = 'headshot-crack';
            crack.style.cssText = `
                position: absolute;
                width: ${Math.random() * 80 + 40}px;
                height: ${Math.random() * 3 + 2}px;
                background: linear-gradient(90deg, #8B0000, #FF0000, #8B0000);
                left: 50%;
                top: 50%;
                transform: translate(-50%, -50%) rotate(${i * 30}deg);
                animation: crackAnim 3s ease-out ${i * 0.2}s forwards;
                border-radius: 2px;
                filter: blur(1px);
                opacity: 0;
            `;
            container.appendChild(crack);
        }, i * 200);
    }
}

function createSwordSlashEffect(container) {
    // Create multiple slash effects
    for (let i = 0; i < 8; i++) {
        setTimeout(() => {
            const slash = document.createElement('div');
            slash.className = 'sword-slash';
            slash.style.cssText = `
                position: absolute;
                width: ${150 + i * 30}px;
                height: 5px;
                background: linear-gradient(90deg, transparent, #00FF00, #00FF00, transparent);
                left: ${Math.random() * 100}%;
                top: ${Math.random() * 100}%;
                transform: rotate(${Math.random() * 360}deg);
                animation: swordSlashAnim 3s ease-out forwards;
                box-shadow: 0 0 30px #00FF00, 0 0 60px #00FF00;
                filter: blur(2px);
                opacity: 0;
            `;
            container.appendChild(slash);
        }, i * 400);
    }
    
    // Create impact effects
    for (let i = 0; i < 3; i++) {
        setTimeout(() => {
            const impact = document.createElement('div');
            impact.className = 'slash-impact';
            impact.style.cssText = `
                position: absolute;
                width: ${100 + i * 50}px;
                height: ${100 + i * 50}px;
                background: radial-gradient(circle, #00FF00 0%, transparent 70%);
                border-radius: 50%;
                left: ${30 + i * 20}%;
                top: ${40 + i * 15}%;
                transform: translate(-50%, -50%);
                animation: slashImpactAnim 4s ease-out ${i * 0.3}s forwards;
                filter: blur(20px);
                opacity: 0;
            `;
            container.appendChild(impact);
        }, i * 1000);
    }
    
    // Create spark particles
    for (let i = 0; i < 40; i++) {
        setTimeout(() => {
            const spark = document.createElement('div');
            spark.className = 'sword-spark';
            spark.style.cssText = `
                position: absolute;
                width: ${Math.random() * 6 + 3}px;
                height: ${Math.random() * 6 + 3}px;
                background: radial-gradient(circle, #00FF00, #FFFFFF);
                border-radius: 50%;
                left: ${Math.random() * 100}%;
                top: ${Math.random() * 100}%;
                animation: sparkAnim 3s ease-out forwards;
                box-shadow: 0 0 15px #00FF00;
                filter: blur(1px);
                opacity: 0;
            `;
            container.appendChild(spark);
        }, i * 75);
    }
}

function createShieldUpEffect(container) {
    // Create shield circles
    for (let i = 5; i > 0; i--) {
        const shieldRing = document.createElement('div');
        shieldRing.className = 'shield-ring';
        shieldRing.style.cssText = `
            position: absolute;
            width: ${200 + i * 80}px;
            height: ${200 + i * 80}px;
            border: ${8 + i * 3}px solid rgba(0, 255, 255, ${0.4 - i * 0.05});
            border-radius: 50%;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            animation: shieldRingAnim 6s ease-out ${i * 0.3}s forwards;
            box-shadow: 0 0 50px rgba(0, 255, 255, 0.7);
            filter: blur(${i * 2}px);
            opacity: 0;
        `;
        container.appendChild(shieldRing);
    }
    
    // Create shield energy effect
    const shieldEnergy = document.createElement('div');
    shieldEnergy.className = 'shield-energy';
    shieldEnergy.style.cssText = `
        position: absolute;
        width: 350px;
        height: 350px;
        background: radial-gradient(circle, rgba(0, 255, 255, 0.4) 0%, transparent 70%);
        border-radius: 50%;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        animation: shieldEnergyAnim 6s ease-in-out infinite;
        filter: blur(30px);
        opacity: 0.7;
    `;
    container.appendChild(shieldEnergy);
    
    // Create shield hexagons
    for (let i = 0; i < 12; i++) {
        setTimeout(() => {
            const hexagon = document.createElement('div');
            hexagon.className = 'shield-hexagon';
            hexagon.style.cssText = `
                position: absolute;
                width: 40px;
                height: 40px;
                background: rgba(0, 255, 255, 0.3);
                clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
                left: ${Math.random() * 100}%;
                top: ${Math.random() * 100}%;
                animation: hexagonFloat 4s ease-in-out ${i * 0.2}s infinite;
                box-shadow: 0 0 20px rgba(0, 255, 255, 0.5);
                opacity: 0.6;
            `;
            container.appendChild(hexagon);
        }, i * 200);
    }
}

function createGrenadeExplosionEffect(container) {
    // Create multiple explosions
    for (let exp = 0; exp < 3; exp++) {
        setTimeout(() => {
            // Create explosion core
            const explosionCore = document.createElement('div');
            explosionCore.className = 'explosion-core';
            explosionCore.style.cssText = `
                position: absolute;
                width: 0;
                height: 0;
                background: radial-gradient(circle, #FF4500, #FF0000);
                border-radius: 50%;
                left: ${30 + exp * 20}%;
                top: ${40 + exp * 10}%;
                transform: translate(-50%, -50%);
                animation: explosionCoreAnim 3s ease-out forwards;
                box-shadow: 0 0 80px #FF4500;
                filter: blur(8px);
                opacity: 0;
            `;
            container.appendChild(explosionCore);
            
            // Create shockwaves
            for (let i = 0; i < 3; i++) {
                setTimeout(() => {
                    const shockwave = document.createElement('div');
                    shockwave.className = 'shockwave';
                    shockwave.style.cssText = `
                        position: absolute;
                        width: 0;
                        height: 0;
                        border: ${3 + i}px solid rgba(255, 69, 0, ${0.6 - i * 0.2});
                        border-radius: 50%;
                        left: ${30 + exp * 20}%;
                        top: ${40 + exp * 10}%;
                        transform: translate(-50%, -50%);
                        animation: shockwaveAnim 4s ease-out ${i * 0.3}s forwards;
                        filter: blur(${i}px);
                        opacity: 0;
                    `;
                    container.appendChild(shockwave);
                }, i * 300);
            }
            
            // Create debris particles
            for (let i = 0; i < 30; i++) {
                setTimeout(() => {
                    const debris = document.createElement('div');
                    debris.className = 'debris-particle';
                    debris.style.cssText = `
                        position: absolute;
                        width: ${Math.random() * 15 + 8}px;
                        height: ${Math.random() * 15 + 8}px;
                        background: linear-gradient(45deg, #FF4500, #FFA500, #FFD700);
                        left: ${30 + exp * 20}%;
                        top: ${40 + exp * 10}%;
                        border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
                        animation: debrisAnim 5s ease-out forwards;
                        filter: blur(${Math.random() * 2}px);
                        opacity: 0;
                    `;
                    container.appendChild(debris);
                }, i * 100);
            }
        }, exp * 1500);
    }
    
    // Screen shake effect
    container.style.animation = 'screenShake 5s ease-out';
}

function createSpeedBoostEffect(container) {
    // Create speed lines continuously
    let lineCount = 0;
    const lineInterval = setInterval(() => {
        if (lineCount < 50) {
            const speedLine = document.createElement('div');
            speedLine.className = 'speed-line';
            speedLine.style.cssText = `
                position: absolute;
                width: ${Math.random() * 150 + 80}px;
                height: 3px;
                background: linear-gradient(90deg, transparent, #FFFF00, #FFFF00, transparent);
                left: ${Math.random() * 100}%;
                top: ${Math.random() * 100}%;
                transform: rotate(${Math.random() * 360}deg);
                animation: speedLineAnim 2s linear forwards;
                box-shadow: 0 0 25px #FFFF00;
                filter: blur(1px);
                opacity: 0;
            `;
            container.appendChild(speedLine);
            lineCount++;
        } else {
            clearInterval(lineInterval);
        }
    }, 80);
    
    // Create motion trails
    for (let i = 0; i < 20; i++) {
        setTimeout(() => {
            const trail = document.createElement('div');
            trail.className = 'speed-trail';
            trail.style.cssText = `
                position: absolute;
                width: ${Math.random() * 200 + 100}px;
                height: 8px;
                background: linear-gradient(90deg, rgba(255, 255, 0, 0.8), transparent);
                left: ${Math.random() * 100}%;
                top: ${Math.random() * 100}%;
                transform: rotate(${Math.random() * 30 - 15}deg);
                animation: speedTrailAnim 3s ease-out forwards;
                filter: blur(3px);
                opacity: 0;
            `;
            container.appendChild(trail);
        }, i * 200);
    }
    
    // Create afterimages
    for (let i = 0; i < 5; i++) {
        setTimeout(() => {
            const afterimage = document.createElement('div');
            afterimage.className = 'afterimage';
            afterimage.style.cssText = `
                position: absolute;
                width: 100px;
                height: 100px;
                background: radial-gradient(ellipse at center, rgba(255, 255, 0, 0.2), transparent 70%);
                left: ${20 + i * 15}%;
                top: ${30 + i * 10}%;
                animation: afterimageAnim 2s ease-out ${i * 0.2}s forwards;
                filter: blur(10px);
                opacity: 0;
            `;
            container.appendChild(afterimage);
        }, i * 600);
    }
}

function createRankUpEffect(container) {
    // Create rank stars
    for (let i = 0; i < 15; i++) {
        const star = document.createElement('div');
        star.className = 'rank-star';
        star.style.cssText = `
            position: absolute;
            width: ${Math.random() * 40 + 20}px;
            height: ${Math.random() * 40 + 20}px;
            background: linear-gradient(45deg, #FFD700, #FFA500, #FFD700);
            clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);
            left: ${Math.random() * 100}%;
            top: ${Math.random() * 100}%;
            animation: rankStarAnim 4s ease-out ${i * 0.2}s forwards;
            box-shadow: 0 0 30px #FFD700, 0 0 60px #FFD700;
            opacity: 0;
            filter: drop-shadow(0 0 10px #FFD700);
        `;
        container.appendChild(star);
    }
    
    // Create rank text with multiple stages
    const rankText = document.createElement('div');
    rankText.className = 'rank-text';
    rankText.innerHTML = '<div class="rank-text-content">RANK UP!</div>';
    rankText.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 10000;
    `;
    
    const textContent = rankText.querySelector('.rank-text-content');
    textContent.style.cssText = `
        font-size: 82px;
        font-weight: bold;
        color: #FFD700;
        text-shadow: 0 0 40px #FFD700, 0 0 80px #FF6B00, 0 0 120px #FF4500;
        animation: rankTextAnim 6.5s ease-out forwards;
        letter-spacing: 8px;
        font-family: 'Arial Black', sans-serif;
        text-align: center;
        opacity: 0;
    `;
    
    container.appendChild(rankText);
    
    // Create level up particles
    for (let i = 0; i < 40; i++) {
        setTimeout(() => {
            const levelParticle = document.createElement('div');
            levelParticle.className = 'level-particle';
            levelParticle.textContent = '↑';
            levelParticle.style.cssText = `
                position: absolute;
                font-size: ${Math.random() * 24 + 16}px;
                color: #FFD700;
                font-weight: bold;
                left: ${Math.random() * 100}%;
                top: ${Math.random() * 100}%;
                animation: levelParticleAnim 4s ease-out ${i * 0.1}s forwards;
                text-shadow: 0 0 20px #FFD700;
                opacity: 0;
            `;
            container.appendChild(levelParticle);
        }, i * 100);
    }
    
    // Create rank circles
    for (let i = 0; i < 8; i++) {
        const rankCircle = document.createElement('div');
        rankCircle.className = 'rank-circle';
        rankCircle.style.cssText = `
            position: absolute;
            width: ${100 + i * 50}px;
            height: ${100 + i * 50}px;
            border: ${3 + i}px solid rgba(255, 215, 0, ${0.3 - i * 0.03});
            border-radius: 50%;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            animation: rankCircleAnim 5s ease-out ${i * 0.4}s forwards;
            filter: blur(${i}px);
            opacity: 0;
        `;
        container.appendChild(rankCircle);
    }
}

function createCoinRainEffect(container) {
    // Create coins continuously for longer duration
    let coinCount = 0;
    const coinInterval = setInterval(() => {
        if (coinCount < 100) {
            const coin = document.createElement('div');
            coin.className = 'coin';
            coin.style.cssText = `
                position: absolute;
                width: ${Math.random() * 35 + 15}px;
                height: ${Math.random() * 35 + 15}px;
                background: radial-gradient(circle at 30% 30%, #FFD700 40%, #FFA500 100%);
                border-radius: 50%;
                left: ${Math.random() * 100}%;
                top: -50px;
                animation: coinRainAnim ${Math.random() * 3 + 3}s ease-in forwards;
                box-shadow: 0 0 25px #FFD700;
                transform-style: preserve-3d;
                opacity: 0;
            `;
            
            // Add shine effect
            const shine = document.createElement('div');
            shine.style.cssText = `
                position: absolute;
                width: ${Math.random() * 12 + 6}px;
                height: ${Math.random() * 12 + 6}px;
                background: radial-gradient(circle, white, transparent 70%);
                border-radius: 50%;
                top: ${Math.random() * 10 + 5}px;
                left: ${Math.random() * 10 + 5}px;
                filter: blur(2px);
                opacity: ${Math.random() * 0.5 + 0.3};
            `;
            coin.appendChild(shine);
            
            container.appendChild(coin);
            coinCount++;
        } else {
            clearInterval(coinInterval);
        }
    }, 50);
    
    // Create coin glow effects on ground
    for (let i = 0; i < 20; i++) {
        setTimeout(() => {
            const coinGlow = document.createElement('div');
            coinGlow.className = 'coin-glow';
            coinGlow.style.cssText = `
                position: absolute;
                width: ${Math.random() * 60 + 30}px;
                height: ${Math.random() * 60 + 30}px;
                background: radial-gradient(circle, rgba(255, 215, 0, 0.3), transparent 70%);
                border-radius: 50%;
                left: ${Math.random() * 100}%;
                top: 85%;
                animation: coinGlowAnim 4s ease-out ${i * 0.2}s infinite;
                filter: blur(15px);
                opacity: 0.6;
            `;
            container.appendChild(coinGlow);
        }, i * 200);
    }
    
    // Create coin pile effect
    setTimeout(() => {
        const coinPile = document.createElement('div');
        coinPile.className = 'coin-pile';
        coinPile.style.cssText = `
            position: absolute;
            width: 200px;
            height: 100px;
            background: radial-gradient(ellipse at center, 
                rgba(255, 215, 0, 0.4) 0%,
                rgba(255, 215, 0, 0.2) 30%,
                transparent 70%);
            left: 50%;
            top: 85%;
            transform: translateX(-50%);
            animation: coinPileAnim 4s ease-out forwards;
            filter: blur(20px);
            opacity: 0;
        `;
        container.appendChild(coinPile);
    }, 3000);
}

function createComboAttackEffect(container) {
    // Create multiple combo stages
    for (let stage = 1; stage <= 5; stage++) {
        setTimeout(() => {
            // Combo number for this stage
            const comboNumber = document.createElement('div');
            comboNumber.className = 'combo-number';
            comboNumber.textContent = `COMBO x${stage}`;
            comboNumber.style.cssText = `
                position: absolute;
                font-size: ${96 - stage * 12}px;
                font-weight: bold;
                color: #FF00FF;
                text-shadow: 0 0 30px #FF00FF, 0 0 60px #FF00FF, 0 0 90px #FF00FF;
                left: 50%;
                top: ${20 + stage * 12}%;
                transform: translateX(-50%);
                animation: comboNumberAnim 3s ease-out forwards;
                font-family: 'Arial Black', sans-serif;
                letter-spacing: 4px;
                opacity: 0;
                z-index: 10000;
            `;
            container.appendChild(comboNumber);
            
            // Combo energy pulses for this stage
            for (let i = 0; i < 3; i++) {
                const pulse = document.createElement('div');
                pulse.className = 'combo-pulse';
                pulse.style.cssText = `
                    position: absolute;
                    width: 0;
                    height: 0;
                    border: ${4 + i}px solid rgba(255, 0, 255, ${0.4 - i * 0.1});
                    border-radius: 50%;
                    left: 50%;
                    top: ${20 + stage * 12}%;
                    transform: translate(-50%, -50%);
                    animation: comboPulseAnim 2.5s ease-out ${i * 0.3}s forwards;
                    filter: blur(${i}px);
                    opacity: 0;
                `;
                container.appendChild(pulse);
            }
            
            // Combo hit markers
            for (let i = 0; i < 8; i++) {
                setTimeout(() => {
                    const hitMarker = document.createElement('div');
                    hitMarker.className = 'hit-marker';
                    hitMarker.style.cssText = `
                        position: absolute;
                        width: ${Math.random() * 60 + 30}px;
                        height: ${Math.random() * 60 + 30}px;
                        background: radial-gradient(circle, rgba(255, 0, 255, 0.3), transparent 70%);
                        border-radius: 50%;
                        left: ${Math.random() * 100}%;
                        top: ${Math.random() * 100}%;
                        animation: hitMarkerAnim 2s ease-out forwards;
                        filter: blur(10px);
                        opacity: 0;
                    `;
                    container.appendChild(hitMarker);
                }, i * 150);
            }
        }, stage * 1000);
    }
    
    // Create combo streak effect
    const comboStreak = document.createElement('div');
    comboStreak.className = 'combo-streak';
    comboStreak.style.cssText = `
        position: absolute;
        width: 100%;
        height: 4px;
        background: linear-gradient(90deg, transparent, #FF00FF, #FF00FF, transparent);
        top: 50%;
        animation: comboStreakAnim 5s linear infinite;
        filter: blur(2px);
        opacity: 0.7;
    `;
    container.appendChild(comboStreak);
}

function createDamageHitEffect(container) {
    // Create multiple damage impacts
    for (let hit = 0; hit < 4; hit++) {
        setTimeout(() => {
            // Damage impact
            const damageImpact = document.createElement('div');
            damageImpact.className = 'damage-impact';
            damageImpact.style.cssText = `
                position: absolute;
                width: ${200 + hit * 50}px;
                height: ${200 + hit * 50}px;
                background: radial-gradient(circle, #FF1493 0%, transparent 70%);
                border-radius: 50%;
                left: ${30 + hit * 15}%;
                top: ${40 + hit * 10}%;
                transform: translate(-50%, -50%);
                animation: damageImpactAnim 3s ease-out forwards;
                filter: blur(25px);
                opacity: 0;
            `;
            container.appendChild(damageImpact);
            
            // Crack effects
            for (let i = 0; i < 12; i++) {
                const crack = document.createElement('div');
                crack.className = 'damage-crack';
                crack.style.cssText = `
                    position: absolute;
                    width: ${Math.random() * 100 + 50}px;
                    height: ${Math.random() * 4 + 3}px;
                    background: linear-gradient(90deg, #FF1493, #8B008B, #FF1493);
                    left: ${30 + hit * 15}%;
                    top: ${40 + hit * 10}%;
                    transform: translate(-50%, -50%) rotate(${i * 30}deg);
                    animation: damageCrackAnim 2.5s ease-out ${i * 0.15}s forwards;
                    border-radius: 2px;
                    filter: blur(2px);
                    opacity: 0;
                `;
                container.appendChild(crack);
            }
            
            // Damage particles
            for (let i = 0; i < 25; i++) {
                setTimeout(() => {
                    const particle = document.createElement('div');
                    particle.className = 'damage-particle';
                    particle.style.cssText = `
                        position: absolute;
                        width: ${Math.random() * 10 + 5}px;
                        height: ${Math.random() * 10 + 5}px;
                        background: radial-gradient(circle, #FF1493, #8B008B);
                        border-radius: 50%;
                        left: ${30 + hit * 15}%;
                        top: ${40 + hit * 10}%;
                        animation: damageParticleAnim 3s ease-out forwards;
                        box-shadow: 0 0 15px #FF1493;
                        filter: blur(${Math.random() * 2}px);
                        opacity: 0;
                    `;
                    container.appendChild(particle);
                }, i * 80);
            }
        }, hit * 1200);
    }
    
    // Screen shake effect for longer duration
    container.style.animation = 'screenShake 4s ease-out';
}

// IMPROVED AIRDROP ANIMATION WITH LONGER DURATION
function createAirdropEffect(container) {
    // Create helicopter
    const helicopter = document.createElement('div');
    helicopter.className = 'helicopter';
    helicopter.style.cssText = `
        position: absolute;
        width: 150px;
        height: 50px;
        background: linear-gradient(45deg, #2C3E50, #34495E);
        border-radius: 12px;
        top: -150px;
        left: -200px;
        animation: helicopterFlyIn 7s ease-in-out forwards;
        box-shadow: 0 8px 25px rgba(0,0,0,0.6);
        z-index: 10000;
        opacity: 0;
    `;
    
    // Helicopter cockpit
    const cockpit = document.createElement('div');
    cockpit.style.cssText = `
        position: absolute;
        width: 50px;
        height: 30px;
        background: linear-gradient(45deg, #3498DB, #2980B9);
        border-radius: 10px;
        top: -18px;
        left: 50px;
        box-shadow: inset 0 0 15px rgba(255,255,255,0.3);
    `;
    helicopter.appendChild(cockpit);
    
    // Helicopter tail
    const tail = document.createElement('div');
    tail.style.cssText = `
        position: absolute;
        width: 80px;
        height: 20px;
        background: linear-gradient(45deg, #2C3E50, #34495E);
        border-radius: 6px;
        top: 15px;
        right: -70px;
    `;
    helicopter.appendChild(tail);
    
    // Helicopter rotor (main)
    const mainRotor = document.createElement('div');
    mainRotor.className = 'main-rotor';
    mainRotor.style.cssText = `
        position: absolute;
        width: 240px;
        height: 10px;
        background: linear-gradient(90deg, transparent, #7F8C8D, #7F8C8D, transparent);
        top: -35px;
        left: -50px;
        border-radius: 5px;
        animation: rotorSpin 0.15s linear infinite;
    `;
    helicopter.appendChild(mainRotor);
    
    // Helicopter rotor (tail)
    const tailRotor = document.createElement('div');
    tailRotor.className = 'tail-rotor';
    tailRotor.style.cssText = `
        position: absolute;
        width: 60px;
        height: 6px;
        background: linear-gradient(90deg, transparent, #7F8C8D, transparent);
        top: 8px;
        right: -85px;
        border-radius: 3px;
        animation: tailRotorSpin 0.08s linear infinite;
    `;
    helicopter.appendChild(tailRotor);
    
    container.appendChild(helicopter);
    
    // Create airdrop crate
    setTimeout(() => {
        const airdropCrate = document.createElement('div');
        airdropCrate.className = 'airdrop-crate';
        airdropCrate.style.cssText = `
            position: absolute;
            width: 80px;
            height: 80px;
            background: linear-gradient(45deg, #E74C3C, #C0392B);
            border: 6px solid #F1C40F;
            top: 100px;
            left: 50%;
            transform: translateX(-50%);
            animation: crateRelease 7s ease-in-out forwards;
            box-shadow: 0 8px 30px rgba(0,0,0,0.4);
            z-index: 9999;
            opacity: 0;
        `;
        
        // Create crate straps
        for (let i = 0; i < 2; i++) {
            const strap = document.createElement('div');
            strap.style.cssText = `
                position: absolute;
                width: ${i === 0 ? '100%' : '6px'};
                height: ${i === 0 ? '6px' : '100%'};
                background: #F1C40F;
                ${i === 0 ? 'top: 50%; left: 0; transform: translateY(-50%);' : 'left: 50%; top: 0; transform: translateX(-50%);'}
                box-shadow: 0 0 10px #F1C40F;
            `;
            airdropCrate.appendChild(strap);
        }
        
        // Create crate corners
        for (let i = 0; i < 4; i++) {
            const corner = document.createElement('div');
            corner.style.cssText = `
                position: absolute;
                width: 15px;
                height: 15px;
                background: #F1C40F;
                ${i === 0 ? 'top: 0; left: 0;' : 
                  i === 1 ? 'top: 0; right: 0;' : 
                  i === 2 ? 'bottom: 0; left: 0;' : 
                  'bottom: 0; right: 0;'}
                border-radius: 3px;
            `;
            airdropCrate.appendChild(corner);
        }
        
        container.appendChild(airdropCrate);
        
        // Create parachute
        const parachute = document.createElement('div');
        parachute.className = 'parachute';
        parachute.style.cssText = `
            position: absolute;
            width: 140px;
            height: 70px;
            background: linear-gradient(45deg, #1ABC9C, #16A085, #1ABC9C);
            border-radius: 70px 70px 0 0;
            top: 30px;
            left: 50%;
            transform: translateX(-50%);
            animation: parachuteFloat 7s ease-in-out forwards;
            opacity: 0;
            z-index: 9998;
            box-shadow: 0 8px 25px rgba(26, 188, 156, 0.4);
        `;
        
        // Parachute lines
        for (let i = 0; i < 6; i++) {
            const line = document.createElement('div');
            line.style.cssText = `
                position: absolute;
                width: 3px;
                height: 60px;
                background: linear-gradient(to bottom, #F1C40F, #D4AC0D);
                left: ${14 + (i * 14.4)}%;
                top: 70px;
                animation: lineSwing 2s ease-in-out infinite;
                animation-delay: ${i * 0.2}s;
            `;
            parachute.appendChild(line);
        }
        
        container.appendChild(parachute);
        
        // Create landing effects
        setTimeout(() => {
            // Landing dust
            const landingEffect = document.createElement('div');
            landingEffect.className = 'airdrop-landing';
            landingEffect.style.cssText = `
                position: absolute;
                width: 200px;
                height: 80px;
                background: radial-gradient(ellipse at center, 
                    rgba(149, 165, 166, 0.5) 0%, 
                    rgba(149, 165, 166, 0.3) 30%, 
                    transparent 70%);
                left: 50%;
                top: 85%;
                transform: translateX(-50%);
                animation: landingDust 3s ease-out forwards;
                filter: blur(12px);
                z-index: 9997;
                opacity: 0;
            `;
            container.appendChild(landingEffect);
            
            // Supply glow effect
            const supplyGlow = document.createElement('div');
            supplyGlow.className = 'supply-glow';
            supplyGlow.style.cssText = `
                position: absolute;
                width: 150px;
                height: 150px;
                background: radial-gradient(circle, 
                    rgba(241, 196, 15, 0.4) 0%, 
                    rgba(241, 196, 15, 0.2) 50%, 
                    transparent 70%);
                left: 50%;
                top: 85%;
                transform: translate(-50%, -50%);
                animation: supplyGlowPulse 3s ease-in-out infinite;
                filter: blur(20px);
                z-index: 9996;
                opacity: 0;
            `;
            container.appendChild(supplyGlow);
            
            // Create loot particles burst
            for (let burst = 0; burst < 3; burst++) {
                setTimeout(() => {
                    for (let i = 0; i < 15; i++) {
                        const lootParticle = document.createElement('div');
                        lootParticle.className = 'loot-particle';
                        lootParticle.style.cssText = `
                            position: absolute;
                            width: ${Math.random() * 20 + 10}px;
                            height: ${Math.random() * 20 + 10}px;
                            background: ${burst === 0 ? 'linear-gradient(45deg, #3498DB, #2980B9)' : 
                                         burst === 1 ? 'linear-gradient(45deg, #9B59B6, #8E44AD)' : 
                                         'linear-gradient(45deg, #2ECC71, #27AE60)'};
                            border-radius: ${Math.random() > 0.5 ? '50%' : '6px'};
                            left: 50%;
                            top: 85%;
                            transform: translate(-50%, -50%);
                            animation: lootBurst 2.5s ease-out forwards;
                            box-shadow: 0 0 25px ${burst === 0 ? '#3498DB' : burst === 1 ? '#9B59B6' : '#2ECC71'};
                            filter: blur(${Math.random() * 2}px);
                            opacity: 0;
                        `;
                        container.appendChild(lootParticle);
                    }
                }, burst * 800);
            }
            
            // Create loot glow around crate
            const lootRadiance = document.createElement('div');
            lootRadiance.className = 'loot-radiance';
            lootRadiance.style.cssText = `
                position: absolute;
                width: 120px;
                height: 120px;
                background: 
                    radial-gradient(circle at 30% 30%, rgba(52, 152, 219, 0.3) 0%, transparent 50%),
                    radial-gradient(circle at 70% 70%, rgba(155, 89, 182, 0.3) 0%, transparent 50%),
                    radial-gradient(circle at 30% 70%, rgba(46, 204, 113, 0.3) 0%, transparent 50%),
                    radial-gradient(circle at 70% 30%, rgba(241, 196, 15, 0.3) 0%, transparent 50%);
                left: 50%;
                top: 85%;
                transform: translate(-50%, -50%);
                animation: lootRadianceAnim 4s ease-in-out infinite;
                filter: blur(15px);
                z-index: 9995;
                opacity: 0.8;
            `;
            container.appendChild(lootRadiance);
            
        }, 5000); // Landing effects start at 5 seconds
    }, 1500); // Crate release starts at 1.5 seconds
}

function createArrowShotEffect(container) {
    // Create arrow volleys
    for (let volley = 0; volley < 3; volley++) {
        setTimeout(() => {
            for (let i = 0; i < 5; i++) {
                setTimeout(() => {
                    const arrow = document.createElement('div');
                    arrow.className = 'arrow';
                    arrow.style.cssText = `
                        position: absolute;
                        width: ${100 + volley * 20}px;
                        height: 5px;
                        background: linear-gradient(90deg, #8B4513, #D2691E, #8B4513);
                        left: -150px;
                        top: ${20 + volley * 20 + i * 15}%;
                        animation: arrowShotAnim 2.5s ease-out forwards;
                        transform: rotate(${Math.random() * 10 - 5}deg);
                        filter: blur(1px);
                        opacity: 0;
                    `;
                    
                    // Arrow head
                    const arrowHead = document.createElement('div');
                    arrowHead.style.cssText = `
                        position: absolute;
                        width: 0;
                        height: 0;
                        border-left: 15px solid #D2691E;
                        border-top: 8px solid transparent;
                        border-bottom: 8px solid transparent;
                        right: -15px;
                        top: -5px;
                    `;
                    arrow.appendChild(arrowHead);
                    
                    // Arrow feathers
                    const feathers = document.createElement('div');
                    feathers.style.cssText = `
                        position: absolute;
                        width: 20px;
                        height: 12px;
                        background: linear-gradient(90deg, #8B4513, #A0522D);
                        left: -20px;
                        top: -4px;
                        clip-path: polygon(100% 0, 0 50%, 100% 100%);
                    `;
                    arrow.appendChild(feathers);
                    
                    // Arrow glow
                    const arrowGlow = document.createElement('div');
                    arrowGlow.style.cssText = `
                        position: absolute;
                        width: 100%;
                        height: 100%;
                        background: linear-gradient(90deg, transparent, rgba(210, 105, 30, 0.3), transparent);
                        filter: blur(3px);
                    `;
                    arrow.appendChild(arrowGlow);
                    
                    container.appendChild(arrow);
                }, i * 200);
            }
            
            // Create target hit effects for this volley
            setTimeout(() => {
                for (let i = 0; i < 3; i++) {
                    const targetHit = document.createElement('div');
                    targetHit.className = 'target-hit';
                    targetHit.style.cssText = `
                        position: absolute;
                        width: ${120 + i * 40}px;
                        height: ${120 + i * 40}px;
                        border: ${6 + i}px solid rgba(139, 0, 0, ${0.6 - i * 0.2});
                        border-radius: 50%;
                        left: 90%;
                        top: ${30 + volley * 20}%;
                        transform: translate(-50%, -50%);
                        animation: targetHitAnim 3s ease-out ${i * 0.3}s forwards;
                        box-shadow: 0 0 40px rgba(255, 0, 0, 0.6);
                        filter: blur(${i}px);
                        opacity: 0;
                    `;
                    container.appendChild(targetHit);
                }
                
                // Create impact particles
                for (let i = 0; i < 20; i++) {
                    setTimeout(() => {
                        const impactParticle = document.createElement('div');
                        impactParticle.className = 'impact-particle';
                        impactParticle.style.cssText = `
                            position: absolute;
                            width: ${Math.random() * 10 + 5}px;
                            height: ${Math.random() * 10 + 5}px;
                            background: radial-gradient(circle, #8B0000, #FF0000);
                            border-radius: 50%;
                            left: 90%;
                            top: ${30 + volley * 20}%;
                            animation: impactParticleAnim 2.5s ease-out forwards;
                            box-shadow: 0 0 20px #FF0000;
                            filter: blur(${Math.random()}px);
                            opacity: 0;
                        `;
                        container.appendChild(impactParticle);
                    }, i * 100);
                }
            }, 1500);
        }, volley * 2000);
    }
}

function createKillFeedEffect(container) {
    // Create multiple kill feed notifications
    for (let feed = 0; feed < 3; feed++) {
        setTimeout(() => {
            const killFeed = document.createElement('div');
            killFeed.className = 'kill-feed';
            killFeed.innerHTML = `<div class="kill-feed-text">${feed === 0 ? 'ELIMINATED' : feed === 1 ? 'DOUBLE KILL' : 'TRIPLE KILL'}</div>`;
            killFeed.style.cssText = `
                position: absolute;
                top: ${20 + feed * 25}%;
                right: -100%;
                background: linear-gradient(90deg, 
                    rgba(220, 20, 60, ${0.9 - feed * 0.1}), 
                    rgba(139, 0, 0, ${0.9 - feed * 0.1}));
                padding: ${20 + feed * 5}px ${35 + feed * 5}px;
                border-radius: 12px;
                border-left: 8px solid #FF0000;
                animation: killFeedSlide 4s ease-out ${feed * 0.5}s forwards;
                z-index: 10000;
                box-shadow: 0 8px 35px rgba(220, 20, 60, 0.6);
                opacity: 0;
            `;
            
            const killText = killFeed.querySelector('.kill-feed-text');
            killText.style.cssText = `
                color: white;
                font-size: ${28 + feed * 8}px;
                font-weight: bold;
                text-shadow: 0 0 15px rgba(255, 255, 255, 0.7);
                font-family: 'Arial Black', sans-serif;
                letter-spacing: ${3 + feed}px;
            `;
            
            container.appendChild(killFeed);
            
            // Create skull icon for each feed
            const skullIcon = document.createElement('div');
            skullIcon.className = 'skull-icon';
            skullIcon.style.cssText = `
                position: absolute;
                width: ${50 + feed * 10}px;
                height: ${60 + feed * 10}px;
                background: linear-gradient(45deg, white, #F0F0F0);
                border-radius: 50% 50% 0 0;
                top: -${30 + feed * 5}px;
                right: 25px;
                box-shadow: 0 0 25px white;
                animation: skullFloat 2s ease-in-out infinite;
                animation-delay: ${feed * 0.3}s;
            `;
            
            // Skull eyes
            for (let i = 0; i < 2; i++) {
                const eye = document.createElement('div');
                eye.style.cssText = `
                    position: absolute;
                    width: ${12 + feed * 2}px;
                    height: ${12 + feed * 2}px;
                    background: radial-gradient(circle, black, #333);
                    border-radius: 50%;
                    top: ${20 + feed * 3}px;
                    ${i === 0 ? 'left: 12px' : 'right: 12px'};
                    box-shadow: 0 0 10px black;
                `;
                skullIcon.appendChild(eye);
            }
            
            // Skull mouth
            const mouth = document.createElement('div');
            mouth.style.cssText = `
                position: absolute;
                width: ${30 + feed * 5}px;
                height: ${15 + feed * 3}px;
                background: radial-gradient(ellipse at center, black, #333);
                border-radius: 0 0 15px 15px;
                bottom: ${15 + feed * 3}px;
                left: ${10 + feed * 2}px;
            `;
            skullIcon.appendChild(mouth);
            
            killFeed.appendChild(skullIcon);
            
            // Create blood splatter for each kill
            for (let i = 0; i < 10; i++) {
                setTimeout(() => {
                    const bloodSplat = document.createElement('div');
                    bloodSplat.className = 'blood-splat';
                    bloodSplat.style.cssText = `
                        position: absolute;
                        width: ${Math.random() * 25 + 15}px;
                        height: ${Math.random() * 25 + 15}px;
                        background: radial-gradient(circle, #FF0000, #8B0000);
                        border-radius: 50% 50% 50% 0;
                        right: ${Math.random() * 100 + 50}px;
                        top: ${20 + feed * 25 + Math.random() * 30}%;
                        transform: rotate(${Math.random() * 360}deg);
                        animation: bloodSplatAnim 3s ease-out forwards;
                        filter: blur(${Math.random() * 3}px);
                        opacity: 0;
                    `;
                    container.appendChild(bloodSplat);
                }, i * 200);
            }
        }, feed * 1500);
    }
    
    // Create kill streak effect
    const killStreak = document.createElement('div');
    killStreak.className = 'kill-streak';
    killStreak.innerHTML = '<div class="kill-streak-text">KILLING SPREE</div>';
    killStreak.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 10001;
    `;
    
    const streakText = killStreak.querySelector('.kill-streak-text');
    streakText.style.cssText = `
        font-size: 64px;
        font-weight: bold;
        color: #FF0000;
        text-shadow: 0 0 35px #FF0000, 0 0 70px #FF0000, 0 0 105px #FF0000;
        animation: killStreakAnim 5.5s ease-out forwards;
        letter-spacing: 6px;
        font-family: 'Arial Black', sans-serif;
        opacity: 0;
    `;
    
    container.appendChild(killStreak);
}

function createSprintEffect(container) {
    // Create continuous motion trails
    let trailCount = 0;
    const trailInterval = setInterval(() => {
        if (trailCount < 80) {
            const trail = document.createElement('div');
            trail.className = 'sprint-trail';
            trail.style.cssText = `
                position: absolute;
                width: ${Math.random() * 150 + 80}px;
                height: 4px;
                background: linear-gradient(90deg, #1E90FF, rgba(30, 144, 255, 0.7), transparent);
                left: ${Math.random() * 100}%;
                top: ${Math.random() * 100}%;
                transform: rotate(${Math.random() * 30 - 15}deg);
                animation: sprintTrailAnim 2.5s ease-out forwards;
                filter: blur(3px);
                opacity: 0;
            `;
            container.appendChild(trail);
            trailCount++;
        } else {
            clearInterval(trailInterval);
        }
    }, 60);
    
    // Create wind lines continuously
    let windCount = 0;
    const windInterval = setInterval(() => {
        if (windCount < 60) {
            const windLine = document.createElement('div');
            windLine.className = 'wind-line';
            windLine.style.cssText = `
                position: absolute;
                width: 3px;
                height: ${Math.random() * 80 + 40}px;
                background: linear-gradient(to bottom, #1E90FF, rgba(30, 144, 255, 0.5), transparent);
                left: ${Math.random() * 100}%;
                top: ${Math.random() * 100}%;
                animation: windLineAnim ${Math.random() * 2 + 1.5}s linear infinite;
                filter: blur(2px);
                opacity: ${Math.random() * 0.5 + 0.3};
            `;
            container.appendChild(windLine);
            windCount++;
        } else {
            clearInterval(windInterval);
        }
    }, 80);
    
    // Create speed bursts
    for (let burst = 0; burst < 5; burst++) {
        setTimeout(() => {
            const speedBurst = document.createElement('div');
            speedBurst.className = 'speed-burst';
            speedBurst.style.cssText = `
                position: absolute;
                width: ${200 + burst * 50}px;
                height: ${200 + burst * 50}px;
                background: radial-gradient(circle, rgba(30, 144, 255, 0.2), transparent 70%);
                border-radius: 50%;
                left: ${Math.random() * 100}%;
                top: ${Math.random() * 100}%;
                transform: translate(-50%, -50%);
                animation: speedBurstAnim 3s ease-out ${burst * 0.3}s forwards;
                filter: blur(25px);
                opacity: 0;
            `;
            container.appendChild(speedBurst);
            
            // Create burst particles
            for (let i = 0; i < 20; i++) {
                setTimeout(() => {
                    const burstParticle = document.createElement('div');
                    burstParticle.className = 'burst-particle';
                    burstParticle.style.cssText = `
                        position: absolute;
                        width: ${Math.random() * 8 + 4}px;
                        height: ${Math.random() * 8 + 4}px;
                        background: radial-gradient(circle, #1E90FF, #00BFFF);
                        border-radius: 50%;
                        left: ${Math.random() * 100}%;
                        top: ${Math.random() * 100}%;
                        animation: burstParticleAnim 2.5s ease-out forwards;
                        box-shadow: 0 0 20px #1E90FF;
                        filter: blur(1px);
                        opacity: 0;
                    `;
                    container.appendChild(burstParticle);
                }, i * 100);
            }
        }, burst * 1000);
    }
    
    // Create motion blur overlay
    const motionBlur = document.createElement('div');
    motionBlur.className = 'motion-blur';
    motionBlur.style.cssText = `
        position: absolute;
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, 
            transparent 0%, 
            rgba(30, 144, 255, 0.05) 20%,
            rgba(30, 144, 255, 0.1) 50%,
            rgba(30, 144, 255, 0.05) 80%,
            transparent 100%);
        animation: motionBlurWave 5s linear infinite;
        filter: blur(8px);
        opacity: 0.4;
    `;
    container.appendChild(motionBlur);
}

function createVictoryRoyaleEffect(container) {
    // Create victory crown with pulsing effect
    const crown = document.createElement('div');
    crown.className = 'victory-crown';
    crown.style.cssText = `
        position: absolute;
        width: 180px;
        height: 120px;
        background: linear-gradient(45deg, #FFD700, #FFA500, #FFD700, #FFA500);
        clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);
        left: 50%;
        top: 20%;
        transform: translateX(-50%);
        animation: crownFloat 7.5s ease-in-out infinite;
        filter: drop-shadow(0 0 40px #FFD700);
        z-index: 10000;
        opacity: 0;
    `;
    container.appendChild(crown);
    
    // Create multiple victory texts
    for (let text = 0; text < 3; text++) {
        setTimeout(() => {
            const victoryText = document.createElement('div');
            victoryText.className = 'victory-text';
            victoryText.innerHTML = '<div class="victory-text-content">VICTORY<br>ROYALE</div>';
            victoryText.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                text-align: center;
                z-index: 10000;
                animation: victoryTextFloat 4s ease-in-out ${text * 1.5}s infinite;
            `;
            
            const textContent = victoryText.querySelector('.victory-text-content');
            textContent.style.cssText = `
                font-size: ${96 - text * 20}px;
                font-weight: bold;
                color: #FFD700;
                text-shadow: 
                    0 0 40px #FFD700, 
                    0 0 80px #FF6B00, 
                    0 0 120px #FF4500,
                    0 0 160px #FF0000;
                line-height: 1.2;
                font-family: 'Arial Black', sans-serif;
                letter-spacing: 6px;
                opacity: ${0.8 - text * 0.2};
            `;
            
            container.appendChild(victoryText);
        }, text * 500);
    }
    
    // Create continuous confetti
    let confettiCount = 0;
    const confettiInterval = setInterval(() => {
        if (confettiCount < 200) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.cssText = `
                position: absolute;
                width: ${Math.random() * 20 + 10}px;
                height: ${Math.random() * 20 + 10}px;
                background: ${confettiCount % 5 === 0 ? '#FF0000' : 
                            confettiCount % 5 === 1 ? '#00FF00' : 
                            confettiCount % 5 === 2 ? '#0000FF' : 
                            confettiCount % 5 === 3 ? '#FFD700' : 
                            '#FF00FF'};
                left: ${Math.random() * 100}%;
                top: ${Math.random() * 100}%;
                animation: confettiFall ${Math.random() * 3 + 2}s linear infinite;
                opacity: ${Math.random() * 0.7 + 0.3};
                border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
                transform: rotate(${Math.random() * 360}deg);
                box-shadow: 0 0 15px currentColor;
            `;
            container.appendChild(confetti);
            confettiCount++;
        } else {
            clearInterval(confettiInterval);
        }
    }, 30);
    
    // Create light rays
    for (let i = 0; i < 16; i++) {
        const lightRay = document.createElement('div');
        lightRay.className = 'light-ray';
        lightRay.style.cssText = `
            position: absolute;
            width: 6px;
            height: 400px;
            background: linear-gradient(to bottom, 
                rgba(255, 215, 0, 0.6), 
                rgba(255, 215, 0, 0.3), 
                transparent);
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%) rotate(${i * 22.5}deg);
            transform-origin: center bottom;
            animation: lightRayRotate 15s linear infinite;
            filter: blur(3px);
            opacity: 0.6;
        `;
        container.appendChild(lightRay);
    }
    
    // Create victory particles
    for (let i = 0; i < 50; i++) {
        setTimeout(() => {
            const victoryParticle = document.createElement('div');
            victoryParticle.className = 'victory-particle';
            victoryParticle.style.cssText = `
                position: absolute;
                width: ${Math.random() * 15 + 8}px;
                height: ${Math.random() * 15 + 8}px;
                background: radial-gradient(circle, 
                    ${Math.random() > 0.5 ? '#FFD700' : '#FF6B00'}, 
                    ${Math.random() > 0.5 ? '#FFA500' : '#FF4500'});
                border-radius: 50%;
                left: ${Math.random() * 100}%;
                top: ${Math.random() * 100}%;
                animation: victoryParticleAnim 4s ease-out ${i * 0.1}s forwards;
                box-shadow: 0 0 30px #FFD700;
                filter: blur(${Math.random()}px);
                opacity: 0;
            `;
            container.appendChild(victoryParticle);
        }, i * 100);
    }
    
    // Create victory platform
    const victoryPlatform = document.createElement('div');
    victoryPlatform.className = 'victory-platform';
    victoryPlatform.style.cssText = `
        position: absolute;
        width: 400px;
        height: 100px;
        background: linear-gradient(45deg, 
            rgba(255, 215, 0, 0.2), 
            rgba(255, 107, 0, 0.1), 
            rgba(255, 215, 0, 0.2));
        left: 50%;
        top: 80%;
        transform: translateX(-50%);
        animation: platformGlow 7.5s ease-in-out infinite;
        filter: blur(20px);
        border-radius: 50px;
        opacity: 0.5;
    `;
    container.appendChild(victoryPlatform);
}

// Load visual animation styles with LONG DURATION animations
function loadVisualAnimationStyles() {
    if (document.getElementById('visual-animation-styles')) return;

    const styles = `
        /* Visual Animation Library Styles */
        .visual-animation-btn {
            background: linear-gradient(135deg, #FF6B00 0%, #FF9500 100%);
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
        
        .visual-animation-btn:hover { 
            background: linear-gradient(135deg, #FF9500 0%, #FF6B00 100%);
            transform: scale(1.1); 
            box-shadow: 0 6px 20px rgba(255, 107, 0, 0.5);
        }
        
        .visual-animation-modal { 
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
        
        .visual-animation-modal-content { 
            background: linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 100%);
            border-radius: 15px; 
            width: 95%; 
            max-width: 550px; 
            max-height: 85vh; 
            overflow: hidden; 
            box-shadow: 0 20px 60px rgba(255, 107, 0, 0.3);
            border: 3px solid #ff6b00;
        }
        
        .visual-animation-modal-header { 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            padding: 20px; 
            background: linear-gradient(135deg, #ff6b00 0%, #ff9500 100%);
            color: white; 
        }
        
        .visual-animation-modal-header h3 { 
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
        
        .visual-animation-grid { 
            display: grid; 
            grid-template-columns: repeat(3, 1fr); 
            gap: 20px; 
            padding: 25px;
            max-height: 450px;
            overflow-y: auto;
        }
        
        @media (max-width: 480px) {
            .visual-animation-grid { 
                grid-template-columns: repeat(2, 1fr); 
            }
        }
        
        .visual-animation-item { 
            display: flex; 
            flex-direction: column; 
            align-items: center; 
            padding: 20px 15px; 
            border-radius: 15px; 
            cursor: pointer; 
            transition: all 0.3s ease; 
            border: 2px solid transparent; 
            position: relative; 
            background: rgba(255, 107, 0, 0.05);
            backdrop-filter: blur(10px);
        }
        
        .visual-animation-item:hover { 
            background: rgba(255, 107, 0, 0.15); 
            transform: translateY(-8px); 
            border-color: #ff6b00;
            box-shadow: 0 12px 25px rgba(255, 107, 0, 0.2);
        }
        
        .visual-animation-item.premium-locked { 
            opacity: 0.6; 
            cursor: not-allowed; 
            filter: grayscale(0.5);
        }
        
        .visual-animation-item.premium-locked::after { 
            content: '👑'; 
            position: absolute; 
            top: 10px; 
            right: 10px; 
            font-size: 14px; 
            color: #ffd700;
        }
        
        .visual-animation-preview {
            width: 80px;
            height: 80px;
            border-radius: 15px;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            overflow: hidden;
        }
        
        .visual-animation-effect {
            width: 100%;
            height: 100%;
        }
        
        .visual-animation-name { 
            font-size: 0.9rem; 
            text-align: center; 
            text-transform: uppercase; 
            color: #e2e8f0; 
            font-weight: 600;
            letter-spacing: 0.5px;
            margin-bottom: 5px;
        }
        
        .visual-animation-desc {
            font-size: 0.75rem;
            text-align: center;
            color: #a0aec0;
            font-weight: 500;
        }
        
        .visual-animation-premium-notice { 
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
        
        .visual-animation-premium-notice i { 
            color: #000; 
            font-size: 18px;
        }
        
        /* Preview animations */
        .fireStrike-preview {
            background: radial-gradient(circle, #FF6B00 0%, transparent 70%);
            animation: previewPulse 2s infinite;
        }
        
        .headshotEffect-preview {
            background: linear-gradient(45deg, #FF0000 25%, transparent 25%, transparent 75%, #FF0000 75%);
            background-size: 20px 20px;
            animation: previewShake 2s infinite;
        }
        
        .swordSlash-preview {
            background: linear-gradient(45deg, transparent 45%, #00FF00 45%, #00FF00 55%, transparent 55%);
            animation: previewSlash 2s infinite;
        }
        
        .shieldUp-preview {
            background: 
                radial-gradient(circle at 30% 30%, #00FFFF 5%, transparent 5%),
                radial-gradient(circle at 70% 70%, #00FFFF 5%, transparent 5%),
                radial-gradient(circle at 30% 70%, #00FFFF 5%, transparent 5%),
                radial-gradient(circle at 70% 30%, #00FFFF 5%, transparent 5%);
            background-size: 100% 100%;
            animation: previewShield 3s infinite;
        }
        
        .grenadeExplosion-preview {
            background: radial-gradient(circle, #FF4500 0%, #FF0000 50%, transparent 70%);
            animation: previewExplosion 2s infinite;
        }
        
        .speedBoost-preview {
            background: linear-gradient(90deg, transparent 30%, #FFFF00 50%, transparent 70%);
            background-size: 200% 100%;
            animation: previewSpeed 1s infinite linear;
        }
        
        .rankUp-preview {
            background: linear-gradient(45deg, #FFD700 25%, transparent 25%, transparent 75%, #FFD700 75%);
            background-size: 20px 20px;
            animation: previewSparkle 2s infinite;
        }
        
        .coinRain-preview {
            background: 
                radial-gradient(circle at 20% 30%, #FFD700 10%, transparent 10%),
                radial-gradient(circle at 50% 50%, #FFD700 10%, transparent 10%),
                radial-gradient(circle at 80% 70%, #FFD700 10%, transparent 10%);
            animation: previewRain 2s infinite;
        }
        
        .comboAttack-preview {
            background: 
                linear-gradient(45deg, transparent 45%, #FF00FF 45%, #FF00FF 55%, transparent 55%),
                linear-gradient(-45deg, transparent 45%, #FF00FF 45%, #FF00FF 55%, transparent 55%);
            animation: previewCombo 2s infinite;
        }
        
        .damageHit-preview {
            background: radial-gradient(circle, #FF1493 0%, transparent 60%);
            animation: previewDamage 2s infinite;
        }
        
        .airdropFall-preview {
            background: 
                radial-gradient(ellipse at 30% 20%, #3498DB 10%, transparent 10%),
                radial-gradient(circle at 50% 50%, #E74C3C 20%, transparent 20%),
                radial-gradient(ellipse at 70% 80%, #1ABC9C 15%, transparent 15%);
            animation: previewAirdrop 3s infinite ease-in-out;
        }
        
        .arrowShot-preview {
            background: linear-gradient(45deg, transparent 45%, #8B4513 45%, #8B4513 55%, transparent 55%);
            animation: previewArrow 2s infinite;
        }
        
        .killFeed-preview {
            background: linear-gradient(45deg, #DC143C 0%, #8B0000 100%);
            animation: previewKillFeed 2s infinite;
        }
        
        .sprintEffect-preview {
            background: linear-gradient(90deg, transparent 30%, #1E90FF 50%, transparent 70%);
            background-size: 200% 100%;
            animation: previewSprint 1s infinite linear;
        }
        
        .victoryRoyale-preview {
            background: 
                radial-gradient(circle at center, #FFD700 0%, transparent 70%),
                linear-gradient(45deg, transparent 45%, #FF6B00 45%, #FF6B00 55%, transparent 55%),
                linear-gradient(-45deg, transparent 45%, #FF6B00 45%, #FF6B00 55%, transparent 55%);
            animation: previewVictory 4s infinite;
        }
        
        /* Preview Animation Keyframes */
        @keyframes previewPulse {
            0%, 100% { transform: scale(1); opacity: 0.7; }
            50% { transform: scale(1.2); opacity: 1; }
        }
        
        @keyframes previewShake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-5px); }
            75% { transform: translateX(5px); }
        }
        
        @keyframes previewSlash {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        @keyframes previewShield {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
        }
        
        @keyframes previewExplosion {
            0% { transform: scale(0.5); opacity: 0; }
            50% { transform: scale(1.2); opacity: 1; }
            100% { transform: scale(1); opacity: 0.7; }
        }
        
        @keyframes previewSpeed {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
        }
        
        @keyframes previewSparkle {
            0% { background-position: 0 0; }
            100% { background-position: 40px 40px; }
        }
        
        @keyframes previewRain {
            0% { background-position: 0 0; }
            100% { background-position: 0 40px; }
        }
        
        @keyframes previewCombo {
            0% { transform: scale(0.8); }
            50% { transform: scale(1.2); }
            100% { transform: scale(0.8); }
        }
        
        @keyframes previewDamage {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.3); }
        }
        
        @keyframes previewAirdrop {
            0% { transform: translateY(-20px); }
            50% { transform: translateY(0); }
            100% { transform: translateY(-20px); }
        }
        
        @keyframes previewArrow {
            0% { transform: translateX(-20px); }
            50% { transform: translateX(20px); }
            100% { transform: translateX(-20px); }
        }
        
        @keyframes previewKillFeed {
            0%, 100% { opacity: 0.7; }
            50% { opacity: 1; }
        }
        
        @keyframes previewSprint {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
        }
        
        @keyframes previewVictory {
            0% { transform: rotate(0deg) scale(1); }
            50% { transform: rotate(180deg) scale(1.1); }
            100% { transform: rotate(360deg) scale(1); }
        }
        
        /* Visual Animation Effect Container */
        .visual-animation-effect-container { 
            position: fixed; 
            top: 0; 
            left: 0; 
            width: 100%; 
            height: 100%; 
            pointer-events: none; 
            z-index: 9999; 
            overflow: hidden;
        }
        
        /* LONG DURATION ANIMATION KEYFRAMES (5-7 seconds) */
        
        /* Fire Strike Animation (6 seconds) */
        @keyframes fireParticleAnim {
            0% { transform: scale(0) rotate(0deg); opacity: 0; }
            20% { transform: scale(1.2) rotate(180deg); opacity: 1; }
            40% { transform: scale(1) rotate(360deg); opacity: 0.8; }
            60% { transform: scale(0.8) rotate(540deg); opacity: 0.6; }
            80% { transform: scale(0.5) rotate(720deg); opacity: 0.3; }
            100% { transform: scale(0) rotate(900deg); opacity: 0; }
        }
        
        @keyframes fireExplosion {
            0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
            20% { transform: translate(-50%, -50%) scale(2.5); opacity: 0.9; }
            40% { transform: translate(-50%, -50%) scale(2); opacity: 0.8; }
            60% { transform: translate(-50%, -50%) scale(1.5); opacity: 0.6; }
            80% { transform: translate(-50%, -50%) scale(1); opacity: 0.3; }
            100% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
        }
        
        /* Headshot Animation (5.5 seconds) */
        @keyframes headshotTextAnim {
            0% { transform: scale(0.5) translateX(-50%); opacity: 0; text-shadow: 0 0 0 #FF0000; }
            15% { transform: scale(1.3) translateX(-50%); opacity: 1; text-shadow: 0 0 60px #FF0000; }
            30% { transform: scale(1.1) translateX(-50%); opacity: 1; text-shadow: 0 0 80px #FF0000; }
            50% { transform: scale(1) translateX(-50%); opacity: 0.9; text-shadow: 0 0 60px #FF0000; }
            70% { transform: scale(0.9) translateX(-50%); opacity: 0.6; text-shadow: 0 0 40px #FF0000; }
            90% { transform: scale(0.8) translateX(-50%); opacity: 0.3; text-shadow: 0 0 20px #FF0000; }
            100% { transform: scale(0.7) translateX(-50%); opacity: 0; text-shadow: 0 0 0 #FF0000; }
        }
        
        @keyframes bloodSplatterAnim {
            0% { transform: translate(-50%, -50%) scale(0) rotate(0deg); opacity: 0; }
            20% { transform: translate(-50%, -50%) scale(1.8) rotate(180deg); opacity: 0.9; }
            40% { transform: translate(calc(-50% + ${Math.random() * 100 - 50}px), calc(-50% + ${Math.random() * 100 - 50}px)) scale(1.2) rotate(360deg); opacity: 0.7; }
            60% { transform: translate(calc(-50% + ${Math.random() * 200 - 100}px), calc(-50% + ${Math.random() * 200 - 100}px)) scale(0.8) rotate(540deg); opacity: 0.5; }
            80% { transform: translate(calc(-50% + ${Math.random() * 300 - 150}px), calc(-50% + ${Math.random() * 300 - 150}px)) scale(0.4) rotate(720deg); opacity: 0.2; }
            100% { transform: translate(calc(-50% + ${Math.random() * 400 - 200}px), calc(-50% + ${Math.random() * 400 - 200}px)) scale(0.1) rotate(900deg); opacity: 0; }
        }
        
        @keyframes crackAnim {
            0% { transform: translate(-50%, -50%) scale(0) rotate(0deg); opacity: 0; }
            30% { transform: translate(-50%, -50%) scale(2) rotate(0deg); opacity: 1; }
            60% { transform: translate(-50%, -50%) scale(2.5) rotate(0deg); opacity: 0.7; }
            90% { transform: translate(-50%, -50%) scale(3) rotate(0deg); opacity: 0.3; }
            100% { transform: translate(-50%, -50%) scale(3.5) rotate(0deg); opacity: 0; }
        }
        
        /* Sword Slash Animation (5 seconds) */
        @keyframes swordSlashAnim {
            0% { transform: translateX(-150%) rotate(0deg); opacity: 0; }
            20% { transform: translateX(-50%) rotate(180deg); opacity: 1; }
            40% { transform: translateX(50%) rotate(360deg); opacity: 0.8; }
            60% { transform: translateX(150%) rotate(540deg); opacity: 0.5; }
            80% { transform: translateX(250%) rotate(720deg); opacity: 0.2; }
            100% { transform: translateX(350%) rotate(900deg); opacity: 0; }
        }
        
        @keyframes slashImpactAnim {
            0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
            20% { transform: translate(-50%, -50%) scale(1.8); opacity: 1; }
            40% { transform: translate(-50%, -50%) scale(1.5); opacity: 0.8; }
            60% { transform: translate(-50%, -50%) scale(1.2); opacity: 0.6; }
            80% { transform: translate(-50%, -50%) scale(0.8); opacity: 0.3; }
            100% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
        }
        
        @keyframes sparkAnim {
            0% { transform: scale(0) rotate(0deg); opacity: 0; }
            20% { transform: scale(1.2) rotate(180deg); opacity: 1; }
            50% { transform: scale(1) rotate(360deg); opacity: 0.7; }
            80% { transform: scale(0.5) rotate(540deg); opacity: 0.3; }
            100% { transform: scale(0) rotate(720deg); opacity: 0; }
        }
        
        /* Shield Up Animation (6 seconds) */
        @keyframes shieldRingAnim {
            0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
            20% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; }
            40% { transform: translate(-50%, -50%) scale(1); opacity: 0.9; }
            60% { transform: translate(-50%, -50%) scale(0.9); opacity: 0.7; }
            80% { transform: translate(-50%, -50%) scale(0.8); opacity: 0.4; }
            100% { transform: translate(-50%, -50%) scale(0.7); opacity: 0; }
        }
        
        @keyframes shieldEnergyAnim {
            0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.5; }
            50% { transform: translate(-50%, -50%) scale(1.3); opacity: 0.8; }
        }
        
        @keyframes hexagonFloat {
            0%, 100% { transform: translateY(0) rotate(0deg); opacity: 0.6; }
            50% { transform: translateY(-20px) rotate(180deg); opacity: 0.9; }
        }
        
        /* Grenade Explosion Animation (5.5 seconds) */
        @keyframes explosionCoreAnim {
            0% { width: 0; height: 0; opacity: 0; }
            20% { width: 250px; height: 250px; opacity: 1; }
            40% { width: 300px; height: 300px; opacity: 0.9; }
            60% { width: 250px; height: 250px; opacity: 0.7; }
            80% { width: 150px; height: 150px; opacity: 0.4; }
            100% { width: 50px; height: 50px; opacity: 0; }
        }
        
        @keyframes shockwaveAnim {
            0% { width: 0; height: 0; opacity: 0.8; }
            100% { width: 800px; height: 800px; opacity: 0; }
        }
        
        @keyframes debrisAnim {
            0% { transform: translate(-50%, -50%) scale(1) rotate(0deg); opacity: 1; }
            20% { transform: translate(calc(-50% + ${Math.random() * 100 - 50}px), calc(-50% + ${Math.random() * 100 - 50}px)) scale(1.2) rotate(180deg); opacity: 0.9; }
            50% { transform: translate(calc(-50% + ${Math.random() * 200 - 100}px), calc(-50% + ${Math.random() * 200 - 100}px)) scale(1) rotate(360deg); opacity: 0.7; }
            80% { transform: translate(calc(-50% + ${Math.random() * 400 - 200}px), calc(-50% + ${Math.random() * 400 - 200}px)) scale(0.5) rotate(540deg); opacity: 0.3; }
            100% { transform: translate(calc(-50% + ${Math.random() * 600 - 300}px), calc(-50% + ${Math.random() * 600 - 300}px)) scale(0) rotate(720deg); opacity: 0; }
        }
        
        @keyframes screenShake {
            0%, 100% { transform: translateX(0); }
            10%, 30%, 50%, 70%, 90% { transform: translateX(-15px); }
            20%, 40%, 60%, 80% { transform: translateX(15px); }
        }
        
        /* Speed Boost Animation (5 seconds) */
        @keyframes speedLineAnim {
            0% { transform: translateX(0) rotate(0deg); opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 0.7; }
            100% { transform: translateX(400px) rotate(0deg); opacity: 0; }
        }
        
        @keyframes speedTrailAnim {
            0% { transform: translateX(0) rotate(0deg); opacity: 0; }
            20% { opacity: 1; }
            80% { opacity: 0.5; }
            100% { transform: translateX(300px) rotate(0deg); opacity: 0; }
        }
        
        @keyframes afterimageAnim {
            0% { transform: scale(1); opacity: 0; }
            30% { transform: scale(1.5); opacity: 0.5; }
            70% { transform: scale(2); opacity: 0.2; }
            100% { transform: scale(2.5); opacity: 0; }
        }
        
        @keyframes motionBlurWave {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
        }
        
        /* Rank Up Animation (6.5 seconds) */
        @keyframes rankStarAnim {
            0% { transform: scale(0) rotate(0deg); opacity: 0; }
            20% { transform: scale(1.5) rotate(180deg); opacity: 1; }
            40% { transform: scale(1.3) rotate(360deg); opacity: 0.9; }
            60% { transform: scale(1.1) rotate(540deg); opacity: 0.7; }
            80% { transform: scale(0.8) rotate(720deg); opacity: 0.4; }
            100% { transform: scale(0.5) rotate(900deg); opacity: 0; }
        }
        
        @keyframes rankTextAnim {
            0% { transform: scale(0.5) translateX(-50%); opacity: 0; text-shadow: 0 0 0 #FFD700; }
            15% { transform: scale(1.4) translateX(-50%); opacity: 1; text-shadow: 0 0 70px #FFD700; }
            30% { transform: scale(1.2) translateX(-50%); opacity: 1; text-shadow: 0 0 90px #FF6B00; }
            50% { transform: scale(1.1) translateX(-50%); opacity: 0.9; text-shadow: 0 0 70px #FFD700; }
            70% { transform: scale(0.9) translateX(-50%); opacity: 0.6; text-shadow: 0 0 50px #FFD700; }
            90% { transform: scale(0.7) translateX(-50%); opacity: 0.3; text-shadow: 0 0 30px #FFD700; }
            100% { transform: scale(0.5) translateX(-50%); opacity: 0; text-shadow: 0 0 0 #FFD700; }
        }
        
        @keyframes levelParticleAnim {
            0% { transform: translateY(0) scale(0); opacity: 0; }
            20% { transform: translateY(-50px) scale(1.2); opacity: 1; }
            50% { transform: translateY(-100px) scale(1); opacity: 0.8; }
            80% { transform: translateY(-150px) scale(0.5); opacity: 0.3; }
            100% { transform: translateY(-200px) scale(0); opacity: 0; }
        }
        
        @keyframes rankCircleAnim {
            0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
            30% { transform: translate(-50%, -50%) scale(1.2); opacity: 0.8; }
            60% { transform: translate(-50%, -50%) scale(1); opacity: 0.6; }
            90% { transform: translate(-50%, -50%) scale(0.8); opacity: 0.3; }
            100% { transform: translate(-50%, -50%) scale(0.6); opacity: 0; }
        }
        
        /* Coin Rain Animation (6 seconds) */
        @keyframes coinRainAnim {
            0% { transform: translateY(0) rotateY(0deg); opacity: 0; }
            10% { opacity: 1; }
            20% { transform: translateY(20vh) rotateY(180deg); }
            40% { transform: translateY(40vh) rotateY(360deg); }
            60% { transform: translateY(60vh) rotateY(540deg); opacity: 0.8; }
            80% { transform: translateY(80vh) rotateY(720deg); opacity: 0.5; }
            100% { transform: translateY(100vh) rotateY(900deg); opacity: 0; }
        }
        
        @keyframes coinGlowAnim {
            0%, 100% { transform: scale(1); opacity: 0.6; }
            50% { transform: scale(1.2); opacity: 0.9; }
        }
        
        @keyframes coinPileAnim {
            0% { transform: translateX(-50%) scale(0); opacity: 0; }
            30% { transform: translateX(-50%) scale(1.5); opacity: 0.8; }
            60% { transform: translateX(-50%) scale(1.2); opacity: 0.6; }
            90% { transform: translateX(-50%) scale(1); opacity: 0.3; }
            100% { transform: translateX(-50%) scale(0.8); opacity: 0; }
        }
        
        /* Combo Attack Animation (5.5 seconds) */
        @keyframes comboNumberAnim {
            0% { transform: translateX(-50%) scale(0.5); opacity: 0; }
            20% { transform: translateX(-50%) scale(1.3); opacity: 1; }
            40% { transform: translateX(-50%) scale(1.1); opacity: 0.9; }
            60% { transform: translateX(-50%) scale(0.9); opacity: 0.7; }
            80% { transform: translateX(-50%) scale(0.7); opacity: 0.4; }
            100% { transform: translateX(-50%) scale(0.5); opacity: 0; }
        }
        
        @keyframes comboPulseAnim {
            0% { width: 0; height: 0; opacity: 1; }
            100% { width: 700px; height: 700px; opacity: 0; }
        }
        
        @keyframes hitMarkerAnim {
            0% { transform: scale(0); opacity: 0; }
            30% { transform: scale(1.5); opacity: 0.8; }
            60% { transform: scale(1.2); opacity: 0.6; }
            90% { transform: scale(0.8); opacity: 0.3; }
            100% { transform: scale(0.5); opacity: 0; }
        }
        
        @keyframes comboStreakAnim {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
        }
        
        /* Damage Hit Animation (5 seconds) */
        @keyframes damageImpactAnim {
            0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
            20% { transform: translate(-50%, -50%) scale(2); opacity: 1; }
            40% { transform: translate(-50%, -50%) scale(1.8); opacity: 0.8; }
            60% { transform: translate(-50%, -50%) scale(1.5); opacity: 0.6; }
            80% { transform: translate(-50%, -50%) scale(1.2); opacity: 0.3; }
            100% { transform: translate(-50%, -50%) scale(1); opacity: 0; }
        }
        
        @keyframes damageCrackAnim {
            0% { transform: translate(-50%, -50%) scale(0) rotate(0deg); opacity: 0; }
            30% { transform: translate(-50%, -50%) scale(2) rotate(0deg); opacity: 1; }
            60% { transform: translate(-50%, -50%) scale(2.5) rotate(0deg); opacity: 0.7; }
            90% { transform: translate(-50%, -50%) scale(3) rotate(0deg); opacity: 0.3; }
            100% { transform: translate(-50%, -50%) scale(3.5) rotate(0deg); opacity: 0; }
        }
        
        @keyframes damageParticleAnim {
            0% { transform: scale(0) rotate(0deg); opacity: 0; }
            20% { transform: scale(1.2) rotate(180deg); opacity: 1; }
            50% { transform: scale(1) rotate(360deg); opacity: 0.8; }
            80% { transform: scale(0.5) rotate(540deg); opacity: 0.3; }
            100% { transform: scale(0) rotate(720deg); opacity: 0; }
        }
        
        /* Airdrop Animation (7 seconds) */
        @keyframes helicopterFlyIn {
            0% { left: -200px; top: -150px; opacity: 0; }
            15% { left: 10%; top: 20%; opacity: 1; }
            30% { left: 30%; top: 25%; }
            45% { left: 50%; top: 20%; }
            60% { left: 70%; top: 25%; }
            75% { left: 90%; top: 20%; opacity: 1; }
            90% { left: 110%; top: -150px; opacity: 0; }
            100% { left: 110%; top: -150px; opacity: 0; }
        }
        
        @keyframes rotorSpin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        @keyframes tailRotorSpin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        @keyframes crateRelease {
            0% { top: 100px; opacity: 0; transform: translateX(-50%) scale(0.5); }
            20% { top: 30%; opacity: 1; transform: translateX(-50%) scale(1); }
            40% { top: 50%; transform: translateX(-50%) scale(1); }
            60% { top: 70%; transform: translateX(-50%) scale(1); }
            80% { top: 85%; opacity: 1; transform: translateX(-50%) scale(1); }
            100% { top: 85%; opacity: 1; transform: translateX(-50%) scale(1); }
        }
        
        @keyframes parachuteFloat {
            0% { top: 30px; opacity: 0; transform: translateX(-50%) scale(0.8); }
            20% { top: 10%; opacity: 1; transform: translateX(-50%) scale(1); }
            40% { top: 30%; transform: translateX(-50%) scale(1); }
            60% { top: 50%; transform: translateX(-50%) scale(1); }
            80% { top: 65%; opacity: 1; transform: translateX(-50%) scale(1); }
            100% { top: 65%; opacity: 0; transform: translateX(-50%) scale(0.8); }
        }
        
        @keyframes lineSwing {
            0%, 100% { transform: translateX(0) rotate(0deg); }
            50% { transform: translateX(10px) rotate(10deg); }
        }
        
        @keyframes landingDust {
            0% { transform: translateX(-50%) scale(0); opacity: 0; }
            30% { transform: translateX(-50%) scale(2); opacity: 0.9; }
            60% { transform: translateX(-50%) scale(2.5); opacity: 0.6; }
            90% { transform: translateX(-50%) scale(3); opacity: 0.3; }
            100% { transform: translateX(-50%) scale(3.5); opacity: 0; }
        }
        
        @keyframes supplyGlowPulse {
            0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.6; }
            50% { transform: translate(-50%, -50%) scale(1.3); opacity: 0.9; }
        }
        
        @keyframes lootBurst {
            0% { transform: translate(-50%, -50%) scale(1) rotate(0deg); opacity: 0; }
            20% { opacity: 1; }
            50% { opacity: 0.8; }
            80% { opacity: 0.3; }
            100% { 
                transform: translate(
                    calc(-50% + ${Math.random() * 300 - 150}px), 
                    calc(-50% + ${Math.random() * 300 - 150}px)
                ) scale(0) rotate(1080deg); 
                opacity: 0; 
            }
        }
        
        @keyframes lootRadianceAnim {
            0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.8; }
            50% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; }
        }
        
        /* Arrow Shot Animation (5 seconds) */
        @keyframes arrowShotAnim {
            0% { left: -150px; opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 0.8; }
            100% { left: 100%; opacity: 0; }
        }
        
        @keyframes targetHitAnim {
            0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
            20% { transform: translate(-50%, -50%) scale(1.3); opacity: 1; }
            40% { transform: translate(-50%, -50%) scale(1.1); opacity: 0.8; }
            60% { transform: translate(-50%, -50%) scale(0.9); opacity: 0.6; }
            80% { transform: translate(-50%, -50%) scale(0.7); opacity: 0.3; }
            100% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
        }
        
        @keyframes impactParticleAnim {
            0% { transform: scale(0) rotate(0deg); opacity: 0; }
            20% { transform: scale(1.2) rotate(180deg); opacity: 1; }
            50% { transform: scale(1) rotate(360deg); opacity: 0.8; }
            80% { transform: scale(0.5) rotate(540deg); opacity: 0.3; }
            100% { transform: scale(0) rotate(720deg); opacity: 0; }
        }
        
        /* Kill Feed Animation (5.5 seconds) */
        @keyframes killFeedSlide {
            0% { right: -100%; opacity: 0; }
            15% { right: 20px; opacity: 1; }
            70% { right: 20px; opacity: 1; }
            85% { right: -100%; opacity: 0; }
            100% { right: -100%; opacity: 0; }
        }
        
        @keyframes skullFloat {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
        }
        
        @keyframes bloodSplatAnim {
            0% { transform: scale(0) rotate(0deg); opacity: 0; }
            20% { transform: scale(1.5) rotate(180deg); opacity: 1; }
            50% { transform: scale(1.2) rotate(360deg); opacity: 0.7; }
            80% { transform: scale(0.8) rotate(540deg); opacity: 0.3; }
            100% { transform: scale(0.5) rotate(720deg); opacity: 0; }
        }
        
        @keyframes killStreakAnim {
            0% { transform: scale(0.5) translate(-50%, -50%); opacity: 0; text-shadow: 0 0 0 #FF0000; }
            20% { transform: scale(1.3) translate(-50%, -50%); opacity: 1; text-shadow: 0 0 50px #FF0000; }
            40% { transform: scale(1.2) translate(-50%, -50%); opacity: 1; text-shadow: 0 0 70px #FF0000; }
            60% { transform: scale(1.1) translate(-50%, -50%); opacity: 0.8; text-shadow: 0 0 50px #FF0000; }
            80% { transform: scale(0.9) translate(-50%, -50%); opacity: 0.5; text-shadow: 0 0 30px #FF0000; }
            100% { transform: scale(0.7) translate(-50%, -50%); opacity: 0; text-shadow: 0 0 0 #FF0000; }
        }
        
        /* Sprint Animation (5 seconds) */
        @keyframes sprintTrailAnim {
            0% { transform: translateX(0) rotate(0deg); opacity: 0; }
            20% { opacity: 1; }
            80% { opacity: 0.6; }
            100% { transform: translateX(500px) rotate(0deg); opacity: 0; }
        }
        
        @keyframes windLineAnim {
            0% { transform: translateY(-100px); opacity: 0; }
            20% { opacity: 1; }
            80% { opacity: 0.5; }
            100% { transform: translateY(200px); opacity: 0; }
        }
        
        @keyframes speedBurstAnim {
            0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
            30% { transform: translate(-50%, -50%) scale(1.5); opacity: 0.8; }
            60% { transform: translate(-50%, -50%) scale(1.2); opacity: 0.6; }
            90% { transform: translate(-50%, -50%) scale(0.8); opacity: 0.3; }
            100% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
        }
        
        @keyframes burstParticleAnim {
            0% { transform: scale(0) rotate(0deg); opacity: 0; }
            20% { transform: scale(1.2) rotate(180deg); opacity: 1; }
            50% { transform: scale(1) rotate(360deg); opacity: 0.8; }
            80% { transform: scale(0.5) rotate(540deg); opacity: 0.3; }
            100% { transform: scale(0) rotate(720deg); opacity: 0; }
        }
        
        /* Victory Royale Animation (7.5 seconds) */
        @keyframes crownFloat {
            0%, 100% { transform: translateX(-50%) translateY(0) rotate(0deg); opacity: 0; }
            10% { opacity: 1; }
            30% { transform: translateX(-50%) translateY(-30px) rotate(5deg); opacity: 1; }
            50% { transform: translateX(-50%) translateY(0) rotate(0deg); opacity: 1; }
            70% { transform: translateX(-50%) translateY(-30px) rotate(-5deg); opacity: 1; }
            90% { transform: translateX(-50%) translateY(0) rotate(0deg); opacity: 1; }
            100% { transform: translateX(-50%) translateY(0) rotate(0deg); opacity: 0; }
        }
        
        @keyframes victoryTextFloat {
            0%, 100% { transform: translate(-50%, -50%) scale(1) rotate(0deg); }
            25% { transform: translate(-50%, -50%) scale(1.1) rotate(2deg); }
            75% { transform: translate(-50%, -50%) scale(1.1) rotate(-2deg); }
        }
        
        @keyframes confettiFall {
            0% { transform: translateY(-100px) rotate(0deg); opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 1; }
            100% { transform: translateY(100vh) rotate(1440deg); opacity: 0; }
        }
        
        @keyframes lightRayRotate {
            0% { transform: translate(-50%, -50%) rotate(0deg); }
            100% { transform: translate(-50%, -50%) rotate(360deg); }
        }
        
        @keyframes victoryParticleAnim {
            0% { transform: scale(0) rotate(0deg); opacity: 0; }
            20% { transform: scale(1.2) rotate(180deg); opacity: 1; }
            50% { transform: scale(1) rotate(360deg); opacity: 0.8; }
            80% { transform: scale(0.5) rotate(540deg); opacity: 0.3; }
            100% { transform: scale(0) rotate(720deg); opacity: 0; }
        }
        
        @keyframes platformGlow {
            0%, 100% { transform: translateX(-50%) scale(1); opacity: 0.5; }
            50% { transform: translateX(-50%) scale(1.1); opacity: 0.8; }
        }
        
        /* Responsive adjustments */
        @media (max-width: 768px) {
            .visual-animation-modal-content {
                width: 98%;
                max-height: 90vh;
            }
            
            .visual-animation-grid {
                gap: 15px;
            }
            
            .visual-animation-item {
                padding: 15px 10px;
            }
            
            .visual-animation-preview {
                width: 60px;
                height: 60px;
            }
        }
    `;

    const styleSheet = document.createElement('style');
    styleSheet.id = 'visual-animation-styles';
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
}

// Simple notification function
window.showVisualNotification = function(message, type = 'info') {
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
if (!document.getElementById('visual-notification-animations')) {
    const animationStyles = document.createElement('style');
    animationStyles.id = 'visual-notification-animations';
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

// Clean up when page unloads
window.addEventListener('beforeunload', () => {
    cleanupAnimationListener();
});

// Export for use with group.js
window.visualAnimations = {
    VISUAL_ANIMATIONS,
    triggerVisualAnimation,
    showVisualNotification,
    initGroupAnimationLibrary
};