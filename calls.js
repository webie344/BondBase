// calls.js - Complete Voice Call System for Personal & Group Chats
// Uses WebRTC for real-time voice communication

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
let remoteStreams = new Map(); // For group calls: userId -> MediaStream
let peerConnections = new Map(); // userId -> RTCPeerConnection
let currentUser = null;
let db = null;
let auth = null;
let activeCallId = null;
let currentCallType = null; // 'personal' or 'group'
let currentCallPartnerId = null; // For personal calls
let currentGroupId = null; // For group calls
let callParticipants = new Set(); // For group calls
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
let processedCalls = new Set();

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    const isCallPage = window.location.pathname.includes('calls.html');
    
    // Initialize Firebase
    try {
        const app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        
        // Preload notification sounds
        preloadNotificationSounds();
    } catch (error) {
        showNotification('Firebase initialization failed. Please refresh the page.', 'error');
        return;
    }
    
    // Set up auth state listener
    onAuthStateChanged(auth, function(user) {
        if (user) {
            currentUser = user;
            
            if (isCallPage) {
                // We're on the call page - handle the call
                handleCallPage();
            } else {
                // We're on chat/group pages - set up call buttons and listeners
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
    } catch (error) {
        // Silent fail for production
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
        // Try group_users collection for group chat users
        try {
            const groupUserDoc = await getDoc(doc(db, 'group_users', userId));
            if (groupUserDoc.exists()) {
                const userName = groupUserDoc.data().displayName || 'Unknown User';
                userCache.set(userId, userName);
                return userName;
            }
        } catch (error2) {
            // Silent fail
        }
    }
    
    return 'Unknown User';
}

// Setup call button listeners on chat/group pages
function setupCallButtonListeners() {
    // Personal chat call buttons
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
    
    // Also check for buttons with different IDs
    setTimeout(() => {
        const allCallButtons = document.querySelectorAll('[id*="call"], [id*="Call"]');
        allCallButtons.forEach(button => {
            if (button.id !== 'voiceCallBtn' && button.id !== 'groupVoiceCallBtn' && !button.dataset.callListener) {
                button.dataset.callListener = 'true';
                button.addEventListener('click', function() {
                    // Check if we're on a group page or personal chat page
                    const urlParams = new URLSearchParams(window.location.search);
                    const groupId = urlParams.get('id');
                    
                    if (window.location.pathname.includes('group.html') && groupId) {
                        initiateGroupCall(groupId);
                    } else {
                        const partnerId = urlParams.get('id');
                        if (partnerId) {
                            initiatePersonalCall(partnerId);
                        }
                    }
                });
            }
        });
    }, 1000);
}

// Setup listener for incoming call notifications
function setupCallNotificationsListener() {
    if (!currentUser || !db) return;
    
    const notificationsRef = collection(db, 'notifications', currentUser.uid, 'calls');
    
    onSnapshot(notificationsRef, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
            if (change.type === 'added') {
                const data = change.doc.data();
                
                // Only process recent notifications (last 30 seconds)
                const notificationTime = data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp);
                if (Date.now() - notificationTime.getTime() > 30000) {
                    await deleteDoc(doc(db, 'notifications', currentUser.uid, 'calls', change.doc.id));
                    return;
                }
                
                // Play notification sound
                playNotificationSound();
                
                // Show incoming call notification
                if (data.type === 'call' && data.status === 'ringing') {
                    showIncomingCallNotification(data);
                }
                
                // Mark as processed
                await deleteDoc(doc(db, 'notifications', currentUser.uid, 'calls', change.doc.id));
            }
        });
    });
}

