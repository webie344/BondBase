// fix.js - Safe message gap fix
document.addEventListener('DOMContentLoaded', function() {
    // Inject the CSS directly
    const style = document.createElement('style');
    style.textContent = `
        .chat-messages .message {
            margin-top: 0px !important;
            margin-bottom: 0px !important;
        }
        .message.sent + .message.sent,
        .message.received + .message.received {
            margin-top: 2px !important;
        }
        .message.sent + .message.received,
        .message.received + .message.sent {
            margin-top: 15px !important;
        }
    `;
    document.head.appendChild(style);

    // Safe function that only adjusts existing messages without creating new ones
    function safelyFixMessageGaps() {
        const messagesContainer = document.querySelector('.chat-messages');
        if (!messagesContainer) return;

        const messages = messagesContainer.querySelectorAll('.message');
        
        // Only adjust margins, don't create or modify content
        for (let i = 1; i < messages.length; i++) {
            const currentMessage = messages[i];
            const previousMessage = messages[i - 1];
            
            const currentIsSent = currentMessage.classList.contains('sent');
            const previousIsSent = previousMessage.classList.contains('sent');
            
            if (currentIsSent !== previousIsSent) {
                currentMessage.style.marginTop = '15px';
            } else {
                currentMessage.style.marginTop = '2px';
            }
        }
    }

    // Only observe, don't interfere with message creation
    const observer = new MutationObserver(function(mutations) {
        let needsFix = false;
        
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                needsFix = true;
            }
        });
        
        if (needsFix) {
            setTimeout(safelyFixMessageGaps, 100);
        }
    });

    const chatMessages = document.querySelector('.chat-messages');
    if (chatMessages) {
        observer.observe(chatMessages, {
            childList: true,
            subtree: false
        });
    }

    // Initial fix
    setTimeout(safelyFixMessageGaps, 500);
});