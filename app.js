// Firebase configuration
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    doc, 
    setDoc, 
    getDoc, 
    updateDoc, 
    query, 
    where, 
    getDocs,
    addDoc,
    serverTimestamp,
    onSnapshot,
    orderBy,
    limit,
    arrayUnion,
    arrayRemove
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// Cloudinary configuration (for images, audio, and videos)
const cloudinaryConfig = {
    cloudName: "ddtdqrh1b",
    uploadPreset: "profile-pictures",
    apiUrl: "https://api.cloudinary.com/v1_1"
};

// Emoji reactions
const EMOJI_REACTIONS = ['👍', '❤️', '🔥', '😘', '👎', '🤘', '💯'];

// NEW: IndexedDB for offline storage
class IndexedDBCache {
    constructor() {
        this.dbName = 'DatingAppDB';
        this.dbVersion = 3;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create object stores for different data types
                if (!db.objectStoreNames.contains('profiles')) {
                    db.createObjectStore('profiles', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('messages')) {
                    const messageStore = db.createObjectStore('messages', { keyPath: 'id' });
                    messageStore.createIndex('threadId', 'threadId', { unique: false });
                    messageStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
                if (!db.objectStoreNames.contains('conversations')) {
                    db.createObjectStore('conversations', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('userData')) {
                    db.createObjectStore('userData', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('pendingMessages')) {
                    const pendingStore = db.createObjectStore('pendingMessages', { keyPath: 'id', autoIncrement: true });
                    pendingStore.createIndex('status', 'status', { unique: false });
                }
            };
        });
    }

    async set(storeName, data) {
        if (!this.db) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(data);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        });
    }

    async get(storeName, key) {
        if (!this.db) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        });
    }

    async getAll(storeName, indexName = null, queryValue = null) {
        if (!this.db) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            let request;
            
            if (indexName && queryValue) {
                const index = store.index(indexName);
                request = index.getAll(queryValue);
            } else {
                request = store.getAll();
            }
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result || []);
        });
    }

    async delete(storeName, key) {
        if (!this.db) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(key);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    async clear(storeName) {
        if (!this.db) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }
}

// Event listener management system
class EventManager {
    constructor() {
        this.listeners = new Map();
    }

    addListener(element, event, handler, options = {}) {
        if (!element) {
            console.warn('Cannot add listener to null element for event:', event);
            return () => {};
        }
        
        const key = `${element.id || element.className}-${event}-${Date.now()}`;
        element.addEventListener(event, handler, options);
        this.listeners.set(key, { element, event, handler });
        
        return () => this.removeListener(key);
    }

    removeListener(key) {
        const listener = this.listeners.get(key);
        if (listener) {
            const { element, event, handler } = listener;
            element.removeEventListener(event, handler);
            this.listeners.delete(key);
        }
    }

    clearAll() {
        this.listeners.forEach((listener, key) => {
            this.removeListener(key);
        });
    }

    // Add multiple listeners at once
    addListeners(configs) {
        const removers = [];
        configs.forEach(config => {
            const remover = this.addListener(
                config.element, 
                config.event, 
                config.handler, 
                config.options
            );
            removers.push(remover);
        });
        return removers;
    }
}

const eventManager = new EventManager();

// NEW: Enhanced Cache with IndexedDB support
class LocalCache {
    constructor() {
        this.cachePrefix = 'datingApp_';
        this.cacheExpiry = {
            short: 1 * 60 * 1000, // 1 minute
            medium: 5 * 60 * 1000, // 5 minutes
            long: 30 * 60 * 1000 // 30 minutes
        };
        this.indexedDB = new IndexedDBCache();
        this.indexedDBInitialized = false;
    }

    async init() {
        if (!this.indexedDBInitialized) {
            await this.indexedDB.init();
            this.indexedDBInitialized = true;
        }
    }

    set(key, data, expiryType = 'medium') {
        try {
            const item = {
                data: data,
                expiry: Date.now() + (this.cacheExpiry[expiryType] || this.cacheExpiry.medium)
            };
            localStorage.setItem(this.cachePrefix + key, JSON.stringify(item));
        } catch (error) {
            console.error('Cache set error:', error);
        }
    }

    get(key) {
        try {
            const itemStr = localStorage.getItem(this.cachePrefix + key);
            if (!itemStr) return null;
            
            const item = JSON.parse(itemStr);
            if (Date.now() > item.expiry) {
                localStorage.removeItem(this.cachePrefix + key);
                return null;
            }
            return item.data;
        } catch (error) {
            console.error('Cache get error:', error);
            return null;
        }
    }

    remove(key) {
        try {
            localStorage.removeItem(this.cachePrefix + key);
        } catch (error) {
            console.error('Cache remove error:', error);
        }
    }

    clear() {
        try {
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith(this.cachePrefix)) {
                    localStorage.removeItem(key);
                }
            });
        } catch (error) {
            console.error('Cache clear error:', error);
        }
    }

    // NEW: IndexedDB methods for structured data
    async setProfiles(profiles) {
        await this.init();
        for (const profile of profiles) {
            await this.indexedDB.set('profiles', profile);
        }
    }

    async getProfiles() {
        await this.init();
        return await this.indexedDB.getAll('profiles');
    }

    async setMessages(threadId, messages) {
        await this.init();
        for (const message of messages) {
            await this.indexedDB.set('messages', {
                ...message,
                threadId: threadId,
                storedAt: Date.now()
            });
        }
    }

    async getMessages(threadId) {
        await this.init();
        return await this.indexedDB.getAll('messages', 'threadId', threadId);
    }

    async setConversations(conversations) {
        await this.init();
        for (const conversation of conversations) {
            await this.indexedDB.set('conversations', conversation);
        }
    }

    async getConversations() {
        await this.init();
        return await this.indexedDB.getAll('conversations');
    }

    // NEW: Pending messages for offline support
    async addPendingMessage(message) {
        await this.init();
        return await this.indexedDB.set('pendingMessages', {
            ...message,
            status: 'pending',
            createdAt: Date.now()
        });
    }

    async getPendingMessages() {
        await this.init();
        return await this.indexedDB.getAll('pendingMessages');
    }

    async removePendingMessage(id) {
        await this.init();
        return await this.indexedDB.delete('pendingMessages', id);
    }

    async updatePendingMessageStatus(id, status) {
        await this.init();
        const message = await this.indexedDB.get('pendingMessages', id);
        if (message) {
            message.status = status;
            await this.indexedDB.set('pendingMessages', message);
        }
    }
}

const cache = new LocalCache();

// NEW: Service Worker Registration for offline functionality with proper error handling
async function registerServiceWorker() {
    // Only register in production environment (not local file protocol)
    if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost')) {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('Service Worker registered successfully');
            
            // Set up background sync
            if ('sync' in registration) {
                try {
                    await registration.sync.register('send-pending-messages');
                    console.log('Background sync registered');
                } catch (syncError) {
                    console.log('Background sync not supported:', syncError);
                }
            }
            
            return registration;
        } catch (error) {
            console.log('Service Worker registration failed:', error);
            // Don't show error to user - app will work without Service Worker
            return null;
        }
    } else {
        
        return null;
    }
}

// NEW: Enhanced offline support without Service Worker dependency
function setupOfflineSupport() {
    // Use localStorage and IndexedDB for offline support
    
    
    // Process pending messages when coming online
    window.addEventListener('online', async () => {
        await processPendingMessages();
    });
}

// NEW: Background Sync for offline messages
async function setupBackgroundSync() {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
        try {
            const registration = await navigator.serviceWorker.ready;
            await registration.sync.register('send-pending-messages');
            console.log('Background sync registered');
        } catch (error) {
            console.log('Background sync registration failed:', error);
        }
    }
}

// State variables for reactions and replies
let selectedMessageForReaction = null;
let selectedMessageForReply = null;
let longPressTimer = null;

// Network connectivity state
let isOnline = navigator.onLine;
let networkRetryAttempts = 0;
const MAX_RETRY_ATTEMPTS = 3;

// Global variables
let currentUser = null;
let profiles = [];
let currentProfileIndex = 0;
let chatPartnerId = null;
let unsubscribeMessages = null;
let unsubscribeChat = null;
let typingTimeout = null;
let userChatPoints = 0;
let globalMessageListener = null;

// Voice recording variables
let mediaRecorder = null;
let audioChunks = [];
let recordingStartTime = null;
let recordingTimer = null;
let preloadedAudioStream = null;

// Video recording variables
let videoRecorder = null;
let videoChunks = [];
let videoRecordingStartTime = null;
let videoRecordingTimer = null;

// DOM Elements
let currentPage = window.location.pathname.split('/').pop().split('.')[0];
const navToggle = document.getElementById('mobile-menu');
const navMenu = document.querySelector('.nav-menu');
const messageCountElements = document.querySelectorAll('.message-count');

// NEW: Pre-load data for current page
async function preloadPageData() {
    if (!currentUser) return;

    const page = window.location.pathname.split('/').pop().split('.')[0];
    
    switch(page) {
        case 'mingle':
            await preloadMingleData();
            break;
        case 'messages':
            await preloadMessagesData();
            break;
        case 'chat':
            await preloadChatData();
            break;
        case 'dashboard':
            await preloadDashboardData();
            break;
    }
}

async function preloadMingleData() {
    // Try to load profiles from cache first
    const cachedProfiles = await cache.getProfiles();
    if (cachedProfiles && cachedProfiles.length > 0) {
        profiles = cachedProfiles;
        if (profiles.length > 0) {
            displayProfilesGrid();
        }
    }
}

async function preloadMessagesData() {
    // Try to load conversations from cache first
    const cachedConversations = await cache.getConversations();
    if (cachedConversations && cachedConversations.length > 0) {
        renderMessageThreads(cachedConversations);
    }
}

async function preloadChatData() {
    const urlParams = new URLSearchParams(window.location.search);
    const partnerId = urlParams.get('id');
    
    if (partnerId) {
        // Try to load messages from cache first
        const threadId = [currentUser.uid, partnerId].sort().join('_');
        const cachedMessages = await cache.getMessages(threadId);
        if (cachedMessages && cachedMessages.length > 0) {
            // Sort by timestamp and display
            cachedMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            updateMessagesDisplay(cachedMessages, currentUser.uid);
        }
        
        // Try to load partner data from cache
        const cachedPartner = cache.get(`partner_${partnerId}`);
        if (cachedPartner) {
            displayChatPartnerData(cachedPartner);
        }
    }
}

async function preloadDashboardData() {
    // Load user data from cache if available
    const cachedUserData = cache.get(`user_${currentUser.uid}`);
    if (cachedUserData) {
        userChatPoints = cachedUserData.chatPoints || 0;
        updateChatPointsDisplay();
    }
}

// NEW: Process pending messages when coming online
async function processPendingMessages() {
    if (!isOnline || !currentUser) return;

    try {
        const pendingMessages = await cache.getPendingMessages();
        for (const pendingMsg of pendingMessages) {
            if (pendingMsg.status === 'pending') {
                try {
                    // Retry sending the message based on type
                    if (pendingMsg.type === 'text') {
                        await addMessage(pendingMsg.data.text);
                    } else if (pendingMsg.type === 'image') {
                        await sendImageMessage(pendingMsg.blob);
                    } else if (pendingMsg.type === 'voice') {
                        await sendVoiceNoteFromPending(pendingMsg);
                    } else if (pendingMsg.type === 'video') {
                        await sendVideoMessageFromPending(pendingMsg);
                    }
                    
                    await cache.removePendingMessage(pendingMsg.id);
                } catch (error) {
                    console.error('Failed to send pending message:', error);
                    // Keep it in pending for next retry
                }
            }
        }
    } catch (error) {
        console.error('Error processing pending messages:', error);
    }
}

async function sendVoiceNoteFromPending(pendingMsg) {
    try {
        const audioUrl = await uploadAudioToCloudinary(pendingMsg.blob);
        await addMessage(null, null, audioUrl, pendingMsg.duration);
    } catch (error) {
        throw error;
    }
}

async function sendVideoMessageFromPending(pendingMsg) {
    try {
        const videoUrl = await uploadVideoToCloudinary(pendingMsg.blob);
        await addMessage(null, null, null, null, videoUrl, pendingMsg.duration);
    } catch (error) {
        throw error;
    }
}

// NEW: Optimistic UI updates with rollback support
class OptimisticUpdates {
    constructor() {
        this.pendingUpdates = new Map();
    }

    addUpdate(id, updateData, rollbackFn) {
        this.pendingUpdates.set(id, {
            data: updateData,
            rollback: rollbackFn,
            timestamp: Date.now()
        });
    }

    removeUpdate(id) {
        this.pendingUpdates.delete(id);
    }

    rollbackUpdate(id) {
        const update = this.pendingUpdates.get(id);
        if (update && update.rollback) {
            update.rollback();
            this.pendingUpdates.delete(id);
        }
    }

    cleanupOldUpdates(maxAge = 300000) { // 5 minutes
        const now = Date.now();
        for (const [id, update] of this.pendingUpdates.entries()) {
            if (now - update.timestamp > maxAge) {
                this.rollbackUpdate(id);
            }
        }
    }
}

const optimisticUpdates = new OptimisticUpdates();

// UPDATED: Microphone pre-loading for faster voice recording
async function preloadMicrophonePermission() {
    try {
        if (navigator.permissions && navigator.permissions.query) {
            const permissionStatus = await navigator.permissions.query({ name: 'microphone' });
            
            if (permissionStatus.state === 'granted') {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    preloadedAudioStream = stream;
                    console.log('Microphone pre-loaded for faster recording');
                } catch (error) {
                    console.log('Could not pre-load microphone:', error);
                }
            }
        }
    } catch (error) {
        console.log('Microphone pre-load not supported:', error);
    }
}

// Call pre-load on page load for chat page
if (currentPage === 'chat') {
    setTimeout(preloadMicrophonePermission, 1000);
}

// File validation functions
function validateVideoFile(file) {
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
        throw new Error('Video file must be less than 100MB');
    }
    
    const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/mov', 'video/avi'];
    if (!allowedTypes.includes(file.type)) {
        throw new Error('Please upload a valid video file (MP4, WebM, MOV, AVI)');
    }
    
    return true;
}

function validateImageFile(file) {
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
        throw new Error('Image file must be less than 10MB');
    }
    
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
        throw new Error('Please upload a valid image file (JPEG, PNG, GIF, WebP)');
    }
    
    return true;
}

