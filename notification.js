// notification.js - Complete file with working notifications for both posts and streams

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
    increment
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

// Track processed items to prevent duplicates
let processedPostLikes = new Set();
let processedPostComments = new Set();
let processedStreamLikes = new Set();
let processedStreamComments = new Set();

// ==================== NOTIFICATION SOUNDS SYSTEM ====================

class NotificationSoundManager {
    constructor() {
        this.audioContext = null;
        this.soundsEnabled = true;
        this.soundVolume = 0.5;
        this.lastPlayed = 0;
        this.minPlayInterval = 1000;
        this.loadUserPreferences();
        this.setupAudioContext();
    }
    
    setupAudioContext() {
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
        } catch (e) {}
    }
    
    saveUserPreferences() {
        try {
            localStorage.setItem('notificationSoundPrefs', JSON.stringify({
                enabled: this.soundsEnabled,
                volume: this.soundVolume
            }));
        } catch (e) {}
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
    
    playSoftBell() { this.playSound('softBell'); }
    playGentleChime() { this.playSound('gentleChime'); }
    playSoftPing() { this.playSound('softPing'); }
    playSubtlePop() { this.playSound('subtlePop'); }
    
    playNotificationSound(type) {
        if (!this.soundsEnabled) return;
        const now = Date.now();
        if (now - this.lastPlayed < this.minPlayInterval) return;
        this.lastPlayed = now;
        
        switch(type) {
            case 'message': case 'group_message': this.playSoftPing(); break;
            case 'like': case 'stream_like': this.playSubtlePop(); break;
            case 'comment': case 'stream_comment': this.playGentleChime(); break;
            case 'comment_reply': case 'stream_comment_reply': this.playSoftPing(); break;
            default: this.playSoftBell();
        }
    }
    
    playSound(soundType) {
        if (!this.soundsEnabled) return;
        if (!this.audioContext) {
            try {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) { return; }
        }
        
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        
        try {
            switch(soundType) {
                case 'softBell': this.createSoftBellSound(); break;
                case 'gentleChime': this.createGentleChimeSound(); break;
                case 'softPing': this.createSoftPingSound(); break;
                case 'subtlePop': this.createSubtlePopSound(); break;
            }
        } catch (e) {}
    }
    
    createSoftBellSound() {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(440, this.audioContext.currentTime + 0.5);
        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(this.soundVolume * 0.3, this.audioContext.currentTime + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.8);
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + 0.8);
    }
    
    createGentleChimeSound() {
        const notes = [523.25, 659.25, 783.99];
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
    
    createSoftPingSound() {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(659.25, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(523.25, this.audioContext.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(this.soundVolume * 0.25, this.audioContext.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + 0.3);
    }
    
    createSubtlePopSound() {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(330, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(220, this.audioContext.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(this.soundVolume * 0.2, this.audioContext.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.15);
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + 0.15);
    }
}

const soundManager = new NotificationSoundManager();

// ==================== POST NOTIFICATIONS (WORKING) ====================

// Check for new post likes
async function checkForNewPostLikes() {
    if (!currentUser) return;
    
    try {
        const postsQuery = query(
            collection(db, 'posts'),
            where('userId', '==', currentUser.uid)
        );
        
        const postsSnap = await getDocs(postsQuery);
        
        for (const postDoc of postsSnap.docs) {
            const postId = postDoc.id;
            const postData = postDoc.data();
            
            const likesRef = collection(db, 'posts', postId, 'likes');
            const likesSnap = await getDocs(likesRef);
            
            for (const likeDoc of likesSnap.docs) {
                const likeData = likeDoc.data();
                const likerId = likeData.userId;
                const likeId = likeDoc.id;
                
                if (likerId === currentUser.uid) continue;
                
                const likeKey = `post_${postId}_${likerId}`;
                if (processedPostLikes.has(likeKey)) continue;
                
                const existingQuery = query(
                    collection(db, 'notifications'),
                    where('userId', '==', currentUser.uid),
                    where('type', '==', 'like'),
                    where('relatedId', '==', postId),
                    where('senderId', '==', likerId)
                );
                
                const existingSnap = await getDocs(existingQuery);
                
                if (existingSnap.empty) {
                    const likerRef = doc(db, 'users', likerId);
                    const likerSnap = await getDoc(likerRef);
                    const likerName = likerSnap.exists() ? (likerSnap.data().name || 'Someone') : 'Someone';
                    const likerAvatar = likerSnap.exists() ? (likerSnap.data().profileImage || 'images/default-profile.jpg') : 'images/default-profile.jpg';
                    const postPreview = postData.caption ? (postData.caption.length > 30 ? postData.caption.substring(0, 30) + '...' : postData.caption) : 'post';
                    
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
                }
                
                processedPostLikes.add(likeKey);
                localStorage.setItem(`post_likes_${currentUser.uid}`, JSON.stringify([...processedPostLikes]));
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
        const postsQuery = query(
            collection(db, 'posts'),
            where('userId', '==', currentUser.uid)
        );
        
        const postsSnap = await getDocs(postsQuery);
        
        for (const postDoc of postsSnap.docs) {
            const postId = postDoc.id;
            const postData = postDoc.data();
            
            const commentsQuery = collection(db, 'posts', postId, 'comments');
            const commentsSnap = await getDocs(commentsQuery);
            
            for (const commentDoc of commentsSnap.docs) {
                const commentData = commentDoc.data();
                const commenterId = commentData.userId;
                const commentId = commentDoc.id;
                
                if (commenterId === currentUser.uid) continue;
                
                const commentKey = `post_${postId}_${commentId}`;
                if (processedPostComments.has(commentKey)) continue;
                
                const existingQuery = query(
                    collection(db, 'notifications'),
                    where('userId', '==', currentUser.uid),
                    where('type', '==', 'comment'),
                    where('relatedId', '==', commentId),
                    where('senderId', '==', commenterId)
                );
                
                const existingSnap = await getDocs(existingQuery);
                
                if (existingSnap.empty) {
                    const commenterRef = doc(db, 'users', commenterId);
                    const commenterSnap = await getDoc(commenterRef);
                    const commenterName = commenterSnap.exists() ? (commenterSnap.data().name || 'Someone') : 'Someone';
                    const commenterAvatar = commenterSnap.exists() ? (commenterSnap.data().profileImage || 'images/default-profile.jpg') : 'images/default-profile.jpg';
                    const shortComment = commentData.text.length > 40 ? commentData.text.substring(0, 40) + '...' : commentData.text;
                    const postPreview = postData.caption ? (postData.caption.length > 30 ? postData.caption.substring(0, 30) + '...' : postData.caption) : 'post';
                    
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
                }
                
                processedPostComments.add(commentKey);
                localStorage.setItem(`post_comments_${currentUser.uid}`, JSON.stringify([...processedPostComments]));
            }
        }
    } catch (error) {
        console.error('Error checking post comments:', error);
    }
}

// ==================== STREAM NOTIFICATIONS (WORKING) ====================

// Check for new stream likes
async function checkForNewStreamLikes() {
    if (!currentUser) return;
    
    try {
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
            const lastLikeCount = streamLikeCounts.get(streamId) || 0;
            
            if (currentLikeCount > lastLikeCount) {
                const likesIncreased = currentLikeCount - lastLikeCount;
                console.log(`Stream ${streamId} got ${likesIncreased} new likes`);
                
                const streamPreview = streamData.headline ? (streamData.headline.length > 30 ? streamData.headline.substring(0, 30) + '...' : streamData.headline) : 'video';
                
                const existingQuery = query(
                    collection(db, 'notifications'),
                    where('userId', '==', currentUser.uid),
                    where('type', '==', 'stream_like'),
                    where('relatedId', '==', streamId),
                    orderBy('timestamp', 'desc'),
                    limit(1)
                );
                
                const existingSnap = await getDocs(existingQuery);
                let shouldCreate = true;
                
                if (!existingSnap.empty) {
                    const lastNotif = existingSnap.docs[0].data();
                    const lastNotifTime = lastNotif.timestamp?.toDate?.() || new Date(0);
                    const timeSince = Date.now() - lastNotifTime.getTime();
                    if (timeSince < 60000) {
                        shouldCreate = false;
                    }
                }
                
                if (shouldCreate) {
                    await addDoc(collection(db, 'notifications'), {
                        type: 'stream_like',
                        title: 'New Like on Your Video',
                        message: `Someone liked your video: "${streamPreview}"`,
                        relatedId: streamId,
                        streamId: streamId,
                        streamPreview: streamPreview,
                        userId: currentUser.uid,
                        timestamp: serverTimestamp(),
                        read: false,
                        likeCount: likesIncreased
                    });
                }
            }
            
            streamLikeCounts.set(streamId, currentLikeCount);
            localStorage.setItem(`stream_likes_${currentUser.uid}`, JSON.stringify([...streamLikeCounts]));
        }
    } catch (error) {
        console.error('Error checking stream likes:', error);
    }
}

// Check for new stream comments
async function checkForNewStreamComments() {
    if (!currentUser) return;
    
    try {
        const streamsQuery = query(
            collection(db, 'streams'),
            where('authorId', '==', currentUser.uid),
            where('isActive', '==', true)
        );
        
        const streamsSnap = await getDocs(streamsQuery);
        
        for (const streamDoc of streamsSnap.docs) {
            const streamId = streamDoc.id;
            const streamData = streamDoc.data();
            
            const commentsQuery = collection(db, 'streams', streamId, 'comments');
            const commentsSnap = await getDocs(commentsQuery);
            
            for (const commentDoc of commentsSnap.docs) {
                const commentData = commentDoc.data();
                const commenterId = commentData.userId;
                const commentId = commentDoc.id;
                
                if (commenterId === currentUser.uid) continue;
                
                const commentKey = `stream_${streamId}_${commentId}`;
                if (processedStreamComments.has(commentKey)) continue;
                
                const existingQuery = query(
                    collection(db, 'notifications'),
                    where('userId', '==', currentUser.uid),
                    where('type', '==', 'stream_comment'),
                    where('relatedId', '==', commentId),
                    where('senderId', '==', commenterId)
                );
                
                const existingSnap = await getDocs(existingQuery);
                
                if (existingSnap.empty) {
                    const commenterRef = doc(db, 'users', commenterId);
                    const commenterSnap = await getDoc(commenterRef);
                    const commenterName = commenterSnap.exists() ? (commenterSnap.data().name || 'Someone') : 'Someone';
                    const commenterAvatar = commenterSnap.exists() ? (commenterSnap.data().profileImage || 'images/default-profile.jpg') : 'images/default-profile.jpg';
                    const shortComment = commentData.text.length > 40 ? commentData.text.substring(0, 40) + '...' : commentData.text;
                    const streamPreview = streamData.headline ? (streamData.headline.length > 30 ? streamData.headline.substring(0, 30) + '...' : streamData.headline) : 'video';
                    
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
                }
                
                processedStreamComments.add(commentKey);
                localStorage.setItem(`stream_comments_${currentUser.uid}`, JSON.stringify([...processedStreamComments]));
            }
        }
    } catch (error) {
        console.error('Error checking stream comments:', error);
    }
}

// ==================== REPLY MODAL (WORKING FOR BOTH POSTS AND STREAMS) ====================

function setupReplyModal() {
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
        addReplyModalStyles();
        
        document.querySelector('.reply-modal-close').addEventListener('click', closeReplyModal);
        document.getElementById('replyModalSend').addEventListener('click', submitReply);
        document.getElementById('replyModalInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') submitReply();
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeReplyModal();
        });
    }
}

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
                animation: slideUp 0.3s ease;
            }
            @keyframes slideUp {
                from { transform: translateY(100%); }
                to { transform: translateY(0); }
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
            .reply-to-name {
                font-weight: 600;
                color: var(--primary);
                font-size: 14px;
                cursor: pointer;
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
                cursor: pointer;
                transition: all 0.2s;
            }
            .reply-modal-send:hover {
                transform: scale(1.1);
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
            }
        `;
        document.head.appendChild(styles);
    }
}

function openReplyModal(commentData, postId, commentId) {
    const modal = document.getElementById('replyModal');
    if (!modal) return;
    
    currentCommentPostId = postId;
    currentCommentId = commentId;
    currentReplyToUserId = commentData.userId;
    
    modal.dataset.type = 'post';
    modal.dataset.postId = postId;
    modal.dataset.commentId = commentId;
    
    document.getElementById('replyToAvatar').src = commentData.userAvatar || 'images/default-profile.jpg';
    document.getElementById('replyToName').textContent = `Replying to ${commentData.userName || 'User'}`;
    let commentText = commentData.text || '';
    if (commentText.length > 50) commentText = commentText.substring(0, 50) + '...';
    document.getElementById('replyToText').textContent = `"${commentText}"`;
    document.getElementById('replyModalInput').value = '';
    document.getElementById('replyModalInput').focus();
    
    modal.style.display = 'block';
}

function openStreamReplyModal(commentData, streamId, commentId) {
    const modal = document.getElementById('replyModal');
    if (!modal) return;
    
    currentCommentPostId = streamId;
    currentCommentId = commentId;
    currentReplyToUserId = commentData.userId;
    
    modal.dataset.type = 'stream';
    modal.dataset.streamId = streamId;
    modal.dataset.commentId = commentId;
    
    document.getElementById('replyToAvatar').src = commentData.userAvatar || 'images/default-profile.jpg';
    document.getElementById('replyToName').textContent = `Replying to ${commentData.userName || 'User'}`;
    let commentText = commentData.text || '';
    if (commentText.length > 50) commentText = commentText.substring(0, 50) + '...';
    document.getElementById('replyToText').textContent = `"${commentText}"`;
    document.getElementById('replyModalInput').value = '';
    document.getElementById('replyModalInput').focus();
    
    modal.style.display = 'block';
}

function closeReplyModal() {
    const modal = document.getElementById('replyModal');
    if (modal) {
        modal.style.display = 'none';
        currentCommentPostId = null;
        currentCommentId = null;
        currentReplyToUserId = null;
    }
}

async function submitReply() {
    const modal = document.getElementById('replyModal');
    if (!modal) return;
    
    const replyText = document.getElementById('replyModalInput').value.trim();
    if (!replyText) {
        alert('Please enter a reply');
        return;
    }
    
    if (!currentUser) {
        alert('Please login to reply');
        return;
    }
    
    const type = modal.dataset.type;
    
    try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.exists() ? userSnap.data() : {};
        const userName = userData.name || currentUser.displayName || 'User';
        const userAvatar = userData.profileImage || currentUser.photoURL || 'images/default-profile.jpg';
        
        if (type === 'post') {
            const postId = modal.dataset.postId;
            const commentId = modal.dataset.commentId;
            
            await addDoc(collection(db, 'posts', postId, 'comments', commentId, 'replies'), {
                userId: currentUser.uid,
                userName: userName,
                userAvatar: userAvatar,
                text: replyText,
                replyToUserId: currentReplyToUserId,
                createdAt: serverTimestamp(),
                likes: 0
            });
            
            await updateDoc(doc(db, 'posts', postId, 'comments', commentId), {
                repliesCount: increment(1)
            });
            
        } else if (type === 'stream') {
            const streamId = modal.dataset.streamId;
            const commentId = modal.dataset.commentId;
            
            await addDoc(collection(db, 'streams', streamId, 'comments', commentId, 'replies'), {
                userId: currentUser.uid,
                userName: userName,
                userAvatar: userAvatar,
                text: replyText,
                replyToUserId: currentReplyToUserId,
                createdAt: serverTimestamp(),
                likes: 0
            });
            
            await updateDoc(doc(db, 'streams', streamId, 'comments', commentId), {
                repliesCount: increment(1)
            });
        }
        
        showCustomNotification('Reply posted!', 'success');
        closeReplyModal();
        
    } catch (error) {
        console.error('Error adding reply:', error);
        alert('Error posting reply: ' + error.message);
    }
}

// ==================== DISPLAY NOTIFICATIONS ====================

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

    const sortedDocs = [...notificationDocs].sort((a, b) => {
        const timeA = a.timestamp?.toDate?.() || new Date(0);
        const timeB = b.timestamp?.toDate?.() || new Date(0);
        return timeB - timeA;
    });

    const notificationsHTML = sortedDocs.map(doc => {
        const timeAgo = formatTime(doc.timestamp);
        const iconClass = getNotificationIcon(doc.type);
        const unreadClass = doc.read ? '' : 'unread';
        const unreadDot = doc.read ? '' : '<div class="unread-dot"></div>';
        
        const showReplyButton = (doc.type === 'comment' || doc.type === 'stream_comment') && doc.actionable === true;
        
        const replyButtonHTML = showReplyButton ? `
            <button class="action-btn reply-to-comment-btn" 
                    data-id="${doc.id}"
                    data-type="${doc.type}"
                    data-stream-id="${doc.streamId || ''}" 
                    data-post-id="${doc.postId || ''}" 
                    data-comment-id="${doc.commentId || doc.relatedId || ''}"
                    data-user-id="${doc.senderId || ''}"
                    data-user-name="${doc.senderName || 'User'}"
                    data-user-avatar="${doc.senderAvatar || 'images/default-profile.jpg'}"
                    data-comment-text="${doc.commentText || ''}"
                    title="Reply to comment">
                <i class="fas fa-reply"></i>
            </button>
        ` : '';
        
        return `
            <div class="notification-item ${unreadClass}" data-id="${doc.id}">
                <div class="notification-icon ${doc.type}">
                    <i class="${iconClass}"></i>
                </div>
                <div class="notification-content">
                    <div class="notification-title">
                        ${doc.title}
                        ${unreadDot}
                    </div>
                    <div class="notification-text">${doc.message}</div>
                    <div class="notification-time">${timeAgo}</div>
                </div>
                <div class="notification-actions">
                    ${replyButtonHTML}
                    ${!doc.read ? `
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

function addNotificationActionListeners() {
    document.querySelectorAll('.mark-read-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const notificationId = button.closest('.notification-item').dataset.id;
            markNotificationAsRead(notificationId);
        });
    });

    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const notificationId = button.closest('.notification-item').dataset.id;
            deleteNotification(notificationId);
        });
    });

    document.querySelectorAll('.notification-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.closest('.action-btn')) return;
            handleNotificationClick(item.dataset.id);
        });
    });
}

async function handleNotificationClick(notificationId) {
    await markNotificationAsRead(notificationId);
    
    try {
        const notificationDoc = await getDoc(doc(db, 'notifications', notificationId));
        if (notificationDoc.exists()) {
            const notification = notificationDoc.data();
            
            if (notification.type === 'stream_like' || notification.type === 'stream_comment') {
                window.location.href = `stream.html?video=${notification.streamId}`;
            } else if (notification.type === 'like' || notification.type === 'comment') {
                window.location.href = `posts.html?post=${notification.postId}`;
            } else {
                window.location.href = 'notification.html';
            }
        }
    } catch (error) {
        console.error('Error:', error);
        window.location.href = 'notification.html';
    }
}

async function markNotificationAsRead(notificationId) {
    try {
        await updateDoc(doc(db, 'notifications', notificationId), {
            read: true,
            readAt: serverTimestamp()
        });
        
        const item = document.querySelector(`[data-id="${notificationId}"]`);
        if (item) {
            item.classList.remove('unread');
            const dot = item.querySelector('.unread-dot');
            if (dot) dot.remove();
            const btn = item.querySelector('.mark-read-btn');
            if (btn) btn.remove();
        }
        
        updateNotificationBadge();
    } catch (error) {
        console.error('Error marking as read:', error);
    }
}

async function deleteNotification(notificationId) {
    try {
        await deleteDoc(doc(db, 'notifications', notificationId));
        const item = document.querySelector(`[data-id="${notificationId}"]`);
        if (item) item.remove();
        updateNotificationBadge();
    } catch (error) {
        console.error('Error deleting:', error);
    }
}

function updateNotificationBadge(count) {
    if (count === undefined) {
        count = unreadCount;
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

function getNotificationIcon(type) {
    switch (type) {
        case 'like': return 'fas fa-heart';
        case 'stream_like': return 'fas fa-heart';
        case 'comment': return 'fas fa-comment';
        case 'stream_comment': return 'fas fa-comment';
        case 'message': return 'fas fa-comment-alt';
        default: return 'fas fa-bell';
    }
}

function formatTime(timestamp) {
    if (!timestamp) return '';
    let date;
    try {
        date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        if (isNaN(date.getTime())) return '';
    } catch (e) { return ''; }
    
    const now = new Date();
    const diffMins = Math.floor((now - date) / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

function showCustomNotification(message, type = 'info') {
    const existing = document.querySelector('.custom-notification');
    if (existing) existing.remove();
    
    const notification = document.createElement('div');
    notification.className = `custom-notification ${type}`;
    notification.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-info-circle'}"></i><span>${message}</span>`;
    notification.style.cssText = 'position:fixed;top:20px;right:20px;padding:12px 20px;border-radius:8px;background:#10b981;color:white;z-index:10003;animation:slideInRight 0.3s ease;';
    if (type === 'info') notification.style.background = '#3b82f6';
    
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ==================== INITIALIZATION ====================

function loadSavedData() {
    if (!currentUser) return;
    try {
        const postLikes = localStorage.getItem(`post_likes_${currentUser.uid}`);
        if (postLikes) processedPostLikes = new Set(JSON.parse(postLikes));
        
        const postComments = localStorage.getItem(`post_comments_${currentUser.uid}`);
        if (postComments) processedPostComments = new Set(JSON.parse(postComments));
        
        const streamLikes = localStorage.getItem(`stream_likes_${currentUser.uid}`);
        if (streamLikes) {
            const parsed = JSON.parse(streamLikes);
            if (Array.isArray(parsed)) {
                streamLikeCounts = new Map(parsed);
            }
        }
        
        const streamComments = localStorage.getItem(`stream_comments_${currentUser.uid}`);
        if (streamComments) processedStreamComments = new Set(JSON.parse(streamComments));
        
        const savedUnread = localStorage.getItem(`notification_count_${currentUser.uid}`);
        if (savedUnread) updateNotificationBadge(parseInt(savedUnread));
    } catch (e) {}
}

function setupNotificationCreators() {
    if (!currentUser) return;
    
    checkIntervals.forEach(interval => clearInterval(interval));
    checkIntervals = [];
    
    const postLikeInterval = setInterval(checkForNewPostLikes, 10000);
    const postCommentInterval = setInterval(checkForNewPostComments, 10000);
    const streamLikeInterval = setInterval(checkForNewStreamLikes, 10000);
    const streamCommentInterval = setInterval(checkForNewStreamComments, 10000);
    
    checkIntervals.push(postLikeInterval, postCommentInterval, streamLikeInterval, streamCommentInterval);
    
    setTimeout(() => {
        checkForNewPostLikes();
        checkForNewPostComments();
        checkForNewStreamLikes();
        checkForNewStreamComments();
    }, 2000);
}

function setupNotificationListener() {
    if (!currentUser) return;
    if (unsubscribeNotifications) unsubscribeNotifications();
    
    try {
        const notificationsQuery = query(
            collection(db, 'notifications'),
            where('userId', '==', currentUser.uid)
        );
        
        unsubscribeNotifications = onSnapshot(notificationsQuery, (snapshot) => {
            const allNotifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            allNotifications.forEach(n => n.timestampObj = n.timestamp?.toDate?.() || new Date(0));
            
            const unreadNotifications = allNotifications.filter(n => !n.read);
            const previousUnread = unreadCount;
            unreadCount = unreadNotifications.length;
            
            updateNotificationBadge(unreadCount);
            localStorage.setItem(`notification_count_${currentUser.uid}`, unreadCount);
            
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const notification = change.doc.data();
                    if (!notification.read) {
                        soundManager.playNotificationSound(notification.type);
                    }
                }
            });
            
            if (window.location.pathname.includes('notification.html')) {
                const sorted = allNotifications.sort((a, b) => b.timestampObj - a.timestampObj);
                displayNotifications(sorted);
            }
            
            if (!window.location.pathname.includes('notification.html') && unreadCount > previousUnread && Date.now() - lastNotificationTime > 5000) {
                showNotificationPopup();
                lastNotificationTime = Date.now();
            }
        });
    } catch (error) {
        console.error('Error setting up listener:', error);
    }
}

