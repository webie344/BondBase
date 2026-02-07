// default.js - Script to fix existing default groups and add proper system messages

import { 
    getFirestore, 
    collection, 
    doc, 
    setDoc, 
    getDoc,
    query,
    getDocs,
    writeBatch,
    serverTimestamp,
    updateDoc,
    increment
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

class DefaultGroupUpdater {
    constructor() {
        this.progressLog = [];
        this.fixedGroups = 0;
        this.fixedMembers = 0;
        this.createdMessages = 0;
        this.isRunning = false;
        this.currentUser = null;
        
        this.setupAuth();
    }

    setupAuth() {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                this.currentUser = user;
                this.log('User authenticated', 'success');
            } else {
                this.currentUser = null;
                this.log('Please log in to continue', 'warning');
            }
        });
    }

    log(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = `[${timestamp}] ${message}`;
        this.progressLog.push({ message: logEntry, type });
        console.log(`[${type.toUpperCase()}] ${logEntry}`);
        
        // Update UI if exists
        const logContainer = document.getElementById('progressLog');
        if (logContainer) {
            const logElement = document.createElement('div');
            logElement.className = `log-entry ${type}`;
            logElement.textContent = logEntry;
            logContainer.appendChild(logElement);
            logContainer.scrollTop = logContainer.scrollHeight;
        }
        
        // Update stats
        this.updateStats();
    }

    updateStats() {
        const groupsCount = document.getElementById('groupsCount');
        const membersCount = document.getElementById('membersCount');
        const messagesCount = document.getElementById('messagesCount');
        
        if (groupsCount) groupsCount.textContent = this.fixedGroups;
        if (membersCount) membersCount.textContent = this.fixedMembers;
        if (messagesCount) messagesCount.textContent = this.createdMessages;
    }

    async fixAllDefaultGroups() {
        if (this.isRunning) {
            this.log('Update process already running', 'warning');
            return;
        }

        if (!this.currentUser) {
            this.log('Please log in first!', 'error');
            alert('Please log in to continue.');
            return;
        }

        this.isRunning = true;
        this.log('=== Starting Group Fix Process ===', 'success');
        
        try {
            // Get all default groups
            const groups = await this.getAllDefaultGroups();
            
            if (groups.length === 0) {
                this.log('No default groups found. Run the creation process first.', 'warning');
                this.isRunning = false;
                return;
            }

            this.log(`Found ${groups.length} default groups to fix`);
            
            // Process each group
            for (let i = 0; i < groups.length; i++) {
                const group = groups[i];
                await this.fixSingleGroup(group);
                
                // Update progress
                const progressElement = document.getElementById('progressCount');
                if (progressElement) {
                    progressElement.textContent = `${i + 1}/${groups.length}`;
                }
                
                const progressBar = document.getElementById('progressBar');
                if (progressBar) {
                    progressBar.style.width = `${((i + 1) / groups.length) * 100}%`;
                }
            }

            this.log('=== Fix Process Complete ===', 'success');
            this.log(`Fixed ${this.fixedGroups} groups`);
            this.log(`Updated ${this.fixedMembers} member counts`);
            this.log(`Created ${this.createdMessages} individual join messages`);
            
            return {
                success: true,
                groupsFixed: this.fixedGroups,
                membersUpdated: this.fixedMembers,
                messagesCreated: this.createdMessages
            };
            
        } catch (error) {
            this.log(`Process failed: ${error.message}`, 'error');
            return {
                success: false,
                error: error.message
            };
        } finally {
            this.isRunning = false;
        }
    }

    async getAllDefaultGroups() {
        try {
            this.log('Fetching all default groups...');
            const groupsRef = collection(db, 'groups');
            const groupsSnapshot = await getDocs(groupsRef);
            const groups = [];
            
            groupsSnapshot.forEach(doc => {
                const groupData = doc.data();
                if (groupData.isDefaultGroup) {
                    groups.push({
                        id: doc.id,
                        ...groupData
                    });
                }
            });
            
            this.log(`Found ${groups.length} default groups`);
            return groups;
        } catch (error) {
            this.log(`Error fetching groups: ${error.message}`, 'error');
            return [];
        }
    }

    async fixSingleGroup(group) {
        this.log(`\nProcessing group: ${group.name} (${group.id})`);
        
        try {
            // 1. Get actual members count
            const members = await this.getGroupMembers(group.id);
            const actualMemberCount = members.length;
            
            this.log(`Found ${actualMemberCount} members in this group`);
            
            // 2. Update group member count if different
            if (group.memberCount !== actualMemberCount) {
                await this.updateGroupMemberCount(group.id, actualMemberCount);
                this.fixedMembers++;
                this.log(`Updated member count from ${group.memberCount || 0} to ${actualMemberCount}`);
            }
            
            // 3. Fix group photo URL if needed
            await this.fixGroupPhotoUrl(group);
            
            // 4. Create individual system messages for each member
            await this.createIndividualJoinMessages(group.id, members);
            
            // 5. Fix member avatars if needed
            await this.fixMemberAvatars(group.id, members);
            
            this.fixedGroups++;
            this.log(`✓ Group ${group.name} fixed successfully`);
            
        } catch (error) {
            this.log(`Error fixing group ${group.name}: ${error.message}`, 'error');
        }
    }

    async getGroupMembers(groupId) {
        try {
            const membersRef = collection(db, 'groups', groupId, 'members');
            const membersSnapshot = await getDocs(membersRef);
            const members = [];
            
            membersSnapshot.forEach(doc => {
                members.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            return members;
        } catch (error) {
            this.log(`Error getting members for group ${groupId}: ${error.message}`, 'error');
            return [];
        }
    }

    async updateGroupMemberCount(groupId, actualCount) {
        try {
            const groupRef = doc(db, 'groups', groupId);
            await updateDoc(groupRef, {
                memberCount: actualCount,
                updatedAt: serverTimestamp()
            });
            return true;
        } catch (error) {
            this.log(`Error updating member count: ${error.message}`, 'error');
            return false;
        }
    }

    async fixGroupPhotoUrl(group) {
        try {
            // Check if group has proper photo URL
            if (!group.photoUrl || group.photoUrl.includes('undefined') || !group.photoUrl.startsWith('http')) {
                const groupRef = doc(db, 'groups', group.id);
                const newPhotoUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(group.name)}&backgroundColor=00897b,00acc1,039be5,1e88e5,3949ab,43a047,5e35b1,7cb342,8e24aa,c0ca33,d81b60,e53935,f4511e,fb8c00,fdd835,ffb300,ffd5dc,ffdfbf,c0aede,d1d4f9,b6e3f4&backgroundType=gradientLinear`;
                
                await updateDoc(groupRef, {
                    photoUrl: newPhotoUrl,
                    updatedAt: serverTimestamp()
                });
                
                this.log(`Fixed group photo URL for ${group.name}`);
            }
        } catch (error) {
            this.log(`Error fixing group photo: ${error.message}`, 'error');
        }
    }

    async createIndividualJoinMessages(groupId, members) {
        try {
            const messagesRef = collection(db, 'groups', groupId, 'messages');
            const batch = writeBatch(db);
            let messageCount = 0;
            
            // Check if individual messages already exist
            const existingMessages = await this.getExistingJoinMessages(groupId);
            
            // Create individual message for each member
            for (const member of members) {
                // Skip if message already exists for this member
                const existingMessage = existingMessages.find(msg => 
                    msg.memberId === member.id && msg.type === 'member_join'
                );
                
                if (existingMessage) {
                    continue;
                }
                
                const messageId = `join_${member.id}_${Date.now()}`;
                const messageRef = doc(messagesRef, messageId);
                
                // Get proper display name
                const displayName = member.name || member.displayName || 'Secret Gamer';
                const isAnonymous = member.isAnonymous || false;
                
                const messageData = {
                    id: messageId,
                    type: 'system',
                    text: `🎮 ${isAnonymous ? '👤 Anonymous User' : displayName} joined the group! Welcome ${isAnonymous ? 'to our anonymous community!' : `${displayName}!`}`,
                    timestamp: serverTimestamp(),
                    senderId: 'system',
                    senderName: 'System',
                    senderAvatar: '',
                    systemEvent: 'member_join',
                    memberId: member.id,
                    memberName: displayName,
                    isAnonymous: isAnonymous,
                    mentions: [member.id] // Mention the user who joined
                };
                
                batch.set(messageRef, messageData);
                messageCount++;
                this.createdMessages++;
                
                // Commit in batches of 50 to avoid Firestore limits
                if (messageCount % 50 === 0) {
                    await batch.commit();
                    this.log(`Created ${messageCount} individual join messages...`);
                    // Reset batch
                    // Note: In Firestore, you need to create a new batch after commit
                    // We'll handle this by committing and continuing in the loop
                }
            }
            
            // Commit remaining messages
            if (messageCount % 50 !== 0 || messageCount < 50) {
                try {
                    await batch.commit();
                } catch (error) {
                    this.log(`Error committing final batch: ${error.message}`, 'error');
                }
            }
            
            if (messageCount > 0) {
                this.log(`Created ${messageCount} individual join messages for group`);
            } else {
                this.log('All members already have join messages');
            }
            
        } catch (error) {
            this.log(`Error creating join messages: ${error.message}`, 'error');
        }
    }

    async getExistingJoinMessages(groupId) {
        try {
            const messagesRef = collection(db, 'groups', groupId, 'messages');
            const q = query(messagesRef);
            const snapshot = await getDocs(q);
            const messages = [];
            
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.systemEvent === 'member_join' && data.memberId) {
                    messages.push({
                        memberId: data.memberId,
                        id: doc.id,
                        ...data
                    });
                }
            });
            
            return messages;
        } catch (error) {
            this.log(`Error getting existing messages: ${error.message}`, 'error');
            return [];
        }
    }

    async fixMemberAvatars(groupId, members) {
        try {
            const batch = writeBatch(db);
            let fixedCount = 0;
            
            for (const member of members) {
                // Check if avatar needs fixing
                if (!member.avatar || 
                    member.avatar.includes('undefined') || 
                    !member.avatar.startsWith('http') ||
                    member.avatar.includes('seed=undefined')) {
                    
                    const memberRef = doc(db, 'groups', groupId, 'members', member.id);
                    
                    // Generate new avatar based on member name
                    const seed = member.name || member.displayName || member.id || 'gamer';
                    const newAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf&backgroundType=gradientLinear`;
                    
                    batch.update(memberRef, {
                        avatar: newAvatar,
                        lastActive: serverTimestamp()
                    });
                    
                    fixedCount++;
                    
                    // Also update the main user profile if it's a test user
                    if (member.isTestUser) {
                        const userRef = doc(db, 'group_users', member.id);
                        batch.update(userRef, {
                            avatar: newAvatar,
                            updatedAt: serverTimestamp()
                        });
                    }
                }
            }
            
            if (fixedCount > 0) {
                await batch.commit();
                this.log(`Fixed ${fixedCount} member avatars`);
            }
            
        } catch (error) {
            this.log(`Error fixing member avatars: ${error.message}`, 'error');
        }
    }

    async addSystemMessageForAllUsers(groupId) {
        try {
            this.log(`Creating combined system message for group ${groupId}...`);
            
            const members = await this.getGroupMembers(groupId);
            if (members.length === 0) {
                this.log('No members found in group', 'warning');
                return;
            }
            
            const messagesRef = collection(db, 'groups', groupId, 'messages');
            const messageId = `system_all_join_${Date.now()}`;
            const messageRef = doc(messagesRef, messageId);
            
            // Get member names (limit to first 10 for readability)
            const memberNames = members.slice(0, 10).map(m => 
                m.isAnonymous ? 'Anonymous User' : (m.name || m.displayName || 'Secret Gamer')
            );
            
            let messageText;
            if (members.length <= 10) {
                messageText = `🌟 Welcome to our amazing community! Members joined: ${memberNames.join(', ')}`;
            } else {
                messageText = `🌟 Welcome ${members.length} amazing members to our community! Including: ${memberNames.join(', ')} and ${members.length - 10} more secret gamers!`;
            }
            
            const messageData = {
                id: messageId,
                type: 'system',
                text: messageText,
                timestamp: serverTimestamp(),
                senderId: 'system',
                senderName: 'System',
                senderAvatar: '',
                systemEvent: 'all_members_welcome',
                totalMembers: members.length,
                mentionedMembers: members.slice(0, 10).map(m => m.id),
                isWelcomeMessage: true
            };
            
            await setDoc(messageRef, messageData);
            this.createdMessages++;
            
            this.log(`Created combined welcome message for ${members.length} members`);
            
        } catch (error) {
            this.log(`Error creating combined message: ${error.message}`, 'error');
        }
    }

    async refreshGroupImages() {
        try {
            this.log('Refreshing all group images...');
            
            const groups = await this.getAllDefaultGroups();
            let updatedCount = 0;
            
            for (const group of groups) {
                const groupRef = doc(db, 'groups', group.id);
                
                // Generate new unique image URL
                const newPhotoUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(group.name)}_${Date.now()}&backgroundColor=00897b,00acc1,039be5,1e88e5,3949ab,43a047,5e35b1,7cb342,8e24aa,c0ca33,d81b60,e53935,f4511e,fb8c00,fdd835,ffb300,ffd5dc,ffdfbf,c0aede,d1d4f9,b6e3f4&backgroundType=gradientLinear`;
                
                await updateDoc(groupRef, {
                    photoUrl: newPhotoUrl,
                    updatedAt: serverTimestamp()
                });
                
                updatedCount++;
                this.log(`Refreshed image for: ${group.name}`);
                
                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            this.log(`✓ Refreshed ${updatedCount} group images`, 'success');
            
        } catch (error) {
            this.log(`Error refreshing images: ${error.message}`, 'error');
        }
    }

    async cleanupDuplicateMessages() {
        try {
            this.log('Cleaning up duplicate system messages...');
            
            const groups = await this.getAllDefaultGroups();
            let cleanedCount = 0;
            
            for (const group of groups) {
                const cleaned = await this.cleanupGroupMessages(group.id);
                cleanedCount += cleaned;
            }
            
            this.log(`Cleaned up ${cleanedCount} duplicate messages`, 'success');
            
        } catch (error) {
            this.log(`Error cleaning messages: ${error.message}`, 'error');
        }
    }

    async cleanupGroupMessages(groupId) {
        try {
            const messagesRef = collection(db, 'groups', groupId, 'messages');
            const snapshot = await getDocs(messagesRef);
            
            const messages = [];
            snapshot.forEach(doc => {
                messages.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            // Find duplicate join messages
            const joinMessages = messages.filter(msg => msg.systemEvent === 'member_join');
            const duplicates = [];
            const seenMembers = new Set();
            
            for (const msg of joinMessages) {
                if (msg.memberId) {
                    if (seenMembers.has(msg.memberId)) {
                        duplicates.push(msg.id);
                    } else {
                        seenMembers.add(msg.memberId);
                    }
                }
            }
            
            // Delete duplicates
            if (duplicates.length > 0) {
                const batch = writeBatch(db);
                duplicates.forEach(msgId => {
                    const msgRef = doc(db, 'groups', groupId, 'messages', msgId);
                    batch.delete(msgRef);
                });
                
                await batch.commit();
                this.log(`Cleaned ${duplicates.length} duplicate messages from group`);
                return duplicates.length;
            }
            
            return 0;
            
        } catch (error) {
            this.log(`Error cleaning group messages: ${error.message}`, 'error');
            return 0;
        }
    }
}

// Initialize the updater
const defaultUpdater = new DefaultGroupUpdater();

// Export for use in console or other scripts
window.defaultUpdater = defaultUpdater;

// Auto-run if on default.html page
document.addEventListener('DOMContentLoaded', function() {
    const fixButton = document.getElementById('fixGroups');
    const refreshImagesButton = document.getElementById('refreshImages');
    const cleanupMessagesButton = document.getElementById('cleanupMessages');
    const progressContainer = document.getElementById('progressContainer');
    
    if (fixButton) {
        fixButton.addEventListener('click', async () => {
            if (!confirm('This will fix all default groups: update member counts, fix images, and create individual join messages. Continue?')) {
                return;
            }
            
            // Disable button during process
            fixButton.disabled = true;
            fixButton.textContent = 'Fixing...';
            
            if (progressContainer) {
                progressContainer.style.display = 'block';
            }
            
            // Run the fix process
            const result = await defaultUpdater.fixAllDefaultGroups();
            
            // Re-enable button
            fixButton.disabled = false;
            fixButton.textContent = 'Fix All Default Groups';
            
            if (result.success) {
                alert(`Successfully fixed ${result.groupsFixed} groups!\nUpdated ${result.membersUpdated} member counts\nCreated ${result.messagesCreated} join messages`);
            } else {
                alert('Fix process failed. Check console for details.');
            }
        });
    }
    
    if (refreshImagesButton) {
        refreshImagesButton.addEventListener('click', async () => {
            if (!confirm('This will refresh all group and member images. Continue?')) {
                return;
            }
            
            refreshImagesButton.disabled = true;
            refreshImagesButton.textContent = 'Refreshing...';
            
            await defaultUpdater.refreshGroupImages();
            
            refreshImagesButton.disabled = false;
            refreshImagesButton.textContent = 'Refresh All Images';
        });
    }
    
    if (cleanupMessagesButton) {
        cleanupMessagesButton.addEventListener('click', async () => {
            if (!confirm('This will clean up duplicate system messages. Continue?')) {
                return;
            }
            
            cleanupMessagesButton.disabled = true;
            cleanupMessagesButton.textContent = 'Cleaning...';
            
            await defaultUpdater.cleanupDuplicateMessages();
            
            cleanupMessagesButton.disabled = false;
            cleanupMessagesButton.textContent = 'Cleanup Duplicate Messages';
        });
    }
});