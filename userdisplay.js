// User Display Configuration - PROFILE CARD ONLY VERSION (PROPER ANIMATIONS)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, 
    doc, 
    setDoc, 
    getDoc, 
    updateDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { 
    getAuth,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Available wallpapers with direct image URLs
const AVAILABLE_WALLPAPERS = [
    {
        id: 'gradient_blue',
        name: 'Blue Gradient',
        url: 'https://images.unsplash.com/photo-1579546929662-711aa81148cf?w=500&q=80',
        type: 'image',
        theme: 'blue'
    },
    {
        id: 'gradient_purple',
        name: 'Purple Gradient',
        url: 'https://images.unsplash.com/photo-1550684376-efcbd6e3f031?w=500&q=80',
        type: 'image',
        theme: 'purple'
    },
    {
        id: 'nature_forest',
        name: 'Forest',
        url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=500&q=80',
        type: 'image',
        theme: 'green'
    },
    {
        id: 'beach_sunset',
        name: 'Beach Sunset',
        url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=500&q=80',
        type: 'image',
        theme: 'orange'
    },
    {
        id: 'mountain_peak',
        name: 'Mountain Peak',
        url: 'https://images.unsplash.com/photo-1464822759844-df37738d3fcb?w=500&q=80',
        type: 'image',
        theme: 'blue'
    },
    {
        id: 'city_lights',
        name: 'City Lights',
        url: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=500&q=80',
        type: 'image',
        theme: 'purple'
    },
    {
        id: 'abstract_art',
        name: 'Abstract Art',
        url: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=500&q=80',
        type: 'image',
        theme: 'multicolor'
    },
    {
        id: 'space_galaxy',
        name: 'Space Galaxy',
        url: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=500&q=80',
        type: 'image',
        theme: 'cosmic'
    },
    {
        id: 'water_drops',
        name: 'Water Drops',
        url: 'https://images.unsplash.com/photo-1418065460487-3e41a6c84dc5?w=500&q=80',
        type: 'image',
        theme: 'blue'
    },
    {
        id: 'fire_texture',
        name: 'Fire Texture',
        url: 'https://images.unsplash.com/photo-1513326738677-b964603b136d?w=500&q=80',
        type: 'image',
        theme: 'fire'
    }
];

// Available animations - COMPLETE with all animations
const AVAILABLE_ANIMATIONS = [
    {
        id: 'fire_glow',
        name: 'Fire Glow',
        description: 'Warm fire glow covering entire background',
        type: 'animation',
        theme: 'fire'
    },
    {
        id: 'cosmic_energy',
        name: 'Cosmic Energy',
        description: 'Pulsating cosmic energy waves',
        type: 'animation',
        theme: 'cosmic'
    },
    {
        id: 'floating_hearts',
        name: 'Floating Hearts',
        description: 'Romantic floating hearts everywhere',
        type: 'animation',
        theme: 'romantic'
    },
    {
        id: 'neon_pulse',
        name: 'Neon Pulse',
        description: 'Vibrant neon color pulses',
        type: 'animation',
        theme: 'neon'
    },
    {
        id: 'starry_night',
        name: 'Starry Night',
        description: 'Twinkling stars in dark sky',
        type: 'animation',
        theme: 'starry'
    },
    {
        id: 'magic_sparkles',
        name: 'Magic Sparkles',
        description: 'Magical sparkling particles everywhere',
        type: 'animation',
        theme: 'magic'
    },
    {
        id: 'liquid_gold',
        name: 'Liquid Gold',
        description: 'Flowing golden liquid waves',
        type: 'animation',
        theme: 'gold'
    },
    {
        id: 'northern_lights',
        name: 'Northern Lights',
        description: 'Beautiful aurora color waves',
        type: 'animation',
        theme: 'aurora'
    },
    {
        id: 'digital_matrix',
        name: 'Digital Matrix',
        description: 'Futuristic digital rain effect',
        type: 'animation',
        theme: 'matrix'
    },
    {
        id: 'energy_field',
        name: 'Energy Field',
        description: 'Pulsating energy field background',
        type: 'animation',
        theme: 'energy'
    }
];

class UserDisplayManager {
    constructor(db, currentUser) {
        this.db = db;
        this.currentUser = currentUser;
        this.currentDisplay = null;
        this.isApplying = false;
        this.initialized = false;
        this.activeAnimations = new Map();
        this.cleanupTimeout = null;
        this.isMobile = this.detectMobile();
        
        this.initializeManager();
        this.injectProfileCardStyles();
    }

    detectMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    // NEW: Inject styles specifically for profile card effects
    injectProfileCardStyles() {
        if (document.getElementById('profile-card-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'profile-card-styles';
        style.textContent = `
            /* Profile card container for effects */
            .profile-card-effects-container {
                position: relative !important;
                width: 100% !important;
                height: 100% !important;
                border-radius: 20px !important;
                overflow: hidden !important;
                isolation: isolate !important;
            }

            /* Profile card background with blur effect */
            .profile-card-background {
                position: absolute !important;
                top: 0 !important;
                left: 0 !important;
                width: 100% !important;
                height: 100% !important;
                border-radius: 20px !important;
                z-index: -1 !important;
                backdrop-filter: blur(10px) !important;
                -webkit-backdrop-filter: blur(10px) !important;
                background: rgba(255, 255, 255, 0.1) !important;
                overflow: hidden !important;
            }

            /* Profile card content - stays on top */
            .profile-card-content {
                position: relative !important;
                z-index: 10 !important;
                width: 100% !important;
                height: 100% !important;
            }

            /* Wallpaper for profile card only */
            .profile-card-wallpaper {
                position: absolute !important;
                top: 0 !important;
                left: 0 !important;
                width: 100% !important;
                height: 100% !important;
                border-radius: 20px !important;
                background-size: cover !important;
                background-position: center !important;
                background-repeat: no-repeat !important;
                z-index: -2 !important;
                opacity: 0.7 !important;
            }

            /* Animation for profile card only - NO BLUR */
            .profile-card-animation {
                position: absolute !important;
                top: 0 !important;
                left: 0 !important;
                width: 100% !important;
                height: 100% !important;
                border-radius: 20px !important;
                z-index: -3 !important;
                overflow: hidden !important;
                pointer-events: none !important;
                backdrop-filter: none !important;
                -webkit-backdrop-filter: none !important;
                filter: none !important;
            }

            /* Ensure profile card has proper styling */
            .profile-card, .profile-container, .user-profile, .profile-view-container, .profile-details {
                position: relative !important;
                background: transparent !important;
                border: none !important;
                box-shadow: none !important;
            }

            /* Animation styles for floating hearts */
            @keyframes floatHeartUp {
                0% {
                    transform: translateX(0) translateY(0) rotate(0deg) scale(0.8);
                    opacity: 0.7;
                }
                100% {
                    transform: translateX(var(--heart-translate-x, 0px)) translateY(-100%) rotate(var(--heart-rotate, 0deg)) scale(1.2);
                    opacity: 0;
                }
            }

            /* Animation styles for magic sparkles */
            @keyframes sparkleTwinkle {
                0%, 100% { 
                    opacity: 0; 
                    transform: scale(0.5) rotate(0deg); 
                }
                50% { 
                    opacity: 1; 
                    transform: scale(1.2) rotate(180deg); 
                }
            }

            /* Ensure crisp rendering for profile card animations */
            .profile-card-animation canvas {
                image-rendering: -webkit-optimize-contrast !important;
                image-rendering: crisp-edges !important;
                border-radius: 20px !important;
            }

            /* Mobile optimizations */
            @media (max-width: 768px) {
                .profile-card-animation {
                    transform: translateZ(0) !important;
                    backface-visibility: hidden !important;
                    perspective: 1000 !important;
                }
                
                .profile-card-wallpaper {
                    filter: none !important;
                }
            }
        `;
        document.head.appendChild(style);
    }

    async initializeManager() {
        try {
            const settings = await this.loadUserDisplay();
            this.currentDisplay = settings;
            this.initialized = true;
            
            // Apply display immediately if on profile page
            if (this.isProfilePage()) {
                setTimeout(() => {
                    this.applyDisplayToProfile();
                }, 500);
            }
        } catch (error) {
            this.currentDisplay = this.getDefaultSettings();
            this.initialized = true;
        }
    }

    hasCustomDisplaySettings() {
        if (!this.currentDisplay) return false;
        
        const defaultSettings = this.getDefaultSettings();
        const hasCustomWallpaper = this.currentDisplay.wallpaper && 
                                 this.currentDisplay.wallpaper !== defaultSettings.wallpaper;
        const hasCustomAnimation = this.currentDisplay.animation && 
                                 this.currentDisplay.animation !== defaultSettings.animation;
        
        return hasCustomWallpaper || hasCustomAnimation;
    }

    isProfilePage() {
        return window.location.pathname.includes('profile.html') || 
               window.location.pathname.endsWith('profile.html') ||
               document.querySelector('.profile-view-container') !== null ||
               document.querySelector('.profile-details') !== null;
    }

    async loadUserDisplay() {
        try {
            if (!this.currentUser || !this.currentUser.uid) {
                return this.getDefaultSettings();
            }

            const userRef = doc(this.db, 'users', this.currentUser.uid);
            const userSnap = await getDoc(userRef);
            
            if (userSnap.exists()) {
                const userData = userSnap.data();
                const displaySettings = userData.displaySettings;
                
                if (displaySettings && this.hasValidCustomSettings(displaySettings)) {
                    return displaySettings;
                } else {
                    return this.getDefaultSettings();
                }
            } else {
                return this.getDefaultSettings();
            }
        } catch (error) {
            return this.getDefaultSettings();
        }
    }

    hasValidCustomSettings(settings) {
        if (!settings) return false;
        
        const defaultSettings = this.getDefaultSettings();
        const hasValidWallpaper = settings.wallpaper && 
                                settings.wallpaper !== defaultSettings.wallpaper &&
                                this.isValidWallpaper(settings.wallpaper);
        const hasValidAnimation = settings.animation && 
                                settings.animation !== defaultSettings.animation;
        
        return hasValidWallpaper || hasValidAnimation;
    }

    async loadUserDisplayForProfile(userId) {
        try {
            if (!userId) {
                return this.getDefaultSettings();
            }

            if (userId === this.currentUser?.uid) {
                return this.currentDisplay || this.getDefaultSettings();
            }

            const userRef = doc(this.db, 'users', userId);
            const userSnap = await getDoc(userRef);
            
            if (userSnap.exists()) {
                const userData = userSnap.data();
                const displaySettings = userData.displaySettings;
                
                if (displaySettings && this.hasValidCustomSettings(displaySettings)) {
                    return displaySettings;
                }
            }
            
            return this.getDefaultSettings();
        } catch (error) {
            return this.getDefaultSettings();
        }
    }

    isValidWallpaper(wallpaperId) {
        return AVAILABLE_WALLPAPERS.some(w => w.id === wallpaperId);
    }

    isValidAnimation(animationId) {
        return AVAILABLE_ANIMATIONS.some(a => a.id === animationId);
    }

    getDefaultSettings() {
        return {
            wallpaper: null,
            animation: null,
            customBackground: null
        };
    }

    async saveDisplaySettings(settings) {
        try {
            if (!this.currentUser || !this.currentUser.uid) {
                return false;
            }

            if (this.cleanupTimeout) {
                clearTimeout(this.cleanupTimeout);
                this.cleanupTimeout = null;
            }

            if (settings.wallpaper && settings.animation) {
                if (settings.wallpaper && this.currentDisplay?.animation) {
                    settings.animation = null;
                } else if (settings.animation && this.currentDisplay?.wallpaper) {
                    settings.wallpaper = null;
                }
            }

            if (settings.wallpaper && !this.isValidWallpaper(settings.wallpaper)) {
                settings.wallpaper = null;
            }

            if (settings.animation && !this.isValidAnimation(settings.animation)) {
                settings.animation = null;
            }

            const userRef = doc(this.db, 'users', this.currentUser.uid);
            
            const userSnap = await getDoc(userRef);
            if (!userSnap.exists()) {
                await setDoc(userRef, {
                    email: this.currentUser.email,
                    createdAt: serverTimestamp(),
                    displaySettings: settings
                });
            } else {
                await updateDoc(userRef, {
                    displaySettings: settings,
                    updatedAt: serverTimestamp()
                });
            }
            
            this.currentDisplay = settings;
            
            if (this.isProfilePage()) {
                setTimeout(() => {
                    this.applyDisplayToProfile();
                }, 100);
            }
            
            return true;
        } catch (error) {
            return false;
        }
    }

    // NEW: Setup profile card structure for effects
    setupProfileCardStructure() {
        const profileCards = document.querySelectorAll('.profile-card, .profile-container, .user-profile, .profile-view-container, .profile-details');
        
        profileCards.forEach(card => {
            // Skip if already structured
            if (card.querySelector('.profile-card-effects-container')) {
                return;
            }

            const originalContent = card.innerHTML;
            
            // Wrap in effects container
            card.innerHTML = `
                <div class="profile-card-effects-container">
                    <div class="profile-card-background"></div>
                    <div class="profile-card-content">
                        ${originalContent}
                    </div>
                </div>
            `;
            
            // Ensure card has proper styling
            card.style.cssText += `
                background: transparent !important;
                border-radius: 20px !important;
                overflow: hidden !important;
                position: relative !important;
            `;
        });
    }

    applyDisplayToProfile() {
        if (this.isApplying) {
            return;
        }
        
        this.isApplying = true;
        
        try {
            // Setup profile card structure first
            this.setupProfileCardStructure();
            
            // Clear everything first
            this.removeExistingAnimations();

            setTimeout(() => {
                // Apply wallpaper OR animation (not both) to profile card only
                if (this.currentDisplay?.wallpaper && this.isValidWallpaper(this.currentDisplay.wallpaper)) {
                    this.applyWallpaperToProfileCard(this.currentDisplay.wallpaper);
                } else if (this.currentDisplay?.animation && this.isValidAnimation(this.currentDisplay.animation)) {
                    this.applyAnimationToProfileCard(this.currentDisplay.animation);
                }

                this.isApplying = false;
            }, 50);
            
        } catch (error) {
            this.isApplying = false;
        }
    }

    // MODIFIED: Apply wallpaper to profile card only - NO BLUR ON MOBILE
    applyWallpaperToProfileCard(wallpaperId) {
        const wallpaper = AVAILABLE_WALLPAPERS.find(w => w.id === wallpaperId);
        if (!wallpaper) {
            return;
        }

        const profileCards = document.querySelectorAll('.profile-card-effects-container');
        
        profileCards.forEach(container => {
            // Remove existing wallpaper
            const existingWallpaper = container.querySelector('.profile-card-wallpaper');
            if (existingWallpaper) {
                existingWallpaper.remove();
            }

            const wallpaperElement = document.createElement('div');
            wallpaperElement.className = 'profile-card-wallpaper';
            wallpaperElement.setAttribute('data-wallpaper-id', wallpaperId);
            
            // NO BLUR FILTER - this was causing the blurriness
            wallpaperElement.style.cssText = `
                position: absolute !important;
                top: 0 !important;
                left: 0 !important;
                width: 100% !important;
                height: 100% !important;
                border-radius: 20px !important;
                background-image: url('${wallpaper.url}') !important;
                background-size: cover !important;
                background-position: center !important;
                background-repeat: no-repeat !important;
                z-index: -2 !important;
                opacity: 0.7 !important;
            `;

            container.appendChild(wallpaperElement);
        });
    }

    // MODIFIED: Apply animation to profile card only
    applyAnimationToProfileCard(animationId) {
        const animation = AVAILABLE_ANIMATIONS.find(a => a.id === animationId);
        if (!animation) {
            return;
        }

        const profileCards = document.querySelectorAll('.profile-card-effects-container');
        
        profileCards.forEach(container => {
            // Remove existing animation
            const existingAnimation = container.querySelector('.profile-card-animation');
            if (existingAnimation) {
                existingAnimation.remove();
            }

            const animationContainer = document.createElement('div');
            animationContainer.className = 'profile-card-animation';
            animationContainer.setAttribute('data-animation-id', animationId);
            animationContainer.style.cssText = `
                position: absolute !important;
                top: 0 !important;
                left: 0 !important;
                width: 100% !important;
                height: 100% !important;
                border-radius: 20px !important;
                pointer-events: none !important;
                z-index: -3 !important;
                overflow: hidden !important;
                backdrop-filter: none !important;
                -webkit-backdrop-filter: none !important;
                filter: none !important;
            `;

            container.appendChild(animationContainer);
            
            try {
                this.createSpecificAnimationForProfileCard(animationId, animationContainer);
            } catch (error) {
                if (animationContainer.parentNode) {
                    animationContainer.remove();
                }
            }
        });
    }

    // MODIFIED: Create REAL animations scaled for profile card with MOBILE OPTIMIZATIONS
    createSpecificAnimationForProfileCard(animationId, container) {
        if (!this.activeAnimations) {
            this.activeAnimations = new Map();
        }
        
        let stopAnimation = () => {};
        
        switch(animationId) {
            case 'fire_glow':
                stopAnimation = this.createFireGlowAnimationForProfileCard(container);
                break;
            case 'cosmic_energy':
                stopAnimation = this.createCosmicEnergyAnimationForProfileCard(container);
                break;
            case 'floating_hearts':
                stopAnimation = this.createFloatingHeartsAnimationForProfileCard(container);
                break;
            case 'neon_pulse':
                stopAnimation = this.createNeonPulseAnimationForProfileCard(container);
                break;
            case 'starry_night':
                stopAnimation = this.createStarryNightAnimationForProfileCard(container);
                break;
            case 'magic_sparkles':
                stopAnimation = this.createMagicSparklesAnimationForProfileCard(container);
                break;
            case 'liquid_gold':
                stopAnimation = this.createLiquidGoldAnimationForProfileCard(container);
                break;
            case 'northern_lights':
                stopAnimation = this.createNorthernLightsAnimationForProfileCard(container);
                break;
            case 'digital_matrix':
                stopAnimation = this.createDigitalMatrixAnimationForProfileCard(container);
                break;
            case 'energy_field':
                stopAnimation = this.createEnergyFieldAnimationForProfileCard(container);
                break;
            default:
                // Unknown animation - use cosmic as fallback
                stopAnimation = this.createCosmicEnergyAnimationForProfileCard(container);
        }
        
        this.activeAnimations.set(animationId, { container, stopAnimation });
    }

    // OPTIMIZED: Fire glow animation - REAL FIRE EFFECT
    createFireGlowAnimationForProfileCard(container) {
        try {
            const canvas = document.createElement('canvas');
            const pixelRatio = this.isMobile ? 1 : 1;
            canvas.width = container.clientWidth * pixelRatio;
            canvas.height = container.clientHeight * pixelRatio;
            
            canvas.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                display: block;
                border-radius: 20px;
            `;
            container.appendChild(canvas);

            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = false;
            
            const particles = [];
            const particleCount = this.isMobile ? 20 : 30;
            let animationId;
            let frameCount = 0;

            for (let i = 0; i < particleCount; i++) {
                particles.push({
                    x: Math.random() * container.clientWidth,
                    y: container.clientHeight + Math.random() * 50,
                    size: 2 + Math.random() * 6,
                    speed: 0.3 + Math.random() * 1.2,
                    sway: Math.random() * 2 - 1,
                    hue: 15 + Math.random() * 20,
                    alpha: 0.3 + Math.random() * 0.4
                });
            }

            function animate() {
                if (!canvas.parentNode) return;
                
                const width = container.clientWidth;
                const height = container.clientHeight;
                
                frameCount++;
                
                // Clear with trail effect
                ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
                ctx.fillRect(0, 0, width, height);
                
                // Update and draw particles
                particles.forEach(particle => {
                    particle.y -= particle.speed;
                    particle.x += particle.sway * 0.3;
                    particle.alpha *= 0.99;
                    
                    if (particle.y < -20 || particle.alpha < 0.05) {
                        particle.y = height + Math.random() * 50;
                        particle.x = Math.random() * width;
                        particle.alpha = 0.3 + Math.random() * 0.4;
                    }
                    
                    const gradient = ctx.createRadialGradient(
                        particle.x, particle.y, 0,
                        particle.x, particle.y, particle.size
                    );
                    gradient.addColorStop(0, `hsla(${particle.hue}, 100%, 60%, ${particle.alpha})`);
                    gradient.addColorStop(1, `hsla(${particle.hue + 10}, 100%, 40%, 0)`);
                    
                    ctx.fillStyle = gradient;
                    ctx.beginPath();
                    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
                    ctx.fill();
                });
                
                animationId = requestAnimationFrame(animate);
            }
            
            animate();
            
            return () => {
                if (animationId) {
                    cancelAnimationFrame(animationId);
                }
            };
        } catch (error) {
            return () => {};
        }
    }

    // OPTIMIZED: Cosmic energy animation - REAL PULSING WAVES
    createCosmicEnergyAnimationForProfileCard(container) {
        try {
            const canvas = document.createElement('canvas');
            const pixelRatio = 1;
            canvas.width = container.clientWidth * pixelRatio;
            canvas.height = container.clientHeight * pixelRatio;
            
            canvas.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                display: block;
                border-radius: 20px;
            `;
            container.appendChild(canvas);

            const ctx = canvas.getContext('2d');
            
            let time = 0;
            let animationId;

            function animate() {
                if (!canvas.parentNode) return;
                
                const width = container.clientWidth;
                const height = container.clientHeight;
                
                time += 0.02;
                
                // Cosmic background
                ctx.fillStyle = 'rgba(10, 0, 30, 0.8)';
                ctx.fillRect(0, 0, width, height);
                
                // Pulsing energy waves
                for (let i = 0; i < 3; i++) {
                    const pulse = (Math.sin(time + i) + 1) * 0.5;
                    const radius = (width / 4) * pulse;
                    
                    const gradient = ctx.createRadialGradient(
                        width / 2, height / 2, 0,
                        width / 2, height / 2, radius
                    );
                    gradient.addColorStop(0, `hsla(${200 + i * 30}, 100%, 60%, ${0.3 * pulse})`);
                    gradient.addColorStop(1, 'transparent');
                    
                    ctx.fillStyle = gradient;
                    ctx.beginPath();
                    ctx.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
                    ctx.fill();
                }
                
                // Energy particles
                for (let i = 0; i < (this.isMobile ? 15 : 25); i++) {
                    const angle = time * 0.5 + i * 0.2;
                    const distance = 20 + Math.sin(time + i) * 15;
                    const x = width / 2 + Math.cos(angle) * distance;
                    const y = height / 2 + Math.sin(angle) * distance;
                    
                    ctx.fillStyle = `hsla(${240 + Math.sin(time + i) * 60}, 100%, 70%, 0.8)`;
                    ctx.beginPath();
                    ctx.arc(x, y, 1, 0, Math.PI * 2);
                    ctx.fill();
                }
                
                animationId = requestAnimationFrame(animate);
            }
            
            animate();
            
            return () => {
                if (animationId) {
                    cancelAnimationFrame(animationId);
                }
            };
        } catch (error) {
            return () => {};
        }
    }

    // OPTIMIZED: Floating hearts animation - REAL HEARTS
    createFloatingHeartsAnimationForProfileCard(container) {
        try {
            const hearts = [];
            const heartCount = this.isMobile ? 6 : 8;
            let intervalId;

            function createHeart() {
                const heart = document.createElement('div');
                heart.innerHTML = '💖';
                const translateX = (Math.random() * 40 - 20);
                const rotate = Math.random() * 360;
                
                heart.style.cssText = `
                    position: absolute;
                    font-size: ${12 + Math.random() * 12}px;
                    left: ${Math.random() * 100}%;
                    top: 110%;
                    opacity: ${0.3 + Math.random() * 0.6};
                    animation: floatHeartUp ${4 + Math.random() * 4}s linear forwards;
                    pointer-events: none;
                    z-index: 1;
                    filter: drop-shadow(0 0 5px rgba(255, 105, 180, 0.5));
                    --heart-translate-x: ${translateX}px;
                    --heart-rotate: ${rotate}deg;
                `;

                container.appendChild(heart);
                hearts.push(heart);

                setTimeout(() => {
                    if (heart.parentNode) {
                        heart.remove();
                        hearts.splice(hearts.indexOf(heart), 1);
                    }
                }, 8000);
            }

            for (let i = 0; i < heartCount; i++) {
                setTimeout(createHeart, i * 600);
            }

            const interval = this.isMobile ? 1500 : 1000;
            intervalId = setInterval(createHeart, interval);
            
            return () => {
                if (intervalId) {
                    clearInterval(intervalId);
                }
                hearts.forEach(heart => {
                    if (heart.parentNode) heart.remove();
                });
                hearts.length = 0;
            };
        } catch (error) {
            return () => {};
        }
    }

    // OPTIMIZED: Neon pulse animation - REAL NEON GRID
    createNeonPulseAnimationForProfileCard(container) {
        try {
            const canvas = document.createElement('canvas');
            const pixelRatio = 1;
            canvas.width = container.clientWidth * pixelRatio;
            canvas.height = container.clientHeight * pixelRatio;
            
            canvas.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                display: block;
                border-radius: 20px;
            `;
            container.appendChild(canvas);

            const ctx = canvas.getContext('2d');
            
            let time = 0;
            let animationId;

            function animate() {
                if (!canvas.parentNode) return;
                
                const width = container.clientWidth;
                const height = container.clientHeight;
                
                time += 0.03;
                
                // Dark background
                ctx.fillStyle = 'rgba(0, 0, 10, 0.9)';
                ctx.fillRect(0, 0, width, height);
                
                // Neon grid
                const gridSize = 30;
                const pulse = (Math.sin(time) + 1) * 0.5;
                
                for (let x = 0; x < width; x += gridSize) {
                    for (let y = 0; y < height; y += gridSize) {
                        const dist = Math.sqrt(Math.pow(x - width/2, 2) + Math.pow(y - height/2, 2));
                        const intensity = (Math.sin(time + dist * 0.02) + 1) * 0.5;
                        
                        ctx.strokeStyle = `hsla(${200 + intensity * 160}, 100%, 60%, ${0.3 + intensity * 0.4})`;
                        ctx.lineWidth = 1 + intensity * 2;
                        ctx.beginPath();
                        ctx.arc(x, y, 3 + intensity * 8, 0, Math.PI * 2);
                        ctx.stroke();
                    }
                }
                
                // Pulsing center
                const centerGradient = ctx.createRadialGradient(
                    width/2, height/2, 0,
                    width/2, height/2, 100
                );
                centerGradient.addColorStop(0, `hsla(${300 + Math.sin(time) * 60}, 100%, 70%, ${0.3 * pulse})`);
                centerGradient.addColorStop(1, 'transparent');
                
                ctx.fillStyle = centerGradient;
                ctx.beginPath();
                ctx.arc(width/2, height/2, 100, 0, Math.PI * 2);
                ctx.fill();
                
                animationId = requestAnimationFrame(animate);
            }
            
            animate();
            
            return () => {
                if (animationId) {
                    cancelAnimationFrame(animationId);
                }
            };
        } catch (error) {
            return () => {};
        }
    }

    // OPTIMIZED: Starry night animation - REAL TWINKLING STARS
    createStarryNightAnimationForProfileCard(container) {
        try {
            const canvas = document.createElement('canvas');
            const pixelRatio = 1;
            canvas.width = container.clientWidth * pixelRatio;
            canvas.height = container.clientHeight * pixelRatio;
            
            canvas.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                display: block;
                border-radius: 20px;
            `;
            container.appendChild(canvas);

            const ctx = canvas.getContext('2d');
            
            const stars = [];
            const starCount = this.isMobile ? 25 : 40;
            let animationId;

            // Create stars
            for (let i = 0; i < starCount; i++) {
                stars.push({
                    x: Math.random() * container.clientWidth,
                    y: Math.random() * container.clientHeight,
                    size: Math.random() * 1.5,
                    brightness: Math.random() * 0.8 + 0.2,
                    twinkleSpeed: Math.random() * 0.05
                });
            }

            let time = 0;

            function animate() {
                if (!canvas.parentNode) return;
                
                const width = container.clientWidth;
                const height = container.clientHeight;
                
                time += 0.016;
                
                // Dark blue background
                ctx.fillStyle = 'rgba(5, 5, 20, 0.95)';
                ctx.fillRect(0, 0, width, height);
                
                // Draw stars
                stars.forEach(star => {
                    const twinkle = (Math.sin(time * star.twinkleSpeed) + 1) * 0.5;
                    const currentBrightness = star.brightness * (0.5 + twinkle * 0.5);
                    
                    ctx.fillStyle = `rgba(255, 255, 255, ${currentBrightness})`;
                    ctx.beginPath();
                    ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
                    ctx.fill();
                });
                
                animationId = requestAnimationFrame(animate);
            }
            
            animate();
            
            return () => {
                if (animationId) {
                    cancelAnimationFrame(animationId);
                }
            };
        } catch (error) {
            return () => {};
        }
    }

    // OPTIMIZED: Magic sparkles animation - REAL SPARKLES
    createMagicSparklesAnimationForProfileCard(container) {
        try {
            const sparkles = [];
            const sparkleCount = this.isMobile ? 10 : 15;
            let intervalId;

            function createSparkle() {
                const sparkle = document.createElement('div');
                sparkle.innerHTML = '✨';
                sparkle.style.cssText = `
                    position: absolute;
                    font-size: ${12 + Math.random() * 12}px;
                    left: ${Math.random() * 100}%;
                    top: ${Math.random() * 100}%;
                    opacity: 0;
                    animation: sparkleTwinkle ${2 + Math.random() * 2}s ease-in-out infinite;
                    pointer-events: none;
                    z-index: 1;
                    filter: drop-shadow(0 0 5px gold);
                `;

                container.appendChild(sparkle);
                sparkles.push(sparkle);

                setTimeout(() => {
                    if (sparkle.parentNode) {
                        sparkle.remove();
                        sparkles.splice(sparkles.indexOf(sparkle), 1);
                    }
                }, 4000);
            }

            for (let i = 0; i < sparkleCount; i++) {
                setTimeout(createSparkle, i * 400);
            }

            const interval = this.isMobile ? 800 : 600;
            intervalId = setInterval(createSparkle, interval);
            
            return () => {
                if (intervalId) {
                    clearInterval(intervalId);
                }
                sparkles.forEach(sparkle => {
                    if (sparkle.parentNode) sparkle.remove();
                });
                sparkles.length = 0;
            };
        } catch (error) {
            return () => {};
        }
    }

    // OPTIMIZED: Liquid gold animation - REAL FLOWING WAVES
    createLiquidGoldAnimationForProfileCard(container) {
        try {
            const canvas = document.createElement('canvas');
            const pixelRatio = 1;
            canvas.width = container.clientWidth * pixelRatio;
            canvas.height = container.clientHeight * pixelRatio;
            
            canvas.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                display: block;
                border-radius: 20px;
            `;
            container.appendChild(canvas);

            const ctx = canvas.getContext('2d');
            
            let time = 0;
            let animationId;

            function animate() {
                if (!canvas.parentNode) return;
                
                const width = container.clientWidth;
                const height = container.clientHeight;
                
                time += 0.02;
                
                // Golden background
                const gradient = ctx.createLinearGradient(0, 0, width, height);
                gradient.addColorStop(0, 'rgba(50, 30, 0, 0.3)');
                gradient.addColorStop(0.5, 'rgba(100, 70, 0, 0.2)');
                gradient.addColorStop(1, 'rgba(150, 100, 0, 0.3)');
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, width, height);
                
                // Liquid gold waves
                for (let i = 0; i < 2; i++) {
                    const waveGradient = ctx.createLinearGradient(0, 0, 0, height);
                    waveGradient.addColorStop(0, `hsla(${45 + i * 5}, 100%, 50%, 0.3)`);
                    waveGradient.addColorStop(0.5, `hsla(${50 + i * 5}, 100%, 60%, 0.4)`);
                    waveGradient.addColorStop(1, `hsla(${55 + i * 5}, 100%, 40%, 0.2)`);
                    
                    ctx.fillStyle = waveGradient;
                    ctx.beginPath();
                    
                    const baseY = 50 + i * 40;
                    const amplitude = 15 + Math.sin(time + i) * 10;
                    
                    ctx.moveTo(0, baseY + Math.sin(time + i) * amplitude);
                    
                    for (let x = 0; x < width; x += 5) {
                        const y = baseY + 
                                 Math.sin(x * 0.02 + time + i) * amplitude +
                                 Math.cos(x * 0.016 + time * 1.3 + i) * amplitude * 0.7;
                        ctx.lineTo(x, y);
                    }
                    
                    ctx.lineTo(width, height);
                    ctx.lineTo(0, height);
                    ctx.closePath();
                    ctx.fill();
                }
                
                animationId = requestAnimationFrame(animate);
            }
            
            animate();
            
            return () => {
                if (animationId) {
                    cancelAnimationFrame(animationId);
                }
            };
        } catch (error) {
            return () => {};
        }
    }

    // OPTIMIZED: Northern lights animation - REAL AURORA
    createNorthernLightsAnimationForProfileCard(container) {
        try {
            const canvas = document.createElement('canvas');
            const pixelRatio = 1;
            canvas.width = container.clientWidth * pixelRatio;
            canvas.height = container.clientHeight * pixelRatio;
            
            canvas.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                display: block;
                border-radius: 20px;
            `;
            container.appendChild(canvas);

            const ctx = canvas.getContext('2d');
            
            let time = 0;
            let animationId;

            function animate() {
                if (!canvas.parentNode) return;
                
                const width = container.clientWidth;
                const height = container.clientHeight;
                
                time += 0.005;
                
                // Dark background
                ctx.fillStyle = 'rgba(5, 10, 20, 0.9)';
                ctx.fillRect(0, 0, width, height);
                
                // Aurora layers
                for (let i = 0; i < 3; i++) {
                    const gradient = ctx.createLinearGradient(0, 0, 0, height);
                    const hue = 160 + i * 20 + Math.sin(time + i) * 30;
                    
                    gradient.addColorStop(0, `hsla(${hue}, 80%, 60%, 0)`);
                    gradient.addColorStop(0.3, `hsla(${hue}, 90%, 70%, 0.3)`);
                    gradient.addColorStop(0.7, `hsla(${hue + 10}, 100%, 60%, 0.2)`);
                    gradient.addColorStop(1, `hsla(${hue + 20}, 80%, 50%, 0)`);
                    
                    ctx.fillStyle = gradient;
                    ctx.beginPath();
                    
                    const baseY = 40 + i * 30;
                    const amplitude = 20 + Math.sin(time * 0.5 + i) * 15;
                    
                    ctx.moveTo(0, baseY + Math.sin(time + i) * amplitude);
                    
                    for (let x = 0; x < width; x += 5) {
                        const y = baseY + 
                                 Math.sin(x * 0.016 + time + i) * amplitude +
                                 Math.cos(x * 0.012 + time * 1.5 + i) * amplitude * 0.8;
                        ctx.lineTo(x, y);
                    }
                    
                    ctx.lineTo(width, height);
                    ctx.lineTo(0, height);
                    ctx.closePath();
                    ctx.fill();
                }
                
                animationId = requestAnimationFrame(animate);
            }
            
            animate();
            
            return () => {
                if (animationId) {
                    cancelAnimationFrame(animationId);
                }
            };
        } catch (error) {
            return () => {};
        }
    }

    // OPTIMIZED: Digital matrix animation - REAL MATRIX RAIN
    createDigitalMatrixAnimationForProfileCard(container) {
        try {
            const canvas = document.createElement('canvas');
            const pixelRatio = 1;
            canvas.width = container.clientWidth * pixelRatio;
            canvas.height = container.clientHeight * pixelRatio;
            
            canvas.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                display: block;
                border-radius: 20px;
            `;
            container.appendChild(canvas);

            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = false;
            
            const width = container.clientWidth;
            const height = container.clientHeight;
            const fontSize = this.isMobile ? 10 : 12;
            const columns = Math.floor(width / fontSize);
            const drops = Array(columns).fill(1);
            let animationId;
            let frameCount = 0;

            function animate() {
                if (!canvas.parentNode) return;
                
                frameCount++;
                
                // Semi-transparent black for trail effect - less frequent on mobile
                if (frameCount % (this.isMobile ? 3 : 2) === 0) {
                    ctx.fillStyle = 'rgba(0, 10, 0, 0.1)';
                    ctx.fillRect(0, 0, width, height);
                }
                
                ctx.fillStyle = '#0f0';
                ctx.font = `${fontSize}px monospace`;
                
                // Draw matrix rain
                for (let i = 0; i < drops.length; i++) {
                    const text = String.fromCharCode(0x30A0 + Math.random() * 96);
                    const x = i * fontSize;
                    const y = drops[i] * fontSize;
                    
                    ctx.fillText(text, x, y);
                    
                    if (y > height && Math.random() > 0.975) {
                        drops[i] = 0;
                    }
                    
                    drops[i]++;
                }
                
                animationId = requestAnimationFrame(animate);
            }
            
            animate();
            
            return () => {
                if (animationId) {
                    cancelAnimationFrame(animationId);
                }
            };
        } catch (error) {
            return () => {};
        }
    }

    // OPTIMIZED: Energy field animation - REAL PULSING ORBS
    createEnergyFieldAnimationForProfileCard(container) {
        try {
            const canvas = document.createElement('canvas');
            const pixelRatio = 1;
            canvas.width = container.clientWidth * pixelRatio;
            canvas.height = container.clientHeight * pixelRatio;
            
            canvas.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                display: block;
                border-radius: 20px;
            `;
            container.appendChild(canvas);

            const ctx = canvas.getContext('2d');
            
            const width = container.clientWidth;
            const height = container.clientHeight;
            const orbs = [];
            let time = 0;
            let animationId;

            for (let i = 0; i < (this.isMobile ? 2 : 3); i++) {
                orbs.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    radius: 20 + Math.random() * 30,
                    speed: 0.2 + Math.random() * 0.3,
                    hue: Math.random() * 360
                });
            }

            function animate() {
                if (!canvas.parentNode) return;
                
                time += 0.02;
                
                // Energy field background
                const gradient = ctx.createLinearGradient(0, 0, width, height);
                gradient.addColorStop(0, 'rgba(0, 20, 40, 0.8)');
                gradient.addColorStop(1, 'rgba(20, 0, 40, 0.8)');
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, width, height);
                
                orbs.forEach(orb => {
                    orb.x += Math.cos(time * orb.speed) * 1;
                    orb.y += Math.sin(time * orb.speed) * 1;
                    
                    if (orb.x < 0) orb.x = width;
                    if (orb.x > width) orb.x = 0;
                    if (orb.y < 0) orb.y = height;
                    if (orb.y > height) orb.y = 0;
                    
                    const pulse = Math.sin(time * 2) * 0.2 + 0.8;
                    const currentRadius = orb.radius * pulse;
                    
                    const gradient = ctx.createRadialGradient(
                        orb.x, orb.y, 0,
                        orb.x, orb.y, currentRadius
                    );
                    gradient.addColorStop(0, `hsla(${orb.hue}, 100%, 70%, 0.8)`);
                    gradient.addColorStop(0.7, `hsla(${orb.hue}, 100%, 60%, 0.3)`);
                    gradient.addColorStop(1, 'transparent');
                    
                    ctx.fillStyle = gradient;
                    ctx.beginPath();
                    ctx.arc(orb.x, orb.y, currentRadius, 0, Math.PI * 2);
                    ctx.fill();
                });
                
                animationId = requestAnimationFrame(animate);
            }
            
            animate();
            
            return () => {
                if (animationId) {
                    cancelAnimationFrame(animationId);
                }
            };
        } catch (error) {
            return () => {};
        }
    }

    // Preview function
    previewDisplay(settings, previewContainerId = 'displayPreview') {
        const previewContainer = document.getElementById(previewContainerId);
        if (!previewContainer) return;

        // Setup preview container structure
        if (!previewContainer.querySelector('.profile-card-effects-container')) {
            previewContainer.innerHTML = `
                <div class="profile-card-effects-container" style="width: 100%; height: 200px;">
                    <div class="profile-card-background"></div>
                    <div class="profile-card-content" style="display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">
                        Preview Area
                    </div>
                </div>
            `;
        }

        const effectsContainer = previewContainer.querySelector('.profile-card-effects-container');
        
        // Clear existing effects
        const existingWallpaper = effectsContainer.querySelector('.profile-card-wallpaper');
        const existingAnimation = effectsContainer.querySelector('.profile-card-animation');
        if (existingWallpaper) existingWallpaper.remove();
        if (existingAnimation) existingAnimation.remove();

        setTimeout(() => {
            if (settings.wallpaper && this.isValidWallpaper(settings.wallpaper)) {
                this.applyWallpaperPreview(settings.wallpaper, effectsContainer);
            } else if (settings.animation && this.isValidAnimation(settings.animation)) {
                this.applyAnimationPreview(settings.animation, effectsContainer);
            }
        }, 50);
    }

    applyWallpaperPreview(wallpaperId, container) {
        const wallpaper = AVAILABLE_WALLPAPERS.find(w => w.id === wallpaperId);
        if (!wallpaper) return;

        const wallpaperElement = document.createElement('div');
        wallpaperElement.className = 'profile-card-wallpaper';
        wallpaperElement.style.cssText = `
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            border-radius: 20px !important;
            background-image: url('${wallpaper.url}') !important;
            background-size: cover !important;
            background-position: center !important;
            z-index: -2 !important;
            opacity: 0.7 !important;
        `;

        container.appendChild(wallpaperElement);
    }

    applyAnimationPreview(animationId, container) {
        const animation = AVAILABLE_ANIMATIONS.find(a => a.id === animationId);
        if (!animation) return;

        const animationContainer = document.createElement('div');
        animationContainer.className = 'profile-card-animation';
        animationContainer.style.cssText = `
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            border-radius: 20px !important;
            pointer-events: none !important;
            z-index: -3 !important;
            overflow: hidden !important;
        `;

        container.appendChild(animationContainer);
        this.createMagicSparklesAnimationForProfileCard(animationContainer);
    }

    async applyDisplayToUserProfile(userId) {
        if (this.isApplying) return;
        
        this.isApplying = true;
        
        try {
            const profileSettings = await this.loadUserDisplayForProfile(userId);
            this.setupProfileCardStructure();
            this.removeExistingAnimations();

            setTimeout(() => {
                if (profileSettings.wallpaper && this.isValidWallpaper(profileSettings.wallpaper)) {
                    this.applyWallpaperToProfileCard(profileSettings.wallpaper);
                } else if (profileSettings.animation && this.isValidAnimation(profileSettings.animation)) {
                    this.applyAnimationToProfileCard(profileSettings.animation);
                }
                this.isApplying = false;
            }, 50);
            
        } catch (error) {
            this.isApplying = false;
        }
    }

    removeExistingAnimations() {
        if (this.activeAnimations) {
            this.activeAnimations.forEach(({ stopAnimation }) => {
                if (typeof stopAnimation === 'function') {
                    stopAnimation();
                }
            });
            this.activeAnimations.clear();
        }
        
        // Remove only profile card specific elements
        const elementsToRemove = document.querySelectorAll('.profile-card-wallpaper, .profile-card-animation');
        elementsToRemove.forEach(element => {
            if (element.parentNode) {
                element.remove();
            }
        });
        
        // Remove canvases from profile cards
        const profileCards = document.querySelectorAll('.profile-card-effects-container');
        profileCards.forEach(container => {
            const canvases = container.querySelectorAll('canvas');
            canvases.forEach(canvas => {
                if (canvas.parentNode) {
                    canvas.remove();
                }
            });
        });
    }

    getAvailableWallpapers() {
        return AVAILABLE_WALLPAPERS;
    }

    getAvailableAnimations() {
        return AVAILABLE_ANIMATIONS;
    }
}

