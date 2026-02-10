// groups.js - Enhanced with IndexedDB caching and instant loading - FIXED VERSION

import { 
    getFirestore, 
    collection, 
    doc,
    getDoc,
    setDoc,
    updateDoc,
    query, 
    getDocs,
    orderBy,
    increment,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { 
    getAuth, 
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

// Use the SAME Firebase config as your gamers.js
const firebaseConfig = {
    apiKey: "AIzaSyC9jF-ocy6HjsVzWVVlAyXW-4aIFgA79-A",
    authDomain: "crypto-6517d.firebaseapp.com",
    projectId: "crypto-6517d",
    storageBucket: "crypto-6517d.firebasestorage.app",
    messagingSenderId: "60263975159",
    appId: "1:60263975159:web:bd53dcaad86d6ed9592bf2"
};

// ==================== INDEXEDDB CACHE SYSTEM FOR GROUPS ====================
class GroupsIndexedDBCache {
    constructor() {
        this.dbName = 'GroupsAppDB'; // CHANGED: Different database name for groups
        this.dbVersion = 1; // Start fresh with version 1
        this.db = null;
        this.initialized = false;
    }

    async init() {
        if (this.initialized && this.db) return this.db;
        
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = (event) => {
                console.error('IndexedDB open error for groups:', event.target.error);
                reject(event.target.error);
            };
            
            request.onsuccess = (event) => {
                this.db = event.target.result;
                this.initialized = true;
                console.log('Groups IndexedDB initialized successfully');
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                console.log('Groups IndexedDB upgrade needed, version:', event.newVersion);
                const db = event.target.result;
                
                // Create object stores for groups
                if (!db.objectStoreNames.contains('groups')) {
                    const groupsStore = db.createObjectStore('groups', { keyPath: 'id' });
                    groupsStore.createIndex('lastUpdated', 'lastUpdated', { unique: false });
                    groupsStore.createIndex('lastActivity', 'lastActivity', { unique: false });
                    groupsStore.createIndex('category', 'category', { unique: false });
                    console.log('Created groups store');
                }
                
                if (!db.objectStoreNames.contains('groupUserProfiles')) {
                    db.createObjectStore('groupUserProfiles', { keyPath: 'userId' });
                    console.log('Created groupUserProfiles store');
                }
                
                if (!db.objectStoreNames.contains('groupMembership')) {
                    const membershipStore = db.createObjectStore('groupMembership', { keyPath: 'id' });
                    membershipStore.createIndex('userId_groupId', ['userId', 'groupId'], { unique: true });
                    console.log('Created groupMembership store');
                }
            };
        });
    }

    async set(storeName, data) {
        try {
            if (!this.db) await this.init();
            
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                
                const itemToStore = {
                    ...data,
                    lastUpdated: Date.now()
                };
                
                const request = store.put(itemToStore);
                
                request.onerror = (event) => {
                    console.error(`Error storing in ${storeName}:`, event.target.error);
                    reject(event.target.error);
                };
                
                request.onsuccess = () => {
                    resolve(request.result);
                };
            });
        } catch (error) {
            console.error('Error in set method:', error);
            throw error;
        }
    }

    async get(storeName, key) {
        try {
            if (!this.db) await this.init();
            
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([storeName], 'readonly');
                const store = transaction.objectStore(storeName);
                const request = store.get(key);
                
                request.onerror = (event) => reject(event.target.error);
                request.onsuccess = () => {
                    const result = request.result;
                    // Check if data is expired (10 minutes for groups)
                    if (result && Date.now() - result.lastUpdated < 10 * 60 * 1000) {
                        resolve(result);
                    } else {
                        resolve(null);
                    }
                };
            });
        } catch (error) {
            console.error('Error in get method:', error);
            return null;
        }
    }

    async getAll(storeName) {
        try {
            if (!this.db) await this.init();
            
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([storeName], 'readonly');
                const store = transaction.objectStore(storeName);
                const request = store.getAll();
                
                request.onerror = (event) => reject(event.target.error);
                request.onsuccess = () => {
                    const results = request.result || [];
                    // Filter out expired items (10 minutes for groups)
                    const validResults = results.filter(item => {
                        if (!item || !item.lastUpdated) return false;
                        return Date.now() - item.lastUpdated < 10 * 60 * 1000;
                    });
                    resolve(validResults);
                };
            });
        } catch (error) {
            console.error('Error in getAll method:', error);
            return [];
        }
    }

    async setGroups(groups) {
        try {
            await this.init();
            
            // Add new groups in batches to avoid transaction issues
            const batchSize = 10;
            for (let i = 0; i < groups.length; i += batchSize) {
                const batch = groups.slice(i, i + batchSize);
                await Promise.all(
                    batch.map(group => this.set('groups', group))
                );
            }
            
            console.log(`✅ Cached ${groups.length} groups in Groups IndexedDB`);
        } catch (error) {
            console.error('Error caching groups:', error);
        }
    }

    async getGroups() {
        try {
            const allGroups = await this.getAll('groups');
            return allGroups.map(group => {
                const { lastUpdated, ...groupData } = group;
                return groupData;
            });
        } catch (error) {
            console.error('Error getting groups from cache:', error);
            return [];
        }
    }

    async getUserProfile(userId) {
        return this.get('groupUserProfiles', userId);
    }

    async setUserProfile(userId, profile) {
        return this.set('groupUserProfiles', { userId, ...profile });
    }
}

