// products.js - Handles all product-related functionality

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    getFirestore, 
    collection,
    getDocs,
    getDoc,
    doc,
    query,
    where,
    orderBy,
    limit,
    addDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    increment,
    arrayUnion,
    arrayRemove
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

// IMPORTANT: Replace these with your actual Cloudinary credentials
const CLOUDINARY_CLOUD_NAME = 'ddtdqrh1b';
const CLOUDINARY_UPLOAD_PRESET = 'profile-pictures';

// Product Class
class ProductManager {
    constructor() {
        this.currentUser = null;
        this.cachePrefix = 'products_';
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
        this.stores = [];
        this.currentStoreId = null;
        this.products = {};
        this.init();
        this.initProfileDisplay(); // Auto-initialize when loaded
    }

    async init() {
        onAuthStateChanged(auth, (user) => {
            this.currentUser = user;
        });
    }

    // Auto-detect and initialize profile display
    async initProfileDisplay() {
        // Check if we're on a profile page
        if (!window.location.pathname.includes('profile.html') && !window.location.pathname.includes('account.html')) {
            return; // Not on profile page, don't load stores
        }

        console.log('Profile page detected, loading stores...');

        // Try to get profile user ID from multiple sources
        let profileUserId = null;

        // Method 1: Check URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        profileUserId = urlParams.get('userId') || urlParams.get('uid') || urlParams.get('id');

        // Method 2: If on "my profile" page (account.html) and no user ID specified, use current user
        if (!profileUserId && window.location.pathname.includes('account.html')) {
            // Wait for auth to load
            const checkAuth = setInterval(() => {
                if (this.currentUser) {
                    clearInterval(checkAuth);
                    this.loadUserStoresForDisplay(this.currentUser.uid);
                }
            }, 100);
            return;
        }

        if (profileUserId) {
            console.log('Loading stores for user:', profileUserId);
            await this.loadUserStoresForDisplay(profileUserId);
        }
    }

    // Load user stores for profile display
    async loadUserStoresForDisplay(userId) {
        try {
            if (!userId) return;

            // Check if stores section exists
            const storeTabs = document.getElementById('storeTabs');
            if (!storeTabs) {
                console.log('Store section not found on this page');
                return;
            }

            // Show loading state
            this.showStoreLoading();

            // Get user's stores
            this.stores = await this.getUserStores(userId);
            
            // Sort manually in JavaScript
            this.stores.sort((a, b) => {
                const dateA = a.createdAt ? a.createdAt.seconds : 0;
                const dateB = b.createdAt ? b.createdAt.seconds : 0;
                return dateB - dateA; // Descending order (newest first)
            });

            console.log(`Found ${this.stores.length} stores for user ${userId}`);
            console.log('Store data:', this.stores); // Debug log

            if (this.stores.length === 0) {
                this.showNoStoresMessage('This user hasn\'t created any stores yet');
                return;
            }

            // Render store tabs
            this.renderStoreTabs();

            // Load products for the first store
            if (this.stores.length > 0) {
                this.currentStoreId = this.stores[0].id;
                await this.loadStoreProductsForDisplay(this.currentStoreId);
                this.renderStoreInfo(this.stores[0]);
            }

        } catch (error) {
            console.error('Error loading stores for display:', error);
            this.showStoreError('Failed to load stores');
        }
    }

    // Show loading state in the stores section
    showStoreLoading() {
        const storeTabs = document.getElementById('storeTabs');
        const productsGrid = document.getElementById('productsGrid');
        
        if (storeTabs) {
            storeTabs.innerHTML = '<div class="loading">Loading stores...</div>';
        }
        
        if (productsGrid) {
            productsGrid.innerHTML = '<div class="loading">Loading products...</div>';
        }
    }

