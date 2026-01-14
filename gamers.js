// gamers.js - Enhanced with 100-item Pagination, Caching & Performance Optimizations
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
    limit,
    startAfter,
    doc,
    getDoc,
    updateDoc,
    arrayUnion,
    arrayRemove,
    serverTimestamp,
    onSnapshot,
    addDoc,
    deleteDoc,
    orderBy,
    setDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyC9uL_BX14Z6rRpgG4MT9Tca1opJl8EviQ",
    authDomain: "dating-connect.firebaseapp.com",
    projectId: "dating-connect",
    storageBucket: "dating-connect.appspot.com",
    messagingSenderId: "1062172180210",
    appId: "1:1062172180210:web:0c9b3c1578a5dbae58da6b"
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

// Global variables
let currentUser = null;
let allProfiles = [];
let filteredProfiles = [];
let currentFilter = 'all';
let lastVisibleDoc = null;
let isLoading = false;
let hasMore = true;
let PAGE_SIZE = 100; // Increased from 20 to 100
let networkStatus = 'online';
let reconnectAttempts = 0;
let maxReconnectAttempts = 5;
let challengeModalActive = false;
let currentChallengedUser = null;

// Performance Cache System
const profileCache = new Map();
const FOLLOWERS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const PROFILE_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const BATCH_SIZE = 25; // Process profiles in smaller batches for UI responsiveness
let cacheTimer = null;

// Network Monitor
let networkCheckInterval;
let lastSuccessfulFetch = null;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing gamers directory with enhanced features...');
    initGamersDirectory();
    initNetworkMonitor();
    setupCacheCleanup();
});

// Performance Cache System
function setupCacheCleanup() {
    // Clean up cache every minute
    cacheTimer = setInterval(() => {
        const now = Date.now();
        let cleanedCount = 0;
        
        for (const [key, value] of profileCache.entries()) {
            if (now - value.timestamp > PROFILE_CACHE_TTL) {
                profileCache.delete(key);
                cleanedCount++;
            }
        }
        
        if (cleanedCount > 0) {
            console.log(`Cache cleanup: removed ${cleanedCount} expired entries`);
        }
    }, 60 * 1000);
}

function getCachedProfile(userId) {
    const cached = profileCache.get(userId);
    if (cached && Date.now() - cached.timestamp < PROFILE_CACHE_TTL) {
        return cached.data;
    }
    return null;
}

function cacheProfile(userId, profile) {
    profileCache.set(userId, {
        data: profile,
        timestamp: Date.now()
    });
}

// Network Monitoring System
function initNetworkMonitor() {
    // Check network status
    window.addEventListener('online', () => {
        console.log('Network: Back online');
        networkStatus = 'online';
        showNetworkStatus('Connected', 'success');
        reconnectAttempts = 0;
        if (!isLoading && hasMore) {
            loadMoreProfiles();
        }
    });

    window.addEventListener('offline', () => {
        console.log('Network: Offline');
        networkStatus = 'offline';
        showNetworkStatus('No internet connection', 'error');
    });

    // Periodic network health check
    networkCheckInterval = setInterval(checkNetworkHealth, 10000);
}

function checkNetworkHealth() {
    if (navigator.onLine) {
        if (networkStatus !== 'online') {
            networkStatus = 'online';
            console.log('Network health: Good');
        }
    } else {
        networkStatus = 'offline';
        console.log('Network health: Offline');
        
        // Attempt auto-reconnect
        if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            console.log(`Reconnect attempt ${reconnectAttempts}/${maxReconnectAttempts}`);
            attemptReconnect();
        }
    }
}

function attemptReconnect() {
    if (navigator.onLine && !isLoading) {
        loadAllProfiles();
        reconnectAttempts = 0;
    }
}

