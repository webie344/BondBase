// events.js - Universal button event handler with Firebase auth
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    updateDoc, 
    collection, 
    addDoc, 
    query, 
    where, 
    getDocs, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Use the same Firebase config from your app.js
const firebaseConfig = {
    apiKey: "AIzaSyC9uL_BX14Z6rRpgG4MT9Tca1opJl8EviQ",
    authDomain: "dating-connect.firebaseapp.com",
    projectId: "dating-connect",
    storageBucket: "dating-connect.appspot.com",
    messagingSenderId: "1062172180210",
    appId: "1:1062172180210:web:0c9b3c1578a5dbae58da6b"
};

class ButtonEventsManager {
    constructor() {
        this.initialized = false;
        this.eventListeners = new Map();
        this.currentUser = null;
        this.app = null;
        this.auth = null;
        this.db = null;
        this.init();
    }

    async init() {
        if (this.initialized) return;
        
        try {
            // Initialize Firebase
            this.app = initializeApp(firebaseConfig);
            this.auth = getAuth(this.app);
            this.db = getFirestore(this.app);
            
            // Wait for auth state
            await this.waitForAuth();
            
            // Setup event listeners
            this.setupAllEventListeners();
            
            this.initialized = true;
        } catch (error) {
            // If Firebase fails, still setup basic button handlers
            this.setupAllEventListeners();
        }
    }

    waitForAuth() {
        return new Promise((resolve) => {
            onAuthStateChanged(this.auth, (user) => {
                this.currentUser = user;
                resolve();
            });
            
            // Timeout after 3 seconds
            setTimeout(resolve, 3000);
        });
    }

    setupAllEventListeners() {
        this.setupProfileButtons();
        this.setupNavigationButtons();
        this.setupGlobalClickHandler();
    }

    setupProfileButtons() {
        const profileButtons = {
            'backToMingle': this.handleBackToMingle,
            'messageProfileBtn': this.handleMessageProfile,
            'likeProfileBtn': this.handleLikeProfile
        };

        Object.entries(profileButtons).forEach(([id, handler]) => {
            this.setupButton(id, handler.bind(this));
        });
    }

    setupNavigationButtons() {
        const navButtons = {
            'logoutBtn': this.handleLogout
        };

        Object.entries(navButtons).forEach(([id, handler]) => {
            this.setupButton(id, handler.bind(this));
        });
    }

    setupButton(buttonId, handler) {
        const button = document.getElementById(buttonId);
        if (!button) return;

        this.removeButtonListener(buttonId);

        const listener = (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            handler(e, button);
        };

        button.addEventListener('click', listener);
        this.eventListeners.set(buttonId, { button, listener });
    }

    removeButtonListener(buttonId) {
        const existing = this.eventListeners.get(buttonId);
        if (existing) {
            existing.button.removeEventListener('click', existing.listener);
            this.eventListeners.delete(buttonId);
        }
    }

    setupGlobalClickHandler() {
        document.addEventListener('click', (e) => {
            const button = e.target.closest('button');
            if (!button) return;

            const buttonId = button.id;
            if (!buttonId) return;

            switch(buttonId) {
                case 'backToMingle':
                    e.preventDefault();
                    e.stopPropagation();
                    this.handleBackToMingle(e, button);
                    break;
                case 'messageProfileBtn':
                    e.preventDefault();
                    e.stopPropagation();
                    this.handleMessageProfile(e, button);
                    break;
                case 'likeProfileBtn':
                    e.preventDefault();
                    e.stopPropagation();
                    this.handleLikeProfile(e, button);
                    break;
                case 'logoutBtn':
                    e.preventDefault();
                    e.stopPropagation();
                    this.handleLogout(e, button);
                    break;
            }
        }, true);
    }

    // Button Handlers
    handleBackToMingle(e, button) {
        window.location.href = 'mingle.html';
    }

    handleMessageProfile(e, button) {
        const urlParams = new URLSearchParams(window.location.search);
        const profileId = urlParams.get('id');
        
        if (profileId) {
            window.location.href = `chat.html?id=${profileId}`;
        } else {
            this.showNotification('Cannot message this profile', 'error');
        }
    }

    async handleLikeProfile(e, button) {
        const urlParams = new URLSearchParams(window.location.search);
        const profileId = urlParams.get('id');
        
        if (!profileId) {
            this.showNotification('Cannot like this profile', 'error');
            return;
        }

        // Use our own authenticated user
        if (!this.currentUser) {
            this.showNotification('Please log in to like profiles', 'error');
            return;
        }

        try {
            this.setButtonLoading(button, true);
            await this.handleLikeProfileFirebase(profileId, button);
        } catch (error) {
            this.showNotification('Error liking profile', 'error');
            this.setButtonLoading(button, false);
        }
    }

    async handleLikeProfileFirebase(profileId, button) {
        // Check if already liked
        const likedRef = collection(this.db, 'users', this.currentUser.uid, 'liked');
        const likedQuery = query(likedRef, where('userId', '==', profileId));
        const likedSnap = await getDocs(likedQuery);
        
        if (!likedSnap.empty) {
            this.showNotification('You already liked this profile!', 'info');
            this.setButtonLiked(button);
            return;
        }

        // Add to liked profiles
        await addDoc(collection(this.db, 'users', this.currentUser.uid, 'liked'), {
            userId: profileId,
            timestamp: serverTimestamp(),
            likedAt: new Date().toISOString()
        });
        
        // Increment like count for the profile
        const profileRef = doc(this.db, 'users', profileId);
        const profileSnap = await getDoc(profileRef);
        
        if (profileSnap.exists()) {
            const currentLikes = profileSnap.data().likes || 0;
            await updateDoc(profileRef, {
                likes: currentLikes + 1,
                updatedAt: serverTimestamp()
            });
            
            // Update the displayed like count
            const likeCountElement = document.getElementById('viewLikeCount');
            if (likeCountElement) {
                likeCountElement.textContent = currentLikes + 1;
            }
        }
        
        // Update button state
        this.setButtonLiked(button);
        this.showNotification('Profile liked successfully!', 'success');
    }

    async handleLogout(e, button) {
        try {
            await signOut(this.auth);
            window.location.href = 'login.html';
        } catch (error) {
            window.location.href = 'login.html';
        }
    }

    // Utility Methods
    setButtonLoading(button, isLoading) {
        if (isLoading) {
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
            button.disabled = true;
        } else {
            button.innerHTML = '<i class="fas fa-heart"></i> Like';
            button.disabled = false;
        }
    }

    setButtonLiked(button) {
        button.innerHTML = '<i class="fas fa-heart"></i> Liked';
        button.classList.add('liked');
        button.disabled = true;
    }

    showNotification(message, type = 'info') {
        if (typeof window.showNotification === 'function') {
            window.showNotification(message, type);
        } else {
            alert(message);
        }
    }

    destroy() {
        this.eventListeners.forEach(({ button, listener }, buttonId) => {
            button.removeEventListener('click', listener);
        });
        this.eventListeners.clear();
        this.initialized = false;
    }
}

// Initialize immediately
const buttonEventsManager = new ButtonEventsManager();

// Make globally available
window.buttonEventsManager = buttonEventsManager;

export default buttonEventsManager;