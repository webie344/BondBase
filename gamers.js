import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
    getAuth, 
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    getFirestore, 
    collection,
    getDocs,
    query,
    where,
    doc,
    getDoc,
    updateDoc,
    arrayUnion,
    arrayRemove,
    serverTimestamp,
    increment,
    Timestamp,
    onSnapshot,
    setDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyC9jF-ocy6HjsVzWVVlAyXW-4aIFgA79-A",
    authDomain: "crypto-6517d.firebaseapp.com",
    projectId: "crypto-6517d",
    storageBucket: "crypto-6517d.firebasestorage.app",
    messagingSenderId: "60263975159",
    appId: "1:60263975159:web:bd53dcaad86d6ed9592bf2"
};

// Initialize Firebase
let app, auth, db;
try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    console.log('Firebase initialized successfully');
} catch (error) {
    console.error('Firebase initialization error:', error);
}

// ==================== FOLLOWER NOTIFICATION SYSTEM - NO INDEX REQUIRED ====================
class FollowerNotificationSystem {
    constructor() {
        this.notificationSound = null;
        this.lastCheckTime = Date.now();
        this.checkInterval = null;
        this.notificationPermission = false;
        this.notificationCache = new Set();
        this.unreadCount = 0;
        this.followListener = null;
        this.currentUserId = null;
        this.isInitialized = false;
        this.lastFollowers = [];
    }

    async initialize() {
        if (this.isInitialized) return;
        
        console.log('🔔 Initializing follower notification system...');
        
        if ('Notification' in window) {
            if (Notification.permission === 'default') {
                this.notificationPermission = await Notification.requestPermission();
            } else {
                this.notificationPermission = Notification.permission;
            }
            console.log('Notification permission:', this.notificationPermission);
        }

        this.createNotificationBell();

        onAuthStateChanged(auth, async (user) => {
            if (user) {
                console.log('👤 User logged in, starting follower checks for:', user.uid);
                this.currentUserId = user.uid;
                this.startChecking(user.uid);
                await this.loadNotifications(user.uid);
            } else {
                console.log('👤 User logged out, stopping follower checks');
                this.currentUserId = null;
                this.stopChecking();
            }
        });

        this.isInitialized = true;
    }

    createNotificationBell() {
        const existingBell = document.getElementById('notificationBell');
        if (existingBell) {
            existingBell.remove();
        }

        const notificationBell = document.createElement('div');
        notificationBell.id = 'notificationBell';
        notificationBell.className = 'notification-bell';
        notificationBell.innerHTML = `
            <i class="fas fa-bell"></i>
            <span class="notification-badge" style="display: none;">0</span>
            <div class="notification-dropdown" style="display: none;">
                <div class="notification-header">
                    <h3>Notifications</h3>
                    <button class="mark-all-read">Mark all as read</button>
                </div>
                <div class="notification-list">
                    <div class="notification-empty">
                        <i class="fas fa-bell-slash"></i>
                        <p>No notifications yet</p>
                    </div>
                </div>
            </div>
        `;

        const header = document.querySelector('.header-right, .nav-right, .user-menu, nav, .top-bar');
        if (header) {
            header.appendChild(notificationBell);
        } else {
            notificationBell.style.position = 'fixed';
            notificationBell.style.top = '20px';
            notificationBell.style.right = '20px';
            notificationBell.style.zIndex = '1000';
            document.body.appendChild(notificationBell);
        }

        notificationBell.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            this.toggleNotificationDropdown();
        });

        const markAllBtn = notificationBell.querySelector('.mark-all-read');
        if (markAllBtn) {
            markAllBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.markAllAsRead();
            });
        }

        document.addEventListener('click', (e) => {
            const dropdown = document.querySelector('.notification-dropdown');
            const bell = document.getElementById('notificationBell');
            if (dropdown && bell && !bell.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });

        this.addNotificationStyles();
    }

    toggleNotificationDropdown() {
        const dropdown = document.querySelector('.notification-dropdown');
        if (dropdown) {
            const isVisible = dropdown.style.display === 'block';
            dropdown.style.display = isVisible ? 'none' : 'block';
        }
    }

    async startChecking(userId) {
        this.stopChecking();

        console.log('🔄 Setting up follower listener for user:', userId);
        
        const userRef = doc(db, 'users', userId);
        
        this.followListener = onSnapshot(userRef, (docSnapshot) => {
            if (docSnapshot.exists()) {
                const userData = docSnapshot.data();
                const followers = userData.followers || [];
                this.checkForNewFollowers(userId, followers);
            }
        }, (error) => {
            console.error('Error in follower listener:', error);
        });

        try {
            const userRef = doc(db, 'users', userId);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                const userData = userSnap.data();
                this.lastFollowers = userData.followers || [];
                await this.cacheFollowers(userId, this.lastFollowers);
            }
        } catch (error) {
            console.error('Error loading initial followers:', error);
        }

        this.checkInterval = setInterval(() => {
            this.checkForNewFollowersPeriodic(userId);
        }, 30000);
    }

    stopChecking() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        if (this.followListener) {
            this.followListener();
            this.followListener = null;
        }
    }

    async checkForNewFollowers(userId, currentFollowers) {
        try {
            const cachedFollowers = await this.getCachedFollowers(userId) || [];
            
            const newFollowers = currentFollowers.filter(
                followerId => !cachedFollowers.includes(followerId)
            );

            if (newFollowers.length > 0) {
                console.log(`🎉 Found ${newFollowers.length} new followers!`);
                
                for (const followerId of newFollowers) {
                    await this.processNewFollower(userId, followerId);
                }

                await this.cacheFollowers(userId, currentFollowers);
                this.lastFollowers = currentFollowers;
            }

        } catch (error) {
            console.error('Error checking for new followers:', error);
        }
    }

    async checkForNewFollowersPeriodic(userId) {
        try {
            const userRef = doc(db, 'users', userId);
            const userSnap = await getDoc(userRef);
            if (!userSnap.exists()) return;
            
            const followers = userSnap.data().followers || [];
            await this.checkForNewFollowers(userId, followers);
        } catch (error) {
            console.error('Error in periodic follower check:', error);
        }
    }

    async processNewFollower(userId, followerId) {
        const notificationKey = `${userId}_${followerId}_${Date.now()}`;
        if (this.notificationCache.has(notificationKey)) return;

        try {
            const followerRef = doc(db, 'users', followerId);
            const followerSnap = await getDoc(followerRef);
            
            if (!followerSnap.exists()) return;

            const followerData = followerSnap.data();
            const followerName = followerData.name || 'Someone';
            const followerImage = followerData.profileImage || 'images-default-profile.jpg';

            const notification = {
                id: notificationKey,
                type: 'new_follower',
                followerId: followerId,
                followerName: followerName,
                followerImage: followerImage,
                timestamp: Date.now(),
                read: false
            };

            this.showFollowerNotification(notification);
            this.notificationCache.add(notificationKey);
            this.unreadCount++;
            this.updateNotificationBadge();
            await this.storeNotification(userId, notification);

        } catch (error) {
            console.error('Error processing new follower:', error);
        }
    }

    showFollowerNotification(notification) {
        this.showInAppNotification(notification);

        if (this.notificationPermission === 'granted') {
            this.showBrowserNotification(notification);
        }

        this.addToNotificationDropdown(notification);
    }

    showInAppNotification(notification) {
        const existing = document.querySelector(`.follower-notification[data-id="${notification.id}"]`);
        if (existing) existing.remove();

        const notificationDiv = document.createElement('div');
        notificationDiv.className = 'follower-notification';
        notificationDiv.dataset.id = notification.id;
        notificationDiv.innerHTML = `
            <img src="${notification.followerImage}" alt="${notification.followerName}" class="notification-avatar">
            <div class="notification-content">
                <strong>${notification.followerName}</strong> started following you!
                <div class="notification-time">${this.getTimeAgo(notification.timestamp)}</div>
            </div>
            <button class="notification-close"><i class="fas fa-times"></i></button>
        `;

        document.body.appendChild(notificationDiv);

        const closeBtn = notificationDiv.querySelector('.notification-close');
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            notificationDiv.remove();
        });

        notificationDiv.addEventListener('click', () => {
            window.location.href = `profile.html?id=${notification.followerId}`;
        });

        setTimeout(() => {
            if (notificationDiv.parentElement) {
                notificationDiv.style.animation = 'slideOutRight 0.5s ease';
                setTimeout(() => notificationDiv.remove(), 500);
            }
        }, 5000);
    }

    showBrowserNotification(notification) {
        try {
            const browserNotification = new Notification('New Follower! 🎉', {
                body: `${notification.followerName} started following you`,
                icon: notification.followerImage,
                badge: 'images-default-profile.jpg',
                tag: notification.id,
                requireInteraction: false
            });

            browserNotification.onclick = () => {
                window.focus();
                window.location.href = `profile.html?id=${notification.followerId}`;
                browserNotification.close();
            };

            setTimeout(() => browserNotification.close(), 5000);
        } catch (error) {
            console.error('Error showing browser notification:', error);
        }
    }

    addToNotificationDropdown(notification) {
        const notificationList = document.querySelector('.notification-list');
        if (!notificationList) return;

        const emptyState = notificationList.querySelector('.notification-empty');
        if (emptyState) {
            emptyState.remove();
        }

        const existingItem = notificationList.querySelector(`[data-id="${notification.id}"]`);
        if (existingItem) return;

        const notificationItem = document.createElement('div');
        notificationItem.className = 'notification-item unread';
        notificationItem.dataset.id = notification.id;
        notificationItem.innerHTML = `
            <img src="${notification.followerImage}" alt="${notification.followerName}" class="notification-avatar">
            <div class="notification-item-content">
                <div class="notification-item-text">
                    <strong>${notification.followerName}</strong> started following you
                </div>
                <div class="notification-item-time">${this.getTimeAgo(notification.timestamp)}</div>
            </div>
            <button class="notification-item-close"><i class="fas fa-times"></i></button>
        `;

        notificationItem.addEventListener('click', (e) => {
            if (!e.target.closest('.notification-item-close')) {
                window.location.href = `profile.html?id=${notification.followerId}`;
                notificationItem.classList.remove('unread');
                this.unreadCount = Math.max(0, this.unreadCount - 1);
                this.updateNotificationBadge();
            }
        });

        const closeBtn = notificationItem.querySelector('.notification-item-close');
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            notificationItem.remove();
            this.notificationCache.delete(notification.id);
            
            if (notificationList.children.length === 0) {
                notificationList.innerHTML = `
                    <div class="notification-empty">
                        <i class="fas fa-bell-slash"></i>
                        <p>No notifications yet</p>
                    </div>
                `;
            }
        });

        notificationList.prepend(notificationItem);
    }

    async getCachedFollowers(userId) {
        try {
            return await indexedDBCache.getFollowers(userId) || [];
        } catch (error) {
            console.log('Could not get cached followers:', error);
            return [];
        }
    }

    async cacheFollowers(userId, followers) {
        try {
            await indexedDBCache.setFollowers(userId, followers);
        } catch (error) {
            console.log('Could not cache followers:', error);
        }
    }

    async storeNotification(userId, notification) {
        try {
            const notifications = await indexedDBCache.getNotifications(userId) || [];
            notifications.unshift(notification);
            
            if (notifications.length > 50) {
                notifications.pop();
            }
            
            await indexedDBCache.setNotifications(userId, notifications);
        } catch (error) {
            console.log('Could not store notification:', error);
        }
    }

    async loadNotifications(userId) {
        try {
            const notifications = await indexedDBCache.getNotifications(userId) || [];
            this.unreadCount = notifications.filter(n => !n.read).length;
            this.updateNotificationBadge();
            
            const notificationList = document.querySelector('.notification-list');
            if (notificationList && notifications.length > 0) {
                notificationList.innerHTML = '';
                notifications.forEach(notification => {
                    this.addToNotificationDropdown(notification);
                });
            }
        } catch (error) {
            console.log('Could not load notifications:', error);
        }
    }

    updateNotificationBadge() {
        const badge = document.querySelector('.notification-badge');
        if (!badge) return;

        if (this.unreadCount > 0) {
            badge.style.display = 'flex';
            badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
        } else {
            badge.style.display = 'none';
        }
    }

    markAllAsRead() {
        const notificationItems = document.querySelectorAll('.notification-item.unread');
        notificationItems.forEach(item => item.classList.remove('unread'));
        this.unreadCount = 0;
        this.updateNotificationBadge();
    }

    getTimeAgo(timestamp) {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        
        if (seconds < 60) return 'just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    }

    addNotificationStyles() {
        if (document.getElementById('notificationStyles')) return;

        const style = document.createElement('style');
        style.id = 'notificationStyles';
        style.textContent = `
            .notification-bell {
                position: relative;
                cursor: pointer;
                padding: 8px 12px;
                border-radius: 50%;
                transition: background 0.3s;
                display: inline-flex;
                align-items: center;
                justify-content: center;
            }

            .notification-bell:hover {
                background: rgba(255,255,255,0.1);
            }

            .notification-bell i {
                font-size: 20px;
                color: white;
            }

            .notification-badge {
                position: absolute;
                top: 0;
                right: 0;
                background: #ff2a6d;
                color: white;
                font-size: 11px;
                font-weight: bold;
                min-width: 18px;
                height: 18px;
                border-radius: 9px;
                display: flex;
                align-items: center;
                justify-content: center;
                border: 2px solid #1a1a2e;
                padding: 0 4px;
            }

            .notification-dropdown {
                position: absolute;
                top: 100%;
                right: 0;
                width: 350px;
                background: #16213e;
                border-radius: 10px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                z-index: 1000;
                margin-top: 10px;
                border: 1px solid rgba(255,255,255,0.1);
            }

            .notification-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 15px;
                border-bottom: 1px solid rgba(255,255,255,0.1);
            }

            .notification-header h3 {
                margin: 0;
                font-size: 16px;
                color: white;
            }

            .mark-all-read {
                background: none;
                border: none;
                color: #7a4fff;
                font-size: 12px;
                cursor: pointer;
                padding: 5px 10px;
                border-radius: 5px;
                transition: background 0.2s;
            }

            .mark-all-read:hover {
                background: rgba(122, 79, 255, 0.1);
            }

            .notification-list {
                max-height: 400px;
                overflow-y: auto;
            }

            .notification-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px 15px;
                border-bottom: 1px solid rgba(255,255,255,0.1);
                cursor: pointer;
                transition: background 0.2s;
            }

            .notification-item:hover {
                background: rgba(255,255,255,0.05);
            }

            .notification-item.unread {
                background: rgba(122, 79, 255, 0.15);
            }

            .notification-avatar {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                object-fit: cover;
            }

            .notification-item-content {
                flex: 1;
            }

            .notification-item-text {
                color: white;
                font-size: 13px;
                margin-bottom: 4px;
            }

            .notification-item-time {
                color: rgba(255,255,255,0.5);
                font-size: 11px;
            }

            .notification-item-close {
                background: none;
                border: none;
                color: rgba(255,255,255,0.3);
                cursor: pointer;
                padding: 5px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
            }

            .notification-item-close:hover {
                color: white;
                background: rgba(255,255,255,0.1);
            }

            .notification-empty {
                text-align: center;
                padding: 40px 20px;
                color: rgba(255,255,255,0.5);
            }

            .notification-empty i {
                font-size: 40px;
                margin-bottom: 10px;
                opacity: 0.5;
            }

            .notification-empty p {
                margin: 0;
                font-size: 14px;
            }

            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }

            @keyframes slideOutRight {
                from {
                    transform: translateX(100%);
                    opacity: 1;
                }
                to {
                    transform: translateX(0);
                    opacity: 0;
                }
            }

            .follower-notification {
                position: fixed;
                top: 80px;
                right: 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 15px;
                border-radius: 10px;
                box-shadow: 0 5px 20px rgba(0,0,0,0.2);
                z-index: 10001;
                display: flex;
                align-items: center;
                gap: 12px;
                min-width: 300px;
                animation: slideInRight 0.5s ease;
                cursor: pointer;
            }

            .follower-notification .notification-avatar {
                width: 50px;
                height: 50px;
                border-radius: 50%;
                object-fit: cover;
                border: 2px solid white;
            }

            .follower-notification .notification-content {
                flex: 1;
            }

            .follower-notification .notification-time {
                font-size: 11px;
                opacity: 0.8;
                margin-top: 4px;
            }

            .follower-notification .notification-close {
                background: none;
                border: none;
                color: white;
                opacity: 0.7;
                cursor: pointer;
                padding: 5px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
            }

            .follower-notification .notification-close:hover {
                opacity: 1;
                background: rgba(255,255,255,0.2);
            }
        `;

        document.head.appendChild(style);
    }
}