function showNetworkStatus(message, type) {
    const existingStatus = document.querySelector('.network-status');
    if (existingStatus) existingStatus.remove();

    const statusDiv = document.createElement('div');
    statusDiv.className = `network-status ${type}`;
    statusDiv.style.cssText = `
        position: fixed;
        top: 70px;
        left: 50%;
        transform: translateX(-50%);
        background: ${type === 'success' ? 'rgba(0, 255, 136, 0.2)' : 'rgba(255, 42, 109, 0.2)'};
        color: ${type === 'success' ? '#00ff88' : '#ff2a6d'};
        padding: 8px 16px;
        border-radius: 20px;
        border: 1px solid ${type === 'success' ? 'rgba(0, 255, 136, 0.3)' : 'rgba(255, 42, 109, 0.3)'};
        backdrop-filter: blur(10px);
        z-index: 999;
        font-size: 14px;
        display: flex;
        align-items: center;
        gap: 8px;
        animation: slideDown 0.3s ease;
    `;

    const icon = type === 'success' ? 'wifi' : 'wifi-off';
    statusDiv.innerHTML = `
        <svg class="feather" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            ${getIconSVG(icon)}
        </svg>
        ${message}
    `;

    document.body.appendChild(statusDiv);

    // Auto remove after 3 seconds
    setTimeout(() => {
        if (statusDiv.parentNode) {
            statusDiv.style.animation = 'slideUp 0.3s ease';
            setTimeout(() => statusDiv.remove(), 300);
        }
    }, 3000);

    // Add animation styles if not exists
    if (!document.querySelector('#network-animations')) {
        const style = document.createElement('style');
        style.id = 'network-animations';
        style.textContent = `
            @keyframes slideDown {
                from { transform: translate(-50%, -100%); opacity: 0; }
                to { transform: translate(-50%, 0); opacity: 1; }
            }
            @keyframes slideUp {
                from { transform: translate(-50%, 0); opacity: 1; }
                to { transform: translate(-50%, -100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
}

async function initGamersDirectory() {
    try {
        // Initialize Feather Icons
        if (typeof feather !== 'undefined') {
            feather.replace();
        }
        
        // Add global styles for hover effect fix
        addGlobalStyles();
        
        // Set up auth state listener
        onAuthStateChanged(auth, async (user) => {
            console.log('Auth state changed:', user ? 'User logged in' : 'No user');
            currentUser = user;
            
            // Load initial profiles with pagination
            await loadInitialProfiles();
            setupEventListeners();
            setupInfiniteScroll();
        }, (error) => {
            console.error('Auth error:', error);
            loadInitialProfiles();
            setupEventListeners();
            setupInfiniteScroll();
        });
        
    } catch (error) {
        console.error('Error initializing:', error);
        showError('Failed to initialize. Please refresh.', true);
    }
}

// Add global styles for hover effect fix
function addGlobalStyles() {
    const style = document.createElement('style');
    style.id = 'gamers-global-styles';
    style.textContent = `
        /* Fix for hover effect on gamer items */
        .gamer-item {
            position: relative;
            transition: all 0.3s ease;
        }
        
        .gamer-item:hover {
            background: rgba(255, 42, 109, 0.05);
            transform: translateY(-2px);
            box-shadow: 0 8px 30px rgba(255, 42, 109, 0.15);
        }
        
        /* Prevent hover effect propagation to buttons */
        .gamer-item .add-clan-btn,
        .gamer-item .challenge-btn,
        .gamer-item .clan-section {
            pointer-events: auto;
        }
        
        /* Challenge button styles */
        .challenge-btn {
            background: linear-gradient(135deg, var(--primary), var(--primary-dark));
            color: white;
            border: none;
            padding: 8px 15px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 6px;
            transition: all 0.3s ease;
            text-decoration: none;
            position: relative;
            z-index: 10;
            box-shadow: 0 4px 15px rgba(179, 0, 75, 0.2);
        }
        
        .challenge-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(179, 0, 75, 0.3);
            background: linear-gradient(135deg, var(--primary-dark), var(--primary));
        }
        
        .challenge-btn:active {
            transform: translateY(0);
        }
        
        .challenge-btn svg {
            width: 14px;
            height: 14px;
            stroke: currentColor;
        }
        
        /* Loading animations */
        @keyframes shimmer {
            0% { background-position: -468px 0; }
            100% { background-position: 468px 0; }
        }
        
        .gamer-item.loading {
            animation: shimmer 1.5s infinite linear;
            background: linear-gradient(to right, #1a1a2e 4%, #16213e 25%, #1a1a2e 36%);
            background-size: 800px 100%;
        }
        
        /* Performance improvements */
        .gamer-item {
            will-change: transform, box-shadow;
            backface-visibility: hidden;
        }
        
        /* Optimize image loading */
        .gamer-avatar {
            content-visibility: auto;
            contain-intrinsic-size: 60px;
        }
    `;
    document.head.appendChild(style);
}

async function loadInitialProfiles() {
    const gamersListElement = document.getElementById('gamersList');
    if (!gamersListElement) {
        console.error('Cannot find #gamersList element');
        return;
    }
    
    console.log('Loading initial profiles with 100-item pagination...');
    
    // Reset pagination
    allProfiles = [];
    filteredProfiles = [];
    lastVisibleDoc = null;
    hasMore = true;
    
    // Show loading state with fewer skeletons for performance
    gamersListElement.innerHTML = '';
    for (let i = 0; i < 6; i++) {
        gamersListElement.appendChild(createLoadingProfileItem());
    }
    
    // Start loading profiles
    await loadMoreProfiles();
}

async function loadMoreProfiles() {
    if (isLoading || !hasMore) return;
    
    isLoading = true;
    const gamersListElement = document.getElementById('gamersList');
    const startTime = performance.now();
    
    try {
        if (!db) {
            console.error('Firestore not initialized');
            showError('Database service unavailable', false);
            return;
        }
        
        // Remove loading skeletons if this is first load
        if (allProfiles.length === 0) {
            const loadingItems = gamersListElement.querySelectorAll('.gamer-item.loading');
            loadingItems.forEach(item => item.remove());
        }
        
        // Show loading indicator at bottom
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'loading-indicator';
        loadingIndicator.innerHTML = `
            <div style="text-align: center; padding: 20px; color: var(--text-light);">
                <div style="display: inline-block; animation: spin 1s linear infinite;">
                    <svg class="feather" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                        <line x1="12" y1="2" x2="12" y2="6"></line>
                        <line x1="12" y1="18" x2="12" y2="22"></line>
                        <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                        <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                        <line x1="2" y1="12" x2="6" y2="12"></line>
                        <line x1="18" y1="12" x2="22" y2="12"></line>
                        <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                        <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                    </svg>
                </div>
                <div style="margin-top: 10px; font-size: 12px;">Loading more gamers...</div>
            </div>
        `;
        gamersListElement.appendChild(loadingIndicator);
        
        // Get users with pagination - 100 items per batch
        const usersRef = collection(db, 'users');
        let usersQuery = query(usersRef, orderBy('name'), limit(PAGE_SIZE));
        
        if (lastVisibleDoc) {
            usersQuery = query(usersRef, orderBy('name'), startAfter(lastVisibleDoc), limit(PAGE_SIZE));
        }
        
        console.log(`Querying ${PAGE_SIZE} users with pagination...`);
        const usersSnap = await getDocs(usersQuery);
        console.log(`Found ${usersSnap.size} users in this batch`);
        
        if (usersSnap.empty) {
            hasMore = false;
            // Remove loading indicator
            loadingIndicator.remove();
            
            if (allProfiles.length === 0) {
                showEmptyState();
            } else {
                // Show "end of results" message
                const endMessage = document.createElement('div');
                endMessage.className = 'end-of-results';
                endMessage.style.cssText = `
                    text-align: center;
                    padding: 20px;
                    color: var(--text-light);
                    font-size: 12px;
                `;
                endMessage.textContent = 'No more gamers to load';
                gamersListElement.appendChild(endMessage);
            }
            isLoading = false;
            return;
        }
        
        // Process batch in smaller chunks for better UI responsiveness
        const currentUserId = currentUser ? currentUser.uid : null;
        const batchProfiles = [];
        const userDocs = usersSnap.docs;
        
        // Process first 25 immediately for fast display
        const immediateBatch = userDocs.slice(0, Math.min(25, userDocs.length));
        for (const userDoc of immediateBatch) {
            const userId = userDoc.id;
            const userData = userDoc.data();
            
            // Skip current user if logged in
            if (currentUserId && userId === currentUserId) continue;
            
            const profile = await processUserProfile(userId, userData);
            if (profile) {
                batchProfiles.push(profile);
            }
        }
        
        // Render first batch immediately
        if (batchProfiles.length > 0) {
            loadingIndicator.remove();
            renderProfilesBatch(batchProfiles);
            
            // Process remaining profiles in background
            if (userDocs.length > 25) {
                processRemainingProfiles(userDocs.slice(25), currentUserId);
            }
        }
        
        // Update last visible document
        lastVisibleDoc = usersSnap.docs[usersSnap.docs.length - 1];
        hasMore = usersSnap.docs.length === PAGE_SIZE;
        
        // Add to all profiles
        allProfiles.push(...batchProfiles);
        
        // Update last successful fetch time
        lastSuccessfulFetch = Date.now();
        
        const loadTime = performance.now() - startTime;
        console.log(`Initial batch loaded in ${loadTime.toFixed(2)}ms`);
        
    } catch (error) {
        console.error('Error loading profiles:', error);
        showError(`Failed to load profiles: ${error.message}`, true);
        // Network error - mark for retry
        if (error.code === 'unavailable') {
            networkStatus = 'offline';
            showNetworkStatus('Connection lost. Retrying...', 'error');
        }
    } finally {
        isLoading = false;
    }
}

async function processRemainingProfiles(userDocs, currentUserId) {
    // Process remaining profiles in background
    const remainingProfiles = [];
    
    for (let i = 0; i < userDocs.length; i++) {
        const userDoc = userDocs[i];
        const userId = userDoc.id;
        const userData = userDoc.data();
        
        // Skip current user if logged in
        if (currentUserId && userId === currentUserId) continue;
        
        const profile = await processUserProfile(userId, userData);
        if (profile) {
            remainingProfiles.push(profile);
        }
        
        // Render every 25 profiles to keep UI responsive
        if (remainingProfiles.length >= BATCH_SIZE) {
            renderProfilesBatch(remainingProfiles);
            allProfiles.push(...remainingProfiles);
            remainingProfiles.length = 0; // Clear array
        }
    }
    
    // Render any remaining profiles
    if (remainingProfiles.length > 0) {
        renderProfilesBatch(remainingProfiles);
        allProfiles.push(...remainingProfiles);
    }
}

function renderProfilesBatch(profiles) {
    const gamersListElement = document.getElementById('gamersList');
    if (!gamersListElement) return;
    
    // Use document fragment for better performance
    const fragment = document.createDocumentFragment();
    
    // Sort profiles: online first, then by name
    profiles.sort((a, b) => {
        if (a.isOnline && !b.isOnline) return -1;
        if (!a.isOnline && b.isOnline) return 1;
        return a.name.localeCompare(b.name);
    });
    
    profiles.forEach(profile => {
        fragment.appendChild(createProfileItem(profile));
    });
    
    gamersListElement.appendChild(fragment);
    
    // Update Feather Icons
    if (typeof feather !== 'undefined') {
        requestAnimationFrame(() => {
            feather.replace();
        });
    }
    
    console.log(`Added ${profiles.length} profiles to display`);
}

function setupInfiniteScroll() {
    const gamersListElement = document.getElementById('gamersList');
    if (!gamersListElement) return;
    
    let scrollTimeout;
    let lastScrollTime = 0;
    const SCROLL_THROTTLE_MS = 100;
    
    gamersListElement.addEventListener('scroll', () => {
        const now = Date.now();
        if (now - lastScrollTime < SCROLL_THROTTLE_MS) return;
        lastScrollTime = now;
        
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            const scrollTop = gamersListElement.scrollTop;
            const scrollHeight = gamersListElement.scrollHeight;
            const clientHeight = gamersListElement.clientHeight;
            
            // Load more when 70% scrolled (more aggressive for 100-item batches)
            if (scrollTop + clientHeight >= scrollHeight * 0.7) {
                if (!isLoading && hasMore && networkStatus === 'online') {
                    loadMoreProfiles();
                }
            }
        }, 50);
    });
}

async function processUserProfile(userId, userData) {
    // Check cache first
    const cachedProfile = getCachedProfile(userId);
    if (cachedProfile) {
        // Check if current user's follow status changed
        if (currentUser) {
            cachedProfile.isFollowing = await checkIfFollowing(userId, currentUser.uid);
        }
        return cachedProfile;
    }
    
    try {
        // Basic profile data
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
            isInGame: userData.inGame || false,
            currentGame: userData.currentGame || null
        };
        
        // Parallelize data fetching for better performance
        const [statusData, gamerData, followersCount, followingStatus] = await Promise.allSettled([
            getOnlineStatus(userId),
            getGamerProfile(userId),
            getFollowersCount(userId),
            currentUser ? checkIfFollowing(userId, currentUser.uid) : Promise.resolve(false)
        ]);
        
        // Set results
        profile.isOnline = statusData.status === 'fulfilled' && statusData.value;
        if (gamerData.status === 'fulfilled' && gamerData.value) {
            profile.isGamer = true;
            profile.gamerProfile = gamerData.value;
        }
        profile.clanCount = followersCount.status === 'fulfilled' ? followersCount.value : 0;
        profile.isFollowing = followingStatus.status === 'fulfilled' ? followingStatus.value : false;
        
        // Cache the processed profile
        cacheProfile(userId, profile);
        
        return profile;
        
    } catch (error) {
        console.error('Error processing user profile:', userId, error);
        return null;
    }
}

async function getOnlineStatus(userId) {
    try {
        const statusRef = doc(db, 'status', userId);
        const statusSnap = await getDoc(statusRef);
        return statusSnap.exists() && statusSnap.data().state === 'online';
    } catch (error) {
        console.log('Could not get status for user:', userId);
        return false;
    }
}

async function getGamerProfile(userId) {
    try {
        const gamerProfileRef = collection(db, 'users', userId, 'gamerProfile');
        const gamerProfileSnap = await getDocs(gamerProfileRef);
        if (!gamerProfileSnap.empty) {
            return gamerProfileSnap.docs[0].data();
        }
    } catch (error) {
        console.log('No gamer profile for:', userId);
    }
    return null;
}

async function getFollowersCount(userId) {
    // Check cache for followers count
    const cacheKey = `followers_${userId}`;
    const cached = profileCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < FOLLOWERS_CACHE_TTL) {
        return cached.data;
    }
    
    try {
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            const userData = userSnap.data();
            let count = 0;
            if (userData.followers && Array.isArray(userData.followers)) {
                count = userData.followers.length;
            } else if (userData.likes) {
                count = userData.likes;
            }
            
            // Cache the result
            profileCache.set(cacheKey, {
                data: count,
                timestamp: Date.now()
            });
            
            return count;
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

function createProfileItem(profile) {
    const div = document.createElement('div');
    div.className = 'gamer-item';
    div.dataset.profileId = profile.id;
    
    // Prepare attributes
    const attributes = [];
    if (profile.age) attributes.push(`${profile.age} yrs`);
    if (profile.location) attributes.push(profile.location);
    if (profile.isGamer && profile.gamerProfile?.primaryGame) {
        attributes.push(profile.gamerProfile.primaryGame);
    }
    
    // Gamer badge
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
    
    // In-game indicator
    const inGameBadge = profile.isInGame ? `
        <span class="attribute-tag" style="background: rgba(0, 255, 136, 0.2); border-color: #00ff88; color: #00ff88;">
            <svg class="feather" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width: 10px; height: 10px; margin-right: 3px;">
                <polygon points="23 7 16 12 23 17 23 7"></polygon>
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
            </svg>
            In Game${profile.currentGame ? `: ${profile.currentGame}` : ''}
        </span>
    ` : '';
    
    const buttonText = profile.isFollowing ? 'Following' : 'Follow';
    const buttonClass = profile.isFollowing ? 'add-clan-btn added' : 'add-clan-btn';
    const followersCount = profile.clanCount || 0;
    
    div.innerHTML = `
        <img src="${profile.profileImage}" alt="${profile.name}" class="gamer-avatar" 
             loading="lazy" 
             onerror="this.onerror=null; this.src='images-default-profile.jpg';">
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
                ${profile.isGamer && profile.gamerProfile?.level ? `
                    <span class="gamer-stat gamer-level">
                        <svg class="feather" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
                            <polyline points="17 6 23 6 23 12"></polyline>
                        </svg>
                        Lvl ${profile.gamerProfile.level}
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
                        ${profile.likes}
                    </span>
                ` : ''}
            </div>
            <div class="gamer-attributes">
                ${gamerBadge}
                ${inGameBadge}
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
                    ${followersCount}
                </span>
            </div>
            ${profile.isGamer && currentUser && currentUser.uid !== profile.id ? `
                <button class="challenge-btn" data-profile-id="${profile.id}" title="Challenge to a game">
                    <svg class="feather" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                        <polyline points="13 2 13 9 20 9"></polyline>
                    </svg>
                    Challenge
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
        </div>
    `;
    
    // Click event for profile navigation - FIXED to prevent button clicks from triggering navigation
    div.addEventListener('click', (e) => {
        // Check if the click was on a button or its children
        if (e.target.closest('.add-clan-btn') || 
            e.target.closest('.clan-section') ||
            e.target.closest('.challenge-btn') ||
            e.target.closest('button') ||
            e.target.tagName === 'BUTTON' ||
            e.target.tagName === 'svg' ||
            e.target.tagName === 'path') {
            return; // Don't navigate if clicking buttons
        }
        window.location.href = `profile.html?id=${profile.id}`;
    });
    
    // Follow/Unfollow button event
    const clanBtn = div.querySelector('.add-clan-btn');
    if (clanBtn) {
        // Prevent event propagation to parent div
        clanBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            handleFollowClick(profile, clanBtn, div);
        });
    }
    
    // Challenge button event
    const challengeBtn = div.querySelector('.challenge-btn');
    if (challengeBtn) {
        challengeBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            handleChallengeClick(profile);
        });
    }
    
    return div;
}

