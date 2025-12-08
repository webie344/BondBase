// pagination.js - Invisible Pagination System
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    orderBy, 
    limit, 
    startAfter,
    getDocs,
    getCountFromServer
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

class InvisiblePagination {
    constructor(config = {}) {
        // Firebase configuration (same as your app.js)
        this.firebaseConfig = {
            apiKey: "AIzaSyC9uL_BX14Z6rRpgG4MT9Tca1opJl8EviQ",
            authDomain: "dating-connect.firebaseapp.com",
            projectId: "dating-connect",
            storageBucket: "dating-connect.firebaseapp.com",
            messagingSenderId: "1062172180210",
            appId: "1:1062172180210:web:0c9b3c1578a5dbae58da6b"
        };

        this.app = initializeApp(this.firebaseConfig, `pagination-${Date.now()}`);
        this.db = getFirestore(this.app);

        // Configuration
        this.config = {
            collectionName: config.collectionName || 'users',
            itemsPerPage: config.itemsPerPage || 10,
            filters: config.filters || {},
            orderBy: config.orderBy || 'createdAt',
            orderDirection: config.orderDirection || 'desc',
            onDataLoad: config.onDataLoad || (() => {}),
            onPageChange: config.onPageChange || (() => {}),
            ...config
        };

        this.currentPage = 1;
        this.totalItems = 0;
        this.totalPages = 0;
        this.lastVisible = null;
        this.isLoading = false;

        this.init();
    }

    async init() {
        await this.loadTotalCount();
        
        // Listen to your existing navigation controls
        this.attachToExistingControls();
    }

    async loadTotalCount() {
        try {
            const collectionRef = collection(this.db, this.config.collectionName);
            let countQuery = collectionRef;

            if (Object.keys(this.config.filters).length > 0) {
                Object.entries(this.config.filters).forEach(([field, value]) => {
                    countQuery = query(countQuery, where(field, '==', value));
                });
            }

            const snapshot = await getCountFromServer(countQuery);
            this.totalItems = snapshot.data().count;
            this.totalPages = Math.ceil(this.totalItems / this.config.itemsPerPage);
            
            // Update your existing page info displays
            this.updatePageInfo();
        } catch (error) {
            console.error('Error loading total count:', error);
        }
    }

    async loadPageData() {
        if (this.isLoading) return;

        this.isLoading = true;

        try {
            const collectionRef = collection(this.db, this.config.collectionName);
            let firebaseQuery = query(
                collectionRef,
                orderBy(this.config.orderBy, this.config.orderDirection),
                limit(this.config.itemsPerPage)
            );

            // Apply filters
            if (Object.keys(this.config.filters).length > 0) {
                Object.entries(this.config.filters).forEach(([field, value]) => {
                    firebaseQuery = query(firebaseQuery, where(field, '==', value));
                });
            }

            // Apply pagination
            if (this.currentPage > 1 && this.lastVisible) {
                firebaseQuery = query(firebaseQuery, startAfter(this.lastVisible));
            }

            const snapshot = await getDocs(firebaseQuery);
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            if (snapshot.docs.length > 0) {
                this.lastVisible = snapshot.docs[snapshot.docs.length - 1];
            }

            // Send data to your existing display functions
            this.config.onDataLoad(data, this.getCurrentState());
            
            // Update your existing UI
            this.updateNavigationState();

        } catch (error) {
            console.error('Error loading page data:', error);
        } finally {
            this.isLoading = false;
        }
    }

    attachToExistingControls() {
        // Wait for page to load then attach to your existing controls
        setTimeout(() => {
            // Look for your existing navigation buttons
            this.setupExistingButtonListeners();
        }, 1000);
    }