    // Show no stores message
    showNoStoresMessage(message) {
        const storeTabs = document.getElementById('storeTabs');
        const storeInfoCard = document.getElementById('storeInfoCard');
        const productsGrid = document.getElementById('productsGrid');
        
        if (storeTabs) {
            storeTabs.innerHTML = `
                <div class="no-stores-message">
                    <svg class="feather" data-feather="shopping-bag">
                        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                        <line x1="3" y1="6" x2="21" y2="6"></line>
                        <path d="M16 10a4 4 0 0 1-8 0"></path>
                    </svg>
                    <p>${message}</p>
                </div>
            `;
        }
        
        if (storeInfoCard) {
            storeInfoCard.style.display = 'none';
        }
        
        if (productsGrid) {
            productsGrid.innerHTML = '';
        }
        
        // Re-initialize feather icons
        if (typeof feather !== 'undefined') {
            feather.replace();
        }
    }

    // Show error message
    showStoreError(message) {
        const storeTabs = document.getElementById('storeTabs');
        if (storeTabs) {
            storeTabs.innerHTML = `<div class="error">${message}</div>`;
        }
    }

    // Render store tabs
    renderStoreTabs() {
        const storeTabs = document.getElementById('storeTabs');
        if (!storeTabs) return;

        if (this.stores.length === 0) {
            this.showNoStoresMessage('No stores available');
            return;
        }

        let tabsHtml = '';
        this.stores.forEach((store, index) => {
            const isActive = index === 0 ? 'active' : '';
            const storeName = store.name || store.storeName || 'Unnamed Store';
            
            tabsHtml += `
                <div class="store-tab ${isActive}" data-store-id="${store.id}">
                    <svg class="feather" data-feather="${store.logo ? 'image' : 'shopping-bag'}"></svg>
                    ${storeName}
                    <span class="product-count">${store.products || 0}</span>
                </div>
            `;
        });

        storeTabs.innerHTML = tabsHtml;

        // Add click handlers
        document.querySelectorAll('.store-tab').forEach(tab => {
            tab.addEventListener('click', async (e) => {
                const storeId = tab.dataset.storeId;
                await this.switchStore(storeId);
            });
        });

        // Re-initialize feather icons
        if (typeof feather !== 'undefined') {
            feather.replace();
        }
    }

    // Switch between stores
    async switchStore(storeId) {
        if (this.currentStoreId === storeId) return;

        // Update active tab
        document.querySelectorAll('.store-tab').forEach(tab => {
            if (tab.dataset.storeId === storeId) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });

        this.currentStoreId = storeId;
        
        // Find store data
        const store = this.stores.find(s => s.id === storeId);
        if (store) {
            console.log('Switching to store:', store); // Debug log
            this.renderStoreInfo(store);
            await this.loadStoreProductsForDisplay(storeId);
        }
    }

    // Render store information
    renderStoreInfo(store) {
        const storeInfoCard = document.getElementById('storeInfoCard');
        const storeLogo = document.getElementById('storeLogo');
        const storeNameEl = document.getElementById('storeName');
        const storeVerified = document.getElementById('storeVerified');
        const storeDescription = document.getElementById('storeDescription');
        const storeProductsCount = document.getElementById('storeProductsCount');
        const storeFollowersCount = document.getElementById('storeFollowersCount');
        const storeCreated = document.getElementById('storeCreated');

        if (!storeInfoCard) return;

        console.log('Rendering store info:', store); // Debug log

        // Show the store info card
        storeInfoCard.style.display = 'flex';

        // Set store logo
        if (storeLogo) {
            if (store.logo && store.logo.url) {
                storeLogo.src = store.logo.url;
                console.log('Setting logo to:', store.logo.url);
            } else {
                storeLogo.src = 'images/default-store.jpg';
                console.log('No logo found, using default');
            }
        }

        // Set store name
        if (storeNameEl) {
            const storeName = store.name || store.storeName || 'Unnamed Store';
            storeNameEl.innerHTML = `${storeName} <span class="store-verified" id="storeVerified" style="display: ${store.verified ? 'inline-block' : 'none'};">Verified</span>`;
            console.log('Setting store name to:', storeName);
        }

        // Set verified badge
        if (storeVerified) {
            storeVerified.style.display = store.verified ? 'inline-block' : 'none';
        }

        // Set description
        if (storeDescription) {
            storeDescription.textContent = store.description || store.bio || 'No description provided';
        }

        // Set products count
        if (storeProductsCount) {
            const countSpan = storeProductsCount.querySelector('span');
            if (countSpan) {
                countSpan.textContent = `${store.products || 0} products`;
            }
        }

        // Set followers count
        if (storeFollowersCount) {
            const countSpan = storeFollowersCount.querySelector('span');
            if (countSpan) {
                countSpan.textContent = `${store.followers ? store.followers.length : 0} followers`;
            }
        }

        // Set creation date
        if (storeCreated) {
            const dateSpan = storeCreated.querySelector('span');
            if (dateSpan) {
                const createdDate = store.createdAt ? new Date(store.createdAt.seconds * 1000) : new Date();
                dateSpan.textContent = `Joined ${this.formatDate(createdDate)}`;
            }
        }

        // Re-initialize feather icons
        if (typeof feather !== 'undefined') {
            feather.replace();
        }
    }

