// gist.js - COMPLETELY INDEPENDENT Gist functionality

// Firebase imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    query, 
    orderBy, 
    limit, 
    startAfter,
    serverTimestamp,
    doc,
    getDoc,
    updateDoc,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { 
    getAuth, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Firebase configuration (same as your app.js)
const firebaseConfig = {
    apiKey: "AIzaSyC9uL_BX14Z6rRpgG4MT9Tca1opJl8EviQ",
    authDomain: "dating-connect.firebaseapp.com",
    projectId: "dating-connect",
    storageBucket: "dating-connect.appspot.com",
    messagingSenderId: "1062172180210",
    appId: "1:1062172180210:web:0c9b3c1578a5dbae58da6b"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Cloudinary configuration (same as your app.js)
const cloudinaryConfig = {
    cloudName: "ddtdqrh1b",
    uploadPreset: "profile-pictures"
};

// Dicebear avatar types
const DICEBEAR_AVATARS = [
    'adventurer', 'adventurer-neutral', 'avataaars', 'big-ears', 
    'big-smile', 'bottts', 'croodles', 'fun-emoji', 'icons',
    'identicon', 'initials', 'micah', 'miniavs', 'open-peeps',
    'personas', 'pixel-art', 'pixel-art-neutral'
];

// Gist state variables
let currentUser = null;
let mediaRecorder = null;
let audioChunks = [];
let recordingStartTime = null;
let recordingTimer = null;
let pendingAudioBlob = null;
let pendingImageFile = null;
let pendingMediaType = null;
let lastVisibleGist = null;
let isLoading = false;

// Generate random Dicebear avatar URL
function getRandomAvatar() {
    const style = DICEBEAR_AVATARS[Math.floor(Math.random() * DICEBEAR_AVATARS.length)];
    const seed = Math.random().toString(36).substring(7);
    return `https://api.dicebear.com/7.x/${style}/svg?seed=${seed}`;
}

// Initialize on DOM content loaded
document.addEventListener('DOMContentLoaded', function() {
    // Check which page we're on
    const currentPage = window.location.pathname.split('/').pop().split('.')[0];
    
    // Listen for auth state changes
    onAuthStateChanged(auth, (user) => {
        currentUser = user;
        
        if (currentPage === 'create-gist') {
            initCreateGistPage();
        } else if (currentPage === 'gist') {
            initGistPage();
        }
    });
});

// Initialize create gist page
function initCreateGistPage() {
    const gistForm = document.getElementById('gistForm');
    const gistContent = document.getElementById('gistContent');
    const charCount = document.getElementById('charCount');
    const imageUploadBtn = document.getElementById('imageUploadBtn');
    const voiceRecordBtn = document.getElementById('voiceRecordBtn');
    const bothUploadBtn = document.getElementById('bothUploadBtn');
    const imageInput = document.getElementById('imageInput');
    const bothImageInput = document.getElementById('bothImageInput');
    const cancelBtn = document.getElementById('cancelBtn');
    const submitBtn = document.getElementById('submitBtn');
    const voiceRecordingIndicator = document.getElementById('voiceRecordingIndicator');
    const recordingTimerElement = document.getElementById('recordingTimer');
    const cancelRecordingBtn = document.getElementById('cancelRecordingBtn');
    const stopRecordingBtn = document.getElementById('stopRecordingBtn');
    const attachmentsContainer = document.getElementById('attachmentsContainer');
    const gistAvatar = document.getElementById('gistAvatar');

    // Set random avatar
    if (gistAvatar) {
        gistAvatar.src = getRandomAvatar();
    }

    // Character counter
    if (gistContent && charCount) {
        gistContent.addEventListener('input', () => {
            charCount.textContent = gistContent.value.length;
            updateSubmitButton();
        });
    }

    // Image upload button
    if (imageUploadBtn && imageInput) {
        imageUploadBtn.addEventListener('click', () => {
            pendingMediaType = 'image';
            resetMediaButtons();
            imageUploadBtn.classList.add('active');
            imageInput.click();
        });
    }

    // Voice record button
    if (voiceRecordBtn) {
        voiceRecordBtn.addEventListener('click', () => {
            pendingMediaType = 'audio';
            resetMediaButtons();
            voiceRecordBtn.classList.add('active');
            startVoiceRecording();
        });
    }

    // Both upload button
    if (bothUploadBtn && bothImageInput) {
        bothUploadBtn.addEventListener('click', () => {
            pendingMediaType = 'both';
            resetMediaButtons();
            bothUploadBtn.classList.add('active');
            bothImageInput.click();
        });
    }

    // Image input change
    if (imageInput) {
        imageInput.addEventListener('change', (e) => {
            if (e.target.files[0]) {
                handleImageUpload(e.target.files[0]);
            }
        });
    }

    // Both image input change
    if (bothImageInput) {
        bothImageInput.addEventListener('change', (e) => {
            if (e.target.files[0]) {
                handleImageUpload(e.target.files[0]);
                // After image is selected, start voice recording
                setTimeout(startVoiceRecording, 500);
            }
        });
    }

    // Cancel button
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            if (window.history.length > 1) {
                window.history.back();
            } else {
                window.location.href = 'gist.html';
            }
        });
    }

    // Cancel recording button
    if (cancelRecordingBtn) {
        cancelRecordingBtn.addEventListener('click', cancelVoiceRecording);
    }

    // Stop recording button
    if (stopRecordingBtn) {
        stopRecordingBtn.addEventListener('click', stopVoiceRecording);
    }

    // Form submit
    if (gistForm) {
        gistForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await submitGist();
        });
    }

    // Initialize submit button
    updateSubmitButton();

    // Add animation styles for waveform
    addWaveformStyles();
}

