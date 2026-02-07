// gists.js - UPGRADED VERSION WITH HASHTAGS & MULTIPLE PHOTOS FUNCTIONALITY

// Firebase imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    query, 
    orderBy, 
    limit, 
    startAfter,
    where,
    serverTimestamp,
    doc,
    getDoc,
    updateDoc,
    getDocs,
    runTransaction,
    arrayUnion,
    arrayRemove,
    setDoc,
    increment,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { 
    getAuth, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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
const db = getFirestore(app);
const auth = getAuth(app);

// Cloudinary configuration
const cloudinaryConfig = {
    cloudName: "ddtdqrh1b",
    uploadPreset: "profile-pictures"
};

// Dicebear avatar types
const DICEBEAR_AVATARS = [
    'adventurer', 'adventurer-neutral', 'avataaars', 'big-ears', 
    'big-smile', 'bottts', 'croodles', 'fun-emoji', 'icons',
    'identicon', 'initials', 'micah', 'miniavs', 'open-peeps',
    'personas', 'pixel-art', 'pixel-art-neutral'
];

// Gist state
let currentUser = null;
let mediaRecorder = null;
let audioChunks = [];
let recordingStartTime = null;
let recordingTimer = null;
let pendingAudioBlob = null;
let pendingImageFiles = [];
let pendingMediaType = null;
let lastVisibleGist = null;
let isLoading = false;
let currentlyPlayingAudio = null;
let currentlyPlayingButton = null;
let availableHashtags = [];
let currentHashtagId = null;
let maxPhotos = 4;

// Generate user ID and avatar
function generateUserId() {
    // Generate a unique 8-character ID
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    return `user_${timestamp}${random}`.toUpperCase();
}

// Generate Dicebear avatar for user ID
function generateUserAvatar(userId) {
    // Use userId as seed for consistent avatar
    const style = DICEBEAR_AVATARS[Math.floor(Math.random() * DICEBEAR_AVATARS.length)];
    return `https://api.dicebear.com/7.x/${style}/svg?seed=${userId}&backgroundColor=b6e3f4,c0aede,d1d4f9&radius=50`;
}

// Get or create user identity
async function getUserIdentity() {
    try {
        // Check if user already has an ID in localStorage
        let userId = localStorage.getItem('anonymousUserId');
        let userAvatar = localStorage.getItem('anonymousUserAvatar');
        
        // If not, generate new ones
        if (!userId) {
            userId = generateUserId();
            localStorage.setItem('anonymousUserId', userId);
        }
        
        if (!userAvatar) {
            userAvatar = generateUserAvatar(userId);
            localStorage.setItem('anonymousUserAvatar', userAvatar);
        }
        
        return {
            id: userId,
            avatar: userAvatar,
            displayName: `Anonymous ${userId.substring(userId.length - 4)}` // Last 4 chars for display
        };
    } catch (error) {
        console.error('Error getting user identity:', error);
        // Fallback to random generation
        const fallbackId = generateUserId();
        return {
            id: fallbackId,
            avatar: getRandomAvatar(),
            displayName: `Anonymous`
        };
    }
}

// Generate random Dicebear avatar URL
function getRandomAvatar() {
    const style = DICEBEAR_AVATARS[Math.floor(Math.random() * DICEBEAR_AVATARS.length)];
    const seed = Math.random().toString(36).substring(7);
    return `https://api.dicebear.com/7.x/${style}/svg?seed=${seed}&backgroundColor=b6e3f4,c0aede,d1d4f9&radius=50`;
}

// Load all available hashtags
async function loadAvailableHashtags() {
    try {
        const hashtagsQuery = query(
            collection(db, 'hashtags'),
            orderBy('name', 'asc')
        );
        
        const snapshot = await getDocs(hashtagsQuery);
        availableHashtags = [];
        
        snapshot.forEach(doc => {
            availableHashtags.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        return availableHashtags;
    } catch (error) {
        console.error('Error loading hashtags:', error);
        return [];
    }
}

// Extract hashtags from text
function extractHashtags(text) {
    if (!text) return [];
    
    const hashtagRegex = /#(\w+)/g;
    const matches = text.match(hashtagRegex);
    
    if (!matches) return [];
    
    // Remove # symbol and get unique hashtags
    const hashtags = [...new Set(matches.map(tag => tag.substring(1).toLowerCase()))];
    return hashtags;
}

// Create hashtag
async function createHashtag(tagName, description = '') {
    if (!currentUser) {
        throw new Error('Please login to create hashtags');
    }
    
    if (!tagName || tagName.length < 2 || tagName.length > 30) {
        throw new Error('Hashtag name must be 2-30 characters');
    }
    
    // Clean tag name (remove # if present, lowercase, remove spaces)
    const cleanTagName = tagName.replace(/^#/, '').toLowerCase().replace(/\s+/g, '');
    
    // Check if hashtag already exists
    const existingQuery = query(
        collection(db, 'hashtags'),
        where('name', '==', cleanTagName)
    );
    
    const existingSnap = await getDocs(existingQuery);
    
    if (!existingSnap.empty) {
        throw new Error(`Hashtag #${cleanTagName} already exists`);
    }
    
    const userIdentity = await getUserIdentity();
    
    const hashtagData = {
        name: cleanTagName,
        displayName: `#${cleanTagName}`,
        description: description || `Posts about ${cleanTagName}`,
        creatorId: currentUser.uid,
        creatorName: userIdentity.displayName,
        createdAt: serverTimestamp(),
        postCount: 0,
        followerCount: 0,
        viewCount: 0,
        lastPostAt: null,
        isActive: true
    };
    
    const docRef = await addDoc(collection(db, 'hashtags'), hashtagData);
    console.log('Hashtag created:', docRef.id);
    
    // Add to local cache
    availableHashtags.push({
        id: docRef.id,
        ...hashtagData
    });
    
    return docRef.id;
}

// Get hashtag by name
async function getHashtagByName(tagName) {
    const cleanTagName = tagName.replace(/^#/, '').toLowerCase();
    
    const hashtagQuery = query(
        collection(db, 'hashtags'),
        where('name', '==', cleanTagName),
        limit(1)
    );
    
    const snapshot = await getDocs(hashtagQuery);
    
    if (snapshot.empty) {
        return null;
    }
    
    const doc = snapshot.docs[0];
    return {
        id: doc.id,
        ...doc.data()
    };
}

// Get hashtag by ID
async function getHashtagById(hashtagId) {
    try {
        const docRef = doc(db, 'hashtags', hashtagId);
        const docSnap = await getDoc(docRef);
        
        if (!docSnap.exists()) {
            return null;
        }
        
        return {
            id: docSnap.id,
            ...docSnap.data()
        };
    } catch (error) {
        console.error('Error getting hashtag:', error);
        return null;
    }
}

// Update hashtag stats
async function updateHashtagStats(hashtagId, updates) {
    try {
        const hashtagRef = doc(db, 'hashtags', hashtagId);
        await updateDoc(hashtagRef, updates);
    } catch (error) {
        console.error('Error updating hashtag stats:', error);
    }
}

// Follow/unfollow hashtag
async function toggleFollowHashtag(hashtagId) {
    if (!currentUser) {
        throw new Error('Please login to follow hashtags');
    }
    
    const userHashtagsRef = doc(db, 'users', currentUser.uid, 'hashtags', hashtagId);
    const hashtagRef = doc(db, 'hashtags', hashtagId);
    
    const userHashtagSnap = await getDoc(userHashtagsRef);
    const isFollowing = userHashtagSnap.exists();
    
    try {
        if (isFollowing) {
            // Unfollow
            await deleteDoc(userHashtagsRef);
            await updateDoc(hashtagRef, {
                followerCount: increment(-1)
            });
            return false;
        } else {
            // Follow
            await setDoc(userHashtagsRef, {
                followedAt: serverTimestamp()
            });
            await updateDoc(hashtagRef, {
                followerCount: increment(1)
            });
            return true;
        }
    } catch (error) {
        console.error('Error toggling follow:', error);
        throw error;
    }
}

// Check if user is following hashtag
async function isFollowingHashtag(hashtagId) {
    if (!currentUser) return false;
    
    const userHashtagsRef = doc(db, 'users', currentUser.uid, 'hashtags', hashtagId);
    const userHashtagSnap = await getDoc(userHashtagsRef);
    
    return userHashtagSnap.exists();
}

// Get posts by hashtag (FIXED VERSION - NO INDEX REQUIRED)
async function getPostsByHashtag(hashtagName, lastVisible = null, limitCount = 10) {
    const cleanTagName = hashtagName.replace(/^#/, '').toLowerCase();
    
    try {
        // SIMPLE QUERY WITHOUT ORDERBY TO AVOID INDEX REQUIREMENT
        // We'll sort manually in JavaScript
        const q = query(
            collection(db, 'gists'),
            where('hashtags', 'array-contains', cleanTagName),
            limit(limitCount)
        );
        
        const snapshot = await getDocs(q);
        const posts = [];
        
        snapshot.forEach(doc => {
            posts.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // Sort posts by timestamp manually (newest first)
        posts.sort((a, b) => {
            const timeA = a.timestamp ? (a.timestamp.toDate ? a.timestamp.toDate().getTime() : new Date(a.timestamp).getTime()) : 0;
            const timeB = b.timestamp ? (b.timestamp.toDate ? b.timestamp.toDate().getTime() : new Date(b.timestamp).getTime()) : 0;
            return timeB - timeA; // Descending order
        });
        
        // For pagination, we'll use the last document ID
        const lastDoc = snapshot.docs[snapshot.docs.length - 1];
        return {
            posts,
            lastVisible: lastDoc
        };
    } catch (error) {
        console.error('Error getting posts by hashtag:', error);
        return {
            posts: [],
            lastVisible: null
        };
    }
}

// Add hashtags to gist
async function addHashtagsToGist(gistId, hashtags) {
    if (!hashtags || hashtags.length === 0) return;
    
    try {
        const gistRef = doc(db, 'gists', gistId);
        
        // Update gist with hashtags
        await updateDoc(gistRef, {
            hashtags: hashtags,
            hashtagCount: hashtags.length
        });
        
        // Update each hashtag's post count and last post time
        for (const tagName of hashtags) {
            const hashtag = await getHashtagByName(tagName);
            
            if (hashtag) {
                await updateDoc(doc(db, 'hashtags', hashtag.id), {
                    postCount: increment(1),
                    lastPostAt: serverTimestamp(),
                    viewCount: increment(1)
                });
            }
        }
        
        console.log('Added hashtags to gist:', hashtags);
    } catch (error) {
        console.error('Error adding hashtags to gist:', error);
    }
}

// Process text to link hashtags
function processHashtagsInText(text) {
    if (!text) return text;
    
    return text.replace(/#(\w+)/g, (match, tag) => {
        return `<a href="hashtags.html?tag=${tag.toLowerCase()}" class="hashtag-link">${match}</a>`;
    });
}

// Generate share link for gist
async function generateGistLink(gistId) {
    try {
        const gistRef = doc(db, 'gists', gistId);
        const gistSnap = await getDoc(gistRef);
        
        if (!gistSnap.exists()) {
            throw new Error('Gist not found');
        }
        
        const gistData = gistSnap.data();
        
        // Generate a unique share ID if not exists
        let shareId = gistData.shareId;
        if (!shareId) {
            shareId = Math.random().toString(36).substring(2, 15);
            
            // Update gist with shareId
            await updateDoc(gistRef, {
                shareId: shareId,
                lastShared: serverTimestamp()
            });
            
            console.log('Generated share ID:', shareId);
        }
        
        // Create the shareable URL with cache busting
        const baseUrl = window.location.origin;
        const timestamp = Date.now();
        const shareUrl = `${baseUrl}/gist-preview.html?share=${shareId}&_=${timestamp}`;
        
        return {
            url: shareUrl,
            shareId: shareId,
            gistId: gistId
        };
    } catch (error) {
        console.error('Error generating link:', error);
        throw error;
    }
}

// Get gist by share ID
async function getGistByShareId(shareId) {
    try {
        console.log('Looking for gist with shareId:', shareId);
        
        // First try to find by shareId
        const q = query(
            collection(db, 'gists'),
            where('shareId', '==', shareId),
            limit(1)
        );
        
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
            const doc = querySnapshot.docs[0];
            const gistData = doc.data();
            console.log('Found gist by shareId:', doc.id);
            return {
                id: doc.id,
                ...gistData
            };
        }
        
        // If not found by shareId, try if shareId is actually a gist ID
        console.log('Not found by shareId, trying as gist ID:', shareId);
        try {
            const gistRef = doc(db, 'gists', shareId);
            const gistSnap = await getDoc(gistRef);
            
            if (gistSnap.exists()) {
                const gistData = gistSnap.data();
                console.log('Found gist by ID:', shareId);
                
                // Generate share ID if not exists
                if (!gistData.shareId) {
                    const newShareId = Math.random().toString(36).substring(2, 15);
                    await updateDoc(gistRef, {
                        shareId: newShareId,
                        lastShared: serverTimestamp()
                    });
                    gistData.shareId = newShareId;
                }
                
                return {
                    id: shareId,
                    ...gistData
                };
            }
        } catch (idError) {
            console.error('Error finding by ID:', idError);
        }
        
        console.log('Gist not found with shareId:', shareId);
        return null;
        
    } catch (error) {
        console.error('Error getting gist by share ID:', error);
        throw error;
    }
}

// Create WhatsApp preview URL with gist data
function createWhatsAppPreviewUrl(gistData, shareUrl) {
    // For WhatsApp, we need to create a message with the gist content
    let text = '';
    
    if (gistData.content) {
        text = `📝 *Anonymous Gist*\n\n"${gistData.content.substring(0, 200)}${gistData.content.length > 200 ? '...' : ''}"`;
    } else {
        text = `📝 *Anonymous Gist*`;
    }
    
    // Add media indicator if gist has image
    if (gistData.mediaType === 'image' && gistData.mediaUrl) {
        text += '\n\n🖼️ *Includes an image*';
    } else if (gistData.mediaType === 'both' && gistData.secondMediaUrl) {
        text += '\n\n🖼️ *Includes an image and voice note*';
    } else if (gistData.mediaType === 'audio' && gistData.mediaUrl) {
        text += '\n\n🎤 *Includes a voice note*';
    }
    
    text += `\n\n👉 Open to view: ${shareUrl}`;
    
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

// Create Telegram preview URL with gist data
function createTelegramPreviewUrl(gistData, shareUrl) {
    let text = '';
    
    if (gistData.content) {
        text = `📝 Anonymous Gist\n\n"${gistData.content.substring(0, 200)}${gistData.content.length > 200 ? '...' : ''}"`;
    } else {
        text = `📝 Anonymous Gist`;
    }
    
    // Add media indicator if gist has image
    if (gistData.mediaType === 'image' && gistData.mediaUrl) {
        text += '\n\n🖼️ Includes an image';
    } else if (gistData.mediaType === 'both' && gistData.secondMediaUrl) {
        text += '\n\n🖼️ Includes an image and voice note';
    } else if (gistData.mediaType === 'audio' && gistData.mediaUrl) {
        text += '\n\n🎤 Includes a voice note';
    }
    
    text += `\n\n👉 Open to view: ${shareUrl}`;
    
    return `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`;
}

// Initialize on DOM content loaded
document.addEventListener('DOMContentLoaded', function() {
    // Check which page we're on
    const currentPage = window.location.pathname.split('/').pop().split('.')[0];
    
    console.log('Current page:', currentPage);
    
    // Listen for auth state changes
    onAuthStateChanged(auth, (user) => {
        currentUser = user;
        
        if (currentPage === 'create-gist') {
            initCreateGistPage();
        } else if (currentPage === 'gist') {
            initGistPage();
        } else if (currentPage === 'gist-preview') {
            initGistPreviewPage();
        } else if (currentPage === 'gist-view') {
            initGistViewPage();
        } else if (currentPage === 'comments') {
            initCommentsPage();
        } else if (currentPage === 'create-tag') {
            initCreateTagPage();
        } else if (currentPage === 'hashtags') {
            initHashtagsPage();
        } else if (currentPage === 'photos') {
            initPhotosPage();
        }
    });
});

// Initialize create tag page
function initCreateTagPage() {
    console.log('Initializing create tag page');
    
    const tagForm = document.getElementById('createTagForm');
    const tagNameInput = document.getElementById('tagName');
    const tagDescriptionInput = document.getElementById('tagDescription');
    const charCount = document.getElementById('charCount');
    const createBtn = document.getElementById('createBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const nameError = document.getElementById('nameError');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const exampleTags = document.querySelectorAll('.hashtag-example');
    
    // Character counter
    if (tagNameInput && charCount) {
        tagNameInput.addEventListener('input', () => {
            const value = tagNameInput.value;
            charCount.textContent = value.length;
            
            // Validate tag name
            const isValid = value.length >= 2 && value.length <= 30 && /^[a-zA-Z0-9_]+$/.test(value.replace(/^#/, ''));
            
            if (value.length > 0) {
                if (isValid) {
                    nameError.style.display = 'none';
                    tagNameInput.style.borderColor = '#28a745';
                } else {
                    nameError.style.display = 'block';
                    tagNameInput.style.borderColor = '#dc3545';
                }
            } else {
                nameError.style.display = 'none';
                tagNameInput.style.borderColor = '#e0e0e0';
            }
            
            updateCreateButton();
        });
    }
    
    // Example tag click
    exampleTags.forEach(tag => {
        tag.addEventListener('click', () => {
            const tagName = tag.dataset.tag;
            tagNameInput.value = tagName;
            tagNameInput.dispatchEvent(new Event('input'));
        });
    });
    
    // Cancel button
    if (cancelBtn) {
        cancelBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.history.back();
        });
    }
    
    // Form submit
    if (tagForm) {
        tagForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await createHashtagHandler();
        });
    }
    
    // Update create button state
    function updateCreateButton() {
        if (!createBtn || !tagNameInput) return;
        
        const value = tagNameInput.value.trim();
        const isValid = value.length >= 2 && value.length <= 30 && /^[a-zA-Z0-9_]+$/.test(value.replace(/^#/, ''));
        
        createBtn.disabled = !isValid;
    }
    
    updateCreateButton();
    
    console.log('Create tag page initialized');
}

async function createHashtagHandler() {
    const tagNameInput = document.getElementById('tagName');
    const tagDescriptionInput = document.getElementById('tagDescription');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const createBtn = document.getElementById('createBtn');
    
    if (!tagNameInput) return;
    
    const tagName = tagNameInput.value.trim();
    const description = tagDescriptionInput ? tagDescriptionInput.value.trim() : '';
    
    if (!tagName || tagName.length < 2) {
        showNotification('Please enter a valid hashtag name', 'error');
        return;
    }
    
    if (!currentUser) {
        showNotification('Please login to create hashtags', 'error');
        return;
    }
    
    try {
        // Show loading
        if (loadingOverlay) loadingOverlay.style.display = 'flex';
        if (createBtn) createBtn.disabled = true;
        
        const hashtagId = await createHashtag(tagName, description);
        
        showNotification('Hashtag created successfully!', 'success');
        
        // Redirect to hashtag page after delay
        setTimeout(() => {
            window.location.href = `hashtags.html?tag=${tagName.replace(/^#/, '').toLowerCase()}`;
        }, 1500);
        
    } catch (error) {
        console.error('Error creating hashtag:', error);
        showNotification(error.message, 'error');
    } finally {
        if (loadingOverlay) loadingOverlay.style.display = 'none';
        if (createBtn) createBtn.disabled = false;
    }
}

// Initialize hashtags page
function initHashtagsPage() {
    console.log('Initializing hashtags page');
    
    const urlParams = new URLSearchParams(window.location.search);
    const tagName = urlParams.get('tag');
    
    if (!tagName) {
        window.location.href = 'gist.html';
        return;
    }
    
    currentHashtagId = tagName.toLowerCase();
    
    const backBtn = document.getElementById('backBtn');
    const createPostBtn = document.getElementById('createPostBtn');
    const followBtn = document.getElementById('followBtn');
    const createHashtagBtn = document.getElementById('createHashtagBtn');
    
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.history.back();
        });
    }
    
    if (createPostBtn) {
        createPostBtn.addEventListener('click', () => {
            window.location.href = `create-gist.html?hashtag=${tagName}`;
        });
    }
    
    if (followBtn) {
        followBtn.addEventListener('click', async () => {
            await toggleFollowHashtagHandler();
        });
    }
    
    if (createHashtagBtn) {
        createHashtagBtn.addEventListener('click', () => {
            window.location.href = 'create-tag.html';
        });
    }
    
    loadHashtagData(tagName);
    loadHashtagPosts(tagName);
}

async function loadHashtagData(tagName) {
    try {
        const hashtag = await getHashtagByName(tagName);
        
        if (!hashtag) {
            // Hashtag doesn't exist, redirect to create page
            showNotification('This hashtag doesn\'t exist yet. Create it now!', 'info');
            setTimeout(() => {
                window.location.href = `create-tag.html?tag=${tagName}`;
            }, 2000);
            return;
        }
        
        currentHashtagId = hashtag.id;
        
        // Update UI
        const displayName = document.getElementById('hashtagDisplayName');
        const description = document.getElementById('hashtagDescription');
        const postsCount = document.getElementById('postsCount');
        const followersCount = document.getElementById('followersCount');
        const viewsCount = document.getElementById('viewsCount');
        const followBtn = document.getElementById('followBtn');
        
        if (displayName) {
            displayName.innerHTML = `<span class="hashtag-name">#${hashtag.name}</span>`;
        }
        
        if (description) {
            description.textContent = hashtag.description || `Posts about ${hashtag.name}`;
        }
        
        if (postsCount) {
            postsCount.textContent = hashtag.postCount || 0;
        }
        
        if (followersCount) {
            followersCount.textContent = hashtag.followerCount || 0;
        }
        
        if (viewsCount) {
            viewsCount.textContent = hashtag.viewCount || 0;
        }
        
        // Check if user is following
        if (followBtn && currentUser) {
            const isFollowing = await isFollowingHashtag(hashtag.id);
            updateFollowButton(followBtn, isFollowing);
        }
        
        // Update view count
        await updateHashtagStats(hashtag.id, {
            viewCount: increment(1)
        });
        
    } catch (error) {
        console.error('Error loading hashtag data:', error);
        showNotification('Error loading hashtag', 'error');
    }
}

function updateFollowButton(button, isFollowing) {
    if (!button) return;
    
    if (isFollowing) {
        button.innerHTML = '<i class="fas fa-check"></i> Following';
        button.classList.add('following');
    } else {
        button.innerHTML = '<i class="fas fa-plus"></i> Follow';
        button.classList.remove('following');
    }
}

async function toggleFollowHashtagHandler() {
    if (!currentUser) {
        showNotification('Please login to follow hashtags', 'warning');
        return;
    }
    
    if (!currentHashtagId) return;
    
    const followBtn = document.getElementById('followBtn');
    const followersCount = document.getElementById('followersCount');
    
    if (!followBtn) return;
    
    try {
        const isNowFollowing = await toggleFollowHashtag(currentHashtagId);
        
        updateFollowButton(followBtn, isNowFollowing);
        
        // Update follower count
        if (followersCount) {
            const currentCount = parseInt(followersCount.textContent) || 0;
            followersCount.textContent = isNowFollowing ? currentCount + 1 : currentCount - 1;
        }
        
        showNotification(isNowFollowing ? 'You are now following this hashtag!' : 'You unfollowed this hashtag.', 'success');
        
    } catch (error) {
        console.error('Error toggling follow:', error);
        showNotification('Error updating follow status', 'error');
    }
}

async function loadHashtagPosts(tagName, lastVisible = null) {
    const container = document.getElementById('hashtagPostsContainer');
    
    if (!container) return;
    
    try {
        const { posts, lastVisible: newLastVisible } = await getPostsByHashtag(tagName, lastVisible, 10);
        
        if (lastVisible === null) {
            container.innerHTML = '';
        }
        
        if (posts.length === 0) {
            if (lastVisible === null) {
                container.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-hashtag fa-3x"></i>
                        <h3>No posts yet</h3>
                        <p>Be the first to post with this hashtag!</p>
                        <button class="create-post-btn" onclick="window.location.href='create-gist.html?hashtag=${tagName}'" 
                                style="margin-top: 20px; background: #b3004b; color: white; border: none; padding: 12px 25px; border-radius: 25px; cursor: pointer;">
                            <i class="fas fa-plus"></i> Create First Post
                        </button>
                    </div>
                `;
            }
            return;
        }
        
        posts.forEach(gist => {
            if (!document.querySelector(`[data-gist-id="${gist.id}"]`)) {
                displayGistInHashtagPage(gist, container);
            }
        });
        
        // Store last visible for pagination
        if (newLastVisible) {
            lastVisibleGist = newLastVisible;
        }
        
    } catch (error) {
        console.error('Error loading hashtag posts:', error);
        if (lastVisible === null) {
            container.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Error loading posts</h3>
                    <p>Please try again later.</p>
                </div>
            `;
        }
    }
}

function displayGistInHashtagPage(gist, container) {
    const timeAgo = gist.timestamp ? formatTime(gist.timestamp) : 'Just now';
    const authorName = gist.authorDisplayName || `Anonymous${gist.anonymousUserId ? ' ' + gist.anonymousUserId.substring(gist.anonymousUserId.length - 4) : ''}`;
    
    let mediaContent = '';
    
    if (gist.mediaType === 'both' && gist.mediaUrl && gist.secondMediaUrl) {
        const duration = gist.duration ? formatDuration(gist.duration) : '0:00';
        mediaContent = `
            <div class="gist-media">
                <img src="${gist.secondMediaUrl}" alt="Gist image" class="gist-image" 
                     style="max-width: 100%; border-radius: 10px; margin-top: 10px;">
                <div class="gist-voice-note" style="margin-top: 10px;">
                    <button class="voice-play-btn" data-audio-url="${gist.mediaUrl}">
                        <i class="fas fa-play"></i>
                    </button>
                    <div class="voice-waveform">
                        <div class="wave-bar"></div>
                        <div class="wave-bar"></div>
                        <div class="wave-bar"></div>
                        <div class="wave-bar"></div>
                        <div class="wave-bar"></div>
                    </div>
                    <span class="voice-duration">${duration}</span>
                </div>
            </div>
        `;
    } else if (gist.mediaType === 'image' && gist.mediaUrl) {
        mediaContent = `
            <div class="gist-media">
                <img src="${gist.mediaUrl}" alt="Gist image" class="gist-image" 
                     style="max-width: 100%; border-radius: 10px; margin-top: 10px;">
            </div>
        `;
    } else if (gist.mediaType === 'audio' && gist.mediaUrl) {
        const duration = gist.duration ? formatDuration(gist.duration) : '0:00';
        mediaContent = `
            <div class="gist-media">
                <div class="gist-voice-note">
                    <button class="voice-play-btn" data-audio-url="${gist.mediaUrl}">
                        <i class="fas fa-play"></i>
                    </button>
                    <div class="voice-waveform">
                        <div class="wave-bar"></div>
                        <div class="wave-bar"></div>
                        <div class="wave-bar"></div>
                        <div class="wave-bar"></div>
                        <div class="wave-bar"></div>
                    </div>
                    <span class="voice-duration">${duration}</span>
                </div>
            </div>
        `;
    }
    
    const gistElement = document.createElement('div');
    gistElement.className = 'gist-card';
    gistElement.dataset.gistId = gist.id;
    gistElement.style.cssText = `
        background: white;
        border-radius: 15px;
        padding: 20px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        margin-bottom: 20px;
    `;
    
    gistElement.innerHTML = `
        <div class="gist-header" style="display: flex; align-items: center; margin-bottom: 15px;">
            <img src="${gist.authorAvatar}" alt="Anonymous avatar" 
                 style="width: 50px; height: 50px; border-radius: 50%; border: 2px solid #b3004b; margin-right: 15px;">
            <div class="gist-info">
                <div style="font-weight: bold; color: #333;">${authorName}</div>
                <div style="color: #666; font-size: 14px;">${timeAgo}</div>
            </div>
        </div>
        
        <div class="gist-content">
            ${gist.content ? `<div class="gist-text" style="font-size: 16px; line-height: 1.6; color: #333; margin-bottom: 15px;">${processHashtagsInText(escapeHtml(gist.content))}</div>` : ''}
            ${mediaContent}
        </div>
        
        <div class="gist-actions" style="display: flex; gap: 20px; margin-top: 20px; padding-top: 15px; border-top: 1px solid #eee;">
            <button class="gist-action-btn like-btn" data-gist-id="${gist.id}" style="background: none; border: none; color: #666; cursor: pointer; display: flex; align-items: center; gap: 5px;">
                <i class="fas fa-heart"></i>
                <span class="action-count">${gist.likes || 0}</span>
            </button>
            
            <button class="gist-action-btn comment-btn" data-gist-id="${gist.id}" style="background: none; border: none; color: #666; cursor: pointer; display: flex; align-items: center; gap: 5px;">
                <i class="fas fa-comment"></i>
                <span class="action-count">${gist.comments || 0}</span>
            </button>
            
            <button class="gist-action-btn share-btn" data-gist-id="${gist.id}" style="background: none; border: none; color: #666; cursor: pointer;">
                <i class="fas fa-share"></i>
            </button>
        </div>
    `;
    
    const likeBtn = gistElement.querySelector('.like-btn');
    const commentBtn = gistElement.querySelector('.comment-btn');
    const shareBtn = gistElement.querySelector('.share-btn');
    const voicePlayBtn = gistElement.querySelector('.voice-play-btn');
    
    if (likeBtn) {
        likeBtn.addEventListener('click', () => likeGist(gist.id, likeBtn));
        if (currentUser && gist.likedBy && gist.likedBy.includes(currentUser.uid)) {
            likeBtn.classList.add('liked');
            likeBtn.style.color = '#e0245e';
        }
    }
    
    if (commentBtn) {
        commentBtn.addEventListener('click', () => {
            window.location.href = `comments.html?gistId=${gist.id}`;
        });
    }
    
    if (shareBtn) {
        shareBtn.addEventListener('click', () => shareGist(gist.id, shareBtn));
    }
    
    if (voicePlayBtn && gist.mediaUrl && (gist.mediaType === 'audio' || gist.mediaType === 'both')) {
        voicePlayBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            playGistVoice(gist.mediaUrl, voicePlayBtn, gistElement.querySelector('.voice-waveform'));
        });
    }
    
    container.appendChild(gistElement);
}

// Initialize create gist page with hashtag support and multiple photos
function initCreateGistPage() {
    console.log('Initializing create gist page');
    
    const gistForm = document.getElementById('gistForm');
    const gistContent = document.getElementById('gistContent');
    const charCount = document.getElementById('charCount');
    const imageUploadBtn = document.getElementById('imageUploadBtn');
    const voiceRecordBtn = document.getElementById('voiceRecordBtn');
    const bothUploadBtn = document.getElementById('bothUploadBtn');
    const imageInput = document.getElementById('imageInput');
    const bothImageInput = document.getElementById('bothImageInput');
    const cancelBtn = document.getElementById('cancelBtn');
    const submitBtn = document.getElementById('submitBtn');
    const voiceRecordingIndicator = document.getElementById('voiceRecordingIndicator');
    const recordingTimerElement = document.getElementById('recordingTimer');
    const cancelRecordingBtn = document.getElementById('cancelRecordingBtn');
    const stopRecordingBtn = document.getElementById('stopRecordingBtn');
    const attachmentsContainer = document.getElementById('attachmentsContainer');
    const gistAvatar = document.getElementById('gistAvatar');
    const hashtagSuggestions = document.getElementById('hashtagSuggestions');
    const hashtagDropdown = document.getElementById('hashtagDropdown');

    // Set user's avatar
    if (gistAvatar) {
        getUserIdentity().then(user => {
            gistAvatar.src = user.avatar;
        }).catch(() => {
            gistAvatar.src = getRandomAvatar();
        });
    }

    // Character counter
    if (gistContent && charCount) {
        gistContent.addEventListener('input', () => {
            charCount.textContent = gistContent.value.length;
            updateSubmitButton();
            
            // Check for hashtag input and show suggestions
            checkHashtagInput(gistContent.value);
        });
    }

    // Image upload button
    if (imageUploadBtn && imageInput) {
        imageUploadBtn.addEventListener('click', () => {
            pendingMediaType = 'image';
            resetMediaButtons();
            imageUploadBtn.classList.add('active');
            imageInput.click();
        });
    }

    // Voice record button
    if (voiceRecordBtn) {
        voiceRecordBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            pendingMediaType = 'audio';
            resetMediaButtons();
            voiceRecordBtn.classList.add('active');
            await startVoiceRecording();
        });
    }

    // Both upload button
    if (bothUploadBtn && bothImageInput) {
        bothUploadBtn.addEventListener('click', (e) => {
            e.preventDefault();
            pendingMediaType = 'both';
            resetMediaButtons();
            bothUploadBtn.classList.add('active');
            bothImageInput.click();
        });
    }

    // Image input change
    if (imageInput) {
        imageInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                handleMultipleImageUpload(Array.from(e.target.files));
            }
        });
    }

    // Both image input change
    if (bothImageInput) {
        bothImageInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                handleMultipleImageUpload(Array.from(e.target.files));
                setTimeout(() => {
                    startVoiceRecording();
                }, 100);
            }
        });
    }

    // Cancel button
    if (cancelBtn) {
        cancelBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (window.history.length > 1) {
                window.history.back();
            } else {
                window.location.href = 'gist.html';
            }
        });
    }

    // Cancel recording button
    if (cancelRecordingBtn) {
        cancelRecordingBtn.addEventListener('click', (e) => {
            e.preventDefault();
            cancelVoiceRecording();
        });
    }

    // Stop recording button
    if (stopRecordingBtn) {
        stopRecordingBtn.addEventListener('click', (e) => {
            e.preventDefault();
            stopVoiceRecording();
        });
    }

    // Form submit
    if (gistForm) {
        gistForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await submitGist();
        });
    }

    // Check if we have a hashtag from URL
    const urlParams = new URLSearchParams(window.location.search);
    const hashtagParam = urlParams.get('hashtag');
    
    if (hashtagParam && gistContent) {
        gistContent.value = `#${hashtagParam} ` + gistContent.value;
        gistContent.dispatchEvent(new Event('input'));
    }

    // Load hashtags for suggestions
    loadAvailableHashtags();

    // Initialize submit button
    updateSubmitButton();
    
    console.log('Create gist page initialized');
}

