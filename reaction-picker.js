// reaction-picker.js
import { 
    getFirestore, 
    doc, 
    getDoc, 
    updateDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('Loading custom reaction picker module...');
    
    // Get elements
    const reactionOverlay = document.getElementById('reactionOverlay');
    const customReactionPicker = document.getElementById('customReactionPicker');
    const customReactionPickerGrid = customReactionPicker.querySelector('.custom-reaction-picker-grid');
    
    // Use the exact same emojis from app.js
    const EMOJI_REACTIONS = ['👍', '❤️', '🔥', '😘', '👎', '🤘', '💯'];
    
    // Global variables
    let currentMessageIdForReaction = null;
    let currentUser = null;
    let chatPartnerId = null;
    let db = null;
    
    // Initialize emojis
    customReactionPickerGrid.innerHTML = '';
    EMOJI_REACTIONS.forEach(emoji => {
        const emojiButton = document.createElement('div');
        emojiButton.className = 'reaction-emoji';
        emojiButton.textContent = emoji;
        emojiButton.addEventListener('click', async function(e) {
            e.stopPropagation();
            console.log('Emoji clicked:', emoji);
            
            await handleEmojiClick(emoji);
            hideCustomReactionPicker();
        });
        customReactionPickerGrid.appendChild(emojiButton);
    });
    
    // Function to handle emoji click
    async function handleEmojiClick(emoji) {
        // Try to get Firebase references
        await getFirebaseReferences();
        
        if (!currentMessageIdForReaction || !currentUser || !chatPartnerId || !db) {
            console.error('Missing required data:', {
                messageId: currentMessageIdForReaction,
                currentUser: currentUser?.uid,
                chatPartnerId: chatPartnerId,
                db: db ? 'available' : 'missing'
            });
            
            // Try to show a notification
            showAlert(`Cannot add reaction: Missing data. Please refresh and try again.`);
            return;
        }
        
        try {
            console.log('Adding reaction to message:', currentMessageIdForReaction);
            await addReactionToMessageDirect(emoji);
            console.log('Reaction added successfully');
            showAlert(`Reacted with ${emoji}`, 'success');
        } catch (error) {
            console.error('Error adding reaction:', error);
            showAlert('Failed to add reaction. Please try again.', 'error');
        }
    }
    
    // Try to get Firebase references from the global scope
    async function getFirebaseReferences() {
        // Try to get db from window object (set by app.js)
        if (window.db) {
            db = window.db;
            console.log('Got db from window.db');
        }
        
        // Try to get currentUser from window
        if (window.currentUser) {
            currentUser = window.currentUser;
            console.log('Got currentUser from window:', currentUser?.uid);
        }
        
        // Try to get chatPartnerId from window
        if (window.chatPartnerId) {
            chatPartnerId = window.chatPartnerId;
            console.log('Got chatPartnerId from window:', chatPartnerId);
        }
        
        // If chatPartnerId isn't in window, get it from URL
        if (!chatPartnerId) {
            const urlParams = new URLSearchParams(window.location.search);
            chatPartnerId = urlParams.get('id');
            console.log('Got chatPartnerId from URL:', chatPartnerId);
        }
        
        // If we still don't have db, try to get it from app initialization
        if (!db && window.firebaseApp) {
            try {
                db = getFirestore(window.firebaseApp);
                console.log('Got db from firebaseApp');
            } catch (error) {
                console.error('Failed to get db from firebaseApp:', error);
            }
        }
    }
    
    // Direct Firebase function to add reaction
    async function addReactionToMessageDirect(emoji) {
        const threadId = [currentUser.uid, chatPartnerId].sort().join('_');
        const messageRef = doc(db, 'conversations', threadId, 'messages', currentMessageIdForReaction);
        
        console.log('Firebase details:', {
            threadId: threadId,
            messageId: currentMessageIdForReaction,
            currentUserId: currentUser.uid,
            partnerId: chatPartnerId
        });
        
        // Get current message data
        const messageSnap = await getDoc(messageRef);
        
        if (!messageSnap.exists()) {
            throw new Error('Message not found');
        }
        
        const messageData = messageSnap.data();
        const reactions = messageData.reactions || {};
        const userReactionIndex = reactions[emoji] ? reactions[emoji].indexOf(currentUser.uid) : -1;
        
        if (userReactionIndex > -1) {
            // Remove reaction
            reactions[emoji].splice(userReactionIndex, 1);
            if (reactions[emoji].length === 0) {
                delete reactions[emoji];
            }
        } else {
            // Add reaction
            if (!reactions[emoji]) {
                reactions[emoji] = [];
            }
            reactions[emoji].push(currentUser.uid);
        }
        
        // Update the message
        await updateDoc(messageRef, {
            reactions: reactions,
            updatedAt: serverTimestamp()
        });
    }
    
    // Helper function to show alerts
    function showAlert(message, type = 'error') {
        if (window.showNotification) {
            window.showNotification(message, type);
        } else {
            alert(message);
        }
    }
    
    // Hide picker when clicking overlay
    reactionOverlay.addEventListener('click', hideCustomReactionPicker);
    
    // Hide picker when pressing Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && customReactionPicker.classList.contains('show')) {
            hideCustomReactionPicker();
        }
    });
    
    // Function to show our custom reaction picker
    window.showCustomReactionPicker = function(messageId) {
        console.log('Showing custom reaction picker for message:', messageId);
        currentMessageIdForReaction = messageId;
        
        // Hide any built-in reaction picker
        const builtInPicker = document.getElementById('reactionPicker');
        if (builtInPicker) {
            builtInPicker.style.display = 'none';
        }
        
        // Show our custom picker
        reactionOverlay.classList.add('show');
        customReactionPicker.classList.add('show');
        document.body.style.overflow = 'hidden';
    };
    
    // Function to hide our custom reaction picker
    function hideCustomReactionPicker() {
        console.log('Hiding custom reaction picker');
        currentMessageIdForReaction = null;
        reactionOverlay.classList.remove('show');
        customReactionPicker.classList.remove('show');
        document.body.style.overflow = '';
    }
    window.hideCustomReactionPicker = hideCustomReactionPicker;
    
    // Intercept clicks on messages
    function interceptMessageClicks() {
        const messagesContainer = document.getElementById('chatMessages');
        if (!messagesContainer) {
            setTimeout(interceptMessageClicks, 500);
            return;
        }
        
        // Remove any existing click listeners by replacing the container
        const newContainer = messagesContainer.cloneNode(true);
        messagesContainer.parentNode.replaceChild(newContainer, messagesContainer);
        
        // Add our own click handler to the new container
        newContainer.addEventListener('click', function(e) {
            // Find the clicked message element
            let messageElement = e.target.closest('.message');
            if (!messageElement) return;
            
            // Check if it's a received message (not sent by current user)
            if (messageElement.classList.contains('received')) {
                // Don't trigger if clicking on interactive elements
                if (e.target.closest('.voice-message-play-btn') || 
                    e.target.closest('.voice-message-controls') ||
                    e.target.closest('.message-reactions') ||
                    e.target.closest('.message-time') ||
                    e.target.closest('.video-play-btn') ||
                    e.target.tagName === 'IMG' ||
                    e.target.tagName === 'VIDEO' ||
                    e.target.closest('video') ||
                    e.target.closest('img') ||
                    e.target.closest('.reply-indicator') ||
                    e.target.closest('.reply-message-preview')) {
                    return;
                }
                
                // Get message ID
                const messageId = messageElement.dataset.messageId;
                if (messageId) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    console.log('Message clicked, showing custom picker for:', messageId);
                    window.showCustomReactionPicker(messageId);
                }
            }
        });
        
        // Also intercept contextmenu
        newContainer.addEventListener('contextmenu', function(e) {
            let messageElement = e.target.closest('.message');
            if (messageElement && messageElement.classList.contains('received')) {
                e.preventDefault();
                const messageId = messageElement.dataset.messageId;
                if (messageId) {
                    window.showCustomReactionPicker(messageId);
                }
            }
        });
    }
    
    // Start intercepting clicks after a short delay
    setTimeout(interceptMessageClicks, 1000);
    
    console.log('Custom reaction picker module loaded successfully');
});

