// calls.js - Complete Voice Call System for Personal & Group Chats
// COMPLETE FIXED VERSION

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
    updateDoc,
    addDoc,
    query,
    orderBy,
    getDocs,
    where,
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

// WebRTC configuration
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
    rtcpMuxPolicy: 'require'
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

// Setup call button listeners
function setupCallButtonListeners() {
    console.log('calls.js: Setting up call button listeners');
    
    const voiceCallBtn = document.getElementById('voiceCallBtn');
    const groupVoiceCallBtn = document.getElementById('groupVoiceCallBtn');
    
    if (voiceCallBtn) {
        voiceCallBtn.addEventListener('click', () => {
            const urlParams = new URLSearchParams(window.location.search);
            const partnerId = urlParams.get('id');
            if (partnerId) {
                initiatePersonalCall(partnerId);
            } else {
                showNotification('Cannot start call. No chat partner found.', 'error');
            }
        });
    }
    
    if (groupVoiceCallBtn) {
        groupVoiceCallBtn.addEventListener('click', () => {
            const urlParams = new URLSearchParams(window.location.search);
            const groupId = urlParams.get('id');
            if (groupId) {
                initiateGroupCall(groupId);
            } else {
                showNotification('Cannot start group call. No group selected.', 'error');
            }
        });
    }
}

// Setup listener for incoming call notifications
function setupCallNotificationsListener() {
    if (!currentUser || !db) return;
    
    console.log('calls.js: Setting up call notifications listener');
    
    const notificationsRef = collection(db, 'notifications', currentUser.uid, 'calls');
    
    onSnapshot(notificationsRef, (snapshot) => {
        console.log('calls.js: Notification snapshot received');
        
        snapshot.docChanges().forEach(async (change) => {
            if (change.type === 'added') {
                const data = change.doc.data();
                console.log('calls.js: New notification:', data);
                
                const notificationTime = data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp);
                if (Date.now() - notificationTime.getTime() > 30000) {
                    await deleteDoc(doc(db, 'notifications', currentUser.uid, 'calls', change.doc.id));
                    return;
                }
                
                playNotificationSound();
                
                if (data.type === 'call' && data.status === 'ringing') {
                    showIncomingCallNotification(data);
                }
                
                await deleteDoc(doc(db, 'notifications', currentUser.uid, 'calls', change.doc.id));
            }
        });
    });
}

