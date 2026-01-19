// gists.js - COMPLETE VERSION WITH WHATSAPP PREVIEWS - FIXED VERSION

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
    where,
    serverTimestamp,
    doc,
    getDoc,
    updateDoc,
    getDocs,
    runTransaction,
    arrayUnion,
    arrayRemove
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
let currentlyPlayingAudio = null;
let currentlyPlayingButton = null;

// Generate random Dicebear avatar URL
function getRandomAvatar() {
    const style = DICEBEAR_AVATARS[Math.floor(Math.random() * DICEBEAR_AVATARS.length)];
    const seed = Math.random().toString(36).substring(7);
    return `https://api.dicebear.com/7.x/${style}/svg?seed=${seed}&backgroundColor=b6e3f4,c0aede,d1d4f9&radius=50`;
}

// Generate share link for gist
async function generateGistLink(gistId) {
    try {
        const gistRef = doc(db, 'gists', gistId);
        const gistSnap = await getDoc(gistRef);
        
        if (!gistSnap.exists()) {
            throw new Error('Gist not found');
        }
        
        const gistData = gistSnap.data();
        
        // Generate a unique share ID if not exists
        let shareId = gistData.shareId;
        if (!shareId) {
            shareId = Math.random().toString(36).substring(2, 15);
            
            // Update gist with shareId
            await updateDoc(gistRef, {
                shareId: shareId,
                lastShared: serverTimestamp()
            });
            
            console.log('Generated share ID:', shareId);
        }
        
        // Create the shareable URL with cache busting
        const baseUrl = window.location.origin;
        const timestamp = Date.now();
        const shareUrl = `${baseUrl}/gist-preview.html?share=${shareId}&_=${timestamp}`;
        
        return {
            url: shareUrl,
            shareId: shareId,
            gistId: gistId
        };
    } catch (error) {
        console.error('Error generating link:', error);
        throw error;
    }
}

// Get gist by share ID
async function getGistByShareId(shareId) {
    try {
        console.log('Looking for gist with shareId:', shareId);
        
        // First try to find by shareId
        const q = query(
            collection(db, 'gists'),
            where('shareId', '==', shareId),
            limit(1)
        );
        
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
            const doc = querySnapshot.docs[0];
            const gistData = doc.data();
            console.log('Found gist by shareId:', doc.id);
            return {
                id: doc.id,
                ...gistData
            };
        }
        
        // If not found by shareId, try if shareId is actually a gist ID
        console.log('Not found by shareId, trying as gist ID:', shareId);
        try {
            const gistRef = doc(db, 'gists', shareId);
            const gistSnap = await getDoc(gistRef);
            
            if (gistSnap.exists()) {
                const gistData = gistSnap.data();
                console.log('Found gist by ID:', shareId);
                
                // Generate share ID if not exists
                if (!gistData.shareId) {
                    const newShareId = Math.random().toString(36).substring(2, 15);
                    await updateDoc(gistRef, {
                        shareId: newShareId,
                        lastShared: serverTimestamp()
                    });
                    gistData.shareId = newShareId;
                }
                
                return {
                    id: shareId,
                    ...gistData
                };
            }
        } catch (idError) {
            console.error('Error finding by ID:', idError);
        }
        
        console.log('Gist not found with shareId:', shareId);
        return null;
        
    } catch (error) {
        console.error('Error getting gist by share ID:', error);
        throw error;
    }
}