function resetMediaButtons() {
    const buttons = document.querySelectorAll('.media-option-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
}

function handleImageUpload(file) {
    if (!file.type.startsWith('image/')) {
        showNotification('Please select an image file', 'warning');
        return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
        showNotification('Image must be less than 10MB', 'warning');
        return;
    }

    pendingImageFile = file;
    showAttachmentPreview(file);
    updateSubmitButton();
}

function showAttachmentPreview(file) {
    const attachmentsContainer = document.getElementById('attachmentsContainer');
    if (!attachmentsContainer) return;

    attachmentsContainer.style.display = 'block';
    attachmentsContainer.innerHTML = `
        <div class="attachment-preview">
            <div class="attachment-info">
                <svg class="feather attachment-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
                <span class="attachment-name">${file.name} (${formatFileSize(file.size)})</span>
            </div>
            <button type="button" class="attachment-remove" id="removeAttachmentBtn">
                <svg class="feather" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        </div>
    `;

    // Remove attachment button
    document.getElementById('removeAttachmentBtn').addEventListener('click', () => {
        pendingImageFile = null;
        pendingAudioBlob = null;
        pendingMediaType = null;
        resetMediaButtons();
        attachmentsContainer.style.display = 'none';
        updateSubmitButton();
    });
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
}

// Voice recording functions
async function startVoiceRecording() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showNotification('Voice recording is not supported in your browser', 'warning');
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        
        recordingStartTime = Date.now();
        updateRecordingTimer();
        recordingTimer = setInterval(updateRecordingTimer, 1000);
        
        // Show recording indicator
        const voiceRecordingIndicator = document.getElementById('voiceRecordingIndicator');
        if (voiceRecordingIndicator) {
            voiceRecordingIndicator.style.display = 'flex';
        }
        
        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };
        
        mediaRecorder.start(100);
        
        // Stop recording after 60 seconds max
        setTimeout(() => {
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                stopVoiceRecording();
            }
        }, 60000);
        
    } catch (error) {
        console.error('Error accessing microphone:', error);
        showNotification('Microphone access denied. Please allow microphone access to record voice notes.', 'error');
        cancelVoiceRecording();
    }
}