// ==================== INSTANT LOADING SYSTEM ====================
class InstantLoadingSystem {
    constructor() {
        this.appData = {
            profiles: [],
            profileDetails: {},
            followStatus: {},
            xpData: {},
            storeStatus: {}
        };
        this.isInitialized = false;
        this.initPromise = null;
        this.hasRenderedFromCache = false;
    }

    async initialize() {
        if (this.initPromise) return this.initPromise;
        
        this.initPromise = new Promise(async (resolve) => {
            console.log('🚀 Starting instant preload...');
            
            const preloadStartTime = Date.now();
            
            try {
                await indexedDBCache.init();
                
                const [profiles, details, xpData, storeStatus] = await Promise.allSettled([
                    indexedDBCache.getProfiles(),
                    this.loadAllProfileDetails(),
                    this.loadAllXPData(),
                    this.loadAllStoreStatus()
                ]);
                
                this.appData.profiles = profiles.value || [];
                this.appData.profileDetails = details.value || {};
                this.appData.xpData = xpData.value || {};
                this.appData.storeStatus = storeStatus.value || {};
                
                console.log(`⚡ Instant loaded ${this.appData.profiles.length} profiles from cache in ${Date.now() - preloadStartTime}ms`);
                
                allProfiles = this.appData.profiles;
                
            } catch (error) {
                console.error('Instant load error:', error);
            }
            
            this.isInitialized = true;
            resolve(this.appData);
        });
        
        return this.initPromise;
    }

    async loadAllProfileDetails() {
        const details = {};
        try {
            const allDetails = await indexedDBCache.getAll('profileDetails');
            allDetails.forEach(detail => {
                if (detail.userId) {
                    details[detail.userId] = detail;
                }
            });
        } catch (error) {
            console.log('Could not load profile details:', error);
        }
        return details;
    }

    async loadAllXPData() {
        const xpData = {};
        try {
            const allXP = await indexedDBCache.getAll('xpData');
            allXP.forEach(data => {
                if (data.userId) {
                    xpData[data.userId] = data;
                }
            });
        } catch (error) {
            console.log('Could not load XP data:', error);
        }
        return xpData;
    }

    async loadAllStoreStatus() {
        const storeStatus = {};
        try {
            const allStores = await indexedDBCache.getAll('stores');
            allStores.forEach(store => {
                if (store.ownerId) {
                    storeStatus[store.ownerId] = {
                        hasStore: true,
                        storeId: store.storeId || store.ownerId,
                        storeName: store.storeName
                    };
                }
            });
        } catch (error) {
            console.log('Could not load store status:', error);
        }
        return storeStatus;
    }

    renderInstantly() {
        if (this.hasRenderedFromCache) return;
        
        const gamersListElement = document.getElementById('gamersList');
        if (!gamersListElement) return;
        
        if (this.appData.profiles.length > 0) {
            console.log('⚡ Rendering instantly from cache...');
            this.hasRenderedFromCache = true;
            
            gamersListElement.innerHTML = '';
            allProfiles = this.appData.profiles;
            
            let filteredProfiles = [...allProfiles];
            
            switch(currentFilter) {
                case 'online':
                    filteredProfiles = allProfiles.filter(p => p.isOnline);
                    break;
                case 'highrank':
                    filteredProfiles = allProfiles.filter(p => 
                        p.isGamer && p.gamerProfile?.rank && 
                        ['diamond', 'platinum', 'gold', 'master', 'grandmaster', 'challenger']
                            .some(rank => p.gamerProfile.rank.toLowerCase().includes(rank))
                    );
                    break;
                case 'clan':
                    filteredProfiles = allProfiles.filter(p => p.clanCount > 0);
                    break;
                case 'xp':
                    filteredProfiles = allProfiles.filter(p => p.xpLevel && p.xpLevel >= 10);
                    break;
            }
            
            filteredProfiles.forEach(profile => {
                gamersListElement.appendChild(createProfileItem(profile));
            });
            
            if (typeof feather !== 'undefined') {
                feather.replace();
            }
            
            console.log('✅ Instant render complete');
        }
    }

    startBackgroundRefresh() {
        setTimeout(async () => {
            console.log('🔄 Starting background refresh...');
            await fetchFreshProfiles(true);
            
            setInterval(async () => {
                if (document.visibilityState === 'visible' && isOnline) {
                    await fetchFreshProfiles(true);
                }
            }, 30000);
        }, 2000);
    }

