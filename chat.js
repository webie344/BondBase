// Firebase imports for theme functionality only
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
const auth = getAuth(app);
const db = getFirestore(app);

// Theme management class
class ChatThemeManager {
    constructor() {
        this.currentUser = null;
        this.currentTheme = 'default';
        this.init();
    }

    async init() {
        // Wait for auth state
        onAuthStateChanged(auth, (user) => {
            if (user) {
                this.currentUser = user;
                this.loadUserTheme();
            }
        });
    }

    // Load user's saved theme from Firebase
    async loadUserTheme() {
        if (!this.currentUser) return;

        try {
            const userRef = doc(db, 'users', this.currentUser.uid);
            const userSnap = await getDoc(userRef);
            
            if (userSnap.exists()) {
                const userData = userSnap.data();
                const savedTheme = userData.chatTheme || 'default';
                this.applyTheme(savedTheme);
            }
        } catch (error) {
            console.error('Error loading chat theme:', error);
        }
    }

    // Apply theme to the page
    applyTheme(theme) {
        this.currentTheme = theme;
        document.documentElement.setAttribute('data-theme', theme);
        
        // Dispatch custom event for other components to listen to
        window.dispatchEvent(new CustomEvent('themeChanged', { 
            detail: { theme: theme } 
        }));
    }

    // Save theme to Firebase
    async saveTheme(theme) {
        if (!this.currentUser) return false;

        try {
            const userRef = doc(db, 'users', this.currentUser.uid);
            await updateDoc(userRef, {
                chatTheme: theme,
                updatedAt: serverTimestamp()
            });
            
            this.applyTheme(theme);
            return true;
        } catch (error) {
            console.error('Error saving theme:', error);
            return false;
        }
    }

    // Get current theme
    getCurrentTheme() {
        return this.currentTheme;
    }

    // Get all available themes with BDSM aesthetic previews
    getAvailableThemes() {
        return [
            { 
                id: 'default', 
                name: 'Crimson Dark', 
                preview: 'linear-gradient(135deg, rgba(179, 0, 75, 0.9) 0%, rgba(139, 0, 0, 0.7) 100%)',
                messagePreview: 'linear-gradient(135deg, rgba(179, 0, 75, 0.9) 0%, rgba(122, 0, 52, 0.8) 100%)'
            },
            { 
                id: 'dark-steel', 
                name: 'Dark Steel', 
                preview: 'linear-gradient(135deg, rgba(179, 0, 75, 0.9) 0%, rgba(139, 0, 0, 0.7) 100%)',
                messagePreview: 'linear-gradient(135deg, rgba(179, 0, 75, 0.9) 0%, rgba(122, 0, 52, 0.8) 100%)'
            },
            { 
                id: 'leather-dark', 
                name: 'Leather Dark', 
                preview: 'linear-gradient(135deg, rgba(179, 0, 75, 0.9) 0%, rgba(101, 67, 33, 0.7) 100%)',
                messagePreview: 'linear-gradient(135deg, rgba(179, 0, 75, 0.9) 0%, rgba(122, 0, 52, 0.8) 100%)'
            },
            { 
                id: 'crimson-night', 
                name: 'Crimson Night', 
                preview: 'linear-gradient(135deg, rgba(179, 0, 75, 0.9) 0%, rgba(102, 0, 0, 0.7) 100%)',
                messagePreview: 'linear-gradient(135deg, rgba(179, 0, 75, 0.9) 0%, rgba(102, 0, 0, 0.8) 100%)'
            },
            { 
                id: 'metal-gray', 
                name: 'Metal Gray', 
                preview: 'linear-gradient(135deg, rgba(179, 0, 75, 0.9) 0%, rgba(68, 68, 68, 0.7) 100%)',
                messagePreview: 'linear-gradient(135deg, rgba(179, 0, 75, 0.9) 0%, rgba(46, 46, 46, 0.8) 100%)'
            },
            { 
                id: 'deep-violet', 
                name: 'Deep Violet', 
                preview: 'linear-gradient(135deg, rgba(179, 0, 75, 0.9) 0%, rgba(76, 29, 149, 0.7) 100%)',
                messagePreview: 'linear-gradient(135deg, rgba(179, 0, 75, 0.9) 0%, rgba(122, 0, 52, 0.8) 100%)'
            }
        ];
    }
}

// Initialize theme manager
const themeManager = new ChatThemeManager();

// Theme selector UI for account page
class ThemeSelectorUI {
    constructor() {
        this.themeManager = themeManager;
        this.init();
    }

    init() {
        // Only initialize if we're on the account page with display section
        if (this.isAccountPage()) {
            this.setupThemeSelector();
            this.loadCurrentThemeSelection();
            this.setupChatPreview();
        }
    }

    isAccountPage() {
        return window.location.pathname.includes('account.html');
    }

