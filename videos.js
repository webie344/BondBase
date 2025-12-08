// video.js - Completely independent video refresh handler
class VideoRefreshHandler {
    constructor() {
        this.videoStates = new Map();
        this.originalFunctions = new Map();
        this.init();
    }

    init() {
        console.log('Independent Video Refresh Handler initialized');
        this.interceptDOMChanges();
        this.interceptFirestoreUpdates();
        this.setupGlobalProtection();
    }

    interceptDOMChanges() {
        // Override innerHTML for chat messages container
        this.overrideInnerHTML();
        
        // Override textContent for chat messages container
        this.overrideTextContent();
        
        // Observe DOM changes
        this.setupMutationObserver();
        
        // Initialize existing videos
        setTimeout(() => this.initializeExistingVideos(), 1000);
    }

    overrideInnerHTML() {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) {
            setTimeout(() => this.overrideInnerHTML(), 500);
            return;
        }

        const originalInnerHTML = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML').set;
        
        Object.defineProperty(chatMessages, 'innerHTML', {
            set: function(value) {
                // Save video states before any DOM changes
                window.videoRefreshHandler?.saveAllVideoStates();
                return originalInnerHTML.call(this, value);
            }
        });
    }

    overrideTextContent() {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) {
            setTimeout(() => this.overrideTextContent(), 500);
            return;
        }

        const originalTextContent = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent').set;
        
        Object.defineProperty(chatMessages, 'textContent', {
            set: function(value) {
                window.videoRefreshHandler?.saveAllVideoStates();
                return originalTextContent.call(this, value);
            }
        });
    }

    setupMutationObserver() {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) {
            setTimeout(() => this.setupMutationObserver(), 500);
            return;
        }

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    // Save states before changes
                    this.saveAllVideoStates();
                    
                    // Handle removed videos
                    mutation.removedNodes.forEach((node) => {
                        if (node.nodeType === 1) {
                            this.handleRemovedVideos(node);
                        }
                    });
                    
                    // Handle added videos after a short delay
                    setTimeout(() => {
                        mutation.addedNodes.forEach((node) => {
                            if (node.nodeType === 1) {
                                this.handleAddedVideos(node);
                            }
                        });
                        this.initializeNewVideos();
                        this.restoreAllVideoStates();
                    }, 100);
                }
            });
        });

        observer.observe(chatMessages, {
            childList: true,
            subtree: true
        });
    }

    interceptFirestoreUpdates() {
        // Intercept onSnapshot calls to detect Firestore updates
        this.interceptOnSnapshot();
        
        // Interset addDoc calls for new messages
        this.interceptAddDoc();
    }

    interceptOnSnapshot() {
        if (window.firestore && window.firestore.onSnapshot) {
            const originalOnSnapshot = window.firestore.onSnapshot;
            window.firestore.onSnapshot = (...args) => {
                this.saveAllVideoStates();
                setTimeout(() => this.restoreAllVideoStates(), 200);
                return originalOnSnapshot(...args);
            };
        }

        // Also try to intercept the global onSnapshot if it exists
        if (window.onSnapshot) {
            const originalGlobalOnSnapshot = window.onSnapshot;
            window.onSnapshot = (...args) => {
                this.saveAllVideoStates();
                setTimeout(() => this.restoreAllVideoStates(), 200);
                return originalGlobalOnSnapshot(...args);
            };
        }
    }

    interceptAddDoc() {
        if (window.firestore && window.firestore.addDoc) {
            const originalAddDoc = window.firestore.addDoc;
            window.firestore.addDoc = (...args) => {
                this.saveAllVideoStates();
                const result = originalAddDoc(...args);
                setTimeout(() => this.restoreAllVideoStates(), 300);
                return result;
            };
        }
    }

    setupGlobalProtection() {
        // Save states periodically
        setInterval(() => this.saveAllVideoStates(), 2000);
        
        // Save on visibility change
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.saveAllVideoStates();
            } else {
                setTimeout(() => this.restoreAllVideoStates(), 500);
            }
        });
        
        // Save before unload
        window.addEventListener('beforeunload', () => this.saveAllVideoStates());
        
        // Restore on load
        window.addEventListener('load', () => {
            setTimeout(() => this.restoreAllVideoStates(), 1000);
        });
    }

    handleRemovedVideos(node) {
        const videos = node.querySelectorAll?.('video') || [];
        videos.forEach(video => {
            const messageId = this.getMessageId(video);
            if (messageId) {
                this.saveVideoState(video, messageId);
            }
        });
        
        if (node.tagName === 'VIDEO') {
            const messageId = this.getMessageId(node);
            if (messageId) {
                this.saveVideoState(node, messageId);
            }
        }
    }

    handleAddedVideos(node) {
        const videos = node.querySelectorAll?.('video') || [];
        videos.forEach(video => {
            this.initializeVideo(video);
        });
        
        if (node.tagName === 'VIDEO') {
            this.initializeVideo(node);
        }
    }

    initializeExistingVideos() {
        const videos = document.querySelectorAll('#chatMessages video');
        videos.forEach(video => {
            this.initializeVideo(video);
        });
        this.restoreAllVideoStates();
    }

    initializeNewVideos() {
        const videos = document.querySelectorAll('#chatMessages video:not([data-video-initialized])');
        videos.forEach(video => {
            this.initializeVideo(video);
        });
    }

    initializeVideo(videoElement) {
        const messageId = this.getMessageId(videoElement);
        if (!messageId) return;

        videoElement.dataset.videoInitialized = 'true';
        this.restoreVideoState(videoElement, messageId);
        
        // Add event listeners to save state on interaction
        this.addVideoEventListeners(videoElement, messageId);
    }

    addVideoEventListeners(videoElement, messageId) {
        const saveState = () => {
            this.saveVideoState(videoElement, messageId);
        };

        const events = ['play', 'pause', 'seeked', 'volumechange', 'ratechange', 'timeupdate', 'ended'];
        events.forEach(event => {
            videoElement.addEventListener(event, saveState, { passive: true });
        });
    }

    getMessageId(videoElement) {
        const messageElement = videoElement.closest('.message');
        return messageElement?.dataset?.messageId;
    }

    saveVideoState(videoElement, messageId) {
        if (!videoElement || !messageId) return;

        const state = {
            currentTime: videoElement.currentTime,
            paused: videoElement.paused,
            volume: videoElement.volume,
            playbackRate: videoElement.playbackRate,
            duration: videoElement.duration,
            timestamp: Date.now()
        };

        this.videoStates.set(messageId, state);
        
        // Use both sessionStorage and localStorage for redundancy
        try {
            sessionStorage.setItem(`video_${messageId}`, JSON.stringify(state));
            localStorage.setItem(`video_${messageId}`, JSON.stringify(state));
        } catch (e) {
            console.warn('Could not save video state to storage');
        }
    }

    saveAllVideoStates() {
        const videos = document.querySelectorAll('#chatMessages video[data-video-initialized]');
        videos.forEach(video => {
            const messageId = this.getMessageId(video);
            if (messageId) {
                this.saveVideoState(video, messageId);
            }
        });
    }

    restoreVideoState(videoElement, messageId) {
        if (!videoElement || !messageId) return;

        // Try memory first
        let state = this.videoStates.get(messageId);
        
        // Then try sessionStorage
        if (!state) {
            try {
                const stored = sessionStorage.getItem(`video_${messageId}`);
                state = stored ? JSON.parse(stored) : null;
            } catch (e) {}
        }
        
        // Then try localStorage
        if (!state) {
            try {
                const stored = localStorage.getItem(`video_${messageId}`);
                state = stored ? JSON.parse(stored) : null;
            } catch (e) {}
        }

        if (state && state.currentTime !== undefined) {
            // Only restore if it makes sense (not NaN, within duration)
            if (!isNaN(state.currentTime) && state.currentTime >= 0) {
                if (!videoElement.duration || state.currentTime < videoElement.duration) {
                    videoElement.currentTime = state.currentTime;
                }
            }
            
            if (state.volume !== undefined) videoElement.volume = state.volume;
            if (state.playbackRate !== undefined) videoElement.playbackRate = state.playbackRate;
        }
    }

    restoreAllVideoStates() {
        const videos = document.querySelectorAll('#chatMessages video[data-video-initialized]');
        videos.forEach(video => {
            const messageId = this.getMessageId(video);
            if (messageId) {
                this.restoreVideoState(video, messageId);
            }
        });
    }

    // Public API
    forceSave() {
        this.saveAllVideoStates();
    }

    forceRestore() {
        this.restoreAllVideoStates();
    }

    cleanup() {
        this.saveAllVideoStates();
        this.videoStates.clear();
    }
}

// Auto-initialize
if (typeof window !== 'undefined') {
    window.videoRefreshHandler = new VideoRefreshHandler();
    
    // Global helper functions
    window.saveVideoStates = () => window.videoRefreshHandler.forceSave();
    window.restoreVideoStates = () => window.videoRefreshHandler.forceRestore();
}

console.log('Video refresh protection loaded');