// Show incoming call notification
async function showIncomingCallNotification(data) {
    // Remove any existing notifications first
    const existingNotifications = document.querySelectorAll('.incoming-call-notification');
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
            // Silent fail
        }
        callTypeText = 'Group Voice Call';
    }
    
    // Play ringtone
    playRingtone();
    
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
                <button id="acceptIncomingCall" class="accept-call">
                    <i class="fas fa-phone"></i> Accept
                </button>
                <button id="rejectIncomingCall" class="reject-call">
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
    
    // Add event listeners
    const acceptBtn = document.getElementById('acceptIncomingCall');
    const rejectBtn = document.getElementById('rejectIncomingCall');
    
    if (acceptBtn) {
        acceptBtn.addEventListener('click', () => {
            // Stop ringtone
            stopRingtone();
            
            // Send call-accepted signal
            if (data.callType === 'personal') {
                sendSignal({
                    type: 'call-accepted',
                    from: currentUser.uid,
                    callId: data.callId
                }, data.from);
                
                // Redirect to call page
                window.location.href = `calls.html?type=personal&partnerId=${data.from}&incoming=true&callId=${data.callId}`;
            } else if (data.callType === 'group') {
                sendSignal({
                    type: 'group-call-accepted',
                    from: currentUser.uid,
                    callId: data.callId,
                    groupId: data.groupId
                }, data.from);
                
                // Redirect to call page
                window.location.href = `calls.html?type=group&groupId=${data.groupId}&incoming=true&callId=${data.callId}`;
            }
            
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        });
    }
    
    if (rejectBtn) {
        rejectBtn.addEventListener('click', () => {
            // Stop ringtone
            stopRingtone();
            
            // Send rejection signal
            sendSignal({
                type: 'call-rejected',
                from: currentUser.uid,
                callId: data.callId
            }, data.from);
            
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        });
    }
    
    // Auto remove after 30 seconds (call timeout)
    setTimeout(() => {
        if (notification.parentNode) {
            // Stop ringtone
            stopRingtone();
            
            // Send timeout signal
            sendSignal({
                type: 'call-timeout',
                from: currentUser.uid,
                callId: data.callId
            }, data.from);
            
            notification.parentNode.removeChild(notification);
        }
    }, 30000);
}

// Play notification sound
function playNotificationSound() {
    if (callNotificationSound) {
        try {
            callNotificationSound.currentTime = 0;
            callNotificationSound.play().catch(() => {});
        } catch (error) {
            // Silent fail for production
        }
    }
}

// Play ringtone for incoming call
function playRingtone() {
    if (isRinging) return;
    
    isRinging = true;
    if (callRingtone) {
        try {
            callRingtone.currentTime = 0;
            callRingtone.play().catch(() => {});
        } catch (error) {
            // Silent fail for production
        }
    }
}

// Stop ringtone
function stopRingtone() {
    isRinging = false;
    if (callRingtone) {
        try {
            callRingtone.pause();
        } catch (error) {
            // Silent fail for production
        }
    }
}

// Handle the call page - this runs when calls.html loads
async function handleCallPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const callType = urlParams.get('type'); // 'personal' or 'group'
    const partnerId = urlParams.get('partnerId');
    const groupId = urlParams.get('groupId');
    const isIncoming = urlParams.get('incoming') === 'true';
    const callId = urlParams.get('callId');
    
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
        // Initialize call participants set
        callParticipants.add(currentUser.uid);
    }
    
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
        // Silent fail
    }
    
    // Set up event listeners for call controls
    const muteBtn = document.getElementById('muteBtn');
    const endCallBtn = document.getElementById('endCallBtn');
    const backToChatBtn = document.getElementById('backToChat');
    
    if (muteBtn) muteBtn.addEventListener('click', toggleMute);
    if (endCallBtn) endCallBtn.addEventListener('click', endCall);
    if (backToChatBtn) backToChatBtn.addEventListener('click', goBackToChat);
    
    // Start the call process
    if (isCaller) {
        // We are the caller - initiate the call
        startCall();
    } else {
        // We are the receiver - wait for offer
        setupMediaForReceiver();
    }
    
    // Setup signaling listener
    setupSignalingListener();
}

