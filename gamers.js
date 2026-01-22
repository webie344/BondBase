// gamers.js - Complete with Profile Page Integration
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
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyC8_PEsfTOr-gJ8P1MoXobOAfqwTVqEZWo",
    authDomain: "usa-dating-23bc3.firebaseapp.com",
    projectId: "usa-dating-23bc3",
    storageBucket: "usa-dating-23bc3.firebasestorage.app",
    messagingSenderId: "423286263327",
    appId: "1:423286263327:web:17f0caf843dc349c144f2a"
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
let currentFilter = 'all';

// Check if we're on profile page or gamers directory
const isProfilePage = window.location.pathname.includes('profile.html');
const isGamersPage = window.location.pathname.includes('gamers.html') || 
                     window.location.pathname.includes('mingle.html');

// Initialize based on page
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing... Current page:', window.location.pathname);
    
    if (isGamersPage) {
        initGamersDirectory();
    } else if (isProfilePage) {
        initProfilePage();
    } else {
        // For other pages, just initialize auth
        onAuthStateChanged(auth, (user) => {
            currentUser = user;
        });
    }
});

// ==================== GAMERS DIRECTORY FUNCTIONALITY ====================
async function initGamersDirectory() {
    try {
        // Initialize Feather Icons
        if (typeof feather !== 'undefined') {
            feather.replace();
        }
        
        // Set up auth state listener
        onAuthStateChanged(auth, async (user) => {
            console.log('Auth state changed:', user ? 'User logged in' : 'No user');
            currentUser = user;
            
            // Load profiles regardless of auth status
            await loadAllProfiles();
            setupEventListeners();
        }, (error) => {
            console.error('Auth error:', error);
            loadAllProfiles();
            setupEventListeners();
        });
        
    } catch (error) {
        console.error('Error initializing:', error);
        showError('Failed to initialize. Please refresh.', true);
    }
}

async function loadAllProfiles() {
    const gamersListElement = document.getElementById('gamersList');
    if (!gamersListElement) {
        console.error('Cannot find #gamersList element');
        return;
    }
    
    console.log('Loading profiles...');
    
    // Show loading state
    gamersListElement.innerHTML = '';
    for (let i = 0; i < 3; i++) {
        gamersListElement.appendChild(createLoadingProfileItem());
    }
    
    try {
        if (!db) {
            console.error('Firestore not initialized');
            showError('Database service unavailable', false);
            return;
        }
        
        // Get all users
        const usersRef = collection(db, 'users');
        console.log('Querying users collection...');
        
        const usersSnap = await getDocs(usersRef);
        console.log(`Found ${usersSnap.size} users`);
        
        allProfiles = [];
        const currentUserId = currentUser ? currentUser.uid : null;
        
        // Process all users in parallel
        const profilePromises = [];
        
        usersSnap.forEach((userDoc) => {
            const userId = userDoc.id;
            const userData = userDoc.data();
            
            // Skip current user if logged in
            if (currentUserId && userId === currentUserId) {
                console.log('Skipping current user:', userId);
                return;
            }
            
            // Create a promise for each profile
            profilePromises.push(processUserProfile(userId, userData));
        });
        
        // Wait for all profiles to be processed
        const profiles = await Promise.all(profilePromises);
        allProfiles = profiles.filter(profile => profile !== null);
        
        console.log(`Loaded ${allProfiles.length} profiles`);
        
        // Sort profiles: online first, then by name
        allProfiles.sort((a, b) => {
            if (a.isOnline && !b.isOnline) return -1;
            if (!a.isOnline && b.isOnline) return 1;
            return a.name.localeCompare(b.name);
        });
        
        // Render profiles
        renderProfilesList();
        
    } catch (error) {
        console.error('Error loading profiles:', error);
        showError(`Failed to load profiles: ${error.message}`, true);
    }
}

async function processUserProfile(userId, userData) {
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
            clanCount: 0, // Followers count
            isFollowing: false // Whether current user is following this user
        };
        
        // Get online status
        try {
            const statusRef = doc(db, 'status', userId);
            const statusSnap = await getDoc(statusRef);
            profile.isOnline = statusSnap.exists() && statusSnap.data().state === 'online';
        } catch (error) {
            console.log('Could not get status for user:', userId);
        }
        
        // Get gamer profile if exists
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
        
        // Get followers count (clan count)
        profile.clanCount = await getFollowersCount(userId);
        
        // Check if current user is following this user
        if (currentUser) {
            profile.isFollowing = await checkIfFollowing(userId, currentUser.uid);
        }
        
        return profile;
        
    } catch (error) {
        console.error('Error processing user profile:', userId, error);
        return null;
    }
}

