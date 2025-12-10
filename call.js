// call.js - WebRTC implementation for voice and video calls
// This file works independently alongside app.js

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
    arrayUnion
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// WebRTC configuration with more robust ICE servers
const rtcConfiguration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' }
    ],
    iceCandidatePoolSize: 10
};

// Global variables for WebRTC
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
let pendingSignals = []; // Store signals that arrive before peerConnection is ready
let callNotificationSound = null;
let callRingtone = null;
let isRinging = false;
let notificationSoundInterval = null;

// Firebase configuration (same as in app.js)
const firebaseConfig = {
    apiKey: "AIzaSyC9uL_BX14Z6rRpgG4MT9Tca1opJl8EviQ",
    authDomain: "dating-connect.firebaseapp.com",
    projectId: "dating-connect",
    storageBucket: "dating-connect.appspot.com",
    messagingSenderId: "1062172180210",
    appId: "1:1062172180210:web:0c9b3c1578a5dbae58da6b"
};

// Initialize based on whether we're on chat.html or call.html
document.addEventListener('DOMContentLoaded', function() {
    console.log("=== CALL.JS LOADED ===");
    
    const isCallPage = window.location.pathname.includes('call.html');
    console.log("Is call page:", isCallPage);
    
    // Initialize Firebase
    try {
        const app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        console.log("Firebase initialized successfully");
        
        // Preload notification sounds
        preloadNotificationSounds();
    } catch (error) {
        console.error("Firebase initialization error:", error);
        showNotification('Firebase initialization failed. Please refresh the page.', 'error');
        return;
    }
    
    // Set up auth state listener
    onAuthStateChanged(auth, function(user) {
        if (user) {
            currentUser = user;
            console.log("User authenticated:", user.uid);
            
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
            console.log("User not authenticated");
            showNotification('Please log in to make calls.', 'error');
        }
    });
});

// Preload notification sounds
function preloadNotificationSounds() {
    // Create notification sound for incoming calls
    callNotificationSound = new Audio('sounds/notification.mp3');
    
    // Create ringtone for incoming calls (repeating)
    callRingtone = new Audio('ringingtone.mp3');
    callRingtone.loop = true;
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
                
                // Add missed call to chat
                await addMissedCallToChat(data);
                
                // Mark as processed
                await deleteDoc(doc(db, 'calls', currentUser.uid, 'missed', change.doc.id));
            }
        });
    });
}

// Add missed call to chat
async function addMissedCallToChat(callData) {
    try {
        // Create a combined ID for the chat thread
        const threadId = [currentUser.uid, callData.from].sort().join('_');
        
        // Add missed call message to chat
        await addDoc(collection(db, 'conversations', threadId, 'messages'), {
            type: 'missed-call',
            callType: callData.callType,
            senderId: callData.from,
            timestamp: serverTimestamp(),
            read: false
        });
        
        // Update the conversation document
        await setDoc(doc(db, 'conversations', threadId), {
            participants: [currentUser.uid, callData.from],
            lastMessage: {
                text: `Missed ${callData.callType} call`,
                senderId: callData.from,
                timestamp: serverTimestamp()
            },
            updatedAt: serverTimestamp()
        }, { merge: true });
        
        console.log("Missed call added to chat");
    } catch (error) {
        console.error("Error adding missed call to chat:", error);
    }
}

// Play notification sound
function playNotificationSound() {
    if (callNotificationSound) {
        callNotificationSound.currentTime = 0;
        callNotificationSound.play().catch(error => {
            console.log("Notification sound play failed:", error);
        });
    }
}

// Play ringtone for incoming call
function playRingtone() {
    if (isRinging) return;
    
    isRinging = true;
    if (callRingtone) {
        callRingtone.currentTime = 0;
        callRingtone.play().catch(error => {
            console.log("Ringtone play failed:", error);
        });
    }
}

