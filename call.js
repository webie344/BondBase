// call.js - Independent WebRTC implementation for voice and video calls
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
    getDocs
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

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log("=== INDEPENDENT CALL.JS LOADED ===");
    
    const isCallPage = window.location.pathname.includes('call.html');
    console.log("Is call page:", isCallPage);
    
    // Initialize Firebase independently
    try {
        const app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        console.log("Firebase initialized successfully in call.js");
        
        // Preload notification sounds
        preloadNotificationSounds();
    } catch (error) {
        console.error("Firebase initialization error:", error);
        showNotification('Firebase initialization failed. Please refresh the page.', 'error');
        return;
    }
    
    // Set up independent auth state listener
    onAuthStateChanged(auth, function(user) {
        if (user) {
            currentUser = user;
            console.log("User authenticated in call.js:", user.uid);
            
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
            console.log("User not authenticated in call.js");
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
        console.error("Error preloading sounds:", error);
    }
}

// Set up listener for missed calls
function setupMissedCallsListener() {
    if (!currentUser || !db) return;
    
    console.log("Setting up missed calls listener");
    
    const callsRef = collection(db, 'calls', currentUser.uid, 'missed');
    
    onSnapshot(callsRef, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
            if (change.type === 'added') {
                const data = change.doc.data();
                console.log("New missed call:", data);
                
                // Only process recent missed calls (last 24 hours)
                const callTime = data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp);
                if (Date.now() - callTime.getTime() > 24 * 60 * 60 * 1000) {
                    console.log("Missed call too old, skipping");
                    await deleteDoc(doc(db, 'calls', currentUser.uid, 'missed', change.doc.id));
                    return;
                }
                
                // Add missed call to chat with proper WhatsApp-style formatting
                await addMissedCallToChat(data);
                
                // Mark as processed
                await deleteDoc(doc(db, 'calls', currentUser.uid, 'missed', change.doc.id));
            }
        });
    });
}

// Add missed call to chat with WhatsApp-style formatting
async function addMissedCallToChat(callData) {
    try {
        // Create a combined ID for the chat thread
        const threadId = [currentUser.uid, callData.from].sort().join('_');
        
        // Get caller name for the message
        let callerName = 'Unknown';
        try {
            const callerDoc = await getDoc(doc(db, 'users', callData.from));
            if (callerDoc.exists()) {
                callerName = callerDoc.data().name || callerName;
            }
        } catch (error) {
            console.error("Error getting caller name:", error);
        }
        
        // Create WhatsApp-style missed call message
        const callMessage = {
            type: 'missed-call',
            callType: callData.callType,
            senderId: callData.from,
            senderName: callerName,
            timestamp: serverTimestamp(),
            read: false,
            callId: callData.callId,
            text: `Missed ${callData.callType} call`,
            isSystemMessage: true,
            displayText: `📞 Missed ${callData.callType === 'video' ? 'video' : 'voice'} call • Tap to call back`
        };
        
        // Add missed call message to chat
        await addDoc(collection(db, 'conversations', threadId, 'messages'), callMessage);
        
        // Update the conversation document
        await setDoc(doc(db, 'conversations', threadId), {
            participants: [currentUser.uid, callData.from],
            lastMessage: {
                text: `Missed ${callData.callType} call`,
                senderId: callData.from,
                timestamp: serverTimestamp(),
                type: 'missed-call'
            },
            updatedAt: serverTimestamp()
        }, { merge: true });
        
        console.log("WhatsApp-style missed call added to chat");
        
    } catch (error) {
        console.error("Error adding missed call to chat:", error);
    }
}

// Play notification sound
function playNotificationSound() {
    if (callNotificationSound) {
        try {
            callNotificationSound.currentTime = 0;
            callNotificationSound.play().catch(error => {
                console.log("Notification sound play failed:", error);
            });
        } catch (error) {
            console.error("Error playing notification sound:", error);
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
            callRingtone.play().catch(error => {
                console.log("Ringtone play failed:", error);
            });
        } catch (error) {
            console.error("Error playing ringtone:", error);
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
            console.error("Error stopping ringtone:", error);
        }
    }
}

// Set up event listeners for call buttons on chat page
function setupCallButtonListeners() {
    console.log("Setting up call button listeners");
    
    const voiceCallBtn = document.getElementById('voiceCallBtn');
    const videoCallBtn = document.getElementById('videoCallBtn');
    
    if (voiceCallBtn) {
        voiceCallBtn.addEventListener('click', () => {
            console.log("Voice call button clicked");
            initiateCall('audio');
        });
    } else {
        console.warn("Voice call button not found");
    }
    
    if (videoCallBtn) {
        videoCallBtn.addEventListener('click', () => {
            console.log("Video call button clicked");
            initiateCall('video');
        });
    } else {
        console.warn("Video call button not found");
    }
}

