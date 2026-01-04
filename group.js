// group.js - Complete Group Chat System with Cloudinary Media Support & Invite Links
// UPDATED: Added typing indicators, glowing messages, fire ring avatars, and reward tags
// UPDATED: Replaced Font Awesome icons with Feather icons, fixed message sending status display
// UPDATED: Fixed issues - soft glow, page refresh, send button loader, group name truncation, SVG icons
// FIXED: Message disappearing/reappearing issue and typing indicators not working
// FIXED: Entire page rerender on message send and q is not defined error
// FIXED: Messages displaying twice when returning to page - moved renderedMessageIds to window object

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

const CACHE_DURATION = {
    USER_PROFILE: 5 * 60 * 1000,
    GROUP_DATA: 2 * 60 * 1000,
    MEMBERS_LIST: 1 * 60 * 1000,
    BLOCKED_USERS: 10 * 60 * 1000
};

// Emojis for reactions (100 emojis like Discord)
const REACTION_EMOJIS = [
    '😀', '😂', '🥰', '😎', '🤔', '👍', '🎉', '❤️', '🔥', '✨',
    '😊', '😍', '🤩', '😜', '😋', '😇', '🥳', '😏', '😒', '🥺',
    '😭', '😡', '🤯', '😱', '🤢', '🤮', '🤠', '🥶', '😈', '👻',
    '💀', '🤖', '👽', '👾', '🤡', '💩', '🙈', '🙉', '🙊', '💋',
    '💌', '💘', '💝', '💖', '💗', '💓', '💞', '💕', '💟', '❣️',
    '💔', '❤️‍🔥', '❤️‍🩹', '💤', '💢', '💬', '👁️‍🗨️', '🗨️', '🗯️', '💭',
    '💐', '🌸', '💮', '🏵️', '🌹', '🥀', '🌺', '🌻', '🌼', '🌷',
    '⚡', '💥', '💫', '⭐', '🌟', '🌠', '🌈', '☀️', '🌤️', '⛈️',
    '❄️', '☃️', '⛄', '💧', '💦', '💨', '🕳️', '🎃', '🎄', '🎆',
    '🎇', '🧨', '✨', '🎈', '🎉', '🎊', '🎋', '🎍', '🎎', '🎏'
];

// New constants for typing indicators and reward system
const TYPING_TIMEOUT = 5000; // 5 seconds
const CONSECUTIVE_MESSAGES_THRESHOLD = 5; // Messages needed for glowing effect
const REWARD_TIME_THRESHOLDS = {
    THREE_MINUTES: 3 * 60 * 1000, // 3 minutes in milliseconds
    TEN_MINUTES: 10 * 60 * 1000, // 10 minutes
    TWENTY_MINUTES: 20 * 60 * 1000 // 20 minutes
};
const REWARD_TAGS = {
    THREE_MINUTES: '🏆 Active Chatter',
    TEN_MINUTES: '🔥 Chat Master',
    TWENTY_MINUTES: '🌟 Ultimate Conversationalist'
};

class GroupChat {
    constructor() {
        this.currentUser = null;
        this.firebaseUser = null;
        this.currentGroupId = null;
        this.currentChatPartnerId = null;
        this.unsubscribeMessages = null;
        this.unsubscribeMembers = null;
        this.unsubscribePrivateMessages = null;
        this.unsubscribeAuth = null;
        this.unsubscribePrivateChats = null;
        
        this.cache = {
            userProfile: null,
            userProfileExpiry: 0,
            joinedGroups: new Map(),
            groupData: new Map(),
            groupMembers: new Map(),
            profileSetupChecked: false,
            blockedUsers: new Map(),
            messageReactions: new Map(),
            userProfiles: new Map(),
            mutualGroups: new Map(),
            privateChats: new Map(),
            unreadCounts: new Map(),
            groupChats: new Map(),
            groupInvites: new Map(),
            adminGroups: new Map(),
            allGroups: new Map(),
            messages: new Map()
        };
        
        this.replyingToMessage = null;
        this.longPressTimer = null;
        this.selectedMessage = null;
        this.messageContextMenu = null;
        
        this.areListenersSetup = false;
        
        this.privateChats = new Map();
        this.unreadMessages = new Map();
        
        this.isLoadingMessages = false;
        
        this.tempPrivateMessages = new Map();
        this.privateChatImageInput = null;
        
        this.sentMessageIds = new Set();
        this.pendingMessages = new Set();
        
        this.restrictedUsers = new Map();
        
        this.reactionModal = null;
        this.currentMessageForReaction = null;
        
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.isSwiping = false;
        this.swipeThreshold = 50;
        
        this.lastDisplayedMessages = new Set();
        this.messageRenderQueue = [];
        this.isRendering = false;
        
        this.blockedUsers = new Map();
        
        // NEW: Typing indicators and reward tracking
        this.typingUsers = new Map(); // groupId -> Map(userId -> typingTimeout)
        this.lastMessageTimes = new Map(); // userId -> last message timestamp
        this.userMessageStreaks = new Map(); // userId -> consecutive message count
        this.userStreakTimers = new Map(); // userId -> streak timer
        this.userRewards = new Map(); // userId -> current reward tag
        this.userActiveDurations = new Map(); // userId -> active duration in ms
        
        this.setupAuthListener();
        this.createReactionModal();
        this.checkRestrictedUsers();
        this.loadBlockedUsers();
    }

    getCachedItem(cacheKey, cacheMap) {
        const cached = cacheMap.get(cacheKey);
        if (!cached) return null;
        
        if (Date.now() > cached.expiry) {
            cacheMap.delete(cacheKey);
            return null;
        }
        
        return cached.data;
    }

    setCachedItem(cacheKey, data, cacheMap, duration) {
        cacheMap.set(cacheKey, {
            data: data,
            expiry: Date.now() + duration
        });
    }

    clearGroupCache(groupId) {
        this.cache.groupData.delete(groupId);
        this.cache.groupMembers.delete(groupId);
        this.cache.joinedGroups.delete(groupId);
        this.cache.messageReactions.delete(groupId);
    }

    clearAllCache() {
        this.cache = {
            userProfile: null,
            userProfileExpiry: 0,
            joinedGroups: new Map(),
            groupData: new Map(),
            groupMembers: new Map(),
            profileSetupChecked: false,
            blockedUsers: new Map(),
            messageReactions: new Map(),
            userProfiles: new Map(),
            mutualGroups: new Map(),
            privateChats: new Map(),
            unreadCounts: new Map(),
            groupChats: new Map(),
            groupInvites: new Map(),
            adminGroups: new Map(),
            allGroups: new Map(),
            messages: new Map()
        };
        this.lastDisplayedMessages.clear();
        this.messageRenderQueue = [];
        
        // NEW: Clear typing and reward data
        this.typingUsers.clear();
        this.lastMessageTimes.clear();
        this.userMessageStreaks.clear();
        this.userStreakTimers.clear();
        this.userRewards.clear();
        this.userActiveDurations.clear();
    }

    async loadBlockedUsers() {
        try {
            if (!this.firebaseUser) return;
            
            const blockedRef = collection(db, 'blocked_users');
            const q = query(blockedRef, where('blockedById', '==', this.firebaseUser.uid));
            const snapshot = await getDocs(q);
            
            snapshot.forEach(doc => {
                const data = doc.data();
                this.blockedUsers.set(data.userId, data);
            });
        } catch (error) {
            console.error('Error loading blocked users:', error);
        }
    }

    async blockUser(userId) {
        try {
            if (!this.firebaseUser) return;
            
            const blockRef = doc(collection(db, 'blocked_users'));
            await setDoc(blockRef, {
                userId: userId,
                blockedById: this.firebaseUser.uid,
                blockedAt: serverTimestamp(),
                reason: 'Removed from group by admin'
            });
            
            this.blockedUsers.set(userId, {
                userId: userId,
                blockedById: this.firebaseUser.uid,
                blockedAt: new Date()
            });
            
            return true;
        } catch (error) {
            console.error('Error blocking user:', error);
            return false;
        }
    }

    async isUserBlocked(userId) {
        if (this.blockedUsers.has(userId)) {
            return true;
        }
        
        try {
            const blockedRef = collection(db, 'blocked_users');
            const q = query(blockedRef, 
                where('userId', '==', userId),
                where('blockedById', '==', this.firebaseUser.uid)
            );
            const snapshot = await getDocs(q);
            
            return !snapshot.empty;
        } catch (error) {
            console.error('Error checking if user is blocked:', error);
            return false;
        }
    }

    checkRestrictedUsers() {
        setInterval(() => {
            const now = Date.now();
            for (const [groupId, users] of this.restrictedUsers) {
                for (const [userId, restrictionEnd] of users) {
                    if (now > restrictionEnd) {
                        users.delete(userId);
                    }
                }
                if (users.size === 0) {
                    this.restrictedUsers.delete(groupId);
                }
            }
        }, 60000);
    }

    async restrictUser(groupId, userId, durationHours = 2) {
        if (!this.restrictedUsers.has(groupId)) {
            this.restrictedUsers.set(groupId, new Map());
        }
        
        const restrictionEnd = Date.now() + (durationHours * 60 * 60 * 1000);
        this.restrictedUsers.get(groupId).set(userId, restrictionEnd);
        
        try {
            const restrictionRef = doc(db, 'groups', groupId, 'restricted_users', userId);
            await setDoc(restrictionRef, {
                userId: userId,
                restrictedUntil: new Date(restrictionEnd),
                restrictedAt: serverTimestamp(),
                restrictedBy: this.firebaseUser?.uid,
                reason: 'Used restricted word'
            }, { merge: true });
        } catch (error) {
            console.error('Error saving restriction to Firebase:', error);
        }
    }

    async isUserRestricted(groupId, userId) {
        if (this.restrictedUsers.has(groupId)) {
            const restrictionEnd = this.restrictedUsers.get(groupId).get(userId);
            if (restrictionEnd && Date.now() < restrictionEnd) {
                return true;
            }
        }
        
        try {
            const restrictionRef = doc(db, 'groups', groupId, 'restricted_users', userId);
            const restrictionSnap = await getDoc(restrictionRef);
            
            if (restrictionSnap.exists()) {
                const data = restrictionSnap.data();
                const restrictedUntil = data.restrictedUntil?.toDate ? data.restrictedUntil.toDate() : new Date(data.restrictedUntil);
                
                if (Date.now() < restrictedUntil.getTime()) {
                    if (!this.restrictedUsers.has(groupId)) {
                        this.restrictedUsers.set(groupId, new Map());
                    }
                    this.restrictedUsers.get(groupId).set(userId, restrictedUntil.getTime());
                    return true;
                } else {
                    await deleteDoc(restrictionRef);
                }
            }
        } catch (error) {
            console.error('Error checking restriction in Firebase:', error);
        }
        
        return false;
    }

    async checkMessageForRestrictedWords(groupId, message) {
        try {
            const groupRef = doc(db, 'groups', groupId);
            const groupSnap = await getDoc(groupRef);
            
            if (groupSnap.exists()) {
                const groupData = groupSnap.data();
                const restrictedWords = groupData.restrictedWords || [];
                
                if (restrictedWords.length === 0) {
                    return false;
                }
                
                const messageLower = message.toLowerCase();
                for (const word of restrictedWords) {
                    if (word.trim() && messageLower.includes(word.toLowerCase().trim())) {
                        return word;
                    }
                }
            }
            return false;
        } catch (error) {
            console.error('Error checking restricted words:', error);
            return false;
        }
    }

    async uploadMediaToCloudinary(file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', cloudinaryConfig.uploadPreset);
        
        const isVideo = file.type.startsWith('video/');
        formData.append('resource_type', isVideo ? 'video' : 'image');
        
        try {
            const response = await fetch(
                `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/${isVideo ? 'video' : 'image'}/upload`,
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
            console.error('Error uploading media to Cloudinary:', error);
            throw error;
        }
    }

    validateImageFile(file) {
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
            throw new Error('Image file must be less than 10MB');
        }
        
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            throw new Error('Please upload a valid image file (JPEG, PNG, GIF, WebP)');
        }
        
