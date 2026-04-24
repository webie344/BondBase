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
    apiKey: "AIzaSyC9jF-ocy6HjsVzWVVlAyXW-4aIFgA79-A",
    authDomain: "crypto-6517d.firebaseapp.com",
    projectId: "crypto-6517d",
    storageBucket: "crypto-6517d.firebasestorage.app",
    messagingSenderId: "60263975159",
    appId: "1:60263975159:web:bd53dcaad86d6ed9592bf2"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const cloudinaryConfig = {
    cloudName: "ddtdqrh1b",
    uploadPreset: "profile-pictures",
    apiUrl: "https://api.cloudinary.com/v1_1"
};

const EMOJI_REACTIONS = ['👍', '❤️', '🔥', '😘', '👎', '🤘', '💯'];

// ─── FIX: renamed from 'DatingAppDB' → 'BondBaseDB' ───
class IndexedDBCache {
    constructor() {
        this.dbName = 'BondBaseDB';
        this.dbVersion = 8;
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
            if (storeName !== 'pendingMessages' && !data.id) {
                if (data.userId) data.id = data.userId;
                else if (data.uid) data.id = data.uid;
                else data.id = `${storeName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            }
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

    addListeners(configs) {
        const removers = [];
        configs.forEach(config => {
            const remover = this.addListener(config.element, config.event, config.handler, config.options);
            removers.push(remover);
        });
        return removers;
    }
}

const eventManager = new EventManager();

// ─── FIX: renamed cachePrefix from 'datingApp_' → 'bondbase_' ───
class LocalCache {
    constructor() {
        this.cachePrefix = 'bondbase_';
        this.cacheExpiry = {
            short: 1 * 60 * 1000,
            medium: 5 * 60 * 1000,
            long: 30 * 60 * 1000
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

    // ─── FIX: setProfiles now uses Promise.all instead of sequential awaits ───
    async setProfiles(profiles) {
        await this.init();
        await Promise.all(profiles.map(profile => {
            const profileWithId = {
                id: profile.id || profile.userId || `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                ...profile
            };
            return this.indexedDB.set('profiles', profileWithId);
        }));
    }

    async getProfiles() {
        await this.init();
        return await this.indexedDB.getAll('profiles');
    }

    // ─── FIX: setMessages now uses Promise.all instead of sequential awaits ───
    async setMessages(threadId, messages) {
        await this.init();
        await Promise.all(messages.map(message => {
            const messageWithId = {
                id: message.id || `message_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                threadId: threadId,
                storedAt: Date.now(),
                ...message
            };
            return this.indexedDB.set('messages', messageWithId);
        }));
    }

    async getMessages(threadId) {
        await this.init();
        return await this.indexedDB.getAll('messages', 'threadId', threadId);
    }

    // ─── FIX: setConversations now uses Promise.all instead of sequential awaits ───
    async setConversations(conversations) {
        await this.init();
        await Promise.all(conversations.map(conversation => {
            const conversationWithId = {
                id: conversation.id || `conversation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                ...conversation
            };
            return this.indexedDB.set('conversations', conversationWithId);
        }));
    }

    async getConversations() {
        await this.init();
        return await this.indexedDB.getAll('conversations');
    }

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

// ==================== SOUND MANAGER (Web Audio — no asset files needed) ====================
class SoundManager {
    constructor() {
        this.ctx = null;
        this.muted = (() => { try { return localStorage.getItem('bb_sounds_muted') === '1'; } catch (e) { return false; } })();
        this._lastPlayed = 0;
    }
    setMuted(m) {
        this.muted = !!m;
        try { localStorage.setItem('bb_sounds_muted', m ? '1' : '0'); } catch (e) {}
    }
    _ensureCtx() {
        if (this.muted) return null;
        try {
            if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
            return this.ctx;
        } catch (e) { return null; }
    }
    _tone({ freq = 600, duration = 0.12, type = 'sine', gain = 0.15, slideTo = null, attack = 0.005 } = {}) {
        const ctx = this._ensureCtx();
        if (!ctx) return;
        const now = ctx.currentTime;
        if (now - this._lastPlayed < 0.04) return; // throttle
        this._lastPlayed = now;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);
        if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(gain, now + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        osc.connect(g); g.connect(ctx.destination);
        osc.start(now); osc.stop(now + duration + 0.02);
    }
    sent()      { this._tone({ freq: 880, slideTo: 1320, duration: 0.10, gain: 0.10, type: 'sine' }); }
    delivered() { this._tone({ freq: 1400, duration: 0.06, gain: 0.06, type: 'triangle' }); }
    received()  { this._tone({ freq: 520, slideTo: 760, duration: 0.16, gain: 0.14, type: 'sine' });
                  setTimeout(() => this._tone({ freq: 760, duration: 0.10, gain: 0.10, type: 'sine' }), 90); }
    typing()    { this._tone({ freq: 320, duration: 0.04, gain: 0.04, type: 'sine' }); }
    record()    { this._tone({ freq: 660, duration: 0.08, gain: 0.10, type: 'square' }); }
    error()     { this._tone({ freq: 220, slideTo: 110, duration: 0.20, gain: 0.14, type: 'sawtooth' }); }
}
const soundManager = new SoundManager();
window.bondbaseSounds = soundManager;
// Unlock audio on first user interaction (browser autoplay policy)
['click', 'touchstart', 'keydown'].forEach(ev => {
    window.addEventListener(ev, () => soundManager._ensureCtx(), { once: true, passive: true });
});

// ==================== WHATSAPP-STYLE TYPING BUBBLE ====================
function injectBondbaseChatStyles() {
    if (document.getElementById('bb-chat-styles')) return;
    const style = document.createElement('style');
    style.id = 'bb-chat-styles';
    style.textContent = `
    .wa-typing-bubble {
        display: inline-flex; align-items: center; gap: 4px;
        background: #202c33;
        padding: 10px 14px;
        border-radius: 2px 12px 12px 12px;
        margin: 6px 0 6px 8px;
        max-width: 70px;
        box-shadow: 0 1px 1px rgba(0,0,0,.25);
        animation: bbBubbleIn .18s ease-out;
        position: relative;
    }
    .wa-typing-bubble::after {
        content: '';
        position: absolute; left: -7px; top: 0;
        width: 0; height: 0;
        border-style: solid;
        border-width: 0 8px 10px 0;
        border-color: transparent #202c33 transparent transparent;
    }
    .wa-typing-bubble .dot {
        width: 7px; height: 7px; border-radius: 50%;
        background: #8696a0;
        animation: bbDot 1.2s infinite ease-in-out;
    }
    .wa-typing-bubble .dot:nth-child(2) { animation-delay: .15s; }
    .wa-typing-bubble .dot:nth-child(3) { animation-delay: .3s; }
    @keyframes bbDot {
        0%, 60%, 100% { transform: translateY(0); opacity: .4; }
        30% { transform: translateY(-4px); opacity: 1; }
    }
    @keyframes bbBubbleIn {
        from { opacity: 0; transform: translateY(4px); }
        to   { opacity: 1; transform: translateY(0); }
    }
    .wa-typing-row { display: flex; justify-content: flex-start; padding: 0 8px; }
    `;
    document.head.appendChild(style);
}
function showTypingBubble() {
    injectBondbaseChatStyles();
    const container = document.getElementById('chatMessages');
    if (!container) return;
    if (container.querySelector('.wa-typing-row')) return; // already showing
    const row = document.createElement('div');
    row.className = 'wa-typing-row';
    row.id = 'waTypingRow';
    row.innerHTML = `<div class="wa-typing-bubble"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>`;
    container.appendChild(row);
    container.scrollTop = container.scrollHeight;
    try { soundManager.typing(); } catch (e) {}
}
function hideTypingBubble() {
    const row = document.getElementById('waTypingRow');
    if (row && row.parentNode) row.parentNode.removeChild(row);
}

// ==================== MESSAGE ACTION MODAL (long-press only) ====================
function injectMessageActionStyles() {
    if (document.getElementById('bb-action-styles')) return;
    const s = document.createElement('style');
    s.id = 'bb-action-styles';
    s.textContent = `
    .bb-action-overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,.55);
        z-index: 99998; display: flex; align-items: center; justify-content: center;
        animation: bbFadeIn .15s ease-out;
    }
    @keyframes bbFadeIn { from{opacity:0} to{opacity:1} }
    .bb-action-card {
        background: #1f2c33; color: #e9edef; border-radius: 14px;
        min-width: 270px; max-width: 90vw; box-shadow: 0 12px 40px rgba(0,0,0,.6);
        overflow: hidden; animation: bbPopIn .18s cubic-bezier(.2,.9,.4,1.4);
    }
    @keyframes bbPopIn { from{opacity:0;transform:scale(.85)} to{opacity:1;transform:scale(1)} }
    .bb-action-emojis {
        display: flex; gap: 4px; padding: 10px 12px; justify-content: space-around;
        background: #2a3942; border-bottom: 1px solid rgba(255,255,255,.06);
    }
    .bb-action-emojis span {
        font-size: 24px; cursor: pointer; padding: 6px 8px; border-radius: 50%;
        transition: transform .12s ease, background .12s;
    }
    .bb-action-emojis span:hover { background: rgba(255,255,255,.08); transform: scale(1.18); }
    .bb-action-list { display: flex; flex-direction: column; }
    .bb-action-item {
        display: flex; align-items: center; gap: 14px;
        padding: 13px 18px; cursor: pointer; font-size: 15px;
        color: #e9edef; transition: background .12s;
        border: none; background: transparent; text-align: left; width: 100%;
    }
    .bb-action-item i { width: 18px; font-size: 16px; color: #8696a0; }
    .bb-action-item:hover { background: rgba(255,255,255,.05); }
    .bb-action-item.danger { color: #ff6b6b; }
    .bb-action-item.danger i { color: #ff6b6b; }

    /* Highlight modal — single-message spotlight */
    .bb-highlight-overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,.85);
        z-index: 99999; display: flex; align-items: center; justify-content: center;
        padding: 20px; animation: bbFadeIn .2s ease-out;
    }
    .bb-highlight-card {
        background: #2a3942; color: #e9edef; border-radius: 16px;
        padding: 24px; max-width: 480px; width: 100%;
        box-shadow: 0 20px 60px rgba(0,0,0,.7);
        animation: bbPopIn .25s cubic-bezier(.2,.9,.4,1.4);
        position: relative;
    }
    .bb-highlight-sender { font-size: 13px; color: #8696a0; margin-bottom: 8px; font-weight: 600; }
    .bb-highlight-body  { font-size: 18px; line-height: 1.5; word-wrap: break-word; }
    .bb-highlight-body img, .bb-highlight-body video { max-width: 100%; border-radius: 10px; }
    .bb-highlight-time { margin-top: 14px; font-size: 11px; color: #667781; text-align: right; }
    .bb-highlight-close {
        position: absolute; top: 8px; right: 10px;
        background: transparent; border: none; color: #8696a0;
        font-size: 24px; cursor: pointer; padding: 4px 10px;
    }

    /* Floating voice mini-player */
    .bb-mini-voice {
        position: fixed; top: 12px; left: 50%; transform: translateX(-50%);
        background: #005c4b; color: white; border-radius: 30px;
        padding: 8px 14px; display: flex; align-items: center; gap: 10px;
        box-shadow: 0 8px 24px rgba(0,0,0,.35); z-index: 99990;
        max-width: 92vw; animation: bbPopIn .25s cubic-bezier(.2,.9,.4,1.4);
        font-size: 13px;
    }
    .bb-mini-voice .mvp-btn {
        background: rgba(255,255,255,.22); border: none; color: white;
        width: 32px; height: 32px; border-radius: 50%; cursor: pointer;
        display: flex; align-items: center; justify-content: center; font-size: 14px;
        flex-shrink: 0;
    }
    .bb-mini-voice .mvp-btn:hover { background: rgba(255,255,255,.32); }
    .bb-mini-voice .mvp-info { display: flex; flex-direction: column; min-width: 0; max-width: 200px; }
    .bb-mini-voice .mvp-name { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .bb-mini-voice .mvp-progress {
        height: 3px; background: rgba(255,255,255,.25); border-radius: 2px; margin-top: 4px;
        overflow: hidden;
    }
    .bb-mini-voice .mvp-fill { height: 100%; background: white; width: 0%; transition: width .1s linear; }
    `;
    document.head.appendChild(s);
}

function closeBbActionModal() {
    const o = document.getElementById('bbActionOverlay');
    if (o && o.parentNode) o.parentNode.removeChild(o);
}

function getMessageById(messageId) {
    try {
        const cached = cache.get(`messages_${currentUser?.uid}_${chatPartnerId}`) || [];
        return cached.find(m => m.id === messageId);
    } catch (e) { return null; }
}

function showMessageActionModal(messageId, isSelf) {
    injectMessageActionStyles();
    closeBbActionModal();
    const overlay = document.createElement('div');
    overlay.className = 'bb-action-overlay';
    overlay.id = 'bbActionOverlay';
    const message = getMessageById(messageId);
    const hasText = !!(message && message.text);
    overlay.innerHTML = `
        <div class="bb-action-card" onclick="event.stopPropagation()">
            <div class="bb-action-emojis">
                ${EMOJI_REACTIONS.map(em => `<span data-emoji="${em}">${em}</span>`).join('')}
            </div>
            <div class="bb-action-list">
                <button class="bb-action-item" data-act="reply"><i class="fas fa-reply"></i> Reply</button>
                ${hasText ? `<button class="bb-action-item" data-act="copy"><i class="fas fa-copy"></i> Copy</button>` : ''}
                <button class="bb-action-item" data-act="highlight"><i class="fas fa-star"></i> Highlight</button>
                ${isSelf ? `<button class="bb-action-item danger" data-act="delete"><i class="fas fa-trash"></i> Delete</button>` : ''}
            </div>
        </div>
    `;
    overlay.addEventListener('click', closeBbActionModal);
    overlay.querySelectorAll('.bb-action-emojis span').forEach(s => {
        s.addEventListener('click', () => {
            selectedMessageForReaction = messageId;
            addReactionToMessage(s.dataset.emoji);
            closeBbActionModal();
        });
    });
    overlay.querySelectorAll('.bb-action-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const act = btn.dataset.act;
            closeBbActionModal();
            if (act === 'reply' && message) showReplyPreview(message);
            else if (act === 'copy' && message?.text) copyMessageText(message.text);
            else if (act === 'highlight') showHighlightModal(messageId);
            else if (act === 'delete') deleteChatMessage(messageId);
        });
    });
    document.body.appendChild(overlay);
}

function copyMessageText(text) {
    try {
        if (navigator.clipboard) navigator.clipboard.writeText(text);
        else {
            const ta = document.createElement('textarea');
            ta.value = text; ta.style.position = 'fixed'; ta.style.left = '-9999px';
            document.body.appendChild(ta); ta.select(); document.execCommand('copy');
            document.body.removeChild(ta);
        }
        if (typeof showNotification === 'function') showNotification('Copied to clipboard', 'success');
    } catch (e) { console.error('copy failed', e); }
}