function showNotificationPopup() {
    if (notificationShown || window.location.pathname.includes('notification.html') || unreadCount === 0) return;
    
    soundManager.playSoftBell();
    notificationShown = true;
    
    const popup = document.createElement('div');
    popup.className = 'notification-popup';
    popup.innerHTML = `
        <div class="popup-content">
            <div class="popup-icon"><i class="fas fa-bell"></i></div>
            <div class="popup-text">
                <div class="popup-title">New notifications</div>
                <div class="popup-message">${unreadCount} unread</div>
            </div>
            <button class="popup-mark-btn"><i class="fas fa-check"></i> Mark</button>
            <button class="popup-close">&times;</button>
        </div>
    `;
    popup.style.cssText = 'position:fixed;top:20px;right:20px;background:linear-gradient(135deg, #b3004b, #ff2d55);border-radius:12px;z-index:10001;animation:slideInRight 0.4s ease;color:white;min-width:300px;';
    
    document.body.appendChild(popup);
    
    setTimeout(() => {
        if (popup.parentNode) {
            popup.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => popup.remove(), 300);
            notificationShown = false;
        }
    }, 5000);
    
    popup.querySelector('.popup-mark-btn')?.addEventListener('click', () => markAllAsReadAndClose(popup));
    popup.querySelector('.popup-close')?.addEventListener('click', () => {
        popup.remove();
        notificationShown = false;
    });
    popup.addEventListener('click', (e) => {
        if (!e.target.closest('.popup-mark-btn') && !e.target.closest('.popup-close')) {
            window.location.href = 'notification.html';
        }
    });
}