// Set up listener for incoming call notifications on chat page
function setupCallNotificationsListener() {
    if (!currentUser || !db) return;
    
    console.log("Setting up call notifications listener");
    
    const notificationsRef = collection(db, 'notifications', currentUser.uid, 'calls');
    
    onSnapshot(notificationsRef, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
            if (change.type === 'added') {
                const data = change.doc.data();
                console.log("New call notification:", data);
                
                // Only process recent notifications (last 30 seconds)
                const notificationTime = data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp);
                if (Date.now() - notificationTime.getTime() > 30000) {
                    console.log("Notification too old, skipping");
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
function showIncomingCallNotification(data) {
    console.log("Showing incoming call notification");
    
    // Remove any existing notifications first
    const existingNotifications = document.querySelectorAll('.incoming-call-notification');
    existingNotifications.forEach(notification => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    });
    
    // Play ringtone
    playRingtone();
    
    const notification = document.createElement('div');
    notification.className = 'incoming-call-notification';
    notification.innerHTML = `
        <div class="notification-content">
            <h3>Incoming ${data.callType === 'video' ? 'Video' : 'Voice'} Call</h3>
            <p>${data.fromName || 'Someone'} is calling you</p>
            <div class="notification-buttons">
                <button id="acceptIncomingCall" class="accept-call">
                    <i class="fas fa-phone"></i> Accept
                </button>
                <button id="rejectIncomingCall" class="reject-call">
                    <i class="fas fa-phone-slash"></i> Reject
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
                from: currentUser.uid
            }, data.from);
            
            // Add missed call to database
            addMissedCall(data.from, data.callType, data.callId);
            
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        });
    }
    
    // Auto remove after 30 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            // Stop ringtone
            stopRingtone();
            
            // Add missed call to database
            addMissedCall(data.from, data.callType, data.callId);
            
            notification.parentNode.removeChild(notification);
        }
    }, 30000);
}

// Add missed call to database
async function addMissedCall(from, callType, callId) {
    try {
        await setDoc(doc(db, 'calls', from, 'missed', `missed_${Date.now()}`), {
            from: currentUser.uid,
            callType: callType,
            callId: callId,
            timestamp: serverTimestamp()
        });
    } catch (error) {
        console.error("Error adding missed call:", error);
    }
}

// Handle the call page - this runs when call.html loads
async function handleCallPage() {
    console.log("=== HANDLING CALL PAGE ===");
    
    const urlParams = new URLSearchParams(window.location.search);
    const callType = urlParams.get('type');
    const partnerId = urlParams.get('partnerId');
    const isIncoming = urlParams.get('incoming') === 'true';
    const callId = urlParams.get('callId');
    
    console.log("Call page parameters:", { callType, partnerId, isIncoming, callId });
    
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
        const partnerDoc = await getDoc(doc(db, 'users', partnerId));
        if (partnerDoc.exists()) {
            const partnerName = partnerDoc.data().name || 'Unknown';
            const callerNameElement = document.getElementById('callerName');
            if (callerNameElement) {
                callerNameElement.textContent = partnerName;
            }
            
            // Also update the page title
            document.title = `${partnerName} - ${callType === 'video' ? 'Video' : 'Voice'} Call`;
        }
    } catch (error) {
        console.error('Error getting partner info:', error);
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
        console.log("Starting call as caller");
        startCall();
    } else {
        // We are the receiver - wait for offer
        console.log("Waiting for call as receiver");
        waitForOffer();
    }
}

// Initiate a call from chat page - redirect to call.html
function initiateCall(type) {
    console.log("Initiating call of type:", type);
    
    const urlParams = new URLSearchParams(window.location.search);
    const partnerId = urlParams.get('id');
    
    if (!partnerId) {
        showNotification('Cannot start call. No chat partner found.', 'error');
        return;
    }
    
    console.log("Calling partner:", partnerId);
    
    // Generate a unique call ID
    const callId = `${currentUser.uid}_${partnerId}_${Date.now()}`;
    
    // Send a notification to the partner first
    sendCallNotification(partnerId, type, callId).then(() => {
        // Redirect to call page with call parameters
        window.location.href = `call.html?type=${type}&partnerId=${partnerId}&incoming=false&callId=${callId}`;
    }).catch(error => {
        console.error('Error sending call notification:', error);
        showNotification('Failed to initiate call. Please try again.', 'error');
    });
}

// Send call notification to partner
async function sendCallNotification(partnerId, callType, callId) {
    try {
        console.log("Sending call notification to:", partnerId);
        
        // Get current user's name for the notification
        let fromName = 'Someone';
        try {
            const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
            if (userDoc.exists()) {
                fromName = userDoc.data().name || fromName;
            }
        } catch (error) {
            console.error("Error getting user name:", error);
        }
        
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
        
        console.log("Call notification sent successfully");
    } catch (error) {
        console.error('Error sending call notification:', error);
        throw error;
    }
}

// Start a call (caller side)
async function startCall() {
    try {
        showLoader('Starting call...');
        
        // Get local media stream
        console.log("Requesting media stream...");
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
            console.log("Media stream obtained");
        } catch (error) {
            console.error("Error accessing media devices:", error);
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
        console.log("Creating offer...");
        try {
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            console.log("Offer created and local description set");
            
            // Send offer to the other user via Firestore
            console.log("Sending offer to:", currentCallPartnerId);
            await sendSignal({
                type: 'offer',
                offer: offer,
                callType: currentCallType,
                from: currentUser.uid,
                callId: activeCallId
            });
            
            updateCallStatus('Ringing');
            hideLoader();
            
            // Set timeout to end call if no answer
            callTimeout = setTimeout(() => {
                if (peerConnection && peerConnection.connectionState !== 'connected') {
                    console.log("Call timeout - no answer");
                    
                    // Add missed call to database
                    addMissedCall(currentCallPartnerId, currentCallType, activeCallId);
                    
                    // Add call history to chat
                    addCallHistoryToChat('call-ended', 0, currentCallPartnerId, currentCallType, activeCallId);
                    
                    showError('No answer from user');
                    setTimeout(goBackToChat, 2000);
                }
            }, 30000); // 30 second timeout
            
        } catch (error) {
            console.error('Error creating/sending offer:', error);
            showError('Failed to start call: ' + error.message);
        }
        
    } catch (error) {
        console.error('Error starting call:', error);
        showError('Failed to start call. Please check your permissions.');
    }
}

// Wait for offer (receiver side)
async function waitForOffer() {
    showLoader('Waiting for call...');
    
    // Get local media stream
    try {
        console.log("Preparing media stream for call...");
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
        console.log("Media stream prepared");
        
        // Display local video if it's a video call
        const localVideo = document.getElementById('localVideo');
        if (localVideo) {
            if (currentCallType === 'video') {
                localVideo.srcObject = localStream;
                localVideo.muted = true;
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
        
        console.log("Ready to receive call offer");
        
    } catch (error) {
        console.error('Error preparing for call:', error);
        if (error.name === 'NotAllowedError') {
            showError('Camera/microphone access denied. Please check your permissions.');
        } else if (error.name === 'NotFoundError') {
            showError('No camera/microphone found.');
        } else {
            showError('Failed to access camera/microphone: ' + error.message);
        }
    }
}

// Process any signals that arrived before peerConnection was ready
function processPendingSignals() {
    console.log("Processing", pendingSignals.length, "pending signals");
    while (pendingSignals.length > 0) {
        const signal = pendingSignals.shift();
        handleSignalingMessage(signal);
    }
}

// Set up signaling listener
function setupSignalingListener() {
    if (!currentUser || !db) {
        console.error("Cannot setup signaling: user or db not available");
        return;
    }
    
    console.log("Setting up signaling listener for user:", currentUser.uid);
    
    // Listen for incoming signals
    const signalingRef = collection(db, 'calls', currentUser.uid, 'signals');
    
    signalingUnsubscribe = onSnapshot(signalingRef, (snapshot) => {
        console.log("Signaling snapshot received:", snapshot.docChanges().length, "changes");
        
        snapshot.docChanges().forEach(async (change) => {
            if (change.type === 'added') {
                const data = change.doc.data();
                console.log("New signaling message:", data.type, "from:", data.from);
                
                // Skip if already processed
                if (data.processed) {
                    console.log("Signal already processed, skipping");
                    return;
                }
                
                // Only process signals for the current active call
                if (data.callId && data.callId !== activeCallId) {
                    console.log("Signal for different call, ignoring");
                    return;
                }
                
                // If peerConnection isn't ready yet, store the signal for later processing
                if (!peerConnection) {
                    console.log("Peer connection not ready, storing signal for later");
                    pendingSignals.push(data);
                    return;
                }
                
                await handleSignalingMessage(data);
                
                // Mark the signal as processed
                try {
                    await setDoc(doc(db, 'calls', currentUser.uid, 'signals', change.doc.id), {
                        processed: true
                    }, { merge: true });
                    console.log("Signal marked as processed");
                } catch (error) {
                    console.error("Error marking signal as processed:", error);
                }
            }
        });
    }, (error) => {
        console.error("Error in signaling listener:", error);
    });
}

// Handle incoming signaling messages
async function handleSignalingMessage(data) {
    try {
        console.log("Handling signaling message type:", data.type);
        
        // Check if peerConnection is ready
        if (!peerConnection) {
            console.error("Peer connection not ready, cannot handle signal");
            return;
        }
        
        switch (data.type) {
            case 'offer':
                // Incoming call offer - only process if we're on call.html as receiver
                if (window.location.pathname.includes('call.html') && !isCaller) {
                    console.log("Processing offer from caller");
                    
                    // Clear any existing timeout
                    if (callTimeout) {
                        clearTimeout(callTimeout);
                        callTimeout = null;
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
                    console.log("Call answered successfully");
                }
                break;
                
            case 'answer':
                // Call answered
                if (peerConnection && isCaller) {
                    console.log("Processing answer from receiver");
                    
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
                    console.log("Call connected successfully");
                }
                break;
                
            case 'ice-candidate':
                // ICE candidate received
                if (peerConnection && data.candidate) {
                    console.log("Adding ICE candidate");
                    try {
                        const iceCandidate = new RTCIceCandidate(data.candidate);
                        await peerConnection.addIceCandidate(iceCandidate);
                    } catch (error) {
                        console.error("Error adding ICE candidate:", error);
                    }
                }
                break;
                
            case 'call-rejected':
                // Call was rejected
                console.log("Call was rejected by remote party");
                
                // Add missed call to database
                addMissedCall(currentCallPartnerId, currentCallType, activeCallId);
                
                showError('Call was rejected.');
                setTimeout(goBackToChat, 2000);
                break;
                
            case 'end-call':
                // Call ended by remote party
                console.log("Call ended by remote party");
                showCallEnded();
                break;
                
            default:
                console.log("Unknown signaling message type:", data.type);
        }
    } catch (error) {
        console.error("Error handling signaling message:", error);
        showNotification('Error handling call request: ' + error.message, 'error');
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
    console.log("Creating peer connection...");
    try {
        peerConnection = new RTCPeerConnection(rtcConfiguration);
        
        // Handle remote stream
        peerConnection.ontrack = (event) => {
            console.log("Remote track received");
            if (event.streams && event.streams[0]) {
                remoteStream = event.streams[0];
                const remoteVideo = document.getElementById('remoteVideo');
                if (remoteVideo) {
                    remoteVideo.srcObject = remoteStream;
                    remoteVideo.muted = false;
                    remoteVideo.play().catch(error => {
                        console.error("Error playing remote video:", error);
                    });
                }
                hideLoader();
                updateCallStatus('Connected');
            }
        };
        
        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log("ICE candidate generated, sending to peer");
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
            } else {
                console.log("All ICE candidates have been sent");
            }
        };
        
        // Handle connection state changes
        peerConnection.onconnectionstatechange = () => {
            console.log("Connection state changed:", peerConnection.connectionState);
            if (peerConnection.connectionState === 'connected') {
                hideLoader();
                updateCallStatus('Connected');
                startCallTimer();
            } else if (peerConnection.connectionState === 'disconnected' || 
                       peerConnection.connectionState === 'failed') {
                console.log("Call disconnected or failed");
                showCallEnded();
            }
        };
        
        console.log("Peer connection created");
    } catch (error) {
        console.error("Error creating peer connection:", error);
        showError("Failed to create peer connection: " + error.message);
    }
}

// Send signaling message
async function sendSignal(data, targetUserId = null) {
    const targetId = targetUserId || currentCallPartnerId;
    
    if (!targetId || !db) {
        console.error("Cannot send signal: no target ID or db");
        return;
    }
    
    try {
        // Add timestamp and from field
        data.timestamp = serverTimestamp();
        
        console.log("Sending signal to:", targetId, "Type:", data.type);
        
        // Create a unique ID for this signal
        const signalId = `signal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Send to the recipient's signaling channel
        await setDoc(doc(db, 'calls', targetId, 'signals', signalId), data);
        
        console.log("Signal sent successfully");
    } catch (error) {
        console.error("Error sending signal:", error);
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
        
        console.log('Microphone', isMuted ? 'muted' : 'unmuted');
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
        
        console.log('Video', isVideoEnabled ? 'enabled' : 'disabled');
    }
}

// End the current call
async function endCall() {
    try {
        console.log('Ending call...');
        
        // Get partner ID from session storage if currentCallPartnerId is null
        const partnerId = currentCallPartnerId || sessionStorage.getItem('currentCallPartnerId');
        const callType = currentCallType || sessionStorage.getItem('currentCallType');
        const callId = activeCallId || sessionStorage.getItem('activeCallId');
        
        if (!partnerId) {
            console.warn('No partner ID found for call cleanup');
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
        console.error('Error ending call:', error);
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

// Add call history to chat with WhatsApp-style formatting
async function addCallHistoryToChat(callType, duration = null, partnerId = null, callTypeValue = null, callId = null) {
    try {
        const targetPartnerId = partnerId || currentCallPartnerId;
        const targetCallType = callTypeValue || currentCallType;
        const targetCallId = callId || activeCallId;
        
        if (!targetPartnerId || !targetCallType) {
            console.warn('Missing partner ID or call type for call history');
            return;
        }
        
        const threadId = [currentUser.uid, targetPartnerId].sort().join('_');
        
        // Determine the message content based on call type and duration
        let messageText = '';
        let displayText = '';
        let isOutgoing = true;
        
        if (callType === 'missed-call') {
            // This is a missed call from someone else
            isOutgoing = false;
            messageText = `Missed ${targetCallType} call`;
            displayText = `📞 Missed ${targetCallType === 'video' ? 'video' : 'voice'} call • Tap to call back`;
        } else if (callType === 'call-ended') {
            if (duration && duration > 0) {
                // Successful call with duration
                const durationText = formatCallDurationForMessage(duration);
                messageText = `${targetCallType === 'video' ? 'Video' : 'Voice'} call • ${durationText}`;
                displayText = `📞 ${targetCallType === 'video' ? 'Video' : 'Voice'} call • ${durationText}`;
            } else {
                // Call ended without connection (no answer)
                messageText = `${targetCallType === 'video' ? 'Video' : 'Voice'} call`;
                displayText = `📞 ${targetCallType === 'video' ? 'Video' : 'Voice'} call`;
            }
        }
        
        // Add call history message to chat with WhatsApp-style formatting
        await addDoc(collection(db, 'conversations', threadId, 'messages'), {
            type: callType,
            callType: targetCallType,
            senderId: currentUser.uid,
            timestamp: serverTimestamp(),
            read: false,
            callId: targetCallId,
            duration: duration,
            text: messageText,
            displayText: displayText,
            isSystemMessage: true,
            isOutgoing: isOutgoing
        });
        
        // Update conversation
        await setDoc(doc(db, 'conversations', threadId), {
            participants: [currentUser.uid, targetPartnerId],
            lastMessage: {
                text: messageText,
                senderId: currentUser.uid,
                timestamp: serverTimestamp(),
                type: callType
            },
            updatedAt: serverTimestamp()
        }, { merge: true });
        
        console.log("WhatsApp-style call history added to chat:", displayText);
        
    } catch (error) {
        console.error("Error adding call history to chat:", error);
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
    console.log('Showing call ended screen');
    
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
    console.log('Returning to chat');
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
    console.log('Call status:', status);
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
    console.error('Call error:', message);
    updateCallStatus(message);
    setTimeout(goBackToChat, 3000);
}

// Show notification
function showNotification(message, type = 'info') {
    console.log('Notification:', message, type);
    
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
    console.log('Page unloading, cleaning up call...');
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
        console.error('Missing parameters for call back');
        return;
    }
    
    console.log('Calling back:', partnerId, callType);
    
    // Generate a unique call ID
    const callId = `${currentUser.uid}_${partnerId}_${Date.now()}`;
    
    // Send a notification to the partner first
    sendCallNotification(partnerId, callType, callId).then(() => {
        // Redirect to call page with call parameters
        window.location.href = `call.html?type=${callType}&partnerId=${partnerId}&incoming=false&callId=${callId}`;
    }).catch(error => {
        console.error('Error sending call notification:', error);
        showNotification('Failed to initiate call. Please try again.', 'error');
    });
};