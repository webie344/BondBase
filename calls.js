// calls.js - Complete Voice Call System for Personal & Group Chats
// FIXED VERSION - Working Private Calls & Optimized Group Calls

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
    increment
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

// WebRTC configuration - OPTIMIZED for larger groups
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
    // Optimize for audio-only
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
let callParticipants = new Set();
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
let pendingSignals = [];
let currentCallData = null;
let isCallActive = false;

// NEW: Group call optimization variables
let connectionPriority = new Map();
let maxSimultaneousConnections = 15; // Increased for 100+ users
let connectionQueue = [];
let activeConnections = new Set();
let connectionRetryCount = new Map();

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('calls.js: DOM loaded');
    
    const isCallPage = window.location.pathname.includes('calls.html');
    
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
            
            if (isCallPage) {
                console.log('calls.js: On call page, handling call');
                handleCallPage();
            } else {
                console.log('calls.js: On chat page, setting up listeners');
                setupCallButtonListeners();
                setupCallNotificationsListener();
            }
        } else {
            showNotification('Please log in to make calls.', 'error');
        }
    });
});

// NEW: Connection queue processor
function processConnectionQueue() {
    if (connectionQueue.length === 0 || activeConnections.size >= maxSimultaneousConnections) {
        return;
    }
    
    const availableSlots = maxSimultaneousConnections - activeConnections.size;
    const toConnect = connectionQueue.splice(0, Math.min(availableSlots, 5)); // Connect 5 at a time
    
    toConnect.forEach(memberId => {
        setTimeout(() => {
            createAndConnect(memberId);
        }, Math.random() * 1000); // Random delay to avoid congestion
    });
}

