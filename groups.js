// groups.js - Original working version (without Enter/Join button fix)

import { 
    getFirestore, 
    collection, 
    doc,
    getDoc,
    setDoc,
    updateDoc,
    query, 
    getDocs,
    orderBy,
    increment,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { 
    getAuth, 
    onAuthStateChanged
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

class GroupsManager {
    constructor() {
        this.firebaseUser = null;
        this.currentUser = null;
        this.cache = {
            allGroups: new Map(),
            userProfiles: new Map(),
            joinedGroups: new Map()
        };
        this.setupAuthListener();
    }

    setupAuthListener() {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                this.firebaseUser = user;
                console.log('User authenticated:', user.uid);
                await this.loadUserProfile(user.uid);
                this.initializePage();
            } else {
                this.firebaseUser = null;
                this.currentUser = null;
                console.log('User logged out');
                const currentPage = window.location.pathname.split('/').pop();
                if (currentPage === 'groups.html') {
                    window.location.href = 'login.html';
                }
            }
        });
    }

    async loadUserProfile(userId) {
        try {
            console.log('Loading user profile for:', userId);
            const userRef = doc(db, 'group_users', userId);
            const userSnap = await getDoc(userRef);
            
            if (userSnap.exists()) {
                const userData = userSnap.data();
                this.currentUser = {
                    id: userId,
                    name: userData.displayName || 'User',
                    avatar: userData.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=user1',
                    bio: userData.bio || 'No bio available.',
                    email: userData.email || '',
                    profileComplete: userData.displayName && userData.avatar ? true : false
                };
                console.log('User profile loaded:', this.currentUser.name);
            } else {
                this.currentUser = {
                    id: userId,
                    name: this.firebaseUser.email.split('@')[0] || 'User',
                    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=user1',
                    bio: '',
                    email: this.firebaseUser.email,
                    profileComplete: false
                };
                console.log('New user profile created');
            }
        } catch (error) {
            console.error('Error loading user profile:', error);
        }
    }

    async needsProfileSetup() {
        if (!this.firebaseUser) return false;
        
        if (this.currentUser?.profileComplete) {
            return false;
        }
        
        try {
            const userRef = doc(db, 'group_users', this.firebaseUser.uid);
            const userSnap = await getDoc(userRef);
            
            if (userSnap.exists()) {
                const userData = userSnap.data();
                return !(userData.displayName && userData.avatar);
            }
            
            return true;
        } catch (error) {
            console.error('Error checking profile setup:', error);
            return true;
        }
    }

    async getAllGroups() {
        try {
            const cacheKey = 'all_groups';
            const cached = this.cache.allGroups.get(cacheKey);
            if (cached && Date.now() < cached.expiry) {
                return cached.data;
            }

            console.log('Fetching all groups from Firestore');
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
            });
            
            console.log(`Loaded ${groups.length} groups`);
            
            this.cache.allGroups.set(cacheKey, {
                data: groups,
                expiry: Date.now() + (2 * 60 * 1000) // 2 minutes cache
            });
            
            return groups;
        } catch (error) {
            console.error('Error getting groups:', error);
            throw error;
        }
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
                expiry: Date.now() + (2 * 60 * 1000) // 2 minutes cache
            });
            
            return isMember;
        } catch (error) {
            console.error('Error checking membership:', error);
            return false;
        }
    }

    async joinGroup(groupId) {
        try {
            if (!this.firebaseUser || !this.currentUser) {
                throw new Error('You must be logged in to join a group');
            }
            
            console.log(`Joining group: ${groupId}`);
            const groupRef = doc(db, 'groups', groupId);
            const groupSnap = await getDoc(groupRef);
            
            if (!groupSnap.exists()) {
                throw new Error('Group not found');
            }
            
            const group = groupSnap.data();
            
            const isMember = await this.hasJoinedGroup(groupId);
            if (isMember) {
                console.log('Already a member of this group');
                return true; // Already a member
            }
            
            if (group.memberCount >= group.maxMembers) {
                throw new Error('Group is full');
            }
            
            const role = group.createdBy === this.firebaseUser.uid ? 'creator' : 'member';
            const memberRef = doc(db, 'groups', groupId, 'members', this.firebaseUser.uid);
            
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
            
            await updateDoc(groupRef, {
                memberCount: increment(1),
                updatedAt: serverTimestamp(),
                lastActivity: serverTimestamp()
            });
            
            console.log(`Successfully joined group: ${group.name}`);
            
            // Clear cache
            this.cache.joinedGroups.delete(groupId);
            this.cache.allGroups.delete('all_groups');
            
            return true;
        } catch (error) {
            console.error('Error joining group:', error);
            throw error;
        }
    }

    initializePage() {
        const currentPage = window.location.pathname.split('/').pop();
        if (currentPage === 'groups.html') {
            console.log('Initializing groups page');
            initGroupsPage();
        }
    }
}

const groupsManager = new GroupsManager();

