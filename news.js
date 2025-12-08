// Firebase configuration
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    doc, 
    getDocs,
    query,
    where,
    orderBy,
    limit,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// Global variables
let newAccounts = [];
let recentMessages = [];
let allUsers = [];

// DOM Elements
const newAccountsList = document.getElementById('newAccountsList');
const recentMessagesList = document.getElementById('recentMessagesList');
const newAccountsCount = document.getElementById('newAccountsCount');
const activeMessagingCount = document.getElementById('activeMessagingCount');
const totalMessagesCount = document.getElementById('totalMessagesCount');
const avgMessagesCount = document.getElementById('avgMessagesCount');

// Initialize the page
document.addEventListener('DOMContentLoaded', async () => {
    await loadAllData();
});

// Load all data
async function loadAllData() {
    try {
        await loadNewAccounts();
        await loadRecentMessages();
        await loadStatistics();
    } catch (error) {
        console.error('Error loading data:', error);
        showError('Failed to load data. Please try again.');
    }
}

// Load new accounts from last 24 hours
async function loadNewAccounts() {
    try {
        newAccountsList.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading new accounts...</div>';
        
        const usersRef = collection(db, 'users');
        const usersSnap = await getDocs(usersRef);
        
        allUsers = [];
        usersSnap.forEach(doc => {
            const userData = doc.data();
            allUsers.push({
                id: doc.id,
                ...userData,
                createdAt: userData.createdAt || null
            });
        });

        // Filter users created in the last 24 hours
        const twentyFourHoursAgo = new Date();
        twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

        newAccounts = allUsers.filter(user => {
            if (!user.createdAt) return false;
            
            let userDate;
            if (user.createdAt.toDate) {
                userDate = user.createdAt.toDate();
            } else if (user.createdAt instanceof Date) {
                userDate = user.createdAt;
            } else {
                userDate = new Date(user.createdAt);
            }
            
            return userDate >= twentyFourHoursAgo;
        });

        // Sort by creation date (newest first)
        newAccounts.sort((a, b) => {
            const dateA = a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
            const dateB = b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
            return dateB - dateA;
        });

        displayNewAccounts();
        
    } catch (error) {
        console.error('Error loading new accounts:', error);
        newAccountsList.innerHTML = '<div class="no-data">Error loading new accounts</div>';
    }
}

// Display new accounts in the list
function displayNewAccounts() {
    if (newAccounts.length === 0) {
        newAccountsList.innerHTML = '<div class="no-data">No new accounts in the last 24 hours</div>';
        return;
    }

    newAccountsList.innerHTML = '';
    
    newAccounts.forEach(user => {
        const userDate = user.createdAt.toDate ? user.createdAt.toDate() : new Date(user.createdAt);
        const timeAgo = getTimeAgo(userDate);
        
        const userItem = document.createElement('div');
        userItem.className = 'user-item';
        userItem.innerHTML = `
            <div class="user-header">
                <div class="user-name">${user.name || 'Unknown User'}</div>
                <div class="user-time">${timeAgo}</div>
            </div>
            <div class="user-details">
                <div class="user-email"><strong>Email:</strong> ${user.email || 'No email'}</div>
                <div><strong>Age:</strong> ${user.age || 'Not set'}</div>
                <div><strong>Location:</strong> ${user.location || 'Not set'}</div>
                <div><strong>Profile Complete:</strong> ${user.profileComplete ? 'Yes' : 'No'}</div>
            </div>
            <button class="refresh-btn" onclick="viewUserMessages('${user.id}', '${user.name || 'Unknown User'}')" style="margin-top: 10px; width: 100%;">
                <i class="fas fa-envelope"></i> View Messages
            </button>
        `;
        
        newAccountsList.appendChild(userItem);
    });
}

