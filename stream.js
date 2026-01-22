// stream.js - Video Grid functionality
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
    apiKey: "AIzaSyC8_PEsfTOr-gJ8P1MoXobOAfqwTVqEZWo",
    authDomain: "usa-dating-23bc3.firebaseapp.com",
    projectId: "usa-dating-23bc3",
    storageBucket: "usa-dating-23bc3.firebasestorage.app",
    messagingSenderId: "423286263327",
    appId: "1:423286263327:web:17f0caf843dc349c144f2a"
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

// Video Grid Instance
let videoGridInstance = null;

// Video Modal Instance
let videoModalInstance = null;

// Comment tracking to prevent duplicates
let activeCommentListeners = new Map();

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
            const endIndex = Math.min(startIndex + this.cacheSize, videos.length);
            const videosToCache = videos.slice(startIndex, endIndex);

            for (const video of videosToCache) {
                if (!this.cachedVideos.has(video.id)) {
                    try {
                        const videoElement = document.createElement('video');
                        videoElement.src = video.videoUrl;
                        videoElement.preload = 'auto';
                        videoElement.crossOrigin = 'anonymous';
                        
                        this.cachedVideos.set(video.id, {
                            element: videoElement,
                            data: video,
                            loaded: false
                        });

                        await new Promise((resolve) => {
                            videoElement.addEventListener('loadeddata', () => {
                                this.cachedVideos.get(video.id).loaded = true;
                                resolve();
                            });

                            videoElement.addEventListener('error', () => {
                                console.warn(`Failed to cache video: ${video.id}`);
                                resolve();
                            });

                            setTimeout(resolve, 10000);
                        });
                    } catch (error) {
                        console.warn(`Error caching video ${video.id}:`, error);
                    }
                }
            }

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

            const userRef = doc(db, 'users', currentUser.uid);
            const userSnap = await getDoc(userRef);
            
            if (!userSnap.exists()) {
                throw new Error('User profile not found');
            }

            const userData = userSnap.data();

            let streamData = {};

            if (isLocalFile && videoData instanceof File) {
                await this.validateVideoFile(videoData);
                
                const videoUrl = await this.uploadVideoToCloudinary(videoData);
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

        const isLiked = likedStreams.has(streamId);
        
        try {
            const streamRef = doc(db, 'streams', streamId);
            const streamSnap = await getDoc(streamRef);
            
            if (streamSnap.exists()) {
                const stream = streamSnap.data();
                let newLikes = (stream.likes || 0);
                
                if (isLiked) {
                    newLikes = Math.max(0, newLikes - 1);
                    likedStreams.delete(streamId);
                } else {
                    newLikes = newLikes + 1;
                    likedStreams.add(streamId);
                }
                
                await updateDoc(streamRef, {
                    likes: newLikes,
                    updatedAt: serverTimestamp()
                });

                saveLikedStreams();

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
            if (activeCommentListeners.has(streamId)) {
                const unsubscribe = activeCommentListeners.get(streamId);
                unsubscribe();
                activeCommentListeners.delete(streamId);
            }

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

                this.getUsersData([...userIds]).then(usersData => {
                    container.innerHTML = '';
                    
                    const displayedCommentIds = new Set();
                    
                    snapshot.forEach(doc => {
                        const comment = doc.data();
                        const commentId = doc.id;
                        
                        if (displayedCommentIds.has(commentId)) {
                            return;
                        }
                        
                        displayedCommentIds.add(commentId);
                        const user = usersData[comment.userId] || {};
                        const commentElement = this.createCommentElement(comment, user, commentId, usersData);
                        container.appendChild(commentElement);
                    });
                    
                    container.scrollTop = container.scrollHeight;
                    
                    this.addReplyListeners(streamId);
                });
            }, (error) => {
                console.error('Error loading comments:', error);
                container.innerHTML = '<div class="error">Error loading comments</div>';
            });

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

            if (replyTo) {
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

            await addDoc(collection(db, 'streams', streamId, 'comments'), commentData);

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

// VIDEO GRID CLASS
class VideoGrid {
    constructor() {
        this.videoGrid = document.getElementById('videoGrid');
        this.videos = [];
        this.userVideos = new Map();
        this.currentModalUserVideos = [];
        this.currentModalIndex = 0;
        
        this.init();
    }

    init() {
        this.loadVideos();
        this.setupEventListeners();
    }

    async loadVideos() {
        try {
            this.videos = await streamManager.getStreams('all');
            this.groupVideosByUser();
            this.renderGrid();
            
            this.updateTotalViewers();
            
            streamManager.listenToStreams((streams) => {
                this.videos = streams;
                this.groupVideosByUser();
                this.renderGrid();
                this.updateTotalViewers();
            }, 'all');
            
            const loadingOverlay = document.getElementById('loadingOverlay');
            if (loadingOverlay) {
                loadingOverlay.classList.add('hidden');
            }
            
        } catch (error) {
            console.error('Error loading videos:', error);
            this.showError();
        }
    }

    groupVideosByUser() {
        this.userVideos.clear();
        this.videos.forEach(video => {
            if (!this.userVideos.has(video.authorId)) {
                this.userVideos.set(video.authorId, []);
            }
            this.userVideos.get(video.authorId).push(video);
        });
    }

    renderGrid() {
        if (!this.videoGrid) return;

        if (this.videos.length === 0) {
            this.videoGrid.innerHTML = `
                <div class="no-videos">
                    <i class="fas fa-video-slash"></i>
                    <h3>No videos available</h3>
                    <p>Be the first to share a video!</p>
                </div>
            `;
            return;
        }

        let html = '';
        this.videos.forEach(video => {
            const isLiked = likedStreams.has(video.id);
            const thumbnailUrl = getVideoThumbnail(video);
            const views = video.viewCount || 0;
            
            html += `
            <div class="video-card" data-video-id="${video.id}" data-user-id="${video.authorId}">
                <div class="video-thumbnail-container">
                    <img src="${thumbnailUrl}" 
                         alt="${video.headline}" 
                         class="video-thumbnail"
                         onerror="this.src='images-defaultse-profile.jpg'">
                    
                    <div class="video-avatar-overlay">
                        <img src="${video.authorImage || 'images-defaultse-profile.jpg'}" 
                             alt="${video.authorName}" 
                             class="video-avatar">
                        <span class="video-username">${video.authorName}</span>
                    </div>
                    
                    <div class="video-like-overlay">
                        <button class="video-like-btn ${isLiked ? 'liked' : ''}" 
                                data-video-id="${video.id}"
                                onclick="event.stopPropagation(); videoGridInstance.handleLike('${video.id}', this)">
                            <i class="${isLiked ? 'fas' : 'far'} fa-heart"></i>
                        </button>
                        <div class="video-like-count">${video.likes || 0}</div>
                    </div>
                    
                    <div class="video-play-overlay">
                        <div class="play-icon">
                            <i class="fas fa-play"></i>
                        </div>
                    </div>
                </div>
                
                <div class="video-info">
                    <div class="video-title">${video.headline}</div>
                    <div class="video-meta">
                        <div class="video-views">
                            <i class="fas fa-eye"></i> ${views}
                        </div>
                        <div class="video-time">${formatTime(video.createdAt)}</div>
                    </div>
                </div>
            </div>
            `;
        });

        this.videoGrid.innerHTML = html;
        
        document.querySelectorAll('.video-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.video-like-btn')) {
                    const videoId = card.dataset.videoId;
                    const userId = card.dataset.userId;
                    this.openVideoModal(videoId, userId);
                }
            });
        });
    }

    async openVideoModal(videoId, userId) {
        if (!videoModalInstance) {
            videoModalInstance = new VideoModal();
        }
        
        const userVideos = this.userVideos.get(userId) || [];
        const currentIndex = userVideos.findIndex(v => v.id === videoId);
        
        this.currentModalUserVideos = userVideos;
        this.currentModalIndex = currentIndex;
        
        await videoModalInstance.open(videoId, userVideos, currentIndex);
    }

    async handleLike(videoId, button) {
        if (!currentUser) {
            alert('Please login to like videos');
            return;
        }

        const isLiked = button.classList.contains('liked');
        
        try {
            const result = await streamManager.handleLike(videoId, button);
            if (result) {
                const likeCount = button.nextElementSibling;
                const icon = button.querySelector('i');
                
                if (isLiked) {
                    button.classList.remove('liked');
                    icon.className = 'far fa-heart';
                    if (likeCount) {
                        const current = parseInt(likeCount.textContent) || 0;
                        likeCount.textContent = Math.max(0, current - 1);
                    }
                } else {
                    button.classList.add('liked');
                    icon.className = 'fas fa-heart';
                    if (likeCount) {
                        const current = parseInt(likeCount.textContent) || 0;
                        likeCount.textContent = current + 1;
                    }
                }
            }
        } catch (error) {
            console.error('Error liking video:', error);
        }
    }

    updateTotalViewers() {
        const totalViewersSpan = document.getElementById('totalViewers');
        if (totalViewersSpan) {
            const total = this.videos.reduce((sum, video) => sum + (video.currentViewers || 0), 0);
            totalViewersSpan.textContent = total;
        }
    }

    showError() {
        if (this.videoGrid) {
            this.videoGrid.innerHTML = `
                <div class="no-videos">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Error loading videos</h3>
                    <p>Please try refreshing the page</p>
                </div>
            `;
        }
    }

    setupEventListeners() {
        window.addEventListener('resize', () => {
            this.renderGrid();
        });
    }
}

