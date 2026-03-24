// notification.js - Complete file with nice notification sounds and comment reply functionality
// Fixed version - No Firebase indexes required

// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    doc, 
    getDoc,
    updateDoc,
    deleteDoc,
    query, 
    where, 
    getDocs,
    addDoc,
    onSnapshot,
    serverTimestamp,
    writeBatch,
    increment,
    arrayUnion,
    arrayRemove
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyC9jF-ocy6HjsVzWVVlAyXW-4aIFgA79-A",
    authDomain: "crypto-6517d.firebaseapp.com",
    projectId: "crypto-6517d",
    storageBucket: "crypto-6517d.firebasestorage.app",
    messagingSenderId: "60263975159",
    appId: "1:60263975159:web:bd53dcaad86d6ed9592bf2"
  };

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Global variables
let currentUser = null;
let unsubscribeNotifications = null;
let checkIntervals = [];
let dismissedNotifications = new Set();
let viewedPosts = new Set();
let unreadCount = 0;
let lastNotificationTime = 0;
let notificationShown = false;
let currentCommentPostId = null;
let currentCommentId = null;
let currentReplyToUserId = null;
let processedLikes = new Set(); // Track processed likes to prevent duplicates
let processedComments = new Set(); // Track processed comments to prevent duplicates

// Stream tracking variables (no indexes needed)
let processedStreamComments = new Set();
let lastStreamLikeCounts = new Map(); // Track last known like counts for streams

// Cache for notifications to avoid multiple queries
let notificationsCache = [];
let lastCacheUpdate = 0;
const CACHE_DURATION = 30000; // 30 seconds

// ==================== NOTIFICATION SOUNDS SYSTEM ====================

// Create notification sounds using Web Audio API for better compatibility
class NotificationSoundManager {
    constructor() {
        this.audioContext = null;
        this.soundsEnabled = true;
        this.soundVolume = 0.5; // 50% volume
        this.lastPlayed = 0;
        this.minPlayInterval = 1000; // Minimum 1 second between sounds
        
        // Try to load user preference
        this.loadUserPreferences();
        
        // Initialize audio context on user interaction (required by browsers)
        this.setupAudioContext();
    }
    
    setupAudioContext() {
        // Audio context must be created after user interaction
        document.addEventListener('click', () => {
            if (!this.audioContext) {
                try {
                    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                } catch (e) {
                    console.log('Web Audio API not supported');
                }
            }
        }, { once: true });
    }
    
    loadUserPreferences() {
        try {
            const savedPrefs = localStorage.getItem('notificationSoundPrefs');
            if (savedPrefs) {
                const prefs = JSON.parse(savedPrefs);
                this.soundsEnabled = prefs.enabled !== false;
                this.soundVolume = prefs.volume || 0.5;
            }
        } catch (e) {
            console.error('Error loading sound preferences:', e);
        }
    }
    
    saveUserPreferences() {
        try {
            localStorage.setItem('notificationSoundPrefs', JSON.stringify({
                enabled: this.soundsEnabled,
                volume: this.soundVolume
            }));
        } catch (e) {
            console.error('Error saving sound preferences:', e);
        }
    }
    
    toggleSounds() {
        this.soundsEnabled = !this.soundsEnabled;
        this.saveUserPreferences();
        return this.soundsEnabled;
    }
    
    setVolume(volume) {
        this.soundVolume = Math.max(0, Math.min(1, volume));
        this.saveUserPreferences();
    }
    
    // Play a gentle notification sound (soft bell)
    playSoftBell() {
        this.playSound('softBell');
    }
    
    // Play a gentle chime sound
    playGentleChime() {
        this.playSound('gentleChime');
    }
    
    // Play a soft ping sound
    playSoftPing() {
        this.playSound('softPing');
    }
    
    // Play a subtle pop sound
    playSubtlePop() {
        this.playSound('subtlePop');
    }
    
    // Play sound based on notification type
    playNotificationSound(type) {
        if (!this.soundsEnabled) return;
        
        // Rate limiting - don't play sounds too frequently
        const now = Date.now();
        if (now - this.lastPlayed < this.minPlayInterval) return;
        this.lastPlayed = now;
        
        switch(type) {
            case 'message':
            case 'group_message':
                this.playSoftPing(); // Soft ping for messages
                break;
            case 'like':
            case 'stream_like':
                this.playSubtlePop(); // Subtle pop for likes
                break;
            case 'comment':
            case 'stream_comment':
                this.playGentleChime(); // Gentle chime for comments
                break;
            case 'comment_reply':
                this.playSoftPing(); // Soft ping for comment replies
                break;
            case 'post':
                this.playGentleChime(); // Gentle chime for posts
                break;
            case 'group_invite':
                this.playSoftBell(); // Soft bell for invites
                break;
            default:
                this.playSoftBell(); // Default sound
        }
    }
    
    // Main method to play sounds using Web Audio API
    playSound(soundType) {
        if (!this.soundsEnabled) return;
        if (!this.audioContext) {
            // Try to create audio context if not exists
            try {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {
                console.log('Web Audio API not supported');
                return;
            }
        }
        
        // Resume audio context if suspended
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        
        try {
            switch(soundType) {
                case 'softBell':
                    this.createSoftBellSound();
                    break;
                case 'gentleChime':
                    this.createGentleChimeSound();
                    break;
                case 'softPing':
                    this.createSoftPingSound();
                    break;
                case 'subtlePop':
                    this.createSubtlePopSound();
                    break;
            }
        } catch (e) {
            console.error('Error playing sound:', e);
        }
    }
    
    // Create soft bell sound
    createSoftBellSound() {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, this.audioContext.currentTime); // A5
        oscillator.frequency.exponentialRampToValueAtTime(440, this.audioContext.currentTime + 0.5); // A4
        
        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(this.soundVolume * 0.3, this.audioContext.currentTime + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.8);
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + 0.8);
    }
    
    // Create gentle chime sound
    createGentleChimeSound() {
        const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
        
        notes.forEach((freq, index) => {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.type = 'sine';
            oscillator.frequency.value = freq;
            
            const startTime = this.audioContext.currentTime + (index * 0.1);
            
            gainNode.gain.setValueAtTime(0, startTime);
            gainNode.gain.linearRampToValueAtTime(this.soundVolume * 0.2, startTime + 0.02);
            gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.4);
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.start(startTime);
            oscillator.stop(startTime + 0.4);
        });
    }
    
    // Create soft ping sound
    createSoftPingSound() {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(659.25, this.audioContext.currentTime); // E5
        oscillator.frequency.exponentialRampToValueAtTime(523.25, this.audioContext.currentTime + 0.2); // C5
        
        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(this.soundVolume * 0.25, this.audioContext.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + 0.3);
    }
    
    // Create subtle pop sound
    createSubtlePopSound() {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(330, this.audioContext.currentTime); // E4
        oscillator.frequency.exponentialRampToValueAtTime(220, this.audioContext.currentTime + 0.1); // A3
        
        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(this.soundVolume * 0.2, this.audioContext.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.15);
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + 0.15);
    }
}

// Create global sound manager instance
const soundManager = new NotificationSoundManager();

// ==================== END NOTIFICATION SOUNDS SYSTEM ====================

// Initialize notification system
function initNotificationSystem() {
    // Load dismissed notifications and viewed posts
    loadDismissedNotifications();
    
    // Wait for auth state
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            loadViewedPosts();
            loadProcessedItems();
            loadStreamData();
            
            setupNotificationListener();
            setupNotificationCreators();
            updateNotificationBadge();
            
            // Add sound control button to UI
            addSoundControlButton();
            
            // Setup reply modal for comment replies
            setupReplyModal();
            
            // If on notification page, load notifications
            if (window.location.pathname.includes('notification.html')) {
                loadNotificationsForPage();
                setupMarkAllReadButton();
                addSoundSettingsToPage();
            }
            
            // Setup dropdown notifications if notification bell exists
            setupDropdownNotifications();
        } else {
            console.log('User not authenticated');
            currentUser = null;
            updateNotificationBadge(0);
            cleanupListeners();
            
            // If on notification page, show login message
            if (window.location.pathname.includes('notification.html')) {
                showLoginMessage();
            }
        }
    });
}

// Load stream data from localStorage (no indexes needed)
function loadStreamData() {
    if (!currentUser) return;
    try {
        const storedStreamComments = localStorage.getItem(`stream_comments_${currentUser.uid}`);
        if (storedStreamComments) {
            processedStreamComments = new Set(JSON.parse(storedStreamComments));
        }
        
        const storedLikeCounts = localStorage.getItem(`stream_like_counts_${currentUser.uid}`);
        if (storedLikeCounts) {
            lastStreamLikeCounts = new Map(JSON.parse(storedLikeCounts));
        }
    } catch (error) {
        console.error('Error loading stream data:', error);
    }
}

// Save stream data to localStorage
function saveStreamData() {
    if (!currentUser) return;
    try {
        localStorage.setItem(`stream_comments_${currentUser.uid}`, JSON.stringify([...processedStreamComments]));
        localStorage.setItem(`stream_like_counts_${currentUser.uid}`, JSON.stringify([...lastStreamLikeCounts]));
    } catch (error) {
        console.error('Error saving stream data:', error);
    }
}

// Load processed items from localStorage
function loadProcessedItems() {
    if (!currentUser) return;
    
    try {
        const storedLikes = localStorage.getItem(`processedLikes_${currentUser.uid}`);
        if (storedLikes) {
            processedLikes = new Set(JSON.parse(storedLikes));
        }
        
        const storedComments = localStorage.getItem(`processedComments_${currentUser.uid}`);
        if (storedComments) {
            processedComments = new Set(JSON.parse(storedComments));
        }
    } catch (error) {
        console.error('Error loading processed items:', error);
    }
}

