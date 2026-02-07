// groups.js - DIRECT COPY OF GAMERS.JS INSTANT LOADING SYSTEM

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

// ==================== EXACT COPY OF GAMERS.JS INDEXEDDB SYSTEM ====================
class GroupsIndexedDBCache {
    constructor() {
        this.dbName = 'GamersAppDB';
        this.dbVersion = 4;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                console.log('Groups IndexedDB initialized successfully');
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create object stores - EXACTLY like gamers.js
                if (!db.objectStoreNames.contains('groups')) {
                    const groupsStore = db.createObjectStore('groups', { keyPath: 'id' });
                    groupsStore.createIndex('lastUpdated', 'lastUpdated', { unique: false });
                    groupsStore.createIndex('lastActivity', 'lastActivity', { unique: false });
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
        if (!this.db) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put({
                ...data,
                lastUpdated: Date.now()
            });
            
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
            request.onsuccess = () => {
                const result = request.result;
                if (result && Date.now() - result.lastUpdated < 5 * 60 * 1000) {
                    resolve(result);
                } else {
                    resolve(null);
                }
            };
        });
    }

    async getAll(storeName) {
        if (!this.db) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const results = request.result || [];
                const validResults = results.filter(item => {
                    if (!item || !item.lastUpdated) return false;
                    return Date.now() - item.lastUpdated < 5 * 60 * 1000;
                });
                resolve(validResults);
            };
        });
    }

    async setGroups(groups) {
        await this.init();
        for (const group of groups) {
            await this.set('groups', {
                ...group,
                lastUpdated: Date.now()
            });
        }
        console.log(`✅ Cached ${groups.length} groups in IndexedDB`);
    }

    async getGroups() {
        await this.init();
        return await this.getAll('groups');
    }
}

// ==================== EXACT COPY OF GAMERS.JS INSTANT LOADING ====================
class GroupsInstantLoadingSystem {
    constructor() {
        this.appData = {
            groups: [],
            userProfiles: {},
            membership: {}
        };
        this.isInitialized = false;
        this.initPromise = null;
        this.hasRenderedFromCache = false;
    }

