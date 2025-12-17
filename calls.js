// calls.js - COMPLETE Voice Call System with Voice Channels
// UPGRADED VERSION: Supports multiple voice channels per group, persistent mini player

// Firebase imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    getFirestore,
    collection,
    doc,
    setDoc,
    onSnapshot,
    serverTimestamp,
    getDoc,
    deleteDoc,
    getDocs,
    query,
    where,
    updateDoc,
    increment,
    arrayUnion,
    arrayRemove
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Use existing Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyC9uL_BX14Z6rRpgG4MT9Tca1opJl8EviQ",
    authDomain: "dating-connect.firebaseapp.com",
    projectId: "dating-connect",
    storageBucket: "dating-connect.appspot.com",
    messagingSenderId: "1062172180210",
    appId: "1:1062172180210:web:0c9b3c1578a5dbae58da6b"
};

// WebRTC configuration - OPTIMIZED for voice channels
const rtcConfiguration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' }
    ],
    iceCandidatePoolSize: 10,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
    sdpSemantics: 'unified-plan',
    offerToReceiveAudio: true,
    offerToReceiveVideo: false
};

// Global variables
let localStream = null;
let remoteStreams = new Map();
let peerConnections = new Map();
let currentUser = null;
let db = null;
let auth = null;
let activeCallId = null;
let currentCallType = null;
let currentCallPartnerId = null;
let currentGroupId = null;
let isCaller = false;
let isMuted = false;
let callStartTime = null;
let callDurationInterval = null;
let callTimeout = null;
let signalingUnsubscribers = new Map();
let isRinging = false;
let callRingtone = null;
let callNotificationSound = null;
let userCache = new Map();
let currentCallData = null;
let isCallActive = false;

// NEW: Voice Channel System Variables
let activeVoiceChannels = new Map(); // groupId -> array of channel objects
let userVoiceChannel = new Map(); // userId -> { groupId, channelId, joinedAt }
let voiceChannelListeners = new Map(); // groupId -> unsubscribe function
let miniPlayer = null;
let persistentMiniPlayer = null;
let isInVoiceChannel = false;
let currentVoiceChannel = null;
let channelParticipants = new Map(); // channelId -> Set of userIds
let MAX_CHANNELS_PER_GROUP = 20;
let MAX_USERS_PER_CHANNEL = 30;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('calls.js: DOM loaded - Voice Channel System');
    
    // Initialize Firebase
    try {
        const app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        
        preloadNotificationSounds();
        console.log('calls.js: Firebase initialized');
    } catch (error) {
        console.error('calls.js: Firebase initialization failed:', error);
        showNotification('Firebase initialization failed. Please refresh the page.', 'error');
        return;
    }
    
    // Set up auth state listener
    onAuthStateChanged(auth, function(user) {
        console.log('calls.js: Auth state changed, user:', user ? 'logged in' : 'logged out');
        if (user) {
            currentUser = user;
            
            // Check if we're on call page
            const isCallPage = window.location.pathname.includes('calls.html');
            
            if (isCallPage) {
                console.log('calls.js: On call page, handling call');
                handleCallPage();
            } else {
                console.log('calls.js: On chat page, setting up listeners');
                setupCallButtonListeners();
                setupCallNotificationsListener();
                
                // Setup voice channel listeners for all groups user is in
                setupVoiceChannelListeners();
                
                // Create mini player if user is in a voice channel
                checkUserVoiceChannelStatus();
            }
        } else {
            showNotification('Please log in to use voice channels.', 'error');
            removePersistentMiniPlayer();
        }
    });
});

// NEW: Setup voice channel listeners for all groups
async function setupVoiceChannelListeners() {
    if (!currentUser || !db) return;
    
    console.log('calls.js: Setting up voice channel listeners');
    
    try {
        // Get all groups user is member of
        const groupsRef = collection(db, 'groups');
        const groupsSnapshot = await getDocs(groupsRef);
        
        for (const groupDoc of groupsSnapshot.docs) {
            const groupId = groupDoc.id;
            const memberRef = doc(db, 'groups', groupId, 'members', currentUser.uid);
            const memberSnap = await getDoc(memberRef);
            
            if (memberSnap.exists()) {
                setupVoiceChannelListenerForGroup(groupId);
            }
        }
    } catch (error) {
        console.error('calls.js: Error setting up voice channel listeners:', error);
    }
}

// NEW: Setup listener for voice channels in a specific group
function setupVoiceChannelListenerForGroup(groupId) {
    if (voiceChannelListeners.has(groupId)) {
        voiceChannelListeners.get(groupId)();
    }
    
    const channelsRef = collection(db, 'voice_channels', groupId, 'channels');
    const unsubscribe = onSnapshot(channelsRef, (snapshot) => {
        console.log(`calls.js: Voice channels update for group ${groupId}:`, snapshot.docs.length);
        
        const channels = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            channels.push({
                id: doc.id,
                ...data,
                createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
                participants: data.participants || []
            });
        });
        
        // Sort by participant count (most active first)
        channels.sort((a, b) => b.participants.length - a.participants.length);
        
        activeVoiceChannels.set(groupId, channels);
        
        // Update UI if on group page
        if (window.location.pathname.includes('group.html')) {
            const urlParams = new URLSearchParams(window.location.search);
            const currentGroupId = urlParams.get('id');
            if (currentGroupId === groupId) {
                updateVoiceChannelsUI(channels);
            }
        }
        
        // Check if user is in any voice channel
        checkUserVoiceChannelStatus();
    });
    
    voiceChannelListeners.set(groupId, unsubscribe);
}

// NEW: Update voice channels UI in group page
function updateVoiceChannelsUI(channels) {
    const container = document.getElementById('voiceChannelsContainer');
    if (!container) {
        // Create container if it doesn't exist
        createVoiceChannelsUI();
        return;
    }
    
    if (channels.length === 0) {
        container.innerHTML = `
            <div class="no-voice-channels">
                <i class="fas fa-volume-mute"></i>
                <p>No active voice channels</p>
                <button id="startFirstVoiceChannel" class="start-voice-channel-btn">
                    <i class="fas fa-plus"></i> Start First Voice Channel
                </button>
            </div>
        `;
        
        const startBtn = document.getElementById('startFirstVoiceChannel');
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                const urlParams = new URLSearchParams(window.location.search);
                const groupId = urlParams.get('id');
                if (groupId) {
                    createVoiceChannel(groupId);
                }
            });
        }
        return;
    }
    
    container.innerHTML = '';
    
    channels.forEach(channel => {
        const channelElement = document.createElement('div');
        channelElement.className = 'voice-channel-card';
        channelElement.innerHTML = `
            <div class="channel-header">
                <div class="channel-icon">
                    <i class="fas fa-volume-up"></i>
                </div>
                <div class="channel-info">
                    <h4 class="channel-name">${channel.name || 'Voice Channel'}</h4>
                    <div class="channel-meta">
                        <span class="channel-creator">
                            <i class="fas fa-user"></i> ${channel.createdBy || 'Unknown'}
                        </span>
                        <span class="channel-time">
                            <i class="fas fa-clock"></i> ${formatTimeAgo(channel.createdAt)}
                        </span>
                    </div>
                </div>
            </div>
            <div class="channel-participants">
                <div class="participants-count">
                    <i class="fas fa-users"></i>
                    <span>${channel.participants.length} / ${MAX_USERS_PER_CHANNEL}</span>
                </div>
                <div class="participants-list">
                    ${channel.participants.slice(0, 5).map(userId => 
                        `<span class="participant-dot" title="${userId}"></span>`
                    ).join('')}
                    ${channel.participants.length > 5 ? 
                        `<span class="more-participants">+${channel.participants.length - 5}</span>` : ''
                    }
                </div>
            </div>
            <div class="channel-actions">
                ${channel.participants.length >= MAX_USERS_PER_CHANNEL ? 
                    `<button class="join-channel-btn full" disabled>
                        <i class="fas fa-lock"></i> Channel Full
                    </button>` :
                    `<button class="join-channel-btn" data-channel-id="${channel.id}">
                        ${isUserInChannel(channel.id) ? 
                            `<i class="fas fa-phone-slash"></i> Leave` : 
                            `<i class="fas fa-phone-alt"></i> Join`
                        }
                    </button>`
                }
            </div>
        `;
        
        const joinBtn = channelElement.querySelector('.join-channel-btn');
        if (joinBtn && !joinBtn.disabled) {
            joinBtn.addEventListener('click', () => {
                const urlParams = new URLSearchParams(window.location.search);
                const groupId = urlParams.get('id');
                if (groupId) {
                    if (isUserInChannel(channel.id)) {
                        leaveVoiceChannel(channel.id, groupId);
                    } else {
                        joinVoiceChannel(channel.id, groupId);
                    }
                }
            });
        }
        
        container.appendChild(channelElement);
    });
    
    // Add "Start New Channel" button
    const startNewChannel = document.createElement('div');
    startNewChannel.className = 'start-new-channel';
    startNewChannel.innerHTML = `
        <button id="startNewVoiceChannel" class="start-new-channel-btn">
            <i class="fas fa-plus-circle"></i> Start New Voice Channel
        </button>
    `;
    
    container.appendChild(startNewChannel);
    
    const startBtn = document.getElementById('startNewVoiceChannel');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            const urlParams = new URLSearchParams(window.location.search);
            const groupId = urlParams.get('id');
            if (groupId) {
                createVoiceChannel(groupId);
            }
        });
    }
    
    // Add styles if not already added
    addVoiceChannelStyles();
}

// NEW: Create voice channels UI container
function createVoiceChannelsUI() {
    const chatHeader = document.querySelector('.chat-header');
    if (!chatHeader) return;
    
    // Check if container already exists
    if (document.getElementById('voiceChannelsContainer')) return;
    
    const voiceChannelsSection = document.createElement('div');
    voiceChannelsSection.id = 'voiceChannelsSection';
    voiceChannelsSection.className = 'voice-channels-section';
    voiceChannelsSection.innerHTML = `
        <div class="voice-channels-header">
            <h3><i class="fas fa-volume-up"></i> Voice Channels</h3>
            <button id="toggleVoiceChannels" class="toggle-channels-btn">
                <i class="fas fa-chevron-down"></i>
            </button>
        </div>
        <div id="voiceChannelsContainer" class="voice-channels-container">
            <div class="loading-channels">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Loading voice channels...</p>
            </div>
        </div>
    `;
    
    chatHeader.parentNode.insertBefore(voiceChannelsSection, chatHeader.nextSibling);
    
    // Add toggle functionality
    const toggleBtn = document.getElementById('toggleVoiceChannels');
    const container = document.getElementById('voiceChannelsContainer');
    
    toggleBtn.addEventListener('click', () => {
        const isVisible = container.style.display !== 'none';
        container.style.display = isVisible ? 'none' : 'block';
        toggleBtn.innerHTML = isVisible ? 
            '<i class="fas fa-chevron-down"></i>' : 
            '<i class="fas fa-chevron-up"></i>';
    });
    
    // Initialize with channels visible
    container.style.display = 'block';
    
    // Add styles
    addVoiceChannelStyles();
}