// Save processed items to localStorage
function saveProcessedItems() {
    if (!currentUser) return;
    
    try {
        // Keep only last 100 items to prevent localStorage from getting too big
        const limitedLikes = Array.from(processedLikes).slice(-100);
        const limitedComments = Array.from(processedComments).slice(-100);
        
        localStorage.setItem(`processedLikes_${currentUser.uid}`, JSON.stringify(limitedLikes));
        localStorage.setItem(`processedComments_${currentUser.uid}`, JSON.stringify(limitedComments));
    } catch (error) {
        console.error('Error saving processed items:', error);
    }
}

// ==================== STREAM NOTIFICATION FUNCTIONS (No indexes needed) ====================

// Check for new stream likes - uses the likes field in stream document (no subcollection)
async function checkForNewStreamLikes() {
    if (!currentUser) return;
    
    try {
        // Get all streams by current user
        const streamsQuery = query(
            collection(db, 'streams'),
            where('authorId', '==', currentUser.uid),
            where('isActive', '==', true)
        );
        
        const streamsSnap = await getDocs(streamsQuery);
        
        for (const streamDoc of streamsSnap.docs) {
            const streamId = streamDoc.id;
            const streamData = streamDoc.data();
            const currentLikeCount = streamData.likes || 0;
            const lastLikeCount = lastStreamLikeCounts.get(streamId) || 0;
            
            // If like count increased
            if (currentLikeCount > lastLikeCount) {
                const streamPreview = streamData.headline ? (streamData.headline.length > 30 ? streamData.headline.substring(0, 30) + '...' : streamData.headline) : 'video';
                
                // Create notification (no complex query that needs index)
                await addDoc(collection(db, 'notifications'), {
                    type: 'stream_like',
                    title: 'New Like on Your Video',
                    message: `Someone liked your video: "${streamPreview}"`,
                    relatedId: streamId,
                    streamId: streamId,
                    streamPreview: streamPreview,
                    userId: currentUser.uid,
                    timestamp: serverTimestamp(),
                    read: false
                });
                
                console.log(`Created stream like notification for ${streamId}`);
            }
            
            // Update the stored count
            lastStreamLikeCounts.set(streamId, currentLikeCount);
        }
        
        saveStreamData();
        
    } catch (error) {
        console.error('Error checking stream likes:', error);
    }
}

// Check for new stream comments - uses comments subcollection (no complex queries)
async function checkForNewStreamComments() {
    if (!currentUser) return;
    
    try {
        // Get all streams by current user
        const streamsQuery = query(
            collection(db, 'streams'),
            where('authorId', '==', currentUser.uid),
            where('isActive', '==', true)
        );
        
        const streamsSnap = await getDocs(streamsQuery);
        
        for (const streamDoc of streamsSnap.docs) {
            const streamId = streamDoc.id;
            const streamData = streamDoc.data();
            
            // Get all comments for this stream
            const commentsQuery = collection(db, 'streams', streamId, 'comments');
            const commentsSnap = await getDocs(commentsQuery);
            
            for (const commentDoc of commentsSnap.docs) {
                const commentData = commentDoc.data();
                const commenterId = commentData.userId;
                const commentId = commentDoc.id;
                
                // Skip if comment is from current user
                if (commenterId === currentUser.uid) continue;
                
                const commentKey = `stream_${streamId}_${commentId}`;
                
                // Check if we've already processed this comment
                if (processedStreamComments.has(commentKey)) continue;
                
                // Get commenter data
                const commenterRef = doc(db, 'users', commenterId);
                const commenterSnap = await getDoc(commenterRef);
                const commenterName = commenterSnap.exists() ? (commenterSnap.data().name || 'Someone') : 'Someone';
                const commenterAvatar = commenterSnap.exists() ? (commenterSnap.data().profileImage || 'images/default-profile.jpg') : 'images/default-profile.jpg';
                const shortComment = commentData.text.length > 40 ? commentData.text.substring(0, 40) + '...' : commentData.text;
                const streamPreview = streamData.headline ? (streamData.headline.length > 30 ? streamData.headline.substring(0, 30) + '...' : streamData.headline) : 'video';
                
                // Create notification
                await addDoc(collection(db, 'notifications'), {
                    type: 'stream_comment',
                    title: 'New Comment on Your Video',
                    message: `${commenterName} commented: "${shortComment}"`,
                    senderId: commenterId,
                    senderName: commenterName,
                    senderAvatar: commenterAvatar,
                    relatedId: commentId,
                    streamId: streamId,
                    streamPreview: streamPreview,
                    commentId: commentId,
                    commentText: commentData.text,
                    userId: currentUser.uid,
                    timestamp: serverTimestamp(),
                    read: false,
                    actionable: true
                });
                
                processedStreamComments.add(commentKey);
            }
        }
        
        saveStreamData();
        
    } catch (error) {
        console.error('Error checking stream comments:', error);
    }
}

// ==================== POST NOTIFICATION FUNCTIONS (No indexes needed) ====================

// Check for new post likes - uses likes subcollection but without orderBy
async function checkForNewPostLikes() {
    if (!currentUser) return;
    
    try {
        // Get all posts by current user
        const postsQuery = query(
            collection(db, 'posts'),
            where('userId', '==', currentUser.uid)
        );
        
        const postsSnap = await getDocs(postsQuery);
        
        for (const postDoc of postsSnap.docs) {
            const postId = postDoc.id;
            const postData = postDoc.data();
            
            // Get all likes for this post
            const likesRef = collection(db, 'posts', postId, 'likes');
            const likesSnap = await getDocs(likesRef);
            
            for (const likeDoc of likesSnap.docs) {
                const likeData = likeDoc.data();
                const likerId = likeData.userId;
                
                // Skip if liked by current user
                if (likerId === currentUser.uid) continue;
                
                const likeKey = `post_${postId}_${likerId}`;
                
                // Check if we've already processed this like
                if (processedLikes.has(likeKey)) continue;
                
                // Get liker data
                const likerRef = doc(db, 'users', likerId);
                const likerSnap = await getDoc(likerRef);
                const likerName = likerSnap.exists() ? (likerSnap.data().name || 'Someone') : 'Someone';
                const likerAvatar = likerSnap.exists() ? (likerSnap.data().profileImage || 'images/default-profile.jpg') : 'images/default-profile.jpg';
                const postPreview = postData.caption ? (postData.caption.length > 30 ? postData.caption.substring(0, 30) + '...' : postData.caption) : 'post';
                
                // Create notification
                await addDoc(collection(db, 'notifications'), {
                    type: 'like',
                    title: 'New Like on Your Post',
                    message: `${likerName} liked your post: "${postPreview}"`,
                    senderId: likerId,
                    senderName: likerName,
                    senderAvatar: likerAvatar,
                    relatedId: postId,
                    postId: postId,
                    postPreview: postPreview,
                    userId: currentUser.uid,
                    timestamp: serverTimestamp(),
                    read: false
                });
                
                processedLikes.add(likeKey);
                saveProcessedItems();
            }
        }
    } catch (error) {
        console.error('Error checking post likes:', error);
    }
}

// Check for new post comments
async function checkForNewPostComments() {
    if (!currentUser) return;
    
    try {
        // Get all posts by current user
        const postsQuery = query(
            collection(db, 'posts'),
            where('userId', '==', currentUser.uid)
        );
        
        const postsSnap = await getDocs(postsQuery);
        
        for (const postDoc of postsSnap.docs) {
            const postId = postDoc.id;
            const postData = postDoc.data();
            
            // Get all comments for this post
            const commentsRef = collection(db, 'posts', postId, 'comments');
            const commentsSnap = await getDocs(commentsRef);
            
            for (const commentDoc of commentsSnap.docs) {
                const commentData = commentDoc.data();
                const commenterId = commentData.userId;
                const commentId = commentDoc.id;
                
                // Skip if comment is from current user
                if (commenterId === currentUser.uid) continue;
                
                const commentKey = `post_${postId}_${commentId}`;
                
                // Check if we've already processed this comment
                if (processedComments.has(commentKey)) continue;
                
                // Get commenter data
                const commenterRef = doc(db, 'users', commenterId);
                const commenterSnap = await getDoc(commenterRef);
                const commenterName = commenterSnap.exists() ? (commenterSnap.data().name || 'Someone') : 'Someone';
                const commenterAvatar = commenterSnap.exists() ? (commenterSnap.data().profileImage || 'images/default-profile.jpg') : 'images/default-profile.jpg';
                const shortComment = commentData.text.length > 40 ? commentData.text.substring(0, 40) + '...' : commentData.text;
                const postPreview = postData.caption ? (postData.caption.length > 30 ? postData.caption.substring(0, 30) + '...' : postData.caption) : 'post';
                
                // Create notification
                await addDoc(collection(db, 'notifications'), {
                    type: 'comment',
                    title: 'New Comment on Your Post',
                    message: `${commenterName} commented: "${shortComment}"`,
                    senderId: commenterId,
                    senderName: commenterName,
                    senderAvatar: commenterAvatar,
                    relatedId: commentId,
                    postId: postId,
                    postPreview: postPreview,
                    commentId: commentId,
                    commentText: commentData.text,
                    userId: currentUser.uid,
                    timestamp: serverTimestamp(),
                    read: false,
                    actionable: true
                });
                
                processedComments.add(commentKey);
                saveProcessedItems();
            }
        }
    } catch (error) {
        console.error('Error checking post comments:', error);
    }
}

// ==================== COMMENT REPLY FUNCTIONALITY ====================

