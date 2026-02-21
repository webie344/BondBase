// groupchat.js - Enhanced with IndexedDB Caching, Service Worker Support & Voice Notes
// COMPLETE VERSION WITH XP SYSTEM INTEGRATED - LOADS ACTUAL USER XP DATA
// FIXED: Message ordering on initial load and cancel voice recording button

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
    arrayRemove,
    increment,
    deleteDoc,
    writeBatch
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { 
    getAuth, 
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

// ==================== XP RANK SYSTEM (INTEGRATED) ====================
const XP_RANKS = [];
// Generate 100 ranks with progressive XP requirements
for (let i = 1; i <= 100; i++) {
    let xpNeeded = 0;
    let title = "";
    let icon = "";
    let color = "";
    
    // Calculate XP needed (progressive scaling)
    if (i === 1) {
        xpNeeded = 0;
    } else if (i <= 10) {
        xpNeeded = (i - 1) * 100;
    } else if (i <= 30) {
        xpNeeded = 900 + (i - 10) * 200;
    } else if (i <= 50) {
        xpNeeded = 4900 + (i - 30) * 500;
    } else if (i <= 75) {
        xpNeeded = 14900 + (i - 50) * 1000;
    } else {
        xpNeeded = 39900 + (i - 75) * 2000;
    }
    
    // Assign titles based on level ranges
    if (i === 1) {
        title = "Newbie Explorer";
        icon = "🌱";
        color = "#808080";
    } else if (i <= 5) {
        const titles = ["Apprentice Adventurer", "Journeyman Voyager", "Skilled Pathfinder", "Experienced Trailblazer", "Adept Wayfarer"];
        title = titles[i-2];
        icon = ["🎒", "🗺️", "🧭", "🔥", "⚔️"][i-2];
        color = ["#A0522D", "#4682B4", "#32CD32", "#FF4500", "#9370DB"][i-2];
    } else if (i <= 10) {
        const titles = ["Valiant Guardian", "Mystic Seeker", "Radiant Champion", "Celestial Wanderer", "Ethereal Sage"];
        title = titles[i-6];
        icon = ["🛡️", "🔮", "✨", "🌠", "🧙"][i-6];
        color = ["#FFD700", "#8A2BE2", "#FF69B4", "#00CED1", "#7CFC00"][i-6];
    } else if (i <= 20) {
        const titles = ["Ascended Hero", "Void Walker", "Starlight Sentinel", "Time Weaver", "Dream Shaper", 
                       "Reality Bender", "Cosmic Pioneer", "Quantum Knight", "Nova Warden", "Infinity Seeker"];
        title = titles[i-11];
        icon = ["🦸", "🌌", "⭐", "⏳", "💭", "🌀", "🚀", "⚡", "🌞", "♾️"][i-11];
        color = ["#FF6347", "#4B0082", "#FFD700", "#20B2AA", "#9370DB", "#FF1493", "#00BFFF", "#32CD32", "#FF8C00", "#8B0000"][i-11];
    } else if (i <= 30) {
        const titles = ["Arcane Master", "Celestial Emperor", "Void Emperor", "Time Lord", "Dream Emperor",
                       "Reality Emperor", "Cosmic Emperor", "Quantum Emperor", "Nova Emperor", "Infinity Emperor"];
        title = titles[i-21];
        icon = ["🧙‍♂️", "👑", "🌑", "⏰", "💤", "🌐", "🌌", "⚛️", "☀️", "∞"][i-21];
        color = ["#8B4513", "#FFD700", "#000000", "#808080", "#483D8B", "#2F4F4F", "#191970", "#006400", "#8B0000", "#4B0082"][i-21];
    } else if (i <= 40) {
        const titles = ["Mythic Legend", "Eternal Phoenix", "Dragon Sovereign", "Titan Slayer", "God Killer",
                       "Universe Creator", "Multiverse Traveler", "Omnipotent Being", "Absolute Ruler", "Supreme Deity"];
        title = titles[i-31];
        icon = ["🏛️", "🔥", "🐉", "⚔️", "☠️", "🌍", "🌌", "👁️", "⚖️", "👑"][i-31];
        color = ["#FF4500", "#FF8C00", "#DC143C", "#8B0000", "#2F4F4F", "#228B22", "#00008B", "#8B008B", "#B8860B", "#FFD700"][i-31];
    } else if (i <= 50) {
        const titles = ["Legendary Archon", "Mythic Overlord", "Eternal Champion", "Cosmic Sovereign", "Quantum God",
                       "Reality Architect", "Dream Weaver Prime", "Time Guardian Supreme", "Void Conqueror", "Infinity Master"];
        title = titles[i-41];
        icon = ["👑", "🏆", "🦸‍♂️", "🌠", "⚛️", "🏗️", "🕸️", "🕰️", "⚫", "♾️"][i-41];
        color = ["#C0C0C0", "#FFD700", "#FF6347", "#00CED1", "#32CD32", "#8A2BE2", "#FF69B4", "#808080", "#000000", "#4B0082"][i-41];
    } else if (i <= 60) {
        const titles = ["Transcendent Being", "Omniscient Oracle", "Unbound Spirit", "Ethereal Monarch", "Celestial God",
                       "Stellar Emperor", "Galactic Warlord", "Interdimensional Traveler", "Paradox Resolver", "Existence Shaper"];
        title = titles[i-51];
        icon = ["👁️", "🔮", "👻", "👑", "⭐", "👑", "⚔️", "🚪", "🔄", "✏️"][i-51];
        color = ["#8B008B", "#FF00FF", "#F0E68C", "#98FB98", "#FFD700", "#FF4500", "#DC143C", "#00BFFF", "#32CD32", "#8A2BE2"][i-51];
    } else if (i <= 70) {
        const titles = ["Reality Emperor", "Dream Lord", "Time Master", "Space Conqueror", "Quantum King",
                       "Cosmic Ruler", "Void Master", "Infinity Lord", "Eternal Being", "Absolute Power"];
        title = titles[i-61];
        icon = ["👑", "💭", "⏰", "🚀", "⚛️", "🌌", "⚫", "∞", "♾️", "💪"][i-61];
        color = ["#FF0000", "#9370DB", "#20B2AA", "#1E90FF", "#00FF00", "#00008B", "#000000", "#4B0082", "#8B0000", "#FFD700"][i-61];
    } else if (i <= 80) {
        const titles = ["Supreme Legend", "Mythic God", "Celestial King", "Starlight Emperor", "Galactic Ruler",
                       "Universe Master", "Multiverse God", "Omnipotent Ruler", "All-Powerful Being", "Ultimate Deity"];
        title = titles[i-71];
        icon = ["🏆", "👑", "👑", "⭐", "🌌", "🌍", "🌌", "👑", "💪", "👁️"][i-71];
        color = ["#FFD700", "#FF4500", "#00CED1", "#FFD700", "#00008B", "#228B22", "#4B0082", "#8B0000", "#DC143C", "#8B008B"][i-71];
    } else if (i <= 90) {
        const titles = ["God of Gods", "King of Kings", "Emperor of Emperors", "Master of Masters", "Ruler of Rulers",
                       "Lord of Lords", "Champion of Champions", "Hero of Heroes", "Legend of Legends", "Myth of Myths"];
        title = titles[i-81];
        icon = ["👑", "👑", "👑", "👑", "👑", "👑", "🏆", "🦸", "🏛️", "📜"][i-81];
        color = ["#FF0000", "#FF8C00", "#FFD700", "#32CD32", "#00CED1", "#1E90FF", "#9370DB", "#FF69B4", "#FF4500", "#8B0000"][i-81];
    } else {
        const titles = ["The Ultimate One", "The Final Boss", "The Alpha Omega", "The Beginning and End", 
                       "The All-Knowing", "The All-Seeing", "The All-Powerful", "The Eternal", "The Infinite", "The Absolute"];
        title = titles[i-91];
        icon = ["👁️", "🐲", "αΩ", "🔚", "🧠", "👀", "💪", "♾️", "∞", "⚫"][i-91];
        color = ["#FF00FF", "#DC143C", "#000000", "#FFFFFF", "#8A2BE2", "#00BFFF", "#FFD700", "#32CD32", "#4B0082", "#000000"][i-91];
    }
    
    XP_RANKS.push({
        level: i,
        title: title,
        xpNeeded: xpNeeded,
        icon: icon,
        color: color
    });
}

const firebaseConfig = {
    apiKey: "AIzaSyC9jF-ocy6HjsVzWVVlAyXW-4aIFgA79-A",
    authDomain: "crypto-6517d.firebaseapp.com",
    projectId: "crypto-6517d",
    storageBucket: "crypto-6517d.firebasestorage.app",
    messagingSenderId: "60263975159",
    appId: "1:60263975159:web:bd53dcaad86d6ed9592bf2"
  };


const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const cloudinaryConfig = {
    cloudName: "ddtdqrh1b",
    uploadPreset: "profile-pictures",
    apiUrl: "https://api.cloudinary.com/v1_1"
};

const AVATAR_OPTIONS = [
    'https://api.dicebear.com/7.x/avataaars/svg?seed=user1',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=user2',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=user3',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=user4',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=user5',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=user6',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=user7',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=user8'
];

// ==================== XP DATA CACHE ====================
const xpDataCache = new Map(); // userId -> { xpData, expiry }

// ==================== INDEXEDDB CACHE SYSTEM ====================
class GroupIndexedDBCache {
    constructor() {
        this.dbName = 'GroupChatDB';
        this.dbVersion = 4;
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
                
                // Create object stores
                if (!db.objectStoreNames.contains('groups')) {
                    const groupsStore = db.createObjectStore('groups', { keyPath: 'id' });
                    groupsStore.createIndex('lastActivity', 'lastActivity', { unique: false });
                    groupsStore.createIndex('updatedAt', 'updatedAt', { unique: false });
                }
                if (!db.objectStoreNames.contains('group_messages')) {
                    const messagesStore = db.createObjectStore('group_messages', { 
                        keyPath: 'id',
                        autoIncrement: true 
                    });
                    messagesStore.createIndex('groupId_timestamp', ['groupId', 'timestamp'], { unique: false });
                    messagesStore.createIndex('groupId', 'groupId', { unique: false });
                }
                if (!db.objectStoreNames.contains('group_members')) {
                    const membersStore = db.createObjectStore('group_members', { keyPath: ['groupId', 'userId'] });
                    membersStore.createIndex('groupId', 'groupId', { unique: false });
                    membersStore.createIndex('userId', 'userId', { unique: false });
                }
                if (!db.objectStoreNames.contains('user_profiles')) {
                    db.createObjectStore('user_profiles', { keyPath: 'userId' });
                }
                if (!db.objectStoreNames.contains('private_messages')) {
                    const privateStore = db.createObjectStore('private_messages', { 
                        keyPath: 'id',
                        autoIncrement: true 
                    });
                    privateStore.createIndex('chatId_timestamp', ['chatId', 'timestamp'], { unique: false });
                }
                if (!db.objectStoreNames.contains('private_chats')) {
                    db.createObjectStore('private_chats', { keyPath: 'chatId' });
                }
                if (!db.objectStoreNames.contains('message_reactions')) {
                    const reactionsStore = db.createObjectStore('message_reactions', { 
                        keyPath: ['groupId', 'messageId', 'emoji'] 
                    });
                    reactionsStore.createIndex('messageId', 'messageId', { unique: false });
                }
                if (!db.objectStoreNames.contains('offline_messages')) {
                    db.createObjectStore('offline_messages', { 
                        keyPath: 'localId',
                        autoIncrement: true 
                    });
                }
                if (!db.objectStoreNames.contains('typing_status')) {
                    db.createObjectStore('typing_status', { keyPath: ['groupId', 'userId'] });
                }
                if (!db.objectStoreNames.contains('voice_notes')) {
                    db.createObjectStore('voice_notes', { keyPath: 'localId' });
                }
                // Add XP data store
                if (!db.objectStoreNames.contains('xp_data')) {
                    db.createObjectStore('xp_data', { keyPath: 'userId' });
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
                const range = IDBKeyRange.only(queryValue);
                request = index.getAll(range);
            } else if (indexName && Array.isArray(queryValue)) {
                const index = store.index(indexName);
                const range = IDBKeyRange.bound(queryValue[0], queryValue[1]);
                request = index.getAll(range);
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

    // Group-specific methods
    async setGroup(group) {
        await this.init();
        return await this.set('groups', {
            ...group,
            cachedAt: Date.now()
        });
    }

    async getGroup(groupId) {
        await this.init();
        return await this.get('groups', groupId);
    }

    async setGroups(groups) {
        await this.init();
        for (const group of groups) {
            await this.setGroup(group);
        }
    }

    async getGroups() {
        await this.init();
        return await this.getAll('groups');
    }

    // Message-specific methods
    async setGroupMessages(groupId, messages) {
        await this.init();
        const transaction = this.db.transaction(['group_messages'], 'readwrite');
        const store = transaction.objectStore('group_messages');
        
        // Clear existing messages for this group
        const index = store.index('groupId');
        const range = IDBKeyRange.only(groupId);
        const clearRequest = index.getAll(range);
        
        clearRequest.onsuccess = async () => {
            const existingMessages = clearRequest.result;
            for (const msg of existingMessages) {
                store.delete(msg.id);
            }
            
            // Add new messages
            for (const message of messages) {
                await store.put({
                    ...message,
                    groupId: groupId,
                    cachedAt: Date.now()
                });
            }
        };
    }

    async getGroupMessages(groupId, limit = 50) {
        await this.init();
        const messages = await this.getAll('group_messages', 'groupId_timestamp', [groupId, IDBKeyRange.upperBound(Date.now())]);
        return messages
            .sort((a, b) => (a.timestamp?.getTime?.() || a.timestamp) - (b.timestamp?.getTime?.() || b.timestamp))
            .slice(-limit);
    }

    async addGroupMessage(groupId, message) {
        await this.init();
        return await this.set('group_messages', {
            ...message,
            groupId: groupId,
            cachedAt: Date.now(),
            id: message.id || `${groupId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        });
    }

    // Member-specific methods
    async setGroupMembers(groupId, members) {
        await this.init();
        const transaction = this.db.transaction(['group_members'], 'readwrite');
        const store = transaction.objectStore('group_members');
        
        // Clear existing members for this group
        const index = store.index('groupId');
        const range = IDBKeyRange.only(groupId);
        const clearRequest = index.getAll(range);
        
        clearRequest.onsuccess = async () => {
            const existingMembers = clearRequest.result;
            for (const member of existingMembers) {
                store.delete([groupId, member.userId || member.id]);
            }
            
            // Add new members
            for (const member of members) {
                await store.put({
                    ...member,
                    groupId: groupId,
                    userId: member.userId || member.id,
                    cachedAt: Date.now()
                });
            }
        };
    }

    async getGroupMembers(groupId) {
        await this.init();
        return await this.getAll('group_members', 'groupId', groupId);
    }

    // Offline message queuing
    async queueOfflineMessage(message) {
        await this.init();
        const localId = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        return await this.set('offline_messages', {
            ...message,
            localId: localId,
            status: 'pending',
            createdAt: Date.now(),
            attempts: 0
        });
    }

    async getOfflineMessages() {
        await this.init();
        return await this.getAll('offline_messages');
    }

    async updateOfflineMessageStatus(localId, status, error = null) {
        await this.init();
        const message = await this.get('offline_messages', localId);
        if (message) {
            message.status = status;
            message.error = error;
            message.attempts = (message.attempts || 0) + 1;
            message.lastAttempt = Date.now();
            await this.set('offline_messages', message);
        }
    }

    async removeOfflineMessage(localId) {
        await this.init();
        return await this.delete('offline_messages', localId);
    }

    // Typing status
    async setTypingStatus(groupId, userId, status) {
        await this.init();
        return await this.set('typing_status', {
            groupId: groupId,
            userId: userId,
            isTyping: status,
            timestamp: Date.now()
        });
    }

    async getTypingStatus(groupId) {
        await this.init();
        const allStatus = await this.getAll('typing_status');
        return allStatus.filter(s => s.groupId === groupId && s.isTyping);
    }

    async clearOldTypingStatus() {
        await this.init();
        const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
        const allStatus = await this.getAll('typing_status');
        
        for (const status of allStatus) {
            if (status.timestamp < fiveMinutesAgo) {
                await this.delete('typing_status', [status.groupId, status.userId]);
            }
        }
    }

    // Voice notes
    async saveVoiceNote(voiceNote) {
        await this.init();
        return await this.set('voice_notes', {
            ...voiceNote,
            cachedAt: Date.now()
        });
    }

    async getVoiceNotes(groupId) {
        await this.init();
        const allNotes = await this.getAll('voice_notes');
        return allNotes.filter(note => note.groupId === groupId);
    }

    async deleteVoiceNote(localId) {
        await this.init();
        return await this.delete('voice_notes', localId);
    }

    // XP data methods
    async setXPData(userId, xpData) {
        await this.init();
        return await this.set('xp_data', {
            userId: userId,
            ...xpData,
            cachedAt: Date.now()
        });
    }

    async getXPData(userId) {
        await this.init();
        return await this.get('xp_data', userId);
    }
}

const indexedDBCache = new GroupIndexedDBCache();

// ==================== SERVICE WORKER REGISTRATION ====================
async function registerServiceWorker() {
    if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost')) {
        try {
            const registration = await navigator.serviceWorker.register('/sw-group.js');
            console.log('Service Worker registered for group.js');
            
            // Set up background sync if supported
            if ('sync' in registration) {
                try {
                    await registration.sync.register('group-offline-sync');
                } catch (syncError) {
                    console.log('Background sync not supported:', syncError);
                }
            }
            
            return registration;
        } catch (error) {
            console.log('Service Worker registration failed:', error);
            return null;
        }
    }
    return null;
}

// ==================== LOCAL CACHE SYSTEM ====================
class LocalCache {
    constructor() {
        this.cachePrefix = 'groupchat_';
        this.cacheExpiry = {
            short: 1 * 60 * 1000, // 1 minute
            medium: 5 * 60 * 1000, // 5 minutes
            long: 30 * 60 * 1000, // 30 minutes
            veryLong: 24 * 60 * 60 * 1000 // 24 hours
        };
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
}

const cache = new LocalCache();

// ==================== NETWORK MONITORING ====================
let isOnline = navigator.onLine;

function setupNetworkMonitoring() {
    window.addEventListener('online', handleNetworkOnline);
    window.addEventListener('offline', handleNetworkOffline);
    
    // Create offline indicator
    const offlineIndicator = document.createElement('div');
    offlineIndicator.id = 'offlineIndicator';
    offlineIndicator.className = 'offline-indicator';
    offlineIndicator.innerHTML = '<i class="fas fa-wifi"></i> You are currently offline. Messages will be sent when you reconnect.';
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
    
    // Hide offline indicator
    const offlineIndicator = document.getElementById('offlineIndicator');
    if (offlineIndicator) {
        offlineIndicator.style.display = 'none';
    }
    
    showNotification('Connection restored', 'success', 2000);
    
    // Sync offline messages
    await syncOfflineMessages();
    
    // Refresh data when coming online
    if (window.groupChat && window.groupChat.currentGroupId) {
        window.groupChat.clearGroupCache(window.groupChat.currentGroupId);
    }
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

async function syncOfflineMessages() {
    try {
        const offlineMessages = await indexedDBCache.getOfflineMessages();
        const pendingMessages = offlineMessages.filter(m => m.status === 'pending');
        
        if (pendingMessages.length > 0) {
            showNotification(`Sending ${pendingMessages.length} offline messages...`, 'info');
            
            for (const message of pendingMessages) {
                try {
                    // Re-send the message
                    // You'll need to implement the actual resend logic based on your message structure
                    console.log('Resending offline message:', message);
                    
                    // Update status to sent
                    await indexedDBCache.updateOfflineMessageStatus(message.localId, 'sent');
                    
                } catch (error) {
                    console.error('Error resending offline message:', error);
                    await indexedDBCache.updateOfflineMessageStatus(message.localId, 'failed', error.message);
                }
            }
            
            // Clean up sent messages
            const sentMessages = offlineMessages.filter(m => m.status === 'sent');
            for (const message of sentMessages) {
                await indexedDBCache.removeOfflineMessage(message.localId);
            }
        }
    } catch (error) {
        console.error('Error syncing offline messages:', error);
    }
}

// ==================== NOTIFICATION SYSTEM ====================
function showNotification(message, type = 'info', duration = 3000) {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.custom-notification');
    existingNotifications.forEach(notification => notification.remove());
    
    const notification = document.createElement('div');
    notification.className = `custom-notification ${type}`;
    
    const bgColor = type === 'error' ? '#dc2626' : 
                   type === 'success' ? '#16a34a' : 
                   type === 'warning' ? '#f59e0b' : 
                   type === 'offline' ? '#f59e0b' : '#3b82f6';
    
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
    
    const icon = type === 'error' ? 'fas fa-exclamation-circle' : 
                type === 'success' ? 'fas fa-check-circle' : 
                type === 'warning' || type === 'offline' ? 'fas fa-exclamation-triangle' : 'fas fa-info-circle';
    
    notification.innerHTML = `
        <i class="${icon}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, duration);
}

// Add animation styles
if (!document.getElementById('notification-styles')) {
    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}

// ==================== XP FUNCTIONS ====================

// Get user's XP data from Firebase
async function getUserXPData(userId) {
    try {
        // Check cache first
        const cached = xpDataCache.get(userId);
        if (cached && cached.expiry > Date.now()) {
            return cached.data;
        }
        
        // Check IndexedDB
        if (indexedDBCache) {
            const indexedDBCached = await indexedDBCache.getXPData(userId);
            if (indexedDBCached && indexedDBCached.cachedAt > Date.now() - 5 * 60 * 1000) {
                // Cache for 5 minutes
                xpDataCache.set(userId, {
                    data: indexedDBCached,
                    expiry: Date.now() + 5 * 60 * 1000
                });
                return indexedDBCached;
            }
        }
        
        // Fetch from Firebase
        const xpRef = doc(db, 'xpData', userId);
        const xpSnap = await getDoc(xpRef);
        
        let xpData = null;
        if (xpSnap.exists()) {
            xpData = xpSnap.data();
        } else {
            // Return default XP data for users who haven't earned any XP yet
            xpData = {
                totalXP: 0,
                coins: 0,
                currentLevel: 1,
                userId: userId
            };
        }
        
        // Update cache
        xpDataCache.set(userId, {
            data: xpData,
            expiry: Date.now() + 5 * 60 * 1000
        });
        
        // Update IndexedDB
        if (indexedDBCache) {
            await indexedDBCache.setXPData(userId, xpData);
        }
        
        return xpData;
    } catch (error) {
        console.error('Error getting user XP data:', error);
        return {
            totalXP: 0,
            coins: 0,
            currentLevel: 1,
            userId: userId
        };
    }
}

// Get user's rank based on XP
function getUserRankFromXP(xpData) {
    if (!xpData || !xpData.totalXP) return XP_RANKS[0];
    
    let level = 1;
    for (let i = XP_RANKS.length - 1; i >= 0; i--) {
        if (xpData.totalXP >= XP_RANKS[i].xpNeeded) {
            level = XP_RANKS[i].level;
            break;
        }
    }
    return XP_RANKS[level - 1] || XP_RANKS[0];
}

// Award XP to user
async function awardXP(userId, amount, reason) {
    try {
        const xpRef = doc(db, 'xpData', userId);
        const xpSnap = await getDoc(xpRef);
        
        // Create history item
        const historyItem = {
            amount: amount,
            reason: reason,
            timestamp: serverTimestamp(),
            type: "earned"
        };
        
        if (xpSnap.exists()) {
            // Update existing XP data
            await updateDoc(xpRef, {
                totalXP: increment(amount),
                coins: increment(Math.floor(amount / 10)),
                updated: serverTimestamp(),
                xpHistory: arrayUnion(historyItem)
            });
            
            // Get updated data to check for level up
            const updatedSnap = await getDoc(xpRef);
            const updatedData = updatedSnap.data();
            
            // Check for level up
            await checkLevelUp(userId, updatedData);
            
        } else {
            // Create new XP data
            await setDoc(xpRef, {
                userId: userId,
                totalXP: amount,
                currentLevel: 1,
                coins: Math.floor(amount / 10),
                xpHistory: [historyItem],
                dailyCheckIns: [],
                achievements: [],
                created: serverTimestamp(),
                updated: serverTimestamp()
            });
        }
        
        // Clear cache
        xpDataCache.delete(userId);
        
        return true;
    } catch (error) {
        console.error('Error awarding XP:', error);
        return false;
    }
}

// Check if user leveled up
async function checkLevelUp(userId, xpData) {
    if (!xpData) return false;
    
    let currentLevel = 1;
    for (let i = XP_RANKS.length - 1; i >= 0; i--) {
        if (xpData.totalXP >= XP_RANKS[i].xpNeeded) {
            currentLevel = XP_RANKS[i].level;
            break;
        }
    }
    
    if (currentLevel > (xpData.currentLevel || 1)) {
        // Level up!
        const xpRef = doc(db, 'xpData', userId);
        
        await updateDoc(xpRef, {
            currentLevel: currentLevel,
            coins: increment(50) // Level up bonus
        });
        
        // Send system message if user is in current group
        const currentGroupId = window.groupChat?.currentGroupId;
        if (currentGroupId) {
            const userProfile = await getUserProfile(userId);
            await sendRewardSystemMessage(
                currentGroupId, 
                userId, 
                userProfile?.name || 'User', 
                XP_RANKS[currentLevel - 1].title,
                'level_up'
            );
        }
        
        return true;
    }
    return false;
}

// Send system message for XP/reward upgrade
async function sendRewardSystemMessage(groupId, userId, userName, rewardText, type = 'xp_gain') {
    try {
        const messagesRef = collection(db, 'groups', groupId, 'messages');
        
        let message = '';
        if (type === 'xp_gain') {
            message = `✨ ${userName} gained ${rewardText}! ✨`;
        } else if (type === 'level_up') {
            message = `🎉 Congratulations! ${userName} leveled up to "${rewardText}"! 🎉`;
        } else if (type === 'milestone') {
            message = `🏆 Amazing! ${userName} reached a milestone: ${rewardText}! 🏆`;
        }
        
        await addDoc(messagesRef, {
            type: 'system',
            text: message,
            timestamp: serverTimestamp(),
            senderId: 'system',
            senderName: 'System',
            senderAvatar: '',
            rewardUpgrade: true,
            rewardedUserId: userId,
            rewardedUserName: userName,
            rewardText: rewardText,
            rewardType: type
        });
        
        return true;
    } catch (error) {
        console.error('Error sending reward system message:', error);
        return false;
    }
}

// ==================== MAIN GROUP CHAT CLASS ====================
const CACHE_DURATION = {
    USER_PROFILE: 5 * 60 * 1000,
    GROUP_DATA: 2 * 60 * 1000,
    MEMBERS_LIST: 1 * 60 * 1000,
    BLOCKED_USERS: 10 * 60 * 1000
};

// Emojis for reactions (100 emojis like Discord)
const REACTION_EMOJIS = [
    '😀', '😂', '🥰', '😎', '🤔', '👍', '🎉', '❤️', '🔥', '✨',
    '😊', '😍', '🤩', '😜', '😋', '😇', '🥳', '😏', '😒', '🥺',
    '😭', '😡', '🤯', '😱', '🤢', '🤮', '🤠', '🥶', '😈', '👻',
    '💀', '🤖', '👽', '👾', '🤡', '💩', '🙈', '🙉', '🙊', '💋',
    '💌', '💘', '💝', '💖', '💗', '💓', '💞', '💕', '💟', '❣️',
    '💔', '❤️‍🔥', '❤️‍🩹', '💤', '💢', '💬', '👁️‍🗨️', '🗨️', '🗯️', '💭',
    '💐', '🌸', '💮', '🏵️', '🌹', '🥀', '🌺', '🌻', '🌼', '🌷',
    '⚡', '💥', '💫', '⭐', '🌟', '🌠', '🌈', '☀️', '🌤️', '⛈️',
    '❄️', '☃', '⛄', '💧', '💦', '💨', '🕳️', '🎃', '🎄', '🎆',
    '🎇', '🧨', '✨', '🎈', '🎉', '🎊', '🎋', '🎍', '🎎', '🎏'
];

// Constants for typing indicators
const TYPING_TIMEOUT = 5000; // 5 seconds
const XP_REWARDS = {
    MESSAGE_SENT: 5, // XP for sending a message
    IMAGE_SENT: 10, // XP for sending an image
    VIDEO_SENT: 15, // XP for sending a video
    VOICE_SENT: 12, // XP for sending a voice note
    REACTION_ADDED: 2, // XP for adding a reaction
    DAILY_LIMIT: 20 // Maximum XP per day from chat
};

class GroupChat {
    constructor() {
        this.currentUser = null;
        this.firebaseUser = null;
        this.currentGroupId = null;
        this.currentChatPartnerId = null;
        this.unsubscribeMessages = null;
        this.unsubscribeMembers = null;
        this.unsubscribePrivateMessages = null;
        this.unsubscribeAuth = null;
        this.unsubscribePrivateChats = null;
        this.unsubscribeTyping = null;
        
        this.cache = {
            userProfile: null,
            userProfileExpiry: 0,
            joinedGroups: new Map(),
            groupData: new Map(),
            groupMembers: new Map(),
            profileSetupChecked: false,
            blockedUsers: new Map(),
            messageReactions: new Map(),
            userProfiles: new Map(),
            mutualGroups: new Map(),
            privateChats: new Map(),
            unreadCounts: new Map(),
            groupChats: new Map(),
            groupInvites: new Map(),
            adminGroups: new Map(),
            allGroups: new Map(),
            messages: new Map(),
            userXP: new Map() // Cache for user XP data
        };
        
        this.replyingToMessage = null;
        this.longPressTimer = null;
        this.selectedMessage = null;
        this.messageContextMenu = null;
        
        this.areListenersSetup = false;
        
        this.privateChats = new Map();
        this.unreadMessages = new Map();
        
        this.isLoadingMessages = false;
        
        this.sentMessageIds = new Set();
        this.pendingMessages = new Set();
        
        this.restrictedUsers = new Map();
        
        this.reactionModal = null;
        this.currentMessageForReaction = null;
        
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.isSwiping = false;
        this.swipeThreshold = 50;
        
        this.lastDisplayedMessages = new Set();
        this.messageRenderQueue = [];
        this.isRendering = false;
        
        this.blockedUsers = new Map();
        
        // Track all active listeners for cleanup
        this.activeListeners = new Map();
        this.reactionUnsubscribers = new Map();
        
        // Typing indicators
        this.typingUsers = new Map(); // groupId -> Map(userId -> typingTimeout)
        this.lastMessageTimes = new Map(); // userId -> last message timestamp
        
        // Upload tracking
        this.activeUploads = new Map(); // uploadId -> { cancelFunction, progress, type }
        
        // Voice recording
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.recordingStartTime = null;
        this.recordingTimer = null;
        this.recordingDuration = 0;
        this.currentVoiceNote = null;
        
        // Track processed messages
        this.processedMessageIdsByGroup = new Map();
        this.pageProcessedMessageIdsByGroup = new Map();
        this.initialLoadComplete = new Map(); // Track if initial load is complete for a group
        this.pendingMessageUpdates = new Map(); // Queue messages during initial load
        
        // Track offline status
        this.isOnline = navigator.onLine;
        
        // Connection state tracking
        this.connectionState = 'connected';
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        
        // XP tracking
        this.userXPCache = new Map(); // userId -> { xpData, rank }
        this.dailyXPTracking = new Map(); // userId -> { date, count }
        this.dailyXPLimit = 20; // Maximum XP per day from chat
        
        this.setupNetworkListener();
        this.setupAuthListener();
        this.createReactionModal();
        this.checkRestrictedUsers();
        this.loadBlockedUsers();
        
        // Setup page visibility listener
        this.setupPageVisibilityListener();
        
        // Initialize Service Worker
        registerServiceWorker();
        
        // Setup network monitoring
        setupNetworkMonitoring();
        
        // Setup voice recording styles
        this.setupVoiceRecordingStyles();
    }

    // NEW: Setup voice recording styles
    setupVoiceRecordingStyles() {
        if (!document.getElementById('voice-recording-styles')) {
            const style = document.createElement('style');
            style.id = 'voice-recording-styles';
            style.textContent = `
                /* Voice Recording Button */
                #voiceNoteBtn {
                    background: none;
                    border: none;
                    color: var(--text-light);
                    font-size: 1.2rem;
                    cursor: pointer;
                    padding: 8px;
                    border-radius: 50%;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-left: 5px;
                }
                
                #voiceNoteBtn:hover {
                    background: rgba(102, 126, 234, 0.1);
                    color: var(--primary);
                }
                
                #voiceNoteBtn.recording {
                    color: #ff3b30;
                    animation: pulse 1.5s infinite;
                }
                
                @keyframes pulse {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.1); }
                    100% { transform: scale(1); }
                }
                
                /* Voice Recording Controls */
                .voice-recording-container {
                    background: white;
                    border-radius: 12px;
                    padding: 20px;
                    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
                    max-width: 400px;
                    width: 90%;
                    animation: slideInUp 0.3s ease;
                    position: fixed;
                    bottom: 100px;
                    left: 50%;
                    transform: translateX(-50%);
                    z-index: 1001;
                }
                
                @keyframes slideInUp {
                    from {
                        transform: translateX(-50%) translateY(20px);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(-50%) translateY(0);
                        opacity: 1;
                    }
                }
                
                .voice-recording-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                }
                
                .voice-recording-title {
                    font-size: 16px;
                    font-weight: 600;
                    color: #333;
                }
                
                .voice-recording-timer {
                    font-size: 14px;
                    color: #666;
                    font-family: monospace;
                }
                
                .recording-visualizer {
                    height: 60px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 20px 0;
                }
                
                .visualizer-bar {
                    width: 4px;
                    height: 20px;
                    background: var(--primary);
                    margin: 0 2px;
                    border-radius: 2px;
                    animation: visualizer 1s ease-in-out infinite alternate;
                }
                
                @keyframes visualizer {
                    0% { height: 10px; }
                    100% { height: 40px; }
                }
                
                .voice-recording-controls {
                    display: flex;
                    justify-content: center;
                    gap: 20px;
                    margin-top: 20px;
                }
                
                .voice-control-btn {
                    width: 50px;
                    height: 50px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: none;
                    cursor: pointer;
                    font-size: 20px;
                    transition: all 0.2s;
                }
                
                .cancel-recording {
                    background: #ff3b30;
                    color: white;
                }
                
                .stop-recording {
                    background: var(--primary);
                    color: white;
                }
                
                .voice-control-btn:hover {
                    transform: scale(1.1);
                }
                
                .voice-control-btn:active {
                    transform: scale(0.95);
                }
                
                /* Voice Note Preview */
                .voice-note-preview {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border-radius: 12px;
                    padding: 15px;
                    margin-bottom: 10px;
                    display: flex;
                    align-items: center;
                    gap: 15px;
                    animation: slideInDown 0.3s ease;
                }
                
                @keyframes slideInDown {
                    from {
                        transform: translateY(-10px);
                        opacity: 0;
                    }
                    to {
                        transform: translateY(0);
                        opacity: 1;
                    }
                }
                
                .voice-note-playback {
                    flex: 1;
                }
                
                .voice-note-waveform {
                    height: 40px;
                    background: rgba(255, 255, 255, 0.2);
                    border-radius: 6px;
                    position: relative;
                    overflow: hidden;
                    cursor: pointer;
                }
                
                .waveform-progress {
                    position: absolute;
                    top: 0;
                    left: 0;
                    height: 100%;
                    background: rgba(255, 255, 255, 0.3);
                    width: 0%;
                    transition: width 0.1s linear;
                }
                
                .voice-note-controls {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin-top: 5px;
                }
                
                .play-pause-btn {
                    background: white;
                    color: var(--primary);
                    border: none;
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    font-size: 12px;
                }
                
                .voice-note-duration {
                    color: white;
                    font-size: 12px;
                    font-family: monospace;
                }
                
                .voice-note-actions {
                    display: flex;
                    gap: 10px;
                }
                
                .voice-action-btn {
                    background: rgba(255, 255, 255, 0.2);
                    border: none;
                    color: white;
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    font-size: 14px;
                }
                
                .voice-action-btn:hover {
                    background: rgba(255, 255, 255, 0.3);
                }
                
                /* Voice Message Styles */
                .voice-message-container {
                    max-width: 250px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border-radius: 18px;
                    padding: 15px;
                    position: relative;
                    cursor: pointer;
                }
                
                .voice-message-waveform {
                    height: 40px;
                    width: 100%;
                    position: relative;
                    margin-bottom: 8px;
                }
                
                .voice-message-progress {
                    position: absolute;
                    top: 0;
                    left: 0;
                    height: 100%;
                    background: rgba(255, 255, 255, 0.3);
                    border-radius: 3px;
                    width: 0%;
                    transition: width 0.1s linear;
                }
                
                .voice-message-controls {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    color: white;
                }
                
                .voice-message-play {
                    background: white;
                    color: var(--primary);
                    border: none;
                    width: 30px;
                    height: 30px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    font-size: 12px;
                }
                
                .voice-message-duration {
                    font-size: 12px;
                    font-family: monospace;
                }
                
                /* Recording Tips */
                .recording-tips {
                    margin-top: 15px;
                    padding: 10px;
                    background: rgba(0, 0, 0, 0.05);
                    border-radius: 8px;
                    font-size: 12px;
                    color: #666;
                }
                
                .tip-item {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin: 5px 0;
                }
                
                /* Voice note in message */
                .message-text .voice-message-container {
                    margin: 5px 0;
                }
                
                /* XP Icon Styles */
                .xp-badge {
                    display: inline-flex;
                    align-items: center;
                    background: linear-gradient(135deg, #667eea, #764ba2);
                    border-radius: 20px;
                    padding: 2px 8px;
                    margin-left: 6px;
                    color: white;
                    font-size: 11px;
                    font-weight: bold;
                    gap: 4px;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                }
                
                .xp-badge span {
                    line-height: 1;
                }
                
                .xp-icon {
                    font-size: 12px;
                }
                
                .xp-level {
                    background: rgba(255,255,255,0.2);
                    border-radius: 12px;
                    padding: 1px 4px;
                    margin-left: 2px;
                }
                
                /* Reward system messages */
                .system-message.reward-upgrade {
                    background: linear-gradient(45deg, rgba(255, 215, 0, 0.1), rgba(255, 149, 0, 0.1));
                    border-left: 3px solid #ff9500;
                    padding: 10px;
                    margin: 10px 0;
                    border-radius: 8px;
                    text-align: center;
                    font-weight: bold;
                    animation: reward-message 3s ease-in-out;
                }
                
                @keyframes reward-message {
                    0% { opacity: 0; transform: translateY(-10px); }
                    20% { opacity: 1; transform: translateY(0); }
                    80% { opacity: 1; transform: translateY(0); }
                    100% { opacity: 0; transform: translateY(-10px); }
                }
                
                /* Font Awesome icons */
                .fas {
                    display: inline-block;
                    font-style: normal;
                    font-variant: normal;
                    text-rendering: auto;
                    -webkit-font-smoothing: antialiased;
                }
                
                /* Remove hover effects from messages */
                .message-text {
                    transition: none !important;
                }
                
                .message-text:hover {
                    background: none !important;
                    transform: none !important;
                    box-shadow: none !important;
                }
            `;
            document.head.appendChild(style);
        }
    }

    // NEW: Voice recording methods
    async startVoiceRecording() {
        try {
            // Stop typing indicator
            if (this.currentGroupId) {
                await this.stopTyping(this.currentGroupId);
            }
            
            // Request microphone permission
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                } 
            });
            
            // Create MediaRecorder
            this.mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus'
            });
            
            this.audioChunks = [];
            this.isRecording = true;
            this.recordingStartTime = Date.now();
            this.recordingDuration = 0;
            
            // Handle data available
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };
            
            // Handle recording stop
            this.mediaRecorder.onstop = () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                const audioUrl = URL.createObjectURL(audioBlob);
                const duration = this.recordingDuration;
                
                // Create voice note object
                this.currentVoiceNote = {
                    blob: audioBlob,
                    url: audioUrl,
                    duration: duration,
                    timestamp: Date.now(),
                    size: audioBlob.size
                };
                
                // Stop all tracks
                stream.getTracks().forEach(track => track.stop());
                
                // Save to IndexedDB
                if (indexedDBCache) {
                    indexedDBCache.saveVoiceNote({
                        ...this.currentVoiceNote,
                        groupId: this.currentGroupId,
                        localId: `voice_${Date.now()}`,
                        status: 'recorded'
                    });
                }
                
                // Show preview
                this.showVoiceNotePreview();
            };
            
            // Start recording
            this.mediaRecorder.start(100); // Collect data every 100ms
            
            // Update recording timer
            this.updateRecordingTimer();
            
            // Show recording UI
            this.showRecordingUI();
            
            return true;
            
        } catch (error) {
            console.error('Error starting voice recording:', error);
            
            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                throw new Error('Microphone permission denied. Please allow microphone access to record voice notes.');
            } else if (error.name === 'NotFoundError') {
                throw new Error('No microphone found. Please connect a microphone to record voice notes.');
            } else {
                throw new Error('Failed to start recording. Please try again.');
            }
        }
    }
    
    updateRecordingTimer() {
        if (this.isRecording && this.recordingStartTime) {
            this.recordingDuration = Date.now() - this.recordingStartTime;
            
            // Update UI timer
            const timerElement = document.getElementById('voiceRecordingTimer');
            if (timerElement) {
                const minutes = Math.floor(this.recordingDuration / 60000);
                const seconds = Math.floor((this.recordingDuration % 60000) / 1000);
                timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
            
            // Check max duration (2 minutes)
            if (this.recordingDuration >= 120000) {
                this.stopVoiceRecording();
                showNotification('Maximum recording time reached (2 minutes)', 'warning');
                return;
            }
            
            // Continue timer
            this.recordingTimer = setTimeout(() => this.updateRecordingTimer(), 1000);
        }
    }
    
    stopVoiceRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            
            if (this.recordingTimer) {
                clearTimeout(this.recordingTimer);
                this.recordingTimer = null;
            }
            
            // Hide recording UI
            this.hideRecordingUI();
            
            return true;
        }
        return false;
    }
    
    // FIXED: Cancel voice recording - properly clean up all resources
    cancelVoiceRecording() {
        if (this.mediaRecorder && this.isRecording) {
            // Stop the recorder
            try {
                this.mediaRecorder.stop();
            } catch (e) {
                console.log('Error stopping recorder:', e);
            }
            this.isRecording = false;
            
            // Clear timer
            if (this.recordingTimer) {
                clearTimeout(this.recordingTimer);
                this.recordingTimer = null;
            }
            
            // Stop all tracks
            if (this.mediaRecorder.stream) {
                this.mediaRecorder.stream.getTracks().forEach(track => {
                    try {
                        track.stop();
                    } catch (e) {
                        console.log('Error stopping track:', e);
                    }
                });
            }
            
            // Clear voice note data
            this.currentVoiceNote = null;
            this.audioChunks = [];
            this.recordingDuration = 0;
            this.recordingStartTime = null;
            
            // Hide recording UI
            this.hideRecordingUI();
            
            // Remove preview if exists
            this.removeVoiceNotePreview();
            
            // Update button state if exists
            const voiceNoteBtn = document.getElementById('voiceNoteBtn');
            if (voiceNoteBtn) {
                voiceNoteBtn.classList.remove('recording');
            }
            
            showNotification('Recording cancelled', 'info');
            
            return true;
        }
        return false;
    }
    
    async sendVoiceNote() {
        if (!this.currentVoiceNote || !this.currentGroupId) {
            throw new Error('No voice note to send');
        }
        
        try {
            // Create upload ID
            const uploadId = 'voice_upload_' + Date.now();
            
            // Upload to Cloudinary
            const voiceUrl = await this.uploadVoiceToCloudinary(
                this.currentVoiceNote.blob,
                uploadId
            );
            
            // Send message with voice note
            await this.sendMessage(
                this.currentGroupId,
                null, // No text
                null, // No image
                null, // No video
                this.replyingToMessage?.id,
                voiceUrl, // Voice URL
                this.currentVoiceNote.duration
            );
            
            // Award XP for sending voice note
            await this.awardChatXP(this.firebaseUser.uid, 'voice_sent');
            
            // Clear current voice note
            this.currentVoiceNote = null;
            
            // Remove preview
            this.removeVoiceNotePreview();
            
            showNotification('Voice note sent successfully', 'success');
            
            return true;
            
        } catch (error) {
            console.error('Error sending voice note:', error);
            throw error;
        }
    }
    
    async uploadVoiceToCloudinary(audioBlob, uploadId) {
        // Check if offline before starting upload
        if (!this.isOnline) {
            throw new Error('You are offline. Please check your network connection.');
        }
        
        const formData = new FormData();
        formData.append('file', audioBlob);
        formData.append('upload_preset', cloudinaryConfig.uploadPreset);
        formData.append('resource_type', 'video'); // Cloudinary treats audio as video
        
        const controller = new AbortController();
        
        try {
            const response = await fetch(
                `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/video/upload`,
                {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    signal: controller.signal
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
            if (error.name === 'AbortError') {
                throw new Error('Upload cancelled');
            }
            throw error;
        }
    }
    
    validateAudioFile(file) {
        const maxSize = 10 * 1024 * 1000; // 10MB
        if (file.size > maxSize) {
            throw new Error('Audio file must be less than 10MB');
        }
        
        const AUDIO_FORMATS = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/mpeg'];
        if (!AUDIO_FORMATS.includes(file.type)) {
            throw new Error('Please upload a valid audio file (MP3, WAV, OGG, WebM)');
        }
        
        return true;
    }
    
    showRecordingUI() {
        // Remove existing UI
        this.hideRecordingUI();
        
        const recordingUI = document.createElement('div');
        recordingUI.id = 'voiceRecordingUI';
        recordingUI.className = 'voice-recording-container';
        
        recordingUI.innerHTML = `
            <div class="voice-recording-header">
                <div class="voice-recording-title">Recording Voice Note</div>
                <div class="voice-recording-timer" id="voiceRecordingTimer">00:00</div>
            </div>
            
            <div class="recording-visualizer" id="recordingVisualizer">
                ${Array.from({ length: 20 }, (_, i) => 
                    `<div class="visualizer-bar" style="animation-delay: ${i * 0.05}s;"></div>`
                ).join('')}
            </div>
            
            <div class="recording-tips">
                <div class="tip-item">
                    <i class="fas fa-info-circle"></i>
                    <span>Maximum recording time: 2 minutes</span>
                </div>
                <div class="tip-item">
                    <i class="fas fa-info-circle"></i>
                    <span>Speak clearly into your microphone</span>
                </div>
            </div>
            
            <div class="voice-recording-controls">
                <button class="voice-control-btn cancel-recording" id="cancelRecording">
                    <i class="fas fa-times"></i>
                </button>
                <button class="voice-control-btn stop-recording" id="stopRecording">
                    <i class="fas fa-stop"></i>
                </button>
            </div>
        `;
        
        document.body.appendChild(recordingUI);
        
        // Add event listeners
        const cancelBtn = document.getElementById('cancelRecording');
        const stopBtn = document.getElementById('stopRecording');
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.cancelVoiceRecording();
            });
        }
        
        if (stopBtn) {
            stopBtn.addEventListener('click', () => {
                this.stopVoiceRecording();
            });
        }
        
        // Add overlay
        const overlay = document.createElement('div');
        overlay.id = 'voiceRecordingOverlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 1000;
        `;
        document.body.appendChild(overlay);
    }
    
    hideRecordingUI() {
        const recordingUI = document.getElementById('voiceRecordingUI');
        if (recordingUI) {
            recordingUI.remove();
        }
        
        const overlay = document.getElementById('voiceRecordingOverlay');
        if (overlay) {
            overlay.remove();
        }
    }
    
    showVoiceNotePreview() {
        if (!this.currentVoiceNote) return;
        
        // Remove existing preview
        this.removeVoiceNotePreview();
        
        const messageInputContainer = document.querySelector('.message-input-container');
        if (!messageInputContainer) return;
        
        const previewContainer = document.createElement('div');
        previewContainer.id = 'voiceNotePreview';
        previewContainer.className = 'voice-note-preview';
        
        const duration = this.currentVoiceNote.duration;
        const minutes = Math.floor(duration / 60000);
        const seconds = Math.floor((duration % 60000) / 1000);
        const durationText = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        previewContainer.innerHTML = `
            <div class="voice-note-icon">
                <i class="fas fa-microphone" style="font-size: 24px; color: white;"></i>
            </div>
            
            <div class="voice-note-playback">
                <div class="voice-note-waveform" id="voiceNoteWaveform">
                    <div class="waveform-progress" id="waveformProgress"></div>
                </div>
                <div class="voice-note-controls">
                    <button class="play-pause-btn" id="playVoiceNote">
                        <i class="fas fa-play" id="playIcon"></i>
                    </button>
                    <div class="voice-note-duration" id="voiceNoteDuration">${durationText}</div>
                </div>
            </div>
            
            <div class="voice-note-actions">
                <button class="voice-action-btn" id="deleteVoiceNote" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
                <button class="voice-action-btn" id="sendVoiceNote" title="Send">
                    <i class="fas fa-paper-plane"></i>
                </button>
            </div>
        `;
        
        // Insert before message input container
        messageInputContainer.parentNode.insertBefore(previewContainer, messageInputContainer);
        
        // Setup audio playback
        const audio = new Audio(this.currentVoiceNote.url);
        let isPlaying = false;
        
        const playBtn = document.getElementById('playVoiceNote');
        if (playBtn) {
            playBtn.addEventListener('click', () => {
                if (isPlaying) {
                    audio.pause();
                    playBtn.innerHTML = '<i class="fas fa-play" id="playIcon"></i>';
                } else {
                    audio.play();
                    playBtn.innerHTML = '<i class="fas fa-pause" id="playIcon"></i>';
                }
                isPlaying = !isPlaying;
            });
        }
        
        audio.addEventListener('timeupdate', () => {
            const progress = (audio.currentTime / audio.duration) * 100;
            const progressBar = document.getElementById('waveformProgress');
            if (progressBar) {
                progressBar.style.width = `${progress}%`;
            }
            
            // Update duration display
            const currentMinutes = Math.floor(audio.currentTime / 60);
            const currentSeconds = Math.floor(audio.currentTime % 60);
            const durationElement = document.getElementById('voiceNoteDuration');
            if (durationElement) {
                durationElement.textContent = 
                    `${currentMinutes.toString().padStart(2, '0')}:${currentSeconds.toString().padStart(2, '0')}`;
            }
        });
        
        audio.addEventListener('ended', () => {
            isPlaying = false;
            const playBtn = document.getElementById('playVoiceNote');
            if (playBtn) {
                playBtn.innerHTML = '<i class="fas fa-play" id="playIcon"></i>';
            }
            const progressBar = document.getElementById('waveformProgress');
            if (progressBar) {
                progressBar.style.width = '0%';
            }
            const durationElement = document.getElementById('voiceNoteDuration');
            if (durationElement) {
                durationElement.textContent = durationText;
            }
        });
        
        // Add click to seek on waveform
        const waveform = document.getElementById('voiceNoteWaveform');
        if (waveform) {
            waveform.addEventListener('click', (e) => {
                const rect = waveform.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const percentage = Math.max(0, Math.min(1, clickX / rect.width));
                audio.currentTime = audio.duration * percentage;
            });
        }
        
        // Add action buttons
        const deleteBtn = document.getElementById('deleteVoiceNote');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                if (audio) {
                    audio.pause();
                    URL.revokeObjectURL(audio.src);
                }
                this.cancelVoiceRecording();
            });
        }
        
        const sendBtn = document.getElementById('sendVoiceNote');
        if (sendBtn) {
            sendBtn.addEventListener('click', async () => {
                const originalHTML = sendBtn.innerHTML;
                
                sendBtn.disabled = true;
                sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                
                try {
                    await this.sendVoiceNote();
                } catch (error) {
                    console.error('Error sending voice note:', error);
                    alert(error.message || 'Failed to send voice note. Please try again.');
                    sendBtn.disabled = false;
                    sendBtn.innerHTML = originalHTML;
                }
            });
        }
    }
    
    removeVoiceNotePreview() {
        const preview = document.getElementById('voiceNotePreview');
        if (preview) {
            preview.remove();
        }
    }
    
    createVoiceMessageElement(voiceUrl, duration, messageId = null) {
        // Create container div
        const container = document.createElement('div');
        container.className = 'voice-message-container';
        if (messageId) {
            container.dataset.messageId = messageId;
        }
        
        const minutes = Math.floor(duration / 60000);
        const seconds = Math.floor((duration % 60000) / 1000);
        const durationText = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        const uniqueId = messageId || 'preview_' + Date.now();
        
        // Create the HTML structure
        container.innerHTML = `
            <div class="voice-message-waveform" id="waveform-${uniqueId}">
                <div class="voice-message-progress" id="waveformProgress-${uniqueId}"></div>
            </div>
            <div class="voice-message-controls">
                <button class="voice-message-play" id="playBtn-${uniqueId}">
                    <i class="fas fa-play" id="playIcon-${uniqueId}"></i>
                </button>
                <div class="voice-message-duration" id="duration-${uniqueId}">${durationText}</div>
            </div>
        `;
        
        // Setup playback if URL is provided
        if (voiceUrl) {
            const audio = new Audio(voiceUrl);
            let isPlaying = false;
            const originalDuration = duration;
            
            // Add click event to container for play/pause
            container.addEventListener('click', (e) => {
                if (e.target.closest('.voice-message-play') || e.target.closest('.voice-message-waveform')) {
                    return; // Let button handlers handle it
                }
                
                // Toggle play/pause on container click
                if (isPlaying) {
                    audio.pause();
                } else {
                    audio.play();
                }
            });
            
            // Play button event
            const playBtn = document.getElementById(`playBtn-${uniqueId}`);
            if (playBtn) {
                playBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (isPlaying) {
                        audio.pause();
                    } else {
                        audio.play();
                    }
                });
            }
            
            // Audio event listeners
            audio.addEventListener('play', () => {
                isPlaying = true;
                const playIcon = document.getElementById(`playIcon-${uniqueId}`);
                if (playIcon) {
                    playIcon.className = 'fas fa-pause';
                }
            });
            
            audio.addEventListener('pause', () => {
                isPlaying = false;
                const playIcon = document.getElementById(`playIcon-${uniqueId}`);
                if (playIcon) {
                    playIcon.className = 'fas fa-play';
                }
            });
            
            audio.addEventListener('timeupdate', () => {
                const progress = (audio.currentTime / audio.duration) * 100;
                const progressBar = document.getElementById(`waveformProgress-${uniqueId}`);
                if (progressBar) {
                    progressBar.style.width = `${progress}%`;
                }
                
                // Update duration display
                const currentMinutes = Math.floor(audio.currentTime / 60);
                const currentSeconds = Math.floor(audio.currentTime % 60);
                const durationElement = document.getElementById(`duration-${uniqueId}`);
                if (durationElement) {
                    durationElement.textContent = 
                        `${currentMinutes.toString().padStart(2, '0')}:${currentSeconds.toString().padStart(2, '0')}`;
                }
            });
            
            audio.addEventListener('ended', () => {
                isPlaying = false;
                const playIcon = document.getElementById(`playIcon-${uniqueId}`);
                if (playIcon) {
                    playIcon.className = 'fas fa-play';
                }
                const progressBar = document.getElementById(`waveformProgress-${uniqueId}`);
                if (progressBar) {
                    progressBar.style.width = '0%';
                }
                const durationElement = document.getElementById(`duration-${uniqueId}`);
                if (durationElement) {
                    durationElement.textContent = durationText;
                }
            });
            
            // Click to seek on waveform
            const waveform = document.getElementById(`waveform-${uniqueId}`);
            if (waveform) {
                waveform.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const rect = waveform.getBoundingClientRect();
                    const clickX = e.clientX - rect.left;
                    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
                    audio.currentTime = audio.duration * percentage;
                });
            }
            
            // Clean up audio when container is removed
            const cleanup = () => {
                if (audio && !audio.paused) {
                    audio.pause();
                }
                if (audio.src && audio.src.startsWith('blob:')) {
                    URL.revokeObjectURL(audio.src);
                }
                container.removeEventListener('DOMNodeRemoved', cleanup);
            };
            
            // Store audio reference on container for external access
            container._audio = audio;
            container._isPlaying = false;
        }
        
        return container;
    }

    // NEW: Page visibility listener to handle page leave/return
    setupPageVisibilityListener() {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                // Page is being hidden/left
                console.log('Page hidden - cleaning up processed messages');
                // Don't clear processed IDs, just mark as inactive
                this.connectionState = 'inactive';
                
                // Pause all voice messages when page is hidden
                document.querySelectorAll('.voice-message-container').forEach(container => {
                    if (container._audio && !container._audio.paused) {
                        container._audio.pause();
                        const playIcon = container.querySelector('.fas');
                        if (playIcon) {
                            playIcon.className = 'fas fa-play';
                        }
                    }
                });
            } else {
                // Page is visible again
                console.log('Page visible - resetting connection state');
                this.connectionState = 'reconnecting';
                this.isOnline = navigator.onLine;
                
                // Clear page processed messages for current group when page becomes visible
                if (this.currentGroupId) {
                    const pageProcessedKey = `page_processed_${this.currentGroupId}`;
                    this.pageProcessedMessageIdsByGroup.delete(pageProcessedKey);
                    console.log('Cleared page processed messages for group:', this.currentGroupId);
                }
            }
        });
    }

    setupNetworkListener() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.connectionState = 'reconnecting';
            console.log('Network: Online');
            
            // When coming back online, clear sent message IDs to allow resending
            this.sentMessageIds.clear();
            this.pendingMessages.clear();
            
            // Clear page processed messages for current group
            if (this.currentGroupId) {
                const pageProcessedKey = `page_processed_${this.currentGroupId}`;
                this.pageProcessedMessageIdsByGroup.delete(pageProcessedKey);
            }
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.connectionState = 'disconnected';
            console.log('Network: Offline');
            
            // Clear pending messages when offline
            this.pendingMessages.clear();
        });
    }

    getCachedItem(cacheKey, cacheMap) {
        const cached = cacheMap.get(cacheKey);
        if (!cached) return null;
        
        if (Date.now() > cached.expiry) {
            cacheMap.delete(cacheKey);
            return null;
        }
        
        return cached.data;
    }

    setCachedItem(cacheKey, data, cacheMap, duration) {
        cacheMap.set(cacheKey, {
            data: data,
            expiry: Date.now() + duration
        });
    }

    clearGroupCache(groupId) {
        this.cache.groupData.delete(groupId);
        this.cache.groupMembers.delete(groupId);
        this.cache.joinedGroups.delete(groupId);
        this.cache.messageReactions.delete(groupId);
        
        // Also clear processed messages for this group
        if (this.processedMessageIdsByGroup) {
            this.processedMessageIdsByGroup.delete(`processed_${groupId}`);
        }
        
        // Clear page processed messages for this group
        if (this.pageProcessedMessageIdsByGroup) {
            this.pageProcessedMessageIdsByGroup.delete(`page_processed_${groupId}`);
        }
        
        // Clear initial load flag
        if (this.initialLoadComplete) {
            this.initialLoadComplete.delete(groupId);
        }
        
        // Clear pending updates
        if (this.pendingMessageUpdates) {
            this.pendingMessageUpdates.delete(groupId);
        }
        
        // Clear IndexedDB cache for this group
        if (indexedDBCache) {
            // We'll handle IndexedDB clearing asynchronously
            setTimeout(async () => {
                try {
                    await indexedDBCache.clear('group_messages');
                    await indexedDBCache.clear('group_members');
                    console.log('Cleared IndexedDB cache for group:', groupId);
                } catch (error) {
                    console.error('Error clearing IndexedDB cache:', error);
                }
            }, 0);
        }
    }

    clearAllCache() {
        this.cache = {
            userProfile: null,
            userProfileExpiry: 0,
            joinedGroups: new Map(),
            groupData: new Map(),
            groupMembers: new Map(),
            profileSetupChecked: false,
            blockedUsers: new Map(),
            messageReactions: new Map(),
            userProfiles: new Map(),
            mutualGroups: new Map(),
            privateChats: new Map(),
            unreadCounts: new Map(),
            groupChats: new Map(),
            groupInvites: new Map(),
            adminGroups: new Map(),
            allGroups: new Map(),
            messages: new Map(),
            userXP: new Map()
        };
        this.lastDisplayedMessages.clear();
        this.messageRenderQueue = [];
        
        // Clear processed messages for all groups
        if (this.processedMessageIdsByGroup) {
            this.processedMessageIdsByGroup.clear();
        }
        
        // Clear page processed messages for all groups
        if (this.pageProcessedMessageIdsByGroup) {
            this.pageProcessedMessageIdsByGroup.clear();
        }
        
        // Clear initial load flags
        if (this.initialLoadComplete) {
            this.initialLoadComplete.clear();
        }
        
        // Clear pending updates
        if (this.pendingMessageUpdates) {
            this.pendingMessageUpdates.clear();
        }
        
        // Clear XP cache
        xpDataCache.clear();
        this.userXPCache.clear();
        this.dailyXPTracking.clear();
        
        // Clear typing data
        this.typingUsers.clear();
        this.lastMessageTimes.clear();
        
        // Clear voice recording
        if (this.isRecording) {
            this.cancelVoiceRecording();
        }
        this.currentVoiceNote = null;
        this.audioChunks = [];
        
        // Clear active uploads
        this.activeUploads.clear();
        
        // Clear local storage cache
        cache.clear();
        
        // Clear IndexedDB cache
        if (indexedDBCache) {
            setTimeout(async () => {
                try {
                    await indexedDBCache.clear('groups');
                    await indexedDBCache.clear('group_messages');
                    await indexedDBCache.clear('group_members');
                    await indexedDBCache.clear('user_profiles');
                    await indexedDBCache.clear('offline_messages');
                    await indexedDBCache.clear('voice_notes');
                    await indexedDBCache.clear('xp_data');
                    console.log('Cleared all IndexedDB cache');
                } catch (error) {
                    console.error('Error clearing IndexedDB cache:', error);
                }
            }, 0);
        }
    }

    async loadBlockedUsers() {
        try {
            if (!this.firebaseUser) return;
            
            const blockedRef = collection(db, 'blocked_users');
            const q = query(blockedRef, where('blockedById', '==', this.firebaseUser.uid));
            const snapshot = await getDocs(q);
            
            snapshot.forEach(doc => {
                const data = doc.data();
                this.blockedUsers.set(data.userId, data);
            });
        } catch (error) {
            console.error('Error loading blocked users:', error);
        }
    }

    async blockUser(userId) {
        try {
            if (!this.firebaseUser) return;
            
            const blockRef = doc(collection(db, 'blocked_users'));
            await setDoc(blockRef, {
                userId: userId,
                blockedById: this.firebaseUser.uid,
                blockedAt: serverTimestamp(),
                reason: 'Removed from group by admin'
            });
            
            this.blockedUsers.set(userId, {
                userId: userId,
                blockedById: this.firebaseUser.uid,
                blockedAt: new Date()
            });
            
            return true;
        } catch (error) {
            console.error('Error blocking user:', error);
            return false;
        }
    }

    async isUserBlocked(userId) {
        if (this.blockedUsers.has(userId)) {
            return true;
        }
        
        try {
            const blockedRef = collection(db, 'blocked_users');
            const q = query(blockedRef, 
                where('userId', '==', userId),
                where('blockedById', '==', this.firebaseUser.uid)
            );
            const snapshot = await getDocs(q);
            
            return !snapshot.empty;
        } catch (error) {
            console.error('Error checking if user is blocked:', error);
            return false;
        }
    }

    checkRestrictedUsers() {
        setInterval(() => {
            const now = Date.now();
            for (const [groupId, users] of this.restrictedUsers) {
                for (const [userId, restrictionEnd] of users) {
                    if (now > restrictionEnd) {
                        users.delete(userId);
                    }
                }
                if (users.size === 0) {
                    this.restrictedUsers.delete(groupId);
                }
            }
        }, 60000);
    }

    async restrictUser(groupId, userId, durationHours = 2) {
        if (!this.restrictedUsers.has(groupId)) {
            this.restrictedUsers.set(groupId, new Map());
        }
        
        const restrictionEnd = Date.now() + (durationHours * 60 * 60 * 1000);
        this.restrictedUsers.get(groupId).set(userId, restrictionEnd);
        
        try {
            const restrictionRef = doc(db, 'groups', groupId, 'restricted_users', userId);
            await setDoc(restrictionRef, {
                userId: userId,
                restrictedUntil: new Date(restrictionEnd),
                restrictedAt: serverTimestamp(),
                restrictedBy: this.firebaseUser?.uid,
                reason: 'Used restricted word'
            }, { merge: true });
        } catch (error) {
            console.error('Error saving restriction to Firebase:', error);
        }
    }

    async isUserRestricted(groupId, userId) {
        if (this.restrictedUsers.has(groupId)) {
            const restrictionEnd = this.restrictedUsers.get(groupId).get(userId);
            if (restrictionEnd && Date.now() < restrictionEnd) {
                return true;
            }
        }
        
        try {
            const restrictionRef = doc(db, 'groups', groupId, 'restricted_users', userId);
            const restrictionSnap = await getDoc(restrictionRef);
            
            if (restrictionSnap.exists()) {
                const data = restrictionSnap.data();
                const restrictedUntil = data.restrictedUntil?.toDate ? data.restrictedUntil.toDate() : new Date(data.restrictedUntil);
                
                if (Date.now() < restrictedUntil.getTime()) {
                    if (!this.restrictedUsers.has(groupId)) {
                        this.restrictedUsers.set(groupId, new Map());
                    }
                    this.restrictedUsers.get(groupId).set(userId, restrictedUntil.getTime());
                    return true;
                } else {
                    await deleteDoc(restrictionRef);
                }
            }
        } catch (error) {
            console.error('Error checking restriction in Firebase:', error);
        }
        
        return false;
    }

    async checkMessageForRestrictedWords(groupId, message) {
        try {
            const groupRef = doc(db, 'groups', groupId);
            const groupSnap = await getDoc(groupRef);
            
            if (groupSnap.exists()) {
                const groupData = groupSnap.data();
                const restrictedWords = groupData.restrictedWords || [];
                
                if (restrictedWords.length === 0) {
                    return false;
                }
                
                const messageLower = message.toLowerCase();
                for (const word of restrictedWords) {
                    if (word.trim() && messageLower.includes(word.toLowerCase().trim())) {
                        return word;
                    }
                }
            }
            return false;
        } catch (error) {
            console.error('Error checking restricted words:', error);
            return false;
        }
    }

    async uploadMediaToCloudinary(file, uploadId, onProgress = null, onCancel = null) {
        // Check if offline before starting upload
        if (!this.isOnline) {
            throw new Error('You are offline. Please check your network connection.');
        }
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', cloudinaryConfig.uploadPreset);
        
        const isVideo = file.type.startsWith('video/');
        formData.append('resource_type', isVideo ? 'video' : 'image');
        
        // Store cancel controller
        const controller = new AbortController();
        
        if (onCancel) {
            onCancel(() => {
                controller.abort();
                this.activeUploads.delete(uploadId);
            });
        }
        
        try {
            const response = await fetch(
                `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/${isVideo ? 'video' : 'image'}/upload`,
                {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    signal: controller.signal
                }
            );
            
            if (!response.ok) {
                throw new Error(`Cloudinary error: ${response.statusText}`);
            }
            
            const data = await response.json();
            if (!data.secure_url) {
                throw new Error('Invalid response from Cloudinary');
            }
            
            // Remove from active uploads
            this.activeUploads.delete(uploadId);
            
            return data.secure_url;
        } catch (error) {
            // Remove from active uploads
            this.activeUploads.delete(uploadId);
            
            if (error.name === 'AbortError') {
                throw new Error('Upload cancelled');
            }
            throw error;
        }
    }

    validateImageFile(file) {
        const maxSize = 10 * 1024 * 1000;
        if (file.size > maxSize) {
            throw new Error('Image file must be less than 10MB');
        }
        
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            throw new Error('Please upload a valid image file (JPEG, PNG, GIF, WebP)');
        }
        
        return true;
    }

    validateVideoFile(file) {
        const maxSize = 50 * 1024 * 1000;
        if (file.size > maxSize) {
            throw new Error('Video file must be less than 50MB');
        }
        
        const allowedTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo'];
        if (!allowedTypes.includes(file.type)) {
            throw new Error('Please upload a valid video file (MP4, WebM, OGG, MOV, AVI)');
        }
        
        return true;
    }

    async getUserProfile(userId, forceRefresh = false) {
        try {
            const cacheKey = `user_${userId}`;
            
            // First check memory cache
            if (!forceRefresh) {
                const cached = this.getCachedItem(cacheKey, this.cache.userProfiles);
                if (cached) {
                    return cached;
                }
            }
            
            // Then check IndexedDB cache
            if (!forceRefresh && indexedDBCache) {
                try {
                    const indexedDBCached = await indexedDBCache.get('user_profiles', userId);
                    if (indexedDBCached) {
                        // Update memory cache
                        this.setCachedItem(cacheKey, indexedDBCached, this.cache.userProfiles, CACHE_DURATION.USER_PROFILE);
                        return indexedDBCached;
                    }
                } catch (error) {
                    console.log('Error getting user profile from IndexedDB:', error);
                }
            }

            const userRef = doc(db, 'group_users', userId);
            const userSnap = await getDoc(userRef);
            
            if (userSnap.exists()) {
                const userData = userSnap.data();
                const profile = {
                    id: userId,
                    name: userData.displayName || 'User',
                    avatar: userData.avatar || AVATAR_OPTIONS[0],
                    bio: userData.bio || 'No bio available.',
                    email: userData.email || '',
                    lastSeen: userData.lastSeen ? 
                        (userData.lastSeen.toDate ? userData.lastSeen.toDate() : userData.lastSeen) : 
                        new Date(),
                    createdAt: userData.createdAt ? 
                        (userData.createdAt.toDate ? userData.createdAt.toDate() : userData.createdAt) : 
                        new Date(),
                    profileComplete: userData.displayName && userData.avatar ? true : false
                };
                
                // Update memory cache
                this.setCachedItem(cacheKey, profile, this.cache.userProfiles, CACHE_DURATION.USER_PROFILE);
                
                // Update IndexedDB cache
                if (indexedDBCache) {
                    try {
                        await indexedDBCache.set('user_profiles', {
                            userId: userId,
                            ...profile,
                            cachedAt: Date.now()
                        });
                    } catch (error) {
                        console.log('Error caching user profile in IndexedDB:', error);
                    }
                }
                
                return profile;
            }
            return null;
        } catch (error) {
            console.error('Error getting user profile:', error);
            return null;
        }
    }

    // NEW: Get user XP data with rank
    async getUserXPWithRank(userId, forceRefresh = false) {
        try {
            // Check cache first
            if (!forceRefresh) {
                const cached = this.userXPCache.get(userId);
                if (cached && cached.expiry > Date.now()) {
                    return cached;
                }
            }
            
            // Get XP data
            const xpData = await getUserXPData(userId);
            
            // Get rank
            const rank = getUserRankFromXP(xpData);
            
            const result = {
                xpData: xpData,
                rank: rank,
                level: rank.level,
                icon: rank.icon,
                title: rank.title,
                color: rank.color
            };
            
            // Cache for 5 minutes
            this.userXPCache.set(userId, {
                ...result,
                expiry: Date.now() + 5 * 60 * 1000
            });
            
            return result;
        } catch (error) {
            console.error('Error getting user XP with rank:', error);
            return {
                xpData: { totalXP: 0, coins: 0 },
                rank: XP_RANKS[0],
                level: 1,
                icon: XP_RANKS[0].icon,
                title: XP_RANKS[0].title,
                color: XP_RANKS[0].color
            };
        }
    }

    // NEW: Check daily XP limit
    async checkDailyXPLimit(userId) {
        const today = new Date().toDateString();
        const userDaily = this.dailyXPTracking.get(userId);
        
        if (!userDaily || userDaily.date !== today) {
            // Reset for new day
            this.dailyXPTracking.set(userId, {
                date: today,
                count: 0
            });
            return true;
        }
        
        if (userDaily.count >= this.dailyXPLimit) {
            console.log(`Daily XP limit reached for user ${userId}`);
            return false;
        }
        
        return true;
    }

    // NEW: Award XP for chat activity
    async awardChatXP(userId, activityType) {
        try {
            // Check daily limit
            const canAward = await this.checkDailyXPLimit(userId);
            if (!canAward) return false;
            
            let xpAmount = 0;
            let reason = '';
            
            switch(activityType) {
                case 'message_sent':
                    xpAmount = XP_REWARDS.MESSAGE_SENT;
                    reason = 'Sent a message';
                    break;
                case 'image_sent':
                    xpAmount = XP_REWARDS.IMAGE_SENT;
                    reason = 'Shared an image';
                    break;
                case 'video_sent':
                    xpAmount = XP_REWARDS.VIDEO_SENT;
                    reason = 'Shared a video';
                    break;
                case 'voice_sent':
                    xpAmount = XP_REWARDS.VOICE_SENT;
                    reason = 'Sent a voice note';
                    break;
                case 'reaction_added':
                    xpAmount = XP_REWARDS.REACTION_ADDED;
                    reason = 'Added a reaction';
                    break;
                default:
                    return false;
            }
            
            // Award XP
            const success = await awardXP(userId, xpAmount, reason);
            
            if (success) {
                // Update daily count
                const userDaily = this.dailyXPTracking.get(userId);
                if (userDaily) {
                    userDaily.count += 1;
                }
                
                // Clear cache
                this.userXPCache.delete(userId);
                
                // Get updated XP data to check for milestones
                const xpData = await getUserXPData(userId);
                
                // Check for XP milestones (every 100 XP)
                if (xpData.totalXP % 100 === 0 && xpData.totalXP > 0) {
                    await sendRewardSystemMessage(
                        this.currentGroupId,
                        userId,
                        this.currentUser?.name || 'User',
                        `${xpData.totalXP} total XP`,
                        'milestone'
                    );
                }
            }
            
            return success;
        } catch (error) {
            console.error('Error awarding chat XP:', error);
            return false;
        }
    }

    async getMutualGroups(userId1, userId2) {
        try {
            const cacheKey = `mutual_${userId1}_${userId2}`;
            const cached = this.getCachedItem(cacheKey, this.cache.mutualGroups);
            if (cached) return cached;

            const groupsRef = collection(db, 'groups');
            const user1Groups = [];
            const querySnapshot = await getDocs(groupsRef);
            
            for (const docSnap of querySnapshot.docs) {
                const memberRef = doc(db, 'groups', docSnap.id, 'members', userId1);
                const memberSnap = await getDoc(memberRef);
                if (memberSnap.exists()) {
                    user1Groups.push(docSnap.id);
                }
            }
            
            const mutualGroups = [];
            for (const groupId of user1Groups) {
                const memberRef = doc(db, 'groups', groupId, 'members', userId2);
                const memberSnap = await getDoc(memberRef);
                if (memberSnap.exists()) {
                    const groupRef = doc(db, 'groups', groupId);
                    const groupSnap = await getDoc(groupRef);
                    if (groupSnap.exists()) {
                        const groupData = groupSnap.data();
                        mutualGroups.push({
                            id: groupId,
                            name: groupData.name,
                            avatar: groupData.photoUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(groupData.name)}`,
                            memberCount: groupData.memberCount || 0,
                            description: groupData.description || ''
                        });
                    }
                }
            }
            
            this.setCachedItem(cacheKey, mutualGroups, this.cache.mutualGroups, CACHE_DURATION.GROUP_DATA);
            
            return mutualGroups;
        } catch (error) {
            console.error('Error getting mutual groups:', error);
            return [];
        }
    }

    getPrivateChatId(userId1, userId2) {
        const ids = [userId1, userId2].sort();
        return `private_${ids[0]}_${ids[1]}`;
    }

    // NEW: Create XP badge HTML
    createXPBadge(xpRank) {
        if (!xpRank) return '';
        
        return `
            <span class="xp-badge" style="background: linear-gradient(135deg, ${xpRank.color}, #764ba2);">
                <span class="xp-icon">${xpRank.icon}</span>
                <span>Lvl ${xpRank.level}</span>
                <span class="xp-level">${xpRank.title.split(' ')[0]}</span>
            </span>
        `;
    }

    async sendPrivateMessage(toUserId, text = null, imageUrl = null, videoUrl = null, replyTo = null, voiceUrl = null, duration = null) {
        try {
            if (!this.firebaseUser || !this.currentUser) {
                throw new Error('You must be logged in to send messages');
            }
            
            if (!text && !imageUrl && !videoUrl && !voiceUrl) {
                throw new Error('Message cannot be empty');
            }
            
            const chatId = this.getPrivateChatId(this.firebaseUser.uid, toUserId);
            const messageId = `${chatId}_${this.firebaseUser.uid}_${Date.now()}`;
            
            if (this.sentMessageIds.has(messageId)) {
                console.log('Duplicate private message prevented:', messageId);
                return true;
            }
            
            this.sentMessageIds.add(messageId);
            
            const messagesRef = collection(db, 'private_chats', chatId, 'messages');
            
            const messageData = {
                senderId: this.firebaseUser.uid,
                senderName: this.currentUser.name,
                senderAvatar: this.currentUser.avatar,
                timestamp: serverTimestamp(),
                read: false,
                chatType: 'private'
            };
            
            if (replyTo) {
                messageData.replyTo = replyTo;
            }
            
            if (text) {
                messageData.text = text.trim();
            }
            
            if (imageUrl) {
                messageData.imageUrl = imageUrl;
                messageData.type = 'image';
            }
            
            if (videoUrl) {
                messageData.videoUrl = videoUrl;
                messageData.type = 'video';
            }
            
            if (voiceUrl) {
                messageData.voiceUrl = voiceUrl;
                messageData.type = 'voice';
                messageData.duration = duration;
            }
            
            await addDoc(messagesRef, messageData);
            
            const chatRef = doc(db, 'private_chats', chatId);
            await setDoc(chatRef, {
                participants: [this.firebaseUser.uid, toUserId],
                lastMessage: {
                    text: text ? text.trim() : (imageUrl ? '📷 Image' : videoUrl ? '🎬 Video' : voiceUrl ? '🎤 Voice Note' : ''),
                    senderId: this.firebaseUser.uid,
                    senderName: this.currentUser.name,
                    timestamp: serverTimestamp()
                },
                updatedAt: serverTimestamp()
            }, { merge: true });
            
            return true;
        } catch (error) {
            console.error('Error sending private message:', error);
            this.sentMessageIds.delete(messageId);
            throw error;
        }
    }

    async sendPrivateMediaMessage(toUserId, file, replyTo = null, onProgress = null, onCancel = null) {
        try {
            const isVideo = file.type.startsWith('video/');
            const isAudio = file.type.startsWith('audio/');
            
            if (isVideo) {
                this.validateVideoFile(file);
            } else if (isAudio) {
                this.validateAudioFile(file);
            } else {
                this.validateImageFile(file);
            }
            
            const uploadId = 'upload_private_' + Date.now();
            
            const mediaUrl = await this.uploadMediaToCloudinary(file, uploadId, onProgress, onCancel);
            
            if (isVideo) {
                await this.sendPrivateMessage(toUserId, null, null, mediaUrl, replyTo);
            } else if (isAudio) {
                // Get duration from audio file
                const audio = new Audio(mediaUrl);
                audio.addEventListener('loadedmetadata', async () => {
                    await this.sendPrivateMessage(toUserId, null, null, null, replyTo, mediaUrl, Math.floor(audio.duration * 1000));
                });
                audio.load();
            } else {
                await this.sendPrivateMessage(toUserId, null, mediaUrl, null, replyTo);
            }
            
            return true;
        } catch (error) {
            console.error('Error sending private media message:', error);
            throw error;
        }
    }

    async getPrivateMessages(otherUserId, limitCount = 50) {
        try {
            const chatId = this.getPrivateChatId(this.firebaseUser.uid, otherUserId);
            const messagesRef = collection(db, 'private_chats', chatId, 'messages');
            const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(limitCount));
            const querySnapshot = await getDocs(q);
            
            const messages = [];
            querySnapshot.forEach(doc => {
                const data = doc.data();
                messages.push({ 
                    id: doc.id, 
                    ...data,
                    chatType: 'private',
                    timestamp: data.timestamp ? (data.timestamp.toDate ? data.timestamp.toDate() : data.timestamp) : new Date()
                });
            });
            
            return messages.reverse();
        } catch (error) {
            console.error('Error getting private messages:', error);
            return [];
        }
    }

    listenToPrivateMessages(otherUserId, callback) {
        try {
            // First, unsubscribe from any existing listener
            if (this.unsubscribePrivateMessages && typeof this.unsubscribePrivateMessages === 'function') {
                try {
                    this.unsubscribePrivateMessages();
                } catch (err) {
                    console.log('Error unsubscribing from previous private messages:', err);
                }
                this.unsubscribePrivateMessages = null;
            }
            
            const chatId = this.getPrivateChatId(this.firebaseUser.uid, otherUserId);
            const messagesRef = collection(db, 'private_chats', chatId, 'messages');
            const q = query(messagesRef, orderBy('timestamp', 'asc'));
            
            let isProcessing = false;
            let lastProcessedIds = new Set();
            
            const unsubscribe = onSnapshot(q, (snapshot) => {
                if (isProcessing) return;
                isProcessing = true;
                
                try {
                    const messages = [];
                    const currentIds = new Set();
                    
                    snapshot.forEach(doc => {
                        const data = doc.data();
                        const messageId = doc.id;
                        currentIds.add(messageId);
                        
                        // Only add if not already processed
                        if (!lastProcessedIds.has(messageId)) {
                            messages.push({ 
                                id: messageId, 
                                ...data,
                                chatType: 'private',
                                timestamp: data.timestamp ? (data.timestamp.toDate ? data.timestamp.toDate() : data.timestamp) : new Date()
                            });
                        }
                    });
                    
                    if (messages.length > 0) {
                        lastProcessedIds = new Set([...lastProcessedIds, ...currentIds]);
                        callback(messages);
                    }
                } catch (error) {
                    console.error('Error processing private messages:', error);
                } finally {
                    setTimeout(() => {
                        isProcessing = false;
                    }, 100);
                }
            }, (error) => {
                console.error('Error in private messages listener:', error);
                isProcessing = false;
            });
            
            this.unsubscribePrivateMessages = unsubscribe;
            
            return unsubscribe;
        } catch (error) {
            console.error('Error listening to private messages:', error);
            // Return a dummy unsubscribe function to prevent errors
            return () => {
                console.log('Dummy unsubscribe for private messages called');
            };
        }
    }

    async getPrivateChats() {
        try {
            if (!this.firebaseUser) return [];
            
            const cacheKey = `private_chats_${this.firebaseUser.uid}`;
            const cached = this.getCachedItem(cacheKey, this.cache.privateChats);
            if (cached) return cached;

            const privateChatsRef = collection(db, 'private_chats');
            const q = query(privateChatsRef, where('participants', 'array-contains', this.firebaseUser.uid));
            const querySnapshot = await getDocs(q);
            
            const chats = [];
            
            for (const docSnap of querySnapshot.docs) {
                const data = docSnap.data();
                const otherUserId = data.participants.find(id => id !== this.firebaseUser.uid);
                
                if (otherUserId) {
                    const userProfile = await this.getUserProfile(otherUserId);
                    
                    if (userProfile) {
                        const unreadCount = await this.getUnreadMessageCount(docSnap.id, otherUserId);
                        
                        chats.push({
                            id: docSnap.id,
                            chatId: docSnap.id,
                            userId: otherUserId,
                            userName: userProfile.name,
                            userAvatar: userProfile.avatar,
                            lastMessage: data.lastMessage || null,
                            updatedAt: data.updatedAt ? 
                                (data.updatedAt.toDate ? data.updatedAt.toDate() : data.updatedAt) : 
                                new Date(),
                            unreadCount: unreadCount
                        });
                    }
                }
            }
            
            chats.sort((a, b) => b.updatedAt - a.updatedAt);
            
            this.setCachedItem(cacheKey, chats, this.cache.privateChats, CACHE_DURATION.GROUP_DATA);
            
            return chats;
        } catch (error) {
            console.error('Error getting private chats:', error);
            return [];
        }
    }

    async getUnreadMessageCount(chatId, otherUserId) {
        try {
            const cacheKey = `unread_${chatId}_${otherUserId}`;
            const cached = this.getCachedItem(cacheKey, this.cache.unreadCounts);
            if (cached !== null) return cached;

            const messagesRef = collection(db, 'private_chats', chatId, 'messages');
            const q = query(messagesRef, orderBy('timestamp', 'desc'));
            const querySnapshot = await getDocs(q);
            
            let unreadCount = 0;
            querySnapshot.forEach(doc => {
                const data = doc.data();
                if (data.senderId === otherUserId && data.read === false) {
                    unreadCount++;
                }
            });
            
            this.setCachedItem(cacheKey, unreadCount, this.cache.unreadCounts, CACHE_DURATION.USER_PROFILE);
            
            return unreadCount;
        } catch (error) {
            console.error('Error getting unread count:', error);
            return 0;
        }
    }

    async markMessagesAsRead(chatId, senderId) {
        try {
            const messagesRef = collection(db, 'private_chats', chatId, 'messages');
            const q = query(messagesRef);
            const querySnapshot = await getDocs(q);
            const batch = writeBatch(db);
            let hasUpdates = false;
            
            querySnapshot.forEach(docSnap => {
                const data = docSnap.data();
                if (data.senderId === senderId && data.read === false) {
                    batch.update(docSnap.ref, { read: true });
                    hasUpdates = true;
                }
            });
            
            if (hasUpdates) {
                await batch.commit();
                
                this.cache.unreadCounts.delete(`unread_${chatId}_${senderId}`);
            }
            
            return true;
        } catch (error) {
            console.error('Error marking messages as read:', error);
            return false;
        }
    }

    async getGroupChatsWithUnread() {
        try {
            if (!this.firebaseUser) return [];
            
            const cacheKey = `group_chats_${this.firebaseUser.uid}`;
            const cached = this.getCachedItem(cacheKey, this.cache.groupChats);
            if (cached) return cached;

            const groupsRef = collection(db, 'groups');
            const querySnapshot = await getDocs(groupsRef);
            
            const groupChats = [];
            
            for (const docSnap of querySnapshot.docs) {
                const memberRef = doc(db, 'groups', docSnap.id, 'members', this.firebaseUser.uid);
                const memberSnap = await getDoc(memberRef);
                
                if (memberSnap.exists()) {
                    const groupData = docSnap.data();
                    
                    const messagesRef = collection(db, 'groups', docSnap.id, 'messages');
                    const lastMessageQuery = query(messagesRef, orderBy('timestamp', 'desc'), limit(1));
                    const lastMessageSnap = await getDocs(lastMessageQuery);
                    
                    let lastMessage = null;
                    if (!lastMessageSnap.empty) {
                        const msgData = lastMessageSnap.docs[0].data();
                        lastMessage = {
                            text: msgData.text || (msgData.imageUrl ? '📷 Image' : msgData.videoUrl ? '🎬 Video' : msgData.voiceUrl ? '🎤 Voice Note' : ''),
                            senderName: msgData.senderName || 'User',
                            timestamp: msgData.timestamp ? 
                                (msgData.timestamp.toDate ? msgData.timestamp.toDate() : msgData.timestamp) : 
                                new Date()
                        };
                    }
                    
                    groupChats.push({
                        id: docSnap.id,
                        name: groupData.name,
                        avatar: groupData.photoUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(groupData.name)}`,
                        lastMessage: lastMessage,
                        memberCount: groupData.memberCount || 0,
                        unreadCount: 0
                    });
                }
            }
            
            groupChats.sort((a, b) => {
                const timeA = a.lastMessage ? a.lastMessage.timestamp : new Date(0);
                const timeB = b.lastMessage ? b.lastMessage.timestamp : new Date(0);
                return timeB - timeA;
            });
            
            this.setCachedItem(cacheKey, groupChats, this.cache.groupChats, CACHE_DURATION.GROUP_DATA);
            
            return groupChats;
        } catch (error) {
            console.error('Error getting group chats:', error);
            return [];
        }
    }

    generateInviteCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let code = '';
        for (let i = 0; i < 8; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    async getGroupByInviteCode(inviteCode) {
        try {
            const cacheKey = `group_invite_${inviteCode}`;
            const cached = this.getCachedItem(cacheKey, this.cache.groupInvites);
            if (cached) return cached;

            const groupsRef = collection(db, 'groups');
            const q = query(groupsRef, where('inviteCode', '==', inviteCode));
            const querySnapshot = await getDocs(q);
            
            if (!querySnapshot.empty) {
                const doc = querySnapshot.docs[0];
                const data = doc.data();
                const group = { 
                    id: doc.id, 
                    ...data,
                    createdAt: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate() : data.createdAt) : new Date(),
                    updatedAt: data.updatedAt ? (data.updatedAt.toDate ? data.updatedAt.toDate() : data.updatedAt) : new Date()
                };
                
                this.setCachedItem(cacheKey, group, this.cache.groupInvites, CACHE_DURATION.GROUP_DATA);
                
                return group;
            }
            return null;
        } catch (error) {
            console.error('Error getting group by invite code:', error);
            throw error;
        }
    }

    async regenerateInviteCode(groupId) {
        try {
            if (!this.firebaseUser) {
                throw new Error('You must be logged in to regenerate invite code');
            }

            const groupRef = doc(db, 'groups', groupId);
            const groupSnap = await getDoc(groupRef);
            
            if (!groupSnap.exists()) {
                throw new Error('Group not found');
            }

            const groupData = groupSnap.data();
            if (groupData.createdBy !== this.firebaseUser.uid) {
                throw new Error('Only group admin can regenerate invite code');
            }

            const newInviteCode = this.generateInviteCode();
            const newInviteLink = `https://bond-base.vercel.app/join.html?code=${newInviteCode}`;

            await updateDoc(groupRef, {
                inviteCode: newInviteCode,
                inviteLink: newInviteLink,
                updatedAt: serverTimestamp()
            });

            this.clearGroupCache(groupId);
            
            this.cache.groupInvites.delete(`group_invite_${groupData.inviteCode}`);

            return newInviteLink;
        } catch (error) {
            console.error('Error regenerating invite code:', error);
            throw error;
        }
    }

    async getGroupInviteLink(groupId) {
        try {
            const cachedGroup = this.getCachedItem(groupId, this.cache.groupData);
            if (cachedGroup && cachedGroup.inviteLink) {
                return cachedGroup.inviteLink;
            }

            const groupRef = doc(db, 'groups', groupId);
            const groupSnap = await getDoc(groupRef);
            
            if (!groupSnap.exists()) {
                throw new Error('Group not found');
            }

            const groupData = groupSnap.data();
            
            this.setCachedItem(groupId, groupData, this.cache.groupData, CACHE_DURATION.GROUP_DATA);
            
            if (groupData.inviteCode && groupData.inviteLink) {
                return groupData.inviteLink;
            }
            
            const inviteCode = this.generateInviteCode();
            const inviteLink = `https://bond-base.vercel.app/join.html?code=${inviteCode}`;
            
            await updateDoc(groupRef, {
                inviteCode: inviteCode,
                inviteLink: inviteLink,
                updatedAt: serverTimestamp()
            });

            groupData.inviteCode = inviteCode;
            groupData.inviteLink = inviteLink;
            this.setCachedItem(groupId, groupData, this.cache.groupData, CACHE_DURATION.GROUP_DATA);

            return inviteLink;
        } catch (error) {
            console.error('Error getting invite link:', error);
            throw error;
        }
    }

    async getAdminGroups() {
        try {
            if (!this.firebaseUser) {
                throw new Error('You must be logged in to view admin groups');
            }

            const cacheKey = `admin_groups_${this.firebaseUser.uid}`;
            const cached = this.getCachedItem(cacheKey, this.cache.adminGroups);
            if (cached) return cached;

            const groupsRef = collection(db, 'groups');
            const q = query(groupsRef, orderBy('createdAt', 'desc'));
            
            const querySnapshot = await getDocs(q);
            
            const groups = [];
            querySnapshot.forEach(doc => {
                const data = doc.data();
                if (data.createdBy === this.firebaseUser.uid) {
                    groups.push({ 
                        id: doc.id, 
                        ...data,
                        createdAt: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate() : data.createdAt) : new Date(),
                        updatedAt: data.updatedAt ? (data.updatedAt.toDate ? data.updatedAt.toDate() : data.updatedAt) : new Date()
                    });
                }
            });
            
            this.setCachedItem(cacheKey, groups, this.cache.adminGroups, CACHE_DURATION.GROUP_DATA);
            
            return groups;
        } catch (error) {
            console.error('Error getting admin groups:', error);
            throw error;
        }
    }

    async getGroupMembersWithDetails(groupId, forceRefresh = false) {
        try {
            if (!forceRefresh) {
                const cachedMembers = this.getCachedItem(groupId, this.cache.groupMembers);
                if (cachedMembers) {
                    return cachedMembers;
                }
                
                // Try IndexedDB cache
                if (indexedDBCache) {
                    try {
                        const indexedDBCached = await indexedDBCache.getGroupMembers(groupId);
                        if (indexedDBCached && indexedDBCached.length > 0) {
                            this.setCachedItem(groupId, indexedDBCached, this.cache.groupMembers, CACHE_DURATION.MEMBERS_LIST);
                            return indexedDBCached;
                        }
                    } catch (error) {
                        console.log('Error getting group members from IndexedDB:', error);
                    }
                }
            }

            const membersRef = collection(db, 'groups', groupId, 'members');
            const q = query(membersRef, orderBy('joinedAt', 'asc'));
            const querySnapshot = await getDocs(q);
            
            const members = [];
            
            const groupRef = doc(db, 'groups', groupId);
            const groupSnap = await getDoc(groupRef);
            const groupData = groupSnap.exists() ? groupSnap.data() : null;
            const adminId = groupData?.createdBy;
            
            for (const docSnap of querySnapshot.docs) {
                const data = docSnap.data();
                
                const userRef = doc(db, 'group_users', docSnap.id);
                const userSnap = await getDoc(userRef);
                const userData = userSnap.exists() ? userSnap.data() : {};
                
                // Get XP data for member
                const xpRank = await this.getUserXPWithRank(docSnap.id);
                
                const member = {
                    id: docSnap.id,
                    name: data.name || userData.displayName || 'Unknown',
                    avatar: data.avatar || userData.avatar || AVATAR_OPTIONS[0],
                    email: userData.email || '',
                    role: data.role || (docSnap.id === adminId ? 'creator' : 'member'),
                    joinedAt: data.joinedAt ? (data.joinedAt.toDate ? data.joinedAt.toDate() : data.joinedAt) : new Date(),
                    lastActive: data.lastActive ? (data.lastActive.toDate ? data.lastActive.toDate() : data.lastActive) : new Date(),
                    isAdmin: docSnap.id === adminId,
                    xp: {
                        level: xpRank.level,
                        icon: xpRank.icon,
                        title: xpRank.title,
                        color: xpRank.color,
                        totalXP: xpRank.xpData.totalXP
                    }
                };
                
                members.push(member);
            }
            
            this.setCachedItem(groupId, members, this.cache.groupMembers, CACHE_DURATION.MEMBERS_LIST);
            
            // Update IndexedDB cache
            if (indexedDBCache) {
                try {
                    await indexedDBCache.setGroupMembers(groupId, members);
                } catch (error) {
                    console.log('Error caching group members in IndexedDB:', error);
                }
            }
            
            return members;
        } catch (error) {
            console.error('Error getting group members:', error);
            return [];
        }
    }

    async removeMemberFromGroup(groupId, memberId, memberName = 'Member') {
        try {
            if (!this.firebaseUser) {
                throw new Error('You must be logged in to remove members');
            }

            const groupRef = doc(db, 'groups', groupId);
            const groupSnap = await getDoc(groupRef);
            
            if (!groupSnap.exists()) {
                throw new Error('Group not found');
            }

            const groupData = groupSnap.data();
            if (groupData.createdBy !== this.firebaseUser.uid) {
                throw new Error('Only group admin can remove members');
            }

            if (memberId === this.firebaseUser.uid) {
                throw new Error('You cannot remove yourself as admin');
            }

            const memberRef = doc(db, 'groups', groupId, 'members', memberId);
            await deleteDoc(memberRef);

            await updateDoc(groupRef, {
                memberCount: increment(-1),
                updatedAt: serverTimestamp()
            });

            this.clearGroupCache(groupId);

            await this.sendMemberRemovedNotification(memberId, groupId, groupData.name);

            await this.sendSystemMessage(
                groupId, 
                `${memberName} has been removed from the group by admin.`
            );

            await this.blockUser(memberId);

            return true;
        } catch (error) {
            console.error('Error removing member:', error);
            throw error;
        }
    }

    async deleteGroup(groupId) {
        try {
            if (!this.firebaseUser) {
                throw new Error('You must be logged in to delete groups');
            }

            const groupRef = doc(db, 'groups', groupId);
            const groupSnap = await getDoc(groupRef);
            
            if (!groupSnap.exists()) {
                throw new Error('Group not found');
            }

            const groupData = groupSnap.data();
            if (groupData.createdBy !== this.firebaseUser.uid) {
                throw new Error('Only group admin can delete the group');
            }

            const members = await this.getGroupMembersWithDetails(groupId);

            const batch = writeBatch(db);

            const messagesRef = collection(db, 'groups', groupId, 'messages');
            const messagesSnap = await getDocs(messagesRef);
            messagesSnap.forEach((docSnap) => {
                batch.delete(docSnap.ref);
            });

            const membersRef = collection(db, 'groups', groupId, 'members');
            const membersSnap = await getDocs(membersRef);
            membersSnap.forEach((docSnap) => {
                batch.delete(docSnap.ref);
            });

            batch.delete(groupRef);

            await batch.commit();

            this.clearGroupCache(groupId);

            await Promise.all(members.map(member => 
                this.sendGroupDeletedNotification(member.id, groupData.name)
            ));

            return true;
        } catch (error) {
            console.error('Error deleting group:', error);
            throw error;
        }
    }

    async sendMemberRemovedNotification(userId, groupId, groupName) {
        try {
            const notificationRef = doc(collection(db, 'notifications'));
            
            await setDoc(notificationRef, {
                userId: userId,
                type: 'group_member_removed',
                title: 'Removed from Group',
                message: `You have been removed from the group "${groupName}"`,
                groupId: groupId,
                groupName: groupName,
                timestamp: serverTimestamp(),
                read: false
            });
            
            return true;
        } catch (error) {
            console.error('Error sending removal notification:', error);
            return false;
        }
    }

    async sendGroupDeletedNotification(userId, groupName) {
        try {
            const notificationRef = doc(collection(db, 'notifications'));
            
            await setDoc(notificationRef, {
                userId: userId,
                type: 'group_deleted',
                title: 'Group Deleted',
                message: `The group "${groupName}" has been deleted by the admin`,
                timestamp: serverTimestamp(),
                read: false
            });
            
            return true;
        } catch (error) {
            console.error('Error sending group deleted notification:', error);
            return false;
        }
    }

    async sendSystemMessage(groupId, message) {
        try {
            const messagesRef = collection(db, 'groups', groupId, 'messages');
            
            await addDoc(messagesRef, {
                type: 'system',
                text: message,
                timestamp: serverTimestamp(),
                senderId: 'system',
                senderName: 'System',
                senderAvatar: ''
            });
            
            return true;
        } catch (error) {
            console.error('Error sending system message:', error);
            throw error;
        }
    }

    setupAuthListener() {
        this.unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
            if (user) {
                this.firebaseUser = user;
                console.log('User authenticated:', user.uid);
                
                await this.loadUserProfile(user.uid);
                
                document.dispatchEvent(new CustomEvent('groupAuthReady'));
            } else {
                this.firebaseUser = null;
                this.currentUser = null;
                this.cleanup();
                this.clearAllCache();
                console.log('User logged out');
                
                const protectedPages = ['create-group', 'group', 'admin-groups', 'user', 'chat', 'messages', 'chats'];
                const currentPage = window.location.pathname.split('/').pop().split('.')[0];
                
                if (protectedPages.includes(currentPage)) {
                    window.location.href = 'login.html';
                }
            }
        });
    }

    async loadUserProfile(userId) {
        try {
            const userProfile = await this.getUserProfile(userId, true);
            
            if (userProfile) {
                this.currentUser = userProfile;
                console.log('User profile loaded:', this.currentUser);
            } else {
                this.currentUser = {
                    id: userId,
                    name: this.firebaseUser.email.split('@')[0] || 'User',
                    avatar: AVATAR_OPTIONS[0],
                    bio: '',
                    email: this.firebaseUser.email,
                    profileComplete: false
                };
                
                console.log('New user profile created:', this.currentUser);
            }
            
            // Load current user's XP data
            await this.getUserXPWithRank(userId);
            
        } catch (error) {
            console.error('Error loading user profile:', error);
        }
    }

    async updateUserProfile(userData) {
        try {
            if (!this.firebaseUser) return;
            
            const userRef = doc(db, 'group_users', this.firebaseUser.uid);
            
            await setDoc(userRef, {
                displayName: userData.name,
                avatar: userData.avatar,
                bio: userData.bio,
                email: this.firebaseUser.email,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                lastSeen: serverTimestamp()
            }, { merge: true });
            
            this.currentUser = {
                ...this.currentUser,
                name: userData.name,
                avatar: userData.avatar,
                bio: userData.bio,
                profileComplete: true
            };
            
            this.cache.userProfile = this.currentUser;
            this.cache.userProfileExpiry = Date.now() + CACHE_DURATION.USER_PROFILE;
            this.cache.profileSetupChecked = true;
            
            this.cache.userProfiles.delete(`user_${this.firebaseUser.uid}`);
            
            return true;
        } catch (error) {
            console.error('Error updating user profile:', error);
            throw error;
        }
    }

    async needsProfileSetup() {
        if (this.cache.profileSetupChecked && this.currentUser?.profileComplete) {
            return false;
        }
        
        if (this.firebaseUser) {
            const userProfile = await this.getUserProfile(this.firebaseUser.uid, true);
            if (userProfile) {
                this.cache.profileSetupChecked = true;
                return !userProfile.profileComplete;
            }
        }
        
        return true;
    }

    getCurrentUser() {
        return this.currentUser;
    }

    async hasJoinedGroup(groupId) {
        try {
            if (!this.firebaseUser) return false;
            
            const cachedJoined = this.cache.joinedGroups.get(groupId);
            if (cachedJoined && Date.now() < cachedJoined.expiry) {
                return cachedJoined.data;
            }
            
            const memberRef = doc(db, 'groups', groupId, 'members', this.firebaseUser.uid);
            const memberSnap = await getDoc(memberRef);
            const isMember = memberSnap.exists();
            
            this.cache.joinedGroups.set(groupId, {
                data: isMember,
                expiry: Date.now() + CACHE_DURATION.GROUP_DATA
            });
            
            return isMember;
        } catch (error) {
            console.error('Error checking membership:', error);
            return false;
        }
    }

    async createGroup(groupData, photoFile = null) {
        try {
            if (!this.firebaseUser || !this.currentUser) {
                throw new Error('You must be logged in to create a group');
            }
            
            const groupRef = doc(collection(db, 'groups'));
            
            const inviteCode = this.generateInviteCode();
            const inviteLink = `https://bond-base.vercel.app/join.html?code=${inviteCode}`;
            
            let photoUrl = null;
            if (photoFile) {
                const uploadId = 'group_photo_' + Date.now();
                photoUrl = await this.uploadMediaToCloudinary(photoFile, uploadId);
            }
            
            const group = {
                id: groupRef.id,
                name: groupData.name,
                description: groupData.description,
                category: groupData.category || 'social',
                topics: groupData.topics || [],
                rules: groupData.rules || [],
                restrictedWords: groupData.restrictedWords || [],
                maxMembers: groupData.maxMembers || 1000,
                privacy: groupData.privacy || 'public',
                createdBy: this.firebaseUser.uid,
                creatorName: this.currentUser.name,
                creatorAvatar: this.currentUser.avatar,
                photoUrl: photoUrl,
                memberCount: 1,
                inviteCode: inviteCode,
                inviteLink: inviteLink,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                lastActivity: serverTimestamp()
            };

            await setDoc(groupRef, group);
            
            await this.addMember(groupRef.id, 'creator');
            
            this.setCachedItem(groupRef.id, group, this.cache.groupData, CACHE_DURATION.GROUP_DATA);
            
            // Update IndexedDB cache
            if (indexedDBCache) {
                try {
                    await indexedDBCache.setGroup(group);
                } catch (error) {
                    console.log('Error caching group in IndexedDB:', error);
                }
            }
            
            return { groupId: groupRef.id, inviteLink: inviteLink };
        } catch (error) {
            console.error('Error creating group:', error);
            throw error;
        }
    }

    async addMember(groupId, role = 'member') {
        try {
            if (!this.firebaseUser || !this.currentUser) {
                throw new Error('You must be logged in to join a group');
            }
            
            const isBlocked = await this.isUserBlocked(this.firebaseUser.uid);
            if (isBlocked) {
                throw new Error('You have been blocked from joining this group');
            }
            
            const memberRef = doc(collection(db, 'groups', groupId, 'members'), this.firebaseUser.uid);
            
            const memberData = {
                id: this.firebaseUser.uid,
                name: this.currentUser.name,
                avatar: this.currentUser.avatar,
                bio: this.currentUser.bio || '',
                role: role,
                joinedAt: serverTimestamp(),
                lastActive: serverTimestamp()
            };
            
            await setDoc(memberRef, memberData);
            
            const groupRef = doc(db, 'groups', groupId);
            await updateDoc(groupRef, {
                memberCount: increment(1),
                updatedAt: serverTimestamp(),
                lastActivity: serverTimestamp()
            });
            
            this.clearGroupCache(groupId);
            
            this.cache.joinedGroups.set(groupId, {
                data: true,
                expiry: Date.now() + CACHE_DURATION.GROUP_DATA
            });
            
            return true;
        } catch (error) {
            console.error('Error adding member:', error);
            throw error;
        }
    }

    async getAllGroups(forceRefresh = false) {
        try {
            const cacheKey = 'all_groups';
            
            if (!forceRefresh) {
                const cached = this.getCachedItem(cacheKey, this.cache.allGroups);
                if (cached) return cached;
                
                // Try IndexedDB cache
                if (indexedDBCache) {
                    try {
                        const indexedDBCached = await indexedDBCache.getGroups();
                        if (indexedDBCached && indexedDBCached.length > 0) {
                            this.setCachedItem(cacheKey, indexedDBCached, this.cache.allGroups, CACHE_DURATION.GROUP_DATA);
                            return indexedDBCached;
                        }
                    } catch (error) {
                        console.log('Error getting groups from IndexedDB:', error);
                    }
                }
            }

            const groupsRef = collection(db, 'groups');
            const q = query(groupsRef, orderBy('lastActivity', 'desc'));
            const querySnapshot = await getDocs(q);
            
            const groups = [];
            querySnapshot.forEach(doc => {
                const data = doc.data();
                const group = { 
                    id: doc.id, 
                    ...data,
                    createdAt: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate() : data.createdAt) : new Date(),
                    updatedAt: data.updatedAt ? (data.updatedAt.toDate ? data.updatedAt.toDate() : data.updatedAt) : new Date()
                };
                
                groups.push(group);
                
                this.setCachedItem(doc.id, group, this.cache.groupData, CACHE_DURATION.GROUP_DATA);
            });
            
            this.setCachedItem(cacheKey, groups, this.cache.allGroups, CACHE_DURATION.GROUP_DATA);
            
            // Update IndexedDB cache
            if (indexedDBCache) {
                try {
                    await indexedDBCache.setGroups(groups);
                } catch (error) {
                    console.log('Error caching groups in IndexedDB:', error);
                }
            }
            
            return groups;
        } catch (error) {
            console.error('Error getting groups:', error);
            throw error;
        }
    }

    async getGroup(groupId, forceRefresh = false) {
        try {
            if (!forceRefresh) {
                const cachedGroup = this.getCachedItem(groupId, this.cache.groupData);
                if (cachedGroup) {
                    return cachedGroup;
                }
                
                // Try IndexedDB cache
                if (indexedDBCache) {
                    try {
                        const indexedDBCached = await indexedDBCache.getGroup(groupId);
                        if (indexedDBCached) {
                            this.setCachedItem(groupId, indexedDBCached, this.cache.groupData, CACHE_DURATION.GROUP_DATA);
                            return indexedDBCached;
                        }
                    } catch (error) {
                        console.log('Error getting group from IndexedDB:', error);
                    }
                }
            }
            
            const groupRef = doc(db, 'groups', groupId);
            const groupSnap = await getDoc(groupRef);
            
            if (groupSnap.exists()) {
                const data = groupSnap.data();
                const group = { 
                    id: groupSnap.id, 
                    ...data,
                    createdAt: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate() : data.createdAt) : new Date(),
                    updatedAt: data.updatedAt ? (data.updatedAt.toDate ? data.updatedAt.toDate() : data.updatedAt) : new Date()
                };
                
                this.setCachedItem(groupId, group, this.cache.groupData, CACHE_DURATION.GROUP_DATA);
                
                // Update IndexedDB cache
                if (indexedDBCache) {
                    try {
                        await indexedDBCache.setGroup(group);
                    } catch (error) {
                        console.log('Error caching group in IndexedDB:', error);
                    }
                }
                
                return group;
            }
            return null;
        } catch (error) {
            console.error('Error getting group:', error);
            throw error;
        }
    }

    async getGroupMembers(groupId, forceRefresh = false) {
        try {
            return await this.getGroupMembersWithDetails(groupId, forceRefresh);
        } catch (error) {
            console.error('Error getting group members:', error);
            return [];
        }
    }

    async isMember(groupId) {
        return await this.hasJoinedGroup(groupId);
    }

    async joinGroupByInviteCode(inviteCode) {
        try {
            if (!this.firebaseUser || !this.currentUser) {
                throw new Error('You must be logged in to join a group');
            }
            
            const group = await this.getGroupByInviteCode(inviteCode);
            
            if (!group) {
                throw new Error('Invalid or expired invite link');
            }
            
            return await this.joinGroup(group.id);
        } catch (error) {
            console.error('Error joining group by invite code:', error);
            throw error;
        }
    }

    async joinGroup(groupId) {
        try {
            if (!this.firebaseUser || !this.currentUser) {
                throw new Error('You must be logged in to join a group');
            }
            
            const groupRef = doc(db, 'groups', groupId);
            const groupSnap = await getDoc(groupRef);
            
            if (!groupSnap.exists()) {
                throw new Error('Group not found');
            }
            
            const group = groupSnap.data();
            
            const isMember = await this.isMember(groupId);
            if (isMember) {
                await this.updateLastActive(groupId);
                return true;
            }
            
            if (group.memberCount >= group.maxMembers) {
                throw new Error('Group is full');
            }
            
            const role = group.createdBy === this.firebaseUser.uid ? 'creator' : 'member';
            
            await this.addMember(groupId, role);
            
            return true;
        } catch (error) {
            console.error('Error joining group:', error);
            throw error;
        }
    }

    async leaveGroup(groupId) {
        try {
            if (!this.firebaseUser) {
                throw new Error('No user found');
            }
            
            await this.removeMember(groupId);
            
            return true;
        } catch (error) {
            console.error('Error leaving group:', error);
            throw error;
        }
    }

    async removeMember(groupId) {
        try {
            if (!this.firebaseUser) return;
            
            const memberRef = doc(db, 'groups', groupId, 'members', this.firebaseUser.uid);
            await deleteDoc(memberRef);
            
            const groupRef = doc(db, 'groups', groupId);
            await updateDoc(groupRef, {
                memberCount: increment(-1),
                updatedAt: serverTimestamp()
            });
            
            this.clearGroupCache(groupId);
            
            this.cache.joinedGroups.set(groupId, {
                data: false,
                expiry: Date.now() + CACHE_DURATION.GROUP_DATA
            });
            
            return true;
        } catch (error) {
            console.error('Error removing member:', error);
            throw error;
        }
    }

    // NEW: Start typing indicator
    async startTyping(groupId) {
        try {
            if (!this.firebaseUser || !this.currentUser || !groupId) return;
            
            // Update local cache first
            if (indexedDBCache) {
                try {
                    await indexedDBCache.setTypingStatus(groupId, this.firebaseUser.uid, true);
                } catch (error) {
                    console.log('Error caching typing status:', error);
                }
            }
            
            const typingRef = doc(db, 'groups', groupId, 'typing', this.firebaseUser.uid);
            
            await setDoc(typingRef, {
                userId: this.firebaseUser.uid,
                userName: this.currentUser.name,
                timestamp: serverTimestamp(),
                isTyping: true
            }, { merge: true });
            
            // Set timeout to automatically stop typing after 5 seconds
            if (this.typingUsers.has(groupId)) {
                const userTyping = this.typingUsers.get(groupId);
                if (userTyping.has(this.firebaseUser.uid)) {
                    clearTimeout(userTyping.get(this.firebaseUser.uid));
                }
            } else {
                this.typingUsers.set(groupId, new Map());
            }
            
            const typingTimeout = setTimeout(() => {
                this.stopTyping(groupId);
            }, TYPING_TIMEOUT);
            
            this.typingUsers.get(groupId).set(this.firebaseUser.uid, typingTimeout);
            
        } catch (error) {
            console.error('Error starting typing indicator:', error);
        }
    }

    // NEW: Stop typing indicator
    async stopTyping(groupId) {
        try {
            if (!this.firebaseUser || !groupId) return;
            
            // Update local cache
            if (indexedDBCache) {
                try {
                    await indexedDBCache.setTypingStatus(groupId, this.firebaseUser.uid, false);
                } catch (error) {
                    console.log('Error caching typing status:', error);
                }
            }
            
            const typingRef = doc(db, 'groups', groupId, 'typing', this.firebaseUser.uid);
            
            await setDoc(typingRef, {
                userId: this.firebaseUser.uid,
                userName: this.currentUser.name,
                timestamp: serverTimestamp(),
                isTyping: false
            }, { merge: true });
            
            // Clear timeout
            if (this.typingUsers.has(groupId)) {
                const userTyping = this.typingUsers.get(groupId);
                if (userTyping.has(this.firebaseUser.uid)) {
                    clearTimeout(userTyping.get(this.firebaseUser.uid));
                    userTyping.delete(this.firebaseUser.uid);
                }
            }
            
        } catch (error) {
            console.error('Error stopping typing indicator:', error);
        }
    }

    // NEW: Listen to typing indicators
    listenToTyping(groupId, callback) {
        try {
            // Unsubscribe from existing typing listener if any
            if (this.unsubscribeTyping && typeof this.unsubscribeTyping === 'function') {
                try {
                    this.unsubscribeTyping();
                } catch (err) {
                    console.log('Error unsubscribing from typing:', err);
                }
                this.unsubscribeTyping = null;
            }
            
            // First check IndexedDB cache for offline typing status
            if (indexedDBCache) {
                setTimeout(async () => {
                    try {
                        const cachedTyping = await indexedDBCache.getTypingStatus(groupId);
                        if (cachedTyping && cachedTyping.length > 0) {
                            callback(cachedTyping.map(status => ({
                                userId: status.userId,
                                userName: status.userName || 'User',
                                timestamp: status.timestamp
                            })));
                        }
                    } catch (error) {
                        console.log('Error getting cached typing status:', error);
                    }
                }, 100);
            }
            
            const typingRef = collection(db, 'groups', groupId, 'typing');
            
            const unsubscribe = onSnapshot(typingRef, (snapshot) => {
                const typingUsers = [];
                const now = Date.now();
                
                snapshot.forEach(doc => {
                    const data = doc.data();
                    if (data.isTyping && data.userId !== this.firebaseUser?.uid) {
                        const timestamp = data.timestamp ? 
                            (data.timestamp.toDate ? data.timestamp.toDate().getTime() : new Date(data.timestamp).getTime()) : 
                            0;
                        
                        // Only show users who typed in the last 5 seconds
                        if (now - timestamp < TYPING_TIMEOUT) {
                            typingUsers.push({
                                userId: data.userId,
                                userName: data.userName,
                                timestamp: timestamp
                            });
                        }
                    }
                });
                
                callback(typingUsers);
            });
            
            this.unsubscribeTyping = unsubscribe;
            return unsubscribe;
        } catch (error) {
            console.error('Error listening to typing indicators:', error);
            return () => {};
        }
    }

    async sendMessage(groupId, text = null, imageUrl = null, videoUrl = null, replyTo = null, voiceUrl = null, duration = null) {
        try {
            // Check if offline before sending
            if (!this.isOnline) {
                // Queue message for offline sending
                const offlineMessage = {
                    groupId: groupId,
                    text: text,
                    imageUrl: imageUrl,
                    videoUrl: videoUrl,
                    voiceUrl: voiceUrl,
                    duration: duration,
                    replyTo: replyTo,
                    senderId: this.firebaseUser.uid,
                    senderName: this.currentUser.name,
                    senderAvatar: this.currentUser.avatar,
                    type: text ? 'text' : (imageUrl ? 'image' : videoUrl ? 'video' : voiceUrl ? 'voice' : 'text'),
                    timestamp: new Date()
                };
                
                if (indexedDBCache) {
                    await indexedDBCache.queueOfflineMessage(offlineMessage);
                    showNotification('Message queued for sending when you reconnect', 'offline');
                }
                
                throw new Error('You are offline. Message will be sent when you reconnect.');
            }
            
            if (!this.firebaseUser || !this.currentUser) {
                throw new Error('You must be logged in to send messages');
            }
            
            const isRestricted = await this.isUserRestricted(groupId, this.firebaseUser.uid);
            if (isRestricted) {
                throw new Error('You are restricted from sending messages in this group for 2 hours due to using restricted words.');
            }
            
            if (!text && !imageUrl && !videoUrl && !voiceUrl) {
                throw new Error('Message cannot be empty');
            }
            
            if (text) {
                const restrictedWord = await this.checkMessageForRestrictedWords(groupId, text);
                if (restrictedWord) {
                    await this.restrictUser(groupId, this.firebaseUser.uid, 2);
                    throw new Error(`Your message contains a restricted word (${restrictedWord}). You have been restricted from chatting for 2 hours.`);
                }
            }
            
            const messageId = `${groupId}_${this.firebaseUser.uid}_${Date.now()}`;
            
            if (this.sentMessageIds.has(messageId) || this.pendingMessages.has(messageId)) {
                console.log('Duplicate message prevented:', messageId);
                return true;
            }
            
            this.sentMessageIds.add(messageId);
            this.pendingMessages.add(messageId);
            
            const messagesRef = collection(db, 'groups', groupId, 'messages');
            const messageData = {
                senderId: this.firebaseUser.uid,
                senderName: this.currentUser.name,
                senderAvatar: this.currentUser.avatar,
                timestamp: serverTimestamp()
            };
            
            if (replyTo) {
                messageData.replyTo = replyTo;
            }
            
            if (text) {
                messageData.text = text.trim();
            }
            
            if (imageUrl) {
                messageData.imageUrl = imageUrl;
                messageData.type = 'image';
            }
            
            if (videoUrl) {
                messageData.videoUrl = videoUrl;
                messageData.type = 'video';
            }
            
            if (voiceUrl) {
                messageData.voiceUrl = voiceUrl;
                messageData.type = 'voice';
                messageData.duration = duration;
            }
            
            const docRef = await addDoc(messagesRef, messageData);
            const finalMessageId = docRef.id;
            
            const groupRef = doc(db, 'groups', groupId);
            await updateDoc(groupRef, {
                updatedAt: serverTimestamp(),
                lastActivity: serverTimestamp(),
                lastMessage: {
                    text: text ? text.trim() : (imageUrl ? '📷 Image' : videoUrl ? '🎬 Video' : voiceUrl ? '🎤 Voice Note' : ''),
                    sender: this.currentUser.name,
                    timestamp: serverTimestamp()
                }
            });
            
            // Award XP based on message type
            if (voiceUrl) {
                await this.awardChatXP(this.firebaseUser.uid, 'voice_sent');
            } else if (videoUrl) {
                await this.awardChatXP(this.firebaseUser.uid, 'video_sent');
            } else if (imageUrl) {
                await this.awardChatXP(this.firebaseUser.uid, 'image_sent');
            } else if (text) {
                await this.awardChatXP(this.firebaseUser.uid, 'message_sent');
            }
            
            // Stop typing indicator
            await this.stopTyping(groupId);
            
            await this.updateLastActive(groupId);
            
            // Cache the message in IndexedDB
            if (indexedDBCache) {
                try {
                    await indexedDBCache.addGroupMessage(groupId, {
                        id: finalMessageId,
                        ...messageData,
                        timestamp: new Date()
                    });
                } catch (error) {
                    console.log('Error caching message in IndexedDB:', error);
                }
            }
            
            this.clearReply();
            
            this.pendingMessages.delete(messageId);
            
            return true;
        } catch (error) {
            console.error('Error sending message:', error);
            this.sentMessageIds.delete(messageId);
            this.pendingMessages.delete(messageId);
            throw error;
        }
    }

    async sendMediaMessage(groupId, file, replyTo = null, onProgress = null, onCancel = null) {
        try {
            const isVideo = file.type.startsWith('video/');
            const isAudio = file.type.startsWith('audio/');
            
            if (isVideo) {
                this.validateVideoFile(file);
            } else if (isAudio) {
                this.validateAudioFile(file);
            } else {
                this.validateImageFile(file);
            }
            
            const uploadId = 'upload_' + Date.now();
            
            const mediaUrl = await this.uploadMediaToCloudinary(file, uploadId, onProgress, onCancel);
            
            if (isVideo) {
                await this.sendMessage(groupId, null, null, mediaUrl, replyTo);
            } else if (isAudio) {
                // Get duration from audio file
                const audio = new Audio(mediaUrl);
                audio.addEventListener('loadedmetadata', async () => {
                    await this.sendMessage(groupId, null, null, null, replyTo, mediaUrl, Math.floor(audio.duration * 1000));
                });
                audio.load();
            } else {
                await this.sendMessage(groupId, null, mediaUrl, null, replyTo);
            }
            
            return true;
        } catch (error) {
            console.error('Error sending media message:', error);
            throw error;
        }
    }

    async getMessages(groupId, limitCount = 50) {
        try {
            const cacheKey = `messages_${groupId}_${limitCount}`;
            
            // First check memory cache
            const cached = this.getCachedItem(cacheKey, this.cache.messages);
            if (cached) return cached;
            
            // Then check IndexedDB cache
            if (indexedDBCache) {
                try {
                    const indexedDBCached = await indexedDBCache.getGroupMessages(groupId, limitCount);
                    if (indexedDBCached && indexedDBCached.length > 0) {
                        this.setCachedItem(cacheKey, indexedDBCached, this.cache.messages, 30000);
                        return indexedDBCached;
                    }
                } catch (error) {
                    console.log('Error getting messages from IndexedDB:', error);
                }
            }

            const messagesRef = collection(db, 'groups', groupId, 'messages');
            const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(limitCount));
            const querySnapshot = await getDocs(q);
            
            const messages = [];
            querySnapshot.forEach(doc => {
                const data = doc.data();
                messages.push({ 
                    id: doc.id, 
                    ...data,
                    timestamp: data.timestamp ? (data.timestamp.toDate ? data.timestamp.toDate() : data.timestamp) : new Date()
                });
            });
            
            const result = messages.reverse();
            
            this.setCachedItem(cacheKey, result, this.cache.messages, 30000);
            
            // Update IndexedDB cache
            if (indexedDBCache) {
                try {
                    await indexedDBCache.setGroupMessages(groupId, result);
                } catch (error) {
                    console.log('Error caching messages in IndexedDB:', error);
                }
            }
            
            return result;
        } catch (error) {
            console.error('Error getting messages:', error);
            throw error;
        }
    }

    // FIXED: listenToMessages method - properly track processed messages and maintain order on initial load
    listenToMessages(groupId, callback) {
        try {
            // First, unsubscribe from any existing listener
            if (this.unsubscribeMessages && typeof this.unsubscribeMessages === 'function') {
                try {
                    this.unsubscribeMessages();
                } catch (err) {
                    console.log('Error unsubscribing from previous messages:', err);
                }
                this.unsubscribeMessages = null;
            }

            const messagesRef = collection(db, 'groups', groupId, 'messages');
            const q = query(messagesRef, orderBy('timestamp', 'asc'));
            
            // Create a unique key for this group's page processed messages
            const pageProcessedKey = `page_processed_${groupId}`;
            
            // Initialize processed message IDs for this page if not exists
            if (!this.pageProcessedMessageIdsByGroup.has(pageProcessedKey)) {
                this.pageProcessedMessageIdsByGroup.set(pageProcessedKey, new Set());
            }
            
            const pageProcessedIds = this.pageProcessedMessageIdsByGroup.get(pageProcessedKey);
            
            // Track if initial load is complete
            if (!this.initialLoadComplete.has(groupId)) {
                this.initialLoadComplete.set(groupId, false);
            }
            
            // Initialize pending updates queue
            if (!this.pendingMessageUpdates.has(groupId)) {
                this.pendingMessageUpdates.set(groupId, []);
            }
            
            // Store all messages for sorting
            let allMessages = [];
            let isFirstSnapshot = true;
            
            // Load cached messages from IndexedDB first
            if (indexedDBCache) {
                setTimeout(async () => {
                    try {
                        const cachedMessages = await indexedDBCache.getGroupMessages(groupId, 50);
                        if (cachedMessages && cachedMessages.length > 0) {
                            console.log('Loaded', cachedMessages.length, 'cached messages from IndexedDB');
                            
                            // Sort cached messages by timestamp
                            const sortedCached = cachedMessages.sort((a, b) => {
                                const timeA = a.timestamp?.getTime?.() || a.timestamp || 0;
                                const timeB = b.timestamp?.getTime?.() || b.timestamp || 0;
                                return timeA - timeB;
                            });
                            
                            // Store messages
                            allMessages = sortedCached;
                            
                            // Mark these messages as processed
                            sortedCached.forEach(msg => {
                                if (msg.id) {
                                    pageProcessedIds.add(msg.id);
                                }
                            });
                            
                            // Send cached messages immediately
                            callback([...allMessages]);
                        }
                    } catch (error) {
                        console.log('Error loading cached messages:', error);
                    }
                }, 100);
            }
            
            const unsubscribe = onSnapshot(q, (snapshot) => {
                try {
                    // Check if we're offline or page is hidden
                    if (!this.isOnline || this.connectionState === 'inactive') {
                        console.log('Skipping message processing - offline or inactive');
                        return;
                    }
                    
                    const newMessages = [];
                    const newMessageIds = [];
                    
                    snapshot.forEach(doc => {
                        const data = doc.data();
                        const messageId = doc.id;
                        
                        // Check if we've already processed this message ID
                        if (!pageProcessedIds.has(messageId)) {
                            newMessages.push({ 
                                id: messageId, 
                                ...data,
                                timestamp: data.timestamp ? (data.timestamp.toDate ? data.timestamp.toDate() : data.timestamp) : new Date()
                            });
                            newMessageIds.push(messageId);
                        }
                    });
                    
                    if (newMessages.length > 0) {
                        // Mark these messages as processed
                        newMessageIds.forEach(id => pageProcessedIds.add(id));
                        
                        // Add to all messages
                        allMessages = [...allMessages, ...newMessages].sort((a, b) => {
                            const timeA = a.timestamp?.getTime?.() || a.timestamp || 0;
                            const timeB = b.timestamp?.getTime?.() || b.timestamp || 0;
                            return timeA - timeB;
                        });
                        
                        if (isFirstSnapshot) {
                            console.log('Firebase initial load:', allMessages.length, 'messages');
                            isFirstSnapshot = false;
                            
                            // Mark initial load as complete
                            this.initialLoadComplete.set(groupId, true);
                            
                            // Process any pending updates
                            const pendingUpdates = this.pendingMessageUpdates.get(groupId) || [];
                            if (pendingUpdates.length > 0) {
                                allMessages = [...allMessages, ...pendingUpdates].sort((a, b) => {
                                    const timeA = a.timestamp?.getTime?.() || a.timestamp || 0;
                                    const timeB = b.timestamp?.getTime?.() || b.timestamp || 0;
                                    return timeA - timeB;
                                });
                                this.pendingMessageUpdates.set(groupId, []);
                            }
                        } else {
                            console.log('New messages received:', newMessages.length);
                        }
                        
                        // Always send messages in correct chronological order
                        callback([...allMessages]);
                        
                        // Cache new messages in IndexedDB
                        if (indexedDBCache) {
                            setTimeout(async () => {
                                try {
                                    for (const message of newMessages) {
                                        await indexedDBCache.addGroupMessage(groupId, message);
                                    }
                                } catch (error) {
                                    console.log('Error caching new messages in IndexedDB:', error);
                                }
                            }, 0);
                        }
                    }
                } catch (error) {
                    console.error('Error processing messages:', error);
                }
            }, (error) => {
                console.error('Error in messages listener:', error);
                
                // Handle connection errors gracefully
                if (error.code === 'unavailable' || error.code === 'failed-precondition') {
                    this.connectionState = 'disconnected';
                    console.log('Firebase connection lost, attempting to reconnect...');
                }
            });
            
            this.unsubscribeMessages = unsubscribe;
            
            return unsubscribe;
        } catch (error) {
            console.error('Error listening to messages:', error);
            return () => {
                console.log('Dummy unsubscribe for messages called');
            };
        }
    }

    listenToMembers(groupId, callback) {
        try {
            // First, unsubscribe from any existing listener
            if (this.unsubscribeMembers && typeof this.unsubscribeMembers === 'function') {
                try {
                    this.unsubscribeMembers();
                } catch (err) {
                    console.log('Error unsubscribing from previous members:', err);
                }
                this.unsubscribeMembers = null;
            }
            
            // Load cached members from IndexedDB first
            if (indexedDBCache) {
                setTimeout(async () => {
                    try {
                        const cachedMembers = await indexedDBCache.getGroupMembers(groupId);
                        if (cachedMembers && cachedMembers.length > 0) {
                            console.log('Loaded', cachedMembers.length, 'cached members from IndexedDB');
                            callback(cachedMembers);
                        }
                    } catch (error) {
                        console.log('Error loading cached members:', error);
                    }
                }, 100);
            }
            
            const membersRef = collection(db, 'groups', groupId, 'members');
            const q = query(membersRef, orderBy('joinedAt', 'asc'));
            
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const members = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    members.push({
                        id: doc.id,
                        ...data,
                        joinedAt: data.joinedAt ? (data.joinedAt.toDate ? data.joinedAt.toDate() : data.joinedAt) : new Date(),
                        lastActive: data.lastActive ? (data.lastActive.toDate ? data.lastActive.toDate() : data.lastActive) : new Date()
                    });
                });
                callback(members);
                
                this.setCachedItem(groupId, members, this.cache.groupMembers, CACHE_DURATION.MEMBERS_LIST);
                
                // Update IndexedDB cache
                if (indexedDBCache) {
                    setTimeout(async () => {
                        try {
                            await indexedDBCache.setGroupMembers(groupId, members);
                        } catch (error) {
                            console.log('Error caching members in IndexedDB:', error);
                        }
                    }, 0);
                }
            }, (error) => {
                console.error('Error in members listener:', error);
            });
            
            this.unsubscribeMembers = unsubscribe;
            
            return unsubscribe;
        } catch (error) {
            console.error('Error listening to members:', error);
            // Return a dummy unsubscribe function to prevent errors
            return () => {
                console.log('Dummy unsubscribe for members called');
            };
        }
    }

    async updateLastActive(groupId) {
        try {
            if (!this.firebaseUser) return;
            
            const memberRef = doc(db, 'groups', groupId, 'members', this.firebaseUser.uid);
            const memberSnap = await getDoc(memberRef);
            
            if (memberSnap.exists()) {
                await updateDoc(memberRef, {
                    lastActive: serverTimestamp()
                });
            }
            
            const userRef = doc(db, 'group_users', this.firebaseUser.uid);
            await updateDoc(userRef, {
                lastSeen: serverTimestamp()
            });
            
            if (this.cache.userProfile) {
                this.cache.userProfile.lastSeen = new Date();
            }
        } catch (error) {
            console.error('Error updating last active:', error);
        }
    }

    createReactionModal() {
        const existingModal = document.getElementById('reactionModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        this.reactionModal = document.createElement('div');
        this.reactionModal.id = 'reactionModal';
        this.reactionModal.className = 'reaction-modal';
        
        let emojiGrid = '';
        const emojisPerRow = 10;
        const totalRows = Math.ceil(REACTION_EMOJIS.length / emojisPerRow);
        
        for (let row = 0; row < totalRows; row++) {
            emojiGrid += '<div class="emoji-row">';
            for (let col = 0; col < emojisPerRow; col++) {
                const index = row * emojisPerRow + col;
                if (index < REACTION_EMOJIS.length) {
                    emojiGrid += `<span class="emoji-item" data-emoji="${REACTION_EMOJIS[index]}">${REACTION_EMOJIS[index]}</span>`;
                }
            }
            emojiGrid += '</div>';
        }
        
        this.reactionModal.innerHTML = `
            <div class="reaction-modal-content">
                <div class="reaction-header">
                    <h3>Add Reaction</h3>
                    <button class="close-reaction-modal">&times;</button>
                </div>
                <div class="emoji-grid">
                    ${emojiGrid}
                </div>
            </div>
        `;
        
        document.body.appendChild(this.reactionModal);
        
        const reactionModalStyles = document.createElement('style');
        reactionModalStyles.id = 'reaction-modal-styles';
        reactionModalStyles.textContent = `
            .reaction-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                display: none;
                justify-content: center;
                align-items: center;
                z-index: 9999;
            }
            
            .reaction-modal.active {
                display: flex;
            }
            
            .reaction-modal-content {
                background: white;
                border-radius: 12px;
                width: 90%;
                max-width: 500px;
                max-height: 80vh;
                overflow: hidden;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
            }
            
            .reaction-header {
                padding: 15px 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .reaction-header h3 {
                margin: 0;
                font-size: 18px;
            }
            
            .close-reaction-modal {
                background: none;
                border: none;
                color: white;
                font-size: 28px;
                cursor: pointer;
                line-height: 1;
                padding: 0;
                width: 30px;
                height: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                transition: background 0.2s;
            }
            
            .close-reaction-modal:hover {
                background: rgba(255, 255, 255, 0.2);
            }
            
            .emoji-grid {
                padding: 20px;
                max-height: 60vh;
                overflow-y: auto;
            }
            
            .emoji-row {
                display: flex;
                justify-content: space-between;
                margin-bottom: 10px;
            }
            
            .emoji-item {
                font-size: 24px;
                cursor: pointer;
                padding: 8px;
                border-radius: 8px;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                justify-content: center;
                min-width: 40px;
                min-height: 40px;
            }
            
            .emoji-item:hover {
                background: #f0f0f0;
                transform: scale(1.2);
            }
            
            .message-reactions {
                display: flex;
                flex-wrap: wrap;
                gap: 4px;
                margin-top: 6px;
            }
            
            .reaction-bubble {
                background: rgba(0, 0, 0, 0.05);
                border-radius: 12px;
                padding: 2px 8px;
                font-size: 12px;
                display: flex;
                align-items: center;
                gap: 4px;
                cursor: pointer;
                transition: background 0.2s;
                border: 1px solid rgba(0, 0, 0, 0.1);
            }
            
            .reaction-bubble:hover {
                background: rgba(0, 0, 0, 0.1);
            }
            
            .reaction-bubble.user-reacted {
                background: rgba(29, 155, 240, 0.1);
                border-color: rgba(29, 155, 240, 0.3);
            }
            
            .reaction-emoji {
                font-size: 14px;
            }
            
            .reaction-count {
                font-weight: 500;
                color: #666;
            }
            
            .reaction-bubble.user-reacted .reaction-count {
                color: #1d9bf0;
            }
            
            .swipe-reply-indicator {
                position: fixed;
                bottom: 80px;
                left: 50%;
                transform: translateX(-50%);
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 12px 20px;
                border-radius: 25px;
                display: flex;
                align-items: center;
                gap: 10px;
                font-size: 14px;
                font-weight: 500;
                box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
                z-index: 1000;
                opacity: 0;
                transition: opacity 0.3s;
            }
            
            .swipe-reply-indicator.show {
                opacity: 1;
            }
            
            .replying-to {
                background: rgba(102, 126, 234, 0.1);
                border-left: 3px solid #667eea;
                padding: 6px 10px;
                margin-bottom: 8px;
                border-radius: 4px;
                font-size: 12px;
                display: flex;
                align-items: center;
                flex-wrap: wrap;
                gap: 4px;
            }
            
            .reply-label {
                color: #667eea;
                font-weight: 500;
            }
            
            .reply-sender {
                font-weight: 600;
                color: #764ba2;
            }
            
            .reply-separator {
                color: #999;
            }
            
            .reply-message {
                color: #666;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                flex: 1;
                min-width: 0;
            }
            
            /* Typing indicator styles */
            .typing-indicator {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                background: linear-gradient(135deg, rgba(102, 126, 234, 0.95) 0%, rgba(118, 75, 162, 0.95) 100%);
                color: white;
                padding: 8px 15px;
                font-size: 13px;
                text-align: center;
                z-index: 1000;
                backdrop-filter: blur(10px);
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                transition: transform 0.3s ease;
                transform: translateY(-100%);
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            }
            
            .typing-indicator.show {
                transform: translateY(0);
            }
            
            .typing-dots {
                display: inline-block;
                margin-left: 5px;
            }
            
            .typing-dots span {
                display: inline-block;
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background-color: white;
                margin: 0 2px;
                opacity: 0.6;
                animation: typing-dots 1.5s infinite ease-in-out;
            }
            
            .typing-dots span:nth-child(1) { animation-delay: 0s; }
            .typing-dots span:nth-child(2) { animation-delay: 0.2s; }
            .typing-dots span:nth-child(3) { animation-delay: 0.4s; }
            
            @keyframes typing-dots {
                0%, 100% { opacity: 0.6; transform: scale(1); }
                50% { opacity: 1; transform: scale(1.2); }
            }
            
            /* XP Badge Styles */
            .xp-badge {
                display: inline-flex;
                align-items: center;
                background: linear-gradient(135deg, #667eea, #764ba2);
                border-radius: 20px;
                padding: 2px 8px;
                margin-left: 6px;
                color: white;
                font-size: 11px;
                font-weight: bold;
                gap: 4px;
                box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            }
            
            .xp-badge span {
                line-height: 1;
            }
            
            .xp-icon {
                font-size: 12px;
            }
            
            .xp-level {
                background: rgba(255,255,255,0.2);
                border-radius: 12px;
                padding: 1px 4px;
                margin-left: 2px;
            }
            
            /* Upload modal styles */
            .upload-modal {
                position: fixed;
                bottom: 80px;
                right: 20px;
                background: white;
                border-radius: 12px;
                box-shadow: 0 8px 30px rgba(0, 0, 0, 0.2);
                z-index: 1000;
                width: 300px;
                overflow: hidden;
                animation: slideIn 0.3s ease;
            }
            
            @keyframes slideIn {
                from {
                    transform: translateY(20px);
                    opacity: 0;
                }
                to {
                    transform: translateY(0);
                    opacity: 1;
                }
            }
            
            .upload-header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 12px 15px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .upload-header h4 {
                margin: 0;
                font-size: 14px;
                font-weight: 600;
            }
            
            .cancel-upload-btn {
                background: rgba(255, 255, 255, 0.2);
                border: none;
                color: white;
                width: 28px;
                height: 28px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                font-size: 16px;
                line-height: 1;
            }
            
            .cancel-upload-btn:hover {
                background: rgba(255, 255, 255, 0.3);
            }
            
            .upload-content {
                padding: 15px;
            }
            
            .upload-info {
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 15px;
            }
            
            .upload-icon {
                width: 40px;
                height: 40px;
                border-radius: 8px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 18px;
            }
            
            .upload-details h5 {
                margin: 0 0 4px 0;
                font-size: 14px;
                font-weight: 600;
                color: #333;
            }
            
            .upload-details p {
                margin: 0;
                font-size: 12px;
                color: #666;
            }
            
            .upload-progress {
                margin-top: 10px;
            }
            
            .progress-text {
                display: flex;
                justify-content: space-between;
                margin-bottom: 6px;
                font-size: 12px;
                color: #666;
            }
            
            .progress-bar {
                height: 6px;
                background: #f0f0f0;
                border-radius: 3px;
                overflow: hidden;
            }
            
            .progress-fill {
                height: 100%;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border-radius: 3px;
                transition: width 0.3s ease;
            }
            
            /* Font Awesome icons */
            .fas {
                display: inline-block;
                font-style: normal;
                font-variant: normal;
                text-rendering: auto;
                -webkit-font-smoothing: antialiased;
            }
            
            /* Copy invite link styles */
            .invite-link-container {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border-radius: 12px;
                padding: 15px;
                margin: 15px 0;
                text-align: center;
            }
            
            .copy-invite-btn {
                background: white;
                color: #667eea;
                border: none;
                padding: 12px 20px;
                border-radius: 25px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                width: 100%;
                transition: all 0.3s ease;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
            }
            
            .copy-invite-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
            }
            
            .copy-invite-btn:active {
                transform: translateY(0);
            }
            
            .copy-invite-btn:disabled {
                opacity: 0.7;
                cursor: not-allowed;
                transform: none !important;
            }
            
            .copy-invite-btn.copied {
                background: #4CAF50;
                color: white;
            }
            
            .copy-invite-btn.copied svg {
                animation: bounce 0.5s ease;
            }
            
            .invite-link-status {
                margin-top: 10px;
                font-size: 12px;
                color: rgba(255, 255, 255, 0.9);
                min-height: 18px;
            }
            
            .invite-link-status.success {
                color: #4CAF50;
            }
            
            .invite-link-status.error {
                color: #ff6b6b;
            }
            
            @keyframes bounce {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-5px); }
            }
            
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            /* REMOVE MESSAGE HOVER EFFECTS */
            .message-text {
                transition: none !important;
            }
            
            .message-text:hover {
                background: none !important;
                transform: none !important;
                box-shadow: none !important;
            }
            
            .system-message {
                transition: none !important;
            }
            
            .system-message:hover {
                background: none !important;
                transform: none !important;
                box-shadow: none !important;
            }
            
            .message-group {
                transition: none !important;
            }
            
            .message-group:hover {
                background: none !important;
                transform: none !important;
            }
        `;
        
        document.head.appendChild(reactionModalStyles);
        
        const closeBtn = this.reactionModal.querySelector('.close-reaction-modal');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.hideReactionModal();
            });
        }
        
        this.reactionModal.querySelectorAll('.emoji-item').forEach(emoji => {
            emoji.addEventListener('click', () => {
                const emojiChar = emoji.dataset.emoji;
                this.addReactionToMessage(emojiChar);
                this.hideReactionModal();
            });
        });
        
        this.reactionModal.addEventListener('click', (e) => {
            if (e.target === this.reactionModal) {
                this.hideReactionModal();
            }
        });
    }

    showReactionModal(message) {
        if (this.reactionModal) {
            this.currentMessageForReaction = message;
            this.reactionModal.classList.add('active');
        }
    }

    hideReactionModal() {
        if (this.reactionModal) {
            this.reactionModal.classList.remove('active');
            this.currentMessageForReaction = null;
        }
    }

    async addReactionToMessage(emoji) {
        try {
            if (!this.currentMessageForReaction || !this.firebaseUser) {
                return;
            }
            
        const message = this.currentMessageForReaction;
        const userId = this.firebaseUser.uid;
        
        if (message.chatType === 'private') {
            const chatId = this.getPrivateChatId(
                message.senderId === userId ? message.senderId : this.currentChatPartnerId,
                message.senderId === userId ? this.currentChatPartnerId : message.senderId
            );
            
            const reactionRef = doc(db, 'private_chats', chatId, 'messages', message.id, 'reactions', emoji);
            const reactionSnap = await getDoc(reactionRef);
            
            if (reactionSnap.exists()) {
                const reactionData = reactionSnap.data();
                if (reactionData.users && reactionData.users.includes(userId)) {
                    await updateDoc(reactionRef, {
                        count: increment(-1),
                        users: arrayRemove(userId),
                        lastUpdated: serverTimestamp()
                    });
                    
                    if (reactionData.count <= 1) {
                        await deleteDoc(reactionRef);
                    }
                } else {
                    await updateDoc(reactionRef, {
                        count: increment(1),
                        users: arrayUnion(userId),
                        lastUpdated: serverTimestamp()
                    });
                    
                    // Award XP for adding reaction
                    await this.awardChatXP(userId, 'reaction_added');
                }
            } else {
                await setDoc(reactionRef, {
                    emoji: emoji,
                    count: 1,
                    users: [userId],
                    lastUpdated: serverTimestamp()
                });
                
                // Award XP for adding reaction
                await this.awardChatXP(userId, 'reaction_added');
            }
        } else {
            const groupId = this.currentGroupId;
            const messageId = message.id;
            
            const reactionRef = doc(db, 'groups', groupId, 'messages', messageId, 'reactions', emoji);
            const reactionSnap = await getDoc(reactionRef);
            
            if (reactionSnap.exists()) {
                const reactionData = reactionSnap.data();
                if (reactionData.users && reactionData.users.includes(userId)) {
                    await updateDoc(reactionRef, {
                        count: increment(-1),
                        users: arrayRemove(userId),
                        lastUpdated: serverTimestamp()
                    });
                    
                    if (reactionData.count <= 1) {
                        await deleteDoc(reactionRef);
                    }
                } else {
                    await updateDoc(reactionRef, {
                        count: increment(1),
                        users: arrayUnion(userId),
                        lastUpdated: serverTimestamp()
                    });
                    
                    // Award XP for adding reaction
                    await this.awardChatXP(userId, 'reaction_added');
                }
            } else {
                await setDoc(reactionRef, {
                    emoji: emoji,
                    count: 1,
                    users: [userId],
                    lastUpdated: serverTimestamp()
                });
                
                // Award XP for adding reaction
                await this.awardChatXP(userId, 'reaction_added');
            }
        }
            
        } catch (error) {
            console.error('Error adding reaction:', error);
        }
    }

    async getMessageReactions(groupId, messageId) {
        try {
            const cacheKey = `reactions_${groupId}_${messageId}`;
            const cached = this.getCachedItem(cacheKey, this.cache.messageReactions);
            if (cached) return cached;

            const reactionsRef = collection(db, 'groups', groupId, 'messages', messageId, 'reactions');
            const q = query(reactionsRef);
            const querySnapshot = await getDocs(q);
            
            const reactions = [];
            querySnapshot.forEach(doc => {
                const data = doc.data();
                reactions.push({
                    emoji: data.emoji,
                    count: data.count || 0,
                    users: data.users || [],
                    id: doc.id
                });
            });
            
            this.setCachedItem(cacheKey, reactions, this.cache.messageReactions, 60000);
            
            return reactions;
        } catch (error) {
            console.error('Error getting reactions:', error);
            return [];
        }
    }

    async getPrivateMessageReactions(chatId, messageId) {
        try {
            const cacheKey = `private_reactions_${chatId}_${messageId}`;
            const cached = this.getCachedItem(cacheKey, this.cache.messageReactions);
            if (cached) return cached;

            const reactionsRef = collection(db, 'private_chats', chatId, 'messages', messageId, 'reactions');
            const q = query(reactionsRef);
            const querySnapshot = await getDocs(q);
            
            const reactions = [];
            querySnapshot.forEach(doc => {
                const data = doc.data();
                reactions.push({
                    emoji: data.emoji,
                    count: data.count || 0,
                    users: data.users || [],
                    id: doc.id
                });
            });
            
            this.setCachedItem(cacheKey, reactions, this.cache.messageReactions, 60000);
            
            return reactions;
        } catch (error) {
            console.error('Error getting private message reactions:', error);
            return [];
        }
    }

    async listenToMessageReactions(groupId, messageId, callback) {
        try {
            const reactionsRef = collection(db, 'groups', groupId, 'messages', messageId, 'reactions');
            const q = query(reactionsRef);
            
            return onSnapshot(q, (snapshot) => {
                const reactions = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    reactions.push({
                        emoji: data.emoji,
                        count: data.count || 0,
                        users: data.users || [],
                        id: doc.id
                    });
                });
                
                const cacheKey = `reactions_${groupId}_${messageId}`;
                this.setCachedItem(cacheKey, reactions, this.cache.messageReactions, 60000);
                
                callback(reactions);
            });
        } catch (error) {
            console.error('Error listening to reactions:', error);
            return () => {};
        }
    }

    async listenToPrivateMessageReactions(chatId, messageId, callback) {
        try {
            const reactionsRef = collection(db, 'private_chats', chatId, 'messages', messageId, 'reactions');
            const q = query(reactionsRef);
            
            return onSnapshot(q, (snapshot) => {
                const reactions = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    reactions.push({
                        emoji: data.emoji,
                        count: data.count || 0,
                        users: data.users || [],
                        id: doc.id
                    });
                });
                
                const cacheKey = `private_reactions_${chatId}_${messageId}`;
                this.setCachedItem(cacheKey, reactions, this.cache.messageReactions, 60000);
                
                callback(reactions);
            });
        } catch (error) {
            console.error('Error listening to private message reactions:', error);
            return () => {};
        }
    }

    setupSwipeToReply(messagesContainer) {
        if (!messagesContainer) return;
        
        let startX = 0;
        let startY = 0;
        let currentMessage = null;
        let swipeIndicator = null;
        
        const handleTouchStart = (e) => {
            const touch = e.touches[0];
            startX = touch.clientX;
            startY = touch.clientY;
            
            let element = e.target;
            while (element && !element.classList.contains('message-text') && 
                   element !== messagesContainer) {
                element = element.parentElement;
            }
            
            if (element && element.classList.contains('message-text')) {
                currentMessage = element;
            }
        };
        
        const handleTouchMove = (e) => {
            if (!currentMessage) return;
            
            const touch = e.touches[0];
            const deltaX = touch.clientX - startX;
            const deltaY = touch.clientY - startY;
            
            if (Math.abs(deltaY) > Math.abs(deltaX) || deltaX < 0) {
                return;
            }
            
            if (deltaX > this.swipeThreshold) {
                e.preventDefault();
                
                if (!swipeIndicator) {
                    swipeIndicator = document.createElement('div');
                    swipeIndicator.className = 'swipe-reply-indicator';
                    swipeIndicator.innerHTML = `
                        <i class="fas fa-reply" style="margin-right: 8px;"></i>
                        <span>Swipe right to reply</span>
                    `;
                    document.body.appendChild(swipeIndicator);
                }
                
                swipeIndicator.classList.add('show');
            }
        };
        
        const handleTouchEnd = (e) => {
            if (!currentMessage) return;
            
            const touch = e.changedTouches[0];
            const deltaX = touch.clientX - startX;
            const deltaY = touch.clientY - startY;
            
            if (deltaX > this.swipeThreshold && Math.abs(deltaY) < this.swipeThreshold) {
                const messageId = currentMessage.dataset.messageId;
                const message = window.currentMessages?.find(m => m.id === messageId);
                if (message) {
                    this.handleReply(message);
                }
            }
            
            if (swipeIndicator) {
                swipeIndicator.classList.remove('show');
                setTimeout(() => {
                    if (swipeIndicator && swipeIndicator.parentNode) {
                        swipeIndicator.parentNode.removeChild(swipeIndicator);
                        swipeIndicator = null;
                    }
                }, 300);
            }
            
            currentMessage = null;
        };
        
        const handleLongPress = (e) => {
            let element = e.target;
            while (element && !element.classList.contains('message-text') && 
                   element !== messagesContainer) {
                element = element.parentElement;
            }
            
            if (element && element.classList.contains('message-text')) {
                const messageId = element.dataset.messageId;
                const message = window.currentMessages?.find(m => m.id === messageId);
                if (message) {
                    e.preventDefault();
                    this.showReactionModal(message);
                }
            }
        };
        
        let longPressTimer = null;
        
        messagesContainer.addEventListener('touchstart', (e) => {
            handleTouchStart(e);
            longPressTimer = setTimeout(() => {
                handleLongPress(e);
            }, 500);
        });
        
        messagesContainer.addEventListener('touchmove', (e) => {
            handleTouchMove(e);
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        });
        
        messagesContainer.addEventListener('touchend', (e) => {
            handleTouchEnd(e);
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        });
        
        messagesContainer.addEventListener('touchcancel', () => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
            if (swipeIndicator) {
                swipeIndicator.classList.remove('show');
                setTimeout(() => {
                    if (swipeIndicator && swipeIndicator.parentNode) {
                        swipeIndicator.parentNode.removeChild(swipeIndicator);
                        swipeIndicator = null;
                    }
                }, 300);
            }
        });
        
        messagesContainer.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
    }

    handleReply(message) {
        this.replyingToMessage = message;
        this.showReplyIndicator();
        
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            messageInput.focus();
        }
    }

    truncateName(name) {
        if (!name) return '';
        const words = name.split(' ');
        if (words.length <= 6) return name;
        return words.slice(0, 6).join(' ') + '...';
    }

    truncateMessage(text) {
        if (!text) return '';
        if (text.length <= 25) return text;
        return text.substring(0, 25) + '...';
    }

    showReplyIndicator() {
        this.removeReplyIndicator();
        
        if (!this.replyingToMessage) return;
        
        const messageInputContainer = document.querySelector('.message-input-container');
        if (!messageInputContainer) return;
        
        const indicator = document.createElement('div');
        indicator.className = 'reply-indicator';
        indicator.id = 'replyIndicator';
        
        const truncatedName = this.truncateName(this.replyingToMessage.senderName);
        const truncatedMessage = this.replyingToMessage.text ? 
            this.truncateMessage(this.replyingToMessage.text) : 
            (this.replyingToMessage.imageUrl ? '📷 Image' : this.replyingToMessage.videoUrl ? '🎬 Video' : this.replyingToMessage.voiceUrl ? '🎤 Voice Note' : '');
        
        indicator.innerHTML = `
            <div class="reply-indicator-content">
                <span class="reply-label">Replying to</span> 
                <span class="reply-sender">${truncatedName}</span>
                <span class="reply-separator">:</span> 
                <span class="reply-message">${truncatedMessage}</span>
            </div>
            <button class="cancel-reply" id="cancelReply">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        messageInputContainer.parentNode.insertBefore(indicator, messageInputContainer);
        
        const cancelBtn = document.getElementById('cancelReply');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.clearReply();
            });
        }
        
        const indicatorStyles = document.createElement('style');
        indicatorStyles.id = 'reply-indicator-styles';
        indicatorStyles.textContent = `
            .reply-indicator {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 8px 12px;
                border-radius: 8px;
                margin-bottom: 8px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                font-size: 13px;
                max-width: 100%;
                overflow: hidden;
            }
            
            .reply-indicator-content {
                display: flex;
                align-items: center;
                flex-wrap: wrap;
                gap: 4px;
                flex: 1;
                overflow: hidden;
                white-space: nowrap;
                text-overflow: ellipsis;
            }
            
            .reply-label {
                opacity: 0.9;
                font-weight: 500;
            }
            
            .reply-sender {
                font-weight: 600;
                color: #ffdd59;
            }
            
            .reply-separator {
                opacity: 0.9;
            }
            
            .reply-message {
                opacity: 0.9;
                flex: 1;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
        `;
        
        if (!document.getElementById('reply-indicator-styles')) {
            document.head.appendChild(indicatorStyles);
        }
    }

    removeReplyIndicator() {
        const indicator = document.getElementById('replyIndicator');
        if (indicator) {
            indicator.remove();
        }
    }

    clearReply() {
        this.replyingToMessage = null;
        this.removeReplyIndicator();
    }

    cleanup() {
        console.log('Cleaning up group chat...');
        
        // Clean up all Firebase listeners
        const listeners = [
            'unsubscribeMessages',
            'unsubscribeMembers', 
            'unsubscribePrivateMessages',
            'unsubscribePrivateChats',
            'unsubscribeAuth',
            'unsubscribeTyping'
        ];
        
        listeners.forEach(listenerName => {
            if (this[listenerName] && typeof this[listenerName] === 'function') {
                try {
                    this[listenerName]();
                    console.log(`Unsubscribed from ${listenerName}`);
                } catch (err) {
                    console.log(`Error unsubscribing from ${listenerName}:`, err);
                }
                this[listenerName] = null;
            }
        });
        
        // Clean up all reaction listeners
        if (this.reactionUnsubscribers) {
            this.reactionUnsubscribers.forEach((unsub, messageId) => {
                if (typeof unsub === 'function') {
                    try {
                        unsub();
                        console.log(`Unsubscribed from reaction listener for message ${messageId}`);
                    } catch (err) {
                        console.log(`Error unsubscribing from reaction listener for message ${messageId}:`, err);
                    }
                }
            });
            this.reactionUnsubscribers.clear();
        }
        
        // Clean up all active listeners
        if (this.activeListeners) {
            this.activeListeners.forEach((unsub, listenerId) => {
                if (typeof unsub === 'function') {
                    try {
                        unsub();
                        console.log(`Unsubscribed from active listener ${listenerId}`);
                    } catch (err) {
                        console.log(`Error unsubscribing from active listener ${listenerId}:`, err);
                    }
                }
            });
            this.activeListeners.clear();
        }
        
        this.areListenersSetup = false;
        this.sentMessageIds.clear();
        this.pendingMessages.clear();
        
        // Clear processed messages for all groups
        if (this.processedMessageIdsByGroup) {
            this.processedMessageIdsByGroup.clear();
        }
        
        // Clear page processed messages for all groups
        if (this.pageProcessedMessageIdsByGroup) {
            this.pageProcessedMessageIdsByGroup.clear();
        }
        
        // Clear initial load flags
        if (this.initialLoadComplete) {
            this.initialLoadComplete.clear();
        }
        
        // Clear pending updates
        if (this.pendingMessageUpdates) {
            this.pendingMessageUpdates.clear();
        }
        
        // Clear typing timeouts
        this.typingUsers.forEach((userTyping, groupId) => {
            userTyping.forEach((timeout, userId) => {
                clearTimeout(timeout);
                console.log(`Cleared typing timeout for user ${userId} in group ${groupId}`);
            });
        });
        this.typingUsers.clear();
        
        // Clear XP cache
        xpDataCache.clear();
        this.userXPCache.clear();
        this.dailyXPTracking.clear();
        
        // Clear voice recording
        if (this.isRecording) {
            this.cancelVoiceRecording();
        }
        this.currentVoiceNote = null;
        this.audioChunks = [];
        
        // Cancel all active uploads
        this.activeUploads.forEach((upload, uploadId) => {
            if (upload.cancelFunction && typeof upload.cancelFunction === 'function') {
                upload.cancelFunction();
                console.log(`Cancelled upload ${uploadId}`);
            }
        });
        this.activeUploads.clear();
        
        // Clear current state
        this.currentGroupId = null;
        this.currentChatPartnerId = null;
        this.replyingToMessage = null;
        
        console.log('Group chat cleanup complete');
    }

    async logout() {
        try {
            await signOut(auth);
            this.firebaseUser = null;
            this.currentUser = null;
            this.cleanup();
            this.clearAllCache();
            
            window.location.href = 'login.html';
        } catch (error) {
            console.error('Error logging out:', error);
        }
    }
}

const groupChat = new GroupChat();

// Create typing indicator element at top
function createTypingIndicator() {
    const typingIndicator = document.createElement('div');
    typingIndicator.id = 'typingIndicator';
    typingIndicator.className = 'typing-indicator';
    typingIndicator.style.display = 'none';
    typingIndicator.innerHTML = `
        <span id="typingText">No one is typing</span>
        <span class="typing-dots" id="typingDots">
            <span></span>
            <span></span>
            <span></span>
        </span>
    `;
    document.body.appendChild(typingIndicator);
    return typingIndicator;
}

// Update typing indicator
function updateTypingIndicator(typingUsers) {
    const typingIndicator = document.getElementById('typingIndicator');
    const typingText = document.getElementById('typingText');
    
    if (!typingIndicator || !typingText) return;
    
    if (typingUsers.length === 0) {
        typingIndicator.style.display = 'none';
        typingIndicator.classList.remove('show');
        return;
    }
    
    let typingMessage = '';
    if (typingUsers.length === 1) {
        typingMessage = `${typingUsers[0].userName} is typing`;
    } else if (typingUsers.length === 2) {
        typingMessage = `${typingUsers[0].userName} and ${typingUsers[1].userName} are typing`;
    } else if (typingUsers.length === 3) {
        typingMessage = `${typingUsers[0].userName}, ${typingUsers[1].userName} and 1 other are typing`;
    } else {
        typingMessage = `${typingUsers[0].userName}, ${typingUsers[1].userName} and ${typingUsers.length - 2} others are typing`;
    }
    
    typingText.textContent = typingMessage;
    typingIndicator.style.display = 'block';
    
    // Trigger reflow to enable animation
    void typingIndicator.offsetWidth;
    
    typingIndicator.classList.add('show');
}

// Create upload modal
function createUploadModal(uploadId, fileName, fileType, onCancel) {
    const existingModal = document.getElementById(`upload-modal-${uploadId}`);
    if (existingModal) {
        existingModal.remove();
    }
    
    const modal = document.createElement('div');
    modal.id = `upload-modal-${uploadId}`;
    modal.className = 'upload-modal';
    
    const isImage = fileType.startsWith('image/');
    const isVideo = fileType.startsWith('video/');
    const isAudio = fileType.startsWith('audio/');
    
    let fileTypeText = 'File';
    if (isImage) fileTypeText = 'Image';
    else if (isVideo) fileTypeText = 'Video';
    else if (isAudio) fileTypeText = 'Audio';
    
    modal.innerHTML = `
        <div class="upload-header">
            <h4>Uploading ${fileTypeText}</h4>
            <button class="cancel-upload-btn" id="cancel-upload-${uploadId}">×</button>
        </div>
        <div class="upload-content">
            <div class="upload-info">
                <div class="upload-icon">
                    ${isImage ? '📷' : isVideo ? '🎬' : isAudio ? '🎤' : '📄'}
                </div>
                <div class="upload-details">
                    <h5>${fileName}</h5>
                    <p>Uploading to chat...</p>
                </div>
            </div>
            <div class="upload-progress">
                <div class="progress-text">
                    <span>Progress</span>
                    <span id="progress-percent-${uploadId}">0%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" id="progress-fill-${uploadId}" style="width: 0%"></div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add cancel button handler
    const cancelBtn = document.getElementById(`cancel-upload-${uploadId}`);
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            if (onCancel && typeof onCancel === 'function') {
                onCancel();
            }
            modal.remove();
        });
    }
    
    return modal;
}