// VIDEO MODAL CLASS
class VideoModal {
    constructor() {
        this.modal = null;
        this.videoElement = null;
        this.currentVideo = null;
        this.userVideos = [];
        this.currentIndex = 0;
        this.isOpen = false;
        this.isSwiping = false;
        this.startX = 0;
        this.currentX = 0;
        
        this.init();
    }

    init() {
        this.modal = document.createElement('div');
        this.modal.className = 'video-modal';
        this.modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.95);
            z-index: 2000;
            display: none;
            flex-direction: column;
        `;

        this.modal.innerHTML = `
            <div class="modal-header" style="
                padding: 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1px solid rgba(255,255,255,0.1);
            ">
                <div class="modal-user-info" style="display: flex; align-items: center; gap: 10px;">
                    <img id="modalUserAvatar" src="" alt="" style="width: 40px; height: 40px; border-radius: 50%;">
                    <div>
                        <div id="modalUserName" style="font-weight: 600; font-size: 16px;"></div>
                        <div id="modalVideoCount" style="font-size: 12px; opacity: 0.7;"></div>
                    </div>
                </div>
                <button class="modal-close" style="background: none; border: none; color: white; font-size: 24px; cursor: pointer;">
                    <i class="fas fa-times"></i>
                </button>
            </div>

