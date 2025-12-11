// call.js - Complete Fixed WebRTC Implementation
// Load this file BEFORE app.js - No dependencies on app.js

// Firebase imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged,
    signOut
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
    where
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
let remoteStream = null;
let peerConnection = null;
let isCaller = false;
let currentCallType = null;
let currentCallPartnerId = null;
let currentUser = null;
let db = null;
let auth = null;
let signalingUnsubscribe = null;
let isMuted = false;
let isVideoEnabled = true;
let activeCallId = null;
let callTimeout = null;
let pendingSignals = [];
let callNotificationSound = null;
let callRingtone = null;
let isRinging = false;
let callStartTime = null;
let callDurationInterval = null;
let processedMissedCalls = new Set();
let userCache = new Map();

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    const isCallPage = window.location.pathname.includes('call.html');
    
    // Initialize Firebase independently
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
    
    // Set up independent auth state listener
    onAuthStateChanged(auth, function(user) {
        if (user) {
            currentUser = user;
            
            if (isCallPage) {
                // We're on the call page - handle the call
                handleCallPage();
            } else {
                // We're on the chat page - set up call buttons
                setupCallButtonListeners();
                setupCallNotificationsListener();
                setupMissedCallsListener();
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
        // Silent fail for production
    }
    
    return 'Unknown User';
}

// Set up listener for missed calls with duplicate prevention
function setupMissedCallsListener() {
    if (!currentUser || !db) return;
    
    const callsRef = collection(db, 'calls', currentUser.uid, 'missed');
    
    onSnapshot(callsRef, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
            if (change.type === 'added') {
                const data = change.doc.data();
                const missedCallId = `missed_${data.from}_${data.callId}`;
                
                // Check if we've already processed this missed call
                if (processedMissedCalls.has(missedCallId)) {
                    await deleteDoc(doc(db, 'calls', currentUser.uid, 'missed', change.doc.id));
                    return;
                }
                
                // Only process recent missed calls (last 24 hours)
                const callTime = data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp);
                if (Date.now() - callTime.getTime() > 24 * 60 * 60 * 1000) {
                    await deleteDoc(doc(db, 'calls', currentUser.uid, 'missed', change.doc.id));
                    return;
                }
                
                // Mark as processed immediately to prevent duplicates
                processedMissedCalls.add(missedCallId);
                
                // Add missed call to chat with proper WhatsApp-style formatting
                await addMissedCallToChat(data);
                
                // Mark as processed in database
                await deleteDoc(doc(db, 'calls', currentUser.uid, 'missed', change.doc.id));
            }
        });
    });
}

