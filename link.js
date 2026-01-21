// link.js - Link Preview INSIDE Input Field (Like WhatsApp)

// Firebase Imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, 
    doc, 
    setDoc, 
    getDoc, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

class WhatsAppLinkPreview {
    constructor() {
        this.firebaseConfig = {
            apiKey: "AIzaSyC9uL_BX14Z6rRpgG4MT9Tca1opJl8EviQ",
            authDomain: "dating-connect.firebaseapp.com",
            projectId: "dating-connect",
            storageBucket: "dating-connect.appspot.com",
            messagingSenderId: "1062172180210",
            appId: "1:1062172180210:web:0c9b3c1578a5dbae58da6b"
        };
        
        this.app = null;
        this.db = null;
        
        this.urlRegex = /https?:\/\/[^\s<]+/g;
        this.previewCache = new Map();
        this.currentPreview = null;
        
        console.log('WhatsApp Link Preview created');
    }
    
    async init() {
        try {
            this.app = initializeApp(this.firebaseConfig, 'whatsapp-link-preview');
            this.db = getFirestore(this.app);
            
            this.injectWhatsAppStyles();
            this.setup();
            
            console.log('WhatsApp Link Preview ready');
            
        } catch (error) {
            console.error('Init error:', error);
        }
    }
    
    injectWhatsAppStyles() {
        if (document.getElementById('whatsapp-preview-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'whatsapp-preview-styles';
        styles.textContent = `
            /* WhatsApp-style Preview INSIDE Input Field */
            .whatsapp-input-container {
                position: relative;
                width: 100%;
            }
            
            /* Preview inside the input area */
            .whatsapp-input-preview {
                position: absolute;
                bottom: 100%;
                left: 0;
                right: 0;
                background: #f0f2f5;
                border-radius: 8px;
                padding: 8px;
                margin-bottom: 5px;
                border-left: 3px solid #25d366;
                animation: slideDown 0.2s ease;
                z-index: 100;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                max-width: 100%;
                box-sizing: border-box;
            }
            
            /* Compact preview card */
            .whatsapp-preview-card {
                display: flex;
                align-items: center;
                gap: 10px;
                text-decoration: none;
                color: inherit;
            }
            
            .whatsapp-preview-image {
                width: 40px;
                height: 40px;
                min-width: 40px;
                border-radius: 6px;
                overflow: hidden;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .whatsapp-preview-image img {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }
            
            .whatsapp-no-image {
                color: white;
                font-size: 18px;
            }
            
            .whatsapp-preview-content {
                flex: 1;
                min-width: 0;
                overflow: hidden;
            }
            
            .whatsapp-preview-title {
                font-size: 13px;
                font-weight: 500;
                color: #333;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                margin-bottom: 2px;
            }
            
            .whatsapp-preview-url {
                font-size: 11px;
                color: #007aff;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            /* Remove button */
            .whatsapp-remove-btn {
                width: 24px;
                height: 24px;
                min-width: 24px;
                border-radius: 50%;
                background: rgba(0,0,0,0.1);
                border: none;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                flex-shrink: 0;
            }
            
            .whatsapp-remove-btn:hover {
                background: rgba(0,0,0,0.2);
            }
            
            .whatsapp-remove-btn svg {
                width: 14px;
                height: 14px;
                stroke: #333;
            }
            
            /* Message preview (after sending) */
            .whatsapp-message-preview {
                margin-top: 5px;
                max-width: 280px;
            }
            
            .whatsapp-message-card {
                background: #f0f2f5;
                border-radius: 8px;
                overflow: hidden;
                border-left: 3px solid #25d366;
            }
            
            .whatsapp-message-image {
                height: 120px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                overflow: hidden;
            }
            
            .whatsapp-message-image img {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }
            
            .whatsapp-message-content {
                padding: 10px 12px;
                background: white;
            }
            
            .whatsapp-message-site {
                font-size: 11px;
                color: #666;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-bottom: 6px;
                font-weight: 600;
            }
            
            .whatsapp-message-title {
                font-size: 14px;
                font-weight: 500;
                color: #333;
                margin-bottom: 4px;
                line-height: 1.3;
                overflow: hidden;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
            }
            
            .whatsapp-message-description {
                font-size: 12px;
                color: #666;
                line-height: 1.4;
                overflow: hidden;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
            }
            
            /* Links in messages - CLEAN, NO METADATA */
            .message-text a,
            .message-content a {
                color: #007aff !important;
                text-decoration: none !important;
                word-break: break-word !important;
                display: inline !important;
            }
            
            .message-text a:hover,
            .message-content a:hover {
                text-decoration: underline !important;
            }
            
            /* Adjust input container when preview is shown */
            .has-preview .message-input-container {
                padding-bottom: 50px;
            }
            
            /* Animations */
            @keyframes slideDown {
                from {
                    opacity: 0;
                    transform: translateY(-10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
        `;
        
        document.head.appendChild(styles);
    }
    
    setup() {
        this.findAndWrapInput();
        this.setupMessageHandler();
    }
    
    findAndWrapInput() {
        const findInput = () => {
            // Look for message input
            const input = document.querySelector('#messageInput, textarea[placeholder*="message"], input[placeholder*="message"]');
            
            if (input && !input.dataset.whatsappWrapped) {
                console.log('Found input, wrapping for WhatsApp preview');
                this.wrapInputForPreview(input);
                return true;
            }
            
            return false;
        };
        
        // Try immediately
        if (!findInput()) {
            // Try every 500ms
            const interval = setInterval(() => {
                if (findInput()) {
                    clearInterval(interval);
                }
            }, 500);
        }
    }
    
    wrapInputForPreview(input) {
        input.dataset.whatsappWrapped = 'true';
        
        // Create container
        const container = document.createElement('div');
        container.className = 'whatsapp-input-container';
        
        // Wrap the input
        input.parentNode.insertBefore(container, input);
        container.appendChild(input);
        
        // Create preview element
        const previewDiv = document.createElement('div');
        previewDiv.className = 'whatsapp-input-preview';
        previewDiv.style.display = 'none';
        container.appendChild(previewDiv);
        
        // Add class to parent for styling
        const parentContainer = container.closest('.message-input-container, .chat-input, .input-container');
        if (parentContainer) {
            parentContainer.classList.add('has-preview');
        }
        
        // Setup URL detection
        this.setupInputDetection(input, previewDiv, container);
    }
    
    setupInputDetection(input, previewDiv, container) {
        let currentUrl = '';
        let timeout;
        
        const checkForUrl = () => {
            const text = input.value;
            const url = this.extractFirstUrl(text);
            
            if (url && url !== currentUrl) {
                currentUrl = url;
                this.showWhatsAppPreview(previewDiv, url);
            } else if (!url && currentUrl) {
                currentUrl = '';
                previewDiv.style.display = 'none';
                previewDiv.innerHTML = '';
            }
        };
        
        // Detect URLs
        input.addEventListener('input', () => {
            clearTimeout(timeout);
            timeout = setTimeout(checkForUrl, 300);
        });
        
        input.addEventListener('paste', () => {
            setTimeout(checkForUrl, 100);
        });
        
        // Clear on focus if empty
        input.addEventListener('focus', () => {
            if (!input.value.trim() && currentUrl) {
                currentUrl = '';
                previewDiv.style.display = 'none';
                previewDiv.innerHTML = '';
            }
        });
        
        // Clear on send
        this.setupSendClear(input, previewDiv, () => {
            currentUrl = '';
        });
    }
    
    extractFirstUrl(text) {
        if (!text) return null;
        
        const matches = text.match(this.urlRegex);
        if (!matches) return null;
        
        // Get first URL
        const url = matches[0].trim();
        
        // Clean URL
        const cleanUrl = url.replace(/[.,;:!?)\]\s]+$/, '');
        
        // Validate
        try {
            new URL(cleanUrl);
            return cleanUrl;
        } catch {
            return null;
        }
    }
    
