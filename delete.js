// delete.js - Delete ALL Users from Firebase Authentication
import { 
    getAuth,
    deleteUser,
    signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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

class AuthUserDeleter {
    constructor() {
        this.deletedCount = 0;
        this.errorCount = 0;
        this.adminEmail = 'cypriandavidonyebuchi@gmail.com'; // Your admin email
        this.adminPassword = 'admin123'; // Your admin password
    }

    async authenticateAdmin() {
        try {
            console.log('🔐 Authenticating as admin...');
            const userCredential = await signInWithEmailAndPassword(
                auth, 
                this.adminEmail, 
                this.adminPassword
            );
            console.log('✅ Admin authenticated successfully');
            return userCredential.user;
        } catch (error) {
            console.error('❌ Admin authentication failed:', error);
            throw new Error('Admin authentication failed. Please check credentials.');
        }
    }

    async deleteAllAuthUsers() {
        try {
            console.log('🚨 Starting deletion of ALL Authentication users...');
            
            // First authenticate as admin
            await this.authenticateAdmin();
            
            // Get all users (this is a simplified approach)
            // Note: In production, you'd use Firebase Admin SDK on a server
            await this.deleteUsersSequentially();
            
            console.log(`🎉 Authentication users deletion completed!`);
            console.log(`✅ Successfully deleted: ${this.deletedCount} users`);
            console.log(`❌ Errors: ${this.errorCount} users`);
            
            return {
                success: true,
                deleted: this.deletedCount,
                errors: this.errorCount
            };
            
        } catch (error) {
            console.error('❌ Error during deletion:', error);
            return {
                success: false,
                error: error.message,
                deleted: this.deletedCount,
                errors: this.errorCount
            };
        }
    }

    async deleteUsersSequentially() {
        // Since we can't list all users from client-side, we'll try to delete
        // the default profiles we created and any currently logged-in users
        
        console.log('⚠️  Client-side limitation: Cannot list all Authentication users');
        console.log('💡 For complete deletion, use Firebase Console → Authentication');
        console.log('🗑️  Attempting to delete known default profiles...');
        
        // Try to delete default profiles we might have created
        await this.deleteDefaultProfiles();
    }

    async deleteDefaultProfiles() {
        const defaultEmails = this.generateDefaultEmails();
        
        for (const email of defaultEmails) {
            try {
                // Try to sign in with default password
                const userCredential = await signInWithEmailAndPassword(auth, email, 'default123');
                const user = userCredential.user;
                
                // Delete the user
                await deleteUser(user);
                this.deletedCount++;
                console.log(`✅ Deleted auth user: ${email}`);
                
                // Update progress
                if (typeof window.updateDeleteProgress === 'function') {
                    window.updateDeleteProgress(this.deletedCount, defaultEmails.length, email);
                }
                
            } catch (error) {
                if (error.code === 'auth/user-not-found') {
                    console.log(`⏩ User not found: ${email}`);
                } else if (error.code === 'auth/wrong-password') {
                    console.log(`⏩ Wrong password for: ${email}`);
                } else {
                    this.errorCount++;
                    console.error(`❌ Error deleting ${email}:`, error.message);
                }
            }
            
            // Delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    generateDefaultEmails() {
        const emails = [];
        
        // Generate emails for potential default profiles
        const firstNames = ['james', 'john', 'robert', 'michael', 'william', 'david', 'mary', 'patricia', 'jennifer', 'linda'];
        const lastNames = ['smith', 'johnson', 'williams', 'brown', 'jones', 'garcia', 'miller', 'davis'];
        
        for (let i = 1; i <= 100; i++) {
            const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
            const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
            const email = `${firstName}.${lastName}${i}@datingapp.com`;
            emails.push(email);
        }
        
        return emails;
    }

    async deleteCurrentUsers() {
        // This method tries to delete users that might be cached or currently accessible
        console.log('Attempting to delete currently accessible users...');
        
        // Note: This is limited to users we can currently access
        // For complete deletion, use Firebase Console
    }

    async getAuthUsersCount() {
        // Client-side cannot get total auth users count
        // This is a limitation of Firebase Client SDK
        console.log('ℹ️  Authentication user count unavailable from client-side');
        console.log('💡 Check Firebase Console → Authentication for user count');
        return 0;
    }
}

// Create global instance
const authUserDeleter = new AuthUserDeleter();

// Export functions
export { authUserDeleter };
export const deleteAllAuthUsers = () => authUserDeleter.deleteAllAuthUsers();
export const getAuthUsersCount = () => authUserDeleter.getAuthUsersCount()