    setupExistingButtonListeners() {
        // Previous/Next buttons (common selectors)
        const prevButtons = document.querySelectorAll('#prevBtn, .prev-button, [data-prev], .pagination-prev');
        const nextButtons = document.querySelectorAll('#nextBtn, .next-button, [data-next], .pagination-next');
        
        // Page number buttons
        const pageButtons = document.querySelectorAll('[data-page], .page-button, .pagination-number');

        prevButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.previousPage();
            });
        });

        nextButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.nextPage();
            });
        });

        pageButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const page = parseInt(btn.dataset.page) || parseInt(btn.textContent);
                if (page) this.goToPage(page);
            });
        });

        
    }

    async goToPage(page) {
        if (this.isLoading || page < 1 || page > this.totalPages || page === this.currentPage) {
            return;
        }

        // Reset if going to first page or navigating backwards
        if (page === 1 || page < this.currentPage) {
            this.lastVisible = null;
        }

        this.currentPage = page;
        
        // Update your existing page indicator
        this.updatePageInfo();
        
        // Call your existing page change handler
        this.config.onPageChange(this.currentPage, this.totalPages);
        
        await this.loadPageData();
    }

    previousPage() {
        if (this.currentPage > 1) {
            this.goToPage(this.currentPage - 1);
        }
    }

    nextPage() {
        if (this.currentPage < this.totalPages) {
            this.goToPage(this.currentPage + 1);
        }
    }

    updatePageInfo() {
        // Update your existing page info displays
        const pageInfoElements = document.querySelectorAll('.page-info, .pagination-info, [data-page-info]');
        pageInfoElements.forEach(el => {
            el.textContent = `Page ${this.currentPage} of ${this.totalPages}`;
        });

        // Update items count
        const itemsInfoElements = document.querySelectorAll('.items-info, [data-items-info]');
        const startItem = (this.currentPage - 1) * this.config.itemsPerPage + 1;
        const endItem = Math.min(this.currentPage * this.config.itemsPerPage, this.totalItems);
        
        itemsInfoElements.forEach(el => {
            el.textContent = `Showing ${startItem}-${endItem} of ${this.totalItems} items`;
        });
    }

    updateNavigationState() {
        // Enable/disable your existing buttons based on current page
        const prevButtons = document.querySelectorAll('#prevBtn, .prev-button, [data-prev]');
        const nextButtons = document.querySelectorAll('#nextBtn, .next-button, [data-next]');

        prevButtons.forEach(btn => {
            btn.disabled = this.currentPage === 1;
        });

        nextButtons.forEach(btn => {
            btn.disabled = this.currentPage === this.totalPages;
        });
    }

    getCurrentState() {
        const startItem = (this.currentPage - 1) * this.config.itemsPerPage + 1;
        const endItem = Math.min(this.currentPage * this.config.itemsPerPage, this.totalItems);

        return {
            currentPage: this.currentPage,
            totalPages: this.totalPages,
            totalItems: this.totalItems,
            itemsPerPage: this.config.itemsPerPage,
            startIndex: startItem,
            endIndex: endItem,
            hasPrevious: this.currentPage > 1,
            hasNext: this.currentPage < this.totalPages
        };
    }

    async refresh() {
        this.lastVisible = null;
        await this.loadTotalCount();
        await this.loadPageData();
    }

    async updateFilters(newFilters) {
        this.config.filters = { ...this.config.filters, ...newFilters };
        this.currentPage = 1;
        this.lastVisible = null;
        await this.loadTotalCount();
        await this.loadPageData();
    }
}

// Auto-initialize for your existing pages
document.addEventListener('DOMContentLoaded', function() {
    // Wait for your app.js to initialize
    setTimeout(() => {
        initializeExistingPagination();
    }, 2000);
});

function initializeExistingPagination() {
    const currentPage = window.location.pathname.split('/').pop();
    
    // Profiles pagination (uses your existing like/dislike buttons as navigation)
    if (currentPage.includes('mingle') || document.querySelector('#dislikeBtn, #likeBtn')) {
        window.profilesPagination = new InvisiblePagination({
            collectionName: 'users',
            itemsPerPage: 12,
            filters: { profileComplete: true },
            orderBy: 'createdAt',
            onDataLoad: (profiles, state) => {
                // This will be called by your existing displayProfiles function
                
                
                // If you have existing profile display, it will work automatically
                // The pagination just provides the right data subset
            },
            onPageChange: (currentPage, totalPages) => {
                
                // Your existing page change logic here
            }
        });

        // Use like/dislike as implicit "next page" triggers
        const likeBtn = document.getElementById('likeBtn');
        const dislikeBtn = document.getElementById('dislikeBtn');
        
        if (likeBtn) {
            const originalLike = likeBtn.onclick;
            likeBtn.onclick = function(e) {
                if (originalLike) originalLike.call(this, e);
                setTimeout(() => window.profilesPagination.nextPage(), 100);
            };
        }
        
        if (dislikeBtn) {
            const originalDislike = dislikeBtn.onclick;
            dislikeBtn.onclick = function(e) {
                if (originalDislike) originalDislike.call(this, e);
                setTimeout(() => window.profilesPagination.nextPage(), 100);
            };
        }
    }

    // Messages pagination
    if (currentPage.includes('messages') || document.querySelector('#messagesList')) {
        window.messagesPagination = new InvisiblePagination({
            collectionName: 'conversations',
            itemsPerPage: 25,
            orderBy: 'updatedAt',
            onDataLoad: (conversations, state) => {

                // Your existing displayMessages function will receive this data
            }
        });
    }


}

// Global access
window.InvisiblePagination = InvisiblePagination;