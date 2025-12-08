// hack.js - Security Protection Module (Fixed for Firebase Compatibility)
class SecurityProtection {
    constructor() {
        this.init();
    }

    init() {
        this.setupSecurityHeaders();
        this.preventCommonAttacks();
        this.setupInputSanitization();
        this.setupAPISecurity();
        this.monitorSuspiciousActivity();
        console.log('🔒 Security protection activated (Firebase Compatible)');
    }

    // Security headers and meta tags
    setupSecurityHeaders() {
        // Add security meta tags
        const metaTags = [
            { name: 'referrer', content: 'strict-origin-when-cross-origin' },
            { name: 'x-ua-compatible', content: 'IE=edge' }
        ];

        metaTags.forEach(tag => {
            if (!document.querySelector(`meta[name="${tag.name}"]`)) {
                const meta = document.createElement('meta');
                meta.name = tag.name;
                meta.content = tag.content;
                document.head.appendChild(meta);
            }
        });
    }

    // Prevent common web attacks (without breaking Firebase)
    preventCommonAttacks() {
        // Prevent right-click and inspect element on sensitive areas only
        document.addEventListener('contextmenu', (e) => {
            if (this.isSensitiveArea(e.target)) {
                e.preventDefault();
                this.logSecurityEvent('Right-click prevented on sensitive area');
            }
        });

        // Prevent iframe embedding
        if (window.top !== window.self) {
            window.top.location = window.self.location;
            this.logSecurityEvent('Framing attempt detected and prevented');
        }

        // Remove prototype freezing as it breaks Firebase
        // Object.freeze(Object.prototype); // REMOVED - Causes Firebase errors
        // Object.freeze(Array.prototype);  // REMOVED - Causes Firebase errors
        // Object.freeze(Function.prototype); // REMOVED - Causes Firebase errors
    }