// Handle multiple image upload
function handleMultipleImageUpload(files) {
    if (!files || files.length === 0) return;
    
    // Filter only image files
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
        showNotification('Please select image files only', 'warning');
        return;
    }
    
    // Check if adding these files would exceed the limit
    const remainingSlots = maxPhotos - pendingImageFiles.length;
    if (imageFiles.length > remainingSlots) {
        showNotification(`You can only upload up to ${maxPhotos} photos. You have ${pendingImageFiles.length} already selected.`, 'warning');
        return;
    }
    
    // Check each file size
    for (const file of imageFiles) {
        if (file.size > 10 * 1024 * 1024) {
            showNotification(`${file.name} is too large (max 10MB)`, 'warning');
            return;
        }
    }
    
    // Add files to pending list
    pendingImageFiles.push(...imageFiles);
    
    // Show attachment previews
    showMultipleAttachmentPreviews();
    updateSubmitButton();
}

// Show multiple attachment previews
function showMultipleAttachmentPreviews() {
    const attachmentsContainer = document.getElementById('attachmentsContainer');
    if (!attachmentsContainer) return;
    
    attachmentsContainer.style.display = 'block';
    attachmentsContainer.innerHTML = '';
    
    // Create grid container
    const gridContainer = document.createElement('div');
    gridContainer.className = 'photos-grid';
    gridContainer.style.cssText = `
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;
        margin-bottom: 15px;
    `;
    
    // Add each image preview
    pendingImageFiles.forEach((file, index) => {
        const previewContainer = document.createElement('div');
        previewContainer.className = 'photo-preview-container';
        previewContainer.style.cssText = `
            position: relative;
            aspect-ratio: 1;
            border-radius: 10px;
            overflow: hidden;
        `;
        
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.alt = `Preview ${index + 1}`;
        img.style.cssText = `
            width: 100%;
            height: 100%;
            object-fit: cover;
        `;
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'photo-remove-btn';
        removeBtn.innerHTML = '<i class="fas fa-times"></i>';
        removeBtn.style.cssText = `
            position: absolute;
            top: 5px;
            right: 5px;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: rgba(0, 0, 0, 0.6);
            color: white;
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
        `;
        
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            removeImageAtIndex(index);
        });
        
        previewContainer.appendChild(img);
        previewContainer.appendChild(removeBtn);
        gridContainer.appendChild(previewContainer);
    });
    
    // Add clear all button
    const clearAllBtn = document.createElement('button');
    clearAllBtn.className = 'clear-all-btn';
    clearAllBtn.textContent = `Clear All (${pendingImageFiles.length} photos)`;
    clearAllBtn.style.cssText = `
        width: 100%;
        padding: 10px;
        background: #dc3545;
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        font-weight: bold;
        margin-top: 10px;
    `;
    
    clearAllBtn.addEventListener('click', () => {
        pendingImageFiles = [];
        pendingMediaType = null;
        resetMediaButtons();
        attachmentsContainer.style.display = 'none';
        updateSubmitButton();
    });
    
    attachmentsContainer.appendChild(gridContainer);
    attachmentsContainer.appendChild(clearAllBtn);
}

