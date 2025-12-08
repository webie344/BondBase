// Firebase configuration
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    getDocs,
    query,
    where
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

// Load all users and their unread message counts
async function loadAllUsers() {
    try {
        const usersList = document.getElementById('usersList');
        
        // Get all users
        const usersRef = collection(db, 'users');
        const usersSnapshot = await getDocs(usersRef);
        
        let usersHTML = '';
        
        for (const userDoc of usersSnapshot.docs) {
            const userData = userDoc.data();
            const userId = userDoc.id;
            
            // Get unread message count for this user
            const unreadCount = await getUserUnreadCount(userId);
            
            usersHTML += `
                <div class="user-card">
                    ${unreadCount > 0 ? `<div class="unread-badge">${unreadCount}</div>` : ''}
                    <div class="user-header">
                        <div class="user-avatar"></div>
                        <div class="user-info">
                            <div class="user-name">${userData.name || 'No Name'}</div>
                            <div class="user-email">${userData.email || 'No Email'}</div>
                        </div>
                    </div>
                    <div class="user-stats">
                        <div class="stat">
                            <div class="stat-value">${userData.likes || 0}</div>
                            <div class="stat-label">Likes</div>
                        </div>
                        <div class="stat">
                            <div class="stat-value">${unreadCount}</div>
                            <div class="stat-label">Unread</div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        usersList.innerHTML = usersHTML || '<div class="loading">No users found</div>';
        
    } catch (error) {
        console.error('Error loading users:', error);
        document.getElementById('usersList').innerHTML = '<div class="loading">Error loading users</div>';
    }
}

// Get unread message count for a specific user
async function getUserUnreadCount(userId) {
    try {
        // Get all conversations where user is a participant
        const conversationsQuery = query(
            collection(db, 'conversations'),
            where('participants', 'array-contains', userId)
        );
        
        const conversationsSnapshot = await getDocs(conversationsQuery);
        let totalUnread = 0;
        
        for (const conversationDoc of conversationsSnapshot.docs) {
            const conversationId = conversationDoc.id;
            const participants = conversationDoc.data().participants || [];
            
            // Find the partner ID (the other user in the conversation)
            const partnerId = participants.find(id => id !== userId);
            if (!partnerId) continue;
            
            // Count unread messages from the partner
            const messagesQuery = query(
                collection(db, 'conversations', conversationId, 'messages'),
                where('senderId', '==', partnerId),
                where('read', '==', false)
            );
            
            const messagesSnapshot = await getDocs(messagesQuery);
            totalUnread += messagesSnapshot.size;
        }
        
        return totalUnread;
        
    } catch (error) {
        console.error('Error getting unread count for user:', userId, error);
        return 0;
    }
}

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
    loadAllUsers();
});