// NEW: Create and connect with retry logic
async function createAndConnect(userId) {
    if (activeConnections.has(userId) || peerConnections.has(userId)) {
        return;
    }
    
    const retryCount = connectionRetryCount.get(userId) || 0;
    if (retryCount > 3) {
        console.log(`Max retries exceeded for ${userId}, skipping`);
        return;
    }
    
    try {
        activeConnections.add(userId);
        connectionRetryCount.set(userId, retryCount + 1);
        
        console.log(`Creating connection to ${userId} (attempt ${retryCount + 1})`);
        
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
        
        // Reset retry count on success
        connectionRetryCount.set(userId, 0);
        
    } catch (error) {
        console.error(`Failed to connect to ${userId}:`, error);
        activeConnections.delete(userId);
        
        // Retry after delay
        if (retryCount < 3) {
            setTimeout(() => {
                connectionQueue.unshift(userId);
                processConnectionQueue();
            }, 2000 * (retryCount + 1));
        }
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

// Setup call button listeners on chat/group pages
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

// Handle the call page - this runs when calls.html loads
async function handleCallPage() {
    console.log('calls.js: handleCallPage called');
    
    const urlParams = new URLSearchParams(window.location.search);
    const callType = urlParams.get('type');
    const partnerId = urlParams.get('partnerId');
    const groupId = urlParams.get('groupId');
    const isIncoming = urlParams.get('incoming') === 'true';
    const callId = urlParams.get('callId');
    
    console.log('calls.js: Call page params:', { 
        callType, 
        partnerId, 
        groupId, 
        isIncoming, 
        callId 
    });
    
    if (!callType || (!partnerId && !groupId)) {
        console.error('calls.js: Invalid call parameters');
        showError('Invalid call parameters');
        return;
    }
    
    currentCallType = callType;
    activeCallId = callId || `${currentUser.uid}_${Date.now()}`;
    isCaller = !isIncoming;
    
    if (callType === 'personal') {
        currentCallPartnerId = partnerId;
        // For personal calls, always add partner to participants
        callParticipants.add(partnerId);
    } else if (callType === 'group') {
        currentGroupId = groupId;
        callParticipants.add(currentUser.uid);
    }
    
    // Store in session storage for cleanup
    sessionStorage.setItem('currentCallType', currentCallType);
    sessionStorage.setItem('activeCallId', activeCallId);
    if (currentCallPartnerId) sessionStorage.setItem('currentCallPartnerId', currentCallPartnerId);
    if (currentGroupId) sessionStorage.setItem('currentGroupId', currentGroupId);
    
    console.log('calls.js: Call initialized:', {
        currentCallType,
        activeCallId,
        isCaller,
        currentCallPartnerId,
        currentGroupId
    });
    
    // Update UI with call info
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
        }
    } catch (error) {
        console.error('calls.js: Error updating UI:', error);
    }
    
    // Show/hide participants section based on call type
    if (callType === 'group') {
        const participantsSection = document.getElementById('participantsSection');
        if (participantsSection) {
            participantsSection.style.display = 'block';
        }
        const remoteAudioLabel = document.getElementById('remoteAudioLabel');
        if (remoteAudioLabel) {
            remoteAudioLabel.textContent = 'Others';
        }
    } else {
        const participantsSection = document.getElementById('participantsSection');
        if (participantsSection) {
            participantsSection.style.display = 'none';
        }
        const remoteAudioLabel = document.getElementById('remoteAudioLabel');
        if (remoteAudioLabel) {
            remoteAudioLabel.textContent = 'Partner';
        }
    }
    
    // Set up event listeners for call controls
    const muteBtn = document.getElementById('muteBtn');
    const endCallBtn = document.getElementById('endCallBtn');
    const backToChatBtn = document.getElementById('backToChat');
    
    if (muteBtn) {
        console.log('calls.js: Adding mute button listener');
        muteBtn.addEventListener('click', toggleMute);
    }
    
    if (endCallBtn) {
        console.log('calls.js: Adding end call button listener');
        endCallBtn.addEventListener('click', endCall);
    }
    
    if (backToChatBtn) {
        console.log('calls.js: Adding back to chat button listener');
        backToChatBtn.addEventListener('click', goBackToChat);
    }
    
    // Setup signaling listener FIRST
    console.log('calls.js: Setting up signaling listener');
    setupSignalingListener();
    
    // Start the call process
    if (isCaller) {
        console.log('calls.js: We are the caller, initiating call');
        startCall();
    } else {
        console.log('calls.js: We are the receiver, waiting for offer');
        setupMediaForReceiver();
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

// Start group call - OPTIMIZED VERSION
async function startGroupCall() {
    console.log('calls.js: Starting OPTIMIZED group call');
    
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
        
        // Initialize connection queue
        connectionQueue = [...members];
        
        // Connect to first batch of members
        const initialBatch = connectionQueue.splice(0, maxSimultaneousConnections);
        
        for (const memberId of initialBatch) {
            setTimeout(() => {
                createAndConnect(memberId);
            }, Math.random() * 500); // Stagger connections
        }
        
        // Set up periodic queue processing
        setInterval(processConnectionQueue, 2000);
        
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
        
        // Update participants UI
        updateParticipantsUI();
        
        console.log('calls.js: Optimized group call started');
        
    } catch (error) {
        console.error('calls.js: Failed to start group call:', error);
        showError('Failed to start group call: ' + error.message);
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
                    // For group calls, create a new audio element for each participant
                    createGroupAudioElement(userId, remoteStream);
                }
                
                // Add participant to UI
                callParticipants.add(userId);
                updateParticipantsUI();
                
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
                
                // Update active connections
                activeConnections.delete(userId);
                
                // Clear timeout if call is connected
                if (callTimeout) {
                    clearTimeout(callTimeout);
                    callTimeout = null;
                }
                
                console.log('calls.js: Peer connection connected for:', userId);
                
            } else if (peerConnection.connectionState === 'disconnected' || 
                       peerConnection.connectionState === 'failed') {
                console.log(`calls.js: Connection lost for ${userId}`);
                
                // Remove from active connections
                activeConnections.delete(userId);
                
                // Remove from participants
                callParticipants.delete(userId);
                updateParticipantsUI();
                
                // If all participants disconnected, end call
                if (currentCallType === 'personal' || callParticipants.size <= 1) {
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

// Update participants UI for group calls
async function updateParticipantsUI() {
    const participantsContainer = document.getElementById('participantsContainer');
    if (!participantsContainer) return;
    
    participantsContainer.innerHTML = '';
    
    // Add local participant (current user)
    const localParticipant = document.createElement('div');
    localParticipant.className = 'participant';
    localParticipant.innerHTML = `
        <div class="participant-avatar local">
            <i class="fas fa-user"></i>
        </div>
        <div class="participant-name">You</div>
        <div class="participant-status ${isMuted ? 'muted' : 'speaking'}">
            <i class="fas ${isMuted ? 'fa-microphone-slash' : 'fa-microphone'}"></i>
        </div>
    `;
    participantsContainer.appendChild(localParticipant);
    
    // Add remote participants
    for (const userId of callParticipants) {
        if (userId === currentUser.uid) continue;
        
        try {
            const userName = await getUserName(userId);
            const participant = document.createElement('div');
            participant.className = 'participant';
            participant.innerHTML = `
                <div class="participant-avatar">
                    <i class="fas fa-user"></i>
                </div>
                <div class="participant-name">${userName}</div>
                <div class="participant-status speaking">
                    <i class="fas fa-microphone"></i>
                </div>
            `;
            participantsContainer.appendChild(participant);
        } catch (error) {
            console.error('calls.js: Error adding participant to UI:', error);
        }
    }
    
    // Update participant count
    const participantCount = document.getElementById('participantCount');
    if (participantCount) {
        const totalParticipants = callParticipants.size;
        participantCount.textContent = `${totalParticipants} participant${totalParticipants !== 1 ? 's' : ''}`;
    }
    
    console.log('calls.js: Participants UI updated, count:', callParticipants.size);
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

// Handle incoming signaling messages
async function handleSignalingMessage(data) {
    try {
        console.log('calls.js: Handling signal:', data.type, 'from:', data.from);
        
        switch (data.type) {
            case 'offer':
                if (data.callType === 'personal' || data.callType === 'group') {
                    await handleIncomingOffer(data);
                }
                break;
                
            case 'answer':
                await handleAnswer(data);
                break;
                
            case 'ice-candidate':
                await handleIceCandidate(data);
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
                
            case 'call-timeout':
                console.log('calls.js: Call timeout');
                showError('Call timed out.');
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

// Handle incoming offer (both personal and group)
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
            
            // Add to participants
            callParticipants.add(data.from);
            updateParticipantsUI();
            
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

// Send signaling message - PROPERLY SERIALIZED VERSION
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

// Toggle mute
function toggleMute() {
    if (!localStream) return;
    
    const audioTracks = localStream.getAudioTracks();
    if (audioTracks.length > 0) {
        isMuted = !isMuted;
        audioTracks[0].enabled = !isMuted;
        
        const muteBtn = document.getElementById('muteBtn');
        if (muteBtn) {
            muteBtn.classList.toggle('active', isMuted);
            muteBtn.innerHTML = isMuted ? 
                '<i class="fas fa-microphone-slash"></i>' : 
                '<i class="fas fa-microphone"></i>';
        }
        
        // Update participants UI for group calls
        if (currentCallType === 'group') {
            updateParticipantsUI();
        }
        
        console.log('calls.js: Mute toggled:', isMuted);
    }
}

// End the current call
async function endCall() {
    console.log('calls.js: Ending call');
    
    try {
        // Clear any timeout
        if (callTimeout) {
            clearTimeout(callTimeout);
            callTimeout = null;
        }
        
        // Stop call timer and get duration
        const callDuration = stopCallTimer();
        
        // Stop ringtone if playing
        stopRingtone();
        
        console.log('calls.js: Sending end call signals');
        
        // Send end call signals to all connected peers
        if (currentCallType === 'personal' && currentCallPartnerId) {
            await sendSignal({
                type: 'end-call',
                from: currentUser.uid,
                callId: activeCallId,
                duration: callDuration
            }, currentCallPartnerId);
        } else if (currentCallType === 'group' && currentGroupId) {
            // Send to all participants
            for (const userId of callParticipants) {
                if (userId !== currentUser.uid) {
                    await sendSignal({
                        type: 'end-call',
                        from: currentUser.uid,
                        callId: activeCallId,
                        duration: callDuration,
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

// Clean up call resources
function cleanupCallResources() {
    console.log('calls.js: Cleaning up call resources');
    
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
    
    // Remove all group audio elements
    document.querySelectorAll('[id^="remoteAudio_"]').forEach(el => {
        el.pause();
        el.srcObject = null;
        el.remove();
    });
    
    // Clear signaling listeners
    signalingUnsubscribers.forEach(unsubscribe => {
        if (unsubscribe) unsubscribe();
    });
    signalingUnsubscribers.clear();
    
    // Clear participants
    callParticipants.clear();
    
    // Clear connection queues
    connectionQueue = [];
    activeConnections.clear();
    connectionRetryCount.clear();
    connectionPriority.clear();
    
    // Clear pending signals
    pendingSignals = [];
    
    // Clear session storage
    sessionStorage.removeItem('currentCallType');
    sessionStorage.removeItem('activeCallId');
    sessionStorage.removeItem('currentCallPartnerId');
    sessionStorage.removeItem('currentGroupId');
    
    // Clear global variables
    activeCallId = null;
    currentCallType = null;
    currentCallPartnerId = null;
    currentGroupId = null;
    currentCallData = null;
    isCallActive = false;
    
    console.log('calls.js: Call resources cleaned up');
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

// Go back to chat
function goBackToChat() {
    console.log('calls.js: Going back to chat');
    cleanupCallResources();
    
    if (currentCallType === 'personal' && currentCallPartnerId) {
        window.location.href = 'chat.html?id=' + currentCallPartnerId;
    } else if (currentCallType === 'group' && currentGroupId) {
        window.location.href = 'group.html?id=' + currentGroupId;
    } else {
        window.location.href = 'groups.html';
    }
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
        endCall();
    }
});

// Export functions for use in other files
window.callsModule = {
    initiatePersonalCall,
    initiateGroupCall,
    endCall,
    toggleMute
};