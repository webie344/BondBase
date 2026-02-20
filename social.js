// social.js - Complete independent social features module for dating site WITH POLLING, REPLIES, FOLLOWERS INTEGRATION, VIDEO POSTING, AND VOTE BUTTONS
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
    getDoc, 
    updateDoc, 
    query, 
    getDocs,
    addDoc,
    deleteDoc,
    serverTimestamp,
    orderBy,
    limit,
    startAfter,
    arrayUnion,
    arrayRemove,
    increment,
    where
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

// Cloudinary configuration
const cloudinaryConfig = {
    cloudName: "ddtdqrh1b",
    uploadPreset: "profile-pictures",
    apiUrl: "https://api.cloudinary.com/v1_1"
};

// Supported video formats
const SUPPORTED_VIDEO_FORMATS = [
    'video/mp4', 'video/quicktime', 'video/x-m4v', 'video/3gpp', 'video/3gpp2',
    'video/mpeg', 'video/webm', 'video/ogg', 'video/x-msvideo', 'video/x-matroska',
    'video/mp2t', 'video/h264', 'video/hevc', 'video/avi', 'video/x-flv',
    'video/x-ms-wmv', 'video/x-ms-asf', 'video/mp4v-es', 'video/mj2',
    'video/x-mpeg', 'video/mp2p', 'video/mp2t', 'video/MP2T'
];

// Supported file extensions
const SUPPORTED_EXTENSIONS = [
    '.mp4', '.mov', '.m4v', '.3gp', '.3g2', '.mpeg', '.mpg', '.webm', '.ogg',
    '.avi', '.mkv', '.ts', '.mts', '.m2ts', '.flv', '.f4v', '.wmv', '.mpg', '.mpeg',
    '.qt', '.mxf', '.m2v', '.m4p', '.m4b', '.mp2', '.mpv', '.mpe', '.m1v', '.m2p',
    '.divx', '.xvid', '.vob', '.mod', '.tod', '.mts', '.m2t', '.m2ts'
];

class SocialManager {
    constructor() {
        this.currentUser = null;
        this.SOCIAL_PLATFORMS = {
            facebook: {
                name: 'Facebook',
                icon: 'fab fa-facebook',
                baseUrl: 'https://facebook.com/',
                placeholder: 'Facebook username',
                color: '#1877F2'
            },
            instagram: {
                name: 'Instagram',
                icon: 'fab fa-instagram',
                baseUrl: 'https://instagram.com/',
                placeholder: 'Instagram username',
                color: '#E4405F'
            },
            snapchat: {
                name: 'Snapchat',
                icon: 'fab fa-snapchat-ghost',
                baseUrl: 'https://snapchat.com/add/',
                placeholder: 'Snapchat username',
                color: '#FFFC00'
            },
            tiktok: {
                name: 'TikTok',
                icon: 'fab fa-tiktok',
                baseUrl: 'https://tiktok.com/@',
                placeholder: 'TikTok username',
                color: '#000000'
            }
        };
        
        this.viewedPosts = new Set();
        this.likedPosts = new Set();
        this.votedPosts = new Map(); // Store user votes for posts (up/down)
        this.lastVisiblePost = null;
        this.isLoading = false;
        this.hasMorePosts = true;
        this.postsPerPage = 15;
        this.allPosts = [];
        
        // People You May Know Settings
        this.PYMK_PROFILES_PER_LOAD = 10;
        this.PYMK_MIN_POSTS_BEFORE_SHOW = 6;
        this.PYMK_MAX_POSTS_BEFORE_SHOW = 10;
        this.viewedPYMKProfiles = new Set();
        this.currentPYMKProfiles = [];
        this.pymkLastVisible = null;
        this.hasMorePYMK = true;
        
        // Video upload settings
        this.maxVideoSize = 1024 * 1024 * 1024; // 1GB max
        
        // Flag to prevent double submission
        this.isSubmitting = false;
        
        // Poll settings
        this.maxPollOptions = 4;
        this.minPollOptions = 2;
        
        // Add all styles
        this.addAllStyles();
        
        this.init();
    }

    init() {
        onAuthStateChanged(auth, (user) => {
            if (user) {
                this.currentUser = user;
                this.initializeSocialFeatures();
                this.setupNavigation();
                this.setupGlobalEventListeners();
                this.loadViewedPosts();
                this.loadLikedPosts();
                this.loadVotedPosts();
                this.loadViewedPYMKProfiles();
                this.setupPollEventListeners();
            } else {
                if (!window.location.pathname.includes('login.html') && 
                    !window.location.pathname.includes('signup.html') &&
                    !window.location.pathname.includes('index.html')) {
                    window.location.href = 'login.html';
                }
            }
        });
    }

    // ==================== VOTE FUNCTIONS (UP/DOWN ARROWS) ====================
    
    loadVotedPosts() {
        if (!this.currentUser) return;
        const stored = localStorage.getItem(`votedPosts_${this.currentUser.uid}`);
        if (stored) {
            try {
                this.votedPosts = new Map(JSON.parse(stored));
            } catch (e) {
                this.votedPosts = new Map();
            }
        }
    }

    saveVotedPosts() {
        if (!this.currentUser) return;
        try {
            localStorage.setItem(`votedPosts_${this.currentUser.uid}`, JSON.stringify([...this.votedPosts]));
        } catch (e) {
            console.error('Error saving voted posts:', e);
        }
    }

    getUserVoteForPost(postId) {
        return this.votedPosts.get(postId) || null; // Returns 'up', 'down', or null
    }

    async handleVote(postId, voteType, voteButton) {
        if (!this.currentUser) {
            alert('Please login to vote');
            return;
        }

        // Prevent multiple rapid clicks
        if (voteButton.classList.contains('voting')) {
            return;
        }
        
        voteButton.classList.add('voting');

        try {
            const postRef = doc(db, 'posts', postId);
            const postSnap = await getDoc(postRef);
            
            if (!postSnap.exists()) {
                console.error('Post not found');
                voteButton.classList.remove('voting');
                return;
            }

            const post = postSnap.data();
            const currentVote = this.getUserVoteForPost(postId);
            
            // Initialize vote counts if they don't exist
            let upvotes = post.upvotes || 0;
            let downvotes = post.downvotes || 0;
            
            let newVoteType = voteType;
            
            // If user clicked the same button, remove their vote
            if (currentVote === voteType) {
                if (voteType === 'up') {
                    upvotes = Math.max(0, upvotes - 1);
                } else if (voteType === 'down') {
                    downvotes = Math.max(0, downvotes - 1);
                }
                this.votedPosts.delete(postId);
                newVoteType = null;
            } 
            // If user had opposite vote, switch their vote
            else if (currentVote === 'up' && voteType === 'down') {
                upvotes = Math.max(0, upvotes - 1);
                downvotes += 1;
                this.votedPosts.set(postId, 'down');
            }
            else if (currentVote === 'down' && voteType === 'up') {
                downvotes = Math.max(0, downvotes - 1);
                upvotes += 1;
                this.votedPosts.set(postId, 'up');
            }
            // If user had no vote, add their vote
            else if (!currentVote) {
                if (voteType === 'up') {
                    upvotes += 1;
                } else if (voteType === 'down') {
                    downvotes += 1;
                }
                this.votedPosts.set(postId, voteType);
            }
            
            // Update Firestore
            await updateDoc(postRef, {
                upvotes: upvotes,
                downvotes: downvotes,
                updatedAt: serverTimestamp()
            });
            
            // Save to localStorage
            this.saveVotedPosts();
            
            // Update UI
            this.updateVoteUI(postId, upvotes, downvotes, this.votedPosts.get(postId) || null);
            
            this.showNotification(
                newVoteType ? `Voted ${newVoteType}!` : 'Vote removed',
                'success'
            );
            
        } catch (error) {
            console.error('Error voting:', error);
            this.showNotification('Error voting: ' + error.message, 'error');
        } finally {
            voteButton.classList.remove('voting');
        }
    }

    updateVoteUI(postId, upvotes, downvotes, userVote) {
        const postElement = document.querySelector(`.post-item[data-post-id="${postId}"]`);
        if (!postElement) return;
        
        const upvoteBtn = postElement.querySelector('.vote-btn.up');
        const downvoteBtn = postElement.querySelector('.vote-btn.down');
        const upvoteCount = postElement.querySelector('.upvote-count');
        const downvoteCount = postElement.querySelector('.downvote-count');
        
        if (upvoteCount) upvoteCount.textContent = this.formatCount(upvotes);
        if (downvoteCount) downvoteCount.textContent = this.formatCount(downvotes);
        
        // Update active states
        if (upvoteBtn) {
            upvoteBtn.classList.toggle('active', userVote === 'up');
        }
        if (downvoteBtn) {
            downvoteBtn.classList.toggle('active', userVote === 'down');
        }
    }

    // ==================== POLL EVENT LISTENERS ====================
    setupPollEventListeners() {
        document.removeEventListener('click', this.handlePollClick);
        
        this.handlePollClick = (e) => {
            const pollOption = e.target.closest('.poll-option-content');
            
            if (pollOption) {
                e.preventDefault();
                e.stopPropagation();
                
                const postId = pollOption.dataset.postId;
                const optionId = pollOption.dataset.optionId;
                
                const pollContainer = pollOption.closest('.post-poll-container');
                const hasVoted = pollContainer?.querySelector('.poll-closed-badge')?.textContent.includes('You voted');
                const isClosed = pollContainer?.querySelector('.poll-closed-badge')?.textContent.includes('closed');
                
                if (hasVoted) {
                    this.showNotification('You have already voted in this poll', 'warning');
                    return;
                }
                
                if (isClosed) {
                    this.showNotification('This poll is closed', 'warning');
                    return;
                }
                
                if (postId && optionId) {
                    this.castVote(postId, optionId);
                }
            }
        };
        
        document.addEventListener('click', this.handlePollClick);
    }

    // ==================== FORMAT COUNT FUNCTION ====================
    formatCount(count) {
        if (!count && count !== 0) return '0';
        
        const num = typeof count === 'number' ? count : parseInt(count);
        
        if (isNaN(num)) return '0';
        
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
        }
        
