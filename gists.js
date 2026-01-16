// gist.js - FINAL FIXED VERSION

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

// Firebase configuration
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

// Cloudinary configuration
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

// Gist state
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
    console.log('Initializing create gist page');
    
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

    // Voice record button - CHANGED: Don't hide text box
    if (voiceRecordBtn) {
        voiceRecordBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            pendingMediaType = 'audio';
            resetMediaButtons();
            voiceRecordBtn.classList.add('active');
            await startVoiceRecording();
        });
    }

    // Both upload button
    if (bothUploadBtn && bothImageInput) {
        bothUploadBtn.addEventListener('click', (e) => {
            e.preventDefault();
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
                // Start voice recording after image selection
                setTimeout(() => {
                    startVoiceRecording();
                }, 100);
            }
        });
    }

    // Cancel button
    if (cancelBtn) {
        cancelBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (window.history.length > 1) {
                window.history.back();
            } else {
                window.location.href = 'gist.html';
            }
        });
    }

    // Cancel recording button
    if (cancelRecordingBtn) {
        cancelRecordingBtn.addEventListener('click', (e) => {
            e.preventDefault();
            cancelVoiceRecording();
        });
    }

    // Stop recording button
    if (stopRecordingBtn) {
        stopRecordingBtn.addEventListener('click', (e) => {
            e.preventDefault();
            stopVoiceRecording();
        });
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
    
    console.log('Create gist page initialized');
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
    
    let fileType = 'Image';
    if (file.type.startsWith('audio/')) {
        fileType = 'Voice Note';
    }
    
    attachmentsContainer.innerHTML = `
        <div class="attachment-preview">
            <div class="attachment-info">
                <span class="attachment-name">${fileType} ready</span>
            </div>
            <button type="button" class="attachment-remove" id="removeAttachmentBtn">
                <i class="fas fa-times"></i>
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

// Voice recording functions - FIXED: Text box stays visible
async function startVoiceRecording() {
    console.log('Starting voice recording...');
    
    try {
        // Show voice indicator but DON'T hide text input
        const voiceIndicator = document.getElementById('voiceRecordingIndicator');
        
        if (voiceIndicator) {
            voiceIndicator.style.display = 'flex';
        }
        
        // Get microphone access
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        
        recordingStartTime = Date.now();
        updateRecordingTimer();
        recordingTimer = setInterval(updateRecordingTimer, 1000);
        
        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };
        
        mediaRecorder.start(100);
        
        console.log('Voice recording started');
        
        // Stop recording after 30 seconds max
        setTimeout(() => {
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                stopVoiceRecording();
            }
        }, 30000);
        
    } catch (error) {
        console.error('Error starting recording:', error);
        showNotification('Could not access microphone. Please check permissions.', 'error');
        
        // Reset UI on error
        const voiceIndicator = document.getElementById('voiceRecordingIndicator');
        
        if (voiceIndicator) {
            voiceIndicator.style.display = 'none';
        }
        
        resetMediaButtons();
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
    
    console.log('Stopping voice recording...');
    
    clearInterval(recordingTimer);
    mediaRecorder.stop();
    
    // Stop all tracks
    mediaRecorder.stream.getTracks().forEach(track => track.stop());
    
    mediaRecorder.onstop = async () => {
        // Hide voice indicator
        const voiceIndicator = document.getElementById('voiceRecordingIndicator');
        
        if (voiceIndicator) {
            voiceIndicator.style.display = 'none';
        }
        
        const duration = Math.floor((Date.now() - recordingStartTime) / 1000);
        const audioBlob = new Blob(audioChunks, { type: 'audio/mp3' });
        
        console.log('Voice recorded:', { duration, size: audioBlob.size });
        
        // Show voice preview modal
        showVoicePreview(audioBlob, duration);
        
        mediaRecorder = null;
        audioChunks = [];
        recordingStartTime = null;
    };
}

function cancelVoiceRecording() {
    if (!mediaRecorder) return;
    
    console.log('Cancelling voice recording');
    
    clearInterval(recordingTimer);
    mediaRecorder.stop();
    
    if (mediaRecorder.stream) {
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
    
    // Hide voice indicator
    const voiceIndicator = document.getElementById('voiceRecordingIndicator');
    
    if (voiceIndicator) {
        voiceIndicator.style.display = 'none';
    }
    
    resetMediaButtons();
    
    mediaRecorder = null;
    audioChunks = [];
    recordingStartTime = null;
}

function showVoicePreview(audioBlob, duration) {
    console.log('Showing voice preview');
    
    const previewModal = document.getElementById('voicePreviewModal');
    const playPreviewBtn = document.getElementById('playPreviewBtn');
    const previewDuration = document.getElementById('previewDuration');
    const cancelPreviewBtn = document.getElementById('cancelPreviewBtn');
    const sendPreviewBtn = document.getElementById('sendPreviewBtn');
    
    if (!previewModal) {
        console.error('Voice preview modal not found');
        return;
    }
    
    previewModal.style.display = 'flex';
    if (previewDuration) {
        previewDuration.textContent = formatDuration(duration);
    }
    
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    
    playPreviewBtn.addEventListener('click', () => {
        if (audio.paused) {
            audio.play();
            playPreviewBtn.innerHTML = '<i class="fas fa-pause"></i>';
        } else {
            audio.pause();
            playPreviewBtn.innerHTML = '<i class="fas fa-play"></i>';
        }
    });
    
    audio.onended = () => {
        playPreviewBtn.innerHTML = '<i class="fas fa-play"></i>';
    };
    
    audio.onpause = () => {
        playPreviewBtn.innerHTML = '<i class="fas fa-play"></i>';
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
        
        // Create a file from the blob
        const voiceFile = new File([audioBlob], `voice-note-${Date.now()}.mp3`, { 
            type: 'audio/mp3'
        });
        
        showAttachmentPreview(voiceFile);
        previewModal.style.display = 'none';
        updateSubmitButton();
        
        console.log('Voice note saved for posting');
        showNotification('Voice note ready! You can add text and post.', 'success');
    });
}

// FIXED: Update submit button logic
function updateSubmitButton() {
    const submitBtn = document.getElementById('submitBtn');
    
    if (!submitBtn) return;
    
    const hasMedia = pendingImageFile || pendingAudioBlob;
    
    // Enable button if there's any media (voice or image)
    submitBtn.disabled = !hasMedia;
    
    console.log('Submit button:', { 
        hasImage: !!pendingImageFile, 
        hasAudio: !!pendingAudioBlob, 
        disabled: submitBtn.disabled 
    });
}

// Upload to Cloudinary
async function uploadAudioToCloudinary(audioBlob) {
    console.log('Uploading audio to Cloudinary...');
    
    const formData = new FormData();
    formData.append('file', audioBlob);
    formData.append('upload_preset', cloudinaryConfig.uploadPreset);
    formData.append('resource_type', 'auto');
    
    try {
        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/upload`,
            {
                method: 'POST',
                body: formData
            }
        );
        
        if (!response.ok) {
            throw new Error(`Upload failed: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Cloudinary upload successful:', data.secure_url);
        
        if (!data.secure_url) {
            throw new Error('No secure URL returned from Cloudinary');
        }
        
        return data.secure_url;
    } catch (error) {
        console.error('Cloudinary upload error:', error);
        throw error;
    }
}

async function uploadImageToCloudinary(file) {
    console.log('Uploading image to Cloudinary...');
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', cloudinaryConfig.uploadPreset);
    formData.append('resource_type', 'image');
    
    try {
        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/upload`,
            {
                method: 'POST',
                body: formData
            }
        );
        
        if (!response.ok) {
            throw new Error(`Upload failed: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Image upload successful:', data.secure_url);
        
        return data.secure_url;
    } catch (error) {
        console.error('Image upload error:', error);
        throw error;
    }
}

// Submit gist function - FIXED: Handle both image and audio
async function submitGist() {
    console.log('Submitting gist...');
    
    const submitBtn = document.getElementById('submitBtn');
    const gistContent = document.getElementById('gistContent');
    
    if (!currentUser) {
        showNotification('Please login to create gists', 'error');
        return;
    }
    
    // Disable submit button
    submitBtn.disabled = true;
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Posting...';
    
    try {
        const content = gistContent ? gistContent.value.trim() : '';
        let mediaUrl = null;
        let mediaType = null;
        let duration = null;
        let secondMediaUrl = null; // For when we have both image and audio
        
        console.log('Submitting:', { 
            content, 
            hasImage: !!pendingImageFile, 
            hasAudio: !!pendingAudioBlob,
            mediaType: pendingMediaType 
        });
        
        // Upload media if exists
        if (pendingImageFile || pendingAudioBlob) {
            showNotification('Uploading media...', 'info');
            
            if (pendingMediaType === 'both' && pendingImageFile && pendingAudioBlob) {
                console.log('Uploading both image and audio');
                // Upload image
                const imageUrl = await uploadImageToCloudinary(pendingImageFile);
                // Upload audio
                const audioUrl = await uploadAudioToCloudinary(pendingAudioBlob);
                
                // Store both URLs - we'll use a custom format
                mediaUrl = audioUrl; // Primary is audio
                secondMediaUrl = imageUrl; // Secondary is image
                mediaType = 'both'; // Special type for both
                duration = Math.floor((Date.now() - recordingStartTime) / 1000);
                
            } else if (pendingImageFile) {
                console.log('Uploading image only');
                mediaUrl = await uploadImageToCloudinary(pendingImageFile);
                mediaType = 'image';
                
            } else if (pendingAudioBlob) {
                console.log('Uploading audio only');
                mediaUrl = await uploadAudioToCloudinary(pendingAudioBlob);
                mediaType = 'audio';
                duration = Math.floor((Date.now() - recordingStartTime) / 1000);
            }
        }
        
        console.log('Creating gist with:', { content, mediaUrl, mediaType, duration, secondMediaUrl });
        
        // Create gist
        const gistId = await createGist(content, mediaUrl, mediaType, duration, secondMediaUrl);
        
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
            
            // Redirect after delay
            setTimeout(() => {
                window.location.href = 'gist.html';
            }, 1500);
        } else {
            showNotification('Failed to create gist', 'error');
        }
        
    } catch (error) {
        console.error('Error submitting gist:', error);
        showNotification('Failed to create gist: ' + error.message, 'error');
    } finally {
        // Reset submit button
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

// Create a new gist - UPDATED: Handle both media
async function createGist(content, mediaUrl = null, mediaType = null, duration = null, secondMediaUrl = null) {
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
            isAnonymous: true,
            createdAt: new Date().toISOString()
        };
        
        // Store second media URL if we have both
        if (mediaType === 'both' && secondMediaUrl) {
            gistData.secondMediaUrl = secondMediaUrl;
            gistData.mediaType = 'both'; // Override to indicate both types
        }
        
        console.log('Saving gist to Firestore:', gistData);
        
        const docRef = await addDoc(collection(db, 'gists'), gistData);
        console.log('Gist created with ID:', docRef.id);
        
        return docRef.id;
    } catch (error) {
        console.error('Error creating gist:', error);
        throw error;
    }
}

// Initialize gist page
function initGistPage() {
    console.log('Initializing gist page');
    
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
    
    console.log('Gist page initialized');
}

// Load gists
async function loadGists(lastVisible = null, limitCount = 10) {
    console.log('Loading gists...');
    
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
        console.log(`Loaded ${querySnapshot.size} gists`);
        
        if (querySnapshot.empty) {
            if (lastVisible === null) {
                gistsContainer.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-file-alt fa-3x" style="margin-bottom: 15px; color: #b3004b;"></i>
                        <h3 class="empty-title">No gists yet</h3>
                        <p class="empty-text">Be the first to share an anonymous post!</p>
                        <button class="create-gist-btn" onclick="window.location.href='create-gist.html'">
                            <i class="fas fa-plus"></i> Create Gist
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
            console.log('Gist data:', gist);
            if (!document.querySelector(`[data-gist-id="${gist.id}"]`)) {
                displayGist(gist);
            }
        });
        
        if (loadMoreBtn) {
            loadMoreBtn.style.display = 'block';
            loadMoreBtn.innerHTML = '<i class="fas fa-plus"></i> Load More';
        }
        
    } catch (error) {
        console.error('Error loading gists:', error);
        showNotification('Error loading gists: ' + error.message, 'error');
        
        if (lastVisible === null) {
            gistsContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle fa-3x" style="margin-bottom: 15px; color: #dc3545;"></i>
                    <h3 class="empty-title">Error loading gists</h3>
                    <p class="empty-text">Please try again later.</p>
                </div>
            `;
        }
    } finally {
        isLoading = false;
    }
}

