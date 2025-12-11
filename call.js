// call.js - WebRTC implementation with improved face swap
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
    deleteDoc
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
let pendingSignals = [];

// Face swap variables
let isFaceSwapEnabled = false;
let faceSwapImage = null;
let faceSwapCanvas = null;
let faceSwapCtx = null;
let isProcessing = false;
let debugMode = true;
let originalVideoTrack = null;
let processedStream = null;
let faceapiLoaded = false;

// Firebase configuration
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
            }
        } else {
            console.log("User not authenticated");
            showNotification('Please log in to make calls.', 'error');
        }
    });
});

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
        // Redirect to call page
        window.location.href = `call.html?type=${data.callType}&partnerId=${data.from}&incoming=true&callId=${data.callId}`;
        notification.remove();
    });
    
    document.getElementById('rejectIncomingCall').addEventListener('click', () => {
        // Send rejection signal
        sendSignal({
            type: 'call-rejected',
            from: currentUser.uid
        }, data.from);
        notification.remove();
    });
    
    // Auto remove after 30 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 30000);
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
    
    // Set up face swap functionality
    setupFaceSwap();
    
    // Pre-load face models in background
    preloadFaceAPI();
    
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

// Set up face swap functionality
function setupFaceSwap() {
    console.log("Setting up face swap functionality");
    
    // Create face swap button if it doesn't exist
    if (!document.getElementById('faceSwapBtn')) {
        const faceSwapBtn = document.createElement('button');
        faceSwapBtn.id = 'faceSwapBtn';
        faceSwapBtn.className = 'control-btn face-swap-btn';
        faceSwapBtn.innerHTML = '<i class="fas fa-user-circle"></i>';
        faceSwapBtn.title = 'Swap your face with another image';
        
        // Add button to call controls
        const callControls = document.querySelector('.call-controls');
        if (callControls) {
            // Insert before the end call button
            callControls.insertBefore(faceSwapBtn, document.getElementById('endCallBtn'));
        }
    }
    
    // Create hidden file input if it doesn't exist
    if (!document.getElementById('faceImageInput')) {
        const faceImageInput = document.createElement('input');
        faceImageInput.type = 'file';
        faceImageInput.id = 'faceImageInput';
        faceImageInput.accept = 'image/*';
        faceImageInput.style.display = 'none';
        document.body.appendChild(faceImageInput);
    }
    
    // Create face swap modal if it doesn't exist
    if (!document.getElementById('faceSwapModal')) {
        const faceSwapModal = document.createElement('div');
        faceSwapModal.id = 'faceSwapModal';
        faceSwapModal.className = 'face-swap-modal';
        faceSwapModal.style.display = 'none';
        faceSwapModal.innerHTML = `
            <div class="face-swap-content">
                <h3>Select a Face Image</h3>
                <p>Please select an image to use for face swapping</p>
                <button id="selectFaceImage">Select Image</button>
                <button class="secondary" id="cancelFaceSelect">Cancel</button>
            </div>
        `;
        document.body.appendChild(faceSwapModal);
    }
    
    // Create debug panel if it doesn't exist
    if (!document.getElementById('faceDebugPanel')) {
        const debugPanel = document.createElement('div');
        debugPanel.id = 'faceDebugPanel';
        debugPanel.innerHTML = `
            <h4>Face Swap Debug</h4>
            <div id="debugInfo"></div>
            <button id="toggleDebug">Hide Debug</button>
        `;
        document.body.appendChild(debugPanel);
        
        // Add debug panel styles
        if (!document.getElementById('debug-panel-styles')) {
            const styles = document.createElement('style');
            styles.id = 'debug-panel-styles';
            styles.textContent = `
                #faceDebugPanel {
                    position: fixed;
                    bottom: 10px;
                    left: 10px;
                    background: rgba(0,0,0,0.7);
                    color: white;
                    padding: 10px;
                    border-radius: 5px;
                    z-index: 10000;
                    font-family: monospace;
                    font-size: 12px;
                    max-width: 300px;
                    max-height: 200px;
                    overflow-y: auto;
                }
                #faceDebugPanel h4 {
                    margin: 0 0 8px 0;
                }
                #debugInfo {
                    max-height: 120px;
                    overflow-y: auto;
                    margin-bottom: 8px;
                }
                #toggleDebug {
                    margin-top: 8px;
                    background: #444;
                    color: white;
                    border: none;
                    padding: 4px 8px;
                    border-radius: 3px;
                    cursor: pointer;
                }
                .face-swap-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.8);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 10000;
                }
                .face-swap-content {
                    background: white;
                    padding: 20px;
                    border-radius: 10px;
                    text-align: center;
                    max-width: 400px;
                    width: 90%;
                }
                .face-swap-content h3 {
                    margin-bottom: 15px;
                    color: #333;
                }
                .face-swap-content button {
                    background: #4CAF50;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 5px;
                    cursor: pointer;
                    margin: 10px 5px;
                }
                .face-swap-content button.secondary {
                    background: #f44336;
                }
                .face-swap-btn.active {
                    background: #4CAF50;
                }
            `;
            document.head.appendChild(styles);
        }
    }
    
    // Add event listeners
    document.getElementById('faceSwapBtn').addEventListener('click', toggleFaceSwap);
    document.getElementById('faceImageInput').addEventListener('change', handleFaceImageUpload);
    document.getElementById('selectFaceImage').addEventListener('click', function() {
        document.getElementById('faceImageInput').click();
        hideFaceSwapModal();
    });
    document.getElementById('cancelFaceSelect').addEventListener('click', hideFaceSwapModal);
    document.getElementById('toggleDebug').addEventListener('click', function() {
        const debugPanel = document.getElementById('faceDebugPanel');
        if (debugPanel) {
            const isHidden = debugPanel.style.display === 'none';
            debugPanel.style.display = isHidden ? 'block' : 'none';
            this.textContent = isHidden ? 'Hide Debug' : 'Show Debug';
        }
    });
    
    console.log("Face swap setup complete");
}