async function handleFollowClick(profile, clanBtn, div) {
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
            
            // Update followers count
            const clanCountSpan = div.querySelector('.clan-count');
            const currentCount = parseInt(clanCountSpan.textContent) || 0;
            clanCountSpan.textContent = Math.max(0, currentCount - 1);
            
            // Update cache
            profile.clanCount = Math.max(0, currentCount - 1);
            profile.isFollowing = false;
            cacheProfile(profile.id, profile);
            
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
            
            // Update followers count
            const clanCountSpan = div.querySelector('.clan-count');
            const currentCount = parseInt(clanCountSpan.textContent) || 0;
            clanCountSpan.textContent = currentCount + 1;
            
            // Update cache
            profile.clanCount = currentCount + 1;
            profile.isFollowing = true;
            cacheProfile(profile.id, profile);
            
            showNotification(`Now following ${profile.name}`, 'success');
        }
    } catch (error) {
        console.error('Error toggling follow:', error);
        showNotification('Failed to update follow status', 'error');
    }
}

async function handleChallengeClick(profile) {
    if (!currentUser) {
        showNotification('Please log in to challenge players', 'warning');
        window.location.href = 'login.html';
        return;
    }
    
    if (profile.isInGame) {
        showNotification(`${profile.name} is already in a game. Try again later.`, 'warning');
        return;
    }
    
    // Show challenge modal
    showChallengeModal(profile);
}