async function getFollowersCount(userId) {
    try {
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            const userData = userSnap.data();
            
            // Use followers array if exists, otherwise use likes as fallback
            if (userData.followers && Array.isArray(userData.followers)) {
                return userData.followers.length;
            }
            
            // Fall back to likes count
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
        // Check if current user is in target user's followers list
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
    gamersListElement.innerHTML = '';
    
    // Apply current filter
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
    
    filteredProfiles.forEach(profile => {
        gamersListElement.appendChild(createProfileItem(profile));
    });
    
    // Update Feather Icons
    if (typeof feather !== 'undefined') {
        feather.replace();
    }
    
    console.log('Profiles rendered successfully');
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
    
    // Clan/Followers button - TikTok style
    const buttonText = profile.isFollowing ? 'Following' : 'Follow';
    const buttonClass = profile.isFollowing ? 'add-clan-btn added' : 'add-clan-btn';
    const followersCount = profile.clanCount || 0;
    
    div.innerHTML = `
        <img src="${profile.profileImage}" alt="${profile.name}" class="gamer-avatar" 
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
                ${attributes.slice(0, 3).map(attr => `
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
    
    // Click event for profile navigation
    div.addEventListener('click', (e) => {
        if (!e.target.closest('.add-clan-btn') && 
            !e.target.closest('.clan-section') &&
            !e.target.closest('.message-gamer-btn')) {
            window.location.href = `profile.html?id=${profile.id}`;
        }
    });
    
    // Follow/Unfollow button event
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
                    // Unfollow
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
                    clanBtn.textContent = 'Follow';
                    
                    // Update followers count
                    const clanCountSpan = div.querySelector('.clan-count');
                    const currentCount = parseInt(clanCountSpan.textContent) || 0;
                    clanCountSpan.textContent = Math.max(0, currentCount - 1);
                    
                    showNotification(`Unfollowed ${profile.name}`, 'info');
                } else {
                    // Follow
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
                    clanBtn.textContent = 'Following';
                    
                    // Update followers count
                    const clanCountSpan = div.querySelector('.clan-count');
                    const currentCount = parseInt(clanCountSpan.textContent) || 0;
                    clanCountSpan.textContent = currentCount + 1;
                    
                    showNotification(`Now following ${profile.name}`, 'success');
                }
            } catch (error) {
                console.error('Error toggling follow:', error);
                showNotification('Failed to update follow status', 'error');
            }
        });
    }
    
    // Message button event
    const messageBtn = div.querySelector('.message-gamer-btn');
    if (messageBtn) {
        messageBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            
            if (!currentUser) {
                showNotification('Please log in to send messages', 'warning');
                window.location.href = 'login.html';
                return;
            }
            
            // Don't allow messaging yourself
            if (currentUser.uid === profile.id) {
                showNotification('You cannot message yourself', 'info');
                return;
            }
            
            // Redirect to chat page with this user's ID
            window.location.href = `chat.html?userId=${profile.id}`;
        });
    }
    
    return div;
}

// ==================== PROFILE PAGE FUNCTIONALITY ====================
async function initProfilePage() {
    try {
        // Initialize Feather Icons
        if (typeof feather !== 'undefined') {
            feather.replace();
        }
        
        // Get profile ID from URL
        const urlParams = new URLSearchParams(window.location.search);
        const profileId = urlParams.get('id');
        
        if (!profileId) {
            console.error('No profile ID in URL');
            showError('Profile not found', false);
            return;
        }
        
        console.log('Loading profile:', profileId);
        
        // Set up auth state listener
        onAuthStateChanged(auth, async (user) => {
            console.log('Auth state changed:', user ? 'User logged in' : 'No user');
            currentUser = user;
            
            // Load profile data
            await loadProfileData(profileId);
            setupProfileEventListeners(profileId);
        }, (error) => {
            console.error('Auth error:', error);
            loadProfileData(profileId);
            setupProfileEventListeners(profileId);
        });
        
    } catch (error) {
        console.error('Error initializing profile page:', error);
        showError('Failed to load profile. Please refresh.', true);
    }
}