function updateRecordingTimer() {
    const timerElement = document.getElementById('recordingTimer');
    if (timerElement && recordingStartTime) {
        const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
}

function stopVoiceRecording() {
    if (!mediaRecorder) return;
    
    clearInterval(recordingTimer);
    mediaRecorder.stop();
    
    // Stop all tracks in the stream
    mediaRecorder.stream.getTracks().forEach(track => track.stop());
    
    mediaRecorder.onstop = async () => {
        // Hide recording indicator
        const voiceRecordingIndicator = document.getElementById('voiceRecordingIndicator');
        if (voiceRecordingIndicator) {
            voiceRecordingIndicator.style.display = 'none';
        }
        
        const duration = Math.floor((Date.now() - recordingStartTime) / 1000);
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        
        // Show voice preview modal
        showVoicePreview(audioBlob, duration);
        
        mediaRecorder = null;
        audioChunks = [];
        recordingStartTime = null;
    };
}

function cancelVoiceRecording() {
    if (!mediaRecorder) return;
    
    clearInterval(recordingTimer);
    mediaRecorder.stop();
    
    if (mediaRecorder.stream) {
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
    
    // Hide recording indicator
    const voiceRecordingIndicator = document.getElementById('voiceRecordingIndicator');
    if (voiceRecordingIndicator) {
        voiceRecordingIndicator.style.display = 'none';
    }
    
    // Reset media buttons
    resetMediaButtons();
    
    mediaRecorder = null;
    audioChunks = [];
    recordingStartTime = null;
}

function showVoicePreview(audioBlob, duration) {
    const previewModal = document.getElementById('voicePreviewModal');
    const playPreviewBtn = document.getElementById('playPreviewBtn');
    const previewDuration = document.getElementById('previewDuration');
    const cancelPreviewBtn = document.getElementById('cancelPreviewBtn');
    const sendPreviewBtn = document.getElementById('sendPreviewBtn');
    const previewWaveform = document.getElementById('previewWaveform');
    
    if (!previewModal) return;
    
    previewModal.style.display = 'flex';
    if (previewDuration) previewDuration.textContent = formatDuration(duration);
    
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    
    // Create waveform bars if they don't exist
    if (previewWaveform && previewWaveform.children.length === 0) {
        previewWaveform.innerHTML = `
            <div class="wave-bar"></div>
            <div class="wave-bar"></div>
            <div class="wave-bar"></div>
            <div class="wave-bar"></div>
            <div class="wave-bar"></div>
        `;
    }
    
    const waveBars = previewWaveform ? previewWaveform.querySelectorAll('.wave-bar') : [];
    
    playPreviewBtn.addEventListener('click', () => {
        if (audio.paused) {
            audio.play();
            playPreviewBtn.innerHTML = `
                <svg class="feather" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <rect x="6" y="4" width="4" height="16"></rect>
                    <rect x="14" y="4" width="4" height="16"></rect>
                </svg>
            `;
            animateWaveform(waveBars);
        } else {
            audio.pause();
            playPreviewBtn.innerHTML = `
                <svg class="feather" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
            `;
            stopWaveformAnimation(waveBars);
        }
    });
    
    audio.onended = () => {
        playPreviewBtn.innerHTML = `
            <svg class="feather" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
        `;
        stopWaveformAnimation(waveBars);
    };
    
    cancelPreviewBtn.addEventListener('click', () => {
        audio.pause();
        URL.revokeObjectURL(audioUrl);
        previewModal.style.display = 'none';
        resetMediaButtons();
    });
    
    sendPreviewBtn.addEventListener('click', () => {
        audio.pause();
        URL.revokeObjectURL(audioUrl);
        
        pendingAudioBlob = audioBlob;
        showAttachmentPreview(new File([audioBlob], 'voice-note.webm', { type: 'audio/webm' }));
        previewModal.style.display = 'none';
        updateSubmitButton();
    });
}

function addWaveformStyles() {
    if (!document.getElementById('waveform-styles')) {
        const style = document.createElement('style');
        style.id = 'waveform-styles';
        style.textContent = `
            @keyframes waveform {
                0%, 100% { height: 5px; }
                50% { height: 20px; }
            }
        `;
        document.head.appendChild(style);
    }
}

function animateWaveform(bars) {
    bars.forEach((bar, index) => {
        bar.style.animation = `waveform 1.2s ${index * 0.1}s infinite ease-in-out`;
    });
}

function stopWaveformAnimation(bars) {
    bars.forEach(bar => {
        bar.style.animation = 'none';
    });
}

function updateSubmitButton() {
    const submitBtn = document.getElementById('submitBtn');
    const gistContent = document.getElementById('gistContent');
    
    if (!submitBtn) return;
    
    const hasContent = gistContent && gistContent.value.trim().length > 0;
    const hasMedia = pendingImageFile || pendingAudioBlob;
    
    submitBtn.disabled = !(hasContent || hasMedia);
}

async function submitGist() {
    const submitBtn = document.getElementById('submitBtn');
    const gistContent = document.getElementById('gistContent');
    
    if (!currentUser) {
        showNotification('Please login to create gists', 'error');
        return;
    }
    
    // Disable submit button
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
        <svg class="feather" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <line x1="12" y1="2" x2="12" y2="6"></line>
            <line x1="12" y1="18" x2="12" y2="22"></line>
            <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
            <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
            <line x1="2" y1="12" x2="6" y2="12"></line>
            <line x1="18" y1="12" x2="22" y2="12"></line>
            <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
            <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
        </svg>
        Posting...
    `;
    
    try {
        const content = gistContent ? gistContent.value.trim() : '';
        let mediaUrl = null;
        let mediaType = null;
        let duration = null;
        
        // Upload media if exists
        if (pendingImageFile || pendingAudioBlob) {
            showNotification('Uploading media...', 'info');
            
            if (pendingImageFile && pendingAudioBlob) {
                // Upload both
                const imageUrl = await uploadToCloudinary(pendingImageFile);
                const audioUrl = await uploadToCloudinary(
                    new File([pendingAudioBlob], 'voice-note.webm', { type: 'audio/webm' })
                );
                
                // For both, we'll store the audio URL and type
                // You can modify this to store both URLs if needed
                mediaUrl = audioUrl;
                mediaType = 'audio';
                duration = Math.floor(pendingAudioBlob.size / 16000); // Approximate duration
            } else if (pendingImageFile) {
                mediaUrl = await uploadToCloudinary(pendingImageFile);
                mediaType = 'image';
            } else if (pendingAudioBlob) {
                mediaUrl = await uploadToCloudinary(
                    new File([pendingAudioBlob], 'voice-note.webm', { type: 'audio/webm' })
                );
                mediaType = 'audio';
                duration = Math.floor(pendingAudioBlob.size / 16000); // Approximate duration
            }
        }
        
        // Create gist
        const gistId = await createGist(content, mediaUrl, mediaType, duration);
        
        if (gistId) {
            showNotification('Gist posted successfully!', 'success');
            
            // Clear form
            if (gistContent) gistContent.value = '';
            if (pendingImageFile) pendingImageFile = null;
            if (pendingAudioBlob) pendingAudioBlob = null;
            pendingMediaType = null;
            
            // Reset UI
            resetMediaButtons();
            const attachmentsContainer = document.getElementById('attachmentsContainer');
            if (attachmentsContainer) {
                attachmentsContainer.style.display = 'none';
                attachmentsContainer.innerHTML = '';
            }
            
            // Reset character counter
            const charCount = document.getElementById('charCount');
            if (charCount) charCount.textContent = '0';
            
            // Redirect to gists page after 1.5 seconds
            setTimeout(() => {
                window.location.href = 'gist.html';
            }, 1500);
        }
        
    } catch (error) {
        console.error('Error creating gist:', error);
        showNotification('Failed to create gist. Please try again.', 'error');
    } finally {
        // Reset submit button
        submitBtn.disabled = false;
        submitBtn.innerHTML = `
            <svg class="feather" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path d="M22 2L11 13"></path>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
            Post Gist
        `;
    }
}

// Upload to Cloudinary (same function as in your app.js)
async function uploadToCloudinary(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', cloudinaryConfig.uploadPreset);
    formData.append('resource_type', 'auto');
    
    try {
        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/upload`,
            {
                method: 'POST',
                body: formData,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            }
        );
        
        if (!response.ok) {
            throw new Error(`Cloudinary error: ${response.statusText}`);
        }
        
        const data = await response.json();
        if (!data.secure_url) {
            throw new Error('Invalid response from Cloudinary');
        }
        return data.secure_url;
    } catch (error) {
        console.error('Cloudinary upload error:', error);
        throw error;
    }
}

