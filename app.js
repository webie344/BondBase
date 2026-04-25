/* =============================================================
   Drop — One prompt. One photo. Once a day.
   -------------------------------------------------------------
   SETUP
   1. Create a Firebase project at console.firebase.google.com
      - Enable Email/Password sign-in (Authentication > Sign-in method)
      - Create a Firestore database (Firestore Database > Create database)
   2. Paste your Firebase web config below (CONFIG.firebase).
   3. Create a Cloudinary account (free tier is fine):
      - Settings > Upload > add an unsigned upload preset
      - Paste your cloud name + preset name below (CONFIG.cloudinary).
   4. (Optional) For push notifications:
      - Create a OneSignal account, paste app id below.
      - Make sure push-notifications.js sits next to this file.
   5. Open index.html in a browser. Sign up. Then in the browser
      console run:  window.seedPrompts()
      to populate 30 days of prompts.
   ============================================================= */

const CONFIG = {
    firebase: {
        apiKey: "AIzaSyC9jF-ocy6HjsVzWVVlAyXW-4aIFgA79-A",
    authDomain: "crypto-6517d.firebaseapp.com",
    projectId: "crypto-6517d",
    storageBucket: "crypto-6517d.firebasestorage.app",
    messagingSenderId: "60263975159",
    appId: "1:60263975159:web:bd53dcaad86d6ed9592bf2"
},
    cloudinary: {
        cloudName: "ddtdqrh1b",
        uploadPreset: "profile-pictures"
    },
    onesignal: {
        appId: ""    // optional; leave empty to disable push
    }
};

/* =============================================================
   IMPORTS — Firebase v10 modular SDK from gstatic CDN
   ============================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail,
    deleteUser
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    getFirestore,
    collection,
    doc,
    setDoc,
    getDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    getDocs,
    addDoc,
    serverTimestamp,
    onSnapshot,
    orderBy,
    limit,
    arrayUnion,
    arrayRemove,
    increment,
    deleteField,
    writeBatch
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* =============================================================
   FIREBASE INIT
   ============================================================= */

const fbApp = initializeApp(CONFIG.firebase);
const auth = getAuth(fbApp);
const db = getFirestore(fbApp);

/* =============================================================
   30 UNIVERSAL PROMPTS (seeded into Firestore once)
   ============================================================= */

const PROMPTS = [
    "Show your view right now.",
    "What's on your screen?",
    "Your shoes today.",
    "Where you had lunch.",
    "Today's commute.",
    "Your desk right now.",
    "What you're listening to.",
    "Your hands right now.",
    "First thing you ate today.",
    "Show your bag.",
    "Your morning sky.",
    "What you're reading.",
    "Tonight's dinner.",
    "Your favorite mug.",
    "The view from your window.",
    "Where you're sitting.",
    "What's in your pocket.",
    "Today's outfit.",
    "Your watch / wrist.",
    "The last photo you took.",
    "Where you parked.",
    "Your evening light.",
    "Today's small win.",
    "What you're working on.",
    "What's nearby.",
    "Today's weather, your version.",
    "The corner of your room.",
    "Your reflection right now.",
    "Something you made today.",
    "What surprised you today."
];

/* =============================================================
   HELPERS — DOM, time, formatting
   ============================================================= */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function todayKey(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function yesterdayKey() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return todayKey(d);
}

function formatDateLong(d = new Date()) {
    return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

function formatTimeAgo(date) {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);
}

function initials(name) {
    if (!name) return "?";
    return name.trim().split(/\s+/).map(p => p[0]).slice(0, 2).join("").toUpperCase();
}

function showToast(msg, type = "default") {
    const el = document.createElement("div");
    el.className = `toast toast-${type}`;
    el.textContent = msg;
    $("#toast-container").appendChild(el);
    setTimeout(() => {
        el.style.transition = "opacity 240ms, transform 240ms";
        el.style.opacity = "0";
        el.style.transform = "translateY(8px)";
        setTimeout(() => el.remove(), 260);
    }, 2600);
}

function confirmDialog(title, message, okText = "Confirm") {
    return new Promise((resolve) => {
        $("#confirm-title").textContent = title;
        $("#confirm-message").textContent = message;
        $("#confirm-ok").textContent = okText;
        $("#confirm-dialog").hidden = false;
        const cleanup = () => {
            $("#confirm-dialog").hidden = true;
            $("#confirm-ok").onclick = null;
            $("#confirm-cancel").onclick = null;
        };
        $("#confirm-ok").onclick = () => { cleanup(); resolve(true); };
        $("#confirm-cancel").onclick = () => { cleanup(); resolve(false); };
    });
}

/* =============================================================
   STATE
   ============================================================= */

const state = {
    user: null,           // Firebase auth user
    profile: null,        // users/{uid} doc
    todayPrompt: null,    // { date, text }
    countdownInterval: null,
    feedUnsub: null,
    pushReady: false,

    // ----- social state -----
    feedTab: "friends",                // "friends" | "all"
    feedDocs: [],                      // last snapshot of today's posts (raw docs)
    friends: new Map(),                // friendUid -> { username, displayName }
    friendsUnsub: null,
    requestsIn: new Map(),             // requesterUid -> { username, displayName, requestedAt }
    requestsInUnsub: null,
    requestsOut: new Map(),            // recipientUid -> { username, displayName, requestedAt }
    requestsOutUnsub: null,

    // ----- chat state -----
    chatThreads: new Map(),            // chatId -> { otherUid, otherUsername, lastMessage, updatedAt, unreadCount }
    chatThreadsUnsub: null,
    threadUnsub: null,
    threadOtherUid: null,

    // ----- comments state -----
    commentsUnsub: null,
    commentsPostId: null,
    repliesUnsubs: new Map(),          // commentId -> unsub for that comment's replies feed

    // ----- notifications state -----
    notificationsUnsub: null,
    notifications: []                  // array of doc snapshots
};

const REACTIONS = [
    { key: "fire",  emoji: "🔥" },
    { key: "love",  emoji: "❤️" },
    { key: "lol",   emoji: "😂" },
    { key: "wow",   emoji: "😮" },
    { key: "clap",  emoji: "👏" }
];
const REACTION_BY_KEY = Object.fromEntries(REACTIONS.map(r => [r.key, r.emoji]));

/* =============================================================
   PROMPT WINDOW LOGIC
   ============================================================= */

function getPromptTimeMinutes() {
    const t = state.profile?.promptTimeLocal || "19:00";
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
}

function nowMinutes() {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
}

function getWindowState() {
    const promptMin = getPromptTimeMinutes();
    const nowMin = nowMinutes();
    const minsUntilOpen = promptMin - nowMin;
    const ON_TIME_WINDOW_MIN = 4; // first 4 min after open = "on time"

    if (minsUntilOpen > 0) {
        return { phase: "before", secondsUntil: minsUntilOpen * 60 - new Date().getSeconds() };
    } else if (minsUntilOpen <= 0 && minsUntilOpen > -ON_TIME_WINDOW_MIN) {
        const secondsLeft = (-minsUntilOpen + ON_TIME_WINDOW_MIN) * 60 - new Date().getSeconds();
        return { phase: "open", secondsLeft };
    } else {
        return { phase: "late" };
    }
}

function isPostOnTime(postedAt, promptDate) {
    const promptMin = getPromptTimeMinutes();
    const posted = postedAt instanceof Date ? postedAt : postedAt.toDate?.() || new Date(postedAt);
    const promptOpen = new Date(`${promptDate}T00:00:00`);
    promptOpen.setMinutes(promptMin);
    const diffMin = (posted - promptOpen) / 60000;
    return diffMin >= -1 && diffMin <= 4;
}

function formatCountdown(seconds) {
    if (seconds <= 0) return "0s";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
    return `${s}s`;
}

/* =============================================================
   AUTH FLOW
   ============================================================= */

onAuthStateChanged(auth, async (user) => {
    if (user) {
        state.user = user;
        const profileSnap = await getDoc(doc(db, "users", user.uid));
        if (profileSnap.exists()) {
            state.profile = { uid: user.uid, ...profileSnap.data() };
            // Init push if available + enabled
            if (CONFIG.onesignal.appId && state.profile.pushEnabled !== false) {
                initPushFor(user.uid).catch(() => {});
            }
            // Start social subscriptions (friends, requests, chat threads)
            startSocialSubscriptions(user.uid);
            // Start notifications subscription
            subscribeToNotifications(user.uid);
            // First time? No username yet → onboarding.
            if (!state.profile.username && !location.hash.startsWith("#/onboarding")) {
                location.hash = "#/onboarding";
            } else if (location.hash === "" || location.hash === "#" || location.hash.startsWith("#/login") || location.hash.startsWith("#/signup")) {
                location.hash = "#/";
            } else {
                router();
            }
        } else {
            // Auth exists but no profile doc — create skeleton + push to onboarding
            await setDoc(doc(db, "users", user.uid), {
                email: user.email,
                createdAt: serverTimestamp(),
                currentStreak: 0,
                longestStreak: 0,
                totalDrops: 0,
                promptTimeLocal: "19:00",
                pushEnabled: false
            });
            location.hash = "#/onboarding";
        }
    } else {
        state.user = null;
        state.profile = null;
        stopSocialSubscriptions();
        if (state.feedUnsub) { state.feedUnsub(); state.feedUnsub = null; }
        if (state.commentsUnsub) { state.commentsUnsub(); state.commentsUnsub = null; }
        if (state.threadUnsub) { state.threadUnsub(); state.threadUnsub = null; }
        if (state.notificationsUnsub) { state.notificationsUnsub(); state.notificationsUnsub = null; }
        state.repliesUnsubs.forEach(u => u()); state.repliesUnsubs.clear();
        if (!["#/login", "#/signup"].some(h => location.hash.startsWith(h))) {
            location.hash = "#/login";
        } else {
            router();
        }
    }
});

async function handleSignup(e) {
    e.preventDefault();
    const name = $("#signup-name").value.trim();
    const email = $("#signup-email").value.trim();
    const password = $("#signup-password").value;
    const errEl = $("#signup-error");
    errEl.hidden = true;
    try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "users", cred.user.uid), {
            email,
            displayName: name,
            createdAt: serverTimestamp(),
            currentStreak: 0,
            longestStreak: 0,
            totalDrops: 0,
            promptTimeLocal: "19:00",
            pushEnabled: false
        });
    } catch (err) {
        errEl.textContent = friendlyAuthError(err);
        errEl.hidden = false;
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const email = $("#login-email").value.trim();
    const password = $("#login-password").value;
    const errEl = $("#login-error");
    errEl.hidden = true;
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
        errEl.textContent = friendlyAuthError(err);
        errEl.hidden = false;
    }
}

async function handleForgot() {
    const email = $("#login-email").value.trim();
    if (!email) { showToast("Enter your email above first."); return; }
    try {
        await sendPasswordResetEmail(auth, email);
        showToast("Reset link sent. Check your inbox.", "success");
    } catch (err) {
        showToast(friendlyAuthError(err), "error");
    }
}

async function handleSignout() {
    try {
        if (window.PushNotifications?.logoutUser) await window.PushNotifications.logoutUser();
        await signOut(auth);
    } catch (err) {
        showToast("Sign out failed.", "error");
    }
}

