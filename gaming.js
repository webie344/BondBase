// gaming.js - Complete Gaming Features System with Firebase Integration
// Features: Live activity, voice snippets, micro-games, achievements, modes, and more

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
    addDoc,
    serverTimestamp,
    onSnapshot,
    orderBy,
    limit,
    arrayUnion,
    arrayRemove,
    increment,
    deleteDoc,
    writeBatch,
    Timestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { 
    getAuth, 
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

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
const db = getFirestore(app);
const auth = getAuth(app);

const cloudinaryConfig = {
    cloudName: "ddtdqrh1b",
    uploadPreset: "profile-pictures",
    apiUrl: "https://api.cloudinary.com/v1_1"
};

const AVATAR_OPTIONS = [
    'https://api.dicebear.com/7.x/avataaars/svg?seed=user1',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=user2',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=user3',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=user4',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=user5',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=user6',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=user7',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=user8'
];

class GamingChat {
    constructor() {
        this.firebaseUser = null;
        this.currentUser = null;
        this.currentGroupId = null;
        
        // Activity tracking
        this.userPresence = new Map();
        this.typingUsers = new Map();
        this.spectators = new Map();
        this.recentJoiners = new Map();
        
        // Audio recording
        this.audioRecorder = null;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.recordingTimer = null;
        this.MAX_RECORDING_TIME = 30000; // 30 seconds
        
        // Micro-games
        this.activeGames = new Map();
        this.gameTemplates = this.initializeGameTemplates();
        this.userScores = new Map();
        this.reputationPoints = new Map();
        
        // Achievement system
        this.achievements = new Map();
        this.achievementQueue = [];
        this.achievementCheckInterval = null;
        
        // Group modes
        this.groupModes = new Map();
        this.modeVotes = new Map();
        this.activeMode = null;
        this.modeEndTime = null;
        
        // Visual effects
        this.particleSystem = null;
        this.animationFrame = null;
        this.audioEnabled = false;
        this.soundEffects = this.initializeSoundEffects();
        
        // Session tracking
        this.sessionStartTime = null;
        this.sessionTimerInterval = null;
        this.activityStats = {
            messagesSent: 0,
            reactionsGiven: 0,
            gamesPlayed: 0,
            voiceSnippets: 0,
            streak: 0,
            lastActivity: Date.now()
        };
        
        // User identities
        this.groupIdentities = new Map();
        this.equippedItems = new Map();
        this.achievementBadges = new Map();
        
        // Listeners
        this.unsubscribePresence = null;
        this.unsubscribeTyping = null;
        this.unsubscribeSpectators = null;
        this.unsubscribeGames = null;
        this.unsubscribeModes = null;
        
        this.setupAuthListener();
        this.initializeAudioSystem();
        this.setupAchievementChecker();
        
        console.log('GamingChat initialized');
    }
    
    // ========== AUTHENTICATION ==========
    
    setupAuthListener() {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                this.firebaseUser = user;
                console.log('Gaming system: User authenticated', user.uid);
                
                // Load user profile
                await this.loadUserProfile(user.uid);
                
                // If we have a current group, initialize activity tracking
                if (this.currentGroupId) {
                    await this.initializeGroupActivity(this.currentGroupId);
                }
                
                // Dispatch event that gaming system is ready
                document.dispatchEvent(new CustomEvent('gamingAuthReady'));
            } else {
                this.firebaseUser = null;
                this.currentUser = null;
                this.cleanup();
            }
        });
    }
    
    async loadUserProfile(userId) {
        try {
            const userRef = doc(db, 'group_users', userId);
            const userSnap = await getDoc(userRef);
            
            if (userSnap.exists()) {
                const userData = userSnap.data();
                this.currentUser = {
                    id: userId,
                    name: userData.displayName || 'User',
                    avatar: userData.avatar || AVATAR_OPTIONS[0],
                    bio: userData.bio || '',
                    email: userData.email || '',
                    lastSeen: userData.lastSeen ? 
                        (userData.lastSeen.toDate ? userData.lastSeen.toDate() : userData.lastSeen) : 
                        new Date(),
                    profileComplete: userData.displayName && userData.avatar ? true : false
                };
            } else {
                // Create minimal user profile
                this.currentUser = {
                    id: userId,
                    name: this.firebaseUser.email.split('@')[0] || 'User',
                    avatar: AVATAR_OPTIONS[0],
                    bio: '',
                    email: this.firebaseUser.email,
                    profileComplete: false
                };
            }
            
            console.log('Gaming system: User profile loaded', this.currentUser);
        } catch (error) {
            console.error('Error loading user profile for gaming:', error);
            this.currentUser = {
                id: userId,
                name: 'User',
                avatar: AVATAR_OPTIONS[0],
                bio: '',
                email: '',
                profileComplete: false
            };
        }
    }
    
    // ========== GROUP MANAGEMENT ==========
    
    async initializeGroupActivity(groupId) {
        console.log('Initializing gaming activity for group:', groupId);
        this.currentGroupId = groupId;
        
        // Cleanup previous listeners
        this.cleanupGroupListeners();
        
        // Initialize all gaming features for this group
        await Promise.all([
            this.listenToUserPresence(groupId),
            this.listenToTypingIndicators(groupId),
            this.listenToRecentJoiners(groupId),
            this.setupSpectatorTracking(groupId),
            this.listenToActiveGames(groupId),
            this.listenToActiveMode(groupId),
            this.loadGroupIdentity(groupId, this.firebaseUser?.uid)
        ]);
        
        // Create activity strip
        this.createActivityStrip(groupId);
        
        // Start session timer
        this.startSessionTimer();
        
        // Update own presence
        await this.updateUserPresence(groupId);
        
        // Show session timer
        this.showSessionTimer();
        
        console.log('Gaming activity initialized for group:', groupId);
    }
    
    cleanupGroupListeners() {
        if (this.unsubscribePresence) this.unsubscribePresence();
        if (this.unsubscribeTyping) this.unsubscribeTyping();
        if (this.unsubscribeSpectators) this.unsubscribeSpectators();
        if (this.unsubscribeGames) this.unsubscribeGames();
        if (this.unsubscribeModes) this.unsubscribeModes();
        
        this.unsubscribePresence = null;
        this.unsubscribeTyping = null;
        this.unsubscribeSpectators = null;
        this.unsubscribeGames = null;
        this.unsubscribeModes = null;
    }
    
    // ========== FIRST LAYER: Real-time Activity ==========
    
    async listenToUserPresence(groupId) {
        try {
            const presenceRef = collection(db, 'groups', groupId, 'presence');
            const q = query(presenceRef, where('lastSeen', '>=', Timestamp.fromDate(new Date(Date.now() - 300000))));
            
            this.unsubscribePresence = onSnapshot(q, (snapshot) => {
                snapshot.forEach(docSnap => {
                    const data = docSnap.data();
                    this.userPresence.set(docSnap.id, {
                        userId: docSnap.id,
                        name: data.name,
                        avatar: data.avatar,
                        status: data.status || 'online',
                        lastSeen: data.lastSeen?.toDate() || new Date(),
                        activity: data.activity || 'idle'
                    });
                });
                
                // Remove users not in snapshot
                const activeUserIds = new Set(snapshot.docs.map(doc => doc.id));
                for (const [userId] of this.userPresence) {
                    if (!activeUserIds.has(userId)) {
                        this.userPresence.delete(userId);
                    }
                }
                
                this.updateActivityStrip();
            }, (error) => {
                console.error('Error listening to presence:', error);
            });
            
            // Update own presence every 30 seconds
            const presenceInterval = setInterval(() => {
                if (this.currentGroupId === groupId) {
                    this.updateUserPresence(groupId);
                } else {
                    clearInterval(presenceInterval);
                }
            }, 30000);
            
        } catch (error) {
            console.error('Error setting up presence listener:', error);
        }
    }
    
    async updateUserPresence(groupId) {
        if (!this.firebaseUser || !this.currentUser) return;
        
        try {
            const presenceRef = doc(db, 'groups', groupId, 'presence', this.firebaseUser.uid);
            await setDoc(presenceRef, {
                userId: this.firebaseUser.uid,
                name: this.currentUser.name,
                avatar: this.currentUser.avatar,
                lastSeen: serverTimestamp(),
                status: 'online',
                activity: 'active'
            }, { merge: true });
        } catch (error) {
            console.error('Error updating presence:', error);
        }
    }
    
    async listenToTypingIndicators(groupId) {
        try {
            const typingRef = collection(db, 'groups', groupId, 'typing');
            
            this.unsubscribeTyping = onSnapshot(typingRef, (snapshot) => {
                snapshot.forEach(docSnap => {
                    const data = docSnap.data();
                    const now = Date.now();
                    const typingTime = data.timestamp?.toDate().getTime() || now;
                    
                    // Only show typing if within last 5 seconds
                    if (now - typingTime < 5000) {
                        this.typingUsers.set(docSnap.id, {
                            userId: docSnap.id,
                            name: data.name,
                            isTyping: true,
                            timestamp: typingTime
                        });
                    } else {
                        this.typingUsers.delete(docSnap.id);
                    }
                });
                
                this.updateActivityStrip();
            }, (error) => {
                console.error('Error listening to typing indicators:', error);
            });
        } catch (error) {
            console.error('Error setting up typing listener:', error);
        }
    }
    
    async setTypingStatus(groupId, isTyping) {
        if (!this.firebaseUser || !this.currentUser) return;
        
        try {
            const typingRef = doc(db, 'groups', groupId, 'typing', this.firebaseUser.uid);
            
            if (isTyping) {
                await setDoc(typingRef, {
                    userId: this.firebaseUser.uid,
                    name: this.currentUser.name,
                    timestamp: serverTimestamp()
                }, { merge: true });
            } else {
                await deleteDoc(typingRef);
            }
        } catch (error) {
            console.error('Error setting typing status:', error);
        }
    }
    
    async listenToRecentJoiners(groupId) {
        try {
            const membersRef = collection(db, 'groups', groupId, 'members');
            const q = query(membersRef, orderBy('joinedAt', 'desc'), limit(5));
            
            onSnapshot(q, (snapshot) => {
                snapshot.forEach(docSnap => {
                    const data = docSnap.data();
                    const joinTime = data.joinedAt?.toDate().getTime() || Date.now();
                    
                    // Only show recent joins within last 2 minutes
                    if (Date.now() - joinTime < 120000) {
                        this.recentJoiners.set(docSnap.id, {
                            userId: docSnap.id,
                            name: data.name,
                            avatar: data.avatar,
                            joinedAt: joinTime
                        });
                        
                        // Auto-remove after 2 minutes
                        setTimeout(() => {
                            this.recentJoiners.delete(docSnap.id);
                            this.updateActivityStrip();
                        }, 120000);
                    }
                });
                
                this.updateActivityStrip();
            }, (error) => {
                console.error('Error listening to recent joiners:', error);
            });
        } catch (error) {
            console.error('Error setting up recent joiners listener:', error);
        }
    }
    
    async setupSpectatorTracking(groupId) {
        // Mark self as spectator initially
        if (this.firebaseUser?.uid && this.currentUser) {
            this.spectators.set(this.firebaseUser.uid, {
                userId: this.firebaseUser.uid,
                name: this.currentUser.name,
                avatar: this.currentUser.avatar,
                since: Date.now()
            });
            
            // Update own spectator status
            await this.updateSpectatorStatus(groupId);
        }
        
        // Listen for other spectators
        try {
            const spectatorsRef = collection(db, 'groups', groupId, 'spectators');
            
            this.unsubscribeSpectators = onSnapshot(spectatorsRef, (snapshot) => {
                snapshot.forEach(docSnap => {
                    const data = docSnap.data();
                    this.spectators.set(docSnap.id, {
                        userId: docSnap.id,
                        name: data.name,
                        avatar: data.avatar,
                        since: data.since?.toDate().getTime() || Date.now()
                    });
                });
                
                // Remove users not in snapshot
                const spectatorIds = new Set(snapshot.docs.map(doc => doc.id));
                for (const [userId] of this.spectators) {
                    if (!spectatorIds.has(userId)) {
                        this.spectators.delete(userId);
                    }
                }
                
                this.updateActivityStrip();
            }, (error) => {
                console.error('Error listening to spectators:', error);
            });
            
            // Update own spectator status every minute
            const spectatorInterval = setInterval(() => {
                if (this.currentGroupId === groupId) {
                    this.updateSpectatorStatus(groupId);
                } else {
                    clearInterval(spectatorInterval);
                }
            }, 60000);
            
        } catch (error) {
            console.error('Error setting up spectator tracking:', error);
        }
    }
    
    async updateSpectatorStatus(groupId) {
        if (!this.firebaseUser || !this.currentUser) return;
        
        try {
            const spectatorRef = doc(db, 'groups', groupId, 'spectators', this.firebaseUser.uid);
            await setDoc(spectatorRef, {
                userId: this.firebaseUser.uid,
                name: this.currentUser.name,
                avatar: this.currentUser.avatar,
                since: serverTimestamp()
            }, { merge: true });
        } catch (error) {
            console.error('Error updating spectator status:', error);
        }
    }
    
    createActivityStrip(groupId) {
        // Remove existing activity strip
        const existingStrip = document.getElementById('gamingActivityStrip');
        if (existingStrip) existingStrip.remove();
        
        // Create new activity strip
        const activityStrip = document.createElement('div');
        activityStrip.id = 'gamingActivityStrip';
        activityStrip.className = 'gaming-activity-strip';
        
        // Create strip sections
        const sections = {
            online: { title: 'Online', icon: 'wifi', items: [] },
            typing: { title: 'Typing', icon: 'type', items: [] },
            recent: { title: 'New', icon: 'user-plus', items: [] },
            spectators: { title: 'Watching', icon: 'eye', items: [] }
        };
        
        activityStrip.innerHTML = `
            <div class="activity-sections">
                ${Object.entries(sections).map(([key, section]) => `
                    <div class="activity-section" data-section="${key}">
                        <div class="section-header">
                            <svg class="feather feather-${section.icon}" width="12" height="12">
                                ${this.getFeatherIcon(section.icon)}
                            </svg>
                            <span class="section-title">${section.title}</span>
                        </div>
                        <div class="section-items" id="${key}Items"></div>
                    </div>
                `).join('')}
            </div>
        `;
        
        // Insert at top of chat container
        const chatContainer = document.querySelector('.chat-container');
        if (chatContainer) {
            const chatMain = chatContainer.querySelector('.chat-main');
            if (chatMain) {
                const messagesContainer = chatMain.querySelector('.messages-container');
                if (messagesContainer) {
                    chatMain.insertBefore(activityStrip, messagesContainer);
                } else {
                    chatMain.insertBefore(activityStrip, chatMain.firstChild);
                }
            }
        } else {
            const body = document.body;
            body.insertBefore(activityStrip, body.firstChild);
        }
        
        // Add styles if not already added
        this.addActivityStripStyles();
        
        this.updateActivityStrip();
        
        return activityStrip;
    }
    
    updateActivityStrip() {
        if (!document.getElementById('gamingActivityStrip')) return;
        
        // Update online section
        const onlineUsers = Array.from(this.userPresence.values())
            .filter(user => user.status === 'online')
            .slice(0, 5);
        this.updateActivitySection('online', onlineUsers);
        
        // Update typing section
        const typingUsers = Array.from(this.typingUsers.values())
            .filter(user => user.isTyping)
            .slice(0, 3);
        this.updateActivitySection('typing', typingUsers);
        
        // Update recent joiners
        const recentJoiners = Array.from(this.recentJoiners.values())
            .slice(0, 3);
        this.updateActivitySection('recent', recentJoiners);
        
        // Update spectators
        const spectators = Array.from(this.spectators.values())
            .slice(0, 4);
        this.updateActivitySection('spectators', spectators);
    }
    
    updateActivitySection(sectionId, users) {
        const container = document.getElementById(`${sectionId}Items`);
        if (!container) return;
        
        container.innerHTML = users.map(user => `
            <div class="activity-user" data-user-id="${user.userId}" title="${user.name}">
                <img src="${user.avatar}" alt="${user.name}" class="activity-avatar">
                <span class="activity-name">${user.name}</span>
                ${sectionId === 'typing' ? '<div class="typing-dots"><span>.</span><span>.</span><span>.</span></div>' : ''}
            </div>
        `).join('');
        
        // Add click handlers
        container.querySelectorAll('.activity-user').forEach(item => {
            item.addEventListener('click', (e) => {
                const userId = e.currentTarget.dataset.userId;
                if (userId && userId !== this.firebaseUser?.uid) {
                    window.open(`user.html?id=${userId}`, '_blank');
                }
            });
        });
    }
    
    // ========== SECOND LAYER: Micro-games ==========
    
    initializeGameTemplates() {
        return {
            trivia: {
                name: 'Quick Trivia',
                description: 'Answer simple questions',
                duration: 30,
                maxPlayers: 10,
                scoring: (time, correct) => Math.max(1000 - (time * 10), 100) * (correct ? 2 : 1)
            },
            reaction: {
                name: 'Reaction Speed',
                description: 'Tap when the color changes',
                duration: 15,
                maxPlayers: 20,
                scoring: (reactionTime) => Math.max(2000 - reactionTime, 100)
            },
            scramble: {
                name: 'Word Scramble',
                description: 'Unscramble the word',
                duration: 45,
                maxPlayers: 8,
                scoring: (time, attempts) => Math.max(1500 - (time * 5 + attempts * 20), 100)
            },
            emojiRace: {
                name: 'Emoji Race',
                description: 'Click the right emoji sequence',
                duration: 20,
                maxPlayers: 15,
                scoring: (time, correctCount) => correctCount * 100 + Math.max(500 - time, 0)
            },
            aimTrainer: {
                name: 'Aim Trainer',
                description: 'Click the moving targets',
                duration: 30,
                maxPlayers: 1,
                scoring: (hits, accuracy) => hits * 50 + Math.floor(accuracy * 20)
            }
        };
    }
    
    async startMicroGame(groupId, gameType, initiatorId) {
        if (!this.gameTemplates[gameType]) {
            console.error('Unknown game type:', gameType);
            return null;
        }
        
        if (!this.firebaseUser || !this.currentUser) {
            console.error('User not authenticated');
            return null;
        }
        
        const gameId = `game_${groupId}_${Date.now()}`;
        const gameTemplate = this.gameTemplates[gameType];
        
        try {
            // Create game in Firestore
            const gameRef = doc(db, 'groups', groupId, 'games', gameId);
            
            await setDoc(gameRef, {
                id: gameId,
                type: gameType,
                name: gameTemplate.name,
                description: gameTemplate.description,
                duration: gameTemplate.duration,
                maxPlayers: gameTemplate.maxPlayers,
                initiator: initiatorId,
                initiatorName: this.currentUser.name,
                startTime: serverTimestamp(),
                endTime: Timestamp.fromDate(new Date(Date.now() + (gameTemplate.duration + 10) * 1000)),
                state: 'inviting',
                players: [initiatorId],
                scores: { [initiatorId]: 0 },
                createdAt: serverTimestamp()
            });
            
            // Send system message
            await this.sendSystemMessage(
                groupId,
                `${this.currentUser.name} started a ${gameTemplate.name} challenge! Type !join ${gameId.slice(-4)} to participate.`
            );
            
            // Play game start sound
            this.playSound('game_start');
            
            return gameId;
            
        } catch (error) {
            console.error('Error starting game:', error);
            return null;
        }
    }
    
    async sendSystemMessage(groupId, message) {
        try {
            const messagesRef = collection(db, 'groups', groupId, 'messages');
            
            await addDoc(messagesRef, {
                type: 'system',
                text: message,
                timestamp: serverTimestamp(),
                senderId: 'system',
                senderName: 'Gaming System',
                senderAvatar: ''
            });
            
            return true;
        } catch (error) {
            console.error('Error sending system message:', error);
            return false;
        }
    }
    
    async joinGame(groupId, gameId, userId) {
        try {
            const gameRef = doc(db, 'groups', groupId, 'games', gameId);
            const gameSnap = await getDoc(gameRef);
            
            if (!gameSnap.exists()) {
                return { success: false, message: 'Game not found' };
            }
            
            const gameData = gameSnap.data();
            
            if (gameData.state !== 'inviting') {
                return { success: false, message: 'Game already started' };
            }
            
            if (gameData.players.length >= gameData.maxPlayers) {
                return { success: false, message: 'Game is full' };
            }
            
            await updateDoc(gameRef, {
                players: arrayUnion(userId),
                [`scores.${userId}`]: 0
            });
            
            return { success: true, message: 'Joined game successfully' };
            
        } catch (error) {
            console.error('Error joining game:', error);
            return { success: false, message: 'Error joining game' };
        }
    }
    
    async listenToActiveGames(groupId) {
        try {
            const gamesRef = collection(db, 'groups', groupId, 'games');
            const q = query(gamesRef, where('state', 'in', ['inviting', 'active']));
            
            this.unsubscribeGames = onSnapshot(q, (snapshot) => {
                snapshot.forEach(docSnap => {
                    const gameData = docSnap.data();
                    const gameId = docSnap.id;
                    
                    // Update local game state
                    this.activeGames.set(gameId, {
                        ...gameData,
                        id: gameId
                    });
                    
                    // Render game UI if active
                    if (gameData.state === 'active') {
                        this.renderGameUI(groupId, gameId);
                    }
                });
                
                // Remove games that are no longer in snapshot
                const activeGameIds = new Set(snapshot.docs.map(doc => doc.id));
                for (const [gameId] of this.activeGames) {
                    if (!activeGameIds.has(gameId)) {
                        this.activeGames.delete(gameId);
                        this.removeGameUI(gameId);
                    }
                }
                
            }, (error) => {
                console.error('Error listening to games:', error);
            });
            
        } catch (error) {
            console.error('Error setting up games listener:', error);
        }
    }
    
    renderGameUI(groupId, gameId) {
        const gameInstance = this.activeGames.get(gameId);
        if (!gameInstance) return;
        
        // Remove existing game UI
        this.removeGameUI(gameId);
        
        // Create game container
        const gameContainer = document.createElement('div');
        gameContainer.id = `game-${gameId}`;
        gameContainer.className = 'game-container';
        gameContainer.dataset.gameId = gameId;
        
        const endTime = gameInstance.endTime?.toDate().getTime() || Date.now() + 30000;
        const timeLeft = Math.max(0, endTime - Date.now());
        const secondsLeft = Math.ceil(timeLeft / 1000);
        
        gameContainer.innerHTML = `
            <div class="game-header">
                <h3>${gameInstance.name}</h3>
                <div class="game-timer" id="timer-${gameId}">${secondsLeft}s</div>
            </div>
            <div class="game-content" id="content-${gameId}">
                <div class="trivia-game">
                    <div class="trivia-question">Game started by ${gameInstance.initiatorName}! Waiting for players...</div>
                    <div class="trivia-options">
                        <button class="trivia-option" data-answer="0">Join Game</button>
                    </div>
                </div>
            </div>
            <div class="game-players" id="players-${gameId}">
                ${gameInstance.players ? gameInstance.players.map(playerId => {
                    const player = this.userPresence.get(playerId) || { name: 'Player', avatar: AVATAR_OPTIONS[0] };
                    return `
                        <div class="game-player" data-player-id="${playerId}">
                            <img src="${player.avatar}" alt="${player.name}">
                            <span>${player.name}: ${gameInstance.scores?.[playerId] || 0}</span>
                        </div>
                    `;
                }).join('') : ''}
            </div>
        `;
        
        // Insert into messages container
        const messagesContainer = document.getElementById('messagesContainer');
        if (messagesContainer) {
            messagesContainer.appendChild(gameContainer);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
        
        // Start timer update
        this.updateGameTimer(gameId);
        
        // Add join button functionality
        const joinButton = gameContainer.querySelector('.trivia-option');
        if (joinButton) {
            joinButton.addEventListener('click', () => {
                this.joinGame(groupId, gameId, this.firebaseUser.uid);
            });
        }
    }
    
    removeGameUI(gameId) {
        const gameElement = document.getElementById(`game-${gameId}`);
        if (gameElement) {
            gameElement.remove();
        }
    }
    
    updateGameTimer(gameId) {
        const gameInstance = this.activeGames.get(gameId);
        if (!gameInstance) return;
        
        const timerElement = document.getElementById(`timer-${gameId}`);
        if (!timerElement) return;
        
        const update = () => {
            const endTime = gameInstance.endTime?.toDate().getTime() || Date.now() + 30000;
            const timeLeft = Math.max(0, endTime - Date.now());
            const seconds = Math.ceil(timeLeft / 1000);
            
            if (timerElement) {
                timerElement.textContent = `${seconds}s`;
            }
            
            if (seconds > 0) {
                requestAnimationFrame(update);
            } else {
                // Game ended
                this.endGame(gameId);
            }
        };
        
        requestAnimationFrame(update);
    }
    
    async endGame(gameId) {
        const gameInstance = this.activeGames.get(gameId);
        if (!gameInstance || !this.currentGroupId) return;
        
        try {
            // Calculate winner
            let winnerId = null;
            let highestScore = -1;
            
            if (gameInstance.scores) {
                Object.entries(gameInstance.scores).forEach(([playerId, score]) => {
                    if (score > highestScore) {
                        highestScore = score;
                        winnerId = playerId;
                    }
                });
            }
            
            // Update game state
            const gameRef = doc(db, 'groups', this.currentGroupId, 'games', gameId);
            await updateDoc(gameRef, {
                state: 'ended',
                winner: winnerId,
                finalScores: gameInstance.scores || {}
            });
            
            // Update reputation points
            if (winnerId) {
                await this.addWinnerGlow(this.currentGroupId, winnerId);
            }
            
            // Send results message
            const winnerName = this.userPresence.get(winnerId)?.name || 'Someone';
            await this.sendSystemMessage(
                this.currentGroupId,
                `🏆 ${winnerName} won the ${gameInstance.name} game with ${highestScore} points!`
            );
            
            // Play win sound
            this.playSound('win');
            
            // Show achievement if user won
            if (winnerId === this.firebaseUser?.uid) {
                this.showAchievementNotification(
                    'Game Champion',
                    `You won the ${gameInstance.name} game!`,
                    'star'
                );
            }
            
            // Remove game UI after delay
            setTimeout(() => {
                this.removeGameUI(gameId);
                this.activeGames.delete(gameId);
            }, 10000);
            
        } catch (error) {
            console.error('Error ending game:', error);
        }
    }
    
    async addWinnerGlow(groupId, userId) {
        try {
            const glowRef = doc(db, 'groups', groupId, 'glows', userId);
            
            await setDoc(glowRef, {
                userId: userId,
                awardedAt: serverTimestamp(),
                expiresAt: Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000)),
                type: 'winner',
                intensity: 1.0
            }, { merge: true });
            
            // Update local state
            this.equippedItems.set(userId, {
                ...this.equippedItems.get(userId),
                glow: {
                    type: 'winner',
                    expires: Date.now() + 24 * 60 * 60 * 1000
                }
            });
            
        } catch (error) {
            console.error('Error adding winner glow:', error);
        }
    }
    
    // ========== THIRD LAYER: Identity & Achievements ==========
    
    async loadGroupIdentity(groupId, userId) {
        try {
            const identityRef = doc(db, 'groups', groupId, 'identities', userId);
            const identitySnap = await getDoc(identityRef);
            
            if (identitySnap.exists()) {
                const identityData = identitySnap.data();
                this.groupIdentities.set(`${groupId}_${userId}`, identityData);
                this.updateUserDisplay(groupId, userId);
                return identityData;
            }
        } catch (error) {
            console.error('Error loading group identity:', error);
        }
        
        return null;
    }
    
    async updateGroupIdentity(groupId, userId, identityData) {
        try {
            const identityRef = doc(db, 'groups', groupId, 'identities', userId);
            
            await setDoc(identityRef, {
                ...identityData,
                userId: userId,
                updatedAt: serverTimestamp()
            }, { merge: true });
            
            this.groupIdentities.set(`${groupId}_${userId}`, identityData);
            this.updateUserDisplay(groupId, userId);
            
        } catch (error) {
            console.error('Error updating group identity:', error);
        }
    }
    
    updateUserDisplay(groupId, userId) {
        const identity = this.groupIdentities.get(`${groupId}_${userId}`);
        if (!identity) return;
        
        // Update user elements in chat
        document.querySelectorAll(`[data-user-id="${userId}"]`).forEach(element => {
            // Update name color
            if (identity.color) {
                element.style.color = identity.color;
            }
            
            // Add badge
            if (identity.badge) {
                const existingBadge = element.querySelector('.identity-badge');
                if (existingBadge) existingBadge.remove();
                
                const badge = document.createElement('span');
                badge.className = 'identity-badge';
                badge.textContent = identity.badge;
                badge.style.background = identity.badgeColor || '#667eea';
                element.appendChild(badge);
            }
        });
    }
    
    setupAchievementChecker() {
        this.achievementCheckInterval = setInterval(() => {
            this.checkForAchievements();
        }, 60000); // Check every minute
    }
    
    async checkForAchievements() {
        if (!this.currentGroupId || !this.firebaseUser) return;
        
        try {
            const achievements = await this.getEarnedAchievements();
            
            achievements.forEach(achievement => {
                if (!this.achievements.has(achievement.id)) {
                    this.showAchievementNotification(achievement.name, achievement.description, achievement.icon);
                    this.achievements.set(achievement.id, achievement);
                }
            });
        } catch (error) {
            console.error('Error checking achievements:', error);
        }
    }
    
    async getEarnedAchievements() {
        const earned = [];
        
        // Check session time achievement
        if (this.sessionStartTime) {
            const sessionMinutes = (Date.now() - this.sessionStartTime) / (1000 * 60);
            
            if (sessionMinutes >= 120 && !this.achievements.has('marathon')) {
                earned.push({
                    id: 'marathon',
                    name: 'Marathon Session',
                    description: 'Stayed active for 2 hours straight',
                    icon: 'clock',
                    rarity: 'rare'
                });
            }
            
            if (this.activityStats.streak >= 10 && !this.achievements.has('streak_master')) {
                earned.push({
                    id: 'streak_master',
                    name: 'Streak Master',
                    description: 'First to react in 10 consecutive messages',
                    icon: 'zap',
                    rarity: 'epic'
                });
            }
        }
        
        // Check voice snippets
        if (this.activityStats.voiceSnippets >= 5 && !this.achievements.has('voice_enthusiast')) {
            earned.push({
                id: 'voice_enthusiast',
                name: 'Voice Enthusiast',
                description: 'Sent 5+ voice snippets',
                icon: 'mic',
                rarity: 'common'
            });
        }
        
        // Check games played
        if (this.activityStats.gamesPlayed >= 3 && !this.achievements.has('game_master')) {
            earned.push({
                id: 'game_master',
                name: 'Game Master',
                description: 'Participated in 3+ mini-games',
                icon: 'gamepad',
                rarity: 'rare'
            });
        }
        
        return earned;
    }
    
    showAchievementNotification(title, description, icon = 'star') {
        // Dispatch event to HTML to show notification
        const event = new CustomEvent('showAchievement', {
            detail: { title, description, icon }
        });
        document.dispatchEvent(event);
        
        // Play achievement sound
        this.playSound('achievement');
    }
    
    // ========== FOURTH LAYER: Group Modes ==========
    
    async suggestMode(groupId, modeType) {
        if (!this.firebaseUser || !this.currentUser) {
            console.error('User not authenticated');
            return;
        }
        
        try {
            const modeRef = doc(collection(db, 'groups', groupId, 'mode_suggestions'));
            
            await setDoc(modeRef, {
                type: modeType,
                suggestedBy: this.firebaseUser.uid,
                suggestedByName: this.currentUser.name,
                suggestedAt: serverTimestamp(),
                votes: [this.firebaseUser.uid],
                voteCount: 1,
                groupId: groupId
            });
            
            // Send notification
            await this.sendSystemMessage(
                groupId,
                `${this.currentUser.name} suggested activating ${this.getModeName(modeType)} mode! React with 👍 to vote.`
            );
            
            // Play sound
            this.playSound('mode_activate');
            
        } catch (error) {
            console.error('Error suggesting mode:', error);
        }
    }
    
    async listenToActiveMode(groupId) {
        try {
            const modeRef = doc(db, 'groups', groupId, 'active_mode');
            
            this.unsubscribeModes = onSnapshot(modeRef, (docSnap) => {
                if (docSnap.exists()) {
                    const modeData = docSnap.data();
                    this.activeMode = modeData.type;
                    this.modeEndTime = modeData.endsAt?.toDate().getTime() || Date.now() + 300000;
                    
                    // Apply mode effects
                    this.applyModeEffects(modeData.type);
                    
                    // Show mode indicator
                    this.showActiveModeIndicator(modeData.type, this.modeEndTime);
                    
                    // Schedule mode end
                    const timeLeft = this.modeEndTime - Date.now();
                    if (timeLeft > 0) {
                        setTimeout(() => {
                            this.deactivateMode(groupId);
                        }, timeLeft);
                    }
                } else {
                    // No active mode
                    if (this.activeMode) {
                        this.deactivateMode(groupId);
                    }
                }
            }, (error) => {
                console.error('Error listening to active mode:', error);
            });
            
        } catch (error) {
            console.error('Error setting up mode listener:', error);
        }
    }
    
    applyModeEffects(modeType) {
        // Dispatch event to HTML to apply mode effects
        const event = new CustomEvent('applyModeEffect', {
            detail: { modeType }
        });
        document.dispatchEvent(event);
        
        // Play mode-specific sound
        if (modeType === 'night_raid') {
            this.playSound('night_ambient', true);
        }
    }
    
    async deactivateMode(groupId) {
        try {
            const modeRef = doc(db, 'groups', groupId, 'active_mode');
            await deleteDoc(modeRef);
            
            // Clear active mode
            this.activeMode = null;
            this.modeEndTime = null;
            
            // Dispatch event to remove mode effects
            const event = new CustomEvent('removeModeEffect');
            document.dispatchEvent(event);
            
            // Stop ambient sounds
            this.stopSound('night_ambient');
            
            // Send deactivation message
            await this.sendSystemMessage(
                groupId,
                'Mode deactivated. Returning to normal chat.'
            );
            
        } catch (error) {
            console.error('Error deactivating mode:', error);
        }
    }
    
    getModeName(modeType) {
        const names = {
            slow: 'Cinematic Slow',
            chaos: 'Floating Chaos',
            stealth: 'Blurred Stealth',
            night_raid: 'Night Raid'
        };
        
        return names[modeType] || modeType;
    }
    
    showActiveModeIndicator(modeType, endTime) {
        const event = new CustomEvent('showActiveMode', {
            detail: { 
                modeType, 
                endTime,
                modeName: this.getModeName(modeType)
            }
        });
        document.dispatchEvent(event);
    }
    
    // ========== VOICE SNIPPETS ==========
    
    initializeAudioSystem() {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            // Request microphone permission
            navigator.mediaDevices.getUserMedia({ audio: true })
                .then(stream => {
                    this.audioRecorder = stream;
                    this.audioEnabled = true;
                    console.log('Audio recording available');
                })
                .catch(err => {
                    console.warn('Audio recording not available:', err);
                    this.audioEnabled = false;
                });
        } else {
            console.warn('getUserMedia not supported');
            this.audioEnabled = false;
        }
    }
    
    initializeSoundEffects() {
        return {
            join: { url: 'https://assets.mixkit.co/sfx/preview/mixkit-game-show-wrong-answer-buzz-950.mp3', volume: 0.3 },
            win: { url: 'https://assets.mixkit.co/sfx/preview/mixkit-winning-chimes-2015.mp3', volume: 0.4 },
            achievement: { url: 'https://assets.mixkit.co/sfx/preview/mixkit-winning-notification-2018.mp3', volume: 0.5 },
            mode_activate: { url: 'https://assets.mixkit.co/sfx/preview/mixkit-magic-sparkles-300.mp3', volume: 0.4 },
            night_ambient: { url: 'https://assets.mixkit.co/sfx/preview/mixkit-crickets-and-insects-in-the-wild-ambience-39.mp3', volume: 0.2, loop: true },
            game_start: { url: 'https://assets.mixkit.co/sfx/preview/mixkit-game-show-intro-331.mp3', volume: 0.4 },
            voice_start: { url: 'https://assets.mixkit.co/sfx/preview/mixkit-retro-game-emergency-alarm-1000.mp3', volume: 0.3 }
        };
    }
    
    playSound(soundName, loop = false) {
        if (!this.audioEnabled) return;
        
        const sound = this.soundEffects[soundName];
        if (!sound) return;
        
        const audio = new Audio(sound.url);
        audio.volume = sound.volume;
        audio.loop = loop;
        
        // Store reference for looping sounds
        if (loop) {
            sound.instance = audio;
        }
        
        audio.play().catch(err => {
            console.warn('Could not play sound:', err);
        });
        
        return audio;
    }
    
    stopSound(soundName) {
        const sound = this.soundEffects[soundName];
        if (sound && sound.instance) {
            sound.instance.pause();
            sound.instance.currentTime = 0;
            sound.instance = null;
        }
    }
    
    async startVoiceRecording() {
        if (!this.audioEnabled || !this.audioRecorder || this.isRecording) {
            console.warn('Cannot start recording:', {
                audioEnabled: this.audioEnabled,
                audioRecorder: !!this.audioRecorder,
                isRecording: this.isRecording
            });
            return;
        }
        
        try {
            this.isRecording = true;
            this.audioChunks = [];
            
            this.mediaRecorder = new MediaRecorder(this.audioRecorder);
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };
            
            this.mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                await this.processVoiceRecording(audioBlob);
            };
            
            this.mediaRecorder.start();
            
            // Start recording timer
            this.recordingTimer = setTimeout(() => {
                this.stopVoiceRecording();
            }, this.MAX_RECORDING_TIME);
            
            // Show recording UI
            this.showRecordingUI();
            
            // Play start sound
            this.playSound('voice_start');
            
        } catch (error) {
            console.error('Error starting recording:', error);
            this.isRecording = false;
        }
    }
    
    stopVoiceRecording() {
        if (!this.isRecording || !this.mediaRecorder) return;
        
        if (this.recordingTimer) {
            clearTimeout(this.recordingTimer);
            this.recordingTimer = null;
        }
        
        this.mediaRecorder.stop();
        this.isRecording = false;
        
        // Hide recording UI
        this.hideRecordingUI();
    }
    
    async processVoiceRecording(audioBlob) {
        try {
            // Upload to Cloudinary
            const formData = new FormData();
            formData.append('file', audioBlob);
            formData.append('upload_preset', cloudinaryConfig.uploadPreset);
            formData.append('resource_type', 'video');
            
            const response = await fetch(
                `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/video/upload`,
                {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                }
            );
            
            if (!response.ok) {
                throw new Error('Upload failed');
            }
            
            const data = await response.json();
            const audioUrl = data.secure_url;
            
            // Send as voice snippet message
            await this.sendVoiceSnippet(this.currentGroupId, audioUrl, audioBlob.size);
            
            // Update stats
            this.activityStats.voiceSnippets++;
            
        } catch (error) {
            console.error('Error processing voice recording:', error);
            // Show error to user
            alert('Failed to send voice snippet. Please try again.');
        }
    }
    
    async sendVoiceSnippet(groupId, audioUrl, size) {
        if (!this.firebaseUser || !this.currentUser) return;
        
        const duration = Math.min(Math.floor(size / 16000), 30);
        
        try {
            const messageData = {
                type: 'voice_snippet',
                audioUrl: audioUrl,
                duration: duration,
                senderId: this.firebaseUser.uid,
                senderName: this.currentUser.name,
                senderAvatar: this.currentUser.avatar,
                timestamp: serverTimestamp(),
                expiresAt: Timestamp.fromDate(new Date(Date.now() + 30 * 1000))
            };
            
            const messagesRef = collection(db, 'groups', groupId, 'messages');
            await addDoc(messagesRef, messageData);
            
            console.log('Voice snippet sent successfully');
            
        } catch (error) {
            console.error('Error sending voice snippet:', error);
        }
    }
    
    showRecordingUI() {
        // Dispatch event to show recording UI
        const event = new CustomEvent('showRecordingOverlay');
        document.dispatchEvent(event);
    }
    
    hideRecordingUI() {
        // Dispatch event to hide recording UI
        const event = new CustomEvent('hideRecordingOverlay');
        document.dispatchEvent(event);
    }
    
    // ========== SESSION TIMER ==========
    
    startSessionTimer() {
        this.sessionStartTime = Date.now();
        
        // Show session timer
        this.showSessionTimer();
        
        // Update every minute
        this.sessionTimerInterval = setInterval(() => {
            this.updateSessionDisplay();
        }, 60000);
    }
    
    updateSessionDisplay() {
        if (!this.sessionStartTime) return;
        
        const sessionMinutes = Math.floor((Date.now() - this.sessionStartTime) / (1000 * 60));
        
        // Dispatch event to update session timer display
        const event = new CustomEvent('updateSessionTimer', {
            detail: { minutes: sessionMinutes }
        });
        document.dispatchEvent(event);
        
        // Check for achievement
        if (sessionMinutes >= 30 && !this.achievements.has('dedicated')) {
            this.showAchievementNotification(
                'Dedicated',
                'Active for 30+ minutes',
                'clock'
            );
            this.achievements.set('dedicated', true);
        }
    }
    
    showSessionTimer() {
        const event = new CustomEvent('showSessionTimer');
        document.dispatchEvent(event);
    }
    
    // ========== UTILITY METHODS ==========
    
    getFeatherIcon(iconName) {
        const icons = {
            wifi: '<path d="M5 12.55a11 11 0 0 1 14.08 0"></path><path d="M1.42 9a16 16 0 0 1 21.16 0"></path><path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path><line x1="12" y1="20" x2="12.01" y2="20"></line>',
            type: '<polyline points="4 7 4 4 20 4 20 7"></polyline><line x1="9" y1="20" x2="15" y2="20"></line><line x1="12" y1="4" x2="12" y2="20"></line>',
            'user-plus': '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line>',
            eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11 8-11 8z"></path><circle cx="12" cy="12" r="3"></circle>',
            clock: '<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>',
            zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>',
            'message-circle': '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>',
            gamepad: '<line x1="6" y1="12" x2="10" y2="12"></line><line x1="8" y1="10" x2="8" y2="14"></line><line x1="15" y1="13" x2="15.01" y2="13"></line><line x1="18" y1="11" x2="18.01" y2="11"></line><rect x="2" y="6" width="20" height="12" rx="2"></rect>',
            mic: '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line>'
        };
        
        return icons[iconName] || '<circle cx="12" cy="12" r="10"></circle>';
    }
    
    addActivityStripStyles() {
        if (document.getElementById('gaming-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'gaming-styles';
        styles.textContent = `
            .gaming-activity-strip {
                background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
                backdrop-filter: blur(10px);
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                padding: 8px 16px;
                display: flex;
                gap: 20px;
                overflow-x: auto;
                scrollbar-width: none;
                position: sticky;
                top: 0;
                z-index: 100;
            }
            
            .gaming-activity-strip::-webkit-scrollbar {
                display: none;
            }
            
            .activity-sections {
                display: flex;
                gap: 20px;
                flex: 1;
            }
            
            .activity-section {
                min-width: 150px;
            }
            
            .section-header {
                display: flex;
                align-items: center;
                gap: 6px;
                margin-bottom: 6px;
                font-size: 11px;
                color: #666;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            
            .section-header svg {
                color: #667eea;
            }
            
            .section-items {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
            }
            
            .activity-user {
                display: flex;
                align-items: center;
                gap: 4px;
                padding: 2px 6px;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 12px;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .activity-user:hover {
                background: rgba(102, 126, 234, 0.2);
                transform: translateY(-1px);
            }
            
            .activity-avatar {
                width: 16px;
                height: 16px;
                border-radius: 50%;
                object-fit: cover;
            }
            
            .activity-name {
                font-size: 11px;
                font-weight: 500;
                white-space: nowrap;
            }
            
            .typing-dots {
                display: flex;
                gap: 1px;
            }
            
            .typing-dots span {
                animation: typingDot 1.4s infinite;
                animation-delay: calc(var(--dot-index) * 0.2s);
            }
            
            .typing-dots span:nth-child(1) { --dot-index: 1; }
            .typing-dots span:nth-child(2) { --dot-index: 2; }
            .typing-dots span:nth-child(3) { --dot-index: 3; }
            
            @keyframes typingDot {
                0%, 60%, 100% { opacity: 0.3; }
                30% { opacity: 1; }
            }
        `;
        
        document.head.appendChild(styles);
    }
    
    // ========== CLEANUP ==========
    
    cleanup() {
        // Stop all intervals
        if (this.sessionTimerInterval) {
            clearInterval(this.sessionTimerInterval);
            this.sessionTimerInterval = null;
        }
        
        if (this.achievementCheckInterval) {
            clearInterval(this.achievementCheckInterval);
            this.achievementCheckInterval = null;
        }
        
        // Stop audio
        this.stopVoiceRecording();
        Object.keys(this.soundEffects).forEach(sound => {
            this.stopSound(sound);
        });
        
        // Cleanup group listeners
        this.cleanupGroupListeners();
        
        // Clear active games
        this.activeGames.clear();
        
        // Remove UI elements
        this.removeGamingUI();
        
        // Reset state
        this.currentGroupId = null;
        this.sessionStartTime = null;
        this.activityStats = {
            messagesSent: 0,
            reactionsGiven: 0,
            gamesPlayed: 0,
            voiceSnippets: 0,
            streak: 0,
            lastActivity: Date.now()
        };
        
        console.log('Gaming system cleaned up');
    }
    
    removeGamingUI() {
        // Remove activity strip
        const activityStrip = document.getElementById('gamingActivityStrip');
        if (activityStrip) activityStrip.remove();
        
        // Remove game containers
        document.querySelectorAll('.game-container').forEach(el => el.remove());
        
        // Remove mode indicator
        const modeIndicator = document.getElementById('activeModeIndicator');
        if (modeIndicator) modeIndicator.style.display = 'none';
        
        // Remove session timer
        const sessionTimer = document.getElementById('sessionTimerDisplay');
        if (sessionTimer) sessionTimer.style.display = 'none';
    }
}

// ========== GLOBAL INITIALIZATION ==========

// Create global gaming system instance
let gamingSystem = null;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing gaming system...');
    
    // Create gaming system instance
    gamingSystem = new GamingChat();
    
    // Make it globally available
    window.gamingChat = gamingSystem;
    window.GamingChat = GamingChat;
    
    console.log('Gaming system created, waiting for auth...');
    
    // Listen for page-specific initialization
    const currentPage = window.location.pathname.split('/').pop();
    if (currentPage === 'group.html') {
        // Wait for group to be loaded
        const checkGroupLoaded = setInterval(() => {
            const urlParams = new URLSearchParams(window.location.search);
            const groupId = urlParams.get('id');
            
            if (groupId && window.gamingChat && window.gamingChat.firebaseUser) {
                clearInterval(checkGroupLoaded);
                console.log('Initializing gaming for group:', groupId);
                window.gamingChat.initializeGroupActivity(groupId);
            }
        }, 500);
    }
});