// ==================== INSTANT LOADING SYSTEM ====================
class GroupsInstantLoadingSystem {
    constructor() {
        this.appData = {
            groups: [],
            userProfiles: {},
            userMembership: {}
        };
        this.isInitialized = false;
        this.initPromise = null;
        this.hasRenderedFromCache = false;
        this.currentUserId = null;
        this.isRefreshing = false;
        
        // Initialize cache system
        this.cache = new GroupsIndexedDBCache();
    }

    async initialize() {
        if (this.initPromise) return this.initPromise;
        
        this.initPromise = new Promise(async (resolve) => {
            console.log('🚀 Starting instant preload for groups...');
            
            const preloadStartTime = Date.now();
            
            try {
                // Initialize cache
                await this.cache.init();
                
                // Load cached groups
                const cachedGroups = await this.cache.getGroups();
                this.appData.groups = cachedGroups;
                
                console.log(`⚡ Instant loaded ${this.appData.groups.length} groups from cache in ${Date.now() - preloadStartTime}ms`);
                
            } catch (error) {
                console.error('Instant load error:', error);
                this.appData.groups = [];
            }
            
            this.isInitialized = true;
            resolve(this.appData);
        });
        
        return this.initPromise;
    }

    renderInstantly() {
        if (this.hasRenderedFromCache) return;
        
        const groupsGridElement = document.getElementById('groupsGrid');
        if (!groupsGridElement) {
            console.error('Cannot find #groupsGrid element');
            return;
        }
        
        console.log(`🔄 Attempting to render ${this.appData.groups.length} cached groups...`);
        
        if (this.appData.groups.length > 0) {
            console.log('⚡ Rendering groups instantly from cache...');
            this.hasRenderedFromCache = true;
            
            // Clear any existing content
            groupsGridElement.innerHTML = '';
            
            // Show cached data immediately
            const groups = this.appData.groups.slice(0, 12); // Show first 12 for instant load
            
            groups.forEach(group => {
                const card = this.createGroupCard(group);
                if (card) {
                    groupsGridElement.appendChild(card);
                }
            });
            
            // Setup event listeners
            setTimeout(() => this.setupGroupCardListeners(), 100);
            
            console.log(`✅ Groups instant render complete (${groups.length} groups)`);
        } else {
            // Show loading state that matches your theme
            console.log('No cached groups, showing loading...');
            this.showLoading();
        }
    }

    showLoading() {
        const groupsGridElement = document.getElementById('groupsGrid');
        if (!groupsGridElement) return;
        
        // Use your existing loading styles
        groupsGridElement.innerHTML = `
            <div class="loading-card">
                <div class="loading-avatar"></div>
                <div class="loading-content">
                    <div class="loading-line" style="width: 60%"></div>
                    <div class="loading-line" style="width: 80%"></div>
                    <div class="loading-line" style="width: 70%"></div>
                    <div class="loading-line" style="width: 50%"></div>
                </div>
            </div>
            <div class="loading-card">
                <div class="loading-avatar"></div>
                <div class="loading-content">
                    <div class="loading-line" style="width: 60%"></div>
                    <div class="loading-line" style="width: 80%"></div>
                    <div class="loading-line" style="width: 70%"></div>
                    <div class="loading-line" style="width: 50%"></div>
                </div>
            </div>
            <div class="loading-card">
                <div class="loading-avatar"></div>
                <div class="loading-content">
                    <div class="loading-line" style="width: 60%"></div>
                    <div class="loading-line" style="width: 80%"></div>
                    <div class="loading-line" style="width: 70%"></div>
                    <div class="loading-line" style="width: 50%"></div>
                </div>
            </div>
        `;
    }

