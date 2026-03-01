// notification.js - Complete file with nice notification sounds

// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    doc, 
    getDoc,
    updateDoc,
    deleteDoc,
    query, 
    where, 
    getDocs,
    addDoc,
    onSnapshot,
    orderBy,
    serverTimestamp,
    writeBatch
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyC9jF-ocy6HjsVzWVVlAyXW-4aIFgA79-A",
    authDomain: "crypto-6517d.firebaseapp.com",
    projectId: "crypto-6517d",
    storageBucket: "crypto-6517d.firebasestorage.app",
    messagingSenderId: "60263975159",
    appId: "1:60263975159:web:bd53dcaad86d6ed9592bf2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Global variables
let currentUser = null;
let unsubscribeNotifications = null;
let checkIntervals = [];
let dismissedNotifications = new Set();
let viewedPosts = new Set();
let unreadCount = 0;
let lastNotificationTime = 0;
let notificationShown = false;

// ==================== NOTIFICATION SOUNDS SYSTEM ====================

// Create notification sounds using Web Audio API for better compatibility
class NotificationSoundManager {
    constructor() {
        this.audioContext = null;
        this.soundsEnabled = true;
        this.soundVolume = 0.5; // 50% volume
        this.lastPlayed = 0;
        this.minPlayInterval = 1000; // Minimum 1 second between sounds
        
        // Try to load user preference
        this.loadUserPreferences();
        
        // Initialize audio context on user interaction (required by browsers)
        this.setupAudioContext();
    }
    
    setupAudioContext() {
        // Audio context must be created after user interaction
        document.addEventListener('click', () => {
            if (!this.audioContext) {
                try {
                    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                } catch (e) {
                    console.log('Web Audio API not supported');
                }
            }
        }, { once: true });
    }
    
    loadUserPreferences() {
        try {
            const savedPrefs = localStorage.getItem('notificationSoundPrefs');
            if (savedPrefs) {
                const prefs = JSON.parse(savedPrefs);
                this.soundsEnabled = prefs.enabled !== false;
                this.soundVolume = prefs.volume || 0.5;
            }
        } catch (e) {
            console.error('Error loading sound preferences:', e);
        }
    }
    
    saveUserPreferences() {
        try {
            localStorage.setItem('notificationSoundPrefs', JSON.stringify({
                enabled: this.soundsEnabled,
                volume: this.soundVolume
            }));
        } catch (e) {
            console.error('Error saving sound preferences:', e);
        }
    }
    
    toggleSounds() {
        this.soundsEnabled = !this.soundsEnabled;
        this.saveUserPreferences();
        return this.soundsEnabled;
    }
    
    setVolume(volume) {
        this.soundVolume = Math.max(0, Math.min(1, volume));
        this.saveUserPreferences();
    }
    
    // Play a gentle notification sound (soft bell)
    playSoftBell() {
        this.playSound('softBell');
    }
    
    // Play a gentle chime sound
    playGentleChime() {
        this.playSound('gentleChime');
    }
    
    // Play a soft ping sound
    playSoftPing() {
        this.playSound('softPing');
    }
    
    // Play a subtle pop sound
    playSubtlePop() {
        this.playSound('subtlePop');
    }
    
    // Play sound based on notification type
    playNotificationSound(type) {
        if (!this.soundsEnabled) return;
        
        // Rate limiting - don't play sounds too frequently
        const now = Date.now();
        if (now - this.lastPlayed < this.minPlayInterval) return;
        this.lastPlayed = now;
        
        switch(type) {
            case 'message':
            case 'group_message':
                this.playSoftPing(); // Soft ping for messages
                break;
            case 'like':
                this.playSubtlePop(); // Subtle pop for likes
                break;
            case 'post':
                this.playGentleChime(); // Gentle chime for posts
                break;
            case 'group_invite':
                this.playSoftBell(); // Soft bell for invites
                break;
            default:
                this.playSoftBell(); // Default sound
        }
    }
    
    // Main method to play sounds using Web Audio API
    playSound(soundType) {
        if (!this.soundsEnabled) return;
        if (!this.audioContext) {
            // Try to create audio context if not exists
            try {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {
                console.log('Web Audio API not supported');
                return;
            }
        }
        
        // Resume audio context if suspended
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        
        try {
            switch(soundType) {
                case 'softBell':
                    this.createSoftBellSound();
                    break;
                case 'gentleChime':
                    this.createGentleChimeSound();
                    break;
                case 'softPing':
                    this.createSoftPingSound();
                    break;
                case 'subtlePop':
                    this.createSubtlePopSound();
                    break;
            }
        } catch (e) {
            console.error('Error playing sound:', e);
        }
    }
    
    // Create soft bell sound
    createSoftBellSound() {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, this.audioContext.currentTime); // A5
        oscillator.frequency.exponentialRampToValueAtTime(440, this.audioContext.currentTime + 0.5); // A4
        
        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(this.soundVolume * 0.3, this.audioContext.currentTime + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.8);
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + 0.8);
    }
    
    // Create gentle chime sound
    createGentleChimeSound() {
        const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
        
        notes.forEach((freq, index) => {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.type = 'sine';
            oscillator.frequency.value = freq;
            
            const startTime = this.audioContext.currentTime + (index * 0.1);
            
            gainNode.gain.setValueAtTime(0, startTime);
            gainNode.gain.linearRampToValueAtTime(this.soundVolume * 0.2, startTime + 0.02);
            gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.4);
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.start(startTime);
            oscillator.stop(startTime + 0.4);
        });
    }
    
    // Create soft ping sound
    createSoftPingSound() {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(659.25, this.audioContext.currentTime); // E5
        oscillator.frequency.exponentialRampToValueAtTime(523.25, this.audioContext.currentTime + 0.2); // C5
        
        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(this.soundVolume * 0.25, this.audioContext.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + 0.3);
    }
    
    // Create subtle pop sound
    createSubtlePopSound() {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(330, this.audioContext.currentTime); // E4
        oscillator.frequency.exponentialRampToValueAtTime(220, this.audioContext.currentTime + 0.1); // A3
        
        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(this.soundVolume * 0.2, this.audioContext.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.15);
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + 0.15);
    }
}

// Create global sound manager instance
const soundManager = new NotificationSoundManager();

// ==================== END NOTIFICATION SOUNDS SYSTEM ====================

// Initialize notification system
function initNotificationSystem() {
    // Load dismissed notifications and viewed posts
    loadDismissedNotifications();
    
    // Wait for auth state
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            loadViewedPosts();
            
            setupNotificationListener();
            setupNotificationCreators();
            updateNotificationBadge();
            
            // Add sound control button to UI
            addSoundControlButton();
            
            // If on notification page, load notifications
            if (window.location.pathname.includes('notification.html')) {
                loadNotificationsForPage();
                setupMarkAllReadButton();
                addSoundSettingsToPage();
            }
            
            // Setup dropdown notifications if notification bell exists
            setupDropdownNotifications();
        } else {
            console.log('User not authenticated');
            currentUser = null;
            updateNotificationBadge(0);
            cleanupListeners();
            
            // If on notification page, show login message
            if (window.location.pathname.includes('notification.html')) {
                showLoginMessage();
            }
        }
    });
}

