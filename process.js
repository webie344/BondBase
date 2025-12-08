// process.js - Loading state management for authentication processes

class AuthProcessManager {
    constructor() {
        this.init();
    }

    init() {
        // Add loader styles
        this.addLoaderStyles();
        
        // Intercept form submissions
        this.interceptAuthForms();
    }

    addLoaderStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .auth-loader {
                display: inline-block;
                width: 20px;
                height: 20px;
                border: 3px solid rgba(255, 255, 255, 0.3);
                border-radius: 50%;
                border-top-color: #fff;
                animation: spin 1s ease-in-out infinite;
                margin-right: 8px;
                vertical-align: middle;
            }
            
            .auth-loader.btn-loader {
                width: 16px;
                height: 16px;
                border-width: 2px;
            }
            
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
            
            .btn-loading {
                position: relative;
                color: transparent !important;
            }
            
            .btn-loading::after {
                content: '';
                position: absolute;
                left: 50%;
                top: 50%;
                width: 20px;
                height: 20px;
                margin: -10px 0 0 -10px;
                border: 3px solid rgba(255, 255, 255, 0.3);
                border-radius: 50%;
                border-top-color: #fff;
                animation: spin 1s ease-in-out infinite;
            }
        `;
        document.head.appendChild(style);
    }

    interceptAuthForms() {
        // Listen for DOMContentLoaded to ensure forms exist
        document.addEventListener('DOMContentLoaded', () => {
            // Login form - ONLY add loading state, don't handle auth
            const loginForm = document.getElementById('loginForm');
            if (loginForm) {
                loginForm.addEventListener('submit', (e) => {
                    this.handleAuthSubmit(e, 'login');
                });
            }

            // Signup form - ONLY add loading state, don't handle auth
            const signupForm = document.getElementById('signupForm');
            if (signupForm) {
                signupForm.addEventListener('submit', (e) => {
                    this.handleAuthSubmit(e, 'signup');
                });
            }
        });
    }

    handleAuthSubmit(event, formType) {
        // Get the submit button
        let submitButton;
        if (formType === 'login') {
            submitButton = document.querySelector('#loginForm button[type="submit"]');
        } else if (formType === 'signup') {
            submitButton = document.querySelector('#signupForm button[type="submit"]');
        }
        
        if (!submitButton) return;
        
        // Store original text
        const originalText = submitButton.textContent;
        submitButton.setAttribute('data-original-text', originalText);
        
        // Add loading state
        submitButton.classList.add('btn-loading');
        submitButton.disabled = true;
        
        // Store reference to this for use in timeout
        const self = this;
        
        // Set a timeout to reset the button if the form doesn't submit successfully
        // This is a fallback in case the app.js authentication fails
        setTimeout(() => {
            // Check if we're still on the same page (auth failed)
            if (window.location.pathname.includes('login.html') || 
                window.location.pathname.includes('signup.html')) {
                self.resetButtonState(submitButton, originalText);
            }
        }, 5000); // Reset after 5 seconds if still on auth page
    }

    resetButtonState(button, originalText) {
        button.classList.remove('btn-loading');
        button.disabled = false;
        button.textContent = originalText;
    }

    // Method to manually reset button state (can be called from app.js)
    resetAuthButton(formType) {
        let submitButton;
        if (formType === 'login') {
            submitButton = document.querySelector('#loginForm button[type="submit"]');
        } else if (formType === 'signup') {
            submitButton = document.querySelector('#signupForm button[type="submit"]');
        }
        
        if (submitButton && submitButton.classList.contains('btn-loading')) {
            const originalText = submitButton.getAttribute('data-original-text') || 
                (formType === 'login' ? 'Login' : 'Sign Up');
            this.resetButtonState(submitButton, originalText);
        }
    }
}

// Initialize the auth process manager when the script loads
const authProcessManager = new AuthProcessManager();

// Export for use in app.js
window.authProcessManager = authProcessManager;

// Add global error handler to reset buttons on auth errors
window.addEventListener('authError', (event) => {
    if (authProcessManager) {
        authProcessManager.resetAuthButton('login');
        authProcessManager.resetAuthButton('signup');
    }
});