async function handleDeleteAccount() {
    const ok = await confirmDialog(
        "Delete your account?",
        "All your drops, streaks and profile will be permanently removed. This cannot be undone.",
        "Delete forever"
    );
    if (!ok) return;
    try {
        await deleteDoc(doc(db, "users", state.user.uid));
        await deleteUser(state.user);
        showToast("Account deleted.", "success");
    } catch (err) {
        showToast("Could not delete account. You may need to sign in again first.", "error");
    }
}

function friendlyAuthError(err) {
    const code = err?.code || "";
    if (code.includes("invalid-email")) return "That email doesn't look right.";
    if (code.includes("missing-password") || code.includes("weak-password")) return "Password must be at least 6 characters.";
    if (code.includes("email-already-in-use")) return "That email is already registered. Try signing in.";
    if (code.includes("user-not-found") || code.includes("invalid-credential") || code.includes("wrong-password")) return "Email or password is incorrect.";
    if (code.includes("network")) return "Network error. Check your connection.";
    if (code.includes("too-many-requests")) return "Too many attempts. Try again in a minute.";
    return err?.message || "Something went wrong.";
}

/* =============================================================
   ONBOARDING
   ============================================================= */

let onboardingSlide = 0;

function showOnboardingSlide(n) {
    onboardingSlide = n;
    $$(".onboarding-slide").forEach(el => {
        el.hidden = Number(el.dataset.slide) !== n;
    });
    $$("#onboarding-dots .dot").forEach(el => {
        el.classList.toggle("active", Number(el.dataset.dot) === n);
    });
    $("#onboarding-back").hidden = n === 0;
    $("#onboarding-next").hidden = n === 2;
}

function setupOnboardingControls() {
    $("#onboarding-next").onclick = () => showOnboardingSlide(Math.min(2, onboardingSlide + 1));
    $("#onboarding-back").onclick = () => showOnboardingSlide(Math.max(0, onboardingSlide - 1));
    $$("#onboarding-dots .dot").forEach(el => {
        el.onclick = () => showOnboardingSlide(Number(el.dataset.dot));
    });
    $("#onboarding-form").onsubmit = handleOnboardingSubmit;
}

async function handleOnboardingSubmit(e) {
    e.preventDefault();
    const username = $("#onboarding-username").value.trim().toLowerCase();
    const errEl = $("#onboarding-error");
    errEl.hidden = true;
    if (!/^[a-z0-9_]{2,24}$/.test(username)) {
        errEl.textContent = "Pick a username with letters, numbers, or underscores (2–24 chars).";
        errEl.hidden = false;
        return;
    }
    try {
        // Check uniqueness
        const existing = await getDocs(query(collection(db, "users"), where("username", "==", username), limit(1)));
        if (!existing.empty && existing.docs[0].id !== state.user.uid) {
            errEl.textContent = "That username is taken.";
            errEl.hidden = false;
            return;
        }
        await updateDoc(doc(db, "users", state.user.uid), { username });
        state.profile.username = username;
        location.hash = "#/";
    } catch (err) {
        errEl.textContent = "Couldn't save. Try again.";
        errEl.hidden = false;
    }
}

/* =============================================================
   PROMPTS — load today's, seed 30 days
   ============================================================= */

async function loadTodayPrompt() {
    const key = todayKey();
    const snap = await getDoc(doc(db, "prompts", key));
    if (snap.exists()) {
        state.todayPrompt = { date: key, ...snap.data() };
    } else {
        state.todayPrompt = { date: key, text: "Show what's right in front of you." };
    }
    return state.todayPrompt;
}

async function seedPrompts() {
    const today = new Date();
    const batch = [];
    for (let i = 0; i < PROMPTS.length; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        const key = todayKey(d);
        batch.push(setDoc(doc(db, "prompts", key), { date: key, text: PROMPTS[i] }));
    }
    await Promise.all(batch);
    console.log(`Seeded ${PROMPTS.length} prompts starting ${todayKey()}.`);
    showToast(`Seeded ${PROMPTS.length} prompts.`, "success");
}

window.seedPrompts = seedPrompts;

/* =============================================================
   TODAY VIEW
   ============================================================= */

async function renderToday() {
    await loadTodayPrompt();
    $("#today-date").textContent = formatDateLong();
    $("#today-prompt-text").textContent = state.todayPrompt.text;
    const streakNum = $("#today-streak .streak-num");
    if (streakNum) streakNum.textContent = state.profile?.currentStreak || 0;

    // Did the user already post today?
    const posted = await hasPostedToday();
    $("#today-already-posted").hidden = !posted;
    $("#today-action").hidden = posted;

    if (state.countdownInterval) clearInterval(state.countdownInterval);
    state.countdownInterval = setInterval(updateCountdown, 1000);
    updateCountdown();

    $("#today-snap-btn").onclick = () => { location.hash = "#/capture"; };
}

function updateCountdown() {
    const w = getWindowState();
    const cd = $("#today-countdown");
    const label = cd.querySelector(".countdown-label");
    const value = cd.querySelector(".countdown-value");
    const btn = $("#today-snap-btn");
    const hint = $("#today-action-hint");

    if (w.phase === "before") {
        cd.classList.remove("is-open");
        label.textContent = "Opens in";
        value.textContent = formatCountdown(w.secondsUntil);
        btn.disabled = true;
        btn.textContent = "Capture";
        hint.textContent = "Get ready — the prompt opens at your set time.";
    } else if (w.phase === "open") {
        cd.classList.add("is-open");
        label.textContent = "Live now";
        value.textContent = `${formatCountdown(w.secondsLeft)} left`;
        btn.disabled = false;
        btn.textContent = "Capture now";
        hint.textContent = "Post in the next few minutes to be on time.";
    } else {
        cd.classList.remove("is-open");
        label.textContent = "Late entries open";
        value.textContent = "Feed is live";
        btn.disabled = false;
        btn.textContent = "Post late";
        hint.textContent = "You can still post — it'll just be marked late.";
    }
}

async function hasPostedToday() {
    if (!state.user) return false;
    const q = query(
        collection(db, "posts"),
        where("uid", "==", state.user.uid),
        where("promptDate", "==", todayKey()),
        limit(1)
    );
    const snap = await getDocs(q);
    return !snap.empty;
}

/* =============================================================
   FEED VIEW
   ============================================================= */

function renderFeed() {
    const promptText = state.todayPrompt?.text || "Today";
    $("#feed-prompt-text").textContent = promptText;

    const grid = $("#feed-grid");
    grid.innerHTML = "";
    $("#feed-empty").hidden = true;

    if (state.feedUnsub) state.feedUnsub();

    // Single where() — no composite index needed. Sort client-side below.
    const q = query(
        collection(db, "posts"),
        where("promptDate", "==", todayKey())
    );

    state.feedUnsub = onSnapshot(q, (snap) => {
        state.feedDocs = snap.docs;
        applyFeedRender();
    }, (err) => {
        console.error("Feed listener error:", err);
        $("#feed-empty").hidden = false;
        $("#feed-empty").innerHTML = `<h3>Couldn't load feed</h3><p class="muted">${escapeHtml(err.message)}</p>`;
    });
}

// Re-renders the feed grid based on current feedTab + cached feedDocs.
function applyFeedRender() {
    const grid = $("#feed-grid");
    if (!grid) return;

    let docs = [...state.feedDocs];

    if (state.feedTab === "friends") {
        const allowed = new Set([state.user.uid, ...state.friends.keys()]);
        docs = docs.filter(d => allowed.has(d.data().uid));
    }

    docs = docs.sort((a, b) => {
        const ta = a.data().createdAt?.toMillis?.() || 0;
        const tb = b.data().createdAt?.toMillis?.() || 0;
        return tb - ta;
    }).slice(0, 120);

    if (docs.length === 0) {
        $("#feed-empty").hidden = false;
        const empty = $("#feed-empty");
        if (state.feedTab === "friends") {
            empty.innerHTML = `<h3>No friend drops yet</h3><p class="muted">Add friends or switch to Everyone.</p>`;
        } else {
            empty.innerHTML = `<h3>No drops yet today</h3><p class="muted">Be the first to drop.</p>`;
        }
        $("#feed-count").textContent = "0 drops";
        grid.innerHTML = "";
        return;
    }

    $("#feed-empty").hidden = true;
    $("#feed-count").textContent = `${docs.length} drop${docs.length === 1 ? "" : "s"}`;

    grid.innerHTML = docs.map(d => renderPostCardHTML(d.id, d.data())).join("");
    wirePostCards(grid);
}

function renderPostCardHTML(postId, p) {
    const onTime = p.isOnTime;
    const userLiked = (p.likedBy || []).includes(state.user.uid);
    const likes = p.likes || 0;
    const comments = p.commentsCount || 0;
    const initial = (p.username || "?").charAt(0).toUpperCase();
    const timeAgo = p.createdAt?.toMillis ? relativeTime(p.createdAt.toMillis()) : "";
    const images = (p.images && p.images.length) ? p.images : [p.imageUrl];
    const isCarousel = images.length > 1;
    const myReaction = (p.userReactions || {})[state.user.uid] || null;

    const imageHtml = isCarousel
        ? `<div class="post-image-wrap carousel" data-action="open">
                <div class="post-image-track">
                    ${images.map(u => `<img class="post-image" src="${escapeHtml(u)}" alt="" loading="lazy" />`).join("")}
                </div>
                <div class="carousel-counter">1/${images.length}</div>
                <div class="carousel-dots">
                    ${images.map((_, i) => `<span class="carousel-dot ${i === 0 ? "active" : ""}"></span>`).join("")}
                </div>
            </div>`
        : `<div class="post-image-wrap" data-action="open">
                <img class="post-image" src="${escapeHtml(p.imageUrl || images[0] || "")}" alt="" loading="lazy" />
            </div>`;

    const reactionsHtml = renderReactionsRowHTML(p, myReaction, postId, /*compact*/ true);

    return `
        <article class="post-card" data-post-id="${postId}">
            <header class="post-header">
                <div class="post-avatar" data-username="${escapeHtml(p.username || "")}">${escapeHtml(initial)}</div>
                <div class="post-header-text">
                    <span class="post-username" data-username="${escapeHtml(p.username || "")}">@${escapeHtml(p.username || "user")}</span>
                    <span class="post-time">${timeAgo}${timeAgo ? " · " : ""}<span class="post-badge ${onTime ? "badge-ontime" : "badge-late"}">${onTime ? "On time" : "Late"}</span></span>
                </div>
            </header>
            ${imageHtml}
            <div class="post-actions">
                <button class="post-action like-btn ${userLiked ? "liked" : ""}" data-action="like" aria-label="Like">
                    <span class="heart">${userLiked ? "♥" : "♡"}</span>
                    <span class="post-action-count">${likes}</span>
                </button>
                <button class="post-action" data-action="comment" aria-label="Comment">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    <span class="post-action-count">${comments}</span>
                </button>
                <button class="post-action" data-action="share" aria-label="Share">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                </button>
            </div>
            ${reactionsHtml}
            ${p.caption ? `<p class="post-caption"><span class="post-caption-author" data-username="${escapeHtml(p.username || "")}">@${escapeHtml(p.username || "user")}</span> ${linkifyText(p.caption)}</p>` : ""}
            ${comments > 0 ? `<button class="post-view-comments" data-action="open">View all ${comments} comment${comments === 1 ? "" : "s"}</button>` : ""}
        </article>`;
}