    startBackgroundRefresh() {
        // If we have no cached data, fetch immediately
        if (this.appData.groups.length === 0) {
            console.log('No cached data, fetching immediately...');
            setTimeout(async () => {
                await this.refreshGroups(false); // Non-silent refresh
            }, 100);
        } else {
            // Wait 1 second before first refresh if we have cached data
            setTimeout(async () => {
                await this.refreshGroups(true); // Silent refresh
            }, 1000);
        }
        
        // Schedule periodic refresh every 60 seconds
        setInterval(async () => {
            if (document.visibilityState === 'visible' && this.isOnline() && !this.isRefreshing) {
                await this.refreshGroups(true);
            }
        }, 60000);
    }

    async refreshGroups(silent = false) {
        if (this.isRefreshing) return;
        
        this.isRefreshing = true;
        try {
            console.log('🔄 Refreshing groups...');
            
            if (!silent && !this.hasRenderedFromCache) {
                this.showLoading();
            }
            
            const groups = await this.fetchFreshGroups();
            
            // Update in-memory cache
            this.appData.groups = groups;
            
            // Cache in IndexedDB
            await this.cache.setGroups(groups);
            
            // Update UI
            if (!silent) {
                this.renderGroups(groups);
            } else if (this.hasRenderedFromCache) {
                this.smoothUpdateGroups(groups);
            } else {
                // If we haven't rendered yet and this is a silent refresh, render now
                this.renderGroups(groups);
                this.hasRenderedFromCache = true;
            }
            
        } catch (error) {
            console.error('Error refreshing groups:', error);
            if (!silent) {
                this.showError('Failed to refresh groups. Using cached data.');
            }
        } finally {
            this.isRefreshing = false;
        }
    }

    async fetchFreshGroups() {
        console.log('🐱 Fetching fresh groups from Firestore');
        
        // Check if Firebase is initialized
        if (!window.firebaseApp) {
            console.error('Firebase not initialized');
            throw new Error('Firebase not initialized');
        }
        
        const db = getFirestore(window.firebaseApp);
        const groupsRef = collection(db, 'groups');
        const q = query(groupsRef, orderBy('lastActivity', 'desc'));
        const querySnapshot = await getDocs(q);
        
        const groups = [];
        querySnapshot.forEach(doc => {
            try {
                const data = doc.data();
                const group = { 
                    id: doc.id, 
                    ...data,
                    // Handle Firebase timestamps
                    createdAt: data.createdAt?.toDate?.() || data.createdAt || new Date(),
                    updatedAt: data.updatedAt?.toDate?.() || data.updatedAt || new Date(),
                    lastActivity: data.lastActivity?.toDate?.() || data.lastActivity || new Date()
                };
                groups.push(group);
            } catch (error) {
                console.error('Error processing group:', doc.id, error);
            }
        });
        
        console.log(`✅ Loaded ${groups.length} fresh groups from Firebase`);
        return groups;
    }