            <div class="modal-video-container" style="
                flex: 1;
                position: relative;
                overflow: hidden;
                background: #000;
            ">
                <video id="modalVideoPlayer" style="
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                " controls playsinline></video>
                
                <div class="modal-progress-container" style="
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    width: 100%;
                    height: 4px;
                    background: rgba(255,255,255,0.2);
                ">
                    <div class="modal-progress-fill" style="
                        height: 100%;
                        width: 0%;
                        background: #ff2d55;
                        transition: width 0.1s linear;
                    "></div>
                </div>
                
                <!-- Swipe indicators -->
                <div class="swipe-indicator left" style="
                    position: absolute;
                    left: 20px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: white;
                    font-size: 24px;
                    opacity: 0;
                    transition: opacity 0.3s;
                    pointer-events: none;
                ">
                    <i class="fas fa-chevron-left"></i>
                </div>
                <div class="swipe-indicator right" style="
                    position: absolute;
                    right: 20px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: white;
                    font-size: 24px;
                    opacity: 0;
                    transition: opacity 0.3s;
                    pointer-events: none;
                ">
                    <i class="fas fa-chevron-right"></i>
                </div>
            </div>

            <div class="modal-content" style="
                background: #1a1a1a;
                padding: 20px;
                max-height: 40vh;
                overflow-y:auto;
                width:100%;
            ">
                <div class="modal-video-info" style="margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                        <h3 id="modalVideoTitle" style="font-size: 18px; font-weight: 600;"></h3>
                        <button id="modalLikeBtn" style="
                            background: none;
                            border: none;
                            color: white;
                            font-size: 20px;
                            cursor: pointer;
                            padding: 10px;
                        ">
                            <i class="far fa-heart"></i>
                        </button>
                    </div>
                    <p id="modalVideoDescription" style="
                        color: #d1d5db;
                        line-height: 1.5;
                        margin-bottom: 15px;
                    "></p>
                    