    getProfile(userId) {
        return this.appData.profiles.find(p => p.id === userId);
    }

    getProfileDetail(userId) {
        return this.appData.profileDetails[userId];
    }

    getXPData(userId) {
        return this.appData.xpData[userId];
    }

    getStoreStatus(userId) {
        return this.appData.storeStatus[userId];
    }

    updateProfile(profile) {
        const index = this.appData.profiles.findIndex(p => p.id === profile.id);
        if (index !== -1) {
            this.appData.profiles[index] = profile;
        } else {
            this.appData.profiles.push(profile);
        }
    }

    updateProfileDetail(userId, detail) {
        this.appData.profileDetails[userId] = detail;
    }

    updateXPData(userId, xpData) {
        this.appData.xpData[userId] = xpData;
    }

    updateStoreStatus(userId, storeData) {
        this.appData.storeStatus[userId] = storeData;
    }
}

// ==================== INDEXEDDB CACHE SYSTEM ====================
class GamersIndexedDBCache {
    constructor() {
        this.dbName = 'GamersAppDB';
        this.dbVersion = 12;
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
                    const profilesStore = db.createObjectStore('profiles', { keyPath: 'id' });
                    profilesStore.createIndex('lastUpdated', 'lastUpdated', { unique: false });
                    profilesStore.createIndex('isOnline', 'isOnline', { unique: false });
                }
                if (!db.objectStoreNames.contains('gamerProfiles')) {
                    db.createObjectStore('gamerProfiles', { keyPath: 'userId' });
                }
                if (!db.objectStoreNames.contains('profileDetails')) {
                    db.createObjectStore('profileDetails', { keyPath: 'userId' });
                }
                if (!db.objectStoreNames.contains('followStatus')) {
                    const followStore = db.createObjectStore('followStatus', { keyPath: 'id' });
                    followStore.createIndex('userId_targetId', ['userId', 'targetId'], { unique: true });
                }
                if (!db.objectStoreNames.contains('xpData')) {
                    db.createObjectStore('xpData', { keyPath: 'userId' });
                }
                if (!db.objectStoreNames.contains('stores')) {
                    const storesStore = db.createObjectStore('stores', { keyPath: 'ownerId' });
                    storesStore.createIndex('storeId', 'storeId', { unique: true });
                    storesStore.createIndex('storeName', 'storeName', { unique: false });
                }
                if (!db.objectStoreNames.contains('followers')) {
                    const followersStore = db.createObjectStore('followers', { keyPath: 'userId' });
                    followersStore.createIndex('lastUpdated', 'lastUpdated', { unique: false });
                }
                if (!db.objectStoreNames.contains('notifications')) {
                    const notificationsStore = db.createObjectStore('notifications', { keyPath: 'userId' });
                    notificationsStore.createIndex('lastUpdated', 'lastUpdated', { unique: false });
                }
            };
        });
    }

    async set(storeName, key, data) {
        if (!this.db) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            
            let record;
            if (storeName === 'followers' || storeName === 'notifications') {
                record = {
                    userId: key,
                    data: data,
                    lastUpdated: Date.now()
                };
            } else {
                record = {
                    ...data,
                    lastUpdated: Date.now()
                };
            }
            
            const request = store.put(record);
            
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
                if (result && (storeName === 'followers' || storeName === 'notifications')) {
                    resolve(result.data);
                } else {
                    resolve(result);
                }
            };
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
            } else {
                request = store.getAll();
            }
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                let results = request.result || [];
                if (storeName === 'followers' || storeName === 'notifications') {
                    results = results.map(r => r.data);
                }
                resolve(results);
            };
        });
    }

    async setProfiles(profiles) {
        await this.init();
        for (const profile of profiles) {
            await this.set('profiles', profile.id, profile);
        }
    }

    async getProfiles() {
        await this.init();
        return await this.getAll('profiles');
    }

    async setProfileDetail(userId, detail) {
        await this.init();
        return await this.set('profileDetails', userId, {
            userId,
            ...detail
        });
    }

    async getProfileDetail(userId) {
        await this.init();
        return await this.get('profileDetails', userId);
    }

    async setFollowStatus(userId, targetId, isFollowing) {
        await this.init();
        return await this.set('followStatus', `${userId}_${targetId}`, {
            id: `${userId}_${targetId}`,
            userId,
            targetId,
            isFollowing
        });
    }

    async getFollowStatus(userId, targetId) {
        await this.init();
        const status = await this.get('followStatus', `${userId}_${targetId}`);
        return status ? status.isFollowing : false;
    }

    async setXPData(userId, xpData) {
        await this.init();
        return await this.set('xpData', userId, {
            userId,
            ...xpData
        });
    }

    async getXPData(userId) {
        await this.init();
        return await this.get('xpData', userId);
    }

    async setStore(storeData) {
        await this.init();
        return await this.set('stores', storeData.ownerId, {
            ownerId: storeData.ownerId,
            storeId: storeData.storeId,
            storeName: storeData.storeName,
            logo: storeData.logo,
            category: storeData.category
        });
    }

    async getStore(ownerId) {
        await this.init();
        return await this.get('stores', ownerId);
    }

    async getAllStores() {
        await this.init();
        return await this.getAll('stores');
    }

    async setFollowers(userId, followers) {
        await this.init();
        return await this.set('followers', userId, followers);
    }

    async getFollowers(userId) {
        await this.init();
        return await this.get('followers', userId) || [];
    }

    async setNotifications(userId, notifications) {
        await this.init();
        return await this.set('notifications', userId, notifications);
    }

    async getNotifications(userId) {
        await this.init();
        return await this.get('notifications', userId) || [];
    }
}

const indexedDBCache = new GamersIndexedDBCache();
const instantLoader = new InstantLoadingSystem();

// ==================== SERVICE WORKER REGISTRATION ====================
async function registerServiceWorker() {
    if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost')) {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('Service Worker registered for gamers.js');
            
            if ('sync' in registration) {
                try {
                    await registration.sync.register('gamers-data-sync');
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
        this.cachePrefix = 'gamers_';
        this.cacheExpiry = {
            short: 1 * 60 * 1000,
            medium: 5 * 60 * 1000,
            long: 30 * 60 * 1000
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
    
    if (!isOnline) {
        handleNetworkOffline();
    }
}

async function handleNetworkOnline() {
    isOnline = true;
    
    const offlineIndicator = document.getElementById('offlineIndicator');
    if (offlineIndicator) {
        offlineIndicator.style.display = 'none';
    }
    
    showNotification('Connection restored', 'success', 2000);
    
    if (isGamersPage) {
        await fetchFreshProfiles(true);
    } else if (isProfilePage) {
        const urlParams = new URLSearchParams(window.location.search);
        const profileId = urlParams.get('id');
        if (profileId) {
            await fetchFreshProfileData(profileId);
        }
    }
}

function handleNetworkOffline() {
    isOnline = false;
    
    const offlineIndicator = document.getElementById('offlineIndicator');
    if (offlineIndicator) {
        offlineIndicator.style.display = 'block';
    }
    
    showNotification('No internet connection - working offline', 'offline', 5000);
}

// ==================== GLOBAL VARIABLES ====================
let currentUser = null;
let allProfiles = [];
let currentFilter = 'all';
let xpSystem = null;
let isLoading = false;
let storeStatusCache = {};

const isProfilePage = window.location.pathname.includes('profile.html');
const isGamersPage = window.location.pathname.includes('gamers.html') || 
                     window.location.pathname.includes('mingle.html');
const isXpPage = window.location.pathname.includes('xp.html');

const followerNotifier = new FollowerNotificationSystem();

// ==================== XP SYSTEM INTEGRATION (FIXED) ====================
async function loadXPSystem() {
    if (xpSystem) return xpSystem;
    
    try {
        // Try to import from xp.js
        const xpModule = await import('./xp.js');
        console.log('XP Module loaded:', xpModule);
        
        // Check different possible export patterns
        if (xpModule.XPSystem) {
            // If it's a class, instantiate it
            if (typeof xpModule.XPSystem === 'function') {
                xpSystem = new xpModule.XPSystem();
            } else {
                // If it's already an instance
                xpSystem = xpModule.XPSystem;
            }
        } else if (xpModule.default) {
            // Handle default export
            if (typeof xpModule.default === 'function') {
                xpSystem = new xpModule.default();
            } else {
                xpSystem = xpModule.default;
            }
        } else if (typeof xpModule === 'function') {
            // If the module itself is a class/function
            xpSystem = new xpModule();
        } else {
            // Try window object as fallback
            xpSystem = window.XPSystem;
        }
        
        // If we still don't have xpSystem, create a mock one
        if (!xpSystem) {
            console.warn('XP System not found, creating mock XP system');
            xpSystem = createMockXPSystem();
        }
        
        // Initialize if it has an initialize method
        if (xpSystem.initialize && typeof xpSystem.initialize === 'function') {
            await xpSystem.initialize();
        }
        
        startXPTracking();
        console.log('XP System loaded successfully:', xpSystem);
        return xpSystem;
    } catch (error) {
        console.error('Error loading XP system:', error);
        // Create a mock XP system to prevent errors
        xpSystem = createMockXPSystem();
        return xpSystem;
    }
}

// Create a mock XP system to prevent errors
function createMockXPSystem() {
    return {
        initialize: async () => {
            console.log('Mock XP System initialized');
        },
        addXP: async (amount, reason) => {
            console.log(`Mock: Would add ${amount} XP for ${reason}`);
            return true;
        },
        getXP: () => {
            return { totalXP: 0, level: 1 };
        }
    };
}

function startXPTracking() {
    if (!xpSystem) return;
    
    let activityTimer = null;
    let lastActivityTime = Date.now();
    
    const awardXPForActivity = async (activity, xpAmount, reason) => {
        try {
            if (xpSystem && currentUser) {
                // Check if addXP exists before calling
                if (typeof xpSystem.addXP === 'function') {
                    await xpSystem.addXP(xpAmount, reason);
                    console.log(`Awarded ${xpAmount} XP for ${activity}`);
                } else {
                    console.log('XP System does not have addXP method');
                }
            }
        } catch (error) {
            console.error(`Error awarding XP for ${activity}:`, error);
        }
    };
    
    const activityEvents = ['click', 'scroll', 'mousemove', 'keydown'];
    activityEvents.forEach(event => {
        document.addEventListener(event, () => {
            lastActivityTime = Date.now();
            
            if (activityTimer) clearTimeout(activityTimer);
            
            activityTimer = setTimeout(async () => {
                const timeSinceLastActivity = Date.now() - lastActivityTime;
                if (timeSinceLastActivity >= 3 * 60 * 1000) {
                    await awardXPForActivity('online_activity', 10, '3 Minutes Online Activity');
                }
            }, 3 * 60 * 1000);
        }, { passive: true });
    });
    
    if (isProfilePage) {
        setTimeout(async () => {
            await awardXPForActivity('profile_view', 5, 'Viewed a Profile');
        }, 5000);
    }
    
    const messageButtons = document.querySelectorAll('.message-gamer-btn, #messageProfileBtn');
    messageButtons.forEach(button => {
        button.addEventListener('click', async () => {
            setTimeout(async () => {
                await awardXPForActivity('message_sent', 5, 'Sent a Message');
            }, 1000);
        });
    });
    
    const followButtons = document.querySelectorAll('.add-clan-btn, #likeProfileBtn');
    followButtons.forEach(button => {
        button.addEventListener('click', async () => {
            if (button.classList.contains('added') || button.dataset.following === 'true') {
                return;
            }
            
            setTimeout(async () => {
                await awardXPForActivity('friend_add', 15, 'Added a Friend');
            }, 1000);
        });
    });
}

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Initializing with instant loading...');
    
    await instantLoader.initialize();
    await followerNotifier.initialize();
    
    if (isGamersPage) {
        instantLoader.renderInstantly();
        setupEventListeners();
    }
    
    await registerServiceWorker();
    setupNetworkMonitoring();
    
    if (!isXpPage) {
        await loadXPSystem();
    }
    
    onAuthStateChanged(auth, async (user) => {
        console.log('🔐 Auth state changed:', user ? 'User logged in' : 'No user');
        currentUser = user;
        
        if (!isLoading) {
            if (isGamersPage) {
                setTimeout(() => {
                    instantLoader.startBackgroundRefresh();
                }, 1000);
            } else if (isProfilePage) {
                const urlParams = new URLSearchParams(window.location.search);
                const profileId = urlParams.get('id');
                
                if (profileId) {
                    const cachedProfile = instantLoader.getProfileDetail(profileId);
                    if (cachedProfile) {
                        console.log('⚡ Loading profile from instant cache');
                        updateProfileHeader(profileId, cachedProfile);
                        updateProfileInfo(profileId, cachedProfile);
                    }
                    
                    setupProfileEventListeners(profileId);
                    
                    setTimeout(() => fetchFreshProfileData(profileId), 1000);
                }
            }
        }
    }, (error) => {
        console.error('Auth error:', error);
    });
});

// ==================== NUMBER FORMATTING FUNCTION ====================
function formatNumber(num) {
    if (typeof num !== 'number') {
        num = parseInt(num) || 0;
    }
    
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    }
    return num.toString();
}

