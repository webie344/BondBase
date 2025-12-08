// filter.js - Independent Gender Filter with Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    doc, 
    getDoc, 
    getDocs, 
    query, 
    where,
    updateDoc,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { 
    getAuth, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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
const db = getFirestore(app);
const auth = getAuth(app);

class GenderFilter {
    constructor() {
        this.filterPopup = null;
        this.selectedGender = null;
        this.filteredProfiles = [];
        this.isFilterActive = false;
        this.currentFilteredIndex = 0;
        this.currentUser = null;
        this.init();
    }

    async init() {
        await this.waitForAuth();
        this.createFilterPopup();
        this.setupEventListeners();
        this.overrideViewProfileFunction();
    }

    waitForAuth() {
        return new Promise((resolve) => {
            onAuthStateChanged(auth, (user) => {
                if (user) {
                    this.currentUser = user;
                    resolve();
                } else {
                    resolve();
                }
            });
        });
    }

    createFilterPopup() {
        this.filterPopup = document.createElement('div');
        this.filterPopup.className = 'gender-filter-popup';
        this.filterPopup.style.display = 'none';
        this.filterPopup.innerHTML = `
            <div class="filter-popup-content">
                <div class="filter-header">
                    <h3>What are you looking for?</h3>
                    <button class="close-filter-popup">&times;</button>
                </div>
                <div class="gender-options">
                    <div class="gender-option" data-gender="male">
                        <div class="gender-icon">👨</div>
                        <span>Man</span>
                    </div>
                    <div class="gender-option" data-gender="female">
                        <div class="gender-icon">👩</div>
                        <span>Woman</span>
                    </div>
                    <div class="gender-option" data-gender="all">
                        <div class="gender-icon">👥</div>
                        <span>Everyone</span>
                    </div>
                </div>
                <div class="filter-actions">
                    <button class="cancel-filter-btn">Cancel</button>
                    <button class="apply-filter-btn" disabled>Search</button>
                </div>
            </div>
        `;

        document.body.appendChild(this.filterPopup);
        this.addPopupEventListeners();
    }

    addPopupEventListeners() {
        const closeBtn = this.filterPopup.querySelector('.close-filter-popup');
        const cancelBtn = this.filterPopup.querySelector('.cancel-filter-btn');
        const applyBtn = this.filterPopup.querySelector('.apply-filter-btn');
        const genderOptions = this.filterPopup.querySelectorAll('.gender-option');

        [closeBtn, cancelBtn].forEach(btn => {
            btn.addEventListener('click', () => {
                this.hidePopup();
            });
        });

        genderOptions.forEach(option => {
            option.addEventListener('click', () => {
                genderOptions.forEach(opt => opt.classList.remove('active'));
                option.classList.add('active');
                applyBtn.disabled = false;
                this.selectedGender = option.dataset.gender;
            });
        });

        applyBtn.addEventListener('click', () => {
            this.applyFilter();
            this.hidePopup();
        });

        this.filterPopup.addEventListener('click', (e) => {
            if (e.target === this.filterPopup) {
                this.hidePopup();
            }
        });
    }

    showPopup() {
        this.filterPopup.style.display = 'flex';
        
        const genderOptions = this.filterPopup.querySelectorAll('.gender-option');
        genderOptions.forEach(opt => opt.classList.remove('active'));
        this.filterPopup.querySelector('.apply-filter-btn').disabled = true;
        this.selectedGender = null;
    }

    hidePopup() {
        this.filterPopup.style.display = 'none';
    }

    async applyFilter() {
        if (!this.selectedGender) return;

        this.showNotification(`Searching for ${this.selectedGender} profiles...`);

        try {
            const allProfiles = await this.loadAllProfilesFromFirebase();
            
            let filteredProfiles = [];
            if (this.selectedGender === 'all') {
                filteredProfiles = allProfiles;
            } else {
                filteredProfiles = allProfiles.filter(profile => 
                    profile.gender && profile.gender.toLowerCase() === this.selectedGender.toLowerCase()
                );
            }

            // Shuffle the filtered profiles
            this.filteredProfiles = this.shuffleArray([...filteredProfiles]);

            if (this.filteredProfiles.length > 0) {
                this.isFilterActive = true;
                this.currentFilteredIndex = 0;
                this.updateSearchIconState(true);
                this.displayFilteredProfile(0);
                this.showNotification(`Found ${this.filteredProfiles.length} ${this.selectedGender} profiles `);
            } else {
                this.showNoProfilesMessage();
            }
        } catch (error) {
            console.error('Error applying filter:', error);
            this.showNotification('Error loading profiles. Please try again.');
        }
    }

    // Fisher-Yates shuffle algorithm
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    async loadAllProfilesFromFirebase() {
        try {
            if (!this.currentUser) {
                throw new Error('No user signed in');
            }

            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('__name__', '!=', this.currentUser.uid));
            const querySnapshot = await getDocs(q);
            
            const profiles = [];
            querySnapshot.forEach((doc) => {
                const userData = doc.data();
                if (userData.name && userData.gender) {
                    profiles.push({ 
                        id: doc.id, 
                        ...userData 
                    });
                }
            });

            // Shuffle the initial profiles too
            return this.shuffleArray(profiles);
        } catch (error) {
            console.error('Error loading profiles:', error);
            throw error;
        }
    }

    displayFilteredProfile(index) {
        if (index < 0 || index >= this.filteredProfiles.length) return;

        const profile = this.filteredProfiles[index];
        this.currentFilteredIndex = index;

        const profileImage = document.getElementById('currentProfileImage');
        const profileName = document.getElementById('profileName');
        const profileAgeLocation = document.getElementById('profileAgeLocation');
        const profileBio = document.getElementById('profileBio');
        const likeCount = document.getElementById('likeCount');
        const viewProfileBtn = document.getElementById('viewProfileBtn');

        if (profileImage) {
            profileImage.src = profile.profileImage || 'images/default-profile.jpg';
            profileImage.alt = profile.name || 'Profile';
        }
        if (profileName) profileName.textContent = profile.name || 'Unknown';
        
        let ageLocation = '';
        if (profile.age) ageLocation += `${profile.age} • `;
        if (profile.location) ageLocation += profile.location;
        if (profileAgeLocation) profileAgeLocation.textContent = ageLocation;
        
        if (profileBio) profileBio.textContent = profile.bio || 'No bio available';
        if (likeCount) likeCount.textContent = profile.likes || 0;

        // Update View Profile button to use filtered profile ID
        if (viewProfileBtn) {
            // Remove any existing click listeners
            const newViewProfileBtn = viewProfileBtn.cloneNode(true);
            viewProfileBtn.parentNode.replaceChild(newViewProfileBtn, viewProfileBtn);
            
            // Add new click listener with filtered profile ID
            newViewProfileBtn.addEventListener('click', () => {
                this.viewProfile(profile.id);
            });
        }

        this.updateButtonHandlers();
        
        // Update navigation buttons state
        this.updateNavigationButtons();
    }

    updateNavigationButtons() {
        const dislikeBtn = document.getElementById('dislikeBtn');
        const likeBtn = document.getElementById('likeBtn');
        
        // Enable/disable buttons based on current position
        if (dislikeBtn && likeBtn) {
            // Always enable buttons if there are more profiles
            if (this.currentFilteredIndex < this.filteredProfiles.length - 1) {
                dislikeBtn.style.opacity = '1';
                likeBtn.style.opacity = '1';
                dislikeBtn.style.pointerEvents = 'auto';
                likeBtn.style.pointerEvents = 'auto';
            } else {
                // Last profile - show end message
                this.showNotification('Last profile in this search');
            }
        }
    }

    updateButtonHandlers() {
        const dislikeBtn = document.getElementById('dislikeBtn');
        const likeBtn = document.getElementById('likeBtn');

        if (dislikeBtn) {
            const newDislikeBtn = dislikeBtn.cloneNode(true);
            dislikeBtn.parentNode.replaceChild(newDislikeBtn, dislikeBtn);
            
            newDislikeBtn.addEventListener('click', () => {
                this.nextFilteredProfile();
            });
        }

        if (likeBtn) {
            const newLikeBtn = likeBtn.cloneNode(true);
            likeBtn.parentNode.replaceChild(newLikeBtn, likeBtn);
            
            newLikeBtn.addEventListener('click', () => {
                this.handleLikeProfile();
            });
        }
    }

    nextFilteredProfile() {
        if (this.currentFilteredIndex < this.filteredProfiles.length - 1) {
            this.currentFilteredIndex++;
            this.displayFilteredProfile(this.currentFilteredIndex);
        } else {
            this.showEndOfResultsMessage();
        }
    }

    showEndOfResultsMessage() {
        this.showNotification('No more profiles in this search. Try a different filter!');
        
        // Optionally, you can reshuffle and start over
        setTimeout(() => {
            const reshuffle = confirm('You\'ve seen all profiles in this search. Would you like to reshuffle and start over?');
            if (reshuffle) {
                this.reshuffleProfiles();
            }
        }, 1000);
    }

    reshuffleProfiles() {
        if (this.filteredProfiles.length > 0) {
            this.filteredProfiles = this.shuffleArray([...this.filteredProfiles]);
            this.currentFilteredIndex = 0;
            this.displayFilteredProfile(0);
            this.showNotification('Profiles reshuffled! Starting over.');
        }
    }

    async handleLikeProfile() {
        const currentProfile = this.filteredProfiles[this.currentFilteredIndex];
        
        try {
            if (!this.currentUser) {
                throw new Error('No user signed in');
            }

            await addDoc(collection(db, 'users', this.currentUser.uid, 'liked'), {
                userId: currentProfile.id,
                timestamp: serverTimestamp()
            });
            
            const profileRef = doc(db, 'users', currentProfile.id);
            const profileSnap = await getDoc(profileRef);
            
            if (profileSnap.exists()) {
                const currentLikes = profileSnap.data().likes || 0;
                await updateDoc(profileRef, {
                    likes: currentLikes + 50
                });
            }
            
            this.showNotification('Profile liked!');
            
            setTimeout(() => {
                this.nextFilteredProfile();
            }, 500);
            
        } catch (error) {
            console.error('Error liking profile:', error);
            this.showNotification('Error liking profile');
        }
    }

    viewProfile(profileId) {
        // Store filter state for navigation
        sessionStorage.setItem('currentFilteredProfileId', profileId);
        sessionStorage.setItem('isFilterActive', this.isFilterActive.toString());
        sessionStorage.setItem('filteredProfiles', JSON.stringify(this.filteredProfiles));
        sessionStorage.setItem('currentFilteredIndex', this.currentFilteredIndex.toString());
        
        // Navigate to profile page with the correct filtered profile ID
        window.location.href = `profile.html?id=${profileId}`;
    }

    resetFilter() {
        this.isFilterActive = false;
        this.filteredProfiles = [];
        this.currentFilteredIndex = 0;
        this.updateSearchIconState(false);
        
        // Clear session storage
        sessionStorage.removeItem('isFilterActive');
        sessionStorage.removeItem('filteredProfiles');
        sessionStorage.removeItem('currentFilteredIndex');
        sessionStorage.removeItem('currentFilteredProfileId');
        
        this.showNotification('Filter reset - reloading all profiles');
        setTimeout(() => {
            window.location.reload();
        }, 1000);
    }

    showNoProfilesMessage() {
        const profileImage = document.getElementById('currentProfileImage');
        const profileName = document.getElementById('profileName');
        const profileAgeLocation = document.getElementById('profileAgeLocation');
        const profileBio = document.getElementById('profileBio');
        const likeCount = document.getElementById('likeCount');
        const viewProfileBtn = document.getElementById('viewProfileBtn');
        const dislikeBtn = document.getElementById('dislikeBtn');
        const likeBtn = document.getElementById('likeBtn');

        if (profileImage) {
            profileImage.src = 'images/default-profile.jpg';
            profileImage.alt = 'No profiles found';
        }
        if (profileName) profileName.textContent = 'No profiles found';
        if (profileAgeLocation) profileAgeLocation.textContent = 'Try changing your filter';
        if (profileBio) profileBio.textContent = `No ${this.selectedGender} profiles found`;
        if (likeCount) likeCount.textContent = '0';
        
        // Disable buttons when no profiles
        if (viewProfileBtn) {
            viewProfileBtn.style.opacity = '0.5';
            viewProfileBtn.style.pointerEvents = 'none';
        }
        if (dislikeBtn) {
            dislikeBtn.style.opacity = '0.5';
            dislikeBtn.style.pointerEvents = 'none';
        }
        if (likeBtn) {
            likeBtn.style.opacity = '0.5';
            likeBtn.style.pointerEvents = 'none';
        }
        
        this.showNotification(`No ${this.selectedGender} profiles found`);
    }

    updateSearchIconState(isActive) {
        const searchIcon = document.getElementById('searchFilterBtn');
        if (searchIcon) {
            if (isActive) {
                searchIcon.classList.add('active');
                searchIcon.innerHTML = '<i class="fas fa-filter"></i>';
                searchIcon.title = 'Filter active - Click to reset';
            } else {
                searchIcon.classList.remove('active');
                searchIcon.innerHTML = '<i class="fas fa-search"></i>';
                searchIcon.title = 'Search by gender';
            }
        }
    }

    showNotification(message) {
        // Remove existing notifications
        const existingNotifications = document.querySelectorAll('.filter-notification');
        existingNotifications.forEach(notification => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        });

        const notification = document.createElement('div');
        notification.className = 'filter-notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--accent-color);
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            z-index: 10001;
            font-size: 14px;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            animation: slideInRight 0.3s ease-out;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOutRight 0.3s ease-in';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }
        }, 3000);
    }

    setupEventListeners() {
        const searchIcon = document.getElementById('searchFilterBtn');
        if (searchIcon) {
            searchIcon.addEventListener('click', () => {
                if (this.isFilterActive) {
                    this.resetFilter();
                } else {
                    this.showPopup();
                }
            });
        }
    }

    // Override the global viewProfile function to use filtered profiles
    overrideViewProfileFunction() {
        // Store the original function if it exists
        const originalViewProfile = window.viewProfile;
        
        // Override the global viewProfile function
        window.viewProfile = (profileId) => {
            // If filter is active, use the current filtered profile ID
            if (this.isFilterActive && this.filteredProfiles.length > 0) {
                const currentProfile = this.filteredProfiles[this.currentFilteredIndex];
                if (currentProfile) {
                    profileId = currentProfile.id;
                }
            }
            
            // Navigate to profile page
            window.location.href = `profile.html?id=${profileId}`;
        };
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            window.genderFilter = new GenderFilter();
        }, 1000);
    });
} else {
    setTimeout(() => {
        window.genderFilter = new GenderFilter();
    }, 1000);
}