async function deleteChatMessage(messageId) {
    if (!currentUser || !chatPartnerId || !messageId) return;
    if (!confirm('Delete this message?')) return;
    const threadId = [currentUser.uid, chatPartnerId].sort().join('_');
    const ref = doc(db, 'conversations', threadId, 'messages', messageId);

    // ---- Strip from local caches FIRST so it cannot reappear on reload ----
    const stripCaches = async () => {
        try {
            const cacheKey = `messages_${currentUser.uid}_${chatPartnerId}`;
            const cached = cache.get(cacheKey) || [];
            const filtered = cached.filter(m => m.id !== messageId);
            cache.set(cacheKey, filtered, 'short');
            if (cache.setMessages) await cache.setMessages(threadId, filtered);
        } catch (e) { console.warn('cache strip failed', e); }
    };
    const removeFromDom = () => {
        const el = document.querySelector(`[data-message-id="${messageId}"]`);
        if (el && el.parentNode) el.parentNode.removeChild(el);
    };

    // ---- Soft-delete first (always allowed, persists across reloads) ----
    try {
        await updateDoc(ref, {
            deleted: true,
            text: '',
            imageUrl: '',
            audioUrl: '',
            videoUrl: '',
            deletedAt: serverTimestamp()
        });
    } catch (err) {
        console.warn('soft delete updateDoc failed, trying hard delete', err);
    }

    // ---- Then attempt hard delete (best effort) ----
    try {
        const { deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        await deleteDoc(ref);
    } catch (err) {
        console.warn('hard delete failed (soft delete still applied)', err);
    }

    await stripCaches();
    removeFromDom();
    if (typeof showNotification === 'function') showNotification('Message deleted', 'success');
}

function showHighlightModal(messageId) {
    injectMessageActionStyles();
    const message = getMessageById(messageId);
    if (!message) return;
    const overlay = document.createElement('div');
    overlay.className = 'bb-highlight-overlay';
    let body = '';
    if (message.text) body = (message.text + '').replace(/[<>]/g, c => ({'<':'&lt;','>':'&gt;'}[c]));
    else if (message.imageUrl) body = `<img src="${message.imageUrl}" alt="image">`;
    else if (message.videoUrl) body = `<video src="${message.videoUrl}" controls></video>`;
    else if (message.audioUrl) body = `<audio src="${message.audioUrl}" controls style="width:100%"></audio>`;
    const senderName = message.senderId === currentUser?.uid
        ? 'You'
        : (document.getElementById('chatPartnerName')?.textContent || 'Them');
    const time = message.timestamp ? new Date(message.timestamp).toLocaleString() : '';
    overlay.innerHTML = `
        <div class="bb-highlight-card" onclick="event.stopPropagation()">
            <button class="bb-highlight-close">&times;</button>
            <div class="bb-highlight-sender">${senderName}</div>
            <div class="bb-highlight-body">${body}</div>
            <div class="bb-highlight-time">${time}</div>
        </div>
    `;
    const close = () => { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); };
    overlay.addEventListener('click', close);
    overlay.querySelector('.bb-highlight-close').addEventListener('click', close);
    document.body.appendChild(overlay);
}

// Robust long-press (cancels on movement / scroll). Replaces basic picker.
function setupBondbaseLongPress() {
    const container = document.getElementById('chatMessages');
    if (!container || container._bbLpInstalled) return;
    container._bbLpInstalled = true;
    let timer = null, startX = 0, startY = 0, target = null;
    const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } target = null; };
    container.addEventListener('touchstart', (e) => {
        const el = e.target.closest('.message');
        if (!el) return;
        target = el;
        const t = e.touches[0]; startX = t.clientX; startY = t.clientY;
        timer = setTimeout(() => {
            if (!target) return;
            try { if (navigator.vibrate) navigator.vibrate(40); } catch (er) {}
            const id = target.dataset.messageId;
            const isSelf = target.classList.contains('sent');
            if (id) showMessageActionModal(id, isSelf);
            target = null;
        }, 500);
    }, { passive: true });
    container.addEventListener('touchmove', (e) => {
        if (!timer) return;
        const t = e.touches[0];
        if (Math.abs(t.clientX - startX) > 8 || Math.abs(t.clientY - startY) > 8) cancel();
    }, { passive: true });
    container.addEventListener('touchend', cancel);
    container.addEventListener('touchcancel', cancel);
    container.addEventListener('contextmenu', (e) => {
        const el = e.target.closest('.message');
        if (!el) return;
        e.preventDefault();
        const id = el.dataset.messageId;
        const isSelf = el.classList.contains('sent');
        if (id) showMessageActionModal(id, isSelf);
    });
}

// ==================== FLOATING VOICE MINI-PLAYER ====================
const bbVoiceState = { audio: null, url: null, partnerName: null, partnerId: null };
function bbCreateMiniPlayer() {
    if (document.getElementById('bbMiniVoice')) return document.getElementById('bbMiniVoice');
    injectMessageActionStyles();
    const bar = document.createElement('div');
    bar.className = 'bb-mini-voice';
    bar.id = 'bbMiniVoice';
    bar.innerHTML = `
        <button class="mvp-btn mvp-play"><i class="fas fa-pause"></i></button>
        <div class="mvp-info">
            <span class="mvp-name">Voice message</span>
            <div class="mvp-progress"><div class="mvp-fill"></div></div>
        </div>
        <button class="mvp-btn mvp-close" title="Stop"><i class="fas fa-times"></i></button>
    `;
    document.body.appendChild(bar);
    bar.querySelector('.mvp-play').addEventListener('click', () => {
        const a = bbVoiceState.audio; if (!a) return;
        if (a.paused) a.play(); else a.pause();
    });
    bar.querySelector('.mvp-close').addEventListener('click', () => {
        if (bbVoiceState.audio) { bbVoiceState.audio.pause(); bbVoiceState.audio.currentTime = 0; }
        bbHideMiniPlayer();
    });
    return bar;
}
function bbShowMiniPlayer() {
    const bar = bbCreateMiniPlayer();
    bar.style.display = 'flex';
    const a = bbVoiceState.audio; if (!a) return;
    bar.querySelector('.mvp-name').textContent = bbVoiceState.partnerName ? `${bbVoiceState.partnerName} • Voice message` : 'Voice message';
    const playBtn = bar.querySelector('.mvp-play i');
    playBtn.className = a.paused ? 'fas fa-play' : 'fas fa-pause';
    const fill = bar.querySelector('.mvp-fill');
    if (a._bbProgressTimer) clearInterval(a._bbProgressTimer);
    a._bbProgressTimer = setInterval(() => {
        if (!isFinite(a.duration) || a.duration <= 0) return;
        fill.style.width = ((a.currentTime / a.duration) * 100).toFixed(1) + '%';
        const i = bar.querySelector('.mvp-play i');
        if (i) i.className = a.paused ? 'fas fa-play' : 'fas fa-pause';
    }, 200);
    a.addEventListener('ended', bbHideMiniPlayer, { once: true });
}
function bbHideMiniPlayer() {
    const bar = document.getElementById('bbMiniVoice');
    if (bar) bar.style.display = 'none';
    if (bbVoiceState.audio && bbVoiceState.audio._bbProgressTimer) {
        clearInterval(bbVoiceState.audio._bbProgressTimer);
        bbVoiceState.audio._bbProgressTimer = null;
    }
}
function bbRegisterPlayingAudio(audio, url) {
    // Pause any other tracked audio
    if (bbVoiceState.audio && bbVoiceState.audio !== audio) {
        try { bbVoiceState.audio.pause(); } catch (e) {}
        if (bbVoiceState.audio._bbProgressTimer) clearInterval(bbVoiceState.audio._bbProgressTimer);
    }
    bbVoiceState.audio = audio;
    bbVoiceState.url = url;
    bbVoiceState.partnerId = chatPartnerId;
    bbVoiceState.partnerName = document.getElementById('chatPartnerName')?.textContent || null;
    audio.addEventListener('ended', () => {
        if (bbVoiceState.audio === audio) bbHideMiniPlayer();
    });
}

async function registerServiceWorker() {
    if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost')) {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('Service Worker registered successfully');
            if ('sync' in registration) {
                try {
                    await registration.sync.register('send-pending-messages');
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

function setupOfflineSupport() {
    window.addEventListener('online', async () => {
        await processPendingMessages();
    });
}

async function setupBackgroundSync() {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
        try {
            const registration = await navigator.serviceWorker.ready;
            await registration.sync.register('send-pending-messages');
        } catch (error) {
            console.log('Background sync registration failed:', error);
        }
    }
}

let selectedMessageForReaction = null;
let selectedMessageForReply = null;
let longPressTimer = null;
let isOnline = navigator.onLine;
let networkRetryAttempts = 0;
const MAX_RETRY_ATTEMPTS = 3;

let currentUser = null;
let profiles = [];
let currentProfileIndex = 0;
let chatPartnerId = null;
let unsubscribeMessages = null;
let unsubscribeChat = null;
let typingTimeout = null;
let userChatPoints = 0;
let globalMessageListener = null;

let mediaRecorder = null;
let audioChunks = [];
let recordingStartTime = null;
let recordingTimer = null;
let preloadedAudioStream = null;

let videoRecorder = null;
let videoChunks = [];
let videoRecordingStartTime = null;
let videoRecordingTimer = null;

let currentPage = window.location.pathname.split('/').pop().split('.')[0];
const navToggle = document.getElementById('mobile-menu');
const navMenu = document.querySelector('.nav-menu');
const messageCountElements = document.querySelectorAll('.message-count');

async function preloadPageData() {
    if (!currentUser) return;
    const page = window.location.pathname.split('/').pop().split('.')[0];
    switch(page) {
        case 'mingle':    await preloadMingleData(); break;
        case 'messages':  await preloadMessagesData(); break;
        case 'dashboard': await preloadDashboardData(); break;
    }
}

async function preloadMingleData() {
    const cachedProfiles = await cache.getProfiles();
    if (cachedProfiles && cachedProfiles.length > 0) {
        profiles = cachedProfiles;
        if (profiles.length > 0) displayProfilesGrid();
    }
}

async function preloadMessagesData() {
    const cachedConversations = await cache.getConversations();
    if (cachedConversations && cachedConversations.length > 0) {
        renderMessageThreads(cachedConversations);
    }
}

async function preloadDashboardData() {
    const cachedUserData = cache.get(`user_${currentUser.uid}`);
    if (cachedUserData) {
        userChatPoints = cachedUserData.chatPoints || 0;
        updateChatPointsDisplay();
    }
}

async function processPendingMessages() {
    if (!isOnline || !currentUser) return;
    try {
        const pendingMessages = await cache.getPendingMessages();
        for (const pendingMsg of pendingMessages) {
            if (pendingMsg.status === 'pending') {
                try {
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
                }
            }
        }
    } catch (error) {
        console.error('Error processing pending messages:', error);
    }
}

// ─── FIX: removed pointless try/catch that just rethrew ───
async function sendVoiceNoteFromPending(pendingMsg) {
    const audioUrl = await uploadAudioToCloudinary(pendingMsg.blob);
    await addMessage(null, null, audioUrl, pendingMsg.duration);
}

async function sendVideoMessageFromPending(pendingMsg) {
    const videoUrl = await uploadVideoToCloudinary(pendingMsg.blob);
    await addMessage(null, null, null, null, videoUrl, pendingMsg.duration);
}

class OptimisticUpdates {
    constructor() {
        this.pendingUpdates = new Map();
    }
    addUpdate(id, updateData, rollbackFn) {
        this.pendingUpdates.set(id, { data: updateData, rollback: rollbackFn, timestamp: Date.now() });
    }
    removeUpdate(id) { this.pendingUpdates.delete(id); }
    rollbackUpdate(id) {
        const update = this.pendingUpdates.get(id);
        if (update && update.rollback) {
            update.rollback();
            this.pendingUpdates.delete(id);
        }
    }
    cleanupOldUpdates(maxAge = 300000) {
        const now = Date.now();
        for (const [id, update] of this.pendingUpdates.entries()) {
            if (now - update.timestamp > maxAge) this.rollbackUpdate(id);
        }
    }
}

const optimisticUpdates = new OptimisticUpdates();

async function preloadMicrophonePermission() {
    try {
        if (navigator.permissions && navigator.permissions.query) {
            const permissionStatus = await navigator.permissions.query({ name: 'microphone' });
            if (permissionStatus.state === 'granted') {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    preloadedAudioStream = stream;
                } catch (error) {
                    console.log('Could not pre-load microphone:', error);
                }
            }
        }
    } catch (error) {
        console.log('Microphone pre-load not supported:', error);
    }
}

if (currentPage === 'chat') {
    setTimeout(preloadMicrophonePermission, 1000);
}

function validateVideoFile(file) {
    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) throw new Error('Video file must be less than 100MB');
    const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/mov', 'video/avi'];
    if (!allowedTypes.includes(file.type)) throw new Error('Please upload a valid video file (MP4, WebM, MOV, AVI)');
    return true;
}

function validateImageFile(file) {
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) throw new Error('Image file must be less than 10MB');
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) throw new Error('Please upload a valid image file (JPEG, PNG, GIF, WebP)');
    return true;
}

function showNotification(message, type = 'info', duration = 3000) {
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

    if (!document.getElementById('notification-styles')) {
        const styles = document.createElement('style');
        styles.id = 'notification-styles';
        styles.textContent = `
            .custom-notification {
                position: fixed;
                top: 20px;
                right: 20px;
                background: white;
                padding: 7px 12px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 10000;
                display: flex;
                align-items: center;
                max-width: 220px;
                animation: slideIn 0.3s ease;
                border-left: 4px solid;
            }
            .custom-notification.success { border-left-color: #28a745; }
            .custom-notification.error   { border-left-color: #dc3545; }
            .custom-notification.info    { border-left-color: #ff4b6e; }
            .custom-notification.warning { border-left-color: #ffc107; }
            .custom-notification.offline { border-left-color: #ffc107; background: #fff3cd; }
            .notification-content {
                display: flex;
                align-items: center;
                gap: 8px;
                color: black;
            }
            .notification-icon { font-size: 14px; }
            .notification-content span { font-size: 12px; }
            .success .notification-icon { color: #28a745; }
            .error   .notification-icon { color: #dc3545; }
            .info    .notification-icon { color: #ff4b6e; }
            .warning .notification-icon { color: #ffc107; }
            @keyframes slideIn  { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
            @keyframes slideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
        `;
        document.head.appendChild(styles);
    }

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) notification.parentNode.removeChild(notification);
        }, 300);
    }, duration);

    return notification;
}

function getNotificationIcon(type) {
    switch(type) {
        case 'success': return 'fas fa-check-circle';
        case 'error':   return 'fas fa-exclamation-circle';
        case 'warning': return 'fas fa-exclamation-triangle';
        case 'offline': return 'fas fa-wifi';
        default:        return 'fas fa-info-circle';
    }
}

function setupNetworkMonitoring() {
    window.addEventListener('online', handleNetworkOnline);
    window.addEventListener('offline', handleNetworkOffline);

    const offlineIndicator = document.createElement('div');
    offlineIndicator.id = 'offlineIndicator';
    offlineIndicator.className = 'offline-indicator';
    offlineIndicator.innerHTML = '<i class="fas fa-wifi"></i> You are currently offline. Some features may be limited.';
    // ─── FIX: was 'position: ;' (empty) and 'font-size: 5px' (invisible) ───
    offlineIndicator.style.cssText = `
        position: fixed;
        top: 0; left: 0; right: 0;
        background: #ff6b6b;
        color: white;
        text-align: center;
        padding: 10px;
        z-index: 10001;
        font-size: 14px;
        display: none;
    `;
    document.body.appendChild(offlineIndicator);

    if (!isOnline) handleNetworkOffline();
}

async function handleNetworkOnline() {
    isOnline = true;
    networkRetryAttempts = 0;
    const offlineIndicator = document.getElementById('offlineIndicator');
    if (offlineIndicator) offlineIndicator.style.display = 'none';
    showNotification('Connection restored', 'success', 2000);
    await processPendingMessages();
    await syncAllData();
    reloadCurrentPageData();
}

function handleNetworkOffline() {
    isOnline = false;
    const offlineIndicator = document.getElementById('offlineIndicator');
    if (offlineIndicator) offlineIndicator.style.display = 'block';
    showNotification('No internet connection - working offline', 'offline', 5000);
}

async function syncAllData() {
    if (!currentUser) return;
    try {
        await loadProfiles(true);
        if (currentPage === 'messages') await loadMessageThreads(true);
        await loadUserChatPoints();
    } catch (error) {
        console.error('Error syncing data:', error);
    }
}

function reloadCurrentPageData() {
    const page = window.location.pathname.split('/').pop().split('.')[0];
    switch(page) {
        case 'mingle':   loadProfiles(); break;
        case 'messages': loadMessageThreads(); break;
        case 'dashboard': loadUserChatPoints(); break;
    }
}

