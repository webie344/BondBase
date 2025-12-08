// face.js - Face swapping functionality for video calls
// Load this file after call.js to add face swap capabilities

// Global variables for face swapping
let isFaceSwapEnabled = false;
let faceSwapImage = null;
let faceSwapCanvas = null;
let faceSwapCtx = null;
let faceDetectionModel = null;
let faceSwapInterval = null;
let faceDetectionOptions = null;
let debugMode = true;

// Initialize face swap functionality
async function initializeFaceSwap() {
    debugLog("Initializing face swap functionality...");
    
    try {
        // Load TensorFlow.js and FaceLandmarks model
        await loadFaceDetectionModel();
        
        // Create canvas for face processing
        createFaceSwapCanvas();
        
        // Setup debug panel
        setupDebugPanel();
        
        // Setup event listeners
        setupEventListeners();
        
        debugLog("Face swap initialized successfully");
    } catch (error) {
        debugLog("Error initializing face swap: " + error.message, true);
    }
}

// Debug logging function
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

// Setup debug panel
function setupDebugPanel() {
    const toggleBtn = document.getElementById('toggleDebug');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', function() {
            const debugPanel = document.getElementById('faceDebugPanel');
            if (debugPanel) {
                const isHidden = debugPanel.style.display === 'none';
                debugPanel.style.display = isHidden ? 'block' : 'none';
                toggleBtn.textContent = isHidden ? 'Hide Debug' : 'Show Debug';
            }
        });
    }
}

