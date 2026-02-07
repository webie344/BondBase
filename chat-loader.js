// force-chat.js - Forces chat to load from URL parameters
console.log('=== FORCE CHAT LOADER STARTED ===');

(function() {
    // Get the user ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const targetUserId = urlParams.get('userId');
    
    console.log('Target User ID from URL:', targetUserId);
    
    if (!targetUserId) {
        console.error('No userId parameter in URL');
        return;
    }
    
    // Store globally
    window.FORCE_CHAT_USER_ID = targetUserId;
    
    // Wait for page to load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', forceLoadChat);
    } else {
        forceLoadChat();
    }
    
    // Also try on window load
    window.addEventListener('load', forceLoadChat);
    
    // Keep trying for a few seconds
    let attempts = 0;
    const maxAttempts = 20;
    const interval = setInterval(() => {
        attempts++;
        console.log(`Attempt ${attempts} to load chat...`);
        forceLoadChat();
        
        if (attempts >= maxAttempts) {
            clearInterval(interval);
            console.log('Max attempts reached');
        }
        
        // Check if chat loaded successfully
        if (isChatLoaded()) {
            clearInterval(interval);
            console.log('Chat loaded successfully!');
        }
    }, 500);
})();

function forceLoadChat() {
    const targetUserId = window.FORCE_CHAT_USER_ID;
    if (!targetUserId) return;
    
    console.log('Attempting to force load chat with user:', targetUserId);
    
    // Method 1: Try to find and click chat list item
    const chatListItems = document.querySelectorAll(`
        [data-user-id="${targetUserId}"],
        [data-id="${targetUserId}"],
        [data-uid="${targetUserId}"],
        [href*="${targetUserId}"],
        .user-item,
        .chat-user,
        .contact-item,
        .message-user
    `);
    
    console.log('Found chat list items:', chatListItems.length);
    
    chatListItems.forEach((item, index) => {
        console.log(`Item ${index}:`, item);
        
        // Check if this is the right user
        const itemUserId = item.dataset.userId || 
                          item.dataset.id || 
                          item.dataset.uid ||
                          item.getAttribute('href')?.match(/userId=([^&]+)/)?.[1];
        
        if (itemUserId === targetUserId || 
            item.textContent.includes(targetUserId) ||
            item.querySelector(`[data-user-id="${targetUserId}"]`)) {
            
            console.log('Clicking on user item:', item);
            item.click();
            
            // Try multiple click methods
            setTimeout(() => {
                // Try programmatic click
                if (item.click) item.click();
                
                // Try mouse events
                const mouseEvents = ['mousedown', 'mouseup', 'click'];
                mouseEvents.forEach(eventType => {
                    const event = new MouseEvent(eventType, {
                        view: window,
                        bubbles: true,
                        cancelable: true
                    });
                    item.dispatchEvent(event);
                });
            }, 100);
        }
    });
    
    // Method 2: Look for any element with user ID and click it
    const allElements = document.querySelectorAll('*');
    allElements.forEach(el => {
        if (el.textContent.includes(targetUserId) || 
            el.innerHTML.includes(targetUserId) ||
            el.outerHTML.includes(targetUserId)) {
            console.log('Found element with user ID:', el);
            el.click();
        }
    });
    
    // Method 3: Set localStorage/sessionStorage (common chat pattern)
    localStorage.setItem('selectedChatUser', targetUserId);
    sessionStorage.setItem('currentChatUserId', targetUserId);
    
    // Method 4: Dispatch custom event
    const chatEvent = new CustomEvent('selectChatUser', {
        detail: { userId: targetUserId }
    });
    document.dispatchEvent(chatEvent);
    window.dispatchEvent(chatEvent);
    
    // Method 5: If there's a chat input or send button, try to enable it
    const messageInput = document.querySelector('input[type="text"], textarea, #messageInput');
    const sendButton = document.querySelector('button, #sendButton, [type="submit"]');
    
    if (messageInput) {
        messageInput.dataset.targetUserId = targetUserId;
        messageInput.placeholder = `Message user ${targetUserId.substring(0, 8)}...`;
    }
    
    // Method 6: Look for any existing chat system functions and call them
    const possibleFunctions = [
        'loadChat',
        'openChat',
        'selectUser',
        'startChat',
        'initChat',
        'chatWithUser',
        'setActiveChat'
    ];
    
    possibleFunctions.forEach(funcName => {
        if (window[funcName] && typeof window[funcName] === 'function') {
            console.log(`Calling ${funcName}() with userId:`, targetUserId);
            try {
                window[funcName](targetUserId);
            } catch (e) {
                console.log(`Error calling ${funcName}:`, e);
            }
        }
    });
    
    // Method 7: Modify page content if still shows "no chat selected"
    const noChatElements = document.querySelectorAll(`
        *:contains("No chat selected"),
        *:contains("no chat selected"),
        *:contains("Select a chat"),
        *:contains("Select a conversation"),
        .empty-chat,
        .no-chat-selected
    `);
    
    noChatElements.forEach(el => {
        console.log('Found "no chat" element, updating:', el);
        el.innerHTML = `<div style="padding: 20px; text-align: center;">
            <h3>Loading chat with user...</h3>
            <p>User ID: ${targetUserId.substring(0, 8)}...</p>
            <button onclick="location.reload()" style="margin-top: 10px;">
                Refresh if not loading
            </button>
        </div>`;
    });
}

function isChatLoaded() {
    // Check if chat appears to be loaded
    const indicators = [
        document.querySelector('.chat-messages'),
        document.querySelector('.message-list'),
        document.querySelector('.conversation'),
        document.querySelector('[class*="message"]'),
        document.querySelector('[class*="chat"]:not(.no-chat)')
    ];
    
    return indicators.some(indicator => indicator && indicator.children.length > 0);
}

// Create a manual override button
setTimeout(() => {
    const manualButton = document.createElement('button');
    manualButton.innerHTML = '📨 FORCE LOAD CHAT';
    manualButton.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #ff2a6d;
        color: white;
        border: none;
        padding: 10px 15px;
        border-radius: 20px;
        cursor: pointer;
        z-index: 9999;
        font-weight: bold;
        box-shadow: 0 4px 12px rgba(255, 42, 109, 0.4);
    `;
    manualButton.onclick = forceLoadChat;
    document.body.appendChild(manualButton);
}, 1000);

// Debug: Log all clickable elements
setTimeout(() => {
    console.log('=== ALL CLICKABLE ELEMENTS ===');
    const clickables = document.querySelectorAll('a, button, [onclick], [data-action], [role="button"]');
    clickables.forEach((el, i) => {
        console.log(`${i}:`, el.tagName, el.className, el.textContent.substring(0, 50));
    });
}, 2000);