// games.js - Complete Gamer Profile Management System
// Firebase configuration
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    setDoc, 
    getDoc, 
    updateDoc,
    collection,
    query,
    where,
    getDocs,
    serverTimestamp,
    addDoc,
    deleteDoc
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
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Cloudinary configuration
const cloudinaryConfig = {
    cloudName: "ddtdqrh1b",
    uploadPreset: "profile-pictures",
    apiUrl: "https://api.cloudinary.com/v1_1"
};

// Global variables
let currentUser = null;
let currentProfileId = null;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initGamerSystem();
});

async function initGamerSystem() {
    try {
        console.log('Initializing gamer system...');
        
        // Set up auth state listener
        onAuthStateChanged(auth, (user) => {
            if (user) {
                currentUser = user;
                console.log('User authenticated:', user.uid);
                
                // Get current profile ID from URL (for profile.html)
                const urlParams = new URLSearchParams(window.location.search);
                currentProfileId = urlParams.get('id');
                
                // Check which page we're on
                const currentPage = window.location.pathname.split('/').pop().split('.')[0];
                
                console.log('Initializing on page:', currentPage);
                
                switch(currentPage) {
                    case 'account':
                        initAccountPageGamerProfile();
                        break;
                    case 'profile':
                        initProfilePageGamerDisplay();
                        break;
                    case 'gamersprofile':
                        initGamersProfilePage();
                        break;
                    default:
                        console.log('Gamer system not needed on this page');
                }
            } else {
                currentUser = null;
                console.log('No user logged in');
                
                // For gamersprofile page, we still need to load public profile
                const currentPage = window.location.pathname.split('/').pop().split('.')[0];
                if (currentPage === 'gamersprofile') {
                    initGamersProfilePage();
                }
            }
        });
        
    } catch (error) {
        console.error('Error initializing gamer system:', error);
    }
}

// ========== ACCOUNT PAGE FUNCTIONS ==========
async function initAccountPageGamerProfile() {
    if (!db) {
        setTimeout(initAccountPageGamerProfile, 500);
        return;
    }
    
    // Wait for user to be loaded
    if (!currentUser) {
        setTimeout(initAccountPageGamerProfile, 500);
        return;
    }
    
    console.log('Initializing account page for user:', currentUser.uid);
    
    // Wait for DOM to be ready
    setTimeout(async () => {
        try {
            // Setup event listeners
            setupAccountPageListeners();
            
            // Load existing gamer profile
            await loadGamerProfile(currentUser.uid);
            
            console.log('Account page gamer profile initialized');
            
        } catch (error) {
            console.error('Error initializing account page:', error);
        }
    }, 1000);
}

function setupAccountPageListeners() {
    const gamerProfileForm = document.getElementById('gamerProfileForm');
    const generateProfileBtn = document.getElementById('generateProfileBtn');
    const copyProfileLinkBtn = document.getElementById('copyProfileLinkBtn');
    const editGamerProfileBtn = document.getElementById('editGamerProfileBtn');
    const screenshotInput = document.getElementById('gamerScreenshot');
    const removeScreenshotBtn = document.getElementById('removeScreenshot');
    
    if (gamerProfileForm) {
        gamerProfileForm.addEventListener('submit', handleGamerProfileSubmit);
    }
    
    if (generateProfileBtn) {
        generateProfileBtn.addEventListener('click', generatePublicProfile);
    }
    
    if (copyProfileLinkBtn) {
        copyProfileLinkBtn.addEventListener('click', copyProfileLink);
    }
    
    if (editGamerProfileBtn) {
        editGamerProfileBtn.addEventListener('click', editGamerProfile);
    }
    
    if (screenshotInput) {
        screenshotInput.addEventListener('change', handleScreenshotUpload);
    }
    
    if (removeScreenshotBtn) {
        removeScreenshotBtn.addEventListener('click', removeScreenshot);
    }
}