// Setup event listeners
function setupEventListeners() {
    const faceSwapBtn = document.getElementById('faceSwapBtn');
    const faceImageInput = document.getElementById('faceImageInput');
    const selectFaceImage = document.getElementById('selectFaceImage');
    const cancelFaceSelect = document.getElementById('cancelFaceSelect');
    
    if (faceSwapBtn) {
        faceSwapBtn.addEventListener('click', toggleFaceSwap);
        debugLog("Added click event to face swap button");
    }
    
    if (faceImageInput) {
        faceImageInput.addEventListener('change', handleFaceImageUpload);
    }
    
    if (selectFaceImage) {
        selectFaceImage.addEventListener('click', function() {
            debugLog("Select image button clicked");
            faceImageInput.click();
            hideFaceSwapModal();
        });
    }
    
    if (cancelFaceSelect) {
        cancelFaceSelect.addEventListener('click', function() {
            debugLog("Cancel button clicked");
            hideFaceSwapModal();
        });
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

// Load TensorFlow.js and FaceLandmarks model
async function loadFaceDetectionModel() {
    debugLog("Loading face detection models...");
    
    try {
        // Check if TensorFlow.js is already loaded
        if (typeof tf === 'undefined') {
            debugLog("Loading TensorFlow.js...");
            await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.11.0/dist/tf.min.js');
            debugLog("TensorFlow.js loaded");
        } else {
            debugLog("TensorFlow.js already loaded");
        }
        
        // Check if FaceLandmarks is already loaded
        if (typeof faceLandmarksDetection === 'undefined') {
            debugLog("Loading FaceLandmarks detection...");
            await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/face-landmarks-detection@0.0.1/dist/face-landmarks-detection.min.js');
            debugLog("FaceLandmarks detection loaded");
        } else {
            debugLog("FaceLandmarks detection already loaded");
        }
        
        // Load the model
        debugLog("Loading face detection model...");
        faceDetectionModel = await faceLandmarksDetection.load(
            faceLandmarksDetection.SupportedPackages.mediapipeFacemesh
        );
        
        // Set detection options
        faceDetectionOptions = {
            maxFaces: 1,
            refineLandmarks: true,
            flipHorizontal: false
        };
        
        debugLog("Face detection model loaded successfully");
    } catch (error) {
        debugLog("Error loading face detection model: " + error.message, true);
        throw error;
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

// Create canvas for face processing
function createFaceSwapCanvas() {
    faceSwapCanvas = document.createElement('canvas');
    faceSwapCtx = faceSwapCanvas.getContext('2d');
    faceSwapCanvas.style.display = 'none';
    document.body.appendChild(faceSwapCanvas);
    debugLog("Created face swap canvas");
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
function startFaceSwap() {
    debugLog("Attempting to start face swap");
    
    if (!faceDetectionModel) {
        debugLog("Face detection model not loaded", true);
        return;
    }
    
    if (!faceSwapImage) {
        debugLog("No face image selected", true);
        return;
    }
    
    if (!localStream) {
        debugLog("No local stream available", true);
        return;
    }
    
    debugLog("Starting face swap with image: " + faceSwapImage.width + "x" + faceSwapImage.height);
    
    // Get video element
    const videoElement = document.getElementById('localVideo');
    if (!videoElement) {
        debugLog("Local video element not found", true);
        return;
    }
    
    debugLog("Video element found: " + videoElement.videoWidth + "x" + videoElement.videoHeight);
    
    // Clear any existing interval
    if (faceSwapInterval) {
        clearInterval(faceSwapInterval);
        faceSwapInterval = null;
    }
    
    // Start processing frames
    faceSwapInterval = setInterval(async () => {
        try {
            await processFaceSwapFrame(videoElement);
        } catch (error) {
            debugLog("Error processing face swap frame: " + error.message, true);
        }
    }, 100); // Process 10 frames per second
    
    debugLog("Face swap started successfully");
}

// Stop face swap processing
function stopFaceSwap() {
    debugLog("Stopping face swap");
    
    if (faceSwapInterval) {
        clearInterval(faceSwapInterval);
        faceSwapInterval = null;
    }
    
    // Restore original video stream
    if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
            const sender = peerConnection.getSenders().find(s => 
                s.track && s.track.kind === 'video'
            );
            if (sender) {
                sender.replaceTrack(videoTrack);
                debugLog("Restored original video track");
            }
        }
    }
}

// Process a single frame for face swapping
async function processFaceSwapFrame(videoElement) {
    // Set canvas dimensions to match video
    faceSwapCanvas.width = videoElement.videoWidth || 640;
    faceSwapCanvas.height = videoElement.videoHeight || 480;
    
    // Draw current video frame to canvas
    faceSwapCtx.drawImage(videoElement, 0, 0, faceSwapCanvas.width, faceSwapCanvas.height);
    
    // Detect faces
    const faces = await faceDetectionModel.estimateFaces({
        input: faceSwapCanvas,
        returnTensors: false,
        flipHorizontal: false,
        predictIrises: false
    });
    
    debugLog("Faces detected: " + faces.length);
    
    // Apply face swap to each detected face
    if (faces.length > 0) {
        applyFaceSwap(faces[0]);
    }
    
    // Replace the video track with our processed canvas stream
    const canvasStream = faceSwapCanvas.captureStream(30);
    const canvasTrack = canvasStream.getVideoTracks()[0];
    
    const sender = peerConnection.getSenders().find(s => 
        s.track && s.track.kind === 'video'
    );
    
    if (sender) {
        await sender.replaceTrack(canvasTrack);
    }
}

// Apply face swap to a detected face
function applyFaceSwap(face) {
    if (!faceSwapImage) return;
    
    const landmarks = face.annotations;
    
    if (!landmarks || !landmarks.silhouette) {
        debugLog("No face landmarks detected");
        return;
    }
    
    debugLog("Applying face swap to detected face");
    
    // Get face bounding box
    const silhouette = landmarks.silhouette;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    for (const point of silhouette) {
        minX = Math.min(minX, point[0]);
        minY = Math.min(minY, point[1]);
        maxX = Math.max(maxX, point[0]);
        maxY = Math.max(maxY, point[1]);
    }
    
    const faceWidth = maxX - minX;
    const faceHeight = maxY - minY;
    
    // Calculate position and size for the replacement face
    const scale = 1.2; // Slightly larger than detected face
    const width = faceWidth * scale;
    const height = faceHeight * scale;
    const x = minX - (width - faceWidth) / 2;
    const y = minY - (height - faceHeight) / 2;
    
    // Draw the replacement face
    faceSwapCtx.save();
    faceSwapCtx.globalCompositeOperation = 'source-over';
    
    // Create a circular clipping path for a more natural look
    faceSwapCtx.beginPath();
    faceSwapCtx.ellipse(
        minX + faceWidth / 2,
        minY + faceHeight / 2,
        faceWidth / 2,
        faceHeight / 2,
        0, 0, Math.PI * 2
    );
    faceSwapCtx.clip();
    
    // Draw the replacement face image
    faceSwapCtx.drawImage(faceSwapImage, x, y, width, height);
    faceSwapCtx.restore();
}

// Clean up when leaving the page
function cleanupFaceSwap() {
    debugLog("Cleaning up face swap");
    stopFaceSwap();
    
    if (faceSwapInterval) {
        clearInterval(faceSwapInterval);
        faceSwapInterval = null;
    }
}

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', function() {
    debugLog("DOM loaded - initializing face swap");
    
    // Check if we're on the call page
    if (window.location.pathname.includes('call.html')) {
        // Wait a bit for the call page to initialize
        setTimeout(() => {
            initializeFaceSwap();
        }, 2000);
    }
});

// Add cleanup to beforeunload
const originalBeforeUnload = window.onbeforeunload;
window.onbeforeunload = function() {
    cleanupFaceSwap();
    if (originalBeforeUnload) {
        originalBeforeUnload();
    }
};