// Show incoming call notification
async function showIncomingCallNotification(data) {
    console.log('calls.js: Creating incoming call notification');
    
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.incoming-call-notification');
    existingNotifications.forEach(notification => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    });
    
    // Get caller name
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
    
    // Store call data
    currentCallData = data;
    
    // Play ringtone
    playRingtone();
    
    // Create notification
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
    
    // Add styles
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
        `;
        document.head.appendChild(styles);
    }
    
    document.body.appendChild(notification);
    
    // Add event listeners
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
    
    // Auto remove after 30 seconds
    setTimeout(() => {
        if (document.body.contains(notification)) {
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
        return;
    }
    
    // Stop ringtone
    stopRingtone();
    
    console.log('calls.js: Current call data:', currentCallData);
    
    try {
        if (currentCallData.callType === 'personal') {
            await sendSignal({
                type: 'call-accepted',
                from: currentUser.uid,
                callId: currentCallData.callId
            }, currentCallData.from);
            
            console.log('calls.js: Redirecting to call page for personal call');
            window.location.href = `calls.html?type=personal&partnerId=${currentCallData.from}&incoming=true&callId=${currentCallData.callId}`;
            
        } else if (currentCallData.callType === 'group') {
            await sendSignal({
                type: 'group-call-accepted',
                from: currentUser.uid,
                callId: currentCallData.callId,
                groupId: currentCallData.groupId
            }, currentCallData.from);
            
            console.log('calls.js: Redirecting to call page for group call');
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
    
    if (!currentCallData) return;
    
    stopRingtone();
    
    try {
        await sendSignal({
            type: 'call-rejected',
            from: currentUser.uid,
            callId: currentCallData.callId
        }, currentCallData.from);
    } catch (error) {
        console.error('calls.js: Error rejecting call:', error);
    }
    
    const notification = document.querySelector('.incoming-call-notification');
    if (notification && notification.parentNode) {
        notification.parentNode.removeChild(notification);
    }
}

// Handle timeout call
async function handleTimeoutCall() {
    console.log('calls.js: handleTimeoutCall called');
    
    if (!currentCallData) return;
    
    stopRingtone();
    
    try {
        await sendSignal({
            type: 'call-timeout',
            from: currentUser.uid,
            callId: currentCallData.callId
        }, currentCallData.from);
    } catch (error) {
        console.error('calls.js: Error sending timeout:', error);
    }
}

// Play notification sound
function playNotificationSound() {
    if (callNotificationSound) {
        try {
            callNotificationSound.currentTime = 0;
            callNotificationSound.play().catch(() => {});
        } catch (error) {
            console.error('calls.js: Error playing notification sound:', error);
        }
    }
}

// Play ringtone
function playRingtone() {
    if (isRinging) return;
    
    isRinging = true;
    if (callRingtone) {
        try {
            callRingtone.currentTime = 0;
            callRingtone.play().catch(() => {});
        } catch (error) {
            console.error('calls.js: Error playing ringtone:', error);
            isRinging = false;
        }
    }
}

// Stop ringtone
function stopRingtone() {
    isRinging = false;
    if (callRingtone) {
        try {
            callRingtone.pause();
            callRingtone.currentTime = 0;
        } catch (error) {
            console.error('calls.js: Error stopping ringtone:', error);
        }
    }
}

// Handle the call page
async function handleCallPage() {
    console.log('calls.js: handleCallPage called');
    
    const urlParams = new URLSearchParams(window.location.search);
    const callType = urlParams.get('type');
    const partnerId = urlParams.get('partnerId');
    const groupId = urlParams.get('groupId');
    const isIncoming = urlParams.get('incoming') === 'true';
    const callId = urlParams.get('callId');
    
    console.log('calls.js: Call params:', { callType, partnerId, groupId, isIncoming, callId });
    
    if (!callType || (!partnerId && !groupId)) {
        showError('Invalid call parameters');
        return;
    }
    
    currentCallType = callType;
    activeCallId = callId || `${currentUser.uid}_${callType}_${Date.now()}`;
    isCaller = !isIncoming;
    
    if (callType === 'personal') {
        currentCallPartnerId = partnerId;
    } else if (callType === 'group') {
        currentGroupId = groupId;
        callParticipants.add(currentUser.uid);
    }
    
    // Update UI
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
    
    // Set up event listeners
    const muteBtn = document.getElementById('muteBtn');
    const endCallBtn = document.getElementById('endCallBtn');
    const backToChatBtn = document.getElementById('backToChat');
    
    if (muteBtn) muteBtn.addEventListener('click', toggleMute);
    if (endCallBtn) endCallBtn.addEventListener('click', endCall);
    if (backToChatBtn) backToChatBtn.addEventListener('click', goBackToChat);
    
    // Setup signaling listener
    setupSignalingListener();
    
    // Start call process
    if (isCaller) {
        startCall();
    } else {
        setupMediaForReceiver();
    }
}

// Setup media for receiver
async function setupMediaForReceiver() {
    showLoader('Preparing for call...');
    
    if (currentCallType === 'personal') {
        createPeerConnection(currentCallPartnerId);
    }
}

// Initiate a personal call
async function initiatePersonalCall(partnerId) {
    if (!currentUser) {
        showNotification('Please log in to make calls.', 'error');
        return;
    }
    
    const callId = `${currentUser.uid}_${partnerId}_${Date.now()}`;
    
    try {
        await sendCallNotification(partnerId, 'personal', callId);
        window.location.href = `calls.html?type=personal&partnerId=${partnerId}&incoming=false&callId=${callId}`;
    } catch (error) {
        showNotification('Failed to initiate call. Please try again.', 'error');
    }
}

// Initiate a group call
async function initiateGroupCall(groupId) {
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
        
        await Promise.all(members.map(memberId => 
            sendCallNotification(memberId, 'group', callId, groupId)
        ));
        
        window.location.href = `calls.html?type=group&groupId=${groupId}&incoming=false&callId=${callId}`;
        
    } catch (error) {
        showNotification('Failed to initiate group call. Please try again.', 'error');
    }
}

// Send call notification
async function sendCallNotification(toUserId, callType, callId, groupId = null) {
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
        
    } catch (error) {
        throw error;
    }
}

// Start a call (caller side)
async function startCall() {
    try {
        showLoader('Starting call...');
        
        try {
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
        } catch (error) {
            if (error.name === 'NotAllowedError') {
                showError('Microphone access denied. Please check your permissions.');
            } else if (error.name === 'NotFoundError') {
                showError('No microphone found.');
            } else {
                showError('Failed to access microphone: ' + error.message);
            }
            return;
        }
        
        const localAudio = document.getElementById('localAudio');
        if (localAudio) {
            localAudio.srcObject = localStream;
            localAudio.muted = true;
            localAudio.play().catch(() => {});
        }
        
        if (currentCallType === 'personal') {
            await startPersonalCall();
        } else if (currentCallType === 'group') {
            await startGroupCall();
        }
        
        hideLoader();
        updateCallStatus('Ringing...');
        
    } catch (error) {
        showError('Failed to start call. Please check your permissions.');
    }
}

// Start personal call
async function startPersonalCall() {
    createPeerConnection(currentCallPartnerId);
    
    localStream.getTracks().forEach(track => {
        const pc = peerConnections.get(currentCallPartnerId);
        if (pc) {
            pc.addTrack(track, localStream);
        }
    });
    
    try {
        const peerConnection = peerConnections.get(currentCallPartnerId);
        if (!peerConnection) {
            throw new Error('Peer connection not created');
        }
        
        const offer = await peerConnection.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: false
        });
        await peerConnection.setLocalDescription(offer);
        
        await sendSignal({
            type: 'offer',
            offer: offer,
            callType: 'personal',
            from: currentUser.uid,
            callId: activeCallId
        }, currentCallPartnerId);
        
        callTimeout = setTimeout(() => {
            if (peerConnection && peerConnection.connectionState !== 'connected') {
                showError('No answer from user');
                setTimeout(goBackToChat, 2000);
            }
        }, 30000);
        
    } catch (error) {
        showError('Failed to start call: ' + error.message);
    }
}

// Start group call
async function startGroupCall() {
    try {
        const membersRef = collection(db, 'groups', currentGroupId, 'members');
        const membersSnapshot = await getDocs(membersRef);
        
        const members = [];
        membersSnapshot.forEach(doc => {
            if (doc.id !== currentUser.uid) {
                members.push(doc.id);
            }
        });
        
        for (const memberId of members) {
            createPeerConnection(memberId);
            
            localStream.getTracks().forEach(track => {
                const pc = peerConnections.get(memberId);
                if (pc) {
                    pc.addTrack(track, localStream);
                }
            });
            
            const peerConnection = peerConnections.get(memberId);
            const offer = await peerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: false
            });
            await peerConnection.setLocalDescription(offer);
            
            await sendSignal({
                type: 'group-offer',
                offer: offer,
                callType: 'group',
                from: currentUser.uid,
                callId: activeCallId,
                groupId: currentGroupId
            }, memberId);
        }
        
        callTimeout = setTimeout(() => {
            let anyoneAnswered = false;
            peerConnections.forEach(pc => {
                if (pc.connectionState === 'connected') {
                    anyoneAnswered = true;
                }
            });
            
            if (!anyoneAnswered) {
                showError('No one answered the group call');
                setTimeout(goBackToChat, 2000);
            }
        }, 30000);
        
        updateParticipantsUI();
        
    } catch (error) {
        showError('Failed to start group call: ' + error.message);
    }
}

// Create peer connection
function createPeerConnection(userId) {
    try {
        const peerConnection = new RTCPeerConnection(rtcConfiguration);
        peerConnections.set(userId, peerConnection);
        
        peerConnection.ontrack = (event) => {
            console.log('Received remote track from:', userId);
            if (event.streams && event.streams[0]) {
                const remoteStream = event.streams[0];
                remoteStreams.set(userId, remoteStream);
                
                if (currentCallType === 'personal') {
                    const remoteAudio = document.getElementById('remoteAudio');
                    if (remoteAudio) {
                        remoteAudio.srcObject = remoteStream;
                        remoteAudio.play().catch((error) => {
                            console.log('Error playing remote audio:', error);
                        });
                    }
                }
                
                if (currentCallType === 'group') {
                    callParticipants.add(userId);
                    updateParticipantsUI();
                }
                
                hideLoader();
                updateCallStatus('Connected');
                startCallTimer();
            }
        };
        
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
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
        
        peerConnection.onconnectionstatechange = () => {
            console.log(`Connection state changed for ${userId}:`, peerConnection.connectionState);
            if (peerConnection.connectionState === 'connected') {
                hideLoader();
                updateCallStatus('Connected');
                startCallTimer();
                
                if (callTimeout) {
                    clearTimeout(callTimeout);
                    callTimeout = null;
                }
                
            } else if (peerConnection.connectionState === 'disconnected' || 
                       peerConnection.connectionState === 'failed') {
                if (currentCallType === 'group') {
                    callParticipants.delete(userId);
                    updateParticipantsUI();
                    
                    if (callParticipants.size <= 1) {
                        showCallEnded();
                    }
                } else {
                    showCallEnded();
                }
            }
        };
        
    } catch (error) {
        showError("Failed to create peer connection: " + error.message);
    }
}

// Update participants UI
async function updateParticipantsUI() {
    const participantsContainer = document.getElementById('participantsContainer');
    if (!participantsContainer) return;
    
    participantsContainer.innerHTML = '';
    
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
    
    const participantCount = document.getElementById('participantCount');
    if (participantCount) {
        participantCount.textContent = `${callParticipants.size} participant${callParticipants.size !== 1 ? 's' : ''}`;
    }
}

// Setup signaling listener
function setupSignalingListener() {
    if (!currentUser || !db) return;
    
    const signalingRef = collection(db, 'calls', currentUser.uid, 'signals');
    
    const unsubscribe = onSnapshot(signalingRef, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
            if (change.type === 'added') {
                const data = change.doc.data();
                
                if (data.processed) return;
                
                if (data.callId && data.callId !== activeCallId) return;
                
                console.log('calls.js: Received signal:', data.type, 'from:', data.from);
                
                await handleSignalingMessage(data);
                
                try {
                    await setDoc(doc(db, 'calls', currentUser.uid, 'signals', change.doc.id), {
                        processed: true
                    }, { merge: true });
                } catch (error) {
                    console.error('calls.js: Error marking signal as processed:', error);
                }
            }
        });
    });
    
    signalingUnsubscribers.set('main', unsubscribe);
}

// Handle incoming signaling messages
async function handleSignalingMessage(data) {
    try {
        console.log('calls.js: Handling signal:', data.type);
        
        switch (data.type) {
            case 'offer':
                if (data.callType === 'personal') {
                    await handlePersonalOffer(data);
                } else if (data.callType === 'group') {
                    await handleGroupOffer(data);
                }
                break;
                
            case 'answer':
                await handleAnswer(data);
                break;
                
            case 'ice-candidate':
                await handleIceCandidate(data);
                break;
                
            case 'call-accepted':
                hideLoader();
                updateCallStatus('Connecting...');
                break;
                
            case 'call-rejected':
                showError('Call was rejected.');
                setTimeout(goBackToChat, 2000);
                break;
                
            case 'call-timeout':
                showError('Call timed out.');
                setTimeout(goBackToChat, 2000);
                break;
                
            case 'end-call':
                showCallEnded();
                break;
        }
    } catch (error) {
        console.error('calls.js: Error handling signaling message:', error);
        showNotification('Error handling call request: ' + error.message, 'error');
    }
}

// Handle personal offer
async function handlePersonalOffer(data) {
    console.log('calls.js: Handling personal offer from:', data.from);
    
    if (callTimeout) {
        clearTimeout(callTimeout);
        callTimeout = null;
    }
    
    if (!localStream) {
        try {
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
            
            const localAudio = document.getElementById('localAudio');
            if (localAudio) {
                localAudio.srcObject = localStream;
                localAudio.muted = true;
                localAudio.play().catch(() => {});
            }
        } catch (error) {
            showError('Failed to access microphone: ' + error.message);
            return;
        }
    }
    
    if (!peerConnections.has(data.from)) {
        createPeerConnection(data.from);
        
        localStream.getTracks().forEach(track => {
            const pc = peerConnections.get(data.from);
            if (pc) {
                pc.addTrack(track, localStream);
            }
        });
    }
    
    const peerConnection = peerConnections.get(data.from);
    if (!peerConnection) return;
    
    const offer = data.offer;
    try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    } catch (error) {
        console.error('calls.js: Error setting remote description:', error);
        return;
    }
    
    try {
        const answer = await peerConnection.createAnswer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: false
        });
        await peerConnection.setLocalDescription(answer);
        
        await sendSignal({
            type: 'answer',
            answer: answer,
            from: currentUser.uid,
            callId: data.callId,
            callType: 'personal'
        }, data.from);
        
        hideLoader();
        updateCallStatus('Connected');
        startCallTimer();
    } catch (error) {
        console.error('calls.js: Error creating/sending answer:', error);
        showError('Failed to answer call: ' + error.message);
    }
}

// Handle group offer
async function handleGroupOffer(data) {
    if (callTimeout) {
        clearTimeout(callTimeout);
        callTimeout = null;
    }
    
    if (!localStream) {
        try {
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
            
            const localAudio = document.getElementById('localAudio');
            if (localAudio) {
                localAudio.srcObject = localStream;
                localAudio.muted = true;
                localAudio.play().catch(() => {});
            }
        } catch (error) {
            showError('Failed to access microphone: ' + error.message);
            return;
        }
    }
    
    if (!peerConnections.has(data.from)) {
        createPeerConnection(data.from);
        
        localStream.getTracks().forEach(track => {
            const pc = peerConnections.get(data.from);
            if (pc) {
                pc.addTrack(track, localStream);
            }
        });
    }
    
    const peerConnection = peerConnections.get(data.from);
    const offer = data.offer;
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    
    await sendSignal({
        type: 'answer',
        answer: answer,
        from: currentUser.uid,
        callId: data.callId,
        callType: 'group',
        groupId: data.groupId
    }, data.from);
    
    callParticipants.add(data.from);
    updateParticipantsUI();
    
    hideLoader();
    updateCallStatus('Connected');
    startCallTimer();
}

// Handle answer
async function handleAnswer(data) {
    console.log('calls.js: Handling answer from:', data.from);
    const peerConnection = peerConnections.get(data.from);
    if (peerConnection) {
        const answer = data.answer;
        try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
            
            if (callTimeout) {
                clearTimeout(callTimeout);
                callTimeout = null;
            }
            
            if (currentCallType === 'group') {
                callParticipants.add(data.from);
                updateParticipantsUI();
            }
            
            hideLoader();
            updateCallStatus('Connected');
            startCallTimer();
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
            await peerConnection.addIceCandidate(iceCandidate);
        } catch (error) {
            console.error('calls.js: Error adding ICE candidate:', error);
        }
    }
}

// Send signal
async function sendSignal(data, targetUserId) {
    if (!targetUserId || !db) return;
    
    try {
        data.timestamp = serverTimestamp();
        const signalId = `signal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        await setDoc(doc(db, 'calls', targetUserId, 'signals', signalId), data);
        
    } catch (error) {
        console.error('calls.js: Error sending signal:', error);
    }
}