                    <div style="display: flex; gap: 20px; color: #aaa; font-size: 14px;">
                        <span id="modalVideoViews"><i class="fas fa-eye"></i> <span>0</span></span>
                        <span id="modalVideoLikes"><i class="fas fa-heart"></i> <span>0</span></span>
                        <span id="modalVideoComments"><i class="fas fa-comment"></i> <span>0</span></span>
                    </div>
                </div>

                <div class="modal-actions" style="
                    display: flex;
                    gap: 10px;
                    margin-bottom: 20px;
                ">
                    <button id="modalCommentBtn" style="
                        flex: 1;
                        background: #ff2d55;
                        color: white;
                        border: none;
                        padding: 12px;
                        border-radius: 25px;
                        font-weight: 600;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 8px;
                    ">
                        <i class="fas fa-comment"></i> View Comments
                    </button>
                </div>

                <div class="modal-add-comment" style="
                    display: flex;
                    gap: 10px;
                    padding-top: 15px;
                    border-top: 1px solid rgba(255,255,255,0.1);
                ">
                    <input type="text" id="modalCommentInput" placeholder="Add a comment..." style="
                        flex: 1;
                        background: rgba(255,255,255,0.1);
                        border: none;
                        color: white;
                        padding: 12px 15px;
                        border-radius: 25px;
                        outline: none;
                    ">
                    <button id="modalSendComment" style="
                        background: #ff2d55;
                        color: white;
                        border: none;
                        width: 44px;
                        height: 44px;
                        border-radius: 50%;
                        cursor: pointer;
                        font-size: 18px;
                    ">
                        <i class="fas fa-paper-plane"></i>
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(this.modal);

        this.videoElement = this.modal.querySelector('#modalVideoPlayer');
        this.closeButton = this.modal.querySelector('.modal-close');
        this.likeButton = this.modal.querySelector('#modalLikeBtn');
        this.commentButton = this.modal.querySelector('#modalCommentBtn');
        this.sendCommentButton = this.modal.querySelector('#modalSendComment');
        this.commentInput = this.modal.querySelector('#modalCommentInput');
        this.progressFill = this.modal.querySelector('.modal-progress-fill');
        this.videoContainer = this.modal.querySelector('.modal-video-container');
        this.leftIndicator = this.modal.querySelector('.swipe-indicator.left');
        this.rightIndicator = this.modal.querySelector('.swipe-indicator.right');