    // Load store products for display
    async loadStoreProductsForDisplay(storeId) {
        try {
            const productsGrid = document.getElementById('productsGrid');
            if (!productsGrid) return;

            // Show loading
            productsGrid.innerHTML = '<div class="loading">Loading products...</div>';

            // Get products for this store
            const products = await this.getStoreProducts(storeId);
            
            // Sort manually in JavaScript
            products.sort((a, b) => {
                const dateA = a.createdAt ? a.createdAt.seconds : 0;
                const dateB = b.createdAt ? b.createdAt.seconds : 0;
                return dateB - dateA;
            });
            
            this.products[storeId] = products;
            console.log(`Found ${products.length} products for store ${storeId}`); // Debug log

            if (products.length === 0) {
                productsGrid.innerHTML = `
                    <div class="no-products-message">
                        <svg class="feather" data-feather="package">
                            <line x1="16.5" y1="9.4" x2="7.5" y2="4.21"></line>
                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                            <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                            <line x1="12" y1="22.08" x2="12" y2="12"></line>
                        </svg>
                        <p>No products in this store yet</p>
                    </div>
                `;
            } else {
                this.renderProductsGrid(products);
            }

            // Re-initialize feather icons
            if (typeof feather !== 'undefined') {
                feather.replace();
            }

        } catch (error) {
            console.error('Error loading products for display:', error);
            const productsGrid = document.getElementById('productsGrid');
            if (productsGrid) {
                productsGrid.innerHTML = '<div class="error">Failed to load products</div>';
            }
        }
    }

    // Render products grid
    renderProductsGrid(products) {
        const productsGrid = document.getElementById('productsGrid');
        if (!productsGrid) return;

        let productsHtml = '';

        products.forEach(product => {
            const mainImage = product.images && product.images.length > 0 
                ? product.images[0].url 
                : 'images/default-product.jpg';
            
            const thumbnail = product.images && product.images.length > 0 && product.images[0].thumbnail
                ? product.images[0].thumbnail
                : mainImage;

            const discount = product.discount || 0;
            const discountedPrice = this.calculateDiscountedPrice(product.price, discount);
            const isDiscounted = discount > 0 && discountedPrice < product.price;

            productsHtml += `
                <div class="product-card" onclick="window.location.href='product.html?id=${product.id}'">
                    <div class="product-image-container">
                        <img src="${thumbnail}" alt="${product.name || 'Product'}" class="product-image" loading="lazy">
                        ${isDiscounted ? '<span class="product-badge">-' + discount + '%</span>' : ''}
                    </div>
                    <div class="product-info">
                        <h4 class="product-name">${product.name || 'Unnamed Product'}</h4>
                        <div class="product-price">
                            ${this.formatPrice(discountedPrice)}
                            ${isDiscounted ? `<span class="product-original-price">${this.formatPrice(product.price)}</span>` : ''}
                        </div>
                        <div class="product-stats">
                            <span class="product-stat">
                                <svg class="feather" data-feather="eye"></svg>
                                ${product.views || 0}
                            </span>
                            <span class="product-stat">
                                <svg class="feather" data-feather="heart"></svg>
                                ${product.likes ? product.likes.length : 0}
                            </span>
                            <span class="product-stat">
                                <svg class="feather" data-feather="shopping-cart"></svg>
                                ${product.orders || 0}
                            </span>
                        </div>
                    </div>
                </div>
            `;
        });

        productsGrid.innerHTML = productsHtml;

        // Re-initialize feather icons
        if (typeof feather !== 'undefined') {
            feather.replace();
        }
    }