    async showWhatsAppPreview(previewDiv, url) {
        console.log('Showing WhatsApp preview for:', url);
        
        // Show loading
        previewDiv.innerHTML = `
            <div class="whatsapp-preview-card">
                <div class="whatsapp-preview-image">
                    <div class="whatsapp-no-image">↻</div>
                </div>
                <div class="whatsapp-preview-content">
                    <div class="whatsapp-preview-title">Loading preview...</div>
                    <div class="whatsapp-preview-url">${url}</div>
                </div>
                <button class="whatsapp-remove-btn" onclick="window.whatsappLinkPreview.removePreview(this)">×</button>
            </div>
        `;
        previewDiv.style.display = 'block';
        
        try {
            const preview = await this.fetchPreview(url);
            
            const imageHtml = preview.image ? 
                `<img src="${preview.image}" alt="" 
                      onerror="this.style.display='none'; this.parentElement.innerHTML='<div class=\\'whatsapp-no-image\\'>🔗</div>';">` :
                `<div class="whatsapp-no-image">🔗</div>`;
            
            previewDiv.innerHTML = `
                <a href="${url}" target="_blank" rel="noopener noreferrer" class="whatsapp-preview-card">
                    <div class="whatsapp-preview-image">
                        ${imageHtml}
                    </div>
                    <div class="whatsapp-preview-content">
                        <div class="whatsapp-preview-title">${preview.title}</div>
                        <div class="whatsapp-preview-url">${preview.siteName}</div>
                    </div>
                </a>
                <button class="whatsapp-remove-btn" onclick="window.whatsappLinkPreview.removePreview(this)">×</button>
            `;
            
            this.currentPreview = { container: previewDiv, url };
            
        } catch (error) {
            console.error('Preview failed:', error);
            const urlObj = new URL(url);
            
            previewDiv.innerHTML = `
                <a href="${url}" target="_blank" rel="noopener noreferrer" class="whatsapp-preview-card">
                    <div class="whatsapp-preview-image">
                        <div class="whatsapp-no-image">🔗</div>
                    </div>
                    <div class="whatsapp-preview-content">
                        <div class="whatsapp-preview-title">${urlObj.hostname}</div>
                        <div class="whatsapp-preview-url">${url}</div>
                    </div>
                </a>
                <button class="whatsapp-remove-btn" onclick="window.whatsappLinkPreview.removePreview(this)">×</button>
            `;
        }
    }
    
