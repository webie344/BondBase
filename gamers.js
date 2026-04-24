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
    setDoc,
    limit
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

// ==================== SHUFFLE FUNCTION ====================
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// ==================== FOLLOWER NOTIFICATION SYSTEM ====================
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
            <i data-feather="bell"></i>
            <span class="notification-badge" style="display: none;">0</span>
            <div class="notification-dropdown" style="display: none;">
                <div class="notification-header">
                    <h3>Notifications</h3>
                    <button class="mark-all-read">Mark all as read</button>
                </div>
                <div class="notification-list">
                    <div class="notification-empty">
                        <i data-feather="bell-off"></i>
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

        if (typeof feather !== 'undefined') {
            feather.replace();
        }

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
            <button class="notification-close"><i data-feather="x"></i></button>
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

        if (typeof feather !== 'undefined') {
            feather.replace();
        }

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
            <button class="notification-item-close"><i data-feather="x"></i></button>
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
                        <i data-feather="bell-off"></i>
                        <p>No notifications yet</p>
                    </div>
                `;
                if (typeof feather !== 'undefined') {
                    feather.replace();
                }
            }
        });

        notificationList.prepend(notificationItem);
        
        if (typeof feather !== 'undefined') {
            feather.replace();
        }
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

            .notification-bell i,
            .notification-bell svg {
                width: 20px;
                height: 20px;
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

            .notification-item-close svg {
                width: 16px;
                height: 16px;
            }

            .notification-empty {
                text-align: center;
                padding: 40px 20px;
                color: rgba(255,255,255,0.5);
            }

            .notification-empty svg {
                width: 40px;
                height: 40px;
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

            .follower-notification .notification-close svg {
                width: 18px;
                height: 18px;
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
                
                // Shuffle cached profiles
                allProfiles = shuffleArray(this.appData.profiles);
                
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
            allProfiles = shuffleArray(this.appData.profiles);
            
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
            
            filteredProfiles.forEach((profile, index) => {
                gamersListElement.appendChild(createProfileItem(profile));
                
                // Insert product card every PRODUCT_INSERT_INTERVAL profiles
                if ((index + 1) % PRODUCT_INSERT_INTERVAL === 0 && index < filteredProfiles.length - 1) {
                    const productRow = createProductRowCard();
                    gamersListElement.appendChild(productRow);
                }
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
    offlineIndicator.innerHTML = '<i data-feather="wifi-off"></i> You are currently offline. Some features may be limited.';
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
    
    if (typeof feather !== 'undefined') {
        feather.replace();
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
        if (typeof feather !== 'undefined') {
            feather.replace();
        }
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
let productsCache = [];
let productsLoaded = false;

const isProfilePage = window.location.pathname.includes('profile.html');
const isGamersPage = window.location.pathname.includes('gamers.html') || 
                     window.location.pathname.includes('mingle.html');
const isXpPage = window.location.pathname.includes('xp.html');

const followerNotifier = new FollowerNotificationSystem();

// ==================== PRODUCT INSERTION CONFIGURATION ====================
const PRODUCT_INSERT_INTERVAL = 4; // Insert product card every 4 profiles

// ==================== CONNECT SECTION STYLES ====================
function addConnectSectionStyles() {
    if (document.getElementById('connectSectionStyles')) return;
    
    const style = document.createElement('style');
    style.id = 'connectSectionStyles';
    style.textContent = `
        #gamersList {
            display: flex;
            flex-direction: column;
            height: calc(100vh - 120px);
            overflow-y: scroll;
            overflow-x: hidden;
            scroll-snap-type: y mandatory;
            scroll-behavior: smooth;
            padding: 0;
            gap: 0;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
        }
        #gamersList::-webkit-scrollbar { display: none; }
        .gamer-item {
            position: relative;
            width: 100%;
            height: calc(100vh - 120px);
            flex-shrink: 0;
            scroll-snap-align: start;
            scroll-snap-stop: always;
            overflow: hidden;
            cursor: pointer;
            background: #0e0e14;
        }
        
        /* Product Row Card Styles */
        .product-row-card {
            position: relative;
            width: 100%;
            height: calc(100vh - 120px);
            flex-shrink: 0;
            scroll-snap-align: start;
            scroll-snap-stop: always;
            overflow: hidden;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
            cursor: default;
            display: flex;
            flex-direction: column;
        }
        
        .product-row-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: 
                radial-gradient(circle at 20% 30%, rgba(255, 75, 110, 0.1) 0%, transparent 50%),
                radial-gradient(circle at 80% 70%, rgba(122, 79, 255, 0.1) 0%, transparent 50%);
            pointer-events: none;
            z-index: 0;
        }
        
        .product-row-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 30px 20px 15px;
            z-index: 5;
            position: relative;
        }
        
        .product-row-title {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .product-row-title-icon {
            width: 40px;
            height: 40px;
            background: linear-gradient(135deg, #ff4b6e, #ff6b8a);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            box-shadow: 0 4px 15px rgba(255, 75, 110, 0.4);
        }
        
        .product-row-title h3 {
            color: white;
            font-size: 22px;
            margin: 0;
            font-weight: 700;
            letter-spacing: -0.5px;
        }
        
        .product-row-title p {
            color: rgba(255, 255, 255, 0.6);
            font-size: 12px;
            margin: 2px 0 0 0;
        }
        
        .product-row-view-all {
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 600;
            transition: all 0.3s;
            text-decoration: none;
            display: flex;
            align-items: center;
            gap: 5px;
            z-index: 5;
        }
        
        .product-row-view-all:hover {
            background: rgba(255, 255, 255, 0.2);
            transform: scale(1.05);
        }
        
        .products-horizontal-scroll {
            flex: 1;
            overflow-x: auto;
            overflow-y: hidden;
            display: flex;
            gap: 15px;
            padding: 10px 20px 30px;
            scroll-snap-type: x mandatory;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
            z-index: 2;
            position: relative;
        }
        
        .products-horizontal-scroll::-webkit-scrollbar {
            display: none;
        }
        
        .product-card-mini {
            min-width: 160px;
            max-width: 160px;
            height: 240px;
            background: rgba(255, 255, 255, 0.08);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 16px;
            overflow: hidden;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            scroll-snap-align: start;
            flex-shrink: 0;
            display: flex;
            flex-direction: column;
            position: relative;
        }
        
        .product-card-mini:hover {
            transform: translateY(-5px);
            border-color: rgba(255, 75, 110, 0.5);
            box-shadow: 0 15px 30px rgba(0, 0, 0, 0.4);
        }
        
        .product-card-mini-image {
            width: 100%;
            height: 140px;
            object-fit: cover;
            background: linear-gradient(135deg, #1a1a2e, #16213e);
        }
        
        .product-card-mini-info {
            padding: 12px;
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        }
        
        .product-card-mini-name {
            color: white;
            font-size: 13px;
            font-weight: 600;
            margin: 0;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            line-height: 1.3;
        }
        
        .product-card-mini-price {
            color: #ff4b6e;
            font-size: 16px;
            font-weight: 700;
            margin-top: 5px;
        }
        
        .product-card-mini-original-price {
            color: rgba(255, 255, 255, 0.4);
            font-size: 12px;
            text-decoration: line-through;
            margin-left: 5px;
        }
        
        .product-card-mini-badge {
            position: absolute;
            top: 10px;
            right: 10px;
            background: #ff4b6e;
            color: white;
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            z-index: 3;
        }
        
        .product-row-footer {
            padding: 0 20px 20px;
            z-index: 5;
            position: relative;
            display: flex;
            justify-content: center;
        }
        
        .product-row-dots {
            display: flex;
            gap: 6px;
            align-items: center;
        }
        
        .product-row-dot {
            width: 6px;
            height: 6px;
            border-radius: 3px;
            background: rgba(255, 255, 255, 0.3);
            transition: all 0.3s;
        }
        
        .product-row-dot.active {
            width: 20px;
            background: #ff4b6e;
        }
        
        /* Loading skeleton for product cards */
        .product-card-mini-skeleton {
            min-width: 160px;
            max-width: 160px;
            height: 240px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 16px;
            flex-shrink: 0;
            animation: shimmer 1.5s infinite;
        }
        
        @keyframes shimmer {
            0% { background: rgba(255, 255, 255, 0.05); }
            50% { background: rgba(255, 255, 255, 0.1); }
            100% { background: rgba(255, 255, 255, 0.05); }
        }
        
        /* Existing styles continue below */
        .card-bg {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 80%;
            object-fit: cover;
            object-position: center top;
            transition: transform 0.6s ease;
            filter: brightness(0.75);
        }
        .gamer-item:hover .card-bg { transform: scale(1.03); }
        .card-bg-fallback {
            position: absolute;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 96px;
            font-weight: 900;
            color: rgba(255,255,255,0.1);
            font-family: sans-serif;
            user-select: none;
        }
        .card-gradient-top {
            position: absolute;
            top: 0; left: 0; right: 0;
            height: 160px;
            background: linear-gradient(to bottom, rgba(0,0,0,0.6), transparent);
            z-index: 2;
            pointer-events: none;
        }
        .card-gradient-bottom {
            position: absolute;
            bottom: 0; left: 0; right: 0;
            height: 65%;
            background: linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.7) 40%, transparent 100%);
            z-index: 2;
            pointer-events: none;
        }
        .card-status-badge {
            position: absolute;
            top: 16px;
            left: 16px;
            z-index: 5;
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 5px 12px;
            border-radius: 100px;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            backdrop-filter: blur(12px);
        }
        .card-status-badge.online {
            background: rgba(0,230,118,0.2);
            border: 1px solid rgba(0,230,118,0.5);
            color: #00e676;
        }
        .card-status-badge.offline {
            background: rgba(255,255,255,0.08);
            border: 1px solid rgba(255,255,255,0.15);
            color: rgba(255,255,255,0.5);
        }
        .status-dot {
            width: 7px;
            height: 7px;
            border-radius: 50%;
        }
        .card-status-badge.online .status-dot {
            background: #00e676;
            box-shadow: 0 0 8px #00e676;
            animation: statusPulse 2s infinite;
        }
        .card-status-badge.offline .status-dot { background: rgba(255,255,255,0.3); }
        @keyframes statusPulse {
            0%,100% { opacity:1; transform:scale(1); }
            50% { opacity:0.5; transform:scale(0.8); }
        }
        .card-xp-badge {
            position: absolute;
            top: 16px;
            right: 72px;
            z-index: 5;
            background: rgba(0,0,0,0.5);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255,255,255,0.15);
            border-radius: 100px;
            padding: 5px 12px;
            font-size: 12px;
            color: white;
            display: flex;
            align-items: center;
            gap: 5px;
        }
        .card-scroll-hint {
            position: absolute;
            top: 16px;
            right: 16px;
            z-index: 5;
            width: 36px;
            height: 36px;
            background: rgba(255,255,255,0.1);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255,255,255,0.2);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
        }
        .card-scroll-hint svg { width:16px; height:16px; }
        .card-info {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 80px;
            z-index: 4;
            padding: 0 20px 28px;
        }
        .card-name-row {
            display: flex;
            align-items: baseline;
            gap: 10px;
            margin-bottom: 6px;
        }
        .card-name {
            font-size: 28px;
            font-weight: 800;
            color: white;
            line-height: 1.1;
            letter-spacing: -0.5px;
            text-shadow: 0 2px 8px rgba(0,0,0,0.5);
        }
        .card-age {
            font-size: 22px;
            font-weight: 300;
            color: rgba(255,255,255,0.7);
        }
        .card-location {
            display: flex;
            align-items: center;
            gap: 5px;
            font-size: 13px;
            color: rgba(255,255,255,0.65);
            margin-bottom: 10px;
        }
        .card-location svg { width:13px; height:13px; }
        .card-bio {
            font-size: 14px;
            color: rgba(255,255,255,0.8);
            line-height: 1.5;
            margin-bottom: 12px;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }
        .card-tags {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
        }
        .card-tag {
            background: rgba(255,255,255,0.12);
            backdrop-filter: blur(8px);
            border: 1px solid rgba(255,255,255,0.2);
            color: white;
            font-size: 11px;
            font-weight: 600;
            padding: 4px 10px;
            border-radius: 100px;
            display: inline-flex;
            align-items: center;
            gap: 4px;
        }
        .card-tag svg { width:11px; height:11px; }
        .card-tag.pink { background: rgba(255,75,110,0.25); border-color: rgba(255,75,110,0.5); color: #ff8fab; }
        .card-tag.gold { background: rgba(255,200,0,0.2); border-color: rgba(255,200,0,0.4); color: #ffd54f; }
        .card-actions {
            position: absolute;
            bottom: 20px;
            right: 14px;
            z-index: 5;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 14px;
        }
        .btn-wrap {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
        }
        .card-action-label {
            font-size: 10px;
            font-weight: 600;
            color: white;
            text-shadow: 0 1px 4px rgba(0,0,0,0.8);
            text-align: center;
        }
        .add-clan-btn {
            width: 52px;
            height: 52px;
            border-radius: 50%;
            border: none;
            background: #ff4b6e;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.25s cubic-bezier(0.175,0.885,0.32,1.275);
            box-shadow: 0 4px 20px rgba(255,75,110,0.5);
        }
        .add-clan-btn svg { width:22px; height:22px; color:white; }
        .add-clan-btn:hover { transform:scale(1.12); box-shadow:0 6px 24px rgba(255,75,110,0.7); }
        .add-clan-btn.added { background:#00c896; box-shadow:0 4px 20px rgba(0,200,150,0.5); }
        .message-gamer-btn {
            width: 52px;
            height: 52px;
            border-radius: 50%;
            border: 2px solid rgba(255,255,255,0.3);
            background: rgba(255,255,255,0.12);
            backdrop-filter: blur(12px);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.25s ease;
            color: white;
        }
        .message-gamer-btn svg { width:22px; height:22px; }
        .message-gamer-btn:hover { background:rgba(255,255,255,0.25); transform:scale(1.1); }
        .store-btn {
            width: 52px;
            height: 52px;
            border-radius: 50%;
            border: none;
            background: linear-gradient(135deg,#f39c12,#e67e22);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.25s ease;
            box-shadow: 0 4px 16px rgba(243,156,18,0.4);
            color: white;
        }
        .store-btn svg { width:22px; height:22px; }
        .store-btn:hover { transform:scale(1.1); box-shadow:0 6px 20px rgba(243,156,18,0.6); }
        .clan-section { display:none; }
        .gamer-actions { display: contents; }
        .gamer-item.loading { background: linear-gradient(160deg,#1a1a2e,#16213e); pointer-events:none; }
        .loading-avatar { width:100%; height:100%; background:linear-gradient(90deg,#1a1a2e 25%,#252540 50%,#1a1a2e 75%); background-size:200% 100%; animation:shimmer 1.5s infinite; }
        .loading-info,.loading-line { display:none; }
        .empty-state { height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:40px; color:white; }
        .empty-state svg { width:56px; height:56px; color:#ff4b6e; margin-bottom:20px; opacity:0.6; }
        .empty-title { font-size:22px; font-weight:700; margin-bottom:10px; }
        .empty-state p { color:rgba(255,255,255,0.5); font-size:14px; }
        #scrollDots { position:fixed; right:10px; top:50%; transform:translateY(-50%); display:flex; flex-direction:column; gap:6px; z-index:100; }
        .scroll-dot { width:5px; height:5px; border-radius:50%; background:rgba(255,255,255,0.25); transition:all 0.3s ease; cursor:pointer; }
        .scroll-dot.active { background:#ff4b6e; height:18px; border-radius:3px; }
        @keyframes cardSlideUp { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
        .gamer-item .card-info,.gamer-item .card-actions { animation:cardSlideUp 0.5s ease forwards; }
    `;
    document.head.appendChild(style);
}

// ==================== PRODUCT ROW FUNCTIONS ====================
async function loadProductsForMingle() {
    try {
        // Return cached products if already loaded
        if (productsCache.length > 0) {
            console.log('📦 Using cached products:', productsCache.length);
            return productsCache;
        }
        
        console.log('🔄 Fetching products from Firebase...');
        
        // Fetch products directly from Firestore
        const productsRef = collection(db, 'products');
        const q = query(
            productsRef, 
            where('status', '==', 'active'),
            limit(10)
        );
        
        const querySnapshot = await getDocs(q);
        
        productsCache = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            productsCache.push({
                id: doc.id,
                ...data
            });
        });
        
        // Sort by createdAt (newest first)
        productsCache.sort((a, b) => {
            const dateA = a.createdAt ? (a.createdAt.seconds || 0) : 0;
            const dateB = b.createdAt ? (b.createdAt.seconds || 0) : 0;
            return dateB - dateA;
        });
        
        console.log(`✅ Loaded ${productsCache.length} products from Firebase`);
        productsLoaded = true;
        
        return productsCache;
    } catch (error) {
        console.error('Error loading products:', error);
        // Return fallback data if Firebase fails
        return getFallbackProducts();
    }
}

function getFallbackProducts() {
    return [
        { id: 'fp1', name: 'Gaming Mouse Pro', price: 59.99, currency: 'USD', images: [{ url: 'https://via.placeholder.com/160x140/1a1a2e/ff4b6e?text=Mouse' }], views: 234, likes: ['u1', 'u2'], status: 'new', discount: 0, createdAt: { seconds: Date.now()/1000 - 86400 } },
        { id: 'fp2', name: 'Mechanical Keyboard', price: 129.99, originalPrice: 159.99, currency: 'USD', images: [{ url: 'https://via.placeholder.com/160x140/1a1a2e/ff4b6e?text=Keyboard' }], views: 567, likes: ['u1', 'u2', 'u3'], discount: 20, createdAt: { seconds: Date.now()/1000 - 172800 } },
        { id: 'fp3', name: 'Gaming Headset', price: 89.99, currency: 'USD', images: [{ url: 'https://via.placeholder.com/160x140/1a1a2e/00ff88?text=Headset' }], views: 123, likes: ['u1'], status: 'new', discount: 0, createdAt: { seconds: Date.now()/1000 - 259200 } },
        { id: 'fp4', name: '4K Gaming Monitor', price: 399.99, originalPrice: 499.99, currency: 'USD', images: [{ url: 'https://via.placeholder.com/160x140/1a1a2e/667eea?text=Monitor' }], views: 89, likes: ['u1', 'u2'], discount: 20, createdAt: { seconds: Date.now()/1000 - 345600 } },
        { id: 'fp5', name: 'Gaming Chair', price: 249.99, currency: 'USD', images: [{ url: 'https://via.placeholder.com/160x140/1a1a2e/764ba2?text=Chair' }], views: 45, likes: ['u1'], discount: 0, createdAt: { seconds: Date.now()/1000 - 432000 } },
        { id: 'fp6', name: 'RGB Mouse Pad', price: 29.99, currency: 'USD', images: [{ url: 'https://via.placeholder.com/160x140/1a1a2e/b3004b?text=MousePad' }], views: 178, likes: ['u1', 'u2'], discount: 0, createdAt: { seconds: Date.now()/1000 - 518400 } },
        { id: 'fp7', name: 'Streaming Mic', price: 79.99, originalPrice: 99.99, currency: 'USD', images: [{ url: 'https://via.placeholder.com/160x140/1a1a2e/7a0034?text=Mic' }], views: 92, likes: ['u1'], discount: 20, createdAt: { seconds: Date.now()/1000 - 604800 } },
        { id: 'fp8', name: 'Webcam 1080p', price: 69.99, currency: 'USD', images: [{ url: 'https://via.placeholder.com/160x140/1a1a2e/e63986?text=Webcam' }], views: 67, likes: ['u1', 'u3'], status: 'new', discount: 0, createdAt: { seconds: Date.now()/1000 - 691200 } }
    ];
}

function createProductMiniCard(product) {
    const currencySymbols = {
        USD: '$',
        NGN: '₦',
        GBP: '£'
    };
    const currency = product.currency || 'USD';
    const symbol = currencySymbols[currency] || '$';
    const price = product.salePrice || product.price || 0;
    const originalPrice = product.originalPrice || price;
    const hasDiscount = product.discount > 0 && price < originalPrice;
    
    let productImage = 'https://via.placeholder.com/160x140/1a1a2e/ff4b6e?text=Product';
    if (product.images && product.images.length > 0) {
        const firstImage = product.images[0];
        if (typeof firstImage === 'string') {
            productImage = firstImage;
        } else if (firstImage && firstImage.thumbnail) {
            productImage = firstImage.thumbnail;
        } else if (firstImage && firstImage.url) {
            productImage = firstImage.url;
        }
    } else if (product.image) {
        productImage = typeof product.image === 'string' ? product.image : product.image.url || productImage;
    }
    
    const card = document.createElement('div');
    card.className = 'product-card-mini';
    card.onclick = (e) => {
        e.stopPropagation();
        window.location.href = `product.html?id=${product.id}`;
    };
    
    card.innerHTML = `
        ${hasDiscount ? `<span class="product-card-mini-badge">-${product.discount}%</span>` : ''}
        ${product.status === 'new' && !hasDiscount ? `<span class="product-card-mini-badge" style="background:#00c896;">NEW</span>` : ''}
        <img src="${productImage}" alt="${product.name || 'Product'}" class="product-card-mini-image" 
             onerror="this.src='https://via.placeholder.com/160x140/1a1a2e/ff4b6e?text=Product'">
        <div class="product-card-mini-info">
            <h4 class="product-card-mini-name">${product.name || 'Unnamed Product'}</h4>
            <div class="product-card-mini-price">
                ${symbol}${price.toFixed(2)}
                ${hasDiscount ? `<span class="product-card-mini-original-price">${symbol}${originalPrice.toFixed(2)}</span>` : ''}
            </div>
        </div>
    `;
    
    return card;
}

function createProductRowCard() {
    const div = document.createElement('div');
    div.className = 'product-row-card';
    
    const uniqueId = `ps-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    div.innerHTML = `
        <div class="product-row-header">
            <div class="product-row-title">
                <div class="product-row-title-icon">🛍️</div>
                <div>
                    <h3>Marketplace</h3>
                    <p>Discover amazing products</p>
                </div>
            </div>
            <button class="product-row-view-all" onclick="event.stopPropagation(); window.location.href='store.html'">
                View All <i data-feather="arrow-right"></i>
            </button>
        </div>
        <div id="${uniqueId}" class="products-horizontal-scroll">
            ${[1,2,3,4,5].map(() => '<div class="product-card-mini-skeleton"></div>').join('')}
        </div>
        <div class="product-row-footer">
            <div class="product-row-dots" id="${uniqueId}-dots">
                <div class="product-row-dot active"></div>
                <div class="product-row-dot"></div>
                <div class="product-row-dot"></div>
                <div class="product-row-dot"></div>
                <div class="product-row-dot"></div>
            </div>
        </div>
    `;
    
    // Load products asynchronously
    setTimeout(async () => {
        const products = await loadProductsForMingle();
        const scrollContainer = document.getElementById(uniqueId);
        
        if (scrollContainer && products.length > 0) {
            scrollContainer.innerHTML = '';
            products.forEach(product => {
                scrollContainer.appendChild(createProductMiniCard(product));
            });
            
            // Update dots
            const dotsContainer = document.getElementById(`${uniqueId}-dots`);
            if (dotsContainer) {
                dotsContainer.innerHTML = '';
                products.forEach((_, index) => {
                    const dot = document.createElement('div');
                    dot.className = `product-row-dot ${index === 0 ? 'active' : ''}`;
                    dotsContainer.appendChild(dot);
                });
            }
            
            // Add scroll listener for dots
            scrollContainer.addEventListener('scroll', () => {
                const scrollLeft = scrollContainer.scrollLeft;
                const cardWidth = 175; // 160px card + 15px gap
                const activeIndex = Math.round(scrollLeft / cardWidth);
                
                const dots = dotsContainer ? dotsContainer.querySelectorAll('.product-row-dot') : [];
                dots.forEach((dot, index) => {
                    dot.classList.toggle('active', index === activeIndex);
                });
            });
        } else if (scrollContainer && products.length === 0) {
            scrollContainer.innerHTML = `
                <div style="display:flex;align-items:center;justify-content:center;width:100%;color:rgba(255,255,255,0.5);">
                    <p>No products available yet</p>
                </div>
            `;
        }
        
        if (typeof feather !== 'undefined') {
            feather.replace();
        }
    }, 100);
    
    return div;
}

// ==================== XP SYSTEM INTEGRATION ====================
async function loadXPSystem() {
    if (xpSystem) return xpSystem;
    
    try {
        const xpModule = await import('./xp.js');
        console.log('XP Module loaded:', xpModule);
        
        if (xpModule.XPSystem) {
            if (typeof xpModule.XPSystem === 'function') {
                xpSystem = new xpModule.XPSystem();
            } else {
                xpSystem = xpModule.XPSystem;
            }
        } else if (xpModule.default) {
            if (typeof xpModule.default === 'function') {
                xpSystem = new xpModule.default();
            } else {
                xpSystem = xpModule.default;
            }
        } else if (typeof xpModule === 'function') {
            xpSystem = new xpModule();
        } else {
            xpSystem = window.XPSystem;
        }
        
        if (!xpSystem) {
            console.warn('XP System not found, creating mock XP system');
            xpSystem = createMockXPSystem();
        }
        
        if (xpSystem.initialize && typeof xpSystem.initialize === 'function') {
            await xpSystem.initialize();
        }
        
        startXPTracking();
        console.log('XP System loaded successfully:', xpSystem);
        return xpSystem;
    } catch (error) {
        console.error('Error loading XP system:', error);
        xpSystem = createMockXPSystem();
        return xpSystem;
    }
}

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
    console.log('🚀 Initializing with shuffled profiles and product cards...');
    
    addConnectSectionStyles();
    
    await instantLoader.initialize();
    await followerNotifier.initialize();
    
    if (isGamersPage) {
        instantLoader.renderInstantly();
        setupEventListeners();
        setupScrollDots();
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

// ==================== SCROLL DOTS FOR VERTICAL NAVIGATION ====================
function setupScrollDots() {
    const gamersList = document.getElementById('gamersList');
    if (!gamersList) return;
    
    const dotsContainer = document.getElementById('scrollDots') || document.createElement('div');
    dotsContainer.id = 'scrollDots';
    if (!document.getElementById('scrollDots')) {
        document.body.appendChild(dotsContainer);
    }
    
    function updateDots() {
        dotsContainer.innerHTML = '';
        const items = gamersList.querySelectorAll('.gamer-item, .product-row-card');
        const scrollTop = gamersList.scrollTop;
        const itemHeight = gamersList.offsetHeight;
        const activeIndex = Math.round(scrollTop / itemHeight);
        
        items.forEach((_, index) => {
            const dot = document.createElement('div');
            dot.className = `scroll-dot ${index === activeIndex ? 'active' : ''}`;
            dot.addEventListener('click', () => {
                gamersList.scrollTo({
                    top: index * itemHeight,
                    behavior: 'smooth'
                });
            });
            dotsContainer.appendChild(dot);
        });
    }
    
    gamersList.addEventListener('scroll', updateDots);
    
    // Initial update after render
    setTimeout(updateDots, 500);
}

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
        
        // SHUFFLE THE PROFILES
        const shuffledProfiles = shuffleArray(newProfiles);
        console.log('🔀 Profiles shuffled for variety');
        
        allProfiles = shuffledProfiles;
        
        shuffledProfiles.forEach(profile => {
            instantLoader.updateProfile(profile);
        });
        
        try {
            await indexedDBCache.setProfiles(shuffledProfiles);
            console.log('💾 Profiles cached in IndexedDB');
        } catch (cacheError) {
            console.log('Could not cache profiles in IndexedDB:', cacheError);
        }
        
        cache.set('all_profiles', shuffledProfiles, 'short');
        
        if (!silentRefresh || !instantLoader.hasRenderedFromCache) {
            renderProfilesList();
        } else {
            smoothUpdateProfiles(shuffledProfiles);
        }
        
    } catch (error) {
        console.error('❌ Error loading profiles:', error);
        if (!silentRefresh) {
            showError(`Failed to load profiles: ${error.message}`, true);
            
            const cachedProfiles = cache.get('all_profiles');
            if (cachedProfiles && cachedProfiles.length > 0) {
                console.log('Showing cached profiles from localStorage');
                allProfiles = shuffleArray(cachedProfiles);
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
        if (profileId && !updatedIds.has(profileId) && !item.classList.contains('product-row-card')) {
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
            recalculateProductPositions();
        }
    });
}

function updateProfileItem(item, profile) {
    const currentFollowing = item.querySelector('.add-clan-btn')?.dataset.following;
    const currentOnline = item.querySelector('.online-indicator')?.classList.contains('online');
    
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
                <i data-feather="users"></i>
                <h3 class="empty-title">No profiles yet</h3>
                <p>Be the first to create a profile!</p>
            </div>
        `;
        if (typeof feather !== 'undefined') feather.replace();
        return;
    }
    
    console.log(`Rendering ${allProfiles.length} profiles with product cards interspersed`);
    
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
                <i data-feather="search"></i>
                <h3 class="empty-title">No matching profiles</h3>
                <p>Try a different filter</p>
            </div>
        `;
        if (typeof feather !== 'undefined') feather.replace();
        return;
    }
    
    gamersListElement.innerHTML = '';
    filteredProfiles.forEach((profile, index) => {
        // Add profile card
        const card = createProfileItem(profile);
        card.style.animationDelay = `${index * 0.05}s`;
        gamersListElement.appendChild(card);
        
        // Insert product card every PRODUCT_INSERT_INTERVAL profiles
        if ((index + 1) % PRODUCT_INSERT_INTERVAL === 0 && index < filteredProfiles.length - 1) {
            const productRow = createProductRowCard();
            gamersListElement.appendChild(productRow);
            console.log(`📦 Inserted product card after profile ${index + 1}`);
        }
    });
    
    if (typeof feather !== 'undefined') {
        feather.replace();
    }
    
    // Update scroll dots
    setTimeout(setupScrollDots, 100);
    
    console.log('✅ Profiles rendered with product cards successfully');
}

function recalculateProductPositions() {
    const gamersListElement = document.getElementById('gamersList');
    if (!gamersListElement) return;
    
    const allItems = Array.from(gamersListElement.children);
    let profileCount = 0;
    let needsRebuild = false;
    
    allItems.forEach((item, index) => {
        if (item.classList.contains('product-row-card')) {
            if ((profileCount) % PRODUCT_INSERT_INTERVAL !== 0) {
                needsRebuild = true;
            }
        } else if (item.dataset.profileId) {
            profileCount++;
            if (profileCount % PRODUCT_INSERT_INTERVAL === 0) {
                const nextItem = allItems[index + 1];
                if (!nextItem || !nextItem.classList.contains('product-row-card')) {
                    needsRebuild = true;
                }
            }
        }
    });
    
    if (needsRebuild) {
        console.log('🔄 Rebuilding product card positions');
        renderProfilesList();
    }
}

function createProfileItem(profile) {
    const div = document.createElement('div');
    div.className = 'gamer-item';
    div.dataset.profileId = profile.id;

    const initials = profile.name ? profile.name.charAt(0).toUpperCase() : '?';
    const bgColors = ['#1a1a3e','#1e0a2e','#0a1e2e','#1e1a0a','#0a1e0a'];
    const bgColor = bgColors[profile.name ? profile.name.charCodeAt(0) % bgColors.length : 0];

    const rankDisplay = profile.isGamer && profile.gamerProfile?.rank ? profile.gamerProfile.rank : null;

    div.innerHTML = `
        <div class="card-bg-fallback" style="background: linear-gradient(160deg, ${bgColor}, #0e0e14);">
            ${initials}
        </div>

        <img class="card-bg"
             src="${profile.profileImage}"
             alt="${profile.name}"
             onerror="this.style.display='none'">

        <div class="card-gradient-top"></div>
        <div class="card-gradient-bottom"></div>

        <div class="card-status-badge ${profile.isOnline ? 'online' : 'offline'}">
            <span class="status-dot"></span>
            ${profile.isOnline ? 'Online' : 'Offline'}
        </div>

        ${profile.xpLevel ? `
            <div class="card-xp-badge">
                ${profile.xpIcon || '🌱'} Lv ${profile.xpLevel}
            </div>
        ` : ''}

        <div class="card-scroll-hint">
            <i data-feather="chevrons-down"></i>
        </div>

        <div class="card-info">
            <div class="card-name-row">
                <span class="card-name">${profile.name}</span>
                ${profile.age ? `<span class="card-age">${profile.age}</span>` : ''}
            </div>

            ${profile.location && profile.location !== 'Unknown' ? `
                <div class="card-location">
                    <i data-feather="map-pin"></i>
                    ${profile.location}
                </div>
            ` : ''}

            ${profile.bio && profile.bio !== 'No bio available' ? `
                <div class="card-bio">${profile.bio}</div>
            ` : ''}

            <div class="card-tags">
                ${rankDisplay ? `
                    <span class="card-tag gold">
                        <i data-feather="award"></i> ${rankDisplay}
                    </span>
                ` : ''}
                ${profile.isGamer ? `
                    <span class="card-tag pink">
                        <i data-feather="cpu"></i> Gamer
                    </span>
                ` : ''}
                ${profile.hasStore ? `
                    <span class="card-tag">
                        <i data-feather="shopping-bag"></i> Has Store
                    </span>
                ` : ''}
                ${profile.interests && profile.interests[0] ? `
                    <span class="card-tag">
                        <i data-feather="star"></i> ${profile.interests[0]}
                    </span>
                ` : ''}
                ${profile.isGamer && profile.gamerProfile?.primaryGame ? `
                    <span class="card-tag">
                        <i data-feather="target"></i> ${profile.gamerProfile.primaryGame}
                    </span>
                ` : ''}
            </div>
        </div>

        <div class="card-actions">
            <div class="clan-section">
                <span class="clan-count">
                    <i data-feather="user-plus"></i>
                    ${formatNumber(profile.clanCount || 0)}
                </span>
            </div>

            <div class="btn-wrap">
                <button class="add-clan-btn ${profile.isFollowing ? 'added' : ''}"
                        data-profile-id="${profile.id}"
                        data-following="${profile.isFollowing}"
                        title="${profile.isFollowing ? 'Following' : 'Follow'}">
                    <i data-feather="${profile.isFollowing ? 'check' : 'user-plus'}"></i>
                </button>
                <span class="card-action-label">${profile.isFollowing ? 'Following' : 'Follow'}</span>
            </div>

            <div class="btn-wrap">
                <button class="message-gamer-btn" data-profile-id="${profile.id}" title="Message ${profile.name}">
                    <i data-feather="message-circle"></i>
                </button>
                <span class="card-action-label">Message</span>
            </div>

            ${profile.hasStore ? `
                <div class="btn-wrap">
                    <button class="store-btn" data-profile-id="${profile.id}" data-store-id="${profile.storeId}" title="Visit Store">
                        <i data-feather="shopping-cart"></i>
                    </button>
                    <span class="card-action-label">Store</span>
                </div>
            ` : ''}
        </div>

        <div class="gamer-actions" style="display:none">
            <div class="clan-section"></div>
        </div>
    `;

    // Navigate to profile on card click (not on buttons)
    div.addEventListener('click', (e) => {
        if (!e.target.closest('.add-clan-btn') &&
            !e.target.closest('.message-gamer-btn') &&
            !e.target.closest('.store-btn')) {
            window.location.href = `profile.html?id=${profile.id}`;
        }
    });

    // Follow button
    const followBtn = div.querySelector('.add-clan-btn');
    if (followBtn) {
        followBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!currentUser) {
                showNotification('Please log in to follow users', 'warning');
                window.location.href = 'login.html';
                return;
            }
            const isCurrentlyFollowing = followBtn.dataset.following === 'true';
            try {
                if (isCurrentlyFollowing) {
                    await unfollowUser(profile.id);
                    followBtn.dataset.following = 'false';
                    followBtn.innerHTML = '<i data-feather="user-plus"></i>';
                    followBtn.classList.remove('added');
                    const label = followBtn.closest('.btn-wrap')?.querySelector('.card-action-label');
                    if (label) label.textContent = 'Follow';
                    const clanCountSpan = div.querySelector('.clan-count');
                    const newCount = Math.max(0, (profile.clanCount || 0) - 1);
                    clanCountSpan.innerHTML = `<i data-feather="user-plus"></i> ${formatNumber(newCount)}`;
                    profile.clanCount = newCount;
                    await indexedDBCache.setFollowStatus(currentUser.uid, profile.id, false);
                    if (typeof feather !== 'undefined') feather.replace();
                    showNotification(`Unfollowed ${profile.name}`, 'info');
                } else {
                    await followUser(profile.id);
                    followBtn.dataset.following = 'true';
                    followBtn.innerHTML = '<i data-feather="check"></i>';
                    followBtn.classList.add('added');
                    const label = followBtn.closest('.btn-wrap')?.querySelector('.card-action-label');
                    if (label) label.textContent = 'Following';
                    const clanCountSpan = div.querySelector('.clan-count');
                    const newCount = (profile.clanCount || 0) + 1;
                    clanCountSpan.innerHTML = `<i data-feather="user-plus"></i> ${formatNumber(newCount)}`;
                    profile.clanCount = newCount;
                    await indexedDBCache.setFollowStatus(currentUser.uid, profile.id, true);
                    if (xpSystem && typeof xpSystem.addXP === 'function') {
                        await xpSystem.addXP(15, `Followed ${profile.name}`);
                    }
                    if (typeof feather !== 'undefined') feather.replace();
                    showNotification(`Now following ${profile.name}`, 'success');
                }
            } catch (error) {
                console.error('Error toggling follow:', error);
                showNotification('Failed to update follow status', 'error');
            }
        });
    }

    // Message button
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

    // Store button
    const storeBtn = div.querySelector('.store-btn');
    if (storeBtn) {
        storeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            window.location.href = `store.html?id=${profile.storeId}`;
        });
    }

    // Init feather icons after render
    setTimeout(() => {
        if (typeof feather !== 'undefined') feather.replace();
    }, 50);

    return div;
}

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
                    <i data-feather="circle" fill="#00ff00"></i>
                    Online
                `;
            }
        } else {
            if (onlineBadge) onlineBadge.style.backgroundColor = '#ff0000';
            if (onlineStatusElement) {
                onlineStatusElement.innerHTML = `
                    <i data-feather="circle" fill="#ff0000"></i>
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
        followBtn.innerHTML = '<i data-feather="log-in"></i> Login to Follow';
        followBtn.classList.remove('btn-message');
        followBtn.classList.add('btn-follow');
        if (typeof feather !== 'undefined') feather.replace();
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
        followBtn.innerHTML = '<i data-feather="user-check"></i> Following';
        followBtn.classList.remove('btn-follow');
        followBtn.classList.add('btn-message');
        followBtn.dataset.following = 'true';
    } else {
        followBtn.innerHTML = '<i data-feather="user-plus"></i> Follow';
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
                            <i data-feather="user"></i>
                            <span>Gamer Tag: <strong>${gamerProfile.gamerTag || 'Not set'}</strong></span>
                        </div>
                        <div class="gamer-info-row">
                            <i data-feather="cpu"></i>
                            <span>Primary Game: <strong>${gamerProfile.primaryGame || 'Not specified'}</strong></span>
                        </div>
                        <div class="gamer-info-row">
                            <i data-feather="award"></i>
                            <span>Rank: <strong>${gamerProfile.rank || 'Not ranked'}</strong></span>
                        </div>
                        <div class="gamer-info-row">
                            <i data-feather="trending-up"></i>
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
                    followBtn.innerHTML = '<i data-feather="user-plus"></i> Follow';
                    followBtn.classList.remove('btn-message');
                    followBtn.classList.add('btn-follow');
                    
                    await updateFollowersCount(profileId);
                    
                    await indexedDBCache.setFollowStatus(currentUser.uid, profileId, false);
                    
                    if (typeof feather !== 'undefined') feather.replace();
                    showNotification(`Unfollowed user`, 'info');
                } else {
                    await followUser(profileId);
                    followBtn.dataset.following = 'true';
                    followBtn.innerHTML = '<i data-feather="user-check"></i> Following';
                    followBtn.classList.remove('btn-follow');
                    followBtn.classList.add('btn-message');
                    
                    await updateFollowersCount(profileId);
                    
                    await indexedDBCache.setFollowStatus(currentUser.uid, profileId, true);
                    
                    if (xpSystem && typeof xpSystem.addXP === 'function') {
                        await xpSystem.addXP(15, 'Followed a User');
                    }
                    
                    if (typeof feather !== 'undefined') feather.replace();
                    showNotification(`Now following user`, 'success');
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
                displayFilteredProfiles(shuffleArray(filtered));
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
        xpFilterBtn.innerHTML = '<i data-feather="award"></i> High XP';
        xpFilterBtn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
            xpFilterBtn.classList.add('active');
            currentFilter = 'xp';
            renderProfilesList();
        });
        filterContainer.appendChild(xpFilterBtn);
        if (typeof feather !== 'undefined') feather.replace();
    }
    
    console.log('Event listeners set up');
}

