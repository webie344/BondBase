// chatting.js - SCROLLING FIX ONLY
// Add this file to your chat.html AFTER app.js to fix scrolling issues

(function() {
    'use strict';
    
    console.log('Chat scrolling fix loaded...');
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initScrollingFix);
    } else {
        initScrollingFix();
    }
    
    function initScrollingFix() {
        // Wait a bit for app.js to load chat messages
        setTimeout(setupSmoothScrolling, 1000);
    }
    
    function setupSmoothScrolling() {
        const messagesContainer = document.getElementById('chatMessages');
        if (!messagesContainer) {
            console.error('Chat messages container not found');
            return;
        }
        
        console.log('Setting up smooth scrolling for chat...');
        
        // Store original displayMessage function if it exists
        const originalDisplayMessage = window.displayMessage || function() {};
        
        // Override displayMessage to handle scrolling
        window.displayMessage = function(message, currentUserId) {
            // Call original function
            originalDisplayMessage(message, currentUserId);
            
            // Handle scrolling after message is added
            setTimeout(() => {
                smoothScrollToBottom(messagesContainer);
            }, 50);
        };
        
        // Fix for your updateMessagesDisplay function
        const originalUpdateMessagesDisplay = window.updateMessagesDisplay || function() {};
        
        window.updateMessagesDisplay = function(newMessages, currentUserId) {
            // Call original function
            originalUpdateMessagesDisplay(newMessages, currentUserId);
            
            // Handle scrolling
            setTimeout(() => {
                smoothScrollToBottom(messagesContainer);
            }, 100);
        };
        
        // Setup scroll position restoration
        setupScrollRestoration(messagesContainer);
        
        // Add CSS for better scrolling performance
        addSmoothScrollCSS();
        
        // Add scroll event listener for better UX
        setupScrollEvents(messagesContainer);
        
        console.log('Smooth scrolling setup complete');
    }
    
    function smoothScrollToBottom(container) {
        if (!container || container.children.length === 0) return;
        
        const isNearBottom = isUserNearBottom(container);
        
        if (isNearBottom) {
            // Use smooth scroll for better UX
            container.scrollTo({
                top: container.scrollHeight,
                behavior: 'smooth'
            });
        }
    }
    
    function isUserNearBottom(container) {
        const threshold = 100; // pixels from bottom
        const currentScroll = container.scrollTop;
        const maxScroll = container.scrollHeight - container.clientHeight;
        
        return (maxScroll - currentScroll) <= threshold;
    }
    
    function setupScrollRestoration(container) {
        let isUserScrolling = false;
        let scrollPosition = 0;
        
        container.addEventListener('scroll', () => {
            isUserScrolling = true;
            scrollPosition = container.scrollTop;
            
            // Clear previous timeout
            if (container.scrollTimeout) {
                clearTimeout(container.scrollTimeout);
            }
            
            // Set timeout to reset scrolling flag
            container.scrollTimeout = setTimeout(() => {
                isUserScrolling = false;
            }, 150);
        });
        
        // Override the loadChatMessages function to preserve scroll position
        const originalLoadChatMessages = window.loadChatMessages;
        if (originalLoadChatMessages) {
            window.loadChatMessages = function(userId, partnerId) {
                // Store current scroll position
                const currentScroll = container.scrollTop;
                const atBottom = isUserNearBottom(container);
                
                // Call original function
                const result = originalLoadChatMessages(userId, partnerId);
                
                // Restore scroll position if user wasn't at bottom
                if (!atBottom && !isUserScrolling) {
                    setTimeout(() => {
                        container.scrollTop = currentScroll;
                    }, 200);
                }
                
                return result;
            };
        }
    }
    
    function setupScrollEvents(container) {
        // Add a scroll indicator when user scrolls up
        let lastScrollTop = 0;
        
        container.addEventListener('scroll', () => {
            const scrollTop = container.scrollTop;
            
            if (scrollTop < lastScrollTop) {
                // User is scrolling up
                container.classList.add('scrolling-up');
            } else {
                // User is scrolling down
                container.classList.remove('scrolling-up');
            }
            
            lastScrollTop = scrollTop;
        });
        
        // Auto-hide scrollbars when not scrolling
        container.addEventListener('mouseenter', () => {
            container.style.overflowY = 'auto';
        });
        
        container.addEventListener('mouseleave', () => {
            // Only hide if at bottom
            if (isUserNearBottom(container)) {
                setTimeout(() => {
                    container.style.overflowY = 'hidden';
                }, 1000);
            }
        });
    }
    
    function addSmoothScrollCSS() {
        const styleId = 'chat-scroll-fix-css';
        
        // Don't add if already added
        if (document.getElementById(styleId)) return;
        
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            /* Improved scrolling performance */
            #chatMessages {
                scroll-behavior: smooth;
                -webkit-overflow-scrolling: touch;
                overflow-anchor: none;
                will-change: transform;
                transform: translateZ(0);
                backface-visibility: hidden;
                perspective: 1000px;
            }
            
            /* Optimize message rendering */
            .message {
                contain: content;
                will-change: transform;
                transform: translateZ(0);
            }
            
            /* Better scrollbar */
            #chatMessages::-webkit-scrollbar {
                width: 6px;
            }
            
            #chatMessages::-webkit-scrollbar-track {
                background: rgba(0, 0, 0, 0.1);
                border-radius: 10px;
            }
            
            #chatMessages::-webkit-scrollbar-thumb {
                background: rgba(0, 0, 0, 0.2);
                border-radius: 10px;
            }
            
            #chatMessages::-webkit-scrollbar-thumb:hover {
                background: rgba(0, 0, 0, 0.3);
            }
            
            /* Prevent flash of unstyled content */
            .message-image {
                content-visibility: auto;
                contain-intrinsic-size: 300px 400px;
            }
            
            .video-message {
                content-visibility: auto;
                contain-intrinsic-size: 280px 400px;
            }
            
            /* Loading states */
            .message.sending {
                opacity: 0.7;
                transition: opacity 0.3s ease;
            }
            
            /* Scroll indicator */
            #chatMessages.scrolling-up::after {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 3px;
                background: linear-gradient(to bottom, rgba(0,0,0,0.1), transparent);
                pointer-events: none;
                z-index: 10;
            }
        `;
        
        document.head.appendChild(style);
    }
    
    // Also fix the loadChatMessages function from your app.js
    function enhanceLoadChatMessages() {
        const originalFunction = window.loadChatMessages;
        
        if (originalFunction && typeof originalFunction === 'function') {
            window.loadChatMessages = function(userId, partnerId) {
                console.log('Enhanced loadChatMessages called');
                
                const messagesContainer = document.getElementById('chatMessages');
                const wasEmpty = messagesContainer.children.length === 0;
                
                // Call original function
                const result = originalFunction(userId, partnerId);
                
                // If container was empty, scroll to bottom
                if (wasEmpty) {
                    setTimeout(() => {
                        if (messagesContainer) {
                            messagesContainer.scrollTop = messagesContainer.scrollHeight;
                        }
                    }, 300);
                }
                
                return result;
            };
            
            console.log('Enhanced loadChatMessages function installed');
        }
    }
    
    // Export functions for debugging
    window.chatScrollingFix = {
        initScrollingFix,
        setupSmoothScrolling,
        smoothScrollToBottom,
        isUserNearBottom
    };
    
    // Initialize
    setTimeout(enhanceLoadChatMessages, 500);
    
})();