    createGroupCard(group) {
        try {
            const groupCard = document.createElement('div');
            groupCard.className = 'group-card';
            groupCard.dataset.groupId = group.id;
            
            const avatar = this.generateGroupAvatar(group);
            
            // Format member count
            const memberCount = group.memberCount || 0;
            const maxMembers = group.maxMembers || 1000;
            
            // Get privacy icon and color
            const isPrivate = group.privacy === 'private';
            
            groupCard.innerHTML = `
                <div class="group-header">
                    <div class="group-avatar-section">
                        <img src="${avatar}" alt="${group.name}" class="group-avatar" 
                             onerror="this.onerror=null; this.src='https://api.dicebear.com/7.x/avataaars/svg?seed=group';">
                        <div class="group-title-section">
                            <h3 class="group-name">${group.name}</h3>
                            <span class="group-category">${group.category || 'General'}</span>
                        </div>
                    </div>
                    <p class="group-description">${group.description || 'No description available'}</p>
                    <div class="group-meta">
                        <span class="group-members" title="${memberCount} members">
                            <svg class="feather" style="width: 14px; height: 14px; margin-right: 4px;">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                <circle cx="9" cy="7" r="4"></circle>
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                            </svg>
                            ${memberCount} / ${maxMembers}
                        </span>
                        <span class="group-privacy" title="${isPrivate ? 'Private Group' : 'Public Group'}">
                            <svg class="feather" style="width: 14px; height: 14px; margin-right: 4px;">
                                ${isPrivate ? 
                                    '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>' : 
                                    '<circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>'
                                }
                            </svg>
                            ${isPrivate ? 'Private' : 'Public'}
                        </span>
                    </div>
                </div>
                ${group.topics && group.topics.length > 0 ? `
                    <div class="group-content">
                        <div class="group-topics">
                            <h4 class="section-title">Discussion Topics</h4>
                            <div class="topics-list">
                                ${group.topics.slice(0, 3).map(topic => 
                                    `<span class="topic-tag">${topic}</span>`
                                ).join('')}
                                ${group.topics.length > 3 ? 
                                    `<span class="topic-tag">+${group.topics.length - 3} more</span>` : ''
                                }
                            </div>
                        </div>
                    </div>
                ` : ''}
                <div class="group-actions">
                    <button class="join-btn" data-group-id="${group.id}">
                        Join Group
                    </button>
                </div>
            `;
            
            return groupCard;
        } catch (error) {
            console.error('Error creating group card:', error);
            return null;
        }
    }

