// notification.js - Complete file with nice notification sounds and comment reply functionality
// Updated with Stream Video Notifications (Likes, Comments, Comment Replies) - No modifications needed to other files

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
    serverTimestamp,
    writeBatch,
    increment,
    arrayUnion,
    arrayRemove,
    orderBy,
    limit
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
let currentCommentPostId = null;
let currentCommentId = null;
let currentReplyToUserId = null;
let processedLikes = new Set();
let processedComments = new Set();

// Stream tracking variables
let processedStreamLikes = new Set();
let processedStreamComments = new Set();
let streamLikeCounts = new Map();
let streamCommentCounts = new Map();

// ==================== NOTIFICATION SOUNDS SYSTEM ====================

class NotificationSoundManager {
    constructor() {
        this.audioContext = null;
        this.soundsEnabled = true;