// UPDATED: Notification system with offline support
function showNotification(message, type = 'info', duration = 3000) {
    // Remove any existing notifications first
    const existingNotifications = document.querySelectorAll('.custom-notification');
    existingNotifications.forEach(notification => notification.remove());
    
    const notification = document.createElement('div');
    notification.className = `custom-notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="notification-icon ${getNotificationIcon(type)}"></i>
            <span>${message}</span>
        </div>
    `;
    
    // Add styles if not already added
    if (!document.getElementById('notification-styles')) {
        const styles = document.createElement('style');
        styles.id = 'notification-styles';
        styles.textContent = `
            .custom-notification {
                position: fixed;
                top: 20px;
                right: 20px;
                background: white;
                padding: 15px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                z-index: 10000;
                display: flex;
                align-items: center;
                max-width: 350px;
                animation: slideIn 0.3s ease;
                border-left: 4px solid;
            }
            .custom-notification.success {
                border-left-color: var(--success-color, #28a745);
            }
            .custom-notification.error {
                border-left-color: var(--error-color, #dc3545);
            }
            .custom-notification.info {
                border-left-color: var(--accent-color, #007bff);
            }
            .custom-notification.warning {
                border-left-color: var(--warning-color, #ffc107);
            }
            .custom-notification.offline {
                border-left-color: var(--warning-color, #ffc107);
                background: #fff3cd;
            }
            .notification-content {
                display: flex;
                align-items: center;
                gap: 10px;
                color: black;
            }
            .notification-icon {
                font-size: 18px;
            }
            .success .notification-icon {
                color: var(--success-color, #28a745);
            }
            .error .notification-icon {
                color: var(--error-color, #dc3545);
            }
            .info .notification-icon {
                color: var(--accent-color, #007bff);
            }
            .warning .notification-icon {
                color: var(--warning-color, #ffc107);
            }
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(styles);
    }
    
    document.body.appendChild(notification);
    
    // Auto remove after duration
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, duration);
    
    return notification;
}

function getNotificationIcon(type) {
    switch(type) {
        case 'success': return 'fas fa-check-circle';
        case 'error': return 'fas fa-exclamation-circle';
        case 'warning': return 'fas fa-exclamation-triangle';
        case 'offline': return 'fas fa-wifi';
        default: return 'fas fa-info-circle';
    }
}

// UPDATED: Enhanced network connectivity monitoring
function setupNetworkMonitoring() {
    window.addEventListener('online', handleNetworkOnline);
    window.addEventListener('offline', handleNetworkOffline);
    
    // Create offline indicator
    const offlineIndicator = document.createElement('div');
    offlineIndicator.id = 'offlineIndicator';
    offlineIndicator.className = 'offline-indicator';
    offlineIndicator.innerHTML = '<i class="fas fa-wifi"></i> You are currently offline. Some features may be limited.';
    offlineIndicator.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: #ff6b6b;
        color: white;
        text-align: center;
        padding: 10px;
        z-index: 10001;
        font-size: 14px;
        display: none;
    `;
    document.body.appendChild(offlineIndicator);
    
    // Initial check
    if (!isOnline) {
        handleNetworkOffline();
    }
}

async function handleNetworkOnline() {
    isOnline = true;
    networkRetryAttempts = 0;
    
    // Hide offline indicator
    const offlineIndicator = document.getElementById('offlineIndicator');
    if (offlineIndicator) {
        offlineIndicator.style.display = 'none';
    }
    
    showNotification('Connection restored', 'success', 2000);
    
    // Process any pending messages
    await processPendingMessages();
    
    // Sync all data
    await syncAllData();
    
    // Reload current page data
    reloadCurrentPageData();
}

function handleNetworkOffline() {
    isOnline = false;
    
    // Show offline indicator
    const offlineIndicator = document.getElementById('offlineIndicator');
    if (offlineIndicator) {
        offlineIndicator.style.display = 'block';
    }
    
    showNotification('No internet connection - working offline', 'offline', 5000);
}

async function syncAllData() {
    if (!currentUser) return;
    
    try {
        // Sync profiles
        await loadProfiles(true);
        
        // Sync messages
        if (currentPage === 'messages' || currentPage === 'chat') {
            await loadMessageThreads(true);
        }
        
        // Sync user data
        await loadUserChatPoints();
        
    } catch (error) {
        console.error('Error syncing data:', error);
    }
}

function reloadCurrentPageData() {
    const currentPage = window.location.pathname.split('/').pop().split('.')[0];
    
    switch(currentPage) {
        case 'mingle':
            loadProfiles();
            break;
        case 'messages':
            loadMessageThreads();
            break;
        case 'chat':
            if (chatPartnerId) {
                loadChatMessages(currentUser.uid, chatPartnerId);
            }
            break;
        case 'dashboard':
            loadUserChatPoints();
            break;
    }
}

// Microphone Permission Popup Function
function showMicrophonePermissionPopup() {
    if (localStorage.getItem('microphonePermissionShown')) {
        return;
    }
    
    const popup = document.createElement('div');
    popup.className = 'microphone-permission-popup';
    popup.innerHTML = `
        <div class="permission-popup-content">
            <h3>Enable Microphone Access</h3>
            <p>Would you like to enable microphone access for voice messages and notes?</p>
            <div class="permission-buttons">
                <button id="permissionDeny" class="permission-btn deny">Not Now</button>
                <button id="permissionAllow" class="permission-btn allow">Allow</button>
            </div>
        </div>
    `;
    
    const styles = document.createElement('style');
    styles.textContent = `
        .microphone-permission-popup {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: var(--discord-darker, #2f3136);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        }
        .permission-popup-content {
            background-color: var(--discord-darker, #2f3136);
            padding: 20px;
            border-radius: 10px;
            max-width: 400px;
            width: 90%;
            text-align: center;
        }
        .permission-popup-content h3 {
            margin-bottom: 10px;
            color: var(--text-dark);
        }
        .permission-popup-content p {
            margin-bottom: 20px;
            color: var(--discord-dark, #36393f);
        }
        .permission-buttons {
            display: flex;
            justify-content: center;
            gap: 10px;
        }
        .permission-btn {
            padding: 10px 20px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-weight: bold;
        }
        .permission-btn.deny {
            background-color: var(--discord-dark, #36393f);
            color: #333;
        }
        .permission-btn.allow {
            background-color:var(--primary-blue, #4a8cff);
            color: white;
        }
    `;
    document.head.appendChild(styles);
    document.body.appendChild(popup);
    
    document.getElementById('permissionAllow').addEventListener('click', async () => {
        try {
            const hasPermission = await requestMicrophonePermission();
            if (hasPermission) {
                showNotification('Microphone access enabled successfully!', 'success');
                preloadMicrophonePermission();
            } else {
                showNotification('Could not enable microphone access. You can enable it later in your browser settings.', 'warning');
            }
        } catch (error) {
            console.error('Error enabling microphone:', error);
            showNotification('Error enabling microphone access. Please try again later.', 'error');
        }
        localStorage.setItem('microphonePermissionShown', 'true');
        document.body.removeChild(popup);
        document.head.removeChild(styles);
    });
    
    document.getElementById('permissionDeny').addEventListener('click', () => {
        localStorage.setItem('microphonePermissionShown', 'true');
        document.body.removeChild(popup);
        document.head.removeChild(styles);
    });
}

// Microphone Permission Handling
async function requestMicrophonePermission() {
    try {
        if (navigator.permissions && navigator.permissions.query) {
            const currentPermission = await navigator.permissions.query({ name: 'microphone' });
            if (currentPermission.state === 'granted') {
                return true;
            }
        }
        
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        return true;
    } catch (error) {
        console.error('Microphone permission denied:', error);
        return false;
    }
}

// Camera Permission Handling
async function requestCameraPermission() {
    try {
        if (navigator.permissions && navigator.permissions.query) {
            const currentPermission = await navigator.permissions.query({ name: 'camera' });
            if (currentPermission.state === 'granted') {
                return true;
            }
        }
        
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop());
        return true;
    } catch (error) {
        console.error('Camera permission denied:', error);
        return false;
    }
}

async function checkMicrophonePermission() {
    try {
        if (!navigator.permissions || !navigator.permissions.query) {
            return 'unknown';
        }
        
        const permissionStatus = await navigator.permissions.query({ name: 'microphone' });
        return permissionStatus.state;
    } catch (error) {
        console.error('Error checking microphone permission:', error);
        return 'unknown';
    }
}

// Error logging utility
function logError(error, context = '') {
    console.error(`[${new Date().toISOString()}] Error${context ? ` in ${context}` : ''}:`, error);
}

// SIMPLIFIED: Removed all verification handling
async function handleUserVerification(user) {
    console.log('User authenticated:', user.email);
}

// SIMPLIFIED: Login without verification checks
async function enhancedLogin(email, password) {
    try {
        console.log('Attempting login for:', email);
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        console.log('Login successful');
        return true;
    } catch (error) {
        console.error('Login error:', error);
        throw error;
    }
}

// UPDATED: Cleanup function with IndexedDB support
function cleanupAllListeners() {
    if (unsubscribeMessages) {
        unsubscribeMessages();
        unsubscribeMessages = null;
    }
    
    cleanupChatPage();
    
    if (globalMessageListener) {
        globalMessageListener();
        globalMessageListener = null;
    }
    
    if (typingTimeout) clearTimeout(typingTimeout);
    if (recordingTimer) clearInterval(recordingTimer);
    if (videoRecordingTimer) clearInterval(videoRecordingTimer);
    if (longPressTimer) clearTimeout(longPressTimer);
    
    if (preloadedAudioStream) {
        preloadedAudioStream.getTracks().forEach(track => track.stop());
        preloadedAudioStream = null;
    }
    
    eventManager.clearAll();
    optimisticUpdates.cleanupOldUpdates();
}

// Enhanced logout function
async function handleLogout() {
    try {
        if (currentUser && currentUser.uid) {
            const userStatusRef = doc(db, 'status', currentUser.uid);
            await setDoc(userStatusRef, {
                state: 'offline',
                lastChanged: serverTimestamp(),
                lastSeen: serverTimestamp(),
                userId: currentUser.uid
            }, { merge: true });
        }
        
        cleanupAllListeners();
        await signOut(auth);
        
        currentUser = null;
        cache.clear();
        
        showNotification('Logged out successfully', 'success');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1000);
        
    } catch (error) {
        logError(error, 'logout');
        showNotification(error.message, 'error');
    }
}

// UPDATED: DOM Content Loaded with Service Worker and preloading
document.addEventListener('DOMContentLoaded', async () => {
    // Try to register Service Worker (will fail gracefully if not supported)
    await registerServiceWorker();
    
    // Always set up offline support even without Service Worker
    setupOfflineSupport();
    
    // Add loader styles immediately
    const style = document.createElement('style');
    style.textContent = `
        .page-loader {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 200px;
            flex-direction: column;
            gap: 20px;
        }
        .message-loader {
            display: flex;
            justify-content: center;
            padding: 40px 0;
        }
        .dot-pulse {
            position: relative;
            width: 10px;
            height: 10px;
            border-radius: 5px;
            background-color: var(--accent-color);
            color: var(--accent-color);
            animation: dot-pulse 1.5s infinite linear;
            animation-delay: 0.25s;
        }
        .dot-pulse::before, .dot-pulse::after {
            content: '';
            display: inline-block;
            position: absolute;
            top: 0;
            width: 10px;
            height: 10px;
            border-radius: 5px;
            background-color: var(--accent-color);
            color: var(--accent-color);
        }
        .dot-pulse::before {
            left: -15px;
            animation: dot-pulse 1.5s infinite linear;
            animation-delay: 0s;
        }
        .dot-pulse::after {
            left: 15px;
            animation: dot-pulse 1.5s infinite linear;
            animation-delay: 0.5s;
        }
        @keyframes dot-pulse {
            0%, 100% { transform: scale(0.8); opacity: 0.5; }
            50% { transform: scale(1.2); opacity: 1; }
        }
        
        .loading-message {
            display: flex;
            justify-content: center;
            padding: 20px;
            color: var(--text-light);
            font-style: italic;
        }
        
        .instant-loading {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(255, 255, 255, 0.9);
            z-index: 9999;
            justify-content: center;
            align-items: center;
            flex-direction: column;
        }
        
        .offline-indicator {
            position: ;
            top: 0;
            left: 0;
            right: 0;
            background: #ff6b6b;
            color: white;
            text-align: center;
            padding: 10px;
            z-index: 10001;
            font-size: 5px;
            display: none;
        }
        
        @keyframes slideDown {
            from { transform: translateY(-100%); }
            to { transform: translateY(0); }
        }
        
        .voice-note-indicator {
            display: none;
            align-items: center;
            justify-content: space-between;
            padding: 10px;
            background-color: var(--bg-light);
            border-radius: 20px;
            margin: 10px 0;
            animation: slideUp 0.2s ease-out;
        }
        .voice-note-timer {
            font-size: 14px;
            color: var(--text-dark);
            font-weight: bold;
        }
        .voice-note-controls {
            display: flex;
            gap: 10px;
        }
        .voice-message {
            max-width: 400px;
            padding: 8px 15px;
            border-radius: 18px;
            margin: 5px 0;
            position: relative;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .voice-message.sent {
            background-color: var(--accent-color);
            color: white;
            align-self: flex-end;
        }
        .voice-message.received {
            background-color: var(--accent-color);
            color: var(--text-dark);
            align-self: flex-start;
        }
        .voice-message-controls {
            display: flex;
            align-items: center;
            margin-top: 5px;
        }
        .voice-message-play-btn {
            background: blue;
            border: none;
            border-radius: 50%;
            color: white;
            font-size: 14px;
            cursor: pointer;
            padding: 6px;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .voice-message-duration {
            font-size: 12px;
            margin-left: 10px;
        }
        .waveform {
            height: 20px;
            width: 60px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .waveform-bar {
            background-color: currentColor;
            width: 3px;
            border-radius: 3px;
            transition: height 0.2s ease;
        }
        .waveform-bar.active {
            animation: waveform-animation 1.2s infinite ease-in-out;
        }
        @keyframes waveform-animation {
            0%, 100% { height: 5px; }
            50% { height: 15px; }
        }
        @keyframes slideUp {
            from { transform: translateY(10px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
        
        .video-message {
            max-width: 280px;
            border-radius: 12px;
            overflow: hidden;
            position: relative;
            background: #000;
            margin: 2px 0;
           min-width:180px;
        }

        .video-message video {
            width: 260px;
            height: auto;
            max-height: 400px;
            border-radius: 12px;
            object-fit: cover;
          min-width:260px;
        }

        .video-message-controls {
            position: absolute;
            bottom: 10px;
            right: 10px;
            background: rgba(0, 0, 0, 0.7);
            border-radius: 20px;
            padding: 5px 10px;
            display: flex;
            align-items: center;
            gap: 5px;
        }

        .video-play-btn {
            background: none;
            border: none;
            color: white;
            cursor: pointer;
            font-size: 14px;
            padding: 0;
            display: flex;
            align-items: center;
        }

        .video-duration {
            color: white;
            font-size: 12px;
            margin-left: 5px;
        }

        .reply-preview {
            display: flex;
            align-items: center;
            padding: 10px 12px;
            background: white;
            border-left: 4px solid var(--accent-color);
            margin-bottom: 10px;
            border-radius: 8px;
            border: none;
        }

        .reply-preview-content {
            flex: 1;
            margin-left: 10px;
            overflow: hidden;
        }

        .reply-preview-text {
            font-size: 14px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            color: black;
            font-weight: 500;
        }

        .reply-preview-name {
            font-size: 12px;
            font-weight: bold;
            color: black;
            margin-bottom: 2px;
        }

        .reply-preview-cancel {
            background: none;
            border: none;
            color: #888;
            cursor: pointer;
            font-size: 16px;
            padding: 5px;
            border-radius: 50%;
            transition: background-color 0.2s;
        }

        .reply-preview-cancel:hover {
            background: rgba(255, 255, 255, 0.1);
        }

        .reply-indicator {
            font-size: 12px;
            color:white;
            margin-bottom: 4px;
            display: flex;
            align-items: center;
            gap: 4px;
            font-weight: 500;
        }

        .reply-indicator i {
            font-size: 10px;
        }

        .reply-message-preview {
            background: rgba(255, 255, 255, 0.1);
            border-left: 2px solid var(--accent-color);
            padding: 6px 10px;
            margin-bottom: 6px;
            border-radius: 6px;
            font-size: 12px;
            max-width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            color: #ccc;
        }

        .video-preview {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: black;
            z-index: 10000;
            display: none;
            flex-direction: column;
            justify-content: center;
            align-items: center;
        }

        .video-preview video {
            width: 100%;
            height: 100%;
            object-fit: contain;
        }

        .video-preview-controls {
            position: absolute;
            bottom: 40px;
            left: 0;
            right: 0;
            display: flex;
            justify-content: center;
            gap: 20px;
            padding: 20px;
        }

        .video-preview-btn {
            background: rgba(255, 255, 255, 0.2);
            color: white;
            border: none;
            border-radius: 50%;
            width: 60px;
            height: 60px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            font-size: 20px;
            transition: background-color 0.2s;
        }

        .video-preview-btn:hover {
            background: rgba(255, 255, 255, 0.3);
        }

        .video-recording-indicator {
            display: none;
            align-items: center;
            justify-content: space-between;
            padding: 12px 15px;
            background: #2a2a2a;
            border-radius: 25px;
            margin: 10px 0;
            border: 1px solid #444;
        }

        .video-recording-timer {
            font-size: 14px;
            color: #ff4444;
            font-weight: bold;
        }

        .video-recording-controls {
            display: flex;
            gap: 10px;
            align-items: center;
        }

        .recording-dot {
            width: 12px;
            height: 12px;
            background-color: #ff4444;
            border-radius: 50%;
            animation: recording-pulse 1.5s infinite;
        }

        @keyframes recording-pulse {
            0%, 100% { 
                opacity: 1; 
                transform: scale(1);
            }
            50% { 
                opacity: 0.3; 
                transform: scale(0.8);
            }
        }

        .voice-message {
            max-width: 280px;
            padding: 12px 15px;
            border-radius: 20px;
            margin: 5px 0;
            position: relative;
            display: flex;
            align-items: center;
            gap: 12px;
            background: var(--accent-color);
        }

        .voice-message.sent {
            background: var(--accent-color);
            color: white;
            align-self: flex-end;
        }

        .voice-message.received {
            background: #3a3a3a;
            color: white;
            align-self: flex-start;
        }

        .voice-message-controls {
            display: flex;
            align-items: center;
            gap: 10px;
            width: 100%;
        }

        .voice-message-play-btn {
            background: rgba(255, 255, 255, 0.2);
            border: none;
            border-radius: 50%;
            color: white;
            font-size: 14px;
            cursor: pointer;
            padding: 8px;
            width: 35px;
            height: 35px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background-color 0.2s;
        }

        .voice-message-play-btn:hover {
            background: rgba(255, 255, 255, 0.3);
        }

        .voice-message-duration {
            font-size: 12px;
            color: rgba(255, 255, 255, 0.8);
            min-width: 40px;
        }

        .waveform {
            height: 25px;
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 2px;
        }

        .waveform-bar {
            background-color: currentColor;
            width: 3px;
            border-radius: 3px;
            transition: height 0.2s ease;
            flex: 1;
        }

        .waveform-bar.active {
            animation: waveform-animation 1.2s infinite ease-in-out;
        }

        @keyframes waveform-animation {
            0%, 100% { height: 5px; }
            50% { height: 15px; }
        }

        .message-image {
            max-width: 300px;
            max-height: 400px;
            border-radius: 12px;
            object-fit: cover;
            transition: opacity 0.3s ease;
         min-width: 180px;
        min-width: 180px;
        }

        .message-image.sending {
            opacity: 0.7;
            filter: grayscale(0.3);
        }

        .sending-indicator {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 8px 12px;
            border-radius: 20px;
            font-size: 12px;
            display: flex;
            align-items: center;
            gap: 6px;
            z-index: 2;
        }

        .sending-indicator i {
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .voice-message.sending, .video-message.sending {
            opacity: 0.7;
            position: relative;
        }

        .sending-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            border-radius: inherit;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 12px;
            gap: 5px;
        }

        @media (max-width: 768px) {
            .video-message {
                max-width: 500px;
            }
            
            .video-message video {
                max-height: 300px;
            }
            
            .message-image {
                max-width: 250px;
                max-height: 300px;
            }
        }

        @media (max-width: 480px) {
            .video-message {
                max-width: 260px;
            }
            
            .video-message video {
                max-height: 300px;
              min-width:200px;
            }
            
            .message-image {
                max-width: 200px;
                max-height: 300px;
            }
        }

        .video-message {
            max-width: auto;
            border-radius: 12px;
            overflow: hidden;
            position: relative;
        }
        .video-message video {
            width: auto;
            height: 400px;
            border-radius: 12px;
            padding-top:2px;
        }
        .video-message-controls {
            position: absolute;
            bottom: 10px;
            right: 10px;
            background: rgba(0, 0, 0, 0.7);
            border-radius: 20px;
            padding: 5px 10px;
        }
        .video-play-btn {
            background: none;
            border: none;
            color: white;
            cursor: pointer;
            font-size: 14px;
        }
        .video-duration {
            color: white;
            font-size: 12px;
            margin-left: 5px;
        }
        
        .video-recording-indicator {
            display: none;
            align-items: center;
            justify-content: space-between;
            padding: 10px;
            background-color: var(--bg-light);
            border-radius: 20px;
            margin: 10px 0;
        }
        .video-recording-timer {
            font-size: 14px;
            color: var(--text-dark);
        }
        .video-recording-controls {
            display: flex;
            gap: 10px;
        }
        .recording-dot {
            width: 12px;
            height: 12px;
            background-color: #ff4444;
            border-radius: 50%;
            animation: pulse 1.5s infinite;
        }
        
        .online-status {
            bottom: 10px;
            right: 10px;
            width: 3px;
            height: 3px;
            border-radius: 50%;
            border: 2px solid white;
        }
        .online-status.online {
            background-color: #00FF00;
        }
        .online-status.offline {
            background-color: #9E9E9E;
        }
        .profile-card {
            position: relative;
        }
        
        .message-reactions {
            display: flex;
            gap: 5px;
            margin-top: 5px;
            flex-wrap: wrap;
        }
        .reaction {
            background: rgba(255, 255, 255, 0.9);
            border-radius: 10px;
            padding: 2px 6px;
            font-size: 12px;
            display: flex;
            align-items: center;
            gap: 2px;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        }
        .reaction-count {
            font-size: 10px;
            color: #666;
        }
        
        .reaction-picker {
            position: fixed;
            background: white;
            border-radius: 25px;
            padding: 10px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            display: none;
            gap: 8px;
            z-index: 1000;
            flex-wrap: wrap;
            max-width: 250px;
        }
        .reaction-emoji {
            font-size: 20px;
            cursor: pointer;
            padding: 5px;
            border-radius: 50%;
            transition: background-color 0.2s;
        }
        .reaction-emoji:hover {
            background-color: #f0f0f0;
        }
        
        .reply-preview {
            display: flex;
            align-items: center;
            padding: 8px 12px;
            background: var(--bg-light);
            border-left: 3px solid var(--accent-color);
            margin-bottom: 10px;
            border-radius: 4px;
        }
        .reply-preview-content {
            flex: 1;
            margin-left: 10px;
            overflow: hidden;
        }
        .reply-preview-text {
            font-size: 14px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            color: var(--text-light);
        }
        .reply-preview-name {
            font-size: 12px;
            font-weight: bold;
            color: black;
        }
        .reply-preview-cancel {
            background: none;
            border: none;
            color: var(--text-light);
            cursor: pointer;
            font-size: 16px;
            padding: 5px;
        }
        
        .message-context-menu {
            position: absolute;
            background:black;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 100;
            padding: 8px 0;
            display: none;
        }
        .context-menu-item {
            padding: 10px 16px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 14px;
        }
        .context-menu-item:hover {
            background: #f5f5f5;
        }
        
        .message {
            transition: transform 0.3s ease;
            will-change: transform;
            touch-action: pan-y;
        }
        
        .message-swipe-action {
            position: absolute;
            top: 50%;
            left: 15px;
            transform: translateY(-50%);
            background: var(--accent-color);
            color: white;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: opacity 0.2s ease;
            pointer-events: none;
        }
        
        .message.received {
            position: relative;
            overflow: visible;
        }
        .reply-indicator {
            font-size: 12px;
            color: var(--accent-color);
            margin-bottom: 4px;
            display: flex;
            align-items: center;
            gap: 4px;
        }
        .reply-indicator i {
            font-size: 10px;
        }
        .reply-message-preview {
            background: rgba(0, 0, 0, 0.05);
            border-left: 2px solid var(--accent-color);
            padding: 4px 8px;
            margin-bottom: 4px;
            border-radius: 4px;
            font-size: 12px;
            max-width: 400px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        
        .prevent-copy {
            -webkit-user-select: none;
            -moz-user-select: none;
            -ms-user-select: none;
            user-select: none;
            -webkit-touch-callout: none;
            -webkit-tap-highlight-color: transparent;
        }
        
        .fast-loading-message {
            text-align: center;
            padding: 10px;
            font-size: 14px;
            color: var(--accent-color);
            background: var(--bg-light);
            border-radius: 8px;
            margin: 10px;
            animation: pulse 2s infinite;
        }
        
        .upload-button {
            background: var(--accent-color);
            color: white;
            border: none;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            display: flex;
            alignItems: center;
            justify-content: center;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        .upload-button:hover {
            background: var(--accent-dark);
        }
        .upload-button:disabled {
            background: #ccc;
            cursor: not-allowed;
        }
        
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
        }
        @keyframes recording-pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
        }

       .profile-grid-status {
            position: absolute;
            top: 10px;
            right: 10px;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            border: 2px solid white;
        }

        .profile-grid-status.online {
            background-color: #00FF00;
        }

        .profile-grid-status.offline {
            background-color: #9E9E9E;
        }

        .no-profiles-message {
            grid-column: 1 / -1;
            text-align: center;
            padding: 40px;
            color: #666;
            font-size: 16px;
        }


        }
    `;
    document.head.appendChild(style);

    // Create instant loading overlay
    const instantLoading = document.createElement('div');
    instantLoading.className = 'instant-loading';
    instantLoading.id = 'instantLoading';
    instantLoading.innerHTML = `
        <div class="dot-pulse"></div>
        <p>Loading latest data...</p>
    `;
    document.body.appendChild(instantLoading);

    // Create reaction picker element
    const reactionPicker = document.createElement('div');
    reactionPicker.id = 'reactionPicker';
    reactionPicker.className = 'reaction-picker';
    document.body.appendChild(reactionPicker);

    // Initialize network monitoring
    setupNetworkMonitoring();

    // Initialize navbar toggle for mobile
    if (navToggle) {
        eventManager.addListener(navToggle, 'click', () => {
            navToggle.classList.toggle('active');
            navMenu.classList.toggle('active');
        });
    }

    // Close mobile menu when clicking on a link
    document.querySelectorAll('.nav-links').forEach(link => {
        eventManager.addListener(link, 'click', () => {
            navToggle.classList.remove('active');
            navMenu.classList.remove('active');
        });
    });

    // Prevent copy-paste on all pages EXCEPT share section inputs
    document.addEventListener('copy', (e) => {
        if (!e.target.classList.contains('allow-copy') && 
            !e.target.closest('.share-container') &&
            e.target.id !== 'bondlyLink' &&
            e.target.id !== 'profileLink') {
            e.preventDefault();
            showNotification('Copying is disabled on this page', 'warning', 2000);
        }
    });

    document.addEventListener('paste', (e) => {
        if (!e.target.classList.contains('allow-paste') && 
            !e.target.closest('.share-container')) {
            e.preventDefault();
            showNotification('Pasting is disabled on this page', 'warning', 2000);
        }
    });

    document.addEventListener('cut', (e) => {
        if (!e.target.classList.contains('allow-copy') && 
            !e.target.closest('.share-container')) {
            e.preventDefault();
            showNotification('Cutting is disabled on this page', 'warning', 2000);
        }
    });

    // Add copy-paste prevention class to body but allow it in share section
    document.body.classList.add('prevent-copy');

    // NEW: Preload page data immediately
    await preloadPageData();

    // Check auth state first before initializing page
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            
            // Update message count immediately with cached value
            const cachedUnread = cache.get(`unread_count_${currentUser.uid}`) || 0;
            updateMessageCount(cachedUnread);
            
            // Ensure user document exists
            ensureUserDocument(user).then(() => {
                // Load user's chat points
                loadUserChatPoints();
                
                // Set up global real-time listener for new messages
                setupGlobalMessageListener();
                // Set up online status for current user
                setupUserOnlineStatus();
                
                // Initialize reaction picker
                initReactionPicker();
                
                // Show microphone permission popup for new users
                if (!localStorage.getItem('microphonePermissionShown')) {
                    setTimeout(() => {
                        showMicrophonePermissionPopup();
                    }, 2000);
                }
                
                // Initialize page-specific functions after auth is confirmed
                switch (currentPage) {
                    case 'index':
                        initLandingPage();
                        break;
                    case 'login':
                        initLoginPage();
                        break;
                    case 'signup':
                        initSignupPage();
                        break;
                    case 'mingle':
                        initMinglePage();
                        break;
                    case 'profile':
                        initProfilePage();
                        break;
                    case 'account':
                        initAccountPage();
                        break;
                    case 'chat':
                        initChatPage();
                        break;
                    case 'messages':
                        initMessagesPage();
                        break;
                    case 'dashboard':
                        initDashboardPage();
                        break;
                    case 'payment':
                        initPaymentPage();
                        break;
                    case 'admin':
                        initAdminPage();
                        break;
                }
                
                // Hide auth pages if user is logged in
                if (['login', 'signup', 'index'].includes(currentPage)) {
                    window.location.href = 'mingle.html';
                }
            }).catch(error => {
                logError(error, 'ensuring user document');
            });
        } else {
            // User logged out - clean up everything
            cleanupAllListeners();
            currentUser = null;
            cache.clear();
            
            // Redirect to login if on protected page
            if (['mingle', 'profile', 'account', 'chat', 'messages', 'dashboard', 'payment', 'admin'].includes(currentPage)) {
                window.location.href = 'login.html';
            } else {
                // Initialize public pages
                switch (currentPage) {
                    case 'index':
                        initLandingPage();
                        break;
                    case 'login':
                        initLoginPage();
                        break;
                    case 'signup':
                        initSignupPage();
                        break;
                }
            }
        }
    });
});