function renderReactionsRowHTML(p, myReaction, postId, compact) {
    const reactions = p.reactions || {};
    const chips = REACTIONS.map(r => {
        const c = reactions[r.key] || 0;
        if (compact && c === 0 && myReaction !== r.key) return "";
        const active = myReaction === r.key ? "active" : "";
        return `<button class="reaction-chip ${active}" data-reaction="${r.key}" data-post-id="${postId}">
            <span class="emoji">${r.emoji}</span>${c > 0 ? `<span class="count">${c}</span>` : ""}
        </button>`;
    }).filter(Boolean).join("");
    const picker = `<button class="reaction-picker" data-action="reaction-picker" data-post-id="${postId}" aria-label="Add reaction">
        <span style="font-size:16px;line-height:1">😊</span><span style="font-size:18px;line-height:1">+</span>
    </button>`;
    return `<div class="reactions-row">${chips}${picker}</div>`;
}

function wirePostCards(container) {
    container.querySelectorAll(".post-card").forEach(card => {
        const postId = card.dataset.postId;
        // Carousel scroll → update counter + dots
        const track = card.querySelector(".post-image-track");
        if (track) {
            const counter = card.querySelector(".carousel-counter");
            const dots = card.querySelectorAll(".carousel-dot");
            track.addEventListener("scroll", () => {
                const idx = Math.round(track.scrollLeft / track.clientWidth);
                if (counter) counter.textContent = `${idx + 1}/${dots.length}`;
                dots.forEach((d, i) => d.classList.toggle("active", i === idx));
            });
        }
        card.addEventListener("click", async (e) => {
            const target = e.target.closest("[data-action], [data-username], [data-reaction]");
            if (!target) {
                location.hash = `#/post/${postId}`;
                return;
            }
            const action = target.dataset.action;
            const usernameLink = target.dataset.username;
            const reactionKey = target.dataset.reaction;

            if (reactionKey) {
                e.stopPropagation();
                await toggleReaction(postId, reactionKey);
                return;
            }
            if (action === "reaction-picker") {
                e.stopPropagation();
                showReactionPicker(target, postId);
                return;
            }
            if (usernameLink) {
                location.hash = `#/profile/${encodeURIComponent(usernameLink)}`;
                return;
            }
            if (action === "like") {
                await toggleLikeOnPost(postId, target);
                return;
            }
            if (action === "share") {
                location.hash = `#/share/${postId}`;
                return;
            }
            // "open" or "comment" or anywhere else → post detail page
            location.hash = `#/post/${postId}`;
        });
    });
}

async function toggleLikeOnPost(postId, btn) {
    const wasLiked = btn.classList.contains("liked");
    const heart = btn.querySelector(".heart");
    const count = btn.querySelector(".post-action-count");
    btn.classList.toggle("liked", !wasLiked);
    btn.classList.add("pulse");
    setTimeout(() => btn.classList.remove("pulse"), 400);
    if (heart) heart.textContent = wasLiked ? "♡" : "♥";
    const newCount = (Number(count?.textContent) || 0) + (wasLiked ? -1 : 1);
    if (count) count.textContent = Math.max(0, newCount);
    try {
        await updateDoc(doc(db, "posts", postId), {
            likes: increment(wasLiked ? -1 : 1),
            likedBy: wasLiked ? arrayRemove(state.user.uid) : arrayUnion(state.user.uid)
        });
        // Notify owner of like (only on like, not unlike, and not for self)
        if (!wasLiked) {
            const psnap = await getDoc(doc(db, "posts", postId));
            const owner = psnap.data()?.uid;
            if (owner && owner !== state.user.uid) {
                writeNotification(owner, {
                    type: "like",
                    fromUid: state.user.uid,
                    fromUsername: state.profile.username,
                    postId,
                    postThumb: psnap.data()?.imageUrl || ""
                });
            }
        }
    } catch (err) {
        console.warn(err);
        btn.classList.toggle("liked", wasLiked);
        if (heart) heart.textContent = wasLiked ? "♥" : "♡";
        if (count) count.textContent = newCount + (wasLiked ? 1 : -1);
        showToast("Couldn't update like.", "error");
    }
}

/* =============================================================
   REACTIONS
   ============================================================= */

async function toggleReaction(postId, reactionKey) {
    const ref = doc(db, "posts", postId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const p = snap.data();
    const userReactions = p.userReactions || {};
    const reactions = p.reactions || {};
    const previous = userReactions[state.user.uid] || null;

    const updates = {};
    if (previous === reactionKey) {
        // Toggle off
        updates[`reactions.${reactionKey}`] = increment(-1);
        updates[`userReactions.${state.user.uid}`] = deleteField();
    } else {
        if (previous) updates[`reactions.${previous}`] = increment(-1);
        updates[`reactions.${reactionKey}`] = increment(1);
        updates[`userReactions.${state.user.uid}`] = reactionKey;
    }
    try {
        await updateDoc(ref, updates);
        // Refresh feed card in-place (the snapshot listener will repaint)
        // Refresh post detail if open
        if (location.hash === `#/post/${postId}`) renderPost(postId);
    } catch (err) {
        console.warn(err);
        showToast("Couldn't react.", "error");
    }
}

function showReactionPicker(anchorEl, postId) {
    closeReactionPicker();
    const pop = document.createElement("div");
    pop.className = "reaction-pop";
    pop.id = "reaction-pop";
    REACTIONS.forEach(r => {
        const b = document.createElement("button");
        b.textContent = r.emoji;
        b.onclick = (ev) => {
            ev.stopPropagation();
            toggleReaction(postId, r.key);
            closeReactionPicker();
        };
        pop.appendChild(b);
    });
    document.body.appendChild(pop);
    const rect = anchorEl.getBoundingClientRect();
    pop.style.top = `${window.scrollY + rect.top - pop.offsetHeight - 8}px`;
    pop.style.left = `${Math.max(8, window.scrollX + rect.left)}px`;
    setTimeout(() => {
        document.addEventListener("click", closeReactionPickerOnce, { once: true });
    }, 0);
}
function closeReactionPickerOnce() { closeReactionPicker(); }
function closeReactionPicker() {
    const p = document.getElementById("reaction-pop");
    if (p) p.remove();
}

function relativeTime(ms) {
    const diff = Date.now() - ms;
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    const d = Math.floor(h / 24);
    return `${d}d`;
}

async function openPostDialog(postId) {
    const snap = await getDoc(doc(db, "posts", postId));
    if (!snap.exists()) return;
    const p = snap.data();
    $("#photo-dialog-img").src = p.imageUrl;
    $("#photo-dialog-prompt").textContent = state.todayPrompt?.text || "";
    $("#photo-dialog-username").textContent = `@${p.username}`;
    $("#photo-dialog-caption").textContent = p.caption || "";

    const likeBtn = $("#photo-dialog-like");
    const heart = likeBtn.querySelector(".heart");
    const count = likeBtn.querySelector(".like-count");
    const userLiked = (p.likedBy || []).includes(state.user.uid);
    likeBtn.classList.toggle("liked", userLiked);
    heart.textContent = userLiked ? "♥" : "♡";
    count.textContent = p.likes || 0;

    likeBtn.onclick = async () => {
        const wasLiked = likeBtn.classList.contains("liked");
        likeBtn.classList.toggle("liked", !wasLiked);
        likeBtn.classList.add("pulse");
        setTimeout(() => likeBtn.classList.remove("pulse"), 400);
        heart.textContent = wasLiked ? "♡" : "♥";
        const newCount = (Number(count.textContent) || 0) + (wasLiked ? -1 : 1);
        count.textContent = Math.max(0, newCount);
        try {
            await updateDoc(doc(db, "posts", postId), {
                likes: increment(wasLiked ? -1 : 1),
                likedBy: wasLiked ? arrayRemove(state.user.uid) : arrayUnion(state.user.uid)
            });
        } catch {
            // revert UI
            likeBtn.classList.toggle("liked", wasLiked);
            heart.textContent = wasLiked ? "♥" : "♡";
            count.textContent = newCount + (wasLiked ? 1 : -1);
            showToast("Couldn't update like.", "error");
        }
    };

    $("#photo-dialog-share").onclick = () => {
        closePhotoDialog();
        location.hash = `#/share/${postId}`;
    };

    // Subscribe to comments for this post
    subscribeToComments(postId);
    $("#photo-dialog-comment-form").onsubmit = (e) => {
        e.preventDefault();
        const text = $("#photo-dialog-comment-input").value.trim();
        if (!text) return;
        $("#photo-dialog-comment-input").value = "";
        postComment(postId, text);
    };

    $("#photo-dialog").hidden = false;
}

$("#photo-dialog-close").onclick = () => closePhotoDialog();

function closePhotoDialog() {
    $("#photo-dialog").hidden = true;
    if (state.commentsUnsub) { state.commentsUnsub(); state.commentsUnsub = null; }
    state.commentsPostId = null;
    $("#photo-dialog-comments").innerHTML = "";
}

/* =============================================================
   CAPTURE VIEW
   ============================================================= */

let captureFiles = [];                  // array of File objects (max 5)
const MAX_CAPTURE_FILES = 5;

function renderCapture() {
    if (!state.todayPrompt) loadTodayPrompt().then(() => $("#capture-prompt-text").textContent = state.todayPrompt.text);
    else $("#capture-prompt-text").textContent = state.todayPrompt.text;

    captureFiles = [];
    $("#capture-picker").hidden = false;
    $("#capture-preview-block").hidden = true;
    $("#capture-uploading").hidden = true;
    $("#capture-caption").value = "";
    $("#capture-caption-count").textContent = "0 / 240";
    $("#capture-error").hidden = true;
    $("#capture-previews").innerHTML = "";
}

function setupCaptureControls() {
    $("#capture-camera").onchange = (e) => onCaptureFiles(Array.from(e.target.files || []));
    $("#capture-library").onchange = (e) => onCaptureFiles(Array.from(e.target.files || []));
    $("#capture-retake-btn").onclick = () => renderCapture();
    $("#capture-post-btn").onclick = handlePost;
    $("#capture-caption").oninput = (e) => {
        $("#capture-caption-count").textContent = `${e.target.value.length} / 240`;
    };
}

function onCaptureFiles(files) {
    if (!files.length) return;
    for (const file of files) {
        if (file.size > 12 * 1024 * 1024) {
            showToast(`"${file.name}" is over 12MB and was skipped.`, "error");
            continue;
        }
        if (captureFiles.length >= MAX_CAPTURE_FILES) {
            showToast(`Maximum ${MAX_CAPTURE_FILES} photos.`, "error");
            break;
        }
        captureFiles.push(file);
    }
    if (!captureFiles.length) return;
    renderCapturePreviews();
    $("#capture-picker").hidden = true;
    $("#capture-preview-block").hidden = false;
    // reset input so selecting same files again works
    $("#capture-camera").value = "";
    $("#capture-library").value = "";
}

function renderCapturePreviews() {
    const wrap = $("#capture-previews");
    wrap.innerHTML = "";
    captureFiles.forEach((file, idx) => {
        const div = document.createElement("div");
        div.className = "capture-preview-thumb";
        const img = document.createElement("img");
        const reader = new FileReader();
        reader.onload = (e) => { img.src = e.target.result; };
        reader.readAsDataURL(file);
        const btn = document.createElement("button");
        btn.className = "capture-preview-remove";
        btn.type = "button";
        btn.textContent = "×";
        btn.onclick = () => {
            captureFiles.splice(idx, 1);
            if (captureFiles.length === 0) renderCapture();
            else renderCapturePreviews();
        };
        div.appendChild(img);
        div.appendChild(btn);
        wrap.appendChild(div);
    });
}

async function uploadToCloudinary(file) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("upload_preset", CONFIG.cloudinary.uploadPreset);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CONFIG.cloudinary.cloudName}/image/upload`, {
        method: "POST",
        body: fd
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Upload failed: ${text}`);
    }
    const data = await res.json();
    return data.secure_url;
}

