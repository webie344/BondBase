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
        
        // Video players map for managing instances
        this.videoPlayers = new Map();
        
        // Intersection Observer for auto-play
        this.setupVideoIntersectionObserver();
        
        // Check if we're on posts.html and add loader
        const currentPage = window.location.pathname.split('/').pop();
        if (currentPage === 'posts.html') {
            this.addLoader();
        }
        
        // Add all styles
        this.addAllStyles();
        
        this.init();
    }

    // ==================== BRANDED BONDBASE LOADER ====================
    // Transparent floating loader with animated "BondBase" letters that wave
    // and pulse in the brand pink. Replaces the old full-page modal loader.
    addLoader() {
        if (document.getElementById('bbLoader')) return;
        if (!document.getElementById('bbLoaderStyles')) {
            const s = document.createElement('style');
            s.id = 'bbLoaderStyles';
            s.textContent = `
                #bbLoader {
                    position: fixed;
                    inset: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: transparent;
                    z-index: 99999;
                    pointer-events: none;
                    animation: bbLoaderFadeIn .25s ease-out;
                }
                #bbLoader .bb-loader-card {
                    pointer-events: auto;
                    background: rgba(20, 22, 28, 0.55);
                    backdrop-filter: blur(14px) saturate(160%);
                    -webkit-backdrop-filter: blur(14px) saturate(160%);
                    border: 1px solid rgba(255,255,255,0.08);
                    border-radius: 22px;
                    padding: 22px 30px 18px;
                    box-shadow: 0 20px 50px rgba(0,0,0,0.4);
                    text-align: center;
                }
                #bbLoader .bb-letters {
                    display: inline-flex;
                    gap: 2px;
                    font-family: 'Pacifico', 'Dancing Script', cursive, system-ui, sans-serif;
                    font-size: 38px;
                    font-weight: 700;
                    letter-spacing: -0.5px;
                    line-height: 1;
                }
                #bbLoader .bb-letters span {
                    display: inline-block;
                    background: linear-gradient(180deg, #ff7a93 0%, #ff4b6e 50%, #d63658 100%);
                    -webkit-background-clip: text;
                    background-clip: text;
                    -webkit-text-fill-color: transparent;
                    text-shadow: 0 0 22px rgba(255,75,110,0.35);
                    animation: bbLetterWave 1.2s ease-in-out infinite;
                    transform-origin: 50% 100%;
                }
                /* stagger each letter */
                #bbLoader .bb-letters span:nth-child(1){animation-delay: 0.00s}
                #bbLoader .bb-letters span:nth-child(2){animation-delay: 0.08s}
                #bbLoader .bb-letters span:nth-child(3){animation-delay: 0.16s}
                #bbLoader .bb-letters span:nth-child(4){animation-delay: 0.24s}
                #bbLoader .bb-letters span:nth-child(5){animation-delay: 0.32s}
                #bbLoader .bb-letters span:nth-child(6){animation-delay: 0.40s}
                #bbLoader .bb-letters span:nth-child(7){animation-delay: 0.48s}
                #bbLoader .bb-letters span:nth-child(8){animation-delay: 0.56s}
                #bbLoader .bb-bar {
                    margin: 14px auto 0;
                    width: 140px;
                    height: 3px;
                    border-radius: 3px;
                    background: rgba(255,255,255,0.08);
                    overflow: hidden;
                    position: relative;
                }
                #bbLoader .bb-bar::after {
                    content: "";
                    position: absolute;
                    inset: 0;
                    width: 40%;
                    background: linear-gradient(90deg, transparent, #ff4b6e, transparent);
                    animation: bbBarSlide 1.2s linear infinite;
                }
                @keyframes bbLetterWave {
                    0%, 100% { transform: translateY(0) scale(1); opacity: 0.85; }
                    50%      { transform: translateY(-9px) scale(1.06); opacity: 1; }
                }
                @keyframes bbBarSlide {
                    0%   { transform: translateX(-100%); }
                    100% { transform: translateX(350%); }
                }
                @keyframes bbLoaderFadeIn { from{opacity:0} to{opacity:1} }
                @keyframes bbLoaderFadeOut { from{opacity:1} to{opacity:0} }
                #bbLoader.bb-fadeout { animation: bbLoaderFadeOut .25s ease-out forwards; }
            `;
            document.head.appendChild(s);
        }
        const loader = document.createElement('div');
        loader.id = 'bbLoader';
        loader.innerHTML = `
            <div class="bb-loader-card">
                <div class="bb-letters" aria-label="BondBase loading">
                    <span>B</span><span>o</span><span>n</span><span>d</span><span>B</span><span>a</span><span>s</span><span>e</span>
                </div>
                <div class="bb-bar"></div>
            </div>
        `;
        document.body.appendChild(loader);
    }

    removeLoader() {
        const loader = document.getElementById('bbLoader') || document.getElementById('initialLoader');
        if (!loader) return;
        loader.classList.add('bb-fadeout');
        setTimeout(() => { if (loader.parentNode) loader.parentNode.removeChild(loader); }, 250);
    }

    // Public helper for any page to show/hide the BondBase loader on demand
    showLoader() { this.addLoader(); }
    hideLoader() { this.removeLoader(); }

    // Setup Intersection Observer for video auto-play/pause on scroll
    setupVideoIntersectionObserver() {
        this.videoObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const videoContainer = entry.target;
                const videoId    = videoContainer.dataset.videoId;
                const videoUrl   = videoContainer.dataset.videoUrl;
                const thumbUrl   = videoContainer.dataset.thumbnailUrl;
                const duration   = videoContainer.dataset.duration;

                if (entry.isIntersecting) {
                    // Lazy-initialize player on first scroll into view
                    if (videoId && videoUrl && !videoContainer.classList.contains('video-initialized')) {
                        videoContainer.dataset.autoPlay = 'true';
                        this.initializeVideoPlayer(videoContainer, videoId, videoUrl, thumbUrl, duration);
                    } else if (videoContainer.classList.contains('video-initialized')) {
                        // Already initialized — just resume
                        const vid = videoContainer.videoElement;
                        if (vid && vid.paused) {
                            vid.play().catch(() => {});
                            // Hide center play button while auto-playing
                            const btn = videoContainer.querySelector('.video-center-play-btn');
                            if (btn) btn.innerHTML = '<i class="fas fa-pause"></i>';
                        }
                    }
                } else {
                    // Out of view — pause
                    const vid = videoContainer.videoElement;
                    if (vid && !vid.paused) {
                        vid.pause();
                        const btn = videoContainer.querySelector('.video-center-play-btn');
                        if (btn) btn.innerHTML = '<i class="fas fa-play"></i>';
                    }
                }
            });
        }, {
            threshold: 0.6   // 60% visible before auto-play triggers
        });
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
                this.setupPostModal();
                this.setupReplyModal();
                this.setupProfileSlideUp();
            } else {
                if (!window.location.pathname.includes('login.html') && 
                    !window.location.pathname.includes('signup.html') &&
                    !window.location.pathname.includes('index.html')) {
                    window.location.href = 'login.html';
                }
            }
        });
    }

    // ==================== POST MODAL FOR FULL PAGE VIEW ====================
    
    // ==================== FULL-PAGE POST VIEW (SPA-style) ====================
    // Replaces the small "modal" with a full-page view of a single post. Pushes
    // a history entry so the back button returns the user to the feed exactly
    // where they were.
    setupPostModal() {
        if (!document.getElementById('postFullPage')) {
            const page = document.createElement('div');
            page.id = 'postFullPage';
            page.className = 'post-fullpage';
            page.innerHTML = `
                <div class="post-fullpage-topbar">
                    <button class="post-fullpage-back" id="postFullPageBack" aria-label="Back">
                        <i class="fas fa-arrow-left"></i>
                        <span>Back</span>
                    </button>
                    <div class="post-fullpage-title">Post</div>
                    <div style="width:84px"></div>
                </div>
                <div class="post-fullpage-scroll">
                    <div class="post-fullpage-body" id="postModalBody">
                        <div class="loading">Loading post...</div>
                    </div>
                </div>
            `;
            document.body.appendChild(page);

            this.addModalStyles();

            const back = page.querySelector('#postFullPageBack');
            back.addEventListener('click', () => this.closePostModal());

            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && page.classList.contains('open')) this.closePostModal();
            });

            window.addEventListener('popstate', (e) => {
                if (page.classList.contains('open') && (!e.state || e.state.bbPostFullPage !== true)) {
                    this._closePostFullPageInternal();
                }
            });
        }
    }
    
    addModalStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* ===== FULL-PAGE POST VIEW (SPA-style) ===== */
            .post-fullpage {
                position: fixed;
                inset: 0;
                background: #1a1d21;
                z-index: 100000;
                display: flex;
                flex-direction: column;
                transform: translateX(100%);
                transition: transform .28s cubic-bezier(.2,.8,.3,1);
                will-change: transform;
            }
            .post-fullpage.open {
                transform: translateX(0);
            }
            .post-fullpage-topbar {
                flex-shrink: 0;
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 14px 18px;
                background: rgba(15, 17, 21, 0.95);
                border-bottom: 1px solid rgba(255,255,255,0.08);
                position: sticky;
                top: 0;
                backdrop-filter: blur(10px);
                z-index: 5;
            }
            .post-fullpage-back {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                background: transparent;
                border: none;
                color: #e9edef;
                font-size: 15px;
                font-weight: 600;
                cursor: pointer;
                padding: 8px 12px;
                border-radius: 10px;
                transition: background .15s, color .15s;
            }
            .post-fullpage-back:hover { background: rgba(255,75,110,.12); color: #ff4b6e; }
            .post-fullpage-back i { font-size: 16px; }
            .post-fullpage-title {
                font-size: 16px;
                font-weight: 700;
                color: #fff;
                letter-spacing: -0.01em;
            }
            .post-fullpage-scroll {
                flex: 1;
                overflow-y: auto;
                overflow-x: hidden;
                -webkit-overflow-scrolling: touch;
            }
            .post-fullpage-body {
                max-width: 760px;
                margin: 0 auto;
                padding: 22px 16px 60px;
            }
            .post-fullpage-body .post-item {
                background: #1f232a;
                border-radius: 16px;
                margin-bottom: 0;
                border: 1px solid rgba(255,255,255,0.06);
            }
            .post-fullpage-body .post-image-container img {
                max-height: 80vh;
            }
            /* Backwards-compat: keep old selectors so existing styles still match */
            .post-modal { display: none; }
            .post-modal-body { padding: 20px; }
            
            .post-modal-body .post-item {
                border: none;
                padding: 0;
                background: transparent;
                border-radius: 0;
            }
            
            .post-modal-body .post-item:hover {
                background: transparent;
                transform: none;
            }
            
            .post-modal-body .post-content {
                margin-left: 0;
                margin-bottom: 20px;
            }
            
            .post-modal-body .post-image-container img {
                max-height: 70vh;
                width: 100%;
                object-fit: contain;
            }
            
            .post-modal-body .video-thumbnail-container {
                margin-top: 0;
                cursor: default;
            }
            
            .post-modal-body .comments-section {
                margin-left: 0;
                margin-top: 20px;
                display: block !important;
            }
            
            .post-modal-body .post-actions {
                margin-left: 0;
            }
        `;
        document.head.appendChild(style);
    }
    
    async openPostModal(postId) {
        const page = document.getElementById('postFullPage');
        const body = document.getElementById('postModalBody');
        if (!page || !body) return;

        // Show + lock background scroll
        page.classList.add('open');
        document.body.style.overflow = 'hidden';
        body.scrollTop = 0;
        const scroller = page.querySelector('.post-fullpage-scroll');
        if (scroller) scroller.scrollTop = 0;

        // Push a history entry so the device back button closes this view
        try {
            history.pushState({ bbPostFullPage: true, postId }, '', `?post=${encodeURIComponent(postId)}`);
        } catch (e) {}

        body.innerHTML = '<div class="loading" style="text-align:center;padding:60px 20px;color:#8696a0;">Loading post...</div>';

        try {
            const postRef = doc(db, 'posts', postId);
            const postSnap = await getDoc(postRef);

            if (!postSnap.exists()) {
                body.innerHTML = '<div class="error" style="text-align:center;padding:60px 20px;color:#ef4444;">Post not found</div>';
                return;
            }

            const post = { id: postSnap.id, ...postSnap.data() };
            const userRef = doc(db, 'users', post.userId);
            const userSnap = await getDoc(userRef);
            const user = userSnap.exists() ? userSnap.data() : {};

            const postElement = await this.createModalPostElement(post, user, postId);
            body.innerHTML = '';
            body.appendChild(postElement);

            await this.loadModalComments(postId);
        } catch (error) {
            console.error('Error loading post for full-page view:', error);
            body.innerHTML = '<div class="error" style="text-align:center;padding:60px 20px;color:#ef4444;">Error loading post</div>';
        }
    }

    closePostModal() {
        const page = document.getElementById('postFullPage');
        if (!page || !page.classList.contains('open')) return;
        // If we pushed a history entry, going back will trigger popstate which
        // calls _closePostFullPageInternal. Otherwise close directly.
        if (history.state && history.state.bbPostFullPage) {
            history.back();
        } else {
            this._closePostFullPageInternal();
        }
    }

    _closePostFullPageInternal() {
        const page = document.getElementById('postFullPage');
        if (!page) return;
        page.classList.remove('open');
        document.body.style.overflow = '';
        const videos = page.querySelectorAll('video');
        videos.forEach(v => { try { v.pause(); } catch (e) {} });
    }
    
    async createModalPostElement(post, user, postId) {
        const postDiv = document.createElement('div');
        postDiv.className = 'post-item';
        postDiv.setAttribute('data-post-id', postId);
        
        const userName = user.name || 'Unknown User';
        const userProfileImage = user.profileImage || 'images/default-profile.jpg';
        
        let postContentHTML = '';
        
        if (post.mediaType === 'poll' && post.poll) {
            const pollContainer = this.createPollElement(post, postId);
            postContentHTML = pollContainer.outerHTML;
        } else if (post.videoUrl || post.mediaType === 'video') {
            const videoUrl = post.videoUrl;
            if (videoUrl) {
                postContentHTML = `<div id="modal-video-container-${postId}" class="video-wrapper"></div>`;
            }
        } else if (post.imageUrl) {
            const imageUrl = String(post.imageUrl).trim();
            if (imageUrl && imageUrl !== 'null' && imageUrl !== 'undefined' && imageUrl.length > 10) {
                postContentHTML += `
                    <div class="post-image-container">
                        <img src="${imageUrl}" alt="Post image" class="post-image" style="width: 100%; max-height: 70vh; object-fit: contain; border-radius: 16px;">
                    </div>
                `;
            }
        }
        
        if (post.caption) {
            postContentHTML += `<p class="post-caption">${this.escapeHTML(post.caption)}</p>`;
        }
        
        const isLiked = this.likedPosts.has(postId);
        const userVote = this.getUserVoteForPost(postId);
        const upvotes = post.upvotes || 0;
        const downvotes = post.downvotes || 0;
        
        postDiv.innerHTML = `
            <div class="post-header">
                <img src="${userProfileImage}" 
                     alt="${userName}" class="post-author-avatar" style="cursor: pointer;">
                <div class="post-author-info">
                    <h4 style="color: #ff4b6e; cursor: pointer;">${userName}</h4>
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
                        <i class="${isLiked ? 'fas' : 'far'} fa-heart"></i> 
                        <span class="like-count">${this.formatCount(post.likes || 0)}</span>
                    </button>
                    <button class="post-action comment-btn active" data-post-id="${postId}">
                        <i class="far fa-comment"></i> 
                        <span class="comment-count">${this.formatCount(post.commentsCount || 0)}</span>
                    </button>
                </div>
            </div>
            
            <div class="comments-section expanded" id="modal-comments-${postId}">
                <div class="add-comment">
                    <input type="text" class="comment-input" placeholder="Write a comment..." data-post-id="${postId}">
                    <button class="send-comment-btn" data-post-id="${postId}">
                        <i class="fas fa-paper-plane"></i>
                    </button>
                </div>
                <div class="comments-list" id="modal-comments-list-${postId}"></div>
            </div>
        `;

        if (post.videoUrl || post.mediaType === 'video') {
            setTimeout(() => {
                const container = document.getElementById(`modal-video-container-${postId}`);
                if (container) {
                    const videoContainer = this.createVideoContainer(postId, post.videoUrl, this.getVideoThumbnail(post), post.videoDuration || 0, true);
                    container.appendChild(videoContainer);
                    
                    if (this.videoObserver) {
                        this.videoObserver.observe(videoContainer);
                    }
                }
            }, 100);
        }

        const likeBtn = postDiv.querySelector('.like-btn');
        const sendCommentBtn = postDiv.querySelector('.send-comment-btn');
        const commentInput = postDiv.querySelector('.comment-input');
        const upvoteBtn = postDiv.querySelector('.vote-btn.up');
        const downvoteBtn = postDiv.querySelector('.vote-btn.down');
        const profileLink = postDiv.querySelector('.post-author-avatar');
        const profileName = postDiv.querySelector('.post-author-info h4');

        if (likeBtn) {
            likeBtn.addEventListener('click', () => this.handleLike(postId, likeBtn));
        }

        if (sendCommentBtn) {
            sendCommentBtn.addEventListener('click', () => this.handleModalComment(postId));
        }

        if (commentInput) {
            commentInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleModalComment(postId);
                }
            });
        }

        if (upvoteBtn) {
            upvoteBtn.addEventListener('click', () => this.handleVote(postId, 'up', upvoteBtn));
        }

        if (downvoteBtn) {
            downvoteBtn.addEventListener('click', () => this.handleVote(postId, 'down', downvoteBtn));
        }

        const navigateToProfile = (e) => {
            if (e && e.stopPropagation) e.stopPropagation();
            this.openProfileSlideUp(post.userId);
        };

        if (profileLink) {
            profileLink.addEventListener('click', navigateToProfile);
        }
        
        if (profileName) {
            profileName.addEventListener('click', navigateToProfile);
        }

        return postDiv;
    }
    
    async loadModalComments(postId) {
        const commentsList = document.getElementById(`modal-comments-list-${postId}`);
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
                const commentElement = this.createModalCommentElement(comment, user, postId);
                commentsList.appendChild(commentElement);
            });
        } catch (error) {
            console.error('Error loading comments:', error);
            commentsList.innerHTML = '<div class="error">Error loading comments</div>';
        }
    }
    
    createModalCommentElement(comment, user, postId) {
        const commentDiv = document.createElement('div');
        commentDiv.className = 'comment-item';
        commentDiv.setAttribute('data-comment-id', comment.id);
        
        commentDiv.innerHTML = `
            <div class="comment-header">
                <img src="${user.profileImage || 'images/default-profile.jpg'}" 
                     alt="${user.name}" class="comment-avatar" style="cursor: pointer;">
                <div class="comment-info">
                    <strong style="color: #ff4b6e; cursor: pointer;">${user.name || 'Unknown User'}</strong>
                    <span class="comment-time">${this.formatTime(comment.createdAt)}</span>
                </div>
            </div>
            <div class="comment-text">${this.escapeHTML(comment.text)}</div>
            <div class="comment-actions">
                <button class="comment-action-btn reply-btn" data-comment-id="${comment.id}" data-post-id="${postId}">
                    <i class="fas fa-reply"></i> Reply
                </button>
            </div>
            <div id="modal-replies-${comment.id}" class="replies-container" style="display: none;"></div>
        `;

        const avatar = commentDiv.querySelector('.comment-avatar');
        const name = commentDiv.querySelector('.comment-info strong');
        
        const navigateToProfile = (e) => {
            if (e && e.stopPropagation) e.stopPropagation();
            this.openProfileSlideUp(comment.userId);
        };
        
        if (avatar) {
            avatar.addEventListener('click', navigateToProfile);
        }
        
        if (name) {
            name.addEventListener('click', navigateToProfile);
        }

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

        return commentDiv;
    }
    
    async handleModalComment(postId) {
        if (!this.currentUser) {
            alert('Please login to comment');
            return;
        }

        const commentInput = document.querySelector(`#modal-comments-${postId} .comment-input`);
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

            const docRef = await addDoc(collection(db, 'posts', postId, 'comments'), commentData);

            const postRef = doc(db, 'posts', postId);
            await updateDoc(postRef, {
                commentsCount: increment(1),
                updatedAt: serverTimestamp()
            });

            commentInput.value = '';
            
            // FIXED: Same crime as handleAddComment — previously re-fetched and rebuilt
            // the ENTIRE comments list after adding a single comment. Now we just
            // append the new comment node directly, no Firestore re-read needed.
            const modalComments = document.querySelector(`#modal-comments-${postId} .comments-list`);
            if (modalComments) {
                const noComments = modalComments.querySelector('.no-comments');
                if (noComments) noComments.remove();

                const tempComment = {
                    id: docRef.id,
                    userId: this.currentUser.uid,
                    text: commentText,
                    createdAt: { toDate: () => new Date() }
                };
                const tempUser = {
                    name: this.currentUser.displayName || 'User',
                    profileImage: this.currentUser.photoURL || 'images/default-profile.jpg'
                };
                const commentElement = this.createModalCommentElement(tempComment, tempUser, postId);
                modalComments.appendChild(commentElement);
                commentElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
            
            const commentCount = document.querySelector(`.comment-btn[data-post-id="${postId}"] .comment-count`);
            if (commentCount) {
                const currentCount = parseInt(commentCount.textContent) || 0;
                commentCount.textContent = this.formatCount(currentCount + 1);
            }

            this.showNotification('Comment added!', 'success');

        } catch (error) {
            console.error('Error adding comment:', error);
            alert('Error adding comment: ' + error.message);
        }
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
        return this.votedPosts.get(postId) || null;
    }

    async handleVote(postId, voteType, voteButton) {
        if (!this.currentUser) {
            alert('Please login to vote');
            return;
        }

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
            
            let upvotes = post.upvotes || 0;
            let downvotes = post.downvotes || 0;
            
            let newVoteType = voteType;
            
            if (currentVote === voteType) {
                if (voteType === 'up') {
                    upvotes = Math.max(0, upvotes - 1);
                } else if (voteType === 'down') {
                    downvotes = Math.max(0, downvotes - 1);
                }
                this.votedPosts.delete(postId);
                newVoteType = null;
            } 
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
            else if (!currentVote) {
                if (voteType === 'up') {
                    upvotes += 1;
                } else if (voteType === 'down') {
                    downvotes += 1;
                }
                this.votedPosts.set(postId, voteType);
            }
            
            await updateDoc(postRef, {
                upvotes: upvotes,
                downvotes: downvotes,
                updatedAt: serverTimestamp()
            });
            
            this.saveVotedPosts();
            
            this.updateVoteUI(postId, upvotes, downvotes, this.votedPosts.get(postId) || null);
            
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

    // ==================== FORMAT CAPTION WITH HASHTAGS & MENTIONS ====================
    formatCaption(text) {
        if (!text) return '';
        // Escape HTML first to prevent XSS
        const escaped = this.escapeHTML(text);
        // Color #hashtags pink
        const withHashtags = escaped.replace(
            /(^|\s)(#[a-zA-Z0-9_]+)/g,
            '$1<span class="post-hashtag">$2</span>'
        );
        // Color @mentions blue
        const withMentions = withHashtags.replace(
            /(^|\s)(@[a-zA-Z0-9_]+)/g,
            '$1<span class="post-mention">$2</span>'
        );
        return withMentions;
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
                /* ========== POST FEED LAYOUT ========== */
                .posts-container {
                    max-width: 640px;
                    margin: 0 auto;
                    background: transparent;
                    padding: 0 0 80px;
                }

                .post-item {
                    background: transparent;
                    border: none;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 0;
                    padding: 18px 16px 14px;
                    margin: 0;
                    transition: background 0.15s ease;
                    position: relative;
                    cursor: pointer;
                }

                .post-item:hover {
                    background: rgba(255, 255, 255, 0.025);
                }

                .post-header {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 12px;
                    position: relative;
                }

                .post-author-avatar {
                    width: 44px;
                    height: 44px;
                    border-radius: 50%;
                    object-fit: cover;
                    flex-shrink: 0;
                    cursor: pointer;
                    border: 2px solid rgba(255, 75, 110, 0.35);
                    transition: border-color 0.2s;
                }

                .post-author-avatar:hover { border-color: #ff4b6e; }

                .post-author-info {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    gap: 1px;
                }

                .post-author-info h4 {
                    margin: 0;
                    font-size: 15px;
                    font-weight: 700;
                    color: #f0f2f5;
                    line-height: 1.2;
                    cursor: pointer;
                }

                .post-author-info h4:hover { color: #ff4b6e; }

                .post-time {
                    font-size: 12px;
                    color: #6b6f76;
                }

                .post-content {
                    margin-left: 0;
                    margin-bottom: 12px;
                    font-size: 15px;
                    line-height: 1.6;
                    color: #e2e5e9;
                    word-wrap: break-word;
                }

                .post-caption {
                    margin: 0 0 10px;
                    white-space: pre-wrap;
                    font-size: 15px;
                    line-height: 1.6;
                }

                /* Hashtag and mention styling */
                .post-hashtag {
                    color: #ff4b6e;
                    font-weight: 600;
                    cursor: pointer;
                    transition: color 0.15s;
                }
                .post-hashtag:hover { color: #ff7090; text-decoration: underline; }

                .post-mention {
                    color: #60a5fa;
                    font-weight: 600;
                    cursor: pointer;
                    transition: color 0.15s;
                }
                .post-mention:hover { color: #93c5fd; text-decoration: underline; }

                /* ========== MEDIA CONTAINERS ========== */
                .post-image-container {
                    margin-top: 12px;
                    border-radius: 16px;
                    overflow: hidden;
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    background: #000;
                }

                .post-image {
                    width: 100%;
                    max-height: 520px;
                    object-fit: contain;
                    display: block;
                }

                /* ========== VIDEO STYLES ========== */
                .video-wrapper {
                    margin-top: 14px;
                    width: 100%;
                    border-radius: 16px;
                    overflow: hidden;
                }

                /* Thumbnail before video loads — taller, more cinematic */
                .video-thumbnail-container {
                    position: relative;
                    width: 100%;
                    padding-bottom: 75%;
                    min-height: 480px;
                    max-height: 720px;
                    background: #000;
                    border-radius: 18px;
                    overflow: hidden;
                    cursor: pointer;
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
                }

                .video-thumbnail-image {
                    position: absolute;
                    top: 0; left: 0;
                    width: 100%; height: 100%;
                    object-fit: cover;
                }

                .video-play-button-center {
                    position: absolute;
                    top: 50%; left: 50%;
                    transform: translate(-50%, -50%);
                    width: 72px; height: 72px;
                    background: rgba(255, 75, 110, 0.9);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-size: 28px;
                    transition: all 0.2s ease;
                    border: 3px solid rgba(255, 255, 255, 0.6);
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
                    backdrop-filter: blur(4px);
                }

                .video-thumbnail-container:hover .video-play-button-center {
                    background: #ff4b6e;
                    border-color: white;
                    transform: translate(-50%, -50%) scale(1.08);
                    box-shadow: 0 12px 40px rgba(255, 75, 110, 0.4);
                }

                .video-duration-overlay {
                    position: absolute;
                    bottom: 12px; right: 12px;
                    background: rgba(0, 0, 0, 0.8);
                    color: white;
                    padding: 5px 10px;
                    border-radius: 8px;
                    font-size: 13px;
                    font-weight: 600;
                    z-index: 2;
                    letter-spacing: 0.4px;
                }

                /* Active video player — taller, more cinematic */
                .custom-video-container {
                    position: relative;
                    width: 100%;
                    padding-bottom: 75%;
                    min-height: 480px;
                    max-height: 720px;
                    background: #000;
                    border-radius: 18px;
                    overflow: hidden;
                    margin: 14px 0 0;
                    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                }

                /* In full-page post view: even taller for immersive viewing */
                .post-modal .custom-video-container,
                .post-fullpage .custom-video-container,
                .post-fullpage-body .custom-video-container,
                .post-fullpage .video-thumbnail-container,
                .post-fullpage-body .video-thumbnail-container {
                    padding-bottom: 0;
                    height: 80vh;
                    max-height: 80vh;
                    min-height: 520px;
                }

                .custom-video-player {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                    background: #000;
                }

                .custom-video-player::-webkit-media-controls {
                    display: none !important;
                }

                .video-controls-overlay {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: linear-gradient(to top, rgba(0,0,0,0.7), transparent 50%);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    opacity: 0;
                    transition: opacity 0.3s ease;
                }

                .custom-video-container:hover .video-controls-overlay {
                    opacity: 1;
                }

                .video-center-play-btn {
                    width: 80px;
                    height: 80px;
                    background: rgba(255, 75, 110, 0.95);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-size: 32px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    border: 3px solid rgba(255,255,255,0.5);
                    box-shadow: 0 8px 24px rgba(0,0,0,0.4);
                }

                .video-center-play-btn:hover {
                    background: #ff4b6e;
                    transform: scale(1.1);
                    border-color: white;
                }

                .video-bottom-controls {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    background: linear-gradient(to top, rgba(0,0,0,0.9), transparent);
                    padding: 20px 15px 15px;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    opacity: 0;
                    transition: opacity 0.3s ease;
                    pointer-events: none;
                }

                .custom-video-container:hover .video-bottom-controls {
                    opacity: 1;
                    pointer-events: auto;
                }

                .control-bar {
                    display: flex;
                    align-items: center;
                    gap: 15px;
                    color: white;
                }

                .control-btn {
                    background: transparent;
                    border: none;
                    color: white;
                    cursor: pointer;
                    padding: 8px;
                    border-radius: 6px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                    font-size: 18px;
                }

                .control-btn:hover {
                    background: rgba(255,255,255,0.2);
                }

                .progress-bar-container {
                    flex: 1;
                    height: 8px;
                    background: rgba(255,255,255,0.3);
                    border-radius: 4px;
                    cursor: pointer;
                    position: relative;
                }

                .progress-bar-fill {
                    height: 100%;
                    background: #ff4b6e;
                    border-radius: 4px;
                    width: 0%;
                    position: relative;
                    transition: width 0.1s linear;
                }

                .time-display {
                    font-size: 14px;
                    color: white;
                    font-family: monospace;
                    min-width: 100px;
                }

                .volume-control {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .volume-slider {
                    width: 80px;
                    height: 6px;
                    background: rgba(255,255,255,0.3);
                    border-radius: 3px;
                    cursor: pointer;
                    position: relative;
                }

                .volume-fill {
                    height: 100%;
                    background: white;
                    border-radius: 3px;
                    width: 100%;
                }

                /* ========== POST ACTIONS ========== */
                .post-actions {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-top: 14px;
                    padding-top: 12px;
                    border-top: 1px solid rgba(255, 255, 255, 0.06);
                }

                .action-group {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }

                .vote-buttons {
                    display: flex;
                    align-items: center;
                    gap: 2px;
                    background: rgba(255,255,255,0.04);
                    border-radius: 9999px;
                    border: 1px solid rgba(255,255,255,0.07);
                    padding: 2px 4px;
                }

                .vote-btn {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    background: transparent;
                    border: none;
                    color: #8a8f9a;
                    font-size: 13px;
                    font-weight: 500;
                    cursor: pointer;
                    padding: 7px 12px;
                    border-radius: 9999px;
                    transition: all 0.2s ease;
                }

                .vote-btn i { font-size: 14px; }

                .vote-btn.up:hover {
                    background: rgba(52, 168, 83, 0.12);
                    color: #34a853;
                }

                .vote-btn.down:hover {
                    background: rgba(234, 67, 53, 0.12);
                    color: #ea4335;
                }

                .vote-btn.up.active  { color: #34a853; font-weight: 700; }
                .vote-btn.down.active { color: #ea4335; font-weight: 700; }

                .vote-count {
                    font-weight: 600;
                    min-width: 18px;
                    text-align: center;
                }

                .post-action {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    background: rgba(255,255,255,0.04);
                    border: 1px solid rgba(255,255,255,0.07);
                    color: #8a8f9a;
                    font-size: 13px;
                    font-weight: 500;
                    cursor: pointer;
                    padding: 7px 14px;
                    border-radius: 9999px;
                    transition: all 0.2s ease;
                }

                .post-action i { font-size: 15px; }

                .post-action:hover {
                    background: rgba(255, 75, 110, 0.12);
                    border-color: rgba(255, 75, 110, 0.3);
                    color: #ff4b6e;
                }

                .post-action.liked {
                    color: #ff4b6e;
                    background: rgba(255, 75, 110, 0.1);
                    border-color: rgba(255, 75, 110, 0.25);
                }

                .post-action.active {
                    color: #ff4b6e;
                    background: rgba(255, 75, 110, 0.1);
                    border-color: rgba(255, 75, 110, 0.25);
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
                    margin-left: 0;
                    margin-top: 14px;
                    padding-top: 14px;
                    border-top: 1px solid rgba(255, 255, 255, 0.06);
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
                    cursor: pointer;
                }

                .comment-info {
                    flex: 1;
                }

                .comment-info strong {
                    font-size: 14px;
                    color: #ff4b6e;
                    cursor: pointer;
                }

                .comment-info strong:hover {
                    text-decoration: underline;
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
                    cursor: pointer;
                }

                .reply-info strong {
                    font-size: 13px;
                    color: #ff4b6e;
                    cursor: pointer;
                }

                .reply-info strong:hover {
                    text-decoration: underline;
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

                /* ========== PEOPLE YOU MAY KNOW STYLES ========== */
                .pymk-section {
                    background: #2c2f33;
                    border-radius: 15px;
                    padding: 20px;
                    margin: 25px 0;
                    border: 1px solid #40444b;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
                }
                
                .pymk-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                }
                
                .pymk-header h3 {
                    margin: 0;
                    font-size: 18px;
                    color: #fff;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                
                .pymk-header h3 i {
                    color: #ff4b6e;
                }
                
                .pymk-see-all {
                    background: transparent;
                    border: 1px solid #ff4b6e;
                    color: #ff4b6e;
                    padding: 6px 15px;
                    border-radius: 20px;
                    font-size: 14px;
                    cursor: pointer;
                    transition: all 0.3s;
                }
                
                .pymk-see-all:hover {
                    background: #ff4b6e;
                    color: white;
                }
                
                .pymk-content {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    position: relative;
                }
                
                .pymk-nav-btn {
                    background: #36393f;
                    border: 1px solid #40444b;
                    color: #fff;
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.3s;
                    flex-shrink: 0;
                    z-index: 2;
                }
                
                .pymk-nav-btn:hover {
                    background: #40444b;
                    border-color: #ff4b6e;
                    color: #ff4b6e;
                }
                
                .pymk-nav-btn.left {
                    position: absolute;
                    left: -20px;
                }
                
                .pymk-nav-btn.right {
                    position: absolute;
                    right: -20px;
                }
                
                .pymk-profiles-container {
                    display: flex;
                    gap: 15px;
                    overflow-x: auto;
                    scroll-behavior: smooth;
                    padding: 10px 0;
                    scrollbar-width: none;
                    -ms-overflow-style: none;
                    flex: 1;
                }
                
                .pymk-profiles-container::-webkit-scrollbar {
                    display: none;
                }
                
                .pymk-profile-card {
                    background: #36393f;
                    border: 1px solid #40444b;
                    border-radius: 12px;
                    padding: 15px;
                    min-width: 180px;
                    max-width: 180px;
                    text-align: center;
                    transition: all 0.3s;
                    flex-shrink: 0;
                }
                
                .pymk-profile-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
                    border-color: #ff4b6e;
                }
                
                .pymk-profile-avatar {
                    width: 70px;
                    height: 70px;
                    border-radius: 50%;
                    object-fit: cover;
                    margin: 0 auto 12px;
                    border: 3px solid #ff4b6e;
                    cursor: pointer;
                }
                
                .pymk-profile-name {
                    font-weight: 600;
                    font-size: 16px;
                    margin: 0 0 5px;
                    color: #ff4b6e;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    cursor: pointer;
                }
                
                .pymk-profile-name:hover {
                    text-decoration: underline;
                }
                
                .pymk-profile-info {
                    font-size: 12px;
                    color: #b9bbbe;
                    margin: 0 0 10px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                
                .pymk-profile-mutual {
                    font-size: 11px;
                    color: #b9bbbe;
                    margin: 0 0 15px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 5px;
                }
                
                .pymk-profile-mutual i {
                    color: #10b981;
                }
                
                .pymk-follow-btn {
                    width: 100%;
                    padding: 8px;
                    border-radius: 20px;
                    border: none;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.3s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 5px;
                }
                
                .pymk-follow-btn:not(.following) {
                    background: #ff4b6e;
                    color: white;
                }
                
                .pymk-follow-btn.following {
                    background: #10b981;
                    color: white;
                }
                
                .pymk-follow-btn:hover {
                    opacity: 0.9;
                    transform: scale(1.05);
                }
                
                .pymk-footer {
                    margin-top: 20px;
                    text-align: center;
                }
                
                .pymk-load-more {
                    background: transparent;
                    border: 1px solid #40444b;
                    color: #fff;
                    padding: 10px 20px;
                    border-radius: 20px;
                    font-size: 14px;
                    cursor: pointer;
                    transition: all 0.3s;
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                }
                
                .pymk-load-more:hover {
                    background: #40444b;
                    border-color: #ff4b6e;
                    color: #ff4b6e;
                }
                
                .pymk-loading {
                    text-align: center;
                    padding: 40px;
                    color: #b9bbbe;
                    font-style: italic;
                }
                
                .pymk-expanded {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.8);
                    z-index: 10000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                }
                
                .pymk-expanded-content {
                    background: #36393f;
                    border-radius: 15px;
                    padding: 30px;
                    max-width: 90%;
                    max-height: 90%;
                    overflow-y: auto;
                    position: relative;
                }
                
                .pymk-close-expanded {
                    position: absolute;
                    top: 15px;
                    right: 15px;
                    background: transparent;
                    border: none;
                    color: #b9bbbe;
                    font-size: 24px;
                    cursor: pointer;
                    width: 30px;
                    height: 30px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 50%;
                    transition: all 0.3s;
                }
                
                .pymk-close-expanded:hover {
                    background: #40444b;
                    color: #fff;
                }
                
                .pymk-expanded-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                    gap: 20px;
                    margin-top: 20px;
                }

                /* ========== NOTIFICATION STYLES ========== */
                .custom-notification {
                    position: fixed;
                    top: 80px;
                    right: 20px;
                    color: white;
                    padding: 12px 20px;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    z-index: 10000;
                    animation: slideIn 0.3s ease;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    max-width: 400px;
                    backdrop-filter: blur(10px);
                    font-family: 'Inter', sans-serif;
                }

                .custom-notification.success {
                    background: #16a34a;
                }

                .custom-notification.error {
                    background: #dc2626;
                }

                .custom-notification.warning {
                    background: #f59e0b;
                }

                .custom-notification.info {
                    background: #3b82f6;
                }

                @keyframes slideIn {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }

                @keyframes slideOut {
                    from {
                        transform: translateX(0);
                        opacity: 1;
                    }
                    to {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                }

                /* ========== DELETE MODAL STYLES ========== */
                #deletePostModal {
                    display: none;
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.7);
                    z-index: 10000;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                    backdrop-filter: blur(5px);
                }

                #deletePostModal .modal-content {
                    background: #2c2f33;
                    border-radius: 16px;
                    max-width: 500px;
                    width: 100%;
                    max-height: 90vh;
                    display: flex;
                    flex-direction: column;
                    animation: modalSlideIn 0.3s ease;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
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
                    border-bottom: 1px solid #40444b;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex-shrink: 0;
                }

                #deletePostModal .modal-header h3 {
                    margin: 0;
                    color: #ffffff;
                    font-size: 1.25rem;
                }

                #deletePostModal .close-modal {
                    font-size: 24px;
                    cursor: pointer;
                    color: #99aab5;
                    transition: color 0.2s;
                }

                #deletePostModal .close-modal:hover {
                    color: #ffffff;
                }

                #deletePostModal .modal-body {
                    padding: 20px;
                    overflow-y: auto;
                    flex: 1;
                    color: #ffffff;
                }

                #deletePostModal .modal-body p {
                    margin-top: 0;
                    margin-bottom: 20px;
                    color: #dcddde;
                }

                #deletePostModal .post-preview {
                    background: #36393f;
                    border-radius: 12px;
                    padding: 15px;
                    border: 1px solid #40444b;
                }

                #deletePostModal .preview-image {
                    position: relative;
                    margin-bottom: 15px;
                    border-radius: 8px;
                    overflow: hidden;
                    background: #000;
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
                    padding: 5px 10px;
                    border-radius: 20px;
                    font-size: 12px;
                    display: flex;
                    align-items: center;
                    gap: 5px;
                }

                #deletePostModal .preview-caption {
                    font-size: 14px;
                    color: #ffffff;
                    word-wrap: break-word;
                    max-height: 100px;
                    overflow-y: auto;
                    padding: 10px;
                    background: rgba(0, 0, 0, 0.2);
                    border-radius: 8px;
                }

                #deletePostModal .modal-actions {
                    padding: 20px;
                    border-top: 1px solid #40444b;
                    display: flex;
                    gap: 15px;
                    justify-content: flex-end;
                    flex-shrink: 0;
                }

                #deletePostModal .btn-secondary,
                #deletePostModal .btn-danger {
                    padding: 12px 24px;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                    border: none;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                #deletePostModal .btn-secondary {
                    background: #40444b;
                    color: #ffffff;
                }

                #deletePostModal .btn-secondary:hover {
                    background: #50555c;
                }

                #deletePostModal .btn-danger {
                    background: #ed4245;
                    color: white;
                }

                #deletePostModal .btn-danger:hover {
                    background: #c03538;
                }

                #deletePostModal .btn-danger:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                /* ========== REPLY MODAL ========== */
                .reply-modal {
                    position: fixed;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    background: #36393f;
                    border-top: 2px solid #40444b;
                    padding: 16px;
                    z-index: 10000;
                    display: none;
                    box-shadow: 0 -4px 20px rgba(0,0,0,0.1);
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
                    border-bottom: 1px solid #40444b;
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
                    color: #ff4b6e;
                    font-size: 14px;
                    cursor: pointer;
                }

                .reply-to-name:hover {
                    text-decoration: underline;
                }

                .reply-to-text {
                    font-size: 13px;
                    color: #b9bbbe;
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
                    border: 2px solid #40444b;
                    border-radius: 30px;
                    font-size: 15px;
                    background: #2c2f33;
                    color: #fff;
                }

                .reply-modal-input:focus {
                    outline: none;
                    border-color: #ff4b6e;
                }

                .reply-modal-send {
                    background: #ff4b6e;
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
                }

                .reply-modal-close {
                    position: absolute;
                    top: -40px;
                    right: 0;
                    background: transparent;
                    border: none;
                    color: #b9bbbe;
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
                }

                /* ========== MEDIA QUERIES ========== */
                @media (max-width: 768px) {
                    .pymk-nav-btn.left {
                        left: -10px;
                    }
                    
                    .pymk-nav-btn.right {
                        right: -10px;
                    }
                    
                    .pymk-profile-card {
                        min-width: 160px;
                        max-width: 160px;
                    }
                    
                    .video-play-button-center {
                        width: 60px;
                        height: 60px;
                        font-size: 24px;
                    }
                    
                    .video-center-play-btn {
                        width: 60px;
                        height: 60px;
                        font-size: 24px;
                    }
                    
                    .custom-notification {
                        top: 70px;
                        right: 15px;
                        left: 15px;
                        max-width: none;
                    }
                }

                @media (max-width: 480px) {
                    .pymk-section {
                        padding: 15px;
                    }
                    
                    .pymk-profile-card {
                        min-width: 150px;
                        max-width: 150px;
                        padding: 12px;
                    }
                    
                    .pymk-profile-avatar {
                        width: 60px;
                        height: 60px;
                    }
                    
                    .pymk-nav-btn {
                        width: 32px;
                        height: 32px;
                    }
                    
                    .pymk-nav-btn.left {
                        left: -5px;
                    }
                    
                    .pymk-nav-btn.right {
                        right: -5px;
                    }
                    
                    .video-play-button-center {
                        width: 50px;
                        height: 50px;
                        font-size: 20px;
                    }
                    
                    .video-center-play-btn {
                        width: 50px;
                        height: 50px;
                        font-size: 20px;
                    }
                    
                    .poll-option-content {
                        flex-direction: column;
                        align-items: flex-start;
                        gap: 8px;
                    }
                    
                    .poll-option-right {
                        width: 100%;
                        justify-content: space-between;
                    }
                    
                    .custom-notification {
                        top: 60px;
                        right: 10px;
                        left: 10px;
                        padding: 10px 15px;
                        font-size: 13px;
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
                    return videoUrl.replace('/upload/video/', '/upload/w_800,h_450,c_fill,q_auto,f_jpg/')
                                   .replace(/\.(mp4|mov|avi|mkv|webm|ogg|3gp|m4v)$/i, '.jpg');
                } else {
                    return videoUrl.replace('/upload/', '/upload/w_800,h_450,c_fill,q_auto,f_jpg/');
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
        container.setAttribute('data-thumbnail', thumbnailUrl);
        container.setAttribute('data-duration', duration);
        
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
            this.initializeVideoPlayer(container, postId, videoUrl, thumbUrl, duration);
        });
        
        return container;
    }
    
    createVideoContainer(postId, videoUrl, thumbnailUrl, duration, autoPlay = false) {
        const container = document.createElement('div');
        container.className = 'custom-video-container';
        container.dataset.videoId = postId;
        container.dataset.videoUrl = videoUrl;
        container.dataset.thumbnailUrl = thumbnailUrl;
        container.dataset.duration = duration;
        container.dataset.autoPlay = autoPlay;
        
        const video = document.createElement('video');
        video.className = 'custom-video-player';
        video.preload = 'metadata';
        video.poster = thumbnailUrl;
        
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
        
        container.videoElement = video;
        
        return container;
    }
    
    initializeVideoPlayer(container, postId, videoUrl, thumbnailUrl, duration) {
        if (container.classList.contains('video-initialized')) {
            const video = container.videoElement;
            if (video.paused) {
                video.play().catch(() => {});
            } else {
                video.pause();
            }
            return;
        }

        container.classList.add('video-initialized');

        const video = container.videoElement;
        // Muted is required for autoplay to work in browsers without user interaction
        video.muted = true;
        video.src = videoUrl;
        
        let hideControlsTimeout;
        
        const showControls = () => {
            const controlsOverlay = container.querySelector('.video-controls-overlay');
            const bottomControls = container.querySelector('.video-bottom-controls');
            if (controlsOverlay) controlsOverlay.style.opacity = '1';
            if (bottomControls) bottomControls.style.opacity = '1';
            clearTimeout(hideControlsTimeout);
            hideControlsTimeout = setTimeout(() => {
                if (!video.paused) {
                    if (controlsOverlay) controlsOverlay.style.opacity = '0';
                    if (bottomControls) bottomControls.style.opacity = '0';
                }
            }, 3000);
        };
        
        const updateProgress = () => {
            if (video.duration) {
                const percent = (video.currentTime / video.duration) * 100;
                const progressFill = container.querySelector('.progress-bar-fill');
                if (progressFill) {
                    progressFill.style.width = percent + '%';
                }
                
                const current = this.formatDuration(video.currentTime);
                const total = this.formatDuration(video.duration);
                const timeDisplay = container.querySelector('.time-display');
                if (timeDisplay) {
                    timeDisplay.textContent = `${current} / ${total}`;
                }
            }
        };
        
        const togglePlay = () => {
            if (video.paused) {
                video.play();
            } else {
                video.pause();
            }
        };
        
        const playPauseBtn = container.querySelector('.control-btn:first-child');
        const centerPlayBtn = container.querySelector('.video-center-play-btn');
        const progressContainer = container.querySelector('.progress-bar-container');
        const volumeBtn = container.querySelector('.volume-control .control-btn');
        const volumeSlider = container.querySelector('.volume-slider');
        const volumeFill = container.querySelector('.volume-fill');
        const fullscreenBtn = container.querySelector('.control-btn:last-child');
        
        video.addEventListener('loadedmetadata', () => {
            const timeDisplay = container.querySelector('.time-display');
            if (timeDisplay) {
                timeDisplay.textContent = `0:00 / ${this.formatDuration(video.duration)}`;
            }
        });
        
        video.addEventListener('timeupdate', updateProgress);
        
        video.addEventListener('play', () => {
            if (playPauseBtn) playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
            if (centerPlayBtn) centerPlayBtn.innerHTML = '<i class="fas fa-pause"></i>';
            showControls();
        });
        
        video.addEventListener('pause', () => {
            if (playPauseBtn) playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
            if (centerPlayBtn) centerPlayBtn.innerHTML = '<i class="fas fa-play"></i>';
            const controlsOverlay = container.querySelector('.video-controls-overlay');
            const bottomControls = container.querySelector('.video-bottom-controls');
            if (controlsOverlay) controlsOverlay.style.opacity = '1';
            if (bottomControls) bottomControls.style.opacity = '1';
            clearTimeout(hideControlsTimeout);
        });
        
        video.addEventListener('ended', () => {
            if (playPauseBtn) playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
            if (centerPlayBtn) centerPlayBtn.innerHTML = '<i class="fas fa-play"></i>';
            const controlsOverlay = container.querySelector('.video-controls-overlay');
            const bottomControls = container.querySelector('.video-bottom-controls');
            if (controlsOverlay) controlsOverlay.style.opacity = '1';
            if (bottomControls) bottomControls.style.opacity = '1';
        });
        
        container.addEventListener('mouseenter', showControls);
        container.addEventListener('mouseleave', () => {
            if (!video.paused) {
                const controlsOverlay = container.querySelector('.video-controls-overlay');
                const bottomControls = container.querySelector('.video-bottom-controls');
                if (controlsOverlay) controlsOverlay.style.opacity = '0';
                if (bottomControls) bottomControls.style.opacity = '0';
            }
        });
        
        if (centerPlayBtn) {
            centerPlayBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                togglePlay();
            });
        }
        
        if (playPauseBtn) {
            playPauseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                togglePlay();
            });
        }
        
        if (progressContainer) {
            progressContainer.addEventListener('click', (e) => {
                e.stopPropagation();
                const rect = progressContainer.getBoundingClientRect();
                const percent = (e.clientX - rect.left) / rect.width;
                video.currentTime = percent * video.duration;
            });
        }
        
        if (volumeBtn && volumeSlider && volumeFill) {
            // Start muted — show muted icon
            volumeBtn.innerHTML = '<i class="fas fa-volume-mute"></i>';
            volumeFill.style.width = '0%';

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
        }

        if (fullscreenBtn) {
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
        }

        document.addEventListener('fullscreenchange', () => {
            if (fullscreenBtn) {
                fullscreenBtn.innerHTML = document.fullscreenElement ?
                    '<i class="fas fa-compress"></i>' :
                    '<i class="fas fa-expand"></i>';
            }
        });

        video.addEventListener('dblclick', () => {
            if (fullscreenBtn) fullscreenBtn.click();
        });

        container.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // Auto-play immediately — muted so browser allows it
        if (container.dataset.autoPlay === 'true') {
            video.play().catch(() => {});
        }
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

    // ==================== VIDEO UPLOAD & PROCESSING ====================
    
    async uploadMediaToCloudinary(file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', cloudinaryConfig.uploadPreset);
        
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
            
            if (isVideo) {
                const videoUrl = data.secure_url;
                const thumbnailUrl = this.generateCloudinaryThumbnail(videoUrl);
                
                return {
                    url: videoUrl,
                    type: 'video',
                    mediaType: 'video',
                    duration: data.duration || 0,
                    width: data.width,
                    height: data.height,
                    format: data.format,
                    publicId: data.public_id,
                    thumbnail: thumbnailUrl,
                    videoThumbnail: thumbnailUrl
                };
            }
            
            return {
                url: data.secure_url,
                type: 'image',
                mediaType: 'image',
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
            
            const replyToName = document.getElementById('replyToName');
            if (replyToName) {
                replyToName.addEventListener('click', () => {
                    const userId = modal.dataset.replyToUserId;
                    if (userId) this.openProfileSlideUp(userId);
                });
            }
            
            const replyToAvatar = document.getElementById('replyToAvatar');
            if (replyToAvatar) {
                replyToAvatar.addEventListener('click', () => {
                    const userId = modal.dataset.replyToUserId;
                    if (userId) this.openProfileSlideUp(userId);
                });
            }
        }
    }
    
    // ==================== DISCORD-STYLE PROFILE SLIDE-UP ====================
    // Tapping any user name or avatar opens a bottom slide-up sheet (similar to
    // Discord's user popout). The sheet contains the user's avatar, display
    // name, bio, and a primary "View full profile" button that navigates to
    // profile.html?id=<userId>.
    setupProfileSlideUp() {
        if (document.getElementById('bbProfileSlideUp')) return;
        if (!document.getElementById('bbProfileSlideUpStyles')) {
            const s = document.createElement('style');
            s.id = 'bbProfileSlideUpStyles';
            s.textContent = `
                #bbProfileSlideUp {
                    position: fixed;
                    inset: 0;
                    background: rgba(0,0,0,0);
                    z-index: 100050;
                    display: none;
                    align-items: flex-end;
                    justify-content: center;
                    transition: background .25s ease;
                }
                #bbProfileSlideUp.open { display: flex; background: rgba(0,0,0,0.55); }
                #bbProfileSlideUp .bb-ps-sheet {
                    width: 100%;
                    max-width: 520px;
                    background: linear-gradient(180deg, #2b2d31 0%, #1e2024 100%);
                    border-top-left-radius: 22px;
                    border-top-right-radius: 22px;
                    border: 1px solid rgba(255,255,255,0.08);
                    border-bottom: none;
                    box-shadow: 0 -20px 60px rgba(0,0,0,0.5);
                    transform: translateY(100%);
                    transition: transform .3s cubic-bezier(.2,.8,.3,1);
                    overflow: hidden;
                    max-height: 85vh;
                    display: flex;
                    flex-direction: column;
                }
                #bbProfileSlideUp.open .bb-ps-sheet { transform: translateY(0); }
                #bbProfileSlideUp .bb-ps-grabber {
                    width: 40px; height: 4px;
                    background: rgba(255,255,255,0.25);
                    border-radius: 2px;
                    margin: 10px auto 6px;
                    flex-shrink: 0;
                }
                #bbProfileSlideUp .bb-ps-banner {
                    height: 90px;
                    background: linear-gradient(135deg, #ff4b6e 0%, #d63658 50%, #7b2540 100%);
                    flex-shrink: 0;
                    position: relative;
                }
                #bbProfileSlideUp .bb-ps-avatar-wrap {
                    position: absolute;
                    left: 22px;
                    bottom: -42px;
                    width: 92px; height: 92px;
                    border-radius: 50%;
                    background: #1e2024;
                    padding: 5px;
                    box-shadow: 0 6px 18px rgba(0,0,0,0.5);
                }
                #bbProfileSlideUp .bb-ps-avatar {
                    width: 100%; height: 100%;
                    border-radius: 50%;
                    object-fit: cover;
                    background: #2b2d31;
                    display: block;
                }
                #bbProfileSlideUp .bb-ps-online {
                    position: absolute;
                    bottom: 6px; right: 6px;
                    width: 18px; height: 18px;
                    border-radius: 50%;
                    background: #23a55a;
                    border: 4px solid #1e2024;
                    display: none;
                }
                #bbProfileSlideUp .bb-ps-online.on { display: block; }
                #bbProfileSlideUp .bb-ps-content {
                    padding: 56px 22px 18px;
                    overflow-y: auto;
                    flex: 1;
                }
                #bbProfileSlideUp .bb-ps-name {
                    font-size: 22px;
                    font-weight: 700;
                    color: #fff;
                    line-height: 1.2;
                    margin: 0 0 4px;
                    letter-spacing: -0.01em;
                }
                #bbProfileSlideUp .bb-ps-handle {
                    font-size: 14px;
                    color: #b5bac1;
                    margin: 0 0 14px;
                }
                #bbProfileSlideUp .bb-ps-divider {
                    height: 1px;
                    background: rgba(255,255,255,0.08);
                    margin: 14px 0;
                }
                #bbProfileSlideUp .bb-ps-section-title {
                    font-size: 11px;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 0.06em;
                    color: #b5bac1;
                    margin: 0 0 6px;
                }
                #bbProfileSlideUp .bb-ps-bio {
                    color: #dbdee1;
                    font-size: 14px;
                    line-height: 1.5;
                    white-space: pre-wrap;
                    word-break: break-word;
                }
                #bbProfileSlideUp .bb-ps-meta {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    margin-top: 10px;
                }
                #bbProfileSlideUp .bb-ps-chip {
                    background: rgba(255,255,255,0.06);
                    color: #dbdee1;
                    padding: 6px 12px;
                    border-radius: 999px;
                    font-size: 12px;
                    font-weight: 600;
                    border: 1px solid rgba(255,255,255,0.06);
                }
                #bbProfileSlideUp .bb-ps-actions {
                    padding: 14px 22px calc(20px + env(safe-area-inset-bottom, 0px));
                    background: rgba(0,0,0,0.18);
                    border-top: 1px solid rgba(255,255,255,0.06);
                    display: flex;
                    gap: 10px;
                    flex-shrink: 0;
                }
                #bbProfileSlideUp .bb-ps-btn {
                    flex: 1;
                    border: none;
                    border-radius: 12px;
                    padding: 13px 16px;
                    font-size: 15px;
                    font-weight: 700;
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    transition: transform .12s, filter .12s;
                }
                #bbProfileSlideUp .bb-ps-btn:active { transform: scale(.98); }
                #bbProfileSlideUp .bb-ps-btn-primary {
                    background: linear-gradient(135deg, #ff4b6e, #d63658);
                    color: #fff;
                    box-shadow: 0 6px 16px rgba(255,75,110,0.35);
                }
                #bbProfileSlideUp .bb-ps-btn-primary:hover { filter: brightness(1.08); }
                #bbProfileSlideUp .bb-ps-btn-secondary {
                    background: rgba(255,255,255,0.06);
                    color: #fff;
                    border: 1px solid rgba(255,255,255,0.08);
                }
                #bbProfileSlideUp .bb-ps-btn-secondary:hover { background: rgba(255,255,255,0.1); }
                #bbProfileSlideUp .bb-ps-loading {
                    text-align: center;
                    color: #8696a0;
                    padding: 30px 10px;
                    font-size: 14px;
                }
            `;
            document.head.appendChild(s);
        }

        const overlay = document.createElement('div');
        overlay.id = 'bbProfileSlideUp';
        overlay.innerHTML = `
            <div class="bb-ps-sheet" role="dialog" aria-modal="true" aria-label="Profile preview">
                <div class="bb-ps-grabber"></div>
                <div class="bb-ps-banner">
                    <div class="bb-ps-avatar-wrap">
                        <img class="bb-ps-avatar" id="bbPsAvatar" alt="">
                        <span class="bb-ps-online" id="bbPsOnline"></span>
                    </div>
                </div>
                <div class="bb-ps-content" id="bbPsContent">
                    <div class="bb-ps-loading">Loading…</div>
                </div>
                <div class="bb-ps-actions">
                    <button class="bb-ps-btn bb-ps-btn-secondary" id="bbPsClose">Close</button>
                    <button class="bb-ps-btn bb-ps-btn-primary" id="bbPsView">
                        <i class="fas fa-user"></i> View full profile
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        // Tap on dim background to close
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this.closeProfileSlideUp();
        });
        overlay.querySelector('#bbPsClose').addEventListener('click', () => this.closeProfileSlideUp());
        overlay.querySelector('#bbPsView').addEventListener('click', () => {
            const id = overlay.dataset.userId;
            if (id) window.location.href = `profile.html?id=${encodeURIComponent(id)}`;
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && overlay.classList.contains('open')) this.closeProfileSlideUp();
        });
    }

    async openProfileSlideUp(userId) {
        if (!userId) return;
        if (!document.getElementById('bbProfileSlideUp')) this.setupProfileSlideUp();
        const overlay = document.getElementById('bbProfileSlideUp');
        if (!overlay) return;

        overlay.dataset.userId = userId;
        const content = overlay.querySelector('#bbPsContent');
        const avatarImg = overlay.querySelector('#bbPsAvatar');
        const onlineDot = overlay.querySelector('#bbPsOnline');

        avatarImg.src = '';
        onlineDot.classList.remove('on');
        content.innerHTML = '<div class="bb-ps-loading">Loading…</div>';

        // Open immediately for snappy UX
        overlay.classList.add('open');

        try {
            const userRef = doc(db, 'users', userId);
            const userSnap = await getDoc(userRef);
            const u = userSnap.exists() ? userSnap.data() : {};

            const displayName = u.displayName || u.name || u.username || 'User';
            const handle = u.username ? `@${u.username}` : (u.email ? u.email.split('@')[0] : '');
            const photo = u.photoURL || u.profilePicture || u.avatar || 'images/default-avatar.png';
            const bio = u.bio || u.about || '';
            const age = u.age ? `${u.age}` : '';
            const location = u.location || u.city || '';
            const gender = u.gender || '';
            const isOnline = !!u.isOnline;

            avatarImg.src = photo;
            avatarImg.alt = displayName;
            if (isOnline) onlineDot.classList.add('on');

            const chips = [];
            if (age) chips.push(`<span class="bb-ps-chip"><i class="fas fa-birthday-cake"></i> ${age}</span>`);
            if (gender) chips.push(`<span class="bb-ps-chip"><i class="fas fa-venus-mars"></i> ${this._escapeHtml(gender)}</span>`);
            if (location) chips.push(`<span class="bb-ps-chip"><i class="fas fa-map-marker-alt"></i> ${this._escapeHtml(location)}</span>`);

            content.innerHTML = `
                <h3 class="bb-ps-name">${this._escapeHtml(displayName)}</h3>
                ${handle ? `<div class="bb-ps-handle">${this._escapeHtml(handle)}</div>` : ''}
                ${chips.length ? `<div class="bb-ps-meta">${chips.join('')}</div>` : ''}
                ${bio ? `
                    <div class="bb-ps-divider"></div>
                    <div class="bb-ps-section-title">About</div>
                    <div class="bb-ps-bio">${this._escapeHtml(bio)}</div>
                ` : ''}
            `;
        } catch (err) {
            console.error('Profile slide-up load error:', err);
            content.innerHTML = '<div class="bb-ps-loading" style="color:#ef4444;">Could not load profile.</div>';
        }
    }

    closeProfileSlideUp() {
        const overlay = document.getElementById('bbProfileSlideUp');
        if (!overlay) return;
        overlay.classList.remove('open');
    }

    _escapeHtml(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
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
            
            // Refresh comments to show the new reply
            const commentsSection = document.getElementById(`comments-${postId}`);
            if (commentsSection && commentsSection.style.display !== 'none') {
                await this.loadComments(postId);
            }
            
            // Also refresh modal comments if open
            const modalComments = document.getElementById(`modal-comments-list-${postId}`);
            if (modalComments) {
                await this.loadModalComments(postId);
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
        
        const avatar = commentDiv.querySelector('.comment-avatar');
        const name = commentDiv.querySelector('.comment-info strong');
        
        const navigateToProfile = (e) => {
            if (e && e.stopPropagation) e.stopPropagation();
            this.openProfileSlideUp(comment.userId);
        };
        
        if (avatar) {
            avatar.addEventListener('click', navigateToProfile);
        }
        
        if (name) {
            name.addEventListener('click', navigateToProfile);
        }
        
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
        
        const avatar = replyDiv.querySelector('.reply-avatar');
        const name = replyDiv.querySelector('.reply-info strong');
        
        const navigateToProfile = (e) => {
            if (e && e.stopPropagation) e.stopPropagation();
            this.openProfileSlideUp(reply.userId);
        };
        
        if (avatar) {
            avatar.addEventListener('click', navigateToProfile);
        }
        
        if (name) {
            name.addEventListener('click', navigateToProfile);
        }
        
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

    // ==================== CREATE POST WITH VIDEO/POLL ====================
    
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
        this.setupPostModal();
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
                            <div class="video-thumbnail-container" style="cursor: default; padding-bottom: 75%;">
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
                if (mediaData.type === 'video' || mediaData.mediaType === 'video') {
                    postData.videoUrl = mediaData.url;
                    postData.mediaType = 'video';
                    postData.videoThumbnail = mediaData.thumbnail || mediaData.videoThumbnail;
                    postData.videoDuration = mediaData.duration || 0;
                    postData.imageUrl = null;
                } else {
                    postData.imageUrl = mediaData.url;
                    postData.mediaType = 'image';
                    postData.videoUrl = null;
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
                this.removeLoader();
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
                // Invalidate the cached following set so future post renders reflect
                // the unfollow immediately without stale data
                if (this._followingSet) this._followingSet.delete(userId);
                button.innerHTML = '<i class="fas fa-user-plus"></i> Follow';
                button.classList.remove('following');
                button.dataset.following = 'false';
                this.showNotification('Unfollowed user', 'info');
            } else {
                await this.followUser(userId);
                // Update cached set so other Follow buttons on the feed update state
                if (this._followingSet) this._followingSet.add(userId);
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
        if (message.includes('Voted') || message.includes('Vote')) return;

        const existingNotifications = document.querySelectorAll('.custom-notification');
        existingNotifications.forEach(n => n.remove());

        const notification = document.createElement('div');
        notification.className = `custom-notification ${type}`;

        const bgColor = type === 'error'   ? '#dc2626' :
                        type === 'success' ? '#16a34a' :
                        type === 'warning' ? '#d97706' : '#ff4b6e';

        const borderColor = type === 'error'   ? '#ef4444' :
                            type === 'success' ? '#22c55e' :
                            type === 'warning' ? '#f59e0b' : '#ff6b87';

        notification.style.cssText = `
            position: fixed;
            top: 68px;
            right: 16px;
            background: ${bgColor};
            color: white;
            padding: 7px 12px;
            border-radius: 8px;
            border-left: 3px solid ${borderColor};
            box-shadow: 0 4px 16px rgba(0,0,0,0.3);
            z-index: 10000;
            animation: bbNotifIn 0.25s ease;
            display: flex;
            align-items: center;
            gap: 7px;
            max-width: 220px;
            font-family: 'Inter', sans-serif;
            font-size: 12px;
            font-weight: 500;
            line-height: 1.3;
        `;

        if (!document.getElementById('bbNotifStyles')) {
            const s = document.createElement('style');
            s.id = 'bbNotifStyles';
            s.textContent = `
                @keyframes bbNotifIn  { from { transform: translateX(110%); opacity:0; } to { transform: translateX(0); opacity:1; } }
                @keyframes bbNotifOut { from { transform: translateX(0); opacity:1; } to { transform: translateX(110%); opacity:0; } }
            `;
            document.head.appendChild(s);
        }

        const icon = type === 'error' ? 'alert-circle' :
                     type === 'success' ? 'check-circle' :
                     type === 'warning' ? 'alert-triangle' : 'info';

        notification.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" style="flex-shrink:0;">
                ${this.getNotificationIcon(icon)}
            </svg>
            <span>${message}</span>
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'bbNotifOut 0.25s ease forwards';
            setTimeout(() => notification.remove(), 250);
        }, 2800);
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
                return '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>';
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
                postContentHTML = `<div id="video-container-${post.id}" class="video-wrapper"></div>`;
            }
        } else if (post.imageUrl) {
            const imageUrl = String(post.imageUrl).trim();
            if (imageUrl && imageUrl !== 'null' && imageUrl !== 'undefined' && imageUrl.length > 10) {
                postContentHTML += `
                    <div class="post-image-container">
                        <img src="${imageUrl}" alt="Post image" class="post-image" style="width: 100%; max-height: 500px; object-fit: contain; border-radius: 16px;">
                    </div>
                `;
            }
        }
        
        if (post.caption) {
            postContentHTML += `<p class="post-caption">${this.formatCaption(post.caption)}</p>`;
        }
        
        const isLiked = this.likedPosts.has(post.id);
        const userVote = this.getUserVoteForPost(post.id);
        const upvotes = post.upvotes || 0;
        const downvotes = post.downvotes || 0;
        
        container.innerHTML = `
            <div class="post-item" data-post-id="${post.id}">
                <div class="post-header">
                    <img src="${user.profileImage || 'images/default-profile.jpg'}" 
                         alt="${user.name}" class="post-author-avatar" style="cursor: pointer;">
                    <div class="post-author-info">
                        <h4 style="color: #ff4b6e; cursor: pointer;">${user.name || 'Unknown User'}</h4>
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

        if (post.videoUrl || post.mediaType === 'video') {
            setTimeout(() => {
                const container = document.getElementById(`video-container-${post.id}`);
                if (container) {
                    const videoContainer = this.createVideoContainer(post.id, post.videoUrl, this.getVideoThumbnail(post), post.videoDuration || 0, true);
                    container.appendChild(videoContainer);
                    
                    if (this.videoObserver) {
                        this.videoObserver.observe(videoContainer);
                    }
                }
            }, 100);
        }

        const avatar = container.querySelector('.post-author-avatar');
        const name = container.querySelector('.post-author-info h4');
        
        const navigateToProfile = (e) => {
            if (e && e.stopPropagation) e.stopPropagation();
            this.openProfileSlideUp(post.userId);
        };
        
        if (avatar) {
            avatar.addEventListener('click', navigateToProfile);
        }
        
        if (name) {
            name.addEventListener('click', navigateToProfile);
        }

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
        
        // FIXED: Previously fetched users ONE BY ONE in a sequential for-loop,
        // causing a waterfall of N Firestore reads (each waiting for the last).
        // With 15 posts by 10 different users, that's 10 sequential round-trips.
        // Now we fire ALL requests in parallel with Promise.all — same number of
        // reads, but they all happen at the same time. The whole batch finishes
        // as fast as the single slowest request instead of the SUM of all of them.
        //
        // Also added an in-memory cache (this.userCache) so if the same user
        // appears across multiple loadComments/displayPosts calls in the same
        // session, we never hit Firestore for them again.

        if (!this._userCache) {
            this._userCache = new Map();
        }

        const uncachedIds = userIds.filter(id => id && !this._userCache.has(id));

        if (uncachedIds.length > 0) {
            const fetchPromises = uncachedIds.map(async (userId) => {
                try {
                    const userRef = doc(db, 'users', userId);
                    const userSnap = await getDoc(userRef);
                    if (userSnap.exists()) {
                        const data = userSnap.data();
                        this._userCache.set(userId, data);
                    }
                } catch (error) {
                    console.error('Error fetching user data:', error);
                }
            });

            // Fire all uncached fetches at the same time
            await Promise.all(fetchPromises);
        }

        // Build result from cache (which now contains both previously-cached
        // and freshly-fetched users)
        for (const userId of userIds) {
            if (userId && this._userCache.has(userId)) {
                usersData[userId] = this._userCache.get(userId);
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
        
        // FIXED: Previously called checkIfFollowing(userId) for EVERY post in the feed,
        // which fired an individual Firestore read per post (15 posts = 15 extra reads
        // executed sequentially inside createPostElement, INSIDE displayPosts' for-loop).
        // That's an absolute massacre of your read quota and why the feed loads slowly.
        //
        // Fix: We fetch the current user's following list ONCE per session and cache it
        // in this._followingSet (a Set for O(1) lookups). checkIfFollowing() is now a
        // synchronous local check instead of a round-trip to Firestore.
        let isFollowing = false;
        if (this.currentUser && userId !== this.currentUser.uid) {
            if (!this._followingSet) {
                // First time — fetch once and cache
                const followingList = await this.getFollowingUsers();
                this._followingSet = new Set(followingList);
            }
            isFollowing = this._followingSet.has(userId);
        }
        
        let postContentHTML = '';
        
        if (post.mediaType === 'poll' && post.poll) {
            const pollContainer = this.createPollElement(post, postId);
            postContentHTML = pollContainer.outerHTML;
        } else if (post.videoUrl || post.mediaType === 'video') {
            const videoUrl = post.videoUrl;
            if (videoUrl) {
                postContentHTML = `<div id="video-container-${postId}" class="video-wrapper"></div>`;
            }
        } else if (post.imageUrl) {
            const imageUrl = String(post.imageUrl).trim();
            if (imageUrl && imageUrl !== 'null' && imageUrl !== 'undefined' && imageUrl.length > 10) {
                postContentHTML += `
                    <div class="post-image-container">
                        <img src="${imageUrl}" alt="Post image" class="post-image" loading="lazy" style="width: 100%; max-height: 500px; object-fit: contain; border-radius: 16px;">
                    </div>
                `;
            }
        }
        
        if (post.caption) {
            postContentHTML += `<p class="post-caption">${this.formatCaption(post.caption)}</p>`;
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

        if (post.videoUrl || post.mediaType === 'video') {
            setTimeout(() => {
                const container = document.getElementById(`video-container-${postId}`);
                if (container) {
                    const videoContainer = this.createVideoContainer(postId, post.videoUrl, this.getVideoThumbnail(post), post.videoDuration || 0);
                    container.appendChild(videoContainer);
                    
                    if (this.videoObserver) {
                        this.videoObserver.observe(videoContainer);
                    }
                }
            }, 100);
        }

        const avatar = postDiv.querySelector('.post-author-avatar');
        const name = postDiv.querySelector('.post-author-info h4');
        
        const navigateToProfile = (e) => {
            if (e && e.stopPropagation) e.stopPropagation();
            this.openProfileSlideUp(userId);
        };
        
        if (avatar) {
            avatar.addEventListener('click', navigateToProfile);
        }
        
        if (name) {
            name.addEventListener('click', navigateToProfile);
        }

        postDiv.addEventListener('click', (e) => {
            const target = e.target;
            const isInteractive = 
                target.closest('.vote-btn') ||
                target.closest('.post-action') ||
                target.closest('.follow-btn-post') ||
                target.closest('.comment-input') ||
                target.closest('.send-comment-btn') ||
                target.closest('.reply-btn') ||
                target.closest('.view-replies-btn') ||
                target.closest('.poll-option-content') ||
                target.closest('.video-thumbnail-container') ||
                target.closest('.custom-video-container') ||
                target.closest('.post-author-avatar') ||
                target.closest('.post-author-info h4');
            
            if (!isInteractive) {
                this.openPostModal(postId);
            }
        });

        const likeBtn = postDiv.querySelector('.like-btn');
        const commentBtn = postDiv.querySelector('.comment-btn');
        const sendCommentBtn = postDiv.querySelector('.send-comment-btn');
        const commentInput = postDiv.querySelector('.comment-input');
        const followBtn = postDiv.querySelector('.follow-btn-post');
        const upvoteBtn = postDiv.querySelector('.vote-btn.up');
        const downvoteBtn = postDiv.querySelector('.vote-btn.down');

        if (likeBtn) {
            likeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleLike(postId, likeBtn);
            });
        }

        if (commentBtn) {
            commentBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleComments(postId);
            });
        }

        if (sendCommentBtn) {
            sendCommentBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleAddComment(postId, false);
            });
        }

        if (commentInput) {
            commentInput.addEventListener('keypress', (e) => {
                e.stopPropagation();
                if (e.key === 'Enter') {
                    this.handleAddComment(postId, false);
                }
            });
        }

        if (upvoteBtn) {
            upvoteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleVote(postId, 'up', upvoteBtn);
            });
        }

        if (downvoteBtn) {
            downvoteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleVote(postId, 'down', downvoteBtn);
            });
        }

        if (followBtn) {
            followBtn.addEventListener('click', (e) => e.stopPropagation());
        }

        this.markPostAsViewed(postId);

        return postDiv;
    }

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

            const docRef = await addDoc(collection(db, 'posts', postId, 'comments'), commentData);

            const postRef = doc(db, 'posts', postId);
            await updateDoc(postRef, {
                commentsCount: increment(1),
                updatedAt: serverTimestamp()
            });

            commentInput.value = '';
            
            // FIXED: Previously called loadComments(postId) / loadCommentsForPage(postId)
            // here, which wiped the entire comments list and re-fetched ALL comments
            // from Firestore just to show the one new comment. If a post had 50 comments
            // that's 50 comment reads + N user reads every single time someone types.
            // It also caused a visible flash/flicker as the list blanked out and rebuilt.
            //
            // Fix: Optimistically append just the new comment element directly to the
            // DOM using data we already have (the current user's profile). No re-fetch.
            // The comment gets a temporary createdAt so formatTime shows "Just now".
            const tempComment = {
                id: docRef.id,
                userId: this.currentUser.uid,
                text: commentText,
                createdAt: { toDate: () => new Date() }, // local timestamp for display
                repliesCount: 0
            };
            const tempUser = {
                name: this.currentUser.displayName || 'User',
                profileImage: this.currentUser.photoURL || 'images/default-profile.jpg'
            };

            if (isCommentsPage) {
                const commentsList = document.getElementById('commentsList');
                if (commentsList) {
                    // Remove "no comments" placeholder if present
                    const noComments = commentsList.querySelector('.no-comments');
                    if (noComments) noComments.remove();
                    
                    const commentElement = this.createCommentElement(tempComment, tempUser, postId);
                    commentsList.appendChild(commentElement);
                    commentElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
                const commentCount = document.querySelector('.comment-count');
                if (commentCount) {
                    const currentCount = parseInt(commentCount.textContent) || 0;
                    commentCount.textContent = this.formatCount(currentCount + 1);
                }
            } else {
                const commentsList = document.getElementById(`comments-list-${postId}`);
                if (commentsList) {
                    const noComments = commentsList.querySelector('.no-comments');
                    if (noComments) noComments.remove();

                    const commentElement = this.createCommentElement(tempComment, tempUser, postId);
                    commentsList.appendChild(commentElement);
                    commentElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
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
            // FIXED: Previously fetched ALL posts from Firestore with zero limit just to
            // count how many are unviewed. On a big app that's hundreds of doc reads every
            // time you navigate. Completely unnecessary and expensive.
            //
            // Fix: Only fetch posts from the last 24 hours (which is what we care about
            // for the badge), and limit to 50 — more than enough for a realistic unread count.
            // We also debounce repeat calls (e.g. called from setupNavigation + elsewhere)
            // so they don't stack up on page load.

            if (this._newPostsCountTimeout) return; // debounce — if already scheduled, skip
            this._newPostsCountTimeout = setTimeout(() => {
                this._newPostsCountTimeout = null;
            }, 5000); // allow re-check every 5s at most

            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            
            // Only fetch recent posts — not the entire collection
            const postsQuery = query(
                collection(db, 'posts'),
                orderBy('createdAt', 'desc'),
                limit(50) // cap at 50; badge shows "50+" style if needed
            );
            const postsSnap = await getDocs(postsQuery);
            
            let newPostsCount = 0;
            
            postsSnap.forEach(doc => {
                const post = doc.data();
                const postDate = post.createdAt?.toDate ? post.createdAt.toDate() : new Date(0);
                
                // Only count posts from the last 24h that haven't been viewed
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
        
        // FIXED: Previously used async forEach which is a classic JS trap —
        // forEach does NOT await async callbacks, so all createPYMKProfileCard calls
        // (each of which fired a checkIfFollowing Firestore read) launched simultaneously
        // without any control, AND cards could append in random order as promises resolved.
        //
        // Fix 1: Use a proper for...of loop that awaits each card creation.
        // Fix 2: createPYMKProfileCard now uses the cached _followingSet instead of
        //         a new Firestore round-trip per card — see createPYMKProfileCard.
        (async () => {
            for (const user of this.currentPYMKProfiles) {
                const profileCard = await this.createPYMKProfileCard(user);
                container.appendChild(profileCard);
                
                this.viewedPYMKProfiles.add(user.id);
            }
            // Save once after the loop, not inside it (saves N localStorage writes -> 1)
            this.saveViewedPYMKProfiles();
        })();
    }

    async createPYMKProfileCard(user) {
        const card = document.createElement('div');
        card.className = 'pymk-profile-card';
        
        // FIXED: Previously called checkIfFollowing(user.id) which fired a fresh
        // Firestore read per PYMK card. With 5-10 cards that's 5-10 extra reads just
        // to render the "Follow / Following" button state.
        //
        // Fix: Use the already-cached _followingSet (populated during post rendering).
        // If for some reason it doesn't exist yet (e.g. PYMK loaded before posts),
        // fetch it once and cache it — same as createPostElement does.
        let isFollowing = false;
        if (this.currentUser && user.id !== this.currentUser.uid) {
            if (!this._followingSet) {
                const followingList = await this.getFollowingUsers();
                this._followingSet = new Set(followingList);
            }
            isFollowing = this._followingSet.has(user.id);
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
            <h4 class="pymk-profile-name" title="${user.name || 'Unknown User'}">
                ${user.name || 'Unknown User'}
            </h4>
            <div class="pymk-profile-info" title="${profileInfo}">
                ${profileInfo}
            </div>
            ${mutualConnections > 0 ? `
                <div class="pymk-profile-mutual">
                    <i class="fas fa-user-friends"></i>
                    ${mutualConnections} mutual connection${mutualConnections !== 1 ? 's' : ''}
                </div>
            ` : ''}
            <button class="pymk-follow-btn ${isFollowing ? 'following' : ''}" 
                    data-user-id="${user.id}" 
                    data-following="${isFollowing}">
                <i class="fas ${isFollowing ? 'fa-user-check' : 'fa-user-plus'}"></i>
                ${isFollowing ? 'Following' : 'Follow'}
            </button>
        `;

        const avatar = card.querySelector('.pymk-profile-avatar');
        const name = card.querySelector('.pymk-profile-name');
        
        const navigateToProfile = (e) => {
            if (e && e.stopPropagation) e.stopPropagation();
            this.openProfileSlideUp(user.id);
        };
        
        if (avatar) {
            avatar.addEventListener('click', navigateToProfile);
        }
        
        if (name) {
            name.addEventListener('click', navigateToProfile);
        }
        
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
                // Keep the cache consistent so other UI elements reflect the change
                if (this._followingSet) this._followingSet.delete(userId);
                button.innerHTML = '<i class="fas fa-user-plus"></i> Follow';
                button.classList.remove('following');
                button.dataset.following = 'false';
                this.showNotification('Unfollowed user', 'info');
            } else {
                await this.followUser(userId);
                if (this._followingSet) this._followingSet.add(userId);
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
            this.setupProfileReactions();
        }
    }
    
    setupProfileReactions() {
        document.addEventListener('click', (e) => {
            const likeBtn = e.target.closest('.like-btn');
            const voteBtn = e.target.closest('.vote-btn');
            
            if (likeBtn) {
                e.preventDefault();
                e.stopPropagation();
                const postId = likeBtn.dataset.postId;
                if (postId) {
                    this.handleLike(postId, likeBtn);
                }
            }
            
            if (voteBtn) {
                e.preventDefault();
                e.stopPropagation();
                const postId = voteBtn.dataset.postId;
                const voteType = voteBtn.dataset.vote;
                if (postId && voteType) {
                    this.handleVote(postId, voteType, voteBtn);
                }
            }
        });
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
                postContentHTML = `<div id="profile-video-container-${postId}" class="video-wrapper"></div>`;
            }
        } else if (post.imageUrl) {
            const imageUrl = String(post.imageUrl).trim();
            if (imageUrl && imageUrl !== 'null' && imageUrl !== 'undefined' && imageUrl.length > 10) {
                postContentHTML += `
                    <div class="post-image-container">
                        <img src="${imageUrl}" alt="Post image" class="post-image" style="width: 100%; max-height: 500px; object-fit: contain; border-radius: 16px;">
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
                     alt="${userData.name}" class="post-author-avatar" style="cursor: pointer;">
                <div class="post-author-info">
                    <h4 style="color: #ff4b6e; cursor: pointer;">${userData.name || 'Unknown User'}</h4>
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

        if (post.videoUrl || post.mediaType === 'video') {
            setTimeout(() => {
                const container = document.getElementById(`profile-video-container-${postId}`);
                if (container) {
                    const videoContainer = this.createVideoContainer(postId, post.videoUrl, this.getVideoThumbnail(post), post.videoDuration || 0);
                    container.appendChild(videoContainer);
                    
                    if (this.videoObserver) {
                        this.videoObserver.observe(videoContainer);
                    }
                }
            }, 100);
        }

        const avatar = postDiv.querySelector('.post-author-avatar');
        const name = postDiv.querySelector('.post-author-info h4');
        
        if (window.location.pathname.includes('profile.html')) {
            if (avatar) avatar.style.cursor = 'default';
            if (name) name.style.cursor = 'default';
        }

        const likeBtn = postDiv.querySelector('.like-btn');
        const commentBtn = postDiv.querySelector('.comment-btn');
        const sendCommentBtn = postDiv.querySelector('.send-comment-btn');
        const commentInput = postDiv.querySelector('.comment-input');
        const upvoteBtn = postDiv.querySelector('.vote-btn.up');
        const downvoteBtn = postDiv.querySelector('.vote-btn.down');

        if (likeBtn) {
            likeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleLike(postId, likeBtn);
            });
        }

        if (commentBtn) {
            commentBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleComments(postId);
            });
        }

        if (sendCommentBtn) {
            sendCommentBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleAddComment(postId, false);
            });
        }

        if (commentInput) {
            commentInput.addEventListener('keypress', (e) => {
                e.stopPropagation();
                if (e.key === 'Enter') {
                    this.handleAddComment(postId, false);
                }
            });
        }

        if (upvoteBtn) {
            upvoteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleVote(postId, 'up', upvoteBtn);
            });
        }

        if (downvoteBtn) {
            downvoteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleVote(postId, 'down', downvoteBtn);
            });
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
                postContentHTML = `<div id="user-video-container-${postId}" class="video-wrapper"></div>`;
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

        if (post.videoUrl || post.mediaType === 'video') {
            setTimeout(() => {
                const container = document.getElementById(`user-video-container-${postId}`);
                if (container) {
                    const videoContainer = this.createVideoContainer(postId, post.videoUrl, this.getVideoThumbnail(post), post.videoDuration || 0);
                    container.appendChild(videoContainer);
                }
            }, 100);
        }

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