    setupThemeSelector() {
        const themesGrid = document.getElementById('themesGrid');
        if (!themesGrid) return;

        const themes = this.themeManager.getAvailableThemes();
        
        themesGrid.innerHTML = themes.map(theme => `
            <div class="theme-item" data-theme="${theme.id}">
                <div class="theme-preview" style="background: ${theme.preview}">
                    <div class="theme-preview-content">
                        <div class="theme-message-preview" style="background: ${theme.messagePreview}"></div>
                        <div class="theme-message-preview received" style="background: rgba(26, 26, 26, 0.95); border: 1px solid rgba(46, 46, 46, 0.6);"></div>
                    </div>
                </div>
                <div class="theme-label">${theme.name}</div>
            </div>
        `).join('');

        // Add click listeners
        themesGrid.addEventListener('click', (e) => {
            const themeItem = e.target.closest('.theme-item');
            if (themeItem) {
                const themeId = themeItem.dataset.theme;
                this.selectTheme(themeId);
            }
        });
    }

    setupChatPreview() {
        const chatPreview = document.getElementById('chatPreview');
        if (!chatPreview) return;

        // Create a more realistic chat preview with BDSM theme
        chatPreview.innerHTML = `
            <div class="chat-preview-container">
                <div class="chat-preview-header">
                    <div class="preview-partner-info">
                        <div class="preview-avatar"></div>
                        <div class="preview-details">
                            <div class="preview-name"></div>
                            <div class="preview-status"></div>
                        </div>
                    </div>
                </div>
                <div class="chat-preview-messages">
                    <div class="preview-message received">
                        <div class="preview-message-content">Hey there! How's your day going?</div>
                        <div class="preview-message-time">10:30 AM</div>
                    </div>
                    <div class="preview-message sent">
                        <div class="preview-message-content">It's going great! Just finished work 😊</div>
                        <div class="preview-message-time">10:31 AM</div>
                    </div>
                    <div class="preview-message received">
                        <div class="preview-message-content">That's awesome! Want to grab coffee later?</div>
                        <div class="preview-message-time">10:32 AM</div>
                    </div>
                </div>
                <div class="chat-preview-input">
                    <div class="preview-input-field"></div>
                    <div class="preview-send-btn"></div>
                </div>
            </div>
        `;
    }

    async selectTheme(themeId) {
        // Update UI
        this.updateThemeSelectionUI(themeId);
        
        // Update preview
        this.updateThemePreview(themeId);
        
        // Save to Firebase
        const success = await this.themeManager.saveTheme(themeId);
        
        if (success) {
            this.showNotification('Theme saved successfully!', 'success');
        } else {
            this.showNotification('Error saving theme', 'error');
            // Revert UI on error
            this.loadCurrentThemeSelection();
        }
    }

    updateThemeSelectionUI(selectedTheme) {
        const themeItems = document.querySelectorAll('.theme-item');
        themeItems.forEach(item => {
            const themePreview = item.querySelector('.theme-preview');
            themePreview.classList.remove('selected');
            
            if (item.dataset.theme === selectedTheme) {
                themePreview.classList.add('selected');
            }
        });
    }

    updateThemePreview(themeId) {
        const chatPreview = document.getElementById('chatPreview');
        if (chatPreview) {
            chatPreview.setAttribute('data-theme', themeId);
            
            // Update the preview messages with the new theme colors
            const sentMessages = chatPreview.querySelectorAll('.preview-message.sent');
            const theme = this.themeManager.getAvailableThemes().find(t => t.id === themeId);
            
            if (theme && sentMessages.length > 0) {
                sentMessages.forEach(message => {
                    message.style.background = theme.messagePreview;
                });
            }
        }
    }

    async loadCurrentThemeSelection() {
        await this.themeManager.loadUserTheme();
        const currentTheme = this.themeManager.getCurrentTheme();
        this.updateThemeSelectionUI(currentTheme);
        this.updateThemePreview(currentTheme);
    }