// NEW: Add voice channel styles
function addVoiceChannelStyles() {
    if (document.getElementById('voice-channel-styles')) return;
    
    const styles = document.createElement('style');
    styles.id = 'voice-channel-styles';
    styles.textContent = `
        .voice-channels-section {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 15px;
            margin: 15px;
            padding: 15px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
        }
        
        .voice-channels-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            color: white;
        }
        
        .voice-channels-header h3 {
            margin: 0;
            font-size: 16px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .toggle-channels-btn {
            background: rgba(255, 255, 255, 0.2);
            border: none;
            color: white;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.3s;
        }
        
        .toggle-channels-btn:hover {
            background: rgba(255, 255, 255, 0.3);
        }
        
        .voice-channels-container {
            display: block;
            transition: all 0.3s ease;
        }
        
        .voice-channel-card {
            background: white;
            border-radius: 12px;
            padding: 15px;
            margin-bottom: 12px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            transition: transform 0.2s;
        }
        
        .voice-channel-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        
        .channel-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 12px;
        }
        
        .channel-icon {
            width: 40px;
            height: 40px;
            background: linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 18px;
        }
        
        .channel-info {
            flex: 1;
        }
        
        .channel-name {
            margin: 0 0 4px 0;
            font-size: 14px;
            font-weight: 600;
            color: #333;
        }
        
        .channel-meta {
            display: flex;
            gap: 12px;
            font-size: 12px;
            color: #666;
        }
        
        .channel-meta span {
            display: flex;
            align-items: center;
            gap: 4px;
        }
        
        .channel-participants {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
            padding: 8px 0;
            border-top: 1px solid #f0f0f0;
            border-bottom: 1px solid #f0f0f0;
        }
        
        .participants-count {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 13px;
            color: #666;
        }
        
        .participants-list {
            display: flex;
            align-items: center;
            gap: 4px;
        }
        
        .participant-dot {
            width: 24px;
            height: 24px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 10px;
            font-weight: bold;
        }
        
        .more-participants {
            font-size: 12px;
            color: #666;
            margin-left: 4px;
        }
        
        .channel-actions {
            display: flex;
            justify-content: center;
        }
        
        .join-channel-btn {
            background: linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%);
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 25px;
            cursor: pointer;
            font-weight: 600;
            font-size: 14px;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: all 0.3s;
            width: 100%;
            justify-content: center;
        }
        
        .join-channel-btn:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
        }
        
        .join-channel-btn.full {
            background: #dc3545;
            cursor: not-allowed;
            opacity: 0.7;
        }
        
        .start-new-channel {
            margin-top: 15px;
            text-align: center;
        }
        
        .start-new-channel-btn {
            background: rgba(255, 255, 255, 0.2);
            color: white;
            border: 2px dashed rgba(255, 255, 255, 0.5);
            padding: 12px 24px;
            border-radius: 25px;
            cursor: pointer;
            font-weight: 600;
            font-size: 14px;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            transition: all 0.3s;
            width: 100%;
            justify-content: center;
        }
        
        .start-new-channel-btn:hover {
            background: rgba(255, 255, 255, 0.3);
            border-color: white;
        }
        
        .no-voice-channels {
            text-align: center;
            padding: 30px 20px;
            color: white;
        }
        
        .no-voice-channels i {
            font-size: 48px;
            margin-bottom: 15px;
            opacity: 0.7;
        }
        
        .no-voice-channels p {
            margin-bottom: 20px;
            font-size: 14px;
        }
        
        .start-voice-channel-btn {
            background: rgba(255, 255, 255, 0.9);
            color: #667eea;
            border: none;
            padding: 12px 24px;
            border-radius: 25px;
            cursor: pointer;
            font-weight: 600;
            font-size: 14px;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            transition: all 0.3s;
        }
        
        .start-voice-channel-btn:hover {
            background: white;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }
        
        .loading-channels {
            text-align: center;
            padding: 20px;
            color: white;
        }
        
        .loading-channels i {
            margin-bottom: 10px;
        }
        
        .mini-call-player {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 15px;
            padding: 15px;
            box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
            z-index: 9999;
            width: 300px;
            color: white;
            display: none;
            animation: slideUp 0.3s ease;
        }
        
        @keyframes slideUp {
            from {
                transform: translateY(100%);
                opacity: 0;
            }
            to {
                transform: translateY(0);
                opacity: 1;
            }
        }
        
        @keyframes slideDown {
            from {
                transform: translateY(0);
                opacity: 1;
            }
            to {
                transform: translateY(100%);
                opacity: 0;
            }
        }
        
        .mini-player-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
        }
        
        .mini-player-title {
            font-size: 14px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .mini-player-close {
            background: rgba(255, 255, 255, 0.2);
            border: none;
            color: white;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .mini-player-content {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 15px;
        }
        
        .mini-player-icon {
            width: 40px;
            height: 40px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
        }
        
        .mini-player-info {
            flex: 1;
        }
        
        .mini-player-channel {
            font-size: 13px;
            opacity: 0.9;
        }
        
        .mini-player-participants {
            font-size: 11px;
            opacity: 0.7;
            display: flex;
            align-items: center;
            gap: 4px;
        }
        
        .mini-player-controls {
            display: flex;
            justify-content: space-around;
            gap: 10px;
        }
        
        .mini-player-btn {
            background: rgba(255, 255, 255, 0.2);
            border: none;
            color: white;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.3s;
        }
        
        .mini-player-btn:hover {
            background: rgba(255, 255, 255, 0.3);
        }
        
        .mini-player-btn.active {
            background: rgba(255, 255, 255, 0.4);
        }
        
        .mini-player-btn.mute {
            color: #ff6b6b;
        }
        
        .mini-player-btn.open {
            background: rgba(76, 175, 80, 0.8);
        }
        
        .persistent-mini-player {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 50px;
            padding: 10px 20px;
            box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
            z-index: 9999;
            color: white;
            display: none;
            align-items: center;
            gap: 12px;
            cursor: pointer;
            transition: all 0.3s;
            max-width: 300px;
            animation: slideUp 0.3s ease;
        }
        
        .persistent-mini-player:hover {
            transform: translateY(-2px);
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
        }
        
        .persistent-player-icon {
            width: 30px;
            height: 30px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
        }
        
        .persistent-player-info {
            flex: 1;
            min-width: 0;
        }
        
        .persistent-player-channel {
            font-size: 12px;
            font-weight: 600;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        .persistent-player-participants {
            font-size: 10px;
            opacity: 0.8;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        .persistent-player-close {
            background: rgba(255, 255, 255, 0.2);
            border: none;
            color: white;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            flex-shrink: 0;
        }
    `;
    
    document.head.appendChild(styles);
}

// NEW: Check if user is in a voice channel
function isUserInChannel(channelId) {
    const userChannel = userVoiceChannel.get(currentUser?.uid);
    return userChannel && userChannel.channelId === channelId;
}

// NEW: Check user voice channel status
async function checkUserVoiceChannelStatus() {
    if (!currentUser) return;
    
    try {
        const userChannelRef = doc(db, 'voice_channel_users', currentUser.uid);
        const userChannelSnap = await getDoc(userChannelRef);
        
        if (userChannelSnap.exists()) {
            const data = userChannelSnap.data();
            userVoiceChannel.set(currentUser.uid, {
                groupId: data.groupId,
                channelId: data.channelId,
                joinedAt: data.joinedAt?.toDate ? data.joinedAt.toDate() : new Date(data.joinedAt)
            });
            
            // Get channel info
            const channelRef = doc(db, 'voice_channels', data.groupId, 'channels', data.channelId);
            const channelSnap = await getDoc(channelRef);
            
            if (channelSnap.exists()) {
                const channelData = channelSnap.data();
                currentVoiceChannel = {
                    id: data.channelId,
                    groupId: data.groupId,
                    ...channelData
                };
                
                // Get group name
                const groupRef = doc(db, 'groups', data.groupId);
                const groupSnap = await getDoc(groupRef);
                const groupName = groupSnap.exists() ? groupSnap.data().name : 'Unknown Group';
                
                // Show persistent mini player
                showPersistentMiniPlayer(groupName, channelData.name || 'Voice Channel', channelData.participants?.length || 1);
                
                // Connect to voice channel if not already connected
                if (!isCallActive) {
                    connectToVoiceChannel(data.groupId, data.channelId);
                }
            }
        } else {
            // User not in voice channel
            userVoiceChannel.delete(currentUser.uid);
            currentVoiceChannel = null;
            removePersistentMiniPlayer();
            stopVoiceChannel();
        }
    } catch (error) {
        console.error('calls.js: Error checking voice channel status:', error);
    }
}

// NEW: Create voice channel
async function createVoiceChannel(groupId) {
    if (!currentUser || !groupId) return;
    
    try {
        // Check if user is already in a voice channel
        if (userVoiceChannel.has(currentUser.uid)) {
            const confirmLeave = confirm('You are already in a voice channel. Leave current channel and create new one?');
            if (confirmLeave) {
                const current = userVoiceChannel.get(currentUser.uid);
                await leaveVoiceChannel(current.channelId, current.groupId);
            } else {
                return;
            }
        }
        
        // Check channel limit
        const channelsRef = collection(db, 'voice_channels', groupId, 'channels');
        const channelsSnap = await getDocs(channelsRef);
        
        if (channelsSnap.size >= MAX_CHANNELS_PER_GROUP) {
            showNotification(`Maximum ${MAX_CHANNELS_PER_GROUP} voice channels allowed per group.`, 'error');
            return;
        }
        
        // Create channel
        const channelRef = doc(channelsRef);
        const channelData = {
            id: channelRef.id,
            name: `Voice Channel ${channelsSnap.size + 1}`,
            createdBy: currentUser.uid,
            createdAt: serverTimestamp(),
            participants: [currentUser.uid],
            maxParticipants: MAX_USERS_PER_CHANNEL
        };
        
        await setDoc(channelRef, channelData);
        
        // Add user to channel participants
        await updateDoc(channelRef, {
            participants: arrayUnion(currentUser.uid)
        });
        
        // Set user's voice channel
        await setDoc(doc(db, 'voice_channel_users', currentUser.uid), {
            groupId: groupId,
            channelId: channelRef.id,
            joinedAt: serverTimestamp()
        });
        
        // Store locally
        userVoiceChannel.set(currentUser.uid, {
            groupId: groupId,
            channelId: channelRef.id,
            joinedAt: new Date()
        });
        
        currentVoiceChannel = {
            id: channelRef.id,
            groupId: groupId,
            ...channelData
        };
        
        // Start voice call
        startVoiceChannel(groupId, channelRef.id);
        
        showNotification('Voice channel created!', 'success');
        
    } catch (error) {
        console.error('calls.js: Error creating voice channel:', error);
        showNotification('Failed to create voice channel', 'error');
    }
}