async function handlePost() {
    if (!captureFiles.length) return;
    const errEl = $("#capture-error");
    errEl.hidden = true;
    $("#capture-preview-block").hidden = true;
    $("#capture-uploading").hidden = false;

    try {
        // Upload all files in parallel
        const images = await Promise.all(captureFiles.map(f => uploadToCloudinary(f)));
        const promptDate = todayKey();
        const onTime = getWindowState().phase === "open";
        const captionRaw = $("#capture-caption").value.trim();
        const hashtags = extractHashtags(captionRaw);

        // Create post (keeps `imageUrl` for backwards compat = first image)
        await addDoc(collection(db, "posts"), {
            uid: state.user.uid,
            username: state.profile.username,
            displayName: state.profile.displayName || state.profile.username,
            promptDate,
            promptText: state.todayPrompt.text,
            imageUrl: images[0],
            images,
            caption: captionRaw,
            hashtags,
            isOnTime: onTime,
            likes: 0,
            likedBy: [],
            commentsCount: 0,
            viewsCount: 0,
            reactions: {},
            userReactions: {},
            createdAt: serverTimestamp()
        });

        // Update streak
        await updateUserStreak();

        showToast("Posted!", "success");
        location.hash = "#/feed";
    } catch (err) {
        console.error(err);
        $("#capture-uploading").hidden = true;
        $("#capture-preview-block").hidden = false;
        errEl.textContent = "Upload failed. Check your Cloudinary settings and try again.";
        errEl.hidden = false;
    }
}

/* =============================================================
   HASHTAG UTILITIES
   ============================================================= */

const HASHTAG_RE = /(^|[\s.,;:!?\(\)\[\]])#([a-zA-Z0-9_]{1,30})/g;

function extractHashtags(text) {
    if (!text) return [];
    const tags = new Set();
    let m;
    HASHTAG_RE.lastIndex = 0;
    while ((m = HASHTAG_RE.exec(text)) !== null) {
        tags.add(m[2].toLowerCase());
    }
    return Array.from(tags);
}

function linkifyText(text) {
    if (!text) return "";
    // Escape, then replace #tags with clickable links
    const escaped = escapeHtml(text);
    return escaped.replace(/(^|[\s.,;:!?\(\)\[\]])#([a-zA-Z0-9_]{1,30})/g,
        (_match, pre, tag) => `${pre}<a class="hashtag-link" href="#/hashtag/${encodeURIComponent(tag.toLowerCase())}">#${tag}</a>`);
}

async function updateUserStreak() {
    const userRef = doc(db, "users", state.user.uid);
    const snap = await getDoc(userRef);
    const data = snap.data() || {};

    const today = todayKey();
    const yesterday = yesterdayKey();
    const lastDate = data.lastPostDate;

    let currentStreak = data.currentStreak || 0;
    if (lastDate === today) {
        // already counted
    } else if (lastDate === yesterday) {
        currentStreak += 1;
    } else {
        currentStreak = 1;
    }
    const longestStreak = Math.max(data.longestStreak || 0, currentStreak);

    await updateDoc(userRef, {
        currentStreak,
        longestStreak,
        totalDrops: increment(1),
        lastPostDate: today
    });

    state.profile.currentStreak = currentStreak;
    state.profile.longestStreak = longestStreak;
    state.profile.totalDrops = (state.profile.totalDrops || 0) + 1;
    state.profile.lastPostDate = today;
}

/* =============================================================
   PROFILE VIEW
   ============================================================= */

async function renderProfile(uid) {
    const targetUid = uid || state.user.uid;
    const isOwn = targetUid === state.user.uid;

    const snap = await getDoc(doc(db, "users", targetUid));
    if (!snap.exists()) {
        showToast("Profile not found.", "error");
        location.hash = "#/";
        return;
    }
    const p = snap.data();

    $("#profile-display-name").textContent = p.displayName || p.username || "—";
    $("#profile-username").textContent = `@${p.username || "—"}`;
    $("#profile-avatar").textContent = initials(p.displayName || p.username);
    $("#profile-current-streak").textContent = p.currentStreak || 0;
    $("#profile-longest-streak").textContent = p.longestStreak || 0;
    $("#profile-total").textContent = p.totalDrops || 0;
    $("#profile-own-actions").hidden = !isOwn;
    $("#profile-other-actions").hidden = isOwn;

    if (!isOwn) {
        renderProfileFriendButton(targetUid, p.username || "user");
    }

    // Last 30 posts
    const grid = $("#profile-grid");
    grid.innerHTML = "";
    // Single where() — no composite index needed. Sort client-side below.
    const q = query(
        collection(db, "posts"),
        where("uid", "==", targetUid)
    );
    const postSnap = await getDocs(q);
    if (postSnap.empty) {
        $("#profile-empty").hidden = false;
    } else {
        $("#profile-empty").hidden = true;
        const sortedDocs = [...postSnap.docs].sort((a, b) => {
            const ta = a.data().createdAt?.toMillis?.() || 0;
            const tb = b.data().createdAt?.toMillis?.() || 0;
            return tb - ta;
        }).slice(0, 30);
        grid.innerHTML = sortedDocs.map(d => {
            const post = d.data();
            return `<div class="profile-thumb" data-post-id="${d.id}"><img src="${escapeHtml(post.imageUrl)}" alt="" loading="lazy" /></div>`;
        }).join("");
        grid.querySelectorAll(".profile-thumb").forEach(t => {
            t.onclick = () => location.hash = `#/post/${t.dataset.postId}`;
        });
    }

    if (isOwn) {
        $("#profile-signout-btn").onclick = handleSignout;
    }
}

/* =============================================================
   SHARE VIEW
   ============================================================= */

async function renderShare(postId) {
    const snap = await getDoc(doc(db, "posts", postId));
    if (!snap.exists()) {
        showToast("Drop not found.", "error");
        location.hash = "#/";
        return;
    }
    const p = snap.data();
    $("#share-card-img").src = p.imageUrl;
    $("#share-card-prompt").textContent = p.promptText || "—";
    $("#share-card-username").textContent = `@${p.username}`;

    $("#share-download-btn").onclick = async () => {
        const card = $("#share-card");
        try {
            const canvas = await html2canvas(card, { useCORS: true, backgroundColor: null, scale: 2 });
            canvas.toBlob((blob) => {
                if (!blob) { showToast("Could not export image.", "error"); return; }
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `drop-${p.promptDate}.png`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
                showToast("Image saved.", "success");
            }, "image/png");
        } catch (err) {
            console.error(err);
            showToast("Couldn't generate image.", "error");
        }
    };

    $("#share-copy-btn").onclick = async () => {
        const url = `${location.origin}${location.pathname}#/share/${postId}`;
        try {
            await navigator.clipboard.writeText(url);
            showToast("Link copied.", "success");
        } catch {
            showToast("Could not copy link.", "error");
        }
    };
}

/* =============================================================
   SETTINGS VIEW
   ============================================================= */

function renderSettings() {
    $("#settings-time").value = state.profile?.promptTimeLocal || "19:00";
    $("#settings-push").checked = !!state.profile?.pushEnabled;
    $("#settings-saved").hidden = true;
}

function setupSettingsControls() {
    $("#settings-save-btn").onclick = async () => {
        const newTime = $("#settings-time").value || "19:00";
        const pushOn = $("#settings-push").checked;
        try {
            await updateDoc(doc(db, "users", state.user.uid), {
                promptTimeLocal: newTime,
                pushEnabled: pushOn
            });
            state.profile.promptTimeLocal = newTime;
            state.profile.pushEnabled = pushOn;

            if (CONFIG.onesignal.appId && window.PushNotifications) {
                if (pushOn) await window.PushNotifications.loginUser(state.user.uid);
                else await window.PushNotifications.logoutUser();
            }

            $("#settings-saved").hidden = false;
            setTimeout(() => $("#settings-saved").hidden = true, 1800);
        } catch (err) {
            showToast("Could not save settings.", "error");
        }
    };
    $("#settings-signout-btn").onclick = handleSignout;
    $("#settings-delete-btn").onclick = handleDeleteAccount;
}

/* =============================================================
   PUSH NOTIFICATIONS (optional)
   ============================================================= */

async function initPushFor(uid) {
    if (state.pushReady || !CONFIG.onesignal.appId) return;
    try {
        const mod = await import("./push-notifications.js");
        window.PushNotifications = mod.PushNotifications;
        await mod.PushNotifications.init({ appId: CONFIG.onesignal.appId });
        await mod.PushNotifications.loginUser(uid);
        state.pushReady = true;
    } catch (err) {
        console.warn("Push init failed:", err);
    }
}

/* =============================================================
   SOCIAL — friends, friend requests, search
   ----------------------------------------------------------------
   Data model (no composite indexes needed anywhere):
     users/{uid}/friends/{friendUid}              -> { username, displayName, addedAt }
     users/{uid}/friendRequestsIn/{requesterUid}  -> { username, displayName, requestedAt }
     users/{uid}/friendRequestsOut/{recipientUid} -> { username, displayName, requestedAt }
   ============================================================= */

function startSocialSubscriptions(uid) {
    stopSocialSubscriptions();

    state.friendsUnsub = onSnapshot(
        collection(db, "users", uid, "friends"),
        (snap) => {
            state.friends.clear();
            snap.forEach(d => state.friends.set(d.id, d.data()));
            updateNavBadges();
            renderFriendsList();
            applyFeedRender();
        },
        (err) => console.warn("friends listener:", err)
    );

    state.requestsInUnsub = onSnapshot(
        collection(db, "users", uid, "friendRequestsIn"),
        (snap) => {
            state.requestsIn.clear();
            snap.forEach(d => state.requestsIn.set(d.id, d.data()));
            updateNavBadges();
            renderFriendRequests();
        },
        (err) => console.warn("requestsIn listener:", err)
    );

    state.requestsOutUnsub = onSnapshot(
        collection(db, "users", uid, "friendRequestsOut"),
        (snap) => {
            state.requestsOut.clear();
            snap.forEach(d => state.requestsOut.set(d.id, d.data()));
            renderFriendRequests();
        },
        (err) => console.warn("requestsOut listener:", err)
    );

    state.chatThreadsUnsub = onSnapshot(
        collection(db, "users", uid, "chatThreads"),
        (snap) => {
            state.chatThreads.clear();
            snap.forEach(d => state.chatThreads.set(d.id, d.data()));
            updateNavBadges();
            renderChatsList();
        },
        (err) => console.warn("chatThreads listener:", err)
    );
}

function stopSocialSubscriptions() {
    [
        "friendsUnsub", "requestsInUnsub", "requestsOutUnsub", "chatThreadsUnsub"
    ].forEach(k => {
        if (state[k]) { state[k](); state[k] = null; }
    });
    state.friends.clear();
    state.requestsIn.clear();
    state.requestsOut.clear();
    state.chatThreads.clear();
}