// Create a new gist
async function createGist(content, mediaUrl = null, mediaType = null, duration = null) {
    if (!currentUser) {
        showNotification('Please login to create gists', 'error');
        return null;
    }
    
    try {
        const gistData = {
            content: content || '',
            mediaUrl: mediaUrl || null,
            mediaType: mediaType || null,
            duration: duration || null,
            likes: 0,
            comments: 0,
            authorId: currentUser.uid,
            authorAvatar: getRandomAvatar(),
            timestamp: serverTimestamp(),
            isAnonymous: true
        };
        
        const docRef = await addDoc(collection(db, 'gists'), gistData);
        return docRef.id;
    } catch (error) {
        console.error('Error creating gist:', error);
        throw error;
    }
}

// Initialize gist page (viewing gists)
function initGistPage() {
    const createGistBtn = document.getElementById('createGistBtn');
    const loadMoreBtn = document.getElementById('loadMoreGists');
    
    // Create Gist button
    if (createGistBtn) {
        createGistBtn.addEventListener('click', () => {
            window.location.href = 'create-gist.html';
        });
    }
    
    // Load More button
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
            loadGists(lastVisibleGist, 10);
        });
    }
    
    // Load initial gists
    loadGists();
    
    // Add animation styles for waveform
    addWaveformStyles();
}

