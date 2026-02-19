// xp.js - XP System for Gamers App (Fixed Version - Profile Display)
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
    arrayUnion,
    increment,
    Timestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyC9jF-ocy6HjsVzWVVlAyXW-4aIFgA79-A",
    authDomain: "crypto-6517d.firebaseapp.com",
    projectId: "crypto-6517d",
    storageBucket: "crypto-6517d.firebasestorage.app",
    messagingSenderId: "60263975159",
    appId: "1:60263975159:web:bd53dcaad86d6ed9592bf2"
}

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
        // NEW: Track XP rewards per day
        this.dailyXPLimit = 2; // Maximum XP rewards per day
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
                
                // Check if we're on profile page and update accordingly
                if (window.location.pathname.includes('profile.html')) {
                    // Wait a bit for profile page to load
                    setTimeout(() => {
                        this.updateProfileDisplay();
                    }, 1500);
                }
                
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
        
        // Also listen for URL changes (for single page apps)
        this.listenForUrlChanges();
    }
    
    listenForUrlChanges() {
        // For SPAs that change URL without page reload
        let lastUrl = location.href;
        new MutationObserver(() => {
            const url = location.href;
            if (url !== lastUrl) {
                lastUrl = url;
                if (window.location.pathname.includes('profile.html')) {
                    setTimeout(() => {
                        this.updateProfileDisplay();
                    }, 1000);
                }
            }
        }).observe(document, {subtree: true, childList: true});
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
                timestamp: Timestamp.now(),
                type: "earned"
            };

            // NEW: Initialize daily reward tracking
            const today = new Date().toDateString();
            
            const initialXPData = {
                userId: this.currentUser.uid,
                totalXP: 10,
                currentLevel: 1,
                coins: 0,
                xpHistory: [initialHistoryItem],
                dailyCheckIns: [],
                lastOnlineXP: null,
                achievements: [],
                created: Timestamp.now(),
                updated: Timestamp.now(),
                lastDailyCheckIn: null,
                // NEW: Track daily XP rewards
                dailyRewards: {
                    date: today,
                    count: 1, // Welcome bonus counts as 1 reward
                    rewards: [{
                        reason: "Welcome Bonus",
                        timestamp: Timestamp.now()
                    }]
                }
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
                    // NEW: Check daily limit before awarding
                    const canAward = await this.checkDailyRewardLimit("Welcome Bonus");
                    if (canAward) {
                        await this.addXP(10, "Welcome to Gamers Network!");
                        this.showXPGainAnimation(10, "Welcome Bonus!");
                    }
                }
            }
        } catch (error) {
            console.error('XP System: Error checking new user bonus:', error);
        }
    }

    // NEW: Check if user hasn't exceeded daily XP reward limit
    async checkDailyRewardLimit(reason) {
        try {
            if (!this.currentUser || !this.xpData) return false;
            
            const today = new Date().toDateString();
            const xpRef = doc(db, 'xpData', this.currentUser.uid);
            
            // Get fresh data
            const xpSnap = await getDoc(xpRef);
            if (!xpSnap.exists()) return false;
            
            const data = xpSnap.data();
            
            // Initialize daily rewards tracking if it doesn't exist
            if (!data.dailyRewards) {
                const initialDailyRewards = {
                    date: today,
                    count: 0,
                    rewards: []
                };
                
                await updateDoc(xpRef, {
                    dailyRewards: initialDailyRewards
                });
                
                // Reload data
                const newSnap = await getDoc(xpRef);
                this.xpData = newSnap.data();
                return true; // First reward of the day
            }
            
            // Check if it's a new day
            if (data.dailyRewards.date !== today) {
                // Reset daily counter for new day
                await updateDoc(xpRef, {
                    'dailyRewards.date': today,
                    'dailyRewards.count': 0,
                    'dailyRewards.rewards': []
                });
                
                // Reload data
                const newSnap = await getDoc(xpRef);
                this.xpData = newSnap.data();
                return true; // New day, can reward
            }
            
            // Check if user has reached the daily limit
            if (data.dailyRewards.count >= this.dailyXPLimit) {
                console.log(`XP System: Daily limit reached (${this.dailyXPLimit}/${this.dailyXPLimit}) - No more XP today`);
                
                // Show notification that daily limit is reached
                this.showDailyLimitNotification();
                
                return false; // Limit reached
            }
            
            return true; // Within limit
        } catch (error) {
            console.error('XP System: Error checking daily reward limit:', error);
            return false;
        }
    }

    // NEW: Track daily reward usage
    async trackDailyReward(reason) {
        try {
            if (!this.currentUser || !this.xpData) return;
            
            const today = new Date().toDateString();
            const xpRef = doc(db, 'xpData', this.currentUser.uid);
            
            const rewardEntry = {
                reason: reason,
                timestamp: Timestamp.now()
            };
            
            // Update daily rewards count and list
            await updateDoc(xpRef, {
                'dailyRewards.count': increment(1),
                'dailyRewards.rewards': arrayUnion(rewardEntry)
            });
            
            // Reload data
            const xpSnap = await getDoc(xpRef);
            this.xpData = xpSnap.data();
            
            console.log(`XP System: Daily reward tracked (${this.xpData.dailyRewards.count}/${this.dailyXPLimit})`);
        } catch (error) {
            console.error('XP System: Error tracking daily reward:', error);
        }
    }

    // NEW: Show notification when daily limit is reached
    showDailyLimitNotification() {
        if (window.location.pathname.includes('xp.html')) return;
        
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            bottom: 100px;
            right: 20px;
            background: linear-gradient(135deg, #ff6b6b, #ff4757);
            color: white;
            padding: 15px 25px;
            border-radius: 25px;
            font-weight: bold;
            font-size: 14px;
            z-index: 9999;
            display: flex;
            align-items: center;
            gap: 10px;
            box-shadow: 0 5px 15px rgba(255, 71, 87, 0.3);
            animation: slideInRight 0.3s ease-out;
        `;
        
        notification.innerHTML = `
            <span style="font-size: 20px;">⏰</span>
            <div>
                <div style="font-weight: bold;">Daily Limit Reached!</div>
                <div style="font-size: 12px; opacity: 0.9;">Come back tomorrow for more XP</div>
            </div>
            <button onclick="this.parentElement.remove()" style="
                background: transparent;
                border: none;
                color: white;
                font-size: 18px;
                cursor: pointer;
                margin-left: 10px;
                opacity: 0.8;
            ">×</button>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 4000);
        
        if (!document.getElementById('slideInRightAnimation')) {
            const style = document.createElement('style');
            style.id = 'slideInRightAnimation';
            style.textContent = `
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }
    }

    // MODIFIED: addXP with daily limit check
    async addXP(amount, reason) {
        try {
            if (!this.currentUser || !this.xpData) return false;
            
            // NEW: Check daily limit for non-bonus rewards
            // Skip limit check for level up bonuses and welcome bonus
            const skipLimitCheck = reason.includes("Level") || reason.includes("Welcome") || reason.includes("Daily Login");
            
            if (!skipLimitCheck) {
                const canAward = await this.checkDailyRewardLimit(reason);
                if (!canAward) {
                    console.log(`XP System: Daily limit reached - not awarding ${amount} XP for "${reason}"`);
                    return false;
                }
            }
            
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
                coins: increment(Math.floor(amount / 10)),
                updated: Timestamp.now(),
                xpHistory: arrayUnion(historyItem)
            });
            
            // NEW: Track daily reward (skip for level up and welcome bonuses)
            if (!skipLimitCheck) {
                await this.trackDailyReward(reason);
            }
            
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
                
                // Add bonus coins for leveling up (this doesn't count toward daily XP limit)
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
        return XP_RANKS[currentLevel];
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
                    // Give daily XP (this doesn't count toward the 2-reward limit)
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
                    // NEW: Check daily limit before awarding online XP
                    const canAward = await this.checkDailyRewardLimit("3 Minutes Online");
                    if (canAward) {
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
            }
        }, 60000);
    }

    stopOnlineTimer() {
        if (this.onlineTimer) {
            clearInterval(this.onlineTimer);
            this.onlineTimer = null;
        }
    }

    // ==================== NOTIFICATIONS & ANIMATIONS ====================
    showWelcomeNotification() {
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
        
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
        
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
        if (window.location.pathname.includes('xp.html')) return;
        
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
        
        setTimeout(() => {
            if (xpElement.parentElement) {
                xpElement.remove();
            }
        }, 2000);
        
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
        
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 3000);
        
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

    // ==================== PROFILE PAGE INTEGRATION (FIXED) ====================
    async updateProfileDisplay() {
        // Check if we're on profile.html
        if (!window.location.pathname.includes('profile.html')) {
            console.log('XP System: Not on profile page');
            return;
        }
        
        console.log('XP System: Updating profile display');
        
        // Get the profile user ID - this is the key fix
        let profileUserId = await this.getProfileUserId();
        
        if (!profileUserId) {
            console.log('XP System: Could not determine profile user ID');
            return;
        }
        
        console.log('XP System: Profile user ID:', profileUserId);
        console.log('XP System: Current logged in user:', this.currentUser?.uid);
        
        // Load the profile user's XP data
        const profileXPData = await this.getUserXPData(profileUserId);
        
        if (!profileXPData) {
            console.log('XP System: No XP data found for profile user');
            return;
        }
        
        // Add simple XP icon to profile
        this.addSimpleXPIcon(profileXPData, profileUserId);
    }
    
    async getProfileUserId() {
        // Method 1: Check URL parameters (most common for viewing other profiles)
        const urlParams = new URLSearchParams(window.location.search);
        let userId = urlParams.get('uid') || urlParams.get('userId') || urlParams.get('id');
        
        if (userId) {
            console.log('XP System: Found user ID in URL params:', userId);
            return userId;
        }
        
        // Method 2: Check if there's a data attribute on the profile container
        const profileContainer = document.querySelector('[data-user-id], .profile-container, .profile-header');
        if (profileContainer) {
            const dataUserId = profileContainer.dataset.userId;
            if (dataUserId) {
                console.log('XP System: Found user ID in data attribute:', dataUserId);
                return dataUserId;
            }
        }
        
        // Method 3: Look for user ID in hidden input fields
        const userIdInput = document.querySelector('input[name="userId"], input[name="uid"], #userId, #profileUserId');
        if (userIdInput) {
            const inputValue = userIdInput.value;
            if (inputValue) {
                console.log('XP System: Found user ID in input field:', inputValue);
                return inputValue;
            }
        }
        
        // Method 4: Try to extract from profile URL structure (e.g., /profile/12345)
        const pathMatch = window.location.pathname.match(/\/profile\/([^\/]+)/);
        if (pathMatch && pathMatch[1]) {
            console.log('XP System: Found user ID in path:', pathMatch[1]);
            return pathMatch[1];
        }
        
        // Method 5: Look for user ID in the page content
        const userIdElement = document.querySelector('.user-id, .profile-id, [class*="userId"]');
        if (userIdElement) {
            const textContent = userIdElement.textContent || userIdElement.innerText;
            if (textContent && textContent.trim()) {
                console.log('XP System: Found user ID in element text:', textContent.trim());
                return textContent.trim();
            }
        }
        
        // Method 6: Check if we're on the current user's profile (no UID parameter means own profile)
        if (this.currentUser) {
            console.log('XP System: No profile ID found, assuming current user\'s profile:', this.currentUser.uid);
            return this.currentUser.uid;
        }
        
        return null;
    }

    async getUserXPData(userId) {
        try {
            console.log('XP System: Fetching XP data for user:', userId);
            const xpRef = doc(db, 'xpData', userId);
            const xpSnap = await getDoc(xpRef);
            
            if (xpSnap.exists()) {
                console.log('XP System: XP data found for user:', userId);
                return xpSnap.data();
            } else {
                console.log('XP System: No XP data found for user:', userId);
                // Return default XP data for users who haven't earned any XP yet
                return {
                    totalXP: 0,
                    coins: 0,
                    currentLevel: 1
                };
            }
        } catch (error) {
            console.error('XP System: Error loading user XP data:', error);
            return null;
        }
    }

    addSimpleXPIcon(xpData, userId) {
        // Find profile header or container
        const profileHeader = document.querySelector('.profile-header, .profile-container, .user-profile, .profile-section');
        if (!profileHeader) {
            console.log('XP System: Could not find profile header element');
            return;
        }
        
        // Remove any existing XP displays
        const existingXP = document.querySelector('.xp-profile-icon');
        if (existingXP) existingXP.remove();
        
        // Calculate level
        let level = 1;
        let rank = XP_RANKS[0];
        
        if (xpData && xpData.totalXP) {
            for (let i = XP_RANKS.length - 1; i >= 0; i--) {
                if (xpData.totalXP >= XP_RANKS[i].xpNeeded) {
                    level = XP_RANKS[i].level;
                    rank = XP_RANKS[i];
                    break;
                }
            }
        }
        
        // Create simple XP icon
        const xpIcon = document.createElement('div');
        xpIcon.className = 'xp-profile-icon';
        xpIcon.setAttribute('data-user-id', userId);
        xpIcon.style.cssText = `
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #667eea, #764ba2);
            border-radius: 30px;
            padding: 6px 14px;
            margin: 10px;
            color: white;
            font-weight: bold;
            font-size: 14px;
            box-shadow: 0 4px 10px rgba(0,0,0,0.2);
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
            border: 1px solid rgba(255,255,255,0.2);
        `;
        
        xpIcon.innerHTML = `
            <span style="margin-right: 6px; font-size: 16px;">${rank.icon}</span>
            <span>Lvl ${level}</span>
            <span style="margin: 0 6px;">•</span>
            <span>${xpData?.totalXP || 0} XP</span>
        `;
        
        // Add hover effect
        xpIcon.addEventListener('mouseenter', () => {
            xpIcon.style.transform = 'scale(1.05)';
            xpIcon.style.boxShadow = '0 6px 15px rgba(102, 126, 234, 0.4)';
        });
        xpIcon.addEventListener('mouseleave', () => {
            xpIcon.style.transform = 'scale(1)';
            xpIcon.style.boxShadow = '0 4px 10px rgba(0,0,0,0.2)';
        });
        
        // Add click to show details
        xpIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showQuickStats(xpData, level, userId, e.target);
        });
        
        // Insert at the top of profile header
        if (profileHeader.firstChild) {
            profileHeader.insertBefore(xpIcon, profileHeader.firstChild);
        } else {
            profileHeader.appendChild(xpIcon);
        }
        
        console.log('XP System: Added XP icon for user:', userId);
    }

    showQuickStats(xpData, level, userId, targetElement) {
        // Remove any existing tooltips
        const existingTooltip = document.querySelector('.xp-quick-stats');
        if (existingTooltip) existingTooltip.remove();
        
        const rank = XP_RANKS[level - 1] || XP_RANKS[0];
        const nextRank = XP_RANKS[level] || null;
        
        // Calculate progress
        let progress = 0;
        let xpToNext = 0;
        
        if (nextRank && xpData) {
            xpToNext = nextRank.xpNeeded - xpData.totalXP;
            const xpInCurrent = xpData.totalXP - rank.xpNeeded;
            const xpNeeded = nextRank.xpNeeded - rank.xpNeeded;
            progress = (xpInCurrent / xpNeeded) * 100;
        }
        
        // Create tooltip/popup
        const tooltip = document.createElement('div');
        tooltip.className = 'xp-quick-stats';
        tooltip.style.cssText = `
            position: absolute;
            background: white;
            border-radius: 15px;
            padding: 20px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            z-index: 10000;
            min-width: 280px;
            animation: fadeIn 0.2s ease-out;
            border: 1px solid #e0e0e0;
        `;
        
        tooltip.innerHTML = `
            <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
                <div style="font-size: 40px; background: ${rank.color}20; padding: 10px; border-radius: 50%;">${rank.icon}</div>
                <div>
                    <div style="font-weight: bold; font-size: 18px; color: #333;">${rank.title}</div>
                    <div style="color: #666; font-size: 14px;">Level ${level}</div>
                </div>
            </div>
            <div style="margin-bottom: 15px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px;">
                    <span style="color: #666;">Total XP:</span>
                    <span style="font-weight: bold; color: #667eea;">${xpData?.totalXP || 0}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px;">
                    <span style="color: #666;">Coins:</span>
                    <span style="font-weight: bold; color: #f1c40f;">🪙 ${xpData?.coins || 0}</span>
                </div>
                ${nextRank ? `
                    <div style="margin-top: 15px;">
                        <div style="font-size: 13px; color: #666; margin-bottom: 5px; display: flex; justify-content: space-between;">
                            <span>Next: ${nextRank.title}</span>
                            <span style="font-weight: bold;">${xpToNext} XP needed</span>
                        </div>
                        <div style="width: 100%; height: 8px; background: #e0e0e0; border-radius: 4px; overflow: hidden;">
                            <div style="width: ${progress}%; height: 100%; background: linear-gradient(90deg, #667eea, #764ba2);"></div>
                        </div>
                    </div>
                ` : '<div style="color: #f1c40f; text-align: center; margin-top: 10px; font-weight: bold;">🏆 MAX LEVEL ACHIEVED!</div>'}
            </div>
            <div style="font-size: 11px; color: #999; text-align: center; margin-top: 10px; padding-top: 10px; border-top: 1px solid #eee;">
                Click anywhere to close
            </div>
        `;
        
        // Position near the clicked element
        const rect = targetElement.getBoundingClientRect();
        tooltip.style.top = `${rect.bottom + window.scrollY + 10}px`;
        tooltip.style.left = `${rect.left + window.scrollX}px`;
        
        document.body.appendChild(tooltip);
        
        // Remove on click outside
        setTimeout(() => {
            const clickHandler = (e) => {
                if (!tooltip.contains(e.target) && e.target !== targetElement) {
                    tooltip.remove();
                    document.removeEventListener('click', clickHandler);
                }
            };
            document.addEventListener('click', clickHandler);
        }, 100);
        
        // Add animation style if not exists
        if (!document.getElementById('fadeInAnimation')) {
            const style = document.createElement('style');
            style.id = 'fadeInAnimation';
            style.textContent = `
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
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
        
        if (this.xpData) {
            const userLevel = this.getCurrentLevel();
            if (userLevel >= 10) {
                milestones[5].completed = true;
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

    // NEW: Get remaining daily rewards
    getRemainingDailyRewards() {
        if (!this.xpData || !this.xpData.dailyRewards) {
            return this.dailyXPLimit;
        }
        
        const today = new Date().toDateString();
        
        // Reset if it's a new day
        if (this.xpData.dailyRewards.date !== today) {
            return this.dailyXPLimit;
        }
        
        const used = this.xpData.dailyRewards.count || 0;
        return Math.max(0, this.dailyXPLimit - used);
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
            nextRank: this.getNextRank(),
            // NEW: Include daily reward info in stats
            dailyRewardsRemaining: this.getRemainingDailyRewards(),
            dailyRewardLimit: this.dailyXPLimit
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
window.getRemainingDailyRewards = () => xpSystem.getRemainingDailyRewards(); // NEW

// Function to initialize XP system from other pages
window.initializeXPSystem = function() {
    return xpSystem.initialize();
};

// Function to manually refresh profile display (can be called from profile page)
window.refreshProfileXP = function() {
    if (xpSystem) {
        xpSystem.updateProfileDisplay();
    }
};

console.log('XP System: Module loaded successfully');
// At the very end of XP.js, after all your code
export { XPSystem, xpSystem };