// ==================== GAMERS DIRECTORY FUNCTIONALITY ====================
async function initGamersDirectory() {
    try {
        if (typeof feather !== 'undefined') {
            feather.replace();
        }
        
        setupEventListeners();
        
    } catch (error) {
        console.error('Error initializing:', error);
        showError('Failed to initialize. Please refresh.', true);
    }
}

async function fetchFreshProfiles(silentRefresh = false) {
    if (isLoading) return;
    
    isLoading = true;
    try {
        if (!db) {
            console.error('Firestore not initialized');
            if (!silentRefresh) showError('Database service unavailable', false);
            return;
        }
        
        if (!silentRefresh) {
            const gamersListElement = document.getElementById('gamersList');
            if (gamersListElement && gamersListElement.children.length === 0) {
                gamersListElement.innerHTML = '';
                for (let i = 0; i < 3; i++) {
                    gamersListElement.appendChild(createLoadingProfileItem());
                }
            }
        }
        
        const usersRef = collection(db, 'users');
        console.log('🔄 Querying users collection...');
        
        const usersSnap = await getDocs(usersRef);
        console.log(`📊 Found ${usersSnap.size} users`);
        
        const storesRef = collection(db, 'stores');
        const storesSnap = await getDocs(storesRef);
        const storesMap = {};
        storesSnap.forEach(doc => {
            const storeData = doc.data();
            storesMap[storeData.ownerId] = {
                hasStore: true,
                storeId: doc.id,
                storeName: storeData.storeName,
                storeLogo: storeData.logoThumbnail || storeData.logo
            };
        });
        
        const newProfiles = [];
        const currentUserId = currentUser ? currentUser.uid : null;
        
        const profilePromises = [];
        
        usersSnap.forEach((userDoc) => {
            const userId = userDoc.id;
            const userData = userDoc.data();
            
            if (currentUserId && userId === currentUserId) {
                console.log('Skipping current user:', userId);
                return;
            }
            
            profilePromises.push(processUserProfile(userId, userData, storesMap[userId]));
        });
        
        const profiles = await Promise.all(profilePromises);
        newProfiles.push(...profiles.filter(profile => profile !== null));
        
        console.log(`✅ Loaded ${newProfiles.length} fresh profiles from Firebase`);
        
        newProfiles.sort((a, b) => {
            if (a.isOnline && !b.isOnline) return -1;
            if (!a.isOnline && b.isOnline) return 1;
            return a.name.localeCompare(b.name);
        });
        
        allProfiles = newProfiles;
        
        newProfiles.forEach(profile => {
            instantLoader.updateProfile(profile);
        });
        
        try {
            await indexedDBCache.setProfiles(newProfiles);
            console.log('💾 Profiles cached in IndexedDB');
        } catch (cacheError) {
            console.log('Could not cache profiles in IndexedDB:', cacheError);
        }
        
        cache.set('all_profiles', newProfiles, 'short');
        
        if (!silentRefresh || !instantLoader.hasRenderedFromCache) {
            renderProfilesList();
        } else {
            smoothUpdateProfiles(newProfiles);
        }
        
    } catch (error) {
        console.error('❌ Error loading profiles:', error);
        if (!silentRefresh) {
            showError(`Failed to load profiles: ${error.message}`, true);
            
            const cachedProfiles = cache.get('all_profiles');
            if (cachedProfiles && cachedProfiles.length > 0) {
                console.log('Showing cached profiles from localStorage');
                allProfiles = cachedProfiles;
                if (!instantLoader.hasRenderedFromCache) {
                    renderProfilesList();
                }
            }
        }
    } finally {
        isLoading = false;
    }
}

function smoothUpdateProfiles(newProfiles) {
    const gamersListElement = document.getElementById('gamersList');
    if (!gamersListElement) return;
    
    const existingItems = Array.from(gamersListElement.children);
    const updatedIds = new Set(newProfiles.map(p => p.id));
    
    existingItems.forEach(item => {
        const profileId = item.dataset.profileId;
        if (profileId && !updatedIds.has(profileId)) {
            item.remove();
        }
    });
    
    newProfiles.forEach((profile, index) => {
        const existingItem = gamersListElement.querySelector(`[data-profile-id="${profile.id}"]`);
        if (existingItem) {
            updateProfileItem(existingItem, profile);
        } else {
            const newItem = createProfileItem(profile);
            if (index === 0) {
                gamersListElement.prepend(newItem);
            } else {
                const existingNextItem = gamersListElement.querySelector(`[data-profile-id="${newProfiles[index-1]?.id}"]`);
                if (existingNextItem && existingNextItem.nextElementSibling) {
                    existingNextItem.parentNode.insertBefore(newItem, existingNextItem.nextElementSibling);
                } else {
                    gamersListElement.appendChild(newItem);
                }
            }
        }
    });
}

function updateProfileItem(item, profile) {
    const currentFollowing = item.querySelector('.add-clan-btn')?.dataset.following;
    const currentOnline = item.querySelector('.gamer-stat[title*="Online"]')?.textContent.includes('Online');
    
    if (currentFollowing !== String(profile.isFollowing) || 
        currentOnline !== profile.isOnline) {
        
        const newItem = createProfileItem(profile);
        item.replaceWith(newItem);
    }
}

async function processUserProfile(userId, userData, storeInfo = null) {
    try {
        const profile = {
            id: userId,
            name: userData.name || 'User ' + userId.substring(0, 6),
            email: userData.email || 'No email',
            profileImage: userData.profileImage || 'images-default-profile.jpg',
            age: userData.age || null,
            location: userData.location || 'Unknown',
            bio: userData.bio || 'No bio available',
            interests: userData.interests || [],
            likes: userData.likes || 0,
            isOnline: false,
            isGamer: false,
            gamerProfile: null,
            clanCount: 0,
            isFollowing: false,
            xpLevel: 1,
            xpRank: "Newbie Explorer",
            xpIcon: "🌱",
            totalXP: 0,
            hasStore: storeInfo ? true : false,
            storeId: storeInfo ? storeInfo.storeId : null,
            storeName: storeInfo ? storeInfo.storeName : null,
            storeLogo: storeInfo ? storeInfo.storeLogo : null
        };
        
        try {
            const statusRef = doc(db, 'status', userId);
            const statusSnap = await getDoc(statusRef);
            profile.isOnline = statusSnap.exists() && statusSnap.data().state === 'online';
        } catch (error) {
            console.log('Could not get status for user:', userId);
        }
        
        try {
            const gamerProfileRef = collection(db, 'users', userId, 'gamerProfile');
            const gamerProfileSnap = await getDocs(gamerProfileRef);
            if (!gamerProfileSnap.empty) {
                profile.isGamer = true;
                profile.gamerProfile = gamerProfileSnap.docs[0].data();
            }
        } catch (error) {
            console.log('No gamer profile for:', userId);
        }
        
        profile.clanCount = await getFollowersCount(userId);
        
        if (currentUser) {
            try {
                const cachedStatus = await indexedDBCache.getFollowStatus(currentUser.uid, userId);
                if (cachedStatus !== undefined) {
                    profile.isFollowing = cachedStatus;
                } else {
                    profile.isFollowing = await checkIfFollowing(userId, currentUser.uid);
                    await indexedDBCache.setFollowStatus(currentUser.uid, userId, profile.isFollowing);
                }
            } catch (error) {
                console.log('Error checking follow status:', error);
                profile.isFollowing = await checkIfFollowing(userId, currentUser.uid);
            }
        }
        
        try {
            const xpRef = doc(db, 'xpData', userId);
            const xpSnap = await getDoc(xpRef);
            if (xpSnap.exists()) {
                const xpData = xpSnap.data();
                profile.totalXP = xpData.totalXP || 0;
                profile.coins = xpData.coins || 0;
                
                const userRank = getRankFromXP(profile.totalXP);
                profile.xpLevel = userRank.level;
                profile.xpRank = userRank.title;
                profile.xpIcon = userRank.icon;
                profile.xpColor = userRank.color;
            }
        } catch (error) {
            console.log('No XP data for user:', userId);
        }
        
        if (storeInfo) {
            await indexedDBCache.setStore({
                ownerId: userId,
                storeId: storeInfo.storeId,
                storeName: storeInfo.storeName,
                logo: storeInfo.storeLogo
            });
            instantLoader.updateStoreStatus(userId, storeInfo);
        }
        
        return profile;
        
    } catch (error) {
        console.error('Error processing user profile:', userId, error);
        return null;
    }
}

