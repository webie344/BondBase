// clean.js - Waits for Firebase to be loaded by group.js

let cleanupInitialized = false;

function initializeCleanup() {
    if (cleanupInitialized) return;
    
    // Check if groupChat exists (means group.js has loaded)
    if (typeof window.groupChat !== 'undefined') {
        console.log('clean.js: groupChat detected, setting up cleanup');
        cleanupInitialized = true;
        
        // Global cleanup function
        window.cleanAllFirebaseListeners = function() {
            console.log('cleanAllFirebaseListeners: Cleaning up Firebase listeners...');
            
            // Clean up groupChat if it exists
            if (window.groupChat && typeof window.groupChat.cleanup === 'function') {
                try {
                    console.log('Cleaning groupChat listeners');
                    window.groupChat.cleanup();
                } catch (err) {
                    console.error('Error cleaning groupChat:', err);
                }
            }
        };
        
        // Setup cleanup triggers
        document.addEventListener('visibilitychange', function() {
            if (document.hidden) {
                console.log('Page hidden - cleaning listeners');
                window.cleanAllFirebaseListeners();
            }
        });
        
        window.addEventListener('beforeunload', function() {
            console.log('Page unloading - cleaning listeners');
            window.cleanAllFirebaseListeners();
        });
        
        // Clean up when navigating TO a non-group page
        const currentPage = window.location.pathname.split('/').pop();
        const isGroupRelatedPage = currentPage.includes('group.html') || 
                                   currentPage.includes('chats.html');
        
        if (!isGroupRelatedPage) {
            console.log('Not a group page - cleaning old listeners');
            setTimeout(() => window.cleanAllFirebaseListeners(), 1000);
        }
        
        console.log('clean.js: Cleanup setup complete');
    } else {
        // groupChat not loaded yet, check again in 500ms
        console.log('clean.js: Waiting for group.js to load...');
        setTimeout(initializeCleanup, 500);
    }
}

// Start checking for group.js
setTimeout(initializeCleanup, 1000);

// Also listen for custom event from group.js
document.addEventListener('groupAuthReady', function() {
    console.log('clean.js: Received groupAuthReady event');
    initializeCleanup();
});

console.log('clean.js loaded - waiting for group.js');