// Start call timer
function startCallTimer() {
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
        
        if (currentCallType === 'group') {
            updateParticipantsUI();
        }
    }
}

// End call
async function endCall() {
    try {
        if (callTimeout) {
            clearTimeout(callTimeout);
            callTimeout = null;
        }
        
        const callDuration = stopCallTimer();
        stopRingtone();
        
        if (currentCallType === 'personal' && currentCallPartnerId) {
            await sendSignal({
                type: 'end-call',
                from: currentUser.uid,
                callId: activeCallId,
                duration: callDuration
            }, currentCallPartnerId);
        } else if (currentCallType === 'group' && currentGroupId) {
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
        
    } catch (error) {
        cleanupCallResources();
    }
}

// Clean up resources
function cleanupCallResources() {
    peerConnections.forEach((pc, userId) => {
        if (pc) {
            pc.close();
        }
    });
    peerConnections.clear();
    
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    remoteStreams.clear();
    
    signalingUnsubscribers.forEach(unsubscribe => {
        if (unsubscribe) unsubscribe();
    });
    signalingUnsubscribers.clear();
    
    callParticipants.clear();
    pendingSignals = [];
    
    activeCallId = null;
    currentCallType = null;
    currentCallPartnerId = null;
    currentGroupId = null;
    currentCallData = null;
}

// Show call ended screen
function showCallEnded() {
    const callEndedElement = document.getElementById('callEnded');
    const callContainer = document.getElementById('callContainer');
    
    if (callEndedElement) callEndedElement.style.display = 'flex';
    if (callContainer) callContainer.style.display = 'none';
    
    setTimeout(() => {
        goBackToChat();
    }, 2000);
}

// Go back to chat
function goBackToChat() {
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
    updateCallStatus(message);
    setTimeout(goBackToChat, 3000);
}

// Show notification
function showNotification(message, type = 'info') {
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
        endCall();
    }
});

// Export functions
window.callsModule = {
    initiatePersonalCall,
    initiateGroupCall,
    endCall,
    toggleMute
};

console.log('calls.js: Complete module loaded');