function showMicrophonePermissionPopup() {
    if (localStorage.getItem('microphonePermissionShown')) return;

    const popup = document.createElement('div');
    popup.className = 'microphone-permission-popup';
    popup.innerHTML = `
        <div class="permission-popup-content">
            <h3>Enable Microphone Access</h3>
            <p>Would you like to enable microphone access for voice messages?</p>
            <div class="permission-buttons">
                <button id="permissionDeny" class="permission-btn deny">Not Now</button>
                <button id="permissionAllow" class="permission-btn allow">Allow</button>
            </div>
        </div>
    `;

    const styles = document.createElement('style');
    styles.textContent = `
        .microphone-permission-popup {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background-color: rgba(0,0,0,0.7);
            display: flex; justify-content: center; align-items: center; z-index: 10000;
        }
        .permission-popup-content {
            background-color: #1c2028; padding: 24px; border-radius: 12px;
            max-width: 380px; width: 90%; text-align: center;
            border: 1px solid rgba(255,255,255,0.1);
        }
        .permission-popup-content h3 { margin-bottom: 10px; color: #f0f2f5; }
        .permission-popup-content p  { margin-bottom: 20px; color: #7a8090; }
        .permission-buttons { display: flex; justify-content: center; gap: 10px; }
        .permission-btn { padding: 10px 20px; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; }
        .permission-btn.deny  { background: #2a2f38; color: #c8cdd6; }
        .permission-btn.allow { background: #ff4b6e; color: white; }
    `;
    document.head.appendChild(styles);
    document.body.appendChild(popup);

    document.getElementById('permissionAllow').addEventListener('click', async () => {
        try {
            const hasPermission = await requestMicrophonePermission();
            if (hasPermission) {
                showNotification('Microphone access enabled!', 'success');
                preloadMicrophonePermission();
            } else {
                showNotification('Could not enable microphone. Enable it in browser settings.', 'warning');
            }
        } catch (error) {
            showNotification('Error enabling microphone access.', 'error');
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

async function requestMicrophonePermission() {
    try {
        if (navigator.permissions && navigator.permissions.query) {
            const currentPermission = await navigator.permissions.query({ name: 'microphone' });
            if (currentPermission.state === 'granted') return true;
        }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        return true;
    } catch (error) {
        return false;
    }
}

async function requestCameraPermission() {
    try {
        if (navigator.permissions && navigator.permissions.query) {
            const currentPermission = await navigator.permissions.query({ name: 'camera' });
            if (currentPermission.state === 'granted') return true;
        }
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop());
        return true;
    } catch (error) {
        return false;
    }
}

async function checkMicrophonePermission() {
    try {
        if (!navigator.permissions || !navigator.permissions.query) return 'unknown';
        const permissionStatus = await navigator.permissions.query({ name: 'microphone' });
        return permissionStatus.state;
    } catch (error) {
        return 'unknown';
    }
}

function logError(error, context = '') {
    console.error(`[${new Date().toISOString()}] Error${context ? ` in ${context}` : ''}:`, error);
}

async function handleUserVerification(user) {
    console.log('User authenticated:', user.email);
}

async function enhancedLogin(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return true;
    } catch (error) {
        console.error('Login error:', error);
        throw error;
    }
}

function cleanupAllListeners() {
    if (unsubscribeMessages) { unsubscribeMessages(); unsubscribeMessages = null; }
    cleanupChatPage();
    if (globalMessageListener) { globalMessageListener(); globalMessageListener = null; }
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

async function handleLogout() {
    try {
        if (currentUser && currentUser.uid) {
            await setDoc(doc(db, 'status', currentUser.uid), {
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
        setTimeout(() => { window.location.href = 'login.html'; }, 1000);
    } catch (error) {
        logError(error, 'logout');
        showNotification(error.message, 'error');
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await registerServiceWorker();
    setupOfflineSupport();

    const style = document.createElement('style');
    style.textContent = `
        .page-loader {
            display: flex; justify-content: center; align-items: center;
            height: 200px; flex-direction: column; gap: 20px;
        }
        .message-loader { display: flex; justify-content: center; padding: 40px 0; }
        .dot-pulse {
            position: relative; width: 10px; height: 10px; border-radius: 5px;
            background-color: var(--accent-color, #ff4b6e);
            animation: dot-pulse 1.5s infinite linear; animation-delay: 0.25s;
        }
        .dot-pulse::before, .dot-pulse::after {
            content: ''; display: inline-block; position: absolute; top: 0;
            width: 10px; height: 10px; border-radius: 5px;
            background-color: var(--accent-color, #ff4b6e);
        }
        .dot-pulse::before { left: -15px; animation: dot-pulse 1.5s infinite linear; animation-delay: 0s; }
        .dot-pulse::after  { left:  15px; animation: dot-pulse 1.5s infinite linear; animation-delay: 0.5s; }
        @keyframes dot-pulse { 0%,100% { transform: scale(0.8); opacity: 0.5; } 50% { transform: scale(1.2); opacity: 1; } }
        .loading-message { display: flex; justify-content: center; padding: 20px; color: var(--text-light); font-style: italic; }
        .instant-loading {
            display: none; position: fixed; inset: 0;
            background: rgba(0,0,0,0.7); z-index: 9999;
            justify-content: center; align-items: center; flex-direction: column;
        }
        .offline-indicator {
            position: fixed; top: 0; left: 0; right: 0;
            background: #ff6b6b; color: white; text-align: center;
            padding: 10px; z-index: 10001; font-size: 14px; display: none;
        }
        @keyframes slideDown { from { transform: translateY(-100%); } to { transform: translateY(0); } }
        .voice-note-indicator {
            display: none; align-items: center; justify-content: space-between;
            padding: 10px; background-color: var(--bg-light); border-radius: 20px; margin: 10px 0;
        }
        .voice-note-timer { font-size: 14px; color: var(--text-dark); font-weight: bold; }
        .voice-note-controls { display: flex; gap: 10px; }
        .voice-message {
            max-width: 280px; padding: 12px 15px; border-radius: 20px; margin: 5px 0;
            position: relative; display: flex; align-items: center; gap: 12px;
            background: var(--accent-color, #ff4b6e);
        }
        .voice-message.sent  { background: var(--accent-color, #ff4b6e); color: white; align-self: flex-end; }
        .voice-message.received { background: #3a3a3a; color: white; align-self: flex-start; }
        .voice-message-controls { display: flex; align-items: center; gap: 10px; width: 100%; }
        .voice-message-play-btn {
            background: rgba(255,255,255,0.2); border: none; border-radius: 50%; color: white;
            font-size: 14px; cursor: pointer; padding: 8px; width: 35px; height: 35px;
            display: flex; align-items: center; justify-content: center; transition: background-color 0.2s;
        }
        .voice-message-play-btn:hover { background: rgba(255,255,255,0.35); }
        .voice-message-duration { font-size: 12px; color: rgba(255,255,255,0.8); min-width: 40px; }
        .waveform { height: 25px; flex: 1; display: flex; align-items: center; justify-content: space-between; gap: 2px; }
        .waveform-bar { background-color: currentColor; width: 3px; border-radius: 3px; transition: height 0.2s ease; flex: 1; }
        .waveform-bar.active { animation: waveform-animation 1.2s infinite ease-in-out; }
        @keyframes waveform-animation { 0%,100% { height: 5px; } 50% { height: 15px; } }
        .message-image { max-width: 300px; max-height: 400px; border-radius: 12px; object-fit: cover; transition: opacity 0.3s ease; }
        .message-image.sending { opacity: 0.7; filter: grayscale(0.3); }
        .sending-indicator {
            position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
            background: rgba(0,0,0,0.7); color: white; padding: 8px 12px;
            border-radius: 20px; font-size: 12px; display: flex; align-items: center; gap: 6px; z-index: 2;
        }
        .sending-indicator i { animation: spin 1s linear infinite; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .voice-message.sending, .video-message.sending { opacity: 0.7; position: relative; }
        .sending-overlay {
            position: absolute; inset: 0; background: rgba(0,0,0,0.5);
            border-radius: inherit; display: flex; align-items: center; justify-content: center;
            color: white; font-size: 12px; gap: 5px;
        }
        .video-message { max-width: 100%; border-radius: 12px; overflow: hidden; position: relative; background: #000; margin: 5px 0; }
        .video-message video { width: 100%; height: auto; max-height: 400px; border-radius: 12px; object-fit: cover; }
        .reply-preview {
            display: flex; align-items: center; padding: 10px 12px;
            background: var(--bg-light); border-left: 4px solid var(--accent-color, #ff4b6e);
            margin-bottom: 10px; border-radius: 8px;
        }
        .reply-preview-content { flex: 1; margin-left: 10px; overflow: hidden; }
        .reply-preview-text { font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-light); }
        .reply-preview-name { font-size: 12px; font-weight: bold; color: var(--text-primary); margin-bottom: 2px; }
        .reply-preview-cancel { background: none; border: none; color: #888; cursor: pointer; font-size: 16px; padding: 5px; border-radius: 50%; }
        .reply-indicator { font-size: 12px; color: white; margin-bottom: 4px; display: flex; align-items: center; gap: 4px; font-weight: 500; }
        .reply-message-preview {
            background: rgba(255,255,255,0.1); border-left: 2px solid var(--accent-color, #ff4b6e);
            padding: 6px 10px; margin-bottom: 6px; border-radius: 6px; font-size: 12px;
            max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #ccc;
        }
        .video-preview { position: fixed; inset: 0; background: black; z-index: 10000; display: none; flex-direction: column; justify-content: center; align-items: center; }
        .video-preview video { width: 100%; height: 100%; object-fit: contain; }
        .video-preview-controls { position: absolute; bottom: 40px; left: 0; right: 0; display: flex; justify-content: center; gap: 20px; padding: 20px; }
        .video-preview-btn { background: rgba(255,255,255,0.2); color: white; border: none; border-radius: 50%; width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 20px; }
        .video-recording-indicator { display: none; align-items: center; justify-content: space-between; padding: 12px 15px; background: #2a2a2a; border-radius: 25px; margin: 10px 0; border: 1px solid #444; }
        .video-recording-timer { font-size: 14px; color: #ff4444; font-weight: bold; }
        .recording-dot { width: 12px; height: 12px; background-color: #ff4444; border-radius: 50%; animation: recording-pulse 1.5s infinite; }
        @keyframes recording-pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.3; transform: scale(0.8); } }
        .reaction { background: rgba(255,255,255,0.9); border-radius: 10px; padding: 2px 6px; font-size: 12px; display: flex; align-items: center; gap: 2px; }
        .reaction-count { font-size: 10px; color: #666; }
        .reaction-picker { position: fixed; background: white; border-radius: 25px; padding: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); display: none; gap: 8px; z-index: 1000; flex-wrap: wrap; max-width: 250px; }
        .reaction-emoji { font-size: 20px; cursor: pointer; padding: 5px; border-radius: 50%; transition: background-color 0.2s; }
        .reaction-emoji:hover { background-color: #f0f0f0; }
        .message { transition: transform 0.3s ease; will-change: transform; touch-action: pan-y; }
        .message.received { position: relative; overflow: visible; }
        .message-swipe-action { position: absolute; top: 50%; left: 15px; transform: translateY(-50%); background: var(--accent-color, #ff4b6e); color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.2s; pointer-events: none; }
        .message-context-menu { position: absolute; background: #1c2028; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 100; padding: 8px 0; display: none; }
        .context-menu-item { padding: 10px 16px; cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 14px; color: #f0f2f5; }
        .context-menu-item:hover { background: rgba(255,255,255,0.05); }
        .fast-loading-message { text-align: center; padding: 10px; font-size: 14px; color: var(--accent-color, #ff4b6e); background: var(--bg-light); border-radius: 8px; margin: 10px; animation: pulse 2s infinite; }
        .profile-grid-status { position: absolute; top: 10px; right: 10px; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; }
        .profile-grid-status.online  { background-color: #00FF00; }
        .profile-grid-status.offline { background-color: #9E9E9E; }
        .no-profiles-message { grid-column: 1/-1; text-align: center; padding: 40px; color: #666; font-size: 16px; }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.7; } }
        .prevent-copy { -webkit-user-select: none; -moz-user-select: none; user-select: none; -webkit-touch-callout: none; }

        /* ══════════════════════════════════════════════
           SPA MASTER-DETAIL LAYOUT (messages + chat)
           WhatsApp-style: list on left, chat on right
        ══════════════════════════════════════════════ */
        .spa-layout {
            display: flex;
            height: calc(100vh - 56px);
            overflow: hidden;
            position: relative;
        }

        /* Left panel — conversation list */
        #messagesPanel {
            width: 360px;
            min-width: 280px;
            flex-shrink: 0;
            display: flex;
            flex-direction: column;
            border-right: 1px solid var(--border-color, rgba(255,255,255,0.07));
            overflow: hidden;
            transition: transform 0.3s ease;
            background: var(--bg-secondary, #14171c);
        }

        #messagesPanel .panel-header {
            padding: 1rem 1.25rem 0.75rem;
            border-bottom: 1px solid var(--border-color, rgba(255,255,255,0.07));
            flex-shrink: 0;
        }

        #messagesPanel .panel-header h2 {
            font-size: 1.2rem;
            font-weight: 700;
            color: var(--text-primary, #f0f2f5);
            margin-bottom: 0.75rem;
        }

        #messageSearch {
            width: 100%;
            padding: 8px 14px;
            background: rgba(255,255,255,0.05);
            border: 1px solid var(--border-color, rgba(255,255,255,0.07));
            border-radius: 20px;
            color: var(--text-primary, #f0f2f5);
            font-size: 0.88rem;
            outline: none;
        }

        #messageSearch:focus { border-color: var(--primary, #ff4b6e); }
        #messageSearch::placeholder { color: var(--text-light, #7a8090); }

        #messagesList {
            flex: 1;
            overflow-y: auto;
            padding: 0.5rem 0;
        }

        /* Right panel — active chat */
        #chatPanel {
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            background: var(--bg-primary, #0e1014);
            position: relative;
        }

        /* Empty state when no chat is selected (desktop) */
        #chatPanel .chat-empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: var(--text-light, #7a8090);
            gap: 1rem;
            text-align: center;
            padding: 2rem;
        }

        #chatPanel .chat-empty-state i { font-size: 3rem; color: var(--primary, #ff4b6e); opacity: 0.4; }
        #chatPanel .chat-empty-state p { font-size: 1rem; }

        /* Hide empty state and show chat content when active */
        #chatPanel .chat-empty-state { display: flex; }
        #chatPanel .chat-content      { display: none; flex-direction: column; height: 100%; }
        #chatPanel.active .chat-empty-state { display: none; }
        #chatPanel.active .chat-content     { display: flex; }

        /* Message thread cards */
        .message-card {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 1.25rem;
            cursor: pointer;
            transition: background 0.15s;
            position: relative;
            border-bottom: 1px solid rgba(255,255,255,0.03);
        }

        .message-card:hover { background: rgba(255,255,255,0.04); }
        .message-card.active { background: rgba(255,75,110,0.08); border-left: 3px solid var(--primary, #ff4b6e); }

        .message-card img {
            width: 48px; height: 48px;
            border-radius: 50%; object-fit: cover;
            flex-shrink: 0;
            border: 2px solid rgba(255,255,255,0.08);
        }

        .message-content { flex: 1; min-width: 0; }
        .message-content h3 { font-size: 0.9rem; font-weight: 600; color: var(--text-primary, #f0f2f5); display: flex; justify-content: space-between; margin-bottom: 3px; }
        .message-content p { font-size: 0.8rem; color: var(--text-light, #7a8090); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .message-time { font-size: 0.72rem; color: var(--text-light, #7a8090); font-weight: 400; flex-shrink: 0; margin-left: 8px; }

        .unread-count {
            background: var(--primary, #ff4b6e);
            color: white; border-radius: 50%;
            min-width: 20px; height: 20px;
            font-size: 0.7rem; font-weight: 700;
            display: flex; align-items: center; justify-content: center;
            padding: 0 4px; flex-shrink: 0;
        }

        .online-status { font-size: 10px; }
        .online-status i { color: var(--text-light); }

        /* Chat header inside right panel */
        .chat-header {
            display: flex; align-items: center; gap: 12px;
            padding: 0.75rem 1rem;
            border-bottom: 1px solid var(--border-color, rgba(255,255,255,0.07));
            background: var(--bg-secondary, #14171c);
            flex-shrink: 0;
        }

        #backToMessages {
            background: none; border: none; color: var(--text-secondary, #c8cdd6);
            cursor: pointer; padding: 6px; border-radius: 8px;
            display: flex; align-items: center; font-size: 1.1rem;
            transition: color 0.2s;
        }

        #backToMessages:hover { color: var(--primary, #ff4b6e); }

        .chat-partner-info { flex: 1; min-width: 0; }
        .chat-partner-info h3 { font-size: 0.95rem; font-weight: 600; color: var(--text-primary, #f0f2f5); margin-bottom: 2px; }

        #chatPartnerImage {
            width: 40px; height: 40px; border-radius: 50%; object-fit: cover;
            border: 2px solid var(--primary, #ff4b6e);
        }

        /* Chat messages area */
        #chatMessages {
            flex: 1; overflow-y: auto; padding: 1rem;
            display: flex; flex-direction: column; gap: 4px;
        }

        /* Chat input bar */
        .chat-input-area {
            padding: 0.75rem 1rem;
            border-top: 1px solid var(--border-color, rgba(255,255,255,0.07));
            background: var(--bg-secondary, #14171c);
            flex-shrink: 0;
        }

        /* ── MOBILE: panels stack, chat slides in over list ── */
        @media (max-width: 768px) {
            .spa-layout { height: calc(100vh - 56px); }

            #messagesPanel {
                width: 100%;
                position: absolute; inset: 0;
                z-index: 10;
                transition: transform 0.3s ease;
            }

            #messagesPanel.chat-open {
                transform: translateX(-100%);
                pointer-events: none;
            }

            #chatPanel {
                position: absolute; inset: 0;
                z-index: 20;
                transform: translateX(100%);
                transition: transform 0.3s ease;
            }

            #chatPanel.active { transform: translateX(0); }
        }

        @media (min-width: 769px) {
            /* On desktop hide back button (no need to slide back) */
            #backToMessages { display: none; }
        }
    `;
    document.head.appendChild(style);

    const instantLoading = document.createElement('div');
    instantLoading.className = 'instant-loading';
    instantLoading.id = 'instantLoading';
    instantLoading.innerHTML = `<div class="dot-pulse"></div><p>Loading...</p>`;
    document.body.appendChild(instantLoading);

    const reactionPicker = document.createElement('div');
    reactionPicker.id = 'reactionPicker';
    reactionPicker.className = 'reaction-picker';
    document.body.appendChild(reactionPicker);

    setupNetworkMonitoring();

    if (navToggle) {
        eventManager.addListener(navToggle, 'click', () => {
            navToggle.classList.toggle('active');
            if (navMenu) navMenu.classList.toggle('active');
        });
    }

    document.querySelectorAll('.nav-links').forEach(link => {
        eventManager.addListener(link, 'click', () => {
            if (navToggle) navToggle.classList.remove('active');
            if (navMenu) navMenu.classList.remove('active');
        });
    });

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
        if (!e.target.classList.contains('allow-paste') && !e.target.closest('.share-container')) {
            e.preventDefault();
            showNotification('Pasting is disabled on this page', 'warning', 2000);
        }
    });

    document.addEventListener('cut', (e) => {
        if (!e.target.classList.contains('allow-copy') && !e.target.closest('.share-container')) {
            e.preventDefault();
            showNotification('Cutting is disabled on this page', 'warning', 2000);
        }
    });

    document.body.classList.add('prevent-copy');

    await preloadPageData();

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;

            const cachedUnread = cache.get(`unread_count_${currentUser.uid}`) || 0;
            updateMessageCount(cachedUnread);

            ensureUserDocument(user).then(() => {
                loadUserChatPoints();
                setupGlobalMessageListener();
                setupUserOnlineStatus();
                initReactionPicker();

                if (!localStorage.getItem('microphonePermissionShown')) {
                    setTimeout(() => { showMicrophonePermissionPopup(); }, 2000);
                }

                switch (currentPage) {
                    case 'index':     initLandingPage();   break;
                    case 'login':     initLoginPage();     break;
                    case 'signup':    initSignupPage();    break;
                    case 'mingle':    initMinglePage();    break;
                    case 'profile':   initProfilePage();   break;
                    case 'account':   initAccountPage();   break;
                    case 'messages':  initMessagesPage();  break;
                    // ─── chat.html now redirects to the SPA ───
                    case 'chat':      initChatPage();      break;
                    case 'dashboard': initDashboardPage(); break;
                    case 'payment':   initPaymentPage();   break;
                    case 'admin':     initAdminPage();     break;
                }

                if (['login', 'signup', 'index'].includes(currentPage)) {
                    window.location.href = 'posts.html';
                }
            }).catch(error => {
                logError(error, 'ensuring user document');
            });
        } else {
            cleanupAllListeners();
            currentUser = null;
            cache.clear();

            if (['mingle','profile','account','messages','chat','dashboard','payment','admin'].includes(currentPage)) {
                window.location.href = 'login.html';
            } else {
                switch (currentPage) {
                    case 'index':  initLandingPage(); break;
                    case 'login':  initLoginPage();   break;
                    case 'signup': initSignupPage();  break;
                }
            }
        }
    });
});

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && currentUser) {
        if (currentPage === 'messages' && chatPartnerId) {
            setTimeout(() => {
                if (unsubscribeChat) unsubscribeChat();
                loadChatMessages(currentUser.uid, chatPartnerId);
            }, 500);
        }
        if (isOnline) processPendingMessages();
    }
});

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
                chatPoints: 12,
                paymentHistory: []
            });
        }
        return true;
    } catch (error) {
        logError(error, 'ensureUserDocument');
        throw error;
    }
}