        this.closeButton.addEventListener('click', () => this.close());
        this.likeButton.addEventListener('click', () => this.handleLike());
        this.commentButton.addEventListener('click', () => this.openCommentsModal());
        this.sendCommentButton.addEventListener('click', () => this.handleAddComment());
        this.commentInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleAddComment();
        });

        if (this.videoElement) {
            this.videoElement.addEventListener('timeupdate', () => this.updateProgressBar());
            this.videoElement.addEventListener('loadedmetadata', () => this.setupProgressBar());
        }

        this.setupSwipeHandlers();
    }

    setupSwipeHandlers() {
        this.videoContainer.addEventListener('touchstart', (e) => this.handleTouchStart(e));
        this.videoContainer.addEventListener('touchmove', (e) => this.handleTouchMove(e));
        this.videoContainer.addEventListener('touchend', (e) => this.handleTouchEnd(e));
        
        this.videoContainer.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.videoContainer.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.videoContainer.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.videoContainer.addEventListener('mouseleave', (e) => this.handleMouseLeave(e));
    }

    handleTouchStart(e) {
        if (this.userVideos.length <= 1) return;
        
        this.startX = e.touches[0].clientX;
        this.currentX = this.startX;
        this.isSwiping = true;
    }

    handleTouchMove(e) {
        if (!this.isSwiping || this.userVideos.length <= 1) return;
        
        e.preventDefault();
        this.currentX = e.touches[0].clientX;
        const dragX = this.currentX - this.startX;
        
        if (dragX > 50 && this.currentIndex > 0) {
            this.leftIndicator.style.opacity = '1';
        } else if (dragX < -50 && this.currentIndex < this.userVideos.length - 1) {
            this.rightIndicator.style.opacity = '1';
        } else {
            this.leftIndicator.style.opacity = '0';
            this.rightIndicator.style.opacity = '0';
        }
    }

    handleTouchEnd(e) {
        if (!this.isSwiping || this.userVideos.length <= 1) return;
        
        const dragX = this.currentX - this.startX;
        const threshold = 100;
        
        if (Math.abs(dragX) > threshold) {
            if (dragX > 0 && this.currentIndex > 0) {
                this.changeVideo(this.currentIndex - 1);
            } else if (dragX < 0 && this.currentIndex < this.userVideos.length - 1) {
                this.changeVideo(this.currentIndex + 1);
            }
        }
        
        this.leftIndicator.style.opacity = '0';
        this.rightIndicator.style.opacity = '0';
        this.isSwiping = false;
    }

    handleMouseDown(e) {
        if (this.userVideos.length <= 1) return;
        
        this.startX = e.clientX;
        this.currentX = this.startX;
        this.isSwiping = true;
        e.preventDefault();
    }

    handleMouseMove(e) {
        if (!this.isSwiping || this.userVideos.length <= 1) return;
        
        this.currentX = e.clientX;
        const dragX = this.currentX - this.startX;
        
        if (dragX > 50 && this.currentIndex > 0) {
            this.leftIndicator.style.opacity = '1';
        } else if (dragX < -50 && this.currentIndex < this.userVideos.length - 1) {
            this.rightIndicator.style.opacity = '1';
        } else {
            this.leftIndicator.style.opacity = '0';
            this.rightIndicator.style.opacity = '0';
        }
    }

    handleMouseUp(e) {
        if (!this.isSwiping || this.userVideos.length <= 1) return;
        
        const dragX = this.currentX - this.startX;
        const threshold = 100;
        
        if (Math.abs(dragX) > threshold) {
            if (dragX > 0 && this.currentIndex > 0) {
                this.changeVideo(this.currentIndex - 1);
            } else if (dragX < 0 && this.currentIndex < this.userVideos.length - 1) {
                this.changeVideo(this.currentIndex + 1);
            }
        }
        
        this.leftIndicator.style.opacity = '0';
        this.rightIndicator.style.opacity = '0';
        this.isSwiping = false;
    }

    handleMouseLeave() {
        this.leftIndicator.style.opacity = '0';
        this.rightIndicator.style.opacity = '0';
        this.isSwiping = false;
    }

    async open(videoId, userVideos, currentIndex) {
        try {
            this.userVideos = userVideos;
            this.currentIndex = currentIndex;
            
            this.modal.style.display = 'flex';
            this.isOpen = true;
            document.body.style.overflow = 'hidden';

            this.currentVideo = await streamManager.getVideoById(videoId);
            if (!this.currentVideo) {
                throw new Error('Video not found');
            }

            this.updateModalContent();
            this.videoElement.src = this.currentVideo.videoUrl;
            this.videoElement.load();

            streamManager.addViewer(videoId);

            await this.videoElement.play().catch(e => {
                console.log('Auto-play prevented:', e);
            });

            this.updateSwipeIndicators();

        } catch (error) {
            console.error('Error opening video modal:', error);
            alert('Error loading video: ' + error.message);
            this.close();
        }
    }

    updateModalContent() {
        const userAvatar = this.modal.querySelector('#modalUserAvatar');
        const userName = this.modal.querySelector('#modalUserName');
        const videoCount = this.modal.querySelector('#modalVideoCount');
        const videoTitle = this.modal.querySelector('#modalVideoTitle');
        const videoDescription = this.modal.querySelector('#modalVideoDescription');
        const videoViews = this.modal.querySelector('#modalVideoViews span');
        const videoLikes = this.modal.querySelector('#modalVideoLikes span');
        const videoComments = this.modal.querySelector('#modalVideoComments span');

        if (userAvatar) userAvatar.src = this.currentVideo.authorImage || 'images-defaultse-profile.jpg';
        if (userName) userName.textContent = this.currentVideo.authorName;
        if (videoCount) videoCount.textContent = `${this.userVideos.length} videos`;
        if (videoTitle) videoTitle.textContent = this.currentVideo.headline;
        if (videoDescription) videoDescription.textContent = this.currentVideo.description || 'No description';
        if (videoViews) videoViews.textContent = this.currentVideo.viewCount || 0;
        if (videoLikes) videoLikes.textContent = this.currentVideo.likes || 0;
        if (videoComments) videoComments.textContent = this.currentVideo.commentsCount || 0;

        this.updateLikeButton();
    }

    updateLikeButton() {
        if (!this.currentVideo) return;

        const isLiked = likedStreams.has(this.currentVideo.id);
        const icon = this.likeButton.querySelector('i');
        icon.className = isLiked ? 'fas fa-heart' : 'far fa-heart';
    }

    updateSwipeIndicators() {
        if (this.currentIndex > 0) {
            this.leftIndicator.style.opacity = '0.5';
        } else {
            this.leftIndicator.style.opacity = '0';
        }
        
        if (this.currentIndex < this.userVideos.length - 1) {
            this.rightIndicator.style.opacity = '0.5';
        } else {
            this.rightIndicator.style.opacity = '0';
        }
    }

    async changeVideo(newIndex) {
        if (newIndex < 0 || newIndex >= this.userVideos.length) return;

        if (this.currentVideo) {
            streamManager.removeViewer(this.currentVideo.id);
        }

        this.currentIndex = newIndex;
        this.currentVideo = this.userVideos[newIndex];
        
        this.updateModalContent();
        this.videoElement.src = this.currentVideo.videoUrl;
        this.videoElement.load();
        
        streamManager.addViewer(this.currentVideo.id);
        
        await this.videoElement.play().catch(e => {
            console.log('Auto-play prevented:', e);
        });
        
        this.updateSwipeIndicators();
    }

    close() {
        if (this.videoElement) {
            this.videoElement.pause();
            this.videoElement.src = '';
        }
        this.modal.style.display = 'none';
        this.isOpen = false;
        document.body.style.overflow = 'auto';

        if (this.currentVideo) {
            streamManager.removeViewer(this.currentVideo.id);
        }
        this.currentVideo = null;
        this.userVideos = [];
        this.currentIndex = 0;
    }

    setupProgressBar() {
        if (!this.videoElement || !this.progressFill) return;
        
        this.progressFill.style.width = '0%';
    }

    updateProgressBar() {
        if (!this.videoElement || !this.progressFill || !this.videoElement.duration) return;
        
        const progress = (this.videoElement.currentTime / this.videoElement.duration) * 100;
        this.progressFill.style.width = `${progress}%`;
    }

    async handleLike() {
        if (!this.currentVideo) return;

        try {
            const result = await streamManager.handleLike(this.currentVideo.id, this.likeButton);
            if (result) {
                this.updateLikeButton();
                const likesElement = this.modal.querySelector('#modalVideoLikes span');
                likesElement.textContent = result.likes;
                
                if (videoGridInstance) {
                    videoGridInstance.renderGrid();
                }
            }
        } catch (error) {
            console.error('Error liking video:', error);
        }
    }

    openCommentsModal() {
        const commentsModal = document.getElementById('commentsModal');
        if (commentsModal) {
            commentsModal.classList.add('active');
            this.loadComments();
        }
    }

    async loadComments() {
        if (!this.currentVideo) return;

        const commentsList = document.getElementById('modalCommentsList');
        if (commentsList) {
            await streamManager.loadComments(this.currentVideo.id, commentsList);
        }
    }

    async handleAddComment() {
        if (!this.currentVideo || !this.commentInput) return;

        const commentText = this.commentInput.value.trim();
        if (!commentText) {
            alert('Please enter a comment');
            return;
        }

        try {
            const success = await streamManager.handleAddComment(this.currentVideo.id, commentText);
            if (success) {
                this.commentInput.value = '';
                this.loadComments();
                
                const commentsElement = this.modal.querySelector('#modalVideoComments span');
                if (commentsElement) {
                    const current = parseInt(commentsElement.textContent) || 0;
                    commentsElement.textContent = current + 1;
                }
                
                if (videoGridInstance) {
                    videoGridInstance.renderGrid();
                }
            }
        } catch (error) {
            console.error('Error adding comment:', error);
            alert('Error adding comment: ' + error.message);
        }
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

function navigateToUserProfile(userId) {
    if (userId && userId !== currentUser?.uid) {
        window.location.href = `profile.html?id=${userId}`;
    } else if (userId === currentUser?.uid) {
        window.location.href = 'profile.html';
    }
}

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

function openVideoModal(videoId) {
    if (!videoModalInstance) {
        videoModalInstance = new VideoModal();
    }
    
    if (videoGridInstance) {
        const video = videoGridInstance.videos.find(v => v.id === videoId);
        if (video) {
            const userId = video.authorId;
            const userVideos = videoGridInstance.userVideos.get(userId) || [];
            const currentIndex = userVideos.findIndex(v => v.id === videoId);
            
            videoModalInstance.open(videoId, userVideos, currentIndex);
        }
    } else {
        videoModalInstance.open(videoId, [], 0);
    }
}

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

async function initializeVideoGrid() {
    try {
        await initializeAuth();
        
        if (document.getElementById('videoGrid')) {
            videoGridInstance = new VideoGrid();
            window.videoGridInstance = videoGridInstance;
            
            streamManager.initializeActivityTracking();
            
            console.log('Video grid initialized successfully');
        }
    } catch (error) {
        console.error('Error initializing video grid:', error);
    }
}

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
            if (document.getElementById('videoGrid')) {
                initializeVideoGrid();
            } else {
                initializeStreamsPage();
            }
            break;
        case 'profile':
            initializeProfilePageVideos();
            break;
    }
}

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

function updateTotalViewers(streams) {
    const totalViewersSpan = document.getElementById('totalViewers');
    if (totalViewersSpan) {
        const total = streams.reduce((sum, stream) => sum + (stream.currentViewers || 0), 0);
        totalViewersSpan.textContent = total;
    }
}

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

window.streamManager = streamManager;
window.videoGridInstance = videoGridInstance;

window.openVideoModal = openVideoModal;
window.navigateToUserProfile = navigateToUserProfile;
window.loadUserVideos = loadUserVideos;
window.getVideoThumbnail = getVideoThumbnail;
window.formatCategory = formatCategory;
window.formatTime = formatTime;