function getRankFromXP(xp) {
    const XP_RANKS = [];
    for (let i = 1; i <= 100; i++) {
        let xpNeeded = 0;
        let title = "";
        let icon = "";
        let color = "";
        
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
        } else {
            title = `Level ${i}`;
            icon = "⭐";
            color = "#FFD700";
        }
        
        XP_RANKS.push({
            level: i,
            title: title,
            xpNeeded: xpNeeded,
            icon: icon,
            color: color
        });
    }
    
    let userRank = XP_RANKS[0];
    
    for (let i = XP_RANKS.length - 1; i >= 0; i--) {
        if (xp >= XP_RANKS[i].xpNeeded) {
            userRank = XP_RANKS[i];
            break;
        }
    }
    
    return userRank;
}

async function getFollowersCount(userId) {
    try {
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            const userData = userSnap.data();
            
            if (userData.followers && Array.isArray(userData.followers)) {
                return userData.followers.length;
            }
            
            return userData.likes || 0;
        }
        return 0;
    } catch (error) {
        console.error('Error getting followers count:', error);
        return 0;
    }
}

async function checkIfFollowing(targetUserId, currentUserId) {
    try {
        const targetUserRef = doc(db, 'users', targetUserId);
        const targetUserSnap = await getDoc(targetUserRef);
        
        if (targetUserSnap.exists()) {
            const targetUserData = targetUserSnap.data();
            
            if (targetUserData.followers && Array.isArray(targetUserData.followers)) {
                return targetUserData.followers.includes(currentUserId);
            }
        }
        return false;
    } catch (error) {
        console.error('Error checking following status:', error);
        return false;
    }
}

function renderProfilesList() {
    const gamersListElement = document.getElementById('gamersList');
    if (!gamersListElement) {
        console.error('Cannot find #gamersList element');
        return;
    }
    
    if (allProfiles.length === 0) {
        console.log('No profiles found');
        gamersListElement.innerHTML = `
            <div class="empty-state">
                <svg class="feather" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <h3 class="empty-title">No profiles yet</h3>
                <p>Be the first to create a profile!</p>
            </div>
        `;
        return;
    }
    
    console.log(`Rendering ${allProfiles.length} profiles`);
    
    let filteredProfiles = [...allProfiles];
    
    switch(currentFilter) {
        case 'online':
            filteredProfiles = allProfiles.filter(p => p.isOnline);
            break;
        case 'highrank':
            filteredProfiles = allProfiles.filter(p => 
                p.isGamer && p.gamerProfile?.rank && 
                ['diamond', 'platinum', 'gold', 'master', 'grandmaster', 'challenger']
                    .some(rank => p.gamerProfile.rank.toLowerCase().includes(rank))
            );
            break;
        case 'clan':
            filteredProfiles = allProfiles.filter(p => p.clanCount > 0);
            break;
        case 'xp':
            filteredProfiles = allProfiles.filter(p => p.xpLevel && p.xpLevel >= 10);
            break;
    }
    
    if (filteredProfiles.length === 0) {
        gamersListElement.innerHTML = `
            <div class="empty-state">
                <svg class="feather" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <h3 class="empty-title">No matching profiles</h3>
                <p>Try a different filter</p>
            </div>
        `;
        return;
    }
    
    gamersListElement.innerHTML = '';
    filteredProfiles.forEach(profile => {
        gamersListElement.appendChild(createProfileItem(profile));
    });
    
    if (typeof feather !== 'undefined') {
        feather.replace();
    }
    
    console.log('Profiles rendered successfully');
}

function createProfileItem(profile) {
    const div = document.createElement('div');
    div.className = 'gamer-item';
    div.dataset.profileId = profile.id;
    
    const attributes = [];
    if (profile.age) attributes.push(`${profile.age} yrs`);
    if (profile.location) attributes.push(profile.location);
    if (profile.isGamer && profile.gamerProfile?.primaryGame) {
        attributes.push(profile.gamerProfile.primaryGame);
    }
    
    const gamerBadge = profile.isGamer ? `
        <span class="attribute-tag" style="background: rgba(255, 42, 109, 0.2); border-color: #ff2a6d; color: #ff2a6d;">
            <svg class="feather" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width: 10px; height: 10px; margin-right: 3px;">
                <rect x="2" y="6" width="20" height="12" rx="2" ry="2"></rect>
                <path d="M12 6v12"></path>
                <path d="M2 12h20"></path>
            </svg>
            Gamer
        </span>
    ` : '';
    
    const storeBadge = profile.hasStore ? `
        <span class="attribute-tag" style="background: rgba(122, 79, 255, 0.2); border-color: #7a4fff; color: #7a4fff;">
            <i class="fas fa-store" style="font-size: 10px; margin-right: 3px;"></i>
            Store
        </span>
    ` : '';
    
    const buttonText = profile.isFollowing ? 'Following' : 'Follow';
    const buttonClass = profile.isFollowing ? 'add-clan-btn added' : 'add-clan-btn';
    const followersCount = profile.clanCount || 0;
    
    const xpBadge = profile.xpLevel ? `
        <span class="xp-badge" style="
            position: absolute;
            top: 5px;
            right: 5px;
            background: ${profile.xpColor || '#667eea'};
            color: white;
            border-radius: 50%;
            width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            z-index: 2;
            border: 2px solid white;
        " title="Level ${profile.xpLevel} - ${profile.xpRank}">
            ${profile.xpIcon || '🌱'}
        </span>
    ` : '';
    
    div.innerHTML = `
        <div style="position: relative;">
            <img src="${profile.profileImage}" alt="${profile.name}" class="gamer-avatar" 
                 onerror="this.onerror=null; this.src='images-default-profile.jpg';"
                 style="width: 70px; height: 70px; object-fit: cover; border-radius: 50%;">
            ${xpBadge}
        </div>
        <div class="gamer-info">
            <div class="gamer-header">
                <span class="gamer-name">${profile.name}</span>
                ${profile.isGamer && profile.gamerProfile?.gamerTag ? `
                    <span class="gamer-tag">${profile.gamerProfile.gamerTag}</span>
                ` : ''}
            </div>
            <div class="gamer-stats">
                ${profile.isGamer && profile.gamerProfile?.rank ? `
                    <span class="gamer-stat gamer-rank">
                        <svg class="feather" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                        </svg>
                        ${profile.gamerProfile.rank}
                    </span>
                ` : ''}
                <span class="gamer-stat" title="${profile.isOnline ? 'Online' : 'Offline'}">
                    <svg class="feather" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10"></circle>
                    </svg>
                    ${profile.isOnline ? 'Online' : 'Offline'}
                </span>
                ${profile.likes > 0 ? `
                    <span class="gamer-stat">
                        <svg class="feather" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                        </svg>
                        ${formatNumber(profile.likes)}
                    </span>
                ` : ''}
            </div>
            <div class="gamer-attributes">
                ${gamerBadge}
                ${storeBadge}
                ${attributes.slice(0, 2).map(attr => `
                    <span class="attribute-tag">${attr}</span>
                `).join('')}
                ${profile.interests && profile.interests.length > 0 ? `
                    <span class="attribute-tag">${profile.interests[0]}</span>
                ` : ''}
            </div>
            ${profile.bio && profile.bio.length > 40 ? `
                <div style="font-size: 11px; color: var(--text-light); margin-top: 4px; font-style: italic;">
                    "${profile.bio.substring(0, 40)}..."
                </div>
            ` : ''}
        </div>
        <div class="gamer-actions">
            <div class="clan-section">
                <span class="clan-count">
                    <svg class="feather" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                    ${formatNumber(followersCount)}
                </span>
            </div>
            ${profile.hasStore ? `
                <button class="store-btn" data-profile-id="${profile.id}" data-store-id="${profile.storeId}" title="Visit Store">
                    <i class="fas fa-store"></i>
                    Store
                </button>
            ` : ''}
            <button class="${buttonClass}" data-profile-id="${profile.id}" data-following="${profile.isFollowing}">
                ${profile.isFollowing ? `
                    <svg class="feather" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                ` : `
                    <svg class="feather" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="8.5" cy="7" r="4"></circle>
                        <line x1="20" y1="8" x2="20" y2="14"></line>
                        <line x1="23" y1="11" x2="17" y2="11"></line>
                    </svg>
                `}
                ${buttonText}
            </button>
            <button class="message-gamer-btn" data-profile-id="${profile.id}" title="Message ${profile.name}">
                <svg class="feather" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
            </button>
        </div>
    `;
    
    div.addEventListener('click', (e) => {
        if (!e.target.closest('.add-clan-btn') && 
            !e.target.closest('.clan-section') &&
            !e.target.closest('.message-gamer-btn') &&
            !e.target.closest('.store-btn')) {
            window.location.href = `profile.html?id=${profile.id}`;
        }
    });
    
    const storeBtn = div.querySelector('.store-btn');
    if (storeBtn) {
        storeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            window.location.href = `store.html?id=${profile.storeId}`;
        });
    }
    
    const clanBtn = div.querySelector('.add-clan-btn');
    if (clanBtn) {
        clanBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            
            if (!currentUser) {
                showNotification('Please log in to follow users', 'warning');
                window.location.href = 'login.html';
                return;
            }
            
            const isCurrentlyFollowing = clanBtn.dataset.following === 'true';
            
            try {
                if (isCurrentlyFollowing) {
                    await unfollowUser(profile.id);
                    clanBtn.dataset.following = 'false';
                    clanBtn.innerHTML = `
                        <svg class="feather" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                            <circle cx="8.5" cy="7" r="4"></circle>
                            <line x1="20" y1="8" x2="20" y2="14"></line>
                            <line x1="23" y1="11" x2="17" y2="11"></line>
                        </svg>
                        Follow
                    `;
                    clanBtn.classList.remove('added');
                    
                    const clanCountSpan = div.querySelector('.clan-count');
                    const currentCount = parseInt(clanCountSpan.textContent.replace(/[kM]$/, '')) || 0;
                    const newCount = Math.max(0, currentCount - 1);
                    clanCountSpan.textContent = formatNumber(newCount);
                    
                    await indexedDBCache.setFollowStatus(currentUser.uid, profile.id, false);
                    
                    showNotification(`Unfollowed ${profile.name}`, 'info');
                } else {
                    await followUser(profile.id);
                    clanBtn.dataset.following = 'true';
                    clanBtn.innerHTML = `
                        <svg class="feather" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                        </svg>
                        Following
                    `;
                    clanBtn.classList.add('added');
                    
                    const clanCountSpan = div.querySelector('.clan-count');
                    const currentCount = parseInt(clanCountSpan.textContent.replace(/[kM]$/, '')) || 0;
                    const newCount = currentCount + 1;
                    clanCountSpan.textContent = formatNumber(newCount);
                    
                    await indexedDBCache.setFollowStatus(currentUser.uid, profile.id, true);
                    
                    // Safely award XP
                    if (xpSystem && typeof xpSystem.addXP === 'function') {
                        await xpSystem.addXP(15, `Followed ${profile.name}`);
                    }
                    
                    showNotification(`Now following ${profile.name}`, 'success');
                }
            } catch (error) {
                console.error('Error toggling follow:', error);
                showNotification('Failed to update follow status', 'error');
            }
        });
    }
    
    const messageBtn = div.querySelector('.message-gamer-btn');
    if (messageBtn) {
        messageBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            
            if (!currentUser) {
                showNotification('Please log in to send messages', 'warning');
                window.location.href = 'login.html';
                return;
            }
            
            if (currentUser.uid === profile.id) {
                showNotification('You cannot message yourself', 'info');
                return;
            }
            
            window.location.href = `chat.html?id=${profile.id}`;
        });
    }
    
    return div;
}