// NEW: Join voice channel
async function joinVoiceChannel(channelId, groupId) {
    if (!currentUser || !channelId || !groupId) return;
    
    try {
        // Check if user is already in a voice channel
        if (userVoiceChannel.has(currentUser.uid)) {
            const confirmLeave = confirm('You are already in a voice channel. Leave current channel and join new one?');
            if (confirmLeave) {
                const current = userVoiceChannel.get(currentUser.uid);
                await leaveVoiceChannel(current.channelId, current.groupId);
            } else {
                return;
            }
        }
        
        const channelRef = doc(db, 'voice_channels', groupId, 'channels', channelId);
        const channelSnap = await getDoc(channelRef);
        
        if (!channelSnap.exists()) {
            showNotification('Voice channel not found', 'error');
            return;
        }
        
        const channelData = channelSnap.data();
        
        // Check if channel is full
        if (channelData.participants && channelData.participants.length >= MAX_USERS_PER_CHANNEL) {
            showNotification('Voice channel is full', 'error');
            return;
        }
        
        // Add user to channel
        await updateDoc(channelRef, {
            participants: arrayUnion(currentUser.uid)
        });
        
        // Set user's voice channel
        await setDoc(doc(db, 'voice_channel_users', currentUser.uid), {
            groupId: groupId,
            channelId: channelId,
            joinedAt: serverTimestamp()
        });
        
        // Store locally
        userVoiceChannel.set(currentUser.uid, {
            groupId: groupId,
            channelId: channelId,
            joinedAt: new Date()
        });
        
        currentVoiceChannel = {
            id: channelId,
            groupId: groupId,
            ...channelData
        };
        
        // Get group name for mini player
        const groupRef = doc(db, 'groups', groupId);
        const groupSnap = await getDoc(groupRef);
        const groupName = groupSnap.exists() ? groupSnap.data().name : 'Unknown Group';
        
        // Show persistent mini player
        showPersistentMiniPlayer(groupName, channelData.name || 'Voice Channel', 
                               (channelData.participants?.length || 0) + 1);
        
        // Start voice call
        startVoiceChannel(groupId, channelId);
        
        showNotification('Joined voice channel!', 'success');
        
    } catch (error) {
        console.error('calls.js: Error joining voice channel:', error);
        showNotification('Failed to join voice channel', 'error');
    }
}

// NEW: Leave voice channel
async function leaveVoiceChannel(channelId, groupId) {
    if (!currentUser || !channelId || !groupId) return;
    
    try {
        const channelRef = doc(db, 'voice_channels', groupId, 'channels', channelId);
        
        // Remove user from channel
        await updateDoc(channelRef, {
            participants: arrayRemove(currentUser.uid)
        });
        
        // Remove user from voice channel users
        await deleteDoc(doc(db, 'voice_channel_users', currentUser.uid));
        
        // Check if channel is empty, delete it
        const channelSnap = await getDoc(channelRef);
        if (channelSnap.exists()) {
            const channelData = channelSnap.data();
            if (!channelData.participants || channelData.participants.length === 0) {
                await deleteDoc(channelRef);
            }
        }
        
        // Clear locally
        userVoiceChannel.delete(currentUser.uid);
        currentVoiceChannel = null;
        
        // Stop voice call
        stopVoiceChannel();
        
        // Remove mini player
        removePersistentMiniPlayer();
        
        showNotification('Left voice channel', 'info');
        
    } catch (error) {
        console.error('calls.js: Error leaving voice channel:', error);
        showNotification('Failed to leave voice channel', 'error');
    }
}

// NEW: Start voice channel call
async function startVoiceChannel(groupId, channelId) {
    if (!currentUser || !groupId || !channelId) return;
    
    try {
        // Get channel participants
        const channelRef = doc(db, 'voice_channels', groupId, 'channels', channelId);
        const channelSnap = await getDoc(channelRef);
        
        if (!channelSnap.exists()) {
            showNotification('Voice channel not found', 'error');
            return;
        }
        
        const channelData = channelSnap.data();
        const participants = channelData.participants || [];
        
        // Setup media
        await setupMediaForVoiceChannel();
        
        // Connect to other participants
        for (const participantId of participants) {
            if (participantId !== currentUser.uid) {
                setTimeout(() => {
                    connectToParticipant(participantId, groupId, channelId);
                }, Math.random() * 1000); // Stagger connections
            }
        }
        
        isCallActive = true;
        console.log('calls.js: Voice channel started');
        
    } catch (error) {
        console.error('calls.js: Error starting voice channel:', error);
        showNotification('Failed to start voice channel', 'error');
    }
}

// NEW: Connect to voice channel
async function connectToVoiceChannel(groupId, channelId) {
    if (!currentUser || !groupId || !channelId) return;
    
    try {
        // Get channel participants
        const channelRef = doc(db, 'voice_channels', groupId, 'channels', channelId);
        const channelSnap = await getDoc(channelRef);
        
        if (!channelSnap.exists()) {
            showNotification('Voice channel not found', 'error');
            return;
        }
        
        const channelData = channelSnap.data();
        const participants = channelData.participants || [];
        
        // Setup media if not already
        if (!localStream) {
            await setupMediaForVoiceChannel();
        }
        
        // Connect to other participants
        for (const participantId of participants) {
            if (participantId !== currentUser.uid) {
                setTimeout(() => {
                    connectToParticipant(participantId, groupId, channelId);
                }, Math.random() * 1000);
            }
        }
        
        isCallActive = true;
        
    } catch (error) {
        console.error('calls.js: Error connecting to voice channel:', error);
    }
}

// NEW: Setup media for voice channel
async function setupMediaForVoiceChannel() {
    try {
        if (localStream) {
            return; // Already have stream
        }
        
        console.log('calls.js: Requesting microphone for voice channel...');
        localStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                sampleRate: 44100,
                channelCount: 1
            },
            video: false
        });
        console.log('calls.js: Microphone access granted for voice channel');
        
    } catch (error) {
        console.error('calls.js: Failed to access microphone:', error);
        if (error.name === 'NotAllowedError') {
            showNotification('Microphone access denied. Please check your permissions.', 'error');
        } else if (error.name === 'NotFoundError') {
            showNotification('No microphone found.', 'error');
        } else {
            showNotification('Failed to access microphone: ' + error.message, 'error');
        }
        throw error;
    }
}

// NEW: Connect to a participant in voice channel
async function connectToParticipant(userId, groupId, channelId) {
    if (peerConnections.has(userId)) {
        console.log('calls.js: Already connected to', userId);
        return;
    }
    
    try {
        console.log('calls.js: Connecting to participant:', userId);
        
        // Create peer connection
        const peerConnection = new RTCPeerConnection(rtcConfiguration);
        peerConnections.set(userId, peerConnection);
        
        // Add local stream
        if (localStream) {
            localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, localStream);
            });
        }
        
        // Handle remote stream
        peerConnection.ontrack = (event) => {
            console.log('calls.js: Received remote track from:', userId);
            if (event.streams && event.streams[0]) {
                const remoteStream = event.streams[0];
                remoteStreams.set(userId, remoteStream);
                
                // Create audio element for this participant
                createChannelAudioElement(userId, remoteStream);
                
                // Update participants UI
                updateChannelParticipantsUI(channelId);
            }
        };
        
        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                sendSignal({
                    type: 'voice-channel-ice',
                    candidate: event.candidate,
                    from: currentUser.uid,
                    groupId: groupId,
                    channelId: channelId
                }, userId);
            }
        };
        
        // Handle connection state
        peerConnection.onconnectionstatechange = () => {
            console.log(`calls.js: Connection state with ${userId}:`, peerConnection.connectionState);
            
            if (peerConnection.connectionState === 'connected') {
                console.log('calls.js: Connected to', userId);
            } else if (peerConnection.connectionState === 'disconnected' || 
                       peerConnection.connectionState === 'failed') {
                console.log('calls.js: Connection lost with', userId);
                cleanupParticipant(userId);
            }
        };
        
        // Create and send offer
        const offer = await peerConnection.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: false
        });
        await peerConnection.setLocalDescription(offer);
        
        await sendSignal({
            type: 'voice-channel-offer',
            offer: offer,
            from: currentUser.uid,
            groupId: groupId,
            channelId: channelId
        }, userId);
        
        console.log('calls.js: Offer sent to', userId);
        
    } catch (error) {
        console.error(`calls.js: Error connecting to ${userId}:`, error);
    }
}

// NEW: Create audio element for channel participant
function createChannelAudioElement(userId, remoteStream) {
    // Remove existing element if present
    const existingElement = document.getElementById(`channelAudio_${userId}`);
    if (existingElement) {
        existingElement.remove();
    }
    
    const audioElement = document.createElement('audio');
    audioElement.id = `channelAudio_${userId}`;
    audioElement.autoplay = true;
    audioElement.controls = false;
    audioElement.style.display = 'none';
    audioElement.srcObject = remoteStream;
    
    const playPromise = audioElement.play();
    if (playPromise !== undefined) {
        playPromise.catch(error => {
            console.error('calls.js: Error playing channel audio:', error);
        });
    }
    
    document.body.appendChild(audioElement);
}

// NEW: Update channel participants UI
function updateChannelParticipantsUI(channelId) {
    if (!miniPlayer) return;
    
    const participantsCount = document.querySelector('.mini-player-participants');
    if (participantsCount) {
        const count = peerConnections.size + 1; // +1 for local user
        participantsCount.innerHTML = `<i class="fas fa-users"></i> ${count} in voice`;
    }
    
    const persistentCount = document.querySelector('.persistent-player-participants');
    if (persistentCount) {
        const count = peerConnections.size + 1;
        persistentCount.textContent = `${count} in voice`;
    }
}

