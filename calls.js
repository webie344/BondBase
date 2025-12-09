// calls.js - Complete Voice Call System for Personal & Group Chats
// COMPLETELY REWRITTEN & FIXED VERSION

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
    updateDoc
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
let callParticipants = new Map(); // Using Map to avoid duplicates
let isCaller = false;
let isMuted = false;
let callStartTime = null;
let callDurationInterval = null;
let callTimeout = null;
let isRinging = false;
let callRingtone = null;
let callNotificationSound = null;
let userCache = new Map();
let isCallActive = false;
let signalingListeners = new Map();
let processedSignalIds = new Set();

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('calls.js: DOM loaded');
    
    const isCallPage = window.location.pathname.includes('calls.html');
    
    // Initialize Firebase
    try {
        const app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        
        console.log('calls.js: Firebase initialized');
    } catch (error) {
        console.error('calls.js: Firebase initialization failed:', error);
        showNotification('Firebase initialization failed. Please refresh the page.', 'error');
        return;
    }
    
    // Set up auth state listener
    onAuthStateChanged(auth, function(user) {
        console.log('calls.js: Auth state changed');
        if (user) {
            currentUser = user;
            console.log('calls.js: User logged in:', user.uid);
            
            if (isCallPage) {
                console.log('calls.js: On call page, handling call');
                handleCallPage();
            } else {
                console.log('calls.js: On chat page, setting up listeners');
                setupCallButtonListeners();
                setupCallNotificationsListener();
            }
        } else {
            console.log('calls.js: User logged out');
            showNotification('Please log in to make calls.', 'error');
        }
    });
});

// Setup call button listeners on chat/group pages
function setupCallButtonListeners() {
    console.log('calls.js: Setting up call button listeners');
    
    // Personal chat call button
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
        console.log('calls.js: Cannot setup notifications listener');
        return;
    }
    
    console.log('calls.js: Setting up call notifications listener');
    
    const notificationsRef = collection(db, 'notifications', currentUser.uid, 'calls');
    
    onSnapshot(notificationsRef, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
            if (change.type === 'added') {
                const data = change.doc.data();
                console.log('calls.js: New notification received:', data);
                
                // Delete notification immediately
                await deleteDoc(doc(db, 'notifications', currentUser.uid, 'calls', change.doc.id));
                
                // Show incoming call notification
                if (data.type === 'call' && data.status === 'ringing') {
                    console.log('calls.js: Showing incoming call notification');
                    showIncomingCallNotification(data);
                }
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
    
    console.log('calls.js: Caller name:', callerName);
    
    // Store call data globally
    currentCallData = data;
    
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
                    <p>${callerName}</p>
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
            console.log('calls.js: Auto-removing notification after timeout');
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
    
    if (!currentCallData) {
        console.error('calls.js: No call data available');
        return;
    }
    
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
    } else if (callType === 'group') {
        currentGroupId = groupId;
        callParticipants.set(currentUser.uid, {
            id: currentUser.uid,
            name: 'You',
            connected: true
        });
    }
    
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
    }
    
    // Set up event listeners for call controls
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
    if (isCaller) {
        console.log('calls.js: We are the caller, initiating call');
        startCall();
    } else {
        console.log('calls.js: We are the receiver, waiting for offer');
        // As receiver, we wait for the offer signal
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
                    channelCount: 2
                },
                video: false
            });
            console.log('calls.js: Microphone access granted');
            
            // Play local audio for monitoring
            const localAudio = document.getElementById('localAudio');
            if (localAudio) {
                localAudio.srcObject = localStream;
                localAudio.muted = true;
                localAudio.play().catch(console.error);
            }
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
        
        if (currentCallType === 'personal') {
            await startPersonalCall();
        } else if (currentCallType === 'group') {
            await startGroupCall();
        }
        
        hideLoader();
        updateCallStatus('Calling...');
        
    } catch (error) {
        console.error('calls.js: Failed to start call:', error);
        showError('Failed to start call. Please check your permissions.');
    }
}