const style = document.createElement('style');
style.textContent = `
    .store-btn {
        background: linear-gradient(135deg, #7a4fff, #ff2a6d);
        color: white;
        border: none;
        border-radius: 20px;
        padding: 6px 12px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 5px;
        transition: all 0.3s ease;
        margin-right: 5px;
    }
    
    .store-btn i {
        font-size: 12px;
    }
    
    .store-btn:hover {
        transform: scale(1.05);
        box-shadow: 0 5px 15px rgba(122, 79, 255, 0.3);
    }
    
    .gamer-actions {
        display: flex;
        align-items: center;
        gap: 5px;
    }
`;
document.head.appendChild(style);

// ==================== PROFILE PAGE FUNCTIONALITY ====================
async function initProfilePage() {
    try {
        if (typeof feather !== 'undefined') {
            feather.replace();
        }
        
        const urlParams = new URLSearchParams(window.location.search);
        const profileId = urlParams.get('id');
        
        if (!profileId) {
            console.error('No profile ID in URL');
            showError('Profile not found', false);
            return;
        }
        
        console.log('Loading profile:', profileId);
        
    } catch (error) {
        console.error('Error initializing profile page:', error);
        showError('Failed to load profile. Please refresh.', true);
    }
}

async function addXPDisplayToProfile(profileId) {
    try {
        const xpRef = doc(db, 'xpData', profileId);
        const xpSnap = await getDoc(xpRef);
        
        if (xpSnap.exists()) {
            const xpData = xpSnap.data();
            const userRank = getRankFromXP(xpData.totalXP || 0);
            
            const existingDisplay = document.querySelector('.profile-xp-display');
            if (existingDisplay) {
                existingDisplay.remove();
            }
            
            const profilePic = document.querySelector('.profile-pic, .profile-avatar, [class*="avatar"], img[alt*="profile"]');
            if (profilePic) {
                const existingXPIcon = profilePic.parentElement.querySelector('.profile-xp-icon');
                if (existingXPIcon) {
                    existingXPIcon.remove();
                }
                
                const xpIcon = document.createElement('div');
                xpIcon.className = 'profile-xp-icon';
                xpIcon.style.cssText = `
                    position: absolute;
                    bottom: 0;
                    right: 0;
                    background: ${userRank.color || '#667eea'};
                    color: white;
                    border-radius: 50%;
                    width: 40px;
                    height: 40px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 20px;
                    box-shadow: 0 3px 10px rgba(0,0,0,0.3);
                    z-index: 10;
                    border: 3px solid white;
                    cursor: pointer;
                `;
                xpIcon.innerHTML = userRank.icon;
                xpIcon.title = `Level ${userRank.level} - ${userRank.title}\n${xpData.totalXP || 0} XP • ${xpData.coins || 0} Coins`;
                
                xpIcon.addEventListener('mouseenter', () => {
                    xpIcon.style.transform = 'scale(1.1)';
                    xpIcon.style.boxShadow = '0 5px 15px rgba(0,0,0,0.4)';
                });
                
                xpIcon.addEventListener('mouseleave', () => {
                    xpIcon.style.transform = 'scale(1)';
                    xpIcon.style.boxShadow = '0 3px 10px rgba(0,0,0,0.3)';
                });
                
                xpIcon.addEventListener('click', (e) => {
                    e.stopPropagation();
                    showXPTooltip(xpIcon, userRank, xpData);
                });
                
                profilePic.parentElement.style.position = 'relative';
                profilePic.parentElement.appendChild(xpIcon);
            }
            
            addTriumphIconsToProfile(profileId, userRank.level);
            
        } else {
            console.log('No XP data found for user:', profileId);
        }
    } catch (error) {
        console.error('Error adding XP display to profile:', error);
    }
}

function showXPTooltip(element, userRank, xpData) {
    const existingTooltip = document.querySelector('.xp-tooltip');
    if (existingTooltip) {
        existingTooltip.remove();
    }
    
    const tooltip = document.createElement('div');
    tooltip.className = 'xp-tooltip';
    tooltip.style.cssText = `
        position: absolute;
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 15px;
        border-radius: 10px;
        z-index: 1000;
        min-width: 200px;
        box-shadow: 0 5px 20px rgba(0,0,0,0.5);
        backdrop-filter: blur(10px);
        animation: fadeIn 0.3s ease;
    `;
    
    tooltip.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
            <div style="font-size: 24px;">${userRank.icon}</div>
            <div>
                <div style="font-weight: bold; font-size: 16px;">${userRank.title}</div>
                <div style="font-size: 12px; opacity: 0.8;">Level ${userRank.level}</div>
            </div>
        </div>
        <div style="border-top: 1px solid rgba(255,255,255,0.2); padding-top: 10px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <span style="opacity: 0.8;">Total XP:</span>
                <span style="font-weight: bold;">${xpData.totalXP || 0}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
                <span style="opacity: 0.8;">Coins:</span>
                <span style="font-weight: bold;">${xpData.coins || 0} 🪙</span>
            </div>
        </div>
    `;
    
    const rect = element.getBoundingClientRect();
    tooltip.style.top = `${rect.top - tooltip.offsetHeight - 10}px`;
    tooltip.style.left = `${rect.left + (rect.width / 2) - 100}px`;
    
    document.body.appendChild(tooltip);
    
    if (!document.getElementById('xpTooltipAnimations')) {
        const style = document.createElement('style');
        style.id = 'xpTooltipAnimations';
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
        `;
        document.head.appendChild(style);
    }
    
    setTimeout(() => {
        const closeTooltip = (e) => {
            if (!tooltip.contains(e.target) && !element.contains(e.target)) {
                tooltip.remove();
                document.removeEventListener('click', closeTooltip);
            }
        };
        document.addEventListener('click', closeTooltip);
    }, 100);
}

