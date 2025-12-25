// gaming.js - Enhanced Gaming Chat System with Real-time Engagement Features
// All features from your specification integrated with Cloudinary support

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
    writeBatch
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { 
    getAuth, 
    onAuthStateChanged
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

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const cloudinaryConfig = {
    cloudName: "ddtdqrh1b",
    uploadPreset: "profile-pictures",
    apiUrl: "https://api.cloudinary.com/v1_1"
};

const GAMING_FEATURES = {
    // Live Activity Strip
    ACTIVITY_STRIP: {
        TYPES: ['typing', 'joining', 'spectating', 'playing', 'afk', 'recording']
    },
    
    // Voice Bubbles
    VOICE_BUBBLES: {
        MAX_DURATION: 30000, // 30 seconds
        EXPIRY_TIME: 300000, // 5 minutes
        FORMATS: ['audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm']
    },
    
    // Mini Games
    MINI_GAMES: {
        TYPES: ['trivia', 'reaction_test', 'word_scramble', 'emoji_race', 'speed_challenge'],
        DURATION: 60000, // 1 minute
        COOLDOWN: 300000 // 5 minutes
    },
    
    // Reaction Challenges
    CHALLENGES: {
        TYPES: ['tap_speed', 'click_accuracy', 'pattern_match', 'memory_test'],
        DURATION: 15000 // 15 seconds
    },
    
    // Status Effects
    STATUS_EFFECTS: {
        TYPES: ['hyped', 'muted', 'glowing', 'stealth', 'chaos', 'legendary'],
        DURATION: 3600000 // 1 hour
    },
    
    // Chat Modes
    CHAT_MODES: {
        TYPES: ['normal', 'slow', 'stealth', 'chaos', 'night_raid', 'party'],
        DURATION: 1800000 // 30 minutes
    },
    
    // Audio Cues
    AUDIO_CUES: {
        EVENTS: ['join', 'win', 'loss', 'level_up', 'achievement', 'event'],
        VOLUME: 0.3
    }
};

class GamingChatSystem {
    constructor() {
        this.currentUser = null;
        this.firebaseUser = null;
        this.currentGroupId = null;
        this.isListening = false;
        this.unsubscribeActivity = null;
        this.unsubscribeGames = null;
        this.unsubscribeEvents = null;
        this.unsubscribeVoice = null;
        
        // Game state
        this.activeMiniGames = new Map();
        this.activeChallenges = new Map();
        this.userSessions = new Map();
        this.groupStreaks = new Map();
        this.reactionTimers = new Map();
        this.tempEffects = new Map();
        this.chatMode = 'normal';
        this.audioContext = null;
        this.audioBuffers = new Map();
        this.backgroundAudio = null;
        
        // User activity tracking
        this.activityState = {
            isTyping: false,
            isRecording: false,
            isSpectating: false,
            lastActivity: Date.now()
        };
        
        // Cache
        this.gamingCache = {
            userReputation: new Map(),
            groupStats: new Map(),
            achievements: new Map(),
            badges: new Map(),
            miniGameHistory: new Map()
        };
        
        // Initialize
        this.setupAuthListener();
        this.setupAudioSystem();
        this.startSessionTimer();
    }
    
    // ==================== CLOUDINARY INTEGRATION ====================
    
    async uploadToCloudinary(file, resourceType = 'auto') {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', cloudinaryConfig.uploadPreset);
        formData.append('resource_type', resourceType);
        
        try {
            const response = await fetch(
                `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/${resourceType}/upload`,
                {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                }
            );
            
            if (!response.ok) {
                throw new Error(`Cloudinary error: ${response.statusText}`);
            }
            
            const data = await response.json();
            if (!data.secure_url) {
                throw new Error('Invalid response from Cloudinary');
            }
            return data.secure_url;
        } catch (error) {
            console.error('Error uploading to Cloudinary:', error);
            throw error;
        }
    }
    
    async uploadVoiceNote(audioBlob) {
        try {
            const audioFile = new File([audioBlob], `voice_${Date.now()}.webm`, {
                type: 'audio/webm'
            });
            
            return await this.uploadToCloudinary(audioFile, 'video');
        } catch (error) {
            console.error('Error uploading voice note:', error);
            throw error;
        }
    }
    
    async uploadAnimatedImage(file) {
        try {
            const validTypes = ['image/gif', 'image/webp', 'image/apng'];
            if (!validTypes.includes(file.type)) {
                throw new Error('Please upload an animated image (GIF, WebP, APNG)');
            }
            
            if (file.size > 10 * 1024 * 1024) {
                throw new Error('Animated image must be less than 10MB');
            }
            
            return await this.uploadToCloudinary(file, 'image');
        } catch (error) {
            console.error('Error uploading animated image:', error);
            throw error;
        }
    }
    
    // ==================== AUTHENTICATION & SETUP ====================
    
    setupAuthListener() {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                this.firebaseUser = user;
                await this.loadGamingProfile();
                this.startUserSession();
            } else {
                this.firebaseUser = null;
                this.currentUser = null;
                this.cleanup();
            }
        });
    }
    
    async loadGamingProfile() {
        try {
            if (!this.firebaseUser) return;
            
            const profileRef = doc(db, 'gaming_profiles', this.firebaseUser.uid);
            const profileSnap = await getDoc(profileRef);
            
            if (profileSnap.exists()) {
                this.currentUser = profileSnap.data();
            } else {
                // Create default gaming profile
                this.currentUser = {
                    id: this.firebaseUser.uid,
                    displayName: this.firebaseUser.displayName || 'Gamer',
                    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${this.firebaseUser.uid}`,
                    reputation: 100,
                    level: 1,
                    experience: 0,
                    achievements: [],
                    badges: [],
                    gamingStats: {
                        gamesPlayed: 0,
                        gamesWon: 0,
                        reactionTime: 0,
                        voiceNotesSent: 0,
                        streakDays: 0
                    },
                    groupSpecific: {} // Store group-specific profiles
                };
                
                await setDoc(profileRef, this.currentUser);
            }
        } catch (error) {
            console.error('Error loading gaming profile:', error);
        }
    }
    
    // ==================== FEATURE 1: LIVE ACTIVITY STRIP ====================
    
    async updateActivityStatus(groupId, status, extraData = {}) {
        try {
            if (!this.firebaseUser || !groupId) return;
            
            const activityRef = doc(db, 'groups', groupId, 'activity', this.firebaseUser.uid);
            
            await setDoc(activityRef, {
                userId: this.firebaseUser.uid,
                userName: this.currentUser.displayName,
                userAvatar: this.currentUser.avatar,
                status: status,
                ...extraData,
                timestamp: serverTimestamp(),
                expiresAt: new Date(Date.now() + 30000) // Expire after 30 seconds
            }, { merge: true });
            
            // Update local state
            this.activityState.lastActivity = Date.now();
            
        } catch (error) {
            console.error('Error updating activity:', error);
        }
    }
    
    listenToGroupActivity(groupId, callback) {
        try {
            if (this.unsubscribeActivity) {
                this.unsubscribeActivity();
            }
            
            const activityRef = collection(db, 'groups', groupId, 'activity');
            const q = query(activityRef, orderBy('timestamp', 'desc'), limit(20));
            
            this.unsubscribeActivity = onSnapshot(q, (snapshot) => {
                const activities = [];
                const now = Date.now();
                
                snapshot.forEach(docSnap => {
                    const data = docSnap.data();
                    const expiresAt = data.expiresAt?.toDate ? 
                        data.expiresAt.toDate().getTime() : 
                        new Date(data.expiresAt).getTime();
                    
                    // Remove expired activities
                    if (now < expiresAt) {
                        activities.push({
                            id: docSnap.id,
                            ...data,
                            timestamp: data.timestamp?.toDate ? 
                                data.timestamp.toDate() : 
                                new Date(data.timestamp)
                        });
                    }
                });
                
                callback(activities);
            });
            
        } catch (error) {
            console.error('Error listening to activity:', error);
        }
    }
    
    // ==================== FEATURE 2: TAP-TO-TALK VOICE BUBBLES ====================
    
    async sendVoiceMessage(groupId, audioBlob, duration) {
        try {
            if (!this.firebaseUser || !groupId) return;
            
            if (duration > GAMING_FEATURES.VOICE_BUBBLES.MAX_DURATION) {
                throw new Error(`Voice notes cannot exceed ${GAMING_FEATURES.VOICE_BUBBLES.MAX_DURATION / 1000} seconds`);
            }
            
            // Upload to Cloudinary
            const voiceUrl = await this.uploadVoiceNote(audioBlob);
            
            // Create voice message
            const voiceRef = doc(collection(db, 'groups', groupId, 'voice_messages'));
            const expiryTime = Date.now() + GAMING_FEATURES.VOICE_BUBBLES.EXPIRY_TIME;
            
            await setDoc(voiceRef, {
                id: voiceRef.id,
                senderId: this.firebaseUser.uid,
                senderName: this.currentUser.displayName,
                senderAvatar: this.currentUser.avatar,
                voiceUrl: voiceUrl,
                duration: duration,
                timestamp: serverTimestamp(),
                expiresAt: new Date(expiryTime),
                listenedBy: [],
                isExpired: false
            });
            
            // Update user stats
            await this.updateUserStat('voiceNotesSent', 1);
            
            // Play send sound
            this.playAudioCue('send');
            
            return voiceRef.id;
            
        } catch (error) {
            console.error('Error sending voice message:', error);
            throw error;
        }
    }
    
    async markVoiceAsListened(groupId, voiceId) {
        try {
            if (!this.firebaseUser) return;
            
            const voiceRef = doc(db, 'groups', groupId, 'voice_messages', voiceId);
            await updateDoc(voiceRef, {
                listenedBy: arrayUnion(this.firebaseUser.uid)
            });
            
        } catch (error) {
            console.error('Error marking voice as listened:', error);
        }
    }
    
    // ==================== FEATURE 3: INLINE MINI GAMES ====================
    
    async startMiniGame(groupId, gameType, options = {}) {
        try {
            if (!this.firebaseUser || !groupId) return;
            
            const gameId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const endTime = Date.now() + GAMING_FEATURES.MINI_GAMES.DURATION;
            
            let gameData = {
                id: gameId,
                type: gameType,
                creatorId: this.firebaseUser.uid,
                creatorName: this.currentUser.displayName,
                groupId: groupId,
                startTime: serverTimestamp(),
                endTime: new Date(endTime),
                participants: [this.firebaseUser.uid],
                scores: {},
                status: 'active',
                options: options
            };
            
            // Initialize based on game type
            switch (gameType) {
                case 'trivia':
                    gameData.questions = await this.generateTriviaQuestions();
                    gameData.currentQuestion = 0;
                    break;
                    
                case 'word_scramble':
                    gameData.word = this.generateScrambleWord();
                    gameData.scrambled = this.scrambleWord(gameData.word);
                    break;
                    
                case 'emoji_race':
                    gameData.sequence = this.generateEmojiSequence();
                    gameData.currentPosition = {};
                    break;
                    
                case 'reaction_test':
                    gameData.startDelay = Math.random() * 3000 + 1000; // 1-4 seconds
                    break;
            }
            
            // Save to Firebase
            const gameRef = doc(db, 'groups', groupId, 'mini_games', gameId);
            await setDoc(gameRef, gameData);
            
            // Cache locally
            this.activeMiniGames.set(gameId, {
                ...gameData,
                startTime: new Date(),
                endTime: new Date(endTime)
            });
            
            // Notify group
            await this.sendGameNotification(groupId, `${this.currentUser.displayName} started a ${gameType} game!`);
            
            // Play game start sound
            this.playAudioCue('game_start');
            
            return gameId;
            
        } catch (error) {
            console.error('Error starting mini game:', error);
            throw error;
        }
    }
    
    async joinMiniGame(groupId, gameId) {
        try {
            if (!this.firebaseUser) return;
            
            const gameRef = doc(db, 'groups', groupId, 'mini_games', gameId);
            await updateDoc(gameRef, {
                participants: arrayUnion(this.firebaseUser.uid)
            });
            
            // Play join sound
            this.playAudioCue('join');
            
        } catch (error) {
            console.error('Error joining mini game:', error);
        }
    }
    
    async submitGameAnswer(groupId, gameId, answer, score = 0) {
        try {
            if (!this.firebaseUser) return;
            
            const gameRef = doc(db, 'groups', groupId, 'mini_games', gameId);
            
            // Update score
            await updateDoc(gameRef, {
                [`scores.${this.firebaseUser.uid}`]: increment(score),
                [`answers.${this.firebaseUser.uid}`]: arrayUnion({
                    answer: answer,
                    timestamp: serverTimestamp(),
                    score: score
                })
            });
            
            // Check if game should end
            const gameDoc = await getDoc(gameRef);
            const gameData = gameDoc.data();
            
            if (gameData.endTime?.toDate && gameData.endTime.toDate() < new Date()) {
                await this.endMiniGame(groupId, gameId);
            }
            
        } catch (error) {
            console.error('Error submitting game answer:', error);
        }
    }
    
    async endMiniGame(groupId, gameId) {
        try {
            const gameRef = doc(db, 'groups', groupId, 'mini_games', gameId);
            const gameDoc = await getDoc(gameRef);
            
            if (!gameDoc.exists()) return;
            
            const gameData = gameDoc.data();
            
            // Calculate winner
            const scores = gameData.scores || {};
            const winnerId = Object.keys(scores).reduce((a, b) => 
                scores[a] > scores[b] ? a : b
            );
            
            // Update game status
            await updateDoc(gameRef, {
                status: 'ended',
                winnerId: winnerId,
                endedAt: serverTimestamp()
            });
            
            // Update user reputations
            await this.updateUserReputation(winnerId, 10);
            
            // Remove from active games
            this.activeMiniGames.delete(gameId);
            
            // Play win sound
            this.playAudioCue('win');
            
            // Notify group
            await this.sendGameNotification(groupId, `Game ended! Winner: ${gameData.scores[winnerId]} points!`);
            
        } catch (error) {
            console.error('Error ending mini game:', error);
        }
    }
    
    // ==================== FEATURE 4: REACTION SPEED CHALLENGES ====================
    
    async startReactionChallenge(groupId, challengeType) {
        try {
            const challengeId = `challenge_${Date.now()}`;
            const startTime = Date.now() + 3000; // Start in 3 seconds
            
            const challengeData = {
                id: challengeId,
                type: challengeType,
                groupId: groupId,
                startTime: startTime,
                endTime: startTime + GAMING_FEATURES.CHALLENGES.DURATION,
                participants: {},
                status: 'starting'
            };
            
            // Save to Firebase
            const challengeRef = doc(db, 'groups', groupId, 'challenges', challengeId);
            await setDoc(challengeRef, challengeData);
            
            // Cache locally
            this.activeChallenges.set(challengeId, challengeData);
            
            // Start countdown
            setTimeout(() => {
                this.activateChallenge(groupId, challengeId);
            }, 3000);
            
            return challengeId;
            
        } catch (error) {
            console.error('Error starting reaction challenge:', error);
            throw error;
        }
    }
    
    async activateChallenge(groupId, challengeId) {
        try {
            const challengeRef = doc(db, 'groups', groupId, 'challenges', challengeId);
            
            await updateDoc(challengeRef, {
                status: 'active',
                activatedAt: serverTimestamp()
            });
            
            // Play activation sound
            this.playAudioCue('challenge_start');
            
            // Auto-end after duration
            setTimeout(() => {
                this.endReactionChallenge(groupId, challengeId);
            }, GAMING_FEATURES.CHALLENGES.DURATION);
            
        } catch (error) {
            console.error('Error activating challenge:', error);
        }
    }
    
    async submitReaction(groupId, challengeId, reactionTime) {
        try {
            if (!this.firebaseUser) return;
            
            const challengeRef = doc(db, 'groups', groupId, 'challenges', challengeId);
            
            await updateDoc(challengeRef, {
                [`participants.${this.firebaseUser.uid}`]: reactionTime
            });
            
            // Update user stats
            await this.updateUserStat('reactionTime', reactionTime);
            
        } catch (error) {
            console.error('Error submitting reaction:', error);
        }
    }
    
    async endReactionChallenge(groupId, challengeId) {
        try {
            const challengeRef = doc(db, 'groups', groupId, 'challenges', challengeId);
            const challengeDoc = await getDoc(challengeRef);
            
            if (!challengeDoc.exists()) return;
            
            const challengeData = challengeDoc.data();
            const participants = challengeData.participants || {};
            
            // Find fastest reaction
            let winnerId = null;
            let fastestTime = Infinity;
            
            Object.entries(participants).forEach(([userId, reactionTime]) => {
                if (reactionTime < fastestTime) {
                    fastestTime = reactionTime;
                    winnerId = userId;
                }
            });
            
            // Update challenge
            await updateDoc(challengeRef, {
                status: 'ended',
                winnerId: winnerId,
                fastestTime: fastestTime,
                endedAt: serverTimestamp()
            });
            
            // Award reputation
            if (winnerId) {
                await this.updateUserReputation(winnerId, 5);
                
                // Give winner glowing name
                await this.applyTempEffect(winnerId, groupId, 'glowing', 86400000); // 24 hours
            }
            
            // Remove from active challenges
            this.activeChallenges.delete(challengeId);
            
            // Play end sound
            this.playAudioCue('challenge_end');
            
        } catch (error) {
            console.error('Error ending reaction challenge:', error);
        }
    }
    
    // ==================== FEATURE 5: REPUTATION POINT WAGERS ====================
    
    async placeWager(groupId, targetUserId, amount, prediction) {
        try {
            if (!this.firebaseUser) return;
            
            // Check if user has enough reputation
            const userRep = await this.getUserReputation(this.firebaseUser.uid);
            if (userRep < amount) {
                throw new Error('Insufficient reputation points');
            }
            
            const wagerId = `wager_${Date.now()}`;
            
            const wagerData = {
                id: wagerId,
                groupId: groupId,
                betterId: this.firebaseUser.uid,
                betterName: this.currentUser.displayName,
                targetId: targetUserId,
                amount: amount,
                prediction: prediction,
                status: 'pending',
                timestamp: serverTimestamp(),
                expiresAt: new Date(Date.now() + 3600000) // Expire in 1 hour
            };
            
            // Save wager
            const wagerRef = doc(db, 'groups', groupId, 'wagers', wagerId);
            await setDoc(wagerRef, wagerData);
            
            // Deduct reputation from better
            await this.updateUserReputation(this.firebaseUser.uid, -amount);
            
            return wagerId;
            
        } catch (error) {
            console.error('Error placing wager:', error);
            throw error;
        }
    }
    
    async resolveWager(groupId, wagerId, outcome) {
        try {
            const wagerRef = doc(db, 'groups', groupId, 'wagers', wagerId);
            const wagerDoc = await getDoc(wagerRef);
            
            if (!wagerDoc.exists()) return;
            
            const wagerData = wagerDoc.data();
            
            // Calculate winnings
            const winnings = wagerData.amount * 2; // Double or nothing
            
            if (outcome === 'win') {
                // Better wins
                await this.updateUserReputation(wagerData.betterId, winnings);
                
                // Update wager
                await updateDoc(wagerRef, {
                    status: 'won',
                    winnings: winnings,
                    resolvedAt: serverTimestamp()
                });
                
            } else {
                // Better loses (target gets the points)
                await this.updateUserReputation(wagerData.targetId, wagerData.amount);
                
                // Update wager
                await updateDoc(wagerRef, {
                    status: 'lost',
                    resolvedAt: serverTimestamp()
                });
            }
            
            // Play wager sound
            this.playAudioCue(outcome === 'win' ? 'win' : 'loss');
            
        } catch (error) {
            console.error('Error resolving wager:', error);
        }
    }
    
    // ==================== FEATURE 6: TEMPORARY USERNAME GLOW ====================
    
    async applyTempEffect(userId, groupId, effectType, duration) {
        try {
            const effectId = `effect_${Date.now()}`;
            const expiryTime = Date.now() + duration;
            
            const effectData = {
                id: effectId,
                userId: userId,
                groupId: groupId,
                effectType: effectType,
                appliedAt: serverTimestamp(),
                expiresAt: new Date(expiryTime),
                isActive: true
            };
            
            // Save effect
            const effectRef = doc(db, 'user_effects', effectId);
            await setDoc(effectRef, effectData);
            
            // Cache locally
            this.tempEffects.set(effectId, {
                ...effectData,
                expiresAt: new Date(expiryTime)
            });
            
            // Start expiry timer
            setTimeout(() => {
                this.removeTempEffect(effectId);
            }, duration);
            
        } catch (error) {
            console.error('Error applying temp effect:', error);
        }
    }
    
    async getActiveEffects(userId, groupId) {
        try {
            const effectsRef = collection(db, 'user_effects');
            const q = query(
                effectsRef,
                where('userId', '==', userId),
                where('groupId', '==', groupId),
                where('isActive', '==', true)
            );
            
            const snapshot = await getDocs(q);
            const effects = [];
            
            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                if (data.expiresAt?.toDate && data.expiresAt.toDate() > new Date()) {
                    effects.push(data);
                }
            });
            
            return effects;
            
        } catch (error) {
            console.error('Error getting active effects:', error);
            return [];
        }
    }
    
    // ==================== FEATURE 7: GROUP-ONLY PROFILES ====================
    
    async updateGroupProfile(groupId, profileData) {
        try {
            if (!this.firebaseUser) return;
            
            const groupProfileRef = doc(db, 'group_profiles', `${groupId}_${this.firebaseUser.uid}`);
            
            await setDoc(groupProfileRef, {
                userId: this.firebaseUser.uid,
                groupId: groupId,
                displayName: profileData.displayName,
                avatar: profileData.avatar,
                bio: profileData.bio || '',
                title: profileData.title || '',
                colorScheme: profileData.colorScheme || '#667eea',
                updatedAt: serverTimestamp()
            }, { merge: true });
            
            // Update cache
            if (!this.currentUser.groupSpecific) {
                this.currentUser.groupSpecific = {};
            }
            this.currentUser.groupSpecific[groupId] = profileData;
            
        } catch (error) {
            console.error('Error updating group profile:', error);
            throw error;
        }
    }
    
    async getGroupProfile(groupId, userId = null) {
        try {
            const targetUserId = userId || this.firebaseUser?.uid;
            if (!targetUserId) return null;
            
            const groupProfileRef = doc(db, 'group_profiles', `${groupId}_${targetUserId}`);
            const profileSnap = await getDoc(groupProfileRef);
            
            if (profileSnap.exists()) {
                return profileSnap.data();
            }
            
            return null;
            
        } catch (error) {
            console.error('Error getting group profile:', error);
            return null;
        }
    }
    
    // ==================== FEATURE 8: GROUP-ONLY BADGES ====================
    
    async awardGroupBadge(groupId, userId, badgeType, reason) {
        try {
            const badgeId = `badge_${Date.now()}`;
            
            const badgeData = {
                id: badgeId,
                userId: userId,
                groupId: groupId,
                badgeType: badgeType,
                awardedAt: serverTimestamp(),
                reason: reason,
                isActive: true
            };
            
            // Save badge
            const badgeRef = doc(db, 'group_badges', badgeId);
            await setDoc(badgeRef, badgeData);
            
            // Play achievement sound
            this.playAudioCue('achievement');
            
        } catch (error) {
            console.error('Error awarding group badge:', error);
        }
    }
    
    async getUserGroupBadges(groupId, userId) {
        try {
            const badgesRef = collection(db, 'group_badges');
            const q = query(
                badgesRef,
                where('userId', '==', userId),
                where('groupId', '==', groupId),
                where('isActive', '==', true)
            );
            
            const snapshot = await getDocs(q);
            const badges = [];
            
            snapshot.forEach(docSnap => {
                badges.push(docSnap.data());
            });
            
            return badges;
            
        } catch (error) {
            console.error('Error getting user badges:', error);
            return [];
        }
    }
    
    // ==================== FEATURE 9: ANIMATED PROFILE RINGS ====================
    
    async updateActivityRing(groupId, activityLevel) {
        try {
            if (!this.firebaseUser) return;
            
            const ringRef = doc(db, 'groups', groupId, 'activity_rings', this.firebaseUser.uid);
            
            await setDoc(ringRef, {
                userId: this.firebaseUser.uid,
                userName: this.currentUser.displayName,
                activityLevel: activityLevel,
                lastUpdated: serverTimestamp(),
                pulseAt: new Date(Date.now() + 1000) // Pulse in 1 second
            }, { merge: true });
            
            // Start pulse animation
            setTimeout(() => {
                this.triggerRingPulse(groupId, this.firebaseUser.uid);
            }, 1000);
            
        } catch (error) {
            console.error('Error updating activity ring:', error);
        }
    }
    
    async triggerRingPulse(groupId, userId) {
        try {
            const ringRef = doc(db, 'groups', groupId, 'activity_rings', userId);
            await updateDoc(ringRef, {
                isPulsing: true,
                pulseStarted: serverTimestamp()
            });
            
            // Stop pulse after 500ms
            setTimeout(async () => {
                await updateDoc(ringRef, {
                    isPulsing: false
                });
            }, 500);
            
        } catch (error) {
            console.error('Error triggering ring pulse:', error);
        }
    }
    
    // ==================== FEATURE 10: BEHAVIOR-BASED ACHIEVEMENTS ====================
    
    async checkAndAwardAchievements(groupId, actionType, data = {}) {
        try {
            if (!this.firebaseUser) return;
            
            const achievements = await this.getAvailableAchievements();
            const userAchievements = await this.getUserAchievements();
            
            for (const achievement of achievements) {
                // Check if user already has this achievement
                if (userAchievements.some(a => a.id === achievement.id)) {
                    continue;
                }
                
                // Check achievement criteria
                const shouldAward = await this.checkAchievementCriteria(
                    achievement, 
                    actionType, 
                    data
                );
                
                if (shouldAward) {
                    await this.awardAchievement(achievement.id, groupId);
                }
            }
            
        } catch (error) {
            console.error('Error checking achievements:', error);
        }
    }
    
    async awardAchievement(achievementId, groupId) {
        try {
            if (!this.firebaseUser) return;
            
            const achievementRef = doc(db, 'user_achievements', `${this.firebaseUser.uid}_${achievementId}`);
            
            await setDoc(achievementRef, {
                userId: this.firebaseUser.uid,
                achievementId: achievementId,
                groupId: groupId,
                awardedAt: serverTimestamp(),
                isNew: true
            });
            
            // Update reputation
            await this.updateUserReputation(this.firebaseUser.uid, 25);
            
            // Play achievement sound
            this.playAudioCue('achievement');
            
            // Show achievement notification
            this.showAchievementNotification(achievementId);
            
        } catch (error) {
            console.error('Error awarding achievement:', error);
        }
    }
    
    // ==================== FEATURE 11: CHAT MVP HIGHLIGHTS ====================
    
    async calculateChatMVP(groupId, timeRange = 'daily') {
        try {
            const messagesRef = collection(db, 'groups', groupId, 'messages');
            let startTime = new Date();
            
            switch (timeRange) {
                case 'daily':
                    startTime.setHours(startTime.getHours() - 24);
                    break;
                case 'weekly':
                    startTime.setDate(startTime.getDate() - 7);
                    break;
                case 'monthly':
                    startTime.setMonth(startTime.getMonth() - 1);
                    break;
            }
            
            const q = query(
                messagesRef,
                where('timestamp', '>=', startTime),
                where('type', '!=', 'system')
            );
            
            const snapshot = await getDocs(q);
            const userStats = {};
            
            // Analyze messages
            snapshot.forEach(docSnap => {
                const msg = docSnap.data();
                const userId = msg.senderId;
                
                if (!userStats[userId]) {
                    userStats[userId] = {
                        messageCount: 0,
                        reactionScore: 0,
                        engagementScore: 0,
                        userName: msg.senderName
                    };
                }
                
                userStats[userId].messageCount++;
                
                // Calculate score based on message properties
                let messageScore = 1;
                if (msg.imageUrl || msg.videoUrl) messageScore += 2;
                if (msg.reactions && Object.keys(msg.reactions).length > 0) {
                    messageScore += Object.keys(msg.reactions).length;
                }
                
                userStats[userId].engagementScore += messageScore;
            });
            
            // Find MVP
            let mvpUserId = null;
            let highestScore = 0;
            
            Object.entries(userStats).forEach(([userId, stats]) => {
                const totalScore = stats.engagementScore * 0.7 + stats.messageCount * 0.3;
                if (totalScore > highestScore) {
                    highestScore = totalScore;
                    mvpUserId = userId;
                }
            });
            
            if (mvpUserId) {
                // Award MVP badge
                await this.awardGroupBadge(
                    groupId, 
                    mvpUserId, 
                    'chat_mvp', 
                    `MVP of the ${timeRange} chat`
                );
                
                // Apply MVP effect
                await this.applyTempEffect(
                    mvpUserId, 
                    groupId, 
                    'legendary', 
                    86400000 // 24 hours
                );
                
                return {
                    userId: mvpUserId,
                    userName: userStats[mvpUserId].userName,
                    score: highestScore,
                    stats: userStats[mvpUserId]
                };
            }
            
            return null;
            
        } catch (error) {
            console.error('Error calculating chat MVP:', error);
            return null;
        }
    }
    
    // ==================== FEATURE 12: TEMPORARY CHAT MODES ====================
    
    async startChatModeVote(groupId, modeOptions = GAMING_FEATURES.CHAT_MODES.TYPES) {
        try {
            const voteId = `vote_${Date.now()}`;
            const endTime = Date.now() + 60000; // 1 minute vote
            
            // Create vote
            const voteRef = doc(db, 'groups', groupId, 'mode_votes', voteId);
            
            await setDoc(voteRef, {
                id: voteId,
                groupId: groupId,
                modeOptions: modeOptions,
                votes: {},
                status: 'active',
                endTime: new Date(endTime),
                createdAt: serverTimestamp()
            });
            
            // Auto-end vote
            setTimeout(() => {
                this.endChatModeVote(groupId, voteId);
            }, 60000);
            
            return voteId;
            
        } catch (error) {
            console.error('Error starting chat mode vote:', error);
            throw error;
        }
    }
    
    async voteForChatMode(groupId, voteId, mode) {
        try {
            if (!this.firebaseUser) return;
            
            const voteRef = doc(db, 'groups', groupId, 'mode_votes', voteId);
            
            await updateDoc(voteRef, {
                [`votes.${this.firebaseUser.uid}`]: mode
            });
            
        } catch (error) {
            console.error('Error voting for chat mode:', error);
        }
    }
    
    async endChatModeVote(groupId, voteId) {
        try {
            const voteRef = doc(db, 'groups', groupId, 'mode_votes', voteId);
            const voteDoc = await getDoc(voteRef);
            
            if (!voteDoc.exists()) return;
            
            const voteData = voteDoc.data();
            const votes = voteData.votes || {};
            
            // Count votes
            const voteCount = {};
            Object.values(votes).forEach(mode => {
                voteCount[mode] = (voteCount[mode] || 0) + 1;
            });
            
            // Determine winner
            let winnerMode = 'normal';
            let maxVotes = 0;
            
            Object.entries(voteCount).forEach(([mode, count]) => {
                if (count > maxVotes) {
                    maxVotes = count;
                    winnerMode = mode;
                }
            });
            
            // Update vote status
            await updateDoc(voteRef, {
                status: 'ended',
                winnerMode: winnerMode,
                endedAt: serverTimestamp()
            });
            
            // Start the winning chat mode
            await this.setChatMode(groupId, winnerMode);
            
        } catch (error) {
            console.error('Error ending chat mode vote:', error);
        }
    }
    
    async setChatMode(groupId, mode) {
        try {
            this.chatMode = mode;
            
            const modeRef = doc(db, 'groups', groupId, 'chat_mode');
            
            await setDoc(modeRef, {
                mode: mode,
                startedAt: serverTimestamp(),
                endsAt: new Date(Date.now() + GAMING_FEATURES.CHAT_MODES.DURATION)
            }, { merge: true });
            
            // Apply mode-specific effects
            await this.applyChatModeEffects(groupId, mode);
            
            // Play mode change sound
            this.playAudioCue('mode_change');
            
            // Auto-revert after duration
            setTimeout(() => {
                this.setChatMode(groupId, 'normal');
            }, GAMING_FEATURES.CHAT_MODES.DURATION);
            
        } catch (error) {
            console.error('Error setting chat mode:', error);
        }
    }
    
    async applyChatModeEffects(groupId, mode) {
        switch (mode) {
            case 'chaos':
                // Activate chaos visual effects
                document.dispatchEvent(new CustomEvent('chatModeChange', {
                    detail: { mode: 'chaos' }
                }));
                break;
                
            case 'stealth':
                // Hide usernames
                document.dispatchEvent(new CustomEvent('chatModeChange', {
                    detail: { mode: 'stealth' }
                }));
                break;
                
            case 'night_raid':
                // Set dark theme and ambient sounds
                document.body.classList.add('night-raid-mode');
                this.startAmbientSound('night_ambient');
                break;
                
            case 'slow':
                // Apply slow mode (limit messages)
                document.dispatchEvent(new CustomEvent('chatModeChange', {
                    detail: { mode: 'slow', rate: 1 }
                }));
                break;
        }
    }
    
    // ==================== FEATURE 13: VISIBLE LURKERS ====================
    
    async updateLurkerStatus(groupId, isActive = false) {
        try {
            if (!this.firebaseUser) return;
            
            const lurkerRef = doc(db, 'groups', groupId, 'lurkers', this.firebaseUser.uid);
            
            await setDoc(lurkerRef, {
                userId: this.firebaseUser.uid,
                userName: this.currentUser.displayName,
                userAvatar: this.currentUser.avatar,
                isActive: isActive,
                lastSeen: serverTimestamp(),
                expiresAt: new Date(Date.now() + 300000) // Expire after 5 minutes
            }, { merge: true });
            
        } catch (error) {
            console.error('Error updating lurker status:', error);
        }
    }
    
    async getVisibleLurkers(groupId) {
        try {
            const lurkersRef = collection(db, 'groups', groupId, 'lurkers');
            const snapshot = await getDocs(lurkersRef);
            
            const lurkers = [];
            const now = Date.now();
            
            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                const expiresAt = data.expiresAt?.toDate ? 
                    data.expiresAt.toDate().getTime() : 
                    new Date(data.expiresAt).getTime();
                
                if (now < expiresAt) {
                    lurkers.push({
                        id: docSnap.id,
                        ...data,
                        lastSeen: data.lastSeen?.toDate ? 
                            data.lastSeen.toDate() : 
                            new Date(data.lastSeen)
                    });
                }
            });
            
            return lurkers;
            
        } catch (error) {
            console.error('Error getting visible lurkers:', error);
            return [];
        }
    }
    
    // ==================== FEATURE 14: SPECTATOR COUNT ====================
    
    async updateSpectatorCount(groupId, countChange = 1) {
        try {
            const statsRef = doc(db, 'groups', groupId, 'stats', 'spectators');
            
            await setDoc(statsRef, {
                count: increment(countChange),
                lastUpdated: serverTimestamp()
            }, { merge: true });
            
        } catch (error) {
            console.error('Error updating spectator count:', error);
        }
    }
    
    async getSpectatorCount(groupId) {
        try {
            const statsRef = doc(db, 'groups', groupId, 'stats', 'spectators');
            const statsSnap = await getDoc(statsRef);
            
            if (statsSnap.exists()) {
                return statsSnap.data().count || 0;
            }
            
            return 0;
            
        } catch (error) {
            console.error('Error getting spectator count:', error);
            return 0;
        }
    }
    
    // ==================== FEATURE 15: BRANCHING REPLY TREES ====================
    
    async createReplyTree(groupId, parentMessageId, messageData) {
        try {
            if (!this.firebaseUser) return;
            
            // Create reply
            const replyRef = doc(collection(db, 'groups', groupId, 'replies'));
            
            const replyData = {
                id: replyRef.id,
                parentId: parentMessageId,
                senderId: this.firebaseUser.uid,
                senderName: this.currentUser.displayName,
                senderAvatar: this.currentUser.avatar,
                ...messageData,
                timestamp: serverTimestamp(),
                depth: await this.calculateReplyDepth(groupId, parentMessageId),
                branchId: await this.getOrCreateBranchId(groupId, parentMessageId),
                children: []
            };
            
            await setDoc(replyRef, replyData);
            
            // Update parent's children list
            if (parentMessageId !== 'root') {
                const parentRef = doc(db, 'groups', groupId, 'replies', parentMessageId);
                await updateDoc(parentRef, {
                    children: arrayUnion(replyRef.id)
                });
            }
            
            return replyRef.id;
            
        } catch (error) {
            console.error('Error creating reply tree:', error);
            throw error;
        }
    }
    
    async calculateReplyDepth(groupId, parentMessageId, currentDepth = 0) {
        if (parentMessageId === 'root') return currentDepth;
        
        try {
            const parentRef = doc(db, 'groups', groupId, 'replies', parentMessageId);
            const parentSnap = await getDoc(parentRef);
            
            if (parentSnap.exists()) {
                const parentData = parentSnap.data();
                return await this.calculateReplyDepth(groupId, parentData.parentId, currentDepth + 1);
            }
            
            return currentDepth;
            
        } catch (error) {
            console.error('Error calculating reply depth:', error);
            return currentDepth;
        }
    }
    
    // ==================== FEATURE 16: SOFT GAME-STYLE AUDIO CUES ====================
    
    setupAudioSystem() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.loadAudioFiles();
        } catch (error) {
            console.warn('Web Audio API not supported:', error);
        }
    }
    
    async loadAudioFiles() {
        const audioFiles = {
            join: 'sounds/join.mp3',
            win: 'sounds/win.mp3',
            loss: 'sounds/loss.mp3',
            level_up: 'sounds/level_up.mp3',
            achievement: 'sounds/achievement.mp3',
            game_start: 'sounds/game_start.mp3',
            challenge_start: 'sounds/challenge_start.mp3',
            challenge_end: 'sounds/challenge_end.mp3',
            mode_change: 'sounds/mode_change.mp3',
            send: 'sounds/send.mp3',
            night_ambient: 'sounds/night_ambient.mp3'
        };
        
        for (const [key, url] of Object.entries(audioFiles)) {
            await this.loadAudioBuffer(url, key);
        }
    }
    
    async loadAudioBuffer(url, key) {
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            this.audioBuffers.set(key, audioBuffer);
        } catch (error) {
            console.warn(`Failed to load audio: ${url}`, error);
        }
    }
    
    playAudioCue(cueType, volume = GAMING_FEATURES.AUDIO_CUES.VOLUME) {
        try {
            if (!this.audioContext || !this.audioBuffers.has(cueType)) return;
            
            const source = this.audioContext.createBufferSource();
            const gainNode = this.audioContext.createGain();
            
            source.buffer = this.audioBuffers.get(cueType);
            gainNode.gain.value = volume;
            
            source.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            source.start();
            
        } catch (error) {
            console.warn('Failed to play audio cue:', error);
        }
    }
    
    startAmbientSound(soundType) {
        try {
            if (!this.audioContext || !this.audioBuffers.has(soundType)) return;
            
            if (this.backgroundAudio) {
                this.backgroundAudio.stop();
            }
            
            const source = this.audioContext.createBufferSource();
            const gainNode = this.audioContext.createGain();
            
            source.buffer = this.audioBuffers.get(soundType);
            gainNode.gain.value = 0.1; // Very low volume for ambient
            source.loop = true;
            
            source.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            source.start();
            this.backgroundAudio = source;
            
        } catch (error) {
            console.warn('Failed to start ambient sound:', error);
        }
    }
    
    stopAmbientSound() {
        if (this.backgroundAudio) {
            this.backgroundAudio.stop();
            this.backgroundAudio = null;
        }
    }
    
    // ==================== FEATURE 17: DECAYING ANIMATED REACTIONS ====================
    
    async addDecayingReaction(groupId, messageId, reactionType, userId = null) {
        try {
            const targetUserId = userId || this.firebaseUser?.uid;
            if (!targetUserId) return;
            
            const reactionId = `reaction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const decayTime = Date.now() + 10000; // Decay after 10 seconds
            
            const reactionData = {
                id: reactionId,
                messageId: messageId,
                groupId: groupId,
                userId: targetUserId,
                userName: this.currentUser.displayName,
                reactionType: reactionType,
                intensity: 1.0,
                createdAt: serverTimestamp(),
                decayAt: new Date(decayTime),
                isActive: true
            };
            
            // Save reaction
            const reactionRef = doc(db, 'decaying_reactions', reactionId);
            await setDoc(reactionRef, reactionData);
            
            // Start decay animation
            this.startReactionDecay(reactionId, decayTime);
            
            return reactionId;
            
        } catch (error) {
            console.error('Error adding decaying reaction:', error);
        }
    }
    
    startReactionDecay(reactionId, decayTime) {
        const decayDuration = decayTime - Date.now();
        
        // Schedule decay
        this.reactionTimers.set(reactionId, setTimeout(async () => {
            await this.decayReaction(reactionId);
        }, decayDuration));
    }
    
    async decayReaction(reactionId) {
        try {
            const reactionRef = doc(db, 'decaying_reactions', reactionId);
            
            // Update to decaying state
            await updateDoc(reactionRef, {
                isActive: false,
                decayedAt: serverTimestamp(),
                intensity: 0
            });
            
            // Remove from timers
            this.reactionTimers.delete(reactionId);
            
            // Schedule cleanup
            setTimeout(async () => {
                await deleteDoc(reactionRef);
            }, 5000); // Keep for 5 seconds after decay
            
        } catch (error) {
            console.error('Error decaying reaction:', error);
        }
    }
    
    // ==================== FEATURE 18: PERSONAL SESSION TIMER ====================
    
    startSessionTimer() {
        if (!this.firebaseUser) return;
        
        const sessionId = `session_${Date.now()}`;
        const startTime = Date.now();
        
        this.userSessions.set(sessionId, {
            startTime: startTime,
            duration: 0,
            isActive: true
        });
        
        // Update duration every minute
        const durationInterval = setInterval(() => {
            const session = this.userSessions.get(sessionId);
            if (session && session.isActive) {
                session.duration = Date.now() - session.startTime;
                
                // Update UI
                this.updateSessionDisplay(session.duration);
                
                // Check for achievements
                if (session.duration > 300000) { // 5 minutes
                    this.checkAndAwardAchievements(null, 'session_length', {
                        duration: session.duration
                    });
                }
            } else {
                clearInterval(durationInterval);
            }
        }, 60000); // Update every minute
        
        // Save session on page unload
        window.addEventListener('beforeunload', () => {
            this.endSession(sessionId);
        });
    }
    
    updateSessionDisplay(durationMs) {
        const hours = Math.floor(durationMs / 3600000);
        const minutes = Math.floor((durationMs % 3600000) / 60000);
        const seconds = Math.floor((durationMs % 60000) / 1000);
        
        const display = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        // Dispatch event to update UI
        document.dispatchEvent(new CustomEvent('sessionTimerUpdate', {
            detail: { display, durationMs }
        }));
    }
    
    async endSession(sessionId) {
        const session = this.userSessions.get(sessionId);
        if (session) {
            session.isActive = false;
            session.endTime = Date.now();
            session.duration = session.endTime - session.startTime;
            
            // Save session to database
            await this.saveSessionToDatabase(session);
        }
    }
    
    // ==================== FEATURE 19: GROUP ACTIVITY STREAK ====================
    
    async updateGroupStreak(groupId) {
        try {
            const streakRef = doc(db, 'groups', groupId, 'stats', 'streak');
            const streakSnap = await getDoc(streakRef);
            
            const now = Date.now();
            let streakData;
            
            if (streakSnap.exists()) {
                streakData = streakSnap.data();
                const lastActivity = streakData.lastActivity?.toDate ? 
                    streakData.lastActivity.toDate().getTime() : 
                    new Date(streakData.lastActivity).getTime();
                
                // Check if streak is still active (within 5 minutes)
                if (now - lastActivity <= 300000) {
                    // Continue streak
                    streakData.currentStreak++;
                    streakData.longestStreak = Math.max(streakData.currentStreak, streakData.longestStreak);
                } else {
                    // Break streak
                    streakData.currentStreak = 1;
                }
            } else {
                // Start new streak
                streakData = {
                    currentStreak: 1,
                    longestStreak: 1,
                    startedAt: serverTimestamp()
                };
            }
            
            // Update streak
            streakData.lastActivity = serverTimestamp();
            await setDoc(streakRef, streakData, { merge: true });
            
            // Cache locally
            this.groupStreaks.set(groupId, streakData);
            
            // Update UI
            document.dispatchEvent(new CustomEvent('groupStreakUpdate', {
                detail: { groupId, streak: streakData.currentStreak }
            }));
            
        } catch (error) {
            console.error('Error updating group streak:', error);
        }
    }
    
    // ==================== FEATURE 20: LIVE EVENT TRIGGERS ====================
    
    startLiveEventScheduler(groupId) {
        // Schedule random events every 5-15 minutes
        const scheduleNextEvent = () => {
            const delay = Math.random() * 600000 + 300000; // 5-15 minutes
            setTimeout(() => {
                this.triggerRandomEvent(groupId);
                scheduleNextEvent();
            }, delay);
        };
        
        scheduleNextEvent();
    }
    
    async triggerRandomEvent(groupId) {
        const events = [
            'mini_game',
            'reaction_challenge',
            'chat_mode_vote',
            'reputation_bonus',
            'special_achievement'
        ];
        
        const randomEvent = events[Math.floor(Math.random() * events.length)];
        
        switch (randomEvent) {
            case 'mini_game':
                await this.startMiniGame(groupId, this.getRandomGameType());
                break;
                
            case 'reaction_challenge':
                await this.startReactionChallenge(groupId, this.getRandomChallengeType());
                break;
                
            case 'chat_mode_vote':
                await this.startChatModeVote(groupId);
                break;
                
            case 'reputation_bonus':
                await this.giveReputationBonus(groupId);
                break;
                
            case 'special_achievement':
                await this.awardSpecialAchievement(groupId);
                break;
        }
        
        // Play event sound
        this.playAudioCue('event');
    }
    
    // ==================== HELPER METHODS ====================
    
    async updateUserReputation(userId, amount) {
        try {
            const profileRef = doc(db, 'gaming_profiles', userId);
            
            await updateDoc(profileRef, {
                reputation: increment(amount),
                'gamingStats.totalReputation': increment(amount > 0 ? amount : 0)
            });
            
            // Update cache
            if (this.gamingCache.userReputation.has(userId)) {
                const current = this.gamingCache.userReputation.get(userId);
                this.gamingCache.userReputation.set(userId, current + amount);
            }
            
        } catch (error) {
            console.error('Error updating user reputation:', error);
        }
    }
    
    async updateUserStat(statName, value) {
        try {
            if (!this.firebaseUser) return;
            
            const profileRef = doc(db, 'gaming_profiles', this.firebaseUser.uid);
            
            await updateDoc(profileRef, {
                [`gamingStats.${statName}`]: increment(value)
            });
            
        } catch (error) {
            console.error('Error updating user stat:', error);
        }
    }
    
    async getUserReputation(userId) {
        try {
            if (this.gamingCache.userReputation.has(userId)) {
                return this.gamingCache.userReputation.get(userId);
            }
            
            const profileRef = doc(db, 'gaming_profiles', userId);
            const profileSnap = await getDoc(profileRef);
            
            if (profileSnap.exists()) {
                const reputation = profileSnap.data().reputation || 100;
                this.gamingCache.userReputation.set(userId, reputation);
                return reputation;
            }
            
            return 100; // Default reputation
            
        } catch (error) {
            console.error('Error getting user reputation:', error);
            return 100;
        }
    }
    
    async sendGameNotification(groupId, message) {
        try {
            const notificationRef = doc(collection(db, 'game_notifications'));
            
            await setDoc(notificationRef, {
                groupId: groupId,
                message: message,
                timestamp: serverTimestamp(),
                isActive: true,
                expiresAt: new Date(Date.now() + 10000) // Show for 10 seconds
            });
            
        } catch (error) {
            console.error('Error sending game notification:', error);
        }
    }
    
    getRandomGameType() {
        const types = GAMING_FEATURES.MINI_GAMES.TYPES;
        return types[Math.floor(Math.random() * types.length)];
    }
    
    getRandomChallengeType() {
        const types = GAMING_FEATURES.CHALLENGES.TYPES;
        return types[Math.floor(Math.random() * types.length)];
    }
    
    generateTriviaQuestions() {
        // In a real implementation, this would fetch from a trivia API
        return [
            {
                question: "What year was the first video game created?",
                options: ["1958", "1972", "1983", "1991"],
                answer: 0,
                points: 10
            },
            {
                question: "Which company created the Nintendo Switch?",
                options: ["Sony", "Microsoft", "Nintendo", "Sega"],
                answer: 2,
                points: 10
            }
        ];
    }
    
    generateScrambleWord() {
        const words = [
            "gaming", "strategy", "victory", "champion", 
            "legendary", "epic", "quest", "adventure"
        ];
        return words[Math.floor(Math.random() * words.length)];
    }
    
    scrambleWord(word) {
        const arr = word.split('');
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr.join('');
    }
    
    generateEmojiSequence() {
        const emojis = ['🎮', '👾', '🕹️', '🎯', '🏆', '⚔️', '🛡️', '✨'];
        const sequence = [];
        for (let i = 0; i < 5; i++) {
            sequence.push(emojis[Math.floor(Math.random() * emojis.length)]);
        }
        return sequence;
    }
    
    async getAvailableAchievements() {
        // In a real implementation, this would fetch from database
        return [
            {
                id: 'first_game',
                name: 'First Game',
                description: 'Play your first mini game',
                icon: '🎮',
                points: 10
            },
            {
                id: 'chat_master',
                name: 'Chat Master',
                description: 'Send 100 messages',
                icon: '💬',
                points: 25
            },
            {
                id: 'reaction_king',
                name: 'Reaction King',
                description: 'Win 5 reaction challenges',
                icon: '⚡',
                points: 50
            }
        ];
    }
    
    async getUserAchievements() {
        try {
            if (!this.firebaseUser) return [];
            
            const achievementsRef = collection(db, 'user_achievements');
            const q = query(achievementsRef, where('userId', '==', this.firebaseUser.uid));
            
            const snapshot = await getDocs(q);
            const achievements = [];
            
            snapshot.forEach(docSnap => {
                achievements.push(docSnap.data());
            });
            
            return achievements;
            
        } catch (error) {
            console.error('Error getting user achievements:', error);
            return [];
        }
    }
    
    async checkAchievementCriteria(achievement, actionType, data) {
        // Implement achievement checking logic
        // This would check if the user meets the criteria for the achievement
        return false; // Simplified for example
    }
    
    showAchievementNotification(achievementId) {
        document.dispatchEvent(new CustomEvent('achievementUnlocked', {
            detail: { achievementId }
        }));
    }
    
    async giveReputationBonus(groupId) {
        try {
            // Give random reputation bonus to all active users
            const bonus = Math.floor(Math.random() * 20) + 5; // 5-25 points
            
            // This would need to get all active users in the group
            // For now, just give to current user
            if (this.firebaseUser) {
                await this.updateUserReputation(this.firebaseUser.uid, bonus);
            }
            
        } catch (error) {
            console.error('Error giving reputation bonus:', error);
        }
    }
    
    async awardSpecialAchievement(groupId) {
        try {
            if (!this.firebaseUser) return;
            
            // Award random special achievement
            const specialAchievements = ['lucky_streak', 'event_champion', 'bonus_hunter'];
            const achievement = specialAchievements[Math.floor(Math.random() * specialAchievements.length)];
            
            await this.awardAchievement(achievement, groupId);
            
        } catch (error) {
            console.error('Error awarding special achievement:', error);
        }
    }
    
    async getOrCreateBranchId(groupId, parentMessageId) {
        // Simplified branch ID generation
        return `branch_${parentMessageId}_${Date.now()}`;
    }
    
    async saveSessionToDatabase(session) {
        try {
            if (!this.firebaseUser) return;
            
            const sessionRef = doc(collection(db, 'user_sessions'));
            
            await setDoc(sessionRef, {
                userId: this.firebaseUser.uid,
                startTime: new Date(session.startTime),
                endTime: new Date(session.endTime),
                duration: session.duration,
                activities: session.activities || []
            });
            
        } catch (error) {
            console.error('Error saving session to database:', error);
        }
    }
    
    async removeTempEffect(effectId) {
        try {
            const effectRef = doc(db, 'user_effects', effectId);
            await updateDoc(effectRef, {
                isActive: false,
                removedAt: serverTimestamp()
            });
            
            this.tempEffects.delete(effectId);
            
        } catch (error) {
            console.error('Error removing temp effect:', error);
        }
    }
    
    cleanup() {
        // Clear all listeners
        if (this.unsubscribeActivity) {
            this.unsubscribeActivity();
            this.unsubscribeActivity = null;
        }
        
        if (this.unsubscribeGames) {
            this.unsubscribeGames();
            this.unsubscribeGames = null;
        }
        
        if (this.unsubscribeEvents) {
            this.unsubscribeEvents();
            this.unsubscribeEvents = null;
        }
        
        if (this.unsubscribeVoice) {
            this.unsubscribeVoice();
            this.unsubscribeVoice = null;
        }
        
        // Stop all timers
        this.reactionTimers.forEach(timer => clearTimeout(timer));
        this.reactionTimers.clear();
        
        // Stop ambient sound
        this.stopAmbientSound();
        
        // End all sessions
        this.userSessions.forEach((session, sessionId) => {
            if (session.isActive) {
                this.endSession(sessionId);
            }
        });
        
        this.isListening = false;
    }
}

// Create global instance
const gamingSystem = new GamingChatSystem();

// Export for use in HTML
window.gamingSystem = gamingSystem;

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('Gaming Chat System initialized');
    
    // Start live event scheduler for current group
    const urlParams = new URLSearchParams(window.location.search);
    const groupId = urlParams.get('id');
    
    if (groupId) {
        gamingSystem.startLiveEventScheduler(groupId);
    }
});

