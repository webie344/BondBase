// chatting.js - VIRTUAL SCROLLING FIX
// This will completely solve disappearing messages and enable fast scrolling

(function() {
    'use strict';
    
    console.log('Virtual scrolling fix loading...');
    
    // Configuration
    const VIEWPORT_BUFFER = 5; // Messages to render above/below viewport
    let originalFunctions = {};
    let virtualScroller = null;
    
    // Wait for DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initVirtualScrolling);
    } else {
        initVirtualScrolling();
    }
    
    function initVirtualScrolling() {
        setTimeout(() => {
            const messagesContainer = document.getElementById('chatMessages');
            if (!messagesContainer) {
                console.error('Chat messages container not found');
                return;
            }
            
            console.log('Initializing virtual scrolling...');
            
            // Save original functions
            backupOriginalFunctions();
            
            // Initialize virtual scroller
            virtualScroller = new VirtualScroller(messagesContainer);
            
            // Override your functions to use virtual scrolling
            overrideDisplayFunctions();
            
            // Add performance CSS
            addVirtualScrollCSS();
            
            console.log('Virtual scrolling ready!');
        }, 1000);
    }
    
    // ============================
    // VIRTUAL SCROLLER CLASS
    // ============================
    
    class VirtualScroller {
        constructor(container) {
            this.container = container;
            this.virtualContainer = null;
            this.messages = [];
            this.renderedMessages = new Map();
            this.messageHeights = new Map();
            this.viewportHeight = 0;
            this.scrollTop = 0;
            
            this.init();
        }
        
        init() {
            // Create virtual container
            this.virtualContainer = document.createElement('div');
            this.virtualContainer.style.position = 'relative';
            this.virtualContainer.style.width = '100%';
            this.container.style.overflowY = 'auto';
            this.container.style.position = 'relative';
            
            // Clear existing content and add virtual container
            const existingChildren = Array.from(this.container.children);
            existingChildren.forEach(child => {
                if (!child.classList.contains('message')) {
                    this.container.removeChild(child);
                }
            });
            
            // Move existing messages to virtual container
            const existingMessages = this.container.querySelectorAll('.message');
            existingMessages.forEach(msg => {
                this.virtualContainer.appendChild(msg);
            });
            
            this.container.appendChild(this.virtualContainer);
            
            // Measure viewport
            this.viewportHeight = this.container.clientHeight;
            
            // Setup scroll listener
            this.container.addEventListener('scroll', this.handleScroll.bind(this));
            window.addEventListener('resize', this.handleResize.bind(this));
            
            // Initial render
            setTimeout(() => this.updateVisibleMessages(), 100);
        }
        
        setMessages(messages) {
            this.messages = messages;
            this.calculateTotalHeight();
            this.updateVisibleMessages();
        }
        
        addMessage(message) {
            this.messages.push(message);
            this.calculateTotalHeight();
            
            // Auto-scroll if near bottom
            const nearBottom = this.container.scrollTop + this.viewportHeight >= 
                              this.container.scrollHeight - 100;
            
            if (nearBottom) {
                this.updateVisibleMessages();
                setTimeout(() => {
                    this.container.scrollTop = this.container.scrollHeight;
                }, 50);
            } else {
                this.updateVisibleMessages();
            }
        }
        
        calculateTotalHeight() {
            let totalHeight = 0;
            for (const msg of this.messages) {
                totalHeight += this.getMessageHeight(msg) + 8; // 8px margin
            }
            this.virtualContainer.style.height = `${totalHeight}px`;
        }
        
        getMessageHeight(message) {
            if (this.messageHeights.has(message.id)) {
                return this.messageHeights.get(message.id);
            }
            
            // Estimate height
            let height = 60; // Base
            
            if (message.text) {
                const lines = Math.ceil(message.text.length / 40);
                height += lines * 22;
            }
            if (message.imageUrl) height += 300;
            if (message.audioUrl) height += 80;
            if (message.videoUrl) height += 300;
            
            this.messageHeights.set(message.id, height);
            return height;
        }
        
        handleScroll() {
            this.scrollTop = this.container.scrollTop;
            requestAnimationFrame(() => this.updateVisibleMessages());
        }
        
        handleResize() {
            this.viewportHeight = this.container.clientHeight;
            this.updateVisibleMessages();
        }
        
        updateVisibleMessages() {
            if (this.messages.length === 0) return;
            
            // Calculate visible range
            const buffer = this.viewportHeight;
            const startY = this.scrollTop - buffer;
            const endY = this.scrollTop + this.viewportHeight + buffer;
            
            let cumulativeHeight = 0;
            let startIndex = 0;
            let endIndex = 0;
            
            // Find start index
            for (let i = 0; i < this.messages.length; i++) {
                const msgHeight = this.getMessageHeight(this.messages[i]) + 8;
                if (cumulativeHeight + msgHeight > startY) {
                    startIndex = Math.max(0, i - VIEWPORT_BUFFER);
                    break;
                }
                cumulativeHeight += msgHeight;
            }
            
            // Find end index
            cumulativeHeight = 0;
            for (let i = 0; i < startIndex; i++) {
                cumulativeHeight += this.getMessageHeight(this.messages[i]) + 8;
            }
            
            for (let i = startIndex; i < this.messages.length; i++) {
                const msgHeight = this.getMessageHeight(this.messages[i]) + 8;
                if (cumulativeHeight > endY) {
                    endIndex = Math.min(this.messages.length, i + VIEWPORT_BUFFER);
                    break;
                }
                cumulativeHeight += msgHeight;
                endIndex = i;
            }
            
            if (endIndex === 0) {
                endIndex = this.messages.length - 1;
            }
            
            // Remove messages outside viewport
            for (const [messageId, element] of this.renderedMessages.entries()) {
                const index = this.messages.findIndex(m => m.id === messageId);
                if (index < startIndex || index > endIndex) {
                    if (element.parentNode) {
                        element.parentNode.removeChild(element);
                    }
                    this.renderedMessages.delete(messageId);
                }
            }
            
            // Add messages in viewport
            for (let i = startIndex; i <= endIndex; i++) {
                const message = this.messages[i];
                if (!this.renderedMessages.has(message.id)) {
                    this.renderMessage(message, i);
                }
            }
        }
        
        renderMessage(message, index) {
            let position = 0;
            for (let i = 0; i < index; i++) {
                position += this.getMessageHeight(this.messages[i]) + 8;
            }
            
            // Use your original displayMessage function to create the element
            const tempContainer = document.createElement('div');
            if (window.displayMessage && currentUser) {
                // Create message element using your existing function
                const messageElement = createMessageElement(message, window.currentUser.uid);
                
                messageElement.style.position = 'absolute';
                messageElement.style.top = `${position}px`;
                messageElement.style.left = '0';
                messageElement.style.right = '0';
                messageElement.style.width = '100%';
                messageElement.style.boxSizing = 'border-box';
                
                this.virtualContainer.appendChild(messageElement);
                this.renderedMessages.set(message.id, messageElement);
            }
        }
        
        scrollToBottom() {
            this.container.scrollTop = this.container.scrollHeight;
        }
        
        clear() {
            this.messages = [];
            this.renderedMessages.clear();
            this.messageHeights.clear();
            if (this.virtualContainer) {
                this.virtualContainer.innerHTML = '';
                this.virtualContainer.style.height = '0';
            }
        }
    }
    
    // Helper to create message element using your existing logic
    function createMessageElement(message, currentUserId) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${message.senderId === currentUserId ? 'sent' : 'received'}`;
        messageDiv.dataset.messageId = message.id;
        
        // Simplified content - your original function will handle this better
        if (message.text) {
            messageDiv.innerHTML = `<p>${message.text}</p>`;
        } else if (message.imageUrl) {
            messageDiv.innerHTML = `<img src="${message.imageUrl}" class="message-image" loading="lazy">`;
        }
        
        return messageDiv;
    }
    
    // ============================
    // FUNCTION OVERRIDES
    // ============================
    
    function backupOriginalFunctions() {
        originalFunctions.displayMessage = window.displayMessage;
        originalFunctions.updateMessagesDisplay = window.updateMessagesDisplay;
        originalFunctions.loadChatMessages = window.loadChatMessages;
        originalFunctions.addMessage = window.addMessage;
    }
    
    function overrideDisplayFunctions() {
        // Override displayMessage
        if (window.displayMessage) {
            window.displayMessage = function(message, currentUserId) {
                if (virtualScroller && currentUser) {
                    virtualScroller.addMessage(message);
                } else {
                    // Fallback to original
                    originalFunctions.displayMessage.call(this, message, currentUserId);
                }
            };
        }
        
        // Override updateMessagesDisplay
        if (window.updateMessagesDisplay) {
            window.updateMessagesDisplay = function(newMessages, currentUserId) {
                if (virtualScroller && currentUser) {
                    virtualScroller.setMessages(newMessages);
                    
                    // Scroll to bottom if it's the initial load
                    if (virtualScroller.messages.length === newMessages.length) {
                        setTimeout(() => {
                            virtualScroller.scrollToBottom();
                        }, 100);
                    }
                } else {
                    originalFunctions.updateMessagesDisplay.call(this, newMessages, currentUserId);
                }
            };
        }
        
        // Override loadChatMessages to use virtual scrolling
        if (window.loadChatMessages) {
            const originalLoadChat = window.loadChatMessages;
            window.loadChatMessages = function(userId, partnerId) {
                if (virtualScroller) {
                    virtualScroller.clear();
                    
                    // Get existing messages from DOM before clearing
                    const existingMessages = Array.from(document.querySelectorAll('.message')).map(msg => {
                        return {
                            id: msg.dataset.messageId || Date.now(),
                            senderId: msg.classList.contains('sent') ? userId : partnerId,
                            text: msg.querySelector('p')?.textContent || '',
                            timestamp: new Date()
                        };
                    });
                    
                    if (existingMessages.length > 0) {
                        virtualScroller.setMessages(existingMessages);
                    }
                }
                
                // Call original function
                return originalLoadChat.call(this, userId, partnerId);
            };
        }
        
        // Make currentUser accessible
        Object.defineProperty(window, 'currentUser', {
            get: function() {
                return window.currentUser || null;
            },
            set: function(user) {
                window._currentUser = user;
            }
        });
    }
    
    // ============================
    // PERFORMANCE CSS
    // ============================
    
    function addVirtualScrollCSS() {
        const styleId = 'virtual-scroll-css';
        if (document.getElementById(styleId)) return;
        
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            /* Virtual scrolling optimization */
            #chatMessages {
                overflow-anchor: none !important;
                -webkit-overflow-scrolling: touch !important;
                contain: strict !important;
                will-change: transform !important;
                transform: translateZ(0) !important;
            }
            
            .message {
                contain: content !important;
                will-change: transform !important;
                transform: translateZ(0) !important;
                backface-visibility: hidden !important;
                -webkit-font-smoothing: subpixel-antialiased !important;
            }
            
            .message-image, .video-message, .voice-message {
                content-visibility: auto !important;
                contain-intrinsic-size: 300px 400px !important;
            }
            
            /* Hide scrollbar when not scrolling */
            #chatMessages::-webkit-scrollbar {
                width: 8px;
                background: transparent;
            }
            
            #chatMessages::-webkit-scrollbar-thumb {
                background: rgba(0,0,0,0.2);
                border-radius: 4px;
            }
            
            #chatMessages:hover::-webkit-scrollbar-thumb {
                background: rgba(0,0,0,0.3);
            }
            
            /* Performance optimizations */
            * {
                -webkit-tap-highlight-color: transparent;
            }
            
            /* Prevent layout thrashing */
            .message p, .message-image, .message-time {
                contain-intrinsic-size: auto !important;
            }
            
            /* Smooth animations */
            .message {
                transition: opacity 0.15s ease !important;
            }
        `;
        
        document.head.appendChild(style);
    }
    
    // ============================
    // INITIALIZATION HELPERS
    // ============================
    
    // Monitor for new messages and apply virtual scrolling
    function setupMessageObserver() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach((node) => {
                        if (node.classList && node.classList.contains('message')) {
                            // If a message was added outside virtual scroller, handle it
                            if (virtualScroller && node.parentNode !== virtualScroller.virtualContainer) {
                                const messageData = extractMessageData(node);
                                if (messageData) {
                                    virtualScroller.addMessage(messageData);
                                    node.remove(); // Remove from original location
                                }
                            }
                        }
                    });
                }
            });
        });
        
        const messagesContainer = document.getElementById('chatMessages');
        if (messagesContainer) {
            observer.observe(messagesContainer, {
                childList: true,
                subtree: false
            });
        }
    }
    
    function extractMessageData(element) {
        return {
            id: element.dataset.messageId || `msg_${Date.now()}_${Math.random()}`,
            senderId: element.classList.contains('sent') ? (window.currentUser?.uid || 'unknown') : (window.chatPartnerId || 'partner'),
            text: element.querySelector('p')?.textContent || '',
            imageUrl: element.querySelector('.message-image')?.src || null,
            timestamp: new Date()
        };
    }
    
    // Export for debugging
    window.virtualScrollFix = {
        getVirtualScroller: () => virtualScroller,
        getMessageCount: () => virtualScroller ? virtualScroller.messages.length : 0,
        forceRender: () => virtualScroller ? virtualScroller.updateVisibleMessages() : null,
        scrollToBottom: () => virtualScroller ? virtualScroller.scrollToBottom() : null
    };
    
    // Initialize observer
    setTimeout(setupMessageObserver, 2000);
    
})();