async function loadUserChatPoints() {
    if (!currentUser) return;
    try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            userChatPoints = userSnap.data().chatPoints || 0;
            updateChatPointsDisplay();
            cache.set(`user_${currentUser.uid}`, userSnap.data(), 'medium');
        }
    } catch (error) {
        logError(error, 'loading chat points');
    }
}

function updateChatPointsDisplay() {
    const pointsElements = document.querySelectorAll('.chat-points-display');
    pointsElements.forEach(el => { el.textContent = userChatPoints; });
}

async function deductChatPoint() {
    if (!currentUser) return false;
    try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            const currentPoints = userSnap.data().chatPoints || 0;
            if (currentPoints <= 0) {
                showNotification('No chat points left. Please purchase more to continue chatting.', 'warning');
                return false;
            }
            await updateDoc(userRef, { chatPoints: currentPoints - 1 });
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

async function addChatPoints(userId, points) {
    try {
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            const currentPoints = userSnap.data().chatPoints || 0;
            await updateDoc(userRef, { chatPoints: currentPoints + points });
            return true;
        }
        return false;
    } catch (error) {
        logError(error, 'adding chat points');
        return false;
    }
}

function setupUserOnlineStatus() {
    if (!currentUser) return;
    try {
        const userStatusRef = doc(db, 'status', currentUser.uid);
        setDoc(userStatusRef, {
            state: 'online',
            lastChanged: serverTimestamp(),
            userId: currentUser.uid,
            lastSeen: null
        });

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

async function setupGlobalMessageListener() {
    if (!currentUser || !currentUser.uid) return;
    try {
        if (globalMessageListener) globalMessageListener();

        const threadsQuery = query(
            collection(db, 'conversations'),
            where('participants', 'array-contains', currentUser.uid)
        );

        globalMessageListener = onSnapshot(threadsQuery, async (snapshot) => {
            const threadPromises = snapshot.docs.map(async (docSnap) => {
                const thread = docSnap.data();
                const partnerId = thread.participants.find(id => id !== currentUser.uid);
                if (partnerId) {
                    try {
                        const messagesQuery = query(
                            collection(db, 'conversations', docSnap.id, 'messages'),
                            where('senderId', '==', partnerId),
                            where('read', '==', false)
                        );
                        const messagesSnap = await getDocs(messagesQuery);
                        return messagesSnap.size;
                    } catch (error) {
                        logError(error, 'counting unread messages');
                        return 0;
                    }
                }
                return 0;
            });

            const threadCounts = await Promise.all(threadPromises);
            const totalUnread = threadCounts.reduce((sum, count) => sum + count, 0);
            updateMessageCount(totalUnread);
            cache.set(`unread_count_${currentUser.uid}`, totalUnread, 'short');
        });
    } catch (error) {
        logError(error, 'setting up global message listener');
        const cachedUnread = cache.get(`unread_count_${currentUser.uid}`) || 0;
        updateMessageCount(cachedUnread);
    }
}

async function refreshUnreadMessageCount() {
    if (!currentUser) return;
    try {
        const threadsQuery = query(
            collection(db, 'conversations'),
            where('participants', 'array-contains', currentUser.uid)
        );
        const threadsSnap = await getDocs(threadsQuery);
        let totalUnread = 0;

        for (const docSnap of threadsSnap.docs) {
            const thread = docSnap.data();
            const partnerId = thread.participants.find(id => id !== currentUser.uid);
            if (partnerId) {
                const messagesQuery = query(
                    collection(db, 'conversations', docSnap.id, 'messages'),
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
        logError(error, 'refreshing unread count');
    }
}

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

function safeParseTimestamp(timestamp) {
    try {
        if (!timestamp) return null;
        if (typeof timestamp.toDate === 'function') return timestamp.toDate();
        if (typeof timestamp === 'number') return new Date(timestamp);
        if (typeof timestamp === 'string') return new Date(timestamp);
        return null;
    } catch (error) {
        return null;
    }
}

function formatTime(timestamp) {
    let date;
    try {
        if (typeof timestamp === 'string') date = new Date(timestamp);
        else if (timestamp && typeof timestamp.toDate === 'function') date = timestamp.toDate();
        else if (timestamp instanceof Date) date = timestamp;
        else if (typeof timestamp === 'number') date = new Date(timestamp);
        else return '';
        if (isNaN(date.getTime())) return '';
    } catch (error) {
        return '';
    }

    const now = new Date();
    const diffMs = now - date;
    const diffSecs  = Math.floor(diffMs / 1000);
    const diffMins  = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays  = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);

    if (diffHours < 24)  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (diffWeeks > 0)   return `${diffWeeks}w ago`;
    if (diffDays > 0)    return `${diffDays}d ago`;
    if (diffHours > 0)   return `${diffHours}h ago`;
    if (diffMins > 0)    return `${diffMins}m ago`;
    if (diffSecs > 30)   return `${diffSecs}s ago`;
    return 'just now';
}

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

function showReactionPicker(messageId, x, y) {
    const reactionPicker = document.getElementById('reactionPicker');
    if (!reactionPicker) return;
    selectedMessageForReaction = messageId;
    reactionPicker.style.left   = `${x}px`;
    reactionPicker.style.bottom = `${window.innerHeight - y}px`;
    reactionPicker.style.display = 'flex';

    const hidePicker = (e) => {
        if (!reactionPicker.contains(e.target)) {
            reactionPicker.style.display = 'none';
            document.removeEventListener('click', hidePicker);
        }
    };
    setTimeout(() => { document.addEventListener('click', hidePicker); }, 10);
}

async function addReactionToMessage(emoji) {
    if (!selectedMessageForReaction || !currentUser || !chatPartnerId) return;
    try {
        const threadId = [currentUser.uid, chatPartnerId].sort().join('_');
        const messageRef = doc(db, 'conversations', threadId, 'messages', selectedMessageForReaction);
        const messageSnap = await getDoc(messageRef);

        if (messageSnap.exists()) {
            const reactions = messageSnap.data().reactions || {};
            const userIdx = reactions[emoji] ? reactions[emoji].indexOf(currentUser.uid) : -1;

            if (userIdx > -1) {
                reactions[emoji].splice(userIdx, 1);
                if (reactions[emoji].length === 0) delete reactions[emoji];
            } else {
                if (!reactions[emoji]) reactions[emoji] = [];
                reactions[emoji].push(currentUser.uid);
            }

            await updateDoc(messageRef, { reactions });
            document.getElementById('reactionPicker').style.display = 'none';
        }
    } catch (error) {
        logError(error, 'adding reaction');
        showNotification('Error adding reaction. Please try again.', 'error');
    }
}

function showReplyPreview(message) {
    const replyPreview = document.getElementById('replyPreview');
    const replyPreviewName = document.querySelector('.reply-preview-name');
    const replyPreviewText = document.querySelector('.reply-preview-text');
    if (!replyPreview || !replyPreviewName || !replyPreviewText) return;

    selectedMessageForReply = message.id;
    const senderName = message.senderId === currentUser.uid ? 'You' : document.getElementById('chatPartnerName').textContent;
    replyPreviewName.textContent = senderName;

    if (message.text)           replyPreviewText.textContent = message.text;
    else if (message.imageUrl)  replyPreviewText.textContent = '📷 Photo';
    else if (message.audioUrl)  replyPreviewText.textContent = '🎤 Voice message';
    else if (message.videoUrl)  replyPreviewText.textContent = '🎥 Video message';

    replyPreview.style.display = 'flex';
    const messageInput = document.getElementById('messageInput');
    if (messageInput) messageInput.focus();
}

function cancelReply() {
    const replyPreview = document.getElementById('replyPreview');
    if (replyPreview) replyPreview.style.display = 'none';
    selectedMessageForReply = null;
}

function setupMessageLongPress() {
    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) return;

    messagesContainer.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const messageElement = e.target.closest('.message');
        if (messageElement && messageElement.classList.contains('received')) {
            const messageId = messageElement.dataset.messageId;
            if (messageId) showReactionPicker(messageId, e.clientX, e.clientY);
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

    messagesContainer.addEventListener('touchend',  () => { clearTimeout(longPressTimer); });
    messagesContainer.addEventListener('touchmove', () => { clearTimeout(longPressTimer); });
}

function setupMessageSwipe() {
    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) return;

    let startX = 0, startY = 0, currentX = 0;
    let currentElement = null, isSwiping = false;
    let swipeThreshold = 50, tapThreshold = 10, swipeStartTime = 0;

    messagesContainer.addEventListener('touchstart', (e) => {
        if (e.target.closest('.voice-message-play-btn') ||
            e.target.closest('.voice-message-controls') ||
            e.target.closest('.message-reactions') ||
            e.target.closest('.message-time') ||
            e.target.closest('.video-play-btn')) return;

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
        if (Math.abs(diffX) < Math.abs(diffY) || diffX < 0) { resetSwipeState(); return; }
        e.preventDefault();
        const swipeDistance = Math.min(Math.max(diffX, 0), 100);
        currentElement.style.transform = `translateX(${swipeDistance}px)`;
        const swipeAction = currentElement.querySelector('.message-swipe-action');
        if (swipeAction) swipeAction.style.opacity = Math.min(Math.abs(swipeDistance) / 100, 1);
    });

    messagesContainer.addEventListener('touchend', (e) => {
        if (!isSwiping || !currentElement) return;
        const diffX = currentX - startX;
        const swipeDuration = Date.now() - swipeStartTime;
        if (Math.abs(diffX) < tapThreshold && swipeDuration < 300) { resetSwipeState(); return; }
        if (diffX > swipeThreshold) {
            const messageId = currentElement.dataset.messageId;
            const cachedMessages = cache.get(`messages_${currentUser.uid}_${chatPartnerId}`) || [];
            const message = cachedMessages.find(m => m.id === messageId);
            if (message) showReplyPreview(message);
        }
        resetSwipeState();
    });

    function resetSwipeState() {
        if (!currentElement) return;
        currentElement.style.transition = 'transform 0.3s ease';
        currentElement.style.transform = 'translateX(0)';
        const swipeAction = currentElement.querySelector('.message-swipe-action');
        if (swipeAction) swipeAction.style.opacity = '0';
        setTimeout(() => {
            if (currentElement) currentElement.style.transition = '';
            isSwiping = false; currentElement = null;
            startX = 0; startY = 0; currentX = 0;
        }, 300);
    }
}

// ---- Helper: toggle the entire chat input row when recording ----
// Hides ALL siblings of #voiceNoteIndicator (text input, send button, attach,
// emoji, video buttons, etc.) so only the recording UI is visible. This means
// the regular Send button is hidden while a voice note is being recorded.
function setVoiceRecordingMode(on) {
    const indicator = document.getElementById('voiceNoteIndicator');
    if (!indicator) return;
    const row = indicator.parentNode;
    if (!row) return;
    Array.from(row.children).forEach(child => {
        if (child === indicator) {
            child.style.display = on ? 'flex' : 'none';
        } else {
            if (on) {
                if (child.dataset.bbPrevDisplay === undefined) {
                    child.dataset.bbPrevDisplay = child.style.display || '';
                }
                child.style.display = 'none';
            } else {
                if (child.dataset.bbPrevDisplay !== undefined) {
                    child.style.display = child.dataset.bbPrevDisplay;
                    delete child.dataset.bbPrevDisplay;
                } else {
                    child.style.display = '';
                }
            }
        }
    });
    // Reset the timer label whenever we leave recording mode
    if (!on) {
        const t = document.getElementById('voiceNoteTimer');
        if (t) t.textContent = '0:00';
    }
}

// Module-level handle for the auto-stop-on-release listener so any path
// (cancel / send) can tear it down and avoid double-fire races.
let _bbStopOnReleaseHandler = null;
function _bbRemoveStopOnRelease() {
    if (_bbStopOnReleaseHandler) {
        document.removeEventListener('mouseup', _bbStopOnReleaseHandler);
        _bbStopOnReleaseHandler = null;
    }
}

async function startRecording() {
    try {
        // Show indicator + reset timer to 0:00 BEFORE we start the stream
        const t0 = document.getElementById('voiceNoteTimer');
        if (t0) t0.textContent = '0:00';
        setVoiceRecordingMode(true);

        let stream;
        if (preloadedAudioStream) {
            stream = preloadedAudioStream;
        } else {
            const hasPermission = await requestMicrophonePermission();
            if (!hasPermission) {
                showNotification('Microphone access required for voice notes.', 'warning');
                setVoiceRecordingMode(false);
                return;
            }
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }

        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        recordingStartTime = Date.now();
        updateRecordingTimer();
        if (recordingTimer) clearInterval(recordingTimer);
        recordingTimer = setInterval(updateRecordingTimer, 1000);

        mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) audioChunks.push(event.data);
        };
        mediaRecorder.start(100);

        // Auto-stop on mouseup ONLY for desktop hold-to-record. Tracked so
        // Cancel/Send paths can tear it down and avoid double-fire races.
        _bbRemoveStopOnRelease();
        _bbStopOnReleaseHandler = () => {
            _bbRemoveStopOnRelease();
            // Only auto-stop if still actively recording (user did press-and-hold).
            if (mediaRecorder && mediaRecorder.state === 'recording') stopRecording();
        };
        document.addEventListener('mouseup', _bbStopOnReleaseHandler);
    } catch (error) {
        logError(error, 'starting voice recording');
        showNotification('Could not access microphone.', 'error');
        setVoiceRecordingMode(false);
    }
}

function updateRecordingTimer() {
    if (recordingStartTime == null) return;
    const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
    const t = document.getElementById('voiceNoteTimer');
    if (t) t.textContent = `${Math.floor(elapsed / 60)}:${(elapsed % 60).toString().padStart(2, '0')}`;
}

// Idempotent: safe to call multiple times.
async function stopRecording() {
    _bbRemoveStopOnRelease();
    if (recordingTimer) { clearInterval(recordingTimer); recordingTimer = null; }
    if (!mediaRecorder) {
        setVoiceRecordingMode(false);
        return;
    }
    try {
        if (mediaRecorder.state !== 'inactive') {
            const stopPromise = new Promise(resolve => { mediaRecorder.onstop = resolve; });
            mediaRecorder.stop();
            await stopPromise;
        }
        if (!preloadedAudioStream && mediaRecorder.stream) {
            mediaRecorder.stream.getTracks().forEach(t => { try { t.stop(); } catch (e) {} });
        }
    } catch (e) { console.warn('stopRecording error', e); }
    setVoiceRecordingMode(false);
}

// Single-press cancel — fully idempotent, no awaits that can hang.
async function cancelRecording() {
    _bbRemoveStopOnRelease();
    if (recordingTimer) { clearInterval(recordingTimer); recordingTimer = null; }
    try {
        if (mediaRecorder) {
            if (mediaRecorder.state !== 'inactive') {
                try { mediaRecorder.stop(); } catch (e) {}
            }
            if (!preloadedAudioStream && mediaRecorder.stream) {
                mediaRecorder.stream.getTracks().forEach(t => { try { t.stop(); } catch (e) {} });
            }
        }
    } catch (e) { console.warn('cancelRecording error', e); }
    mediaRecorder = null;
    audioChunks = [];
    recordingStartTime = null;
    setVoiceRecordingMode(false); // hides indicator & resets timer label to 0:00
}

async function sendVoiceNote() {
    if (audioChunks.length === 0 && (!mediaRecorder || mediaRecorder.state === 'inactive')) {
        showNotification('No recording to send', 'warning'); return;
    }

    try {
        const hasPoints = await deductChatPoint();
        if (!hasPoints) return;

        // Capture duration BEFORE we reset state
        const duration = recordingStartTime ? Math.floor((Date.now() - recordingStartTime) / 1000) : 0;

        // ---- Stop the recorder cleanly so the final chunk is captured ----
        _bbRemoveStopOnRelease();
        if (recordingTimer) { clearInterval(recordingTimer); recordingTimer = null; }
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            const stopPromise = new Promise(resolve => { mediaRecorder.onstop = resolve; });
            try { mediaRecorder.stop(); } catch (e) {}
            await stopPromise;
        }
        if (mediaRecorder && !preloadedAudioStream && mediaRecorder.stream) {
            mediaRecorder.stream.getTracks().forEach(t => { try { t.stop(); } catch (e) {} });
        }

        // ---- Capture the blob, then immediately reset UI (timer back to 0:00, send button restored) ----
        const audioBlob = new Blob(audioChunks, { type: 'audio/mp3' });
        const chunksToUpload = audioChunks.slice();
        mediaRecorder = null;
        audioChunks = [];
        recordingStartTime = null;
        setVoiceRecordingMode(false); // hides indicator, restores send/attach buttons, resets timer label

        const tempMessageId = 'temp_voice_' + Date.now();
        const tempMessage = { id: tempMessageId, senderId: currentUser.uid, audioUrl: '', duration, timestamp: new Date().toISOString(), status: 'sending' };
        displayMessage(tempMessage, currentUser.uid);
        const cm = document.getElementById('chatMessages');
        if (cm) cm.scrollTop = cm.scrollHeight;
        try { soundManager.sent && soundManager.sent(); } catch (e) {}

        if (!isOnline) {
            await cache.addPendingMessage({ type: 'voice', tempId: tempMessageId, blob: audioBlob, duration, threadId: [currentUser.uid, chatPartnerId].sort().join('_'), timestamp: new Date().toISOString() });
            showNotification('Voice note saved offline. Will send when connection is restored.', 'info');
            return;
        }

        const audioUrl = await uploadAudioToCloudinary(audioBlob);
        await addMessage(null, null, audioUrl, duration);
    } catch (error) {
        logError(error, 'sending voice note');
        showNotification('Failed to send voice note. Please try again.', 'error');
        setVoiceRecordingMode(false);
    }
}