// NEW: Show mini player
function showMiniPlayer() {
    if (miniPlayer) {
        miniPlayer.style.display = 'block';
        return;
    }
    
    miniPlayer = document.createElement('div');
    miniPlayer.className = 'mini-call-player';
    miniPlayer.innerHTML = `
        <div class="mini-player-header">
            <div class="mini-player-title">
                <i class="fas fa-volume-up"></i>
                <span>Voice Channel</span>
            </div>
            <button class="mini-player-close" id="miniPlayerClose">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="mini-player-content">
            <div class="mini-player-icon">
                <i class="fas fa-headphones"></i>
            </div>
            <div class="mini-player-info">
                <div class="mini-player-channel">${currentVoiceChannel?.name || 'Voice Channel'}</div>
                <div class="mini-player-participants">
                    <i class="fas fa-users"></i>
                    ${peerConnections.size + 1} in voice
                </div>
            </div>
        </div>
        <div class="mini-player-controls">
            <button class="mini-player-btn mute" id="miniPlayerMute">
                <i class="fas fa-microphone"></i>
            </button>
            <button class="mini-player-btn" id="miniPlayerLeave">
                <i class="fas fa-phone-slash"></i>
            </button>
            <button class="mini-player-btn open" id="miniPlayerOpen">
                <i class="fas fa-expand"></i>
            </button>
        </div>
    `;
    
    document.body.appendChild(miniPlayer);
    miniPlayer.style.display = 'block';
    
    // Add event listeners
    document.getElementById('miniPlayerClose').addEventListener('click', () => {
        miniPlayer.style.display = 'none';
    });
    
    document.getElementById('miniPlayerMute').addEventListener('click', toggleMute);
    
    document.getElementById('miniPlayerLeave').addEventListener('click', () => {
        if (currentVoiceChannel) {
            leaveVoiceChannel(currentVoiceChannel.id, currentVoiceChannel.groupId);
        }
    });
    
    document.getElementById('miniPlayerOpen').addEventListener('click', () => {
        if (currentVoiceChannel) {
            window.open(`calls.html?type=channel&groupId=${currentVoiceChannel.groupId}&channelId=${currentVoiceChannel.id}`, '_blank');
        }
    });
    
    // Update mute button
    updateMuteButton();
}