        return true;
    }

    validateVideoFile(file) {
        const maxSize = 50 * 1024 * 1024;
        if (file.size > maxSize) {
            throw new Error('Video file must be less than 50MB');
        }
        
        const allowedTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo'];
        if (!allowedTypes.includes(file.type)) {
            throw new Error('Please upload a valid video file (MP4, WebM, OGG, MOV, AVI)');
        }
        
        return true;
    }

    async getUserProfile(userId, forceRefresh = false) {
        try {
            const cacheKey = `user_${userId}`;
            
            if (!forceRefresh) {
                const cached = this.getCachedItem(cacheKey, this.cache.userProfiles);
                if (cached) {
                    return cached;
                }
            }

            const userRef = doc(db, 'group_users', userId);
            const userSnap = await getDoc(userRef);
            
            if (userSnap.exists()) {
                const userData = userSnap.data();
                const profile = {
                    id: userId,
                    name: userData.displayName || 'User',
                    avatar: userData.avatar || AVATAR_OPTIONS[0],
                    bio: userData.bio || 'No bio available.',
                    email: userData.email || '',
                    lastSeen: userData.lastSeen ? 
                        (userData.lastSeen.toDate ? userData.lastSeen.toDate() : userData.lastSeen) : 
                        new Date(),
                    createdAt: userData.createdAt ? 
                        (userData.createdAt.toDate ? userData.createdAt.toDate() : userData.createdAt) : 
                        new Date(),
                    profileComplete: userData.displayName && userData.avatar ? true : false,
                    // NEW: Add reward tracking
                    rewardTag: userData.rewardTag || '',
                    glowEffect: userData.glowEffect || false,
                    fireRing: userData.fireRing || false
                };
                
                this.setCachedItem(cacheKey, profile, this.cache.userProfiles, CACHE_DURATION.USER_PROFILE);
                
                return profile;
            }
            return null;
        } catch (error) {
            console.error('Error getting user profile:', error);
            return null;
        }
    }

    async getMutualGroups(userId1, userId2) {
        try {
            const cacheKey = `mutual_${userId1}_${userId2}`;
            const cached = this.getCachedItem(cacheKey, this.cache.mutualGroups);
            if (cached) return cached;

            const groupsRef = collection(db, 'groups');
            const user1Groups = [];
            const querySnapshot = await getDocs(groupsRef);
            
            for (const docSnap of querySnapshot.docs) {
                const memberRef = doc(db, 'groups', docSnap.id, 'members', userId1);
                const memberSnap = await getDoc(memberRef);
                if (memberSnap.exists()) {
                    user1Groups.push(docSnap.id);
                }
            }
            
            const mutualGroups = [];
            for (const groupId of user1Groups) {
                const memberRef = doc(db, 'groups', groupId, 'members', userId2);
                const memberSnap = await getDoc(memberRef);
                if (memberSnap.exists()) {
                    const groupRef = doc(db, 'groups', groupId);
                    const groupSnap = await getDoc(groupRef);
                    if (groupSnap.exists()) {
                        const groupData = groupSnap.data();
                        mutualGroups.push({
                            id: groupId,
                            name: groupData.name,
                            avatar: groupData.photoUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(groupData.name)}`,
                            memberCount: groupData.memberCount || 0,
                            description: groupData.description || ''
                        });
                    }
                }
            }
            
            this.setCachedItem(cacheKey, mutualGroups, this.cache.mutualGroups, CACHE_DURATION.GROUP_DATA);
            
            return mutualGroups;
        } catch (error) {
            console.error('Error getting mutual groups:', error);
            return [];
        }
    }

    getPrivateChatId(userId1, userId2) {
        const ids = [userId1, userId2].sort();
        return `private_${ids[0]}_${ids[1]}`;
    }

    // NEW: Update user reward in database
    async updateUserReward(userId, rewardData) {
        try {
            const userRef = doc(db, 'group_users', userId);
            await updateDoc(userRef, {
                rewardTag: rewardData.tag,
                glowEffect: rewardData.glowEffect,
                fireRing: rewardData.fireRing,
                updatedAt: serverTimestamp()
            });
            
            // Update cache
            const cacheKey = `user_${userId}`;
            const cached = this.cache.userProfiles.get(cacheKey);
            if (cached) {
                cached.rewardTag = rewardData.tag;
                cached.glowEffect = rewardData.glowEffect;
                cached.fireRing = rewardData.fireRing;
            }
            
            return true;
        } catch (error) {
            console.error('Error updating user reward:', error);
            return false;
        }
    }

    // NEW: Send system message for reward upgrade
    async sendRewardSystemMessage(groupId, userId, userName, rewardTag) {
        try {
            const messagesRef = collection(db, 'groups', groupId, 'messages');
            
            await addDoc(messagesRef, {
                type: 'system',
                text: `🎉 Congratulations! ${userName} has been upgraded to "${rewardTag}"! 🎉`,
                timestamp: serverTimestamp(),
                senderId: 'system',
                senderName: 'System',
                senderAvatar: '',
                rewardUpgrade: true,
                rewardedUserId: userId,
                rewardedUserName: userName,
                rewardTag: rewardTag
            });
            
            return true;
        } catch (error) {
            console.error('Error sending reward system message:', error);
            return false;
        }
    }

    // NEW: Check and award user for activity
    async checkAndAwardUser(groupId, userId, userName) {
        try {
            const now = Date.now();
            const lastMessageTime = this.lastMessageTimes.get(userId) || 0;
            const timeSinceLastMessage = now - lastMessageTime;
            
            // Update active duration
            if (!this.userActiveDurations.has(userId)) {
                this.userActiveDurations.set(userId, 0);
            }
            
            // Add time since last message to active duration
            if (lastMessageTime > 0) {
                const currentDuration = this.userActiveDurations.get(userId);
                this.userActiveDurations.set(userId, currentDuration + timeSinceLastMessage);
            }
            
            // Check reward thresholds
            const activeDuration = this.userActiveDurations.get(userId);
            let rewardTag = '';
            
            if (activeDuration >= REWARD_TIME_THRESHOLDS.TWENTY_MINUTES && 
                (!this.userRewards.has(userId) || this.userRewards.get(userId) !== REWARD_TAGS.TWENTY_MINUTES)) {
                rewardTag = REWARD_TAGS.TWENTY_MINUTES;
            } else if (activeDuration >= REWARD_TIME_THRESHOLDS.TEN_MINUTES && 
                      activeDuration < REWARD_TIME_THRESHOLDS.TWENTY_MINUTES &&
                      (!this.userRewards.has(userId) || this.userRewards.get(userId) !== REWARD_TAGS.TEN_MINUTES)) {
                rewardTag = REWARD_TAGS.TEN_MINUTES;
            } else if (activeDuration >= REWARD_TIME_THRESHOLDS.THREE_MINUTES && 
                      activeDuration < REWARD_TIME_THRESHOLDS.TEN_MINUTES &&
                      (!this.userRewards.has(userId) || this.userRewards.get(userId) !== REWARD_TAGS.THREE_MINUTES)) {
                rewardTag = REWARD_TAGS.THREE_MINUTES;
            }
            
            // Award the reward if earned
            if (rewardTag) {
                this.userRewards.set(userId, rewardTag);
                
                // Update user profile in database
                const rewardData = {
                    tag: rewardTag,
                    glowEffect: activeDuration >= REWARD_TIME_THRESHOLDS.TEN_MINUTES,
                    fireRing: activeDuration >= REWARD_TIME_THRESHOLDS.TWENTY_MINUTES
                };
                
                await this.updateUserReward(userId, rewardData);
                
                // Send system message about the reward
                await this.sendRewardSystemMessage(groupId, userId, userName, rewardTag);
                
                console.log(`User ${userName} awarded: ${rewardTag}`);
                
                // Reset active duration for next tier
                if (rewardTag === REWARD_TAGS.TWENTY_MINUTES) {
                    this.userActiveDurations.set(userId, 0);
                }
            }
            
            // Update last message time
            this.lastMessageTimes.set(userId, now);
            
        } catch (error) {
            console.error('Error checking and awarding user:', error);
        }
    }

    // NEW: Update user message streak
    updateMessageStreak(userId) {
        const now = Date.now();
        const lastStreakTime = this.lastMessageTimes.get(userId) || 0;
        const timeSinceLastMessage = now - lastStreakTime;
        
        // Reset streak if more than 30 seconds between messages
        if (timeSinceLastMessage > 30000) {
            this.userMessageStreaks.set(userId, 1);
        } else {
            const currentStreak = this.userMessageStreaks.get(userId) || 0;
            this.userMessageStreaks.set(userId, currentStreak + 1);
        }
        
        // Clear previous streak timer
        if (this.userStreakTimers.has(userId)) {
            clearTimeout(this.userStreakTimers.get(userId));
        }
        
        // Set timer to reset streak after 30 seconds of inactivity
        const streakTimer = setTimeout(() => {
            this.userMessageStreaks.delete(userId);
        }, 30000);
        
        this.userStreakTimers.set(userId, streakTimer);
        this.lastMessageTimes.set(userId, now);
        
        return this.userMessageStreaks.get(userId) || 0;
    }

    // NEW: Check if user should have glowing messages
    shouldGlowMessage(userId) {
        const streak = this.userMessageStreaks.get(userId) || 0;
        return streak >= CONSECUTIVE_MESSAGES_THRESHOLD;
    }

    // NEW: Check if user should have fire ring avatar
    shouldHaveFireRing(userId) {
        const streak = this.userMessageStreaks.get(userId) || 0;
        return streak >= CONSECUTIVE_MESSAGES_THRESHOLD * 2; // After 10 consecutive messages
    }

    async sendPrivateMessage(toUserId, text = null, imageUrl = null, videoUrl = null, replyTo = null) {
        try {
            if (!this.firebaseUser || !this.currentUser) {
                throw new Error('You must be logged in to send messages');
            }
            
            if (!text && !imageUrl && !videoUrl) {
                throw new Error('Message cannot be empty');
            }
            
            const chatId = this.getPrivateChatId(this.firebaseUser.uid, toUserId);
            const messageId = `${chatId}_${this.firebaseUser.uid}_${Date.now()}`;
            
            if (this.sentMessageIds.has(messageId)) {
                console.log('Duplicate private message prevented:', messageId);
                return true;
            }
            
            this.sentMessageIds.add(messageId);
            
            const messagesRef = collection(db, 'private_chats', chatId, 'messages');
            
            const messageData = {
                senderId: this.firebaseUser.uid,
                senderName: this.currentUser.name,
                senderAvatar: this.currentUser.avatar,
                timestamp: serverTimestamp(),
                read: false,
                chatType: 'private'
            };
            
            if (replyTo) {
                messageData.replyTo = replyTo;
            }
            
            if (text) {
                messageData.text = text.trim();
            }
            
            if (imageUrl) {
                messageData.imageUrl = imageUrl;
                messageData.type = 'image';
            }
            
            if (videoUrl) {
                messageData.videoUrl = videoUrl;
                messageData.type = 'video';
            }
            
            await addDoc(messagesRef, messageData);
            
            const chatRef = doc(db, 'private_chats', chatId);
            await setDoc(chatRef, {
                participants: [this.firebaseUser.uid, toUserId],
                lastMessage: {
                    text: text ? text.trim() : (imageUrl ? '📷 Image' : videoUrl ? '🎬 Video' : ''),
                    senderId: this.firebaseUser.uid,
                    senderName: this.currentUser.name,
                    timestamp: serverTimestamp()
                },
                updatedAt: serverTimestamp()
            }, { merge: true });
            
            return true;
        } catch (error) {
            console.error('Error sending private message:', error);
            this.sentMessageIds.delete(messageId);
            throw error;
        }
    }

    async sendPrivateMediaMessage(toUserId, file, replyTo = null) {
        try {
            const isVideo = file.type.startsWith('video/');
            
            if (isVideo) {
                this.validateVideoFile(file);
            } else {
                this.validateImageFile(file);
            }
            
            const tempMessageId = 'temp_private_media_' + Date.now();
            this.showTempPrivateMediaMessage(toUserId, file, tempMessageId, isVideo);
            
            const mediaUrl = await this.uploadMediaToCloudinary(file);
            
            if (isVideo) {
                await this.sendPrivateMessage(toUserId, null, null, mediaUrl, replyTo);
            } else {
                await this.sendPrivateMessage(toUserId, null, mediaUrl, null, replyTo);
            }
            
            this.removeTempPrivateMessage(tempMessageId);
            
            return true;
        } catch (error) {
            console.error('Error sending private media message:', error);
            throw error;
        }
    }

    showTempPrivateMediaMessage(toUserId, file, tempId, isVideo = false) {
        if (this.currentChatPartnerId === toUserId) {
            const tempMediaUrl = URL.createObjectURL(file);
            this.tempPrivateMessages.set(tempId, {
                id: tempId,
                senderId: this.firebaseUser.uid,
                senderName: this.currentUser.name,
                senderAvatar: this.currentUser.avatar,
                [isVideo ? 'videoUrl' : 'imageUrl']: tempMediaUrl,
                timestamp: new Date().toISOString(),
                type: isVideo ? 'video' : 'image',
                status: 'uploading',
                chatType: 'private'
            });
            
            const event = new CustomEvent('tempPrivateMediaMessage', { 
                detail: { 
                    tempId,
                    message: this.tempPrivateMessages.get(tempId),
                    partnerId: toUserId 
                } 
            });
            document.dispatchEvent(event);
        }
    }

    removeTempPrivateMessage(tempId) {
        this.tempPrivateMessages.delete(tempId);
        const event = new CustomEvent('removeTempPrivateMessage', { detail: { tempId } });
        document.dispatchEvent(event);
    }

    async getPrivateMessages(otherUserId, limitCount = 50) {
        try {
            const chatId = this.getPrivateChatId(this.firebaseUser.uid, otherUserId);
            const messagesRef = collection(db, 'private_chats', chatId, 'messages');
            const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(limitCount));
            const querySnapshot = await getDocs(q);
            
            const messages = [];
            querySnapshot.forEach(doc => {
                const data = doc.data();
                messages.push({ 
                    id: doc.id, 
                    ...data,
                    chatType: 'private',
                    timestamp: data.timestamp ? (data.timestamp.toDate ? data.timestamp.toDate() : data.timestamp) : new Date()
                });
            });
            
            this.tempPrivateMessages.forEach((tempMsg, tempId) => {
                if (!messages.some(m => m.id === tempId)) {
                    messages.push({...tempMsg, chatType: 'private'});
                }
            });
            
            return messages.reverse();
        } catch (error) {
            console.error('Error getting private messages:', error);
            return [];
        }
    }

    listenToPrivateMessages(otherUserId, callback) {
        try {
            // First, unsubscribe from any existing listener
            if (this.unsubscribePrivateMessages) {
                try {
                    this.unsubscribePrivateMessages();
                } catch (err) {
                    console.log('Error unsubscribing from previous private messages:', err);
                }
                this.unsubscribePrivateMessages = null;
            }
            
            const chatId = this.getPrivateChatId(this.firebaseUser.uid, otherUserId);
            const messagesRef = collection(db, 'private_chats', chatId, 'messages');
            const q = query(messagesRef, orderBy('timestamp', 'asc'));
            
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const messages = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    messages.push({ 
                        id: doc.id, 
                        ...data,
                        chatType: 'private',
                        timestamp: data.timestamp ? (data.timestamp.toDate ? data.timestamp.toDate() : data.timestamp) : new Date()
                    });
                });
                
                // Add temp messages
                this.tempPrivateMessages.forEach((tempMsg, tempId) => {
                    if (!messages.some(m => m.id === tempId)) {
                        messages.push({...tempMsg, chatType: 'private'});
                    }
                });
                
                callback(messages);
            }, (error) => {
                console.error('Error in private messages listener:', error);
            });
            
            this.unsubscribePrivateMessages = unsubscribe;
            
            return unsubscribe;
        } catch (error) {
            console.error('Error listening to private messages:', error);
            // Return a dummy unsubscribe function to prevent errors
            return () => {};
        }
    }

    async getPrivateChats() {
        try {
            if (!this.firebaseUser) return [];
            
            const cacheKey = `private_chats_${this.firebaseUser.uid}`;
            const cached = this.getCachedItem(cacheKey, this.cache.privateChats);
            if (cached) return cached;

            const privateChatsRef = collection(db, 'private_chats');
            const q = query(privateChatsRef, where('participants', 'array-contains', this.firebaseUser.uid));
            const querySnapshot = await getDocs(q);
            
            const chats = [];
            
            for (const docSnap of querySnapshot.docs) {
                const data = docSnap.data();
                const otherUserId = data.participants.find(id => id !== this.firebaseUser.uid);
                
                if (otherUserId) {
                    const userProfile = await this.getUserProfile(otherUserId);
                    
                    if (userProfile) {
                        const unreadCount = await this.getUnreadMessageCount(docSnap.id, otherUserId);
                        
                        chats.push({
                            id: docSnap.id,
                            chatId: docSnap.id,
                            userId: otherUserId,
                            userName: userProfile.name,
                            userAvatar: userProfile.avatar,
                            lastMessage: data.lastMessage || null,
                            updatedAt: data.updatedAt ? 
                                (data.updatedAt.toDate ? data.updatedAt.toDate() : data.updatedAt) : 
                                new Date(),
                            unreadCount: unreadCount
                        });
                    }
                }
            }
            
            chats.sort((a, b) => b.updatedAt - a.updatedAt);
            
            this.setCachedItem(cacheKey, chats, this.cache.privateChats, CACHE_DURATION.GROUP_DATA);
            
            return chats;
        } catch (error) {
            console.error('Error getting private chats:', error);
            return [];
        }
    }

    async getUnreadMessageCount(chatId, otherUserId) {
        try {
            const cacheKey = `unread_${chatId}_${otherUserId}`;
            const cached = this.getCachedItem(cacheKey, this.cache.unreadCounts);
            if (cached !== null) return cached;

            const messagesRef = collection(db, 'private_chats', chatId, 'messages');
            const q = query(messagesRef, orderBy('timestamp', 'desc'));
            const querySnapshot = await getDocs(q);
            
            let unreadCount = 0;
            querySnapshot.forEach(doc => {
                const data = doc.data();
                if (data.senderId === otherUserId && data.read === false) {
                    unreadCount++;
                }
            });
            
            this.setCachedItem(cacheKey, unreadCount, this.cache.unreadCounts, CACHE_DURATION.USER_PROFILE);
            
            return unreadCount;
        } catch (error) {
            console.error('Error getting unread count:', error);
            return 0;
        }
    }

    async markMessagesAsRead(chatId, senderId) {
        try {
            const messagesRef = collection(db, 'private_chats', chatId, 'messages');
            const q = query(messagesRef);
            const querySnapshot = await getDocs(q);
            const batch = writeBatch(db);
            let hasUpdates = false;
            
            querySnapshot.forEach(docSnap => {
                const data = docSnap.data();
                if (data.senderId === senderId && data.read === false) {
                    batch.update(docSnap.ref, { read: true });
                    hasUpdates = true;
                }
            });
            
            if (hasUpdates) {
                await batch.commit();
                
                this.cache.unreadCounts.delete(`unread_${chatId}_${senderId}`);
            }
            
            return true;
        } catch (error) {
            console.error('Error marking messages as read:', error);
            return false;
        }
    }

    async getGroupChatsWithUnread() {
        try {
            if (!this.firebaseUser) return [];
            
            const cacheKey = `group_chats_${this.firebaseUser.uid}`;
            const cached = this.getCachedItem(cacheKey, this.cache.groupChats);
            if (cached) return cached;

            const groupsRef = collection(db, 'groups');
            const querySnapshot = await getDocs(groupsRef); // FIXED: Changed from getDocs(q) to getDocs(groupsRef)
            
            const groupChats = [];
            
            for (const docSnap of querySnapshot.docs) {
                const memberRef = doc(db, 'groups', docSnap.id, 'members', this.firebaseUser.uid);
                const memberSnap = await getDoc(memberRef);
                
                if (memberSnap.exists()) {
                    const groupData = docSnap.data();
                    
                    const messagesRef = collection(db, 'groups', docSnap.id, 'messages');
                    const lastMessageQuery = query(messagesRef, orderBy('timestamp', 'desc'), limit(1));
                    const lastMessageSnap = await getDocs(lastMessageQuery);
                    
                    let lastMessage = null;
                    if (!lastMessageSnap.empty) {
                        const msgData = lastMessageSnap.docs[0].data();
                        lastMessage = {
                            text: msgData.text || (msgData.imageUrl ? '📷 Image' : msgData.videoUrl ? '🎬 Video' : ''),
                            senderName: msgData.senderName || 'User',
                            timestamp: msgData.timestamp ? 
                                (msgData.timestamp.toDate ? msgData.timestamp.toDate() : msgData.timestamp) : 
                                new Date()
                        };
                    }
                    
                    groupChats.push({
                        id: docSnap.id,
                        name: groupData.name,
                        avatar: groupData.photoUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(groupData.name)}`,
                        lastMessage: lastMessage,
                        memberCount: groupData.memberCount || 0,
                        unreadCount: 0
                    });
                }
            }
            
            groupChats.sort((a, b) => {
                const timeA = a.lastMessage ? a.lastMessage.timestamp : new Date(0);
                const timeB = b.lastMessage ? b.lastMessage.timestamp : new Date(0);
                return timeB - timeA;
            });
            
            this.setCachedItem(cacheKey, groupChats, this.cache.groupChats, CACHE_DURATION.GROUP_DATA);
            
            return groupChats;
        } catch (error) {
            console.error('Error getting group chats:', error);
            return [];
        }
    }

    generateInviteCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let code = '';
        for (let i = 0; i < 8; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    async getGroupByInviteCode(inviteCode) {
        try {
            const cacheKey = `group_invite_${inviteCode}`;
            const cached = this.getCachedItem(cacheKey, this.cache.groupInvites);
            if (cached) return cached;

            const groupsRef = collection(db, 'groups');
            const q = query(groupsRef, where('inviteCode', '==', inviteCode));
            const querySnapshot = await getDocs(q);
            
            if (!querySnapshot.empty) {
                const doc = querySnapshot.docs[0];
                const data = doc.data();
                const group = { 
                    id: doc.id, 
                    ...data,
                    createdAt: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate() : data.createdAt) : new Date(),
                    updatedAt: data.updatedAt ? (data.updatedAt.toDate ? data.updatedAt.toDate() : data.updatedAt) : new Date()
                };
                
                this.setCachedItem(cacheKey, group, this.cache.groupInvites, CACHE_DURATION.GROUP_DATA);
                
                return group;
            }
            return null;
        } catch (error) {
            console.error('Error getting group by invite code:', error);
            throw error;
        }
    }

    async regenerateInviteCode(groupId) {
        try {
            if (!this.firebaseUser) {
                throw new Error('You must be logged in to regenerate invite code');
            }

            const groupRef = doc(db, 'groups', groupId);
            const groupSnap = await getDoc(groupRef);
            
            if (!groupSnap.exists()) {
                throw new Error('Group not found');
            }

            const groupData = groupSnap.data();
            if (groupData.createdBy !== this.firebaseUser.uid) {
                throw new Error('Only group admin can regenerate invite code');
            }

            const newInviteCode = this.generateInviteCode();
            const newInviteLink = `https://bondlydatingweb.vercel.app/join.html?code=${newInviteCode}`;

            await updateDoc(groupRef, {
                inviteCode: newInviteCode,
                inviteLink: newInviteLink,
                updatedAt: serverTimestamp()
            });

            this.clearGroupCache(groupId);
            
            this.cache.groupInvites.delete(`group_invite_${groupData.inviteCode}`);

            return newInviteLink;
        } catch (error) {
            console.error('Error regenerating invite code:', error);
            throw error;
        }
    }

    async getGroupInviteLink(groupId) {
        try {
            const cachedGroup = this.getCachedItem(groupId, this.cache.groupData);
            if (cachedGroup && cachedGroup.inviteLink) {
                return cachedGroup.inviteLink;
            }

            const groupRef = doc(db, 'groups', groupId);
            const groupSnap = await getDoc(groupRef);
            
            if (!groupSnap.exists()) {
                throw new Error('Group not found');
            }

            const groupData = groupSnap.data();
            
            this.setCachedItem(groupId, groupData, this.cache.groupData, CACHE_DURATION.GROUP_DATA);
            
            if (groupData.inviteCode && groupData.inviteLink) {
                return groupData.inviteLink;
            }
            
            const inviteCode = this.generateInviteCode();
            const inviteLink = `https://bondlydatingweb.vercel.app/join.html?code=${inviteCode}`;
            
            await updateDoc(groupRef, {
                inviteCode: inviteCode,
                inviteLink: inviteLink,
                updatedAt: serverTimestamp()
            });

            groupData.inviteCode = inviteCode;
            groupData.inviteLink = inviteLink;
            this.setCachedItem(groupId, groupData, this.cache.groupData, CACHE_DURATION.GROUP_DATA);

            return inviteLink;
        } catch (error) {
            console.error('Error getting invite link:', error);
            throw error;
        }
    }

    async getAdminGroups() {
        try {
            if (!this.firebaseUser) {
                throw new Error('You must be logged in to view admin groups');
            }

            const cacheKey = `admin_groups_${this.firebaseUser.uid}`;
            const cached = this.getCachedItem(cacheKey, this.cache.adminGroups);
            if (cached) return cached;

            const groupsRef = collection(db, 'groups');
            const q = query(groupsRef, orderBy('createdAt', 'desc'));
            
            const querySnapshot = await getDocs(q);
            
            const groups = [];
            querySnapshot.forEach(doc => {
                const data = doc.data();
                if (data.createdBy === this.firebaseUser.uid) {
                    groups.push({ 
                        id: doc.id, 
                        ...data,
                        createdAt: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate() : data.createdAt) : new Date(),
                        updatedAt: data.updatedAt ? (data.updatedAt.toDate ? data.updatedAt.toDate() : data.updatedAt) : new Date()
                    });
                }
            });
            
            this.setCachedItem(cacheKey, groups, this.cache.adminGroups, CACHE_DURATION.GROUP_DATA);
            
            return groups;
        } catch (error) {
            console.error('Error getting admin groups:', error);
            throw error;
        }
    }

    async getGroupMembersWithDetails(groupId) {
        try {
            const cachedMembers = this.getCachedItem(groupId, this.cache.groupMembers);
            if (cachedMembers) {
                return cachedMembers;
            }

            const membersRef = collection(db, 'groups', groupId, 'members');
            const q = query(membersRef, orderBy('joinedAt', 'asc'));
            const querySnapshot = await getDocs(q);
            
            const members = [];
            
            const groupRef = doc(db, 'groups', groupId);
            const groupSnap = await getDoc(groupRef);
            const groupData = groupSnap.exists() ? groupSnap.data() : null;
            const adminId = groupData?.createdBy;
            
            for (const docSnap of querySnapshot.docs) {
                const data = docSnap.data();
                
                const userRef = doc(db, 'group_users', docSnap.id);
                const userSnap = await getDoc(userRef);
                const userData = userSnap.exists() ? userSnap.data() : {};
                
                members.push({
                    id: docSnap.id,
                    name: data.name || userData.displayName || 'Unknown',
                    avatar: data.avatar || userData.avatar || AVATAR_OPTIONS[0],
                    email: userData.email || '',
                    role: data.role || (docSnap.id === adminId ? 'creator' : 'member'),
                    joinedAt: data.joinedAt ? (data.joinedAt.toDate ? data.joinedAt.toDate() : data.joinedAt) : new Date(),
                    lastActive: data.lastActive ? (data.lastActive.toDate ? data.lastActive.toDate() : data.lastActive) : new Date(),
                    isAdmin: docSnap.id === adminId
                });
            }
            
            this.setCachedItem(groupId, members, this.cache.groupMembers, CACHE_DURATION.MEMBERS_LIST);
            
            return members;
        } catch (error) {
            console.error('Error getting group members:', error);
            return [];
        }
    }

    async removeMemberFromGroup(groupId, memberId, memberName = 'Member') {
        try {
            if (!this.firebaseUser) {
                throw new Error('You must be logged in to remove members');
            }

            const groupRef = doc(db, 'groups', groupId);
            const groupSnap = await getDoc(groupRef);
            
            if (!groupSnap.exists()) {
                throw new Error('Group not found');
            }

            const groupData = groupSnap.data();
            if (groupData.createdBy !== this.firebaseUser.uid) {
                throw new Error('Only group admin can remove members');
            }

            if (memberId === this.firebaseUser.uid) {
                throw new Error('You cannot remove yourself as admin');
            }

            const memberRef = doc(db, 'groups', groupId, 'members', memberId);
            await deleteDoc(memberRef);

            await updateDoc(groupRef, {
                memberCount: increment(-1),
                updatedAt: serverTimestamp()
            });

            this.clearGroupCache(groupId);

            await this.sendMemberRemovedNotification(memberId, groupId, groupData.name);

            await this.sendSystemMessage(
                groupId, 
                `${memberName} has been removed from the group by admin.`
            );

            await this.blockUser(memberId);

            return true;
        } catch (error) {
            console.error('Error removing member:', error);
            throw error;
        }
    }

    async deleteGroup(groupId) {
        try {
            if (!this.firebaseUser) {
                throw new Error('You must be logged in to delete groups');
            }

            const groupRef = doc(db, 'groups', groupId);
            const groupSnap = await getDoc(groupRef);
            
            if (!groupSnap.exists()) {
                throw new Error('Group not found');
            }

            const groupData = groupSnap.data();
            if (groupData.createdBy !== this.firebaseUser.uid) {
                throw new Error('Only group admin can delete the group');
            }

            const members = await this.getGroupMembersWithDetails(groupId);

            const batch = writeBatch(db);

            const messagesRef = collection(db, 'groups', groupId, 'messages');
            const messagesSnap = await getDocs(messagesRef);
            messagesSnap.forEach((docSnap) => {
                batch.delete(docSnap.ref);
            });

            const membersRef = collection(db, 'groups', groupId, 'members');
            const membersSnap = await getDocs(membersRef);
            membersSnap.forEach((docSnap) => {
                batch.delete(docSnap.ref);
            });

            batch.delete(groupRef);

            await batch.commit();

            this.clearGroupCache(groupId);

            await Promise.all(members.map(member => 
                this.sendGroupDeletedNotification(member.id, groupData.name)
            ));

            return true;
        } catch (error) {
            console.error('Error deleting group:', error);
            throw error;
        }
    }

    async sendMemberRemovedNotification(userId, groupId, groupName) {
        try {
            const notificationRef = doc(collection(db, 'notifications'));
            
            await setDoc(notificationRef, {
                userId: userId,
                type: 'group_member_removed',
                title: 'Removed from Group',
                message: `You have been removed from the group "${groupName}"`,
                groupId: groupId,
                groupName: groupName,
                timestamp: serverTimestamp(),
                read: false
            });
            
            return true;
        } catch (error) {
            console.error('Error sending removal notification:', error);
            return false;
        }
    }

    async sendGroupDeletedNotification(userId, groupName) {
        try {
            const notificationRef = doc(collection(db, 'notifications'));
            
            await setDoc(notificationRef, {
                userId: userId,
                type: 'group_deleted',
                title: 'Group Deleted',
                message: `The group "${groupName}" has been deleted by the admin`,
                timestamp: serverTimestamp(),
                read: false
            });
            
            return true;
        } catch (error) {
            console.error('Error sending group deleted notification:', error);
            return false;
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
                senderName: 'System',
                senderAvatar: ''
            });
            
            return true;
        } catch (error) {
            console.error('Error sending system message:', error);
            throw error;
        }
    }

    setupAuthListener() {
        this.unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
            if (user) {
                this.firebaseUser = user;
                console.log('User authenticated:', user.uid);
                
                await this.loadUserProfile(user.uid);
                
                document.dispatchEvent(new CustomEvent('groupAuthReady'));
            } else {
                this.firebaseUser = null;
                this.currentUser = null;
                this.clearAllCache();
                console.log('User logged out');
                
                const protectedPages = ['create-group', 'group', 'admin-groups', 'user', 'chat', 'messages', 'chats'];
                const currentPage = window.location.pathname.split('/').pop().split('.')[0];
                
                if (protectedPages.includes(currentPage)) {
                    window.location.href = 'login.html';
                }
            }
        });
    }

    async loadUserProfile(userId) {
        try {
            const userProfile = await this.getUserProfile(userId, true);
            
            if (userProfile) {
                this.currentUser = userProfile;
                console.log('User profile loaded:', this.currentUser);
            } else {
                this.currentUser = {
                    id: userId,
                    name: this.firebaseUser.email.split('@')[0] || 'User',
                    avatar: AVATAR_OPTIONS[0],
                    bio: '',
                    email: this.firebaseUser.email,
                    profileComplete: false
                };
                
                console.log('New user profile created:', this.currentUser);
            }
            
        } catch (error) {
            console.error('Error loading user profile:', error);
        }
    }

    async updateUserProfile(userData) {
        try {
            if (!this.firebaseUser) return;
            
            const userRef = doc(db, 'group_users', this.firebaseUser.uid);
            
            await setDoc(userRef, {
                displayName: userData.name,
                avatar: userData.avatar,
                bio: userData.bio,
                email: this.firebaseUser.email,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                lastSeen: serverTimestamp()
            }, { merge: true });
            
            this.currentUser = {
                ...this.currentUser,
                name: userData.name,
                avatar: userData.avatar,
                bio: userData.bio,
                profileComplete: true
            };
            
            this.cache.userProfile = this.currentUser;
            this.cache.userProfileExpiry = Date.now() + CACHE_DURATION.USER_PROFILE;
            this.cache.profileSetupChecked = true;
            
            this.cache.userProfiles.delete(`user_${this.firebaseUser.uid}`);
            
            return true;
        } catch (error) {
            console.error('Error updating user profile:', error);
            throw error;
        }
    }

    async needsProfileSetup() {
        if (this.cache.profileSetupChecked && this.currentUser?.profileComplete) {
            return false;
        }
        
        if (this.firebaseUser) {
            const userProfile = await this.getUserProfile(this.firebaseUser.uid, true);
            if (userProfile) {
                this.cache.profileSetupChecked = true;
                return !userProfile.profileComplete;
            }
        }
        
        return true;
    }

    getCurrentUser() {
        return this.currentUser;
    }

    async hasJoinedGroup(groupId) {
        try {
            if (!this.firebaseUser) return false;
            
            const cachedJoined = this.cache.joinedGroups.get(groupId);
            if (cachedJoined && Date.now() < cachedJoined.expiry) {
                return cachedJoined.data;
            }
            
            const memberRef = doc(db, 'groups', groupId, 'members', this.firebaseUser.uid);
            const memberSnap = await getDoc(memberRef);
            const isMember = memberSnap.exists();
            
            this.cache.joinedGroups.set(groupId, {
                data: isMember,
                expiry: Date.now() + CACHE_DURATION.GROUP_DATA
            });
            
            return isMember;
        } catch (error) {
            console.error('Error checking membership:', error);
            return false;
        }
    }

    async createGroup(groupData, photoFile = null) {
        try {
            if (!this.firebaseUser || !this.currentUser) {
                throw new Error('You must be logged in to create a group');
            }
            
            const groupRef = doc(collection(db, 'groups'));
            
            const inviteCode = this.generateInviteCode();
            const inviteLink = `https://bondlydatingweb.vercel.app/join.html?code=${inviteCode}`;
            
            let photoUrl = null;
            if (photoFile) {
                photoUrl = await this.uploadMediaToCloudinary(photoFile);
            }
            
            const group = {
                id: groupRef.id,
                name: groupData.name,
                description: groupData.description,
                category: groupData.category || 'social',
                topics: groupData.topics || [],
                rules: groupData.rules || [],
                restrictedWords: groupData.restrictedWords || [],
                maxMembers: groupData.maxMembers || 1000,
                privacy: groupData.privacy || 'public',
                createdBy: this.firebaseUser.uid,
                creatorName: this.currentUser.name,
                creatorAvatar: this.currentUser.avatar,
                photoUrl: photoUrl,
                memberCount: 1,
                inviteCode: inviteCode,
                inviteLink: inviteLink,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                lastActivity: serverTimestamp()
            };

            await setDoc(groupRef, group);
            
            await this.addMember(groupRef.id, 'creator');
            
            this.setCachedItem(groupRef.id, group, this.cache.groupData, CACHE_DURATION.GROUP_DATA);
            
            return { groupId: groupRef.id, inviteLink: inviteLink };
        } catch (error) {
            console.error('Error creating group:', error);
            throw error;
        }
    }

    async addMember(groupId, role = 'member') {
        try {
            if (!this.firebaseUser || !this.currentUser) {
                throw new Error('You must be logged in to join a group');
            }
            
            const isBlocked = await this.isUserBlocked(this.firebaseUser.uid);
            if (isBlocked) {
                throw new Error('You have been blocked from joining this group');
            }
            
            const memberRef = doc(collection(db, 'groups', groupId, 'members'), this.firebaseUser.uid);
            
            const memberData = {
                id: this.firebaseUser.uid,
                name: this.currentUser.name,
                avatar: this.currentUser.avatar,
                bio: this.currentUser.bio || '',
                role: role,
                joinedAt: serverTimestamp(),
                lastActive: serverTimestamp()
            };
            
            await setDoc(memberRef, memberData);
            
            const groupRef = doc(db, 'groups', groupId);
            await updateDoc(groupRef, {
                memberCount: increment(1),
                updatedAt: serverTimestamp(),
                lastActivity: serverTimestamp()
            });
            
            this.clearGroupCache(groupId);
            
            this.cache.joinedGroups.set(groupId, {
                data: true,
                expiry: Date.now() + CACHE_DURATION.GROUP_DATA
            });
            
            return true;
        } catch (error) {
            console.error('Error adding member:', error);
            throw error;
        }
    }

    async getAllGroups() {
        try {
            const cacheKey = 'all_groups';
            const cached = this.getCachedItem(cacheKey, this.cache.allGroups);
            if (cached) return cached;

            const groupsRef = collection(db, 'groups');
            const q = query(groupsRef, orderBy('lastActivity', 'desc'));
            const querySnapshot = await getDocs(q);
            
            const groups = [];
            querySnapshot.forEach(doc => {
                const data = doc.data();
                const group = { 
                    id: doc.id, 
                    ...data,
                    createdAt: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate() : data.createdAt) : new Date(),
                    updatedAt: data.updatedAt ? (data.updatedAt.toDate ? data.updatedAt.toDate() : data.updatedAt) : new Date()
                };
                
                groups.push(group);
                
                this.setCachedItem(doc.id, group, this.cache.groupData, CACHE_DURATION.GROUP_DATA);
            });
            
            this.setCachedItem(cacheKey, groups, this.cache.allGroups, CACHE_DURATION.GROUP_DATA);
            
            return groups;
        } catch (error) {
            console.error('Error getting groups:', error);
            throw error;
        }
    }

    async getGroup(groupId, forceRefresh = false) {
        try {
            if (!forceRefresh) {
                const cachedGroup = this.getCachedItem(groupId, this.cache.groupData);
                if (cachedGroup) {
                    return cachedGroup;
                }
            }
            
            const groupRef = doc(db, 'groups', groupId);
            const groupSnap = await getDoc(groupRef);
            
            if (groupSnap.exists()) {
                const data = groupSnap.data();
                const group = { 
                    id: groupSnap.id, 
                    ...data,
                    createdAt: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate() : data.createdAt) : new Date(),
                    updatedAt: data.updatedAt ? (data.updatedAt.toDate ? data.updatedAt.toDate() : data.updatedAt) : new Date()
                };
                
                this.setCachedItem(groupId, group, this.cache.groupData, CACHE_DURATION.GROUP_DATA);
                
                return group;
            }
            return null;
        } catch (error) {
            console.error('Error getting group:', error);
            throw error;
        }
    }

    async getGroupMembers(groupId, forceRefresh = false) {
        try {
            if (!forceRefresh) {
                const cachedMembers = this.getCachedItem(groupId, this.cache.groupMembers);
                if (cachedMembers) {
                    return cachedMembers;
                }
            }
            
            const membersRef = collection(db, 'groups', groupId, 'members');
            const q = query(membersRef, orderBy('joinedAt', 'asc'));
            const querySnapshot = await getDocs(q);
            
            const members = [];
            querySnapshot.forEach(doc => {
                const data = doc.data();
                members.push({
                    id: doc.id,
                    ...data,
                    joinedAt: data.joinedAt ? (data.joinedAt.toDate ? data.joinedAt.toDate() : data.joinedAt) : new Date(),
                    lastActive: data.lastActive ? (data.lastActive.toDate ? data.lastActive.toDate() : data.lastActive) : new Date()
                });
            });
            
            this.setCachedItem(groupId, members, this.cache.groupMembers, CACHE_DURATION.MEMBERS_LIST);
            
            return members;
        } catch (error) {
            console.error('Error getting group members:', error);
            return [];
        }
    }

    async isMember(groupId) {
        return await this.hasJoinedGroup(groupId);
    }

    async joinGroupByInviteCode(inviteCode) {
        try {
            if (!this.firebaseUser || !this.currentUser) {
                throw new Error('You must be logged in to join a group');
            }
            
            const group = await this.getGroupByInviteCode(inviteCode);
            
            if (!group) {
                throw new Error('Invalid or expired invite link');
            }
            
            return await this.joinGroup(group.id);
        } catch (error) {
            console.error('Error joining group by invite code:', error);
            throw error;
        }
    }

    async joinGroup(groupId) {
        try {
            if (!this.firebaseUser || !this.currentUser) {
                throw new Error('You must be logged in to join a group');
            }
            
            const groupRef = doc(db, 'groups', groupId);
            const groupSnap = await getDoc(groupRef);
            
            if (!groupSnap.exists()) {
                throw new Error('Group not found');
            }
            
            const group = groupSnap.data();
            
            const isMember = await this.isMember(groupId);
            if (isMember) {
                await this.updateLastActive(groupId);
                return true;
            }
            
            if (group.memberCount >= group.maxMembers) {
                throw new Error('Group is full');
            }
            
            const role = group.createdBy === this.firebaseUser.uid ? 'creator' : 'member';
            
            await this.addMember(groupId, role);
            
            return true;
        } catch (error) {
            console.error('Error joining group:', error);
            throw error;
        }
    }

    async leaveGroup(groupId) {
        try {
            if (!this.firebaseUser) {
                throw new Error('No user found');
            }
            
            await this.removeMember(groupId);
            
            return true;
        } catch (error) {
            console.error('Error leaving group:', error);
            throw error;
        }
    }

    async removeMember(groupId) {
        try {
            if (!this.firebaseUser) return;
            
            const memberRef = doc(db, 'groups', groupId, 'members', this.firebaseUser.uid);
            await deleteDoc(memberRef);
            
            const groupRef = doc(db, 'groups', groupId);
            await updateDoc(groupRef, {
                memberCount: increment(-1),
                updatedAt: serverTimestamp()
            });
            
            this.clearGroupCache(groupId);
            
            this.cache.joinedGroups.set(groupId, {
                data: false,
                expiry: Date.now() + CACHE_DURATION.GROUP_DATA
            });
            
            return true;
        } catch (error) {
            console.error('Error removing member:', error);
            throw error;
        }
    }

    // NEW: Start typing indicator
    async startTyping(groupId) {
        try {
            if (!this.firebaseUser || !this.currentUser || !groupId) return;
            
            const typingRef = doc(db, 'groups', groupId, 'typing', this.firebaseUser.uid);
            
            await setDoc(typingRef, {
                userId: this.firebaseUser.uid,
                userName: this.currentUser.name,
                timestamp: serverTimestamp(),
                isTyping: true
            }, { merge: true });
            
            // Set timeout to automatically stop typing after 5 seconds
            if (this.typingUsers.has(groupId)) {
                const userTyping = this.typingUsers.get(groupId);
                if (userTyping.has(this.firebaseUser.uid)) {
                    clearTimeout(userTyping.get(this.firebaseUser.uid));
                }
            } else {
                this.typingUsers.set(groupId, new Map());
            }
            
            const typingTimeout = setTimeout(() => {
                this.stopTyping(groupId);
            }, TYPING_TIMEOUT);
            
            this.typingUsers.get(groupId).set(this.firebaseUser.uid, typingTimeout);
            
        } catch (error) {
            console.error('Error starting typing indicator:', error);
        }
    }

    // NEW: Stop typing indicator
    async stopTyping(groupId) {
        try {
            if (!this.firebaseUser || !groupId) return;
            
            const typingRef = doc(db, 'groups', groupId, 'typing', this.firebaseUser.uid);
            
            await setDoc(typingRef, {
                userId: this.firebaseUser.uid,
                userName: this.currentUser.name,
                timestamp: serverTimestamp(),
                isTyping: false
            }, { merge: true });
            
            // Clear timeout
            if (this.typingUsers.has(groupId)) {
                const userTyping = this.typingUsers.get(groupId);
                if (userTyping.has(this.firebaseUser.uid)) {
                    clearTimeout(userTyping.get(this.firebaseUser.uid));
                    userTyping.delete(this.firebaseUser.uid);
                }
            }
            
        } catch (error) {
            console.error('Error stopping typing indicator:', error);
        }
    }

    // NEW: Listen to typing indicators
    listenToTyping(groupId, callback) {
        try {
            const typingRef = collection(db, 'groups', groupId, 'typing');
            
            return onSnapshot(typingRef, (snapshot) => {
                const typingUsers = [];
                const now = Date.now();
                
                snapshot.forEach(doc => {
                    const data = doc.data();
                    if (data.isTyping && data.userId !== this.firebaseUser?.uid) {
                        const timestamp = data.timestamp ? 
                            (data.timestamp.toDate ? data.timestamp.toDate().getTime() : new Date(data.timestamp).getTime()) : 
                            0;
                        
                        // Only show users who typed in the last 5 seconds
                        if (now - timestamp < TYPING_TIMEOUT) {
                            typingUsers.push({
                                userId: data.userId,
                                userName: data.userName,
                                timestamp: timestamp
                            });
                        }
                    }
                });
                
                callback(typingUsers);
            });
        } catch (error) {
            console.error('Error listening to typing indicators:', error);
            return () => {};
        }
    }

    async sendMessage(groupId, text = null, imageUrl = null, videoUrl = null, replyTo = null) {
        try {
            if (!this.firebaseUser || !this.currentUser) {
                throw new Error('You must be logged in to send messages');
            }
            
            const isRestricted = await this.isUserRestricted(groupId, this.firebaseUser.uid);
            if (isRestricted) {
                throw new Error('You are restricted from sending messages in this group for 2 hours due to using restricted words.');
            }
            
            if (!text && !imageUrl && !videoUrl) {
                throw new Error('Message cannot be empty');
            }
            
            if (text) {
                const restrictedWord = await this.checkMessageForRestrictedWords(groupId, text);
                if (restrictedWord) {
                    await this.restrictUser(groupId, this.firebaseUser.uid, 2);
                    throw new Error(`Your message contains a restricted word (${restrictedWord}). You have been restricted from chatting for 2 hours.`);
                }
            }
            
            // NEW: Update message streak
            const streak = this.updateMessageStreak(this.firebaseUser.uid);
            const shouldGlow = this.shouldGlowMessage(this.firebaseUser.uid);
            const shouldHaveFireRing = this.shouldHaveFireRing(this.firebaseUser.uid);
            
            const messageId = `${groupId}_${this.firebaseUser.uid}_${Date.now()}`;
            
            if (this.sentMessageIds.has(messageId) || this.pendingMessages.has(messageId)) {
                console.log('Duplicate message prevented:', messageId);
                return true;
            }
            
            this.sentMessageIds.add(messageId);
            this.pendingMessages.add(messageId);
            
            const messagesRef = collection(db, 'groups', groupId, 'messages');
            const messageData = {
                senderId: this.firebaseUser.uid,
                senderName: this.currentUser.name,
                senderAvatar: this.currentUser.avatar,
                timestamp: serverTimestamp()
            };
            
            // NEW: Add glow effect and fire ring data
            if (shouldGlow) {
                messageData.glowEffect = true;
            }
            
            if (shouldHaveFireRing) {
                messageData.fireRing = true;
            }
            
            if (replyTo) {
                messageData.replyTo = replyTo;
            }
            
            if (text) {
                messageData.text = text.trim();
            }
            
            if (imageUrl) {
                messageData.imageUrl = imageUrl;
                messageData.type = 'image';
            }
            
            if (videoUrl) {
                messageData.videoUrl = videoUrl;
                messageData.type = 'video';
            }
            
            await addDoc(messagesRef, messageData);
            
            const groupRef = doc(db, 'groups', groupId);
            await updateDoc(groupRef, {
                updatedAt: serverTimestamp(),
                lastActivity: serverTimestamp(),
                lastMessage: {
                    text: text ? text.trim() : (imageUrl ? '📷 Image' : videoUrl ? '🎬 Video' : ''),
                    sender: this.currentUser.name,
                    timestamp: serverTimestamp()
                }
            });
            
            // NEW: Check and award user for activity
            await this.checkAndAwardUser(groupId, this.firebaseUser.uid, this.currentUser.name);
            
            // NEW: Stop typing indicator
            await this.stopTyping(groupId);
            
            await this.updateLastActive(groupId);
            
            this.clearReply();
            
            this.pendingMessages.delete(messageId);
            
            return true;
        } catch (error) {
            console.error('Error sending message:', error);
            this.sentMessageIds.delete(messageId);
            this.pendingMessages.delete(messageId);
            throw error;
        }
    }

    async sendMediaMessage(groupId, file, replyTo = null) {
        try {
            const isVideo = file.type.startsWith('video/');
            
            if (isVideo) {
                this.validateVideoFile(file);
            } else {
                this.validateImageFile(file);
            }
            
            const tempMessageId = 'temp_media_' + Date.now();
            this.showTempMediaMessage(groupId, file, tempMessageId, isVideo);
            
            const mediaUrl = await this.uploadMediaToCloudinary(file);
            
            if (isVideo) {
                await this.sendMessage(groupId, null, null, mediaUrl, replyTo);
            } else {
                await this.sendMessage(groupId, null, mediaUrl, null, replyTo);
            }
            
            this.removeTempMessage(tempMessageId);
            
            return true;
        } catch (error) {
            console.error('Error sending media message:', error);
            throw error;
        }
    }

    showTempMediaMessage(groupId, file, tempId, isVideo = false) {
        if (window.currentGroupId === groupId) {
            const tempMediaUrl = URL.createObjectURL(file);
            const tempMessage = {
                id: tempId,
                senderId: this.firebaseUser.uid,
                senderName: this.currentUser.name,
                senderAvatar: this.currentUser.avatar,
                [isVideo ? 'videoUrl' : 'imageUrl']: tempMediaUrl,
                timestamp: new Date().toISOString(),
                type: isVideo ? 'video' : 'image',
                status: 'uploading'
            };
            
            // NEW: Add glow effect for temp messages if user has streak
            if (this.shouldGlowMessage(this.firebaseUser.uid)) {
                tempMessage.glowEffect = true;
            }
            
            const event = new CustomEvent('tempMediaMessage', { detail: tempMessage });
            document.dispatchEvent(event);
        }
    }

    removeTempMessage(tempId) {
        const event = new CustomEvent('removeTempMessage', { detail: { tempId } });
        document.dispatchEvent(event);
    }

    async getMessages(groupId, limitCount = 50) {
        try {
            const cacheKey = `messages_${groupId}_${limitCount}`;
            const cached = this.getCachedItem(cacheKey, this.cache.messages);
            if (cached) return cached;

            const messagesRef = collection(db, 'groups', groupId, 'messages');
            const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(limitCount));
            const querySnapshot = await getDocs(q);
            
            const messages = [];
            querySnapshot.forEach(doc => {
                const data = doc.data();
                messages.push({ 
                    id: doc.id, 
                    ...data,
                    timestamp: data.timestamp ? (data.timestamp.toDate ? data.timestamp.toDate() : data.timestamp) : new Date()
                });
            });
            
            const result = messages.reverse();
            
            this.setCachedItem(cacheKey, result, this.cache.messages, 30000);
            
            return result;
        } catch (error) {
            console.error('Error getting messages:', error);
            throw error;
        }
    }

    listenToMessages(groupId, callback) {
        try {
            // First, unsubscribe from any existing listener
            if (this.unsubscribeMessages) {
                try {
                    this.unsubscribeMessages();
                } catch (err) {
                    console.log('Error unsubscribing from previous messages:', err);
                }
                this.unsubscribeMessages = null;
            }
            
            const messagesRef = collection(db, 'groups', groupId, 'messages');
            const q = query(messagesRef, orderBy('timestamp', 'asc'));
            
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const messages = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    messages.push({ 
                        id: doc.id, 
                        ...data,
                        timestamp: data.timestamp ? (data.timestamp.toDate ? data.timestamp.toDate() : data.timestamp) : new Date()
                    });
                });
                
                const cacheKey = `messages_${groupId}_${messages.length}`;
                this.setCachedItem(cacheKey, messages, this.cache.messages, 30000);
                
                callback(messages);
            }, (error) => {
                console.error('Error in messages listener:', error);
            });
            
            this.unsubscribeMessages = unsubscribe;
            
            return unsubscribe;
        } catch (error) {
            console.error('Error listening to messages:', error);
            // Return a dummy unsubscribe function to prevent errors
            return () => {};
        }
    }

    listenToMembers(groupId, callback) {
        try {
            // First, unsubscribe from any existing listener
            if (this.unsubscribeMembers) {
                try {
                    this.unsubscribeMembers();
                } catch (err) {
                    console.log('Error unsubscribing from previous members:', err);
                }
                this.unsubscribeMembers = null;
            }
            
            const membersRef = collection(db, 'groups', groupId, 'members');
            const q = query(membersRef, orderBy('joinedAt', 'asc'));
            
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const members = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    members.push({
                        id: doc.id,
                        ...data,
                        joinedAt: data.joinedAt ? (data.joinedAt.toDate ? data.joinedAt.toDate() : data.joinedAt) : new Date(),
                        lastActive: data.lastActive ? (data.lastActive.toDate ? data.lastActive.toDate() : data.lastActive) : new Date()
                    });
                });
                callback(members);
                
                this.setCachedItem(groupId, members, this.cache.groupMembers, CACHE_DURATION.MEMBERS_LIST);
            }, (error) => {
                console.error('Error in members listener:', error);
            });
            
            this.unsubscribeMembers = unsubscribe;
            
            return unsubscribe;
        } catch (error) {
            console.error('Error listening to members:', error);
            // Return a dummy unsubscribe function to prevent errors
            return () => {};
        }
    }

    async updateLastActive(groupId) {
        try {
            if (!this.firebaseUser) return;
            
            const memberRef = doc(db, 'groups', groupId, 'members', this.firebaseUser.uid);
            const memberSnap = await getDoc(memberRef);
            
            if (memberSnap.exists()) {
                await updateDoc(memberRef, {
                    lastActive: serverTimestamp()
                });
            }
            
            const userRef = doc(db, 'group_users', this.firebaseUser.uid);
            await updateDoc(userRef, {
                lastSeen: serverTimestamp()
            });
            
            if (this.cache.userProfile) {
                this.cache.userProfile.lastSeen = new Date();
            }
        } catch (error) {
            console.error('Error updating last active:', error);
        }
    }

    createReactionModal() {
        const existingModal = document.getElementById('reactionModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        this.reactionModal = document.createElement('div');
        this.reactionModal.id = 'reactionModal';
        this.reactionModal.className = 'reaction-modal';
        
        let emojiGrid = '';
        const emojisPerRow = 10;
        const totalRows = Math.ceil(REACTION_EMOJIS.length / emojisPerRow);
        
        for (let row = 0; row < totalRows; row++) {
            emojiGrid += '<div class="emoji-row">';
            for (let col = 0; col < emojisPerRow; col++) {
                const index = row * emojisPerRow + col;
                if (index < REACTION_EMOJIS.length) {
                    emojiGrid += `<span class="emoji-item" data-emoji="${REACTION_EMOJIS[index]}">${REACTION_EMOJIS[index]}</span>`;
                }
            }
            emojiGrid += '</div>';
        }
        
        this.reactionModal.innerHTML = `
            <div class="reaction-modal-content">
                <div class="reaction-header">
                    <h3>Add Reaction</h3>
                    <button class="close-reaction-modal">&times;</button>
                </div>
                <div class="emoji-grid">
                    ${emojiGrid}
                </div>
            </div>
        `;
        
        document.body.appendChild(this.reactionModal);
        
        const reactionModalStyles = document.createElement('style');
        reactionModalStyles.id = 'reaction-modal-styles';
        reactionModalStyles.textContent = `
            .reaction-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                display: none;
                justify-content: center;
                align-items: center;
                z-index: 9999;
            }
            
            .reaction-modal.active {
                display: flex;
            }
            
            .reaction-modal-content {
                background: white;
                border-radius: 12px;
                width: 90%;
                max-width: 500px;
                max-height: 80vh;
                overflow: hidden;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
            }
            
            .reaction-header {
                padding: 15px 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .reaction-header h3 {
                margin: 0;
                font-size: 18px;
            }
            
            .close-reaction-modal {
                background: none;
                border: none;
                color: white;
                font-size: 28px;
                cursor: pointer;
                line-height: 1;
                padding: 0;
                width: 30px;
                height: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                transition: background 0.2s;
            }
            
            .close-reaction-modal:hover {
                background: rgba(255, 255, 255, 0.2);
            }
            
            .emoji-grid {
                padding: 20px;
                max-height: 60vh;
                overflow-y: auto;
            }
            
            .emoji-row {
                display: flex;
                justify-content: space-between;
                margin-bottom: 10px;
            }
            
            .emoji-item {
                font-size: 24px;
                cursor: pointer;
                padding: 8px;
                border-radius: 8px;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                justify-content: center;
                min-width: 40px;
                min-height: 40px;
            }
            
            .emoji-item:hover {
                background: #f0f0f0;
                transform: scale(1.2);
            }
            
            .message-reactions {
                display: flex;
                flex-wrap: wrap;
                gap: 4px;
                margin-top: 6px;
            }
            
            .reaction-bubble {
                background: rgba(0, 0, 0, 0.05);
                border-radius: 12px;
                padding: 2px 8px;
                font-size: 12px;
                display: flex;
                align-items: center;
                gap: 4px;
                cursor: pointer;
                transition: background 0.2s;
                border: 1px solid rgba(0, 0, 0, 0.1);
            }
            
            .reaction-bubble:hover {
                background: rgba(0, 0, 0, 0.1);
            }
            
            .reaction-bubble.user-reacted {
                background: rgba(29, 155, 240, 0.1);
                border-color: rgba(29, 155, 240, 0.3);
            }
            
            .reaction-emoji {
                font-size: 14px;
            }
            
            .reaction-count {
                font-weight: 500;
                color: #666;
            }
            
            .reaction-bubble.user-reacted .reaction-count {
                color: #1d9bf0;
            }
            
            .swipe-reply-indicator {
                position: fixed;
                bottom: 80px;
                left: 50%;
                transform: translateX(-50%);
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 12px 20px;
                border-radius: 25px;
                display: flex;
                align-items: center;
                gap: 10px;
                font-size: 14px;
                font-weight: 500;
                box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
                z-index: 1000;
                opacity: 0;
                transition: opacity 0.3s;
            }
            
            .swipe-reply-indicator.show {
                opacity: 1;
            }
            
            .replying-to {
                background: rgba(102, 126, 234, 0.1);
                border-left: 3px solid #667eea;
                padding: 6px 10px;
                margin-bottom: 8px;
                border-radius: 4px;
                font-size: 12px;
                display: flex;
                align-items: center;
                flex-wrap: wrap;
                gap: 4px;
            }
            
            .reply-label {
                color: #667eea;
                font-weight: 500;
            }
            
            .reply-sender {
                font-weight: 600;
                color: #764ba2;
            }
            
            .reply-separator {
                color: #999;
            }
            
            .reply-message {
                color: #666;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                flex: 1;
                min-width: 0;
            }
            
            /* UPDATED: Typing indicator styles - Moved to top */
            .typing-indicator {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                background: linear-gradient(135deg, rgba(102, 126, 234, 0.95) 0%, rgba(118, 75, 162, 0.95) 100%);
                color: white;
                padding: 8px 15px;
                font-size: 13px;
                text-align: center;
                z-index: 1000;
                backdrop-filter: blur(10px);
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                transition: transform 0.3s ease;
                transform: translateY(-100%);
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            }
            
            .typing-indicator.show {
                transform: translateY(0);
            }
            
            .typing-dots {
                display: inline-block;
                margin-left: 5px;
            }
            
            .typing-dots span {
                display: inline-block;
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background-color: white;
                margin: 0 2px;
                opacity: 0.6;
                animation: typing-dots 1.5s infinite ease-in-out;
            }
            
            .typing-dots span:nth-child(1) { animation-delay: 0s; }
            .typing-dots span:nth-child(2) { animation-delay: 0.2s; }
            .typing-dots span:nth-child(3) { animation-delay: 0.4s; }
            
            @keyframes typing-dots {
                0%, 100% { opacity: 0.6; transform: scale(1); }
                50% { opacity: 1; transform: scale(1.2); }
            }
            
            /* UPDATED: Soft glass glowing message styles */
            .glowing-message {
                animation: soft-glow 3s ease-in-out infinite alternate;
                position: relative;
                backdrop-filter: blur(5px);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 8px;
                padding: 8px 12px;
                margin: 2px 0;
            }
            
            @keyframes soft-glow {
                0% {
                    box-shadow: 0 0 5px rgba(255, 255, 255, 0.3),
                                0 0 10px rgba(77, 171, 247, 0.2),
                                0 0 15px rgba(77, 171, 247, 0.1);
                    background: rgba(255, 255, 255, 0.05);
                }
                100% {
                    box-shadow: 0 0 10px rgba(255, 255, 255, 0.4),
                                0 0 20px rgba(77, 171, 247, 0.3),
                                0 0 30px rgba(77, 171, 247, 0.2);
                    background: rgba(255, 255, 255, 0.08);
                }
            }
            
            /* Fire ring avatar styles */
            .avatar-with-fire-ring {
                position: relative;
            }
            
            .fire-ring {
                position: absolute;
                top: -5px;
                left: -5px;
                right: -5px;
                bottom: -5px;
                border-radius: 50%;
                background: linear-gradient(45deg, #ff6b00, #ff9500, #ffcc00);
                animation: fire-ring 1.5s ease-in-out infinite alternate;
                z-index: -1;
            }
            
            @keyframes fire-ring {
                from {
                    box-shadow: 0 0 10px #ff6b00, 0 0 20px #ff9500, 0 0 30px #ffcc00;
                    transform: scale(1);
                }
                to {
                    box-shadow: 0 0 15px #ff6b00, 0 0 25px #ff9500, 0 0 35px #ffcc00;
                    transform: scale(1.05);
                }
            }
            
            /* Reward tag styles */
            .reward-tag {
                display: inline-block;
                background: linear-gradient(45deg, #ffd700, #ff9500);
                color: white;
                padding: 2px 8px;
                border-radius: 12px;
                font-size: 10px;
                font-weight: bold;
                margin-left: 6px;
                animation: reward-tag-pulse 2s infinite;
                text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.3);
            }
            
            @keyframes reward-tag-pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.05); }
                100% { transform: scale(1); }
            }
            
            .system-message.reward-upgrade {
                background: linear-gradient(45deg, rgba(255, 215, 0, 0.1), rgba(255, 149, 0, 0.1));
                border-left: 3px solid #ff9500;
                padding: 10px;
                margin: 10px 0;
                border-radius: 8px;
                text-align: center;
                font-weight: bold;
                animation: reward-message 3s ease-in-out;
            }
            
            @keyframes reward-message {
                0% { opacity: 0; transform: translateY(-10px); }
                20% { opacity: 1; transform: translateY(0); }
                80% { opacity: 1; transform: translateY(0); }
                100% { opacity: 0; transform: translateY(-10px); }
            }
            
            /* Sending indicator for messages */
            .sending-indicator {
                font-size: 11px;
                color: #666;
                margin-top: 4px;
                display: flex;
                align-items: center;
                gap: 4px;
            }
            
            /* Ensure SVG icons display properly */
            .feather {
                display: inline-block;
                vertical-align: middle;
                stroke: currentColor;
                stroke-width: 2;
                stroke-linecap: round;
                stroke-linejoin: round;
                fill: none;
            }
        `;
        
        document.head.appendChild(reactionModalStyles);
        
        this.reactionModal.querySelector('.close-reaction-modal').addEventListener('click', () => {
            this.hideReactionModal();
        });
        
        this.reactionModal.querySelectorAll('.emoji-item').forEach(emoji => {
            emoji.addEventListener('click', () => {
                const emojiChar = emoji.dataset.emoji;
                this.addReactionToMessage(emojiChar);
                this.hideReactionModal();
            });
        });
        
        this.reactionModal.addEventListener('click', (e) => {
            if (e.target === this.reactionModal) {
                this.hideReactionModal();
            }
        });
    }

    showReactionModal(message) {
        this.currentMessageForReaction = message;
        this.reactionModal.classList.add('active');
    }

    hideReactionModal() {
        this.reactionModal.classList.remove('active');
        this.currentMessageForReaction = null;
    }

    async addReactionToMessage(emoji) {
        try {
            if (!this.currentMessageForReaction || !this.firebaseUser) {
                return;
            }
            
        const message = this.currentMessageForReaction;
        const userId = this.firebaseUser.uid;
        
        if (message.chatType === 'private') {
            const chatId = this.getPrivateChatId(
                message.senderId === userId ? message.senderId : this.currentChatPartnerId,
                message.senderId === userId ? this.currentChatPartnerId : message.senderId
            );
            
            const reactionRef = doc(db, 'private_chats', chatId, 'messages', message.id, 'reactions', emoji);
            const reactionSnap = await getDoc(reactionRef);
            
            if (reactionSnap.exists()) {
                const reactionData = reactionSnap.data();
                if (reactionData.users && reactionData.users.includes(userId)) {
                    await updateDoc(reactionRef, {
                        count: increment(-1),
                        users: arrayRemove(userId),
                        lastUpdated: serverTimestamp()
                    });
                    
                    if (reactionData.count <= 1) {
                        await deleteDoc(reactionRef);
                    }
                } else {
                    await updateDoc(reactionRef, {
                        count: increment(1),
                        users: arrayUnion(userId),
                        lastUpdated: serverTimestamp()
                    });
                }
            } else {
                await setDoc(reactionRef, {
                    emoji: emoji,
                    count: 1,
                    users: [userId],
                    lastUpdated: serverTimestamp()
                });
            }
        } else {
            const groupId = this.currentGroupId;
            const messageId = message.id;
            
            const reactionRef = doc(db, 'groups', groupId, 'messages', messageId, 'reactions', emoji);
            const reactionSnap = await getDoc(reactionRef);
            
            if (reactionSnap.exists()) {
                const reactionData = reactionSnap.data();
                if (reactionData.users && reactionData.users.includes(userId)) {
                    await updateDoc(reactionRef, {
                        count: increment(-1),
                        users: arrayRemove(userId),
                        lastUpdated: serverTimestamp()
                    });
                    
                    if (reactionData.count <= 1) {
                        await deleteDoc(reactionRef);
                    }
                } else {
                    await updateDoc(reactionRef, {
                        count: increment(1),
                        users: arrayUnion(userId),
                        lastUpdated: serverTimestamp()
                    });
                }
            } else {
                await setDoc(reactionRef, {
                    emoji: emoji,
                    count: 1,
                    users: [userId],
                    lastUpdated: serverTimestamp()
                });
            }
        }
            
        } catch (error) {
            console.error('Error adding reaction:', error);
        }
    }

    async getMessageReactions(groupId, messageId) {
        try {
            const cacheKey = `reactions_${groupId}_${messageId}`;
            const cached = this.getCachedItem(cacheKey, this.cache.messageReactions);
            if (cached) return cached;

            const reactionsRef = collection(db, 'groups', groupId, 'messages', messageId, 'reactions');
            const q = query(reactionsRef);
            const querySnapshot = await getDocs(q);
            
            const reactions = [];
            querySnapshot.forEach(doc => {
                const data = doc.data();
                reactions.push({
                    emoji: data.emoji,
                    count: data.count || 0,
                    users: data.users || [],
                    id: doc.id
                });
            });
            
            this.setCachedItem(cacheKey, reactions, this.cache.messageReactions, 60000);
            
            return reactions;
        } catch (error) {
            console.error('Error getting reactions:', error);
            return [];
        }
    }

    async getPrivateMessageReactions(chatId, messageId) {
        try {
            const cacheKey = `private_reactions_${chatId}_${messageId}`;
            const cached = this.getCachedItem(cacheKey, this.cache.messageReactions);
            if (cached) return cached;

            const reactionsRef = collection(db, 'private_chats', chatId, 'messages', messageId, 'reactions');
            const q = query(reactionsRef);
            const querySnapshot = await getDocs(q);
            
            const reactions = [];
            querySnapshot.forEach(doc => {
                const data = doc.data();
                reactions.push({
                    emoji: data.emoji,
                    count: data.count || 0,
                    users: data.users || [],
                    id: doc.id
                });
            });
            
            this.setCachedItem(cacheKey, reactions, this.cache.messageReactions, 60000);
            
            return reactions;
        } catch (error) {
            console.error('Error getting private message reactions:', error);
            return [];
        }
    }

    async listenToMessageReactions(groupId, messageId, callback) {
        try {
            const reactionsRef = collection(db, 'groups', groupId, 'messages', messageId, 'reactions');
            const q = query(reactionsRef);
            
            return onSnapshot(q, (snapshot) => {
                const reactions = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    reactions.push({
                        emoji: data.emoji,
                        count: data.count || 0,
                        users: data.users || [],
                        id: doc.id
                    });
                });
                
                const cacheKey = `reactions_${groupId}_${messageId}`;
                this.setCachedItem(cacheKey, reactions, this.cache.messageReactions, 60000);
                
                callback(reactions);
            });
        } catch (error) {
            console.error('Error listening to reactions:', error);
            return () => {};
        }
    }

    async listenToPrivateMessageReactions(chatId, messageId, callback) {
        try {
            const reactionsRef = collection(db, 'private_chats', chatId, 'messages', messageId, 'reactions');
            const q = query(reactionsRef);
            
            return onSnapshot(q, (snapshot) => {
                const reactions = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    reactions.push({
                        emoji: data.emoji,
                        count: data.count || 0,
                        users: data.users || [],
                        id: doc.id
                    });
                });
                
                const cacheKey = `private_reactions_${chatId}_${messageId}`;
                this.setCachedItem(cacheKey, reactions, this.cache.messageReactions, 60000);
                
                callback(reactions);
            });
        } catch (error) {
            console.error('Error listening to private message reactions:', error);
            return () => {};
        }
    }

    setupSwipeToReply(messagesContainer) {
        if (!messagesContainer) return;
        
        let startX = 0;
        let startY = 0;
        let currentMessage = null;
        let swipeIndicator = null;
        
        const handleTouchStart = (e) => {
            const touch = e.touches[0];
            startX = touch.clientX;
            startY = touch.clientY;
            
            let element = e.target;
            while (element && !element.classList.contains('message-text') && 
                   element !== messagesContainer) {
                element = element.parentElement;
            }
            
            if (element && element.classList.contains('message-text')) {
                currentMessage = element;
            }
        };
        
        const handleTouchMove = (e) => {
            if (!currentMessage) return;
            
            const touch = e.touches[0];
            const deltaX = touch.clientX - startX;
            const deltaY = touch.clientY - startY;
            
            if (Math.abs(deltaY) > Math.abs(deltaX) || deltaX < 0) {
                return;
            }
            
            if (deltaX > this.swipeThreshold) {
                e.preventDefault();
                
                if (!swipeIndicator) {
                    swipeIndicator = document.createElement('div');
                    swipeIndicator.className = 'swipe-reply-indicator';
                    swipeIndicator.innerHTML = `
                        <svg class="feather" data-feather="corner-up-left" style="width: 16px; height: 16px; margin-right: 8px;">
                            <polyline points="9 10 4 15 9 20"></polyline>
                            <path d="M20 4v7a4 4 0 0 1-4 4H4"></path>
                        </svg>
                        <span>Swipe right to reply</span>
                    `;
                    document.body.appendChild(swipeIndicator);
                }
                
                swipeIndicator.classList.add('show');
            }
        };
        
        const handleTouchEnd = (e) => {
            if (!currentMessage) return;
            
            const touch = e.changedTouches[0];
            const deltaX = touch.clientX - startX;
            const deltaY = touch.clientY - startY;
            
            if (deltaX > this.swipeThreshold && Math.abs(deltaY) < this.swipeThreshold) {
                const messageId = currentMessage.dataset.messageId;
                const message = window.currentMessages?.find(m => m.id === messageId);
                if (message) {
                    this.handleReply(message);
                }
            }
            
            if (swipeIndicator) {
                swipeIndicator.classList.remove('show');
                setTimeout(() => {
                    if (swipeIndicator && swipeIndicator.parentNode) {
                        swipeIndicator.parentNode.removeChild(swipeIndicator);
                        swipeIndicator = null;
                    }
                }, 300);
            }
            
            currentMessage = null;
        };
        
        const handleLongPress = (e) => {
            let element = e.target;
            while (element && !element.classList.contains('message-text') && 
                   element !== messagesContainer) {
                element = element.parentElement;
            }
            
            if (element && element.classList.contains('message-text')) {
                const messageId = element.dataset.messageId;
                const message = window.currentMessages?.find(m => m.id === messageId);
                if (message) {
                    e.preventDefault();
                    this.showReactionModal(message);
                }
            }
        };
        
        let longPressTimer = null;
        
        messagesContainer.addEventListener('touchstart', (e) => {
            handleTouchStart(e);
            longPressTimer = setTimeout(() => {
                handleLongPress(e);
            }, 500);
        });
        
        messagesContainer.addEventListener('touchmove', (e) => {
            handleTouchMove(e);
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        });
        
        messagesContainer.addEventListener('touchend', (e) => {
            handleTouchEnd(e);
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        });
        
        messagesContainer.addEventListener('touchcancel', () => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
            if (swipeIndicator) {
                swipeIndicator.classList.remove('show');
                setTimeout(() => {
                    if (swipeIndicator && swipeIndicator.parentNode) {
                        swipeIndicator.parentNode.removeChild(swipeIndicator);
                        swipeIndicator = null;
                    }
                }, 300);
            }
        });
        
        messagesContainer.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
    }

    handleReply(message) {
        this.replyingToMessage = message;
        this.showReplyIndicator();
        
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            messageInput.focus();
        }
    }

    truncateName(name) {
        if (!name) return '';
        const words = name.split(' ');
        if (words.length <= 6) return name;
        return words.slice(0, 6).join(' ') + '...';
    }

    truncateMessage(text) {
        if (!text) return '';
        if (text.length <= 25) return text;
        return text.substring(0, 25) + '...';
    }

    showReplyIndicator() {
        this.removeReplyIndicator();
        
        if (!this.replyingToMessage) return;
        
        const messageInputContainer = document.querySelector('.message-input-container');
        if (!messageInputContainer) return;
        
        const indicator = document.createElement('div');
        indicator.className = 'reply-indicator';
        indicator.id = 'replyIndicator';
        
        const truncatedName = this.truncateName(this.replyingToMessage.senderName);
        const truncatedMessage = this.replyingToMessage.text ? 
            this.truncateMessage(this.replyingToMessage.text) : 
            (this.replyingToMessage.imageUrl ? '📷 Image' : this.replyingToMessage.videoUrl ? '🎬 Video' : '');
        
        indicator.innerHTML = `
            <div class="reply-indicator-content">
                <span class="reply-label">Replying to</span> 
                <span class="reply-sender">${truncatedName}</span>
                <span class="reply-separator">:</span> 
                <span class="reply-message">${truncatedMessage}</span>
            </div>
            <button class="cancel-reply" id="cancelReply">
                <svg class="feather" data-feather="x" style="width: 16px; height: 16px;">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        `;
        
        messageInputContainer.parentNode.insertBefore(indicator, messageInputContainer);
        
        document.getElementById('cancelReply').addEventListener('click', () => {
            this.clearReply();
        });
        
        const indicatorStyles = document.createElement('style');
        indicatorStyles.id = 'reply-indicator-styles';
        indicatorStyles.textContent = `
            .reply-indicator {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 8px 12px;
                border-radius: 8px;
                margin-bottom: 8px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                font-size: 13px;
                max-width: 100%;
                overflow: hidden;
            }
            
            .reply-indicator-content {
                display: flex;
                align-items: center;
                flex-wrap: wrap;
                gap: 4px;
                flex: 1;
                overflow: hidden;
                white-space: nowrap;
                text-overflow: ellipsis;
            }
            
            .reply-label {
                opacity: 0.9;
                font-weight: 500;
            }
            
            .reply-sender {
                font-weight: 600;
                color: #ffdd59;
            }
            
            .reply-separator {
                opacity: 0.9;
            }
            
            .reply-message {
                opacity: 0.9;
                flex: 1;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            
            .cancel-reply {
                background: rgba(255, 255, 255, 0.2);
                border: none;
                color: white;
                width: 24px;
                height: 24px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                margin-left: 8px;
                flex-shrink: 0;
            }
            
            .cancel-reply:hover {
                background: rgba(255, 255, 255, 0.3);
            }
        `;
        
        if (!document.getElementById('reply-indicator-styles')) {
            document.head.appendChild(indicatorStyles);
        }
    }

    removeReplyIndicator() {
        const indicator = document.getElementById('replyIndicator');
        if (indicator) {
            indicator.remove();
        }
    }

    clearReply() {
        this.replyingToMessage = null;
        this.removeReplyIndicator();
    }

    async logout() {
        try {
            await signOut(auth);
            this.firebaseUser = null;
            this.currentUser = null;
            this.clearAllCache();
            this.cleanup();
            
            window.location.href = 'login.html';
        } catch (error) {
            console.error('Error logging out:', error);
        }
    }

    cleanup() {
        if (this.unsubscribeMessages) {
            try {
                this.unsubscribeMessages();
            } catch (err) {
                console.log('Error unsubscribing from messages:', err);
            }
            this.unsubscribeMessages = null;
        }
        
        if (this.unsubscribeMembers) {
            try {
                this.unsubscribeMembers();
            } catch (err) {
                console.log('Error unsubscribing from members:', err);
            }
            this.unsubscribeMembers = null;
        }
        
        if (this.unsubscribePrivateMessages) {
            try {
                this.unsubscribePrivateMessages();
            } catch (err) {
                console.log('Error unsubscribing from private messages:', err);
            }
            this.unsubscribePrivateMessages = null;
        }
        
        if (this.unsubscribePrivateChats) {
            try {
                this.unsubscribePrivateChats();
            } catch (err) {
                console.log('Error unsubscribing from private chats:', err);
            }
            this.unsubscribePrivateChats = null;
        }
        
        if (this.unsubscribeAuth) {
            try {
                this.unsubscribeAuth();
            } catch (err) {
                console.log('Error unsubscribing from auth:', err);
            }
            this.unsubscribeAuth = null;
        }
        
        this.areListenersSetup = false;
        this.sentMessageIds.clear();
        this.pendingMessages.clear();
        
        // NEW: Clear typing timeouts
        this.typingUsers.forEach((userTyping, groupId) => {
            userTyping.forEach((timeout, userId) => {
                clearTimeout(timeout);
            });
        });
        this.typingUsers.clear();
        
        // Clear streak timers
        this.userStreakTimers.forEach(timer => {
            clearTimeout(timer);
        });
        this.userStreakTimers.clear();
    }
}