async function startVideoRecording() {
    try {
        const hasPermission = await requestCameraPermission();
        if (!hasPermission) { showNotification('Camera access required.', 'warning'); return; }

        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        videoRecorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9,opus' });
        videoChunks = [];

        document.getElementById('videoRecordingIndicator').style.display = 'flex';
        document.getElementById('messageInput').style.display = 'none';

        videoRecordingStartTime = Date.now();
        updateVideoRecordingTimer();
        videoRecordingTimer = setInterval(updateVideoRecordingTimer, 1000);

        videoRecorder.ondataavailable = (event) => { if (event.data.size > 0) videoChunks.push(event.data); };
        videoRecorder.start(100);

        setTimeout(() => { if (videoRecorder && videoRecorder.state === 'recording') stopVideoRecording(); }, 20000);
    } catch (error) {
        logError(error, 'starting video recording');
        showNotification('Could not access camera.', 'error');
    }
}

function updateVideoRecordingTimer() {
    const elapsed = Math.floor((Date.now() - videoRecordingStartTime) / 1000);
    const remaining = 20 - elapsed;
    document.getElementById('videoRecordingTimer').textContent = `0:${remaining.toString().padStart(2, '0')}`;
    if (remaining <= 0) stopVideoRecording();
}

async function stopVideoRecording() {
    if (!videoRecorder) return;
    clearInterval(videoRecordingTimer);
    videoRecorder.stop();
    videoRecorder.stream.getTracks().forEach(t => t.stop());
    await new Promise(resolve => { videoRecorder.onstop = resolve; });
    document.getElementById('videoRecordingIndicator').style.display = 'none';
    document.getElementById('messageInput').style.display = 'block';
    showVideoPreview();
}

async function cancelVideoRecording() {
    if (!videoRecorder) return;
    clearInterval(videoRecordingTimer);
    videoRecorder.stop();
    videoRecorder.stream.getTracks().forEach(t => t.stop());
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
        <video controls autoplay><source src="${videoUrl}" type="video/webm"></video>
        <div class="video-preview-controls">
            <button class="video-preview-btn" id="cancelVideoPreview"><i class="fas fa-times"></i></button>
            <button class="video-preview-btn" id="sendVideoPreview"><i class="fas fa-paper-plane"></i></button>
        </div>
    `;
    document.body.appendChild(previewModal);
    previewModal.style.display = 'flex';

    document.getElementById('cancelVideoPreview').addEventListener('click', () => {
        previewModal.remove();
        videoRecorder = null; videoChunks = [];
    });
    document.getElementById('sendVideoPreview').addEventListener('click', async () => {
        await sendVideoMessage(videoBlob);
        previewModal.remove();
    });
}

async function sendVideoMessage(videoBlob) {
    try {
        const hasPoints = await deductChatPoint();
        if (!hasPoints) return;

        const tempMessageId = 'temp_video_' + Date.now();
        const duration = Math.floor((Date.now() - videoRecordingStartTime) / 1000);
        displayMessage({ id: tempMessageId, senderId: currentUser.uid, videoUrl: '', duration, timestamp: new Date().toISOString(), status: 'sending' }, currentUser.uid);
        document.getElementById('chatMessages').scrollTop = document.getElementById('chatMessages').scrollHeight;

        if (!isOnline) {
            await cache.addPendingMessage({ type: 'video', tempId: tempMessageId, blob: videoBlob, duration, threadId: [currentUser.uid, chatPartnerId].sort().join('_'), timestamp: new Date().toISOString() });
            showNotification('Video saved offline. Will send when connection is restored.', 'info');
            return;
        }

        const videoUrl = await uploadVideoToCloudinary(videoBlob);
        await addMessage(null, null, null, null, videoUrl, duration);
        videoRecorder = null; videoChunks = [];
    } catch (error) {
        logError(error, 'sending video message');
        showNotification('Failed to send video message.', 'error');
    }
}

async function uploadAudioToCloudinary(audioBlob) {
    const formData = new FormData();
    formData.append('file', audioBlob);
    formData.append('upload_preset', cloudinaryConfig.uploadPreset);
    formData.append('resource_type', 'auto');
    try {
        const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/upload`, {
            method: 'POST', body: formData, headers: { 'X-Requested-With': 'XMLHttpRequest' }
        });
        if (!response.ok) throw new Error(`Cloudinary error: ${response.statusText}`);
        const data = await response.json();
        if (!data.secure_url) throw new Error('Invalid response from Cloudinary');
        return data.secure_url;
    } catch (error) {
        logError(error, 'uploading audio');
        throw error;
    }
}

async function uploadVideoToCloudinary(videoBlob) {
    const formData = new FormData();
    formData.append('file', videoBlob);
    formData.append('upload_preset', cloudinaryConfig.uploadPreset);
    formData.append('resource_type', 'video');
    try {
        const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/video/upload`, {
            method: 'POST', body: formData
        });
        if (!response.ok) throw new Error(`Cloudinary video upload failed: ${response.statusText}`);
        const data = await response.json();
        if (!data.secure_url) throw new Error('Invalid response from Cloudinary');
        return data.secure_url;
    } catch (error) {
        throw new Error('Video upload failed. Please try again later.');
    }
}

async function uploadFileToCloudinary(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', cloudinaryConfig.uploadPreset);
    const resourceType = file.type.startsWith('video/') ? 'video' : 'image';
    formData.append('resource_type', resourceType);
    try {
        if (!navigator.onLine) throw new Error('No internet connection');
        if (resourceType === 'image') validateImageFile(file);
        else validateVideoFile(file);
        const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/${resourceType}/upload`, {
            method: 'POST', body: formData, headers: { 'Accept': 'application/json' }
        });
        if (!response.ok) throw new Error(`Cloudinary error: ${response.statusText}`);
        const data = await response.json();
        if (!data.secure_url) throw new Error('Invalid response from Cloudinary');
        return data.secure_url;
    } catch (error) {
        logError(error, `uploading ${resourceType}`);
        throw new Error(`Failed to upload ${resourceType}. Please check your connection and try again.`);
    }
}

async function uploadImageToCloudinary(file) {
    return uploadFileToCloudinary(file);
}

async function sendImageMessage(file) {
    try {
        const hasPoints = await deductChatPoint();
        if (!hasPoints) return;

        const tempMessageId = 'temp_image_' + Date.now();
        displayMessage({ id: tempMessageId, senderId: currentUser.uid, imageUrl: URL.createObjectURL(file), timestamp: new Date().toISOString(), status: 'sending' }, currentUser.uid);
        document.getElementById('chatMessages').scrollTop = document.getElementById('chatMessages').scrollHeight;

        if (!isOnline) {
            await cache.addPendingMessage({ type: 'image', tempId: tempMessageId, blob: file, threadId: [currentUser.uid, chatPartnerId].sort().join('_'), timestamp: new Date().toISOString() });
            showNotification('Image saved offline. Will send when connection is restored.', 'info');
            return;
        }

        const imageUrl = await uploadImageToCloudinary(file);
        await addMessage(null, imageUrl);
    } catch (error) {
        logError(error, 'sending image message');
        showNotification('Failed to send image. Please try again.', 'error');
    }
}

function createAudioPlayer(audioUrl, duration) {
    const audio = new Audio(audioUrl);
    const container = document.createElement('div');
    container.className = 'voice-message-controls';
    container.innerHTML = `
        <button class="voice-message-play-btn"><i class="fas fa-play"></i></button>
        <div class="waveform">${Array(5).fill('').map(() => `<div class="waveform-bar" style="height:5px;"></div>`).join('')}</div>
        <span class="voice-message-duration">${Math.floor(duration/60)}:${(duration%60).toString().padStart(2,'0')}</span>
    `;

    const playBtn = container.querySelector('.voice-message-play-btn');
    const waveformBars = container.querySelectorAll('.waveform-bar');
    let animationInterval = null;

    const startAnimation = () => {
        if (animationInterval) clearInterval(animationInterval);
        animationInterval = setInterval(() => {
            waveformBars.forEach(bar => { bar.style.height = `${Math.floor(Math.random() * 15) + 5}px`; });
        }, 100);
    };

    const stopAnimation = () => {
        if (animationInterval) { clearInterval(animationInterval); animationInterval = null; }
        waveformBars.forEach(bar => { bar.style.height = '5px'; });
    };

    playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (audio.paused) {
            audio.play();
            playBtn.innerHTML = '<i class="fas fa-pause"></i>';
            startAnimation();
            try { bbRegisterPlayingAudio(audio, audioUrl); } catch (er) {}
        } else {
            audio.pause();
            playBtn.innerHTML = '<i class="fas fa-play"></i>';
            stopAnimation();
        }
    });
    audio.onended = () => { playBtn.innerHTML = '<i class="fas fa-play"></i>'; stopAnimation(); };
    audio.onpause = () => { playBtn.innerHTML = '<i class="fas fa-play"></i>'; stopAnimation(); };
    return container;
}