// Add sound control button to UI
function addSoundControlButton() {
    // Check if button already exists
    if (document.getElementById('notification-sound-toggle')) return;
    
    const notificationBells = document.querySelectorAll('.notification-bell, .notification-icon, [data-notification-dropdown]');
    
    notificationBells.forEach(bell => {
        // Create sound toggle button
        const soundBtn = document.createElement('button');
        soundBtn.id = 'notification-sound-toggle';
        soundBtn.className = 'sound-toggle-btn';
        soundBtn.innerHTML = soundManager.soundsEnabled ? 
            '<i class="fas fa-volume-up"></i>' : 
            '<i class="fas fa-volume-mute"></i>';
        soundBtn.title = soundManager.soundsEnabled ? 'Mute notification sounds' : 'Unmute notification sounds';
        
        // Add styles
        if (!document.getElementById('sound-toggle-styles')) {
            const styles = document.createElement('style');
            styles.id = 'sound-toggle-styles';
            styles.textContent = `
                .sound-toggle-btn {
                    background: var(--bg-card);
                    border: 1px solid var(--border-color);
                    border-radius: 50%;
                    width: 36px;
                    height: 36px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    color: var(--text-primary);
                    font-size: 16px;
                    margin-left: 10px;
                    transition: all 0.2s ease;
                }
                
                .sound-toggle-btn:hover {
                    background: var(--primary);
                    color: white;
                    transform: scale(1.1);
                }
                
                .sound-settings-panel {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    background: var(--bg-card);
                    border: 1px solid var(--border-color);
                    border-radius: 12px;
                    padding: 20px;
                    box-shadow: var(--shadow-lg);
                    z-index: 10002;
                    width: 250px;
                    animation: slideUp 0.3s ease;
                }
                
                .sound-settings-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 15px;
                }
                
                .sound-settings-header h4 {
                    margin: 0;
                    font-size: 16px;
                    color: var(--text-primary);
                }
                
                .sound-settings-close {
                    background: none;
                    border: none;
                    color: var(--text-secondary);
                    font-size: 18px;
                    cursor: pointer;
                }
                
                .sound-settings-option {
                    margin-bottom: 15px;
                }
                
                .sound-settings-option label {
                    display: block;
                    margin-bottom: 5px;
                    color: var(--text-secondary);
                    font-size: 13px;
                }
                
                .sound-settings-option input[type="range"] {
                    width: 100%;
                    height: 4px;
                    background: var(--border-color);
                    border-radius: 2px;
                    -webkit-appearance: none;
                }
                
                .sound-settings-option input[type="range"]::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    width: 16px;
                    height: 16px;
                    background: var(--primary);
                    border-radius: 50%;
                    cursor: pointer;
                }
                
                .sound-test-btn {
                    background: var(--bg-hover);
                    border: 1px solid var(--border-color);
                    border-radius: 6px;
                    padding: 8px 12px;
                    color: var(--text-primary);
                    cursor: pointer;
                    font-size: 13px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    width: 100%;
                    justify-content: center;
                    transition: all 0.2s ease;
                }
                
                .sound-test-btn:hover {
                    background: var(--primary);
                    color: white;
                }
                
                @keyframes slideUp {
                    from { transform: translateY(100%); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `;
            document.head.appendChild(styles);
        }
        
        // Add click handler
        soundBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showSoundSettings(soundBtn);
        });
        
        // Insert after notification bell
        bell.parentNode.insertBefore(soundBtn, bell.nextSibling);
    });
}

// Show sound settings panel
function showSoundSettings(triggerBtn) {
    // Remove existing panel
    const existingPanel = document.querySelector('.sound-settings-panel');
    if (existingPanel) {
        existingPanel.remove();
        return;
    }
    
    const panel = document.createElement('div');
    panel.className = 'sound-settings-panel';
    panel.innerHTML = `
        <div class="sound-settings-header">
            <h4>Notification Sounds</h4>
            <button class="sound-settings-close">&times;</button>
        </div>
        <div class="sound-settings-option">
            <label>
                <input type="checkbox" id="sound-enabled" ${soundManager.soundsEnabled ? 'checked' : ''}>
                Enable sounds
            </label>
        </div>
        <div class="sound-settings-option">
            <label>Volume</label>
            <input type="range" id="sound-volume" min="0" max="1" step="0.1" value="${soundManager.soundVolume}">
        </div>
        <button class="sound-test-btn" id="test-sound-btn">
            <i class="fas fa-play"></i> Test Sound
        </button>
    `;
    
    document.body.appendChild(panel);
    
    // Position panel near the button
    const btnRect = triggerBtn.getBoundingClientRect();
    panel.style.bottom = (window.innerHeight - btnRect.top + 10) + 'px';
    panel.style.right = (window.innerWidth - btnRect.right) + 'px';
    
    // Add event listeners
    panel.querySelector('.sound-settings-close').addEventListener('click', () => {
        panel.remove();
    });
    
    const enabledCheckbox = panel.querySelector('#sound-enabled');
    enabledCheckbox.addEventListener('change', (e) => {
        soundManager.toggleSounds();
        triggerBtn.innerHTML = soundManager.soundsEnabled ? 
            '<i class="fas fa-volume-up"></i>' : 
            '<i class="fas fa-volume-mute"></i>';
        triggerBtn.title = soundManager.soundsEnabled ? 'Mute notification sounds' : 'Unmute notification sounds';
    });
    
    const volumeSlider = panel.querySelector('#sound-volume');
    volumeSlider.addEventListener('input', (e) => {
        soundManager.setVolume(parseFloat(e.target.value));
    });
    
    panel.querySelector('#test-sound-btn').addEventListener('click', () => {
        soundManager.playSoftBell();
    });
    
    // Close when clicking outside
    setTimeout(() => {
        document.addEventListener('click', function closePanel(e) {
            if (!panel.contains(e.target) && e.target !== triggerBtn && !triggerBtn.contains(e.target)) {
                panel.remove();
                document.removeEventListener('click', closePanel);
            }
        });
    }, 100);
}

// Add sound settings to notification page
function addSoundSettingsToPage() {
    const header = document.querySelector('.notifications-header');
    if (header) {
        const soundSettingsBtn = document.createElement('button');
        soundSettingsBtn.className = 'sound-settings-page-btn';
        soundSettingsBtn.innerHTML = '<i class="fas fa-music"></i> Sound Settings';
        
        soundSettingsBtn.addEventListener('click', () => {
            addSoundSettingsToPage();
        });
        
        header.appendChild(soundSettingsBtn);
        
        // Add styles
        if (!document.getElementById('sound-page-styles')) {
            const styles = document.createElement('style');
            styles.id = 'sound-page-styles';
            styles.textContent = `
                .sound-settings-page-btn {
                    background: var(--bg-card);
                    color: var(--text-primary);
                    border: 1px solid var(--border-color);
                    border-radius: 8px;
                    padding: 10px 20px;
                    font-size: 14px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    transition: all 0.2s ease;
                    margin-left: 10px;
                }
                
                .sound-settings-page-btn:hover {
                    background: var(--primary);
                    color: white;
                    border-color: var(--primary);
                }
            `;
            document.head.appendChild(styles);
        }
    }
}