// CSS styles
const filterStyles = `
<style>
.gender-filter-popup {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    display: none;
    justify-content: center;
    align-items: center;
    z-index: 10000;
    backdrop-filter: blur(5px);
}

.filter-popup-content {
    background: var(--discord-darker, #2f3136);
    border-radius: 15px;
    padding: 25px;
    width: 90%;
    max-width: 400px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    border: 1px solid var(--discord-dark, #36393f);
}

.filter-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
}

.filter-header h3 {
    color: var(--text-dark);
    margin: 0;
    font-size: 1.3rem;
}

.close-filter-popup {
    background: none;
    border: none;
    color: var(--text-light);
    font-size: 24px;
    cursor: pointer;
    padding: 5px;
    border-radius: 50%;
    width: 35px;
    height: 35px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.close-filter-popup:hover {
    background: var(--discord-dark, #36393f);
}

.gender-options {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 15px;
    margin-bottom: 25px;
}

.gender-option {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 20px 15px;
    background: var(--discord-dark, #36393f);
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.3s ease;
    border: 2px solid transparent;
}

.gender-option:hover {
    background: var(--discord-darker, #2f3136);
    border-color: var(--accent-color);
}

.gender-option.active {
    background: var(--accent-color);
    border-color: var(--accent-color);
    transform: translateY(-2px);
}

.gender-icon {
    font-size: 2rem;
    margin-bottom: 8px;
}

.gender-option span {
    color: var(--text-dark);
    font-weight: 600;
    font-size: 0.9rem;
}

.gender-option.active span {
    color: white;
}

.filter-actions {
    display: flex;
    gap: 10px;
}

.filter-actions button {
    flex: 1;
    padding: 12px 20px;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.3s ease;
}

.cancel-filter-btn {
    background: var(--discord-dark, #36393f);
    color: var(--text-dark);
}

.cancel-filter-btn:hover {
    background: var(--discord-darker, #2f3136);
}

.apply-filter-btn {
    background: var(--accent-color);
    color: white;
}

.apply-filter-btn:disabled {
    background: var(--discord-dark, #36393f);
    color: var(--text-light);
    cursor: not-allowed;
    opacity: 0.6;
}

.apply-filter-btn:not(:disabled):hover {
    background: var(--accent-dark);
    transform: translateY(-1px);
}

.search-filter-icon {
    background: var(--accent-color);
    color: white;
    border: none;
    border-radius: 50%;
    width: 45px;
    height: 45px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.3s ease;
    font-size: 1.1rem;
    margin-right: 10px;
}

.search-filter-icon:hover {
    background: var(--accent-dark);
    transform: scale(1.05);
}

.search-filter-icon.active {
    background: #ff6b6b;
    animation: pulse 2s infinite;
}

@keyframes pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.1); }
    100% { transform: scale(1); }
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
        transform: translateX(0);
        opacity: 1;
    }
    to {
        transform: translateX(100%);
        opacity: 0;
    }
}

@media (max-width: 480px) {
    .filter-popup-content {
        width: 95%;
        padding: 20px;
    }
    
    .gender-options {
        grid-template-columns: 1fr;
        gap: 10px;
    }
    
    .gender-option {
        flex-direction: row;
        justify-content: flex-start;
        padding: 15px;
    }
    
    .gender-icon {
        margin-right: 15px;
        margin-bottom: 0;
        font-size: 1.5rem;
    }
}
</style>
`;

document.head.insertAdjacentHTML('beforeend', filterStyles);