// Start personal call
async function startPersonalCall() {
    console.log('calls.js: Starting personal call to:', currentCallPartnerId);
    
    // Create peer connection
    await createPeerConnection(currentCallPartnerId);
    
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
            sdp: offer.sdp,
            callType: 'personal',
            from: currentUser.uid,
            callId: activeCallId
        }, currentCallPartnerId);
        
        // Set timeout
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
        
        console.log('calls.js: Group members:', members);
        
        if (members.length === 0) {
            showNotification('No other members in this group to call.', 'info');
            return;
        }
        
        // Create peer connection for each member
        for (const memberId of members) {
            console.log('calls.js: Creating peer connection for:', memberId);
            await createPeerConnection(memberId);
            
            // Create and send offer
            const peerConnection = peerConnections.get(memberId);
            const offer = await peerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: false
            });
            
            await peerConnection.setLocalDescription(offer);
            
            await sendSignal({
                type: 'offer',
                sdp: offer.sdp,
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
                console.log('calls.js: No one answered the group call');
                showError('No one answered the group call');
                setTimeout(goBackToChat, 2000);
            }
        }, 30000);
        
        // Update participants UI
        updateParticipantsUI();
        
        console.log('calls.js: Group call started');
        
    } catch (error) {
        console.error('calls.js: Failed to start group call:', error);
        showError('Failed to start group call: ' + error.message);
    }
}

// Create peer connection for a specific user
async function createPeerConnection(userId) {
    return new Promise((resolve) => {
        try {
            console.log('calls.js: Creating peer connection for:', userId);
            const peerConnection = new RTCPeerConnection(rtcConfiguration);
            peerConnections.set(userId, peerConnection);
            
            // Add local stream tracks
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
                    
                    // Play the audio
                    if (currentCallType === 'personal') {
                        const remoteAudio = document.getElementById('remoteAudio');
                        if (remoteAudio) {
                            remoteAudio.srcObject = remoteStream;
                            remoteAudio.play().catch(console.error);
                        }
                    } else if (currentCallType === 'group') {
                        // Create audio element for group participant
                        const audioElement = document.createElement('audio');
                        audioElement.id = `audio_${userId}`;
                        audioElement.autoplay = true;
                        audioElement.controls = false;
                        audioElement.style.display = 'none';
                        audioElement.srcObject = remoteStream;
                        audioElement.play().catch(console.error);
                        document.body.appendChild(audioElement);
                    }
                    
                    // Update participant status
                    callParticipants.set(userId, {
                        id: userId,
                        name: 'Loading...',
                        connected: true
                    });
                    
                    // Update UI
                    updateParticipantsUI();
                    
                    hideLoader();
                    updateCallStatus('Connected');
                    startCallTimer();
                    isCallActive = true;
                    
                    console.log('calls.js: Remote audio connected from:', userId);
                }
            };
            
            // Handle ICE candidates
            peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    console.log('calls.js: ICE candidate for:', userId);
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
            
            // Handle connection state
            peerConnection.onconnectionstatechange = () => {
                console.log(`calls.js: Connection state for ${userId}:`, peerConnection.connectionState);
                
                if (peerConnection.connectionState === 'connected') {
                    // Clear timeout
                    if (callTimeout) {
                        clearTimeout(callTimeout);
                        callTimeout = null;
                    }
                    
                    // Start call timer
                    if (!callStartTime) {
                        startCallTimer();
                    }
                    
                    console.log('calls.js: Connected to:', userId);
                }
                
                if (peerConnection.connectionState === 'disconnected' || 
                    peerConnection.connectionState === 'failed' ||
                    peerConnection.connectionState === 'closed') {
                    
                    console.log(`calls.js: Connection lost with ${userId}`);
                    
                    // Update participant status
                    callParticipants.delete(userId);
                    updateParticipantsUI();
                    
                    // Check if we should end the call
                    if (currentCallType === 'personal') {
                        setTimeout(() => {
                            showCallEnded();
                        }, 1000);
                    } else if (currentCallType === 'group' && callParticipants.size <= 1) {
                        setTimeout(() => {
                            showCallEnded();
                        }, 1000);
                    }
                }
            };
            
            console.log('calls.js: Peer connection created for:', userId);
            resolve();
            
        } catch (error) {
            console.error('calls.js: Failed to create peer connection:', error);
            resolve();
        }
    });
}

