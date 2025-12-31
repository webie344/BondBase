// gaming.js - COMPLETE Independent Gaming System with ALL Firebase Setup
// Copy and paste this entire file - it works standalone

import { 
    getFirestore, 
    collection, 
    doc, 
    setDoc, 
    getDoc, 
    updateDoc, 
    query, 
    where, 
    getDocs,
    onSnapshot,
    serverTimestamp,
    arrayUnion,
    arrayRemove,
    increment,
    writeBatch
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { 
    getAuth, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

// ============ FIREBASE CONFIGURATION ============
const firebaseConfig = {
    apiKey: "AIzaSyC9uL_BX14Z6rRpgG4MT9Tca1opJl8EviQ",
    authDomain: "dating-connect.firebaseapp.com",
    projectId: "dating-connect",
    storageBucket: "dating-connect.appspot.com",
    messagingSenderId: "1062172180210",
    appId: "1:1062172180210:web:0c9b3c1578a5dbae58da6b"
};

// ============ INITIALIZE FIREBASE ============
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ============ GAMING SYSTEM CLASS ============
class GamingSystem {
    constructor() {
        console.log('🎮 Gaming System Initializing...');
        
        // Core Systems
        this.currentUser = null;
        this.currentGroup = null;
        this.isConnected = false;
        
        // Activity Energy System
        this.energy = {
            current: 50,
            max: 100,
            min: 0,
            decayRate: 0.5,
            lastUpdate: Date.now(),
            mode: 'calm',
            streak: 0,
            dailyHigh: 0
        };
        
        // Real-time Tracking
        this.userActivity = {
            startTime: Date.now(),
            lastInteraction: Date.now(),
            isTyping: false,
            viewTime: 0,
            messageCount: 0,
            reactionCount: 0,
            replyCount: 0
        };
        
        this.typingIndicators = new Map();
        this.activeUsers = new Map();
        this.messageQuality = [];
        
        // Visual Effects Storage
        this.visuals = {
            mode: 'calm',
            intensity: 0.1,
            particles: [],
            ambientMotion: 0,
            colorShift: 0
        };
        
        // User Rewards
        this.rewards = {
            aura: false,
            avatarRing: false,
            title: '',
            highlight: false,
            trail: false,
            observer: false,
            timeBased: '',
            streakBonus: 0
        };
        
        // Initialize
        this.setupAuth();
        this.setupCSS();
        this.setupEventListeners();
        
        console.log('✅ Gaming System Ready');
    }
    
    // ============ AUTHENTICATION ============
    setupAuth() {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                this.currentUser = {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName || 'User'
                };
                await this.loadUserData();
                console.log(`👤 User loaded: ${this.currentUser.displayName}`);
                this.emitEvent('authReady', this.currentUser);
            } else {
                this.currentUser = null;
                console.log('👤 No user logged in');
            }
        });
    }
    
    async loadUserData() {
        try {
            const userRef = doc(db, 'gaming_users', this.currentUser.uid);
            const userSnap = await getDoc(userRef);
            
            if (userSnap.exists()) {
                const data = userSnap.data();
                this.userActivity = { ...this.userActivity, ...data.activity };
                this.rewards = { ...this.rewards, ...data.rewards };
            } else {
                // Create new user profile
                await setDoc(userRef, {
                    uid: this.currentUser.uid,
                    email: this.currentUser.email,
                    displayName: this.currentUser.displayName,
                    activity: this.userActivity,
                    rewards: this.rewards,
                    totalScore: 0,
                    createdAt: serverTimestamp(),
                    lastActive: serverTimestamp()
                });
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    }
    
    // ============ CSS SETUP ============
    setupCSS() {
        const style = document.createElement('style');
        style.textContent = `
            /* Energy Indicator */
            .energy-bar {
                position: fixed;
                top: 10px;
                right: 10px;
                width: 120px;
                height: 20px;
                background: rgba(0,0,0,0.3);
                border-radius: 10px;
                overflow: hidden;
                z-index: 9999;
                border: 2px solid rgba(255,255,255,0.1);
            }
            
            .energy-fill {
                height: 100%;
                background: linear-gradient(90deg, #ff0000, #ffff00, #00ff00);
                transition: width 0.5s ease;
                width: 50%;
            }
            
            .energy-mode {
                position: fixed;
                top: 35px;
                right: 10px;
                color: white;
                font-size: 11px;
                text-transform: uppercase;
                letter-spacing: 1px;
                font-weight: bold;
                z-index: 9999;
                text-shadow: 0 1px 2px rgba(0,0,0,0.5);
            }
            
            /* Typing Indicators */
            .typing-container {
                position: fixed;
                bottom: 80px;
                left: 20px;
                background: rgba(0,0,0,0.7);
                color: white;
                padding: 10px 15px;
                border-radius: 15px;
                font-size: 12px;
                z-index: 9998;
                display: flex;
                align-items: center;
                gap: 8px;
                backdrop-filter: blur(10px);
            }
            
            .typing-dots {
                display: flex;
                gap: 4px;
            }
            
            .typing-dot {
                width: 6px;
                height: 6px;
                background: #4CAF50;
                border-radius: 50%;
                animation: typingBounce 1.4s infinite;
            }
            
            .typing-dot:nth-child(2) { animation-delay: 0.2s; }
            .typing-dot:nth-child(3) { animation-delay: 0.4s; }
            
            @keyframes typingBounce {
                0%, 60%, 100% { transform: translateY(0); }
                30% { transform: translateY(-5px); }
            }
            
            /* Visual Modes */
            .mode-calm {
                --bg-intensity: 0.1;
                --glow-intensity: 0;
            }
            
            .mode-pulse {
                --bg-intensity: 0.3;
                --glow-intensity: 0.3;
                animation: pulseGlow 2s infinite alternate;
            }
            
            .mode-flow {
                --bg-intensity: 0.5;
                --glow-intensity: 0.5;
                animation: flowWave 3s infinite linear;
            }
            
            .mode-focus {
                --bg-intensity: 0.2;
                --glow-intensity: 0.7;
            }
            
            .mode-surge {
                --bg-intensity: 0.8;
                --glow-intensity: 1;
                animation: surgeFlash 1s infinite;
            }
            
            .mode-afterglow {
                --bg-intensity: 0.4;
                --glow-intensity: 0.6;
                animation: afterglowFade 4s infinite;
            }
            
            @keyframes pulseGlow {
                0% { box-shadow: 0 0 10px rgba(102, 126, 234, 0.3); }
                100% { box-shadow: 0 0 20px rgba(102, 126, 234, 0.6); }
            }
            
            @keyframes flowWave {
                0% { background-position: 0% 50%; }
                100% { background-position: 100% 50%; }
            }
            
            @keyframes surgeFlash {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.7; }
            }
            
            @keyframes afterglowFade {
                0% { opacity: 1; }
                50% { opacity: 0.8; }
                100% { opacity: 1; }
            }
            
            /* User Rewards */
            .user-aura {
                position: relative;
            }
            
            .user-aura::after {
                content: '';
                position: absolute;
                top: -5px;
                left: -5px;
                right: -5px;
                bottom: -5px;
                border-radius: 50%;
                background: radial-gradient(circle, rgba(255,215,0,0.3) 0%, transparent 70%);
                animation: auraPulse 3s infinite;
                pointer-events: none;
                z-index: 1;
            }
            
            @keyframes auraPulse {
                0%, 100% { transform: scale(1); opacity: 0.3; }
                50% { transform: scale(1.1); opacity: 0.6; }
            }
            
            /* Ambient Background */
            .ambient-bg {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: -1;
                opacity: var(--bg-intensity, 0.1);
                background: radial-gradient(circle at 50% 50%, rgba(102, 126, 234, 0.1) 0%, transparent 50%);
                transition: opacity 2s ease;
            }
        `;
        document.head.appendChild(style);
    }
    
    // ============ EVENT SYSTEM ============
    setupEventListeners() {
        // Track user activity
        document.addEventListener('click', () => this.recordActivity());
        document.addEventListener('keydown', () => this.recordActivity());
        document.addEventListener('scroll', () => this.recordActivity());
        document.addEventListener('mousemove', () => this.recordActivity());
        
        // Visibility tracking
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pauseActivity();
            } else {
                this.resumeActivity();
            }
        });
        
        // Start energy updates
        setInterval(() => this.updateEnergy(), 30000); // Every 30 seconds
        setInterval(() => this.updateVisuals(), 1000); // Every second
    }
    
    // ============ CORE ENERGY SYSTEM ============
    async updateEnergy() {
        if (!this.currentGroup) return;
        
        const now = Date.now();
        const minutesPassed = (now - this.energy.lastUpdate) / 60000;
        
        // Energy decay
        let decay = minutesPassed * this.energy.decayRate;
        this.energy.current = Math.max(this.energy.min, this.energy.current - decay);
        
        // Activity boost
        const activityBoost = await this.calculateActivityBoost();
        this.energy.current = Math.min(this.energy.max, this.energy.current + activityBoost);
        
        this.energy.lastUpdate = now;
        
        // Update mode based on energy
        this.updateMode();
        
        // Save to Firebase
        await this.saveEnergy();
        
        // Update UI
        this.updateEnergyUI();
        
        console.log(`⚡ Energy: ${this.energy.current.toFixed(1)} | Mode: ${this.energy.mode}`);
    }
    
    async calculateActivityBoost() {
        if (!this.currentGroup) return 0;
        
        try {
            let boost = 0;
            
            // 1. Recent messages (last 2 minutes)
            const messagesRef = collection(db, 'groups', this.currentGroup, 'messages');
            const twoMinutesAgo = new Date(Date.now() - 2 * 60000);
            const q = query(messagesRef, where('timestamp', '>', twoMinutesAgo));
            const snapshot = await getDocs(q);
            
            // Message boost
            boost += snapshot.size * 1.5;
            
            // Message quality boost
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.text) {
                    const length = data.text.length;
                    if (length > 50) boost += 0.5;
                    if (length > 100) boost += 1;
                    if (length > 200) boost += 2;
                    if (data.replyTo) boost += 1.5; // Reply bonus
                }
            });
            
            // 2. Typing activity
            const typingRef = collection(db, 'groups', this.currentGroup, 'typing');
            const typingSnap = await getDocs(typingRef);
            const typingCount = Array.from(typingSnap.docs).filter(doc => doc.data().isTyping).length;
            boost += typingCount * 0.3;
            
            // 3. Active users
            const activeCount = await this.getActiveUserCount();
            boost += activeCount * 0.2;
            
            // 4. Time of day bonus
            const hour = new Date().getHours();
            if (hour >= 0 && hour < 6) boost *= 1.3; // Night bonus
            if (hour >= 22 || hour < 8) boost *= 1.2; // Off-peak bonus
            
            // 5. Low activity boost (revive dead chats)
            if (this.energy.current < 20) {
                boost *= 1.5;
                console.log('🔥 Low activity boost activated!');
            }
            
            return boost;
            
        } catch (error) {
            console.error('Error calculating activity boost:', error);
            return 0;
        }
    }
    
    async getActiveUserCount() {
        try {
            const activityRef = collection(db, 'gaming_activity');
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60000);
            const q = query(activityRef, 
                where('groupId', '==', this.currentGroup),
                where('lastActive', '>', fiveMinutesAgo)
            );
            const snapshot = await getDocs(q);
            return snapshot.size;
        } catch (error) {
            console.error('Error getting active users:', error);
            return 1;
        }
    }
    
    updateMode() {
        const energy = this.energy.current;
        let newMode = 'calm';
        
        if (energy >= 80) newMode = 'surge';
        else if (energy >= 65) newMode = 'flow';
        else if (energy >= 50) newMode = 'pulse';
        else if (energy >= 35) newMode = 'focus';
        else if (energy >= 20) newMode = 'calm';
        else newMode = 'calm';
        
        // Afterglow mode (after surge)
        if (this.energy.mode === 'surge' && energy < 65) {
            newMode = 'afterglow';
            setTimeout(() => this.energy.mode = newMode, 5000); // 5 second afterglow
            return;
        }
        
        if (newMode !== this.energy.mode) {
            this.energy.mode = newMode;
            this.applyVisualMode(newMode);
            this.playModeSound(newMode);
        }
    }
    
    // ============ VISUAL SYSTEM ============
    applyVisualMode(mode) {
        // Remove all mode classes
        document.body.classList.remove(
            'mode-calm', 'mode-pulse', 'mode-flow', 
            'mode-focus', 'mode-surge', 'mode-afterglow'
        );
        
        // Add new mode
        document.body.classList.add(`mode-${mode}`);
        
        // Update visuals
        this.visuals.mode = mode;
        this.visuals.intensity = this.getModeIntensity(mode);
        
        // Create ambient background if not exists
        this.createAmbientBackground();
        
        // Emit mode change event
        this.emitEvent('modeChange', { mode, energy: this.energy.current });
    }
    
    getModeIntensity(mode) {
        const intensities = {
            calm: 0.1,
            pulse: 0.3,
            flow: 0.5,
            focus: 0.2,
            surge: 0.8,
            afterglow: 0.4
        };
        return intensities[mode] || 0.1;
    }
    
    createAmbientBackground() {
        let ambient = document.querySelector('.ambient-bg');
        if (!ambient) {
            ambient = document.createElement('div');
            ambient.className = 'ambient-bg';
            document.body.appendChild(ambient);
        }
        
        ambient.style.opacity = this.visuals.intensity;
    }
    
    updateVisuals() {
        const ambient = document.querySelector('.ambient-bg');
        if (ambient) {
            // Gentle movement
            const time = Date.now() / 1000;
            const x = 50 + Math.sin(time * 0.5) * 10;
            const y = 50 + Math.cos(time * 0.3) * 10;
            ambient.style.background = `radial-gradient(circle at ${x}% ${y}%, 
                rgba(102, 126, 234, ${this.visuals.intensity * 0.3}) 0%, 
                transparent 60%)`;
        }
    }
    
    updateEnergyUI() {
        // Create or update energy bar
        let energyBar = document.querySelector('.energy-bar');
        if (!energyBar) {
            energyBar = document.createElement('div');
            energyBar.className = 'energy-bar';
            
            const energyFill = document.createElement('div');
            energyFill.className = 'energy-fill';
            energyBar.appendChild(energyFill);
            
            const energyMode = document.createElement('div');
            energyMode.className = 'energy-mode';
            
            document.body.appendChild(energyBar);
            document.body.appendChild(energyMode);
        }
        
        const fill = energyBar.querySelector('.energy-fill');
        const modeText = document.querySelector('.energy-mode');
        
        if (fill) fill.style.width = `${this.energy.current}%`;
        if (modeText) {
            modeText.textContent = `${this.energy.mode.toUpperCase()} ${Math.round(this.energy.current)}%`;
            modeText.style.color = this.getModeColor(this.energy.mode);
        }
    }
    
    getModeColor(mode) {
        const colors = {
            calm: '#4CAF50',
            pulse: '#2196F3',
            flow: '#9C27B0',
            focus: '#FF9800',
            surge: '#F44336',
            afterglow: '#FFC107'
        };
        return colors[mode] || '#4CAF50';
    }
    
    playModeSound(mode) {
        // Simple Web Audio API for subtle sounds
        if (!window.AudioContext) return;
        
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            // Different frequencies for different modes
            const frequencies = {
                calm: 220,
                pulse: 330,
                flow: 440,
                focus: 550,
                surge: 660,
                afterglow: 385
            };
            
            oscillator.frequency.value = frequencies[mode] || 220;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.01, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.5);
            
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.5);
            
        } catch (error) {
            console.log('Audio not supported');
        }
    }
    
    // ============ TYPING INDICATORS ============
    async startTyping() {
        if (!this.currentUser || !this.currentGroup) return;
        
        this.userActivity.isTyping = true;
        
        try {
            const typingRef = doc(db, 'groups', this.currentGroup, 'typing', this.currentUser.uid);
            await setDoc(typingRef, {
                userId: this.currentUser.uid,
                userName: this.currentUser.displayName,
                isTyping: true,
                timestamp: serverTimestamp()
            }, { merge: true });
        } catch (error) {
            console.error('Error updating typing status:', error);
        }
    }
    
    async stopTyping() {
        if (!this.currentUser || !this.currentGroup) return;
        
        this.userActivity.isTyping = false;
        
        try {
            const typingRef = doc(db, 'groups', this.currentGroup, 'typing', this.currentUser.uid);
            await updateDoc(typingRef, {
                isTyping: false,
                timestamp: serverTimestamp()
            });
        } catch (error) {
            console.error('Error stopping typing:', error);
        }
    }
    
    listenToTyping(callback) {
        if (!this.currentGroup) return;
        
        const typingRef = collection(db, 'groups', this.currentGroup, 'typing');
        
        return onSnapshot(typingRef, (snapshot) => {
            const typingUsers = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.isTyping && data.userId !== this.currentUser?.uid) {
                    typingUsers.push(data.userName);
                }
            });
            
            this.updateTypingUI(typingUsers);
            if (callback) callback(typingUsers);
        });
    }
    
    updateTypingUI(typingUsers) {
        // Remove existing indicator
        let indicator = document.querySelector('.typing-container');
        
        if (typingUsers.length === 0) {
            if (indicator) indicator.remove();
            return;
        }
        
        // Create or update indicator
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.className = 'typing-container';
            
            const dots = document.createElement('div');
            dots.className = 'typing-dots';
            dots.innerHTML = `
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            `;
            
            indicator.appendChild(dots);
            
            const text = document.createElement('span');
            text.className = 'typing-text';
            indicator.appendChild(text);
            
            document.body.appendChild(indicator);
        }
        
        const textElement = indicator.querySelector('.typing-text');
        if (textElement) {
            const names = typingUsers.join(', ');
            textElement.textContent = `${names} ${typingUsers.length === 1 ? 'is' : 'are'} typing...`;
        }
    }
    
    // ============ MESSAGE TRACKING ============
    async trackMessage(message) {
        if (!this.currentUser || !this.currentGroup) return;
        
        // Calculate message score
        const score = this.calculateMessageScore(message);
        
        // Update user score
        await this.updateUserScore('message', score);
        
        // Add to energy
        this.energy.current = Math.min(this.energy.max, this.energy.current + (score / 10));
        
        // Update message quality tracking
        this.updateMessageStats(message);
        
        // Save energy
        await this.saveEnergy();
        
        console.log(`📝 Message tracked: +${score} points`);
    }
    
    calculateMessageScore(message) {
        let score = 10; // Base score
        
        // Length bonus
        if (message.text) {
            const length = message.text.length;
            if (length > 50) score += 5;
            if (length > 100) score += 10;
            if (length > 200) score += 20;
        }
        
        // Reply bonus
        if (message.replyTo) {
            score += 15;
            // Extra for deep conversations
            if (this.messages.replyDepth > 3) score += 10;
        }
        
        // Media bonus
        if (message.imageUrl || message.videoUrl) {
            score += 25;
        }
        
        // Time bonus
        const hour = new Date().getHours();
        if (hour >= 0 && hour < 6) score += 20; // Night
        if (hour >= 6 && hour < 10) score += 15; // Morning
        
        // Low energy boost
        if (this.energy.current < 30) {
            score = Math.floor(score * 1.5);
        }
        
        return score;
    }
    
    updateMessageStats(message) {
        // Store recent message for analytics
        this.messages.recent.push({
            text: message.text,
            length: message.text?.length || 0,
            hasReply: !!message.replyTo,
            timestamp: Date.now()
        });
        
        // Keep only last 50 messages
        if (this.messages.recent.length > 50) {
            this.messages.recent.shift();
        }
        
        // Update average length
        const totalLength = this.messages.recent.reduce((sum, msg) => sum + msg.length, 0);
        this.messages.averageLength = totalLength / this.messages.recent.length;
    }
    
    // ============ USER SCORES & REWARDS ============
    async updateUserScore(type, score) {
        if (!this.currentUser) return;
        
        try {
            const userRef = doc(db, 'gaming_users', this.currentUser.uid);
            
            await updateDoc(userRef, {
                [`scores.${type}`]: increment(score),
                totalScore: increment(score),
                lastActive: serverTimestamp(),
                [`activity.${type}Count`]: increment(1)
            });
            
            // Check for rewards
            await this.checkRewards();
            
        } catch (error) {
            console.error('Error updating user score:', error);
        }
    }
    
    async checkRewards() {
        try {
            const userRef = doc(db, 'gaming_users', this.currentUser.uid);
            const userSnap = await getDoc(userRef);
            
            if (!userSnap.exists()) return;
            
            const data = userSnap.data();
            const totalScore = data.totalScore || 0;
            const activity = data.activity || {};
            
            const newRewards = { ...this.rewards };
            
            // Aura for high scorers
            if (totalScore > 1000) newRewards.aura = true;
            
            // Avatar ring for consistent activity
            if (activity.messageCount > 50) newRewards.avatarRing = true;
            
            // Title based on score
            if (totalScore > 5000) newRewards.title = 'Chat Champion';
            else if (totalScore > 2000) newRewards.title = 'Active Contributor';
            else if (totalScore > 500) newRewards.title = 'New Member';
            
            // Time-based rewards
            const hour = new Date().getHours();
            if (hour >= 0 && hour < 6) newRewards.timeBased = 'Night Owl';
            if (hour >= 6 && hour < 10) newRewards.timeBased = 'Early Bird';
            
            // Observer badge for long view time
            if (activity.viewTime > 3600000 && activity.messageCount < 10) {
                newRewards.observer = true;
            }
            
            // Save if rewards changed
            if (JSON.stringify(newRewards) !== JSON.stringify(this.rewards)) {
                this.rewards = newRewards;
                await updateDoc(userRef, { rewards: newRewards });
                this.applyRewards();
            }
            
        } catch (error) {
            console.error('Error checking rewards:', error);
        }
    }
    
    applyRewards() {
        // This would be called when rendering user elements
        // In your chat system, you would add classes based on rewards
        console.log('🏆 Rewards updated:', this.rewards);
    }
    
    // ============ ACTIVITY TRACKING ============
    recordActivity() {
        this.userActivity.lastInteraction = Date.now();
        
        // Auto-save every 30 seconds
        if (!this.lastSave || Date.now() - this.lastSave > 30000) {
            this.saveActivity();
            this.lastSave = Date.now();
        }
    }
    
    pauseActivity() {
        if (this.userActivity.startTime) {
            this.userActivity.viewTime += Date.now() - this.userActivity.startTime;
        }
    }
    
    resumeActivity() {
        this.userActivity.startTime = Date.now();
        this.recordActivity();
    }
    
    async saveActivity() {
        if (!this.currentUser || !this.currentGroup) return;
        
        try {
            const activityRef = doc(db, 'gaming_activity', this.currentUser.uid);
            
            await setDoc(activityRef, {
                userId: this.currentUser.uid,
                groupId: this.currentGroup,
                lastActive: serverTimestamp(),
                viewTime: this.userActivity.viewTime,
                isTyping: this.userActivity.isTyping,
                updatedAt: serverTimestamp()
            }, { merge: true });
            
        } catch (error) {
            console.error('Error saving activity:', error);
        }
    }
    
    async saveEnergy() {
        if (!this.currentGroup) return;
        
        try {
            const energyRef = doc(db, 'gaming_energy', this.currentGroup);
            
            await setDoc(energyRef, {
                groupId: this.currentGroup,
                energy: this.energy.current,
                mode: this.energy.mode,
                streak: this.energy.streak,
                dailyHigh: this.energy.dailyHigh,
                lastUpdate: serverTimestamp(),
                updatedAt: serverTimestamp()
            }, { merge: true });
            
        } catch (error) {
            console.error('Error saving energy:', error);
        }
    }
    
    // ============ PUBLIC API ============
    connect(groupId) {
        this.currentGroup = groupId;
        this.isConnected = true;
        
        // Load group energy
        this.loadGroupEnergy();
        
        // Start listening to typing
        this.typingListener = this.listenToTyping();
        
        // Create UI elements
        this.updateEnergyUI();
        this.createAmbientBackground();
        
        console.log(`🔗 Connected to group: ${groupId}`);
        this.emitEvent('connected', { groupId });
    }
    
    disconnect() {
        this.isConnected = false;
        this.currentGroup = null;
        
        // Stop listeners
        if (this.typingListener) this.typingListener();
        
        // Save final activity
        this.saveActivity();
        this.saveEnergy();
        
        // Clean up UI
        this.cleanupUI();
        
        console.log('🔗 Disconnected from group');
        this.emitEvent('disconnected');
    }
    
    async loadGroupEnergy() {
        if (!this.currentGroup) return;
        
        try {
            const energyRef = doc(db, 'gaming_energy', this.currentGroup);
            const energySnap = await getDoc(energyRef);
            
            if (energySnap.exists()) {
                const data = energySnap.data();
                this.energy.current = data.energy || 50;
                this.energy.mode = data.mode || 'calm';
                this.energy.streak = data.streak || 0;
                this.energy.dailyHigh = data.dailyHigh || 0;
                
                // Apply visual mode
                this.applyVisualMode(this.energy.mode);
                this.updateEnergyUI();
            }
        } catch (error) {
            console.error('Error loading group energy:', error);
        }
    }
    
    cleanupUI() {
        // Remove gaming UI elements
        const elements = [
            '.energy-bar',
            '.energy-mode',
            '.typing-container',
            '.ambient-bg'
        ];
        
        elements.forEach(selector => {
            const element = document.querySelector(selector);
            if (element) element.remove();
        });
        
        // Remove mode classes
        document.body.classList.remove(
            'mode-calm', 'mode-pulse', 'mode-flow',
            'mode-focus', 'mode-surge', 'mode-afterglow'
        );
    }
    
    // ============ EVENT EMITTER ============
    emitEvent(event, data) {
        const customEvent = new CustomEvent(`gaming:${event}`, { detail: data });
        document.dispatchEvent(customEvent);
    }
    
    // ============ GETTERS ============
    getEnergy() {
        return { ...this.energy };
    }
    
    getMode() {
        return this.energy.mode;
    }
    
    getUserScores() {
        return { ...this.userActivity };
    }
    
    getRewards() {
        return { ...this.rewards };
    }
    
    getStatus() {
        return {
            connected: this.isConnected,
            group: this.currentGroup,
            energy: this.energy.current,
            mode: this.energy.mode,
            user: this.currentUser?.displayName,
            rewards: this.rewards
        };
    }
}

// ============ GLOBAL INSTANCE ============
const gamingSystem = new GamingSystem();

// Auto-connect based on URL
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const groupId = urlParams.get('id');
    
    // Wait for auth to be ready
    document.addEventListener('gaming:authReady', () => {
        if (groupId) {
            setTimeout(() => {
                gamingSystem.connect(groupId);
            }, 1000);
        }
    });
});

// ============ GLOBAL EXPORTS ============
window.gamingSystem = gamingSystem;
window.startTyping = () => gamingSystem.startTyping();
window.stopTyping = () => gamingSystem.stopTyping();
window.trackMessage = (msg) => gamingSystem.trackMessage(msg);
window.getGamingStatus = () => gamingSystem.getStatus();

// Export for ES6 modules
export { gamingSystem };

console.log('🚀 Gaming System Loaded Successfully!');