// Remove image at specific index
function removeImageAtIndex(index) {
    pendingImageFiles.splice(index, 1);
    
    if (pendingImageFiles.length === 0) {
        const attachmentsContainer = document.getElementById('attachmentsContainer');
        if (attachmentsContainer) {
            attachmentsContainer.style.display = 'none';
        }
        pendingMediaType = null;
        resetMediaButtons();
    } else {
        showMultipleAttachmentPreviews();
    }
    
    updateSubmitButton();
}

function checkHashtagInput(text) {
    const hashtagSuggestions = document.getElementById('hashtagSuggestions');
    const hashtagDropdown = document.getElementById('hashtagDropdown');
    
    if (!hashtagSuggestions || !hashtagDropdown) return;
    
    // Check if user is typing a hashtag
    const lastWord = text.split(' ').pop();
    
    if (lastWord.startsWith('#') && lastWord.length > 1) {
        const searchTerm = lastWord.substring(1).toLowerCase();
        
        // Filter hashtags
        const matchingHashtags = availableHashtags.filter(tag => 
            tag.name.toLowerCase().includes(searchTerm)
        ).slice(0, 5); // Show only top 5
        
        if (matchingHashtags.length > 0) {
            hashtagDropdown.innerHTML = matchingHashtags.map(tag => `
                <div class="hashtag-suggestion-item" data-tag="${tag.name}">
                    <span class="hashtag-suggestion-tag">#${tag.name}</span>
                    <span class="hashtag-suggestion-count">${tag.postCount || 0} posts</span>
                </div>
            `).join('');
            
            hashtagSuggestions.style.display = 'block';
            
            // Add click handlers
            document.querySelectorAll('.hashtag-suggestion-item').forEach(item => {
                item.addEventListener('click', () => {
                    const tag = item.dataset.tag;
                    const gistContent = document.getElementById('gistContent');
                    if (gistContent) {
                        // Replace the current word with the selected hashtag
                        const text = gistContent.value;
                        const words = text.split(' ');
                        words[words.length - 1] = `#${tag} `;
                        gistContent.value = words.join(' ');
                        gistContent.focus();
                        hashtagSuggestions.style.display = 'none';
                    }
                });
            });
        } else {
            hashtagSuggestions.style.display = 'none';
        }
    } else {
        hashtagSuggestions.style.display = 'none';
    }
}

