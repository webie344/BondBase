// fix.js - Enhanced Virtual Scroll with No Message Disappearance
// Load this file BEFORE app.js in your HTML

(function() {
    'use strict';

    // Enhanced Virtual Scroll Manager
    class EnhancedVirtualScroll {
        constructor() {
            this.container = null;
            this.allMessages = []; // All messages in memory
            this.visibleMessages = []; // Currently visible messages
            this.renderedMessages = new Map(); // DOM elements cache
            this.scrollTop = 0;
            this.containerHeight = 0;
            this.itemHeight = 85; // Slightly increased for safety
            this.bufferItems = 8; // More buffer items
            this.topSpacer = null;
            this.bottomSpacer = null;
            this.isInitialized = false;
            this.scrollRaf = null;
            this.lastRenderTime = 0;
            this.renderThrottle = 33; // ~30fps
            this.messageCache = new Map(); // Cache rendered HTML
            this.pendingUpdates = new Set();
            this.isScrollingFast = false;
            this.scrollVelocity = 0;
            this.lastScrollTop = 0;
            this.lastScrollTime = Date.now();
        }

        initialize(containerId) {
            if (this.isInitialized) {
                this.destroy();
            }
            
            this.container = document.getElementById(containerId);
            if (!this.container) {
                console.warn(`Container with ID "${containerId}" not found`);
                return false;
            }

            // Clear existing content but preserve structure
            const originalMessages = Array.from(this.container.querySelectorAll('.message'));
            originalMessages.forEach(msg => {
                if (msg.dataset.messageId) {
                    this.messageCache.set(msg.dataset.messageId, msg.outerHTML);
                }
            });
            
            // Store scroll position
            const savedScrollTop = this.container.scrollTop;
            
            // Setup container for virtual scrolling
            this.container.innerHTML = '';
            this.container.style.position = 'relative';
            
            // Create content wrapper
            this.contentWrapper = document.createElement('div');
            this.contentWrapper.className = 'virtual-scroll-content';
            this.contentWrapper.style.position = 'relative';
            this.container.appendChild(this.contentWrapper);
            
            // Create top spacer
            this.topSpacer = document.createElement('div');
            this.topSpacer.className = 'virtual-scroll-spacer top-spacer';
            this.contentWrapper.appendChild(this.topSpacer);
            
            // Create bottom spacer
            this.bottomSpacer = document.createElement('div');
            this.bottomSpacer.className = 'virtual-scroll-spacer bottom-spacer';
            this.contentWrapper.appendChild(this.bottomSpacer);
            
            // Add scroll listener with improved debouncing
            this.container.addEventListener('scroll', this.handleScroll.bind(this), { passive: true });
            
            // Add touch events for mobile
            this.container.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
            this.container.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: true });
            
            // Setup resize observer
            this.setupResizeObserver();
            
            // Calculate initial dimensions
            this.calculateDimensions();
            
            // Restore scroll position if needed
            if (savedScrollTop > 0) {
                setTimeout(() => {
                    this.container.scrollTop = savedScrollTop;
                }, 50);
            }
            
            this.isInitialized = true;
            console.log('Enhanced virtual scroll initialized for', containerId);
            return true;
        }

        setupResizeObserver() {
            if (typeof ResizeObserver !== 'undefined') {
                this.resizeObserver = new ResizeObserver((entries) => {
                    for (let entry of entries) {
                        if (entry.target === this.container) {
                            this.calculateDimensions();
                            this.scheduleRender();
                        }
                    }
                });
                this.resizeObserver.observe(this.container);
            }
        }

        calculateDimensions() {
            if (!this.container) return;
            
            this.containerHeight = this.container.clientHeight;
            this.itemHeight = this.calculateAverageItemHeight();
        }

        calculateAverageItemHeight() {
            // Calculate average height based on rendered messages
            let totalHeight = 0;
            let count = 0;
            
            this.renderedMessages.forEach((element, id) => {
                if (element && element.offsetHeight > 0) {
                    totalHeight += element.offsetHeight;
                    count++;
                }
            });
            
            // Default to 85px if no messages rendered yet
            return count > 0 ? Math.ceil(totalHeight / count) : 85;
        }

        handleScroll(event) {
            if (!this.container) return;
            
            const currentScrollTop = this.container.scrollTop;
            const currentTime = Date.now();
            const timeDiff = currentTime - this.lastScrollTime;
            
            // Calculate scroll velocity
            if (timeDiff > 0) {
                this.scrollVelocity = Math.abs(currentScrollTop - this.lastScrollTop) / timeDiff;
                this.isScrollingFast = this.scrollVelocity > 2; // pixels/ms threshold
            }
            
            this.lastScrollTop = currentScrollTop;
            this.lastScrollTime = currentTime;
            
            // Cancel any pending render
            if (this.scrollRaf) {
                cancelAnimationFrame(this.scrollRaf);
            }
            
            // Schedule render with appropriate timing
            if (this.isScrollingFast) {
                // Render less frequently during fast scrolling
                this.scrollRaf = requestAnimationFrame(() => {
                    this.updateVisibleRange();
                    // Delay full render until scrolling slows
                    if (!this.scrollRaf) {
                        this.scheduleRender(100); // Wait 100ms after fast scroll
                    }
                });
            } else {
                // Normal scrolling - render immediately
                this.scrollRaf = requestAnimationFrame(() => {
                    this.updateVisibleRange();
                    this.scheduleRender();
                });
            }
        }

        handleTouchStart() {
            this.isTouchScrolling = true;
        }

        handleTouchMove() {
            this.isTouchScrolling = true;
            this.lastTouchMove = Date.now();
            
            // Handle touch scrolling specially
            if (this.touchRaf) {
                cancelAnimationFrame(this.touchRaf);
            }
            
            this.touchRaf = requestAnimationFrame(() => {
                this.updateVisibleRange();
                this.scheduleRender(50); // Slight delay for touch
            });
        }

        updateVisibleRange() {
            if (!this.container || this.allMessages.length === 0) {
                this.visibleMessages = [];
                return;
            }
            
            this.scrollTop = this.container.scrollTop;
            
            // Dynamic buffer based on scroll speed
            const dynamicBuffer = this.isScrollingFast ? 15 : 8;
            
            const startIndex = Math.max(0, Math.floor(this.scrollTop / this.itemHeight) - dynamicBuffer);
            const endIndex = Math.min(
                this.allMessages.length - 1,
                Math.floor((this.scrollTop + this.containerHeight) / this.itemHeight) + dynamicBuffer
            );
            
            this.visibleMessages = this.allMessages.slice(startIndex, endIndex + 1);
            
            // Update spacers
            const topHeight = startIndex * this.itemHeight;
            const bottomHeight = Math.max(0, (this.allMessages.length - endIndex - 1) * this.itemHeight);
            
            this.topSpacer.style.height = `${topHeight}px`;
            this.bottomSpacer.style.height = `${bottomHeight}px`;
        }

        scheduleRender(delay = 0) {
            if (this.renderTimeout) {
                clearTimeout(this.renderTimeout);
            }
            
            if (delay > 0) {
                this.renderTimeout = setTimeout(() => {
                    this.renderVisibleMessages();
                }, delay);
            } else {
                const now = Date.now();
                if (now - this.lastRenderTime >= this.renderThrottle) {
                    this.renderVisibleMessages();
                    this.lastRenderTime = now;
                } else {
                    this.renderTimeout = setTimeout(() => {
                        this.renderVisibleMessages();
                    }, this.renderThrottle - (now - this.lastRenderTime));
                }
            }
        }

        renderVisibleMessages() {
            if (!this.container || !this.contentWrapper || this.allMessages.length === 0) {
                return;
            }
            
            const startIndex = Math.max(0, Math.floor(this.scrollTop / this.itemHeight) - this.bufferItems);
            
            // Keep track of which messages should be visible
            const visibleIds = new Set(this.visibleMessages.map(m => m.id));
            
            // Remove messages that are no longer visible (but keep in cache)
            this.renderedMessages.forEach((element, messageId) => {
                if (!visibleIds.has(messageId) && element && element.parentNode) {
                    // Instead of removing, hide it
                    element.style.display = 'none';
                    element.dataset.virtualState = 'hidden';
                }
            });
            
            // Add or show visible messages
            this.visibleMessages.forEach((message, relativeIndex) => {
                const absoluteIndex = startIndex + relativeIndex;
                this.ensureMessageRendered(message, absoluteIndex);
            });
            
            // Clean up excessively hidden messages (keep last 50)
            this.cleanupHiddenMessages();
        }

        ensureMessageRendered(message, index) {
            if (!message || !message.id) return;
            
            let element = this.renderedMessages.get(message.id);
            
            if (!element) {
                // Try to get from cache first
                const cachedHTML = this.messageCache.get(message.id);
                if (cachedHTML) {
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = cachedHTML;
                    element = tempDiv.firstChild;
                } else {
                    // Create new element using app's display logic
                    element = this.createMessageElement(message);
                    if (!element) return;
                    
                    // Cache the HTML for future use
                    this.messageCache.set(message.id, element.outerHTML);
                }
                
                element.dataset.virtualIndex = index;
                element.dataset.messageId = message.id;
                this.renderedMessages.set(message.id, element);
                
                // Insert at correct position
                this.insertMessageAtPosition(element, index);
            } else {
                // Element exists, make sure it's visible and at right position
                element.style.display = '';
                element.dataset.virtualState = 'visible';
                
                // Update position if needed
                const currentIndex = parseInt(element.dataset.virtualIndex) || 0;
                if (currentIndex !== index) {
                    element.dataset.virtualIndex = index;
                    this.insertMessageAtPosition(element, index);
                }
                
                // Update content if message changed
                if (this.pendingUpdates.has(message.id)) {
                    this.updateMessageElement(element, message);
                    this.pendingUpdates.delete(message.id);
                }
            }
        }

        createMessageElement(message) {
            // Use a placeholder that will be replaced by your app's displayMessage
            const div = document.createElement('div');
            div.className = `message ${message.senderId === window.currentUser?.uid ? 'sent' : 'received'}`;
            div.dataset.messageId = message.id;
            div.dataset.virtualRender = 'true';
            div.dataset.needsUpdate = 'true';
            
            // Minimal placeholder content
            div.innerHTML = `
                <div class="message-loading">
                    <div class="message-skeleton"></div>
                </div>
            `;
            
            // Trigger your app's displayMessage to fill this element
            this.queueMessageForUpdate(message);
            
            return div;
        }

        queueMessageForUpdate(message) {
            this.pendingUpdates.add(message.id);
            
            // Use requestIdleCallback if available
            if ('requestIdleCallback' in window) {
                requestIdleCallback(() => {
                    this.updateMessageWithAppLogic(message);
                }, { timeout: 100 });
            } else {
                setTimeout(() => {
                    this.updateMessageWithAppLogic(message);
                }, 50);
            }
        }

        updateMessageWithAppLogic(message) {
            const element = this.renderedMessages.get(message.id);
            if (!element) return;
            
            // Store reference to your original function
            const originalDisplayMessage = window.displayMessage;
            if (typeof originalDisplayMessage === 'function') {
                try {
                    // Temporarily replace container to capture output
                    const originalContainer = document.getElementById('chatMessages');
                    const tempContainer = document.createElement('div');
                    tempContainer.style.display = 'none';
                    document.body.appendChild(tempContainer);
                    
                    // Set temp container as target
                    const originalGetElementById = document.getElementById;
                    document.getElementById = function(id) {
                        if (id === 'chatMessages') return tempContainer;
                        return originalGetElementById.call(document, id);
                    };
                    
                    // Call your display function
                    originalDisplayMessage.call(window, message, message._currentUserId || window.currentUser?.uid);
                    
                    // Restore original function
                    document.getElementById = originalGetElementById;
                    
                    // Get the rendered message
                    const renderedMessage = tempContainer.querySelector(`[data-message-id="${message.id}"]`);
                    if (renderedMessage) {
                        // Update our element with the properly rendered content
                        element.innerHTML = renderedMessage.innerHTML;
                        element.className = renderedMessage.className;
                        element.dataset.needsUpdate = 'false';
                        
                        // Update cache
                        this.messageCache.set(message.id, element.outerHTML);
                    }
                    
                    // Clean up
                    document.body.removeChild(tempContainer);
                } catch (error) {
                    console.warn('Could not update message with app logic:', error);
                }
            }
        }

        updateMessageElement(element, message) {
            // Update element properties if needed
            if (message.status === 'sending') {
                element.style.opacity = '0.7';
            } else {
                element.style.opacity = '1';
            }
            
            // Mark as needing app update
            if (element.dataset.needsUpdate === 'true') {
                this.queueMessageForUpdate(message);
            }
        }

        insertMessageAtPosition(element, index) {
            if (!element || !this.contentWrapper) return;
            
            // Find the correct position to insert
            const messagesArray = Array.from(this.contentWrapper.children)
                .filter(child => child.classList.contains('message'))
                .sort((a, b) => {
                    const aIndex = parseInt(a.dataset.virtualIndex) || 0;
                    const bIndex = parseInt(b.dataset.virtualIndex) || 0;
                    return aIndex - bIndex;
                });
            
            // Find insertion point
            let insertBeforeElement = null;
            for (let i = 0; i < messagesArray.length; i++) {
                const msgIndex = parseInt(messagesArray[i].dataset.virtualIndex) || 0;
                if (msgIndex > index) {
                    insertBeforeElement = messagesArray[i];
                    break;
                }
            }
            
            // Insert the element
            if (insertBeforeElement) {
                if (element.parentNode !== this.contentWrapper) {
                    this.contentWrapper.insertBefore(element, insertBeforeElement);
                } else if (element.nextSibling !== insertBeforeElement) {
                    this.contentWrapper.insertBefore(element, insertBeforeElement);
                }
            } else {
                // Insert before bottom spacer
                if (element.parentNode !== this.contentWrapper) {
                    this.contentWrapper.insertBefore(element, this.bottomSpacer);
                } else if (element.nextSibling !== this.bottomSpacer) {
                    this.contentWrapper.insertBefore(element, this.bottomSpacer);
                }
            }
        }

        cleanupHiddenMessages() {
            // Only keep reasonable number of hidden elements
            const hiddenElements = Array.from(this.renderedMessages.values())
                .filter(el => el && el.dataset.virtualState === 'hidden');
            
            if (hiddenElements.length > 50) {
                // Remove oldest hidden elements beyond limit
                const toRemove = hiddenElements.slice(0, hiddenElements.length - 50);
                toRemove.forEach(element => {
                    if (element && element.parentNode) {
                        element.parentNode.removeChild(element);
                    }
                    this.renderedMessages.delete(element.dataset.messageId);
                });
            }
        }

        // Public API methods
        setMessages(messagesArray) {
            if (!Array.isArray(messagesArray)) return;
            
            this.allMessages = messagesArray.map((msg, index) => ({
                ...msg,
                _index: index,
                _currentUserId: window.currentUser?.uid
            }));
            
            // Preserve existing rendered messages
            const existingIds = new Set(this.allMessages.map(m => m.id));
            
            // Remove messages that no longer exist
            this.renderedMessages.forEach((element, id) => {
                if (!existingIds.has(id) && element && element.parentNode) {
                    element.parentNode.removeChild(element);
                    this.renderedMessages.delete(id);
                    this.messageCache.delete(id);
                }
            });
            
            this.updateVisibleRange();
            this.scheduleRender();
        }

        addMessage(message) {
            if (!message || !message.id) return;
            
            // Add to collection
            const existingIndex = this.allMessages.findIndex(m => m.id === message.id);
            if (existingIndex >= 0) {
                this.allMessages[existingIndex] = {
                    ...message,
                    _index: existingIndex,
                    _currentUserId: window.currentUser?.uid
                };
            } else {
                this.allMessages.push({
                    ...message,
                    _index: this.allMessages.length,
                    _currentUserId: window.currentUser?.uid
                });
            }
            
            // Check if should auto-scroll
            const shouldAutoScroll = this.shouldAutoScrollToBottom();
            
            this.updateVisibleRange();
            this.scheduleRender();
            
            // Auto-scroll if near bottom
            if (shouldAutoScroll) {
                this.scrollToBottom();
            }
        }

        shouldAutoScrollToBottom() {
            if (!this.container) return false;
            
            const scrollBottom = this.container.scrollHeight - this.container.scrollTop - this.containerHeight;
            return scrollBottom < 300; // Within 300px of bottom
        }

        scrollToBottom() {
            if (!this.container) return;
            
            requestAnimationFrame(() => {
                this.container.scrollTop = this.container.scrollHeight;
                this.updateVisibleRange();
                this.scheduleRender();
            });
        }

        scrollToMessage(messageId) {
            const message = this.allMessages.find(m => m.id === messageId);
            if (!message || !this.container) return;
            
            const index = message._index || 0;
            const scrollPosition = Math.max(0, index * this.itemHeight - this.containerHeight / 2);
            
            this.container.scrollTo({
                top: scrollPosition,
                behavior: 'smooth'
            });
            
            // Highlight the message briefly
            const element = this.renderedMessages.get(messageId);
            if (element) {
                element.classList.add('highlight-message');
                setTimeout(() => {
                    element.classList.remove('highlight-message');
                }, 2000);
            }
        }

        destroy() {
            // Cancel all pending operations
            if (this.scrollRaf) cancelAnimationFrame(this.scrollRaf);
            if (this.touchRaf) cancelAnimationFrame(this.touchRaf);
            if (this.renderTimeout) clearTimeout(this.renderTimeout);
            
            // Disconnect observers
            if (this.resizeObserver) {
                this.resizeObserver.disconnect();
            }
            
            // Remove event listeners
            if (this.container) {
                this.container.removeEventListener('scroll', this.handleScroll.bind(this));
                this.container.removeEventListener('touchstart', this.handleTouchStart.bind(this));
                this.container.removeEventListener('touchmove', this.handleTouchMove.bind(this));
            }
            
            // Clear collections
            this.renderedMessages.clear();
            this.messageCache.clear();
            this.pendingUpdates.clear();
            
            this.isInitialized = false;
            console.log('Enhanced virtual scroll destroyed');
        }
    }

    // Create global instance
    window.enhancedVirtualScroll = new EnhancedVirtualScroll();

    // Integration with your existing app
    document.addEventListener('DOMContentLoaded', function() {
        // Wait a bit for your app to initialize
        setTimeout(() => {
            setupVirtualScrollIntegration();
        }, 1000);
    });

    function setupVirtualScrollIntegration() {
        // Override critical functions
        overrideDisplayMessage();
        overrideUpdateMessagesDisplay();
        overrideDisplayCachedMessages();
        overrideChatPageCleanup();
        
        // Add CSS enhancements
        addVirtualScrollCSS();
    }

    function overrideDisplayMessage() {
        if (typeof window.displayMessage !== 'function') return;
        
        const originalDisplayMessage = window.displayMessage;
        
        window.displayMessage = function(message, currentUserId) {
            // Initialize virtual scroll if needed
            if (!window.enhancedVirtualScroll.isInitialized) {
                const container = document.getElementById('chatMessages');
                if (container) {
                    window.enhancedVirtualScroll.initialize('chatMessages');
                }
            }
            
            // Add to virtual scroll
            if (window.enhancedVirtualScroll.isInitialized) {
                window.enhancedVirtualScroll.addMessage({
                    ...message,
                    _currentUserId: currentUserId
                });
            }
            
            // Also call original for other side effects
            return originalDisplayMessage.call(this, message, currentUserId);
        };
    }

    function overrideUpdateMessagesDisplay() {
        if (typeof window.updateMessagesDisplay !== 'function') return;
        
        const originalUpdateMessagesDisplay = window.updateMessagesDisplay;
        
        window.updateMessagesDisplay = function(newMessages, currentUserId) {
            // Initialize virtual scroll if needed
            if (!window.enhancedVirtualScroll.isInitialized) {
                const container = document.getElementById('chatMessages');
                if (container) {
                    window.enhancedVirtualScroll.initialize('chatMessages');
                }
            }
            
            // Set all messages in virtual scroll
            if (window.enhancedVirtualScroll.isInitialized) {
                window.enhancedVirtualScroll.setMessages(
                    newMessages.map(msg => ({
                        ...msg,
                        _currentUserId: currentUserId
                    }))
                );
            }
            
            // Call original for compatibility
            return originalUpdateMessagesDisplay.call(this, newMessages, currentUserId);
        };
    }

    function overrideDisplayCachedMessages() {
        if (typeof window.displayCachedMessages !== 'function') return;
        
        const originalDisplayCachedMessages = window.displayCachedMessages;
        
        window.displayCachedMessages = function(messages) {
            // Initialize virtual scroll if needed
            if (!window.enhancedVirtualScroll.isInitialized) {
                const container = document.getElementById('chatMessages');
                if (container) {
                    window.enhancedVirtualScroll.initialize('chatMessages');
                }
            }
            
            // Set cached messages
            if (window.enhancedVirtualScroll.isInitialized) {
                window.enhancedVirtualScroll.setMessages(
                    messages.map(msg => ({
                        ...msg,
                        _currentUserId: window.currentUser?.uid
                    }))
                );
            }
            
            // Call original for compatibility
            return originalDisplayCachedMessages.call(this, messages);
        };
    }

    function overrideChatPageCleanup() {
        // Listen for page cleanup
        const originalCleanupChatPage = window.cleanupChatPage;
        if (typeof originalCleanupChatPage === 'function') {
            window.cleanupChatPage = function() {
                // Clean up virtual scroll
                if (window.enhancedVirtualScroll.isInitialized) {
                    window.enhancedVirtualScroll.destroy();
                }
                
                // Call original cleanup
                return originalCleanupChatPage.call(this);
            };
        }
    }

    function addVirtualScrollCSS() {
        const style = document.createElement('style');
        style.textContent = `
            /* Virtual Scroll Styles */
            .virtual-scroll-content {
                min-height: 100%;
            }
            
            .virtual-scroll-spacer {
                transition: height 0.2s ease-out;
            }
            
            .message[data-virtual-render="true"] {
                animation: messageFadeIn 0.3s ease-out;
                transform: translateZ(0);
                backface-visibility: hidden;
            }
            
            .message-loading {
                min-height: 60px;
                background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
                background-size: 200% 100%;
                animation: loadingShimmer 1.5s infinite;
                border-radius: 8px;
                margin: 5px 0;
            }
            
            .message.highlight-message {
                animation: highlightPulse 2s ease;
            }
            
            @keyframes messageFadeIn {
                from {
                    opacity: 0.5;
                    transform: translateY(10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            @keyframes loadingShimmer {
                0% {
                    background-position: -200% 0;
                }
                100% {
                    background-position: 200% 0;
                }
            }
            
            @keyframes highlightPulse {
                0%, 100% {
                    box-shadow: none;
                }
                50% {
                    box-shadow: 0 0 0 2px rgba(74, 140, 255, 0.3);
                }
            }
            
            /* Performance optimizations */
            #chatMessages {
                overflow-anchor: none;
                -webkit-overflow-scrolling: touch;
                contain: strict;
                will-change: scroll-position;
            }
            
            .message {
                contain: layout style paint;
                will-change: transform;
                transform: translateZ(0);
            }
            
            /* Smooth scrolling */
            .smooth-scroll {
                scroll-behavior: smooth;
            }
            
            /* Hide scrollbar during fast scroll */
            .fast-scrolling::-webkit-scrollbar {
                display: none;
            }
            
            .fast-scrolling {
                -ms-overflow-style: none;
                scrollbar-width: none;
            }
        `;
        document.head.appendChild(style);
    }

    console.log('Enhanced virtual scroll fix.js loaded successfully');
})();