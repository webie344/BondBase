// group.js - Group Management System with Cloudinary Media Support & Invite Links
// FIXED: Message duplication issues
// FIXED: Listener cleanup on page navigation
// FIXED: Proper event listener management

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

const CACHE_DURATION = {
    USER_PROFILE: 5 * 60 * 1000,
    GROUP_DATA: 2 * 60 * 1000,
    MEMBERS_LIST: 1 * 60 * 1000,
    BLOCKED_USERS: 10 * 60 * 1000
};

class GroupManager {
    constructor() {
        this.currentUser = null;
        this.firebaseUser = null;
        
        // FIXED: Use Map to track active listeners
        this.activeListeners = {
            members: new Map(),      // groupId -> unsubscribe function
            adminGroups: new Map()   // user specific admin groups listener
        };
        
        this.unsubscribeAuth = null;
        
        this.cache = {
            userProfile: null,
            userProfileExpiry: 0,
            joinedGroups: new Map(),
            groupData: new Map(),
            groupMembers: new Map(),
            profileSetupChecked: false,
            blockedUsers: new Map(),
            adminGroups: new Map(),
            allGroups: new Map(),
            groupInvites: new Map()
        };
        
        this.restrictedUsers = new Map();
        
        this.blockedUsers = new Map();
        
        this.activeUploads = new Map();
        
        this.setupAuthListener();
        this.checkRestrictedUsers();
        this.loadBlockedUsers();
        
        // FIXED: Add beforeunload listener for cleanup
        window.addEventListener('beforeunload', () => this.cleanupAllListeners());
    }

    // FIXED: Proper listener cleanup methods
    cleanupAllListeners() {
        console.log('Cleaning up all group listeners');
        
        // Clean up all member listeners
        this.activeListeners.members.forEach((unsub, key) => {
            if (typeof unsub === 'function') {
                try {
                    unsub();
                } catch (err) {
                    console.log('Error unsubscribing from members:', err);
                }
            }
        });
        this.activeListeners.members.clear();
        
        // Clean up all admin group listeners
        this.activeListeners.adminGroups.forEach((unsub, key) => {
            if (typeof unsub === 'function') {
                try {
                    unsub();
                } catch (err) {
                    console.log('Error unsubscribing from admin groups:', err);
                }
            }
        });
        this.activeListeners.adminGroups.clear();
        
        // Cancel all active uploads
        this.activeUploads.forEach((upload, uploadId) => {
            if (upload.cancelFunction && typeof upload.cancelFunction === 'function') {
                upload.cancelFunction();
            }
        });
        this.activeUploads.clear();
        
        console.log('All group listeners cleaned up');
    }
    
    cleanupGroupListeners(groupId) {
        console.log('Cleaning up listeners for group:', groupId);
        
        // Clean up member listener
        if (this.activeListeners.members.has(groupId)) {
            const unsub = this.activeListeners.members.get(groupId);
            if (typeof unsub === 'function') {
                try {
                    unsub();
                } catch (err) {
                    console.log('Error unsubscribing from members:', err);
                }
            }
            this.activeListeners.members.delete(groupId);
        }
        
        console.log('Group listeners cleaned up for:', groupId);
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
            profileSetupChecked: false,
            blockedUsers: new Map(),
            adminGroups: new Map(),
            allGroups: new Map(),
            groupInvites: new Map()
        };
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
                    profileComplete: userData.displayName && userData.avatar ? true : false
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
                
                const protectedPages = ['create-group', 'groups', 'admin-groups', 'join', 'set'];
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
                const uploadId = 'group_photo_' + Date.now();
                photoUrl = await this.uploadMediaToCloudinary(photoFile, uploadId);
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

