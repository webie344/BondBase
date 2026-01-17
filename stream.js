// stream.js - Video Streaming functionality with Cloudinary integration + Social Features
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
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
    deleteDoc,
    serverTimestamp,
    onSnapshot,
    orderBy,
    increment,
    arrayUnion
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { 
    getAuth, 
    onAuthStateChanged,
    signOut 
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

// Cloudinary configuration
const cloudinaryConfig = {
    cloudName: "ddtdqrh1b",
    uploadPreset: "profile-pictures",
    apiUrl: "https://api.cloudinary.com/v1_1"
};

// Global variables
let currentUser = null;

// Social features tracking
let likedStreams = new Set();
let viewedStreams = new Set();

// TikTok Feed Instance
let tiktokFeedInstance = null;

// Video Modal Instance
let videoModalInstance = null;

// Rendering control
let isRendering = false;
let lastRenderTime = 0;

// Comment tracking to prevent duplicates
let activeCommentListeners = new Map();

// Click tracking for double click detection
let lastClickTime = 0;
let clickTimeout = null;

// Video cache manager
const videoCache = {
    cacheSize: 5,
    currentVideos: [],
    cachedVideos: new Map(),
    isCaching: false,

    async cacheVideos(videos, startIndex) {
        if (this.isCaching) return;
        this.isCaching = true;

        try {
            // Cache next 5 videos
            const endIndex = Math.min(startIndex + this.cacheSize, videos.length);
            const videosToCache = videos.slice(startIndex, endIndex);

            for (const video of videosToCache) {
                if (!this.cachedVideos.has(video.id)) {
                    try {
                        // Create video element for caching
                        const videoElement = document.createElement('video');
                        videoElement.src = video.videoUrl;
                        videoElement.preload = 'auto';
                        videoElement.crossOrigin = 'anonymous';
                        
                        // Store in cache
                        this.cachedVideos.set(video.id, {
                            element: videoElement,
                            data: video,
                            loaded: false
                        });

                        // Wait for video to load enough data
                        await new Promise((resolve) => {
                            videoElement.addEventListener('loadeddata', () => {
                                this.cachedVideos.get(video.id).loaded = true;
                                resolve();
                            });

                            videoElement.addEventListener('error', () => {
                                console.warn(`Failed to cache video: ${video.id}`);
                                resolve();
                            });

                            // Timeout after 10 seconds
                            setTimeout(resolve, 10000);
                        });
                    } catch (error) {
                        console.warn(`Error caching video ${video.id}:`, error);
                    }
                }
            }

            // Remove old cached videos if cache is too large
            if (this.cachedVideos.size > this.cacheSize * 2) {
                const keys = Array.from(this.cachedVideos.keys());
                const videosToRemove = keys.slice(0, this.cacheSize);
                
                videosToRemove.forEach(key => {
                    const cached = this.cachedVideos.get(key);
                    if (cached && cached.element) {
                        cached.element.src = '';
                        cached.element.load();
                    }
                    this.cachedVideos.delete(key);
                });
            }
        } catch (error) {
            console.error('Error in video caching:', error);
        } finally {
            this.isCaching = false;
        }
    },

    getCachedVideo(videoId) {
        return this.cachedVideos.get(videoId);
    },

    clearCache() {
        this.cachedVideos.forEach((cached, key) => {
            if (cached && cached.element) {
                cached.element.src = '';
                cached.element.load();
            }
        });
        this.cachedVideos.clear();
    }
};

// Supported video formats
const SUPPORTED_VIDEO_FORMATS = [
    'video/mp4', 'video/quicktime', 'video/x-m4v', 'video/3gpp', 'video/3gpp2',
    'video/mpeg', 'video/webm', 'video/ogg', 'video/x-msvideo', 'video/x-matroska',
    'video/mp2t', 'video/h264', 'video/hevc', 'video/avi', 'video/x-flv',
    'video/x-ms-wmv', 'video/x-ms-asf', 'video/mp4v-es', 'video/mj2',
    'video/x-mpeg', 'video/mp2p', 'video/mp2t', 'video/MP2T'
];

// Supported file extensions
const SUPPORTED_EXTENSIONS = [
    '.mp4', '.mov', '.m4v', '.3gp', '.3g2', '.mpeg', '.mpg', '.webm', '.ogg',
    '.avi', '.mkv', '.ts', '.mts', '.m2ts', '.flv', '.f4v', '.wmv', '.mpg', '.mpeg',
    '.qt', '.mxf', '.m2v', '.m4p', '.m4b', '.mp2', '.mpv', '.mpe', '.m1v', '.m2p',
    '.divx', '.xvid', '.vob', '.mod', '.tod', '.mts', '.m2t', '.m2ts'
];

// Problematic formats that often need conversion
const PROBLEMATIC_FORMATS = [
    'video/quicktime',
    'video/x-msvideo',
    'video/x-matroska',
    'video/x-ms-wmv',
    'video/x-flv',
    'video/3gpp',
    'video/3gpp2'
];

// Stream Manager Class with Cloudinary integration
class StreamManager {
    constructor() {
        this.currentStreams = new Map();
        this.streamListeners = new Map();
        this.viewerListeners = new Map();
        this.commentListeners = new Map();
    }

    // Create a new stream with Cloudinary upload
    async createStream(videoData, headline, description, category, isLocalFile = false) {
        try {
            if (!currentUser) {
                throw new Error('You must be logged in to create a stream');
            }

            // Get user data
            const userRef = doc(db, 'users', currentUser.uid);
            const userSnap = await getDoc(userRef);
            
            if (!userSnap.exists()) {
                throw new Error('User profile not found');
            }

            const userData = userSnap.data();

            let streamData = {};

            if (isLocalFile && videoData instanceof File) {
                // Enhanced validation for downloaded videos
                await this.validateVideoFile(videoData);
                
                // Upload to Cloudinary
                const videoUrl = await this.uploadVideoToCloudinary(videoData);
                
                // Generate thumbnail URL from Cloudinary video
                const thumbnailUrl = this.generateCloudinaryThumbnail(videoUrl);
                
                streamData = {
                    videoType: 'cloudinary',
                    videoUrl: videoUrl,
                    videoMimeType: videoData.type,
                    videoFileName: videoData.name,
                    videoFileSize: videoData.size,
                    videoFormat: this.getVideoFormat(videoData),
                    headline: headline,
                    description: description || '',
                    category: category,
                    authorId: currentUser.uid,
                    authorName: userData.name || 'Anonymous',
                    authorImage: userData.profileImage || 'images-default-profile.jpg',
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    viewCount: 0,
                    currentViewers: 0,
                    likes: 0,
                    commentsCount: 0,
                    isActive: true,
                    sortTimestamp: new Date().getTime(),
                    embedUrl: null,
                    thumbnailUrl: thumbnailUrl,
                    isPhoneVideo: this.isLikelyPhoneVideo(videoData),
                    isPortraitVideo: await this.isPortraitVideo(videoData),
                    needsConversion: this.needsConversion(videoData)
                };
            } else {
                throw new Error('Only file uploads are supported');
            }

            const streamRef = await addDoc(collection(db, 'streams'), streamData);
            
            return streamRef.id;
        } catch (error) {
            throw error;
        }
    }

    // Get all videos posted by a specific user
    async getUserVideos(userId) {
        try {
            const videosQuery = query(
                collection(db, 'streams'),
                where('authorId', '==', userId),
                where('isActive', '==', true)
            );
            
            const videosSnap = await getDocs(videosQuery);
            const videos = [];
            
            videosSnap.forEach(doc => {
                const data = doc.data();
                videos.push({
                    id: doc.id,
                    ...data,
                    thumbnailUrl: this.getStreamThumbnail(data),
                    createdAt: data.createdAt || new Date(),
                    timestamp: data.createdAt?.toDate?.()?.getTime() || new Date().getTime()
                });
            });

            // Sort by newest first
            videos.sort((a, b) => b.timestamp - a.timestamp);
            
            return videos;
        } catch (error) {
            console.error('Error getting user videos:', error);
            return [];
        }
    }

    // Get specific video by ID
    async getVideoById(videoId) {
        try {
            const videoRef = doc(db, 'streams', videoId);
            const videoSnap = await getDoc(videoRef);
            
            if (videoSnap.exists()) {
                const data = videoSnap.data();
                return {
                    id: videoSnap.id,
                    ...data,
                    thumbnailUrl: this.getStreamThumbnail(data),
                    createdAt: data.createdAt || new Date(),
                    timestamp: data.createdAt?.toDate?.()?.getTime() || new Date().getTime()
                };
            }
            return null;
        } catch (error) {
            console.error('Error getting video by ID:', error);
            return null;
        }
    }

    // Generate Cloudinary thumbnail URL from video URL
    generateCloudinaryThumbnail(videoUrl) {
        try {
            if (!videoUrl || typeof videoUrl !== 'string') {
                return 'images-defaultse-profile.jpg';
            }

            if (!videoUrl.includes('cloudinary.com')) {
                return 'images-defaultse-profile.jpg';
            }

            if (videoUrl.includes('/upload/')) {
                if (videoUrl.includes('/upload/video/')) {
                    return videoUrl.replace('/upload/video/', '/upload/w_400,h_225,c_fill,q_auto,f_jpg/')
                                   .replace(/\.(mp4|mov|avi|mkv|webm)$/i, '.jpg');
                } else {
                    return videoUrl.replace('/upload/', '/upload/w_400,h_225,c_fill,q_auto,f_jpg/');
                }
            }
            
            return 'images-defaultse-profile.jpg';
        } catch (error) {
            console.error('Error generating thumbnail:', error);
            return 'images-defaultse-profile.jpg';
        }
    }

    // Check if video needs conversion
    needsConversion(file) {
        const needsConversion = PROBLEMATIC_FORMATS.includes(file.type) || 
                               this.isDownloadedVideo(file) ||
                               file.name.toLowerCase().includes('discord') ||
                               file.name.toLowerCase().includes('whatsapp') ||
                               file.name.toLowerCase().includes('telegram') ||
                               file.name.toLowerCase().includes('social') ||
                               file.name.toLowerCase().includes('downloaded');
        
        return needsConversion;
    }

    // Check if video is likely downloaded from social media
    isDownloadedVideo(file) {
        const downloadedIndicators = [
            file.name.match(/(discord|whatsapp|telegram|instagram|facebook|twitter|tiktok|snapchat)/i),
            file.name.match(/(downloaded|save|received|forwarded)/i),
            file.size < 10000000 && file.type === 'video/mp4',
            file.name.includes('-') && file.name.split('-').length > 3,
        ];
        
        return downloadedIndicators.some(indicator => indicator);
    }

    // Check if video is portrait orientation
    async isPortraitVideo(file) {
        return new Promise((resolve) => {
            const video = document.createElement('video');
            video.src = URL.createObjectURL(file);
            video.crossOrigin = 'anonymous';
            
            video.addEventListener('loadedmetadata', () => {
                const isPortrait = video.videoHeight > video.videoWidth;
                URL.revokeObjectURL(video.src);
                resolve(isPortrait);
            });
            
            video.addEventListener('error', () => {
                URL.revokeObjectURL(video.src);
                resolve(false);
            });
            
            setTimeout(() => {
                URL.revokeObjectURL(video.src);
                resolve(false);
            }, 5000);
            
            video.load();
        });
    }

    // Validate video file for phone compatibility
    async validateVideoFile(file) {
        const maxSize = 1024 * 1024 * 1024;
        if (file.size > maxSize) {
            throw new Error('Video file must be smaller than 1GB');
        }

        if (!file.type.startsWith('video/') && !this.isLikelyVideoFile(file)) {
            throw new Error('Please select a valid video file');
        }

        const isSupportedFormat = SUPPORTED_VIDEO_FORMATS.some(format => 
            file.type === format || 
            file.type.includes(format.replace('video/', ''))
        );

        const isSupportedExtension = SUPPORTED_EXTENSIONS.some(ext => 
            file.name.toLowerCase().endsWith(ext)
        );

        if (!isSupportedFormat && !isSupportedExtension) {
            // We'll still try to upload as Cloudinary can handle many formats
        }

        if (this.needsConversion(file)) {
            // We'll still try to upload with enhanced transformations
        }

        return true;
    }

    // Check if file is likely a video based on name and properties
    isLikelyVideoFile(file) {
        const videoIndicators = [
            file.name.toLowerCase().match(/\.(mp4|mov|avi|mkv|wmv|flv|webm|3gp|m4v|mpg|mpeg)$/),
            file.size > 100000,
            file.type === '' || file.type === 'application/octet-stream'
        ];
        
        return videoIndicators.some(indicator => indicator);
    }

    // Get video format information
    getVideoFormat(file) {
        return {
            mimeType: file.type,
            extension: file.name.split('.').pop().toLowerCase(),
            isCommonPhoneFormat: this.isCommonPhoneFormat(file)
        };
    }

    // Check if video is from common phone formats
    isCommonPhoneFormat(file) {
        const phoneFormats = [
            'video/mp4',
            'video/quicktime',
            'video/x-m4v',
            'video/3gpp',
            'video/3gpp2',
            'video/avi',
            'video/x-msvideo'
        ];
        
        return phoneFormats.includes(file.type) || 
               file.name.toLowerCase().includes('iphone') ||
               file.name.toLowerCase().includes('android') ||
               file.name.toLowerCase().includes('movi') ||
               file.name.toLowerCase().includes('vid_') ||
               file.name.toLowerCase().includes('camera') ||
               file.name.toLowerCase().includes('record');
    }

    // Check if video is likely from a phone
    isLikelyPhoneVideo(file) {
        return this.isCommonPhoneFormat(file) || 
               file.name.match(/(IMG_|VID_|PXL_|MVIMG_|CAM_|REC_)/i) !== null ||
               file.name.toLowerCase().includes('whatsapp') ||
               file.name.toLowerCase().includes('camera') ||
               file.type === 'video/quicktime' ||
               file.type === 'video/mp4' ||
               file.type === 'video/3gpp';
    }

    // Upload video to Cloudinary
    async uploadVideoToCloudinary(videoFile) {
        const formData = new FormData();
        formData.append('file', videoFile);
        formData.append('upload_preset', cloudinaryConfig.uploadPreset);
        formData.append('resource_type', 'video');
        
        try {
            const response = await fetch(
                `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/video/upload`,
                {
                    method: 'POST',
                    body: formData
                }
            );
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Video upload failed: ${response.statusText}`);
            }
            
            const data = await response.json();
            if (!data.secure_url) {
                throw new Error('Invalid response from Cloudinary - no video URL received');
            }
            
            return data.secure_url;
        } catch (error) {
            throw new Error(`Video upload failed: ${error.message}`);
        }
    }

    // Get all streams
    async getStreams(category = 'all') {
        try {
            const streamsQuery = collection(db, 'streams');
            const streamsSnap = await getDocs(streamsQuery);
            const streams = [];
            
            streamsSnap.forEach(doc => {
                const data = doc.data();
                if (data.isActive !== false) {
                    const streamWithThumbnail = {
                        id: doc.id,
                        ...data,
                        thumbnailUrl: this.getStreamThumbnail(data),
                        createdAt: data.createdAt || new Date(),
                        updatedAt: data.updatedAt || new Date(),
                        timestamp: data.createdAt?.toDate?.()?.getTime() || 
                                  data.sortTimestamp || 
                                  new Date().getTime()
                    };
                    streams.push(streamWithThumbnail);
                }
            });

            let filteredStreams = streams;
            if (category !== 'all') {
                filteredStreams = streams.filter(stream => stream.category === category);
            }

            // Shuffle videos for random order
            filteredStreams = this.shuffleArray(filteredStreams);

            return filteredStreams;
        } catch (error) {
            console.error('Error getting streams:', error);
            return [];
        }
    }

    // Shuffle array function
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    // Helper function to get thumbnail for a stream
    getStreamThumbnail(streamData) {
        if (streamData.thumbnailUrl && streamData.thumbnailUrl !== 'images-defaultse-profile.jpg') {
            return streamData.thumbnailUrl;
        }
        
        if (streamData.videoUrl && streamData.videoType === 'cloudinary') {
            return this.generateCloudinaryThumbnail(streamData.videoUrl);
        }
        
        return 'images-defaultse-profile.jpg';
    }

    // Add viewer to stream
    async addViewer(streamId) {
        if (!currentUser) return;

        try {
            const streamRef = doc(db, 'streams', streamId);
            const viewerRef = doc(db, 'streams', streamId, 'viewers', currentUser.uid);
            
            await setDoc(viewerRef, {
                userId: currentUser.uid,
                joinedAt: serverTimestamp(),
                lastActive: serverTimestamp()
            });

            await updateDoc(streamRef, {
                currentViewers: increment(1),
                viewCount: increment(1),
                updatedAt: serverTimestamp()
            });

            this.currentStreams.set(streamId, {
                viewerRef: viewerRef,
                lastUpdate: Date.now()
            });

        } catch (error) {
            console.error('Error adding viewer:', error);
        }
    }

    // Remove viewer from stream
    async removeViewer(streamId) {
        if (!currentUser) return;

        try {
            const viewerRef = doc(db, 'streams', streamId, 'viewers', currentUser.uid);
            
            await setDoc(viewerRef, {
                userId: currentUser.uid,
                leftAt: serverTimestamp()
            }, { merge: true });

            const streamRef = doc(db, 'streams', streamId);
            await updateDoc(streamRef, {
                currentViewers: increment(-1),
                updatedAt: serverTimestamp()
            });

            this.currentStreams.delete(streamId);

        } catch (error) {
            console.error('Error removing viewer:', error);
        }
    }

    // LIKE FUNCTIONALITY
    async handleLike(streamId, likeButton) {
        if (!currentUser) {
            alert('Please login to like videos');
            return null;
        }

        // Check if already liked
        const isLiked = likedStreams.has(streamId);
        
        try {
            const streamRef = doc(db, 'streams', streamId);
            const streamSnap = await getDoc(streamRef);
            
            if (streamSnap.exists()) {
                const stream = streamSnap.data();
                let newLikes = (stream.likes || 0);
                
                if (isLiked) {
                    // Unlike
                    newLikes = Math.max(0, newLikes - 1);
                    likedStreams.delete(streamId);
                } else {
                    // Like
                    newLikes = newLikes + 1;
                    likedStreams.add(streamId);
                }
                
                // Update Firestore
                await updateDoc(streamRef, {
                    likes: newLikes,
                    updatedAt: serverTimestamp()
                });

                // Save to localStorage
                saveLikedStreams();

                // Return the updated like count and whether it's liked
                return { likes: newLikes, isLiked: !isLiked };
            }
        } catch (error) {
            console.error('Error handling like:', error);
            return null;
        }
    }

    // COMMENT FUNCTIONALITY - UPDATED WITH REPLY SUPPORT
    async loadComments(streamId, container) {
        if (!container) return;

        try {
            // Clean up previous listener for this stream if it exists
            if (activeCommentListeners.has(streamId)) {
                const unsubscribe = activeCommentListeners.get(streamId);
                unsubscribe();
                activeCommentListeners.delete(streamId);
            }

            // Create a new real-time listener
            const commentsQuery = query(
                collection(db, 'streams', streamId, 'comments'), 
                orderBy('createdAt', 'asc')
            );
            
            const unsubscribe = onSnapshot(commentsQuery, (snapshot) => {
                container.innerHTML = '';
                
                if (snapshot.empty) {
                    container.innerHTML = '<div class="no-comments">No comments yet</div>';
                    return;
                }

                const userIds = new Set();
                snapshot.forEach(doc => {
                    const comment = doc.data();
                    userIds.add(comment.userId);
                    if (comment.replyTo) {
                        userIds.add(comment.replyTo.userId);
                    }
                });

                // Get user data for all comments
                this.getUsersData([...userIds]).then(usersData => {
                    // Clear container again in case we get multiple rapid updates
                    container.innerHTML = '';
                    
                    // Track displayed comment IDs to prevent duplicates
                    const displayedCommentIds = new Set();
                    
                    snapshot.forEach(doc => {
                        const comment = doc.data();
                        const commentId = doc.id;
                        
                        // Skip if we've already displayed this comment
                        if (displayedCommentIds.has(commentId)) {
                            return;
                        }
                        
                        displayedCommentIds.add(commentId);
                        const user = usersData[comment.userId] || {};
                        const commentElement = this.createCommentElement(comment, user, commentId, usersData);
                        container.appendChild(commentElement);
                    });
                    
                    // Scroll to bottom
                    container.scrollTop = container.scrollHeight;
                    
                    // Add reply functionality
                    this.addReplyListeners(streamId);
                });
            }, (error) => {
                console.error('Error loading comments:', error);
                container.innerHTML = '<div class="error">Error loading comments</div>';
            });

            // Store the unsubscribe function
            activeCommentListeners.set(streamId, unsubscribe);

        } catch (error) {
            console.error('Error setting up comment listener:', error);
            container.innerHTML = '<div class="error">Error loading comments</div>';
        }
    }

    createCommentElement(comment, user, commentId, usersData) {
        const commentDiv = document.createElement('div');
        commentDiv.className = 'comment-item';
        commentDiv.dataset.commentId = commentId;
        
        let replyHTML = '';
        if (comment.replyTo) {
            const repliedUser = usersData[comment.replyTo.userId] || { name: 'Unknown User' };
            replyHTML = `
                <div class="comment-reply-info">
                    <i class="fas fa-reply"></i>
                    <span>Replying to ${repliedUser.name}</span>
                </div>
            `;
        }
        
        commentDiv.innerHTML = `
            <div class="comment-header">
                <img src="${user.profileImage || 'images-defaultse-profile.jpg'}" 
                     alt="${user.name}" class="comment-avatar">
                <div class="comment-info">
                    <strong>${user.name || 'Unknown User'}</strong>
                    <span class="comment-time">${formatTime(comment.createdAt)}</span>
                </div>
                <button class="comment-reply-btn" data-comment-id="${commentId}" 
                        data-user-name="${user.name || 'Unknown User'}">
                    <i class="fas fa-reply"></i>
                </button>
            </div>
            ${replyHTML}
            <div class="comment-text">${comment.text}</div>
        `;
        return commentDiv;
    }

    addReplyListeners(streamId) {
        document.querySelectorAll('.comment-reply-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const commentId = btn.dataset.commentId;
                const userName = btn.dataset.userName;
                this.handleReplyClick(streamId, commentId, userName);
            });
        });
    }

    handleReplyClick(streamId, commentId, userName) {
        if (!currentUser) {
            alert('Please login to reply to comments');
            return;
        }

        const modalCommentInput = document.getElementById('modalCommentInput');
        if (modalCommentInput) {
            modalCommentInput.value = `@${userName} `;
            modalCommentInput.focus();
            modalCommentInput.setAttribute('data-reply-to', commentId);
            modalCommentInput.setAttribute('data-reply-user-name', userName);
            
            // Scroll to input
            modalCommentInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    async handleAddComment(streamId, commentText, replyTo = null) {
        if (!currentUser) {
            alert('Please login to add comments');
            return false;
        }

        if (!commentText.trim()) {
            alert('Please enter a comment');
            return false;
        }

        try {
            const commentData = {
                userId: currentUser.uid,
                text: commentText.trim(),
                createdAt: serverTimestamp()
            };

            // Add reply information if replying to a comment
            if (replyTo) {
                // Get the original comment to include in reply
                const originalCommentRef = doc(db, 'streams', streamId, 'comments', replyTo.commentId);
                const originalCommentSnap = await getDoc(originalCommentRef);
                
                if (originalCommentSnap.exists()) {
                    const originalComment = originalCommentSnap.data();
                    commentData.replyTo = {
                        userId: replyTo.userId,
                        commentId: replyTo.commentId,
                        userName: replyTo.userName
                    };
                    commentData.text = commentData.text.replace(`@${replyTo.userName} `, '');
                }
            }

            // Add comment to subcollection
            await addDoc(collection(db, 'streams', streamId, 'comments'), commentData);

            // Update comments count
            const streamRef = doc(db, 'streams', streamId);
            await updateDoc(streamRef, {
                commentsCount: increment(1),
                updatedAt: serverTimestamp()
            });

            return true;
        } catch (error) {
            console.error('Error adding comment:', error);
            alert('Error adding comment: ' + error.message);
            return false;
        }
    }

    async getUsersData(userIds) {
        const usersData = {};
        
        for (const userId of userIds) {
            try {
                const userRef = doc(db, 'users', userId);
                const userSnap = await getDoc(userRef);
                if (userSnap.exists()) {
                    usersData[userId] = userSnap.data();
                }
            } catch (error) {
                console.error('Error getting user data:', error);
            }
        }
        
        return usersData;
    }

    // Listen to stream updates
    listenToStreams(callback, category = 'all') {
        try {
            const streamsQuery = collection(db, 'streams');
            
            const unsubscribe = onSnapshot(streamsQuery, (snapshot) => {
                const streams = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    if (data.isActive !== false) {
                        streams.push({
                            id: doc.id,
                            ...data,
                            thumbnailUrl: this.getStreamThumbnail(data),
                            timestamp: data.createdAt?.toDate?.()?.getTime() || 
                                      data.sortTimestamp || 
                                      new Date().getTime()
                        });
                    }
                });

                let filteredStreams = streams;
                if (category !== 'all') {
                    filteredStreams = streams.filter(stream => stream.category === category);
                }

                // Shuffle videos when they load
                filteredStreams = this.shuffleArray(filteredStreams);

                callback(filteredStreams);
            }, (error) => {
                console.error('Error listening to streams:', error);
                callback([]);
            });

            this.streamListeners.set(callback, unsubscribe);
            return unsubscribe;

        } catch (error) {
            console.error('Error setting up stream listener:', error);
            return () => {};
        }
    }

    // Listen to viewer count for a specific stream
    listenToViewerCount(streamId, callback) {
        try {
            const streamRef = doc(db, 'streams', streamId);
            
            const unsubscribe = onSnapshot(streamRef, (doc) => {
                if (doc.exists()) {
                    const streamData = doc.data();
                    callback(streamData.currentViewers || 0);
                }
            }, (error) => {
                console.error('Error listening to viewer count:', error);
                callback(0);
            });

            this.viewerListeners.set(`${streamId}_${callback}`, unsubscribe);
            return unsubscribe;

        } catch (error) {
            console.error('Error setting up viewer listener:', error);
            return () => {};
        }
    }

    // Get total viewers across all streams
    async getTotalViewers() {
        try {
            const streams = await this.getStreams('all');
            return streams.reduce((total, stream) => total + (stream.currentViewers || 0), 0);
        } catch (error) {
            return 0;
        }
    }

    // Initialize activity tracking for current user
    initializeActivityTracking() {
        const activityInterval = setInterval(() => {
            this.currentStreams.forEach((streamInfo, streamId) => {
                if (Date.now() - streamInfo.lastUpdate > 25000) {
                    this.updateViewerActivity(streamId);
                    streamInfo.lastUpdate = Date.now();
                }
            });
        }, 30000);

        window.addEventListener('beforeunload', () => {
            clearInterval(activityInterval);
            this.currentStreams.forEach((streamInfo, streamId) => {
                this.removeViewer(streamId);
            });
        });

        this.activityInterval = activityInterval;
    }

    async updateViewerActivity(streamId) {
        if (!currentUser) return;

        try {
            const viewerRef = doc(db, 'streams', streamId, 'viewers', currentUser.uid);
            await updateDoc(viewerRef, {
                lastActive: serverTimestamp()
            });
        } catch (error) {
            console.error('Error updating viewer activity:', error);
        }
    }

    // Clean up all listeners
    cleanup() {
        if (this.activityInterval) {
            clearInterval(this.activityInterval);
        }

        this.streamListeners.forEach(unsubscribe => unsubscribe());
        this.viewerListeners.forEach(unsubscribe => unsubscribe());
        this.streamListeners.clear();
        this.viewerListeners.clear();
        
        // Clean up comment listeners
        activeCommentListeners.forEach(unsubscribe => unsubscribe());
        activeCommentListeners.clear();
        
        this.currentStreams.forEach((streamInfo, streamId) => {
            this.removeViewer(streamId);
        });
        this.currentStreams.clear();
    }
}

// Initialize Stream Manager
const streamManager = new StreamManager();

// Enhanced Video Modal Class with scrollable content
class VideoModal {
    constructor() {
        this.modal = null;
        this.videoElement = null;
        this.currentVideo = null;
        this.isOpen = false;
        this.progressBar = null;
        this.progressFill = null;
        this.isDragging = false;
        this.init();
    }

    init() {
        // Create modal element
        this.modal = document.createElement('div');
        this.modal.className = 'video-modal';
        this.modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.95);
            z-index: 10000;
            display: none;
            backdrop-filter: blur(10px);
            overflow: hidden;
        `;

        // Modal content with scrollable container
        this.modal.innerHTML = `
            <div class="video-modal-scroll-container" style="
                width: 100%;
                height: 100%;
                overflow-y: auto;
                -webkit-overflow-scrolling: touch;
                scrollbar-width: none;
                -ms-overflow-style: none;
            ">
                <div class="video-modal-scroll-content" style="
                    min-height: 100%;
                    display: flex;
                    flex-direction: column;
                ">
                    <!-- Close button at top (scrollable) -->
                    <div class="video-modal-header" style="
                        position: sticky;
                        top: 0;
                        z-index: 10002;
                        background: linear-gradient(to bottom, rgba(0,0,0,0.9) 0%, transparent 100%);
                        padding: 1.5rem;
                        display: flex;
                        justify-content: flex-end;
                    ">
                        <button class="video-modal-close" style="
                            background: rgba(255,255,255,0.1);
                            border: none;
                            width: 44px;
                            height: 44px;
                            border-radius: 50%;
                            color: white;
                            font-size: 20px;
                            cursor: pointer;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            backdrop-filter: blur(10px);
                            transition: all 0.3s ease;
                        ">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>

                    <!-- Video player container -->
                    <div class="video-modal-player-container" style="
                        flex: 1;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        padding: 1rem;
                        min-height: 60vh;
                    ">
                        <div class="video-modal-player" style="
                            width: 100%;
                            max-width: 800px;
                            background: #000;
                            border-radius: 12px;
                            overflow: hidden;
                            position: relative;
                        ">
                            <!-- Video element -->
                            <video id="modalVideoPlayer" style="
                                width: 100%;
                                height: auto;
                                max-height: 70vh;
                                display: block;
                            " controls playsinline></video>

                            <!-- Custom progress bar -->
                            <div class="video-progress-container" style="
                                position: absolute;
                                bottom: 0;
                                left: 0;
                                width: 100%;
                                height: 4px;
                                background: rgba(255,255,255,0.2);
                                cursor: pointer;
                                z-index: 10001;
                            ">
                                <div class="video-progress-fill" style="
                                    height: 100%;
                                    width: 0%;
                                    background: linear-gradient(to right, #b3004b, #ff2d55);
                                    transition: width 0.1s linear;
                                    position: relative;
                                ">
                                    <div class="video-progress-handle" style="
                                        position: absolute;
                                        right: -6px;
                                        top: 50%;
                                        transform: translateY(-50%);
                                        width: 12px;
                                        height: 12px;
                                        background: white;
                                        border-radius: 50%;
                                        opacity: 0;
                                        transition: opacity 0.2s ease;
                                        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                                    "></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Video info (scrollable) -->
                    <div class="video-modal-info" style="
                        background: #1a1a1a;
                        padding: 2rem;
                        border-radius: 20px 20px 0 0;
                        margin-top: -20px;
                        position: relative;
                        z-index: 10001;
                    ">
                        <div class="video-modal-header-info" style="
                            display: flex;
                            justify-content: space-between;
                            align-items: flex-start;
                            margin-bottom: 1.5rem;
                            flex-wrap: wrap;
                            gap: 1rem;
                        ">
                            <div style="flex: 1; min-width: 200px;">
                                <h3 id="modalVideoTitle" style="
                                    color: white;
                                    margin: 0 0 0.5rem 0;
                                    font-size: 1.5rem;
                                    line-height: 1.3;
                                "></h3>
                                <p id="modalVideoAuthor" style="
                                    color: #b3004b;
                                    margin: 0;
                                    font-size: 1rem;
                                    font-weight: 600;
                                "></p>
                            </div>
                            <div class="video-modal-stats" style="
                                display: flex;
                                gap: 1.5rem;
                                color: #9ca3af;
                                font-size: 0.95rem;
                                flex-wrap: wrap;
                            ">
                                <span id="modalVideoViews" style="display: flex; align-items: center; gap: 0.5rem;">
                                    <i class="fas fa-eye"></i> <span>0</span>
                                </span>
                                <span id="modalVideoLikes" style="display: flex; align-items: center; gap: 0.5rem;">
                                    <i class="fas fa-heart"></i> <span>0</span>
                                </span>
                                <span id="modalVideoComments" style="display: flex; align-items: center; gap: 0.5rem;">
                                    <i class="fas fa-comment"></i> <span>0</span>
                                </span>
                            </div>
                        </div>

                        <!-- Description with "See More" -->
                        <div class="video-modal-description-container" style="margin-bottom: 1.5rem;">
                            <p id="modalVideoDescription" style="
                                color: #d1d5db;
                                margin: 0 0 0.5rem 0;
                                line-height: 1.6;
                                overflow: hidden;
                                display: -webkit-box;
                                -webkit-line-clamp: 3;
                                -webkit-box-orient: vertical;
                            "></p>
                            <button class="see-more-btn" style="
                                background: none;
                                border: none;
                                color: #b3004b;
                                font-size: 0.9rem;
                                cursor: pointer;
                                padding: 0;
                                font-weight: 600;
                                display: none;
                            ">
                                See More
                            </button>
                        </div>

                        <!-- Video actions -->
                        <div class="video-modal-actions" style="
                            display: flex;
                            gap: 1rem;
                            flex-wrap: wrap;
                        ">
                            <button class="video-modal-like" style="
                                background: #b3004b;
                                color: white;
                                border: none;
                                padding: 0.75rem 1.5rem;
                                border-radius: 25px;
                                cursor: pointer;
                                font-weight: 600;
                                display: flex;
                                align-items: center;
                                gap: 0.5rem;
                                font-size: 1rem;
                                transition: all 0.3s ease;
                            ">
                                <i class="far fa-heart"></i> Like
                            </button>
                            <button class="video-modal-share" style="
                                background: #2e2e2e;
                                color: white;
                                border: none;
                                padding: 0.75rem 1.5rem;
                                border-radius: 25px;
                                cursor: pointer;
                                font-weight: 600;
                                display: flex;
                                align-items: center;
                                gap: 0.5rem;
                                font-size: 1rem;
                                transition: all 0.3s ease;
                            ">
                                <i class="fas fa-share"></i> Share
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Append to body
        document.body.appendChild(this.modal);

        // Get elements
        this.videoElement = this.modal.querySelector('#modalVideoPlayer');
        this.closeButton = this.modal.querySelector('.video-modal-close');
        this.likeButton = this.modal.querySelector('.video-modal-like');
        this.shareButton = this.modal.querySelector('.video-modal-share');
        this.descriptionElement = this.modal.querySelector('#modalVideoDescription');
        this.seeMoreBtn = this.modal.querySelector('.see-more-btn');
        this.progressContainer = this.modal.querySelector('.video-progress-container');
        this.progressFill = this.modal.querySelector('.video-progress-fill');
        this.progressHandle = this.modal.querySelector('.video-progress-handle');
        this.scrollContainer = this.modal.querySelector('.video-modal-scroll-container');

        // Add event listeners
        this.closeButton.addEventListener('click', () => this.close());
        this.likeButton.addEventListener('click', () => this.handleLike());
        this.shareButton.addEventListener('click', () => this.handleShare());
        this.seeMoreBtn.addEventListener('click', () => this.toggleDescription());

        // Progress bar events
        if (this.progressContainer) {
            this.progressContainer.addEventListener('mousedown', (e) => this.handleProgressClick(e));
            this.progressContainer.addEventListener('touchstart', (e) => this.handleProgressClick(e));
        }

        // Video time update
        if (this.videoElement) {
            this.videoElement.addEventListener('timeupdate', () => this.updateProgressBar());
            this.videoElement.addEventListener('loadedmetadata', () => this.setupProgressBar());
        }

        // Handle modal scrolling
        if (this.scrollContainer) {
            this.scrollContainer.addEventListener('scroll', () => this.handleScroll());
        }

        // Close modal when clicking outside (on backdrop)
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal && !e.target.closest('.video-modal-player-container')) {
                this.close();
            }
        });

        // Close modal with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });

        // Handle video end
        this.videoElement.addEventListener('ended', () => {
            this.videoElement.currentTime = 0;
            this.updateProgressBar();
        });

        // Prevent body scroll when modal is open
        this.modal.addEventListener('wheel', (e) => {
            if (this.scrollContainer.scrollHeight > this.scrollContainer.clientHeight) {
                e.stopPropagation();
            }
        }, { passive: false });
    }

    async open(videoId) {
        try {
            // Show modal
            this.modal.style.display = 'block';
            this.isOpen = true;
            document.body.style.overflow = 'hidden';

            // Reset scroll position
            if (this.scrollContainer) {
                this.scrollContainer.scrollTop = 0;
            }

            // Get video data
            this.currentVideo = await streamManager.getVideoById(videoId);
            if (!this.currentVideo) {
                throw new Error('Video not found');
            }

            // Update modal content
            const titleElement = this.modal.querySelector('#modalVideoTitle');
            const authorElement = this.modal.querySelector('#modalVideoAuthor');
            const viewsElement = this.modal.querySelector('#modalVideoViews span');
            const likesElement = this.modal.querySelector('#modalVideoLikes span');
            const commentsElement = this.modal.querySelector('#modalVideoComments span');

            titleElement.textContent = this.currentVideo.headline;
            authorElement.textContent = `By ${this.currentVideo.authorName}`;
            viewsElement.textContent = this.currentVideo.viewCount || 0;
            likesElement.textContent = this.currentVideo.likes || 0;
            commentsElement.textContent = this.currentVideo.commentsCount || 0;

            // Handle description with "See More"
            this.updateDescription();

            // Set video source
            this.videoElement.src = this.currentVideo.videoUrl;
            this.videoElement.load();

            // Update like button state
            this.updateLikeButton();

            // Add viewer count
            streamManager.addViewer(videoId);

            // Play video
            await this.videoElement.play().catch(e => {
                console.log('Auto-play prevented:', e);
            });

        } catch (error) {
            console.error('Error opening video modal:', error);
            alert('Error loading video: ' + error.message);
            this.close();
        }
    }

    close() {
        if (this.videoElement) {
            this.videoElement.pause();
            this.videoElement.src = '';
        }
        this.modal.style.display = 'none';
        this.isOpen = false;
        document.body.style.overflow = 'auto';

        // Remove viewer count
        if (this.currentVideo) {
            streamManager.removeViewer(this.currentVideo.id);
        }
        this.currentVideo = null;
    }

    updateDescription() {
        const description = this.currentVideo.description || 'No description provided';
        const maxLength = 150;
        
        if (description.length > maxLength) {
            this.descriptionElement.textContent = description.substring(0, maxLength) + '...';
            this.seeMoreBtn.style.display = 'block';
            this.descriptionElement.dataset.fullText = description;
        } else {
            this.descriptionElement.textContent = description;
            this.seeMoreBtn.style.display = 'none';
        }
    }

    toggleDescription() {
        const fullText = this.descriptionElement.dataset.fullText;
        if (fullText) {
            if (this.descriptionElement.style.webkitLineClamp) {
                this.descriptionElement.style.webkitLineClamp = 'unset';
                this.seeMoreBtn.textContent = 'See Less';
            } else {
                this.descriptionElement.style.webkitLineClamp = '3';
                this.seeMoreBtn.textContent = 'See More';
            }
        }
    }

    setupProgressBar() {
        if (!this.videoElement || !this.progressFill) return;
        
        this.progressFill.style.width = '0%';
        this.progressHandle.style.opacity = '0';
    }

    updateProgressBar() {
        if (!this.videoElement || !this.progressFill || !this.videoElement.duration) return;
        
        const progress = (this.videoElement.currentTime / this.videoElement.duration) * 100;
        this.progressFill.style.width = `${progress}%`;
    }

    handleProgressClick(e) {
        if (!this.videoElement || !this.progressContainer) return;
        
        e.preventDefault();
        this.isDragging = true;
        
        const rect = this.progressContainer.getBoundingClientRect();
        const clickX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        const percent = Math.max(0, Math.min(1, (clickX - rect.left) / rect.width));
        
        this.videoElement.currentTime = percent * this.videoElement.duration;
        this.updateProgressBar();
        
        // Show handle
        this.progressHandle.style.opacity = '1';
        
        // Add move and end listeners
        const handleMove = (moveEvent) => {
            if (!this.isDragging) return;
            
            const moveX = moveEvent.type.includes('touch') ? moveEvent.touches[0].clientX : moveEvent.clientX;
            const movePercent = Math.max(0, Math.min(1, (moveX - rect.left) / rect.width));
            
            this.videoElement.currentTime = movePercent * this.videoElement.duration;
            this.updateProgressBar();
        };
        
        const handleEnd = () => {
            this.isDragging = false;
            this.progressHandle.style.opacity = '0';
            
            document.removeEventListener('mousemove', handleMove);
            document.removeEventListener('touchmove', handleMove);
            document.removeEventListener('mouseup', handleEnd);
            document.removeEventListener('touchend', handleEnd);
        };
        
        document.addEventListener('mousemove', handleMove);
        document.addEventListener('touchmove', handleMove, { passive: false });
        document.addEventListener('mouseup', handleEnd);
        document.addEventListener('touchend', handleEnd);
    }

    handleScroll() {
        // Optional: Add parallax or other scroll effects
        const scrollTop = this.scrollContainer.scrollTop;
        const header = this.modal.querySelector('.video-modal-header');
        
        if (header) {
            if (scrollTop > 50) {
                header.style.background = 'rgba(0,0,0,0.9)';
            } else {
                header.style.background = 'linear-gradient(to bottom, rgba(0,0,0,0.9) 0%, transparent 100%)';
            }
        }
    }

    updateLikeButton() {
        if (!this.currentVideo) return;

        const isLiked = likedStreams.has(this.currentVideo.id);
        const icon = this.likeButton.querySelector('i');
        icon.className = isLiked ? 'fas fa-heart' : 'far fa-heart';
        this.likeButton.innerHTML = isLiked ? 
            '<i class="fas fa-heart"></i> Liked' : 
            '<i class="far fa-heart"></i> Like';
    }

    async handleLike() {
        if (!this.currentVideo) return;

        try {
            const result = await streamManager.handleLike(this.currentVideo.id, this.likeButton);
            if (result) {
                this.updateLikeButton();
                const likesElement = this.modal.querySelector('#modalVideoLikes span');
                likesElement.textContent = result.likes;
            }
        } catch (error) {
            console.error('Error liking video:', error);
        }
    }

    async handleShare() {
        if (!this.currentVideo) return;

        const shareText = `Check out this video: ${this.currentVideo.headline}`;
        const shareUrl = window.location.origin + '/stream.html';

        if (navigator.share) {
            try {
                await navigator.share({
                    title: this.currentVideo.headline,
                    text: this.currentVideo.description || shareText,
                    url: shareUrl
                });
            } catch (error) {
                console.log('Share cancelled:', error);
            }
        } else {
            try {
                await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
                alert('Link copied to clipboard!');
            } catch (err) {
                console.error('Failed to copy:', err);
                alert('Failed to copy link. Please try again.');
            }
        }
    }
}

// Enhanced TikTok Feed Class with all requested features
class TikTokFeed {
    constructor() {
        this.videoFeed = document.getElementById('videoFeed');
        this.currentIndex = 0;
        this.videos = [];
        this.isSwiping = false;
        this.startY = 0;
        this.currentY = 0;
        this.isDragging = false;
        this.dragY = 0;
        this.currentStreamId = null;
        this.videoElements = new Map();
        this.commentsModal = document.getElementById('commentsModal');
        this.modalCommentsList = document.getElementById('modalCommentsList');
        this.modalCommentInput = document.getElementById('modalCommentInput');
        this.modalSendComment = document.getElementById('modalSendComment');
        this.closeComments = document.getElementById('closeComments');
        this.replyTo = null;
        this.isScrolling = false;
        this.scrollVelocity = 0;
        this.lastScrollTime = 0;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadInitialVideos();
        this.hideSwipeIndicator();
        this.setupSmoothScrolling();
    }

    setupSmoothScrolling() {
        // Enable momentum scrolling
        this.videoFeed.style.webkitOverflowScrolling = 'touch';
        
        // Add smooth scroll behavior
        let lastTouchY = 0;
        let touchStartY = 0;
        let touchStartTime = 0;
        let isTouchScrolling = false;

        this.videoFeed.addEventListener('touchstart', (e) => {
            touchStartY = e.touches[0].clientY;
            touchStartTime = Date.now();
            isTouchScrolling = true;
            this.isScrolling = true;
        });

        this.videoFeed.addEventListener('touchmove', (e) => {
            if (!isTouchScrolling) return;
            
            const touchY = e.touches[0].clientY;
            const deltaY = touchY - lastTouchY;
            lastTouchY = touchY;
            
            // Apply smooth deceleration
            this.scrollVelocity = deltaY;
            this.lastScrollTime = Date.now();
        });

        this.videoFeed.addEventListener('touchend', () => {
            isTouchScrolling = false;
            
            // Apply momentum scrolling
            if (this.scrollVelocity !== 0) {
                const duration = Date.now() - touchStartTime;
                const momentum = this.scrollVelocity * (duration / 1000);
                
                let remainingMomentum = Math.abs(momentum);
                const direction = momentum > 0 ? 1 : -1;
                
                const applyMomentum = () => {
                    if (remainingMomentum > 0.1) {
                        remainingMomentum *= 0.95; // Deceleration factor
                        
                        // Apply scroll
                        window.requestAnimationFrame(applyMomentum);
                    } else {
                        this.isScrolling = false;
                        this.scrollVelocity = 0;
                    }
                };
                
                applyMomentum();
            } else {
                this.isScrolling = false;
            }
        });
    }

    setupEventListeners() {
        // Touch events for swiping
        if (this.videoFeed) {
            this.videoFeed.addEventListener('touchstart', (e) => this.handleTouchStart(e));
            this.videoFeed.addEventListener('touchmove', (e) => this.handleTouchMove(e));
            this.videoFeed.addEventListener('touchend', (e) => this.handleTouchEnd(e));

            // Mouse events for desktop
            this.videoFeed.addEventListener('mousedown', (e) => this.handleMouseDown(e));
            this.videoFeed.addEventListener('mousemove', (e) => this.handleMouseMove(e));
            this.videoFeed.addEventListener('mouseup', (e) => this.handleMouseUp(e));
            this.videoFeed.addEventListener('mouseleave', (e) => this.handleMouseLeave(e));

            // VIDEO CLICK EVENTS - TIKTOK-LIKE CONTROLS
            this.videoFeed.addEventListener('click', (e) => this.handleVideoClick(e));
        }

        // Comments modal
        if (this.closeComments) {
            this.closeComments.addEventListener('click', () => this.closeCommentsModal());
        }

        if (this.modalSendComment) {
            this.modalSendComment.addEventListener('click', () => this.handleAddComment());
        }

        if (this.modalCommentInput) {
            this.modalCommentInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.handleAddComment();
            });
            
            this.modalCommentInput.addEventListener('input', (e) => {
                const value = e.target.value;
                if (!value.startsWith('@')) {
                    this.clearReply();
                }
            });
        }

        // Close modal when clicking outside
        if (this.commentsModal) {
            this.commentsModal.addEventListener('click', (e) => {
                if (e.target === this.commentsModal) {
                    this.closeCommentsModal();
                }
            });
        }

        // Handle visibility change
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pauseCurrentVideo();
            } else {
                this.playCurrentVideo();
            }
        });

        // Prevent default scroll behavior
        document.addEventListener('touchmove', (e) => {
            if (this.isSwiping && e.target.closest('.video-feed')) {
                e.preventDefault();
            }
        }, { passive: false });

        // Handle escape key to clear reply
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.replyTo) {
                this.clearReply();
            }
        });

        // Handle window resize
        window.addEventListener('resize', () => {
            this.adjustVideoSizes();
        });
    }

    // TIKTOK-LIKE VIDEO CONTROLS
    handleVideoClick(e) {
        if (e.target.closest('.side-action, .video-side-actions, .video-info-overlay, .video-progress-container')) {
            return;
        }
        
        const videoSlide = e.target.closest('.video-slide');
        if (!videoSlide || !videoSlide.classList.contains('active')) {
            return;
        }
        
        const streamId = videoSlide.dataset.streamId;
        const videoData = this.videoElements.get(streamId);
        
        if (!videoData || !videoData.videoElement) {
            return;
        }
        
        const video = videoData.videoElement;
        const now = Date.now();
        
        // Check for double click (within 300ms)
        if (now - lastClickTime < 300) {
            // Double click detected
            clearTimeout(clickTimeout);
            lastClickTime = 0;
            this.handleDoubleClick(video, videoSlide);
        } else {
            // Single click - handle after delay
            lastClickTime = now;
            clickTimeout = setTimeout(() => {
                this.handleSingleClick(video, videoSlide);
            }, 300);
        }
    }

    handleSingleClick(video, videoSlide) {
        // Toggle play/pause
        if (video.paused) {
            video.play().catch(e => console.log('Play failed:', e));
            this.hidePlayPauseOverlay(videoSlide);
        } else {
            video.pause();
            this.showPlayPauseOverlay(videoSlide, 'pause');
        }
    }

    handleDoubleClick(video, videoSlide) {
        // Fast forward 10 seconds
        video.currentTime = Math.min(video.duration, video.currentTime + 10);
        
        // Show fast forward overlay
        this.showFastForwardOverlay(videoSlide);
        
        // Play if paused
        if (video.paused) {
            video.play().catch(e => console.log('Play failed:', e));
        }
    }

    showPlayPauseOverlay(videoSlide, state) {
        this.removeVideoOverlay(videoSlide);
        
        const overlay = document.createElement('div');
        overlay.className = 'video-click-overlay';
        overlay.innerHTML = `<i class="fas fa-${state === 'pause' ? 'pause' : 'play'}"></i>`;
        
        videoSlide.appendChild(overlay);
        
        setTimeout(() => {
            if (overlay.parentNode) {
                overlay.remove();
            }
        }, 1000);
    }

    showFastForwardOverlay(videoSlide) {
        this.removeVideoOverlay(videoSlide);
        
        const overlay = document.createElement('div');
        overlay.className = 'video-click-overlay fast-forward';
        overlay.innerHTML = `<i class="fas fa-forward"></i><span>+10s</span>`;
        
        videoSlide.appendChild(overlay);
        
        setTimeout(() => {
            if (overlay.parentNode) {
                overlay.remove();
            }
        }, 1000);
    }

    hidePlayPauseOverlay(videoSlide) {
        this.removeVideoOverlay(videoSlide);
    }

    removeVideoOverlay(videoSlide) {
        const existingOverlay = videoSlide.querySelector('.video-click-overlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }
    }

    handleTouchStart(e) {
        if (this.isScrolling) return;
        
        this.startY = e.touches[0].clientY;
        this.currentY = this.startY;
        this.isSwiping = true;
        this.isDragging = true;
        this.dragY = 0;
        this.videoFeed.style.transition = 'none';
    }

    handleTouchMove(e) {
        if (!this.isSwiping || !this.isDragging || this.isScrolling) return;
        
        e.preventDefault();
        this.currentY = e.touches[0].clientY;
        this.dragY = this.currentY - this.startY;
        
        // Apply smooth rubber band effect
        const resistance = 0.5;
        let adjustedDragY = this.dragY;
        
        if (this.dragY < 0 && this.currentIndex >= this.videos.length - 1) {
            // Pull down from bottom
            adjustedDragY = this.dragY * resistance;
        } else if (this.dragY > 0 && this.currentIndex <= 0) {
            // Pull up from top
            adjustedDragY = this.dragY * resistance;
        }
        
        this.videoFeed.style.transform = `translateY(${adjustedDragY}px)`;
    }

    handleTouchEnd(e) {
        if (!this.isSwiping || !this.isDragging) return;
        
        const slideHeight = window.innerHeight;
        const threshold = slideHeight * 0.15;
        const velocity = Math.abs(this.dragY) / (Date.now() - this.lastScrollTime);
        
        // Consider velocity for more natural scrolling
        const effectiveThreshold = velocity > 0.5 ? threshold * 0.7 : threshold;
        
        if (Math.abs(this.dragY) > effectiveThreshold) {
            if (this.dragY < 0 && this.currentIndex < this.videos.length - 1) {
                this.changeVideo(this.currentIndex + 1);
            } else if (this.dragY > 0 && this.currentIndex > 0) {
                this.changeVideo(this.currentIndex - 1);
            }
        }
        
        // Smooth return animation
        this.videoFeed.style.transition = 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        this.videoFeed.style.transform = 'translateY(0px)';
        
        setTimeout(() => {
            this.videoFeed.style.transition = '';
        }, 400);
        
        this.isSwiping = false;
        this.isDragging = false;
        this.dragY = 0;
    }

    handleMouseDown(e) {
        this.startY = e.clientY;
        this.currentY = this.startY;
        this.isSwiping = true;
        this.isDragging = true;
        this.dragY = 0;
        this.videoFeed.style.transition = 'none';
    }

    handleMouseMove(e) {
        if (!this.isSwiping || !this.isDragging) return;
        this.currentY = e.clientY;
        this.dragY = this.currentY - this.startY;
        
        this.videoFeed.style.transform = `translateY(${this.dragY}px)`;
    }

    handleMouseUp(e) {
        if (!this.isSwiping || !this.isDragging) return;
        
        const slideHeight = window.innerHeight;
        const threshold = slideHeight * 0.15;
        
        if (Math.abs(this.dragY) > threshold) {
            if (this.dragY < 0 && this.currentIndex < this.videos.length - 1) {
                this.changeVideo(this.currentIndex + 1);
            } else if (this.dragY > 0 && this.currentIndex > 0) {
                this.changeVideo(this.currentIndex - 1);
            }
        }
        
        this.videoFeed.style.transition = 'transform 0.3s ease-out';
        this.videoFeed.style.transform = 'translateY(0px)';
        
        setTimeout(() => {
            this.videoFeed.style.transition = '';
        }, 300);
        
        this.isSwiping = false;
        this.isDragging = false;
        this.dragY = 0;
    }

    handleMouseLeave(e) {
        this.isSwiping = false;
        this.isDragging = false;
        this.dragY = 0;
        this.videoFeed.style.transform = 'translateY(0px)';
    }

    async loadInitialVideos() {
        try {
            const streams = await streamManager.getStreams('all');
            this.videos = streams;
            this.renderVideos();
            
            // Start from random video
            const randomIndex = Math.floor(Math.random() * this.videos.length);
            this.showVideo(randomIndex);
            
            // Start caching videos
            this.startVideoCaching();
            
            const loadingOverlay = document.getElementById('loadingOverlay');
            if (loadingOverlay) {
                loadingOverlay.classList.add('hidden');
            }
            
            this.updateTotalViewers(streams);
            
            // Setup real-time listener
            streamManager.listenToStreams((streams) => {
                const currentIds = this.videos.map(v => v.id).sort();
                const newIds = streams.map(v => v.id).sort();
                
                const videosChanged = JSON.stringify(currentIds) !== JSON.stringify(newIds);
                
                if (videosChanged) {
                    this.videos = streams;
                    this.renderVideos();
                    
                    if (this.currentIndex >= 0 && this.currentIndex < this.videos.length) {
                        const currentVideoId = this.videos[this.currentIndex]?.id;
                        if (currentVideoId) {
                            setTimeout(() => {
                                this.showVideo(this.currentIndex);
                            }, 100);
                        }
                    }
                    
                    // Update cache
                    this.startVideoCaching();
                }
                
                this.updateTotalViewers(streams);
            }, 'all');
            
        } catch (error) {
            console.error('Error loading videos:', error);
            const loadingOverlay = document.getElementById('loadingOverlay');
            if (loadingOverlay) {
                loadingOverlay.innerHTML = `
                    <div style="text-align: center;">
                        <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 20px;"></i>
                        <div>Error loading videos</div>
                        <button onclick="window.location.reload()" style="margin-top: 20px; padding: 10px 20px; background: #ff2d55; border: none; border-radius: 10px; color: white; cursor: pointer;">
                            Retry
                        </button>
                    </div>
                `;
            }
        }
    }

    startVideoCaching() {
        // Cache initial 5 videos
        videoCache.cacheVideos(this.videos, 0);
        
        // Cache next batch when user reaches near the end
        const checkCache = () => {
            if (this.currentIndex >= this.videos.length - 3) {
                videoCache.cacheVideos(this.videos, this.currentIndex + 1);
            }
        };
        
        // Check cache every 30 seconds
        setInterval(checkCache, 30000);
    }

    renderVideos() {
        if (!this.videoFeed) return;
        
        const now = Date.now();
        if (isRendering || (now - lastRenderTime < 1000)) {
            console.log('Skipping render - too frequent');
            return;
        }
        
        isRendering = true;
        lastRenderTime = now;
        
        const currentVideoId = this.currentIndex >= 0 && this.currentIndex < this.videos.length 
            ? this.videos[this.currentIndex].id 
            : null;
        const wasPlaying = currentVideoId ? 
            (this.videoElements.get(currentVideoId)?.videoElement?.paused === false) : false;
        
        // Get existing slides to preserve video elements
        const existingSlides = Array.from(this.videoFeed.children);
        
        // Clear only if necessary (when videos have changed significantly)
        if (existingSlides.length !== this.videos.length) {
            this.videoFeed.innerHTML = '';
            existingSlides.forEach(slide => {
                const videoElement = slide.querySelector('video');
                if (videoElement) {
                    videoElement.pause();
                    videoElement.src = '';
                    videoElement.load();
                }
            });
        }
        
        // Track which videos we have rendered
        const renderedVideoIds = new Set();
        
        this.videos.forEach((video, index) => {
            // Check if this video already exists in the DOM
            const existingSlide = existingSlides.find(slide => 
                slide.dataset.streamId === video.id
            );
            
            if (existingSlide) {
                // Update existing slide
                existingSlide.dataset.index = index;
                existingSlide.className = 'video-slide';
                
                // Update video info
                this.updateVideoSlide(existingSlide, video, index);
                renderedVideoIds.add(video.id);
                
                // Keep the existing video element
                const videoElement = existingSlide.querySelector('video');
                if (videoElement) {
                    this.videoElements.set(video.id, {
                        slide: existingSlide,
                        videoElement: videoElement,
                        loadingElement: existingSlide.querySelector(`#loading-${video.id}`),
                        progressContainer: existingSlide.querySelector('.video-progress-container'),
                        progressFill: existingSlide.querySelector('.video-progress-fill'),
                        progressHandle: existingSlide.querySelector('.video-progress-handle'),
                        descriptionElement: existingSlide.querySelector('.video-description'),
                        seeMoreBtn: existingSlide.querySelector('.video-see-more')
                    });
                }
            } else {
                // Create new slide
                const slide = this.createVideoSlide(video, index);
                this.videoFeed.appendChild(slide);
                renderedVideoIds.add(video.id);
            }
        });
        
        // Remove any slides that are no longer in the videos array
        existingSlides.forEach(slide => {
            const streamId = slide.dataset.streamId;
            if (!renderedVideoIds.has(streamId)) {
                const videoElement = slide.querySelector('video');
                if (videoElement) {
                    videoElement.pause();
                    videoElement.src = '';
                    videoElement.load();
                }
                slide.remove();
                this.videoElements.delete(streamId);
            }
        });
        
        // Ensure slides are in correct order
        this.videos.forEach((video, index) => {
            const slide = this.videoFeed.querySelector(`[data-stream-id="${video.id}"]`);
            if (slide && slide.dataset.index !== index.toString()) {
                slide.dataset.index = index;
            }
        });
        
        // Restore current video position
        if (currentVideoId) {
            const newIndex = this.videos.findIndex(v => v.id === currentVideoId);
            if (newIndex >= 0) {
                this.currentIndex = newIndex;
                setTimeout(() => {
                    this.showVideo(newIndex);
                    if (wasPlaying) {
                        setTimeout(() => this.playCurrentVideo(), 200);
                    }
                }, 50);
            }
        }
        
        isRendering = false;
    }

    createVideoSlide(video, index) {
        const slide = document.createElement('div');
        slide.className = 'video-slide';
        slide.dataset.index = index;
        slide.dataset.streamId = video.id;
        
        const thumbnailUrl = getVideoThumbnail(video);
        const isLiked = likedStreams.has(video.id);
        const description = video.description || '';
        const shouldShowSeeMore = description.length > 100;
        const displayDescription = shouldShowSeeMore ? 
            description.substring(0, 100) + '...' : description;
        
        slide.innerHTML = `
            <div class="video-container">
                <video id="video-${video.id}" playsinline preload="none" 
                       poster="${thumbnailUrl}" style="display: none;">
                    <source src="${video.videoUrl}" type="video/mp4">
                </video>
                <div class="video-loading" id="loading-${video.id}">
                    <i class="fas fa-spinner fa-spin"></i>
                    <div>Loading video...</div>
                </div>
                
                <!-- Progress Bar -->
                <div class="video-progress-container">
                    <div class="video-progress-fill" style="width: 0%">
                        <div class="video-progress-handle"></div>
                    </div>
                </div>
            </div>
            
            <div class="video-info-overlay">
                <!-- Profile picture now links to user's profile -->
                <div class="video-author" onclick="navigateToUserProfile('${video.authorId}')" style="cursor: pointer;">
                    <img src="${video.authorImage || 'images-defaultse-profile.jpg'}" 
                         alt="${video.authorName}" 
                         class="video-author-avatar">
                    <div class="video-author-info">
                        <div class="video-author-name">${video.authorName}</div>
                    </div>
                </div>
                <div class="video-headline">${video.headline}</div>
                <div class="video-description-container">
                    <div class="video-description">${displayDescription}</div>
                    ${shouldShowSeeMore ? '<button class="video-see-more">See More</button>' : ''}
                </div>
                <div class="video-category">${formatCategory(video.category)}</div>
            </div>
            
            <div class="video-side-actions">
                <button class="side-action like-btn ${isLiked ? 'liked' : ''}" 
                        data-stream-id="${video.id}">
                    <div class="side-action-icon">
                        <i class="${isLiked ? 'fas' : 'far'} fa-heart"></i>
                    </div>
                    <div class="side-action-count like-count">${video.likes || 0}</div>
                </button>
                
                <button class="side-action comment-btn" 
                        data-stream-id="${video.id}">
                    <div class="side-action-icon">
                        <i class="far fa-comment"></i>
                    </div>
                    <div class="side-action-count comment-count">${video.commentsCount || 0}</div>
                </button>
                
                <button class="side-action share-btn" 
                        data-stream-id="${video.id}">
                    <div class="side-action-icon">
                        <i class="far fa-share-square"></i>
                    </div>
                    <div class="side-action-count">Share</div>
                </button>
            </div>
        `;
        
        this.setupVideoSlideEventListeners(slide, video);
        
        this.videoElements.set(video.id, {
            slide: slide,
            videoElement: null,
            loadingElement: slide.querySelector(`#loading-${video.id}`),
            progressContainer: slide.querySelector('.video-progress-container'),
            progressFill: slide.querySelector('.video-progress-fill'),
            progressHandle: slide.querySelector('.video-progress-handle'),
            descriptionElement: slide.querySelector('.video-description'),
            seeMoreBtn: slide.querySelector('.video-see-more')
        });
        
        return slide;
    }

    updateVideoSlide(slide, video, index) {
        const thumbnailUrl = getVideoThumbnail(video);
        const isLiked = likedStreams.has(video.id);
        const description = video.description || '';
        const shouldShowSeeMore = description.length > 100;
        const displayDescription = shouldShowSeeMore ? 
            description.substring(0, 100) + '...' : description;
        
        // Update thumbnail if needed
        const videoElement = slide.querySelector('video');
        if (videoElement && videoElement.poster !== thumbnailUrl) {
            videoElement.poster = thumbnailUrl;
        }
        
        // Update video source if needed
        if (videoElement && videoElement.querySelector('source').src !== video.videoUrl) {
            videoElement.querySelector('source').src = video.videoUrl;
            if (videoElement.dataset.listenersAdded !== 'true') {
                videoElement.load();
            }
        }
        
        // Update content
        const authorName = slide.querySelector('.video-author-name');
        if (authorName) authorName.textContent = video.authorName;
        
        const headline = slide.querySelector('.video-headline');
        if (headline) headline.textContent = video.headline;
        
        const descriptionElement = slide.querySelector('.video-description');
        if (descriptionElement) {
            descriptionElement.textContent = displayDescription;
            if (shouldShowSeeMore) {
                descriptionElement.dataset.fullText = description;
            }
        }
        
        const seeMoreBtn = slide.querySelector('.video-see-more');
        if (seeMoreBtn) {
            seeMoreBtn.style.display = shouldShowSeeMore ? 'block' : 'none';
        }
        
        const category = slide.querySelector('.video-category');
        if (category) category.textContent = formatCategory(video.category);
        
        const likeBtn = slide.querySelector('.like-btn');
        if (likeBtn) {
            likeBtn.className = `side-action like-btn ${isLiked ? 'liked' : ''}`;
            likeBtn.dataset.streamId = video.id;
            const likeIcon = likeBtn.querySelector('.side-action-icon i');
            if (likeIcon) likeIcon.className = isLiked ? 'fas fa-heart' : 'far fa-heart';
            const likeCount = likeBtn.querySelector('.like-count');
            if (likeCount) likeCount.textContent = video.likes || 0;
        }
        
        const commentBtn = slide.querySelector('.comment-btn');
        if (commentBtn) {
            commentBtn.dataset.streamId = video.id;
            const commentCount = commentBtn.querySelector('.comment-count');
            if (commentCount) commentCount.textContent = video.commentsCount || 0;
        }
        
        const shareBtn = slide.querySelector('.share-btn');
        if (shareBtn) {
            shareBtn.dataset.streamId = video.id;
        }
        
        // Update author image
        const authorAvatar = slide.querySelector('.video-author-avatar');
        if (authorAvatar) {
            authorAvatar.src = video.authorImage || 'images-defaultse-profile.jpg';
            authorAvatar.alt = video.authorName;
        }
        
        // Update author click handler
        const authorDiv = slide.querySelector('.video-author');
        if (authorDiv) {
            authorDiv.onclick = () => navigateToUserProfile(video.authorId);
        }
        
        // Re-attach event listeners if needed
        this.setupVideoSlideEventListeners(slide, video);
    }

    setupVideoSlideEventListeners(slide, video) {
        const likeBtn = slide.querySelector('.like-btn');
        const commentBtn = slide.querySelector('.comment-btn');
        const shareBtn = slide.querySelector('.share-btn');
        const seeMoreBtn = slide.querySelector('.video-see-more');
        const progressContainer = slide.querySelector('.video-progress-container');
        
        // Remove existing listeners
        const newLikeBtn = likeBtn.cloneNode(true);
        if (likeBtn.parentNode) {
            likeBtn.parentNode.replaceChild(newLikeBtn, likeBtn);
        }
        
        const newCommentBtn = commentBtn.cloneNode(true);
        if (commentBtn.parentNode) {
            commentBtn.parentNode.replaceChild(newCommentBtn, commentBtn);
        }
        
        const newShareBtn = shareBtn.cloneNode(true);
        if (shareBtn.parentNode) {
            shareBtn.parentNode.replaceChild(newShareBtn, shareBtn);
        }
        
        // Add new listeners
        if (newLikeBtn) {
            newLikeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleLike(video.id, newLikeBtn);
            });
        }
        
        if (newCommentBtn) {
            newCommentBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openCommentsModal(video.id);
            });
        }
        
        if (newShareBtn) {
            newShareBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.shareVideo(video.id);
            });
        }
        
        if (seeMoreBtn) {
            seeMoreBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleDescription(video.id);
            });
        }
        
        if (progressContainer) {
            progressContainer.addEventListener('mousedown', (e) => this.handleProgressClick(e, video.id));
            progressContainer.addEventListener('touchstart', (e) => this.handleProgressClick(e, video.id));
        }
    }

    showVideo(index) {
        if (index < 0 || index >= this.videos.length) return;
        
        // Remove active/next classes from all slides
        this.videoElements.forEach((videoData, videoId) => {
            if (videoData.slide) {
                videoData.slide.classList.remove('active', 'next');
            }
        });
        
        const currentSlide = this.videoElements.get(this.videos[index].id)?.slide;
        if (currentSlide) {
            currentSlide.classList.add('active');
            this.currentIndex = index;
            const videoId = this.videos[index].id;
            this.loadAndPlayVideo(videoId);
            
            // Add next class to next slide if exists
            if (index + 1 < this.videos.length) {
                const nextVideoId = this.videos[index + 1].id;
                const nextSlide = this.videoElements.get(nextVideoId)?.slide;
                if (nextSlide) {
                    nextSlide.classList.add('next');
                    
                    // Preload next video from cache if available
                    const cachedVideo = videoCache.getCachedVideo(nextVideoId);
                    if (cachedVideo && cachedVideo.loaded) {
                        // Video is already cached, no need to preload
                    }
                }
            }
            
            // Cache more videos
            videoCache.cacheVideos(this.videos, index + 1);
        }
    }

    changeVideo(newIndex) {
        if (newIndex < 0 || newIndex >= this.videos.length) return;
        
        this.pauseCurrentVideo();
        
        if (this.currentIndex >= 0 && this.currentIndex < this.videos.length) {
            const prevVideoId = this.videos[this.currentIndex].id;
            if (currentUser) {
                streamManager.removeViewer(prevVideoId);
            }
        }
        
        this.showVideo(newIndex);
        
        const newVideoId = this.videos[newIndex].id;
        if (currentUser) {
            streamManager.addViewer(newVideoId);
        }
    }

    async loadAndPlayVideo(videoId) {
        const videoData = this.videoElements.get(videoId);
        if (!videoData) return;
        
        const { slide, loadingElement } = videoData;
        let videoElement = slide.querySelector(`#video-${videoId}`);
        if (!videoElement) return;
        
        // Check if video is cached
        const cachedVideo = videoCache.getCachedVideo(videoId);
        if (cachedVideo && cachedVideo.loaded) {
            // Use cached video element
            const newVideoElement = cachedVideo.element.cloneNode();
            newVideoElement.id = `video-${videoId}`;
            newVideoElement.poster = videoElement.poster;
            
            // Replace existing video element
            const videoContainer = slide.querySelector('.video-container');
            const existingVideo = slide.querySelector(`#video-${videoId}`);
            if (existingVideo) {
                existingVideo.remove();
            }
            videoContainer.prepend(newVideoElement);
            videoElement = newVideoElement;
        }
        
        videoData.videoElement = videoElement;
        
        // Pause other videos
        this.videoElements.forEach((data, id) => {
            if (id !== videoId && data.videoElement && !data.videoElement.paused) {
                data.videoElement.pause();
                if (data.loadingElement) {
                    data.loadingElement.style.display = 'none';
                }
            }
        });
        
        if (!videoElement.dataset.listenersAdded) {
            videoElement.addEventListener('loadeddata', () => {
                if (loadingElement) {
                    loadingElement.style.display = 'none';
                }
                videoElement.style.display = 'block';
                this.playCurrentVideo();
            });
            
            videoElement.addEventListener('canplay', () => {
                if (loadingElement) {
                    loadingElement.style.display = 'none';
                }
                videoElement.style.display = 'block';
            });
            
            videoElement.addEventListener('waiting', () => {
                if (loadingElement) {
                    loadingElement.style.display = 'block';
                }
            });
            
            videoElement.addEventListener('playing', () => {
                if (loadingElement) {
                    loadingElement.style.display = 'none';
                }
            });
            
            videoElement.addEventListener('timeupdate', () => {
                this.updateProgressBar(videoId);
            });
            
            videoElement.addEventListener('loadedmetadata', () => {
                this.setupProgressBar(videoId);
            });
            
            videoElement.addEventListener('error', (e) => {
                console.error('Video error:', e);
                if (loadingElement) {
                    loadingElement.innerHTML = `
                        <i class="fas fa-exclamation-triangle"></i>
                        <div>Failed to load video</div>
                        <button onclick="tiktokFeedInstance.retryVideo('${videoId}')" 
                                style="margin-top: 10px; padding: 5px 10px; background: #ff2d55; border: none; border-radius: 5px; color: white; cursor: pointer;">
                            Retry
                        </button>
                    `;
                }
            });
            
            videoElement.dataset.listenersAdded = 'true';
        }
        
        if (loadingElement) {
            loadingElement.style.display = 'block';
            loadingElement.innerHTML = `
                <i class="fas fa-spinner fa-spin"></i>
                <div>Loading video...</div>
            `;
        }
        
        // Only reload if needed
        const currentVideo = this.videos.find(v => v.id === videoId);
        if (currentVideo && (!videoElement.src || videoElement.src !== currentVideo.videoUrl)) {
            videoElement.src = currentVideo.videoUrl;
            videoElement.load();
        } else if (videoElement.readyState >= 2) {
            if (loadingElement) {
                loadingElement.style.display = 'none';
            }
            videoElement.style.display = 'block';
            this.playCurrentVideo();
        }
    }

    setupProgressBar(videoId) {
        const videoData = this.videoElements.get(videoId);
        if (!videoData || !videoData.progressFill || !videoData.videoElement) return;
        
        videoData.progressFill.style.width = '0%';
        if (videoData.progressHandle) {
            videoData.progressHandle.style.opacity = '0';
        }
    }

    updateProgressBar(videoId) {
        const videoData = this.videoElements.get(videoId);
        if (!videoData || !videoData.progressFill || !videoData.videoElement || !videoData.videoElement.duration) return;
        
        const progress = (videoData.videoElement.currentTime / videoData.videoElement.duration) * 100;
        videoData.progressFill.style.width = `${progress}%`;
    }

    handleProgressClick(e, videoId) {
        const videoData = this.videoElements.get(videoId);
        if (!videoData || !videoData.videoElement || !videoData.progressContainer) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        const rect = videoData.progressContainer.getBoundingClientRect();
        const clickX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        const percent = Math.max(0, Math.min(1, (clickX - rect.left) / rect.width));
        
        videoData.videoElement.currentTime = percent * videoData.videoElement.duration;
        this.updateProgressBar(videoId);
        
        if (videoData.progressHandle) {
            videoData.progressHandle.style.opacity = '1';
            
            setTimeout(() => {
                if (videoData.progressHandle) {
                    videoData.progressHandle.style.opacity = '0';
                }
            }, 1000);
        }
    }

    toggleDescription(videoId) {
        const videoData = this.videoElements.get(videoId);
        if (!videoData || !videoData.descriptionElement || !videoData.seeMoreBtn) return;
        
        const video = this.videos.find(v => v.id === videoId);
        if (!video) return;
        
        const fullDescription = video.description || '';
        const isExpanded = videoData.descriptionElement.style.webkitLineClamp === 'unset';
        
        if (isExpanded) {
            videoData.descriptionElement.style.webkitLineClamp = '3';
            videoData.descriptionElement.textContent = fullDescription.substring(0, 100) + '...';
            videoData.seeMoreBtn.textContent = 'See More';
        } else {
            videoData.descriptionElement.style.webkitLineClamp = 'unset';
            videoData.descriptionElement.textContent = fullDescription;
            videoData.seeMoreBtn.textContent = 'See Less';
        }
    }

    playCurrentVideo() {
        if (this.currentIndex >= 0 && this.currentIndex < this.videos.length) {
            const videoId = this.videos[this.currentIndex].id;
            const videoData = this.videoElements.get(videoId);
            
            if (videoData && videoData.videoElement) {
                const playPromise = videoData.videoElement.play();
                if (playPromise !== undefined) {
                    playPromise.catch(error => {
                        console.log('Auto-play prevented:', error);
                    });
                }
            }
        }
    }

    pauseCurrentVideo() {
        if (this.currentIndex >= 0 && this.currentIndex < this.videos.length) {
            const videoId = this.videos[this.currentIndex].id;
            const videoData = this.videoElements.get(videoId);
            
            if (videoData && videoData.videoElement) {
                videoData.videoElement.pause();
            }
        }
    }

    retryVideo(videoId) {
        const videoData = this.videoElements.get(videoId);
        if (videoData && videoData.videoElement) {
            const videoElement = videoData.videoElement;
            videoElement.src = videoElement.src;
            videoElement.load();
        }
    }

    adjustVideoSizes() {
        this.videoElements.forEach((videoData, videoId) => {
            if (videoData.videoElement) {
                const container = videoData.slide.querySelector('.video-container');
                if (container) {
                    const containerWidth = container.offsetWidth;
                    const containerHeight = container.offsetHeight;
                    
                    // Adjust video size to fit container while maintaining aspect ratio
                    videoData.videoElement.style.width = '100%';
                    videoData.videoElement.style.height = '100%';
                    videoData.videoElement.style.objectFit = 'cover';
                }
            }
        });
    }

    async handleLike(streamId, button) {
        if (button.classList.contains('processing')) return;
        button.classList.add('processing');
        
        try {
            const result = await streamManager.handleLike(streamId, button);
            
            if (result) {
                const likeCount = button.querySelector('.side-action-count');
                const likeIcon = button.querySelector('.side-action-icon i');
                
                if (button.classList.contains('liked')) {
                    button.classList.remove('liked');
                    likeIcon.className = 'far fa-heart';
                    if (likeCount) {
                        const currentCount = parseInt(likeCount.textContent) || 0;
                        likeCount.textContent = Math.max(0, currentCount - 1);
                    }
                } else {
                    button.classList.add('liked');
                    likeIcon.className = 'fas fa-heart';
                    if (likeCount) {
                        const currentCount = parseInt(likeCount.textContent) || 0;
                        likeCount.textContent = currentCount + 1;
                    }
                }
            }
        } catch (error) {
            console.error('Error liking video:', error);
        } finally {
            button.classList.remove('processing');
        }
    }

    openCommentsModal(streamId) {
        this.currentStreamId = streamId;
        if (this.commentsModal) {
            this.commentsModal.classList.add('active');
            this.loadComments(streamId);
        }
    }

    closeCommentsModal() {
        if (this.commentsModal) {
            this.commentsModal.classList.remove('active');
            this.currentStreamId = null;
            this.clearReply();
        }
        
        if (this.currentStreamId && activeCommentListeners.has(this.currentStreamId)) {
            const unsubscribe = activeCommentListeners.get(this.currentStreamId);
            unsubscribe();
            activeCommentListeners.delete(this.currentStreamId);
        }
    }

    clearReply() {
        this.replyTo = null;
        const modalCommentInput = document.getElementById('modalCommentInput');
        if (modalCommentInput) {
            modalCommentInput.removeAttribute('data-reply-to');
            modalCommentInput.removeAttribute('data-reply-user-name');
        }
    }

    async loadComments(streamId) {
        if (!this.modalCommentsList) return;

        try {
            await streamManager.loadComments(streamId, this.modalCommentsList);
            this.modalCommentsList.scrollTop = this.modalCommentsList.scrollHeight;
        } catch (error) {
            console.error('Error loading comments:', error);
            this.modalCommentsList.innerHTML = '<div class="error">Error loading comments</div>';
        }
    }

    async handleAddComment() {
        if (!this.currentStreamId || !this.modalCommentInput) return;

        const commentText = this.modalCommentInput.value.trim();
        if (!commentText) {
            alert('Please enter a comment');
            return;
        }

        let replyTo = null;
        const replyToCommentId = this.modalCommentInput.getAttribute('data-reply-to');
        const replyToUserName = this.modalCommentInput.getAttribute('data-reply-user-name');
        
        if (replyToCommentId && replyToUserName && commentText.startsWith(`@${replyToUserName} `)) {
            replyTo = {
                commentId: replyToCommentId,
                userName: replyToUserName,
                userId: await this.getUserIdFromComment(replyToCommentId)
            };
        }

        try {
            const success = await streamManager.handleAddComment(this.currentStreamId, commentText, replyTo);
            if (success) {
                this.modalCommentInput.value = '';
                this.clearReply();
                
                const currentVideo = this.videos.find(v => v.id === this.currentStreamId);
                if (currentVideo) {
                    const commentCount = document.querySelector(`.comment-btn[data-stream-id="${this.currentStreamId}"] .side-action-count`);
                    if (commentCount) {
                        const currentCount = parseInt(commentCount.textContent) || 0;
                        commentCount.textContent = currentCount + 1;
                    }
                    currentVideo.commentsCount = (currentVideo.commentsCount || 0) + 1;
                }
            }
        } catch (error) {
            console.error('Error adding comment:', error);
            alert('Error adding comment: ' + error.message);
        }
    }

    async getUserIdFromComment(commentId) {
        try {
            const commentRef = doc(db, 'streams', this.currentStreamId, 'comments', commentId);
            const commentSnap = await getDoc(commentRef);
            if (commentSnap.exists()) {
                return commentSnap.data().userId;
            }
        } catch (error) {
            console.error('Error getting user ID from comment:', error);
        }
        return null;
    }

    shareVideo(streamId) {
        const stream = this.videos.find(v => v.id === streamId);
        if (!stream) return;
        
        const shareText = `Check out this video on WhipRoom: ${stream.headline}`;
        const shareUrl = window.location.origin + '/stream.html';
        
        if (navigator.share) {
            navigator.share({
                title: stream.headline,
                text: stream.description || shareText,
                url: shareUrl
            }).catch(error => {
                console.log('Share cancelled or failed:', error);
            });
        } else {
            navigator.clipboard.writeText(`${shareText}\n${shareUrl}`)
                .then(() => alert('Link copied to clipboard!'))
                .catch(err => console.error('Failed to copy:', err));
        }
    }

    updateTotalViewers(streams) {
        const totalViewersSpan = document.getElementById('totalViewers');
        if (totalViewersSpan) {
            const total = streams.reduce((sum, stream) => sum + (stream.currentViewers || 0), 0);
            totalViewersSpan.textContent = total;
        }
    }

    hideSwipeIndicator() {
        setTimeout(() => {
            const indicator = document.getElementById('swipeIndicator');
            if (indicator) {
                indicator.style.display = 'none';
            }
        }, 3000);
    }

    cleanup() {
        this.pauseCurrentVideo();
        
        if (this.currentIndex >= 0 && this.currentIndex < this.videos.length && currentUser) {
            const currentVideoId = this.videos[this.currentIndex].id;
            streamManager.removeViewer(currentVideoId);
        }
        
        activeCommentListeners.forEach(unsubscribe => unsubscribe());
        activeCommentListeners.clear();
        
        if (clickTimeout) {
            clearTimeout(clickTimeout);
        }
        
        videoCache.clearCache();
    }
}