async function markAllAsReadAndClose(popup) {
    await markAllNotificationsAsRead();
    if (popup) popup.remove();
    notificationShown = false;
}

async function markAllNotificationsAsRead() {
    if (!currentUser) return;
    try {
        const notificationsQuery = query(
            collection(db, 'notifications'),
            where('userId', '==', currentUser.uid),
            where('read', '==', false)
        );
        const snap = await getDocs(notificationsQuery);
        const batch = writeBatch(db);
        snap.docs.forEach(doc => batch.update(doc.ref, { read: true, readAt: serverTimestamp() }));
        await batch.commit();
        
        document.querySelectorAll('.notification-item.unread').forEach(item => {
            item.classList.remove('unread');
            item.querySelector('.unread-dot')?.remove();
            item.querySelector('.mark-read-btn')?.remove();
        });
        
        updateNotificationBadge(0);
    } catch (error) {
        console.error('Error marking all as read:', error);
    }
}

function initNotificationSystem() {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            loadSavedData();
            setupNotificationListener();
            setupNotificationCreators();
            setupReplyModal();
            updateNotificationBadge();
            addSoundControlButton();
            
            if (window.location.pathname.includes('notification.html')) {
                loadNotificationsForPage();
            }
        } else {
            currentUser = null;
            updateNotificationBadge(0);
            if (unsubscribeNotifications) unsubscribeNotifications();
            checkIntervals.forEach(clearInterval);
        }
    });
}