async function loadGamerProfile(userId) {
    try {
        console.log('Loading gamer profile for user:', userId);
        
        const gamerProfileRef = collection(db, 'users', userId, 'gamerProfile');
        const gamerProfileQuery = query(gamerProfileRef);
        const gamerProfileSnap = await getDocs(gamerProfileQuery);
        
        if (!gamerProfileSnap.empty) {
            const profileData = gamerProfileSnap.docs[0].data();
            console.log('Found existing gamer profile:', profileData.gamerTag);
            
            // Display current profile
            displayCurrentProfile(profileData);
            
            // Populate form for editing
            populateForm(profileData);
            
            // Show generate profile section
            const generateProfileSection = document.getElementById('generateProfileSection');
            if (generateProfileSection) {
                generateProfileSection.style.display = 'block';
            }
            
            // Show profile link if exists
            if (profileData.publicProfileId) {
                displayProfileLink(userId, profileData.publicProfileId);
            }
        } else {
            console.log('No gamer profile found, showing form');
            
            // No profile exists, show form
            const gamerProfileFormContainer = document.getElementById('gamerProfileFormContainer');
            const currentGamerProfile = document.getElementById('currentGamerProfile');
            
            if (gamerProfileFormContainer) {
                gamerProfileFormContainer.style.display = 'block';
            }
            if (currentGamerProfile) {
                currentGamerProfile.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Error loading gamer profile:', error);
        showNotification('Error loading profile', 'error');
    }
}

function displayCurrentProfile(profileData) {
    const gamerProfilePreview = document.getElementById('gamerProfilePreview');
    const currentGamerProfile = document.getElementById('currentGamerProfile');
    
    if (!gamerProfilePreview || !currentGamerProfile) return;
    
    let html = `
        <div class="profile-info">
            <div style="margin-bottom: 1rem;">
                <strong>Gamer Tag:</strong> ${profileData.gamerTag || 'Not set'}
            </div>
            <div style="margin-bottom: 1rem;">
                <strong>Primary Game:</strong> ${profileData.primaryGame || 'Not set'}
            </div>
            <div style="margin-bottom: 1rem;">
                <strong>Platform:</strong> ${profileData.platform || 'Not set'}
            </div>
            
            <div class="gamer-stats-grid">
    `;
    
    // Add stats if available
    const stats = [
        { label: 'Rank', value: profileData.rank, icon: 'fa-trophy' },
        { label: 'Level', value: profileData.level, icon: 'fa-level-up-alt' },
        { label: 'K/D Ratio', value: profileData.kdRatio, icon: 'fa-crosshairs' },
        { label: 'Win Rate', value: profileData.winRate ? `${profileData.winRate}%` : null, icon: 'fa-chart-line' },
        { label: 'Total Kills', value: profileData.totalKills, icon: 'fa-skull' },
        { label: 'Hours Played', value: profileData.hoursPlayed, icon: 'fa-clock' }
    ];
    
    stats.forEach(stat => {
        if (stat.value) {
            html += `
                <div class="stat-card">
                    <div class="stat-value">${stat.value}</div>
                    <div class="stat-label">${stat.label}</div>
                </div>
            `;
        }
    });
    
    html += `
            </div>
            
            <div style="margin-top: 1rem;">
                <strong>Play Style:</strong> ${profileData.playStyle || 'Not specified'}
            </div>
        </div>
    `;
    
    gamerProfilePreview.innerHTML = html;
    currentGamerProfile.style.display = 'block';
    
    const gamerProfileFormContainer = document.getElementById('gamerProfileFormContainer');
    if (gamerProfileFormContainer) {
        gamerProfileFormContainer.style.display = 'none';
    }
}

function populateForm(profileData) {
    const gamerProfileForm = document.getElementById('gamerProfileForm');
    if (!gamerProfileForm) return;
    
    // Populate form fields
    const fields = {
        'gamerTag': profileData.gamerTag || '',
        'primaryGame': profileData.primaryGame || '',
        'platform': profileData.platform || '',
        'rank': profileData.rank || '',
        'level': profileData.level || '',
        'kdRatio': profileData.kdRatio || '',
        'winRate': profileData.winRate || '',
        'totalKills': profileData.totalKills || '',
        'topKills': profileData.topKills || '',
        'playStyle': profileData.playStyle || '',
        'micPreference': profileData.micPreference || '',
        'achievements': profileData.achievements || '',
        'hoursPlayed': profileData.hoursPlayed || ''
    };
    
    Object.entries(fields).forEach(([fieldId, value]) => {
        const element = document.getElementById(fieldId);
        if (element) {
            element.value = value;
        }
    });
    
    // Checkboxes for "Looking For"
    const lookingFor = profileData.lookingFor || [];
    const checkboxIds = ['lookingTeammates', 'lookingRanked', 'lookingCasual', 'lookingTournament', 'lookingFriends'];
    
    checkboxIds.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            const value = id.replace('looking', '').toLowerCase();
            element.checked = lookingFor.includes(value);
        }
    });
    
    // Screenshot
    if (profileData.screenshotUrl) {
        const screenshotPreview = document.getElementById('screenshotPreview');
        const screenshotPreviewContainer = document.getElementById('screenshotPreviewContainer');
        if (screenshotPreview && screenshotPreviewContainer) {
            screenshotPreview.src = profileData.screenshotUrl;
            screenshotPreviewContainer.style.display = 'block';
        }
    }
}