// Social Features Management
function loadLikedStreams() {
    if (!currentUser) return;
    const stored = localStorage.getItem(`likedStreams_${currentUser.uid}`);
    if (stored) {
        likedStreams = new Set(JSON.parse(stored));
    }
}

function saveLikedStreams() {
    if (!currentUser) return;
    localStorage.setItem(`likedStreams_${currentUser.uid}`, JSON.stringify([...likedStreams]));
}

function loadViewedStreams() {
    if (!currentUser) return;
    const stored = localStorage.getItem(`viewedStreams_${currentUser.uid}`);
    if (stored) {
        viewedStreams = new Set(JSON.parse(stored));
    }
}

function saveViewedStreams() {
    if (!currentUser) return;
    localStorage.setItem(`viewedStreams_${currentUser.uid}`, JSON.stringify([...viewedStreams]));
}

function markStreamAsViewed(streamId) {
    viewedStreams.add(streamId);
    saveViewedStreams();
}

// Function to navigate to user profile
function navigateToUserProfile(userId) {
    if (userId && userId !== currentUser?.uid) {
        window.location.href = `profile.html?id=${userId}`;
    } else if (userId === currentUser?.uid) {
        window.location.href = 'profile.html';
    }
}

// Function to load user videos in profile page
async function loadUserVideos(userId) {
    try {
        const videosContainer = document.getElementById('userVideosGrid');
        if (!videosContainer) return;
        
        videosContainer.innerHTML = `
            <div class="videos-loading">
                <i class="fas fa-spinner fa-spin"></i>
                <span>Loading videos...</span>
            </div>
        `;
        
        const videos = await streamManager.getUserVideos(userId);
        
        if (videos.length === 0) {
            videosContainer.innerHTML = `
                <div class="no-videos">
                    <i class="fas fa-video-slash"></i>
                    <p>No videos posted yet</p>
                </div>
            `;
            return;
        }
        
        videosContainer.innerHTML = '';
        videos.forEach(video => {
            const videoCard = document.createElement('div');
            videoCard.className = 'profile-video-card';
            videoCard.dataset.videoId = video.id;
            
            const thumbnailUrl = getVideoThumbnail(video);
            const viewCount = video.viewCount || 0;
            const likeCount = video.likes || 0;
            
            videoCard.innerHTML = `
                <div class="profile-video-thumbnail">
                    <img src="${thumbnailUrl}" 
                         alt="${video.headline}"
                         class="profile-video-image"
                         onerror="this.src='images-defaultse-profile.jpg'">
                    <div class="profile-video-overlay">
                        <div class="profile-video-stats">
                            <span class="video-stat">
                                <i class="fas fa-play"></i> ${viewCount}
                            </span>
                            <span class="video-stat">
                                <i class="fas fa-heart"></i> ${likeCount}
                            </span>
                        </div>
                        <div class="profile-video-play">
                            <i class="fas fa-play"></i>
                        </div>
                    </div>
                </div>
                <div class="profile-video-info">
                    <p class="profile-video-title">${video.headline}</p>
                    <p class="profile-video-time">${formatTime(video.createdAt)}</p>
                </div>
            `;
            
            videoCard.addEventListener('click', () => {
                openVideoModal(video.id);
            });
            
            videosContainer.appendChild(videoCard);
        });
        
    } catch (error) {
        console.error('Error loading user videos:', error);
        const videosContainer = document.getElementById('userVideosGrid');
        if (videosContainer) {
            videosContainer.innerHTML = `
                <div class="videos-error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Error loading videos</p>
                </div>
            `;
        }
    }
}