// Display a gist - FIXED: Show both image and audio when both exist
function displayGist(gist) {
    const gistsContainer = document.getElementById('gistsContainer');
    if (!gistsContainer) return;
    
    const timeAgo = gist.timestamp ? formatTime(gist.timestamp) : 'Just now';
    
    let mediaContent = '';
    
    if (gist.mediaType === 'both' && gist.mediaUrl && gist.secondMediaUrl) {
        // Show both image and audio
        const duration = gist.duration ? formatDuration(gist.duration) : '0:00';
        mediaContent = `
            <div class="gist-media">
                <img src="${gist.secondMediaUrl}" alt="Gist image" class="gist-image" 
                     onerror="this.onerror=null; this.style.display='none';">
                <div class="gist-voice-note" style="margin-top: 10px;">
                    <button class="voice-play-btn" data-audio-url="${gist.mediaUrl}">
                        <i class="fas fa-play"></i>
                    </button>
                    <div class="voice-waveform">
                        <div class="wave-bar"></div>
                        <div class="wave-bar"></div>
                        <div class="wave-bar"></div>
                        <div class="wave-bar"></div>
                        <div class="wave-bar"></div>
                    </div>
                    <span class="voice-duration">${duration}</span>
                </div>
            </div>
        `;
    } else if (gist.mediaType === 'image' && gist.mediaUrl) {
        mediaContent = `
            <div class="gist-media">
                <img src="${gist.mediaUrl}" alt="Gist image" class="gist-image" 
                     onerror="this.onerror=null; this.style.display='none';">
            </div>
        `;
    } else if (gist.mediaType === 'audio' && gist.mediaUrl) {
        const duration = gist.duration ? formatDuration(gist.duration) : '0:00';
        mediaContent = `
            <div class="gist-media">
                <div class="gist-voice-note">
                    <button class="voice-play-btn" data-audio-url="${gist.mediaUrl}">
                        <i class="fas fa-play"></i>
                    </button>
                    <div class="voice-waveform">
                        <div class="wave-bar"></div>
                        <div class="wave-bar"></div>
                        <div class="wave-bar"></div>
                        <div class="wave-bar"></div>
                        <div class="wave-bar"></div>
                    </div>
                    <span class="voice-duration">${duration}</span>
                </div>
            </div>
        `;
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
                <i class="fas fa-heart"></i>
                <span class="action-count">${gist.likes || 0}</span>
            </button>
            
            <button class="gist-action-btn comment-btn" data-gist-id="${gist.id}">
                <i class="fas fa-comment"></i>
                <span class="action-count">${gist.comments || 0}</span>
            </button>
            
            <button class="gist-action-btn share-btn" data-gist-id="${gist.id}">
                <i class="fas fa-share"></i>
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
    
    if (voicePlayBtn && gist.mediaUrl && (gist.mediaType === 'audio' || gist.mediaType === 'both')) {
        voicePlayBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            playGistVoice(gist.mediaUrl, voicePlayBtn, gistElement.querySelector('.voice-waveform'));
        });
    }
    
    gistsContainer.appendChild(gistElement);
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
        showNotification('Failed to like gist: ' + error.message, 'error');
    }
}