async function submitGist() {
    console.log('Submitting gist...');
    
    const submitBtn = document.getElementById('submitBtn');
    const gistContent = document.getElementById('gistContent');
    
    if (!currentUser) {
        showNotification('Please login to create gists', 'error');
        return;
    }
    
    submitBtn.disabled = true;
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Posting...';
    
    try {
        const content = gistContent ? gistContent.value.trim() : '';
        let mediaUrl = null;
        let mediaType = null;
        let duration = null;
        let imageUrls = [];
        
        if (pendingImageFiles.length > 0 || pendingAudioBlob) {
            showNotification('Uploading media...', 'info');
            
            // Upload multiple images
            if (pendingImageFiles.length > 0) {
                console.log(`Uploading ${pendingImageFiles.length} images`);
                
                // Upload all images
                const uploadPromises = pendingImageFiles.map(file => 
                    uploadImageToCloudinary(file)
                );
                
                imageUrls = await Promise.all(uploadPromises);
                console.log('All images uploaded:', imageUrls);
            }
            
            // Handle audio if present
            if (pendingAudioBlob) {
                console.log('Uploading audio');
                mediaUrl = await uploadAudioToCloudinary(pendingAudioBlob);
                mediaType = pendingMediaType;
                duration = Math.floor((Date.now() - recordingStartTime) / 1000);
            }
            
            // Set media type based on what we have
            if (pendingImageFiles.length > 0 && pendingAudioBlob) {
                mediaType = 'both';
            } else if (pendingImageFiles.length > 0) {
                mediaType = 'image';
            } else if (pendingAudioBlob) {
                mediaType = 'audio';
            }
        }
        
        console.log('Creating gist with:', { 
            content, 
            mediaUrl, 
            mediaType, 
            duration, 
            imageUrls,
            imageCount: pendingImageFiles.length 
        });
        
        const gistId = await createGist(content, mediaUrl, mediaType, duration, imageUrls);
        
        if (gistId) {
            // Extract and add hashtags
            const hashtags = extractHashtags(content);
            if (hashtags.length > 0) {
                await addHashtagsToGist(gistId, hashtags);
            }
            
            showNotification('Gist posted successfully!', 'success');
            
            // Clear form
            if (gistContent) gistContent.value = '';
            pendingImageFiles = [];
            if (pendingAudioBlob) pendingAudioBlob = null;
            pendingMediaType = null;
            
            resetMediaButtons();
            const attachmentsContainer = document.getElementById('attachmentsContainer');
            if (attachmentsContainer) {
                attachmentsContainer.style.display = 'none';
                attachmentsContainer.innerHTML = '';
            }
            
            const charCount = document.getElementById('charCount');
            if (charCount) charCount.textContent = '0';
            
            setTimeout(() => {
                window.location.href = 'gist.html';
            }, 1500);
        } else {
            showNotification('Failed to create gist', 'error');
        }
        
    } catch (error) {
        console.error('Error submitting gist:', error);
        showNotification('Failed to create gist: ' + error.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

async function createGist(content, mediaUrl = null, mediaType = null, duration = null, imageUrls = []) {
    if (!currentUser) {
        showNotification('Please login to create gists', 'error');
        return null;
    }
    
    try {
        const shareId = Math.random().toString(36).substring(2, 15);
        const userIdentity = await getUserIdentity();
        
        // Extract hashtags
        const hashtags = extractHashtags(content);
        
        const gistData = {
            content: content || '',
            mediaUrl: mediaUrl || null,
            mediaType: mediaType || null,
            duration: duration || null,
            likes: 0,
            comments: 0,
            reposts: 0,
            highlights: 0,
            authorId: currentUser.uid,
            anonymousUserId: userIdentity.id,
            authorAvatar: userIdentity.avatar,
            authorDisplayName: userIdentity.displayName,
            timestamp: serverTimestamp(),
            isAnonymous: true,
            createdAt: new Date().toISOString(),
            likedBy: [],
            highlightedBy: [],
            repostedBy: [],
            repostedFrom: null,
            originalPostId: null,
            containsVoiceNote: (mediaType === 'audio' || mediaType === 'both'),
            shareId: shareId,
            lastShared: null,
            viewCount: 0,
            hashtags: hashtags,
            hashtagCount: hashtags.length
        };
        
        // Handle multiple images
        if (imageUrls.length > 0) {
            gistData.imageUrls = imageUrls;
            gistData.imageCount = imageUrls.length;
            
            // For backward compatibility
            if (imageUrls.length === 1) {
                gistData.secondMediaUrl = imageUrls[0];
            } else {
                gistData.mediaType = 'multiple_images';
            }
        }
        
        console.log('Saving gist to Firestore:', gistData);
        
        const docRef = await addDoc(collection(db, 'gists'), gistData);
        console.log('Gist created with ID:', docRef.id);
        
        return docRef.id;
    } catch (error) {
        console.error('Error creating gist:', error);
        throw error;
    }
}

function resetMediaButtons() {
    const buttons = document.querySelectorAll('.media-option-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
}

function showAttachmentPreview(file) {
    const attachmentsContainer = document.getElementById('attachmentsContainer');
    if (!attachmentsContainer) return;

    attachmentsContainer.style.display = 'block';
    
    let fileType = 'Image';
    if (file.type.startsWith('audio/')) {
        fileType = 'Voice Note';
    }
    
    attachmentsContainer.innerHTML = `
        <div class="attachment-preview">
            <div class="attachment-info">
                <span class="attachment-name">${fileType} ready</span>
            </div>
            <button type="button" class="attachment-remove" id="removeAttachmentBtn">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;

    document.getElementById('removeAttachmentBtn').addEventListener('click', () => {
        pendingImageFile = null;
        pendingAudioBlob = null;
        pendingMediaType = null;
        resetMediaButtons();
        attachmentsContainer.style.display = 'none';
        updateSubmitButton();
    });
}

async function startVoiceRecording() {
    console.log('Starting voice recording...');
    
    try {
        const voiceIndicator = document.getElementById('voiceRecordingIndicator');
        
        if (voiceIndicator) {
            voiceIndicator.style.display = 'flex';
        }
        
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        
        recordingStartTime = Date.now();
        updateRecordingTimer();
        recordingTimer = setInterval(updateRecordingTimer, 1000);
        
        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };
        
        mediaRecorder.start(100);
        
        console.log('Voice recording started');
        
        setTimeout(() => {
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                stopVoiceRecording();
            }
        }, 30000);
        
    } catch (error) {
        console.error('Error starting recording:', error);
        showNotification('Could not access microphone. Please check permissions.', 'error');
        
        const voiceIndicator = document.getElementById('voiceRecordingIndicator');
        
        if (voiceIndicator) {
            voiceIndicator.style.display = 'none';
        }
        
        resetMediaButtons();
    }
}

function updateRecordingTimer() {
    const timerElement = document.getElementById('recordingTimer');
    if (timerElement && recordingStartTime) {
        const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
}

function stopVoiceRecording() {
    if (!mediaRecorder) return;
    
    console.log('Stopping voice recording...');
    
    clearInterval(recordingTimer);
    mediaRecorder.stop();
    
    mediaRecorder.stream.getTracks().forEach(track => track.stop());
    
    mediaRecorder.onstop = async () => {
        const voiceIndicator = document.getElementById('voiceRecordingIndicator');
        
        if (voiceIndicator) {
            voiceIndicator.style.display = 'none';
        }
        
        const duration = Math.floor((Date.now() - recordingStartTime) / 1000);
        const audioBlob = new Blob(audioChunks, { type: 'audio/mp3' });
        
        console.log('Voice recorded:', { duration, size: audioBlob.size });
        
        showVoicePreview(audioBlob, duration);
        
        mediaRecorder = null;
        audioChunks = [];
        recordingStartTime = null;
    };
}

function cancelVoiceRecording() {
    if (!mediaRecorder) return;
    
    console.log('Cancelling voice recording');
    
    clearInterval(recordingTimer);
    mediaRecorder.stop();
    
    if (mediaRecorder.stream) {
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
    
    const voiceIndicator = document.getElementById('voiceRecordingIndicator');
    
    if (voiceIndicator) {
        voiceIndicator.style.display = 'none';
    }
    
    resetMediaButtons();
    
    mediaRecorder = null;
    audioChunks = [];
    recordingStartTime = null;
}

function showVoicePreview(audioBlob, duration) {
    console.log('Showing voice preview');
    
    const previewModal = document.getElementById('voicePreviewModal');
    const playPreviewBtn = document.getElementById('playPreviewBtn');
    const previewDuration = document.getElementById('previewDuration');
    const cancelPreviewBtn = document.getElementById('cancelPreviewBtn');
    const sendPreviewBtn = document.getElementById('sendPreviewBtn');
    const previewWaveform = document.getElementById('previewWaveform');
    
    if (!previewModal) {
        console.error('Voice preview modal not found');
        return;
    }
    
    previewModal.style.display = 'flex';
    if (previewDuration) {
        previewDuration.textContent = formatDuration(duration);
    }
    
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    currentlyPlayingAudio = audio;
    
    playPreviewBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (audio.paused) {
            audio.play();
            playPreviewBtn.innerHTML = '<i class="fas fa-pause"></i>';
            
            const waveBars = previewWaveform.querySelectorAll('.wave-bar');
            waveBars.forEach((bar, index) => {
                bar.style.animation = `waveform 1.2s ${index * 0.1}s infinite ease-in-out`;
            });
        } else {
            audio.pause();
            playPreviewBtn.innerHTML = '<i class="fas fa-play"></i>';
            
            const waveBars = previewWaveform.querySelectorAll('.wave-bar');
            waveBars.forEach(bar => {
                bar.style.animation = 'none';
            });
        }
    });
    
    audio.onended = () => {
        playPreviewBtn.innerHTML = '<i class="fas fa-play"></i>';
        const waveBars = previewWaveform.querySelectorAll('.wave-bar');
        waveBars.forEach(bar => {
            bar.style.animation = 'none';
        });
    };
    
    audio.onpause = () => {
        playPreviewBtn.innerHTML = '<i class="fas fa-play"></i>';
        const waveBars = previewWaveform.querySelectorAll('.wave-bar');
        waveBars.forEach(bar => {
            bar.style.animation = 'none';
        });
    };
    
    cancelPreviewBtn.addEventListener('click', (e) => {
        e.preventDefault();
        audio.pause();
        URL.revokeObjectURL(audioUrl);
        currentlyPlayingAudio = null;
        previewModal.style.display = 'none';
        resetMediaButtons();
    });
    
    sendPreviewBtn.addEventListener('click', (e) => {
        e.preventDefault();
        audio.pause();
        URL.revokeObjectURL(audioUrl);
        currentlyPlayingAudio = null;
        
        pendingAudioBlob = audioBlob;
        
        const voiceFile = new File([audioBlob], `voice-note-${Date.now()}.mp3`, { 
            type: 'audio/mp3'
        });
        
        showAttachmentPreview(voiceFile);
        previewModal.style.display = 'none';
        updateSubmitButton();
        
        console.log('Voice note saved for posting');
        showNotification('Voice note ready! You can add text and post.', 'success');
    });
}

function updateSubmitButton() {
    const submitBtn = document.getElementById('submitBtn');
    const gistContent = document.getElementById('gistContent');
    
    if (!submitBtn) return;
    
    const hasMedia = pendingImageFiles.length > 0 || pendingAudioBlob;
    const hasText = gistContent && gistContent.value.trim().length > 0;
    
    // Enable button if there's either text OR media (or both)
    submitBtn.disabled = !(hasText || hasMedia);
}

async function uploadAudioToCloudinary(audioBlob) {
    console.log('Uploading audio to Cloudinary...');
    
    const formData = new FormData();
    formData.append('file', audioBlob);
    formData.append('upload_preset', cloudinaryConfig.uploadPreset);
    formData.append('resource_type', 'auto');
    
    try {
        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/upload`,
            {
                method: 'POST',
                body: formData
            }
        );
        
        if (!response.ok) {
            throw new Error(`Upload failed: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Cloudinary upload successful:', data.secure_url);
        
        if (!data.secure_url) {
            throw new Error('No secure URL returned from Cloudinary');
        }
        
        return data.secure_url;
    } catch (error) {
        console.error('Cloudinary upload error:', error);
        throw error;
    }
}

async function uploadImageToCloudinary(file) {
    console.log('Uploading image to Cloudinary...');
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', cloudinaryConfig.uploadPreset);
    formData.append('resource_type', 'image');
    formData.append('folder', 'gist-images'); // Add folder for better organization
    
    try {
        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/upload`,
            {
                method: 'POST',
                body: formData
            }
        );
        
        if (!response.ok) {
            throw new Error(`Upload failed: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Image upload successful:', data.secure_url);
        
        return data.secure_url;
    } catch (error) {
        console.error('Image upload error:', error);
        throw error;
    }
}

function initGistPage() {
    console.log('Initializing gist page');
    
    const createGistBtn = document.getElementById('createGistBtn');
    const loadMoreBtn = document.getElementById('loadMoreGists');
    const gistsContainer = document.getElementById('gistsContainer');
    
    if (createGistBtn) {
        createGistBtn.addEventListener('click', () => {
            window.location.href = 'create-gist.html';
        });
    }
    
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
            loadGists(lastVisibleGist, 10);
        });
    }
    
    if (gistsContainer) {
        let pressTimer;
        let longPressTarget = null;
        
        gistsContainer.addEventListener('mousedown', (e) => {
            const gistCard = e.target.closest('.gist-card');
            if (gistCard) {
                longPressTarget = gistCard;
                pressTimer = setTimeout(() => {
                    showGistActionsModal(gistCard.dataset.gistId);
                    longPressTarget = null;
                }, 800);
            }
        });
        
        gistsContainer.addEventListener('mouseup', () => {
            clearTimeout(pressTimer);
        });
        
        gistsContainer.addEventListener('mouseleave', () => {
            clearTimeout(pressTimer);
        });
        
        gistsContainer.addEventListener('touchstart', (e) => {
            const gistCard = e.target.closest('.gist-card');
            if (gistCard) {
                longPressTarget = gistCard;
                pressTimer = setTimeout(() => {
                    showGistActionsModal(gistCard.dataset.gistId);
                    longPressTarget = null;
                }, 800);
            }
        });
        
        gistsContainer.addEventListener('touchend', () => {
            clearTimeout(pressTimer);
        });
        
        gistsContainer.addEventListener('touchmove', () => {
            clearTimeout(pressTimer);
        });
    }
    
    loadGists();
    
    console.log('Gist page initialized');
}

async function loadGists(lastVisible = null, limitCount = 10) {
    console.log('Loading gists...');
    
    const gistsContainer = document.getElementById('gistsContainer');
    const loadMoreBtn = document.getElementById('loadMoreGists');
    
    if (!gistsContainer || isLoading) return;
    
    isLoading = true;
    
    try {
        let q;
        if (lastVisible) {
            q = query(
                collection(db, 'gists'),
                orderBy('timestamp', 'desc'),
                startAfter(lastVisible),
                limit(limitCount)
            );
        } else {
            q = query(
                collection(db, 'gists'),
                orderBy('timestamp', 'desc'),
                limit(limitCount)
            );
        }
        
        const querySnapshot = await getDocs(q);
        console.log(`Loaded ${querySnapshot.size} gists`);
        
        if (querySnapshot.empty) {
            if (lastVisible === null) {
                gistsContainer.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-file-alt fa-3x" style="margin-bottom: 15px; color: #b3004b;"></i>
                        <h3 class="empty-title">No gists yet</h3>
                        <p class="empty-text">Be the first to share an anonymous post!</p>
                        <button class="create-gist-btn" onclick="window.location.href='create-gist.html'">
                            <i class="fas fa-plus"></i> Create Gist
                        </button>
                    </div>
                `;
            }
            if (loadMoreBtn) loadMoreBtn.style.display = 'none';
            return;
        }
        
        const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
        lastVisibleGist = lastDoc;
        
        if (lastVisible === null) {
            gistsContainer.innerHTML = '';
        }
        
        querySnapshot.forEach((doc) => {
            const gist = { id: doc.id, ...doc.data() };
            console.log('Gist data:', gist);
            if (!document.querySelector(`[data-gist-id="${gist.id}"]`)) {
                displayGist(gist);
            }
        });
        
        if (loadMoreBtn) {
            loadMoreBtn.style.display = 'block';
            loadMoreBtn.innerHTML = '<i class="fas fa-plus"></i> Load More';
        }
        
    } catch (error) {
        console.error('Error loading gists:', error);
        showNotification('Error loading gists: ' + error.message, 'error');
        
        if (lastVisible === null) {
            gistsContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle fa-3x" style="margin-bottom: 15px; color: #dc3545;"></i>
                    <h3 class="empty-title">Error loading gists</h3>
                    <p class="empty-text">Please try again later.</p>
                </div>
            `;
        }
    } finally {
        isLoading = false;
    }
}

// Updated displayGist function to handle multiple photos
function displayGist(gist) {
    const gistsContainer = document.getElementById('gistsContainer');
    if (!gistsContainer) return;
    
    const timeAgo = gist.timestamp ? formatTime(gist.timestamp) : 'Just now';
    const isReposted = gist.repostedFrom || gist.originalPostId;
    const avatarContainerStyle = isReposted ? 'style="border-color:#b3004b;background-color: #b3004b20;"' : '';
    const repostIcon = isReposted ? '<div class="repost-icon"><i class="fas fa-retweet"></i></div>' : '';
    
    const containsVoiceNote = gist.containsVoiceNote || gist.mediaType === 'audio' || gist.mediaType === 'both';
    
    // Use display name if available, otherwise use Anonymous
    const authorName = gist.authorDisplayName || `Anonymous${gist.anonymousUserId ? ' ' + gist.anonymousUserId.substring(gist.anonymousUserId.length - 4) : ''}`;
    
    let mediaContent = '';
    
    // Handle multiple images
    if (gist.imageUrls && gist.imageUrls.length > 0) {
        const imageUrls = gist.imageUrls;
        
        if (imageUrls.length === 1) {
            // Single image
            mediaContent = `
                <div class="gist-media">
                    <img src="${imageUrls[0]}" alt="Gist image" class="gist-image" 
                         onclick="window.location.href='photos.html?gistId=${gist.id}'"
                         style="cursor: pointer; max-width: 100%; border-radius: 10px; margin-top: 10px;">
                </div>
            `;
        } else {
            // Multiple images in grid
            const gridClass = getGridClass(imageUrls.length);
            mediaContent = `
                <div class="gist-media">
                    <div class="photos-grid-preview ${gridClass}" style="margin-top: 10px;">
                        ${imageUrls.slice(0, 4).map((url, index) => `
                            <div class="photo-grid-item" onclick="window.location.href='photos.html?gistId=${gist.id}'"
                                 style="cursor: pointer; position: relative; overflow: hidden; border-radius: 8px;">
                                <img src="${url}" alt="Photo ${index + 1}" 
                                     style="width: 100%; height: 100%; object-fit: cover;">
                                ${index === 3 && imageUrls.length > 4 ? `
                                    <div class="more-photos-overlay" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; color: white; font-size: 18px; font-weight: bold;">
                                        +${imageUrls.length - 4}
                                    </div>
                                ` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
    } else if (gist.mediaType === 'both' && gist.mediaUrl && gist.secondMediaUrl) {
        const duration = gist.duration ? formatDuration(gist.duration) : '0:00';
        mediaContent = `
            <div class="gist-media">
                <img src="${gist.secondMediaUrl}" alt="Gist image" class="gist-image" 
                     onerror="this.onerror=null; this.style.display='none';">
                <div class="gist-voice-note" style="margin-top: 10px;">
                    <button class="voice-play-btn" data-audio-url="${gist.mediaUrl}">
                        <i class="fas fa-play"></i>
                    </button>
                    <div class="voice-waveform">
                        <div class="wave-bar"></div>
                        <div class="wave-bar"></div>
                        <div class="wave-bar"></div>
                        <div class="wave-bar"></div>
                        <div class="wave-bar"></div>
                    </div>
                    <span class="voice-duration">${duration}</span>
                </div>
            </div>
        `;
    } else if (gist.mediaType === 'image' && gist.mediaUrl) {
        mediaContent = `
            <div class="gist-media">
                <img src="${gist.mediaUrl}" alt="Gist image" class="gist-image" 
                     onerror="this.onerror=null; this.style.display='none';">
            </div>
        `;
    } else if (gist.mediaType === 'audio' && gist.mediaUrl) {
        const duration = gist.duration ? formatDuration(gist.duration) : '0:00';
        mediaContent = `
            <div class="gist-media">
                <div class="gist-voice-note">
                    <button class="voice-play-btn" data-audio-url="${gist.mediaUrl}">
                        <i class="fas fa-play"></i>
                    </button>
                    <div class="voice-waveform">
                        <div class="wave-bar"></div>
                        <div class="wave-bar"></div>
                        <div class="wave-bar"></div>
                        <div class="wave-bar"></div>
                        <div class="wave-bar"></div>
                    </div>
                    <span class="voice-duration">${duration}</span>
                </div>
            </div>
        `;
    }
    
    // Show hashtags if any
    let hashtagsContent = '';
    if (gist.hashtags && gist.hashtags.length > 0) {
        const hashtagList = gist.hashtags.slice(0, 5).map(tag => 
            `<a href="hashtags.html?tag=${tag}" class="hashtag-link">#${tag}</a>`
        ).join(' ');
        hashtagsContent = `
            <div class="gist-hashtags" style="margin-top: 10px; display: flex; flex-wrap: wrap; gap: 5px;">
                ${hashtagList}
                ${gist.hashtags.length > 5 ? `<span class="more-hashtags" style="color: #666; font-size: 12px;">+${gist.hashtags.length - 5} more</span>` : ''}
            </div>
        `;
    }
    
    const gistElement = document.createElement('div');
    gistElement.className = 'gist-card';
    gistElement.dataset.gistId = gist.id;
    gistElement.innerHTML = `
        <div class="gist-header">
            <div class="gist-avatar-container" ${avatarContainerStyle}>
                <img src="${gist.authorAvatar}" alt="Anonymous avatar" class="gist-avatar">
                <div class="gist-avatar-pointer"></div>
                ${repostIcon}
            </div>
            <div class="gist-info">
                <span class="gist-author">${authorName}${isReposted ? ' (Reposted)' : ''}</span>
                <span class="gist-time">${timeAgo}</span>
            </div>
        </div>
        
        <div class="gist-content">
            ${gist.content ? `<div class="gist-text">${processHashtagsInText(escapeHtml(gist.content))}</div>` : ''}
            ${hashtagsContent}
            ${mediaContent}
        </div>
        
        <div class="gist-actions">
            <button class="gist-action-btn like-btn" data-gist-id="${gist.id}">
                <i class="fas fa-heart"></i>
                <span class="action-count">${gist.likes || 0}</span>
            </button>
            
            <button class="gist-action-btn comment-btn" data-gist-id="${gist.id}">
                <i class="fas fa-comment"></i>
                <span class="action-count">${gist.comments || 0}</span>
            </button>
            
            <button class="gist-action-btn highlight-btn" data-gist-id="${gist.id}">
                <i class="fas fa-bookmark"></i>
                <span class="action-count">${gist.highlights || 0}</span>
            </button>
            
            <button class="gist-action-btn repost-btn" data-gist-id="${gist.id}" 
                    ${containsVoiceNote ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
                <i class="fas fa-retweet"></i>
                <span class="action-count">${gist.reposts || 0}</span>
            </button>
            
            <button class="gist-action-btn share-btn" data-gist-id="${gist.id}">
                <i class="fas fa-share"></i>
            </button>
        </div>
    `;
    
    const likeBtn = gistElement.querySelector('.like-btn');
    const commentBtn = gistElement.querySelector('.comment-btn');
    const highlightBtn = gistElement.querySelector('.highlight-btn');
    const repostBtn = gistElement.querySelector('.repost-btn');
    const shareBtn = gistElement.querySelector('.share-btn');
    const voicePlayBtn = gistElement.querySelector('.voice-play-btn');
    
    if (likeBtn) {
        likeBtn.addEventListener('click', () => likeGist(gist.id, likeBtn));
        if (currentUser && gist.likedBy && gist.likedBy.includes(currentUser.uid)) {
            likeBtn.classList.add('liked');
        }
    }
    
    if (commentBtn) {
        commentBtn.addEventListener('click', () => {
            window.location.href = `comments.html?gistId=${gist.id}`;
        });
    }
    
    if (highlightBtn) {
        highlightBtn.addEventListener('click', () => highlightGist(gist.id, highlightBtn));
        if (currentUser && gist.highlightedBy && gist.highlightedBy.includes(currentUser.uid)) {
            highlightBtn.classList.add('highlighted');
        }
    }
    
    if (repostBtn) {
        if (!containsVoiceNote) {
            repostBtn.addEventListener('click', () => repostGist(gist.id, repostBtn));
        }
        if (currentUser && gist.repostedBy && gist.repostedBy.includes(currentUser.uid)) {
            repostBtn.classList.add('reposted');
        }
    }
    
    if (shareBtn) {
        shareBtn.addEventListener('click', () => shareGist(gist.id, shareBtn));
    }
    
    if (voicePlayBtn && gist.mediaUrl && (gist.mediaType === 'audio' || gist.mediaType === 'both')) {
        voicePlayBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            playGistVoice(gist.mediaUrl, voicePlayBtn, gistElement.querySelector('.voice-waveform'));
        });
    }
    
    gistsContainer.appendChild(gistElement);
}

// Helper function to determine grid class based on number of images
function getGridClass(count) {
    if (count === 1) return 'grid-1';
    if (count === 2) return 'grid-2';
    if (count === 3) return 'grid-3';
    return 'grid-4'; // 4 or more
}

function initCommentsPage() {
    console.log('Initializing comments page');
    
    const urlParams = new URLSearchParams(window.location.search);
    const gistId = urlParams.get('gistId');
    
    if (!gistId) {
        window.location.href = 'gist.html';
        return;
    }
    
    const backBtn = document.getElementById('backBtn');
    const commentForm = document.getElementById('commentForm');
    const commentInput = document.getElementById('commentInput');
    const submitCommentBtn = document.getElementById('submitCommentBtn');
    const commentsList = document.getElementById('commentsList');
    const gistContent = document.getElementById('gistContent');
    
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.history.back();
        });
    }
    
    // Load the gist
    loadGistForComments(gistId);
    
    // Load comments
    loadCommentsForPage(gistId);
    
    // Handle comment submission
    if (commentForm && commentInput && submitCommentBtn) {
        commentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const commentText = commentInput.value.trim();
            if (!commentText) {
                showNotification('Please enter a comment', 'warning');
                return;
            }
            
            if (!currentUser) {
                showNotification('Please login to comment', 'warning');
                return;
            }
            
            try {
                submitCommentBtn.disabled = true;
                submitCommentBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Posting...';
                
                await postComment(gistId, commentText);
                
                commentInput.value = '';
                await loadCommentsForPage(gistId);
                
                // Update comment count in main page if we came from there
                updateCommentCount(gistId);
                
            } catch (error) {
                console.error('Error posting comment:', error);
                showNotification('Failed to post comment: ' + error.message, 'error');
            } finally {
                submitCommentBtn.disabled = false;
                submitCommentBtn.innerHTML = 'Post';
            }
        });
    }
}