// Function to open video modal
function openVideoModal(videoId) {
    if (!videoModalInstance) {
        videoModalInstance = new VideoModal();
    }
    videoModalInstance.open(videoId);
}

// Get video thumbnail
function getVideoThumbnail(stream) {
    if (!stream) {
        return 'images-defaultse-profile.jpg';
    }
    
    if (stream.thumbnailUrl && stream.thumbnailUrl !== 'images-defaultse-profile.jpg') {
        return stream.thumbnailUrl;
    }
    
    if (stream.videoType === 'cloudinary' && stream.videoUrl) {
        return streamManager.generateCloudinaryThumbnail(stream.videoUrl);
    }
    
    return 'images-defaultse-profile.jpg';
}

// Auth state management
function initializeAuth() {
    return new Promise((resolve) => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                currentUser = user;
                loadLikedStreams();
                loadViewedStreams();
                unsubscribe();
                resolve(user);
            } else {
                currentUser = null;
                const currentPage = window.location.pathname.split('/').pop();
                if (currentPage === 'poststream.html' || currentPage === 'stream.html') {
                    window.location.href = 'login.html';
                }
                resolve(null);
            }
        });

        setTimeout(() => {
            unsubscribe();
            if (!currentUser) {
                resolve(null);
            }
        }, 5000);
    });
}

