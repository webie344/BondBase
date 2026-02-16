// chat-customization.js - COMPLETE STANDALONE CHAT CUSTOMIZATION SYSTEM
import { 
    getFirestore, 
    doc, 
    setDoc, 
    getDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { 
    getAuth,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

class ChatCustomization {
    constructor() {
        this.firebaseUser = null;
        this.userCustomization = null;
        this.customizationCache = new Map();
        this.activeListeners = new Map();
        this.isInitialized = false;
        this.db = null;
        this.auth = null;
        this.app = null;
        
        // Firebase Configuration (same as group-chat.js)
        this.firebaseConfig = {
            apiKey: "AIzaSyC9jF-ocy6HjsVzWVVlAyXW-4aIFgA79-A",
            authDomain: "crypto-6517d.firebaseapp.com",
            projectId: "crypto-6517d",
            storageBucket: "crypto-6517d.firebasestorage.app",
            messagingSenderId: "60263975159",
            appId: "1:60263975159:web:bd53dcaad86d6ed9592bf2"
        };
        
        // Color options (15 visually appealing colors)
        this.colorOptions = [
            { name: 'Ocean Blue', value: '#2196F3', gradient: 'linear-gradient(135deg, #2196F3, #1976D2)' },
            { name: 'Emerald Green', value: '#4CAF50', gradient: 'linear-gradient(135deg, #4CAF50, #2E7D32)' },
            { name: 'Ruby Red', value: '#F44336', gradient: 'linear-gradient(135deg, #F44336, #C62828)' },
            { name: 'Amber Gold', value: '#FFC107', gradient: 'linear-gradient(135deg, #FFC107, #FF8F00)' },
            { name: 'Royal Purple', value: '#9C27B0', gradient: 'linear-gradient(135deg, #9C27B0, #6A1B9A)' },
            { name: 'Coral Pink', value: '#E91E63', gradient: 'linear-gradient(135deg, #E91E63, #AD1457)' },
            { name: 'Sky Cyan', value: '#00BCD4', gradient: 'linear-gradient(135deg, #00BCD4, #00838F)' },
            { name: 'Forest Teal', value: '#009688', gradient: 'linear-gradient(135deg, #009688, #00695C)' },
            { name: 'Sunset Orange', value: '#FF5722', gradient: 'linear-gradient(135deg, #FF5722, #D84315)' },
            { name: 'Lavender', value: '#9575CD', gradient: 'linear-gradient(135deg, #9575CD, #5E35B1)' },
            { name: 'Rose', value: '#EC407A', gradient: 'linear-gradient(135deg, #EC407A, #C2185B)' },
            { name: 'Turquoise', value: '#26A69A', gradient: 'linear-gradient(135deg, #26A69A, #00796B)' },
            { name: 'Sunflower', value: '#FFEB3B', gradient: 'linear-gradient(135deg, #FFEB3B, #F9A825)' },
            { name: 'Berry', value: '#8E24AA', gradient: 'linear-gradient(135deg, #8E24AA, #4A148C)' },
            { name: 'Mint', value: '#00E676', gradient: 'linear-gradient(135deg, #00E676, #00C853)' }
        ];

        // Font options
        this.fontOptions = [
            { name: 'Inter', value: 'Inter, sans-serif' },
            { name: 'Poppins', value: 'Poppins, sans-serif' },
            { name: 'Montserrat', value: 'Montserrat, sans-serif' },
            { name: 'Roboto Mono', value: 'Roboto Mono, monospace' },
            { name: 'Dancing Script', value: 'Dancing Script, cursive' }
        ];

        // GAMING TAGS - 50 Static + 50 Dynamic
        this.tags = {
            static: [
                // FPS Games
                { id: 'csgo', name: '🔫 CS:GO', icon: 'crosshairs' },
                { id: 'valorant', name: '💥 Valorant', icon: 'bolt' },
                { id: 'cod', name: '🎯 Call of Duty', icon: 'bullseye' },
                { id: 'apex', name: '👑 Apex Legends', icon: 'crown' },
                { id: 'overwatch', name: '🛡️ Overwatch', icon: 'shield-alt' },
                { id: 'rainbow6', name: '🔪 Rainbow Six', icon: 'user-secret' },
                { id: 'fortnite', name: '🪂 Fortnite', icon: 'parachute-box' },
                { id: 'pubg', name: '🎖️ PUBG', icon: 'medal' },
                { id: 'halo', name: '👾 Halo', icon: 'gamepad' },
                { id: 'doom', name: '😈 DOOM', icon: 'skull' },
                { id: 'warzone', name: '💣 Warzone', icon: 'bomb' },
                { id: 'pubgm', name: '📱 PUBG Mobile', icon: 'mobile' },
                { id: 'farlight', name: '🚀 Farlight', icon: 'rocket' },
                { id: 'destiny', name: '🌌 Destiny', icon: 'sun' },
                { id: 'battlefield', name: '⚔️ Battlefield', icon: 'fighter-jet' },
                
                // MOBA
                { id: 'lol', name: '⚔️ League', icon: 'swords' },
                { id: 'dota2', name: '🐉 Dota 2', icon: 'dragon' },
                { id: 'smite', name: '⚡ Smite', icon: 'lightning-bolt' },
                { id: 'heroes', name: '👤 Heroes', icon: 'users' },
                { id: 'wildrift', name: '📱 Wild Rift', icon: 'mobile-alt' },
                { id: 'mobilelegends', name: '📱 Mobile Legends', icon: 'mobile' },
                { id: 'arenaofvalor', name: '⚔️ Arena of Valor', icon: 'sword' },
                { id: 'paladins', name: '🎯 Paladins', icon: 'crosshairs' },
                { id: 'eternalreturn', name: '🌀 Eternal Return', icon: 'redo' },
                { id: 'pokemonunite', name: '⚡ Pokémon Unite', icon: 'bolt' },
                
                // RPG/MMO
                { id: 'wow', name: '🐉 WoW', icon: 'dragon' },
                { id: 'ffxiv', name: '🗡️ FFXIV', icon: 'sword' },
                { id: 'eso', name: '🧙 Elder Scrolls', icon: 'hat-wizard' },
                { id: 'gw2', name: '🏹 Guild Wars 2', icon: 'bow-arrow' },
                { id: 'blackdesert', name: '⚔️ BDO', icon: 'sword' },
                { id: 'lostark', name: '⚓ Lost Ark', icon: 'anchor' },
                { id: 'genshin', name: '🌌 Genshin', icon: 'star' },
                { id: 'diablo', name: '👿 Diablo', icon: 'fire' },
                { id: 'poe', name: '💀 Path of Exile', icon: 'skull-crossbones' },
                { id: 'warframe', name: '🛡️ Warframe', icon: 'shield' },
                { id: 'newworld', name: '🌍 New World', icon: 'globe-americas' },
                { id: 'toweroffantasy', name: '🗼 ToF', icon: 'tower' },
                { id: 'blueprotocol', name: '🔵 Blue Protocol', icon: 'gamepad' },
                { id: 'ffxi', name: '⚔️ FFXI', icon: 'sword' },
                { id: 'runescape', name: '🛡️ RuneScape', icon: 'shield' },
                
                // Survival/Crafting
                { id: 'minecraft', name: '⛏️ Minecraft', icon: 'hammer' },
                { id: 'rust', name: '🛠️ Rust', icon: 'tools' },
                { id: 'ark', name: '🦖 ARK', icon: 'dinosaur' },
                { id: 'conan', name: '👑 Conan Exiles', icon: 'crown' },
                { id: 'valheim', name: '⚔️ Valheim', icon: 'helmet-battle' },
                { id: '7days', name: '🧟 7 Days', icon: 'zombie' },
                { id: 'theforest', name: '🌲 The Forest', icon: 'tree' },
                { id: 'greenhell', name: '🌴 Green Hell', icon: 'leaf' },
                { id: 'subnautica', name: '🐠 Subnautica', icon: 'fish' },
                { id: 'raft', name: '🛟 Raft', icon: 'ship' }
            ],
            dynamic: [
                // Gaming Achievement Tags
                { id: 'headshot', name: '🎯 Headshot Master', icon: 'bullseye', animation: 'customization-pulse 1s infinite' },
                { id: 'victory', name: '🏆 Victory Royale', icon: 'trophy', animation: 'customization-spin 3s linear infinite' },
                { id: 'clutch', name: '🔥 Clutch King', icon: 'fire', animation: 'customization-fire 2s infinite' },
                { id: 'carry', name: '👑 Team Carry', icon: 'crown', animation: 'customization-float 2s infinite' },
                { id: 'mvp', name: '⭐ MVP', icon: 'star', animation: 'customization-spin 4s linear infinite' },
                { id: 'legend', name: '⚔️ Legend', icon: 'sword', animation: 'customization-swing 3s infinite' },
                { id: 'pro', name: '🎮 Pro Gamer', icon: 'gamepad', animation: 'customization-bounce 1s infinite' },
                { id: 'streamer', name: '📺 Streamer', icon: 'broadcast-tower', animation: 'customization-pulse 2s infinite' },
                { id: 'competitor', name: '🏅 Competitor', icon: 'medal', animation: 'customization-glow 2s infinite' },
                { id: 'champion', name: '🥇 Champion', icon: 'award', animation: 'customization-shine 3s infinite' },
                
                // Gameplay Style Tags
                { id: 'aggressive', name: '💢 Aggressive', icon: 'angry', animation: 'customization-shake 0.5s infinite' },
                { id: 'strategic', name: '🧠 Strategic', icon: 'brain', animation: 'customization-pulse 3s infinite' },
                { id: 'stealth', name: '👻 Stealth', icon: 'ghost', animation: 'customization-fade 2s infinite' },
                { id: 'support', name: '🛡️ Support', icon: 'shield', animation: 'customization-glow 2s infinite' },
                { id: 'sniper', name: '🎯 Sniper', icon: 'crosshairs', animation: 'customization-zoom 2s infinite' },
                { id: 'rusher', name: '⚡ Rusher', icon: 'bolt', animation: 'customization-flash 1s infinite' },
                { id: 'tank', name: '🛡️ Tank', icon: 'shield-alt', animation: 'customization-shake 2s infinite' },
                { id: 'healer', name: '💚 Healer', icon: 'heart', animation: 'customization-heartbeat 1s infinite' },
                { id: 'builder', name: '🏗️ Builder', icon: 'hard-hat', animation: 'customization-bounce 2s infinite' },
                { id: 'explorer', name: '🧭 Explorer', icon: 'compass', animation: 'customization-spin 4s linear infinite' },
                
                // Rank/Level Tags
                { id: 'grandmaster', name: '👑 Grandmaster', icon: 'crown', animation: 'customization-crown-glow 3s infinite' },
                { id: 'master', name: '⭐ Master', icon: 'star', animation: 'customization-twinkle 2s infinite' },
                { id: 'diamond', name: '💎 Diamond', icon: 'gem', animation: 'customization-sparkle 3s infinite' },
                { id: 'platinum', name: '🛡️ Platinum', icon: 'shield', animation: 'customization-metal-shine 2s infinite' },
                { id: 'gold', name: '🥇 Gold', icon: 'medal', animation: 'customization-gold-glow 3s infinite' },
                { id: 'silver', name: '🥈 Silver', icon: 'coins', animation: 'customization-silver-shine 2s infinite' },
                { id: 'bronze', name: '🥉 Bronze', icon: 'award', animation: 'customization-bronze-pulse 3s infinite' },
                { id: 'iron', name: '⚙️ Iron', icon: 'cog', animation: 'customization-rotate 4s linear infinite' },
                { id: 'unranked', name: '❓ Unranked', icon: 'question', animation: 'customization-fade 3s infinite' },
                { id: 'level100', name: '💯 Level 100', icon: 'chart-line', animation: 'customization-count-up 2s infinite' },
                
                // Game Genre Tags
                { id: 'fpspro', name: '🔫 FPS Pro', icon: 'crosshairs', animation: 'customization-target 2s infinite' },
                { id: 'mobaking', name: '⚔️ MOBA King', icon: 'swords', animation: 'customization-clash 3s infinite' },
                { id: 'rpglord', name: '🐉 RPG Lord', icon: 'dragon', animation: 'customization-dragon-breath 4s infinite' },
                { id: 'racerdrift', name: '🏎️ Racer', icon: 'car', animation: 'customization-drift 3s infinite' },
                { id: 'sportsstar', name: '🏀 Sports Star', icon: 'trophy', animation: 'customization-victory-spin 3s infinite' },
                { id: 'fighter', name: '👊 Fighter', icon: 'fist-raised', animation: 'customization-punch 1s infinite' },
                { id: 'survivalist', name: '🌲 Survivalist', icon: 'campground', animation: 'customization-campfire 2s infinite' },
                { id: 'strategist', name: '♟️ Strategist', icon: 'chess', animation: 'customization-chess-move 3s infinite' },
                { id: 'adventurer', name: '🗺️ Adventurer', icon: 'map', animation: 'customization-explore 4s infinite' },
                { id: 'collector', name: '📦 Collector', icon: 'box-open', animation: 'customization-collect 2s infinite' },
                
                // Gaming Platform Tags
                { id: 'pcgamer', name: '🖥️ PC Gamer', icon: 'desktop', animation: 'customization-pc-glitch 2s infinite' },
                { id: 'console', name: '🎮 Console', icon: 'gamepad', animation: 'customization-controller-vibrate 1s infinite' },
                { id: 'mobile', name: '📱 Mobile', icon: 'mobile-alt', animation: 'customization-phone-tilt 3s infinite' },
                { id: 'vr', name: '👓 VR', icon: 'vr-cardboard', animation: 'customization-vr-spin 4s infinite' },
                { id: 'crossplay', name: '🔄 Crossplay', icon: 'sync', animation: 'customization-rotate 3s linear infinite' },
                { id: 'cloud', name: '☁️ Cloud', icon: 'cloud', animation: 'customization-float 3s infinite' },
                { id: 'emulator', name: '🔄 Emulator', icon: 'redo', animation: 'customization-rewind 2s infinite' },
                { id: 'retro', name: '👾 Retro', icon: 'ghost', animation: 'customization-pixel 1s infinite' },
                { id: 'nextgen', name: '🚀 Next Gen', icon: 'rocket', animation: 'customization-launch 3s infinite' },
                { id: 'handheld', name: '🎮 Handheld', icon: 'gamepad', animation: 'customization-portable 2s infinite' },
                
                // Gaming Community Tags
                { id: 'clanleader', name: '👑 Clan Leader', icon: 'users-crown', animation: 'customization-lead 3s infinite' },
                { id: 'teammate', name: '🤝 Teammate', icon: 'handshake', animation: 'customization-shake-hands 2s infinite' },
                { id: 'mentor', name: '🧠 Mentor', icon: 'user-graduate', animation: 'customization-teach 3s infinite' },
                { id: 'newbie', name: '👶 Newbie', icon: 'baby', animation: 'customization-bounce 2s infinite' },
                { id: 'veteran', name: '🎖️ Veteran', icon: 'ribbon', animation: 'customization-salute 3s infinite' },
                { id: 'modder', name: '🔧 Modder', icon: 'tools', animation: 'customization-tool-spin 4s infinite' },
                { id: 'creator', name: '🎨 Creator', icon: 'paint-brush', animation: 'customization-paint 3s infinite' },
                { id: 'tester', name: '🧪 Tester', icon: 'flask', animation: 'customization-experiment 2s infinite' },
                { id: 'speedrunner', name: '⏱️ Speedrunner', icon: 'stopwatch', animation: 'customization-race 2s infinite' },
                { id: 'completionist', name: '✅ Completionist', icon: 'check-double', animation: 'customization-check-pulse 3s infinite' }
            ]
        };

        this.defaultCustomization = {
            nameColor: '#2196F3',
            nameFont: 'Inter, sans-serif',
            selectedTags: [],
            lastUpdated: null
        };

        // Setup animations and initialization
        this.setupCustomizationCSS();
        this.init();
    }

    async init() {
        console.log('Chat Customization initializing...');
        
        try {
            // Initialize Firebase independently
            this.initializeFirebase();
            this.isInitialized = true;
            console.log('Chat Customization initialized successfully');
            
            // Setup auth state listener
            this.setupAuthListener();
            
        } catch (error) {
            console.error('Failed to initialize Chat Customization:', error);
            this.showToast('Failed to initialize. Please refresh the page.', 'error');
        }
    }

    initializeFirebase() {
        console.log('Initializing Firebase for Chat Customization...');
        
        try {
            // Check if Firebase is already initialized (by group-chat.js)
            // If it is, we'll try to get the existing app
            let existingApp;
            try {
                // Try to get default app
                existingApp = initializeApp(this.firebaseConfig);
                console.log('Created new Firebase app for Chat Customization');
            } catch (error) {
                if (error.code === 'app/duplicate-app') {
                    // App already exists, use a named app
                    existingApp = initializeApp(this.firebaseConfig, 'ChatCustomization');
                    console.log('Using named Firebase app for Chat Customization');
                } else {
                    throw error;
                }
            }
            
            this.app = existingApp;
            this.auth = getAuth(this.app);
            this.db = getFirestore(this.app);
            
            console.log('Firebase services initialized successfully');
            
        } catch (error) {
            console.error('Firebase initialization error:', error);
            throw error;
        }
    }

    setupAuthListener() {
        console.log('Setting up auth listener...');
        
        onAuthStateChanged(this.auth, async (user) => {
            if (user) {
                console.log('User authenticated in chat customization:', user.uid, user.displayName || user.email);
                this.firebaseUser = user;
                await this.loadUserCustomization();
                
                // Auto-init UI if on customization page
                if (window.location.pathname.includes('customization.html')) {
                    console.log('On customization page, initializing UI...');
                    this.initCustomizationUI();
                }
                
                // Auto-init chat integration if on group page
                if (window.location.pathname.includes('group.html')) {
                    console.log('On group page, initializing chat integration...');
                    setTimeout(() => this.initChatIntegration(), 2000);
                }
                
                // Auto-init user profile display
                if (window.location.pathname.includes('user.html') || 
                    window.location.pathname.includes('profile.html')) {
                    console.log('On user/profile page, initializing display...');
                    setTimeout(() => this.initUserProfileDisplay(), 1000);
                }
            } else {
                console.log('User not authenticated in chat customization');
                this.firebaseUser = null;
                this.userCustomization = null;
                
                // Show login prompt on customization page
                if (window.location.pathname.includes('customization.html')) {
                    this.showLoginPrompt();
                }
                
                // Redirect to login if trying to access protected page
                const protectedPages = ['customization'];
                const currentPage = window.location.pathname.split('/').pop().split('.')[0];
                
                if (protectedPages.includes(currentPage)) {
                    window.location.href = 'login.html';
                }
            }
        });
    }

    showLoginPrompt() {
        const container = document.querySelector('.customization-container') || document.getElementById('customizationContainer');
        if (container) {
            container.innerHTML = `
                <div class="login-prompt" style="text-align: center; padding: 50px;">
                    <i class="fas fa-user-lock" style="font-size: 4rem; color: #666; margin-bottom: 20px;"></i>
                    <h2>Sign In Required</h2>
                    <p style="margin: 20px 0; color: #888;">Please sign in to customize your gaming profile</p>
                    <button id="goToLoginBtn" style="background: #2196F3; color: white; border: none; padding: 12px 24px; 
                            border-radius: 8px; font-size: 16px; cursor: pointer;">
                        <i class="fas fa-sign-in-alt"></i> Go to Sign In
                    </button>
                </div>
            `;
            
            document.getElementById('goToLoginBtn')?.addEventListener('click', () => {
                window.location.href = 'login.html';
            });
        }
    }

    async loadUserCustomization() {
        try {
            if (!this.firebaseUser) {
                console.log('No firebase user, skipping customization load');
                return;
            }
            
            console.log('Loading customization for user:', this.firebaseUser.uid);
            
            const cacheKey = `customization_${this.firebaseUser.uid}`;
            const cached = this.customizationCache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < 300000) {
                this.userCustomization = cached.data;
                console.log('Loaded from cache:', this.userCustomization);
                return;
            }

            const userRef = doc(this.db, 'group_users', this.firebaseUser.uid);
            console.log('Fetching from Firestore...');
            const userSnap = await getDoc(userRef);
            
            if (userSnap.exists()) {
                const userData = userSnap.data();
                this.userCustomization = userData.customization || { ...this.defaultCustomization };
                console.log('Loaded from Firestore:', this.userCustomization);
                
                this.customizationCache.set(cacheKey, {
                    data: this.userCustomization,
                    timestamp: Date.now()
                });
            } else {
                this.userCustomization = { ...this.defaultCustomization };
                console.log('No user data, using default');
            }
            
        } catch (error) {
            console.error('Error loading user customization:', error);
            this.userCustomization = { ...this.defaultCustomization };
        }
    }

    async saveUserCustomization(customization) {
        try {
            if (!this.firebaseUser) {
                throw new Error('User not authenticated');
            }
            
            console.log('Saving customization:', customization);
            
            const userRef = doc(this.db, 'group_users', this.firebaseUser.uid);
            const userSnap = await getDoc(userRef);
            
            const customizationData = {
                ...customization,
                lastUpdated: new Date()
            };
            
            if (userSnap.exists()) {
                await updateDoc(userRef, {
                    'customization': customizationData,
                    'updatedAt': new Date()
                });
                console.log('Updated existing user');
            } else {
                await setDoc(userRef, {
                    uid: this.firebaseUser.uid,
                    displayName: this.firebaseUser.displayName || 'Anonymous',
                    email: this.firebaseUser.email || '',
                    customization: customizationData,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
                console.log('Created new user with customization');
            }
            
            this.userCustomization = customizationData;
            
            // Clear cache
            const cacheKey = `customization_${this.firebaseUser.uid}`;
            this.customizationCache.delete(cacheKey);
            
            console.log('Customization saved successfully');
            return true;
        } catch (error) {
            console.error('Error saving user customization:', error);
            throw error;
        }
    }

    async getUserCustomization(userId) {
        try {
            if (!userId) {
                console.log('No userId provided, returning default');
                return { ...this.defaultCustomization };
            }
            
            const cacheKey = `customization_${userId}`;
            const cached = this.customizationCache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < 300000) {
                return cached.data;
            }

            const userRef = doc(this.db, 'group_users', userId);
            const userSnap = await getDoc(userRef);
            
            if (userSnap.exists()) {
                const userData = userSnap.data();
                const customization = userData.customization || { ...this.defaultCustomization };
                
                this.customizationCache.set(cacheKey, {
                    data: customization,
                    timestamp: Date.now()
                });
                
                return customization;
            }
            
            return { ...this.defaultCustomization };
        } catch (error) {
            console.error('Error getting user customization:', error);
            return { ...this.defaultCustomization };
        }
    }

    // INITIALIZE CUSTOMIZATION PAGE UI
    initCustomizationUI() {
        console.log('Initializing customization UI...');
        
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            console.log('DOM loading, waiting...');
            document.addEventListener('DOMContentLoaded', () => {
                this.setupCustomizationUI();
            });
        } else {
            console.log('DOM already loaded, setting up UI');
            this.setupCustomizationUI();
        }
    }

    setupCustomizationUI() {
        console.log('Setting up customization UI...');
        
        // Check if required elements exist
        if (!document.getElementById('colorOptions') && !document.getElementById('customizationContainer')) {
            console.error('Required customization elements not found');
            setTimeout(() => this.setupCustomizationUI(), 500);
            return;
        }
        
        // If we're in a dedicated customization page
        if (document.getElementById('colorOptions')) {
            // Render color options
            this.renderColorOptions();
            
            // Render font options
            this.renderFontOptions();
            
            // Render tags
            this.renderTags();
            
            // Update preview
            this.updatePreview();
            
            // Setup event listeners
            this.setupEventListeners();
        }
        
        // If we're in a user profile page, show customization display
        this.initUserProfileDisplay();
        
        console.log('Customization UI setup complete');
    }

    renderColorOptions() {
        const container = document.getElementById('colorOptions');
        if (!container) {
            console.error('Color options container not found');
            return;
        }
        
        console.log('Rendering color options...');
        container.innerHTML = '';
        
        this.colorOptions.forEach(color => {
            const div = document.createElement('div');
            div.className = 'color-option';
            div.style.background = color.gradient;
            div.title = color.name;
            div.dataset.value = color.value;
            
            if (this.userCustomization?.nameColor === color.value) {
                div.classList.add('selected');
            }
            
            div.addEventListener('click', () => {
                console.log('Color selected:', color.value);
                document.querySelectorAll('.color-option').forEach(opt => {
                    opt.classList.remove('selected');
                });
                div.classList.add('selected');
                this.userCustomization.nameColor = color.value;
                this.updatePreview();
            });
            
            container.appendChild(div);
        });
        
        console.log(`Rendered ${this.colorOptions.length} color options`);
    }

    renderFontOptions() {
        const container = document.getElementById('fontOptions');
        if (!container) {
            console.error('Font options container not found');
            return;
        }
        
        console.log('Rendering font options...');
        container.innerHTML = '';
        
        this.fontOptions.forEach(font => {
            const div = document.createElement('div');
            div.className = 'font-option';
            div.dataset.value = font.value;
            
            if (this.userCustomization?.nameFont === font.value) {
                div.classList.add('selected');
            }
            
            div.innerHTML = `
                <div class="font-preview" style="font-family: ${font.value}">Aa</div>
                <div class="font-name">${font.name}</div>
            `;
            
            div.addEventListener('click', () => {
                console.log('Font selected:', font.value);
                document.querySelectorAll('.font-option').forEach(opt => {
                    opt.classList.remove('selected');
                });
                div.classList.add('selected');
                this.userCustomization.nameFont = font.value;
                this.updatePreview();
            });
            
            container.appendChild(div);
        });
        
        console.log(`Rendered ${this.fontOptions.length} font options`);
    }

    renderTags() {
        const container = document.getElementById('tagsContainer');
        if (!container) {
            console.error('Tags container not found');
            return;
        }
        
        console.log('Rendering tags...');
        container.innerHTML = '';
        
        // Static tags
        const staticDiv = document.createElement('div');
        staticDiv.className = 'tag-category';
        staticDiv.innerHTML = '<h3><i class="fas fa-gamepad"></i> Game Tags</h3>';
        
        this.tags.static.forEach(tag => {
            staticDiv.appendChild(this.createTagElement(tag, 'static'));
        });
        container.appendChild(staticDiv);

        // Dynamic tags
        const dynamicDiv = document.createElement('div');
        dynamicDiv.className = 'tag-category';
        dynamicDiv.innerHTML = '<h3><i class="fas fa-bolt"></i> Animated Achievement Badges</h3>';
        
        this.tags.dynamic.forEach(tag => {
            dynamicDiv.appendChild(this.createTagElement(tag, 'dynamic'));
        });
        container.appendChild(dynamicDiv);
        
        console.log(`Rendered ${this.tags.static.length} static and ${this.tags.dynamic.length} dynamic tags`);
    }

    createTagElement(tag, type) {
        const div = document.createElement('div');
        div.className = `tag ${type}`;
        if (type === 'dynamic') {
            div.classList.add('dynamic-tag');
        }
        div.dataset.id = tag.id;
        
        const isSelected = this.userCustomization?.selectedTags?.includes(tag.id);
        if (isSelected) {
            div.classList.add('selected');
        }
        
        div.innerHTML = `
            <i class="fas fa-${tag.icon} tag-icon"></i>
            <span>${tag.name}</span>
        `;
        
        div.addEventListener('click', () => {
            const selectedCount = document.querySelectorAll('.tag.selected').length;
            if (!div.classList.contains('selected') && selectedCount >= 5) {
                this.showToast('Maximum 5 tags allowed', 'warning');
                return;
            }
            
            div.classList.toggle('selected');
            this.updateSelectedTags();
        });
        
        return div;
    }

    updateSelectedTags() {
        if (!this.userCustomization) return;
        
        const selectedTags = [];
        document.querySelectorAll('.tag.selected').forEach(tag => {
            selectedTags.push(tag.dataset.id);
        });
        
        this.userCustomization.selectedTags = selectedTags;
        console.log('Selected tags updated:', selectedTags);
        this.updatePreview();
    }

    updatePreview() {
        const previewHeader = document.getElementById('previewHeader');
        if (!previewHeader || !this.userCustomization) {
            console.error('Preview header not found or no customization');
            return;
        }
        
        const { nameColor, nameFont, selectedTags } = this.userCustomization;
        console.log('Updating preview with:', { nameColor, nameFont, selectedTags });
        
        const nameEl = document.createElement('span');
        nameEl.className = 'preview-name';
        nameEl.style.color = nameColor;
        nameEl.style.fontFamily = nameFont;
        nameEl.textContent = this.firebaseUser?.displayName || this.firebaseUser?.email?.split('@')[0] || 'ProGamer';
        
        const tagsContainer = document.createElement('div');
        tagsContainer.style.display = 'flex';
        tagsContainer.style.gap = '8px';
        tagsContainer.style.flexWrap = 'wrap';
        tagsContainer.style.alignItems = 'center';
        
        // FIXED: Show only 2 badges max in preview
        selectedTags.slice(0, 2).forEach(tagId => {
            const tag = this.getTagInfo(tagId);
            if (tag) {
                const tagEl = document.createElement('span');
                tagEl.className = 'preview-tag';
                
                const isDynamic = this.tags.dynamic.some(t => t.id === tagId);
                if (isDynamic && tag.animation) {
                    tagEl.style.animation = tag.animation;
                }
                
                tagEl.innerHTML = `
                    <i class="fas fa-${tag.icon}"></i>
                    <span>${tag.name.split(' ')[1] || tag.name}</span>
                `;
                tagsContainer.appendChild(tagEl);
            }
        });
        
        previewHeader.innerHTML = '';
        previewHeader.appendChild(nameEl);
        if (selectedTags.length > 0) {
            previewHeader.appendChild(tagsContainer);
        }
    }

    setupEventListeners() {
        console.log('Setting up event listeners...');
        
        // Save button
        const saveBtn = document.getElementById('saveBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                if (!this.userCustomization || !this.firebaseUser) {
                    this.showToast('Please sign in first', 'error');
                    return;
                }
                
                const originalText = saveBtn.innerHTML;
                saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
                saveBtn.disabled = true;
                
                try {
                    await this.saveUserCustomization(this.userCustomization);
                    this.showToast('Gaming style saved successfully!');
                    
                    // Clear cache in group chat if it exists
                    if (window.groupChat && window.groupChat.cache) {
                        window.groupChat.cache.userProfiles?.clear();
                    }
                    
                    // Trigger re-application of customizations
                    if (window.location.pathname.includes('group.html')) {
                        setTimeout(() => {
                            this.applyToExistingMessages();
                        }, 1000);
                    }
                } catch (error) {
                    console.error('Save error:', error);
                    this.showToast('Error saving. Please try again.', 'error');
                } finally {
                    saveBtn.innerHTML = originalText;
                    saveBtn.disabled = false;
                }
            });
        } else {
            console.error('Save button not found');
        }

        // Reset button
        const resetBtn = document.getElementById('resetBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                if (confirm('Reset all customization to default gaming style?')) {
                    this.userCustomization = { ...this.defaultCustomization };
                    this.updatePreview();
                    
                    document.querySelectorAll('.color-option').forEach(opt => {
                        opt.classList.remove('selected');
                        if (opt.dataset.value === this.defaultCustomization.nameColor) {
                            opt.classList.add('selected');
                        }
                    });
                    
                    document.querySelectorAll('.font-option').forEach(opt => {
                        opt.classList.remove('selected');
                        if (opt.dataset.value === this.defaultCustomization.nameFont) {
                            opt.classList.add('selected');
                        }
                    });
                    
                    document.querySelectorAll('.tag.selected').forEach(tag => {
                        tag.classList.remove('selected');
                    });
                    
                    this.showToast('Reset to default gaming style');
                }
            });
        } else {
            console.error('Reset button not found');
        }
    }

    getTagInfo(tagId) {
        const staticTag = this.tags.static.find(t => t.id === tagId);
        if (staticTag) return staticTag;
        
        const dynamicTag = this.tags.dynamic.find(t => t.id === tagId);
        if (dynamicTag) return dynamicTag;
        
        return null;
    }

    showToast(message, type = 'success') {
        // Create toast if it doesn't exist
        let toast = document.getElementById('customizationToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'customizationToast';
            toast.className = 'customization-toast';
            toast.innerHTML = `
                <i class="fas ${type === 'success' ? 'fa-check-circle' : 
                               type === 'warning' ? 'fa-exclamation-triangle' : 
                               'fa-exclamation-circle'}"></i>
                <span id="customizationToastMessage">${message}</span>
            `;
            document.body.appendChild(toast);
        } else {
            const toastMsg = toast.querySelector('#customizationToastMessage');
            const icon = toast.querySelector('i');
            if (toastMsg) toastMsg.textContent = message;
            if (icon) {
                icon.className = `fas ${type === 'success' ? 'fa-check-circle' : 
                                         type === 'warning' ? 'fa-exclamation-triangle' : 
                                         'fa-exclamation-circle'}`;
            }
        }
        
        toast.classList.remove('show', 'success', 'warning', 'error');
        toast.classList.add('show', type);
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    setupCustomizationCSS() {
        if (!document.getElementById('customization-styles')) {
            const style = document.createElement('style');
            style.id = 'customization-styles';
            style.textContent = `
                /* Chat Customization Styles */
                .customization-container {
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 20px;
                }
                
                .customization-section {
                    background: white;
                    border-radius: 12px;
                    padding: 20px;
                    margin-bottom: 20px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }
                
                .customization-section h2 {
                    margin: 0 0 20px 0;
                    color: #333;
                    font-size: 1.5rem;
                }
                
                .section-description {
                    color: #666;
                    margin-bottom: 20px;
                    font-size: 0.9rem;
                }
                
                /* Color Options */
                .color-options {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
                    gap: 10px;
                    margin: 20px 0;
                }
                
                .color-option {
                    width: 60px;
                    height: 60px;
                    border-radius: 10px;
                    cursor: pointer;
                    transition: transform 0.2s, box-shadow 0.2s;
                    border: 3px solid transparent;
                }
                
                .color-option:hover {
                    transform: scale(1.1);
                    box-shadow: 0 4px 15px rgba(0,0,0,0.2);
                }
                
                .color-option.selected {
                    border-color: #333;
                    box-shadow: 0 0 0 3px white, 0 0 0 6px #333;
                }
                
                /* Font Options */
                .font-options {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
                    gap: 15px;
                    margin: 20px 0;
                }
                
                .font-option {
                    padding: 15px;
                    border: 2px solid #e0e0e0;
                    border-radius: 8px;
                    cursor: pointer;
                    text-align: center;
                    transition: all 0.2s;
                }
                
                .font-option:hover {
                    border-color: #2196F3;
                    transform: translateY(-2px);
                }
                
                .font-option.selected {
                    border-color: #2196F3;
                    background: rgba(33, 150, 243, 0.1);
                }
                
                .font-preview {
                    font-size: 2rem;
                    margin-bottom: 5px;
                }
                
                .font-name {
                    font-size: 0.9rem;
                    color: #666;
                }
                
                /* Tags */
                .tags-container {
                    margin: 20px 0;
                }
                
                .tag-category {
                    margin-bottom: 25px;
                }
                
                .tag-category h3 {
                    margin: 0 0 15px 0;
                    color: #555;
                    font-size: 1.2rem;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                
                .tags-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                    gap: 10px;
                }
                
                .tag {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 10px 15px;
                    background: #f5f5f5;
                    border-radius: 20px;
                    cursor: pointer;
                    transition: all 0.2s;
                    font-size: 0.9rem;
                }
                
                .tag:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 10px rgba(0,0,0,0.1);
                }
                
                .tag.selected {
                    background: #2196F3;
                    color: white;
                }
                
                .tag.selected .tag-icon {
                    color: white;
                }
                
                .dynamic-tag {
                    animation: pulse 2s infinite;
                }
                
                .tag-icon {
                    font-size: 1rem;
                }
                
                /* Preview */
                .preview-section {
                    position: sticky;
                    top: 20px;
                    z-index: 10;
                }
                
                .preview-header {
                    background: #1a1a1a;
                    color: white;
                    padding: 20px;
                    border-radius: 12px 12px 0 0;
                    font-size: 1.2rem;
                }
                
                .preview-message {
                    background: #f5f5f5;
                    padding: 20px;
                    border-radius: 0 0 12px 12px;
                }
                
                .preview-name {
                    font-weight: 600;
                    font-size: 1.1rem;
                    margin-right: 10px;
                }
                
                .preview-tag {
                    font-size: 0.8rem;
                    padding: 4px 8px;
                    background: rgba(255,255,255,0.1);
                    border-radius: 12px;
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                }
                
                /* Controls */
                .controls {
                    display: flex;
                    gap: 15px;
                    margin-top: 30px;
                }
                
                #saveBtn {
                    flex: 1;
                    background: #2196F3;
                    color: white;
                    border: none;
                    padding: 15px;
                    border-radius: 8px;
                    font-size: 1rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: background 0.2s;
                }
                
                #saveBtn:hover:not(:disabled) {
                    background: #1976D2;
                }
                
                #saveBtn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }
                
                #resetBtn {
                    background: #f5f5f5;
                    color: #666;
                    border: none;
                    padding: 15px 25px;
                    border-radius: 8px;
                    font-size: 1rem;
                    cursor: pointer;
                    transition: background 0.2s;
                }
                
                #resetBtn:hover {
                    background: #e0e0e0;
                }
                
                /* Toast */
                .customization-toast {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    background: white;
                    padding: 15px 20px;
                    border-radius: 8px;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.2);
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    z-index: 10000;
                    opacity: 0;
                    transform: translateY(20px);
                    transition: opacity 0.3s, transform 0.3s;
                }
                
                .customization-toast.show {
                    opacity: 1;
                    transform: translateY(0);
                }
                
                .customization-toast.success {
                    border-left: 4px solid #4CAF50;
                }
                
                .customization-toast.warning {
                    border-left: 4px solid #FFC107;
                }
                
                .customization-toast.error {
                    border-left: 4px solid #F44336;
                }
                
                .customization-toast i {
                    font-size: 1.2rem;
                }
                
                .customization-toast.success i {
                    color: #4CAF50;
                }
                
                .customization-toast.warning i {
                    color: #FFC107;
                }
                
                .customization-toast.error i {
                    color: #F44336;
                }
                
                /* User Profile Display */
                .customization-display {
                    margin: 20px 0;
                    padding: 20px;
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }
                
                .display-section {
                    margin-bottom: 25px;
                }
                
                .display-section:last-child {
                    margin-bottom: 0;
                }
                
                .display-section h4 {
                    margin: 0 0 10px 0;
                    color: #666;
                    font-size: 0.9rem;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }
                
                .display-item {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 8px 0;
                }
                
                .display-color {
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                }
                
                .display-font {
                    font-size: 1.1rem;
                }
                
                .display-tags {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                }
                
                .display-tag {
                    padding: 6px 12px;
                    background: #f5f5f5;
                    border-radius: 15px;
                    font-size: 0.8rem;
                    display: flex;
                    align-items: center;
                    gap: 5px;
                }
                
                /* Animation Keyframes */
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.7; }
                }
                
                /* Animation Keyframes for Customization */
                @keyframes customization-pulse {
                    0%, 100% { opacity: 0.8; transform: scale(1); }
                    50% { opacity: 1; transform: scale(1.05); }
                }
                
                @keyframes customization-spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                
                @keyframes customization-fire {
                    0%, 100% { color: #FF5722; text-shadow: 0 0 5px #FF5722; }
                    50% { color: #FF9800; text-shadow: 0 0 10px #FF9800; }
                }
                
                @keyframes customization-float {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-3px); }
                }
                
                @keyframes customization-bounce {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-5px); }
                }
                
                @keyframes customization-glow {
                    0%, 100% { box-shadow: 0 0 5px currentColor; }
                    50% { box-shadow: 0 0 10px currentColor; }
                }
                
                @keyframes customization-twinkle {
                    0%, 100% { opacity: 0.6; }
                    50% { opacity: 1; }
                }
                
                @keyframes customization-shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-2px); }
                    75% { transform: translateX(2px); }
                }
                
                @keyframes customization-heartbeat {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.1); }
                }
                
                @keyframes customization-flash {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
                
                @keyframes customization-rainbow {
                    0% { color: #ff0000; }
                    17% { color: #ffff00; }
                    34% { color: #00ff00; }
                    51% { color: #00ffff; }
                    68% { color: #0000ff; }
                    85% { color: #ff00ff; }
                    100% { color: #ff0000; }
                }
                
                @keyframes customization-zoom {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.1); }
                }
                
                @keyframes customization-swing {
                    0%, 100% { transform: rotate(0deg); }
                    25% { transform: rotate(-5deg); }
                    75% { transform: rotate(5deg); }
                }
                
                @keyframes customization-fade {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
                
                @keyframes customization-shine {
                    0% { background-position: -100px; }
                    100% { background-position: 200px; }
                }
                
                @keyframes customization-crown-glow {
                    0%, 100% { color: #FFD700; text-shadow: 0 0 5px #FFD700; }
                    50% { color: #FFF; text-shadow: 0 0 10px #FFF; }
                }
                
                @keyframes customization-sparkle {
                    0%, 100% { opacity: 0.7; transform: scale(1); }
                    50% { opacity: 1; transform: scale(1.1); }
                }
                
                @keyframes customization-metal-shine {
                    0% { color: #C0C0C0; }
                    50% { color: #FFF; }
                    100% { color: #C0C0C0; }
                }
                
                @keyframes customization-gold-glow {
                    0%, 100% { color: #FFD700; }
                    50% { color: #FFA500; }
                }
                
                @keyframes customization-count-up {
                    0% { opacity: 0.5; transform: scale(0.9); }
                    100% { opacity: 1; transform: scale(1); }
                }
                
                /* Chat message styling */
                .customized-name {
                    transition: color 0.3s ease, font-family 0.3s ease;
                }
                
                .customization-tag {
                    font-size: 0.7rem;
                    padding: 2px 6px;
                    background: rgba(0, 0, 0, 0.1);
                    border-radius: 10px;
                    display: inline-flex;
                    align-items: center;
                    gap: 3px;
                    margin-left: 6px;
                    transition: all 0.3s ease;
                }
                
                .customization-tag:hover {
                    transform: scale(1.1);
                }
            `;
            document.head.appendChild(style);
        }
    }

    // USER PROFILE DISPLAY
    initUserProfileDisplay() {
        console.log('Initializing user profile display...');
        
        // Look for user profile containers
        const profileSelectors = [
            '.user-profile',
            '.profile-container',
            '#userProfile',
            '#profileContainer',
            '.profile-info',
            '#profileInfo'
        ];
        
        let profileContainer = null;
        for (const selector of profileSelectors) {
            const element = document.querySelector(selector);
            if (element) {
                profileContainer = element;
                break;
            }
        }
        
        if (!profileContainer) {
            console.log('No profile container found, will try again...');
            setTimeout(() => this.initUserProfileDisplay(), 1000);
            return;
        }
        
        // Get user ID from URL or current user
        const urlParams = new URLSearchParams(window.location.search);
        const userId = urlParams.get('id') || this.firebaseUser?.uid;
        
        if (!userId) {
            console.log('No user ID available for profile display');
            return;
        }
        
        this.displayUserCustomization(profileContainer, userId);
    }

    async displayUserCustomization(container, userId) {
        try {
            console.log('Displaying customization for user:', userId);
            
            const customization = await this.getUserCustomization(userId);
            if (!customization) return;
            
            // Create display element
            const displayElement = document.createElement('div');
            displayElement.className = 'customization-display';
            
            displayElement.innerHTML = `
                <div class="display-section">
                    <h4>Chat Customization</h4>
                    <div class="display-item">
                        <span>Name Color:</span>
                        <div class="display-color" style="background: ${customization.nameColor}"></div>
                        <span style="color: ${customization.nameColor}; font-weight: 600;">Sample</span>
                    </div>
                    <div class="display-item">
                        <span>Font:</span>
                        <span class="display-font" style="font-family: ${customization.nameFont}">${customization.nameFont.split(',')[0]}</span>
                    </div>
                </div>
            `;
            
            // Add tags if available - FIXED: Show only 2 badges max in profile
            if (customization.selectedTags && customization.selectedTags.length > 0) {
                const tagsHtml = customization.selectedTags.slice(0, 2).map(tagId => {
                    const tag = this.getTagInfo(tagId);
                    if (!tag) return '';
                    
                    const isDynamic = this.tags.dynamic.some(t => t.id === tagId);
                    const animationStyle = isDynamic && tag.animation ? `animation: ${tag.animation};` : '';
                    
                    return `
                        <div class="display-tag" style="${animationStyle}">
                            <i class="fas fa-${tag.icon}"></i>
                            <span>${tag.name}</span>
                        </div>
                    `;
                }).join('');
                
                // Add indicator if there are more tags
                const remainingCount = customization.selectedTags.length - 2;
                const remainingIndicator = remainingCount > 0 ? 
                    `<div class="display-tag" style="background: #2196F3; color: white;">+${remainingCount} more</div>` : '';
                
                displayElement.innerHTML += `
                    <div class="display-section">
                        <h4>Gaming Tags</h4>
                        <div class="display-tags">
                            ${tagsHtml}
                            ${remainingIndicator}
                        </div>
                    </div>
                `;
            }
            
            // Add edit button if it's the current user's profile
            if (userId === this.firebaseUser?.uid) {
                displayElement.innerHTML += `
                    <div class="display-section" style="text-align: center; margin-top: 20px;">
                        <button id="editCustomizationBtn" style="background: #2196F3; color: white; border: none; 
                                padding: 10px 20px; border-radius: 8px; cursor: pointer;">
                            <i class="fas fa-edit"></i> Edit Chat Customization
                        </button>
                    </div>
                `;
                
                // Add event listener for edit button
                setTimeout(() => {
                    const editBtn = document.getElementById('editCustomizationBtn');
                    if (editBtn) {
                        editBtn.addEventListener('click', () => {
                            window.location.href = 'customization.html';
                        });
                    }
                }, 100);
            }
            
            // Insert into container
            const existingDisplay = container.querySelector('.customization-display');
            if (existingDisplay) {
                existingDisplay.replaceWith(displayElement);
            } else {
                // Try to insert after profile info
                const profileInfo = container.querySelector('.profile-info, .user-info, .info-section');
                if (profileInfo) {
                    profileInfo.after(displayElement);
                } else {
                    container.appendChild(displayElement);
                }
            }
            
            console.log('Customization display added to profile');
        } catch (error) {
            console.error('Error displaying customization:', error);
        }
    }

    // CHAT INTEGRATION METHODS
    initChatIntegration() {
        console.log('Initializing chat integration...');
        
        // Apply to existing messages
        setTimeout(() => {
            this.applyToExistingMessages();
        }, 2000);
        
        // Setup observer for new messages
        setTimeout(() => {
            this.setupChatObserver();
        }, 2500);
    }

    setupChatObserver() {
        if (!window.MutationObserver) {
            console.log('MutationObserver not supported');
            return;
        }
        
        const chatContainer = document.getElementById('messagesContainer') || 
                              document.querySelector('.messages-container') ||
                              document.querySelector('.chat-messages') ||
                              document.querySelector('.message-list');
        
        if (chatContainer) {
            console.log('Chat container found, setting up observer:', chatContainer);
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.addedNodes.length) {
                        mutation.addedNodes.forEach(node => {
                            if (node.nodeType === 1) {
                                this.processNewMessageElement(node);
                            }
                        });
                    }
                });
            });
            
            observer.observe(chatContainer, { childList: true, subtree: true });
            this.activeListeners.set('chatObserver', () => observer.disconnect());
        } else {
            console.log('Chat container not found, will retry...');
            // Retry after 2 seconds
            setTimeout(() => this.setupChatObserver(), 2000);
        }
    }

    applyToExistingMessages() {
        // Try multiple selectors for chat messages
        const selectors = [
            '.message', 
            '.message-container', 
            '.message-item', 
            '.message-group',
            '.chat-message',
            '[data-message-id]',
            '[data-sender-id]'
        ];
        
        let messages = [];
        selectors.forEach(selector => {
            const found = document.querySelectorAll(selector);
            if (found.length > 0) {
                messages = [...messages, ...found];
            }
        });
        
        console.log(`Found ${messages.length} existing messages to customize`);
        
        messages.forEach(message => {
            const userId = message.dataset.userId || 
                          message.dataset.senderId ||
                          this.extractUserIdFromElement(message);
            
            if (userId) {
                this.applyCustomizationToElement(message, userId);
            }
        });
    }

    processNewMessageElement(element) {
        // Try to find message element
        let messageElement = element;
        
        if (!element.classList?.contains('message') && 
            !element.classList?.contains('message-container') &&
            !element.classList?.contains('message-item')) {
            
            // Check if element contains message elements
            const messageSelectors = [
                '.message', 
                '.message-container', 
                '.message-item', 
                '.message-group',
                '.chat-message'
            ];
            
            for (const selector of messageSelectors) {
                const found = element.querySelector(selector);
                if (found) {
                    messageElement = found;
                    break;
                }
            }
        }
        
        const userId = messageElement.dataset.userId || 
                      messageElement.dataset.senderId ||
                      this.extractUserIdFromElement(messageElement);
        
        if (userId) {
            this.applyCustomizationToElement(messageElement, userId);
        }
    }

    extractUserIdFromElement(element) {
        // Try to get user ID from various element attributes
        const avatar = element.querySelector('.avatar, .user-avatar, .sender-avatar, .message-avatar');
        if (avatar && avatar.dataset.userId) return avatar.dataset.userId;
        
        const name = element.querySelector('.username, .user-name, .sender-name, .message-sender-name');
        if (name && name.dataset.userId) return name.dataset.userId;
        
        // Check parent elements for user ID
        let currentElement = element;
        for (let i = 0; i < 3; i++) {
            if (currentElement.dataset.userId) return currentElement.dataset.userId;
            if (currentElement.dataset.senderId) return currentElement.dataset.senderId;
            currentElement = currentElement.parentElement;
            if (!currentElement) break;
        }
        
        return null;
    }

    async applyCustomizationToElement(element, userId) {
        try {
            console.log('Applying customization for user:', userId);
            
            const customization = await this.getUserCustomization(userId);
            if (!customization) {
                console.log('No customization found for user:', userId);
                return;
            }
            
            // DEBUG: Log the element structure to understand what we're working with
            console.log('Element structure for debugging:', element);
            
            // METHOD 1: Look for sender name in span elements (most common in group-chat.js)
            // Based on group-chat.js structure, sender names are in spans
            let nameElements = element.querySelectorAll('span');
            
            // Filter to find likely sender name elements
            nameElements.forEach(el => {
                const text = el.textContent || '';
                // Look for elements that might be sender names
                // They typically don't contain emojis or special characters in the name itself
                if (text.length > 0 && 
                    text.length < 50 && 
                    !text.includes(' ') && 
                    !text.includes(':') && 
                    !text.includes('Replying') &&
                    !text.includes('just now') &&
                    !text.includes('m ago') &&
                    !text.includes('h ago') &&
                    !text.includes('d ago')) {
                    
                    console.log('Found potential sender name element:', text);
                    
                    // Apply customization
                    el.classList.add('customized-name');
                    if (customization.nameColor && customization.nameColor !== '#2196F3') {
                        el.style.color = customization.nameColor;
                    }
                    if (customization.nameFont && customization.nameFont !== 'Inter, sans-serif') {
                        el.style.fontFamily = customization.nameFont;
                    }
                }
            });
            
            // METHOD 2: Look for divs with flex layout (common in group-chat.js message structure)
            const flexDivs = element.querySelectorAll('div[style*="display: flex"]');
            flexDivs.forEach(div => {
                const spans = div.querySelectorAll('span');
                spans.forEach(span => {
                    const text = span.textContent || '';
                    if (text && text.length > 0 && text.length < 30) {
                        span.classList.add('customized-name');
                        if (customization.nameColor && customization.nameColor !== '#2196F3') {
                            span.style.color = customization.nameColor;
                        }
                        if (customization.nameFont && customization.nameFont !== 'Inter, sans-serif') {
                            span.style.fontFamily = customization.nameFont;
                        }
                    }
                });
            });
            
            // METHOD 3: Look for message sender containers
            const messageSenderDivs = element.querySelectorAll('[style*="font-weight: 600"]');
            messageSenderDivs.forEach(div => {
                div.classList.add('customized-name');
                if (customization.nameColor && customization.nameColor !== '#2196F3') {
                    div.style.color = customization.nameColor;
                }
                if (customization.nameFont && customization.nameFont !== 'Inter, sans-serif') {
                    div.style.fontFamily = customization.nameFont;
                }
            });
            
            // Apply tags if available
            if (customization.selectedTags && customization.selectedTags.length > 0) {
                this.applyTagsToElement(element, customization.selectedTags, customization);
            }
            
            console.log('Customization applied for user:', userId);
        } catch (error) {
            console.log('Error applying customization:', error);
        }
    }

    applyTagsToElement(element, tagIds, customization) {
        console.log('Applying tags to element:', element);
        
        // First, try to find where the sender name is
        let nameElement = null;
        
        // Look for customized-name class we just added
        nameElement = element.querySelector('.customized-name');
        
        // If not found, look for span with text that might be a name
        if (!nameElement) {
            const spans = element.querySelectorAll('span');
            for (const span of spans) {
                const text = span.textContent || '';
                if (text && text.length > 0 && text.length < 30 && !text.includes(':')) {
                    nameElement = span;
                    break;
                }
            }
        }
        
        if (!nameElement) {
            console.log('No name element found for tags in element:', element);
            return;
        }
        
        console.log('Found name element for tags:', nameElement.textContent);
        
        // Remove existing tags
        const existingTags = element.querySelectorAll('.customization-tag');
        existingTags.forEach(tag => tag.remove());
        
        // Create tags container
        const tagsContainer = document.createElement('span');
        tagsContainer.className = 'customization-tags';
        tagsContainer.style.display = 'inline-flex';
        tagsContainer.style.gap = '4px';
        tagsContainer.style.marginLeft = '6px';
        tagsContainer.style.alignItems = 'center';
        
        // FIXED: Add tags (limit to 2 for display)
        tagIds.slice(0, 2).forEach(tagId => {
            const tag = this.getTagInfo(tagId);
            if (tag) {
                const tagElement = document.createElement('span');
                tagElement.className = 'customization-tag';
                tagElement.title = tag.name;
                
                const isDynamic = this.tags.dynamic.some(t => t.id === tagId);
                if (isDynamic && tag.animation) {
                    tagElement.style.animation = tag.animation;
                }
                
                tagElement.innerHTML = `
                    <i class="fas fa-${tag.icon}" style="font-size: 0.6rem;"></i>
                    <span>${tag.name.split(' ')[1] || tag.name}</span>
                `;
                tagsContainer.appendChild(tagElement);
            }
        });
        
        // Add indicator for more tags if needed
        if (tagIds.length > 2) {
            const moreIndicator = document.createElement('span');
            moreIndicator.className = 'customization-tag';
            moreIndicator.style.background = '#2196F3';
            moreIndicator.style.color = 'white';
            moreIndicator.innerHTML = `<span>+${tagIds.length - 2}</span>`;
            moreIndicator.title = `${tagIds.length - 2} more badges`;
            tagsContainer.appendChild(moreIndicator);
        }
        
        // Insert after name
        if (nameElement.parentNode) {
            nameElement.parentNode.insertBefore(tagsContainer, nameElement.nextSibling);
            console.log('Tags inserted after name element');
        } else {
            // If parent node not found, append to the element itself
            element.appendChild(tagsContainer);
            console.log('Tags appended to element');
        }
    }

    async logout() {
        try {
            await signOut(this.auth);
            this.firebaseUser = null;
            this.userCustomization = null;
            this.customizationCache.clear();
            
            window.location.href = 'login.html';
        } catch (error) {
            console.error('Error logging out:', error);
        }
    }

    cleanup() {
        console.log('Cleaning up chat customization...');
        this.activeListeners.forEach((cleanup, id) => {
            if (typeof cleanup === 'function') {
                cleanup();
            }
        });
        this.activeListeners.clear();
        this.customizationCache.clear();
    }
}

// Create and expose global instance
const chatCustomization = new ChatCustomization();
window.chatCustomization = chatCustomization;

console.log('Chat Customization module loaded');

// Auto-init when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing Chat Customization...');
    chatCustomization.init();
});

// Export for use in other modules
export { chatCustomization };