const groupChat = new GroupChat();

document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('groupAuthReady', () => {
        const currentPage = window.location.pathname.split('/').pop().split('.')[0];
        
        switch(currentPage) {
            case 'create-group':
                initCreateGroupPage();
                break;
            case 'groups':
                initGroupsPage();
                break;
            case 'set':
                initSetPage();
                break;
            case 'group':
                initGroupPage();
                break;
            case 'admin-groups':
                initAdminGroupsPage();
                break;
            case 'join':
                initJoinPage();
                break;
            case 'user':
                initUserPage();
                break;
            case 'chats':
                initChatPage();
                break;
            case 'message':
                initMessagesPage();
                break;
            default:
                if (currentPage === 'login' || currentPage === 'signup' || currentPage === 'index') {
                } else {
                    setTimeout(() => {
                        if (!groupChat.firebaseUser && currentPage !== 'login' && currentPage !== 'signup' && currentPage !== 'index') {
                            window.location.href = 'login.html';
                        }
                    }, 1000);
                }
        }
    });
    
    setTimeout(() => {
        if (groupChat.firebaseUser) {
            document.dispatchEvent(new CustomEvent('groupAuthReady'));
        }
    }, 500);
});

function initCreateGroupPage() {
    if (!groupChat.firebaseUser) {
        window.location.href = 'login.html';
        return;
    }
    
    const form = document.getElementById('createGroupForm');
    const nameInput = document.getElementById('groupName');
    const descInput = document.getElementById('groupDescription');
    const nameCount = document.getElementById('nameCount');
    const descCount = document.getElementById('descCount');
    const maxMembersSlider = document.getElementById('maxMembers');
    const memberCount = document.getElementById('memberCount');
    const addTopicBtn = document.getElementById('addTopicBtn');
    const addRuleBtn = document.getElementById('addRuleBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const createBtn = document.getElementById('createBtn');
    const groupPhotoInput = document.getElementById('groupPhoto');
    const photoPreview = document.getElementById('photoPreview');
    const photoPreviewImg = document.getElementById('photoPreviewImg');
    const uploadPhotoBtn = document.getElementById('uploadPhotoBtn');
    const restrictedWordsInput = document.getElementById('restrictedWords');
    
    let topics = [''];
    let rules = [''];
    let groupPhotoFile = null;
    
    photoPreview.addEventListener('click', () => {
        groupPhotoInput.click();
    });

    uploadPhotoBtn.addEventListener('click', () => {
        groupPhotoInput.click();
    });

    groupPhotoInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
            if (!validTypes.includes(file.type)) {
                alert('Please upload a valid image file (JPEG, PNG, GIF, WebP)');
                return;
            }

            if (file.size > 5 * 1024 * 1024) {
                alert('Image must be less than 5MB');
                return;
            }

            groupPhotoFile = file;
            const reader = new FileReader();
            reader.onload = (e) => {
                photoPreviewImg.src = e.target.result;
                photoPreviewImg.style.display = 'block';
                photoPreview.querySelector('.photo-placeholder').style.display = 'none';
            };
            reader.readAsDataURL(file);
        }
    });
    
    nameInput.addEventListener('input', () => {
        nameCount.textContent = nameInput.value.length;
    });
    
    descInput.addEventListener('input', () => {
        descCount.textContent = descInput.value.length;
    });
    
    maxMembersSlider.addEventListener('input', () => {
        memberCount.textContent = maxMembersSlider.value;
    });
    
    addTopicBtn.addEventListener('click', () => {
        if (topics.length < 5) {
            topics.push('');
            renderTopics();
        }
    });
    
    addRuleBtn.addEventListener('click', () => {
        rules.push('');
        renderRules();
    });
    
    function renderTopics() {
        const container = document.getElementById('topicsContainer');
        container.innerHTML = '';
        
        topics.forEach((topic, index) => {
            const div = document.createElement('div');
            div.className = 'rule-item';
            
            div.innerHTML = `
                <input type="text" 
                       class="form-input rule-input" 
                       placeholder="Add a topic"
                       value="${topic}"
                       data-index="${index}">
                ${index === 0 ? `
                    <button type="button" class="add-rule-btn add-topic-btn">
                        <svg class="feather" data-feather="plus">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                    </button>
                ` : `
                    <button type="button" class="remove-rule-btn remove-topic-btn">
                        <svg class="feather" data-feather="minus">
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                    </button>
                `}
            `;
            
            container.appendChild(div);
        });
        
        document.querySelectorAll('.add-topic-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (topics.length < 5) {
                    topics.push('');
                    renderTopics();
                }
            });
        });
        
        document.querySelectorAll('.remove-topic-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.closest('.remove-topic-btn').parentElement.querySelector('input').dataset.index);
                topics.splice(index, 1);
                renderTopics();
            });
        });
        
        document.querySelectorAll('.rule-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const index = parseInt(e.target.dataset.index);
                topics[index] = e.target.value;
            });
        });
    }
    
    function renderRules() {
        const container = document.getElementById('rulesContainer');
        container.innerHTML = '';
        
        rules.forEach((rule, index) => {
            const div = document.createElement('div');
            div.className = 'rule-item';
            
            div.innerHTML = `
                <input type="text" 
                       class="form-input rule-input" 
                       placeholder="Add a rule"
                       value="${rule}"
                       data-index="${index}">
                ${index === 0 ? `
                    <button type="button" class="add-rule-btn add-rule-btn">
                        <svg class="feather" data-feather="plus">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                    </button>
                ` : `
                    <button type="button" class="remove-rule-btn remove-rule-btn">
                        <svg class="feather" data-feather="minus">
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                    </button>
                `}
            `;
            
            container.appendChild(div);
        });
        
        document.querySelectorAll('.add-rule-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                rules.push('');
                renderRules();
            });
        });
        
        document.querySelectorAll('.remove-rule-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.closest('.remove-rule-btn').parentElement.querySelector('input').dataset.index);
                rules.splice(index, 1);
                renderRules();
            });
        });
        
        document.querySelectorAll('.rule-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const index = parseInt(e.target.dataset.index);
                rules[index] = e.target.value;
            });
        });
    }
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const restrictedWordsText = restrictedWordsInput.value.trim();
        const restrictedWords = restrictedWordsText ? 
            restrictedWordsText.split(',').map(word => word.trim()).filter(word => word.length > 0) : 
            [];
        
        const groupData = {
            name: nameInput.value.trim(),
            description: descInput.value.trim(),
            category: document.getElementById('groupCategory').value,
            topics: topics.filter(t => t.trim()).map(t => t.trim()),
            rules: rules.filter(r => r.trim()).map(r => r.trim()),
            restrictedWords: restrictedWords,
            maxMembers: parseInt(maxMembersSlider.value),
            privacy: document.getElementById('groupPrivacy').value
        };
        
        if (!groupData.name) {
            alert('Please enter a group name');
            return;
        }
        
        if (!groupData.description) {
            alert('Please enter a group description');
            return;
        }
        
        if (groupData.topics.length === 0) {
            alert('Please add at least one discussion topic');
            return;
        }
        
        createBtn.disabled = true;
        createBtn.innerHTML = `
            <svg class="feather" data-feather="loader" style="animation: spin 1s linear infinite;">
                <circle cx="12" cy="12" r="10" />
            </svg>
            Creating...
        `;
        
        try {
            const result = await groupChat.createGroup(groupData, groupPhotoFile);
            
            alert(`Group created successfully!\n\nInvite Link: ${result.inviteLink}\n\nThis link has been copied to your clipboard.`);
            
            navigator.clipboard.writeText(result.inviteLink);
            
            window.location.href = `group.html?id=${result.groupId}`;
        } catch (error) {
            console.error('Error creating group:', error);
            alert('Failed to create group. Please try again.');
            createBtn.disabled = false;
            createBtn.textContent = 'Create Group';
        }
    });
    
    cancelBtn.addEventListener('click', () => {
        window.location.href = 'groups.html';
    });
    
    renderTopics();
    renderRules();
}