function addTriumphIconsToProfile(profileId, level) {
    const profilePic = document.querySelector('.profile-pic, .profile-avatar, [class*="avatar"], img[alt*="profile"]');
    if (!profilePic) return;
    
    const existingIcons = document.querySelector('.triumph-icons-container');
    if (existingIcons) {
        existingIcons.remove();
    }
    
    if (level < 5) return;
    
    const iconContainer = document.createElement('div');
    iconContainer.className = 'triumph-icons-container';
    iconContainer.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 5;
    `;
    
    const iconCount = Math.min(Math.floor(level / 5), 10);
    const triumphIcons = ['🏆', '⭐', '👑', '💎', '🔥', '✨', '🎮', '⚔️', '🛡️', '🌟'];
    
    for (let i = 0; i < iconCount; i++) {
        const icon = document.createElement('div');
        icon.className = 'triumph-icon';
        icon.textContent = triumphIcons[i % triumphIcons.length];
        icon.style.cssText = `
            position: absolute;
            font-size: ${15 + (level / 10)}px;
            opacity: 0.7;
            animation: triumphFloat ${3 + Math.random() * 5}s infinite ease-in-out;
            filter: drop-shadow(0 0 5px gold);
        `;
        
        const angle = Math.random() * Math.PI * 2;
        const radius = 60 + (level * 1.5);
        icon.style.left = `calc(50% + ${Math.cos(angle) * radius}px)`;
        icon.style.top = `calc(50% + ${Math.sin(angle) * radius}px)`;
        
        iconContainer.appendChild(icon);
    }
    
    profilePic.parentElement.style.position = 'relative';
    profilePic.parentElement.appendChild(iconContainer);
    
    if (!document.getElementById('triumphAnimations')) {
        const style = document.createElement('style');
        style.id = 'triumphAnimations';
        style.textContent = `
            @keyframes triumphFloat {
                0%, 100% { transform: translate(0, 0) rotate(0deg); }
                25% { transform: translate(${Math.random() * 20 - 10}px, ${Math.random() * 20 - 10}px) rotate(90deg); }
                50% { transform: translate(${Math.random() * 20 - 10}px, ${Math.random() * 20 - 10}px) rotate(180deg); }
                75% { transform: translate(${Math.random() * 20 - 10}px, ${Math.random() * 20 - 10}px) rotate(270deg); }
            }
        `;
        document.head.appendChild(style);
    }
}

async function loadProfileData(profileId, forceRefresh = false) {
    try {
        if (!db) {
            console.error('Firestore not initialized');
            showError('Database service unavailable', false);
            return;
        }
        
        if (!forceRefresh) {
            const cachedDetail = instantLoader.getProfileDetail(profileId);
            if (cachedDetail) {
                console.log('⚡ Loading profile from instant cache');
                updateProfileHeader(profileId, cachedDetail);
                updateProfileInfo(profileId, cachedDetail);
                
                setTimeout(() => fetchFreshProfileData(profileId), 100);
                return;
            }
        }
        
        await fetchFreshProfileData(profileId);
        
    } catch (error) {
        console.error('Error loading profile data:', error);
        showError(`Failed to load profile: ${error.message}`, true);
    }
}

async function fetchFreshProfileData(profileId) {
    try {
        const userRef = doc(db, 'users', profileId);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
            showError('Profile not found', false);
            return;
        }
        
        const userData = userSnap.data();
        
        updateProfileHeader(profileId, userData);
        updateProfileInfo(profileId, userData);
        await updateFollowersCount(profileId);
        await updateFollowButton(profileId);
        await loadGamerProfile(profileId);
        
        try {
            await indexedDBCache.setProfileDetail(profileId, userData);
            instantLoader.updateProfileDetail(profileId, userData);
            console.log('💾 Profile detail cached');
        } catch (cacheError) {
            console.log('Could not cache profile detail:', cacheError);
        }
        
        await addXPDisplayToProfile(profileId);
        
    } catch (error) {
        console.error('Error loading fresh profile data:', error);
    }
}

function updateProfileHeader(profileId, userData) {
    const profileNameElement = document.getElementById('viewProfileName');
    if (profileNameElement) {
        profileNameElement.textContent = userData.name || 'User';
    }
    
    const profileAgeElement = document.getElementById('viewProfileAge');
    const profileLocationElement = document.getElementById('viewProfileLocation');
    
    if (profileAgeElement) {
        profileAgeElement.textContent = userData.age ? `${userData.age} yrs` : 'No age specified';
    }
    
    if (profileLocationElement) {
        profileLocationElement.textContent = userData.location || 'Location unknown';
    }
    
    const profileImageElement = document.getElementById('mainProfileImage');
    if (profileImageElement && userData.profileImage) {
        profileImageElement.src = userData.profileImage;
    }
    
    const profileBioElement = document.getElementById('viewProfileBio');
    if (profileBioElement) {
        profileBioElement.textContent = userData.bio || 'No bio available';
    }
    
    const profileBioElement2 = document.getElementById('viewProfileBio2');
    if (profileBioElement2) {
        profileBioElement2.textContent = userData.bio || 'No bio available';
    }
    
    updateOnlineStatus(profileId);
}

function updateProfileInfo(profileId, userData) {
    const emailElement = document.getElementById('viewProfileEmail');
    if (emailElement) {
        emailElement.textContent = userData.email || 'No email';
    }
    
    const workshopCountElement = document.getElementById('viewWorkshopCount');
    const workshopCountElement2 = document.getElementById('viewWorkshopCount2');
    if (workshopCountElement) {
        workshopCountElement.textContent = formatNumber(userData.workshops || 0);
    }
    if (workshopCountElement2) {
        workshopCountElement2.textContent = formatNumber(userData.workshops || 0);
    }
    
    const certCountElement = document.getElementById('viewCertCount');
    const certCountElement2 = document.getElementById('viewCertCount2');
    if (certCountElement) {
        certCountElement.textContent = formatNumber(userData.certifications || 0);
    }
    if (certCountElement2) {
        certCountElement2.textContent = formatNumber(userData.certifications || 0);
    }
    
    const interestsContainer = document.getElementById('interestsContainer');
    if (interestsContainer && userData.interests && Array.isArray(userData.interests)) {
        interestsContainer.innerHTML = '';
        userData.interests.forEach(interest => {
            const interestTag = document.createElement('span');
            interestTag.className = 'interest-tag';
            interestTag.textContent = interest;
            interestsContainer.appendChild(interestTag);
        });
    }
}

async function updateOnlineStatus(profileId) {
    try {
        const statusRef = doc(db, 'status', profileId);
        const statusSnap = await getDoc(statusRef);
        
        const onlineBadge = document.querySelector('.online-status-badge');
        const onlineStatusElement = document.querySelector('.online-status');
        
        if (statusSnap.exists() && statusSnap.data().state === 'online') {
            if (onlineBadge) onlineBadge.style.backgroundColor = '#00ff00';
            if (onlineStatusElement) {
                onlineStatusElement.innerHTML = `
                    <svg class="feather" data-feather="circle" fill="#00ff00">
                        <circle cx="12" cy="12" r="10"></circle>
                    </svg>
                    Online
                `;
            }
        } else {
            if (onlineBadge) onlineBadge.style.backgroundColor = '#ff0000';
            if (onlineStatusElement) {
                onlineStatusElement.innerHTML = `
                    <svg class="feather" data-feather="circle" fill="#ff0000">
                        <circle cx="12" cy="12" r="10"></circle>
                    </svg>
                    Offline
                `;
            }
        }
        
        if (typeof feather !== 'undefined') {
            feather.replace();
        }
    } catch (error) {
        console.log('Could not get status for user:', profileId);
    }
}

async function updateFollowersCount(profileId) {
    try {
        const count = await getFollowersCount(profileId);
        
        const followersStat = document.getElementById('followersCount');
        if (followersStat) {
            followersStat.textContent = formatNumber(count);
        }
        
    } catch (error) {
        console.error('Error updating followers count:', error);
    }
}

async function updateFollowButton(profileId) {
    const followBtn = document.getElementById('likeProfileBtn');
    if (!followBtn) return;
    
    if (!currentUser) {
        followBtn.innerHTML = '<svg class="feather" data-feather="log-in"></svg> Login to Follow';
        followBtn.classList.remove('btn-message');
        followBtn.classList.add('btn-follow');
        return;
    }
    
    if (currentUser.uid === profileId) {
        followBtn.style.display = 'none';
        return;
    }
    
    let isFollowing = false;
    try {
        const cachedStatus = await indexedDBCache.getFollowStatus(currentUser.uid, profileId);
        if (cachedStatus !== undefined) {
            isFollowing = cachedStatus;
        } else {
            isFollowing = await checkIfFollowing(profileId, currentUser.uid);
            await indexedDBCache.setFollowStatus(currentUser.uid, profileId, isFollowing);
        }
    } catch (error) {
        console.log('Error checking follow status from cache:', error);
        isFollowing = await checkIfFollowing(profileId, currentUser.uid);
    }
    
    if (isFollowing) {
        followBtn.innerHTML = '<svg class="feather" data-feather="user-check"></svg> Following';
        followBtn.classList.remove('btn-follow');
        followBtn.classList.add('btn-message');
        followBtn.dataset.following = 'true';
    } else {
        followBtn.innerHTML = '<svg class="feather" data-feather="user-plus"></svg> Follow';
        followBtn.classList.remove('btn-message');
        followBtn.classList.add('btn-follow');
        followBtn.dataset.following = 'false';
    }
    
    if (typeof feather !== 'undefined') {
        feather.replace();
    }
}

async function loadGamerProfile(profileId) {
    try {
        const gamerProfileRef = collection(db, 'users', profileId, 'gamerProfile');
        const gamerProfileSnap = await getDocs(gamerProfileRef);
        
        if (!gamerProfileSnap.empty) {
            const gamerProfile = gamerProfileSnap.docs[0].data();
            
            const gamerBadge = document.getElementById('gamerBadge');
            if (gamerBadge) {
                gamerBadge.style.display = 'inline-flex';
            }
            
            const gamerSection = document.getElementById('gamerProfileSection');
            if (gamerSection) {
                gamerSection.style.display = 'block';
                
                const gamerBasicInfo = document.getElementById('gamerBasicInfo');
                if (gamerBasicInfo) {
                    gamerBasicInfo.innerHTML = `
                        <div class="gamer-info-row">
                            <svg class="feather" data-feather="user">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                            </svg>
                            <span>Gamer Tag: <strong>${gamerProfile.gamerTag || 'Not set'}</strong></span>
                        </div>
                        <div class="gamer-info-row">
                            <svg class="feather" data-feather="gamepad">
                                <line x1="6" y1="12" x2="10" y2="12"></line>
                                <line x1="8" y1="10" x2="8" y2="14"></line>
                                <line x1="15" y1="13" x2="15.01" y2="13"></line>
                                <line x1="18" y1="11" x2="18.01" y2="11"></line>
                                <rect x="2" y="6" width="20" height="12" rx="2"></rect>
                            </svg>
                            <span>Primary Game: <strong>${gamerProfile.primaryGame || 'Not specified'}</strong></span>
                        </div>
                        <div class="gamer-info-row">
                            <svg class="feather" data-feather="star">
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                            </svg>
                            <span>Rank: <strong>${gamerProfile.rank || 'Not ranked'}</strong></span>
                        </div>
                        <div class="gamer-info-row">
                            <svg class="feather" data-feather="trending-up">
                                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
                            </svg>
                            <span>Level: <strong>${gamerProfile.level || '1'}</strong></span>
                        </div>
                    `;
                }
                
                const gamerStatsGrid = document.getElementById('gamerStatsGrid');
                if (gamerStatsGrid) {
                    gamerStatsGrid.innerHTML = `
                        <div class="gamer-stat-card">
                            <div class="stat-value">${formatNumber(gamerProfile.wins || 0)}</div>
                            <div class="stat-label">Wins</div>
                        </div>
                        <div class="gamer-stat-card">
                            <div class="stat-value">${formatNumber(gamerProfile.losses || 0)}</div>
                            <div class="stat-label">Losses</div>
                        </div>
                        <div class="gamer-stat-card">
                            <div class="stat-value">${gamerProfile.kdRatio || '0.0'}</div>
                            <div class="stat-label">K/D Ratio</div>
                        </div>
                        <div class="gamer-stat-card">
                            <div class="stat-value">${formatNumber(gamerProfile.playHours || 0)}</div>
                            <div class="stat-label">Hours Played</div>
                        </div>
                    `;
                }
            }
        }
        
        if (typeof feather !== 'undefined') {
            feather.replace();
        }
    } catch (error) {
        console.log('No gamer profile found or error loading:', error);
    }
}

function setupProfileEventListeners(profileId) {
    const followBtn = document.getElementById('likeProfileBtn');
    if (followBtn) {
        followBtn.addEventListener('click', async () => {
            if (!currentUser) {
                showNotification('Please log in to follow users', 'warning');
                window.location.href = 'login.html';
                return;
            }
            
            if (currentUser.uid === profileId) {
                showNotification('You cannot follow yourself', 'info');
                return;
            }
            
            const isCurrentlyFollowing = followBtn.dataset.following === 'true';
            
            try {
                if (isCurrentlyFollowing) {
                    await unfollowUser(profileId);
                    followBtn.dataset.following = 'false';
                    followBtn.innerHTML = '<svg class="feather" data-feather="user-plus"></svg> Follow';
                    followBtn.classList.remove('btn-message');
                    followBtn.classList.add('btn-follow');
                    
                    await updateFollowersCount(profileId);
                    
                    await indexedDBCache.setFollowStatus(currentUser.uid, profileId, false);
                    
                    showNotification(`Unfollowed user`, 'info');
                } else {
                    await followUser(profileId);
                    followBtn.dataset.following = 'true';
                    followBtn.innerHTML = '<svg class="feather" data-feather="user-check"></svg> Following';
                    followBtn.classList.remove('btn-follow');
                    followBtn.classList.add('btn-message');
                    
                    await updateFollowersCount(profileId);
                    
                    await indexedDBCache.setFollowStatus(currentUser.uid, profileId, true);
                    
                    // Safely award XP
                    if (xpSystem && typeof xpSystem.addXP === 'function') {
                        await xpSystem.addXP(15, 'Followed a User');
                    }
                    
                    showNotification(`Now following user`, 'success');
                }
                
                if (typeof feather !== 'undefined') {
                    feather.replace();
                }
            } catch (error) {
                console.error('Error toggling follow:', error);
                showNotification('Failed to update follow status', 'error');
            }
        });
    }
    
    const messageBtn = document.getElementById('messageProfileBtn');
    if (messageBtn) {
        messageBtn.addEventListener('click', () => {
            if (!currentUser) {
                showNotification('Please log in to send messages', 'warning');
                window.location.href = 'login.html';
                return;
            }
            
            if (currentUser.uid === profileId) {
                showNotification('You cannot message yourself', 'info');
                return;
            }
            
            window.location.href = `chat.html?id=${profileId}`;
            
            // Safely award XP
            if (xpSystem && typeof xpSystem.addXP === 'function') {
                setTimeout(async () => {
                    await xpSystem.addXP(5, 'Sent a Message');
                }, 1000);
            }
        });
    }
}

// ==================== CORE FOLLOW/UNFOLLOW FUNCTIONS ====================
async function followUser(targetUserId) {
    try {
        if (!currentUser) {
            throw new Error('User not logged in');
        }
        
        const targetUserRef = doc(db, 'users', targetUserId);
        const targetUserSnap = await getDoc(targetUserRef);
        
        if (!targetUserSnap.exists()) {
            throw new Error('Target user not found');
        }
        
        const targetUserData = targetUserSnap.data();
        
        const targetUpdates = {
            updatedAt: serverTimestamp()
        };
        
        if (targetUserData.followers && Array.isArray(targetUserData.followers)) {
            if (!targetUserData.followers.includes(currentUser.uid)) {
                targetUpdates.followers = arrayUnion(currentUser.uid);
            }
        } else {
            targetUpdates.followers = [currentUser.uid];
        }
        
        if (targetUserData.likes && Array.isArray(targetUserData.likes)) {
            if (!targetUserData.likes.includes(currentUser.uid)) {
                targetUpdates.likes = arrayUnion(currentUser.uid);
            }
        } else {
            targetUpdates.likes = [currentUser.uid];
        }
        
        await updateDoc(targetUserRef, targetUpdates);
        
        const currentUserRef = doc(db, 'users', currentUser.uid);
        const currentUserSnap = await getDoc(currentUserRef);
        
        if (currentUserSnap.exists()) {
            const currentUserData = currentUserSnap.data();
            
            if (currentUserData.following && Array.isArray(currentUserData.following)) {
                if (!currentUserData.following.includes(targetUserId)) {
                    await updateDoc(currentUserRef, {
                        following: arrayUnion(targetUserId),
                        updatedAt: serverTimestamp()
                    });
                }
            } else {
                await updateDoc(currentUserRef, {
                    following: [targetUserId],
                    updatedAt: serverTimestamp()
                });
            }
        } else {
            await updateDoc(currentUserRef, {
                following: [targetUserId],
                updatedAt: serverTimestamp()
            });
        }
        
        console.log(`✅ Successfully followed user: ${targetUserId}`);
        
    } catch (error) {
        console.error('Error following user:', error);
        throw error;
    }
}

async function unfollowUser(targetUserId) {
    try {
        if (!currentUser) {
            throw new Error('User not logged in');
        }
        
        const targetUserRef = doc(db, 'users', targetUserId);
        const targetUserSnap = await getDoc(targetUserRef);
        
        if (!targetUserSnap.exists()) {
            throw new Error('Target user not found');
        }
        
        const targetUserData = targetUserSnap.data();
        
        const targetUpdates = {
            updatedAt: serverTimestamp()
        };
        
        if (targetUserData.followers && Array.isArray(targetUserData.followers)) {
            if (targetUserData.followers.includes(currentUser.uid)) {
                targetUpdates.followers = arrayRemove(currentUser.uid);
            }
        }
        
        if (targetUserData.likes && Array.isArray(targetUserData.likes)) {
            if (targetUserData.likes.includes(currentUser.uid)) {
                targetUpdates.likes = arrayRemove(currentUser.uid);
            }
        }
        
        if (Object.keys(targetUpdates).length > 1) {
            await updateDoc(targetUserRef, targetUpdates);
        }
        
        const currentUserRef = doc(db, 'users', currentUser.uid);
        const currentUserSnap = await getDoc(currentUserRef);
        
        if (currentUserSnap.exists()) {
            const currentUserData = currentUserSnap.data();
            
            if (currentUserData.following && Array.isArray(currentUserData.following)) {
                if (currentUserData.following.includes(targetUserId)) {
                    await updateDoc(currentUserRef, {
                        following: arrayRemove(targetUserId),
                        updatedAt: serverTimestamp()
                    });
                }
            }
        }
        
        console.log(`✅ Successfully unfollowed user: ${targetUserId}`);
        
    } catch (error) {
        console.error('Error unfollowing user:', error);
        throw error;
    }
}

// ==================== UTILITY FUNCTIONS ====================
function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    const searchInput = document.querySelector('.search-input');
    if (searchInput) {
        searchInput.addEventListener('input', debounce((e) => {
            const searchTerm = e.target.value.toLowerCase().trim();
            if (searchTerm) {
                const filtered = allProfiles.filter(profile => 
                    profile.name.toLowerCase().includes(searchTerm) ||
                    (profile.isGamer && profile.gamerProfile?.gamerTag?.toLowerCase().includes(searchTerm)) ||
                    profile.location.toLowerCase().includes(searchTerm) ||
                    (profile.gamerProfile?.primaryGame?.toLowerCase().includes(searchTerm)) ||
                    profile.email.toLowerCase().includes(searchTerm) ||
                    profile.bio.toLowerCase().includes(searchTerm) ||
                    (profile.xpRank && profile.xpRank.toLowerCase().includes(searchTerm))
                );
                displayFilteredProfiles(filtered);
            } else {
                renderProfilesList();
            }
        }, 300));
    }
    
    document.querySelectorAll('.filter-btn').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            currentFilter = button.dataset.filter;
            renderProfilesList();
        });
    });
    
    const filterContainer = document.querySelector('.filters');
    if (filterContainer && !document.querySelector('.filter-btn[data-filter="xp"]')) {
        const xpFilterBtn = document.createElement('button');
        xpFilterBtn.className = 'filter-btn';
        xpFilterBtn.dataset.filter = 'xp';
        xpFilterBtn.innerHTML = '<i class="fas fa-trophy"></i> High XP';
        xpFilterBtn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
            xpFilterBtn.classList.add('active');
            currentFilter = 'xp';
            renderProfilesList();
        });
        filterContainer.appendChild(xpFilterBtn);
    }
    
    console.log('Event listeners set up');
}

function displayFilteredProfiles(filteredProfiles) {
    const gamersListElement = document.getElementById('gamersList');
    if (!gamersListElement) return;
    
    if (filteredProfiles.length === 0) {
        gamersListElement.innerHTML = `
            <div class="empty-state">
                <svg class="feather" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <h3 class="empty-title">No matching profiles</h3>
                <p>Try a different search term</p>
            </div>
        `;
        return;
    }
    
    gamersListElement.innerHTML = '';
    filteredProfiles.forEach(profile => {
        gamersListElement.appendChild(createProfileItem(profile));
    });
    
    if (typeof feather !== 'undefined') {
        feather.replace();
    }
}

function createLoadingProfileItem() {
    const div = document.createElement('div');
    div.className = 'gamer-item loading';
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

// ==================== NOTIFICATION & ERROR FUNCTIONS ====================
function showNotification(message, type = 'info', duration = 3000) {
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
        font-family: 'Inter', sans-serif;
    `;
    
    const icon = type === 'error' ? 'alert-circle' : 
                type === 'success' ? 'check-circle' : 
                type === 'warning' ? 'alert-triangle' : 'info';
    
    notification.innerHTML = `
        <svg class="feather" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke="white" stroke-width="2">
            ${getNotificationIcon(icon)}
        </svg>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, duration);
}

function getNotificationIcon(icon) {
    switch(icon) {
        case 'alert-circle':
            return '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>';
        case 'check-circle':
            return '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>';
        case 'alert-triangle':
            return '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>';
        default:
            return '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>';
    }
}

function showError(message, showRefresh = true) {
    const targetElement = isProfilePage ? document.querySelector('.profile-container') : 
                         document.getElementById('gamersList');
    
    if (targetElement) {
        targetElement.innerHTML = `
            <div class="empty-state">
                <svg class="feather" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <h3 class="empty-title">Error Loading</h3>
                <p>${message}</p>
                ${showRefresh ? `
                    <div style="margin-top: 15px; display: flex; gap: 10px;">
                        <button onclick="location.reload()" style="
                            background: var(--primary);
                            color: white;
                            border: none;
                            padding: 8px 16px;
                            border-radius: 20px;
                            cursor: pointer;
                            font-family: 'Inter', sans-serif;
                        ">
                            Refresh Page
                        </button>
                        <button onclick="window.location.href='index.html'" style="
                            background: var(--bg-primary);
                            color: var(--text-primary);
                            border: 1px solid var(--border);
                            padding: 8px 16px;
                            border-radius: 20px;
                            cursor: pointer;
                            font-family: 'Inter', sans-serif;
                        ">
                            Go Home
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }
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

document.addEventListener('DOMContentLoaded', () => {
    const clanModal = document.getElementById('clanModal');
    if (clanModal) {
        clanModal.remove();
    }
});

console.log('✅ gamers.js loaded successfully - XP System error fixed!');