async function loadGistForComments(gistId) {
    try {
        const gistRef = doc(db, 'gists', gistId);
        const gistSnap = await getDoc(gistRef);
        
        if (!gistSnap.exists()) {
            showNotification('Gist not found', 'error');
            window.history.back();
            return;
        }
        
        const gist = { id: gistSnap.id, ...gistSnap.data() };
        const gistContent = document.getElementById('gistContent');
        
        if (!gistContent) return;
        
        const timeAgo = gist.timestamp ? formatTime(gist.timestamp) : 'Just now';
        const authorName = gist.authorDisplayName || `Anonymous${gist.anonymousUserId ? ' ' + gist.anonymousUserId.substring(gist.anonymousUserId.length - 4) : ''}`;
        
        let mediaContent = '';
        if (gist.mediaType === 'image' && gist.mediaUrl) {
            mediaContent = `
                <div class="gist-media">
                    <img src="${gist.mediaUrl}" alt="Gist image" class="gist-image" 
                         style="max-width: 100%; border-radius: 10px; margin-top: 10px;">
                </div>
            `;
        } else if (gist.mediaType === 'both' && gist.secondMediaUrl) {
            mediaContent = `
                <div class="gist-media">
                    <img src="${gist.secondMediaUrl}" alt="Gist image" class="gist-image" 
                         style="max-width: 100%; border-radius: 10px; margin-top: 10px;">
                    <div style="margin-top: 10px; color: #666; font-size: 14px;">
                        <i class="fas fa-microphone"></i> Voice note included
                    </div>
                </div>
            `;
        } else if (gist.mediaType === 'audio' && gist.mediaUrl) {
            mediaContent = `
                <div class="gist-media">
                    <div style="margin-top: 10px; color: #666; font-size: 14px;">
                        <i class="fas fa-microphone"></i> Voice note included
                    </div>
                </div>
            `;
        }
        
        gistContent.innerHTML = `
            <div class="gist-header" style="display: flex; align-items: center; margin-bottom: 15px;">
                <img src="${gist.authorAvatar}" alt="Avatar" 
                     style="width: 50px; height: 50px; border-radius: 50%; border: 2px solid #b3004b; margin-right: 15px;">
                <div>
                    <div style="font-weight: bold; font-size: 16px;">${authorName}</div>
                    <div style="color: #666; font-size: 14px;">${timeAgo}</div>
                </div>
            </div>
            
            ${gist.content ? `
                <div class="gist-text" style="font-size: 16px; line-height: 1.6; color: #333;">
                    ${processHashtagsInText(escapeHtml(gist.content))}
                </div>
            ` : ''}
            
            ${mediaContent}
            
            <div class="gist-stats" style="display: flex; justify-content: space-around; margin-top: 20px; padding-top: 15px; border-top: 1px solid #eee;">
                <div style="text-align: center;">
                    <div style="font-size: 18px; font-weight: bold; color: #b3004b;">${gist.likes || 0}</div>
                    <div style="font-size: 12px; color: #666;">Likes</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 18px; font-weight: bold; color: #b3004b;">${gist.comments || 0}</div>
                    <div style="font-size: 12px; color: #666;">Comments</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 18px; font-weight: bold; color: #b3004b;">${gist.reposts || 0}</div>
                    <div style="font-size: 12px; color: #666;">Shares</div>
                </div>
            </div>
        `;
        
    } catch (error) {
        console.error('Error loading gist for comments:', error);
        showNotification('Error loading gist', 'error');
    }
}