function createVideoPlayer(videoUrl, duration) {
    const container = document.createElement('div');
    container.className = 'video-message';
    container.innerHTML = `
        <video controls><source src="${videoUrl}" type="video/webm">Your browser does not support the video tag.</video>
        <div class="video-message-controls">
            <span class="video-duration">${Math.floor(duration/60)}:${(duration%60).toString().padStart(2,'0')}</span>
        </div>
    `;
    return container;
}

function displayMessage(message, currentUserId) {
    if (message && message.deleted) return; // soft-deleted: never render
    const messagesContainer = document.getElementById('chatMessages');
    const noMessagesDiv = messagesContainer.querySelector('.no-messages');
    if (noMessagesDiv) noMessagesDiv.remove();

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
            let previewText = repliedMessage.text || (repliedMessage.imageUrl ? '📷 Photo' : repliedMessage.audioUrl ? '🎤 Voice message' : '🎥 Video message');
            messageContent += `
                <div class="reply-indicator"><i class="fas fa-reply"></i> Replying to ${senderName}</div>
                <div class="reply-message-preview">${previewText}</div>
            `;
        }
    }

    if (message.imageUrl) {
        const imageContainer = document.createElement('div');
        imageContainer.style.cssText = 'position:relative;display:inline-block;';
        const img = document.createElement('img');
        img.src = message.imageUrl;
        img.alt = 'Message image';
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
        if (message.senderId === currentUserId && message.read) timestampText += ' ✓✓';
    }

    messageContent += `<span class="message-time">${timestampText}</span>`;
    messageDiv.innerHTML = messageContent;

    if (message.audioUrl || (message.id && message.id.startsWith('temp_voice'))) {
        const voiceMessageDiv = document.createElement('div');
        voiceMessageDiv.className = `voice-message ${message.senderId === currentUserId ? 'sent' : 'received'}`;
        if (message.id && message.id.startsWith('temp_voice') || message.status === 'sending') {
            voiceMessageDiv.classList.add('sending');
            const overlay = document.createElement('div');
            overlay.className = 'sending-overlay';
            overlay.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
            voiceMessageDiv.appendChild(overlay);
        }
        voiceMessageDiv.appendChild(createAudioPlayer(message.audioUrl || '', message.duration || 0));
        messageDiv.appendChild(voiceMessageDiv);
    }

    if (message.videoUrl || (message.id && message.id.startsWith('temp_video'))) {
        const videoPlayer = createVideoPlayer(message.videoUrl || '', message.duration || 0);
        if (message.id && message.id.startsWith('temp_video') || message.status === 'sending') {
            videoPlayer.classList.add('sending');
            const overlay = document.createElement('div');
            overlay.className = 'sending-overlay';
            overlay.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
            videoPlayer.appendChild(overlay);
        }
        messageDiv.appendChild(videoPlayer);
    }

    messagesContainer.appendChild(messageDiv);
}

function showFastLoadingMessage() {
    const existingMessages = document.querySelectorAll('.fast-loading-message');
    existingMessages.forEach(msg => msg.remove());
    const loadingMsg = document.createElement('div');
    loadingMsg.className = 'fast-loading-message';
    loadingMsg.innerHTML = '<i class="fas fa-bolt"></i> Loading content...';
    const mainContent = document.querySelector('main') || document.querySelector('.container') || document.body;
    mainContent.insertBefore(loadingMsg, mainContent.firstChild);
    setTimeout(() => { loadingMsg.remove(); }, 3000);
}

function showChatLoadingMessage() {
    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) return;
    hideChatLoadingMessage();
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading-message';
    loadingDiv.innerHTML = `<div class="dot-pulse"></div><span>Loading messages...</span>`;
    messagesContainer.appendChild(loadingDiv);
}

function hideChatLoadingMessage() {
    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) return;
    const loadingMessage = messagesContainer.querySelector('.loading-message');
    if (loadingMessage) loadingMessage.remove();
}

function showMessagesLoadingMessage() {
    const messagesList = document.getElementById('messagesList');
    if (!messagesList) return;
    messagesList.innerHTML = `<div class="page-loader"><div class="dot-pulse"></div><span>Loading conversations...</span></div>`;
}

function hideMessagesLoadingMessage() {
    const loadingMessage = document.querySelector('#messagesList .page-loader');
    if (loadingMessage) loadingMessage.remove();
}

function showInstantLoading() {
    const el = document.getElementById('instantLoading');
    if (el) el.style.display = 'flex';
}

function hideInstantLoading() {
    const el = document.getElementById('instantLoading');
    if (el) el.style.display = 'none';
}

function cleanupChatPage() {
    if (unsubscribeChat) { unsubscribeChat(); unsubscribeChat = null; }
    if (chatPartnerId && currentUser) updateTypingStatus(false);
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        if (!preloadedAudioStream) mediaRecorder.stream.getTracks().forEach(t => t.stop());
    }
    if (videoRecorder && videoRecorder.state !== 'inactive') {
        videoRecorder.stop();
        videoRecorder.stream.getTracks().forEach(t => t.stop());
    }
    if (typingTimeout) clearTimeout(typingTimeout);
    if (recordingTimer) clearInterval(recordingTimer);
    if (videoRecordingTimer) clearInterval(videoRecordingTimer);
    if (longPressTimer) clearTimeout(longPressTimer);
    chatPartnerId = null;
}

function loadChatMessages(userId, partnerId) {
    const messagesContainer = document.getElementById('chatMessages');
    if (unsubscribeChat) unsubscribeChat();

    const threadId = [userId, partnerId].sort().join('_');
    showChatLoadingMessage();

    const cacheKey = `messages_${userId}_${partnerId}`;
    const cachedMessages = cache.get(cacheKey);
    if (cachedMessages && cachedMessages.length > 0) displayCachedMessages(cachedMessages);

    cache.getMessages(threadId).then(messages => {
        if (messages && messages.length > 0 && (!cachedMessages || messages.length > cachedMessages.length)) {
            displayCachedMessages(messages);
        }
    });

    try {
        let _bbPrevMsgIds = new Set();
        unsubscribeChat = onSnapshot(
            collection(db, 'conversations', threadId, 'messages'),
            async (snapshot) => {
                const messages = [];
                let hasUnreadMessages = false;

                snapshot.forEach(docSnap => {
                    const messageData = docSnap.data();
                    messages.push({
                        id: docSnap.id,
                        ...messageData,
                        timestamp: messageData.timestamp ?
                            (messageData.timestamp.toDate ? messageData.timestamp.toDate().toISOString() : messageData.timestamp)
                            : new Date().toISOString()
                    });
                    if (messageData.senderId === partnerId && !messageData.read) hasUnreadMessages = true;
                });

                messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

                // ---- Detect newly arrived messages from partner → play sound + hide typing bubble ----
                try {
                    const newFromPartner = messages.filter(m =>
                        !_bbPrevMsgIds.has(m.id) && m.senderId === partnerId
                    );
                    if (newFromPartner.length > 0 && _bbPrevMsgIds.size > 0) {
                        soundManager.received();
                        hideTypingBubble();
                    }
                    _bbPrevMsgIds = new Set(messages.map(m => m.id));
                } catch (e) {}

                cache.set(cacheKey, messages, 'short');
                await cache.setMessages(threadId, messages);

                updateMessagesDisplay(messages, userId);
                if (hasUnreadMessages) await markMessagesAsRead(threadId, partnerId, userId);

                requestAnimationFrame(() => {
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                });

                hideChatLoadingMessage();
                refreshUnreadMessageCount();
            },
            (error) => {
                logError(error, 'chat messages listener');
                if (cachedMessages) displayCachedMessages(cachedMessages);
                hideChatLoadingMessage();
            }
        );
    } catch (error) {
        logError(error, 'setting up chat messages listener');
        hideChatLoadingMessage();
    }
}

async function markMessagesAsRead(threadId, partnerId, userId) {
    try {
        const unreadMessagesQuery = query(
            collection(db, 'conversations', threadId, 'messages'),
            where('senderId', '==', partnerId),
            where('read', '==', false)
        );
        const unreadMessagesSnap = await getDocs(unreadMessagesQuery);
        const updatePromises = [];
        unreadMessagesSnap.forEach((docSnap) => {
            updatePromises.push(updateDoc(docSnap.ref, { read: true }));
        });
        await Promise.all(updatePromises);
        refreshUnreadMessageCount();
    } catch (error) {
        logError(error, 'marking messages as read');
    }
}

function updateMessagesDisplay(newMessages, currentUserId) {
    const messagesContainer = document.getElementById('chatMessages');
    const tempMessages = messagesContainer.querySelectorAll('[data-message-id^="temp_"]');
    tempMessages.forEach(msg => msg.remove());
    hideChatLoadingMessage();

    const existingMessages = messagesContainer.querySelectorAll('.message:not([data-message-id^="temp_"])');
    if (existingMessages.length === 0 && newMessages.length > 0) messagesContainer.innerHTML = '';

    newMessages.forEach(message => {
        if (message.deleted) {
            const existing = messagesContainer.querySelector(`[data-message-id="${message.id}"]`);
            if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
            return;
        }
        const existingMessage = messagesContainer.querySelector(`[data-message-id="${message.id}"]`);
        if (!existingMessage) displayMessage(message, currentUserId);
        else updateExistingMessage(existingMessage, message, currentUserId);
    });

    if (newMessages.length === 0 && messagesContainer.children.length === 0) {
        const noMessagesDiv = document.createElement('div');
        noMessagesDiv.className = 'no-messages';
        noMessagesDiv.textContent = 'No messages yet. Start the conversation!';
        messagesContainer.appendChild(noMessagesDiv);
    }
}

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
        if (selectedMessageForReply) messageData.replyTo = selectedMessageForReply;

        const tempMessageId = 'temp_' + Date.now();
        const tempMessage = { id: tempMessageId, ...messageData, timestamp: new Date().toISOString() };
        window.lastTempMessageId = tempMessageId;

        displayMessage(tempMessage, currentUser.uid);
        document.getElementById('chatMessages').scrollTop = document.getElementById('chatMessages').scrollHeight;
        try { soundManager.sent(); } catch (e) {}

        if (!isOnline) {
            await cache.addPendingMessage({ type: 'text', tempId: tempMessageId, data: messageData, threadId, timestamp: new Date().toISOString() });
            showNotification('Message saved offline. Will send when connection is restored.', 'info');
            return;
        }

        await addDoc(collection(db, 'conversations', threadId, 'messages'), messageData);
        try { soundManager.delivered(); } catch (e) {}

        let lastMessageText = text || (imageUrl ? 'Image' : audioUrl ? 'Voice message' : 'Video message');

        await setDoc(doc(db, 'conversations', threadId), {
            participants: [currentUser.uid, chatPartnerId],
            lastMessage: { text: lastMessageText, senderId: currentUser.uid, timestamp: serverTimestamp() },
            updatedAt: serverTimestamp()
        }, { merge: true });

        cancelReply();
    } catch (error) {
        logError(error, 'adding message');
        showNotification('Error sending message. Please try again.', 'error');
        const tempMessageElement = document.querySelector(`[data-message-id="${window.lastTempMessageId}"]`);
        if (tempMessageElement) tempMessageElement.remove();
    }
}

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
            existingElement.querySelector('.sending-indicator')?.remove();
            existingElement.querySelector('.message-image.sending')?.classList.remove('sending');
            existingElement.querySelector('.sending-overlay')?.remove();
            existingElement.querySelector('.voice-message.sending')?.classList.remove('sending');
            existingElement.querySelector('.video-message.sending')?.classList.remove('sending');
        }
    }
}

function updateMessageReactions(messageElement, message) {
    let reactionsContainer = messageElement.querySelector('.message-reactions');
    const reactions = message.reactions || {};
    if (Object.keys(reactions).length === 0) {
        if (reactionsContainer) reactionsContainer.remove();
        return;
    }
    if (!reactionsContainer) {
        reactionsContainer = document.createElement('div');
        reactionsContainer.className = 'message-reactions';
        const timeElement = messageElement.querySelector('.message-time');
        if (timeElement) messageElement.insertBefore(reactionsContainer, timeElement);
        else messageElement.appendChild(reactionsContainer);
    }
    reactionsContainer.innerHTML = '';
    for (const [emoji, users] of Object.entries(reactions)) {
        const reactionElement = document.createElement('span');
        reactionElement.className = 'reaction';
        reactionElement.innerHTML = `${emoji} <span class="reaction-count">${users.length}</span>`;
        reactionsContainer.appendChild(reactionElement);
    }
}

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
    messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    messages.forEach(message => {
        if (!document.querySelector(`[data-message-id="${message.id}"]`)) {
            displayMessage(message, currentUser.uid);
        }
    });
    setTimeout(() => { messagesContainer.scrollTop = messagesContainer.scrollHeight; }, 100);
}

function getRepliedMessage(messageId) {
    const cachedMessages = cache.get(`messages_${currentUser.uid}_${chatPartnerId}`) || [];
    return cachedMessages.find(m => m.id === messageId);
}

// ══════════════════════════════════════════════════════════
//  SPA CORE: openChat / closeChat
//  These replace window.location.href = 'chat.html?id=...'
// ══════════════════════════════════════════════════════════

function openChat(partnerId) {
    if (!partnerId) return;

    // Clean up any previous chat listener
    if (unsubscribeChat) { unsubscribeChat(); unsubscribeChat = null; }
    if (chatPartnerId && chatPartnerId !== partnerId) {
        updateTypingStatus(false);
        if (typingTimeout) clearTimeout(typingTimeout);
    }

    chatPartnerId = partnerId;

    // Slide chat panel into view
    const chatPanel = document.getElementById('chatPanel');
    const messagesPanel = document.getElementById('messagesPanel');
    if (chatPanel)     chatPanel.classList.add('active');
    if (messagesPanel) messagesPanel.classList.add('chat-open');

    // Clear old messages immediately so we never show a stale conversation
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) chatMessages.innerHTML = '';

    // Highlight active thread card
    document.querySelectorAll('.message-card').forEach(card => card.classList.remove('active'));
    const activeCard = document.querySelector(`.message-card[data-partner-id="${partnerId}"]`);
    if (activeCard) activeCard.classList.add('active');

    // Update URL without page reload so back button works
    history.pushState({ partnerId }, '', `messages.html?id=${partnerId}`);

    // Load partner info (header)
    const cachedPartner = cache.get(`partner_${partnerId}`);
    if (cachedPartner) displayChatPartnerData(cachedPartner);
    else loadChatPartnerData(partnerId);

    // Load messages
    loadChatMessages(currentUser.uid, partnerId);
    setupTypingIndicator();
    // setupMessageLongPress();  // disabled — replaced by setupBondbaseLongPress (no scroll interference, full action modal)
    setupBondbaseLongPress();
    setupMessageSwipe();

    // Preload microphone for voice notes
    setTimeout(preloadMicrophonePermission, 800);
}

function closeChat() {
    // ---- If a voice note is still playing, lift it into the floating mini-player ----
    try {
        if (bbVoiceState.audio && !bbVoiceState.audio.paused) {
            bbShowMiniPlayer();
        }
    } catch (e) {}
    if (unsubscribeChat) { unsubscribeChat(); unsubscribeChat = null; }
    if (chatPartnerId) {
        updateTypingStatus(false);
        if (typingTimeout) clearTimeout(typingTimeout);
    }
    chatPartnerId = null;

    const chatPanel = document.getElementById('chatPanel');
    const messagesPanel = document.getElementById('messagesPanel');
    if (chatPanel)     chatPanel.classList.remove('active');
    if (messagesPanel) messagesPanel.classList.remove('chat-open');

    history.pushState({}, '', 'messages.html');
}

