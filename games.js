// games.js - Complete Gamer Profile Management System with Intro Animations
// Firebase configuration
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    setDoc, 
    getDoc, 
    updateDoc,
    collection,
    query,
    where,
    getDocs,
    serverTimestamp,
    addDoc,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyC9uL_BX14Z6rRpgG4MT9Tca1opJl8EviQ",
    authDomain: "dating-connect.firebaseapp.com",
    projectId: "dating-connect",
    storageBucket: "dating-connect.appspot.com",
    messagingSenderId: "1062172180210",
    appId: "1:1062172180210:web:0c9b3c1578a5dbae58da6b"
};

// Initialize Firebase
let app, auth, db;
try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    console.log('Firebase initialized successfully');
} catch (error) {
    console.error('Firebase initialization error:', error);
}

// Cloudinary configuration
const cloudinaryConfig = {
    cloudName: "ddtdqrh1b",
    uploadPreset: "profile-pictures",
    apiUrl: "https://api.cloudinary.com/v1_1"
};

// Global variables
let currentUser = null;
let currentProfileId = null;
let selectedIntro = null;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initGamerSystem();
});

async function initGamerSystem() {
    try {
        console.log('Initializing gamer system...');
        
        // Check which page we're on
        const currentPage = window.location.pathname.split('/').pop().split('.')[0];
        console.log('Initializing on page:', currentPage);
        
        // For pages that require Firebase auth
        if (currentPage === 'account' || currentPage === 'profile' || currentPage === 'intro') {
            if (!auth) {
                showError('Authentication service unavailable. Please refresh.');
                return;
            }
            
            // Set up auth state listener for authenticated pages
            onAuthStateChanged(auth, (user) => {
                if (user) {
                    currentUser = user;
                    console.log('User authenticated:', user.uid);
                    
                    // Get current profile ID from URL (for profile.html)
                    const urlParams = new URLSearchParams(window.location.search);
                    currentProfileId = urlParams.get('id');
                    
                    switch(currentPage) {
                        case 'account':
                            initAccountPageGamerProfile();
                            break;
                        case 'profile':
                            initProfilePageGamerDisplay();
                            break;
                        case 'intro':
                            initIntroSelectionPage();
                            break;
                    }
                } else {
                    currentUser = null;
                    console.log('No user logged in');
                    
                    // Redirect to login for authenticated pages
                    if (currentPage === 'account' || currentPage === 'intro') {
                        window.location.href = 'login.html';
                    }
                }
            }, (error) => {
                console.error('Auth state error:', error);
                showError('Authentication error. Please refresh.');
            });
        } else if (currentPage === 'gamersprofile') {
            // Public profile page - doesn't require auth
            initGamersProfilePage();
        } else {
            console.log('Gamer system not needed on this page');
        }
        
    } catch (error) {
        console.error('Error initializing gamer system:', error);
        showError('System initialization failed. Please refresh.');
    }
}

// ========== INTRO SELECTION PAGE FUNCTIONS ==========
function initIntroSelectionPage() {
    if (!db) {
        showError('Database service unavailable. Please refresh.');
        return;
    }
    
    console.log('Initializing intro selection page');
    
    if (!currentUser) {
        showError('Please log in to choose an intro.');
        return;
    }
    
    // Setup event listeners for intro selection
    setupIntroSelectionListeners();
}

function setupIntroSelectionListeners() {
    // Intro card selection
    const introCards = document.querySelectorAll('.intro-card');
    introCards.forEach(card => {
        card.addEventListener('click', (e) => {
            if (!e.target.classList.contains('preview-btn')) {
                selectIntro(card);
            }
        });
    });

    // Preview buttons
    const previewBtns = document.querySelectorAll('.preview-btn');
    previewBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const introType = btn.dataset.preview;
            showPreview(introType);
        });
    });

    // Continue button
    const continueBtn = document.getElementById('continue-btn');
    if (continueBtn) {
        continueBtn.addEventListener('click', saveIntroSelection);
    }

    // Close preview
    const closePreview = document.querySelector('.close-preview');
    const previewOverlay = document.getElementById('previewOverlay');
    
    if (closePreview && previewOverlay) {
        closePreview.addEventListener('click', () => {
            previewOverlay.style.display = 'none';
        });

        previewOverlay.addEventListener('click', (e) => {
            if (e.target === previewOverlay) {
                previewOverlay.style.display = 'none';
            }
        });
    }
}

function selectIntro(card) {
    // Remove active class from all cards
    document.querySelectorAll('.intro-card').forEach(c => {
        c.classList.remove('active');
    });

    // Add active class to selected card
    card.classList.add('active');
    
    // Set selected intro
    selectedIntro = card.dataset.intro;
    
    // Update UI
    const introText = document.getElementById('selected-intro-text');
    const introName = card.querySelector('h3').textContent;
    if (introText) {
        introText.textContent = `Selected: ${introName}`;
    }
    
    // Enable continue button
    const continueBtn = document.getElementById('continue-btn');
    if (continueBtn) {
        continueBtn.disabled = false;
    }
}

function showPreview(introType) {
    const previewContainer = document.getElementById('previewContainer');
    const previewOverlay = document.getElementById('previewOverlay');
    
    if (!previewContainer || !previewOverlay) return;
    
    // Create preview based on intro type
    let previewHTML = '';
    
    switch(introType) {
        case 'hero':
            previewHTML = createHeroPreview();
            break;
        case 'glitch':
            previewHTML = createGlitchPreview();
            break;
        case 'portal':
            previewHTML = createPortalPreview();
            break;
        case 'rank':
            previewHTML = createRankPreview();
            break;
        case 'minimal':
            previewHTML = createMinimalPreview();
            break;
    }
    
    previewContainer.innerHTML = previewHTML;
    previewOverlay.style.display = 'flex';
    
    // Start the preview animation
    setTimeout(() => {
        startPreviewAnimation(introType);
    }, 100);
}

function createHeroPreview() {
    return `
        <div class="hero-preview">
            <div class="preview-stage">
                <div class="dark-screen"></div>
                <div class="glitch-text">LOADING PROFILE...</div>
                <div class="username">GHOST_WARRIOR</div>
                <div class="avatar-placeholder"></div>
                <div class="light-burst"></div>
                <div class="rank-display">DIAMOND II</div>
                <div class="enter-text">ENTERING ARENA...</div>
            </div>
            <div class="preview-info">
                <h3><i class="fas fa-fire"></i> Hero Reveal Preview</h3>
                <p>Dark screen → Glitch text → Username reveals → Avatar slides in with light burst → Rank displays</p>
            </div>
        </div>
        <style>
            .hero-preview { max-width: 600px; margin: 0 auto; }
            .preview-stage {
                position: relative;
                height: 300px;
                background: #050510;
                border-radius: 10px;
                overflow: hidden;
                margin-bottom: 1rem;
            }
            .dark-screen { 
                position: absolute;
                width: 100%;
                height: 100%;
                background: #000;
            }
            .glitch-text {
                position: absolute;
                top: 30%;
                left: 50%;
                transform: translateX(-50%);
                color: #ff2a6d;
                font-family: monospace;
                font-size: 1.2rem;
                opacity: 0;
            }
            .username {
                position: absolute;
                top: 40%;
                left: 50%;
                transform: translateX(-50%);
                color: white;
                font-size: 2rem;
                font-weight: bold;
                opacity: 0;
            }
            .avatar-placeholder {
                position: absolute;
                top: 50%;
                left: -100px;
                width: 80px;
                height: 80px;
                background: linear-gradient(45deg, #ff2a6d, #00ff88);
                border-radius: 50%;
                opacity: 0;
            }
            .light-burst {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 200px;
                height: 200px;
                background: radial-gradient(circle, rgba(255,255,255,0.8) 0%, transparent 70%);
                opacity: 0;
            }
            .rank-display {
                position: absolute;
                top: 70%;
                left: 50%;
                transform: translateX(-50%);
                color: #FFD700;
                font-size: 1.2rem;
                font-weight: bold;
                opacity: 0;
            }
            .enter-text {
                position: absolute;
                bottom: 20%;
                left: 50%;
                transform: translateX(-50%);
                color: #00ff88;
                font-size: 1.5rem;
                opacity: 0;
            }
        </style>
    `;
}

function createGlitchPreview() {
    return `
        <div class="glitch-preview">
            <div class="preview-stage">
                <div class="screen-flicker"></div>
                <div class="scan-lines"></div>
                <div class="scrambled-text">GH0ST_W4RR10R</div>
                <div class="resolved-text">GHOST_WARRIOR</div>
                <div class="rank-badge">[DIAMOND II]</div>
                <div class="glitch-effect"></div>
            </div>
            <div class="preview-info">
                <h3><i class="fas fa-bolt"></i> Glitch Hacker Preview</h3>
                <p>Screen flickers → Scan lines → Scrambled text resolves → Rank badge appears → Digital whoosh effect</p>
            </div>
        </div>
        <style>
            .glitch-preview { max-width: 600px; margin: 0 auto; }
            .preview-stage {
                position: relative;
                height: 300px;
                background: #0a0a1a;
                border-radius: 10px;
                overflow: hidden;
                margin-bottom: 1rem;
            }
            .screen-flicker {
                position: absolute;
                width: 100%;
                height: 100%;
                background: rgba(0, 243, 255, 0.1);
                opacity: 0;
            }
            .scan-lines {
                position: absolute;
                width: 100%;
                height: 100%;
                background: repeating-linear-gradient(
                    0deg,
                    transparent,
                    transparent 2px,
                    rgba(0, 243, 255, 0.1) 2px,
                    rgba(0, 243, 255, 0.1) 4px
                );
                opacity: 0;
            }
            .scrambled-text {
                position: absolute;
                top: 40%;
                left: 50%;
                transform: translate(-50%, -50%);
                color: #00f3ff;
                font-family: monospace;
                font-size: 2rem;
                opacity: 0;
            }
            .resolved-text {
                position: absolute;
                top: 40%;
                left: 50%;
                transform: translate(-50%, -50%);
                color: white;
                font-size: 2rem;
                font-weight: bold;
                opacity: 0;
            }
            .rank-badge {
                position: absolute;
                top: 55%;
                left: 50%;
                transform: translateX(-50%);
                color: #00ff88;
                font-family: monospace;
                font-size: 1.2rem;
                opacity: 0;
            }
            .glitch-effect {
                position: absolute;
                width: 100%;
                height: 100%;
                background: linear-gradient(
                    45deg,
                    transparent 49%,
                    rgba(0, 243, 255, 0.2) 50%,
                    transparent 51%
                );
                opacity: 0;
            }
        </style>
    `;
}