async function loadProfileData(profileId) {
    try {
        if (!db) {
            console.error('Firestore not initialized');
            showError('Database service unavailable', false);
            return;
        }
        
        // Load user profile data
        const userRef = doc(db, 'users', profileId);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
            showError('Profile not found', false);
            return;
        }
        
        const userData = userSnap.data();
        
        // Update profile header
        updateProfileHeader(profileId, userData);
        
        // Update profile info
        updateProfileInfo(profileId, userData);
        
        // Update followers count
        await updateFollowersCount(profileId);
        
        // Check if current user is following this profile
        await updateFollowButton(profileId);
        
        // Load gamer profile if exists
        await loadGamerProfile(profileId);
        
    } catch (error) {
        console.error('Error loading profile data:', error);
        showError(`Failed to load profile: ${error.message}`, true);
    }
}

function updateProfileHeader(profileId, userData) {
    // Update profile name
    const profileNameElement = document.getElementById('viewProfileName');
    if (profileNameElement) {
        profileNameElement.textContent = userData.name || 'User';
    }
    
    // Update profile age and location
    const profileAgeElement = document.getElementById('viewProfileAge');
    const profileLocationElement = document.getElementById('viewProfileLocation');
    
    if (profileAgeElement) {
        profileAgeElement.textContent = userData.age ? `${userData.age} yrs` : 'No age specified';
    }
    
    if (profileLocationElement) {
        profileLocationElement.textContent = userData.location || 'Location unknown';
    }
    
    // Update profile image
    const profileImageElement = document.getElementById('mainProfileImage');
    if (profileImageElement && userData.profileImage) {
        profileImageElement.src = userData.profileImage;
    }
    
    // Update profile bio
    const profileBioElement = document.getElementById('viewProfileBio');
    if (profileBioElement) {
        profileBioElement.textContent = userData.bio || 'No bio available';
    }
    
    // Also update the second bio element
    const profileBioElement2 = document.getElementById('viewProfileBio2');
    if (profileBioElement2) {
        profileBioElement2.textContent = userData.bio || 'No bio available';
    }
    
    // Update online status
    updateOnlineStatus(profileId);
}

function updateProfileInfo(profileId, userData) {
    // Update email
    const emailElement = document.getElementById('viewProfileEmail');
    if (emailElement) {
        emailElement.textContent = userData.email || 'No email';
    }
    
    // Update workshop count
    const workshopCountElement = document.getElementById('viewWorkshopCount');
    const workshopCountElement2 = document.getElementById('viewWorkshopCount2');
    if (workshopCountElement) {
        workshopCountElement.textContent = userData.workshops || 0;
    }
    if (workshopCountElement2) {
        workshopCountElement2.textContent = userData.workshops || 0;
    }
    
    // Update certification count
    const certCountElement = document.getElementById('viewCertCount');
    const certCountElement2 = document.getElementById('viewCertCount2');
    if (certCountElement) {
        certCountElement.textContent = userData.certifications || 0;
    }
    if (certCountElement2) {
        certCountElement2.textContent = userData.certifications || 0;
    }
    
    // Update interests
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
        
        // Update followers count in profile stats
        const followersStat = document.getElementById('followersCount');
        if (followersStat) {
            followersStat.textContent = count;
        }
        
    } catch (error) {
        console.error('Error updating followers count:', error);
    }
}

