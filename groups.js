// groups.js - Enhanced with IndexedDB caching and instant loading - FIXED RENDERING
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
    apiKey: "AIzaSyC8_PEsfTOr-gJ8P1MoXobOAfqwTVqEZWo",
    authDomain: "usa-dating-23bc3.firebaseapp.com",
    projectId: "usa-dating-23bc3",
    storageBucket: "usa-dating-23bc3.firebasestorage.app",
    messagingSenderId: "423286263327",
    appId: "1:423286263327:web:17f0caf843dc349c144f2a"
};

// ==================== INDEXEDDB CACHE SYSTEM FOR GROUPS ====================
class GroupsIndexedDBCache {
    constructor() {
        this.dbName = 'GroupsAppDB';
        this.dbVersion = 3;
        this.db = null;
        this.initialized = false;
    }

    async init() {
        if (this.initialized && this.db) return this.db;
        
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = (event) => {
                console.error('IndexedDB open error:', event.target.error);
                reject(event.target.error);
            };
            
            request.onsuccess = (event) => {
                this.db = event.target.result;
                this.initialized = true;
                console.log('IndexedDB for groups initialized successfully');
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                console.log('IndexedDB upgrade needed for groups, version:', event.newVersion);
                const db = event.target.result;
                
                // Create object stores if they don't exist
                if (!db.objectStoreNames.contains('groups')) {
                    const groupsStore = db.createObjectStore('groups', { keyPath: 'id' });
                    groupsStore.createIndex('lastUpdated', 'lastUpdated', { unique: false });
                    groupsStore.createIndex('lastActivity', 'lastActivity', { unique: false });
                    console.log('Created groups store');
                }
                
                if (!db.objectStoreNames.contains('userProfiles')) {
                    db.createObjectStore('userProfiles', { keyPath: 'userId' });
                    console.log('Created userProfiles store');
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
                
                // Ensure we have required fields
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
                    // Check if data is expired (5 minutes)
                    if (result && Date.now() - result.lastUpdated < 5 * 60 * 1000) {
                        resolve(result);
                    } else {
                        resolve(null); // Data expired or not found
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
                    // Filter out expired items (5 minutes)
                    const validResults = results.filter(item => {
                        if (!item || !item.lastUpdated) return false;
                        return Date.now() - item.lastUpdated < 5 * 60 * 1000;
                    });
                    resolve(validResults);
                };
            });
        } catch (error) {
            console.error('Error in getAll method:', error);
            return [];
        }
    }

    async clear(storeName) {
        try {
            if (!this.db) await this.init();
            
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.clear();
                
                request.onerror = (event) => reject(event.target.error);
                request.onsuccess = () => resolve();
            });
        } catch (error) {
            console.error('Error clearing store:', error);
        }
    }

    async setGroups(groups) {
        try {
            await this.init();
            
            // Clear existing groups first
            await this.clear('groups');
            
            // Add new groups in batches to avoid transaction issues
            const batchSize = 20;
            for (let i = 0; i < groups.length; i += batchSize) {
                const batch = groups.slice(i, i + batchSize);
                await Promise.all(
                    batch.map(group => this.set('groups', group))
                );
            }
            
            console.log(`Cached ${groups.length} groups in IndexedDB`);
        } catch (error) {
            console.error('Error caching groups:', error);
        }
    }

    async getUserProfile(userId) {
        return this.get('userProfiles', userId);
    }

    async setUserProfile(userId, profile) {
        return this.set('userProfiles', { userId, ...profile });
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
                const cachedGroups = await this.cache.getAll('groups');
                
                // IMPORTANT: Remove cache-specific fields and ensure we have proper group objects
                this.appData.groups = cachedGroups.map(item => {
                    const { lastUpdated, ...groupData } = item;
                    return {
                        ...groupData,
                        // Ensure required fields exist
                        id: groupData.id || '',
                        name: groupData.name || 'Unnamed Group',
                        description: groupData.description || '',
                        category: groupData.category || 'General',
                        privacy: groupData.privacy || 'public',
                        memberCount: groupData.memberCount || 0,
                        maxMembers: groupData.maxMembers || 1000,
                        topics: groupData.topics || [],
                        rules: groupData.rules || []
                    };
                });
                
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
            console.error('❌ groupsGrid element not found!');
            this.showDarkError('Cannot find groups container. Please refresh the page.');
            return;
        }
        
        console.log('⚡ Attempting to render from cache, groups count:', this.appData.groups.length);
        
        if (this.appData.groups.length > 0) {
            console.log('⚡ Rendering groups instantly from cache...');
            this.hasRenderedFromCache = true;
            
            // Clear any existing content
            groupsGridElement.innerHTML = '';
            
            // Show cached data immediately - limit to 15 for better performance
            const groups = this.appData.groups.slice(0, 15);
            
            console.log('Creating cards for', groups.length, 'groups');
            
            let cardsCreated = 0;
            groups.forEach(group => {
                try {
                    // Validate group data before creating card
                    if (!group.id || !group.name) {
                        console.warn('Skipping invalid group:', group);
                        return;
                    }
                    
                    const card = this.createGroupCard(group);
                    if (card) {
                        groupsGridElement.appendChild(card);
                        cardsCreated++;
                    }
                } catch (error) {
                    console.error('Error creating card for group:', group.id, error);
                }
            });
            
            console.log(`✅ Created ${cardsCreated} group cards from cache`);
            
            // Setup event listeners
            setTimeout(() => this.setupGroupCardListeners(), 100);
            
        } else {
            // Show dark theme loading state
            console.log('No cached groups found, showing loading state');
            this.showDarkLoading();
        }
    }

    startBackgroundRefresh() {
        // Wait a bit before first refresh
        setTimeout(async () => {
            await this.refreshGroups(true);
        }, 1000);
        
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
            
            if (!silent) {
                this.showDarkLoading();
            }
            
            const groups = await this.fetchFreshGroups();
            
            // Update in-memory cache
            this.appData.groups = groups;
            
            // Cache in IndexedDB (silently, don't await)
            this.cache.setGroups(groups).catch(err => {
                console.log('Background cache update failed:', err);
            });
            
            // Update UI
            if (!silent) {
                this.renderGroups(groups);
            } else if (this.hasRenderedFromCache) {
                this.smoothUpdateGroups(groups);
            }
            
        } catch (error) {
            console.error('Error refreshing groups:', error);
            if (!silent) {
                this.showDarkError('Failed to refresh groups. Using cached data.');
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
                    // Ensure all required fields exist
                    name: data.name || 'Unnamed Group',
                    description: data.description || '',
                    category: data.category || 'General',
                    privacy: data.privacy || 'public',
                    memberCount: data.memberCount || 0,
                    maxMembers: data.maxMembers || 1000,
                    topics: data.topics || [],
                    rules: data.rules || [],
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
            // Validate required fields
            if (!group.id || !group.name) {
                console.error('Cannot create card: missing required fields', group);
                return null;
            }
            
            const groupCard = document.createElement('div');
            groupCard.className = 'group-card';
            groupCard.dataset.groupId = group.id;
            
            const avatar = this.generateGroupAvatar(group);
            
            const memberCount = group.memberCount || 0;
            const maxMembers = group.maxMembers || 1000;
            
            groupCard.innerHTML = `
                <div class="group-header">
                    <div class="group-avatar-section">
                        <img src="${avatar}" alt="${group.name}" class="group-avatar" 
                             onerror="this.onerror=null; this.src='https://api.dicebear.com/7.x/avataaars/svg?seed=group';">
                        <div class="group-title-section">
                            <h3 class="group-name">${this.escapeHtml(group.name)}</h3>
                            <span class="group-category">${this.escapeHtml(group.category || 'General')}</span>
                        </div>
                    </div>
                    <p class="group-description">${this.escapeHtml(group.description || 'No description')}</p>
                    <div class="group-meta">
                        <span class="group-members">
                            <svg class="feather" style="width: 14px; height: 14px; margin-right: 4px;">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                <circle cx="9" cy="7" r="4"></circle>
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                            </svg>
                            ${memberCount} / ${maxMembers}
                        </span>
                        <span class="group-privacy">
                            <svg class="feather" style="width: 14px; height: 14px; margin-right: 4px;">
                                ${group.privacy === 'private' ? 
                                    '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>' : 
                                    '<circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>'
                                }
                            </svg>
                            ${group.privacy === 'private' ? 'Private' : 'Public'}
                        </span>
                    </div>
                </div>
                <div class="group-content">
                    <div class="group-topics">
                        <h4 class="section-title">Discussion Topics</h4>
                        <div class="topics-list">
                            ${(group.topics || []).slice(0, 3).map(topic => 
                                `<span class="topic-tag">${this.escapeHtml(topic)}</span>`
                            ).join('')}
                            ${(group.topics || []).length > 3 ? 
                                `<span class="topic-tag">+${(group.topics || []).length - 3} more</span>` : ''
                            }
                        </div>
                    </div>
                    <div class="group-rules">
                        <h4 class="section-title">Group Rules</h4>
                        <ul class="rules-list">
                            ${(group.rules || []).slice(0, 2).map(rule => 
                                `<li class="rule-item">
                                    <svg class="feather" style="width: 14px; height: 14px; margin-right: 8px;">
                                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                                    </svg>
                                    <span>${this.escapeHtml(rule)}</span>
                                </li>`
                            ).join('')}
                            ${(group.rules || []).length > 2 ? 
                                `<li class="rule-item">
                                    <svg class="feather" style="width: 14px; height: 14px; margin-right: 8px;">
                                        <circle cx="12" cy="12" r="1"></circle>
                                        <circle cx="19" cy="12" r="1"></circle>
                                        <circle cx="5" cy="12" r="1"></circle>
                                    </svg>
                                    <span>${(group.rules || []).length - 2} more rules</span>
                                </li>` : ''
                            }
                        </ul>
                    </div>
                </div>
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

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    generateGroupAvatar(group) {
        if (group.photoUrl) {
            return group.photoUrl;
        }
        const seed = encodeURIComponent(group.name || 'group');
        return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&backgroundColor=00897b,00acc1,039be5,1e88e5,3949ab,43a047,5e35b1,7cb342,8e24aa,c0ca33,d81b60,e53935,f4511e,fb8c00,fdd835,ffb300,ffd5dc,ffdfbf,c0aede,d1d4f9,b6e3f4&backgroundType=gradientLinear`;
    }

    renderGroups(groups) {
        const groupsGridElement = document.getElementById('groupsGrid');
        if (!groupsGridElement) {
            console.error('❌ Cannot render: groupsGrid element not found');
            return;
        }
        
        console.log('Rendering', groups.length, 'groups');
        
        if (groups.length === 0) {
            groupsGridElement.innerHTML = this.getEmptyStateHTML();
            return;
        }
        
        groupsGridElement.innerHTML = '';
        
        let cardsCreated = 0;
        groups.slice(0, 30).forEach(group => { // Limit to 30 groups for performance
            try {
                if (!group.id || !group.name) {
                    console.warn('Skipping invalid group:', group);
                    return;
                }
                
                const card = this.createGroupCard(group);
                if (card) {
                    groupsGridElement.appendChild(card);
                    cardsCreated++;
                }
            } catch (error) {
                console.error('Error creating card for group:', group.id, error);
            }
        });
        
        console.log(`✅ Rendered ${cardsCreated} group cards`);
        
        this.setupGroupCardListeners();
    }

    smoothUpdateGroups(newGroups) {
        const groupsGridElement = document.getElementById('groupsGrid');
        if (!groupsGridElement) return;
        
        // Get existing group cards
        const existingItems = Array.from(groupsGridElement.children);
        const updatedIds = new Set(newGroups.slice(0, 30).map(g => g.id));
        
        // Remove items that are no longer in the list
        existingItems.forEach(item => {
            const groupId = item.dataset.groupId;
            if (groupId && !updatedIds.has(groupId)) {
                item.remove();
            }
        });
        
        // Update or add items (limit to first 30)
        newGroups.slice(0, 30).forEach((group, index) => {
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
        // Remove and re-add listeners to avoid duplicates
        document.querySelectorAll('.join-btn').forEach(btn => {
            btn.replaceWith(btn.cloneNode(true));
        });
        
        document.querySelectorAll('.join-btn').forEach(btn => {
            btn.addEventListener('click', this.handleJoinGroup.bind(this));
        });
        
        console.log('Group card listeners setup');
    }

    async handleJoinGroup(e) {
        const button = e.target;
        const groupId = button.dataset.groupId;
        
        if (!groupId) {
            console.error('No group ID found on button');
            return;
        }
        
        if (!this.currentUserId) {
            this.showNotification('Please login to join groups', 'warning');
            window.location.href = 'login.html';
            return;
        }
        
        const userProfile = await this.cache.getUserProfile(this.currentUserId);
        const needsSetup = !userProfile || !userProfile.displayName || !userProfile.avatar;
        
        if (needsSetup) {
            this.showNotification('Please complete your profile first', 'warning');
            window.location.href = `set.html?id=${groupId}`;
            return;
        }
        
        try {
            const originalText = button.innerHTML;
            
            button.disabled = true;
            button.innerHTML = `
                <svg class="feather" style="animation: spin 1s linear infinite; width: 14px; height: 14px; margin-right: 8px;">
                    <circle cx="12" cy="12" r="10" />
                </svg>
                Joining...
            `;
            
            await window.joinGroup(groupId);
            
            button.innerHTML = `
                <svg class="feather" style="width: 14px; height: 14px; margin-right: 8px;">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                Joined!
            `;
            button.className = 'join-btn success';
            button.disabled = true;
            
            setTimeout(() => {
                window.location.href = `group.html?id=${groupId}`;
            }, 1000);
            
        } catch (error) {
            console.error('Error joining group:', error);
            button.disabled = false;
            button.textContent = 'Join Group';
            this.showNotification(error.message || 'Failed to join group. Please try again.', 'error');
        }
    }

    getEmptyStateHTML() {
        return `
            <div class="no-groups">
                <svg class="feather" style="width: 48px; height: 48px; margin-bottom: 16px; color: #888;">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
                <h3 style="color: #e0e0e0; margin: 16px 0 8px;">No Groups Found</h3>
                <p style="color: #888;">Be the first to create a group!</p>
                <button id="createFirstGroupBtn" class="primary-btn" style="margin-top: 16px;">
                    Create Your First Group
                </button>
            </div>
        `;
    }

    showDarkLoading() {
        const groupsGridElement = document.getElementById('groupsGrid');
        if (!groupsGridElement) {
            console.error('Cannot show loading: groupsGrid not found');
            return;
        }
        
        groupsGridElement.innerHTML = `
            <div class="loading-card dark">
                <div class="loading-avatar dark"></div>
                <div class="loading-content dark">
                    <div class="loading-line dark" style="width: 60%"></div>
                    <div class="loading-line dark" style="width: 80%"></div>
                    <div class="loading-line dark" style="width: 70%"></div>
                    <div class="loading-line dark" style="width: 50%"></div>
                </div>
            </div>
            <div class="loading-card dark">
                <div class="loading-avatar dark"></div>
                <div class="loading-content dark">
                    <div class="loading-line dark" style="width: 60%"></div>
                    <div class="loading-line dark" style="width: 80%"></div>
                    <div class="loading-line dark" style="width: 70%"></div>
                    <div class="loading-line dark" style="width: 50%"></div>
                </div>
            </div>
            <div class="loading-card dark">
                <div class="loading-avatar dark"></div>
                <div class="loading-content dark">
                    <div class="loading-line dark" style="width: 60%"></div>
                    <div class="loading-line dark" style="width: 80%"></div>
                    <div class="loading-line dark" style="width: 70%"></div>
                    <div class="loading-line dark" style="width: 50%"></div>
                </div>
            </div>
        `;
        
        this.addDarkLoadingStyles();
    }

    showDarkError(message) {
        const groupsGridElement = document.getElementById('groupsGrid');
        if (!groupsGridElement) return;
        
        groupsGridElement.innerHTML = `
            <div class="error-state dark">
                <svg class="feather" style="width: 48px; height: 48px; margin-bottom: 16px; color: #ff6b6b;">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <h3 style="color: #e0e0e0; margin: 16px 0 8px;">Error Loading Groups</h3>
                <p style="color: #888;">${message}</p>
                <button onclick="window.location.reload()" class="primary-btn dark" style="margin-top: 16px;">
                    Try Again
                </button>
                <button onclick="window.location.href='index.html'" class="secondary-btn dark" style="margin-top: 8px;">
                    Go Home
                </button>
            </div>
        `;
        
        this.addDarkLoadingStyles();
    }

    addDarkLoadingStyles() {
        if (document.getElementById('dark-loading-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'dark-loading-styles';
        style.textContent = `
            .loading-card.dark {
                background: #1e1e1e;
                border-radius: 12px;
                padding: 16px;
                margin-bottom: 16px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                display: flex;
                gap: 12px;
                animation: fadeIn 0.3s ease;
                border: 1px solid #333;
            }
            
            .loading-avatar.dark {
                width: 50px;
                height: 50px;
                border-radius: 50%;
                background: linear-gradient(90deg, #2d2d2d 25%, #3d3d3d 50%, #2d2d2d 75%);
                background-size: 200% 100%;
                animation: darkLoading 1.5s infinite;
            }
            
            .loading-content.dark {
                flex: 1;
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            
            .loading-line.dark {
                height: 12px;
                border-radius: 6px;
                background: linear-gradient(90deg, #2d2d2d 25%, #3d3d3d 50%, #2d2d2d 75%);
                background-size: 200% 100%;
                animation: darkLoading 1.5s infinite;
            }
            
            @keyframes darkLoading {
                0% { background-position: 200% 0; }
                100% { background-position: -200% 0; }
            }
            
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            .primary-btn.dark {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 8px;
                cursor: pointer;
                font-size: 14px;
                transition: background 0.3s;
            }
            
            .primary-btn.dark:hover {
                background: linear-gradient(135deg, #5a6fd8 0%, #6a4290 100%);
            }
            
            .secondary-btn.dark {
                background: #2d2d2d;
                color: #e0e0e0;
                border: 1px solid #444;
                padding: 10px 20px;
                border-radius: 8px;
                cursor: pointer;
                font-size: 14px;
                transition: background 0.3s;
            }
            
            .secondary-btn.dark:hover {
                background: #3d3d3d;
            }
            
            .error-state.dark, .no-groups {
                text-align: center;
                padding: 40px 20px;
                color: #888;
                grid-column: 1 / -1;
            }
            
            .feather {
                stroke: currentColor;
                stroke-width: 2;
                stroke-linecap: round;
                stroke-linejoin: round;
                fill: none;
            }
        `;
        document.head.appendChild(style);
    }

    showNotification(message, type = 'info') {
        const existingNotifications = document.querySelectorAll('.custom-notification');
        existingNotifications.forEach(notification => notification.remove());
        
        const notification = document.createElement('div');
        notification.className = `custom-notification ${type}`;
        
        const bgColor = type === 'error' ? '#dc2626' : 
                       type === 'success' ? '#16a34a' : 
                       type === 'warning' ? '#f59e0b' : '#3b82f6';
        
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
            font-family: 'Inter', sans-serif;
        `;
        
        notification.innerHTML = `<span>${message}</span>`;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
        
        this.addNotificationStyles();
    }

    addNotificationStyles() {
        if (document.getElementById('notification-animations')) return;
        
        const style = document.createElement('style');
        style.id = 'notification-animations';
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

    setCurrentUserId(userId) {
        this.currentUserId = userId;
    }

    isOnline() {
        return navigator.onLine;
    }
}

// ==================== GLOBAL FIREBASE INITIALIZATION ====================
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
        
        return true;
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
    
    const userRef = doc(db, 'group_users', user.uid);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
        throw new Error('Please complete your profile first');
    }
    
    const userData = userSnap.data();
    
    const groupRef = doc(db, 'groups', groupId);
    const groupSnap = await getDoc(groupRef);
    
    if (!groupSnap.exists()) {
        throw new Error('Group not found');
    }
    
    const group = groupSnap.data();
    
    const memberRef = doc(db, 'groups', groupId, 'members', user.uid);
    const memberSnap = await getDoc(memberRef);
    if (memberSnap.exists()) {
        return true;
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
    
    // Start instant loading IMMEDIATELY
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
    
    // Setup create first group button
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
    
    if (window.location.pathname.includes('groups.html')) {
        setTimeout(() => {
            initGroupsPage();
        }, 100);
    }
});

if (document.readyState === 'loading') {
    console.log('Document still loading');
} else {
    console.log('Document already loaded');
    if (window.location.pathname.includes('groups.html')) {
        setTimeout(() => {
            initGroupsPage();
        }, 100);
    }
}

console.log('✅ groups.js loaded successfully - Instant loading with IndexedDB caching');