function initGroupsPage() {
    const groupsGrid = document.getElementById('groupsGrid');
    const createGroupBtn = document.getElementById('createGroupBtn');
    const searchInput = document.getElementById('groupSearch');
    
    let allGroups = [];
    
    loadGroups();
    
    if (createGroupBtn) {
        createGroupBtn.addEventListener('click', async () => {
            if (!groupChat.firebaseUser) {
                window.location.href = 'login.html';
                return;
            }
            
            const needsSetup = await groupChat.needsProfileSetup();
            if (needsSetup) {
                window.location.href = 'set.html?returnTo=create-group';
            } else {
                window.location.href = 'create-group.html';
            }
        });
    }
    
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();
        filterGroups(searchTerm);
    });
    
    function generateGroupAvatar(group) {
        if (group.photoUrl) {
            return group.photoUrl;
        }
        const seed = encodeURIComponent(group.name);
        return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&backgroundColor=00897b,00acc1,039be5,1e88e5,3949ab,43a047,5e35b1,7cb342,8e24aa,c0ca33,d81b60,e53935,f4511e,fb8c00,fdd835,ffb300,ffd5dc,ffdfbf,c0aede,d1d4f9,b6e3f4&backgroundType=gradientLinear`;
    }
    
    async function loadGroups() {
        try {
            allGroups = await groupChat.getAllGroups();
            displayGroups(allGroups);
        } catch (error) {
            console.error('Error loading groups:', error);
            groupsGrid.innerHTML = '<div class="no-groups"><p>Error loading groups. Please try again.</p></div>';
        }
    }
    
    function displayGroups(groups) {
        if (groups.length === 0) {
            groupsGrid.innerHTML = `
                <div class="no-groups">
                    <svg class="feather" data-feather="users" style="width: 48px; height: 48px; margin-bottom: 16px;">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                    <p>No groups found. Be the first to create one!</p>
                </div>
            `;
            return;
        }
        
        groupsGrid.innerHTML = '';
        
        groups.forEach(group => {
            const groupCard = document.createElement('div');
            groupCard.className = 'group-card';
            groupCard.innerHTML = `
                <div class="group-header">
                    <div class="group-avatar-section">
                        <img src="${generateGroupAvatar(group)}" alt="${group.name}" class="group-avatar">
                        <div class="group-title-section">
                            <h3 class="group-name">${group.name}</h3>
                            <span class="group-category">${group.category || 'General'}</span>
                        </div>
                    </div>
                    <p class="group-description">${group.description}</p>
                    <div class="group-meta">
                        <span class="group-members">
                            <svg class="feather" data-feather="users" style="width: 14px; height: 14px; margin-right: 4px;">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                <circle cx="9" cy="7" r="4"></circle>
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                            </svg>
                            ${group.memberCount || 0} / ${group.maxMembers || 1000}
                        </span>
                        <span class="group-privacy">
                            <svg class="feather" data-feather="${group.privacy === 'private' ? 'lock' : 'globe'}" style="width: 14px; height: 14px; margin-right: 4px;">
                                ${group.privacy === 'private' ? 
                                    '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>' : 
                                    '<circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1 4-10z"></path>'
                                }
                            </svg>
                            ${group.privacy === 'private' ? 'Private' : 'Public'}
                        </span>
                    </div>
                </div>
                <div class="group-content">
                    <div class="group-topics">
                        <h4 class="section-title">Discussion Topics</h4>
                        <div class="topics-list">
                            ${(group.topics || []).slice(0, 3).map(topic => 
                                `<span class="topic-tag">${topic}</span>`
                            ).join('')}
                            ${(group.topics || []).length > 3 ? 
                                `<span class="topic-tag">+${(group.topics || []).length - 3} more</span>` : ''
                            }
                        </div>
                    </div>
                    <div class="group-rules">
                        <h4 class="section-title">Group Rules</h4>
                        <ul class="rules-list">
                            ${(group.rules || []).slice(0, 2).map(rule => 
                                `<li class="rule-item">
                                    <svg class="feather" data-feather="check-circle" style="width: 14px; height: 14px; margin-right: 8px;">
                                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                                    </svg>
                                    <span>${rule}</span>
                                </li>`
                            ).join('')}
                            ${(group.rules || []).length > 2 ? 
                                `<li class="rule-item">
                                    <svg class="feather" data-feather="more-horizontal" style="width: 14px; height: 14px; margin-right: 8px;">
                                        <circle cx="12" cy="12" r="1"></circle>
                                        <circle cx="19" cy="12" r="1"></circle>
                                        <circle cx="5" cy="12" r="1"></circle>
                                    </svg>
                                    <span>${(group.rules || []).length - 2} more rules</span>
                                </li>` : ''
                            }
                        </ul>
                    </div>
                </div>
                <div class="group-actions">
                    <button class="join-btn" data-group-id="${group.id}">
                        Join Group
                    </button>
                </div>
            `;
            
            groupsGrid.appendChild(groupCard);
        });
        
        document.querySelectorAll('.join-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const groupId = e.target.dataset.groupId;
                
                if (!groupChat.firebaseUser) {
                    window.location.href = 'login.html';
                }
                
                const needsSetup = await groupChat.needsProfileSetup();
                if (needsSetup) {
                    window.location.href = `set.html?id=${groupId}`;
                } else {
                    try {
                        await groupChat.joinGroup(groupId);
                        window.location.href = `group.html?id=${groupId}`;
                    } catch (error) {
                        alert(error.message || 'Failed to join group. Please try again.');
                    }
                }
            });
        });
    }
    
    function filterGroups(searchTerm) {
        if (!searchTerm) {
            displayGroups(allGroups);
            return;
        }
        
        const filtered = allGroups.filter(group => {
            return (
                group.name.toLowerCase().includes(searchTerm) ||
                group.description.toLowerCase().includes(searchTerm) ||
                (group.category && group.category.toLowerCase().includes(searchTerm)) ||
                (group.topics || []).some(topic => topic.toLowerCase().includes(searchTerm))
            );
        });
        
        displayGroups(filtered);
    }
}

function initSetPage() {
    const form = document.getElementById('setupForm');
    const avatarPreview = document.getElementById('avatarPreview');
    const avatarOptions = document.getElementById('avatarOptions');
    const displayName = document.getElementById('displayName');
    const nameCount = document.getElementById('nameCount');
    const userBio = document.getElementById('userBio');
    const bioCount = document.getElementById('bioCount');
    const cancelBtn = document.getElementById('cancelBtn');
    const joinBtn = document.getElementById('joinBtn');
    const groupInfo = document.getElementById('groupInfo');
    
    const urlParams = new URLSearchParams(window.location.search);
    const groupId = urlParams.get('id');
    const returnTo = urlParams.get('returnTo');
    
    let selectedAvatar = AVATAR_OPTIONS[0];
    let groupData = null;
    
    if (!groupChat.firebaseUser) {
        window.location.href = 'login.html';
        return;
    }
    
    if (groupId) {
        loadGroupInfo();
    } else {
        groupInfo.innerHTML = `
            <div class="group-name-display">Profile Setup</div>
            <div class="group-description-display">Set up your profile before joining groups</div>
        `;
    }
    
    displayName.addEventListener('input', () => {
        nameCount.textContent = displayName.value.length;
    });
    
    userBio.addEventListener('input', () => {
        bioCount.textContent = userBio.value.length;
    });
    
    function renderAvatarOptions() {
        avatarOptions.innerHTML = '';
        
        AVATAR_OPTIONS.forEach((avatar, index) => {
            const img = document.createElement('img');
            img.src = avatar;
            img.alt = `Avatar ${index + 1}`;
            img.className = `avatar-option ${avatar === selectedAvatar ? 'selected' : ''}`;
            
            img.addEventListener('click', () => {
                selectedAvatar = avatar;
                avatarPreview.src = avatar;
                renderAvatarOptions();
            });
            
            avatarOptions.appendChild(img);
        });
    }
    
    async function loadGroupInfo() {
        try {
            groupData = await groupChat.getGroup(groupId);
            
            if (!groupData) {
                alert('Group not found');
                window.location.href = 'groups.html';
                return;
            }
            
            groupInfo.innerHTML = `
                <div class="group-name-display">${groupData.name}</div>
                <div class="group-description-display">${groupData.description}</div>
            `;
        } catch (error) {
            console.error('Error loading group info:', error);
            alert('Error loading group information');
            window.location.href = 'groups.html';
        }
    }
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = displayName.value.trim();
        const bio = userBio.value.trim();
        
        if (!name) {
            alert('Please enter a display name');
            return;
        }
        
        if (name.length < 2) {
            alert('Display name must be at least 2 characters');
            return;
        }
        
        if (name.length > 20) {
            alert('Display name must be less than 20 characters');
            return;
        }
        
        const userData = {
            name: name,
            avatar: selectedAvatar,
            bio: bio
        };
        
        joinBtn.disabled = true;
        joinBtn.innerHTML = `
            <svg class="feather" data-feather="loader" style="animation: spin 1s linear infinite; margin-right: 8px;">
                <circle cx="12" cy="12" r="10" />
            </svg>
            Saving...
        `;
        
        try {
            await groupChat.updateUserProfile(userData);
            
            if (groupId) {
                try {
                    await groupChat.joinGroup(groupId);
                    alert('Profile saved and joined group successfully!');
                    window.location.href = `group.html?id=${groupId}`;
                } catch (error) {
                    alert('Profile saved, but could not join group: ' + error.message);
                    window.location.href = 'groups.html';
                }
            } else if (returnTo === 'create-group') {
                window.location.href = 'create-group.html';
            } else {
                alert('Profile saved successfully!');
                window.location.href = 'groups.html';
            }
            
        } catch (error) {
            console.error('Error saving profile:', error);
            alert('Failed to save profile. Please try again.');
            joinBtn.disabled = false;
            joinBtn.textContent = 'Save Profile';
        }
    });
    
    cancelBtn.addEventListener('click', () => {
        if (returnTo === 'create-group') {
            window.location.href = 'create-group.html';
        } else {
            window.location.href = 'groups.html';
        }
    });
    
    renderAvatarOptions();
    
    if (groupChat.currentUser && groupChat.currentUser.name !== 'User') {
        displayName.value = groupChat.currentUser.name || '';
        userBio.value = groupChat.currentUser.bio || '';
        selectedAvatar = groupChat.currentUser.avatar || AVATAR_OPTIONS[0];
        avatarPreview.src = selectedAvatar;
        
        nameCount.textContent = displayName.value.length;
        bioCount.textContent = userBio.value.length;
        
        renderAvatarOptions();
    }
}

// UPDATED: Create typing indicator element at top
function createTypingIndicator() {
    const typingIndicator = document.createElement('div');
    typingIndicator.id = 'typingIndicator';
    typingIndicator.className = 'typing-indicator';
    typingIndicator.style.display = 'none';
    typingIndicator.innerHTML = `
        <span id="typingText">No one is typing</span>
        <span class="typing-dots" id="typingDots">
            <span></span>
            <span></span>
            <span></span>
        </span>
    `;
    document.body.appendChild(typingIndicator);
    return typingIndicator;
}

// UPDATED: Update typing indicator
function updateTypingIndicator(typingUsers) {
    const typingIndicator = document.getElementById('typingIndicator');
    const typingText = document.getElementById('typingText');
    
    if (!typingIndicator || !typingText) return;
    
    if (typingUsers.length === 0) {
        typingIndicator.style.display = 'none';
        typingIndicator.classList.remove('show');
        return;
    }
    
    let typingMessage = '';
    if (typingUsers.length === 1) {
        typingMessage = `${typingUsers[0].userName} is typing`;
    } else if (typingUsers.length === 2) {
        typingMessage = `${typingUsers[0].userName} and ${typingUsers[1].userName} are typing`;
    } else if (typingUsers.length === 3) {
        typingMessage = `${typingUsers[0].userName}, ${typingUsers[1].userName} and 1 other are typing`;
    } else {
        typingMessage = `${typingUsers[0].userName}, ${typingUsers[1].userName} and ${typingUsers.length - 2} others are typing`;
    }
    
    typingText.textContent = typingMessage;
    typingIndicator.style.display = 'block';
    
    // Trigger reflow to enable animation
    void typingIndicator.offsetWidth;
    
    typingIndicator.classList.add('show');
}

function initGroupPage() {
    const sidebar = document.getElementById('sidebar');
    const backBtn = document.getElementById('backBtn');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const infoBtn = document.getElementById('infoBtn');
    const messagesContainer = document.getElementById('messagesContainer');
    const noMessages = document.getElementById('noMessages');
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const emojiBtn = document.getElementById('emojiBtn');
    const attachmentBtn = document.getElementById('attachmentBtn');
    const groupAvatar = document.getElementById('groupAvatar');
    const groupNameSidebar = document.getElementById('groupNameSidebar');
    const groupMembersCount = document.getElementById('groupMembersCount');
    const chatTitle = document.getElementById('chatTitle');
    const chatSubtitle = document.getElementById('chatSubtitle');
    const membersList = document.getElementById('membersList');
    const rulesList = document.getElementById('rulesList');
    
    const urlParams = new URLSearchParams(window.location.search);
    const groupId = urlParams.get('id');
    
    let messages = [];
    let members = [];
    let groupData = null;
    let tempMessages = new Map();
    let isInitialLoad = true;
    let reactionUnsubscribers = new Map();
    let reactionsCache = new Map();
    let isRendering = false;
    let renderQueue = [];
    
    // UPDATED: Typing indicator variables
    let typingIndicator = null;
    let typingUnsubscribe = null;
    let typingTimeout = null;
    let lastTypingInputTime = 0;
    let lastMessageIds = '';
    // FIXED: Moved renderedMessageIds to window object to persist across page navigation
    if (!window.renderedMessageIds) {
        window.renderedMessageIds = new Set();
    }
    let renderedMessageIds = window.renderedMessageIds;
    
    if (!groupId) {
        window.location.href = 'groups.html';
        return;
    }
    
    if (!groupChat.firebaseUser) {
        window.location.href = 'login.html';
        return;
    }
    
    window.currentGroupId = groupId;
    groupChat.currentGroupId = groupId;
    
    // UPDATED: Create typing indicator at top
    typingIndicator = createTypingIndicator();
    
    (async () => {
        const needsSetup = await groupChat.needsProfileSetup();
        if (needsSetup) {
            window.location.href = `set.html?id=${groupId}`;
            return;
        }
        
        const isMember = await groupChat.isMember(groupId);
        if (!isMember) {
            window.location.href = `set.html?id=${groupId}`;
            return;
        }
        
        loadGroupData();
        setupListeners();
    })();
    
    backBtn.addEventListener('click', () => {
        groupChat.cleanup();
        reactionUnsubscribers.forEach(unsub => unsub());
        reactionUnsubscribers.clear();
        
        // UPDATED: Clean up typing indicator
        if (typingUnsubscribe) {
            typingUnsubscribe();
        }
        if (typingTimeout) {
            clearTimeout(typingTimeout);
        }
        
        removeSidebarOverlay();
        window.location.href = 'groups.html';
    });
    
    if (sidebarToggle) {
        const newToggle = sidebarToggle.cloneNode(true);
        sidebarToggle.parentNode.replaceChild(newToggle, sidebarToggle);
        
        const freshToggle = document.getElementById('sidebarToggle');
        
        freshToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            if (sidebar) {
                const isActive = sidebar.classList.contains('active');
                if (isActive) {
                    sidebar.classList.remove('active');
                    removeSidebarOverlay();
                } else {
                    sidebar.classList.add('active');
                    createSidebarOverlay();
                }
            }
        });
    }
    
    if (infoBtn) {
        infoBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            if (sidebar) {
                const isActive = sidebar.classList.contains('active');
                if (isActive) {
                    sidebar.classList.remove('active');
                    removeSidebarOverlay();
                } else {
                    sidebar.classList.add('active');
                    createSidebarOverlay();
                }
            }
        });
    }
    
    // UPDATED: Typing indicator for message input
    messageInput.addEventListener('input', () => {
        sendBtn.disabled = !messageInput.value.trim();
        
        messageInput.style.height = 'auto';
        messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
        
        // UPDATED: Start typing indicator when user types
        const now = Date.now();
        if (now - lastTypingInputTime > 1000) { // Throttle to 1 second
            groupChat.startTyping(groupId);
            lastTypingInputTime = now;
        }
        
        // Reset typing timeout
        if (typingTimeout) {
            clearTimeout(typingTimeout);
        }
        
        // Stop typing after 3 seconds of inactivity
        typingTimeout = setTimeout(() => {
            groupChat.stopTyping(groupId);
        }, 3000);
    });
    
    // UPDATED: Stop typing when input loses focus
    messageInput.addEventListener('blur', () => {
        groupChat.stopTyping(groupId);
        if (typingTimeout) {
            clearTimeout(typingTimeout);
        }
    });
    
    // FIXED: Send button always shows airplane icon, no loader - prevent form submission
    sendBtn.addEventListener('click', (e) => {
        e.preventDefault();
        sendMessage();
    });
    
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    emojiBtn.addEventListener('click', () => {
        const emojis = ['😀', '😂', '🥰', '😎', '🤔', '👍', '🎉', '❤️', '🔥', '✨'];
        const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
        
        messageInput.value += randomEmoji;
        messageInput.focus();
        messageInput.dispatchEvent(new Event('input'));
    });
    
    attachmentBtn.addEventListener('click', () => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*,video/*';
        fileInput.multiple = false;
        
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    const originalHTML = attachmentBtn.innerHTML;
                    attachmentBtn.innerHTML = '<svg class="feather" data-feather="loader" style="animation: spin 1s linear infinite;"><circle cx="12" cy="12" r="10" /></svg>';
                    attachmentBtn.disabled = true;
                    
                    await groupChat.sendMediaMessage(groupId, file, groupChat.replyingToMessage?.id);
                    
                    attachmentBtn.innerHTML = originalHTML;
                    attachmentBtn.disabled = false;
                    
                } catch (error) {
                    console.error('Error sending media:', error);
                    alert(error.message || 'Failed to send media. Please try again.');
                    
                    attachmentBtn.innerHTML = '<svg class="feather" data-feather="paperclip"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>';
                    attachmentBtn.disabled = false;
                }
            }
        });
        
        fileInput.click();
    });
    
    document.addEventListener('tempMediaMessage', (e) => {
        const tempMessage = e.detail;
        tempMessages.set(tempMessage.id, tempMessage);
        
        const tempMsgIndex = messages.findIndex(m => m.id === tempMessage.id);
        if (tempMsgIndex === -1) {
            messages.push(tempMessage);
            queueRender();
        }
    });
    
    document.addEventListener('removeTempMessage', (e) => {
        const tempId = e.detail.tempId;
        tempMessages.delete(tempId);
        
        const tempMsgIndex = messages.findIndex(m => m.id === tempId);
        if (tempMsgIndex !== -1) {
            messages.splice(tempMsgIndex, 1);
            queueRender();
        }
    });
    
    async function loadGroupData() {
        try {
            groupData = await groupChat.getGroup(groupId);
            
            if (!groupData) {
                alert('Group not found');
                window.location.href = 'groups.html';
                return;
            }
            
            const groupAvatarUrl = groupData.photoUrl || 
                `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(groupData.name)}&backgroundColor=00897b&backgroundType=gradientLinear`;
            
            if (groupAvatar) groupAvatar.src = groupAvatarUrl;
            if (groupNameSidebar) groupNameSidebar.textContent = groupData.name;
            if (groupMembersCount) groupMembersCount.textContent = `${groupData.memberCount || 0} members`;
            
            // FIXED: Truncate group name to 6 words in chat header
            const truncatedGroupName = groupChat.truncateName(groupData.name);
            if (chatTitle) chatTitle.textContent = truncatedGroupName;
            if (chatSubtitle) chatSubtitle.textContent = groupData.description;
            
            if (rulesList) {
                rulesList.innerHTML = '';
                (groupData.rules || []).forEach(rule => {
                    const li = document.createElement('li');
                    li.className = 'rule-item';
                    li.innerHTML = `<svg class="feather" data-feather="check-circle" style="width: 14px; height: 14px; margin-right: 8px;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg><span>${rule}</span>`;
                    rulesList.appendChild(li);
                });
            }
            
            addInviteLinkButton();
            
            members = await groupChat.getGroupMembers(groupId);
            updateMembersList();
            
            if (isInitialLoad) {
                messages = await groupChat.getMessages(groupId);
                await loadInitialReactions();
                // Clear rendered message IDs for this specific group when first loading
                // Keep the window.renderedMessageIds but filter out only messages for this group
                for (const msgId of renderedMessageIds) {
                    if (msgId.includes(groupId)) {
                        renderedMessageIds.delete(msgId);
                    }
                }
                queueRender();
                isInitialLoad = false;
            }
            
        } catch (error) {
            console.error('Error loading group data:', error);
            alert('Error loading group data. Please try again.');
        }
    }
    
    async function loadInitialReactions() {
        for (const message of messages) {
            const reactions = await groupChat.getMessageReactions(groupId, message.id);
            reactionsCache.set(message.id, reactions);
        }
    }
    
    function queueRender() {
        if (!isRendering) {
            isRendering = true;
            requestAnimationFrame(() => {
                displayMessages();
                isRendering = false;
                
                if (renderQueue.length > 0) {
                    renderQueue = [];
                    queueRender();
                }
            });
        } else {
            renderQueue.push(true);
        }
    }
    
    function addInviteLinkButton() {
        if (!groupData || groupData.createdBy !== groupChat.firebaseUser.uid) {
            return;
        }
        
        let inviteContainer = document.getElementById('inviteLinkContainer');
        if (!inviteContainer) {
            inviteContainer = document.createElement('div');
            inviteContainer.id = 'inviteLinkContainer';
            inviteContainer.className = 'invite-link-container';
            
            const copyBtn = document.createElement('button');
            copyBtn.id = 'copyInviteBtn';
            copyBtn.className = 'copy-invite-btn';
            copyBtn.innerHTML = '<svg class="feather" data-feather="link" style="width: 16px; height: 16px; margin-right: 8px;"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg> Copy Invite Link';
            
            const statusDiv = document.createElement('div');
            statusDiv.id = 'inviteLinkStatus';
            statusDiv.className = 'invite-link-status';
            
            inviteContainer.appendChild(copyBtn);
            inviteContainer.appendChild(statusDiv);
            
            const sidebarContent = document.querySelector('.sidebar-content');
            if (sidebarContent) {
                const groupInfoSection = sidebarContent.querySelector('.group-info');
                if (groupInfoSection) {
                    groupInfoSection.appendChild(inviteContainer);
                } else {
                    sidebarContent.insertBefore(inviteContainer, sidebarContent.firstChild);
                }
            }
            
            if (!document.getElementById('invite-btn-styles')) {
                const styles = document.createElement('style');
                styles.id = 'invite-btn-styles';
                styles.textContent = `
                    .invite-link-container {
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        border-radius: 12px;
                        padding: 15px;
                        margin: 15px 0;
                        text-align: center;
                    }
                    
                    .copy-invite-btn {
                        background: white;
                        color: #667eea;
                        border: none;
                        padding: 12px 20px;
                        border-radius: 25px;
                        font-size: 14px;
                        font-weight: 600;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 8px;
                        width: 100%;
                        transition: all 0.3s ease;
                        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
                    }
                    
                    .copy-invite-btn:hover {
                        transform: translateY(-2px);
                        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
                    }
                    
                    .copy-invite-btn:active {
                        transform: translateY(0);
                    }
                    
                    .copy-invite-btn:disabled {
                        opacity: 0.7;
                        cursor: not-allowed;
                        transform: none !important;
                    }
                    
                    .copy-invite-btn.copied {
                        background: #4CAF50;
                        color: white;
                    }
                    
                    .copy-invite-btn.copied svg {
                        animation: bounce 0.5s ease;
                    }
                    
                    .invite-link-status {
                        margin-top: 10px;
                        font-size: 12px;
                        color: rgba(255, 255, 255, 0.9);
                        min-height: 18px;
                    }
                    
                    .invite-link-status.success {
                        color: #4CAF50;
                    }
                    
                    .invite-link-status.error {
                        color: #ff6b6b;
                    }
                    
                    @keyframes bounce {
                        0%, 100% { transform: translateY(0); }
                        50% { transform: translateY(-5px); }
                    }
                    
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `;
                document.head.appendChild(styles);
            }
            
            copyBtn.addEventListener('click', async () => {
                let isCopying = false;
                
                if (isCopying) return;
                
                isCopying = true;
                copyBtn.disabled = true;
                copyBtn.innerHTML = '<svg class="feather" data-feather="loader" style="animation: spin 1s linear infinite; margin-right: 8px;"><circle cx="12" cy="12" r="10" /></svg> Getting link...';
                statusDiv.textContent = '';
                statusDiv.className = 'invite-link-status';
                
                try {
                    const inviteLink = await groupChat.getGroupInviteLink(groupId);
                    
                    await navigator.clipboard.writeText(inviteLink);
                    
                    copyBtn.innerHTML = '<svg class="feather" data-feather="check" style="margin-right: 8px;"><polyline points="20 6 9 17 4 12"></polyline></svg> Link Copied!';
                    copyBtn.classList.add('copied');
                    
                    statusDiv.textContent = 'Invite link copied to clipboard!';
                    statusDiv.classList.add('success');
                    
                    copyBtn.title = `Link: ${inviteLink}`;
                    
                    setTimeout(() => {
                        copyBtn.innerHTML = '<svg class="feather" data-feather="link" style="width: 16px; height: 16px; margin-right: 8px;"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg> Copy Invite Link';
                        copyBtn.classList.remove('copied');
                        copyBtn.disabled = false;
                        statusDiv.textContent = 'Share this link to invite others';
                        statusDiv.className = 'invite-link-status';
                        isCopying = false;
                    }, 3000);
                    
                } catch (error) {
                    console.error('Error copying invite link:', error);
                    
                    copyBtn.innerHTML = '<svg class="feather" data-feather="alert-triangle" style="margin-right: 8px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg> Error';
                    copyBtn.disabled = false;
                    
                    statusDiv.textContent = 'Failed to copy link. Please try again.';
                    statusDiv.classList.add('error');
                    
                    setTimeout(() => {
                        copyBtn.innerHTML = '<svg class="feather" data-feather="link" style="width: 16px; height: 16px; margin-right: 8px;"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg> Copy Invite Link';
                        statusDiv.textContent = '';
                        statusDiv.className = 'invite-link-status';
                        isCopying = false;
                    }, 3000);
                }
            });
            
            document.addEventListener('keydown', (e) => {
                if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'L') {
                    e.preventDefault();
                    copyBtn.click();
                }
            });
            
            copyBtn.title = 'Click to copy invite link (Ctrl+Shift+L)';
        }
    }
    
    function createSidebarOverlay() {
        removeSidebarOverlay();
        
        const overlay = document.createElement('div');
        overlay.id = 'sidebarOverlay';
        overlay.className = 'sidebar-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            z-index: 999;
            display: block;
        `;
        
        overlay.addEventListener('click', () => {
            if (sidebar) {
                sidebar.classList.remove('active');
                removeSidebarOverlay();
            }
        });
        
        document.body.appendChild(overlay);
    }
    
    function removeSidebarOverlay() {
        const overlay = document.getElementById('sidebarOverlay');
        if (overlay) {
            overlay.remove();
        }
    }
    
    function setupListeners() {
        // Clear any existing listeners first
        if (groupChat.areListenersSetup) {
            groupChat.cleanup();
            reactionUnsubscribers.forEach(unsub => unsub());
            reactionUnsubscribers.clear();
        }
        
        // UPDATED: Clear typing listener
        if (typingUnsubscribe) {
            typingUnsubscribe();
        }
        
        // Set up new listeners
        groupChat.listenToMessages(groupId, (newMessages) => {
            console.log('Received messages:', newMessages.length);
            
            const uniqueMessages = [];
            const seenIds = new Set();
            
            newMessages.forEach(msg => {
                if (!seenIds.has(msg.id)) {
                    seenIds.add(msg.id);
                    uniqueMessages.push(msg);
                }
            });
            
            tempMessages.forEach((tempMsg, tempId) => {
                if (!uniqueMessages.some(m => m.id === tempId)) {
                    uniqueMessages.push(tempMsg);
                }
            });
            
            messages = uniqueMessages;
            
            setupReactionListeners();
            
            queueRender();
        });
        
        groupChat.listenToMembers(groupId, (newMembers) => {
            members = newMembers;
            updateMembersList();
            
            if (groupData) {
                groupData.memberCount = newMembers.length;
                if (groupMembersCount) {
                    groupMembersCount.textContent = `${newMembers.length} members`;
                }
            }
        });
        
        // UPDATED: Set up typing indicator listener
        typingUnsubscribe = groupChat.listenToTyping(groupId, (typingUsers) => {
            updateTypingIndicator(typingUsers);
        });
        
        const activeInterval = setInterval(() => {
            groupChat.updateLastActive(groupId);
        }, 60000);
        
        window.addEventListener('focus', () => {
            groupChat.updateLastActive(groupId);
        });
        
        window.addEventListener('beforeunload', () => {
            clearInterval(activeInterval);
            reactionUnsubscribers.forEach(unsub => unsub());
            reactionUnsubscribers.clear();
            
            // UPDATED: Clean up typing
            if (typingUnsubscribe) {
                typingUnsubscribe();
            }
            if (typingTimeout) {
                clearTimeout(typingTimeout);
            }
            
            removeSidebarOverlay();
        });
        
        groupChat.areListenersSetup = true;
    }
    
    function updateMembersList() {
        if (!membersList) return;
        
        membersList.innerHTML = '';
        
        if (members.length === 0) {
            membersList.innerHTML = '<p style="color: var(--text-light); font-size: 0.9rem;">No members yet</p>';
            return;
        }
        
        members.forEach(member => {
            const isOnline = member.lastActive && 
                (Date.now() - new Date(member.lastActive).getTime()) < 300000;
            
            const isAdmin = member.role === 'creator';
            const isCurrentUser = member.id === groupChat.firebaseUser?.uid;
            
            // Get user profile for reward tag
            const userProfile = groupChat.cache.userProfiles ? 
                groupChat.cache.userProfiles.get(`user_${member.id}`)?.data : null;
            
            const rewardTag = userProfile?.rewardTag || '';
            
            const div = document.createElement('div');
            div.className = 'member-item';
            
            div.innerHTML = `
                <div class="member-avatar-container" style="position: relative;">
                    ${userProfile?.fireRing ? '<div class="fire-ring"></div>' : ''}
                    <img src="${member.avatar}" alt="${member.name}" class="member-avatar ${userProfile?.fireRing ? 'avatar-with-fire-ring' : ''}" data-user-id="${member.id}">
                </div>
                <div class="member-info">
                    <div class="member-name">
                        ${member.name}
                        ${isAdmin ? '<span style="margin-left: 6px; background: var(--primary); color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px;">Admin</span>' : ''}
                        ${isCurrentUser ? '<span style="margin-left: 6px; background: #666; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px;">You</span>' : ''}
                        ${rewardTag ? `<span class="reward-tag">${rewardTag}</span>` : ''}
                    </div>
                    ${member.bio ? `<div class="member-bio">${member.bio}</div>` : ''}
                </div>
                <div class="member-status ${isOnline ? 'online' : ''}"></div>
            `;
            
            membersList.appendChild(div);
        });
        
        document.querySelectorAll('.member-avatar').forEach(avatar => {
            avatar.addEventListener('click', (e) => {
                const userId = e.target.dataset.userId;
                if (userId && userId !== groupChat.firebaseUser?.uid) {
                    window.open(`user.html?id=${userId}`, '_blank');
                }
            });
        });
    }
    
    function displayMessages() {
        if (!messagesContainer) return;
        
        if (messages.length === 0) {
            if (noMessages) noMessages.style.display = 'block';
            messagesContainer.innerHTML = '';
            return;
        }
        
        if (noMessages) noMessages.style.display = 'none';
        
        window.currentMessages = messages;
        
        // Only update if there are new messages that haven't been rendered
        const newMessages = messages.filter(msg => !renderedMessageIds.has(msg.id));
        
        if (newMessages.length === 0) {
            return; // No new messages to render
        }
        
        // Track which messages we've rendered
        newMessages.forEach(msg => renderedMessageIds.add(msg.id));
        
        // Use DocumentFragment for efficient DOM updates
        const fragment = document.createDocumentFragment();
        
        // Group new messages by sender and time
        const groupedMessages = [];
        let currentGroup = null;
        
        newMessages.forEach((message, index) => {
            const messageTime = message.timestamp ? new Date(message.timestamp) : new Date();
            const prevMessage = index > 0 ? newMessages[index - 1] : null;
            const prevTime = prevMessage && prevMessage.timestamp ? new Date(prevMessage.timestamp) : new Date(0);
            
            const timeDiff = Math.abs(messageTime - prevTime) / (1000 * 60);
            
            if (!prevMessage || 
                prevMessage.senderId !== message.senderId || 
                timeDiff > 5) {
                currentGroup = {
                    senderId: message.senderId,
                    senderName: message.senderName,
                    senderAvatar: message.senderAvatar,
                    messages: [message]
                };
                groupedMessages.push(currentGroup);
            } else {
                currentGroup.messages.push(message);
            }
        });
        
        groupedMessages.forEach(group => {
            const groupDiv = document.createElement('div');
            groupDiv.className = 'message-group';
            groupDiv.dataset.senderId = group.senderId;
            
            const firstMessage = group.messages[0];
            const firstMessageTime = firstMessage.timestamp ? new Date(firstMessage.timestamp) : new Date();
            
            // Get user profile for reward tag
            const userProfile = groupChat.cache.userProfiles ? 
                groupChat.cache.userProfiles.get(`user_${group.senderId}`)?.data : null;
            
            const rewardTag = userProfile?.rewardTag || '';
            const hasFireRing = userProfile?.fireRing || false;
            
            groupDiv.innerHTML = `
                <div class="message-header">
                    <div class="message-avatar-container" style="position: relative; display: inline-block;">
                        ${hasFireRing ? '<div class="fire-ring"></div>' : ''}
                        <img src="${group.senderAvatar}" 
                             alt="${group.senderName}" 
                             class="message-avatar ${hasFireRing ? 'avatar-with-fire-ring' : ''}"
                             data-user-id="${group.senderId}">
                    </div>
                    <div class="message-sender-info">
                        <span class="message-sender">${group.senderName}</span>
                        ${rewardTag ? `<span class="reward-tag">${rewardTag}</span>` : ''}
                    </div>
                    <span class="message-time">${formatTime(firstMessageTime)}</span>
                </div>
                <div class="message-content">
                    ${group.messages.map(msg => {
                        const messageTime = msg.timestamp ? new Date(msg.timestamp) : new Date();
                        
                        let replyHtml = '';
                        if (msg.replyTo) {
                            const repliedMessage = messages.find(m => m.id === msg.replyTo);
                            if (repliedMessage) {
                                const truncatedName = groupChat.truncateName(repliedMessage.senderName);
                                const truncatedMessage = repliedMessage.text ? 
                                    groupChat.truncateMessage(repliedMessage.text) : 
                                    (repliedMessage.imageUrl ? '📷 Image' : repliedMessage.videoUrl ? '🎬 Video' : '');
                                
                                replyHtml = `
                                    <div class="replying-to">
                                        <span class="reply-label">Replying to</span> 
                                        <span class="reply-sender">${truncatedName}</span>
                                        <span class="reply-separator">:</span> 
                                        <span class="reply-message">${truncatedMessage}</span>
                                    </div>
                                `;
                            }
                        }
                        
                        const isTemp = tempMessages.has(msg.id);
                        const isUploading = msg.status === 'uploading';
                        
                        const messageDivClass = msg.type === 'system' ? 'system-message' : 'message-text';
                        
                        // UPDATED: Add soft glowing effect class if message has glowEffect
                        const hasGlowEffect = msg.glowEffect || false;
                        const extraClasses = hasGlowEffect ? ' glowing-message' : '';
                        
                        // Check if this is a reward upgrade message
                        const isRewardUpgrade = msg.rewardUpgrade || false;
                        const rewardUpgradeClass = isRewardUpgrade ? ' reward-upgrade' : '';
                        
                        let messageContent = '';
                        
                        if (msg.imageUrl) {
                            messageContent = `
                                <div class="message-image-container" style="position: relative;">
                                    <img src="${msg.imageUrl}" 
                                         alt="Shared image" 
                                         class="message-image"
                                         style="max-width: 250px; max-height: 250px; border-radius: 8px; cursor: pointer; width: 100%; height: auto;"
                                         onload="this.style.opacity='1';"
                                         onerror="this.style.display='none';"
                                         onclick="openImageModal('${msg.imageUrl}')">
                                    ${isUploading ? `
                                        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                                               background: rgba(0,0,0,0.7); color: white; padding: 8px 12px; border-radius: 20px;
                                               font-size: 12px; display: flex; align-items: center; gap: 6px;">
                                            <svg class="feather" data-feather="loader" style="animation: spin 1s linear infinite; width: 14px; height: 14px;">
                                                <circle cx="12" cy="12" r="10" />
                                            </svg>
                                            Uploading...
                                        </div>
                                    ` : ''}
                                </div>
                            `;
                        } else if (msg.videoUrl) {
                            messageContent = `
                                <div class="message-video-container" style="position: relative;">
                                    <video controls style="max-width: 250px; max-height: 250px; border-radius: 8px; width: 100%; height: auto;"
                                           onload="this.style.opacity='1';"
                                           onerror="this.style.display='none';">
                                        <source src="${msg.videoUrl}" type="video/mp4">
                                        Your browser does not support the video tag.
                                    </video>
                                    ${isUploading ? `
                                        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                                               background: rgba(0,0,0,0.7); color: white; padding: 8px 12px; border-radius: 20px;
                                               font-size: 12px; display: flex; align-items: center; gap: 6px;">
                                            <svg class="feather" data-feather="loader" style="animation: spin 1s linear infinite; width: 14px; height: 14px;">
                                                <circle cx="12" cy="12" r="10" />
                                            </svg>
                                            Uploading...
                                        </div>
                                    ` : ''}
                                </div>
                            `;
                        } else if (msg.type === 'system') {
                            messageContent = `
                                <div style="font-style: italic; color: #666; text-align: center; padding: 4px 0;">
                                    ${msg.text}
                                </div>
                            `;
                        } else {
                            messageContent = msg.text || '';
                        }
                        
                        const messageDivId = `message-${msg.id}`;
                        
                        const cachedReactions = reactionsCache.get(msg.id) || [];
                        
                        // UPDATED: Add sending indicator on message (not on button)
                        const sendingIndicator = isTemp ? 
                            `<div class="sending-indicator" id="sending-${msg.id}">
                                <svg class="feather" data-feather="loader" style="animation: spin 1s linear infinite; width: 12px; height: 12px;">
                                    <circle cx="12" cy="12" r="10" />
                                </svg>
                                <span>Sending...</span>
                            </div>` : 
                            '';
                        
                        return `
                            <div class="${messageDivClass}${extraClasses}${rewardUpgradeClass}" data-message-id="${msg.id}" id="${messageDivId}">
                                ${replyHtml}
                                ${messageContent}
                                <div class="message-reactions" id="reactions-${msg.id}">
                                    ${cachedReactions.map(reaction => {
                                        const hasUserReacted = reaction.users && reaction.users.includes(groupChat.firebaseUser?.uid);
                                        return `
                                            <div class="reaction-bubble ${hasUserReacted ? 'user-reacted' : ''}" data-emoji="${reaction.emoji}">
                                                <span class="reaction-emoji">${reaction.emoji}</span>
                                                <span class="reaction-count">${reaction.count}</span>
                                            </div>
                                        `;
                                    }).join('')}
                                    <div class="reaction-bubble add-reaction" style="opacity: 0; pointer-events: none; padding: 0; width: 0; height: 0;">
                                        +
                                    </div>
                                </div>
                                ${sendingIndicator}
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
            
            fragment.appendChild(groupDiv);
        });
        
        // Append new messages to the container (don't clear existing ones)
        messagesContainer.appendChild(fragment);
        
        // Remove sending indicators for messages that are no longer temp
        document.querySelectorAll('.sending-indicator').forEach(indicator => {
            const messageId = indicator.id.replace('sending-', '');
            if (!tempMessages.has(messageId)) {
                indicator.remove();
            }
        });
        
        document.querySelectorAll('.message-avatar').forEach(avatar => {
            avatar.addEventListener('click', (e) => {
                const userId = e.target.dataset.userId;
                if (userId && userId !== groupChat.firebaseUser?.uid) {
                    window.open(`user.html?id=${userId}`, '_blank');
                }
            });
        });
        
        document.querySelectorAll('.reaction-bubble').forEach(bubble => {
            bubble.addEventListener('click', (e) => {
                if (e.currentTarget.classList.contains('add-reaction')) {
                    return;
                }
                const messageElement = e.target.closest('.message-text, .system-message');
                if (messageElement) {
                    const messageId = messageElement.dataset.messageId;
                    const message = messages.find(m => m.id === messageId);
                    if (message) {
                        const emoji = e.currentTarget.dataset.emoji;
                        groupChat.currentMessageForReaction = message;
                        groupChat.addReactionToMessage(emoji);
                    }
                }
            });
        });
        
        document.querySelectorAll('.message-text, .system-message').forEach(messageElement => {
            let longPressTimer;
            const messageId = messageElement.dataset.messageId;
            const message = messages.find(m => m.id === messageId);
            
            if (message) {
                messageElement.addEventListener('touchstart', (e) => {
                    longPressTimer = setTimeout(() => {
                        groupChat.showReactionModal(message);
                    }, 500);
                });
                
                messageElement.addEventListener('touchend', () => {
                    clearTimeout(longPressTimer);
                });
                
                messageElement.addEventListener('touchmove', () => {
                    clearTimeout(longPressTimer);
                });
                
                messageElement.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    groupChat.showReactionModal(message);
                });
            }
        });
        
        groupChat.setupSwipeToReply(messagesContainer);
        
        setupReactionListeners();
        
        // Scroll to bottom after rendering
        setTimeout(() => {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }, 50);
    }
    
    function setupReactionListeners() {
        messages.forEach(message => {
            if (reactionUnsubscribers.has(message.id)) {
                return;
            }
            
            const unsubscribe = groupChat.listenToMessageReactions(groupId, message.id, (reactions) => {
                reactionsCache.set(message.id, reactions);
                const reactionsContainer = document.getElementById(`reactions-${message.id}`);
                if (reactionsContainer) {
                    updateReactionsDisplay(reactionsContainer, reactions, message.id);
                }
            });
            
            reactionUnsubscribers.set(message.id, unsubscribe);
        });
    }
    
    function updateReactionsDisplay(container, reactions, messageId) {
        container.innerHTML = '';
        
        reactions.forEach(reaction => {
            const hasUserReacted = reaction.users && reaction.users.includes(groupChat.firebaseUser?.uid);
            const bubble = document.createElement('div');
            bubble.className = `reaction-bubble ${hasUserReacted ? 'user-reacted' : ''}`;
            bubble.dataset.emoji = reaction.emoji;
            bubble.innerHTML = `
                <span class="reaction-emoji">${reaction.emoji}</span>
                <span class="reaction-count">${reaction.count}</span>
            `;
            
            bubble.addEventListener('click', () => {
                const message = messages.find(m => m.id === messageId);
                if (message) {
                    groupChat.currentMessageForReaction = message;
                    groupChat.addReactionToMessage(reaction.emoji);
                }
            });
            
            container.appendChild(bubble);
        });
        
        const emptyBubble = document.createElement('div');
        emptyBubble.className = 'reaction-bubble add-reaction';
        emptyBubble.style.cssText = 'opacity: 0; pointer-events: none; padding: 0; width: 0; height: 0;';
        emptyBubble.innerHTML = '+';
        container.appendChild(emptyBubble);
    }
    
    async function sendMessage() {
        const text = messageInput.value.trim();
        
        if (!text) return;
        
        // UPDATED: Clear typing timeout before sending
        if (typingTimeout) {
            clearTimeout(typingTimeout);
        }
        
        // Stop typing indicator
        await groupChat.stopTyping(groupId);
        
        // FIXED: Send button always shows airplane icon, no loader
        // We only disable it temporarily to prevent double sends
        const originalHTML = sendBtn.innerHTML;
        const originalDisabled = sendBtn.disabled;
        sendBtn.disabled = true;
        
        try {
            await groupChat.sendMessage(groupId, text, null, null, groupChat.replyingToMessage?.id);
            
            messageInput.value = '';
            messageInput.style.height = 'auto';
            messageInput.dispatchEvent(new Event('input'));
            
            // Clear the reply indicator after sending
            groupChat.clearReply();
            
        } catch (error) {
            console.error('Error sending message:', error);
            alert(error.message || 'Failed to send message. Please try again.');
        } finally {
            // FIXED: Always restore airplane icon immediately
            sendBtn.disabled = originalDisabled;
            sendBtn.innerHTML = originalHTML;
        }
    }
    
    function formatTime(date) {
        if (!(date instanceof Date)) {
            date = new Date(date);
        }
        
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffDays > 0) {
            return `${diffDays}d ago`;
        } else if (diffHours > 0) {
            return `${diffHours}h ago`;
        } else if (diffMins > 0) {
            return `${diffMins}m ago`;
        } else {
            return 'just now';
        }
    }
    
    window.addEventListener('beforeunload', () => {
        groupChat.cleanup();
        reactionUnsubscribers.forEach(unsub => unsub());
        reactionUnsubscribers.clear();
        
        // UPDATED: Clean up typing
        if (typingUnsubscribe) {
            typingUnsubscribe();
        }
        if (typingTimeout) {
            clearTimeout(typingTimeout);
        }
        
        removeSidebarOverlay();
    });
    
    window.openImageModal = function(imageUrl) {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.9);
            z-index: 10000;
            display: flex;
            justify-content: center;
            align-items: center;
        `;
        
        modal.innerHTML = `
            <div style="position: relative; max-width: 90%; max-height: 90%;">
                <img src="${imageUrl}" alt="Full size" style="max-width: 100%; max-height: 90vh; border-radius: 8px;">
                <button style="position: absolute; top: 20px; right: 20px; background: rgba(0,0,0,0.5); color: white; 
                        border: none; border-radius: 50%; width: 40px; height: 40px; font-size: 20px; cursor: pointer;">
                    ×
                </button>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        modal.querySelector('button').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    };
}

function initAdminGroupsPage() {
    console.log('Initializing Admin Groups Page...');
    
    if (!groupChat.firebaseUser) {
        window.location.href = 'login.html';
        return;
    }
    
    loadAdminGroups();
    
    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.location.href = 'dashboard.html';
        });
    }
    
    const createGroupBtn = document.getElementById('createGroupBtn');
    if (createGroupBtn) {
        createGroupBtn.addEventListener('click', () => {
            window.location.href = 'create-group.html';
        });
    }
    
    async function loadAdminGroups() {
        try {
            console.log('Loading admin groups...');
            
            const groupsList = document.getElementById('groupsList');
            if (groupsList) {
                groupsList.innerHTML = '<div class="loading">Loading your groups...</div>';
            }
            
            const groups = await groupChat.getAdminGroups();
            
            console.log('Admin groups loaded:', groups.length);
            
            if (groups.length === 0) {
                if (groupsList) {
                    groupsList.innerHTML = `
                        <div class="empty-state">
                            <svg class="feather" data-feather="users" style="width: 48px; height: 48px; margin-bottom: 16px;">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                <circle cx="9" cy="7" r="4"></circle>
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                            </svg>
                            <h3>No Groups Created Yet</h3>
                            <p>You haven't created any groups yet. Create your first group to get started!</p>
                            <button id="createFirstGroupBtn" class="primary-btn">
                                <svg class="feather" data-feather="plus" style="width: 16px; height: 16px; margin-right: 8px;">
                                    <line x1="12" y1="5" x2="12" y2="19"></line>
                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                </svg>
                                Create Your First Group
                            </button>
                        </div>
                    `;
                    
                    const createFirstGroupBtn = document.getElementById('createFirstGroupBtn');
                    if (createFirstGroupBtn) {
                        createFirstGroupBtn.addEventListener('click', () => {
                            window.location.href = 'create-group.html';
                        });
                    }
                }
                return;
            }
            
            displayGroups(groups);
            
        } catch (error) {
            console.error('Error loading admin groups:', error);
            
            const groupsList = document.getElementById('groupsList');
            if (groupsList) {
                groupsList.innerHTML = `
                    <div class="error-state">
                        <svg class="feather" data-feather="alert-triangle" style="width: 48px; height: 48px; margin-bottom: 16px; color: #ff6b6b;">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                            <line x1="12" y1="9" x2="12" y2="13"></line>
                            <line x1="12" y1="17" x2="12.01" y2="17"></line>
                        </svg>
                        <h3>Error Loading Groups</h3>
                        <p>${error.message || 'Failed to load groups. Please try again.'}</p>
                        <button onclick="location.reload()" class="primary-btn">
                            <svg class="feather" data-feather="refresh-cw" style="width: 16px; height: 16px; margin-right: 8px;">
                                <polyline points="23 4 23 10 17 10"></polyline>
                                <polyline points="1 20 1 14 7 14"></polyline>
                                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                        </svg>
                            Retry
                        </button>
                    </div>
                `;
            }
        }
    }
    
    function generateGroupAvatar(group) {
        if (group.photoUrl) {
            return group.photoUrl;
        }
        const seed = encodeURIComponent(group.name);
        return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&backgroundColor=00897b&backgroundType=gradientLinear`;
    }
    
    function displayGroups(groups) {
        const groupsList = document.getElementById('groupsList');
        if (!groupsList) return;
        
        groupsList.innerHTML = '';
        
        groups.forEach(group => {
            const groupCard = document.createElement('div');
            groupCard.className = 'group-card';
            
            const groupAvatar = generateGroupAvatar(group);
            
            const createdAt = group.createdAt ? 
                new Date(group.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                }) : 'Unknown';
            
            groupCard.innerHTML = `
                <div class="group-header">
                    <div class="group-info">
                        <img src="${groupAvatar}" alt="${group.name}" class="group-avatar">
                        <div class="group-details">
                            <h3>${group.name}</h3>
                            <p class="group-description">${group.description || 'No description'}</p>
                            <div class="group-meta">
                                <span class="group-members">
                                    <svg class="feather" data-feather="users" style="width: 14px; height: 14px; margin-right: 4px;">
                                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                        <circle cx="9" cy="7" r="4"></circle>
                                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                                    </svg>
                                    ${group.memberCount || 0} members
                                </span>
                                <span class="group-date">
                                    <svg class="feather" data-feather="calendar" style="width: 14px; height: 14px; margin-right: 4px;">
                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                        <line x1="16" y1="2" x2="16" y2="6"></line>
                                        <line x1="8" y1="2" x2="8" y2="6"></line>
                                        <line x1="3" y1="10" x2="21" y2="10"></line>
                                    </svg>
                                    Created ${createdAt}
                                </span>
                                <span class="group-privacy">
                                    <svg class="feather" data-feather="${group.privacy === 'private' ? 'lock' : 'globe'}" style="width: 14px; height: 14px; margin-right: 4px;">
                                        ${group.privacy === 'private' ? 
                                            '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>' : 
                                            '<circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1 4-10z"></path>'
                                        }
                                    </svg>
                                    ${group.privacy === 'private' ? 'Private' : 'Public'}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div class="group-actions">
                        <button class="view-group-btn" onclick="window.location.href='group.html?id=${group.id}'">
                            <svg class="feather" data-feather="message-circle" style="width: 14px; height: 14px; margin-right: 6px;">
                                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                            </svg>
                            View Chat
                        </button>
                        <button class="invite-link-admin-btn" onclick="copyGroupInviteLink('${group.id}')">
                            <svg class="feather" data-feather="link" style="width: 14px; height: 14px; margin-right: 6px;">
                                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                            </svg>
                            Copy Invite
                        </button>
                        <button class="manage-members-btn" onclick="viewGroupMembers('${group.id}', '${group.name.replace(/'/g, "\\'")}')">
                            <svg class="feather" data-feather="users" style="width: 14px; height: 14px; margin-right: 6px;">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                <circle cx="9" cy="7" r="4"></circle>
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                            </svg>
                            Manage Members
                        </button>
                        <button class="delete-group-btn" onclick="confirmDeleteGroup('${group.id}', '${group.name.replace(/'/g, "\\'")}')">
                            <svg class="feather" data-feather="trash-2" style="width: 14px; height: 14px; margin-right: 6px;">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
                                <line x1="10" y1="11" x2="10" y2="17"></line>
                                <line x1="14" y1="11" x2="14" y2="17"></line>
                            </svg>
                            Delete
                        </button>
                    </div>
                </div>
            `;
            
            groupsList.appendChild(groupCard);
        });
        
        if (!document.getElementById('admin-btn-styles')) {
            const styles = document.createElement('style');
            styles.id = 'admin-btn-styles';
            styles.textContent = `
                .invite-link-admin-btn {
                    background: linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%);
                    color: white;
                    border: none;
                    padding: 8px 12px;
                    border-radius: 6px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 14px;
                }
                
                .invite-link-admin-btn:hover {
                    opacity: 0.9;
                }
            `;
            document.head.appendChild(styles);
        }
    }
    
    window.copyGroupInviteLink = async function(groupId) {
        try {
            const originalText = event?.target?.innerHTML || 'Copy Invite';
            if (event?.target) {
                event.target.innerHTML = '<svg class="feather" data-feather="loader" style="animation: spin 1s linear infinite; width: 14px; height: 14px;"><circle cx="12" cy="12" r="10" /></svg>';
                event.target.disabled = true;
            }
            
            const inviteLink = await groupChat.getGroupInviteLink(groupId);
            
            navigator.clipboard.writeText(inviteLink);
            
            alert('Invite link copied to clipboard!\n\nShare this link to invite others to join your group.');
            
            if (event?.target) {
                event.target.innerHTML = originalText;
                event.target.disabled = false;
            }
            
        } catch (error) {
            console.error('Error copying invite link:', error);
            alert('Error getting invite link: ' + error.message);
            
            if (event?.target) {
                event.target.innerHTML = originalText;
                event.target.disabled = false;
            }
        }
    };
    
    window.viewGroupMembers = async function(groupId, groupName) {
        try {
            const membersList = document.getElementById('membersList');
            const membersTitle = document.getElementById('membersTitle');
            const groupsContainer = document.getElementById('groupsContainer');
            const membersSection = document.getElementById('membersSection');
            
            if (membersTitle) {
                membersTitle.textContent = `Members of ${groupName}`;
            }
            
            if (membersList) {
                membersList.innerHTML = '<div class="loading">Loading members...</div>';
            }
            
            const members = await groupChat.getGroupMembersWithDetails(groupId);
            
            if (membersList) {
                membersList.innerHTML = '';
                
                if (members.length === 0) {
                    membersList.innerHTML = '<div class="empty-state">No members in this group</div>';
                } else {
                    members.forEach(member => {
                        const memberItem = document.createElement('div');
                        memberItem.className = 'member-item';
                        
                        const isCurrentUser = member.id === groupChat.firebaseUser.uid;
                        const isAdmin = member.isAdmin;
                        
                        // Get user profile for reward tag
                        const userProfile = groupChat.cache.userProfiles ? 
                            groupChat.cache.userProfiles.get(`user_${member.id}`)?.data : null;
                        
                        const rewardTag = userProfile?.rewardTag || '';
                        
                        memberItem.innerHTML = `
                            <div class="member-info">
                                <div class="member-avatar-container" style="position: relative; display: inline-block;">
                                    ${userProfile?.fireRing ? '<div class="fire-ring"></div>' : ''}
                                    <img src="${member.avatar || AVATAR_OPTIONS[0]}" 
                                         alt="${member.name}" 
                                         class="member-avatar ${userProfile?.fireRing ? 'avatar-with-fire-ring' : ''}">
                                </div>
                                <div class="member-details">
                                    <h4>
                                        ${member.name}
                                        ${isAdmin ? '<span class="admin-badge">Admin</span>' : ''}
                                        ${isCurrentUser ? '<span class="you-badge">You</span>' : ''}
                                        ${rewardTag ? `<span class="reward-tag">${rewardTag}</span>` : ''}
                                    </h4>
                                    <p class="member-email">${member.email || 'No email'}</p>
                                    <small class="member-joined">
                                        Joined: ${member.joinedAt ? 
                                            new Date(member.joinedAt).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric'
                                            }) : 'Unknown'}
                                    </small>
                                </div>
                            </div>
                            <div class="member-actions">
                                ${!isAdmin && !isCurrentUser ? `
                                    <button class="remove-member-btn" 
                                            onclick="confirmRemoveMember('${groupId}', '${member.id}', '${member.name.replace(/'/g, "\\'")}')">
                                        <svg class="feather" data-feather="user-minus" style="width: 14px; height: 14px; margin-right: 6px;">
                                            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                            <circle cx="8.5" cy="7" r="4"></circle>
                                            <line x1="23" y1="11" x2="17" y2="11"></line>
                                        </svg>
                                        Remove
                                    </button>
                                ` : ''}
                            </div>
                        `;
                        
                        membersList.appendChild(memberItem);
                    });
                }
            }
            
            if (groupsContainer && membersSection) {
                groupsContainer.style.display = 'none';
                membersSection.style.display = 'block';
            }
            
            const backToGroupsBtn = document.getElementById('backToGroupsBtn');
            if (backToGroupsBtn) {
                backToGroupsBtn.onclick = showGroupsSection;
            }
            
        } catch (error) {
            console.error('Error loading members:', error);
            alert('Error loading members: ' + error.message);
        }
    };
    
    function showGroupsSection() {
        const groupsContainer = document.getElementById('groupsContainer');
        const membersSection = document.getElementById('membersSection');
        
        if (groupsContainer && membersSection) {
            groupsContainer.style.display = 'block';
            membersSection.style.display = 'none';
        }
    }
    
    window.confirmDeleteGroup = function(groupId, groupName) {
        if (confirm(`Are you sure you want to delete the group "${groupName}"?\n\nThis action cannot be undone. All messages and member data will be permanently deleted.`)) {
            deleteGroup(groupId, groupName);
        }
    };
    
    async function deleteGroup(groupId, groupName) {
        try {
            if (!confirm(`Final warning: This will delete "${groupName}" permanently. Continue?`)) {
                return;
            }
            
            const originalText = event?.target?.innerHTML || 'Delete';
            if (event?.target) {
                event.target.innerHTML = '<svg class="feather" data-feather="loader" style="animation: spin 1s linear infinite; width: 14px; height: 14px; margin-right: 6px;"><circle cx="12" cy="12" r="10" /></svg> Deleting...';
                event.target.disabled = true;
            }
            
            await groupChat.deleteGroup(groupId);
            
            alert(`Group "${groupName}" has been deleted successfully.`);
            
            loadAdminGroups();
            
        } catch (error) {
            console.error('Error deleting group:', error);
            alert('Error deleting group: ' + error.message);
            
            if (event?.target) {
                event.target.innerHTML = originalText;
                event.target.disabled = false;
            }
        }
    }
    
    window.confirmRemoveMember = function(groupId, memberId, memberName) {
        if (confirm(`Are you sure you want to remove "${memberName}" from this group?\n\nThey will be notified and will lose access to all group messages. They will also be blocked from rejoining.`)) {
            removeMember(groupId, memberId, memberName);
        }
    };
    
    async function removeMember(groupId, memberId, memberName) {
        try {
            const originalText = event?.target?.innerHTML || 'Remove';
            if (event?.target) {
                event.target.innerHTML = '<svg class="feather" data-feather="loader" style="animation: spin 1s linear infinite; width: 14px; height: 14px; margin-right: 6px;"><circle cx="12" cy="12" r="10" /></svg> Removing...';
                event.target.disabled = true;
            }
            
            await groupChat.removeMemberFromGroup(groupId, memberId, memberName);
            
            alert(`"${memberName}" has been removed from the group and blocked from rejoining.`);
            
            const groupName = document.getElementById('membersTitle')?.textContent.replace('Members of ', '') || '';
            viewGroupMembers(groupId, groupName);
            
        } catch (error) {
            console.error('Error removing member:', error);
            alert('Error removing member: ' + error.message);
            
            if (event?.target) {
                event.target.innerHTML = originalText;
                event.target.disabled = false;
            }
        }
    }
}

