// notifications.js - Complete Out-of-App Push Notifications
// Independent file - includes everything it needs

// ============================================
// YOUR VAPID KEY (Already inserted)
// ============================================
const VAPID_KEY = "BLQsknL2NRqCD5ZT5LwOSIloH9hnuAXk-0_I3N-AU3CV37CO871Uo508Own-XFzmrt-kQICZZ9mERyCP3C5nKTQ";

// ============================================
// Firebase Configuration
// ============================================
const firebaseConfig = {
    apiKey: "AIzaSyC9jF-ocy6HjsVzWVVlAyXW-4aIFgA79-A",
    authDomain: "crypto-6517d.firebaseapp.com",
    projectId: "crypto-6517d",
    storageBucket: "crypto-6517d.firebasestorage.app",
    messagingSenderId: "60263975159",
    appId: "1:60263975159:web:bd53dcaad86d6ed9592bf2"
};

// ============================================
// All Firebase Imports (Everything included)
// ============================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js";
import { getFirestore, collection, query, where, getDocs, doc, setDoc, updateDoc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// ============================================
// Initialize Firebase (All in one place)
// ============================================
const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);
const db = getFirestore(app);
const auth = getAuth(app);

// ============================================
// Main Notification Manager
// ============================================
class PushNotificationManager {
    constructor() {
        this.token = null;
        this.swRegistration = null;
        this.currentUser = null;
        this.dailyNotificationTime = "09:00";
        this.lastDailyNotificationDate = null;
    }

    async init() {
        console.log("🚀 Initializing push notifications...");

        if (!("Notification" in window)) {
            console.warn("Browser doesn't support notifications");
            return false;
        }

        if (!("serviceWorker" in navigator)) {
            console.warn("Browser doesn't support service workers");
            return false;
        }

        onAuthStateChanged(auth, async (user) => {
            if (user) {
                this.currentUser = user;
                console.log("✅ User logged in:", user.email);
                await this.setupNotifications();
            } else {
                console.log("⏳ Waiting for user login...");
            }
        });

        return true;
    }

    async setupNotifications() {
        // Request permission
        if (Notification.permission !== "granted") {
            const permission = await Notification.requestPermission();
            if (permission !== "granted") {
                console.warn("❌ Notification permission denied");
                return;
            }
            console.log("✅ Notification permission granted");
        }

        // Register service worker
        await this.registerServiceWorker();

        // Get FCM token
        await this.getFCMToken();

        // Setup listeners
        this.setupMessageListeners();
        this.setupFirestoreListeners();
        this.startDailyNotifications();

        console.log("✅ Push notifications ready!");
    }

    async registerServiceWorker() {
        try {
            // Check if service worker file exists
            const swExists = await fetch("/firebase-messaging-sw.js").catch(() => null);
            
            if (!swExists || !swExists.ok) {
                console.log("📝 Creating service worker file...");
                await this.createServiceWorkerFile();
            }

            this.swRegistration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
            console.log("✅ Service worker registered");
            
            // Wait for service worker to be ready
            await navigator.serviceWorker.ready;
            
            return true;
        } catch (error) {
            console.error("❌ Service worker registration failed:", error);
            return false;
        }
    }

