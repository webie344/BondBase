// fix.js - Virtual Scroll Enhancement for Chat Messages
// Load this file BEFORE app.js in your HTML

(function() {
    'use strict';

    // Virtual Scroll Manager for Chat Messages
    class VirtualScrollManager {
        constructor() {
            this.container = null;
            this.messages = [];
            this.visibleMessages = [];
            this.messageElements = new Map();
            this.scrollTop = 0;
            this.containerHeight = 0;
            this.itemHeight = 80; // Average message height
            this.bufferItems = 5; // Items to render above/below viewport
            this.placeholderHeight = 0;
            this.topSpacer = null;
            this.bottomSpacer = null;
            this.isInitialized = false;
            this.rafId = null;
            this.lastScrollTime = 0;
            this.scrollThrottle = 50; // ms
        }

        initialize(containerId) {
            if (this.isInitialized) return;
            
            this.container = document.getElementById(containerId);
            if (!this.container) {
                console.warn(`Container with ID "${containerId}" not found`);
                return;
            }

            // Create spacers for virtual scrolling
            this.topSpacer = document.createElement('div');
            this.topSpacer.className = 'virtual-scroll-spacer';
            this.topSpacer.style.height = '0px';
            
            this.bottomSpacer = document.createElement('div');
            this.bottomSpacer.className = 'virtual-scroll-spacer';
            this.bottomSpacer.style.height = '0px';

            // Insert spacers
            if (this.container.firstChild) {
                this.container.insertBefore(this.topSpacer, this.container.firstChild);
            } else {
                this.container.appendChild(this.topSpacer);
            }
            this.container.appendChild(this.bottomSpacer);

            // Add scroll listener
            this.container.addEventListener('scroll', this.handleScroll.bind(this), { passive: true });
            
            // Add resize observer
            this.resizeObserver = new ResizeObserver(() => this.calculateContainerHeight());
            this.resizeObserver.observe(this.container);
            
            this.calculateContainerHeight();
            this.isInitialized = true;
            
            console.log('Virtual scroll initialized for', containerId);
        }

        calculateContainerHeight() {
            if (!this.container) return;
            this.containerHeight = this.container.clientHeight;
            this.updateVisibleMessages();
        }

        setMessages(messagesArray) {
            this.messages = messagesArray || [];
            this.updateVisibleMessages();
            this.renderVisibleMessages();
        }

        addMessage(message) {
            if (!message) return;
            
            this.messages.push(message);
            this.updateVisibleMessages();
            this.renderVisibleMessages();
            
            // Auto-scroll to bottom if user is near bottom
            const scrollBottom = this.container.scrollHeight - this.container.scrollTop - this.containerHeight;
            if (scrollBottom < 200) { // If within 200px of bottom
                requestAnimationFrame(() => {
                    this.container.scrollTop = this.container.scrollHeight;
                });
            }
        }

        updateMessage(message) {
            if (!message || !message.id) return;
            
            const index = this.messages.findIndex(m => m.id === message.id);
            if (index !== -1) {
                this.messages[index] = message;
                
                // Update if visible
                const visibleIndex = this.visibleMessages.findIndex(m => m.id === message.id);
                if (visibleIndex !== -1) {
                    this.renderMessage(message, index);
                }
            }
        }

        removeMessage(messageId) {
            this.messages = this.messages.filter(m => m.id !== messageId);
            
            // Remove from DOM if rendered
            const element = this.messageElements.get(messageId);
            if (element && element.parentNode) {
                element.parentNode.removeChild(element);
                this.messageElements.delete(messageId);
            }
            
            this.updateVisibleMessages();
        }

        updateVisibleMessages() {
            if (!this.container || this.messages.length === 0) {
                this.visibleMessages = [];
                return;
            }

            this.scrollTop = this.container.scrollTop;
            const startIndex = Math.max(0, Math.floor(this.scrollTop / this.itemHeight) - this.bufferItems);
            const endIndex = Math.min(
                this.messages.length - 1,
                Math.floor((this.scrollTop + this.containerHeight) / this.itemHeight) + this.bufferItems
            );

            this.visibleMessages = this.messages.slice(startIndex, endIndex + 1);
            
            // Update spacers
            const topHeight = startIndex * this.itemHeight;
            const bottomHeight = Math.max(0, (this.messages.length - endIndex - 1) * this.itemHeight);
            
            this.topSpacer.style.height = `${topHeight}px`;
            this.bottomSpacer.style.height = `${bottomHeight}px`;
        }

        renderVisibleMessages() {
            if (!this.container || this.visibleMessages.length === 0) {
                return;
            }

            const startIndex = Math.max(0, Math.floor(this.scrollTop / this.itemHeight) - this.bufferItems);
            
            // Remove messages that are no longer visible
            Array.from(this.messageElements.keys()).forEach(messageId => {
                const visibleMessage = this.visibleMessages.find(m => m.id === messageId);
                if (!visibleMessage) {
                    const element = this.messageElements.get(messageId);
                    if (element && element.parentNode) {
                        element.parentNode.removeChild(element);
                    }
                    this.messageElements.delete(messageId);
                }
            });

            // Add or update visible messages
            this.visibleMessages.forEach((message, relativeIndex) => {
                const absoluteIndex = startIndex + relativeIndex;
                this.renderMessage(message, absoluteIndex);
            });
        }

        renderMessage(message, index) {
            if (!message) return;

            let element = this.messageElements.get(message.id);
            
            if (!element) {
                // Create new message element using existing displayMessage logic
                element = this.createMessageElement(message);
                if (!element) return;
                
                this.messageElements.set(message.id, element);
                
                // Insert at correct position
                const nextSibling = this.getNextVisibleSibling(index);
                if (nextSibling) {
                    this.container.insertBefore(element, nextSibling);
                } else {
                    // Insert before bottom spacer
                    this.container.insertBefore(element, this.bottomSpacer);
                }
            } else {
                // Update existing element if needed
                this.updateMessageElement(element, message);
            }
            
            // Set data attribute for positioning
            element.dataset.virtualIndex = index;
        }

        createMessageElement(message) {
            // This will be overridden by your app's displayMessage function
            // For now, create a placeholder that will be replaced
            const div = document.createElement('div');
            div.className = `message ${message.senderId === window.currentUser?.uid ? 'sent' : 'received'}`;
            div.dataset.messageId = message.id;
            div.dataset.virtualRender = 'true';
            
            // Add temporary content
            div.innerHTML = `
                <div class="message-content">
                    ${message.text || message.imageUrl ? '📷' : message.audioUrl ? '🎤' : message.videoUrl ? '🎥' : ''}
                    ${message.text || ''}
                </div>
            `;
            
            return div;
        }

        updateMessageElement(element, message) {
            // Update element if needed
            // This is a minimal implementation - your app will handle the actual updates
            if (message.status === 'sending') {
                element.style.opacity = '0.7';
            } else {
                element.style.opacity = '1';
            }
        }

        getNextVisibleSibling(index) {
            for (let i = index + 1; i < this.messages.length; i++) {
                const element = this.messageElements.get(this.messages[i]?.id);
                if (element && element.parentNode) {
                    return element;
                }
            }
            return this.bottomSpacer;
        }

        handleScroll() {
            const now = Date.now();
            if (now - this.lastScrollTime < this.scrollThrottle) {
                if (this.rafId) cancelAnimationFrame(this.rafId);
                this.rafId = requestAnimationFrame(() => this.handleScrollThrottled());
                return;
            }
            
            this.handleScrollThrottled();
            this.lastScrollTime = now;
        }

        handleScrollThrottled() {
            this.updateVisibleMessages();
            this.renderVisibleMessages();
        }

        scrollToBottom() {
            if (!this.container) return;
            
            requestAnimationFrame(() => {
                this.container.scrollTop = this.container.scrollHeight;
                this.updateVisibleMessages();
                this.renderVisibleMessages();
            });
        }

        scrollToMessage(messageId) {
            if (!this.container) return;
            
            const index = this.messages.findIndex(m => m.id === messageId);
            if (index !== -1) {
                const scrollPosition = index * this.itemHeight;
                this.container.scrollTop = scrollPosition;
                this.updateVisibleMessages();
                this.renderVisibleMessages();
            }
        }

        destroy() {
            if (this.rafId) {
                cancelAnimationFrame(this.rafId);
            }
            
            if (this.resizeObserver) {
                this.resizeObserver.disconnect();
            }
            
            if (this.container) {
                this.container.removeEventListener('scroll', this.handleScroll.bind(this));
                
                // Remove spacers
                if (this.topSpacer && this.topSpacer.parentNode) {
                    this.topSpacer.parentNode.removeChild(this.topSpacer);
                }
                if (this.bottomSpacer && this.bottomSpacer.parentNode) {
                    this.bottomSpacer.parentNode.removeChild(this.bottomSpacer);
                }
                
                // Remove all virtual message elements
                this.messageElements.forEach((element, messageId) => {
                    if (element.parentNode && element.dataset.virtualRender === 'true') {
                        element.parentNode.removeChild(element);
                    }
                });
                
                this.messageElements.clear();
            }
            
            this.isInitialized = false;
            console.log('Virtual scroll destroyed');
        }
    }

    // Create global instance
    window.virtualScrollManager = new VirtualScrollManager();

    // Override your app's displayMessage function to use virtual scrolling
    const originalDisplayMessage = window.displayMessage;
    
    if (typeof originalDisplayMessage === 'function') {
        window.displayMessage = function(message, currentUserId) {
            // Initialize virtual scroll if not already initialized
            if (!window.virtualScrollManager.isInitialized) {
                const container = document.getElementById('chatMessages');
                if (container) {
                    window.virtualScrollManager.initialize('chatMessages');
                }
            }
            
            // Add message to virtual scroll manager
            window.virtualScrollManager.addMessage({
                ...message,
                _currentUserId: currentUserId
            });
            
            // Also call original function for backward compatibility
            return originalDisplayMessage(message, currentUserId);
        };
    }

    // Override updateMessagesDisplay function
    const originalUpdateMessagesDisplay = window.updateMessagesDisplay;
    
    if (typeof originalUpdateMessagesDisplay === 'function') {
        window.updateMessagesDisplay = function(newMessages, currentUserId) {
            // Initialize virtual scroll if not already initialized
            if (!window.virtualScrollManager.isInitialized) {
                const container = document.getElementById('chatMessages');
                if (container) {
                    window.virtualScrollManager.initialize('chatMessages');
                }
            }
            
            // Set all messages in virtual scroll manager
            window.virtualScrollManager.setMessages(newMessages.map(msg => ({
                ...msg,
                _currentUserId: currentUserId
            })));
            
            // Also call original function for backward compatibility
            return originalUpdateMessagesDisplay(newMessages, currentUserId);
        };
    }

    // Override displayCachedMessages function
    const originalDisplayCachedMessages = window.displayCachedMessages;
    
    if (typeof originalDisplayCachedMessages === 'function') {
        window.displayCachedMessages = function(messages) {
            // Initialize virtual scroll if not already initialized
            if (!window.virtualScrollManager.isInitialized) {
                const container = document.getElementById('chatMessages');
                if (container) {
                    window.virtualScrollManager.initialize('chatMessages');
                }
            }
            
            // Set cached messages in virtual scroll manager
            window.virtualScrollManager.setMessages(messages.map(msg => ({
                ...msg,
                _currentUserId: window.currentUser?.uid
            })));
            
            // Also call original function for backward compatibility
            return originalDisplayCachedMessages(messages);
        };
    }

    // Add CSS for virtual scrolling
    const style = document.createElement('style');
    style.textContent = `
        .virtual-scroll-spacer {
            width: 100%;
            transition: height 0.2s ease;
        }
        
        #chatMessages {
            overflow-anchor: none; /* Prevent browser auto-scroll */
        }
        
        .message[data-virtual-render="true"] {
            animation: fadeIn 0.3s ease;
        }
        
        @keyframes fadeIn {
            from { opacity: 0.5; transform: translateY(5px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        /* Optimize rendering for virtual scroll */
        .message {
            contain: content;
            will-change: transform;
            backface-visibility: hidden;
        }
        
        /* Smooth scrolling */
        #chatMessages {
            scroll-behavior: smooth;
            -webkit-overflow-scrolling: touch;
        }
    `;
    document.head.appendChild(style);

    // Listen for page changes to clean up
    let lastPage = '';
    
    const observePageChange = () => {
        const currentPage = window.location.pathname.split('/').pop().split('.')[0];
        
        if (lastPage === 'chat' && currentPage !== 'chat') {
            // Leaving chat page, destroy virtual scroll
            window.virtualScrollManager.destroy();
        }
        
        lastPage = currentPage;
    };
    
    // Observe URL changes
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = function() {
        originalPushState.apply(this, arguments);
        setTimeout(observePageChange, 0);
    };
    
    history.replaceState = function() {
        originalReplaceState.apply(this, arguments);
        setTimeout(observePageChange, 0);
    };
    
    window.addEventListener('popstate', observePageChange);
    
    // Initial check
    setTimeout(observePageChange, 100);

    console.log('Virtual scroll fix.js loaded successfully');
})();