function initGroupsPage() {
    console.log('initGroupsPage called');
    
    const groupsGrid = document.getElementById('groupsGrid');
    const createGroupBtn = document.getElementById('createGroupBtn');
    const searchInput = document.getElementById('groupSearch');
    
    let allGroups = [];
    
    if (!groupsManager.firebaseUser) {
        console.log('No user, waiting for auth...');
        return;
    }
    
    console.log('Loading groups for user:', groupsManager.firebaseUser.uid);
    loadGroups();
    
    if (createGroupBtn) {
        createGroupBtn.addEventListener('click', async () => {
            console.log('Create group button clicked');
            if (!groupsManager.firebaseUser) {
                window.location.href = 'login.html';
                return;
            }
            
            const needsSetup = await groupsManager.needsProfileSetup();
            console.log('Profile setup needed:', needsSetup);
            if (needsSetup) {
                window.location.href = 'set.html?returnTo=create-group';
            } else {
                window.location.href = 'create-group.html';
            }
        });
    }
    
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase().trim();
            console.log('Searching for:', searchTerm);
            filterGroups(searchTerm);
        });
    }
    
    function generateGroupAvatar(group) {
        if (group.photoUrl) {
            return group.photoUrl;
        }
        const seed = encodeURIComponent(group.name);
        return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&backgroundColor=00897b,00acc1,039be5,1e88e5,3949ab,43a047,5e35b1,7cb342,8e24aa,c0ca33,d81b60,e53935,f4511e,fb8c00,fdd835,ffb300,ffd5dc,ffdfbf,c0aede,d1d4f9,b6e3f4&backgroundType=gradientLinear`;
    }
    
    async function loadGroups() {
        try {
            if (groupsGrid) {
                groupsGrid.innerHTML = '<div class="loading">Loading groups...</div>';
            }
            
            allGroups = await groupsManager.getAllGroups();
            displayGroups(allGroups);
        } catch (error) {
            console.error('Error loading groups:', error);
            if (groupsGrid) {
                groupsGrid.innerHTML = '<div class="no-groups"><p>Error loading groups. Please try again.</p></div>';
            }
        }
    }
    
    function displayGroups(groups) {
        if (!groupsGrid) {
            console.error('groupsGrid element not found!');
            return;
        }
        
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
                    <button id="createFirstGroupBtn" class="primary-btn" style="margin-top: 16px;">
                        Create Your First Group
                    </button>
                </div>
            `;
            
            const createFirstGroupBtn = document.getElementById('createFirstGroupBtn');
            if (createFirstGroupBtn) {
                createFirstGroupBtn.addEventListener('click', () => {
                    if (createGroupBtn) {
                        createGroupBtn.click();
                    }
                });
            }
            return;
        }
        
        console.log(`Displaying ${groups.length} groups`);
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
                    <p class="group-description">${group.description || 'No description'}</p>
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
        
        // Add event listeners to join buttons
        document.querySelectorAll('.join-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const groupId = e.target.dataset.groupId;
                console.log('Join button clicked for group:', groupId);
                
                if (!groupsManager.firebaseUser) {
                    console.log('No user, redirecting to login');
                    window.location.href = 'login.html';
                    return;
                }
                
                const needsSetup = await groupsManager.needsProfileSetup();
                console.log('Profile setup needed:', needsSetup);
                if (needsSetup) {
                    window.location.href = `set.html?id=${groupId}`;
                } else {
                    try {
                        const button = e.target;
                        const originalText = button.innerHTML;
                        
                        button.disabled = true;
                        button.innerHTML = `
                            <svg class="feather" data-feather="loader" style="animation: spin 1s linear infinite; width: 14px; height: 14px; margin-right: 8px;">
                                <circle cx="12" cy="12" r="10" />
                            </svg>
                            Joining...
                        `;
                        
                        await groupsManager.joinGroup(groupId);
                        
                        button.innerHTML = `
                            <svg class="feather" data-feather="check" style="width: 14px; height: 14px; margin-right: 8px;">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                            Joined!
                        `;
                        button.className = 'join-btn success';
                        
                        console.log('Group joined successfully, redirecting...');
                        setTimeout(() => {
                            window.location.href = `group.html?id=${groupId}`;
                        }, 1000);
                        
                    } catch (error) {
                        console.error('Error joining group:', error);
                        const button = e.target;
                        button.disabled = false;
                        button.textContent = 'Join Group';
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
        
        console.log(`Filtered to ${filtered.length} groups`);
        displayGroups(filtered);
    }
}

// Initialize the page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded - groups.js');
    
    // Add loading styles
    const style = document.createElement('style');
    style.textContent = `
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        .join-btn.success {
            background: linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%);
        }
    `;
    document.head.appendChild(style);
});

// Also check if page is already loaded when script loads
if (document.readyState === 'loading') {
    console.log('Document still loading');
} else {
    console.log('Document already loaded');
}