function editGamerProfile() {
    const gamerProfileFormContainer = document.getElementById('gamerProfileFormContainer');
    const currentGamerProfile = document.getElementById('currentGamerProfile');
    
    if (gamerProfileFormContainer) {
        gamerProfileFormContainer.style.display = 'block';
    }
    if (currentGamerProfile) {
        currentGamerProfile.style.display = 'none';
    }
}

async function handleGamerProfileSubmit(e) {
    e.preventDefault();
    
    try {
        // Get form values
        const gamerProfileData = {
            gamerTag: document.getElementById('gamerTag').value.trim(),
            primaryGame: document.getElementById('primaryGame').value,
            platform: document.getElementById('platform').value,
            rank: document.getElementById('rank').value.trim(),
            level: parseInt(document.getElementById('level').value) || null,
            kdRatio: parseFloat(document.getElementById('kdRatio').value) || null,
            winRate: parseInt(document.getElementById('winRate').value) || null,
            totalKills: parseInt(document.getElementById('totalKills').value) || null,
            topKills: parseInt(document.getElementById('topKills').value) || null,
            playStyle: document.getElementById('playStyle').value,
            micPreference: document.getElementById('micPreference').value,
            achievements: document.getElementById('achievements').value.trim(),
            hoursPlayed: parseInt(document.getElementById('hoursPlayed').value) || null,
            updatedAt: serverTimestamp()
        };
        
        // Get "Looking For" checkboxes
        const lookingFor = [];
        const checkboxIds = ['lookingTeammates', 'lookingRanked', 'lookingCasual', 'lookingTournament', 'lookingFriends'];
        
        checkboxIds.forEach(id => {
            const element = document.getElementById(id);
            if (element && element.checked) {
                const value = id.replace('looking', '').toLowerCase();
                lookingFor.push(value);
            }
        });
        
        gamerProfileData.lookingFor = lookingFor;
        
        // Handle screenshot upload
        const screenshotInput = document.getElementById('gamerScreenshot');
        if (screenshotInput && screenshotInput.files.length > 0) {
            const screenshotUrl = await uploadScreenshot(screenshotInput.files[0]);
            gamerProfileData.screenshotUrl = screenshotUrl;
        } else {
            // Check if we have existing screenshot
            const existingProfile = await getCurrentGamerProfile(currentUser.uid);
            if (existingProfile && existingProfile.screenshotUrl) {
                gamerProfileData.screenshotUrl = existingProfile.screenshotUrl;
            }
        }
        
        // Check if profile already exists
        const existingProfile = await getCurrentGamerProfile(currentUser.uid);
        
        if (existingProfile) {
            // Update existing profile
            const gamerProfileRef = collection(db, 'users', currentUser.uid, 'gamerProfile');
            const gamerProfileQuery = query(gamerProfileRef);
            const gamerProfileSnap = await getDocs(gamerProfileQuery);
            
            if (!gamerProfileSnap.empty) {
                const profileDoc = gamerProfileSnap.docs[0];
                await updateDoc(profileDoc.ref, gamerProfileData);
                showNotification('Gamer profile updated successfully!', 'success');
            }
        } else {
            // Create new profile
            gamerProfileData.createdAt = serverTimestamp();
            gamerProfileData.userId = currentUser.uid;
            
            await addDoc(collection(db, 'users', currentUser.uid, 'gamerProfile'), gamerProfileData);
            showNotification('Gamer profile created successfully!', 'success');
        }
        
        // Reload profile
        await loadGamerProfile(currentUser.uid);
        
    } catch (error) {
        console.error('Error saving gamer profile:', error);
        showNotification('Error saving profile: ' + error.message, 'error');
    }
}

async function getCurrentGamerProfile(userId) {
    try {
        const gamerProfileRef = collection(db, 'users', userId, 'gamerProfile');
        const gamerProfileQuery = query(gamerProfileRef);
        const gamerProfileSnap = await getDocs(gamerProfileQuery);
        
        if (!gamerProfileSnap.empty) {
            return {
                id: gamerProfileSnap.docs[0].id,
                ...gamerProfileSnap.docs[0].data()
            };
        }
        return null;
    } catch (error) {
        console.error('Error getting current profile:', error);
        return null;
    }
}

async function uploadScreenshot(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', cloudinaryConfig.uploadPreset);
    
    try {
        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`,
            {
                method: 'POST',
                body: formData
            }
        );
        
        if (!response.ok) {
            throw new Error(`Cloudinary upload failed: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data.secure_url;
    } catch (error) {
        console.error('Error uploading screenshot:', error);
        throw new Error('Failed to upload screenshot');
    }
}