// Pre-load FaceAPI.js models
async function preloadFaceAPI() {
    try {
        debugLog("Loading FaceAPI.js...");
        
        // Load FaceAPI.js
        await loadScript('https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js');
        debugLog("FaceAPI.js loaded");
        
        // Load models
        await faceapi.nets.tinyFaceDetector.loadFromUri('https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights');
        await faceapi.nets.faceLandmark68Net.loadFromUri('https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights');
        await faceapi.nets.faceRecognitionNet.loadFromUri('https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights');
        
        faceapiLoaded = true;
        debugLog("FaceAPI models loaded successfully");
    } catch (error) {
        debugLog("Error loading FaceAPI: " + error.message, true);
    }
}

// Debug logging function for face swap
function debugLog(message, isError = false) {
    if (debugMode) {
        console.log(isError ? "❌ " + message : "ℹ️ " + message);
        
        // Update debug panel
        const debugInfo = document.getElementById('debugInfo');
        if (debugInfo) {
            const logEntry = document.createElement('div');
            logEntry.textContent = new Date().toLocaleTimeString() + ': ' + message;
            logEntry.style.color = isError ? '#ff6b6b' : '#fff';
            logEntry.style.marginBottom = '4px';
            logEntry.style.fontSize = '11px';
            debugInfo.appendChild(logEntry);
            
            // Auto-scroll to bottom
            debugInfo.scrollTop = debugInfo.scrollHeight;
        }
    }
}

// Hide face swap modal
function hideFaceSwapModal() {
    const faceSwapModal = document.getElementById('faceSwapModal');
    if (faceSwapModal) {
        faceSwapModal.style.display = 'none';
    }
}

// Show face swap modal
function showFaceSwapModal() {
    const faceSwapModal = document.getElementById('faceSwapModal');
    if (faceSwapModal) {
        faceSwapModal.style.display = 'flex';
    }
}

// Handle face image upload
function handleFaceImageUpload(event) {
    debugLog("Face image upload triggered");
    const file = event.target.files[0];
    if (!file) {
        debugLog("No file selected");
        return;
    }
    
    debugLog("File selected: " + file.name);
    
    const reader = new FileReader();
    reader.onload = function(e) {
        faceSwapImage = new Image();
        faceSwapImage.onload = function() {
            debugLog("Face image loaded successfully: " + faceSwapImage.width + "x" + faceSwapImage.height);
            if (isFaceSwapEnabled) {
                startFaceSwap();
            }
        };
        faceSwapImage.onerror = function() {
            debugLog("Error loading face image", true);
        };
        faceSwapImage.src = e.target.result;
    };
    reader.onerror = function() {
        debugLog("Error reading file", true);
    };
    reader.readAsDataURL(file);
}