// NEW: Listen for page visibility changes to handle cache refresh and background sync
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && currentUser) {
        // Page became visible again, refresh data if needed
        if (currentPage === 'chat' && chatPartnerId) {
            setTimeout(() => {
                if (unsubscribeChat) {
                    unsubscribeChat();
                }
                loadChatMessages(currentUser.uid, chatPartnerId);
            }, 500);
        }
        
        // Process any pending messages when coming back to the app
        if (isOnline) {
            processPendingMessages();
        }
    }
});

// Helper function to ensure user document exists
async function ensureUserDocument(user) {
    try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
            await setDoc(userRef, {
                email: user.email,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                profileComplete: false,
                chatPoints: 12, // Give new users 12 chat points
                paymentHistory: [],
                // REMOVED: accountDisabled and verification fields
            });
        }
        return true;
    } catch (error) {
        logError(error, 'ensureUserDocument');
        throw error;
    }
}

// Load user's chat points
async function loadUserChatPoints() {
    if (!currentUser) return;
    
    try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
            userChatPoints = userSnap.data().chatPoints || 0;
            updateChatPointsDisplay();
            
            // Cache user data
            cache.set(`user_${currentUser.uid}`, userSnap.data(), 'medium');
        }
    } catch (error) {
        logError(error, 'loading chat points');
    }
}

// Update chat points display on pages
function updateChatPointsDisplay() {
    const pointsElements = document.querySelectorAll('.chat-points-display');
    pointsElements.forEach(el => {
        el.textContent = userChatPoints;
    });
}

// UPDATED: Deduct chat points with offline support
async function deductChatPoint() {
    if (!currentUser) return false;
    
    try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
            const currentPoints = userSnap.data().chatPoints || 0;
            
            if (currentPoints <= 0) {
                showNotification('You have no chat points left. Please purchase more to continue chatting.', 'warning');
                return false;
            }
            
            await updateDoc(userRef, {
                chatPoints: currentPoints - 1
            });
            
            userChatPoints = currentPoints - 1;
            updateChatPointsDisplay();
            return true;
        }
        return false;
    } catch (error) {
        logError(error, 'deducting chat point');
        return false;
    }
}

// Add chat points (admin function)
async function addChatPoints(userId, points) {
    try {
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
            const currentPoints = userSnap.data().chatPoints || 0;
            await updateDoc(userRef, {
                chatPoints: currentPoints + points
            });
            return true;
        }
        return false;
    } catch (error) {
        logError(error, 'adding chat points');
        return false;
    }
}

// FIXED: Set up online status for current user with proper disconnect handling
function setupUserOnlineStatus() {
    if (!currentUser) return;
    
    try {
        const userStatusRef = doc(db, 'status', currentUser.uid);
        
        // Set user as online
        setDoc(userStatusRef, {
            state: 'online',
            lastChanged: serverTimestamp(),
            userId: currentUser.uid,
            lastSeen: null
        });
        
        // Set up disconnect handling
        const handleDisconnect = async () => {
            try {
                if (currentUser && currentUser.uid) {
                    await setDoc(userStatusRef, {
                        state: 'offline',
                        lastChanged: serverTimestamp(),
                        lastSeen: serverTimestamp(),
                        userId: currentUser.uid
                    }, { merge: true });
                }
            } catch (error) {
                console.error('Error setting offline status:', error);
            }
        };
        
        window.addEventListener('beforeunload', handleDisconnect);
        window.addEventListener('offline', handleDisconnect);
        
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                handleDisconnect();
            } else {
                if (currentUser && currentUser.uid) {
                    setDoc(userStatusRef, {
                        state: 'online',
                        lastChanged: serverTimestamp(),
                        userId: currentUser.uid,
                        lastSeen: null
                    });
                }
            }
        });
        
    } catch (error) {
        logError(error, 'setupUserOnlineStatus');
    }
}

// FIXED: Global message listener for unread counts with proper read status tracking
async function setupGlobalMessageListener() {
    if (!currentUser || !currentUser.uid) {
        return;
    }
    
    try {
        if (globalMessageListener) {
            globalMessageListener();
        }
        
        const threadsQuery = query(
            collection(db, 'conversations'),
            where('participants', 'array-contains', currentUser.uid)
        );
        
        globalMessageListener = onSnapshot(threadsQuery, async (snapshot) => {
            let totalUnread = 0;
            
            const threadPromises = snapshot.docs.map(async (doc) => {
                const thread = doc.data();
                const partnerId = thread.participants.find(id => id !== currentUser.uid);
                
                if (partnerId) {
                    try {
                        const messagesQuery = query(
                            collection(db, 'conversations', doc.id, 'messages'),
                            where('senderId', '==', partnerId),
                            where('read', '==', false)
                        );
                        
                        const messagesSnap = await getDocs(messagesQuery);
                        return messagesSnap.size;
                    } catch (error) {
                        logError(error, 'counting unread messages in thread');
                        return 0;
                    }
                }
                return 0;
            });
            
            const threadCounts = await Promise.all(threadPromises);
            totalUnread = threadCounts.reduce((sum, count) => sum + count, 0);
            
            updateMessageCount(totalUnread);
            cache.set(`unread_count_${currentUser.uid}`, totalUnread, 'short');
        });
        
    } catch (error) {
        logError(error, 'setting up global message listener');
        const cachedUnread = cache.get(`unread_count_${currentUser.uid}`) || 0;
        updateMessageCount(cachedUnread);
    }
}

// FIXED: Standalone function to refresh message count with accurate counting
async function refreshUnreadMessageCount() {
    if (!currentUser) return;
    
    try {
        const threadsQuery = query(
            collection(db, 'conversations'),
            where('participants', 'array-contains', currentUser.uid)
        );
        
        const threadsSnap = await getDocs(threadsQuery);
        let totalUnread = 0;
        
        for (const doc of threadsSnap.docs) {
            const thread = doc.data();
            const partnerId = thread.participants.find(id => id !== currentUser.uid);
            
            if (partnerId) {
                const messagesQuery = query(
                    collection(db, 'conversations', doc.id, 'messages'),
                    where('senderId', '==', partnerId),
                    where('read', '==', false)
                );
                
                const messagesSnap = await getDocs(messagesQuery);
                totalUnread += messagesSnap.size;
            }
        }
        
        updateMessageCount(totalUnread);
        cache.set(`unread_count_${currentUser.uid}`, totalUnread, 'short');
        
    } catch (error) {
        logError(error, 'refreshing unread message count');
        const cachedUnread = cache.get(`unread_count_${currentUser.uid}`) || 0;
        updateMessageCount(cachedUnread);
    }
}

// Update message count in navigation
function updateMessageCount(count) {
    messageCountElements.forEach(element => {
        if (count > 0) {
            element.textContent = count > 99 ? '99+' : count;
            element.style.display = 'flex';
        } else {
            element.style.display = 'none';
        }
    });
}

// Improved timestamp handling
function safeParseTimestamp(timestamp) {
    try {
        if (!timestamp) return null;
        if (typeof timestamp.toDate === 'function') return timestamp.toDate();
        if (typeof timestamp === 'number') return new Date(timestamp);
        if (typeof timestamp === 'string') return new Date(timestamp);
        return null;
    } catch (error) {
        logError(error, 'safeParseTimestamp');
        return null;
    }
}

// FIXED: Updated timestamp function to show appropriate time units
function formatTime(timestamp) {
    let date;
    
    try {
        if (typeof timestamp === 'string') {
            date = new Date(timestamp);
        } else if (timestamp && typeof timestamp.toDate === 'function') {
            date = timestamp.toDate();
        } else if (timestamp instanceof Date) {
            date = timestamp;
        } else if (typeof timestamp === 'number') {
            date = new Date(timestamp);
        } else {
            return '';
        }
        
        if (isNaN(date.getTime())) {
            return '';
        }
    } catch (error) {
        console.error('Error parsing timestamp:', error);
        return '';
    }
    
    const now = new Date();
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    
    if (diffHours < 24) {
        return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } else if (diffWeeks > 0) {
        return `${diffWeeks}w ago`;
    } else if (diffDays > 0) {
        return `${diffDays}d ago`;
    } else if (diffHours > 0) {
        return `${diffHours}h ago`;
    } else if (diffMins > 0) {
        return `${diffMins}m ago`;
    } else if (diffSecs > 30) {
        return `${diffSecs}s ago`;
    } else {
        return 'just now';
    }
}

// Initialize reaction picker
function initReactionPicker() {
    const reactionPicker = document.getElementById('reactionPicker');
    if (!reactionPicker) return;
    
    reactionPicker.innerHTML = '';
    
    EMOJI_REACTIONS.forEach(emoji => {
        const emojiButton = document.createElement('div');
        emojiButton.className = 'reaction-emoji';
        emojiButton.textContent = emoji;
        emojiButton.addEventListener('click', () => addReactionToMessage(emoji));
        reactionPicker.appendChild(emojiButton);
    });
}