// Show comments
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
        }).catch(err => {
            showNotification('Failed to share: ' + err.message, 'error');
        });
    } else {
        navigator.clipboard.writeText(url)
            .then(() => showNotification('Link copied to clipboard!', 'success'))
            .catch(err => showNotification('Failed to copy link: ' + err.message, 'error'));
    }
}

// Play voice note
function playGistVoice(audioUrl, button, waveform) {
    if (!button || !audioUrl) return;
    
    const audio = new Audio(audioUrl);
    const waveBars = waveform ? waveform.querySelectorAll('.wave-bar') : [];
    
    if (audio.paused) {
        audio.play();
        button.innerHTML = '<i class="fas fa-pause"></i>';
        
        // Animate waveform
        waveBars.forEach((bar, index) => {
            bar.style.animation = `waveform 1.2s ${index * 0.1}s infinite ease-in-out`;
        });
    } else {
        audio.pause();
        button.innerHTML = '<i class="fas fa-play"></i>';
        
        // Stop animation
        waveBars.forEach(bar => {
            bar.style.animation = 'none';
        });
    }
    
    audio.onended = () => {
        button.innerHTML = '<i class="fas fa-play"></i>';
        waveBars.forEach(bar => {
            bar.style.animation = 'none';
        });
    };
    
    audio.onpause = () => {
        button.innerHTML = '<i class="fas fa-play"></i>';
        waveBars.forEach(bar => {
            bar.style.animation = 'none';
        });
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


// Notification function with better mobile support
function showNotification(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    // Create simple notification
    const notification = document.createElement('div');
    notification.className = `gist-notification ${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        left: 20px;
        background: ${type === 'error' ? '#dc3545' : 
                    type === 'success' ? '#28a745' : 
                    type === 'warning' ? '#ffc107' : '#007bff'};
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: space-between;
        animation: slideIn 0.3s ease;
        font-family: 'Inter', sans-serif;
        font-size: 14px;
    `;
    
    // Add animation styles
    if (!document.getElementById('gist-notification-styles')) {
        const styles = document.createElement('style');
        styles.id = 'gist-notification-styles';
        styles.textContent = `
            @keyframes slideIn {
                from { transform: translateY(-20px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateY(0); opacity: 1; }
                to { transform: translateY(-20px); opacity: 0; }
            }
            .wave-bar {
                width: 3px;
                background: currentColor;
                border-radius: 2px;
            }
        `;
        document.head.appendChild(styles);
    }
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    else if (type === 'error') icon = '❌';
    else if (type === 'warning') icon = '⚠️';
    
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 16px;">${icon}</span>
            <span>${message}</span>
        </div>
        <button onclick="this.parentElement.remove()" style="background: none; border: none; color: white; font-size: 20px; cursor: pointer; padding: 0 5px;">
            ×
        </button>
    `;
    
    // Remove any existing notifications
    const existingNotifications = document.querySelectorAll('.gist-notification');
    existingNotifications.forEach(n => n.remove());
    
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