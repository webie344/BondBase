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
    apiKey: "AIzaSyC8_PEsfTOr-gJ8P1MoXobOAfqwTVqEZWo",
    authDomain: "usa-dating-23bc3.firebaseapp.com",
    projectId: "usa-dating-23bc3",
    storageBucket: "usa-dating-23bc3.firebasestorage.app",
    messagingSenderId: "423286263327",
    appId: "1:423286263327:web:17f0caf843dc349c144f2a"
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

    // Get all available themes (50 themes)
    getAvailableThemes() {
        return [
            // Default BDSM Dark Theme
            { 
                id: 'default', 
                name: 'Crimson Dark', 
                preview: 'linear-gradient(135deg, rgba(179, 0, 75, 0.9) 0%, rgba(139, 0, 0, 0.7) 100%)',
                messagePreview: 'linear-gradient(135deg, rgba(179, 0, 75, 0.9) 0%, rgba(122, 0, 52, 0.8) 100%)'
            },
            // Dark Themes (1-9)
            { 
                id: 'dark-steel', 
                name: 'Dark Steel', 
                preview: 'linear-gradient(135deg, #2c3e50 0%, #1a1a2e 100%)',
                messagePreview: 'linear-gradient(135deg, #4A6572 0%, #344955 100%)'
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
            },
            { 
                id: 'midnight-sapphire', 
                name: 'Midnight Sapphire', 
                preview: 'linear-gradient(135deg, #1E3A8A 0%, #0F172A 100%)',
                messagePreview: 'linear-gradient(135deg, #2563EB 0%, #1E40AF 100%)'
            },
            { 
                id: 'forest-deep', 
                name: 'Forest Deep', 
                preview: 'linear-gradient(135deg, #065F46 0%, #064E3B 100%)',
                messagePreview: 'linear-gradient(135deg, #10B981 0%, #059669 100%)'
            },
            { 
                id: 'amber-glow', 
                name: 'Amber Glow', 
                preview: 'linear-gradient(135deg, #B45309 0%, #92400E 100%)',
                messagePreview: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)'
            },
            { 
                id: 'obsidian-black', 
                name: 'Obsidian Black', 
                preview: 'linear-gradient(135deg, #111827 0%, #1F2937 100%)',
                messagePreview: 'linear-gradient(135deg, #374151 0%, #1F2937 100%)'
            },
            // Light Themes (10-18)
            { 
                id: 'sunlight-bliss', 
                name: 'Sunlight Bliss', 
                preview: 'linear-gradient(135deg, #FFD166 0%, #FFB347 100%)',
                messagePreview: 'linear-gradient(135deg, #FFD166 0%, #FFB347 100%)'
            },
            { 
                id: 'ocean-breeze', 
                name: 'Ocean Breeze', 
                preview: 'linear-gradient(135deg, #64B5F6 0%, #2196F3 100%)',
                messagePreview: 'linear-gradient(135deg, #64B5F6 0%, #2196F3 100%)'
            },
            { 
                id: 'lavender-dream', 
                name: 'Lavender Dream', 
                preview: 'linear-gradient(135deg, #BA68C8 0%, #9575CD 100%)',
                messagePreview: 'linear-gradient(135deg, #BA68C8 0%, #9575CD 100%)'
            },
            { 
                id: 'mint-fresh', 
                name: 'Mint Fresh', 
                preview: 'linear-gradient(135deg, #4ECDC4 0%, #26C6DA 100%)',
                messagePreview: 'linear-gradient(135deg, #4ECDC4 0%, #26C6DA 100%)'
            },
            { 
                id: 'peach-blossom', 
                name: 'Peach Blossom', 
                preview: 'linear-gradient(135deg, #FF8A80 0%, #FF7043 100%)',
                messagePreview: 'linear-gradient(135deg, #FF8A80 0%, #FF7043 100%)'
            },
            { 
                id: 'cotton-candy', 
                name: 'Cotton Candy', 
                preview: 'linear-gradient(135deg, #F48FB1 0%, #EC407A 100%)',
                messagePreview: 'linear-gradient(135deg, #F48FB1 0%, #EC407A 100%)'
            },
            { 
                id: 'vanilla-cream', 
                name: 'Vanilla Cream', 
                preview: 'linear-gradient(135deg, #D7CCC8 0%, #BCAAA4 100%)',
                messagePreview: 'linear-gradient(135deg, #D7CCC8 0%, #BCAAA4 100%)'
            },
            { 
                id: 'sky-blue', 
                name: 'Sky Blue', 
                preview: 'linear-gradient(135deg, #81D4FA 0%, #29B6F6 100%)',
                messagePreview: 'linear-gradient(135deg, #81D4FA 0%, #29B6F6 100%)'
            },
            { 
                id: 'lemon-zest', 
                name: 'Lemon Zest', 
                preview: 'linear-gradient(135deg, #FFF176 0%, #FFEE58 100%)',
                messagePreview: 'linear-gradient(135deg, #FFF176 0%, #FFEE58 100%)'
            },
            // Neon Themes (19-27)
            { 
                id: 'neon-purple', 
                name: 'Neon Purple', 
                preview: 'linear-gradient(135deg, #9D00FF 0%, #7200CA 100%)',
                messagePreview: 'linear-gradient(135deg, #9D00FF 0%, #7200CA 100%)'
            },
            { 
                id: 'neon-green', 
                name: 'Neon Green', 
                preview: 'linear-gradient(135deg, #00FF9D 0%, #00CC7A 100%)',
                messagePreview: 'linear-gradient(135deg, #00FF9D 0%, #00CC7A 100%)'
            },
            { 
                id: 'neon-pink', 
                name: 'Neon Pink', 
                preview: 'linear-gradient(135deg, #FF00FF 0%, #CC00CC 100%)',
                messagePreview: 'linear-gradient(135deg, #FF00FF 0%, #CC00CC 100%)'
            },
            { 
                id: 'neon-blue', 
                name: 'Neon Blue', 
                preview: 'linear-gradient(135deg, #0066FF 0%, #0047CC 100%)',
                messagePreview: 'linear-gradient(135deg, #0066FF 0%, #0047CC 100%)'
            },
            { 
                id: 'neon-orange', 
                name: 'Neon Orange', 
                preview: 'linear-gradient(135deg, #FF6600 0%, #CC5200 100%)',
                messagePreview: 'linear-gradient(135deg, #FF6600 0%, #CC5200 100%)'
            },
            { 
                id: 'neon-yellow', 
                name: 'Neon Yellow', 
                preview: 'linear-gradient(135deg, #FFFF00 0%, #CCCC00 100%)',
                messagePreview: 'linear-gradient(135deg, #FFFF00 0%, #CCCC00 100%)'
            },
            { 
                id: 'neon-red', 
                name: 'Neon Red', 
                preview: 'linear-gradient(135deg, #FF0000 0%, #CC0000 100%)',
                messagePreview: 'linear-gradient(135deg, #FF0000 0%, #CC0000 100%)'
            },
            { 
                id: 'neon-cyan', 
                name: 'Neon Cyan', 
                preview: 'linear-gradient(135deg, #00FFFF 0%, #00CCCC 100%)',
                messagePreview: 'linear-gradient(135deg, #00FFFF 0%, #00CCCC 100%)'
            },
            { 
                id: 'neon-rainbow', 
                name: 'Neon Rainbow', 
                preview: 'linear-gradient(135deg, #FF0080 0%, #8000FF 50%, #00FF80 100%)',
                messagePreview: 'linear-gradient(135deg, #FF0080 0%, #8000FF 50%, #00FF80 100%)'
            },
            // Nature Themes (28-36)
            { 
                id: 'forest-moss', 
                name: 'Forest Moss', 
                preview: 'linear-gradient(135deg, #4A7C59 0%, #3A6147 100%)',
                messagePreview: 'linear-gradient(135deg, #4A7C59 0%, #3A6147 100%)'
            },
            { 
                id: 'ocean-depths', 
                name: 'Ocean Depths', 
                preview: 'linear-gradient(135deg, #1A5F7A 0%, #144955 100%)',
                messagePreview: 'linear-gradient(135deg, #1A5F7A 0%, #144955 100%)'
            },
            { 
                id: 'desert-sand', 
                name: 'Desert Sand', 
                preview: 'linear-gradient(135deg, #D4A76A 0%, #C38D40 100%)',
                messagePreview: 'linear-gradient(135deg, #D4A76A 0%, #C38D40 100%)'
            },
            { 
                id: 'sunset-orange', 
                name: 'Sunset Orange', 
                preview: 'linear-gradient(135deg, #FF6B35 0%, #FF5733 100%)',
                messagePreview: 'linear-gradient(135deg, #FF6B35 0%, #FF5733 100%)'
            },
            { 
                id: 'mountain-gray', 
                name: 'Mountain Gray', 
                preview: 'linear-gradient(135deg, #6C757D 0%, #495057 100%)',
                messagePreview: 'linear-gradient(135deg, #6C757D 0%, #495057 100%)'
            },
            { 
                id: 'spring-blossom', 
                name: 'Spring Blossom', 
                preview: 'linear-gradient(135deg, #FF85A2 0%, #FF5C8D 100%)',
                messagePreview: 'linear-gradient(135deg, #FF85A2 0%, #FF5C8D 100%)'
            },
            { 
                id: 'tropical-lagoon', 
                name: 'Tropical Lagoon', 
                preview: 'linear-gradient(135deg, #00B4D8 0%, #0096C7 100%)',
                messagePreview: 'linear-gradient(135deg, #00B4D8 0%, #0096C7 100%)'
            },
            { 
                id: 'autumn-leaves', 
                name: 'Autumn Leaves', 
                preview: 'linear-gradient(135deg, #FF8C42 0%, #FF6B35 100%)',
                messagePreview: 'linear-gradient(135deg, #FF8C42 0%, #FF6B35 100%)'
            },
            { 
                id: 'winter-frost', 
                name: 'Winter Frost', 
                preview: 'linear-gradient(135deg, #A0E7FF 0%, #7BCDE8 100%)',
                messagePreview: 'linear-gradient(135deg, #A0E7FF 0%, #7BCDE8 100%)'
            },
            // Gradient Themes (37-45)
            { 
                id: 'purple-haze', 
                name: 'Purple Haze', 
                preview: 'linear-gradient(135deg, #8A2BE2 0%, #9932CC 50%, #8B008B 100%)',
                messagePreview: 'linear-gradient(135deg, #8A2BE2 0%, #9932CC 50%, #8B008B 100%)'
            },
            { 
                id: 'sunset-glow', 
                name: 'Sunset Glow', 
                preview: 'linear-gradient(135deg, #FF6B6B 0%, #FF8E53 50%, #FFD166 100%)',
                messagePreview: 'linear-gradient(135deg, #FF6B6B 0%, #FF8E53 50%, #FFD166 100%)'
            },
            { 
                id: 'ocean-wave', 
                name: 'Ocean Wave', 
                preview: 'linear-gradient(135deg, #4ECDC4 0%, #44A08D 50%, #093145 100%)',
                messagePreview: 'linear-gradient(135deg, #4ECDC4 0%, #44A08D 50%, #093145 100%)'
            },
            { 
                id: 'forest-mist', 
                name: 'Forest Mist', 
                preview: 'linear-gradient(135deg, #5CDB95 0%, #379683 50%, #05386B 100%)',
                messagePreview: 'linear-gradient(135deg, #5CDB95 0%, #379683 50%, #05386B 100%)'
            },
            { 
                id: 'fire-ember', 
                name: 'Fire Ember', 
                preview: 'linear-gradient(135deg, #FF5722 0%, #FF9800 50%, #FFC107 100%)',
                messagePreview: 'linear-gradient(135deg, #FF5722 0%, #FF9800 50%, #FFC107 100%)'
            },
            { 
                id: 'galaxy-night', 
                name: 'Galaxy Night', 
                preview: 'linear-gradient(135deg, #6A11CB 0%, #2575FC 50%, #02AAB0 100%)',
                messagePreview: 'linear-gradient(135deg, #6A11CB 0%, #2575FC 50%, #02AAB0 100%)'
            },
            { 
                id: 'cotton-candy-grad', 
                name: 'Cotton Candy Grad', 
                preview: 'linear-gradient(135deg, #FF9A9E 0%, #FAD0C4 50%, #FBC2EB 100%)',
                messagePreview: 'linear-gradient(135deg, #FF9A9E 0%, #FAD0C4 50%, #FBC2EB 100%)'
            },
            { 
                id: 'midnight-purple', 
                name: 'Midnight Purple', 
                preview: 'linear-gradient(135deg, #7B2CBF 0%, #9D4EDD 50%, #C77DFF 100%)',
                messagePreview: 'linear-gradient(135deg, #7B2CBF 0%, #9D4EDD 50%, #C77DFF 100%)'
            },
            { 
                id: 'aurora-borealis', 
                name: 'Aurora Borealis', 
                preview: 'linear-gradient(135deg, #00F5D4 0%, #00BBF9 50%, #9B5DE5 100%)',
                messagePreview: 'linear-gradient(135deg, #00F5D4 0%, #00BBF9 50%, #9B5DE5 100%)'
            },
            // Special Themes (46-50)
            { 
                id: 'golden-royal', 
                name: 'Golden Royal', 
                preview: 'linear-gradient(135deg, #FFD700 0%, #DAA520 100%)',
                messagePreview: 'linear-gradient(135deg, #FFD700 0%, #DAA520 100%)'
            },
            { 
                id: 'silver-modern', 
                name: 'Silver Modern', 
                preview: 'linear-gradient(135deg, #C0C0C0 0%, #A8A8A8 100%)',
                messagePreview: 'linear-gradient(135deg, #C0C0C0 0%, #A8A8A8 100%)'
            },
            { 
                id: 'rose-gold', 
                name: 'Rose Gold', 
                preview: 'linear-gradient(135deg, #E8B4BC 0%, #D9A6B3 100%)',
                messagePreview: 'linear-gradient(135deg, #E8B4BC 0%, #D9A6B3 100%)'
            },
            { 
                id: 'cyberpunk', 
                name: 'Cyberpunk', 
                preview: 'linear-gradient(135deg, #00FF9D 0%, #9D00FF 50%, #FF0080 100%)',
                messagePreview: 'linear-gradient(135deg, #00FF9D 0%, #9D00FF 50%, #FF0080 100%)'
            },
            { 
                id: 'vintage-paper', 
                name: 'Vintage Paper', 
                preview: 'linear-gradient(135deg, #F5E6CA 0%, #E8D8B6 100%)',
                messagePreview: 'linear-gradient(135deg, #F5E6CA 0%, #E8D8B6 100%)'
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
            this.setupSearchFilter();
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

    setupSearchFilter() {
        const searchInput = document.getElementById('themeSearch');
        if (!searchInput) return;

        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            this.filterThemes(searchTerm);
        });

        // Add category filter buttons if they exist
        const categoryButtons = document.querySelectorAll('.theme-category-btn');
        if (categoryButtons.length > 0) {
            categoryButtons.forEach(button => {
                button.addEventListener('click', (e) => {
                    const category = e.target.dataset.category;
                    this.filterByCategory(category);
                });
            });
        }
    }

    filterThemes(searchTerm) {
        const themeItems = document.querySelectorAll('.theme-item');
        themeItems.forEach(item => {
            const themeLabel = item.querySelector('.theme-label');
            const themeName = themeLabel.textContent.toLowerCase();
            
            if (searchTerm === '' || themeName.includes(searchTerm)) {
                item.style.display = 'block';
            } else {
                item.style.display = 'none';
            }
        });
    }

    filterByCategory(category) {
        const themeItems = document.querySelectorAll('.theme-item');
        const themes = this.themeManager.getAvailableThemes();
        
        themeItems.forEach((item, index) => {
            const theme = themes[index];
            let shouldShow = false;
            
            switch(category) {
                case 'dark':
                    shouldShow = theme.id.includes('dark') || 
                                 theme.id.includes('midnight') || 
                                 theme.id.includes('obsidian') ||
                                 theme.id === 'default' ||
                                 theme.id === 'metal-gray' ||
                                 theme.id === 'deep-violet' ||
                                 theme.id === 'forest-deep' ||
                                 theme.id === 'amber-glow' ||
                                 theme.id === 'neon-purple' ||
                                 theme.id === 'neon-pink' ||
                                 theme.id === 'neon-blue' ||
                                 theme.id === 'neon-red';
                    break;
                case 'light':
                    shouldShow = theme.id.includes('sunlight') || 
                                 theme.id.includes('ocean') ||
                                 theme.id.includes('lavender') ||
                                 theme.id.includes('mint') ||
                                 theme.id.includes('peach') ||
                                 theme.id.includes('cotton') ||
                                 theme.id.includes('vanilla') ||
                                 theme.id.includes('sky') ||
                                 theme.id.includes('lemon') ||
                                 theme.id === 'neon-green' ||
                                 theme.id === 'neon-yellow' ||
                                 theme.id === 'neon-cyan';
                    break;
                case 'nature':
                    shouldShow = theme.id.includes('forest') || 
                                 theme.id.includes('ocean-depths') ||
                                 theme.id.includes('desert') ||
                                 theme.id.includes('sunset-orange') ||
                                 theme.id.includes('mountain') ||
                                 theme.id.includes('spring') ||
                                 theme.id.includes('tropical') ||
                                 theme.id.includes('autumn') ||
                                 theme.id.includes('winter');
                    break;
                case 'gradient':
                    shouldShow = theme.id.includes('haze') || 
                                 theme.id.includes('glow') ||
                                 theme.id.includes('wave') ||
                                 theme.id.includes('mist') ||
                                 theme.id.includes('ember') ||
                                 theme.id.includes('galaxy') ||
                                 theme.id.includes('grad') ||
                                 theme.id.includes('midnight-purple') ||
                                 theme.id.includes('aurora') ||
                                 theme.id === 'neon-rainbow' ||
                                 theme.id === 'cyberpunk';
                    break;
                case 'special':
                    shouldShow = theme.id.includes('golden') || 
                                 theme.id.includes('silver') ||
                                 theme.id.includes('rose') ||
                                 theme.id.includes('cyberpunk') ||
                                 theme.id.includes('vintage');
                    break;
                default:
                    shouldShow = true;
            }
            
            item.style.display = shouldShow ? 'block' : 'none';
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

        /* Search and filter styles */
        .theme-search-container {
            margin-bottom: 20px;
        }

        .theme-search-input {
            width: 100%;
            padding: 12px 16px;
            border-radius: 8px;
            background: var(--input-background);
            border: 1px solid var(--border-color);
            color: var(--text-color);
            font-family: 'Inter', sans-serif;
            font-size: 14px;
        }

        .theme-search-input:focus {
            outline: none;
            border-color: var(--primary-color);
        }

        .theme-category-filter {
            display: flex;
            gap: 8px;
            margin-bottom: 20px;
            flex-wrap: wrap;
        }

        .theme-category-btn {
            padding: 8px 16px;
            background: var(--card-background);
            border: 1px solid var(--border-color);
            border-radius: 20px;
            color: var(--text-color);
            font-family: 'Inter', sans-serif;
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .theme-category-btn:hover {
            background: var(--primary-color);
            color: white;
        }

        .theme-category-btn.active {
            background: var(--primary-color);
            color: white;
            border-color: var(--primary-color);
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

        /* Grid layout for 50 themes */
        #themesGrid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
            gap: 16px;
            margin-bottom: 30px;
        }

        @media (max-width: 768px) {
            #themesGrid {
                grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
                gap: 12px;
            }
        }

        @media (max-width: 480px) {
            #themesGrid {
                grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
                gap: 10px;
            }
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
    
    // Refresh chat interface if exists
    if (window.chatInterface && window.chatInterface.refreshTheme) {
        window.chatInterface.refreshTheme(theme);
    }
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

// Quick theme switcher for development
window.switchTheme = function(themeId) {
    return themeManager.saveTheme(themeId);
};

// Get all themes for debugging
window.getAllThemes = function() {
    return themeManager.getAvailableThemes();
};

// Add category filter functionality
window.setupThemeCategories = function() {
    const categories = [
        { id: 'all', name: 'All Themes' },
        { id: 'dark', name: 'Dark Themes' },
        { id: 'light', name: 'Light Themes' },
        { id: 'nature', name: 'Nature Themes' },
        { id: 'gradient', name: 'Gradient Themes' },
        { id: 'special', name: 'Special Themes' }
    ];

    const container = document.querySelector('.theme-category-filter');
    if (!container) return;

    categories.forEach(category => {
        const button = document.createElement('button');
        button.className = 'theme-category-btn';
        button.dataset.category = category.id;
        button.textContent = category.name;
        
        button.addEventListener('click', function() {
            // Remove active class from all buttons
            document.querySelectorAll('.theme-category-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            
            // Add active class to clicked button
            this.classList.add('active');
            
            // Filter themes
            themeSelectorUI.filterByCategory(category.id);
        });
        
        container.appendChild(button);
    });

    // Set first button as active by default
    if (container.firstChild) {
        container.firstChild.classList.add('active');
    }
};

// Initialize categories when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.setupThemeCategories);
} else {
    window.setupThemeCategories();
}