async function loadCommentsForPage(gistId) {
    const commentsList = document.getElementById('commentsList');
    if (!commentsList) return;
    
    commentsList.innerHTML = `
        <div class="loading-state">
            <i class="fas fa-spinner fa-spin fa-2x"></i>
            <p>Loading comments...</p>
        </div>
    `;
    
    try {
        const commentsQuery = query(
            collection(db, 'gists', gistId, 'comments'),
            orderBy('timestamp', 'desc')
        );
        
        const commentsSnap = await getDocs(commentsQuery);
        
        if (commentsSnap.empty) {
            commentsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-comments fa-3x" style="color: #b3004b; margin-bottom: 15px;"></i>
                    <h3 style="color: #333; margin-bottom: 10px;">No comments yet</h3>
                    <p style="color: #666;">Be the first to comment!</p>
                </div>
            `;
            return;
        }
        
        commentsList.innerHTML = '';
        
        commentsSnap.forEach((doc) => {
            const comment = doc.data();
            const commentElement = document.createElement('div');
            commentElement.className = 'comment-item';
            commentElement.style.cssText = `
                display: flex;
                padding: 15px;
                border-bottom: 1px solid #eee;
                background: white;
                border-radius: 10px;
                margin-bottom: 10px;
                box-shadow: 0 2px 5px rgba(0,0,0,0.05);
            `;
            
            const timeAgo = comment.timestamp ? formatTime(comment.timestamp) : 'Just now';
            
            commentElement.innerHTML = `
                <img src="${comment.authorAvatar || getRandomAvatar()}" alt="Avatar" 
                     style="width: 40px; height: 40px; border-radius: 50%; margin-right: 15px; border: 2px solid #b3004b;">
                <div style="flex: 1;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                        <div style="font-weight: bold; font-size: 14px; color: #333;">
                            ${comment.authorDisplayName || 'Anonymous'}
                        </div>
                        <div style="font-size: 12px; color: #666;">${timeAgo}</div>
                    </div>
                    <div style="font-size: 14px; color: #333; line-height: 1.5;">
                        ${escapeHtml(comment.content)}
                    </div>
                </div>
            `;
            commentsList.appendChild(commentElement);
        });
        
    } catch (error) {
        console.error('Error loading comments:', error);
        commentsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle fa-3x" style="color: #dc3545; margin-bottom: 15px;"></i>
                <h3 style="color: #333; margin-bottom: 10px;">Error loading comments</h3>
                <p style="color: #666;">Please try again later.</p>
            </div>
        `;
    }
}

async function postComment(gistId, content) {
    if (!currentUser) {
        throw new Error('User not logged in');
    }
    
    try {
        const userIdentity = await getUserIdentity();
        
        const commentData = {
            content: content,
            authorId: currentUser.uid,
            anonymousUserId: userIdentity.id,
            authorAvatar: userIdentity.avatar,
            authorDisplayName: userIdentity.displayName,
            timestamp: serverTimestamp(),
            createdAt: new Date().toISOString()
        };
        
        await addDoc(collection(db, 'gists', gistId, 'comments'), commentData);
        
        const gistRef = doc(db, 'gists', gistId);
        await runTransaction(db, async (transaction) => {
            const gistDoc = await transaction.get(gistRef);
            if (!gistDoc.exists()) {
                throw new Error('Gist not found');
            }
            
            const currentComments = gistDoc.data().comments || 0;
            transaction.update(gistRef, {
                comments: currentComments + 1
            });
        });
        
        console.log('Comment posted successfully');
        showNotification('Comment posted!', 'success');
        
    } catch (error) {
        console.error('Error posting comment:', error);
        throw error;
    }
}

function updateCommentCount(gistId) {
    // This function can be called to update the comment count in the main page
    const commentBtn = document.querySelector(`[data-gist-id="${gistId}"] .comment-btn .action-count`);
    if (commentBtn) {
        const currentCount = parseInt(commentBtn.textContent) || 0;
        commentBtn.textContent = currentCount + 1;
    }
}

function initGistPreviewPage() {
    console.log('Initializing gist preview page');
    
    const urlParams = new URLSearchParams(window.location.search);
    const shareId = urlParams.get('share');
    
    if (!shareId) {
        window.location.href = 'gist.html';
        return;
    }
    
    // Check if meta tags were already updated by inline script
    if (!document.getElementById('og-title').content.includes('Anonymous Gist:')) {
        // Meta tags not updated yet, update them now
        setupPreviewMetaTags(shareId);
    }
    
    loadGistForPreview(shareId);
}

async function setupPreviewMetaTags(shareId) {
    try {
        const gist = await getGistByShareId(shareId);
        
        if (!gist) {
            setDefaultMetaTags();
            return;
        }
        
        // Create dynamic title and description
        const title = gist.content ? 
            `Anonymous Gist: ${gist.content.substring(0, 60)}...` : 
            'Anonymous Gist';
        
        const description = gist.content ? 
            gist.content.substring(0, 200) : 
            'Check out this anonymous gist shared with you!';
        
        // Get image URL
        let imageUrl = null;
        let isImage = false;
        
        if (gist.mediaType === 'image' && gist.mediaUrl) {
            imageUrl = gist.mediaUrl;
            isImage = true;
        } else if (gist.mediaType === 'both' && gist.secondMediaUrl) {
            imageUrl = gist.secondMediaUrl;
            isImage = true;
        } else {
            // Fallback to avatar
            imageUrl = gist.authorAvatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=anonymous&backgroundColor=b6e3f4&radius=50';
        }
        
        console.log('Setting meta tags with image URL:', imageUrl);
        
        // Update meta tags
        updateMetaTag('og:title', title);
        updateMetaTag('og:description', description);
        updateMetaTag('og:image', imageUrl);
        updateMetaTag('og:url', window.location.href);
        updateMetaTag('og:image:width', '1200');
        updateMetaTag('og:image:height', '630');
        updateMetaTag('og:image:type', isImage ? 'image/jpeg' : 'image/svg+xml');
        
        updateMetaTag('twitter:card', isImage ? 'summary_large_image' : 'summary');
        updateMetaTag('twitter:title', title);
        updateMetaTag('twitter:description', description);
        updateMetaTag('twitter:image', imageUrl);
        
        updateMetaTag('description', description);
        
        // Update page title
        document.title = title;
        
        console.log('Meta tags updated for preview:', { 
            title, 
            description, 
            imageUrl,
            isImage 
        });
        
    } catch (error) {
        console.error('Error setting meta tags:', error);
        setDefaultMetaTags();
    }
}

function updateMetaTag(property, content) {
    let meta = document.querySelector(`meta[property="${property}"]`) || 
               document.querySelector(`meta[name="${property}"]`);
    
    if (!meta) {
        meta = document.createElement('meta');
        if (property.startsWith('og:')) {
            meta.setAttribute('property', property);
        } else if (property.startsWith('twitter:')) {
            meta.setAttribute('name', property);
        } else {
            meta.setAttribute('name', property);
        }
        document.head.appendChild(meta);
    }
    meta.setAttribute('content', content);
}

function setDefaultMetaTags() {
    const defaultAvatar = 'https://api.dicebear.com/7.x/avataaars/svg?seed=anonymous&backgroundColor=b6e3f4&radius=50';
    document.title = 'Anonymous Gist';
    
    updateMetaTag('og:title', 'Anonymous Gist');
    updateMetaTag('og:description', 'Check out this anonymous gist shared with you!');
    updateMetaTag('og:image', defaultAvatar);
    updateMetaTag('og:url', window.location.href);
    updateMetaTag('og:type', 'website');
    updateMetaTag('og:site_name', 'Anonymous Gists');
    updateMetaTag('og:image:width', '1200');
    updateMetaTag('og:image:height', '630');
    updateMetaTag('og:image:type', 'image/svg+xml');
    
    updateMetaTag('twitter:card', 'summary');
    updateMetaTag('twitter:title', 'Anonymous Gist');
    updateMetaTag('twitter:description', 'Check out this anonymous gist shared with you!');
    updateMetaTag('twitter:image', defaultAvatar);
    
    updateMetaTag('description', 'Check out this anonymous gist shared with you!');
}

async function loadGistForPreview(shareId) {
    const container = document.getElementById('gistPreviewContainer');
    
    if (!container) return;
    
    container.innerHTML = `
        <div class="loading-state">
            <div class="loading-spinner">
                <i class="fas fa-spinner fa-spin fa-2x"></i>
            </div>
            <p>Loading gist preview...</p>
        </div>
    `;
    
    try {
        const gist = await getGistByShareId(shareId);
        
        if (!gist) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-circle fa-3x"></i>
                    <h3 class="empty-title">Gist Not Found</h3>
                    <p class="empty-text">This gist has been deleted or the link is invalid.</p>
                    <button class="view-app-btn" onclick="window.location.href='gist.html'">
                        <i class="fas fa-home"></i> Go to Home
                    </button>
                </div>
            `;
            return;
        }
        
        // Update view count
        await updateViewCount(gist.id);
        
        // Cache gist data for future crawler visits
        try {
            localStorage.setItem(`gist_${shareId}`, JSON.stringify(gist));
        } catch (e) {
            console.log('Could not cache gist data:', e);
        }
        
        // Display the gist preview
        displayGistPreview(gist, container);
        
        // For users (not crawlers), redirect to main view after delay
        if (!isCrawler()) {
            setTimeout(() => {
                window.location.href = `gist-view.html?share=${shareId}`;
            }, 3000);
        }
        
    } catch (error) {
        console.error('Error loading gist:', error);
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle fa-3x"></i>
                <h3 class="empty-title">Error Loading Gist</h3>
                <p class="empty-text">Please try again later.</p>
                <button class="view-app-btn" onclick="window.location.href='gist.html'">
                    <i class="fas fa-home"></i> Go to Home
                </button>
            </div>
        `;
    }
}

async function updateViewCount(gistId) {
    try {
        const gistRef = doc(db, 'gists', gistId);
        await runTransaction(db, async (transaction) => {
            const gistDoc = await transaction.get(gistRef);
            if (!gistDoc.exists()) {
                return;
            }
            
            const currentViews = gistDoc.data().viewCount || 0;
            transaction.update(gistRef, {
                viewCount: currentViews + 1
            });
        });
    } catch (error) {
        console.error('Error updating view count:', error);
    }
}

function isCrawler() {
    const userAgent = navigator.userAgent.toLowerCase();
    const crawlers = [
        'whatsapp', 'telegram', 'facebook', 'twitter', 'slack',
        'discord', 'linkedin', 'pinterest', 'reddit', 'tumblr',
        'googlebot', 'bingbot', 'slurp', 'duckduckbot', 'baiduspider',
        'yandexbot', 'sogou', 'exabot', 'facebot', 'ia_archiver'
    ];
    
    return crawlers.some(crawler => userAgent.includes(crawler));
}

function displayGistPreview(gist, container) {
    const timeAgo = gist.timestamp ? formatTime(gist.timestamp) : 'Just now';
    const isReposted = gist.repostedFrom || gist.originalPostId;
    const authorName = gist.authorDisplayName || `Anonymous${gist.anonymousUserId ? ' ' + gist.anonymousUserId.substring(gist.anonymousUserId.length - 4) : ''}`;
    
    let mediaContent = '';
    
    // Check if gist has an image
    if ((gist.mediaType === 'image' && gist.mediaUrl) || 
        (gist.mediaType === 'both' && gist.secondMediaUrl)) {
        const imageUrl = gist.mediaType === 'both' ? gist.secondMediaUrl : gist.mediaUrl;
        mediaContent = `
            <div class="preview-media">
                <img src="${imageUrl}" alt="Gist image" 
                     style="width: 100%; max-height: 400px; object-fit: cover; border-radius: 10px; margin-top: 15px;">
                ${gist.mediaType === 'both' ? `
                    <div class="voice-indicator" style="display: flex; align-items: center; gap: 10px; margin-top: 10px; padding: 10px; background: #f5f5f5; border-radius: 10px;">
                        <i class="fas fa-microphone" style="color: #b3004b;"></i>
                        <span>Voice message included</span>
                    </div>
                ` : ''}
            </div>
        `;
    } else if (gist.mediaType === 'audio' && gist.mediaUrl) {
        mediaContent = `
            <div class="preview-media">
                <div class="voice-indicator" style="display: flex; align-items: center; gap: 10px; margin-top: 15px; padding: 15px; background: #f5f5f5; border-radius: 10px;">
                    <i class="fas fa-microphone fa-2x" style="color: #b3004b;"></i>
                    <div>
                        <div style="font-weight: bold;">Voice Message</div>
                        <div style="color: #666; font-size: 14px;">Click to listen in app</div>
                    </div>
                </div>
            </div>
        `;
    }
    
    const previewHTML = `
        <div class="gist-preview-card" style="max-width: 800px; margin: 0 auto; padding: 20px;">
            <div class="preview-header" style="display: flex; align-items: center; margin-bottom: 20px;">
                <div style="position: relative; margin-right: 15px;">
                    <img src="${gist.authorAvatar}" alt="Anonymous" 
                         style="width: 60px; height: 60px; border-radius: 50%; border: 3px solid #b3004b;">
                    ${isReposted ? '<div style="position: absolute; top: -5px; right: -5px; background: #b3004b; color: white; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px;"><i class="fas fa-retweet"></i></div>' : ''}
                </div>
                <div>
                    <div style="font-weight: bold; font-size: 18px; color: #333;">
                        ${authorName}${isReposted ? ' (Reposted)' : ''}
                    </div>
                    <div style="color: #666; font-size: 14px; margin-top: 5px;">
                        ${timeAgo}
                    </div>
                </div>
            </div>
            
            ${gist.content ? `
                <div class="preview-content" style="font-size: 16px; line-height: 1.6; color: #333; margin-bottom: 20px;">
                    ${processHashtagsInText(escapeHtml(gist.content))}
                </div>
            ` : ''}
            
            ${mediaContent}
            
            <div class="preview-stats" style="display: flex; justify-content: space-around; margin-top: 25px; padding-top: 20px; border-top: 1px solid #eee;">
                <div style="text-align: center;">
                    <div style="font-size: 20px; font-weight: bold; color: #b3004b;">
                        ${gist.likes || 0}
                    </div>
                    <div style="font-size: 14px; color: #666; margin-top: 5px;">Likes</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 20px; font-weight: bold; color: #b3004b;">
                        ${gist.comments || 0}
                    </div>
                    <div style="font-size: 14px; color: #666; margin-top: 5px;">Comments</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 20px; font-weight: bold; color: #b3004b;">
                        ${gist.reposts || 0}
                    </div>
                    <div style="font-size: 14px; color: #666; margin-top: 5px;">Shares</div>
                </div>
            </div>
            
            <div class="preview-footer" style="text-align: center; margin-top: 25px; padding-top: 20px; border-top: 1px solid #eee;">
                <div style="color: #b3004b; font-weight: bold; font-size: 18px; margin-bottom: 10px;">
                    <i class="fas fa-file-alt"></i> Anonymous Gists
                </div>
                <div style="color: #666; font-size: 14px; margin-bottom: 20px;">
                    Share anonymous thoughts with friends
                </div>
                ${!isCrawler() ? `
                    <div style="font-size: 12px; color: #888;">
                        Opening in app...
                    </div>
                ` : ''}
            </div>
        </div>
    `;
    
    container.innerHTML = previewHTML;
    
    if (!isCrawler()) {
        const redirectNotice = document.createElement('div');
        redirectNotice.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            right: 20px;
            background: #b3004b;
            color: white;
            padding: 15px;
            border-radius: 10px;
            text-align: center;
            font-size: 14px;
            z-index: 1000;
            box-shadow: 0 5px 20px rgba(179, 0, 75, 0.3);
        `;
        redirectNotice.innerHTML = `
            <div>Opening gist in app...</div>
            <div style="font-size: 12px; opacity: 0.9; margin-top: 5px;">
                <i class="fas fa-spinner fa-spin"></i> Redirecting in 3 seconds
            </div>
        `;
        document.body.appendChild(redirectNotice);
    }
}

function initGistViewPage() {
    console.log('Initializing gist view page');
    
    const urlParams = new URLSearchParams(window.location.search);
    const shareId = urlParams.get('share');
    
    if (!shareId) {
        window.location.href = 'gist.html';
        return;
    }
    
    loadGistForView(shareId);
}

async function loadGistForView(shareId) {
    const container = document.getElementById('gistViewContainer');
    
    if (!container) return;
    
    container.innerHTML = `
        <div class="loading-state">
            <div class="loading-spinner">
                <i class="fas fa-spinner fa-spin fa-2x"></i>
            </div>
            <p>Loading gist...</p>
        </div>
    `;
    
    try {
        const gist = await getGistByShareId(shareId);
        
        if (!gist) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-circle fa-3x"></i>
                    <h3 class="empty-title">Gist Not Found</h3>
                    <p class="empty-text">This gist has been deleted or the link is invalid.</p>
                    <button class="view-app-btn" onclick="window.location.href='gist.html'">
                        <i class="fas fa-home"></i> Go to Home
                    </button>
                </div>
            `;
            return;
        }
        
        displayGistView(gist, container);
        
    } catch (error) {
        console.error('Error loading gist:', error);
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle fa-3x"></i>
                <h3 class="empty-title">Error Loading Gist</h3>
                <p class="empty-text">Please try again later.</p>
                <button class="view-app-btn" onclick="window.location.href='gist.html'">
                    <i class="fas fa-home"></i> Go to Home
                </button>
            </div>
        `;
    }
}

function displayGistView(gist, container) {
    const timeAgo = gist.timestamp ? formatTime(gist.timestamp) : 'Just now';
    const isReposted = gist.repostedFrom || gist.originalPostId;
    const authorName = gist.authorDisplayName || `Anonymous${gist.anonymousUserId ? ' ' + gist.anonymousUserId.substring(gist.anonymousUserId.length - 4) : ''}`;
    
    let mediaContent = '';
    
    if (gist.mediaType === 'both' && gist.mediaUrl && gist.secondMediaUrl) {
        const duration = gist.duration ? formatDuration(gist.duration) : '0:00';
        mediaContent = `
            <div class="gist-media">
                <img src="${gist.secondMediaUrl}" alt="Gist image" class="gist-image" 
                     style="max-width: 100%; border-radius: 10px; margin-top: 15px;">
                <div class="gist-voice-note" style="margin-top: 15px;">
                    <button class="voice-play-btn" data-audio-url="${gist.mediaUrl}">
                        <i class="fas fa-play"></i>
                    </button>
                    <div class="voice-waveform">
                        <div class="wave-bar"></div>
                        <div class="wave-bar"></div>
                        <div class="wave-bar"></div>
                        <div class="wave-bar"></div>
                        <div class="wave-bar"></div>
                    </div>
                    <span class="voice-duration">${duration}</span>
                </div>
            </div>
        `;
    } else if (gist.mediaType === 'image' && gist.mediaUrl) {
        mediaContent = `
            <div class="gist-media">
                <img src="${gist.mediaUrl}" alt="Gist image" class="gist-image" 
                     style="max-width: 100%; border-radius: 10px; margin-top: 15px;">
            </div>
        `;
    } else if (gist.mediaType === 'audio' && gist.mediaUrl) {
        const duration = gist.duration ? formatDuration(gist.duration) : '0:00';
        mediaContent = `
            <div class="gist-media">
                <div class="gist-voice-note">
                    <button class="voice-play-btn" data-audio-url="${gist.mediaUrl}">
                        <i class="fas fa-play"></i>
                    </button>
                    <div class="voice-waveform">
                        <div class="wave-bar"></div>
                        <div class="wave-bar"></div>
                        <div class="wave-bar"></div>
                        <div class="wave-bar"></div>
                        <div class="wave-bar"></div>
                    </div>
                    <span class="voice-duration">${duration}</span>
                </div>
            </div>
        `;
    }
    
    const viewHTML = `
        <div class="gist-card-view">
            <div class="gist-header" style="display: flex; align-items: center; margin-bottom: 20px;">
                <div class="gist-avatar-container" style="position: relative; margin-right: 15px;">
                    <img src="${gist.authorAvatar}" alt="Anonymous avatar" 
                         style="width: 60px; height: 60px; border-radius: 50%; border: 3px solid #b3004b;">
                    ${isReposted ? '<div style="position: absolute; top: -5px; right: -5px; background: #b3004b; color: white; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px;"><i class="fas fa-retweet"></i></div>' : ''}
                </div>
                <div class="gist-info">
                    <div class="gist-author" style="font-weight: bold; font-size: 18px; color: #333;">
                        ${authorName}${isReposted ? ' (Reposted)' : ''}
                    </div>
                    <div class="gist-time" style="color: #666; font-size: 14px; margin-top: 5px;">
                        ${timeAgo}
                    </div>
                </div>
            </div>
            
            <div class="gist-content">
                ${gist.content ? `
                    <div class="gist-text" style="font-size: 16px; line-height: 1.6; color: #333; margin-bottom: 20px;">
                        ${processHashtagsInText(escapeHtml(gist.content))}
                    </div>
                ` : ''}
                ${mediaContent}
            </div>
            
            <div class="gist-stats" style="display: flex; justify-content: space-around; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                <div class="stat-item" style="text-align: center;">
                    <div class="stat-count" style="font-size: 20px; font-weight: bold; color: #b3004b;">
                        ${gist.likes || 0}
                    </div>
                    <div class="stat-label" style="font-size: 14px; color: #666; margin-top: 5px;">
                        Likes
                    </div>
                </div>
                <div class="stat-item" style="text-align: center;">
                    <div class="stat-count" style="font-size: 20px; font-weight: bold; color: #b3004b;">
                        ${gist.comments || 0}
                    </div>
                    <div class="stat-label" style="font-size: 14px; color: #666; margin-top: 5px;">
                        Comments
                    </div>
                </div>
                <div class="stat-item" style="text-align: center;">
                    <div class="stat-count" style="font-size: 20px; font-weight: bold; color: #b3004b;">
                        ${gist.reposts || 0}
                    </div>
                    <div class="stat-label" style="font-size: 14px; color: #666; margin-top: 5px;">
                        Shares
                    </div>
                </div>
            </div>
            
            <div class="view-actions" style="margin-top: 30px; text-align: center;">
                <button class="view-app-btn" onclick="window.location.href='gist.html'"
                        style="background: #b3004b; color: white; border: none; padding: 12px 30px; 
                               border-radius: 25px; font-size: 16px; cursor: pointer; font-weight: bold;">
                    <i class="fas fa-rocket"></i> Open in App
                </button>
                <p style="color: #666; margin-top: 15px; font-size: 14px;">
                    Share anonymous gists with your friends!
                </p>
            </div>
        </div>
    `;
    
    container.innerHTML = viewHTML;
    
    const voicePlayBtn = container.querySelector('.voice-play-btn');
    if (voicePlayBtn && gist.mediaUrl && (gist.mediaType === 'audio' || gist.mediaType === 'both')) {
        voicePlayBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            playGistVoice(gist.mediaUrl, voicePlayBtn, container.querySelector('.voice-waveform'));
        });
    }
}

async function shareGist(gistId, button = null) {
    try {
        showNotification('Generating share link...', 'info');
        
        const shareInfo = await generateGistLink(gistId);
        const shareUrl = shareInfo.url;
        
        console.log('Share URL:', shareUrl);
        
        const gistRef = doc(db, 'gists', gistId);
        const gistSnap = await getDoc(gistRef);
        
        if (!gistSnap.exists()) {
            throw new Error('Gist not found');
        }
        
        const gistData = gistSnap.data();
        
        // Create better share text that includes image indication
        let shareText = '';
        if (gistData.content) {
            shareText = `📝 *Anonymous Gist*\n\n"${gistData.content.substring(0, 100)}${gistData.content.length > 100 ? '...' : ''}"`;
        } else {
            shareText = `📝 *Anonymous Gist*`;
        }
        
        // Add media indicator
        if (gistData.mediaType === 'image' && gistData.mediaUrl) {
            shareText += '\n\n🖼️ *Includes an image*';
        } else if (gistData.mediaType === 'both' && gistData.secondMediaUrl) {
            shareText += '\n\n🖼️ *Includes an image and voice note*';
        } else if (gistData.mediaType === 'audio' && gistData.mediaUrl) {
            shareText += '\n\n🎤 *Includes a voice note*';
        }
        
        shareText += `\n\n👉 Open to view: ${shareUrl}`;
        
        // Try Web Share API first
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Anonymous Gist',
                    text: shareText,
                    url: shareUrl
                });
                showNotification('Shared successfully!', 'success');
                return;
            } catch (shareError) {
                console.log('Web Share cancelled or failed:', shareError);
            }
        }
        
        // Show share modal with direct WhatsApp/Telegram buttons
        showShareModal(shareUrl, gistId, gistData, shareText);
        
    } catch (error) {
        console.error('Error sharing gist:', error);
        showNotification('Failed to share: ' + error.message, 'error');
    }
}

function showShareModal(shareUrl, gistId, gistData, shareText) {
    let modal = document.getElementById('shareModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'shareModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 400px; border-radius: 20px;">
                <div class="modal-header">
                    <h3>Share Gist</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="share-preview" style="margin-bottom: 20px; padding: 15px; background: #f9f9f9; border-radius: 10px;">
                        <div style="display: flex; align-items: center; margin-bottom: 10px;">
                            <img src="${gistData.authorAvatar || getRandomAvatar()}" 
                                 style="width: 40px; height: 40px; border-radius: 50%; margin-right: 10px; border: 2px solid #b3004b;">
                            <div>
                                <div style="font-weight: bold;">Anonymous Gist</div>
                                <div style="font-size: 12px; color: #666;">Shared via Anonymous Gists</div>
                            </div>
                        </div>
                        ${gistData.content ? `
                            <div style="font-size: 14px; color: #333; margin: 10px 0;">
                                ${gistData.content.substring(0, 80)}${gistData.content.length > 80 ? '...' : ''}
                            </div>
                        ` : ''}
                        ${(gistData.mediaType === 'image' || gistData.mediaType === 'both') ? `
                            <div style="font-size: 12px; color: #b3004b; margin-top: 5px;">
                                <i class="fas fa-image"></i> Contains image
                            </div>
                        ` : ''}
                        ${(gistData.mediaType === 'audio' || gistData.mediaType === 'both') ? `
                            <div style="font-size: 12px; color: #b3004b; margin-top: 5px;">
                                <i class="fas fa-microphone"></i> Contains voice note
                            </div>
                        ` : ''}
                    </div>
                    
                    <div class="share-url-container" style="margin-bottom: 20px;">
                        <input type="text" id="shareUrlInput" readonly 
                               style="width: 100%; padding: 12px; border: 1px solid #ddd; 
                                      border-radius: 10px; font-size: 14px; margin-bottom: 10px;">
                        <button id="copyUrlBtn" 
                                style="width: 100%; padding: 12px; background: #b3004b; 
                                       color: white; border: none; border-radius: 10px; 
                                       cursor: pointer; font-size: 16px;">
                            <i class="fas fa-copy"></i> Copy Link
                        </button>
                    </div>
                    
                    <div class="share-platforms" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 20px;">
                        <button class="platform-btn whatsapp-btn" data-platform="whatsapp">
                            <i class="fab fa-whatsapp"></i> WhatsApp
                        </button>
                        <button class="platform-btn telegram-btn" data-platform="telegram">
                            <i class="fab fa-telegram"></i> Telegram
                        </button>
                        <button class="platform-btn" data-platform="copy">
                            <i class="fas fa-copy"></i> Copy Text
                        </button>
                        <button class="platform-btn" data-platform="more">
                            <i class="fas fa-share-alt"></i> More Options
                        </button>
                    </div>
                    
                    <button id="closeShareBtn" 
                            style="width: 100%; padding: 12px; margin-top: 10px; 
                                   background: #f5f5f5; color: #333; border: none; 
                                   border-radius: 10px; cursor: pointer; font-size: 16px;">
                        Close
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        const styles = document.createElement('style');
        styles.textContent += `
            #shareModal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.5);
                display: none;
                justify-content: center;
                align-items: center;
                z-index: 10002;
            }
            .platform-btn {
                padding: 15px 10px;
                border: none;
                border-radius: 10px;
                color: white;
                cursor: pointer;
                font-size: 14px;
                font-weight: 600;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 8px;
                transition: transform 0.3s;
            }
            .platform-btn:hover {
                transform: translateY(-2px);
            }
            .platform-btn i {
                font-size: 24px;
            }
            .whatsapp-btn {
                background: #25D366;
            }
            .telegram-btn {
                background: #0088cc;
            }
            .platform-btn[data-platform="copy"] {
                background: #6c757d;
            }
            .platform-btn[data-platform="more"] {
                background: #b3004b;
            }
        `;
        document.head.appendChild(styles);
    }
    
    const urlInput = modal.querySelector('#shareUrlInput');
    if (urlInput) {
        urlInput.value = shareUrl;
    }
    
    modal.style.display = 'flex';
    
    const closeBtn = modal.querySelector('.modal-close');
    const closeShareBtn = modal.querySelector('#closeShareBtn');
    const copyUrlBtn = modal.querySelector('#copyUrlBtn');
    const platformBtns = modal.querySelectorAll('.platform-btn');
    
    const closeModal = () => {
        modal.style.display = 'none';
    };
    
    closeBtn.onclick = closeModal;
    closeShareBtn.onclick = closeModal;
    
    copyUrlBtn.onclick = async () => {
        try {
            await navigator.clipboard.writeText(shareUrl);
            showNotification('Link copied to clipboard!', 'success');
            closeModal();
        } catch (error) {
            console.error('Copy failed:', error);
            showNotification('Failed to copy link', 'error');
        }
    };
    
    platformBtns.forEach(btn => {
        btn.onclick = () => {
            const platform = btn.dataset.platform;
            if (platform === 'whatsapp') {
                const whatsappUrl = createWhatsAppPreviewUrl(gistData, shareUrl);
                window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
                closeModal();
            } else if (platform === 'telegram') {
                const telegramUrl = createTelegramPreviewUrl(gistData, shareUrl);
                window.open(telegramUrl, '_blank', 'noopener,noreferrer');
                closeModal();
            } else if (platform === 'copy') {
                navigator.clipboard.writeText(shareText)
                    .then(() => showNotification('Text copied! Paste in any app.', 'success'))
                    .catch(() => showNotification('Failed to copy text', 'error'));
                closeModal();
            } else if (platform === 'more') {
                if (navigator.share) {
                    navigator.share({
                        title: 'Anonymous Gist',
                        text: shareText,
                        url: shareUrl
                    }).catch(() => {
                        // Fallback to clipboard
                        navigator.clipboard.writeText(shareText + ' ' + shareUrl);
                        showNotification('Link copied! Share it anywhere.', 'success');
                    });
                } else {
                    navigator.clipboard.writeText(shareText + ' ' + shareUrl);
                    showNotification('Link copied! Share it anywhere.', 'success');
                }
                closeModal();
            }
        };
    });
    
    modal.onclick = (e) => {
        if (e.target === modal) {
            closeModal();
        }
    };
}

function showGistActionsModal(gistId) {
    checkIfGistHasVoiceNote(gistId).then(hasVoiceNote => {
        if (hasVoiceNote) {
            showNotification('Cannot repost gists with voice notes', 'warning');
            return;
        }
        
        let modal = document.getElementById('gistActionsModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'gistActionsModal';
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 300px; border-radius: 20px;">
                    <div class="modal-header">
                        <h3>Gist Options</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <button class="modal-action-btn" id="repostActionBtn">
                            <i class="fas fa-retweet"></i> Repost
                        </button>
                        <button class="modal-action-btn" id="highlightActionBtn">
                            <i class="fas fa-bookmark"></i> Highlight
                        </button>
                        <button class="modal-action-btn" id="cancelActionBtn">
                            Cancel
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            
            const styles = document.createElement('style');
            styles.textContent = `
                #gistActionsModal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-color: rgba(0, 0, 0, 0.5);
                    display: none;
                    justify-content: center;
                    align-items: center;
                    z-index: 10000;
                }
                .modal-action-btn {
                    padding: 15px;
                    border: none;
                    border-radius: 10px;
                    background: #f5f5f5;
                    color: #333;
                    font-size: 16px;
                    cursor: pointer;
                    text-align: left;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    transition: background-color 0.3s;
                }
                .modal-action-btn:hover {
                    background: #e0e0e0;
                }
            `;
            document.head.appendChild(styles);
        }
        
        modal.style.display = 'flex';
        
        const repostBtn = document.getElementById('repostActionBtn');
        const highlightBtn = document.getElementById('highlightActionBtn');
        const cancelBtn = document.getElementById('cancelActionBtn');
        const closeBtn = modal.querySelector('.modal-close');
        
        const closeModal = () => {
            modal.style.display = 'none';
        };
        
        repostBtn.onclick = () => {
            closeModal();
            repostGist(gistId);
        };
        
        highlightBtn.onclick = () => {
            closeModal();
            const highlightBtn = document.querySelector(`[data-gist-id="${gistId}"] .highlight-btn`);
            if (highlightBtn) {
                highlightGist(gistId, highlightBtn);
            }
        };
        
        cancelBtn.onclick = closeModal;
        closeBtn.onclick = closeModal;
        
        modal.onclick = (e) => {
            if (e.target === modal) {
                closeModal();
            }
        };
    }).catch(error => {
        console.error('Error checking voice note:', error);
        showNotification('Error checking gist', 'error');
    });
}

async function checkIfGistHasVoiceNote(gistId) {
    try {
        const gistRef = doc(db, 'gists', gistId);
        const gistSnap = await getDoc(gistRef);
        
        if (!gistSnap.exists()) {
            return false;
        }
        
        const gistData = gistSnap.data();
        
        return gistData.containsVoiceNote || 
               gistData.mediaType === 'audio' || 
               gistData.mediaType === 'both';
        
    } catch (error) {
        console.error('Error checking voice note:', error);
        return false;
    }
}

async function likeGist(gistId, button) {
    if (!currentUser) {
        showNotification('Please login to like gists', 'warning');
        return;
    }
    
    try {
        const gistRef = doc(db, 'gists', gistId);
        
        await runTransaction(db, async (transaction) => {
            const gistDoc = await transaction.get(gistRef);
            if (!gistDoc.exists()) {
                throw new Error('Gist not found');
            }
            
            const gistData = gistDoc.data();
            const likedBy = gistData.likedBy || [];
            const isLiked = likedBy.includes(currentUser.uid);
            
            if (isLiked) {
                transaction.update(gistRef, {
                    likes: (gistData.likes || 1) - 1,
                    likedBy: arrayRemove(currentUser.uid)
                });
                button.classList.remove('liked');
            } else {
                transaction.update(gistRef, {
                    likes: (gistData.likes || 0) + 1,
                    likedBy: arrayUnion(currentUser.uid)
                });
                button.classList.add('liked');
            }
            
            const newLikes = isLiked ? (gistData.likes || 1) - 1 : (gistData.likes || 0) + 1;
            const countSpan = button.querySelector('.action-count');
            if (countSpan) {
                countSpan.textContent = newLikes;
            }
            
            showNotification(isLiked ? 'Gist unliked!' : 'Gist liked!', 'success');
        });
        
    } catch (error) {
        console.error('Error liking gist:', error);
        showNotification('Failed to like gist: ' + error.message, 'error');
    }
}

async function highlightGist(gistId, button) {
    if (!currentUser) {
        showNotification('Please login to highlight gists', 'warning');
        return;
    }
    
    try {
        const gistRef = doc(db, 'gists', gistId);
        
        await runTransaction(db, async (transaction) => {
            const gistDoc = await transaction.get(gistRef);
            if (!gistDoc.exists()) {
                throw new Error('Gist not found');
            }
            
            const gistData = gistDoc.data();
            const highlightedBy = gistData.highlightedBy || [];
            const isHighlighted = highlightedBy.includes(currentUser.uid);
            
            if (isHighlighted) {
                transaction.update(gistRef, {
                    highlights: (gistData.highlights || 1) - 1,
                    highlightedBy: arrayRemove(currentUser.uid)
                });
                button.classList.remove('highlighted');
            } else {
                transaction.update(gistRef, {
                    highlights: (gistData.highlights || 0) + 1,
                    highlightedBy: arrayUnion(currentUser.uid)
                });
                button.classList.add('highlighted');
            }
            
            const newHighlights = isHighlighted ? (gistData.highlights || 1) - 1 : (gistData.highlights || 0) + 1;
            const countSpan = button.querySelector('.action-count');
            if (countSpan) {
                countSpan.textContent = newHighlights;
            }
            
            showNotification(isHighlighted ? 'Removed from highlights!' : 'Added to highlights!', 'success');
        });
        
    } catch (error) {
        console.error('Error highlighting gist:', error);
        showNotification('Failed to highlight gist: ' + error.message, 'error');
    }
}

async function repostGist(gistId, button = null) {
    if (!currentUser) {
        showNotification('Please login to repost gists', 'warning');
        return;
    }
    
    try {
        const gistRef = doc(db, 'gists', gistId);
        const gistSnap = await getDoc(gistRef);
        
        if (!gistSnap.exists()) {
            throw new Error('Gist not found');
        }
        
        const originalGist = gistSnap.data();
        
        const hasVoiceNote = originalGist.containsVoiceNote || 
                            originalGist.mediaType === 'audio' || 
                            originalGist.mediaType === 'both';
        
        if (hasVoiceNote) {
            showNotification('Cannot repost gists with voice notes', 'warning');
            return;
        }
        
        const repostedBy = originalGist.repostedBy || [];
        const isReposted = repostedBy.includes(currentUser.uid);
        
        if (isReposted) {
            showNotification('You already reposted this gist!', 'warning');
            return;
        }
        
        showNotification('Reposting...', 'info');
        
        const userIdentity = await getUserIdentity();
        
        const repostData = {
            content: originalGist.content || '',
            mediaUrl: originalGist.mediaUrl || null,
            mediaType: originalGist.mediaType || null,
            duration: originalGist.duration || null,
            secondMediaUrl: originalGist.secondMediaUrl || null,
            likes: 0,
            comments: 0,
            reposts: 0,
            highlights: 0,
            authorId: currentUser.uid,
            anonymousUserId: userIdentity.id,
            authorAvatar: userIdentity.avatar,
            authorDisplayName: userIdentity.displayName,
            timestamp: serverTimestamp(),
            isAnonymous: true,
            createdAt: new Date().toISOString(),
            likedBy: [],
            highlightedBy: [],
            repostedBy: [],
            repostedFrom: originalGist.repostedFrom || gistId,
            originalPostId: originalGist.originalPostId || gistId,
            containsVoiceNote: false,
            hashtags: originalGist.hashtags || [],
            hashtagCount: originalGist.hashtagCount || 0
        };
        
        const repostRef = await addDoc(collection(db, 'gists'), repostData);
        
        await runTransaction(db, async (transaction) => {
            const originalDoc = await transaction.get(gistRef);
            if (!originalDoc.exists()) {
                throw new Error('Original gist not found');
            }
            
            const originalData = originalDoc.data();
            transaction.update(gistRef, {
                reposts: (originalData.reposts || 0) + 1,
                repostedBy: arrayUnion(currentUser.uid)
            });
        });
        
        if (button) {
            button.classList.add('reposted');
            const countSpan = button.querySelector('.action-count');
            if (countSpan) {
                const currentCount = parseInt(countSpan.textContent) || 0;
                countSpan.textContent = currentCount + 1;
            }
        }
        
        showNotification('Gist reposted!', 'success');
        
        setTimeout(() => {
            const gistsContainer = document.getElementById('gistsContainer');
            if (gistsContainer && gistsContainer.innerHTML) {
                loadGists(null, 10);
            }
        }, 1000);
        
    } catch (error) {
        console.error('Error reposting gist:', error);
        showNotification('Failed to repost gist: ' + error.message, 'error');
    }
}

function playGistVoice(audioUrl, button, waveform) {
    if (!button || !audioUrl) return;
    
    if (currentlyPlayingAudio && currentlyPlayingButton && currentlyPlayingButton !== button) {
        currentlyPlayingAudio.pause();
        currentlyPlayingButton.innerHTML = '<i class="fas fa-play"></i>';
        const otherWaveform = currentlyPlayingButton.closest('.gist-voice-note').querySelector('.voice-waveform');
        if (otherWaveform) {
            const otherBars = otherWaveform.querySelectorAll('.wave-bar');
            otherBars.forEach(bar => {
                bar.style.animation = 'none';
            });
        }
    }
    
    let audio;
    if (currentlyPlayingAudio && currentlyPlayingButton === button) {
        audio = currentlyPlayingAudio;
    } else {
        audio = new Audio(audioUrl);
    }
    
    const waveBars = waveform ? waveform.querySelectorAll('.wave-bar') : [];
    
    if (audio.paused) {
        audio.play();
        button.innerHTML = '<i class="fas fa-pause"></i>';
        currentlyPlayingAudio = audio;
        currentlyPlayingButton = button;
        
        waveBars.forEach((bar, index) => {
            bar.style.animation = `waveform 1.2s ${index * 0.1}s infinite ease-in-out`;
        });
    } else {
        audio.pause();
        button.innerHTML = '<i class="fas fa-play"></i>';
        
        waveBars.forEach(bar => {
            bar.style.animation = 'none';
        });
    }
    
    audio.onended = () => {
        button.innerHTML = '<i class="fas fa-play"></i>';
        waveBars.forEach(bar => {
            bar.style.animation = 'none';
        });
        currentlyPlayingAudio = null;
        currentlyPlayingButton = null;
    };
    
    audio.onpause = () => {
        if (currentlyPlayingButton === button) {
            button.innerHTML = '<i class="fas fa-play"></i>';
            waveBars.forEach(bar => {
                bar.style.animation = 'none';
            });
        }
    };
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/\n/g, '<br>');
}

function formatDuration(seconds) {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatTime(timestamp) {
    if (!timestamp) return 'Just now';
    
    let date;
    try {
        if (timestamp.toDate) {
            date = timestamp.toDate();
        } else if (typeof timestamp === 'string') {
            date = new Date(timestamp);
        } else if (typeof timestamp === 'number') {
            date = new Date(timestamp);
        } else {
            return 'Just now';
        }
    } catch (error) {
        console.error('Error parsing timestamp:', error);
        return 'Just now';
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
        return 'Just now';
    }
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `gist-notification ${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        left: 20px;
        background: ${type === 'error' ? '#dc3545' : 
                    type === 'success' ? '#28a745' : 
                    type === 'warning' ? '#ffc107' : '#007bff'};
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: space-between;
        animation: slideIn 0.3s ease;
        font-family: 'Inter', sans-serif;
        font-size: 14px;
    `;
    
    if (!document.getElementById('gist-notification-styles')) {
        const styles = document.createElement('style');
        styles.id = 'gist-notification-styles';
        styles.textContent = `
            @keyframes slideIn {
                from { transform: translateY(-20px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateY(0); opacity: 1; }
                to { transform: translateY(-20px); opacity: 0; }
            }
            @keyframes waveform {
                0%, 100% { transform: scaleY(0.3); }
                50% { transform: scaleY(1); }
            }
            .wave-bar {
                width: 3px;
                background: currentColor;
                border-radius: 2px;
                height: 20px;
                margin: 0 2px;
            }
            .repost-icon {
                position: absolute;
                top: -5px;
                right: -5px;
                background: #b3004b;
                color: white;
                width: 20px;
                height: 20px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 10px;
                z-index: 1;
            }
            .liked {
                color: #e0245e !important;
            }
            .highlighted {
                color: #ffc107 !important;
            }
            .reposted {
                color: #b3004b !important;
            }
            .hashtag-link {
                color: #b3004b;
                text-decoration: none;
                font-weight: 600;
                background: rgba(179, 0, 75, 0.1);
                padding: 2px 8px;
                border-radius: 12px;
                font-size: 13px;
                transition: all 0.3s;
            }
            .hashtag-link:hover {
                background: #b3004b;
                color: white;
            }
            .photos-grid-preview {
                display: grid;
                gap: 5px;
            }
            .grid-1 {
                grid-template-columns: 1fr;
            }
            .grid-2 {
                grid-template-columns: repeat(2, 1fr);
            }
            .grid-3 {
                grid-template-columns: repeat(2, 1fr);
                grid-template-rows: repeat(2, 1fr);
            }
            .grid-3 .photo-grid-item:first-child {
                grid-column: span 2;
            }
            .grid-4 {
                grid-template-columns: repeat(2, 1fr);
                grid-template-rows: repeat(2, 1fr);
            }
        `;
        document.head.appendChild(styles);
    }
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    else if (type === 'error') icon = '❌';
    else if (type === 'warning') icon = '⚠️';
    
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 16px;">${icon}</span>
            <span>${message}</span>
        </div>
        <button onclick="this.parentElement.remove()" style="background: none; border: none; color: white; font-size: 20px; cursor: pointer; padding: 0 5px;">
            ×
        </button>
    `;
    
    const existingNotifications = document.querySelectorAll('.gist-notification');
    existingNotifications.forEach(n => n.remove());
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
    
    return notification;
}

async function generateShareIdsForAllGists() {
    try {
        showNotification('Generating share links for all gists...', 'info');
        
        const querySnapshot = await getDocs(collection(db, 'gists'));
        
        const promises = [];
        querySnapshot.forEach((doc) => {
            const gistData = doc.data();
            if (!gistData.shareId) {
                const shareId = Math.random().toString(36).substring(2, 15);
                promises.push(
                    updateDoc(doc.ref, {
                        shareId: shareId,
                        lastShared: serverTimestamp()
                    })
                );
            }
        });
        
        await Promise.all(promises);
        console.log(`Generated share IDs for ${promises.length} gists`);
        showNotification(`Generated share links for ${promises.length} gists`, 'success');
        
    } catch (error) {
        console.error('Error generating share IDs:', error);
        showNotification('Error generating share links', 'error');
    }
}

// Initialize photos page
function initPhotosPage() {
    console.log('Initializing photos page');
    
    const urlParams = new URLSearchParams(window.location.search);
    const gistId = urlParams.get('gistId');
    
    if (!gistId) {
        window.location.href = 'gist.html';
        return;
    }
    
    const backBtn = document.getElementById('backBtn');
    const photosContainer = document.getElementById('photosContainer');
    
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.history.back();
        });
    }
    
    loadGistPhotos(gistId);
}