// Setup dropdown notification functionality
function setupDropdownNotifications() {
    const notificationBells = document.querySelectorAll('.notification-bell, .notification-icon, [data-notification-dropdown]');
    
    notificationBells.forEach(bell => {
        bell.addEventListener('click', async (e) => {
            e.stopPropagation();
            toggleDropdownNotifications();
        });
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('notification-dropdown');
        if (dropdown && !dropdown.contains(e.target)) {
            const bells = document.querySelectorAll('.notification-bell, .notification-icon, [data-notification-dropdown]');
            let isBell = false;
            bells.forEach(bell => {
                if (bell.contains(e.target)) isBell = true;
            });
            if (!isBell) {
                dropdown.style.display = 'none';
            }
        }
    });
}

// Toggle dropdown notifications
async function toggleDropdownNotifications() {
    let dropdown = document.getElementById('notification-dropdown');
    
    if (!dropdown) {
        dropdown = createDropdownElement();
        document.body.appendChild(dropdown);
    }
    
    if (dropdown.style.display === 'block') {
        dropdown.style.display = 'none';
    } else {
        dropdown.style.display = 'block';
        await loadDropdownNotifications();
    }
}

// Create dropdown element
function createDropdownElement() {
    const dropdown = document.createElement('div');
    dropdown.id = 'notification-dropdown';
    dropdown.className = 'notification-dropdown';
    dropdown.innerHTML = `
        <div class="dropdown-header">
            <h3>Notifications</h3>
            <button class="mark-all-read-btn" title="Mark all as read">
                <i class="fas fa-check-double"></i> Mark all
            </button>
        </div>
        <div class="dropdown-content" id="dropdown-notifications">
            <div class="loading-notifications">
                <i class="fas fa-spinner fa-spin"></i>
                <span>Loading notifications...</span>
            </div>
        </div>
        <div class="dropdown-footer">
            <a href="notification.html" class="view-all-btn">View all notifications</a>
        </div>
    `;
    
    // Add styles if not already added
    if (!document.getElementById('notification-dropdown-styles')) {
        const styles = document.createElement('style');
        styles.id = 'notification-dropdown-styles';
        styles.textContent = `
            .notification-dropdown {
                position: fixed;
                top: 70px;
                right: 20px;
                width: 400px;
                max-height: 500px;
                background: var(--bg-card);
                border: 1px solid var(--border-color);
                border-radius: 12px;
                box-shadow: var(--shadow-lg);
                z-index: 10000;
                display: none;
                overflow: hidden;
                font-family: 'Inter', sans-serif;
            }
            
            .dropdown-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 15px 20px;
                border-bottom: 1px solid var(--border-color);
                background: var(--bg-primary);
            }
            
            .dropdown-header h3 {
                margin: 0;
                font-size: 16px;
                font-weight: 600;
                color: var(--text-primary);
            }
            
            .mark-all-read-btn {
                background: var(--primary);
                color: var(--text-primary);
                border: none;
                border-radius: 6px;
                padding: 6px 12px;
                font-size: 12px;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 5px;
                transition: all 0.2s ease;
            }
            
            .mark-all-read-btn:hover {
                background: var(--primary-dark);
                transform: translateY(-1px);
            }
            
            .dropdown-content {
                max-height: 400px;
                overflow-y: auto;
            }
            
            .dropdown-notification-item {
                padding: 15px 20px;
                border-bottom: 1px solid var(--border-color);
                cursor: pointer;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                gap: 12px;
            }
            
            .dropdown-notification-item:hover {
                background: var(--bg-hover);
            }
            
            .dropdown-notification-item.unread {
                background: rgba(179, 0, 75, 0.05);
            }
            
            .dropdown-notification-icon {
                width: 36px;
                height: 36px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                font-size: 14px;
            }
            
            .dropdown-notification-content {
                flex: 1;
                min-width: 0;
            }
            
            .dropdown-notification-title {
                font-weight: 500;
                font-size: 14px;
                color: var(--text-primary);
                margin-bottom: 2px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .dropdown-notification-text {
                font-size: 13px;
                color: var(--text-secondary);
                line-height: 1.3;
                margin-bottom: 4px;
            }
            
            .dropdown-notification-time {
                font-size: 11px;
                color: var(--text-light);
            }
            
            .unread-indicator {
                width: 8px;
                height: 8px;
                background: var(--primary);
                border-radius: 50%;
                margin-left: 5px;
            }
            
            .dropdown-footer {
                padding: 15px 20px;
                text-align: center;
                border-top: 1px solid var(--border-color);
                background: var(--bg-primary);
            }
            
            .view-all-btn {
                color: var(--primary);
                text-decoration: none;
                font-size: 14px;
                font-weight: 500;
                display: block;
                padding: 8px;
                border-radius: 6px;
                transition: all 0.2s ease;
            }
            
            .view-all-btn:hover {
                background: rgba(179, 0, 75, 0.1);
            }
            
            .loading-notifications {
                padding: 30px;
                text-align: center;
                color: var(--text-secondary);
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 10px;
            }
            
            .empty-notifications {
                padding: 40px 20px;
                text-align: center;
                color: var(--text-secondary);
            }
            
            .empty-notifications i {
                font-size: 48px;
                margin-bottom: 15px;
                color: var(--border-color);
            }
            
            @media (max-width: 768px) {
                .notification-dropdown {
                    width: calc(100% - 40px);
                    right: 10px;
                    left: 10px;
                }
            }
        `;
        document.head.appendChild(styles);
    }
    
    // Add event listeners
    dropdown.querySelector('.mark-all-read-btn').addEventListener('click', markAllNotificationsAsRead);
    
    return dropdown;
}

