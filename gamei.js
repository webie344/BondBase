import * as THREE from 'three';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
    getDatabase,
    ref,
    set,
    push,
    onValue,
    update,
    remove,
    onDisconnect,
    serverTimestamp,
    get
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyC9jF-ocy6HjsVzWVVlAyXW-4aIFgA79-A",
    authDomain: "crypto-6517d.firebaseapp.com",
    databaseURL: "https://crypto-6517d-default-rtdb.firebaseio.com",
    projectId: "crypto-6517d",
    storageBucket: "crypto-6517d.firebasestorage.app",
    messagingSenderId: "60263975159",
    appId: "1:60263975159:web:bd53dcaad86d6ed9592bf2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Gun sound
function playGunSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') {
            audioCtx.resume().then(() => createGunSound(audioCtx));
        } else {
            createGunSound(audioCtx);
        }
    } catch (e) {}
}

function createGunSound(ctx) {
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
}

// Killed sound
function playKilledSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') {
            audioCtx.resume().then(() => createKilledSound(audioCtx));
        } else {
            createKilledSound(audioCtx);
        }
    } catch (e) {}
}

function createKilledSound(ctx) {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.5);
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.5);
}

// Collect sound
function playCollectSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') {
            audioCtx.resume().then(() => createCollectSound(audioCtx));
        } else {
            createCollectSound(audioCtx);
        }
    } catch (e) {}
}

function createCollectSound(ctx) {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
}

class Game {
    constructor() {
        console.log('🎮 MULTIPLAYER GAME STARTING...');
        
        // Player ID
        this.playerId = this.generatePlayerId();
        this.playerName = this.generatePlayerName();
        console.log('Player ID:', this.playerId);
        
        // Initialize ALL arrays
        this.buildings = [];
        this.doors = [];
        this.rewardBoxes = [];
        this.bullets = [];
        this.trees = [];
        this.otherPlayers = {}; // Store other player meshes
        this.ammoBoxes = []; // Special ammo boxes from kills
        
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
        document.getElementById('gameContainer').appendChild(this.renderer.domElement);
        
        // Game state
        this.health = 100;
        this.score = 0;
        this.ammo = 30;
        this.maxAmmo = 30;
        this.boxesCollected = 0;
        this.kills = 0;
        this.deaths = 0;
        this.gameActive = false;
        this.lastShot = 0;
        this.shootCooldown = 300; // ms
        
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
        
        // Kill notifications
        this.killMessages = [];
        this.createKillFeed();
        
        // Setup everything
        this.setupLighting();
        this.setupGround();
        this.createRealisticBuildings();
        this.createSimpleEnvironment();
        this.spawnRewardBoxes(30);
        
        this.setupControls();
        this.setupMinimap();
        
        // Setup multiplayer
        this.setupMultiplayer();
        
        // Door check interval
        setInterval(() => this.checkNearbyDoors(), 200);
        
        // Update player position in Firebase
        setInterval(() => this.updatePlayerPosition(), 100);
        
        this.animate();
        
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }
    
    generatePlayerId() {
        return 'player_' + Math.random().toString(36).substr(2, 9);
    }
    
    generatePlayerName() {
        const names = ['Viper', 'Shadow', 'Ghost', 'Phoenix', 'Raptor', 'Falcon', 'Tiger', 'Wolf', 'Eagle', 'Cobra'];
        return names[Math.floor(Math.random() * names.length)] + '_' + Math.floor(Math.random() * 1000);
    }
    
