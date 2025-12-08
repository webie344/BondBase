// script.js for Account Page - Improved Version

import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

const firebaseConfig = {
    apiKey: "AIzaSyC9uL_BX14Z6rRpgG4MT9Tca1opJl8EviQ",
    authDomain: "dating-connect.firebaseapp.com",
    projectId: "dating-connect",
    storageBucket: "dating-connect.appspot.com",
    messagingSenderId: "1062172180210",
    appId: "1:1062172180210:web:0c9b3c1578a5dbae58da6b"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            await loadAccountData(user);
        } else {
            window.location.href = 'login.html';
        }
    });
});

async function loadAccountData(user) {
    try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            const userData = userSnap.data();
            
            // Display profile picture
            const profileImg = document.getElementById('accountProfileImage');
            profileImg.src = userData.profileImage || 'images-default-profile.jpg';

            // Populate form fields
            populateFormFields(userData);

            // Only disable forms if profile is complete
            if (userData.profileComplete) {
                disableFormFields();
                showViewOnlyMessage();
            } else {
                enableFormFields();
                setupFormSubmission(user.uid);
            }
        }
    } catch (error) {
        console.error('Error loading account data:', error);
    }
}

function populateFormFields(userData) {
    // Basic Info
    document.getElementById('accountName').value = userData.name || '';
    document.getElementById('accountAge').value = userData.age || '';
    document.getElementById('accountGender').value = userData.gender || '';
    document.getElementById('accountLocation').value = userData.location || '';
    document.getElementById('accountBio').value = userData.bio || '';
    document.getElementById('accountEmail').value = userData.email || '';
    document.getElementById('accountPhone').value = userData.phone || '';

    // Interests
    const interestsContainer = document.getElementById('accountInterestsContainer');
    interestsContainer.innerHTML = '';
    if (userData.interests) {
        userData.interests.forEach(interest => {
            const interestTag = document.createElement('span');
            interestTag.className = 'interest-tag';
            interestTag.textContent = interest;
            interestsContainer.appendChild(interestTag);
        });
    }

    // Privacy Settings
    if (userData.privacySettings) {
        document.getElementById('showAge').checked = userData.privacySettings.showAge !== false;
        document.getElementById('showLocation').checked = userData.privacySettings.showLocation !== false;
        document.getElementById('showOnlineStatus').checked = userData.privacySettings.showOnlineStatus !== false;
    }
}

function disableFormFields() {
    const formElements = document.querySelectorAll(
        '#profileForm input, #profileForm select, #profileForm textarea, ' +
        '#settingsForm input, #settingsForm select, #settingsForm textarea, ' +
        '#privacyForm input, #privacyForm select, #privacyForm textarea'
    );

    formElements.forEach(element => {
        element.disabled = false;
    });

    const buttons = document.querySelectorAll('.upload-button, .remove-button, #addInterestBtn');
    buttons.forEach(button => {
        button.disabled = false;
        button.style.opacity = '0.6';
        button.style.cursor = 'not-allowed';
    });
}

function enableFormFields() {
    const formElements = document.querySelectorAll(
        '#profileForm input, #profileForm select, #profileForm textarea, ' +
        '#settingsForm input, #settingsForm select, #settingsForm textarea, ' +
        '#privacyForm input, #privacyForm select, #privacyForm textarea'
    );

    formElements.forEach(element => {
        element.disabled = false;
    });

    const buttons = document.querySelectorAll('.upload-button, .remove-button, #addInterestBtn');
    buttons.forEach(button => {
        button.disabled = false;
        button.style.opacity = '1';
        button.style.cursor = 'pointer';
    });
}

function showViewOnlyMessage() {
    // Remove any existing messages first
    const existingMessages = document.querySelectorAll('.view-only-message');
    existingMessages.forEach(msg => msg.remove());

    const forms = document.querySelectorAll('.account-section form');
    forms.forEach(form => {
        const message = document.createElement('p');
        message.className = 'view-only-message';
        message.textContent = 'Profile complete. profile review will be carried out shortly .';
        message.style.marginTop = '10px';
        message.style.color = '#666';
        form.appendChild(message);
    });
}

function setupFormSubmission(userId) {
    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Collect form data
            const formData = {
                name: document.getElementById('accountName').value,
                age: parseInt(document.getElementById('accountAge').value),
                gender: document.getElementById('accountGender').value,
                location: document.getElementById('accountLocation').value,
                bio: document.getElementById('accountBio').value,
                phone: document.getElementById('accountPhone').value || null,
                interests: Array.from(document.querySelectorAll('.interest-tag')).map(tag => 
                    tag.textContent.replace(' ×', '')
                ),
                profileComplete: true
            };

            try {
                // Update user document
                await updateDoc(doc(db, 'users', userId), formData);
                alert('Profile saved successfully!');
                
                // After saving, disable the forms
                disableFormFields();
                showViewOnlyMessage();
            } catch (error) {
            }
        });
    }
}