// Toggle face swap on/off
function toggleFaceSwap() {
    debugLog("Face swap button clicked");
    
    if (!faceSwapImage) {
        debugLog("No face image selected - showing prompt");
        // No face image selected, prompt user to upload one
        showFaceSwapModal();
        return;
    }
    
    isFaceSwapEnabled = !isFaceSwapEnabled;
    const button = document.getElementById('faceSwapBtn');
    
    if (button) {
        button.classList.toggle('active', isFaceSwapEnabled);
        debugLog("Face swap " + (isFaceSwapEnabled ? "enabled" : "disabled"));
    }
    
    if (isFaceSwapEnabled) {
        startFaceSwap();
    } else {
        stopFaceSwap();
    }
}

// Start face swap processing
async function startFaceSwap() {
    if (!faceSwapImage || !localStream) {
        debugLog("Cannot start face swap: missing image or stream", true);
        return;
    }
    
    if (!faceapiLoaded) {
        debugLog("FaceAPI not loaded yet", true);
        return;
    }
    
    debugLog("Starting face swap with FaceAPI");
    
    try {
        const videoTrack = localStream.getVideoTracks()[0];
        if (!videoTrack) {
            debugLog("No video track available", true);
            return;
        }
        
        // Store original track for restoration
        originalVideoTrack = videoTrack;
        
        // Create canvas for processing
        if (!faceSwapCanvas) {
            faceSwapCanvas = document.createElement('canvas');
            faceSwapCtx = faceSwapCanvas.getContext('2d');
            faceSwapCanvas.style.display = 'none';
            document.body.appendChild(faceSwapCanvas);
        }
        
        // Use a more efficient approach with requestVideoFrameCallback
        isFaceSwapEnabled = true;
        isProcessing = true;
        
        const videoElement = document.getElementById('localVideo');
        let lastFrameTime = 0;
        const targetFPS = 15; // Reduced FPS for better performance
        
        // Create a stream from canvas
        processedStream = faceSwapCanvas.captureStream(30);
        const processedTrack = processedStream.getVideoTracks()[0];
        
        // Replace the track in the peer connection
        const sender = peerConnection.getSenders().find(s => 
            s.track && s.track.kind === 'video'
        );
        
        if (sender) {
            await sender.replaceTrack(processedTrack);
            debugLog("Replaced video track with processed stream");
        }
        
        // Processing function
        const processFrame = async (now, metadata) => {
            if (!isFaceSwapEnabled || !isProcessing) return;
            
            // Throttle processing to target FPS
            if (now - lastFrameTime < 1000 / targetFPS) {
                videoElement.requestVideoFrameCallback(processFrame);
                return;
            }
            
            lastFrameTime = now;
            
            try {
                // Process frame
                await processFaceSwapFrame(videoElement, metadata);
            } catch (error) {
                debugLog("Error processing frame: " + error.message, true);
            }
            
            // Request next frame
            if (isFaceSwapEnabled && isProcessing) {
                videoElement.requestVideoFrameCallback(processFrame);
            }
        };
        
        // Start processing
        videoElement.requestVideoFrameCallback(processFrame);
        
    } catch (error) {
        debugLog("Error starting face swap: " + error.message, true);
        isFaceSwapEnabled = false;
        isProcessing = false;
    }
}