    listenToMembers(groupId, callback) {
        try {
            // Clean up existing listener first
            if (this.activeListeners.members.has(groupId)) {
                const existingUnsub = this.activeListeners.members.get(groupId);
                if (typeof existingUnsub === 'function') {
                    try {
                        existingUnsub();
                    } catch (err) {
                        console.log('Error unsubscribing from previous members:', err);
                    }
                }
                this.activeListeners.members.delete(groupId);
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
            
            this.activeListeners.members.set(groupId, unsubscribe);
            
            return unsubscribe;
        } catch (error) {
            console.error('Error listening to members:', error);
            return () => {};
        }
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

const groupManager = new GroupManager();

// FIXED: Page initialization with proper cleanup
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
            case 'admin-groups':
                initAdminGroupsPage();
                break;
            case 'join':
                initJoinPage();
                break;
            default:
                if (currentPage === 'login' || currentPage === 'signup' || currentPage === 'index') {
                    // Do nothing for auth pages
                } else {
                    setTimeout(() => {
                        if (!groupManager.firebaseUser && currentPage !== 'login' && currentPage !== 'signup' && currentPage !== 'index') {
                            window.location.href = 'login.html';
                        }
                    }, 1000);
                }
        }
    });
    
    setTimeout(() => {
        if (groupManager.firebaseUser) {
            document.dispatchEvent(new CustomEvent('groupAuthReady'));
        }
    }, 500);
});

// FIXED: Add page cleanup on navigation
window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
        console.log('Page restored from back/forward cache, cleaning up...');
        groupManager.cleanupAllListeners();
    }
});

function initCreateGroupPage() {
    if (!groupManager.firebaseUser) {
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
            const result = await groupManager.createGroup(groupData, groupPhotoFile);
            
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
            if (!groupManager.firebaseUser) {
                window.location.href = 'login.html';
                return;
            }
            
            const needsSetup = await groupManager.needsProfileSetup();
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
            allGroups = await groupManager.getAllGroups();
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
                
                if (!groupManager.firebaseUser) {
                    window.location.href = 'login.html';
                }
                
                const needsSetup = await groupManager.needsProfileSetup();
                if (needsSetup) {
                    window.location.href = `set.html?id=${groupId}`;
                } else {
                    try {
                        await groupManager.joinGroup(groupId);
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
    
    if (!groupManager.firebaseUser) {
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
            groupData = await groupManager.getGroup(groupId);
            
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
            await groupManager.updateUserProfile(userData);
            
            if (groupId) {
                try {
                    await groupManager.joinGroup(groupId);
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
    
    if (groupManager.currentUser && groupManager.currentUser.name !== 'User') {
        displayName.value = groupManager.currentUser.name || '';
        userBio.value = groupManager.currentUser.bio || '';
        selectedAvatar = groupManager.currentUser.avatar || AVATAR_OPTIONS[0];
        avatarPreview.src = selectedAvatar;
        
        nameCount.textContent = displayName.value.length;
        bioCount.textContent = userBio.value.length;
        
        renderAvatarOptions();
    }
}

function initAdminGroupsPage() {
    console.log('Initializing Admin Groups Page...');
    
    if (!groupManager.firebaseUser) {
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
            
            const groups = await groupManager.getAdminGroups();
            
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
            
            const inviteLink = await groupManager.getGroupInviteLink(groupId);
            
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
            
            const members = await groupManager.getGroupMembersWithDetails(groupId);
            
            if (membersList) {
                membersList.innerHTML = '';
                
                if (members.length === 0) {
                    membersList.innerHTML = '<div class="empty-state">No members in this group</div>';
                } else {
                    members.forEach(member => {
                        const memberItem = document.createElement('div');
                        memberItem.className = 'member-item';
                        
                        const isCurrentUser = member.id === groupManager.firebaseUser.uid;
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
            
            await groupManager.deleteGroup(groupId);
            
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
            
            await groupManager.removeMemberFromGroup(groupId, memberId, memberName);
            
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
            
            const group = await groupManager.getGroupByInviteCode(inviteCode);
            
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
                if (groupManager.firebaseUser) {
                    groupManager.isMember(group.id).then(isMember => {
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
            if (!groupManager.firebaseUser) {
                showError('Please login to join the group');
                window.location.href = 'login.html';
                return;
            }
            
            const needsSetup = await groupManager.needsProfileSetup();
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
            
            await groupManager.joinGroup(groupId);
            
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
                                <polyline points="8 6 2 12 8 18"></line>
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

window.groupManager = groupManager;

window.groupLogout = function() {
    groupManager.logout();
};

document.addEventListener('DOMContentLoaded', function() {
    const pendingInviteCode = sessionStorage.getItem('pendingInviteCode');
    const currentPage = window.location.pathname.split('/').pop();
    
    if (pendingInviteCode && currentPage === 'join.html' && !window.location.search.includes('code=')) {
        window.location.href = `join.html?code=${pendingInviteCode}`;
        sessionStorage.removeItem('pendingInviteCode');
    }
});