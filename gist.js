// gist.js - Complete Independent Anonymous Gist System for Group Chat
// UPDATED: Professional design with dotted borders (no reaction buttons)

import { 
    getFirestore, 
    collection,
    addDoc,
    serverTimestamp,
    onSnapshot,
    query,
    where,
    orderBy,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

const firebaseConfig = {
    apiKey: "AIzaSyC9uL_BX14Z6rRpgG4MT9Tca1opJl8EviQ",
    authDomain: "dating-connect.firebaseapp.com",
    projectId: "dating-connect",
    storageBucket: "dating-connect.appspot.com",
    messagingSenderId: "1062172180210",
    appId: "1:1062182180210:web:0c9b3c1578a5dbae58da6b"
};

class GistSystem {
    constructor() {
        this.app = initializeApp(firebaseConfig, 'GistSystemApp');
        this.db = getFirestore(this.app);
        this.currentGroupId = null;
        this.gistModal = null;
        this.gistInput = null;
        this.isGistModalOpen = false;
        
        this.processedMessages = new Set();
        this.gistMessageElements = new Map();
        
        this.unsubscribeFunctions = {
            gistMessages: new Map(),
            allMessages: new Map()
        };
        
        this.initialize();
    }
    
    initialize() {
        this.createGistModal();
        this.addGlobalStyles();
        this.setupEventListeners();
        this.observeURLChanges();
        
        // Initialize after a short delay to ensure DOM is ready
        setTimeout(() => {
            this.checkAndAddGistButton();
            this.setupMessageObserver();
        }, 1500);
    }
    
    createGistModal() {
        // Remove existing modal if it exists
        const existingModal = document.getElementById('gistModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Create modal container
        this.gistModal = document.createElement('div');
        this.gistModal.id = 'gistModal';
        this.gistModal.className = 'gist-modal';
        
        // Modal content
        this.gistModal.innerHTML = `
            <div class="gist-modal-content">
                <div class="gist-modal-header">
                    <h3>💭 I Heard a Gist</h3>
                    <button class="close-gist-modal">&times;</button>
                </div>
                <div class="gist-modal-body">
                    <p class="gist-description">
                        Share an anonymous gist with the group. Your name won't be shown.
                    </p>
                    <div class="gist-input-container">
                        <textarea 
                            id="gistInput" 
                            class="gist-input" 
                            placeholder="What's the tea? Spill it anonymously..."
                            maxlength="500"
                            rows="4"
                        ></textarea>
                        <div class="gist-input-footer">
                            <span class="char-count">0/500</span>
                            <div class="gist-actions">
                                <button class="gist-cancel-btn">Cancel</button>
                                <button class="gist-post-btn" disabled>Post Gist</button>
                            </div>
                        </div>
                    </div>
                    <div class="gist-guidelines">
                        <h4>📜 Gist Guidelines:</h4>
                        <ul>
                            <li>Keep it fun and lighthearted</li>
                            <li>No hate speech or harassment</li>
                            <li>Respect others' privacy</li>
                            <li>No personal attacks</li>
                            <li>Be respectful and kind</li>
                        </ul>
                        <p class="gist-anonymous-note">🕵️‍♀️ Your gist will be posted anonymously</p>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.gistModal);
        
        // Get references to elements
        this.gistInput = document.getElementById('gistInput');
        const closeBtn = this.gistModal.querySelector('.close-gist-modal');
        const cancelBtn = this.gistModal.querySelector('.gist-cancel-btn');
        const postBtn = this.gistModal.querySelector('.gist-post-btn');
        const charCount = this.gistModal.querySelector('.char-count');
        
        // Event listeners
        closeBtn.addEventListener('click', () => this.hideGistModal());
        cancelBtn.addEventListener('click', () => this.hideGistModal());
        
        this.gistModal.addEventListener('click', (e) => {
            if (e.target === this.gistModal) {
                this.hideGistModal();
            }
        });
        
        // Character count and validation
        this.gistInput.addEventListener('input', () => {
            const text = this.gistInput.value.trim();
            const remaining = 500 - text.length;
            charCount.textContent = `${text.length}/500`;
            charCount.style.color = remaining < 50 ? '#ff6b6b' : '#999';
            postBtn.disabled = text.length === 0 || text.length > 500;
            
            // Auto-resize textarea
            this.gistInput.style.height = 'auto';
            this.gistInput.style.height = Math.min(this.gistInput.scrollHeight, 200) + 'px';
        });
        
        postBtn.addEventListener('click', () => this.postGist());
        
        // Enter key to post (with shift+enter for new line)
        this.gistInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (this.gistInput.value.trim().length > 0 && !postBtn.disabled) {
                    this.postGist();
                }
            }
        });
        
        // Escape key to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isGistModalOpen) {
                this.hideGistModal();
            }
        });
    }
    
    addGlobalStyles() {
        const styles = document.createElement('style');
        styles.id = 'gist-system-styles';
        styles.textContent = `
            /* Hide regular messages that are gists */
            .message-text[data-is-gist="true"],
            .message-text[data-gist-processed="true"],
            .message-group[data-is-gist="true"] {
                display: none !important;
            }
            
            /* Hide specific gist message elements */
            .gist-message-hide {
                display: none !important;
                opacity: 0 !important;
                visibility: hidden !important;
                height: 0 !important;
                width: 0 !important;
                padding: 0 !important;
                margin: 0 !important;
                overflow: hidden !important;
            }
            
            /* Gist Button Styles */
            .gist-button-container {
                position: fixed;
                right: 20px;
                bottom: 90px;
                z-index: 1000;
            }
            
            .make-gist-btn {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                width: 56px;
                height: 56px;
                border-radius: 50%;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                position: relative;
                z-index: 1001;
                font-size: 0;
                overflow: hidden;
            }
            
            .make-gist-btn::before {
                content: '💭';
                font-size: 24px;
                display: block;
                transition: transform 0.3s ease;
            }
            
            .make-gist-btn:hover {
                transform: scale(1.15) rotate(5deg);
                box-shadow: 0 8px 25px rgba(102, 126, 234, 0.6);
            }
            
            .make-gist-btn:active {
                transform: scale(0.95);
                transition: transform 0.1s ease;
            }
            
            .make-gist-btn:hover::before {
                animation: gist-icon-float 1.5s ease-in-out infinite;
            }
            
            @keyframes gist-icon-float {
                0%, 100% { transform: translateY(0px); }
                50% { transform: translateY(-3px); }
            }
            
            .make-gist-btn-tooltip {
                position: absolute;
                bottom: 65px;
                right: 0;
                background: rgba(0, 0, 0, 0.85);
                color: white;
                padding: 8px 16px;
                border-radius: 12px;
                font-size: 13px;
                font-weight: 500;
                white-space: nowrap;
                opacity: 0;
                transform: translateY(10px) scale(0.9);
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                pointer-events: none;
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.1);
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
            }
            
            .make-gist-btn:hover .make-gist-btn-tooltip {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
            
            /* Gist Modal Styles */
            .gist-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.85);
                display: none;
                justify-content: center;
                align-items: center;
                z-index: 10000;
                opacity: 0;
                transition: opacity 0.3s ease;
                backdrop-filter: blur(5px);
            }
            
            .gist-modal.active {
                display: flex;
                opacity: 1;
            }
            
            .gist-modal-content {
                background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                border-radius: 24px;
                width: 90%;
                max-width: 500px;
                max-height: 85vh;
                overflow: hidden;
                box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
                animation: gist-modal-appear 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                border: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            @keyframes gist-modal-appear {
                from {
                    transform: translateY(30px) scale(0.95);
                    opacity: 0;
                }
                to {
                    transform: translateY(0) scale(1);
                    opacity: 1;
                }
            }
            
            .gist-modal-header {
                padding: 24px;
                background: rgba(255, 255, 255, 0.05);
                color: white;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .gist-modal-header h3 {
                margin: 0;
                font-size: 22px;
                display: flex;
                align-items: center;
                gap: 12px;
                font-weight: 600;
            }
            
            .close-gist-modal {
                background: rgba(255, 255, 255, 0.1);
                border: none;
                color: white;
                font-size: 32px;
                cursor: pointer;
                line-height: 1;
                padding: 0;
                width: 40px;
                height: 40px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                transition: all 0.2s;
            }
            
            .close-gist-modal:hover {
                background: rgba(255, 255, 255, 0.2);
                transform: rotate(90deg);
            }
            
            .gist-modal-body {
                padding: 24px;
                background: rgba(255, 255, 255, 0.02);
                max-height: calc(85vh - 100px);
                overflow-y: auto;
            }
            
            .gist-description {
                color: rgba(255, 255, 255, 0.7);
                margin-bottom: 24px;
                font-size: 15px;
                line-height: 1.6;
            }
            
            .gist-input-container {
                margin-bottom: 24px;
            }
            
            .gist-input {
                width: 100%;
                padding: 18px;
                border: 2px solid rgba(255, 255, 255, 0.1);
                border-radius: 16px;
                font-size: 16px;
                resize: none;
                font-family: inherit;
                transition: all 0.3s;
                box-sizing: border-box;
                background: rgba(255, 255, 255, 0.05);
                color: white;
                min-height: 120px;
            }
            
            .gist-input:focus {
                outline: none;
                border-color: #667eea;
                box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
                background: rgba(255, 255, 255, 0.08);
            }
            
            .gist-input::placeholder {
                color: rgba(255, 255, 255, 0.4);
            }
            
            .gist-input-footer {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-top: 12px;
            }
            
            .char-count {
                font-size: 13px;
                color: rgba(255, 255, 255, 0.5);
                font-weight: 500;
            }
            
            .gist-actions {
                display: flex;
                gap: 12px;
            }
            
            .gist-cancel-btn,
            .gist-post-btn {
                padding: 12px 28px;
                border: none;
                border-radius: 25px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                font-size: 15px;
                min-width: 100px;
            }
            
            .gist-cancel-btn {
                background: rgba(255, 255, 255, 0.1);
                color: rgba(255, 255, 255, 0.8);
                border: 1px solid rgba(255, 255, 255, 0.2);
            }
            
            .gist-cancel-btn:hover {
                background: rgba(255, 255, 255, 0.15);
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            }
            
            .gist-post-btn {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                box-shadow: 0 6px 20px rgba(102, 126, 234, 0.3);
            }
            
            .gist-post-btn:hover:not(:disabled) {
                transform: translateY(-2px);
                box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
            }
            
            .gist-post-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
                transform: none !important;
                box-shadow: none !important;
            }
            
            .gist-guidelines {
                background: rgba(255, 255, 255, 0.05);
                padding: 20px;
                border-radius: 16px;
                border-left: 4px solid #667eea;
                margin-top: 24px;
            }
            
            .gist-guidelines h4 {
                margin: 0 0 12px 0;
                color: white;
                font-size: 16px;
                display: flex;
                align-items: center;
                gap: 10px;
                font-weight: 600;
            }
            
            .gist-guidelines ul {
                margin: 0;
                padding-left: 24px;
                font-size: 14px;
                color: rgba(255, 255, 255, 0.7);
                line-height: 1.8;
            }
            
            .gist-guidelines li {
                margin-bottom: 8px;
            }
            
            .gist-anonymous-note {
                margin: 16px 0 0 0;
                font-size: 13px;
                color: rgba(255, 255, 255, 0.5);
                font-style: italic;
                display: flex;
                align-items: center;
                gap: 10px;
            }
            
            /* UPDATED Gist Message Styling - Professional with Dotted Borders */
            .gist-message-bubble {
                background: rgba(255, 255, 255, 0.02);
                border-radius: 20px;
                padding: 20px 24px;
                margin: 20px 16px;
                color: white;
                position: relative;
                border: 2px dashed rgba(102, 126, 234, 0.4);
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
                animation: gist-bubble-appear 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                backdrop-filter: blur(10px);
                overflow: hidden;
                transition: all 0.3s ease;
            }
            
            .gist-message-bubble:hover {
                border-color: rgba(102, 126, 234, 0.6);
                box-shadow: 0 12px 40px rgba(102, 126, 234, 0.15);
                transform: translateY(-2px);
            }
            
            @keyframes gist-bubble-appear {
                from {
                    transform: translateY(10px) scale(0.95);
                    opacity: 0;
                }
                to {
                    transform: translateY(0) scale(1);
                    opacity: 1;
                }
            }
            
            .gist-message-bubble::before {
                content: '';
                position: absolute;
                top: -2px;
                left: -2px;
                right: -2px;
                bottom: -2px;
                background: linear-gradient(135deg, 
                    rgba(102, 126, 234, 0.2) 0%, 
                    rgba(118, 75, 162, 0.2) 50%, 
                    transparent 50%);
                border-radius: 22px;
                z-index: -1;
            }
            
            .gist-header {
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 12px;
                padding-bottom: 12px;
                border-bottom: 1px dashed rgba(255, 255, 255, 0.1);
            }
            
            .gist-icon {
                font-size: 20px;
                opacity: 0.8;
            }
            
            .gist-title {
                font-weight: 600;
                font-size: 14px;
                text-transform: uppercase;
                letter-spacing: 1px;
                color: #667eea;
                opacity: 0.9;
            }
            
            .gist-content {
                font-size: 16px;
                line-height: 1.6;
                margin-bottom: 16px;
                word-break: break-word;
                color: rgba(255, 255, 255, 0.9);
                padding-right: 10px;
                font-style: italic;
            }
            
            .gist-footer {
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 12px;
                opacity: 0.7;
                padding-top: 12px;
                border-top: 1px dashed rgba(255, 255, 255, 0.1);
            }
            
            .gist-time {
                font-style: italic;
                color: rgba(255, 255, 255, 0.6);
            }
            
            .gist-id {
                font-family: 'Courier New', monospace;
                background: rgba(0, 0, 0, 0.3);
                padding: 4px 10px;
                border-radius: 12px;
                color: rgba(255, 255, 255, 0.7);
                letter-spacing: 1px;
                font-size: 11px;
            }
            
            /* Success Toast */
            .gist-success-toast {
                position: fixed;
                top: 30px;
                right: 30px;
                background: linear-gradient(135deg, rgba(102, 126, 234, 0.95) 0%, rgba(118, 75, 162, 0.95) 100%);
                color: white;
                padding: 16px 24px;
                border-radius: 16px;
                box-shadow: 0 15px 35px rgba(102, 126, 234, 0.4);
                z-index: 10002;
                animation: toast-slide-in 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.2);
                max-width: 320px;
                transform-origin: top right;
            }
            
            @keyframes toast-slide-in {
                from {
                    transform: translateX(100%) scale(0.8);
                    opacity: 0;
                }
                to {
                    transform: translateX(0) scale(1);
                    opacity: 1;
                }
            }
            
            .toast-content {
                display: flex;
                align-items: center;
                gap: 14px;
            }
            
            .toast-icon {
                font-size: 22px;
                animation: toast-icon-bounce 0.8s ease;
            }
            
            @keyframes toast-icon-bounce {
                0%, 100% { transform: scale(1); }
                25% { transform: scale(1.3); }
                50% { transform: scale(0.9); }
                75% { transform: scale(1.1); }
            }
            
            .toast-message {
                font-weight: 600;
                font-size: 15px;
                flex: 1;
            }
            
            /* Copy Feedback */
            .copy-feedback {
                position: absolute;
                top: 10px;
                right: 10px;
                background: rgba(76, 175, 80, 0.9);
                color: white;
                padding: 4px 8px;
                border-radius: 6px;
                font-size: 11px;
                opacity: 0;
                transform: translateY(-10px);
                transition: all 0.3s ease;
                z-index: 10;
            }
            
            .copy-feedback.show {
                opacity: 1;
                transform: translateY(0);
            }
            
            /* Responsive adjustments */
            @media (max-width: 768px) {
                .gist-button-container {
                    right: 15px;
                    bottom: 80px;
                }
                
                .make-gist-btn {
                    width: 52px;
                    height: 52px;
                }
                
                .gist-modal-content {
                    width: 95%;
                    max-height: 90vh;
                }
                
                .gist-message-bubble {
                    margin: 16px 12px;
                    padding: 16px 20px;
                }
            }
            
            @media (max-width: 480px) {
                .gist-button-container {
                    right: 10px;
                    bottom: 70px;
                }
                
                .make-gist-btn {
                    width: 48px;
                    height: 48px;
                }
                
                .make-gist-btn::before {
                    font-size: 20px;
                }
                
                .gist-modal-content {
                    border-radius: 20px;
                }
                
                .gist-modal-header,
                .gist-modal-body {
                    padding: 20px;
                }
                
                .gist-actions {
                    flex-direction: column;
                    gap: 8px;
                }
                
                .gist-cancel-btn,
                .gist-post-btn {
                    width: 100%;
                    text-align: center;
                }
            }
        `;
        
        document.head.appendChild(styles);
    }
    
    setupEventListeners() {
        // Listen for page load
        window.addEventListener('load', () => {
            setTimeout(() => this.checkAndAddGistButton(), 500);
        });
        
        // Listen for DOM changes using MutationObserver
        this.setupMutationObserver();
        
        // Keyboard shortcut for opening gist modal (Ctrl+Shift+G or Cmd+Shift+G)
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'G') {
                e.preventDefault();
                this.showGistModal();
            }
        });
    }
    
    setupMessageObserver() {
        // Set up a MutationObserver to watch for new messages
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    // Check for new message elements
                    const addedNodes = Array.from(mutation.addedNodes);
                    for (const node of addedNodes) {
                        if (node.nodeType === 1 && (node.classList?.contains('message-text') || 
                            node.classList?.contains('message-group') ||
                            node.querySelector?.('.message-text'))) {
                            this.processNewMessages();
                        }
                    }
                }
            }
        });
        
        // Start observing the messages container
        const messagesContainer = document.getElementById('messagesContainer');
        if (messagesContainer) {
            observer.observe(messagesContainer, {
                childList: true,
                subtree: true
            });
        }
        
        // Also observe the body for the container to appear
        const bodyObserver = new MutationObserver(() => {
            const container = document.getElementById('messagesContainer');
            if (container && !container.dataset.gistObserved) {
                container.dataset.gistObserved = 'true';
                observer.observe(container, {
                    childList: true,
                    subtree: true
                });
            }
        });
        
        bodyObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    observeURLChanges() {
        let lastUrl = window.location.href;
        
        // Check URL changes every 500ms
        setInterval(() => {
            const currentUrl = window.location.href;
            if (currentUrl !== lastUrl) {
                lastUrl = currentUrl;
                setTimeout(() => {
                    this.checkAndAddGistButton();
                    this.extractGroupIdFromURL();
                }, 300);
            }
        }, 500);
    }
    
    setupMutationObserver() {
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    // Check for message container or gist button
                    const addedNodes = Array.from(mutation.addedNodes);
                    for (const node of addedNodes) {
                        if (node.nodeType === 1) {
                            if (node.id === 'messagesContainer' || 
                                node.classList?.contains('message-input-container') ||
                                node.querySelector?.('#messageInput')) {
                                this.checkAndAddGistButton();
                                break;
                            }
                        }
                    }
                }
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    checkAndAddGistButton() {
        // Check if we're on group.html page
        const currentPath = window.location.pathname;
        const isGroupPage = currentPath.includes('group.html') || 
                           currentPath.includes('prepare.html') ||
                           (currentPath === '/' && window.location.search.includes('id='));
        
        if (!isGroupPage) {
            // Remove gist button if we're not on a group page
            this.removeGistButton();
            return;
        }
        
        // Check if gist button already exists
        if (document.getElementById('makeGistBtn')) {
            return;
        }
        
        // Try to extract group ID from URL
        this.extractGroupIdFromURL();
        
        // Create gist button
        this.createGistButton();
    }
    
    extractGroupIdFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        const groupId = urlParams.get('id');
        
        if (groupId && groupId !== this.currentGroupId) {
            this.currentGroupId = groupId;
            console.log('Gist System: Detected group ID:', groupId);
            
            // Clear processed messages for new group
            this.processedMessages.clear();
            this.gistMessageElements.clear();
            
            // Process existing messages
            this.processNewMessages();
        }
    }
    
    createGistButton() {
        // Remove existing button first
        this.removeGistButton();
        
        // Create button container
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'gist-button-container';
        
        // Create button
        const gistButton = document.createElement('button');
        gistButton.id = 'makeGistBtn';
        gistButton.className = 'make-gist-btn';
        gistButton.title = 'Make a Gist (Anonymous) - Ctrl+Shift+G';
        gistButton.innerHTML = `
            <span class="make-gist-btn-tooltip">💭 I Heard a Gist</span>
        `;
        
        buttonContainer.appendChild(gistButton);
        document.body.appendChild(buttonContainer);
        
        // Add event listener
        gistButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.showGistModal();
        });
        
        // Add tooltip on hover
        gistButton.addEventListener('mouseenter', () => {
            const tooltip = gistButton.querySelector('.make-gist-btn-tooltip');
            if (tooltip) {
                tooltip.style.display = 'block';
            }
        });
        
        gistButton.addEventListener('mouseleave', () => {
            const tooltip = gistButton.querySelector('.make-gist-btn-tooltip');
            if (tooltip) {
                tooltip.style.display = 'none';
            }
        });
        
        console.log('Gist System: Gist button added to page');
    }
    
    removeGistButton() {
        const buttonContainer = document.querySelector('.gist-button-container');
        if (buttonContainer) {
            buttonContainer.remove();
        }
    }
    
    showGistModal() {
        if (!this.currentGroupId) {
            this.extractGroupIdFromURL();
            
            if (!this.currentGroupId) {
                this.showErrorToast('Please join a group first to post a gist.');
                return;
            }
        }
        
        // Reset modal
        if (this.gistInput) {
            this.gistInput.value = '';
            this.gistInput.style.height = '120px';
            const charCount = this.gistModal.querySelector('.char-count');
            if (charCount) {
                charCount.textContent = '0/500';
                charCount.style.color = '#999';
            }
            const postBtn = this.gistModal.querySelector('.gist-post-btn');
            if (postBtn) postBtn.disabled = true;
        }
        
        // Show modal
        this.gistModal.classList.add('active');
        this.isGistModalOpen = true;
        
        // Prevent body scrolling
        document.body.style.overflow = 'hidden';
        
        setTimeout(() => {
            if (this.gistInput) {
                this.gistInput.focus();
            }
        }, 100);
    }
    
    hideGistModal() {
        this.gistModal.classList.remove('active');
        this.isGistModalOpen = false;
        
        // Restore body scrolling
        document.body.style.overflow = '';
        
        // Blur the input to hide keyboard on mobile
        if (this.gistInput) {
            this.gistInput.blur();
        }
    }
    
    async postGist() {
        if (!this.currentGroupId) {
            this.showErrorToast('No group selected. Please join a group first.');
            return;
        }
        
        const text = this.gistInput.value.trim();
        if (!text) {
            this.showErrorToast('Please enter a gist message.');
            return;
        }
        
        if (text.length > 500) {
            this.showErrorToast('Gist message is too long. Maximum 500 characters.');
            return;
        }
        
        const postBtn = this.gistModal.querySelector('.gist-post-btn');
        const originalText = postBtn.textContent;
        
        try {
            // Disable button and show loading
            postBtn.disabled = true;
            postBtn.innerHTML = `
                <span style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <span style="
                        width: 16px;
                        height: 16px;
                        border: 2px solid white;
                        border-top-color: transparent;
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                    "></span>
                    Posting...
                </span>
            `;
            
            // Add spinning animation
            const spinStyle = document.createElement('style');
            spinStyle.textContent = `
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(spinStyle);
            
            // Generate unique gist ID
            const timestamp = Date.now();
            const randomStr = Math.random().toString(36).substr(2, 6).toUpperCase();
            const gistId = `GIST-${randomStr}`;
            
            // Add metadata to help identify this as a gist
            const gistMetadata = {
                type: 'gist',
                isAnonymous: true,
                gistId: gistId,
                postedAt: new Date().toISOString(),
                characterCount: text.length,
                _gistSystem: true // Special flag for our system
            };
            
            // Send gist to Firebase
            const messagesRef = collection(this.db, 'groups', this.currentGroupId, 'messages');
            
            await addDoc(messagesRef, {
                type: 'gist',
                text: text,
                timestamp: serverTimestamp(),
                senderId: 'anonymous_gist_system',
                senderName: 'Anonymous',
                senderAvatar: '',
                isAnonymous: true,
                gistId: gistId,
                metadata: gistMetadata
            });
            
            // Close modal
            this.hideGistModal();
            
            // Show success message
            this.showGistSuccessToast();
            
            // Remove spinning style
            setTimeout(() => {
                if (spinStyle.parentNode) {
                    spinStyle.parentNode.removeChild(spinStyle);
                }
            }, 1000);
            
        } catch (error) {
            console.error('Gist System: Error posting gist:', error);
            this.showErrorToast('Failed to post gist. Please try again.');
            
            // Reset button
            postBtn.disabled = false;
            postBtn.textContent = originalText;
        }
    }
    
    processNewMessages() {
        const messagesContainer = document.getElementById('messagesContainer');
        if (!messagesContainer) return;
        
        // Find all message elements
        const messageElements = messagesContainer.querySelectorAll('.message-text, .message-group');
        
        messageElements.forEach((element) => {
            // Check if we've already processed this element
            const elementId = element.id || element.dataset.messageId;
            if (!elementId || this.processedMessages.has(elementId)) {
                return;
            }
            
            // Mark as processed
            this.processedMessages.add(elementId);
            
            // Check if this is a gist message
            const isGist = this.isGistMessage(element);
            
            if (isGist) {
                // Hide the original message
                element.style.display = 'none';
                element.classList.add('gist-message-hide');
                element.dataset.gistProcessed = 'true';
                
                // Create and insert gist bubble
                const gistBubble = this.createGistBubbleFromElement(element);
                if (gistBubble) {
                    // Insert after the original message or in the appropriate location
                    if (element.parentElement) {
                        element.parentElement.insertBefore(gistBubble, element.nextSibling);
                    }
                    
                    // Store reference
                    this.gistMessageElements.set(elementId, gistBubble);
                }
            }
        });
        
        // Also check for any anonymous sender messages
        this.checkForAnonymousMessages();
    }
    
    isGistMessage(element) {
        // Check multiple indicators that this is a gist message
        const text = element.textContent || '';
        const html = element.innerHTML || '';
        
        // Check for "Anonymous" sender
        const hasAnonymous = text.includes('Anonymous') || 
                            html.includes('Anonymous') ||
                            element.querySelector('.message-sender')?.textContent?.includes('Anonymous');
        
        // Check for gist ID in the message
        const hasGistId = text.match(/GIST-[A-Z0-9]+/) || 
                         text.match(/#[A-Z0-9]{6,}/);
        
        // Check for gist metadata
        const hasGistMetadata = element.dataset.isGist === 'true' ||
                               element.dataset.gistId ||
                               element.classList.contains('gist-message');
        
        // Check for senderId from our system
        const messageId = element.id || element.dataset.messageId;
        const isFromGistSystem = messageId && messageId.includes('gist') ||
                                element.querySelector('[data-sender-id="anonymous_gist_system"]');
        
        return hasAnonymous || hasGistId || hasGistMetadata || isFromGistSystem;
    }
    
    checkForAnonymousMessages() {
        // Also look for any messages with anonymous senders
        const messagesContainer = document.getElementById('messagesContainer');
        if (!messagesContainer) return;
        
        const senderElements = messagesContainer.querySelectorAll('.message-sender');
        
        senderElements.forEach((senderElement) => {
            if (senderElement.textContent.includes('Anonymous')) {
                const messageElement = senderElement.closest('.message-text, .message-group');
                if (messageElement && !messageElement.dataset.gistProcessed) {
                    messageElement.style.display = 'none';
                    messageElement.classList.add('gist-message-hide');
                    messageElement.dataset.gistProcessed = 'true';
                    
                    const gistBubble = this.createGistBubbleFromElement(messageElement);
                    if (gistBubble && messageElement.parentElement) {
                        messageElement.parentElement.insertBefore(gistBubble, messageElement.nextSibling);
                    }
                }
            }
        });
    }
    
    createGistBubbleFromElement(element) {
        // Extract message text
        let messageText = '';
        
        // Try to get text from different parts of the message
        const contentElement = element.querySelector('.message-content') || 
                              element.querySelector('.message-text') || 
                              element;
        
        // Remove sender info and timestamp from text
        messageText = contentElement.textContent || '';
        
        // Clean up the text
        messageText = messageText
            .replace(/Anonymous.*?(?=\n|$)/, '') // Remove "Anonymous" and anything after on same line
            .replace(/\d+[dhms] ago/g, '') // Remove timestamps like "2m ago"
            .replace(/#[A-Z0-9]+/g, '') // Remove gist IDs
            .trim();
        
        // If no text found, use a default
        if (!messageText) {
            messageText = 'Anonymous message';
        }
        
        // Extract gist ID
        let gistId = element.dataset.gistId || 
                    element.textContent.match(/GIST-[A-Z0-9]+/)?.[0] ||
                    element.textContent.match(/#([A-Z0-9]+)/)?.[1] ||
                    `GIST-${Date.now().toString().slice(-6)}`;
        
        // Clean gist ID
        gistId = gistId.replace('#', '').replace('GIST-', '').substring(0, 8);
        
        // Create gist bubble
        return this.createGistBubble(messageText, gistId);
    }
    
    createGistBubble(text, gistId) {
        const bubble = document.createElement('div');
        bubble.className = 'gist-message-bubble';
        bubble.dataset.gistBubble = 'true';
        
        const timestamp = new Date();
        const formattedTime = this.formatTime(timestamp);
        const shortGistId = gistId.length > 8 ? gistId.substring(0, 8) : gistId;
        
        bubble.innerHTML = `
            <div class="gist-header">
                <span class="gist-icon">💭</span>
                <span class="gist-title">I Heard a Gist</span>
            </div>
            <div class="gist-content">${this.escapeHtml(text)}</div>
            <div class="gist-footer">
                <span class="gist-time">${formattedTime}</span>
                <span class="gist-id">#${shortGistId}</span>
            </div>
            <div class="copy-feedback">Copied!</div>
        `;
        
        // Add click to copy functionality
        bubble.addEventListener('click', () => {
            navigator.clipboard.writeText(text).then(() => {
                const feedback = bubble.querySelector('.copy-feedback');
                feedback.classList.add('show');
                
                setTimeout(() => {
                    feedback.classList.remove('show');
                }, 2000);
            });
        });
        
        return bubble;
    }
    
    showGistSuccessToast() {
        const toast = document.createElement('div');
        toast.className = 'gist-success-toast';
        toast.innerHTML = `
            <div class="toast-content">
                <span class="toast-icon">💭</span>
                <span class="toast-message">Gist posted anonymously! Your secret is safe with us.</span>
            </div>
        `;
        
        document.body.appendChild(toast);
        
        // Add slide-out animation
        const slideOutStyle = document.createElement('style');
        slideOutStyle.textContent = `
            @keyframes toast-slide-out {
                from {
                    transform: translateX(0) scale(1);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%) scale(0.8);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(slideOutStyle);
        
        // Remove toast after 4 seconds
        setTimeout(() => {
            toast.style.animation = 'toast-slide-out 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards';
            
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
                if (slideOutStyle.parentNode) {
                    slideOutStyle.parentNode.removeChild(slideOutStyle);
                }
            }, 400);
        }, 4000);
    }
    
    showErrorToast(message) {
        const toast = document.createElement('div');
        toast.className = 'gist-success-toast';
        toast.style.background = 'linear-gradient(135deg, rgba(255, 107, 107, 0.95) 0%, rgba(255, 64, 129, 0.95) 100%)';
        toast.innerHTML = `
            <div class="toast-content">
                <span class="toast-icon">⚠️</span>
                <span class="toast-message">${message}</span>
            </div>
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'toast-slide-out 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards';
            
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 400);
        }, 3000);
    }
    
    formatTime(date) {
        if (!(date instanceof Date)) {
            date = new Date(date);
        }
        
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffDays > 0) {
            return `${diffDays}d ago`;
        } else if (diffHours > 0) {
            return `${diffHours}h ago`;
        } else if (diffMins > 0) {
            return `${diffMins}m ago`;
        } else {
            return 'just now';
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Cleanup function
    cleanup() {
        this.unsubscribeFunctions.gistMessages.forEach((unsub, groupId) => {
            if (unsub && typeof unsub === 'function') {
                try {
                    unsub();
                } catch (err) {
                    console.log('Gist System: Error unsubscribing:', err);
                }
            }
        });
        
        this.unsubscribeFunctions.allMessages.forEach((unsub, groupId) => {
            if (unsub && typeof unsub === 'function') {
                try {
                    unsub();
                } catch (err) {
                    console.log('Gist System: Error unsubscribing from all messages:', err);
                }
            }
        });
        
        this.unsubscribeFunctions.gistMessages.clear();
        this.unsubscribeFunctions.allMessages.clear();
        
        this.removeGistButton();
        
        if (this.gistModal && this.gistModal.parentNode) {
            this.gistModal.parentNode.removeChild(this.gistModal);
        }
        
        const styles = document.getElementById('gist-system-styles');
        if (styles && styles.parentNode) {
            styles.parentNode.removeChild(styles);
        }
    }
}

// Initialize the Gist System when the page loads
document.addEventListener('DOMContentLoaded', () => {
    // Wait a moment for other scripts to load
    setTimeout(() => {
        window.gistSystem = new GistSystem();
        console.log('💭 Gist System Initialized with Professional Design');
    }, 1000);
});

// Export for manual initialization if needed
export { GistSystem };