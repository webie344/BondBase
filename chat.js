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
    apiKey: "AIzaSyC9jF-ocy6HjsVzWVVlAyXW-4aIFgA79-A",
    authDomain: "crypto-6517d.firebaseapp.com",
    projectId: "crypto-6517d",
    storageBucket: "crypto-6517d.firebasestorage.app",
    messagingSenderId: "60263975159",
    appId: "1:60263975159:web:bd53dcaad86d6ed9592bf2"
  };


// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ==================== XP RANK SYSTEM (Same as XP.js) ====================
const XP_RANKS = [];
// Generate 100 ranks with progressive XP requirements (EXACTLY from XP.js)
for (let i = 1; i <= 100; i++) {
    let xpNeeded = 0;
    let title = "";
    let icon = "";
    let color = "";
    
    // Calculate XP needed (progressive scaling)
    if (i === 1) {
        xpNeeded = 0;
    } else if (i <= 10) {
        xpNeeded = (i - 1) * 100;
    } else if (i <= 30) {
        xpNeeded = 900 + (i - 10) * 200;
    } else if (i <= 50) {
        xpNeeded = 4900 + (i - 30) * 500;
    } else if (i <= 75) {
        xpNeeded = 14900 + (i - 50) * 1000;
    } else {
        xpNeeded = 39900 + (i - 75) * 2000;
    }
    
    // Assign titles based on level ranges
    if (i === 1) {
        title = "Newbie Explorer";
        icon = "🌱";
        color = "#808080";
    } else if (i <= 5) {
        const titles = ["Apprentice Adventurer", "Journeyman Voyager", "Skilled Pathfinder", "Experienced Trailblazer", "Adept Wayfarer"];
        title = titles[i-2];
        icon = ["🎒", "🗺️", "🧭", "🔥", "⚔️"][i-2];
        color = ["#A0522D", "#4682B4", "#32CD32", "#FF4500", "#9370DB"][i-2];
    } else if (i <= 10) {
        const titles = ["Valiant Guardian", "Mystic Seeker", "Radiant Champion", "Celestial Wanderer", "Ethereal Sage"];
        title = titles[i-6];
        icon = ["🛡️", "🔮", "✨", "🌠", "🧙"][i-6];
        color = ["#FFD700", "#8A2BE2", "#FF69B4", "#00CED1", "#7CFC00"][i-6];
    } else if (i <= 20) {
        const titles = ["Ascended Hero", "Void Walker", "Starlight Sentinel", "Time Weaver", "Dream Shaper", 
                       "Reality Bender", "Cosmic Pioneer", "Quantum Knight", "Nova Warden", "Infinity Seeker"];
        title = titles[i-11];
        icon = ["🦸", "🌌", "⭐", "⏳", "💭", "🌀", "🚀", "⚡", "🌞", "♾️"][i-11];
        color = ["#FF6347", "#4B0082", "#FFD700", "#20B2AA", "#9370DB", "#FF1493", "#00BFFF", "#32CD32", "#FF8C00", "#8B0000"][i-11];
    } else if (i <= 30) {
        const titles = ["Arcane Master", "Celestial Emperor", "Void Emperor", "Time Lord", "Dream Emperor",
                       "Reality Emperor", "Cosmic Emperor", "Quantum Emperor", "Nova Emperor", "Infinity Emperor"];
        title = titles[i-21];
        icon = ["🧙‍♂️", "👑", "🌑", "⏰", "💤", "🌐", "🌌", "⚛️", "☀️", "∞"][i-21];
        color = ["#8B4513", "#FFD700", "#000000", "#808080", "#483D8B", "#2F4F4F", "#191970", "#006400", "#8B0000", "#4B0082"][i-21];
    } else if (i <= 40) {
        const titles = ["Mythic Legend", "Eternal Phoenix", "Dragon Sovereign", "Titan Slayer", "God Killer",
                       "Universe Creator", "Multiverse Traveler", "Omnipotent Being", "Absolute Ruler", "Supreme Deity"];
        title = titles[i-31];
        icon = ["🏛️", "🔥", "🐉", "⚔️", "☠️", "🌍", "🌌", "👁️", "⚖️", "👑"][i-31];
        color = ["#FF4500", "#FF8C00", "#DC143C", "#8B0000", "#2F4F4F", "#228B22", "#00008B", "#8B008B", "#B8860B", "#FFD700"][i-31];
    } else if (i <= 50) {
        const titles = ["Legendary Archon", "Mythic Overlord", "Eternal Champion", "Cosmic Sovereign", "Quantum God",
                       "Reality Architect", "Dream Weaver Prime", "Time Guardian Supreme", "Void Conqueror", "Infinity Master"];
        title = titles[i-41];
        icon = ["👑", "🏆", "🦸‍♂️", "🌠", "⚛️", "🏗️", "🕸️", "🕰️", "⚫", "♾️"][i-41];
        color = ["#C0C0C0", "#FFD700", "#FF6347", "#00CED1", "#32CD32", "#8A2BE2", "#FF69B4", "#808080", "#000000", "#4B0082"][i-41];
    } else if (i <= 60) {
        const titles = ["Transcendent Being", "Omniscient Oracle", "Unbound Spirit", "Ethereal Monarch", "Celestial God",
                       "Stellar Emperor", "Galactic Warlord", "Interdimensional Traveler", "Paradox Resolver", "Existence Shaper"];
        title = titles[i-51];
        icon = ["👁️", "🔮", "👻", "👑", "⭐", "👑", "⚔️", "🚪", "🔄", "✏️"][i-51];
        color = ["#8B008B", "#FF00FF", "#F0E68C", "#98FB98", "#FFD700", "#FF4500", "#DC143C", "#00BFFF", "#32CD32", "#8A2BE2"][i-51];
    } else if (i <= 70) {
        const titles = ["Reality Emperor", "Dream Lord", "Time Master", "Space Conqueror", "Quantum King",
                       "Cosmic Ruler", "Void Master", "Infinity Lord", "Eternal Being", "Absolute Power"];
        title = titles[i-61];
        icon = ["👑", "💭", "⏰", "🚀", "⚛️", "🌌", "⚫", "∞", "♾️", "💪"][i-61];
        color = ["#FF0000", "#9370DB", "#20B2AA", "#1E90FF", "#00FF00", "#00008B", "#000000", "#4B0082", "#8B0000", "#FFD700"][i-61];
    } else if (i <= 80) {
        const titles = ["Supreme Legend", "Mythic God", "Celestial King", "Starlight Emperor", "Galactic Ruler",
                       "Universe Master", "Multiverse God", "Omnipotent Ruler", "All-Powerful Being", "Ultimate Deity"];
        title = titles[i-71];
        icon = ["🏆", "👑", "👑", "⭐", "🌌", "🌍", "🌌", "👑", "💪", "👁️"][i-71];
        color = ["#FFD700", "#FF4500", "#00CED1", "#FFD700", "#00008B", "#228B22", "#4B0082", "#8B0000", "#DC143C", "#8B008B"][i-71];
    } else if (i <= 90) {
        const titles = ["God of Gods", "King of Kings", "Emperor of Emperors", "Master of Masters", "Ruler of Rulers",
                       "Lord of Lords", "Champion of Champions", "Hero of Heroes", "Legend of Legends", "Myth of Myths"];
        title = titles[i-81];
        icon = ["👑", "👑", "👑", "👑", "👑", "👑", "🏆", "🦸", "🏛️", "📜"][i-81];
        color = ["#FF0000", "#FF8C00", "#FFD700", "#32CD32", "#00CED1", "#1E90FF", "#9370DB", "#FF69B4", "#FF4500", "#8B0000"][i-81];
    } else {
        const titles = ["The Ultimate One", "The Final Boss", "The Alpha Omega", "The Beginning and End", 
                       "The All-Knowing", "The All-Seeing", "The All-Powerful", "The Eternal", "The Infinite", "The Absolute"];
        title = titles[i-91];
        icon = ["👁️", "🐲", "αΩ", "🔚", "🧠", "👀", "💪", "♾️", "∞", "⚫"][i-91];
        color = ["#FF00FF", "#DC143C", "#000000", "#FFFFFF", "#8A2BE2", "#00BFFF", "#FFD700", "#32CD32", "#4B0082", "#000000"][i-91];
    }
    
    XP_RANKS.push({
        level: i,
        title: title,
        xpNeeded: xpNeeded,
        icon: icon,
        color: color
    });
}