    createKillFeed() {
        const feed = document.createElement('div');
        feed.id = 'killFeed';
        feed.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            width: 300px;
            z-index: 100;
            pointer-events: none;
            display: flex;
            flex-direction: column;
            gap: 5px;
            align-items: flex-end;
        `;
        document.body.appendChild(feed);
        this.killFeedElement = feed;
    }
    
    addKillMessage(killer, victim) {
        const message = document.createElement('div');
        message.style.cssText = `
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 8px 15px;
            border-radius: 20px;
            font-weight: bold;
            border-left: 4px solid #ff3333;
            animation: slideIn 0.3s ease;
            box-shadow: 0 4px 10px rgba(0,0,0,0.5);
            backdrop-filter: blur(5px);
            font-size: 14px;
        `;
        message.innerHTML = `<span style="color: #ffaa00;">${killer}</span> killed <span style="color: #ff3333;">${victim}</span> 🔫`;
        
        this.killFeedElement.appendChild(message);
        
        setTimeout(() => {
            message.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => message.remove(), 300);
        }, 5000);
    }
    
    setupMultiplayer() {
        // Reference to players in Firebase
        this.playersRef = ref(db, 'game/players');
        this.killsRef = ref(db, 'game/kills');
        this.ammoBoxesRef = ref(db, 'game/ammoBoxes');
        
        // Listen for other players
        onValue(this.playersRef, (snapshot) => {
            const players = snapshot.val() || {};
            
            // Update player count
            const playerCount = Object.keys(players).length;
            document.getElementById('playerCount').innerHTML = `👥 ${playerCount} ${playerCount === 1 ? 'Player' : 'Players'}`;
            
            // Remove disconnected players
            Object.keys(this.otherPlayers).forEach(id => {
                if (!players[id] && id !== this.playerId) {
                    this.scene.remove(this.otherPlayers[id]);
                    delete this.otherPlayers[id];
                }
            });
            
            // Update or add players
            Object.keys(players).forEach(id => {
                if (id !== this.playerId) {
                    const playerData = players[id];
                    
                    if (this.otherPlayers[id]) {
                        // Update existing player
                        this.otherPlayers[id].position.set(
                            playerData.x || 0,
                            playerData.y || 1.8,
                            playerData.z || 0
                        );
                        this.otherPlayers[id].rotation.y = playerData.rotation || 0;
                    } else {
                        // Create new player
                        this.createOtherPlayer(id, playerData);
                    }
                }
            });
        });
        
        // Listen for kills
        onValue(this.killsRef, (snapshot) => {
            const kills = snapshot.val() || {};
            
            // Show kill notifications
            Object.keys(kills).forEach(key => {
                const kill = kills[key];
                if (!kill.seen) {
                    this.addKillMessage(kill.killer, kill.victim);
                    
                    // Mark as seen
                    update(ref(db, `game/kills/${key}`), { seen: true });
                }
            });
        });
        
        // Listen for ammo boxes
        onValue(this.ammoBoxesRef, (snapshot) => {
            const boxes = snapshot.val() || {};
            
            // Remove old boxes
            this.ammoBoxes.forEach(box => this.scene.remove(box));
            this.ammoBoxes = [];
            
            // Create new boxes
            Object.keys(boxes).forEach(key => {
                const box = boxes[key];
                this.createAmmoBox(key, box.x, box.y, box.z);
            });
        });
        
        // Set up disconnect
        onDisconnect(ref(db, `game/players/${this.playerId}`)).remove();
    }
    
    createOtherPlayer(id, data) {
        const group = new THREE.Group();
        
        // Body
        const body = new THREE.Mesh(
            new THREE.CylinderGeometry(0.5, 0.5, 1.8),
            new THREE.MeshStandardMaterial({ color: 0x3366ff })
        );
        body.position.y = 0.9;
        body.castShadow = true;
        body.receiveShadow = true;
        group.add(body);
        
        // Head
        const head = new THREE.Mesh(
            new THREE.SphereGeometry(0.3),
            new THREE.MeshStandardMaterial({ color: 0xffcc99 })
        );
        head.position.y = 1.8;
        head.castShadow = true;
        head.receiveShadow = true;
        group.add(head);
        
        // Name tag
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#ffaa00';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, canvas.width-2, canvas.height-2);
        ctx.fillStyle = 'white';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(data.name || 'Player', canvas.width/2, canvas.height/2);
        
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(2, 0.5, 1);
        sprite.position.y = 2.3;
        group.add(sprite);
        
        group.position.set(data.x || 0, data.y || 1.8, data.z || 0);
        group.rotation.y = data.rotation || 0;
        
        this.scene.add(group);
        this.otherPlayers[id] = group;
    }
    
    createAmmoBox(id, x, y, z) {
        const box = new THREE.Mesh(
            new THREE.BoxGeometry(0.8, 0.8, 0.8),
            new THREE.MeshStandardMaterial({ color: 0xff3333, emissive: 0x331100 })
        );
        box.position.set(x, y, z);
        box.castShadow = true;
        box.receiveShadow = true;
        
        // Add pulsing effect
        const edges = new THREE.EdgesGeometry(box.geometry);
        const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xffaa00 }));
        box.add(line);
        
        // Add floating animation
        box.userData = { floatY: y, floatSpeed: 0.02 + Math.random() * 0.02 };
        
        this.scene.add(box);
        this.ammoBoxes.push(box);
    }
    
    updatePlayerPosition() {
        if (!this.gameActive) return;
        
        const playerRef = ref(db, `game/players/${this.playerId}`);
        set(playerRef, {
            x: this.camera.position.x,
            y: this.camera.position.y,
            z: this.camera.position.z,
            rotation: this.lookYaw,
            name: this.playerName,
            health: this.health,
            kills: this.kills,
            deaths: this.deaths,
            lastUpdate: Date.now()
        });
    }
    
    reportKill(victimId, victimName) {
        this.kills++;
        
        const killRef = push(ref(db, 'game/kills'));
        set(killRef, {
            killer: this.playerName,
            victim: victimName,
            killerId: this.playerId,
            victimId: victimId,
            timestamp: Date.now(),
            seen: false
        });
        
        // Spawn ammo box at victim's position
        this.spawnAmmoBoxFromKill(victimId);
        
        // Update score
        this.score += 100;
        this.updateUI();
    }
    
    spawnAmmoBoxFromKill(victimId) {
        const victim = this.otherPlayers[victimId];
        if (!victim) return;
        
        const boxId = push(ref(db, 'game/ammoBoxes')).key;
        const boxRef = ref(db, `game/ammoBoxes/${boxId}`);
        
        set(boxRef, {
            x: victim.position.x,
            y: victim.position.y + 1,
            z: victim.position.z,
            spawnedAt: Date.now()
        });
        
        // Remove after 30 seconds
        setTimeout(() => {
            remove(boxRef);
        }, 30000);
    }
    
    checkPlayerHit() {
        const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        
        // Check other players
        Object.keys(this.otherPlayers).forEach(id => {
            const player = this.otherPlayers[id];
            if (!player) return;
            
            const toPlayer = player.position.clone().sub(this.camera.position);
            const distance = toPlayer.length();
            
            if (distance < 20 && direction.angleTo(toPlayer) < 0.2) {
                // Hit detected
                this.health -= 20;
                this.updateUI();
                
                if (this.health <= 0) {
                    this.die(id);
                }
            }
        });
    }
    
    die(killerId) {
        this.deaths++;
        this.gameActive = false;
        
        // Get killer name
        let killerName = 'Unknown';
        const killer = this.otherPlayers[killerId];
        if (killer && killer.userData) {
            killerName = killer.userData.name || 'Player';
        }
        
        // Report death
        const killRef = push(ref(db, 'game/kills'));
        set(killRef, {
            killer: killerName,
            victim: this.playerName,
            killerId: killerId,
            victimId: this.playerId,
            timestamp: Date.now(),
            seen: false
        });
        
        // Spawn ammo box at death location
        this.spawnAmmoBoxFromDeath();
        
        // Play sound
        playKilledSound();
        
        // Show death screen
        document.getElementById('finalScore').innerHTML = `Kills: ${this.kills} | Deaths: ${this.deaths}<br>Score: ${this.score}`;
        document.getElementById('gameOverlay').style.display = 'flex';
    }
    
    spawnAmmoBoxFromDeath() {
        const boxId = push(ref(db, 'game/ammoBoxes')).key;
        const boxRef = ref(db, `game/ammoBoxes/${boxId}`);
        
        set(boxRef, {
            x: this.camera.position.x,
            y: this.camera.position.y,
            z: this.camera.position.z,
            spawnedAt: Date.now()
        });
    }
    
    collectAmmoBox(box) {
        playCollectSound();
        
        // Add ammo
        this.ammo = Math.min(this.maxAmmo, this.ammo + 15);
        this.score += 25;
        this.boxesCollected++;
        this.updateUI();
        
        // Remove from scene
        this.scene.remove(box);
        
        // Remove from Firebase
        // Find which box this is
        this.ammoBoxes = this.ammoBoxes.filter(b => b !== box);
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
        
        // Add some paths
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
        
        // Create 8 detailed buildings
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
        
        // Back wall
        const backWall = new THREE.Mesh(
            new THREE.BoxGeometry(w, h, wallThick),
            new THREE.MeshStandardMaterial({ color })
        );
        backWall.position.set(0, h/2, -d/2 + wallThick/2);
        backWall.castShadow = true; 
        backWall.receiveShadow = true;
        group.add(backWall);
        
        // Left wall
        const leftWall = new THREE.Mesh(
            new THREE.BoxGeometry(wallThick, h, d),
            new THREE.MeshStandardMaterial({ color })
        );
        leftWall.position.set(-w/2 + wallThick/2, h/2, 0);
        leftWall.castShadow = true; 
        leftWall.receiveShadow = true;
        group.add(leftWall);
        
        // Right wall
        const rightWall = new THREE.Mesh(
            new THREE.BoxGeometry(wallThick, h, d),
            new THREE.MeshStandardMaterial({ color })
        );
        rightWall.position.set(w/2 - wallThick/2, h/2, 0);
        rightWall.castShadow = true; 
        rightWall.receiveShadow = true;
        group.add(rightWall);
        
        // Front wall with door
        const doorWidth = 2.0;
        const doorHeight = 2.5;
        
        // Left part of front wall
        const frontLeft = new THREE.Mesh(
            new THREE.BoxGeometry((w - doorWidth)/2, h, wallThick),
            new THREE.MeshStandardMaterial({ color })
        );
        frontLeft.position.set(-(w + doorWidth)/4, h/2, d/2 - wallThick/2);
        frontLeft.castShadow = true; 
        frontLeft.receiveShadow = true;
        group.add(frontLeft);
        
        // Right part
        const frontRight = new THREE.Mesh(
            new THREE.BoxGeometry((w - doorWidth)/2, h, wallThick),
            new THREE.MeshStandardMaterial({ color })
        );
        frontRight.position.set((w + doorWidth)/4, h/2, d/2 - wallThick/2);
        frontRight.castShadow = true; 
        frontRight.receiveShadow = true;
        group.add(frontRight);
        
        // Top part above door
        const topDoor = new THREE.Mesh(
            new THREE.BoxGeometry(doorWidth, h - doorHeight, wallThick),
            new THREE.MeshStandardMaterial({ color })
        );
        topDoor.position.set(0, h - (h - doorHeight)/2, d/2 - wallThick/2);
        topDoor.castShadow = true; 
        topDoor.receiveShadow = true;
        group.add(topDoor);
        
        // Door frame
        const doorFrame = new THREE.Mesh(
            new THREE.BoxGeometry(doorWidth + 0.2, doorHeight + 0.2, 0.3),
            new THREE.MeshStandardMaterial({ color: 0x4a2c1a })
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
        
        // INTERIOR STEPS
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
        
        // Store building data
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
        // Add some trees
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
    
    spawnRewardBoxes(count) {
        // Remove old boxes
        this.rewardBoxes.forEach(box => this.scene.remove(box));
        this.rewardBoxes = [];
        
        for (let i = 0; i < count; i++) {
            const box = new THREE.Mesh(
                new THREE.BoxGeometry(1, 1, 1),
                new THREE.MeshStandardMaterial({ color: 0xffaa00, emissive: 0x442200 })
            );
            box.position.set(
                (Math.random()-0.5)*50,
                2 + Math.random() * 5,
                (Math.random()-0.5)*50
            );
            box.castShadow = true;
            box.receiveShadow = true;
            
            // Add wireframe
            const edges = new THREE.EdgesGeometry(box.geometry);
            const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xffff00 }));
            box.add(line);
            
            this.scene.add(box);
            this.rewardBoxes.push(box);
        }
        console.log(`Spawned ${this.rewardBoxes.length} boxes`);
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
            document.getElementById('doorIndicator').style.display = found ? 'block' : 'none';
        }
    }
    
    enterBuilding(building) {
        if (!building || this.insideBuilding) return;
        
        this.insideBuilding = true;
        this.currentBuilding = building;
        
        // Position inside
        this.camera.position.set(
            building.doorPos.x,
            1.8,
            building.doorPos.z - 3
        );
        
        document.getElementById('doorIndicator').textContent = '🏢 INSIDE - TAP SHOOT TO EXIT';
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
        
        document.getElementById('doorIndicator').textContent = '🚪 NEAR DOOR - TAP SHOOT TO ENTER';
        document.getElementById('doorIndicator').style.display = 'none';
        this.currentBuilding = null;
    }
    
    setupControls() {
        const swipeZone = document.getElementById('viewSwipeZone');
        const joystickEl = document.getElementById('joystickContainer');
        
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
            document.getElementById('movementSpeed').textContent = '0';
            this.joystickThumb.style.transform = `translate(0px, 0px)`;
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
        
        // Shoot/Interact button
        document.getElementById('shootBtn').addEventListener('touchstart', (e) => { 
            e.preventDefault(); 
            
            if (!this.gameActive) return;
            
            const now = Date.now();
            if (now - this.lastShot < this.shootCooldown) return;
            this.lastShot = now;
            
            if (this.insideBuilding) {
                this.exitBuilding();
            } else if (this.nearbyDoor) {
                this.enterBuilding(this.nearbyDoor);
            } else if (this.ammo > 0) {
                this.shoot();
                playGunSound();
            }
        });
        
        document.getElementById('reloadBtn').addEventListener('touchstart', (e) => { 
            e.preventDefault(); 
            this.reload(); 
        });
        
        document.getElementById('startBtn').addEventListener('click', () => {
            document.getElementById('instructions').style.display = 'none';
            this.startGame();
        });
        
        document.getElementById('restartBtn').addEventListener('click', () => this.restart());
        
        // Add player count display
        const hud = document.getElementById('hud');
        const playerCountDiv = document.createElement('div');
        playerCountDiv.id = 'playerCount';
        playerCountDiv.innerHTML = '👥 0 Players';
        hud.appendChild(playerCountDiv);
    }
    
    updateJoystick(touch) {
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
        document.getElementById('movementSpeed').textContent = speed.toFixed(1);
        this.bobSpeed = speed;
    }
    
    setupMinimap() { 
        this.minimapCtx = document.getElementById('minimapCanvas').getContext('2d'); 
    }
    
    updateMinimap() {
        const ctx = this.minimapCtx;
        const canvas = document.getElementById('minimapCanvas');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Background
        ctx.fillStyle = '#0a0a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw buildings
        ctx.fillStyle = '#8B4513';
        this.buildings.forEach(b => {
            const x = (b.mesh.position.x + 50) * 2;
            const z = (b.mesh.position.z + 50) * 2;
            if (x > 0 && x < canvas.width && z > 0 && z < canvas.height) {
                ctx.fillRect(x-3, z-3, 6, 6);
            }
        });
        
        // Draw regular boxes
        ctx.fillStyle = '#ffaa00';
        this.rewardBoxes.forEach(box => {
            const x = (box.position.x + 50) * 2;
            const z = (box.position.z + 50) * 2;
            ctx.beginPath();
            ctx.arc(x, z, 3, 0, 2*Math.PI);
            ctx.fill();
        });
        
        // Draw ammo boxes (red)
        ctx.fillStyle = '#ff3333';
        this.ammoBoxes.forEach(box => {
            const x = (box.position.x + 50) * 2;
            const z = (box.position.z + 50) * 2;
            ctx.beginPath();
            ctx.arc(x, z, 4, 0, 2*Math.PI);
            ctx.fill();
        });
        
        // Draw other players
        ctx.fillStyle = '#3366ff';
        Object.values(this.otherPlayers).forEach(player => {
            const x = (player.position.x + 50) * 2;
            const z = (player.position.z + 50) * 2;
            ctx.beginPath();
            ctx.arc(x, z, 4, 0, 2*Math.PI);
            ctx.fill();
        });
        
        // Player
        ctx.fillStyle = '#33ff33';
        ctx.beginPath();
        ctx.arc(canvas.width/2, canvas.height/2, 5, 0, 2*Math.PI);
        ctx.fill();
        
        // Direction indicator
        ctx.strokeStyle = '#33ff33';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(canvas.width/2, canvas.height/2);
        const dirX = canvas.width/2 + Math.sin(this.lookYaw) * 15;
        const dirY = canvas.height/2 - Math.cos(this.lookYaw) * 15;
        ctx.lineTo(dirX, dirY);
        ctx.stroke();
    }
    
    startGame() {
        this.gameActive = true;
        this.health = 100; 
        this.score = 0; 
        this.ammo = 30; 
        this.boxesCollected = 0;
        this.kills = 0;
        this.deaths = 0;
        this.camera.position.set(0, 1.8, 15);
        this.updateUI();
        
        // Add player to Firebase
        const playerRef = ref(db, `game/players/${this.playerId}`);
        set(playerRef, {
            x: this.camera.position.x,
            y: this.camera.position.y,
            z: this.camera.position.z,
            rotation: this.lookYaw,
            name: this.playerName,
            health: this.health,
            kills: this.kills,
            deaths: this.deaths,
            lastUpdate: Date.now()
        });
    }
    
    shoot() {
        if (!this.gameActive || this.ammo <= 0) return;
        this.ammo--; 
        this.updateUI();
        
        const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        
        // Check for box hits (regular reward boxes)
        for (let i = this.rewardBoxes.length - 1; i >= 0; i--) {
            const box = this.rewardBoxes[i];
            const toBox = box.position.clone().sub(this.camera.position);
            if (direction.angleTo(toBox) < 0.2 && toBox.length() < 20) {
                this.scene.remove(box);
                this.rewardBoxes.splice(i, 1);
                this.score += 50;
                this.boxesCollected++;
                this.updateUI();
                playCollectSound();
                break;
            }
        }
        
        // Check for ammo box hits (from kills)
        for (let i = this.ammoBoxes.length - 1; i >= 0; i--) {
            const box = this.ammoBoxes[i];
            const toBox = box.position.clone().sub(this.camera.position);
            if (direction.angleTo(toBox) < 0.2 && toBox.length() < 20) {
                this.collectAmmoBox(box);
                break;
            }
        }
        
        // Check for player hits
        this.checkPlayerHit();
    }
    
    reload() { 
        if (this.gameActive) { 
            this.ammo = this.maxAmmo; 
            this.updateUI(); 
        } 
    }
    
    updateUI() {
        document.getElementById('healthValue').textContent = this.health;
        document.getElementById('scoreValue').textContent = this.score;
        document.getElementById('ammoValue').textContent = this.ammo;
        document.getElementById('boxesValue').textContent = this.boxesCollected;
        
        // Update health color
        const healthEl = document.getElementById('healthValue');
        if (this.health > 70) healthEl.style.color = '#33ff33';
        else if (this.health > 30) healthEl.style.color = '#ffaa00';
        else healthEl.style.color = '#ff3333';
        
        if (this.health <= 0) this.gameOver();
    }
    
    gameOver() { 
        this.gameActive = false; 
        
        // Remove player from Firebase
        remove(ref(db, `game/players/${this.playerId}`));
        
        // Save result
        this.saveResult();
        
        document.getElementById('finalScore').innerHTML = `Kills: ${this.kills} | Deaths: ${this.deaths}<br>Score: ${this.score} | Boxes: ${this.boxesCollected}`; 
        document.getElementById('gameOverlay').style.display = 'flex'; 
    }
    
    saveResult() {
        const resultRef = push(ref(db, 'game/results'));
        set(resultRef, {
            playerId: this.playerId,
            playerName: this.playerName,
            kills: this.kills,
            deaths: this.deaths,
            score: this.score,
            boxesCollected: this.boxesCollected,
            timestamp: Date.now(),
            date: new Date().toISOString().split('T')[0]
        });
    }
    
    restart() {
        // Clean up old boxes
        this.rewardBoxes.forEach(b => this.scene.remove(b));
        this.rewardBoxes = [];
        this.spawnRewardBoxes(30);
        
        // Clear ammo boxes
        this.ammoBoxes.forEach(b => this.scene.remove(b));
        this.ammoBoxes = [];
        
        this.health = 100; 
        this.score = 0; 
        this.ammo = 30; 
        this.boxesCollected = 0;
        this.kills = 0;
        this.deaths = 0;
        this.gameActive = true;
        this.camera.position.set(0, 1.8, 15);
        this.lookYaw = 0; 
        this.lookPitch = 0;
        this.insideBuilding = false;
        this.currentBuilding = null;
        this.nearbyDoor = null;
        
        // Add player back to Firebase
        const playerRef = ref(db, `game/players/${this.playerId}`);
        set(playerRef, {
            x: this.camera.position.x,
            y: this.camera.position.y,
            z: this.camera.position.z,
            rotation: this.lookYaw,
            name: this.playerName,
            health: this.health,
            kills: this.kills,
            deaths: this.deaths,
            lastUpdate: Date.now()
        });
        
        document.getElementById('doorIndicator').style.display = 'none';
        document.getElementById('gameOverlay').style.display = 'none';
        this.updateUI();
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        if (this.gameActive) {
            // Apply look
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
            
            // Simple bounds
            this.camera.position.x = Math.max(-40, Math.min(40, this.camera.position.x));
            this.camera.position.z = Math.max(-40, Math.min(40, this.camera.position.z));
            
            // Inside building collision
            if (this.insideBuilding && this.currentBuilding) {
                const inter = this.currentBuilding.interior;
                this.camera.position.x = Math.max(inter.minX + 0.5, Math.min(inter.maxX - 0.5, this.camera.position.x));
                this.camera.position.z = Math.max(inter.minZ + 0.5, Math.min(inter.maxZ - 0.5, this.camera.position.z));
            }
            
            // Animate boxes
            this.rewardBoxes.forEach(box => {
                box.rotation.y += 0.01;
            });
            
            // Animate ammo boxes (floating)
            this.ammoBoxes.forEach(box => {
                box.rotation.y += 0.02;
                box.position.y = box.userData.floatY + Math.sin(Date.now() * box.userData.floatSpeed) * 0.2;
            });
            
            this.updateMinimap();
        }
        
        this.renderer.render(this.scene, this.camera);
    }
}

// Add animation styles for kill feed
const style = document.createElement('style');
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

// Start game
window.onload = () => { 
    const game = new Game(); 
};