function handleScreenshotUpload(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const screenshotPreview = document.getElementById('screenshotPreview');
            const screenshotPreviewContainer = document.getElementById('screenshotPreviewContainer');
            if (screenshotPreview && screenshotPreviewContainer) {
                screenshotPreview.src = e.target.result;
                screenshotPreviewContainer.style.display = 'block';
            }
        };
        reader.readAsDataURL(file);
    }
}

function removeScreenshot() {
    const screenshotPreview = document.getElementById('screenshotPreview');
    const screenshotPreviewContainer = document.getElementById('screenshotPreviewContainer');
    const screenshotInput = document.getElementById('gamerScreenshot');
    
    if (screenshotPreview) screenshotPreview.src = '';
    if (screenshotPreviewContainer) screenshotPreviewContainer.style.display = 'none';
    if (screenshotInput) screenshotInput.value = '';
}

async function generatePublicProfile() {
    try {
        // Get current profile
        const profile = await getCurrentGamerProfile(currentUser.uid);
        if (!profile) {
            showNotification('Please create a gamer profile first', 'warning');
            return;
        }
        
        // Generate unique profile ID
        const profileId = generateProfileId();
        
        // Save public profile ID
        const gamerProfileRef = collection(db, 'users', currentUser.uid, 'gamerProfile');
        const gamerProfileQuery = query(gamerProfileRef);
        const gamerProfileSnap = await getDocs(gamerProfileQuery);
        
        if (!gamerProfileSnap.empty) {
            const profileDoc = gamerProfileSnap.docs[0];
            await updateDoc(profileDoc.ref, {
                publicProfileId: profileId
            });
        }
        
        // Display profile link
        displayProfileLink(currentUser.uid, profileId);
        
        showNotification('Public profile generated successfully!', 'success');
        
    } catch (error) {
        console.error('Error generating public profile:', error);
        showNotification('Error generating profile: ' + error.message, 'error');
    }
}

function generateProfileId() {
    return 'gamer_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function displayProfileLink(userId, profileId) {
    const baseUrl = window.location.origin;
    const profileUrl = `${baseUrl}/gamersprofile.html?user=${userId}&profile=${profileId}`;
    
    const gamerProfileLink = document.getElementById('gamerProfileLink');
    if (gamerProfileLink) {
        gamerProfileLink.value = profileUrl;
    }
    
    const profileLinkContainer = document.getElementById('profileLinkContainer');
    if (profileLinkContainer) {
        profileLinkContainer.style.display = 'flex';
    }
    
    // Update link preview
    updateLinkPreview(profileUrl);
}

async function updateLinkPreview(profileUrl) {
    const linkPreview = document.getElementById('linkPreview');
    if (!linkPreview) return;
    
    const profile = await getCurrentGamerProfile(currentUser.uid);
    if (!profile) return;
    
    const previewContent = document.getElementById('linkPreviewContent');
    if (!previewContent) return;
    
    previewContent.innerHTML = `
        <img src="${profile.screenshotUrl || 'images-default-profile.jpg'}" class="link-preview-image" alt="Profile">
        <div class="link-preview-info">
            <h5>${profile.gamerTag || 'Gamer Profile'}</h5>
            <p>${profile.primaryGame || ''} ${profile.platform ? '• ' + profile.platform : ''}</p>
            <div class="stats-preview">
                ${profile.rank ? `<span class="stat-preview-item">${profile.rank}</span>` : ''}
                ${profile.kdRatio ? `<span class="stat-preview-item">K/D: ${profile.kdRatio}</span>` : ''}
                ${profile.winRate ? `<span class="stat-preview-item">Win: ${profile.winRate}%</span>` : ''}
            </div>
        </div>
    `;
    
    linkPreview.style.display = 'block';
}

function copyProfileLink() {
    const gamerProfileLink = document.getElementById('gamerProfileLink');
    if (!gamerProfileLink) return;
    
    gamerProfileLink.select();
    gamerProfileLink.setSelectionRange(0, 99999);
    
    try {
        navigator.clipboard.writeText(gamerProfileLink.value);
        showNotification('Profile link copied to clipboard!', 'success');
    } catch (err) {
        console.error('Failed to copy:', err);
        showNotification('Failed to copy link', 'error');
    }
}

// ========== PROFILE PAGE FUNCTIONS ==========
async function initProfilePageGamerDisplay() {
    if (!db) {
        setTimeout(initProfilePageGamerDisplay, 500);
        return;
    }
    
    console.log('Initializing profile page gamer display for profile ID:', currentProfileId);
    
    // Load gamer profile for the viewed profile
    await loadProfileGamerInfo(currentProfileId);
}