// Initialize TikTok feed
async function initializeTikTokFeed() {
    try {
        await initializeAuth();
        
        if (document.getElementById('tiktokContainer')) {
            tiktokFeedInstance = new TikTokFeed();
            window.tiktokFeedInstance = tiktokFeedInstance;
            
            streamManager.initializeActivityTracking();
            
            console.log('TikTok feed initialized successfully');
        }
    } catch (error) {
        console.error('Error initializing TikTok feed:', error);
    }
}

// Initialize stream functionality based on current page
async function initializeStreamPage() {
    const currentPage = window.location.pathname.split('/').pop().split('.')[0];
    
    await initializeAuth();
    
    if (!currentUser && (currentPage === 'poststream' || currentPage === 'stream')) {
        return;
    }

    switch(currentPage) {
        case 'poststream':
            initializePostStreamPage();
            break;
        case 'stream':
            if (document.getElementById('tiktokContainer')) {
                initializeTikTokFeed();
            } else {
                initializeStreamsPage();
            }
            break;
        case 'profile':
            initializeProfilePageVideos();
            break;
    }
}

// Initialize profile page videos
function initializeProfilePageVideos() {
    const urlParams = new URLSearchParams(window.location.search);
    const profileId = urlParams.get('id') || currentUser?.uid;
    
    if (profileId && document.getElementById('userVideosGrid')) {
        loadUserVideos(profileId);
        
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('.comment-avatar') || 
                e.target.closest('.comment-avatar')) {
                const commentItem = e.target.closest('.comment-item');
                if (commentItem) {
                    const userId = commentItem.dataset.userId;
                    if (userId && userId !== currentUser?.uid) {
                        navigateToUserProfile(userId);
                    }
                }
            }
        });
    }
}