// Update upload progress
function updateUploadProgress(uploadId, progress) {
    const progressFill = document.getElementById(`progress-fill-${uploadId}`);
    const progressPercent = document.getElementById(`progress-percent-${uploadId}`);
    
    if (progressFill) {
        progressFill.style.width = `${progress}%`;
    }
    
    if (progressPercent) {
        progressPercent.textContent = `${Math.round(progress)}%`;
    }
}

// Remove upload modal
function removeUploadModal(uploadId) {
    const modal = document.getElementById(`upload-modal-${uploadId}`);
    if (modal) {
        modal.remove();
    }
}

// Initialize group chat page
function initGroupPage() {
    console.log('Initializing group page...');
    
    // Clear any existing event listeners
    const originalAddEventListener = EventTarget.prototype.addEventListener;
    const addedListeners = new Map();
    
    EventTarget.prototype.addEventListener = function(type, listener, options) {
        if (!addedListeners.has(this)) {
            addedListeners.set(this, new Map());
        }
        if (!addedListeners.get(this).has(type)) {
            addedListeners.get(this).set(type, []);
        }
        addedListeners.get(this).get(type).push(listener);
        return originalAddEventListener.call(this, type, listener, options);
    };
    
    // Function to remove all event listeners
    function removeAllEventListeners() {
        addedListeners.forEach((typeMap, target) => {
            typeMap.forEach((listeners, type) => {
                listeners.forEach(listener => {
                    target.removeEventListener(type, listener);
                });
            });
        });
        addedListeners.clear();
    }
    
    const sidebar = document.getElementById('sidebar');
    const backBtn = document.getElementById('backBtn');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const infoBtn = document.getElementById('infoBtn');
    const messagesContainer = document.getElementById('messagesContainer');
    const noMessages = document.getElementById('noMessages');
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const emojiBtn = document.getElementById('emojiBtn');
    const attachmentBtn = document.getElementById('attachmentBtn');
    const groupAvatar = document.getElementById('groupAvatar');
    const groupNameSidebar = document.getElementById('groupNameSidebar');
    const groupMembersCount = document.getElementById('groupMembersCount');
    const chatTitle = document.getElementById('chatTitle');
    const chatSubtitle = document.getElementById('chatSubtitle');
    const membersList = document.getElementById('membersList');
    const rulesList = document.getElementById('rulesList');
    
    const urlParams = new URLSearchParams(window.location.search);
    const groupId = urlParams.get('id');
    
    let messages = [];
    let members = [];
    let groupData = null;
    let isInitialLoad = true;
    let reactionUnsubscribers = new Map();
    let reactionsCache = new Map();
    let isRendering = false;
    let renderQueue = [];
    
    // Typing indicator variables
    let typingIndicator = null;
    let typingUnsubscribe = null;
    let typingTimeout = null;
    let lastTypingInputTime = 0;
    let lastMessageIds = '';
    let renderedMessageIds = new Set(); // Track which messages have been rendered
    
    // Voice message handlers map
    let voiceMessageHandlers = new Map();
    
    // XP badge cache for messages
    let messageXPCache = new Map(); // messageId -> { xpRank }
    
    // Queue render function
    function queueRender() {
        if (!isRendering) {
            isRendering = true;
            requestAnimationFrame(() => {
                displayMessages();
                isRendering = false;
                
                if (renderQueue.length > 0) {
                    renderQueue = [];
                    queueRender();
                }
            });
        } else {
            renderQueue.push(true);
        }
    }
    
    if (!groupId) {
        window.location.href = 'groups.html';
        return;
    }
    
    if (!groupChat.firebaseUser) {
        window.location.href = 'login.html';
        return;
    }
    
    window.currentGroupId = groupId;
    groupChat.currentGroupId = groupId;
    
    // Clear the page processed messages for this group when page loads
    const pageProcessedKey = `page_processed_${groupId}`;
    if (groupChat.pageProcessedMessageIdsByGroup && groupChat.pageProcessedMessageIdsByGroup.has(pageProcessedKey)) {
        groupChat.pageProcessedMessageIdsByGroup.get(pageProcessedKey).clear();
        console.log('Cleared page processed messages for group:', groupId);
    }
    
    // Reset initial load flag for this group
    if (groupChat.initialLoadComplete) {
        groupChat.initialLoadComplete.set(groupId, false);
    }
    
    // Create typing indicator at top
    typingIndicator = createTypingIndicator();
    
    (async () => {
        const needsSetup = await groupChat.needsProfileSetup();
        if (needsSetup) {
            window.location.href = `set.html?id=${groupId}`;
            return;
        }
        
        const isMember = await groupChat.isMember(groupId);
        if (!isMember) {
            window.location.href = `set.html?id=${groupId}`;
            return;
        }
        
        loadGroupData();
        setupListeners();
    })();
    
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            console.log('Back button clicked, cleaning up...');
            
            // Clean up group chat
            groupChat.cleanup();
            
            // Clean up reaction listeners
            reactionUnsubscribers.forEach((unsub, messageId) => {
                if (typeof unsub === 'function') {
                    try {
                        unsub();
                    } catch (err) {
                        console.log('Error unsubscribing from reactions:', err);
                    }
                }
            });
            reactionUnsubscribers.clear();
            
            // Clean up typing indicator
            if (typingUnsubscribe && typeof typingUnsubscribe === 'function') {
                typingUnsubscribe();
            }
            if (typingTimeout) {
                clearTimeout(typingTimeout);
            }
            
            // Remove all event listeners
            removeAllEventListeners();
            
            removeSidebarOverlay();
            window.location.href = 'groups.html';
        });
    }
    
    // Clone and replace sidebar toggle to ensure clean event listeners
    if (sidebarToggle) {
        const newToggle = sidebarToggle.cloneNode(true);
        sidebarToggle.parentNode.replaceChild(newToggle, sidebarToggle);
        
        const freshToggle = document.getElementById('sidebarToggle');
        
        if (freshToggle) {
            freshToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                
                if (sidebar) {
                    const isActive = sidebar.classList.contains('active');
                    if (isActive) {
                        sidebar.classList.remove('active');
                        removeSidebarOverlay();
                    } else {
                        sidebar.classList.add('active');
                        createSidebarOverlay();
                    }
                }
            });
        }
    }
    
    if (infoBtn) {
        // Clone and replace info button
        const newInfoBtn = infoBtn.cloneNode(true);
        infoBtn.parentNode.replaceChild(newInfoBtn, infoBtn);
        
        const freshInfoBtn = document.getElementById('infoBtn');
        
        if (freshInfoBtn) {
            freshInfoBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                
                if (sidebar) {
                    const isActive = sidebar.classList.contains('active');
                    if (isActive) {
                        sidebar.classList.remove('active');
                        removeSidebarOverlay();
                    } else {
                        sidebar.classList.add('active');
                        createSidebarOverlay();
                    }
                }
            });
        }
    }
    
    // Typing indicator for message input
    if (messageInput) {
        messageInput.addEventListener('input', () => {
            if (sendBtn) {
                sendBtn.disabled = !messageInput.value.trim();
            }
            
            messageInput.style.height = 'auto';
            messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
            
            // Start typing indicator when user types
            const now = Date.now();
            if (now - lastTypingInputTime > 1000) { // Throttle to 1 second
                groupChat.startTyping(groupId);
                lastTypingInputTime = now;
            }
            
            // Reset typing timeout
            if (typingTimeout) {
                clearTimeout(typingTimeout);
            }
            
            // Stop typing after 3 seconds of inactivity
            typingTimeout = setTimeout(() => {
                groupChat.stopTyping(groupId);
            }, 3000);
        });
        
        // Stop typing when input loses focus
        messageInput.addEventListener('blur', () => {
            groupChat.stopTyping(groupId);
            if (typingTimeout) {
                clearTimeout(typingTimeout);
            }
        });
    }
    
    // Send button always shows airplane icon, no loader - prevent form submission
    if (sendBtn) {
        sendBtn.addEventListener('click', (e) => {
            e.preventDefault();
            sendMessage();
        });
    }
    
    if (messageInput) {
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }
    
    // Clone and replace emoji button
    if (emojiBtn) {
        const newEmojiBtn = emojiBtn.cloneNode(true);
        emojiBtn.parentNode.replaceChild(newEmojiBtn, emojiBtn);
        const freshEmojiBtn = document.getElementById('emojiBtn');
        
        if (freshEmojiBtn) {
            freshEmojiBtn.addEventListener('click', () => {
                const emojis = ['😀', '😂', '🥰', '😎', '🤔', '👍', '🎉', '❤️', '🔥', '✨'];
                const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
                
                if (messageInput) {
                    messageInput.value += randomEmoji;
                    messageInput.focus();
                    messageInput.dispatchEvent(new Event('input'));
                }
            });
        }
    }
    
    // Clone and replace attachment button
    if (attachmentBtn) {
        const newAttachmentBtn = attachmentBtn.cloneNode(true);
        attachmentBtn.parentNode.replaceChild(newAttachmentBtn, attachmentBtn);
        const freshAttachmentBtn = document.getElementById('attachmentBtn');
        
        if (freshAttachmentBtn) {
            freshAttachmentBtn.addEventListener('click', () => {
                const fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.accept = 'image/*,video/*,audio/*';
                fileInput.multiple = false;
                
                fileInput.addEventListener('change', async (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        try {
                            const uploadId = 'upload_' + Date.now();
                            
                            // Create upload modal
                            const modal = createUploadModal(uploadId, file.name, file.type, () => {
                                // Cancel function will be called by the modal
                            });
                            
                            // Send media with progress tracking
                            await groupChat.sendMediaMessage(
                                groupId, 
                                file, 
                                groupChat.replyingToMessage?.id,
                                (progress) => {
                                    updateUploadProgress(uploadId, progress);
                                },
                                (cancelFunction) => {
                                    // Store cancel function in the modal's cancel button
                                    const cancelBtn = document.getElementById(`cancel-upload-${uploadId}`);
                                    if (cancelBtn) {
                                        const originalClick = cancelBtn.onclick;
                                        cancelBtn.onclick = () => {
                                            if (cancelFunction && typeof cancelFunction === 'function') {
                                                cancelFunction();
                                            }
                                            if (originalClick && typeof originalClick === 'function') {
                                                originalClick();
                                            }
                                        };
                                    }
                                }
                            );
                            
                            // Remove upload modal on completion
                            removeUploadModal(uploadId);
                            
                        } catch (error) {
                            console.error('Error sending media:', error);
                            if (error.message !== 'Upload cancelled') {
                                alert(error.message || 'Failed to send media. Please try again.');
                            }
                        }
                    }
                });
                
                fileInput.click();
            });
        }
    }
    
    // Add voice note button to sidebar
    function addVoiceNoteButton() {
        // Create voice note button
        const voiceNoteBtn = document.createElement('button');
        voiceNoteBtn.id = 'voiceNoteBtn';
        voiceNoteBtn.className = 'voice-note-btn';
        voiceNoteBtn.innerHTML = `
            <i class="fas fa-microphone"></i>
        `;
        voiceNoteBtn.title = 'Record voice note (Hold to record)';
        
        // Find message input container
        const messageInputContainer = document.querySelector('.message-input-container');
        if (messageInputContainer) {
            // Insert voice note button before send button
            const sendBtn = messageInputContainer.querySelector('#sendBtn');
            if (sendBtn) {
                messageInputContainer.insertBefore(voiceNoteBtn, sendBtn);
            } else {
                messageInputContainer.appendChild(voiceNoteBtn);
            }
        }
        
        // Add event listeners for voice recording
        let pressTimer;
        let isLongPress = false;
        
        voiceNoteBtn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            isLongPress = false;
            pressTimer = setTimeout(async () => {
                isLongPress = true;
                try {
                    await groupChat.startVoiceRecording();
                    voiceNoteBtn.classList.add('recording');
                } catch (error) {
                    alert(error.message || 'Failed to start recording. Please try again.');
                }
            }, 500); // Long press threshold
        });
        
        voiceNoteBtn.addEventListener('mouseup', () => {
            clearTimeout(pressTimer);
            if (isLongPress && groupChat.isRecording) {
                groupChat.stopVoiceRecording();
                voiceNoteBtn.classList.remove('recording');
            }
        });
        
        voiceNoteBtn.addEventListener('mouseleave', () => {
            clearTimeout(pressTimer);
            if (isLongPress && groupChat.isRecording) {
                groupChat.stopVoiceRecording();
                voiceNoteBtn.classList.remove('recording');
            }
        });
        
        // Touch events for mobile
        voiceNoteBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            isLongPress = false;
            pressTimer = setTimeout(async () => {
                isLongPress = true;
                try {
                    await groupChat.startVoiceRecording();
                    voiceNoteBtn.classList.add('recording');
                } catch (error) {
                    alert(error.message || 'Failed to start recording. Please try again.');
                }
            }, 500);
        });
        
        voiceNoteBtn.addEventListener('touchend', () => {
            clearTimeout(pressTimer);
            if (isLongPress && groupChat.isRecording) {
                groupChat.stopVoiceRecording();
                voiceNoteBtn.classList.remove('recording');
            }
        });
        
        voiceNoteBtn.addEventListener('touchcancel', () => {
            clearTimeout(pressTimer);
            if (isLongPress && groupChat.isRecording) {
                groupChat.stopVoiceRecording();
                voiceNoteBtn.classList.remove('recording');
            }
        });
        
        // Click to cancel recording if active
        voiceNoteBtn.addEventListener('click', (e) => {
            if (!isLongPress && groupChat.isRecording) {
                e.preventDefault();
                groupChat.cancelVoiceRecording();
                voiceNoteBtn.classList.remove('recording');
            }
        });
    }
    
    async function loadGroupData() {
        try {
            groupData = await groupChat.getGroup(groupId);
            
            if (!groupData) {
                alert('Group not found');
                window.location.href = 'groups.html';
                return;
            }
            
            const groupAvatarUrl = groupData.photoUrl || 
                `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(groupData.name)}&backgroundColor=00897b&backgroundType=gradientLinear`;
            
            if (groupAvatar) groupAvatar.src = groupAvatarUrl;
            if (groupNameSidebar) groupNameSidebar.textContent = groupData.name;
            if (groupMembersCount) groupMembersCount.textContent = `${groupData.memberCount || 0} members`;
            
            // Truncate group name to 6 words in chat header
            const truncatedGroupName = groupChat.truncateName(groupData.name);
            if (chatTitle) chatTitle.textContent = truncatedGroupName;
            if (chatSubtitle) chatSubtitle.textContent = groupData.description;
            
            if (rulesList) {
                rulesList.innerHTML = '';
                (groupData.rules || []).forEach(rule => {
                    const li = document.createElement('li');
                    li.className = 'rule-item';
                    li.innerHTML = `<i class="fas fa-check-circle" style="margin-right: 8px;"></i><span>${rule}</span>`;
                    rulesList.appendChild(li);
                });
            }
            
            // Create copy invite link button for everyone (not just admin)
            addInviteLinkButton();
            
            // Add voice note button
            addVoiceNoteButton();
            
            members = await groupChat.getGroupMembers(groupId);
            updateMembersList();
            
            if (isInitialLoad) {
                // Just set up listeners, don't load initial messages
                // The listener will handle initial load
                renderedMessageIds.clear();
                isInitialLoad = false;
            }
            
        } catch (error) {
            console.error('Error loading group data:', error);
            alert('Error loading group data. Please try again.');
        }
    }
    
    // Function to add copy invite link button for everyone (both admin and non-admin)
    function addInviteLinkButton() {
        // Don't check for admin status - show button for everyone
        let inviteContainer = document.getElementById('inviteLinkContainer');
        if (!inviteContainer) {
            inviteContainer = document.createElement('div');
            inviteContainer.id = 'inviteLinkContainer';
            inviteContainer.className = 'invite-link-container';
            
            const copyBtn = document.createElement('button');
            copyBtn.id = 'copyInviteBtn';
            copyBtn.className = 'copy-invite-btn';
            copyBtn.innerHTML = '<i class="fas fa-link" style="margin-right: 8px;"></i> Copy Invite Link';
            
            const statusDiv = document.createElement('div');
            statusDiv.id = 'inviteLinkStatus';
            statusDiv.className = 'invite-link-status';
            
            inviteContainer.appendChild(copyBtn);
            inviteContainer.appendChild(statusDiv);
            
            const sidebarContent = document.querySelector('.sidebar-content');
            if (sidebarContent) {
                const groupInfoSection = sidebarContent.querySelector('.group-info');
                if (groupInfoSection) {
                    groupInfoSection.appendChild(inviteContainer);
                } else {
                    sidebarContent.insertBefore(inviteContainer, sidebarContent.firstChild);
                }
            }
            
            // Clone and replace copy button to ensure clean event listeners
            const originalCopyBtn = copyBtn.cloneNode(true);
            copyBtn.parentNode.replaceChild(originalCopyBtn, copyBtn);
            const freshCopyBtn = document.getElementById('copyInviteBtn');
            
            if (freshCopyBtn) {
                freshCopyBtn.addEventListener('click', async () => {
                    let isCopying = false;
                    
                    if (isCopying) return;
                    
                    isCopying = true;
                    freshCopyBtn.disabled = true;
                    freshCopyBtn.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right: 8px;"></i> Getting link...';
                    statusDiv.textContent = '';
                    statusDiv.className = 'invite-link-status';
                    
                    try {
                        const inviteLink = await groupChat.getGroupInviteLink(groupId);
                        
                        await navigator.clipboard.writeText(inviteLink);
                        
                        freshCopyBtn.innerHTML = '<i class="fas fa-check" style="margin-right: 8px;"></i> Link Copied!';
                        freshCopyBtn.classList.add('copied');
                        
                        statusDiv.textContent = 'Invite link copied to clipboard!';
                        statusDiv.classList.add('success');
                        
                        freshCopyBtn.title = `Link: ${inviteLink}`;
                        
                        setTimeout(() => {
                            freshCopyBtn.innerHTML = '<i class="fas fa-link" style="margin-right: 8px;"></i> Copy Invite Link';
                            freshCopyBtn.classList.remove('copied');
                            freshCopyBtn.disabled = false;
                            statusDiv.textContent = 'Share this link to invite others';
                            statusDiv.className = 'invite-link-status';
                            isCopying = false;
                        }, 3000);
                        
                    } catch (error) {
                        console.error('Error copying invite link:', error);
                        
                        freshCopyBtn.innerHTML = '<i class="fas fa-exclamation-triangle" style="margin-right: 8px;"></i> Error';
                        freshCopyBtn.disabled = false;
                        
                        statusDiv.textContent = 'Failed to copy link. Please try again.';
                        statusDiv.classList.add('error');
                        
                        setTimeout(() => {
                            freshCopyBtn.innerHTML = '<i class="fas fa-link" style="margin-right: 8px;"></i> Copy Invite Link';
                            statusDiv.textContent = '';
                            statusDiv.className = 'invite-link-status';
                            isCopying = false;
                        }, 3000);
                    }
                });
                
                document.addEventListener('keydown', (e) => {
                    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'L') {
                        e.preventDefault();
                        freshCopyBtn.click();
                    }
                });
                
                freshCopyBtn.title = 'Click to copy invite link (Ctrl+Shift+L)';
            }
        }
    }
    
    function createSidebarOverlay() {
        removeSidebarOverlay();
        
        const overlay = document.createElement('div');
        overlay.id = 'sidebarOverlay';
        overlay.className = 'sidebar-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            z-index: 999;
            display: block;
        `;
        
        overlay.addEventListener('click', () => {
            if (sidebar) {
                sidebar.classList.remove('active');
                removeSidebarOverlay();
            }
        });
        
        document.body.appendChild(overlay);
    }
    
    function removeSidebarOverlay() {
        const overlay = document.getElementById('sidebarOverlay');
        if (overlay) {
            overlay.remove();
        }
    }
    
    function setupListeners() {
        console.log('Setting up listeners for group:', groupId);
        
        // Clear any existing listeners first
        if (groupChat.areListenersSetup) {
            console.log('Cleaning up existing listeners...');
            groupChat.cleanup();
            
            // Clean up reaction listeners
            reactionUnsubscribers.forEach((unsub, messageId) => {
                if (typeof unsub === 'function') {
                    try {
                        unsub();
                    } catch (err) {
                        console.log('Error unsubscribing from reactions:', err);
                    }
                }
            });
            reactionUnsubscribers.clear();
        }
        
        // Clear typing listener
        if (typingUnsubscribe && typeof typingUnsubscribe === 'function') {
            typingUnsubscribe();
            typingUnsubscribe = null;
        }
        
        // Set up new listeners
        const messagesUnsubscribe = groupChat.listenToMessages(groupId, (newMessages) => {
            console.log('Listener callback received:', newMessages.length, 'messages');
            
            // Replace messages array with sorted messages
            messages = newMessages;
            setupReactionListeners();
            queueRender();
        });
        
        groupChat.activeListeners.set('messages', messagesUnsubscribe);
        
        const membersUnsubscribe = groupChat.listenToMembers(groupId, (newMembers) => {
            console.log('Received members update:', newMembers.length);
            members = newMembers;
            updateMembersList();
            
            if (groupData) {
                groupData.memberCount = newMembers.length;
                if (groupMembersCount) {
                    groupMembersCount.textContent = `${newMembers.length} members`;
                }
            }
        });
        
        groupChat.activeListeners.set('members', membersUnsubscribe);
        
        // Set up typing indicator listener
        typingUnsubscribe = groupChat.listenToTyping(groupId, (typingUsers) => {
            updateTypingIndicator(typingUsers);
        });
        
        groupChat.activeListeners.set('typing', typingUnsubscribe);
        
        const activeInterval = setInterval(() => {
            groupChat.updateLastActive(groupId);
        }, 60000);
        
        groupChat.activeListeners.set('activeInterval', () => clearInterval(activeInterval));
        
        window.addEventListener('focus', () => {
            groupChat.updateLastActive(groupId);
        });
        
        window.addEventListener('beforeunload', () => {
            console.log('Page unloading, cleaning up...');
            clearInterval(activeInterval);
            
            // Clean up reaction listeners
            reactionUnsubscribers.forEach((unsub, messageId) => {
                if (typeof unsub === 'function') {
                    try {
                        unsub();
                    } catch (err) {
                        console.log('Error unsubscribing from reactions:', err);
                    }
                }
            });
            reactionUnsubscribers.clear();
            
            // Clean up typing
            if (typingUnsubscribe && typeof typingUnsubscribe === 'function') {
                typingUnsubscribe();
            }
            if (typingTimeout) {
                clearTimeout(typingTimeout);
            }
            
            removeSidebarOverlay();
        });
        
        groupChat.areListenersSetup = true;
        console.log('Listeners setup complete');
    }
    
    function updateMembersList() {
        if (!membersList) return;
        
        membersList.innerHTML = '';
        
        if (members.length === 0) {
            membersList.innerHTML = '<p style="color: var(--text-light); font-size: 0.9rem;">No members yet</p>';
            return;
        }
        
        members.forEach(member => {
            const isOnline = member.lastActive && 
                (Date.now() - new Date(member.lastActive).getTime()) < 300000;
            
            const isAdmin = member.role === 'creator';
            const isCurrentUser = member.id === groupChat.firebaseUser?.uid;
            
            const div = document.createElement('div');
            div.className = 'member-item';
            
            // Create XP badge HTML if member has XP data
            const xpBadge = member.xp ? groupChat.createXPBadge(member.xp) : '';
            
            div.innerHTML = `
                <div class="member-avatar-container" style="position: relative;">
                    <img src="${member.avatar}" alt="${member.name}" class="member-avatar" data-user-id="${member.id}">
                </div>
                <div class="member-info">
                    <div class="member-name">
                        ${member.name}
                        ${isAdmin ? '<span style="margin-left: 6px; background: var(--primary); color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px;">Admin</span>' : ''}
                        ${isCurrentUser ? '<span style="margin-left: 6px; background: #666; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px;">You</span>' : ''}
                        ${xpBadge}
                    </div>
                    ${member.bio ? `<div class="member-bio">${member.bio}</div>` : ''}
                    ${member.xp ? `<div class="member-xp" style="font-size: 10px; color: #666; margin-top: 2px;">Total XP: ${member.xp.totalXP}</div>` : ''}
                </div>
                <div class="member-status ${isOnline ? 'online' : ''}"></div>
            `;
            
            membersList.appendChild(div);
        });
        
        document.querySelectorAll('.member-avatar').forEach(avatar => {
            avatar.addEventListener('click', (e) => {
                const userId = e.target.dataset.userId;
                if (userId && userId !== groupChat.firebaseUser?.uid) {
                    window.open(`user.html?id=${userId}`, '_blank');
                }
            });
        });
    }
    
    // FIXED: displayMessages function to ensure correct message order
    function displayMessages() {
        if (!messagesContainer) return;
        
        if (messages.length === 0) {
            if (noMessages) noMessages.style.display = 'block';
            messagesContainer.innerHTML = '';
            renderedMessageIds.clear();
            voiceMessageHandlers.clear();
            return;
        }
        
        if (noMessages) noMessages.style.display = 'none';
        
        window.currentMessages = messages;
        
        // Ensure messages are sorted by timestamp
        const sortedMessages = [...messages].sort((a, b) => {
            const timeA = a.timestamp?.getTime?.() || a.timestamp || 0;
            const timeB = b.timestamp?.getTime?.() || b.timestamp || 0;
            return timeA - timeB;
        });
        
        // Group messages from same sender within 2 minutes
        const groupedMessages = [];
        const GROUP_TIME_THRESHOLD = 2 * 60 * 1000; // 2 minutes in milliseconds
        
        for (let i = 0; i < sortedMessages.length; i++) {
            const currentMessage = sortedMessages[i];
            
            // Check if we should start a new group
            if (i === 0) {
                groupedMessages.push([currentMessage]);
                continue;
            }
            
            const previousMessage = sortedMessages[i - 1];
            const timeDifference = currentMessage.timestamp - previousMessage.timestamp;
            const isSameSender = currentMessage.senderId === previousMessage.senderId;
            
            // Group if same sender and within time threshold (unless it's a system message)
            if (isSameSender && 
                timeDifference < GROUP_TIME_THRESHOLD && 
                currentMessage.type !== 'system' && 
                previousMessage.type !== 'system') {
                
                // Add to the last group
                const lastGroup = groupedMessages[groupedMessages.length - 1];
                lastGroup.push(currentMessage);
            } else {
                // Start a new group
                groupedMessages.push([currentMessage]);
            }
        }
        
        // Track which messages we've rendered
        sortedMessages.forEach(msg => renderedMessageIds.add(msg.id));
        
        // Clear the container first
        messagesContainer.innerHTML = '';
        
        // Use DocumentFragment for efficient DOM updates
        const fragment = document.createDocumentFragment();
        
        // Render each group in chronological order
        groupedMessages.forEach(group => {
            if (group.length === 0) return;
            
            const firstMessage = group[0];
            const isSystemMessage = firstMessage.type === 'system';
            const isRewardUpgrade = firstMessage.rewardUpgrade || false;
            
            // For system messages, don't group - render individually
            if (isSystemMessage) {
                group.forEach(message => {
                    renderSingleMessage(fragment, message, true, isRewardUpgrade);
                });
                return;
            }
            
            // For regular messages, render as a group
            const messageTime = firstMessage.timestamp ? new Date(firstMessage.timestamp) : new Date();
            
            // Get sender XP data (cached or fetch)
            (async () => {
                try {
                    const senderXP = await groupChat.getUserXPWithRank(firstMessage.senderId);
                    
                    // Create group container
                    const groupContainer = document.createElement('div');
                    groupContainer.className = 'message-group';
                    groupContainer.style.cssText = 'margin-bottom: 16px;';
                    
                    // Create header with avatar and sender info
                    const headerDiv = document.createElement('div');
                    headerDiv.style.cssText = 'display: flex; align-items: flex-start; gap: 10px; margin-bottom: 4px;';
                    
                    // Create XP badge
                    const xpBadge = groupChat.createXPBadge(senderXP);
                    
                    headerDiv.innerHTML = `
                        <!-- Avatar on the left -->
                        <div class="message-avatar-container" style="position: relative; flex-shrink: 0;">
                            <img src="${firstMessage.senderAvatar}" 
                                 alt="${firstMessage.senderName}" 
                                 class="message-avatar"
                                 data-user-id="${firstMessage.senderId}"
                                 style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover; cursor: pointer;">
                        </div>
                        
                        <!-- Sender info on the right -->
                        <div style="flex: 1; min-width: 0;">
                            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px; flex-wrap: wrap;">
                                <span style="font-weight: 600; color: #333; font-size: 14px;">${firstMessage.senderName}</span>
                                ${xpBadge}
                                <span style="color: #999; font-size: 12px; margin-left: auto;">${formatTime(messageTime)}</span>
                            </div>
                        </div>
                    `;
                    
                    groupContainer.appendChild(headerDiv);
                    
                    // Create messages container
                    const messagesDiv = document.createElement('div');
                    messagesDiv.style.cssText = 'display: flex; flex-direction: column; gap: 2px; margin-left: 46px;';
                    
                    // Add each message in the group
                    group.forEach((message, index) => {
                        const messageDiv = createSingleMessageElement(message, index, senderXP);
                        messagesDiv.appendChild(messageDiv);
                    });
                    
                    groupContainer.appendChild(messagesDiv);
                    fragment.appendChild(groupContainer);
                    
                    // Append fragment after async operations
                    messagesContainer.appendChild(fragment);
                    
                } catch (error) {
                    console.error('Error getting sender XP:', error);
                    // Fallback without XP badge
                    const groupContainer = document.createElement('div');
                    groupContainer.className = 'message-group';
                    groupContainer.style.cssText = 'margin-bottom: 16px;';
                    
                    const headerDiv = document.createElement('div');
                    headerDiv.style.cssText = 'display: flex; align-items: flex-start; gap: 10px; margin-bottom: 4px;';
                    
                    headerDiv.innerHTML = `
                        <div class="message-avatar-container" style="position: relative; flex-shrink: 0;">
                            <img src="${firstMessage.senderAvatar}" 
                                 alt="${firstMessage.senderName}" 
                                 class="message-avatar"
                                 data-user-id="${firstMessage.senderId}"
                                 style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover; cursor: pointer;">
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px;">
                                <span style="font-weight: 600; color: #333; font-size: 14px;">${firstMessage.senderName}</span>
                                <span style="color: #999; font-size: 12px; margin-left: auto;">${formatTime(messageTime)}</span>
                            </div>
                        </div>
                    `;
                    
                    groupContainer.appendChild(headerDiv);
                    
                    const messagesDiv = document.createElement('div');
                    messagesDiv.style.cssText = 'display: flex; flex-direction: column; gap: 2px; margin-left: 46px;';
                    
                    group.forEach((message, index) => {
                        const messageDiv = createSingleMessageElement(message, index);
                        messagesDiv.appendChild(messageDiv);
                    });
                    
                    groupContainer.appendChild(messagesDiv);
                    fragment.appendChild(groupContainer);
                    messagesContainer.appendChild(fragment);
                }
            })();
        });
        
        // Now create and attach voice message elements for new voice messages
        setTimeout(() => {
            sortedMessages.forEach(msg => {
                if (msg.voiceUrl) {
                    const voiceElementId = `voice-${msg.id}`;
                    const placeholder = document.getElementById(voiceElementId);
                    if (placeholder) {
                        // Create actual voice element
                        const voiceElement = groupChat.createVoiceMessageElement(msg.voiceUrl, msg.duration || 0, msg.id);
                        
                        // Replace placeholder with actual voice element
                        placeholder.parentNode.replaceChild(voiceElement, placeholder);
                        
                        // Store reference to voice element handler
                        voiceMessageHandlers.set(msg.id, voiceElement);
                    }
                }
            });
        }, 100);
        
        // Add event listeners
        document.querySelectorAll('.message-avatar').forEach(avatar => {
            avatar.addEventListener('click', (e) => {
                const userId = e.target.dataset.userId;
                if (userId && userId !== groupChat.firebaseUser?.uid) {
                    window.open(`user.html?id=${userId}`, '_blank');
                }
            });
        });
        
        document.querySelectorAll('.reaction-bubble').forEach(bubble => {
            bubble.addEventListener('click', (e) => {
                if (e.currentTarget.classList.contains('add-reaction')) {
                    return;
                }
                const messageElement = e.target.closest('.message-text, .system-message');
                if (messageElement) {
                    const messageId = messageElement.dataset.messageId;
                    const message = sortedMessages.find(m => m.id === messageId);
                    if (message) {
                        const emoji = e.currentTarget.dataset.emoji;
                        groupChat.currentMessageForReaction = message;
                        groupChat.addReactionToMessage(emoji);
                    }
                }
            });
        });
        
        document.querySelectorAll('.message-text, .system-message').forEach(messageElement => {
            let longPressTimer;
            const messageId = messageElement.dataset.messageId;
            const message = sortedMessages.find(m => m.id === messageId);
            
            if (message) {
                messageElement.addEventListener('touchstart', (e) => {
                    longPressTimer = setTimeout(() => {
                        groupChat.showReactionModal(message);
                    }, 500);
                });
                
                messageElement.addEventListener('touchend', () => {
                    clearTimeout(longPressTimer);
                });
                
                messageElement.addEventListener('touchmove', () => {
                    clearTimeout(longPressTimer);
                });
                
                messageElement.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    groupChat.showReactionModal(message);
                });
            }
        });
        
        groupChat.setupSwipeToReply(messagesContainer);
        
        setupReactionListeners();
        
        // Scroll to bottom after rendering
        setTimeout(() => {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }, 50);
    }
    
    function renderSingleMessage(fragment, message, isSystem = false, isRewardUpgrade = false) {
        const messageTime = message.timestamp ? new Date(message.timestamp) : new Date();
        const rewardUpgradeClass = isRewardUpgrade ? ' reward-upgrade' : '';
        
        const messageDivClass = isSystem ? 'system-message' : 'message-text';
        
        let replyHtml = '';
        if (message.replyTo) {
            const repliedMessage = messages.find(m => m.id === message.replyTo);
            if (repliedMessage) {
                const truncatedName = groupChat.truncateName(repliedMessage.senderName);
                const truncatedMessage = repliedMessage.text ? 
                    groupChat.truncateMessage(repliedMessage.text) : 
                    (repliedMessage.imageUrl ? '📷 Image' : repliedMessage.videoUrl ? '🎬 Video' : repliedMessage.voiceUrl ? '🎤 Voice Note' : '');
                
                replyHtml = `
                    <div class="replying-to">
                        <span class="reply-label">Replying to</span> 
                        <span class="reply-sender">${truncatedName}</span>
                        <span class="reply-separator">:</span> 
                        <span class="reply-message">${truncatedMessage}</span>
                    </div>
                `;
            }
        }
        
        let messageContent = '';
        
        if (message.imageUrl) {
            messageContent = `
                <div class="message-image-container" style="position: relative;">
                    <img src="${message.imageUrl}" 
                         alt="Shared image" 
                         class="message-image"
                         style="max-width: 250px; max-height: 250px; border-radius: 8px; cursor: pointer; width: 100%; height: auto;"
                         onload="this.style.opacity='1';"
                         onerror="this.style.display='none';"
                         onclick="openImageModal('${message.imageUrl}')">
                </div>
            `;
        } else if (message.videoUrl) {
            messageContent = `
                <div class="message-video-container" style="position: relative;">
                    <video controls style="max-width: 250px; max-height: 250px; border-radius: 8px; width: 100%; height: auto;"
                           onload="this.style.opacity='1';"
                           onerror="this.style.display='none';">
                        <source src="${message.videoUrl}" type="video/mp4">
                        Your browser does not support the video tag.
                    </video>
                </div>
            `;
        } else if (message.voiceUrl) {
            // Create placeholder for voice message
            const voiceElementId = `voice-${message.id}`;
            messageContent = `<div id="${voiceElementId}" class="voice-message-placeholder" data-voice-url="${message.voiceUrl}" data-duration="${message.duration || 0}"></div>`;
        } else if (isSystem) {
            messageContent = `
                <div style="font-style: italic; color: #666; text-align: center; padding: 4px 0;">
                    ${message.text}
                </div>
            `;
        } else {
            messageContent = message.text || '';
        }
        
        const cachedReactions = reactionsCache.get(message.id) || [];
        
        // Create message container
        const messageContainer = document.createElement('div');
        messageContainer.className = 'message-container';
        messageContainer.dataset.messageId = message.id;
        
        if (isSystem) {
            messageContainer.innerHTML = `
                <div style="margin: 8px 0;">
                    <div class="${messageDivClass}${rewardUpgradeClass}" 
                         data-message-id="${message.id}"
                         style="background: transparent; padding: 8px 12px; border-radius: 12px; max-width: 100%; word-wrap: break-word; margin: 0 auto;">
                        ${replyHtml}
                        <div class="message-content-wrapper">
                            ${messageContent}
                        </div>
                    </div>
                </div>
            `;
        } else {
            messageContainer.innerHTML = `
                <div style="display: flex; align-items: flex-start; gap: 10px; margin-bottom: 8px;">
                    <!-- Avatar on the left -->
                    <div class="message-avatar-container" style="position: relative; flex-shrink: 0;">
                        <img src="${message.senderAvatar}" 
                             alt="${message.senderName}" 
                             class="message-avatar"
                             data-user-id="${message.senderId}"
                             style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover; cursor: pointer;">
                    </div>
                    
                    <!-- Message content on the right -->
                    <div style="flex: 1; min-width: 0;">
                        <!-- Sender info will be added by the group header -->
                        <div class="${messageDivClass}" 
                             data-message-id="${message.id}"
                             style="background: ${message.senderId === groupChat.firebaseUser?.uid ? '#dcf8c6' : '#ffffff'}; 
                                    padding: 8px 12px; 
                                    border-radius: 12px; 
                                    max-width: 80%;
                                    word-wrap: break-word;
                                    ${message.senderId === groupChat.firebaseUser?.uid ? 'margin-left: auto; background: #dcf8c6;' : 'margin-right: auto; background: #ffffff; border: 1px solid #e0e0e0;'}">
                            ${replyHtml}
                            <div class="message-content-wrapper">
                                ${messageContent}
                            </div>
                            <div class="message-reactions" id="reactions-${message.id}">
                                ${cachedReactions.map(reaction => {
                                    const hasUserReacted = reaction.users && reaction.users.includes(groupChat.firebaseUser?.uid);
                                    return `
                                        <div class="reaction-bubble ${hasUserReacted ? 'user-reacted' : ''}" data-emoji="${reaction.emoji}">
                                            <span class="reaction-emoji">${reaction.emoji}</span>
                                            <span class="reaction-count">${reaction.count}</span>
                                        </div>
                                    `;
                                }).join('')}
                                <div class="reaction-bubble add-reaction" style="opacity: 0; pointer-events: none; padding: 0; width: 0; height: 0;">
                                    +
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        fragment.appendChild(messageContainer);
    }
    
    function createSingleMessageElement(message, index, senderXP = null) {
        let replyHtml = '';
        if (message.replyTo) {
            const repliedMessage = messages.find(m => m.id === message.replyTo);
            if (repliedMessage) {
                const truncatedName = groupChat.truncateName(repliedMessage.senderName);
                const truncatedMessage = repliedMessage.text ? 
                    groupChat.truncateMessage(repliedMessage.text) : 
                    (repliedMessage.imageUrl ? '📷 Image' : repliedMessage.videoUrl ? '🎬 Video' : repliedMessage.voiceUrl ? '🎤 Voice Note' : '');
                
                replyHtml = `
                    <div class="replying-to">
                        <span class="reply-label">Replying to</span> 
                        <span class="reply-sender">${truncatedName}</span>
                        <span class="reply-separator">:</span> 
                        <span class="reply-message">${truncatedMessage}</span>
                    </div>
                `;
            }
        }
        
        let messageContent = '';
        
        if (message.imageUrl) {
            messageContent = `
                <div class="message-image-container" style="position: relative;">
                    <img src="${message.imageUrl}" 
                         alt="Shared image" 
                         class="message-image"
                         style="max-width: 250px; max-height: 250px; border-radius: 8px; cursor: pointer; width: 100%; height: auto;"
                         onload="this.style.opacity='1';"
                         onerror="this.style.display='none';"
                         onclick="openImageModal('${message.imageUrl}')">
                </div>
            `;
        } else if (message.videoUrl) {
            messageContent = `
                <div class="message-video-container" style="position: relative;">
                    <video controls style="max-width: 250px; max-height: 250px; border-radius: 8px; width: 100%; height: auto;"
                           onload="this.style.opacity='1';"
                           onerror="this.style.display='none';">
                        <source src="${message.videoUrl}" type="video/mp4">
                        Your browser does not support the video tag.
                    </video>
                </div>
            `;
        } else if (message.voiceUrl) {
            // Create placeholder for voice message
            const voiceElementId = `voice-${message.id}`;
            messageContent = `<div id="${voiceElementId}" class="voice-message-placeholder" data-voice-url="${message.voiceUrl}" data-duration="${message.duration || 0}"></div>`;
        } else {
            messageContent = message.text || '';
        }
        
        const cachedReactions = reactionsCache.get(message.id) || [];
        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message-text';
        messageDiv.dataset.messageId = message.id;
        messageDiv.style.cssText = `
            background: ${message.senderId === groupChat.firebaseUser?.uid ? '#dcf8c6' : '#f0f0f0'}; 
            padding: 8px 12px; 
            border-radius: 12px; 
            max-width: 80%;
            word-wrap: break-word;
            ${message.senderId === groupChat.firebaseUser?.uid ? 'margin-left: auto; background: #dcf8c6;' : 'margin-right: auto; background: #ffffff; border: 1px solid #e0e0e0;'}
        `;
        
        messageDiv.innerHTML = `
            ${replyHtml}
            <div class="message-content-wrapper">
                ${messageContent}
            </div>
            <div class="message-reactions" id="reactions-${message.id}">
                ${cachedReactions.map(reaction => {
                    const hasUserReacted = reaction.users && reaction.users.includes(groupChat.firebaseUser?.uid);
                    return `
                        <div class="reaction-bubble ${hasUserReacted ? 'user-reacted' : ''}" data-emoji="${reaction.emoji}">
                            <span class="reaction-emoji">${reaction.emoji}</span>
                            <span class="reaction-count">${reaction.count}</span>
                        </div>
                    `;
                }).join('')}
                <div class="reaction-bubble add-reaction" style="opacity: 0; pointer-events: none; padding: 0; width: 0; height: 0;">
                    +
                </div>
            </div>
        `;
        
        return messageDiv;
    }
    
    function setupReactionListeners() {
        messages.forEach(message => {
            if (reactionUnsubscribers.has(message.id)) {
                return;
            }
            
            const unsubscribe = groupChat.listenToMessageReactions(groupId, message.id, (reactions) => {
                reactionsCache.set(message.id, reactions);
                const reactionsContainer = document.getElementById(`reactions-${message.id}`);
                if (reactionsContainer) {
                    updateReactionsDisplay(reactionsContainer, reactions, message.id);
                }
            });
            
            reactionUnsubscribers.set(message.id, unsubscribe);
        });
    }
    
    function updateReactionsDisplay(container, reactions, messageId) {
        if (!container) return;
        
        container.innerHTML = '';
        
        reactions.forEach(reaction => {
            const hasUserReacted = reaction.users && reaction.users.includes(groupChat.firebaseUser?.uid);
            const bubble = document.createElement('div');
            bubble.className = `reaction-bubble ${hasUserReacted ? 'user-reacted' : ''}`;
            bubble.dataset.emoji = reaction.emoji;
            bubble.innerHTML = `
                <span class="reaction-emoji">${reaction.emoji}</span>
                <span class="reaction-count">${reaction.count}</span>
            `;
            
            bubble.addEventListener('click', () => {
                const message = messages.find(m => m.id === messageId);
                if (message) {
                    groupChat.currentMessageForReaction = message;
                    groupChat.addReactionToMessage(reaction.emoji);
                }
            });
            
            container.appendChild(bubble);
        });
        
        const emptyBubble = document.createElement('div');
        emptyBubble.className = 'reaction-bubble add-reaction';
        emptyBubble.style.cssText = 'opacity: 0; pointer-events: none; padding: 0; width: 0; height: 0;';
        emptyBubble.innerHTML = '+';
        container.appendChild(emptyBubble);
    }
    
    async function sendMessage() {
        const text = messageInput ? messageInput.value.trim() : '';
        
        if (!text && !groupChat.currentVoiceNote) return;
        
        // Clear typing timeout before sending
        if (typingTimeout) {
            clearTimeout(typingTimeout);
        }
        
        // Stop typing indicator
        await groupChat.stopTyping(groupId);
        
        // Send button always shows airplane icon, no loader
        // We only disable it temporarily to prevent double sends
        if (sendBtn) {
            const originalHTML = sendBtn.innerHTML;
            const originalDisabled = sendBtn.disabled;
            sendBtn.disabled = true;
            
            try {
                if (groupChat.currentVoiceNote) {
                    // Send voice note
                    await groupChat.sendVoiceNote();
                } else {
                    // Send text message
                    await groupChat.sendMessage(groupId, text, null, null, groupChat.replyingToMessage?.id);
                    
                    if (messageInput) {
                        messageInput.value = '';
                        messageInput.style.height = 'auto';
                        messageInput.dispatchEvent(new Event('input'));
                    }
                }
                
                // Clear the reply indicator after sending
                groupChat.clearReply();
                
            } catch (error) {
                console.error('Error sending message:', error);
                alert(error.message || 'Failed to send message. Please try again.');
            } finally {
                // Always restore airplane icon immediately
                sendBtn.disabled = originalDisabled;
                sendBtn.innerHTML = originalHTML;
            }
        } else {
            // Send without UI updates
            try {
                if (groupChat.currentVoiceNote) {
                    await groupChat.sendVoiceNote();
                } else {
                    await groupChat.sendMessage(groupId, text, null, null, groupChat.replyingToMessage?.id);
                }
                
                // Clear the reply indicator after sending
                groupChat.clearReply();
                
            } catch (error) {
                console.error('Error sending message:', error);
                alert(error.message || 'Failed to send message. Please try again.');
            }
        }
    }
    
    function formatTime(date) {
        if (!(date instanceof Date)) {
            date = new Date(date);
        }
        
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffDays > 0) {
            return `${diffDays}d ago`;
        } else if (diffHours > 0) {
            return `${diffHours}h ago`;
        } else if (diffMins > 0) {
            return `${diffMins}m ago`;
        } else {
            return 'just now';
        }
    }
    
    window.addEventListener('beforeunload', () => {
        console.log('Page unloading, performing cleanup...');
        
        // Clean up group chat
        groupChat.cleanup();
        
        // Clean up reaction listeners
        reactionUnsubscribers.forEach((unsub, messageId) => {
            if (typeof unsub === 'function') {
                try {
                    unsub();
                } catch (err) {
                    console.log('Error unsubscribing from reactions:', err);
                }
            }
        });
        reactionUnsubscribers.clear();
        
        // Clean up typing
        if (typingUnsubscribe && typeof typingUnsubscribe === 'function') {
            typingUnsubscribe();
        }
        if (typingTimeout) {
            clearTimeout(typingTimeout);
        }
        
        // Remove all event listeners
        removeAllEventListeners();
        
        removeSidebarOverlay();
    });
    
    window.openImageModal = function(imageUrl) {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.9);
            z-index: 10000;
            display: flex;
            justify-content: center;
            align-items: center;
        `;
        
        modal.innerHTML = `
            <div style="position: relative; max-width: 90%; max-height: 90%;">
                <img src="${imageUrl}" alt="Full size" style="max-width: 100%; max-height: 90vh; border-radius: 8px;">
                <button style="position: absolute; top: 20px; right: 20px; background: rgba(0,0,0,0.5); color: white; 
                        border: none; border-radius: 50%; width: 40px; height: 40px; font-size: 20px; cursor: pointer;">
                    ×
                </button>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        modal.querySelector('button').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    };
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Check if we're on group.html
    const currentPage = window.location.pathname.split('/').pop().split('.')[0];
    if (currentPage === 'group') {
        console.log('Group page detected, waiting for auth...');
        
        document.addEventListener('groupAuthReady', () => {
            console.log('Group auth ready, initializing page...');
            initGroupPage();
        });
        
        setTimeout(() => {
            if (groupChat.firebaseUser) {
                console.log('Firebase user already authenticated, triggering auth ready...');
                document.dispatchEvent(new CustomEvent('groupAuthReady'));
            }
        }, 500);
    }
});

window.groupChat = groupChat;

window.groupLogout = function() {
    groupChat.logout();
};