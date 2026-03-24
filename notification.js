// notifications.js - COMPLETE WORKING CODE with your VAPID key

// Your VAPID key (already inserted)
const VAPID_KEY = "BLQsknL2NRqCD5ZT5LwOSIloH9hnuAXk-0_I3N-AU3CV37CO871Uo508Own-XFzmrt-kQICZZ9mERyCP3C5nKTQ";

// Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyC9jF-ocy6HjsVzWVVlAyXW-4aIFgA79-A",
    authDomain: "crypto-6517d.firebaseapp.com",
    projectId: "crypto-6517d",
    storageBucket: "crypto-6517d.firebasestorage.app",
    messagingSenderId: "60263975159",
    appId: "1:60263975159:web:bd53dcaad86d6ed9592bf2"
};

// Imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js";
import { getFirestore, collection, query, where, getDocs, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Initialize
const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);
const db = getFirestore(app);
const auth = getAuth(app);

let currentUser = null;

// Main function
async function initPushNotifications() {
    console.log("🚀 Starting push notifications...");
    
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            console.log("✅ User:", user.email);
            await setupPushNotifications();
        }
    });
}

async function setupPushNotifications() {
    // 1. Check if notifications are supported
    if (!("Notification" in window)) {
        console.log("❌ Notifications not supported");
        return;
    }
    
    if (!("serviceWorker" in navigator)) {
        console.log("❌ Service workers not supported");
        return;
    }
    
    // 2. Request permission
    if (Notification.permission !== "granted") {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
            console.log("❌ Permission denied");
            alert("Please allow notifications to receive messages");
            return;
        }
    }
    console.log("✅ Permission granted");
    
    // 3. Register service worker
    let registration;
    try {
        registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
        console.log("✅ Service worker registered");
    } catch (error) {
        console.error("❌ Service worker error:", error);
        alert("Could not register service worker. Make sure firebase-messaging-sw.js is in your root folder.");
        return;
    }
    
    // 4. Get FCM token
    try {
        const token = await getToken(messaging, {
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: registration
        });
        
        if (token) {
            console.log("✅ Token obtained:", token.substring(0, 20) + "...");
            await saveToken(token);
        } else {
            console.log("❌ No token received");
        }
    } catch (error) {
        console.error("❌ Token error:", error);
    }
    
    // 5. Listen for foreground messages
    onMessage(messaging, (payload) => {
        console.log("📨 Message received:", payload);
        showNotification(payload);
    });
    
    // 6. Listen for Firestore changes
    listenForNewMessages();
    
    // 7. Send test notification
    if (Notification.permission === "granted") {
        setTimeout(() => {
            new Notification("Notifications Ready! 🎉", {
                body: "You will now receive notifications for new messages"
            });
        }, 2000);
    }
}

async function saveToken(token) {
    if (!currentUser) return;
    
    try {
        const tokenRef = doc(db, "fcm_tokens", currentUser.uid);
        await setDoc(tokenRef, {
            userId: currentUser.uid,
            token: token,
            updatedAt: new Date().toISOString()
        }, { merge: true });
        console.log("✅ Token saved to Firestore");
    } catch (error) {
        console.error("❌ Save error:", error);
    }
}

function showNotification(payload) {
    const title = payload.notification?.title || "New Message";
    const body = payload.notification?.body || "";
    
    // Show in-app notification
    const div = document.createElement("div");
    div.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: white;
        border-left: 4px solid #4a90e2;
        padding: 12px 16px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        max-width: 320px;
        cursor: pointer;
        animation: slideIn 0.3s ease;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    div.innerHTML = `
        <strong style="display: block; margin-bottom: 4px; font-size: 14px;">${escapeHtml(title)}</strong>
        <p style="margin: 0; font-size: 13px; color: #666;">${escapeHtml(body)}</p>
    `;
    
    // Add animation style
    if (!document.querySelector("#notif-style")) {
        const style = document.createElement("style");
        style.id = "notif-style";
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(div);
    
    // Auto remove
    setTimeout(() => {
        if (div.parentNode) div.remove();
    }, 5000);
    
    // Click to remove
    div.onclick = () => div.remove();
}

async function listenForNewMessages() {
    if (!currentUser) return;
    
    console.log("👂 Listening for new messages...");
    
    const q = query(
        collection(db, "conversations"),
        where("participants", "array-contains", currentUser.uid)
    );
    
    onSnapshot(q, async (snapshot) => {
        for (const change of snapshot.docChanges()) {
            if (change.type === "modified") {
                const thread = change.doc.data();
                const partnerId = thread.participants.find(id => id !== currentUser.uid);
                
                if (partnerId) {
                    // Get unread messages
                    const messagesRef = collection(db, "conversations", change.doc.id, "messages");
                    const unreadQuery = query(
                        messagesRef,
                        where("senderId", "==", partnerId),
                        where("read", "==", false)
                    );
                    
                    const unreadMessages = await getDocs(unreadQuery);
                    
                    for (const msgDoc of unreadMessages.docs) {
                        const message = msgDoc.data();
                        
                        // Get sender name
                        const userQuery = query(collection(db, "users"), where("__name__", "==", partnerId));
                        const userDocs = await getDocs(userQuery);
                        let senderName = "Someone";
                        userDocs.forEach(doc => {
                            senderName = doc.data().name || "Someone";
                        });
                        
                        let messageText = message.text || "";
                        if (message.imageUrl) messageText = "📷 Sent a photo";
                        if (message.audioUrl) messageText = "🎤 Sent a voice message";
                        if (message.videoUrl) messageText = "🎥 Sent a video";
                        
                        // Show browser notification
                        if (Notification.permission === "granted") {
                            new Notification(`💬 ${senderName}`, {
                                body: messageText,
                                icon: "/favicon.ico",
                                tag: `msg_${partnerId}`,
                                data: { url: `/chat.html?id=${partnerId}` }
                            });
                        }
                    }
                }
            }
        }
    });
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

// Start everything
initPushNotifications();

// Export
window.pushNotifications = { initPushNotifications };