// CHALLENGE SYSTEM FUNCTIONS
function showChallengeModal(profile) {
    if (challengeModalActive) return;
    
    challengeModalActive = true;
    currentChallengedUser = profile;
    
    // Create modal
    const modal = document.createElement('div');
    modal.id = 'challengeModal';
    modal.className = 'challenge-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2000;
        padding: 20px;
        backdrop-filter: blur(10px);
        animation: fadeIn 0.3s ease;
    `;
    
    // Get available games from both profiles
    const userGames = getAvailableGames();
    const opponentGames = profile.gamerProfile ? getGamesFromProfile(profile.gamerProfile) : [];
    const commonGames = userGames.filter(game => opponentGames.includes(game));
    
    modal.innerHTML = `
        <div class="challenge-modal-content" style="
            background: var(--bg-card);
            border-radius: var(--radius-lg);
            width: 100%;
            max-width: 500px;
            max-height: 80vh;
            overflow-y: auto;
            border: 1px solid var(--border);
            box-shadow: var(--shadow-lg);
        ">
            <div class="challenge-modal-header" style="
                padding: 20px;
                border-bottom: 1px solid var(--border);
                display: flex;
                justify-content: space-between;
                align-items: center;
            ">
                <h3 class="challenge-modal-title" style="
                    font-size: 1.3rem;
                    font-weight: 600;
                    color: var(--text-primary);
                ">Challenge ${profile.name}</h3>
                <button class="close-challenge-modal" style="
                    background: none;
                    border: none;
                    color: var(--text-secondary);
                    cursor: pointer;
                    padding: 5px;
                    border-radius: 50%;
                    transition: all 0.3s ease;
                ">
                    <svg class="feather" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
            
            <div class="challenge-modal-body" style="padding: 20px;">
                <div class="opponent-info" style="
                    display: flex;
                    align-items: center;
                    gap: 15px;
                    margin-bottom: 20px;
                    padding: 15px;
                    background: var(--bg-light);
                    border-radius: var(--radius);
                ">
                    <img src="${profile.profileImage}" alt="${profile.name}" 
                         style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover; border: 2px solid var(--primary);"
                         onerror="this.src='images-default-profile.jpg';">
                    <div>
                        <h4 style="color: var(--text-primary); margin-bottom: 5px;">${profile.name}</h4>
                        ${profile.gamerProfile?.gamerTag ? `
                            <p style="color: var(--primary-light); font-size: 0.9rem; margin-bottom: 5px;">
                                ${profile.gamerProfile.gamerTag}
                            </p>
                        ` : ''}
                        ${profile.gamerProfile?.rank ? `
                            <p style="color: #FFD700; font-size: 0.9rem;">${profile.gamerProfile.rank}</p>
                        ` : ''}
                    </div>
                </div>
                
                <div class="game-selection" style="margin-bottom: 20px;">
                    <label style="
                        display: block;
                        margin-bottom: 10px;
                        color: var(--text-secondary);
                        font-size: 0.9rem;
                    ">Select Game</label>
                    <div class="game-options" style="display: grid; gap: 10px;">
                        ${commonGames.length > 0 ? commonGames.map(game => `
                            <label class="game-option" style="
                                display: flex;
                                align-items: center;
                                gap: 10px;
                                padding: 12px;
                                background: var(--bg-primary);
                                border: 2px solid var(--border);
                                border-radius: var(--radius);
                                cursor: pointer;
                                transition: all 0.3s ease;
                            ">
                                <input type="radio" name="selectedGame" value="${game}" style="display: none;">
                                <div class="game-radio" style="
                                    width: 20px;
                                    height: 20px;
                                    border: 2px solid var(--text-secondary);
                                    border-radius: 50%;
                                    position: relative;
                                "></div>
                                <span style="color: var(--text-primary); font-weight: 500;">${game}</span>
                                <span style="margin-left: auto; color: #00ff88; font-size: 0.8rem;">
                                    <svg class="feather" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width: 14px; height: 14px;">
                                        <path d="M20 6L9 17l-5-5"></path>
                                    </svg>
                                    Both play
                                </span>
                            </label>
                        `).join('') : ''}
                        
                        <div class="custom-game" style="margin-top: 15px;">
                            <label style="
                                display: block;
                                margin-bottom: 8px;
                                color: var(--text-secondary);
                                font-size: 0.9rem;
                            ">Or enter custom game</label>
                            <input type="text" id="customGame" placeholder="Enter game name" style="
                                width: 100%;
                                padding: 12px;
                                background: var(--bg-primary);
                                border: 1px solid var(--border);
                                border-radius: var(--radius);
                                color: var(--text-primary);
                                font-size: 14px;
                                transition: border-color 0.3s ease;
                            ">
                        </div>
                    </div>
                </div>
                
                <div class="challenge-message" style="margin-bottom: 20px;">
                    <label style="
                        display: block;
                        margin-bottom: 10px;
                        color: var(--text-secondary);
                        font-size: 0.9rem;
                    ">Challenge Message</label>
                    <textarea id="challengeMessage" placeholder="Add a message to your challenge..." rows="3" style="
                        width: 100%;
                        padding: 12px;
                        background: var(--bg-primary);
                        border: 1px solid var(--border);
                        border-radius: var(--radius);
                        color: var(--text-primary);
                        font-size: 14px;
                        resize: vertical;
                        transition: border-color 0.3s ease;
                    "></textarea>
                </div>
            </div>
            
            <div class="challenge-modal-footer" style="
                padding: 20px;
                border-top: 1px solid var(--border);
                display: flex;
                justify-content: flex-end;
                gap: 10px;
            ">
                <button class="btn-secondary cancel-challenge" style="
                    background: var(--bg-primary);
                    border: 1px solid var(--border);
                    color: var(--text-primary);
                    padding: 10px 20px;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                ">Cancel</button>
                <button class="btn-primary send-challenge" style="
                    background: linear-gradient(135deg, var(--primary), var(--primary-dark));
                    border: none;
                    color: white;
                    padding: 10px 20px;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                ">Send Challenge</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add modal styles
    if (!document.querySelector('#challenge-modal-styles')) {
        const style = document.createElement('style');
        style.id = 'challenge-modal-styles';
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            .game-option.selected {
                border-color: var(--primary);
                background: rgba(179, 0, 75, 0.1);
            }
            
            .game-option.selected .game-radio {
                border-color: var(--primary);
            }
            
            .game-option.selected .game-radio::after {
                content: '';
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 10px;
                height: 10px;
                background: var(--primary);
                border-radius: 50%;
            }
        `;
        document.head.appendChild(style);
    }
    
    // Setup modal event listeners
    setupChallengeModalEvents(modal);
}

function setupChallengeModalEvents(modal) {
    // Close modal
    const closeBtn = modal.querySelector('.close-challenge-modal');
    const cancelBtn = modal.querySelector('.cancel-challenge');
    
    const closeModal = () => {
        modal.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => {
            if (modal.parentNode) {
                modal.parentNode.removeChild(modal);
            }
            challengeModalActive = false;
            currentChallengedUser = null;
        }, 300);
    };
    
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    
    // Click outside to close
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
    
    // Game selection
    const gameOptions = modal.querySelectorAll('.game-option');
    gameOptions.forEach(option => {
        option.addEventListener('click', () => {
            gameOptions.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            const radio = option.querySelector('input[type="radio"]');
            if (radio) radio.checked = true;
        });
    });
    
    // Send challenge
    const sendBtn = modal.querySelector('.send-challenge');
    if (sendBtn) {
        sendBtn.addEventListener('click', async () => {
            const selectedGameOption = modal.querySelector('.game-option.selected input[type="radio"]');
            const customGame = modal.querySelector('#customGame').value.trim();
            const message = modal.querySelector('#challengeMessage').value.trim();
            
            let game;
            if (selectedGameOption) {
                game = selectedGameOption.value;
            } else if (customGame) {
                game = customGame;
            } else {
                showNotification('Please select or enter a game', 'warning');
                return;
            }
            
            try {
                await sendChallenge(game, message);
                showNotification(`Challenge sent to ${currentChallengedUser.name}!`, 'success');
                closeModal();
            } catch (error) {
                console.error('Error sending challenge:', error);
                showNotification('Failed to send challenge', 'error');
            }
        });
    }
}

async function sendChallenge(game, message) {
    if (!currentUser || !currentChallengedUser) return;
    
    try {
        const challengeData = {
            challengerId: currentUser.uid,
            challengerName: currentUser.displayName || 'Anonymous',
            opponentId: currentChallengedUser.id,
            opponentName: currentChallengedUser.name,
            game: game,
            message: message || `Let's play ${game}!`,
            status: 'pending', // pending, accepted, rejected, completed
            createdAt: serverTimestamp(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // Expires in 24 hours
        };
        
        // Add challenge to Firestore
        const challengeRef = await addDoc(collection(db, 'challenges'), challengeData);
        
        // Create notification for opponent
        const notificationData = {
            type: 'challenge',
            fromUserId: currentUser.uid,
            fromUserName: currentUser.displayName || 'Anonymous',
            toUserId: currentChallengedUser.id,
            challengeId: challengeRef.id,
            game: game,
            message: message || `challenged you to play ${game}`,
            isRead: false,
            createdAt: serverTimestamp()
        };
        
        await addDoc(collection(db, 'notifications'), notificationData);
        
        // Send real-time notification if opponent is online
        await updateDoc(doc(db, 'users', currentChallengedUser.id), {
            hasUnreadNotifications: true,
            lastNotification: serverTimestamp()
        });
        
    } catch (error) {
        console.error('Error sending challenge:', error);
        throw error;
    }
}