// Show reaction picker for a message
function showReactionPicker(messageId, x, y) {
    const reactionPicker = document.getElementById('reactionPicker');
    if (!reactionPicker) return;
    
    selectedMessageForReaction = messageId;
    
    reactionPicker.style.left = `${x}px`;
    reactionPicker.style.bottom = `${window.innerHeight - y}px`;
    reactionPicker.style.display = 'flex';
    
    const hidePicker = (e) => {
        if (!reactionPicker.contains(e.target)) {
            reactionPicker.style.display = 'none';
            document.removeEventListener('click', hidePicker);
        }
    };
    
    setTimeout(() => {
        document.addEventListener('click', hidePicker);
    }, 10);
}

// Add reaction to a message
async function addReactionToMessage(emoji) {
    if (!selectedMessageForReaction || !currentUser || !chatPartnerId) return;
    
    try {
        const threadId = [currentUser.uid, chatPartnerId].sort().join('_');
        const messageRef = doc(db, 'conversations', threadId, 'messages', selectedMessageForReaction);
        const messageSnap = await getDoc(messageRef);
        
        if (messageSnap.exists()) {
            const messageData = messageSnap.data();
            const reactions = messageData.reactions || {};
            
            const userReactionIndex = reactions[emoji] ? reactions[emoji].indexOf(currentUser.uid) : -1;
            
            if (userReactionIndex > -1) {
                reactions[emoji].splice(userReactionIndex, 1);
                if (reactions[emoji].length === 0) {
                    delete reactions[emoji];
                }
            } else {
                if (!reactions[emoji]) {
                    reactions[emoji] = [];
                }
                reactions[emoji].push(currentUser.uid);
            }
            
            await updateDoc(messageRef, {
                reactions: reactions
            });
            
            document.getElementById('reactionPicker').style.display = 'none';
        }
    } catch (error) {
        logError(error, 'adding reaction to message');
        showNotification('Error adding reaction. Please try again.', 'error');
    }
}

// Show reply preview
function showReplyPreview(message) {
    const replyPreview = document.getElementById('replyPreview');
    const replyPreviewName = document.querySelector('.reply-preview-name');
    const replyPreviewText = document.querySelector('.reply-preview-text');
    
    if (!replyPreview || !replyPreviewName || !replyPreviewText) return;
    
    selectedMessageForReply = message.id;
    
    const senderName = message.senderId === currentUser.uid ? 'You' : document.getElementById('chatPartnerName').textContent;
    replyPreviewName.textContent = senderName;
    
    if (message.text) {
        replyPreviewText.textContent = message.text;
    } else if (message.imageUrl) {
        replyPreviewText.textContent = '📷 Photo';
    } else if (message.audioUrl) {
        replyPreviewText.textContent = '🎤 Voice message';
    } else if (message.videoUrl) {
        replyPreviewText.textContent = '🎥 Video message';
    }
    
    replyPreview.style.display = 'flex';
    
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.focus();
    }
}

// Cancel reply
function cancelReply() {
    const replyPreview = document.getElementById('replyPreview');
    if (replyPreview) {
        replyPreview.style.display = 'none';
    }
    selectedMessageForReply = null;
}

// Handle message long press for reactions - FIXED TO PREVENT ACCIDENTAL ACTIVATION
function setupMessageLongPress() {
    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) return;
    
    messagesContainer.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const messageElement = e.target.closest('.message');
        if (messageElement && messageElement.classList.contains('received')) {
            const messageId = messageElement.dataset.messageId;
            if (messageId) {
                showReactionPicker(messageId, e.clientX, e.clientY);
            }
        }
    });
    
    messagesContainer.addEventListener('touchstart', (e) => {
        const messageElement = e.target.closest('.message');
        if (messageElement && messageElement.classList.contains('received')) {
            const messageId = messageElement.dataset.messageId;
            if (messageId) {
                longPressTimer = setTimeout(() => {
                    showReactionPicker(messageId, e.touches[0].clientX, e.touches[0].clientY);
                }, 800);
            }
        }
    });
    
    messagesContainer.addEventListener('touchend', () => {
        clearTimeout(longPressTimer);
    });
    
    messagesContainer.addEventListener('touchmove', () => {
        clearTimeout(longPressTimer);
    });
}

// Enhanced swipe functionality for reply - FIXED TO PREVENT ACCIDENTAL ACTIVATION
function setupMessageSwipe() {
    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) return;
    
    let startX = 0;
    let startY = 0;
    let currentX = 0;
    let currentElement = null;
    let isSwiping = false;
    let swipeThreshold = 50;
    let tapThreshold = 10;
    let swipeStartTime = 0;
    
    messagesContainer.addEventListener('touchstart', (e) => {
        if (e.target.closest('.voice-message-play-btn') || 
            e.target.closest('.voice-message-controls') ||
            e.target.closest('.message-reactions') ||
            e.target.closest('.message-time') ||
            e.target.closest('.video-play-btn')) {
            return;
        }
        
        const messageElement = e.target.closest('.message');
        if (messageElement && messageElement.classList.contains('received')) {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            currentElement = messageElement;
            swipeStartTime = Date.now();
            isSwiping = true;
            
            if (!messageElement.querySelector('.message-swipe-action')) {
                const swipeAction = document.createElement('div');
                swipeAction.className = 'message-swipe-action';
                swipeAction.innerHTML = '<i class="fas fa-reply"></i>';
                messageElement.appendChild(swipeAction);
            }
            
            messageElement.style.transition = 'none';
        }
    });
    
    messagesContainer.addEventListener('touchmove', (e) => {
        if (!isSwiping || !currentElement) return;
        
        currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;
        const diffX = currentX - startX;
        const diffY = currentY - startY;
        
        if (Math.abs(diffX) < Math.abs(diffY)) {
            resetSwipeState();
            return;
        }
        
        if (diffX < 0) {
            resetSwipeState();
            return;
        }
        
        e.preventDefault();
        
        const maxSwipe = 100;
        const swipeDistance = Math.min(Math.max(diffX, 0), maxSwipe);
        
        currentElement.style.transform = `translateX(${swipeDistance}px)`;
        
        const swipeAction = currentElement.querySelector('.message-swipe-action');
        if (swipeAction) {
            const opacity = Math.min(Math.abs(swipeDistance) / maxSwipe, 1);
            swipeAction.style.opacity = opacity;
        }
    });
    
    messagesContainer.addEventListener('touchend', (e) => {
        if (!isSwiping || !currentElement) return;
        
        const diffX = currentX - startX;
        const swipeDuration = Date.now() - swipeStartTime;
        
        const isTap = Math.abs(diffX) < tapThreshold && swipeDuration < 300;
        
        if (isTap) {
            resetSwipeState();
            return;
        }
        
        if (diffX > swipeThreshold) {
            const messageId = currentElement.dataset.messageId;
            const cachedMessages = cache.get(`messages_${currentUser.uid}_${chatPartnerId}`) || [];
            const message = cachedMessages.find(m => m.id === messageId);
            if (message) {
                showReplyPreview(message);
            }
        }
        
        resetSwipeState();
    });
    
    function resetSwipeState() {
        if (!currentElement) return;
        
        currentElement.style.transition = 'transform 0.3s ease';
        currentElement.style.transform = 'translateX(0)';
        
        const swipeAction = currentElement.querySelector('.message-swipe-action');
        if (swipeAction) {
            swipeAction.style.opacity = '0';
        }
        
        setTimeout(() => {
            if (currentElement) {
                currentElement.style.transition = '';
            }
            isSwiping = false;
            currentElement = null;
            startX = 0;
            startY = 0;
            currentX = 0;
        }, 300);
    }
    
    messagesContainer.addEventListener('click', (e) => {
        const messageElement = e.target.closest('.message');
        if (messageElement && messageElement.classList.contains('received')) {
            if (e.target.tagName === 'IMG' && e.target.classList.contains('message-image')) {
                return;
            }
            
            if (e.target.tagName === 'VIDEO' || e.target.closest('.video-message')) {
                return;
            }
            
            if (!e.target.closest('.voice-message-play-btn') && 
                !e.target.closest('.voice-message-controls') &&
                !e.target.closest('.message-reactions') &&
                !e.target.closest('.message-time') &&
                !e.target.closest('.video-play-btn')) {
                e.stopPropagation();
            }
        }
    });
}

// UPDATED: Voice Note Functions - Optimized for faster response with offline support
async function startRecording() {
    try {
        document.getElementById('voiceNoteIndicator').style.display = 'flex';
        document.getElementById('messageInput').style.display = 'none';
        
        let stream;
        
        if (preloadedAudioStream) {
            stream = preloadedAudioStream;
            console.log('Using pre-loaded microphone stream');
        } else {
            const hasPermission = await requestMicrophonePermission();
            if (!hasPermission) {
                showNotification('Microphone access is required to send voice notes. Please enable microphone permissions in your browser settings.', 'warning');
                document.getElementById('voiceNoteIndicator').style.display = 'none';
                document.getElementById('messageInput').style.display = 'block';
                return;
            }
            
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }
        
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        
        recordingStartTime = Date.now();
        updateRecordingTimer();
        recordingTimer = setInterval(updateRecordingTimer, 1000);
        
        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };
        
        mediaRecorder.start(100);
        
        const stopRecordingOnRelease = () => {
            stopRecording();
            document.removeEventListener('mouseup', stopRecordingOnRelease);
        };
        
        document.addEventListener('mouseup', stopRecordingOnRelease);
    } catch (error) {
        logError(error, 'starting voice recording');
        showNotification('Could not access microphone. Please ensure you have granted microphone permissions.', 'error');
        
        document.getElementById('voiceNoteIndicator').style.display = 'none';
        document.getElementById('messageInput').style.display = 'block';
    }
}

function updateRecordingTimer() {
    const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
    document.getElementById('voiceNoteTimer').textContent = 
        `${Math.floor(elapsed / 60)}:${(elapsed % 60).toString().padStart(2, '0')}`;
}

async function stopRecording() {
    if (!mediaRecorder) return;
    
    clearInterval(recordingTimer);
    mediaRecorder.stop();
    
    if (!preloadedAudioStream) {
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
    
    await new Promise(resolve => {
        mediaRecorder.onstop = resolve;
    });
    
    document.getElementById('voiceNoteIndicator').style.display = 'none';
    document.getElementById('messageInput').style.display = 'block';
}

async function cancelRecording() {
    if (!mediaRecorder) return;
    
    clearInterval(recordingTimer);
    mediaRecorder.stop();
    
    if (!preloadedAudioStream) {
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
    
    document.getElementById('voiceNoteIndicator').style.display = 'none';
    document.getElementById('messageInput').style.display = 'block';
    
    mediaRecorder = null;
    audioChunks = [];
}

// UPDATED: Voice note sending with immediate display, offline support, and optimistic updates
async function sendVoiceNote() {
    if (audioChunks.length === 0) {
        showNotification('No recording to send', 'warning');
        return;
    }
    
    try {
        const hasPoints = await deductChatPoint();
        if (!hasPoints) {
            return;
        }

        const tempMessageId = 'temp_voice_' + Date.now();
        const duration = Math.floor((Date.now() - recordingStartTime) / 1000);
        
        const tempMessage = {
            id: tempMessageId,
            senderId: currentUser.uid,
            audioUrl: '',
            duration: duration,
            timestamp: new Date().toISOString(),
            status: 'sending'
        };

        displayMessage(tempMessage, currentUser.uid);
        
        const messagesContainer = document.getElementById('chatMessages');
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        document.getElementById('sendVoiceNoteBtn').innerHTML = 
            '<i class="fas fa-spinner fa-spin"></i> Uploading';
        document.getElementById('sendVoiceNoteBtn').disabled = true;
        
        const audioBlob = new Blob(audioChunks, { type: 'audio/mp3' });
        
        // NEW: Add to pending messages if offline
        if (!isOnline) {
            await cache.addPendingMessage({
                type: 'voice',
                tempId: tempMessageId,
                blob: audioBlob,
                duration: duration,
                threadId: [currentUser.uid, chatPartnerId].sort().join('_'),
                timestamp: new Date().toISOString()
            });
            showNotification('Voice note saved offline. Will send when connection is restored.', 'info');
            return;
        }
        
        const audioUrl = await uploadAudioToCloudinary(audioBlob);
        await addMessage(null, null, audioUrl, duration);
        
        document.getElementById('sendVoiceNoteBtn').innerHTML = 
            '<i class="fas fa-paper-plane"></i> Send';
        document.getElementById('sendVoiceNoteBtn').disabled = false;
        mediaRecorder = null;
        audioChunks = [];
    } catch (error) {
        logError(error, 'sending voice note');
        showNotification('Failed to send voice note. Please try again.', 'error');
        
        const tempMessageElement = document.querySelector(`[data-message-id="temp_voice_"]`);
        if (tempMessageElement) {
            tempMessageElement.remove();
        }
        
        document.getElementById('sendVoiceNoteBtn').innerHTML = 
            '<i class="fas fa-paper-plane"></i> Send';
        document.getElementById('sendVoiceNoteBtn').disabled = false;
    }
}

// Video Recording Functions
async function startVideoRecording() {
    try {
        const hasPermission = await requestCameraPermission();
        if (!hasPermission) {
            showNotification('Camera access is required to send video messages. Please enable camera permissions in your browser settings.', 'warning');
            return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        videoRecorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9,opus' });
        videoChunks = [];
        
        document.getElementById('videoRecordingIndicator').style.display = 'flex';
        document.getElementById('messageInput').style.display = 'none';
        
        videoRecordingStartTime = Date.now();
        updateVideoRecordingTimer();
        videoRecordingTimer = setInterval(updateVideoRecordingTimer, 1000);
        
        videoRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                videoChunks.push(event.data);
            }
        };
        
        videoRecorder.start(100);
        
        setTimeout(() => {
            if (videoRecorder && videoRecorder.state === 'recording') {
                stopVideoRecording();
            }
        }, 20000);
        
    } catch (error) {
        logError(error, 'starting video recording');
        showNotification('Could not access camera. Please ensure you have granted camera permissions.', 'error');
    }
}

function updateVideoRecordingTimer() {
    const elapsed = Math.floor((Date.now() - videoRecordingStartTime) / 1000);
    const remaining = 20 - elapsed;
    document.getElementById('videoRecordingTimer').textContent = 
        `0:${remaining.toString().padStart(2, '0')}`;
    
    if (remaining <= 0) {
        stopVideoRecording();
    }
}

async function stopVideoRecording() {
    if (!videoRecorder) return;
    
    clearInterval(videoRecordingTimer);
    videoRecorder.stop();
    
    videoRecorder.stream.getTracks().forEach(track => track.stop());
    
    await new Promise(resolve => {
        videoRecorder.onstop = resolve;
    });
    
    document.getElementById('videoRecordingIndicator').style.display = 'none';
    document.getElementById('messageInput').style.display = 'block';
    
    showVideoPreview();
}

async function cancelVideoRecording() {
    if (!videoRecorder) return;
    
    clearInterval(videoRecordingTimer);
    videoRecorder.stop();
    
    videoRecorder.stream.getTracks().forEach(track => track.stop());
    
    document.getElementById('videoRecordingIndicator').style.display = 'none';
    document.getElementById('messageInput').style.display = 'block';
    
    videoRecorder = null;
    videoChunks = [];
}

function showVideoPreview() {
    if (videoChunks.length === 0) return;
    
    const videoBlob = new Blob(videoChunks, { type: 'video/webm' });
    const videoUrl = URL.createObjectURL(videoBlob);
    
    const previewModal = document.createElement('div');
    previewModal.className = 'video-preview';
    previewModal.innerHTML = `
        <video controls autoplay>
            <source src="${videoUrl}" type="video/webm">
            Your browser does not support the video tag.
        </video>
        <div class="video-preview-controls">
            <button class="video-preview-btn" id="cancelVideoPreview">
                <i class="fas fa-times"></i>
            </button>
            <button class="video-preview-btn" id="sendVideoPreview">
                <i class="fas fa-paper-plane"></i>
            </button>
        </div>
    `;
    
    document.body.appendChild(previewModal);
    previewModal.style.display = 'flex';
    
    document.getElementById('cancelVideoPreview').addEventListener('click', () => {
        previewModal.remove();
        videoRecorder = null;
        videoChunks = [];
    });
    
    document.getElementById('sendVideoPreview').addEventListener('click', async () => {
        await sendVideoMessage(videoBlob);
        previewModal.remove();
    });
}

// UPDATED: Video message sending with immediate display and offline support
async function sendVideoMessage(videoBlob) {
    try {
        const hasPoints = await deductChatPoint();
        if (!hasPoints) {
            return;
        }

        const tempMessageId = 'temp_video_' + Date.now();
        const duration = Math.floor((Date.now() - videoRecordingStartTime) / 1000);
        
        const tempMessage = {
            id: tempMessageId,
            senderId: currentUser.uid,
            videoUrl: '',
            duration: duration,
            timestamp: new Date().toISOString(),
            status: 'sending'
        };

        displayMessage(tempMessage, currentUser.uid);
        
        const messagesContainer = document.getElementById('chatMessages');
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        const sendBtn = document.getElementById('sendVideoPreview');
        if (sendBtn) {
            sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            sendBtn.disabled = true;
        }
        
        // NEW: Add to pending messages if offline
        if (!isOnline) {
            await cache.addPendingMessage({
                type: 'video',
                tempId: tempMessageId,
                blob: videoBlob,
                duration: duration,
                threadId: [currentUser.uid, chatPartnerId].sort().join('_'),
                timestamp: new Date().toISOString()
            });
            showNotification('Video saved offline. Will send when connection is restored.', 'info');
            return;
        }
        
        const videoUrl = await uploadVideoToCloudinary(videoBlob);
        await addMessage(null, null, null, null, videoUrl, duration);
        
        videoRecorder = null;
        videoChunks = [];
    } catch (error) {
        logError(error, 'sending video message');
        showNotification('Failed to send video message. Please try again.', 'error');
        
        const tempMessageElement = document.querySelector(`[data-message-id="temp_video_"]`);
        if (tempMessageElement) {
            tempMessageElement.remove();
        }
    }
}

// Upload Functions - USING ONLY CLOUDINARY
async function uploadAudioToCloudinary(audioBlob) {
    const formData = new FormData();
    formData.append('file', audioBlob);
    formData.append('upload_preset', cloudinaryConfig.uploadPreset);
    formData.append('resource_type', 'auto');
    
    try {
        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/upload`,
            {
                method: 'POST',
                body: formData,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            }
        );
        
        if (!response.ok) {
            throw new Error(`Cloudinary error: ${response.statusText}`);
        }
        
        const data = await response.json();
        if (!data.secure_url) {
            throw new Error('Invalid response from Cloudinary');
        }
        return data.secure_url;
    } catch (error) {
        logError(error, 'uploading audio to Cloudinary');
        throw error;
    }
}

// Cloudinary video upload function
async function uploadVideoToCloudinary(videoBlob) {
    const formData = new FormData();
    formData.append('file', videoBlob);
    formData.append('upload_preset', cloudinaryConfig.uploadPreset);
    formData.append('resource_type', 'video');
    
    try {
        console.log('Uploading video to Cloudinary...');
        
        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/video/upload`,
            {
                method: 'POST',
                body: formData
            }
        );
        
        if (!response.ok) {
            throw new Error(`Cloudinary video upload failed: ${response.statusText}`);
        }
        
        const data = await response.json();
        if (!data.secure_url) {
            throw new Error('Invalid response from Cloudinary');
        }
        
        console.log('Cloudinary video upload successful');
        return data.secure_url;
    } catch (error) {
        console.error('Cloudinary video upload error:', error);
        throw new Error('Video upload failed. Please try again later.');
    }
}