function initJoinPage() {
    console.log('Join page initialized');
    
    const joinContainer = document.getElementById('joinContainer');
    const groupInfo = document.getElementById('groupInfo');
    const joinBtn = document.getElementById('joinBtn');
    const backBtn = document.getElementById('backBtn');
    const errorNotification = document.getElementById('errorNotification');
    
    const urlParams = new URLSearchParams(window.location.search);
    const inviteCode = urlParams.get('code');
    
    if (!inviteCode) {
        showError('Invalid invite link. No invitation code found. Please check the link and try again.');
        return;
    }
    
    console.log('Invite code found:', inviteCode);
    
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }
    
    loadGroupByInviteCode(inviteCode);
    
    async function loadGroupByInviteCode(inviteCode) {
        try {
            if (groupInfo) {
                groupInfo.innerHTML = `
                    <div class="loading-state">
                        <div class="spinner"></div>
                        <p>Loading group information...</p>
                    </div>
                `;
            }
            
            console.log('Fetching group with invite code:', inviteCode);
            
            const group = await groupChat.getGroupByInviteCode(inviteCode);
            
            if (!group) {
                showError('Invalid or expired invite link. The group may have been deleted or the invite code is incorrect.');
                return;
            }
            
            console.log('Group found:', group.name);
            
            const groupAvatar = group.photoUrl || 
                `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(group.name)}&backgroundColor=00897b&backgroundType=gradientLinear`;
            
            const memberCount = group.memberCount || 0;
            const maxMembers = group.maxMembers || 1000;
            const memberPercentage = Math.round((memberCount / maxMembers) * 100);
            
            if (groupInfo) {
                groupInfo.innerHTML = `
                    <div class="group-card">
                        <div class="group-header">
                            <div class="group-avatar-section">
                                <img src="${groupAvatar}" alt="${group.name}" class="group-avatar-large">
                                <div class="group-title-section">
                                    <h2 class="group-name">${group.name}</h2>
                                    <div class="group-meta">
                                        <span class="group-category">${group.category || 'General'}</span>
                                        <span class="group-privacy-badge ${group.privacy === 'private' ? 'private' : 'public'}">
                                            <svg class="feather" data-feather="${group.privacy === 'private' ? 'lock' : 'globe'}" style="width: 14px; height: 14px; margin-right: 4px;">
                                                ${group.privacy === 'private' ? 
                                                    '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>' : 
                                                    '<circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1 4-10z"></path>'
                                                }
                                            </svg>
                                            ${group.privacy === 'private' ? 'Private Group' : 'Public Group'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="group-description">
                                <p>${group.description || 'No description provided.'}</p>
                            </div>
                            
                            <div class="group-stats">
                                <div class="stat-item">
                                    <svg class="feather" data-feather="users" style="width: 24px; height: 24px; margin-right: 12px;">
                                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                        <circle cx="9" cy="7" r="4"></circle>
                                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                                    </svg>
                                    <div class="stat-content">
                                        <span class="stat-value">${memberCount}/${maxMembers}</span>
                                        <span class="stat-label">Members</span>
                                        <div class="progress-bar">
                                            <div class="progress-fill" style="width: ${memberPercentage}%"></div>
                                        </div>
                                        <span class="stat-percentage">${memberPercentage}% full</span>
                                    </div>
                                </div>
                                <div class="stat-item">
                                    <svg class="feather" data-feather="user" style="width: 24px; height: 24px; margin-right: 12px;">
                                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                        <circle cx="12" cy="7" r="4"></circle>
                                    </svg>
                                    <div class="stat-content">
                                        <span class="stat-value">${group.creatorName || 'Unknown'}</span>
                                        <span class="stat-label">Created by</span>
                                    </div>
                                </div>
                                <div class="stat-item">
                                    <svg class="feather" data-feather="calendar" style="width: 24px; height: 24px; margin-right: 12px;">
                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                        <line x1="16" y1="2" x2="16" y2="6"></line>
                                        <line x1="8" y1="2" x2="8" y2="6"></line>
                                        <line x1="3" y1="10" x2="21" y2="10"></line>
                                    </svg>
                                    <div class="stat-content">
                                        <span class="stat-value">${group.createdAt ? new Date(group.createdAt).toLocaleDateString() : 'Unknown'}</span>
                                        <span class="stat-label">Created on</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        ${group.topics && group.topics.length > 0 ? `
                            <div class="group-section">
                                <h3>
                                    <svg class="feather" data-feather="message-square" style="width: 18px; height: 18px; margin-right: 8px;">
                                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                                    </svg>
                                    Discussion Topics
                                </h3>
                                <div class="topics-grid">
                                    ${group.topics.map(topic => 
                                        `<span class="topic-chip">${topic}</span>`
                                    ).join('')}
                                </div>
                            </div>
                        ` : ''}
                        
                        ${group.rules && group.rules.length > 0 ? `
                            <div class="group-section">
                                <h3>
                                    <svg class="feather" data-feather="shield" style="width: 18px; height: 18px; margin-right: 8px;">
                                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                                    </svg>
                                    Group Rules
                                </h3>
                                <ul class="rules-list">
                                    ${group.rules.map(rule => 
                                        `<li>
                                            <svg class="feather" data-feather="check-circle" style="width: 16px; height: 16px; margin-right: 8px;">
                                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                                <polyline points="22 4 12 14.01 9 11.01"></polyline>
                                            </svg>
                                            ${rule}
                                        </li>`
                                    ).join('')}
                                </ul>
                            </div>
                        ` : ''}
                    </div>
                `;
            }
            
            if (joinBtn) {
                if (groupChat.firebaseUser) {
                    groupChat.isMember(group.id).then(isMember => {
                        if (isMember) {
                            joinBtn.innerHTML = `
                                <svg class="feather" data-feather="message-circle" style="width: 16px; height: 16px; margin-right: 8px;">
                                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                                </svg>
                                Enter Group Chat
                            `;
                            joinBtn.className = 'join-btn success';
                            joinBtn.onclick = () => {
                                window.location.href = `group.html?id=${group.id}`;
                            };
                        } else {
                            joinBtn.innerHTML = `
                                <svg class="feather" data-feather="log-in" style="width: 16px; height: 16px; margin-right: 8px;">
                                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                                    <polyline points="10 17 15 12 10 7"></polyline>
                                    <line x1="15" y1="12" x2="3" y2="12"></line>
                                </svg>
                                Join Group
                            `;
                            joinBtn.className = 'join-btn primary';
                            joinBtn.onclick = async () => {
                                await joinGroup(group.id);
                            };
                        }
                    }).catch(error => {
                        console.error('Error checking membership:', error);
                        joinBtn.innerHTML = `
                            <svg class="feather" data-feather="log-in" style="width: 16px; height: 16px; margin-right: 8px;">
                                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                                <polyline points="10 17 15 12 10 7"></polyline>
                                <line x1="15" y1="12" x2="3" y2="12"></line>
                            </svg>
                            Join Group
                        `;
                        joinBtn.className = 'join-btn primary';
                        joinBtn.onclick = async () => {
                            await joinGroup(group.id);
                        };
                    });
                } else {
                    joinBtn.innerHTML = `
                        <svg class="feather" data-feather="log-in" style="width: 16px; height: 16px; margin-right: 8px;">
                            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                            <polyline points="10 17 15 12 10 7"></polyline>
                            <line x1="15" y1="12" x2="3" y2="12"></line>
                        </svg>
                        Login to Join
                    `;
                    joinBtn.className = 'join-btn secondary';
                    joinBtn.onclick = () => {
                        sessionStorage.setItem('pendingInviteCode', inviteCode);
                        window.location.href = `login.html?redirect=join.html?code=${inviteCode}`;
                    };
                }
                
                joinBtn.style.display = 'block';
            }
            
        } catch (error) {
            console.error('Error loading group:', error);
            showError('Error loading group information. Please try again.', error);
        }
    }
    
    async function joinGroup(groupId) {
        try {
            if (!groupChat.firebaseUser) {
                showError('Please login to join the group');
                window.location.href = 'login.html';
                return;
            }
            
            const needsSetup = await groupChat.needsProfileSetup();
            if (needsSetup) {
                window.location.href = `set.html?id=${groupId}`;
                return;
            }
            
            if (joinBtn) {
                joinBtn.disabled = true;
                joinBtn.innerHTML = `
                    <svg class="feather" data-feather="loader" style="animation: spin 1s linear infinite; width: 16px; height: 16px; margin-right: 8px;">
                        <circle cx="12" cy="12" r="10" />
                    </svg>
                    Joining...
                `;
            }
            
            await groupChat.joinGroup(groupId);
            
            alert('Successfully joined the group!');
            
            window.location.href = `group.html?id=${groupId}`;
            
        } catch (error) {
            console.error('Error joining group:', error);
            showError('Error joining group: ' + error.message, error);
            
            if (joinBtn) {
                joinBtn.disabled = false;
                joinBtn.innerHTML = `
                    <svg class="feather" data-feather="log-in" style="width: 16px; height: 16px; margin-right: 8px;">
                        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                        <polyline points="10 17 15 12 10 7"></polyline>
                        <line x1="15" y1="12" x2="3" y2="12"></line>
                    </svg>
                    Join Group
                `;
            }
        }
    }
    
    function showError(message, error = null) {
        if (!errorNotification) {
            const notification = document.createElement('div');
            notification.id = 'errorNotification';
            notification.className = 'error-notification';
            notification.innerHTML = `
                <div class="error-header">
                    <svg class="feather" data-feather="alert-triangle" style="width: 24px; height: 24px; margin-right: 12px; color: #ff6b6b;">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                        <line x1="12" y1="9" x2="12" y2="13"></line>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                    <h3>Error</h3>
                </div>
                <p class="error-message">${message}</p>
                ${error ? `
                    <div class="error-details">${error.stack || error.toString()}</div>
                    <div class="error-actions">
                        <button class="error-btn retry-btn" onclick="location.reload()">
                            <svg class="feather" data-feather="refresh-cw" style="width: 14px; height: 14px; margin-right: 6px;">
                                <polyline points="23 4 23 10 17 10"></polyline>
                                <polyline points="1 20 1 14 7 14"></polyline>
                                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                            </svg>
                            Retry
                        </button>
                        <button class="error-btn details-btn" onclick="this.parentElement.parentElement.classList.toggle('show-details')">
                            <svg class="feather" data-feather="code" style="width: 14px; height: 14px; margin-right: 6px;">
                                <polyline points="16 18 22 12 16 6"></polyline>
                                <polyline points="8 6 2 12 8 18"></polyline>
                            </svg>
                            Show Details
                        </button>
                    </div>
                ` : ''}
            `;
            
            if (joinContainer) {
                joinContainer.insertBefore(notification, joinContainer.firstChild);
            } else {
                document.body.appendChild(notification);
            }
            
            notification.classList.add('show');
        } else {
            errorNotification.innerHTML = `
                <div class="error-header">
                    <svg class="feather" data-feather="alert-triangle" style="width: 24px; height: 24px; margin-right: 12px; color: #ff6b6b;">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                        <line x1="12" y1="9" x2="12" y2="13"></line>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                    <h3>Error</h3>
                </div>
                <p class="error-message">${message}</p>
                ${error ? `
                    <div class="error-details">${error.stack || error.toString()}</div>
                    <div class="error-actions">
                        <button class="error-btn retry-btn" onclick="location.reload()">
                            <svg class="feather" data-feather="refresh-cw" style="width: 14px; height: 14px; margin-right: 6px;">
                                <polyline points="23 4 23 10 17 10"></polyline>
                                <polyline points="1 20 1 14 7 14"></polyline>
                                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                            </svg>
                            Retry
                        </button>
                        <button class="error-btn details-btn" onclick="this.parentElement.parentElement.classList.toggle('show-details')">
                            <svg class="feather" data-feather="code" style="width: 14px; height: 14px; margin-right: 6px;">
                                <polyline points="16 18 22 12 16 6"></polyline>
                                <polyline points="8 6 2 12 8 18"></polyline>
                            </svg>
                            Show Details
                        </button>
                    </div>
                ` : ''}
            `;
            errorNotification.classList.add('show');
        }
        
        if (groupInfo) {
            groupInfo.innerHTML = `
                <div class="error-placeholder">
                    <svg class="feather" data-feather="alert-circle" style="width: 48px; height: 48px; margin-bottom: 16px; color: #ff6b6b;">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <p>Unable to load group information. Please try again.</p>
                </div>
            `;
        }
        
        if (joinBtn) {
            joinBtn.style.display = 'none';
        }
    }
}