function displayFilteredProfiles(filteredProfiles) {
    const gamersListElement = document.getElementById('gamersList');
    if (!gamersListElement) return;
    
    if (filteredProfiles.length === 0) {
        gamersListElement.innerHTML = `
            <div class="empty-state">
                <i data-feather="search"></i>
                <h3 class="empty-title">No matching profiles</h3>
                <p>Try a different search term</p>
            </div>
        `;
        if (typeof feather !== 'undefined') feather.replace();
        return;
    }
    
    gamersListElement.innerHTML = '';
    filteredProfiles.forEach((profile, index) => {
        const card = createProfileItem(profile);
        card.style.animationDelay = `${index * 0.05}s`;
        gamersListElement.appendChild(card);
        
        // Insert product card every PRODUCT_INSERT_INTERVAL profiles for search results too
        if ((index + 1) % PRODUCT_INSERT_INTERVAL === 0 && index < filteredProfiles.length - 1) {
            const productRow = createProductRowCard();
            gamersListElement.appendChild(productRow);
        }
    });
    
    if (typeof feather !== 'undefined') {
        feather.replace();
    }
}

function createLoadingProfileItem() {
    const div = document.createElement('div');
    div.className = 'gamer-item loading';
    div.innerHTML = `
        <div class="profile-card-header">
            <div class="loading-avatar"></div>
            <div class="loading-info">
                <div class="loading-line" style="width: 60%"></div>
                <div class="loading-line short"></div>
                <div class="loading-line medium"></div>
            </div>
        </div>
        <div class="loading-line" style="width: 80%"></div>
        <div style="display: flex; gap: 6px; margin: 10px 0;">
            <div class="loading-line short"></div>
            <div class="loading-line short"></div>
        </div>
        <div style="display: flex; gap: 8px; margin-top: auto; padding-top: 12px;">
            <div class="loading-line" style="width: 30%"></div>
            <div class="loading-line" style="width: 30%"></div>
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
        <i data-feather="${icon}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    if (typeof feather !== 'undefined') {
        feather.replace();
    }
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, duration);
}

function showError(message, showRefresh = true) {
    const targetElement = isProfilePage ? document.querySelector('.profile-container') : 
                         document.getElementById('gamersList');
    
    if (targetElement) {
        targetElement.innerHTML = `
            <div class="empty-state">
                <i data-feather="alert-circle"></i>
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
        if (typeof feather !== 'undefined') feather.replace();
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

console.log('✅ gamers.js loaded successfully - Shuffled profiles with product cards integrated!');