async function loadGistPhotos(gistId) {
    const photosContainer = document.getElementById('photosContainer');
    
    if (!photosContainer) return;
    
    photosContainer.innerHTML = `
        <div class="loading-state">
            <div class="loading-spinner">
                <i class="fas fa-spinner fa-spin fa-2x"></i>
            </div>
            <p>Loading photos...</p>
        </div>
    `;
    
    try {
        const gistRef = doc(db, 'gists', gistId);
        const gistSnap = await getDoc(gistRef);
        
        if (!gistSnap.exists()) {
            showNotification('Gist not found', 'error');
            window.history.back();
            return;
        }
        
        const gist = gistSnap.data();
        const imageUrls = gist.imageUrls || [];
        
        if (imageUrls.length === 0) {
            photosContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-images fa-3x" style="color: #b3004b; margin-bottom: 15px;"></i>
                    <h3 style="color: #333; margin-bottom: 10px;">No Photos Found</h3>
                    <p style="color: #666;">This gist doesn't contain any photos.</p>
                    <button onclick="window.history.back()" 
                            style="margin-top: 20px; background: #b3004b; color: white; border: none; padding: 12px 25px; border-radius: 25px; cursor: pointer;">
                        Go Back
                    </button>
                </div>
            `;
            return;
        }
        
        // Display photos in columns
        displayPhotosInColumns(imageUrls, photosContainer);
        
    } catch (error) {
        console.error('Error loading photos:', error);
        photosContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle fa-3x" style="color: #dc3545; margin-bottom: 15px;"></i>
                <h3 style="color: #333; margin-bottom: 10px;">Error Loading Photos</h3>
                <p style="color: #666;">Please try again later.</p>
                <button onclick="window.history.back()" 
                        style="margin-top: 20px; background: #b3004b; color: white; border: none; padding: 12px 25px; border-radius: 25px; cursor: pointer;">
                    Go Back
                </button>
            </div>
        `;
    }
}

function displayPhotosInColumns(imageUrls, container) {
    container.innerHTML = '';
    
    // Create 3-column layout
    const columnsContainer = document.createElement('div');
    columnsContainer.className = 'photos-columns';
    columnsContainer.style.cssText = `
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 10px;
        padding: 10px;
    `;
    
    // Distribute images across 3 columns
    const columns = [[], [], []];
    
    imageUrls.forEach((url, index) => {
        columns[index % 3].push(url);
    });
    
    // Create column divs
    for (let i = 0; i < 3; i++) {
        const columnDiv = document.createElement('div');
        columnDiv.className = `photo-column column-${i + 1}`;
        columnDiv.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;
        
        columns[i].forEach(url => {
            const photoItem = document.createElement('div');
            photoItem.className = 'photo-item';
            photoItem.style.cssText = `
                position: relative;
                border-radius: 12px;
                overflow: hidden;
                cursor: pointer;
                transition: transform 0.3s;
                aspect-ratio: 1;
            `;
            
            const img = document.createElement('img');
            img.src = url;
            img.alt = 'Gist photo';
            img.style.cssText = `
                width: 100%;
                height: 100%;
                object-fit: cover;
                display: block;
            `;
            
            photoItem.appendChild(img);
            columnDiv.appendChild(photoItem);
        });
        
        columnsContainer.appendChild(columnDiv);
    }
    
    container.appendChild(columnsContainer);
    
    // Add CSS for hover effects
    const styles = document.createElement('style');
    styles.textContent = `
        .photo-item:hover {
            transform: scale(1.02);
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
        }
        .photo-item img {
            transition: transform 0.5s;
        }
        .photo-item:hover img {
            transform: scale(1.05);
        }
    `;
    document.head.appendChild(styles);
}