// XP System Integration
class XPThemeIntegration {
    constructor() {
        this.currentUser = null;
        this.userLevel = 1;
        this.xpData = null;
        this.themeUnlockRules = this.getThemeUnlockRules();
        this.init();
    }

    async init() {
        // Wait for auth state
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                this.currentUser = user;
                await this.loadUserXPData();
                // Dispatch event when XP data is loaded
                window.dispatchEvent(new CustomEvent('xpDataLoaded', {
                    detail: { userLevel: this.userLevel }
                }));
            }
        });
    }

    // Load user's XP data
    async loadUserXPData() {
        if (!this.currentUser) return;

        try {
            const xpRef = doc(db, 'xpData', this.currentUser.uid);
            const xpSnap = await getDoc(xpRef);
            
            if (xpSnap.exists()) {
                this.xpData = xpSnap.data();
                this.calculateUserLevel();
            } else {
                this.userLevel = 1;
            }
        } catch (error) {
            console.error('Error loading XP data:', error);
            this.userLevel = 1;
        }
    }

    // Calculate user level from XP (same logic as xp.js)
    calculateUserLevel() {
        if (!this.xpData) {
            this.userLevel = 1;
            return;
        }
        
        let currentLevel = 1;
        for (let i = XP_RANKS.length - 1; i >= 0; i--) {
            if (this.xpData.totalXP >= XP_RANKS[i].xpNeeded) {
                currentLevel = XP_RANKS[i].level;
                break;
            }
        }
        this.userLevel = currentLevel;
        console.log(`XP Theme Integration: User is level ${this.userLevel}`);
    }

    // Define which themes unlock at which levels - FIXED VERSION
    getThemeUnlockRules() {
        const rules = {};
        
        // Level 1: First 2 themes unlocked
        rules[1] = ['default', 'dark-steel'];
        
        // Level 2: Unlock 2 more themes
        rules[2] = ['leather-dark', 'crimson-night'];
        
        // Level 3: Unlock 2 more themes
        rules[3] = ['metal-gray', 'deep-violet'];
        
        // Level 4: Unlock 2 more themes
        rules[4] = ['midnight-sapphire', 'forest-deep'];
        
        // Level 5: Unlock 2 more themes
        rules[5] = ['amber-glow', 'obsidian-black'];
        
        // Level 6: Unlock 3 themes
        rules[6] = ['sunlight-bliss', 'ocean-breeze', 'lavender-dream'];
        
        // Level 7: Unlock 3 themes
        rules[7] = ['mint-fresh', 'peach-blossom', 'cotton-candy'];
        
        // Level 8: Unlock 3 themes
        rules[8] = ['vanilla-cream', 'sky-blue', 'lemon-zest'];
        
        // Level 9: Unlock 3 themes
        rules[9] = ['neon-purple', 'neon-green', 'neon-pink'];
        
        // Level 10: Unlock 3 themes
        rules[10] = ['neon-blue', 'neon-orange', 'neon-yellow'];
        
        // Level 11: Unlock 2 themes
        rules[11] = ['neon-red', 'neon-cyan'];
        
        // Level 12: Unlock 2 themes
        rules[12] = ['neon-rainbow', 'forest-moss'];
        
        // Level 13: Unlock 2 themes
        rules[13] = ['ocean-depths', 'desert-sand'];
        
        // Level 14: Unlock 2 themes
        rules[14] = ['sunset-orange', 'mountain-gray'];
        
        // Level 15: Unlock 2 themes
        rules[15] = ['spring-blossom', 'tropical-lagoon'];
        
        // Level 16: Unlock 2 themes
        rules[16] = ['autumn-leaves', 'winter-frost'];
        
        // Level 17: Unlock 2 themes
        rules[17] = ['purple-haze', 'sunset-glow'];
        
        // Level 18: Unlock 2 themes
        rules[18] = ['ocean-wave', 'forest-mist'];
        
        // Level 19: Unlock 2 themes
        rules[19] = ['fire-ember', 'galaxy-night'];
        
        // Level 20: Unlock 2 themes
        rules[20] = ['cotton-candy-grad', 'midnight-purple'];
        
        // Level 21: Unlock 1 theme
        rules[21] = ['aurora-borealis'];
        
        // Level 22: Unlock 1 theme
        rules[22] = ['golden-royal'];
        
        // Level 23: Unlock 1 theme
        rules[23] = ['silver-modern'];
        
        // Level 24: Unlock 1 theme
        rules[24] = ['rose-gold'];
        
        // Level 25: Unlock 1 theme
        rules[25] = ['cyberpunk'];
        
        // Level 26: Unlock 1 theme
        rules[26] = ['vintage-paper'];
        
        // Milestone levels - no new themes
        rules[30] = [];
        rules[40] = [];
        rules[50] = [];
        rules[75] = [];
        rules[100] = [];
        
        return rules;
    }

    // Get all themes unlocked up to current level - FIXED VERSION
    getAllUnlockedThemes() {
        const unlockedThemes = new Set();
        
        // Always include default theme
        unlockedThemes.add('default');
        
        // Add all themes from unlock rules up to current level
        for (let level = 1; level <= this.userLevel; level++) {
            const themesForLevel = this.themeUnlockRules[level] || [];
            themesForLevel.forEach(theme => unlockedThemes.add(theme));
        }
        
        return Array.from(unlockedThemes);
    }

    // Check if a specific theme is unlocked - FIXED VERSION
    isThemeUnlocked(themeId) {
        if (themeId === 'default') return true;
        
        // Check all levels up to current level
        for (let level = 1; level <= this.userLevel; level++) {
            const themesForLevel = this.themeUnlockRules[level] || [];
            if (themesForLevel.includes(themeId)) {
                return true;
            }
        }
        
        return false;
    }

    // Get required level for a theme - FIXED VERSION
    getRequiredLevelForTheme(themeId) {
        if (themeId === 'default') return 1;
        
        for (const [level, themes] of Object.entries(this.themeUnlockRules)) {
            if (themes.includes(themeId)) {
                return parseInt(level);
            }
        }
        
        return 100; // Default to max level if not found
    }

    // Get next theme unlock information - FIXED VERSION
    getNextThemeUnlock() {
        const nextLevel = this.userLevel + 1;
        
        if (nextLevel > 100) return null;
        
        const themesForNextLevel = this.themeUnlockRules[nextLevel] || [];
        
        if (themesForNextLevel.length > 0) {
            return {
                level: nextLevel,
                themes: themesForNextLevel,
                count: themesForNextLevel.length
            };
        }
        
        // Find next level that has themes
        for (let level = nextLevel + 1; level <= 100; level++) {
            const themes = this.themeUnlockRules[level] || [];
            if (themes.length > 0) {
                return {
                    level: level,
                    themes: themes,
                    count: themes.length
                };
            }
        }
        
        return null;
    }

    // Get current rank info
    getCurrentRankInfo() {
        return XP_RANKS[this.userLevel - 1] || XP_RANKS[0];
    }

    // Get themes that unlock at specific level
    getThemesForLevel(level) {
        return this.themeUnlockRules[level] || [];
    }

    // Refresh method to reload XP data
    async refresh() {
        await this.loadUserXPData();
    }
}

