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
    orderBy,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
const auth = getAuth(app);
const db = getFirestore(app);

// Global variables
let currentUser = null;
let unsubscribeNotifications = null;
let checkIntervals = [];
let dismissedNotifications = new Set();
let viewedPosts = new Set();

// Initialize notification system
function initNotificationSystem() {
    
    
    // Load dismissed notifications and viewed posts
    loadDismissedNotifications();
    
    // Wait for auth state
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            loadViewedPosts();
            
            setupNotificationListener();
            setupNotificationCreators();
            updateNotificationBadge();
            
            // If on notification page, load notifications
            if (window.location.pathname.includes('notification.html')) {
                loadNotificationsForPage();
            }
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
        localStorage.setItem(`viewedPosts_${currentUser.uid}`, JSON.stringify([...viewedPosts]));
    } catch (error) {
        console.error('Error saving viewed posts:', error);
    }
}

// Load notifications for notification.html page
async function loadNotificationsForPage() {
    if (!currentUser) return;

    try {
        // SIMPLE QUERY - No composite index needed
        const notificationsQuery = query(
            collection(db, 'notifications'),
            where('userId', '==', currentUser.uid)
        );

        const notificationsSnap = await getDocs(notificationsQuery);
        
        // Sort by timestamp in memory (no index needed)
        const sortedNotifications = notificationsSnap.docs.sort((a, b) => {
            const timeA = a.data().timestamp?.toDate?.() || new Date(0);
            const timeB = b.data().timestamp?.toDate?.() || new Date(0);
            return timeB - timeA; // Descending order
        });
        
        displayNotifications(sortedNotifications);
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

    const notificationsHTML = notificationDocs.map(doc => {
        const notification = doc.data();
        const timeAgo = formatTime(notification.timestamp);
        const iconClass = getNotificationIcon(notification.type);
        const unreadClass = notification.read ? '' : 'unread';
        const unreadDot = notification.read ? '' : '<div class="unread-dot"></div>';
        
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

    // Notification item click
    document.querySelectorAll('.notification-item').forEach(item => {
        item.addEventListener('click', () => {
            const notificationId = item.dataset.id;
            markNotificationAsRead(notificationId);
        });
    });
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

// Setup notification creators (messages, likes, and posts)
function setupNotificationCreators() {
    if (!currentUser) return;

    // Clear any existing intervals
    checkIntervals.forEach(interval => clearInterval(interval));
    checkIntervals = [];

    // Check for new messages every 30 seconds
    const messageInterval = setInterval(() => {
        checkForNewMessages();
    }, 30000);
    checkIntervals.push(messageInterval);

    // Check for new likes every 30 seconds
    const likeInterval = setInterval(() => {
        checkForNewLikes();
    }, 30000);
    checkIntervals.push(likeInterval);

    // Check for new posts every 30 seconds
    const postInterval = setInterval(() => {
        checkForNewPosts();
    }, 30000);
    checkIntervals.push(postInterval);

    // Initial check
    checkForNewMessages();
    checkForNewLikes();
    checkForNewPosts();
}

// Check for new messages
async function checkForNewMessages() {
    if (!currentUser) return;

    try {
        // SIMPLE QUERY - No composite index needed
        const threadsQuery = query(
            collection(db, 'conversations'),
            where('participants', 'array-contains', currentUser.uid)
        );

        const threadsSnap = await getDocs(threadsQuery);

        for (const threadDoc of threadsSnap.docs) {
            const thread = threadDoc.data();
            const partnerId = thread.participants.find(id => id !== currentUser.uid);
            
            if (partnerId) {
                // Get all messages and filter in memory
                const messagesQuery = collection(db, 'conversations', threadDoc.id, 'messages');
                const messagesSnap = await getDocs(messagesQuery);

                for (const messageDoc of messagesSnap.docs) {
                    const message = messageDoc.data();
                    // Check if message is from partner and unread
                    if (message.senderId === partnerId && !message.read) {
                        await createMessageNotification(messageDoc.id, partnerId, message);
                        break; // Only create one notification per conversation
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error checking messages:', error);
    }
}

// Create message notification
async function createMessageNotification(messageId, partnerId, message) {
    try {
        const existing = await checkExistingNotification('message', messageId, partnerId);
        if (existing) return;

        const senderDoc = await getDoc(doc(db, 'users', partnerId));
        if (!senderDoc.exists()) return;

        const senderData = senderDoc.data();
        const messageText = message.text ? 
            (message.text.length > 50 ? message.text.substring(0, 50) + '...' : message.text) : 
            'sent you a photo/video';

        await addDoc(collection(db, 'notifications'), {
            type: 'message',
            title: 'New Message',
            message: `${senderData.name || 'Someone'} ${messageText}`,
            senderId: partnerId,
            relatedId: messageId,
            userId: currentUser.uid,
            timestamp: serverTimestamp(),
            read: false
        });

    } catch (error) {
        console.error('Error creating message notification:', error);
    }
}

// Check for new likes
async function checkForNewLikes() {
    if (!currentUser) return;

    try {
        // SIMPLE QUERY - No composite index needed
        const likesQuery = collection(db, 'users', currentUser.uid, 'likes');
        const likesSnap = await getDocs(likesQuery);

        for (const likeDoc of likesSnap.docs) {
            const likeData = likeDoc.data();
            await createLikeNotification(likeDoc.id, likeData.userId);
        }
    } catch (error) {
        console.error('Error checking likes:', error);
    }
}

// Create like notification
async function createLikeNotification(likeId, likerId) {
    try {
        const existing = await checkExistingNotification('like', likeId, likerId);
        if (existing) return;

        const likerDoc = await getDoc(doc(db, 'users', likerId));
        if (!likerDoc.exists()) return;

        const likerData = likerDoc.data();

        await addDoc(collection(db, 'notifications'), {
            type: 'like',
            title: 'New Like',
            message: `${likerData.name || 'Someone'} liked your profile`,
            senderId: likerId,
            relatedId: likeId,
            userId: currentUser.uid,
            timestamp: serverTimestamp(),
            read: false
        });

    } catch (error) {
        console.error('Error creating like notification:', error);
    }
}

// Check for new posts
async function checkForNewPosts() {
    if (!currentUser) return;

    try {
        // SIMPLE QUERY - No composite index needed
        const postsQuery = collection(db, 'posts');
        const postsSnap = await getDocs(postsQuery);

        for (const postDoc of postsSnap.docs) {
            const post = postDoc.data();
            const postId = postDoc.id;
            
            // Skip if post is from current user or already viewed
            if (post.userId === currentUser.uid || viewedPosts.has(postId)) {
                continue;
            }

            // Skip if this notification was already dismissed
            if (dismissedNotifications.has(`post_${postId}`)) {
                continue;
            }

            // Check if user is not on posts page
            const currentPage = window.location.pathname.split('/').pop().split('.')[0];
            
            if (currentPage !== 'posts') {
                await createPostNotification(postId, post);
            }
        }
    } catch (error) {
        console.error('Error checking posts:', error);
    }
}

// Create post notification
async function createPostNotification(postId, post) {
    try {
        const existing = await checkExistingNotification('post', postId, post.userId);
        if (existing) return;

        const authorDoc = await getDoc(doc(db, 'users', post.userId));
        if (!authorDoc.exists()) return;

        const authorData = authorDoc.data();
        const postText = post.caption ? 
            (post.caption.length > 50 ? post.caption.substring(0, 50) + '...' : post.caption) : 
            'created a new post';

        await addDoc(collection(db, 'notifications'), {
            type: 'post',
            title: 'New Post',
            message: `${authorData.name || 'Someone'} ${postText}`,
            senderId: post.userId,
            relatedId: postId,
            userId: currentUser.uid,
            timestamp: serverTimestamp(),
            read: false
        });

    } catch (error) {
        console.error('Error creating post notification:', error);
    }
}

// Check if notification already exists
async function checkExistingNotification(type, relatedId, senderId) {
    try {
        // SIMPLE QUERY - No composite index needed
        const notificationsQuery = query(
            collection(db, 'notifications'),
            where('userId', '==', currentUser.uid)
        );

        const notificationsSnap = await getDocs(notificationsQuery);

        // Filter in memory
        return notificationsSnap.docs.some(doc => {
            const data = doc.data();
            return data.type === type && 
                   data.relatedId === relatedId && 
                   data.senderId === senderId;
        });
    } catch (error) {
        console.error('Error checking existing notification:', error);
        return false;
    }
}

// Setup notification listener
function setupNotificationListener() {
    if (!currentUser) return;

    if (unsubscribeNotifications) {
        unsubscribeNotifications();
    }

    try {
        // SIMPLE QUERY - Only filter by userId, no composite index
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
            
            const unreadNotifications = allNotifications.filter(notification => !notification.read);
            const sortedNotifications = allNotifications.sort((a, b) => {
                const timeA = a.timestamp?.toDate?.() || new Date(0);
                const timeB = b.timestamp?.toDate?.() || new Date(0);
                return timeB - timeA; // Descending order
            });
            
            const unreadCount = unreadNotifications.length;
            
            updateNotificationBadge(unreadCount);
            localStorage.setItem(`notification_count_${currentUser.uid}`, unreadCount);
            
            // Reload notifications if on notification page
            if (window.location.pathname.includes('notification.html')) {
                displayNotifications(sortedNotifications.map((notification, index) => ({
                    id: notification.id,
                    data: () => notification
                })));
            }
            
            // Show toast for new notifications
            if (!window.location.pathname.includes('notification.html')) {
                snapshot.docChanges().forEach(change => {
                    if (change.type === 'added') {
                        const notification = change.doc.data();
                        if (!notification.read) {
                            showRealTimeToast(notification);
                        }
                    }
                });
            }
        }, (error) => {
            console.error('Notification listener error:', error);
            const cachedCount = localStorage.getItem(`notification_count_${currentUser.uid}`) || 0;
            updateNotificationBadge(parseInt(cachedCount));
        });

    } catch (error) {
        console.error('Error setting up notification listener:', error);
        const cachedCount = localStorage.getItem(`notification_count_${currentUser.uid}`) || 0;
        updateNotificationBadge(parseInt(cachedCount));
    }
}

// Update notification badge
function updateNotificationBadge(count) {
    if (count === undefined) {
        count = localStorage.getItem(`notification_count_${currentUser ? currentUser.uid : 'anonymous'}`) || 0;
        count = parseInt(count);
    }

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

// Show real-time toast notification
function showRealTimeToast(notification) {
    const toast = document.createElement('div');
    toast.className = `notification-toast ${notification.type}`;
    toast.innerHTML = `
        <div class="toast-icon">
            <i class="${getNotificationIcon(notification.type)}"></i>
        </div>
        <div class="toast-content">
            <div class="toast-title">${notification.title}</div>
            <div class="toast-message">${notification.message}</div>
        </div>
        <button class="toast-close">&times;</button>
        <div class="swipe-indicator">
            <i class="fas fa-chevron-up"></i>
        </div>
    `;

    if (!document.getElementById('notification-toast-styles')) {
        const styles = document.createElement('style');
        styles.id = 'notification-toast-styles';
        styles.textContent = `
            .notification-toast {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                background: var(--bg-card);
                padding: 15px 20px;
                border-bottom: 1px solid var(--border-color);
                z-index: 10001;
                display: flex;
                align-items: center;
                gap: 12px;
                cursor: pointer;
                font-family: 'Inter', sans-serif;
                transform: translateY(-100%);
                animation: slideInTop 0.4s ease forwards;
                box-shadow: var(--shadow-lg);
                transition: transform 0.3s ease;
                border-left: 4px solid;
            }
            .notification-toast.message {
                border-left-color: var(--primary);
                background: linear-gradient(135deg, var(--bg-card), rgba(179, 0, 75, 0.1));
            }
            .notification-toast.like {
                border-left-color: var(--secondary);
                background: linear-gradient(135deg, var(--bg-card), rgba(139, 0, 0, 0.1));
            }
            .notification-toast.post {
                border-left-color: var(--accent);
                background: linear-gradient(135deg, var(--bg-card), rgba(68, 68, 68, 0.1));
            }
            .toast-icon {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 16px;
                flex-shrink: 0;
            }
            .notification-toast.message .toast-icon {
                background: linear-gradient(135deg, var(--primary), var(--primary-dark));
                color: var(--text-primary);
            }
            .notification-toast.like .toast-icon {
                background: linear-gradient(135deg, var(--secondary), #5a0000);
                color: var(--text-primary);
            }
            .notification-toast.post .toast-icon {
                background: linear-gradient(135deg, var(--accent), #2a2a2a);
                color: var(--text-primary);
            }
            .toast-content {
                flex: 1;
                min-width: 0;
            }
            .toast-title {
                font-weight: 600;
                margin-bottom: 4px;
                color: var(--text-primary);
                font-size: 14px;
            }
            .toast-message {
                color: var(--text-secondary);
                font-size: 13px;
                line-height: 1.3;
            }
            .toast-close {
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid var(--border-color);
                border-radius: 50%;
                font-size: 16px;
                cursor: pointer;
                color: var(--text-secondary);
                padding: 0;
                width: 28px;
                height: 28px;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                transition: all 0.2s ease;
            }
            .toast-close:hover {
                background: var(--primary);
                color: var(--text-primary);
                border-color: var(--primary);
            }
            .swipe-indicator {
                position: absolute;
                bottom: 5px;
                left: 50%;
                transform: translateX(-50%);
                color: var(--text-light);
                font-size: 12px;
                opacity: 0.6;
                animation: bounce 2s infinite;
            }
            @keyframes slideInTop {
                from { transform: translateY(-100%); }
                to { transform: translateY(0); }
            }
            @keyframes slideOutTop {
                from { transform: translateY(0); }
                to { transform: translateY(-100%); }
            }
            @keyframes bounce {
                0%, 20%, 50%, 80%, 100% {
                    transform: translateX(-50%) translateY(0);
                }
                40% {
                    transform: translateX(-50%) translateY(-3px);
                }
                60% {
                    transform: translateX(-50%) translateY(-2px);
                }
            }
            .notification-toast.swiping {
                transition: transform 0.1s ease;
            }
            .notification-toast.dismissing {
                animation: slideOutTop 0.3s ease forwards;
            }
        `;
        document.head.appendChild(styles);
    }

    document.body.appendChild(toast);

    // Auto-dismiss after 5 seconds
    const autoDismiss = setTimeout(() => {
        dismissToast(toast);
    }, 5000);

    // Touch/Mouse events for swipe dismissal
    let startY = 0;
    let currentY = 0;
    let isSwiping = false;

    function handleTouchStart(e) {
        startY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
        isSwiping = true;
        toast.classList.add('swiping');
        clearTimeout(autoDismiss);
    }

    function handleTouchMove(e) {
        if (!isSwiping) return;
        
        currentY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
        const diffY = startY - currentY;
        
        if (diffY > 0) { // Only allow swiping up
            const translateY = Math.max(-100, -diffY);
            toast.style.transform = `translateY(${translateY}px)`;
        }
    }

    function handleTouchEnd() {
        if (!isSwiping) return;
        
        isSwiping = false;
        toast.classList.remove('swiping');
        
        const diffY = startY - currentY;
        const swipeThreshold = 50;
        
        if (diffY > swipeThreshold) {
            dismissToast(toast);
        } else {
            // Return to original position
            toast.style.transform = 'translateY(0)';
            // Restart auto-dismiss
            setTimeout(() => dismissToast(toast), 4000);
        }
    }

    // Add event listeners for both touch and mouse
    toast.addEventListener('touchstart', handleTouchStart, { passive: true });
    toast.addEventListener('touchmove', handleTouchMove, { passive: true });
    toast.addEventListener('touchend', handleTouchEnd);
    
    toast.addEventListener('mousedown', handleTouchStart);
    toast.addEventListener('mousemove', handleTouchMove);
    toast.addEventListener('mouseup', handleTouchEnd);
    toast.addEventListener('mouseleave', handleTouchEnd);

    // Close button
    toast.querySelector('.toast-close').addEventListener('click', (e) => {
        e.stopPropagation();
        dismissToast(toast);
    });

    // Click to navigate
    toast.addEventListener('click', (e) => {
        if (!isSwiping) {
            if (notification.type === 'message' && notification.senderId) {
                window.location.href = `chat.html?id=${notification.senderId}`;
            } else if (notification.type === 'post' && notification.senderId) {
                window.location.href = 'posts.html';
                // Mark post as viewed when clicking notification
                viewedPosts.add(notification.relatedId);
                saveViewedPosts();
                dismissedNotifications.add(`post_${notification.relatedId}`);
                saveDismissedNotifications();
            } else if (notification.senderId) {
                window.location.href = `profile.html?id=${notification.senderId}`;
            } else {
                window.location.href = 'notification.html';
            }
            dismissToast(toast);
        }
    });

    function dismissToast(toastElement) {
        toastElement.classList.add('dismissing');
        setTimeout(() => {
            if (toastElement.parentNode) {
                toastElement.parentNode.removeChild(toastElement);
            }
        }, 300);
    }
}

// Get notification icon
function getNotificationIcon(type) {
    switch (type) {
        case 'message': return 'fas fa-comment-alt';
        case 'like': return 'fas fa-heart';
        case 'post': return 'fas fa-newspaper';
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
    }
};