// flip.js - Handles profile card flipping animations for mingles page

// Firebase imports (if needed for profile data)
import { 
    getFirestore,
    collection,
    doc,
    getDoc,
    updateDoc,
    arrayUnion,
    arrayRemove,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Animation state variables
let isAnimating = false;
let currentProfileIndex = 0;
let profiles = [];
let currentUser = null;
let db = null;

// Initialize flip animations
export function initFlipAnimations(user, firestoreDb, profileData) {
    currentUser = user;
    db = firestoreDb;
    profiles = profileData;
    
    // Set up event listeners for action buttons
    setupFlipButtonListeners();
    
    console.log("Flip animations initialized with", profiles.length, "profiles");
}

// Set up event listeners for flip actions
function setupFlipButtonListeners() {
    const dislikeBtn = document.getElementById('dislikeBtn');
    const likeBtn = document.getElementById('likeBtn');
    const viewProfileBtn = document.getElementById('viewProfileBtn');
    const chatBtn = document.getElementById('chatBtn');

    if (dislikeBtn) {
        dislikeBtn.addEventListener('click', () => {
            if (!isAnimating) {
                flipProfile('dislike');
            }
        });
    }

    if (likeBtn) {
        likeBtn.addEventListener('click', () => {
            if (!isAnimating) {
                flipProfile('like');
            }
        });
    }

    // These buttons don't trigger flips but should be disabled during animation
    if (viewProfileBtn) {
        viewProfileBtn.addEventListener('click', () => {
            if (isAnimating) return;
            const currentProfile = profiles[currentProfileIndex];
            if (currentProfile) {
                window.location.href = `profile.html?id=${currentProfile.id}`;
            }
        });
    }

    if (chatBtn) {
        chatBtn.addEventListener('click', () => {
            if (isAnimating) return;
            const currentProfile = profiles[currentProfileIndex];
            if (currentProfile) {
                window.location.href = `chat.html?id=${currentProfile.id}`;
            }
        });
    }
}

// Main flip function
async function flipProfile(action) {
    if (isAnimating || currentProfileIndex >= profiles.length) return;
    
    isAnimating = true;
    const profileCard = document.querySelector('.profile-card');
    const currentProfile = profiles[currentProfileIndex];
    
    // Disable all action buttons during animation
    disableActionButtons(true);
    
    // Add appropriate animation class based on action
    if (action === 'dislike') {
        profileCard.classList.add('flipping-out');
    } else {
        profileCard.classList.add('flipping');
        
        // Handle like action - save to Firebase
        try {
            await addDoc(collection(db, 'users', currentUser.uid, 'liked'), {
                userId: currentProfile.id,
                timestamp: serverTimestamp()
            });
            
            // Increment like count for the profile
            const profileRef = doc(db, 'users', currentProfile.id);
            const profileSnap = await getDoc(profileRef);
            if (profileSnap.exists()) {
                const currentLikes = profileSnap.data().likes || 0;
                await updateDoc(profileRef, {
                    likes: currentLikes + 1
                });
            }
        } catch (error) {
            console.error("Error liking profile:", error);
        }
    }
    
    // Wait for flip animation to complete
    setTimeout(() => {
        // Move to next profile
        currentProfileIndex++;
        
        if (currentProfileIndex < profiles.length) {
            // Update profile content
            updateProfileContent(profiles[currentProfileIndex]);
            
            // Reverse the flip animation to show new profile
            setTimeout(() => {
                if (action === 'dislike') {
                    profileCard.classList.remove('flipping-out');
                    profileCard.classList.add('flipping-in');
                } else {
                    profileCard.classList.remove('flipping');
                    profileCard.classList.add('flipping-back');
                }
                
                // Complete the animation
                setTimeout(() => {
                    profileCard.classList.remove('flipping-in', 'flipping-back');
                    isAnimating = false;
                    disableActionButtons(false);
                    
                    // Update UI with new profile data
                    showProfile(currentProfileIndex);
                }, 400);
            }, 100);
        } else {
            // No more profiles
            showNoProfilesMessage();
            profileCard.classList.remove('flipping', 'flipping-out');
            isAnimating = false;
            disableActionButtons(false);
        }
    }, 500);
}

// Update profile content during flip
function updateProfileContent(profile) {
    const profileImage = document.getElementById('currentProfileImage');
    const profileName = document.getElementById('profileName');
    const profileAgeLocation = document.getElementById('profileAgeLocation');
    const profileBio = document.getElementById('profileBio');
    const likeCount = document.getElementById('likeCount');
    
    // Create a subtle loading effect
    profileImage.style.opacity = '0.7';
    profileImage.style.filter = 'blur(2px)';
    
    // Update content
    setTimeout(() => {
        profileImage.src = profile.profileImage || 'images-default-profile.jpg';
        profileName.textContent = profile.name || 'Unknown';
        
        let ageLocation = '';
        if (profile.age) ageLocation += `${profile.age} • `;
        if (profile.location) ageLocation += profile.location;
        profileAgeLocation.textContent = ageLocation;
        
        profileBio.textContent = profile.bio || 'No bio available';
        likeCount.textContent = profile.likes || 0;
        
        // Remove loading effect
        setTimeout(() => {
            profileImage.style.opacity = '1';
            profileImage.style.filter = 'blur(0)';
        }, 200);
    }, 300);
}

// Show profile function
function showProfile(index) {
    if (index >= 0 && index < profiles.length) {
        const profile = profiles[index];
        
        document.getElementById('currentProfileImage').src = profile.profileImage || 'images-default-profile.jpg';
        document.getElementById('profileName').textContent = profile.name || 'Unknown';
        
        let ageLocation = '';
        if (profile.age) ageLocation += `${profile.age} • `;
        if (profile.location) ageLocation += profile.location;
        document.getElementById('profileAgeLocation').textContent = ageLocation;
        
        document.getElementById('profileBio').textContent = profile.bio || 'No bio available';
        document.getElementById('likeCount').textContent = profile.likes || 0;
        
        // Update online status indicator
        updateProfileOnlineStatus(profile.id);
    }
}

// Update online status
function updateProfileOnlineStatus(userId) {
    const statusRef = doc(db, 'status', userId);
    
    onSnapshot(statusRef, (doc) => {
        const status = doc.data()?.state || 'offline';
        const statusIndicator = document.getElementById('profileStatusIndicator');
        
        if (statusIndicator) {
            statusIndicator.className = `online-status ${status}`;
        }
    });
}

// Show no profiles message
function showNoProfilesMessage() {
    document.getElementById('currentProfileImage').src = 'images/default-profile.jpg';
    document.getElementById('profileName').textContent = 'No profiles found';
    document.getElementById('profileAgeLocation').textContent = '';
    document.getElementById('profileBio').textContent = 'Check back later for new profiles';
    document.getElementById('likeCount').textContent = '0';
    
    // Hide action buttons when no profiles
    disableActionButtons(true);
}

// Enable/disable action buttons
function disableActionButtons(disabled) {
    const dislikeBtn = document.getElementById('dislikeBtn');
    const likeBtn = document.getElementById('likeBtn');
    const viewProfileBtn = document.getElementById('viewProfileBtn');
    const chatBtn = document.getElementById('chatBtn');
    
    [dislikeBtn, likeBtn, viewProfileBtn, chatBtn].forEach(btn => {
        if (btn) {
            btn.disabled = disabled;
            btn.style.opacity = disabled ? '0.5' : '1';
            btn.style.cursor = disabled ? 'not-allowed' : 'pointer';
        }
    });
}

// Manual profile navigation (if needed)
export function goToNextProfile() {
    if (!isAnimating) {
        flipProfile('dislike');
    }
}

export function goToPreviousProfile() {
    if (!isAnimating && currentProfileIndex > 0) {
        isAnimating = true;
        currentProfileIndex--;
        showProfile(currentProfileIndex);
        isAnimating = false;
    }
}

// Get current profile index
export function getCurrentProfileIndex() {
    return currentProfileIndex;
}

// Get total profiles count
export function getTotalProfilesCount() {
    return profiles.length;
}

// Check if animation is in progress
export function isAnimationInProgress() {
    return isAnimating;
}

// Force reset animation state (for error recovery)
export function resetAnimationState() {
    isAnimating = false;
    disableActionButtons(false);
}