function createPortalPreview() {
    return `
        <div class="portal-preview">
            <div class="preview-stage">
                <div class="space-bg"></div>
                <div class="portal-ring"></div>
                <div class="avatar-emerge"></div>
                <div class="name-fade">GHOST_WARRIOR</div>
                <div class="rank-portal">⚔️ DIAMOND II</div>
                <div class="portal-collapse"></div>
            </div>
            <div class="preview-info">
                <h3><i class="fas fa-ring"></i> Portal Teleport Preview</h3>
                <p>Portal opens → Avatar emerges → Name fades in → Rank appears → Portal collapses</p>
            </div>
        </div>
        <style>
            .portal-preview { max-width: 600px; margin: 0 auto; }
            .preview-stage {
                position: relative;
                height: 300px;
                background: #050510;
                border-radius: 10px;
                overflow: hidden;
                margin-bottom: 1rem;
            }
            .space-bg {
                position: absolute;
                width: 100%;
                height: 100%;
                background: radial-gradient(circle at center, #0a0a2a 0%, #000 100%);
            }
            .portal-ring {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 0;
                height: 0;
                border: 2px solid #9d00ff;
                border-radius: 50%;
                opacity: 0;
            }
            .avatar-emerge {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 60px;
                height: 60px;
                background: linear-gradient(45deg, #ff2a6d, #00ff88);
                border-radius: 50%;
                opacity: 0;
            }
            .name-fade {
                position: absolute;
                top: 60%;
                left: 50%;
                transform: translateX(-50%);
                color: white;
                font-size: 1.5rem;
                opacity: 0;
            }
            .rank-portal {
                position: absolute;
                top: 70%;
                left: 50%;
                transform: translateX(-50%);
                color: #9d00ff;
                font-size: 1.2rem;
                font-weight: bold;
                opacity: 0;
            }
            .portal-collapse {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 100px;
                height: 100px;
                border: 2px solid #9d00ff;
                border-radius: 50%;
                opacity: 0;
            }
        </style>
    `;
}

function createRankPreview() {
    return `
        <div class="rank-preview">
            <div class="preview-stage">
                <div class="rank-badge">DIAMOND II</div>
                <div class="badge-slam"></div>
                <div class="camera-shake"></div>
                <div class="gamer-tag">GHOST_WARRIOR</div>
                <div class="profile-fade"></div>
            </div>
            <div class="preview-info">
                <h3><i class="fas fa-trophy"></i> Rank Flex Preview</h3>
                <p>Rank badge slams in → Camera shake → Gamer tag appears → Profile fades in → Establish dominance</p>
            </div>
        </div>
        <style>
            .rank-preview { max-width: 600px; margin: 0 auto; }
            .preview-stage {
                position: relative;
                height: 300px;
                background: #1a1a2e;
                border-radius: 10px;
                overflow: hidden;
                margin-bottom: 1rem;
            }
            .rank-badge {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                color: #FFD700;
                font-size: 3rem;
                font-weight: bold;
                opacity: 0;
            }
            .badge-slam {
                position: absolute;
                width: 100%;
                height: 100%;
                background: radial-gradient(circle, rgba(255, 215, 0, 0.3) 0%, transparent 70%);
                opacity: 0;
            }
            .camera-shake {
                position: absolute;
                width: 100%;
                height: 100%;
                background: rgba(255, 215, 0, 0.1);
                opacity: 0;
            }
            .gamer-tag {
                position: absolute;
                top: 65%;
                left: 50%;
                transform: translateX(-50%);
                color: white;
                font-size: 1.8rem;
                font-weight: bold;
                opacity: 0;
            }
            .profile-fade {
                position: absolute;
                width: 80%;
                height: 60%;
                top: 20%;
                left: 10%;
                background: linear-gradient(45deg, rgba(255, 42, 109, 0.1), rgba(0, 255, 136, 0.1));
                border-radius: 10px;
                opacity: 0;
            }
        </style>
    `;
}

function createMinimalPreview() {
    return `
        <div class="minimal-preview">
            <div class="preview-stage">
                <div class="blur-bg"></div>
                <div class="soft-zoom"></div>
                <div class="minimal-avatar"></div>
                <div class="minimal-name">GHOST_WARRIOR</div>
                <div class="minimal-rank">DIAMOND II</div>
            </div>
            <div class="preview-info">
                <h3><i class="fas fa-star"></i> Minimal Pro Preview</h3>
                <p>Blur background → Soft zoom → Clean fade in → Name appears → Rank displays → Professional aesthetic</p>
            </div>
        </div>
        <style>
            .minimal-preview { max-width: 600px; margin: 0 auto; }
            .preview-stage {
                position: relative;
                height: 300px;
                background: #050510;
                border-radius: 10px;
                overflow: hidden;
                margin-bottom: 1rem;
            }
            .blur-bg {
                position: absolute;
                width: 100%;
                height: 100%;
                background: linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%);
                backdrop-filter: blur(20px);
            }
            .soft-zoom {
                position: absolute;
                width: 100%;
                height: 100%;
                transform: scale(0.8);
                opacity: 0;
            }
            .minimal-avatar {
                position: absolute;
                top: 40%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 80px;
                height: 80px;
                background: linear-gradient(45deg, #ff2a6d, #00ff88);
                border-radius: 50%;
                opacity: 0;
            }
            .minimal-name {
                position: absolute;
                top: 60%;
                left: 50%;
                transform: translateX(-50%);
                color: white;
                font-size: 1.8rem;
                font-weight: 300;
                opacity: 0;
            }
            .minimal-rank {
                position: absolute;
                top: 72%;
                left: 50%;
                transform: translateX(-50%);
                color: #00ff88;
                font-size: 1.2rem;
                font-weight: 500;
                opacity: 0;
            }
        </style>
    `;
}

function startPreviewAnimation(introType) {
    const stage = document.querySelector('.preview-stage');
    
    // Reset previous animations
    stage.style.animation = 'none';
    void stage.offsetWidth; // Trigger reflow
    
    switch(introType) {
        case 'hero':
            animateHeroPreview();
            break;
        case 'glitch':
            animateGlitchPreview();
            break;
        case 'portal':
            animatePortalPreview();
            break;
        case 'rank':
            animateRankPreview();
            break;
        case 'minimal':
            animateMinimalPreview();
            break;
    }
}

function animateHeroPreview() {
    const elements = {
        glitchText: document.querySelector('.glitch-text'),
        username: document.querySelector('.username'),
        avatar: document.querySelector('.avatar-placeholder'),
        lightBurst: document.querySelector('.light-burst'),
        rankDisplay: document.querySelector('.rank-display'),
        enterText: document.querySelector('.enter-text'),
        darkScreen: document.querySelector('.dark-screen')
    };

    const timeline = [
        { element: elements.darkScreen, opacity: 1, duration: 0 },
        { element: elements.glitchText, opacity: 1, delay: 500, duration: 1000 },
        { element: elements.glitchText, opacity: 0, delay: 1500, duration: 500 },
        { element: elements.username, opacity: 1, delay: 1500, duration: 1000 },
        { element: elements.avatar, opacity: 1, left: '50%', delay: 2000, duration: 800 },
        { element: elements.lightBurst, opacity: 0.5, delay: 2000, duration: 300 },
        { element: elements.lightBurst, opacity: 0, delay: 2300, duration: 200 },
        { element: elements.rankDisplay, opacity: 1, delay: 2500, duration: 1000 },
        { element: elements.enterText, opacity: 1, delay: 3000, duration: 1000 }
    ];

    animateTimeline(timeline);
}

function animateGlitchPreview() {
    const elements = {
        screenFlicker: document.querySelector('.screen-flicker'),
        scanLines: document.querySelector('.scan-lines'),
        scrambledText: document.querySelector('.scrambled-text'),
        resolvedText: document.querySelector('.resolved-text'),
        rankBadge: document.querySelector('.rank-badge'),
        glitchEffect: document.querySelector('.glitch-effect')
    };

    const timeline = [
        { element: elements.screenFlicker, opacity: 0.3, duration: 100 },
        { element: elements.screenFlicker, opacity: 0, delay: 100, duration: 50 },
        { element: elements.screenFlicker, opacity: 0.2, delay: 200, duration: 50 },
        { element: elements.scanLines, opacity: 0.5, delay: 300, duration: 1000 },
        { element: elements.scrambledText, opacity: 1, delay: 500, duration: 500 },
        { element: elements.scrambledText, opacity: 0, delay: 1500, duration: 100 },
        { element: elements.resolvedText, opacity: 1, delay: 1600, duration: 500 },
        { element: elements.rankBadge, opacity: 1, delay: 1800, duration: 500 },
        { element: elements.glitchEffect, opacity: 0.5, delay: 2000, duration: 200 },
        { element: elements.glitchEffect, opacity: 0, delay: 2200, duration: 100 },
        { element: elements.scanLines, opacity: 0, delay: 2200, duration: 500 }
    ];

    animateTimeline(timeline);
}

function animatePortalPreview() {
    const elements = {
        portalRing: document.querySelector('.portal-ring'),
        avatarEmerge: document.querySelector('.avatar-emerge'),
        nameFade: document.querySelector('.name-fade'),
        rankPortal: document.querySelector('.rank-portal'),
        portalCollapse: document.querySelector('.portal-collapse')
    };

    const timeline = [
        { element: elements.portalRing, width: '200px', height: '200px', opacity: 1, delay: 500, duration: 1000 },
        { element: elements.avatarEmerge, opacity: 1, delay: 1500, duration: 500 },
        { element: elements.nameFade, opacity: 1, delay: 2000, duration: 1000 },
        { element: elements.rankPortal, opacity: 1, delay: 2500, duration: 1000 },
        { element: elements.portalCollapse, width: '200px', height: '200px', opacity: 1, delay: 3000, duration: 300 },
        { element: elements.portalCollapse, width: '0', height: '0', opacity: 0, delay: 3300, duration: 200 }
    ];

    animateTimeline(timeline);
}

function animateRankPreview() {
    const elements = {
        rankBadge: document.querySelector('.rank-badge'),
        badgeSlam: document.querySelector('.badge-slam'),
        cameraShake: document.querySelector('.camera-shake'),
        gamerTag: document.querySelector('.gamer-tag'),
        profileFade: document.querySelector('.profile-fade')
    };

    const timeline = [
        { element: elements.rankBadge, opacity: 1, scale: 0.5, delay: 500, duration: 200 },
        { element: elements.rankBadge, scale: 1.2, delay: 700, duration: 100 },
        { element: elements.rankBadge, scale: 1, delay: 800, duration: 100 },
        { element: elements.badgeSlam, opacity: 0.5, delay: 700, duration: 100 },
        { element: elements.badgeSlam, opacity: 0, delay: 800, duration: 200 },
        { element: elements.cameraShake, opacity: 0.3, delay: 700, duration: 300 },
        { element: elements.cameraShake, opacity: 0, delay: 1000, duration: 200 },
        { element: elements.gamerTag, opacity: 1, delay: 1200, duration: 1000 },
        { element: elements.profileFade, opacity: 1, delay: 1500, duration: 1000 }
    ];

    animateTimeline(timeline);
}

