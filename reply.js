// Use the EXACT same Firebase configuration from your app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, 
    collection,
    doc, 
    updateDoc,
    getDocs,
    addDoc,
    serverTimestamp,
    onSnapshot,
    orderBy,
    limit,
    query
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Your exact Firebase config from app.js
const firebaseConfig = {
    apiKey: "AIzaSyC9uL_BX14Z6rRpgG4MT9Tca1opJl8EviQ",
    authDomain: "dating-connect.firebaseapp.com",
    projectId: "dating-connect",
    storageBucket: "dating-connect.appspot.com",
    messagingSenderId: "1062172180210",
    appId: "1:1062172180210:web:0c9b3c1578a5dbae58da6b"
};

// Initialize Firebase exactly like in your app.js
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

class AIReplyManager {
    constructor() {
        this.aiProfiles = new Set();
        this.activeConversations = new Map();
        this.isInitialized = false;
        
        // Massive realistic response library - sounds completely human
        this.responseTemplates = {
            // Casual greetings
            greeting: [
                "Hey! How's your day going?",
                "Hi there! Nice to meet you 😊",
                "Hello! What's new with you?",
                "Hey! Great to connect with you",
                "Hi! I was just checking my messages",
                "Hey there! How's everything?",
                "Hi! Hope you're having a good day",
                "Hello! What's on your mind?",
                "Hey! I like your profile",
                "Hi! Ready to chat?",
                "Hey! How's your week going?",
                "Hi! Beautiful day, isn't it?",
                "Hey! Just got off work, how about you?",
                "Hi! I've been meaning to message you",
                "Hey! What are you up to?"
            ],
            
            // How are you responses
            howAreYou: [
                "I'm good thanks! Just taking it easy today. You?",
                "Doing well! Can't complain. How about yourself?",
                "Pretty good! Just finished some errands. How are you?",
                "I'm great! Actually having a really nice day. You?",
                "Doing okay! A bit tired but good. How are you feeling?",
                "I'm well! Just enjoying the quiet moment. How's your day?",
                "Good thanks! Been pretty busy but can't complain. You?",
                "I'm fine! Just relaxing now. How about you?",
                "Doing pretty good! Weather's nice today. How are you?",
                "I'm alright! Could use some coffee though 😄 How are you?"
            ],
            
            // Asking about them
            askAboutThem: [
                "So what do you do for fun?",
                "What kind of things make you happy?",
                "Tell me something interesting about yourself",
                "What's your favorite way to spend a weekend?",
                "What are you passionate about?",
                "What's the best thing that happened to you recently?",
                "What do you look for in people you connect with?",
                "What's your idea of a perfect day?",
                "What kind of music are you into?",
                "Do you have any hobbies you're really into?",
                "What's something you're really good at?",
                "If you could travel anywhere, where would you go?",
                "What's your favorite way to relax?",
                "What are you most proud of?",
                "What makes you laugh the most?"
            ],
            
            // Sharing about self naturally
            shareAboutSelf: [
                "I'm pretty easygoing, love good conversations",
                "I enjoy meeting new people and hearing their stories",
                "I'm the type who loves trying new things",
                "I think life's about making genuine connections",
                "I value honesty and real conversations",
                "I believe the best relationships start as friendships",
                "I'm always up for an adventure",
                "I think laughter is super important",
                "I'm pretty open-minded about most things",
                "I enjoy simple pleasures like good coffee",
                "I think everyone has something interesting to share",
                "I'm learning to be more present in conversations",
                "I appreciate people who are comfortable being themselves",
                "I think vulnerability is actually a strength",
                "I'm trying to be better at listening these days"
            ],
            
            // Compliments that don't sound scripted
            compliment: [
                "You seem really down to earth",
                "I like your vibe already",
                "You seem like a genuine person",
                "I appreciate your honesty",
                "You're really easy to talk to",
                "I like your perspective on things",
                "You seem comfortable in your own skin",
                "You have a good sense of humor",
                "I like how open you are",
                "You seem really thoughtful",
                "You're making this conversation easy",
                "I like your energy",
                "You ask good questions",
                "You seem really authentic",
                "I appreciate how real you are"
            ],
            
            // Natural flirty responses
            flirty: [
                "I have a good feeling about this conversation",
                "You're making me smile over here",
                "I think we might get along pretty well",
                "You're pretty cool, you know that?",
                "I'm enjoying talking with you",
                "You have a way with words",
                "I think there might be some chemistry here",
                "You're definitely interesting",
                "I feel comfortable talking with you",
                "You're making this app worth it",
                "I have a feeling we'd get along in person",
                "You're quite charming",
                "I think we might click",
                "You're making my day better",
                "I could get used to this"
            ],
            
            // Deep but natural
            deep: [
                "What matters most to you in relationships?",
                "How do you know when you've found a real connection?",
                "What's something you've learned about yourself lately?",
                "What does being authentic mean to you?",
                "How do you stay true to yourself?",
                "What's the most important lesson life taught you?",
                "What makes a relationship meaningful for you?",
                "How do you balance opening up and protecting yourself?",
                "What qualities do you value most in people?",
                "What does happiness look like for you?"
            ],
            
            // Funny and casual
            funny: [
                "If we were characters in a movie, what would we be?",
                "I think we're pretty good at this chatting thing",
                "Are you always this easy to talk to?",
                "I think we should win an award for best conversation",
                "What would our theme song be?",
                "I think we're nailing this whole messaging thing",
                "Do you believe in love at first message? 😄",
                "I think the app knew what it was doing with us",
                "We might be too compatible for this app",
                "I think we just broke the conversation scale"
            ],
            
            // Agreement that sounds natural
            agreement: [
                "I feel the same way",
                "That's exactly how I see it",
                "You took the words right out of my mouth",
                "I was just thinking something similar",
                "That's so true",
                "I completely agree",
                "That's my thinking too",
                "We're on the same page",
                "That's what I think as well",
                "You're speaking my language"
            ],
            
            // Supportive but casual
            encouraging: [
                "That's really brave of you to share",
                "I respect how you're handling that",
                "That takes courage, good for you",
                "You're stronger than you think",
                "I believe in you",
                "You've got this",
                "I'm proud of you for sharing that",
                "You're doing great",
                "That's really admirable",
                "You're handling that really well"
            ],
            
            // Conversation continuers
            general: [
                "That's really interesting, tell me more",
                "I'd love to hear more about that",
                "That sounds cool, what was that like?",
                "How did you get into that?",
                "What inspired you to do that?",
                "What did you learn from that experience?",
                "I'm curious to know more",
                "How long have you been doing that?",
                "What was your favorite part?",
                "How did you manage that?"
            ],
            
            // Very natural default responses
            default: [
                "That's really cool",
                "Thanks for sharing that",
                "That's interesting",
                "I appreciate you telling me",
                "That's good to know",
                "I see what you mean",
                "That makes sense",
                "I get where you're coming from",
                "That's thoughtful of you",
                "I'm glad you shared that"
            ],
            
            // Everyday casual responses
            casual: [
                "No way! That's awesome",
                "Oh wow, really?",
                "That's so cool!",
                "I love that for you",
                "That sounds amazing",
                "You're kidding!",
                "That's incredible",
                "I'm so happy for you",
                "That's wild!",
                "That's so interesting",
                "Tell me everything",
                "I need details!",
                "That's honestly so cool",
                "You're amazing for that",
                "That's seriously impressive"
            ],
            
            // Relatable life responses
            relatable: [
                "I know exactly what you mean",
                "I've been there too",
                "That's so relatable",
                "I feel that completely",
                "Same thing happened to me",
                "I totally understand that",
                "That's my experience too",
                "I get that 100%",
                "That's exactly how I feel",
                "We're in the same boat"
            ],
            
            // Curious follow-ups
            curious: [
                "What made you think of that?",
                "How did that make you feel?",
                "What happened next?",
                "What was that experience like?",
                "How did you react to that?",
                "What did you learn from that?",
                "What would you do differently?",
                "How has that changed you?",
                "What does that mean to you?",
                "What are your thoughts on that now?"
            ],
            
            // Playful responses
            playful: [
                "You're trouble, aren't you? 😏",
                "I like where this is going",
                "You're fun to talk to",
                "This is getting interesting",
                "You're keeping me on my toes",
                "I like your style",
                "You're definitely not boring",
                "This conversation is taking a fun turn",
                "You're making this entertaining",
                "I'm enjoying this way too much"
            ],
            
            // Emotional responses
            emotional: [
                "That actually means a lot",
                "I really appreciate you saying that",
                "That's really sweet of you",
                "You have no idea how much that means",
                "That made my day",
                "I needed to hear that today",
                "That's really kind of you",
                "You're making me emotional",
                "That's so thoughtful",
                "I won't forget you said that"
            ],
            
            // Future-oriented
            future: [
                "I'd love to hear more about that sometime",
                "We should definitely talk about that more",
                "I'm looking forward to continuing this conversation",
                "I have a feeling we'll have more to talk about",
                "I'm excited to see where this goes",
                "I think we have more to discover about each other",
                "I'm curious what else we have in common",
                "I feel like we're just getting started",
                "I'm enjoying learning about you",
                "I think this could be the beginning of something"
            ]
        };
    }

