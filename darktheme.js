// dark-theme.js

// Add the dark theme CSS to the document
const darkThemeStyles = `
/* Dark Theme Styles */
.dark-theme {
    --primary-color: #ff4757;
    --secondary-color: #747d8c;
    --accent-color: #2ed573;
    --light-color: #2f3542;
    --dark-color: #f1f2f6;
    --text-color: #f1f2f6;
    --text-light: #a4b0be;
    --white: #2f3436;
    --shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
}

.dark-theme body {
    background-color: #1e272e;
    color: var(--text-color);
}

.dark-theme .navbar {
    background-color: #2d3436;
    box-shadow: var(--shadow);
}

.dark-theme .logo {
    color: var(--primary-color);
}

.dark-theme .nav-links {
    color: var(--text-color);
}

.dark-theme .nav-links:hover {
    color: var(--primary-color);
}

.dark-theme .auth-form {
    background-color: #2d3436;
    box-shadow: var(--shadow);
}

.dark-theme .auth-form h2 {
    color: var(--primary-color);
}

.dark-theme .form-group input,
.dark-theme .form-group select,
.dark-theme .form-group textarea {
    background-color: #3b4046;
    border-color: #4b525a;
    color: var(--text-color);
}

.dark-theme .form-group input:focus,
.dark-theme .form-group select:focus,
.dark-theme .form-group textarea:focus {
    border-color: var(--primary-color);
}

.dark-theme .profile-card,
.dark-theme .profile-details,
.dark-theme .account-sidebar,
.dark-theme .account-main,
.dark-theme .message-card,
.dark-theme .proof-card,
.dark-theme .payment-plan,
.dark-theme .payment-form,
.dark-theme .stat-card,
.dark-theme .chat-points-container {
    background-color: #2d3436;
    box-shadow: var(--shadow);
}

.dark-theme .interest-tag {
    background-color: #3b4046;
    color: var(--text-color);
}

.dark-theme .menu-item:hover,
.dark-theme .menu-item.active {
    background-color: #3b4046;
}

.dark-theme .chat-header {
    background-color: #2d3436;
    border-bottom-color: #3b4046;
}

.dark-theme .chat-input-container {
    background-color: #2d3436;
    border-top-color: #3b4046;
}

.dark-theme .chat-input input {
    background-color: #3b4046;
    border-color: #4b525a;
    color: var(--text-color);
}

.dark-theme .message.received {
    background-color: #3b4046;
    color: var(--text-color);
}

.dark-theme .search-container input {
    background-color: #3b4046;
    border-color: #4b525a;
    color: var(--text-color);
}

.dark-theme .thumbnail {
    opacity: 0.8;
}

.dark-theme .thumbnail:hover,
.dark-theme .thumbnail.active {
    opacity: 1;
    border-color: var(--primary-color);
}

.dark-theme .crypto-address {
    background-color: #3b4046;
    color: var(--text-color);
}

.dark-theme .voice-note-preview {
    background-color: #3b4046;
}

.dark-theme .cancel-voice-note-btn {
    background-color: transparent;
    color: var(--text-color);
    border-color: #4b525a;
}

/* Theme Toggle Button */
.theme-toggle {
    background: none;
    border: none;
    color: var(--text-color);
    cursor: pointer;
    font-size: 1.2rem;
    padding: 0.5rem;
    border-radius: 50%;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
}

.theme-toggle:hover {
    background-color: rgba(255, 255, 255, 0.1);
    transform: scale(1.1);
}

.dark-theme .theme-toggle {
    color: var(--text-color);
}
`;

// Add the dark theme styles to the document
const styleSheet = document.createElement('style');
styleSheet.textContent = darkThemeStyles;
document.head.appendChild(styleSheet);

// Theme management functions
function enableDarkTheme() {
    document.body.classList.add('dark-theme');
    localStorage.setItem('theme', 'dark');
    updateThemeToggleIcon();
}

function enableLightTheme() {
    document.body.classList.remove('dark-theme');
    localStorage.setItem('theme', 'light');
    updateThemeToggleIcon();
}

function updateThemeToggleIcon() {
    const themeIcon = document.getElementById('themeIcon');
    if (themeIcon) {
        if (document.body.classList.contains('dark-theme')) {
            themeIcon.className = 'fas fa-sun';
        } else {
            themeIcon.className = 'fas fa-moon';
        }
    }
}

function toggleTheme() {
    if (document.body.classList.contains('dark-theme')) {
        enableLightTheme();
    } else {
        enableDarkTheme();
    }
}

// Initialize theme based on user preference or system setting
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        enableDarkTheme();
    } else if (savedTheme === 'light') {
        enableLightTheme();
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        enableDarkTheme();
    }
    updateThemeToggleIcon();
}

// Initialize theme when DOM is loaded
document.addEventListener('DOMContentLoaded', initTheme);

// Listen for system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (!localStorage.getItem('theme')) {
        if (e.matches) {
            enableDarkTheme();
        } else {
            enableLightTheme();
        }
    }
});