    // Input sanitization and validation
    setupInputSanitization() {
        // Override form submit to sanitize inputs
        document.addEventListener('submit', (e) => {
            const form = e.target;
            if (form.tagName === 'FORM') {
                if (!this.sanitizeFormInputs(form)) {
                    e.preventDefault();
                    this.showSecurityWarning('Invalid input detected');
                }
            }
        });

        // Sanitize all input fields in real-time
        document.addEventListener('input', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                this.sanitizeInput(e.target);
            }
        });
    }

    // API and Firebase security
    setupAPISecurity() {
        // Protect against API abuse
        this.setupRateLimiting();
        
        // Monitor for suspicious network requests
        this.monitorNetworkRequests();
    }

    // Input validation methods
    sanitizeFormInputs(form) {
        const inputs = form.querySelectorAll('input, textarea, select');
        let isValid = true;

        inputs.forEach(input => {
            if (!this.validateInput(input)) {
                isValid = false;
                this.highlightInvalidInput(input);
            } else {
                this.clearHighlight(input);
            }
        });

        return isValid;
    }

    validateInput(input) {
        const value = input.value.trim();
        const type = input.type.toLowerCase();
        const name = input.name.toLowerCase();

        // Empty check for required fields
        if (input.required && !value) {
            return false;
        }

        // Type-specific validation
        switch (type) {
            case 'email':
                return this.isValidEmail(value);
            case 'password':
                return this.isValidPassword(value);
            case 'text':
                if (name.includes('name')) return this.isValidName(value);
                if (name.includes('phone')) return this.isValidPhone(value);
                return this.isValidText(value);
            case 'number':
                return this.isValidNumber(value);
            case 'url':
                return this.isValidURL(value);
            default:
                return this.isSafeString(value);
        }
    }

    sanitizeInput(input) {
        const originalValue = input.value;
        let sanitizedValue = originalValue;

        // Remove potentially dangerous characters and patterns
        sanitizedValue = sanitizedValue
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+=/gi, '')
            .replace(/expression\(/gi, '')
            .replace(/vbscript:/gi, '')
            .replace(/data:/gi, '')
            .replace(/--/g, '')
            .replace(/'/g, '')
            .replace(/"/g, '')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Limit length based on input type
        const maxLength = this.getMaxLength(input);
        if (sanitizedValue.length > maxLength) {
            sanitizedValue = sanitizedValue.substring(0, maxLength);
        }

        if (sanitizedValue !== originalValue) {
            input.value = sanitizedValue;
            this.logSecurityEvent('Input sanitized', { 
                field: input.name, 
                original: originalValue.substring(0, 50),
                sanitized: sanitizedValue.substring(0, 50)
            });
        }
    }

    // Validation helper methods
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email) && email.length <= 254;
    }

    isValidPassword(password) {
        // Minimum 8 characters, at least one letter and one number
        const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/;
        return passwordRegex.test(password) && password.length <= 128;
    }

    isValidName(name) {
        // Only letters, spaces, hyphens, and apostrophes
        const nameRegex = /^[a-zA-Z\s\-']{2,50}$/;
        return nameRegex.test(name);
    }

    isValidPhone(phone) {
        // Basic international phone number validation
        const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
        return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
    }

    isValidText(text) {
        // Allow letters, numbers, and basic punctuation
        const textRegex = /^[a-zA-Z0-9\s\.,!?\-_']{1,500}$/;
        return textRegex.test(text);
    }

    isValidNumber(number) {
        return !isNaN(number) && number >= 0 && number <= 999;
    }

    isValidURL(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    isSafeString(str) {
        // Check for common injection patterns
        const dangerousPatterns = [
            /select.*from/i,
            /insert.*into/i,
            /update.*set/i,
            /delete.*from/i,
            /drop.*table/i,
            /union.*select/i,
            /<\/?script/i,
            /javascript:/i,
            /on\w+\s*=/i,
            /expression\(/i
        ];

        return !dangerousPatterns.some(pattern => pattern.test(str));
    }

    getMaxLength(input) {
        const type = input.type.toLowerCase();
        const name = input.name.toLowerCase();

        switch (type) {
            case 'email': return 254;
            case 'password': return 128;
            case 'text':
                if (name.includes('name')) return 50;
                if (name.includes('bio')) return 500;
                return 255;
            case 'number': 
                if (name.includes('age')) return 3;
                return 10;
            default: return 255;
        }
    }

    // Rate limiting for API calls
    setupRateLimiting() {
        const limits = new Map();
        const windowMs = 60000; // 1 minute
        const maxRequests = 100; // Max requests per minute

        // Intercept fetch requests
        const originalFetch = window.fetch;
        if (originalFetch) {
            window.fetch = (...args) => {
                const now = Date.now();
                const key = this.getClientIdentifier();

                if (!limits.has(key)) {
                    limits.set(key, []);
                }

                const requests = limits.get(key);
                const windowStart = now - windowMs;

                // Remove old requests
                while (requests.length > 0 && requests[0] < windowStart) {
                    requests.shift();
                }

                // Check if over limit
                if (requests.length >= maxRequests) {
                    this.logSecurityEvent('Rate limit exceeded', { client: key });
                    return Promise.reject(new Error('Rate limit exceeded. Please try again later.'));
                }

                requests.push(now);
                limits.set(key, requests);

                return originalFetch.apply(this, args);
            };
        }
    }

    // Network monitoring
    monitorNetworkRequests() {
        // Monitor for suspicious outgoing requests
        const originalFetch = window.fetch;
        if (originalFetch) {
            window.fetch = async (...args) => {
                const [url, options] = args;
                
                // Check for suspicious URLs
                if (this.isSuspiciousURL(url)) {
                    this.logSecurityEvent('Suspicious network request blocked', { url });
                    throw new Error('Security policy violation');
                }

                // Check for large file uploads
                if (options?.body instanceof FormData) {
                    let totalSize = 0;
                    for (let [key, value] of options.body.entries()) {
                        if (value instanceof File) {
                            totalSize += value.size;
                        }
                    }
                    if (totalSize > 10 * 1024 * 1024) { // 10MB limit
                        this.logSecurityEvent('Large file upload attempt blocked', { size: totalSize });
                        throw new Error('File size too large');
                    }
                }

                return originalFetch.apply(this, args);
            };
        }
    }

    isSuspiciousURL(url) {
        const suspiciousPatterns = [
            /\.php$/i,
            /\.asp$/i,
            /\.cgi$/i,
            /\/etc\/passwd/i,
            /\.\.\//, // Directory traversal
            /javascript:/i,
            /data:text\/html/i,
            /xss/i,
            /sql/i
        ];

        return suspiciousPatterns.some(pattern => pattern.test(url));
    }

    // Suspicious activity monitoring
    monitorSuspiciousActivity() {
        // Monitor for rapid clicking (bot behavior)
        let clickCount = 0;
        const clickThreshold = 10;
        const timeWindow = 3000; // 3 seconds

        document.addEventListener('click', (e) => {
            clickCount++;
            
            if (clickCount >= clickThreshold) {
                this.logSecurityEvent('Rapid clicking detected - possible bot activity');
                // Could implement CAPTCHA or temporary blocking
            }

            setTimeout(() => { clickCount = Math.max(0, clickCount - 1); }, timeWindow);
        });

        // Monitor for suspicious form submissions
        document.addEventListener('submit', (e) => {
            const form = e.target;
            const formData = new FormData(form);
            
            // Check for hidden fields being modified
            const hiddenInputs = form.querySelectorAll('input[type="hidden"]');
            hiddenInputs.forEach(input => {
                if (input.value !== input.defaultValue) {
                    this.logSecurityEvent('Hidden field tampering detected', { field: input.name });
                    e.preventDefault();
                }
            });
        });
    }

    // Utility methods
    getClientIdentifier() {
        // Create a unique identifier for rate limiting
        return btoa(navigator.userAgent + navigator.language);
    }

    isSensitiveArea(element) {
        // Define sensitive areas where right-click should be prevented
        const sensitiveSelectors = [
            'img[src*="profile"]',
            '.profile-image',
            '.message-content',
            '.chat-messages',
            '[data-sensitive="true"]'
        ];

        return sensitiveSelectors.some(selector => element.closest(selector));
    }

    highlightInvalidInput(input) {
        input.style.border = '2px solid #ff4444';
        input.style.backgroundColor = '#fff5f5';
    }

    clearHighlight(input) {
        input.style.border = '';
        input.style.backgroundColor = '';
    }

    showSecurityWarning(message) {
        // Show a non-intrusive security warning
        const warning = document.createElement('div');
        warning.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ff4444;
            color: white;
            padding: 15px;
            border-radius: 5px;
            z-index: 10000;
            max-width: 300px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        `;
        warning.textContent = `⚠️ Security: ${message}`;
        document.body.appendChild(warning);

        setTimeout(() => {
            if (warning.parentNode) {
                warning.parentNode.removeChild(warning);
            }
        }, 5000);
    }

    logSecurityEvent(event, details = {}) {
        // Log security events for monitoring
        const logEntry = {
            timestamp: new Date().toISOString(),
            event: event,
            details: details,
            userAgent: navigator.userAgent,
            url: window.location.href,
            clientId: this.getClientIdentifier()
        };

        console.warn('🔒 Security Event:', logEntry);

        // Send to security monitoring service (if available)
        this.reportToMonitoringService(logEntry);
    }

    reportToMonitoringService(logEntry) {
        // Implement integration with your security monitoring service
        try {
            // Example: Send to a security logging endpoint
            if (window.fetch) {
                fetch('/api/security/log', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(logEntry)
                }).catch(error => {
                    console.error('Failed to report security event:', error);
                });
            }
        } catch (error) {
            console.error('Error reporting security event:', error);
        }
    }
}

// Initialize security protection with Firebase compatibility
document.addEventListener('DOMContentLoaded', () => {
    // Wait for Firebase to initialize first
    const initSecurity = () => {
        // Check if Firebase is likely loaded (wait a bit longer)
        if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
            // Give Firebase a moment to fully initialize
            setTimeout(() => {
                window.securityProtection = new SecurityProtection();
            }, 1000);
        } else {
            // Try again in 500ms if Firebase isn't ready
            setTimeout(initSecurity, 500);
        }
    };

    // Start initialization
    setTimeout(initSecurity, 1000);
});

// Safe security utilities that don't break Firebase
window.SecurityUtils = {
    sanitize: function(input) {
        if (typeof input !== 'string') return input;
        return input.replace(/[<>]/g, '').substring(0, 1000);
    },
    
    validateEmail: function(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },
    
    generateCSRFToken: function() {
        return 'csrf_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    },
    
    // Safe input validation that doesn't interfere with Firebase
    validateInput: function(input) {
        if (typeof input !== 'string') return true;
        
        const dangerousPatterns = [
            /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
            /javascript:/gi,
            /on\w+=/gi
        ];
        
        return !dangerousPatterns.some(pattern => pattern.test(input));
    }
};