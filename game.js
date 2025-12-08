// game.js - COMPLETE Game System with All Fixes
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
    getDoc, 
    updateDoc, 
    query, 
    where, 
    getDocs,
    addDoc,
    serverTimestamp,
    onSnapshot,
    orderBy,
    arrayUnion,
    deleteDoc,
    Timestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyC9uL_BX14Z6rRpgG4MT9Tca1opJl8EviQ",
    authDomain: "dating-connect.firebaseapp.com",
    projectId: "dating-connect",
    storageBucket: "dating-connect.appspot.com",
    messagingSenderId: "1062172180210",
    appId: "1:1062172180210:web:0c9b3c1578a5dbae58da6b"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

class GameManager {
    constructor() {
        this.games = {
            'rock-paper-scissors': new RockPaperScissors(this),
            'tic-tac-toe': new TicTacToe(this),
            'coin-toss': new CoinToss(this),
            'number-guess': new NumberGuess(this),
            'memory-match': new MemoryMatch(this),
            'word-scramble': new WordScramble(this)
        };
        this.currentGame = null;
        this.opponent = null;
        this.opponentName = null;
        this.isMyTurn = false;
        this.gameInvites = [];
        this.currentUser = null;
        this.currentGameSession = null;
        this.activeGames = new Map();
        this.userCache = new Map();
        this.gameSessionListener = null;
        this.endedGames = new Set();
        this.timerInterval = null;
        this.countdownTime = 3; // 3-second countdown
        this.countdownStartTime = null;
        
        this.init();
    }

    init() {
        this.setupAuthListener();
        this.addGameStyles();
        this.renderGameModal();
    }

    setupAuthListener() {
        onAuthStateChanged(auth, (user) => {
            if (user) {
                this.currentUser = user;
                this.setupFirebaseListeners();
                this.resumeInterruptedGames();
            } else {
                this.currentUser = null;
                this.cleanup();
            }
        });
    }

    // NEW: Resume games that were interrupted during countdown
    async resumeInterruptedGames() {
        if (!this.currentUser) return;
        
        try {
            const pendingGamesQuery = query(
                collection(db, 'gameSessions'),
                where('participants', 'array-contains', this.currentUser.uid),
                where('status', '==', 'pending')
            );
            
            const snapshot = await getDocs(pendingGamesQuery);
            
            for (const docSnap of snapshot.docs) {
                const gameData = docSnap.data();
                const createdAt = gameData.createdAt;
                
                // If game was created more than 30 seconds ago, activate it automatically
                if (createdAt && this.isTimestampOlderThan(createdAt, 30)) {
                    console.log('Resuming interrupted game:', docSnap.id);
                    await this.activateGame(docSnap.id, gameData.gameType);
                }
            }
        } catch (error) {
            console.error('Error resuming interrupted games:', error);
        }
    }

    // NEW: Check if timestamp is older than specified seconds
    isTimestampOlderThan(timestamp, seconds) {
        if (!timestamp) return true;
        
        const now = Date.now();
        const timestampMs = timestamp.toDate ? timestamp.toDate().getTime() : timestamp;
        return (now - timestampMs) > (seconds * 1000);
    }