// Load notifications for dropdown
async function loadDropdownNotifications() {
    if (!currentUser) return;
    
    const dropdownContent = document.getElementById('dropdown-notifications');
    if (!dropdownContent) return;
    
    try {
        const notificationsQuery = query(
            collection(db, 'notifications'),
            where('userId', '==', currentUser.uid)
        );
        
        const notificationsSnap = await getDocs(notificationsQuery);
        
        if (notificationsSnap.empty) {
            dropdownContent.innerHTML = `
                <div class="empty-notifications">
                    <i class="fas fa-bell-slash"></i>
                    <p>No notifications yet</p>
                </div>
            `;
            return;
        }
        
        // Sort by timestamp
        const sortedNotifications = notificationsSnap.docs.sort((a, b) => {
            const timeA = a.data().timestamp?.toDate?.() || new Date(0);
            const timeB = b.data().timestamp?.toDate?.() || new Date(0);
            return timeB - timeA;
        }).slice(0, 10); // Show only 10 most recent
        
        let html = '';
        
        sortedNotifications.forEach(doc => {
            const notification = doc.data();
            const timeAgo = formatTime(notification.timestamp);
            const iconClass = getNotificationIcon(notification.type);
            const unreadClass = notification.read ? '' : 'unread';
            
            html += `
                <div class="dropdown-notification-item ${unreadClass}" data-id="${doc.id}">
                    <div class="dropdown-notification-icon ${notification.type}">
                        <i class="${iconClass}"></i>
                    </div>
                    <div class="dropdown-notification-content">
                        <div class="dropdown-notification-title">
                            ${notification.title}
                            ${!notification.read ? '<span class="unread-indicator"></span>' : ''}
                        </div>
                        <div class="dropdown-notification-text">${notification.message}</div>
                        <div class="dropdown-notification-time">${timeAgo}</div>
                    </div>
                </div>
            `;
        });
        
        dropdownContent.innerHTML = html;
        
        // Add click handlers
        document.querySelectorAll('.dropdown-notification-item').forEach(item => {
            item.addEventListener('click', async (e) => {
                e.stopPropagation();
                const notificationId = item.dataset.id;
                await handleNotificationClick(notificationId);
                
                // Close dropdown
                const dropdown = document.getElementById('notification-dropdown');
                if (dropdown) {
                    dropdown.style.display = 'none';
                }
            });
        });
        
    } catch (error) {
        console.error('Error loading dropdown notifications:', error);
        dropdownContent.innerHTML = `
            <div class="empty-notifications">
                <i class="fas fa-exclamation-circle"></i>
                <p>Error loading notifications</p>
            </div>
        `;
    }
}

// Handle notification click
async function handleNotificationClick(notificationId) {
    // Mark as read
    await markNotificationAsRead(notificationId);
    
    // Get notification data to determine where to navigate
    try {
        const notificationDoc = await getDoc(doc(db, 'notifications', notificationId));
        if (notificationDoc.exists()) {
            const notification = notificationDoc.data();
            
            // Navigate based on notification type
            if (notification.type === 'message' && notification.senderId) {
                window.location.href = `chat.html?id=${notification.senderId}`;
            } else if (notification.type === 'group_message' && notification.groupId) {
                window.location.href = `group.html?id=${notification.groupId}`;
            } else if (notification.type === 'group_invite' && notification.groupId) {
                window.location.href = `group.html?id=${notification.groupId}`;
            } else if (notification.type === 'post' && notification.senderId) {
                window.location.href = 'posts.html';
                // Mark post as viewed
                viewedPosts.add(notification.relatedId);
                saveViewedPosts();
                dismissedNotifications.add(`post_${notification.relatedId}`);
                saveDismissedNotifications();
            } else if (notification.senderId) {
                window.location.href = `profile.html?id=${notification.senderId}`;
            } else {
                window.location.href = 'notification.html';
            }
        }
    } catch (error) {
        console.error('Error getting notification:', error);
        window.location.href = 'notification.html';
    }
}

// Setup mark all read button for notification page
function setupMarkAllReadButton() {
    const markAllReadBtn = document.getElementById('markAllReadBtn');
    if (!markAllReadBtn) {
        // Create button if it doesn't exist
        const header = document.querySelector('.notifications-header');
        if (header) {
            const button = document.createElement('button');
            button.id = 'markAllReadBtn';
            button.className = 'mark-all-read-page-btn';
            button.innerHTML = '<i class="fas fa-check-double"></i> Mark All as Read';
            header.appendChild(button);
            
            // Add styles
            if (!document.getElementById('mark-all-read-styles')) {
                const styles = document.createElement('style');
                styles.id = 'mark-all-read-styles';
                styles.textContent = `
                    .mark-all-read-page-btn {
                        background: var(--primary);
                        color: var(--text-primary);
                        border: none;
                        border-radius: 8px;
                        padding: 10px 20px;
                        font-size: 14px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        transition: all 0.2s ease;
                    }
                    
                    .mark-all-read-page-btn:hover {
                        background: var(--primary-dark);
                        transform: translateY(-2px);
                        box-shadow: var(--shadow-md);
                    }
                    
                    .notifications-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 20px;
                    }
                `;
                document.head.appendChild(styles);
            }
            
            button.addEventListener('click', markAllNotificationsAsRead);
        }
    } else {
        markAllReadBtn.addEventListener('click', markAllNotificationsAsRead);
    }
}

// Mark all notifications as read
async function markAllNotificationsAsRead() {
    if (!currentUser) return;
    
    try {
        const notificationsQuery = query(
            collection(db, 'notifications'),
            where('userId', '==', currentUser.uid),
            where('read', '==', false)
        );
        
        const notificationsSnap = await getDocs(notificationsQuery);
        const batch = writeBatch(db);
        
        notificationsSnap.docs.forEach(doc => {
            batch.update(doc.ref, {
                read: true,
                readAt: serverTimestamp()
            });
        });
        
        await batch.commit();
        
        // Update UI
        document.querySelectorAll('.notification-item.unread').forEach(item => {
            item.classList.remove('unread');
            const unreadDot = item.querySelector('.unread-dot');
            if (unreadDot) unreadDot.remove();
            const markReadBtn = item.querySelector('.mark-read-btn');
            if (markReadBtn) markReadBtn.remove();
        });
        
        // Update dropdown if open
        const dropdown = document.getElementById('notification-dropdown');
        if (dropdown && dropdown.style.display === 'block') {
            await loadDropdownNotifications();
        }
        
        updateNotificationBadge(0);
        
        // Close any open notification popup
        const popup = document.querySelector('.notification-popup');
        if (popup) {
            popup.remove();
        }
        
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
    }
}