// ══════════════════════════════════════════════════════════
//  initMessagesPage — now runs the full SPA layout
// ══════════════════════════════════════════════════════════
function initMessagesPage() {
    const logoutBtn     = document.getElementById('logoutBtn');
    const messageSearch = document.getElementById('messageSearch');
    const dashboardBtn  = document.getElementById('dashboardBtn');
    const backToMessages = document.getElementById('backToMessages');

    // Ensure the page has the SPA wrapper class (for CSS layout)
    const spaContainer = document.getElementById('spaContainer') || document.querySelector('.container') || document.querySelector('main');
    if (spaContainer && !spaContainer.classList.contains('spa-layout')) {
        spaContainer.classList.add('spa-layout');
    }

    showMessagesLoadingMessage();

    // Render cached threads instantly if available
    const cachedThreads = cache.get(`threads_${currentUser.uid}`);
    if (cachedThreads) {
        renderMessageThreads(cachedThreads);
        hideMessagesLoadingMessage();
    }

    // Start Firestore listener
    loadMessageThreads();

    // Set up chat input area events (same as old initChatPage, but now wired once)
    initChatInputEvents();

    // If URL already has ?id= (e.g. shared link or browser back), auto-open that chat
    const urlParams = new URLSearchParams(window.location.search);
    const partnerId = urlParams.get('id');
    if (partnerId) openChat(partnerId);

    // Browser back/forward button support
    window.addEventListener('popstate', (e) => {
        if (e.state && e.state.partnerId) {
            openChat(e.state.partnerId);
        } else {
            closeChat();
        }
    });

    // Search conversations
    if (messageSearch) {
        eventManager.addListener(messageSearch, 'input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            document.querySelectorAll('.message-card').forEach(card => {
                const name    = card.querySelector('h3')?.textContent.toLowerCase() || '';
                const message = card.querySelector('p')?.textContent.toLowerCase() || '';
                card.style.display = (name.includes(searchTerm) || message.includes(searchTerm)) ? 'flex' : 'none';
            });
        });
    }

    // Back button (mobile — slides back to list)
    if (backToMessages) {
        eventManager.addListener(backToMessages, 'click', () => closeChat());
    }

    if (logoutBtn)    eventManager.addListener(logoutBtn, 'click', handleLogout);
    if (dashboardBtn) eventManager.addListener(dashboardBtn, 'click', () => { window.location.href = 'dashboard.html'; });
}

// All the chat input / recording wiring in one place, attached once
function initChatInputEvents() {
    const messageInput           = document.getElementById('messageInput');
    const sendMessageBtn         = document.getElementById('sendMessageBtn');
    const attachmentBtn          = document.getElementById('attachmentBtn');
    const voiceNoteBtn           = document.getElementById('voiceNoteBtn');
    const videoNoteBtn           = document.getElementById('videoNoteBtn');
    const cancelVoiceNoteBtn     = document.getElementById('cancelVoiceNoteBtn');
    const sendVoiceNoteBtn       = document.getElementById('sendVoiceNoteBtn');
    const cancelVideoRecordingBtn = document.getElementById('cancelVideoRecordingBtn');
    const cancelReplyBtn         = document.getElementById('cancelReply');

    async function sendMessage() {
        if (!chatPartnerId) return;
        const message = messageInput?.value.trim();
        if (!message) return;
        const hasPoints = await deductChatPoint();
        if (!hasPoints) return;
        messageInput.value = '';
        if (sendMessageBtn) sendMessageBtn.disabled = true;
        try {
            await addMessage(message);
            cancelReply();
        } catch (error) {
            logError(error, 'sending message');
            showNotification('Error sending message. Please try again.', 'error');
        } finally {
            if (sendMessageBtn) {
                sendMessageBtn.disabled = false;
                sendMessageBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
            }
        }
    }

    if (sendMessageBtn) eventManager.addListener(sendMessageBtn, 'click', sendMessage);

    if (messageInput) {
        eventManager.addListener(messageInput, 'keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
        eventManager.addListener(messageInput, 'input', () => {
            updateTypingStatus(true);
            clearTimeout(typingTimeout);
            typingTimeout = setTimeout(() => updateTypingStatus(false), 2000);
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
                        const originalHtml = attachmentBtn.innerHTML;
                        attachmentBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                        attachmentBtn.disabled = true;
                        if (file.type.startsWith('image/')) await sendImageMessage(file);
                        else if (file.type.startsWith('video/')) {
                            const fileUrl = await uploadFileToCloudinary(file);
                            await addMessage(null, null, null, null, fileUrl, 0);
                        }
                        attachmentBtn.innerHTML = originalHtml;
                        attachmentBtn.disabled = false;
                        cancelReply();
                    } catch (error) {
                        logError(error, 'uploading file');
                        showNotification('Failed to upload file. Please check your connection.', 'error');
                        attachmentBtn.innerHTML = '<i class="fas fa-paperclip"></i>';
                        attachmentBtn.disabled = false;
                    }
                }
            });
            fileInput.click();
        });
    }

    if (voiceNoteBtn) {
        eventManager.addListener(voiceNoteBtn, 'mousedown', async (e) => {
            // Prevent the synthetic click that follows mousedown from re-triggering anything
            e.preventDefault();
            try { await startRecording(); }
            catch (error) {
                setVoiceRecordingMode(false);
                showNotification('Could not start recording. Please try again.', 'error');
            }
        });
    }

    if (cancelVoiceNoteBtn) {
        eventManager.addListener(cancelVoiceNoteBtn, 'click', (e) => {
            e.preventDefault(); e.stopPropagation();
            cancelRecording();
        });
        // Also handle pointer/touchend so the cancel responds on the very first tap
        // even if a stray document mouseup would otherwise race ahead.
        eventManager.addListener(cancelVoiceNoteBtn, 'mousedown', (e) => {
            e.preventDefault(); e.stopPropagation();
            _bbRemoveStopOnRelease();
        });
    }
    if (sendVoiceNoteBtn) {
        eventManager.addListener(sendVoiceNoteBtn, 'click', (e) => {
            e.preventDefault(); e.stopPropagation();
            sendVoiceNote();
        });
        eventManager.addListener(sendVoiceNoteBtn, 'mousedown', (e) => {
            e.preventDefault(); e.stopPropagation();
            _bbRemoveStopOnRelease();
        });
    }

    if (videoNoteBtn) {
        eventManager.addListener(videoNoteBtn, 'click', async () => {
            const hasPermission = await requestCameraPermission();
            if (hasPermission) startVideoRecording();
            else showNotification('Camera access is required to send video messages.', 'warning');
        });
    }

    if (cancelVideoRecordingBtn) eventManager.addListener(cancelVideoRecordingBtn, 'click', cancelVideoRecording);
    if (cancelReplyBtn)          eventManager.addListener(cancelReplyBtn, 'click', cancelReply);
}

// ══════════════════════════════════════════════════════════
//  initChatPage — now just redirects to the SPA
//  chat.html?id=X → messages.html?id=X
// ══════════════════════════════════════════════════════════
function initChatPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const partnerId = urlParams.get('id');
    // Replace so back button on messages page goes to previous page, not chat.html
    if (partnerId) {
        window.location.replace(`messages.html?id=${partnerId}`);
    } else {
        window.location.replace('messages.html');
    }
}

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
            snapshot.forEach(docSnap => { threads.push({ id: docSnap.id, ...docSnap.data() }); });

            threads.sort((a, b) => {
                const timeA = a.lastMessage?.timestamp?.toMillis ? a.lastMessage.timestamp.toMillis() : (new Date(a.lastMessage?.timestamp)).getTime();
                const timeB = b.lastMessage?.timestamp?.toMillis ? b.lastMessage.timestamp.toMillis() : (new Date(b.lastMessage?.timestamp)).getTime();
                return (timeB || 0) - (timeA || 0);
            });

            const threadPromises = threads.map(async (thread) => {
                const partnerId = thread.participants.find(id => id !== currentUser.uid);
                if (!partnerId) return null;
                try {
                    const [partnerSnap, messagesSnap] = await Promise.all([
                        getDoc(doc(db, 'users', partnerId)),
                        getDocs(query(
                            collection(db, 'conversations', thread.id, 'messages'),
                            where('senderId', '==', partnerId),
                            where('read', '==', false)
                        )).catch(error => { logError(error, 'getting unread count'); return { size: 0 }; })
                    ]);
                    if (!partnerSnap.exists()) return null;
                    return { ...thread, partnerData: partnerSnap.data(), unreadCount: messagesSnap.size };
                } catch (error) {
                    logError(error, 'loading thread data');
                    return null;
                }
            });

            const results = await Promise.all(threadPromises);
            const threadsWithData = results.filter(Boolean);
            const totalUnread = threadsWithData.reduce((sum, t) => sum + (t.unreadCount || 0), 0);

            cache.set(`threads_${currentUser.uid}`, threadsWithData, 'short');
            await cache.setConversations(threadsWithData);

            renderMessageThreads(threadsWithData);
            updateMessageCount(totalUnread);
            hideMessagesLoadingMessage();
        });
    } catch (error) {
        logError(error, 'loading message threads');
        if (messagesList) messagesList.innerHTML = '<p class="no-messages">Error loading messages. Please refresh the page.</p>';
        hideMessagesLoadingMessage();
    }
}

function renderMessageThreads(threads) {
    const messagesList = document.getElementById('messagesList');
    if (!messagesList) return;
    messagesList.innerHTML = '';

    if (threads.length === 0) {
        messagesList.innerHTML = '<p class="no-messages" style="padding:2rem 1.5rem;text-align:center;color:#7a8090;font-size:0.88rem;">No messages yet. Start mingling!</p>';
        return;
    }

    threads.forEach(thread => {
        const partnerId = thread.participants.find(id => id !== currentUser.uid);
        if (!partnerId || !thread.partnerData) return;

        const messageCard = document.createElement('div');
        messageCard.className = 'message-card' + (thread.unreadCount > 0 ? ' unread' : '');
        messageCard.dataset.partnerId = partnerId;
        if (chatPartnerId === partnerId) messageCard.classList.add('active');

        let messagePreview = thread.lastMessage?.text || 'New match';
        if (messagePreview.length > 38) messagePreview = messagePreview.slice(0, 38) + '…';

        // prefix icon for media types
        if (thread.lastMessage?.audioUrl) messagePreview = '🎤 Voice message';
        if (thread.lastMessage?.imageUrl) messagePreview = '📷 Photo';
        if (thread.lastMessage?.videoUrl) messagePreview = '🎥 Video';

        const messageTime = thread.lastMessage?.timestamp ? formatTime(thread.lastMessage.timestamp) : '';

        messageCard.innerHTML = `
            <div class="avatar-wrap">
                <img src="${thread.partnerData.profileImage || 'images-default-profile.jpg'}"
                     alt="${thread.partnerData.name || 'User'}"
                     onerror="this.src='images-default-profile.jpg'">
                <div class="online-dot" id="dot-${partnerId}"></div>
            </div>
            <div class="message-content">
                <div class="mc-top">
                    <span class="mc-name">${thread.partnerData.name || 'Unknown'}</span>
                    <span class="mc-time">${messageTime}</span>
                </div>
                <p class="mc-preview">${messagePreview}</p>
            </div>
            <div class="mc-right">
                ${thread.unreadCount > 0 ? `<span class="unread-count">${thread.unreadCount}</span>` : ''}
                <div class="online-status" id="status-${partnerId}" style="font-size:10px;"></div>
            </div>
        `;

        messageCard.addEventListener('click', () => { openChat(partnerId); });
        messagesList.appendChild(messageCard);
        setupOnlineStatusListener(partnerId, `status-${partnerId}`);
    });
}

function setupTypingIndicator() {
    try {
        if (!chatPartnerId) return;
        const threadId = [currentUser.uid, chatPartnerId].sort().join('_');
        const typingRef = doc(db, 'typing', threadId);

        onSnapshot(typingRef, (docSnap) => {
            const typingData = docSnap.data();
            const typingIndicator = document.getElementById('typingIndicator');
            if (typingData && typingData[chatPartnerId]) {
                const nameEl = document.getElementById('partnerNameTyping');
                const nameSource = document.getElementById('chatPartnerName');
                if (nameEl && nameSource) nameEl.textContent = nameSource.textContent;
                if (typingIndicator) typingIndicator.style.display = 'none'; // hide old indicator
                showTypingBubble(); // WhatsApp-style bubble in the chat
            } else {
                if (typingIndicator) typingIndicator.style.display = 'none';
                hideTypingBubble();
            }
        });
    } catch (error) {
        logError(error, 'setting up typing indicator');
    }
}