// Process a single frame for face swapping
async function processFaceSwapFrame(videoElement, metadata) {
    // Set canvas dimensions
    faceSwapCanvas.width = videoElement.videoWidth || 640;
    faceSwapCanvas.height = videoElement.videoHeight || 480;
    
    // Draw current video frame
    faceSwapCtx.drawImage(videoElement, 0, 0, faceSwapCanvas.width, faceSwapCanvas.height);
    
    try {
        // Detect faces using FaceAPI.js
        const detections = await faceapi
            .detectAllFaces(faceSwapCanvas, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks();
        
        // Apply face swap if faces detected
        if (detections.length > 0) {
            applyFaceSwap(detections[0]);
        }
    } catch (error) {
        debugLog("Face detection error: " + error.message, true);
    }
}

// Apply face swap using FaceAPI.js landmarks
function applyFaceSwap(detection) {
    if (!faceSwapImage) return;
    
    const landmarks = detection.landmarks;
    if (!landmarks) return;
    
    // Get face bounding box
    const box = detection.detection.box;
    const x = box.x;
    const y = box.y;
    const width = box.width;
    const height = box.height;
    
    // Draw the replacement face with better blending
    faceSwapCtx.save();
    
    // Create a clipping path based on face shape
    faceSwapCtx.beginPath();
    
    // Use jaw outline for more natural face shape
    const jawOutline = landmarks.getJawOutline();
    faceSwapCtx.moveTo(jawOutline[0].x, jawOutline[0].y);
    for (let i = 1; i < jawOutline.length; i++) {
        faceSwapCtx.lineTo(jawOutline[i].x, jawOutline[i].y);
    }
    faceSwapCtx.closePath();
    faceSwapCtx.clip();
    
    // Draw the replacement face image with proper scaling
    faceSwapCtx.drawImage(faceSwapImage, x, y, width, height);
    faceSwapCtx.restore();
    
    // Preserve the original mouth for lip sync
    preserveMouth(landmarks);
    
    // Preserve the original eyes for natural blinking
    preserveEyes(landmarks);
}

// Preserve the original mouth for lip sync
function preserveMouth(landmarks) {
    const mouth = landmarks.getMouth();
    if (!mouth || mouth.length < 12) return;
    
    // Get mouth bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const point of mouth) {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
    }
    
    const mouthWidth = maxX - minX;
    const mouthHeight = maxY - minY;
    
    // Create a temporary canvas for the mouth region
    const mouthCanvas = document.createElement('canvas');
    const mouthCtx = mouthCanvas.getContext('2d');
    mouthCanvas.width = mouthWidth;
    mouthCanvas.height = mouthHeight;
    
    // Draw the mouth region from the original frame
    mouthCtx.drawImage(
        faceSwapCanvas, 
        minX, minY, mouthWidth, mouthHeight,
        0, 0, mouthWidth, mouthHeight
    );
    
    // Apply the mouth back with feathering for smoother blend
    faceSwapCtx.globalCompositeOperation = 'source-over';
    faceSwapCtx.drawImage(mouthCanvas, minX, minY, mouthWidth, mouthHeight);
}

// Preserve the original eyes for natural blinking
function preserveEyes(landmarks) {
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();
    
    if (leftEye && leftEye.length === 6) {
        preserveEyeRegion(leftEye);
    }
    
    if (rightEye && rightEye.length === 6) {
        preserveEyeRegion(rightEye);
    }
}

// Preserve a single eye region
function preserveEyeRegion(eyePoints) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const point of eyePoints) {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
    }
    
    const eyeWidth = maxX - minX;
    const eyeHeight = maxY - minY;
    
    // Expand the region slightly to include eyelids
    const expandedMinX = Math.max(0, minX - eyeWidth * 0.2);
    const expandedMinY = Math.max(0, minY - eyeHeight * 0.2);
    const expandedMaxX = Math.min(faceSwapCanvas.width, maxX + eyeWidth * 0.2);
    const expandedMaxY = Math.min(faceSwapCanvas.height, maxY + eyeHeight * 0.2);
    const expandedWidth = expandedMaxX - expandedMinX;
    const expandedHeight = expandedMaxY - expandedMinY;
    
    // Create a temporary canvas for the eye region
    const eyeCanvas = document.createElement('canvas');
    const eyeCtx = eyeCanvas.getContext('2d');
    eyeCanvas.width = expandedWidth;
    eyeCanvas.height = expandedHeight;
    
    // Draw the eye region from the original frame
    eyeCtx.drawImage(
        faceSwapCanvas, 
        expandedMinX, expandedMinY, expandedWidth, expandedHeight,
        0, 0, expandedWidth, expandedHeight
    );
    
    // Apply the eye back
    faceSwapCtx.globalCompositeOperation = 'source-over';
    faceSwapCtx.drawImage(eyeCanvas, expandedMinX, expandedMinY, expandedWidth, expandedHeight);
}

// Stop face swap processing
function stopFaceSwap() {
    debugLog("Stopping face swap");
    isFaceSwapEnabled = false;
    isProcessing = false;
    
    // Restore original video stream
    if (localStream && originalVideoTrack) {
        const sender = peerConnection.getSenders().find(s => 
            s.track && s.track.kind === 'video'
        );
        if (sender) {
            sender.replaceTrack(originalVideoTrack);
            debugLog("Restored original video track");
        }
    }
}

// Load a script dynamically
function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
        document.head.appendChild(script);
    });
}

// Clean up face swap when leaving the page
function cleanupFaceSwap() {
    debugLog("Cleaning up face swap");
    stopFaceSwap();
}

// [Rest of the WebRTC functions remain the same as in your original code]
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
    }, (error)=> {
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
        
        // Clean up face swap
        cleanupFaceSwap();
        
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