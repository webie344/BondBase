// verification.js - Standalone email verification and account management
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, 
    sendEmailVerification, 
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    updateDoc, 
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Firebase configuration (same as app.js)
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

// Verification constants
const VERIFICATION_TIMEOUT_DAYS = 3;
const VERIFICATION_TIMEOUT_MS = VERIFICATION_TIMEOUT_DAYS * 24 * 60 * 60 * 1000;

class VerificationManager {
    constructor() {
        this.currentUser = null;
        this.isCheckingDisabledAccount = false;
        this.isNewSignup = false;
        this.isRedirecting = false;
        this.init();
    }

    init() {
        // Listen for auth state changes
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                this.currentUser = user;
                
                // Skip verification handling for new signups
                if (this.isNewSignup) {
                    this.isNewSignup = false;
                    return;
                }
                
                // Don't handle verification status if we're in the middle of checking a disabled account
                if (!this.isCheckingDisabledAccount && !this.isRedirecting) {
                    await this.handleUserVerificationStatus(user);
                }
            } else {
                this.currentUser = null;
                this.isCheckingDisabledAccount = false;
                this.isNewSignup = false;
                this.isRedirecting = false;
            }
        });
    }

    async handleUserVerificationStatus(user) {
        try {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            
            if (!userDoc.exists()) {
                // User document doesn't exist yet - wait for app.js to create it
                console.log('User document not found, waiting for app.js to create it...');
                return;
            }

            const userData = userDoc.data();
            
            // Check if user is verified but still marked as disabled
            if (user.emailVerified && userData.accountDisabled) {
                console.log('User is verified but account is still marked as disabled. Re-enabling...');
                await this.reenableUserAccount(user.uid);
                return;
            }
            
            // Check if account is disabled
            if (userData.accountDisabled) {
                await this.redirectToDisabledPage();
                return;
            }

            // Check verification status
            if (!user.emailVerified) {
                const now = new Date().getTime();
                const accountCreatedAt = userData.createdAt?.toDate?.()?.getTime() || now;
                const timeSinceCreation = now - accountCreatedAt;

                if (timeSinceCreation > VERIFICATION_TIMEOUT_MS) {
                    // Account not verified within 3 days - disable it
                    await this.disableUserAccount(user.uid);
                    await this.redirectToDisabledPage();
                    return;
                }

                // Send verification email if not already sent recently
                await this.sendVerificationEmail(user);
            }
        } catch (error) {
            console.error('Error handling verification status:', error);
        }
    }

    async sendVerificationEmail(user) {
        try {
            // Check if we sent a verification email recently (last 1 hour)
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                const lastSent = userData.verificationSentAt?.toDate?.()?.getTime() || 0;
                const now = new Date().getTime();
                const oneHour = 60 * 60 * 1000;

                if (now - lastSent < oneHour) {
                    console.log('Verification email sent recently, skipping...');
                    return;
                }
            }

            await sendEmailVerification(user);

            await updateDoc(doc(db, 'users', user.uid), {
                verificationSentAt: serverTimestamp()
            });

            console.log('Verification email sent successfully');
            
        } catch (error) {
            console.error('Error sending verification email:', error);
        }
    }

    async disableUserAccount(userId) {
        try {
            await updateDoc(doc(db, 'users', userId), {
                accountDisabled: true,
                disabledAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            
            console.log(`Account ${userId} disabled due to non-verification`);
        } catch (error) {
            console.error('Error disabling user account:', error);
        }
    }

    async reenableUserAccount(userId) {
        try {
            await updateDoc(doc(db, 'users', userId), {
                accountDisabled: false,
                reenabledAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            
            console.log(`Account ${userId} re-enabled after verification`);
            
            // Redirect to dashboard instead of disabled page
            if (window.location.pathname.includes('disabled.html')) {
                window.location.href = 'dashboard.html';
            }
        } catch (error) {
            console.error('Error re-enabling user account:', error);
        }
    }

    async redirectToDisabledPage() {
        // Prevent multiple redirects
        if (this.isRedirecting) return;
        
        this.isRedirecting = true;
        
        // Only redirect if not already on the disabled page
        if (!window.location.pathname.includes('disabled.html')) {
            console.log('Redirecting to disabled page...');
            // Store user info before redirecting
            if (this.currentUser) {
                localStorage.setItem('disabledUserEmail', this.currentUser.email);
                localStorage.setItem('disabledUserId', this.currentUser.uid);
            }
            window.location.href = 'disabled.html';
        } else {
            this.isRedirecting = false;
        }
    }

    async checkLoginAttempt(email, password) {
        try {
            console.log('Attempting login for:', email);
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            console.log('Login successful, checking account status...');
            
            // Store user info immediately
            localStorage.setItem('disabledUserEmail', user.email);
            localStorage.setItem('disabledUserId', user.uid);
            
            // Check if account is disabled
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                
                // Check if user is verified but still marked as disabled
                if (user.emailVerified && userData.accountDisabled) {
                    console.log('User is verified but account is still marked as disabled. Re-enabling...');
                    await this.reenableUserAccount(user.uid);
                    return true;
                }
                
                // Check if account is still disabled
                if (userData.accountDisabled) {
                    console.log('Account is disabled, redirecting...');
                    this.isCheckingDisabledAccount = true;
                    this.redirectToDisabledPage();
                    return false;
                }
            }
            
            console.log('Account is active');
            return true;
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    }

    async resendVerificationEmail() {
        if (!this.currentUser) {
            throw new Error('No user logged in');
        }

        await this.sendVerificationEmail(this.currentUser);
    }

    async checkVerificationStatus() {
        if (!this.currentUser) {
            return { verified: false, disabled: false };
        }

        try {
            await this.currentUser.reload();
            const userDoc = await getDoc(doc(db, 'users', this.currentUser.uid));
            const userData = userDoc.exists() ? userDoc.data() : {};

            // If user is verified but account is marked as disabled, re-enable it
            if (this.currentUser.emailVerified && userData.accountDisabled) {
                console.log('User is verified but account marked as disabled. Auto-re-enabling...');
                await this.reenableUserAccount(this.currentUser.uid);
                return {
                    verified: true,
                    disabled: false,
                    createdAt: userData.createdAt
                };
            }

            return {
                verified: this.currentUser.emailVerified,
                disabled: userData.accountDisabled || false,
                createdAt: userData.createdAt
            };
        } catch (error) {
            console.error('Error checking verification status:', error);
            return { verified: false, disabled: false };
        }
    }

    // Manual check for disabled accounts (for login page)
    async manuallyCheckDisabledAccount(user) {
        try {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                
                // Check if user is verified but still marked as disabled
                if (user.emailVerified && userData.accountDisabled) {
                    console.log('User is verified but account is still marked as disabled. Re-enabling...');
                    await this.reenableUserAccount(user.uid);
                    return false; // Account is not disabled anymore
                }
                
                if (userData.accountDisabled) {
                    this.isCheckingDisabledAccount = true;
                    this.redirectToDisabledPage();
                    return true;
                }
            }
            return false;
        } catch (error) {
            console.error('Error checking disabled account:', error);
            return false;
        }
    }

    // Mark as new signup to prevent immediate redirect
    markAsNewSignup() {
        this.isNewSignup = true;
    }

    // Reset redirect flag (call this when leaving disabled page)
    resetRedirectFlag() {
        this.isRedirecting = false;
        this.isCheckingDisabledAccount = false;
    }

    // Get current user for external use
    getCurrentUser() {
        return this.currentUser;
    }

    // Force check and re-enable if verified
    async forceRecheckVerificationStatus() {
        if (!this.currentUser) return { verified: false, disabled: false };
        
        try {
            await this.currentUser.reload();
            const userDoc = await getDoc(doc(db, 'users', this.currentUser.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                
                if (this.currentUser.emailVerified && userData.accountDisabled) {
                    console.log('Force recheck: User verified but disabled. Re-enabling...');
                    await this.reenableUserAccount(this.currentUser.uid);
                    return { verified: true, disabled: false };
                }
                
                return {
                    verified: this.currentUser.emailVerified,
                    disabled: userData.accountDisabled || false
                };
            }
            return { verified: false, disabled: false };
        } catch (error) {
            console.error('Error in force recheck:', error);
            return { verified: false, disabled: false };
        }
    }
}

// Initialize verification manager
const verificationManager = new VerificationManager();

// Export for use in other files
window.verificationManager = verificationManager;

// Enhanced login function that checks for disabled accounts
async function enhancedLogin(email, password) {
    return await verificationManager.checkLoginAttempt(email, password);
}

// Export enhanced login function
window.enhancedLogin = enhancedLogin;

// Auto-check verification status every minute
setInterval(() => {
    if (verificationManager.currentUser && 
        !verificationManager.isCheckingDisabledAccount && 
        !verificationManager.isNewSignup &&
        !verificationManager.isRedirecting) {
        verificationManager.handleUserVerificationStatus(verificationManager.currentUser);
    }
}, 60000);

// Add a manual verification check function that can be called from other pages
window.checkAndFixVerificationStatus = async function() {
    if (verificationManager.currentUser) {
        const status = await verificationManager.forceRecheckVerificationStatus();
        return status;
    }
    return { verified: false, disabled: false };
};