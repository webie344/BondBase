// profile.js - Fix Incomplete Profiles
import { 
    getFirestore, 
    doc, 
    setDoc,
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

class ProfileFixer {
    constructor() {
        this.names = {
            male: [
                'Liam', 'Noah', 'Oliver', 'Elijah', 'James', 'William', 'Benjamin', 'Lucas', 'Henry', 'Alexander',
                'Mason', 'Michael', 'Ethan', 'Daniel', 'Jacob', 'Logan', 'Jackson', 'Levi', 'Sebastian', 'Mateo',
                'Jack', 'Owen', 'Theodore', 'Aiden', 'Samuel', 'Joseph', 'John', 'David', 'Wyatt', 'Matthew',
                'Luke', 'Asher', 'Carter', 'Julian', 'Grayson', 'Leo', 'Jayden', 'Gabriel', 'Isaac', 'Lincoln',
                'Anthony', 'Hudson', 'Dylan', 'Ezra', 'Thomas', 'Charles', 'Christopher', 'Jaxon', 'Maverick', 'Josiah'
            ],
            female: [
                'Emma', 'Olivia', 'Ava', 'Isabella', 'Sophia', 'Charlotte', 'Mia', 'Amelia', 'Harper', 'Evelyn',
                'Abigail', 'Emily', 'Elizabeth', 'Mila', 'Ella', 'Avery', 'Sofia', 'Camila', 'Aria', 'Scarlett',
                'Victoria', 'Madison', 'Luna', 'Grace', 'Chloe', 'Penelope', 'Layla', 'Riley', 'Zoey', 'Nora',
                'Lily', 'Eleanor', 'Hannah', 'Lillian', 'Addison', 'Aubrey', 'Ellie', 'Stella', 'Natalie', 'Zoe',
                'Leah', 'Hazel', 'Violet', 'Aurora', 'Savannah', 'Audrey', 'Brooklyn', 'Bella', 'Claire', 'Skylar'
            ]
        };

        this.lastNames = [
            'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
            'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
            'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
            'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
            'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts'
        ];

        this.bios = [
            "College student studying psychology. Love coffee shops, indie music, and deep conversations about life.",
            "Recent grad working in marketing. Always exploring the city and trying new restaurants on weekends.",
            "Art student with a passion for photography. You'll usually find me with a camera in hand.",
            "Software engineer by day, gamer by night. Love tech meetups and trying new craft beers.",
            "Nursing student who loves helping people. Enjoy hiking and yoga to balance the stressful days.",
            "Barista and part-time musician. Writing songs and pulling espresso shots are my specialties.",
            "Finance intern exploring the corporate world. Love networking events and weekend getaways.",
            "Biology major dreaming of med school. Spend my free time volunteering at animal shelters.",
            "Graphic designer with a love for minimalism. Always hunting for inspiration in the city.",
            "Education major who loves working with kids. Summer camp counselor and adventure seeker.",
            "Environmental science student passionate about sustainability. Love hiking and beach cleanups.",
            "Business student with entrepreneurial dreams. Always working on my next side project.",
            "Architecture student fascinated by urban design. You'll find me sketching in cafes.",
            "Communications major and social media manager. Love creating content and connecting with people.",
            "Chemistry student who loves lab work and research. Balance it out with dance classes.",
            "Political science major interested in activism. Attend rallies and volunteer for causes I believe in.",
            "Computer science student building apps. Love hackathons and coding challenges.",
            "Journalism student telling important stories. Always carrying a notebook for inspiration.",
            "Music production student making beats. Dream of producing for major artists someday.",
            "Fashion merchandising student with an eye for style. Love thrifting and sustainable fashion."
        ];

        this.interests = [
            ['Coffee', 'Music Festivals', 'Photography', 'Travel', 'Art Galleries'],
            ['Reading', 'Cooking', 'Movies', 'Music', 'Art'],
            ['Yoga', 'Meditation', 'Healthy Living', 'Nature', 'Wellness'],
            ['Gaming', 'Technology', 'Sports', 'Fitness', 'Coding'],
            ['Art', 'Museums', 'Theater', 'Literature', 'Poetry'],
            ['Dancing', 'Social Events', 'Food', 'Travel', 'Networking'],
            ['Music', 'Concerts', 'Festivals', 'Photography', 'Vinyl'],
            ['Sports', 'Fitness', 'Nutrition', 'Wellness', 'Running'],
            ['Writing', 'Reading', 'Philosophy', 'Psychology', 'Coffee'],
            ['Cooking', 'Baking', 'Wine Tasting', 'Food Tours', 'Recipes']
        ];

        this.locations = [
            'New York, NY', 'Los Angeles, CA', 'Chicago, IL', 'Austin, TX', 'Seattle, WA',
            'Denver, CO', 'Portland, OR', 'Nashville, TN', 'Atlanta, GA', 'Miami, FL',
            'Boston, MA', 'San Diego, CA', 'Philadelphia, PA', 'Phoenix, AZ', 'Las Vegas, NV',
            'San Francisco, CA', 'Washington, DC', 'Dallas, TX', 'Houston, TX', 'Brooklyn, NY'
        ];

        this.incompleteProfiles = [];
    }

    // Generate realistic profile data
    generateProfileData(email) {
        const gender = Math.random() > 0.5 ? 'male' : 'female';
        const firstName = this.names[gender][Math.floor(Math.random() * this.names[gender].length)];
        const lastName = this.lastNames[Math.floor(Math.random() * this.lastNames.length)];
        const age = Math.floor(Math.random() * 10) + 20; // 20-29 years old

        return {
            name: `${firstName} ${lastName}`,
            age: age,
            gender: gender,
            location: this.locations[Math.floor(Math.random() * this.locations.length)],
            bio: this.bios[Math.floor(Math.random() * this.bios.length)],
            interests: this.interests[Math.floor(Math.random() * this.interests.length)],
            profileComplete: true,
            updatedAt: serverTimestamp(),
            chatPoints: Math.floor(Math.random() * 50) + 20,
            likes: Math.floor(Math.random() * 100) + 10,
            // Use default profile image from your app
            profileImage: 'images/default-profile.jpg'
        };
    }

    // Scan for incomplete profiles
    async scanIncompleteProfiles() {
        try {
            console.log('Scanning for incomplete profiles...');
            
            const usersRef = collection(db, 'users');
            const usersSnap = await getDocs(usersRef);
            
            this.incompleteProfiles = [];
            
            usersSnap.forEach(doc => {
                const userData = doc.data();
                const userId = doc.id;
                
                // Check if profile is incomplete (missing name or shows as Unknown)
                const isIncomplete = !userData.name || 
                                   userData.name === 'Unknown' || 
                                   !userData.profileComplete ||
                                   !userData.age ||
                                   !userData.bio;
                
                if (isIncomplete) {
                    this.incompleteProfiles.push({
                        id: userId,
                        email: userData.email || 'No email',
                        currentData: userData,
                        needsFix: true
                    });
                }
            });
            
            console.log(`Found ${this.incompleteProfiles.length} incomplete profiles`);
            return this.incompleteProfiles;
            
        } catch (error) {
            console.error('Error scanning profiles:', error);
            throw error;
        }
    }

    // Fix a single incomplete profile
    async fixProfile(profile) {
        try {
            console.log(`Fixing profile: ${profile.id}`);
            
            // Generate new profile data
            const newProfileData = this.generateProfileData(profile.email);
            
            // Merge with existing data (keep email, uid, etc.)
            const updatedData = {
                ...profile.currentData,
                ...newProfileData,
                updatedAt: serverTimestamp()
            };
            
            // Ensure name is set and not "Unknown"
            if (!updatedData.name || updatedData.name === 'Unknown') {
                const gender = Math.random() > 0.5 ? 'male' : 'female';
                const firstName = this.names[gender][Math.floor(Math.random() * this.names[gender].length)];
                const lastName = this.lastNames[Math.floor(Math.random() * this.lastNames.length)];
                updatedData.name = `${firstName} ${lastName}`;
            }
            
            // Update the profile in Firestore
            await updateDoc(doc(db, 'users', profile.id), updatedData);
            
            console.log(`✅ Fixed profile: ${updatedData.name}`);
            return { success: true, profileId: profile.id, newName: updatedData.name };
            
        } catch (error) {
            console.error(`❌ Error fixing profile ${profile.id}:`, error);
            return { success: false, profileId: profile.id, error: error.message };
        }
    }

    // Fix all incomplete profiles
    async fixAllIncompleteProfiles() {
        if (this.incompleteProfiles.length === 0) {
            console.log('No incomplete profiles to fix');
            return { successful: [], failed: [] };
        }
        
        console.log(`Fixing ${this.incompleteProfiles.length} incomplete profiles...`);
        
        const results = [];
        let fixed = 0;
        
        for (const profile of this.incompleteProfiles) {
            const result = await this.fixProfile(profile);
            results.push(result);
            fixed++;
            
            // Update progress
            if (typeof window.updateProgress === 'function') {
                window.updateProgress(fixed, this.incompleteProfiles.length, result.newName || profile.id);
            }
            
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);
        
        console.log(`🎉 Fixing completed! Successful: ${successful.length}, Failed: ${failed.length}`);
        return { successful, failed };
    }
}

// Create global instance
const profileFixer = new ProfileFixer();

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    const scanBtn = document.getElementById('scanBtn');
    const fixBtn = document.getElementById('fixBtn');
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
        fixBtn.disabled = true;
        progressFill.style.width = '0%';
        progressText.textContent = 'Scanning profiles...';
        
        try {
            const incompleteProfiles = await profileFixer.scanIncompleteProfiles();
            
            // Display results
            if (incompleteProfiles.length === 0) {
                resultsContent.innerHTML = `
                    <div class="profile-item">
                        <div class="profile-info">
                            <div class="profile-name">No incomplete profiles found!</div>
                            <div class="profile-email">All profiles are complete.</div>
                        </div>
                        <div class="profile-status status complete">Complete</div>
                    </div>
                `;
                progressText.textContent = 'No incomplete profiles found';
            } else {
                let html = `<p>Found ${incompleteProfiles.length} incomplete profiles:</p>`;
                
                incompleteProfiles.forEach(profile => {
                    const currentName = profile.currentData.name || 'Unknown';
                    html += `
                        <div class="profile-item">
                            <div class="profile-info">
                                <div class="profile-name">${currentName}</div>
                                <div class="profile-email">${profile.email} (${profile.id})</div>
                            </div>
                            <div class="profile-status status incomplete">Needs Fix</div>
                        </div>
                    `;
                });
                
                resultsContent.innerHTML = html;
                progressText.textContent = `Found ${incompleteProfiles.length} incomplete profiles`;
                fixBtn.disabled = false;
            }
            
        } catch (error) {
            resultsContent.innerHTML = `
                <div class="profile-item">
                    <div class="profile-info">
                        <div class="profile-name">Error scanning profiles</div>
                        <div class="profile-email">${error.message}</div>
                    </div>
                    <div class="profile-status status incomplete">Error</div>
                </div>
            `;
            progressText.textContent = 'Error scanning profiles';
        } finally {
            scanBtn.disabled = false;
            scanBtn.textContent = 'Scan for Incomplete Profiles';
        }
    });

    fixBtn.addEventListener('click', async () => {
        scanBtn.disabled = true;
        fixBtn.disabled = true;
        fixBtn.textContent = 'Fixing Profiles...';
        progressFill.style.width = '0%';
        progressText.textContent = 'Starting to fix profiles...';
        
        try {
            const result = await profileFixer.fixAllIncompleteProfiles();
            
            // Update results display
            let html = `<p>Fixed ${result.successful.length} profiles successfully:</p>`;
            
            result.successful.forEach(success => {
                html += `
                    <div class="profile-item">
                        <div class="profile-info">
                            <div class="profile-name">${success.newName}</div>
                            <div class="profile-email">Profile ID: ${success.profileId}</div>
                        </div>
                        <div class="profile-status status fixed">Fixed</div>
                    </div>
                `;
            });
            
            if (result.failed.length > 0) {
                html += `<p style="margin-top: 20px; color: #dc2626;">Failed to fix ${result.failed.length} profiles:</p>`;
                result.failed.forEach(fail => {
                    html += `
                        <div class="profile-item">
                            <div class="profile-info">
                                <div class="profile-name">Failed: ${fail.profileId}</div>
                                <div class="profile-email">${fail.error}</div>
                            </div>
                            <div class="profile-status status incomplete">Failed</div>
                        </div>
                    `;
                });
            }
            
            resultsContent.innerHTML = html;
            progressText.textContent = `Fixed ${result.successful.length} profiles successfully`;
            
        } catch (error) {
            resultsContent.innerHTML = `
                <div class="profile-item">
                    <div class="profile-info">
                        <div class="profile-name">Error fixing profiles</div>
                        <div class="profile-email">${error.message}</div>
                    </div>
                    <div class="profile-status status incomplete">Error</div>
                </div>
            `;
            progressText.textContent = 'Error fixing profiles';
        } finally {
            scanBtn.disabled = false;
            fixBtn.disabled = true;
            fixBtn.textContent = 'Fix All Incomplete Profiles';
        }
    });
});

// Export for use in other files
export { profileFixer };