function getAvailableGames() {
    // Get games from user's gamer profile
    // For now, return common games
    return [
        'Call of Duty: Warzone',
        'Fortnite',
        'Apex Legends',
        'Valorant',
        'League of Legends',
        'Counter-Strike 2',
        'Rainbow Six Siege',
        'Overwatch 2',
        'PUBG',
        'Minecraft'
    ];
}

function getGamesFromProfile(gamerProfile) {
    const games = [];
    if (gamerProfile.primaryGame) games.push(gamerProfile.primaryGame);
    // Add more games from profile if available
    return games;
}

async function acceptChallenge(challengeId) {
    try {
        // Update challenge status
        const challengeRef = doc(db, 'challenges', challengeId);
        await updateDoc(challengeRef, {
            status: 'accepted',
            acceptedAt: serverTimestamp()
        });
        
        // Set both users as "in game"
        const challengeDoc = await getDoc(challengeRef);
        const challengeData = challengeDoc.data();
        
        // Set challenger in game
        await updateDoc(doc(db, 'users', challengeData.challengerId), {
            inGame: true,
            currentGame: challengeData.game,
            currentOpponent: challengeData.opponentId,
            currentChallenge: challengeId,
            lastGameStart: serverTimestamp()
        });
        
        // Set opponent in game
        await updateDoc(doc(db, 'users', challengeData.opponentId), {
            inGame: true,
            currentGame: challengeData.game,
            currentOpponent: challengeData.challengerId,
            currentChallenge: challengeId,
            lastGameStart: serverTimestamp()
        });
        
        showNotification('Challenge accepted! Good luck!', 'success');
        
    } catch (error) {
        console.error('Error accepting challenge:', error);
        throw error;
    }
}