async function loadProfileGamerInfo(profileId) {
    if (!profileId) {
        console.log('No profile ID found in URL');
        return;
    }
    
    try {
        console.log('Loading gamer info for profile:', profileId);
        
        const gamerProfileRef = collection(db, 'users', profileId, 'gamerProfile');
        const gamerProfileQuery = query(gamerProfileRef);
        const gamerProfileSnap = await getDocs(gamerProfileQuery);
        
        if (!gamerProfileSnap.empty) {
            const profileData = gamerProfileSnap.docs[0].data();
            
            console.log('Found gamer profile:', profileData.gamerTag);
            
            // Show gamer badge
            const gamerBadge = document.getElementById('gamerBadge');
            if (gamerBadge) {
                gamerBadge.style.display = 'inline-flex';
            }
            
            // Show gamer profile section
            const gamerProfileSection = document.getElementById('gamerProfileSection');
            if (gamerProfileSection) {
                gamerProfileSection.style.display = 'block';
                
                // Update basic info
                const gamerBasicInfo = document.getElementById('gamerBasicInfo');
                if (gamerBasicInfo) {
                    let basicInfoHTML = '';
                    
                    if (profileData.primaryGame) {
                        basicInfoHTML += `
                            <div class="gamer-info-row">
                                <i class="fas fa-gamepad"></i>
                                <span><strong>Game:</strong> ${profileData.primaryGame}</span>
                            </div>
                        `;
                    }
                    
                    if (profileData.platform) {
                        basicInfoHTML += `
                            <div class="gamer-info-row">
                                <i class="fas fa-tv"></i>
                                <span><strong>Platform:</strong> ${profileData.platform}</span>
                            </div>
                        `;
                    }
                    
                    if (profileData.playStyle) {
                        basicInfoHTML += `
                            <div class="gamer-info-row">
                                <i class="fas fa-users"></i>
                                <span><strong>Play Style:</strong> ${profileData.playStyle}</span>
                            </div>
                        `;
                    }
                    
                    gamerBasicInfo.innerHTML = basicInfoHTML;
                }
                
                // Update stats grid
                const gamerStatsGrid = document.getElementById('gamerStatsGrid');
                if (gamerStatsGrid) {
                    let statsHTML = '';
                    
                    const stats = [
                        { label: 'Rank', value: profileData.rank, icon: 'fa-trophy' },
                        { label: 'Level', value: profileData.level, icon: 'fa-level-up-alt' },
                        { label: 'K/D', value: profileData.kdRatio, icon: 'fa-crosshairs' },
                        { label: 'Win Rate', value: profileData.winRate ? `${profileData.winRate}%` : null, icon: 'fa-chart-line' },
                        { label: 'Total Kills', value: profileData.totalKills, icon: 'fa-skull' },
                        { label: 'Hours', value: profileData.hoursPlayed, icon: 'fa-clock' }
                    ];
                    
                    stats.forEach(stat => {
                        if (stat.value) {
                            statsHTML += `
                                <div class="gamer-stat-card">
                                    <div class="stat-value">${stat.value}</div>
                                    <div class="stat-label">${stat.label}</div>
                                </div>
                            `;
                        }
                    });
                    
                    gamerStatsGrid.innerHTML = statsHTML;
                }
                
                // Show screenshot if available
                if (profileData.screenshotUrl) {
                    const gamerScreenshotContainer = document.getElementById('gamerScreenshotContainer');
                    const gamerScreenshot = document.getElementById('gamerScreenshot');
                    
                    if (gamerScreenshotContainer && gamerScreenshot) {
                        gamerScreenshot.src = profileData.screenshotUrl;
                        gamerScreenshotContainer.style.display = 'block';
                        
                        // Add click to open full screen
                        gamerScreenshot.addEventListener('click', () => {
                            openImageInFullScreen(profileData.screenshotUrl);
                        });
                    }
                }
                
                // Update view profile button
                const viewGamerProfileBtn = document.getElementById('viewGamerProfileBtn');
                if (viewGamerProfileBtn && profileData.publicProfileId) {
                    viewGamerProfileBtn.href = `gamersprofile.html?user=${profileId}&profile=${profileData.publicProfileId}`;
                } else if (viewGamerProfileBtn) {
                    viewGamerProfileBtn.style.display = 'none';
                }
            }
        } else {
            console.log('No gamer profile found for this user');
        }
    } catch (error) {
        console.error('Error loading profile gamer info:', error);
    }
}