// Load gists with pagination
async function loadGists(lastVisible = null, limitCount = 10) {
    const gistsContainer = document.getElementById('gistsContainer');
    const loadMoreBtn = document.getElementById('loadMoreGists');
    
    if (!gistsContainer || isLoading) return;
    
    isLoading = true;
    
    try {
        let q;
        if (lastVisible) {
            q = query(
                collection(db, 'gists'),
                orderBy('timestamp', 'desc'),
                startAfter(lastVisible),
                limit(limitCount)
            );
        } else {
            q = query(
                collection(db, 'gists'),
                orderBy('timestamp', 'desc'),
                limit(limitCount)
            );
        }
        
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            if (lastVisible === null) {
                gistsContainer.innerHTML = `
                    <div class="empty-state">
                        <svg class="feather" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <line x1="16" y1="13" x2="8" y2="13"></line>
                            <line x1="16" y1="17" x2="8" y2="17"></line>
                            <polyline points="10 9 9 9 8 9"></polyline>
                        </svg>
                        <h3 class="empty-title">No gists yet</h3>
                        <p class="empty-text">Be the first to share an anonymous post!</p>
                        <button class="create-gist-btn" onclick="window.location.href='create-gist.html'">
                            <svg class="feather" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                                <path d="M12 5v14"></path>
                                <path d="M5 12h14"></path>
                            </svg>
                            Create Gist
                        </button>
                    </div>
                `;
            }
            if (loadMoreBtn) loadMoreBtn.style.display = 'none';
            return;
        }
        
        const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
        lastVisibleGist = lastDoc;
        
        // Clear loading state if first load
        if (lastVisible === null) {
            gistsContainer.innerHTML = '';
        }
        
        querySnapshot.forEach((doc) => {
            const gist = { id: doc.id, ...doc.data() };
            if (!document.querySelector(`[data-gist-id="${gist.id}"]`)) {
                displayGist(gist);
            }
        });
        
        if (loadMoreBtn) {
            loadMoreBtn.style.display = 'block';
            
            // Update icon
            loadMoreBtn.innerHTML = `
                <svg class="feather" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <path d="M12 5v14"></path>
                    <path d="M5 12h14"></path>
                </svg>
                Load More
            `;
        }
        
    } catch (error) {
        console.error('Error loading gists:', error);
        if (lastVisible === null) {
            gistsContainer.innerHTML = `
                <div class="empty-state">
                    <svg class="feather" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <h3 class="empty-title">Error loading gists</h3>
                    <p class="empty-text">Please try again later.</p>
                </div>
            `;
        }
    } finally {
        isLoading = false;
    }
}

