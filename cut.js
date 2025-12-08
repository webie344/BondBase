// cut.js - Utility functions for truncating text display

/**
 * Truncates a name to maximum 7 characters for display
 * @param {string} name - The name to truncate
 * @param {number} maxLength - Maximum length (default: 7)
 * @returns {string} Truncated name with ellipsis if needed
 */
function truncateName(name, maxLength = 7) {
    if (!name || typeof name !== 'string') {
        return 'Unknown';
    }
    
    // Remove extra whitespace and get clean name
    const cleanName = name.trim();
    
    // If name is already short enough, return as is
    if (cleanName.length <= maxLength) {
        return cleanName;
    }
    
    // Truncate to max length and add ellipsis
    return cleanName.substring(0, maxLength) + '...';
}

/**
 * Applies name truncation to all elements with specific classes
 * This should be called after the DOM is loaded
 */
function applyNameTruncation() {
    // Get current page to determine which elements to target
    const currentPage = window.location.pathname.split('/').pop();
    
    // Elements that typically display user names (EXCLUDING timestamps)
    const nameSelectors = [
        '.message-card h3',           // Message threads list - names only
        '.chat-partner-name',         // Chat header name
        '#chatPartnerName',           // Chat partner name
        '.profile-name',              // Profile names
        '.sender-name',               // Message sender names
        '.reply-preview-name',        // Reply preview names
        '.typing-indicator span:first-child' // Only the name part in typing indicator
    ];
    
    // SPECIFIC elements to avoid (timestamps and time-related elements)
    const excludeSelectors = [
        '.message-time',
        '.message-card .message-time',
        '.typing-indicator .message-time',
        '[class*="time"]',
        '[class*="timestamp"]',
        '.voice-message-duration',
        '.video-duration'
    ];
    
    nameSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
            // Skip if this element matches any exclude patterns
            let shouldExclude = false;
            excludeSelectors.forEach(excludeSelector => {
                if (element.matches(excludeSelector) || element.closest(excludeSelector)) {
                    shouldExclude = true;
                }
            });
            
            if (shouldExclude) return;
            
            const originalName = element.textContent.trim();
            
            // Additional check: don't truncate time-like patterns
            if (isTimeLike(originalName)) {
                return;
            }
            
            const truncatedName = truncateName(originalName);
            
            // Only update if truncation actually happened
            if (truncatedName !== originalName) {
                element.textContent = truncatedName;
                
                // Add title attribute with full name for hover tooltip
                element.setAttribute('title', originalName);
            }
        });
    });
    
    
}

/**
 * Check if text looks like a timestamp or time-related content
 */
function isTimeLike(text) {
    const timePatterns = [
        /\d{1,2}:\d{2}\s*(?:[ap]m)?/i, // Time patterns like "10:30 AM"
        /\d+[smhdw]?\s*ago/, // Relative time like "5m ago", "2h ago"
        /(?:just now|now|today|yesterday)/i,
        /\d{1,2}\/\d{1,2}\/\d{4}/, // Date patterns
        /^(?:\d+[smhdw]?\s*ago|just now)$/i, // Common timestamp formats
        /✓✓/, // Read receipts
        /Sending/ // Message status
    ];
    
    return timePatterns.some(pattern => pattern.test(text));
}

/**
 * Enhanced version that truncates names in dynamically loaded content
 * Use this for real-time updates in chat
 */
function truncateDynamicContent(container) {
    const nameSelectors = [
        'h3',           // Typically names in message cards
        '.chat-partner-name',
        '#chatPartnerName',
        '.profile-name',
        '.sender-name',
        '.reply-preview-name'
    ];
    
    nameSelectors.forEach(selector => {
        const elements = container.querySelectorAll(selector);
        elements.forEach(element => {
            // Skip timestamps and time-related elements
            if (element.closest('.message-time') || 
                element.classList.contains('message-time') ||
                isTimeLike(element.textContent)) {
                return;
            }
            
            const originalName = element.textContent.trim();
            const truncatedName = truncateName(originalName);
            
            if (truncatedName !== originalName) {
                element.textContent = truncatedName;
                element.setAttribute('title', originalName);
            }
        });
    });
}

/**
 * Safe truncation for specific elements only
 * Use this when you want precise control
 */
function safeTruncateNames() {
    // Only target very specific name containers
    const safeSelectors = [
        '.message-card .message-content h3', // Only the name in message cards
        '.chat-header .chat-partner-name',   // Only chat partner name in header
        '#chatPartnerName',                  // Specific chat partner name element
        '.reply-preview .reply-preview-name' // Only reply preview names
    ];
    
    safeSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
            const originalName = element.textContent.trim();
            
            // Double-check it's not a timestamp
            if (!isTimeLike(originalName)) {
                const truncatedName = truncateName(originalName);
                if (truncatedName !== originalName) {
                    element.textContent = truncatedName;
                    element.setAttribute('title', originalName);
                }
            }
        });
    });
}

/**
 * Initialize name truncation for the application
 * Call this after DOM is ready and whenever new content is loaded
 */
function initNameTruncation() {
    // Apply safe truncation immediately
    safeTruncateNames();
    
    // Set up MutationObserver to handle dynamically loaded content
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) { // Element node
                    // Only process specific containers that contain names
                    if (node.matches && (
                        node.matches('.message-card') || 
                        node.matches('.chat-header') ||
                        node.matches('.message') && node.classList.contains('received')
                    )) {
                        setTimeout(() => {
                            safeTruncateNames();
                        }, 100);
                    } else if (node.querySelectorAll) {
                        // Check if this node contains any of our target elements
                        const hasTargetElements = node.querySelectorAll('.message-card, .chat-header, #chatPartnerName').length > 0;
                        if (hasTargetElements) {
                            setTimeout(() => {
                                safeTruncateNames();
                            }, 100);
                        }
                    }
                }
            });
        });
    });
    
    // Start observing the document body for changes
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    return observer;
}

// Page-specific initialization
document.addEventListener('DOMContentLoaded', function() {
    const currentPage = window.location.pathname.split('/').pop();
    
    // Only initialize on message and chat pages
    if (currentPage === 'messages.html' || currentPage === 'chat.html') {
        
        
        // Use safe truncation instead of aggressive one
        initNameTruncation();
        
        // Also apply truncation after a short delay to catch any dynamic content
        setTimeout(safeTruncateNames, 500);
        setTimeout(safeTruncateNames, 1000); // Double check
    }
});

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        truncateName,
        applyNameTruncation,
        truncateDynamicContent,
        initNameTruncation,
        safeTruncateNames
    };
}