// Initialize post stream page
function initializePostStreamPage() {
    const streamForm = document.getElementById('streamForm');
    const videoFileInput = document.getElementById('videoFile');
    const submitBtn = document.getElementById('submitBtn');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const successMessage = document.getElementById('successMessage');
    const errorMessage = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');

    if (!streamForm || !videoFileInput) {
        return;
    }

    // Remove URL upload option if it exists
    const urlSection = document.getElementById('urlSection');
    const urlOption = document.querySelector('.upload-option[data-method="url"]');
    if (urlSection) urlSection.remove();
    if (urlOption) urlOption.remove();

    videoFileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const fileInfo = document.getElementById('fileInfo') || createFileInfoElement();
            
            const isDownloaded = streamManager.isDownloadedVideo(file);
            const needsConversion = streamManager.needsConversion(file);
            
            let statusMessage = `Selected: ${file.name} (${formatFileSize(file.size)})`;
            let statusColor = 'var(--success-color)';
            let statusIcon = 'fa-check';
            
            if (needsConversion) {
                statusMessage += ' - This video may need processing for better compatibility';
                statusColor = 'var(--warning-color)';
                statusIcon = 'fa-exclamation-triangle';
            }
            
            if (isDownloaded) {
                statusMessage += ' - Downloaded video detected';
            }
            
            fileInfo.style.color = statusColor;
            fileInfo.innerHTML = `<i class="fas ${statusIcon}"></i> ${statusMessage}`;
            
            try {
                streamManager.validateVideoFile(file).then(() => {
                    // Validation passed
                }).catch(error => {
                    fileInfo.style.color = 'var(--error-color)';
                    fileInfo.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${file.name} - ${error.message}`;
                });
            } catch (error) {
                fileInfo.style.color = 'var(--error-color)';
                fileInfo.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${file.name} - Error: ${error.message}`;
            }
        }
    });

    function createFileInfoElement() {
        const fileInfo = document.createElement('div');
        fileInfo.id = 'fileInfo';
        fileInfo.style.fontSize = '14px';
        fileInfo.style.marginTop = '8px';
        fileInfo.style.padding = '8px';
        fileInfo.style.borderRadius = '5px';
        fileInfo.style.backgroundColor = 'var(--bg-dark)';
        videoFileInput.parentNode.appendChild(fileInfo);
        return fileInfo;
    }

    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    streamForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const videoFile = videoFileInput?.files[0];
        const headline = document.getElementById('headline').value.trim();
        const description = document.getElementById('description').value.trim();
        const category = document.getElementById('category').value;

        if (!videoFile) {
            showError('Please select a video file to upload');
            return;
        }

        if (!headline) {
            showError('Please enter a headline');
            document.getElementById('headline').focus();
            return;
        }

        if (!category) {
            showError('Please select a category');
            document.getElementById('category').focus();
            return;
        }

        if (videoFile) {
            try {
                await streamManager.validateVideoFile(videoFile);
            } catch (error) {
                showError(error.message);
                return;
            }
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
        loadingSpinner.style.display = 'block';
        hideError();
        hideSuccess();

        try {
            showSuccess('Uploading video... This may take a moment for large files.');
            
            const streamId = await streamManager.createStream(videoFile, headline, description, category, true);
            
            showSuccess('Stream created successfully! Redirecting...');
            loadingSpinner.style.display = 'none';
            
            streamForm.reset();
            const fileInfo = document.getElementById('fileInfo');
            if (fileInfo) fileInfo.textContent = '';
            
            setTimeout(() => {
                window.location.href = 'stream.html';
            }, 2000);

        } catch (error) {
            showError(error.message);
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-upload"></i> Create Stream';
            loadingSpinner.style.display = 'none';
        }
    });

    function showError(message) {
        errorText.textContent = message;
        errorMessage.style.display = 'block';
        errorMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function hideError() {
        errorMessage.style.display = 'none';
    }

    function showSuccess(message) {
        if (message && successMessage) {
            const successText = successMessage.querySelector('span');
            if (successText) successText.textContent = message;
        }
        if (successMessage) {
            successMessage.style.display = 'block';
            successMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    function hideSuccess() {
        if (successMessage) {
            successMessage.style.display = 'none';
        }
    }
}

// Initialize streams page (grid view)
function initializeStreamsPage() {
    const streamsContainer = document.getElementById('streamsContainer');
    
    if (!streamsContainer) {
        return;
    }

    const filterButtons = document.querySelectorAll('.filter-btn');
    let currentCategory = 'all';

    loadStreams(currentCategory);

    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            const category = button.dataset.category;
            
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            currentCategory = category;
            loadStreams(category);
        });
    });

    streamManager.listenToStreams((streams) => {
        renderStreams(streams);
        updateTotalViewers(streams);
    }, currentCategory);

    streamManager.initializeActivityTracking();
}