    generateGroupAvatar(group) {
        if (group.photoUrl) {
            return group.photoUrl;
        }
        const seed = encodeURIComponent(group.name);
        return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&backgroundColor=00897b,00acc1,039be5,1e88e5,3949ab,43a047,5e35b1,7cb342,8e24aa,c0ca33,d81b60,e53935,f4511e,fb8c00,fdd835,ffb300,ffd5dc,ffdfbf,c0aede,d1d4f9,b6e3f4&backgroundType=gradientLinear`;
    }

    renderGroups(groups) {
        const groupsGridElement = document.getElementById('groupsGrid');
        if (!groupsGridElement) return;
        
        if (groups.length === 0) {
            groupsGridElement.innerHTML = this.getEmptyStateHTML();
            return;
        }
        
        groupsGridElement.innerHTML = '';
        groups.slice(0, 50).forEach(group => { // Limit to 50 groups for performance
            const card = this.createGroupCard(group);
            if (card) {
                groupsGridElement.appendChild(card);
            }
        });
        
        this.setupGroupCardListeners();
    }

    smoothUpdateGroups(newGroups) {
        const groupsGridElement = document.getElementById('groupsGrid');
        if (!groupsGridElement) return;
        
        // Get existing group cards
        const existingItems = Array.from(groupsGridElement.children);
        const updatedIds = new Set(newGroups.slice(0, 50).map(g => g.id));
        
        // Remove items that are no longer in the list
        existingItems.forEach(item => {
            const groupId = item.dataset.groupId;
            if (groupId && !updatedIds.has(groupId)) {
                item.remove();
            }
        });
        
        // Update or add items (limit to first 50)
        newGroups.slice(0, 50).forEach((group, index) => {
            const existingItem = groupsGridElement.querySelector(`[data-group-id="${group.id}"]`);
            if (existingItem) {
                // Check if needs update
                const currentMemberCount = existingItem.querySelector('.group-members')?.textContent;
                const newMemberCount = `${group.memberCount || 0} / ${group.maxMembers || 1000}`;
                
                if (currentMemberCount !== newMemberCount) {
                    const newItem = this.createGroupCard(group);
                    if (newItem) {
                        existingItem.replaceWith(newItem);
                    }
                }
            } else {
                // Add new item
                const newItem = this.createGroupCard(group);
                if (newItem) {
                    if (index === 0) {
                        groupsGridElement.prepend(newItem);
                    } else {
                        groupsGridElement.appendChild(newItem);
                    }
                }
            }
        });
        
        this.setupGroupCardListeners();
    }

    setupGroupCardListeners() {
        // Remove existing listeners to avoid duplicates
        document.querySelectorAll('.join-btn').forEach(btn => {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
        });
        
        // Add new listeners
        document.querySelectorAll('.join-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleJoinGroup(e);
            });
        });
    }

    async handleJoinGroup(e) {
        const button = e.target.closest('.join-btn') || e.target;
        const groupId = button.dataset.groupId;
        
        if (!groupId) {
            console.error('No group ID found on button');
            return;
        }
        
        console.log('Join button clicked for group:', groupId);
        
        // Get current user from Firebase auth
        if (!window.firebaseApp) {
            this.showNotification('System not ready. Please try again.', 'error');
            return;
        }
        
        const auth = getAuth(window.firebaseApp);
        const user = auth.currentUser;
        
        if (!user) {
            this.showNotification('Please login to join groups', 'warning');
            window.location.href = 'login.html';
            return;
        }
        
        // Set current user ID
        this.currentUserId = user.uid;
        
        // Check if user profile is complete
        const userProfile = await this.cache.getUserProfile(user.uid);
        const needsSetup = !userProfile || !userProfile.displayName || !userProfile.avatar;
        
        if (needsSetup) {
            this.showNotification('Please complete your profile first', 'warning');
            window.location.href = `set.html?id=${groupId}`;
            return;
        }
        
        try {
            const originalText = button.innerHTML;
            
            button.disabled = true;
            button.innerHTML = 'Joining...';
            
            // Call the global join function
            await window.joinGroup(groupId);
            
            button.innerHTML = 'Joined!';
            button.className = 'join-btn success';
            button.disabled = true;
            
            console.log('Group joined successfully, redirecting...');
            setTimeout(() => {
                window.location.href = `group.html?id=${groupId}`;
            }, 1000);
            
        } catch (error) {
            console.error('Error joining group:', error);
            button.disabled = false;
            button.innerHTML = 'Join Group';
            this.showNotification(error.message || 'Failed to join group. Please try again.', 'error');
        }
    }

    getEmptyStateHTML() {
        return `
            <div class="no-groups">
                <svg class="feather" style="width: 48px; height: 48px; margin-bottom: 16px;">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
                <h3>No Groups Found</h3>
                <p>Be the first to create a group!</p>
                <button id="createFirstGroupBtn" class="primary-btn" style="margin-top: 16px;">
                    Create Your First Group
                </button>
            </div>
        `;
    }

    showError(message) {
        const groupsGridElement = document.getElementById('groupsGrid');
        if (!groupsGridElement) return;
        
        groupsGridElement.innerHTML = `
            <div class="error-state">
                <svg class="feather" style="width: 48px; height: 48px; margin-bottom: 16px;">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <h3>Error Loading Groups</h3>
                <p>${message}</p>
                <button onclick="window.location.reload()" class="primary-btn" style="margin-top: 16px;">
                    Try Again
                </button>
                <button onclick="window.location.href='index.html'" class="secondary-btn" style="margin-top: 8px;">
                    Go Home
                </button>
            </div>
        `;
    }

    showNotification(message, type = 'info') {
        // Use existing notification system if available
        if (window.showNotification) {
            window.showNotification(message, type);
            return;
        }
        
        // Simple fallback notification
        const existingNotifications = document.querySelectorAll('.custom-notification');
        existingNotifications.forEach(notification => notification.remove());
        
        const notification = document.createElement('div');
        notification.className = `custom-notification ${type}`;
        
        notification.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            background: ${type === 'error' ? '#dc2626' : type === 'success' ? '#16a34a' : '#3b82f6'};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 10000;
        `;
        
        notification.innerHTML = `<span>${message}</span>`;
        document.body.appendChild(notification);
        
        setTimeout(() => notification.remove(), 3000);
    }

    setCurrentUserId(userId) {
        this.currentUserId = userId;
    }

    isOnline() {
        return navigator.onLine;
    }
}

// ==================== GLOBAL FIREBASE INITIALIZATION ====================
// Check if Firebase is already initialized (by gamers.js)
if (!window.firebaseApp) {
    try {
        console.log('Initializing Firebase for groups...');
        window.firebaseApp = initializeApp(firebaseConfig);
        console.log('Firebase initialized successfully');
    } catch (error) {
        console.error('Firebase initialization failed:', error);
    }
} else {
    console.log('Firebase already initialized, using existing app');
}