// Setup reply modal for replying to comments from notifications
function setupReplyModal() {
    // Create modal if it doesn't exist
    if (!document.getElementById('replyModal')) {
        const modal = document.createElement('div');
        modal.id = 'replyModal';
        modal.className = 'reply-modal';
        modal.innerHTML = `
            <div class="reply-modal-content">
                <button class="reply-modal-close">&times;</button>
                <div class="reply-to-info">
                    <img id="replyToAvatar" class="reply-to-avatar" src="images/default-profile.jpg" alt="">
                    <div class="reply-to-details">
                        <div id="replyToName" class="reply-to-name"></div>
                        <div id="replyToText" class="reply-to-text"></div>
                    </div>
                </div>
                <div class="reply-modal-input-container">
                    <input type="text" id="replyModalInput" class="reply-modal-input" placeholder="Write your reply..." autocomplete="off">
                    <button id="replyModalSend" class="reply-modal-send">
                        <i class="fas fa-paper-plane"></i>
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Add styles for reply modal
        addReplyModalStyles();
        
        // Close button event
        const closeBtn = modal.querySelector('.reply-modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                closeReplyModal();
            });
        }
        
        // Send button event
        const sendBtn = document.getElementById('replyModalSend');
        if (sendBtn) {
            sendBtn.addEventListener('click', () => {
                submitReply();
            });
        }
        
        // Enter key event
        const input = document.getElementById('replyModalInput');
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    submitReply();
                }
            });
        }
        
        // Click outside to close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeReplyModal();
            }
        });
    }
}

// Add styles for reply modal
function addReplyModalStyles() {
    if (!document.getElementById('reply-modal-styles')) {
        const styles = document.createElement('style');
        styles.id = 'reply-modal-styles';
        styles.textContent = `
            .reply-modal {
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                background: var(--bg-primary);
                border-top: 2px solid var(--border-color);
                padding: 16px;
                z-index: 10002;
                display: none;
                box-shadow: 0 -4px 20px rgba(0,0,0,0.3);
                animation: slideUp 0.3s ease;
            }
            
            @keyframes slideUp {
                from {
                    transform: translateY(100%);
                }
                to {
                    transform: translateY(0);
                }
            }
            
            .reply-modal-content {
                max-width: 600px;
                margin: 0 auto;
                position: relative;
            }
            
            .reply-to-info {
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 16px;
                padding-bottom: 12px;
                border-bottom: 1px solid var(--border-color);
            }
            
            .reply-to-avatar {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                object-fit: cover;
                cursor: pointer;
            }
            
            .reply-to-avatar:hover {
                opacity: 0.8;
            }
            
            .reply-to-name {
                font-weight: 600;
                color: var(--primary);
                font-size: 14px;
                cursor: pointer;
            }
            
            .reply-to-name:hover {
                text-decoration: underline;
            }
            
            .reply-to-text {
                font-size: 13px;
                color: var(--text-secondary);
                margin-top: 2px;
            }
            
            .reply-modal-input-container {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            
            .reply-modal-input {
                flex: 1;
                padding: 14px 18px;
                border: 2px solid var(--border-color);
                border-radius: 30px;
                font-size: 15px;
                background: var(--bg-secondary);
                color: var(--text-primary);
            }
            
            .reply-modal-input:focus {
                outline: none;
                border-color: var(--primary);
            }
            
            .reply-modal-send {
                background: var(--primary);
                border: none;
                color: white;
                width: 48px;
                height: 48px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .reply-modal-send:hover {
                transform: scale(1.1);
                background: var(--primary-dark);
            }
            
            .reply-modal-close {
                position: absolute;
                top: -40px;
                right: 0;
                background: transparent;
                border: none;
                color: var(--text-secondary);
                font-size: 24px;
                cursor: pointer;
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
            }
            
            .reply-modal-close:hover {
                background: rgba(255,255,255,0.1);
                color: var(--text-primary);
            }
        `;
        document.head.appendChild(styles);
    }
}

// Open reply modal for post comment reply
function openReplyModal(commentData, postId, commentId) {
    const modal = document.getElementById('replyModal');
    if (!modal) {
        setupReplyModal();
        setTimeout(() => openReplyModal(commentData, postId, commentId), 100);
        return;
    }
    
    // Store data for later use
    currentCommentPostId = postId;
    currentCommentId = commentId;
    currentReplyToUserId = commentData.userId;
    
    modal.dataset.type = 'post';
    modal.dataset.postId = postId;
    modal.dataset.commentId = commentId;
    modal.dataset.replyToUserId = commentData.userId;
    modal.dataset.replyToUsername = commentData.userName || 'User';
    
    // Set avatar
    const avatar = document.getElementById('replyToAvatar');
    if (avatar) {
        avatar.src = commentData.userAvatar || 'images/default-profile.jpg';
        
        // Add click to view profile
        avatar.onclick = () => {
            window.location.href = `profile.html?id=${commentData.userId}`;
        };
    }
    
    // Set name
    const nameEl = document.getElementById('replyToName');
    if (nameEl) {
        nameEl.textContent = `Replying to ${commentData.userName || 'User'}`;
        
        // Add click to view profile
        nameEl.onclick = () => {
            window.location.href = `profile.html?id=${commentData.userId}`;
        };
    }
    
    // Set comment text
    const textEl = document.getElementById('replyToText');
    if (textEl) {
        let commentText = commentData.text || '';
        if (commentText.length > 50) {
            commentText = commentText.substring(0, 50) + '...';
        }
        textEl.textContent = `"${commentText}"`;
    }
    
    // Clear and focus input
    const input = document.getElementById('replyModalInput');
    if (input) {
        input.value = '';
        input.focus();
    }
    
    modal.style.display = 'block';
}

// Open reply modal for stream comment reply
function openStreamReplyModal(commentData, streamId, commentId) {
    const modal = document.getElementById('replyModal');
    if (!modal) {
        setupReplyModal();
        setTimeout(() => openStreamReplyModal(commentData, streamId, commentId), 100);
        return;
    }
    
    // Store data for later use
    currentCommentPostId = streamId;
    currentCommentId = commentId;
    currentReplyToUserId = commentData.userId;
    
    modal.dataset.type = 'stream';
    modal.dataset.streamId = streamId;
    modal.dataset.commentId = commentId;
    modal.dataset.replyToUserId = commentData.userId;
    modal.dataset.replyToUsername = commentData.userName || 'User';
    
    // Set avatar
    const avatar = document.getElementById('replyToAvatar');
    if (avatar) {
        avatar.src = commentData.userAvatar || 'images/default-profile.jpg';
        
        // Add click to view profile
        avatar.onclick = () => {
            window.location.href = `profile.html?id=${commentData.userId}`;
        };
    }
    
    // Set name
    const nameEl = document.getElementById('replyToName');
    if (nameEl) {
        nameEl.textContent = `Replying to ${commentData.userName || 'User'}`;
        
        // Add click to view profile
        nameEl.onclick = () => {
            window.location.href = `profile.html?id=${commentData.userId}`;
        };
    }
    
    // Set comment text
    const textEl = document.getElementById('replyToText');
    if (textEl) {
        let commentText = commentData.text || '';
        if (commentText.length > 50) {
            commentText = commentText.substring(0, 50) + '...';
        }
        textEl.textContent = `"${commentText}"`;
    }
    
    // Clear and focus input
    const input = document.getElementById('replyModalInput');
    if (input) {
        input.value = '';
        input.focus();
    }
    
    modal.style.display = 'block';
}

// Close reply modal
function closeReplyModal() {
    const modal = document.getElementById('replyModal');
    if (modal) {
        modal.style.display = 'none';
        currentCommentPostId = null;
        currentCommentId = null;
        currentReplyToUserId = null;
    }
}

// Submit reply to comment (works for both posts and streams)
async function submitReply() {
    const modal = document.getElementById('replyModal');
    if (!modal) return;
    
    const type = modal.dataset.type;
    const postId = modal.dataset.postId;
    const streamId = modal.dataset.streamId;
    const commentId = modal.dataset.commentId;
    const replyToUserId = modal.dataset.replyToUserId;
    const replyToUsername = modal.dataset.replyToUsername;
    
    const input = document.getElementById('replyModalInput');
    const replyText = input.value.trim();
    
    if (!replyText) {
        alert('Please enter a reply');
        return;
    }
    
    if (!currentUser) {
        alert('Please login to reply');
        return;
    }
    
    try {
        // Get current user data
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.exists() ? userSnap.data() : {};
        
        const replyData = {
            userId: currentUser.uid,
            userName: userData.name || currentUser.displayName || 'User',
            userAvatar: userData.profileImage || currentUser.photoURL || 'images/default-profile.jpg',
            text: replyText,
            replyToUserId: replyToUserId,
            replyToUsername: replyToUsername,
            createdAt: serverTimestamp(),
            likes: 0
        };
        
        if (type === 'post') {
            // Add reply to post comment
            await addDoc(
                collection(db, 'posts', postId, 'comments', commentId, 'replies'), 
                replyData
            );
            
            // Update comment's reply count
            const commentRef = doc(db, 'posts', postId, 'comments', commentId);
            await updateDoc(commentRef, {
                repliesCount: increment(1),
                updatedAt: serverTimestamp()
            });
            
            // Create notification for the comment owner (if not replying to self)
            if (replyToUserId && replyToUserId !== currentUser.uid) {
                await createCommentReplyNotification(
                    postId, 
                    commentId, 
                    replyToUserId, 
                    replyText,
                    replyToUsername
                );
            }
            
        } else if (type === 'stream') {
            // Add reply to stream comment
            await addDoc(
                collection(db, 'streams', streamId, 'comments', commentId, 'replies'), 
                replyData
            );
            
            // Update comment's reply count
            const commentRef = doc(db, 'streams', streamId, 'comments', commentId);
            await updateDoc(commentRef, {
                repliesCount: increment(1),
                updatedAt: serverTimestamp()
            });
            
            // Create notification for the comment owner (if not replying to self)
            if (replyToUserId && replyToUserId !== currentUser.uid) {
                await createStreamCommentReplyNotification(
                    streamId, 
                    commentId, 
                    replyToUserId, 
                    replyText,
                    replyToUsername
                );
            }
        }
        
        // Show success message
        showCustomNotification('Reply posted!', 'success');
        
        // Close modal
        closeReplyModal();
        
    } catch (error) {
        console.error('Error adding reply:', error);
        alert('Error posting reply: ' + error.message);
    }
}

// Create notification for post comment reply
async function createCommentReplyNotification(postId, commentId, targetUserId, replyText, originalCommenterName) {
    try {
        // Get current user data
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.exists() ? userSnap.data() : {};
        const userName = userData.name || currentUser.displayName || 'Someone';
        
        // Get post data to include in notification
        const postRef = doc(db, 'posts', postId);
        const postSnap = await getDoc(postRef);
        let postPreview = '';
        
        if (postSnap.exists()) {
            const postData = postSnap.data();
            if (postData.caption) {
                postPreview = postData.caption.length > 30 ? 
                    postData.caption.substring(0, 30) + '...' : 
                    postData.caption;
            }
        }
        
        // Truncate reply text for notification
        const shortReply = replyText.length > 40 ? 
            replyText.substring(0, 40) + '...' : 
            replyText;
        
        await addDoc(collection(db, 'notifications'), {
            type: 'comment_reply',
            title: 'New Reply to Your Comment',
            message: `${userName} replied to your comment: "${shortReply}"`,
            senderId: currentUser.uid,
            senderName: userName,
            senderAvatar: userData.profileImage || currentUser.photoURL || 'images/default-profile.jpg',
            relatedId: commentId,
            postId: postId,
            postPreview: postPreview,
            commentId: commentId,
            replyText: replyText,
            originalCommenterName: originalCommenterName,
            userId: targetUserId,
            timestamp: serverTimestamp(),
            read: false,
            actionable: true,
            actionType: 'reply_to_comment'
        });
        
    } catch (error) {
        console.error('Error creating comment reply notification:', error);
    }
}

// Create notification for stream comment reply
async function createStreamCommentReplyNotification(streamId, commentId, targetUserId, replyText, originalCommenterName) {
    try {
        // Get current user data
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.exists() ? userSnap.data() : {};
        const userName = userData.name || currentUser.displayName || 'Someone';
        
        // Get stream data to include in notification
        const streamRef = doc(db, 'streams', streamId);
        const streamSnap = await getDoc(streamRef);
        let streamPreview = '';
        
        if (streamSnap.exists()) {
            const streamData = streamSnap.data();
            if (streamData.headline) {
                streamPreview = streamData.headline.length > 30 ? 
                    streamData.headline.substring(0, 30) + '...' : 
                    streamData.headline;
            }
        }
        
        // Truncate reply text for notification
        const shortReply = replyText.length > 40 ? 
            replyText.substring(0, 40) + '...' : 
            replyText;
        
        await addDoc(collection(db, 'notifications'), {
            type: 'stream_comment_reply',
            title: 'New Reply to Your Comment',
            message: `${userName} replied to your comment: "${shortReply}"`,
            senderId: currentUser.uid,
            senderName: userName,
            senderAvatar: userData.profileImage || currentUser.photoURL || 'images/default-profile.jpg',
            relatedId: commentId,
            streamId: streamId,
            streamPreview: streamPreview,
            commentId: commentId,
            replyText: replyText,
            originalCommenterName: originalCommenterName,
            userId: targetUserId,
            timestamp: serverTimestamp(),
            read: false,
            actionable: true,
            actionType: 'reply_to_stream_comment'
        });
        
    } catch (error) {
        console.error('Error creating stream comment reply notification:', error);
    }
}

// ==================== NOTIFICATION HANDLING ====================

// Handle notification click
async function handleNotificationClick(notificationId) {
    // Mark as read
    await markNotificationAsRead(notificationId);
    
    // Get notification data to determine where to navigate
    try {
        const notificationDoc = await getDoc(doc(db, 'notifications', notificationId));
        if (notificationDoc.exists()) {
            const notification = notificationDoc.data();
            
            // Handle different notification types
            if (notification.type === 'like') {
                if (notification.postId) {
                    window.location.href = `posts.html?post=${notification.postId}`;
                } else {
                    window.location.href = 'posts.html';
                }
            }
            else if (notification.type === 'stream_like') {
                if (notification.streamId) {
                    window.location.href = `stream.html?video=${notification.streamId}`;
                } else {
                    window.location.href = 'stream.html';
                }
            }
            else if (notification.type === 'comment') {
                if (notification.postId && notification.commentId) {
                    window.location.href = `posts.html?post=${notification.postId}&comment=${notification.commentId}`;
                } else if (notification.postId) {
                    window.location.href = `posts.html?post=${notification.postId}`;
                } else {
                    window.location.href = 'posts.html';
                }
            }
            else if (notification.type === 'stream_comment') {
                if (notification.streamId && notification.commentId) {
                    window.location.href = `stream.html?video=${notification.streamId}&comment=${notification.commentId}`;
                } else if (notification.streamId) {
                    window.location.href = `stream.html?video=${notification.streamId}`;
                } else {
                    window.location.href = 'stream.html';
                }
            }
            else if (notification.type === 'comment_reply') {
                if (notification.postId && notification.commentId) {
                    window.location.href = `posts.html?post=${notification.postId}&comment=${notification.commentId}&reply=true`;
                } else {
                    window.location.href = 'posts.html';
                }
            }
            else if (notification.type === 'stream_comment_reply') {
                if (notification.streamId && notification.commentId) {
                    window.location.href = `stream.html?video=${notification.streamId}&comment=${notification.commentId}&reply=true`;
                } else {
                    window.location.href = 'stream.html';
                }
            }
            else if (notification.type === 'message' && notification.senderId) {
                window.location.href = `chat.html?id=${notification.senderId}`;
            } else if (notification.type === 'group_message' && notification.groupId) {
                window.location.href = `group.html?id=${notification.groupId}`;
            } else if (notification.type === 'group_invite' && notification.groupId) {
                window.location.href = `group.html?id=${notification.groupId}`;
            } else if (notification.type === 'post' && notification.senderId) {
                window.location.href = 'posts.html';
                viewedPosts.add(notification.relatedId);
                saveViewedPosts();
                dismissedNotifications.add(`post_${notification.relatedId}`);
                saveDismissedNotifications();
            } else if (notification.senderId) {
                window.location.href = `profile.html?id=${notification.senderId}`;
            } else {
                window.location.href = 'notification.html';
            }
        }
    } catch (error) {
        console.error('Error getting notification:', error);
        window.location.href = 'notification.html';
    }
}

// ==================== DISPLAY NOTIFICATIONS ====================

// Display notifications in notification.html
function displayNotifications(notificationDocs) {
    const notificationsList = document.getElementById('notificationsList');
    if (!notificationsList) return;

    if (notificationDocs.length === 0) {
        notificationsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-bell-slash"></i>
                <h3>No notifications yet</h3>
                <p>When you receive notifications, they will appear here.</p>
            </div>
        `;
        return;
    }

    // Sort notifications by timestamp (newest first) in memory
    const sortedDocs = [...notificationDocs].sort((a, b) => {
        const timeA = a.timestamp?.toDate?.() || new Date(0);
        const timeB = b.timestamp?.toDate?.() || new Date(0);
        return timeB - timeA;
    });

    const notificationsHTML = sortedDocs.map(doc => {
        const notification = doc;
        const timeAgo = formatTime(notification.timestamp);
        const iconClass = getNotificationIcon(notification.type);
        const unreadClass = notification.read ? '' : 'unread';
        const unreadDot = notification.read ? '' : '<div class="unread-dot"></div>';
        
        // Check if this is a comment notification that can be replied to
        const showReplyButton = (notification.type === 'comment' || notification.type === 'stream_comment') && 
                                notification.actionable === true;
        
        const replyButtonHTML = showReplyButton ? `
            <button class="action-btn reply-to-comment-btn" 
                    data-notification-id="${doc.id}"
                    data-type="${notification.type}"
                    data-stream-id="${notification.streamId || ''}" 
                    data-post-id="${notification.postId || ''}" 
                    data-comment-id="${notification.commentId || notification.relatedId || ''}"
                    data-user-id="${notification.senderId || ''}"
                    data-user-name="${notification.senderName || 'User'}"
                    data-user-avatar="${notification.senderAvatar || 'images/default-profile.jpg'}"
                    data-comment-text="${notification.commentText || notification.message || ''}"
                    title="Reply to comment">
                <i class="fas fa-reply"></i>
            </button>
        ` : '';
        
        return `
            <div class="notification-item ${unreadClass}" data-id="${doc.id}">
                <div class="notification-icon ${notification.type}">
                    <i class="${iconClass}"></i>
                </div>
                <div class="notification-content">
                    <div class="notification-title">
                        ${notification.title}
                        ${unreadDot}
                    </div>
                    <div class="notification-text">${notification.message}</div>
                    <div class="notification-time">${timeAgo}</div>
                </div>
                <div class="notification-actions">
                    ${replyButtonHTML}
                    ${!notification.read ? `
                        <button class="action-btn mark-read-btn" title="Mark as read">
                            <i class="fas fa-check"></i>
                        </button>
                    ` : ''}
                    <button class="action-btn delete-btn" title="Delete notification">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    notificationsList.innerHTML = notificationsHTML;
    addNotificationActionListeners();
    addReplyButtonListeners();
}

// Add event listeners to reply buttons
function addReplyButtonListeners() {
    document.querySelectorAll('.reply-to-comment-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            
            const type = button.dataset.type;
            const streamId = button.dataset.streamId;
            const postId = button.dataset.postId;
            const commentId = button.dataset.commentId;
            const userId = button.dataset.userId;
            const userName = button.dataset.userName;
            const userAvatar = button.dataset.userAvatar;
            const commentText = button.dataset.commentText;
            
            const commentData = {
                userId: userId,
                userName: userName,
                userAvatar: userAvatar,
                text: commentText
            };
            
            if (type === 'stream_comment' && streamId && commentId) {
                openStreamReplyModal(commentData, streamId, commentId);
            } else if (type === 'comment' && postId && commentId) {
                openReplyModal(commentData, postId, commentId);
            }
        });
    });
}

// Add event listeners to notification actions
function addNotificationActionListeners() {
    // Mark as read buttons
    document.querySelectorAll('.mark-read-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const notificationItem = button.closest('.notification-item');
            const notificationId = notificationItem.dataset.id;
            markNotificationAsRead(notificationId);
        });
    });

    // Delete buttons
    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const notificationItem = button.closest('.notification-item');
            const notificationId = notificationItem.dataset.id;
            deleteNotification(notificationId);
        });
    });

    // Notification item click (whole item)
    document.querySelectorAll('.notification-item').forEach(item => {
        item.addEventListener('click', (e) => {
            // Don't navigate if clicking on action buttons
            if (e.target.closest('.action-btn')) {
                return;
            }
            
            const notificationId = item.dataset.id;
            handleNotificationClick(notificationId);
        });
    });
}

// Load notifications for dropdown
async function loadDropdownNotifications() {
    if (!currentUser) return;
    
    const dropdownContent = document.getElementById('dropdown-notifications');
    if (!dropdownContent) return;
    
    try {
        // Show loading state
        dropdownContent.innerHTML = `
            <div class="loading-notifications">
                <i class="fas fa-spinner fa-spin"></i>
                <span>Loading notifications...</span>
            </div>
        `;
        
        // Simple query without orderBy to avoid index requirement
        const notificationsQuery = query(
            collection(db, 'notifications'),
            where('userId', '==', currentUser.uid)
        );
        
        const notificationsSnap = await getDocs(notificationsQuery);
        
        if (notificationsSnap.empty) {
            dropdownContent.innerHTML = `
                <div class="empty-notifications">
                    <i class="fas fa-bell-slash"></i>
                    <p>No notifications yet</p>
                </div>
            `;
            return;
        }
        
        // Convert to array and sort in memory by timestamp
        const notifications = [];
        notificationsSnap.forEach(doc => {
            const data = doc.data();
            notifications.push({
                id: doc.id,
                ...data,
                timestampObj: data.timestamp?.toDate?.() || new Date(0)
            });
        });
        
        // Sort by timestamp (newest first) in memory
        notifications.sort((a, b) => b.timestampObj - a.timestampObj);
        
        // Show only 10 most recent
        const recentNotifications = notifications.slice(0, 10);
        
        let html = '';
        
        recentNotifications.forEach(notification => {
            const timeAgo = formatTime(notification.timestamp);
            const iconClass = getNotificationIcon(notification.type);
            const unreadClass = notification.read ? '' : 'unread';
            
            html += `
                <div class="dropdown-notification-item ${unreadClass}" data-id="${notification.id}" 
                     data-type="${notification.type}"
                     data-stream-id="${notification.streamId || ''}"
                     data-post-id="${notification.postId || ''}"
                     data-comment-id="${notification.commentId || notification.relatedId || ''}"
                     data-user-id="${notification.senderId || ''}"
                     data-user-name="${notification.senderName || 'User'}"
                     data-user-avatar="${notification.senderAvatar || 'images/default-profile.jpg'}"
                     data-comment-text="${notification.commentText || notification.message || ''}"
                     data-actionable="${notification.actionable || false}">
                    <div class="dropdown-notification-icon ${notification.type}">
                        <i class="${iconClass}"></i>
                    </div>
                    <div class="dropdown-notification-content">
                        <div class="dropdown-notification-title">
                            ${notification.title}
                            ${!notification.read ? '<span class="unread-indicator"></span>' : ''}
                        </div>
                        <div class="dropdown-notification-text">${notification.message}</div>
                        <div class="dropdown-notification-time">${timeAgo}</div>
                    </div>
                </div>
            `;
        });
        
        dropdownContent.innerHTML = html;
        
        // Add click handlers
        document.querySelectorAll('.dropdown-notification-item').forEach(item => {
            item.addEventListener('click', async (e) => {
                e.stopPropagation();
                const notificationId = item.dataset.id;
                const notificationType = item.dataset.type;
                const actionable = item.dataset.actionable === 'true';
                
                // If it's a comment notification and actionable, check if shift key is pressed for reply
                if ((notificationType === 'comment' || notificationType === 'stream_comment') && actionable && e.shiftKey) {
                    const streamId = item.dataset.streamId;
                    const postId = item.dataset.postId;
                    const commentId = item.dataset.commentId;
                    const userId = item.dataset.userId;
                    const userName = item.dataset.userName;
                    const userAvatar = item.dataset.userAvatar;
                    const commentText = item.dataset.commentText;
                    
                    if (streamId && commentId) {
                        const commentData = {
                            userId: userId,
                            userName: userName,
                            userAvatar: userAvatar,
                            text: commentText
                        };
                        
                        await markNotificationAsRead(notificationId);
                        openStreamReplyModal(commentData, streamId, commentId);
                        
                        const dropdown = document.getElementById('notification-dropdown');
                        if (dropdown) {
                            dropdown.style.display = 'none';
                        }
                        return;
                    } else if (postId && commentId) {
                        const commentData = {
                            userId: userId,
                            userName: userName,
                            userAvatar: userAvatar,
                            text: commentText
                        };
                        
                        await markNotificationAsRead(notificationId);
                        openReplyModal(commentData, postId, commentId);
                        
                        const dropdown = document.getElementById('notification-dropdown');
                        if (dropdown) {
                            dropdown.style.display = 'none';
                        }
                        return;
                    }
                }
                
                // Normal click - handle normally
                await handleNotificationClick(notificationId);
                
                // Close dropdown
                const dropdown = document.getElementById('notification-dropdown');
                if (dropdown) {
                    dropdown.style.display = 'none';
                }
            });
        });
        
    } catch (error) {
        console.error('Error loading dropdown notifications:', error);
        dropdownContent.innerHTML = `
            <div class="empty-notifications">
                <i class="fas fa-exclamation-circle"></i>
                <p>Error loading notifications</p>
                <small>${error.message}</small>
            </div>
        `;
    }
}

// ==================== NOTIFICATION CREATOR FUNCTIONS ====================

// Setup notification creators
function setupNotificationCreators() {
    if (!currentUser) return;

    // Clear any existing intervals
    checkIntervals.forEach(interval => clearInterval(interval));
    checkIntervals = [];

    // Check for new post likes every 10 seconds
    const postLikeInterval = setInterval(() => {
        checkForNewPostLikes();
    }, 10000);
    checkIntervals.push(postLikeInterval);

    // Check for new post comments every 10 seconds
    const postCommentInterval = setInterval(() => {
        checkForNewPostComments();
    }, 10000);
    checkIntervals.push(postCommentInterval);
    
    // Check for new stream likes every 10 seconds
    const streamLikeInterval = setInterval(() => {
        checkForNewStreamLikes();
    }, 10000);
    checkIntervals.push(streamLikeInterval);
    
    // Check for new stream comments every 10 seconds
    const streamCommentInterval = setInterval(() => {
        checkForNewStreamComments();
    }, 10000);
    checkIntervals.push(streamCommentInterval);

    // Initial checks
    setTimeout(() => {
        checkForNewPostLikes();
        checkForNewPostComments();
        checkForNewStreamLikes();
        checkForNewStreamComments();
    }, 2000);
}

// Helper function to show custom notification
function showCustomNotification(message, type = 'info') {
    // Remove existing notifications
    const existing = document.querySelector('.custom-notification');
    if (existing) existing.remove();
    
    const notification = document.createElement('div');
    notification.className = `custom-notification ${type}`;
    notification.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-info-circle'}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ==================== EXISTING FUNCTIONS (Keep all your existing functions below) ====================

// Add sound control button to UI
function addSoundControlButton() {
    // Check if button already exists
    if (document.getElementById('notification-sound-toggle')) return;
    
    const notificationBells = document.querySelectorAll('.notification-bell, .notification-icon, [data-notification-dropdown]');
    
    notificationBells.forEach(bell => {
        // Create sound toggle button
        const soundBtn = document.createElement('button');
        soundBtn.id = 'notification-sound-toggle';
        soundBtn.className = 'sound-toggle-btn';
        soundBtn.innerHTML = soundManager.soundsEnabled ? 
            '<i class="fas fa-volume-up"></i>' : 
            '<i class="fas fa-volume-mute"></i>';
        soundBtn.title = soundManager.soundsEnabled ? 'Mute notification sounds' : 'Unmute notification sounds';
        
        // Add styles if not already added
        if (!document.getElementById('sound-toggle-styles')) {
            const styles = document.createElement('style');
            styles.id = 'sound-toggle-styles';
            styles.textContent = `
                .sound-toggle-btn {
                    background: var(--bg-card);
                    border: 1px solid var(--border-color);
                    border-radius: 50%;
                    width: 36px;
                    height: 36px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    color: var(--text-primary);
                    font-size: 16px;
                    margin-left: 10px;
                    transition: all 0.2s ease;
                }
                
                .sound-toggle-btn:hover {
                    background: var(--primary);
                    color: white;
                    transform: scale(1.1);
                }
                
                .custom-notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    padding: 12px 20px;
                    border-radius: 8px;
                    color: white;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    z-index: 10003;
                    animation: slideInRight 0.3s ease;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                }
                
                .custom-notification.success {
                    background: #10b981;
                }
                
                .custom-notification.info {
                    background: #3b82f6;
                }
                
                .custom-notification.fade-out {
                    animation: fadeOut 0.3s ease forwards;
                }
                
                @keyframes slideInRight {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                
                @keyframes fadeOut {
                    from {
                        opacity: 1;
                    }
                    to {
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(styles);
        }
        
        // Add click handler
        soundBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showSoundSettings(soundBtn);
        });
        
        // Insert after notification bell
        bell.parentNode.insertBefore(soundBtn, bell.nextSibling);
    });
}

// Show sound settings panel
function showSoundSettings(triggerBtn) {
    // Remove existing panel
    const existingPanel = document.querySelector('.sound-settings-panel');
    if (existingPanel) {
        existingPanel.remove();
        return;
    }
    
    const panel = document.createElement('div');
    panel.className = 'sound-settings-panel';
    panel.innerHTML = `
        <div class="sound-settings-header">
            <h4>Notification Sounds</h4>
            <button class="sound-settings-close">&times;</button>
        </div>
        <div class="sound-settings-option">
            <label>
                <input type="checkbox" id="sound-enabled" ${soundManager.soundsEnabled ? 'checked' : ''}>
                Enable sounds
            </label>
        </div>
        <div class="sound-settings-option">
            <label>Volume</label>
            <input type="range" id="sound-volume" min="0" max="1" step="0.1" value="${soundManager.soundVolume}">
        </div>
        <button class="sound-test-btn" id="test-sound-btn">
            <i class="fas fa-play"></i> Test Sound
        </button>
    `;
    
    // Add styles if not already added
    if (!document.getElementById('sound-settings-styles')) {
        const styles = document.createElement('style');
        styles.id = 'sound-settings-styles';
        styles.textContent = `
            .sound-settings-panel {
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: var(--bg-card);
                border: 1px solid var(--border-color);
                border-radius: 12px;
                padding: 20px;
                box-shadow: var(--shadow-lg);
                z-index: 10002;
                width: 250px;
                animation: slideUp 0.3s ease;
            }
            
            .sound-settings-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 15px;
            }
            
            .sound-settings-header h4 {
                margin: 0;
                font-size: 16px;
                color: var(--text-primary);
            }
            
            .sound-settings-close {
                background: none;
                border: none;
                color: var(--text-secondary);
                font-size: 18px;
                cursor: pointer;
            }
            
            .sound-settings-option {
                margin-bottom: 15px;
            }
            
            .sound-settings-option label {
                display: block;
                margin-bottom: 5px;
                color: var(--text-secondary);
                font-size: 13px;
            }
            
            .sound-settings-option input[type="range"] {
                width: 100%;
                height: 4px;
                background: var(--border-color);
                border-radius: 2px;
                -webkit-appearance: none;
            }
            
            .sound-settings-option input[type="range"]::-webkit-slider-thumb {
                -webkit-appearance: none;
                width: 16px;
                height: 16px;
                background: var(--primary);
                border-radius: 50%;
                cursor: pointer;
            }
            
            .sound-test-btn {
                background: var(--bg-hover);
                border: 1px solid var(--border-color);
                border-radius: 6px;
                padding: 8px 12px;
                color: var(--text-primary);
                cursor: pointer;
                font-size: 13px;
                display: flex;
                align-items: center;
                gap: 8px;
                width: 100%;
                justify-content: center;
                transition: all 0.2s ease;
            }
            
            .sound-test-btn:hover {
                background: var(--primary);
                color: white;
            }
        `;
        document.head.appendChild(styles);
    }
    
    document.body.appendChild(panel);
    
    // Position panel near the button
    const btnRect = triggerBtn.getBoundingClientRect();
    panel.style.bottom = (window.innerHeight - btnRect.top + 10) + 'px';
    panel.style.right = (window.innerWidth - btnRect.right) + 'px';
    
    // Add event listeners
    panel.querySelector('.sound-settings-close').addEventListener('click', () => {
        panel.remove();
    });
    
    const enabledCheckbox = panel.querySelector('#sound-enabled');
    enabledCheckbox.addEventListener('change', (e) => {
        soundManager.toggleSounds();
        triggerBtn.innerHTML = soundManager.soundsEnabled ? 
            '<i class="fas fa-volume-up"></i>' : 
            '<i class="fas fa-volume-mute"></i>';
        triggerBtn.title = soundManager.soundsEnabled ? 'Mute notification sounds' : 'Unmute notification sounds';
    });
    
    const volumeSlider = panel.querySelector('#sound-volume');
    volumeSlider.addEventListener('input', (e) => {
        soundManager.setVolume(parseFloat(e.target.value));
    });
    
    panel.querySelector('#test-sound-btn').addEventListener('click', () => {
        soundManager.playSoftBell();
    });
    
    // Close when clicking outside
    setTimeout(() => {
        document.addEventListener('click', function closePanel(e) {
            if (!panel.contains(e.target) && e.target !== triggerBtn && !triggerBtn.contains(e.target)) {
                panel.remove();
                document.removeEventListener('click', closePanel);
            }
        });
    }, 100);
}

// Add sound settings to notification page
function addSoundSettingsToPage() {
    const header = document.querySelector('.notifications-header');
    if (header) {
        const soundSettingsBtn = document.createElement('button');
        soundSettingsBtn.className = 'sound-settings-page-btn';
        soundSettingsBtn.innerHTML = '<i class="fas fa-music"></i> Sound Settings';
        
        soundSettingsBtn.addEventListener('click', () => {
            showSoundSettings(soundSettingsBtn);
        });
        
        header.appendChild(soundSettingsBtn);
        
        // Add styles
        if (!document.getElementById('sound-page-styles')) {
            const styles = document.createElement('style');
            styles.id = 'sound-page-styles';
            styles.textContent = `
                .sound-settings-page-btn {
                    background: var(--bg-card);
                    color: var(--text-primary);
                    border: 1px solid var(--border-color);
                    border-radius: 8px;
                    padding: 10px 20px;
                    font-size: 14px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    transition: all 0.2s ease;
                    margin-left: 10px;
                }
                
                .sound-settings-page-btn:hover {
                    background: var(--primary);
                    color: white;
                    border-color: var(--primary);
                }
            `;
            document.head.appendChild(styles);
        }
    }
}

// Setup dropdown notification functionality
function setupDropdownNotifications() {
    const notificationBells = document.querySelectorAll('.notification-bell, .notification-icon, [data-notification-dropdown]');
    
    notificationBells.forEach(bell => {
        bell.addEventListener('click', async (e) => {
            e.stopPropagation();
            toggleDropdownNotifications();
        });
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('notification-dropdown');
        if (dropdown && !dropdown.contains(e.target)) {
            const bells = document.querySelectorAll('.notification-bell, .notification-icon, [data-notification-dropdown]');
            let isBell = false;
            bells.forEach(bell => {
                if (bell.contains(e.target)) isBell = true;
            });
            if (!isBell) {
                dropdown.style.display = 'none';
            }
        }
    });
}

// Toggle dropdown notifications
async function toggleDropdownNotifications() {
    let dropdown = document.getElementById('notification-dropdown');
    
    if (!dropdown) {
        dropdown = createDropdownElement();
        document.body.appendChild(dropdown);
    }
    
    if (dropdown.style.display === 'block') {
        dropdown.style.display = 'none';
    } else {
        dropdown.style.display = 'block';
        await loadDropdownNotifications();
    }
}

// Create dropdown element
function createDropdownElement() {
    const dropdown = document.createElement('div');
    dropdown.id = 'notification-dropdown';
    dropdown.className = 'notification-dropdown';
    dropdown.innerHTML = `
        <div class="dropdown-header">
            <h3>Notifications</h3>
            <button class="mark-all-read-btn" title="Mark all as read">
                <i class="fas fa-check-double"></i> Mark all
            </button>
        </div>
        <div class="dropdown-content" id="dropdown-notifications">
            <div class="loading-notifications">
                <i class="fas fa-spinner fa-spin"></i>
                <span>Loading notifications...</span>
            </div>
        </div>
        <div class="dropdown-footer">
            <a href="notification.html" class="view-all-btn">View all notifications</a>
        </div>
    `;
    
    // Add styles if not already added
    if (!document.getElementById('notification-dropdown-styles')) {
        const styles = document.createElement('style');
        styles.id = 'notification-dropdown-styles';
        styles.textContent = `
            .notification-dropdown {
                position: fixed;
                top: 70px;
                right: 20px;
                width: 400px;
                max-height: 500px;
                background: var(--bg-card);
                border: 1px solid var(--border-color);
                border-radius: 12px;
                box-shadow: var(--shadow-lg);
                z-index: 10000;
                display: none;
                overflow: hidden;
                font-family: 'Inter', sans-serif;
            }
            
            .dropdown-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 15px 20px;
                border-bottom: 1px solid var(--border-color);
                background: var(--bg-primary);
            }
            
            .dropdown-header h3 {
                margin: 0;
                font-size: 16px;
                font-weight: 600;
                color: var(--text-primary);
            }
            
            .mark-all-read-btn {
                background: var(--primary);
                color: white;
                border: none;
                border-radius: 6px;
                padding: 6px 12px;
                font-size: 12px;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 5px;
                transition: all 0.2s ease;
            }
            
            .mark-all-read-btn:hover {
                background: var(--primary-dark);
                transform: translateY(-1px);
            }
            
            .dropdown-content {
                max-height: 400px;
                overflow-y: auto;
            }
            
            .dropdown-notification-item {
                padding: 15px 20px;
                border-bottom: 1px solid var(--border-color);
                cursor: pointer;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                gap: 12px;
            }
            
            .dropdown-notification-item:hover {
                background: var(--bg-hover);
            }
            
            .dropdown-notification-item.unread {
                background: rgba(179, 0, 75, 0.05);
            }
            
            .dropdown-notification-icon {
                width: 36px;
                height: 36px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                font-size: 14px;
            }
            
            .dropdown-notification-content {
                flex: 1;
                min-width: 0;
            }
            
            .dropdown-notification-title {
                font-weight: 500;
                font-size: 14px;
                color: var(--text-primary);
                margin-bottom: 2px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .dropdown-notification-text {
                font-size: 13px;
                color: var(--text-secondary);
                line-height: 1.3;
                margin-bottom: 4px;
            }
            
            .dropdown-notification-time {
                font-size: 11px;
                color: var(--text-light);
            }
            
            .unread-indicator {
                width: 8px;
                height: 8px;
                background: var(--primary);
                border-radius: 50%;
                margin-left: 5px;
            }
            
            .dropdown-footer {
                padding: 15px 20px;
                text-align: center;
                border-top: 1px solid var(--border-color);
                background: var(--bg-primary);
            }
            
            .view-all-btn {
                color: var(--primary);
                text-decoration: none;
                font-size: 14px;
                font-weight: 500;
                display: block;
                padding: 8px;
                border-radius: 6px;
                transition: all 0.2s ease;
            }
            
            .view-all-btn:hover {
                background: rgba(179, 0, 75, 0.1);
            }
            
            .loading-notifications {
                padding: 30px;
                text-align: center;
                color: var(--text-secondary);
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 10px;
            }
            
            .empty-notifications {
                padding: 40px 20px;
                text-align: center;
                color: var(--text-secondary);
            }
            
            .empty-notifications i {
                font-size: 48px;
                margin-bottom: 15px;
                color: var(--border-color);
            }
            
            @media (max-width: 768px) {
                .notification-dropdown {
                    width: calc(100% - 40px);
                    right: 10px;
                    left: 10px;
                }
            }
        `;
        document.head.appendChild(styles);
    }
    
    // Add event listeners
    dropdown.querySelector('.mark-all-read-btn').addEventListener('click', markAllNotificationsAsRead);
    
    return dropdown;
}

// Setup mark all read button for notification page
function setupMarkAllReadButton() {
    const markAllReadBtn = document.getElementById('markAllReadBtn');
    if (!markAllReadBtn) {
        // Create button if it doesn't exist
        const header = document.querySelector('.notifications-header');
        if (header) {
            const button = document.createElement('button');
            button.id = 'markAllReadBtn';
            button.className = 'mark-all-read-page-btn';
            button.innerHTML = '<i class="fas fa-check-double"></i> Mark All as Read';
            header.appendChild(button);
            
            // Add styles
            if (!document.getElementById('mark-all-read-styles')) {
                const styles = document.createElement('style');
                styles.id = 'mark-all-read-styles';
                styles.textContent = `
                    .mark-all-read-page-btn {
                        background: var(--primary);
                        color: white;
                        border: none;
                        border-radius: 8px;
                        padding: 10px 20px;
                        font-size: 14px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        transition: all 0.2s ease;
                    }
                    
                    .mark-all-read-page-btn:hover {
                        background: var(--primary-dark);
                        transform: translateY(-2px);
                        box-shadow: var(--shadow-md);
                    }
                    
                    .notifications-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 20px;
                    }
                `;
                document.head.appendChild(styles);
            }
            
            button.addEventListener('click', markAllNotificationsAsRead);
        }
    } else {
        markAllReadBtn.addEventListener('click', markAllNotificationsAsRead);
    }
}

// Mark all notifications as read
async function markAllNotificationsAsRead() {
    if (!currentUser) return;
    
    try {
        const notificationsQuery = query(
            collection(db, 'notifications'),
            where('userId', '==', currentUser.uid),
            where('read', '==', false)
        );
        
        const notificationsSnap = await getDocs(notificationsQuery);
        const batch = writeBatch(db);
        
        notificationsSnap.docs.forEach(doc => {
            batch.update(doc.ref, {
                read: true,
                readAt: serverTimestamp()
            });
        });
        
        await batch.commit();
        
        // Update UI
        document.querySelectorAll('.notification-item.unread').forEach(item => {
            item.classList.remove('unread');
            const unreadDot = item.querySelector('.unread-dot');
            if (unreadDot) unreadDot.remove();
            const markReadBtn = item.querySelector('.mark-read-btn');
            if (markReadBtn) markReadBtn.remove();
        });
        
        // Update dropdown if open
        const dropdown = document.getElementById('notification-dropdown');
        if (dropdown && dropdown.style.display === 'block') {
            await loadDropdownNotifications();
        }
        
        updateNotificationBadge(0);
        
        // Close any open notification popup
        const popup = document.querySelector('.notification-popup');
        if (popup) {
            popup.remove();
        }
        
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
    }
}

// Show notification popup (with sound)
function showNotificationPopup() {
    // Don't show if already showing or on notification page
    if (notificationShown || window.location.pathname.includes('notification.html')) {
        return;
    }
    
    // Don't show if no unread notifications
    if (unreadCount === 0) {
        return;
    }
    
    // Play notification sound
    soundManager.playSoftBell();
    
    // Remove any existing popup
    const existingPopup = document.querySelector('.notification-popup');
    if (existingPopup) {
        existingPopup.remove();
    }
    
    const popup = document.createElement('div');
    popup.className = 'notification-popup';
    popup.innerHTML = `
        <div class="popup-content">
            <div class="popup-icon">
                <i class="fas fa-bell"></i>
            </div>
            <div class="popup-text">
                <div class="popup-title">You have new notifications</div>
                <div class="popup-message">${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}</div>
            </div>
            <button class="popup-mark-btn">
                <i class="fas fa-check"></i> Mark
            </button>
            <button class="popup-close">&times;</button>
        </div>
    `;
    
    // Add styles if not already added
    if (!document.getElementById('notification-popup-styles')) {
        const styles = document.createElement('style');
        styles.id = 'notification-popup-styles';
        styles.textContent = `
            .notification-popup {
                position: fixed;
                top: 20px;
                right: 20px;
                background: linear-gradient(135deg, var(--primary), var(--primary-dark));
                border-radius: 12px;
                box-shadow: var(--shadow-lg);
                z-index: 10001;
                animation: slideInRight 0.4s ease forwards;
                color: white;
                font-family: 'Inter', sans-serif;
                overflow: hidden;
                min-width: 300px;
            }
            
            .popup-content {
                display: flex;
                align-items: center;
                padding: 15px;
                gap: 12px;
            }
            
            .popup-icon {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 18px;
                background: rgba(255, 255, 255, 0.2);
                flex-shrink: 0;
            }
            
            .popup-text {
                flex: 1;
                min-width: 0;
            }
            
            .popup-title {
                font-weight: 600;
                font-size: 14px;
                margin-bottom: 2px;
            }
            
            .popup-message {
                font-size: 13px;
                opacity: 0.9;
            }
            
            .popup-mark-btn {
                background: rgba(255, 255, 255, 0.2);
                color: white;
                border: none;
                border-radius: 6px;
                padding: 6px 12px;
                font-size: 12px;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 5px;
                transition: all 0.2s ease;
                flex-shrink: 0;
            }
            
            .popup-mark-btn:hover {
                background: rgba(255, 255, 255, 0.3);
                transform: translateY(-1px);
            }
            
            .popup-close {
                background: rgba(255, 255, 255, 0.2);
                border: none;
                border-radius: 50%;
                font-size: 16px;
                cursor: pointer;
                color: white;
                padding: 0;
                width: 28px;
                height: 28px;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                transition: all 0.2s ease;
            }
            
            .popup-close:hover {
                background: rgba(255, 255, 255, 0.3);
            }
            
            .notification-popup.hiding {
                animation: slideOutRight 0.3s ease forwards;
            }
            
            @keyframes slideOutRight {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(styles);
    }
    
    document.body.appendChild(popup);
    notificationShown = true;
    
    // Auto-dismiss after 5 seconds
    const autoDismiss = setTimeout(() => {
        hideNotificationPopup(popup);
    }, 5000);
    
    // Mark button
    popup.querySelector('.popup-mark-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        markAllNotificationsAsRead();
        hideNotificationPopup(popup);
    });
    
    // Close button
    popup.querySelector('.popup-close').addEventListener('click', (e) => {
        e.stopPropagation();
        hideNotificationPopup(popup);
    });
    
    // Click to go to notifications
    popup.addEventListener('click', (e) => {
        if (!e.target.closest('.popup-mark-btn') && !e.target.closest('.popup-close')) {
            window.location.href = 'notification.html';
            hideNotificationPopup(popup);
        }
    });
    
    function hideNotificationPopup(popupElement) {
        popupElement.classList.add('hiding');
        setTimeout(() => {
            if (popupElement.parentNode) {
                popupElement.parentNode.removeChild(popupElement);
            }
            notificationShown = false;
        }, 300);
        clearTimeout(autoDismiss);
    }
}

// Load dismissed notifications from localStorage
function loadDismissedNotifications() {
    try {
        const stored = localStorage.getItem('dismissedNotifications');
        if (stored) {
            const dismissed = JSON.parse(stored);
            dismissed.forEach(id => dismissedNotifications.add(id));
        }
    } catch (error) {
        console.error('Error loading dismissed notifications:', error);
    }
}

// Load viewed posts from localStorage
function loadViewedPosts() {
    if (!currentUser) return;
    try {
        const stored = localStorage.getItem(`viewedPosts_${currentUser.uid}`);
        if (stored) {
            viewedPosts = new Set(JSON.parse(stored));
        }
    } catch (error) {
        console.error('Error loading viewed posts:', error);
    }
}

// Save dismissed notifications to localStorage
function saveDismissedNotifications() {
    try {
        localStorage.setItem('dismissedNotifications', JSON.stringify(Array.from(dismissedNotifications)));
    } catch (error) {
        console.error('Error saving dismissed notifications:', error);
    }
}

// Save viewed posts to localStorage
function saveViewedPosts() {
    if (!currentUser) return;
    try {
        localStorage.setItem(`viewedPosts_${currentUser.uid}`, JSON.stringify(Array.from(viewedPosts)));
    } catch (error) {
        console.error('Error saving viewed posts:', error);
    }
}

// Load notifications for notification.html page
async function loadNotificationsForPage() {
    if (!currentUser) return;

    try {
        const notificationsQuery = query(
            collection(db, 'notifications'),
            where('userId', '==', currentUser.uid)
        );

        const notificationsSnap = await getDocs(notificationsQuery);
        
        // Convert to array with timestamps
        const notifications = [];
        notificationsSnap.forEach(doc => {
            const data = doc.data();
            notifications.push({
                id: doc.id,
                ...data,
                timestampObj: data.timestamp?.toDate?.() || new Date(0)
            });
        });
        
        // Sort in memory by timestamp (newest first)
        notifications.sort((a, b) => b.timestampObj - a.timestampObj);
        
        displayNotifications(notifications);
    } catch (error) {
        console.error('Error loading notifications:', error);
        const notificationsList = document.getElementById('notificationsList');
        if (notificationsList) {
            notificationsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-circle"></i>
                    <h3>Error loading notifications</h3>
                    <p>Please try refreshing the page.</p>
                </div>
            `;
        }
    }
}