// Load streams function for grid view
function loadStreams(category) {
    const streamsContainer = document.getElementById('streamsContainer');
    if (!streamsContainer) return;

    streamsContainer.innerHTML = `
        <div class="loading-streams">
            <i class="fas fa-spinner fa-spin"></i><br>
            Loading streams...
        </div>
    `;

    streamManager.getStreams(category)
        .then(streams => {
            renderStreams(streams);
            updateTotalViewers(streams);
        })
        .catch(error => {
            streamsContainer.innerHTML = `
                <div class="no-streams">
                    <i class="fas fa-exclamation-circle"></i>
                    <h3>Error loading streams</h3>
                    <p>Please try refreshing the page</p>
                </div>
            `;
        });
}

// Render streams function for grid view
function renderStreams(streams) {
    const streamsContainer = document.getElementById('streamsContainer');
    if (!streamsContainer) return;

    if (streams.length === 0) {
        streamsContainer.innerHTML = `
            <div class="no-streams">
                <i class="fas fa-video-slash"></i>
                <h3>No streams available</h3>
                <p>Be the first to create an educational stream!</p>
                <a href="poststream.html" class="create-stream-btn" style="margin-top: 15px;">
                    <i class="fas fa-plus"></i> Create Stream
                </a>
            </div>
        `;
        return;
    }

    streamsContainer.innerHTML = streams.map(stream => {
        const isLiked = likedStreams.has(stream.id);
        const thumbnailUrl = getVideoThumbnail(stream);
        
        return `
        <div class="stream-card" data-stream-id="${stream.id}">
            <div class="video-preview-container" onclick="openVideoModal('${stream.id}')">
                <img src="${thumbnailUrl}" 
                     alt="${stream.headline}" 
                     class="video-preview"
                     onerror="this.src='images-defaultse-profile.jpg'">
                <div class="video-preview-overlay">
                    <button class="preview-play-button">
                        <i class="fas fa-play"></i>
                    </button>
                </div>
                <div class="video-duration">
                    <i class="fas fa-play-circle"></i> 
                    Watch Now
                </div>
            </div>
            <div class="stream-info">
                <div class="stream-meta">
                    <span class="stream-category">${formatCategory(stream.category)}</span>
                    <span class="stream-viewers">
                        <i class="fas fa-eye"></i> 
                        <span id="viewers-${stream.id}">${stream.currentViewers || 0}</span>
                    </span>
                </div>
                <h3 class="stream-title">${stream.headline}</h3>
                <p class="stream-description">${stream.description || 'No description provided'}</p>
                
                <div class="stream-actions">
                    <button class="stream-action like-btn ${isLiked ? 'liked' : ''}" data-stream-id="${stream.id}">
                        <i class="${isLiked ? 'fas' : 'far'} fa-heart"></i> 
                        <span class="like-count">${stream.likes || 0}</span>
                    </button>
                    <button class="stream-action comment-btn" data-stream-id="${stream.id}" onclick="toggleStreamComments('${stream.id}')">
                        <i class="far fa-comment"></i> 
                        <span class="comment-count">${stream.commentsCount || 0}</span>
                    </button>
                </div>

                <div class="comments-section" id="comments-${stream.id}" style="display: none;">
                    <div class="add-comment">
                        <input type="text" class="comment-input" data-stream-id="${stream.id}" placeholder="Write a comment...">
                        <button class="send-comment-btn" data-stream-id="${stream.id}" onclick="handleAddComment('${stream.id}')">
                            <i class="fas fa-paper-plane"></i> Send
                        </button>
                    </div>
                    <div class="comments-list" id="comments-list-${stream.id}"></div>
                </div>

                <div class="stream-author" onclick="navigateToUserProfile('${stream.authorId}')" style="cursor: pointer;">
                    <img src="${stream.authorImage || 'images-defaultse-profile.jpg'}" alt="${stream.authorName}" 
                         class="author-avatar"
                         style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">
                    <div class="author-info">
                        <p class="author-name">${stream.authorName}</p>
                        <p class="stream-time">${formatTime(stream.createdAt)}</p>
                    </div>
                </div>
            </div>
        </div>
        `;
    }).join('');

    streams.forEach(stream => {
        const likeBtn = document.querySelector(`.like-btn[data-stream-id="${stream.id}"]`);
        const commentInput = document.querySelector(`.comment-input[data-stream-id="${stream.id}"]`);

        if (likeBtn) {
            likeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                streamManager.handleLike(stream.id, likeBtn).then(result => {
                    if (result) {
                        const likeCount = likeBtn.querySelector('.like-count');
                        const likeIcon = likeBtn.querySelector('i');
                        
                        likeCount.textContent = result.likes;
                        if (result.isLiked) {
                            likeBtn.classList.add('liked');
                            likeIcon.className = 'fas fa-heart';
                        } else {
                            likeBtn.classList.remove('liked');
                            likeIcon.className = 'far fa-heart';
                        }
                    }
                });
            });
        }

        if (commentInput) {
            commentInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    handleAddComment(stream.id);
                }
            });
        }

        streamManager.listenToViewerCount(stream.id, (viewerCount) => {
            const viewersElement = document.getElementById(`viewers-${stream.id}`);
            if (viewersElement) {
                viewersElement.textContent = viewerCount;
            }
        });
    });
}