    // Upload image to Cloudinary
    async uploadToCloudinary(file) {
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
            
            // Add folder path for organization
            if (this.currentUser) {
                formData.append('folder', `stores/${this.currentUser.uid}/products`);
            }

            const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Upload failed: ${response.status}`);
            }

            const data = await response.json();
            
            return {
                url: data.secure_url,
                publicId: data.public_id,
                width: data.width,
                height: data.height,
                format: data.format,
                thumbnail: data.secure_url.replace('/image/upload/', '/image/upload/w_200,h_200,c_fill/')
            };
        } catch (error) {
            console.error('Error uploading to Cloudinary:', error);
            throw error;
        }
    }

    // Upload multiple images to Cloudinary
    async uploadImages(files) {
        if (!files || files.length === 0) return [];
        
        const uploadPromises = [];
        for (let i = 0; i < files.length; i++) {
            uploadPromises.push(this.uploadToCloudinary(files[i]));
        }
        
        try {
            const results = await Promise.all(uploadPromises);
            return results;
        } catch (error) {
            console.error('Error uploading multiple images:', error);
            throw error;
        }
    }

    // Create a new store
    async createStore(storeData, logo = null) {
        try {
            if (!this.currentUser) {
                throw new Error('You must be logged in to create a store');
            }

            // Upload logo to Cloudinary if provided
            let logoData = null;
            if (logo) {
                logoData = await this.uploadToCloudinary(logo);
            }

            // Create store document in Firestore
            const storeRef = await addDoc(collection(db, 'stores'), {
                ...storeData,
                logo: logoData,
                ownerId: this.currentUser.uid,
                ownerEmail: this.currentUser.email,
                ownerName: this.currentUser.displayName || 'Store Owner',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                products: 0,
                followers: [],
                status: 'active',
                verified: false
            });

            return {
                storeId: storeRef.id,
                logo: logoData
            };

        } catch (error) {
            console.error('Error creating store:', error);
            throw error;
        }
    }

    // Get user's stores
    async getUserStores(userId) {
        try {
            if (!userId) {
                return [];
            }

            const cacheKey = `user_stores_${userId}`;
            const cached = this.getFromCache(cacheKey);
            
            if (cached) {
                console.log('Returning cached stores:', cached);
                return cached;
            }

            const q = query(
                collection(db, 'stores'),
                where('ownerId', '==', userId),
                where('status', '==', 'active')
            );

            const querySnapshot = await getDocs(q);
            const stores = [];
            
            querySnapshot.forEach((doc) => {
                const storeData = doc.data();
                console.log('Store data from Firestore:', storeData); // Debug log
                stores.push({
                    id: doc.id,
                    ...storeData
                });
            });

            console.log('Raw stores from Firestore:', stores);
            this.saveToCache(cacheKey, stores);
            return stores;

        } catch (error) {
            console.error('Error getting user stores:', error);
            return [];
        }
    }

    // Get store by ID
    async getStore(storeId) {
        try {
            const cacheKey = `store_${storeId}`;
            const cached = this.getFromCache(cacheKey);
            
            if (cached) {
                return cached;
            }

            const docRef = doc(db, 'stores', storeId);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                const store = {
                    id: docSnap.id,
                    ...docSnap.data()
                };
                
                this.saveToCache(cacheKey, store);
                return store;
            } else {
                return null;
            }

        } catch (error) {
            console.error('Error getting store:', error);
            return null;
        }
    }

    // Get products by store
    async getStoreProducts(storeId) {
        try {
            const cacheKey = `store_${storeId}`;
            const cached = this.getFromCache(cacheKey);
            
            if (cached) {
                return cached;
            }

            const q = query(
                collection(db, 'products'),
                where('storeId', '==', storeId),
                where('status', '==', 'active')
            );

            const querySnapshot = await getDocs(q);
            const products = [];
            
            querySnapshot.forEach((doc) => {
                products.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            this.saveToCache(cacheKey, products);
            return products;

        } catch (error) {
            console.error('Error getting store products:', error);
            return [];
        }
    }

    // Get single product
    async getProduct(productId) {
        try {
            const cacheKey = `product_${productId}`;
            const cached = this.getFromCache(cacheKey);
            
            if (cached) {
                return cached;
            }

            const docRef = doc(db, 'products', productId);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                const product = {
                    id: docSnap.id,
                    ...docSnap.data()
                };
                
                // Increment view count
                await this.incrementViews(productId);
                
                this.saveToCache(cacheKey, product);
                return product;
            } else {
                return null;
            }

        } catch (error) {
            console.error('Error getting product:', error);
            return null;
        }
    }

    // Update product
    async updateProduct(productId, updates, newImages = []) {
        try {
            if (!this.currentUser) {
                throw new Error('You must be logged in to update a product');
            }

            const productRef = doc(db, 'products', productId);
            const productSnap = await getDoc(productRef);

            if (!productSnap.exists()) {
                throw new Error('Product not found');
            }

            // Check ownership
            if (productSnap.data().ownerId !== this.currentUser.uid) {
                throw new Error('You do not have permission to update this product');
            }

            // Upload new images to Cloudinary if any
            let imageData = [...(updates.existingImages || [])];
            if (newImages.length > 0) {
                const newImageData = await this.uploadImages(newImages);
                imageData = [...imageData, ...newImageData];
            }

            await updateDoc(productRef, {
                ...updates,
                images: imageData,
                updatedAt: serverTimestamp()
            });

            // Clear cache
            this.clearProductCache(productId);
            if (productSnap.data().storeId) {
                this.clearStoreCache(productSnap.data().storeId);
            }
            this.clearUserStoresCache(this.currentUser.uid);

            return true;

        } catch (error) {
            console.error('Error updating product:', error);
            throw error;
        }
    }

    // Delete product
    async deleteProduct(productId) {
        try {
            if (!this.currentUser) {
                throw new Error('You must be logged in to delete a product');
            }

            const productRef = doc(db, 'products', productId);
            const productSnap = await getDoc(productRef);

            if (!productSnap.exists()) {
                throw new Error('Product not found');
            }

            // Check ownership
            if (productSnap.data().ownerId !== this.currentUser.uid) {
                throw new Error('You do not have permission to delete this product');
            }

            // Delete product document from Firestore
            await deleteDoc(productRef);

            // Update store product count
            if (productSnap.data().storeId) {
                const storeRef = doc(db, 'stores', productSnap.data().storeId);
                await updateDoc(storeRef, {
                    products: increment(-1),
                    updatedAt: serverTimestamp()
                });
            }

            // Clear cache
            this.clearProductCache(productId);
            if (productSnap.data().storeId) {
                this.clearStoreCache(productSnap.data().storeId);
            }
            this.clearUserStoresCache(this.currentUser.uid);

            return true;

        } catch (error) {
            console.error('Error deleting product:', error);
            throw error;
        }
    }

    // Like/unlike product
    async toggleLike(productId) {
        try {
            if (!this.currentUser) {
                throw new Error('Please login to like products');
            }

            const productRef = doc(db, 'products', productId);
            const productSnap = await getDoc(productRef);

            if (!productSnap.exists()) {
                throw new Error('Product not found');
            }

            const likes = productSnap.data().likes || [];
            const userId = this.currentUser.uid;

            if (likes.includes(userId)) {
                await updateDoc(productRef, {
                    likes: arrayRemove(userId)
                });
                return { liked: false, count: likes.length - 1 };
            } else {
                await updateDoc(productRef, {
                    likes: arrayUnion(userId)
                });
                return { liked: true, count: likes.length + 1 };
            }

        } catch (error) {
            console.error('Error toggling like:', error);
            throw error;
        }
    }

    // Increment view count
    async incrementViews(productId) {
        try {
            const productRef = doc(db, 'products', productId);
            await updateDoc(productRef, {
                views: increment(1)
            });
        } catch (error) {
            console.log('Error incrementing views:', error);
        }
    }

    // Get optimized image URL from Cloudinary
    getOptimizedImageUrl(imageData, options = {}) {
        if (!imageData || !imageData.url) return 'images/default-product.jpg';
        
        // If it's a Cloudinary URL, we can add transformations
        if (imageData.url.includes('cloudinary.com')) {
            const { width = 400, height = 400, crop = 'fill', quality = 'auto' } = options;
            return imageData.url.replace('/image/upload/', `/image/upload/w_${width},h_${height},c_${crop},q_${quality}/`);
        }
        
        return imageData.url;
    }

    // Format date
    formatDate(date) {
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'today';
        if (diffDays === 1) return 'yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
        if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
        return `${Math.floor(diffDays / 365)} years ago`;
    }

    // Cache management
    saveToCache(key, data) {
        try {
            const item = {
                data: data,
                timestamp: Date.now()
            };
            localStorage.setItem(this.cachePrefix + key, JSON.stringify(item));
        } catch (error) {
            console.log('Cache save error:', error);
        }
    }

    getFromCache(key) {
        try {
            const itemStr = localStorage.getItem(this.cachePrefix + key);
            if (!itemStr) return null;
            
            const item = JSON.parse(itemStr);
            if (Date.now() - item.timestamp > this.cacheExpiry) {
                localStorage.removeItem(this.cachePrefix + key);
                return null;
            }
            return item.data;
        } catch (error) {
            console.log('Cache get error:', error);
            return null;
        }
    }

    clearProductCache(productId) {
        try {
            localStorage.removeItem(this.cachePrefix + `product_${productId}`);
        } catch (error) {
            console.log('Cache clear error:', error);
        }
    }

    clearStoreCache(storeId) {
        try {
            localStorage.removeItem(this.cachePrefix + `store_${storeId}`);
        } catch (error) {
            console.log('Cache clear error:', error);
        }
    }

    clearUserStoresCache(userId) {
        try {
            localStorage.removeItem(this.cachePrefix + `user_stores_${userId}`);
            localStorage.removeItem(this.cachePrefix + `user_products_${userId}`);
        } catch (error) {
            console.log('Cache clear error:', error);
        }
    }

    clearAllCache() {
        try {
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith(this.cachePrefix)) {
                    localStorage.removeItem(key);
                }
            });
        } catch (error) {
            console.log('Cache clear error:', error);
        }
    }

    // Format price
    formatPrice(price) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(price);
    }

    // Calculate discounted price
    calculateDiscountedPrice(price, discount) {
        if (!discount || discount <= 0) return price;
        return price * (1 - discount / 100);
    }

    // Check if product is in stock
    isInStock(product) {
        if (product.stock === undefined) return true;
        return product.stock > 0;
    }

    // Get contact info
    getContactInfo(product) {
        return {
            whatsapp: product.ownerWhatsapp || null,
            telegram: product.ownerTelegram || null,
            email: product.ownerEmail || null
        };
    }
}

// Export for use in other files
export const productManager = new ProductManager();

// Make productManager available globally
window.productManager = productManager;

console.log('✅ products.js loaded successfully - No indexes required!');