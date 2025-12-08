import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { app } from "./app.js";

// Initialize Firestore
const db = getFirestore(app);

// Load profile data when page loads
document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const profileId = urlParams.get('id');
    
    if (profileId) {
        await loadProfileData(profileId);
    } else {
        window.location.href = 'mingle.html';
    }
});

async function loadProfileData(profileId) {
    try {
        const profileRef = doc(db, 'users', profileId);
        const profileSnap = await getDoc(profileRef);
        
        if (profileSnap.exists()) {
            const profileData = profileSnap.data();
            
            // Update main profile info
            document.getElementById('mainProfileImage').src = profileData.profileImage || 'images-default-profile.jpg';
            document.getElementById('viewProfileName').textContent = profileData.name || 'Unknown';
            document.getElementById('viewProfileAge').textContent = profileData.age || '';
            document.getElementById('viewProfileLocation').textContent = profileData.location || '';
            document.getElementById('viewProfileBio').textContent = profileData.bio || 'No bio available';
            document.getElementById('viewLikeCount').textContent = profileData.likes || 0;
            
            // Update second profile picture if exists
            if (profileData.profileImage2) {
                document.getElementById('secondProfileImage').src = profileData.profileImage2;
                document.getElementById('secondProfileThumbnail').src = profileData.profileImage2;
            }
            
            // Update interests
            const interestsContainer = document.getElementById('interestsContainer');
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
    } catch (error) {
        console.error("Error loading profile data:", error);
        window.location.href = 'mingle.html';
    }
}

