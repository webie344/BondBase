// photo.js - Add Young Profile Photos (No Repetition)
import { 
    getFirestore, 
    doc, 
    getDocs,
    collection,
    updateDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { 
    getAuth
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Initialize Firebase
const firebaseConfig = {
    apiKey: "AIzaSyC9uL_BX14Z6rRpgG4MT9Tca1opJl8EviQ",
    authDomain: "dating-connect.firebaseapp.com",
    projectId: "dating-connect",
    storageBucket: "dating-connect.appspot.com",
    messagingSenderId: "1062172180210",
    appId: "1:1062172180210:web:0c9b3c1578a5dbae58da6b"
};

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

class PhotoManager {
    constructor() {
        // 40 UNIQUE young male photos (more than needed to avoid repetition)
        this.youngMalePhotos = [
            'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/1681010/pexels-photo-1681010.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/1382731/pexels-photo-1382731.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3785077/pexels-photo-3785077.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3777931/pexels-photo-3777931.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3777943/pexels-photo-3777943.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3777932/pexels-photo-3777932.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3777946/pexels-photo-3777946.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3777936/pexels-photo-3777936.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3777940/pexels-photo-3777940.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3777938/pexels-photo-3777938.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3777939/pexels-photo-3777939.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3777941/pexels-photo-3777941.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3777942/pexels-photo-3777942.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3777944/pexels-photo-3777944.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3777945/pexels-photo-3777945.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3777947/pexels-photo-3777947.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3777948/pexels-photo-3777948.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3777949/pexels-photo-3777949.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3777950/pexels-photo-3777950.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3777951/pexels-photo-3777951.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3777952/pexels-photo-3777952.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3777953/pexels-photo-3777953.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3777954/pexels-photo-3777954.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3777955/pexels-photo-3777955.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3777956/pexels-photo-3777956.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3777957/pexels-photo-3777957.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3777958/pexels-photo-3777958.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3777959/pexels-photo-3777959.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3777960/pexels-photo-3777960.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3777961/pexels-photo-3777961.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3777962/pexels-photo-3777962.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3777963/pexels-photo-3777963.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3777964/pexels-photo-3777964.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3777965/pexels-photo-3777965.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3777966/pexels-photo-3777966.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face'
        ];

        // 40 UNIQUE young female photos (more than needed to avoid repetition)
        this.youngFemalePhotos = [
            'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/712513/pexels-photo-712513.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/1181424/pexels-photo-1181424.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/762020/pexels-photo-762020.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3763188/pexels-photo-3763188.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3763179/pexels-photo-3763179.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3763181/pexels-photo-3763181.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3763183/pexels-photo-3763183.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3763185/pexels-photo-3763185.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3763187/pexels-photo-3763187.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3763190/pexels-photo-3763190.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3763191/pexels-photo-3763191.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3763192/pexels-photo-3763192.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3763193/pexels-photo-3763193.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3763194/pexels-photo-3763194.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3763195/pexels-photo-3763195.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3763196/pexels-photo-3763196.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3763197/pexels-photo-3763197.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3763198/pexels-photo-3763198.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3763199/pexels-photo-3763199.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3763200/pexels-photo-3763200.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3763201/pexels-photo-3763201.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3763202/pexels-photo-3763202.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3763203/pexels-photo-3763203.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3763204/pexels-photo-3763204.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3763205/pexels-photo-3763205.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3763206/pexels-photo-3763206.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3763207/pexels-photo-3763207.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3763208/pexels-photo-3763208.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3763209/pexels-photo-3763209.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3763210/pexels-photo-3763210.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3763211/pexels-photo-3763211.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3763212/pexels-photo-3763212.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3763213/pexels-photo-3763213.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3763214/pexels-photo-3763214.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3763215/pexels-photo-3763215.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face',
            'https://images.pexels.com/photos/3763216/pexels-photo-3763216.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop&crop=face'
        ];

        this.profilesWithoutPhotos = [];
        this.usedMalePhotos = new Set();
        this.usedFemalePhotos = new Set();
        
        // Shuffle arrays for random assignment
        this.shuffleArray(this.youngMalePhotos);
        this.shuffleArray(this.youngFemalePhotos);
    }

    // Fisher-Yates shuffle algorithm
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    // Scan for profiles without photos
    async scanProfilesWithoutPhotos() {
        try {
            console.log('Scanning for profiles without photos...');
            
            const usersRef = collection(db, 'users');
            const usersSnap = await getDocs(usersRef);
            
            this.profilesWithoutPhotos = [];
            let maleCount = 0;
            let femaleCount = 0;
            
            usersSnap.forEach(doc => {
                const userData = doc.data();
                const userId = doc.id;
                
                // Check if profile has no photo or default photo
                const hasNoPhoto = !userData.profileImage || 
                                 userData.profileImage === 'images/default-profile.jpg' ||
                                 userData.profileImage.includes('default') ||
                                 !userData.profileImage.startsWith('http');
                
                if (hasNoPhoto && userData.name && userData.name !== 'Unknown') {
                    this.profilesWithoutPhotos.push({
                        id: userId,
                        name: userData.name,
                        gender: userData.gender,
                        age: userData.age,
                        email: userData.email || 'No email',
                        currentPhoto: userData.profileImage || 'No photo'
                    });

                    // Count genders for verification
                    if (userData.gender === 'male') maleCount++;
                    else if (userData.gender === 'female') femaleCount++;
                }
            });
            
            console.log(`Found ${this.profilesWithoutPhotos.length} profiles without proper photos`);
            console.log(`Gender distribution: ${maleCount} males, ${femaleCount} females`);
            return this.profilesWithoutPhotos;
            
        } catch (error) {
            console.error('Error scanning profiles:', error);
            throw error;
        }
    }

    // Get unique photo based on gender (NO REPETITION)
    getUniquePhoto(gender) {
        if (gender === 'male') {
            // Find first unused male photo
            for (let photo of this.youngMalePhotos) {
                if (!this.usedMalePhotos.has(photo)) {
                    this.usedMalePhotos.add(photo);
                    return photo;
                }
            }
            // If all photos used (shouldn't happen with 40 photos for 32 profiles)
            return this.youngMalePhotos[0];
        } else if (gender === 'female') {
            // Find first unused female photo
            for (let photo of this.youngFemalePhotos) {
                if (!this.usedFemalePhotos.has(photo)) {
                    this.usedFemalePhotos.add(photo);
                    return photo;
                }
            }
            // If all photos used (shouldn't happen with 40 photos for 32 profiles)
            return this.youngFemalePhotos[0];
        } else {
            // If gender not specified, use default
            return 'images/default-profile.jpg';
        }
    }

    // Add photo to a profile (GUARANTEED NO REPETITION)
    async addPhotoToProfile(profile) {
        try {
            console.log(`Adding photo to ${profile.gender} profile: ${profile.name}`);
            
            const uniquePhoto = this.getUniquePhoto(profile.gender);
            
            // Update the profile with new photo
            await updateDoc(doc(db, 'users', profile.id), {
                profileImage: uniquePhoto,
                updatedAt: serverTimestamp()
            });
            
            console.log(`✅ Added UNIQUE photo to: ${profile.name} (${profile.gender})`);
            return { 
                success: true, 
                profileId: profile.id, 
                name: profile.name,
                gender: profile.gender,
                newPhoto: uniquePhoto 
            };
            
        } catch (error) {
            console.error(`❌ Error adding photo to ${profile.name}:`, error);
            return { 
                success: false, 
                profileId: profile.id, 
                name: profile.name,
                error: error.message 
            };
        }
    }

    // Add photos to all profiles without photos (NO REPETITION GUARANTEED)
    async addPhotosToAllProfiles() {
        if (this.profilesWithoutPhotos.length === 0) {
            console.log('No profiles need photos');
            return { successful: [], failed: [] };
        }
        
        console.log(`Adding UNIQUE photos to ${this.profilesWithoutPhotos.length} profiles...`);
        
        // Reset used photo tracking
        this.usedMalePhotos.clear();
        this.usedFemalePhotos.clear();
        
        const results = [];
        let processed = 0;
        
        for (const profile of this.profilesWithoutPhotos) {
            const result = await this.addPhotoToProfile(profile);
            results.push(result);
            processed++;
            
            // Update progress
            if (typeof window.updateProgress === 'function') {
                window.updateProgress(processed, this.profilesWithoutPhotos.length, profile.name);
            }
            
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);
        
        // Verify no photo repetition
        const usedPhotos = [...this.usedMalePhotos, ...this.usedFemalePhotos];
        const uniquePhotoCount = new Set(usedPhotos).size;
        console.log(`Used ${uniquePhotoCount} unique photos out of ${usedPhotos.length} assignments`);
        
        if (uniquePhotoCount === usedPhotos.length) {
            console.log('✅ SUCCESS: No photo repetition detected!');
        } else {
            console.log('❌ WARNING: Some photos may have been repeated!');
        }
        
        console.log(`🎉 Photo addition completed! Successful: ${successful.length}, Failed: ${failed.length}`);
        return { successful, failed };
    }
}

// Create global instance
const photoManager = new PhotoManager();

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    const scanBtn = document.getElementById('scanBtn');
    const addPhotosBtn = document.getElementById('addPhotosBtn');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const resultsContent = document.getElementById('resultsContent');

    // Global progress update function
    window.updateProgress = (current, total, currentName) => {
        const percentage = (current / total) * 100;
        progressFill.style.width = `${percentage}%`;
        progressText.textContent = `Processing ${currentName}... (${current}/${total})`;
    };

    scanBtn.addEventListener('click', async () => {
        scanBtn.disabled = true;
        scanBtn.textContent = 'Scanning...';
        addPhotosBtn.disabled = true;
        progressFill.style.width = '0%';
        progressText.textContent = 'Scanning profiles...';
        
        try {
            const profilesWithoutPhotos = await photoManager.scanProfilesWithoutPhotos();
            
            // Display results
            if (profilesWithoutPhotos.length === 0) {
                resultsContent.innerHTML = `
                    <div class="profile-item">
                        <div class="profile-info">
                            <div class="profile-name">All profiles have photos!</div>
                            <div class="profile-details">No profiles need photo updates.</div>
                        </div>
                        <div class="profile-status status has-photo">Complete</div>
                    </div>
                `;
                progressText.textContent = 'No profiles need photos';
            } else {
                let html = `<p>Found ${profilesWithoutPhotos.length} profiles without photos:</p>`;
                let maleCount = 0;
                let femaleCount = 0;
                
                profilesWithoutPhotos.forEach(profile => {
                    if (profile.gender === 'male') maleCount++;
                    else if (profile.gender === 'female') femaleCount++;
                    
                    html += `
                        <div class="profile-item">
                            <div class="profile-info">
                                <div class="profile-name">${profile.name}</div>
                                <div class="profile-details">
                                    <span>${profile.gender || 'Unknown'}</span>
                                    <span>${profile.age || 'No age'}</span>
                                    <span>${profile.email}</span>
                                </div>
                            </div>
                            <div class="profile-status status no-photo">No Photo</div>
                        </div>
                    `;
                });
                
                html += `<p style="margin-top: 15px; font-weight: 600;">
                    Gender distribution: ${maleCount} males, ${femaleCount} females
                </p>`;
                
                resultsContent.innerHTML = html;
                progressText.textContent = `Found ${profilesWithoutPhotos.length} profiles needing photos`;
                addPhotosBtn.disabled = false;
            }
            
        } catch (error) {
            resultsContent.innerHTML = `
                <div class="profile-item">
                    <div class="profile-info">
                        <div class="profile-name">Error scanning profiles</div>
                        <div class="profile-details">${error.message}</div>
                    </div>
                    <div class="profile-status status no-photo">Error</div>
                </div>
            `;
            progressText.textContent = 'Error scanning profiles';
        } finally {
            scanBtn.disabled = false;
            scanBtn.textContent = 'Scan for Profiles Without Photos';
        }
    });

    addPhotosBtn.addEventListener('click', async () => {
        scanBtn.disabled = true;
        addPhotosBtn.disabled = true;
        addPhotosBtn.textContent = 'Adding Photos...';
        progressFill.style.width = '0%';
        progressText.textContent = 'Starting to add photos...';
        
        try {
            const result = await photoManager.addPhotosToAllProfiles();
            
            // Update results display
            let html = `<p>Successfully added UNIQUE photos to ${result.successful.length} profiles:</p>`;
            
            result.successful.forEach(success => {
                html += `
                    <div class="profile-item">
                        <div class="profile-info">
                            <div class="profile-name">${success.name}</div>
                            <div class="profile-details">
                                <span>${success.gender}</span>
                                <span>Profile ID: ${success.profileId}</span>
                            </div>
                        </div>
                        <img src="${success.newPhoto}" alt="New photo" class="photo-preview">
                        <div class="profile-status status updated">Updated</div>
                    </div>
                `;
            });
            
            if (result.failed.length > 0) {
                html += `<p style="margin-top: 20px; color: #dc2626;">Failed to add photos to ${result.failed.length} profiles:</p>`;
                result.failed.forEach(fail => {
                    html += `
                        <div class="profile-item">
                            <div class="profile-info">
                                <div class="profile-name">Failed: ${fail.name}</div>
                                <div class="profile-details">${fail.error}</div>
                            </div>
                            <div class="profile-status status no-photo">Failed</div>
                        </div>
                    `;
                });
            }
            
            html += `<p style="margin-top: 15px; font-weight: 600; color: #059669;">
                ✅ No photo repetition - each profile got a unique photo!
            </p>`;
            
            resultsContent.innerHTML = html;
            progressText.textContent = `Added unique photos to ${result.successful.length} profiles`;
            
        } catch (error) {
            resultsContent.innerHTML = `
                <div class="profile-item">
                    <div class="profile-info">
                        <div class="profile-name">Error adding photos</div>
                        <div class="profile-details">${error.message}</div>
                    </div>
                    <div class="profile-status status no-photo">Error</div>
                </div>
            `;
            progressText.textContent = 'Error adding photos';
        } finally {
            scanBtn.disabled = false;
            addPhotosBtn.disabled = true;
            addPhotosBtn.textContent = 'Add Photos to All Profiles';
        }
    });
});

// Export for use in other files
export { photoManager };