async function rejectChallenge(challengeId) {
    try {
        const challengeRef = doc(db, 'challenges', challengeId);
        await updateDoc(challengeRef, {
            status: 'rejected',
            rejectedAt: serverTimestamp()
        });
        
        showNotification('Challenge rejected', 'info');
        
    } catch (error) {
        console.error('Error rejecting challenge:', error);
        throw error;
    }
}

async function completeGame(challengeId) {
    try {
        const challengeRef = doc(db, 'challenges', challengeId);
        const challengeDoc = await getDoc(challengeRef);
        const challengeData = challengeDoc.data();
        
        // Update challenge status
        await updateDoc(challengeRef, {
            status: 'completed',
            completedAt: serverTimestamp()
        });
        
        // Remove "in game" status from both users
        await updateDoc(doc(db, 'users', challengeData.challengerId), {
            inGame: false,
            currentGame: null,
            currentOpponent: null,
            currentChallenge: null
        });
        
        await updateDoc(doc(db, 'users', challengeData.opponentId), {
            inGame: false,
            currentGame: null,
            currentOpponent: null,
            currentChallenge: null
        });
        
        showNotification('Game completed! Results saved.', 'success');
        
    } catch (error) {
        console.error('Error completing game:', error);
        throw error;
    }
}

// Utility Functions
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

