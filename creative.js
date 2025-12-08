// creative.js - COMPLETELY STANDALONE - No app.js dependencies - BDSM THEME
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    updateDoc, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Your Firebase config
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

class CreativeManager {
    constructor() {
        this.currentUser = null;
this.BANNERS = [
    { id: 'single',      name: 'Bondage Lover',    class: 'banner-single',      icon: '⛓️' },
    { id: 'playboy',     name: 'Chastisement',     class: 'bplayboy',           icon: '⚡' },
    { id: 'serious',     name: 'Foot Worshipper',  class: 'banner-serious',     icon: '🦶' },
    { id: 'adventurous', name: 'Dominant',         class: 'banner-adventurous', icon: '🖤' },
    { id: 'romantic',    name: 'Submissive',       class: 'banner-romantic',    icon: '🎀' },
    { id: 'funny',       name: 'Roleplay Freak',   class: 'banner-funny',       icon: '🎭' },
    { id: 'ambitious',   name: 'Pain Enthusiast',  class: 'banner-ambitious',   icon: '🩸' },
    { id: 'chill',       name: 'Rope Bunny',       class: 'banner-chill',       icon: '🐇' },
    { id: 'mysterious',  name: 'Masked Fantasy',   class: 'banner-mysterious',  icon: '🎭‍' },
    { id: 'creative',    name: 'Kink Explorer',    class: 'banner-creative',    icon: '🔥' }
];
        
        this.init();
    }

