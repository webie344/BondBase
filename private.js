// private.js - Private Chat System with Cloudinary Media Support
// Extracted from group.js for separation of concerns

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
    writeBatch
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { 
    getAuth, 
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

const firebaseConfig = {
    apiKey: "AIzaSyC8_PEsfTOr-gJ8P1MoXobOAfqwTVqEZWo",
    authDomain: "usa-dating-23bc3.firebaseapp.com",
    projectId: "usa-dating-23bc3",
    storageBucket: "usa-dating-23bc3.firebasestorage.app",
    messagingSenderId: "423286263327",
    appId: "1:423286263327:web:17f0caf843dc349c144f2a"
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

const CACHE_DURATION = {
    USER_PROFILE: 5 * 60 * 1000,
    PRIVATE_CHATS: 2 * 60 * 1000,
    UNREAD_COUNTS: 1 * 60 * 1000
};

class PrivateChat {
    constructor() {
        this.currentUser = null;
        this.firebaseUser = null;
        this.currentChatPartnerId = null;
        
        // Track active listeners
        this.activeListeners = {
            privateMessages: new Map(), // chatId -> unsubscribe function
            privateReactions: new Map() // messageId -> unsubscribe function
        };
        
        this.unsubscribeAuth = null;
        
        this.cache = {
            userProfile: null,
            userProfileExpiry: 0,
            blockedUsers: new Map(),
            userProfiles: new Map(),
            mutualGroups: new Map(),
            privateChats: new Map(),
            unreadCounts: new Map(),
            messageReactions: new Map(),
            messages: new Map()
        };
        
        this.replyingToMessage = null;
        this.selectedMessage = null;
        this.messageContextMenu = null;
        
        this.privateChats = new Map();
        this.unreadMessages = new Map();
        
        this.isLoadingMessages = false;
        
        this.sentMessageIds = new Set();
        this.pendingMessages = new Set();
        
        this.reactionModal = null;
        this.currentMessageForReaction = null;
        
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.isSwiping = false;
        this.swipeThreshold = 50;
        
        this.displayedMessageIds = new Map();
        this.messageRenderQueue = [];
        this.isRendering = false;
        
        this.blockedUsers = new Map();
        
        this.activeUploads = new Map();
        
        this.setupAuthListener();
        this.createReactionModal();
        this.loadBlockedUsers();
        
        // Add beforeunload listener for cleanup
        window.addEventListener('beforeunload', () => this.cleanupAllListeners());
    }

    // Listener cleanup methods
    cleanupAllListeners() {
        console.log('Cleaning up all private chat listeners');
        
        // Clean up all private message listeners
        this.activeListeners.privateMessages.forEach((unsub, key) => {
            if (typeof unsub === 'function') {
                try {
                    unsub();
                } catch (err) {
                    console.log('Error unsubscribing from private messages:', err);
                }
            }
        });
        this.activeListeners.privateMessages.clear();
        
        // Clean up all private reaction listeners
        this.activeListeners.privateReactions.forEach((unsub, key) => {
            if (typeof unsub === 'function') {
                try {
                    unsub();
                } catch (err) {
                    console.log('Error unsubscribing from private reactions:', err);
                }
            }
        });
        this.activeListeners.privateReactions.clear();
        
        // Cancel all active uploads
        this.activeUploads.forEach((upload, uploadId) => {
            if (upload.cancelFunction && typeof upload.cancelFunction === 'function') {
                upload.cancelFunction();
            }
        });
        this.activeUploads.clear();
        
        // Clear displayed messages
        this.displayedMessageIds.clear();
        this.messageRenderQueue = [];
        this.sentMessageIds.clear();
        this.pendingMessages.clear();
        
        console.log('All private chat listeners cleaned up');
    }
    
    cleanupPrivateChatListeners(chatId) {
        console.log('Cleaning up listeners for private chat:', chatId);
        
        // Clean up private message listener
        if (this.activeListeners.privateMessages.has(chatId)) {
            const unsub = this.activeListeners.privateMessages.get(chatId);
            if (typeof unsub === 'function') {
                try {
                    unsub();
                } catch (err) {
                    console.log('Error unsubscribing from private messages:', err);
                }
            }
            this.activeListeners.privateMessages.delete(chatId);
        }
        
        // Clear displayed messages for this chat
        this.displayedMessageIds.delete(chatId);
        
        console.log('Private chat listeners cleaned up for:', chatId);
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

    clearPrivateChatCache(chatId) {
        this.displayedMessageIds.delete(chatId);
        this.cache.unreadCounts.clear();
        this.cache.privateChats.clear();
    }

    clearAllCache() {
        this.cache = {
            userProfile: null,
            userProfileExpiry: 0,
            blockedUsers: new Map(),
            userProfiles: new Map(),
            mutualGroups: new Map(),
            privateChats: new Map(),
            unreadCounts: new Map(),
            messageReactions: new Map(),
            messages: new Map()
        };
        this.displayedMessageIds.clear();
        this.messageRenderQueue = [];
        
        this.activeUploads.clear();
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
                reason: 'User blocked from private chat'
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

    async uploadMediaToCloudinary(file, uploadId, onProgress = null, onCancel = null) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', cloudinaryConfig.uploadPreset);
        
        const isVideo = file.type.startsWith('video/');
        formData.append('resource_type', isVideo ? 'video' : 'image');
        
        const controller = new AbortController();
        
        if (onCancel) {
            onCancel(() => {
                controller.abort();
                this.activeUploads.delete(uploadId);
            });
        }
        
        try {
            const response = await fetch(
                `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/${isVideo ? 'video' : 'image'}/upload`,
                {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    signal: controller.signal
                }
            );
            
            if (!response.ok) {
                throw new Error(`Cloudinary error: ${response.statusText}`);
            }
            
            const data = await response.json();
            if (!data.secure_url) {
                throw new Error('Invalid response from Cloudinary');
            }
            
            this.activeUploads.delete(uploadId);
            
            return data.secure_url;
        } catch (error) {
            this.activeUploads.delete(uploadId);
            
            if (error.name === 'AbortError') {
                throw new Error('Upload cancelled');
            }
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
            
            this.setCachedItem(cacheKey, mutualGroups, this.cache.mutualGroups, CACHE_DURATION.USER_PROFILE);
            
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

    async sendPrivateMessage(toUserId, text = null, imageUrl = null, videoUrl = null, replyTo = null) {
        try {
            if (!this.firebaseUser || !this.currentUser) {
                throw new Error('You must be logged in to send messages');
            }
            
            if (!text && !imageUrl && !videoUrl) {
                throw new Error('Message cannot be empty');
            }
            
            const isBlocked = await this.isUserBlocked(toUserId);
            if (isBlocked) {
                throw new Error('You cannot send messages to this user as they have been blocked');
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

    async sendPrivateMediaMessage(toUserId, file, replyTo = null, onProgress = null, onCancel = null) {
        try {
            const isVideo = file.type.startsWith('video/');
            
            if (isVideo) {
                this.validateVideoFile(file);
            } else {
                this.validateImageFile(file);
            }
            
            const uploadId = 'upload_private_' + Date.now();
            
            const mediaUrl = await this.uploadMediaToCloudinary(file, uploadId, onProgress, onCancel);
            
            if (isVideo) {
                await this.sendPrivateMessage(toUserId, null, null, mediaUrl, replyTo);
            } else {
                await this.sendPrivateMessage(toUserId, null, mediaUrl, null, replyTo);
            }
            
            return true;
        } catch (error) {
            console.error('Error sending private media message:', error);
            throw error;
        }
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
            
            return messages.reverse();
        } catch (error) {
            console.error('Error getting private messages:', error);
            return [];
        }
    }

    listenToPrivateMessages(otherUserId, callback) {
        try {
            const chatId = this.getPrivateChatId(this.firebaseUser.uid, otherUserId);
            
            // Clean up existing listener first
            if (this.activeListeners.privateMessages.has(chatId)) {
                const existingUnsub = this.activeListeners.privateMessages.get(chatId);
                if (typeof existingUnsub === 'function') {
                    try {
                        existingUnsub();
                    } catch (err) {
                        console.log('Error unsubscribing from previous private messages:', err);
                    }
                }
                this.activeListeners.privateMessages.delete(chatId);
            }
            
            const messagesRef = collection(db, 'private_chats', chatId, 'messages');
            const q = query(messagesRef, orderBy('timestamp', 'asc'));
            
            if (!this.displayedMessageIds.has(chatId)) {
                this.displayedMessageIds.set(chatId, new Set());
            }
            
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const newMessages = [];
                
                snapshot.forEach(doc => {
                    const data = doc.data();
                    const messageId = doc.id;
                    
                    const displayedMessages = this.displayedMessageIds.get(chatId);
                    if (!displayedMessages || !displayedMessages.has(messageId)) {
                        newMessages.push({ 
                            id: messageId, 
                            ...data,
                            chatType: 'private',
                            timestamp: data.timestamp ? (data.timestamp.toDate ? data.timestamp.toDate() : data.timestamp) : new Date()
                        });
                    }
                });
                
                if (newMessages.length > 0) {
                    const displayedMessages = this.displayedMessageIds.get(chatId);
                    newMessages.forEach(msg => displayedMessages.add(msg.id));
                    
                    callback(newMessages);
                }
            }, (error) => {
                console.error('Error in private messages listener:', error);
            });
            
            this.activeListeners.privateMessages.set(chatId, unsubscribe);
            
            return unsubscribe;
        } catch (error) {
            console.error('Error listening to private messages:', error);
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
            
            this.setCachedItem(cacheKey, chats, this.cache.privateChats, CACHE_DURATION.PRIVATE_CHATS);
            
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
            
            this.setCachedItem(cacheKey, unreadCount, this.cache.unreadCounts, CACHE_DURATION.UNREAD_COUNTS);
            
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
            
            this.setCachedItem(cacheKey, reactions, this.cache.messageReactions, CACHE_DURATION.USER_PROFILE);
            
            return reactions;
        } catch (error) {
            console.error('Error getting private message reactions:', error);
            return [];
        }
    }

    async listenToPrivateMessageReactions(chatId, messageId, callback) {
        try {
            // Clean up existing listener first
            const listenerKey = `${chatId}_${messageId}`;
            if (this.activeListeners.privateReactions.has(listenerKey)) {
                const existingUnsub = this.activeListeners.privateReactions.get(listenerKey);
                if (typeof existingUnsub === 'function') {
                    try {
                        existingUnsub();
                    } catch (err) {
                        console.log('Error unsubscribing from previous private reactions:', err);
                    }
                }
                this.activeListeners.privateReactions.delete(listenerKey);
            }
            
            const reactionsRef = collection(db, 'private_chats', chatId, 'messages', messageId, 'reactions');
            const q = query(reactionsRef);
            
            const unsubscribe = onSnapshot(q, (snapshot) => {
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
                this.setCachedItem(cacheKey, reactions, this.cache.messageReactions, CACHE_DURATION.USER_PROFILE);
                
                callback(reactions);
            });
            
            this.activeListeners.privateReactions.set(listenerKey, unsubscribe);
            
            return unsubscribe;
        } catch (error) {
            console.error('Error listening to private message reactions:', error);
            return () => {};
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
            
            .upload-modal {
                position: fixed;
                bottom: 80px;
                right: 20px;
                background: white;
                border-radius: 12px;
                box-shadow: 0 8px 30px rgba(0, 0, 0, 0.2);
                z-index: 1000;
                width: 300px;
                overflow: hidden;
                animation: slideIn 0.3s ease;
            }
            
            @keyframes slideIn {
                from {
                    transform: translateY(20px);
                    opacity: 0;
                }
                to {
                    transform: translateY(0);
                    opacity: 1;
                }
            }
            
            .upload-header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 12px 15px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .upload-header h4 {
                margin: 0;
                font-size: 14px;
                font-weight: 600;
            }
            
            .cancel-upload-btn {
                background: rgba(255, 255, 255, 0.2);
                border: none;
                color: white;
                width: 28px;
                height: 28px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                font-size: 16px;
                line-height: 1;
            }
            
            .cancel-upload-btn:hover {
                background: rgba(255, 255, 255, 0.3);
            }
            
            .upload-content {
                padding: 15px;
            }
            
            .upload-info {
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 15px;
            }
            
            .upload-icon {
                width: 40px;
                height: 40px;
                border-radius: 8px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 18px;
            }
            
            .upload-details h5 {
                margin: 0 0 4px 0;
                font-size: 14px;
                font-weight: 600;
                color: #333;
            }
            
            .upload-details p {
                margin: 0;
                font-size: 12px;
                color: #666;
            }
            
            .upload-progress {
                margin-top: 10px;
            }
            
            .progress-text {
                display: flex;
                justify-content: space-between;
                margin-bottom: 6px;
                font-size: 12px;
                color: #666;
            }
            
            .progress-bar {
                height: 6px;
                background: #f0f0f0;
                border-radius: 3px;
                overflow: hidden;
            }
            
            .progress-fill {
                height: 100%;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border-radius: 3px;
                transition: width 0.3s ease;
            }
            
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
        } catch (error) {
            console.error('Error adding reaction:', error);
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

    setupAuthListener() {
        this.unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
            if (user) {
                this.firebaseUser = user;
                console.log('User authenticated:', user.uid);
                
                await this.loadUserProfile(user.uid);
                
                document.dispatchEvent(new CustomEvent('privateAuthReady'));
            } else {
                this.firebaseUser = null;
                this.currentUser = null;
                this.clearAllCache();
                console.log('User logged out');
                
                const protectedPages = ['chats', 'message', 'user'];
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
            
            this.cache.userProfiles.delete(`user_${this.firebaseUser.uid}`);
            
            return true;
        } catch (error) {
            console.error('Error updating user profile:', error);
            throw error;
        }
    }

    async needsProfileSetup() {
        if (this.currentUser?.profileComplete) {
            return false;
        }
        
        if (this.firebaseUser) {
            const userProfile = await this.getUserProfile(this.firebaseUser.uid, true);
            if (userProfile) {
                return !userProfile.profileComplete;
            }
        }
        
        return true;
    }

    getCurrentUser() {
        return this.currentUser;
    }

    async logout() {
        try {
            await signOut(auth);
            this.firebaseUser = null;
            this.currentUser = null;
            this.clearAllCache();
            this.cleanupAllListeners();
            
            window.location.href = 'login.html';
        } catch (error) {
            console.error('Error logging out:', error);
        }
    }

    cleanup() {
        this.cleanupAllListeners();
    }
}

const privateChat = new PrivateChat();

// Page initialization
document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('privateAuthReady', () => {
        const currentPage = window.location.pathname.split('/').pop().split('.')[0];
        
        switch(currentPage) {
            case 'chats':
                // Clean up any existing listeners before initializing
                privateChat.cleanupAllListeners();
                initChatPage();
                break;
            case 'message':
                initMessagesPage();
                break;
            case 'user':
                initUserPage();
                break;
            default:
                if (currentPage === 'login' || currentPage === 'signup' || currentPage === 'index') {
                    // Do nothing for auth pages
                } else {
                    setTimeout(() => {
                        if (!privateChat.firebaseUser && currentPage !== 'login' && currentPage !== 'signup' && currentPage !== 'index') {
                            window.location.href = 'login.html';
                        }
                    }, 1000);
                }
        }
    });
    
    setTimeout(() => {
        if (privateChat.firebaseUser) {
            document.dispatchEvent(new CustomEvent('privateAuthReady'));
        }
    }, 500);
});

// Add page cleanup on navigation
window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
        console.log('Page restored from back/forward cache, cleaning up...');
        privateChat.cleanupAllListeners();
        
        // Re-initialize based on current page
        const currentPage = window.location.pathname.split('/').pop().split('.')[0];
        if (currentPage === 'chats') {
            setTimeout(() => {
                document.dispatchEvent(new CustomEvent('privateAuthReady'));
            }, 100);
        }
    }
});

// Helper functions for upload modals
function createUploadModal(uploadId, fileName, fileType, onCancel) {
    const existingModal = document.getElementById(`upload-modal-${uploadId}`);
    if (existingModal) {
        existingModal.remove();
    }
    
    const modal = document.createElement('div');
    modal.id = `upload-modal-${uploadId}`;
    modal.className = 'upload-modal';
    
    const isImage = fileType.startsWith('image/');
    
    modal.innerHTML = `
        <div class="upload-header">
            <h4>Uploading ${isImage ? 'Image' : 'Video'}</h4>
            <button class="cancel-upload-btn" id="cancel-upload-${uploadId}">×</button>
        </div>
        <div class="upload-content">
            <div class="upload-info">
                <div class="upload-icon">
                    ${isImage ? '📷' : '🎬'}
                </div>
                <div class="upload-details">
                    <h5>${fileName}</h5>
                    <p>Uploading to chat...</p>
                </div>
            </div>
            <div class="upload-progress">
                <div class="progress-text">
                    <span>Progress</span>
                    <span id="progress-percent-${uploadId}">0%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" id="progress-fill-${uploadId}" style="width: 0%"></div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    document.getElementById(`cancel-upload-${uploadId}`).addEventListener('click', () => {
        if (onCancel && typeof onCancel === 'function') {
            onCancel();
        }
        modal.remove();
    });
    
    return modal;
}

function updateUploadProgress(uploadId, progress) {
    const progressFill = document.getElementById(`progress-fill-${uploadId}`);
    const progressPercent = document.getElementById(`progress-percent-${uploadId}`);
    
    if (progressFill) {
        progressFill.style.width = `${progress}%`;
    }
    
    if (progressPercent) {
        progressPercent.textContent = `${Math.round(progress)}%`;
    }
}

function removeUploadModal(uploadId) {
    const modal = document.getElementById(`upload-modal-${uploadId}`);
    if (modal) {
        modal.remove();
    }
}

// Page initialization functions
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
    
    if (!partnerId) {
        alert('No chat partner specified');
        window.location.href = 'message.html';
        return;
    }
    
    if (!privateChat.firebaseUser) {
        window.location.href = 'login.html';
        return;
    }
    
    if (partnerId === privateChat.firebaseUser.uid) {
        alert('You cannot chat with yourself');
        window.location.href = 'message.html';
        return;
    }
    
    privateChat.currentChatPartnerId = partnerId;
    
    // Clean up any existing listeners for this chat
    const chatId = privateChat.getPrivateChatId(privateChat.firebaseUser.uid, partnerId);
    privateChat.cleanupPrivateChatListeners(chatId);
    
    backBtn.addEventListener('click', () => {
        privateChat.cleanupPrivateChatListeners(chatId);
        reactionUnsubscribers.forEach(unsub => {
            if (typeof unsub === 'function') {
                try {
                    unsub();
                } catch (err) {
                    console.log('Error unsubscribing from reactions:', err);
                }
            }
        });
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
                    const uploadId = 'upload_private_' + Date.now();
                    
                    const modal = createUploadModal(uploadId, file.name, file.type, () => {
                        // Cancel function will be called by the modal
                    });
                    
                    await privateChat.sendPrivateMediaMessage(
                        partnerId, 
                        file, 
                        privateChat.replyingToMessage?.id,
                        (progress) => {
                            updateUploadProgress(uploadId, progress);
                        },
                        (cancelFunction) => {
                            const cancelBtn = document.getElementById(`cancel-upload-${uploadId}`);
                            if (cancelBtn) {
                                const originalClick = cancelBtn.onclick;
                                cancelBtn.onclick = () => {
                                    if (cancelFunction && typeof cancelFunction === 'function') {
                                        cancelFunction();
                                    }
                                    if (originalClick && typeof originalClick === 'function') {
                                        originalClick();
                                    }
                                };
                            }
                        }
                    );
                    
                    removeUploadModal(uploadId);
                    
                } catch (error) {
                    console.error('Error sending media:', error);
                    if (error.message !== 'Upload cancelled') {
                        alert(error.message || 'Failed to send media. Please try again.');
                    }
                }
            }
        });
        
        fileInput.click();
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
            partnerProfile = await privateChat.getUserProfile(partnerId);
            
            if (!partnerProfile) {
                alert('User not found');
                window.location.href = 'message.html';
                return;
            }
            
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
            
            const truncatedPartnerName = privateChat.truncateName(partnerProfile.name);
            if (chatTitle) chatTitle.textContent = truncatedPartnerName;
            if (chatSubtitle) chatSubtitle.textContent = 'Private Chat';
            
            messages = await privateChat.getPrivateMessages(partnerId);
            await loadInitialPrivateReactions();
            queueRender();
            
            if (messagesContainer) {
                privateChat.setupSwipeToReply(messagesContainer);
            }
            
            const chatId = privateChat.getPrivateChatId(privateChat.firebaseUser.uid, partnerId);
            await privateChat.markMessagesAsRead(chatId, partnerId);
            
            if (!isListening) {
                privateChat.listenToPrivateMessages(partnerId, (newMessages) => {
                    const existingIds = new Set(messages.map(m => m.id));
                    const newUniqueMessages = newMessages.filter(msg => !existingIds.has(msg.id));
                    
                    if (newUniqueMessages.length > 0) {
                        messages = [...messages, ...newUniqueMessages];
                        queueRender();
                        
                        if (newUniqueMessages.length > 0) {
                            privateChat.markMessagesAsRead(chatId, partnerId);
                        }
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
        const chatId = privateChat.getPrivateChatId(privateChat.firebaseUser.uid, partnerId);
        for (const message of messages) {
            const reactions = await privateChat.getPrivateMessageReactions(chatId, message.id);
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
        
        messagesContainer.innerHTML = '';
        
        const groupedMessages = [];
        let currentGroup = null;
        
        messages.forEach((message, index) => {
            const messageTime = message.timestamp ? new Date(message.timestamp) : new Date();
            const prevMessage = index > 0 ? messages[index - 1] : null;
            const prevTime = prevMessage && prevMessage.timestamp ? new Date(prevMessage.timestamp) : new Date(0);
            
            const timeDiff = Math.abs(messageTime - prevTime) / (1000 * 60);
            
            if (!prevMessage || 
                prevMessage.senderId !== message.senderId || 
                timeDiff > 5) {
                currentGroup = {
                    senderId: message.senderId,
                    senderName: message.senderId === privateChat.firebaseUser.uid ? 
                        privateChat.currentUser.name : partnerProfile.name,
                    senderAvatar: message.senderId === privateChat.firebaseUser.uid ? 
                        privateChat.currentUser.avatar : partnerProfile.avatar,
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
            
            let userProfile = null;
            if (group.senderId === privateChat.firebaseUser.uid) {
                userProfile = privateChat.currentUser;
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
                                const truncatedName = privateChat.truncateName(repliedMessage.senderName);
                                const truncatedMessage = repliedMessage.text ? 
                                    privateChat.truncateMessage(repliedMessage.text) : 
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
                        
                        const messageDivClass = 'message-text';
                        
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
                                </div>
                            `;
                        } else {
                            messageContent = msg.text || '';
                        }
                        
                        const messageDivId = `message-${msg.id}`;
                        
                        const cachedReactions = reactionsCache.get(msg.id) || [];
                        
                        return `
                            <div class="${messageDivClass}${extraClasses}" data-message-id="${msg.id}" id="${messageDivId}">
                                ${replyHtml}
                                ${messageContent}
                                <div class="message-reactions" id="reactions-${msg.id}">
                                    ${cachedReactions.map(reaction => {
                                        const hasUserReacted = reaction.users && reaction.users.includes(privateChat.firebaseUser?.uid);
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
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
            
            messagesContainer.appendChild(groupDiv);
        });
        
        document.querySelectorAll('.message-avatar').forEach(avatar => {
            avatar.addEventListener('click', (e) => {
                const userId = e.target.dataset.userId;
                if (userId && userId !== privateChat.firebaseUser?.uid) {
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
                        privateChat.currentMessageForReaction = message;
                        privateChat.addReactionToMessage(emoji);
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
                        privateChat.showReactionModal(message);
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
                    privateChat.showReactionModal(message);
                });
            }
        });
        
        privateChat.setupSwipeToReply(messagesContainer);
        
        setupPrivateReactionListeners();
        
        setTimeout(() => {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }, 50);
    }
    
    function setupPrivateReactionListeners() {
        const chatId = privateChat.getPrivateChatId(privateChat.firebaseUser.uid, partnerId);
        
        messages.forEach(message => {
            if (reactionUnsubscribers.has(message.id)) {
                return;
            }
            
            const unsubscribe = privateChat.listenToPrivateMessageReactions(chatId, message.id, (reactions) => {
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
            const hasUserReacted = reaction.users && reaction.users.includes(privateChat.firebaseUser?.uid);
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
                    privateChat.currentMessageForReaction = message;
                    privateChat.addReactionToMessage(reaction.emoji);
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
        
        const originalHTML = sendBtn.innerHTML;
        const originalDisabled = sendBtn.disabled;
        sendBtn.disabled = true;
        
        try {
            await privateChat.sendPrivateMessage(
                partnerId, 
                text, 
                null, 
                null, 
                privateChat.replyingToMessage?.id
            );
            
            messageInput.value = '';
            messageInput.style.height = 'auto';
            messageInput.dispatchEvent(new Event('input'));
            
            privateChat.clearReply();
            
        } catch (error) {
            console.error('Error sending message:', error);
            alert('Failed to send message');
        } finally {
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
        const chatId = privateChat.getPrivateChatId(privateChat.firebaseUser.uid, partnerId);
        privateChat.cleanupPrivateChatListeners(chatId);
        reactionUnsubscribers.forEach(unsub => {
            if (typeof unsub === 'function') {
                try {
                    unsub();
                } catch (err) {
                    console.log('Error unsubscribing from reactions:', err);
                }
            }
        });
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
    const privateBadge = document.getElementById('privateBadge');
    const messagesList = document.getElementById('messagesList');
    
    let privateChats = [];
    
    if (!privateChat.firebaseUser) {
        window.location.href = 'login.html';
        return;
    }
    
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.location.href = 'groups.html';
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
            
            privateChats = await privateChat.getPrivateChats();
            displayPrivateChats();
            
            if (privateBadge) {
                const totalUnread = privateChats.reduce((sum, chat) => sum + (chat.unreadCount || 0), 0);
                privateBadge.textContent = totalUnread > 0 ? totalUnread : '0';
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
            
            const userProfile = privateChat.cache.userProfiles ? 
                privateChat.cache.userProfiles.get(`user_${chat.userId}`)?.data : null;
            
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
    
    if (!privateChat.firebaseUser) {
        window.location.href = 'login.html';
        return;
    }
    
    if (userId === privateChat.firebaseUser.uid) {
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
            const userProfile = await privateChat.getUserProfile(userId);
            
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
            
            const mutualGroups = await privateChat.getMutualGroups(privateChat.firebaseUser.uid, userId);
            
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

window.privateChat = privateChat;

window.privateLogout = function() {
    privateChat.logout();
};

document.addEventListener('DOMContentLoaded', function() {
    const pendingInviteCode = sessionStorage.getItem('pendingInviteCode');
    const currentPage = window.location.pathname.split('/').pop();
    
    if (pendingInviteCode && currentPage === 'join.html' && !window.location.search.includes('code=')) {
        window.location.href = `join.html?code=${pendingInviteCode}`;
        sessionStorage.removeItem('pendingInviteCode');
    }
});

