// smooth.js - Independent scroll fix that won't break your layout

(function() {
    'use strict';
    
    console.log('Loading smooth.js scroll fix...');
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initScrollFix);
    } else {
        initScrollFix();
    }
    
    function initScrollFix() {
        // Check which page we're on
        const isChatPage = window.location.pathname.includes('chat.html') || 
                          document.getElementById('chatMessages');
        const isMessagesPage = window.location.pathname.includes('messages.html') || 
                              document.getElementById('messagesList');
        
        if (isChatPage) {
            fixChatScroll();
        } else if (isMessagesPage) {
            fixMessagesScroll();
        }
        
        // Apply general scroll improvements
        applyGeneralScrollFixes();
    }
    
    function fixChatScroll() {
        const chatContainer = document.getElementById('chatMessages');
        if (!chatContainer) {
            console.log('Chat container not found, retrying in 500ms...');
            setTimeout(fixChatScroll, 500);
            return;
        }
        
        console.log('Fixing chat scroll...');
        
        // 1. Fix container styles
        chatContainer.style.cssText += `
            -webkit-overflow-scrolling: touch;
            overflow-anchor: none;
            transform: translateZ(0);
            -webkit-transform: translateZ(0);
            backface-visibility: hidden;
            -webkit-backface-visibility: hidden;
        `;
        
        // 2. Store original functions before overriding
        if (typeof window.displayMessage === 'function') {
            window.originalDisplayMessage = window.displayMessage;
            
            // Override displayMessage to add performance optimizations
            window.displayMessage = function(message, currentUserId) {
                // Call original function
                const messageElement = window.originalDisplayMessage.call(this, message, currentUserId);
                
                if (messageElement) {
                    // Add performance optimizations to the message element
                    messageElement.style.transform = 'translateZ(0)';
                    messageElement.style.backfaceVisibility = 'hidden';
                    messageElement.style.willChange = 'transform';
                }
                
                return messageElement;
            };
        }
        
        if (typeof window.updateMessagesDisplay === 'function') {
            window.originalUpdateMessagesDisplay = window.updateMessagesDisplay;
            
            // Override updateMessagesDisplay for better performance
            window.updateMessagesDisplay = function(newMessages, currentUserId) {
                // Use requestAnimationFrame for smooth updates
                requestAnimationFrame(() => {
                    window.originalUpdateMessagesDisplay.call(this, newMessages, currentUserId);
                    
                    // Auto-scroll to bottom after a short delay
                    setTimeout(() => {
                        if (chatContainer.scrollHeight > chatContainer.clientHeight) {
                            chatContainer.scrollTop = chatContainer.scrollHeight;
                        }
                    }, 100);
                });
            };
        }
        
        // 3. Fix disappearing messages during scroll
        let isScrolling = false;
        let scrollTimeout;
        
        chatContainer.addEventListener('scroll', () => {
            isScrolling = true;
            
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                isScrolling = false;
            }, 150);
            
            // Force browser to keep messages rendered
            requestAnimationFrame(() => {
                const messages = chatContainer.querySelectorAll('.message');
                messages.forEach(msg => {
                    msg.style.contain = 'layout style';
                });
            });
        }, { passive: true });
        
        // 4. Fix for fast scrolling causing blank areas
        let lastKnownScrollPosition = 0;
        let ticking = false;
        
        chatContainer.addEventListener('scroll', () => {
            lastKnownScrollPosition = chatContainer.scrollTop;
            
            if (!ticking) {
                requestAnimationFrame(() => {
                    // Ensure messages stay visible during scroll
                    const messages = chatContainer.querySelectorAll('.message');
                    messages.forEach(msg => {
                        const rect = msg.getBoundingClientRect();
                        if (rect.top >= -100 && rect.bottom <= window.innerHeight + 100) {
                            msg.style.opacity = '1';
                        }
                    });
                    
                    ticking = false;
                });
                ticking = true;
            }
        }, { passive: true });
        
        // 5. Add scrollbar styling
        const style = document.createElement('style');
        style.textContent = `
            #chatMessages {
                scrollbar-width: thin;
                scrollbar-color: #888 transparent;
            }
            
            #chatMessages::-webkit-scrollbar {
                width: 6px;
            }
            
            #chatMessages::-webkit-scrollbar-track {
                background: transparent;
            }
            
            #chatMessages::-webkit-scrollbar-thumb {
                background: #888;
                border-radius: 3px;
            }
            
            #chatMessages::-webkit-scrollbar-thumb:hover {
                background: #555;
            }
            
            /* Prevent message flickering */
            .message {
                transform: translateZ(0);
                backface-visibility: hidden;
                -webkit-backface-visibility: hidden;
            }
        `;
        document.head.appendChild(style);
        
        console.log('Chat scroll fix applied successfully');
    }
    
    function fixMessagesScroll() {
        const messagesContainer = document.getElementById('messagesList');
        if (!messagesContainer) {
            console.log('Messages container not found, retrying in 500ms...');
            setTimeout(fixMessagesScroll, 500);
            return;
        }
        
        console.log('Fixing messages scroll...');
        
        // Apply similar fixes to messages page
        messagesContainer.style.cssText += `
            -webkit-overflow-scrolling: touch;
            overflow-anchor: none;
            transform: translateZ(0);
            -webkit-transform: translateZ(0);
        `;
        
        // Fix for messages page specific functions
        if (typeof window.renderMessageThreads === 'function') {
            window.originalRenderMessageThreads = window.renderMessageThreads;
            
            window.renderMessageThreads = function(threads) {
                requestAnimationFrame(() => {
                    window.originalRenderMessageThreads.call(this, threads);
                });
            };
        }
        
        // Add scrollbar styling
        const style = document.createElement('style');
        style.textContent = `
            #messagesList {
                scrollbar-width: thin;
                scrollbar-color: #888 transparent;
            }
            
            #messagesList::-webkit-scrollbar {
                width: 6px;
            }
            
            #messagesList::-webkit-scrollbar-track {
                background: transparent;
            }
            
            #messagesList::-webkit-scrollbar-thumb {
                background: #888;
                border-radius: 3px;
            }
            
            .message-card {
                transform: translateZ(0);
                backface-visibility: hidden;
            }
        `;
        document.head.appendChild(style);
        
        console.log('Messages scroll fix applied successfully');
    }
    
    function applyGeneralScrollFixes() {
        // Add global scroll performance improvements
        const style = document.createElement('style');
        style.textContent = `
            /* Improve scrolling performance globally */
            [id*="message"], [class*="message"] {
                transform: translateZ(0);
                -webkit-transform: translateZ(0);
                backface-visibility: hidden;
                -webkit-backface-visibility: hidden;
                will-change: transform;
            }
            
            /* Prevent momentum scrolling issues on iOS */
            .scroll-container {
                -webkit-overflow-scrolling: touch;
            }
            
            /* Ensure images don't cause repaints */
            .message img, .message-card img {
                transform: translateZ(0);
                image-rendering: -webkit-optimize-contrast;
            }
        `;
        document.head.appendChild(style);
        
        // Fix for mobile touch devices
        if ('ontouchstart' in window) {
            document.body.style.cssText += `
                -webkit-tap-highlight-color: transparent;
                -webkit-touch-callout: none;
            `;
        }
    }
    
    // Export functions if needed
    window.smoothScrollFix = {
        reapply: function() {
            if (document.getElementById('chatMessages')) {
                fixChatScroll();
            }
            if (document.getElementById('messagesList')) {
                fixMessagesScroll();
            }
        },
        cleanup: function() {
            // Restore original functions
            if (window.originalDisplayMessage) {
                window.displayMessage = window.originalDisplayMessage;
            }
            if (window.originalUpdateMessagesDisplay) {
                window.updateMessagesDisplay = window.originalUpdateMessagesDisplay;
            }
            if (window.originalRenderMessageThreads) {
                window.renderMessageThreads = window.originalRenderMessageThreads;
            }
        }
    };
    
    console.log('smooth.js loaded successfully');
})();