    async init() {
        this.setupStyles();
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.setupAuthListener();
            });
        } else {
            this.setupAuthListener();
        }
    }

    setupAuthListener() {
        onAuthStateChanged(auth, (user) => {
            if (user) {
                this.currentUser = user;
                setTimeout(() => {
                    this.setupPageBasedOnPath();
                }, 100);
            }
        });
    }

    setupPageBasedOnPath() {
        const path = window.location.pathname.toLowerCase();
        
        if (path.includes('account')) {
            this.setupAccountPage();
        } else if (path.includes('profile')) {
            this.setupProfilePage();
        } else if (path.includes('mingle')) {
            this.setupMinglePage();
        }
    }

    setupStyles() {
        const styles = `
            .creative-banner-section {
                padding: 20px;
                background: rgba(26, 26, 26, 0.95);
                border-radius: 12px;
                margin: 20px 0;
                border: 1px solid rgba(46, 46, 46, 0.6);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
            }
            .creative-banner-section h3 {
                color: var(--text-primary);
                margin-bottom: 20px;
                font-size: 18px;
                font-weight: 600;
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .creative-banner-section h3 i {
                color: var(--primary-light);
            }
            .creative-banner-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 12px;
            }
            .creative-banner-item {
                background: rgba(255, 255, 255, 0.05);
                padding: 20px;
                border-radius: 8px;
                text-align: center;
                cursor: pointer;
                border: 2px solid transparent;
                color: var(--text-primary);
                font-weight: 600;
                transition: all 0.3s ease;
                font-size: 14px;
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                position: relative;
                overflow: hidden;
            }
            .creative-banner-item:hover {
                background: rgba(179, 0, 75, 0.2);
                transform: translateY(-2px);
                border-color: rgba(179, 0, 75, 0.3);
            }
            .creative-banner-item.selected {
                border-color: var(--primary);
                background: rgba(179, 0, 75, 0.3);
                box-shadow: 0 4px 20px rgba(179, 0, 75, 0.4);
            }
            .creative-profile-banner {
                color: white;
                padding: 25px;
                border-radius: 12px;
                text-align: center;
                margin: 20px 0;
                font-weight: bold;
                font-size: 20px;
                text-shadow: 1px 1px 3px rgba(0,0,0,0.7);
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.1);
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
            }
            .creative-additional-photos {
                margin: 25px 0;
                padding: 25px;
                background: rgba(26, 26, 26, 0.95);
                border-radius: 12px;
                border: 1px solid rgba(46, 46, 46, 0.6);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
            }
            .creative-additional-photos h3 {
                color: var(--text-primary);
                margin-bottom: 20px;
                font-size: 18px;
                font-weight: 600;
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .creative-additional-photos h3 i {
                color: var(--primary-light);
            }
            .creative-photo-upload {
                text-align: center;
                margin: 20px 0;
                padding: 20px;
                background: rgba(11, 11, 11, 0.6);
                border-radius: 12px;
                border: 1px solid rgba(46, 46, 46, 0.4);
            }
            .creative-additional-photo {
                width: 140px;
                height: 140px;
                object-fit: cover;
                border-radius: 12px;
                border: 3px solid var(--primary);
                margin: 15px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
                transition: all 0.3s ease;
            }
            .creative-additional-photo:hover {
                transform: scale(1.05);
                box-shadow: 0 6px 20px rgba(179, 0, 75, 0.4);
            }
            .creative-upload-btn {
                background: var(--primary);
                color: white;
                padding: 12px 20px;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                margin: 8px;
                transition: all 0.3s ease;
                font-size: 14px;
                font-weight: 600;
                display: inline-flex;
                align-items: center;
                gap: 8px;
                box-shadow: 0 2px 8px rgba(179, 0, 75, 0.3);
            }
            .creative-upload-btn:hover {
                background: var(--primary-dark);
                transform: translateY(-2px);
                box-shadow: 0 4px 15px rgba(179, 0, 75, 0.4);
            }
            .creative-remove-btn {
                background: rgba(139, 0, 0, 0.8);
                color: white;
                padding: 12px 20px;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                margin: 8px;
                transition: all 0.3s ease;
                font-size: 14px;
                font-weight: 600;
                display: inline-flex;
                align-items: center;
                gap: 8px;
                border: 1px solid rgba(139, 0, 0, 0.3);
            }
            .creative-remove-btn:hover {
                background: rgba(102, 0, 0, 0.9);
                transform: translateY(-2px);
            }
            .creative-file-input {
                display: none;
            }
            
            /* BDSM Theme Banner Gradients */
            .banner-single { 
                background: linear-gradient(135deg, rgba(179, 0, 75, 0.9) 0%, rgba(122, 0, 52, 0.8) 100%);
                border: 1px solid rgba(179, 0, 75, 0.3);
            }
            .bplayboy { 
                background: linear-gradient(135deg, rgba(179, 0, 75, 0.8) 0%, rgba(68, 68, 68, 0.9) 100%);
                border: 1px solid rgba(179, 0, 75, 0.3);
            }
            .banner-serious { 
                background: linear-gradient(135deg, rgba(179, 0, 75, 0.8) 0%, rgba(46, 46, 46, 0.9) 100%);
                border: 1px solid rgba(179, 0, 75, 0.3);
            }
            .banner-adventurous { 
                background: linear-gradient(135deg, rgba(179, 0, 75, 0.8) 0%, rgba(139, 0, 0, 0.9) 100%);
                border: 1px solid rgba(179, 0, 75, 0.3);
            }
            .banner-romantic { 
                background: linear-gradient(135deg, rgba(179, 0, 75, 0.6) 0%, rgba(122, 0, 52, 0.8) 100%);
                border: 1px solid rgba(179, 0, 75, 0.3);
                color: rgba(255, 255, 255, 0.9);
            }
            .banner-funny { 
                background: linear-gradient(135deg, rgba(179, 0, 75, 0.8) 0%, rgba(76, 29, 149, 0.8) 100%);
                border: 1px solid rgba(179, 0, 75, 0.3);
            }
            .banner-ambitious { 
                background: linear-gradient(135deg, rgba(179, 0, 75, 0.7) 0%, rgba(101, 67, 33, 0.8) 100%);
                border: 1px solid rgba(179, 0, 75, 0.3);
                color: rgba(255, 255, 255, 0.9);
            }
            .banner-chill { 
                background: linear-gradient(135deg, rgba(179, 0, 75, 0.7) 0%, rgba(43, 43, 43, 0.9) 100%);
                border: 1px solid rgba(179, 0, 75, 0.3);
            }
            .banner-mysterious { 
                background: linear-gradient(135deg, rgba(68, 68, 68, 0.9) 0%, rgba(179, 0, 75, 0.8) 100%);
                border: 1px solid rgba(179, 0, 75, 0.3);
            }
            .banner-creative { 
                background: linear-gradient(135deg, rgba(179, 0, 75, 0.7) 0%, rgba(30, 15, 60, 0.9) 100%);
                border: 1px solid rgba(179, 0, 75, 0.3);
                color: rgba(255, 255, 255, 0.9);
            }

            /* Animation for notifications */
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }

            /* Responsive design */
            @media (max-width: 768px) {
                .creative-banner-grid {
                    grid-template-columns: 1fr;
                }
                .creative-additional-photo {
                    width: 120px;
                    height: 120px;
                }
                .creative-banner-section,
                .creative-additional-photos {
                    padding: 15px;
                    margin: 15px 0;
                }
            }

            @media (max-width: 480px) {
                .creative-additional-photo {
                    width: 100px;
                    height: 100px;
                }
                .creative-upload-btn,
                .creative-remove-btn {
                    padding: 10px 16px;
                    font-size: 13px;
                }
            }
        `;
        
        const styleEl = document.createElement('style');
        styleEl.textContent = styles;
        document.head.appendChild(styleEl);
    }

    setupAccountPage() {
        this.addCreativeSections();
        this.loadUserCreativeData();
    }

    addCreativeSections() {
        // Add additional photos section with multiple fallback selectors
        let profileSection = document.querySelector('.profile-picture-upload');
        if (!profileSection) {
            profileSection = document.querySelector('.profile-section');
        }
        if (!profileSection) {
            profileSection = document.querySelector('[class*="profile"]');
        }
        
        if (profileSection && !document.getElementById('creativePhotosSection')) {
            const additionalPhotosHTML = `
                <div class="creative-additional-photos" id="creativePhotosSection">
                    <h3><i class="fas fa-images"></i> Additional Profile Photo</h3>
                    <div class="creative-photo-upload">
                        <img src="/images-default-profile.jpg" class="creative-additional-photo" id="creativePhoto2" onerror="this.src='/default-profile.jpg'">
                        <br>
                        <button class="creative-upload-btn" onclick="window.creativeManager.triggerPhotoUpload(2)">
                            <i class="fas fa-camera"></i> Add Second Photo
                        </button>
                        <input type="file" id="creativeFile2" class="creative-file-input" accept="image/*">
                        <button class="creative-remove-btn" onclick="window.creativeManager.removePhoto(2)">
                            <i class="fas fa-trash"></i> Remove
                        </button>
                    </div>
                </div>
            `;
            profileSection.insertAdjacentHTML('afterend', additionalPhotosHTML);
            this.setupFileInput(2);
        }
        
        // Add banners section with multiple fallback selectors
        let accountMain = document.querySelector('.account-main');
        if (!accountMain) {
            accountMain = document.querySelector('.main-content');
        }
        if (!accountMain) {
            accountMain = document.querySelector('main');
        }
        if (!accountMain) {
            accountMain = document.querySelector('.container');
        }
        
        if (accountMain && !document.getElementById('creativeBannerSection')) {
            const bannersHTML = `
                <div class="creative-banner-section" id="creativeBannerSection">
                    <h3><i class="fas fa-flag"></i> Choose Your Profile Banner</h3>
                    <div class="creative-banner-grid" id="creativeBannerGrid">
                        ${this.BANNERS.map(banner => `
                            <div class="creative-banner-item ${banner.class}" data-banner="${banner.id}">
                                ${banner.name}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
            accountMain.insertAdjacentHTML('afterbegin', bannersHTML);
            this.setupBannerClicks();
        }
    }

    setupFileInput(photoNumber) {
        const fileInput = document.getElementById(`creativeFile${photoNumber}`);
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    this.uploadPhoto(photoNumber, e.target.files[0]);
                }
            });
        }
    }

    setupBannerClicks() {
        const bannerGrid = document.getElementById('creativeBannerGrid');
        if (bannerGrid) {
            bannerGrid.addEventListener('click', (e) => {
                if (e.target.classList.contains('creative-banner-item')) {
                    const banner = e.target.getAttribute('data-banner');
                    this.selectBanner(banner);
                }
            });
        }
    }

    triggerPhotoUpload(photoNumber) {
        const fileInput = document.getElementById(`creativeFile${photoNumber}`);
        if (fileInput) {
            fileInput.click();
        }
    }

    async uploadPhoto(photoNumber, file) {
        if (!file || !this.currentUser) {
            this.showNotification('Please sign in to upload photos', 'error');
            return;
        }
        
        if (!file.type.startsWith('image/')) {
            this.showNotification('Please select an image file', 'error');
            return;
        }

        try {
            const photoElement = document.getElementById(`creativePhoto${photoNumber}`);
            if (photoElement) {
                photoElement.style.opacity = '0.5';
            }

            const imageUrl = await this.uploadToCloudinary(file);
            await this.saveToFirebase(`photo${photoNumber}`, imageUrl);
            
            if (photoElement) {
                photoElement.src = imageUrl;
                photoElement.style.opacity = '1';
            }
            
            this.showNotification('Photo uploaded successfully!', 'success');
        } catch (error) {
            this.showNotification('Failed to upload photo. Please try again.', 'error');
        }
    }

    async removePhoto(photoNumber) {
        if (!this.currentUser) {
            this.showNotification('Please sign in to manage photos', 'error');
            return;
        }
        
        try {
            await this.saveToFirebase(`photo${photoNumber}`, null);
            
            const photoElement = document.getElementById(`creativePhoto${photoNumber}`);
            if (photoElement) {
                photoElement.src = '/images-default-profile.jpg';
            }
            
            const fileInput = document.getElementById(`creativeFile${photoNumber}`);
            if (fileInput) {
                fileInput.value = '';
            }
            
            this.showNotification('Photo removed successfully!', 'success');
        } catch (error) {
            this.showNotification('Failed to remove photo', 'error');
        }
    }

    async selectBanner(banner) {
        if (!this.currentUser) {
            this.showNotification('Please sign in to select a banner', 'error');
            return;
        }
        
        try {
            document.querySelectorAll('.creative-banner-item').forEach(item => {
                item.classList.remove('selected');
            });
            
            const selectedBanner = document.querySelector(`[data-banner="${banner}"]`);
            if (selectedBanner) {
                selectedBanner.classList.add('selected');
            }
            
            await this.saveToFirebase('selectedBanner', banner);
            this.showNotification(`Banner set to: ${this.getBannerName(banner)}`, 'success');
        } catch (error) {
            this.showNotification('Failed to update banner', 'error');
        }
    }

    getBannerName(bannerId) {
        const banner = this.BANNERS.find(b => b.id === bannerId);
        return banner ? banner.name : bannerId;
    }

    async loadUserCreativeData() {
        if (!this.currentUser) return;
        
        try {
            const userRef = doc(db, 'users', this.currentUser.uid);
            const userSnap = await getDoc(userRef);
            
            if (userSnap.exists()) {
                const userData = userSnap.data();
                
                // Load banner
                if (userData.selectedBanner) {
                    const bannerElement = document.querySelector(`[data-banner="${userData.selectedBanner}"]`);
                    if (bannerElement) {
                        bannerElement.classList.add('selected');
                    }
                }
                
                // Load additional photos
                if (userData.photo2) {
                    const photoElement = document.getElementById('creativePhoto2');
                    if (photoElement) {
                        photoElement.src = userData.photo2;
                    }
                }
            }
        } catch (error) {
            // Silent fail for production
        }
    }

    async saveToFirebase(field, value) {
        if (!this.currentUser) return;
        
        const userRef = doc(db, 'users', this.currentUser.uid);
        await updateDoc(userRef, {
            [field]: value,
            updatedAt: serverTimestamp()
        });
    }

    async uploadToCloudinary(file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', 'profile-pictures');
        
        const response = await fetch(
            `https://api.cloudinary.com/v1_1/ddtdqrh1b/image/upload`,
            {
                method: 'POST',
                body: formData
            }
        );
        
        if (!response.ok) {
            throw new Error('Upload failed');
        }
        
        const data = await response.json();
        return data.secure_url;
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `creative-notification ${type}`;
        notification.innerHTML = `
            <div style="
                position: fixed;
                top: 20px;
                right: 20px;
                background: ${type === 'success' ? 'rgba(179, 0, 75, 0.95)' : type === 'error' ? 'rgba(139, 0, 0, 0.95)' : 'rgba(68, 68, 68, 0.95)'};
                color: white;
                padding: 15px 25px;
                border-radius: 8px;
                z-index: 10000;
                animation: slideIn 0.3s ease;
                font-family: 'Inter', sans-serif;
                font-weight: 600;
                box-shadow: 0 4px 15px rgba(0,0,0,0.4);
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.1);
            ">
                ${message}
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }

    // Profile page functions
    setupProfilePage() {
        this.loadProfileCreativeData();
    }

    async loadProfileCreativeData() {
        const urlParams = new URLSearchParams(window.location.search);
        const profileId = urlParams.get('id');
        
        if (!profileId) return;
        
        try {
            const profileRef = doc(db, 'users', profileId);
            const profileSnap = await getDoc(profileRef);
            
            if (profileSnap.exists()) {
                const profileData = profileSnap.data();
                this.displayProfileCreativeData(profileData);
            }
        } catch (error) {
            // Silent fail for production
        }
    }

    displayProfileCreativeData(profileData) {
        // Display banner
        let profileBanner = document.getElementById('profileBanner');
        if (!profileBanner) {
            const profileMeta = document.querySelector('.profile-meta');
            if (profileMeta) {
                profileMeta.insertAdjacentHTML('afterend', `
                    <div class="creative-profile-banner" id="profileBanner" style="display: none;"></div>
                `);
                profileBanner = document.getElementById('profileBanner');
            }
        }
        
        if (profileBanner && profileData.selectedBanner) {
            const banner = this.BANNERS.find(b => b.id === profileData.selectedBanner);
            if (banner) {
                profileBanner.className = `creative-profile-banner ${banner.class}`;
                profileBanner.textContent = banner.name.toUpperCase();
                profileBanner.style.display = 'block';
            }
        }
        
        // Display additional photo
        const thumbnail2 = document.getElementById('thumbnail2');
        if (thumbnail2 && profileData.photo2) {
            thumbnail2.src = profileData.photo2;
        }
    }

    // Mingle page functions
    setupMinglePage() {
        // Mingle page updates can be added here
    }
}

// Initialize Creative Manager
let creativeManager;

document.addEventListener('DOMContentLoaded', () => {
    creativeManager = new CreativeManager();
    window.creativeManager = creativeManager;
});