// Upload file function for both images and videos
async function uploadFileToCloudinary(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', cloudinaryConfig.uploadPreset);
    
    const resourceType = file.type.startsWith('video/') ? 'video' : 'image';
    formData.append('resource_type', resourceType);
    
    try {
        if (!navigator.onLine) {
            throw new Error('No internet connection available');
        }

        if (resourceType === 'image') {
            validateImageFile(file);
        } else if (resourceType === 'video') {
            validateVideoFile(file);
        }

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
            throw new Error(`Cloudinary error: ${response.statusText}`);
        }
        
        const data = await response.json();
        if (!data.secure_url) {
            throw new Error('Invalid response from Cloudinary');
        }
        return data.secure_url;
    } catch (error) {
        logError(error, `uploading ${resourceType} to Cloudinary`);
        throw new Error(`Failed to upload ${resourceType}. Please check your connection and try again.`);
    }
}

async function uploadImageToCloudinary(file) {
    return uploadFileToCloudinary(file);
}

// UPDATED: Image sending with immediate display, offline support, and optimistic updates
async function sendImageMessage(file) {
    try {
        const hasPoints = await deductChatPoint();
        if (!hasPoints) {
            return;
        }

        const tempMessageId = 'temp_image_' + Date.now();
        
        const tempMessage = {
            id: tempMessageId,
            senderId: currentUser.uid,
            imageUrl: URL.createObjectURL(file),
            timestamp: new Date().toISOString(),
            status: 'sending'
        };

        displayMessage(tempMessage, currentUser.uid);
        
        const messagesContainer = document.getElementById('chatMessages');
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        // NEW: Add to pending messages if offline
        if (!isOnline) {
            await cache.addPendingMessage({
                type: 'image',
                tempId: tempMessageId,
                blob: file,
                threadId: [currentUser.uid, chatPartnerId].sort().join('_'),
                timestamp: new Date().toISOString()
            });
            showNotification('Image saved offline. Will send when connection is restored.', 'info');
            return;
        }

        const imageUrl = await uploadImageToCloudinary(file);
        URL.revokeObjectURL(tempMessage.imageUrl);

        await addMessage(null, imageUrl);

    } catch (error) {
        logError(error, 'sending image message');
        showNotification('Failed to send image. Please try again.', 'error');
        
        const tempMessageElement = document.querySelector(`[data-message-id="temp_image_"]`);
        if (tempMessageElement) {
            tempMessageElement.remove();
        }
    }
}

// FIXED: Updated voice note player with proper event handling
function createAudioPlayer(audioUrl, duration) {
    const audio = new Audio(audioUrl);
    const container = document.createElement('div');
    container.className = 'voice-message-controls';
    
    container.innerHTML = `
        <button class="voice-message-play-btn">
            <i class="fas fa-play"></i>
        </button>
        <div class="waveform">
            ${Array(5).fill('').map((_, i) => 
                `<div class="waveform-bar" style="height: 5px;"></div>`
            ).join('')}
        </div>
        <span class="voice-message-duration">${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}</span>
    `;
    
    const playBtn = container.querySelector('.voice-message-play-btn');
    const waveformBars = container.querySelectorAll('.waveform-bar');
    let animationInterval = null;
    
    const startAnimation = () => {
        if (animationInterval) {
            clearInterval(animationInterval);
        }
        
        animationInterval = setInterval(() => {
            waveformBars.forEach(bar => {
                const randomHeight = Math.floor(Math.random() * 15) + 5;
                bar.style.height = `${randomHeight}px`;
            });
        }, 100);
    };
    
    const stopAnimation = () => {
        if (animationInterval) {
            clearInterval(animationInterval);
            animationInterval = null;
        }
        waveformBars.forEach(bar => {
            bar.style.height = '5px';
        });
    };
    
    playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        
        if (audio.paused) {
            audio.play();
            playBtn.innerHTML = '<i class="fas fa-pause"></i>';
            startAnimation();
        } else {
            audio.pause();
            playBtn.innerHTML = '<i class="fas fa-play"></i>';
            stopAnimation();
        }
    });
    
    audio.onended = () => {
        playBtn.innerHTML = '<i class="fas fa-play"></i>';
        stopAnimation();
    };
    
    audio.onpause = () => {
        playBtn.innerHTML = '<i class="fas fa-play"></i>';
        stopAnimation();
    };
    
    return container;
}

// Video player function
function createVideoPlayer(videoUrl, duration) {
    const container = document.createElement('div');
    container.className = 'video-message';
    
    container.innerHTML = `
        <video controls>
            <source src="${videoUrl}" type="video/webm">
            Your browser does not support the video tag.
        </video>
        <div class="video-message-controls">
            <span class="video-duration">${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}</span>
        </div>
    `;
    
    return container;
}