// ========== GAMERSPROFILE PAGE FUNCTIONS ==========
async function initGamersProfilePage() {
    if (!db) {
        setTimeout(initGamersProfilePage, 500);
        return;
    }
    
    // Get URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('user');
    const profileId = urlParams.get('profile');
    
    console.log('Initializing gamers profile page for user:', userId, 'profile:', profileId);
    
    if (!userId) {
        showError('Invalid profile link - no user ID');
        return;
    }
    
    // Load the gamer profile
    await loadPublicGamerProfile(userId, profileId);
}

async function loadPublicGamerProfile(userId, profileId) {
    try {
        console.log('Loading public gamer profile for user:', userId);
        
        // Get user data
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (!userDoc.exists()) {
            showError('Profile not found');
            return;
        }
        
        const userData = userDoc.data();
        
        // Get gamer profile
        const gamerProfileRef = collection(db, 'users', userId, 'gamerProfile');
        const gamerProfileQuery = query(gamerProfileRef);
        const gamerProfileSnap = await getDocs(gamerProfileQuery);
        
        if (gamerProfileSnap.empty) {
            showError('Gamer profile not found');
            return;
        }
        
        const gamerProfileData = gamerProfileSnap.docs[0].data();
        
        console.log('Found gamer profile:', gamerProfileData.gamerTag);
        
        // Update UI
        updateGamersProfileUI(userData, gamerProfileData);
        
        // Setup contact button
        setupContactButton(userId);
        
    } catch (error) {
        console.error('Error loading public gamer profile:', error);
        showError('Error loading profile');
    }
}

function updateGamersProfileUI(userData, gamerProfileData) {
    // Profile Avatar
    const profileAvatar = document.getElementById('profileAvatar');
    if (profileAvatar) {
        profileAvatar.src = userData.profileImage || 'images-default-profile.jpg';
    }
    
    // Gamer Tag
    const gamerTagDisplay = document.getElementById('gamerTagDisplay');
    if (gamerTagDisplay) {
        gamerTagDisplay.textContent = gamerProfileData.gamerTag || userData.name || 'Unknown Gamer';
    }
    
    // Game Info
    const gameInfo = document.getElementById('gameInfo');
    if (gameInfo) {
        const gameInfoArr = [];
        if (gamerProfileData.primaryGame) gameInfoArr.push(gamerProfileData.primaryGame);
        if (gamerProfileData.platform) gameInfoArr.push(gamerProfileData.platform);
        gameInfo.textContent = gameInfoArr.join(' • ') || 'Not specified';
    }
    
    // Badges
    updateProfileBadges(gamerProfileData);
    
    // Quick Stats
    updateProfileQuickStats(gamerProfileData);
    
    // Detailed Stats
    updateProfileDetailedStats(gamerProfileData);
    
    // Preferences
    updateProfilePreferences(gamerProfileData);
    
    // Achievements
    updateProfileAchievements(gamerProfileData);
    
    // Screenshots
    updateProfileScreenshots(gamerProfileData);
    
    // Hide loading, show content
    const loadingState = document.getElementById('loadingState');
    const profileDetails = document.getElementById('profileDetails');
    if (loadingState) loadingState.style.display = 'none';
    if (profileDetails) profileDetails.style.display = 'block';
}

function updateProfileBadges(gamerProfileData) {
    const gamerBadges = document.getElementById('gamerBadges');
    if (!gamerBadges) return;
    
    gamerBadges.innerHTML = '';
    
    const badges = [];
    
    if (gamerProfileData.platform) {
        badges.push({
            text: gamerProfileData.platform,
            icon: 'fa-gamepad',
            class: 'platform-badge'
        });
    }
    
    if (gamerProfileData.playStyle) {
        badges.push({
            text: gamerProfileData.playStyle,
            icon: 'fa-users',
            class: 'style-badge'
        });
    }
    
    if (gamerProfileData.rank) {
        badges.push({
            text: gamerProfileData.rank,
            icon: 'fa-trophy',
            class: 'rank-badge'
        });
    }
    
    badges.forEach(badge => {
        const badgeElement = document.createElement('div');
        badgeElement.className = `gamer-badge ${badge.class}`;
        badgeElement.innerHTML = `
            <i class="fas ${badge.icon}"></i>
            <span>${badge.text}</span>
        `;
        gamerBadges.appendChild(badgeElement);
    });
}