// Stop ringtone
function stopRingtone() {
    isRinging = false;
    if (callRingtone) {
        callRingtone.pause();
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
        console.error("Voice call button not found");
    }
    
    if (videoCallBtn) {
        videoCallBtn.addEventListener('click', () => {
            console.log("Video call button clicked");
            initiateCall('video');
        });
    } else {
        console.error("Video call button not found");
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
    existingNotifications.forEach(notification => notification.remove());
    
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
    if (!document.getElementById('notification-styles')) {
        const styles = document.createElement('style');
        styles.id = 'notification-styles';
        styles.textContent = `
            .incoming-call-notification {
                position: fixed;
                top: 20px;
                right: 20px;
                background: white;
                padding: 20px;
                border-radius: 10px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
                z-index: 10000;
                max-width: 300px;
            }
            .notification-buttons {
                display: flex;
                gap: 10px;
                margin-top: 15px;
            }
            .accept-call, .reject-call {
                padding: 8px 16px;
                border: none;
                border-radius: 20px;
                cursor: pointer;
                font-weight: bold;
            }
            .accept-call {
                background: #28a745;
                color: white;
            }
            .reject-call {
                background: #dc3545;
                color: white;
            }
        `;
        document.head.appendChild(styles);
    }
    
    document.body.appendChild(notification);
    
    // Add event listeners
    document.getElementById('acceptIncomingCall').addEventListener('click', () => {
        // Stop ringtone
        stopRingtone();
        
        // Redirect to call page
        window.location.href = `call.html?type=${data.callType}&partnerId=${data.from}&incoming=true&callId=${data.callId}`;
        notification.remove();
    });
    
    document.getElementById('rejectIncomingCall').addEventListener('click', () => {
        // Stop ringtone
        stopRingtone();
        
        // Send rejection signal
        sendSignal({
            type: 'call-rejected',
            from: currentUser.uid
        }, data.from);
        
        // Add missed call to database
        addMissedCall(data.from, data.callType, data.callId);
        
        notification.remove();
    });
    
    // Auto remove after 30 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            // Stop ringtone
            stopRingtone();
            
            // Add missed call to database
            addMissedCall(data.from, data.callType, data.callId);
            
            notification.remove();
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
    
    // Update UI with caller name
    try {
        const partnerDoc = await getDoc(doc(db, 'users', partnerId));
        if (partnerDoc.exists()) {
            const partnerName = partnerDoc.data().name || 'Unknown';
            document.getElementById('callerName').textContent = partnerName;
        }
    } catch (error) {
        console.error('Error getting partner info:', error);
    }
    
    // Set up event listeners for call controls
    document.getElementById('muteBtn').addEventListener('click', toggleMute);
    document.getElementById('videoBtn').addEventListener('click', toggleVideo);
    document.getElementById('endCallBtn').addEventListener('click', endCall);
    document.getElementById('backToChat').addEventListener('click', goBackToChat);
    
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
        
        // Get local media stream with better error handling
        console.log("Requesting media stream...");
        try {
            localStream = await navigator.mediaDevices.getUserMedia({
                video: currentCallType === 'video' ? {
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                } : false,
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 44100
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
        if (currentCallType === 'video') {
            document.getElementById('localVideo').srcObject = localStream;
        } else {
            document.getElementById('localVideo').style.display = 'none';
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
                height: { ideal: 720 }
            } : false,
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: 44100
            }
        });
        console.log("Media stream prepared");
        
        // Display local video if it's a video call
        if (currentCallType === 'video') {
            document.getElementById('localVideo').srcObject = localStream;
        } else {
            document.getElementById('localVideo').style.display = 'none';
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
                    
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
                    
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
                    
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
                    hideLoader();
                    updateCallStatus('Connected');
                    console.log("Call connected successfully");
                }
                break;
                
            case 'ice-candidate':
                // ICE candidate received
                if (peerConnection && data.candidate) {
                    console.log("Adding ICE candidate");
                    try {
                        // Convert plain object back to RTCIceCandidate
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
                    // Play the remote video
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
                // Convert RTCIceCandidate to a plain object for Firestore
                const candidateData = {
                    candidate: event.candidate.candidate,
                    sdpMid: event.candidate.sdpMid,
                    sdpMLineIndex: event.candidate.sdpMLineIndex,
                    usernameFragment: event.candidate.usernameFragment
                };
                
                sendSignal({
                    type: 'ice-candidate',
                    candidate: candidateData,  // Send plain object, not RTCIceCandidate
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
            } else if (peerConnection.connectionState === 'disconnected' || 
                       peerConnection.connectionState === 'failed') {
                console.log("Call disconnected or failed");
                showCallEnded();
            }
        };
        
        // Handle ICE connection state changes
        peerConnection.oniceconnectionstatechange = () => {
            console.log("ICE connection state changed:", peerConnection.iceConnectionState);
            if (peerConnection.iceConnectionState === 'failed') {
                console.log("ICE connection failed");
                // Try to restart ICE
                if (peerConnection.restartIce) {
                    peerConnection.restartIce();
                }
            }
        };
        
        // Handle negotiation needed event
        peerConnection.onnegotiationneeded = () => {
            console.log("Negotiation needed");
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
        muteBtn.classList.toggle('active', isMuted);
        muteBtn.innerHTML = isMuted ? '<i class="fas fa-microphone-slash"></i>' : '<i class="fas fa-microphone"></i>';
        
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
        videoBtn.classList.toggle('active', !isVideoEnabled);
        
        // Show/hide local video based on state
        document.getElementById('localVideo').style.display = isVideoEnabled ? 'block' : 'none';
        
        console.log('Video', isVideoEnabled ? 'enabled' : 'disabled');
    }
}

// End the current call
async function endCall() {
    try {
        console.log('Ending call...');
        
        // Clear any timeout
        if (callTimeout) {
            clearTimeout(callTimeout);
            callTimeout = null;
        }
        
        // Stop ringtone if playing
        stopRingtone();
        
        // Send end call signal
        if (currentCallPartnerId) {
            await sendSignal({
                type: 'end-call',
                from: currentUser.uid,
                callId: activeCallId
            });
        }
        
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
        
        showCallEnded();
        
    } catch (error) {
        console.error('Error ending call:', error);
    }
}

// Show call ended screen
function showCallEnded() {
    console.log('Showing call ended screen');
    document.getElementById('callEnded').style.display = 'flex';
    document.getElementById('remoteVideo').style.display = 'none';
    document.getElementById('localVideo').style.display = 'none';
}

// Go back to chat
function goBackToChat() {
    console.log('Returning to chat');
    window.location.href = 'chat.html?id=' + currentCallPartnerId;
}

// Update call status
function updateCallStatus(status) {
    console.log('Call status:', status);
    document.getElementById('callStatus').textContent = status;
}

// Show loader
function showLoader(message) {
    const loader = document.getElementById('loader');
    if (loader) {
        loader.style.display = 'block';
        if (message) {
            loader.querySelector('p').textContent = message;
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

// Show notification (for chat page)
function showNotification(message, type = 'info') {
    console.log('Notification:', message, type);
    
    // Check if app.js notification function exists
    if (typeof window.showNotification === 'function') {
        window.showNotification(message, type);
        return;
    }
    
    // Fallback notification
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
    endCall();
    if (signalingUnsubscribe) {
        signalingUnsubscribe();
    }
});