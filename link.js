// link.js - Pure JavaScript Link Preview Handler for Bond Base
// This file handles generating link previews and sharing functionality

// Bond Base site information
const SITE_INFO = {
    name: 'Bond Base',
    domain: 'bond-base.vercel.app',
    title: 'Bond Base - Anonymous Gaming & Anime Chat App',
    description: 'Anonymous gaming and anime fans chat app dedicated to bringing anime lovers and gamers together in a friendly arena. Connect with like-minded fans anonymously!',
    image: '/Bondbases.png',
    imageAlt: 'Bond Base - Gaming & Anime Community',
    themeColor: '#4a8cff'
};

// Generate the main site preview
function generateSitePreview() {
    return {
        title: SITE_INFO.title,
        description: SITE_INFO.description,
        image: SITE_INFO.image,
        url: `https://${SITE_INFO.domain}`,
        siteName: SITE_INFO.name,
        imageAlt: SITE_INFO.imageAlt
    };
}

// Copy link to clipboard
async function copyLinkToClipboard(link) {
    try {
        await navigator.clipboard.writeText(link);
        return { success: true };
    } catch (err) {
        console.error('Failed to copy:', err);
        
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = link;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        
        try {
            document.execCommand('copy');
            document.body.removeChild(textarea);
            return { success: true };
        } catch (fallbackErr) {
            document.body.removeChild(textarea);
            return { success: false, error: fallbackErr };
        }
    }
}

// Share on WhatsApp
function shareOnWhatsApp(link) {
    const encodedLink = encodeURIComponent(link);
    const text = encodeURIComponent('Check out Bond Base - Anonymous Gaming & Anime Chat App!');
    window.open(`https://wa.me/?text=${encodedLink}`, '_blank');
}

// Share on Telegram
function shareOnTelegram(link) {
    const encodedLink = encodeURIComponent(link);
    window.open(`https://t.me/share/url?url=${encodedLink}`, '_blank');
}

// Share on Twitter/X
function shareOnTwitter(link) {
    const encodedLink = encodeURIComponent(link);
    const text = encodeURIComponent('Check out Bond Base - Anonymous Gaming & Anime Chat App!');
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${encodedLink}`, '_blank', 'width=600,height=400');
}

// Share on Facebook
function shareOnFacebook(link) {
    const encodedLink = encodeURIComponent(link);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodedLink}`, '_blank', 'width=600,height=400');
}

// Share on LinkedIn
function shareOnLinkedIn(link) {
    const encodedLink = encodeURIComponent(link);
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodedLink}`, '_blank', 'width=600,height=400');
}

// Share on Reddit
function shareOnReddit(link) {
    const encodedLink = encodeURIComponent(link);
    const title = encodeURIComponent('Bond Base - Anonymous Gaming & Anime Chat App');
    window.open(`https://www.reddit.com/submit?url=${encodedLink}&title=${title}`, '_blank', 'width=600,height=400');
}

// Share via Email
function shareViaEmail(link) {
    const subject = encodeURIComponent('Join me on Bond Base!');
    const body = encodeURIComponent(`Check out Bond Base - an anonymous gaming and anime chat app!\n\n${link}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
}

// Share on Pinterest
function shareOnPinterest(link) {
    const encodedLink = encodeURIComponent(link);
    const description = encodeURIComponent('Bond Base - Anonymous Gaming & Anime Chat App');
    window.open(`https://pinterest.com/pin/create/button/?url=${encodedLink}&description=${description}`, '_blank', 'width=600,height=400');
}

// Export functions for use in HTML
window.BondBaseShare = {
    copyLinkToClipboard,
    shareOnWhatsApp,
    shareOnTelegram,
    shareOnTwitter,
    shareOnFacebook,
    shareOnLinkedIn,
    shareOnReddit,
    shareViaEmail,
    shareOnPinterest,
    generateSitePreview,
    SITE_INFO
};