// Toggle comments function for stream cards
function toggleStreamComments(streamId) {
    const commentsSection = document.getElementById(`comments-${streamId}`);
    if (commentsSection) {
        if (commentsSection.style.display === 'none') {
            commentsSection.style.display = 'block';
            const commentsList = document.getElementById(`comments-list-${streamId}`);
            if (commentsList) {
                streamManager.loadComments(streamId, commentsList);
            }
        } else {
            commentsSection.style.display = 'none';
        }
    }
}

// Handle add comment for stream cards
function handleAddComment(streamId) {
    if (!currentUser) {
        alert('Please login to add comments');
        return;
    }

    const commentInput = document.querySelector(`.comment-input[data-stream-id="${streamId}"]`);
    if (!commentInput) return;

    const commentText = commentInput.value.trim();
    if (!commentText) {
        alert('Please enter a comment');
        return;
    }

    streamManager.handleAddComment(streamId, commentText).then(success => {
        if (success) {
            commentInput.value = '';
            const commentsList = document.getElementById(`comments-list-${streamId}`);
            if (commentsList) {
                streamManager.loadComments(streamId, commentsList);
            }
            const commentCount = document.querySelector(`.comment-btn[data-stream-id="${streamId}"] .comment-count`);
            if (commentCount) {
                const currentCount = parseInt(commentCount.textContent) || 0;
                commentCount.textContent = currentCount + 1;
            }
        }
    });
}