    setupFirebaseListeners() {
        if (!this.currentUser) return;
        
        // Listen for incoming game invites
        const invitesQuery = query(
            collection(db, 'gameInvites'),
            where('toUserId', '==', this.currentUser.uid),
            where('status', '==', 'pending')
        );
        
        this.invitesListener = onSnapshot(invitesQuery, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    this.handleGameInvite(change.doc.data(), change.doc.id);
                }
            });
        });

        // Listen for active games
        const gamesQuery = query(
            collection(db, 'gameSessions'),
            where('participants', 'array-contains', this.currentUser.uid),
            where('status', 'in', ['active', 'pending'])
        );
        
        this.gamesListener = onSnapshot(gamesQuery, (snapshot) => {
            this.activeGames.clear();
            
            snapshot.forEach((doc) => {
                const gameData = doc.data();
                if (this.endedGames.has(doc.id)) {
                    return;
                }
                const opponentId = gameData.participants.find(id => id !== this.currentUser.uid);
                if (opponentId) {
                    this.activeGames.set(opponentId, { ...gameData, id: doc.id });
                }
            });
            
            this.updateGameIcons();
        });
    }

    async getUserName(userId) {
        if (userId === this.currentUser?.uid) return 'You';
        if (this.userCache.has(userId)) return this.userCache.get(userId);
        
        try {
            const userDoc = await getDoc(doc(db, 'users', userId));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                // Try different possible name fields
                const userName = userData.name || userData.displayName || userData.username || 'Unknown User';
                this.userCache.set(userId, userName);
                return userName;
            }
            return 'Unknown User';
        } catch (error) {
            console.error('Error fetching user name:', error);
            return 'Unknown User';
        }
    }

    async getCurrentUserName() {
        if (!this.currentUser) return 'Unknown User';
        
        // First try to get from Firebase Auth
        if (this.currentUser.displayName) {
            return this.currentUser.displayName;
        }
        
        // Then try to get from Firestore
        try {
            const userDoc = await getDoc(doc(db, 'users', this.currentUser.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                return userData.name || userData.displayName || userData.username || 'Unknown User';
            }
        } catch (error) {
            console.error('Error fetching current user name:', error);
        }
        
        return 'Unknown User';
    }

    updateGameIcons() {
        const gameBtn = document.getElementById('gameInviteBtn');
        if (!gameBtn) return;
        
        const activeCount = this.activeGames.size;
        const existingBadge = gameBtn.querySelector('.game-badge');
        
        if (existingBadge) existingBadge.remove();
        
        if (activeCount > 0) {
            const badge = document.createElement('span');
            badge.className = 'game-badge';
            badge.textContent = activeCount;
            gameBtn.appendChild(badge);
        }
    }

    async sendGameInvite(gameType, opponentId, opponentName) {
        if (!this.currentUser) {
            this.showNotification('Please log in to send game invites', 'error');
            return;
        }

        if (opponentId === this.currentUser.uid) {
            this.showNotification('Cannot play game with yourself', 'error');
            return;
        }

        // Check if there's already an active game
        if (this.activeGames.has(opponentId) && !this.endedGames.has(this.activeGames.get(opponentId).id)) {
            const existingGame = this.activeGames.get(opponentId);
            this.showNotification(`Continuing existing game with ${opponentName}`, 'info');
            await this.setupGameSessionListener(existingGame.id);
            return;
        }

        // FIX: Get the actual sender's name properly
        const fromUserName = await this.getCurrentUserName();
        console.log('Sending invite from:', fromUserName, 'to:', opponentName);
        
        const inviteData = {
            fromUserId: this.currentUser.uid,
            fromUserName: fromUserName, // This should be the actual sender's name
            toUserId: opponentId,
            toUserName: opponentName,
            gameType: gameType,
            status: 'pending',
            timestamp: serverTimestamp()
        };

        try {
            await addDoc(collection(db, 'gameInvites'), inviteData);
            this.showNotification(`Game invite sent to ${opponentName}!`, 'success');
        } catch (error) {
            console.error('Error sending invite:', error);
            this.showNotification('Failed to send invite', 'error');
        }
    }

    async handleGameInvite(inviteData, inviteId) {
        console.log('Handling invite data:', inviteData);
        console.log('Handling invite from:', inviteData.fromUserName, 'to user:', this.currentUser?.uid);
        
        // FIX: Only handle invites sent TO the current user
        if (inviteData.fromUserId === this.currentUser.uid) {
            console.log('Ignoring invite we sent ourselves');
            return;
        }

        // Check if we already have an active game with this user
        if (this.activeGames.has(inviteData.fromUserId) && !this.endedGames.has(this.activeGames.get(inviteData.fromUserId).id)) {
            const existingGame = this.activeGames.get(inviteData.fromUserId);
            this.showNotification(`You already have an active game with ${inviteData.fromUserName}`, 'info');
            await this.setupGameSessionListener(existingGame.id);
            
            // Reject the new invite
            await updateDoc(doc(db, 'gameInvites', inviteId), {
                status: 'rejected'
            });
            return;
        }

        this.showInviteNotification(inviteData, inviteId);
    }

    showInviteNotification(inviteData, inviteId) {
        const notification = document.createElement('div');
        notification.className = 'game-invite-notification';
        
        // FIX: Debug the invite data
        console.log('Showing notification with inviteData:', inviteData);
        
        // Use the actual sender's name from inviteData
        const senderName = inviteData.fromUserName || 'Someone';
        
        notification.innerHTML = `
            <div class="invite-content">
                <h3>🎮 Game Invitation!</h3>
                <p><strong>${senderName}</strong> invited you to play <strong>${this.formatGameName(inviteData.gameType)}</strong></p>
                <div class="invite-buttons">
                    <button class="accept-btn">Accept</button>
                    <button class="reject-btn">Reject</button>
                </div>
            </div>
        `;

        notification.querySelector('.accept-btn').onclick = () => this.acceptGameInvite(inviteData, inviteId);
        notification.querySelector('.reject-btn').onclick = () => this.rejectGameInvite(inviteId);

        document.body.appendChild(notification);

        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 30000);
    }

    formatGameName(gameType) {
        const names = {
            'rock-paper-scissors': 'Rock Paper Scissors',
            'tic-tac-toe': 'Tic Tac Toe',
            'coin-toss': 'Coin Toss',
            'number-guess': 'Number Guess',
            'memory-match': 'Memory Match',
            'word-scramble': 'Word Scramble'
        };
        return names[gameType] || gameType;
    }

    // Start countdown timer for Rock Paper Scissors (simultaneous play)
    startCountdownTimer(gameSessionId, gameType) {
        // Clear any existing timer
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        
        // Remove any existing countdown timer
        const existingTimer = document.querySelector('.countdown-timer');
        if (existingTimer) {
            document.body.removeChild(existingTimer);
        }
        
        let countdown = this.countdownTime;
        this.countdownStartTime = Date.now();
        
        const timerDisplay = document.createElement('div');
        timerDisplay.className = 'countdown-timer';
        timerDisplay.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 30px;
            border-radius: 15px;
            font-size: 3em;
            font-weight: bold;
            z-index: 10003;
            text-align: center;
        `;
        
        document.body.appendChild(timerDisplay);
        
        this.timerInterval = setInterval(() => {
            timerDisplay.textContent = countdown > 0 ? countdown : 'GO!';
            
            if (countdown === 0) {
                clearInterval(this.timerInterval);
                this.timerInterval = null;
                setTimeout(() => {
                    if (document.body.contains(timerDisplay)) {
                        document.body.removeChild(timerDisplay);
                    }
                    this.activateGame(gameSessionId, gameType);
                }, 1000);
            }
            countdown--;
        }, 1000);
    }

    // Activate game after countdown - different logic for RPS vs other games
    async activateGame(gameSessionId, gameType) {
        try {
            if (gameType === 'rock-paper-scissors') {
                // For RPS: Both players can play simultaneously, no turns
                await updateDoc(doc(db, 'gameSessions', gameSessionId), {
                    status: 'active',
                    currentTurn: 'both', // Special value indicating both players can play
                    updatedAt: serverTimestamp()
                });
            } else {
                // For other games: Randomly determine first player
                const gameSnap = await getDoc(doc(db, 'gameSessions', gameSessionId));
                if (gameSnap.exists()) {
                    const gameData = gameSnap.data();
                    const randomIndex = Math.floor(Math.random() * gameData.participants.length);
                    const firstPlayer = gameData.participants[randomIndex];
                    
                    await updateDoc(doc(db, 'gameSessions', gameSessionId), {
                        currentTurn: firstPlayer,
                        status: 'active',
                        updatedAt: serverTimestamp()
                    });
                }
            }
            
        } catch (error) {
            console.error('Error activating game:', error);
            // Fallback: set status to active
            await updateDoc(doc(db, 'gameSessions', gameSessionId), {
                status: 'active',
                updatedAt: serverTimestamp()
            });
        }
    }

    async acceptGameInvite(inviteData, inviteId) {
        try {
            // Mark invite as accepted
            await updateDoc(doc(db, 'gameInvites', inviteId), {
                status: 'accepted'
            });

            const currentUserName = await this.getCurrentUserName();

            // Create game session with pending status
            const participants = [inviteData.fromUserId, this.currentUser.uid];
            const gameSession = {
                participants: participants,
                gameType: inviteData.gameType,
                status: 'pending', // Start as pending until countdown completes
                currentTurn: null, // Will be set after countdown
                players: {
                    [inviteData.fromUserId]: { 
                        name: inviteData.fromUserName, 
                        score: 0,
                        ready: true
                    },
                    [this.currentUser.uid]: { 
                        name: currentUserName, 
                        score: 0,
                        ready: true
                    }
                },
                moves: [],
                winner: null,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };

            // Add game-specific data
            if (inviteData.gameType === 'number-guess') {
                gameSession.targetNumber = Math.floor(Math.random() * 100) + 1;
            } else if (inviteData.gameType === 'word-scramble') {
                const words = ['hello', 'world', 'javascript', 'programming', 'computer', 'internet', 'keyboard', 'mouse'];
                gameSession.currentWord = words[Math.floor(Math.random() * words.length)];
                gameSession.scrambledWord = this.scrambleWord(gameSession.currentWord);
            } else if (inviteData.gameType === 'memory-match') {
                const symbols = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼'];
                const shuffledCards = [...symbols, ...symbols].sort(() => Math.random() - 0.5);
                gameSession.cards = shuffledCards;
                gameSession.flippedCards = [];
                gameSession.matchedPairs = [];
                gameSession.currentSelection = [];
                gameSession.waitingForFlipBack = false;
            }

            const gameRef = await addDoc(collection(db, 'gameSessions'), gameSession);
            
            // Remove notification
            const notification = document.querySelector('.game-invite-notification');
            if (notification) document.body.removeChild(notification);

            // Start countdown timer
            this.startCountdownTimer(gameRef.id, inviteData.gameType);
            
            // Setup listener after countdown starts
            await this.setupGameSessionListener(gameRef.id);

        } catch (error) {
            console.error('Error accepting game invite:', error);
            this.showNotification('Error accepting game invite', 'error');
        }
    }

    scrambleWord(word) {
        const arr = word.split('');
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr.join('');
    }

    async rejectGameInvite(inviteId) {
        try {
            await updateDoc(doc(db, 'gameInvites', inviteId), {
                status: 'rejected'
            });

            const notification = document.querySelector('.game-invite-notification');
            if (notification) document.body.removeChild(notification);

        } catch (error) {
            this.showNotification('Error rejecting game invite', 'error');
        }
    }

    async setupGameSessionListener(gameId) {
        if (this.gameSessionListener) {
            this.gameSessionListener();
        }

        this.gameSessionListener = onSnapshot(doc(db, 'gameSessions', gameId), async (docSnap) => {
            if (!docSnap.exists()) {
                this.showNotification('Game session not found', 'error');
                return;
            }

            const gameData = docSnap.data();
            
            if (this.endedGames.has(docSnap.id)) {
                return;
            }

            this.currentGameSession = { ...gameData, id: docSnap.id };

            // Handle pending games (countdown interrupted)
            if (gameData.status === 'pending') {
                console.log('Game is pending countdown completion');
                
                // If countdown was interrupted, activate the game immediately
                if (gameData.createdAt && this.isTimestampOlderThan(gameData.createdAt, 30)) {
                    console.log('Countdown was interrupted, activating game now');
                    await this.activateGame(docSnap.id, gameData.gameType);
                    return;
                }
                
                // Otherwise, wait for normal countdown completion
                return;
            }

            const opponentId = gameData.participants.find(id => id !== this.currentUser.uid);
            if (!opponentId) {
                this.showNotification('Invalid game session', 'error');
                return;
            }

            const opponentName = await this.getUserName(opponentId);
            
            if (!this.currentGame || this.currentGame.id !== docSnap.id) {
                this.startGame(gameData.gameType, docSnap.id, opponentId, opponentName);
            }
            
            this.updateGameState(gameData);
        });
    }

    startGame(gameType, gameId, opponentId, opponentName) {
        this.currentGame = {
            id: gameId,
            type: gameType,
            opponentId: opponentId,
            opponentName: opponentName
        };
        
        this.opponent = opponentId;
        this.opponentName = opponentName;
        
        this.showGameModal(gameType);
    }

    updateGameState(gameData) {
        // For Rock Paper Scissors: both players can play simultaneously
        if (gameData.gameType === 'rock-paper-scissors') {
            this.isMyTurn = true; // Always true for RPS after countdown
        } else {
            this.isMyTurn = gameData.currentTurn === this.currentUser.uid;
        }
        
        if (this.games[gameData.gameType]) {
            this.games[gameData.gameType].updateState(gameData);
        }
        
        this.updateGameUI();
        
        if (gameData.status === 'completed' || gameData.status === 'ended') {
            this.showGameResult(gameData);
        }
    }

    showGameResult(gameData) {
        if (gameData.status === 'ended') {
            this.showNotification('Game ended', 'info');
            this.closeGame();
        } else if (gameData.winner === this.currentUser.uid) {
            this.showCelebrationPopup('🎉 You won the game!', 'victory');
        } else if (gameData.winner === 'draw') {
            this.showCelebrationPopup('🤝 Game ended in a draw!', 'draw');
        } else if (gameData.winner) {
            const winnerName = gameData.players[gameData.winner]?.name || 'Opponent';
            this.showCelebrationPopup(`😔 ${winnerName} won the game`, 'defeat');
        }
        
        if (gameData.status === 'completed') {
            setTimeout(() => {
                this.closeGame();
            }, 3000);
        }
    }

    // Celebration popup for win/loss/draw
    showCelebrationPopup(message, type = 'victory') {
        const popup = document.createElement('div');
        popup.className = `celebration-popup ${type}`;
        
        const emojis = {
            'victory': '🎉',
            'defeat': '😔', 
            'draw': '🤝'
        };
        
        const backgrounds = {
            'victory': 'linear-gradient(135deg, #4CAF50, #45a049)',
            'defeat': 'linear-gradient(135deg, #f44336, #d32f2f)',
            'draw': 'linear-gradient(135deg, #FF9800, #F57C00)'
        };
        
        popup.innerHTML = `
            <div class="celebration-content">
                <div class="celebration-emoji">${emojis[type]}</div>
                <div class="celebration-message">${message}</div>
                <button class="celebration-close">Continue</button>
            </div>
        `;
        
        popup.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10004;
            animation: fadeIn 0.3s ease-in;
        `;
        
        const content = popup.querySelector('.celebration-content');
        content.style.cssText = `
            background: ${backgrounds[type]};
            color: white;
            padding: 40px;
            border-radius: 20px;
            text-align: center;
            max-width: 300px;
            animation: popIn 0.5s ease-out;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        `;
        
        const emoji = popup.querySelector('.celebration-emoji');
        emoji.style.cssText = `
            font-size: 4em;
            margin-bottom: 20px;
            animation: bounce 1s infinite;
        `;
        
        const messageEl = popup.querySelector('.celebration-message');
        messageEl.style.cssText = `
            font-size: 1.5em;
            font-weight: bold;
            margin-bottom: 25px;
            line-height: 1.4;
        `;
        
        const closeBtn = popup.querySelector('.celebration-close');
        closeBtn.style.cssText = `
            background: rgba(255,255,255,0.2);
            color: white;
            border: 2px solid white;
            padding: 12px 30px;
            border-radius: 25px;
            font-size: 1.1em;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s ease;
        `;
        
        closeBtn.onmouseover = () => {
            closeBtn.style.background = 'rgba(255,255,255,0.3)';
        };
        
        closeBtn.onmouseout = () => {
            closeBtn.style.background = 'rgba(255,255,255,0.2)';
        };
        
        closeBtn.onclick = () => {
            document.body.removeChild(popup);
        };
        
        document.body.appendChild(popup);
        
        // Auto-close after 5 seconds
        setTimeout(() => {
            if (document.body.contains(popup)) {
                document.body.removeChild(popup);
            }
        }, 5000);
    }

    async sendGameMove(move) {
        if (!this.currentGame) {
            this.showNotification("No active game!", 'error');
            return;
        }

        // For Rock Paper Scissors: check if both players have made their moves
        if (this.currentGame.type === 'rock-paper-scissors') {
            await this.sendRPSMove(move);
        } else {
            // For other games: standard turn-based logic
            if (!this.isMyTurn) {
                this.showNotification("It's not your turn!", 'error');
                return;
            }
            await this.sendStandardMove(move);
        }
    }

    async sendRPSMove(move) {
        try {
            const gameRef = doc(db, 'gameSessions', this.currentGame.id);
            const gameSnap = await getDoc(gameRef);
            
            if (!gameSnap.exists()) {
                this.showNotification('Game session not found', 'error');
                return;
            }

            const gameData = gameSnap.data();
            const moves = gameData.moves || [];
            
            // Check if current user has already made a move in this round
            const userMove = moves.find(m => m.playerId === this.currentUser.uid && !m.processed);
            if (userMove) {
                this.showNotification('You have already made your move!', 'error');
                return;
            }
            
            if (!this.games[this.currentGame.type].isValidMove(move, moves, gameData)) {
                this.showNotification('Invalid move!', 'error');
                return;
            }
            
            const newMove = {
                playerId: this.currentUser.uid,
                move: move,
                timestamp: new Date().toISOString(),
                processed: false // Mark as unprocessed until both players move
            };
            
            const updatedMoves = [...moves, newMove];
            
            // Check if both players have made their moves
            const playerMoves = updatedMoves.filter(m => !m.processed);
            const playerIds = [...new Set(playerMoves.map(m => m.playerId))];
            
            let updateData = {
                moves: updatedMoves,
                updatedAt: serverTimestamp()
            };

            // If both players have made their moves, process the round
            if (playerIds.length >= 2) {
                const lastTwoMoves = playerMoves.slice(-2);
                const winnerResult = this.games[this.currentGame.type].checkWinner(lastTwoMoves, gameData);
                
                // Mark moves as processed
                updatedMoves.forEach(move => {
                    move.processed = true;
                });
                
                updateData.moves = updatedMoves;
                
                if (winnerResult && winnerResult !== 'draw') {
                    // Show celebration popup for round winner
                    if (winnerResult === this.currentUser.uid) {
                        this.showCelebrationPopup('🎉 You won this round!', 'victory');
                    } else {
                        this.showCelebrationPopup('😔 You lost this round!', 'defeat');
                    }
                    
                    updateData[`players.${winnerResult}.score`] = (gameData.players[winnerResult]?.score || 0) + 1;
                } else if (winnerResult === 'draw') {
                    this.showCelebrationPopup('🤝 This round is a draw!', 'draw');
                }
            }

            await updateDoc(gameRef, updateData);
            
        } catch (error) {
            console.error('Error sending RPS move:', error);
            this.showNotification('Error making move: ' + error.message, 'error');
        }
    }

    async sendStandardMove(move) {
        try {
            const gameRef = doc(db, 'gameSessions', this.currentGame.id);
            const gameSnap = await getDoc(gameRef);
            
            if (!gameSnap.exists()) {
                this.showNotification('Game session not found', 'error');
                return;
            }

            const gameData = gameSnap.data();
            
            if (!this.games[this.currentGame.type].isValidMove(move, gameData.moves || [], gameData)) {
                this.showNotification('Invalid move!', 'error');
                return;
            }
            
            const moves = gameData.moves || [];
            const newMove = {
                playerId: this.currentUser.uid,
                move: move,
                timestamp: new Date().toISOString()
            };
            
            const updatedMoves = [...moves, newMove];
            
            const nextTurn = gameData.participants.find(id => id !== this.currentUser.uid);
            
            const winnerResult = this.games[this.currentGame.type].checkWinner(updatedMoves, gameData);
            let winner = null;
            let status = 'active';
            
            if (winnerResult && winnerResult !== 'draw') {
                winner = winnerResult;
                status = 'completed';
            } else if (winnerResult === 'draw') {
                winner = 'draw';
                status = 'completed';
            }
            
            const updateData = {
                moves: updatedMoves,
                updatedAt: serverTimestamp()
            };

            if (winner) {
                updateData.winner = winner;
                updateData.status = status;
                updateData.currentTurn = null;
                updateData[`players.${winner}.score`] = (gameData.players[winner]?.score || 0) + 1;
            } else {
                updateData.currentTurn = nextTurn;
            }

            // For memory match, handle card flipping logic
            if (this.currentGame.type === 'memory-match') {
                const currentFlipped = gameData.flippedCards || [];
                const currentSelection = gameData.currentSelection || [];
                const currentMatched = gameData.matchedPairs || [];
                
                if (currentSelection.length === 0) {
                    updateData.currentSelection = [move];
                    updateData.flippedCards = [...currentFlipped, move];
                } else if (currentSelection.length === 1) {
                    const firstCard = currentSelection[0];
                    updateData.currentSelection = [firstCard, move];
                    updateData.flippedCards = [...currentFlipped, move];
                    
                    const card1 = gameData.cards[firstCard];
                    const card2 = gameData.cards[move];
                    
                    if (card1 === card2) {
                        const newMatchedPairs = [...currentMatched, [firstCard, move].sort()];
                        updateData.matchedPairs = newMatchedPairs;
                        updateData[`players.${this.currentUser.uid}.score`] = (gameData.players[this.currentUser.uid]?.score || 0) + 1;
                        
                        if (newMatchedPairs.length >= 8) {
                            const playerScore = (gameData.players[this.currentUser.uid]?.score || 0) + 1;
                            const opponentScore = gameData.players[this.opponent]?.score || 0;
                            
                            if (playerScore > opponentScore) {
                                updateData.winner = this.currentUser.uid;
                                updateData.status = 'completed';
                            } else if (opponentScore > playerScore) {
                                updateData.winner = this.opponent;
                                updateData.status = 'completed';
                            } else {
                                updateData.winner = 'draw';
                                updateData.status = 'completed';
                            }
                            updateData.currentTurn = null;
                        } else {
                            updateData.currentTurn = this.currentUser.uid;
                        }
                    } else {
                        updateData.currentTurn = nextTurn;
                        updateData.waitingForFlipBack = true;
                        
                        setTimeout(async () => {
                            try {
                                await updateDoc(gameRef, {
                                    flippedCards: [],
                                    currentSelection: [],
                                    waitingForFlipBack: false
                                });
                            } catch (error) {
                                console.error('Error flipping cards back:', error);
                            }
                        }, 1500);
                    }
                    
                    if (!updateData.waitingForFlipBack) {
                        updateData.currentSelection = [];
                    }
                }
            }

            await updateDoc(gameRef, updateData);
            
        } catch (error) {
            console.error('Error sending game move:', error);
            this.showNotification('Error making move: ' + error.message, 'error');
        }
    }

    async endGame() {
        console.log('endGame called', {
            currentGame: this.currentGame,
            currentGameSession: this.currentGameSession
        });
        
        // Clear timer if it's running
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        
        // Store the game ID before clearing it
        const gameId = this.currentGame?.id || this.currentGameSession?.id;
        
        if (!gameId) {
            console.log('No game ID found, just closing modal');
            this.showNotification('Game ended', 'info');
            this.closeGame();
            return;
        }
        
        try {
            const gameRef = doc(db, 'gameSessions', gameId);
            
            // Verify the game exists before trying to update it
            const gameSnap = await getDoc(gameRef);
            if (!gameSnap.exists()) {
                console.log('Game session not found in database');
                this.showNotification('Game session not found', 'error');
                this.closeGame();
                return;
            }
            
            await updateDoc(gameRef, {
                status: 'ended',
                winner: 'ended',
                updatedAt: serverTimestamp()
            });
            
            console.log('Game ended successfully in database');
            this.endedGames.add(gameId);
            
            // Remove from active games if we have opponent info
            if (this.opponent) {
                this.activeGames.delete(this.opponent);
            }
            
            this.showNotification('Game ended', 'info');
            this.closeGame();
            
        } catch (error) {
            console.error('Error ending game:', error);
            this.showNotification('Error ending game: ' + error.message, 'error');
            // Still close the modal even if there's an error
            this.closeGame();
        }
    }

    showGameSelectionModal(opponentId, opponentName) {
        if (opponentId === this.currentUser?.uid) {
            this.showNotification('Cannot play game with yourself', 'error');
            return;
        }

        this.opponent = opponentId;
        this.opponentName = opponentName;
        
        if (this.activeGames.has(opponentId) && !this.endedGames.has(this.activeGames.get(opponentId).id)) {
            const existingGame = this.activeGames.get(opponentId);
            this.showNotification(`Continuing existing game with ${opponentName}`, 'info');
            this.setupGameSessionListener(existingGame.id);
        } else {
            const modal = document.getElementById('gameSelectionModal');
            if (modal) {
                modal.style.display = 'flex';
            }
        }
    }

    showGameModal(gameType) {
        this.closeAllGameModals();
        const modal = document.getElementById(`${gameType}Modal`);
        if (modal) {
            modal.style.display = 'flex';
            this.updateGameModalContent();
            this.games[gameType].initialize(this.currentGameSession);
        }
    }

    updateGameModalContent() {
        const opponentName = this.opponentName || 'Opponent';
        
        document.querySelectorAll('.opponent-name-placeholder').forEach(element => {
            element.textContent = opponentName;
        });
        
        document.querySelectorAll('.opponent-score-name').forEach(element => {
            element.textContent = opponentName;
        });
    }

    updateGameUI() {
        if (!this.currentGame) return;
        
        this.updateGameModalContent();
        
        const gameTypeId = this.currentGame.type.replace(/-/g, '');
        const turnIndicator = document.getElementById(`${gameTypeId}TurnIndicator`);
        
        if (this.currentGame.type === 'rock-paper-scissors') {
            // For RPS: Show "Make your move!" instead of turn indicator
            if (turnIndicator) {
                turnIndicator.textContent = 'Make your move!';
                turnIndicator.className = 'turn-indicator your-turn';
            }
        } else {
            if (turnIndicator) {
                turnIndicator.textContent = this.isMyTurn ? 'Your turn!' : `${this.opponentName}'s turn`;
                turnIndicator.className = `turn-indicator ${this.isMyTurn ? 'your-turn' : 'opponent-turn'}`;
            }
        }

        // Enable/disable controls based on game type
        if (this.currentGame.type === 'rock-paper-scissors') {
            // RPS: Always enabled after countdown
            document.querySelectorAll('.rps-choice').forEach(element => {
                element.disabled = false;
            });
        } else {
            // Other games: Only enable on player's turn
            document.querySelectorAll('.rps-choice, .ttt-cell, .coin-choice, .number-input, .memory-card, .scramble-input').forEach(element => {
                element.disabled = !this.isMyTurn;
            });
        }
    }

    closeAllGameModals() {
        document.querySelectorAll('.game-modal').forEach(modal => {
            modal.style.display = 'none';
        });
    }

    closeGame() {
        console.log('closeGame called');
        
        // Clear timer if it's running
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        
        // Remove countdown timer if it exists
        const timerDisplay = document.querySelector('.countdown-timer');
        if (timerDisplay) {
            document.body.removeChild(timerDisplay);
        }
        
        this.closeAllGameModals();
        
        if (this.gameSessionListener) {
            this.gameSessionListener();
            this.gameSessionListener = null;
        }
        
        // Clear game state AFTER we've used the IDs
        this.currentGame = null;
        this.currentGameSession = null;
        this.isMyTurn = false;
        this.opponent = null;
        this.opponentName = null;
    }

    cleanup() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        
        if (this.invitesListener) this.invitesListener();
        if (this.gamesListener) this.gamesListener();
        if (this.gameSessionListener) this.gameSessionListener();
        
        this.closeGame();
        this.activeGames.clear();
        this.endedGames.clear();
        this.gameInvites = [];
        this.userCache.clear();
    }

    renderGameModal() {
        // Check if modals already exist to avoid duplicates
        if (document.getElementById('gameSelectionModal')) {
            return;
        }

        const modalHTML = `
            <!-- Game Selection Modal -->
            <div id="gameSelectionModal" class="modal game-modal">
                <div class="modal-content game-modal-content">
                    <span class="close-button">&times;</span>
                    <h2>🎮 Choose a Game</h2>
                    <div class="games-grid">
                        <div class="game-option" data-game="rock-paper-scissors">
                            <div class="game-icon">✊✋✌️</div>
                            <h3>Rock Paper Scissors</h3>
                            <p>Classic hand game</p>
                        </div>
                        <div class="game-option" data-game="tic-tac-toe">
                            <div class="game-icon">⭕❌</div>
                            <h3>Tic Tac Toe</h3>
                            <p>3 in a row</p>
                        </div>
                        <div class="game-option" data-game="coin-toss">
                            <div class="game-icon">🪙</div>
                            <h3>Coin Toss</h3>
                            <p>Heads or Tails</p>
                        </div>
                        <div class="game-option" data-game="number-guess">
                            <div class="game-icon">🔢</div>
                            <h3>Number Guess</h3>
                            <p>Guess the number</p>
                        </div>
                        <div class="game-option" data-game="memory-match">
                            <div class="game-icon">🧠</div>
                            <h3>Memory Match</h3>
                            <p>Find matching pairs</p>
                        </div>
                        <div class="game-option" data-game="word-scramble">
                            <div class="game-icon">🔤</div>
                            <h3>Word Scramble</h3>
                            <p>Unscramble words</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Rock Paper Scissors Game Modal -->
            <div id="rock-paper-scissorsModal" class="modal game-modal">
                <div class="modal-content game-modal-content">
                    <span class="close-button">&times;</span>
                    <h2>✊✋✌️ Rock Paper Scissors</h2>
                    <div class="game-info">
                        <div class="player-info">
                            <span>You vs <span class="opponent-name-placeholder">Opponent</span></span>
                            <span class="turn-indicator" id="rockpaperscissorsTurnIndicator"></span>
                        </div>
                    </div>
                    <div class="rps-game-area">
                        <div class="rps-choices">
                            <button class="rps-choice" data-choice="rock">✊<br>Rock</button>
                            <button class="rps-choice" data-choice="paper">✋<br>Paper</button>
                            <button class="rps-choice" data-choice="scissors">✌️<br>Scissors</button>
                        </div>
                        <div class="rps-result" id="rpsResult"></div>
                        <div class="game-score" id="rpsScore">You: 0 - <span class="opponent-score-name">Opponent</span>: 0</div>
                        <div class="game-controls">
                            <button class="end-game-btn">End Game</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Tic Tac Toe Game Modal -->
            <div id="tic-tac-toeModal" class="modal game-modal">
                <div class="modal-content game-modal-content">
                    <span class="close-button">&times;</span>
                    <h2>⭕❌ Tic Tac Toe</h2>
                    <div class="game-info">
                        <div class="player-info">
                            <span>You (X) vs <span class="opponent-name-placeholder">Opponent</span> (O)</span>
                            <span class="turn-indicator" id="tictactoeTurnIndicator"></span>
                        </div>
                    </div>
                    <div class="ttt-game-area">
                        <div class="ttt-board" id="tttBoard">
                            <div class="ttt-cell" data-index="0"></div>
                            <div class="ttt-cell" data-index="1"></div>
                            <div class="ttt-cell" data-index="2"></div>
                            <div class="ttt-cell" data-index="3"></div>
                            <div class="ttt-cell" data-index="4"></div>
                            <div class="ttt-cell" data-index="5"></div>
                            <div class="ttt-cell" data-index="6"></div>
                            <div class="ttt-cell" data-index="7"></div>
                            <div class="ttt-cell" data-index="8"></div>
                        </div>
                        <div class="game-score" id="tttScore">You: 0 - <span class="opponent-score-name">Opponent</span>: 0</div>
                        <div class="game-controls">
                            <button class="end-game-btn">End Game</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Coin Toss Game Modal -->
            <div id="coin-tossModal" class="modal game-modal">
                <div class="modal-content game-modal-content">
                    <span class="close-button">&times;</span>
                    <h2>🪙 Coin Toss</h2>
                    <div class="game-info">
                        <div class="player-info">
                            <span>You vs <span class="opponent-name-placeholder">Opponent</span></span>
                            <span class="turn-indicator" id="cointossTurnIndicator"></span>
                        </div>
                    </div>
                    <div class="coin-game-area">
                        <div class="coin-choices">
                            <button class="coin-choice" data-choice="heads">🪙 Heads</button>
                            <button class="coin-choice" data-choice="tails">🪙 Tails</button>
                        </div>
                        <div class="coin-display" id="coinDisplay">
                            <div class="coin" id="coin">🪙</div>
                        </div>
                        <div class="coin-result" id="coinResult"></div>
                        <div class="game-score" id="coinScore">You: 0 - <span class="opponent-score-name">Opponent</span>: 0</div>
                        <div class="game-controls">
                            <button class="end-game-btn">End Game</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Number Guess Game Modal -->
            <div id="number-guessModal" class="modal game-modal">
                <div class="modal-content game-modal-content">
                    <span class="close-button">&times;</span>
                    <h2>🔢 Number Guess</h2>
                    <div class="game-info">
                        <div class="player-info">
                            <span>You vs <span class="opponent-name-placeholder">Opponent</span></span>
                            <span class="turn-indicator" id="numberguessTurnIndicator"></span>
                        </div>
                    </div>
                    <div class="number-game-area">
                        <div class="number-instructions">
                            <p>Guess a number between 1-100. Closest guess wins!</p>
                        </div>
                        <div class="number-input-section">
                            <input type="number" class="number-input" min="1" max="100" placeholder="Enter your guess">
                            <button class="number-submit">Submit Guess</button>
                        </div>
                        <div class="number-result" id="numberResult"></div>
                        <div class="game-score" id="numberScore">You: 0 - <span class="opponent-score-name">Opponent</span>: 0</div>
                        <div class="game-controls">
                            <button class="end-game-btn">End Game</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Memory Match Game Modal -->
            <div id="memory-matchModal" class="modal game-modal">
                <div class="modal-content game-modal-content">
                    <span class="close-button">&times;</span>
                    <h2>🧠 Memory Match</h2>
                    <div class="game-info">
                        <div class="player-info">
                            <span>You vs <span class="opponent-name-placeholder">Opponent</span></span>
                            <span class="turn-indicator" id="memorymatchTurnIndicator"></span>
                        </div>
                    </div>
                    <div class="memory-game-area">
                        <div class="memory-instructions">
                            <p>Flip two cards to find matching pairs. Take turns with your opponent!</p>
                        </div>
                        <div class="memory-board" id="memoryBoard"></div>
                        <div class="memory-status" id="memoryStatus"></div>
                        <div class="game-score" id="memoryScore">You: 0 - <span class="opponent-score-name">Opponent</span>: 0</div>
                        <div class="game-controls">
                            <button class="end-game-btn">End Game</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Word Scramble Game Modal -->
            <div id="word-scrambleModal" class="modal game-modal">
                <div class="modal-content game-modal-content">
                    <span class="close-button">&times;</span>
                    <h2>🔤 Word Scramble</h2>
                    <div class="game-info">
                        <div class="player-info">
                            <span>You vs <span class="opponent-name-placeholder">Opponent</span></span>
                            <span class="turn-indicator" id="wordscrambleTurnIndicator"></span>
                        </div>
                    </div>
                    <div class="scramble-game-area">
                        <div class="scramble-word" id="scrambleWord"></div>
                        <div class="scramble-hint">Unscramble this word!</div>
                        <div class="scramble-input-section">
                            <input type="text" class="scramble-input" placeholder="Enter the unscrambled word">
                            <button class="scramble-submit">Submit</button>
                        </div>
                        <div class="scramble-result" id="scrambleResult"></div>
                        <div class="game-score" id="scrambleScore">You: 0 - <span class="opponent-score-name">Opponent</span>: 0</div>
                        <div class="game-controls">
                            <button class="end-game-btn">End Game</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.setupEventListeners();
    }

    setupEventListeners() {
        document.querySelectorAll('.game-option').forEach(option => {
            option.addEventListener('click', () => {
                const gameType = option.getAttribute('data-game');
                this.sendGameInvite(gameType, this.opponent, this.opponentName);
                this.closeAllGameModals();
            });
        });

        document.querySelectorAll('.close-button').forEach(button => {
            button.addEventListener('click', () => this.closeGame());
        });

        document.querySelectorAll('.end-game-btn').forEach(button => {
            button.addEventListener('click', () => this.endGame());
        });

        // Game-specific event listeners
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('rps-choice') && this.isMyTurn) {
                const choice = e.target.getAttribute('data-choice');
                this.sendGameMove(choice);
            }
        });

        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('ttt-cell') && this.isMyTurn) {
                const index = parseInt(e.target.getAttribute('data-index'));
                this.sendGameMove(index);
            }
        });

        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('coin-choice') && this.isMyTurn) {
                const choice = e.target.getAttribute('data-choice');
                this.sendGameMove(choice);
            }
        });

        // Number Guess
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('number-submit') && this.isMyTurn) {
                const input = document.querySelector('.number-input');
                const guess = parseInt(input.value);
                if (guess >= 1 && guess <= 100) {
                    this.sendGameMove(guess);
                    input.value = '';
                } else {
                    this.showNotification('Please enter a number between 1-100', 'error');
                }
            }
        });

        // Word Scramble
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('scramble-submit') && this.isMyTurn) {
                const input = document.querySelector('.scramble-input');
                const guess = input.value.trim().toLowerCase();
                if (guess) {
                    this.sendGameMove(guess);
                    input.value = '';
                } else {
                    this.showNotification('Please enter a word', 'error');
                }
            }
        });

        // Memory Match
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('memory-card') && this.isMyTurn) {
                const index = parseInt(e.target.getAttribute('data-index'));
                console.log('Memory card clicked:', index, 'My turn:', this.isMyTurn);
                this.sendGameMove(index);
            }
        });

        // Close modal when clicking outside
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('game-modal')) {
                this.closeGame();
            }
        });
    }

    addGameStyles() {
        // Check if styles already exist to avoid duplicates
        if (document.querySelector('#game-styles')) {
            return;
        }

        const styles = `
            <style id="game-styles">
            .game-modal {
                display: none;
                position: fixed;
                z-index: 10000;
                left: 0;
                top: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0,0,0,0.7);
                align-items: center;
                justify-content: center;
            }

            .game-modal-content {
                background: white;
                padding: 30px;
                border-radius: 15px;
                max-width: 500px;
                width: 90%;
                max-height: 80vh;
                overflow-y: auto;
                text-align: center;
                position: relative;
            }

            .games-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 20px;
                margin: 20px 0;
            }

            .game-option {
                border: 2px solid #e0e0e0;
                border-radius: 10px;
                padding: 20px;
                cursor: pointer;
                transition: all 0.3s ease;
                background: white;
            }

            .game-option:hover {
                border-color: #007bff;
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            }

            .game-icon {
                font-size: 2.5em;
                margin-bottom: 10px;
            }

            .close-button {
                position: absolute;
                top: 15px;
                right: 15px;
                font-size: 28px;
                font-weight: bold;
                cursor: pointer;
                color: #999;
                background: none;
                border: none;
            }

            .close-button:hover {
                color: #333;
            }

            .game-info {
                margin: 20px 0;
                padding: 15px;
                background: #f8f9fa;
                border-radius: 8px;
            }

            .player-info {
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
                gap: 10px;
            }

            .turn-indicator {
                padding: 5px 10px;
                border-radius: 15px;
                font-size: 0.9em;
                font-weight: bold;
            }

            .your-turn {
                background: #d4edda;
                color: #155724;
            }

            .opponent-turn {
                background: #f8d7da;
                color: #721c24;
            }

            /* Rock Paper Scissors Styles */
            .rps-choices {
                display: flex;
                gap: 15px;
                justify-content: center;
                margin: 20px 0;
                flex-wrap: wrap;
            }

            .rps-choice {
                padding: 20px;
                border: 2px solid #007bff;
                border-radius: 10px;
                background: white;
                cursor: pointer;
                font-size: 1.5em;
                transition: all 0.3s ease;
                min-width: 100px;
            }

            .rps-choice:hover:not(:disabled) {
                background: #007bff;
                color: white;
                transform: scale(1.05);
            }

            .rps-choice:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }

            .rps-result {
                margin: 20px 0;
                padding: 15px;
                border-radius: 8px;
                font-size: 1.2em;
                font-weight: bold;
                background: #f8f9fa;
            }

            /* Tic Tac Toe Styles */
            .ttt-board {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 5px;
                margin: 20px auto;
                max-width: 300px;
                background: #333;
                padding: 5px;
                border-radius: 5px;
            }

            .ttt-cell {
                aspect-ratio: 1;
                border: 2px solid #333;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 2em;
                font-weight: bold;
                cursor: pointer;
                background: white;
            }

            .ttt-cell:hover:not(:disabled) {
                background: #f0f0f0;
            }

            .ttt-cell:disabled {
                cursor: not-allowed;
            }

            .ttt-cell.x { color: #007bff; }
            .ttt-cell.o { color: #dc3545; }

            /* Coin Toss Styles */
            .coin-choices {
                display: flex;
                gap: 20px;
                justify-content: center;
                margin: 20px 0;
                flex-wrap: wrap;
            }

            .coin-choice {
                padding: 15px 30px;
                border: 2px solid #ffc107;
                border-radius: 25px;
                background: white;
                cursor: pointer;
                font-size: 1.2em;
                transition: all 0.3s ease;
            }

            .coin-choice:hover:not(:disabled) {
                background: #ffc107;
                color: white;
            }

            .coin-display {
                margin: 30px 0;
                perspective: 1000px;
            }

            .coin {
                font-size: 4em;
                margin: 0 auto;
                transition: transform 1s ease-in-out;
            }

            .coin.flipping {
                animation: coinFlip 1s ease-in-out;
            }

            @keyframes coinFlip {
                0% { transform: rotateY(0deg); }
                50% { transform: rotateY(180deg); }
                100% { transform: rotateY(360deg); }
            }

            .coin-result {
                margin: 20px 0;
                padding: 15px;
                border-radius: 8px;
                font-size: 1.2em;
                font-weight: bold;
                background: #f8f9fa;
            }

            /* Number Guess Styles */
            .number-input-section {
                display: flex;
                gap: 10px;
                justify-content: center;
                margin: 20px 0;
                flex-wrap: wrap;
            }

            .number-input {
                padding: 10px;
                border: 2px solid #28a745;
                border-radius: 5px;
                font-size: 1.1em;
                width: 120px;
            }

            .number-submit {
                padding: 10px 20px;
                background: #28a745;
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                font-size: 1.1em;
            }

            .number-submit:hover:not(:disabled) {
                background: #218838;
            }

            .number-result {
                margin: 20px 0;
                padding: 15px;
                border-radius: 8px;
                font-size: 1.2em;
                font-weight: bold;
                background: #f8f9fa;
            }

            /* Memory Match Styles */
            .memory-instructions {
                margin: 10px 0;
                color: #666;
                font-style: italic;
            }

            .memory-board {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 10px;
                margin: 20px auto;
                max-width: 400px;
            }

            .memory-card {
                aspect-ratio: 1;
                background: #007bff;
                color: white;
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.5em;
                cursor: pointer;
                transition: all 0.3s ease;
                user-select: none;
            }

            .memory-card:hover:not(:disabled) {
                background: #0056b3;
            }

            .memory-card.flipped {
                background: white;
                color: #333;
                border: 2px solid #007bff;
            }

            .memory-card.matched {
                background: #28a745;
                color: white;
                cursor: default;
                border: 2px solid #1e7e34;
            }

            .memory-status {
                margin: 10px 0;
                font-weight: bold;
                color: #666;
                font-size: 1.1em;
            }

            /* Word Scramble Styles */
            .scramble-word {
                font-size: 2em;
                font-weight: bold;
                letter-spacing: 0.2em;
                margin: 20px 0;
                padding: 20px;
                background: #f8f9fa;
                border-radius: 8px;
                font-family: monospace;
                border: 2px dashed #dee2e6;
            }

            .scramble-hint {
                margin: 10px 0;
                color: #666;
                font-style: italic;
            }

            .scramble-input-section {
                display: flex;
                gap: 10px;
                justify-content: center;
                margin: 20px 0;
                flex-wrap: wrap;
            }

            .scramble-input {
                padding: 10px;
                border: 2px solid #6f42c1;
                border-radius: 5px;
                font-size: 1.1em;
                width: 200px;
            }

            .scramble-submit {
                padding: 10px 20px;
                background: #6f42c1;
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                font-size: 1.1em;
            }

            .scramble-submit:hover:not(:disabled) {
                background: #5a32a3;
            }

            .scramble-result {
                margin: 20px 0;
                padding: 15px;
                border-radius: 8px;
                font-size: 1.2em;
                font-weight: bold;
                background: #f8f9fa;
            }

            /* Common Styles */
            .game-score {
                margin-top: 20px;
                padding: 10px;
                background: #f8f9fa;
                border-radius: 8px;
                font-weight: bold;
                font-size: 1.1em;
            }

            .game-controls {
                margin-top: 20px;
                display: flex;
                justify-content: center;
            }

            .end-game-btn {
                padding: 10px 20px;
                background: #dc3545;
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                font-weight: bold;
                font-size: 1em;
            }

            .end-game-btn:hover {
                background: #c82333;
            }

            .game-invite-notification {
                position: fixed;
                top: 20px;
                right: 20px;
                background: white;
                border: 2px solid #007bff;
                border-radius: 10px;
                padding: 20px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 10001;
                max-width: 300px;
            }

            .invite-content h3 {
                margin: 0 0 10px 0;
                color: #333;
            }

            .invite-content p {
                margin: 0 0 15px 0;
                color: #666;
            }

            .invite-buttons {
                display: flex;
                gap: 10px;
            }

            .accept-btn, .reject-btn {
                padding: 8px 16px;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                font-weight: bold;
                flex: 1;
            }

            .accept-btn {
                background-color: #28a745;
                color: white;
            }

            .accept-btn:hover {
                background-color: #218838;
            }

            .reject-btn {
                background-color: #dc3545;
                color: white;
            }

            .reject-btn:hover {
                background-color: #c82333;
            }

            .game-icon-btn {
                background: none;
                border: none;
                font-size: 1.5em;
                cursor: pointer;
                padding: 10px;
                border-radius: 50%;
                transition: background 0.3s ease;
                position: relative;
            }

            .game-icon-btn:hover {
                background: #f0f0f0;
            }

            .game-badge {
                position: absolute;
                top: -5px;
                right: -5px;
                background: #ff4444;
                color: white;
                border-radius: 50%;
                width: 20px;
                height: 20px;
                font-size: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
            }

            .game-notification {
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                padding: 12px 20px;
                border-radius: 5px;
                z-index: 10002;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                font-weight: bold;
            }

            /* Countdown Timer Styles */
            .countdown-timer {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0,0,0,0.8);
                color: white;
                padding: 30px;
                border-radius: 15px;
                font-size: 3em;
                font-weight: bold;
                z-index: 10003;
                text-align: center;
            }

            /* Celebration Popup Styles */
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }

            @keyframes popIn {
                0% { transform: scale(0.5); opacity: 0; }
                70% { transform: scale(1.1); }
                100% { transform: scale(1); opacity: 1; }
            }

            @keyframes bounce {
                0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
                40% { transform: translateY(-10px); }
                60% { transform: translateY(-5px); }
            }

            .celebration-popup {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10004;
                animation: fadeIn 0.3s ease-in;
            }

            .celebration-content {
                background: linear-gradient(135deg, #4CAF50, #45a049);
                color: white;
                padding: 40px;
                border-radius: 20px;
                text-align: center;
                max-width: 300px;
                animation: popIn 0.5s ease-out;
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            }

            .celebration-popup.victory .celebration-content {
                background: linear-gradient(135deg, #4CAF50, #45a049);
            }

            .celebration-popup.defeat .celebration-content {
                background: linear-gradient(135deg, #f44336, #d32f2f);
            }

            .celebration-popup.draw .celebration-content {
                background: linear-gradient(135deg, #FF9800, #F57C00);
            }

            .celebration-emoji {
                font-size: 4em;
                margin-bottom: 20px;
                animation: bounce 1s infinite;
            }

            .celebration-message {
                font-size: 1.5em;
                font-weight: bold;
                margin-bottom: 25px;
                line-height: 1.4;
            }

            .celebration-close {
                background: rgba(255,255,255,0.2);
                color: white;
                border: 2px solid white;
                padding: 12px 30px;
                border-radius: 25px;
                font-size: 1.1em;
                font-weight: bold;
                cursor: pointer;
                transition: all 0.3s ease;
            }

            .celebration-close:hover {
                background: rgba(255,255,255,0.3);
            }

            /* Responsive Design */
            @media (max-width: 768px) {
                .games-grid {
                    grid-template-columns: 1fr;
                }
                
                .game-modal-content {
                    padding: 20px;
                    margin: 20px;
                }
                
                .rps-choices {
                    flex-direction: column;
                    align-items: center;
                }
                
                .coin-choices {
                    flex-direction: column;
                    align-items: center;
                }
                
                .player-info {
                    flex-direction: column;
                    text-align: center;
                }
                
                .memory-board {
                    grid-template-columns: repeat(3, 1fr);
                }
                
                .celebration-content {
                    margin: 20px;
                    padding: 30px 20px;
                }
                
                .celebration-emoji {
                    font-size: 3em;
                }
                
                .celebration-message {
                    font-size: 1.3em;
                }
            }
            </style>
        `;

        document.head.insertAdjacentHTML('beforeend', styles);
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `game-notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: ${type === 'success' ? '#d4edda' : type === 'error' ? '#f8d7da' : '#d1ecf1'};
            color: ${type === 'success' ? '#155724' : type === 'error' ? '#721c24' : '#0c5460'};
            padding: 12px 20px;
            border-radius: 5px;
            z-index: 10002;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            font-weight: bold;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 3000);
    }
}

// Base Game Class
class BaseGame {
    constructor(gameManager) {
        this.gameManager = gameManager;
    }

    initialize(gameSession) {}
    updateState(gameData) {}
    isValidMove(move, moves, gameData) { return true; }
    checkWinner(moves, gameData) { return null; }
    isDraw(moves) { return false; }

    updateScore(players, scoreElementId) {
        const scoreDiv = document.getElementById(scoreElementId);
        if (scoreDiv && this.gameManager.currentUser) {
            const myScore = players[this.gameManager.currentUser.uid]?.score || 0;
            const opponentScore = players[this.gameManager.opponent]?.score || 0;
            scoreDiv.textContent = `You: ${myScore} - ${this.gameManager.opponentName}: ${opponentScore}`;
        }
    }
}

// Rock Paper Scissors
class RockPaperScissors extends BaseGame {
    constructor(gameManager) {
        super(gameManager);
        this.validMoves = ['rock', 'paper', 'scissors'];
    }

    updateState(gameData) {
        const moves = gameData.moves || [];
        
        // Show the most recent moves
        const unprocessedMoves = moves.filter(m => !m.processed);
        const processedMoves = moves.filter(m => m.processed);
        
        if (unprocessedMoves.length > 0) {
            this.showResult(unprocessedMoves);
        } else if (processedMoves.length >= 2) {
            const lastTwoMoves = processedMoves.slice(-2);
            this.showResult(lastTwoMoves, true);
        }
        
        this.updateScore(gameData.players, 'rpsScore');
    }

    showResult(moves, showWinner = false) {
        const resultDiv = document.getElementById('rpsResult');
        if (resultDiv && moves.length > 0) {
            let resultHTML = '';
            moves.forEach(move => {
                const playerName = this.gameManager.currentUser.uid === move.playerId ? 'You' : this.gameManager.opponentName;
                const emoji = { rock: '✊', paper: '✋', scissors: '✌️' }[move.move];
                resultHTML += `${playerName} chose ${emoji} ${move.move}<br>`;
            });
            
            if (showWinner && moves.length === 2) {
                const winner = this.checkWinner(moves);
                if (winner === this.gameManager.currentUser.uid) {
                    resultHTML += '<br>🎉 You win this round!';
                } else if (winner === this.gameManager.opponent) {
                    resultHTML += `<br>😔 ${this.gameManager.opponentName} wins this round!`;
                } else {
                    resultHTML += '<br>🤝 It\'s a draw!';
                }
            }
            
            resultDiv.innerHTML = resultHTML;
        }
    }

    isValidMove(move, moves, gameData) {
        // Check if player has already made an unprocessed move
        const userMove = moves.find(m => m.playerId === this.gameManager.currentUser.uid && !m.processed);
        if (userMove) {
            return false;
        }
        return this.validMoves.includes(move);
    }

    checkWinner(moves) {
        if (moves.length < 2) return null;
        
        const [move1, move2] = moves;
        
        if (move1.playerId === move2.playerId) return null;
        
        const wins = {
            'rock': 'scissors',
            'scissors': 'paper',
            'paper': 'rock'
        };
        
        if (wins[move1.move] === move2.move) {
            return move1.playerId;
        } else if (wins[move2.move] === move1.move) {
            return move2.playerId;
        } else {
            return 'draw';
        }
    }

    isDraw(moves) {
        return this.checkWinner(moves) === 'draw';
    }
}

// Tic Tac Toe
class TicTacToe extends BaseGame {
    constructor(gameManager) {
        super(gameManager);
    }

    initialize() {
        this.clearBoard();
    }

    clearBoard() {
        document.querySelectorAll('.ttt-cell').forEach(cell => {
            cell.textContent = '';
            cell.className = 'ttt-cell';
        });
    }

    updateState(gameData) {
        const moves = gameData.moves || [];
        this.updateBoard(moves);
        this.updateScore(gameData.players, 'tttScore');
    }

    updateBoard(moves) {
        this.clearBoard();
        
        moves.forEach(move => {
            const cell = document.querySelector(`.ttt-cell[data-index="${move.move}"]`);
            if (cell) {
                const symbol = move.playerId === this.gameManager.currentUser.uid ? 'X' : 'O';
                cell.textContent = symbol;
                cell.className = `ttt-cell ${symbol.toLowerCase()}`;
            }
        });
    }

    isValidMove(move, moves) {
        return !moves.some(existingMove => existingMove.move === move);
    }

    checkWinner(moves) {
        const board = Array(9).fill(null);
        
        moves.forEach(move => {
            const symbol = move.playerId === this.gameManager.currentUser.uid ? 'X' : 'O';
            board[move.move] = symbol;
        });

        const winPatterns = [
            [0,1,2], [3,4,5], [6,7,8],
            [0,3,6], [1,4,7], [2,5,8],
            [0,4,8], [2,4,6]
        ];

        for (let pattern of winPatterns) {
            const [a,b,c] = pattern;
            if (board[a] && board[a] === board[b] && board[a] === board[c]) {
                const winningSymbol = board[a];
                const winningMove = moves.find(move => 
                    move.move === a && 
                    (move.playerId === this.gameManager.currentUser.uid ? 'X' : 'O') === winningSymbol
                );
                return winningMove ? winningMove.playerId : null;
            }
        }

        if (moves.length >= 9) {
            return 'draw';
        }

        return null;
    }

    isDraw(moves) {
        return this.checkWinner(moves) === 'draw';
    }
}

// Coin Toss
class CoinToss extends BaseGame {
    constructor(gameManager) {
        super(gameManager);
        this.validMoves = ['heads', 'tails'];
        this.lastResult = null;
    }

    initialize() {
        this.lastResult = null;
    }

    updateState(gameData) {
        const moves = gameData.moves || [];
        const lastMove = moves[moves.length - 1];
        
        if (lastMove && !this.lastResult) {
            this.showResult(lastMove);
        }
        
        this.updateScore(gameData.players, 'coinScore');
    }

    showResult(move) {
        const resultDiv = document.getElementById('coinResult');
        const coin = document.getElementById('coin');
        
        if (resultDiv && coin) {
            coin.classList.add('flipping');
            setTimeout(() => {
                coin.classList.remove('flipping');
                const result = new Date(move.timestamp).getTime() % 2 === 0 ? 'heads' : 'tails';
                this.lastResult = result;
                
                const playerName = this.gameManager.currentUser.uid === move.playerId ? 'You' : this.gameManager.opponentName;
                const won = move.move === result;
                
                resultDiv.innerHTML = `${playerName} chose ${move.move}<br>Result: ${result}<br>${won ? '🎉 You won!' : '😔 You lost!'}`;
                resultDiv.style.color = won ? '#28a745' : '#dc3545';
            }, 1000);
        }
    }

    isValidMove(move, moves) {
        return this.validMoves.includes(move) && moves.length === 0;
    }

    checkWinner(moves) {
        if (moves.length === 0) return null;
        
        const move = moves[0];
        const result = new Date(move.timestamp).getTime() % 2 === 0 ? 'heads' : 'tails';
        
        if (move.move === result) {
            return move.playerId;
        } else {
            const otherPlayer = this.gameManager.currentGameSession.participants.find(id => id !== move.playerId);
            return otherPlayer;
        }
    }

    isDraw(moves) {
        return false;
    }
}

// Number Guess Game
class NumberGuess extends BaseGame {
    constructor(gameManager) {
        super(gameManager);
    }

    initialize(gameSession) {
        const resultDiv = document.getElementById('numberResult');
        if (resultDiv) resultDiv.innerHTML = '';
    }

    updateState(gameData) {
        const moves = gameData.moves || [];
        const playerMoves = moves.filter(m => m.playerId === this.gameManager.currentUser.uid);
        const opponentMoves = moves.filter(m => m.playerId === this.gameManager.opponent);
        
        if (playerMoves.length > 0 || opponentMoves.length > 0) {
            this.showResults(moves, gameData.targetNumber);
        }
        
        this.updateScore(gameData.players, 'numberScore');
    }

    showResults(moves, targetNumber) {
        const resultDiv = document.getElementById('numberResult');
        if (!resultDiv) return;

        let resultHTML = '';
        
        moves.forEach(move => {
            const playerName = this.gameManager.currentUser.uid === move.playerId ? 'You' : this.gameManager.opponentName;
            const difference = Math.abs(move.move - targetNumber);
            resultHTML += `${playerName} guessed: ${move.move} (${difference} away)<br>`;
        });

        resultDiv.innerHTML = resultHTML;
    }

    isValidMove(move, moves, gameData) {
        const hasGuessed = moves.some(m => m.playerId === this.gameManager.currentUser.uid);
        return move >= 1 && move <= 100 && !hasGuessed;
    }

    checkWinner(moves, gameData) {
        if (!gameData.targetNumber || moves.length < 2) return null;
        
        const playerMoves = moves.filter(m => m.playerId === this.gameManager.currentUser.uid);
        const opponentMoves = moves.filter(m => m.playerId === this.gameManager.opponent);
        
        if (playerMoves.length === 0 || opponentMoves.length === 0) return null;
        
        const playerGuess = playerMoves[playerMoves.length - 1].move;
        const opponentGuess = opponentMoves[opponentMoves.length - 1].move;
        
        const playerDiff = Math.abs(playerGuess - gameData.targetNumber);
        const opponentDiff = Math.abs(opponentGuess - gameData.targetNumber);
        
        if (playerDiff < opponentDiff) {
            return this.gameManager.currentUser.uid;
        } else if (opponentDiff < playerDiff) {
            return this.gameManager.opponent;
        } else {
            return 'draw';
        }
    }
}

// Memory Match Game - FIXED
class MemoryMatch extends BaseGame {
    constructor(gameManager) {
        super(gameManager);
    }

    initialize(gameSession) {
        this.renderBoard(gameSession);
    }

    renderBoard(gameSession) {
        const board = document.getElementById('memoryBoard');
        if (!board || !gameSession.cards) return;
        
        board.innerHTML = '';
        gameSession.cards.forEach((symbol, index) => {
            const card = document.createElement('div');
            card.className = 'memory-card';
            card.setAttribute('data-index', index);
            
            const isFlipped = gameSession.flippedCards?.includes(index);
            const isMatched = gameSession.matchedPairs?.some(pair => pair.includes(index));
            const isInSelection = gameSession.currentSelection?.includes(index);
            
            if (isMatched) {
                card.textContent = symbol;
                card.className = 'memory-card matched';
                card.style.pointerEvents = 'none';
            } else if (isFlipped || isInSelection) {
                card.textContent = symbol;
                card.className = 'memory-card flipped';
            } else {
                card.textContent = '?';
                card.className = 'memory-card';
            }
            
            board.appendChild(card);
        });
    }

    updateState(gameData) {
        this.renderBoard(gameData);
        this.updateStatus(gameData);
        this.updateScore(gameData.players, 'memoryScore');
    }

    updateStatus(gameData) {
        const statusDiv = document.getElementById('memoryStatus');
        if (!statusDiv) return;
        
        const playerPairs = gameData.matchedPairs?.filter(pair => 
            gameData.moves?.some(m => m.playerId === this.gameManager.currentUser.uid && pair.includes(m.move))
        )?.length || 0;
        
        const opponentPairs = gameData.matchedPairs?.filter(pair => 
            gameData.moves?.some(m => m.playerId === this.gameManager.opponent && pair.includes(m.move))
        )?.length || 0;
        
        statusDiv.textContent = `Pairs found - You: ${playerPairs}, ${this.gameManager.opponentName}: ${opponentPairs}`;
        
        // Check for winner
        if (gameData.matchedPairs?.length >= 8) {
            if (playerPairs > opponentPairs) {
                statusDiv.innerHTML += '<br>🎉 You won!';
            } else if (opponentPairs > playerPairs) {
                statusDiv.innerHTML += `<br>😔 ${this.gameManager.opponentName} won!`;
            } else {
                statusDiv.innerHTML += '<br>🤝 It\'s a tie!';
            }
        }
    }

    isValidMove(move, moves, gameData) {
        // Check if card is already matched
        const isMatched = gameData.matchedPairs?.some(pair => pair.includes(move));
        if (isMatched) {
            return false;
        }

        // Check if card is already in current selection
        const isInSelection = gameData.currentSelection?.includes(move);
        if (isInSelection) {
            return false;
        }

        // Check if card is already flipped
        const isFlipped = gameData.flippedCards?.includes(move);
        if (isFlipped) {
            return false;
        }

        // Check if we're already selecting two cards
        const currentSelection = gameData.currentSelection || [];
        if (currentSelection.length >= 2) {
            return false;
        }

        // Check if we're waiting for cards to flip back
        if (gameData.waitingForFlipBack) {
            return false;
        }

        return true;
    }

    checkWinner(moves, gameData) {
        if (!gameData.matchedPairs || gameData.matchedPairs.length < 8) return null;
        
        const playerPairs = gameData.matchedPairs.filter(pair => 
            moves.some(m => m.playerId === this.gameManager.currentUser.uid && pair.includes(m.move))
        ).length;
        
        const opponentPairs = gameData.matchedPairs.filter(pair => 
            moves.some(m => m.playerId === this.gameManager.opponent && pair.includes(m.move))
        ).length;
        
        if (playerPairs > opponentPairs) {
            return this.gameManager.currentUser.uid;
        } else if (opponentPairs > playerPairs) {
            return this.gameManager.opponent;
        } else {
            return 'draw';
        }
    }
}

// Word Scramble Game
class WordScramble extends BaseGame {
    constructor(gameManager) {
        super(gameManager);
    }

    initialize(gameSession) {
        this.updateDisplay(gameSession);
    }

    updateDisplay(gameSession) {
        const wordDisplay = document.getElementById('scrambleWord');
        if (wordDisplay && gameSession.scrambledWord) {
            wordDisplay.textContent = gameSession.scrambledWord;
        }
        
        const resultDiv = document.getElementById('scrambleResult');
        if (resultDiv) resultDiv.innerHTML = '';
    }

    updateState(gameData) {
        this.updateDisplay(gameData);
        
        const moves = gameData.moves || [];
        const lastMove = moves[moves.length - 1];
        
        if (lastMove) {
            this.showResult(lastMove, gameData.currentWord);
        }
        
        this.updateScore(gameData.players, 'scrambleScore');
    }

    showResult(move, currentWord) {
        const resultDiv = document.getElementById('scrambleResult');
        if (!resultDiv) return;

        const playerName = this.gameManager.currentUser.uid === move.playerId ? 'You' : this.gameManager.opponentName;
        const correct = move.move === currentWord;
        
        resultDiv.innerHTML = `${playerName} guessed: "${move.move}"<br>`;
        resultDiv.innerHTML += correct ? '🎉 Correct! +1 point' : '❌ Incorrect, try again!';
        resultDiv.style.color = correct ? '#28a745' : '#dc3545';
    }

    isValidMove(move, moves, gameData) {
        const hasGuessed = moves.some(m => m.playerId === this.gameManager.currentUser.uid && m.move === gameData.currentWord);
        return typeof move === 'string' && move.length > 0 && !hasGuessed;
    }

    checkWinner(moves, gameData) {
        const lastMove = moves[moves.length - 1];
        if (lastMove && lastMove.move === gameData.currentWord) {
            return lastMove.playerId;
        }
        return null;
    }
}

// Initialize the game manager
window.gameManager = new GameManager();