// NEW: Show persistent mini player
function showPersistentMiniPlayer(groupName, channelName, participantCount) {
    if (persistentMiniPlayer) {
        updatePersistentMiniPlayer(groupName, channelName, participantCount);
        persistentMiniPlayer.style.display = 'flex';
        return;
    }
    
    persistentMiniPlayer = document.createElement('div');
    persistentMiniPlayer.className = 'persistent-mini-player';
    persistentMiniPlayer.innerHTML = `
        <div class="persistent-player-icon">
            <i class="fas fa-volume-up"></i>
        </div>
        <div class="persistent-player-info">
            <div class="persistent-player-channel">${groupName}: ${channelName}</div>
            <div class="persistent-player-participants">${participantCount} in voice</div>
        </div>
        <button class="persistent-player-close" id="persistentPlayerClose">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    document.body.appendChild(persistentMiniPlayer);
    persistentMiniPlayer.style.display = 'flex';
    
    // Add event listeners
    persistentMiniPlayer.addEventListener('click', (e) => {
        if (!e.target.closest('.persistent-player-close')) {
            showMiniPlayer();
        }
    });
    
    document.getElementById('persistentPlayerClose').addEventListener('click', (e) => {
        e.stopPropagation();
        if (currentVoiceChannel) {
            const confirmLeave = confirm('Leave voice channel?');
            if (confirmLeave) {
                leaveVoiceChannel(currentVoiceChannel.id, currentVoiceChannel.groupId);
            }
        }
    });
}

// NEW: Update persistent mini player
function updatePersistentMiniPlayer(groupName, channelName, participantCount) {
    if (!persistentMiniPlayer) return;
    
    const channelElement = persistentMiniPlayer.querySelector('.persistent-player-channel');
    const participantsElement = persistentMiniPlayer.querySelector('.persistent-player-participants');
    
    if (channelElement) {
        channelElement.textContent = `${groupName}: ${channelName}`;
    }
    
    if (participantsElement) {
        participantsElement.textContent = `${participantCount} in voice`;
    }
}

// NEW: Remove persistent mini player
function removePersistentMiniPlayer() {
    if (persistentMiniPlayer) {
        persistentMiniPlayer.style.display = 'none';
    }
    if (miniPlayer) {
        miniPlayer.style.display = 'none';
    }
}

// NEW: Stop voice channel
function stopVoiceChannel() {
    console.log('calls.js: Stopping voice channel');
    
    // Close all peer connections
    peerConnections.forEach((pc, userId) => {
        if (pc) {
            pc.close();
        }
    });
    peerConnections.clear();
    
    // Stop local stream
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    // Clear remote streams
    remoteStreams.clear();
    
    // Remove all channel audio elements
    document.querySelectorAll('[id^="channelAudio_"]').forEach(el => {
        el.pause();
        el.srcObject = null;
        el.remove();
    });
    
    isCallActive = false;
}

// NEW: Cleanup participant
function cleanupParticipant(userId) {
    const pc = peerConnections.get(userId);
    if (pc) {
        pc.close();
    }
    peerConnections.delete(userId);
    remoteStreams.delete(userId);
    
    const audioElement = document.getElementById(`channelAudio_${userId}`);
    if (audioElement) {
        audioElement.remove();
    }
    
    updateChannelParticipantsUI(currentVoiceChannel?.id);
}

// NEW: Format time ago
function formatTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) {
        return `${diffDays}d ago`;
    } else if (diffHours > 0) {
        return `${diffHours}h ago`;
    } else if (diffMins > 0) {
        return `${diffMins}m ago`;
    } else {
        return 'just now';
    }
}

// Rest of the functions remain similar but updated for voice channel support...

// [Keep all existing functions from original file, but update them to work with voice channels]

// Update setupCallButtonListeners to include voice channel buttons
function setupCallButtonListeners() {
    console.log('calls.js: Setting up call button listeners');
    
    // Personal chat call buttons
    const voiceCallBtn = document.getElementById('voiceCallBtn');
    const groupVoiceCallBtn = document.getElementById('groupVoiceCallBtn');
    
    if (voiceCallBtn) {
        voiceCallBtn.addEventListener('click', () => {
            console.log('calls.js: Voice call button clicked');
            const urlParams = new URLSearchParams(window.location.search);
            const partnerId = urlParams.get('id');
            if (partnerId) {
                console.log('calls.js: Initiating personal call to:', partnerId);
                initiatePersonalCall(partnerId);
            } else {
                showNotification('Cannot start call. No chat partner found.', 'error');
            }
        });
    }
    
    if (groupVoiceCallBtn) {
        groupVoiceCallBtn.addEventListener('click', () => {
            console.log('calls.js: Group voice call button clicked');
            const urlParams = new URLSearchParams(window.location.search);
            const groupId = urlParams.get('id');
            if (groupId) {
                console.log('calls.js: Initiating group call for group:', groupId);
                initiateGroupCall(groupId);
            } else {
                showNotification('Cannot start group call. No group selected.', 'error');
            }
        });
    }
}

// Update handleCallPage to handle voice channel calls
async function handleCallPage() {
    console.log('calls.js: handleCallPage called');
    
    const urlParams = new URLSearchParams(window.location.search);
    const callType = urlParams.get('type');
    const partnerId = urlParams.get('partnerId');
    const groupId = urlParams.get('groupId');
    const channelId = urlParams.get('channelId');
    const isIncoming = urlParams.get('incoming') === 'true';
    const callId = urlParams.get('callId');
    
    console.log('calls.js: Call page params:', { 
        callType, 
        partnerId, 
        groupId, 
        channelId,
        isIncoming, 
        callId 
    });
    
    if (!callType) {
        console.error('calls.js: Invalid call parameters');
        showError('Invalid call parameters');
        return;
    }
    
    currentCallType = callType;
    activeCallId = callId || `${currentUser.uid}_${Date.now()}`;
    isCaller = !isIncoming;
    
    if (callType === 'personal') {
        currentCallPartnerId = partnerId;
    } else if (callType === 'group') {
        currentGroupId = groupId;
    } else if (callType === 'channel') {
        currentGroupId = groupId;
        currentVoiceChannel = { id: channelId, groupId: groupId };
    }
    
    // Update UI based on call type
    try {
        if (callType === 'personal') {
            const partnerName = await getUserName(partnerId);
            document.getElementById('callTitle').textContent = partnerName;
            document.getElementById('callTypeText').textContent = 'Voice Call';
        } else if (callType === 'group') {
            const groupDoc = await getDoc(doc(db, 'groups', groupId));
            if (groupDoc.exists()) {
                const groupName = groupDoc.data().name;
                document.getElementById('callTitle').textContent = groupName;
                document.getElementById('callTypeText').textContent = 'Group Voice Call';
            }
        } else if (callType === 'channel') {
            const groupDoc = await getDoc(doc(db, 'groups', groupId));
            const channelDoc = await getDoc(doc(db, 'voice_channels', groupId, 'channels', channelId));
            
            let title = 'Voice Channel';
            if (groupDoc.exists() && channelDoc.exists()) {
                const groupName = groupDoc.data().name;
                const channelName = channelDoc.data().name;
                title = `${groupName}: ${channelName}`;
            }
            
            document.getElementById('callTitle').textContent = title;
            document.getElementById('callTypeText').textContent = 'Voice Channel';
        }
    } catch (error) {
        console.error('calls.js: Error updating UI:', error);
    }
    
    // Set up event listeners
    const muteBtn = document.getElementById('muteBtn');
    const endCallBtn = document.getElementById('endCallBtn');
    const backToChatBtn = document.getElementById('backToChat');
    
    if (muteBtn) {
        muteBtn.addEventListener('click', toggleMute);
    }
    
    if (endCallBtn) {
        endCallBtn.addEventListener('click', endCall);
    }
    
    if (backToChatBtn) {
        backToChatBtn.addEventListener('click', goBackToChat);
    }
    
    // Setup signaling listener
    setupSignalingListener();
    
    // Start the call process
    if (isCaller || callType === 'channel') {
        console.log('calls.js: Starting call...');
        startCall();
    } else {
        console.log('calls.js: We are the receiver, waiting for offer');
        setupMediaForReceiver();
    }
}

// Update endCall to handle voice channels
async function endCall() {
    console.log('calls.js: Ending call');
    
    try {
        // Clear any timeout
        if (callTimeout) {
            clearTimeout(callTimeout);
            callTimeout = null;
        }
        
        // Stop call timer
        stopCallTimer();
        
        // Stop ringtone if playing
        stopRingtone();
        
        // If in voice channel, leave it
        if (currentCallType === 'channel' && currentVoiceChannel) {
            await leaveVoiceChannel(currentVoiceChannel.id, currentVoiceChannel.groupId);
        } else {
            // Send end call signals for personal/group calls
            if (currentCallType === 'personal' && currentCallPartnerId) {
                await sendSignal({
                    type: 'end-call',
                    from: currentUser.uid,
                    callId: activeCallId
                }, currentCallPartnerId);
            } else if (currentCallType === 'group' && currentGroupId) {
                // Send to all participants
                for (const [userId] of peerConnections) {
                    await sendSignal({
                        type: 'end-call',
                        from: currentUser.uid,
                        callId: activeCallId,
                        groupId: currentGroupId
                    }, userId);
                }
            }
        }
        
        cleanupCallResources();
        showCallEnded();
        
        console.log('calls.js: Call ended successfully');
        
    } catch (error) {
        console.error('calls.js: Error ending call:', error);
        cleanupCallResources();
    }
}

// Update cleanupCallResources to include voice channel cleanup
function cleanupCallResources() {
    console.log('calls.js: Cleaning up call resources');
    
    // Stop voice channel if active
    if (currentCallType === 'channel') {
        stopVoiceChannel();
    }
    
    // Close all peer connections
    peerConnections.forEach((pc, userId) => {
        if (pc) {
            pc.close();
        }
    });
    peerConnections.clear();
    
    // Stop local stream
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    // Clear remote streams
    remoteStreams.clear();
    
    // Remove all audio elements
    document.querySelectorAll('[id^="remoteAudio_"], [id^="channelAudio_"]').forEach(el => {
        el.pause();
        el.srcObject = null;
        el.remove();
    });
    
    // Clear signaling listeners
    signalingUnsubscribers.forEach(unsubscribe => {
        if (unsubscribe) unsubscribe();
    });
    signalingUnsubscribers.clear();
    
    // Clear variables
    activeCallId = null;
    currentCallType = null;
    currentCallPartnerId = null;
    currentGroupId = null;
    currentCallData = null;
    isCallActive = false;
    
    // Don't clear voice channel data if user is still in a channel
    if (currentCallType !== 'channel') {
        currentVoiceChannel = null;
    }
    
    console.log('calls.js: Call resources cleaned up');
}

// Update goBackToChat to handle voice channels
function goBackToChat() {
    console.log('calls.js: Going back to chat');
    
    if (currentCallType === 'channel' && currentVoiceChannel) {
        // User stays in voice channel, just close call page
        window.close();
        return;
    }
    
    cleanupCallResources();
    
    if (currentCallType === 'personal' && currentCallPartnerId) {
        window.location.href = 'chat.html?id=' + currentCallPartnerId;
    } else if (currentCallType === 'group' && currentGroupId) {
        window.location.href = 'group.html?id=' + currentGroupId;
    } else {
        window.location.href = 'groups.html';
    }
}

// Update toggleMute to update mini player
function toggleMute() {
    if (!localStream) return;
    
    const audioTracks = localStream.getAudioTracks();
    if (audioTracks.length > 0) {
        isMuted = !isMuted;
        audioTracks[0].enabled = !isMuted;
        
        // Update main mute button
        const muteBtn = document.getElementById('muteBtn');
        if (muteBtn) {
            muteBtn.classList.toggle('active', isMuted);
            muteBtn.innerHTML = isMuted ? 
                '<i class="fas fa-microphone-slash"></i>' : 
                '<i class="fas fa-microphone"></i>';
        }
        
        // Update mini player mute button
        updateMuteButton();
        
        console.log('calls.js: Mute toggled:', isMuted);
    }
}

// NEW: Update mute button in mini player
function updateMuteButton() {
    const miniMuteBtn = document.getElementById('miniPlayerMute');
    if (miniMuteBtn) {
        miniMuteBtn.classList.toggle('active', isMuted);
        miniMuteBtn.innerHTML = isMuted ? 
            '<i class="fas fa-microphone-slash"></i>' : 
            '<i class="fas fa-microphone"></i>';
    }
}

// Update handleSignalingMessage to handle voice channel signals
async function handleSignalingMessage(data) {
    try {
        console.log('calls.js: Handling signal:', data.type, 'from:', data.from);
        
        switch (data.type) {
            case 'offer':
                await handleIncomingOffer(data);
                break;
                
            case 'answer':
                await handleAnswer(data);
                break;
                
            case 'ice-candidate':
                await handleIceCandidate(data);
                break;
                
            case 'voice-channel-offer':
                await handleVoiceChannelOffer(data);
                break;
                
            case 'voice-channel-answer':
                await handleVoiceChannelAnswer(data);
                break;
                
            case 'voice-channel-ice':
                await handleVoiceChannelIce(data);
                break;
                
            case 'call-accepted':
                console.log('calls.js: Call accepted by remote user');
                hideLoader();
                updateCallStatus('Connecting...');
                break;
                
            case 'call-rejected':
                console.log('calls.js: Call rejected by remote user');
                showError('Call was rejected.');
                setTimeout(goBackToChat, 2000);
                break;
                
            case 'end-call':
                console.log('calls.js: Call ended by remote user');
                showCallEnded();
                break;
                
            default:
                console.log('calls.js: Unknown signal type:', data.type);
        }
    } catch (error) {
        console.error('calls.js: Error handling signaling message:', error);
        showNotification('Error handling call request: ' + error.message, 'error');
    }
}

// NEW: Handle voice channel offer
async function handleVoiceChannelOffer(data) {
    console.log('calls.js: Handling voice channel offer from:', data.from);
    
    // Check if we're in the same channel
    if (currentVoiceChannel?.id !== data.channelId || 
        currentVoiceChannel?.groupId !== data.groupId) {
        console.log('calls.js: Not in same voice channel, ignoring offer');
        return;
    }
    
    // Setup media if not already
    if (!localStream) {
        await setupMediaForVoiceChannel();
    }
    
    // Create peer connection if it doesn't exist
    if (!peerConnections.has(data.from)) {
        createVoiceChannelConnection(data.from, data.groupId, data.channelId);
    }
    
    const peerConnection = peerConnections.get(data.from);
    if (!peerConnection) {
        console.error('calls.js: No peer connection for:', data.from);
        return;
    }
    
    // Set remote description
    try {
        const offerDescription = new RTCSessionDescription({
            type: 'offer',
            sdp: data.offer.sdp
        });
        
        console.log('calls.js: Setting remote description for voice channel');
        await peerConnection.setRemoteDescription(offerDescription);
        
        // Create and send answer
        const answer = await peerConnection.createAnswer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: false
        });
        await peerConnection.setLocalDescription(answer);
        
        await sendSignal({
            type: 'voice-channel-answer',
            answer: answer,
            from: currentUser.uid,
            groupId: data.groupId,
            channelId: data.channelId
        }, data.from);
        
        console.log('calls.js: Voice channel answer sent');
        
    } catch (error) {
        console.error('calls.js: Error handling voice channel offer:', error);
    }
}

// NEW: Handle voice channel answer
async function handleVoiceChannelAnswer(data) {
    console.log('calls.js: Handling voice channel answer from:', data.from);
    
    const peerConnection = peerConnections.get(data.from);
    if (peerConnection) {
        try {
            const answerDescription = new RTCSessionDescription({
                type: 'answer',
                sdp: data.answer.sdp
            });
            
            console.log('calls.js: Setting remote answer for voice channel');
            await peerConnection.setRemoteDescription(answerDescription);
            
            console.log('calls.js: Voice channel connected with:', data.from);
            
        } catch (error) {
            console.error('calls.js: Error setting remote answer for voice channel:', error);
        }
    }
}

// NEW: Handle voice channel ICE candidate
async function handleVoiceChannelIce(data) {
    const peerConnection = peerConnections.get(data.from);
    if (peerConnection && data.candidate) {
        try {
            const iceCandidate = new RTCIceCandidate(data.candidate);
            console.log('calls.js: Adding ICE candidate for voice channel from:', data.from);
            await peerConnection.addIceCandidate(iceCandidate);
        } catch (error) {
            console.error('calls.js: Error adding ICE candidate for voice channel:', error);
        }
    }
}

// NEW: Create voice channel connection
function createVoiceChannelConnection(userId, groupId, channelId) {
    try {
        console.log('calls.js: Creating voice channel connection for:', userId);
        const peerConnection = new RTCPeerConnection(rtcConfiguration);
        peerConnections.set(userId, peerConnection);
        
        // Handle remote stream
        peerConnection.ontrack = (event) => {
            console.log('calls.js: Received remote track from voice channel:', userId);
            if (event.streams && event.streams[0]) {
                const remoteStream = event.streams[0];
                remoteStreams.set(userId, remoteStream);
                
                // Create audio element
                createChannelAudioElement(userId, remoteStream);
                
                // Update participants UI
                updateChannelParticipantsUI(channelId);
            }
        };
        
        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                sendSignal({
                    type: 'voice-channel-ice',
                    candidate: event.candidate,
                    from: currentUser.uid,
                    groupId: groupId,
                    channelId: channelId
                }, userId);
            }
        };
        
        // Handle connection state changes
        peerConnection.onconnectionstatechange = () => {
            console.log(`calls.js: Voice channel connection state changed for ${userId}:`, peerConnection.connectionState);
            
            if (peerConnection.connectionState === 'connected') {
                console.log('calls.js: Voice channel connected with:', userId);
                updateChannelParticipantsUI(channelId);
                
            } else if (peerConnection.connectionState === 'disconnected' || 
                       peerConnection.connectionState === 'failed') {
                console.log(`calls.js: Voice channel connection lost for ${userId}`);
                cleanupParticipant(userId);
            }
        };
        
        // Add local stream if available
        if (localStream) {
            localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, localStream);
            });
        }
        
        console.log('calls.js: Voice channel connection created for:', userId);
        
    } catch (error) {
        console.error('calls.js: Failed to create voice channel connection:', error);
    }
}

// Preload notification sounds
function preloadNotificationSounds() {
    try {
        callNotificationSound = new Audio('sounds/notification.mp3');
        callRingtone = new Audio('ringingtone.mp3');
        callRingtone.loop = true;
        console.log('calls.js: Notification sounds preloaded');
    } catch (error) {
        console.error('calls.js: Failed to preload sounds:', error);
    }
}

// Get user name with caching
async function getUserName(userId) {
    if (userCache.has(userId)) {
        return userCache.get(userId);
    }
    
    try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
            const userName = userDoc.data().name || 'Unknown User';
            userCache.set(userId, userName);
            return userName;
        }
    } catch (error) {
        console.error('calls.js: Error getting user name:', error);
    }
    
    return 'Unknown User';
}

// Setup listener for incoming call notifications
function setupCallNotificationsListener() {
    if (!currentUser || !db) {
        console.log('calls.js: Cannot setup notifications listener - no user or db');
        return;
    }
    
    console.log('calls.js: Setting up call notifications listener');
    
    const notificationsRef = collection(db, 'notifications', currentUser.uid, 'calls');
    
    onSnapshot(notificationsRef, (snapshot) => {
        console.log('calls.js: Notification snapshot received, changes:', snapshot.docChanges().length);
        
        snapshot.docChanges().forEach(async (change) => {
            if (change.type === 'added') {
                const data = change.doc.data();
                console.log('calls.js: New notification received:', data);
                
                // Only process recent notifications (last 30 seconds)
                const notificationTime = data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp);
                if (Date.now() - notificationTime.getTime() > 30000) {
                    console.log('calls.js: Notification too old, deleting');
                    await deleteDoc(doc(db, 'notifications', currentUser.uid, 'calls', change.doc.id));
                    return;
                }
                
                // Play notification sound
                playNotificationSound();
                
                // Show incoming call notification
                if (data.type === 'call' && data.status === 'ringing') {
                    console.log('calls.js: Showing incoming call notification');
                    showIncomingCallNotification(data);
                }
                
                // Mark as processed
                await deleteDoc(doc(db, 'notifications', currentUser.uid, 'calls', change.doc.id));
                console.log('calls.js: Notification marked as processed');
            }
        });
    }, (error) => {
        console.error('calls.js: Error in notifications listener:', error);
    });
}

// Show incoming call notification
async function showIncomingCallNotification(data) {
    console.log('calls.js: Creating incoming call notification');
    
    // Remove any existing notifications first
    const existingNotifications = document.querySelectorAll('.incoming-call-notification');
    console.log('calls.js: Found existing notifications:', existingNotifications.length);
    existingNotifications.forEach(notification => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    });
    
    // Get caller/group name
    let callerName = 'Unknown';
    let callTypeText = '';
    
    if (data.callType === 'personal') {
        callerName = await getUserName(data.from);
        callTypeText = 'Voice Call';
    } else if (data.callType === 'group') {
        try {
            const groupDoc = await getDoc(doc(db, 'groups', data.groupId));
            if (groupDoc.exists()) {
                callerName = groupDoc.data().name;
            }
        } catch (error) {
            console.error('calls.js: Error getting group name:', error);
        }
        callTypeText = 'Group Voice Call';
    }
    
    console.log('calls.js: Caller name:', callerName, 'Call type:', callTypeText);
    
    // Store call data globally
    currentCallData = data;
    
    // Play ringtone
    playRingtone();
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'incoming-call-notification';
    notification.innerHTML = `
        <div class="notification-content">
            <div class="caller-info">
                <div class="caller-avatar">
                    <i class="fas fa-phone-alt"></i>
                </div>
                <div class="caller-details">
                    <h3>Incoming ${callTypeText}</h3>
                    <p>${callerName} is calling you</p>
                </div>
            </div>
            <div class="notification-buttons">
                <button class="accept-call" data-action="accept">
                    <i class="fas fa-phone"></i> Accept
                </button>
                <button class="reject-call" data-action="reject">
                    <i class="fas fa-phone-slash"></i> Decline
                </button>
            </div>
        </div>
    `;
    
    // Add styles if not already added
    if (!document.getElementById('call-notification-styles')) {
        const styles = document.createElement('style');
        styles.id = 'call-notification-styles';
        styles.textContent = `
            .incoming-call-notification {
                position: fixed;
                top: 20px;
                right: 20px;
                background: white;
                padding: 20px;
                border-radius: 15px;
                box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
                z-index: 10000;
                max-width: 350px;
                width: 100%;
                animation: slideIn 0.3s ease;
                border-left: 5px solid #4CAF50;
            }
            
            .caller-info {
                display: flex;
                align-items: center;
                gap: 15px;
                margin-bottom: 20px;
            }
            
            .caller-avatar {
                width: 50px;
                height: 50px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 24px;
            }
            
            .caller-details h3 {
                margin: 0 0 5px 0;
                color: #333;
                font-size: 16px;
                font-weight: 600;
            }
            
            .caller-details p {
                margin: 0;
                color: #666;
                font-size: 14px;
            }
            
            .notification-buttons {
                display: flex;
                gap: 12px;
            }
            
            .accept-call, .reject-call {
                flex: 1;
                padding: 12px 0;
                border: none;
                border-radius: 25px;
                cursor: pointer;
                font-weight: bold;
                font-size: 14px;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
            }
            
            .accept-call {
                background: #28a745;
                color: white;
            }
            
            .accept-call:hover {
                background: #218838;
            }
            
            .reject-call {
                background: #dc3545;
                color: white;
            }
            
            .reject-call:hover {
                background: #c82333;
            }
            
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            
            @keyframes slideOut {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(styles);
    }
    
    document.body.appendChild(notification);
    console.log('calls.js: Notification added to DOM');
    
    // Add event listeners using event delegation
    notification.addEventListener('click', function(event) {
        const button = event.target.closest('button');
        if (!button) return;
        
        const action = button.getAttribute('data-action');
        console.log('calls.js: Button clicked, action:', action);
        
        if (action === 'accept') {
            handleAcceptCall();
        } else if (action === 'reject') {
            handleRejectCall();
        }
    });
    
    // Auto remove after 30 seconds (call timeout)
    setTimeout(() => {
        if (document.body.contains(notification)) {
            console.log('calls.js: Auto-removing notification after timeout');
            handleTimeoutCall();
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }
    }, 30000);
}

