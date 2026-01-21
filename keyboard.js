// keyboard.js - iOS-style Custom Virtual Keyboard
class iOSKeyboard {
    constructor() {
        this.textarea = document.getElementById('messageInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.keyboardContainer = null;
        this.isShift = false;
        this.isCaps = false;
        this.currentLayout = 'letters';
        this.isVisible = false;
        this.keyboardHeight = 260;
        this.isDarkMode = false;
        
        // iOS keyboard layouts
        this.layouts = {
            letters: [
                ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
                ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
                ['↑', 'z', 'x', 'c', 'v', 'b', 'n', 'm', '⌫'],
                ['123', '🌐', 'space', 'return']
            ],
            numbers: [
                ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
                ['-', '/', ':', ';', '(', ')', '$', '&', '@', '"'],
                ['#+=', '.', ',', '?', '!', "'", '⌫'],
                ['ABC', '🌐', 'space', 'return']
            ],
            symbols: [
                ['[', ']', '{', '}', '#', '%', '^', '*', '+', '='],
                ['_', '\\', '|', '~', '<', '>', '€', '£', '¥', '•'],
                ['123', '.', ',', '?', '!', "'", '⌫'],
                ['ABC', '🌐', 'space', 'return']
            ]
        };
        
        this.init();
    }
    
    init() {
        this.createKeyboard();
        this.setupEventListeners();
        this.setupInputFocus();
        
        // Listen for theme changes
        const observer = new MutationObserver(() => {
            this.isDarkMode = document.body.classList.contains('dark-mode') || 
                             document.documentElement.classList.contains('dark') ||
                             window.matchMedia('(prefers-color-scheme: dark)').matches;
            this.updateKeyboardTheme();
        });
        
        observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
        
        // Initial theme check
        this.isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
        this.updateKeyboardTheme();
    }
    
    createKeyboard() {
        // Create keyboard container
        this.keyboardContainer = document.createElement('div');
        this.keyboardContainer.id = 'ios-keyboard';
        this.keyboardContainer.className = 'ios-keyboard';
        
        // Create keyboard layout
        const keyboardLayout = document.createElement('div');
        keyboardLayout.className = 'keyboard-layout';
        this.keyboardContainer.appendChild(keyboardLayout);
        
        // Create toolbar
        const toolbar = document.createElement('div');
        toolbar.className = 'keyboard-toolbar';
        toolbar.innerHTML = `
            <div class="toolbar-left">
                <button class="toolbar-btn emoji-btn" title="Emoji">
                    <i class="fas fa-smile"></i>
                </button>
                <button class="toolbar-btn dictation-btn" title="Dictation">
                    <i class="fas fa-microphone"></i>
                </button>
            </div>
            <div class="toolbar-center">
                <button class="toolbar-btn hide-btn" title="Hide Keyboard">
                    <i class="fas fa-keyboard"></i>
                </button>
            </div>
            <div class="toolbar-right">
                <button class="toolbar-btn settings-btn" title="Keyboard Settings">
                    <i class="fas fa-cog"></i>
                </button>
            </div>
        `;
        this.keyboardContainer.appendChild(toolbar);
        
        document.body.appendChild(this.keyboardContainer);
        this.renderKeyboard();
    }
    
    renderKeyboard() {
        const layout = this.layouts[this.currentLayout];
        const keyboardLayout = this.keyboardContainer.querySelector('.keyboard-layout');
        keyboardLayout.innerHTML = '';
        
        layout.forEach(row => {
            const rowDiv = document.createElement('div');
            rowDiv.className = 'keyboard-row';
            
            row.forEach(keyChar => {
                const key = document.createElement('button');
                key.className = 'key';
                key.setAttribute('role', 'button');
                key.setAttribute('aria-label', keyChar === 'space' ? 'Space' : keyChar);
                
                // Set key content
                if (keyChar === '↑') {
                    key.innerHTML = '<i class="fas fa-arrow-up"></i>';
                } else if (keyChar === '⌫') {
                    key.innerHTML = '<i class="fas fa-delete-left"></i>';
                } else if (keyChar === '🌐') {
                    key.innerHTML = '<i class="fas fa-globe"></i>';
                } else if (keyChar === 'space') {
                    key.textContent = 'space';
                } else if (keyChar === 'return') {
                    key.innerHTML = '<i class="fas fa-arrow-turn-up"></i>';
                } else {
                    key.textContent = this.getKeyDisplay(keyChar);
                }
                
                // Add data attribute and classes
                key.dataset.key = keyChar;
                
                if (['↑', '⌫', 'return', 'space', '123', 'ABC', '#+=', '🌐'].includes(keyChar)) {
                    key.classList.add('special', keyChar);
                }
                
                if (keyChar === 'space') key.classList.add('space');
                if (keyChar === 'return') key.classList.add('enter');
                
                // Shift/caps handling
                if (this.isShift || this.isCaps) {
                    if (keyChar.length === 1 && keyChar.match(/[a-z]/)) {
                        key.textContent = keyChar.toUpperCase();
                    }
                }
                
                rowDiv.appendChild(key);
            });
            
            keyboardLayout.appendChild(rowDiv);
        });
        
        this.setupKeyListeners();
        this.updateShiftKey();
    }
    
    getKeyDisplay(key) {
        if (this.currentLayout === 'letters') {
            if ((this.isShift || this.isCaps) && key.match(/[a-z]/)) {
                return key.toUpperCase();
            }
        }
        return key;
    }
    
    setupKeyListeners() {
        const keys = this.keyboardContainer.querySelectorAll('.key');
        
        keys.forEach(key => {
            // Remove existing listeners
            const newKey = key.cloneNode(true);
            key.parentNode.replaceChild(newKey, key);
            
            newKey.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.handleKeyPress(newKey.dataset.key);
            });
            
            // Touch feedback
            newKey.addEventListener('touchstart', () => {
                newKey.classList.add('key-pressed');
            }, { passive: true });
            
            newKey.addEventListener('touchend', () => {
                newKey.classList.remove('key-pressed');
            }, { passive: true });
        });
        