// ==================== MAIN GROUPS MANAGER ====================
class GroupsManager {
    constructor() {
        this.firebaseUser = null;
        this.currentUser = null;
        this.groupsLoader = new GroupsInstantLoadingSystem();
        this.setupAuthListener();
    }

    setupAuthListener() {
        if (!window.firebaseApp) {
            console.error('Cannot setup auth listener: Firebase not initialized');
            return;
        }
        
        const auth = getAuth(window.firebaseApp);
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                this.firebaseUser = user;
                console.log('User authenticated:', user.uid);
                this.groupsLoader.setCurrentUserId(user.uid);
                await this.loadUserProfile(user.uid);
                this.initializePage();
            } else {
                this.firebaseUser = null;
                this.currentUser = null;
                this.groupsLoader.setCurrentUserId(null);
                console.log('User logged out');
                const currentPage = window.location.pathname.split('/').pop();
                if (currentPage === 'groups.html') {
                    window.location.href = 'login.html';
                }
            }
        }, (error) => {
            console.error('Auth state change error:', error);
        });
    }

    async loadUserProfile(userId) {
        try {
            console.log('Loading user profile for:', userId);
            
            // Try to load from cache first
            const cachedProfile = await this.groupsLoader.cache.getUserProfile(userId);
            if (cachedProfile) {
                this.currentUser = {
                    id: userId,
                    name: cachedProfile.displayName || 'User',
                    avatar: cachedProfile.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=user1',
                    bio: cachedProfile.bio || 'No bio available.',
                    email: cachedProfile.email || '',
                    profileComplete: cachedProfile.displayName && cachedProfile.avatar ? true : false
                };
                console.log('User profile loaded from cache:', this.currentUser.name);
                return;
            }
            
            // Load from Firestore
            if (!window.firebaseApp) {
                console.error('Firebase not initialized for user profile');
                return;
            }
            
            const db = getFirestore(window.firebaseApp);
            const userRef = doc(db, 'group_users', userId);
            const userSnap = await getDoc(userRef);
            
            if (userSnap.exists()) {
                const userData = userSnap.data();
                this.currentUser = {
                    id: userId,
                    name: userData.displayName || 'User',
                    avatar: userData.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=user1',
                    bio: userData.bio || 'No bio available.',
                    email: userData.email || '',
                    profileComplete: userData.displayName && userData.avatar ? true : false
                };
                
                // Cache the profile
                await this.groupsLoader.cache.setUserProfile(userId, userData);
                console.log('User profile loaded from Firestore:', this.currentUser.name);
            } else {
                this.currentUser = {
                    id: userId,
                    name: this.firebaseUser.email.split('@')[0] || 'User',
                    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=user1',
                    bio: '',
                    email: this.firebaseUser.email,
                    profileComplete: false
                };
                console.log('New user profile created');
            }
        } catch (error) {
            console.error('Error loading user profile:', error);
        }
    }

    async needsProfileSetup() {
        if (!this.firebaseUser) return false;
        
        if (this.currentUser?.profileComplete) {
            return false;
        }
        
        return true; // Always check on join
    }

    initializePage() {
        const currentPage = window.location.pathname.split('/').pop();
        if (currentPage === 'groups.html') {
            console.log('Initializing groups page');
            initGroupsPage();
        }
    }
}