// Theme management class
class ChatThemeManager {
    constructor() {
        this.currentUser = null;
        this.currentTheme = 'default';
        this.xpIntegration = new XPThemeIntegration();
        this.init();
    }

    async init() {
        // Wait for auth state
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                this.currentUser = user;
                await this.loadUserTheme();
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
                
                // Check if saved theme is unlocked
                if (this.xpIntegration.isThemeUnlocked(savedTheme)) {
                    this.applyTheme(savedTheme);
                } else {
                    // Fallback to default if saved theme is locked
                    this.applyTheme('default');
                }
            }
        } catch (error) {
            console.error('Error loading chat theme:', error);
        }
    }

    // Apply theme to the page
    applyTheme(theme) {
        // Check if theme is unlocked
        if (!this.xpIntegration.isThemeUnlocked(theme)) {
            console.warn(`Theme ${theme} is locked! User level: ${this.xpIntegration.userLevel}, Required: ${this.xpIntegration.getRequiredLevelForTheme(theme)}`);
            this.showThemeLockedMessage(theme);
            return false;
        }

        this.currentTheme = theme;
        document.documentElement.setAttribute('data-theme', theme);
        
        // Dispatch custom event for other components to listen to
        window.dispatchEvent(new CustomEvent('themeChanged', { 
            detail: { theme: theme } 
        }));
        
        return true;
    }

    // Save theme to Firebase
    async saveTheme(theme) {
        if (!this.currentUser) return false;

        // Check if theme is unlocked
        if (!this.xpIntegration.isThemeUnlocked(theme)) {
            this.showThemeLockedMessage(theme);
            return false;
        }

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

    // Show theme locked message
    showThemeLockedMessage(themeId) {
        const requiredLevel = this.xpIntegration.getRequiredLevelForTheme(themeId);
        const currentLevel = this.xpIntegration.userLevel;
        const nextRank = XP_RANKS[requiredLevel - 1];
        const currentRank = XP_RANKS[currentLevel - 1];
        
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(179, 0, 75, 0.95);
            color: white;
            padding: 20px;
            border-radius: 12px;
            z-index: 10000;
            box-shadow: 0 8px 32px rgba(0,0,0,0.5);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            border: 2px solid rgba(255, 255, 255, 0.2);
            font-family: 'Inter', sans-serif;
            max-width: 350px;
            animation: slideIn 0.3s ease-out;
        `;
        
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                <div style="font-size: 24px;">🔒</div>
                <div style="font-weight: 600; font-size: 16px;">Theme Locked!</div>
            </div>
            <div style="font-size: 14px; margin-bottom: 16px; opacity: 0.9;">
                This theme requires Level ${requiredLevel} (${nextRank.title})
            </div>
            <div style="background: rgba(255,255,255,0.1); padding: 12px; border-radius: 8px; margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span style="font-size: 13px; opacity: 0.8;">Your Level:</span>
                    <span style="font-weight: 600; color: ${currentRank.color};">${currentLevel} (${currentRank.title})</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="font-size: 13px; opacity: 0.8;">Required Level:</span>
                    <span style="font-weight: 600; color: ${nextRank.color};">${requiredLevel} (${nextRank.title})</span>
                </div>
            </div>
            <div style="height: 8px; background: rgba(255,255,255,0.2); border-radius: 4px; overflow: hidden; margin-bottom: 8px;">
                <div style="height: 100%; background: ${currentLevel >= requiredLevel ? '#00FF9D' : 'rgba(255, 209, 102, 0.8)'}; width: ${Math.min(100, (currentLevel / requiredLevel) * 100)}%; transition: width 0.5s ease;"></div>
            </div>
            <div style="font-size: 12px; opacity: 0.8; text-align: center;">
                ${currentLevel >= requiredLevel ? '✓ Requirements met! You can select this theme.' : `Need ${requiredLevel - currentLevel} more level${requiredLevel - currentLevel === 1 ? '' : 's'} to unlock`}
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
        
        // Add animation style
        if (!document.getElementById('slideInAnimation')) {
            const style = document.createElement('style');
            style.id = 'slideInAnimation';
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }
    }

    // Get current theme
    getCurrentTheme() {
        return this.currentTheme;
    }

    // Get user's current level
    getUserLevel() {
        return this.xpIntegration.userLevel;
    }

    // Get all available themes with unlock status
    getAvailableThemes() {
        const themes = [
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

        // Add unlock status to each theme
        return themes.map(theme => ({
            ...theme,
            unlocked: this.xpIntegration.isThemeUnlocked(theme.id),
            requiredLevel: this.xpIntegration.getRequiredLevelForTheme(theme.id)
        }));
    }
}

// Initialize theme manager
const themeManager = new ChatThemeManager();

// Theme selector UI for account page
class ThemeSelectorUI {
    constructor() {
        this.themeManager = themeManager;
        this.isInitialized = false;
        this.init();
    }

    async init() {
        // Only initialize if we're on the account page with display section
        if (this.isAccountPage()) {
            console.log('Initializing ThemeSelectorUI on account page');
            
            // Wait for XP data to load before setting up
            window.addEventListener('xpDataLoaded', () => {
                console.log('XP data loaded, setting up theme selector');
                this.setupThemeSelector();
                this.loadCurrentThemeSelection();
                this.setupChatPreview();
                this.setupSearchFilter();
                this.setupLevelDisplay();
                this.isInitialized = true;
            });

            // Also set up with a timeout in case event doesn't fire
            setTimeout(() => {
                if (!this.isInitialized) {
                    console.log('Timeout fallback: Setting up theme selector');
                    this.setupThemeSelector();
                    this.loadCurrentThemeSelection();
                    this.setupChatPreview();
                    this.setupSearchFilter();
                    this.setupLevelDisplay();
                    this.isInitialized = true;
                }
            }, 2000);
        }
    }

    isAccountPage() {
        return window.location.pathname.includes('account.html');
    }

    setupLevelDisplay() {
        const levelDisplay = document.getElementById('userLevelDisplay');
        if (!levelDisplay) return;

        const level = this.themeManager.getUserLevel();
        const rankInfo = this.themeManager.xpIntegration.getCurrentRankInfo();
        const unlockedThemes = this.themeManager.xpIntegration.getAllUnlockedThemes();
        
        levelDisplay.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px; padding: 12px; background: rgba(179, 0, 75, 0.1); border-radius: 12px; border: 1px solid rgba(179, 0, 75, 0.3);">
                <div style="font-size: 24px;">${rankInfo.icon}</div>
                <div style="flex: 1;">
                    <div style="font-weight: 600; font-size: 14px; color: rgba(255, 255, 255, 0.9);">Level ${level} • ${rankInfo.title}</div>
                    <div style="font-size: 12px; color: rgba(255, 255, 255, 0.7);">Unlocked: <span style="font-weight: 600; color: #00FF9D;">${unlockedThemes.length}/50</span> themes</div>
                </div>
                <div style="font-size: 24px; color: ${rankInfo.color}; opacity: 0.8;">
                    ${rankInfo.icon}
                </div>
            </div>
        `;
    }

    setupThemeSelector() {
        const themesGrid = document.getElementById('themesGrid');
        if (!themesGrid) {
            console.error('themesGrid element not found!');
            return;
        }

        // Clear any existing content
        themesGrid.innerHTML = '';
        
        const themes = this.themeManager.getAvailableThemes();
        const userLevel = this.themeManager.getUserLevel();
        
        console.log(`Setting up theme selector. User Level: ${userLevel}`);
        console.log('Available themes:', themes.map(t => ({ id: t.id, unlocked: t.unlocked })));
        
        themes.forEach(theme => {
            const isUnlocked = this.themeManager.xpIntegration.isThemeUnlocked(theme.id);
            const requiredLevel = this.themeManager.xpIntegration.getRequiredLevelForTheme(theme.id);
            const isCurrentTheme = theme.id === this.themeManager.getCurrentTheme();
            
            console.log(`Theme: ${theme.id}, Unlocked: ${isUnlocked}, Required Level: ${requiredLevel}, Current: ${isCurrentTheme}`);
            
            const themeItem = document.createElement('div');
            themeItem.className = `theme-item ${isUnlocked ? '' : 'locked'}`;
            themeItem.dataset.theme = theme.id;
            themeItem.dataset.unlocked = isUnlocked;
            themeItem.dataset.requiredLevel = requiredLevel;
            
            themeItem.innerHTML = `
                <div class="theme-preview ${isCurrentTheme ? 'selected' : ''}" style="background: ${theme.preview}">
                    ${!isUnlocked ? `
                        <div class="theme-lock-overlay">
                            <div class="lock-icon">🔒</div>
                            <div class="lock-text">Level ${requiredLevel}</div>
                        </div>
                    ` : ''}
                    <div class="theme-preview-content ${!isUnlocked ? 'locked' : ''}">
                        <div class="theme-message-preview" style="background: ${theme.messagePreview}"></div>
                        <div class="theme-message-preview received" style="background: rgba(26, 26, 26, 0.95); border: 1px solid rgba(46, 46, 46, 0.6);"></div>
                    </div>
                </div>
                <div class="theme-label">
                    ${theme.name}
                    ${!isUnlocked ? `<div class="theme-required">Level ${requiredLevel}</div>` : ''}
                </div>
            `;
            
            themesGrid.appendChild(themeItem);
        });

        // Add click listeners
        themesGrid.addEventListener('click', (e) => {
            const themeItem = e.target.closest('.theme-item');
            if (themeItem) {
                const themeId = themeItem.dataset.theme;
                const isUnlocked = themeItem.dataset.unlocked === 'true';
                
                if (isUnlocked) {
                    this.selectTheme(themeId);
                } else {
                    const requiredLevel = parseInt(themeItem.dataset.requiredLevel);
                    this.showLockedThemePopup(themeId, requiredLevel);
                }
            }
        });
    }

    showLockedThemePopup(themeId, requiredLevel) {
        const theme = this.themeManager.getAvailableThemes().find(t => t.id === themeId);
        if (!theme) return;

        const currentLevel = this.themeManager.getUserLevel();
        const rankInfo = XP_RANKS[requiredLevel - 1];
        const currentRank = XP_RANKS[currentLevel - 1];
        const nextUnlock = this.themeManager.xpIntegration.getNextThemeUnlock();

        const popup = document.createElement('div');
        popup.className = 'theme-lock-popup';
        popup.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            animation: fadeIn 0.3s ease;
        `;

        popup.innerHTML = `
            <div style="background: var(--card-background); border-radius: 20px; padding: 30px; max-width: 500px; width: 90%; border: 2px solid var(--border-color); box-shadow: 0 20px 60px rgba(0,0,0,0.5);">
                <div style="display: flex; align-items: center; gap: 20px; margin-bottom: 25px;">
                    <div style="font-size: 40px; opacity: 0.8;">🔒</div>
                    <div>
                        <h3 style="margin: 0 0 8px 0; color: var(--text-color); font-size: 22px;">Theme Locked</h3>
                        <p style="margin: 0; color: var(--text-light); font-size: 14px;">"${theme.name}" requires Level ${requiredLevel}</p>
                    </div>
                </div>

                <div style="background: rgba(179, 0, 75, 0.1); border-radius: 12px; padding: 20px; margin-bottom: 25px; border: 1px solid rgba(179, 0, 75, 0.3);">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
                        <div>
                            <div style="font-size: 12px; color: var(--text-light); margin-bottom: 4px;">Your Level</div>
                            <div style="font-size: 24px; font-weight: 700; color: ${currentRank.color};">${currentLevel}</div>
                            <div style="font-size: 12px; color: var(--text-light);">${currentRank.title}</div>
                        </div>
                        <div style="display: flex; align-items: center; font-size: 24px; color: var(--text-light);">→</div>
                        <div>
                            <div style="font-size: 12px; color: var(--text-light); margin-bottom: 4px;">Required Level</div>
                            <div style="font-size: 24px; font-weight: 700; color: ${rankInfo.color};">${requiredLevel}</div>
                            <div style="font-size: 12px; color: var(--text-light);">${rankInfo.title}</div>
                        </div>
                    </div>
                    
                    <div style="height: 8px; background: var(--border-color); border-radius: 4px; overflow: hidden; margin-bottom: 8px;">
                        <div style="height: 100%; background: ${currentLevel >= requiredLevel ? '#00FF9D' : 'rgba(179, 0, 75, 0.8)'}; width: ${Math.min(100, (currentLevel / requiredLevel) * 100)}%; transition: width 0.5s ease;"></div>
                    </div>
                    <div style="font-size: 12px; color: var(--text-light); text-align: center;">
                        ${currentLevel >= requiredLevel ? '✓ Unlock requirement met! You can select this theme.' : `Need ${requiredLevel - currentLevel} more level${requiredLevel - currentLevel === 1 ? '' : 's'}`}
                    </div>
                </div>

                ${nextUnlock ? `
                    <div style="background: rgba(0, 255, 157, 0.1); border-radius: 12px; padding: 15px; margin-bottom: 20px; border: 1px solid rgba(0, 255, 157, 0.3);">
                        <div style="font-size: 12px; color: var(--text-light); margin-bottom: 8px;">Next Unlock at Level ${nextUnlock.level}</div>
                        <div style="font-size: 14px; color: #00FF9D; font-weight: 600;">
                            ${nextUnlock.count} new theme${nextUnlock.count === 1 ? '' : 's'} will be unlocked!
                        </div>
                    </div>
                ` : ''}

                <div style="display: flex; gap: 12px;">
                    <button class="close-popup-btn" style="
                        flex: 1;
                        padding: 14px;
                        background: transparent;
                        border: 2px solid var(--border-color);
                        border-radius: 12px;
                        color: var(--text-color);
                        font-family: 'Inter', sans-serif;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.3s ease;
                    ">Close</button>
                    ${currentLevel >= requiredLevel ? `
                    <button class="unlock-now-btn" style="
                        flex: 1;
                        padding: 14px;
                        background: rgba(0, 255, 157, 0.8);
                        border: none;
                        border-radius: 12px;
                        color: black;
                        font-family: 'Inter', sans-serif;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.3s ease;
                    ">Select Now</button>
                    ` : ''}
                </div>
            </div>
        `;

        document.body.appendChild(popup);

        // Add close button functionality
        popup.querySelector('.close-popup-btn').addEventListener('click', () => {
            popup.remove();
        });

        // Add unlock now button if requirements are met
        if (currentLevel >= requiredLevel) {
            popup.querySelector('.unlock-now-btn').addEventListener('click', () => {
                popup.remove();
                this.selectTheme(themeId);
            });
        }

        // Close on background click
        popup.addEventListener('click', (e) => {
            if (e.target === popup) {
                popup.remove();
            }
        });

        // Add animation style
        if (!document.getElementById('fadeInAnimation')) {
            const style = document.createElement('style');
            style.id = 'fadeInAnimation';
            style.textContent = `
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }
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
            if (!theme) {
                item.style.display = 'none';
                return;
            }
            
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
                case 'unlocked':
                    shouldShow = theme.unlocked;
                    break;
                case 'locked':
                    shouldShow = !theme.unlocked;
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
        console.log(`Attempting to select theme: ${themeId}`);
        
        // Check if theme is unlocked
        if (!this.themeManager.xpIntegration.isThemeUnlocked(themeId)) {
            console.log(`Theme ${themeId} is locked for user level ${this.themeManager.getUserLevel()}`);
            const requiredLevel = this.themeManager.xpIntegration.getRequiredLevelForTheme(themeId);
            this.showLockedThemePopup(themeId, requiredLevel);
            return;
        }

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
        if (typeof showNotification === 'function') {
            showNotification(message, type);
        } else {
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

    // Refresh method to update theme selector
    refresh() {
        if (this.isAccountPage()) {
            this.setupThemeSelector();
            this.setupLevelDisplay();
        }
    }
}

// Add CSS for theme selector with XP unlocking
const addThemeSelectorStyles = () => {
    const styles = `
        .theme-item {
            cursor: pointer;
            transition: transform 0.3s ease;
            position: relative;
        }

        .theme-item:hover {
            transform: translateY(-2px);
        }

        .theme-item.locked {
            cursor: not-allowed;
            opacity: 0.7;
        }

        .theme-item.locked:hover {
            transform: none;
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

        .theme-item.locked .theme-preview {
            filter: grayscale(0.5) brightness(0.6);
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

        .theme-preview-content.locked {
            filter: blur(1px);
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

        .theme-lock-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 2;
            backdrop-filter: blur(2px);
            -webkit-backdrop-filter: blur(2px);
        }

        .lock-icon {
            font-size: 32px;
            margin-bottom: 8px;
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
        }

        .lock-text {
            color: white;
            font-size: 12px;
            font-weight: 600;
            text-shadow: 0 2px 4px rgba(0,0,0,0.5);
            background: rgba(179, 0, 75, 0.8);
            padding: 4px 12px;
            border-radius: 12px;
        }

        .theme-label {
            text-align: center;
            font-weight: 600;
            color: rgba(255, 255, 255, 0.9);
            font-size: 14px;
            margin-top: 4px;
            font-family: 'Inter', sans-serif;
        }

        .theme-required {
            font-size: 11px;
            color: rgba(255, 255, 255, 0.6);
            margin-top: 2px;
            font-weight: 500;
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

        /* Level display styles */
        #userLevelDisplay {
            margin-bottom: 20px;
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

        /* Animation for slideIn */
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }

        /* Animation for fadeIn */
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
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
window.XP_RANKS = XP_RANKS; // Export XP ranks for other components

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

// Get user's unlocked themes
window.getUnlockedThemes = function() {
    return themeManager.xpIntegration.getAllUnlockedThemes();
};

// Get user's current level and rank
window.getUserRankInfo = function() {
    return {
        level: themeManager.getUserLevel(),
        rank: themeManager.xpIntegration.getCurrentRankInfo(),
        unlockedThemes: themeManager.xpIntegration.getAllUnlockedThemes().length,
        totalThemes: 50
    };
};

// Debug function to check theme unlock status
window.debugThemeUnlocks = function() {
    const level = themeManager.getUserLevel();
    const unlocked = themeManager.xpIntegration.getAllUnlockedThemes();
    
    console.log('=== DEBUG THEME UNLOCKS ===');
    console.log('User Level:', level);
    console.log('Unlocked Themes:', unlocked);
    console.log('Unlocked Count:', unlocked.length);
    
    // Check specific themes
    const testThemes = ['default', 'dark-steel', 'leather-dark', 'metal-gray'];
    testThemes.forEach(theme => {
        const unlocked = themeManager.xpIntegration.isThemeUnlocked(theme);
        const required = themeManager.xpIntegration.getRequiredLevelForTheme(theme);
        console.log(`${theme}: Unlocked=${unlocked}, Required Level=${required}`);
    });
    
    return {
        level: level,
        unlocked: unlocked,
        count: unlocked.length
    };
};

// Add category filter functionality
window.setupThemeCategories = function() {
    const categories = [
        { id: 'all', name: 'All Themes' },
        { id: 'unlocked', name: 'Unlocked' },
        { id: 'locked', name: 'Locked' },
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

// Test function to simulate level up
window.simulateLevelUp = function() {
    const currentLevel = themeManager.getUserLevel();
    const newLevel = Math.min(100, currentLevel + 1);
    
    console.log(`Simulating level up from ${currentLevel} to ${newLevel}`);
    
    // Update the user level
    themeManager.xpIntegration.userLevel = newLevel;
    
    // Refresh the theme selector
    if (themeSelectorUI.refresh) {
        themeSelectorUI.refresh();
    }
    
    return newLevel;
};

// Refresh themes function that can be called externally
window.refreshThemeSelector = function() {
    if (themeSelectorUI.refresh) {
        themeSelectorUI.refresh();
    }
};

// Listen for XP updates from other parts of the app
window.addEventListener('xpUpdated', async () => {
    console.log('XP updated event received, refreshing XP data');
    await themeManager.xpIntegration.refresh();
    if (themeSelectorUI.refresh) {
        themeSelectorUI.refresh();
    }
});