    async initialize() {
        if (this.isInitialized) return;
        
        try {
            await this.markExistingProfilesAsAI();
            await this.setupConversationListeners();
            this.isInitialized = true;
        } catch (error) {
            // Silent fail
        }
    }

    async markExistingProfilesAsAI() {
        try {
            const usersRef = collection(db, 'users');
            const usersSnapshot = await getDocs(usersRef);
            
            const now = new Date();
            const cutoffTime = new Date(now.getTime() - (5 * 60 * 1000));
            
            for (const userDoc of usersSnapshot.docs) {
                const userId = userDoc.id;
                const userData = userDoc.data();
                
                const createdAt = userData.createdAt?.toDate ? userData.createdAt.toDate() : new Date();
                
                if (createdAt < cutoffTime && !userData.isAI) {
                    await updateDoc(doc(db, 'users', userId), {
                        isAI: true,
                        isDefaultProfile: true,
                        updatedAt: serverTimestamp()
                    });
                    
                    this.aiProfiles.add(userId);
                } else if (userData.isAI) {
                    this.aiProfiles.add(userId);
                }
            }
            
        } catch (error) {
            // Silent fail
        }
    }

    async setupConversationListeners() {
        try {
            const conversationsRef = collection(db, 'conversations');
            
            onSnapshot(conversationsRef, (snapshot) => {
                snapshot.docChanges().forEach(async (change) => {
                    if (change.type === 'added' || change.type === 'modified') {
                        await this.handleConversationUpdate(change.doc.id, change.doc.data());
                    }
                });
            });
            
        } catch (error) {
            // Silent fail
        }
    }