// Setup signaling listener
function setupSignalingListener() {
    if (!currentUser || !db) {
        console.error('calls.js: Cannot setup signaling listener');
        return;
    }
    
    console.log('calls.js: Setting up signaling listener');
    
    const signalingRef = collection(db, 'calls', currentUser.uid, 'signals');
    
    const unsubscribe = onSnapshot(signalingRef, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
            if (change.type === 'added') {
                const data = change.doc.data();
                const signalId = change.doc.id;
                
                // Skip if already processed
                if (processedSignalIds.has(signalId)) {
                    return;
                }
                processedSignalIds.add(signalId);
                
                console.log('calls.js: Processing signal:', data.type, 'from:', data.from);
                
                // Delete the signal after processing
                await deleteDoc(doc(db, 'calls', currentUser.uid, 'signals', signalId));
                
                // Handle the signal
                await handleSignalingMessage(data);
            }
        });
    }, (error) => {
        console.error('calls.js: Error in signaling listener:', error);
    });
    
    signalingListeners.set('main', unsubscribe);
    console.log('calls.js: Signaling listener set up');
}

// Handle incoming signaling messages
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
                
            case 'call-accepted':
                console.log('calls.js: Call accepted by:', data.from);
                hideLoader();
                updateCallStatus('Connecting...');
                break;
                
            case 'call-rejected':
                console.log('calls.js: Call rejected by:', data.from);
                showError('Call was rejected.');
                setTimeout(goBackToChat, 2000);
                break;
                
            case 'end-call':
                console.log('calls.js: Call ended by:', data.from);
                showCallEnded();
                break;
        }
    } catch (error) {
        console.error('calls.js: Error handling signaling message:', error);
    }
}

// Handle incoming offer
async function handleIncomingOffer(data) {
    console.log('calls.js: Handling incoming offer from:', data.from);
    
    // Get local media stream
    if (!localStream) {
        try {
            console.log('calls.js: Getting microphone access for incoming call');
            localStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 44100,
                    channelCount: 2
                },
                video: false
            });
            
            // Play local audio for monitoring
            const localAudio = document.getElementById('localAudio');
            if (localAudio) {
                localAudio.srcObject = localStream;
                localAudio.muted = true;
                localAudio.play().catch(console.error);
            }
        } catch (error) {
            console.error('calls.js: Failed to access microphone:', error);
            return;
        }
    }
    
    // Create peer connection if it doesn't exist
    if (!peerConnections.has(data.from)) {
        console.log('calls.js: Creating peer connection for:', data.from);
        await createPeerConnection(data.from);
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
            sdp: data.sdp
        });
        
        await peerConnection.setRemoteDescription(offerDescription);
        
        // Create and send answer
        const answer = await peerConnection.createAnswer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: false
        });
        
        await peerConnection.setLocalDescription(answer);
        
        await sendSignal({
            type: 'answer',
            sdp: answer.sdp,
            from: currentUser.uid,
            callId: data.callId,
            callType: data.callType || 'personal',
            groupId: data.groupId
        }, data.from);
        
        console.log('calls.js: Answer sent to:', data.from);
        
        // Update UI
        hideLoader();
        updateCallStatus('Connected');
        
        // Add participant for group calls
        if (data.callType === 'group' && data.from) {
            callParticipants.set(data.from, {
                id: data.from,
                name: 'Loading...',
                connected: true
            });
            updateParticipantsUI();
        }
        
    } catch (error) {
        console.error('calls.js: Error handling offer:', error);
    }
}

// Handle answer
async function handleAnswer(data) {
    console.log('calls.js: Handling answer from:', data.from);
    const peerConnection = peerConnections.get(data.from);
    if (peerConnection && peerConnection.signalingState !== 'stable') {
        try {
            const answerDescription = new RTCSessionDescription({
                type: 'answer',
                sdp: data.sdp
            });
            
            await peerConnection.setRemoteDescription(answerDescription);
            
            console.log('calls.js: Answer processed from:', data.from);
            
            // Clear timeout
            if (callTimeout) {
                clearTimeout(callTimeout);
                callTimeout = null;
            }
            
            // Add participant for group calls
            if (currentCallType === 'group' && data.from) {
                callParticipants.set(data.from, {
                    id: data.from,
                    name: 'Loading...',
                    connected: true
                });
                updateParticipantsUI();
            }
            
        } catch (error) {
            console.error('calls.js: Error handling answer:', error);
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
            console.log('calls.js: ICE candidate added from:', data.from);
        } catch (error) {
            console.error('calls.js: Error adding ICE candidate:', error);
        }
    }
}