// Mark notification as read
async function markNotificationAsRead(notificationId) {
    if (!currentUser) return;

    try {
        await updateDoc(doc(db, 'notifications', notificationId), {
            read: true,
            readAt: serverTimestamp()
        });
        
        // Update UI
        const notificationItem = document.querySelector(`[data-id="${notificationId}"]`);
        if (notificationItem) {
            notificationItem.classList.remove('unread');
            const unreadDot = notificationItem.querySelector('.unread-dot');
            if (unreadDot) unreadDot.remove();
            const markReadBtn = notificationItem.querySelector('.mark-read-btn');
            if (markReadBtn) markReadBtn.remove();
        }
        
        updateNotificationBadge();
    } catch (error) {
        console.error('Error marking notification as read:', error);
    }
}

// Delete notification
async function deleteNotification(notificationId) {
    if (!currentUser) return;

    try {
        await deleteDoc(doc(db, 'notifications', notificationId));
        
        // Remove from UI
        const notificationItem = document.querySelector(`[data-id="${notificationId}"]`);
        if (notificationItem) {
            notificationItem.style.opacity = '0.5';
            setTimeout(() => notificationItem.remove(), 300);
        }
        
        updateNotificationBadge();
    } catch (error) {
        console.error('Error deleting notification:', error);
    }
}

