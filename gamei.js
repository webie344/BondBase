import * as THREE from 'three';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
    getAuth, 
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    getFirestore,
    collection,
    doc,
    setDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    query,
    orderBy,
    limit,
    getDocs,
    where,
    Timestamp,
    increment,
    arrayUnion,
    arrayRemove,
    serverTimestamp,
    addDoc
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
let app, auth, db;
try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    console.log('Firebase initialized for multiplayer');
} catch (error) {
    console.error('Firebase initialization error:', error);
}

// Gun sound
function playGunSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') {
            audioCtx.resume().then(() => createGunSound(audioCtx));
        } else {
            createGunSound(audioCtx);
        }
    } catch (e) {
        console.log('Audio not supported');
    }
}

function createGunSound(ctx) {
    try {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = 120;
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.2);
        
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'triangle';
        osc2.frequency.value = 240;
        gain2.gain.setValueAtTime(0.15, now);
        gain2.gain.exponentialRampToValueAtTime(0.005, now + 0.15);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now);
        osc2.stop(now + 0.15);
    } catch (e) {}
}

class Game {
    constructor() {
        console.log('🎮 MULTIPLAYER BATTLE ROYALE - FREE FIRE STYLE');
        
        // Firebase references
        this.currentUser = null;
        this.playerId = null;
        this.playerName = 'Player_' + Math.floor(Math.random() * 10000);
        this.playerRef = null;
        this.playersCollection = null;
        this.killsCollection = null;
        this.unsubscribePlayers = null;
        this.heartbeatInterval = null;
        this.firebaseReady = false;
        
        // Player meshes dictionary
        this.otherPlayers = new Map();
        
        // Interpolation for smooth movement
        this.playerPositions = new Map(); // Store target positions for interpolation
        this.lastUpdateTime = Date.now();
        
        // Initialize ALL arrays
        this.buildings = [];
        this.doors = [];
        this.ammoBoxes = [];
        this.bullets = [];
        this.trees = [];
        
        // Scene setup
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB);
        this.scene.fog = new THREE.Fog(0x87CEEB, 60, 200);
        
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 1.8, 15);
        this.camera.rotation.order = 'YXZ';
        
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        const gameContainer = document.getElementById('gameContainer');
        if (gameContainer) {
            gameContainer.appendChild(this.renderer.domElement);
        } else {
            document.body.appendChild(this.renderer.domElement);
        }
        
        // Game state - 3-shot kill system (33 damage per shot)
        this.health = 100;
        this.maxHealth = 100;
        this.damagePerShot = 33; // 3 shots to kill
        this.score = 0;
        this.kills = 0;
        this.ammo = 30;
        this.maxAmmo = 30;
        this.boxesCollected = 0;
        this.gameActive = false;
        
        // Kill feed
        this.killMessages = [];
        this.setupKillFeed();
        
        // Last damage info
        this.lastDamagedBy = null;
        this.lastDamageTime = 0;
        
        // Realistic movement
        this.moveX = 0; 
        this.moveY = 0;
        this.moveSpeed = 0.15;
        this.bobAmount = 0;
        this.bobSpeed = 0;
        this.footstepTime = 0;
        
        // Look
        this.lookYaw = 0; 
        this.lookPitch = 0;
        this.touchSensitivity = 0.006;
        
        // Building entry
        this.nearbyDoor = null;
        this.insideBuilding = false;
        this.currentBuilding = null;
        this.playerHeight = 1.8;
        
        // Joystick
        this.joystickActive = false;
        this.joystickTouchId = null;
        this.joystickMaxMove = 40;
        this.joystickThumb = document.getElementById('joystickThumb');
        this.joystickContainer = document.getElementById('joystickContainer');
        
        // Swipe
        this.swipeTouchId = null;
        this.lastSwipeX = 0; 
        this.lastSwipeY = 0;
        
        // Setup UI elements
        this.setupUIElements();
        
        // Setup everything
        this.setupLighting();
        this.setupGround();
        this.createRealisticBuildings();
        this.createSimpleEnvironment();
        this.spawnInitialAmmoBoxes(20);
        
        this.setupControls();
        this.setupMinimap();
        
        // Door check interval
        setInterval(() => this.checkNearbyDoors(), 200);
        
        // Set up auth state listener
        this.setupAuthListener();
        
        this.animate();
        
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
        
        // Cleanup on page unload
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });
    }
    
    setupAuthListener() {
        console.log('Setting up auth listener...');
        
        onAuthStateChanged(auth, (user) => {
            console.log('🔐 Auth state changed:', user ? 'User logged in' : 'No user');
            this.currentUser = user;
            
            if (user) {
                this.playerId = user.uid;
                
                try {
                    const userProfile = localStorage.getItem('currentUserProfile');
                    if (userProfile) {
                        const profile = JSON.parse(userProfile);
                        this.playerName = profile.name || this.playerName;
                    }
                } catch (e) {}
                
                console.log('✅ Player authenticated:', this.playerId, 'Name:', this.playerName);
                this.firebaseReady = true;
                
                this.setupFirebase();
                
                this.showNotification(`Welcome ${this.playerName}!`, 'success');
            } else {
                console.log('Playing in offline mode - no user logged in');
                this.firebaseReady = false;
                this.showNotification('Playing offline - login to play multiplayer', 'info');
            }
        }, (error) => {
            console.error('Auth error:', error);
            this.firebaseReady = false;
            this.showNotification('Auth failed - playing offline', 'error');
        });
    }
    
    setupFirebase() {
        if (!this.firebaseReady || !db) return;
        
        try {
            this.playersCollection = collection(db, 'game_players');
            this.killsCollection = collection(db, 'game_kills');
            this.playerRef = doc(this.playersCollection, this.playerId);
            
            const playerData = {
                id: this.playerId,
                name: this.playerName,
                position: {
                    x: this.camera.position.x,
                    y: this.camera.position.y,
                    z: this.camera.position.z
                },
                rotation: {
                    y: this.lookYaw,
                    x: this.lookPitch
                },
                health: this.health,
                ammo: this.ammo,
                kills: 0,
                alive: true,
                lastUpdate: serverTimestamp(),
                joinedAt: serverTimestamp()
            };
            
            setDoc(this.playerRef, playerData).catch(error => {
                console.error('Error adding player:', error);
                this.firebaseReady = false;
            });
            
            this.unsubscribePlayers = onSnapshot(this.playersCollection, (snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    const playerData = change.doc.data();
                    
                    if (playerData.id === this.playerId) return;
                    
                    if (change.type === 'added' || change.type === 'modified') {
                        if (playerData.alive) {
                            this.updateOrAddPlayer(playerData);
                        } else {
                            this.removePlayer(playerData.id);
                        }
                    } else if (change.type === 'removed') {
                        this.removePlayer(playerData.id);
                    }
                });
            }, (error) => {
                console.error('Player listener error:', error);
            });
            
            if (this.killsCollection) {
                const killsQuery = query(this.killsCollection, orderBy('timestamp', 'desc'), limit(20));
                onSnapshot(killsQuery, (snapshot) => {
                    snapshot.docChanges().forEach((change) => {
                        if (change.type === 'added') {
                            const killData = change.doc.data();
                            this.addKillToFeed(killData);
                        }
                    });
                }, (error) => {
                    console.error('Kill listener error:', error);
                });
            }
            
            this.heartbeatInterval = setInterval(() => {
                if (this.gameActive && this.playerId && this.playerRef && this.firebaseReady) {
                    updateDoc(this.playerRef, {
                        position: {
                            x: this.camera.position.x,
                            y: this.camera.position.y,
                            z: this.camera.position.z
                        },
                        rotation: {
                            y: this.lookYaw,
                            x: this.lookPitch
                        },
                        health: this.health,
                        ammo: this.ammo,
                        lastUpdate: serverTimestamp()
                    }).catch(error => {
                        console.error('Heartbeat error:', error);
                    });
                }
            }, 50); // Increased to 20 updates per second for smoother movement
            
            onSnapshot(collection(db, 'game_hits'), (snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'added') {
                        const hitData = change.doc.data();
                        if (hitData.targetId === this.playerId && this.gameActive) {
                            this.takeDamage(hitData.damage, hitData.shooterId, hitData.shooterName);
                        }
                    }
                });
            }, (error) => {
                console.log('Hit listener error:', error);
            });
            
        } catch (error) {
            console.error('Error setting up Firebase:', error);
            this.firebaseReady = false;
        }
    }
    
    setupKillFeed() {
        if (!document.getElementById('killFeed')) {
            const killFeed = document.createElement('div');
            killFeed.id = 'killFeed';
            killFeed.style.cssText = `
                position: fixed;
                top: 80px;
                right: 10px;
                width: 250px;
                z-index: 1000;
                pointer-events: none;
            `;
            document.body.appendChild(killFeed);
        }
        this.killFeedElement = document.getElementById('killFeed');
    }
    
    setupUIElements() {
        const requiredElements = ['healthValue', 'scoreValue', 'ammoValue', 'boxesValue', 'killsValue'];
        requiredElements.forEach(id => {
            if (!document.getElementById(id)) {
                const el = document.createElement('span');
                el.id = id;
                el.style.display = 'none';
                document.body.appendChild(el);
            }
        });
    }
    
    createRealisticPlayer(color = 0x3366ff, playerName = 'Player') {
        const group = new THREE.Group();
        
        // Body (more realistic proportions)
        const bodyGeo = new THREE.CylinderGeometry(0.4, 0.45, 1.6, 8);
        const bodyMat = new THREE.MeshStandardMaterial({ color: color, emissive: 0x111111 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.8;
        body.castShadow = true;
        body.receiveShadow = true;
        group.add(body);
        
        // Chest armor/vest detail
        const chestGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.6, 8);
        const chestMat = new THREE.MeshStandardMaterial({ color: 0x444444, emissive: 0x111111 });
        const chest = new THREE.Mesh(chestGeo, chestMat);
        chest.position.y = 1.1;
        chest.castShadow = true;
        chest.receiveShadow = true;
        group.add(chest);
        
        // Head (more detailed)
        const headGeo = new THREE.SphereGeometry(0.28, 16, 16);
        const headMat = new THREE.MeshStandardMaterial({ color: 0xffccaa, emissive: 0x221100 });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 1.8;
        head.castShadow = true;
        head.receiveShadow = true;
        group.add(head);
        
        // Helmet/hat
        const hatGeo = new THREE.ConeGeometry(0.25, 0.15, 8);
        const hatMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const hat = new THREE.Mesh(hatGeo, hatMat);
        hat.position.y = 2.0;
        hat.castShadow = true;
        group.add(hat);
        
        // Eyes
        const eyeGeo = new THREE.SphereGeometry(0.05, 8);
        const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
        const pupilMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
        
        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.1, 1.88, 0.25);
        group.add(leftEye);
        
        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.1, 1.88, 0.25);
        group.add(rightEye);
        
        const leftPupil = new THREE.Mesh(new THREE.SphereGeometry(0.025, 4), pupilMat);
        leftPupil.position.set(-0.1, 1.88, 0.3);
        group.add(leftPupil);
        
        const rightPupil = new THREE.Mesh(new THREE.SphereGeometry(0.025, 4), pupilMat);
        rightPupil.position.set(0.1, 1.88, 0.3);
        group.add(rightPupil);
        
        // Arms with better shape
        const armGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.0, 6);
        const armMat = new THREE.MeshStandardMaterial({ color: color });
        
        // Left arm
        const leftArm = new THREE.Mesh(armGeo, armMat);
        leftArm.position.set(-0.5, 1.3, 0);
        leftArm.rotation.z = 0.2;
        leftArm.rotation.x = 0.2;
        leftArm.castShadow = true;
        group.add(leftArm);
        
        // Right arm
        const rightArm = new THREE.Mesh(armGeo, armMat);
        rightArm.position.set(0.5, 1.3, 0);
        rightArm.rotation.z = -0.2;
        rightArm.rotation.x = -0.1;
        rightArm.castShadow = true;
        group.add(rightArm);
        
        // Hands
        const handGeo = new THREE.SphereGeometry(0.1, 4);
        const handMat = new THREE.MeshStandardMaterial({ color: 0xffccaa });
        
        const leftHand = new THREE.Mesh(handGeo, handMat);
        leftHand.position.set(-0.7, 0.85, 0.1);
        leftHand.castShadow = true;
        group.add(leftHand);
        
        const rightHand = new THREE.Mesh(handGeo, handMat);
        rightHand.position.set(0.7, 0.85, -0.1);
        rightHand.castShadow = true;
        group.add(rightHand);
        
        // Legs
        const legGeo = new THREE.CylinderGeometry(0.15, 0.15, 1.0, 6);
        const legMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
        
        // Left leg
        const leftLeg = new THREE.Mesh(legGeo, legMat);
        leftLeg.position.set(-0.2, 0.4, 0);
        leftLeg.castShadow = true;
        group.add(leftLeg);
        
        // Right leg
        const rightLeg = new THREE.Mesh(legGeo, legMat);
        rightLeg.position.set(0.2, 0.4, 0);
        rightLeg.castShadow = true;
        group.add(rightLeg);
        
        // Shoes
        const shoeGeo = new THREE.BoxGeometry(0.2, 0.1, 0.4);
        const shoeMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
        
        const leftShoe = new THREE.Mesh(shoeGeo, shoeMat);
        leftShoe.position.set(-0.2, 0.0, 0.1);
        leftShoe.castShadow = true;
        group.add(leftShoe);
        
        const rightShoe = new THREE.Mesh(shoeGeo, shoeMat);
        rightShoe.position.set(0.2, 0.0, 0.1);
        rightShoe.castShadow = true;
        group.add(rightShoe);
        
        // Backpack
        const backpackGeo = new THREE.BoxGeometry(0.4, 0.5, 0.2);
        const backpackMat = new THREE.MeshStandardMaterial({ color: 0x884422 });
        const backpack = new THREE.Mesh(backpackGeo, backpackMat);
        backpack.position.set(0, 1.0, -0.3);
        backpack.castShadow = true;
        group.add(backpack);
        
        // Weapon (pistol) on hip
        const pistolGeo = new THREE.BoxGeometry(0.1, 0.1, 0.3);
        const pistolMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const pistol = new THREE.Mesh(pistolGeo, pistolMat);
        pistol.position.set(0.3, 0.7, 0.2);
        pistol.rotation.y = 0.5;
        pistol.castShadow = true;
        group.add(pistol);
        
        // Name tag (HTML element)
        const nameTagDiv = document.createElement('div');
        nameTagDiv.className = 'player-name-tag';
        nameTagDiv.textContent = playerName;
        nameTagDiv.style.cssText = `
            position: absolute;
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 14px;
            font-family: 'Arial', sans-serif;
            font-weight: bold;
            pointer-events: none;
            transform: translate(-50%, -50%);
            white-space: nowrap;
            border: 2px solid ${this.rgbToHex(color)};
            box-shadow: 0 2px 10px rgba(0,0,0,0.5);
            z-index: 1000;
            text-shadow: 1px 1px 2px black;
        `;
        document.body.appendChild(nameTagDiv);
        
        // Health bar
        const healthBarDiv = document.createElement('div');
        healthBarDiv.className = 'player-health-bar';
        healthBarDiv.style.cssText = `
            position: absolute;
            width: 50px;
            height: 8px;
            background: rgba(0,0,0,0.7);
            border-radius: 4px;
            transform: translate(-50%, -50%);
            overflow: hidden;
            border: 1px solid white;
            z-index: 1000;
        `;
        const healthFill = document.createElement('div');
        healthFill.className = 'health-fill';
        healthFill.style.cssText = `
            height: 100%;
            width: 100%;
            background: linear-gradient(90deg, #00ff00, #33ff33);
            transition: width 0.2s;
        `;
        healthBarDiv.appendChild(healthFill);
        document.body.appendChild(healthBarDiv);
        
        return {
            mesh: group,
            nameTag: nameTagDiv,
            healthBar: healthBarDiv,
            healthFill: healthFill
        };
    }
    
    rgbToHex(color) {
        return '#' + color.toString(16).padStart(6, '0');
    }
    
    updateOrAddPlayer(playerData) {
        let playerObj = this.otherPlayers.get(playerData.id);
        
        if (!playerObj) {
            const newPlayer = this.createRealisticPlayer(
                this.getPlayerColor(playerData.id),
                playerData.name || 'Player'
            );
            
            playerObj = {
                mesh: newPlayer.mesh,
                nameTag: newPlayer.nameTag,
                healthBar: newPlayer.healthBar,
                healthFill: newPlayer.healthFill,
                data: playerData,
                targetPosition: playerData.position ? new THREE.Vector3(
                    playerData.position.x,
                    playerData.position.y,
                    playerData.position.z
                ) : new THREE.Vector3(0, 1.8, 0),
                targetRotation: playerData.rotation ? playerData.rotation.y : 0
            };
            
            this.scene.add(playerObj.mesh);
            this.otherPlayers.set(playerData.id, playerObj);
        }
        
        // Store target positions for smooth interpolation
        if (playerData.position) {
            playerObj.targetPosition = new THREE.Vector3(
                playerData.position.x,
                playerData.position.y,
                playerData.position.z
            );
        }
        
        if (playerData.rotation) {
            playerObj.targetRotation = playerData.rotation.y;
        }
        
        // Update health bar immediately
        if (playerData.health !== undefined) {
            const healthPercent = Math.max(0, playerData.health) / 100;
            playerObj.healthFill.style.width = `${healthPercent * 100}%`;
            
            if (healthPercent > 0.6) {
                playerObj.healthFill.style.background = 'linear-gradient(90deg, #00ff00, #33ff33)';
            } else if (healthPercent > 0.3) {
                playerObj.healthFill.style.background = 'linear-gradient(90deg, #ffff00, #ffaa00)';
            } else {
                playerObj.healthFill.style.background = 'linear-gradient(90deg, #ff0000, #ff3333)';
            }
        }
        
        playerObj.data = playerData;
    }
    
    removePlayer(playerId) {
        const playerObj = this.otherPlayers.get(playerId);
        if (playerObj) {
            this.scene.remove(playerObj.mesh);
            if (playerObj.nameTag && playerObj.nameTag.parentNode) {
                playerObj.nameTag.remove();
            }
            if (playerObj.healthBar && playerObj.healthBar.parentNode) {
                playerObj.healthBar.remove();
            }
            this.otherPlayers.delete(playerId);
        }
    }
    
    getPlayerColor(playerId) {
        let hash = 0;
        for (let i = 0; i < playerId.length; i++) {
            hash = ((hash << 5) - hash) + playerId.charCodeAt(i);
            hash |= 0;
        }
        // Brighter, more game-like colors
        const colors = [0xff4444, 0x44ff44, 0x4444ff, 0xffff44, 0xff44ff, 0x44ffff, 0xff8844, 0x8844ff];
        return colors[Math.abs(hash) % colors.length];
    }
    
    addKillToFeed(killData) {
        const killMessage = {
            killer: killData.killerName || 'Unknown',
            victim: killData.victimName || 'Unknown',
            time: Date.now()
        };
        
        this.killMessages.unshift(killMessage);
        if (this.killMessages.length > 5) {
            this.killMessages.pop();
        }
        
        this.updateKillFeed();
        
        if (killData.victimId === this.playerId) {
            this.showNotification(`You were killed by ${killData.killerName}`, 'error');
        } else if (killData.killerId === this.playerId) {
            this.showNotification(`You killed ${killData.victimName}! +100 XP`, 'success');
            this.kills++;
            this.score += 100;
            this.updateUI();
        }
    }
    
    updateKillFeed() {
        if (!this.killFeedElement) return;
        
        this.killFeedElement.innerHTML = '';
        this.killMessages.forEach(msg => {
            const item = document.createElement('div');
            item.style.cssText = `
                background: rgba(0,0,0,0.8);
                color: white;
                padding: 6px 12px;
                margin-bottom: 5px;
                border-radius: 20px;
                font-size: 13px;
                font-weight: bold;
                border-left: 4px solid #ff4444;
                animation: slideIn 0.3s ease;
                box-shadow: 0 2px 10px rgba(0,0,0,0.5);
                text-align: center;
            `;
            item.innerHTML = `<span style="color: #ffaa00;">${msg.killer}</span> 🔫 <span style="color: #ff4444;">${msg.victim}</span>`;
            this.killFeedElement.appendChild(item);
        });
    }
    
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: ${type === 'error' ? '#ff4444' : type === 'success' ? '#44ff44' : '#4444ff'};
            color: white;
            padding: 12px 24px;
            border-radius: 30px;
            font-family: 'Arial', sans-serif;
            font-size: 16px;
            font-weight: bold;
            z-index: 10000;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            animation: fadeInOut 3s ease;
            text-shadow: 1px 1px 2px black;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
    
    setupLighting() {
        const ambient = new THREE.AmbientLight(0x404060);
        this.scene.add(ambient);
        
        const sun = new THREE.DirectionalLight(0xffeedd, 1.2);
        sun.position.set(30, 50, 30);
        sun.castShadow = true;
        sun.shadow.mapSize.width = 1024;
        sun.shadow.mapSize.height = 1024;
        this.scene.add(sun);
        
        const fill = new THREE.DirectionalLight(0x88aacc, 0.6);
        fill.position.set(-30, 20, -40);
        this.scene.add(fill);
        
        // Add point lights for better ambiance
        const pointLight1 = new THREE.PointLight(0xffaa00, 0.5, 50);
        pointLight1.position.set(10, 10, 10);
        this.scene.add(pointLight1);
        
        const pointLight2 = new THREE.PointLight(0x44aaff, 0.5, 50);
        pointLight2.position.set(-10, 5, -10);
        this.scene.add(pointLight2);
    }
    
    setupGround() {
        // Grass ground with texture-like appearance
        const groundGeo = new THREE.CircleGeometry(100, 64);
        const groundMat = new THREE.MeshStandardMaterial({ 
            color: 0x3a7e3a, 
            roughness: 0.8,
            emissive: 0x112211
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = 0;
        ground.receiveShadow = true;
        this.scene.add(ground);
        
        // Add some random grass patches
        for (let i = 0; i < 50; i++) {
            const patchGeo = new THREE.CircleGeometry(0.5 + Math.random(), 3);
            const patchMat = new THREE.MeshStandardMaterial({ color: 0x4a8e4a });
            const patch = new THREE.Mesh(patchGeo, patchMat);
            patch.rotation.x = -Math.PI / 2;
            patch.position.set((Math.random()-0.5)*80, 0.01, (Math.random()-0.5)*80);
            patch.receiveShadow = true;
            this.scene.add(patch);
        }
        
        // Paths
        for (let i = 0; i < 10; i++) {
            const path = new THREE.Mesh(
                new THREE.PlaneGeometry(4, 4),
                new THREE.MeshStandardMaterial({ color: 0x6b4c3b })
            );
            path.rotation.x = -Math.PI/2;
            path.position.set((Math.random()-0.5)*60, 0.02, (Math.random()-0.5)*60);
            path.receiveShadow = true;
            this.scene.add(path);
        }
    }
    
    createRealisticBuildings() {
        const colors = [0x8B4513, 0x5D3A1A, 0xA0522D];
        
        const positions = [
            {x: -15, z: -15}, {x: 15, z: -15}, {x: -15, z: 15}, {x: 15, z: 15},
            {x: -25, z: 0}, {x: 25, z: 0}, {x: 0, z: -25}, {x: 0, z: 25}
        ];
        
        positions.forEach((pos, index) => {
            const width = 8;
            const depth = 8;
            const height = 6 + Math.random() * 2;
            const color = colors[index % colors.length];
            
            this.createDetailedBuilding(pos.x, pos.z, width, depth, height, color);
        });
    }
    
    createDetailedBuilding(x, z, w, d, h, color) {
        const group = new THREE.Group();
        const wallThick = 0.5;
        
        // Main building structure with texture
        const mainMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.7 });
        const trimMat = new THREE.MeshStandardMaterial({ color: 0x884422, roughness: 0.5 });
        
        // Back wall
        const backWall = new THREE.Mesh(
            new THREE.BoxGeometry(w, h, wallThick),
            mainMat
        );
        backWall.position.set(0, h/2, -d/2 + wallThick/2);
        backWall.castShadow = true; 
        backWall.receiveShadow = true;
        group.add(backWall);
        
        // Left wall
        const leftWall = new THREE.Mesh(
            new THREE.BoxGeometry(wallThick, h, d),
            mainMat
        );
        leftWall.position.set(-w/2 + wallThick/2, h/2, 0);
        leftWall.castShadow = true; 
        leftWall.receiveShadow = true;
        group.add(leftWall);
        
        // Right wall
        const rightWall = new THREE.Mesh(
            new THREE.BoxGeometry(wallThick, h, d),
            mainMat
        );
        rightWall.position.set(w/2 - wallThick/2, h/2, 0);
        rightWall.castShadow = true; 
        rightWall.receiveShadow = true;
        group.add(rightWall);
        
        // Front wall with door
        const doorWidth = 2.0;
        const doorHeight = 2.5;
        
        // Left part
        const frontLeft = new THREE.Mesh(
            new THREE.BoxGeometry((w - doorWidth)/2, h, wallThick),
            mainMat
        );
        frontLeft.position.set(-(w + doorWidth)/4, h/2, d/2 - wallThick/2);
        frontLeft.castShadow = true; 
        frontLeft.receiveShadow = true;
        group.add(frontLeft);
        
        // Right part
        const frontRight = new THREE.Mesh(
            new THREE.BoxGeometry((w - doorWidth)/2, h, wallThick),
            mainMat
        );
        frontRight.position.set((w + doorWidth)/4, h/2, d/2 - wallThick/2);
        frontRight.castShadow = true; 
        frontRight.receiveShadow = true;
        group.add(frontRight);
        
        // Top part above door
        const topDoor = new THREE.Mesh(
            new THREE.BoxGeometry(doorWidth, h - doorHeight, wallThick),
            mainMat
        );
        topDoor.position.set(0, h - (h - doorHeight)/2, d/2 - wallThick/2);
        topDoor.castShadow = true; 
        topDoor.receiveShadow = true;
        group.add(topDoor);
        
        // Door frame
        const doorFrame = new THREE.Mesh(
            new THREE.BoxGeometry(doorWidth + 0.2, doorHeight + 0.2, 0.3),
            trimMat
        );
        doorFrame.position.set(0, doorHeight/2, d/2 - 0.1);
        doorFrame.castShadow = true; 
        doorFrame.receiveShadow = true;
        group.add(doorFrame);
        
        // Door
        const door = new THREE.Mesh(
            new THREE.BoxGeometry(doorWidth - 0.2, doorHeight - 0.2, 0.2),
            new THREE.MeshStandardMaterial({ color: 0x8B5A2B })
        );
        door.position.set(0, doorHeight/2, d/2);
        door.castShadow = true; 
        door.receiveShadow = true;
        group.add(door);
        
        // Windows
        for (let i = 0; i < 3; i++) {
            const windowMat = new THREE.MeshStandardMaterial({ color: 0x87CEEB, emissive: 0x112233 });
            const windowFrame = new THREE.Mesh(
                new THREE.BoxGeometry(1.0, 1.0, 0.2),
                trimMat
            );
            windowFrame.position.set(-2 + i*2, 3, d/2 - 0.2);
            windowFrame.castShadow = true;
            group.add(windowFrame);
            
            const windowGlass = new THREE.Mesh(
                new THREE.BoxGeometry(0.8, 0.8, 0.1),
                windowMat
            );
            windowGlass.position.set(-2 + i*2, 3, d/2 - 0.1);
            windowGlass.castShadow = true;
            group.add(windowGlass);
        }
        
        // Roof
        const roof = new THREE.Mesh(
            new THREE.ConeGeometry(Math.max(w, d) * 0.7, 2, 4),
            new THREE.MeshStandardMaterial({ color: 0x884422 })
        );
        roof.position.set(0, h + 1, 0);
        roof.rotation.y = Math.PI/4;
        roof.castShadow = true; 
        roof.receiveShadow = true;
        group.add(roof);
        
        // Chimney
        const chimney = new THREE.Mesh(
            new THREE.BoxGeometry(0.8, 2.5, 0.8),
            new THREE.MeshStandardMaterial({ color: 0x8B4513 })
        );
        chimney.position.set(2, h + 1.5, 1);
        chimney.castShadow = true;
        group.add(chimney);
        
        // Steps
        const stepGroup = new THREE.Group();
        for (let s = 0; s < 3; s++) {
            const step = new THREE.Mesh(
                new THREE.BoxGeometry(2.2 - s*0.2, 0.2, 1.0),
                new THREE.MeshStandardMaterial({ color: 0xcccccc })
            );
            step.position.set(0, 0.1 + s * 0.3, 3.5 - s * 0.2);
            step.castShadow = true; 
            step.receiveShadow = true;
            stepGroup.add(step);
        }
        stepGroup.position.set(0, 0, 0);
        group.add(stepGroup);
        
        // Interior floor
        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(w - 1.5, d - 1.5),
            new THREE.MeshStandardMaterial({ color: 0x5a3a1a, side: THREE.DoubleSide })
        );
        floor.rotation.x = -Math.PI/2;
        floor.position.set(0, 0.05, 0);
        floor.receiveShadow = true;
        group.add(floor);
        
        group.position.set(x, 0, z);
        this.scene.add(group);
        
        this.buildings.push({
            mesh: group,
            doorPos: new THREE.Vector3(x, 1.2, z + d/2),
            interior: {
                minX: x - w/2 + wallThick,
                maxX: x + w/2 - wallThick,
                minZ: z - d/2 + wallThick,
                maxZ: z + d/2 - wallThick,
                minY: 0,
                maxY: h
            }
        });
    }
    
    createSimpleEnvironment() {
        // Trees
        for (let i = 0; i < 30; i++) {
            const treeGroup = new THREE.Group();
            
            // Trunk
            const trunkGeo = new THREE.CylinderGeometry(0.4, 0.6, 3);
            const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8B5A2B });
            const trunk = new THREE.Mesh(trunkGeo, trunkMat);
            trunk.position.y = 1.5;
            trunk.castShadow = true;
            trunk.receiveShadow = true;
            treeGroup.add(trunk);
            
            // Leaves (multiple layers)
            const leafMat = new THREE.MeshStandardMaterial({ color: 0x2a8a2a });
            
            const leaves1 = new THREE.Mesh(new THREE.ConeGeometry(1.2, 1.5, 6), leafMat);
            leaves1.position.y = 3.0;
            leaves1.castShadow = true;
            leaves1.receiveShadow = true;
            treeGroup.add(leaves1);
            
            const leaves2 = new THREE.Mesh(new THREE.ConeGeometry(1.0, 1.2, 6), leafMat);
            leaves2.position.y = 4.0;
            leaves2.castShadow = true;
            leaves2.receiveShadow = true;
            treeGroup.add(leaves2);
            
            const leaves3 = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.0, 6), leafMat);
            leaves3.position.y = 4.8;
            leaves3.castShadow = true;
            leaves3.receiveShadow = true;
            treeGroup.add(leaves3);
            
            treeGroup.position.set((Math.random()-0.5)*70, 0, (Math.random()-0.5)*70);
            
            // Avoid placing trees too close to buildings
            let tooClose = false;
            for (let b of this.buildings) {
                if (treeGroup.position.distanceTo(b.mesh.position) < 8) {
                    tooClose = true;
                    break;
                }
            }
            
            if (!tooClose) {
                this.scene.add(treeGroup);
                this.trees.push(treeGroup);
            }
        }
        
        // Bushes
        for (let i = 0; i < 40; i++) {
            const bushGeo = new THREE.SphereGeometry(0.5 + Math.random()*0.5, 5);
            const bushMat = new THREE.MeshStandardMaterial({ color: 0x3a8a3a });
            const bush = new THREE.Mesh(bushGeo, bushMat);
            bush.position.set((Math.random()-0.5)*70, 0.3, (Math.random()-0.5)*70);
            bush.castShadow = true;
            bush.receiveShadow = true;
            
            let tooClose = false;
            for (let b of this.buildings) {
                if (bush.position.distanceTo(b.mesh.position) < 6) {
                    tooClose = true;
                    break;
                }
            }
            
            if (!tooClose) {
                this.scene.add(bush);
            }
        }
    }
    
    spawnInitialAmmoBoxes(count) {
        for (let i = 0; i < count; i++) {
            this.spawnAmmoBox(
                (Math.random()-0.5)*50,
                0.5,
                (Math.random()-0.5)*50,
                5 + Math.floor(Math.random() * 10)
            );
        }
        console.log(`Spawned ${this.ammoBoxes.length} initial ammo boxes`);
    }
    
    spawnAmmoBox(x, y, z, ammoAmount = 10) {
        const box = new THREE.Mesh(
            new THREE.BoxGeometry(0.8, 0.8, 0.8),
            new THREE.MeshStandardMaterial({ 
                color: 0xffaa00,
                emissive: 0x442200,
                transparent: true,
                opacity: 0.9
            })
        );
        box.position.set(x, y, z);
        box.castShadow = true;
        box.receiveShadow = true;
        
        // Add ammo label
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffff00';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🔫', 32, 32);
        
        const texture = new THREE.CanvasTexture(canvas);
        const labelMat = new THREE.SpriteMaterial({ map: texture });
        const label = new THREE.Sprite(labelMat);
        label.scale.set(0.5, 0.5, 0.5);
        label.position.set(0, 0.6, 0);
        box.add(label);
        
        // Add ammo count text
        const countCanvas = document.createElement('canvas');
        countCanvas.width = 32;
        countCanvas.height = 32;
        const countCtx = countCanvas.getContext('2d');
        countCtx.fillStyle = '#ffffff';
        countCtx.font = 'bold 16px Arial';
        countCtx.textAlign = 'center';
        countCtx.textBaseline = 'middle';
        countCtx.fillText('+' + ammoAmount, 16, 16);
        
        const countTexture = new THREE.CanvasTexture(countCanvas);
        const countMat = new THREE.SpriteMaterial({ map: countTexture });
        const countLabel = new THREE.Sprite(countMat);
        countLabel.scale.set(0.4, 0.4, 0.4);
        countLabel.position.set(0, -0.6, 0);
        box.add(countLabel);
        
        // Add wireframe
        const edges = new THREE.EdgesGeometry(box.geometry);
        const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xffff00 }));
        box.add(line);
        
        box.userData = {
            ammo: ammoAmount,
            type: 'ammo'
        };
        
        this.scene.add(box);
        this.ammoBoxes.push(box);
        
        return box;
    }
    
    spawnAmmoBoxOnDeath(position, ammoAmount = 15) {
        this.spawnAmmoBox(position.x, 0.5, position.z, ammoAmount);
    }
    
    checkNearbyDoors() {
        if (!this.gameActive || this.insideBuilding || !this.buildings) return;
        
        let found = null;
        let minDist = 4.0;
        
        this.buildings.forEach(b => {
            if (b && b.doorPos) {
                const dist = this.camera.position.distanceTo(b.doorPos);
                if (dist < minDist) {
                    minDist = dist;
                    found = b;
                }
            }
        });
        
        if (found !== this.nearbyDoor) {
            this.nearbyDoor = found;
            const doorIndicator = document.getElementById('doorIndicator');
            if (doorIndicator) {
                doorIndicator.style.display = found ? 'block' : 'none';
            }
        }
    }
    
    enterBuilding(building) {
        if (!building || this.insideBuilding) return;
        
        this.insideBuilding = true;
        this.currentBuilding = building;
        
        this.camera.position.set(
            building.doorPos.x,
            1.8,
            building.doorPos.z - 3
        );
        
        const doorIndicator = document.getElementById('doorIndicator');
        if (doorIndicator) {
            doorIndicator.textContent = '🏢 INSIDE - TAP SHOOT TO EXIT';
        }
    }
    
    exitBuilding() {
        if (!this.insideBuilding) return;
        
        this.insideBuilding = false;
        
        if (this.nearbyDoor) {
            this.camera.position.set(
                this.nearbyDoor.doorPos.x,
                1.8,
                this.nearbyDoor.doorPos.z + 3
            );
        }
        
        const doorIndicator = document.getElementById('doorIndicator');
        if (doorIndicator) {
            doorIndicator.textContent = '🚪 NEAR DOOR - TAP SHOOT TO ENTER';
            doorIndicator.style.display = 'none';
        }
        this.currentBuilding = null;
    }
    
    setupControls() {
        const swipeZone = document.getElementById('viewSwipeZone');
        const joystickEl = document.getElementById('joystickContainer');
        
        if (!joystickEl || !swipeZone) {
            console.warn('Control elements not found');
            return;
        }
        
        joystickEl.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (!this.gameActive) return;
            if (this.joystickTouchId === null) {
                this.joystickTouchId = e.touches[0].identifier;
                this.joystickActive = true;
                this.updateJoystick(e.touches[0]);
            }
        });
        
        joystickEl.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (!this.gameActive || !this.joystickActive) return;
            for (let i = 0; i < e.touches.length; i++) {
                if (e.touches[i].identifier === this.joystickTouchId) {
                    this.updateJoystick(e.touches[i]);
                    break;
                }
            }
        });
        
        joystickEl.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.joystickActive = false;
            this.joystickTouchId = null;
            this.moveX = 0; 
            this.moveY = 0;
            this.bobSpeed = 0;
            
            const speedElement = document.getElementById('movementSpeed');
            if (speedElement) {
                speedElement.textContent = '0';
            }
            
            if (this.joystickThumb) {
                this.joystickThumb.style.transform = `translate(0px, 0px)`;
            }
        });
        
        swipeZone.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (!this.gameActive) return;
            if (this.swipeTouchId === null) {
                this.swipeTouchId = e.touches[0].identifier;
                this.lastSwipeX = e.touches[0].clientX;
                this.lastSwipeY = e.touches[0].clientY;
            }
        });
        
        swipeZone.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (!this.gameActive) return;
            for (let i = 0; i < e.touches.length; i++) {
                if (e.touches[i].identifier === this.swipeTouchId) {
                    const touch = e.touches[i];
                    const deltaX = touch.clientX - this.lastSwipeX;
                    const deltaY = touch.clientY - this.lastSwipeY;
                    
                    this.lookYaw -= deltaX * this.touchSensitivity;
                    this.lookPitch -= deltaY * this.touchSensitivity;
                    this.lookPitch = Math.max(-1.0, Math.min(1.0, this.lookPitch));
                    
                    this.lastSwipeX = touch.clientX;
                    this.lastSwipeY = touch.clientY;
                    break;
                }
            }
        });
        
        swipeZone.addEventListener('touchend', (e) => { 
            e.preventDefault(); 
            this.swipeTouchId = null; 
        });
        
        const shootBtn = document.getElementById('shootBtn');
        if (shootBtn) {
            shootBtn.addEventListener('touchstart', (e) => { 
                e.preventDefault(); 
                
                if (!this.gameActive) return;
                
                if (this.insideBuilding) {
                    this.exitBuilding();
                } else if (this.nearbyDoor) {
                    this.enterBuilding(this.nearbyDoor);
                } else {
                    this.shoot();
                    playGunSound();
                }
            });
        }
        
        const reloadBtn = document.getElementById('reloadBtn');
        if (reloadBtn) {
            reloadBtn.addEventListener('touchstart', (e) => { 
                e.preventDefault(); 
                this.reload(); 
            });
        }
        
        const startBtn = document.getElementById('startBtn');
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                const instructions = document.getElementById('instructions');
                if (instructions) {
                    instructions.style.display = 'none';
                }
                this.startGame();
            });
        }
        
        const restartBtn = document.getElementById('restartBtn');
        if (restartBtn) {
            restartBtn.addEventListener('click', () => this.restart());
        }
    }
    
    updateJoystick(touch) {
        if (!this.joystickContainer || !this.joystickThumb) return;
        
        const rect = this.joystickContainer.getBoundingClientRect();
        const centerX = rect.left + rect.width/2;
        const centerY = rect.top + rect.height/2;
        
        let deltaX = touch.clientX - centerX;
        let deltaY = touch.clientY - centerY;
        
        const distance = Math.sqrt(deltaX*deltaX + deltaY*deltaY);
        if (distance > this.joystickMaxMove) {
            deltaX = (deltaX / distance) * this.joystickMaxMove;
            deltaY = (deltaY / distance) * this.joystickMaxMove;
        }
        
        this.joystickThumb.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
        
        this.moveX = deltaX / this.joystickMaxMove;
        this.moveY = -deltaY / this.joystickMaxMove;
        
        const speed = Math.sqrt(this.moveX*this.moveX + this.moveY*this.moveY);
        const speedElement = document.getElementById('movementSpeed');
        if (speedElement) {
            speedElement.textContent = speed.toFixed(1);
        }
        this.bobSpeed = speed;
    }
    
    setupMinimap() { 
        const canvas = document.getElementById('minimapCanvas');
        if (canvas) {
            this.minimapCtx = canvas.getContext('2d'); 
        }
    }
    
    updateMinimap() {
        if (!this.minimapCtx) return;
        
        const canvas = document.getElementById('minimapCanvas');
        if (!canvas) return;
        
        const ctx = this.minimapCtx;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Background with grid
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw grid
        ctx.strokeStyle = '#334466';
        ctx.lineWidth = 0.5;
        for (let i = 0; i <= canvas.width; i += 20) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, canvas.height);
            ctx.stroke();
        }
        for (let i = 0; i <= canvas.height; i += 20) {
            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(canvas.width, i);
            ctx.stroke();
        }
        
        // Draw buildings
        ctx.fillStyle = '#8B4513';
        this.buildings.forEach(b => {
            const x = (b.mesh.position.x + 50) * 2;
            const z = (b.mesh.position.z + 50) * 2;
            if (x > 0 && x < canvas.width && z > 0 && z < canvas.height) {
                ctx.fillRect(x-4, z-4, 8, 8);
            }
        });
        
        // Draw other players with direction
        this.otherPlayers.forEach((player) => {
            const x = (player.mesh.position.x + 50) * 2;
            const z = (player.mesh.position.z + 50) * 2;
            if (x > 0 && x < canvas.width && z > 0 && z < canvas.height) {
                // Player dot
                ctx.fillStyle = '#ff4444';
                ctx.beginPath();
                ctx.arc(x, z, 5, 0, 2*Math.PI);
                ctx.fill();
                
                // Direction indicator
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(x, z);
                ctx.lineTo(
                    x + Math.sin(player.mesh.rotation.y) * 12,
                    z + Math.cos(player.mesh.rotation.y) * 12
                );
                ctx.stroke();
            }
        });
        
        // Draw ammo boxes
        ctx.fillStyle = '#ffaa00';
        this.ammoBoxes.forEach(box => {
            const x = (box.position.x + 50) * 2;
            const z = (box.position.z + 50) * 2;
            ctx.beginPath();
            ctx.arc(x, z, 3, 0, 2*Math.PI);
            ctx.fill();
        });
        
        // Player (center)
        ctx.fillStyle = '#44ff44';
        ctx.beginPath();
        ctx.arc(canvas.width/2, canvas.height/2, 6, 0, 2*Math.PI);
        ctx.fill();
        
        // Player direction
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(canvas.width/2, canvas.height/2);
        ctx.lineTo(
            canvas.width/2 + Math.sin(this.lookYaw) * 15,
            canvas.height/2 + Math.cos(this.lookYaw) * 15
        );
        ctx.stroke();
    }
    
    startGame() {
        this.gameActive = true;
        this.health = 100; 
        this.score = 0; 
        this.kills = 0;
        this.ammo = 30; 
        this.boxesCollected = 0;
        this.camera.position.set(0, 1.8, 15);
        
        if (this.firebaseReady && this.playerRef) {
            updateDoc(this.playerRef, {
                health: this.health,
                ammo: this.ammo,
                kills: this.kills,
                alive: true,
                position: {
                    x: this.camera.position.x,
                    y: this.camera.position.y,
                    z: this.camera.position.z
                }
            }).catch(console.error);
        }
        
        this.updateUI();
        
        this.showNotification(`Online players: ${this.otherPlayers.size + 1}`, 'info');
    }
    
    shoot() {
        if (!this.gameActive || this.ammo <= 0) return;
        this.ammo--; 
        this.updateUI();
        
        if (this.firebaseReady && this.playerRef) {
            updateDoc(this.playerRef, { ammo: this.ammo }).catch(console.error);
        }
        
        const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        const startPos = this.camera.position.clone();
        const rayLength = 30;
        
        // Check for ammo box hits
        for (let i = this.ammoBoxes.length - 1; i >= 0; i--) {
            const box = this.ammoBoxes[i];
            const toBox = box.position.clone().sub(startPos);
            
            if (direction.angleTo(toBox) < 0.2 && toBox.length() < rayLength) {
                const ammoGained = box.userData.ammo || 10;
                this.ammo = Math.min(this.maxAmmo, this.ammo + ammoGained);
                this.boxesCollected++;
                
                this.scene.remove(box);
                this.ammoBoxes.splice(i, 1);
                
                this.updateUI();
                
                this.showNotification(`+${ammoGained} Ammo`, 'success');
                
                if (this.firebaseReady && this.playerRef) {
                    updateDoc(this.playerRef, { ammo: this.ammo }).catch(console.error);
                }
                
                return;
            }
        }
        
        // Check for player hits
        for (let [playerId, playerObj] of this.otherPlayers) {
            if (!playerObj.mesh || !playerObj.data.alive) continue;
            
            const toPlayer = playerObj.mesh.position.clone().sub(startPos);
            
            if (direction.angleTo(toPlayer) < 0.2 && toPlayer.length() < rayLength) {
                // 3-shot kill system (33 damage per shot)
                const damage = this.damagePerShot;
                
                this.registerHit(playerId, damage);
                
                // Show hit marker
                this.showHitMarker();
                
                this.showNotification(`Hit ${playerObj.data.name} (${damage} DMG)`, 'info');
                
                break;
            }
        }
    }
    
    showHitMarker() {
        // Create hit marker effect
        const marker = document.createElement('div');
        marker.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 40px;
            height: 40px;
            border: 3px solid white;
            border-radius: 50%;
            animation: hitMarker 0.2s ease-out;
            pointer-events: none;
            z-index: 9999;
        `;
        document.body.appendChild(marker);
        
        setTimeout(() => {
            marker.remove();
        }, 200);
    }
    
    async registerHit(targetId, damage) {
        try {
            if (!this.firebaseReady || !this.playerId || !targetId || !db) return;
            
            const hitRef = doc(collection(db, 'game_hits'));
            await setDoc(hitRef, {
                shooterId: this.playerId,
                shooterName: this.playerName,
                targetId: targetId,
                damage: damage,
                timestamp: serverTimestamp()
            });
            
        } catch (error) {
            console.error('Error registering hit:', error);
        }
    }
    
    takeDamage(amount, attackerId, attackerName) {
        if (!this.gameActive || this.health <= 0) return;
        
        this.health = Math.max(0, this.health - amount);
        this.lastDamagedBy = { id: attackerId, name: attackerName };
        this.lastDamageTime = Date.now();
        
        this.updateUI();
        
        // Screen damage effect
        document.body.style.backgroundColor = '#ff0000';
        document.body.style.transition = 'background-color 0.1s';
        setTimeout(() => {
            document.body.style.backgroundColor = '';
            document.body.style.transition = '';
        }, 100);
        
        if (this.firebaseReady && this.playerRef) {
            updateDoc(this.playerRef, { health: this.health }).catch(console.error);
        }
        
        if (this.health <= 0) {
            this.die();
        } else {
            this.showNotification(`-${amount} HP from ${attackerName}`, 'error');
        }
    }
    
    async die() {
        this.gameActive = false;
        
        if (this.lastDamagedBy && this.firebaseReady && db) {
            const killData = {
                killerId: this.lastDamagedBy.id,
                killerName: this.lastDamagedBy.name,
                victimId: this.playerId,
                victimName: this.playerName,
                weapon: 'Pistol',
                timestamp: serverTimestamp()
            };
            
            try {
                await addDoc(collection(db, 'game_kills'), killData);
                
                const killerRef = doc(this.playersCollection, this.lastDamagedBy.id);
                await updateDoc(killerRef, {
                    kills: increment(1)
                });
                
                await this.recordWin(this.lastDamagedBy.id, this.lastDamagedBy.name);
                
            } catch (error) {
                console.error('Error recording kill:', error);
            }
            
            // Spawn ammo box at death location
            this.spawnAmmoBoxOnDeath(this.camera.position, 20);
            
            this.showNotification(`You were killed by ${this.lastDamagedBy.name}`, 'error');
        } else {
            this.showNotification('You died!', 'error');
        }
        
        if (this.firebaseReady && this.playerRef) {
            await updateDoc(this.playerRef, {
                alive: false,
                health: 0
            }).catch(console.error);
        }
        
        const gameOverlay = document.getElementById('gameOverlay');
        const finalScore = document.getElementById('finalScore');
        
        if (gameOverlay && finalScore) {
            finalScore.textContent = `Kills: ${this.kills}  Score: ${this.score}  Boxes: ${this.boxesCollected}`;
            gameOverlay.style.display = 'flex';
        }
        
        await this.recordDeath(this.playerId, this.playerName);
    }
    
    async recordWin(playerId, playerName) {
        if (!this.firebaseReady || !db) return;
        
        try {
            const today = new Date().toISOString().split('T')[0];
            
            const dailyWinRef = doc(db, 'game_daily_wins', today, 'players', playerId);
            await setDoc(dailyWinRef, {
                playerId: playerId,
                playerName: playerName,
                wins: increment(1),
                lastWin: serverTimestamp()
            }, { merge: true });
            
            const allTimeWinRef = doc(db, 'game_alltime_wins', playerId);
            await setDoc(allTimeWinRef, {
                playerId: playerId,
                playerName: playerName,
                wins: increment(1),
                lastWin: serverTimestamp()
            }, { merge: true });
            
        } catch (error) {
            console.error('Error recording win:', error);
        }
    }
    
    async recordDeath(playerId, playerName) {
        if (!this.firebaseReady || !db) return;
        
        try {
            const today = new Date().toISOString().split('T')[0];
            
            const dailyDeathRef = doc(db, 'game_daily_deaths', today, 'players', playerId);
            await setDoc(dailyDeathRef, {
                playerId: playerId,
                playerName: playerName,
                deaths: increment(1),
                lastDeath: serverTimestamp()
            }, { merge: true });
            
        } catch (error) {
            console.error('Error recording death:', error);
        }
    }
    
    reload() { 
        if (this.gameActive) { 
            this.ammo = this.maxAmmo; 
            this.updateUI();
            
            if (this.firebaseReady && this.playerRef) {
                updateDoc(this.playerRef, { ammo: this.ammo }).catch(console.error);
            }
        } 
    }
    
    updateUI() {
        const healthEl = document.getElementById('healthValue');
        const scoreEl = document.getElementById('scoreValue');
        const ammoEl = document.getElementById('ammoValue');
        const boxesEl = document.getElementById('boxesValue');
        const killsEl = document.getElementById('killsValue');
        
        if (healthEl) healthEl.textContent = this.health;
        if (scoreEl) scoreEl.textContent = this.score;
        if (ammoEl) ammoEl.textContent = this.ammo;
        if (boxesEl) boxesEl.textContent = this.boxesCollected;
        if (killsEl) killsEl.textContent = this.kills;
        
        const healthBar = document.querySelector('.health-bar-fill');
        if (healthBar) {
            healthBar.style.width = `${(this.health / this.maxHealth) * 100}%`;
        }
    }
    
    restart() {
        this.ammoBoxes.forEach(b => this.scene.remove(b));
        this.ammoBoxes = [];
        this.spawnInitialAmmoBoxes(20);
        
        this.health = 100; 
        this.score = 0; 
        this.kills = 0;
        this.ammo = 30; 
        this.boxesCollected = 0;
        this.gameActive = true;
        this.camera.position.set(0, 1.8, 15);
        this.lookYaw = 0; 
        this.lookPitch = 0;
        this.insideBuilding = false;
        this.currentBuilding = null;
        this.nearbyDoor = null;
        
        if (this.firebaseReady && this.playerRef) {
            updateDoc(this.playerRef, {
                health: this.health,
                ammo: this.ammo,
                kills: this.kills,
                alive: true,
                position: {
                    x: this.camera.position.x,
                    y: this.camera.position.y,
                    z: this.camera.position.z
                }
            }).catch(console.error);
        }
        
        const doorIndicator = document.getElementById('doorIndicator');
        if (doorIndicator) {
            doorIndicator.style.display = 'none';
        }
        
        const gameOverlay = document.getElementById('gameOverlay');
        if (gameOverlay) {
            gameOverlay.style.display = 'none';
        }
        
        this.updateUI();
    }
    
    cleanup() {
        if (this.firebaseReady && this.playerRef) {
            deleteDoc(this.playerRef).catch(console.error);
        }
        
        if (this.unsubscribePlayers) {
            this.unsubscribePlayers();
        }
        
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        
        this.otherPlayers.forEach((playerObj) => {
            this.scene.remove(playerObj.mesh);
            if (playerObj.nameTag && playerObj.nameTag.parentNode) {
                playerObj.nameTag.remove();
            }
            if (playerObj.healthBar && playerObj.healthBar.parentNode) {
                playerObj.healthBar.remove();
            }
        });
        this.otherPlayers.clear();
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        const now = Date.now();
        const deltaTime = Math.min(100, now - this.lastUpdateTime) / 1000; // Cap at 100ms
        this.lastUpdateTime = now;
        
        if (this.gameActive) {
            // Smooth camera rotation
            this.camera.rotation.y = this.lookYaw;
            this.camera.rotation.x = this.lookPitch;
            
            // Movement
            const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
            forward.y = 0; 
            forward.normalize();
            
            const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
            right.y = 0; 
            right.normalize();
            
            const moveDelta = new THREE.Vector3(0, 0, 0);
            if (Math.abs(this.moveY) > 0.05) moveDelta.addScaledVector(forward, this.moveY * this.moveSpeed);
            if (Math.abs(this.moveX) > 0.05) moveDelta.addScaledVector(right, this.moveX * this.moveSpeed);
            
            // Head bob
            if (moveDelta.length() > 0.01) {
                this.footstepTime += 0.15;
                this.bobAmount = Math.sin(this.footstepTime) * 0.02;
            } else {
                this.bobAmount *= 0.9;
            }
            
            this.camera.position.add(moveDelta);
            this.camera.position.y = 1.8 + Math.abs(this.bobAmount);
            
            // Bounds
            this.camera.position.x = Math.max(-40, Math.min(40, this.camera.position.x));
            this.camera.position.z = Math.max(-40, Math.min(40, this.camera.position.z));
            
            // Building collision
            if (this.insideBuilding && this.currentBuilding) {
                const inter = this.currentBuilding.interior;
                this.camera.position.x = Math.max(inter.minX + 0.5, Math.min(inter.maxX - 0.5, this.camera.position.x));
                this.camera.position.z = Math.max(inter.minZ + 0.5, Math.min(inter.maxZ - 0.5, this.camera.position.z));
            }
            
            // Smoothly interpolate other players' positions
            this.otherPlayers.forEach((playerObj) => {
                if (playerObj.targetPosition) {
                    // Smooth interpolation
                    playerObj.mesh.position.lerp(playerObj.targetPosition, 0.3);
                }
                
                if (playerObj.targetRotation !== undefined) {
                    // Smooth rotation interpolation
                    const rotDiff = playerObj.targetRotation - playerObj.mesh.rotation.y;
                    playerObj.mesh.rotation.y += rotDiff * 0.3;
                }
                
                // Update name tags and health bars
                if (playerObj.nameTag && playerObj.mesh) {
                    const vector = playerObj.mesh.position.clone();
                    vector.y += 2.5;
                    vector.project(this.camera);
                    
                    const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
                    const y = (-vector.y * 0.5 + 0.5) * window.innerHeight;
                    
                    if (vector.z < 1) {
                        playerObj.nameTag.style.display = 'block';
                        playerObj.nameTag.style.left = x + 'px';
                        playerObj.nameTag.style.top = y + 'px';
                        
                        if (playerObj.healthBar) {
                            playerObj.healthBar.style.display = 'block';
                            playerObj.healthBar.style.left = x + 'px';
                            playerObj.healthBar.style.top = (y + 20) + 'px';
                        }
                    } else {
                        playerObj.nameTag.style.display = 'none';
                        if (playerObj.healthBar) playerObj.healthBar.style.display = 'none';
                    }
                }
            });
            
            // Animate ammo boxes
            this.ammoBoxes.forEach(box => {
                box.rotation.y += 0.02;
                box.position.y = 0.5 + Math.sin(Date.now() * 0.005) * 0.15;
            });
            
            this.updateMinimap();
        }
        
        this.renderer.render(this.scene, this.camera);
    }
}

window.onload = () => { 
    try {
        const game = new Game();
        window.game = game;
    } catch (error) {
        console.error('Failed to start game:', error);
        document.body.innerHTML = `<div style="color: white; padding: 20px; text-align: center;">
            <h1>Error Starting Game</h1>
            <p>${error.message}</p>
            <button onclick="location.reload()">Reload</button>
        </div>`;
    }
};

// Add animation styles
if (!document.getElementById('game-animation-styles')) {
    const style = document.createElement('style');
    style.id = 'game-animation-styles';
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes fadeInOut {
            0% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
            10% { opacity: 1; transform: translateX(-50%) translateY(0); }
            90% { opacity: 1; transform: translateX(-50%) translateY(0); }
            100% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
        }
        @keyframes hitMarker {
            0% { transform: translate(-50%, -50%) scale(0.5); opacity: 1; }
            100% { transform: translate(-50%, -50%) scale(2); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}