// Handle accept call
async function handleAcceptCall() {
    console.log('calls.js: handleAcceptCall called');
    
    if (!currentCallData) {
        console.error('calls.js: No call data available');
        showNotification('Call data missing. Please try again.', 'error');
        return;
    }
    
    // Stop ringtone
    stopRingtone();
    
    console.log('calls.js: Current call data:', currentCallData);
    
    try {
        // Send call-accepted signal
        if (currentCallData.callType === 'personal') {
            await sendSignal({
                type: 'call-accepted',
                from: currentUser.uid,
                callId: currentCallData.callId
            }, currentCallData.from);
            
            console.log('calls.js: Redirecting to call page for personal call');
            // Redirect to call page
            window.location.href = `calls.html?type=personal&partnerId=${currentCallData.from}&incoming=true&callId=${currentCallData.callId}`;
            
        } else if (currentCallData.callType === 'group') {
            await sendSignal({
                type: 'group-call-accepted',
                from: currentUser.uid,
                callId: currentCallData.callId,
                groupId: currentCallData.groupId
            }, currentCallData.from);
            
            console.log('calls.js: Redirecting to call page for group call');
            // Redirect to call page
            window.location.href = `calls.html?type=group&groupId=${currentCallData.groupId}&incoming=true&callId=${currentCallData.callId}`;
        }
        
        // Remove notification
        const notification = document.querySelector('.incoming-call-notification');
        if (notification && notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
        
    } catch (error) {
        console.error('calls.js: Error in handleAcceptCall:', error);
        showNotification('Failed to accept call. Please try again.', 'error');
    }
}

// Handle reject call
async function handleRejectCall() {
    console.log('calls.js: handleRejectCall called');
    
    if (!currentCallData) {
        console.error('calls.js: No call data available');
        return;
    }
    
    // Stop ringtone
    stopRingtone();
    
    try {
        // Send rejection signal
        await sendSignal({
            type: 'call-rejected',
            from: currentUser.uid,
            callId: currentCallData.callId
        }, currentCallData.from);
        
        console.log('calls.js: Call rejected');
    } catch (error) {
        console.error('calls.js: Error rejecting call:', error);
    }
    
    // Remove notification
    const notification = document.querySelector('.incoming-call-notification');
    if (notification && notification.parentNode) {
        notification.parentNode.removeChild(notification);
    }
}

// Handle timeout call
async function handleTimeoutCall() {
    console.log('calls.js: handleTimeoutCall called');
    
    if (!currentCallData) {
        console.error('calls.js: No call data available');
        return;
    }
    
    // Stop ringtone
    stopRingtone();
    
    try {
        // Send timeout signal
        await sendSignal({
            type: 'call-timeout',
            from: currentUser.uid,
            callId: currentCallData.callId
        }, currentCallData.from);
        
        console.log('calls.js: Call timeout sent');
    } catch (error) {
        console.error('calls.js: Error sending timeout:', error);
    }
}

// Play notification sound
function playNotificationSound() {
    if (callNotificationSound) {
        try {
            callNotificationSound.currentTime = 0;
            callNotificationSound.play().catch((error) => {
                console.error('calls.js: Error playing notification sound:', error);
            });
        } catch (error) {
            console.error('calls.js: Error with notification sound:', error);
        }
    }
}

// Play ringtone for incoming call
function playRingtone() {
    if (isRinging) return;
    
    isRinging = true;
    console.log('calls.js: Playing ringtone');
    
    if (callRingtone) {
        try {
            callRingtone.currentTime = 0;
            callRingtone.play().catch((error) => {
                console.error('calls.js: Error playing ringtone:', error);
                isRinging = false;
            });
        } catch (error) {
            console.error('calls.js: Error with ringtone:', error);
            isRinging = false;
        }
    }
}

// Stop ringtone
function stopRingtone() {
    isRinging = false;
    console.log('calls.js: Stopping ringtone');
    
    if (callRingtone) {
        try {
            callRingtone.pause();
            callRingtone.currentTime = 0;
        } catch (error) {
            console.error('calls.js: Error stopping ringtone:', error);
        }
    }
}

// Setup media for receiver
async function setupMediaForReceiver() {
    console.log('calls.js: setupMediaForReceiver called');
    showLoader('Preparing for call...');
    
    if (currentCallType === 'personal' && currentCallPartnerId) {
        createPeerConnection(currentCallPartnerId);
    }
}

// Initiate a personal call
async function initiatePersonalCall(partnerId) {
    console.log('calls.js: initiatePersonalCall called for partner:', partnerId);
    
    if (!currentUser) {
        showNotification('Please log in to make calls.', 'error');
        return;
    }
    
    const callId = `${currentUser.uid}_${partnerId}_${Date.now()}`;
    console.log('calls.js: Generated call ID:', callId);
    
    try {
        await sendCallNotification(partnerId, 'personal', callId);
        console.log('calls.js: Notification sent, redirecting to call page');
        
        // Redirect to call page
        window.location.href = `calls.html?type=personal&partnerId=${partnerId}&incoming=false&callId=${callId}`;
        
    } catch (error) {
        console.error('calls.js: Error initiating personal call:', error);
        showNotification('Failed to initiate call. Please try again.', 'error');
    }
}

// Initiate a group call
async function initiateGroupCall(groupId) {
    console.log('calls.js: initiateGroupCall called for group:', groupId);
    
    if (!currentUser) {
        showNotification('Please log in to make calls.', 'error');
        return;
    }
    
    try {
        const membersRef = collection(db, 'groups', groupId, 'members');
        const membersSnapshot = await getDocs(membersRef);
        
        const members = [];
        membersSnapshot.forEach(doc => {
            if (doc.id !== currentUser.uid) {
                members.push(doc.id);
            }
        });
        
        if (members.length === 0) {
            showNotification('No other members in this group to call.', 'info');
            return;
        }
        
        const callId = `${currentUser.uid}_${groupId}_${Date.now()}`;
        console.log('calls.js: Generated group call ID:', callId);
        
        // Send notifications to all members
        await Promise.all(members.map(memberId => 
            sendCallNotification(memberId, 'group', callId, groupId)
        ));
        
        console.log('calls.js: Notifications sent, redirecting to call page');
        window.location.href = `calls.html?type=group&groupId=${groupId}&incoming=false&callId=${callId}`;
        
    } catch (error) {
        console.error('calls.js: Error initiating group call:', error);
        showNotification('Failed to initiate group call. Please try again.', 'error');
    }
}

// Send call notification
async function sendCallNotification(toUserId, callType, callId, groupId = null) {
    console.log('calls.js: sendCallNotification called:', { toUserId, callType, callId, groupId });
    
    try {
        const notificationId = `call_${Date.now()}`;
        const notificationData = {
            type: 'call',
            callType: callType,
            from: currentUser.uid,
            timestamp: serverTimestamp(),
            status: 'ringing',
            notificationId: notificationId,
            callId: callId
        };
        
        if (groupId) {
            notificationData.groupId = groupId;
        }
        
        await setDoc(doc(db, 'notifications', toUserId, 'calls', notificationId), notificationData);
        console.log('calls.js: Notification saved to database');
        
    } catch (error) {
        console.error('calls.js: Error sending notification:', error);
        throw error;
    }
}

// Start a call (caller side)
async function startCall() {
    try {
        console.log('calls.js: Starting call...');
        showLoader('Starting call...');
        
        // Get local media stream
        try {
            console.log('calls.js: Requesting microphone access...');
            localStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 44100,
                    channelCount: 1
                },
                video: false
            });
            console.log('calls.js: Microphone access granted');
        } catch (error) {
            console.error('calls.js: Failed to access microphone:', error);
            if (error.name === 'NotAllowedError') {
                showError('Microphone access denied. Please check your permissions.');
            } else if (error.name === 'NotFoundError') {
                showError('No microphone found.');
            } else {
                showError('Failed to access microphone: ' + error.message);
            }
            return;
        }
        
        // Update local audio element
        const localAudio = document.getElementById('localAudio');
        if (localAudio) {
            console.log('calls.js: Setting up local audio element');
            localAudio.srcObject = localStream;
            localAudio.muted = true;
            
            // Try to play the audio
            const playPromise = localAudio.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.error('calls.js: Error playing local audio:', error);
                });
            }
        }
        
        if (currentCallType === 'personal') {
            // Personal call - connect to single partner
            await startPersonalCall();
        } else if (currentCallType === 'group') {
            // Group call - connect to all members
            await startGroupCall();
        } else if (currentCallType === 'channel') {
            // Voice channel - connect to channel participants
            await connectToVoiceChannel(currentGroupId, currentVoiceChannel.id);
        }
        
        hideLoader();
        updateCallStatus('Ringing...');
        
    } catch (error) {
        console.error('calls.js: Failed to start call:', error);
        showError('Failed to start call. Please check your permissions.');
    }
}