async function updateFollowButton(profileId) {
    const followBtn = document.getElementById('likeProfileBtn');
    if (!followBtn) return;
    
    if (!currentUser) {
        // User not logged in
        followBtn.innerHTML = '<svg class="feather" data-feather="log-in"></svg> Login to Follow';
        followBtn.classList.remove('btn-message');
        followBtn.classList.add('btn-follow');
        return;
    }
    
    // Check if user is viewing their own profile
    if (currentUser.uid === profileId) {
        followBtn.style.display = 'none';
        return;
    }
    
    // Check if following
    const isFollowing = await checkIfFollowing(profileId, currentUser.uid);
    
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
            
            // Show gamer badge
            const gamerBadge = document.getElementById('gamerBadge');
            if (gamerBadge) {
                gamerBadge.style.display = 'inline-flex';
            }
            
            // Show gamer profile section
            const gamerSection = document.getElementById('gamerProfileSection');
            if (gamerSection) {
                gamerSection.style.display = 'block';
                
                // Populate gamer info
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
                
                // Populate gamer stats
                const gamerStatsGrid = document.getElementById('gamerStatsGrid');
                if (gamerStatsGrid) {
                    gamerStatsGrid.innerHTML = `
                        <div class="gamer-stat-card">
                            <div class="stat-value">${gamerProfile.wins || 0}</div>
                            <div class="stat-label">Wins</div>
                        </div>
                        <div class="gamer-stat-card">
                            <div class="stat-value">${gamerProfile.losses || 0}</div>
                            <div class="stat-label">Losses</div>
                        </div>
                        <div class="gamer-stat-card">
                            <div class="stat-value">${gamerProfile.kdRatio || '0.0'}</div>
                            <div class="stat-label">K/D Ratio</div>
                        </div>
                        <div class="gamer-stat-card">
                            <div class="stat-value">${gamerProfile.playHours || 0}</div>
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
            
            // Don't allow following yourself
            if (currentUser.uid === profileId) {
                showNotification('You cannot follow yourself', 'info');
                return;
            }
            
            const isCurrentlyFollowing = followBtn.dataset.following === 'true';
            
            try {
                if (isCurrentlyFollowing) {
                    // Unfollow
                    await unfollowUser(profileId);
                    followBtn.dataset.following = 'false';
                    followBtn.innerHTML = '<svg class="feather" data-feather="user-plus"></svg> Follow';
                    followBtn.classList.remove('btn-message');
                    followBtn.classList.add('btn-follow');
                    
                    // Update followers count
                    await updateFollowersCount(profileId);
                    
                    showNotification(`Unfollowed user`, 'info');
                } else {
                    // Follow
                    await followUser(profileId);
                    followBtn.dataset.following = 'true';
                    followBtn.innerHTML = '<svg class="feather" data-feather="user-check"></svg> Following';
                    followBtn.classList.remove('btn-follow');
                    followBtn.classList.add('btn-message');
                    
                    // Update followers count
                    await updateFollowersCount(profileId);
                    
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
    
    // Message button
    const messageBtn = document.getElementById('messageProfileBtn');
    if (messageBtn) {
        messageBtn.addEventListener('click', () => {
            if (!currentUser) {
                showNotification('Please log in to send messages', 'warning');
                window.location.href = 'login.html';
                return;
            }
            
            // Don't allow messaging yourself
            if (currentUser.uid === profileId) {
                showNotification('You cannot message yourself', 'info');
                return;
            }
            
            // Redirect to chat page with this user's ID
            window.location.href = `chat.html?userId=${profileId}`;
        });
    }
}

// ==================== CORE FOLLOW/UNFOLLOW FUNCTIONS ====================
async function followUser(targetUserId) {
    try {
        if (!currentUser) {
            throw new Error('User not logged in');
        }
        
        // Add current user to target user's followers
        const targetUserRef = doc(db, 'users', targetUserId);
        await updateDoc(targetUserRef, {
            followers: arrayUnion(currentUser.uid),
            updatedAt: serverTimestamp()
        });
        
        // Add target user to current user's following
        const currentUserRef = doc(db, 'users', currentUser.uid);
        await updateDoc(currentUserRef, {
            following: arrayUnion(targetUserId),
            updatedAt: serverTimestamp()
        });
        
        // Also increase likes count
        await updateDoc(targetUserRef, {
            likes: arrayUnion(currentUser.uid)
        });
        
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
        
        // Remove current user from target user's followers
        const targetUserRef = doc(db, 'users', targetUserId);
        await updateDoc(targetUserRef, {
            followers: arrayRemove(currentUser.uid),
            updatedAt: serverTimestamp()
        });
        
        // Remove target user from current user's following
        const currentUserRef = doc(db, 'users', currentUser.uid);
        await updateDoc(currentUserRef, {
            following: arrayRemove(targetUserId),
            updatedAt: serverTimestamp()
        });
        
        // Also remove like
        await updateDoc(targetUserRef, {
            likes: arrayRemove(currentUser.uid)
        });
        
    } catch (error) {
        console.error('Error unfollowing user:', error);
        throw error;
    }
}

// ==================== UTILITY FUNCTIONS ====================
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
                renderProfilesList();
            }
        }, 300));
    }
    
    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            currentFilter = button.dataset.filter;
            renderProfilesList();
        });
    });
    
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
function showNotification(message, type = 'info') {
    // Remove existing notifications
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
    }, 3000);
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

// Remove the clan modal from HTML if it exists
document.addEventListener('DOMContentLoaded', () => {
    const clanModal = document.getElementById('clanModal');
    if (clanModal) {
        clanModal.remove();
    }
});

console.log('gamers.js loaded successfully - Profile integration ready');