function animateMinimalPreview() {
    const elements = {
        softZoom: document.querySelector('.soft-zoom'),
        minimalAvatar: document.querySelector('.minimal-avatar'),
        minimalName: document.querySelector('.minimal-name'),
        minimalRank: document.querySelector('.minimal-rank')
    };

    const timeline = [
        { element: elements.softZoom, opacity: 1, scale: 1, delay: 500, duration: 1500 },
        { element: elements.minimalAvatar, opacity: 1, delay: 1000, duration: 1000 },
        { element: elements.minimalName, opacity: 1, delay: 1500, duration: 1000 },
        { element: elements.minimalRank, opacity: 1, delay: 2000, duration: 1000 }
    ];

    animateTimeline(timeline);
}

function animateTimeline(timeline) {
    timeline.forEach((step, index) => {
        setTimeout(() => {
            const element = step.element;
            if (!element) return;
            
            // Apply all properties
            if (step.opacity !== undefined) {
                element.style.opacity = step.opacity;
            }
            if (step.left !== undefined) {
                element.style.left = step.left;
            }
            if (step.width !== undefined) {
                element.style.width = step.width;
            }
            if (step.height !== undefined) {
                element.style.height = step.height;
            }
            if (step.scale !== undefined) {
                element.style.transform = element.style.transform.replace(/scale\([^)]*\)/, '') + ` scale(${step.scale})`;
            }
            
            // Set transition
            element.style.transition = `all ${step.duration || 300}ms ease`;
            
        }, step.delay || 0);
    });
}

async function saveIntroSelection() {
    if (!currentUser || !selectedIntro) {
        showNotification('Please select an intro animation', 'warning');
        return;
    }
    
    try {
        // Save intro preference to user's profile
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
            introAnimation: selectedIntro,
            lastUpdated: serverTimestamp()
        });
        
        // Also update gamer profile if it exists
        const gamerProfileRef = collection(db, 'users', currentUser.uid, 'gamerProfile');
        const gamerProfileSnap = await getDocs(gamerProfileRef);
        
        if (!gamerProfileSnap.empty) {
            const profileDoc = gamerProfileSnap.docs[0];
            await updateDoc(profileDoc.ref, {
                introAnimation: selectedIntro
            });
        }
        
        showNotification('Intro animation saved successfully!', 'success');
        
        // Redirect to gamersprofile page after a delay
        setTimeout(() => {
            window.location.href = 'gamersprofile.html';
        }, 1500);
        
    } catch (error) {
        console.error('Error saving intro selection:', error);
        showNotification('Error saving intro animation', 'error');
    }
}