// Add missed call to chat with WhatsApp-style formatting and correct icons
async function addMissedCallToChat(callData) {
    try {
        // Create a combined ID for the chat thread
        const threadId = [currentUser.uid, callData.from].sort().join('_');
        
        // Get caller name for the message
        const callerName = await getUserName(callData.from);
        
        // Create unique message ID to prevent duplicates
        const messageId = `missed_call_${callData.callId}`;
        
        // Check if this missed call message already exists
        const existingMessagesQuery = query(
            collection(db, 'conversations', threadId, 'messages'),
            orderBy('timestamp', 'desc')
        );
        
        const existingMessages = await getDocs(existingMessagesQuery);
        let messageExists = false;
        
        existingMessages.forEach(doc => {
            const messageData = doc.data();
            if (messageData.callId === callData.callId && messageData.type === 'missed-call') {
                messageExists = true;
            }
        });
        
        if (messageExists) {
            return; // Don't add duplicate message
        }
        
        // Create WhatsApp-style missed call message with correct icons
        const callMessage = {
            type: 'missed-call',
            callType: callData.callType,
            senderId: callData.from,
            senderName: callerName,
            timestamp: serverTimestamp(),
            read: false,
            callId: callData.callId,
            messageId: messageId,
            text: `Missed ${callData.callType} call`,
            isSystemMessage: true,
            isOutgoing: false, // This is an incoming missed call
            displayText: `${callData.callType === 'video' ? '📹' : '📞'} Missed ${callData.callType === 'video' ? 'video' : 'voice'} call`,
            duration: 0,
            status: 'missed',
            metadata: {
                callType: callData.callType,
                isMissedCall: true,
                canCallBack: true
            }
        };
        
        // Add missed call message to chat
        await addDoc(collection(db, 'conversations', threadId, 'messages'), callMessage);
        
        // Update the conversation document
        await setDoc(doc(db, 'conversations', threadId), {
            participants: [currentUser.uid, callData.from],
            lastMessage: {
                text: `Missed ${callData.callType} call`,
                senderId: callData.from,
                senderName: callerName,
                timestamp: serverTimestamp(),
                type: 'missed-call',
                isSystemMessage: true
            },
            updatedAt: serverTimestamp(),
            hasUnreadMessages: true,
            lastActivity: serverTimestamp()
        }, { merge: true });
        
        // Trigger UI update if we're on the chat page
        if (typeof window.updateChatUI === 'function') {
            window.updateChatUI();
        }
        
    } catch (error) {
        // Remove from processed set so it can be retried
        const missedCallId = `missed_${callData.from}_${callData.callId}`;
        processedMissedCalls.delete(missedCallId);
    }
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

// Set up event listeners for call buttons on chat page
function setupCallButtonListeners() {
    const voiceCallBtn = document.getElementById('voiceCallBtn');
    const videoCallBtn = document.getElementById('videoCallBtn');
    
    if (voiceCallBtn) {
        voiceCallBtn.addEventListener('click', () => {
            initiateCall('audio');
        });
    }
    
    if (videoCallBtn) {
        videoCallBtn.addEventListener('click', () => {
            initiateCall('video');
        });
    }
}

// Set up listener for incoming call notifications on chat page
function setupCallNotificationsListener() {
    if (!currentUser || !db) return;
    
    const notificationsRef = collection(db, 'notifications', currentUser.uid, 'calls');
    
    onSnapshot(notificationsRef, (snapshot) => {
        snapshot.docChanges().forEach(async (change)=> {
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

// Show incoming call notification on chat page
async function showIncomingCallNotification(data) {
    // Remove any existing notifications first
    const existingNotifications = document.querySelectorAll('.incoming-call-notification');
    existingNotifications.forEach(notification => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    });
    
    // Get caller name
    const callerName = await getUserName(data.from);
    
    // Play ringtone
    playRingtone();
    
    const notification = document.createElement('div');
    notification.className = 'incoming-call-notification';
    notification.innerHTML = `
        <div class="notification-content">
            <h3>Incoming ${data.callType === 'video' ? 'Video' : 'Voice'} Call</h3>
            <p>${callerName} is calling you</p>
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
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                padding: 25px;
                border-radius: 15px;
                box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
                z-index: 10000;
                max-width: 320px;
                width: 90%;
                text-align: center;
            }
            .notification-content h3 {
                margin: 0 0 10px 0;
                color: #333;
                font-size: 18px;
            }
            .notification-content p {
                margin: 0 0 20px 0;
                color: #666;
                font-size: 14px;
            }
            .notification-buttons {
                display: flex;
                gap: 12px;
                justify-content: center;
            }
            .accept-call, .reject-call {
                padding: 10px 20px;
                border: none;
                border-radius: 25px;
                cursor: pointer;
                font-weight: bold;
                font-size: 14px;
                transition: all 0.2s;
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
            
            // Send call-accepted signal instead of call-rejected
            sendSignal({
                type: 'call-accepted',
                from: currentUser.uid,
                callId: data.callId
            }, data.from);
            
            // Redirect to call page
            window.location.href = `call.html?type=${data.callType}&partnerId=${data.from}&incoming=true&callId=${data.callId}`;
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
            
            // Add missed call to database
            addMissedCall(data.from, data.callType, data.callId);
            
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
            
            // Add missed call to database
            addMissedCall(data.from, data.callType, data.callId);
            
            notification.parentNode.removeChild(notification);
        }
    }, 30000);
}

// Add missed call to database
async function addMissedCall(from, callType, callId) {
    try {
        const missedCallId = `missed_${Date.now()}`;
        await setDoc(doc(db, 'calls', from, 'missed', missedCallId), {
            from: currentUser.uid,
            callType: callType,
            callId: callId,
            timestamp: serverTimestamp()
        });
    } catch (error) {
        // Silent fail for production
    }
}

// Handle the call page - this runs when call.html loads
async function handleCallPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const callType = urlParams.get('type');
    const partnerId = urlParams.get('partnerId');
    const isIncoming = urlParams.get('incoming') === 'true';
    const callId = urlParams.get('callId');
    
    if (!callType || !partnerId) {
        showError('Invalid call parameters');
        return;
    }
    
    currentCallType = callType;
    currentCallPartnerId = partnerId;
    isCaller = !isIncoming;
    activeCallId = callId || `${currentUser.uid}_${partnerId}_${Date.now()}`;
    
    // Store partner ID in session storage for cleanup
    sessionStorage.setItem('currentCallPartnerId', partnerId);
    sessionStorage.setItem('currentCallType', callType);
    sessionStorage.setItem('activeCallId', activeCallId);
    
    // Update UI with caller name
    try {
        const partnerName = await getUserName(partnerId);
        const callerNameElement = document.getElementById('callerName');
        if (callerNameElement) {
            callerNameElement.textContent = partnerName;
        }
        
        // Also update the page title
        document.title = `${partnerName} - ${callType === 'video' ? 'Video' : 'Voice'} Call`;
    } catch (error) {
        // Silent fail for production
    }
    
    // Set up event listeners for call controls
    const muteBtn = document.getElementById('muteBtn');
    const videoBtn = document.getElementById('videoBtn');
    const endCallBtn = document.getElementById('endCallBtn');
    const backToChatBtn = document.getElementById('backToChat');
    
    if (muteBtn) muteBtn.addEventListener('click', toggleMute);
    if (videoBtn) videoBtn.addEventListener('click', toggleVideo);
    if (endCallBtn) endCallBtn.addEventListener('click', endCall);
    if (backToChatBtn) backToChatBtn.addEventListener('click', goBackToChat);
    
    // Set up signaling listener FIRST
    setupSignalingListener();
    
    // Start the call process
    if (isCaller) {
        // We are the caller - initiate the call
        startCall();
    } else {
        // We are the receiver - wait for offer
        setupMediaForReceiver();
    }
}

// Setup media for receiver (without starting stream immediately)
async function setupMediaForReceiver() {
    showLoader('Preparing for call...');
    
    // Create peer connection first to handle incoming offers
    createPeerConnection();
}

// Initiate a call from chat page - redirect to call.html
function initiateCall(type) {
    const urlParams = new URLSearchParams(window.location.search);
    const partnerId = urlParams.get('id');
    
    if (!partnerId) {
        showNotification('Cannot start call. No chat partner found.', 'error');
        return;
    }
    
    // Generate a unique call ID
    const callId = `${currentUser.uid}_${partnerId}_${Date.now()}`;
    
    // Send a notification to the partner first
    sendCallNotification(partnerId, type, callId).then(() => {
        // Redirect to call page with call parameters
        window.location.href = `call.html?type=${type}&partnerId=${partnerId}&incoming=false&callId=${callId}`;
    }).catch(error => {
        showNotification('Failed to initiate call. Please try again.', 'error');
    });
}

// Send call notification to partner - FIXED VERSION
async function sendCallNotification(partnerId, callType, callId) {
    try {
        // Get current user's name for the notification
        const fromName = await getUserName(currentUser.uid);
        
        // Create a unique ID for this notification
        const notificationId = `call_${Date.now()}`;
        
        await setDoc(doc(db, 'notifications', partnerId, 'calls', notificationId), {
            type: 'call',
            callType: callType,
            from: currentUser.uid,
            fromName: fromName,
            timestamp: serverTimestamp(),
            status: 'ringing',
            notificationId: notificationId,
            callId: callId
        });
        
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
                video: currentCallType === 'video' ? {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    frameRate: { ideal: 30 }
                } : false,
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 44100,
                    channelCount: 1
                }
            });
        } catch (error) {
            if (error.name === 'NotAllowedError') {
                showError('Camera/microphone access denied. Please check your permissions.');
            } else if (error.name === 'NotFoundError') {
                showError('No camera/microphone found.');
            } else {
                showError('Failed to access camera/microphone: ' + error.message);
            }
            return;
        }
        
        // Display local video if it's a video call
        const localVideo = document.getElementById('localVideo');
        if (localVideo) {
            if (currentCallType === 'video') {
                localVideo.srcObject = localStream;
                localVideo.muted = true;
                localVideo.play().catch(() => {});
            } else {
                localVideo.style.display = 'none';
            }
        }
        
        // Create peer connection
        createPeerConnection();
        
        // Add local stream to peer connection
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
        
        // Process any pending signals that arrived before peerConnection was ready
        processPendingSignals();
        
        // Create and send offer
        try {
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            
            // Send offer to the other user via Firestore
            await sendSignal({
                type: 'offer',
                offer: offer,
                callType: currentCallType,
                from: currentUser.uid,
                callId: activeCallId
            });
            
            updateCallStatus('Ringing...');
            hideLoader();
            
            // Set timeout to end call if no answer
            callTimeout = setTimeout(() => {
                if (peerConnection && peerConnection.connectionState !== 'connected') {
                    // Add missed call to database
                    addMissedCall(currentCallPartnerId, currentCallType, activeCallId);
                    
                    // Add call history to chat
                    addCallHistoryToChat('call-ended', 0, currentCallPartnerId, currentCallType, activeCallId);
                    
                    showError('No answer from user');
                    setTimeout(goBackToChat, 2000);
                }
            }, 30000); // 30 second timeout
            
        } catch (error) {
            showError('Failed to start call: ' + error.message);
        }
        
    } catch (error) {
        showError('Failed to start call. Please check your permissions.');
    }
}

// Process any signals that arrived before peerConnection was ready
function processPendingSignals() {
    while (pendingSignals.length > 0) {
        const signal = pendingSignals.shift();
        handleSignalingMessage(signal);
    }
}

// Set up signaling listener
function setupSignalingListener() {
    if (!currentUser || !db) {
        return;
    }
    
    // Listen for incoming signals
    const signalingRef = collection(db, 'calls', currentUser.uid, 'signals');
    
    signalingUnsubscribe = onSnapshot(signalingRef, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
            if (change.type === 'added') {
                const data = change.doc.data();
                
                // Skip if already processed
                if (data.processed) {
                    return;
                }
                
                // Only process signals for the current active call
                if (data.callId && data.callId !== activeCallId) {
                    return;
                }
                
                // If peerConnection isn't ready yet, store the signal for later processing
                if (!peerConnection) {
                    pendingSignals.push(data);
                    return;
                }
                
                await handleSignalingMessage(data);
                
                // Mark the signal as processed
                try {
                    await setDoc(doc(db, 'calls', currentUser.uid, 'signals', change.doc.id), {
                        processed: true
                    }, { merge: true });
                } catch (error) {
                    // Silent fail for production
                }
            }
        });
    }, (error) => {
        // Silent fail for production
    });
}

// Handle incoming signaling messages - FIXED VERSION
async function handleSignalingMessage(data) {
    try {
        // Check if peerConnection is ready
        if (!peerConnection) {
            pendingSignals.push(data);
            return;
        }
        
        switch (data.type) {
            case 'offer':
                // Incoming call offer - only process if we're on call.html as receiver
                if (window.location.pathname.includes('call.html') && !isCaller) {
                    // Clear any existing timeout
                    if (callTimeout) {
                        clearTimeout(callTimeout);
                        callTimeout = null;
                    }
                    
                    // Get local media stream for the receiver
                    if (!localStream) {
                        await setupReceiverMediaStream();
                    }
                    
                    const offer = data.offer;
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
                    
                    // Create and send answer
                    const answer = await peerConnection.createAnswer();
                    await peerConnection.setLocalDescription(answer);
                    
                    await sendSignal({
                        type: 'answer',
                        answer: answer,
                        from: currentUser.uid,
                        callId: data.callId
                    });
                    
                    hideLoader();
                    updateCallStatus('Connected');
                    startCallTimer();
                }
                break;
                
            case 'answer':
                // Call answered - only process if we're the caller
                if (peerConnection && isCaller) {
                    // Clear the call timeout
                    if (callTimeout) {
                        clearTimeout(callTimeout);
                        callTimeout = null;
                    }
                    
                    const answer = data.answer;
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
                    
                    hideLoader();
                    updateCallStatus('Connected');
                    startCallTimer();
                }
                break;
                
            case 'ice-candidate':
                // ICE candidate received
                if (peerConnection && data.candidate) {
                    try {
                        const iceCandidate = new RTCIceCandidate(data.candidate);
                        await peerConnection.addIceCandidate(iceCandidate);
                    } catch (error) {
                        // Silent fail for production
                    }
                }
                break;
                
            case 'call-accepted':
                // Call was accepted by receiver
                if (isCaller) {
                    hideLoader();
                    updateCallStatus('Connecting...');
                }
                break;
                
            case 'call-rejected':
                // Call was rejected by receiver
                if (isCaller) {
                    // Add missed call to database
                    addMissedCall(currentCallPartnerId, currentCallType, activeCallId);
                    
                    showError('Call was rejected.');
                    setTimeout(goBackToChat, 2000);
                }
                break;
                
            case 'call-timeout':
                // Call timed out
                if (isCaller) {
                    showError('Call timed out.');
                    setTimeout(goBackToChat, 2000);
                }
                break;
                
            case 'end-call':
                // Call ended by remote party
                showCallEnded();
                break;
        }
    } catch (error) {
        showNotification('Error handling call request: ' + error.message, 'error');
    }
}

// Setup media stream for receiver when they accept the call
async function setupReceiverMediaStream() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            video: currentCallType === 'video' ? {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30 }
            } : false,
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                sampleRate: 44100,
                channelCount: 1
            }
        });
        
        // Display local video if it's a video call
        const localVideo = document.getElementById('localVideo');
        if (localVideo) {
            if (currentCallType === 'video') {
                localVideo.srcObject = localStream;
                localVideo.muted = true;
                localVideo.play().catch(() => {});
            } else {
                localVideo.style.display = 'none';
            }
        }
        
        // Add local stream to peer connection
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
        
    } catch (error) {
        showError('Failed to access camera/microphone: ' + error.message);
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
    
    // Calculate final call duration
    if (callStartTime) {
        const endTime = new Date();
        const duration = Math.floor((endTime - callStartTime) / 1000);
        callStartTime = null;
        return duration;
    }
    
    return 0;
}

// Create peer connection
function createPeerConnection() {
    try {
        peerConnection = new RTCPeerConnection(rtcConfiguration);
        
        // Handle remote stream
        peerConnection.ontrack = (event) => {
            if (event.streams && event.streams[0]) {
                remoteStream = event.streams[0];
                const remoteVideo = document.getElementById('remoteVideo');
                if (remoteVideo) {
                    remoteVideo.srcObject = remoteStream;
                    remoteVideo.muted = false;
                    remoteVideo.play().catch(() => {});
                }
                hideLoader();
                updateCallStatus('Connected');
                startCallTimer();
            }
        };
        
        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                const candidateData = {
                    candidate: event.candidate.candidate,
                    sdpMid: event.candidate.sdpMid,
                    sdpMLineIndex: event.candidate.sdpMLineIndex,
                    usernameFragment: event.candidate.usernameFragment
                };
                
                sendSignal({
                    type: 'ice-candidate',
                    candidate: candidateData,
                    from: currentUser.uid,
                    callId: activeCallId
                });
            }
        };
        
        // Handle connection state changes
        peerConnection.onconnectionstatechange = () => {
            if (peerConnection.connectionState === 'connected') {
                hideLoader();
                updateCallStatus('Connected');
                startCallTimer();
            } else if (peerConnection.connectionState === 'disconnected' || 
                       peerConnection.connectionState === 'failed') {
                showCallEnded();
            }
        };
        
    } catch (error) {
        showError("Failed to create peer connection: " + error.message);
    }
}

// Send signaling message
async function sendSignal(data, targetUserId = null) {
    const targetId = targetUserId || currentCallPartnerId;
    
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
        // Silent fail for production
    }
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
            muteBtn.innerHTML = isMuted ? '<i class="fas fa-microphone-slash"></i>' : '<i class="fas fa-microphone"></i>';
        }
    }
}

// Toggle video
function toggleVideo() {
    if (!localStream) return;
    
    const videoTracks = localStream.getVideoTracks();
    if (videoTracks.length > 0) {
        isVideoEnabled = !isVideoEnabled;
        videoTracks[0].enabled = isVideoEnabled;
        
        const videoBtn = document.getElementById('videoBtn');
        if (videoBtn) {
            videoBtn.classList.toggle('active', !isVideoEnabled);
        }
        
        // Show/hide local video based on state
        const localVideo = document.getElementById('localVideo');
        if (localVideo) {
            localVideo.style.display = isVideoEnabled ? 'block' : 'none';
        }
    }
}

// End the current call
async function endCall() {
    try {
        // Get partner ID from session storage if currentCallPartnerId is null
        const partnerId = currentCallPartnerId || sessionStorage.getItem('currentCallPartnerId');
        const callType = currentCallType || sessionStorage.getItem('currentCallType');
        const callId = activeCallId || sessionStorage.getItem('activeCallId');
        
        if (!partnerId) {
            cleanupCallResources();
            return;
        }
        
        // Clear any timeout
        if (callTimeout) {
            clearTimeout(callTimeout);
            callTimeout = null;
        }
        
        // Stop call timer and get duration
        const callDuration = stopCallTimer();
        
        // Stop ringtone if playing
        stopRingtone();
        
        // Send end call signal
        if (partnerId) {
            await sendSignal({
                type: 'end-call',
                from: currentUser.uid,
                callId: callId,
                duration: callDuration
            }, partnerId);
        }
        
        // Add call history to chat
        if (partnerId && callType) {
            await addCallHistoryToChat('call-ended', callDuration, partnerId, callType, callId);
        }
        
        cleanupCallResources();
        showCallEnded();
        
    } catch (error) {
        cleanupCallResources();
    }
}

// Clean up call resources
function cleanupCallResources() {
    // Close peer connection
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    
    // Stop local stream
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    // Clear session storage
    sessionStorage.removeItem('currentCallPartnerId');
    sessionStorage.removeItem('currentCallType');
    sessionStorage.removeItem('activeCallId');
    
    // Clear global variables
    currentCallPartnerId = null;
    currentCallType = null;
    activeCallId = null;
}

// Add call history to chat with WhatsApp-style formatting and correct icons
async function addCallHistoryToChat(callType, duration = null, partnerId = null, callTypeValue = null, callId = null) {
    try {
        const targetPartnerId = partnerId || currentCallPartnerId;
        const targetCallType = callTypeValue || currentCallType;
        const targetCallId = callId || activeCallId;
        
        if (!targetPartnerId || !targetCallType) {
            return;
        }
        
        const threadId = [currentUser.uid, targetPartnerId].sort().join('_');
        
        // Check for existing call history to prevent duplicates
        const existingMessagesQuery = query(
            collection(db, 'conversations', threadId, 'messages'),
            orderBy('timestamp', 'desc')
        );
        
        const existingMessages = await getDocs(existingMessagesQuery);
        let messageExists = false;
        
        existingMessages.forEach(doc => {
            const messageData = doc.data();
            if (messageData.callId === targetCallId) {
                messageExists = true;
            }
        });
        
        if (messageExists) {
            return;
        }
        
        // Get partner name for the message
        const partnerName = await getUserName(targetPartnerId);
        
        // Determine the message content based on call type and duration
        let messageText = '';
        let displayText = '';
        let isOutgoing = isCaller;
        let icon = targetCallType === 'video' ? '📹' : '📞';
        
        if (callType === 'missed-call') {
            // This is a missed call from someone else
            isOutgoing = false;
            messageText = `Missed ${targetCallType} call`;
            displayText = `${icon} Missed ${targetCallType === 'video' ? 'video' : 'voice'} call`;
        } else if (callType === 'call-ended') {
            if (duration && duration > 0) {
                // Successful call with duration
                const durationText = formatCallDurationForMessage(duration);
                messageText = `${targetCallType === 'video' ? 'Video' : 'Voice'} call • ${durationText}`;
                displayText = `${icon} ${targetCallType === 'video' ? 'Video' : 'Voice'} call • ${durationText}`;
            } else {
                // Call ended without connection (no answer)
                messageText = `${targetCallType === 'video' ? 'Video' : 'Voice'} call`;
                displayText = `${icon} ${targetCallType === 'video' ? 'Video' : 'Voice'} call`;
            }
        }
        
        // Add call history message to chat with WhatsApp-style formatting
        await addDoc(collection(db, 'conversations', threadId, 'messages'), {
            type: callType,
            callType: targetCallType,
            senderId: currentUser.uid,
            senderName: await getUserName(currentUser.uid),
            timestamp: serverTimestamp(),
            read: false,
            callId: targetCallId,
            duration: duration,
            text: messageText,
            displayText: displayText,
            isSystemMessage: true,
            isOutgoing: isOutgoing,
            icon: icon,
            metadata: {
                callType: targetCallType,
                duration: duration,
                isMissedCall: callType === 'missed-call',
                canCallBack: true
            }
        });
        
        // Update conversation
        await setDoc(doc(db, 'conversations', threadId), {
            participants: [currentUser.uid, targetPartnerId],
            lastMessage: {
                text: messageText,
                senderId: currentUser.uid,
                senderName: await getUserName(currentUser.uid),
                timestamp: serverTimestamp(),
                type: callType,
                isSystemMessage: true,
                icon: icon
            },
            updatedAt: serverTimestamp(),
            lastActivity: serverTimestamp()
        }, { merge: true });
        
        // Trigger UI update if we're on the chat page
        if (typeof window.updateChatUI === 'function') {
            window.updateChatUI();
        }
        
    } catch (error) {
        // Silent fail for production
    }
}

// Format call duration for message display (WhatsApp-style)
function formatCallDurationForMessage(seconds) {
    if (!seconds || seconds === 0) return 'No answer';
    
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    
    if (mins === 0) {
        return `${secs} sec`;
    }
    if (secs === 0) {
        return `${mins} min`;
    }
    return `${mins} min ${secs} sec`;
}

// Show call ended screen
function showCallEnded() {
    const callEndedElement = document.getElementById('callEnded');
    const remoteVideoElement = document.getElementById('remoteVideo');
    const localVideoElement = document.getElementById('localVideo');
    
    if (callEndedElement) callEndedElement.style.display = 'flex';
    if (remoteVideoElement) remoteVideoElement.style.display = 'none';
    if (localVideoElement) localVideoElement.style.display = 'none';
    
    // Auto-redirect to chat page after 2 seconds
    setTimeout(() => {
        goBackToChat();
    }, 2000);
}

// Go back to chat
function goBackToChat() {
    const partnerId = currentCallPartnerId || sessionStorage.getItem('currentCallPartnerId');
    
    // Clear session storage
    sessionStorage.removeItem('currentCallPartnerId');
    sessionStorage.removeItem('currentCallType');
    sessionStorage.removeItem('activeCallId');
    
    if (partnerId) {
        window.location.href = 'chat.html?id=' + partnerId;
    } else {
        window.location.href = 'chat.html';
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
        loader.style.display = 'block';
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
    // Create independent notification system
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
    if (peerConnection || localStream) {
        endCall();
    }
    if (signalingUnsubscribe) {
        signalingUnsubscribe();
    }
});

// Make callBack function available globally
window.callBack = function(partnerId, callType) {
    if (!partnerId || !callType) {
        return;
    }
    
    // Generate a unique call ID
    const callId = `${currentUser.uid}_${partnerId}_${Date.now()}`;
    
    // Send a notification to the partner first
    sendCallNotification(partnerId, callType, callId).then(() => {
        // Redirect to call page with call parameters
        window.location.href = `call.html?type=${callType}&partnerId=${partnerId}&incoming=false&callId=${callId}`;
    }).catch(error => {
        showNotification('Failed to initiate call. Please try again.', 'error');
    });
};

// Export functions for use in other files
window.callModule = {
    initiateCall,
    endCall,
    toggleMute,
    toggleVideo,
    getUserName,
    callBack: window.callBack
};