// Update total viewers function
function updateTotalViewers(streams) {
    const totalViewersSpan = document.getElementById('totalViewers');
    if (totalViewersSpan) {
        const total = streams.reduce((sum, stream) => sum + (stream.currentViewers || 0), 0);
        totalViewersSpan.textContent = total;
    }
}

// Helper functions
function formatCategory(category) {
    if (!category) return 'Uncategorized';
    return category.split('-').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
}

function formatTime(timestamp) {
    if (!timestamp) return 'Recently';
    
    try {
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
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
    } catch (error) {
        return 'Recently';
    }
}

// Handle logout
function setupLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                await signOut(auth);
                window.location.href = 'login.html';
            } catch (error) {
                console.error('Error logging out:', error);
            }
        });
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    setupLogout();
    
    try {
        await initializeStreamPage();
        
        console.log('Stream.js initialization complete');
        
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay && !loadingOverlay.classList.contains('hidden')) {
            setTimeout(() => {
                loadingOverlay.classList.add('hidden');
            }, 1000);
        }
        
    } catch (error) {
        console.error('Error initializing stream page:', error);
        
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.innerHTML = `
                <div style="text-align: center;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 20px;"></i>
                    <div>Error: ${error.message}</div>
                    <button onclick="window.location.reload()" style="margin-top: 20px; padding: 10px 20px; background: #ff2d55; border: none; border-radius: 10px; color: white; cursor: pointer;">
                        Retry
                    </button>
                </div>
            `;
        }
    }
});

// Export for use in other files
window.streamManager = streamManager;
window.tiktokFeedInstance = tiktokFeedInstance;

// Make functions globally available for HTML onclick
window.handleTikTokLike = (streamId, button) => {
    if (tiktokFeedInstance) {
        tiktokFeedInstance.handleLike(streamId, button);
    }
};

window.openTikTokComments = (streamId) => {
    if (tiktokFeedInstance) {
        tiktokFeedInstance.openCommentsModal(streamId);
    }
};

window.shareTikTokVideo = (streamId) => {
    if (tiktokFeedInstance) {
        tiktokFeedInstance.shareVideo(streamId);
    }
};

window.retryTikTokVideo = (videoId) => {
    if (tiktokFeedInstance) {
        tiktokFeedInstance.retryVideo(videoId);
    }
};

// Make video modal function globally available
window.openVideoModal = openVideoModal;

// Make profile navigation function globally available
window.navigateToUserProfile = navigateToUserProfile;

// Make user videos loading function globally available
window.loadUserVideos = loadUserVideos;

window.getVideoThumbnail = getVideoThumbnail;
window.formatCategory = formatCategory;
window.formatTime = formatTime;