// Show login message
function showLoginMessage() {
    const notificationsList = document.getElementById('notificationsList');
    if (notificationsList) {
        notificationsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-sign-in-alt"></i>
                <h3>Please log in</h3>
                <p>You need to be logged in to view notifications.</p>
                <a href="login.html" class="btn btn-primary" style="margin-top: 15px;">Log In</a>
            </div>
        `;
    }
}

// Setup notification listener (with sound for new notifications)
function setupNotificationListener() {
    if (!currentUser) return;

    if (unsubscribeNotifications) {
        unsubscribeNotifications();
    }

    try {
        const notificationsQuery = query(
            collection(db, 'notifications'),
            where('userId', '==', currentUser.uid)
        );

        unsubscribeNotifications = onSnapshot(notificationsQuery, (snapshot) => {
            // Filter unread and sort by timestamp in memory
            const allNotifications = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            // Add timestamp objects for sorting
            allNotifications.forEach(notification => {
                notification.timestampObj = notification.timestamp?.toDate?.() || new Date(0);
            });
            
            const unreadNotifications = allNotifications.filter(notification => !notification.read);
            const sortedNotifications = allNotifications.sort((a, b) => b.timestampObj - a.timestampObj);
            
            const previousUnreadCount = unreadCount;
            unreadCount = unreadNotifications.length;
            
            updateNotificationBadge(unreadCount);
            localStorage.setItem(`notification_count_${currentUser.uid}`, unreadCount);
            
            // Play sound for new notifications
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const notification = change.doc.data();
                    if (!notification.read) {
                        // Play notification sound based on type
                        soundManager.playNotificationSound(notification.type);
                    }
                }
            });
            
            // Reload notifications if on notification page
            if (window.location.pathname.includes('notification.html')) {
                displayNotifications(sortedNotifications);
            }
            
            // Update dropdown if open
            const dropdown = document.getElementById('notification-dropdown');
            if (dropdown && dropdown.style.display === 'block') {
                loadDropdownNotifications();
            }
            
            // Show popup for new notifications (but not too frequently)
            if (!window.location.pathname.includes('notification.html')) {
                const now = Date.now();
                if (unreadCount > previousUnreadCount && now - lastNotificationTime > 5000) {
                    showNotificationPopup();
                    lastNotificationTime = now;
                }
            }
        }, (error) => {
            console.error('Notification listener error:', error);
            const cachedCount = localStorage.getItem(`notification_count_${currentUser.uid}`) || 0;
            updateNotificationBadge(parseInt(cachedCount));
        });

    } catch (error) {
        console.error('Error setting up notification listener:', error);
        const cachedCount = localStorage.getItem(`notification_count_${currentUser ? currentUser.uid : 'anonymous'}`) || 0;
        updateNotificationBadge(parseInt(cachedCount));
    }
}

// Update notification badge
function updateNotificationBadge(count) {
    if (count === undefined) {
        count = localStorage.getItem(`notification_count_${currentUser ? currentUser.uid : 'anonymous'}`) || 0;
        count = parseInt(count);
    }

    unreadCount = count;

    const badges = document.querySelectorAll('.notification-badge');
    badges.forEach(badge => {
        if (count > 0) {
            badge.textContent = count > 99 ? '99+' : count;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    });
}

// Get notification icon
function getNotificationIcon(type) {
    switch (type) {
        case 'message': return 'fas fa-comment-alt';
        case 'like': return 'fas fa-heart';
        case 'stream_like': return 'fas fa-heart';
        case 'comment':
        case 'comment_reply': return 'fas fa-comment';
        case 'stream_comment':
        case 'stream_comment_reply': return 'fas fa-comment';
        case 'post': return 'fas fa-newspaper';
        case 'group_message': return 'fas fa-users';
        case 'group_invite': return 'fas fa-user-plus';
        case 'group_member_removed': return 'fas fa-user-minus';
        case 'group_deleted': return 'fas fa-trash-alt';
        default: return 'fas fa-bell';
    }
}

// Format time
function formatTime(timestamp) {
    if (!timestamp) return '';
    
    let date;
    try {
        if (timestamp.toDate) {
            date = timestamp.toDate();
        } else if (typeof timestamp === 'string') {
            date = new Date(timestamp);
        } else {
            return '';
        }
        
        if (isNaN(date.getTime())) return '';
    } catch (error) {
        return '';
    }
    
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

// Clean up listeners
function cleanupListeners() {
    if (unsubscribeNotifications) unsubscribeNotifications();
    checkIntervals.forEach(interval => clearInterval(interval));
    checkIntervals = [];
}

// Auto-initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNotificationSystem);
} else {
    initNotificationSystem();
}

// Export functions for external use
window.NotificationSystem = {
    init: initNotificationSystem,
    updateBadge: updateNotificationBadge,
    getUnreadCount: () => {
        return localStorage.getItem(`notification_count_${currentUser ? currentUser.uid : 'anonymous'}`) || 0;
    },
    markPostAsViewed: (postId) => {
        viewedPosts.add(postId);
        saveViewedPosts();
        dismissedNotifications.add(`post_${postId}`);
        saveDismissedNotifications();
    },
    createGroupNotification: async (type, title, message, groupId, groupName, relatedId = null) => {
        if (!currentUser) return;
        
        try {
            await addDoc(collection(db, 'notifications'), {
                type: type,
                title: title,
                message: message,
                groupId: groupId,
                groupName: groupName,
                relatedId: relatedId,
                userId: currentUser.uid,
                timestamp: serverTimestamp(),
                read: false
            });
        } catch (error) {
            console.error('Error creating group notification:', error);
        }
    },
    // Stream notification functions
    checkForNewStreamLikes: checkForNewStreamLikes,
    checkForNewStreamComments: checkForNewStreamComments,
    openStreamReplyModal: openStreamReplyModal,
    // Like notification functions
    checkForNewPostLikes: checkForNewPostLikes,
    checkForNewPostComments: checkForNewPostComments,
    // Reply modal functions
    openReplyModal: openReplyModal,
    closeReplyModal: closeReplyModal,
    // Dropdown functions
    showDropdown: toggleDropdownNotifications,
    markAllRead: markAllNotificationsAsRead,
    // Sound control methods
    soundManager: soundManager,
    toggleSounds: () => soundManager.toggleSounds(),
    setSoundVolume: (volume) => soundManager.setVolume(volume),
    testSound: () => soundManager.playSoftBell(),
    // Force check for new notifications
    forceCheck: () => {
        if (currentUser) {
            checkForNewPostLikes();
            checkForNewPostComments();
            checkForNewStreamLikes();
            checkForNewStreamComments();
        }
    }
};