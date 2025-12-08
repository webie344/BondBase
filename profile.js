import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { app } from "./app.js";

// Initialize Firebase services
const auth = getAuth(app);
const db = getFirestore(app);

// Cloudinary configuration from app.js
const cloudinaryConfig = {
    cloudName: "ddtdqrh1b",
    uploadPreset: "profile-pictures",
    apiUrl: "https://api.cloudinary.com/v1_1"
};

// DOM elements
const profileImageUpload2 = document.getElementById('profileImageUpload2');
const accountProfileImage2 = document.getElementById('accountProfileImage2');
const removeProfileImage2 = document.getElementById('removeProfileImage2');
let currentUser = null;

// Initialize the profile page
document.addEventListener('DOMContentLoaded', async () => {
    currentUser = auth.currentUser;
    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }

    // Load existing second profile picture
    await loadSecondProfilePicture();

    // Set up event listeners
    profileImageUpload2.addEventListener('change', handleSecondProfileImageUpload);
    removeProfileImage2.addEventListener('click', removeSecondProfilePicture);
});

// Load second profile picture from Firestore
async function loadSecondProfilePicture() {
    try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
            const userData = userSnap.data();
            if (userData.profileImage2) {
                accountProfileImage2.src = userData.profileImage2;
            }
        }
    } catch (error) {
        console.error("Error loading second profile picture:", error);
    }
}

// Handle second profile image upload
async function handleSecondProfileImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
        // Show loading state
        const uploadButton = profileImageUpload2.previousElementSibling;
        const originalText = uploadButton.innerHTML;
        uploadButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading';
        uploadButton.disabled = true;

        // Upload to Cloudinary
        const imageUrl = await uploadImageToCloudinary(file);

        // Save to Firestore
        await updateSecondProfilePicture(imageUrl);

        // Reset button state
        uploadButton.innerHTML = originalText;
        uploadButton.disabled = false;
    } catch (error) {
        console.error("Error uploading second profile picture:", error);
        alert("Failed to upload picture. Please try again.");
        
        // Reset button state
        const uploadButton = profileImageUpload2.previousElementSibling;
        uploadButton.innerHTML = '<i class="fas fa-camera"></i> Change Photo';
        uploadButton.disabled = false;
    }
}

// Upload image to Cloudinary
async function uploadImageToCloudinary(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', cloudinaryConfig.uploadPreset);
    
    try {
        const response = await fetch(
            `${cloudinaryConfig.apiUrl}/${cloudinaryConfig.cloudName}/image/upload`,
            {
                method: 'POST',
                body: formData
            }
        );

        if (!response.ok) {
            throw new Error(`Cloudinary error: ${response.statusText}`);
        }

        const data = await response.json();
        return data.secure_url;
    } catch (error) {
        console.error("Error uploading to Cloudinary:", error);
        throw error;
    }
}

// Update second profile picture in Firestore
async function updateSecondProfilePicture(imageUrl) {
    try {
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
            profileImage2: imageUrl,
            updatedAt: new Date()
        });
        
        // Update the image display
        accountProfileImage2.src = imageUrl;
    } catch (error) {
        console.error("Error updating second profile picture:", error);
        throw error;
    }
}

// Remove second profile picture
async function removeSecondProfilePicture() {
    if (!confirm("Are you sure you want to remove your second profile picture?")) return;

    try {
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
            profileImage2: null,
            updatedAt: new Date()
        });
        
        // Reset to default image
        accountProfileImage2.src = 'images-default-profile.jpg';
        profileImageUpload2.value = '';
    } catch (error) {
        console.error("Error removing second profile picture:", error);
        alert("Failed to remove picture. Please try again.");
    }
}