function updateProfileQuickStats(gamerProfileData) {
    const quickStats = document.getElementById('quickStats');
    if (!quickStats) return;
    
    quickStats.innerHTML = '';
    
    const stats = [
        {
            label: 'Level',
            value: gamerProfileData.level || 'N/A',
            icon: 'fa-level-up-alt',
            color: '#e63986'
        },
        {
            label: 'Rank',
            value: gamerProfileData.rank || 'Unranked',
            icon: 'fa-chess-queen',
            color: '#FFD700'
        },
        {
            label: 'K/D',
            value: gamerProfileData.kdRatio || 'N/A',
            icon: 'fa-crosshairs',
            color: '#00ff88'
        },
        {
            label: 'Win Rate',
            value: gamerProfileData.winRate ? `${gamerProfileData.winRate}%` : 'N/A',
            icon: 'fa-chart-line',
            color: '#00a8ff'
        }
    ];
    
    stats.forEach(stat => {
        const statElement = document.createElement('div');
        statElement.className = 'stat-item';
        statElement.innerHTML = `
            <div class="stat-icon" style="color: ${stat.color};">
                <i class="fas ${stat.icon}"></i>
            </div>
            <div class="stat-content">
                <div class="stat-value">${stat.value}</div>
                <div class="stat-label">${stat.label}</div>
            </div>
        `;
        quickStats.appendChild(statElement);
    });
}

function updateProfileDetailedStats(gamerProfileData) {
    const detailedStats = document.getElementById('detailedStats');
    if (!detailedStats) return;
    
    detailedStats.innerHTML = '';
    
    const stats = [
        {
            label: 'Total Kills',
            value: gamerProfileData.totalKills || 0,
            max: 10000,
            icon: 'fa-skull'
        },
        {
            label: 'Top Kills',
            value: gamerProfileData.topKills || 0,
            max: 50,
            icon: 'fa-crown'
        },
        {
            label: 'Hours Played',
            value: gamerProfileData.hoursPlayed || 0,
            max: 2000,
            icon: 'fa-clock'
        },
        {
            label: 'Win Rate',
            value: gamerProfileData.winRate || 0,
            max: 100,
            icon: 'fa-chart-line'
        }
    ];
    
    stats.forEach(stat => {
        const statElement = document.createElement('div');
        statElement.className = 'stat-card';
        
        const percentage = stat.max > 0 ? Math.min((stat.value / stat.max) * 100, 100) : 0;
        
        statElement.innerHTML = `
            <div class="stat-card-header">
                <i class="fas ${stat.icon}"></i>
                <span>${stat.label}</span>
            </div>
            <div class="stat-card-content">
                <div class="value">${stat.value}</div>
                <div class="progress">
                    <div class="progress-bar" style="width: ${percentage}%"></div>
                </div>
            </div>
        `;
        detailedStats.appendChild(statElement);
    });
}

function updateProfilePreferences(gamerProfileData) {
    const preferencesInfo = document.getElementById('preferencesInfo');
    if (!preferencesInfo) return;
    
    preferencesInfo.innerHTML = '';
    
    if (!gamerProfileData) return;
    
    let preferencesHTML = '<div class="preferences-grid">';
    
    if (gamerProfileData.playStyle) {
        preferencesHTML += `
            <div class="preference-card">
                <div class="preference-icon">
                    <i class="fas fa-users"></i>
                </div>
                <div class="preference-content">
                    <div class="preference-label">Play Style</div>
                    <div class="preference-value">${gamerProfileData.playStyle}</div>
                </div>
            </div>
        `;
    }
    
    if (gamerProfileData.micPreference) {
        preferencesHTML += `
            <div class="preference-card">
                <div class="preference-icon">
                    <i class="fas fa-microphone"></i>
                </div>
                <div class="preference-content">
                    <div class="preference-label">Mic Preference</div>
                    <div class="preference-value">${gamerProfileData.micPreference}</div>
                </div>
            </div>
        `;
    }
    
    if (gamerProfileData.lookingFor && gamerProfileData.lookingFor.length > 0) {
        preferencesHTML += `
            <div class="preference-card">
                <div class="preference-icon">
                    <i class="fas fa-search"></i>
                </div>
                <div class="preference-content">
                    <div class="preference-label">Looking For</div>
                    <div class="preference-tags">
                        ${gamerProfileData.lookingFor.map(item => `
                            <span class="preference-tag">${item}</span>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }
    
    preferencesHTML += '</div>';
    preferencesInfo.innerHTML = preferencesHTML;
}