        return num.toString();
    }

    // ==================== FORMAT DURATION ====================
    formatDuration(seconds) {
        if (!seconds || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // ==================== FORMAT FILE SIZE ====================
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // ==================== FORMAT TIME ====================
    formatTime(timestamp) {
        if (!timestamp) return 'Just now';
        
        try {
            const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            const now = new Date();
            const diff = now - date;
            const minutes = Math.floor(diff / 60000);
            const hours = Math.floor(minutes / 60);
            const days = Math.floor(hours / 24);

            if (minutes < 1) return 'Just now';
            if (minutes < 60) return `${minutes}m ago`;
            if (hours < 24) return `${hours}h ago`;
            if (days < 7) return `${days}d ago`;
            return date.toLocaleDateString();
        } catch (error) {
            return 'Recently';
        }
    }

    // ==================== SHUFFLE ARRAY ====================
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    // ==================== ADD ALL STYLES ====================
    addAllStyles() {
        if (!document.getElementById('socialManagerStyles')) {
            const style = document.createElement('style');
            style.id = 'socialManagerStyles';
            style.textContent = `
                /* ========== TWITTER-LIKE LAYOUT STYLES ========== */
                .posts-container {
                    max-width: 600px;
                    margin: 0 auto;
                    background: transparent;
                }

                .post-item {
                    background: transparent;
                    border: none;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                    padding: 16px 16px;
                    margin: 0;
                    transition: background-color 0.2s ease;
                    position: relative;
                }

                .post-item:hover {
                    background-color: rgba(255, 255, 255, 0.02);
                }

                .post-header {
                    display: flex;
                    align-items: flex-start;
                    gap: 12px;
                    margin-bottom: 8px;
                    position: relative;
                }

                .post-author-avatar {
                    width: 48px;
                    height: 48px;
                    border-radius: 50%;
                    object-fit: cover;
                    flex-shrink: 0;
                }

                .post-author-info {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                }

                .post-author-info h4 {
                    margin: 0;
                    font-size: 15px;
                    font-weight: 700;
                    color: #fff;
                    line-height: 1.2;
                }

                .post-author-info h4:hover {
                    text-decoration: underline;
                    cursor: pointer;
                }

                .post-time {
                    font-size: 13px;
                    color: #6b6f76;
                    margin-top: 2px;
                }

                .post-content {
                    margin-left: 60px;
                    margin-bottom: 12px;
                    font-size: 15px;
                    line-height: 1.5;
                    color: #e7e9ea;
                    word-wrap: break-word;
                }

                .post-caption {
                    margin: 8px 0 4px 0;
                    white-space: pre-wrap;
                }

                /* ========== MEDIA CONTAINERS ========== */
                .post-image-container {
                    margin-top: 12px;
                    border-radius: 16px;
                    overflow: hidden;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    background: #000;
                }

                .post-image {
                    width: 100%;
                    max-height: 400px;
                    object-fit: contain;
                    display: block;
                }

                .video-thumbnail-container {
                    position: relative;
                    width: 100%;
                    height: 0;
                    padding-bottom: 56.25%;
                    background: #000;
                    border-radius: 16px;
                    overflow: hidden;
                    cursor: pointer;
                    margin-top: 12px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }

                .video-thumbnail-image {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                .video-play-button-center {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 50px;
                    height: 50px;
                    background: rgba(0, 0, 0, 0.7);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-size: 20px;
                    transition: all 0.2s ease;
                    border: 2px solid rgba(255, 255, 255, 0.3);
                }

                .video-thumbnail-container:hover .video-play-button-center {
                    background: #ff4b6e;
                    border-color: white;
                    transform: translate(-50%, -50%) scale(1.1);
                }

                .video-duration-overlay {
                    position: absolute;
                    bottom: 12px;
                    right: 12px;
                    background: rgba(0, 0, 0, 0.85);
                    color: white;
                    padding: 4px 8px;
                    border-radius: 12px;
                    font-size: 12px;
                    font-weight: 600;
                    z-index: 2;
                    letter-spacing: 0.5px;
                }

                /* ========== POST ACTIONS ========== */
                .post-actions {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    max-width: 425px;
                    margin-left: 60px;
                    margin-top: 12px;
                    padding-top: 4px;
                }

                .action-group {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }

                .vote-buttons {
                    display: flex;
                    align-items: center;
                    gap: 2px;
                    background: transparent;
                    border-radius: 9999px;
                }

                .vote-btn {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    background: transparent;
                    border: none;
                    color: #6b6f76;
                    font-size: 13px;
                    cursor: pointer;
                    padding: 6px 10px;
                    border-radius: 9999px;
                    transition: all 0.2s ease;
                }

                .vote-btn i {
                    font-size: 16px;
                }

                .vote-btn.up:hover {
                    background: rgba(52, 168, 83, 0.1);
                    color: #34a853;
                }

                .vote-btn.down:hover {
                    background: rgba(234, 67, 53, 0.1);
                    color: #ea4335;
                }

                .vote-btn.up.active {
                    color: #34a853;
                }

                .vote-btn.down.active {
                    color: #ea4335;
                }

                .vote-count {
                    font-weight: 500;
                    min-width: 20px;
                    text-align: center;
                }

                .post-action {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    background: transparent;
                    border: none;
                    color: #6b6f76;
                    font-size: 13px;
                    cursor: pointer;
                    padding: 6px 12px;
                    border-radius: 9999px;
                    transition: all 0.2s ease;
                }

                .post-action i {
                    font-size: 16px;
                }

                .post-action:hover {
                    background: rgba(255, 75, 110, 0.1);
                    color: #ff4b6e;
                }

                .post-action.liked {
                    color: #ff4b6e;
                }

                .post-action.liked i {
                    color: #ff4b6e;
                }

                .post-action.active {
                    color: #ff4b6e;
                    background: rgba(255, 75, 110, 0.1);
                }

                /* ========== FOLLOW BUTTON ========== */
                .follow-btn-post {
                    position: absolute;
                    top: 0;
                    right: 0;
                    background: transparent;
                    border: 1px solid #ff4b6e;
                    color: #ff4b6e;
                    padding: 4px 12px;
                    border-radius: 9999px;
                    font-size: 12px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .follow-btn-post:hover {
                    background: #ff4b6e;
                    color: white;
                }

                .follow-btn-post.following {
                    background: transparent;
                    border-color: #6b6f76;
                    color: #6b6f76;
                }

                .follow-btn-post.following:hover {
                    border-color: #ff4b6e;
                    color: #ff4b6e;
                    background: rgba(255, 75, 110, 0.1);
                }

                /* ========== MEDIA TYPE INDICATOR ========== */
                .media-type-indicator {
                    position: absolute;
                    top: 0;
                    right: 70px;
                    color: #6b6f76;
                    font-size: 13px;
                }

                /* ========== COMMENTS SECTION ========== */
                .comments-section {
                    margin-left: 60px;
                    margin-top: 12px;
                    padding-top: 12px;
                    border-top: 1px solid rgba(255, 255, 255, 0.05);
                }

                .add-comment {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 16px;
                }

                .add-comment input {
                    flex: 1;
                    padding: 10px 16px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 9999px;
                    background: transparent;
                    color: #fff;
                    font-size: 14px;
                }

                .add-comment input:focus {
                    outline: none;
                    border-color: #ff4b6e;
                }

                .add-comment button {
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    border: none;
                    background: #ff4b6e;
                    color: white;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s ease;
                }

                .add-comment button:hover {
                    transform: scale(1.1);
                }

                .comments-list {
                    max-height: 300px;
                    overflow-y: auto;
                }

                .comment-item {
                    padding: 12px 0;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                }

                .comment-header {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 4px;
                }

                .comment-avatar {
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    object-fit: cover;
                }

                .comment-info {
                    flex: 1;
                }

                .comment-info strong {
                    font-size: 14px;
                    color: #fff;
                }

                .comment-time {
                    font-size: 12px;
                    color: #6b6f76;
                    margin-left: 8px;
                }

                .comment-text {
                    font-size: 14px;
                    color: #e7e9ea;
                    margin-left: 40px;
                    word-wrap: break-word;
                }

                .comment-actions {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    margin-left: 40px;
                    margin-top: 8px;
                }

                .comment-action-btn {
                    background: transparent;
                    border: none;
                    color: #6b6f76;
                    font-size: 12px;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    padding: 4px 8px;
                    border-radius: 9999px;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .comment-action-btn:hover {
                    background: rgba(255, 75, 110, 0.1);
                    color: #ff4b6e;
                }

                .view-replies-btn {
                    background: transparent;
                    border: none;
                    color: #ff4b6e;
                    font-size: 12px;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    padding: 6px 12px;
                    border-radius: 9999px;
                    cursor: pointer;
                    margin-left: 40px;
                    margin-top: 4px;
                }

                .view-replies-btn:hover {
                    background: rgba(255, 75, 110, 0.1);
                }

                .replies-container {
                    margin-left: 40px;
                    margin-top: 8px;
                    padding-left: 16px;
                    border-left: 2px solid rgba(255, 255, 255, 0.1);
                }

                .reply-item {
                    padding: 10px 0;
                }

                .reply-header {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 4px;
                }

                .reply-avatar {
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    object-fit: cover;
                }

                .reply-info strong {
                    font-size: 13px;
                    color: #fff;
                }

                .reply-time {
                    font-size: 11px;
                    color: #6b6f76;
                    margin-left: 4px;
                }

                .reply-text {
                    font-size: 13px;
                    color: #e7e9ea;
                    margin-left: 32px;
                }

                .reply-mention {
                    color: #ff4b6e;
                    font-weight: 600;
                    margin-right: 4px;
                }

                /* ========== POLL STYLES ========== */
                .post-poll-container {
                    margin-top: 12px;
                    margin-bottom: 8px;
                    background: rgba(255, 255, 255, 0.03);
                    border-radius: 16px;
                    padding: 16px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }

                .poll-header {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 12px;
                }

                .poll-header i {
                    color: #ff4b6e;
                    font-size: 18px;
                }

                .poll-header h4 {
                    margin: 0;
                    font-size: 15px;
                    font-weight: 600;
                    color: #fff;
                }

                .poll-question-display {
                    font-size: 15px;
                    color: #fff;
                    margin-bottom: 12px;
                }

                .poll-options-list {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .poll-option-item {
                    position: relative;
                }

                .poll-option-content {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 10px 12px;
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 9999px;
                    cursor: pointer;
                    transition: all 0.2s;
                    position: relative;
                    z-index: 2;
                }

                .poll-option-content:hover {
                    border-color: #ff4b6e;
                    background: rgba(255, 75, 110, 0.1);
                }

                .poll-option-left {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    flex: 1;
                }

                .poll-checkmark {
                    width: 18px;
                    height: 18px;
                    border-radius: 50%;
                    background: transparent;
                    border: 2px solid #6b6f76;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .poll-option-content.voted .poll-checkmark {
                    background: #ff4b6e;
                    border-color: #ff4b6e;
                }

                .poll-checkmark i {
                    color: white;
                    font-size: 10px;
                    display: none;
                }

                .poll-option-content.voted .poll-checkmark i {
                    display: inline;
                }

                .poll-option-text {
                    font-size: 14px;
                    color: #fff;
                }

                .poll-option-right {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .poll-percentage {
                    font-size: 14px;
                    font-weight: 600;
                    color: #ff4b6e;
                    min-width: 45px;
                    text-align: right;
                }

                .poll-count {
                    font-size: 12px;
                    color: #6b6f76;
                }

                .poll-progress-bar-bg {
                    position: absolute;
                    top: 0;
                    left: 0;
                    height: 100%;
                    background: rgba(255, 75, 110, 0.15);
                    border-radius: 9999px;
                    transition: width 0.5s ease;
                    z-index: 1;
                    pointer-events: none;
                }

                .poll-footer {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-top: 12px;
                    padding-top: 12px;
                    border-top: 1px solid rgba(255, 255, 255, 0.1);
                    font-size: 12px;
                    color: #6b6f76;
                }

                .poll-total-votes {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }

                .poll-closed-badge {
                    background: rgba(255, 75, 110, 0.2);
                    color: #ff4b6e;
                    padding: 2px 8px;
                    border-radius: 9999px;
                    font-size: 11px;
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                }

                /* ========== PEOPLE YOU MAY KNOW ========== */
                .pymk-section {
                    background: transparent;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                    padding: 16px;
                    margin: 0;
                }

                .pymk-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 16px;
                }

                .pymk-header h3 {
                    margin: 0;
                    font-size: 16px;
                    color: #fff;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .pymk-header h3 i {
                    color: #ff4b6e;
                }

                .pymk-see-all {
                    background: transparent;
                    border: none;
                    color: #ff4b6e;
                    font-size: 13px;
                    cursor: pointer;
                }

                .pymk-see-all:hover {
                    text-decoration: underline;
                }

                .pymk-content {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    position: relative;
                }

                .pymk-nav-btn {
                    background: rgba(0, 0, 0, 0.5);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    color: #fff;
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s;
                    flex-shrink: 0;
                    z-index: 2;
                }

                .pymk-nav-btn:hover {
                    background: #ff4b6e;
                    border-color: #ff4b6e;
                }

                .pymk-profiles-container {
                    display: flex;
                    gap: 12px;
                    overflow-x: auto;
                    scroll-behavior: smooth;
                    padding: 4px 0;
                    scrollbar-width: none;
                    -ms-overflow-style: none;
                    flex: 1;
                }

                .pymk-profiles-container::-webkit-scrollbar {
                    display: none;
                }

                .pymk-profile-card {
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 9999px;
                    padding: 6px 12px 6px 6px;
                    min-width: auto;
                    max-width: none;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    flex-shrink: 0;
                }

                .pymk-profile-avatar {
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    object-fit: cover;
                }

                .pymk-profile-name {
                    font-weight: 500;
                    font-size: 13px;
                    margin: 0;
                    color: #fff;
                    white-space: nowrap;
                }

                .pymk-follow-btn {
                    background: transparent;
                    border: 1px solid #ff4b6e;
                    color: #ff4b6e;
                    padding: 4px 8px;
                    border-radius: 9999px;
                    font-size: 11px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                    white-space: nowrap;
                }

                .pymk-follow-btn:hover {
                    background: #ff4b6e;
                    color: white;
                }

                .pymk-follow-btn.following {
                    background: transparent;
                    border-color: #6b6f76;
                    color: #6b6f76;
                }

                /* ========== LOAD MORE BUTTON ========== */
                #loadMorePosts {
                    display: block;
                    width: 100%;
                    max-width: 600px;
                    margin: 20px auto;
                    padding: 12px;
                    background: transparent;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    color: #fff;
                    border-radius: 9999px;
                    font-size: 14px;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                #loadMorePosts:hover {
                    background: rgba(255, 75, 110, 0.1);
                    border-color: #ff4b6e;
                    color: #ff4b6e;
                }

                #loadMorePosts:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                /* ========== REPLY MODAL ========== */
                .reply-modal {
                    position: fixed;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    background: #1a1a1a;
                    border-top: 1px solid rgba(255, 255, 255, 0.1);
                    padding: 16px;
                    z-index: 10000;
                    display: none;
                    animation: slideUp 0.2s ease;
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
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                }

                .reply-to-avatar {
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    object-fit: cover;
                }

                .reply-to-name {
                    font-weight: 600;
                    color: #fff;
                    font-size: 14px;
                }

                .reply-to-text {
                    font-size: 13px;
                    color: #6b6f76;
                    margin-top: 2px;
                }

                .reply-modal-input-container {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .reply-modal-input {
                    flex: 1;
                    padding: 12px 16px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 9999px;
                    font-size: 14px;
                    background: transparent;
                    color: #fff;
                }

                .reply-modal-input:focus {
                    outline: none;
                    border-color: #ff4b6e;
                }

                .reply-modal-send {
                    width: 42px;
                    height: 42px;
                    border-radius: 50%;
                    border: none;
                    background: #ff4b6e;
                    color: white;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
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
                    color: #6b6f76;
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
                    background: rgba(255, 255, 255, 0.1);
                }

                /* ========== DELETE MODAL ========== */
                #deletePostModal {
                    display: none;
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.8);
                    z-index: 10000;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                }

                #deletePostModal .modal-content {
                    background: #1a1a1a;
                    border-radius: 16px;
                    max-width: 500px;
                    width: 100%;
                    max-height: 90vh;
                    display: flex;
                    flex-direction: column;
                    animation: modalSlideIn 0.2s ease;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }

                @keyframes modalSlideIn {
                    from {
                        transform: translateY(-30px);
                        opacity: 0;
                    }
                    to {
                        transform: translateY(0);
                        opacity: 1;
                    }
                }

                #deletePostModal .modal-header {
                    padding: 20px;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                #deletePostModal .modal-header h3 {
                    margin: 0;
                    color: #fff;
                    font-size: 18px;
                }

                #deletePostModal .close-modal {
                    font-size: 24px;
                    cursor: pointer;
                    color: #6b6f76;
                }

                #deletePostModal .close-modal:hover {
                    color: #fff;
                }

                #deletePostModal .modal-body {
                    padding: 20px;
                    overflow-y: auto;
                    flex: 1;
                }

                #deletePostModal .modal-body p {
                    margin-top: 0;
                    margin-bottom: 20px;
                    color: #e7e9ea;
                }

                #deletePostModal .post-preview {
                    background: rgba(255, 255, 255, 0.03);
                    border-radius: 12px;
                    padding: 15px;
                }

                #deletePostModal .preview-image {
                    position: relative;
                    margin-bottom: 15px;
                    border-radius: 8px;
                    overflow: hidden;
                }

                #deletePostModal .preview-image img,
                #deletePostModal .preview-image video {
                    width: 100%;
                    max-height: 300px;
                    object-fit: contain;
                    display: block;
                }

                #deletePostModal .media-badge {
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    background: rgba(0, 0, 0, 0.7);
                    color: white;
                    padding: 4px 8px;
                    border-radius: 12px;
                    font-size: 11px;
                }

                #deletePostModal .preview-caption {
                    font-size: 14px;
                    color: #fff;
                    word-wrap: break-word;
                    padding: 10px;
                    background: rgba(0, 0, 0, 0.2);
                    border-radius: 8px;
                }

                #deletePostModal .modal-actions {
                    padding: 20px;
                    border-top: 1px solid rgba(255, 255, 255, 0.1);
                    display: flex;
                    gap: 12px;
                    justify-content: flex-end;
                }

                #deletePostModal .btn-secondary {
                    padding: 10px 20px;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    border: none;
                    background: transparent;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    color: #fff;
                }

                #deletePostModal .btn-secondary:hover {
                    background: rgba(255, 255, 255, 0.1);
                }

                #deletePostModal .btn-danger {
                    padding: 10px 20px;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    border: none;
                    background: #dc2626;
                    color: white;
                }

                #deletePostModal .btn-danger:hover {
                    background: #b91c1c;
                }

                #deletePostModal .btn-danger:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                /* ========== NOTIFICATION ========== */
                .custom-notification {
                    position: fixed;
                    bottom: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: #1a1a1a;
                    color: white;
                    padding: 12px 24px;
                    border-radius: 9999px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
                    z-index: 10001;
                    animation: notificationSlide 0.2s ease;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    border: 1px solid rgba(255, 75, 110, 0.3);
                }

                @keyframes notificationSlide {
                    from {
                        transform: translate(-50%, 100%);
                        opacity: 0;
                    }
                    to {
                        transform: translate(-50%, 0);
                        opacity: 1;
                    }
                }

                .custom-notification.success {
                    border-color: #10b981;
                }

                .custom-notification.error {
                    border-color: #dc2626;
                }

                .custom-notification.warning {
                    border-color: #f59e0b;
                }

                /* ========== LOADING STATES ========== */
                .loading, .no-posts, .error, .no-comments {
                    text-align: center;
                    padding: 40px;
                    color: #6b6f76;
                    font-style: italic;
                }

                /* ========== MEDIA QUERIES ========== */
                @media (max-width: 768px) {
                    .post-content {
                        margin-left: 0;
                    }
                    
                    .post-actions {
                        margin-left: 0;
                    }
                    
                    .comments-section {
                        margin-left: 0;
                    }
                    
                    .post-author-avatar {
                        width: 40px;
                        height: 40px;
                    }
                    
                    .pymk-profile-card {
                        padding: 4px 8px 4px 4px;
                    }
                    
                    .pymk-profile-name {
                        font-size: 12px;
                    }
                }

                @media (max-width: 480px) {
                    .post-item {
                        padding: 12px;
                    }
                    
                    .post-actions {
                        flex-wrap: wrap;
                        gap: 8px;
                    }
                    
                    .vote-btn {
                        padding: 4px 8px;
                    }
                    
                    .post-action {
                        padding: 4px 10px;
                    }
                    
                    .pymk-nav-btn {
                        width: 28px;
                        height: 28px;
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }

    // ==================== VIDEO THUMBNAIL METHODS ====================
    
    getVideoThumbnail(post) {
        if (!post) {
            return 'images/video-placeholder.jpg';
        }
        
        if (post.videoThumbnail && post.videoThumbnail !== 'images/video-placeholder.jpg' && 
            post.videoThumbnail !== 'null' && post.videoThumbnail !== 'undefined') {
            return post.videoThumbnail;
        }
        
        if (post.videoPoster && post.videoPoster !== 'images/video-placeholder.jpg' &&
            post.videoPoster !== 'null' && post.videoPoster !== 'undefined') {
            return post.videoPoster;
        }
        
        if (post.videoUrl && post.videoUrl.includes('cloudinary.com')) {
            return this.generateCloudinaryThumbnail(post.videoUrl);
        }
        
        return 'images/video-placeholder.jpg';
    }
    
    generateCloudinaryThumbnail(videoUrl) {
        try {
            if (!videoUrl || typeof videoUrl !== 'string') {
                return 'images/video-placeholder.jpg';
            }

            if (!videoUrl.includes('cloudinary.com')) {
                return 'images/video-placeholder.jpg';
            }

            if (videoUrl.includes('/upload/')) {
                if (videoUrl.includes('/upload/video/')) {
                    return videoUrl.replace('/upload/video/', '/upload/w_600,h_338,c_fill,q_auto,f_jpg/')
                                   .replace(/\.(mp4|mov|avi|mkv|webm|ogg|3gp|m4v)$/i, '.jpg');
                } else {
                    return videoUrl.replace('/upload/', '/upload/w_600,h_338,c_fill,q_auto,f_jpg/');
                }
            }
            
            return 'images/video-placeholder.jpg';
        } catch (error) {
            console.error('Error generating thumbnail:', error);
            return 'images/video-placeholder.jpg';
        }
    }

    createVideoThumbnail(videoUrl, thumbnailUrl, duration, postId, postData = null) {
        const container = document.createElement('div');
        container.className = 'video-thumbnail-container';
        container.setAttribute('data-video-url', videoUrl);
        container.setAttribute('data-post-id', postId);
        
        const thumbUrl = thumbnailUrl || this.getVideoThumbnail(postData || { videoUrl });
        
        const img = document.createElement('img');
        img.className = 'video-thumbnail-image';
        img.src = thumbUrl;
        img.alt = 'Video thumbnail';
        img.loading = 'lazy';
        
        img.onerror = () => {
            img.src = 'images/video-placeholder.jpg';
        };
        
        const playButton = document.createElement('div');
        playButton.className = 'video-play-button-center';
        playButton.innerHTML = '<i class="fas fa-play"></i>';
        
        const durationBadge = document.createElement('span');
        durationBadge.className = 'video-duration-overlay';
        durationBadge.textContent = this.formatDuration(duration);
        
        container.appendChild(img);
        container.appendChild(playButton);
        container.appendChild(durationBadge);
        
        container.addEventListener('click', (e) => {
            e.stopPropagation();
            this.playVideo(postId, videoUrl, thumbUrl, duration);
        });
        
        return container;
    }
    
    playVideo(postId, videoUrl, thumbnailUrl, duration) {
        const container = document.getElementById(`video-container-${postId}`);
        if (!container) return;
        
        container.innerHTML = '';
        const player = this.createCustomVideoPlayer(videoUrl, thumbnailUrl, duration);
        container.appendChild(player.container);
        
        setTimeout(() => {
            player.video.play().catch(e => console.log('Auto-play prevented:', e));
        }, 100);
    }

    // ==================== CUSTOM VIDEO PLAYER ====================
    
    createCustomVideoPlayer(videoUrl, thumbnailUrl, duration) {
        const container = document.createElement('div');
        container.className = 'custom-video-container';
        
        const video = document.createElement('video');
        video.className = 'custom-video-player';
        video.preload = 'metadata';
        video.poster = thumbnailUrl || this.generateCloudinaryThumbnail(videoUrl);
        video.innerHTML = `<source src="${videoUrl}" type="video/mp4">Your browser does not support the video tag.`;
        
        video.controls = false;
        
        const controlsOverlay = document.createElement('div');
        controlsOverlay.className = 'video-controls-overlay';
        
        const centerPlayBtn = document.createElement('div');
        centerPlayBtn.className = 'video-center-play-btn';
        centerPlayBtn.innerHTML = '<i class="fas fa-play"></i>';
        controlsOverlay.appendChild(centerPlayBtn);
        
        const bottomControls = document.createElement('div');
        bottomControls.className = 'video-bottom-controls';
        
        const controlBar = document.createElement('div');
        controlBar.className = 'control-bar';
        
        const playPauseBtn = document.createElement('button');
        playPauseBtn.className = 'control-btn';
        playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
        
        const progressContainer = document.createElement('div');
        progressContainer.className = 'progress-bar-container';
        const progressFill = document.createElement('div');
        progressFill.className = 'progress-bar-fill';
        progressContainer.appendChild(progressFill);
        
        const timeDisplay = document.createElement('span');
        timeDisplay.className = 'time-display';
        timeDisplay.textContent = '0:00 / ' + this.formatDuration(duration || 0);
        
        const volumeControl = document.createElement('div');
        volumeControl.className = 'volume-control';
        const volumeBtn = document.createElement('button');
        volumeBtn.className = 'control-btn';
        volumeBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
        const volumeSlider = document.createElement('div');
        volumeSlider.className = 'volume-slider';
        const volumeFill = document.createElement('div');
        volumeFill.className = 'volume-fill';
        volumeSlider.appendChild(volumeFill);
        volumeControl.appendChild(volumeBtn);
        volumeControl.appendChild(volumeSlider);
        
        const fullscreenBtn = document.createElement('button');
        fullscreenBtn.className = 'control-btn';
        fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>';
        
        controlBar.appendChild(playPauseBtn);
        controlBar.appendChild(progressContainer);
        controlBar.appendChild(timeDisplay);
        controlBar.appendChild(volumeControl);
        controlBar.appendChild(fullscreenBtn);
        
        bottomControls.appendChild(controlBar);
        
        container.appendChild(video);
        container.appendChild(controlsOverlay);
        container.appendChild(bottomControls);
        
        let hideControlsTimeout;
        
        const showControls = () => {
            controlsOverlay.style.opacity = '1';
            bottomControls.style.opacity = '1';
            clearTimeout(hideControlsTimeout);
            hideControlsTimeout = setTimeout(() => {
                if (!video.paused) {
                    controlsOverlay.style.opacity = '0';
                    bottomControls.style.opacity = '0';
                }
            }, 3000);
        };
        
        const updateProgress = () => {
            if (video.duration) {
                const percent = (video.currentTime / video.duration) * 100;
                progressFill.style.width = percent + '%';
                
                const current = this.formatDuration(video.currentTime);
                const total = this.formatDuration(video.duration);
                timeDisplay.textContent = `${current} / ${total}`;
            }
        };
        
        const togglePlay = () => {
            if (video.paused) {
                video.play();
            } else {
                video.pause();
            }
        };
        
        video.addEventListener('loadedmetadata', () => {
            timeDisplay.textContent = `0:00 / ${this.formatDuration(video.duration)}`;
        });
        
        video.addEventListener('timeupdate', updateProgress);
        
        video.addEventListener('play', () => {
            playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
            centerPlayBtn.innerHTML = '<i class="fas fa-pause"></i>';
            showControls();
        });
        
        video.addEventListener('pause', () => {
            playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
            centerPlayBtn.innerHTML = '<i class="fas fa-play"></i>';
            controlsOverlay.style.opacity = '1';
            bottomControls.style.opacity = '1';
            clearTimeout(hideControlsTimeout);
        });
        
        video.addEventListener('ended', () => {
            playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
            centerPlayBtn.innerHTML = '<i class="fas fa-play"></i>';
            controlsOverlay.style.opacity = '1';
            bottomControls.style.opacity = '1';
        });
        
        container.addEventListener('mouseenter', showControls);
        container.addEventListener('mouseleave', () => {
            if (!video.paused) {
                controlsOverlay.style.opacity = '0';
                bottomControls.style.opacity = '0';
            }
        });
        
        centerPlayBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            togglePlay();
        });
        
        playPauseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            togglePlay();
        });
        
        progressContainer.addEventListener('click', (e) => {
            e.stopPropagation();
            const rect = progressContainer.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            video.currentTime = percent * video.duration;
        });
        
        volumeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            video.muted = !video.muted;
            volumeBtn.innerHTML = video.muted ? 
                '<i class="fas fa-volume-mute"></i>' : 
                '<i class="fas fa-volume-up"></i>';
            volumeFill.style.width = video.muted ? '0%' : (video.volume * 100) + '%';
        });
        
        volumeSlider.addEventListener('click', (e) => {
            e.stopPropagation();
            const rect = volumeSlider.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            video.volume = Math.max(0, Math.min(1, percent));
            video.muted = false;
            volumeBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
            volumeFill.style.width = (video.volume * 100) + '%';
        });
        
        fullscreenBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!document.fullscreenElement) {
                container.requestFullscreen();
                fullscreenBtn.innerHTML = '<i class="fas fa-compress"></i>';
            } else {
                document.exitFullscreen();
                fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>';
            }
        });
        
        document.addEventListener('fullscreenchange', () => {
            fullscreenBtn.innerHTML = document.fullscreenElement ? 
                '<i class="fas fa-compress"></i>' : 
                '<i class="fas fa-expand"></i>';
        });
        
        video.addEventListener('dblclick', () => {
            fullscreenBtn.click();
        });
        
        container.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        return { container, video };
    }

    // ==================== VIDEO PLACEHOLDER METHODS ====================
    
    createVideoPlaceholder() {
        const placeholder = document.createElement('div');
        placeholder.className = 'video-placeholder';
        placeholder.innerHTML = `
            <div class="video-placeholder-content">
                <i class="fas fa-video"></i>
                <p>Loading video...</p>
            </div>
        `;
        return placeholder;
    }

    // ==================== VIDEO VALIDATION METHODS ====================
    
    async validateVideoFile(file) {
        if (file.size > this.maxVideoSize) {
            throw new Error(`Video file too large. Maximum size is ${this.formatFileSize(this.maxVideoSize)}`);
        }
        
        if (!file.type.startsWith('video/') && !this.isLikelyVideoFile(file)) {
            throw new Error('Please select a valid video file');
        }

        return true;
    }

    isLikelyVideoFile(file) {
        const videoIndicators = [
            file.name.toLowerCase().match(/\.(mp4|mov|avi|mkv|wmv|flv|webm|3gp|m4v|mpg|mpeg)$/),
            file.size > 100000,
            file.type === '' || file.type === 'application/octet-stream'
        ];
        
        return videoIndicators.some(indicator => indicator);
    }

    // ==================== VIDEO UPLOAD & PROCESSING - FIXED ====================
    
    async uploadMediaToCloudinary(file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', cloudinaryConfig.uploadPreset);
        
        // CRITICAL FIX: Properly detect video files
        const isVideo = file.type.startsWith('video/') || 
                       file.name.match(/\.(mp4|mov|avi|mkv|wmv|flv|webm|3gp|m4v|mpg|mpeg)$/i) !== null;
        
        const resourceType = isVideo ? 'video' : 'image';
        formData.append('resource_type', resourceType);
        
        try {
            const response = await fetch(
                `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/${resourceType}/upload`,
                {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'Accept': 'application/json'
                    }
                }
            );
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Cloudinary error response:', errorText);
                throw new Error(`Cloudinary error: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (!data.secure_url) {
                throw new Error('No secure_url in Cloudinary response');
            }
            
            // CRITICAL FIX: Always set the correct media type
            if (isVideo) {
                const videoUrl = data.secure_url;
                const thumbnailUrl = this.generateCloudinaryThumbnail(videoUrl);
                
                console.log('Video uploaded successfully:', videoUrl);
                
                return {
                    url: videoUrl,
                    type: 'video', // Explicitly set as video
                    mediaType: 'video', // Add explicit mediaType
                    duration: data.duration || 0,
                    width: data.width,
                    height: data.height,
                    format: data.format,
                    publicId: data.public_id,
                    thumbnail: thumbnailUrl,
                    videoThumbnail: thumbnailUrl // Add for consistency
                };
            }
            
            // Return for images
            return {
                url: data.secure_url,
                type: 'image',
                mediaType: 'image', // Add explicit mediaType
                width: data.width,
                height: data.height,
                format: data.format,
                publicId: data.public_id
            };
            
        } catch (error) {
            console.error('Upload error details:', error);
            throw new Error(`Failed to upload: ${error.message}`);
        }
    }

    // ==================== POLLING / VOTING FUNCTIONALITY ====================
    
    setupPollBuilder() {
        const createPostForm = document.getElementById('createPostForm');
        if (!createPostForm) return;
        
        if (document.getElementById('pollToggleBtn')) return;
        
        const mediaInput = document.getElementById('postMedia');
        const mediaLabel = document.querySelector('.media-upload-label');
        
        if (mediaLabel) {
            const pollToggle = document.createElement('button');
            pollToggle.type = 'button';
            pollToggle.id = 'pollToggleBtn';
            pollToggle.className = 'poll-toggle-btn';
            pollToggle.innerHTML = '<i class="fas fa-chart-bar"></i> Add Poll';
            
            mediaLabel.parentNode.insertBefore(pollToggle, mediaLabel.nextSibling);
            
            pollToggle.addEventListener('click', () => {
                this.togglePollBuilder();
            });
        }
        
        this.addPollStyles();
    }
    
    togglePollBuilder() {
        const pollToggle = document.getElementById('pollToggleBtn');
        let pollBuilder = document.getElementById('pollBuilder');
        
        if (pollBuilder) {
            pollBuilder.remove();
            if (pollToggle) {
                pollToggle.classList.remove('active');
                pollToggle.innerHTML = '<i class="fas fa-chart-bar"></i> Add Poll';
            }
            return;
        }
        
        const createPostForm = document.getElementById('createPostForm');
        if (!createPostForm) return;
        
        pollBuilder = document.createElement('div');
        pollBuilder.id = 'pollBuilder';
        pollBuilder.className = 'poll-builder';
        
        pollBuilder.innerHTML = `
            <input type="text" id="pollQuestion" class="poll-question" placeholder="Ask a question..." maxlength="200">
            <div id="pollOptionsContainer" class="poll-options-container">
                <div class="poll-option-row">
                    <input type="text" id="pollOption1" class="poll-option-input" placeholder="Option 1" maxlength="100">
                    <button type="button" class="remove-poll-option" data-option="1" style="display: none;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="poll-option-row">
                    <input type="text" id="pollOption2" class="poll-option-input" placeholder="Option 2" maxlength="100">
                    <button type="button" class="remove-poll-option" data-option="2" style="display: none;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
            <button type="button" id="addPollOptionBtn" class="add-poll-option">
                <i class="fas fa-plus"></i> Add Option
            </button>
            <div class="poll-preview">
                <small><i class="fas fa-info-circle"></i> Polls cannot be edited after posting. Min 2 options, Max 4 options.</small>
            </div>
        `;
        
        const captionInput = document.getElementById('postCaption');
        if (captionInput) {
            captionInput.parentNode.insertBefore(pollBuilder, captionInput.nextSibling);
        } else {
            createPostForm.appendChild(pollBuilder);
        }
        
        if (pollToggle) {
            pollToggle.classList.add('active');
            pollToggle.innerHTML = '<i class="fas fa-trash"></i> Remove Poll';
        }
        
        const addOptionBtn = document.getElementById('addPollOptionBtn');
        if (addOptionBtn) {
            addOptionBtn.addEventListener('click', () => {
                this.addPollOption();
            });
        }
        
        this.setupRemoveOptionListeners();
    }
    
    setupRemoveOptionListeners() {
        const removeButtons = document.querySelectorAll('.remove-poll-option');
        removeButtons.forEach(btn => {
            btn.removeEventListener('click', this.handleRemoveOption);
            btn.addEventListener('click', this.handleRemoveOption.bind(this));
        });
    }
    
    handleRemoveOption(e) {
        e.preventDefault();
        const optionRow = e.currentTarget.closest('.poll-option-row');
        if (optionRow) {
            optionRow.remove();
            this.updatePollOptionCount();
        }
    }
    
    addPollOption() {
        const optionsContainer = document.getElementById('pollOptionsContainer');
        const currentOptions = optionsContainer.querySelectorAll('.poll-option-row').length;
        
        if (currentOptions >= this.maxPollOptions) {
            this.showNotification(`Maximum ${this.maxPollOptions} options allowed`, 'warning');
            return;
        }
        
        const newOptionNumber = currentOptions + 1;
        const optionRow = document.createElement('div');
        optionRow.className = 'poll-option-row';
        optionRow.innerHTML = `
            <input type="text" id="pollOption${newOptionNumber}" class="poll-option-input" placeholder="Option ${newOptionNumber}" maxlength="100">
            <button type="button" class="remove-poll-option" data-option="${newOptionNumber}">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        optionsContainer.appendChild(optionRow);
        
        this.updatePollOptionCount();
        
        const removeBtn = optionRow.querySelector('.remove-poll-option');
        if (removeBtn) {
            removeBtn.addEventListener('click', this.handleRemoveOption.bind(this));
        }
        
        setTimeout(() => {
            document.getElementById(`pollOption${newOptionNumber}`)?.focus();
        }, 100);
    }
    
    updatePollOptionCount() {
        const optionsContainer = document.getElementById('pollOptionsContainer');
        const optionRows = optionsContainer.querySelectorAll('.poll-option-row');
        const removeButtons = optionsContainer.querySelectorAll('.remove-poll-option');
        const addOptionBtn = document.getElementById('addPollOptionBtn');
        
        removeButtons.forEach((btn, index) => {
            if (optionRows.length > 2) {
                btn.style.display = 'flex';
            } else {
                btn.style.display = 'none';
            }
        });
        
        if (addOptionBtn) {
            if (optionRows.length >= this.maxPollOptions) {
                addOptionBtn.classList.add('disabled');
                addOptionBtn.disabled = true;
            } else {
                addOptionBtn.classList.remove('disabled');
                addOptionBtn.disabled = false;
            }
        }
    }
    
    addPollStyles() {
        // Styles are already included in addAllStyles
    }
    
    async createPollPost() {
        if (this.isSubmitting || !this.currentUser) return;
        
        const caption = document.getElementById('postCaption')?.value.trim() || '';
        const pollQuestion = document.getElementById('pollQuestion')?.value.trim();
        
        if (!pollQuestion) {
            this.showNotification('Please enter a poll question', 'error');
            return;
        }
        
        const pollOptions = [];
        const optionInputs = document.querySelectorAll('.poll-option-input');
        
        optionInputs.forEach((input, index) => {
            const value = input.value.trim();
            if (value) {
                pollOptions.push({
                    id: `opt_${index + 1}`,
                    text: value,
                    votes: 0,
                    voters: []
                });
            }
        });
        
        if (pollOptions.length < this.minPollOptions) {
            this.showNotification(`Please add at least ${this.minPollOptions} poll options`, 'error');
            return;
        }
        
        try {
            this.isSubmitting = true;
            
            const postData = {
                userId: this.currentUser.uid,
                caption: caption,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                likes: 0,
                commentsCount: 0,
                upvotes: 0,
                downvotes: 0,
                mediaType: 'poll',
                poll: {
                    question: pollQuestion,
                    options: pollOptions,
                    totalVotes: 0,
                    createdAt: serverTimestamp(),
                    expiresAt: null,
                    isClosed: false,
                    voters: []
                }
            };

            const docRef = await addDoc(collection(db, 'posts'), postData);
            console.log('Poll post created successfully with ID:', docRef.id);
            
            this.showNotification('Poll created successfully!', 'success');
            
            document.getElementById('postCaption').value = '';
            document.getElementById('pollQuestion').value = '';
            document.querySelectorAll('.poll-option-input').forEach(input => {
                input.value = '';
            });
            
            const pollBuilder = document.getElementById('pollBuilder');
            if (pollBuilder) pollBuilder.remove();
            
            const pollToggle = document.getElementById('pollToggleBtn');
            if (pollToggle) {
                pollToggle.classList.remove('active');
                pollToggle.innerHTML = '<i class="fas fa-chart-bar"></i> Add Poll';
            }
            
            setTimeout(() => {
                window.location.href = 'posts.html';
            }, 1500);
            
        } catch (error) {
            console.error('Error creating poll post:', error);
            this.showNotification('Error creating poll: ' + error.message, 'error');
        } finally {
            this.isSubmitting = false;
        }
    }

    createPollElement(post, postId) {
        const pollContainer = document.createElement('div');
        pollContainer.className = 'post-poll-container';
        pollContainer.setAttribute('data-poll-id', postId);
        
        const poll = post.poll;
        const totalVotes = poll.totalVotes || 0;
        const userVote = this.getUserVote(postId, this.currentUser?.uid);
        
        let optionsHTML = '';
        
        poll.options.forEach(option => {
            const voteCount = option.votes || 0;
            const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
            const isVoted = userVote === option.id;
            
            optionsHTML += `
                <div class="poll-option-item">
                    <div class="poll-option-content ${isVoted ? 'voted' : ''}" 
                         data-option-id="${option.id}"
                         data-post-id="${postId}"
                         data-vote-count="${voteCount}"
                         data-percentage="${percentage}">
                        <div class="poll-progress-bar-bg" style="width: ${percentage}%;"></div>
                        <div class="poll-option-left">
                            <div class="poll-checkmark">
                                <i class="fas fa-check"></i>
                            </div>
                            <span class="poll-option-text">${this.escapeHTML(option.text)}</span>
                        </div>
                        <div class="poll-option-right">
                            <span class="poll-percentage">${percentage}%</span>
                            <span class="poll-count">${this.formatCount(voteCount)}</span>
                        </div>
                    </div>
                </div>
            `;
        });
        
        pollContainer.innerHTML = `
            <div class="poll-header">
                <i class="fas fa-chart-bar"></i>
                <h4>${this.escapeHTML(poll.question)}</h4>
            </div>
            <div class="poll-options-list">
                ${optionsHTML}
            </div>
            <div class="poll-footer">
                <span class="poll-total-votes">
                    <i class="fas fa-users"></i>
                    ${this.formatCount(totalVotes)} votes
                </span>
                ${userVote ? '<span class="poll-closed-badge"><i class="fas fa-check-circle"></i> You voted</span>' : ''}
                ${poll.isClosed ? '<span class="poll-closed-badge"><i class="fas fa-lock"></i> Poll closed</span>' : ''}
            </div>
        `;
        
        return pollContainer;
    }
    
    getUserVote(postId, userId) {
        if (!userId) return null;
        const voteKey = `poll_vote_${postId}_${userId}`;
        return localStorage.getItem(voteKey);
    }
    
    async castVote(postId, optionId) {
        if (!this.currentUser) {
            this.showNotification('Please login to vote', 'error');
            return;
        }
        
        try {
            const postRef = doc(db, 'posts', postId);
            const postSnap = await getDoc(postRef);
            
            if (!postSnap.exists()) {
                this.showNotification('Post not found', 'error');
                return;
            }
            
            const post = postSnap.data();
            
            if (!post.poll) {
                this.showNotification('Poll not found', 'error');
                return;
            }
            
            if (post.poll.isClosed) {
                this.showNotification('This poll is closed', 'error');
                return;
            }
            
            if (post.poll.voters?.includes(this.currentUser.uid)) {
                this.showNotification('You have already voted', 'error');
                return;
            }
            
            const updatedOptions = post.poll.options.map(opt => {
                if (opt.id === optionId) {
                    return {
                        ...opt,
                        votes: (opt.votes || 0) + 1
                    };
                }
                return opt;
            });
            
            const newTotalVotes = (post.poll.totalVotes || 0) + 1;
            const voters = [...(post.poll.voters || []), this.currentUser.uid];
            
            await updateDoc(postRef, {
                'poll.options': updatedOptions,
                'poll.totalVotes': newTotalVotes,
                'poll.voters': voters
            });
            
            localStorage.setItem(`poll_vote_${postId}_${this.currentUser.uid}`, optionId);
            
            this.showNotification('Vote cast successfully!', 'success');
            
            this.updatePollUIVote(postId, optionId, newTotalVotes, updatedOptions);
            
        } catch (error) {
            console.error('Error casting vote:', error);
            this.showNotification('Error casting vote: ' + error.message, 'error');
        }
    }
    
    updatePollUIVote(postId, votedOptionId, newTotalVotes, updatedOptions) {
        const pollContainer = document.querySelector(`.post-poll-container[data-poll-id="${postId}"]`);
        if (!pollContainer) {
            console.log('Poll container not found for ID:', postId);
            return;
        }
        
        updatedOptions.forEach(option => {
            const optionElement = pollContainer.querySelector(`.poll-option-content[data-option-id="${option.id}"]`);
            if (optionElement) {
                const voteCount = option.votes || 0;
                const percentage = newTotalVotes > 0 ? Math.round((voteCount / newTotalVotes) * 100) : 0;
                
                const progressBar = optionElement.querySelector('.poll-progress-bar-bg');
                if (progressBar) {
                    progressBar.style.width = percentage + '%';
                }
                
                const percentageSpan = optionElement.querySelector('.poll-percentage');
                if (percentageSpan) {
                    percentageSpan.textContent = percentage + '%';
                }
                
                const countSpan = optionElement.querySelector('.poll-count');
                if (countSpan) {
                    countSpan.textContent = this.formatCount(voteCount);
                }
                
                if (option.id === votedOptionId) {
                    optionElement.classList.add('voted');
                }
            }
        });
        
        const totalVotesSpan = pollContainer.querySelector('.poll-total-votes');
        if (totalVotesSpan) {
            totalVotesSpan.innerHTML = `<i class="fas fa-users"></i> ${this.formatCount(newTotalVotes)} votes`;
        }
        
        const existingBadge = pollContainer.querySelector('.poll-closed-badge');
        if (existingBadge) {
            existingBadge.remove();
        }
        
        const footer = pollContainer.querySelector('.poll-footer');
        if (footer) {
            const youVotedBadge = document.createElement('span');
            youVotedBadge.className = 'poll-closed-badge';
            youVotedBadge.innerHTML = '<i class="fas fa-check-circle"></i> You voted';
            footer.appendChild(youVotedBadge);
        }
    }

    // ==================== COMMENT REPLIES FUNCTIONALITY ====================
    
    setupReplyModal() {
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
            
            const closeBtn = modal.querySelector('.reply-modal-close');
            closeBtn.addEventListener('click', () => {
                this.closeReplyModal();
            });
            
            const sendBtn = document.getElementById('replyModalSend');
            sendBtn.addEventListener('click', () => {
                this.submitReply();
            });
            
            const input = document.getElementById('replyModalInput');
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.submitReply();
                }
            });
            
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeReplyModal();
                }
            });
        }
    }
    
    openReplyModal(commentData, postId, commentId) {
        const modal = document.getElementById('replyModal');
        if (!modal) {
            this.setupReplyModal();
            setTimeout(() => this.openReplyModal(commentData, postId, commentId), 100);
            return;
        }
        
        modal.dataset.postId = postId;
        modal.dataset.commentId = commentId;
        modal.dataset.replyToUserId = commentData.userId;
        modal.dataset.replyToUsername = commentData.userName || 'User';
        
        const avatar = document.getElementById('replyToAvatar');
        if (avatar) {
            avatar.src = commentData.userAvatar || 'images/default-profile.jpg';
        }
        
        const nameEl = document.getElementById('replyToName');
        if (nameEl) {
            nameEl.textContent = `Replying to ${commentData.userName || 'User'}`;
        }
        
        const textEl = document.getElementById('replyToText');
        if (textEl) {
            let commentText = commentData.text || '';
            if (commentText.length > 50) {
                commentText = commentText.substring(0, 50) + '...';
            }
            textEl.textContent = `"${commentText}"`;
        }
        
        const input = document.getElementById('replyModalInput');
        if (input) {
            input.value = '';
            input.focus();
        }
        
        modal.style.display = 'block';
    }
    
    closeReplyModal() {
        const modal = document.getElementById('replyModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }
    
    async submitReply() {
        const modal = document.getElementById('replyModal');
        if (!modal) return;
        
        const postId = modal.dataset.postId;
        const commentId = modal.dataset.commentId;
        const replyToUserId = modal.dataset.replyToUserId;
        const input = document.getElementById('replyModalInput');
        const replyText = input.value.trim();
        
        if (!replyText) {
            this.showNotification('Please enter a reply', 'error');
            return;
        }
        
        if (!this.currentUser) {
            this.showNotification('Please login to reply', 'error');
            return;
        }
        
        try {
            const replyData = {
                userId: this.currentUser.uid,
                userName: this.currentUser.displayName || 'User',
                userAvatar: this.currentUser.photoURL || 'images/default-profile.jpg',
                text: replyText,
                replyToUserId: replyToUserId,
                replyToUsername: modal.dataset.replyToUsername,
                createdAt: serverTimestamp(),
                likes: 0
            };
            
            await addDoc(
                collection(db, 'posts', postId, 'comments', commentId, 'replies'), 
                replyData
            );
            
            const commentRef = doc(db, 'posts', postId, 'comments', commentId);
            await updateDoc(commentRef, {
                repliesCount: increment(1),
                updatedAt: serverTimestamp()
            });
            
            this.showNotification('Reply posted!', 'success');
            this.closeReplyModal();
            
            const commentsSection = document.getElementById(`comments-${postId}`);
            if (commentsSection && commentsSection.style.display !== 'none') {
                await this.loadComments(postId);
            }
            
        } catch (error) {
            console.error('Error adding reply:', error);
            this.showNotification('Error posting reply: ' + error.message, 'error');
        }
    }
    
    createCommentElement(comment, user, postId) {
        const commentDiv = document.createElement('div');
        commentDiv.className = 'comment-item';
        commentDiv.setAttribute('data-comment-id', comment.id);
        
        const hasReplies = comment.repliesCount && comment.repliesCount > 0;
        const replyCount = comment.repliesCount || 0;
        
        commentDiv.innerHTML = `
            <div class="comment-header">
                <img src="${user.profileImage || 'images/default-profile.jpg'}" 
                     alt="${user.name}" class="comment-avatar">
                <div class="comment-info">
                    <strong>${user.name || 'Unknown User'}</strong>
                    <span class="comment-time">${this.formatTime(comment.createdAt)}</span>
                </div>
            </div>
            <div class="comment-text">${this.escapeHTML(comment.text)}</div>
            <div class="comment-actions">
                <button class="comment-action-btn reply-btn" data-comment-id="${comment.id}" data-post-id="${postId}">
                    <i class="fas fa-reply"></i> Reply
                </button>
            </div>
            ${hasReplies ? `
                <button class="view-replies-btn" data-comment-id="${comment.id}" data-post-id="${postId}">
                    <i class="fas fa-chevron-right"></i> View ${replyCount} repl${replyCount === 1 ? 'y' : 'ies'}
                </button>
            ` : ''}
            <div id="replies-${comment.id}" class="replies-container" style="display: none;"></div>
        `;
        
        const replyBtn = commentDiv.querySelector('.reply-btn');
        if (replyBtn) {
            replyBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const commentData = {
                    id: comment.id,
                    userId: comment.userId,
                    userName: user.name || 'User',
                    userAvatar: user.profileImage || 'images/default-profile.jpg',
                    text: comment.text
                };
                this.openReplyModal(commentData, postId, comment.id);
            });
        }
        
        if (hasReplies) {
            const viewRepliesBtn = commentDiv.querySelector('.view-replies-btn');
            viewRepliesBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const repliesContainer = commentDiv.querySelector(`#replies-${comment.id}`);
                const isHidden = repliesContainer.style.display === 'none' || repliesContainer.style.display === '';
                
                if (isHidden) {
                    repliesContainer.style.display = 'block';
                    viewRepliesBtn.innerHTML = `<i class="fas fa-chevron-down"></i> Hide replies`;
                    viewRepliesBtn.classList.add('active');
                    
                    await this.loadReplies(postId, comment.id, repliesContainer);
                } else {
                    repliesContainer.style.display = 'none';
                    viewRepliesBtn.innerHTML = `<i class="fas fa-chevron-right"></i> View ${replyCount} repl${replyCount === 1 ? 'y' : 'ies'}`;
                    viewRepliesBtn.classList.remove('active');
                }
            });
        }
        
        return commentDiv;
    }
    
    async loadReplies(postId, commentId, container) {
        if (!container) return;
        
        try {
            const repliesQuery = query(
                collection(db, 'posts', postId, 'comments', commentId, 'replies'),
                orderBy('createdAt', 'asc')
            );
            
            const repliesSnap = await getDocs(repliesQuery);
            
            container.innerHTML = '';
            
            if (repliesSnap.empty) {
                container.innerHTML = '<div class="no-replies">No replies yet</div>';
                return;
            }
            
            const userIds = new Set();
            repliesSnap.forEach(doc => {
                const reply = doc.data();
                userIds.add(reply.userId);
                if (reply.replyToUserId) {
                    userIds.add(reply.replyToUserId);
                }
            });
            
            const usersData = await this.getUsersData([...userIds]);
            
            repliesSnap.forEach(doc => {
                const reply = { id: doc.id, ...doc.data() };
                const replyUser = usersData[reply.userId] || { 
                    name: reply.userName || 'User', 
                    profileImage: reply.userAvatar 
                };
                const replyElement = this.createReplyElement(reply, replyUser, postId, commentId);
                container.appendChild(replyElement);
            });
            
        } catch (error) {
            console.error('Error loading replies:', error);
            container.innerHTML = '<div class="error">Error loading replies</div>';
        }
    }
    
    createReplyElement(reply, user, postId, commentId) {
        const replyDiv = document.createElement('div');
        replyDiv.className = 'reply-item';
        replyDiv.setAttribute('data-reply-id', reply.id);
        
        const replyToName = reply.replyToUsername || 'User';
        
        replyDiv.innerHTML = `
            <div class="reply-header">
                <img src="${user.profileImage || 'images/default-profile.jpg'}" 
                     alt="${user.name}" class="reply-avatar">
                <div class="reply-info">
                    <strong>${user.name || 'Unknown User'}</strong>
                    <span class="reply-time">${this.formatTime(reply.createdAt)}</span>
                </div>
            </div>
            <div class="reply-text">
                <span class="reply-mention">@${replyToName}</span>
                ${this.escapeHTML(reply.text)}
            </div>
            <div class="comment-actions" style="margin-left: 34px; margin-top: 8px;">
                <button class="comment-action-btn reply-to-reply-btn" data-reply-id="${reply.id}" data-post-id="${postId}" data-comment-id="${commentId}">
                    <i class="fas fa-reply"></i> Reply
                </button>
            </div>
        `;
        
        const replyToReplyBtn = replyDiv.querySelector('.reply-to-reply-btn');
        if (replyToReplyBtn) {
            replyToReplyBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const replyData = {
                    id: reply.id,
                    userId: reply.userId,
                    userName: user.name || 'User',
                    userAvatar: user.profileImage || 'images/default-profile.jpg',
                    text: reply.text
                };
                this.openReplyModal(replyData, postId, commentId);
            });
        }
        
        return replyDiv;
    }
    
    escapeHTML(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ==================== CREATE POST WITH VIDEO/POLL - FIXED ====================
    
    setupCreatePost() {
        const form = document.getElementById('createPostForm');
        if (!form) return;

        form.removeEventListener('submit', this.handleFormSubmit);
        
        this.handleFormSubmit = (e) => {
            e.preventDefault();
            
            const pollBuilder = document.getElementById('pollBuilder');
            if (pollBuilder) {
                this.createPollPost();
            } else {
                this.createPost();
            }
        };
        
        form.addEventListener('submit', this.handleFormSubmit);

        const mediaInput = document.getElementById('postMedia');
        if (mediaInput) {
            mediaInput.removeEventListener('change', this.handleMediaChange);
            this.handleMediaChange = (e) => {
                this.previewMedia(e.target.files[0]);
                
                const pollBuilder = document.getElementById('pollBuilder');
                if (pollBuilder) {
                    pollBuilder.remove();
                    const pollToggle = document.getElementById('pollToggleBtn');
                    if (pollToggle) {
                        pollToggle.classList.remove('active');
                        pollToggle.innerHTML = '<i class="fas fa-chart-bar"></i> Add Poll';
                    }
                    this.showNotification('Poll removed - posts cannot have both media and poll', 'info');
                }
            };
            mediaInput.addEventListener('change', this.handleMediaChange);
        }

        const captionInput = document.getElementById('postCaption');
        const charCount = document.getElementById('charCount');
        if (captionInput && charCount) {
            captionInput.removeEventListener('input', this.handleCaptionInput);
            this.handleCaptionInput = function() {
                charCount.textContent = this.value.length;
            };
            captionInput.addEventListener('input', this.handleCaptionInput);
        }
        
        this.setupPollBuilder();
        this.setupReplyModal();
    }

    async previewMedia(file) {
        const preview = document.getElementById('mediaPreview');
        if (!preview) return;

        if (file) {
            if (file.type.startsWith('video/') || this.isLikelyVideoFile(file)) {
                try {
                    await this.validateVideoFile(file);
                } catch (error) {
                    preview.innerHTML = `
                        <div class="media-type-badge" style="background: #dc2626;">
                            <i class="fas fa-exclamation-triangle"></i> Error
                        </div>
                        <p style="color: #dc2626; padding: 20px;">${error.message}</p>
                    `;
                    preview.style.display = 'block';
                    return;
                }

                const video = document.createElement('video');
                video.preload = 'metadata';
                video.onloadedmetadata = () => {
                    video.currentTime = Math.min(1, video.duration / 2);
                };
                video.onseeked = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.8);
                    
                    preview.innerHTML = `
                        <div class="media-type-badge" style="background: #ff4b6e;">
                            <i class="fas fa-video"></i> Video Ready
                        </div>
                        <div style="position: relative;">
                            <div class="video-thumbnail-container" style="cursor: default;">
                                <img src="${thumbnailUrl}" class="video-thumbnail-image" alt="Video thumbnail">
                                <div class="video-play-button-center" style="background: rgba(255,75,110,0.95);">
                                    <i class="fas fa-play"></i>
                                </div>
                                <span class="video-duration-overlay">${this.formatDuration(video.duration)}</span>
                            </div>
                            <div class="video-info-badge">
                                <i class="fas fa-video"></i> Video
                            </div>
                        </div>
                        <p style="margin-top: 10px; font-size: 14px; color: #4CAF50;">
                            <i class="fas fa-check-circle"></i> 
                            ${file.name} (${this.formatFileSize(file.size)})
                        </p>
                    `;
                    preview.style.display = 'block';
                    
                    URL.revokeObjectURL(video.src);
                };
                video.onerror = () => {
                    preview.innerHTML = `
                        <div class="media-type-badge" style="background: #ff4b6e;">
                            <i class="fas fa-video"></i> Video Selected
                        </div>
                        <p style="color: #fff; padding: 20px;">Video ready to upload: ${file.name}</p>
                        <p style="font-size: 14px; color: #b9bbbe;">${this.formatFileSize(file.size)}</p>
                    `;
                    preview.style.display = 'block';
                };
                video.src = URL.createObjectURL(file);
            } else {
                const reader = new FileReader();
                reader.onload = (e) => {
                    preview.innerHTML = `
                        <div class="media-type-badge">
                            <i class="fas fa-image"></i> Image
                        </div>
                        <img src="${e.target.result}" alt="Preview" style="max-width: 100%; max-height: 400px; border-radius: 16px;">
                    `;
                    preview.style.display = 'block';
                };
                reader.readAsDataURL(file);
            }
        } else {
            preview.style.display = 'none';
            preview.innerHTML = '';
        }
    }

    async createPost() {
        if (this.isSubmitting) {
            console.log('Already submitting post, ignoring duplicate call');
            return;
        }

        if (!this.currentUser) {
            alert('You must be logged in to create a post.');
            return;
        }

        const caption = document.getElementById('postCaption')?.value.trim() || '';
        const mediaFile = document.getElementById('postMedia')?.files[0];

        if (!caption && !mediaFile) {
            alert('Please add a caption or media to your post.');
            return;
        }

        try {
            this.isSubmitting = true;
            
            let mediaData = null;
            
            if (mediaFile) {
                const submitBtn = document.querySelector('#createPostForm button[type="submit"]');
                const originalText = submitBtn.innerHTML;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
                submitBtn.disabled = true;
                
                try {
                    if (mediaFile.type.startsWith('video/') || this.isLikelyVideoFile(mediaFile)) {
                        await this.validateVideoFile(mediaFile);
                    }
                    
                    mediaData = await this.uploadMediaToCloudinary(mediaFile);
                    console.log('Upload successful:', mediaData);
                    
                } catch (uploadError) {
                    console.error('Upload error:', uploadError);
                    this.showNotification(uploadError.message, 'error');
                    submitBtn.innerHTML = originalText;
                    submitBtn.disabled = false;
                    this.isSubmitting = false;
                    return;
                }
                
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }

            // CRITICAL FIX: Properly set post data based on media type
            const postData = {
                userId: this.currentUser.uid,
                caption: caption,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                likes: 0,
                commentsCount: 0,
                upvotes: 0,
                downvotes: 0
            };

            if (mediaData) {
                // Use the mediaType from the upload response
                if (mediaData.type === 'video' || mediaData.mediaType === 'video') {
                    postData.videoUrl = mediaData.url;
                    postData.mediaType = 'video';
                    postData.videoThumbnail = mediaData.thumbnail || mediaData.videoThumbnail;
                    postData.videoDuration = mediaData.duration || 0;
                    postData.imageUrl = null; // Explicitly set to null
                } else {
                    postData.imageUrl = mediaData.url;
                    postData.mediaType = 'image';
                    postData.videoUrl = null; // Explicitly set to null
                }
            }

            const docRef = await addDoc(collection(db, 'posts'), postData);
            console.log('Post created successfully with ID:', docRef.id, 'Media type:', postData.mediaType);
            
            this.showNotification('Post created successfully!', 'success');
            
            document.getElementById('postCaption').value = '';
            document.getElementById('postMedia').value = '';
            const preview = document.getElementById('mediaPreview');
            if (preview) {
                preview.style.display = 'none';
                preview.innerHTML = '';
            }
            
            setTimeout(() => {
                window.location.href = 'posts.html';
            }, 1500);
            
        } catch (error) {
            console.error('Error creating post:', error);
            this.showNotification('Error creating post: ' + error.message, 'error');
            
            const submitBtn = document.querySelector('#createPostForm button[type="submit"]');
            if (submitBtn) {
                submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Post Now';
                submitBtn.disabled = false;
            }
        } finally {
            this.isSubmitting = false;
        }
    }

    // ==================== POSTS PAGE ====================
    setupPostsPage() {
        this.loadAllPosts();
        this.markAllPostsAsViewed();
    }

    async loadAllPosts(lastVisible = null) {
        const container = document.getElementById('postsContainer');
        const loadMoreBtn = document.getElementById('loadMorePosts');
        
        if (!container || this.isLoading) return;
        
        this.isLoading = true;
        
        try {
            let postsQuery;
            
            if (lastVisible) {
                postsQuery = query(
                    collection(db, 'posts'), 
                    orderBy('createdAt', 'desc'),
                    startAfter(lastVisible),
                    limit(this.postsPerPage)
                );
            } else {
                postsQuery = query(
                    collection(db, 'posts'), 
                    orderBy('createdAt', 'desc'),
                    limit(this.postsPerPage)
                );
            }
            
            const postsSnap = await getDocs(postsQuery);
            
            if (lastVisible === null) {
                const loadingItems = container.querySelectorAll('.post-item.loading');
                loadingItems.forEach(item => item.remove());
            }
            
            if (postsSnap.empty) {
                if (lastVisible === null) {
                    container.innerHTML = '<div class="no-posts">No posts yet. Be the first to post!</div>';
                }
                this.hasMorePosts = false;
                if (loadMoreBtn) loadMoreBtn.style.display = 'none';
                return;
            }
            
            const lastDoc = postsSnap.docs[postsSnap.docs.length - 1];
            this.lastVisiblePost = lastDoc;
            
            this.hasMorePosts = postsSnap.size >= this.postsPerPage;
            
            const allPosts = [];
            postsSnap.forEach(doc => {
                const postData = doc.data();
                allPosts.push({ id: doc.id, ...postData });
            });
            
            let followingUsers = [];
            if (this.currentUser) {
                followingUsers = await this.getFollowingUsers();
            }
            
            const sortedPosts = await this.sortPostsStrategy(allPosts, followingUsers);
            
            await this.displayPosts(sortedPosts, lastVisible !== null);
            
            if (lastVisible === null) {
                const postCount = container.querySelectorAll('.post-item:not(.loading)').length;
                const randomPostCount = Math.floor(Math.random() * (this.PYMK_MAX_POSTS_BEFORE_SHOW - this.PYMK_MIN_POSTS_BEFORE_SHOW + 1)) + this.PYMK_MIN_POSTS_BEFORE_SHOW;
                
                if (postCount >= randomPostCount) {
                    setTimeout(() => {
                        this.insertPeopleYouMayKnowSection();
                    }, 500);
                }
            }
            
            if (loadMoreBtn) {
                if (this.hasMorePosts) {
                    loadMoreBtn.style.display = 'block';
                    loadMoreBtn.disabled = false;
                    loadMoreBtn.innerHTML = '<i class="fas fa-plus"></i> Load More';
                } else {
                    loadMoreBtn.style.display = 'none';
                }
            }
            
        } catch (error) {
            console.error('Error loading posts:', error);
            if (lastVisible === null) {
                container.innerHTML = '<div class="error">Error loading posts</div>';
            }
        } finally {
            this.isLoading = false;
        }
    }

    async sortPostsStrategy(posts, followingUsers) {
        const highLikesPosts = [];
        const followedUserPosts = [];
        const otherPosts = [];
        
        const currentUserId = this.currentUser?.uid;
        
        for (const post of posts) {
            if (post.userId === currentUserId) {
                otherPosts.push(post);
                continue;
            }
            
            const likes = post.likes || 0;
            
            if (likes >= 10) {
                highLikesPosts.push(post);
            } else if (followingUsers.includes(post.userId)) {
                followedUserPosts.push(post);
            } else {
                otherPosts.push(post);
            }
        }
        
        highLikesPosts.sort((a, b) => (b.likes || 0) - (a.likes || 0));
        
        this.shuffleArray(highLikesPosts);
        this.shuffleArray(followedUserPosts);
        this.shuffleArray(otherPosts);
        
        return [...highLikesPosts, ...followedUserPosts, ...otherPosts];
    }

    // ==================== FOLLOWERS FUNCTIONALITY ====================
    async getFollowingUsers() {
        try {
            if (!this.currentUser) return [];
            
            const userRef = doc(db, 'users', this.currentUser.uid);
            const userSnap = await getDoc(userRef);
            
            if (userSnap.exists()) {
                const userData = userSnap.data();
                return userData.following || [];
            }
            return [];
        } catch (error) {
            console.error('Error getting following users:', error);
            return [];
        }
    }

    async followUser(targetUserId) {
        try {
            if (!this.currentUser) {
                throw new Error('User not logged in');
            }
            
            const targetUserRef = doc(db, 'users', targetUserId);
            await updateDoc(targetUserRef, {
                followers: arrayUnion(this.currentUser.uid),
                updatedAt: serverTimestamp()
            });
            
            const currentUserRef = doc(db, 'users', this.currentUser.uid);
            await updateDoc(currentUserRef, {
                following: arrayUnion(targetUserId),
                updatedAt: serverTimestamp()
            });
            
            return true;
        } catch (error) {
            console.error('Error following user:', error);
            throw error;
        }
    }

    async unfollowUser(targetUserId) {
        try {
            if (!this.currentUser) {
                throw new Error('User not logged in');
            }
            
            const targetUserRef = doc(db, 'users', targetUserId);
            await updateDoc(targetUserRef, {
                followers: arrayRemove(this.currentUser.uid),
                updatedAt: serverTimestamp()
            });
            
            const currentUserRef = doc(db, 'users', this.currentUser.uid);
            await updateDoc(currentUserRef, {
                following: arrayRemove(targetUserId),
                updatedAt: serverTimestamp()
            });
            
            return true;
        } catch (error) {
            console.error('Error unfollowing user:', error);
            throw error;
        }
    }

    async checkIfFollowing(targetUserId) {
        try {
            if (!this.currentUser) return false;
            
            const targetUserRef = doc(db, 'users', targetUserId);
            const targetUserSnap = await getDoc(targetUserRef);
            
            if (targetUserSnap.exists()) {
                const targetUserData = targetUserSnap.data();
                
                if (targetUserData.followers && Array.isArray(targetUserData.followers)) {
                    return targetUserData.followers.includes(this.currentUser.uid);
                }
            }
            return false;
        } catch (error) {
            console.error('Error checking following status:', error);
            return false;
        }
    }

    async handlePostFollow(userId, button, isCurrentlyFollowing) {
        if (!this.currentUser) {
            alert('Please log in to follow users');
            window.location.href = 'login.html';
            return;
        }

        if (userId === this.currentUser.uid) {
            return;
        }

        try {
            if (isCurrentlyFollowing) {
                await this.unfollowUser(userId);
                button.innerHTML = '<i class="fas fa-user-plus"></i> Follow';
                button.classList.remove('following');
                button.dataset.following = 'false';
                this.showNotification('Unfollowed user', 'info');
            } else {
                await this.followUser(userId);
                button.innerHTML = '<i class="fas fa-user-check"></i> Following';
                button.classList.add('following');
                button.dataset.following = 'true';
                this.showNotification('Now following user', 'success');
            }
        } catch (error) {
            console.error('Error toggling follow:', error);
            this.showNotification('Failed to update follow status', 'error');
        }
    }

    async loadMorePosts() {
        if (!this.lastVisiblePost || !this.hasMorePosts || this.isLoading) return;
        
        const loadMoreBtn = document.getElementById('loadMorePosts');
        if (loadMoreBtn) {
            loadMoreBtn.disabled = true;
            loadMoreBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
        }
        
        await this.loadAllPosts(this.lastVisiblePost);
    }

    createLoadingPostItem() {
        const div = document.createElement('div');
        div.className = 'post-item loading';
        div.innerHTML = `
            <div class="loading-avatar"></div>
            <div class="loading-content">
                <div class="loading-line" style="width: 30%"></div>
                <div class="loading-line" style="width: 50%"></div>
                <div class="loading-line" style="width: 70%"></div>
            </div>
        `;
        return div;
    }

    showNotification(message, type = 'info') {
        const existingNotifications = document.querySelectorAll('.custom-notification');
        existingNotifications.forEach(notification => notification.remove());
        
        const notification = document.createElement('div');
        notification.className = `custom-notification ${type}`;
        notification.innerHTML = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    getNotificationIcon(icon) {
        switch(icon) {
            case 'alert-circle':
                return '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>';
            case 'check-circle':
                return '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>';
            case 'alert-triangle':
                return '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>';
            default:
                return '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>';
        }
    }

    // ==================== COMMENTS PAGE FUNCTIONALITY ====================
    setupCommentsPage() {
        this.loadSinglePostWithComments();
    }

    async loadSinglePostWithComments() {
        const urlParams = new URLSearchParams(window.location.search);
        const postId = urlParams.get('postId');
        
        if (!postId) {
            const container = document.getElementById('commentsContainer');
            if (container) {
                container.innerHTML = `
                    <div class="error-message">
                        <i class="fas fa-exclamation-circle"></i>
                        <p>No post specified</p>
                        <a href="posts.html" class="btn-primary">Back to Posts</a>
                    </div>
                `;
            }
            return;
        }

        try {
            const postRef = doc(db, 'posts', postId);
            const postSnap = await getDoc(postRef);
            
            if (!postSnap.exists()) {
                const container = document.getElementById('commentsContainer');
                if (container) {
                    container.innerHTML = `
                        <div class="error-message">
                            <i class="fas fa-exclamation-circle"></i>
                            <p>Post not found</p>
                            <a href="posts.html" class="btn-primary">Back to Posts</a>
                        </div>
                    `;
                }
                return;
            }

            const post = { id: postSnap.id, ...postSnap.data() };
            
            const userRef = doc(db, 'users', post.userId);
            const userSnap = await getDoc(userRef);
            const user = userSnap.exists() ? userSnap.data() : {};
            
            this.displaySinglePost(post, user);
            await this.loadCommentsForPage(postId);
            
        } catch (error) {
            console.error('Error loading post:', error);
            const container = document.getElementById('commentsContainer');
            if (container) {
                container.innerHTML = `
                    <div class="error-message">
                        <i class="fas fa-exclamation-circle"></i>
                        <p>Error loading post</p>
                        <a href="posts.html" class="btn-primary">Back to Posts</a>
                    </div>
                `;
            }
        }
    }

    displaySinglePost(post, user) {
        const container = document.getElementById('commentsContainer');
        if (!container) return;
        
        let postContentHTML = '';
        
        if (post.mediaType === 'poll' && post.poll) {
            const pollContainer = this.createPollElement(post, post.id);
            postContentHTML = pollContainer.outerHTML;
        } else if (post.videoUrl || post.mediaType === 'video') {
            const videoUrl = post.videoUrl;
            if (videoUrl) {
                postContentHTML = `<div id="video-container-${post.id}"></div>`;
                
                setTimeout(() => {
                    const videoContainer = document.getElementById(`video-container-${post.id}`);
                    if (videoContainer) {
                        const thumbnail = this.createVideoThumbnail(
                            videoUrl, 
                            this.getVideoThumbnail(post), 
                            post.videoDuration, 
                            post.id,
                            post
                        );
                        videoContainer.appendChild(thumbnail);
                    }
                }, 50);
            }
        } else if (post.imageUrl) {
            const imageUrl = String(post.imageUrl).trim();
            if (imageUrl && imageUrl !== 'null' && imageUrl !== 'undefined' && imageUrl.length > 10) {
                postContentHTML += `
                    <div class="post-image-container">
                        <img src="${imageUrl}" alt="Post image" class="post-image" style="width: 100%; max-height: 400px; object-fit: contain; border-radius: 16px;">
                    </div>
                `;
            }
        }
        
        if (post.caption) {
            postContentHTML += `<p class="post-caption">${post.caption}</p>`;
        }
        
        const isLiked = this.likedPosts.has(post.id);
        const userVote = this.getUserVoteForPost(post.id);
        const upvotes = post.upvotes || 0;
        const downvotes = post.downvotes || 0;
        
        container.innerHTML = `
            <div class="post-item" data-post-id="${post.id}">
                <div class="post-header">
                    <img src="${user.profileImage || 'images/default-profile.jpg'}" 
                         alt="${user.name}" class="post-author-avatar">
                    <div class="post-author-info">
                        <h4>${user.name || 'Unknown User'}</h4>
                        <span class="post-time">${this.formatTime(post.createdAt)}</span>
                    </div>
                </div>
                
                <div class="post-content">
                    ${postContentHTML}
                </div>
                
                <div class="post-actions">
                    <div class="action-group">
                        <button class="vote-btn up ${userVote === 'up' ? 'active' : ''}" data-post-id="${post.id}" data-vote="up">
                            <i class="fas fa-arrow-up"></i>
                            <span class="vote-count upvote-count">${this.formatCount(upvotes)}</span>
                        </button>
                        <button class="vote-btn down ${userVote === 'down' ? 'active' : ''}" data-post-id="${post.id}" data-vote="down">
                            <i class="fas fa-arrow-down"></i>
                            <span class="vote-count downvote-count">${this.formatCount(downvotes)}</span>
                        </button>
                    </div>
                    
                    <div class="action-group">
                        <button class="post-action like-btn ${isLiked ? 'liked' : ''}" data-post-id="${post.id}">
                            <i class="${isLiked ? 'fas' : 'far'} fa-heart"></i> 
                            <span class="like-count">${this.formatCount(post.likes || 0)}</span>
                        </button>
                        <button class="post-action comment-btn active" data-post-id="${post.id}">
                            <i class="far fa-comment"></i> 
                            <span class="comment-count">${this.formatCount(post.commentsCount || 0)}</span>
                        </button>
                    </div>
                </div>
                
                <div class="comments-section expanded" id="commentsSection">
                    <div class="add-comment">
                        <input type="text" id="commentInput" placeholder="Write a comment..." 
                               data-post-id="${post.id}">
                        <button id="sendCommentBtn" data-post-id="${post.id}">
                            <i class="fas fa-paper-plane"></i>
                        </button>
                    </div>
                    <div class="comments-list" id="commentsList">
                        <div class="loading">Loading comments...</div>
                    </div>
                </div>
            </div>
        `;

        const likeBtn = container.querySelector('.like-btn');
        const sendCommentBtn = container.querySelector('#sendCommentBtn');
        const commentInput = container.querySelector('#commentInput');
        const upvoteBtn = container.querySelector('.vote-btn.up');
        const downvoteBtn = container.querySelector('.vote-btn.down');

        if (likeBtn) {
            likeBtn.addEventListener('click', () => this.handleLike(post.id, likeBtn));
        }

        if (sendCommentBtn) {
            sendCommentBtn.addEventListener('click', () => this.handleAddComment(post.id, true));
        }

        if (commentInput) {
            commentInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleAddComment(post.id, true);
                }
            });
        }

        if (upvoteBtn) {
            upvoteBtn.addEventListener('click', () => this.handleVote(post.id, 'up', upvoteBtn));
        }

        if (downvoteBtn) {
            downvoteBtn.addEventListener('click', () => this.handleVote(post.id, 'down', downvoteBtn));
        }
    }

    async loadCommentsForPage(postId) {
        const commentsList = document.getElementById('commentsList');
        if (!commentsList) return;

        try {
            const commentsQuery = query(
                collection(db, 'posts', postId, 'comments'), 
                orderBy('createdAt', 'asc')
            );
            const commentsSnap = await getDocs(commentsQuery);
            
            commentsList.innerHTML = '';
            
            if (commentsSnap.empty) {
                commentsList.innerHTML = '<div class="no-comments">No comments yet. Be the first to comment!</div>';
                return;
            }

            const userIds = new Set();
            commentsSnap.forEach(doc => {
                const comment = doc.data();
                userIds.add(comment.userId);
            });

            const usersData = await this.getUsersData([...userIds]);

            commentsSnap.forEach(doc => {
                const comment = { id: doc.id, ...doc.data() };
                const user = usersData[comment.userId] || {};
                const commentElement = this.createCommentElement(comment, user, postId);
                commentsList.appendChild(commentElement);
            });
        } catch (error) {
            console.error('Error loading comments:', error);
            commentsList.innerHTML = '<div class="error">Error loading comments</div>';
        }
    }

    async displayPosts(posts, append = false) {
        const container = document.getElementById('postsContainer');
        if (!container) return;

        if (!append) {
            const existingPosts = container.querySelectorAll('.post-item:not(.loading)');
            existingPosts.forEach(post => post.remove());
        }

        const userIds = [...new Set(posts.map(post => post.userId))];
        const usersData = await this.getUsersData(userIds);

        for (const post of posts) {
            const user = usersData[post.userId] || {};
            const postElement = await this.createPostElement(post, user, post.id);
            container.appendChild(postElement);
        }
    }

    async getUsersData(userIds) {
        const usersData = {};
        
        for (const userId of userIds) {
            try {
                const userRef = doc(db, 'users', userId);
                const userSnap = await getDoc(userRef);
                if (userSnap.exists()) {
                    usersData[userId] = userSnap.data();
                }
            } catch (error) {
                console.error('Error fetching user data:', error);
            }
        }
        
        return usersData;
    }

    async createPostElement(post, user, postId) {
        const postDiv = document.createElement('div');
        postDiv.className = 'post-item';
        postDiv.setAttribute('data-post-id', postId);
        
        const userId = user.id || post.userId;
        const userName = user.name || 'Unknown User';
        const userProfileImage = user.profileImage || 'images/default-profile.jpg';
        
        let isFollowing = false;
        if (this.currentUser && userId !== this.currentUser.uid) {
            isFollowing = await this.checkIfFollowing(userId);
        }
        
        let postContentHTML = '';
        
        // CRITICAL FIX: Check media type correctly
        if (post.mediaType === 'poll' && post.poll) {
            const pollContainer = this.createPollElement(post, postId);
            postContentHTML = pollContainer.outerHTML;
        } else if (post.videoUrl || post.mediaType === 'video') {
            const videoUrl = post.videoUrl;
            if (videoUrl) {
                postContentHTML = `<div id="video-container-${postId}"></div>`;
                
                setTimeout(() => {
                    const container = document.getElementById(`video-container-${postId}`);
                    if (container) {
                        const thumbnail = this.createVideoThumbnail(
                            videoUrl, 
                            this.getVideoThumbnail(post), 
                            post.videoDuration, 
                            postId,
                            post
                        );
                        container.appendChild(thumbnail);
                    }
                }, 50);
            }
        } else if (post.imageUrl) {
            const imageUrl = String(post.imageUrl).trim();
            if (imageUrl && imageUrl !== 'null' && imageUrl !== 'undefined' && imageUrl.length > 10) {
                postContentHTML += `
                    <div class="post-image-container">
                        <img src="${imageUrl}" alt="Post image" class="post-image" loading="lazy" style="width: 100%; max-height: 400px; object-fit: contain; border-radius: 16px;">
                    </div>
                `;
            }
        }
        
        if (post.caption) {
            postContentHTML += `<p class="post-caption">${post.caption}</p>`;
        }
        
        const isLiked = this.likedPosts.has(postId);
        const userVote = this.getUserVoteForPost(postId);
        const upvotes = post.upvotes || 0;
        const downvotes = post.downvotes || 0;
        
        const followButton = (this.currentUser && userId !== this.currentUser.uid) ? `
            <button class="follow-btn-post ${isFollowing ? 'following' : ''}" 
                    data-user-id="${userId}" 
                    data-following="${isFollowing}">
                <i class="fas ${isFollowing ? 'fa-user-check' : 'fa-user-plus'}"></i> 
                ${isFollowing ? 'Following' : 'Follow'}
            </button>
        ` : '';
        
        let mediaTypeIcon = '';
        if (post.mediaType === 'poll') {
            mediaTypeIcon = '<span class="media-type-indicator"><i class="fas fa-chart-bar"></i></span>';
        } else if (post.videoUrl || post.mediaType === 'video') {
            mediaTypeIcon = '<span class="media-type-indicator"><i class="fas fa-video"></i></span>';
        } else if (post.imageUrl) {
            mediaTypeIcon = '<span class="media-type-indicator"><i class="fas fa-image"></i></span>';
        }
        
        postDiv.innerHTML = `
            <div class="post-header">
                <img src="${userProfileImage}" 
                     alt="${userName}" class="post-author-avatar">
                <div class="post-author-info">
                    <h4>${userName}</h4>
                    <span class="post-time">${this.formatTime(post.createdAt)}</span>
                </div>
                ${followButton}
                ${mediaTypeIcon}
            </div>
            
            <div class="post-content">
                ${postContentHTML}
            </div>
            
            <div class="post-actions">
                <div class="action-group">
                    <button class="vote-btn up ${userVote === 'up' ? 'active' : ''}" data-post-id="${postId}" data-vote="up">
                        <i class="fas fa-arrow-up"></i>
                        <span class="vote-count upvote-count">${this.formatCount(upvotes)}</span>
                    </button>
                    <button class="vote-btn down ${userVote === 'down' ? 'active' : ''}" data-post-id="${postId}" data-vote="down">
                        <i class="fas fa-arrow-down"></i>
                        <span class="vote-count downvote-count">${this.formatCount(downvotes)}</span>
                    </button>
                </div>
                
                <div class="action-group">
                    <button class="post-action like-btn ${isLiked ? 'liked' : ''}" data-post-id="${postId}">
                        <i class="${isLiked ? 'fas' : 'far'} fa-heart"></i> 
                        <span class="like-count">${this.formatCount(post.likes || 0)}</span>
                    </button>
                    <button class="post-action comment-btn" data-post-id="${postId}">
                        <i class="far fa-comment"></i> 
                        <span class="comment-count">${this.formatCount(post.commentsCount || 0)}</span>
                    </button>
                </div>
            </div>
            
            <div class="comments-section" id="comments-${postId}" style="display: none;">
                <div class="add-comment">
                    <input type="text" class="comment-input" placeholder="Write a comment..." data-post-id="${postId}">
                    <button class="send-comment-btn" data-post-id="${postId}">
                        <i class="fas fa-paper-plane"></i>
                    </button>
                </div>
                <div class="comments-list" id="comments-list-${postId}"></div>
            </div>
        `;

        const likeBtn = postDiv.querySelector('.like-btn');
        const commentBtn = postDiv.querySelector('.comment-btn');
        const sendCommentBtn = postDiv.querySelector('.send-comment-btn');
        const commentInput = postDiv.querySelector('.comment-input');
        const followBtn = postDiv.querySelector('.follow-btn-post');
        const upvoteBtn = postDiv.querySelector('.vote-btn.up');
        const downvoteBtn = postDiv.querySelector('.vote-btn.down');

        if (likeBtn) {
            likeBtn.addEventListener('click', () => this.handleLike(postId, likeBtn));
        }

        if (commentBtn) {
            commentBtn.addEventListener('click', () => this.toggleComments(postId));
        }

        if (sendCommentBtn) {
            sendCommentBtn.addEventListener('click', () => this.handleAddComment(postId, false));
        }

        if (commentInput) {
            commentInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleAddComment(postId, false);
                }
            });
        }

        if (upvoteBtn) {
            upvoteBtn.addEventListener('click', () => this.handleVote(postId, 'up', upvoteBtn));
        }

        if (downvoteBtn) {
            downvoteBtn.addEventListener('click', () => this.handleVote(postId, 'down', downvoteBtn));
        }

        if (followBtn) {
            followBtn.addEventListener('click', (e) => e.stopPropagation());
        }

        this.markPostAsViewed(postId);

        return postDiv;
    }

    // COMMENT FUNCTIONALITY
    async toggleComments(postId) {
        const commentsSection = document.getElementById(`comments-${postId}`);
        const commentBtn = document.querySelector(`.comment-btn[data-post-id="${postId}"]`);
        
        if (commentsSection) {
            if (commentsSection.style.display === 'none' || commentsSection.style.display === '') {
                commentsSection.style.display = 'block';
                if (commentBtn) {
                    commentBtn.classList.add('active');
                }
                await this.loadComments(postId);
            } else {
                commentsSection.style.display = 'none';
                if (commentBtn) {
                    commentBtn.classList.remove('active');
                }
            }
        }
    }

    async loadComments(postId) {
        const commentsList = document.getElementById(`comments-list-${postId}`);
        if (!commentsList) return;

        try {
            const commentsQuery = query(
                collection(db, 'posts', postId, 'comments'), 
                orderBy('createdAt', 'asc')
            );
            const commentsSnap = await getDocs(commentsQuery);
            
            commentsList.innerHTML = '';
            
            if (commentsSnap.empty) {
                commentsList.innerHTML = '<div class="no-comments">No comments yet</div>';
                return;
            }

            const userIds = new Set();
            commentsSnap.forEach(doc => {
                const comment = doc.data();
                userIds.add(comment.userId);
            });

            const usersData = await this.getUsersData([...userIds]);

            commentsSnap.forEach(doc => {
                const comment = { id: doc.id, ...doc.data() };
                const user = usersData[comment.userId] || {};
                const commentElement = this.createCommentElement(comment, user, postId);
                commentsList.appendChild(commentElement);
            });
        } catch (error) {
            console.error('Error loading comments:', error);
            commentsList.innerHTML = '<div class="error">Error loading comments</div>';
        }
    }

    async handleAddComment(postId, isCommentsPage = false) {
        if (!this.currentUser) {
            alert('Please login to comment');
            return;
        }

        let commentInput;
        if (isCommentsPage) {
            commentInput = document.querySelector(`#commentInput[data-post-id="${postId}"]`);
        } else {
            commentInput = document.querySelector(`.comment-input[data-post-id="${postId}"]`);
        }
        
        if (!commentInput) return;

        const commentText = commentInput.value.trim();
        if (!commentText) {
            alert('Please enter a comment');
            return;
        }

        try {
            const commentData = {
                userId: this.currentUser.uid,
                userName: this.currentUser.displayName || 'User',
                userAvatar: this.currentUser.photoURL || 'images/default-profile.jpg',
                text: commentText,
                createdAt: serverTimestamp(),
                repliesCount: 0
            };

            await addDoc(collection(db, 'posts', postId, 'comments'), commentData);

            const postRef = doc(db, 'posts', postId);
            await updateDoc(postRef, {
                commentsCount: increment(1),
                updatedAt: serverTimestamp()
            });

            commentInput.value = '';
            
            if (isCommentsPage) {
                await this.loadCommentsForPage(postId);
                const commentCount = document.querySelector('.comment-count');
                if (commentCount) {
                    const currentCount = parseInt(commentCount.textContent) || 0;
                    commentCount.textContent = this.formatCount(currentCount + 1);
                }
            } else {
                await this.loadComments(postId);
                const commentCount = document.querySelector(`.comment-btn[data-post-id="${postId}"] .comment-count`);
                if (commentCount) {
                    const currentCount = parseInt(commentCount.textContent) || 0;
                    commentCount.textContent = this.formatCount(currentCount + 1);
                }
            }

            this.showNotification('Comment added!', 'success');

        } catch (error) {
            console.error('Error adding comment:', error);
            alert('Error adding comment: ' + error.message);
        }
    }

    async handleLike(postId, likeButton) {
        if (!this.currentUser) {
            alert('Please login to like posts');
            return;
        }

        if (this.likedPosts.has(postId)) {
            return;
        }

        try {
            const postRef = doc(db, 'posts', postId);
            const postSnap = await getDoc(postRef);
            
            if (postSnap.exists()) {
                const post = postSnap.data();
                const newLikes = (post.likes || 0) + 1;
                
                await updateDoc(postRef, {
                    likes: newLikes,
                    updatedAt: serverTimestamp()
                });

                const likeCount = likeButton.querySelector('.like-count');
                const likeIcon = likeButton.querySelector('i');
                
                if (likeCount) {
                    likeCount.textContent = this.formatCount(newLikes);
                }
                
                if (likeIcon) {
                    likeIcon.className = 'fas fa-heart';
                }
                
                likeButton.classList.add('liked');
                
                this.likedPosts.add(postId);
                this.saveLikedPosts();
            }
        } catch (error) {
            console.error('Error liking post:', error);
        }
    }

    async updateNewPostsCount() {
        if (!this.currentUser) return;

        try {
            const postsQuery = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
            const postsSnap = await getDocs(postsQuery);
            
            let newPostsCount = 0;
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            
            postsSnap.forEach(doc => {
                const post = doc.data();
                const postDate = post.createdAt?.toDate ? post.createdAt.toDate() : new Date();
                
                if (postDate > oneDayAgo && !this.viewedPosts.has(doc.id)) {
                    newPostsCount++;
                }
            });
            
            this.displayNewPostsCount(newPostsCount);
        } catch (error) {
            console.error('Error updating new posts count:', error);
            this.displayNewPostsCount(0);
        }
    }

    displayNewPostsCount(count) {
        let indicator = document.getElementById('newPostsIndicator');
        
        if (!indicator) {
            const nav = document.querySelector('nav');
            if (nav) {
                indicator = document.createElement('div');
                indicator.id = 'newPostsIndicator';
                indicator.className = 'posts-indicator';
                indicator.onclick = () => {
                    this.markAllPostsAsViewed();
                    window.location.href = 'posts.html';
                };
                nav.appendChild(indicator);
            }
        }

        if (indicator) {
            if (count > 0) {
                indicator.innerHTML = `<i class="fas fa-images"></i><span style="font-size: 10px; margin-left: 2px;">${this.formatCount(count)}</span>`;
                indicator.style.display = 'flex';
            } else {
                indicator.style.display = 'none';
            }
        }
    }

    // ==================== PEOPLE YOU MAY KNOW FEATURE ====================
    
    async insertPeopleYouMayKnowSection() {
        const container = document.getElementById('postsContainer');
        if (!container) return;
        
        if (document.getElementById('peopleYouMayKnowSection')) return;
        
        const pymkSection = document.createElement('div');
        pymkSection.id = 'peopleYouMayKnowSection';
        pymkSection.className = 'pymk-section';
        
        pymkSection.innerHTML = `
            <div class="pymk-header">
                <h3><i class="fas fa-user-friends"></i> People You May Know</h3>
                <button class="pymk-see-all">See All</button>
            </div>
            <div class="pymk-content">
                <button class="pymk-nav-btn left" data-direction="left">
                    <i class="fas fa-chevron-left"></i>
                </button>
                <div class="pymk-profiles-container" id="pymkProfilesContainer">
                    <div class="pymk-loading">Loading suggestions...</div>
                </div>
                <button class="pymk-nav-btn right" data-direction="right">
                    <i class="fas fa-chevron-right"></i>
                </button>
            </div>
            <div class="pymk-footer">
                <button id="loadMorePYMK" class="pymk-load-more">
                    <i class="fas fa-sync-alt"></i> Load More Suggestions
                </button>
            </div>
        `;
        
        const posts = container.querySelectorAll('.post-item');
        if (posts.length > 0) {
            const randomIndex = Math.min(posts.length - 1, Math.floor(Math.random() * posts.length));
            if (randomIndex < posts.length - 1) {
                posts[randomIndex].insertAdjacentElement('afterend', pymkSection);
            } else {
                container.appendChild(pymkSection);
            }
        } else {
            container.appendChild(pymkSection);
        }
        
        await this.loadPeopleYouMayKnow();
        
        const seeAllBtn = pymkSection.querySelector('.pymk-see-all');
        if (seeAllBtn) {
            seeAllBtn.addEventListener('click', () => {
                this.expandPYMKSection();
            });
        }
    }

    async loadPeopleYouMayKnow() {
        const container = document.getElementById('pymkProfilesContainer');
        if (!container) return;

        try {
            const followingUsers = await this.getFollowingUsers();
            const excludedUsers = [...followingUsers, this.currentUser?.uid].filter(Boolean);
            
            let usersQuery = query(collection(db, 'users'), limit(this.PYMK_PROFILES_PER_LOAD));
            
            const usersSnap = await getDocs(usersQuery);
            
            if (usersSnap.empty) {
                container.innerHTML = '<div class="pymk-loading">No suggestions available at the moment.</div>';
                return;
            }
            
            const suggestedUsers = [];
            usersSnap.forEach(doc => {
                const userData = doc.data();
                const userId = doc.id;
                
                if (!excludedUsers.includes(userId) && !this.viewedPYMKProfiles.has(userId)) {
                    suggestedUsers.push({
                        id: userId,
                        ...userData
                    });
                }
            });
            
            this.shuffleArray(suggestedUsers);
            
            this.currentPYMKProfiles = suggestedUsers.slice(0, 5);
            
            this.displayPYMKProfiles();
            
        } catch (error) {
            console.error('Error loading PYMK:', error);
            container.innerHTML = '<div class="pymk-loading">Error loading suggestions</div>';
        }
    }

    displayPYMKProfiles() {
        const container = document.getElementById('pymkProfilesContainer');
        if (!container) return;
        
        if (this.currentPYMKProfiles.length === 0) {
            container.innerHTML = '<div class="pymk-loading">No more suggestions available.</div>';
            return;
        }
        
        container.innerHTML = '';
        
        this.currentPYMKProfiles.forEach(async (user) => {
            const profileCard = await this.createPYMKProfileCard(user);
            container.appendChild(profileCard);
            
            this.viewedPYMKProfiles.add(user.id);
            this.saveViewedPYMKProfiles();
        });
    }

    async createPYMKProfileCard(user) {
        const card = document.createElement('div');
        card.className = 'pymk-profile-card';
        
        let isFollowing = false;
        if (this.currentUser && user.id !== this.currentUser.uid) {
            isFollowing = await this.checkIfFollowing(user.id);
        }
        
        const mutualConnections = Math.floor(Math.random() * 6);
        
        let profileInfo = '';
        if (user.location) {
            profileInfo = user.location;
        } else if (user.bio) {
            profileInfo = user.bio.length > 30 ? user.bio.substring(0, 30) + '...' : user.bio;
        } else {
            const statuses = ['New to Platform', 'Active now', 'Nearby', 'Popular User'];
            profileInfo = statuses[Math.floor(Math.random() * statuses.length)];
        }
        
        card.innerHTML = `
            <img src="${user.profileImage || 'images/default-profile.jpg'}" 
                 alt="${user.name}" class="pymk-profile-avatar">
            <span class="pymk-profile-name" title="${user.name || 'Unknown User'}">
                ${user.name || 'Unknown User'}
            </span>
            <button class="pymk-follow-btn ${isFollowing ? 'following' : ''}" 
                    data-user-id="${user.id}" 
                    data-following="${isFollowing}">
                <i class="fas ${isFollowing ? 'fa-user-check' : 'fa-user-plus'}"></i>
                ${isFollowing ? 'Following' : 'Follow'}
            </button>
        `;
        
        return card;
    }

    scrollPYMKCarousel(direction) {
        const container = document.getElementById('pymkProfilesContainer');
        if (!container) return;
        
        const scrollAmount = 200;
        if (direction === 'left') {
            container.scrollLeft -= scrollAmount;
        } else {
            container.scrollLeft += scrollAmount;
        }
    }

    async loadMorePYMKProfiles() {
        const loadMoreBtn = document.getElementById('loadMorePYMK');
        if (loadMoreBtn) {
            loadMoreBtn.disabled = true;
            loadMoreBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
        }
        
        await this.loadPeopleYouMayKnow();
        
        if (loadMoreBtn) {
            loadMoreBtn.disabled = false;
            loadMoreBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Load More Suggestions';
        }
    }

    async handlePYMKFollow(userId, button, isCurrentlyFollowing) {
        if (!this.currentUser) {
            alert('Please log in to add users to your clan');
            window.location.href = 'login.html';
            return;
        }

        if (userId === this.currentUser.uid) {
            return;
        }

        try {
            if (isCurrentlyFollowing) {
                await this.unfollowUser(userId);
                button.innerHTML = '<i class="fas fa-user-plus"></i> Follow';
                button.classList.remove('following');
                button.dataset.following = 'false';
                this.showNotification('Unfollowed user', 'info');
            } else {
                await this.followUser(userId);
                button.innerHTML = '<i class="fas fa-user-check"></i> Following';
                button.classList.add('following');
                button.dataset.following = 'true';
                this.showNotification('Now following user', 'success');
            }
        } catch (error) {
            console.error('Error toggling PYMK follow:', error);
            this.showNotification('Failed to update follow status', 'error');
        }
    }

    expandPYMKSection() {
        const expandedView = document.createElement('div');
        expandedView.className = 'pymk-expanded';
        expandedView.innerHTML = `
            <div class="pymk-expanded-content">
                <button class="pymk-close-expanded">&times;</button>
                <div class="pymk-header">
                    <h3><i class="fas fa-user-friends"></i> People You May Know</h3>
                </div>
                <p style="color: var(--text-light); margin: 10px 0 20px;">
                    Discover and connect with new people. Add them to your clan to see their posts first!
                </p>
                <div class="pymk-expanded-grid" id="pymkExpandedGrid">
                    Loading all suggestions...
                </div>
            </div>
        `;
        
        document.body.appendChild(expandedView);
        
        this.loadAllPYMKProfilesForExpanded();
        
        const closeBtn = expandedView.querySelector('.pymk-close-expanded');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                expandedView.remove();
            });
        }
        
        expandedView.addEventListener('click', (e) => {
            if (e.target === expandedView) {
                expandedView.remove();
            }
        });
    }

    async loadAllPYMKProfilesForExpanded() {
        const grid = document.getElementById('pymkExpandedGrid');
        if (!grid) return;

        try {
            const followingUsers = await this.getFollowingUsers();
            const excludedUsers = [...followingUsers, this.currentUser?.uid].filter(Boolean);
            
            const usersQuery = query(collection(db, 'users'));
            const usersSnap = await getDocs(usersQuery);
            
            const suggestedUsers = [];
            usersSnap.forEach(doc => {
                const userData = doc.data();
                const userId = doc.id;
                
                if (!excludedUsers.includes(userId)) {
                    suggestedUsers.push({
                        id: userId,
                        ...userData
                    });
                }
            });
            
            this.shuffleArray(suggestedUsers);
            
            grid.innerHTML = '';
            
            for (const user of suggestedUsers) {
                const profileCard = await this.createPYMKProfileCard(user);
                profileCard.style.minWidth = 'auto';
                profileCard.style.maxWidth = 'none';
                grid.appendChild(profileCard);
            }
            
            if (suggestedUsers.length === 0) {
                grid.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-light);">No suggestions available.</div>';
            }
            
        } catch (error) {
            console.error('Error loading all PYMK:', error);
            grid.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--error);">Error loading suggestions</div>';
        }
    }

    loadViewedPYMKProfiles() {
        if (!this.currentUser) return;
        const stored = localStorage.getItem(`viewedPYMKProfiles_${this.currentUser.uid}`);
        if (stored) {
            this.viewedPYMKProfiles = new Set(JSON.parse(stored));
        }
    }

    saveViewedPYMKProfiles() {
        if (!this.currentUser) return;
        localStorage.setItem(`viewedPYMKProfiles_${this.currentUser.uid}`, JSON.stringify([...this.viewedPYMKProfiles]));
    }

    // ACCOUNT PAGE - Social Links Setup
    setupAccountSocialLinks() {
        this.createSocialLinksSection();
        this.loadUserSocialLinks();
        this.integrateWithProfileForm();
        this.setupAccountMenu();
    }

    createSocialLinksSection() {
        const accountMain = document.querySelector('.account-main');
        if (!accountMain) return;

        const socialSection = document.createElement('div');
        socialSection.className = 'account-section';
        socialSection.id = 'socialSection';
        socialSection.style.display = 'none';
        socialSection.innerHTML = `
            <h2><i class="fas fa-share-alt"></i> Social Media Links</h2>
            <p class="section-description">Connect your social media to meet new people</p>
            
            <div class="social-links-container">
                ${Object.entries(this.SOCIAL_PLATFORMS).map(([key, platform]) => `
                    <div class="social-input-group">
                        <div class="social-platform-header">
                            <i class="${platform.icon}" style="color: ${platform.color}"></i>
                            <span>${platform.name}</span>
                        </div>
                        <input type="text" id="social-${key}" class="social-input" placeholder="${platform.placeholder}" data-platform="${key}">
                        <div class="social-preview" id="preview-${key}">
                            <small>Link: ${platform.baseUrl}<span id="preview-text-${key}">username</span></small>
                        </div>
                    </div>
                `).join('')}
            </div>

            <div class="social-preview-section">
                <h3>Your Social Links Preview</h3>
                <p class="section-description">This is how your social links will appear to others:</p>
                <div class="social-icons-preview" id="socialIconsPreview"></div>
            </div>
        `;

        accountMain.appendChild(socialSection);

        Object.keys(this.SOCIAL_PLATFORMS).forEach(platform => {
            const input = document.getElementById(`social-${platform}`);
            if (input) {
                input.addEventListener('input', (e) => {
                    this.updateSocialPreview(platform, e.target.value);
                    this.updateSocialIconsPreview();
                });
            }
        });
    }

    updateSocialPreview(platform, value) {
        const preview = document.getElementById(`preview-text-${platform}`);
        const previewContainer = document.getElementById(`preview-${platform}`);
        
        if (preview && previewContainer) {
            if (value.trim()) {
                preview.textContent = value;
                previewContainer.style.display = 'block';
            } else {
                previewContainer.style.display = 'none';
            }
        }
    }

    updateSocialIconsPreview() {
        const previewContainer = document.getElementById('socialIconsPreview');
        if (!previewContainer) return;

        previewContainer.innerHTML = '';
        let hasLinks = false;

        Object.keys(this.SOCIAL_PLATFORMS).forEach(platform => {
            const input = document.getElementById(`social-${platform}`);
            if (input && input.value.trim()) {
                hasLinks = true;
                const platformData = this.SOCIAL_PLATFORMS[platform];
                const icon = document.createElement('div');
                icon.className = 'social-icon-preview';
                icon.innerHTML = `<i class="${platformData.icon}"></i>`;
                icon.style.color = platformData.color;
                previewContainer.appendChild(icon);
            }
        });

        if (!hasLinks) {
            previewContainer.innerHTML = '<p style="color: var(--text-light); font-style: italic;">No social links added yet</p>';
        }
    }

    async loadUserSocialLinks() {
        if (!this.currentUser) return;

        try {
            const userRef = doc(db, 'users', this.currentUser.uid);
            const userSnap = await getDoc(userRef);
            
            if (userSnap.exists()) {
                const userData = userSnap.data();
                const socialLinks = userData.socialLinks || {};

                Object.keys(this.SOCIAL_PLATFORMS).forEach(platform => {
                    const input = document.getElementById(`social-${platform}`);
                    if (input && socialLinks[platform]) {
                        input.value = socialLinks[platform];
                        this.updateSocialPreview(platform, socialLinks[platform]);
                    }
                });

                this.updateSocialIconsPreview();
            }
        } catch (error) {
            console.error('Error loading user social links:', error);
        }
    }

    integrateWithProfileForm() {
        const profileForm = document.getElementById('profileForm');
        if (!profileForm) return;

        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const success = await this.saveSocialLinks();
            if (success) {
                alert('Profile updated successfully!');
            } else {
                alert('Error saving profile. Please try again.');
            }
        });
    }

    async saveSocialLinks() {
        if (!this.currentUser) return false;

        const socialLinks = {};
        
        Object.keys(this.SOCIAL_PLATFORMS).forEach(platform => {
            const input = document.getElementById(`social-${platform}`);
            if (input && input.value.trim()) {
                socialLinks[platform] = input.value.trim();
            }
        });

        try {
            const userRef = doc(db, 'users', this.currentUser.uid);
            await updateDoc(userRef, {
                socialLinks: socialLinks,
                updatedAt: serverTimestamp()
            });
            return true;
        } catch (error) {
            console.error('Error saving social links:', error);
            return false;
        }
    }

    setupAccountMenu() {
        const menuItems = document.querySelectorAll('.account-menu .menu-item');
        const sections = document.querySelectorAll('.account-section');
        
        menuItems.forEach(item => {
            item.addEventListener('click', () => {
                const targetSection = item.dataset.section;
                
                menuItems.forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                
                sections.forEach(section => {
                    section.style.display = section.id === targetSection + 'Section' ? 'block' : 'none';
                });

                if (targetSection === 'posts') {
                    setTimeout(() => {
                        this.loadUserPosts();
                    }, 100);
                }
            });
        });
    }

    // Setup Mingle Social Features
    setupMingleSocialFeatures() {
        this.setupNewPostsIndicator();
        this.addSocialIconsToMinglePage();
    }

    setupNewPostsIndicator() {
        setTimeout(() => {
            this.updateNewPostsCount();
        }, 3000);
    }

    addSocialIconsToMinglePage() {
        const profileInfo = document.querySelector('.profile-info');
        if (!profileInfo) return;

        const existingSocialIcons = document.getElementById('mingleSocialIcons');
        if (existingSocialIcons) {
            existingSocialIcons.remove();
        }

        const socialContainer = document.createElement('div');
        socialContainer.id = 'mingleSocialIcons';
        socialContainer.className = 'profile-social-icons';
        
        Object.values(this.SOCIAL_PLATFORMS).forEach(platform => {
            const icon = document.createElement('div');
            icon.className = 'social-profile-icon';
            icon.innerHTML = `<i class="${platform.icon}"></i>`;
            icon.title = `${platform.name} - Add your ${platform.name} link in account settings`;
            icon.style.color = platform.color;
            icon.style.cursor = 'default';
            icon.style.opacity = '0.6';
            socialContainer.appendChild(icon);
        });

        const profileBio = document.querySelector('#profileBio');
        if (profileBio) {
            profileBio.parentNode.insertBefore(socialContainer, profileBio);
        }
    }

    // Setup Profile Social Features
    setupProfileSocialFeatures() {
        const urlParams = new URLSearchParams(window.location.search);
        const profileId = urlParams.get('id');
        
        if (profileId) {
            this.loadProfileSocialLinks(profileId);
            this.loadAllProfilePosts(profileId);
            this.setupProfileButtons(profileId);
        }
    }

    async loadProfileSocialLinks(profileId) {
        try {
            const userRef = doc(db, 'users', profileId);
            const userSnap = await getDoc(userRef);
            
            if (userSnap.exists()) {
                const userData = userSnap.data();
                const socialLinks = userData.socialLinks || {};
                const userName = userData.name || 'This user';
                
                this.displayProfileSocialIcons(socialLinks, userName);
            } else {
                this.displayProfileSocialIcons({}, 'User');
            }
        } catch (error) {
            console.error('Error loading profile social links:', error);
            this.displayProfileSocialIcons({}, 'User');
        }
    }

    displayProfileSocialIcons(socialLinks, userName) {
        const socialContainer = document.getElementById('profileSocialLinks');
        if (!socialContainer) return;

        socialContainer.innerHTML = '';

        Object.entries(this.SOCIAL_PLATFORMS).forEach(([platformKey, platform]) => {
            const hasLink = socialLinks[platformKey];
            const icon = document.createElement(hasLink ? 'a' : 'div');
            
            if (hasLink) {
                const username = socialLinks[platformKey];
                const socialUrl = this.buildSocialUrl(platformKey, username);
                icon.href = socialUrl;
                icon.target = '_blank';
                icon.rel = 'noopener noreferrer';
                icon.title = `Visit ${userName}'s ${platform.name}: ${username}`;
                icon.style.cursor = 'pointer';
                icon.style.opacity = '1';
            } else {
                icon.title = `${platform.name} - ${userName} hasn't added ${platform.name} link`;
                icon.style.cursor = 'default';
                icon.style.opacity = '0.6';
            }
            
            icon.className = 'social-profile-icon';
            icon.innerHTML = `<i class="${platform.icon}"></i>`;
            icon.style.color = platform.color;
            socialContainer.appendChild(icon);
        });

        const socialSection = document.getElementById('socialLinksSection');
        if (socialSection) {
            socialSection.style.display = 'block';
        }
    }

    buildSocialUrl(platform, username) {
        const platformData = this.SOCIAL_PLATFORMS[platform];
        if (!platformData) return '#';
        
        let cleanUsername = username.trim();
        cleanUsername = cleanUsername.replace(/^@/, '');
        cleanUsername = cleanUsername.replace(/^https?:\/\/[^\/]+\//, '');
        cleanUsername = cleanUsername.split('/')[0];
        
        return platformData.baseUrl + cleanUsername;
    }

    async loadAllProfilePosts(profileId) {
        try {
            const postsQuery = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
            const postsSnap = await getDocs(postsQuery);
            
            const userPosts = [];
            postsSnap.forEach(doc => {
                const post = doc.data();
                if (post.userId === profileId) {
                    userPosts.push({ id: doc.id, ...post });
                }
            });
            
            this.displayAllProfilePosts(userPosts, profileId);
        } catch (error) {
            console.error('Error loading profile posts:', error);
            const postsContainer = document.getElementById('profilePostsContainer');
            if (postsContainer) {
                postsContainer.innerHTML = '<div class="no-posts-message">Error loading posts</div>';
            }
        }
    }

    async displayAllProfilePosts(posts, profileId) {
        const postsContainer = document.getElementById('profilePostsContainer');
        
        if (!postsContainer) return;

        if (posts.length === 0) {
            postsContainer.innerHTML = '<div class="no-posts-message">This user hasn\'t posted anything yet.</div>';
            return;
        }

        postsContainer.innerHTML = '';

        const userRef = doc(db, 'users', profileId);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.exists() ? userSnap.data() : {};

        for (const post of posts) {
            const postElement = this.createProfilePostElement(post, userData, post.id);
            postsContainer.appendChild(postElement);
        }
    }

    createProfilePostElement(post, userData, postId) {
        const postDiv = document.createElement('div');
        postDiv.className = 'profile-post-item';
        postDiv.setAttribute('data-post-id', postId);
        
        let postContentHTML = '';
        
        if (post.mediaType === 'poll' && post.poll) {
            const pollContainer = this.createPollElement(post, postId);
            postContentHTML = pollContainer.outerHTML;
        } else if (post.videoUrl || post.mediaType === 'video') {
            const videoUrl = post.videoUrl;
            if (videoUrl) {
                postContentHTML = `<div id="profile-video-container-${postId}"></div>`;
                
                setTimeout(() => {
                    const container = document.getElementById(`profile-video-container-${postId}`);
                    if (container) {
                        const thumbnail = this.createVideoThumbnail(
                            videoUrl, 
                            this.getVideoThumbnail(post), 
                            post.videoDuration, 
                            postId,
                            post
                        );
                        container.appendChild(thumbnail);
                    }
                }, 50);
            }
        } else if (post.imageUrl) {
            const imageUrl = String(post.imageUrl).trim();
            if (imageUrl && imageUrl !== 'null' && imageUrl !== 'undefined' && imageUrl.length > 10) {
                postContentHTML += `
                    <div class="post-image-container">
                        <img src="${imageUrl}" alt="Post image" class="post-image" style="width: 100%; max-height: 400px; object-fit: contain; border-radius: 16px;">
                    </div>
                `;
            }
        }
        
        if (post.caption) {
            postContentHTML += `<p class="post-caption">${post.caption}</p>`;
        }
        
        const isLiked = this.likedPosts.has(postId);
        const userVote = this.getUserVoteForPost(postId);
        const upvotes = post.upvotes || 0;
        const downvotes = post.downvotes || 0;
        
        postDiv.innerHTML = `
            <div class="post-header">
                <img src="${userData.profileImage || 'images/default-profile.jpg'}" 
                     alt="${userData.name}" class="post-author-avatar">
                <div class="post-author-info">
                    <h4>${userData.name || 'Unknown User'}</h4>
                    <span class="post-time">${this.formatTime(post.createdAt)}</span>
                </div>
            </div>
            
            <div class="post-content">
                ${postContentHTML}
            </div>
            
            <div class="post-actions">
                <div class="action-group">
                    <button class="vote-btn up ${userVote === 'up' ? 'active' : ''}" data-post-id="${postId}" data-vote="up">
                        <i class="fas fa-arrow-up"></i>
                        <span class="vote-count upvote-count">${this.formatCount(upvotes)}</span>
                    </button>
                    <button class="vote-btn down ${userVote === 'down' ? 'active' : ''}" data-post-id="${postId}" data-vote="down">
                        <i class="fas fa-arrow-down"></i>
                        <span class="vote-count downvote-count">${this.formatCount(downvotes)}</span>
                    </button>
                </div>
                
                <div class="action-group">
                    <button class="post-action like-btn ${isLiked ? 'liked' : ''}" data-post-id="${postId}">
                        <i class="${isLiked ? 'fas' : 'far'} fa-heart"></i> <span class="like-count">${this.formatCount(post.likes || 0)}</span>
                    </button>
                    <button class="post-action comment-btn" data-post-id="${postId}">
                        <i class="far fa-comment"></i> <span class="comment-count">${this.formatCount(post.commentsCount || 0)}</span>
                    </button>
                </div>
            </div>
            
            <div class="comments-section" id="comments-${postId}" style="display: none;">
                <div class="add-comment">
                    <input type="text" class="comment-input" placeholder="Write a comment..." data-post-id="${postId}">
                    <button class="send-comment-btn" data-post-id="${postId}">
                        <i class="fas fa-paper-plane"></i>
                    </button>
                </div>
                <div class="comments-list" id="comments-list-${postId}"></div>
            </div>
        `;

        const likeBtn = postDiv.querySelector('.like-btn');
        const commentBtn = postDiv.querySelector('.comment-btn');
        const sendCommentBtn = postDiv.querySelector('.send-comment-btn');
        const commentInput = postDiv.querySelector('.comment-input');
        const upvoteBtn = postDiv.querySelector('.vote-btn.up');
        const downvoteBtn = postDiv.querySelector('.vote-btn.down');

        if (likeBtn) {
            likeBtn.addEventListener('click', () => this.handleLike(postId, likeBtn));
        }

        if (commentBtn) {
            commentBtn.addEventListener('click', () => this.toggleComments(postId));
        }

        if (sendCommentBtn) {
            sendCommentBtn.addEventListener('click', () => this.handleAddComment(postId, false));
        }

        if (commentInput) {
            commentInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleAddComment(postId, false);
                }
            });
        }

        if (upvoteBtn) {
            upvoteBtn.addEventListener('click', () => this.handleVote(postId, 'up', upvoteBtn));
        }

        if (downvoteBtn) {
            downvoteBtn.addEventListener('click', () => this.handleVote(postId, 'down', downvoteBtn));
        }

        this.loadComments(postId);

        return postDiv;
    }

    setupProfileButtons(profileId) {
        const chatBtn = document.getElementById('chatProfileBtn');
        if (chatBtn) {
            chatBtn.addEventListener('click', () => {
                if (profileId && profileId !== this.currentUser.uid) {
                    window.location.href = `chat.html?id=${profileId}`;
                } else if (profileId === this.currentUser.uid) {
                    alert("You can't chat with yourself!");
                }
            });
        }
    }

    // Setup User Posts Section
    setupUserPostsSection() {
        this.createUserPostsSection();
        this.loadUserPosts();
    }

    createUserPostsSection() {
        const accountMain = document.querySelector('.account-main');
        if (!accountMain) return;

        if (document.getElementById('userPostsSection')) return;

        const postsSection = document.createElement('div');
        postsSection.className = 'account-section';
        postsSection.id = 'userPostsSection';
        postsSection.style.display = 'none';
        postsSection.innerHTML = `
            <h2><i class="fas fa-images"></i> My Posts</h2>
            <p class="section-description">Manage your posts - click on any post to delete it</p>
            
            <div class="user-posts-container" id="userPostsContainer">
                <div class="loading">Loading your posts...</div>
            </div>

            <div id="deletePostModal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Delete Post</h3>
                        <span class="close-modal">&times;</span>
                    </div>
                    <div class="modal-body">
                        <p>Are you sure you want to delete this post? This action cannot be undone.</p>
                        <div class="post-preview" id="postPreview"></div>
                    </div>
                    <div class="modal-actions">
                        <button id="cancelDelete" class="btn-secondary">Cancel</button>
                        <button id="confirmDelete" class="btn-danger">Delete Post</button>
                    </div>
                </div>
            </div>
        `;

        accountMain.appendChild(postsSection);
        this.setupDeleteModal();
    }

    setupDeleteModal() {
        const modal = document.getElementById('deletePostModal');
        const closeBtn = document.querySelector('.close-modal');
        const cancelBtn = document.getElementById('cancelDelete');
        const confirmBtn = document.getElementById('confirmDelete');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.resetDeleteModal();
                modal.style.display = 'none';
            });
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.resetDeleteModal();
                modal.style.display = 'none';
            });
        }

        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                this.confirmDeletePost();
            });
        }

        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.resetDeleteModal();
                modal.style.display = 'none';
            }
        });

        modal.style.display = 'none';
    }

    resetDeleteModal() {
        const confirmBtn = document.getElementById('confirmDelete');
        if (confirmBtn) {
            confirmBtn.innerHTML = 'Delete Post';
            confirmBtn.disabled = false;
        }
    }

    async loadUserPosts() {
        if (!this.currentUser) return;

        const container = document.getElementById('userPostsContainer');
        if (!container) return;

        try {
            const postsQuery = query(
                collection(db, 'posts'), 
                orderBy('createdAt', 'desc')
            );
            const postsSnap = await getDocs(postsQuery);
            
            const userPosts = [];
            postsSnap.forEach(doc => {
                const post = doc.data();
                if (post.userId === this.currentUser.uid) {
                    userPosts.push({ id: doc.id, ...post });
                }
            });
            
            this.displayUserPosts(userPosts);
        } catch (error) {
            console.error('Error loading user posts:', error);
            container.innerHTML = '<div class="error">Error loading your posts</div>';
        }
    }

    async displayUserPosts(posts) {
        const container = document.getElementById('userPostsContainer');
        if (!container) return;

        if (posts.length === 0) {
            container.innerHTML = `
                <div class="no-posts-message">
                    <i class="fas fa-images" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
                    <h3>No Posts Yet</h3>
                    <p>You haven't created any posts yet.</p>
                    <button onclick="window.location.href='create.html'" class="btn-primary">
                        <i class="fas fa-plus"></i> Create Your First Post
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = '';

        const userRef = doc(db, 'users', this.currentUser.uid);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.exists() ? userSnap.data() : {};

        posts.forEach(post => {
            const postElement = this.createUserPostElement(post, userData, post.id);
            container.appendChild(postElement);
        });
    }

    createUserPostElement(post, userData, postId) {
        const postDiv = document.createElement('div');
        postDiv.className = 'user-post-item';
        postDiv.setAttribute('data-post-id', postId);
        
        let postContentHTML = '';
        
        if (post.mediaType === 'poll' && post.poll) {
            const pollContainer = this.createPollElement(post, postId);
            postContentHTML = pollContainer.outerHTML;
        } else if (post.videoUrl || post.mediaType === 'video') {
            const videoUrl = post.videoUrl;
            if (videoUrl) {
                postContentHTML = `<div id="user-video-container-${postId}"></div>`;
                
                setTimeout(() => {
                    const container = document.getElementById(`user-video-container-${postId}`);
                    if (container) {
                        const thumbnail = this.createVideoThumbnail(
                            videoUrl, 
                            this.getVideoThumbnail(post), 
                            post.videoDuration, 
                            postId,
                            post
                        );
                        container.appendChild(thumbnail);
                    }
                }, 50);
            }
        } else if (post.imageUrl) {
            const imageUrl = String(post.imageUrl).trim();
            if (imageUrl && imageUrl !== 'null' && imageUrl !== 'undefined' && imageUrl.length > 10) {
                postContentHTML += `
                    <div class="post-image-container">
                        <img src="${imageUrl}" alt="Post image" class="post-image" style="width: 100%; max-height: 300px; object-fit: contain; border-radius: 16px;">
                    </div>
                `;
            }
        }
        
        if (post.caption) {
            const shortCaption = post.caption.length > 100 ? 
                post.caption.substring(0, 100) + '...' : post.caption;
            postContentHTML += `<p class="post-caption">${shortCaption}</p>`;
        }
        
        const upvotes = post.upvotes || 0;
        const downvotes = post.downvotes || 0;
        
        postDiv.innerHTML = `
            <div class="post-header">
                <img src="${userData.profileImage || 'images/default-profile.jpg'}" 
                     alt="${userData.name}" class="post-author-avatar">
                <div class="post-author-info">
                    <h4>${userData.name || 'You'}</h4>
                    <span class="post-time">${this.formatTime(post.createdAt)}</span>
                </div>
                <div class="post-stats">
                    <span class="post-stat"><i class="fas fa-arrow-up"></i> ${this.formatCount(upvotes)}</span>
                    <span class="post-stat"><i class="fas fa-arrow-down"></i> ${this.formatCount(downvotes)}</span>
                    <span class="post-stat"><i class="far fa-heart"></i> ${this.formatCount(post.likes || 0)}</span>
                    <span class="post-stat"><i class="far fa-comment"></i> ${this.formatCount(post.commentsCount || 0)}</span>
                </div>
            </div>
            
            <div class="post-content">
                ${postContentHTML}
            </div>
            
            <div class="post-actions-account">
                <button class="btn-delete-post" data-post-id="${postId}">
                    <i class="fas fa-trash"></i> Delete Post
                </button>
            </div>
        `;

        const deleteBtn = postDiv.querySelector('.btn-delete-post');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showDeleteConfirmation(postId, post);
            });
        }

        return postDiv;
    }

    showDeleteConfirmation(postId, post) {
        const modal = document.getElementById('deletePostModal');
        const preview = document.getElementById('postPreview');
        
        if (!modal || !preview) return;

        this.resetDeleteModal();

        modal.setAttribute('data-post-id', postId);

        let previewHTML = '';
        
        if (post.mediaType === 'poll' && post.poll) {
            previewHTML += `
                <div class="preview-image" style="padding: 20px; text-align: center; background: var(--bg-secondary);">
                    <i class="fas fa-chart-bar" style="font-size: 48px; color: var(--primary); margin-bottom: 10px;"></i>
                    <h4 style="margin: 10px 0;">${post.poll.question}</h4>
                    <p style="color: var(--text-light);">${post.poll.options.length} options · ${post.poll.totalVotes || 0} votes</p>
                </div>
            `;
        } else if (post.videoUrl || post.mediaType === 'video') {
            const videoUrl = post.videoUrl;
            if (videoUrl) {
                const thumbnail = this.getVideoThumbnail(post);
                previewHTML += `
                    <div class="preview-image">
                        <div style="position: relative; width: 100%; padding-bottom: 56.25%; background: #000;">
                            <img src="${thumbnail}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: contain;" alt="Video thumbnail">
                            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 50px; height: 50px; background: rgba(255,75,110,0.95); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; border: 2px solid white;">
                                <i class="fas fa-play"></i>
                            </div>
                        </div>
                        <span class="media-badge"><i class="fas fa-video"></i> Video</span>
                    </div>
                `;
            }
        } else if (post.imageUrl) {
            const imageUrl = String(post.imageUrl).trim();
            if (imageUrl && imageUrl !== 'null' && imageUrl !== 'undefined' && imageUrl.length > 10) {
                previewHTML += `
                    <div class="preview-image">
                        <img src="${imageUrl}" alt="Post image" style="max-height: 200px; width: 100%; object-fit: contain;">
                        <span class="media-badge"><i class="fas fa-image"></i> Image</span>
                    </div>
                `;
            }
        }
        
        if (post.caption) {
            previewHTML += `<div class="preview-caption">${post.caption}</div>`;
        }

        preview.innerHTML = previewHTML;
        modal.style.display = 'flex';

        const modalBody = modal.querySelector('.modal-body');
        if (modalBody) {
            const contentHeight = modalBody.scrollHeight;
            const maxHeight = window.innerHeight * 0.6;
            
            if (contentHeight > maxHeight) {
                modalBody.style.maxHeight = maxHeight + 'px';
                modalBody.style.overflowY = 'auto';
            } else {
                modalBody.style.maxHeight = 'none';
                modalBody.style.overflowY = 'visible';
            }
        }
    }

    async confirmDeletePost() {
        const modal = document.getElementById('deletePostModal');
        const postId = modal.getAttribute('data-post-id');
        
        if (!postId) return;

        try {
            const confirmBtn = document.getElementById('confirmDelete');
            const originalText = confirmBtn.innerHTML;
            
            confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
            confirmBtn.disabled = true;

            await deleteDoc(doc(db, 'posts', postId));

            this.viewedPosts.delete(postId);
            this.saveViewedPosts();

            this.likedPosts.delete(postId);
            this.saveLikedPosts();

            this.votedPosts.delete(postId);
            this.saveVotedPosts();

            modal.style.display = 'none';
            this.resetDeleteModal();
            await this.loadUserPosts();

            this.showNotification('Post deleted successfully!', 'success');

        } catch (error) {
            console.error('Error deleting post:', error);
            this.showNotification('Error deleting post. Please try again.', 'error');
            this.resetDeleteModal();
        }
    }

    loadViewedPosts() {
        if (!this.currentUser) return;
        const stored = localStorage.getItem(`viewedPosts_${this.currentUser.uid}`);
        if (stored) {
            this.viewedPosts = new Set(JSON.parse(stored));
        }
    }

    saveViewedPosts() {
        if (!this.currentUser) return;
        localStorage.setItem(`viewedPosts_${this.currentUser.uid}`, JSON.stringify([...this.viewedPosts]));
    }

    loadLikedPosts() {
        if (!this.currentUser) return;
        const stored = localStorage.getItem(`likedPosts_${this.currentUser.uid}`);
        if (stored) {
            this.likedPosts = new Set(JSON.parse(stored));
        }
    }

    saveLikedPosts() {
        if (!this.currentUser) return;
        localStorage.setItem(`likedPosts_${this.currentUser.uid}`, JSON.stringify([...this.likedPosts]));
    }

    markPostAsViewed(postId) {
        this.viewedPosts.add(postId);
        this.saveViewedPosts();
        this.updateNewPostsCount();
    }

    markAllPostsAsViewed() {
        if (!this.currentUser) return;
        
        const postsQuery = query(collection(db, 'posts'));
        getDocs(postsQuery).then(postsSnap => {
            postsSnap.forEach(doc => {
                this.viewedPosts.add(doc.id);
            });
            this.saveViewedPosts();
            this.displayNewPostsCount(0);
        }).catch(error => {
            console.error('Error marking all posts as viewed:', error);
        });
    }

    setupGlobalEventListeners() {
        document.addEventListener('click', (e) => {
            if (e.target.id === 'logoutBtn' || e.target.closest('#logoutBtn')) {
                this.handleLogout();
            }
            if (e.target.id === 'dashboardBtn' || e.target.closest('#dashboardBtn')) {
                window.location.href = 'dashboard.html';
            }
            if (e.target.id === 'mingleBtn' || e.target.closest('#mingleBtn')) {
                window.location.href = 'mingle.html';
            }
            if (e.target.id === 'postsBtn' || e.target.closest('#postsBtn')) {
                this.markAllPostsAsViewed();
                window.location.href = 'posts.html';
            }
            if (e.target.id === 'createPostBtn' || e.target.closest('#createPostBtn')) {
                window.location.href = 'create.html';
            }
            if (e.target.id === 'loadMorePosts' || e.target.closest('#loadMorePosts')) {
                this.loadMorePosts();
            }
            if (e.target.classList.contains('follow-btn-post') || e.target.closest('.follow-btn-post')) {
                const btn = e.target.classList.contains('follow-btn-post') ? e.target : e.target.closest('.follow-btn-post');
                const userId = btn.dataset.userId;
                const isFollowing = btn.dataset.following === 'true';
                
                if (userId && userId !== this.currentUser?.uid) {
                    e.stopPropagation();
                    this.handlePostFollow(userId, btn, isFollowing);
                }
            }
            if (e.target.classList.contains('pymk-follow-btn') || e.target.closest('.pymk-follow-btn')) {
                const btn = e.target.classList.contains('pymk-follow-btn') ? e.target : e.target.closest('.pymk-follow-btn');
                const userId = btn.dataset.userId;
                const isFollowing = btn.dataset.following === 'true';
                
                if (userId && userId !== this.currentUser?.uid) {
                    e.stopPropagation();
                    this.handlePYMKFollow(userId, btn, isFollowing);
                }
            }
            if (e.target.classList.contains('pymk-nav-btn') || e.target.closest('.pymk-nav-btn')) {
                const btn = e.target.classList.contains('pymk-nav-btn') ? e.target : e.target.closest('.pymk-nav-btn');
                const direction = btn.dataset.direction;
                this.scrollPYMKCarousel(direction);
            }
            if (e.target.id === 'loadMorePYMK' || e.target.closest('#loadMorePYMK')) {
                this.loadMorePYMKProfiles();
            }
            if (e.target.classList.contains('vote-btn') || e.target.closest('.vote-btn')) {
                const btn = e.target.classList.contains('vote-btn') ? e.target : e.target.closest('.vote-btn');
                const postId = btn.dataset.postId;
                const voteType = btn.dataset.vote;
                
                if (postId && voteType) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.handleVote(postId, voteType, btn);
                }
            }
        });
    }

    async handleLogout() {
        try {
            await signOut(auth);
            window.location.href = 'login.html';
        } catch (error) {
            console.error('Error logging out:', error);
        }
    }

    setupNavigation() {
        setTimeout(() => {
            this.updateNewPostsCount();
        }, 2000);
    }

    initializeSocialFeatures() {
        const currentPage = window.location.pathname.split('/').pop();
        
        switch(currentPage) {
            case 'account.html':
                this.setupAccountSocialLinks();
                this.setupUserPostsSection();
                break;
            case 'mingle.html':
                this.setupMingleSocialFeatures();
                break;
            case 'create.html':
                this.setupCreatePost();
                break;
            case 'posts.html':
                this.setupPostsPage();
                break;
            case 'profile.html':
                this.setupProfileSocialFeatures();
                break;
            case 'comments.html':
                this.setupCommentsPage();
                break;
        }
    }
}

// Initialize social manager
const socialManager = new SocialManager();
window.socialManager = socialManager;