// Start personal call
async function startPersonalCall() {
    console.log('calls.js: Starting personal call to:', currentCallPartnerId);
    
    // Create peer connection
    createPeerConnection(currentCallPartnerId);
    
    // Add local stream to peer connection
    if (localStream) {
        localStream.getTracks().forEach(track => {
            const pc = peerConnections.get(currentCallPartnerId);
            if (pc) {
                pc.addTrack(track, localStream);
            }
        });
    }
    
    // Create and send offer
    try {
        const peerConnection = peerConnections.get(currentCallPartnerId);
        if (!peerConnection) {
            throw new Error('Peer connection not created');
        }
        
        console.log('calls.js: Creating offer...');
        const offer = await peerConnection.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: false
        });
        await peerConnection.setLocalDescription(offer);
        
        console.log('calls.js: Sending offer to:', currentCallPartnerId);
        await sendSignal({
            type: 'offer',
            offer: offer,
            callType: 'personal',
            from: currentUser.uid,
            callId: activeCallId
        }, currentCallPartnerId);
        
        // Set timeout to end call if no answer
        callTimeout = setTimeout(() => {
            if (peerConnection && peerConnection.connectionState !== 'connected') {
                console.log('calls.js: No answer from user, timing out');
                showError('No answer from user');
                setTimeout(goBackToChat, 2000);
            }
        }, 30000);
        
        console.log('calls.js: Personal call started');
    } catch (error) {
        console.error('calls.js: Failed to start personal call:', error);
        showError('Failed to start call: ' + error.message);
    }
}

// Start group call
async function startGroupCall() {
    console.log('calls.js: Starting group call');
    
    // Get all group members
    try {
        const membersRef = collection(db, 'groups', currentGroupId, 'members');
        const membersSnapshot = await getDocs(membersRef);
        
        const members = [];
        membersSnapshot.forEach(doc => {
            if (doc.id !== currentUser.uid) {
                members.push(doc.id);
            }
        });
        
        console.log('calls.js: Total group members:', members.length);
        
        if (members.length === 0) {
            showNotification('No other members in this group to call.', 'info');
            return;
        }
        
        // Connect to all members
        for (const memberId of members) {
            setTimeout(() => {
                createAndConnect(memberId);
            }, Math.random() * 1000);
        }
        
        // Set timeout for initial connections
        callTimeout = setTimeout(() => {
            // Check if anyone answered
            let anyoneAnswered = false;
            peerConnections.forEach(pc => {
                if (pc.connectionState === 'connected') {
                    anyoneAnswered = true;
                }
            });
            
            if (!anyoneAnswered) {
                console.log('calls.js: No one answered the group call');
                showError('No one answered the group call');
                setTimeout(goBackToChat, 2000);
            }
        }, 30000);
        
        console.log('calls.js: Group call started');
        
    } catch (error) {
        console.error('calls.js: Failed to start group call:', error);
        showError('Failed to start group call: ' + error.message);
    }
}

// Create and connect
async function createAndConnect(userId) {
    if (peerConnections.has(userId)) {
        return;
    }
    
    try {
        console.log(`Creating connection to ${userId}`);
        
        // Create peer connection
        createPeerConnection(userId);
        
        // Add local stream
        if (localStream) {
            const pc = peerConnections.get(userId);
            if (pc) {
                localStream.getTracks().forEach(track => {
                    pc.addTrack(track, localStream);
                });
            }
        }
        
        // Create and send offer
        const peerConnection = peerConnections.get(userId);
        if (peerConnection) {
            const offer = await peerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: false
            });
            await peerConnection.setLocalDescription(offer);
            
            await sendSignal({
                type: 'offer',
                offer: offer,
                callType: 'group',
                from: currentUser.uid,
                callId: activeCallId,
                groupId: currentGroupId
            }, userId);
            
            console.log(`Offer sent to ${userId}`);
        }
        
    } catch (error) {
        console.error(`Failed to connect to ${userId}:`, error);
    }
}

// Create peer connection for a specific user
function createPeerConnection(userId) {
    try {
        console.log('calls.js: Creating peer connection for:', userId);
        const peerConnection = new RTCPeerConnection(rtcConfiguration);
        peerConnections.set(userId, peerConnection);
        
        // Handle remote stream for personal calls
        peerConnection.ontrack = (event) => {
            console.log('calls.js: Received remote track from:', userId);
            if (event.streams && event.streams[0]) {
                const remoteStream = event.streams[0];
                remoteStreams.set(userId, remoteStream);
                
                if (currentCallType === 'personal') {
                    // For personal calls, play the remote audio
                    const remoteAudio = document.getElementById('remoteAudio');
                    if (remoteAudio) {
                        remoteAudio.srcObject = remoteStream;
                        
                        // Try to play the audio
                        const playPromise = remoteAudio.play();
                        if (playPromise !== undefined) {
                            playPromise.then(() => {
                                console.log('calls.js: Remote audio playing');
                            }).catch(error => {
                                console.error('calls.js: Error playing remote audio:', error);
                            });
                        }
                    }
                } else if (currentCallType === 'group') {
                    // For group calls, create a new audio element
                    createGroupAudioElement(userId, remoteStream);
                }
                
                hideLoader();
                updateCallStatus('Connected');
                startCallTimer();
                isCallActive = true;
                
                console.log('calls.js: Remote stream connected from:', userId);
            }
        };
        
        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('calls.js: ICE candidate generated for:', userId);
                sendSignal({
                    type: 'ice-candidate',
                    candidate: event.candidate,
                    from: currentUser.uid,
                    callId: activeCallId,
                    callType: currentCallType,
                    groupId: currentGroupId
                }, userId);
            }
        };
        
        // Handle connection state changes
        peerConnection.onconnectionstatechange = () => {
            console.log(`calls.js: Connection state changed for ${userId}:`, peerConnection.connectionState);
            if (peerConnection.connectionState === 'connected') {
                hideLoader();
                updateCallStatus('Connected');
                startCallTimer();
                isCallActive = true;
                
                // Clear timeout if call is connected
                if (callTimeout) {
                    clearTimeout(callTimeout);
                    callTimeout = null;
                }
                
                console.log('calls.js: Peer connection connected for:', userId);
                
            } else if (peerConnection.connectionState === 'disconnected' || 
                       peerConnection.connectionState === 'failed') {
                console.log(`calls.js: Connection lost for ${userId}`);
                
                // If all participants disconnected, end call
                if (currentCallType === 'personal') {
                    console.log('calls.js: Call disconnected');
                    showCallEnded();
                }
            }
        };
        
        // Handle negotiation needed
        peerConnection.onnegotiationneeded = async () => {
            console.log('calls.js: Negotiation needed for:', userId);
            try {
                const offer = await peerConnection.createOffer();
                await peerConnection.setLocalDescription(offer);
                
                await sendSignal({
                    type: 'offer',
                    offer: offer,
                    from: currentUser.uid,
                    callId: activeCallId,
                    callType: currentCallType,
                    groupId: currentGroupId
                }, userId);
            } catch (error) {
                console.error('calls.js: Error in negotiation:', error);
            }
        };
        
        console.log('calls.js: Peer connection created for:', userId);
        
    } catch (error) {
        console.error('calls.js: Failed to create peer connection:', error);
        showError("Failed to create peer connection: " + error.message);
    }
}

// Create audio element for group call participants
function createGroupAudioElement(userId, remoteStream) {
    // Remove existing element if present
    const existingElement = document.getElementById(`remoteAudio_${userId}`);
    if (existingElement) {
        existingElement.remove();
    }
    
    const audioElement = document.createElement('audio');
    audioElement.id = `remoteAudio_${userId}`;
    audioElement.autoplay = true;
    audioElement.controls = false;
    audioElement.style.display = 'none';
    audioElement.srcObject = remoteStream;
    
    // Try to play the audio
    const playPromise = audioElement.play();
    if (playPromise !== undefined) {
        playPromise.catch(error => {
            console.error('calls.js: Error playing group audio:', error);
        });
    }
    
    document.body.appendChild(audioElement);
}