    async fetchPreview(url) {
        const cacheKey = btoa(url);
        
        // Check cache
        if (this.previewCache.has(cacheKey)) {
            const cached = this.previewCache.get(cacheKey);
            if (Date.now() - cached.timestamp < 30 * 60 * 1000) {
                return cached.data;
            }
        }
        
        try {
            // Use iframely API (better for previews)
            const response = await fetch(`https://iframe.ly/api/oembed?url=${encodeURIComponent(url)}&api_key=YOUR_KEY&omit_script=1`);
            
            if (response.ok) {
                const data = await response.json();
                
                const preview = {
                    url: url,
                    title: data.title || new URL(url).hostname,
                    description: data.description || '',
                    image: data.thumbnail_url || '',
                    siteName: data.provider_name || new URL(url).hostname.replace('www.', '')
                };
                
                // Cache
                this.previewCache.set(cacheKey, {
                    data: preview,
                    timestamp: Date.now()
                });
                
                // Save to Firebase
                try {
                    const previewRef = doc(this.db, 'link_previews', cacheKey);
                    await setDoc(previewRef, {
                        preview: preview,
                        url: url,
                        timestamp: serverTimestamp()
                    }, { merge: true });
                } catch (e) {
                    // Ignore
                }
                
                return preview;
            }
        } catch (error) {
            console.log('Iframely failed, using fallback');
        }
        
        // Fallback to Open Graph
        try {
            const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
            const response = await fetch(proxyUrl, { timeout: 2000 });
            
            if (!response.ok) throw new Error('Fetch failed');
            
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            const getMeta = (prop) => {
                return doc.querySelector(`meta[property="${prop}"]`)?.getAttribute('content') ||
                       doc.querySelector(`meta[name="${prop}"]`)?.getAttribute('content');
            };
            
            const urlObj = new URL(url);
            const preview = {
                url: url,
                title: getMeta('og:title') || doc.querySelector('title')?.textContent || urlObj.hostname,
                description: getMeta('og:description') || '',
                image: getMeta('og:image') || '',
                siteName: getMeta('og:site_name') || urlObj.hostname.replace('www.', '')
            };
            
            // Fix image URL
            if (preview.image && !preview.image.startsWith('http')) {
                preview.image = new URL(preview.image, url).href;
            }
            
            // Cache
            this.previewCache.set(cacheKey, {
                data: preview,
                timestamp: Date.now()
            });
            
            return preview;
            
        } catch (error) {
            console.log('Using simple preview');
            const urlObj = new URL(url);
            return {
                url: url,
                title: urlObj.hostname,
                description: '',
                image: '',
                siteName: urlObj.hostname.replace('www.', '')
            };
        }
    }
    