// Display a gist in the UI
function displayGist(gist) {
    const gistsContainer = document.getElementById('gistsContainer');
    if (!gistsContainer) return;
    
    const timeAgo = gist.timestamp ? formatTime(gist.timestamp) : 'Just now';
    
    let mediaContent = '';
    if (gist.mediaUrl) {
        if (gist.mediaType === 'image') {
            mediaContent = `
                <div class="gist-media">
                    <img src="${gist.mediaUrl}" alt="Gist image" class="gist-image">
                </div>
            `;
        } else if (gist.mediaType === 'audio') {
            mediaContent = `
                <div class="gist-media">
                    <div class="gist-voice-note" data-audio-url="${gist.mediaUrl}">
                        <button class="voice-play-btn">
                            <svg class="feather" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                                <polygon points="5 3 19 12 5 21 5 3"></polygon>
                            </svg>
                        </button>
                        <div class="voice-waveform">
                            <div class="wave-bar"></div>
                            <div class="wave-bar"></div>
                            <div class="wave-bar"></div>
                            <div class="wave-bar"></div>
                            <div class="wave-bar"></div>
                        </div>
                        <span class="voice-duration">${gist.duration ? formatDuration(gist.duration) : '0:00'}</span>
                    </div>
                </div>
            `;
        }
    }
    
    const gistElement = document.createElement('div');
    gistElement.className = 'gist-card';
    gistElement.dataset.gistId = gist.id;
    gistElement.innerHTML = `
        <div class="gist-header">
            <div class="gist-avatar-container">
                <img src="${gist.authorAvatar}" alt="Anonymous avatar" class="gist-avatar">
                <div class="gist-avatar-pointer"></div>
            </div>
            <div class="gist-info">
                <span class="gist-author">Anonymous</span>
                <span class="gist-time">${timeAgo}</span>
            </div>
        </div>
        
        <div class="gist-content">
            ${gist.content ? `<div class="gist-text">${escapeHtml(gist.content)}</div>` : ''}
            ${mediaContent}
        </div>
        
        <div class="gist-actions">
            <button class="gist-action-btn like-btn" data-gist-id="${gist.id}">
                <svg class="feather" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                </svg>
                <span class="action-count">${gist.likes || 0}</span>
            </button>
            
            <button class="gist-action-btn comment-btn" data-gist-id="${gist.id}">
                <svg class="feather" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                <span class="action-count">${gist.comments || 0}</span>
            </button>
            
            <button class="gist-action-btn share-btn" data-gist-id="${gist.id}">
                <svg class="feather" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <circle cx="18" cy="5" r="3"></circle>
                    <circle cx="6" cy="12" r="3"></circle>
                    <circle cx="18" cy="19" r="3"></circle>
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                </svg>
            </button>
        </div>
    `;
    
    // Add event listeners
    const likeBtn = gistElement.querySelector('.like-btn');
    const commentBtn = gistElement.querySelector('.comment-btn');
    const shareBtn = gistElement.querySelector('.share-btn');
    const voicePlayBtn = gistElement.querySelector('.voice-play-btn');
    
    if (likeBtn) {
        likeBtn.addEventListener('click', () => likeGist(gist.id, likeBtn));
    }
    
    if (commentBtn) {
        commentBtn.addEventListener('click', () => showComments(gist.id));
    }
    
    if (shareBtn) {
        shareBtn.addEventListener('click', () => shareGist(gist.id));
    }
    
    if (voicePlayBtn && gist.mediaType === 'audio') {
        voicePlayBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            playGistVoice(gist.mediaUrl, voicePlayBtn, gistElement.querySelector('.voice-waveform'));
        });
    }
    
    gistsContainer.appendChild(gistElement);
    
    // Initialize Feather icons in the new element
    if (typeof feather !== 'undefined') {
        feather.replace();
    }
}