    showNotification(message, type) {
        // Use existing notification system or create a simple one
        if (typeof showNotification === 'function') {
            showNotification(message, type);
        } else {
            // Fallback notification with BDSM theme
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: ${type === 'success' ? 'rgba(179, 0, 75, 0.95)' : 'rgba(139, 0, 0, 0.95)'};
                color: white;
                padding: 15px 20px;
                border-radius: 8px;
                z-index: 10000;
                box-shadow: 0 4px 12px rgba(0,0,0,0.5);
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.2);
                font-weight: 500;
                font-family: 'Inter', sans-serif;
            `;
            notification.textContent = message;
            document.body.appendChild(notification);
            
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 3000);
        }
    }
}

// Add CSS for theme selector with BDSM styling
const addThemeSelectorStyles = () => {
    const styles = `
        .theme-item {
            cursor: pointer;
            transition: transform 0.3s ease;
        }

        .theme-item:hover {
            transform: translateY(-2px);
        }

        .theme-preview {
            width: 100%;
            height: 120px;
            border-radius: 12px;
            margin-bottom: 8px;
            border: 2px solid transparent;
            transition: all 0.3s ease;
            overflow: hidden;
            position: relative;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }

        .theme-preview.selected {
            border-color: rgba(179, 0, 75, 0.8);
            box-shadow: 0 6px 20px rgba(0,0,0,0.5);
        }

        .theme-preview-content {
            padding: 12px;
            height: 100%;
            display: flex;
            flex-direction: column;
            gap: 8px;
            justify-content: center;
        }

        .theme-message-preview {
            height: 24px;
            border-radius: 12px;
            opacity: 0.9;
            transition: all 0.3s ease;
        }

        .theme-message-preview.received {
            background: rgba(26, 26, 26, 0.95);
            border: 1px solid rgba(46, 46, 46, 0.6);
            margin-left: 20px;
        }

        .theme-label {
            text-align: center;
            font-weight: 600;
            color: rgba(255, 255, 255, 0.9);
            font-size: 14px;
            margin-top: 4px;
            font-family: 'Inter', sans-serif;
        }

        .chat-preview-container {
            height: 300px;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            background: var(--chat-background);
            border: 1px solid var(--border-color);
        }

        .chat-preview-header {
            padding: 12px;
            background: var(--background-color);
            border-bottom: 1px solid var(--border-color);
            backdrop-filter: blur(15px);
            -webkit-backdrop-filter: blur(15px);
        }

        .preview-partner-info {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .preview-avatar {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: var(--primary-color);
            opacity: 0.7;
        }

        .preview-details {
            flex: 1;
        }

        .preview-name {
            height: 12px;
            background: var(--text-color);
            border-radius: 6px;
            opacity: 0.8;
            margin-bottom: 4px;
        }

        .preview-status {
            height: 8px;
            background: var(--text-light);
            border-radius: 4px;
            opacity: 0.6;
            width: 60%;
        }

        .chat-preview-messages {
            padding: 12px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            height: 200px;
            overflow: hidden;
        }

        .preview-message {
            max-width: 70%;
            padding: 8px 12px;
            border-radius: 12px;
            font-size: 12px;
            line-height: 1.3;
            font-family: 'Inter', sans-serif;
        }

        .preview-message.received {
            align-self: flex-start;
            background: var(--message-received-bg);
            color: var(--message-received-text);
            border: 1px solid var(--border-color);
        }

        .preview-message.sent {
            align-self: flex-end;
            background: var(--message-sent-bg);
            color: var(--message-sent-text);
        }

        .preview-message-content {
            margin-bottom: 2px;
        }

        .preview-message-time {
            font-size: 9px;
            opacity: 0.7;
            text-align: right;
        }

        .preview-message.received .preview-message-time {
            text-align: left;
        }

        .chat-preview-input {
            padding: 12px;
            background: var(--input-background);
            border-top: 1px solid var(--border-color);
            display: flex;
            gap: 8px;
            align-items: center;
        }

        .preview-input-field {
            flex: 1;
            height: 32px;
            background: var(--input-background);
            border: 1px solid var(--border-color);
            border-radius: 16px;
        }

        .preview-send-btn {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: var(--primary-color);
        }

        /* BDSM Theme specific adjustments */
        [data-theme] .theme-label {
            color: var(--text-primary);
        }

        [data-theme] .theme-preview {
            box-shadow: var(--shadow);
        }

        [data-theme] .theme-preview.selected {
            box-shadow: var(--shadow-hover);
        }

        [data-theme] .chat-preview-container {
            box-shadow: var(--shadow-lg);
        }
    `;

    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
};

// Initialize theme selector UI
const themeSelectorUI = new ThemeSelectorUI();

// Add styles when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addThemeSelectorStyles);
} else {
    addThemeSelectorStyles();
}

// Auto-apply theme on chat pages
if (window.location.pathname.includes('chat.html')) {
    themeManager.loadUserTheme();
}

// Enhanced theme change listener for real-time updates
window.addEventListener('themeChanged', (event) => {
    const theme = event.detail.theme;
    
    // Update any dynamic elements that need theme awareness
    updateDynamicElementsForTheme(theme);
});

function updateDynamicElementsForTheme(theme) {
    // Update any dynamically created elements with the new theme
    const dynamicElements = document.querySelectorAll('[data-theme-aware]');
    dynamicElements.forEach(element => {
        element.setAttribute('data-theme', theme);
    });
    
    // If there's a chat interface, refresh message styling
    if (window.chatInterface) {
        window.chatInterface.refreshMessageStyles();
    }
}

// Export for global access
window.themeManager = themeManager;
window.themeSelectorUI = themeSelectorUI;

// Add helper function for chat interface integration
window.integrateThemeWithChat = function(chatInstance) {
    if (!chatInstance) return;
    
    // Store reference to chat interface
    window.chatInterface = chatInstance;
    
    // Add theme change listener to chat instance
    window.addEventListener('themeChanged', (event) => {
        if (chatInstance.refreshTheme) {
            chatInstance.refreshTheme(event.detail.theme);
        }
    });
    
    // Initialize with current theme
    if (chatInstance.refreshTheme) {
        chatInstance.refreshTheme(themeManager.getCurrentTheme());
    }
};