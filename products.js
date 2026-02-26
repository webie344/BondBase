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
const CLOUDINARY_CLOUD_NAME = 'ddtdqrh1b'; // Get from Cloudinary dashboard
const CLOUDINARY_UPLOAD_PRESET = 'profile-pictures'; // Create in Cloudinary settings

// Product Class
class ProductManager {
    constructor() {
        this.currentUser = null;
        this.cachePrefix = 'products_';
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
        this.init();
    }

    async init() {
        onAuthStateChanged(auth, (user) => {
            this.currentUser = user;
        });
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

            console.log('Uploading to Cloudinary...', {
                cloudName: CLOUDINARY_CLOUD_NAME,
                preset: CLOUDINARY_UPLOAD_PRESET
            });

            const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.text();
                console.error('Cloudinary upload failed:', errorData);
                throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            
            console.log('Upload successful:', data.secure_url);
            
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

    // Create a new product
    async createProduct(productData, images = []) {
        try {
            if (!this.currentUser) {
                throw new Error('You must be logged in to create a product');
            }

            console.log('Creating product with images:', images.length);

            // Upload images to Cloudinary
            let imageData = [];
            if (images.length > 0) {
                imageData = await this.uploadImages(images);
            }

            // Create product document in Firestore
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

            console.log('Product created with ID:', productRef.id);

            // Update store product count
            if (productData.storeId) {
                const storeRef = doc(db, 'stores', productData.storeId);
                await updateDoc(storeRef, {
                    products: increment(1),
                    updatedAt: serverTimestamp()
                });
            }

            // Clear cache for this store
            this.clearStoreCache(productData.storeId);

            return {
                productId: productRef.id,
                images: imageData
            };

        } catch (error) {
            console.error('Error creating product:', error);
            throw error;
        }
    }

    // Get all products
    async getAllProducts(filters = {}) {
        try {
            const cacheKey = `all_${JSON.stringify(filters)}`;
            const cached = this.getFromCache(cacheKey);
            
            if (cached) {
                console.log('Returning cached products');
                return cached;
            }

            let q = collection(db, 'products');
            const constraints = [];
            
            // Apply filters
            if (filters.category && filters.category !== 'all') {
                constraints.push(where('category', '==', filters.category));
            }
            
            if (filters.status) {
                constraints.push(where('status', '==', filters.status));
            }
            
            // Sort by date (newest first)
            constraints.push(orderBy('createdAt', 'desc'));
            
            // Apply limit
            if (filters.limit) {
                constraints.push(limit(filters.limit));
            }

            if (constraints.length > 0) {
                q = query(collection(db, 'products'), ...constraints);
            }

            const querySnapshot = await getDocs(q);
            const products = [];
            
            querySnapshot.forEach((doc) => {
                products.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            console.log(`Found ${products.length} products`);

            // Cache the result
            this.saveToCache(cacheKey, products);

            return products;

        } catch (error) {
            console.error('Error getting products:', error);
            return [];
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
                where('status', '==', 'active'),
                orderBy('createdAt', 'desc')
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

    // Search products
    async searchProducts(searchTerm, filters = {}) {
        try {
            const allProducts = await this.getAllProducts(filters);
            
            const term = searchTerm.toLowerCase().trim();
            if (!term) return allProducts;
            
            return allProducts.filter(product => 
                (product.name && product.name.toLowerCase().includes(term)) ||
                (product.description && product.description.toLowerCase().includes(term)) ||
                (product.storeName && product.storeName.toLowerCase().includes(term)) ||
                (product.category && product.category.toLowerCase().includes(term))
            );

        } catch (error) {
            console.error('Error searching products:', error);
            return [];
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

// Initialize
productManager.init();

console.log('✅ products.js loaded successfully');