// Load recent messages from all conversations
async function loadRecentMessages() {
    try {
        recentMessagesList.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading messages...</div>';
        
        // Get all conversations
        const conversationsRef = collection(db, 'conversations');
        const conversationsSnap = await getDocs(conversationsRef);
        
        recentMessages = [];
        
        // Get messages from each conversation
        for (const conversationDoc of conversationsSnap.docs) {
            const messagesRef = collection(db, 'conversations', conversationDoc.id, 'messages');
            const messagesQuery = query(messagesRef, orderBy('timestamp', 'desc'), limit(10));
            const messagesSnap = await getDocs(messagesQuery);
            
            for (const messageDoc of messagesSnap.docs) {
                const messageData = messageDoc.data();
                
                // Get sender info
                let senderName = 'Unknown User';
                let senderEmail = 'No email';
                
                if (allUsers.length > 0) {
                    const sender = allUsers.find(u => u.id === messageData.senderId);
                    if (sender) {
                        senderName = sender.name || 'Unknown User';
                        senderEmail = sender.email || 'No email';
                    }
                }
                
                // Get recipient info (other participant in conversation)
                const participants = conversationDoc.data().participants || [];
                const recipientId = participants.find(id => id !== messageData.senderId);
                let recipientName = 'Unknown User';
                
                if (recipientId && allUsers.length > 0) {
                    const recipient = allUsers.find(u => u.id === recipientId);
                    if (recipient) {
                        recipientName = recipient.name || 'Unknown User';
                    }
                }
                
                const messageDate = messageData.timestamp?.toDate ? messageData.timestamp.toDate() : new Date(messageData.timestamp);
                const timeAgo = getTimeAgo(messageDate);
                
                recentMessages.push({
                    id: messageDoc.id,
                    conversationId: conversationDoc.id,
                    senderId: messageData.senderId,
                    senderName: senderName,
                    senderEmail: senderEmail,
                    recipientId: recipientId,
                    recipientName: recipientName,
                    text: messageData.text,
                    imageUrl: messageData.imageUrl,
                    audioUrl: messageData.audioUrl,
                    videoUrl: messageData.videoUrl,
                    timestamp: messageDate,
                    timeAgo: timeAgo,
                    type: getMessageType(messageData)
                });
            }
        }
        
        // Sort by timestamp (newest first)
        recentMessages.sort((a, b) => b.timestamp - a.timestamp);
        
        // Limit to 20 most recent messages
        recentMessages = recentMessages.slice(0, 20);
        
        displayRecentMessages();
        
    } catch (error) {
        console.error('Error loading recent messages:', error);
        recentMessagesList.innerHTML = '<div class="no-data">Error loading messages</div>';
    }
}

// Display recent messages in the list
function displayRecentMessages() {
    if (recentMessages.length === 0) {
        recentMessagesList.innerHTML = '<div class="no-data">No messages found</div>';
        return;
    }

    recentMessagesList.innerHTML = '';
    
    recentMessages.forEach(message => {
        const messageItem = document.createElement('div');
        messageItem.className = 'message-item';
        
        let messageContent = '';
        if (message.text) {
            messageContent = message.text;
        } else if (message.imageUrl) {
            messageContent = '📷 Image Message';
        } else if (message.audioUrl) {
            messageContent = '🎤 Voice Message';
        } else if (message.videoUrl) {
            messageContent = '🎥 Video Message';
        } else {
            messageContent = 'Empty message';
        }
        
        messageItem.innerHTML = `
            <div class="message-header">
                <div class="message-sender">${message.senderName} → ${message.recipientName}</div>
                <div class="message-time">${message.timeAgo}</div>
            </div>
            <div class="message-details">
                <div class="message-recipient"><strong>From:</strong> ${message.senderEmail}</div>
            </div>
            <div class="message-content">
                <div class="message-text">${messageContent}</div>
                <div class="message-type">${message.type}</div>
            </div>
        `;
        
        recentMessagesList.appendChild(messageItem);
    });
}