        // Setup toolbar buttons
        const toolbarButtons = this.keyboardContainer.querySelectorAll('.toolbar-btn');
        toolbarButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                if (btn.classList.contains('emoji-btn')) {
                    this.showEmojiPicker();
                } else if (btn.classList.contains('dictation-btn')) {
                    this.startDictation();
                } else if (btn.classList.contains('hide-btn')) {
                    this.hide();
                } else if (btn.classList.contains('settings-btn')) {
                    this.showSettings();
                }
            });
        });
    }
    
    handleKeyPress(key) {
        const input = this.textarea;
        const cursorPos = input.selectionStart;
        const text = input.value;
        
        switch(key) {
            case '↑':
                this.toggleShift();
                break;
                
            case '⌫':
                if (cursorPos > 0) {
                    input.value = text.substring(0, cursorPos - 1) + text.substring(cursorPos);
                    input.selectionStart = input.selectionEnd = cursorPos - 1;
                }
                break;
                
            case 'space':
                this.insertAtCursor(' ');
                break;
                
            case 'return':
                if (this.sendBtn && !this.sendBtn.disabled) {
                    this.sendBtn.click();
                } else {
                    this.insertAtCursor('\n');
                }
                break;
                
            case '123':
                this.currentLayout = 'numbers';
                this.renderKeyboard();
                break;
                
            case 'ABC':
                this.currentLayout = 'letters';
                this.renderKeyboard();
                break;
                
            case '#+=':
                this.currentLayout = 'symbols';
                this.renderKeyboard();
                break;
                
            case '🌐':
                this.toggleLanguage();
                break;
                
            default:
                this.insertAtCursor(this.getKeyDisplay(key));
                
                // Auto-disable shift after typing a letter
                if (this.isShift && !this.isCaps && key.match(/[a-z]/)) {
                    this.isShift = false;
                    this.renderKeyboard();
                }
        }
        
        // Trigger input event
        input.dispatchEvent(new Event('input', { bubbles: true }));
        
        // Haptic feedback on mobile
        if ('vibrate' in navigator) {
            navigator.vibrate(10);
        }
    }
    
    insertAtCursor(text) {
        const input = this.textarea;
        const cursorPos = input.selectionStart;
        const currentText = input.value;
        
        input.value = currentText.substring(0, cursorPos) + 
                      text + 
                      currentText.substring(cursorPos);
        
        input.selectionStart = input.selectionEnd = cursorPos + text.length;
        input.focus();
    }
    
    toggleShift() {
        if (this.isCaps) {
            this.isCaps = false;
            this.isShift = false;
        } else if (this.isShift) {
            this.isShift = false;
            this.isCaps = true;
        } else {
            this.isShift = true;
        }
        this.renderKeyboard();
    }
    
    updateShiftKey() {
        const shiftKey = this.keyboardContainer.querySelector('.key[data-key="↑"]');
        if (shiftKey) {
            shiftKey.classList.toggle('active', this.isShift || this.isCaps);
        }
    }
    
    toggleLanguage() {
        // In a real app, this would cycle through languages
        const globeKey = this.keyboardContainer.querySelector('.key[data-key="🌐"]');
        if (globeKey) {
            globeKey.classList.add('key-pressed');
            setTimeout(() => globeKey.classList.remove('key-pressed'), 200);
        }
        
        // Show language selector (simplified)
        alert('Language switching would be implemented here');
    }
    
    showEmojiPicker() {
        // Simple emoji picker for demo
        const emojis = ['😀', '😂', '😍', '😎', '🤔', '👍', '❤️', '🔥', '🎉', '✨'];
        const picker = document.createElement('div');
        picker.className = 'emoji-picker';
        
        emojis.forEach(emoji => {
            const btn = document.createElement('button');
            btn.className = 'emoji-btn';
            btn.textContent = emoji;
            btn.addEventListener('click', () => {
                this.insertAtCursor(emoji);
                picker.remove();
            });
            picker.appendChild(btn);
        });
        
        // Position near the emoji button
        const emojiBtn = this.keyboardContainer.querySelector('.emoji-btn');
        picker.style.position = 'absolute';
        picker.style.bottom = 'calc(100% + 10px)';
        picker.style.left = '10px';
        picker.style.zIndex = '10000';
        
        this.keyboardContainer.appendChild(picker);
        
        // Close on outside click
        setTimeout(() => {
            const closePicker = (e) => {
                if (!picker.contains(e.target) && !emojiBtn.contains(e.target)) {
                    picker.remove();
                    document.removeEventListener('click', closePicker);
                }
            };
            document.addEventListener('click', closePicker);
        }, 0);
    }
    
    startDictation() {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            const recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            
            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                this.insertAtCursor(transcript + ' ');
            };
            
            recognition.start();
            
            // Visual feedback
            const dictationBtn = this.keyboardContainer.querySelector('.dictation-btn');
            dictationBtn.classList.add('recording');
            recognition.onend = () => {
                dictationBtn.classList.remove('recording');
            };
        } else {
            alert('Speech recognition not supported in this browser');
        }
    }
    
    showSettings() {
        alert('Keyboard settings would appear here');
    }
    
    show() {
        if (!this.isVisible) {
            this.keyboardContainer.classList.add('visible');
            this.isVisible = true;
            
            // Adjust input container
            const inputContainer = document.querySelector('.input-container');
            if (inputContainer) {
                inputContainer.style.paddingBottom = `${this.keyboardHeight}px`;
            }
            
            // Scroll to bottom of messages
            setTimeout(() => {
                const messagesContainer = document.getElementById('messagesContainer');
                if (messagesContainer) {
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                }
            }, 100);
        }
    }
    
    hide() {
        if (this.isVisible) {
            this.keyboardContainer.classList.remove('visible');
            this.isVisible = false;
            
            // Reset input container
            const inputContainer = document.querySelector('.input-container');
            if (inputContainer) {
                inputContainer.style.paddingBottom = '';
            }
            
            // Blur the textarea
            this.textarea.blur();
        }
    }
    
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }
    
    setupEventListeners() {
        // Prevent default keyboard
        this.textarea.addEventListener('focus', (e) => {
            e.preventDefault();
            this.show();
            return false;
        });
        
        this.textarea.addEventListener('click', (e) => {
            e.preventDefault();
            this.show();
            return false;
        });
        
        // Click outside to hide
        document.addEventListener('click', (e) => {
            if (this.isVisible && 
                !this.keyboardContainer.contains(e.target) && 
                e.target !== this.textarea) {
                this.hide();
            }
        });
        
        // Escape key to hide
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                e.preventDefault();
                this.hide();
            }
        });
        
        // Send button state
        this.textarea.addEventListener('input', () => {
            if (this.sendBtn) {
                this.sendBtn.disabled = !this.textarea.value.trim();
            }
        });
    }
    
    setupInputFocus() {
        // Make textarea not focusable by regular taps
        this.textarea.setAttribute('readonly', 'readonly');
        this.textarea.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.show();
        });
    }
    
    updateKeyboardTheme() {
        if (this.isDarkMode) {
            this.keyboardContainer.classList.add('dark');
            this.keyboardContainer.classList.remove('light');
        } else {
            this.keyboardContainer.classList.add('light');
            this.keyboardContainer.classList.remove('dark');
        }
    }
    
    destroy() {
        if (this.keyboardContainer && this.keyboardContainer.parentNode) {
            this.keyboardContainer.parentNode.removeChild(this.keyboardContainer);
        }
    }
}

// Initialize keyboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.iOSKeyboard = new iOSKeyboard();
});