// Create WhatsApp preview URL with gist data
function createWhatsAppPreviewUrl(gistData, shareUrl) {
    // For WhatsApp, we need to create a message with the gist content
    let text = '';
    
    if (gistData.content) {
        text = `📝 *Anonymous Gist*\n\n"${gistData.content.substring(0, 200)}${gistData.content.length > 200 ? '...' : ''}"`;
    } else {
        text = `📝 *Anonymous Gist*`;
    }
    
    // Add media indicator if gist has image
    if (gistData.mediaType === 'image' && gistData.mediaUrl) {
        text += '\n\n🖼️ *Includes an image*';
    } else if (gistData.mediaType === 'both' && gistData.secondMediaUrl) {
        text += '\n\n🖼️ *Includes an image and voice note*';
    } else if (gistData.mediaType === 'audio' && gistData.mediaUrl) {
        text += '\n\n🎤 *Includes a voice note*';
    }
    
    text += `\n\n👉 Open to view: ${shareUrl}`;
    
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

// Create Telegram preview URL with gist data
function createTelegramPreviewUrl(gistData, shareUrl) {
    let text = '';
    
    if (gistData.content) {
        text = `📝 Anonymous Gist\n\n"${gistData.content.substring(0, 200)}${gistData.content.length > 200 ? '...' : ''}"`;
    } else {
        text = `📝 Anonymous Gist`;
    }
    
    // Add media indicator if gist has image
    if (gistData.mediaType === 'image' && gistData.mediaUrl) {
        text += '\n\n🖼️ Includes an image';
    } else if (gistData.mediaType === 'both' && gistData.secondMediaUrl) {
        text += '\n\n🖼️ Includes an image and voice note';
    } else if (gistData.mediaType === 'audio' && gistData.mediaUrl) {
        text += '\n\n🎤 Includes a voice note';
    }
    
    text += `\n\n👉 Open to view: ${shareUrl}`;
    
    return `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`;
}

// Initialize on DOM content loaded
document.addEventListener('DOMContentLoaded', function() {
    // Check which page we're on
    const currentPage = window.location.pathname.split('/').pop().split('.')[0];
    
    console.log('Current page:', currentPage);
    
    // Listen for auth state changes
    onAuthStateChanged(auth, (user) => {
        currentUser = user;
        
        if (currentPage === 'create-gist') {
            initCreateGistPage();
        } else if (currentPage === 'gist') {
            initGistPage();
        } else if (currentPage === 'gist-preview') {
            initGistPreviewPage();
        } else if (currentPage === 'gist-view') {
            initGistViewPage();
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

    // Voice record button
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

    document.getElementById('removeAttachmentBtn').addEventListener('click', () => {
        pendingImageFile = null;
        pendingAudioBlob = null;
        pendingMediaType = null;
        resetMediaButtons();
        attachmentsContainer.style.display = 'none';
        updateSubmitButton();
    });
}

async function startVoiceRecording() {
    console.log('Starting voice recording...');
    
    try {
        const voiceIndicator = document.getElementById('voiceRecordingIndicator');
        
        if (voiceIndicator) {
            voiceIndicator.style.display = 'flex';
        }
        
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
        
        setTimeout(() => {
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                stopVoiceRecording();
            }
        }, 30000);
        
    } catch (error) {
        console.error('Error starting recording:', error);
        showNotification('Could not access microphone. Please check permissions.', 'error');
        
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
    
    mediaRecorder.stream.getTracks().forEach(track => track.stop());
    
    mediaRecorder.onstop = async () => {
        const voiceIndicator = document.getElementById('voiceRecordingIndicator');
        
        if (voiceIndicator) {
            voiceIndicator.style.display = 'none';
        }
        
        const duration = Math.floor((Date.now() - recordingStartTime) / 1000);
        const audioBlob = new Blob(audioChunks, { type: 'audio/mp3' });
        
        console.log('Voice recorded:', { duration, size: audioBlob.size });
        
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
    const previewWaveform = document.getElementById('previewWaveform');
    
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
    currentlyPlayingAudio = audio;
    
    playPreviewBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (audio.paused) {
            audio.play();
            playPreviewBtn.innerHTML = '<i class="fas fa-pause"></i>';
            
            const waveBars = previewWaveform.querySelectorAll('.wave-bar');
            waveBars.forEach((bar, index) => {
                bar.style.animation = `waveform 1.2s ${index * 0.1}s infinite ease-in-out`;
            });
        } else {
            audio.pause();
            playPreviewBtn.innerHTML = '<i class="fas fa-play"></i>';
            
            const waveBars = previewWaveform.querySelectorAll('.wave-bar');
            waveBars.forEach(bar => {
                bar.style.animation = 'none';
            });
        }
    });
    
    audio.onended = () => {
        playPreviewBtn.innerHTML = '<i class="fas fa-play"></i>';
        const waveBars = previewWaveform.querySelectorAll('.wave-bar');
        waveBars.forEach(bar => {
            bar.style.animation = 'none';
        });
    };
    
    audio.onpause = () => {
        playPreviewBtn.innerHTML = '<i class="fas fa-play"></i>';
        const waveBars = previewWaveform.querySelectorAll('.wave-bar');
        waveBars.forEach(bar => {
            bar.style.animation = 'none';
        });
    };
    
    cancelPreviewBtn.addEventListener('click', (e) => {
        e.preventDefault();
        audio.pause();
        URL.revokeObjectURL(audioUrl);
        currentlyPlayingAudio = null;
        previewModal.style.display = 'none';
        resetMediaButtons();
    });
    
    sendPreviewBtn.addEventListener('click', (e) => {
        e.preventDefault();
        audio.pause();
        URL.revokeObjectURL(audioUrl);
        currentlyPlayingAudio = null;
        
        pendingAudioBlob = audioBlob;
        
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

function updateSubmitButton() {
    const submitBtn = document.getElementById('submitBtn');
    const gistContent = document.getElementById('gistContent');
    
    if (!submitBtn) return;
    
    const hasMedia = pendingImageFile || pendingAudioBlob;
    const hasText = gistContent && gistContent.value.trim().length > 0;
    
    // Enable button if there's either text OR media (or both)
    submitBtn.disabled = !(hasText || hasMedia);
}

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
    formData.append('folder', 'gist-images'); // Add folder for better organization
    
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

async function submitGist() {
    console.log('Submitting gist...');
    
    const submitBtn = document.getElementById('submitBtn');
    const gistContent = document.getElementById('gistContent');
    
    if (!currentUser) {
        showNotification('Please login to create gists', 'error');
        return;
    }
    
    submitBtn.disabled = true;
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Posting...';
    
    try {
        const content = gistContent ? gistContent.value.trim() : '';
        let mediaUrl = null;
        let mediaType = null;
        let duration = null;
        let secondMediaUrl = null;
        
        if (pendingImageFile || pendingAudioBlob) {
            showNotification('Uploading media...', 'info');
            
            if (pendingMediaType === 'both' && pendingImageFile && pendingAudioBlob) {
                console.log('Uploading both image and audio');
                const imageUrl = await uploadImageToCloudinary(pendingImageFile);
                const audioUrl = await uploadAudioToCloudinary(pendingAudioBlob);
                
                mediaUrl = audioUrl;
                secondMediaUrl = imageUrl;
                mediaType = 'both';
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
        
        const gistId = await createGist(content, mediaUrl, mediaType, duration, secondMediaUrl);
        
        if (gistId) {
            showNotification('Gist posted successfully!', 'success');
            
            if (gistContent) gistContent.value = '';
            if (pendingImageFile) pendingImageFile = null;
            if (pendingAudioBlob) pendingAudioBlob = null;
            pendingMediaType = null;
            
            resetMediaButtons();
            const attachmentsContainer = document.getElementById('attachmentsContainer');
            if (attachmentsContainer) {
                attachmentsContainer.style.display = 'none';
                attachmentsContainer.innerHTML = '';
            }
            
            const charCount = document.getElementById('charCount');
            if (charCount) charCount.textContent = '0';
            
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
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

async function createGist(content, mediaUrl = null, mediaType = null, duration = null, secondMediaUrl = null) {
    if (!currentUser) {
        showNotification('Please login to create gists', 'error');
        return null;
    }
    
    try {
        const shareId = Math.random().toString(36).substring(2, 15);
        
        const gistData = {
            content: content || '',
            mediaUrl: mediaUrl || null,
            mediaType: mediaType || null,
            duration: duration || null,
            likes: 0,
            comments: 0,
            reposts: 0,
            highlights: 0,
            authorId: currentUser.uid,
            authorAvatar: getRandomAvatar(),
            timestamp: serverTimestamp(),
            isAnonymous: true,
            createdAt: new Date().toISOString(),
            likedBy: [],
            highlightedBy: [],
            repostedBy: [],
            repostedFrom: null,
            originalPostId: null,
            containsVoiceNote: (mediaType === 'audio' || mediaType === 'both'),
            shareId: shareId,
            lastShared: null,
            viewCount: 0
        };
        
        if (mediaType === 'both' && secondMediaUrl) {
            gistData.secondMediaUrl = secondMediaUrl;
            gistData.mediaType = 'both';
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

function initGistPage() {
    console.log('Initializing gist page');
    
    const createGistBtn = document.getElementById('createGistBtn');
    const loadMoreBtn = document.getElementById('loadMoreGists');
    const gistsContainer = document.getElementById('gistsContainer');
    
    if (createGistBtn) {
        createGistBtn.addEventListener('click', () => {
            window.location.href = 'create-gist.html';
        });
    }
    
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
            loadGists(lastVisibleGist, 10);
        });
    }
    
    if (gistsContainer) {
        let pressTimer;
        let longPressTarget = null;
        
        gistsContainer.addEventListener('mousedown', (e) => {
            const gistCard = e.target.closest('.gist-card');
            if (gistCard) {
                longPressTarget = gistCard;
                pressTimer = setTimeout(() => {
                    showGistActionsModal(gistCard.dataset.gistId);
                    longPressTarget = null;
                }, 800);
            }
        });
        
        gistsContainer.addEventListener('mouseup', () => {
            clearTimeout(pressTimer);
        });
        
        gistsContainer.addEventListener('mouseleave', () => {
            clearTimeout(pressTimer);
        });
        
        gistsContainer.addEventListener('touchstart', (e) => {
            const gistCard = e.target.closest('.gist-card');
            if (gistCard) {
                longPressTarget = gistCard;
                pressTimer = setTimeout(() => {
                    showGistActionsModal(gistCard.dataset.gistId);
                    longPressTarget = null;
                }, 800);
            }
        });
        
        gistsContainer.addEventListener('touchend', () => {
            clearTimeout(pressTimer);
        });
        
        gistsContainer.addEventListener('touchmove', () => {
            clearTimeout(pressTimer);
        });
    }
    
    loadGists();
    
    console.log('Gist page initialized');
}

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

function displayGist(gist) {
    const gistsContainer = document.getElementById('gistsContainer');
    if (!gistsContainer) return;
    
    const timeAgo = gist.timestamp ? formatTime(gist.timestamp) : 'Just now';
    const isReposted = gist.repostedFrom || gist.originalPostId;
    const avatarContainerStyle = isReposted ? 'style="border-color:#b3004b;background-color: #b3004b20;"' : '';
    const repostIcon = isReposted ? '<div class="repost-icon"><i class="fas fa-retweet"></i></div>' : '';
    
    const containsVoiceNote = gist.containsVoiceNote || gist.mediaType === 'audio' || gist.mediaType === 'both';
    
    let mediaContent = '';
    
    if (gist.mediaType === 'both' && gist.mediaUrl && gist.secondMediaUrl) {
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
            <div class="gist-avatar-container" ${avatarContainerStyle}>
                <img src="${gist.authorAvatar}" alt="Anonymous avatar" class="gist-avatar">
                <div class="gist-avatar-pointer"></div>
                ${repostIcon}
            </div>
            <div class="gist-info">
                <span class="gist-author">Anonymous${isReposted ? ' (Reposted)' : ''}</span>
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
            
            <button class="gist-action-btn highlight-btn" data-gist-id="${gist.id}">
                <i class="fas fa-bookmark"></i>
                <span class="action-count">${gist.highlights || 0}</span>
            </button>
            
            <button class="gist-action-btn repost-btn" data-gist-id="${gist.id}" 
                    ${containsVoiceNote ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
                <i class="fas fa-retweet"></i>
                <span class="action-count">${gist.reposts || 0}</span>
            </button>
            
            <button class="gist-action-btn share-btn" data-gist-id="${gist.id}">
                <i class="fas fa-share"></i>
            </button>
        </div>
    `;
    
    const likeBtn = gistElement.querySelector('.like-btn');
    const commentBtn = gistElement.querySelector('.comment-btn');
    const highlightBtn = gistElement.querySelector('.highlight-btn');
    const repostBtn = gistElement.querySelector('.repost-btn');
    const shareBtn = gistElement.querySelector('.share-btn');
    const voicePlayBtn = gistElement.querySelector('.voice-play-btn');
    
    if (likeBtn) {
        likeBtn.addEventListener('click', () => likeGist(gist.id, likeBtn));
        if (currentUser && gist.likedBy && gist.likedBy.includes(currentUser.uid)) {
            likeBtn.classList.add('liked');
        }
    }
    
    if (commentBtn) {
        commentBtn.addEventListener('click', () => openCommentsModal(gist.id));
    }
    
    if (highlightBtn) {
        highlightBtn.addEventListener('click', () => highlightGist(gist.id, highlightBtn));
        if (currentUser && gist.highlightedBy && gist.highlightedBy.includes(currentUser.uid)) {
            highlightBtn.classList.add('highlighted');
        }
    }
    
    if (repostBtn) {
        if (!containsVoiceNote) {
            repostBtn.addEventListener('click', () => repostGist(gist.id, repostBtn));
        }
        if (currentUser && gist.repostedBy && gist.repostedBy.includes(currentUser.uid)) {
            repostBtn.classList.add('reposted');
        }
    }
    
    if (shareBtn) {
        shareBtn.addEventListener('click', () => shareGist(gist.id, shareBtn));
    }
    
    if (voicePlayBtn && gist.mediaUrl && (gist.mediaType === 'audio' || gist.mediaType === 'both')) {
        voicePlayBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            playGistVoice(gist.mediaUrl, voicePlayBtn, gistElement.querySelector('.voice-waveform'));
        });
    }
    
    gistsContainer.appendChild(gistElement);
}

function initGistPreviewPage() {
    console.log('Initializing gist preview page');
    
    const urlParams = new URLSearchParams(window.location.search);
    const shareId = urlParams.get('share');
    
    if (!shareId) {
        window.location.href = 'gist.html';
        return;
    }
    
    // Check if meta tags were already updated by inline script
    if (!document.getElementById('og-title').content.includes('Anonymous Gist:')) {
        // Meta tags not updated yet, update them now
        setupPreviewMetaTags(shareId);
    }
    
    loadGistForPreview(shareId);
}

async function setupPreviewMetaTags(shareId) {
    try {
        const gist = await getGistByShareId(shareId);
        
        if (!gist) {
            setDefaultMetaTags();
            return;
        }
        
        // Create dynamic title and description
        const title = gist.content ? 
            `Anonymous Gist: ${gist.content.substring(0, 60)}...` : 
            'Anonymous Gist';
        
        const description = gist.content ? 
            gist.content.substring(0, 200) : 
            'Check out this anonymous gist shared with you!';
        
        // Get image URL
        let imageUrl = null;
        let isImage = false;
        
        if (gist.mediaType === 'image' && gist.mediaUrl) {
            imageUrl = gist.mediaUrl;
            isImage = true;
        } else if (gist.mediaType === 'both' && gist.secondMediaUrl) {
            imageUrl = gist.secondMediaUrl;
            isImage = true;
        } else {
            // Fallback to avatar
            imageUrl = gist.authorAvatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=anonymous&backgroundColor=b6e3f4&radius=50';
        }
        
        console.log('Setting meta tags with image URL:', imageUrl);
        
        // Update meta tags
        updateMetaTag('og:title', title);
        updateMetaTag('og:description', description);
        updateMetaTag('og:image', imageUrl);
        updateMetaTag('og:url', window.location.href);
        updateMetaTag('og:image:width', '1200');
        updateMetaTag('og:image:height', '630');
        updateMetaTag('og:image:type', isImage ? 'image/jpeg' : 'image/svg+xml');
        
        updateMetaTag('twitter:card', isImage ? 'summary_large_image' : 'summary');
        updateMetaTag('twitter:title', title);
        updateMetaTag('twitter:description', description);
        updateMetaTag('twitter:image', imageUrl);
        
        updateMetaTag('description', description);
        
        // Update page title
        document.title = title;
        
        console.log('Meta tags updated for preview:', { 
            title, 
            description, 
            imageUrl,
            isImage 
        });
        
    } catch (error) {
        console.error('Error setting meta tags:', error);
        setDefaultMetaTags();
    }
}

function updateMetaTag(property, content) {
    let meta = document.querySelector(`meta[property="${property}"]`) || 
               document.querySelector(`meta[name="${property}"]`);
    
    if (!meta) {
        meta = document.createElement('meta');
        if (property.startsWith('og:')) {
            meta.setAttribute('property', property);
        } else if (property.startsWith('twitter:')) {
            meta.setAttribute('name', property);
        } else {
            meta.setAttribute('name', property);
        }
        document.head.appendChild(meta);
    }
    meta.setAttribute('content', content);
}

function setDefaultMetaTags() {
    const defaultAvatar = 'https://api.dicebear.com/7.x/avataaars/svg?seed=anonymous&backgroundColor=b6e3f4&radius=50';
    document.title = 'Anonymous Gist';
    
    updateMetaTag('og:title', 'Anonymous Gist');
    updateMetaTag('og:description', 'Check out this anonymous gist shared with you!');
    updateMetaTag('og:image', defaultAvatar);
    updateMetaTag('og:url', window.location.href);
    updateMetaTag('og:type', 'website');
    updateMetaTag('og:site_name', 'Anonymous Gists');
    updateMetaTag('og:image:width', '1200');
    updateMetaTag('og:image:height', '630');
    updateMetaTag('og:image:type', 'image/svg+xml');
    
    updateMetaTag('twitter:card', 'summary');
    updateMetaTag('twitter:title', 'Anonymous Gist');
    updateMetaTag('twitter:description', 'Check out this anonymous gist shared with you!');
    updateMetaTag('twitter:image', defaultAvatar);
    
    updateMetaTag('description', 'Check out this anonymous gist shared with you!');
}

async function loadGistForPreview(shareId) {
    const container = document.getElementById('gistPreviewContainer');
    
    if (!container) return;
    
    container.innerHTML = `
        <div class="loading-state">
            <div class="loading-spinner">
                <i class="fas fa-spinner fa-spin fa-2x"></i>
            </div>
            <p>Loading gist preview...</p>
        </div>
    `;
    
    try {
        const gist = await getGistByShareId(shareId);
        
        if (!gist) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-circle fa-3x"></i>
                    <h3 class="empty-title">Gist Not Found</h3>
                    <p class="empty-text">This gist has been deleted or the link is invalid.</p>
                    <button class="view-app-btn" onclick="window.location.href='gist.html'">
                        <i class="fas fa-home"></i> Go to Home
                    </button>
                </div>
            `;
            return;
        }
        
        // Update view count
        await updateViewCount(gist.id);
        
        // Cache gist data for future crawler visits
        try {
            localStorage.setItem(`gist_${shareId}`, JSON.stringify(gist));
        } catch (e) {
            console.log('Could not cache gist data:', e);
        }
        
        // Display the gist preview
        displayGistPreview(gist, container);
        
        // For users (not crawlers), redirect to main view after delay
        if (!isCrawler()) {
            setTimeout(() => {
                window.location.href = `gist-view.html?share=${shareId}`;
            }, 3000);
        }
        
    } catch (error) {
        console.error('Error loading gist:', error);
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle fa-3x"></i>
                <h3 class="empty-title">Error Loading Gist</h3>
                <p class="empty-text">Please try again later.</p>
                <button class="view-app-btn" onclick="window.location.href='gist.html'">
                    <i class="fas fa-home"></i> Go to Home
                </button>
            </div>
        `;
    }
}

async function updateViewCount(gistId) {
    try {
        const gistRef = doc(db, 'gists', gistId);
        await runTransaction(db, async (transaction) => {
            const gistDoc = await transaction.get(gistRef);
            if (!gistDoc.exists()) {
                return;
            }
            
            const currentViews = gistDoc.data().viewCount || 0;
            transaction.update(gistRef, {
                viewCount: currentViews + 1
            });
        });
    } catch (error) {
        console.error('Error updating view count:', error);
    }
}

function isCrawler() {
    const userAgent = navigator.userAgent.toLowerCase();
    const crawlers = [
        'whatsapp', 'telegram', 'facebook', 'twitter', 'slack',
        'discord', 'linkedin', 'pinterest', 'reddit', 'tumblr',
        'googlebot', 'bingbot', 'slurp', 'duckduckbot', 'baiduspider',
        'yandexbot', 'sogou', 'exabot', 'facebot', 'ia_archiver'
    ];
    
    return crawlers.some(crawler => userAgent.includes(crawler));
}

function displayGistPreview(gist, container) {
    const timeAgo = gist.timestamp ? formatTime(gist.timestamp) : 'Just now';
    const isReposted = gist.repostedFrom || gist.originalPostId;
    
    let mediaContent = '';
    
    // Check if gist has an image
    if ((gist.mediaType === 'image' && gist.mediaUrl) || 
        (gist.mediaType === 'both' && gist.secondMediaUrl)) {
        const imageUrl = gist.mediaType === 'both' ? gist.secondMediaUrl : gist.mediaUrl;
        mediaContent = `
            <div class="preview-media">
                <img src="${imageUrl}" alt="Gist image" 
                     style="width: 100%; max-height: 400px; object-fit: cover; border-radius: 10px; margin-top: 15px;">
                ${gist.mediaType === 'both' ? `
                    <div class="voice-indicator" style="display: flex; align-items: center; gap: 10px; margin-top: 10px; padding: 10px; background: #f5f5f5; border-radius: 10px;">
                        <i class="fas fa-microphone" style="color: #b3004b;"></i>
                        <span>Voice message included</span>
                    </div>
                ` : ''}
            </div>
        `;
    } else if (gist.mediaType === 'audio' && gist.mediaUrl) {
        mediaContent = `
            <div class="preview-media">
                <div class="voice-indicator" style="display: flex; align-items: center; gap: 10px; margin-top: 15px; padding: 15px; background: #f5f5f5; border-radius: 10px;">
                    <i class="fas fa-microphone fa-2x" style="color: #b3004b;"></i>
                    <div>
                        <div style="font-weight: bold;">Voice Message</div>
                        <div style="color: #666; font-size: 14px;">Click to listen in app</div>
                    </div>
                </div>
            </div>
        `;
    }
    
    const previewHTML = `
        <div class="gist-preview-card" style="max-width: 800px; margin: 0 auto; padding: 20px;">
            <div class="preview-header" style="display: flex; align-items: center; margin-bottom: 20px;">
                <div style="position: relative; margin-right: 15px;">
                    <img src="${gist.authorAvatar}" alt="Anonymous" 
                         style="width: 60px; height: 60px; border-radius: 50%; border: 3px solid #b3004b;">
                    ${isReposted ? '<div style="position: absolute; top: -5px; right: -5px; background: #b3004b; color: white; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px;"><i class="fas fa-retweet"></i></div>' : ''}
                </div>
                <div>
                    <div style="font-weight: bold; font-size: 18px; color: #333;">
                        Anonymous${isReposted ? ' (Reposted)' : ''}
                    </div>
                    <div style="color: #666; font-size: 14px; margin-top: 5px;">
                        ${timeAgo}
                    </div>
                </div>
            </div>
            
            ${gist.content ? `
                <div class="preview-content" style="font-size: 16px; line-height: 1.6; color: #333; margin-bottom: 20px;">
                    ${escapeHtml(gist.content)}
                </div>
            ` : ''}
            
            ${mediaContent}
            
            <div class="preview-stats" style="display: flex; justify-content: space-around; margin-top: 25px; padding-top: 20px; border-top: 1px solid #eee;">
                <div style="text-align: center;">
                    <div style="font-size: 20px; font-weight: bold; color: #b3004b;">
                        ${gist.likes || 0}
                    </div>
                    <div style="font-size: 14px; color: #666; margin-top: 5px;">Likes</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 20px; font-weight: bold; color: #b3004b;">
                        ${gist.comments || 0}
                    </div>
                    <div style="font-size: 14px; color: #666; margin-top: 5px;">Comments</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 20px; font-weight: bold; color: #b3004b;">
                        ${gist.reposts || 0}
                    </div>
                    <div style="font-size: 14px; color: #666; margin-top: 5px;">Shares</div>
                </div>
            </div>
            
            <div class="preview-footer" style="text-align: center; margin-top: 25px; padding-top: 20px; border-top: 1px solid #eee;">
                <div style="color: #b3004b; font-weight: bold; font-size: 18px; margin-bottom: 10px;">
                    <i class="fas fa-file-alt"></i> Anonymous Gists
                </div>
                <div style="color: #666; font-size: 14px; margin-bottom: 20px;">
                    Share anonymous thoughts with friends
                </div>
                ${!isCrawler() ? `
                    <div style="font-size: 12px; color: #888;">
                        Opening in app...
                    </div>
                ` : ''}
            </div>
        </div>
    `;
    
    container.innerHTML = previewHTML;
    
    if (!isCrawler()) {
        const redirectNotice = document.createElement('div');
        redirectNotice.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            right: 20px;
            background: #b3004b;
            color: white;
            padding: 15px;
            border-radius: 10px;
            text-align: center;
            font-size: 14px;
            z-index: 1000;
            box-shadow: 0 5px 20px rgba(179, 0, 75, 0.3);
        `;
        redirectNotice.innerHTML = `
            <div>Opening gist in app...</div>
            <div style="font-size: 12px; opacity: 0.9; margin-top: 5px;">
                <i class="fas fa-spinner fa-spin"></i> Redirecting in 3 seconds
            </div>
        `;
        document.body.appendChild(redirectNotice);
    }
}

function initGistViewPage() {
    console.log('Initializing gist view page');
    
    const urlParams = new URLSearchParams(window.location.search);
    const shareId = urlParams.get('share');
    
    if (!shareId) {
        window.location.href = 'gist.html';
        return;
    }
    
    loadGistForView(shareId);
}

async function loadGistForView(shareId) {
    const container = document.getElementById('gistViewContainer');
    
    if (!container) return;
    
    container.innerHTML = `
        <div class="loading-state">
            <div class="loading-spinner">
                <i class="fas fa-spinner fa-spin fa-2x"></i>
            </div>
            <p>Loading gist...</p>
        </div>
    `;
    
    try {
        const gist = await getGistByShareId(shareId);
        
        if (!gist) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-circle fa-3x"></i>
                    <h3 class="empty-title">Gist Not Found</h3>
                    <p class="empty-text">This gist has been deleted or the link is invalid.</p>
                    <button class="view-app-btn" onclick="window.location.href='gist.html'">
                        <i class="fas fa-home"></i> Go to Home
                    </button>
                </div>
            `;
            return;
        }
        
        displayGistView(gist, container);
        
    } catch (error) {
        console.error('Error loading gist:', error);
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle fa-3x"></i>
                <h3 class="empty-title">Error Loading Gist</h3>
                <p class="empty-text">Please try again later.</p>
                <button class="view-app-btn" onclick="window.location.href='gist.html'">
                    <i class="fas fa-home"></i> Go to Home
                </button>
            </div>
        `;
    }
}

function displayGistView(gist, container) {
    const timeAgo = gist.timestamp ? formatTime(gist.timestamp) : 'Just now';
    const isReposted = gist.repostedFrom || gist.originalPostId;
    
    let mediaContent = '';
    
    if (gist.mediaType === 'both' && gist.mediaUrl && gist.secondMediaUrl) {
        const duration = gist.duration ? formatDuration(gist.duration) : '0:00';
        mediaContent = `
            <div class="gist-media">
                <img src="${gist.secondMediaUrl}" alt="Gist image" class="gist-image" 
                     style="max-width: 100%; border-radius: 10px; margin-top: 15px;">
                <div class="gist-voice-note" style="margin-top: 15px;">
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
                     style="max-width: 100%; border-radius: 10px; margin-top: 15px;">
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
    
    const viewHTML = `
        <div class="gist-card-view">
            <div class="gist-header" style="display: flex; align-items: center; margin-bottom: 20px;">
                <div class="gist-avatar-container" style="position: relative; margin-right: 15px;">
                    <img src="${gist.authorAvatar}" alt="Anonymous avatar" 
                         style="width: 60px; height: 60px; border-radius: 50%; border: 3px solid #b3004b;">
                    ${isReposted ? '<div style="position: absolute; top: -5px; right: -5px; background: #b3004b; color: white; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px;"><i class="fas fa-retweet"></i></div>' : ''}
                </div>
                <div class="gist-info">
                    <div class="gist-author" style="font-weight: bold; font-size: 18px; color: #333;">
                        Anonymous${isReposted ? ' (Reposted)' : ''}
                    </div>
                    <div class="gist-time" style="color: #666; font-size: 14px; margin-top: 5px;">
                        ${timeAgo}
                    </div>
                </div>
            </div>
            
            <div class="gist-content">
                ${gist.content ? `
                    <div class="gist-text" style="font-size: 16px; line-height: 1.6; color: #333; margin-bottom: 20px;">
                        ${escapeHtml(gist.content)}
                    </div>
                ` : ''}
                ${mediaContent}
            </div>
            
            <div class="gist-stats" style="display: flex; justify-content: space-around; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                <div class="stat-item" style="text-align: center;">
                    <div class="stat-count" style="font-size: 20px; font-weight: bold; color: #b3004b;">
                        ${gist.likes || 0}
                    </div>
                    <div class="stat-label" style="font-size: 14px; color: #666; margin-top: 5px;">
                        Likes
                    </div>
                </div>
                <div class="stat-item" style="text-align: center;">
                    <div class="stat-count" style="font-size: 20px; font-weight: bold; color: #b3004b;">
                        ${gist.comments || 0}
                    </div>
                    <div class="stat-label" style="font-size: 14px; color: #666; margin-top: 5px;">
                        Comments
                    </div>
                </div>
                <div class="stat-item" style="text-align: center;">
                    <div class="stat-count" style="font-size: 20px; font-weight: bold; color: #b3004b;">
                        ${gist.reposts || 0}
                    </div>
                    <div class="stat-label" style="font-size: 14px; color: #666; margin-top: 5px;">
                        Shares
                    </div>
                </div>
            </div>
            
            <div class="view-actions" style="margin-top: 30px; text-align: center;">
                <button class="view-app-btn" onclick="window.location.href='gist.html'"
                        style="background: #b3004b; color: white; border: none; padding: 12px 30px; 
                               border-radius: 25px; font-size: 16px; cursor: pointer; font-weight: bold;">
                    <i class="fas fa-rocket"></i> Open in App
                </button>
                <p style="color: #666; margin-top: 15px; font-size: 14px;">
                    Share anonymous gists with your friends!
                </p>
            </div>
        </div>
    `;
    
    container.innerHTML = viewHTML;
    
    const voicePlayBtn = container.querySelector('.voice-play-btn');
    if (voicePlayBtn && gist.mediaUrl && (gist.mediaType === 'audio' || gist.mediaType === 'both')) {
        voicePlayBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            playGistVoice(gist.mediaUrl, voicePlayBtn, container.querySelector('.voice-waveform'));
        });
    }
}

async function shareGist(gistId, button = null) {
    try {
        showNotification('Generating share link...', 'info');
        
        const shareInfo = await generateGistLink(gistId);
        const shareUrl = shareInfo.url;
        
        console.log('Share URL:', shareUrl);
        
        const gistRef = doc(db, 'gists', gistId);
        const gistSnap = await getDoc(gistRef);
        
        if (!gistSnap.exists()) {
            throw new Error('Gist not found');
        }
        
        const gistData = gistSnap.data();
        
        // Create better share text that includes image indication
        let shareText = '';
        if (gistData.content) {
            shareText = `📝 *Anonymous Gist*\n\n"${gistData.content.substring(0, 100)}${gistData.content.length > 100 ? '...' : ''}"`;
        } else {
            shareText = `📝 *Anonymous Gist*`;
        }
        
        // Add media indicator
        if (gistData.mediaType === 'image' && gistData.mediaUrl) {
            shareText += '\n\n🖼️ *Includes an image*';
        } else if (gistData.mediaType === 'both' && gistData.secondMediaUrl) {
            shareText += '\n\n🖼️ *Includes an image and voice note*';
        } else if (gistData.mediaType === 'audio' && gistData.mediaUrl) {
            shareText += '\n\n🎤 *Includes a voice note*';
        }
        
        shareText += `\n\n👉 Open to view: ${shareUrl}`;
        
        // Try Web Share API first
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Anonymous Gist',
                    text: shareText,
                    url: shareUrl
                });
                showNotification('Shared successfully!', 'success');
                return;
            } catch (shareError) {
                console.log('Web Share cancelled or failed:', shareError);
            }
        }
        
        // Show share modal with direct WhatsApp/Telegram buttons
        showShareModal(shareUrl, gistId, gistData, shareText);
        
    } catch (error) {
        console.error('Error sharing gist:', error);
        showNotification('Failed to share: ' + error.message, 'error');
    }
}

function showShareModal(shareUrl, gistId, gistData, shareText) {
    let modal = document.getElementById('shareModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'shareModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 400px; border-radius: 20px;">
                <div class="modal-header">
                    <h3>Share Gist</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="share-preview" style="margin-bottom: 20px; padding: 15px; background: #f9f9f9; border-radius: 10px;">
                        <div style="display: flex; align-items: center; margin-bottom: 10px;">
                            <img src="${gistData.authorAvatar || getRandomAvatar()}" 
                                 style="width: 40px; height: 40px; border-radius: 50%; margin-right: 10px; border: 2px solid #b3004b;">
                            <div>
                                <div style="font-weight: bold;">Anonymous Gist</div>
                                <div style="font-size: 12px; color: #666;">Shared via Anonymous Gists</div>
                            </div>
                        </div>
                        ${gistData.content ? `
                            <div style="font-size: 14px; color: #333; margin: 10px 0;">
                                ${gistData.content.substring(0, 80)}${gistData.content.length > 80 ? '...' : ''}
                            </div>
                        ` : ''}
                        ${(gistData.mediaType === 'image' || gistData.mediaType === 'both') ? `
                            <div style="font-size: 12px; color: #b3004b; margin-top: 5px;">
                                <i class="fas fa-image"></i> Contains image
                            </div>
                        ` : ''}
                        ${(gistData.mediaType === 'audio' || gistData.mediaType === 'both') ? `
                            <div style="font-size: 12px; color: #b3004b; margin-top: 5px;">
                                <i class="fas fa-microphone"></i> Contains voice note
                            </div>
                        ` : ''}
                    </div>
                    
                    <div class="share-url-container" style="margin-bottom: 20px;">
                        <input type="text" id="shareUrlInput" readonly 
                               style="width: 100%; padding: 12px; border: 1px solid #ddd; 
                                      border-radius: 10px; font-size: 14px; margin-bottom: 10px;">
                        <button id="copyUrlBtn" 
                                style="width: 100%; padding: 12px; background: #b3004b; 
                                       color: white; border: none; border-radius: 10px; 
                                       cursor: pointer; font-size: 16px;">
                            <i class="fas fa-copy"></i> Copy Link
                        </button>
                    </div>
                    
                    <div class="share-platforms" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 20px;">
                        <button class="platform-btn whatsapp-btn" data-platform="whatsapp">
                            <i class="fab fa-whatsapp"></i> WhatsApp
                        </button>
                        <button class="platform-btn telegram-btn" data-platform="telegram">
                            <i class="fab fa-telegram"></i> Telegram
                        </button>
                        <button class="platform-btn" data-platform="copy">
                            <i class="fas fa-copy"></i> Copy Text
                        </button>
                        <button class="platform-btn" data-platform="more">
                            <i class="fas fa-share-alt"></i> More Options
                        </button>
                    </div>
                    
                    <button id="closeShareBtn" 
                            style="width: 100%; padding: 12px; margin-top: 10px; 
                                   background: #f5f5f5; color: #333; border: none; 
                                   border-radius: 10px; cursor: pointer; font-size: 16px;">
                        Close
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        const styles = document.createElement('style');
        styles.textContent += `
            #shareModal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.5);
                display: none;
                justify-content: center;
                align-items: center;
                z-index: 10002;
            }
            .platform-btn {
                padding: 15px 10px;
                border: none;
                border-radius: 10px;
                color: white;
                cursor: pointer;
                font-size: 14px;
                font-weight: 600;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 8px;
                transition: transform 0.3s;
            }
            .platform-btn:hover {
                transform: translateY(-2px);
            }
            .platform-btn i {
                font-size: 24px;
            }
            .whatsapp-btn {
                background: #25D366;
            }
            .telegram-btn {
                background: #0088cc;
            }
            .platform-btn[data-platform="copy"] {
                background: #6c757d;
            }
            .platform-btn[data-platform="more"] {
                background: #b3004b;
            }
        `;
        document.head.appendChild(styles);
    }
    
    const urlInput = modal.querySelector('#shareUrlInput');
    if (urlInput) {
        urlInput.value = shareUrl;
    }
    
    modal.style.display = 'flex';
    
    const closeBtn = modal.querySelector('.modal-close');
    const closeShareBtn = modal.querySelector('#closeShareBtn');
    const copyUrlBtn = modal.querySelector('#copyUrlBtn');
    const platformBtns = modal.querySelectorAll('.platform-btn');
    
    const closeModal = () => {
        modal.style.display = 'none';
    };
    
    closeBtn.onclick = closeModal;
    closeShareBtn.onclick = closeModal;
    
    copyUrlBtn.onclick = async () => {
        try {
            await navigator.clipboard.writeText(shareUrl);
            showNotification('Link copied to clipboard!', 'success');
            closeModal();
        } catch (error) {
            console.error('Copy failed:', error);
            showNotification('Failed to copy link', 'error');
        }
    };
    
    platformBtns.forEach(btn => {
        btn.onclick = () => {
            const platform = btn.dataset.platform;
            if (platform === 'whatsapp') {
                const whatsappUrl = createWhatsAppPreviewUrl(gistData, shareUrl);
                window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
                closeModal();
            } else if (platform === 'telegram') {
                const telegramUrl = createTelegramPreviewUrl(gistData, shareUrl);
                window.open(telegramUrl, '_blank', 'noopener,noreferrer');
                closeModal();
            } else if (platform === 'copy') {
                navigator.clipboard.writeText(shareText)
                    .then(() => showNotification('Text copied! Paste in any app.', 'success'))
                    .catch(() => showNotification('Failed to copy text', 'error'));
                closeModal();
            } else if (platform === 'more') {
                if (navigator.share) {
                    navigator.share({
                        title: 'Anonymous Gist',
                        text: shareText,
                        url: shareUrl
                    }).catch(() => {
                        // Fallback to clipboard
                        navigator.clipboard.writeText(shareText + ' ' + shareUrl);
                        showNotification('Link copied! Share it anywhere.', 'success');
                    });
                } else {
                    navigator.clipboard.writeText(shareText + ' ' + shareUrl);
                    showNotification('Link copied! Share it anywhere.', 'success');
                }
                closeModal();
            }
        };
    });
    
    modal.onclick = (e) => {
        if (e.target === modal) {
            closeModal();
        }
    };
}

function showGistActionsModal(gistId) {
    checkIfGistHasVoiceNote(gistId).then(hasVoiceNote => {
        if (hasVoiceNote) {
            showNotification('Cannot repost gists with voice notes', 'warning');
            return;
        }
        
        let modal = document.getElementById('gistActionsModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'gistActionsModal';
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 300px; border-radius: 20px;">
                    <div class="modal-header">
                        <h3>Gist Options</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <button class="modal-action-btn" id="repostActionBtn">
                            <i class="fas fa-retweet"></i> Repost
                        </button>
                        <button class="modal-action-btn" id="highlightActionBtn">
                            <i class="fas fa-bookmark"></i> Highlight
                        </button>
                        <button class="modal-action-btn" id="cancelActionBtn">
                            Cancel
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            
            const styles = document.createElement('style');
            styles.textContent = `
                #gistActionsModal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-color: rgba(0, 0, 0, 0.5);
                    display: none;
                    justify-content: center;
                    align-items: center;
                    z-index: 10000;
                }
                .modal-action-btn {
                    padding: 15px;
                    border: none;
                    border-radius: 10px;
                    background: #f5f5f5;
                    color: #333;
                    font-size: 16px;
                    cursor: pointer;
                    text-align: left;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    transition: background-color 0.3s;
                }
                .modal-action-btn:hover {
                    background: #e0e0e0;
                }
            `;
            document.head.appendChild(styles);
        }
        
        modal.style.display = 'flex';
        
        const repostBtn = document.getElementById('repostActionBtn');
        const highlightBtn = document.getElementById('highlightActionBtn');
        const cancelBtn = document.getElementById('cancelActionBtn');
        const closeBtn = modal.querySelector('.modal-close');
        
        const closeModal = () => {
            modal.style.display = 'none';
        };
        
        repostBtn.onclick = () => {
            closeModal();
            repostGist(gistId);
        };
        
        highlightBtn.onclick = () => {
            closeModal();
            const highlightBtn = document.querySelector(`[data-gist-id="${gistId}"] .highlight-btn`);
            if (highlightBtn) {
                highlightGist(gistId, highlightBtn);
            }
        };
        
        cancelBtn.onclick = closeModal;
        closeBtn.onclick = closeModal;
        
        modal.onclick = (e) => {
            if (e.target === modal) {
                closeModal();
            }
        };
    }).catch(error => {
        console.error('Error checking voice note:', error);
        showNotification('Error checking gist', 'error');
    });
}

async function checkIfGistHasVoiceNote(gistId) {
    try {
        const gistRef = doc(db, 'gists', gistId);
        const gistSnap = await getDoc(gistRef);
        
        if (!gistSnap.exists()) {
            return false;
        }
        
        const gistData = gistSnap.data();
        
        return gistData.containsVoiceNote || 
               gistData.mediaType === 'audio' || 
               gistData.mediaType === 'both';
        
    } catch (error) {
        console.error('Error checking voice note:', error);
        return false;
    }
}

function openCommentsModal(gistId) {
    let modal = document.getElementById('commentsModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'commentsModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px; height: 70vh; display: flex; flex-direction: column;">
                <div class="modal-header">
                    <h3>Comments</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="comments-list" style="flex: 1; overflow-y: auto; padding: 20px;">
                    <div class="loading-comments">Loading comments...</div>
                </div>
                <div class="comment-input-container" style="padding: 20px; border-top: 1px solid #eee;">
                    <form id="commentForm" style="display: flex; gap: 10px;">
                        <input type="text" id="commentInput" placeholder="Add a comment..." 
                               style="flex: 1; padding: 12px; border: 1px solid #ddd; border-radius: 20px; font-size: 14px;">
                        <button type="submit" id="commentSubmitBtn" 
                                style="padding: 12px 20px; background: #b3004b; color: white; border: none; border-radius: 20px; cursor: pointer;">
                            Post
                        </button>
                    </form>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    modal.style.display = 'flex';
    modal.dataset.currentGist = gistId;
    
    loadComments(gistId);
    
    const closeBtn = modal.querySelector('.modal-close');
    const commentForm = document.getElementById('commentForm');
    const commentInput = document.getElementById('commentInput');
    const commentSubmitBtn = document.getElementById('commentSubmitBtn');
    
    const closeModal = () => {
        modal.style.display = 'none';
        commentForm.reset();
    };
    
    closeBtn.onclick = closeModal;
    
    commentForm.onsubmit = async (e) => {
        e.preventDefault();
        const commentText = commentInput.value.trim();
        if (!commentText) return;
        
        if (!currentUser) {
            showNotification('Please login to comment', 'warning');
            return;
        }
        
        try {
            commentSubmitBtn.disabled = true;
            commentSubmitBtn.innerHTML = 'Posting...';
            
            await postComment(gistId, commentText);
            
            commentInput.value = '';
            await loadComments(gistId);
            
            const commentBtn = document.querySelector(`[data-gist-id="${gistId}"] .comment-btn .action-count`);
            if (commentBtn) {
                const currentCount = parseInt(commentBtn.textContent) || 0;
                commentBtn.textContent = currentCount + 1;
            }
            
        } catch (error) {
            console.error('Error posting comment:', error);
            showNotification('Failed to post comment: ' + error.message, 'error');
        } finally {
            commentSubmitBtn.disabled = false;
            commentSubmitBtn.innerHTML = 'Post';
        }
    };
    
    modal.onclick = (e) => {
        if (e.target === modal) {
            closeModal();
        }
    };
}

async function loadComments(gistId) {
    const modal = document.getElementById('commentsModal');
    if (!modal) return;
    
    const commentsList = modal.querySelector('.comments-list');
    if (!commentsList) return;
    
    commentsList.innerHTML = '<div class="loading-comments">Loading comments...</div>';
    
    try {
        const gistRef = doc(db, 'gists', gistId);
        const gistSnap = await getDoc(gistRef);
        
        if (!gistSnap.exists()) {
            commentsList.innerHTML = '<div class="loading-comments">Gist not found</div>';
            return;
        }
        
        const commentsQuery = query(
            collection(db, 'gists', gistId, 'comments'),
            orderBy('timestamp', 'desc')
        );
        
        const commentsSnap = await getDocs(commentsQuery);
        
        if (commentsSnap.empty) {
            commentsList.innerHTML = '<div class="loading-comments">No comments yet. Be the first!</div>';
            return;
        }
        
        commentsList.innerHTML = '';
        
        commentsSnap.forEach((doc) => {
            const comment = doc.data();
            const commentElement = document.createElement('div');
            commentElement.className = 'comment-item';
            commentElement.innerHTML = `
                <img src="${comment.authorAvatar || getRandomAvatar()}" alt="Avatar" class="comment-avatar">
                <div class="comment-content">
                    <div class="comment-author">Anonymous</div>
                    <div class="comment-text">${escapeHtml(comment.content)}</div>
                    <div class="comment-time">${formatTime(comment.timestamp)}</div>
                </div>
            `;
            commentsList.appendChild(commentElement);
        });
        
    } catch (error) {
        console.error('Error loading comments:', error);
        commentsList.innerHTML = '<div class="loading-comments">Error loading comments</div>';
    }
}

async function postComment(gistId, content) {
    if (!currentUser) {
        throw new Error('User not logged in');
    }
    
    try {
        const commentData = {
            content: content,
            authorId: currentUser.uid,
            authorAvatar: getRandomAvatar(),
            timestamp: serverTimestamp(),
            createdAt: new Date().toISOString()
        };
        
        await addDoc(collection(db, 'gists', gistId, 'comments'), commentData);
        
        const gistRef = doc(db, 'gists', gistId);
        await runTransaction(db, async (transaction) => {
            const gistDoc = await transaction.get(gistRef);
            if (!gistDoc.exists()) {
                throw new Error('Gist not found');
            }
            
            const currentComments = gistDoc.data().comments || 0;
            transaction.update(gistRef, {
                comments: currentComments + 1
            });
        });
        
        console.log('Comment posted successfully');
        showNotification('Comment posted!', 'success');
        
    } catch (error) {
        console.error('Error posting comment:', error);
        throw error;
    }
}

async function likeGist(gistId, button) {
    if (!currentUser) {
        showNotification('Please login to like gists', 'warning');
        return;
    }
    
    try {
        const gistRef = doc(db, 'gists', gistId);
        
        await runTransaction(db, async (transaction) => {
            const gistDoc = await transaction.get(gistRef);
            if (!gistDoc.exists()) {
                throw new Error('Gist not found');
            }
            
            const gistData = gistDoc.data();
            const likedBy = gistData.likedBy || [];
            const isLiked = likedBy.includes(currentUser.uid);
            
            if (isLiked) {
                transaction.update(gistRef, {
                    likes: (gistData.likes || 1) - 1,
                    likedBy: arrayRemove(currentUser.uid)
                });
                button.classList.remove('liked');
            } else {
                transaction.update(gistRef, {
                    likes: (gistData.likes || 0) + 1,
                    likedBy: arrayUnion(currentUser.uid)
                });
                button.classList.add('liked');
            }
            
            const newLikes = isLiked ? (gistData.likes || 1) - 1 : (gistData.likes || 0) + 1;
            const countSpan = button.querySelector('.action-count');
            if (countSpan) {
                countSpan.textContent = newLikes;
            }
            
            showNotification(isLiked ? 'Gist unliked!' : 'Gist liked!', 'success');
        });
        
    } catch (error) {
        console.error('Error liking gist:', error);
        showNotification('Failed to like gist: ' + error.message, 'error');
    }
}

async function highlightGist(gistId, button) {
    if (!currentUser) {
        showNotification('Please login to highlight gists', 'warning');
        return;
    }
    
    try {
        const gistRef = doc(db, 'gists', gistId);
        
        await runTransaction(db, async (transaction) => {
            const gistDoc = await transaction.get(gistRef);
            if (!gistDoc.exists()) {
                throw new Error('Gist not found');
            }
            
            const gistData = gistDoc.data();
            const highlightedBy = gistData.highlightedBy || [];
            const isHighlighted = highlightedBy.includes(currentUser.uid);
            
            if (isHighlighted) {
                transaction.update(gistRef, {
                    highlights: (gistData.highlights || 1) - 1,
                    highlightedBy: arrayRemove(currentUser.uid)
                });
                button.classList.remove('highlighted');
            } else {
                transaction.update(gistRef, {
                    highlights: (gistData.highlights || 0) + 1,
                    highlightedBy: arrayUnion(currentUser.uid)
                });
                button.classList.add('highlighted');
            }
            
            const newHighlights = isHighlighted ? (gistData.highlights || 1) - 1 : (gistData.highlights || 0) + 1;
            const countSpan = button.querySelector('.action-count');
            if (countSpan) {
                countSpan.textContent = newHighlights;
            }
            
            showNotification(isHighlighted ? 'Removed from highlights!' : 'Added to highlights!', 'success');
        });
        
    } catch (error) {
        console.error('Error highlighting gist:', error);
        showNotification('Failed to highlight gist: ' + error.message, 'error');
    }
}

async function repostGist(gistId, button = null) {
    if (!currentUser) {
        showNotification('Please login to repost gists', 'warning');
        return;
    }
    
    try {
        const gistRef = doc(db, 'gists', gistId);
        const gistSnap = await getDoc(gistRef);
        
        if (!gistSnap.exists()) {
            throw new Error('Gist not found');
        }
        
        const originalGist = gistSnap.data();
        
        const hasVoiceNote = originalGist.containsVoiceNote || 
                            originalGist.mediaType === 'audio' || 
                            originalGist.mediaType === 'both';
        
        if (hasVoiceNote) {
            showNotification('Cannot repost gists with voice notes', 'warning');
            return;
        }
        
        const repostedBy = originalGist.repostedBy || [];
        const isReposted = repostedBy.includes(currentUser.uid);
        
        if (isReposted) {
            showNotification('You already reposted this gist!', 'warning');
            return;
        }
        
        showNotification('Reposting...', 'info');
        
        const repostData = {
            content: originalGist.content || '',
            mediaUrl: originalGist.mediaUrl || null,
            mediaType: originalGist.mediaType || null,
            duration: originalGist.duration || null,
            secondMediaUrl: originalGist.secondMediaUrl || null,
            likes: 0,
            comments: 0,
            reposts: 0,
            highlights: 0,
            authorId: currentUser.uid,
            authorAvatar: getRandomAvatar(),
            timestamp: serverTimestamp(),
            isAnonymous: true,
            createdAt: new Date().toISOString(),
            likedBy: [],
            highlightedBy: [],
            repostedBy: [],
            repostedFrom: originalGist.repostedFrom || gistId,
            originalPostId: originalGist.originalPostId || gistId,
            containsVoiceNote: false
        };
        
        const repostRef = await addDoc(collection(db, 'gists'), repostData);
        
        await runTransaction(db, async (transaction) => {
            const originalDoc = await transaction.get(gistRef);
            if (!originalDoc.exists()) {
                throw new Error('Original gist not found');
            }
            
            const originalData = originalDoc.data();
            transaction.update(gistRef, {
                reposts: (originalData.reposts || 0) + 1,
                repostedBy: arrayUnion(currentUser.uid)
            });
        });
        
        if (button) {
            button.classList.add('reposted');
            const countSpan = button.querySelector('.action-count');
            if (countSpan) {
                const currentCount = parseInt(countSpan.textContent) || 0;
                countSpan.textContent = currentCount + 1;
            }
        }
        
        showNotification('Gist reposted!', 'success');
        
        setTimeout(() => {
            const gistsContainer = document.getElementById('gistsContainer');
            if (gistsContainer && gistsContainer.innerHTML) {
                loadGists(null, 10);
            }
        }, 1000);
        
    } catch (error) {
        console.error('Error reposting gist:', error);
        showNotification('Failed to repost gist: ' + error.message, 'error');
    }
}

function playGistVoice(audioUrl, button, waveform) {
    if (!button || !audioUrl) return;
    
    if (currentlyPlayingAudio && currentlyPlayingButton && currentlyPlayingButton !== button) {
        currentlyPlayingAudio.pause();
        currentlyPlayingButton.innerHTML = '<i class="fas fa-play"></i>';
        const otherWaveform = currentlyPlayingButton.closest('.gist-voice-note').querySelector('.voice-waveform');
        if (otherWaveform) {
            const otherBars = otherWaveform.querySelectorAll('.wave-bar');
            otherBars.forEach(bar => {
                bar.style.animation = 'none';
            });
        }
    }
    
    let audio;
    if (currentlyPlayingAudio && currentlyPlayingButton === button) {
        audio = currentlyPlayingAudio;
    } else {
        audio = new Audio(audioUrl);
    }
    
    const waveBars = waveform ? waveform.querySelectorAll('.wave-bar') : [];
    
    if (audio.paused) {
        audio.play();
        button.innerHTML = '<i class="fas fa-pause"></i>';
        currentlyPlayingAudio = audio;
        currentlyPlayingButton = button;
        
        waveBars.forEach((bar, index) => {
            bar.style.animation = `waveform 1.2s ${index * 0.1}s infinite ease-in-out`;
        });
    } else {
        audio.pause();
        button.innerHTML = '<i class="fas fa-play"></i>';
        
        waveBars.forEach(bar => {
            bar.style.animation = 'none';
        });
    }
    
    audio.onended = () => {
        button.innerHTML = '<i class="fas fa-play"></i>';
        waveBars.forEach(bar => {
            bar.style.animation = 'none';
        });
        currentlyPlayingAudio = null;
        currentlyPlayingButton = null;
    };
    
    audio.onpause = () => {
        if (currentlyPlayingButton === button) {
            button.innerHTML = '<i class="fas fa-play"></i>';
            waveBars.forEach(bar => {
                bar.style.animation = 'none';
            });
        }
    };
}

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
            @keyframes waveform {
                0%, 100% { transform: scaleY(0.3); }
                50% { transform: scaleY(1); }
            }
            .wave-bar {
                width: 3px;
                background: currentColor;
                border-radius: 2px;
                height: 20px;
                margin: 0 2px;
            }
            .repost-icon {
                position: absolute;
                top: -5px;
                right: -5px;
                background: #b3004b;
                color: white;
                width: 20px;
                height: 20px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 10px;
                z-index: 1;
            }
            .liked {
                color: #e0245e !important;
            }
            .highlighted {
                color: #ffc107 !important;
            }
            .reposted {
                color: #b3004b !important;
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
    
    const existingNotifications = document.querySelectorAll('.gist-notification');
    existingNotifications.forEach(n => n.remove());
    
    document.body.appendChild(notification);
    
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

async function generateShareIdsForAllGists() {
    try {
        showNotification('Generating share links for all gists...', 'info');
        
        const querySnapshot = await getDocs(collection(db, 'gists'));
        
        const promises = [];
        querySnapshot.forEach((doc) => {
            const gistData = doc.data();
            if (!gistData.shareId) {
                const shareId = Math.random().toString(36).substring(2, 15);
                promises.push(
                    updateDoc(doc.ref, {
                        shareId: shareId,
                        lastShared: serverTimestamp()
                    })
                );
            }
        });
        
        await Promise.all(promises);
        console.log(`Generated share IDs for ${promises.length} gists`);
        showNotification(`Generated share links for ${promises.length} gists`, 'success');
        
    } catch (error) {
        console.error('Error generating share IDs:', error);
        showNotification('Error generating share links', 'error');
    }
}

// To generate share IDs for all existing gists, run this once in browser console:
// generateShareIdsForAllGists()