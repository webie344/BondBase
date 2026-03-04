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

// Cloudinary credentials
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
        this.profileUserId = null;
        this.init();
        this.initProfileDisplay();
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
            return;
        }

        console.log('Profile page detected, loading stores...');

        // Try to get profile user ID from multiple sources
        let profileUserId = null;

        // Method 1: Check URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        profileUserId = urlParams.get('userId') || urlParams.get('uid') || urlParams.get('id');

        // Method 2: Check for user ID in profile data
        if (!profileUserId) {
            // Look for common profile data elements
            const profileElements = document.querySelectorAll('[data-user-id], [data-uid]');
            profileElements.forEach(el => {
                profileUserId = el.dataset.userId || el.dataset.uid;
            });
        }

        // Method 3: If on "my profile" page (account.html) and no user ID specified, use current user
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
                return dateB - dateA;
            });

            console.log(`Found ${this.stores.length} stores for user ${userId}`);
            console.log('Store data:', this.stores);

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
                    <i data-feather="shopping-bag"></i>
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
            const storeName = store.name || store.storeName || store.store_name || 'Unnamed Store';
            
            tabsHtml += `
                <div class="store-tab ${isActive}" data-store-id="${store.id}">
                    <i data-feather="${store.logo ? 'image' : 'shopping-bag'}"></i>
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
        
        const store = this.stores.find(s => s.id === storeId);
        if (store) {
            console.log('Switching to store:', store);
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

        console.log('Rendering store info:', store);

        // Show the store info card
        storeInfoCard.style.display = 'flex';

        // Set store logo
        if (storeLogo) {
            let logoUrl = 'images/default-store.jpg';
            
            // Try to get logo from various possible locations
            if (store.logo) {
                if (typeof store.logo === 'string') {
                    logoUrl = store.logo;
                } else if (store.logo.url) {
                    logoUrl = store.logo.url;
                } else if (store.logo.thumbnail) {
                    logoUrl = store.logo.thumbnail;
                }
            }
            // Check for logoThumbnail field
            else if (store.logoThumbnail) {
                logoUrl = store.logoThumbnail;
            }
            // Check for image field
            else if (store.image) {
                if (typeof store.image === 'string') {
                    logoUrl = store.image;
                } else if (store.image.url) {
                    logoUrl = store.image.url;
                }
            }
            
            console.log('Setting logo to:', logoUrl);
            storeLogo.src = logoUrl;
            
            // Add error handler
            storeLogo.onerror = function() {
                this.src = 'images/default-store.jpg';
            };
        }

        // Set store name
        if (storeNameEl) {
            const storeName = store.name || store.storeName || store.store_name || 'Unnamed Store';
            storeNameEl.innerHTML = `${storeName} <span class="store-verified" style="display: ${store.verified ? 'inline-block' : 'none'};">Verified</span>`;
        }

        // Set verified badge
        if (storeVerified) {
            storeVerified.style.display = store.verified ? 'inline-block' : 'none';
        }

        // Set description
        if (storeDescription) {
            storeDescription.textContent = store.description || store.bio || store.about || 'No description provided';
        }

        // Set products count
        if (storeProductsCount) {
            const countSpan = storeProductsCount.querySelector('span');
            if (countSpan) {
                countSpan.textContent = `${store.products || store.productCount || 0} products`;
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

        if (typeof feather !== 'undefined') {
            feather.replace();
        }
    }

    // Load store products for display
    async loadStoreProductsForDisplay(storeId) {
        try {
            const productsGrid = document.getElementById('productsGrid');
            if (!productsGrid) return;

            productsGrid.innerHTML = '<div class="loading">Loading products...</div>';

            const products = await this.getStoreProducts(storeId);
            
            products.sort((a, b) => {
                const dateA = a.createdAt ? a.createdAt.seconds : 0;
                const dateB = b.createdAt ? b.createdAt.seconds : 0;
                return dateB - dateA;
            });
            
            this.products[storeId] = products;
            console.log(`Found ${products.length} products for store ${storeId}`);

            if (products.length === 0) {
                productsGrid.innerHTML = `
                    <div class="no-products-message">
                        <i data-feather="package"></i>
                        <p>No products in this store yet</p>
                    </div>
                `;
            } else {
                this.renderProductsGrid(products);
            }

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

    // Render products grid with multi-currency support
    renderProductsGrid(products) {
        const productsGrid = document.getElementById('productsGrid');
        if (!productsGrid) return;

        let productsHtml = '';

        products.forEach(product => {
            // Get product image
            let productImage = 'images/default-product.jpg';
            
            if (product.images && product.images.length > 0) {
                const firstImage = product.images[0];
                if (typeof firstImage === 'string') {
                    productImage = firstImage;
                } else if (firstImage && firstImage.thumbnail) {
                    productImage = firstImage.thumbnail;
                } else if (firstImage && firstImage.url) {
                    productImage = firstImage.url;
                }
            } else if (product.image) {
                if (typeof product.image === 'string') {
                    productImage = product.image;
                } else if (product.image.url) {
                    productImage = product.image.url;
                }
            }

            // Get currency symbol
            const currencySymbols = {
                USD: '$',
                NGN: '₦',
                GBP: '£'
            };
            
            const currency = product.currency || 'USD';
            const symbol = currencySymbols[currency] || '$';
            
            // Get prices
            const discount = product.discount || 0;
            const price = product.salePrice || product.price || 0;
            const originalPrice = product.originalPrice || price;
            const hasDiscount = discount > 0 && price < originalPrice;

            productsHtml += `
                <div class="product-card" onclick="window.location.href='product.html?id=${product.id}'">
                    <div class="product-image-container">
                        <img src="${productImage}" alt="${product.name || 'Product'}" class="product-image" 
                             loading="lazy" onerror="this.src='images/default-product.jpg'">
                        ${product.status === 'new' ? '<span class="product-badge">NEW</span>' : ''}
                        ${hasDiscount ? '<span class="product-badge discount">-' + discount + '%</span>' : ''}
                    </div>
                    <div class="product-info">
                        <h4 class="product-name">${product.name || 'Unnamed Product'}</h4>
                        <div class="product-price">
                            <span class="current-price">${symbol}${price.toFixed(2)}</span>
                            ${hasDiscount ? `<span class="original-price">${symbol}${originalPrice.toFixed(2)}</span>` : ''}
                        </div>
                        <div class="product-stats">
                            <span class="product-stat">
                                <i data-feather="eye"></i>
                                ${product.views || 0}
                            </span>
                            <span class="product-stat">
                                <i data-feather="heart"></i>
                                ${product.likes ? product.likes.length : 0}
                            </span>
                        </div>
                    </div>
                </div>
            `;
        });

        productsGrid.innerHTML = productsHtml;

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

            let logoData = null;
            if (logo) {
                logoData = await this.uploadToCloudinary(logo);
                
                // Create thumbnail version
                if (logoData) {
                    logoData.thumbnail = logoData.url.replace('/image/upload/', '/image/upload/w_200,h_200,c_fill/');
                }
            }

            const storeRef = await addDoc(collection(db, 'stores'), {
                ...storeData,
                logo: logoData,
                logoThumbnail: logoData?.thumbnail,
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
                console.log('Store data from Firestore:', storeData);
                stores.push({
                    id: doc.id,
                    ...storeData
                });
            });

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

    // Update store
    async updateStore(storeId, updates, newLogo = null) {
        try {
            if (!this.currentUser) {
                throw new Error('You must be logged in to update a store');
            }

            const storeRef = doc(db, 'stores', storeId);
            const storeSnap = await getDoc(storeRef);

            if (!storeSnap.exists()) {
                throw new Error('Store not found');
            }

            if (storeSnap.data().ownerId !== this.currentUser.uid) {
                throw new Error('You do not have permission to update this store');
            }

            let logoData = updates.existingLogo || null;
            if (newLogo) {
                logoData = await this.uploadToCloudinary(newLogo);
                if (logoData) {
                    logoData.thumbnail = logoData.url.replace('/image/upload/', '/image/upload/w_200,h_200,c_fill/');
                }
            }

            await updateDoc(storeRef, {
                ...updates,
                logo: logoData,
                logoThumbnail: logoData?.thumbnail,
                updatedAt: serverTimestamp()
            });

            this.clearStoreCache(storeId);
            this.clearUserStoresCache(this.currentUser.uid);

            return true;

        } catch (error) {
            console.error('Error updating store:', error);
            throw error;
        }
    }

    // Delete store
    async deleteStore(storeId) {
        try {
            if (!this.currentUser) {
                throw new Error('You must be logged in to delete a store');
            }

            const storeRef = doc(db, 'stores', storeId);
            const storeSnap = await getDoc(storeRef);

            if (!storeSnap.exists()) {
                throw new Error('Store not found');
            }

            if (storeSnap.data().ownerId !== this.currentUser.uid) {
                throw new Error('You do not have permission to delete this store');
            }

            const productsQuery = query(
                collection(db, 'products'),
                where('storeId', '==', storeId),
                limit(1)
            );
            const productsSnap = await getDocs(productsQuery);
            
            if (!productsSnap.empty) {
                throw new Error('Cannot delete store with existing products. Delete products first.');
            }

            await deleteDoc(storeRef);

            this.clearStoreCache(storeId);
            this.clearUserStoresCache(this.currentUser.uid);

            return true;

        } catch (error) {
            console.error('Error deleting store:', error);
            throw error;
        }
    }

    // Create a new product with multi-currency support
    async createProduct(productData, images = []) {
        try {
            if (!this.currentUser) {
                throw new Error('You must be logged in to create a product');
            }

            let imageData = [];
            if (images.length > 0) {
                imageData = await this.uploadImages(images);
                
                // Add thumbnails
                imageData = imageData.map(img => ({
                    ...img,
                    thumbnail: img.url.replace('/image/upload/', '/image/upload/w_200,h_200,c_fill/')
                }));
            }

            const productRef = await addDoc(collection(db, 'products'), {
                ...productData,
                images: imageData,
                ownerId: this.currentUser.uid,
                ownerEmail: this.currentUser.email,
                ownerName: this.currentUser.displayName || 'Seller',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                views: 0,
                likes: [],
                orders: 0,
                status: 'active'
            });

            if (productData.storeId) {
                const storeRef = doc(db, 'stores', productData.storeId);
                await updateDoc(storeRef, {
                    products: increment(1),
                    updatedAt: serverTimestamp()
                });
            }

            this.clearStoreCache(productData.storeId);
            this.clearUserStoresCache(this.currentUser.uid);

            return {
                productId: productRef.id,
                images: imageData
            };

        } catch (error) {
            console.error('Error creating product:', error);
            throw error;
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

            if (productSnap.data().ownerId !== this.currentUser.uid) {
                throw new Error('You do not have permission to update this product');
            }

            let imageData = [...(updates.existingImages || [])];
            if (newImages.length > 0) {
                const newImageData = await this.uploadImages(newImages);
                
                // Add thumbnails
                const processedImages = newImageData.map(img => ({
                    ...img,
                    thumbnail: img.url.replace('/image/upload/', '/image/upload/w_200,h_200,c_fill/')
                }));
                
                imageData = [...imageData, ...processedImages];
            }

            await updateDoc(productRef, {
                ...updates,
                images: imageData,
                updatedAt: serverTimestamp()
            });

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

            if (productSnap.data().ownerId !== this.currentUser.uid) {
                throw new Error('You do not have permission to delete this product');
            }

            await deleteDoc(productRef);

            if (productSnap.data().storeId) {
                const storeRef = doc(db, 'stores', productSnap.data().storeId);
                await updateDoc(storeRef, {
                    products: increment(-1),
                    updatedAt: serverTimestamp()
                });
            }

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

    // Format price with currency symbol
    formatPrice(price, currency = 'USD') {
        const symbols = {
            USD: '$',
            NGN: '₦',
            GBP: '£'
        };
        const symbol = symbols[currency] || '$';
        return `${symbol}${parseFloat(price).toFixed(2)}`;
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
}

// Export for use in other files
export const productManager = new ProductManager();

// Make productManager available globally
window.productManager = productManager;

console.log('✅ products.js loaded successfully - Added multi-currency support');