// Setup media for receiver (without starting stream immediately)
async function setupMediaForReceiver() {
    showLoader('Preparing for call...');
    
    if (currentCallType === 'personal') {
        // Create peer connection for personal call
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
    
    // Send notification to the partner
    try {
        await sendCallNotification(partnerId, 'personal', callId);
        
        // Redirect to call page
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
    
    // Get group members
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
        
        // Send notifications to all members
        await Promise.all(members.map(memberId => 
            sendCallNotification(memberId, 'group', callId, groupId)
        ));
        
        // Redirect to call page
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
        
        // Get local media stream
        try {
            localStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 44100,
                    channelCount: 1
                },
                video: false // Voice only
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
        
        // Update local audio element
        const localAudio = document.getElementById('localAudio');
        if (localAudio) {
            localAudio.srcObject = localStream;
            localAudio.muted = true;
            localAudio.play().catch(() => {});
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
        showError('Failed to start call. Please check your permissions.');
    }
}

// Start personal call
async function startPersonalCall() {
    // Create peer connection
    createPeerConnection(currentCallPartnerId);
    
    // Add local stream to peer connection
    localStream.getTracks().forEach(track => {
        peerConnections.get(currentCallPartnerId).addTrack(track, localStream);
    });
    
    // Create and send offer
    try {
        const peerConnection = peerConnections.get(currentCallPartnerId);
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
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
        
        // Create peer connection for each member
        for (const memberId of members) {
            createPeerConnection(memberId);
            
            // Add local stream to peer connection
            localStream.getTracks().forEach(track => {
                peerConnections.get(memberId).addTrack(track, localStream);
            });
            
            // Create and send offer
            const peerConnection = peerConnections.get(memberId);
            const offer = await peerConnection.createOffer();
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
        
        // Set timeout
        callTimeout = setTimeout(() => {
            // Check if anyone answered
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
        
        // Update participants UI
        updateParticipantsUI();
        
    } catch (error) {
        showError('Failed to start group call: ' + error.message);
    }
}

// Create peer connection for a specific user
function createPeerConnection(userId) {
    try {
        const peerConnection = new RTCPeerConnection(rtcConfiguration);
        peerConnections.set(userId, peerConnection);
        
        // Handle remote stream for personal calls
        peerConnection.ontrack = (event) => {
            if (event.streams && event.streams[0]) {
                const remoteStream = event.streams[0];
                remoteStreams.set(userId, remoteStream);
                
                if (currentCallType === 'personal') {
                    // For personal calls, play the remote audio
                    const remoteAudio = document.getElementById('remoteAudio');
                    if (remoteAudio) {
                        remoteAudio.srcObject = remoteStream;
                        remoteAudio.play().catch(() => {});
                    }
                }
                
                // Add participant to UI for group calls
                if (currentCallType === 'group') {
                    callParticipants.add(userId);
                    updateParticipantsUI();
                }
                
                hideLoader();
                updateCallStatus('Connected');
                startCallTimer();
            }
        };
        
        // Handle ICE candidates
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
        
        // Handle connection state changes
        peerConnection.onconnectionstatechange = () => {
            if (peerConnection.connectionState === 'connected') {
                hideLoader();
                updateCallStatus('Connected');
                startCallTimer();
                
                // Clear timeout if call is connected
                if (callTimeout) {
                    clearTimeout(callTimeout);
                    callTimeout = null;
                }
                
            } else if (peerConnection.connectionState === 'disconnected' || 
                       peerConnection.connectionState === 'failed') {
                // Handle disconnection
                if (currentCallType === 'group') {
                    callParticipants.delete(userId);
                    updateParticipantsUI();
                    
                    // If all participants disconnected, end call
                    if (callParticipants.size <= 1) {
                        showCallEnded();
                    }
                } else {
                    showCallEnded();
                }
            }
        };
        
        // Handle ICE connection state
        peerConnection.oniceconnectionstatechange = () => {
            if (peerConnection.iceConnectionState === 'disconnected') {
                console.log('ICE connection disconnected for user:', userId);
            }
        };
        
    } catch (error) {
        showError("Failed to create peer connection: " + error.message);
    }
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
            // Silent fail
        }
    }
    
    // Update participant count
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
                
                // Skip if already processed
                if (data.processed) return;
                
                // Only process signals for the current active call
                if (data.callId && data.callId !== activeCallId) return;
                
                await handleSignalingMessage(data);
                
                // Mark the signal as processed
                try {
                    await setDoc(doc(db, 'calls', currentUser.uid, 'signals', change.doc.id), {
                        processed: true
                    }, { merge: true });
                } catch (error) {
                    // Silent fail
                }
            }
        });
    });
    
    signalingUnsubscribers.set('main', unsubscribe);
}

