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
        console.log('🎮 MULTIPLAYER BATTLE ROYALE - INITIALIZING');
        
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
        
        // Game state
        this.health = 100;
        this.maxHealth = 100;
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
            }, 100);
            
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
    
    updateOrAddPlayer(playerData) {
        let playerObj = this.otherPlayers.get(playerData.id);
        
        if (!playerObj) {
            const group = new THREE.Group();
            
            const bodyGeo = new THREE.CylinderGeometry(0.4, 0.4, 1.8);
            const bodyMat = new THREE.MeshStandardMaterial({ color: this.getPlayerColor(playerData.id) });
            const body = new THREE.Mesh(bodyGeo, bodyMat);
            body.position.y = 0.9;
            body.castShadow = true;
            body.receiveShadow = true;
            group.add(body);
            
            const headGeo = new THREE.SphereGeometry(0.3);
            const headMat = new THREE.MeshStandardMaterial({ color: 0xffccaa });
            const head = new THREE.Mesh(headGeo, headMat);
            head.position.y = 1.8 + 0.3;
            head.castShadow = true;
            head.receiveShadow = true;
            group.add(head);
            
            const armGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.8);
            const armMat = new THREE.MeshStandardMaterial({ color: this.getPlayerColor(playerData.id) });
            
            const leftArm = new THREE.Mesh(armGeo, armMat);
            leftArm.position.set(-0.5, 1.4, 0);
            leftArm.rotation.z = 0.2;
            leftArm.castShadow = true;
            group.add(leftArm);
            
            const rightArm = new THREE.Mesh(armGeo, armMat);
            rightArm.position.set(0.5, 1.4, 0);
            rightArm.rotation.z = -0.2;
            rightArm.castShadow = true;
            group.add(rightArm);
            
            const nameTagDiv = document.createElement('div');
            nameTagDiv.className = 'player-name-tag';
            nameTagDiv.textContent = playerData.name || 'Player';
            nameTagDiv.style.cssText = `
                position: absolute;
                background: rgba(0,0,0,0.7);
                color: white;
                padding: 2px 8px;
                border-radius: 10px;
                font-size: 12px;
                font-family: Arial, sans-serif;
                pointer-events: none;
                transform: translate(-50%, -50%);
                white-space: nowrap;
                border: 1px solid ${this.getPlayerColor(playerData.id)};
                z-index: 1000;
            `;
            document.body.appendChild(nameTagDiv);
            
            const healthBarDiv = document.createElement('div');
            healthBarDiv.className = 'player-health-bar';
            healthBarDiv.style.cssText = `
                position: absolute;
                width: 40px;
                height: 5px;
                background: rgba(0,0,0,0.5);
                border-radius: 2px;
                transform: translate(-50%, -50%);
                overflow: hidden;
                z-index: 1000;
            `;
            const healthFill = document.createElement('div');
            healthFill.className = 'health-fill';
            healthFill.style.cssText = `
                height: 100%;
                width: 100%;
                background: #00ff00;
                transition: width 0.2s;
            `;
            healthBarDiv.appendChild(healthFill);
            document.body.appendChild(healthBarDiv);
            
            playerObj = {
                mesh: group,
                nameTag: nameTagDiv,
                healthBar: healthBarDiv,
                healthFill: healthFill,
                data: playerData
            };
            
            this.scene.add(group);
            this.otherPlayers.set(playerData.id, playerObj);
        }
        
        if (playerData.position) {
            playerObj.mesh.position.set(
                playerData.position.x,
                playerData.position.y,
                playerData.position.z
            );
        }
        
        if (playerData.rotation) {
            playerObj.mesh.rotation.y = playerData.rotation.y;
        }
        
        if (playerData.health !== undefined) {
            const healthPercent = Math.max(0, playerData.health) / 100;
            playerObj.healthFill.style.width = `${healthPercent * 100}%`;
            
            if (healthPercent > 0.6) {
                playerObj.healthFill.style.background = '#00ff00';
            } else if (healthPercent > 0.3) {
                playerObj.healthFill.style.background = '#ffff00';
            } else {
                playerObj.healthFill.style.background = '#ff0000';
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
        const colors = [0xff3333, 0x33ff33, 0x3333ff, 0xffff33, 0xff33ff, 0x33ffff, 0xff9933, 0x9933ff];
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
                background: rgba(0,0,0,0.7);
                color: white;
                padding: 4px 8px;
                margin-bottom: 4px;
                border-radius: 4px;
                font-size: 12px;
                border-left: 3px solid #ff3333;
                animation: slideIn 0.3s ease;
            `;
            item.innerHTML = `<span style="color: #ffaa00;">${msg.killer}</span> 🔫 <span style="color: #ff3333;">${msg.victim}</span>`;
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
            background: ${type === 'error' ? '#ff3333' : type === 'success' ? '#33ff33' : '#3333ff'};
            color: white;
            padding: 10px 20px;
            border-radius: 30px;
            font-family: Arial, sans-serif;
            font-size: 14px;
            z-index: 10000;
            box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            animation: fadeInOut 3s ease;
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
    }
    
    setupGround() {
        const groundGeo = new THREE.CircleGeometry(100, 64);
        const groundMat = new THREE.MeshStandardMaterial({ color: 0x3a7e3a, roughness: 0.7 });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = 0;
        ground.receiveShadow = true;
        this.scene.add(ground);
        
        for (let i = 0; i < 10; i++) {
            const path = new THREE.Mesh(
                new THREE.PlaneGeometry(4, 4),
                new THREE.MeshStandardMaterial({ color: 0x555555 })
            );
            path.rotation.x = -Math.PI/2;
            path.position.set((Math.random()-0.5)*60, 0.01, (Math.random()-0.5)*60);
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
            const height = 6;
            const color = colors[index % colors.length];
            
            this.createDetailedBuilding(pos.x, pos.z, width, depth, height, color);
        });
    }
    
    createDetailedBuilding(x, z, w, d, h, color) {
        const group = new THREE.Group();
        const wallThick = 0.5;
        
        const backWall = new THREE.Mesh(
            new THREE.BoxGeometry(w, h, wallThick),
            new THREE.MeshStandardMaterial({ color })
        );
        backWall.position.set(0, h/2, -d/2 + wallThick/2);
        backWall.castShadow = true; 
        backWall.receiveShadow = true;
        group.add(backWall);
        
        const leftWall = new THREE.Mesh(
            new THREE.BoxGeometry(wallThick, h, d),
            new THREE.MeshStandardMaterial({ color })
        );
        leftWall.position.set(-w/2 + wallThick/2, h/2, 0);
        leftWall.castShadow = true; 
        leftWall.receiveShadow = true;
        group.add(leftWall);
        
        const rightWall = new THREE.Mesh(
            new THREE.BoxGeometry(wallThick, h, d),
            new THREE.MeshStandardMaterial({ color })
        );
        rightWall.position.set(w/2 - wallThick/2, h/2, 0);
        rightWall.castShadow = true; 
        rightWall.receiveShadow = true;
        group.add(rightWall);
        
        const doorWidth = 2.0;
        const doorHeight = 2.5;
        
        const frontLeft = new THREE.Mesh(
            new THREE.BoxGeometry((w - doorWidth)/2, h, wallThick),
            new THREE.MeshStandardMaterial({ color })
        );
        frontLeft.position.set(-(w + doorWidth)/4, h/2, d/2 - wallThick/2);
        frontLeft.castShadow = true; 
        frontLeft.receiveShadow = true;
        group.add(frontLeft);
        
        const frontRight = new THREE.Mesh(
            new THREE.BoxGeometry((w - doorWidth)/2, h, wallThick),
            new THREE.MeshStandardMaterial({ color })
        );
        frontRight.position.set((w + doorWidth)/4, h/2, d/2 - wallThick/2);
        frontRight.castShadow = true; 
        frontRight.receiveShadow = true;
        group.add(frontRight);
        
        const topDoor = new THREE.Mesh(
            new THREE.BoxGeometry(doorWidth, h - doorHeight, wallThick),
            new THREE.MeshStandardMaterial({ color })
        );
        topDoor.position.set(0, h - (h - doorHeight)/2, d/2 - wallThick/2);
        topDoor.castShadow = true; 
        topDoor.receiveShadow = true;
        group.add(topDoor);
        
        const doorFrame = new THREE.Mesh(
            new THREE.BoxGeometry(doorWidth + 0.2, doorHeight + 0.2, 0.3),
            new THREE.MeshStandardMaterial({ color: 0x4a2c1a })
        );
        doorFrame.position.set(0, doorHeight/2, d/2 - 0.1);
        doorFrame.castShadow = true; 
        doorFrame.receiveShadow = true;
        group.add(doorFrame);
        
        const door = new THREE.Mesh(
            new THREE.BoxGeometry(doorWidth - 0.2, doorHeight - 0.2, 0.2),
            new THREE.MeshStandardMaterial({ color: 0x8B5A2B })
        );
        door.position.set(0, doorHeight/2, d/2);
        door.castShadow = true; 
        door.receiveShadow = true;
        group.add(door);
        
        const roof = new THREE.Mesh(
            new THREE.ConeGeometry(Math.max(w, d) * 0.7, 2, 4),
            new THREE.MeshStandardMaterial({ color: 0x884422 })
        );
        roof.position.set(0, h + 1, 0);
        roof.rotation.y = Math.PI/4;
        roof.castShadow = true; 
        roof.receiveShadow = true;
        group.add(roof);
        
        const stepGroup = new THREE.Group();
        for (let s = 0; s < 4; s++) {
            const step = new THREE.Mesh(
                new THREE.BoxGeometry(2.0, 0.3, 1.0),
                new THREE.MeshStandardMaterial({ color: 0xcccccc })
            );
            step.position.set(0, 0.15 + s * 0.5, -1.5 + s * 0.8);
            step.castShadow = true; 
            step.receiveShadow = true;
            stepGroup.add(step);
        }
        stepGroup.position.set(0, 0, 0);
        group.add(stepGroup);
        
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
        for (let i = 0; i < 20; i++) {
            const treeGroup = new THREE.Group();
            
            const trunk = new THREE.Mesh(
                new THREE.CylinderGeometry(0.5, 0.7, 2),
                new THREE.MeshStandardMaterial({ color: 0x8B5A2B })
            );
            trunk.position.y = 1;
            trunk.castShadow = true;
            trunk.receiveShadow = true;
            treeGroup.add(trunk);
            
            const leaves = new THREE.Mesh(
                new THREE.ConeGeometry(1.5, 2, 8),
                new THREE.MeshStandardMaterial({ color: 0x2a8a2a })
            );
            leaves.position.y = 2.5;
            leaves.castShadow = true;
            leaves.receiveShadow = true;
            treeGroup.add(leaves);
            
            treeGroup.position.set((Math.random()-0.5)*60, 0, (Math.random()-0.5)*60);
            this.scene.add(treeGroup);
            this.trees.push(treeGroup);
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
        
        ctx.fillStyle = '#0a0a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#8B4513';
        this.buildings.forEach(b => {
            const x = (b.mesh.position.x + 50) * 2;
            const z = (b.mesh.position.z + 50) * 2;
            if (x > 0 && x < canvas.width && z > 0 && z < canvas.height) {
                ctx.fillRect(x-3, z-3, 6, 6);
            }
        });
        
        ctx.fillStyle = '#ff3333';
        this.otherPlayers.forEach((player) => {
            const x = (player.mesh.position.x + 50) * 2;
            const z = (player.mesh.position.z + 50) * 2;
            if (x > 0 && x < canvas.width && z > 0 && z < canvas.height) {
                ctx.beginPath();
                ctx.arc(x, z, 4, 0, 2*Math.PI);
                ctx.fill();
                
                ctx.strokeStyle = '#ffffff';
                ctx.beginPath();
                ctx.moveTo(x, z);
                ctx.lineTo(
                    x + Math.sin(player.mesh.rotation.y) * 8,
                    z + Math.cos(player.mesh.rotation.y) * 8
                );
                ctx.stroke();
            }
        });
        
        ctx.fillStyle = '#ffaa00';
        this.ammoBoxes.forEach(box => {
            const x = (box.position.x + 50) * 2;
            const z = (box.position.z + 50) * 2;
            ctx.beginPath();
            ctx.arc(x, z, 2, 0, 2*Math.PI);
            ctx.fill();
        });
        
        ctx.fillStyle = '#33ff33';
        ctx.beginPath();
        ctx.arc(canvas.width/2, canvas.height/2, 5, 0, 2*Math.PI);
        ctx.fill();
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
        
        for (let [playerId, playerObj] of this.otherPlayers) {
            if (!playerObj.mesh || !playerObj.data.alive) continue;
            
            const toPlayer = playerObj.mesh.position.clone().sub(startPos);
            
            if (direction.angleTo(toPlayer) < 0.2 && toPlayer.length() < rayLength) {
                const distance = toPlayer.length();
                const damage = Math.max(10, Math.floor(30 * (1 - distance / rayLength)));
                
                this.registerHit(playerId, damage);
                
                this.showNotification(`Hit ${playerObj.data.name} for ${damage} damage!`, 'info');
                
                break;
            }
        }
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
        
        document.body.style.backgroundColor = '#ff0000';
        setTimeout(() => {
            document.body.style.backgroundColor = '';
        }, 100);
        
        if (this.firebaseReady && this.playerRef) {
            updateDoc(this.playerRef, { health: this.health }).catch(console.error);
        }
        
        if (this.health <= 0) {
            this.die();
        } else {
            this.showNotification(`-${amount} HP`, 'error');
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
                
                await this.recordWin(this.lastDamagedBy.id, this.lastDamagedBy.name, 'kill');
                
            } catch (error) {
                console.error('Error recording kill:', error);
            }
            
            this.spawnAmmoBoxOnDeath(this.camera.position, 15);
            
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
    
    async recordWin(playerId, playerName, type = 'kill') {
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
        
        this.otherPlayers.forEach((playerObj, playerId) => {
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
        
        if (this.gameActive) {
            this.camera.rotation.y = this.lookYaw;
            this.camera.rotation.x = this.lookPitch;
            
            const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
            forward.y = 0; 
            forward.normalize();
            
            const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
            right.y = 0; 
            right.normalize();
            
            const moveDelta = new THREE.Vector3(0, 0, 0);
            if (Math.abs(this.moveY) > 0.05) moveDelta.addScaledVector(forward, this.moveY * this.moveSpeed);
            if (Math.abs(this.moveX) > 0.05) moveDelta.addScaledVector(right, this.moveX * this.moveSpeed);
            
            if (moveDelta.length() > 0.01) {
                this.footstepTime += 0.15;
                this.bobAmount = Math.sin(this.footstepTime) * 0.02;
            } else {
                this.bobAmount *= 0.9;
            }
            
            this.camera.position.add(moveDelta);
            this.camera.position.y = 1.8 + Math.abs(this.bobAmount);
            
            this.camera.position.x = Math.max(-40, Math.min(40, this.camera.position.x));
            this.camera.position.z = Math.max(-40, Math.min(40, this.camera.position.z));
            
            if (this.insideBuilding && this.currentBuilding) {
                const inter = this.currentBuilding.interior;
                this.camera.position.x = Math.max(inter.minX + 0.5, Math.min(inter.maxX - 0.5, this.camera.position.x));
                this.camera.position.z = Math.max(inter.minZ + 0.5, Math.min(inter.maxZ - 0.5, this.camera.position.z));
            }
            
            this.otherPlayers.forEach((playerObj) => {
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
                            playerObj.healthBar.style.top = (y + 15) + 'px';
                        }
                    } else {
                        playerObj.nameTag.style.display = 'none';
                        if (playerObj.healthBar) playerObj.healthBar.style.display = 'none';
                    }
                }
            });
            
            this.ammoBoxes.forEach(box => {
                box.rotation.y += 0.01;
                box.position.y = 0.5 + Math.sin(Date.now() * 0.003) * 0.1;
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
    }
};

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
    `;
    document.head.appendChild(style);
}