// notifications.js - Enhanced with background detection
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, 
    doc, 
    getDoc,
    onSnapshot,
    collection,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { 
    getAuth, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

class NotificationService {
    constructor() {
        this.currentUser = null;
        this.firebaseConfig = {
            apiKey: "AIzaSyC9uL_BX14Z6rRpgG4MT9Tca1opJl8EviQ",
            authDomain: "dating-connect.firebaseapp.com",
            projectId: "dating-connect",
            storageBucket: "dating-connect.appspot.com",
            messagingSenderId: "1062172180210",
            appId: "1:1062172180210:web:0c9b3c1578a5dbae58da6b"
        };
        this.listeners = [];
        this.notificationPermission = null;
        this.isTabActive = true;
        this.backgroundNotifications = [];
        
        console.log('🚀 Starting Enhanced Notification Service...');
        this.init();
    }

    async init() {
        try {
            // Initialize Firebase
            this.app = initializeApp(this.firebaseConfig, 'NotificationService');
            this.db = getFirestore(this.app);
            this.auth = getAuth(this.app);
            
            // Set up visibility detection
            this.setupVisibilityDetection();
            
            // Request notification permission
            await this.requestNotificationPermission();
            
            // Wait for auth state
            onAuthStateChanged(this.auth, (user) => {
                this.currentUser = user;
                if (user) {
                    console.log('✅ User logged in:', user.email);
                    this.setupFirebaseListeners();
                } else {
                    console.log('❌ User logged out');
                    this.cleanupListeners();
                }
            });
            
        } catch (error) {
            console.error('❌ Failed to initialize notification service:', error);
        }
    }

    setupVisibilityDetection() {
        // Detect when tab becomes visible/hidden
        document.addEventListener('visibilitychange', () => {
            this.isTabActive = !document.hidden;
            console.log('👀 Tab visibility changed:', this.isTabActive ? 'ACTIVE' : 'BACKGROUND');
            
            // If tab becomes active, show any queued notifications
            if (this.isTabActive && this.backgroundNotifications.length > 0) {
                console.log('🔄 Showing queued notifications:', this.backgroundNotifications.length);
                this.processQueuedNotifications();
            }
        });

        // Also detect page focus/blur
        window.addEventListener('focus', () => {
            this.isTabActive = true;
            console.log('🎯 Page focused');
        });

        window.addEventListener('blur', () => {
            this.isTabActive = false;
            console.log('🔲 Page blurred');
        });

        // Detect window minimize/restore
        window.addEventListener('beforeunload', () => {
            console.log('⚠️ Page unloading - stopping notifications');
        });
    }

    async requestNotificationPermission() {
        if (!('Notification' in window)) {
            console.log('❌ Browser does not support notifications');
            this.notificationPermission = 'unsupported';
            return;
        }

        try {
            this.notificationPermission = Notification.permission;
            
            if (this.notificationPermission === 'default') {
                console.log('🔄 Requesting notification permission...');
                
                // Only request permission when user is interacting with the page
                const requestPermission = () => {
                    Notification.requestPermission().then(permission => {
                        this.notificationPermission = permission;
                        console.log('📢 Notification permission:', permission);
                    });
                };
                
                // Request on user interaction (better UX)
                document.addEventListener('click', requestPermission, { once: true });
                console.log('💡 Click anywhere to enable notifications');
            }
            
        } catch (error) {
            console.error('❌ Error requesting notification permission:', error);
            this.notificationPermission = 'error';
        }
    }

    setupFirebaseListeners() {
        if (!this.currentUser) {
            console.log('❌ No user logged in');
            return;
        }

        console.log('🔄 Setting up Firebase listeners for user:', this.currentUser.uid);
        this.setupConversationListeners();
    }

    setupConversationListeners() {
        const conversationsQuery = query(
            collection(this.db, 'conversations'),
            where('participants', 'array-contains', this.currentUser.uid)
        );

        const conversationListener = onSnapshot(conversationsQuery, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    console.log('💬 New conversation detected');
                    this.handleNewConversation(change.doc.data(), change.doc.id);
                }
            });
        });

        this.listeners.push(conversationListener);
        this.setupMessageListenersForAllConversations();
    }

    async setupMessageListenersForAllConversations() {
        try {
            const conversationsQuery = query(
                collection(this.db, 'conversations'),
                where('participants', 'array-contains', this.currentUser.uid)
            );

            const conversationsSnap = await getDocs(conversationsQuery);
            console.log(`📁 Found ${conversationsSnap.size} conversations`);
            
            conversationsSnap.forEach((conversationDoc) => {
                const conversation = conversationDoc.data();
                this.listenToConversationMessages(conversationDoc.id, conversation);
            });
            
        } catch (error) {
            console.error('❌ Error setting up message listeners:', error);
        }
    }

    listenToConversationMessages(conversationId, conversation) {
        const messagesQuery = query(
            collection(this.db, 'conversations', conversationId, 'messages'),
            where('senderId', '!=', this.currentUser.uid),
            where('read', '==', false)
        );

        const messageListener = onSnapshot(messagesQuery, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    console.log('✉️ New message detected - Tab active:', this.isTabActive);
                    this.handleNewMessage(change.doc.data(), conversation);
                }
            });
        });

        this.listeners.push(messageListener);
    }

    async handleNewMessage(message, conversation) {
        if (message.senderId === this.currentUser.uid || message.read) {
            return;
        }

        try {
            console.log('🔄 Processing new message...');
            
            const senderDoc = await getDoc(doc(this.db, 'users', message.senderId));
            if (!senderDoc.exists()) return;

            const senderData = senderDoc.data();
            
            // Show notification (works in background too!)
            await this.showSmartNotification(
                `💌 ${senderData.name || 'Someone'}`,
                this.formatMessagePreview(message),
                `chat.html?id=${message.senderId}`,
                'message'
            );
            
        } catch (error) {
            console.error('❌ Error handling new message:', error);
        }
    }

    async handleNewConversation(conversation, conversationId) {
        const partnerId = conversation.participants.find(id => id !== this.currentUser.uid);
        if (!partnerId) return;

        try {
            const partnerDoc = await getDoc(doc(this.db, 'users', partnerId));
            if (!partnerDoc.exists()) return;

            const partnerData = partnerDoc.data();

            await this.showSmartNotification(
                '✨ New Match!',
                `You matched with ${partnerData.name || 'Someone'}`,
                `chat.html?id=${partnerId}`,
                'match'
            );
            
        } catch (error) {
            console.error('❌ Error handling new conversation:', error);
        }
    }

    async showSmartNotification(title, body, url, type = 'message') {
        // Check if notifications are supported and permitted
        if (!('Notification' in window) || this.notificationPermission !== 'granted') {
            console.log('❌ Notifications not available');
            return false;
        }

        // If tab is not active, we can show the notification
        // Browser will display it even if tab is in background!
        if (!this.isTabActive) {
            console.log('📱 Tab is in background - showing notification');
        } else {
            console.log('💻 Tab is active - showing notification');
        }

        try {
            const notification = new Notification(title, {
                body: body,
                icon: this.getNotificationIcon(type),
                badge: '/icons/badge-72x72.png',
                tag: `dating-${type}-${Date.now()}`, // Unique tag to avoid grouping
                requireInteraction: type === 'match', // Matches require click
                silent: false,
                vibrate: [200, 100, 200] // Vibration pattern for mobile
            });

            // Handle notification click
            notification.onclick = () => {
                console.log('🎯 Notification clicked');
                window.focus();
                if (url) {
                    window.location.href = url;
                }
                notification.close();
            };

            // Handle notification close
            notification.onclose = () => {
                console.log('✅ Notification closed');
            };

            // Handle notification error
            notification.onerror = (error) => {
                console.error('❌ Notification error:', error);
            };

            // Auto close after different times based on type
            const autoCloseTime = type === 'match' ? 10000 : 7000; // 10s for matches, 7s for messages
            setTimeout(() => {
                if (notification.close) {
                    notification.close();
                }
            }, autoCloseTime);

            console.log('✅ Notification sent in background:', !this.isTabActive, '- Type:', type);
            return true;
            
        } catch (error) {
            console.error('❌ Error showing notification:', error);
            
            // Queue notification for when tab becomes active
            if (!this.isTabActive) {
                this.backgroundNotifications.push({ title, body, url, type });
                console.log('📥 Queued notification for when tab becomes active');
            }
            
            return false;
        }
    }

    getNotificationIcon(type) {
        const icons = {
            message: '/icons/message-icon.png',
            match: '/icons/heart-icon.png', 
            default: '/icons/icon-192x192.png'
        };
        return icons[type] || icons.default;
    }

    processQueuedNotifications() {
        while (this.backgroundNotifications.length > 0) {
            const notification = this.backgroundNotifications.shift();
            this.showSmartNotification(notification.title, notification.body, notification.url, notification.type);
        }
    }

    formatMessagePreview(message) {
        if (message.text) {
            return message.text.length > 50 ? message.text.substring(0, 50) + '...' : message.text;
        } else if (message.imageUrl) {
            return '📷 Sent a photo';
        } else if (message.audioUrl) {
            return '🎤 Voice message';
        } else if (message.videoUrl) {
            return '🎥 Video message';
        } else {
            return 'New message';
        }
    }

    // Test function that simulates background behavior
    async testBackgroundNotification() {
        console.log('🧪 Testing background notification...');
        
        // Simulate receiving a message while in background
        const result = await this.showSmartNotification(
            'Test Background Notification 🔔',
            'This simulates a message received while app is in background!',
            'mingle.html',
            'message'
        );
        
        if (result) {
            console.log('✅ Background test notification sent!');
            console.log('💡 Now switch to another tab or minimize browser to see it work');
        }
        
        return result;
    }

    // Check if we're currently in background
    isInBackground() {
        return !this.isTabActive;
    }

    getPermissionStatus() {
        return this.notificationPermission;
    }

    cleanupListeners() {
        this.listeners.forEach(unsubscribe => {
            if (unsubscribe && typeof unsubscribe === 'function') {
                unsubscribe();
            }
        });
        this.listeners = [];
    }
}

// Auto-initialize
console.log('🚀 Initializing Enhanced Notification Service...');
const notificationService = new NotificationService();

// Make it globally available for testing
window.notificationService = notificationService;

// Test after initialization
setTimeout(() => {
    console.log('⏰ Notification service ready!');
    console.log('💡 Try these tests:');
    console.log('   - notificationService.testBackgroundNotification()');
    console.log('   - Then switch to another tab to see notifications work');
}, 3000);