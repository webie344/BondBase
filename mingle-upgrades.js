// like-animation.js
document.addEventListener('DOMContentLoaded', function() {
    // Check if we're on a page with a like button
    const likeBtn = document.getElementById('likeBtn');
    const likeProfileBtn = document.getElementById('likeProfileBtn');
    
    if (likeBtn || likeProfileBtn) {
        // Create animation elements
        const animationContainer = document.createElement('div');
        animationContainer.style.position = 'fixed';
        animationContainer.style.top = '0';
        animationContainer.style.left = '0';
        animationContainer.style.width = '100%';
        animationContainer.style.height = '100%';
        animationContainer.style.pointerEvents = 'none';
        animationContainer.style.zIndex = '1000';
        animationContainer.style.display = 'none';
        document.body.appendChild(animationContainer);
        
        // Create heart elements for animation
        const hearts = [];
        for (let i = 0; i < 12; i++) {
            const heart = document.createElement('div');
            heart.innerHTML = '❤️';
            heart.style.position = 'absolute';
            heart.style.fontSize = '24px';
            heart.style.opacity = '0';
            heart.style.transform = 'translate(-50%, -50%) scale(0)';
            heart.style.transition = 'all 1s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            animationContainer.appendChild(heart);
            hearts.push(heart);
        }
        
        // Animation function
        function playLikeAnimation(event) {
            // Get click position or center if no event (programmatic click)
            const x = event ? event.clientX : window.innerWidth / 2;
            const y = event ? event.clientY : window.innerHeight / 2;
            
            // Show animation container
            animationContainer.style.display = 'block';
            
            // Position and animate each heart
            hearts.forEach((heart, index) => {
                // Reset styles
                heart.style.opacity = '1';
                heart.style.transform = 'translate(-50%, -50%) scale(0)';
                heart.style.left = `${x}px`;
                heart.style.top = `${y}px`;
                
                // Random angle and distance for each heart
                const angle = Math.random() * Math.PI * 2;
                const distance = 50 + Math.random() * 100;
                const delay = index * 0.05;
                
                // Animate after a short delay
                setTimeout(() => {
                    heart.style.transform = `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance - 50}px) scale(1.5)`;
                    heart.style.opacity = '0';
                }, delay * 1000);
            });
            
            // Hide container after animation completes
            setTimeout(() => {
                animationContainer.style.display = 'none';
            }, 2000);
        }
        
        // Attach to like buttons
        if (likeBtn) {
            likeBtn.addEventListener('click', function(e) {
                playLikeAnimation(e);
            });
        }
        
        if (likeProfileBtn) {
            likeProfileBtn.addEventListener('click', function(e) {
                playLikeAnimation(e);
            });
        }
        
        // Add CSS for smooth animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes heartPulse {
                0% { transform: scale(1); opacity: 1; }
                50% { transform: scale(1.3); opacity: 0.8; }
                100% { transform: scale(1); opacity: 1; }
            }
            
            .liked {
                animation: heartPulse 0.5s ease-in-out;
                color: #ff4d4d;
            }
        `;
        document.head.appendChild(style);
    }
});