// Global user display manager instance
let userDisplayManager = null;

// Enhanced initialization
document.addEventListener('DOMContentLoaded', function() {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            userDisplayManager = new UserDisplayManager(db, user);
            window.userDisplayManager = userDisplayManager;
            
            setTimeout(() => {
                if (window.location.pathname.includes('profile.html') || 
                    document.querySelector('.profile-view-container')) {
                    
                    const urlParams = new URLSearchParams(window.location.search);
                    const profileUserId = urlParams.get('id');
                    
                    if (profileUserId && profileUserId !== user.uid) {
                        userDisplayManager.applyDisplayToUserProfile(profileUserId);
                    } else {
                        userDisplayManager.applyDisplayToProfile();
                    }
                }
            }, 1000);
        } else {
            userDisplayManager = null;
        }
    });
});

// Export for use in other modules
export { UserDisplayManager, userDisplayManager, AVAILABLE_WALLPAPERS, AVAILABLE_ANIMATIONS };

// Global function for manual triggering
window.applyUserDisplay = function() {
    if (window.userDisplayManager) {
        window.userDisplayManager.applyDisplayToProfile();
    }
};

// Global function to apply display for specific user
window.applyDisplayForUser = function(userId) {
    if (window.userDisplayManager) {
        window.userDisplayManager.applyDisplayToUserProfile(userId);
    }
};

// Global function for previewing display in account page
window.previewUserDisplay = function(settings, containerId = 'displayPreview') {
    if (window.userDisplayManager) {
        window.userDisplayManager.previewDisplay(settings, containerId);
    }
};