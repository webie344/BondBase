// messages.js - Independent Message & Post Notification System
// Load this file BEFORE any other scripts in your HTML

(function() {
    // Firebase configuration
    const firebaseConfig = {
        apiKey: "AIzaSyC9uL_BX14Z6rRpgG4MT9Tca1opJl8EviQ",
        authDomain: "dating-connect.firebaseapp.com",
        projectId: "dating-connect",
        storageBucket: "dating-connect.appspot.com",
        messagingSenderId: "1062172180210",
        appId: "1:1062172180210:web:0c9b3c1578a5dbae58da6b"
    };

    // Global variables for notification system
    let currentUser = null;
    let db = null;
    let unsubscribeNewMessages = null;
    let unsubscribeNewPosts = null;
    let notificationTimer = null;
    let unreadMessages = new Map();
    let unreadPosts = new Map();
    let dismissedNotifications = new Set();
    let viewedPosts = new Set();

    // Load Firebase scripts dynamically
    function loadFirebaseDependencies() {
        return new Promise((resolve) => {
            // Check if Firebase is already loaded
            if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
                resolve();
                return;
            }

            // Load Firebase App
            const firebaseAppScript = document.createElement('script');
            firebaseAppScript.src = 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js';
            document.head.appendChild(firebaseAppScript);

            firebaseAppScript.onload = function() {
                // Load Firebase Auth
                const firebaseAuthScript = document.createElement('script');
                firebaseAuthScript.src = 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js';
                document.head.appendChild(firebaseAuthScript);

                firebaseAuthScript.onload = function() {
                    // Load Firebase Firestore
                    const firebaseFirestoreScript = document.createElement('script');
                    firebaseFirestoreScript.src = 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js';
                    document.head.appendChild(firebaseFirestoreScript);

                    firebaseFirestoreScript.onload = function() {
                        // Initialize Firebase
                        firebase.initializeApp(firebaseConfig);
                        db = firebase.firestore();
                        resolve();
                    };
                };
            };
        });
    }

    // Initialize the notification system
    function initNotificationSystem() {
        loadFirebaseDependencies().then(() => {
            const auth = firebase.auth();
            
            // Load dismissed notifications and viewed posts from localStorage
            loadDismissedNotifications();
            loadViewedPosts();
            
            // Listen for auth state changes
            auth.onAuthStateChanged((user) => {
                if (user) {
                    currentUser = user;
                    startMessageListener(user);
                    startPostListener(user);
                } else {
                    currentUser = null;
                    stopMessageListener();
                    stopPostListener();
                    clearNotificationTimer();
                    // Clear all notifications
                    clearAllNotifications();
                }
            });
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
            // Error handling without console output
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
            // Error handling without console output
        }
    }

    // Save dismissed notifications to localStorage
    function saveDismissedNotifications() {
        try {
            localStorage.setItem('dismissedNotifications', JSON.stringify(Array.from(dismissedNotifications)));
        } catch (error) {
            // Error handling without console output
        }
    }

    // Save viewed posts to localStorage
    function saveViewedPosts() {
        if (!currentUser) return;
        try {
            localStorage.setItem(`viewedPosts_${currentUser.uid}`, JSON.stringify([...viewedPosts]));
        } catch (error) {
            // Error handling without console output
        }
    }

    // Start listening for new messages
    function startMessageListener(user) {
        if (!user || !db) return;
        
        // Query for conversations where the current user is a participant
        const conversationsQuery = db.collection('conversations')
            .where('participants', 'array-contains', user.uid);
        
        unsubscribeNewMessages = conversationsQuery.onSnapshot(async (snapshot) => {
            for (const change of snapshot.docChanges()) {
                if (change.type === 'modified' || change.type === 'added') {
                    try {
                        const conversation = change.doc.data();
                        const conversationId = change.doc.id;
                        const lastMessage = conversation.lastMessage;
                        
                        // Check if this is a new message from another user
                        if (lastMessage && lastMessage.senderId !== user.uid) {
                            const partnerId = conversation.participants.find(id => id !== user.uid);
                            
                            // Skip if this notification was already dismissed
                            if (dismissedNotifications.has(`${partnerId}_${lastMessage.timestamp}`)) {
                                continue;
                            }
                            
                            // Check if user is on a different page (not the chat page with this user)
                            const urlParams = new URLSearchParams(window.location.search);
                            const currentChatId = urlParams.get('id');
                            const currentPage = window.location.pathname.split('/').pop().split('.')[0];
                            
                            if (currentPage !== 'chat' || currentChatId !== partnerId) {
                                // Store message with timestamp and conversation ID
                                unreadMessages.set(partnerId, {
                                    timestamp: new Date(),
                                    message: lastMessage,
                                    conversationId: conversationId,
                                    messageTimestamp: lastMessage.timestamp
                                });
                                
                                // Get partner info for notification
                                try {
                                    const partnerDoc = await db.collection('users').doc(partnerId).get();
                                    
                                    if (partnerDoc.exists) {
                                        const partnerData = partnerDoc.data();
                                        
                                        // Show notification if not already dismissed
                                        if (!dismissedNotifications.has(`${partnerId}_${lastMessage.timestamp}`)) {
                                            showMessageNotification(partnerData, lastMessage, partnerId, conversationId, lastMessage.timestamp);
                                        }
                                    }
                                } catch (error) {
                                    // Error handling without console output
                                }
                            }
                        }
                    } catch (error) {
                        // Error handling without console output
                    }
                }
            }
        }, (error) => {
            // Error handling without console output
        });
    }

    // Start listening for new posts
    function startPostListener(user) {
        if (!user || !db) return;
        
        // Query for posts ordered by creation time
        const postsQuery = db.collection('posts')
            .orderBy('createdAt', 'desc');
        
        unsubscribeNewPosts = postsQuery.onSnapshot(async (snapshot) => {
            for (const change of snapshot.docChanges()) {
                if (change.type === 'added') {
                    try {
                        const post = change.doc.data();
                        const postId = change.doc.id;
                        
                        // Skip if post is from current user or already viewed
                        if (post.userId === user.uid || viewedPosts.has(postId)) {
                            continue;
                        }
                        
                        // Skip if this notification was already dismissed
                        if (dismissedNotifications.has(`post_${postId}`)) {
                            continue;
                        }
                        
                        // Check if user is not on posts page
                        const currentPage = window.location.pathname.split('/').pop().split('.')[0];
                        
                        if (currentPage !== 'posts') {
                            // Store post with timestamp
                            unreadPosts.set(postId, {
                                timestamp: new Date(),
                                post: post,
                                postId: postId
                            });
                            
                            // Get author info for notification
                            try {
                                const authorDoc = await db.collection('users').doc(post.userId).get();
                                
                                if (authorDoc.exists) {
                                    const authorData = authorDoc.data();
                                    
                                    // Show notification if not already dismissed
                                    if (!dismissedNotifications.has(`post_${postId}`)) {
                                        showPostNotification(authorData, post, postId);
                                    }
                                }
                            } catch (error) {
                                // Error handling without console output
                            }
                        }
                    } catch (error) {
                        // Error handling without console output
                    }
                }
            }
        }, (error) => {
            // Error handling without console output
        });
    }

    // Stop listening for new messages
    function stopMessageListener() {
        if (unsubscribeNewMessages) {
            unsubscribeNewMessages();
            unsubscribeNewMessages = null;
        }
    }

    // Stop listening for new posts
    function stopPostListener() {
        if (unsubscribeNewPosts) {
            unsubscribeNewPosts();
            unsubscribeNewPosts = null;
        }
    }

    // Mark a conversation as read in Firebase
    async function markConversationAsRead(conversationId, userId, messageTimestamp) {
        if (!db) return false;
        
        try {
            // Get all messages from this conversation
            const messagesRef = db.collection('conversations').doc(conversationId).collection('messages');
            const messagesSnapshot = await messagesRef.get();
            
            // Mark all unread messages from partner as read
            const batch = db.batch();
            let markedCount = 0;
            
            messagesSnapshot.forEach(doc => {
                const message = doc.data();
                // Mark messages from partner that are unread
                if (message.senderId !== userId && !message.read) {
                    batch.update(doc.ref, { read: true });
                    markedCount++;
                }
            });
            
            if (markedCount > 0) {
                await batch.commit();
            }
            
            // Add to dismissed notifications with message timestamp
            if (messageTimestamp) {
                const partnerId = conversationId.split('_').find(id => id !== userId);
                dismissedNotifications.add(`${partnerId}_${messageTimestamp}`);
                saveDismissedNotifications();
            }
            
            return true;
        } catch (error) {
            return false;
        }
    }

    // Mark a post as viewed
    function markPostAsViewed(postId) {
        viewedPosts.add(postId);
        saveViewedPosts();
        // Remove from unread posts
        unreadPosts.delete(postId);
    }

    // Show message notification
    function showMessageNotification(partnerData, message, partnerId, conversationId, messageTimestamp) {
        // Create notification element if it doesn't exist
        let notification = document.querySelector(`.message-notification[data-partner-id="${partnerId}"]`);
        
        if (!notification) {
            notification = document.createElement('div');
            notification.className = 'message-notification';
            notification.dataset.partnerId = partnerId;
            notification.dataset.conversationId = conversationId;
            notification.dataset.messageTimestamp = messageTimestamp;
            
            // Determine message preview text
            let messageText = '';
            if (message.text) {
                messageText = message.text.length > 50 
                    ? message.text.substring(0, 50) + '...' 
                    : message.text;
            } else if (message.imageUrl) {
                messageText = 'Sent an image';
            } else if (message.audioUrl) {
                messageText = 'Sent a voice message';
            } else {
                messageText = 'Sent a message';
            }
            
            notification.innerHTML = `
                <div class="notification-content">
                    <img src="${partnerData.profileImage || 'images-default-profile.jpg'}" 
                         alt="${partnerData.name}" class="notification-avatar">
                    <div class="notification-details">
                        <h4>${partnerData.name || 'Unknown'}</h4>
                        <p>${messageText}</p>
                    </div>
                    <button class="notification-close">&times;</button>
                </div>
                <div class="notification-actions">
                    <button class="notification-action view-chat">View Chat</button>
                    <button class="notification-action mark-read">Mark as Read</button>
                </div>
            `;
            
            // Add styles if not already added
            addNotificationStyles();
            
            // Add to page
            document.body.appendChild(notification);
            
            // Set up event listeners
            notification.querySelector('.notification-close').addEventListener('click', () => {
                dismissNotification(notification, partnerId);
            });
            
            notification.querySelector('.view-chat').addEventListener('click', () => {
                window.location.href = `chat.html?id=${partnerId}`;
                dismissNotification(notification, partnerId);
            });
            
            notification.querySelector('.mark-read').addEventListener('click', async () => {
                const success = await markConversationAsRead(conversationId, currentUser.uid, messageTimestamp);
                if (success) {
                    dismissNotification(notification, partnerId, true, messageTimestamp);
                } else {
                    alert('Failed to mark message as read. Please try again.');
                }
            });
        }
        
        // Show notification with animation
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);
        
        // Set timer to show notification again in 2 minutes if not dismissed
        if (!notificationTimer) {
            startNotificationTimer();
        }
    }

    // Show post notification
    function showPostNotification(authorData, post, postId) {
        // Create notification element if it doesn't exist
        let notification = document.querySelector(`.post-notification[data-post-id="${postId}"]`);
        
        if (!notification) {
            notification = document.createElement('div');
            notification.className = 'post-notification';
            notification.dataset.postId = postId;
            
            // Determine post preview text
            let postText = '';
            if (post.caption) {
                postText = post.caption.length > 50 
                    ? post.caption.substring(0, 50) + '...' 
                    : post.caption;
            } else if (post.imageUrl) {
                postText = 'Shared a photo';
            } else {
                postText = 'Created a new post';
            }
            
            notification.innerHTML = `
                <div class="notification-content">
                    <img src="${authorData.profileImage || 'images-default-profile.jpg'}" 
                         alt="${authorData.name}" class="notification-avatar">
                    <div class="notification-details">
                        <h4>${authorData.name || 'Unknown'}</h4>
                        <p>${postText}</p>
                    </div>
                    <button class="notification-close">&times;</button>
                </div>
                <div class="notification-actions">
                    <button class="notification-action view-post">View Post</button>
                    <button class="notification-action mark-viewed">Mark as Viewed</button>
                </div>
            `;
            
            // Add styles if not already added
            addNotificationStyles();
            
            // Add to page
            document.body.appendChild(notification);
            
            // Set up event listeners
            notification.querySelector('.notification-close').addEventListener('click', () => {
                dismissPostNotification(notification, postId);
            });
            
            notification.querySelector('.view-post').addEventListener('click', () => {
                window.location.href = 'posts.html';
                dismissPostNotification(notification, postId, true);
            });
            
            notification.querySelector('.mark-viewed').addEventListener('click', () => {
                markPostAsViewed(postId);
                dismissPostNotification(notification, postId, true);
            });
        }
        
        // Show notification with animation
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);
        
        // Set timer to show notification again in 2 minutes if not dismissed
        if (!notificationTimer) {
            startNotificationTimer();
        }
    }

    // Dismiss message notification
    function dismissNotification(notification, partnerId, markAsRead = false, messageTimestamp = null) {
        notification.classList.remove('show');
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
        
        if (markAsRead && messageTimestamp) {
            dismissedNotifications.add(`${partnerId}_${messageTimestamp}`);
            saveDismissedNotifications();
            // Remove from unread messages map
            unreadMessages.delete(partnerId);
        }
    }

    // Dismiss post notification
    function dismissPostNotification(notification, postId, markAsViewed = false) {
        notification.classList.remove('show');
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
        
        if (markAsViewed) {
            markPostAsViewed(postId);
            dismissedNotifications.add(`post_${postId}`);
            saveDismissedNotifications();
        } else {
            // Just dismiss without marking as viewed
            dismissedNotifications.add(`post_${postId}`);
            saveDismissedNotifications();
        }
    }

    // Start notification timer (shows notifications every 2 minutes)
    function startNotificationTimer() {
        notificationTimer = setInterval(() => {
            // Re-show notifications for unread messages that weren't dismissed
            unreadMessages.forEach(async (messageData, partnerId) => {
                // Only show if message is older than 2 minutes and not dismissed
                const messageTime = messageData.timestamp;
                const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
                
                if (messageTime < twoMinutesAgo && !dismissedNotifications.has(`${partnerId}_${messageData.messageTimestamp}`)) {
                    try {
                        const partnerDoc = await db.collection('users').doc(partnerId).get();
                        
                        if (partnerDoc.exists) {
                            const partnerData = partnerDoc.data();
                            showMessageNotification(partnerData, messageData.message, partnerId, messageData.conversationId, messageData.messageTimestamp);
                        }
                    } catch (error) {
                        // Error handling without console output
                    }
                }
            });

            // Re-show notifications for unread posts that weren't dismissed
            unreadPosts.forEach(async (postData, postId) => {
                // Only show if post is older than 2 minutes and not dismissed
                const postTime = postData.timestamp;
                const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
                
                if (postTime < twoMinutesAgo && !dismissedNotifications.has(`post_${postId}`)) {
                    try {
                        const authorDoc = await db.collection('users').doc(postData.post.userId).get();
                        
                        if (authorDoc.exists) {
                            const authorData = authorDoc.data();
                            showPostNotification(authorData, postData.post, postId);
                        }
                    } catch (error) {
                        // Error handling without console output
                    }
                }
            });
        }, 2 * 60 * 1000); // Check every 2 minutes
    }

    // Clear notification timer
    function clearNotificationTimer() {
        if (notificationTimer) {
            clearInterval(notificationTimer);
            notificationTimer = null;
        }
    }

    // Add notification styles to the page
    function addNotificationStyles() {
        if (document.getElementById('message-notification-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'message-notification-styles';
        styles.textContent = `
            .message-notification,
            .post-notification {
                position: fixed;
                top: 20px;
                right: 20px;
                width: 350px;
                background: var(--white, #ffffff);
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
                z-index: 10000;
                transform: translateX(400px);
                transition: transform 0.3s ease;
                overflow: hidden;
                border: 1px solid var(--border-color, #E9ECEF);
                color: var(--text-dark, #212529);
                font-family: 'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif;
                margin-bottom: 10px;
            }
            
            .post-notification {
                border-left: 4px solid var(--success-color, #28a745);
            }
            
            .message-notification.show,
            .post-notification.show {
                transform: translateX(0);
            }
            
            .notification-content {
                display: flex;
                align-items: center;
                padding: 15px;
                border-bottom: 1px solid var(--border-color, #E9ECEF);
                background: var(--white, #ffffff);
            }
            
            .notification-avatar {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                object-fit: cover;
                margin-right: 15px;
                border: 2px solid var(--primary-color, #FF6B35);
                box-shadow: 0 2px 8px rgba(255, 107, 53, 0.2);
            }
            
            .post-notification .notification-avatar {
                border-color: var(--success-color, #28a745);
                box-shadow: 0 2px 8px rgba(40, 167, 69, 0.2);
            }
            
            .notification-details {
                flex: 1;
            }
            
            .notification-details h4 {
                margin: 0 0 5px 0;
                font-size: 16px;
                color: var(--primary-color, #FF6B35);
                font-weight: 600;
            }
            
            .post-notification .notification-details h4 {
                color: var(--success-color, #28a745);
            }
            
            .notification-details p {
                margin: 0;
                font-size: 14px;
                color: var(--text-muted, #6C757D);
                line-height: 1.4;
            }
            
            .notification-close {
                background: none;
                border: none;
                font-size: 20px;
                cursor: pointer;
                color: var(--text-muted, #6C757D);
                padding: 0;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: var(--transition, all 0.3s ease);
                border-radius: 50%;
            }
            
            .notification-close:hover {
                color: var(--primary-color, #FF6B35);
                background-color: var(--orange-pastel, #FFE8E0);
            }
            
            .post-notification .notification-close:hover {
                color: var(--success-color, #28a745);
                background-color: rgba(40, 167, 69, 0.1);
            }
            
            .notification-actions {
                display: flex;
                padding: 12px 15px;
                gap: 10px;
                background:  whitesmoke;
            }
            
            .notification-action {
                flex: 1;
                padding: 8px 12px;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 600;
                transition: var(--transition, all 0.3s ease);
            }
            
            .notification-action.view-chat,
            .notification-action.view-post {
                background: linear-gradient(135deg, var(--orange-pastel, #FFE8E0), #FF6B35), var(--orange-light, #FF8E53));
                color: black;
                box-shadow: 0 2px 8px rgba(255, 107, 53, 0.3);
            }
            
            .post-notification .notification-action.view-post {
                background:  #FF6B9D;
                box-shadow: 0 2px 8px rgba(40, 167, 69, 0.3);
            }
            
            .notification-action.view-chat:hover,
            .notification-action.view-post:hover {
                background: linear-gradient(135deg, var(--orange-dark, #E55A2B), var(--primary-color, #FF6B35));
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(255, 107, 53, 0.4);
            }
            
            .post-notification .notification-action.view-post:hover {
                background: linear-gradient(135deg, var(--success-dark, #218838), var(--success-color, #28a745));
                box-shadow: 0 4px 12px rgba(40, 167, 69, 0.4);
            }
            
            .notification-action.mark-read,
            .notification-action.mark-viewed {
                background-color: var(--white, #ffffff);
                color: var(--text-dark, #212529);
                border: 1px solid var(--border-color, #E9ECEF);
            }
            
            .notification-action.mark-read:hover,
            .notification-action.mark-viewed:hover {
                background-color: var(--orange-pastel, #FFE8E0);
                border-color: var(--primary-color, #FF6B35);
                color: var(--primary-color, #FF6B35);
                transform: translateY(-2px);
            }
            
            .post-notification .notification-action.mark-viewed:hover {
                background-color: rgba(40, 167, 69, 0.1);
                border-color: var(--success-color, #28a745);
                color: var(--success-color, #28a745);
            }
            
            /* Animation for notification appearance */
            @keyframes notificationSlideIn {
                from {
                    transform: translateX(400px);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            
            .message-notification.show,
            .post-notification.show {
                animation: notificationSlideIn 0.3s ease-out;
            }
            
            /* Hover effect for entire notification */
            .message-notification:hover,
            .post-notification:hover {
                box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
                transform: translateX(0) translateY(-2px);
            }
            
            /* Responsive design */
            @media (max-width: 480px) {
                .message-notification,
                .post-notification {
                    width: calc(100% - 40px);
                    right: 20px;
                    left: 20px;
                    max-width: none;
                }
                
                .notification-actions {
                    flex-direction: row;
                }
                
                .notification-action {
                    font-size: 13px;
                    padding: 10px 8px;
                }
            }
            
            @media (max-width: 360px) {
                .notification-content {
                    padding: 12px;
                }
                
                .notification-actions {
                    padding: 10px 12px;
                }
                
                .notification-avatar {
                    width: 35px;
                    height: 35px;
                    margin-right: 12px;
                }
                
                .notification-details h4 {
                    font-size: 15px;
                }
                
                .notification-details p {
                    font-size: 13px;
                }
            }
            
            /* Dark mode support */
            @media (prefers-color-scheme: dark) {
                .message-notification,
                .post-notification {
                    background: var(--gray-dark, #495057);
                    border-color: var(--gray-medium, #6C757D);
                    color: var(--white, #ffffff);
                }
                
                .notification-content {
                    background: var(--gray-dark, #495057);
                }
                
                .notification-details p {
                    color: var(--gray-light, #E9ECEF);
                }
                
                .notification-actions {
                    background: var(--gray-medium, #6C757D);
                }
                
                .notification-action.mark-read,
                .notification-action.mark-viewed {
                    background-color: var(--gray-dark, #495057);
                    color: var(--white, #ffffff);
                    border-color: var(--gray-medium, #6C757D);
                }
                
                .notification-action.mark-read:hover,
                .notification-action.mark-viewed:hover {
                    background-color: var(--orange-pastel, #FFE8E0);
                    color: var(--primary-color, #FF6B35);
                }
                
                .post-notification .notification-action.mark-viewed:hover {
                    background-color: rgba(40, 167, 69, 0.1);
                    color: var(--success-color, #28a745);
                }
                
                .notification-close {
                    color: var(--gray-light, #E9ECEF);
                }
                
                .notification-close:hover {
                    color: var(--primary-color, #FF6B35);
                    background-color: rgba(255, 107, 53, 0.1);
                }
                
                .post-notification .notification-close:hover {
                    color: var(--success-color, #28a745);
                    background-color: rgba(40, 167, 69, 0.1);
                }
            }
        `;
        
        document.head.appendChild(styles);
    }

    // Clear all notifications
    function clearAllNotifications() {
        document.querySelectorAll('.message-notification, .post-notification').forEach(notification => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        });
        
        // Clear unread messages but keep dismissed notifications
        unreadMessages.clear();
        unreadPosts.clear();
    }

    // Initialize the notification system when the DOM is loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initNotificationSystem);
    } else {
        initNotificationSystem();
    }

    // Clear notifications when navigating to relevant pages
    window.addEventListener('load', function() {
        const currentPage = window.location.pathname.split('/').pop().split('.')[0];
        if (currentPage === 'messages' || currentPage === 'chat') {
            // Clear message notifications when on chat pages
            document.querySelectorAll('.message-notification').forEach(notification => {
                notification.classList.remove('show');
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            });
        }
        if (currentPage === 'posts') {
            // Clear post notifications when on posts page
            document.querySelectorAll('.post-notification').forEach(notification => {
                notification.classList.remove('show');
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            });
            // Mark all posts as viewed when visiting posts page
            if (currentUser) {
                const postsQuery = firebase.firestore().collection('posts');
                postsQuery.get().then(postsSnap => {
                    postsSnap.forEach(doc => {
                        viewedPosts.add(doc.id);
                    });
                    saveViewedPosts();
                });
            }
        }
    });

    // Export functions for potential external use
    window.MessageNotifications = {
        clearAll: clearAllNotifications,
        init: initNotificationSystem,
        markAsRead: markConversationAsRead,
        markPostAsViewed: markPostAsViewed
    };
})();