// Global join function
window.joinGroup = async function(groupId) {
    if (!window.firebaseApp) {
        throw new Error('Firebase not initialized');
    }
    
    const auth = getAuth(window.firebaseApp);
    const user = auth.currentUser;
    
    if (!user) {
        throw new Error('You must be logged in to join a group');
    }
    
    const db = getFirestore(window.firebaseApp);
    
    // Get user profile
    const userRef = doc(db, 'group_users', user.uid);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
        throw new Error('Please complete your profile first');
    }
    
    const userData = userSnap.data();
    
    // Check group
    const groupRef = doc(db, 'groups', groupId);
    const groupSnap = await getDoc(groupRef);
    
    if (!groupSnap.exists()) {
        throw new Error('Group not found');
    }
    
    const group = groupSnap.data();
    
    // Check if already a member
    const memberRef = doc(db, 'groups', groupId, 'members', user.uid);
    const memberSnap = await getDoc(memberRef);
    if (memberSnap.exists()) {
        return true; // Already a member
    }
    
    if (group.memberCount >= group.maxMembers) {
        throw new Error('Group is full');
    }
    
    const role = group.createdBy === user.uid ? 'creator' : 'member';
    
    const memberData = {
        id: user.uid,
        name: userData.displayName,
        avatar: userData.avatar,
        bio: userData.bio || '',
        role: role,
        joinedAt: serverTimestamp(),
        lastActive: serverTimestamp()
    };
    
    await setDoc(memberRef, memberData);
    
    await updateDoc(groupRef, {
        memberCount: increment(1),
        updatedAt: serverTimestamp(),
        lastActivity: serverTimestamp()
    });
    
    console.log(`Successfully joined group: ${group.name}`);
    return true;
};

// Create global instance
const groupsManager = new GroupsManager();

// ==================== PAGE INITIALIZATION ====================
async function initGroupsPage() {
    console.log('initGroupsPage called');
    
    const createGroupBtn = document.getElementById('createGroupBtn');
    const searchInput = document.getElementById('groupSearch');
    
    // Start instant loading (but wait for auth to be ready)
    await groupsManager.groupsLoader.initialize();
    
    // Render instantly from cache
    groupsManager.groupsLoader.renderInstantly();
    
    // Setup search functionality
    if (searchInput) {
        searchInput.addEventListener('input', debounce((e) => {
            const searchTerm = e.target.value.toLowerCase().trim();
            filterGroups(searchTerm);
        }, 300));
    }
    
    // Setup create group button
    if (createGroupBtn) {
        createGroupBtn.addEventListener('click', async () => {
            console.log('Create group button clicked');
            if (!groupsManager.firebaseUser) {
                window.location.href = 'login.html';
                return;
            }
            
            const needsSetup = await groupsManager.needsProfileSetup();
            console.log('Profile setup needed:', needsSetup);
            if (needsSetup) {
                window.location.href = 'set.html?returnTo=create-group';
            } else {
                window.location.href = 'create-group.html';
            }
        });
    }
    
    // Setup create first group button (if in empty state)
    setTimeout(() => {
        const createFirstGroupBtn = document.getElementById('createFirstGroupBtn');
        if (createFirstGroupBtn) {
            createFirstGroupBtn.addEventListener('click', () => {
                if (createGroupBtn) {
                    createGroupBtn.click();
                }
            });
        }
    }, 500);
    
    // Start background refresh
    setTimeout(() => {
        groupsManager.groupsLoader.startBackgroundRefresh();
    }, 1000);
    
    console.log('Groups page initialized with instant loading');
}

function filterGroups(searchTerm) {
    const groupsGridElement = document.getElementById('groupsGrid');
    if (!groupsGridElement) return;
    
    const groups = groupsManager.groupsLoader.appData.groups;
    
    if (!searchTerm) {
        groupsManager.groupsLoader.renderGroups(groups);
        return;
    }
    
    const filtered = groups.filter(group => {
        return (
            (group.name && group.name.toLowerCase().includes(searchTerm)) ||
            (group.description && group.description.toLowerCase().includes(searchTerm)) ||
            (group.category && group.category.toLowerCase().includes(searchTerm)) ||
            (group.topics || []).some(topic => topic && topic.toLowerCase().includes(searchTerm))
        );
    });
    
    console.log(`Filtered to ${filtered.length} groups`);
    groupsManager.groupsLoader.renderGroups(filtered);
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ==================== DOM INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded - groups.js with instant loading');
    
    // Check if we're on groups page
    if (window.location.pathname.includes('groups.html')) {
        // Initialize the page
        setTimeout(() => {
            initGroupsPage();
        }, 100);
    }
});

// Also check if page is already loaded when script loads
if (document.readyState === 'loading') {
    console.log('Document still loading');
} else {
    console.log('Document already loaded');
    // Initialize if page is already loaded
    if (window.location.pathname.includes('groups.html')) {
        setTimeout(() => {
            initGroupsPage();
        }, 100);
    }
}

console.log('✅ groups.js loaded successfully - Instant loading with separate Groups IndexedDB');