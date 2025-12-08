// emails.js - DEBUG VERSION
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    onSnapshot,
    doc,
    getDoc,
    orderBy,
    limit,
    getDocs,
    serverTimestamp,
    setDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

class EmailNotificationSystem {
    constructor() {
        this.currentUser = null;
        this.messageListeners = new Map();
        this.lastNotificationTimes = new Map();
        this.notificationCooldown = 120000;
        
        this.emailjsConfig = {
            serviceId: 'service_rm8jg5c',
            templateId: 'template_twd5lfs', 
            publicKey: 'tz7i-es4iduP7L5K6'
        };
        
        this.initializeSystem();
    }

    async initializeSystem() {
        console.log('🔧 Step 1: Starting system initialization...');
        try {
            await this.loadEmailJS();
            this.initializeFirebase();
            console.log('✅ System initialized successfully');
        } catch (error) {
            console.error('❌ System initialization failed:', error);
        }
    }

    loadEmailJS() {
        return new Promise((resolve, reject) => {
            console.log('🔧 Step 2: Loading EmailJS...');
            
            if (window.emailjs) {
                console.log('✅ EmailJS already loaded');
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js';
            script.onload = () => {
                console.log('✅ EmailJS script loaded');
                try {
                    window.emailjs.init(this.emailjsConfig.publicKey);
                    console.log('✅ EmailJS initialized with public key');
                    resolve();
                } catch (error) {
                    console.error('❌ EmailJS init failed:', error);
                    reject(error);
                }
            };
            script.onerror = (error) => {
                console.error('❌ Failed to load EmailJS script:', error);
                reject(error);
            };
            document.head.appendChild(script);
        });
    }

    initializeFirebase() {
        console.log('🔧 Step 3: Initializing Firebase...');
        const firebaseConfig = {
            apiKey: "AIzaSyC9uL_BX14Z6rRpgG4MT9Tca1opJl8EviQ",
            authDomain: "dating-connect.firebaseapp.com",
            projectId: "dating-connect",
            storageBucket: "dating-connect.appspot.com",
            messagingSenderId: "1062172180210",
            appId: "1:1062172180210:web:0c9b3c1578a5dbae58da6b"
        };

        try {
            const app = initializeApp(firebaseConfig, "EmailNotificationApp");
            this.auth = getAuth(app);
            this.db = getFirestore(app);
            console.log('✅ Firebase initialized');
            this.startSystem();
        } catch (error) {
            console.error('❌ Firebase init failed:', error);
        }
    }

    startSystem() {
        console.log('🔧 Step 4: Starting monitoring...');
        this.setupAuthMonitoring();
        this.setupVisibilityTracking();
    }

    setupAuthMonitoring() {
        console.log('🔧 Setting up auth monitoring...');
        onAuthStateChanged(this.auth, (user) => {
            if (user) {
                console.log('👤 User detected:', user.email);
                this.currentUser = user;
                this.startUserMonitoring(user);
            } else {
                console.log('👤 No user signed in');
                this.currentUser = null;
                this.stopAllMonitoring();
            }
        });
    }

    setupVisibilityTracking() {
        console.log('🔧 Setting up visibility tracking...');
        document.addEventListener('visibilitychange', () => {
            console.log('📱 Page visibility changed:', document.hidden ? 'hidden' : 'visible');
            if (this.currentUser) {
                this.updateUserPresence(this.currentUser.uid, document.hidden ? 'away' : 'online');
            }
        });
    }

    async startUserMonitoring(user) {
        if (this.messageListeners.has(user.uid)) {
            console.log('⚠️ Already monitoring user:', user.email);
            return;
        }

        console.log('🔍 Starting message monitoring for:', user.email);
        try {
            await this.updateUserPresence(user.uid, 'online');

            const threadsQuery = query(
                collection(this.db, 'conversations'),
                where('participants', 'array-contains', user.uid)
            );

            const unsubscribe = onSnapshot(threadsQuery, async (snapshot) => {
                console.log('📨 Conversation update detected, changes:', snapshot.docChanges().length);
                for (const docChange of snapshot.docChanges()) {
                    if (docChange.type === 'added' || docChange.type === 'modified') {
                        console.log('🔄 Processing conversation change:', docChange.type);
                        const thread = docChange.doc.data();
                        await this.handleNewMessage(thread, user.uid, docChange.doc.id);
                    }
                }
            });

            this.messageListeners.set(user.uid, unsubscribe);
            console.log('✅ Now monitoring messages for:', user.email);
            
        } catch (error) {
            console.error('❌ Error starting user monitoring:', error);
        }
    }

    async handleNewMessage(thread, userId, threadId) {
        console.log('💬 Checking for new messages in thread:', threadId);
        try {
            const messagesQuery = query(
                collection(this.db, 'conversations', threadId, 'messages'),
                orderBy('timestamp', 'desc'),
                limit(1)
            );
            
            const messagesSnap = await getDocs(messagesQuery);
            if (messagesSnap.empty) {
                console.log('⚠️ No messages found in thread');
                return;
            }

            const latestMessage = messagesSnap.docs[0].data();
            console.log('📩 Latest message:', latestMessage);
            
            if (latestMessage.senderId === userId) {
                console.log('⚠️ User sent this message themselves, skipping');
                return;
            }

            const isUserOffline = await this.isUserOffline(userId);
            const isPageVisible = !document.hidden;
            const isWindowFocused = document.hasFocus();
            
            console.log('🔍 User status:', {
                offline: isUserOffline,
                pageVisible: isPageVisible,
                windowFocused: isWindowFocused
            });

            if (isUserOffline || !isPageVisible || !isWindowFocused) {
                console.log('🚨 Conditions met - sending email notification');
                await this.sendEmailNotification(userId, latestMessage, thread);
            } else {
                console.log('⚠️ User is active, no email needed');
            }
            
        } catch (error) {
            console.error('❌ Error handling new message:', error);
        }
    }

    async isUserOffline(userId) {
        try {
            const presenceRef = doc(this.db, 'userPresence', userId);
            const presenceSnap = await getDoc(presenceRef);
            
            if (presenceSnap.exists()) {
                const presenceData = presenceSnap.data();
                console.log('📊 User presence:', presenceData.status);
                return presenceData.status === 'offline';
            }
            
            console.log('📊 No presence data found, assuming online');
            return false;
        } catch (error) {
            console.error('❌ Error checking user presence:', error);
            return false;
        }
    }

    async updateUserPresence(userId, status) {
        try {
            const presenceRef = doc(this.db, 'userPresence', userId);
            await setDoc(presenceRef, {
                status: status,
                lastSeen: status === 'offline' ? serverTimestamp() : null,
                lastOnline: serverTimestamp(),
                userId: userId
            }, { merge: true });
            console.log('📊 Updated user presence to:', status);
        } catch (error) {
            console.error('❌ Error updating user presence:', error);
        }
    }

    async sendEmailNotification(userId, message, thread) {
        console.log('📧 Starting email notification process...');
        try {
            const lastNotification = this.lastNotificationTimes.get(userId);
            if (lastNotification && Date.now() - lastNotification < this.notificationCooldown) {
                console.log('⏳ Too soon since last notification, skipping');
                return;
            }

            console.log('👤 Getting user data for:', userId);
            const userRef = doc(this.db, 'users', userId);
            const userSnap = await getDoc(userRef);
            
            if (!userSnap.exists()) {
                console.log('❌ User document not found');
                return;
            }

            const userData = userSnap.data();
            const userEmail = userData.email;
            const userName = userData.name || 'User';
            
            if (!userEmail) {
                console.log('❌ No email found for user');
                return;
            }

            console.log('👤 Getting sender data...');
            const senderRef = doc(this.db, 'users', message.senderId);
            const senderSnap = await getDoc(senderRef);
            const senderData = senderSnap.exists() ? senderSnap.data() : { name: 'Someone' };

            console.log('📧 Sending email to:', userEmail);
            const result = await this.sendEmailJSNotification(userEmail, userName, senderData.name, message);

            if (result) {
                this.lastNotificationTimes.set(userId, Date.now());
                console.log('✅ Email notification completed successfully');
            } else {
                console.log('❌ Email sending failed');
            }
            
        } catch (error) {
            console.error('❌ Error in sendEmailNotification:', error);
        }
    }

    async sendEmailJSNotification(userEmail, userName, senderName, message) {
        console.log('🔧 Preparing EmailJS send...');
        try {
            if (!window.emailjs) {
                console.error('❌ EmailJS not available');
                return false;
            }

            const templateParams = {
                to_email: userEmail,
                user_name: userName,
                sender_name: senderName || 'Someone',
                message_preview: this.formatMessagePreview(message),
                timestamp: new Date().toLocaleString(),
                reply_url: `${window.location.origin}/chat.html`
            };

            console.log('📨 EmailJS template params:', templateParams);
            console.log('📨 EmailJS config:', this.emailjsConfig);

            const result = await window.emailjs.send(
                this.emailjsConfig.serviceId,
                this.emailjsConfig.templateId,
                templateParams
            );

            console.log('✅ EmailJS send result:', result);
            return true;
            
        } catch (error) {
            console.error('❌ EmailJS send error:', error);
            console.error('❌ Error details:', {
                status: error.status,
                text: error.text,
                message: error.message
            });
            return false;
        }
    }

    formatMessagePreview(message) {
        if (message.text) {
            return message.text.length > 100 
                ? message.text.substring(0, 100) + '...' 
                : message.text;
        } else if (message.imageUrl) return '📷 Sent you a photo';
        else if (message.audioUrl) return '🎤 Sent you a voice message';
        else if (message.videoUrl) return '🎥 Sent you a video';
        else return 'Sent you a message';
    }

    stopAllMonitoring() {
        this.messageListeners.forEach((unsubscribe) => unsubscribe());
        this.messageListeners.clear();
    }
}

// Start the system
const emailSystem = new EmailNotificationSystem();
window.emailNotificationSystem = emailSystem;
console.log('🎯 Email notification system DEBUG version loaded');