function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // Search functionality
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
                    profile.bio.toLowerCase().includes(searchTerm)
                );
                displayFilteredProfiles(filtered);
            } else {
                renderFullList();
            }
        }, 300));
    }
    
    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            currentFilter = button.dataset.filter;
            applyFilter();
        });
    });
    
    console.log('Event listeners set up');
}

function applyFilter() {
    const gamersListElement = document.getElementById('gamersList');
    if (!gamersListElement) return;
    
    switch(currentFilter) {
        case 'all':
            filteredProfiles = [...allProfiles];
            break;
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
    }
    
    renderFilteredList();
}

function renderFullList() {
    const gamersListElement = document.getElementById('gamersList');
    if (!gamersListElement) return;
    
    gamersListElement.innerHTML = '';
    allProfiles.forEach(profile => {
        gamersListElement.appendChild(createProfileItem(profile));
    });
    
    if (typeof feather !== 'undefined') {
        requestAnimationFrame(() => {
            feather.replace();
        });
    }
}

function renderFilteredList() {
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
        requestAnimationFrame(() => {
            feather.replace();
        });
    }
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
        requestAnimationFrame(() => {
            feather.replace();
        });
    }
}

function showEmptyState() {
    const gamersListElement = document.getElementById('gamersList');
    if (gamersListElement) {
        gamersListElement.innerHTML = `
            <div class="empty-state">
                <svg class="feather" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <h3 class="empty-title">No gamers found</h3>
                <p>Be the first to create a gamer profile!</p>
            </div>
        `;
    }
}