    async handleConversationUpdate(conversationId, conversationData) {
        try {
            const participants = conversationData.participants || [];
            const aiParticipants = participants.filter(id => this.aiProfiles.has(id));
            
            if (aiParticipants.length === 0) return;
            if (this.activeConversations.has(conversationId)) return;
            
            await this.setupMessageListener(conversationId, participants, aiParticipants);
            
        } catch (error) {
            // Silent fail
        }
    }

    async setupMessageListener(conversationId, allParticipants, aiParticipants) {
        try {
            const messagesRef = collection(db, 'conversations', conversationId, 'messages');
            const messagesQuery = query(messagesRef, orderBy('timestamp', 'desc'), limit(1));
            
            const unsubscribe = onSnapshot(messagesQuery, async (snapshot) => {
                if (!snapshot.empty) {
                    const latestMessage = snapshot.docs[0].data();
                    const messageId = snapshot.docs[0].id;
                    
                    if (this.isDuplicateMessage(conversationId, messageId)) return;
                    
                    await this.processMessage(conversationId, allParticipants, aiParticipants, latestMessage);
                }
            });
            
            this.activeConversations.set(conversationId, unsubscribe);
            
        } catch (error) {
            // Silent fail
        }
    }

    isDuplicateMessage(conversationId, messageId) {
        const key = `${conversationId}_${messageId}`;
        if (this.activeConversations.has(key)) return true;
        
        this.activeConversations.set(key, true);
        setTimeout(() => this.activeConversations.delete(key), 30000);
        return false;
    }

