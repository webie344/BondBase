// group.js - COMPLETE Group Chat System with Voice Channels
// UPDATED VERSION: Added voice channel support with persistent mini player

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
    MEMBERS_LIST: 1 * 60 * 1000
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
            profileSetupChecked: false
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
        
        // Restricted users tracking
        this.restrictedUsers = new Map();
        
        // Voice channels
        this.voiceChannels = new Map(); // groupId -> channels array
        this.unsubscribeVoiceChannels = new Map();
        this.userVoiceChannel = null;
        
        this.setupAuthListener();
        this.createMessageContextMenu();
        
        // Initialize restricted users check
        this.checkRestrictedUsers();
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
    }

    clearAllCache() {
        this.cache = {
            userProfile: null,
            userProfileExpiry: 0,
            joinedGroups: new Map(),
            groupData: new Map(),
            groupMembers: new Map(),
            profileSetupChecked: false
        };
    }

    // Check for restricted users periodically
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
            if (!forceRefresh && this.cache.userProfile && 
                this.cache.userProfile.id === userId && 
                Date.now() < this.cache.userProfileExpiry) {
                return this.cache.userProfile;
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
                    profileComplete: userData.displayName && userData.avatar ? true : false
                };
                
                this.cache.userProfile = profile;
                this.cache.userProfileExpiry = Date.now() + CACHE_DURATION.USER_PROFILE;
                
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
            
            const chatId = this.getPrivateChatId(this.firebaseUser.uid, toUserId);
            const messagesRef = collection(db, 'private_chats', chatId, 'messages');
            
            const messageData = {
                senderId: this.firebaseUser.uid,
                senderName: this.currentUser.name,
                senderAvatar: this.currentUser.avatar,
                timestamp: serverTimestamp(),
                read: false
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
                status: 'uploading'
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
                    timestamp: data.timestamp ? (data.timestamp.toDate ? data.timestamp.toDate() : data.timestamp) : new Date()
                });
            });
            
            this.tempPrivateMessages.forEach((tempMsg, tempId) => {
                if (!messages.some(m => m.id === tempId)) {
                    messages.push(tempMsg);
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
            if (this.unsubscribePrivateMessages) {
                this.unsubscribePrivateMessages();
            }
            
            const chatId = this.getPrivateChatId(this.firebaseUser.uid, otherUserId);
            const messagesRef = collection(db, 'private_chats', chatId, 'messages');
            const q = query(messagesRef, orderBy('timestamp', 'asc'));
            
            this.unsubscribePrivateMessages = onSnapshot(q, (snapshot) => {
                const messages = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    messages.push({ 
                        id: doc.id, 
                        ...data,
                        timestamp: data.timestamp ? (data.timestamp.toDate ? data.timestamp.toDate() : data.timestamp) : new Date()
                    });
                });
                
                this.tempPrivateMessages.forEach((tempMsg, tempId) => {
                    if (!messages.some(m => m.id === tempId)) {
                        messages.push(tempMsg);
                    }
                });
                
                callback(messages);
            });
            
            return this.unsubscribePrivateMessages;
        } catch (error) {
            console.error('Error listening to private messages:', error);
            throw error;
        }
    }

    async getPrivateChats() {
        try {
            if (!this.firebaseUser) return [];
            
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
            
            return chats;
        } catch (error) {
            console.error('Error getting private chats:', error);
            return [];
        }
    }

    async getUnreadMessageCount(chatId, otherUserId) {
        try {
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
            
            const groupsRef = collection(db, 'groups');
            const querySnapshot = await getDocs(groupsRef);
            
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
            const groupsRef = collection(db, 'groups');
            const q = query(groupsRef, where('inviteCode', '==', inviteCode));
            const querySnapshot = await getDocs(q);
            
            if (!querySnapshot.empty) {
                const doc = querySnapshot.docs[0];
                const data = doc.data();
                return { 
                    id: doc.id, 
                    ...data,
                    createdAt: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate() : data.createdAt) : new Date(),
                    updatedAt: data.updatedAt ? (data.updatedAt.toDate ? data.updatedAt.toDate() : data.updatedAt) : new Date()
                };
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
                maxMembers: groupData.maxMembers || 50,
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

    async sendMessage(groupId, text = null, imageUrl = null, videoUrl = null, replyTo = null) {
        try {
            if (!this.firebaseUser || !this.currentUser) {
                throw new Error('You must be logged in to send messages');
            }
            
            // Check if user is restricted
            const isRestricted = await this.isUserRestricted(groupId, this.firebaseUser.uid);
            if (isRestricted) {
                throw new Error('You are restricted from sending messages in this group for 2 hours due to using restricted words.');
            }
            
            if (!text && !imageUrl && !videoUrl) {
                throw new Error('Message cannot be empty');
            }
            
            // Check for restricted words in text messages
            if (text) {
                const restrictedWord = await this.checkMessageForRestrictedWords(groupId, text);
                if (restrictedWord) {
                    // Restrict the user
                    await this.restrictUser(groupId, this.firebaseUser.uid, 2);
                    throw new Error(`Your message contains a restricted word (${restrictedWord}). You have been restricted from chatting for 2 hours.`);
                }
            }
            
            const messageId = `${groupId}_${this.firebaseUser.uid}_${Date.now()}`;
            
            if (this.sentMessageIds.has(messageId)) {
                console.log('Duplicate message prevented:', messageId);
                return true;
            }
            
            this.sentMessageIds.add(messageId);
            
            const messagesRef = collection(db, 'groups', groupId, 'messages');
            const messageData = {
                senderId: this.firebaseUser.uid,
                senderName: this.currentUser.name,
                senderAvatar: this.currentUser.avatar,
                timestamp: serverTimestamp()
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
            
            await this.updateLastActive(groupId);
            
            this.clearReply();
            
            return true;
        } catch (error) {
            console.error('Error sending message:', error);
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
            
            return messages.reverse();
        } catch (error) {
            console.error('Error getting messages:', error);
            throw error;
        }
    }

    listenToMessages(groupId, callback) {
        try {
            if (this.unsubscribeMessages) {
                this.unsubscribeMessages();
                this.unsubscribeMessages = null;
            }
            
            const messagesRef = collection(db, 'groups', groupId, 'messages');
            const q = query(messagesRef, orderBy('timestamp', 'asc'));
            
            this.unsubscribeMessages = onSnapshot(q, (snapshot) => {
                const messages = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    messages.push({ 
                        id: doc.id, 
                        ...data,
                        timestamp: data.timestamp ? (data.timestamp.toDate ? data.timestamp.toDate() : data.timestamp) : new Date()
                    });
                });
                callback(messages);
            });
            
            return this.unsubscribeMessages;
        } catch (error) {
            console.error('Error listening to messages:', error);
            throw error;
        }
    }

    listenToMembers(groupId, callback) {
        try {
            if (this.unsubscribeMembers) {
                this.unsubscribeMembers();
                this.unsubscribeMembers = null;
            }
            
            const membersRef = collection(db, 'groups', groupId, 'members');
            const q = query(membersRef, orderBy('joinedAt', 'asc'));
            
            this.unsubscribeMembers = onSnapshot(q, (snapshot) => {
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
            });
            
            return this.unsubscribeMembers;
        } catch (error) {
            console.error('Error listening to members:', error);
            throw error;
        }
    }

    // NEW: Listen to voice channels
    listenToVoiceChannels(groupId, callback) {
        try {
            if (this.unsubscribeVoiceChannels.has(groupId)) {
                this.unsubscribeVoiceChannels.get(groupId)();
            }
            
            const channelsRef = collection(db, 'voice_channels', groupId, 'channels');
            const q = query(channelsRef, orderBy('createdAt', 'desc'));
            
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const channels = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    channels.push({
                        id: doc.id,
                        ...data,
                        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
                        participants: data.participants || []
                    });
                });
                
                this.voiceChannels.set(groupId, channels);
                callback(channels);
            });
            
            this.unsubscribeVoiceChannels.set(groupId, unsubscribe);
            return unsubscribe;
            
        } catch (error) {
            console.error('Error listening to voice channels:', error);
            throw error;
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

    createMessageContextMenu() {
        const existingMenu = document.getElementById('messageContextMenu');
        if (existingMenu) {
            existingMenu.remove();
        }
        
        this.messageContextMenu = document.createElement('div');
        this.messageContextMenu.id = 'messageContextMenu';
        this.messageContextMenu.className = 'message-context-menu';
        this.messageContextMenu.innerHTML = `
            <div class="menu-item" id="replyMenuItem">
                <i class="fas fa-reply"></i>
                <span>Reply</span>
            </div>
        `;
        
        const contextMenuStyles = document.createElement('style');
        contextMenuStyles.id = 'context-menu-styles';
        contextMenuStyles.textContent = `
            .message-context-menu {
                position: fixed;
                background: white;
                border-radius: 8px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                z-index: 9998;
                display: none;
                min-width: 120px;
                overflow: hidden;
            }
            
            .menu-item {
                padding: 12px 16px;
                display: flex;
                align-items: center;
                gap: 10px;
                cursor: pointer;
                transition: background 0.2s;
            }
            
            .menu-item:hover {
                background: #f5f5f5;
            }
            
            .menu-item i {
                width: 20px;
                color: #666;
            }
        `;
        
        document.head.appendChild(contextMenuStyles);
        document.body.appendChild(this.messageContextMenu);
        
        document.getElementById('replyMenuItem').addEventListener('click', () => {
            this.handleReply();
            this.hideContextMenu();
        });
        
        document.addEventListener('click', (e) => {
            if (this.messageContextMenu && !this.messageContextMenu.contains(e.target)) {
                this.hideContextMenu();
            }
        });
        
        this.messageContextMenu.addEventListener('wheel', (e) => {
            e.preventDefault();
        });
    }

    showContextMenu(x, y, message) {
        this.selectedMessage = message;
        
        this.messageContextMenu.style.left = x + 'px';
        this.messageContextMenu.style.top = y + 'px';
        this.messageContextMenu.style.display = 'block';
        
        const rect = this.messageContextMenu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            this.messageContextMenu.style.left = (x - rect.width) + 'px';
        }
        if (rect.bottom > window.innerHeight) {
            this.messageContextMenu.style.top = (y - rect.height) + 'px';
        }
    }

    hideContextMenu() {
        if (this.messageContextMenu) {
            this.messageContextMenu.style.display = 'none';
        }
        this.selectedMessage = null;
    }

    handleReply() {
        if (!this.selectedMessage) return;
        
        this.replyingToMessage = this.selectedMessage;
        this.showReplyIndicator();
        
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            messageInput.focus();
        }
    }

    truncateName(name) {
        if (!name) return '';
        if (name.length <= 6) return name;
        return name.substring(0, 6) + '...';
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
                <i class="fas fa-times"></i>
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

    setupMessageLongPress(messagesContainer) {
        if (!messagesContainer) return;
        
        messagesContainer.onmousedown = null;
        messagesContainer.ontouchstart = null;
        messagesContainer.onmouseup = null;
        messagesContainer.ontouchend = null;
        messagesContainer.oncontextmenu = null;
        
        let isDragging = false;
        let startX = 0;
        let startY = 0;
        const dragThreshold = 10;
        
        const handleStart = (e) => {
            const clientX = e.clientX || (e.touches && e.touches[0].clientX);
            const clientY = e.clientY || (e.touches && e.touches[0].clientY);
            
            if (!clientX || !clientY) return;
            
            startX = clientX;
            startY = clientY;
            isDragging = false;
            
            this.longPressTimer = setTimeout(() => {
                if (!isDragging) {
                    let messageElement = e.target;
                    while (messageElement && !messageElement.classList.contains('message-text') && 
                           !messageElement.classList.contains('message-group') && 
                           messageElement !== messagesContainer) {
                        messageElement = messageElement.parentElement;
                    }
                    
                    if (messageElement && messageElement !== messagesContainer) {
                        const messageId = this.findMessageIdFromElement(messageElement);
                        if (messageId) {
                            const message = window.currentMessages?.find(m => m.id === messageId);
                            if (message) {
                                e.preventDefault();
                                this.showContextMenu(clientX, clientY, message);
                            }
                        }
                    }
                }
            }, 500);
        };
        
        const handleMove = (e) => {
            const clientX = e.clientX || (e.touches && e.touches[0].clientX);
            const clientY = e.clientY || (e.touches && e.touches[0].clientY);
            
            if (!clientX || !clientY) return;
            
            const deltaX = Math.abs(clientX - startX);
            const deltaY = Math.abs(clientY - startY);
            
            if (deltaX > dragThreshold || deltaY > dragThreshold) {
                isDragging = true;
                if (this.longPressTimer) {
                    clearTimeout(this.longPressTimer);
                    this.longPressTimer = null;
                }
            }
        };
        
        const handleEnd = () => {
            if (this.longPressTimer) {
                clearTimeout(this.longPressTimer);
                this.longPressTimer = null;
            }
        };
        
        messagesContainer.addEventListener('mousedown', handleStart);
        messagesContainer.addEventListener('touchstart', handleStart);
        messagesContainer.addEventListener('mousemove', handleMove);
        messagesContainer.addEventListener('touchmove', handleMove);
        messagesContainer.addEventListener('mouseup', handleEnd);
        messagesContainer.addEventListener('touchend', handleEnd);
        messagesContainer.addEventListener('touchcancel', handleEnd);
        
        messagesContainer.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
    }

    findMessageIdFromElement(element) {
        let current = element;
        while (current && current !== document.body) {
            if (current.dataset && current.dataset.messageId) {
                return current.dataset.messageId;
            }
            current = current.parentElement;
        }
        return null;
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
            this.unsubscribeMessages();
            this.unsubscribeMessages = null;
        }
        
        if (this.unsubscribeMembers) {
            this.unsubscribeMembers();
            this.unsubscribeMembers = null;
        }
        
        if (this.unsubscribePrivateMessages) {
            this.unsubscribePrivateMessages();
            this.unsubscribePrivateMessages = null;
        }
        
        if (this.unsubscribePrivateChats) {
            this.unsubscribePrivateChats();
            this.unsubscribePrivateChats = null;
        }
        
        if (this.unsubscribeAuth) {
            this.unsubscribeAuth();
            this.unsubscribeAuth = null;
        }
        
        // Clean up voice channel listeners
        this.unsubscribeVoiceChannels.forEach(unsubscribe => {
            if (unsubscribe) unsubscribe();
        });
        this.unsubscribeVoiceChannels.clear();
        
        this.areListenersSetup = false;
        this.sentMessageIds.clear();
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
    
    // Photo upload functionality
    photoPreview.addEventListener('click', () => {
        groupPhotoInput.click();
    });

    uploadPhotoBtn.addEventListener('click', () => {
        groupPhotoInput.click();
    });

    groupPhotoInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            // Validate file type
            const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
            if (!validTypes.includes(file.type)) {
                alert('Please upload a valid image file (JPEG, PNG, GIF, WebP)');
                return;
            }

            // Validate file size (max 5MB)
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
                        <i class="fas fa-plus"></i>
                    </button>
                ` : `
                    <button type="button" class="remove-rule-btn remove-topic-btn">
                        <i class="fas fa-minus"></i>
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
                        <i class="fas fa-plus"></i>
                    </button>
                ` : `
                    <button type="button" class="remove-rule-btn remove-rule-btn">
                        <i class="fas fa-minus"></i>
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
        
        // Get restricted words from input
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
        createBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
        
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
                    <i class="fas fa-users-slash"></i>
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
                            <i class="fas fa-users"></i>
                            ${group.memberCount || 0} / ${group.maxMembers || 50}
                        </span>
                        <span class="group-privacy">
                            <i class="fas ${group.privacy === 'private' ? 'fa-lock' : 'fa-globe'}"></i>
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
                                    <i class="fas fa-check-circle"></i>
                                    <span>${rule}</span>
                                </li>`
                            ).join('')}
                            ${(group.rules || []).length > 2 ? 
                                `<li class="rule-item">
                                    <i class="fas fa-ellipsis-h"></i>
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
                    return;
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
        joinBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        
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
    const groupVoiceCallBtn = document.getElementById('groupVoiceCallBtn');
    
    const urlParams = new URLSearchParams(window.location.search);
    const groupId = urlParams.get('id');
    
    let messages = [];
    let members = [];
    let groupData = null;
    let tempMessages = new Map();
    let isInitialLoad = true;
    let voiceChannels = [];
    
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
        setupVoiceChannels();
    })();
    
    backBtn.addEventListener('click', () => {
        groupChat.cleanup();
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
    
    if (groupVoiceCallBtn) {
        groupVoiceCallBtn.addEventListener('click', () => {
            if (window.callsModule) {
                window.callsModule.initiateGroupCall(groupId);
            } else {
                window.location.href = `calls.html?type=group&groupId=${groupId}&incoming=false`;
            }
        });
    }
    
    messageInput.addEventListener('input', () => {
        sendBtn.disabled = !messageInput.value.trim();
        
        messageInput.style.height = 'auto';
        messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
    });
    
    sendBtn.addEventListener('click', () => sendMessage());
    
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
                    attachmentBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                    attachmentBtn.disabled = true;
                    
                    await groupChat.sendMediaMessage(groupId, file, groupChat.replyingToMessage?.id);
                    
                    attachmentBtn.innerHTML = originalHTML;
                    attachmentBtn.disabled = false;
                    
                } catch (error) {
                    console.error('Error sending media:', error);
                    alert(error.message || 'Failed to send media. Please try again.');
                    
                    attachmentBtn.innerHTML = '<i class="fas fa-paperclip"></i>';
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
            displayMessages();
        }
    });
    
    document.addEventListener('removeTempMessage', (e) => {
        const tempId = e.detail.tempId;
        tempMessages.delete(tempId);
        
        const tempMsgIndex = messages.findIndex(m => m.id === tempId);
        if (tempMsgIndex !== -1) {
            messages.splice(tempMsgIndex, 1);
            displayMessages();
        }
    });
    
    // NEW: Setup voice channels
    function setupVoiceChannels() {
        // Create voice channels UI if not exists
        createVoiceChannelsUI();
        
        // Listen to voice channels
        groupChat.listenToVoiceChannels(groupId, (channels) => {
            voiceChannels = channels;
            updateVoiceChannelsUI(channels);
        });
    }
    
    // NEW: Create voice channels UI
    function createVoiceChannelsUI() {
        // Check if container already exists
        if (document.getElementById('voiceChannelsContainer')) return;
        
        const voiceChannelsSection = document.createElement('div');
        voiceChannelsSection.id = 'voiceChannelsSection';
        voiceChannelsSection.className = 'voice-channels-section';
        voiceChannelsSection.innerHTML = `
            <div class="voice-channels-header">
                <h3><i class="fas fa-volume-up"></i> Voice Channels</h3>
                <button id="toggleVoiceChannels" class="toggle-channels-btn">
                    <i class="fas fa-chevron-down"></i>
                </button>
            </div>
            <div id="voiceChannelsContainer" class="voice-channels-container">
                <div class="loading-channels">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>Loading voice channels...</p>
                </div>
            </div>
        `;
        
        const chatHeader = document.querySelector('.chat-header');
        if (chatHeader) {
            chatHeader.parentNode.insertBefore(voiceChannelsSection, chatHeader.nextSibling);
        } else {
            document.querySelector('.chat-container').insertBefore(voiceChannelsSection, document.querySelector('.messages-container'));
        }
        
        // Add toggle functionality
        const toggleBtn = document.getElementById('toggleVoiceChannels');
        const container = document.getElementById('voiceChannelsContainer');
        
        toggleBtn.addEventListener('click', () => {
            const isVisible = container.style.display !== 'none';
            container.style.display = isVisible ? 'none' : 'block';
            toggleBtn.innerHTML = isVisible ? 
                '<i class="fas fa-chevron-down"></i>' : 
                '<i class="fas fa-chevron-up"></i>';
        });
        
        // Initialize with channels visible
        container.style.display = 'block';
    }
    
    // NEW: Update voice channels UI
    function updateVoiceChannelsUI(channels) {
        const container = document.getElementById('voiceChannelsContainer');
        if (!container) return;
        
        if (channels.length === 0) {
            container.innerHTML = `
                <div class="no-voice-channels">
                    <i class="fas fa-volume-mute"></i>
                    <p>No active voice channels</p>
                    <button id="startFirstVoiceChannel" class="start-voice-channel-btn">
                        <i class="fas fa-plus"></i> Start First Voice Channel
                    </button>
                </div>
            `;
            
            const startBtn = document.getElementById('startFirstVoiceChannel');
            if (startBtn) {
                startBtn.addEventListener('click', () => {
                    if (window.callsModule && window.callsModule.createVoiceChannel) {
                        window.callsModule.createVoiceChannel(groupId);
                    } else {
                        showNotification('Voice channel system not loaded. Please refresh the page.', 'error');
                    }
                });
            }
            return;
        }
        
        container.innerHTML = '';
        
        channels.forEach(channel => {
            const channelElement = document.createElement('div');
            channelElement.className = 'voice-channel-card';
            
            // Check if user is in this channel
            const isUserInChannel = window.callsModule?.isUserInChannel?.(channel.id);
            
            channelElement.innerHTML = `
                <div class="channel-header">
                    <div class="channel-icon">
                        <i class="fas fa-volume-up"></i>
                    </div>
                    <div class="channel-info">
                        <h4 class="channel-name">${channel.name || 'Voice Channel'}</h4>
                        <div class="channel-meta">
                            <span class="channel-creator">
                                <i class="fas fa-user"></i> ${channel.createdBy || 'Unknown'}
                            </span>
                            <span class="channel-time">
                                <i class="fas fa-clock"></i> ${formatTimeAgo(channel.createdAt)}
                            </span>
                        </div>
                    </div>
                </div>
                <div class="channel-participants">
                    <div class="participants-count">
                        <i class="fas fa-users"></i>
                        <span>${channel.participants?.length || 0} / 30</span>
                    </div>
                    <div class="participants-list">
                        ${(channel.participants || []).slice(0, 5).map(() => 
                            `<span class="participant-dot"></span>`
                        ).join('')}
                        ${(channel.participants?.length || 0) > 5 ? 
                            `<span class="more-participants">+${(channel.participants?.length || 0) - 5}</span>` : ''
                        }
                    </div>
                </div>
                <div class="channel-actions">
                    ${(channel.participants?.length || 0) >= 30 ? 
                        `<button class="join-channel-btn full" disabled>
                            <i class="fas fa-lock"></i> Channel Full
                        </button>` :
                        `<button class="join-channel-btn ${isUserInChannel ? 'active' : ''}" data-channel-id="${channel.id}">
                            ${isUserInChannel ? 
                                `<i class="fas fa-phone-slash"></i> Leave` : 
                                `<i class="fas fa-phone-alt"></i> Join`
                            }
                        </button>`
                    }
                </div>
            `;
            
            const joinBtn = channelElement.querySelector('.join-channel-btn');
            if (joinBtn && !joinBtn.disabled) {
                joinBtn.addEventListener('click', () => {
                    if (window.callsModule) {
                        if (isUserInChannel) {
                            window.callsModule.leaveVoiceChannel(channel.id, groupId);
                        } else {
                            window.callsModule.joinVoiceChannel(channel.id, groupId);
                        }
                    } else {
                        showNotification('Voice channel system not loaded. Please refresh the page.', 'error');
                    }
                });
            }
            
            container.appendChild(channelElement);
        });
        
        // Add "Start New Channel" button
        const startNewChannel = document.createElement('div');
        startNewChannel.className = 'start-new-channel';
        startNewChannel.innerHTML = `
            <button id="startNewVoiceChannel" class="start-new-channel-btn">
                <i class="fas fa-plus-circle"></i> Start New Voice Channel
            </button>
        `;
        
        container.appendChild(startNewChannel);
        
        const startBtn = document.getElementById('startNewVoiceChannel');
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                if (window.callsModule && window.callsModule.createVoiceChannel) {
                    window.callsModule.createVoiceChannel(groupId);
                } else {
                    showNotification('Voice channel system not loaded. Please refresh the page.', 'error');
                }
            });
        }
    }
    
    // NEW: Format time ago
    function formatTimeAgo(date) {
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
            if (chatTitle) chatTitle.textContent = groupData.name;
            if (chatSubtitle) chatSubtitle.textContent = groupData.description;
            
            if (rulesList) {
                rulesList.innerHTML = '';
                (groupData.rules || []).forEach(rule => {
                    const li = document.createElement('li');
                    li.className = 'rule-item';
                    li.innerHTML = `<i class="fas fa-check-circle"></i><span>${rule}</span>`;
                    rulesList.appendChild(li);
                });
            }
            
            addInviteLinkButton();
            
            members = await groupChat.getGroupMembers(groupId);
            updateMembersList();
            
            if (isInitialLoad) {
                messages = await groupChat.getMessages(groupId);
                displayMessages();
                isInitialLoad = false;
            }
            
        } catch (error) {
            console.error('Error loading group data:', error);
            alert('Error loading group data. Please try again.');
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
            copyBtn.innerHTML = '<i class="fas fa-link"></i> Copy Invite Link';
            
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
                    
                    .copy-invite-btn.copied i {
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
                `;
                document.head.appendChild(styles);
            }
            
            copyBtn.addEventListener('click', async () => {
                let isCopying = false;
                
                if (isCopying) return;
                
                isCopying = true;
                copyBtn.disabled = true;
                copyBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Getting link...';
                statusDiv.textContent = '';
                statusDiv.className = 'invite-link-status';
                
                try {
                    const inviteLink = await groupChat.getGroupInviteLink(groupId);
                    
                    await navigator.clipboard.writeText(inviteLink);
                    
                    copyBtn.innerHTML = '<i class="fas fa-check"></i> Link Copied!';
                    copyBtn.classList.add('copied');
                    
                    statusDiv.textContent = 'Invite link copied to clipboard!';
                    statusDiv.classList.add('success');
                    
                    copyBtn.title = `Link: ${inviteLink}`;
                    
                    setTimeout(() => {
                        copyBtn.innerHTML = '<i class="fas fa-link"></i> Copy Invite Link';
                        copyBtn.classList.remove('copied');
                        copyBtn.disabled = false;
                        statusDiv.textContent = 'Share this link to invite others';
                        statusDiv.className = 'invite-link-status';
                        isCopying = false;
                    }, 3000);
                    
                } catch (error) {
                    console.error('Error copying invite link:', error);
                    
                    copyBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Error';
                    copyBtn.disabled = false;
                    
                    statusDiv.textContent = 'Failed to copy link. Please try again.';
                    statusDiv.classList.add('error');
                    
                    setTimeout(() => {
                        copyBtn.innerHTML = '<i class="fas fa-link"></i> Copy Invite Link';
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
        if (groupChat.areListenersSetup) {
            console.log('Listeners already set up, skipping...');
            return;
        }
        
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
            displayMessages();
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
        
        const activeInterval = setInterval(() => {
            groupChat.updateLastActive(groupId);
        }, 60000);
        
        window.addEventListener('focus', () => {
            groupChat.updateLastActive(groupId);
        });
        
        window.addEventListener('beforeunload', () => {
            clearInterval(activeInterval);
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
            
            const div = document.createElement('div');
            div.className = 'member-item';
            div.innerHTML = `
                <img src="${member.avatar}" alt="${member.name}" class="member-avatar" data-user-id="${member.id}">
                <div class="member-info">
                    <div class="member-name">
                        ${member.name}
                        ${isAdmin ? '<span style="margin-left: 6px; background: var(--primary); color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px;">Admin</span>' : ''}
                        ${isCurrentUser ? '<span style="margin-left: 6px; background: #666; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px;">You</span>' : ''}
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
        
        const groupedMessages = [];
        let currentGroup = null;
        
        messages.forEach((message, index) => {
            const messageTime = message.timestamp ? new Date(message.timestamp) : new Date();
            const prevMessage = messages[index - 1];
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
        
        messagesContainer.innerHTML = '';
        
        groupedMessages.forEach(group => {
            const groupDiv = document.createElement('div');
            groupDiv.className = 'message-group';
            groupDiv.dataset.senderId = group.senderId;
            
            const firstMessage = group.messages[0];
            const firstMessageTime = firstMessage.timestamp ? new Date(firstMessage.timestamp) : new Date();
            
            groupDiv.innerHTML = `
                <div class="message-header">
                    <img src="${group.senderAvatar}" 
                         alt="${group.senderName}" 
                         class="message-avatar"
                         data-user-id="${group.senderId}">
                    <span class="message-sender">${group.senderName}</span>
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
                        
                        if (msg.imageUrl) {
                            return `
                                <div class="${messageDivClass}" data-message-id="${msg.id}">
                                    ${replyHtml}
                                    <div class="message-image-container" style="position: relative;">
                                        <img src="${msg.imageUrl}" 
                                             alt="Shared image" 
                                             class="message-image"
                                             style="max-width: 300px; max-height: 300px; border-radius: 8px; cursor: pointer;"
                                             onclick="openImageModal('${msg.imageUrl}')">
                                        ${isUploading ? `
                                            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                                                   background: rgba(0,0,0,0.7); color: white; padding: 8px 12px; border-radius: 20px;
                                                   font-size: 12px; display: flex; align-items: center; gap: 6px;">
                                                <i class="fas fa-spinner fa-spin"></i> Uploading...
                                            </div>
                                        ` : ''}
                                    </div>
                                    ${isTemp ? '<div style="font-size: 11px; color: #999; margin-top: 4px;">Sending...</div>' : ''}
                                </div>
                            `;
                        } else if (msg.videoUrl) {
                            return `
                                <div class="${messageDivClass}" data-message-id="${msg.id}">
                                    ${replyHtml}
                                    <div class="message-video-container" style="position: relative;">
                                        <video controls style="max-width: 300px; max-height: 300px; border-radius: 8px;">
                                            <source src="${msg.videoUrl}" type="video/mp4">
                                            Your browser does not support the video tag.
                                        </video>
                                        ${isUploading ? `
                                            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                                                   background: rgba(0,0,0,0.7); color: white; padding: 8px 12px; border-radius: 20px;
                                                   font-size: 12px; display: flex; align-items: center; gap: 6px;">
                                                <i class="fas fa-spinner fa-spin"></i> Uploading...
                                            </div>
                                        ` : ''}
                                    </div>
                                    ${isTemp ? '<div style="font-size: 11px; color: #999; margin-top: 4px;">Sending...</div>' : ''}
                                </div>
                            `;
                        } else if (msg.type === 'system') {
                            return `
                                <div class="${messageDivClass}" data-message-id="${msg.id}">
                                    <div style="font-style: italic; color: #666; text-align: center; padding: 4px 0;">
                                        ${msg.text}
                                    </div>
                                </div>
                            `;
                        } else {
                            return `
                                <div class="${messageDivClass}" data-message-id="${msg.id}">
                                    ${replyHtml}
                                    ${msg.text || ''}
                                    ${isTemp ? '<div style="font-size: 11px; color: #999; margin-top: 4px;">Sending...</div>' : ''}
                                </div>
                            `;
                        }
                    }).join('')}
                </div>
            `;
            
            messagesContainer.appendChild(groupDiv);
        });
        
        document.querySelectorAll('.message-avatar').forEach(avatar => {
            avatar.addEventListener('click', (e) => {
                const userId = e.target.dataset.userId;
                if (userId && userId !== groupChat.firebaseUser?.uid) {
                    window.open(`user.html?id=${userId}`, '_blank');
                }
            });
        });
        
        groupChat.setupMessageLongPress(messagesContainer);
        
        setTimeout(() => {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }, 100);
    }
    
    async function sendMessage() {
        const text = messageInput.value.trim();
        
        if (!text) return;
        
        sendBtn.disabled = true;
        sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        
        try {
            await groupChat.sendMessage(groupId, text);
            
            messageInput.value = '';
            messageInput.style.height = 'auto';
            messageInput.dispatchEvent(new Event('input'));
            
        } catch (error) {
            console.error('Error sending message:', error);
            alert(error.message || 'Failed to send message. Please try again.');
        } finally {
            sendBtn.disabled = false;
            sendBtn.innerHTML = 'Send';
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
                            <i class="fas fa-users-slash"></i>
                            <h3>No Groups Created Yet</h3>
                            <p>You haven't created any groups yet. Create your first group to get started!</p>
                            <button id="createFirstGroupBtn" class="primary-btn">
                                <i class="fas fa-plus"></i> Create Your First Group
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
                        <i class="fas fa-exclamation-triangle"></i>
                        <h3>Error Loading Groups</h3>
                        <p>${error.message || 'Failed to load groups. Please try again.'}</p>
                        <button onclick="location.reload()" class="primary-btn">
                            <i class="fas fa-redo"></i> Retry
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
                                    <i class="fas fa-users"></i>
                                    ${group.memberCount || 0} members
                                </span>
                                <span class="group-date">
                                    <i class="fas fa-calendar"></i>
                                    Created ${createdAt}
                                </span>
                                <span class="group-privacy">
                                    <i class="fas ${group.privacy === 'private' ? 'fa-lock' : 'fa-globe'}"></i>
                                    ${group.privacy === 'private' ? 'Private' : 'Public'}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div class="group-actions">
                        <button class="view-group-btn" onclick="window.location.href='group.html?id=${group.id}'">
                            <i class="fas fa-comments"></i> View Chat
                        </button>
                        <button class="invite-link-admin-btn" onclick="copyGroupInviteLink('${group.id}')">
                            <i class="fas fa-link"></i> Copy Invite
                        </button>
                        <button class="manage-members-btn" onclick="viewGroupMembers('${group.id}', '${group.name.replace(/'/g, "\\'")}')">
                            <i class="fas fa-users"></i> Manage Members
                        </button>
                        <button class="delete-group-btn" onclick="confirmDeleteGroup('${group.id}', '${group.name.replace(/'/g, "\\'")}')">
                            <i class="fas fa-trash"></i> Delete
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
                event.target.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
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
                        
                        memberItem.innerHTML = `
                            <div class="member-info">
                                <img src="${member.avatar || AVATAR_OPTIONS[0]}" 
                                     alt="${member.name}" 
                                     class="member-avatar">
                                <div class="member-details">
                                    <h4>
                                        ${member.name}
                                        ${isAdmin ? '<span class="admin-badge">Admin</span>' : ''}
                                        ${isCurrentUser ? '<span class="you-badge">You</span>' : ''}
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
                                        <i class="fas fa-user-minus"></i> Remove
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
                event.target.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
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
        if (confirm(`Are you sure you want to remove "${memberName}" from this group?\n\nThey will be notified and will lose access to all group messages.`)) {
            removeMember(groupId, memberId, memberName);
        }
    };
    
    async function removeMember(groupId, memberId, memberName) {
        try {
            const originalText = event?.target?.innerHTML || 'Remove';
            if (event?.target) {
                event.target.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Removing...';
                event.target.disabled = true;
            }
            
            await groupChat.removeMemberFromGroup(groupId, memberId, memberName);
            
            alert(`"${memberName}" has been removed from the group.`);
            
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
            const maxMembers = group.maxMembers || 50;
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
                                            <i class="fas ${group.privacy === 'private' ? 'fa-lock' : 'fa-globe'}"></i>
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
                                    <i class="fas fa-users"></i>
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
                                    <i class="fas fa-user-circle"></i>
                                    <div class="stat-content">
                                        <span class="stat-value">${group.creatorName || 'Unknown'}</span>
                                        <span class="stat-label">Created by</span>
                                    </div>
                                </div>
                                <div class="stat-item">
                                    <i class="fas fa-calendar"></i>
                                    <div class="stat-content">
                                        <span class="stat-value">${group.createdAt ? new Date(group.createdAt).toLocaleDateString() : 'Unknown'}</span>
                                        <span class="stat-label">Created on</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        ${group.topics && group.topics.length > 0 ? `
                            <div class="group-section">
                                <h3><i class="fas fa-comments"></i> Discussion Topics</h3>
                                <div class="topics-grid">
                                    ${group.topics.map(topic => 
                                        `<span class="topic-chip">${topic}</span>`
                                    ).join('')}
                                </div>
                            </div>
                        ` : ''}
                        
                        ${group.rules && group.rules.length > 0 ? `
                            <div class="group-section">
                                <h3><i class="fas fa-gavel"></i> Group Rules</h3>
                                <ul class="rules-list">
                                    ${group.rules.map(rule => 
                                        `<li><i class="fas fa-check-circle"></i> ${rule}</li>`
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
                            joinBtn.innerHTML = '<i class="fas fa-comments"></i> Enter Group Chat';
                            joinBtn.className = 'join-btn success';
                            joinBtn.onclick = () => {
                                window.location.href = `group.html?id=${group.id}`;
                            };
                        } else {
                            joinBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Join Group';
                            joinBtn.className = 'join-btn primary';
                            joinBtn.onclick = async () => {
                                await joinGroup(group.id);
                            };
                        }
                    }).catch(error => {
                        console.error('Error checking membership:', error);
                        joinBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Join Group';
                        joinBtn.className = 'join-btn primary';
                        joinBtn.onclick = async () => {
                            await joinGroup(group.id);
                        };
                    });
                } else {
                    joinBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login to Join';
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
                joinBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Joining...';
            }
            
            await groupChat.joinGroup(groupId);
            
            alert('Successfully joined the group!');
            
            window.location.href = `group.html?id=${groupId}`;
            
        } catch (error) {
            console.error('Error joining group:', error);
            showError('Error joining group: ' + error.message, error);
            
            if (joinBtn) {
                joinBtn.disabled = false;
                joinBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Join Group';
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
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Error</h3>
                </div>
                <p class="error-message">${message}</p>
                ${error ? `
                    <div class="error-details">${error.stack || error.toString()}</div>
                    <div class="error-actions">
                        <button class="error-btn retry-btn" onclick="location.reload()">
                            <i class="fas fa-redo"></i> Retry
                        </button>
                        <button class="error-btn details-btn" onclick="this.parentElement.parentElement.classList.toggle('show-details')">
                            <i class="fas fa-code"></i> Show Details
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
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Error</h3>
                </div>
                <p class="error-message">${message}</p>
                ${error ? `
                    <div class="error-details">${error.stack || error.toString()}</div>
                    <div class="error-actions">
                        <button class="error-btn retry-btn" onclick="location.reload()">
                            <i class="fas fa-redo"></i> Retry
                        </button>
                        <button class="error-btn details-btn" onclick="this.parentElement.parentElement.classList.toggle('show-details')">
                            <i class="fas fa-code"></i> Show Details
                        </button>
                    </div>
                ` : ''}
            `;
            errorNotification.classList.add('show');
        }
        
        if (groupInfo) {
            groupInfo.innerHTML = `
                <div class="error-placeholder">
                    <i class="fas fa-exclamation-circle"></i>
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
            
            if (userAvatar) userAvatar.src = userProfile.avatar;
            if (userName) userName.textContent = userProfile.name;
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
    const voiceCallBtn = document.getElementById('voiceCallBtn');
    
    const urlParams = new URLSearchParams(window.location.search);
    const partnerId = urlParams.get('id');
    
    let messages = [];
    let partnerProfile = null;
    let isListening = false;
    
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
    
    if (voiceCallBtn) {
        voiceCallBtn.addEventListener('click', () => {
            if (window.callsModule) {
                window.callsModule.initiatePersonalCall(partnerId);
            } else {
                window.location.href = `calls.html?type=personal&partnerId=${partnerId}&incoming=false`;
            }
        });
    }
    
    messageInput.addEventListener('input', () => {
        if (sendBtn) {
            sendBtn.disabled = !messageInput.value.trim();
        }
        messageInput.style.height = 'auto';
        messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
    });
    
    sendBtn.addEventListener('click', () => sendMessage());
    
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
                    attachmentBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                    attachmentBtn.disabled = true;
                    
                    await groupChat.sendPrivateMediaMessage(partnerId, file, groupChat.replyingToMessage?.id);
                    
                    attachmentBtn.innerHTML = originalHTML;
                    attachmentBtn.disabled = false;
                    
                } catch (error) {
                    console.error('Error sending media:', error);
                    alert(error.message || 'Failed to send media. Please try again.');
                    
                    attachmentBtn.innerHTML = '<i class="fas fa-paperclip"></i>';
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
                displayMessages();
            }
        }
    });
    
    document.addEventListener('removeTempPrivateMessage', (e) => {
        const tempId = e.detail.tempId;
        
        const tempMsgIndex = messages.findIndex(m => m.id === tempId);
        if (tempMsgIndex !== -1) {
            messages.splice(tempMsgIndex, 1);
            displayMessages();
        }
    });
    
    loadChatData();
    
    async function loadChatData() {
        try {
            partnerProfile = await groupChat.getUserProfile(partnerId);
            
            if (!partnerProfile) {
                alert('User not found');
                window.location.href = 'message.html';
                return;
            }
            
            if (partnerAvatar) partnerAvatar.src = partnerProfile.avatar;
            if (partnerName) partnerName.textContent = partnerProfile.name;
            if (partnerEmail) partnerEmail.textContent = partnerProfile.email || 'Email not available';
            if (userBio) userBio.textContent = partnerProfile.bio;
            if (chatTitle) chatTitle.textContent = partnerProfile.name;
            if (chatSubtitle) chatSubtitle.textContent = 'Private Chat';
            
            messages = await groupChat.getPrivateMessages(partnerId);
            displayMessages();
            
            if (messagesContainer) {
                groupChat.setupMessageLongPress(messagesContainer);
            }
            
            const chatId = groupChat.getPrivateChatId(groupChat.firebaseUser.uid, partnerId);
            await groupChat.markMessagesAsRead(chatId, partnerId);
            
            if (!isListening) {
                groupChat.listenToPrivateMessages(partnerId, (newMessages) => {
                    messages = newMessages;
                    displayMessages();
                    
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
    
    function displayMessages() {
        if (!messagesContainer) return;
        
        if (messages.length === 0) {
            if (noMessages) noMessages.style.display = 'block';
            messagesContainer.innerHTML = '';
            return;
        }
        
        if (noMessages) noMessages.style.display = 'none';
        
        window.currentMessages = messages;
        
        const groupedMessages = [];
        let currentGroup = null;
        
        messages.forEach((message, index) => {
            const messageTime = message.timestamp ? new Date(message.timestamp) : new Date();
            const prevMessage = messages[index - 1];
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
        
        messagesContainer.innerHTML = '';
        
        groupedMessages.forEach(group => {
            const groupDiv = document.createElement('div');
            groupDiv.className = 'message-group';
            groupDiv.dataset.senderId = group.senderId;
            
            const firstMessage = group.messages[0];
            const firstMessageTime = firstMessage.timestamp ? new Date(firstMessage.timestamp) : new Date();
            
            groupDiv.innerHTML = `
                <div class="message-header">
                    <img src="${group.senderAvatar}" 
                         alt="${group.senderName}" 
                         class="message-avatar"
                         data-user-id="${group.senderId}">
                    <span class="message-sender">${group.senderName}</span>
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
                        
                        if (msg.imageUrl) {
                            return `
                                <div class="${messageDivClass}" data-message-id="${msg.id}">
                                    ${replyHtml}
                                    <div class="message-image-container" style="position: relative;">
                                        <img src="${msg.imageUrl}" 
                                             alt="Shared image" 
                                             class="message-image"
                                             style="max-width: 300px; max-height: 300px; border-radius: 8px; cursor: pointer;"
                                             onclick="openImageModal('${msg.imageUrl}')">
                                        ${isUploading ? `
                                            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                                                   background: rgba(0,0,0,0.7); color: white; padding: 8px 12px; border-radius: 20px;
                                                   font-size: 12px; display: flex; align-items: center; gap: 6px;">
                                                <i class="fas fa-spinner fa-spin"></i> Uploading...
                                            </div>
                                        ` : ''}
                                    </div>
                                    ${isTemp ? '<div style="font-size: 11px; color: #999; margin-top: 4px;">Sending...</div>' : ''}
                                </div>
                            `;
                        } else if (msg.videoUrl) {
                            return `
                                <div class="${messageDivClass}" data-message-id="${msg.id}">
                                    ${replyHtml}
                                    <div class="message-video-container" style="position: relative;">
                                        <video controls style="max-width: 300px; max-height: 300px; border-radius: 8px;">
                                            <source src="${msg.videoUrl}" type="video/mp4">
                                            Your browser does not support the video tag.
                                        </video>
                                        ${isUploading ? `
                                            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                                                   background: rgba(0,0,0,0.7); color: white; padding: 8px 12px; border-radius: 20px;
                                                   font-size: 12px; display: flex; align-items: center; gap: 6px;">
                                                <i class="fas fa-spinner fa-spin"></i> Uploading...
                                            </div>
                                        ` : ''}
                                    </div>
                                    ${isTemp ? '<div style="font-size: 11px; color: #999; margin-top: 4px;">Sending...</div>' : ''}
                                </div>
                            `;
                        } else {
                            return `
                                <div class="${messageDivClass}" data-message-id="${msg.id}">
                                    ${replyHtml}
                                    ${msg.text || ''}
                                    ${isTemp ? '<div style="font-size: 11px; color: #999; margin-top: 4px;">Sending...</div>' : ''}
                                </div>
                            `;
                        }
                    }).join('')}
                </div>
            `;
            
            messagesContainer.appendChild(groupDiv);
        });
        
        document.querySelectorAll('.message-avatar').forEach(avatar => {
            avatar.addEventListener('click', (e) => {
                const userId = e.target.dataset.userId;
                if (userId && userId !== groupChat.firebaseUser?.uid) {
                    window.open(`user.html?id=${userId}`, '_blank');
                }
            });
        });
        
        setTimeout(() => {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }, 100);
    }
    
    async function sendMessage() {
        const text = messageInput.value.trim();
        
        if (!text) return;
        
        sendBtn.disabled = true;
        sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        
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
            sendBtn.disabled = false;
            sendBtn.innerHTML = 'Send';
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
                        <i class="fas fa-exclamation-circle"></i>
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
                    <i class="fas fa-comment-slash"></i>
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
            messageItem.innerHTML = `
                <img src="${chat.userAvatar}" alt="${chat.userName}" class="user-avatar">
                <div class="message-content">
                    <div class="message-header">
                        <div class="message-user">${chat.userName}</div>
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
                    <i class="fas fa-users-slash"></i>
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