    async createServiceWorkerFile() {
        const swCode = `// firebase-messaging-sw.js - Auto-generated for your app
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

const firebaseConfig = {
    apiKey: "${firebaseConfig.apiKey}",
    authDomain: "${firebaseConfig.authDomain}",
    projectId: "${firebaseConfig.projectId}",
    storageBucket: "${firebaseConfig.storageBucket}",
    messagingSenderId: "${firebaseConfig.messagingSenderId}",
    appId: "${firebaseConfig.appId}"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('📱 Background notification received:', payload);
    
    const notificationTitle = payload.notification?.title || 'New Notification';
    const notificationOptions = {
        body: payload.notification?.body || 'You have a new update',
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        data: payload.data || {},
        requireInteraction: true,
        vibrate: [200, 100, 200],
        silent: false
    };
    
    self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    const data = event.notification.data;
    let urlToOpen = '/';
    
    if (data?.type === 'message' && data?.senderId) {
        urlToOpen = \`/chat.html?id=\${data.senderId}\`;
    } else if (data?.type === 'profile_view') {
        urlToOpen = '/profile.html';
    } else if (data?.click_action) {
        urlToOpen = data.click_action;
    }
    
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then((windowClients) => {
            for (let client of windowClients) {
                if (client.url.includes(urlToOpen) && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});
`;

        // Create and download the service worker file
        const blob = new Blob([swCode], { type: "application/javascript" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "firebase-messaging-sw.js";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        console.log("📥 Service worker file downloaded - please place it in your website root folder");
        alert("⚠️ IMPORTANT: A file 'firebase-messaging-sw.js' has been downloaded.\nPlease place this file in your website's root folder (same location as your index.html).");
        
        // Wait a bit for user to place the file
        await new Promise(resolve => setTimeout(resolve, 3000));
    }

    async getFCMToken() {
        try {
            this.token = await getToken(messaging, {
                vapidKey: VAPID_KEY,
                serviceWorkerRegistration: this.swRegistration
            });

            if (this.token) {
                console.log("✅ FCM token obtained");
                await this.saveTokenToFirestore(this.token);
                return this.token;
            } else {
                console.warn("⚠️ No FCM token available");
                return null;
            }
        } catch (error) {
            console.error("❌ Error getting FCM token:", error);
            return null;
        }
    }

    async saveTokenToFirestore(token) {
        if (!this.currentUser) return;

        try {
            const tokenRef = doc(db, "fcm_tokens", this.currentUser.uid);
            await setDoc(tokenRef, {
                userId: this.currentUser.uid,
                token: token,
                updatedAt: serverTimestamp(),
                createdAt: serverTimestamp()
            }, { merge: true });
            console.log("✅ Token saved to Firestore");
        } catch (error) {
            console.error("❌ Error saving token:", error);
        }
    }

    setupMessageListeners() {
        onMessage(messaging, (payload) => {
            console.log("📨 Foreground message:", payload);
            this.showInAppNotification(payload);
        });
    }

    showInAppNotification(payload) {
        const notification = payload.notification;
        if (!notification) return;

        const notificationDiv = document.createElement("div");
        notificationDiv.className = "in-app-notification";
        notificationDiv.innerHTML = `
            <div class="in-app-notification-content">
                <div class="in-app-notification-icon">
                    🔔
                </div>
                <div class="in-app-notification-text">
                    <strong>${this.escapeHtml(notification.title)}</strong>
                    <p>${this.escapeHtml(notification.body)}</p>
                </div>
                <button class="in-app-notification-close">×</button>
            </div>
        `;

        if (!document.getElementById("in-app-notification-styles")) {
            const styles = document.createElement("style");
            styles.id = "in-app-notification-styles";
            styles.textContent = `
                .in-app-notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 10000;
                    max-width: 350px;
                    width: 100%;
                    animation: slideInRight 0.3s ease;
                }
                .in-app-notification-content {
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    display: flex;
                    align-items: center;
                    padding: 12px;
                    border-left: 4px solid #4a90e2;
                }
                .in-app-notification-icon {
                    font-size: 24px;
                    margin-right: 12px;
                }
                .in-app-notification-text {
                    flex: 1;
                }
                .in-app-notification-text strong {
                    display: block;
                    margin-bottom: 4px;
                    font-size: 14px;
                }
                .in-app-notification-text p {
                    margin: 0;
                    font-size: 12px;
                    color: #666;
                }
                .in-app-notification-close {
                    background: none;
                    border: none;
                    font-size: 20px;
                    cursor: pointer;
                    color: #999;
                    padding: 0 5px;
                }
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(styles);
        }

        document.body.appendChild(notificationDiv);

        setTimeout(() => {
            notificationDiv.remove();
        }, 5000);

        const closeBtn = notificationDiv.querySelector(".in-app-notification-close");
        closeBtn.onclick = () => notificationDiv.remove();
    }

    setupFirestoreListeners() {
        if (!this.currentUser) return;

        // Listen for new messages
        const conversationsQuery = query(
            collection(db, "conversations"),
            where("participants", "array-contains", this.currentUser.uid)
        );

        onSnapshot(conversationsQuery, async (snapshot) => {
            for (const change of snapshot.docChanges()) {
                if (change.type === "modified") {
                    const thread = change.doc.data();
                    const partnerId = thread.participants.find(id => id !== this.currentUser.uid);
                    
                    if (partnerId) {
                        const messagesQuery = query(
                            collection(db, "conversations", change.doc.id, "messages"),
                            where("senderId", "==", partnerId),
                            where("read", "==", false)
                        );
                        
                        const messagesSnap = await getDocs(messagesQuery);
                        for (const messageDoc of messagesSnap) {
                            const message = messageDoc.data();
                            await this.notifyNewMessage(partnerId, message);
                        }
                    }
                }
            }
        });
    }

    async notifyNewMessage(partnerId, message) {
        try {
            // Get sender info
            const userDoc = await getDocs(query(collection(db, "users"), where("__name__", "==", partnerId)));
            let senderName = "Someone";
            userDoc.forEach(doc => {
                senderName = doc.data().name || "Someone";
            });

            let messageText = message.text;
            if (message.imageUrl) messageText = "📷 Sent a photo";
            if (message.audioUrl) messageText = "🎤 Sent a voice message";
            if (message.videoUrl) messageText = "🎥 Sent a video";

            // Show browser notification
            if (Notification.permission === "granted") {
                new Notification(`💬 New message from ${senderName}`, {
                    body: messageText,
                    icon: "/favicon.ico",
                    tag: `msg_${partnerId}_${Date.now()}`,
                    requireInteraction: true,
                    data: {
                        type: "message",
                        senderId: partnerId
                    }
                });
            }
        } catch (error) {
            console.error("Error sending notification:", error);
        }
    }

    startDailyNotifications() {
        setInterval(() => {
            const now = new Date();
            const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
            
            if (currentTime === this.dailyNotificationTime) {
                const today = now.toDateString();
                if (this.lastDailyNotificationDate !== today) {
                    this.lastDailyNotificationDate = today;
                    this.sendDailyTrendingNotification();
                }
            }
        }, 60000);
    }

    async sendDailyTrendingNotification() {
        try {
            const usersQuery = query(
                collection(db, "users"),
                where("__name__", "!=", this.currentUser?.uid || "")
            );
            const usersSnap = await getDocs(usersQuery);
            const activeCount = usersSnap.size;

            if (activeCount > 0 && Notification.permission === "granted") {
                new Notification("🔥 What's Trending Today!", {
                    body: `${activeCount} active profiles are waiting to connect with you!`,
                    icon: "/favicon.ico",
                    tag: "daily_trending",
                    data: {
                        type: "daily_trending",
                        click_action: "/mingle.html"
                    }
                });
            }
        } catch (error) {
            console.error("Error sending daily notification:", error);
        }
    }

    escapeHtml(text) {
        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
    }
}

// ============================================
// Auto-start everything
// ============================================
const pushNotifications = new PushNotificationManager();
pushNotifications.init();

// Export for use in other files
window.pushNotifications = pushNotifications;