function initUserPage() {
    const backBtn = document.getElementById('backBtn');
    const userAvatar = document.getElementById('userAvatar');
    const userName = document.getElementById('userName');
    const userBio = document.getElementById('userBio');
    const userEmail = document.getElementById('userEmail');
    const chatBtn = document.getElementById('chatBtn');
    const mutualGroupsList = document.getElementById('mutualGroupsList');
    
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('id');
    
    if (!userId) {
        alert('No user specified');
        window.location.href = 'message.html';
        return;
    }
    
    if (!groupChat.firebaseUser) {
        window.location.href = 'login.html';
        return;
    }
    
    if (userId === groupChat.firebaseUser.uid) {
        alert('This is your own profile');
        window.location.href = 'message.html';
        return;
    }
    
    backBtn.addEventListener('click', () => {
        const referrer = document.referrer;
        if (referrer && referrer.includes('group.html')) {
            window.history.back();
        } else {
            window.location.href = 'message.html';
        }
    });
    
    chatBtn.addEventListener('click', () => {
        window.location.href = `chats.html?id=${userId}`;
    });
    
    loadUserData();
    
    async function loadUserData() {
        try {
            const userProfile = await groupChat.getUserProfile(userId);
            
            if (!userProfile) {
                if (mutualGroupsList) {
                    mutualGroupsList.innerHTML = `
                        <div class="no-groups">
                            <p>User not found</p>
                        </div>
                    `;
                }
                return;
            }
            
            // Check for fire ring and reward tag
            const hasFireRing = userProfile.fireRing || false;
            const rewardTag = userProfile.rewardTag || '';
            
            if (userAvatar) {
                if (hasFireRing) {
                    userAvatar.className = 'avatar-with-fire-ring';
                    userAvatar.style.position = 'relative';
                }
                userAvatar.src = userProfile.avatar;
            }
            
            if (userName) {
                userName.textContent = userProfile.name;
                if (rewardTag) {
                    userName.innerHTML += ` <span class="reward-tag">${rewardTag}</span>`;
                }
            }
            
            if (userBio) userBio.textContent = userProfile.bio;
            if (userEmail) userEmail.textContent = userProfile.email || 'Email not available';
            
            const mutualGroups = await groupChat.getMutualGroups(groupChat.firebaseUser.uid, userId);
            
            if (mutualGroupsList) {
                if (mutualGroups.length === 0) {
                    mutualGroupsList.innerHTML = `
                        <div class="no-groups">
                            <p>No mutual groups with this user</p>
                        </div>
                    `;
                } else {
                    mutualGroupsList.innerHTML = '';
                    
                    mutualGroups.forEach(group => {
                        const groupItem = document.createElement('div');
                        groupItem.className = 'group-item';
                        groupItem.innerHTML = `
                            <img src="${group.avatar}" alt="${group.name}" class="group-avatar">
                            <div>
                                <div class="group-name">${group.name}</div>
                                <div class="group-members">${group.memberCount} members</div>
                            </div>
                        `;
                        
                        groupItem.addEventListener('click', () => {
                            window.location.href = `group.html?id=${group.id}`;
                        });
                        
                        mutualGroupsList.appendChild(groupItem);
                    });
                }
            }
            
        } catch (error) {
            console.error('Error loading user data:', error);
            if (mutualGroupsList) {
                mutualGroupsList.innerHTML = `
                    <div class="no-groups">
                        <p>Error loading user data</p>
                    </div>
                `;
            }
        }
    }
}