function updateProfileAchievements(gamerProfileData) {
    const achievementsInfo = document.getElementById('achievementsInfo');
    if (!achievementsInfo) return;
    
    if (!gamerProfileData?.achievements) {
        achievementsInfo.innerHTML = '<div class="empty-state">No achievements listed yet.</div>';
        return;
    }
    
    achievementsInfo.innerHTML = `
        <div class="achievements-grid">
            ${gamerProfileData.achievements.split('\n').filter(a => a.trim()).map((achievement, index) => `
                <div class="achievement-card">
                    <div class="achievement-icon">
                        <i class="fas fa-trophy"></i>
                    </div>
                    <div class="achievement-content">
                        <div class="achievement-text">${achievement.trim()}</div>
                        <div class="achievement-date">Achievement #${index + 1}</div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function updateProfileScreenshots(gamerProfileData) {
    const screenshotsInfo = document.getElementById('screenshotsInfo');
    if (!screenshotsInfo) return;
    
    if (!gamerProfileData?.screenshotUrl) {
        screenshotsInfo.innerHTML = '<div class="empty-state">No screenshots uploaded yet.</div>';
        return;
    }
    
    screenshotsInfo.innerHTML = `
        <div class="screenshot-grid">
            <div class="screenshot-item">
                <img src="${gamerProfileData.screenshotUrl}" alt="Game Screenshot" 
                     onclick="openImageInFullScreen('${gamerProfileData.screenshotUrl}')">
                <div class="screenshot-overlay">
                    <i class="fas fa-search-plus"></i>
                </div>
            </div>
        </div>
    `;
}

function setupContactButton(gamerId) {
    const contactBtn = document.getElementById('contactGamerBtn');
    if (!contactBtn) return;
    
    contactBtn.addEventListener('click', () => {
        if (currentUser && currentUser.uid === gamerId) {
            showNotification("You can't message yourself!", 'warning');
            return;
        }
        
        if (currentUser) {
            // Redirect to chat with this gamer
            window.location.href = `chat.html?id=${gamerId}`;
        } else {
            showNotification('Please log in to message this gamer', 'info');
            window.location.href = 'login.html';
        }
    });
}

function showError(message) {
    const errorState = document.getElementById('errorState');
    const loadingState = document.getElementById('loadingState');
    const profileDetails = document.getElementById('profileDetails');
    
    if (loadingState) loadingState.style.display = 'none';
    if (profileDetails) profileDetails.style.display = 'none';
    if (errorState) {
        errorState.style.display = 'block';
        errorState.innerHTML = `
            <i class="fas fa-exclamation-circle" style="font-size: 3rem; color: var(--secondary); margin-bottom: 1rem;"></i>
            <h3>Profile Not Found</h3>
            <p>${message}</p>
            <a href="mingle.html" class="back-btn" style="margin-top: 1rem;">
                <i class="fas fa-users"></i> Browse Other Gamers
            </a>
        `;
    }
}

// ========== UTILITY FUNCTIONS ==========
function openImageInFullScreen(imageUrl) {
    const modal = document.createElement('div');
    modal.className = 'image-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.95);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        animation: fadeIn 0.3s ease;
    `;
    
    modal.innerHTML = `
        <div class="modal-content">
            <img src="${imageUrl}" alt="Full Screen" class="modal-image">
            <button class="modal-close">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add modal styles
    const style = document.createElement('style');
    style.textContent = `
        .modal-content {
            position: relative;
            max-width: 90%;
            max-height: 90%;
        }
        .modal-image {
            max-width: 100%;
            max-height: 90vh;
            object-fit: contain;
            border-radius: 8px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.5);
        }
        .modal-close {
            position: absolute;
            top: -40px;
            right: -40px;
            background: rgba(255,255,255,0.1);
            border: none;
            color: white;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            font-size: 1.2rem;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            backdrop-filter: blur(10px);
            transition: all 0.3s ease;
        }
        .modal-close:hover {
            background: rgba(255,255,255,0.2);
            transform: scale(1.1);
        }
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
    `;
    document.head.appendChild(style);
    
    modal.querySelector('.modal-close').addEventListener('click', () => {
        modal.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => {
            if (modal.parentNode) {
                modal.parentNode.removeChild(modal);
            }
        }, 300);
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => {
                if (modal.parentNode) {
                    modal.parentNode.removeChild(modal);
                }
            }, 300);
        }
    });
}

function showNotification(message, type = 'info') {
    // Remove any existing notifications
    const existingNotifications = document.querySelectorAll('.custom-notification');
    existingNotifications.forEach(notification => notification.remove());
    
    const notification = document.createElement('div');
    notification.className = `custom-notification ${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'error' ? '#dc2626' : type === 'success' ? '#16a34a' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
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
    
    notification.innerHTML = `
        <i class="fas fa-${type === 'error' ? 'exclamation-circle' : type === 'success' ? 'check-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    // Add animation styles if not already added
    if (!document.getElementById('notification-animations')) {
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
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Make functions available globally
window.openImageInFullScreen = openImageInFullScreen;
window.showNotification = showNotification;