    async initialize() {
        if (this.initPromise) return this.initPromise;
        
        this.initPromise = new Promise(async (resolve) => {
            console.log('🚀 Starting instant preload for groups...');
            
            const preloadStartTime = Date.now();
            
            try {
                // Load from IndexedDB cache immediately (instant)
                await this.initIndexedDB();
                
                // Load all cached groups
                const groups = await this.loadAllGroups();
                this.appData.groups = groups;
                
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

    async initIndexedDB() {
        this.cache = new GroupsIndexedDBCache();
        await this.cache.init();
    }

    async loadAllGroups() {
        try {
            const allGroups = await this.cache.getGroups();
            return allGroups.map(group => {
                const { lastUpdated, ...groupData } = group;
                return groupData;
            });
        } catch (error) {
            console.log('Could not load groups from cache:', error);
            return [];
        }
    }

    renderInstantly() {
        if (this.hasRenderedFromCache) return;
        
        const groupsGridElement = document.getElementById('groupsGrid');
        if (!groupsGridElement) {
            console.error('Cannot find #groupsGrid element');
            return;
        }
        
        console.log(`🔄 Checking ${this.appData.groups.length} cached groups...`);
        
        if (this.appData.groups.length > 0) {
            console.log('⚡ Rendering instantly from cache...');
            this.hasRenderedFromCache = true;
            
            // Clear any existing content
            groupsGridElement.innerHTML = '';
            
            // Show cached data immediately (first 15 groups)
            const groupsToShow = this.appData.groups.slice(0, 15);
            
            groupsToShow.forEach(group => {
                const card = this.createGroupCard(group);
                if (card) {
                    groupsGridElement.appendChild(card);
                }
            });
            
            // Setup event listeners
            this.setupGroupCardListeners();
            
            console.log(`✅ Instant render complete (${groupsToShow.length} groups)`);
            
            // Add more if we have them (lazy load)
            if (this.appData.groups.length > 15) {
                setTimeout(() => {
                    const moreGroups = this.appData.groups.slice(15);
                    moreGroups.forEach(group => {
                        const card = this.createGroupCard(group);
                        if (card) {
                            groupsGridElement.appendChild(card);
                        }
                    });
                    this.setupGroupCardListeners();
                    console.log(`➕ Added ${moreGroups.length} more groups`);
                }, 100);
            }
            
        } else {
            console.log('No cached groups found, showing loading...');
            this.showLoading();
        }
    }

    showLoading() {
        const groupsGridElement = document.getElementById('groupsGrid');
        if (!groupsGridElement) return;
        
        // EXACTLY like gamers.js loading
        groupsGridElement.innerHTML = '';
        for (let i = 0; i < 3; i++) {
            groupsGridElement.appendChild(this.createLoadingGroupItem());
        }
    }

    createLoadingGroupItem() {
        const div = document.createElement('div');
        div.className = 'group-item loading';
        div.innerHTML = `
            <div class="loading-avatar"></div>
            <div class="loading-info">
                <div class="loading-line" style="width: 60%"></div>
                <div class="loading-line short"></div>
                <div class="loading-line medium"></div>
            </div>
        `;
        return div;
    }

    startBackgroundRefresh() {
        // Refresh data in background after initial render
        setTimeout(async () => {
            console.log('🔄 Starting background refresh...');
            await this.fetchFreshGroups(true); // Silent refresh
            
            // Schedule periodic refresh every 30 seconds
            setInterval(async () => {
                if (document.visibilityState === 'visible' && this.isOnline()) {
                    await this.fetchFreshGroups(true); // Silent refresh
                }
            }, 30000);
        }, 2000); // Wait 2 seconds before first refresh
    }

    async fetchFreshGroups(silentRefresh = false) {
        console.log('🔄 Fetching fresh groups from Firebase...');
        
        try {
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
            
            // Update in-memory cache
            this.appData.groups = groups;
            
            // Cache in IndexedDB
            await this.cache.setGroups(groups);
            
            // Update UI with fresh data
            if (!silentRefresh || !this.hasRenderedFromCache) {
                this.renderGroups(groups);
            } else {
                this.smoothUpdateGroups(groups);
            }
            
            return groups;
            
        } catch (error) {
            console.error('❌ Error loading groups:', error);
            if (!silentRefresh) {
                this.showError(`Failed to load groups: ${error.message}`, true);
            }
            return [];
        }
    }

    renderGroups(groups) {
        const groupsGridElement = document.getElementById('groupsGrid');
        if (!groupsGridElement) return;
        
        if (groups.length === 0) {
            groupsGridElement.innerHTML = this.getEmptyStateHTML();
            return;
        }
        
        groupsGridElement.innerHTML = '';
        groups.forEach(group => {
            const card = this.createGroupCard(group);
            if (card) {
                groupsGridElement.appendChild(card);
            }
        });
        
        this.setupGroupCardListeners();
        console.log(`✅ Rendered ${groups.length} groups`);
    }

    smoothUpdateGroups(newGroups) {
        const groupsGridElement = document.getElementById('groupsGrid');
        if (!groupsGridElement) return;
        
        // Get existing group items
        const existingItems = Array.from(groupsGridElement.children);
        const updatedIds = new Set(newGroups.map(g => g.id));
        
        // Remove items that are no longer in the list
        existingItems.forEach(item => {
            const groupId = item.dataset.groupId;
            if (groupId && !updatedIds.has(groupId)) {
                item.remove();
            }
        });
        
        // Update or add items
        newGroups.forEach((group, index) => {
            const existingItem = groupsGridElement.querySelector(`[data-group-id="${group.id}"]`);
            if (existingItem) {
                // Update existing item if needed
                this.updateGroupItem(existingItem, group);
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

    updateGroupItem(item, group) {
        // Only update if data has changed significantly
        const currentMemberCount = item.querySelector('.group-members')?.textContent;
        const newMemberCount = `${group.memberCount || 0} / ${group.maxMembers || 1000}`;
        
        if (currentMemberCount !== newMemberCount) {
            const newItem = this.createGroupCard(group);
            item.replaceWith(newItem);
        }
    }

    createGroupCard(group) {
        const groupCard = document.createElement('div');
        groupCard.className = 'group-card';
        groupCard.dataset.groupId = group.id;
        
        const avatar = group.photoUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(group.name)}&backgroundColor=667eea,764ba2`;
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
                    <span class="group-members" title="${group.memberCount || 0} members">
                        <svg class="feather" style="width: 14px; height: 14px; margin-right: 4px;">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                            <circle cx="9" cy="7" r="4"></circle>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                        </svg>
                        ${group.memberCount || 0} / ${group.maxMembers || 1000}
                    </span>
                    <span class="group-privacy" style="color: ${isPrivate ? '#ef4444' : '#10b981'};" title="${isPrivate ? 'Private Group' : 'Public Group'}">
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
            ${(group.topics && group.topics.length > 0) || (group.rules && group.rules.length > 0) ? `
                <div class="group-content">
                    ${group.topics && group.topics.length > 0 ? `
                        <div class="group-topics">
                            <h4 class="section-title">Topics</h4>
                            <div class="topics-list">
                                ${group.topics.slice(0, 3).map(topic => 
                                    `<span class="topic-tag">${topic}</span>`
                                ).join('')}
                                ${group.topics.length > 3 ? 
                                    `<span class="topic-tag">+${group.topics.length - 3}</span>` : ''
                                }
                            </div>
                        </div>
                    ` : ''}
                </div>
            ` : ''}
            <div class="group-actions">
                <button class="join-btn" data-group-id="${group.id}">
                    <svg class="feather" style="width: 14px; height: 14px; margin-right: 8px;">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="8.5" cy="7" r="4"></circle>
                        <line x1="20" y1="8" x2="20" y2="14"></line>
                        <line x1="23" y1="11" x2="17" y2="11"></line>
                    </svg>
                    Join Group
                </button>
            </div>
        `;
        
        return groupCard;
    }

    setupGroupCardListeners() {
        document.querySelectorAll('.join-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleJoinGroup(e);
            });
        });
        
        // Click event for group navigation
        document.querySelectorAll('.group-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.join-btn')) {
                    const groupId = card.dataset.groupId;
                    if (groupId) {
                        window.location.href = `group.html?id=${groupId}`;
                    }
                }
            });
        });
    }

    async handleJoinGroup(e) {
        const button = e.target;
        const groupId = button.dataset.groupId;
        
        if (!groupId) return;
        
        const auth = getAuth(window.firebaseApp);
        const user = auth.currentUser;
        
        if (!user) {
            this.showNotification('Please login to join groups', 'warning');
            window.location.href = 'login.html';
            return;
        }
        
        try {
            button.disabled = true;
            button.innerHTML = `
                <svg class="feather spin" style="width: 14px; height: 14px; margin-right: 8px;">
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
            button.innerHTML = `
                <svg class="feather" style="width: 14px; height: 14px; margin-right: 8px;">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="8.5" cy="7" r="4"></circle>
                    <line x1="20" y1="8" x2="20" y2="14"></line>
                    <line x1="23" y1="11" x2="17" y2="11"></line>
                </svg>
                Join Group
            `;
            this.showNotification(error.message || 'Failed to join group', 'error');
        }
    }

    getEmptyStateHTML() {
        return `
            <div class="empty-state">
                <svg class="feather" style="width: 48px; height: 48px;">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
                <h3>No groups yet</h3>
                <p>Be the first to create a group!</p>
            </div>
        `;
    }

    showError(message, showRefresh = true) {
        const groupsGridElement = document.getElementById('groupsGrid');
        if (!groupsGridElement) return;
        
        groupsGridElement.innerHTML = `
            <div class="empty-state">
                <svg class="feather" style="width: 48px; height: 48px;">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <h3>Error Loading</h3>
                <p>${message}</p>
                ${showRefresh ? `
                    <div style="margin-top: 15px; display: flex; gap: 10px;">
                        <button onclick="location.reload()" style="
                            background: #667eea;
                            color: white;
                            border: none;
                            padding: 8px 16px;
                            border-radius: 20px;
                            cursor: pointer;
                        ">
                            Refresh Page
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }

    showNotification(message, type = 'info') {
        // Copy from gamers.js
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
            backdrop-filter: blur(10px);
        `;
        
        notification.innerHTML = `<span>${message}</span>`;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    isOnline() {
        return navigator.onLine;
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

// ==================== INITIALIZATION ====================
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

// Create global instant loader
const instantLoader = new GroupsInstantLoadingSystem();

// ==================== MAIN INITIALIZATION ====================
async function initGroupsPage() {
    console.log('🚀 Initializing groups page...');
    
    // Start instant loading IMMEDIATELY (before auth)
    await instantLoader.initialize();
    
    // Render instantly
    instantLoader.renderInstantly();
    
    // Setup search
    const searchInput = document.getElementById('groupSearch');
    if (searchInput) {
        searchInput.addEventListener('input', debounce((e) => {
            const searchTerm = e.target.value.toLowerCase().trim();
            if (searchTerm) {
                const filtered = instantLoader.appData.groups.filter(group => 
                    group.name.toLowerCase().includes(searchTerm) ||
                    group.description.toLowerCase().includes(searchTerm) ||
                    group.category.toLowerCase().includes(searchTerm) ||
                    (group.topics || []).some(topic => topic.toLowerCase().includes(searchTerm))
                );
                instantLoader.renderGroups(filtered);
            } else {
                instantLoader.renderGroups(instantLoader.appData.groups);
            }
        }, 300));
    }
    
    // Setup create group button
    const createGroupBtn = document.getElementById('createGroupBtn');
    if (createGroupBtn) {
        createGroupBtn.addEventListener('click', () => {
            const auth = getAuth(window.firebaseApp);
            if (!auth.currentUser) {
                window.location.href = 'login.html';
                return;
            }
            window.location.href = 'create-group.html';
        });
    }
    
    // Start background refresh
    setTimeout(() => {
        instantLoader.startBackgroundRefresh();
    }, 1000);
    
    console.log('✅ Groups page initialized with instant loading');
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

// Add CSS styles
function addStyles() {
    if (document.getElementById('groups-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'groups-styles';
    style.textContent = `
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
        
        .spin {
            animation: spin 1s linear infinite;
        }
        

        
        /* Loading styles - EXACTLY like gamers.js */
        .group-item.loading {
            background: #7a0034;
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 16px;
            display: flex;
            gap: 12px;
            align-items: center;
        }
        
        .loading-avatar {
            width: 50px;
            height: 50px;
            border-radius: 50%;
            background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
            background-size: 200% 100%;
            animation: loading 1.5s infinite;
        }
        
        .loading-info {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        
        .loading-line {
            height: 12px;
            border-radius: 6px;
            background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
            background-size: 200% 100%;
            animation: loading 1.5s infinite;
        }
        
        .loading-line.short {
            width: 40%;
        }
        
        .loading-line.medium {
            width: 70%;
        }
        
        @keyframes loading {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
        }
        
        .empty-state {
            text-align: center;
            padding: 40px 20px;
            color: #666;
            grid-column: 1 / -1;
        }
        
        .empty-state h3 {
            margin: 16px 0 8px;
            color: #333;
        }
    `;
    document.head.appendChild(style);
}

// ==================== DOM INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 DOM Content Loaded - groups.js');
    
    // Add styles
    addStyles();
    
    // Check if we're on groups page
    if (window.location.pathname.includes('groups.html')) {
        // Initialize the page immediately
        await initGroupsPage();
    }
});

// Also check if page is already loaded when script loads
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    console.log('Document already loaded');
    // Initialize if page is already loaded
    if (window.location.pathname.includes('groups.html')) {
        setTimeout(async () => {
            await initGroupsPage();
        }, 50);
    }
}

console.log('✅ groups.js loaded successfully - EXACT COPY of gamers.js instant loading system');