async function updateTypingStatus(isTyping) {
    try {
        if (!chatPartnerId || !currentUser) return;
        const threadId = [currentUser.uid, chatPartnerId].sort().join('_');
        const typingRef = doc(db, 'typing', threadId);
        await setDoc(typingRef, { [currentUser.uid]: isTyping }, { merge: true });
    } catch (error) {
        logError(error, 'updating typing status');
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
    const img  = document.getElementById('chatPartnerImage');
    const name = document.getElementById('chatPartnerName');
    if (img)  img.src = partnerData.profileImage || 'images-default-profile.jpg';
    if (name) name.textContent = partnerData.name || 'Unknown';
}

function setupOnlineStatusListener(userId, elementId = 'onlineStatus') {
    try {
        const statusRef = doc(db, 'status', userId);
        onSnapshot(statusRef, (docSnap) => {
            const statusData = docSnap.data();
            const status = statusData?.state || 'offline';
            const element = document.getElementById(elementId);
            if (element) {
                if (status === 'online') {
                    element.innerHTML = '<i class="fas fa-circle"></i>';
                    element.style.color = '#00e676';
                    element.title = 'Online';
                } else {
                    element.innerHTML = '<i class="far fa-circle"></i>';
                    element.style.color = 'var(--text-light, #7a8090)';
                    if (statusData?.lastSeen) {
                        const lastSeen = statusData.lastSeen.toDate ? statusData.lastSeen.toDate() : new Date(statusData.lastSeen);
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
        await updateDoc(messageRef, { read: true });
    } catch (error) {
        logError(error, 'marking message as read');
    }
}

// ══════════════════════════════════════════════════════════
//  Other page init functions (unchanged except bug fixes)
// ══════════════════════════════════════════════════════════

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
                const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
                if (userDoc.exists() && userDoc.data().accountDisabled) { window.location.href = 'disabled.html'; return; }
                showNotification('Login successful! Redirecting...', 'success');
                setTimeout(() => { window.location.href = 'posts.html'; }, 1500);
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
            if (password !== confirmPassword) { showNotification('Passwords do not match', 'error'); return; }
            try {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                await setDoc(doc(db, 'users', userCredential.user.uid), {
                    email, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
                    profileComplete: false, chatPoints: 20, paymentHistory: [], accountDisabled: false
                });
                showNotification('Account created successfully! Redirecting...', 'success');
                setTimeout(() => { window.location.href = 'account.html'; }, 1500);
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

    if (logoutBtn)       eventManager.addListener(logoutBtn, 'click', handleLogout);
    if (mingleBtn)       eventManager.addListener(mingleBtn, 'click', () => { window.location.href = 'mingle.html'; });
    if (messagesBtn)     eventManager.addListener(messagesBtn, 'click', () => { window.location.href = 'messages.html'; });
    if (profileBtn)      eventManager.addListener(profileBtn, 'click', () => { window.location.href = 'profile.html'; });
    if (accountBtn)      eventManager.addListener(accountBtn, 'click', () => { window.location.href = 'account.html'; });
    if (purchasePointsBtn) eventManager.addListener(purchasePointsBtn, 'click', () => { window.location.href = 'payment.html'; });
}

function initPaymentPage() {
    const logoutBtn = document.getElementById('logoutBtn');
    const backBtn = document.getElementById('backBtn');
    const planButtons = document.querySelectorAll('.plan-button');
    const paymentForm = document.getElementById('paymentForm');
    const copyBtns = document.querySelectorAll('.copy-btn');

    loadUserChatPoints();

    if (logoutBtn) eventManager.addListener(logoutBtn, 'click', handleLogout);
    if (backBtn)   eventManager.addListener(backBtn, 'click', () => { window.location.href = 'dashboard.html'; });

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
            navigator.clipboard.writeText(btn.dataset.address).then(() => {
                const originalText = btn.innerHTML;
                btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                setTimeout(() => { btn.innerHTML = originalText; }, 2000);
            });
        });
    });

    if (paymentForm) {
        eventManager.addListener(paymentForm, 'submit', async (e) => {
            e.preventDefault();
            const plan = document.getElementById('selectedPlan').value;
            const transactionId = document.getElementById('transactionId').value.trim();
            const email = document.getElementById('paymentEmail').value.trim();
            if (!plan) { showNotification('Please select a plan', 'warning'); return; }
            if (!transactionId) { showNotification('Please enter your transaction ID', 'warning'); return; }
            try {
                await updateDoc(doc(db, 'users', currentUser.uid), {
                    paymentHistory: arrayUnion({ plan, transactionId, email, status: 'pending', date: new Date().toISOString() }),
                    updatedAt: serverTimestamp()
                });
                showNotification('Payment submitted! Our team will verify and add your chat points soon.', 'success');
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
    if (isAdmin) { showAdminContent(); loadPendingPayments(); }
    else showLoginForm();

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

    function showLoginForm()   { if (loginForm) loginForm.style.display = 'block';  if (adminContent) adminContent.style.display = 'none'; }
    function showAdminContent(){ if (loginForm) loginForm.style.display = 'none';   if (adminContent) adminContent.style.display = 'block'; }

    async function loadPendingPayments() {
        try {
            const usersSnap = await getDocs(collection(db, 'users'));
            paymentList.innerHTML = '';
            for (const userDoc of usersSnap.docs) {
                const userData = userDoc.data();
                if (userData.paymentHistory) {
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
                                <button class="reject-btn"  data-user="${userDoc.id}" data-tx="${payment.transactionId}">Reject</button>
                            </div>
                        `;
                        paymentList.appendChild(paymentItem);
                    }
                }
            }

            document.querySelectorAll('.approve-btn').forEach(btn => {
                eventManager.addListener(btn, 'click', async () => {
                    try {
                        const userRef = doc(db, 'users', btn.dataset.user);
                        const userSnap = await getDoc(userRef);
                        if (userSnap.exists()) {
                            const updatedPayments = userSnap.data().paymentHistory.map(p =>
                                p.transactionId === btn.dataset.tx ? { ...p, status: 'approved' } : p
                            );
                            let pointsToAdd = 0;
                            switch (btn.dataset.plan) {
                                case '30_points': pointsToAdd = 30; break;
                                case '300_points': pointsToAdd = 300; break;
                                case 'lifetime': pointsToAdd = 9999; break;
                            }
                            await updateDoc(userRef, { paymentHistory: updatedPayments, chatPoints: (userSnap.data().chatPoints || 0) + pointsToAdd, updatedAt: serverTimestamp() });
                            showNotification('Payment approved and points added!', 'success');
                            loadPendingPayments();
                        }
                    } catch (error) { logError(error, 'approving payment'); showNotification('Error approving payment', 'error'); }
                });
            });

            document.querySelectorAll('.reject-btn').forEach(btn => {
                eventManager.addListener(btn, 'click', async () => {
                    try {
                        const userRef = doc(db, 'users', btn.dataset.user);
                        const userSnap = await getDoc(userRef);
                        if (userSnap.exists()) {
                            const updatedPayments = userSnap.data().paymentHistory.map(p =>
                                p.transactionId === btn.dataset.tx ? { ...p, status: 'rejected' } : p
                            );
                            await updateDoc(userRef, { paymentHistory: updatedPayments, updatedAt: serverTimestamp() });
                            showNotification('Payment rejected', 'success');
                            loadPendingPayments();
                        }
                    } catch (error) { logError(error, 'rejecting payment'); showNotification('Error rejecting payment', 'error'); }
                });
            });
        } catch (error) {
            logError(error, 'loading pending payments');
            paymentList.innerHTML = '<p>Error loading payments. Please try again.</p>';
        }
    }
}

function initMinglePage() {
    const logoutBtn   = document.getElementById('logoutBtn');
    const dashboardBtn = document.getElementById('dashboardBtn');
    const mingleGrid  = document.getElementById('mingleGrid');

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
    if (logoutBtn)    eventManager.addListener(logoutBtn, 'click', handleLogout);
    if (dashboardBtn) eventManager.addListener(dashboardBtn, 'click', () => { window.location.href = 'dashboard.html'; });
}

async function loadProfiles(forceRefresh = false) {
    if (!forceRefresh) {
        const cachedProfiles = await cache.getProfiles();
        if (cachedProfiles && cachedProfiles.length > 0) {
            profiles = cachedProfiles;
            shuffleProfiles();
            if (profiles.length > 0) displayProfilesGrid();
            else showNoProfilesMessage();
        }
    }
    try {
        const q = query(collection(db, 'users'), where('__name__', '!=', currentUser.uid));
        const querySnapshot = await getDocs(q);
        profiles = [];
        querySnapshot.forEach(docSnap => { profiles.push({ id: docSnap.id, ...docSnap.data() }); });
        shuffleProfiles();
        cache.set('mingle_profiles', profiles, 'short');
        await cache.setProfiles(profiles);
        if (profiles.length > 0) displayProfilesGrid();
        else showNoProfilesMessage();
    } catch (error) {
        logError(error, 'loading profiles');
        if (profiles.length === 0) showNoProfilesMessage();
    }
}

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
            <img src="${profile.profileImage || 'images-default-profile.jpg'}" alt="${profile.name || 'Profile'}" class="profile-grid-image">
            <div class="profile-grid-status" id="grid-status-${profile.id}"></div>
            <div class="profile-grid-content">
                <h3 class="profile-grid-name">${profile.name || 'Unknown'}</h3>
                <p class="profile-grid-details">${ageLocation}</p>
                <p class="profile-grid-bio">${profile.bio || 'No bio available'}</p>
                <div class="profile-grid-actions">
                    <div class="profile-grid-likes"><i class="fas fa-heart"></i><span>${profile.likes || 0}</span></div>
                    <button class="profile-grid-like-btn" data-profile-id="${profile.id}"><i class="fas fa-heart"></i> Like</button>
                </div>
            </div>
        `;
        const profileImage = profileCard.querySelector('.profile-grid-image');
        profileImage.style.cursor = 'pointer';
        eventManager.addListener(profileImage, 'click', () => { window.location.href = `profile.html?id=${profile.id}`; });
        const likeBtn = profileCard.querySelector('.profile-grid-like-btn');
        eventManager.addListener(likeBtn, 'click', async (e) => { e.stopPropagation(); await handleGridLike(profile.id, likeBtn); });
        mingleGrid.appendChild(profileCard);
        setupOnlineStatusListener(profile.id, `grid-status-${profile.id}`);
    });
}

async function handleGridLike(profileId, likeButton) {
    if (!currentUser) { showNotification('Please log in to like profiles', 'error'); return; }
    try {
        const likedRef = collection(db, 'users', currentUser.uid, 'liked');
        const likedQuery = query(likedRef, where('userId', '==', profileId));
        const likedSnap = await getDocs(likedQuery);
        if (!likedSnap.empty) { showNotification('You already liked this profile!', 'info'); return; }

        await addDoc(likedRef, { userId: profileId, timestamp: serverTimestamp(), likedAt: new Date().toISOString() });

        const profileRef = doc(db, 'users', profileId);
        const profileSnap = await getDoc(profileRef);
        if (profileSnap.exists()) {
            const currentLikes = profileSnap.data().likes || 0;
            await updateDoc(profileRef, { likes: currentLikes + 1, updatedAt: serverTimestamp() });
            const likesElement = likeButton.parentElement.querySelector('.profile-grid-likes span');
            if (likesElement) likesElement.textContent = currentLikes + 1;
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
    if (mingleGrid) mingleGrid.innerHTML = '<div class="no-profiles-message">No profiles found. Check back later for new profiles.</div>';
}

function initProfilePage() {
    const logoutBtn   = document.getElementById('logoutBtn');
    const dashboardBtn = document.getElementById('dashboardBtn');
    const thumbnails  = document.querySelectorAll('.thumbnail');

    const urlParams = new URLSearchParams(window.location.search);
    const profileId = urlParams.get('id');
    window.currentProfileId = profileId;

    if (profileId) loadProfileData(profileId);
    else {
        showNotification('No profile selected', 'error');
        setTimeout(() => { window.location.href = 'mingle.html'; }, 2000);
        return;
    }

    thumbnails.forEach(thumbnail => {
        eventManager.addListener(thumbnail, 'click', () => {
            thumbnails.forEach(t => t.classList.remove('active'));
            thumbnail.classList.add('active');
            document.getElementById('mainProfileImage').src = thumbnail.src;
        });
    });

    if (dashboardBtn) {
        eventManager.addListener(dashboardBtn, 'click', (e) => {
            e.preventDefault(); e.stopPropagation();
            window.location.href = 'dashboard.html';
        });
    }
}

async function loadProfileData(profileId) {
    const cachedProfile = cache.get(`profile_${profileId}`);
    if (cachedProfile) displayProfileData(cachedProfile);

    try {
        const profileRef = doc(db, 'users', profileId);
        const profileSnap = await getDoc(profileRef);
        if (profileSnap.exists()) {
            const profileData = profileSnap.data();
            cache.set(`profile_${profileId}`, profileData, 'medium');
            displayProfileData(profileData);

            const likedSnap = await getDocs(query(collection(db, 'users', currentUser.uid, 'liked'), where('userId', '==', profileId)));
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
    document.getElementById('viewProfileName').textContent = profileData.name || 'Unknown';
    document.getElementById('viewProfileAge').textContent = profileData.age ? `${profileData.age}` : '';
    document.getElementById('viewProfileLocation').textContent = profileData.location || '';

    const thumbnail1 = document.getElementById('thumbnail1');
    if (thumbnail1) thumbnail1.src = profileData.profileImage || 'images-default-profile.jpg';

    const interestsContainer = document.getElementById('interestsContainer');
    if (interestsContainer) {
        interestsContainer.innerHTML = '';
        if (profileData.interests && profileData.interests.length > 0) {
            profileData.interests.forEach(interest => {
                const interestTag = document.createElement('span');
                interestTag.className = 'interest-tag';
                interestTag.textContent = interest;
                interestsContainer.appendChild(interestTag);
            });
        }
    }
}

function initAccountPage() {
    const profileImageUpload = document.getElementById('profileImageUpload');
    const removeProfileImage = document.getElementById('removeProfileImage');
    const accountMenuItems   = document.querySelectorAll('.menu-item');
    const addInterestBtn     = document.getElementById('addInterestBtn');
    const profileForm        = document.getElementById('profileForm');
    const settingsForm       = document.getElementById('settingsForm');
    const privacyForm        = document.getElementById('privacyForm');
    const logoutBtn          = document.getElementById('logoutBtn');
    const dashboardBtn       = document.getElementById('dashboardBtn');

    accountMenuItems.forEach(item => {
        eventManager.addListener(item, 'click', () => {
            accountMenuItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            document.querySelectorAll('.account-section').forEach(section => { section.style.display = 'none'; });
            const sectionEl = document.getElementById(`${item.dataset.section}Section`);
            if (sectionEl) sectionEl.style.display = 'block';
        });
    });

    if (profileImageUpload) {
        eventManager.addListener(profileImageUpload, 'change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    const imageUrl = await uploadImageToCloudinary(file);
                    await updateDoc(doc(db, 'users', currentUser.uid), { profileImage: imageUrl, updatedAt: serverTimestamp() });
                    document.getElementById('accountProfileImage').src = imageUrl;
                } catch (error) {
                    logError(error, 'uploading profile image');
                    showNotification('Failed to upload image. Please check your connection.', 'error');
                }
            }
        });
    }

    if (removeProfileImage) {
        eventManager.addListener(removeProfileImage, 'click', async () => {
            try {
                await updateDoc(doc(db, 'users', currentUser.uid), { profileImage: null, updatedAt: serverTimestamp() });
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
                const container = document.getElementById('accountInterestsContainer');
                if (container.querySelectorAll('.interest-tag').length >= 10) {
                    showNotification('Maximum 10 interests allowed', 'warning');
                    return;
                }
                const interestTag = document.createElement('span');
                interestTag.className = 'interest-tag';
                interestTag.textContent = interest;
                const removeBtn = document.createElement('span');
                removeBtn.innerHTML = ' &times;';
                removeBtn.style.cursor = 'pointer';
                removeBtn.addEventListener('click', () => interestTag.remove());
                interestTag.appendChild(removeBtn);
                container.appendChild(interestTag);
                interestInput.value = '';
            }
        });
    }

    if (profileForm) {
        eventManager.addListener(profileForm, 'submit', async (e) => {
            e.preventDefault();
            const name     = document.getElementById('accountName').value;
            const age      = document.getElementById('accountAge').value;
            const gender   = document.getElementById('accountGender').value;
            const location = document.getElementById('accountLocation').value;
            const bio      = document.getElementById('accountBio').value;
            const phone    = document.getElementById('accountPhone').value;
            const interests = Array.from(document.getElementById('accountInterestsContainer').querySelectorAll('.interest-tag'))
                .map(tag => tag.textContent.replace(' ×', '').trim());
            try {
                await updateDoc(doc(db, 'users', currentUser.uid), { name, age: parseInt(age), gender, location, bio, phone: phone || null, interests, profileComplete: true, updatedAt: serverTimestamp() });
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
            const newPassword = document.getElementById('newPassword').value;
            const confirmNewPassword = document.getElementById('confirmNewPassword').value;
            if (newPassword !== confirmNewPassword) { showNotification('New passwords do not match', 'error'); return; }
            showNotification('Settings updated successfully!', 'success');
            settingsForm.reset();
        });
    }

    if (privacyForm) {
        eventManager.addListener(privacyForm, 'submit', async (e) => {
            e.preventDefault();
            try {
                await updateDoc(doc(db, 'users', currentUser.uid), {
                    privacySettings: {
                        showAge: document.getElementById('showAge').checked,
                        showLocation: document.getElementById('showLocation').checked,
                        showOnlineStatus: document.getElementById('showOnlineStatus').checked
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

    if (logoutBtn)    eventManager.addListener(logoutBtn, 'click', handleLogout);
    if (dashboardBtn) eventManager.addListener(dashboardBtn, 'click', () => { window.location.href = 'dashboard.html'; });

    loadUserData(currentUser.uid);
}

async function loadUserData(userId) {
    const cachedData = cache.get(`user_${userId}`);
    if (cachedData) { updateAccountPage(cachedData); return cachedData; }
    try {
        const userSnap = await getDoc(doc(db, 'users', userId));
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
    const fields = ['accountName', 'accountAge', 'accountGender', 'accountLocation', 'accountBio', 'accountEmail', 'accountPhone'];
    const values = [userData.name, userData.age, userData.gender, userData.location, userData.bio, userData.email, userData.phone];
    fields.forEach((id, i) => {
        const el = document.getElementById(id);
        if (el) el.value = values[i] || '';
    });
    if (userData.profileImage) document.getElementById('accountProfileImage').src = userData.profileImage;

    const container = document.getElementById('accountInterestsContainer');
    if (container) {
        container.innerHTML = '';
        (userData.interests || []).forEach(interest => {
            const tag = document.createElement('span');
            tag.className = 'interest-tag';
            tag.textContent = interest;
            const removeBtn = document.createElement('span');
            removeBtn.innerHTML = ' &times;';
            removeBtn.style.cursor = 'pointer';
            removeBtn.addEventListener('click', () => tag.remove());
            tag.appendChild(removeBtn);
            container.appendChild(tag);
        });
    }

    if (userData.privacySettings) {
        const el1 = document.getElementById('showAge');
        const el2 = document.getElementById('showLocation');
        const el3 = document.getElementById('showOnlineStatus');
        if (el1) el1.checked = userData.privacySettings.showAge !== false;
        if (el2) el2.checked = userData.privacySettings.showLocation !== false;
        if (el3) el3.checked = userData.privacySettings.showOnlineStatus !== false;
    }
}

window.addEventListener('beforeunload', () => {
    try {
        if (unsubscribeMessages) { unsubscribeMessages(); unsubscribeMessages = null; }
        cleanupChatPage();
        if (globalMessageListener) { globalMessageListener(); globalMessageListener = null; }
        eventManager.clearAll();
        optimisticUpdates.cleanupOldUpdates();
        if (currentUser && currentUser.uid && auth.currentUser) {
            setDoc(doc(db, 'status', currentUser.uid), {
                state: 'offline',
                lastChanged: serverTimestamp(),
                lastSeen: serverTimestamp()
            }).catch(error => console.error('Error setting offline status:', error));
        }
    } catch (error) {
        logError(error, 'beforeunload cleanup');
    }
});