function updateNavBadges() {
    const reqCount = state.requestsIn.size;
    const reqBadge = $("#nav-friends-badge");
    if (reqBadge) reqBadge.hidden = reqCount === 0;

    const friendsReqBadge = $("#friends-req-badge");
    if (friendsReqBadge) {
        friendsReqBadge.textContent = reqCount;
        friendsReqBadge.hidden = reqCount === 0;
    }

    const friendsCountBadge = $("#friends-count-badge");
    if (friendsCountBadge) {
        friendsCountBadge.textContent = state.friends.size;
        friendsCountBadge.hidden = state.friends.size === 0;
    }

    let unread = 0;
    state.chatThreads.forEach(t => unread += (t.unreadCount || 0));
    const chatsBadge = $("#nav-chats-badge");
    if (chatsBadge) chatsBadge.hidden = unread === 0;
}

async function findUserByUsername(username) {
    const u = (username || "").trim().toLowerCase();
    if (!u) return null;
    const q = query(collection(db, "users"), where("username", "==", u), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { uid: d.id, ...d.data() };
}

async function sendFriendRequest(otherUid, otherProfile) {
    if (otherUid === state.user.uid) {
        showToast("That's you.", "error");
        return;
    }
    if (state.friends.has(otherUid)) {
        showToast("Already friends.", "info");
        return;
    }
    if (state.requestsOut.has(otherUid)) {
        showToast("Request already sent.", "info");
        return;
    }
    if (state.requestsIn.has(otherUid)) {
        // They already requested us — accept directly.
        await acceptFriendRequest(otherUid);
        return;
    }
    const me = state.profile;
    const myProfile = {
        username: me.username,
        displayName: me.displayName || me.username,
        requestedAt: serverTimestamp()
    };
    const theirProfile = {
        username: otherProfile.username,
        displayName: otherProfile.displayName || otherProfile.username,
        requestedAt: serverTimestamp()
    };
    try {
        await Promise.all([
            setDoc(doc(db, "users", otherUid, "friendRequestsIn", state.user.uid), myProfile),
            setDoc(doc(db, "users", state.user.uid, "friendRequestsOut", otherUid), theirProfile)
        ]);
        writeNotification(otherUid, {
            type: "friend_request",
            fromUid: state.user.uid,
            fromUsername: me.username
        });
        showToast("Friend request sent.", "success");
    } catch (err) {
        console.error(err);
        showToast("Couldn't send request.", "error");
    }
}

async function acceptFriendRequest(otherUid) {
    const incoming = state.requestsIn.get(otherUid);
    if (!incoming) return;
    const me = state.profile;
    try {
        await Promise.all([
            setDoc(doc(db, "users", state.user.uid, "friends", otherUid), {
                username: incoming.username,
                displayName: incoming.displayName || incoming.username,
                addedAt: serverTimestamp()
            }),
            setDoc(doc(db, "users", otherUid, "friends", state.user.uid), {
                username: me.username,
                displayName: me.displayName || me.username,
                addedAt: serverTimestamp()
            }),
            deleteDoc(doc(db, "users", state.user.uid, "friendRequestsIn", otherUid)),
            deleteDoc(doc(db, "users", otherUid, "friendRequestsOut", state.user.uid))
        ]);
        writeNotification(otherUid, {
            type: "friend_accept",
            fromUid: state.user.uid,
            fromUsername: me.username
        });
        showToast(`You and @${incoming.username} are now friends.`, "success");
    } catch (err) {
        console.error(err);
        showToast("Couldn't accept request.", "error");
    }
}

async function rejectFriendRequest(otherUid) {
    try {
        await Promise.all([
            deleteDoc(doc(db, "users", state.user.uid, "friendRequestsIn", otherUid)),
            deleteDoc(doc(db, "users", otherUid, "friendRequestsOut", state.user.uid))
        ]);
    } catch (err) {
        console.error(err);
        showToast("Couldn't reject.", "error");
    }
}

async function cancelFriendRequest(otherUid) {
    try {
        await Promise.all([
            deleteDoc(doc(db, "users", state.user.uid, "friendRequestsOut", otherUid)),
            deleteDoc(doc(db, "users", otherUid, "friendRequestsIn", state.user.uid))
        ]);
    } catch (err) {
        console.error(err);
        showToast("Couldn't cancel.", "error");
    }
}

async function unfriend(otherUid) {
    const ok = await confirmDialog("Remove friend?", "You'll no longer see each other in your friends feed.", "Remove");
    if (!ok) return;
    try {
        await Promise.all([
            deleteDoc(doc(db, "users", state.user.uid, "friends", otherUid)),
            deleteDoc(doc(db, "users", otherUid, "friends", state.user.uid))
        ]);
        showToast("Removed.", "success");
    } catch (err) {
        console.error(err);
        showToast("Couldn't remove.", "error");
    }
}

/* ----- Friends view rendering ----- */

let activeFriendsTab = "list";

function setFriendsTab(tab) {
    activeFriendsTab = tab;
    $$(".tab-btn[data-friends-tab]").forEach(b => {
        b.classList.toggle("active", b.dataset.friendsTab === tab);
    });
    $("#friends-tab-list").hidden = tab !== "list";
    $("#friends-tab-requests").hidden = tab !== "requests";
    $("#friends-tab-find").hidden = tab !== "find";
}

function renderFriendsList() {
    const list = $("#friends-list");
    if (!list) return;
    if (state.friends.size === 0) {
        list.innerHTML = "";
        $("#friends-empty").hidden = false;
        return;
    }
    $("#friends-empty").hidden = true;
    const rows = [...state.friends.entries()].sort((a, b) => {
        return (a[1].username || "").localeCompare(b[1].username || "");
    });
    list.innerHTML = rows.map(([uid, f]) => `
        <div class="friend-card" data-uid="${uid}">
            <div class="avatar">${escapeHtml(initials(f.displayName || f.username))}</div>
            <div class="friend-card-meta">
                <p class="friend-card-name">${escapeHtml(f.displayName || f.username)}</p>
                <p class="friend-card-username">@${escapeHtml(f.username || "")}</p>
            </div>
            <div class="friend-card-actions">
                <button class="btn btn-ghost btn-sm" data-act="message">Message</button>
                <button class="btn btn-ghost btn-sm" data-act="profile">View</button>
            </div>
        </div>
    `).join("");

    list.querySelectorAll(".friend-card").forEach(card => {
        const uid = card.dataset.uid;
        card.querySelector('[data-act="message"]').onclick = () => location.hash = `#/thread/${uid}`;
        card.querySelector('[data-act="profile"]').onclick = () => location.hash = `#/profile/${uid}`;
    });
}

function renderFriendRequests() {
    const inEl = $("#friends-requests-in");
    const outEl = $("#friends-requests-out");
    if (!inEl || !outEl) return;

    if (state.requestsIn.size === 0) {
        inEl.innerHTML = "";
        $("#friends-requests-in-empty").hidden = false;
    } else {
        $("#friends-requests-in-empty").hidden = true;
        inEl.innerHTML = [...state.requestsIn.entries()].map(([uid, r]) => `
            <div class="friend-card" data-uid="${uid}">
                <div class="avatar">${escapeHtml(initials(r.displayName || r.username))}</div>
                <div class="friend-card-meta">
                    <p class="friend-card-name">${escapeHtml(r.displayName || r.username)}</p>
                    <p class="friend-card-username">@${escapeHtml(r.username || "")}</p>
                </div>
                <div class="friend-card-actions">
                    <button class="btn btn-primary btn-sm" data-act="accept">Accept</button>
                    <button class="btn btn-ghost btn-sm" data-act="reject">Reject</button>
                </div>
            </div>
        `).join("");
        inEl.querySelectorAll(".friend-card").forEach(c => {
            const uid = c.dataset.uid;
            c.querySelector('[data-act="accept"]').onclick = () => acceptFriendRequest(uid);
            c.querySelector('[data-act="reject"]').onclick = () => rejectFriendRequest(uid);
        });
    }

    if (state.requestsOut.size === 0) {
        outEl.innerHTML = "";
        $("#friends-requests-out-empty").hidden = false;
    } else {
        $("#friends-requests-out-empty").hidden = true;
        outEl.innerHTML = [...state.requestsOut.entries()].map(([uid, r]) => `
            <div class="friend-card" data-uid="${uid}">
                <div class="avatar">${escapeHtml(initials(r.displayName || r.username))}</div>
                <div class="friend-card-meta">
                    <p class="friend-card-name">${escapeHtml(r.displayName || r.username)}</p>
                    <p class="friend-card-username">@${escapeHtml(r.username || "")}</p>
                </div>
                <div class="friend-card-actions">
                    <button class="btn btn-ghost btn-sm" data-act="cancel">Cancel</button>
                </div>
            </div>
        `).join("");
        outEl.querySelectorAll(".friend-card").forEach(c => {
            const uid = c.dataset.uid;
            c.querySelector('[data-act="cancel"]').onclick = () => cancelFriendRequest(uid);
        });
    }
}

async function handleFriendSearch(e) {
    e.preventDefault();
    const input = $("#friends-search-input");
    const result = $("#friends-search-result");
    const status = $("#friends-search-status");
    result.innerHTML = "";
    status.hidden = true;

    const username = input.value.trim().toLowerCase();
    if (!username) return;

    status.hidden = false;
    status.textContent = "Searching…";

    try {
        const found = await findUserByUsername(username);
        if (!found) {
            status.textContent = `No user with @${escapeHtml(username)}.`;
            return;
        }
        if (found.uid === state.user.uid) {
            status.textContent = "That's you.";
            return;
        }
        status.hidden = true;
        const isFriend = state.friends.has(found.uid);
        const isOutgoing = state.requestsOut.has(found.uid);
        const isIncoming = state.requestsIn.has(found.uid);

        let actionHtml = "";
        if (isFriend) actionHtml = `<button class="btn btn-secondary btn-sm" disabled>Friends ✓</button>`;
        else if (isOutgoing) actionHtml = `<button class="btn btn-ghost btn-sm" data-act="cancel">Pending — Cancel</button>`;
        else if (isIncoming) actionHtml = `<button class="btn btn-primary btn-sm" data-act="accept">Accept request</button>`;
        else actionHtml = `<button class="btn btn-primary btn-sm" data-act="add">Add friend</button>`;

        result.innerHTML = `
            <div class="friend-card" data-uid="${found.uid}">
                <div class="avatar">${escapeHtml(initials(found.displayName || found.username))}</div>
                <div class="friend-card-meta">
                    <p class="friend-card-name">${escapeHtml(found.displayName || found.username)}</p>
                    <p class="friend-card-username">@${escapeHtml(found.username || "")}</p>
                </div>
                <div class="friend-card-actions">${actionHtml}</div>
            </div>`;
        const card = result.querySelector(".friend-card");
        const addBtn = card.querySelector('[data-act="add"]');
        const cancelBtn = card.querySelector('[data-act="cancel"]');
        const acceptBtn = card.querySelector('[data-act="accept"]');
        if (addBtn) addBtn.onclick = () => sendFriendRequest(found.uid, found).then(() => handleFriendSearch(e));
        if (cancelBtn) cancelBtn.onclick = () => cancelFriendRequest(found.uid).then(() => handleFriendSearch(e));
        if (acceptBtn) acceptBtn.onclick = () => acceptFriendRequest(found.uid).then(() => handleFriendSearch(e));
    } catch (err) {
        console.error(err);
        status.textContent = "Search failed.";
    }
}

function renderProfileFriendButton(otherUid, otherUsername) {
    const btn = $("#profile-friend-btn");
    const msgBtn = $("#profile-message-btn");

    const isFriend = state.friends.has(otherUid);
    const isOutgoing = state.requestsOut.has(otherUid);
    const isIncoming = state.requestsIn.has(otherUid);

    btn.className = "btn btn-block";
    if (isFriend) {
        btn.textContent = "Friends ✓ — Remove";
        btn.classList.add("btn-ghost");
        btn.onclick = () => unfriend(otherUid);
        msgBtn.hidden = false;
        msgBtn.onclick = () => location.hash = `#/thread/${otherUid}`;
    } else if (isOutgoing) {
        btn.textContent = "Pending — Cancel request";
        btn.classList.add("btn-ghost");
        btn.onclick = () => cancelFriendRequest(otherUid);
        msgBtn.hidden = true;
    } else if (isIncoming) {
        btn.textContent = "Accept friend request";
        btn.classList.add("btn-primary");
        btn.onclick = () => acceptFriendRequest(otherUid);
        msgBtn.hidden = true;
    } else {
        btn.textContent = "Add friend";
        btn.classList.add("btn-primary");
        btn.onclick = async () => {
            const profile = (await getDoc(doc(db, "users", otherUid))).data() || {};
            sendFriendRequest(otherUid, { username: otherUsername, displayName: profile.displayName });
        };
        msgBtn.hidden = true;
    }
}

/* =============================================================
   COMMENTS — subcollection on each post
   ----------------------------------------------------------------
   posts/{postId}/comments/{commentId}
   Single subcollection query, no composite index needed.
   ============================================================= */

function subscribeToComments(postId) {
    if (state.commentsUnsub) state.commentsUnsub();
    state.commentsPostId = postId;
    const list = $("#photo-dialog-comments");
    list.innerHTML = "";

    state.commentsUnsub = onSnapshot(
        collection(db, "posts", postId, "comments"),
        (snap) => {
            const empty = $("#photo-dialog-comments-empty");
            if (snap.empty) {
                empty.hidden = false;
                list.innerHTML = "";
                return;
            }
            empty.hidden = true;
            const sorted = [...snap.docs].sort((a, b) => {
                const ta = a.data().createdAt?.toMillis?.() || 0;
                const tb = b.data().createdAt?.toMillis?.() || 0;
                return ta - tb;
            });
            list.innerHTML = sorted.map(d => {
                const c = d.data();
                return `
                    <div class="comment-item">
                        <span class="comment-author">@${escapeHtml(c.username || "user")}</span>
                        <p class="comment-text">${escapeHtml(c.text || "")}</p>
                    </div>`;
            }).join("");
            list.scrollTop = list.scrollHeight;
        },
        (err) => console.warn("comments listener:", err)
    );
}

async function postComment(postId, text, parentId = null, parentUid = null) {
    try {
        const docPayload = {
            text,
            uid: state.user.uid,
            username: state.profile.username,
            likes: 0,
            likedBy: [],
            createdAt: serverTimestamp()
        };
        if (parentId) docPayload.parentId = parentId;
        await addDoc(collection(db, "posts", postId, "comments"), docPayload);
        // Bump comments count
        try {
            await updateDoc(doc(db, "posts", postId), { commentsCount: increment(1) });
        } catch (e) { /* non-fatal */ }
        // Notify post owner (for top-level comments) or the parent comment author (for replies)
        const psnap = await getDoc(doc(db, "posts", postId));
        const owner = psnap.data()?.uid;
        const thumb = psnap.data()?.imageUrl || "";
        if (parentId && parentUid && parentUid !== state.user.uid) {
            writeNotification(parentUid, {
                type: "reply",
                fromUid: state.user.uid,
                fromUsername: state.profile.username,
                postId,
                postThumb: thumb,
                text
            });
        } else if (!parentId && owner && owner !== state.user.uid) {
            writeNotification(owner, {
                type: "comment",
                fromUid: state.user.uid,
                fromUsername: state.profile.username,
                postId,
                postThumb: thumb,
                text
            });
        }
    } catch (err) {
        console.error(err);
        showToast("Couldn't post comment.", "error");
    }
}

/* =============================================================
   CHAT — 1:1 messages between friends
   ----------------------------------------------------------------
   chats/{chatId}/messages/{messageId}      where chatId = sorted([uidA, uidB]).join("_")
   users/{uid}/chatThreads/{chatId}         inbox: lastMessage, otherUid, updatedAt, unreadCount
   All queries use a single subcollection — no composite indexes.
   ============================================================= */

function chatIdFor(uidA, uidB) {
    return [uidA, uidB].sort().join("_");
}

function renderChatsList() {
    const list = $("#chats-list");
    if (!list) return;
    if (state.chatThreads.size === 0) {
        list.innerHTML = "";
        $("#chats-empty").hidden = false;
        return;
    }
    $("#chats-empty").hidden = true;
    const rows = [...state.chatThreads.values()].sort((a, b) => {
        const ta = a.updatedAt?.toMillis?.() || 0;
        const tb = b.updatedAt?.toMillis?.() || 0;
        return tb - ta;
    });
    list.innerHTML = rows.map(t => {
        const initial = (t.otherUsername || "?").charAt(0).toUpperCase();
        const time = t.updatedAt?.toMillis ? relativeTime(t.updatedAt.toMillis()) : "";
        const preview = t.lastIsImage
            ? "📷 Photo"
            : (t.lastMessage || "");
        const unread = t.unreadCount > 0 && t.lastSenderUid !== state.user.uid;
        return `
            <div class="chat-row" data-uid="${t.otherUid}">
                <div class="chat-avatar">${escapeHtml(initial)}</div>
                <div class="chat-body">
                    <div class="chat-row-top">
                        <span class="chat-name">@${escapeHtml(t.otherUsername || "user")}</span>
                        <span class="chat-time">${time}</span>
                    </div>
                    <div class="chat-row-bottom">
                        <span class="chat-preview ${unread ? "unread" : ""}">${escapeHtml(preview)}</span>
                        ${unread ? `<span class="chat-unread-pill">${t.unreadCount}</span>` : ""}
                    </div>
                </div>
            </div>
        `;
    }).join("");
    list.querySelectorAll(".chat-row").forEach(row => {
        row.onclick = () => location.hash = `#/thread/${row.dataset.uid}`;
    });
}

async function openThread(otherUid) {
    state.threadOtherUid = otherUid;
    if (state.threadUnsub) { state.threadUnsub(); state.threadUnsub = null; }

    let otherUsername = state.friends.get(otherUid)?.username
        || state.chatThreads.get(chatIdFor(state.user.uid, otherUid))?.otherUsername;
    if (!otherUsername) {
        const snap = await getDoc(doc(db, "users", otherUid));
        otherUsername = snap.data()?.username || "user";
    }
    $("#thread-title").textContent = `@${otherUsername}`;
    $("#thread-avatar").textContent = (otherUsername || "?").charAt(0).toUpperCase();
    $("#thread-subtitle").textContent = "Tap to view profile";
    $("#thread-profile-link").setAttribute("href", `#/profile/${encodeURIComponent(otherUsername)}`);
    document.body.classList.add("in-thread");

    const messagesEl = $("#thread-messages");
    messagesEl.innerHTML = "";

    const cid = chatIdFor(state.user.uid, otherUid);

    // Mark thread as read
    const threadDoc = state.chatThreads.get(cid);
    if (threadDoc && threadDoc.unreadCount > 0) {
        try {
            await updateDoc(doc(db, "users", state.user.uid, "chatThreads", cid), { unreadCount: 0 });
        } catch (e) { /* may not exist yet */ }
    }

    state.threadUnsub = onSnapshot(
        collection(db, "chats", cid, "messages"),
        (snap) => {
            const sorted = [...snap.docs].sort((a, b) => {
                const ta = a.data().createdAt?.toMillis?.() || 0;
                const tb = b.data().createdAt?.toMillis?.() || 0;
                return ta - tb;
            });
            messagesEl.innerHTML = renderThreadMessagesHTML(sorted);
            messagesEl.scrollTop = messagesEl.scrollHeight;
            // Wire image clicks (open full size)
            messagesEl.querySelectorAll(".msg-image").forEach(img => {
                img.onclick = () => window.open(img.src, "_blank");
            });
        },
        (err) => console.warn("thread listener:", err)
    );

    $("#thread-form").onsubmit = (e) => {
        e.preventDefault();
        const input = $("#thread-input");
        const text = input.value.trim();
        if (!text) return;
        input.value = "";
        sendMessage(otherUid, { text });
    };
    $("#thread-image-input").onchange = async (e) => {
        const file = e.target.files[0];
        e.target.value = "";
        if (!file) return;
        await sendImageMessage(otherUid, file);
    };
    $("#thread-input").focus();
}

function renderThreadMessagesHTML(sortedDocs) {
    let html = "";
    let lastDate = "";
    let prevSender = null;
    sortedDocs.forEach((d, i) => {
        const m = d.data();
        const mine = m.uid === state.user.uid;
        const ts = m.createdAt?.toMillis?.() || Date.now();
        const dayLabel = formatDayDivider(ts);
        if (dayLabel !== lastDate) {
            html += `<div class="msg-time-divider">${dayLabel}</div>`;
            lastDate = dayLabel;
            prevSender = null;
        }
        const consecutive = prevSender === m.uid;
        prevSender = m.uid;
        let bubbleContent;
        if (m.imageUrl) {
            bubbleContent = `<img class="msg-image" src="${escapeHtml(m.imageUrl)}" alt="" />`;
        } else {
            bubbleContent = `<div class="msg-bubble">${linkifyText(m.text || "")}</div>`;
        }
        html += `<div class="msg-row ${mine ? "from-me" : "from-them"} ${consecutive ? "consecutive" : ""}">${bubbleContent}</div>`;
    });
    return html;
}

function formatDayDivider(ms) {
    const d = new Date(ms);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) return "Today";
    const yest = new Date(now); yest.setDate(now.getDate() - 1);
    if (d.toDateString() === yest.toDateString()) return "Yesterday";
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function leaveThread() {
    document.body.classList.remove("in-thread");
    if (state.threadUnsub) { state.threadUnsub(); state.threadUnsub = null; }
    state.threadOtherUid = null;
}

async function sendMessage(otherUid, payload) {
    // payload: { text } or { imageUrl }
    const me = state.user.uid;
    const cid = chatIdFor(me, otherUid);
    const myUsername = state.profile.username;

    let otherUsername = state.friends.get(otherUid)?.username
        || state.chatThreads.get(cid)?.otherUsername;
    if (!otherUsername) {
        const s = await getDoc(doc(db, "users", otherUid));
        otherUsername = s.data()?.username || "user";
    }

    const now = serverTimestamp();
    const isImage = !!payload.imageUrl;
    const messageDoc = isImage
        ? { imageUrl: payload.imageUrl, uid: me, createdAt: now }
        : { text: payload.text, uid: me, createdAt: now };
    const previewText = isImage ? "📷 Photo" : payload.text;

    try {
        await addDoc(collection(db, "chats", cid, "messages"), messageDoc);
        await Promise.all([
            setDoc(doc(db, "users", me, "chatThreads", cid), {
                otherUid, otherUsername,
                lastMessage: previewText, lastIsImage: isImage,
                lastSenderUid: me,
                updatedAt: now, unreadCount: 0
            }, { merge: true }),
            setDoc(doc(db, "users", otherUid, "chatThreads", cid), {
                otherUid: me, otherUsername: myUsername,
                lastMessage: previewText, lastIsImage: isImage,
                lastSenderUid: me,
                updatedAt: now,
                unreadCount: increment(1)
            }, { merge: true })
        ]);
        // Notify recipient
        writeNotification(otherUid, {
            type: "message",
            fromUid: me,
            fromUsername: myUsername,
            text: previewText
        });
    } catch (err) {
        console.error(err);
        showToast("Message failed to send.", "error");
    }
}

async function sendImageMessage(otherUid, file) {
    if (file.size > 12 * 1024 * 1024) {
        showToast("Image is too large (max 12MB).", "error");
        return;
    }
    showToast("Uploading image…");
    try {
        const url = await uploadToCloudinary(file);
        await sendMessage(otherUid, { imageUrl: url });
    } catch (err) {
        console.error(err);
        showToast("Image upload failed.", "error");
    }
}

/* =============================================================
   NOTIFICATIONS
   ----------------------------------------------------------------
   users/{uid}/notifications/{id}
   { type, fromUid, fromUsername, postId?, postThumb?, text?, read, createdAt }
   No composite index — single subcollection scan.
   ============================================================= */

async function writeNotification(toUid, payload) {
    if (!toUid || toUid === state.user.uid) return;
    try {
        await addDoc(collection(db, "users", toUid, "notifications"), {
            ...payload,
            read: false,
            createdAt: serverTimestamp()
        });
    } catch (err) {
        console.warn("notification:", err);
    }
}

function subscribeToNotifications(uid) {
    if (state.notificationsUnsub) state.notificationsUnsub();
    state.notificationsUnsub = onSnapshot(
        collection(db, "users", uid, "notifications"),
        (snap) => {
            state.notifications = snap.docs;
            updateNotifBadge();
            if (location.hash === "#/notifications") renderNotifications();
        },
        (err) => console.warn("notifs:", err)
    );
}

function updateNotifBadge() {
    const badge = $("#nav-notif-badge");
    if (!badge) return;
    const unread = state.notifications.filter(d => d.data().read === false).length;
    if (unread > 0) {
        badge.textContent = unread > 99 ? "99+" : String(unread);
        badge.hidden = false;
    } else {
        badge.hidden = true;
    }
}

function renderNotifications() {
    const list = $("#notifications-list");
    const empty = $("#notifications-empty");
    if (!list) return;
    if (state.notifications.length === 0) {
        list.innerHTML = "";
        empty.hidden = false;
        return;
    }
    empty.hidden = true;
    const sorted = [...state.notifications].sort((a, b) => {
        const ta = a.data().createdAt?.toMillis?.() || 0;
        const tb = b.data().createdAt?.toMillis?.() || 0;
        return tb - ta;
    });
    list.innerHTML = sorted.map(d => {
        const n = d.data();
        const initial = (n.fromUsername || "?").charAt(0).toUpperCase();
        const time = n.createdAt?.toMillis ? relativeTime(n.createdAt.toMillis()) : "";
        let actionText = "";
        switch (n.type) {
            case "like":     actionText = `<strong>@${escapeHtml(n.fromUsername)}</strong> liked your drop.`; break;
            case "view":     actionText = `<strong>@${escapeHtml(n.fromUsername)}</strong> viewed your drop.`; break;
            case "comment":  actionText = `<strong>@${escapeHtml(n.fromUsername)}</strong> commented: ${escapeHtml((n.text || "").slice(0, 60))}`; break;
            case "reply":    actionText = `<strong>@${escapeHtml(n.fromUsername)}</strong> replied: ${escapeHtml((n.text || "").slice(0, 60))}`; break;
            case "reaction": actionText = `<strong>@${escapeHtml(n.fromUsername)}</strong> reacted ${n.emoji || "❤️"} to your drop.`; break;
            case "friend_request": actionText = `<strong>@${escapeHtml(n.fromUsername)}</strong> sent you a friend request.`; break;
            case "friend_accept":  actionText = `<strong>@${escapeHtml(n.fromUsername)}</strong> accepted your friend request.`; break;
            case "message":  actionText = `<strong>@${escapeHtml(n.fromUsername)}</strong>: ${escapeHtml((n.text || "").slice(0, 60))}`; break;
            default:         actionText = `<strong>@${escapeHtml(n.fromUsername || "Someone")}</strong> did something.`;
        }
        const thumb = n.postThumb ? `<img class="notif-thumb" src="${escapeHtml(n.postThumb)}" alt="" />` : "";
        return `
            <div class="notif-item ${n.read ? "" : "unread"}" data-id="${d.id}" data-type="${n.type}" data-post-id="${n.postId || ""}" data-from-username="${escapeHtml(n.fromUsername || "")}">
                <div class="notif-avatar">${escapeHtml(initial)}</div>
                <div class="notif-body">
                    <p class="notif-text">${actionText}</p>
                    <p class="notif-time">${time}</p>
                </div>
                ${thumb}
            </div>
        `;
    }).join("");

    list.querySelectorAll(".notif-item").forEach(el => {
        el.onclick = async () => {
            const id = el.dataset.id;
            const type = el.dataset.type;
            const postId = el.dataset.postId;
            const fromUsername = el.dataset.fromUsername;
            // Mark read
            try { await updateDoc(doc(db, "users", state.user.uid, "notifications", id), { read: true }); } catch {}
            if (postId && (type === "like" || type === "view" || type === "comment" || type === "reply" || type === "reaction")) {
                location.hash = `#/post/${postId}`;
            } else if (type === "message") {
                // need otherUid → store fromUid
                const sn = state.notifications.find(d => d.id === id);
                const fromUid = sn?.data()?.fromUid;
                if (fromUid) location.hash = `#/thread/${fromUid}`;
            } else if (type === "friend_request" || type === "friend_accept") {
                location.hash = "#/friends";
            } else if (fromUsername) {
                location.hash = `#/profile/${encodeURIComponent(fromUsername)}`;
            }
        };
    });

    // Auto-mark all as read shortly after view (so badge clears)
    setTimeout(async () => {
        const batch = writeBatch(db);
        let any = false;
        state.notifications.forEach(d => {
            if (d.data().read === false) {
                batch.update(doc(db, "users", state.user.uid, "notifications", d.id), { read: true });
                any = true;
            }
        });
        if (any) try { await batch.commit(); } catch {}
    }, 1500);
}

/* =============================================================
   POST DETAIL PAGE (full page view, not modal)
   ============================================================= */

async function renderPost(postId) {
    const container = $("#post-detail");
    container.innerHTML = `<div class="empty-state"><div class="spinner"></div></div>`;

    const ref = doc(db, "posts", postId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
        container.innerHTML = `<div class="empty-state"><h3>Drop not found</h3><p class="muted">It may have been deleted.</p></div>`;
        return;
    }
    const p = snap.data();

    // Track view (idempotent — first time only). Notify owner.
    recordPostView(postId, p).catch(() => {});

    // Render the full card
    const cardHTML = renderPostCardHTML(postId, p);
    const statsHTML = `
        <div class="post-stats">
            <span><strong>${p.viewsCount || 0}</strong> views</span>
            <span><strong>${p.likes || 0}</strong> likes</span>
            <span><strong>${p.commentsCount || 0}</strong> comments</span>
        </div>`;
    const composerHTML = `
        <form id="post-detail-comment-form" class="post-detail-composer">
            <input id="post-detail-comment-input" type="text" placeholder="Add a comment…" autocomplete="off" maxlength="240" required />
            <button type="submit">Post</button>
        </form>`;
    container.innerHTML = `
        ${cardHTML}
        ${statsHTML}
        <div class="post-detail-comments">
            <h3>Comments</h3>
            <div id="post-detail-comments-list"></div>
            <p id="post-detail-comments-empty" class="muted small" hidden>No comments yet. Be the first.</p>
        </div>
        ${composerHTML}
    `;

    // Wire the post card itself (carousel, like, share, reactions etc.)
    wirePostCards(container);

    // Subscribe to comments live
    subscribeToCommentsForDetail(postId, p.uid);

    $("#post-detail-comment-form").onsubmit = async (e) => {
        e.preventDefault();
        const inp = $("#post-detail-comment-input");
        const text = inp.value.trim();
        if (!text) return;
        inp.value = "";
        await postComment(postId, text, null /* parentId */);
    };
}

async function recordPostView(postId, p) {
    const me = state.user.uid;
    if (!p?.uid || p.uid === me) return;
    const viewRef = doc(db, "posts", postId, "views", me);
    const vs = await getDoc(viewRef);
    if (vs.exists()) return;
    await setDoc(viewRef, { createdAt: serverTimestamp(), username: state.profile.username });
    try { await updateDoc(doc(db, "posts", postId), { viewsCount: increment(1) }); } catch {}
    writeNotification(p.uid, {
        type: "view",
        fromUid: me,
        fromUsername: state.profile.username,
        postId,
        postThumb: p.imageUrl || ""
    });
}

function subscribeToCommentsForDetail(postId, postOwnerUid) {
    if (state.commentsUnsub) state.commentsUnsub();
    // Cleanup previous reply unsubs
    state.repliesUnsubs.forEach(u => u()); state.repliesUnsubs.clear();
    state.commentsPostId = postId;

    state.commentsUnsub = onSnapshot(
        collection(db, "posts", postId, "comments"),
        (snap) => {
            const list = $("#post-detail-comments-list");
            const empty = $("#post-detail-comments-empty");
            if (!list) return;
            const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            const top = all.filter(c => !c.parentId).sort((a, b) => {
                const ta = a.createdAt?.toMillis?.() || 0;
                const tb = b.createdAt?.toMillis?.() || 0;
                return ta - tb;
            });
            const repliesByParent = new Map();
            all.filter(c => c.parentId).forEach(c => {
                if (!repliesByParent.has(c.parentId)) repliesByParent.set(c.parentId, []);
                repliesByParent.get(c.parentId).push(c);
            });
            repliesByParent.forEach(arr => arr.sort((a, b) => {
                const ta = a.createdAt?.toMillis?.() || 0;
                const tb = b.createdAt?.toMillis?.() || 0;
                return ta - tb;
            }));
            if (top.length === 0) {
                list.innerHTML = "";
                empty.hidden = false;
                return;
            }
            empty.hidden = true;
            list.innerHTML = top.map(c => renderDetailCommentHTML(c, repliesByParent.get(c.id) || [])).join("");
            wireDetailComments(list, postId, postOwnerUid);
        },
        (err) => console.warn("comments listener:", err)
    );
}

function renderDetailCommentHTML(c, replies) {
    const initial = (c.username || "?").charAt(0).toUpperCase();
    const time = c.createdAt?.toMillis ? relativeTime(c.createdAt.toMillis()) : "";
    const liked = (c.likedBy || []).includes(state.user.uid);
    const likes = c.likes || 0;
    const isMine = c.uid === state.user.uid;
    const repliesHTML = replies.length
        ? `<div class="detail-replies">${replies.map(r => renderDetailCommentHTML(r, [])).join("")}</div>`
        : "";
    return `
        <div class="detail-comment" data-comment-id="${c.id}" data-comment-uid="${c.uid}" data-comment-username="${escapeHtml(c.username || "")}">
            <div class="detail-comment-avatar" data-username="${escapeHtml(c.username || "")}">${escapeHtml(initial)}</div>
            <div class="detail-comment-body">
                <div>
                    <span class="detail-comment-author" data-username="${escapeHtml(c.username || "")}">@${escapeHtml(c.username || "user")}</span>
                    <span class="detail-comment-time">${time}</span>
                </div>
                <p class="detail-comment-text">${linkifyText(c.text || "")}</p>
                <div class="detail-comment-actions">
                    <button class="like-btn-mini ${liked ? "liked" : ""}" data-action="like-comment">${liked ? "♥" : "♡"} ${likes > 0 ? likes : ""}</button>
                    ${c.parentId ? "" : `<button data-action="reply">Reply</button>`}
                    ${isMine ? `<button data-action="delete-comment">Delete</button>` : ""}
                </div>
                <div class="reply-composer-slot"></div>
                ${repliesHTML}
            </div>
        </div>`;
}

function wireDetailComments(container, postId, postOwnerUid) {
    container.querySelectorAll(".detail-comment").forEach(el => {
        const cid = el.dataset.commentId;
        const cuid = el.dataset.commentUid;
        const cusername = el.dataset.commentUsername;

        el.querySelectorAll("[data-username]").forEach(u => {
            u.onclick = (ev) => {
                ev.stopPropagation();
                const un = u.dataset.username;
                if (un) location.hash = `#/profile/${encodeURIComponent(un)}`;
            };
        });

        const likeBtn = el.querySelector('[data-action="like-comment"]');
        if (likeBtn) likeBtn.onclick = async (ev) => {
            ev.stopPropagation();
            const wasLiked = likeBtn.classList.contains("liked");
            likeBtn.classList.toggle("liked", !wasLiked);
            try {
                await updateDoc(doc(db, "posts", postId, "comments", cid), {
                    likes: increment(wasLiked ? -1 : 1),
                    likedBy: wasLiked ? arrayRemove(state.user.uid) : arrayUnion(state.user.uid)
                });
            } catch (e) {
                likeBtn.classList.toggle("liked", wasLiked);
            }
        };

        const replyBtn = el.querySelector('[data-action="reply"]');
        if (replyBtn) replyBtn.onclick = (ev) => {
            ev.stopPropagation();
            const slot = el.querySelector(".reply-composer-slot");
            if (slot.firstChild) { slot.innerHTML = ""; return; }
            slot.innerHTML = `
                <form class="reply-composer">
                    <input type="text" placeholder="Reply to @${escapeHtml(cusername)}…" required maxlength="240" />
                    <button type="submit">Reply</button>
                </form>`;
            const form = slot.querySelector("form");
            const inp = slot.querySelector("input");
            inp.focus();
            form.onsubmit = async (e) => {
                e.preventDefault();
                const t = inp.value.trim();
                if (!t) return;
                inp.value = "";
                slot.innerHTML = "";
                await postComment(postId, t, cid /* parentId */, cuid /* parentUid */);
            };
        };

        const delBtn = el.querySelector('[data-action="delete-comment"]');
        if (delBtn) delBtn.onclick = async (ev) => {
            ev.stopPropagation();
            try {
                await deleteDoc(doc(db, "posts", postId, "comments", cid));
                await updateDoc(doc(db, "posts", postId), { commentsCount: increment(-1) });
            } catch (e) { showToast("Couldn't delete.", "error"); }
        };
    });
}

/* =============================================================
   HASHTAG VIEW
   ============================================================= */

async function renderHashtag(tag) {
    $("#hashtag-title").textContent = `#${tag}`;
    const grid = $("#hashtag-feed");
    const empty = $("#hashtag-empty");
    grid.innerHTML = `<div class="empty-state"><div class="spinner"></div></div>`;
    empty.hidden = true;

    try {
        const q = query(
            collection(db, "posts"),
            where("hashtags", "array-contains", tag.toLowerCase())
        );
        const snap = await getDocs(q);
        if (snap.empty) {
            grid.innerHTML = "";
            empty.hidden = false;
            $("#hashtag-count").textContent = "0 drops";
            return;
        }
        const sorted = [...snap.docs].sort((a, b) => {
            const ta = a.data().createdAt?.toMillis?.() || 0;
            const tb = b.data().createdAt?.toMillis?.() || 0;
            return tb - ta;
        });
        $("#hashtag-count").textContent = `${sorted.length} drop${sorted.length === 1 ? "" : "s"}`;
        grid.innerHTML = sorted.map(d => renderPostCardHTML(d.id, d.data())).join("");
        wirePostCards(grid);
    } catch (err) {
        console.error(err);
        grid.innerHTML = `<div class="empty-state"><p class="muted">Couldn't load this hashtag.</p></div>`;
    }
}

/* =============================================================
   ROUTER
   ============================================================= */

const ROUTES = [
    { hash: "#/login",       view: "view-login",       chrome: false, public: true },
    { hash: "#/signup",      view: "view-signup",      chrome: false, public: true },
    { hash: "#/onboarding",  view: "view-onboarding",  chrome: false, public: false },
    { hash: "#/capture",     view: "view-capture",     chrome: true,  public: false },
    { hash: "#/feed",        view: "view-feed",        chrome: true,  public: false },
    { hash: "#/friends",     view: "view-friends",     chrome: true,  public: false },
    { hash: "#/chats",       view: "view-chats",       chrome: true,  public: false },
    { hash: "#/thread/",     view: "view-thread",      chrome: true,  public: false, prefix: true },
    { hash: "#/share/",      view: "view-share",       chrome: true,  public: false, prefix: true },
    { hash: "#/post/",       view: "view-post",        chrome: true,  public: false, prefix: true },
    { hash: "#/hashtag/",    view: "view-hashtag",     chrome: true,  public: false, prefix: true },
    { hash: "#/notifications", view: "view-notifications", chrome: true, public: false },
    { hash: "#/profile",     view: "view-profile",     chrome: true,  public: false, prefix: true },
    { hash: "#/settings",    view: "view-settings",    chrome: true,  public: false },
    { hash: "#/",            view: "view-today",       chrome: true,  public: false }
];

function matchRoute(hash) {
    if (!hash || hash === "#") return ROUTES.find(r => r.hash === "#/");
    for (const r of ROUTES) {
        if (r.prefix && hash.startsWith(r.hash)) return r;
        if (hash === r.hash) return r;
    }
    return null;
}

async function router() {
    const hash = location.hash || "#/";
    const route = matchRoute(hash) || ROUTES.find(r => r.hash === "#/");

    // Auth gate
    if (!route.public && !state.user) {
        location.hash = "#/login";
        return;
    }
    if (route.public && state.user && state.profile?.username) {
        location.hash = "#/";
        return;
    }
    if (route.hash === "#/onboarding" && state.profile?.username) {
        location.hash = "#/";
        return;
    }

    // Show only this view
    $$(".view").forEach(el => el.hidden = el.id !== route.view);

    // Chrome
    document.body.classList.toggle("no-chrome", !route.chrome);
    $("#top-header").hidden = !route.chrome;
    $("#bottom-nav").hidden = !route.chrome;

    // Active nav
    $$(".nav-item").forEach(el => {
        const r = el.dataset.route;
        const active = (r === "today" && route.view === "view-today")
            || (r === "feed" && route.view === "view-feed")
            || (r === "friends" && route.view === "view-friends")
            || (r === "chats" && (route.view === "view-chats" || route.view === "view-thread"))
            || (r === "profile" && route.view === "view-profile");
        el.classList.toggle("active", active);
    });

    // Leave thread cleanup if not viewing it
    if (route.view !== "view-thread") leaveThread();

    // Per-route render
    if (route.view === "view-today") await renderToday();
    else if (route.view === "view-feed") {
        if (!state.todayPrompt) await loadTodayPrompt();
        renderFeed();
    }
    else if (route.view === "view-capture") renderCapture();
    else if (route.view === "view-profile") {
        const m = hash.match(/^#\/profile\/(.+)$/);
        await renderProfile(m ? decodeURIComponent(m[1]) : null);
    }
    else if (route.view === "view-share") {
        const m = hash.match(/^#\/share\/(.+)$/);
        if (m) await renderShare(decodeURIComponent(m[1]));
    }
    else if (route.view === "view-settings") renderSettings();
    else if (route.view === "view-onboarding") showOnboardingSlide(0);
    else if (route.view === "view-friends") {
        setFriendsTab(activeFriendsTab);
        renderFriendsList();
        renderFriendRequests();
    }
    else if (route.view === "view-chats") renderChatsList();
    else if (route.view === "view-thread") {
        const m = hash.match(/^#\/thread\/(.+)$/);
        if (m) await openThread(decodeURIComponent(m[1]));
    }
    else if (route.view === "view-post") {
        const m = hash.match(/^#\/post\/(.+)$/);
        if (m) await renderPost(decodeURIComponent(m[1]));
    }
    else if (route.view === "view-hashtag") {
        const m = hash.match(/^#\/hashtag\/(.+)$/);
        if (m) await renderHashtag(decodeURIComponent(m[1]));
    }
    else if (route.view === "view-notifications") renderNotifications();

    // Stop feed listener when leaving feed
    if (route.view !== "view-feed" && state.feedUnsub) {
        state.feedUnsub();
        state.feedUnsub = null;
    }
    // Stop countdown when leaving today
    if (route.view !== "view-today" && state.countdownInterval) {
        clearInterval(state.countdownInterval);
        state.countdownInterval = null;
    }

    window.scrollTo(0, 0);
}

window.addEventListener("hashchange", router);

/* =============================================================
   GLOBAL EVENT WIRING
   ============================================================= */

document.addEventListener("DOMContentLoaded", () => {
    $("#login-form").addEventListener("submit", handleLogin);
    $("#signup-form").addEventListener("submit", handleSignup);
    $("#forgot-btn").onclick = handleForgot;
    $("#header-settings-btn").onclick = () => location.hash = "#/settings";
    const notifBtn = $("#header-notif-btn");
    if (notifBtn) notifBtn.onclick = () => location.hash = "#/notifications";

    setupOnboardingControls();
    setupCaptureControls();
    setupSettingsControls();

    // Feed tabs (Friends / Everyone)
    $$(".tab-btn[data-feed-tab]").forEach(btn => {
        btn.onclick = () => {
            state.feedTab = btn.dataset.feedTab;
            $$(".tab-btn[data-feed-tab]").forEach(b => {
                b.classList.toggle("active", b.dataset.feedTab === state.feedTab);
            });
            applyFeedRender();
        };
    });

    // Friends sub-tabs (Friends / Requests / Find)
    $$(".tab-btn[data-friends-tab]").forEach(btn => {
        btn.onclick = () => setFriendsTab(btn.dataset.friendsTab);
    });

    // Friend search form
    const searchForm = $("#friends-search-form");
    if (searchForm) searchForm.addEventListener("submit", handleFriendSearch);

    // Run router once for initial page (e.g. opening with #/share/abc directly)
    if (!auth.currentUser) router();
});