// Show notification popup (with sound)
function showNotificationPopup() {
    // Don't show if already showing or on notification page
    if (notificationShown || window.location.pathname.includes('notification.html')) {
        return;
    }
    
    // Don't show if no unread notifications
    if (unreadCount === 0) {
        return;
    }
    
    // Play notification sound
    soundManager.playSoftBell();
    
    // Remove any existing popup
    const existingPopup = document.querySelector('.notification-popup');
    if (existingPopup) {
        existingPopup.remove();
    }
    
    const popup = document.createElement('div');
    popup.className = 'notification-popup';
    popup.innerHTML = `
        <div class="popup-content">
            <div class="popup-icon">
                <i class="fas fa-bell"></i>
            </div>
            <div class="popup-text">
                <div class="popup-title">You have new notifications</div>
                <div class="popup-message">${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}</div>
            </div>
            <button class="popup-mark-btn">
                <i class="fas fa-check"></i> Mark
            </button>
            <button class="popup-close">&times;</button>
        </div>
    `;
    
    // Add styles if not already added
    if (!document.getElementById('notification-popup-styles')) {
        const styles = document.createElement('style');
        styles.id = 'notification-popup-styles';
        styles.textContent = `
            .notification-popup {
                position: fixed;
                top: 20px;
                right: 20px;
                background: linear-gradient(135deg, var(--primary), var(--primary-dark));
                border-radius: 12px;
                box-shadow: var(--shadow-lg);
                z-index: 10001;
                animation: slideInRight 0.4s ease forwards;
                color: white;
                font-family: 'Inter', sans-serif;
                overflow: hidden;
                min-width: 300px;
            }
            
            .popup-content {
                display: flex;
                align-items: center;
                padding: 15px;
                gap: 12px;
            }
            
            .popup-icon {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 18px;
                background: rgba(255, 255, 255, 0.2);
                flex-shrink: 0;
            }
            
            .popup-text {
                flex: 1;
                min-width: 0;
            }
            
            .popup-title {
                font-weight: 600;
                font-size: 14px;
                margin-bottom: 2px;
            }
            
            .popup-message {
                font-size: 13px;
                opacity: 0.9;
            }
            
            .popup-mark-btn {
                background: rgba(255, 255, 255, 0.2);
                color: white;
                border: none;
                border-radius: 6px;
                padding: 6px 12px;
                font-size: 12px;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 5px;
                transition: all 0.2s ease;
                flex-shrink: 0;
            }
            
            .popup-mark-btn:hover {
                background: rgba(255, 255, 255, 0.3);
                transform: translateY(-1px);
            }
            
            .popup-close {
                background: rgba(255, 255, 255, 0.2);
                border: none;
                border-radius: 50%;
                font-size: 16px;
                cursor: pointer;
                color: white;
                padding: 0;
                width: 28px;
                height: 28px;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                transition: all 0.2s ease;
            }
            
            .popup-close:hover {
                background: rgba(255, 255, 255, 0.3);
            }
            
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            
            @keyframes slideOutRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            
            .notification-popup.hiding {
                animation: slideOutRight 0.3s ease forwards;
            }
            
            @media (max-width: 768px) {
                .notification-popup {
                    left: 20px;
                    right: 20px;
                    min-width: auto;
                }
            }
        `;
        document.head.appendChild(styles);
    }
    
    document.body.appendChild(popup);
    notificationShown = true;
    
    // Auto-dismiss after 5 seconds
    const autoDismiss = setTimeout(() => {
        hideNotificationPopup(popup);
    }, 5000);
    
    // Mark button
    popup.querySelector('.popup-mark-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        markAllNotificationsAsRead();
        hideNotificationPopup(popup);
    });
    
    // Close button
    popup.querySelector('.popup-close').addEventListener('click', (e) => {
        e.stopPropagation();
        hideNotificationPopup(popup);
    });
    
    // Click to go to notifications
    popup.addEventListener('click', (e) => {
        if (!e.target.closest('.popup-mark-btn') && !e.target.closest('.popup-close')) {
            window.location.href = 'notification.html';
            hideNotificationPopup(popup);
        }
    });
    
    function hideNotificationPopup(popupElement) {
        popupElement.classList.add('hiding');
        setTimeout(() => {
            if (popupElement.parentNode) {
                popupElement.parentNode.removeChild(popupElement);
            }
            notificationShown = false;
        }, 300);
        clearTimeout(autoDismiss);
    }
}

// Load dismissed notifications from localStorage
function loadDismissedNotifications() {
    try {
        const stored = localStorage.getItem('dismissedNotifications');
        if (stored) {
            const dismissed = JSON.parse(stored);
            dismissed.forEach(id => dismissedNotifications.add(id));
        }
    } catch (error) {
        console.error('Error loading dismissed notifications:', error);
    }
}

// Load viewed posts from localStorage
function loadViewedPosts() {
    if (!currentUser) return;
    try {
        const stored = localStorage.getItem(`viewedPosts_${currentUser.uid}`);
        if (stored) {
            viewedPosts = new Set(JSON.parse(stored));
        }
    } catch (error) {
        console.error('Error loading viewed posts:', error);
    }
}

// Save dismissed notifications to localStorage
function saveDismissedNotifications() {
    try {
        localStorage.setItem('dismissedNotifications', JSON.stringify(Array.from(dismissedNotifications)));
    } catch (error) {
        console.error('Error saving dismissed notifications:', error);
    }
}

// Save viewed posts to localStorage
function saveViewedPosts() {
    if (!currentUser) return;
    try {
        localStorage.setItem(`viewedPosts_${currentUser.uid}`, JSON.stringify(Array.from(viewedPosts)));
    } catch (error) {
        console.error('Error saving viewed posts:', error);
    }
}