async function loadNotificationsForPage() {
    if (!currentUser) return;
    try {
        const snap = await getDocs(collection(db, 'notifications'));
        const notifications = [];
        snap.forEach(doc => {
            const data = doc.data();
            if (data.userId === currentUser.uid) {
                notifications.push({ id: doc.id, ...data, timestampObj: data.timestamp?.toDate?.() || new Date(0) });
            }
        });
        notifications.sort((a, b) => b.timestampObj - a.timestampObj);
        displayNotifications(notifications);
    } catch (error) {
        console.error('Error loading notifications:', error);
    }
}

function addSoundControlButton() {
    if (document.getElementById('notification-sound-toggle')) return;
    
    const soundBtn = document.createElement('button');
    soundBtn.id = 'notification-sound-toggle';
    soundBtn.innerHTML = soundManager.soundsEnabled ? '<i class="fas fa-volume-up"></i>' : '<i class="fas fa-volume-mute"></i>';
    soundBtn.style.cssText = 'background:var(--bg-card);border:1px solid var(--border-color);border-radius:50%;width:36px;height:36px;cursor:pointer;margin-left:10px;';
    soundBtn.addEventListener('click', () => {
        soundManager.toggleSounds();
        soundBtn.innerHTML = soundManager.soundsEnabled ? '<i class="fas fa-volume-up"></i>' : '<i class="fas fa-volume-mute"></i>';
    });
    
    const bell = document.querySelector('.notification-bell');
    if (bell && bell.parentNode) {
        bell.parentNode.insertBefore(soundBtn, bell.nextSibling);
    }
}

// Initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNotificationSystem);
} else {
    initNotificationSystem();
}

// Export
window.NotificationSystem = {
    init: initNotificationSystem,
    updateBadge: updateNotificationBadge,
    soundManager: soundManager,
    toggleSounds: () => soundManager.toggleSounds()
};