function initChatPage() {
    const sidebar = document.getElementById('sidebar');
    const backBtn = document.getElementById('backBtn');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const messagesContainer = document.getElementById('messagesContainer');
    const noMessages = document.getElementById('noMessages');
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const emojiBtn = document.getElementById('emojiBtn');
    const attachmentBtn = document.getElementById('attachmentBtn');
    const partnerAvatar = document.getElementById('partnerAvatar');
    const partnerName = document.getElementById('partnerName');
    const partnerEmail = document.getElementById('partnerEmail');
    const userBio = document.getElementById('userBio');
    const viewProfileBtn = document.getElementById('viewProfileBtn');
    const chatTitle = document.getElementById('chatTitle');
    const chatSubtitle = document.getElementById('chatSubtitle');
    
    const urlParams = new URLSearchParams(window.location.search);
    const partnerId = urlParams.get('id');
    
    let messages = [];
    let partnerProfile = null;
    let isListening = false;
    let reactionUnsubscribers = new Map();
    let reactionsCache = new Map();
    let isRendering = false;
    let renderQueue = [];
    let lastMessageIds = '';
    // FIXED: Moved renderedMessageIds to window object to persist across page navigation
    if (!window.renderedMessageIds) {
        window.renderedMessageIds = new Set();
    }
    let renderedMessageIds = window.renderedMessageIds;
    
    if (!partnerId) {
        alert('No chat partner specified');
        window.location.href = 'message.html';
        return;
    }
    
    if (!groupChat.firebaseUser) {
        window.location.href = 'login.html';
        return;
    }
    
    if (partnerId === groupChat.firebaseUser.uid) {
        alert('You cannot chat with yourself');
        window.location.href = 'message.html';
        return;
    }
    
    groupChat.currentChatPartnerId = partnerId;
    
    backBtn.addEventListener('click', () => {
        groupChat.cleanup();
        reactionUnsubscribers.forEach(unsub => unsub());
        reactionUnsubscribers.clear();
        window.location.href = 'message.html';
    });
    
    if (sidebarToggle) {
        const newToggle = sidebarToggle.cloneNode(true);
        sidebarToggle.parentNode.replaceChild(newToggle, sidebarToggle);
        
        const freshToggle = document.getElementById('sidebarToggle');
        
        freshToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            if (sidebar) {
                const isActive = sidebar.classList.contains('active');
                if (isActive) {
                    sidebar.classList.remove('active');
                    removeSidebarOverlay();
                } else {
                    sidebar.classList.add('active');
                    createSidebarOverlay();
                }
            }
        });
    }
    
    if (viewProfileBtn) {
        viewProfileBtn.addEventListener('click', () => {
            window.open(`user.html?id=${partnerId}`, '_blank');
        });
    }
    
    messageInput.addEventListener('input', () => {
        if (sendBtn) {
            sendBtn.disabled = !messageInput.value.trim();
        }
        messageInput.style.height = 'auto';
        messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
    });
    
    // FIXED: Send button always shows airplane icon, no loader - prevent form submission
    sendBtn.addEventListener('click', (e) => {
        e.preventDefault();
        sendMessage();
    });
    
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    emojiBtn.addEventListener('click', () => {
        const emojis = ['😀', '😂', '🥰', '😎', '🤔', '👍', '🎉', '❤️', '🔥', '✨'];
        const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
        
        messageInput.value += randomEmoji;
        messageInput.focus();
        messageInput.dispatchEvent(new Event('input'));
    });
    
    attachmentBtn.addEventListener('click', () => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*,video/*';
        fileInput.multiple = false;
        
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    const originalHTML = attachmentBtn.innerHTML;
                    attachmentBtn.innerHTML = '<svg class="feather" data-feather="loader" style="animation: spin 1s linear infinite;"><circle cx="12" cy="12" r="10" /></svg>';
                    attachmentBtn.disabled = true;
                    
                    await groupChat.sendPrivateMediaMessage(partnerId, file, groupChat.replyingToMessage?.id);
                    
                    attachmentBtn.innerHTML = originalHTML;
                    attachmentBtn.disabled = false;
                    
                } catch (error) {
                    console.error('Error sending media:', error);
                    alert(error.message || 'Failed to send media. Please try again.');
                    
                    attachmentBtn.innerHTML = '<svg class="feather" data-feather="paperclip"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>';
                    attachmentBtn.disabled = false;
                }
            }
        });
        
        fileInput.click();
    });
    
    document.addEventListener('tempPrivateMediaMessage', (e) => {
        const { tempId, message, partnerId: eventPartnerId } = e.detail;
        
        if (eventPartnerId === partnerId) {
            const tempMsgIndex = messages.findIndex(m => m.id === tempId);
            if (tempMsgIndex === -1) {
                messages.push(message);
                queueRender();
            }
        }
    });
    
    document.addEventListener('removeTempPrivateMessage', (e) => {
        const tempId = e.detail.tempId;
        
        const tempMsgIndex = messages.findIndex(m => m.id === tempId);
        if (tempMsgIndex !== -1) {
            messages.splice(tempMsgIndex, 1);
            queueRender();
        }
    });
    
    loadChatData();
    
    function queueRender() {
        if (!isRendering) {
            isRendering = true;
            requestAnimationFrame(() => {
                displayMessages();
                isRendering = false;
                
                if (renderQueue.length > 0) {
                    renderQueue = [];
                    queueRender();
                }
            });
        } else {
            renderQueue.push(true);
        }
    }
    
    async function loadChatData() {
        try {
            partnerProfile = await groupChat.getUserProfile(partnerId);
            
            if (!partnerProfile) {
                alert('User not found');
                window.location.href = 'message.html';
                return;
            }
            
            // Check for fire ring and reward tag
            const hasFireRing = partnerProfile.fireRing || false;
            const rewardTag = partnerProfile.rewardTag || '';
            
            if (partnerAvatar) {
                if (hasFireRing) {
                    partnerAvatar.className = 'avatar-with-fire-ring';
                    partnerAvatar.style.position = 'relative';
                }
                partnerAvatar.src = partnerProfile.avatar;
            }
            
            if (partnerName) {
                partnerName.textContent = partnerProfile.name;
                if (rewardTag) {
                    partnerName.innerHTML += ` <span class="reward-tag">${rewardTag}</span>`;
                }
            }
            
            if (partnerEmail) partnerEmail.textContent = partnerProfile.email || 'Email not available';
            if (userBio) userBio.textContent = partnerProfile.bio;
            
            // FIXED: Truncate partner name to 6 words in chat header
            const truncatedPartnerName = groupChat.truncateName(partnerProfile.name);
            if (chatTitle) chatTitle.textContent = truncatedPartnerName;
            if (chatSubtitle) chatSubtitle.textContent = 'Private Chat';
            
            messages = await groupChat.getPrivateMessages(partnerId);
            await loadInitialPrivateReactions();
            // Clear rendered message IDs for this specific chat when first loading
            // Keep the window.renderedMessageIds but filter out only messages for this chat
            const chatId = groupChat.getPrivateChatId(groupChat.firebaseUser.uid, partnerId);
            for (const msgId of renderedMessageIds) {
                if (msgId.includes(chatId)) {
                    renderedMessageIds.delete(msgId);
                }
            }
            queueRender();
            
            if (messagesContainer) {
                groupChat.setupSwipeToReply(messagesContainer);
            }
            
            await groupChat.markMessagesAsRead(chatId, partnerId);
            
            if (!isListening) {
                groupChat.listenToPrivateMessages(partnerId, (newMessages) => {
                    messages = newMessages;
                    queueRender();
                    
                    if (newMessages.length > 0) {
                        groupChat.markMessagesAsRead(chatId, partnerId);
                    }
                });
                isListening = true;
            }
            
        } catch (error) {
            console.error('Error loading chat data:', error);
            alert('Error loading chat data');
        }
    }
    
    async function loadInitialPrivateReactions() {
        const chatId = groupChat.getPrivateChatId(groupChat.firebaseUser.uid, partnerId);
        for (const message of messages) {
            const reactions = await groupChat.getPrivateMessageReactions(chatId, message.id);
            reactionsCache.set(message.id, reactions);
        }
    }
    
    function displayMessages() {
        if (!messagesContainer) return;
        
        if (messages.length === 0) {
            if (noMessages) noMessages.style.display = 'block';
            messagesContainer.innerHTML = '';
            return;
        }
        
        if (noMessages) noMessages.style.display = 'none';
        
        window.currentMessages = messages;
        
        // Only update if there are new messages that haven't been rendered
        const newMessages = messages.filter(msg => !renderedMessageIds.has(msg.id));
        
        if (newMessages.length === 0) {
            return; // No new messages to render
        }
        
        // Track which messages we've rendered
        newMessages.forEach(msg => renderedMessageIds.add(msg.id));
        
        // Use DocumentFragment for efficient DOM updates
        const fragment = document.createDocumentFragment();
        
        // Group new messages by sender and time
        const groupedMessages = [];
        let currentGroup = null;
        
        newMessages.forEach((message, index) => {
            const messageTime = message.timestamp ? new Date(message.timestamp) : new Date();
            const prevMessage = index > 0 ? newMessages[index - 1] : null;
            const prevTime = prevMessage && prevMessage.timestamp ? new Date(prevMessage.timestamp) : new Date(0);
            
            const timeDiff = Math.abs(messageTime - prevTime) / (1000 * 60);
            
            if (!prevMessage || 
                prevMessage.senderId !== message.senderId || 
                timeDiff > 5) {
                currentGroup = {
                    senderId: message.senderId,
                    senderName: message.senderId === groupChat.firebaseUser.uid ? 
                        groupChat.currentUser.name : partnerProfile.name,
                    senderAvatar: message.senderId === groupChat.firebaseUser.uid ? 
                        groupChat.currentUser.avatar : partnerProfile.avatar,
                    messages: [message]
                };
                groupedMessages.push(currentGroup);
            } else {
                currentGroup.messages.push(message);
            }
        });
        
        groupedMessages.forEach(group => {
            const groupDiv = document.createElement('div');
            groupDiv.className = 'message-group';
            groupDiv.dataset.senderId = group.senderId;
            
            const firstMessage = group.messages[0];
            const firstMessageTime = firstMessage.timestamp ? new Date(firstMessage.timestamp) : new Date();
            
            // Get user profile for reward tag and fire ring
            let userProfile = null;
            if (group.senderId === groupChat.firebaseUser.uid) {
                userProfile = groupChat.currentUser;
            } else {
                userProfile = partnerProfile;
            }
            
            const hasFireRing = userProfile?.fireRing || false;
            const rewardTag = userProfile?.rewardTag || '';
            
            groupDiv.innerHTML = `
                <div class="message-header">
                    <div class="message-avatar-container" style="position: relative; display: inline-block;">
                        ${hasFireRing ? '<div class="fire-ring"></div>' : ''}
                        <img src="${group.senderAvatar}" 
                             alt="${group.senderName}" 
                             class="message-avatar ${hasFireRing ? 'avatar-with-fire-ring' : ''}"
                             data-user-id="${group.senderId}">
                    </div>
                    <div class="message-sender-info">
                        <span class="message-sender">${group.senderName}</span>
                        ${rewardTag ? `<span class="reward-tag">${rewardTag}</span>` : ''}
                    </div>
                    <span class="message-time">${formatTime(firstMessageTime)}</span>
                </div>
                <div class="message-content">
                    ${group.messages.map(msg => {
                        const messageTime = msg.timestamp ? new Date(msg.timestamp) : new Date();
                        
                        let replyHtml = '';
                        if (msg.replyTo) {
                            const repliedMessage = messages.find(m => m.id === msg.replyTo);
                            if (repliedMessage) {
                                const truncatedName = groupChat.truncateName(repliedMessage.senderName);
                                const truncatedMessage = repliedMessage.text ? 
                                    groupChat.truncateMessage(repliedMessage.text) : 
                                    (repliedMessage.imageUrl ? '📷 Image' : repliedMessage.videoUrl ? '🎬 Video' : '');
                                
                                replyHtml = `
                                    <div class="replying-to">
                                        <span class="reply-label">Replying to</span> 
                                        <span class="reply-sender">${truncatedName}</span>
                                        <span class="reply-separator">:</span> 
                                        <span class="reply-message">${truncatedMessage}</span>
                                    </div>
                                `;
                            }
                        }
                        
                        const isTemp = groupChat.tempPrivateMessages.has(msg.id);
                        const isUploading = msg.status === 'uploading';
                        
                        const messageDivClass = 'message-text';
                        
                        // UPDATED: Add soft glowing effect for private messages too
                        const hasGlowEffect = msg.glowEffect || false;
                        const extraClasses = hasGlowEffect ? ' glowing-message' : '';
                        
                        let messageContent = '';
                        
                        if (msg.imageUrl) {
                            messageContent = `
                                <div class="message-image-container" style="position: relative;">
                                    <img src="${msg.imageUrl}" 
                                         alt="Shared image" 
                                         class="message-image"
                                         style="max-width: 250px; max-height: 250px; border-radius: 8px; cursor: pointer; width: 100%; height: auto;"
                                         onload="this.style.opacity='1';"
                                         onerror="this.style.display='none';"
                                         onclick="openImageModal('${msg.imageUrl}')">
                                    ${isUploading ? `
                                        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                                               background: rgba(0,0,0,0.7); color: white; padding: 8px 12px; border-radius: 20px;
                                               font-size: 12px; display: flex; align-items: center; gap: 6px;">
                                            <svg class="feather" data-feather="loader" style="animation: spin 1s linear infinite; width: 14px; height: 14px;">
                                                <circle cx="12" cy="12" r="10" />
                                            </svg>
                                            Uploading...
                                        </div>
                                    ` : ''}
                                </div>
                            `;
                        } else if (msg.videoUrl) {
                            messageContent = `
                                <div class="message-video-container" style="position: relative;">
                                    <video controls style="max-width: 250px; max-height: 250px; border-radius: 8px; width: 100%; height: auto;"
                                           onload="this.style.opacity='1';"
                                           onerror="this.style.display='none';">
                                        <source src="${msg.videoUrl}" type="video/mp4">
                                        Your browser does not support the video tag.
                                    </video>
                                    ${isUploading ? `
                                        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                                               background: rgba(0,0,0,0.7); color: white; padding: 8px 12px; border-radius: 20px;
                                               font-size: 12px; display: flex; align-items: center; gap: 6px;">
                                            <svg class="feather" data-feather="loader" style="animation: spin 1s linear infinite; width: 14px; height: 14px;">
                                                <circle cx="12" cy="12" r="10" />
                                            </svg>
                                            Uploading...
                                        </div>
                                    ` : ''}
                                </div>
                            `;
                        } else {
                            messageContent = msg.text || '';
                        }
                        
                        const messageDivId = `message-${msg.id}`;
                        
                        const cachedReactions = reactionsCache.get(msg.id) || [];
                        
                        // UPDATED: Add sending indicator on message
                        const sendingIndicator = isTemp ? 
                            `<div class="sending-indicator" id="sending-${msg.id}">
                                <svg class="feather" data-feather="loader" style="animation: spin 1s linear infinite; width: 12px; height: 12px;">
                                    <circle cx="12" cy="12" r="10" />
                                </svg>
                                <span>Sending...</span>
                            </div>` : 
                            '';
                        
                        return `
                            <div class="${messageDivClass}${extraClasses}" data-message-id="${msg.id}" id="${messageDivId}">
                                ${replyHtml}
                                ${messageContent}
                                <div class="message-reactions" id="reactions-${msg.id}">
                                    ${cachedReactions.map(reaction => {
                                        const hasUserReacted = reaction.users && reaction.users.includes(groupChat.firebaseUser?.uid);
                                        return `
                                            <div class="reaction-bubble ${hasUserReacted ? 'user-reacted' : ''}" data-emoji="${reaction.emoji}">
                                                <span class="reaction-emoji">${reaction.emoji}</span>
                                                <span class="reaction-count">${reaction.count}</span>
                                            </div>
                                        `;
                                    }).join('')}
                                    <div class="reaction-bubble add-reaction" style="opacity: 0; pointer-events: none; padding: 0; width: 0; height: 0;">
                                        +
                                    </div>
                                </div>
                                ${sendingIndicator}
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
            
            fragment.appendChild(groupDiv);
        });
        
        // Append new messages to the container (don't clear existing ones)
        messagesContainer.appendChild(fragment);
        
        // Remove sending indicators for messages that are no longer temp
        document.querySelectorAll('.sending-indicator').forEach(indicator => {
            const messageId = indicator.id.replace('sending-', '');
            if (!groupChat.tempPrivateMessages.has(messageId)) {
                indicator.remove();
            }
        });
        
        document.querySelectorAll('.message-avatar').forEach(avatar => {
            avatar.addEventListener('click', (e) => {
                const userId = e.target.dataset.userId;
                if (userId && userId !== groupChat.firebaseUser?.uid) {
                    window.open(`user.html?id=${userId}`, '_blank');
                }
            });
        });
        
        document.querySelectorAll('.reaction-bubble').forEach(bubble => {
            bubble.addEventListener('click', (e) => {
                if (e.currentTarget.classList.contains('add-reaction')) {
                    return;
                }
                const messageElement = e.target.closest('.message-text');
                if (messageElement) {
                    const messageId = messageElement.dataset.messageId;
                    const message = messages.find(m => m.id === messageId);
                    if (message) {
                        const emoji = e.currentTarget.dataset.emoji;
                        groupChat.currentMessageForReaction = message;
                        groupChat.addReactionToMessage(emoji);
                    }
                }
            });
        });
        
        document.querySelectorAll('.message-text').forEach(messageElement => {
            let longPressTimer;
            const messageId = messageElement.dataset.messageId;
            const message = messages.find(m => m.id === messageId);
            
            if (message) {
                messageElement.addEventListener('touchstart', (e) => {
                    longPressTimer = setTimeout(() => {
                        groupChat.showReactionModal(message);
                    }, 500);
                });
                
                messageElement.addEventListener('touchend', () => {
                    clearTimeout(longPressTimer);
                });
                
                messageElement.addEventListener('touchmove', () => {
                    clearTimeout(longPressTimer);
                });
                
                messageElement.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    groupChat.showReactionModal(message);
                });
            }
        });
        
        groupChat.setupSwipeToReply(messagesContainer);
        
        setupPrivateReactionListeners();
        
        // Scroll to bottom after rendering
        setTimeout(() => {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }, 50);
    }
    
    function setupPrivateReactionListeners() {
        const chatId = groupChat.getPrivateChatId(groupChat.firebaseUser.uid, partnerId);
        
        messages.forEach(message => {
            if (reactionUnsubscribers.has(message.id)) {
                return;
            }
            
            const unsubscribe = groupChat.listenToPrivateMessageReactions(chatId, message.id, (reactions) => {
                reactionsCache.set(message.id, reactions);
                const reactionsContainer = document.getElementById(`reactions-${message.id}`);
                if (reactionsContainer) {
                    updateReactionsDisplay(reactionsContainer, reactions, message.id);
                }
            });
            
            reactionUnsubscribers.set(message.id, unsubscribe);
        });
    }
    
    function updateReactionsDisplay(container, reactions, messageId) {
        container.innerHTML = '';
        
        reactions.forEach(reaction => {
            const hasUserReacted = reaction.users && reaction.users.includes(groupChat.firebaseUser?.uid);
            const bubble = document.createElement('div');
            bubble.className = `reaction-bubble ${hasUserReacted ? 'user-reacted' : ''}`;
            bubble.dataset.emoji = reaction.emoji;
            bubble.innerHTML = `
                <span class="reaction-emoji">${reaction.emoji}</span>
                <span class="reaction-count">${reaction.count}</span>
            `;
            
            bubble.addEventListener('click', () => {
                const message = messages.find(m => m.id === messageId);
                if (message) {
                    groupChat.currentMessageForReaction = message;
                    groupChat.addReactionToMessage(reaction.emoji);
                }
            });
            
            container.appendChild(bubble);
        });
        
        const emptyBubble = document.createElement('div');
        emptyBubble.className = 'reaction-bubble add-reaction';
        emptyBubble.style.cssText = 'opacity: 0; pointer-events: none; padding: 0; width: 0; height: 0;';
        emptyBubble.innerHTML = '+';
        container.appendChild(emptyBubble);
    }
    
    async function sendMessage() {
        const text = messageInput.value.trim();
        
        if (!text) return;
        
        // FIXED: Send button always shows airplane icon, no loader
        // We only disable it temporarily to prevent double sends
        const originalHTML = sendBtn.innerHTML;
        const originalDisabled = sendBtn.disabled;
        sendBtn.disabled = true;
        
        try {
            await groupChat.sendPrivateMessage(
                partnerId, 
                text, 
                null, 
                null, 
                groupChat.replyingToMessage?.id
            );
            
            messageInput.value = '';
            messageInput.style.height = 'auto';
            messageInput.dispatchEvent(new Event('input'));
            
            groupChat.clearReply();
            
        } catch (error) {
            console.error('Error sending message:', error);
            alert('Failed to send message');
        } finally {
            // FIXED: Always restore airplane icon immediately
            sendBtn.disabled = originalDisabled;
            sendBtn.innerHTML = originalHTML;
        }
    }
    
    function formatTime(date) {
        if (!(date instanceof Date)) {
            date = new Date(date);
        }
        
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffDays > 0) {
            return `${diffDays}d ago`;
        } else if (diffHours > 0) {
            return `${diffHours}h ago`;
        } else if (diffMins > 0) {
            return `${diffMins}m ago`;
        } else {
            return 'just now';
        }
    }
    
    function createSidebarOverlay() {
        removeSidebarOverlay();
        
        const overlay = document.createElement('div');
        overlay.id = 'sidebarOverlay';
        overlay.className = 'sidebar-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            z-index: 999;
            display: block;
        `;
        
        overlay.addEventListener('click', () => {
            if (sidebar) {
                sidebar.classList.remove('active');
                removeSidebarOverlay();
            }
        });
        
        document.body.appendChild(overlay);
    }
    
    function removeSidebarOverlay() {
        const overlay = document.getElementById('sidebarOverlay');
        if (overlay) {
            overlay.remove();
        }
    }
    
    window.addEventListener('beforeunload', () => {
        groupChat.cleanup();
        reactionUnsubscribers.forEach(unsub => unsub());
        reactionUnsubscribers.clear();
        removeSidebarOverlay();
    });
    
    if (!window.openImageModal) {
        window.openImageModal = function(imageUrl) {
            const modal = document.createElement('div');
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.9);
                z-index: 10000;
                display: flex;
                justify-content: center;
                align-items: center;
            `;
            
            modal.innerHTML = `
                <div style="position: relative; max-width: 90%; max-height: 90%;">
                    <img src="${imageUrl}" alt="Full size" style="max-width: 100%; max-height: 90vh; border-radius: 8px;">
                    <button style="position: absolute; top: 20px; right: 20px; background: rgba(0,0,0,0.5); color: white; 
                            border: none; border-radius: 50%; width: 40px; height: 40px; font-size: 20px; cursor: pointer;">
                        ×
                    </button>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            modal.querySelector('button').addEventListener('click', () => {
                document.body.removeChild(modal);
            });
            
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    document.body.removeChild(modal);
                }
            });
        };
    }
}

function initMessagesPage() {
    const backBtn = document.getElementById('backBtn');
    const privateTab = document.getElementById('privateTab');
    const groupTab = document.getElementById('groupTab');
    const privateBadge = document.getElementById('privateBadge');
    const groupBadge = document.getElementById('groupBadge');
    const messagesList = document.getElementById('messagesList');
    
    let activeTab = 'private';
    let privateChats = [];
    let groupChats = [];
    
    if (!groupChat.firebaseUser) {
        window.location.href = 'login.html';
        return;
    }
    
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.location.href = 'groups.html';
        });
    }
    
    if (privateTab) {
        privateTab.addEventListener('click', () => {
            if (activeTab !== 'private') {
                activeTab = 'private';
                privateTab.classList.add('active');
                if (groupTab) groupTab.classList.remove('active');
                loadMessages();
            }
        });
    }
    
    if (groupTab) {
        groupTab.addEventListener('click', () => {
            if (activeTab !== 'group') {
                activeTab = 'group';
                groupTab.classList.add('active');
                if (privateTab) privateTab.classList.remove('active');
                loadMessages();
            }
        });
    }
    
    loadMessages();
    
    async function loadMessages() {
        try {
            if (messagesList) {
                messagesList.innerHTML = `
                    <div class="loading">
                        <div class="loading-spinner"></div>
                        <p>Loading messages...</p>
                    </div>
                `;
            }
            
            if (activeTab === 'private') {
                privateChats = await groupChat.getPrivateChats();
                displayPrivateChats();
                
                if (privateBadge) {
                    const totalUnread = privateChats.reduce((sum, chat) => sum + (chat.unreadCount || 0), 0);
                    privateBadge.textContent = totalUnread > 0 ? totalUnread : '0';
                }
                
            } else {
                groupChats = await groupChat.getGroupChatsWithUnread();
                displayGroupChats();
                
                if (groupBadge) {
                    groupBadge.textContent = groupChats.length > 0 ? groupChats.length : '0';
                }
            }
            
        } catch (error) {
            console.error('Error loading messages:', error);
            if (messagesList) {
                messagesList.innerHTML = `
                    <div class="no-messages">
                        <svg class="feather" data-feather="alert-circle" style="width: 48px; height: 48px; margin-bottom: 16px; color: #ff6b6b;">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                        <p>Error loading messages. Please try again.</p>
                    </div>
                `;
            }
        }
    }
    
    function displayPrivateChats() {
        if (!messagesList) return;
        
        if (privateChats.length === 0) {
            messagesList.innerHTML = `
                <div class="no-messages">
                    <svg class="feather" data-feather="message-circle" style="width: 48px; height: 48px; margin-bottom: 16px; color: #666;">
                        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                    </svg>
                    <p>No private messages yet</p>
                    <p style="font-size: 0.9rem; margin-top: 10px;">Start a chat by clicking on a user's avatar in a group</p>
                </div>
            `;
            return;
        }
        
        messagesList.innerHTML = '';
        
        privateChats.forEach(chat => {
            const messageItem = document.createElement('div');
            messageItem.className = `message-item ${chat.unreadCount > 0 ? 'unread' : ''}`;
            
            // Get user profile for reward tag
            const userProfile = groupChat.cache.userProfiles ? 
                groupChat.cache.userProfiles.get(`user_${chat.userId}`)?.data : null;
            
            const rewardTag = userProfile?.rewardTag || '';
            
            messageItem.innerHTML = `
                <img src="${chat.userAvatar}" alt="${chat.userName}" class="user-avatar">
                <div class="message-content">
                    <div class="message-header">
                        <div class="message-user">${chat.userName} ${rewardTag ? `<span class="reward-tag">${rewardTag}</span>` : ''}</div>
                        <div class="message-time">${formatTime(chat.updatedAt)}</div>
                    </div>
                    <div class="message-preview">
                        ${chat.lastMessage ? chat.lastMessage.text : 'No messages yet'}
                    </div>
                </div>
                <div class="message-info">
                    ${chat.unreadCount > 0 ? `
                        <div class="unread-count">${chat.unreadCount}</div>
                    ` : ''}
                    <div class="last-message">${chat.lastMessage ? formatTime(chat.lastMessage.timestamp) : ''}</div>
                </div>
            `;
            
            messageItem.addEventListener('click', () => {
                window.location.href = `chats.html?id=${chat.userId}`;
            });
            
            messagesList.appendChild(messageItem);
        });
    }
    
    function displayGroupChats() {
        if (!messagesList) return;
        
        if (groupChats.length === 0) {
            messagesList.innerHTML = `
                <div class="no-messages">
                    <svg class="feather" data-feather="users" style="width: 48px; height: 48px; margin-bottom: 16px; color: #666;">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                    <p>No group messages yet</p>
                    <p style="font-size: 0.9rem; margin-top: 10px;">Join a group to start chatting</p>
                </div>
            `;
            return;
        }
        
        messagesList.innerHTML = '';
        
        groupChats.forEach(group => {
            const messageItem = document.createElement('div');
            messageItem.className = 'message-item';
            messageItem.innerHTML = `
                <img src="${group.avatar}" alt="${group.name}" class="user-avatar">
                <div class="message-content">
                    <div class="message-header">
                        <div class="message-user">${group.name}</div>
                        <div class="message-time">${group.lastMessage ? formatTime(group.lastMessage.timestamp) : ''}</div>
                    </div>
                    <div class="message-preview">
                        ${group.lastMessage ? 
                            `${group.lastMessage.senderName}: ${group.lastMessage.text}` : 
                            'No messages yet'}
                    </div>
                </div>
                <div class="message-info">
                    <div class="group-members">${group.memberCount} members</div>
                </div>
            `;
            
            messageItem.addEventListener('click', () => {
                window.location.href = `group.html?id=${group.id}`;
            });
            
            messagesList.appendChild(messageItem);
        });
    }
    
    function formatTime(date) {
        if (!date) return '';
        
        if (!(date instanceof Date)) {
            date = new Date(date);
        }
        
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffDays > 0) {
            return `${diffDays}d ago`;
        } else if (diffHours > 0) {
            return `${diffHours}h ago`;
        } else if (diffMins > 0) {
            return `${diffMins}m ago`;
        } else {
            return 'just now';
        }
    }
}

window.groupChat = groupChat;

window.groupLogout = function() {
    groupChat.logout();
};

document.addEventListener('DOMContentLoaded', function() {
    const pendingInviteCode = sessionStorage.getItem('pendingInviteCode');
    const currentPage = window.location.pathname.split('/').pop();
    
    if (pendingInviteCode && currentPage === 'join.html' && !window.location.search.includes('code=')) {
        window.location.href = `join.html?code=${pendingInviteCode}`;
        sessionStorage.removeItem('pendingInviteCode');
    }
});