// Load notifications for notification.html page
async function loadNotificationsForPage() {
    if (!currentUser) return;

    try {
        const notificationsQuery = query(
            collection(db, 'notifications'),
            where('userId', '==', currentUser.uid)
        );

        const notificationsSnap = await getDocs(notificationsQuery);
        
        // Sort by timestamp in memory (no index needed)
        const sortedNotifications = notificationsSnap.docs.sort((a, b) => {
            const timeA = a.data().timestamp?.toDate?.() || new Date(0);
            const timeB = b.data().timestamp?.toDate?.() || new Date(0);
            return timeB - timeA; // Descending order
        });
        
        displayNotifications(sortedNotifications);
    } catch (error) {
        console.error('Error loading notifications:', error);
        const notificationsList = document.getElementById('notificationsList');
        if (notificationsList) {
            notificationsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-circle"></i>
                    <h3>Error loading notifications</h3>
                    <p>Please try refreshing the page.</p>
                </div>
            `;
        }
    }
}

// Display notifications in notification.html
function displayNotifications(notificationDocs) {
    const notificationsList = document.getElementById('notificationsList');
    if (!notificationsList) return;

    if (notificationDocs.length === 0) {
        notificationsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-bell-slash"></i>
                <h3>No notifications yet</h3>
                <p>When you receive notifications, they will appear here.</p>
            </div>
        `;
        return;
    }

    const notificationsHTML = notificationDocs.map(doc => {
        const notification = doc.data();
        const timeAgo = formatTime(notification.timestamp);
        const iconClass = getNotificationIcon(notification.type);
        const unreadClass = notification.read ? '' : 'unread';
        const unreadDot = notification.read ? '' : '<div class="unread-dot"></div>';
        
        return `
            <div class="notification-item ${unreadClass}" data-id="${doc.id}">
                <div class="notification-icon ${notification.type}">
                    <i class="${iconClass}"></i>
                </div>
                <div class="notification-content">
                    <div class="notification-title">
                        ${notification.title}
                        ${unreadDot}
                    </div>
                    <div class="notification-text">${notification.message}</div>
                    <div class="notification-time">${timeAgo}</div>
                </div>
                <div class="notification-actions">
                    ${!notification.read ? `
                        <button class="action-btn mark-read-btn" title="Mark as read">
                            <i class="fas fa-check"></i>
                        </button>
                    ` : ''}
                    <button class="action-btn delete-btn" title="Delete notification">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    notificationsList.innerHTML = notificationsHTML;
    addNotificationActionListeners();
}

// Add event listeners to notification actions
function addNotificationActionListeners() {
    // Mark as read buttons
    document.querySelectorAll('.mark-read-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const notificationItem = button.closest('.notification-item');
            const notificationId = notificationItem.dataset.id;
            markNotificationAsRead(notificationId);
        });
    });

    // Delete buttons
    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const notificationItem = button.closest('.notification-item');
            const notificationId = notificationItem.dataset.id;
            deleteNotification(notificationId);
        });
    });

    // Notification item click
    document.querySelectorAll('.notification-item').forEach(item => {
        item.addEventListener('click', () => {
            const notificationId = item.dataset.id;
            handleNotificationClick(notificationId);
        });
    });
}

// Mark notification as read
async function markNotificationAsRead(notificationId) {
    if (!currentUser) return;

    try {
        await updateDoc(doc(db, 'notifications', notificationId), {
            read: true,
            readAt: serverTimestamp()
        });
        
        // Update UI
        const notificationItem = document.querySelector(`[data-id="${notificationId}"]`);
        if (notificationItem) {
            notificationItem.classList.remove('unread');
            const unreadDot = notificationItem.querySelector('.unread-dot');
            if (unreadDot) unreadDot.remove();
            const markReadBtn = notificationItem.querySelector('.mark-read-btn');
            if (markReadBtn) markReadBtn.remove();
        }
        
        updateNotificationBadge();
    } catch (error) {
        console.error('Error marking notification as read:', error);
    }
}

// Delete notification
async function deleteNotification(notificationId) {
    if (!currentUser) return;

    try {
        await deleteDoc(doc(db, 'notifications', notificationId));
        
        // Remove from UI
        const notificationItem = document.querySelector(`[data-id="${notificationId}"]`);
        if (notificationItem) {
            notificationItem.style.opacity = '0.5';
            setTimeout(() => notificationItem.remove(), 300);
        }
        
        updateNotificationBadge();
    } catch (error) {
        console.error('Error deleting notification:', error);
    }
}

// Show login message
function showLoginMessage() {
    const notificationsList = document.getElementById('notificationsList');
    if (notificationsList) {
        notificationsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-sign-in-alt"></i>
                <h3>Please log in</h3>
                <p>You need to be logged in to view notifications.</p>
                <a href="login.html" class="btn btn-primary" style="margin-top: 15px;">Log In</a>
            </div>
        `;
    }
}

// Setup notification creators (messages, likes, posts, and groups)
function setupNotificationCreators() {
    if (!currentUser) return;

    // Clear any existing intervals
    checkIntervals.forEach(interval => clearInterval(interval));
    checkIntervals = [];

    // Check for new messages every 30 seconds
    const messageInterval = setInterval(() => {
        checkForNewMessages();
    }, 30000);
    checkIntervals.push(messageInterval);

    // Check for new likes every 30 seconds
    const likeInterval = setInterval(() => {
        checkForNewLikes();
    }, 30000);
    checkIntervals.push(likeInterval);

    // Check for new posts every 30 seconds
    const postInterval = setInterval(() => {
        checkForNewPosts();
    }, 30000);
    checkIntervals.push(postInterval);

    // Check for group notifications every 30 seconds
    const groupInterval = setInterval(() => {
        checkForGroupNotifications();
    }, 30000);
    checkIntervals.push(groupInterval);

    // Initial checks
    checkForNewMessages();
    checkForNewLikes();
    checkForNewPosts();
    checkForGroupNotifications();
}

// Check for group-related notifications
async function checkForGroupNotifications() {
    if (!currentUser) return;

    try {
        // Check for new group messages
        await checkForNewGroupMessages();
        
        // Check for group invites
        await checkForGroupInvites();
        
        // Check for group member events
        await checkForGroupMemberEvents();
        
        // Check for admin notifications
        await checkForAdminNotifications();

    } catch (error) {
        console.error('Error checking group notifications:', error);
    }
}

// Check for new group messages
async function checkForNewGroupMessages() {
    if (!currentUser) return;

    try {
        // Get all groups the user is a member of
        const groupsQuery = query(
            collection(db, 'groups')
        );
        const groupsSnap = await getDocs(groupsQuery);

        for (const groupDoc of groupsSnap.docs) {
            const group = groupDoc.data();
            const groupId = groupDoc.id;
            
            // Check if user is a member
            const memberRef = doc(db, 'groups', groupId, 'members', currentUser.uid);
            const memberSnap = await getDoc(memberRef);
            
            if (!memberSnap.exists()) continue;

            // Get last message time from localStorage
            const lastMessageKey = `lastGroupMessage_${groupId}_${currentUser.uid}`;
            const lastMessageTime = localStorage.getItem(lastMessageKey) || 0;

            // Get recent messages
            const messagesRef = collection(db, 'groups', groupId, 'messages');
            const messagesQuery = query(
                messagesRef,
                orderBy('timestamp', 'desc')
            );
            const messagesSnap = await getDocs(messagesQuery);
            
            for (const messageDoc of messagesSnap.docs) {
                const message = messageDoc.data();
                const messageTime = message.timestamp?.toDate?.()?.getTime() || new Date(message.timestamp).getTime();
                
                // Skip if message is from current user
                if (message.senderId === currentUser.uid) continue;
                
                // Skip if message is older than last checked time
                if (messageTime <= lastMessageTime) break;
                
                // Create notification for new message
                await createGroupMessageNotification(groupId, group.name, message, messageDoc.id);
                
                // Update last message time
                localStorage.setItem(lastMessageKey, messageTime.toString());
                break; // Only create one notification per check
            }
        }
    } catch (error) {
        console.error('Error checking group messages:', error);
    }
}

// Create group message notification
async function createGroupMessageNotification(groupId, groupName, message, messageId) {
    try {
        const existing = await checkExistingNotification('group_message', messageId, message.senderId);
        if (existing) return;

        const senderDoc = await getDoc(doc(db, 'group_users', message.senderId));
        const senderName = senderDoc.exists() ? senderDoc.data().displayName : 'Someone';

        const messageText = message.text ? 
            (message.text.length > 50 ? message.text.substring(0, 50) + '...' : message.text) : 
            (message.imageUrl ? 'sent a photo' : message.videoUrl ? 'sent a video' : 'sent a message');

        await addDoc(collection(db, 'notifications'), {
            type: 'group_message',
            title: `New Message in ${groupName}`,
            message: `${senderName}: ${messageText}`,
            senderId: message.senderId,
            senderName: senderName,
            relatedId: messageId,
            groupId: groupId,
            groupName: groupName,
            userId: currentUser.uid,
            timestamp: serverTimestamp(),
            read: false
        });

    } catch (error) {
        console.error('Error creating group message notification:', error);
    }
}

// Check for group invites
async function checkForGroupInvites() {
    if (!currentUser) return;

    try {
        // Check if user was recently added to any groups
        const groupsQuery = query(
            collection(db, 'groups')
        );
        const groupsSnap = await getDocs(groupsQuery);

        for (const groupDoc of groupsSnap.docs) {
            const group = groupDoc.data();
            const groupId = groupDoc.id;
            
            // Check if user is a member
            const memberRef = doc(db, 'groups', groupId, 'members', currentUser.uid);
            const memberSnap = await getDoc(memberRef);
            
            if (!memberSnap.exists()) continue;

            // Check join time
            const joinTime = memberSnap.data().joinedAt?.toDate?.()?.getTime() || 0;
            const now = Date.now();
            
            // If joined within the last 5 minutes, create notification
            if ((now - joinTime) < 5 * 60 * 1000) {
                const notificationKey = `group_join_${groupId}_${currentUser.uid}`;
                if (!localStorage.getItem(notificationKey)) {
                    await createGroupInviteNotification(groupId, group.name);
                    localStorage.setItem(notificationKey, 'true');
                }
            }
        }
    } catch (error) {
        console.error('Error checking group invites:', error);
    }
}

// Create group invite notification
async function createGroupInviteNotification(groupId, groupName) {
    try {
        await addDoc(collection(db, 'notifications'), {
            type: 'group_invite',
            title: 'Joined New Group',
            message: `You have joined the group "${groupName}"`,
            groupId: groupId,
            groupName: groupName,
            userId: currentUser.uid,
            timestamp: serverTimestamp(),
            read: false
        });
    } catch (error) {
        console.error('Error creating group invite notification:', error);
    }
}

// Check for group member events (member added, removed, etc.)
async function checkForGroupMemberEvents() {
    if (!currentUser) return;

    try {
        // Check for member removal notifications
        const removalQuery = query(
            collection(db, 'notifications'),
            where('userId', '==', currentUser.uid),
            where('type', '==', 'group_member_removed')
        );
        const removalSnap = await getDocs(removalQuery);
        
        // Already handled by the existing notification system from group.js
        // We just need to ensure they appear in the notification list
        
    } catch (error) {
        console.error('Error checking group member events:', error);
    }
}

// Check for admin notifications (when user is admin of a group)
async function checkForAdminNotifications() {
    if (!currentUser) return;

    try {
        // Get groups where user is admin
        const groupsQuery = query(
            collection(db, 'groups'),
            where('createdBy', '==', currentUser.uid)
        );
        const groupsSnap = await getDocs(groupsQuery);

        for (const groupDoc of groupsSnap.docs) {
            const group = groupDoc.data();
            const groupId = groupDoc.id;
            
            // Check for new join requests (if implementing request system)
            // Check for reported messages (if implementing report system)
            // These would be additional features to implement
        }
    } catch (error) {
        console.error('Error checking admin notifications:', error);
    }
}

// Check for new messages (existing function)
async function checkForNewMessages() {
    if (!currentUser) return;

    try {
        const threadsQuery = query(
            collection(db, 'conversations'),
            where('participants', 'array-contains', currentUser.uid)
        );

        const threadsSnap = await getDocs(threadsQuery);

        for (const threadDoc of threadsSnap.docs) {
            const thread = threadDoc.data();
            const partnerId = thread.participants.find(id => id !== currentUser.uid);
            
            if (partnerId) {
                // Get all messages and filter in memory
                const messagesQuery = collection(db, 'conversations', threadDoc.id, 'messages');
                const messagesSnap = await getDocs(messagesQuery);

                for (const messageDoc of messagesSnap.docs) {
                    const message = messageDoc.data();
                    // Check if message is from partner and unread
                    if (message.senderId === partnerId && !message.read) {
                        await createMessageNotification(messageDoc.id, partnerId, message);
                        break; // Only create one notification per conversation
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error checking messages:', error);
    }
}

// Create message notification (existing function)
async function createMessageNotification(messageId, partnerId, message) {
    try {
        const existing = await checkExistingNotification('message', messageId, partnerId);
        if (existing) return;

        const senderDoc = await getDoc(doc(db, 'users', partnerId));
        if (!senderDoc.exists()) return;

        const senderData = senderDoc.data();
        const messageText = message.text ? 
            (message.text.length > 50 ? message.text.substring(0, 50) + '...' : message.text) : 
            'sent you a photo/video';

        await addDoc(collection(db, 'notifications'), {
            type: 'message',
            title: 'New Message',
            message: `${senderData.name || 'Someone'} ${messageText}`,
            senderId: partnerId,
            senderName: senderData.name || 'Someone',
            relatedId: messageId,
            userId: currentUser.uid,
            timestamp: serverTimestamp(),
            read: false
        });

    } catch (error) {
        console.error('Error creating message notification:', error);
    }
}

// Check for new likes (existing function)
async function checkForNewLikes() {
    if (!currentUser) return;

    try {
        const likesQuery = collection(db, 'users', currentUser.uid, 'likes');
        const likesSnap = await getDocs(likesQuery);

        for (const likeDoc of likesSnap.docs) {
            const likeData = likeDoc.data();
            await createLikeNotification(likeDoc.id, likeData.userId);
        }
    } catch (error) {
        console.error('Error checking likes:', error);
    }
}

// Create like notification (existing function)
async function createLikeNotification(likeId, likerId) {
    try {
        const existing = await checkExistingNotification('like', likeId, likerId);
        if (existing) return;

        const likerDoc = await getDoc(doc(db, 'users', likerId));
        if (!likerDoc.exists()) return;

        const likerData = likerDoc.data();

        await addDoc(collection(db, 'notifications'), {
            type: 'like',
            title: 'New Like',
            message: `${likerData.name || 'Someone'} liked your profile`,
            senderId: likerId,
            senderName: likerData.name || 'Someone',
            relatedId: likeId,
            userId: currentUser.uid,
            timestamp: serverTimestamp(),
            read: false
        });

    } catch (error) {
        console.error('Error creating like notification:', error);
    }
}

// Check for new posts (existing function)
async function checkForNewPosts() {
    if (!currentUser) return;

    try {
        const postsQuery = collection(db, 'posts');
        const postsSnap = await getDocs(postsQuery);

        for (const postDoc of postsSnap.docs) {
            const post = postDoc.data();
            const postId = postDoc.id;
            
            // Skip if post is from current user or already viewed
            if (post.userId === currentUser.uid || viewedPosts.has(postId)) {
                continue;
            }

            // Skip if this notification was already dismissed
            if (dismissedNotifications.has(`post_${postId}`)) {
                continue;
            }

            // Check if user is not on posts page
            const currentPage = window.location.pathname.split('/').pop().split('.')[0];
            
            if (currentPage !== 'posts') {
                await createPostNotification(postId, post);
            }
        }
    } catch (error) {
        console.error('Error checking posts:', error);
    }
}

// Create post notification (existing function)
async function createPostNotification(postId, post) {
    try {
        const existing = await checkExistingNotification('post', postId, post.userId);
        if (existing) return;

        const authorDoc = await getDoc(doc(db, 'users', post.userId));
        if (!authorDoc.exists()) return;

        const authorData = authorDoc.data();
        const postText = post.caption ? 
            (post.caption.length > 50 ? post.caption.substring(0, 50) + '...' : post.caption) : 
            'created a new post';

        await addDoc(collection(db, 'notifications'), {
            type: 'post',
            title: 'New Post',
            message: `${authorData.name || 'Someone'} ${postText}`,
            senderId: post.userId,
            senderName: authorData.name || 'Someone',
            relatedId: postId,
            userId: currentUser.uid,
            timestamp: serverTimestamp(),
            read: false
        });

    } catch (error) {
        console.error('Error creating post notification:', error);
    }
}

// Check if notification already exists
async function checkExistingNotification(type, relatedId, senderId = null) {
    try {
        const notificationsQuery = query(
            collection(db, 'notifications'),
            where('userId', '==', currentUser.uid)
        );

        const notificationsSnap = await getDocs(notificationsQuery);

        // Filter in memory
        return notificationsSnap.docs.some(doc => {
            const data = doc.data();
            return data.type === type && 
                   data.relatedId === relatedId && 
                   (senderId === null || data.senderId === senderId);
        });
    } catch (error) {
        console.error('Error checking existing notification:', error);
        return false;
    }
}

// Setup notification listener (with sound for new notifications)
function setupNotificationListener() {
    if (!currentUser) return;

    if (unsubscribeNotifications) {
        unsubscribeNotifications();
    }

    try {
        const notificationsQuery = query(
            collection(db, 'notifications'),
            where('userId', '==', currentUser.uid)
        );

        unsubscribeNotifications = onSnapshot(notificationsQuery, (snapshot) => {
            // Filter unread and sort by timestamp in memory
            const allNotifications = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            const unreadNotifications = allNotifications.filter(notification => !notification.read);
            const sortedNotifications = allNotifications.sort((a, b) => {
                const timeA = a.timestamp?.toDate?.() || new Date(0);
                const timeB = b.timestamp?.toDate?.() || new Date(0);
                return timeB - timeA;
            });
            
            const previousUnreadCount = unreadCount;
            unreadCount = unreadNotifications.length;
            
            updateNotificationBadge(unreadCount);
            localStorage.setItem(`notification_count_${currentUser.uid}`, unreadCount);
            
            // Play sound for new notifications
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const notification = change.doc.data();
                    if (!notification.read) {
                        // Play notification sound based on type
                        soundManager.playNotificationSound(notification.type);
                    }
                }
            });
            
            // Reload notifications if on notification page
            if (window.location.pathname.includes('notification.html')) {
                displayNotifications(sortedNotifications.map((notification, index) => ({
                    id: notification.id,
                    data: () => notification
                })));
            }
            
            // Update dropdown if open
            const dropdown = document.getElementById('notification-dropdown');
            if (dropdown && dropdown.style.display === 'block') {
                loadDropdownNotifications();
            }
            
            // Show popup for new notifications (but not too frequently)
            if (!window.location.pathname.includes('notification.html')) {
                const now = Date.now();
                if (unreadCount > previousUnreadCount && now - lastNotificationTime > 5000) {
                    showNotificationPopup();
                    lastNotificationTime = now;
                }
            }
        }, (error) => {
            console.error('Notification listener error:', error);
            const cachedCount = localStorage.getItem(`notification_count_${currentUser.uid}`) || 0;
            updateNotificationBadge(parseInt(cachedCount));
        });

    } catch (error) {
        console.error('Error setting up notification listener:', error);
        const cachedCount = localStorage.getItem(`notification_count_${currentUser.uid}`) || 0;
        updateNotificationBadge(parseInt(cachedCount));
    }
}

// Update notification badge
function updateNotificationBadge(count) {
    if (count === undefined) {
        count = localStorage.getItem(`notification_count_${currentUser ? currentUser.uid : 'anonymous'}`) || 0;
        count = parseInt(count);
    }

    unreadCount = count;

    const badges = document.querySelectorAll('.notification-badge');
    badges.forEach(badge => {
        if (count > 0) {
            badge.textContent = count > 99 ? '99+' : count;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    });
}

// Get notification icon
function getNotificationIcon(type) {
    switch (type) {
        case 'message': return 'fas fa-comment-alt';
        case 'like': return 'fas fa-heart';
        case 'post': return 'fas fa-newspaper';
        case 'group_message': return 'fas fa-users';
        case 'group_invite': return 'fas fa-user-plus';
        case 'group_member_removed': return 'fas fa-user-minus';
        case 'group_deleted': return 'fas fa-trash-alt';
        default: return 'fas fa-bell';
    }
}

// Format time
function formatTime(timestamp) {
    if (!timestamp) return '';
    
    let date;
    try {
        if (timestamp.toDate) {
            date = timestamp.toDate();
        } else if (typeof timestamp === 'string') {
            date = new Date(timestamp);
        } else {
            return '';
        }
        
        if (isNaN(date.getTime())) return '';
    } catch (error) {
        return '';
    }
    
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

// Clean up listeners
function cleanupListeners() {
    if (unsubscribeNotifications) unsubscribeNotifications();
    checkIntervals.forEach(interval => clearInterval(interval));
    checkIntervals = [];
}

// Auto-initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNotificationSystem);
} else {
    initNotificationSystem();
}

// Export functions for external use
window.NotificationSystem = {
    init: initNotificationSystem,
    updateBadge: updateNotificationBadge,
    getUnreadCount: () => {
        return localStorage.getItem(`notification_count_${currentUser ? currentUser.uid : 'anonymous'}`) || 0;
    },
    markPostAsViewed: (postId) => {
        viewedPosts.add(postId);
        saveViewedPosts();
        dismissedNotifications.add(`post_${postId}`);
        saveDismissedNotifications();
    },
    createGroupNotification: async (type, title, message, groupId, groupName, relatedId = null) => {
        if (!currentUser) return;
        
        try {
            await addDoc(collection(db, 'notifications'), {
                type: type,
                title: title,
                message: message,
                groupId: groupId,
                groupName: groupName,
                relatedId: relatedId,
                userId: currentUser.uid,
                timestamp: serverTimestamp(),
                read: false
            });
        } catch (error) {
            console.error('Error creating group notification:', error);
        }
    },
    showDropdown: toggleDropdownNotifications,
    markAllRead: markAllNotificationsAsRead,
    // Sound control methods
    soundManager: soundManager,
    toggleSounds: () => soundManager.toggleSounds(),
    setSoundVolume: (volume) => soundManager.setVolume(volume),
    testSound: () => soundManager.playSoftBell()
};