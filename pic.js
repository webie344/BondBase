// pic.js - Enhanced to work with your Firebase dating app
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is authenticated before initializing
    const auth = getAuth();
    onAuthStateChanged(auth, (user) => {
        if (user) {
            initImageClickHandler();
            styleClickableImages();
        }
    });
});

function initImageClickHandler() {
    // Use event delegation for dynamic content
    document.addEventListener('click', function(e) {
        // Check if the clicked element is an image or inside an image container
        const imgElement = e.target.closest('img');
        if (imgElement && imgElement.src) {
            e.preventDefault();
            e.stopPropagation();
            
            // Don't proceed if image is part of a button or other control
            if (imgElement.closest('button') || imgElement.closest('a')) {
                return;
            }
            
            openImageInFullScreen(imgElement);
        }
    });
}

function openImageInFullScreen(imgElement) {
    // Get the image source and any additional data
    const imageUrl = imgElement.src;
    const altText = imgElement.alt || '';
    
    // Store the image data for the full.html page
    localStorage.setItem('fullScreenImage', JSON.stringify({
        url: imageUrl,
        alt: altText,
        timestamp: new Date().getTime() // To avoid caching issues
    }));
    
    // Open the full screen view
    window.open('full.html', '_blank', 'width=1200,height=800,scrollbars=no');
}

function styleClickableImages() {
    const images = getAllImages();
    images.forEach(img => {
        // Skip if already styled or is part of UI elements
        if (img.classList.contains('clickable-image') || 
            img.closest('button') || 
            img.id === 'accountProfileImage' ||
            img.parentElement.classList.contains('permission-btn')) {
            return;
        }
        
        img.classList.add('clickable-image');
        img.style.cursor = 'pointer';
        img.style.transition = 'transform 0.2s ease';
        
        // Add hover effect
        img.addEventListener('mouseenter', () => {
            img.style.transform = 'scale(1.02)';
        });
        
        img.addEventListener('mouseleave', () => {
            img.style.transform = 'scale(1)';
        });
    });
}

function getAllImages(container = document) {
    return Array.from(container.querySelectorAll('img:not(.no-click)'));
}

// Make functions available globally for your app.js if needed
window.ImageViewer = {
    init: initImageClickHandler,
    styleImages: styleClickableImages,
    openImage: openImageInFullScreen
};