// ========== GAMERSPROFILE PAGE FUNCTIONS ==========
async function initGamersProfilePage() {
    console.log('Initializing gamers profile page');
    
    // Get URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('user');
    const profileId = urlParams.get('profile');
    
    console.log('URL parameters - user:', userId, 'profile:', profileId);
    
    if (!userId || !profileId) {
        console.error('Missing URL parameters');
        showError('Invalid profile link. Please check the URL.');
        return;
    }
    
    // Validate the profile ID format
    if (!profileId.startsWith('gamer_')) {
        console.error('Invalid profile ID format:', profileId);
        showError('Invalid profile link format.');
        return;
    }
    
    if (!db) {
        console.error('Firestore not initialized');
        showError('Database service unavailable. Please try again later.');
        return;
    }
    
    // Check if we should show intro animation
    const showIntro = urlParams.get('intro') !== 'false' && !urlParams.has('skipIntro');
    
    if (showIntro) {
        // Load user data first to check for intro animation
        try {
            const userDoc = await getDoc(doc(db, 'users', userId));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                if (userData.introAnimation) {
                    // Get gamer profile data for animation
                    const gamerProfileRef = collection(db, 'users', userId, 'gamerProfile');
                    const gamerProfileSnap = await getDocs(gamerProfileRef);
                    
                    if (!gamerProfileSnap.empty) {
                        let gamerProfileData = null;
                        gamerProfileSnap.forEach(doc => {
                            const data = doc.data();
                            if (data.publicProfileId === profileId) {
                                gamerProfileData = data;
                            }
                        });
                        
                        if (gamerProfileData) {
                            // Show intro animation with actual user data
                            await showIntroAnimation(userData.introAnimation, userData, gamerProfileData, userId, profileId);
                            return;
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error checking intro animation:', error);
            // Continue to load profile normally
        }
    }
    
    // Load the gamer profile normally
    await loadPublicGamerProfile(userId, profileId);
}

async function showIntroAnimation(introType, userData, gamerProfileData, userId, profileId) {
    // Create intro overlay
    const introOverlay = document.createElement('div');
    introOverlay.id = 'introOverlay';
    introOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: #050510;
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
    `;
    
    document.body.appendChild(introOverlay);
    
    // Get user data for animation
    const gamerTag = gamerProfileData.gamerTag || userData.name || 'GAMER';
    const rank = gamerProfileData.rank || 'UNRANKED';
    const profileImage = userData.profileImage || 'images-default-profile.jpg';
    
    // Create intro content based on type
    let introHTML = '';
    
    switch(introType) {
        case 'hero':
            introHTML = createHeroIntro(gamerTag, rank, profileImage);
            break;
        case 'glitch':
            introHTML = createGlitchIntro(gamerTag, rank, profileImage);
            break;
        case 'portal':
            introHTML = createPortalIntro(gamerTag, rank, profileImage);
            break;
        case 'rank':
            introHTML = createRankIntro(gamerTag, rank, profileImage);
            break;
        case 'minimal':
            introHTML = createMinimalIntro(gamerTag, rank, profileImage);
            break;
        default:
            // Default animation
            introHTML = createDefaultIntro(gamerTag, rank, profileImage);
    }
    
    introOverlay.innerHTML = introHTML;
    
    // Play the animation
    setTimeout(() => {
        playIntroAnimation(introType);
    }, 500);
    
    // After animation completes, load profile
    setTimeout(async () => {
        // Fade out intro
        introOverlay.style.opacity = '0';
        introOverlay.style.transition = 'opacity 0.5s ease';
        
        setTimeout(() => {
            if (introOverlay.parentNode) {
                introOverlay.parentNode.removeChild(introOverlay);
            }
            
            // Load profile
            loadPublicGamerProfile(userId, profileId);
        }, 500);
    }, 5000); // 5 seconds total animation time
}

function createHeroIntro(gamerTag, rank, profileImage) {
    return `
        <div class="hero-intro">
            <div class="dark-screen"></div>
            <div class="glitch-text">LOADING PROFILE...</div>
            <div class="username">${gamerTag}</div>
            <div class="avatar-placeholder">
                <img src="${profileImage}" alt="Avatar" onerror="this.src='images-default-profile.jpg'">
            </div>
            <div class="light-burst"></div>
            <div class="rank-display">${rank}</div>
            <div class="enter-text">ENTERING ARENA...</div>
            <div class="skip-intro">
                <button onclick="skipIntro()">Skip Intro</button>
            </div>
        </div>
        <style>
            .hero-intro {
                position: relative;
                width: 100%;
                height: 100%;
                overflow: hidden;
            }
            .dark-screen { 
                position: absolute;
                width: 100%;
                height: 100%;
                background: #000;
                animation: fadeOut 1s ease 3s forwards;
            }
            .glitch-text {
                position: absolute;
                top: 30%;
                left: 50%;
                transform: translateX(-50%);
                color: #ff2a6d;
                font-family: monospace;
                font-size: 1.5rem;
                opacity: 0;
                animation: glitchText 2s ease 0.5s forwards;
            }
            .username {
                position: absolute;
                top: 40%;
                left: 50%;
                transform: translateX(-50%);
                color: white;
                font-size: 3rem;
                font-weight: bold;
                opacity: 0;
                animation: fadeIn 1s ease 2s forwards;
            }
            .avatar-placeholder {
                position: absolute;
                top: 50%;
                left: -200px;
                width: 120px;
                height: 120px;
                border-radius: 50%;
                overflow: hidden;
                opacity: 0;
                animation: slideIn 1s ease 2.5s forwards, glow 2s ease 3s infinite alternate;
            }
            .avatar-placeholder img {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }
            .light-burst {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 300px;
                height: 300px;
                background: radial-gradient(circle, rgba(255,255,255,0.8) 0%, transparent 70%);
                opacity: 0;
                animation: burst 0.5s ease 2.5s forwards;
            }
            .rank-display {
                position: absolute;
                top: 70%;
                left: 50%;
                transform: translateX(-50%);
                color: #FFD700;
                font-size: 1.8rem;
                font-weight: bold;
                opacity: 0;
                animation: fadeIn 1s ease 3s forwards;
            }
            .enter-text {
                position: absolute;
                bottom: 20%;
                left: 50%;
                transform: translateX(-50%);
                color: #00ff88;
                font-size: 2rem;
                opacity: 0;
                animation: fadeIn 1s ease 3.5s forwards;
            }
            .skip-intro {
                position: absolute;
                bottom: 5%;
                right: 5%;
            }
            .skip-intro button {
                background: rgba(255,255,255,0.1);
                border: 1px solid rgba(255,255,255,0.2);
                color: white;
                padding: 0.5rem 1rem;
                border-radius: 20px;
                cursor: pointer;
                backdrop-filter: blur(10px);
                font-family: 'Segoe UI', system-ui, sans-serif;
                transition: all 0.3s ease;
            }
            .skip-intro button:hover {
                background: rgba(255,255,255,0.2);
            }
            @keyframes glitchText {
                0% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
                50% { opacity: 1; transform: translateX(-50%) translateY(0); }
                100% { opacity: 0; transform: translateX(-50%) translateY(10px); }
            }
            @keyframes slideIn {
                to { opacity: 1; left: 50%; transform: translateX(-50%); }
            }
            @keyframes burst {
                0% { opacity: 0; transform: translate(-50%, -50%) scale(0); }
                50% { opacity: 0.5; transform: translate(-50%, -50%) scale(1.2); }
                100% { opacity: 0; transform: translate(-50%, -50%) scale(1); }
            }
            @keyframes glow {
                from { box-shadow: 0 0 20px rgba(255, 42, 109, 0.5); }
                to { box-shadow: 0 0 40px rgba(0, 255, 136, 0.8); }
            }
            @keyframes fadeIn {
                to { opacity: 1; }
            }
            @keyframes fadeOut {
                to { opacity: 0; }
            }
        </style>
    `;
}

function createGlitchIntro(gamerTag, rank, profileImage) {
    const scrambledTag = getScrambledText(gamerTag);
    
    return `
        <div class="glitch-intro">
            <div class="screen-flicker"></div>
            <div class="scan-lines"></div>
            <div class="scrambled-text">${scrambledTag}</div>
            <div class="resolved-text">${gamerTag}</div>
            <div class="rank-badge">${rank}</div>
            <div class="avatar-glitch">
                <img src="${profileImage}" alt="Avatar" onerror="this.src='images-default-profile.jpg'">
            </div>
            <div class="digital-whoosh"></div>
            <div class="skip-intro">
                <button onclick="skipIntro()">Skip Intro</button>
            </div>
        </div>
        <style>
            .glitch-intro {
                position: relative;
                width: 100%;
                height: 100%;
                overflow: hidden;
                background: #0a0a1a;
            }
            .screen-flicker {
                position: absolute;
                width: 100%;
                height: 100%;
                background: rgba(0, 243, 255, 0.1);
                animation: flicker 2s ease infinite;
            }
            .scan-lines {
                position: absolute;
                width: 100%;
                height: 100%;
                background: repeating-linear-gradient(
                    0deg,
                    transparent,
                    transparent 2px,
                    rgba(0, 243, 255, 0.1) 2px,
                    rgba(0, 243, 255, 0.1) 4px
                );
                animation: scan 5s linear infinite;
            }
            .scrambled-text {
                position: absolute;
                top: 40%;
                left: 50%;
                transform: translate(-50%, -50%);
                color: #00f3ff;
                font-family: monospace;
                font-size: 2.5rem;
                animation: scramble 3s ease forwards;
            }
            .resolved-text {
                position: absolute;
                top: 40%;
                left: 50%;
                transform: translate(-50%, -50%);
                color: white;
                font-size: 2.5rem;
                font-weight: bold;
                opacity: 0;
                animation: resolve 1s ease 2.5s forwards;
            }
            .rank-badge {
                position: absolute;
                top: 55%;
                left: 50%;
                transform: translateX(-50%);
                color: #00ff88;
                font-family: monospace;
                font-size: 1.8rem;
                opacity: 0;
                animation: fadeIn 1s ease 3s forwards;
            }
            .avatar-glitch {
                position: absolute;
                top: 70%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 80px;
                height: 80px;
                border-radius: 50%;
                overflow: hidden;
                opacity: 0;
                animation: fadeIn 1s ease 3.5s forwards;
                border: 2px solid #00f3ff;
            }
            .avatar-glitch img {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }
            .digital-whoosh {
                position: absolute;
                width: 100%;
                height: 100%;
                background: linear-gradient(
                    90deg,
                    transparent 49%,
                    rgba(0, 243, 255, 0.3) 50%,
                    transparent 51%
                );
                opacity: 0;
                animation: whoosh 1s ease 4s forwards;
            }
            .skip-intro {
                position: absolute;
                bottom: 5%;
                right: 5%;
            }
            .skip-intro button {
                background: rgba(255,255,255,0.1);
                border: 1px solid rgba(255,255,255,0.2);
                color: white;
                padding: 0.5rem 1rem;
                border-radius: 20px;
                cursor: pointer;
                backdrop-filter: blur(10px);
                font-family: 'Segoe UI', system-ui, sans-serif;
                transition: all 0.3s ease;
            }
            .skip-intro button:hover {
                background: rgba(255,255,255,0.2);
            }
            @keyframes flicker {
                0%, 100% { opacity: 0.1; }
                50% { opacity: 0.3; }
            }
            @keyframes scan {
                0% { transform: translateY(-100%); }
                100% { transform: translateY(100%); }
            }
            @keyframes scramble {
                0% { opacity: 0; }
                20% { opacity: 1; }
                80% { opacity: 1; }
                100% { opacity: 0; }
            }
            @keyframes resolve {
                to { opacity: 1; }
            }
            @keyframes whoosh {
                0% { opacity: 0; transform: translateX(-100%); }
                50% { opacity: 0.5; transform: translateX(0); }
                100% { opacity: 0; transform: translateX(100%); }
            }
        </style>
    `;
}

function createPortalIntro(gamerTag, rank, profileImage) {
    return `
        <div class="portal-intro">
            <div class="space-bg"></div>
            <div class="portal-ring"></div>
            <div class="avatar-emerge">
                <img src="${profileImage}" alt="Avatar" onerror="this.src='images-default-profile.jpg'">
                <div class="avatar-glow"></div>
            </div>
            <div class="name-fade">${gamerTag}</div>
            <div class="rank-portal">${rank}</div>
            <div class="portal-collapse"></div>
            <div class="skip-intro">
                <button onclick="skipIntro()">Skip Intro</button>
            </div>
        </div>
        <style>
            .portal-intro {
                position: relative;
                width: 100%;
                height: 100%;
                overflow: hidden;
                background: #050510;
            }
            .space-bg {
                position: absolute;
                width: 100%;
                height: 100%;
                background: radial-gradient(circle at center, #0a0a2a 0%, #000 100%);
            }
            .portal-ring {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 0;
                height: 0;
                border: 3px solid #9d00ff;
                border-radius: 50%;
                animation: portalOpen 2s ease forwards;
            }
            .avatar-emerge {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 100px;
                height: 100px;
                border-radius: 50%;
                overflow: hidden;
                opacity: 0;
                animation: emerge 1s ease 2s forwards;
                border: 2px solid #9d00ff;
            }
            .avatar-emerge img {
                width: 100%;
                height: 100%;
                object-fit: cover;
                position: relative;
                z-index: 1;
            }
            .avatar-glow {
                position: absolute;
                width: 100%;
                height: 100%;
                border-radius: 50%;
                background: radial-gradient(circle, rgba(157, 0, 255, 0.3) 0%, transparent 70%);
                animation: pulse 2s ease infinite;
                top: 0;
                left: 0;
            }
            .name-fade {
                position: absolute;
                top: 60%;
                left: 50%;
                transform: translateX(-50%);
                color: white;
                font-size: 2rem;
                opacity: 0;
                animation: fadeIn 1s ease 3s forwards;
            }
            .rank-portal {
                position: absolute;
                top: 70%;
                left: 50%;
                transform: translateX(-50%);
                color: #9d00ff;
                font-size: 1.5rem;
                font-weight: bold;
                opacity: 0;
                animation: fadeIn 1s ease 3.5s forwards;
            }
            .portal-collapse {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 200px;
                height: 200px;
                border: 3px solid #9d00ff;
                border-radius: 50%;
                opacity: 0;
                animation: collapse 1s ease 4s forwards;
            }
            .skip-intro {
                position: absolute;
                bottom: 5%;
                right: 5%;
            }
            .skip-intro button {
                background: rgba(255,255,255,0.1);
                border: 1px solid rgba(255,255,255,0.2);
                color: white;
                padding: 0.5rem 1rem;
                border-radius: 20px;
                cursor: pointer;
                backdrop-filter: blur(10px);
                font-family: 'Segoe UI', system-ui, sans-serif;
                transition: all 0.3s ease;
            }
            .skip-intro button:hover {
                background: rgba(255,255,255,0.2);
            }
            @keyframes portalOpen {
                to { width: 300px; height: 300px; opacity: 1; }
            }
            @keyframes emerge {
                to { opacity: 1; }
            }
            @keyframes pulse {
                0%, 100% { transform: scale(1); opacity: 0.5; }
                50% { transform: scale(1.2); opacity: 0.8; }
            }
            @keyframes fadeIn {
                to { opacity: 1; }
            }
            @keyframes collapse {
                0% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                100% { opacity: 0; transform: translate(-50%, -50%) scale(0); }
            }
        </style>
    `;
}

function createRankIntro(gamerTag, rank, profileImage) {
    return `
        <div class="rank-intro">
            <div class="rank-badge">${rank}</div>
            <div class="badge-slam"></div>
            <div class="camera-shake"></div>
            <div class="gamer-tag">${gamerTag}</div>
            <div class="profile-reveal">
                <div class="profile-avatar">
                    <img src="${profileImage}" alt="Avatar" onerror="this.src='images-default-profile.jpg'">
                </div>
            </div>
            <div class="skip-intro">
                <button onclick="skipIntro()">Skip Intro</button>
            </div>
        </div>
        <style>
            .rank-intro {
                position: relative;
                width: 100%;
                height: 100%;
                overflow: hidden;
                background: #1a1a2e;
            }
            .rank-badge {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%) scale(0.1);
                color: #FFD700;
                font-size: 4rem;
                font-weight: bold;
                text-shadow: 0 0 20px rgba(255, 215, 0, 0.5);
                animation: badgeSlam 1s ease forwards;
            }
            .badge-slam {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 400px;
                height: 400px;
                background: radial-gradient(circle, rgba(255, 215, 0, 0.3) 0%, transparent 70%);
                opacity: 0;
                animation: slamEffect 0.5s ease 0.5s forwards;
            }
            .camera-shake {
                position: absolute;
                width: 100%;
                height: 100%;
                background: rgba(255, 215, 0, 0.1);
                opacity: 0;
                animation: shake 0.5s ease 0.5s;
            }
            .gamer-tag {
                position: absolute;
                top: 65%;
                left: 50%;
                transform: translateX(-50%);
                color: white;
                font-size: 2rem;
                opacity: 0;
                animation: reveal 1s ease 1.5s forwards;
            }
            .profile-reveal {
                position: absolute;
                top: 30%;
                left: 50%;
                transform: translateX(-50%);
                width: 120px;
                height: 120px;
                opacity: 0;
                animation: fadeIn 1s ease 2s forwards;
            }
            .profile-avatar {
                width: 100%;
                height: 100%;
                border-radius: 50%;
                overflow: hidden;
                border: 3px solid #FFD700;
                box-shadow: 0 0 30px rgba(255, 215, 0, 0.3);
            }
            .profile-avatar img {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }
            .skip-intro {
                position: absolute;
                bottom: 5%;
                right: 5%;
            }
            .skip-intro button {
                background: rgba(255,255,255,0.1);
                border: 1px solid rgba(255,255,255,0.2);
                color: white;
                padding: 0.5rem 1rem;
                border-radius: 20px;
                cursor: pointer;
                backdrop-filter: blur(10px);
                font-family: 'Segoe UI', system-ui, sans-serif;
                transition: all 0.3s ease;
            }
            .skip-intro button:hover {
                background: rgba(255,255,255,0.2);
            }
            @keyframes badgeSlam {
                0% { transform: translate(-50%, -50%) scale(0.1); opacity: 0; }
                70% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; }
                100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
            }
            @keyframes slamEffect {
                0% { opacity: 0; transform: translate(-50%, -50%) scale(0.1); }
                100% { opacity: 0.5; transform: translate(-50%, -50%) scale(1); }
            }
            @keyframes shake {
                0%, 100% { transform: translateX(0); }
                25% { transform: translateX(-10px); }
                50% { transform: translateX(10px); }
                75% { transform: translateX(-10px); }
            }
            @keyframes reveal {
                to { opacity: 1; }
            }
        </style>
    `;
}

function createMinimalIntro(gamerTag, rank, profileImage) {
    return `
        <div class="minimal-intro">
            <div class="blur-bg"></div>
            <div class="soft-zoom"></div>
            <div class="minimal-avatar">
                <img src="${profileImage}" alt="Avatar" onerror="this.src='images-default-profile.jpg'">
            </div>
            <div class="minimal-name">${gamerTag}</div>
            <div class="minimal-rank">${rank}</div>
            <div class="skip-intro">
                <button onclick="skipIntro()">Skip Intro</button>
            </div>
        </div>
        <style>
            .minimal-intro {
                position: relative;
                width: 100%;
                height: 100%;
                overflow: hidden;
                background: #050510;
            }
            .blur-bg {
                position: absolute;
                width: 100%;
                height: 100%;
                background: linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%);
                backdrop-filter: blur(20px);
            }
            .soft-zoom {
                position: absolute;
                width: 100%;
                height: 100%;
                transform: scale(0.8);
                opacity: 0;
                animation: zoomIn 2s ease forwards;
            }
            .minimal-avatar {
                position: absolute;
                top: 40%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 120px;
                height: 120px;
                border-radius: 50%;
                overflow: hidden;
                opacity: 0;
                animation: fadeInUp 1s ease 1.5s forwards;
                border: 2px solid rgba(255,255,255,0.1);
            }
            .minimal-avatar img {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }
            .minimal-name {
                position: absolute;
                top: 60%;
                left: 50%;
                transform: translateX(-50%);
                color: white;
                font-size: 2.5rem;
                font-weight: 300;
                opacity: 0;
                animation: fadeIn 1s ease 2.5s forwards;
            }
            .minimal-rank {
                position: absolute;
                top: 72%;
                left: 50%;
                transform: translateX(-50%);
                color: #00ff88;
                font-size: 1.5rem;
                font-weight: 500;
                opacity: 0;
                animation: fadeIn 1s ease 3s forwards;
            }
            .skip-intro {
                position: absolute;
                bottom: 5%;
                right: 5%;
            }
            .skip-intro button {
                background: rgba(255,255,255,0.1);
                border: 1px solid rgba(255,255,255,0.2);
                color: white;
                padding: 0.5rem 1rem;
                border-radius: 20px;
                cursor: pointer;
                backdrop-filter: blur(10px);
                font-family: 'Segoe UI', system-ui, sans-serif;
                transition: all 0.3s ease;
            }
            .skip-intro button:hover {
                background: rgba(255,255,255,0.2);
            }
            @keyframes zoomIn {
                to { opacity: 1; transform: scale(1); }
            }
            @keyframes fadeInUp {
                to { opacity: 1; transform: translate(-50%, -60%); }
            }
            @keyframes fadeIn {
                to { opacity: 1; }
            }
        </style>
    `;
}

function createDefaultIntro(gamerTag, rank, profileImage) {
    return `
        <div class="default-intro">
            <div class="loading-text">Loading Gamer Profile...</div>
            <div class="loading-bar">
                <div class="loading-progress"></div>
            </div>
            <div class="profile-preview">
                <div class="preview-avatar">
                    <img src="${profileImage}" alt="Avatar" onerror="this.src='images-default-profile.jpg'">
                </div>
                <div class="preview-name">${gamerTag}</div>
                <div class="preview-rank">${rank}</div>
            </div>
        </div>
        <style>
            .default-intro {
                position: relative;
                width: 100%;
                height: 100%;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                background: #050510;
            }
            .loading-text {
                color: white;
                font-size: 1.5rem;
                margin-bottom: 2rem;
                animation: pulse 2s ease infinite;
            }
            .loading-bar {
                width: 300px;
                height: 4px;
                background: rgba(255,255,255,0.1);
                border-radius: 2px;
                overflow: hidden;
                margin-bottom: 3rem;
            }
            .loading-progress {
                width: 0%;
                height: 100%;
                background: linear-gradient(90deg, #ff2a6d, #00ff88);
                animation: load 3s ease forwards;
            }
            .profile-preview {
                text-align: center;
                opacity: 0;
                animation: fadeIn 1s ease 3s forwards;
            }
            .preview-avatar {
                width: 100px;
                height: 100px;
                border-radius: 50%;
                overflow: hidden;
                margin: 0 auto 1rem;
                border: 2px solid #00ff88;
            }
            .preview-avatar img {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }
            .preview-name {
                color: white;
                font-size: 2rem;
                font-weight: bold;
                margin-bottom: 0.5rem;
            }
            .preview-rank {
                color: #00ff88;
                font-size: 1.2rem;
                font-weight: 500;
            }
            @keyframes pulse {
                0%, 100% { opacity: 0.5; }
                50% { opacity: 1; }
            }
            @keyframes load {
                to { width: 100%; }
            }
        </style>
    `;
}

function getScrambledText(text) {
    const chars = '0123456789!@#$%^&*()';
    return text.split('').map(char => {
        if (char === ' ' || char === '_') return char;
        if (Math.random() > 0.6) {
            return chars[Math.floor(Math.random() * chars.length)];
        }
        if (Math.random() > 0.5) {
            return Math.floor(Math.random() * 10).toString();
        }
        return char;
    }).join('');
}

function playIntroAnimation(introType) {
    // Animation is handled by CSS animations in the intro HTML
    console.log(`Playing ${introType} intro animation`);
}

function skipIntro() {
    const introOverlay = document.getElementById('introOverlay');
    if (introOverlay && introOverlay.parentNode) {
        introOverlay.parentNode.removeChild(introOverlay);
    }
    
    // Get URL parameters and load profile
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('user');
    const profileId = urlParams.get('profile');
    
    if (userId && profileId) {
        loadPublicGamerProfile(userId, profileId);
    }
}

// Make skipIntro available globally
window.skipIntro = skipIntro;

async function loadPublicGamerProfile(userId, profileId) {
    try {
        console.log('Loading public gamer profile for user:', userId, 'profile:', profileId);
        
        // Show loading state
        const loadingState = document.getElementById('loadingState');
        const profileDetails = document.getElementById('profileDetails');
        const errorState = document.getElementById('errorState');
        
        if (loadingState) loadingState.style.display = 'block';
        if (profileDetails) profileDetails.style.display = 'none';
        if (errorState) errorState.style.display = 'none';
        
        // Get user data
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (!userDoc.exists()) {
            showError('Profile not found. The user may have deleted their account.');
            return;
        }
        
        const userData = userDoc.data();
        
        // Get gamer profile
        const gamerProfileRef = collection(db, 'users', userId, 'gamerProfile');
        const gamerProfileQuery = query(gamerProfileRef);
        const gamerProfileSnap = await getDocs(gamerProfileQuery);
        
        if (gamerProfileSnap.empty) {
            showError('Gamer profile not found. The user may not have set up their gaming profile yet.');
            return;
        }
        
        let gamerProfileData = null;
        let profileFound = false;
        
        // Find the specific profile by ID
        gamerProfileSnap.forEach(doc => {
            const data = doc.data();
            if (data.publicProfileId === profileId) {
                gamerProfileData = data;
                profileFound = true;
            }
        });
        
        if (!profileFound || !gamerProfileData) {
            showError('This specific gamer profile is no longer available.');
            return;
        }
        
        console.log('Found gamer profile:', gamerProfileData.gamerTag);
        
        // Update UI
        updateGamersProfileUI(userData, gamerProfileData);
        
        // Setup contact button
        setupContactButton(userId);
        
    } catch (error) {
        console.error('Error loading public gamer profile:', error);
        showError('Error loading profile. Please try again.');
    }
}

function updateGamersProfileUI(userData, gamerProfileData) {
    // Profile Avatar
    const profileAvatar = document.getElementById('profileAvatar');
    if (profileAvatar) {
        profileAvatar.src = userData.profileImage || 'images-default-profile.jpg';
        profileAvatar.onerror = function() {
            this.src = 'images-default-profile.jpg';
        };
    }
    
    // Gamer Tag
    const gamerTagDisplay = document.getElementById('gamerTagDisplay');
    if (gamerTagDisplay) {
        gamerTagDisplay.textContent = gamerProfileData.gamerTag || userData.name || 'Unknown Gamer';
    }
    
    // Game Info
    const gameInfo = document.getElementById('gameInfo');
    if (gameInfo) {
        const gameInfoArr = [];
        if (gamerProfileData.primaryGame) gameInfoArr.push(gamerProfileData.primaryGame);
        if (gamerProfileData.platform) gameInfoArr.push(gamerProfileData.platform);
        gameInfo.textContent = gameInfoArr.join(' • ') || 'Not specified';
    }
    
    // Badges
    updateProfileBadges(gamerProfileData);
    
    // Quick Stats
    updateProfileQuickStats(gamerProfileData);
    
    // Detailed Stats
    updateProfileDetailedStats(gamerProfileData);
    
    // Preferences
    updateProfilePreferences(gamerProfileData);
    
    // Achievements
    updateProfileAchievements(gamerProfileData);
    
    // Screenshots
    updateProfileScreenshots(gamerProfileData);
    
    // Hide loading, show content
    const loadingState = document.getElementById('loadingState');
    const profileDetails = document.getElementById('profileDetails');
    if (loadingState) loadingState.style.display = 'none';
    if (profileDetails) profileDetails.style.display = 'block';
}

function updateProfileBadges(gamerProfileData) {
    const gamerBadges = document.getElementById('gamerBadges');
    if (!gamerBadges) return;
    
    gamerBadges.innerHTML = '';
    
    const badges = [];
    
    if (gamerProfileData.platform) {
        badges.push({
            text: gamerProfileData.platform,
            icon: 'fa-gamepad',
            class: 'platform-badge'
        });
    }
    
    if (gamerProfileData.playStyle) {
        badges.push({
            text: gamerProfileData.playStyle,
            icon: 'fa-users',
            class: 'style-badge'
        });
    }
    
    if (gamerProfileData.rank) {
        badges.push({
            text: gamerProfileData.rank,
            icon: 'fa-trophy',
            class: 'rank-badge'
        });
    }
    
    badges.forEach(badge => {
        const badgeElement = document.createElement('div');
        badgeElement.className = `gamer-badge ${badge.class}`;
        badgeElement.innerHTML = `
            <i class="fas ${badge.icon}"></i>
            <span>${badge.text}</span>
        `;
        gamerBadges.appendChild(badgeElement);
    });
}

function updateProfileQuickStats(gamerProfileData) {
    const quickStats = document.getElementById('quickStats');
    if (!quickStats) return;
    
    quickStats.innerHTML = '';
    
    const stats = [
        {
            label: 'Level',
            value: gamerProfileData.level || 'N/A',
            icon: 'fa-level-up-alt',
            color: '#e63986'
        },
        {
            label: 'Rank',
            value: gamerProfileData.rank || 'Unranked',
            icon: 'fa-chess-queen',
            color: '#FFD700'
        },
        {
            label: 'K/D',
            value: gamerProfileData.kdRatio || 'N/A',
            icon: 'fa-crosshairs',
            color: '#00ff88'
        },
        {
            label: 'Win Rate',
            value: gamerProfileData.winRate ? `${gamerProfileData.winRate}%` : 'N/A',
            icon: 'fa-chart-line',
            color: '#00a8ff'
        }
    ];
    
    stats.forEach(stat => {
        const statElement = document.createElement('div');
        statElement.className = 'stat-item';
        statElement.innerHTML = `
            <div class="stat-icon" style="color: ${stat.color};">
                <i class="fas ${stat.icon}"></i>
            </div>
            <div class="stat-content">
                <div class="stat-value">${stat.value}</div>
                <div class="stat-label">${stat.label}</div>
            </div>
        `;
        quickStats.appendChild(statElement);
    });
}

function updateProfileDetailedStats(gamerProfileData) {
    const detailedStats = document.getElementById('detailedStats');
    if (!detailedStats) return;
    
    detailedStats.innerHTML = '';
    
    const stats = [
        {
            label: 'Total Kills',
            value: gamerProfileData.totalKills || 0,
            max: 10000,
            icon: 'fa-skull'
        },
        {
            label: 'Top Kills',
            value: gamerProfileData.topKills || 0,
            max: 50,
            icon: 'fa-crown'
        },
        {
            label: 'Hours Played',
            value: gamerProfileData.hoursPlayed || 0,
            max: 2000,
            icon: 'fa-clock'
        },
        {
            label: 'Win Rate',
            value: gamerProfileData.winRate || 0,
            max: 100,
            icon: 'fa-chart-line'
        }
    ];
    
    stats.forEach(stat => {
        const statElement = document.createElement('div');
        statElement.className = 'stat-card';
        
        const percentage = stat.max > 0 ? Math.min((stat.value / stat.max) * 100, 100) : 0;
        
        statElement.innerHTML = `
            <div class="stat-card-header">
                <i class="fas ${stat.icon}"></i>
                <span>${stat.label}</span>
            </div>
            <div class="stat-card-content">
                <div class="value">${stat.value}</div>
                <div class="progress">
                    <div class="progress-bar" style="width: ${percentage}%"></div>
                </div>
            </div>
        `;
        detailedStats.appendChild(statElement);
    });
}

function updateProfilePreferences(gamerProfileData) {
    const preferencesInfo = document.getElementById('preferencesInfo');
    if (!preferencesInfo) return;
    
    preferencesInfo.innerHTML = '';
    
    if (!gamerProfileData) return;
    
    let preferencesHTML = '<div class="preferences-grid">';
    
    if (gamerProfileData.playStyle) {
        preferencesHTML += `
            <div class="preference-card">
                <div class="preference-icon">
                    <i class="fas fa-users"></i>
                </div>
                <div class="preference-content">
                    <div class="preference-label">Play Style</div>
                    <div class="preference-value">${gamerProfileData.playStyle}</div>
                </div>
            </div>
        `;
    }
    
    if (gamerProfileData.micPreference) {
        preferencesHTML += `
            <div class="preference-card">
                <div class="preference-icon">
                    <i class="fas fa-microphone"></i>
                </div>
                <div class="preference-content">
                    <div class="preference-label">Mic Preference</div>
                    <div class="preference-value">${gamerProfileData.micPreference}</div>
                </div>
            </div>
        `;
    }
    
    if (gamerProfileData.lookingFor && gamerProfileData.lookingFor.length > 0) {
        preferencesHTML += `
            <div class="preference-card">
                <div class="preference-icon">
                    <i class="fas fa-search"></i>
                </div>
                <div class="preference-content">
                    <div class="preference-label">Looking For</div>
                    <div class="preference-tags">
                        ${gamerProfileData.lookingFor.map(item => `
                            <span class="preference-tag">${item}</span>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }
    
    preferencesHTML += '</div>';
    preferencesInfo.innerHTML = preferencesHTML;
}

function updateProfileAchievements(gamerProfileData) {
    const achievementsInfo = document.getElementById('achievementsInfo');
    if (!achievementsInfo) return;
    
    if (!gamerProfileData?.achievements) {
        achievementsInfo.innerHTML = '<div class="empty-state">No achievements listed yet.</div>';
        return;
    }
    
    achievementsInfo.innerHTML = `
        <div class="achievements-grid">
            ${gamerProfileData.achievements.split('\n').filter(a => a.trim()).map((achievement, index) => `
                <div class="achievement-card">
                    <div class="achievement-icon">
                        <i class="fas fa-trophy"></i>
                    </div>
                    <div class="achievement-content">
                        <div class="achievement-text">${achievement.trim()}</div>
                        <div class="achievement-date">Achievement #${index + 1}</div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function updateProfileScreenshots(gamerProfileData) {
    const screenshotsInfo = document.getElementById('screenshotsInfo');
    if (!screenshotsInfo) return;
    
    if (!gamerProfileData?.screenshotUrl) {
        screenshotsInfo.innerHTML = '<div class="empty-state">No screenshots uploaded yet.</div>';
        return;
    }
    
    screenshotsInfo.innerHTML = `
        <div class="screenshot-grid">
            <div class="screenshot-item">
                <img src="${gamerProfileData.screenshotUrl}" alt="Game Screenshot" 
                     onclick="openImageInFullScreen('${gamerProfileData.screenshotUrl}')">
                <div class="screenshot-overlay">
                    <i class="fas fa-search-plus"></i>
                </div>
            </div>
        </div>
    `;
}

function setupContactButton(gamerId) {
    const contactBtn = document.getElementById('contactGamerBtn');
    if (!contactBtn) return;
    
    contactBtn.addEventListener('click', () => {
        if (currentUser && currentUser.uid === gamerId) {
            showNotification("You can't message yourself!", 'warning');
            return;
        }
        
        if (currentUser) {
            // Redirect to chat with this gamer
            window.location.href = `chat.html?id=${gamerId}`;
        } else {
            showNotification('Please log in to message this gamer', 'info');
            window.location.href = 'login.html';
        }
    });
}

// ========== ACCOUNT PAGE FUNCTIONS ==========
async function initAccountPageGamerProfile() {
    if (!db) {
        showError('Database service unavailable. Please refresh.');
        return;
    }
    
    if (!currentUser) {
        showError('Please log in to access account page.');
        return;
    }
    
    console.log('Initializing account page for user:', currentUser.uid);
    
    // Wait for DOM to be ready
    setTimeout(async () => {
        try {
            // Setup event listeners
            setupAccountPageListeners();
            
            // Load existing gamer profile
            await loadGamerProfile(currentUser.uid);
            
            // Check if user has intro animation set
            await checkIntroAnimation();
            
            console.log('Account page gamer profile initialized');
            
        } catch (error) {
            console.error('Error initializing account page:', error);
            showError('Error loading account data.');
        }
    }, 1000);
}

function setupAccountPageListeners() {
    const gamerProfileForm = document.getElementById('gamerProfileForm');
    const generateProfileBtn = document.getElementById('generateProfileBtn');
    const copyProfileLinkBtn = document.getElementById('copyProfileLinkBtn');
    const editGamerProfileBtn = document.getElementById('editGamerProfileBtn');
    const screenshotInput = document.getElementById('gamerScreenshot');
    const removeScreenshotBtn = document.getElementById('removeScreenshot');
    const changeIntroBtn = document.getElementById('changeIntroBtn');
    
    if (gamerProfileForm) {
        gamerProfileForm.addEventListener('submit', handleGamerProfileSubmit);
    }
    
    if (generateProfileBtn) {
        generateProfileBtn.addEventListener('click', generatePublicProfile);
    }
    
    if (copyProfileLinkBtn) {
        copyProfileLinkBtn.addEventListener('click', copyProfileLink);
    }
    
    if (editGamerProfileBtn) {
        editGamerProfileBtn.addEventListener('click', editGamerProfile);
    }
    
    if (screenshotInput) {
        screenshotInput.addEventListener('change', handleScreenshotUpload);
    }
    
    if (removeScreenshotBtn) {
        removeScreenshotBtn.addEventListener('click', removeScreenshot);
    }
    
    if (changeIntroBtn) {
        changeIntroBtn.addEventListener('click', () => {
            window.location.href = 'intro.html';
        });
    }
}

async function checkIntroAnimation() {
    try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            
            // Show intro animation status
            const introStatus = document.getElementById('introStatus');
            if (introStatus) {
                if (userData.introAnimation) {
                    const introNames = {
                        'hero': '🔥 Hero Reveal',
                        'glitch': '⚡ Glitch Hacker',
                        'portal': '🌌 Portal Teleport',
                        'rank': '🏆 Rank Flex',
                        'minimal': '🧠 Minimal Pro'
                    };
                    
                    introStatus.innerHTML = `
                        <div style="background: rgba(0, 255, 136, 0.1); padding: 1rem; border-radius: 10px; border: 1px solid rgba(0, 255, 136, 0.3);">
                            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                <i class="fas fa-film" style="color: #00ff88;"></i>
                                <strong style="color: white;">Active Intro:</strong>
                            </div>
                            <div style="color: #00ff88; font-size: 1.1rem;">
                                ${introNames[userData.introAnimation] || userData.introAnimation}
                            </div>
                        </div>
                    `;
                    
                    const changeIntroBtn = document.getElementById('changeIntroBtn');
                    if (changeIntroBtn) {
                        changeIntroBtn.style.display = 'block';
                    }
                } else {
                    introStatus.innerHTML = `
                        <div style="background: rgba(255, 42, 109, 0.1); padding: 1rem; border-radius: 10px; border: 1px solid rgba(255, 42, 109, 0.3);">
                            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                <i class="fas fa-exclamation-circle" style="color: #ff2a6d;"></i>
                                <strong style="color: white;">No intro animation selected</strong>
                            </div>
                            <p style="color: #aaa; margin: 0; font-size: 0.9rem;">
                                Choose an animation to make your profile stand out
                            </p>
                        </div>
                    `;
                    
                    const setupIntroBtn = document.getElementById('setupIntroBtn');
                    if (setupIntroBtn) {
                        setupIntroBtn.style.display = 'block';
                        setupIntroBtn.addEventListener('click', () => {
                            window.location.href = 'intro.html';
                        });
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error checking intro animation:', error);
    }
}

async function loadGamerProfile(userId) {
    try {
        console.log('Loading gamer profile for user:', userId);
        
        const gamerProfileRef = collection(db, 'users', userId, 'gamerProfile');
        const gamerProfileQuery = query(gamerProfileRef);
        const gamerProfileSnap = await getDocs(gamerProfileQuery);
        
        if (!gamerProfileSnap.empty) {
            const profileData = gamerProfileSnap.docs[0].data();
            console.log('Found existing gamer profile:', profileData.gamerTag);
            
            // Display current profile
            displayCurrentProfile(profileData);
            
            // Populate form for editing
            populateForm(profileData);
            
            // Show generate profile section
            const generateProfileSection = document.getElementById('generateProfileSection');
            if (generateProfileSection) {
                generateProfileSection.style.display = 'block';
            }
            
            // Show profile link if exists
            if (profileData.publicProfileId) {
                displayProfileLink(userId, profileData.publicProfileId);
            }
        } else {
            console.log('No gamer profile found, showing form');
            
            // No profile exists, show form
            const gamerProfileFormContainer = document.getElementById('gamerProfileFormContainer');
            const currentGamerProfile = document.getElementById('currentGamerProfile');
            
            if (gamerProfileFormContainer) {
                gamerProfileFormContainer.style.display = 'block';
            }
            if (currentGamerProfile) {
                currentGamerProfile.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Error loading gamer profile:', error);
        showNotification('Error loading profile', 'error');
    }
}

function displayCurrentProfile(profileData) {
    const gamerProfilePreview = document.getElementById('gamerProfilePreview');
    const currentGamerProfile = document.getElementById('currentGamerProfile');
    
    if (!gamerProfilePreview || !currentGamerProfile) return;
    
    let html = `
        <div class="profile-info">
            <div style="margin-bottom: 1rem;">
                <strong>Gamer Tag:</strong> ${profileData.gamerTag || 'Not set'}
            </div>
            <div style="margin-bottom: 1rem;">
                <strong>Primary Game:</strong> ${profileData.primaryGame || 'Not set'}
            </div>
            <div style="margin-bottom: 1rem;">
                <strong>Platform:</strong> ${profileData.platform || 'Not set'}
            </div>
            
            <div class="gamer-stats-grid">
    `;
    
    // Add stats if available
    const stats = [
        { label: 'Rank', value: profileData.rank, icon: 'fa-trophy' },
        { label: 'Level', value: profileData.level, icon: 'fa-level-up-alt' },
        { label: 'K/D Ratio', value: profileData.kdRatio, icon: 'fa-crosshairs' },
        { label: 'Win Rate', value: profileData.winRate ? `${profileData.winRate}%` : null, icon: 'fa-chart-line' },
        { label: 'Total Kills', value: profileData.totalKills, icon: 'fa-skull' },
        { label: 'Hours Played', value: profileData.hoursPlayed, icon: 'fa-clock' }
    ];
    
    stats.forEach(stat => {
        if (stat.value) {
            html += `
                <div class="stat-card">
                    <div class="stat-value">${stat.value}</div>
                    <div class="stat-label">${stat.label}</div>
                </div>
            `;
        }
    });
    
    html += `
            </div>
            
            <div style="margin-top: 1rem;">
                <strong>Play Style:</strong> ${profileData.playStyle || 'Not specified'}
            </div>
        </div>
    `;
    
    gamerProfilePreview.innerHTML = html;
    currentGamerProfile.style.display = 'block';
    
    const gamerProfileFormContainer = document.getElementById('gamerProfileFormContainer');
    if (gamerProfileFormContainer) {
        gamerProfileFormContainer.style.display = 'none';
    }
}

function populateForm(profileData) {
    const gamerProfileForm = document.getElementById('gamerProfileForm');
    if (!gamerProfileForm) return;
    
    // Populate form fields
    const fields = {
        'gamerTag': profileData.gamerTag || '',
        'primaryGame': profileData.primaryGame || '',
        'platform': profileData.platform || '',
        'rank': profileData.rank || '',
        'level': profileData.level || '',
        'kdRatio': profileData.kdRatio || '',
        'winRate': profileData.winRate || '',
        'totalKills': profileData.totalKills || '',
        'topKills': profileData.topKills || '',
        'playStyle': profileData.playStyle || '',
        'micPreference': profileData.micPreference || '',
        'achievements': profileData.achievements || '',
        'hoursPlayed': profileData.hoursPlayed || ''
    };
    
    Object.entries(fields).forEach(([fieldId, value]) => {
        const element = document.getElementById(fieldId);
        if (element) {
            element.value = value;
        }
    });
    
    // Checkboxes for "Looking For"
    const lookingFor = profileData.lookingFor || [];
    const checkboxIds = ['lookingTeammates', 'lookingRanked', 'lookingCasual', 'lookingTournament', 'lookingFriends'];
    
    checkboxIds.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            const value = id.replace('looking', '').toLowerCase();
            element.checked = lookingFor.includes(value);
        }
    });
    
    // Screenshot
    if (profileData.screenshotUrl) {
        const screenshotPreview = document.getElementById('screenshotPreview');
        const screenshotPreviewContainer = document.getElementById('screenshotPreviewContainer');
        if (screenshotPreview && screenshotPreviewContainer) {
            screenshotPreview.src = profileData.screenshotUrl;
            screenshotPreviewContainer.style.display = 'block';
        }
    }
}

function editGamerProfile() {
    const gamerProfileFormContainer = document.getElementById('gamerProfileFormContainer');
    const currentGamerProfile = document.getElementById('currentGamerProfile');
    
    if (gamerProfileFormContainer) {
        gamerProfileFormContainer.style.display = 'block';
    }
    if (currentGamerProfile) {
        currentGamerProfile.style.display = 'none';
    }
}

async function handleGamerProfileSubmit(e) {
    e.preventDefault();
    
    try {
        // Get form values
        const gamerProfileData = {
            gamerTag: document.getElementById('gamerTag').value.trim(),
            primaryGame: document.getElementById('primaryGame').value,
            platform: document.getElementById('platform').value,
            rank: document.getElementById('rank').value.trim(),
            level: parseInt(document.getElementById('level').value) || null,
            kdRatio: parseFloat(document.getElementById('kdRatio').value) || null,
            winRate: parseInt(document.getElementById('winRate').value) || null,
            totalKills: parseInt(document.getElementById('totalKills').value) || null,
            topKills: parseInt(document.getElementById('topKills').value) || null,
            playStyle: document.getElementById('playStyle').value,
            micPreference: document.getElementById('micPreference').value,
            achievements: document.getElementById('achievements').value.trim(),
            hoursPlayed: parseInt(document.getElementById('hoursPlayed').value) || null,
            updatedAt: serverTimestamp()
        };
        
        // Get "Looking For" checkboxes
        const lookingFor = [];
        const checkboxIds = ['lookingTeammates', 'lookingRanked', 'lookingCasual', 'lookingTournament', 'lookingFriends'];
        
        checkboxIds.forEach(id => {
            const element = document.getElementById(id);
            if (element && element.checked) {
                const value = id.replace('looking', '').toLowerCase();
                lookingFor.push(value);
            }
        });
        
        gamerProfileData.lookingFor = lookingFor;
        
        // Handle screenshot upload
        const screenshotInput = document.getElementById('gamerScreenshot');
        if (screenshotInput && screenshotInput.files.length > 0) {
            const screenshotUrl = await uploadScreenshot(screenshotInput.files[0]);
            gamerProfileData.screenshotUrl = screenshotUrl;
        } else {
            // Check if we have existing screenshot
            const existingProfile = await getCurrentGamerProfile(currentUser.uid);
            if (existingProfile && existingProfile.screenshotUrl) {
                gamerProfileData.screenshotUrl = existingProfile.screenshotUrl;
            }
        }
        
        // Check if profile already exists
        const existingProfile = await getCurrentGamerProfile(currentUser.uid);
        
        if (existingProfile) {
            // Update existing profile
            const gamerProfileRef = collection(db, 'users', currentUser.uid, 'gamerProfile');
            const gamerProfileQuery = query(gamerProfileRef);
            const gamerProfileSnap = await getDocs(gamerProfileQuery);
            
            if (!gamerProfileSnap.empty) {
                const profileDoc = gamerProfileSnap.docs[0];
                await updateDoc(profileDoc.ref, gamerProfileData);
                showNotification('Gamer profile updated successfully!', 'success');
            }
        } else {
            // Create new profile
            gamerProfileData.createdAt = serverTimestamp();
            gamerProfileData.userId = currentUser.uid;
            
            await addDoc(collection(db, 'users', currentUser.uid, 'gamerProfile'), gamerProfileData);
            showNotification('Gamer profile created successfully!', 'success');
        }
        
        // Reload profile
        await loadGamerProfile(currentUser.uid);
        
    } catch (error) {
        console.error('Error saving gamer profile:', error);
        showNotification('Error saving profile: ' + error.message, 'error');
    }
}

async function getCurrentGamerProfile(userId) {
    try {
        const gamerProfileRef = collection(db, 'users', userId, 'gamerProfile');
        const gamerProfileQuery = query(gamerProfileRef);
        const gamerProfileSnap = await getDocs(gamerProfileQuery);
        
        if (!gamerProfileSnap.empty) {
            return {
                id: gamerProfileSnap.docs[0].id,
                ...gamerProfileSnap.docs[0].data()
            };
        }
        return null;
    } catch (error) {
        console.error('Error getting current profile:', error);
        return null;
    }
}

async function uploadScreenshot(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', cloudinaryConfig.uploadPreset);
    
    try {
        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`,
            {
                method: 'POST',
                body: formData
            }
        );
        
        if (!response.ok) {
            throw new Error(`Cloudinary upload failed: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data.secure_url;
    } catch (error) {
        console.error('Error uploading screenshot:', error);
        throw new Error('Failed to upload screenshot');
    }
}

function handleScreenshotUpload(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const screenshotPreview = document.getElementById('screenshotPreview');
            const screenshotPreviewContainer = document.getElementById('screenshotPreviewContainer');
            if (screenshotPreview && screenshotPreviewContainer) {
                screenshotPreview.src = e.target.result;
                screenshotPreviewContainer.style.display = 'block';
            }
        };
        reader.readAsDataURL(file);
    }
}

function removeScreenshot() {
    const screenshotPreview = document.getElementById('screenshotPreview');
    const screenshotPreviewContainer = document.getElementById('screenshotPreviewContainer');
    const screenshotInput = document.getElementById('gamerScreenshot');
    
    if (screenshotPreview) screenshotPreview.src = '';
    if (screenshotPreviewContainer) screenshotPreviewContainer.style.display = 'none';
    if (screenshotInput) screenshotInput.value = '';
}

async function generatePublicProfile() {
    try {
        // Get current profile
        const profile = await getCurrentGamerProfile(currentUser.uid);
        if (!profile) {
            showNotification('Please create a gamer profile first', 'warning');
            return;
        }
        
        // Generate unique profile ID
        const profileId = generateProfileId();
        
        // Save public profile ID
        const gamerProfileRef = collection(db, 'users', currentUser.uid, 'gamerProfile');
        const gamerProfileQuery = query(gamerProfileRef);
        const gamerProfileSnap = await getDocs(gamerProfileQuery);
        
        if (!gamerProfileSnap.empty) {
            const profileDoc = gamerProfileSnap.docs[0];
            await updateDoc(profileDoc.ref, {
                publicProfileId: profileId
            });
        }
        
        // Display profile link
        displayProfileLink(currentUser.uid, profileId);
        
        showNotification('Public profile generated successfully!', 'success');
        
    } catch (error) {
        console.error('Error generating public profile:', error);
        showNotification('Error generating profile: ' + error.message, 'error');
    }
}

function generateProfileId() {
    return 'gamer_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function displayProfileLink(userId, profileId) {
    const baseUrl = window.location.origin;
    const profileUrl = `${baseUrl}/gamersprofile.html?user=${userId}&profile=${profileId}`;
    
    const gamerProfileLink = document.getElementById('gamerProfileLink');
    if (gamerProfileLink) {
        gamerProfileLink.value = profileUrl;
    }
    
    const profileLinkContainer = document.getElementById('profileLinkContainer');
    if (profileLinkContainer) {
        profileLinkContainer.style.display = 'flex';
    }
    
    // Update link preview
    updateLinkPreview(profileUrl);
}

async function updateLinkPreview(profileUrl) {
    const linkPreview = document.getElementById('linkPreview');
    if (!linkPreview) return;
    
    const profile = await getCurrentGamerProfile(currentUser.uid);
    if (!profile) return;
    
    const previewContent = document.getElementById('linkPreviewContent');
    if (!previewContent) return;
    
    previewContent.innerHTML = `
        <img src="${profile.screenshotUrl || 'images-default-profile.jpg'}" class="link-preview-image" alt="Profile">
        <div class="link-preview-info">
            <h5>${profile.gamerTag || 'Gamer Profile'}</h5>
            <p>${profile.primaryGame || ''} ${profile.platform ? '• ' + profile.platform : ''}</p>
            <div class="stats-preview">
                ${profile.rank ? `<span class="stat-preview-item">${profile.rank}</span>` : ''}
                ${profile.kdRatio ? `<span class="stat-preview-item">K/D: ${profile.kdRatio}</span>` : ''}
                ${profile.winRate ? `<span class="stat-preview-item">Win: ${profile.winRate}%</span>` : ''}
            </div>
        </div>
    `;
    
    linkPreview.style.display = 'block';
}

function copyProfileLink() {
    const gamerProfileLink = document.getElementById('gamerProfileLink');
    if (!gamerProfileLink) return;
    
    gamerProfileLink.select();
    gamerProfileLink.setSelectionRange(0, 99999);
    
    try {
        navigator.clipboard.writeText(gamerProfileLink.value);
        showNotification('Profile link copied to clipboard!', 'success');
    } catch (err) {
        console.error('Failed to copy:', err);
        showNotification('Failed to copy link', 'error');
    }
}

// ========== PROFILE PAGE FUNCTIONS ==========
async function initProfilePageGamerDisplay() {
    if (!db) {
        showError('Database service unavailable.');
        return;
    }
    
    if (!currentProfileId) {
        console.log('No profile ID found in URL');
        return;
    }
    
    console.log('Initializing profile page gamer display for profile ID:', currentProfileId);
    
    // Load gamer profile for the viewed profile
    await loadProfileGamerInfo(currentProfileId);
}

async function loadProfileGamerInfo(profileId) {
    if (!profileId) {
        console.log('No profile ID found in URL');
        return;
    }
    
    try {
        console.log('Loading gamer info for profile:', profileId);
        
        const gamerProfileRef = collection(db, 'users', profileId, 'gamerProfile');
        const gamerProfileQuery = query(gamerProfileRef);
        const gamerProfileSnap = await getDocs(gamerProfileQuery);
        
        if (!gamerProfileSnap.empty) {
            const profileData = gamerProfileSnap.docs[0].data();
            
            console.log('Found gamer profile:', profileData.gamerTag);
            
            // Show gamer badge
            const gamerBadge = document.getElementById('gamerBadge');
            if (gamerBadge) {
                gamerBadge.style.display = 'inline-flex';
            }
            
            // Show gamer profile section
            const gamerProfileSection = document.getElementById('gamerProfileSection');
            if (gamerProfileSection) {
                gamerProfileSection.style.display = 'block';
                
                // Update basic info
                const gamerBasicInfo = document.getElementById('gamerBasicInfo');
                if (gamerBasicInfo) {
                    let basicInfoHTML = '';
                    
                    if (profileData.primaryGame) {
                        basicInfoHTML += `
                            <div class="gamer-info-row">
                                <i class="fas fa-gamepad"></i>
                                <span><strong>Game:</strong> ${profileData.primaryGame}</span>
                            </div>
                        `;
                    }
                    
                    if (profileData.platform) {
                        basicInfoHTML += `
                            <div class="gamer-info-row">
                                <i class="fas fa-tv"></i>
                                <span><strong>Platform:</strong> ${profileData.platform}</span>
                            </div>
                        `;
                    }
                    
                    if (profileData.playStyle) {
                        basicInfoHTML += `
                            <div class="gamer-info-row">
                                <i class="fas fa-users"></i>
                                <span><strong>Play Style:</strong> ${profileData.playStyle}</span>
                            </div>
                        `;
                    }
                    
                    gamerBasicInfo.innerHTML = basicInfoHTML;
                }
                
                // Update stats grid
                const gamerStatsGrid = document.getElementById('gamerStatsGrid');
                if (gamerStatsGrid) {
                    let statsHTML = '';
                    
                    const stats = [
                        { label: 'Rank', value: profileData.rank, icon: 'fa-trophy' },
                        { label: 'Level', value: profileData.level, icon: 'fa-level-up-alt' },
                        { label: 'K/D', value: profileData.kdRatio, icon: 'fa-crosshairs' },
                        { label: 'Win Rate', value: profileData.winRate ? `${profileData.winRate}%` : null, icon: 'fa-chart-line' },
                        { label: 'Total Kills', value: profileData.totalKills, icon: 'fa-skull' },
                        { label: 'Hours', value: profileData.hoursPlayed, icon: 'fa-clock' }
                    ];
                    
                    stats.forEach(stat => {
                        if (stat.value) {
                            statsHTML += `
                                <div class="gamer-stat-card">
                                    <div class="stat-value">${stat.value}</div>
                                    <div class="stat-label">${stat.label}</div>
                                </div>
                            `;
                        }
                    });
                    
                    gamerStatsGrid.innerHTML = statsHTML;
                }
                
                // Show screenshot if available
                if (profileData.screenshotUrl) {
                    const gamerScreenshotContainer = document.getElementById('gamerScreenshotContainer');
                    const gamerScreenshot = document.getElementById('gamerScreenshot');
                    
                    if (gamerScreenshotContainer && gamerScreenshot) {
                        gamerScreenshot.src = profileData.screenshotUrl;
                        gamerScreenshotContainer.style.display = 'block';
                        
                        // Add click to open full screen
                        gamerScreenshot.addEventListener('click', () => {
                            openImageInFullScreen(profileData.screenshotUrl);
                        });
                    }
                }
                
                // Update view profile button
                const viewGamerProfileBtn = document.getElementById('viewGamerProfileBtn');
                if (viewGamerProfileBtn && profileData.publicProfileId) {
                    viewGamerProfileBtn.href = `gamersprofile.html?user=${profileId}&profile=${profileData.publicProfileId}`;
                } else if (viewGamerProfileBtn) {
                    viewGamerProfileBtn.style.display = 'none';
                }
            }
        } else {
            console.log('No gamer profile found for this user');
        }
    } catch (error) {
        console.error('Error loading profile gamer info:', error);
    }
}

// ========== UTILITY FUNCTIONS ==========
function showError(message) {
    const errorState = document.getElementById('errorState');
    const loadingState = document.getElementById('loadingState');
    const profileDetails = document.getElementById('profileDetails');
    
    if (loadingState) loadingState.style.display = 'none';
    if (profileDetails) profileDetails.style.display = 'none';
    if (errorState) {
        errorState.style.display = 'block';
        errorState.innerHTML = `
            <div style="text-align: center; padding: 2rem;">
                <i class="fas fa-exclamation-circle" style="font-size: 3rem; color: #ff2a6d; margin-bottom: 1rem;"></i>
                <h3 style="color: white; margin-bottom: 0.5rem;">Profile Error</h3>
                <p style="color: #aaa; margin-bottom: 1.5rem;">${message}</p>
                <div style="display: flex; gap: 1rem; justify-content: center;">
                    <button onclick="location.reload()" style="
                        background: #ff2a6d;
                        color: white;
                        border: none;
                        padding: 0.5rem 1.5rem;
                        border-radius: 20px;
                        cursor: pointer;
                        font-family: 'Segoe UI', system-ui, sans-serif;
                    ">
                        <i class="fas fa-redo"></i> Refresh
                    </button>
                    <a href="index.html" style="
                        background: rgba(255,255,255,0.1);
                        color: white;
                        border: 1px solid rgba(255,255,255,0.2);
                        padding: 0.5rem 1.5rem;
                        border-radius: 20px;
                        text-decoration: none;
                        display: inline-flex;
                        align-items: center;
                        gap: 0.5rem;
                        font-family: 'Segoe UI', system-ui, sans-serif;
                    ">
                        <i class="fas fa-home"></i> Home
                    </a>
                </div>
            </div>
        `;
    }
}

function openImageInFullScreen(imageUrl) {
    const modal = document.createElement('div');
    modal.className = 'image-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.95);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        animation: fadeIn 0.3s ease;
    `;
    
    modal.innerHTML = `
        <div class="modal-content">
            <img src="${imageUrl}" alt="Full Screen" class="modal-image">
            <button class="modal-close">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add modal styles
    const style = document.createElement('style');
    style.textContent = `
        .modal-content {
            position: relative;
            max-width: 90%;
            max-height: 90%;
        }
        .modal-image {
            max-width: 100%;
            max-height: 90vh;
            object-fit: contain;
            border-radius: 8px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.5);
        }
        .modal-close {
            position: absolute;
            top: -40px;
            right: -40px;
            background: rgba(255,255,255,0.1);
            border: none;
            color: white;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            font-size: 1.2rem;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            backdrop-filter: blur(10px);
            transition: all 0.3s ease;
            font-family: 'Segoe UI', system-ui, sans-serif;
        }
        .modal-close:hover {
            background: rgba(255,255,255,0.2);
            transform: scale(1.1);
        }
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
    `;
    document.head.appendChild(style);
    
    modal.querySelector('.modal-close').addEventListener('click', () => {
        modal.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => {
            if (modal.parentNode) {
                modal.parentNode.removeChild(modal);
            }
        }, 300);
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => {
                if (modal.parentNode) {
                    modal.parentNode.removeChild(modal);
                }
            }, 300);
        }
    });
}

function showNotification(message, type = 'info') {
    // Remove any existing notifications
    const existingNotifications = document.querySelectorAll('.custom-notification');
    existingNotifications.forEach(notification => notification.remove());
    
    const notification = document.createElement('div');
    notification.className = `custom-notification ${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'error' ? '#dc2626' : type === 'success' ? '#16a34a' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        animation: slideIn 0.3s ease;
        display: flex;
        align-items: center;
        gap: 10px;
        max-width: 400px;
        backdrop-filter: blur(10px);
        font-family: 'Segoe UI', system-ui, sans-serif;
    `;
    
    notification.innerHTML = `
        <i class="fas fa-${type === 'error' ? 'exclamation-circle' : type === 'success' ? 'check-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    // Add animation styles if not already added
    if (!document.getElementById('notification-animations')) {
        const style = document.createElement('style');
        style.id = 'notification-animations';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Make functions available globally
window.openImageInFullScreen = openImageInFullScreen;
window.showNotification = showNotification;