// Setup signaling listener
function setupSignalingListener() {
    if (!currentUser || !db) {
        console.error('calls.js: Cannot setup signaling listener - no user or db');
        return;
    }
    
    console.log('calls.js: Setting up signaling listener');
    
    const signalingRef = collection(db, 'calls', currentUser.uid, 'signals');
    
    const unsubscribe = onSnapshot(signalingRef, (snapshot) => {
        console.log('calls.js: Signaling snapshot received, changes:', snapshot.docChanges().length);
        
        snapshot.docChanges().forEach(async (change) => {
            if (change.type === 'added') {
                const data = change.doc.data();
                
                // Skip if already processed
                if (data.processed) {
                    console.log('calls.js: Signal already processed, skipping');
                    return;
                }
                
                // Only process signals for the current active call
                if (data.callId && data.callId !== activeCallId) {
                    console.log('calls.js: Signal for different call, ignoring');
                    return;
                }
                
                console.log('calls.js: New signal received:', data.type, 'from:', data.from);
                
                // Handle the signal
                await handleSignalingMessage(data);
                
                // Mark the signal as processed
                try {
                    await setDoc(doc(db, 'calls', currentUser.uid, 'signals', change.doc.id), {
                        processed: true
                    }, { merge: true });
                    console.log('calls.js: Signal marked as processed');
                } catch (error) {
                    console.error('calls.js: Error marking signal as processed:', error);
                }
            }
        });
    }, (error) => {
        console.error('calls.js: Error in signaling listener:', error);
    });
    
    signalingUnsubscribers.set('main', unsubscribe);
    console.log('calls.js: Signaling listener set up');
}

// Handle incoming offer
async function handleIncomingOffer(data) {
    console.log('calls.js: Handling incoming offer from:', data.from);
    
    // Clear any existing timeout
    if (callTimeout) {
        clearTimeout(callTimeout);
        callTimeout = null;
    }
    
    // Get local media stream for the receiver
    if (!localStream) {
        try {
            console.log('calls.js: Getting microphone access for incoming call');
            localStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 44100,
                    channelCount: 1
                },
                video: false
            });
            
            // Update local audio element
            const localAudio = document.getElementById('localAudio');
            if (localAudio) {
                localAudio.srcObject = localStream;
                localAudio.muted = true;
                
                const playPromise = localAudio.play();
                if (playPromise !== undefined) {
                    playPromise.catch(() => {
                        console.error('calls.js: Error playing local audio');
                    });
                }
            }
        } catch (error) {
            console.error('calls.js: Failed to access microphone:', error);
            showError('Failed to access microphone: ' + error.message);
            return;
        }
    }
    
    // Create peer connection if it doesn't exist
    if (!peerConnections.has(data.from)) {
        console.log('calls.js: Creating peer connection for:', data.from);
        createPeerConnection(data.from);
        
        // Add local stream to peer connection
        if (localStream) {
            localStream.getTracks().forEach(track => {
                const pc = peerConnections.get(data.from);
                if (pc) {
                    pc.addTrack(track, localStream);
                }
            });
        }
    }
    
    const peerConnection = peerConnections.get(data.from);
    if (!peerConnection) {
        console.error('calls.js: No peer connection for:', data.from);
        return;
    }
    
    // Set remote description
    try {
        const offerDescription = new RTCSessionDescription({
            type: 'offer',
            sdp: data.offer.sdp
        });
        
        console.log('calls.js: Setting remote description');
        await peerConnection.setRemoteDescription(offerDescription);
        console.log('calls.js: Set remote description successfully');
    } catch (error) {
        console.error('calls.js: Error setting remote description:', error);
        return;
    }
    
    // Create and send answer
    try {
        console.log('calls.js: Creating answer');
        const answer = await peerConnection.createAnswer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: false
        });
        await peerConnection.setLocalDescription(answer);
        
        console.log('calls.js: Sending answer to:', data.from);
        await sendSignal({
            type: 'answer',
            answer: answer,
            from: currentUser.uid,
            callId: data.callId,
            callType: data.callType || 'personal',
            groupId: data.groupId
        }, data.from);
        
        console.log('calls.js: Answer sent');
        
        hideLoader();
        updateCallStatus('Connected');
        startCallTimer();
        isCallActive = true;
        
    } catch (error) {
        console.error('calls.js: Error creating/sending answer:', error);
        showError('Failed to answer call: ' + error.message);
    }
}

// Handle answer
async function handleAnswer(data) {
    console.log('calls.js: Handling answer from:', data.from);
    const peerConnection = peerConnections.get(data.from);
    if (peerConnection) {
        try {
            const answerDescription = new RTCSessionDescription({
                type: 'answer',
                sdp: data.answer.sdp
            });
            
            console.log('calls.js: Setting remote answer');
            await peerConnection.setRemoteDescription(answerDescription);
            console.log('calls.js: Set remote answer successfully');
            
            // Clear the call timeout
            if (callTimeout) {
                clearTimeout(callTimeout);
                callTimeout = null;
            }
            
            hideLoader();
            updateCallStatus('Connected');
            startCallTimer();
            isCallActive = true;
            
            console.log('calls.js: Call connected with:', data.from);
            
        } catch (error) {
            console.error('calls.js: Error setting remote answer:', error);
        }
    }
}

// Handle ICE candidate
async function handleIceCandidate(data) {
    const peerConnection = peerConnections.get(data.from);
    if (peerConnection && data.candidate) {
        try {
            const iceCandidate = new RTCIceCandidate(data.candidate);
            console.log('calls.js: Adding ICE candidate from:', data.from);
            await peerConnection.addIceCandidate(iceCandidate);
        } catch (error) {
            console.error('calls.js: Error adding ICE candidate:', error);
        }
    }
}

// Send signaling message
async function sendSignal(data, targetUserId) {
    if (!targetUserId || !db) {
        console.error('calls.js: Cannot send signal - missing target or db');
        return;
    }
    
    try {
        // Serialize WebRTC objects before storing in Firestore
        const serializedData = { ...data };
        
        // Serialize RTCSessionDescription (offer/answer)
        if (data.offer) {
            serializedData.offer = {
                type: data.offer.type,
                sdp: data.offer.sdp
            };
        }
        
        if (data.answer) {
            serializedData.answer = {
                type: data.answer.type,
                sdp: data.answer.sdp
            };
        }
        
        // Serialize RTCIceCandidate
        if (data.candidate) {
            serializedData.candidate = {
                candidate: data.candidate.candidate,
                sdpMid: data.candidate.sdpMid,
                sdpMLineIndex: data.candidate.sdpMLineIndex,
                usernameFragment: data.candidate.usernameFragment
            };
        }
        
        // Add timestamp
        serializedData.timestamp = serverTimestamp();
        serializedData.processed = false;
        
        // Create a unique ID for this signal
        const signalId = `signal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Send to the recipient's signaling channel
        await setDoc(doc(db, 'calls', targetUserId, 'signals', signalId), serializedData);
        
        console.log('calls.js: Signal sent:', data.type, 'to:', targetUserId);
        
    } catch (error) {
        console.error('calls.js: Error sending signal:', error);
    }
}

// Start call timer
function startCallTimer() {
    console.log('calls.js: Starting call timer');
    callStartTime = new Date();
    
    if (callDurationInterval) {
        clearInterval(callDurationInterval);
    }
    
    callDurationInterval = setInterval(() => {
        if (callStartTime) {
            const now = new Date();
            const duration = Math.floor((now - callStartTime) / 1000);
            const minutes = Math.floor(duration / 60);
            const seconds = duration % 60;
            updateCallStatus(`Connected ${minutes}:${seconds.toString().padStart(2, '0')}`);
        }
    }, 1000);
}

// Stop call timer
function stopCallTimer() {
    if (callDurationInterval) {
        clearInterval(callDurationInterval);
        callDurationInterval = null;
    }
    
    if (callStartTime) {
        const endTime = new Date();
        const duration = Math.floor((endTime - callStartTime) / 1000);
        callStartTime = null;
        return duration;
    }
    
    return 0;
}

// Show call ended screen
function showCallEnded() {
    console.log('calls.js: Showing call ended screen');
    
    const callEndedElement = document.getElementById('callEnded');
    const callContainer = document.getElementById('callContainer');
    
    if (callEndedElement) callEndedElement.style.display = 'flex';
    if (callContainer) callContainer.style.display = 'none';
    
    // Auto-redirect to chat page after 2 seconds
    setTimeout(() => {
        console.log('calls.js: Auto-redirecting to chat');
        goBackToChat();
    }, 2000);
}

// Update call status
function updateCallStatus(status) {
    const callStatusElement = document.getElementById('callStatus');
    if (callStatusElement) {
        callStatusElement.textContent = status;
    }
}

// Show loader
function showLoader(message) {
    const loader = document.getElementById('loader');
    if (loader) {
        loader.style.display = 'flex';
        if (message) {
            const loaderText = loader.querySelector('p');
            if (loaderText) {
                loaderText.textContent = message;
            }
        }
    }
}

// Hide loader
function hideLoader() {
    const loader = document.getElementById('loader');
    if (loader) {
        loader.style.display = 'none';
    }
}

// Show error
function showError(message) {
    console.error('calls.js: Error:', message);
    updateCallStatus(message);
    setTimeout(goBackToChat, 3000);
}

// Show notification
function showNotification(message, type = 'info') {
    console.log(`calls.js: Notification [${type}]:`, message);
    
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 10000;
        display: flex;
        align-items: center;
        max-width: 350px;
        animation: slideIn 0.3s ease;
        border-left: 4px solid ${type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : type === 'warning' ? '#ffc107' : '#007bff'};
    `;
    
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px; color: black;">
            <i class="fas ${type === 'error' ? 'fa-exclamation-circle' : type === 'success' ? 'fa-check-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}" 
               style="color: ${type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : type === 'warning' ? '#ffc107' : '#007bff'};"></i>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Clean up when leaving the page
window.addEventListener('beforeunload', () => {
    if (peerConnections.size > 0 || localStream) {
        console.log('calls.js: Page unloading, ending call');
        // Don't end voice channel calls, just clean up resources
        if (currentCallType !== 'channel') {
            endCall();
        }
    }
});

// Export functions for use in other files
window.callsModule = {
    initiatePersonalCall,
    initiateGroupCall,
    createVoiceChannel,
    joinVoiceChannel,
    leaveVoiceChannel,
    endCall,
    toggleMute
};