// Handle incoming signaling messages
async function handleSignalingMessage(data) {
    try {
        switch (data.type) {
            case 'offer':
                if (data.callType === 'personal') {
                    await handlePersonalOffer(data);
                } else if (data.callType === 'group') {
                    await handleGroupOffer(data);
                }
                break;
                
            case 'group-offer':
                await handleGroupOffer(data);
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
                
            case 'group-call-accepted':
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
        showNotification('Error handling call request: ' + error.message, 'error');
    }
}

// Handle personal call offer
async function handlePersonalOffer(data) {
    // Clear any existing timeout
    if (callTimeout) {
        clearTimeout(callTimeout);
        callTimeout = null;
    }
    
    // Get local media stream for the receiver
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
            
            // Update local audio element
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
    
    // Create peer connection if it doesn't exist
    if (!peerConnections.has(data.from)) {
        createPeerConnection(data.from);
        
        // Add local stream to peer connection
        localStream.getTracks().forEach(track => {
            peerConnections.get(data.from).addTrack(track, localStream);
        });
    }
    
    const peerConnection = peerConnections.get(data.from);
    const offer = data.offer;
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    
    // Create and send answer
    const answer = await peerConnection.createAnswer();
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
}

// Handle group call offer
async function handleGroupOffer(data) {
    // Clear any existing timeout
    if (callTimeout) {
        clearTimeout(callTimeout);
        callTimeout = null;
    }
    
    // Get local media stream if we don't have it
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
            
            // Update local audio element
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
    
    // Create peer connection for this caller
    if (!peerConnections.has(data.from)) {
        createPeerConnection(data.from);
        
        // Add local stream to peer connection
        localStream.getTracks().forEach(track => {
            peerConnections.get(data.from).addTrack(track, localStream);
        });
    }
    
    const peerConnection = peerConnections.get(data.from);
    const offer = data.offer;
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    
    // Create and send answer
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
    
    // Add to participants
    callParticipants.add(data.from);
    updateParticipantsUI();
    
    hideLoader();
    updateCallStatus('Connected');
    startCallTimer();
}

// Handle answer
async function handleAnswer(data) {
    const peerConnection = peerConnections.get(data.from);
    if (peerConnection) {
        const answer = data.answer;
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        
        // Clear the call timeout
        if (callTimeout) {
            clearTimeout(callTimeout);
            callTimeout = null;
        }
        
        // Add to participants for group calls
        if (currentCallType === 'group') {
            callParticipants.add(data.from);
            updateParticipantsUI();
        }
        
        hideLoader();
        updateCallStatus('Connected');
        startCallTimer();
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
            // Silent fail
        }
    }
}

// Send signaling message
async function sendSignal(data, targetUserId = null) {
    const targetId = targetUserId;
    
    if (!targetId || !db) {
        return;
    }
    
    try {
        // Add timestamp and from field
        data.timestamp = serverTimestamp();
        
        // Create a unique ID for this signal
        const signalId = `signal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Send to the recipient's signaling channel
        await setDoc(doc(db, 'calls', targetId, 'signals', signalId), data);
        
    } catch (error) {
        // Silent fail
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
        
        // Update participants UI for group calls
        if (currentCallType === 'group') {
            updateParticipantsUI();
        }
    }
}

// End the current call
async function endCall() {
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
        
    } catch (error) {
        cleanupCallResources();
    }
}

// Clean up call resources
function cleanupCallResources() {
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
    
    // Clear signaling listeners
    signalingUnsubscribers.forEach(unsubscribe => {
        if (unsubscribe) unsubscribe();
    });
    signalingUnsubscribers.clear();
    
    // Clear participants
    callParticipants.clear();
    
    // Clear global variables
    activeCallId = null;
    currentCallType = null;
    currentCallPartnerId = null;
    currentGroupId = null;
}

// Show call ended screen
function showCallEnded() {
    const callEndedElement = document.getElementById('callEnded');
    const callContainer = document.getElementById('callContainer');
    
    if (callEndedElement) callEndedElement.style.display = 'flex';
    if (callContainer) callContainer.style.display = 'none';
    
    // Auto-redirect to chat page after 2 seconds
    setTimeout(() => {
        goBackToChat();
    }, 2000);
}

// Go back to chat
function goBackToChat() {
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