// Load statistics
async function loadStatistics() {
    try {
        // New accounts count
        newAccountsCount.textContent = newAccounts.length;
        
        // Active messaging (users who sent messages in last 24 hours)
        const twentyFourHoursAgo = new Date();
        twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
        
        const recentSenders = [...new Set(recentMessages
            .filter(msg => msg.timestamp >= twentyFourHoursAgo)
            .map(msg => msg.senderId)
        )];
        
        activeMessagingCount.textContent = recentSenders.length;
        
        // Total messages count
        totalMessagesCount.textContent = recentMessages.length;
        
        // Average messages per user
        const avgMessages = recentMessages.length > 0 ? 
            (recentMessages.length / Math.max(recentSenders.length, 1)).toFixed(1) : '0';
        avgMessagesCount.textContent = avgMessages;
        
        // Update change indicators (simplified - you can enhance this with historical data)
        document.getElementById('accountsChange').textContent = 'Last 24h';
        document.getElementById('messagingChange').textContent = 'Active users';
        document.getElementById('messagesChange').textContent = 'Total tracked';
        document.getElementById('avgChange').textContent = 'Per active user';
        
    } catch (error) {
        console.error('Error loading statistics:', error);
    }
}

// View messages for a specific user
async function viewUserMessages(userId, userName) {
    try {
        // Filter messages by this user
        const userMessages = recentMessages.filter(msg => 
            msg.senderId === userId || msg.recipientId === userId
        );
        
        if (userMessages.length === 0) {
            alert(`${userName} hasn't sent or received any messages yet.`);
            return;
        }
        
        // Create a modal or redirect to a detailed view
        showUserMessagesModal(userMessages, userName);
        
    } catch (error) {
        console.error('Error viewing user messages:', error);
        alert('Error loading user messages. Please try again.');
    }
}

// Show user messages in a modal
function showUserMessagesModal(messages, userName) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
    `;
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: white;
        padding: 30px;
        border-radius: 15px;
        max-width: 600px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
    `;
    
    let messagesHTML = `
        <div style="margin-bottom: 20px;">
            <h2 style="color: #4a8cff; margin-bottom: 10px;">Messages by ${userName}</h2>
            <p style="color: #666;">Total messages: ${messages.length}</p>
        </div>
    `;
    
    messages.forEach(message => {
        let messageContent = '';
        if (message.text) {
            messageContent = message.text;
        } else if (message.imageUrl) {
            messageContent = '📷 Image Message';
        } else if (message.audioUrl) {
            messageContent = '🎤 Voice Message';
        } else if (message.videoUrl) {
            messageContent = '🎥 Video Message';
        }
        
        messagesHTML += `
            <div style="background: #f8f9fa; padding: 15px; border-radius: 10px; margin-bottom: 10px; border-left: 4px solid #4a8cff;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <strong>To: ${message.recipientName}</strong>
                    <span style="color: #666; font-size: 12px;">${message.timeAgo}</span>
                </div>
                <div style="background: white; padding: 10px; border-radius: 8px;">
                    ${messageContent}
                    <div style="display: inline-block; background: #4a8cff; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; margin-top: 5px;">
                        ${message.type}
                    </div>
                </div>
            </div>
        `;
    });
    
    modalContent.innerHTML = messagesHTML + `
        <button onclick="this.closest('div').parentElement.remove()" 
                style="background: #6c757d; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; margin-top: 20px; width: 100%;">
            Close
        </button>
    `;
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
}

// Helper function to get message type
function getMessageType(messageData) {
    if (messageData.text) return 'Text';
    if (messageData.imageUrl) return 'Image';
    if (messageData.audioUrl) return 'Voice';
    if (messageData.videoUrl) return 'Video';
    return 'Unknown';
}

// Helper function to get time ago string
function getTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
}

// Helper function to show error messages
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #dc3545;
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        z-index: 10001;
        max-width: 300px;
    `;
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

// Make functions available globally
window.loadNewAccounts = loadNewAccounts;
window.loadRecentMessages = loadRecentMessages;
window.viewUserMessages = viewUserMessages;

