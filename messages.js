// messages.js - Complete Chat Notification System for Median.co
class ChatNotificationService {
    constructor() {
        this.isMedianApp = window.cordova !== undefined || 
                          navigator.userAgent.includes('Median');
        this.currentUser = window.currentUser;
        this.db = window.db;
        this.unsubscribeMessages = null;
        this.init();
    }

    async init() {
        if (this.isMedianApp) {
            console.log('Median.co app - enabling chat notifications');
            await this.setupMedianNotifications();
        }
        
        // Start listening for new messages
        this.startMessageListener();
    }

    setupMedianNotifications() {
        document.addEventListener('deviceready', () => {
            console.log('Median.co push notifications ready');
            this.requestPermission();
        }, false);
    }

    async requestPermission() {
        try {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                console.log('Chat notifications enabled');
            }
        } catch (error) {
            console.log('Notification permission error:', error);
        }
    }

    // 🔥 THIS IS THE KEY FUNCTION - Listens for new messages
    startMessageListener() {
        if (!this.currentUser || !this.db) {
            console.log('Waiting for user authentication...');
            setTimeout(() => this.startMessageListener(), 2000);
            return;
        }

        try {
            // Listen to all conversations where user is participant
            const threadsQuery = query(
                collection(this.db, 'conversations'),
                where('participants', 'array-contains', this.currentUser.uid)
            );

            this.unsubscribeMessages = onSnapshot(threadsQuery, (snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'modified') {
                        this.checkNewMessages(change.doc);
                    }
                });
            });

            console.log('Message listener started - will notify of new messages');

        } catch (error) {
            console.error('Error starting message listener:', error);
        }
    }

    // Check for new messages in a conversation
    async checkNewMessages(conversationDoc) {
        try {
            const conversation = conversationDoc.data();
            const lastMessage = conversation.lastMessage;
            
            // Don't notify if user sent the message
            if (lastMessage.senderId === this.currentUser.uid) return;

            // Get partner info
            const partnerId = conversation.participants.find(id => id !== this.currentUser.uid);
            const partnerData = await this.getUserData(partnerId);

            // Show notification
            this.showChatNotification(
                partnerData.name || 'Someone',
                lastMessage.text || 'New message',
                partnerData.profileImage,
                conversationDoc.id
            );

        } catch (error) {
            console.error('Error checking new messages:', error);
        }
    }

    // Get user data for notification
    async getUserData(userId) {
        try {
            const userDoc = await getDoc(doc(this.db, 'users', userId));
            return userDoc.exists() ? userDoc.data() : { name: 'Unknown User' };
        } catch (error) {
            return { name: 'Unknown User' };
        }
    }

    // Show chat notification
    showChatNotification(senderName, message, image, conversationId) {
        const title = `💌 ${senderName}`;
        const body = message.length > 50 ? message.substring(0, 50) + '...' : message;

        if (this.isMedianApp && window.cordova && window.cordova.plugins.notification) {
            // Median.co notification
            cordova.plugins.notification.local.schedule({
                title: title,
                text: body,
                foreground: true,
                data: { conversationId: conversationId },
                smallIcon: 'res://icon',
                icon: image || 'res://icon'
            });
        } else if ('Notification' in window && Notification.permission === 'granted') {
            // Browser notification
            const notification = new Notification(title, {
                body: body,
                icon: image || '/icon-192.png',
                badge: '/badge-72.png',
                data: { conversationId: conversationId }
            });

            notification.onclick = () => {
                window.focus();
                window.location.href = `chat.html?id=${conversationId}`;
                notification.close();
            };
        } else {
            // Fallback
            console.log('New message from:', senderName, '-', message);
        }
    }

    // Manual test function
    testNotification() {
        this.showChatNotification(
            'Test User', 
            'This is a test message to check notifications!', 
            null, 
            'test123'
        );
    }

    // Cleanup
    destroy() {
        if (this.unsubscribeMessages) {
            this.unsubscribeMessages();
        }
    }
}

// Initialize when app is ready
let chatNotifier;

document.addEventListener('DOMContentLoaded', function() {
    // Wait for Firebase auth
    const checkAuth = setInterval(() => {
        if (window.currentUser && window.db) {
            clearInterval(checkAuth);
            chatNotifier = new ChatNotificationService();
            window.chatNotifier = chatNotifier;
            
            // Add test button
            const testBtn = document.createElement('button');
            testBtn.textContent = '🔔 Test Chat Notification';
            testBtn.className = 'btn btn-secondary';
            testBtn.onclick = () => chatNotifier.testNotification();
            document.body.appendChild(testBtn);
        }
    }, 1000);
});

// Cleanup on page leave
window.addEventListener('beforeunload', () => {
    if (chatNotifier) {
        chatNotifier.destroy();
    }
});