// Send signaling message
async function sendSignal(data, targetUserId) {
    if (!targetUserId || !db) {
        console.error('calls.js: Cannot send signal');
        return;
    }
    
    try {
        // Create a unique ID for this signal
        const signalId = `signal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Send to the recipient's signaling channel
        await setDoc(doc(db, 'calls', targetUserId, 'signals', signalId), {
            ...data,
            timestamp: serverTimestamp(),
            processed: false
        });
        
        console.log('calls.js: Signal sent:', data.type, 'to:', targetUserId);
        
    } catch (error) {
        console.error('calls.js: Error sending signal:', error);
    }
}

// Update participants UI for group calls
async function updateParticipantsUI() {
    const participantsContainer = document.getElementById('participantsContainer');
    if (!participantsContainer || currentCallType !== 'group') return;
    
    // Clear container
    participantsContainer.innerHTML = '';
    
    // Update participant names
    for (const [userId, participant] of callParticipants) {
        if (userId !== currentUser.uid) {
            try {
                participant.name = await getUserName(userId);
            } catch (error) {
                console.error('calls.js: Error getting user name:', error);
            }
        }
    }
    
    // Add all participants to UI
    for (const [userId, participant] of callParticipants) {
        const participantElement = document.createElement('div');
        participantElement.className = 'participant';
        participantElement.innerHTML = `
            <div class="participant-avatar ${userId === currentUser.uid ? 'local' : ''}">
                <i class="fas fa-user"></i>
            </div>
            <div class="participant-name">${participant.name}</div>
            <div class="participant-status ${participant.connected ? 'connected' : 'disconnected'}">
                <i class="fas ${participant.connected ? 'fa-microphone' : 'fa-microphone-slash'}"></i>
            </div>
        `;
        participantsContainer.appendChild(participantElement);
    }
    
    // Update count
    const participantCount = document.getElementById('participantCount');
    if (participantCount) {
        participantCount.textContent = `${callParticipants.size} participant${callParticipants.size !== 1 ? 's' : ''}`;
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
            updateCallStatus(`${minutes}:${seconds.toString().padStart(2, '0')}`);
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
        
        // Update local participant status in group calls
        if (currentCallType === 'group') {
            const localParticipant = callParticipants.get(currentUser.uid);
            if (localParticipant) {
                localParticipant.muted = isMuted;
                updateParticipantsUI();
            }
        }
        
        console.log('calls.js: Mute toggled:', isMuted);
    }
}

// End the current call
async function endCall() {
    console.log('calls.js: Ending call');
    
    // Clear timeout
    if (callTimeout) {
        clearTimeout(callTimeout);
        callTimeout = null;
    }
    
    // Stop call timer
    stopCallTimer();
    
    // Send end call signals to all participants
    if (currentCallType === 'personal' && currentCallPartnerId) {
        await sendSignal({
            type: 'end-call',
            from: currentUser.uid,
            callId: activeCallId
        }, currentCallPartnerId);
    } else if (currentCallType === 'group') {
        // Send to all participants except self
        for (const [userId, participant] of callParticipants) {
            if (userId !== currentUser.uid) {
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
    
    // Remove all audio elements
    document.querySelectorAll('[id^="audio_"]').forEach(el => {
        el.pause();
        el.srcObject = null;
        el.remove();
    });
    
    // Clear signaling listeners
    signalingListeners.forEach(unsubscribe => {
        if (unsubscribe) unsubscribe();
    });
    signalingListeners.clear();
    
    // Clear participants
    callParticipants.clear();
    
    // Clear processed signals
    processedSignalIds.clear();
    
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
    
    // Auto-redirect after 2 seconds
    setTimeout(() => {
        goBackToChat();
    }, 2000);
}

// Go back to chat
function goBackToChat() {
    console.log('calls.js: Going back to chat');
    
    if (currentCallType === 'personal' && currentCallPartnerId) {
        window.location.href = 'chat.html?id=' + currentCallPartnerId;
    } else if (currentCallType === 'group' && currentGroupId) {
        window.location.href = 'group.html?id=' + currentGroupId;
    } else {
        window.location.href = 'groups.html';
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
        console.log('calls.js: Notification saved');
        
    } catch (error) {
        console.error('calls.js: Error sending notification:', error);
        throw error;
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

// Export functions
window.callsModule = {
    initiatePersonalCall,
    initiateGroupCall,
    endCall,
    toggleMute
};