// Event listeners for HTML communication
document.addEventListener('showRecordingOverlay', () => {
    if (window.showRecordingOverlay) {
        window.showRecordingOverlay();
    }
});

document.addEventListener('hideRecordingOverlay', () => {
    if (window.hideRecordingOverlay) {
        window.hideRecordingOverlay();
    }
});

document.addEventListener('showAchievement', (e) => {
    if (window.showAchievementNotification) {
        const { title, description, icon } = e.detail;
        window.showAchievementNotification(title, description, icon);
    }
});

document.addEventListener('showActiveMode', (e) => {
    if (window.showActiveModeIndicator) {
        const { modeType, endTime, modeName } = e.detail;
        const timeRemaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
        window.showActiveModeIndicator(modeType, timeRemaining);
        
        // Update timer every second
        const updateTimer = () => {
            const newTimeRemaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
            if (newTimeRemaining > 0 && window.updateModeTimer) {
                window.updateModeTimer(newTimeRemaining);
                setTimeout(updateTimer, 1000);
            }
        };
        updateTimer();
    }
});

document.addEventListener('removeModeEffect', () => {
    if (window.hideActiveModeIndicator) {
        window.hideActiveModeIndicator();
    }
});

document.addEventListener('showSessionTimer', () => {
    if (window.showSessionTimer) {
        window.showSessionTimer();
    }
});

document.addEventListener('updateSessionTimer', (e) => {
    if (window.updateSessionTimer) {
        window.updateSessionTimer(e.detail.minutes);
    }
});

console.log('Gaming.js module loaded');