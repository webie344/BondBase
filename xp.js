// xp.js - XP System for Gamers App (Fixed Version)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
    getAuth,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    serverTimestamp,
    arrayUnion,
    increment,
    Timestamp
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
let app, auth, db;
try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    console.log('XP System: Firebase initialized successfully');
} catch (error) {
    console.error('XP System: Firebase initialization error:', error);
}

// ==================== XP RANK SYSTEM ====================
const XP_RANKS = [];
// Generate 100 ranks with progressive XP requirements
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

// ==================== XP SYSTEM FUNCTIONS ====================
class XPSystem {
    constructor() {
        this.currentUser = null;
        this.userData = null;
        this.xpData = null;
        this.dailyCheckIn = false;
        this.onlineTimer = null;
        this.onlineStartTime = null;
    }

    async initialize() {
        console.log('XP System: Initializing...');
        
        // Listen for auth state changes
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                this.currentUser = user;
                await this.loadUserData();
                await this.checkDailyXP();
                await this.startOnlineTimer();
                await this.updateProfilePage();
                
                // Show welcome XP if new user
                await this.checkNewUserBonus();
            } else {
                this.currentUser = null;
                console.log('XP System: No user logged in');
            }
        });

        // Setup XP page if on xp.html
        if (window.location.pathname.includes('xp.html')) {
            this.setupXPPage();
        }
    }

    async loadUserData() {
        try {
            const userRef = doc(db, 'users', this.currentUser.uid);
            const userSnap = await getDoc(userRef);
            
            if (userSnap.exists()) {
                this.userData = userSnap.data();
                console.log('XP System: User data loaded');
            }

            // Load XP data
            const xpRef = doc(db, 'xpData', this.currentUser.uid);
            const xpSnap = await getDoc(xpRef);
            
            if (xpSnap.exists()) {
                this.xpData = xpSnap.data();
                console.log('XP System: XP data loaded', this.xpData);
            } else {
                // Initialize XP data for new user
                await this.initializeXPData();
            }
        } catch (error) {
            console.error('XP System: Error loading user data:', error);
        }
    }

    async initializeXPData() {
        try {
            // Create initial XP history item with regular timestamp
            const initialHistoryItem = {
                amount: 10,
                reason: "Welcome Bonus",
                timestamp: Timestamp.now(), // Use Timestamp.now() instead of serverTimestamp()
                type: "earned"
            };

            const initialXPData = {
                userId: this.currentUser.uid,
                totalXP: 10, // Start with 10 XP as welcome bonus
                currentLevel: 1,
                coins: 0,
                xpHistory: [initialHistoryItem],
                dailyCheckIns: [],
                lastOnlineXP: null,
                achievements: [],
                created: Timestamp.now(), // Use Timestamp.now() here too
                updated: Timestamp.now(),
                lastDailyCheckIn: null
            };

            await setDoc(doc(db, 'xpData', this.currentUser.uid), initialXPData);
            this.xpData = initialXPData;
            console.log('XP System: XP data initialized');
            
            // Show welcome notification
            this.showWelcomeNotification();
        } catch (error) {
            console.error('XP System: Error initializing XP data:', error);
        }
    }

    async checkNewUserBonus() {
        try {
            const xpRef = doc(db, 'xpData', this.currentUser.uid);
            const xpSnap = await getDoc(xpRef);
            
            if (xpSnap.exists()) {
                const data = xpSnap.data();
                // Check if user has less than 50 XP (likely new)
                if (data.totalXP < 50 && data.xpHistory && data.xpHistory.length <= 1) {
                    await this.addXP(10, "Welcome to Gamers Network!");
                    this.showXPGainAnimation(10, "Welcome Bonus!");
                }
            }
        } catch (error) {
            console.error('XP System: Error checking new user bonus:', error);
        }
    }

    async addXP(amount, reason) {
        try {
            if (!this.currentUser || !this.xpData) return false;
            
            const xpRef = doc(db, 'xpData', this.currentUser.uid);
            
            // Create history item with regular timestamp
            const historyItem = {
                amount: amount,
                reason: reason,
                timestamp: Timestamp.now(),
                type: "earned"
            };
            
            // Update XP
            await updateDoc(xpRef, {
                totalXP: increment(amount),
                coins: increment(Math.floor(amount / 10)), // 1 coin per 10 XP
                updated: Timestamp.now(),
                xpHistory: arrayUnion(historyItem)
            });
            
            // Reload XP data
            const xpSnap = await getDoc(xpRef);
            this.xpData = xpSnap.data();
            
            // Check for level up
            await this.checkLevelUp();
            
            console.log(`XP System: Added ${amount} XP - ${reason}`);
            
            // Show animation
            this.showXPGainAnimation(amount, reason);
            
            return true;
        } catch (error) {
            console.error('XP System: Error adding XP:', error);
            return false;
        }
    }

    async addCoins(amount, reason) {
        try {
            if (!this.currentUser) return false;
            
            const xpRef = doc(db, 'xpData', this.currentUser.uid);
            
            // Create history item
            const historyItem = {
                amount: amount,
                reason: reason,
                timestamp: Timestamp.now(),
                type: "coins_earned"
            };
            
            await updateDoc(xpRef, {
                coins: increment(amount),
                updated: Timestamp.now(),
                xpHistory: arrayUnion(historyItem)
            });
            
            // Reload data
            const xpSnap = await getDoc(xpRef);
            this.xpData = xpSnap.data();
            
            console.log(`XP System: Added ${amount} coins - ${reason}`);
            return true;
        } catch (error) {
            console.error('XP System: Error adding coins:', error);
            return false;
        }
    }

    async checkLevelUp() {
        if (!this.xpData) return false;
        
        const currentLevel = this.getCurrentLevel();
        const nextLevel = currentLevel + 1;
        
        if (nextLevel <= 100) {
            const currentRank = XP_RANKS[currentLevel - 1];
            const nextRank = XP_RANKS[nextLevel - 1];
            
            if (this.xpData.totalXP >= nextRank.xpNeeded) {
                // Level up!
                const xpRef = doc(db, 'xpData', this.currentUser.uid);
                
                // Create history item
                const historyItem = {
                    amount: 0,
                    reason: `Leveled up to ${nextRank.title}!`,
                    timestamp: Timestamp.now(),
                    type: "level_up"
                };
                
                await updateDoc(xpRef, {
                    currentLevel: nextLevel,
                    updated: Timestamp.now(),
                    xpHistory: arrayUnion(historyItem)
                });
                
                // Add bonus coins for leveling up
                await this.addCoins(50, `Level ${nextLevel} Bonus`);
                
                // Show level up notification
                this.showLevelUpNotification(nextLevel, nextRank);
                
                console.log(`XP System: Leveled up to ${nextLevel} - ${nextRank.title}`);
                return true;
            }
        }
        return false;
    }

    getCurrentLevel() {
        if (!this.xpData) return 1;
        
        let currentLevel = 1;
        for (let i = XP_RANKS.length - 1; i >= 0; i--) {
            if (this.xpData.totalXP >= XP_RANKS[i].xpNeeded) {
                currentLevel = XP_RANKS[i].level;
                break;
            }
        }
        return currentLevel;
    }

    getCurrentRank() {
        const level = this.getCurrentLevel();
        return XP_RANKS[level - 1] || XP_RANKS[0];
    }

    getNextRank() {
        const currentLevel = this.getCurrentLevel();
        if (currentLevel >= 100) return null;
        return XP_RANKS[currentLevel]; // Next level index
    }

    getProgressPercentage() {
        const currentRank = this.getCurrentRank();
        const nextRank = this.getNextRank();
        
        if (!nextRank || !this.xpData) return 0;
        
        const xpInCurrentLevel = this.xpData.totalXP - currentRank.xpNeeded;
        const xpNeededForNext = nextRank.xpNeeded - currentRank.xpNeeded;
        
        return Math.min(100, Math.max(0, (xpInCurrentLevel / xpNeededForNext) * 100));
    }

    // ==================== DAILY XP SYSTEM ====================
    async checkDailyXP() {
        try {
            if (!this.currentUser || !this.xpData) return;
            
            const today = new Date().toDateString();
            const xpRef = doc(db, 'xpData', this.currentUser.uid);
            const xpSnap = await getDoc(xpRef);
            
            if (xpSnap.exists()) {
                const data = xpSnap.data();
                const lastCheckIn = data.lastDailyCheckIn ? 
                    new Date(data.lastDailyCheckIn.seconds * 1000).toDateString() : null;
                
                if (lastCheckIn !== today) {
                    // Give daily XP
                    await updateDoc(xpRef, {
                        lastDailyCheckIn: Timestamp.now(),
                        dailyCheckIns: arrayUnion(today)
                    });
                    
                    await this.addXP(10, "Daily Login Bonus");
                    await this.addCoins(5, "Daily Login Bonus");
                    
                    this.dailyCheckIn = true;
                    console.log('XP System: Daily XP awarded');
                } else {
                    this.dailyCheckIn = true;
                }
            }
        } catch (error) {
            console.error('XP System: Error checking daily XP:', error);
        }
    }

    // ==================== ONLINE TIME TRACKING ====================
    async startOnlineTimer() {
        if (this.onlineTimer) clearInterval(this.onlineTimer);
        
        this.onlineStartTime = Date.now();
        
        this.onlineTimer = setInterval(async () => {
            const onlineTime = Date.now() - this.onlineStartTime;
            const minutesOnline = Math.floor(onlineTime / (1000 * 60));
            
            // Award XP every 3 minutes of activity
            if (minutesOnline >= 3 && minutesOnline % 3 === 0) {
                const lastXPTime = this.xpData?.lastOnlineXP;
                const now = Date.now();
                
                // Only award if at least 3 minutes have passed since last award
                if (!lastXPTime || (now - lastXPTime.seconds * 1000) >= 3 * 60 * 1000) {
                    await this.addXP(10, "3 Minutes Online Activity");
                    await this.addCoins(1, "Online Time Bonus");
                    
                    // Update last XP time
                    const xpRef = doc(db, 'xpData', this.currentUser.uid);
                    await updateDoc(xpRef, {
                        lastOnlineXP: Timestamp.now()
                    });
                    
                    console.log('XP System: Awarded online activity XP');
                }
            }
        }, 60000); // Check every minute
    }

    stopOnlineTimer() {
        if (this.onlineTimer) {
            clearInterval(this.onlineTimer);
            this.onlineTimer = null;
        }
    }

    // ==================== NOTIFICATIONS & ANIMATIONS ====================
    showWelcomeNotification() {
        // Only show if we're not on xp.html (where we have our own display)
        if (window.location.pathname.includes('xp.html')) return;
        
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 20px;
            z-index: 10000;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            text-align: center;
            max-width: 400px;
            animation: popIn 0.5s ease-out;
        `;
        
        notification.innerHTML = `
            <div style="font-size: 50px; margin-bottom: 20px;">🎉</div>
            <h2 style="margin: 0 0 10px 0; font-size: 24px;">Welcome to Gamers Network!</h2>
            <p style="margin: 0 0 20px 0; font-size: 16px; opacity: 0.9;">
                You've received <span style="color: #00ff9d; font-weight: bold;">10 XP</span> 
                and your journey begins now!
            </p>
            <button onclick="this.parentElement.remove()" style="
                background: white;
                color: #667eea;
                border: none;
                padding: 10px 30px;
                border-radius: 25px;
                font-weight: bold;
                cursor: pointer;
                font-size: 16px;
            ">
                Let's Go!
            </button>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
        
        // Add animation style
        if (!document.getElementById('popInAnimation')) {
            const style = document.createElement('style');
            style.id = 'popInAnimation';
            style.textContent = `
                @keyframes popIn {
                    0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
                    100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }
    }

    showXPGainAnimation(amount, reason) {
        // Only show on pages other than xp.html
        if (window.location.pathname.includes('xp.html')) return;
        
        // Create floating XP element
        const xpElement = document.createElement('div');
        xpElement.style.cssText = `
            position: fixed;
            bottom: 100px;
            right: 20px;
            background: rgba(0, 255, 157, 0.9);
            color: #000;
            padding: 10px 20px;
            border-radius: 25px;
            font-weight: bold;
            font-size: 16px;
            z-index: 9999;
            display: flex;
            align-items: center;
            gap: 10px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
            animation: floatUp 2s ease-in-out forwards;
        `;
        
        xpElement.innerHTML = `
            <span style="font-size: 20px;">🎮</span>
            <span>+${amount} XP</span>
            <span style="font-size: 12px; opacity: 0.8;">${reason}</span>
        `;
        
        document.body.appendChild(xpElement);
        
        // Remove after animation
        setTimeout(() => {
            if (xpElement.parentElement) {
                xpElement.remove();
            }
        }, 2000);
        
        // Add animation style if not exists
        if (!document.getElementById('floatUpAnimation')) {
            const style = document.createElement('style');
            style.id = 'floatUpAnimation';
            style.textContent = `
                @keyframes floatUp {
                    0% { transform: translateY(0); opacity: 1; }
                    100% { transform: translateY(-100px); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
    }

    showLevelUpNotification(level, rank) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            height: 100vh;
            background: linear-gradient(135deg, ${rank.color}33, #000000cc);
            z-index: 10001;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            animation: levelUpFade 3s ease-in-out forwards;
        `;
        
        notification.innerHTML = `
            <div style="text-align: center; color: white;">
                <div style="font-size: 80px; margin-bottom: 20px; animation: bounce 1s infinite;">${rank.icon}</div>
                <h1 style="font-size: 48px; margin: 0 0 10px 0; color: ${rank.color}; text-shadow: 0 2px 10px rgba(0,0,0,0.5);">
                    LEVEL UP!
                </h1>
                <h2 style="font-size: 32px; margin: 0 0 20px 0;">${rank.title}</h2>
                <p style="font-size: 20px; opacity: 0.9;">
                    You've reached Level ${level}!
                </p>
                <div style="margin-top: 30px; font-size: 24px; color: #FFD700;">
                    🪙 +50 Coins Bonus!
                </div>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 3000);
        
        // Add animation styles
        if (!document.getElementById('levelUpAnimations')) {
            const style = document.createElement('style');
            style.id = 'levelUpAnimations';
            style.textContent = `
                @keyframes levelUpFade {
                    0% { opacity: 0; }
                    20% { opacity: 1; }
                    80% { opacity: 1; }
                    100% { opacity: 0; }
                }
                @keyframes bounce {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-20px); }
                }
            `;
            document.head.appendChild(style);
        }
    }

    // ==================== XP PAGE FUNCTIONS ====================
    setupXPPage() {
        console.log('XP System: Setting up XP page');
        
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                this.currentUser = user;
                await this.loadUserData();
                await this.renderXPPage();
                this.setupXPEventListeners();
            } else {
                // Redirect to login if not authenticated
                window.location.href = 'login.html';
            }
        });
    }

    async renderXPPage() {
        if (!this.xpData) {
            await this.loadUserData();
        }
        
        if (!this.xpData) {
            console.log('XP System: No XP data available');
            return;
        }
        
        const currentRank = this.getCurrentRank();
        const nextRank = this.getNextRank();
        const progress = this.getProgressPercentage();
        
        // Update user info
        const userName = document.getElementById('userName');
        const userAvatar = document.getElementById('userAvatar');
        const currentLevel = document.getElementById('currentLevel');
        const totalXP = document.getElementById('totalXP');
        const xpToNext = document.getElementById('xpToNext');
        
        if (userName) userName.textContent = this.userData?.name || 'Gamer';
        if (userAvatar) userAvatar.src = this.userData?.profileImage || 'images-default-profile.jpg';
        if (currentLevel) currentLevel.textContent = currentRank.level;
        if (totalXP) totalXP.textContent = this.xpData.totalXP?.toLocaleString() || '0';
        if (xpToNext) {
            if (nextRank) {
                xpToNext.textContent = (nextRank.xpNeeded - this.xpData.totalXP).toLocaleString();
            } else {
                xpToNext.textContent = 'MAX';
            }
        }
        
        // Update rank info
        const currentRankIcon = document.getElementById('currentRankIcon');
        const currentRankTitle = document.getElementById('currentRankTitle');
        const currentLevelDisplay = document.getElementById('currentLevelDisplay');
        const currentTitle = document.getElementById('currentTitle');
        
        if (currentRankIcon) currentRankIcon.textContent = currentRank.icon;
        if (currentRankTitle) currentRankTitle.textContent = currentRank.title;
        if (currentLevelDisplay) currentLevelDisplay.textContent = currentRank.level;
        if (currentTitle) currentTitle.textContent = currentRank.title;
        
        // Update progress bar
        const progressBar = document.getElementById('xpProgressBar');
        const progressPercentage = document.getElementById('xpPercentage');
        const xpNeededDisplay = document.getElementById('xpNeededDisplay');
        
        if (progressBar) {
            progressBar.style.width = `${progress}%`;
        }
        if (progressPercentage) {
            progressPercentage.textContent = `${progress.toFixed(1)}%`;
        }
        if (xpNeededDisplay && nextRank) {
            xpNeededDisplay.textContent = 
                `${(this.xpData.totalXP - currentRank.xpNeeded).toLocaleString()}/${(nextRank.xpNeeded - currentRank.xpNeeded).toLocaleString()} XP`;
        }
        
        // Update next rank preview
        const nextRankTitle = document.getElementById('nextRankTitle');
        const nextRankXPNeeded = document.getElementById('nextRankXPNeeded');
        const nextRankIcon = document.getElementById('nextRankIcon');
        
        if (nextRankTitle && nextRankXPNeeded && nextRankIcon) {
            if (nextRank) {
                nextRankTitle.textContent = nextRank.title;
                nextRankXPNeeded.textContent = (nextRank.xpNeeded - this.xpData.totalXP).toLocaleString();
                nextRankIcon.textContent = nextRank.icon;
            } else {
                nextRankTitle.textContent = 'MAX LEVEL ACHIEVED!';
                nextRankXPNeeded.textContent = '0';
                nextRankIcon.textContent = '🏆';
            }
        }
        
        // Update coins
        const coinsAmount = document.getElementById('coinsAmount');
        if (coinsAmount) {
            coinsAmount.textContent = this.xpData.coins?.toLocaleString() || '0';
        }
        
        // Render milestones
        await this.renderMilestones();
        
        // Render ranks gallery
        this.renderRanksGallery();
        
        // Render XP history
        await this.renderXPHistory();
    }

    async renderMilestones() {
        const milestonesGrid = document.getElementById('milestonesGrid');
        if (!milestonesGrid) return;
        
        const milestones = [
            { icon: '🎯', title: 'First Login', xp: 10, completed: true },
            { icon: '📅', title: '7 Day Streak', xp: 100, completed: false },
            { icon: '👥', title: 'Add 10 Friends', xp: 50, completed: false },
            { icon: '💬', title: 'Send 50 Messages', xp: 75, completed: false },
            { icon: '🎮', title: 'Complete Profile', xp: 25, completed: false },
            { icon: '🏆', title: 'Reach Level 10', xp: 200, completed: false }
        ];
        
        // Check if user has completed any milestones
        if (this.xpData) {
            const userLevel = this.getCurrentLevel();
            if (userLevel >= 10) {
                milestones[5].completed = true; // Reach Level 10
            }
        }
        
        milestonesGrid.innerHTML = milestones.map(milestone => `
            <div class="milestone-card ${milestone.completed ? 'completed' : ''}">
                <div class="milestone-header">
                    <div class="milestone-icon">${milestone.icon}</div>
                    <div class="milestone-title">${milestone.title}</div>
                    <div class="milestone-xp">+${milestone.xp} XP</div>
                </div>
                <div style="font-size: 12px; color: var(--text-secondary);">
                    ${milestone.completed ? '✅ Completed' : '⚪ Not completed'}
                </div>
            </div>
        `).join('');
    }

    renderRanksGallery() {
        const ranksGrid = document.getElementById('ranksGrid');
        if (!ranksGrid) return;
        
        const currentLevel = this.getCurrentLevel();
        
        ranksGrid.innerHTML = XP_RANKS.map(rank => {
            const isCurrent = rank.level === currentLevel;
            const isAchieved = this.xpData && this.xpData.totalXP >= rank.xpNeeded;
            
            return `
                <div class="rank-card ${isCurrent ? 'current' : ''} ${isAchieved ? 'achieved' : ''}" 
                     style="border-color: ${rank.color};">
                    <div class="rank-level" style="background: ${rank.color};">${rank.level}</div>
                    <div class="rank-icon">${rank.icon}</div>
                    <div class="rank-title">${rank.title}</div>
                    <div class="rank-xp">${rank.xpNeeded.toLocaleString()} XP</div>
                </div>
            `;
        }).join('');
    }

    async renderXPHistory() {
        const xpHistory = document.getElementById('xpHistory');
        if (!xpHistory || !this.xpData || !this.xpData.xpHistory) return;
        
        // Get recent XP events (last 10)
        const recentEvents = this.xpData.xpHistory.slice(-10).reverse();
        
        xpHistory.innerHTML = recentEvents.map(event => {
            let time = 'Recently';
            if (event.timestamp && event.timestamp.seconds) {
                const date = new Date(event.timestamp.seconds * 1000);
                time = date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            }
            
            const icon = event.type === 'earned' ? '➕' : 
                        event.type === 'coins_earned' ? '🪙' : 
                        event.type === 'level_up' ? '⭐' : '📝';
            
            const amountText = event.type === 'coins_earned' ? 'Coins' : 'XP';
            
            return `
                <div class="xp-event ${event.type}">
                    <div class="event-icon">${icon}</div>
                    <div class="event-details">
                        <div class="event-title">${event.reason}</div>
                        <div class="event-time">${time}</div>
                    </div>
                    <div class="xp-change ${event.amount > 0 ? 'positive' : 'negative'}">
                        ${event.amount > 0 ? '+' : ''}${event.amount} ${amountText}
                    </div>
                </div>
            `;
        }).join('');
    }

    setupXPEventListeners() {
        // Filter buttons
        const filterButtons = document.querySelectorAll('.filter-btn');
        if (filterButtons.length > 0) {
            filterButtons.forEach(button => {
                button.addEventListener('click', () => {
                    filterButtons.forEach(btn => btn.classList.remove('active'));
                    button.classList.add('active');
                    
                    const filter = button.dataset.filter;
                    this.filterRanks(filter);
                });
            });
        }
    }

    filterRanks(filter) {
        const currentLevel = this.getCurrentLevel();
        const cards = document.querySelectorAll('.rank-card');
        
        cards.forEach(card => {
            const levelText = card.querySelector('.rank-level');
            if (!levelText) return;
            
            const level = parseInt(levelText.textContent);
            
            switch(filter) {
                case 'current':
                    card.style.display = (level >= currentLevel - 2 && level <= currentLevel + 2) ? 'block' : 'none';
                    break;
                case 'upcoming':
                    card.style.display = level > currentLevel ? 'block' : 'none';
                    break;
                case 'legendary':
                    card.style.display = level >= 90 ? 'block' : 'none';
                    break;
                default:
                    card.style.display = 'block';
            }
        });
    }

    // ==================== PROFILE PAGE INTEGRATION ====================
    async updateProfilePage() {
        // This function will be called from gamers.js to update profile page with XP info
        if (!window.location.pathname.includes('profile.html')) return;
        
        // Add XP display to profile page
        await this.addXPToProfile();
    }

    async addXPToProfile() {
        // Wait for profile page to load
        setTimeout(async () => {
            const profileHeader = document.querySelector('.profile-header');
            if (!profileHeader || !this.xpData) return;
            
            // Check if XP display already exists
            if (document.querySelector('.xp-profile-display')) return;
            
            // Create XP display element
            const xpDisplay = document.createElement('div');
            xpDisplay.className = 'xp-profile-display';
            xpDisplay.style.cssText = `
                position: absolute;
                top: 20px;
                right: 20px;
                background: linear-gradient(135deg, #667eea, #764ba2);
                padding: 10px 15px;
                border-radius: 20px;
                display: flex;
                align-items: center;
                gap: 10px;
                color: white;
                font-weight: bold;
                box-shadow: 0 5px 15px rgba(0,0,0,0.3);
                z-index: 10;
            `;
            
            const currentRank = this.getCurrentRank();
            
            xpDisplay.innerHTML = `
                <span style="font-size: 20px;">${currentRank.icon}</span>
                <div style="text-align: center;">
                    <div style="font-size: 14px;">Level ${currentRank.level}</div>
                    <div style="font-size: 12px; opacity: 0.9;">${currentRank.title}</div>
                </div>
                <div style="margin-left: 10px; border-left: 2px solid rgba(255,255,255,0.3); padding-left: 10px;">
                    <div style="font-size: 16px;">${this.xpData.totalXP || 0} XP</div>
                    <div style="font-size: 12px; opacity: 0.9;">${this.xpData.coins || 0} 🪙</div>
                </div>
            `;
            
            // Add to profile header
            profileHeader.style.position = 'relative';
            profileHeader.appendChild(xpDisplay);
            
            // Add floating triumph icons
            this.addTriumphIcons();
        }, 1000); // Delay to ensure profile page is loaded
    }

    addTriumphIcons() {
        const triumphIcons = ['🏆', '⭐', '👑', '💎', '🔥', '✨', '🎮', '⚔️', '🛡️', '🌟'];
        const profilePic = document.querySelector('.profile-pic, .user-avatar, [class*="avatar"]');
        
        if (!profilePic) return;
        
        // Create container for floating icons
        const iconContainer = document.createElement('div');
        iconContainer.className = 'triumph-icons-container';
        iconContainer.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 5;
        `;
        
        // Add floating icons
        for (let i = 0; i < 5; i++) {
            const icon = document.createElement('div');
            icon.className = 'triumph-icon';
            icon.textContent = triumphIcons[Math.floor(Math.random() * triumphIcons.length)];
            icon.style.cssText = `
                position: absolute;
                font-size: 20px;
                opacity: 0.7;
                animation: triumphFloat ${3 + Math.random() * 5}s infinite ease-in-out;
                filter: drop-shadow(0 0 5px gold);
            `;
            
            // Random starting position
            const angle = Math.random() * Math.PI * 2;
            const radius = 60;
            icon.style.left = `calc(50% + ${Math.cos(angle) * radius}px)`;
            icon.style.top = `calc(50% + ${Math.sin(angle) * radius}px)`;
            
            iconContainer.appendChild(icon);
        }
        
        profilePic.parentElement.style.position = 'relative';
        profilePic.parentElement.appendChild(iconContainer);
        
        // Add animation style
        if (!document.getElementById('triumphAnimations')) {
            const style = document.createElement('style');
            style.id = 'triumphAnimations';
            style.textContent = `
                @keyframes triumphFloat {
                    0%, 100% { transform: translate(0, 0) rotate(0deg); }
                    25% { transform: translate(${Math.random() * 20 - 10}px, ${Math.random() * 20 - 10}px) rotate(90deg); }
                    50% { transform: translate(${Math.random() * 20 - 10}px, ${Math.random() * 20 - 10}px) rotate(180deg); }
                    75% { transform: translate(${Math.random() * 20 - 10}px, ${Math.random() * 20 - 10}px) rotate(270deg); }
                }
            `;
            document.head.appendChild(style);
        }
    }

    // ==================== PUBLIC API ====================
    async awardDailyLogin() {
        return await this.addXP(10, "Daily Login");
    }

    async awardOnlineTime(minutes) {
        const xpAmount = Math.floor(minutes / 3) * 10;
        if (xpAmount > 0) {
            return await this.addXP(xpAmount, `${minutes} Minutes Online`);
        }
        return false;
    }

    async awardActivity(type) {
        const rewards = {
            'message': { xp: 5, reason: "Sent a message" },
            'profile_view': { xp: 2, reason: "Viewed a profile" },
            'friend_add': { xp: 15, reason: "Added a friend" },
            'post_created': { xp: 20, reason: "Created a post" },
            'achievement': { xp: 50, reason: "Unlocked achievement" }
        };
        
        if (rewards[type]) {
            const reward = rewards[type];
            return await this.addXP(reward.xp, reward.reason);
        }
        return false;
    }

    getRankInfo(level) {
        return XP_RANKS[level - 1] || XP_RANKS[XP_RANKS.length - 1];
    }

    getUserStats() {
        if (!this.xpData) return null;
        
        return {
            level: this.getCurrentLevel(),
            rank: this.getCurrentRank(),
            totalXP: this.xpData.totalXP || 0,
            coins: this.xpData.coins || 0,
            progress: this.getProgressPercentage(),
            nextRank: this.getNextRank()
        };
    }
}

// ==================== GLOBAL INITIALIZATION ====================
const xpSystem = new XPSystem();

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    xpSystem.initialize();
});

// Export for use in other files
window.XPSystem = xpSystem;

// Export individual functions for gamers.js integration
window.awardXP = (amount, reason) => xpSystem.addXP(amount, reason);
window.awardCoins = (amount, reason) => xpSystem.addCoins(amount, reason);
window.getUserXPStats = () => xpSystem.getUserStats();
window.getRankInfo = (level) => xpSystem.getRankInfo(level);

// Function to initialize XP system from other pages
window.initializeXPSystem = function() {
    return xpSystem.initialize();
};

console.log('XP System: Module loaded successfully');