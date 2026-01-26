// social.js - Complete independent social features module for dating site WITH PAGINATION AND FOLLOWERS INTEGRATION
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
    increment
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyC8_PEsfTOr-gJ8P1MoXobOAfqwTVqEZWo",
    authDomain: "usa-dating-23bc3.firebaseapp.com",
    projectId: "usa-dating-23bc3",
    storageBucket: "usa-dating-23bc3.firebasestorage.app",
    messagingSenderId: "423286263327",
    appId: "1:423286263327:web:17f0caf843dc349c144f2a"
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
        this.lastVisiblePost = null;
        this.isLoading = false;
        this.hasMorePosts = true;
        this.postsPerPage = 10;
        this.currentFilter = 'all'; // 'all', 'following', 'top'
        this.allPosts = []; // Store all posts for client-side filtering
        this.followingStatus = {}; // Store following status for users
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
            } else {
                if (!window.location.pathname.includes('login.html') && 
                    !window.location.pathname.includes('signup.html') &&
                    !window.location.pathname.includes('index.html')) {
                    window.location.href = 'login.html';
                }
            }
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
            // Load More button
            if (e.target.id === 'loadMorePosts' || e.target.closest('#loadMorePosts')) {
                this.loadMorePosts();
            }
            // Filter buttons for posts page
            if (e.target.classList.contains('posts-filter-btn') || e.target.closest('.posts-filter-btn')) {
                const btn = e.target.classList.contains('posts-filter-btn') ? e.target : e.target.closest('.posts-filter-btn');
                const filter = btn.dataset.filter;
                this.changePostsFilter(filter);
            }
            // Follow buttons
            if (e.target.classList.contains('follow-btn-post') || e.target.closest('.follow-btn-post')) {
                const btn = e.target.classList.contains('follow-btn-post') ? e.target : e.target.closest('.follow-btn-post');
                const userId = btn.dataset.userId;
                const isFollowing = btn.dataset.following === 'true';
                
                if (userId && userId !== this.currentUser?.uid) {
                    e.stopPropagation();
                    this.handlePostFollow(userId, btn, isFollowing);
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

    // ==================== FORMAT COUNT FUNCTION (TikTok Style) ====================
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

    // ==================== POSTS PAGE WITH FILTERS ====================
    setupPostsPage() {
        // Add filter buttons if they don't exist
        this.addFilterButtons();
        
        // Load initial posts
        this.loadAllPosts();
        this.markAllPostsAsViewed();
    }

    addFilterButtons() {
        const postsContainer = document.getElementById('postsContainer');
        if (!postsContainer) return;
        
        // Check if filter buttons already exist
        if (document.getElementById('postsFilterButtons')) return;
        
        const filterContainer = document.createElement('div');
        filterContainer.id = 'postsFilterButtons';
        filterContainer.className = 'posts-filter-buttons';
        filterContainer.innerHTML = `
            <button class="posts-filter-btn active" data-filter="all">
                <i class="fas fa-globe"></i> All Posts
            </button>
            <button class="posts-filter-btn" data-filter="top">
                <i class="fas fa-fire"></i> Top Posts
            </button>
            <button class="posts-filter-btn" data-filter="following">
                <i class="fas fa-user-friends"></i> Following
            </button>
        `;
        
        // Insert before posts container
        postsContainer.parentNode.insertBefore(filterContainer, postsContainer);
        
        // Add styles
        if (!document.getElementById('filterStyles')) {
            const style = document.createElement('style');
            style.id = 'filterStyles';
            style.textContent = `
                .posts-filter-buttons {
                    display: flex;
                    gap: 10px;
                    margin-bottom: 20px;
                    padding: 10px;
                    background: var(--bg-secondary);
                    border-radius: 10px;
                    justify-content: center;
                    flex-wrap: wrap;
                }
                .posts-filter-btn {
                    background: var(--bg-primary);
                    border: 1px solid var(--border);
                    color: var(--text-primary);
                    padding: 8px 16px;
                    border-radius: 20px;
                    cursor: pointer;
                    font-size: 14px;
                    transition: all 0.3s;
                    display: flex;
                    align-items: center;
                    gap: 5px;
                }
                .posts-filter-btn:hover {
                    background: var(--hover);
                }
                .posts-filter-btn.active {
                    background: var(--primary);
                    color: white;
                    border-color: var(--primary);
                }
                .posts-filter-btn i {
                    font-size: 12px;
                }
                .follow-btn-post {
                    background: var(--primary);
                    color: white;
                    border: none;
                    padding: 4px 12px;
                    border-radius: 15px;
                    font-size: 12px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    transition: all 0.3s;
                    margin-left: auto;
                }
                .follow-btn-post:hover {
                    opacity: 0.9;
                }
                .follow-btn-post.following {
                    background: var(--success);
                }
                .post-author-info {
                    flex: 1;
                    min-width: 0;
                }
                .post-header {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
            `;
            document.head.appendChild(style);
        }
    }

    changePostsFilter(filter) {
        // Update active button
        document.querySelectorAll('.posts-filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        const activeBtn = document.querySelector(`.posts-filter-btn[data-filter="${filter}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
        
        // Update current filter
        this.currentFilter = filter;
        
        // Reset pagination
        this.lastVisiblePost = null;
        this.hasMorePosts = true;
        
        // Clear container
        const container = document.getElementById('postsContainer');
        if (container) {
            container.innerHTML = '';
            
            // Add loading skeletons
            for (let i = 0; i < 3; i++) {
                container.appendChild(this.createLoadingPostItem());
            }
        }
        
        // Load posts with new filter
        this.loadAllPosts();
    }

    // UPDATED: Load posts with pagination and client-side filtering
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
            
            // Remove loading skeletons on first load
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
            
            // Store the last document for pagination
            const lastDoc = postsSnap.docs[postsSnap.docs.length - 1];
            this.lastVisiblePost = lastDoc;
            
            // Check if we have more posts
            this.hasMorePosts = postsSnap.size >= this.postsPerPage;
            
            const allPosts = [];
            postsSnap.forEach(doc => {
                const postData = doc.data();
                allPosts.push({ id: doc.id, ...postData });
            });
            
            // Apply client-side filtering
            let filteredPosts = allPosts;
            
            if (this.currentFilter === 'top') {
                // Sort by likes (descending)
                filteredPosts.sort((a, b) => (b.likes || 0) - (a.likes || 0));
            } else if (this.currentFilter === 'following') {
                if (!this.currentUser) {
                    filteredPosts = [];
                } else {
                    // Get following users
                    const followingUsers = await this.getFollowingUsers();
                    if (followingUsers.length === 0) {
                        filteredPosts = [];
                    } else {
                        filteredPosts = allPosts.filter(post => 
                            followingUsers.includes(post.userId)
                        );
                    }
                }
            }
            
            // Display filtered posts
            await this.displayPosts(filteredPosts, lastVisible !== null);
            
            // Show/hide load more button
            if (loadMoreBtn) {
                if (this.hasMorePosts) {
                    loadMoreBtn.style.display = 'block';
                    loadMoreBtn.disabled = false;
                    loadMoreBtn.innerHTML = '<i class="fas fa-plus"></i> Load More';
                } else {
                    loadMoreBtn.style.display = 'none';
                }
            }
            
            // Show message if no posts in current filter
            if (filteredPosts.length === 0 && lastVisible === null) {
                let message = '';
                switch(this.currentFilter) {
                    case 'following':
                        if (!this.currentUser) {
                            message = 'Please log in to see posts from users you follow';
                        } else {
                            message = `
                                <div class="no-posts-message">
                                    <i class="fas fa-user-friends" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
                                    <h3>No Posts from Followed Users</h3>
                                    <p>You're not following anyone yet. Follow users to see their posts here!</p>
                                    <a href="mingle.html" class="btn-primary">
                                        <i class="fas fa-users"></i> Find Users to Follow
                                    </a>
                                </div>
                            `;
                        }
                        break;
                    case 'top':
                        message = 'No posts with likes yet';
                        break;
                    default:
                        message = 'No posts yet. Be the first to post!';
                }
                container.innerHTML = message;
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
            
            // Add current user to target user's followers
            const targetUserRef = doc(db, 'users', targetUserId);
            await updateDoc(targetUserRef, {
                followers: arrayUnion(this.currentUser.uid),
                updatedAt: serverTimestamp()
            });
            
            // Add target user to current user's following
            const currentUserRef = doc(db, 'users', this.currentUser.uid);
            await updateDoc(currentUserRef, {
                following: arrayUnion(targetUserId),
                updatedAt: serverTimestamp()
            });
            
            // Also increase likes count
            await updateDoc(targetUserRef, {
                likes: arrayUnion(this.currentUser.uid)
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
            
            // Remove current user from target user's followers
            const targetUserRef = doc(db, 'users', targetUserId);
            await updateDoc(targetUserRef, {
                followers: arrayRemove(this.currentUser.uid),
                updatedAt: serverTimestamp()
            });
            
            // Remove target user from current user's following
            const currentUserRef = doc(db, 'users', this.currentUser.uid);
            await updateDoc(currentUserRef, {
                following: arrayRemove(targetUserId),
                updatedAt: serverTimestamp()
            });
            
            // Also remove like
            await updateDoc(targetUserRef, {
                likes: arrayRemove(this.currentUser.uid)
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
            
            // Check if current user is in target user's followers list
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

        // Don't allow following yourself
        if (userId === this.currentUser.uid) {
            return;
        }

        try {
            if (isCurrentlyFollowing) {
                // Unfollow
                await this.unfollowUser(userId);
                button.innerHTML = '<i class="fas fa-user-plus"></i> Follow';
                button.classList.remove('following');
                button.dataset.following = 'false';
                this.showNotification('Unfollowed user', 'info');
            } else {
                // Follow
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

    // NEW: Load more posts function
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
        // Remove existing notifications
        const existingNotifications = document.querySelectorAll('.custom-notification');
        existingNotifications.forEach(notification => notification.remove());
        
        const notification = document.createElement('div');
        notification.className = `custom-notification ${type}`;
        
        const bgColor = type === 'error' ? '#dc2626' : 
                       type === 'success' ? '#16a34a' : 
                       type === 'warning' ? '#f59e0b' : '#3b82f6';
        
        notification.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            background: ${bgColor};
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
        `;
        
        const icon = type === 'error' ? 'alert-circle' : 
                    type === 'success' ? 'check-circle' : 
                    type === 'warning' ? 'alert-triangle' : 'info';
        
        notification.innerHTML = `
            <svg class="feather" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke="white" stroke-width="2">
                ${this.getNotificationIcon(icon)}
            </svg>
            <span>${message}</span>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
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
            
            // Get user data
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
        
        // Build post content HTML
        let postContentHTML = '';
        
        // IMAGE AT THE TOP
        if (post.imageUrl) {
            const imageUrl = String(post.imageUrl).trim();
            if (imageUrl && imageUrl !== 'null' && imageUrl !== 'undefined' && imageUrl.length > 10) {
                postContentHTML += `
                    <div class="post-image-container">
                        <img src="${imageUrl}" alt="Post image" class="post-image">
                    </div>
                `;
            }
        }
        
        // CAPTION BELOW IMAGE
        if (post.caption) {
            postContentHTML += `<p class="post-caption">${post.caption}</p>`;
        }
        
        const isLiked = this.likedPosts.has(post.id);
        
        container.innerHTML = `
            <div class="post-item">
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
                    <button class="post-action like-btn ${isLiked ? 'liked' : ''}" data-post-id="${post.id}">
                        <i class="${isLiked ? 'fas' : 'far'} fa-heart"></i> 
                        <span class="like-count">${this.formatCount(post.likes || 0)}</span>
                    </button>
                    <button class="post-action comment-btn active" data-post-id="${post.id}">
                        <i class="far fa-comment"></i> 
                        <span class="comment-count">${this.formatCount(post.commentsCount || 0)}</span>
                    </button>
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

        // Add event listeners
        const likeBtn = container.querySelector('.like-btn');
        const sendCommentBtn = container.querySelector('#sendCommentBtn');
        const commentInput = container.querySelector('#commentInput');

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
    }

    // Load comments for comments page
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
                const comment = doc.data();
                const user = usersData[comment.userId] || {};
                const commentElement = this.createCommentElement(comment, user);
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

        // If not appending, clear container first
        if (!append) {
            const existingPosts = container.querySelectorAll('.post-item:not(.loading)');
            existingPosts.forEach(post => post.remove());
        }

        const userIds = [...new Set(posts.map(post => post.userId))];
        const usersData = await this.getUsersData(userIds);

        for (const post of posts) {
            const user = usersData[post.userId] || {};
            const postElement = await this.createPostElement(post, user, post.id); // Changed to async
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

    // UPDATED: Create post element WITH follow button next to username
    async createPostElement(post, user, postId) {
        const postDiv = document.createElement('div');
        postDiv.className = 'post-item';
        
        const userId = user.id || post.userId;
        const userName = user.name || 'Unknown User';
        const userProfileImage = user.profileImage || 'images/default-profile.jpg';
        
        // Check if current user is following this post's author
        let isFollowing = false;
        if (this.currentUser && userId !== this.currentUser.uid) {
            isFollowing = await this.checkIfFollowing(userId);
        }
        
        // Build post content HTML
        let postContentHTML = '';
        
        // IMAGE AT THE TOP
        if (post.imageUrl) {
            const imageUrl = String(post.imageUrl).trim();
            if (imageUrl && imageUrl !== 'null' && imageUrl !== 'undefined' && imageUrl.length > 10) {
                postContentHTML += `
                    <div class="post-image-container">
                        <img src="${imageUrl}" alt="Post image" class="post-image">
                    </div>
                `;
            }
        }
        
        // CAPTION BELOW IMAGE
        if (post.caption) {
            postContentHTML += `<p class="post-caption">${post.caption}</p>`;
        }
        
        const isLiked = this.likedPosts.has(postId);
        
        // Follow button (only show if not current user's post)
        const followButton = (this.currentUser && userId !== this.currentUser.uid) ? `
            <button class="follow-btn-post ${isFollowing ? 'following' : ''}" 
                    data-user-id="${userId}" 
                    data-following="${isFollowing}">
                <i class="fas ${isFollowing ? 'fa-user-check' : 'fa-user-plus'}"></i> 
                ${isFollowing ? 'Following' : 'Follow'}
            </button>
        ` : '';
        
        postDiv.innerHTML = `
            <div class="post-header">
                <img src="${userProfileImage}" 
                     alt="${userName}" class="post-author-avatar">
                <div class="post-author-info">
                    <h4>${userName}</h4>
                    <span class="post-time">${this.formatTime(post.createdAt)}</span>
                </div>
                ${followButton}
            </div>
            
            <div class="post-content">
                ${postContentHTML}
            </div>
            
            <div class="post-actions">
                <button class="post-action like-btn ${isLiked ? 'liked' : ''}" data-post-id="${postId}">
                    <i class="${isLiked ? 'fas' : 'far'} fa-heart"></i> 
                    <span class="like-count">${this.formatCount(post.likes || 0)}</span>
                </button>
                <button class="post-action comment-btn" data-post-id="${postId}">
                    <i class="far fa-comment"></i> 
                    <span class="comment-count">${this.formatCount(post.commentsCount || 0)}</span>
                </button>
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

        if (likeBtn) {
            likeBtn.addEventListener('click', () => this.handleLike(postId, likeBtn));
        }

        if (commentBtn) {
            // Now it shows/hides comments inline
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

        if (followBtn) {
            // Event listener is already handled in setupGlobalEventListeners
            followBtn.addEventListener('click', (e) => e.stopPropagation());
        }

        // Mark post as viewed when displayed
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
                const comment = doc.data();
                const user = usersData[comment.userId] || {};
                const commentElement = this.createCommentElement(comment, user);
                commentsList.appendChild(commentElement);
            });
        } catch (error) {
            console.error('Error loading comments:', error);
            commentsList.innerHTML = '<div class="error">Error loading comments</div>';
        }
    }

    createCommentElement(comment, user) {
        const commentDiv = document.createElement('div');
        commentDiv.className = 'comment-item';
        commentDiv.innerHTML = `
            <div class="comment-header">
                <img src="${user.profileImage || 'images/default-profile.jpg'}" 
                     alt="${user.name}" class="comment-avatar">
                <div class="comment-info">
                    <strong>${user.name || 'Unknown User'}</strong>
                    <span class="comment-time">${this.formatTime(comment.createdAt)}</span>
                </div>
            </div>
            <div class="comment-text">${comment.text}</div>
        `;
        return commentDiv;
    }

    // UPDATED: Handle add comment
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
            // Add comment to subcollection
            await addDoc(collection(db, 'posts', postId, 'comments'), {
                userId: this.currentUser.uid,
                text: commentText,
                createdAt: serverTimestamp()
            });

            // Update comments count
            const postRef = doc(db, 'posts', postId);
            await updateDoc(postRef, {
                commentsCount: increment(1),
                updatedAt: serverTimestamp()
            });

            // Clear input
            commentInput.value = '';
            
            // Reload comments based on page
            if (isCommentsPage) {
                await this.loadCommentsForPage(postId);
                // Update comment count in UI
                const commentCount = document.querySelector('.comment-count');
                if (commentCount) {
                    const currentCount = parseInt(commentCount.textContent) || 0;
                    commentCount.textContent = this.formatCount(currentCount + 1);
                }
            } else {
                await this.loadComments(postId);
                // Update comment count in UI for posts page
                const commentCount = document.querySelector(`.comment-btn[data-post-id="${postId}"] .comment-count`);
                if (commentCount) {
                    const currentCount = parseInt(commentCount.textContent) || 0;
                    commentCount.textContent = this.formatCount(currentCount + 1);
                }
            }

        } catch (error) {
            console.error('Error adding comment:', error);
            alert('Error adding comment: ' + error.message);
        }
    }

    // FIXED: HandleLike function
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

    // Update new posts count
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

    // Display new posts count
    displayNewPostsCount(count) {
        // Find or create indicator
        let indicator = document.getElementById('newPostsIndicator');
        
        if (!indicator) {
            // Try to find a place to put it
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

    // Setup Create Post
    setupCreatePost() {
        const form = document.getElementById('createPostForm');
        if (!form) return;

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.createPost();
        });

        const imageInput = document.getElementById('postImage');
        if (imageInput) {
            imageInput.addEventListener('change', (e) => {
                this.previewImage(e.target.files[0]);
            });
        }

        const captionInput = document.getElementById('postCaption');
        const charCount = document.getElementById('charCount');
        if (captionInput && charCount) {
            captionInput.addEventListener('input', function() {
                charCount.textContent = this.value.length;
            });
        }
    }

    previewImage(file) {
        const preview = document.getElementById('imagePreview');
        if (!preview) return;

        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
                preview.style.display = 'block';
            };
            reader.readAsDataURL(file);
        } else {
            preview.style.display = 'none';
        }
    }

    async uploadImageToCloudinary(file) {
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
                        'Accept': 'application/json'
                    }
                }
            );
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Cloudinary error: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (!data.secure_url) {
                throw new Error('No secure_url in Cloudinary response');
            }
            
            return data.secure_url;
        } catch (error) {
            throw new Error(`Failed to upload image: ${error.message}`);
        }
    }

    async createPost() {
        if (!this.currentUser) {
            alert('You must be logged in to create a post.');
            return;
        }

        const caption = document.getElementById('postCaption')?.value.trim() || '';
        const imageFile = document.getElementById('postImage')?.files[0];

        if (!caption && !imageFile) {
            alert('Please add a caption or image to your post.');
            return;
        }

        try {
            let imageUrl = null;
            
            if (imageFile) {
                const submitBtn = document.querySelector('#createPostForm button[type="submit"]');
                const originalText = submitBtn.innerHTML;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
                submitBtn.disabled = true;
                
                try {
                    imageUrl = await this.uploadImageToCloudinary(imageFile);
                } catch (uploadError) {
                    throw uploadError;
                }
                
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }

            const postData = {
                userId: this.currentUser.uid,
                caption: caption,
                imageUrl: imageUrl,
                likes: 0,
                commentsCount: 0,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };

            await addDoc(collection(db, 'posts'), postData);
            
            alert('Post created successfully!');
            window.location.href = 'posts.html';
            
        } catch (error) {
            alert('Error creating post: ' + error.message);
            
            const submitBtn = document.querySelector('#createPostForm button[type="submit"]');
            if (submitBtn) {
                submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Post Now';
                submitBtn.disabled = false;
            }
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
        
        let postContentHTML = '';
        
        if (post.imageUrl) {
            const imageUrl = String(post.imageUrl).trim();
            if (imageUrl && imageUrl !== 'null' && imageUrl !== 'undefined' && imageUrl.length > 10) {
                postContentHTML += `
                    <div class="post-image-container">
                        <img src="${imageUrl}" alt="Post image" class="post-image">
                    </div>
                `;
            }
        }
        
        if (post.caption) {
            postContentHTML += `<p class="post-caption">${post.caption}</p>`;
        }
        
        const isLiked = this.likedPosts.has(postId);
        
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
                <button class="post-action like-btn ${isLiked ? 'liked' : ''}" data-post-id="${postId}">
                    <i class="${isLiked ? 'fas' : 'far'} fa-heart"></i> <span class="like-count">${this.formatCount(post.likes || 0)}</span>
                </button>
                <button class="post-action comment-btn" data-post-id="${postId}">
                    <i class="far fa-comment"></i> <span class="comment-count">${this.formatCount(post.commentsCount || 0)}</span>
                </button>
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

            <div id="deletePostModal" class="modal" style="display: none;">
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
        
        if (post.imageUrl) {
            const imageUrl = String(post.imageUrl).trim();
            if (imageUrl && imageUrl !== 'null' && imageUrl !== 'undefined' && imageUrl.length > 10) {
                postContentHTML += `
                    <div class="post-image-container">
                        <img src="${imageUrl}" alt="Post image" class="post-image">
                    </div>
                `;
            }
        }
        
        if (post.caption) {
            const shortCaption = post.caption.length > 100 ? 
                post.caption.substring(0, 100) + '...' : post.caption;
            postContentHTML += `<p class="post-caption">${shortCaption}</p>`;
        }
        
        postDiv.innerHTML = `
            <div class="post-header">
                <img src="${userData.profileImage || 'images/default-profile.jpg'}" 
                     alt="${userData.name}" class="post-author-avatar">
                <div class="post-author-info">
                    <h4>${userData.name || 'You'}</h4>
                    <span class="post-time">${this.formatTime(post.createdAt)}</span>
                </div>
                <div class="post-stats">
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
        
        if (post.imageUrl) {
            const imageUrl = String(post.imageUrl).trim();
            if (imageUrl && imageUrl !== 'null' && imageUrl !== 'undefined' && imageUrl.length > 10) {
                previewHTML += `
                    <div class="preview-image">
                        <img src="${imageUrl}" alt="Post image">
                    </div>
                `;
            }
        }
        
        if (post.caption) {
            previewHTML += `<div class="preview-caption">${post.caption}</div>`;
        }

        preview.innerHTML = previewHTML;
        modal.style.display = 'block';

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

        const modalActions = modal.querySelector('.modal-actions');
        if (modalActions) {
            modalActions.style.position = 'sticky';
            modalActions.style.bottom = '0';
            modalActions.style.background = 'var(--discord-darker)';
            modalActions.style.padding = '20px';
            modalActions.style.borderTop = '1px solid var(--discord-border)';
            modalActions.style.marginTop = 'auto';
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
}

// Initialize social manager
const socialManager = new SocialManager();
window.socialManager = socialManager;