async function followUser(targetUserId) {
    try {
        const targetUserRef = doc(db, 'users', targetUserId);
        await updateDoc(targetUserRef, {
            followers: arrayUnion(currentUser.uid),
            updatedAt: serverTimestamp()
        });
        
        const currentUserRef = doc(db, 'users', currentUser.uid);
        await updateDoc(currentUserRef, {
            following: arrayUnion(targetUserId),
            updatedAt: serverTimestamp()
        });
        
        await updateDoc(targetUserRef, {
            likes: arrayUnion(currentUser.uid)
        });
        
        // Clear cache for this user
        const cacheKey = `followers_${targetUserId}`;
        profileCache.delete(cacheKey);
        
    } catch (error) {
        console.error('Error following user:', error);
        throw error;
    }
}

async function unfollowUser(targetUserId) {
    try {
        const targetUserRef = doc(db, 'users', targetUserId);
        await updateDoc(targetUserRef, {
            followers: arrayRemove(currentUser.uid),
            updatedAt: serverTimestamp()
        });
        
        const currentUserRef = doc(db, 'users', currentUser.uid);
        await updateDoc(currentUserRef, {
            following: arrayRemove(targetUserId),
            updatedAt: serverTimestamp()
        });
        
        await updateDoc(targetUserRef, {
            likes: arrayRemove(currentUser.uid)
        });
        
        // Clear cache for this user
        const cacheKey = `followers_${targetUserId}`;
        profileCache.delete(cacheKey);
        
    } catch (error) {
        console.error('Error unfollowing user:', error);
        throw error;
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

function showNotification(message, type = 'info') {
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
            ${getIconSVG(icon)}
        </svg>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function getIconSVG(icon) {
    switch(icon) {
        case 'alert-circle':
            return '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>';
        case 'check-circle':
            return '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>';
        case 'alert-triangle':
            return '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>';
        case 'wifi':
            return '<path d="M5 12.55a11 11 0 0 1 14.08 0"></path><path d="M1.42 9a16 16 0 0 1 21.16 0"></path><path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path><line x1="12" y1="20" x2="12.01" y2="20"></line>';
        case 'wifi-off':
            return '<line x1="1" y1="1" x2="23" y2="23"></line><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"></path><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"></path><path d="M10.71 5.05A16 16 0 0 1 22.58 9"></path><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"></path><path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path><line x1="12" y1="20" x2="12.01" y2="20"></line>';
        default:
            return '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>';
    }
}

function showError(message, showRefresh = true) {
    const gamersListElement = document.getElementById('gamersList');
    if (gamersListElement) {
        gamersListElement.innerHTML = `
            <div class="empty-state">
                <svg class="feather" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <h3 class="empty-title">Error Loading Profiles</h3>
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
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
}

// Remove the clan modal from HTML if it exists
document.addEventListener('DOMContentLoaded', () => {
    const clanModal = document.getElementById('clanModal');
    if (clanModal) {
        clanModal.remove();
    }
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    if (cacheTimer) {
        clearInterval(cacheTimer);
    }
    if (networkCheckInterval) {
        clearInterval(networkCheckInterval);
    }
});

// Export functions for challenge.html
window.challengeSystem = {
    acceptChallenge,
    rejectChallenge,
    completeGame,
    showChallengeModal
};

console.log('Enhanced gamers.js loaded successfully with 100-item pagination, caching, and performance optimizations');