    removePreview(button) {
        const previewDiv = button.closest('.whatsapp-input-preview');
        if (!previewDiv) return;
        
        // Find input and remove URL
        const container = previewDiv.closest('.whatsapp-input-container');
        const input = container?.querySelector('textarea, input[type="text"]');
        
        if (input) {
            const url = this.extractFirstUrl(input.value);
            if (url) {
                input.value = input.value.replace(url, '').trim();
                input.dispatchEvent(new Event('input'));
            }
        }
        
        previewDiv.style.display = 'none';
        previewDiv.innerHTML = '';
        this.currentPreview = null;
    }
    
    setupSendClear(input, previewDiv, clearCallback) {
        const sendButton = document.querySelector('#sendBtn, button[onclick*="send"], button[type="submit"]');
        
        if (sendButton) {
            const originalClick = sendButton.onclick;
            
            sendButton.onclick = (e) => {
                previewDiv.style.display = 'none';
                previewDiv.innerHTML = '';
                clearCallback();
                
                if (originalClick) {
                    originalClick.call(sendButton, e);
                }
            };
            
            sendButton.addEventListener('click', () => {
                setTimeout(() => {
                    previewDiv.style.display = 'none';
                    previewDiv.innerHTML = '';
                    clearCallback();
                }, 100);
            });
        }
    }
    
    setupMessageHandler() {
        // Make links blue in messages (NO METADATA)
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.addedNodes.length) {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === 1) {
                            this.cleanMessageLinks(node);
                        }
                    });
                }
            });
        });
        
        const messagesContainer = document.querySelector('#messagesContainer, .messages-container');
        if (messagesContainer) {
            observer.observe(messagesContainer, {
                childList: true,
                subtree: true
            });
        }
    }
    
    cleanMessageLinks(node) {
        const messages = node.querySelectorAll ? 
            node.querySelectorAll('.message-text, .message-content') : [];
        
        if (node.matches?.('.message-text, .message-content')) {
            this.makeLinkClean(node);
        }
        
        messages.forEach(message => {
            this.makeLinkClean(message);
        });
    }
    
    makeLinkClean(element) {
        if (element.dataset.linksCleaned) return;
        element.dataset.linksCleaned = 'true';
        
        const text = element.innerHTML || element.textContent;
        const urls = text.match(this.urlRegex);
        
        if (urls) {
            let html = element.innerHTML || text;
            urls.forEach(url => {
                const cleanUrl = url.replace(/[.,;:!?)\]\s]+$/, '');
                if (this.isValidUrl(cleanUrl)) {
                    // CLEAN LINK - NO target, no rel, no extra attributes
                    const link = `<a href="${cleanUrl}">${cleanUrl}</a>`;
                    html = html.replace(url, link);
                }
            });
            element.innerHTML = html;
        }
    }
    
    isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch {
            return false;
        }
    }
}

// Initialize
let whatsappLinkPreview = null;

// Start
document.addEventListener('DOMContentLoaded', async () => {
    whatsappLinkPreview = new WhatsAppLinkPreview();
    await whatsappLinkPreview.init();
    window.whatsappLinkPreview = whatsappLinkPreview;
});

// Export
export { WhatsAppLinkPreview };