// UPDATED: Display message function to handle image, voice, and video sending states with offline support
function displayMessage(message, currentUserId) {
    const messagesContainer = document.getElementById('chatMessages');
    
    const noMessagesDiv = messagesContainer.querySelector('.no-messages');
    if (noMessagesDiv) {
        noMessagesDiv.remove();
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.senderId === currentUserId ? 'sent' : 'received'}`;
    messageDiv.dataset.messageId = message.id;
    
    if (message.id && (message.id.startsWith('temp_') || message.status === 'sending')) {
        messageDiv.style.opacity = '0.7';
        messageDiv.classList.add('sending');
    }
    
    let messageContent = '';
    
    if (message.replyTo) {
        const repliedMessage = getRepliedMessage(message.replyTo);
        if (repliedMessage) {
            const senderName = repliedMessage.senderId === currentUserId ? 'You' : document.getElementById('chatPartnerName').textContent;
            let previewText = '';
            
            if (repliedMessage.text) {
                previewText = repliedMessage.text;
            } else if (repliedMessage.imageUrl) {
                previewText = '📷 Photo';
            } else if (repliedMessage.audioUrl) {
                previewText = '🎤 Voice message';
            } else if (repliedMessage.videoUrl) {
                previewText = '🎥 Video message';
            }
            
            messageContent += `
                <div class="reply-indicator">
                    <i class="fas fa-reply"></i> Replying to ${senderName}
                </div>
                <div class="reply-message-preview">${previewText}</div>
            `;
        }
    }
    
    if (message.imageUrl) {
        const imageContainer = document.createElement('div');
        imageContainer.style.position = 'relative';
        imageContainer.style.display = 'inline-block';
        
        const img = document.createElement('img');
        img.src = message.imageUrl;
        img.alt = "Message image";
        img.className = 'message-image';
        
        if (message.id && message.id.startsWith('temp_') || message.status === 'sending') {
            img.classList.add('sending');
            
            const sendingIndicator = document.createElement('div');
            sendingIndicator.className = 'sending-indicator';
            sendingIndicator.innerHTML = '<i class="fas fa-spinner"></i> Sending...';
            imageContainer.appendChild(sendingIndicator);
        }
        
        imageContainer.appendChild(img);
        messageContent += imageContainer.outerHTML;
    } else if (message.text) {
        messageContent += `<p>${message.text}</p>`;
    }
    
    if (message.reactions && Object.keys(message.reactions).length > 0) {
        messageContent += `<div class="message-reactions">`;
        for (const [emoji, users] of Object.entries(message.reactions)) {
            messageContent += `<span class="reaction">${emoji} <span class="reaction-count">${users.length}</span></span>`;
        }
        messageContent += `</div>`;
    }
    
    let timestampText = '';
    if (message.id && message.id.startsWith('temp_') || message.status === 'sending') {
        timestampText = 'Sending...';
    } else {
        timestampText = formatTime(message.timestamp);
        if (message.senderId === currentUserId && message.read) {
            timestampText += ' ✓✓';
        }
    }
    
    messageContent += `<span class="message-time">${timestampText}</span>`;
    
    messageDiv.innerHTML = messageContent;
    
    if (message.audioUrl || (message.id && message.id.startsWith('temp_voice'))) {
        const voiceMessageDiv = document.createElement('div');
        voiceMessageDiv.className = `voice-message ${message.senderId === currentUserId ? 'sent' : 'received'}`;
        
        if (message.id && message.id.startsWith('temp_voice') || message.status === 'sending') {
            voiceMessageDiv.classList.add('sending');
            const sendingOverlay = document.createElement('div');
            sendingOverlay.className = 'sending-overlay';
            sendingOverlay.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
            voiceMessageDiv.appendChild(sendingOverlay);
        }
        
        const audioPlayer = createAudioPlayer(message.audioUrl || '', message.duration || 0);
        voiceMessageDiv.appendChild(audioPlayer);
        
        const timeSpan = document.createElement('span');
        timeSpan.className = 'message-time';
        timeSpan.textContent = timestampText;
        
        messageDiv.appendChild(voiceMessageDiv);
    }
    
    if (message.videoUrl || (message.id && message.id.startsWith('temp_video'))) {
        const videoPlayer = createVideoPlayer(message.videoUrl || '', message.duration || 0);
        
        if (message.id && message.id.startsWith('temp_video') || message.status === 'sending') {
            videoPlayer.classList.add('sending');
            const sendingOverlay = document.createElement('div');
            sendingOverlay.className = 'sending-overlay';
            sendingOverlay.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
            videoPlayer.appendChild(sendingOverlay);
        }
        
        messageDiv.appendChild(videoPlayer);
    }
    
    messagesContainer.appendChild(messageDiv);
}

// Loading message functions
function showFastLoadingMessage() {
    const existingMessages = document.querySelectorAll('.fast-loading-message');
    existingMessages.forEach(msg => msg.remove());
    
    const loadingMsg = document.createElement('div');
    loadingMsg.className = 'fast-loading-message';
    loadingMsg.innerHTML = '<i class="fas fa-bolt"></i> Loading content...';
    
    const mainContent = document.querySelector('main') || document.querySelector('.container') || document.body;
    mainContent.insertBefore(loadingMsg, mainContent.firstChild);
    
    setTimeout(() => {
        loadingMsg.remove();
    }, 3000);
}

function showChatLoadingMessage() {
    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) return;
    
    hideChatLoadingMessage();
    
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading-message';
    loadingDiv.innerHTML = `
        <div class="dot-pulse"></div>
        <span>Loading messages...</span>
    `;
    messagesContainer.appendChild(loadingDiv);
}

function hideChatLoadingMessage() {
    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) return;
    
    const loadingMessage = messagesContainer.querySelector('.loading-message');
    if (loadingMessage) {
        loadingMessage.remove();
    }
}

function showMessagesLoadingMessage() {
    const messagesList = document.getElementById('messagesList');
    if (!messagesList) return;
    
    messagesList.innerHTML = `
        <div class="page-loader">
            <div class="dot-pulse"></div>
            <span>Loading conversations...</span>
        </div>
    `;
}

function hideMessagesLoadingMessage() {
    const loadingMessage = document.querySelector('#messagesList .page-loader');
    if (loadingMessage) {
        loadingMessage.remove();
    }
}

// NEW: Show instant loading overlay
function showInstantLoading() {
    const instantLoading = document.getElementById('instantLoading');
    if (instantLoading) {
        instantLoading.style.display = 'flex';
    }
}

// NEW: Hide instant loading overlay
function hideInstantLoading() {
    const instantLoading = document.getElementById('instantLoading');
    if (instantLoading) {
        instantLoading.style.display = 'none';
    }
}

// Add this function to handle page cleanup
function cleanupChatPage() {
    if (unsubscribeChat) {
        unsubscribeChat();
        unsubscribeChat = null;
    }
    
    if (chatPartnerId && currentUser) {
        updateTypingStatus(false);
    }
    
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        if (!preloadedAudioStream) {
            mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }
    }
    
    if (videoRecorder && videoRecorder.state !== 'inactive') {
        videoRecorder.stop();
        videoRecorder.stream.getTracks().forEach(track => track.stop());
    }
    
    if (typingTimeout) clearTimeout(typingTimeout);
    if (recordingTimer) clearInterval(recordingTimer);
    if (videoRecordingTimer) clearInterval(videoRecordingTimer);
    if (longPressTimer) clearTimeout(longPressTimer);
    
    chatPartnerId = null;
}

// UPDATED: Chat messages loading with IndexedDB caching and offline support
function loadChatMessages(userId, partnerId) {
    const messagesContainer = document.getElementById('chatMessages');
    
    if (unsubscribeChat) {
        unsubscribeChat();
    }
    
    const threadId = [userId, partnerId].sort().join('_');
    
    showChatLoadingMessage();
    
    // NEW: Show instant loading for background sync
    showInstantLoading();
    
    // Try to load cached messages first
    const cacheKey = `messages_${userId}_${partnerId}`;
    const cachedMessages = cache.get(cacheKey);
    
    if (cachedMessages && cachedMessages.length > 0) {
        displayCachedMessages(cachedMessages);
    }
    
    // Also try IndexedDB
    cache.getMessages(threadId).then(messages => {
        if (messages && messages.length > 0 && (!cachedMessages || messages.length > cachedMessages.length)) {
            displayCachedMessages(messages);
        }
    });
    
    try {
        unsubscribeChat = onSnapshot(
            collection(db, 'conversations', threadId, 'messages'),
            async (snapshot) => {
                const messages = [];
                let hasUnreadMessages = false;
                
                snapshot.forEach(doc => {
                    const messageData = doc.data();
                    const serializableMessage = {
                        id: doc.id,
                        ...messageData,
                        timestamp: messageData.timestamp ? 
                            (messageData.timestamp.toDate ? messageData.timestamp.toDate().toISOString() : messageData.timestamp) 
                            : new Date().toISOString()
                    };
                    messages.push(serializableMessage);
                    
                    if (messageData.senderId === partnerId && !messageData.read) {
                        hasUnreadMessages = true;
                    }
                });
                
                messages.sort((a, b) => {
                    const timeA = new Date(a.timestamp).getTime();
                    const timeB = new Date(b.timestamp).getTime();
                    return timeA - timeB;
                });
                
                cache.set(cacheKey, messages, 'short');
                await cache.setMessages(threadId, messages);
                
                updateMessagesDisplay(messages, userId);
                
                if (hasUnreadMessages) {
                    await markMessagesAsRead(threadId, partnerId, userId);
                }
                
                setTimeout(() => {
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                }, 100);
                
                if (document.querySelector('#chatMessages .loading-message')) {
                    hideChatLoadingMessage();
                }
                
                // NEW: Hide instant loading after data is loaded
                hideInstantLoading();
                
                refreshUnreadMessageCount();
            },
            (error) => {
                logError(error, 'chat messages listener');
                if (cachedMessages) {
                    displayCachedMessages(cachedMessages);
                }
                hideChatLoadingMessage();
                hideInstantLoading();
            }
        );
    } catch (error) {
        logError(error, 'setting up chat messages listener');
        hideChatLoadingMessage();
        hideInstantLoading();
    }
}

// FIXED: Mark messages as read when viewing chat
async function markMessagesAsRead(threadId, partnerId, userId) {
    try {
        const unreadMessagesQuery = query(
            collection(db, 'conversations', threadId, 'messages'),
            where('senderId', '==', partnerId),
            where('read', '==', false)
        );
        
        const unreadMessagesSnap = await getDocs(unreadMessagesQuery);
        
        const updatePromises = [];
        unreadMessagesSnap.forEach((doc) => {
            updatePromises.push(updateDoc(doc.ref, {
                read: true
            }));
        });
        
        await Promise.all(updatePromises);
        
        refreshUnreadMessageCount();
        
    } catch (error) {
        logError(error, 'marking messages as read');
    }
}

// FIXED: Updated message display function to prevent duplicates
function updateMessagesDisplay(newMessages, currentUserId) {
    const messagesContainer = document.getElementById('chatMessages');
    
    const tempMessages = messagesContainer.querySelectorAll('[data-message-id^="temp_"]');
    tempMessages.forEach(msg => msg.remove());
    
    hideChatLoadingMessage();
    
    const existingMessages = messagesContainer.querySelectorAll('.message:not([data-message-id^="temp_"])');
    if (existingMessages.length === 0 && newMessages.length > 0) {
        messagesContainer.innerHTML = '';
    }
    
    newMessages.forEach(message => {
        const existingMessage = messagesContainer.querySelector(`[data-message-id="${message.id}"]`);
        if (!existingMessage) {
            displayMessage(message, currentUserId);
        } else {
            updateExistingMessage(existingMessage, message, currentUserId);
        }
    });
    
    if (newMessages.length === 0 && messagesContainer.children.length === 0) {
        const noMessagesDiv = document.createElement('div');
        noMessagesDiv.className = 'no-messages';
        noMessagesDiv.textContent = 'No messages yet. Start the conversation!';
        messagesContainer.appendChild(noMessagesDiv);
    }
}

// UPDATED: Add message function with offline support and optimistic updates
async function addMessage(text = null, imageUrl = null, audioUrl = null, audioDuration = null, videoUrl = null, videoDuration = null) {
    if (!text && !imageUrl && !audioUrl && !videoUrl) return;
    
    try {
        const threadId = [currentUser.uid, chatPartnerId].sort().join('_');
        
        const messageData = {
            senderId: currentUser.uid,
            text: text || null,
            imageUrl: imageUrl || null,
            audioUrl: audioUrl || null,
            duration: audioDuration || videoDuration || null,
            videoUrl: videoUrl || null,
            read: false,
            timestamp: serverTimestamp()
        };
        
        if (selectedMessageForReply) {
            messageData.replyTo = selectedMessageForReply;
        }
        
        const tempMessageId = 'temp_' + Date.now();
        const tempMessage = {
            id: tempMessageId,
            ...messageData,
            timestamp: new Date().toISOString()
        };
        
        window.lastTempMessageId = tempMessageId;
        
        displayMessage(tempMessage, currentUser.uid);
        
        const messagesContainer = document.getElementById('chatMessages');
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        // NEW: Add to pending messages if offline
        if (!isOnline) {
            await cache.addPendingMessage({
                type: 'text',
                tempId: tempMessageId,
                data: messageData,
                threadId: threadId,
                timestamp: new Date().toISOString()
            });
            showNotification('Message saved offline. Will send when connection is restored.', 'info');
            return;
        }
        
        const docRef = await addDoc(collection(db, 'conversations', threadId, 'messages'), messageData);
        
        let lastMessageText = '';
        if (text) lastMessageText = text;
        else if (imageUrl) lastMessageText = 'Image';
        else if (audioUrl) lastMessageText = 'Voice message';
        else if (videoUrl) lastMessageText = 'Video message';
        
        await setDoc(doc(db, 'conversations', threadId), {
            participants: [currentUser.uid, chatPartnerId],
            lastMessage: {
                text: lastMessageText,
                senderId: currentUser.uid,
                timestamp: serverTimestamp()
            },
            updatedAt: serverTimestamp()
        }, { merge: true });
        
        cancelReply();
        
    } catch (error) {
        logError(error, 'adding message');
        showNotification('Error sending message. Please try again.', 'error');
        
        const tempMessageElement = document.querySelector(`[data-message-id="${window.lastTempMessageId}"]`);
        if (tempMessageElement) {
            tempMessageElement.remove();
        }
    }
}

// FIXED: Update existing message without recreating it
function updateExistingMessage(existingElement, message, currentUserId) {
    updateMessageReactions(existingElement, message);
    
    if (message.senderId === currentUserId && message.read) {
        const timeElement = existingElement.querySelector('.message-time');
        if (timeElement && !timeElement.textContent.includes('✓✓')) {
            timeElement.textContent = timeElement.textContent.replace('✓', '✓✓');
        }
    }
    
    if (existingElement.classList.contains('sending')) {
        const timeElement = existingElement.querySelector('.message-time');
        if (timeElement && timeElement.textContent === 'Sending...') {
            timeElement.textContent = formatTime(message.timestamp);
            existingElement.style.opacity = '1';
            existingElement.classList.remove('sending');
            
            const sendingIndicator = existingElement.querySelector('.sending-indicator');
            if (sendingIndicator) {
                sendingIndicator.remove();
            }
            
            const image = existingElement.querySelector('.message-image.sending');
            if (image) {
                image.classList.remove('sending');
            }
            
            const sendingOverlay = existingElement.querySelector('.sending-overlay');
            if (sendingOverlay) {
                sendingOverlay.remove();
            }
            
            const voiceMessage = existingElement.querySelector('.voice-message.sending');
            if (voiceMessage) {
                voiceMessage.classList.remove('sending');
            }
            
            const videoMessage = existingElement.querySelector('.video-message.sending');
            if (videoMessage) {
                videoMessage.classList.remove('sending');
            }
        }
    }
}

// FIXED: Update only the reactions part of a message
function updateMessageReactions(messageElement, message) {
    let reactionsContainer = messageElement.querySelector('.message-reactions');
    const reactions = message.reactions || {};
    
    if (Object.keys(reactions).length === 0) {
        if (reactionsContainer) {
            reactionsContainer.remove();
        }
        return;
    }
    
    if (!reactionsContainer) {
        reactionsContainer = document.createElement('div');
        reactionsContainer.className = 'message-reactions';
        
        const timeElement = messageElement.querySelector('.message-time');
        if (timeElement) {
            messageElement.insertBefore(reactionsContainer, timeElement);
        } else {
            messageElement.appendChild(reactionsContainer);
        }
    }
    
    reactionsContainer.innerHTML = '';
    for (const [emoji, users] of Object.entries(reactions)) {
        const reactionElement = document.createElement('span');
        reactionElement.className = 'reaction';
        reactionElement.innerHTML = `${emoji} <span class="reaction-count">${users.length}</span>`;
        reactionsContainer.appendChild(reactionElement);
    }
}

// FIXED: Updated displayCachedMessages function to handle loading state properly
function displayCachedMessages(messages) {
    const messagesContainer = document.getElementById('chatMessages');
    
    hideChatLoadingMessage();
    
    if (messages.length === 0) {
        const noMessagesDiv = document.createElement('div');
        noMessagesDiv.className = 'no-messages';
        noMessagesDiv.textContent = 'No messages yet. Start the conversation!';
        messagesContainer.appendChild(noMessagesDiv);
        return;
    }
    
    messages.sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return timeA - timeB;
    });
    
    messages.forEach(message => {
        const existingMessage = document.querySelector(`[data-message-id="${message.id}"]`);
        if (!existingMessage) {
            displayMessage(message, currentUser.uid);
        }
    });
    
    setTimeout(() => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, 100);
}

function getRepliedMessage(messageId) {
    const cachedMessages = cache.get(`messages_${currentUser.uid}_${chatPartnerId}`) || [];
    return cachedMessages.find(m => m.id === messageId);
}

// UPDATED: Page Initialization Functions with preloading
function initLandingPage() {
    showFastLoadingMessage();
}

function initLoginPage() {
    const loginForm = document.getElementById('loginForm');
    const togglePassword = document.getElementById('toggleLoginPassword');
    const resetPasswordLink = document.getElementById('resetPassword');

    if (loginForm) {
        eventManager.addListener(loginForm, 'submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;

            try {
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;
                
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (userDoc.exists() && userDoc.data().accountDisabled) {
                    window.location.href = 'disabled.html';
                    return;
                }
                
                showNotification('Login successful! Redirecting...', 'success');
                setTimeout(() => {
                    window.location.href = 'mingle.html';
                }, 1500);
                
            } catch (error) {
                logError(error, 'login');
                showNotification(error.message, 'error');
            }
        });
    }

    if (togglePassword) {
        eventManager.addListener(togglePassword, 'click', () => {
            const passwordInput = document.getElementById('loginPassword');
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            togglePassword.innerHTML = type === 'password' ? '<i class="far fa-eye"></i>' : '<i class="far fa-eye-slash"></i>';
        });
    }

    if (resetPasswordLink) {
        eventManager.addListener(resetPasswordLink, 'click', async (e) => {
            e.preventDefault();
            const email = prompt('Please enter your email address:');
            if (email) {
                try {
                    await sendPasswordResetEmail(auth, email);
                    showNotification('Password reset email sent. Please check your inbox.', 'success');
                } catch (error) {
                    logError(error, 'resetPassword');
                    showNotification(error.message, 'error');
                }
            }
        });
    }
}

function initSignupPage() {
    const signupForm = document.getElementById('signupForm');
    const togglePassword = document.getElementById('toggleSignupPassword');

    if (signupForm) {
        eventManager.addListener(signupForm, 'submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('signupEmail').value;
            const password = document.getElementById('signupPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;

            if (password !== confirmPassword) {
                showNotification('Passwords do not match', 'error');
                return;
            }

            try {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;
                
                await setDoc(doc(db, 'users', user.uid), {
                    email: email,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    profileComplete: false,
                    chatPoints: 12,
                    paymentHistory: [],
                    accountDisabled: false
                });
                
                showNotification('Account created successfully! Redirecting...', 'success');
                setTimeout(() => {
                    window.location.href = 'account.html';
                }, 1500);
                
            } catch (error) {
                logError(error, 'signup');
                showNotification(error.message, 'error');
            }
        });
    }

    if (togglePassword) {
        eventManager.addListener(togglePassword, 'click', () => {
            const passwordInput = document.getElementById('signupPassword');
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            togglePassword.innerHTML = type === 'password' ? '<i class="far fa-eye"></i>' : '<i class="far fa-eye-slash"></i>';
        });
    }
}

function initDashboardPage() {
    const logoutBtn = document.getElementById('logoutBtn');
    const mingleBtn = document.getElementById('mingleBtn');
    const messagesBtn = document.getElementById('messagesBtn');
    const profileBtn = document.getElementById('profileBtn');
    const accountBtn = document.getElementById('accountBtn');
    const purchasePointsBtn = document.getElementById('purchasePointsBtn');

    loadUserChatPoints();

    if (logoutBtn) {
        eventManager.addListener(logoutBtn, 'click', handleLogout);
    }

    if (mingleBtn) {
        eventManager.addListener(mingleBtn, 'click', () => {
            window.location.href = 'mingle.html';
        });
    }

    if (messagesBtn) {
        eventManager.addListener(messagesBtn, 'click', () => {
            window.location.href = 'messages.html';
        });
    }

    if (profileBtn) {
        eventManager.addListener(profileBtn, 'click', () => {
            window.location.href = 'profile.html';
        });
    }

    if (accountBtn) {
        eventManager.addListener(accountBtn, 'click', () => {
            window.location.href = 'account.html';
        });
    }

    if (purchasePointsBtn) {
        eventManager.addListener(purchasePointsBtn, 'click', () => {
            window.location.href = 'payment.html';
        });
    }
}

function initPaymentPage() {
    const logoutBtn = document.getElementById('logoutBtn');
    const backBtn = document.getElementById('backBtn');
    const planButtons = document.querySelectorAll('.plan-button');
    const paymentForm = document.getElementById('paymentForm');
    const copyBtns = document.querySelectorAll('.copy-btn');

    loadUserChatPoints();

    if (logoutBtn) {
        eventManager.addListener(logoutBtn, 'click', handleLogout);
    }

    if (backBtn) {
        eventManager.addListener(backBtn, 'click', () => {
            window.location.href = 'dashboard.html';
        });
    }

    planButtons.forEach(button => {
        eventManager.addListener(button, 'click', () => {
            planButtons.forEach(btn => btn.classList.remove('selected'));
            button.classList.add('selected');
            document.getElementById('selectedPlan').value = button.dataset.plan;
        });
    });

    copyBtns.forEach(btn => {
        eventManager.addListener(btn, 'click', (e) => {
            e.preventDefault();
            const address = btn.dataset.address;
            navigator.clipboard.writeText(address).then(() => {
                const originalText = btn.innerHTML;
                btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                setTimeout(() => {
                    btn.innerHTML = originalText;
                }, 2000);
            }).catch(err => {
                console.error('Could not copy text: ', err);
            });
        });
    });

    if (paymentForm) {
        eventManager.addListener(paymentForm, 'submit', async (e) => {
            e.preventDefault();
            
            const plan = document.getElementById('selectedPlan').value;
            const transactionId = document.getElementById('transactionId').value.trim();
            const email = document.getElementById('paymentEmail').value.trim();
            
            if (!plan) {
                showNotification('Please select a plan', 'warning');
                return;
            }
            
            if (!transactionId) {
                showNotification('Please enter your transaction ID', 'warning');
                return;
            }
            
            try {
                const userRef = doc(db, 'users', currentUser.uid);
                
                const paymentData = {
                    plan,
                    transactionId,
                    email,
                    status: 'pending',
                    date: new Date().toISOString()
                };
                
                await updateDoc(userRef, {
                    paymentHistory: arrayUnion(paymentData),
                    updatedAt: serverTimestamp()
                });
                
                showNotification('Payment submitted successfully! Our team will verify your payment and add your chat points soon.', 'success');
                paymentForm.reset();
            } catch (error) {
                logError(error, 'submitting payment');
                showNotification('Error submitting payment. Please try again.', 'error');
            }
        });
    }
}

function initAdminPage() {
    const loginForm = document.getElementById('adminLoginForm');
    const paymentList = document.getElementById('paymentList');
    const adminContent = document.getElementById('adminContent');
    const logoutBtn = document.getElementById('adminLogoutBtn');

    showFastLoadingMessage();

    const isAdmin = sessionStorage.getItem('adminLoggedIn') === 'true';
    if (isAdmin) {
        showAdminContent();
        loadPendingPayments();
    } else {
        showLoginForm();
    }

    if (loginForm) {
        eventManager.addListener(loginForm, 'submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('adminEmail').value;
            const password = document.getElementById('adminPassword').value;
            
            if (email === 'cypriandavidonyebuchi@gmail.com' && password === 'admin123') {
                sessionStorage.setItem('adminLoggedIn', 'true');
                showAdminContent();
                loadPendingPayments();
            } else {
                showNotification('Invalid admin credentials', 'error');
            }
        });
    }

    if (logoutBtn) {
        eventManager.addListener(logoutBtn, 'click', () => {
            sessionStorage.removeItem('adminLoggedIn');
            showLoginForm();
        });
    }

    function showLoginForm() {
        if (loginForm) loginForm.style.display = 'block';
        if (adminContent) adminContent.style.display = 'none';
    }

    function showAdminContent() {
        if (loginForm) loginForm.style.display = 'none';
        if (adminContent) adminContent.style.display = 'block';
    }

    async function loadPendingPayments() {
        try {
            const usersRef = collection(db, 'users');
            const usersSnap = await getDocs(usersRef);
            
            paymentList.innerHTML = '';
            
            for (const userDoc of usersSnap.docs) {
                const userData = userDoc.data();
                if (userData.paymentHistory && userData.paymentHistory.length > 0) {
                    const pendingPayments = userData.paymentHistory.filter(p => p.status === 'pending');
                    
                    for (const payment of pendingPayments) {
                        const paymentItem = document.createElement('div');
                        paymentItem.className = 'payment-item';
                        paymentItem.innerHTML = `
                            <div class="payment-info">
                                <p><strong>User:</strong> ${userData.email}</p>
                                <p><strong>Plan:</strong> ${payment.plan}</p>
                                <p><strong>Transaction ID:</strong> ${payment.transactionId}</p>
                                <p><strong>Date:</strong> ${formatTime(payment.date)}</p>
                            </div>
                            <div class="payment-actions">
                                <button class="approve-btn" data-user="${userDoc.id}" data-tx="${payment.transactionId}" data-plan="${payment.plan}">Approve</button>
                                <button class="reject-btn" data-user="${userDoc.id}" data-tx="${payment.transactionId}">Reject</button>
                            </div>
                        `;
                        
                        paymentList.appendChild(paymentItem);
                    }
                }
            }
            
            document.querySelectorAll('.approve-btn').forEach(btn => {
                eventManager.addListener(btn, 'click', async () => {
                    const userId = btn.dataset.user;
                    const txId = btn.dataset.tx;
                    const plan = btn.dataset.plan;
                    
                    try {
                        const userRef = doc(db, 'users', userId);
                        const userSnap = await getDoc(userRef);
                        
                        if (userSnap.exists()) {
                            const updatedPayments = userSnap.data().paymentHistory.map(p => {
                                if (p.transactionId === txId) {
                                    return { ...p, status: 'approved' };
                                }
                                return p;
                            });
                            
                            let pointsToAdd = 0;
                            switch (plan) {
                                case '30_points': pointsToAdd = 30; break;
                                case '300_points': pointsToAdd = 300; break;
                                case 'lifetime': pointsToAdd = 9999; break;
                            }
                            
                            await updateDoc(userRef, {
                                paymentHistory: updatedPayments,
                                chatPoints: (userSnap.data().chatPoints || 0) + pointsToAdd,
                                updatedAt: serverTimestamp()
                            });
                            
                            showNotification('Payment approved and points added!', 'success');
                            loadPendingPayments();
                        }
                    } catch (error) {
                        logError(error, 'approving payment');
                        showNotification('Error approving payment', 'error');
                    }
                });
            });
            
            document.querySelectorAll('.reject-btn').forEach(btn => {
                eventManager.addListener(btn, 'click', async () => {
                    const userId = btn.dataset.user;
                    const txId = btn.dataset.tx;
                    
                    try {
                        const userRef = doc(db, 'users', userId);
                        const userSnap = await getDoc(userRef);
                        
                        if (userSnap.exists()) {
                            const updatedPayments = userSnap.data().paymentHistory.map(p => {
                                if (p.transactionId === txId) {
                                    return { ...p, status: 'rejected' };
                                }
                                return p;
                            });
                            
                            await updateDoc(userRef, {
                                paymentHistory: updatedPayments,
                                updatedAt: serverTimestamp()
                            });
                            
                            showNotification('Payment rejected!', 'success');
                            loadPendingPayments();
                        }
                    } catch (error) {
                        logError(error, 'rejecting payment');
                        showNotification('Error rejecting payment', 'error');
                    }
                });
            });
        } catch (error) {
            logError(error, 'loading pending payments');
            paymentList.innerHTML = '<p>Error loading payments. Please try again.</p>';
        }
    }
}

// UPDATED: Mingle page with grid layout
function initMinglePage() {
    const logoutBtn = document.getElementById('logoutBtn');
    const dashboardBtn = document.getElementById('dashboardBtn');
    const mingleGrid = document.getElementById('mingleGrid');

    // Create grid container if it doesn't exist
    if (!mingleGrid) {
        const mainContent = document.querySelector('main') || document.querySelector('.container');
        if (mainContent) {
            const gridContainer = document.createElement('div');
            gridContainer.id = 'mingleGrid';
            gridContainer.className = 'mingle-grid';
            mainContent.innerHTML = '';
            mainContent.appendChild(gridContainer);
        }
    }

    loadProfiles();

    if (logoutBtn) {
        eventManager.addListener(logoutBtn, 'click', handleLogout);
    }

    if (dashboardBtn) {
        eventManager.addListener(dashboardBtn, 'click', () => {
            window.location.href = 'dashboard.html';
        });
    }
}

// UPDATED: Load profiles with grid display
async function loadProfiles(forceRefresh = false) {
    if (!forceRefresh) {
        const cachedProfiles = await cache.getProfiles();
        if (cachedProfiles && cachedProfiles.length > 0) {
            profiles = cachedProfiles;
            shuffleProfiles();
            if (profiles.length > 0) {
                displayProfilesGrid();
            } else {
                showNoProfilesMessage();
            }
        }
    }

    try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('__name__', '!=', currentUser.uid));
        const querySnapshot = await getDocs(q);
        
        profiles = [];
        querySnapshot.forEach(doc => {
            profiles.push({ id: doc.id, ...doc.data() });
        });
        
        shuffleProfiles();
        
        cache.set('mingle_profiles', profiles, 'short');
        await cache.setProfiles(profiles);
        
        if (profiles.length > 0) {
            displayProfilesGrid();
        } else {
            showNoProfilesMessage();
        }
    } catch (error) {
        logError(error, 'loading profiles');
        if (profiles.length === 0) {
            showNoProfilesMessage();
        }
    }
}

// NEW: Display profiles in grid format
// NEW: Display profiles in grid format
function displayProfilesGrid() {
    const mingleGrid = document.getElementById('mingleGrid');
    if (!mingleGrid) return;
    
    mingleGrid.innerHTML = '';
    
    if (profiles.length === 0) {
        mingleGrid.innerHTML = '<div class="no-profiles-message">No profiles found. Check back later for new profiles.</div>';
        return;
    }
    
    profiles.forEach(profile => {
        const profileCard = document.createElement('div');
        profileCard.className = 'profile-grid-card';
        
        let ageLocation = '';
        if (profile.age) ageLocation += `${profile.age}`;
        if (profile.location) ageLocation += ageLocation ? ` • ${profile.location}` : profile.location;
        
        profileCard.innerHTML = `
            <img src="${profile.profileImage || 'images-default-profile.jpg'}" 
                 alt="${profile.name || 'Profile'}" 
                 class="profile-grid-image">
            <div class="profile-grid-status" id="grid-status-${profile.id}"></div>
            <div class="profile-grid-content">
                <h3 class="profile-grid-name">${profile.name || 'Unknown'}</h3>
                <p class="profile-grid-details">${ageLocation}</p>
                <p class="profile-grid-bio">${profile.bio || 'No bio available'}</p>
                <div class="profile-grid-actions">
                    <div class="profile-grid-likes">
                        <i class="fas fa-heart"></i>
                        <span>${profile.likes || 0}</span>
                    </div>
                    <button class="profile-grid-like-btn" data-profile-id="${profile.id}">
                        <i class="fas fa-heart"></i> Like
                    </button>
                </div>
            </div>
        `;
        
        // Add click event to profile image to navigate to profile page
        const profileImage = profileCard.querySelector('.profile-grid-image');
        profileImage.style.cursor = 'pointer';
        eventManager.addListener(profileImage, 'click', () => {
            window.location.href = `profile.html?id=${profile.id}`;
        });
        
        // Add like button functionality
        const likeBtn = profileCard.querySelector('.profile-grid-like-btn');
        eventManager.addListener(likeBtn, 'click', async (e) => {
            e.stopPropagation();
            await handleGridLike(profile.id, likeBtn);
        });
        
        mingleGrid.appendChild(profileCard);
        
        // Setup online status for this profile
        setupOnlineStatusListener(profile.id, `grid-status-${profile.id}`);
    });
}


// NEW: Handle like in grid view
async function handleGridLike(profileId, likeButton) {
    if (!currentUser) {
        showNotification('Please log in to like profiles', 'error');
        return;
    }

    try {
        const likedRef = collection(db, 'users', currentUser.uid, 'liked');
        const likedQuery = query(likedRef, where('userId', '==', profileId));
        const likedSnap = await getDocs(likedQuery);
        
        if (!likedSnap.empty) {
            showNotification('You already liked this profile!', 'info');
            return;
        }

        await addDoc(collection(db, 'users', currentUser.uid, 'liked'), {
            userId: profileId,
            timestamp: serverTimestamp(),
            likedAt: new Date().toISOString()
        });
        
        const profileRef = doc(db, 'users', profileId);
        const profileSnap = await getDoc(profileRef);
        
        if (profileSnap.exists()) {
            const currentLikes = profileSnap.data().likes || 0;
            await updateDoc(profileRef, {
                likes: currentLikes + 1,
                updatedAt: serverTimestamp()
            });
            
            // Update the like count display
            const likesElement = likeButton.parentElement.querySelector('.profile-grid-likes span');
            if (likesElement) {
                likesElement.textContent = currentLikes + 1;
            }
        }
        
        likeButton.innerHTML = '<i class="fas fa-heart"></i> Liked';
        likeButton.classList.add('liked');
        likeButton.disabled = true;
        
        showNotification('Profile liked successfully!', 'success');
        
    } catch (error) {
        logError(error, 'liking profile from grid');
        showNotification('Error liking profile. Please try again.', 'error');
    }
}

function shuffleProfiles() {
    for (let i = profiles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [profiles[i], profiles[j]] = [profiles[j], profiles[i]];
    }
}

function showNoProfilesMessage() {
    const mingleGrid = document.getElementById('mingleGrid');
    if (mingleGrid) {
        mingleGrid.innerHTML = '<div class="no-profiles-message">No profiles found. Check back later for new profiles.</div>';
    }
}

function initProfilePage() {
    const backToMingle = document.getElementById('backToMingle');
    const messageProfileBtn = document.getElementById('messageProfileBtn');
    const likeProfileBtn = document.getElementById('likeProfileBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const dashboardBtn = document.getElementById('dashboardBtn');
    const thumbnails = document.querySelectorAll('.thumbnail');

    const urlParams = new URLSearchParams(window.location.search);
    const profileId = urlParams.get('id');

    window.currentProfileId = profileId;

    if (profileId) {
        loadProfileData(profileId);
    } else {
        showNotification('No profile selected', 'error');
        setTimeout(() => {
            window.location.href = 'mingle.html';
        }, 2000);
        return;
    }

    thumbnails.forEach(thumbnail => {
        eventManager.addListener(thumbnail, 'click', () => {
            thumbnails.forEach(t => t.classList.remove('active'));
            thumbnail.classList.add('active');
            document.getElementById('mainProfileImage').src = thumbnail.src;
        });
    });

    if (backToMingle) {
        eventManager.addListener(backToMingle, 'click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Back to mingle clicked');
            window.location.href = 'mingle.html';
        });
    } else {
        console.error('Back to mingle button not found');
    }

    if (messageProfileBtn) {
        eventManager.addListener(messageProfileBtn, 'click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Message profile clicked');
            
            const urlParams = new URLSearchParams(window.location.search);
            const profileId = urlParams.get('id');
            
            if (profileId) {
                window.location.href = `chat.html?id=${profileId}`;
            } else {
                showNotification('Cannot message this profile', 'error');
            }
        });
    } else {
        console.error('Message profile button not found');
    }

    if (likeProfileBtn) {
        eventManager.addListener(likeProfileBtn, 'click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Like profile clicked');
            
            await handleLikeProfile(likeProfileBtn);
        });
    } else {
        console.error('Like profile button not found');
    }

    if (logoutBtn) {
        eventManager.addListener(logoutBtn, 'click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleLogout();
        });
    }

    if (dashboardBtn) {
        eventManager.addListener(dashboardBtn, 'click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.location.href = 'dashboard.html';
        });
    }
}

// Handle like profile function
async function handleLikeProfile(likeButton) {
    const profileIdToLike = window.currentProfileId;
    
    if (!profileIdToLike) {
        showNotification('Cannot like this profile', 'error');
        return;
    }

    if (!currentUser) {
        showNotification('Please log in to like profiles', 'error');
        return;
    }

    try {
        const likedRef = collection(db, 'users', currentUser.uid, 'liked');
        const likedQuery = query(likedRef, where('userId', '==', profileIdToLike));
        const likedSnap = await getDocs(likedQuery);
        
        if (!likedSnap.empty) {
            showNotification('You already liked this profile!', 'info');
            return;
        }

        await addDoc(collection(db, 'users', currentUser.uid, 'liked'), {
            userId: profileIdToLike,
            timestamp: serverTimestamp(),
            likedAt: new Date().toISOString()
        });
        
        const profileRef = doc(db, 'users', profileIdToLike);
        const profileSnap = await getDoc(profileRef);
        
        if (profileSnap.exists()) {
            const currentLikes = profileSnap.data().likes || 0;
            await updateDoc(profileRef, {
                likes: currentLikes + 1,
                updatedAt: serverTimestamp()
            });
            
            const likeCountElement = document.getElementById('viewLikeCount');
            if (likeCountElement) {
                likeCountElement.textContent = currentLikes + 1;
            }
        }
        
        likeButton.innerHTML = '<i class="fas fa-heart"></i> Liked';
        likeButton.classList.add('liked');
        likeButton.disabled = true;
        
        showNotification('Profile liked successfully!', 'success');
        
    } catch (error) {
        logError(error, 'liking profile from profile page');
        showNotification('Error liking profile. Please try again.', 'error');
    }
}

function initAccountPage() {
    const profileImageUpload = document.getElementById('profileImageUpload');
    const removeProfileImage = document.getElementById('removeProfileImage');
    const accountMenuItems = document.querySelectorAll('.menu-item');
    const addInterestBtn = document.getElementById('addInterestBtn');
    const profileForm = document.getElementById('profileForm');
    const settingsForm = document.getElementById('settingsForm');
    const privacyForm = document.getElementById('privacyForm');
    const logoutBtn = document.getElementById('logoutBtn');
    const dashboardBtn = document.getElementById('dashboardBtn');

    accountMenuItems.forEach(item => {
        eventManager.addListener(item, 'click', () => {
            accountMenuItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            
            document.querySelectorAll('.account-section').forEach(section => {
                section.style.display = 'none';
            });
            
            document.getElementById(`${item.dataset.section}Section`).style.display = 'block';
        });
    });

    if (profileImageUpload) {
        eventManager.addListener(profileImageUpload, 'change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    const uploadButton = document.querySelector('.upload-button');
                    if (uploadButton) {
                        uploadButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
                        uploadButton.disabled = true;
                    }

                    const imageUrl = await uploadImageToCloudinary(file);
                    
                    await updateDoc(doc(db, 'users', currentUser.uid), {
                        profileImage: imageUrl,
                        updatedAt: serverTimestamp()
                    });
                    
                    document.getElementById('accountProfileImage').src = imageUrl;
                    
                    if (uploadButton) {
                        uploadButton.innerHTML = '<i class="fas fa-upload"></i> Upload Image';
                        uploadButton.disabled = false;
                    }
                } catch (error) {
                    logError(error, 'uploading profile image');
                    showNotification('Failed to upload image. Please check your connection and try again.', 'error');
                    
                    const uploadButton = document.querySelector('.upload-button');
                    if (uploadButton) {
                        uploadButton.innerHTML = '<i class="fas fa-upload"></i> Upload Image';
                        uploadButton.disabled = false;
                    }
                }
            }
        });
    }

    if (removeProfileImage) {
        eventManager.addListener(removeProfileImage, 'click', async () => {
            try {
                await updateDoc(doc(db, 'users', currentUser.uid), {
                    profileImage: null,
                    updatedAt: serverTimestamp()
                });
                
                document.getElementById('accountProfileImage').src = 'images-default-profile.jpg';
            } catch (error) {
                logError(error, 'removing profile image');
                showNotification('Error removing image: ' + error.message, 'error');
            }
        });
    }

    if (addInterestBtn) {
        eventManager.addListener(addInterestBtn, 'click', () => {
            const interestInput = document.getElementById('accountInterests');
            const interest = interestInput.value.trim();
            
            if (interest) {
                const interestsContainer = document.getElementById('accountInterestsContainer');
                const existingInterests = interestsContainer.querySelectorAll('.interest-tag');
                
                if (existingInterests.length >= 5) {
                    showNotification('You can only add up to 5 interests', 'warning');
                    return;
                }
                
                const interestTag = document.createElement('span');
                interestTag.className = 'interest-tag';
                interestTag.textContent = interest;
                
                const removeBtn = document.createElement('span');
                removeBtn.innerHTML = ' &times;';
                removeBtn.style.cursor = 'pointer';
                removeBtn.addEventListener('click', () => {
                    interestTag.remove();
                });
                
                interestTag.appendChild(removeBtn);
                interestsContainer.appendChild(interestTag);
                interestInput.value = '';
            }
        });
    }

    if (profileForm) {
        eventManager.addListener(profileForm, 'submit', async (e) => {
            e.preventDefault();
            
            const name = document.getElementById('accountName').value;
            const age = document.getElementById('accountAge').value;
            const gender = document.getElementById('accountGender').value;
            const location = document.getElementById('accountLocation').value;
            const bio = document.getElementById('accountBio').value;
            const phone = document.getElementById('accountPhone').value;
            
            const interestsContainer = document.getElementById('accountInterestsContainer');
            const interests = Array.from(interestsContainer.querySelectorAll('.interest-tag')).map(tag => 
                tag.textContent.replace(' ×', '')
            );
            
            try {
                await updateDoc(doc(db, 'users', currentUser.uid), {
                    name,
                    age: parseInt(age),
                    gender,
                    location,
                    bio,
                    phone: phone || null,
                    interests,
                    profileComplete: true,
                    updatedAt: serverTimestamp()
                });
                
                showNotification('Profile updated successfully!', 'success');
            } catch (error) {
                logError(error, 'updating profile');
                showNotification('Error updating profile: ' + error.message, 'error');
            }
        });
    }

    if (settingsForm) {
        eventManager.addListener(settingsForm, 'submit', async (e) => {
            e.preventDefault();
            
            const currentPassword = document.getElementById('currentPassword').value;
            const newPassword = document.getElementById('newPassword').value;
            const confirmNewPassword = document.getElementById('confirmNewPassword').value;
            
            if (newPassword !== confirmNewPassword) {
                showNotification('New passwords do not match', 'error');
                return;
            }
            
            if (newPassword && !currentPassword) {
                showNotification('Please enter your current password', 'warning');
                return;
            }
            
            try {
                if (newPassword) {
                    showNotification('Password change not possible at the moment', 'info');
                }
                
                settingsForm.reset();
                showNotification('Settings updated successfully!', 'success');
            } catch (error) {
                logError(error, 'updating settings');
                showNotification('Error updating settings: ' + error.message, 'error');
            }
        });
    }

    if (privacyForm) {
        eventManager.addListener(privacyForm, 'submit', async (e) => {
            e.preventDefault();
            
            const showAge = document.getElementById('showAge').checked;
            const showLocation = document.getElementById('showLocation').checked;
            const showOnlineStatus = document.getElementById('showOnlineStatus').checked;
            
            try {
                await updateDoc(doc(db, 'users', currentUser.uid), {
                    privacySettings: {
                        showAge,
                        showLocation,
                        showOnlineStatus
                    },
                    updatedAt: serverTimestamp()
                });
                
                showNotification('Privacy settings updated successfully!', 'success');
            } catch (error) {
                logError(error, 'updating privacy settings');
                showNotification('Error updating privacy settings: ' + error.message, 'error');
            }
        });
    }

    if (logoutBtn) {
        eventManager.addListener(logoutBtn, 'click', handleLogout);
    }

    if (dashboardBtn) {
        eventManager.addListener(dashboardBtn, 'click', () => {
            window.location.href = 'dashboard.html';
        });
    }
}

// UPDATED: Chat page initialization with optimized voice recording, image sending, and offline support
function initChatPage() {
    const backToMessages = document.getElementById('backToMessages');
    const messageInput = document.getElementById('messageInput');
    const sendMessageBtn = document.getElementById('sendMessageBtn');
    const attachmentBtn = document.getElementById('attachmentBtn');
    const imageUpload = document.getElementById('imageUpload');
    const videoUpload = document.getElementById('videoUpload');
    const voiceNoteBtn = document.getElementById('voiceNoteBtn');
    const videoNoteBtn = document.getElementById('videoNoteBtn');
    const voiceNoteIndicator = document.getElementById('voiceNoteIndicator');
    const voiceNoteTimer = document.getElementById('voiceNoteTimer');
    const cancelVoiceNoteBtn = document.getElementById('cancelVoiceNoteBtn');
    const sendVoiceNoteBtn = document.getElementById('sendVoiceNoteBtn');
    const videoRecordingIndicator = document.getElementById('videoRecordingIndicator');
    const videoRecordingTimer = document.getElementById('videoRecordingTimer');
    const cancelVideoRecordingBtn = document.getElementById('cancelVideoRecordingBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const dashboardBtn = document.getElementById('dashboardBtn');
    const cancelReplyBtn = document.getElementById('cancelReply');

    showChatLoadingMessage();

    const urlParams = new URLSearchParams(window.location.search);
    chatPartnerId = urlParams.get('id');

    if (unsubscribeChat) {
        unsubscribeChat();
        unsubscribeChat = null;
    }

    if (chatPartnerId) {
        const cachedPartnerData = cache.get(`partner_${chatPartnerId}`);
        if (cachedPartnerData) {
            displayChatPartnerData(cachedPartnerData);
        } else {
            loadChatPartnerData(chatPartnerId);
        }

        loadChatMessages(currentUser.uid, chatPartnerId);
        
        setupTypingIndicator();
        setupMessageLongPress();
        setupMessageSwipe();
    } else {
        showNotification('No chat selected', 'error');
        setTimeout(() => {
            window.location.href = 'messages.html';
        }, 2000);
        return;
    }

    if (backToMessages) {
        eventManager.addListener(backToMessages, 'click', () => {
            cleanupChatPage();
            window.location.href = 'messages.html';
        });
    }

    async function sendMessage() {
        const message = messageInput.value.trim();
        if (message) {
            const hasPoints = await deductChatPoint();
            if (!hasPoints) {
                return;
            }
            
            sendMessageBtn.disabled = true;
            
            messageInput.value = '';
            
            try {
                await addMessage(message);
                cancelReply();
            } catch (error) {
                logError(error, 'sending message');
                showNotification('Error sending message. Please try again.', 'error');
            } finally {
                sendMessageBtn.disabled = false;
                sendMessageBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
            }
        }
    }

    if (sendMessageBtn) {
        eventManager.addListener(sendMessageBtn, 'click', sendMessage);
    }

    if (messageInput) {
        eventManager.addListener(messageInput, 'keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }

    if (messageInput) {
        eventManager.addListener(messageInput, 'input', () => {
            updateTypingStatus(true);
            
            clearTimeout(typingTimeout);
            typingTimeout = setTimeout(() => {
                updateTypingStatus(false);
            }, 2000);
        });
    }

    if (attachmentBtn) {
        eventManager.addListener(attachmentBtn, 'click', () => {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'image/*,video/*';
            fileInput.multiple = false;
            
            fileInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file) {
                    try {
                        const originalText = attachmentBtn.innerHTML;
                        attachmentBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                        attachmentBtn.disabled = true;
                        
                        if (file.type.startsWith('image/')) {
                            await sendImageMessage(file);
                        } else if (file.type.startsWith('video/')) {
                            const fileUrl = await uploadFileToCloudinary(file);
                            await addMessage(null, null, null, null, fileUrl, 0);
                        }
                        
                        attachmentBtn.innerHTML = originalText;
                        attachmentBtn.disabled = false;
                        cancelReply();
                    } catch (error) {
                        logError(error, 'uploading file');
                        showNotification('Failed to upload file. Please check your connection and try again.', 'error');
                        
                        attachmentBtn.innerHTML = '<i class="fas fa-paperclip"></i>';
                        attachmentBtn.disabled = false;
                    }
                }
            });
            
            fileInput.click();
        });
    }

    if (voiceNoteBtn) {
        eventManager.addListener(voiceNoteBtn, 'mousedown', async () => {
            document.getElementById('voiceNoteIndicator').style.display = 'flex';
            document.getElementById('messageInput').style.display = 'none';
            
            try {
                await startRecording();
            } catch (error) {
                document.getElementById('voiceNoteIndicator').style.display = 'none';
                document.getElementById('messageInput').style.display = 'block';
                showNotification('Could not start recording. Please try again.', 'error');
            }
        });
    }

    if (cancelVoiceNoteBtn) {
        eventManager.addListener(cancelVoiceNoteBtn, 'click', cancelRecording);
    }

    if (sendVoiceNoteBtn) {
        eventManager.addListener(sendVoiceNoteBtn, 'click', sendVoiceNote);
    }

    if (videoNoteBtn) {
        eventManager.addListener(videoNoteBtn, 'click', async () => {
            const hasPermission = await requestCameraPermission();
            if (hasPermission) {
                startVideoRecording();
            } else {
                showNotification('Camera access is required to send video messages. Please enable camera permissions in your browser settings.', 'warning');
            }
        });
    }

    if (cancelVideoRecordingBtn) {
        eventManager.addListener(cancelVideoRecordingBtn, 'click', cancelVideoRecording);
    }

    if (cancelReplyBtn) {
        eventManager.addListener(cancelReplyBtn, 'click', cancelReply);
    }

    if (logoutBtn) {
        eventManager.addListener(logoutBtn, 'click', handleLogout);
    }

    if (dashboardBtn) {
        eventManager.addListener(dashboardBtn, 'click', () => {
            window.location.href = 'dashboard.html';
        });
    }
}

// UPDATED: Messages page with preloading
function initMessagesPage() {
    const logoutBtn = document.getElementById('logoutBtn');
    const messageSearch = document.getElementById('messageSearch');
    const dashboardBtn = document.getElementById('dashboardBtn');

    showMessagesLoadingMessage();

    const cachedThreads = cache.get(`threads_${currentUser.uid}`);
    if (cachedThreads) {
        renderMessageThreads(cachedThreads);
        hideMessagesLoadingMessage();
    } else {
        showMessagesLoadingMessage();
    }

    loadMessageThreads();

    if (messageSearch) {
        eventManager.addListener(messageSearch, 'input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const messageCards = document.querySelectorAll('.message-card');
            
            messageCards.forEach(card => {
                const name = card.querySelector('h3').textContent.toLowerCase();
                const message = card.querySelector('p').textContent.toLowerCase();
                
                if (name.includes(searchTerm) || message.includes(searchTerm)) {
                    card.style.display = 'flex';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    }

    if (logoutBtn) {
        eventManager.addListener(logoutBtn, 'click', handleLogout);
    }

    if (dashboardBtn) {
        eventManager.addListener(dashboardBtn, 'click', () => {
            window.location.href = 'dashboard.html';
        });
    }
}

// Data Loading Functions
async function loadUserData(userId) {
    const cachedData = cache.get(`user_${userId}`);
    if (cachedData) {
        updateAccountPage(cachedData);
        return cachedData;
    }

    try {
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
            const userData = userSnap.data();
            cache.set(`user_${userId}`, userData, 'long');
            updateAccountPage(userData);
            return userData;
        }
        return null;
    } catch (error) {
        logError(error, 'loading user data');
        return null;
    }
}

function updateAccountPage(userData) {
    if (currentPage !== 'account') return;
    
    document.getElementById('accountName').value = userData.name || '';
    document.getElementById('accountAge').value = userData.age || '';
    document.getElementById('accountGender').value = userData.gender || 'male';
    document.getElementById('accountLocation').value = userData.location || '';
    document.getElementById('accountBio').value = userData.bio || '';
    document.getElementById('accountEmail').value = userData.email || '';
    document.getElementById('accountPhone').value = userData.phone || '';
    
    if (userData.profileImage) {
        document.getElementById('accountProfileImage').src = userData.profileImage;
    }
    
    const interestsContainer = document.getElementById('accountInterestsContainer');
    interestsContainer.innerHTML = '';
    
    if (userData.interests && userData.interests.length > 0) {
        userData.interests.forEach(interest => {
            const interestTag = document.createElement('span');
            interestTag.className = 'interest-tag';
            interestTag.textContent = interest;
            
            const removeBtn = document.createElement('span');
            removeBtn.innerHTML = ' &times;';
            removeBtn.style.cursor = 'pointer';
            removeBtn.addEventListener('click', () => {
                interestTag.remove();
            });
            
            interestTag.appendChild(removeBtn);
            interestsContainer.appendChild(interestTag);
        });
    }
    
    if (userData.privacySettings) {
        document.getElementById('showAge').checked = userData.privacySettings.showAge !== false;
        document.getElementById('showLocation').checked = userData.privacySettings.showLocation !== false;
        document.getElementById('showOnlineStatus').checked = userData.privacySettings.showOnlineStatus !== false;
    }
}

// UPDATED: Load profile data with caching
async function loadProfileData(profileId) {
    const cachedProfile = cache.get(`profile_${profileId}`);
    if (cachedProfile) {
        displayProfileData(cachedProfile);
    }

    try {
        const profileRef = doc(db, 'users', profileId);
        const profileSnap = await getDoc(profileRef);
        
        if (profileSnap.exists()) {
            const profileData = profileSnap.data();
            cache.set(`profile_${profileId}`, profileData, 'medium');
            displayProfileData(profileData);
            
            const likedRef = collection(db, 'users', currentUser.uid, 'liked');
            const likedQuery = query(likedRef, where('userId', '==', profileId));
            const likedSnap = await getDocs(likedQuery);
            
            if (!likedSnap.empty) {
                document.getElementById('likeProfileBtn').innerHTML = '<i class="fas fa-heart"></i> Liked';
                document.getElementById('likeProfileBtn').classList.add('liked');
            }
            
            setupOnlineStatusListener(profileId);
        } else {
            window.location.href = 'mingle.html';
        }
    } catch (error) {
        logError(error, 'loading profile data');
        window.location.href = 'mingle.html';
    }
}

function displayProfileData(profileData) {
    document.getElementById('mainProfileImage').src = profileData.profileImage || 'images-default-profile.jpg';
    document.querySelectorAll('.thumbnail')[0].src = profileData.profileImage || 'images-default-profile.jpg';
    document.getElementById('viewProfileName').textContent = profileData.name || 'Unknown';
    
    let ageText = '';
    if (profileData.age) ageText = `${profileData.age}`;
    document.getElementById('viewProfileAge').textContent = ageText;
    
    if (profileData.location) {
        document.getElementById('viewProfileLocation').textContent = profileData.location;
    } else {
        document.getElementById('viewProfileLocation').textContent = '';
    }
    
    document.getElementById('viewProfileBio').textContent = profileData.bio || 'No bio available';
    document.getElementById('viewLikeCount').textContent = profileData.likes || 0;
    
    const interestsContainer = document.getElementById('interestsContainer');
    interestsContainer.innerHTML = '';
    
    if (profileData.interests && profileData.interests.length > 0) {
        profileData.interests.forEach(interest => {
            const interestTag = document.createElement('span');
            interestTag.className = 'interest-tag';
            interestTag.textContent = interest;
            interestsContainer.appendChild(interestTag);
        });
    }
    
    const profileImageContainer = document.querySelector('.profile-image-container');
    if (profileImageContainer) {
        const existingIndicator = profileImageContainer.querySelector('.online-status');
        if (existingIndicator) {
            existingIndicator.remove();
        }
        
        const statusIndicator = document.createElement('div');
        statusIndicator.id = 'profileStatusIndicator';
        statusIndicator.className = 'online-status';
        profileImageContainer.appendChild(statusIndicator);
        
        setupOnlineStatusListener(profileData.id, 'profileStatusIndicator');
    }
}

async function loadChatPartnerData(partnerId) {
    try {
        const partnerRef = doc(db, 'users', partnerId);
        const partnerSnap = await getDoc(partnerRef);
        
        if (partnerSnap.exists()) {
            const partnerData = partnerSnap.data();
            cache.set(`partner_${partnerId}`, partnerData, 'medium');
            displayChatPartnerData(partnerData);
            
            setupOnlineStatusListener(partnerId, 'chatPartnerStatus');
        }
    } catch (error) {
        logError(error, 'loading chat partner data');
    }
}

function displayChatPartnerData(partnerData) {
    document.getElementById('chatPartnerImage').src = partnerData.profileImage || 'images-default-profile.jpg';
    document.getElementById('chatPartnerName').textContent = partnerData.name || 'Unknown';
}

// FIXED: Setup online status listener with proper disconnect handling
function setupOnlineStatusListener(userId, elementId = 'onlineStatus') {
    try {
        const statusRef = doc(db, 'status', userId);
        
        onSnapshot(statusRef, (doc) => {
            const statusData = doc.data();
            const status = statusData?.state || 'offline';
            const element = document.getElementById(elementId);
            
            if (element) {
                if (status === 'online') {
                    element.innerHTML = '<i class="fas fa-circle"></i>';
                    element.style.color = 'var(--accent-color)';
                    element.title = 'Online';
                } else {
                    element.innerHTML = '<i class="far fa-circle"></i>';
                    element.style.color = 'var(--text-light)';
                    if (statusData?.lastSeen) {
                        const lastSeen = statusData.lastSeen.toDate ? 
                            statusData.lastSeen.toDate() : 
                            new Date(statusData.lastSeen);
                        element.title = `Last seen ${formatTime(lastSeen)}`;
                    } else {
                        element.title = 'Offline';
                    }
                }
            }
        });
    } catch (error) {
        logError(error, 'setting up online status listener');
    }
}

async function markMessageAsRead(messageRef) {
    try {
        await updateDoc(messageRef, {
            read: true
        });
    } catch (error) {
        logError(error, 'marking message as read');
    }
}

// UPDATED: Load message threads with IndexedDB caching
async function loadMessageThreads(forceRefresh = false) {
    const messagesList = document.getElementById('messagesList');
    
    if (!forceRefresh) {
        const cachedThreads = await cache.getConversations();
        if (cachedThreads && cachedThreads.length > 0) {
            renderMessageThreads(cachedThreads);
            hideMessagesLoadingMessage();
        }
    }
    
    try {
        const threadsQuery = query(
            collection(db, 'conversations'),
            where('participants', 'array-contains', currentUser.uid)
        );
        
        unsubscribeMessages = onSnapshot(threadsQuery, async (snapshot) => {
            const threads = [];
            
            snapshot.forEach(doc => {
                threads.push({ id: doc.id, ...doc.data() });
            });
            
            threads.sort((a, b) => {
                const timeA = a.lastMessage?.timestamp?.toMillis ? a.lastMessage.timestamp.toMillis() : (new Date(a.lastMessage?.timestamp)).getTime();
                const timeB = b.lastMessage?.timestamp?.toMillis ? b.lastMessage.timestamp.toMillis() : (new Date(b.lastMessage?.timestamp)).getTime();
                return (timeB || 0) - (timeA || 0);
            });
            
            const threadsWithData = [];
            let totalUnread = 0;
            
            for (const thread of threads) {
                const partnerId = thread.participants.find(id => id !== currentUser.uid);
                if (!partnerId) continue;
                
                try {
                    const partnerRef = doc(db, 'users', partnerId);
                    const partnerSnap = await getDoc(partnerRef);
                    
                    if (!partnerSnap.exists()) continue;
                    
                    let unreadCount = 0;
                    try {
                        const messagesQuery = query(
                            collection(db, 'conversations', thread.id, 'messages'),
                            where('senderId', '==', partnerId),
                            where('read', '==', false)
                        );
                        const messagesSnap = await getDocs(messagesQuery);
                        unreadCount = messagesSnap.size;
                    } catch (error) {
                        logError(error, 'getting unread count');
                    }
                    
                    totalUnread += unreadCount;
                    
                    threadsWithData.push({
                        ...thread,
                        partnerData: partnerSnap.data(),
                        unreadCount
                    });
                } catch (error) {
                    logError(error, 'loading thread data');
                }
            }
            
            cache.set(`threads_${currentUser.uid}`, threadsWithData, 'short');
            await cache.setConversations(threadsWithData);
            
            renderMessageThreads(threadsWithData);
            updateMessageCount(totalUnread);
            hideMessagesLoadingMessage();
        });
    } catch (error) {
        logError(error, 'loading message threads');
        messagesList.innerHTML = '<p class="no-messages">Error loading messages. Please refresh the page.</p>';
        hideMessagesLoadingMessage();
    }
}

function renderMessageThreads(threads) {
    const messagesList = document.getElementById('messagesList');
    messagesList.innerHTML = '';
    
    if (threads.length === 0) {
        messagesList.innerHTML = '<p class="no-messages">No messages yet. Start mingling!</p>';
        return;
    }
    
    threads.forEach(thread => {
        const messageCard = document.createElement('div');
        messageCard.className = 'message-card';
        
        let messagePreview = thread.lastMessage?.text || 'New match';
        if (messagePreview.split(' ').length > 3) {
            messagePreview = messagePreview.split(' ').slice(0, 3).join(' ') + '...';
        }
        
        const messageTime = thread.lastMessage?.timestamp 
            ? formatTime(thread.lastMessage.timestamp)
            : '';
        
        messageCard.innerHTML = `
            <img src="${thread.partnerData.profileImage || 'images-default-profile.jpg'}" 
                 alt="${thread.partnerData.name}">
            <div class="message-content">
                <h3>${thread.partnerData.name || 'Unknown'} 
                    <span class="message-time">${messageTime}</span>
                </h3>
                <p>${messagePreview}</p>
            </div>
            ${thread.unreadCount > 0 ? `<span class="unread-count">${thread.unreadCount}</span>` : ''}
            <div class="online-status" id="status-${thread.participants.find(id => id !== currentUser.uid)}">
                <i class="fas fa-circle"></i>
            </div>
        `;
        
        messageCard.addEventListener('click', () => {
            window.location.href = `chat.html?id=${
                thread.participants.find(id => id !== currentUser.uid)
            }`;
        });
        
        messagesList.appendChild(messageCard);
        
        const partnerId = thread.participants.find(id => id !== currentUser.uid);
        if (partnerId) {
            setupOnlineStatusListener(partnerId, `status-${partnerId}`);
        }
    });
}

function setupTypingIndicator() {
    try {
        const threadId = [currentUser.uid, chatPartnerId].sort().join('_');
        const typingRef = doc(db, 'typing', threadId);
        
        onSnapshot(typingRef, (doc) => {
            const typingData = doc.data();
            const typingIndicator = document.getElementById('typingIndicator');
            
            if (typingData && typingData[chatPartnerId]) {
                document.getElementById('partnerNameTyping').textContent = 
                    document.getElementById('chatPartnerName').textContent;
                typingIndicator.style.display = 'block';
            } else {
                typingIndicator.style.display = 'none';
            }
        });
    } catch (error) {
        logError(error, 'setting up typing indicator');
    }
}

async function updateTypingStatus(isTyping) {
    try {
        const threadId = [currentUser.uid, chatPartnerId].sort().join('_');
        const typingRef = doc(db, 'typing', threadId);
        
        await setDoc(typingRef, {
            [currentUser.uid]: isTyping
        }, { merge: true });
    } catch (error) {
        logError(error, 'updating typing status');
    }
}

// UPDATED: Clean up listeners when leaving page with offline support
window.addEventListener('beforeunload', () => {
    try {
        if (unsubscribeMessages) {
            unsubscribeMessages();
            unsubscribeMessages = null;
        }
        
        cleanupChatPage();
        
        if (globalMessageListener) {
            globalMessageListener();
            globalMessageListener = null;
        }
        
        eventManager.clearAll();
        optimisticUpdates.cleanupOldUpdates();
        
        if (currentUser && currentUser.uid && auth.currentUser) {
            const userStatusRef = doc(db, 'status', currentUser.uid);
            setDoc(userStatusRef, {
                state: 'offline',
                lastChanged: serverTimestamp(),
                lastSeen: serverTimestamp()
            }).catch(error => {
                console.error('Error setting offline status:', error);
            });
        }
    } catch (error) {
        logError(error, 'beforeunload cleanup');
    }
});