    async processMessage(conversationId, allParticipants, aiParticipants, message) {
        try {
            if (message.isAIReply) return;
            
            const senderId = message.senderId;
            const messageText = message.text || '';
            
            const replierId = this.selectReplier(allParticipants, aiParticipants, senderId);
            if (!replierId) return;
            
            await this.sendAIReply(conversationId, replierId, senderId, messageText);
            
        } catch (error) {
            // Silent fail
        }
    }

    selectReplier(allParticipants, aiParticipants, senderId) {
        if (!this.aiProfiles.has(senderId)) {
            return aiParticipants[Math.floor(Math.random() * aiParticipants.length)];
        }
        
        const otherAIs = aiParticipants.filter(aiId => aiId !== senderId);
        if (otherAIs.length > 0) {
            return otherAIs[Math.floor(Math.random() * otherAIs.length)];
        }
        
        return null;
    }

    async sendAIReply(conversationId, replierId, originalSenderId, originalMessage) {
        try {
            const delay = Math.random() * 5000 + 3000;
            
            setTimeout(async () => {
                try {
                    const replyText = this.generateSmartReply(originalMessage);
                    
                    const messageData = {
                        senderId: replierId,
                        text: replyText,
                        read: false,
                        timestamp: serverTimestamp(),
                        isAIReply: true
                    };
                    
                    await addDoc(collection(db, 'conversations', conversationId, 'messages'), messageData);
                    
                    await updateDoc(doc(db, 'conversations', conversationId), {
                        lastMessage: {
                            text: replyText,
                            senderId: replierId,
                            timestamp: serverTimestamp()
                        },
                        updatedAt: serverTimestamp()
                    });
                    
                } catch (error) {
                    // Silent fail
                }
            }, delay);
            
        } catch (error) {
            // Silent fail
        }
    }

    generateSmartReply(messageText) {
        const text = messageText.toLowerCase().trim();
        const wordCount = text.split(/\s+/).length;
        
        if (text.match(/\b(hello|hi|hey|hola|what's up|sup|yo|greetings)\b/) && wordCount < 5) {
            return this.getRandomResponse('greeting');
        }
        
        if (text.match(/\b(how are you|how're you|how you doing|how do you do|how's it going)\b/)) {
            return this.getRandomResponse('howAreYou');
        }
        
        if (text.match(/\b(beautiful|handsome|cute|pretty|gorgeous|attractive|nice|awesome|cool|amazing|great|sexy|hot)\b/)) {
            return this.getRandomResponse('compliment');
        }
        
        if (text.match(/\b(love you|like you|miss you|thinking of you|care about you)\b/)) {
            return this.getRandomResponse('flirty');
        }
        
        if (text.includes('?')) {
            if (text.match(/\b(what|why|how|when|where|who)\b/)) {
                return this.getRandomResponse('askAboutThem');
            }
            return this.getRandomResponse('question');
        }
        
        if (wordCount > 15) {
            const responses = [
                ...this.responseTemplates.deep,
                ...this.responseTemplates.encouraging,
                ...this.responseTemplates.general
            ];
            return responses[Math.floor(Math.random() * responses.length)];
        }
        
        if (wordCount < 4) {
            return this.getRandomResponse('casual');
        }
        
        // Mix different response types for variety
        const allResponses = [
            ...this.responseTemplates.agreement,
            ...this.responseTemplates.shareAboutSelf,
            ...this.responseTemplates.askAboutThem,
            ...this.responseTemplates.general,
            ...this.responseTemplates.relatable,
            ...this.responseTemplates.curious,
            ...this.responseTemplates.playful,
            ...this.responseTemplates.emotional,
            ...this.responseTemplates.future
        ];
        return allResponses[Math.floor(Math.random() * allResponses.length)];
    }

    getRandomResponse(category) {
        const responses = this.responseTemplates[category] || this.responseTemplates.default;
        return responses[Math.floor(Math.random() * responses.length)];
    }

    isAIUser(userId) {
        return this.aiProfiles.has(userId);
    }

    getAIProfiles() {
        return Array.from(this.aiProfiles);
    }

    cleanup() {
        this.activeConversations.forEach(unsubscribe => unsubscribe());
        this.activeConversations.clear();
        this.isInitialized = false;
    }
}

// Create global instance
const aiReplyManager = new AIReplyManager();

// Export for use in other files
export { aiReplyManager };

// Auto-initialize
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        aiReplyManager.initialize();
    }, 3000);
});