// Like a gist
async function likeGist(gistId, button) {
    if (!currentUser) {
        showNotification('Please login to like gists', 'warning');
        return;
    }
    
    try {
        const gistRef = doc(db, 'gists', gistId);
        const gistSnap = await getDoc(gistRef);
        
        if (gistSnap.exists()) {
            const gistData = gistSnap.data();
            
            // Check if user already liked (you might want to store likes in a subcollection)
            // For simplicity, we'll just update the count directly
            const newLikes = (gistData.likes || 0) + 1;
            
            await updateDoc(gistRef, {
                likes: newLikes
            });
            
            button.classList.add('liked');
            const countSpan = button.querySelector('.action-count');
            if (countSpan) {
                countSpan.textContent = newLikes;
            }
            
            showNotification('Gist liked!', 'success');
        }
    } catch (error) {
        console.error('Error liking gist:', error);
        showNotification('Failed to like gist', 'error');
    }
}

// Show comments (placeholder)
function showComments(gistId) {
    showNotification('Comment system coming soon!', 'info');
}

// Share gist
function shareGist(gistId) {
    const url = `${window.location.origin}/gist.html?id=${gistId}`;
    if (navigator.share) {
        navigator.share({
            title: 'Anonymous Gist',
            text: 'Check out this anonymous gist!',
            url: url
        }).catch(console.error);
    } else {
        navigator.clipboard.writeText(url)
            .then(() => showNotification('Link copied to clipboard!', 'success'))
            .catch(() => showNotification('Failed to copy link', 'error'));
    }
}

// Play voice note
function playGistVoice(audioUrl, button, waveform) {
    if (!button) return;
    
    const audio = new Audio(audioUrl);
    const waveBars = waveform ? waveform.querySelectorAll('.wave-bar') : [];
    
    if (audio.paused) {
        audio.play();
        button.innerHTML = `
            <svg class="feather" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16"></rect>
                <rect x="14" y="4" width="4" height="16"></rect>
            </svg>
        `;
        animateWaveform(waveBars);
    } else {
        audio.pause();
        button.innerHTML = `
            <svg class="feather" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
        `;
        stopWaveformAnimation(waveBars);
    }
    
    audio.onended = () => {
        button.innerHTML = `
            <svg class="feather" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
        `;
        stopWaveformAnimation(waveBars);
    };
}

// Helper functions
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/\n/g, '<br>');
}

function formatDuration(seconds) {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatTime(timestamp) {
    if (!timestamp) return 'Just now';
    
    let date;
    try {
        if (timestamp.toDate) {
            date = timestamp.toDate();
        } else if (typeof timestamp === 'string') {
            date = new Date(timestamp);
        } else if (typeof timestamp === 'number') {
            date = new Date(timestamp);
        } else {
            return 'Just now';
        }
    } catch (error) {
        console.error('Error parsing timestamp:', error);
        return 'Just now';
    }
    
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
        return 'Just now';
    }
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `custom-notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="notification-icon ${getNotificationIcon(type)}"></i>
            <span>${message}</span>
        </div>
    `;
    
    // Add styles if not already added
    if (!document.getElementById('notification-styles')) {
        const styles = document.createElement('style');
        styles.id = 'notification-styles';
        styles.textContent = `
            .custom-notification {
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
                border-left: 4px solid;
            }
            .custom-notification.success {
                border-left-color: #28a745;
            }
            .custom-notification.error {
                border-left-color: #dc3545;
            }
            .custom-notification.info {
                border-left-color: #007bff;
            }
            .custom-notification.warning {
                border-left-color: #ffc107;
            }
            .notification-content {
                display: flex;
                align-items: center;
                gap: 10px;
                color: black;
            }
            .notification-icon {
                font-size: 18px;
            }
            .success .notification-icon {
                color: #28a745;
            }
            .error .notification-icon {
                color: #dc3545;
            }
            .info .notification-icon {
                color: #007bff;
            }
            .warning .notification-icon {
                color: #ffc107;
            }
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(styles);
    }
    
    document.body.appendChild(notification);
    
    // Auto remove after duration
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
    
    return notification;
}

function getNotificationIcon(type) {
    switch(type) {
        case 'success': return 'fas fa-check-circle';
        case 'error': return 'fas fa-exclamation-circle';
        case 'warning': return 'fas fa-exclamation-triangle';
        default: return 'fas fa-info-circle';
    }
}

