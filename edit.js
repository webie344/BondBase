// edit.js - Independent Edit Manager for Profile and Group Editing
// Complete with Firebase and Cloudinary initialization and cache synchronization

import { 
    getFirestore, 
    doc, 
    setDoc, 
    getDoc, 
    updateDoc,
    query, 
    where, 
    getDocs,
    collection,
    serverTimestamp,
    increment,
    deleteDoc,
    writeBatch
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { 
    getAuth, 
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

// Firebase Configuration
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

// Cloudinary Configuration
const cloudinaryConfig = {
    cloudName: "ddtdqrh1b",
    uploadPreset: "profile-pictures",
    apiUrl: "https://api.cloudinary.com/v1_1"
};

// Avatar Options
const AVATAR_OPTIONS = [

  // Adventurer Style (Pixel RPG Look)
  'https://api.dicebear.com/7.x/adventurer/svg?seed=user1',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=user2',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=user3',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=user4',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=user5',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=user6',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=user7',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=user8',
  
  // Pixel Art Style
  'https://api.dicebear.com/7.x/pixel-art/svg?seed=gamer1',
  'https://api.dicebear.com/7.x/pixel-art/svg?seed=gamer2',
  'https://api.dicebear.com/7.x/pixel-art/svg?seed=gamer3',
  'https://api.dicebear.com/7.x/pixel-art/svg?seed=gamer4',
  'https://api.dicebear.com/7.x/pixel-art/svg?seed=gamer5',
  'https://api.dicebear.com/7.x/pixel-art/svg?seed=gamer6',
  'https://api.dicebear.com/7.x/pixel-art/svg?seed=gamer7',
  'https://api.dicebear.com/7.x/pixel-art/svg?seed=gamer8',
  
  // Bottts Style (Robot/AI Theme)
  'https://api.dicebear.com/7.x/bottts/svg?seed=bot1',
  'https://api.dicebear.com/7.x/bottts/svg?seed=bot2',
  'https://api.dicebear.com/7.x/bottts/svg?seed=bot3',
  'https://api.dicebear.com/7.x/bottts/svg?seed=bot4',
  'https://api.dicebear.com/7.x/bottts/svg?seed=bot5',
  'https://api.dicebear.com/7.x/bottts/svg?seed=bot6',
  'https://api.dicebear.com/7.x/bottts/svg?seed=bot7',
  'https://api.dicebear.com/7.x/bottts/svg?seed=bot8',
  
  // Open Peeps Style (Illustrated Characters)
  'https://api.dicebear.com/7.x/open-peeps/svg?seed=player1',
  'https://api.dicebear.com/7.x/open-peeps/svg?seed=player2',
  'https://api.dicebear.com/7.x/open-peeps/svg?seed=player3',
  'https://api.dicebear.com/7.x/open-peeps/svg?seed=player4',
  'https://api.dicebear.com/7.x/open-peeps/svg?seed=player5',
  'https://api.dicebear.com/7.x/open-peeps/svg?seed=player6',
  'https://api.dicebear.com/7.x/open-peeps/svg?seed=player7',
  'https://api.dicebear.com/7.x/open-peeps/svg?seed=player8',
  
  // Lorelei Style (Fantasy Gaming)
  'https://api.dicebear.com/7.x/lorelei/svg?seed=hero1',
  'https://api.dicebear.com/7.x/lorelei/svg?seed=hero2',
  'https://api.dicebear.com/7.x/lorelei/svg?seed=hero3',
  'https://api.dicebear.com/7.x/lorelei/svg?seed=hero4',
  'https://api.dicebear.com/7.x/lorelei/svg?seed=hero5',
  'https://api.dicebear.com/7.x/lorelei/svg?seed=hero6',
  'https://api.dicebear.com/7.x/lorelei/svg?seed=hero7',
  'https://api.dicebear.com/7.x/lorelei/svg?seed=hero8',
  
  // RoboHash (Robot/Monster Themes)
  'https://robohash.org/gamebot1.png?set=set1',
  'https://robohash.org/gamebot2.png?set=set1',
  'https://robohash.org/gamebot3.png?set=set2',
  'https://robohash.org/gamebot4.png?set=set2',
  'https://robohash.org/gamebot5.png?set=set3',
  'https://robohash.org/gamebot6.png?set=set3',
  'https://robohash.org/gamebot7.png?set=set4',
  'https://robohash.org/gamebot8.png?set=set4',
  
  // Funko Pop Style (Popular with gamers)
  'https://api.dicebear.com/7.x/fun-emoji/svg?seed=pop1',
  'https://api.dicebear.com/7.x/fun-emoji/svg?seed=pop2',
  'https://api.dicebear.com/7.x/fun-emoji/svg?seed=pop3',
  'https://api.dicebear.com/7.x/fun-emoji/svg?seed=pop4',
  'https://api.dicebear.com/7.x/fun-emoji/svg?seed=pop5',
  'https://api.dicebear.com/7.x/fun-emoji/svg?seed=pop6',
  'https://api.dicebear.com/7.x/fun-emoji/svg?seed=pop7',
  'https://api.dicebear.com/7.x/fun-emoji/svg?seed=pop8',
  
  // Micah Style (More detailed, modern)
  'https://api.dicebear.com/7.x/micah/svg?seed=avatar1',
  'https://api.dicebear.com/7.x/micah/svg?seed=avatar2',
  'https://api.dicebear.com/7.x/micah/svg?seed=avatar3',
  'https://api.dicebear.com/7.x/micah/svg?seed=avatar4',
  'https://api.dicebear.com/7.x/micah/svg?seed=avatar5',
  'https://api.dicebear.com/7.x/micah/svg?seed=avatar6',
  'https://api.dicebear.com/7.x/micah/svg?seed=avatar7',
  'https://api.dicebear.com/7.x/micah/svg?seed=avatar8'
];

class EditManager {
    constructor() {
        this.currentUser = null;
        this.firebaseUser = null;
        this.currentPage = null;
        this.currentGroupId = null;
        this.selectedAvatar = null;
        this.groupPhotoFile = null;
        this.groupRules = [];
        this.initialGroupData = null;
        
        // Cache
        this.userProfileCache = null;
        this.groupDataCache = new Map();
        
        this.setupAuthListener();
    }

    setupAuthListener() {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                this.firebaseUser = user;
                console.log('User authenticated:', user.uid);
                
                await this.loadUserProfile(user.uid);
                
                // Initialize based on current page
                this.currentPage = window.location.pathname.split('/').pop().split('.')[0];
                
                if (this.currentPage === 'edit-profile') {
                    this.initEditProfile();
                } else if (this.currentPage === 'edit-group') {
                    this.initEditGroupSelection();
                } else if (this.currentPage === 'edit-group-detail') {
                    this.initEditGroupDetail();
                }
                
            } else {
                this.firebaseUser = null;
                this.currentUser = null;
                console.log('User logged out');
                
                // Redirect to login if on edit pages
                const currentPage = window.location.pathname.split('/').pop().split('.')[0];
                if (currentPage === 'edit-profile' || currentPage === 'edit-group' || currentPage === 'edit-group-detail') {
                    window.location.href = 'login.html';
                }
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
                this.currentUser = {
                    id: userId,
                    name: this.firebaseUser.email.split('@')[0] || 'User',
                    avatar: AVATAR_OPTIONS[0],
                    bio: '',
                    email: this.firebaseUser.email,
                    profileComplete: false
                };
            }
            
        } catch (error) {
            console.error('Error loading user profile:', error);
        }
    }

    async getUserProfile(userId, forceRefresh = false) {
        try {
            if (!forceRefresh && this.userProfileCache && this.userProfileCache.id === userId) {
                return this.userProfileCache;
            }

            const userRef = doc(db, 'group_users', userId);
            const userSnap = await getDoc(userRef);
            
            if (userSnap.exists()) {
                const userData = userSnap.data();
                const profile = {
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
                
                this.userProfileCache = profile;
                return profile;
            }
            return null;
        } catch (error) {
            console.error('Error getting user profile:', error);
            return null;
        }
    }

    async getGroup(groupId, forceRefresh = false) {
        try {
            if (!forceRefresh && this.groupDataCache.has(groupId)) {
                return this.groupDataCache.get(groupId);
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
                
                this.groupDataCache.set(groupId, group);
                return group;
            }
            return null;
        } catch (error) {
            console.error('Error getting group:', error);
            throw error;
        }
    }

    async isGroupAdmin(groupId) {
        try {
            if (!this.firebaseUser) return false;
            
            const group = await this.getGroup(groupId);
            return group && group.createdBy === this.firebaseUser.uid;
        } catch (error) {
            console.error('Error checking admin status:', error);
            return false;
        }
    }

    // ============================
    // CLOUDINARY UPLOAD FUNCTIONS
    // ============================
    
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
        const maxSize = 5 * 1024 * 1000; // 5MB
        if (file.size > maxSize) {
            throw new Error('Image file must be less than 5MB');
        }
        
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            throw new Error('Please upload a valid image file (JPEG, PNG, GIF, WebP)');
        }
        
        return true;
    }

    // ============================
    // CACHE SYNC FUNCTIONS
    // ============================

    async clearGroupJsUserCache() {
        try {
            // If group.js is loaded, clear its cache for the current user
            if (window.groupChat) {
                // Clear user profile cache
                if (window.groupChat.cache && window.groupChat.cache.userProfiles) {
                    const cacheKey = `user_${this.firebaseUser.uid}`;
                    window.groupChat.cache.userProfiles.delete(cacheKey);
                    
                    // Also clear the current user profile
                    window.groupChat.currentUser = null;
                    window.groupChat.cache.userProfile = null;
                    window.groupChat.cache.userProfileExpiry = 0;
                    window.groupChat.cache.profileSetupChecked = false;
                }
                
                // Clear all user-related caches
                if (window.groupChat.cache) {
                    // Clear mutual groups cache
                    for (const key of window.groupChat.cache.mutualGroups.keys()) {
                        if (key.includes(this.firebaseUser.uid)) {
                            window.groupChat.cache.mutualGroups.delete(key);
                        }
                    }
                    
                    // Clear private chats cache
                    for (const key of window.groupChat.cache.privateChats.keys()) {
                        if (key.includes(this.firebaseUser.uid)) {
                            window.groupChat.cache.privateChats.delete(key);
                        }
                    }
                    
                    // Clear unread counts cache
                    for (const key of window.groupChat.cache.unreadCounts.keys()) {
                        if (key.includes(this.firebaseUser.uid)) {
                            window.groupChat.cache.unreadCounts.delete(key);
                        }
                    }
                }
                
                console.log('Cleared group.js user cache');
            }
        } catch (error) {
            console.error('Error clearing group.js user cache:', error);
        }
    }

    async clearGroupJsGroupCache(groupId) {
        try {
            // If group.js is loaded, clear its cache for this group
            if (window.groupChat) {
                if (window.groupChat.cache) {
                    // Clear specific group caches
                    window.groupChat.cache.groupData.delete(groupId);
                    window.groupChat.cache.groupMembers.delete(groupId);
                    window.groupChat.cache.joinedGroups.delete(groupId);
                    window.groupChat.cache.messageReactions.delete(groupId);
                    
                    // Clear messages cache for this group
                    for (const key of window.groupChat.cache.messages.keys()) {
                        if (key.includes(groupId)) {
                            window.groupChat.cache.messages.delete(key);
                        }
                    }
                    
                    // Clear admin groups cache
                    const adminCacheKey = `admin_groups_${this.firebaseUser.uid}`;
                    window.groupChat.cache.adminGroups.delete(adminCacheKey);
                    
                    // Clear all groups cache
                    window.groupChat.cache.allGroups.clear();
                    
                    // Clear group chats cache
                    for (const key of window.groupChat.cache.groupChats.keys()) {
                        if (key.includes(this.firebaseUser.uid)) {
                            window.groupChat.cache.groupChats.delete(key);
                        }
                    }
                }
                
                console.log(`Cleared group.js cache for group: ${groupId}`);
            }
        } catch (error) {
            console.error('Error clearing group.js group cache:', error);
        }
    }

    async updateGroupJsMemberInfo(groupId) {
        try {
            // Update member information in all groups the user is a member of
            if (window.groupChat && this.currentUser) {
                // Get all groups the user is in
                const groupsRef = collection(db, 'groups');
                const querySnapshot = await getDocs(groupsRef);
                
                for (const docSnap of querySnapshot.docs) {
                    const memberRef = doc(db, 'groups', docSnap.id, 'members', this.firebaseUser.uid);
                    const memberSnap = await getDoc(memberRef);
                    
                    if (memberSnap.exists()) {
                        // Update member info in this group
                        await updateDoc(memberRef, {
                            name: this.currentUser.name,
                            avatar: this.currentUser.avatar,
                            bio: this.currentUser.bio,
                            updatedAt: serverTimestamp()
                        });
                        
                        // Clear cache for this group
                        this.clearGroupJsGroupCache(docSnap.id);
                    }
                }
                
                console.log('Updated member info in all groups');
            }
        } catch (error) {
            console.error('Error updating member info:', error);
        }
    }

    // ============================
    // UTILITY FUNCTIONS
    // ============================
    
    showLoadingOverlay(show, text = 'Processing...') {
        const loadingOverlay = document.getElementById('loadingOverlay');
        const loadingText = document.getElementById('loadingText');
        
        if (loadingOverlay) {
            if (show) {
                loadingOverlay.classList.add('active');
            } else {
                loadingOverlay.classList.remove('active');
            }
            
            if (loadingText) {
                loadingText.textContent = text;
            }
        }
        
        // Also show/hide on window object for compatibility
        if (typeof window.showLoadingOverlay === 'function') {
            window.showLoadingOverlay(show);
        }
    }

    showNotification(message, type = 'success', duration = 3000) {
        const notification = document.getElementById('statusNotification');
        
        if (notification) {
            notification.textContent = message;
            notification.className = 'status-notification ' + type;
            notification.classList.add('show');
            
            // Add appropriate icon
            const icon = type === 'success' ? 'check-circle' : 
                         type === 'error' ? 'exclamation-circle' : 
                         type === 'warning' ? 'exclamation-triangle' : 'info-circle';
            notification.innerHTML = `<i class="fas fa-${icon}"></i> ${message}`;
            
            setTimeout(() => {
                notification.classList.remove('show');
            }, duration);
        }
        
        // Also show on window object for compatibility
        if (typeof window.showStatusNotification === 'function') {
            window.showStatusNotification(message, type, duration);
        }
    }

    // ============================
    // PROFILE EDITING FUNCTIONALITY
    // ============================
    
    initEditProfile() {
        this.loadProfileData();
        this.setupProfileEventListeners();
    }

    async loadProfileData() {
        try {
            if (!this.currentUser) {
                await this.loadUserProfile(this.firebaseUser.uid);
            }
            
            // Set avatar
            this.selectedAvatar = this.currentUser.avatar;
            const avatarPreview = document.getElementById('avatarPreview');
            if (avatarPreview) {
                avatarPreview.src = this.currentUser.avatar;
            }
            
            // Set display name
            const displayName = document.getElementById('displayName');
            const nameCount = document.getElementById('nameCount');
            if (displayName) {
                displayName.value = this.currentUser.name || '';
                if (nameCount) {
                    nameCount.textContent = displayName.value.length;
                }
            }
            
            // Set bio
            const userBio = document.getElementById('userBio');
            const bioCount = document.getElementById('bioCount');
            if (userBio) {
                userBio.value = this.currentUser.bio || '';
                if (bioCount) {
                    bioCount.textContent = userBio.value.length;
                }
            }
            
            // Render avatar options
            this.renderAvatarOptions();
            
        } catch (error) {
            console.error('Error loading profile data:', error);
            this.showNotification('Error loading profile data', 'error');
        }
    }

    renderAvatarOptions() {
        const avatarOptions = document.getElementById('avatarOptions');
        if (!avatarOptions) return;
        
        avatarOptions.innerHTML = '';
        
        AVATAR_OPTIONS.forEach((avatar, index) => {
            const img = document.createElement('img');
            img.src = avatar;
            img.alt = `Avatar ${index + 1}`;
            img.className = `avatar-option ${avatar === this.selectedAvatar ? 'selected' : ''}`;
            
            img.addEventListener('click', () => {
                this.selectedAvatar = avatar;
                const avatarPreview = document.getElementById('avatarPreview');
                if (avatarPreview) {
                    avatarPreview.src = avatar;
                }
                this.renderAvatarOptions();
            });
            
            avatarOptions.appendChild(img);
        });
    }

    setupProfileEventListeners() {
        // Avatar upload
        const uploadAvatarBtn = document.getElementById('uploadAvatarBtn');
        const avatarUpload = document.getElementById('avatarUpload');
        
        if (uploadAvatarBtn && avatarUpload) {
            uploadAvatarBtn.addEventListener('click', () => {
                avatarUpload.click();
            });
            
            avatarUpload.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file) {
                    await this.handleAvatarUpload(file);
                }
            });
        }
        
        // Form submission
        const editProfileForm = document.getElementById('editProfileForm');
        if (editProfileForm) {
            editProfileForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveProfileChanges();
            });
        }
        
        // Character counters
        const displayName = document.getElementById('displayName');
        const nameCount = document.getElementById('nameCount');
        const userBio = document.getElementById('userBio');
        const bioCount = document.getElementById('bioCount');
        
        if (displayName && nameCount) {
            displayName.addEventListener('input', function() {
                nameCount.textContent = this.value.length;
            });
        }
        
        if (userBio && bioCount) {
            userBio.addEventListener('input', function() {
                bioCount.textContent = this.value.length;
            });
        }
    }

    async handleAvatarUpload(file) {
        try {
            // Validate file
            this.validateImageFile(file);

            // Show loading
            this.showLoadingOverlay(true, 'Uploading image...');
            
            // Upload to Cloudinary
            const mediaUrl = await this.uploadMediaToCloudinary(file);
            
            // Update avatar preview
            this.selectedAvatar = mediaUrl;
            const avatarPreview = document.getElementById('avatarPreview');
            if (avatarPreview) {
                avatarPreview.src = mediaUrl;
            }
            
            // Update avatar options
            this.renderAvatarOptions();
            
            this.showLoadingOverlay(false);
            this.showNotification('Profile picture uploaded successfully!', 'success');
            
        } catch (error) {
            console.error('Error uploading avatar:', error);
            this.showLoadingOverlay(false);
            this.showNotification(error.message || 'Failed to upload image. Please try again.', 'error');
        }
    }

    async saveProfileChanges() {
        try {
            const displayName = document.getElementById('displayName');
            const userBio = document.getElementById('userBio');
            const saveBtn = document.getElementById('saveBtn');
            
            if (!displayName || !userBio || !saveBtn) return;
            
            const name = displayName.value.trim();
            const bio = userBio.value.trim();
            
            if (!name) {
                this.showNotification('Please enter a display name', 'error');
                return;
            }
            
            if (name.length < 2) {
                this.showNotification('Display name must be at least 2 characters', 'error');
                return;
            }
            
            if (name.length > 30) {
                this.showNotification('Display name must be less than 30 characters', 'error');
                return;
            }
            
            // Disable save button and show loading
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
            this.showLoadingOverlay(true, 'Saving profile...');
            
            // Update user profile in Firebase
            const userRef = doc(db, 'group_users', this.firebaseUser.uid);
            
            await setDoc(userRef, {
                displayName: name,
                avatar: this.selectedAvatar,
                bio: bio,
                email: this.firebaseUser.email,
                updatedAt: serverTimestamp(),
                lastSeen: serverTimestamp()
            }, { merge: true });
            
            // Update local user object
            this.currentUser.name = name;
            this.currentUser.avatar = this.selectedAvatar;
            this.currentUser.bio = bio;
            
            // Clear cache in group.js
            await this.clearGroupJsUserCache();
            
            // Update member info in all groups
            await this.updateGroupJsMemberInfo();
            
            // Clear local cache
            this.userProfileCache = null;
            
            this.showLoadingOverlay(false);
            this.showNotification('Profile updated successfully!', 'success');
            
            // Restore save button
            setTimeout(() => {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
            }, 1000);
            
        } catch (error) {
            console.error('Error saving profile:', error);
            this.showLoadingOverlay(false);
            this.showNotification('Failed to save profile. Please try again.', 'error');
            
            // Restore save button
            const saveBtn = document.getElementById('saveBtn');
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
            }
        }
    }

    // ============================
    // GROUP EDITING - SELECTION PAGE
    // ============================
    
    initEditGroupSelection() {
        this.loadAdminGroupsForSelection();
    }

    async loadAdminGroupsForSelection() {
        try {
            // Show loading state
            if (typeof window.showLoadingState === 'function') {
                window.showLoadingState();
            }
            
            // Get all groups where user is admin
            const groupsRef = collection(db, 'groups');
            const q = query(groupsRef, where('createdBy', '==', this.firebaseUser.uid));
            const querySnapshot = await getDocs(q);
            
            const groups = [];
            querySnapshot.forEach(doc => {
                const data = doc.data();
                groups.push({
                    id: doc.id,
                    name: data.name,
                    description: data.description,
                    photoUrl: data.photoUrl,
                    memberCount: data.memberCount || 0,
                    createdAt: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate() : data.createdAt) : new Date()
                });
            });
            
            if (groups.length === 0) {
                if (typeof window.showEmptyState === 'function') {
                    window.showEmptyState();
                }
                return;
            }
            
            // Show groups
            if (typeof window.showGroupsList === 'function') {
                window.showGroupsList(groups);
            }
            
        } catch (error) {
            console.error('Error loading admin groups:', error);
            this.showNotification('Error loading groups', 'error');
            
            if (typeof window.showEmptyState === 'function') {
                window.showEmptyState();
            }
        }
    }

    // ============================
    // GROUP EDITING - DETAIL PAGE
    // ============================
    
    initEditGroupDetail() {
        const urlParams = new URLSearchParams(window.location.search);
        this.currentGroupId = urlParams.get('id');
        
        if (!this.currentGroupId) {
            this.showNotification('No group specified', 'error');
            setTimeout(() => {
                window.location.href = 'edit-group.html';
            }, 2000);
            return;
        }
        
        this.loadGroupData();
        this.setupGroupEventListeners();
    }

    async loadGroupData() {
        try {
            this.showLoadingOverlay(true, 'Loading group data...');
            
            // Check if user is admin
            const isAdmin = await this.isGroupAdmin(this.currentGroupId);
            if (!isAdmin) {
                this.showNotification('You must be the group admin to edit this group', 'error');
                setTimeout(() => {
                    window.location.href = 'edit-group.html';
                }, 2000);
                return;
            }
            
            // Load group data
            const groupData = await this.getGroup(this.currentGroupId, true);
            
            if (!groupData) {
                this.showNotification('Group not found', 'error');
                setTimeout(() => {
                    window.location.href = 'edit-group.html';
                }, 2000);
                return;
            }
            
            this.initialGroupData = groupData;
            
            // Set page title
            if (typeof window.setPageTitle === 'function') {
                window.setPageTitle(`Edit ${groupData.name}`);
            }
            
            // Set group photo
            const groupPhotoPreview = document.getElementById('groupPhotoPreview');
            if (groupPhotoPreview) {
                groupPhotoPreview.src = groupData.photoUrl || 
                    `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(groupData.name)}&backgroundColor=00897b&backgroundType=gradientLinear`;
            }
            
            // Set group name
            const groupName = document.getElementById('groupName');
            const nameCount = document.getElementById('nameCount');
            if (groupName) {
                groupName.value = groupData.name || '';
                if (nameCount) {
                    nameCount.textContent = groupName.value.length;
                }
            }
            
            // Set group description
            const groupDescription = document.getElementById('groupDescription');
            const descCount = document.getElementById('descCount');
            if (groupDescription) {
                groupDescription.value = groupData.description || '';
                if (descCount) {
                    descCount.textContent = groupDescription.value.length;
                }
            }
            
            // Set category
            const groupCategory = document.getElementById('groupCategory');
            if (groupCategory && groupData.category) {
                groupCategory.value = groupData.category;
            }
            
            // Set privacy
            const groupPrivacy = document.getElementById('groupPrivacy');
            if (groupPrivacy && groupData.privacy) {
                groupPrivacy.value = groupData.privacy;
            }
            
            // Set max members
            const maxMembers = document.getElementById('maxMembers');
            if (maxMembers) {
                maxMembers.value = groupData.maxMembers || 100;
            }
            
            // Set rules
            this.groupRules = groupData.rules || [];
            this.renderRules();
            
            // Set restricted words
            const restrictedWords = document.getElementById('restrictedWords');
            const wordsCount = document.getElementById('wordsCount');
            if (restrictedWords && groupData.restrictedWords) {
                restrictedWords.value = groupData.restrictedWords.join(', ');
                if (wordsCount) {
                    wordsCount.textContent = restrictedWords.value.length;
                }
            }
            
            this.showLoadingOverlay(false);
            
        } catch (error) {
            console.error('Error loading group data:', error);
            this.showLoadingOverlay(false);
            this.showNotification('Error loading group data', 'error');
        }
    }

    renderRules() {
        const rulesContainer = document.getElementById('rulesContainer');
        if (!rulesContainer) return;
        
        rulesContainer.innerHTML = '';
        
        this.groupRules.forEach((rule, index) => {
            const ruleItem = document.createElement('div');
            ruleItem.className = 'rule-item';
            ruleItem.innerHTML = `
                <input type="text" 
                       class="form-input rule-input" 
                       placeholder="Rule ${index + 1}"
                       value="${rule}"
                       data-index="${index}">
                <button type="button" class="remove-rule-btn" data-index="${index}">
                    <i class="fas fa-times"></i>
                </button>
            `;
            
            rulesContainer.appendChild(ruleItem);
        });
        
        // Add event listeners
        document.querySelectorAll('.rule-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.groupRules[index] = e.target.value;
            });
        });
        
        document.querySelectorAll('.remove-rule-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.closest('.remove-rule-btn').dataset.index);
                this.groupRules.splice(index, 1);
                this.renderRules();
            });
        });
    }

    setupGroupEventListeners() {
        // Group photo upload
        const uploadPhotoBtn = document.getElementById('uploadPhotoBtn');
        const groupPhotoUpload = document.getElementById('groupPhotoUpload');
        
        if (uploadPhotoBtn && groupPhotoUpload) {
            uploadPhotoBtn.addEventListener('click', () => {
                groupPhotoUpload.click();
            });
            
            groupPhotoUpload.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file) {
                    await this.handleGroupPhotoUpload(file);
                }
            });
        }
        
        // Add rule button
        const addRuleBtn = document.getElementById('addRuleBtn');
        if (addRuleBtn) {
            addRuleBtn.addEventListener('click', () => {
                this.groupRules.push('');
                this.renderRules();
            });
        }
        
        // Character counters
        const groupName = document.getElementById('groupName');
        const nameCount = document.getElementById('nameCount');
        const groupDescription = document.getElementById('groupDescription');
        const descCount = document.getElementById('descCount');
        const restrictedWords = document.getElementById('restrictedWords');
        const wordsCount = document.getElementById('wordsCount');
        
        if (groupName && nameCount) {
            groupName.addEventListener('input', function() {
                nameCount.textContent = this.value.length;
            });
        }
        
        if (groupDescription && descCount) {
            groupDescription.addEventListener('input', function() {
                descCount.textContent = this.value.length;
            });
        }
        
        if (restrictedWords && wordsCount) {
            restrictedWords.addEventListener('input', function() {
                wordsCount.textContent = this.value.length;
            });
        }
        
        // Form submission
        const editGroupForm = document.getElementById('editGroupForm');
        if (editGroupForm) {
            editGroupForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveGroupChanges();
            });
        }
        
        // Regenerate invite button
        const regenerateInviteBtn = document.getElementById('regenerateInviteBtn');
        if (regenerateInviteBtn) {
            regenerateInviteBtn.addEventListener('click', () => {
                this.regenerateInviteLink();
            });
        }
        
        // Delete group button
        const deleteGroupBtn = document.getElementById('deleteGroupBtn');
        if (deleteGroupBtn) {
            deleteGroupBtn.addEventListener('click', () => {
                this.confirmDeleteGroup();
            });
        }
    }

    async handleGroupPhotoUpload(file) {
        try {
            // Validate file
            this.validateImageFile(file);

            // Show loading
            this.showLoadingOverlay(true, 'Uploading group photo...');
            
            // Upload to Cloudinary
            const mediaUrl = await this.uploadMediaToCloudinary(file);
            
            // Update photo preview
            this.groupPhotoFile = mediaUrl;
            const groupPhotoPreview = document.getElementById('groupPhotoPreview');
            if (groupPhotoPreview) {
                groupPhotoPreview.src = mediaUrl;
            }
            
            this.showLoadingOverlay(false);
            this.showNotification('Group photo uploaded successfully!', 'success');
            
        } catch (error) {
            console.error('Error uploading group photo:', error);
            this.showLoadingOverlay(false);
            this.showNotification(error.message || 'Failed to upload image. Please try again.', 'error');
        }
    }

    async saveGroupChanges() {
        try {
            const groupName = document.getElementById('groupName');
            const groupDescription = document.getElementById('groupDescription');
            const groupCategory = document.getElementById('groupCategory');
            const groupPrivacy = document.getElementById('groupPrivacy');
            const maxMembers = document.getElementById('maxMembers');
            const restrictedWords = document.getElementById('restrictedWords');
            const saveBtn = document.getElementById('saveBtn');
            
            if (!groupName || !groupDescription || !saveBtn) return;
            
            const name = groupName.value.trim();
            const description = groupDescription.value.trim();
            const category = groupCategory ? groupCategory.value : 'social';
            const privacy = groupPrivacy ? groupPrivacy.value : 'public';
            const maxMembersValue = maxMembers ? parseInt(maxMembers.value) : 100;
            const restrictedWordsText = restrictedWords ? restrictedWords.value.trim() : '';
            
            if (!name) {
                this.showNotification('Please enter a group name', 'error');
                return;
            }
            
            if (!description) {
                this.showNotification('Please enter a group description', 'error');
                return;
            }
            
            if (!category) {
                this.showNotification('Please select a category', 'error');
                return;
            }
            
            // Filter empty rules
            const rules = this.groupRules.filter(rule => rule.trim());
            
            // Parse restricted words
            const restrictedWordsArray = restrictedWordsText ? 
                restrictedWordsText.split(',').map(word => word.trim()).filter(word => word.length > 0) : 
                [];
            
            // Disable save button and show loading
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
            this.showLoadingOverlay(true, 'Saving group changes...');
            
            // Update group in Firebase
            const groupRef = doc(db, 'groups', this.currentGroupId);
            
            const updateData = {
                name: name,
                description: description,
                category: category,
                privacy: privacy,
                maxMembers: maxMembersValue,
                rules: rules,
                restrictedWords: restrictedWordsArray,
                updatedAt: serverTimestamp()
            };
            
            // Add photo URL if uploaded
            if (this.groupPhotoFile) {
                updateData.photoUrl = this.groupPhotoFile;
            }
            
            await updateDoc(groupRef, updateData);
            
            // Clear cache in group.js
            await this.clearGroupJsGroupCache(this.currentGroupId);
            
            // Clear local cache
            this.groupDataCache.delete(this.currentGroupId);
            
            this.showLoadingOverlay(false);
            this.showNotification('Group updated successfully!', 'success');
            
            // Restore save button
            setTimeout(() => {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
            }, 1000);
            
        } catch (error) {
            console.error('Error saving group:', error);
            this.showLoadingOverlay(false);
            this.showNotification('Failed to save group. Please try again.', 'error');
            
            // Restore save button
            const saveBtn = document.getElementById('saveBtn');
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
            }
        }
    }

    async regenerateInviteLink() {
        try {
            if (!confirm('Are you sure you want to regenerate the invite link?\n\nThe old link will no longer work.')) {
                return;
            }
            
            this.showLoadingOverlay(true, 'Regenerating invite link...');
            
            // Generate new invite code
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
            let newInviteCode = '';
            for (let i = 0; i < 8; i++) {
                newInviteCode += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            
            const newInviteLink = `https://bondlydatingweb.vercel.app/join.html?code=${newInviteCode}`;
            
            // Update group in Firebase
            const groupRef = doc(db, 'groups', this.currentGroupId);
            
            await updateDoc(groupRef, {
                inviteCode: newInviteCode,
                inviteLink: newInviteLink,
                updatedAt: serverTimestamp()
            });
            
            // Clear cache in group.js
            await this.clearGroupJsGroupCache(this.currentGroupId);
            
            // Clear local cache
            this.groupDataCache.delete(this.currentGroupId);
            
            this.showLoadingOverlay(false);
            
            // Show new invite link
            const message = `New invite link generated!\n\n${newInviteLink}\n\nThis link has been copied to your clipboard.`;
            alert(message);
            
            // Copy to clipboard
            await navigator.clipboard.writeText(newInviteLink);
            
            this.showNotification('New invite link copied to clipboard!', 'success');
            
        } catch (error) {
            console.error('Error regenerating invite link:', error);
            this.showLoadingOverlay(false);
            this.showNotification('Failed to regenerate invite link', 'error');
        }
    }

    async confirmDeleteGroup() {
        try {
            if (!this.initialGroupData) {
                this.showNotification('Group data not loaded', 'error');
                return;
            }
            
            if (!confirm(`Are you sure you want to delete the group "${this.initialGroupData.name}"?\n\nThis action cannot be undone. All messages and member data will be permanently deleted.`)) {
                return;
            }
            
            if (!confirm(`FINAL WARNING: This will delete "${this.initialGroupData.name}" permanently. Continue?`)) {
                return;
            }
            
            this.showLoadingOverlay(true, 'Deleting group...');
            
            // Get all members
            const membersRef = collection(db, 'groups', this.currentGroupId, 'members');
            const membersSnap = await getDocs(membersRef);
            const members = [];
            membersSnap.forEach(doc => {
                members.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            // Delete group data in batch
            const batch = writeBatch(db);
            
            // Delete all messages
            const messagesRef = collection(db, 'groups', this.currentGroupId, 'messages');
            const messagesSnap = await getDocs(messagesRef);
            messagesSnap.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            // Delete all members
            membersSnap.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            // Delete all typing indicators
            const typingRef = collection(db, 'groups', this.currentGroupId, 'typing');
            const typingSnap = await getDocs(typingRef);
            typingSnap.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            // Delete all restricted users
            const restrictedRef = collection(db, 'groups', this.currentGroupId, 'restricted_users');
            const restrictedSnap = await getDocs(restrictedRef);
            restrictedSnap.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            // Delete the group itself
            const groupRef = doc(db, 'groups', this.currentGroupId);
            batch.delete(groupRef);
            
            await batch.commit();
            
            // Clear cache in group.js
            await this.clearGroupJsGroupCache(this.currentGroupId);
            
            // Clear local cache
            this.groupDataCache.delete(this.currentGroupId);
            
            this.showLoadingOverlay(false);
            this.showNotification('Group deleted successfully!', 'success');
            
            // Redirect to groups page after delay
            setTimeout(() => {
                window.location.href = 'groups.html';
            }, 1500);
            
        } catch (error) {
            console.error('Error deleting group:', error);
            this.showLoadingOverlay(false);
            this.showNotification('Failed to delete group', 'error');
        }
    }
}

// Initialize Edit Manager
const editManager = new EditManager();

// Export for use in other files if needed
window.editManager = editManager;

// Auto-initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    // Edit manager will auto-initialize via auth state change
});