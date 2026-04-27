/* =============================================================
   features.js — paste-in companion module for Drop
   Loaded via:  <script type="module" src="features.js"></script>
   Depends on window.dropApp exposed by app.js

   Adds:
     1. Chat customization (per-chat theme color + wallpaper)
     2. Songs on drops (preloaded library + mini-player)
     3. Reply drops (photo replies to a feed drop)
     4. Streak shields (earn 1 every 14-day run, shown next to streak)
     5. Monthly "Year-in-Drops" recap (shareable image)
   ============================================================= */

// ---- Wait for app.js to publish window.dropApp ----
let App = window.dropApp;
if (!App) {
    await new Promise(resolve => {
        window.addEventListener("dropapp:ready", () => { App = window.dropApp; resolve(); }, { once: true });
    });
}

const { state, db, $, $$, escapeHtml, showToast, todayKey, uploadToCloudinary } = App;
const F = App.firestore;

// Tiny helpers
const _on = (el, ev, fn) => el && el.addEventListener(ev, fn);
const debounce = (fn, ms = 200) => {
    let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
};
const openDialog = (id) => { const d = document.getElementById(id); if (d && !d.open) d.showModal?.(); };
const closeDialog = (id) => { const d = document.getElementById(id); if (d && d.open) d.close?.(); };

// Generic close-dialog wiring (works for any [data-close-dialog])
document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-close-dialog]");
    if (btn) closeDialog(btn.dataset.closeDialog);
});


/* =============================================================
   1. CHAT CUSTOMIZATION
   ============================================================= */

const CHAT_COLORS = [
    { name: "Default", value: null },
    { name: "Sunset",  value: "#ff6b6b" },
    { name: "Ocean",   value: "#3a86ff" },
    { name: "Forest",  value: "#2a9d8f" },
    { name: "Plum",    value: "#9d4edd" },
    { name: "Honey",   value: "#f4a261" },
    { name: "Rose",    value: "#e63946" },
    { name: "Ink",     value: "#1d3557" },
    { name: "Mint",    value: "#06d6a0" },
    { name: "Slate",   value: "#6c757d" },
    { name: "Cocoa",   value: "#7f5539" },
    { name: "Cyan",    value: "#00b4d8" },
    { name: "Coral",   value: "#ff8c61" },
    { name: "Indigo",  value: "#5a189a" }
];

const CHAT_WALLPAPERS = [
    { name: "None",     value: null },
    { name: "Linen",    value: "linear-gradient(180deg, #fafafa 0%, #f0f0f0 100%)" },
    { name: "Sunrise",  value: "linear-gradient(180deg, #ffd6a5 0%, #ffadad 100%)" },
    { name: "Calm",     value: "linear-gradient(180deg, #caf0f8 0%, #ade8f4 100%)" },
    { name: "Spring",   value: "linear-gradient(180deg, #d8f3dc 0%, #b7e4c7 100%)" },
    { name: "Lavender", value: "linear-gradient(180deg, #e0c3fc 0%, #8ec5fc 100%)" },
    { name: "Mocha",    value: "linear-gradient(180deg, #e9d8c4 0%, #c8a78b 100%)" },
    { name: "Night",    value: "linear-gradient(180deg, #2c3e50 0%, #4ca1af 100%)" },
    { name: "Peach",    value: "linear-gradient(180deg, #ffe5ec 0%, #ffc2d1 100%)" }
];

const ChatCustom = {
    chatPrefsCache: new Map(), // chatId -> { accent, bg }

    keyFor(otherUid) {
        const me = state.user?.uid;
        if (!me || !otherUid) return null;
        return [me, otherUid].sort().join("_");
    },

    localKey(chatId) { return `drop:chat-prefs:${chatId}`; },

    load(chatId) {
        if (!chatId) return null;
        if (this.chatPrefsCache.has(chatId)) return this.chatPrefsCache.get(chatId);
        try {
            const raw = localStorage.getItem(this.localKey(chatId));
            if (raw) {
                const v = JSON.parse(raw);
                this.chatPrefsCache.set(chatId, v);
                return v;
            }
        } catch {}
        return null;
    },

    save(chatId, prefs) {
        this.chatPrefsCache.set(chatId, prefs);
        try { localStorage.setItem(this.localKey(chatId), JSON.stringify(prefs)); } catch {}
        // Also persist to Firestore so it follows the user across devices
        const me = state.user?.uid;
        if (me) {
            F.setDoc(F.doc(db, "users", me, "chatPrefs", chatId), {
                ...prefs,
                updatedAt: F.serverTimestamp()
            }, { merge: true }).catch(() => {});
        }
    },

    apply(prefs) {
        const thread = document.getElementById("view-thread");
        if (!thread) return;
        if (!prefs || (!prefs.accent && !prefs.bg)) {
            thread.classList.remove("has-custom");
            thread.style.removeProperty("--chat-accent");
            thread.style.removeProperty("--chat-bg");
            return;
        }
        thread.classList.add("has-custom");
        if (prefs.accent) thread.style.setProperty("--chat-accent", prefs.accent);
        else thread.style.removeProperty("--chat-accent");
        if (prefs.bg) thread.style.setProperty("--chat-bg", prefs.bg);
        else thread.style.removeProperty("--chat-bg");
    },

    // Inject the customize button into the thread header
    injectButton() {
        const header = document.querySelector("#view-thread .thread-header");
        if (!header || header.querySelector(".chat-custom-btn")) return;
        const btn = document.createElement("button");
        btn.className = "chat-custom-btn";
        btn.title = "Customize chat";
        btn.setAttribute("aria-label", "Customize chat");
        btn.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>`;
        btn.addEventListener("click", () => this.openDialog());
        // Insert before the existing profile-link icon if present
        const profileLink = header.querySelector("#thread-profile-link");
        if (profileLink) header.insertBefore(btn, profileLink);
        else header.appendChild(btn);
    },

    selectedColor: null,
    selectedWallpaper: null,

    openDialog() {
        const otherUid = state.threadOtherUid;
        if (!otherUid) { showToast("Open a chat first.", "default"); return; }
        const chatId = this.keyFor(otherUid);
        const current = this.load(chatId) || {};
        this.selectedColor = current.accent ?? null;
        this.selectedWallpaper = current.bg ?? null;
        this.renderColorGrid();
        this.renderWallpaperGrid();
        openDialog("chat-custom-dialog");
    },

    renderColorGrid() {
        const grid = document.getElementById("cc-color-grid");
        if (!grid) return;
        grid.innerHTML = CHAT_COLORS.map((c, i) => {
            const sel = (this.selectedColor === c.value) ? "selected" : "";
            const bg = c.value || "var(--accent)";
            const isDefault = c.value === null ? `<span style="position:absolute;font-size:14px;color:white;text-shadow:0 1px 2px rgba(0,0,0,.5);font-weight:800;display:flex;align-items:center;justify-content:center;width:100%;height:100%;">×</span>` : "";
            return `<div class="cc-swatch ${sel}" data-idx="${i}" style="--swatch:${bg};position:relative;" title="${escapeHtml(c.name)}">${isDefault}</div>`;
        }).join("");
        grid.querySelectorAll(".cc-swatch").forEach(el => {
            el.addEventListener("click", () => {
                this.selectedColor = CHAT_COLORS[+el.dataset.idx].value;
                grid.querySelectorAll(".cc-swatch").forEach(x => x.classList.remove("selected"));
                el.classList.add("selected");
            });
        });
    },

    renderWallpaperGrid() {
        const grid = document.getElementById("cc-wallpaper-grid");
        if (!grid) return;
        grid.innerHTML = CHAT_WALLPAPERS.map((w, i) => {
            const sel = (this.selectedWallpaper === w.value) ? "selected" : "";
            const style = w.value ? `background:${w.value};` : "";
            return `<div class="cc-wallpaper ${sel}" data-idx="${i}" style="${style}"><span class="cc-wallpaper-label">${escapeHtml(w.name)}</span></div>`;
        }).join("");
        grid.querySelectorAll(".cc-wallpaper").forEach(el => {
            el.addEventListener("click", () => {
                this.selectedWallpaper = CHAT_WALLPAPERS[+el.dataset.idx].value;
                grid.querySelectorAll(".cc-wallpaper").forEach(x => x.classList.remove("selected"));
                el.classList.add("selected");
            });
        });
    },

    init() {
        // When the thread view appears, inject the button and apply saved prefs
        const observer = new MutationObserver(() => {
            const view = document.getElementById("view-thread");
            if (!view || view.hidden) return;
            this.injectButton();
            const otherUid = state.threadOtherUid;
            if (!otherUid) return;
            const chatId = this.keyFor(otherUid);
            const prefs = this.load(chatId);
            this.apply(prefs);
        });
        observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });

        _on(document.getElementById("cc-save"), "click", () => {
            const otherUid = state.threadOtherUid;
            if (!otherUid) return;
            const chatId = this.keyFor(otherUid);
            const prefs = { accent: this.selectedColor, bg: this.selectedWallpaper };
            this.save(chatId, prefs);
            this.apply(prefs);
            closeDialog("chat-custom-dialog");
            showToast("Chat customized.");
        });
        _on(document.getElementById("cc-reset"), "click", () => {
            this.selectedColor = null;
            this.selectedWallpaper = null;
            this.renderColorGrid();
            this.renderWallpaperGrid();
        });
    }
};


/* =============================================================
   2. SONGS ON DROPS
   - Preloaded royalty-free library
   - "Add song" pill on capture screen
   - Song badge + tap-to-play on every post that has a song
   ============================================================= */

const SONG_LIBRARY = [
    { id: "sh1", title: "Glassy Currents",  artist: "Drop FM", mood: "chill",  art: ["#5d8aa8", "#1a3a5e"], url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
    { id: "sh2", title: "Soft Gravity",     artist: "Drop FM", mood: "moody",  art: ["#7d5a9b", "#2c1f3d"], url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3" },
    { id: "sh3", title: "Sunday Pavement",  artist: "Drop FM", mood: "happy",  art: ["#f4a261", "#e76f51"], url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3" },
    { id: "sh4", title: "Late Bus Window",  artist: "Drop FM", mood: "moody",  art: ["#264653", "#0f1e2b"], url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3" },
    { id: "sh5", title: "Easy Yellow",      artist: "Drop FM", mood: "happy",  art: ["#ffd166", "#ef9b00"], url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3" },
    { id: "sh6", title: "Pavement Pulse",   artist: "Drop FM", mood: "energy", art: ["#e63946", "#9d0208"], url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3" },
    { id: "sh7", title: "Drift Capsule",    artist: "Drop FM", mood: "chill",  art: ["#06d6a0", "#0a8754"], url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3" },
    { id: "sh8", title: "After Hours Walk", artist: "Drop FM", mood: "moody",  art: ["#3a0ca3", "#100245"], url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3" },
    { id: "sh9", title: "Cold Brew Skip",   artist: "Drop FM", mood: "happy",  art: ["#43aa8b", "#175e54"], url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3" },
    { id: "sh10", title: "Run It Back",     artist: "Drop FM", mood: "energy", art: ["#ff006e", "#8e0049"], url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3" },
    { id: "sh11", title: "Slow Headlights", artist: "Drop FM", mood: "chill",  art: ["#118ab2", "#073b4c"], url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3" },
    { id: "sh12", title: "Last Light",      artist: "Drop FM", mood: "moody",  art: ["#9d4edd", "#3c096c"], url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3" }
];

const Songs = {
    pendingSong: null,        // currently selected for next post
    activeAudio: null,
    activeBadge: null,
    activeRow: null,

    pendingKey: "drop:pending-song",

    loadPending() {
        try {
            const raw = localStorage.getItem(this.pendingKey);
            if (raw) this.pendingSong = JSON.parse(raw);
        } catch {}
    },
    savePending() {
        try {
            if (this.pendingSong) localStorage.setItem(this.pendingKey, JSON.stringify(this.pendingSong));
            else localStorage.removeItem(this.pendingKey);
        } catch {}
    },

    // ----- Add-song pill on the capture screen -----
    injectAddPill() {
        const view = document.getElementById("view-capture");
        if (!view || view.hidden) return;
        const previewBlock = document.getElementById("capture-preview-block");
        if (!previewBlock) return;
        if (previewBlock.querySelector(".add-song-pill")) {
            this.refreshAddPill();
            return;
        }
        previewBlock.style.position = previewBlock.style.position || "relative";
        const pill = document.createElement("button");
        pill.type = "button";
        pill.className = "add-song-pill";
        pill.innerHTML = this.pillHTML();
        pill.addEventListener("click", () => this.openPicker());
        previewBlock.appendChild(pill);
    },

    pillHTML() {
        const s = this.pendingSong;
        const icon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`;
        return `${icon}<span>${s ? escapeHtml(s.title) : "Add song"}</span>`;
    },

    refreshAddPill() {
        const pill = document.querySelector("#capture-preview-block .add-song-pill");
        if (!pill) return;
        pill.innerHTML = this.pillHTML();
        pill.classList.toggle("has-song", !!this.pendingSong);
    },

    // ----- Picker dialog -----
    activeMood: "all",
    activeQuery: "",

    openPicker() {
        this.renderPickerList();
        openDialog("song-picker-dialog");
    },

    filteredSongs() {
        const q = this.activeQuery.trim().toLowerCase();
        return SONG_LIBRARY.filter(s => {
            if (this.activeMood !== "all" && s.mood !== this.activeMood) return false;
            if (q && !(`${s.title} ${s.artist} ${s.mood}`).toLowerCase().includes(q)) return false;
            return true;
        });
    },

    renderPickerList() {
        const list = document.getElementById("song-picker-list");
        if (!list) return;
        const songs = this.filteredSongs();
        if (!songs.length) {
            list.innerHTML = `<li class="recap-empty">No songs match. Try another mood.</li>`;
            return;
        }
        const selectedId = this.pendingSong?.id;
        list.innerHTML = songs.map(s => {
            const sel = (s.id === selectedId) ? "selected" : "";
            const initial = s.title.charAt(0).toUpperCase();
            return `<li class="song-row ${sel}" data-id="${escapeHtml(s.id)}">
                <div class="song-art" style="--art-a:${s.art[0]};--art-b:${s.art[1]}">${escapeHtml(initial)}</div>
                <div class="song-meta">
                    <div class="song-title">${escapeHtml(s.title)}</div>
                    <div class="song-artist">${escapeHtml(s.artist)} · ${escapeHtml(s.mood)}</div>
                </div>
                <button type="button" class="song-play" data-action="play" aria-label="Preview">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
                </button>
            </li>`;
        }).join("");

        list.querySelectorAll(".song-row").forEach(row => {
            const id = row.dataset.id;
            const song = SONG_LIBRARY.find(s => s.id === id);
            row.addEventListener("click", (e) => {
                if (e.target.closest('[data-action="play"]')) {
                    this.previewSong(song, row);
                    return;
                }
                this.selectSong(song);
                list.querySelectorAll(".song-row").forEach(r => r.classList.remove("selected"));
                row.classList.add("selected");
            });
        });
    },

    selectSong(song) {
        this.pendingSong = song;
        this.savePending();
        this.refreshAddPill();
    },

    previewSong(song, row) {
        // Toggle: if same song playing, stop
        if (this.activeAudio && this.activeRow === row) {
            this.stopActive();
            return;
        }
        this.stopActive();
        const audio = new Audio(song.url);
        audio.crossOrigin = "anonymous";
        audio.preload = "metadata";
        audio.play().then(() => {
            row.classList.add("playing");
            this.activeAudio = audio;
            this.activeRow = row;
        }).catch(() => showToast("Couldn't play preview.", "error"));
        audio.onended = () => this.stopActive();
    },

    stopActive() {
        if (this.activeAudio) {
            try { this.activeAudio.pause(); } catch {}
            this.activeAudio = null;
        }
        if (this.activeRow) { this.activeRow.classList.remove("playing"); this.activeRow = null; }
        if (this.activeBadge) { this.activeBadge.classList.remove("playing"); this.activeBadge = null; }
    },

    // ----- Song badge on a rendered post -----
    enhancePostCard(card) {
        if (!card || card.dataset.songEnhanced) return;
        const postId = card.dataset.postId;
        if (!postId) return;
        // Look up song in our cache (filled by Firestore listener) or fetch on demand
        this.fetchPostSong(postId).then(song => {
            if (!song) return;
            card.dataset.songEnhanced = "1";
            const wrap = card.querySelector(".post-image-wrap");
            if (!wrap) return;
            wrap.style.position = wrap.style.position || "relative";
            const badge = document.createElement("button");
            badge.type = "button";
            badge.className = "post-song-badge";
            badge.innerHTML = `
                <span class="psb-disc"></span>
                <span class="psb-text"><strong>${escapeHtml(song.title)}</strong>${escapeHtml(song.artist)}</span>`;
            badge.addEventListener("click", (e) => {
                e.stopPropagation();
                this.toggleBadgePlayback(badge, song);
            });
            wrap.appendChild(badge);
        }).catch(() => {});
    },

    songCache: new Map(),
    fetchedNotFound: new Set(),

    async fetchPostSong(postId) {
        if (this.songCache.has(postId)) return this.songCache.get(postId);
        if (this.fetchedNotFound.has(postId)) return null;
        try {
            const snap = await F.getDoc(F.doc(db, "posts", postId));
            const data = snap.data();
            if (data && data.songId) {
                const song = SONG_LIBRARY.find(s => s.id === data.songId)
                    || { id: data.songId, title: data.songTitle || "Song", artist: data.songArtist || "", url: data.songUrl, art: ["#888", "#444"], mood: "any" };
                this.songCache.set(postId, song);
                return song;
            }
        } catch {}
        this.fetchedNotFound.add(postId);
        return null;
    },

    toggleBadgePlayback(badge, song) {
        if (this.activeAudio && this.activeBadge === badge) {
            this.stopActive();
            return;
        }
        this.stopActive();
        const audio = new Audio(song.url);
        audio.crossOrigin = "anonymous";
        audio.play().then(() => {
            badge.classList.add("playing");
            this.activeAudio = audio;
            this.activeBadge = badge;
        }).catch(() => showToast("Couldn't play song.", "error"));
        audio.onended = () => this.stopActive();
    },

    // ----- Hook the post-publish flow: when our newest post appears, attach the song -----
    watchOwnNewPosts() {
        const me = state.user?.uid;
        if (!me) return;
        let baselineLatest = null;
        const q = F.query(
            F.collection(db, "posts"),
            F.where("uid", "==", me),
            F.orderBy("createdAt", "desc"),
            F.limit(1)
        );
        F.onSnapshot(q, (snap) => {
            if (snap.empty) return;
            const docSnap = snap.docs[0];
            const id = docSnap.id;
            if (baselineLatest === null) { baselineLatest = id; return; }
            if (id === baselineLatest) return;
            baselineLatest = id;
            const data = docSnap.data() || {};
            // If song is pending and not already attached, attach it
            if (this.pendingSong && !data.songId) {
                F.updateDoc(F.doc(db, "posts", id), {
                    songId: this.pendingSong.id,
                    songTitle: this.pendingSong.title,
                    songArtist: this.pendingSong.artist,
                    songUrl: this.pendingSong.url
                }).then(() => {
                    showToast(`🎵 Added "${this.pendingSong.title}" to your drop`);
                    this.pendingSong = null;
                    this.savePending();
                    this.refreshAddPill();
                }).catch(() => {});
            }
        }, () => {});
    },

    init() {
        this.loadPending();

        // Wire picker dialog controls
        _on(document.getElementById("song-search-input"), "input", debounce((e) => {
            this.activeQuery = e.target.value || "";
            this.renderPickerList();
        }, 150));
        document.querySelectorAll(".song-picker-tabs .song-tab").forEach(tab => {
            tab.addEventListener("click", () => {
                document.querySelectorAll(".song-picker-tabs .song-tab").forEach(t => t.classList.remove("active"));
                tab.classList.add("active");
                this.activeMood = tab.dataset.mood;
                this.renderPickerList();
            });
        });
        _on(document.getElementById("song-picker-clear"), "click", () => {
            this.pendingSong = null;
            this.savePending();
            this.refreshAddPill();
            this.renderPickerList();
            showToast("Song removed.");
        });
        _on(document.getElementById("song-picker-done"), "click", () => {
            this.stopActive();
            closeDialog("song-picker-dialog");
        });

        // Watch DOM for new post cards + capture screen
        const obs = new MutationObserver((mutations) => {
            for (const m of mutations) {
                m.addedNodes.forEach(n => {
                    if (!(n instanceof HTMLElement)) return;
                    if (n.matches?.(".post-card")) this.enhancePostCard(n);
                    n.querySelectorAll?.(".post-card").forEach(c => this.enhancePostCard(c));
                });
            }
            // Capture view: re-inject pill if user navigates to it
            const cap = document.getElementById("view-capture");
            if (cap && !cap.hidden) this.injectAddPill();
        });
        obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });

        // Initial scan
        document.querySelectorAll(".post-card").forEach(c => this.enhancePostCard(c));

        // Start listening for our own new posts to attach pending song
        this.watchOwnNewPosts();

        // Stop audio on navigation
        window.addEventListener("hashchange", () => this.stopActive());
    }
};


/* =============================================================
   3. REPLY DROPS — photo replies to a feed drop
   - Adds a "↩ Reply with photo" button to every post card
   - Picks an image, uploads to Cloudinary, creates a new post with replyToPostId
   - Replies show a banner: "in reply to @user's drop"
   ============================================================= */

const ReplyDrops = {
    enhancePostCard(card) {
        if (!card || card.dataset.replyDropEnhanced) return;
        const postId = card.dataset.postId;
        if (!postId) return;
        card.dataset.replyDropEnhanced = "1";

        const actions = card.querySelector(".post-actions");
        if (actions && !actions.querySelector(".reply-drop-btn")) {
            const btn = document.createElement("button");
            btn.className = "reply-drop-btn";
            btn.type = "button";
            btn.title = "Reply with a photo";
            btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg> Reply`;
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                this.triggerReply(postId, card);
            });
            actions.appendChild(btn);
        }

        // If this card itself is a reply, render a banner
        this.maybeRenderReplyBanner(card, postId);
    },

    async maybeRenderReplyBanner(card, postId) {
        try {
            const snap = await F.getDoc(F.doc(db, "posts", postId));
            const data = snap.data();
            if (!data || !data.replyToPostId) return;
            const parentSnap = await F.getDoc(F.doc(db, "posts", data.replyToPostId));
            const parent = parentSnap.data();
            if (!parent) return;
            if (card.querySelector(".reply-drop-banner")) return;
            const banner = document.createElement("div");
            banner.className = "reply-drop-banner";
            const thumb = parent.imageUrl || (parent.images && parent.images[0]) || "";
            banner.innerHTML = `${thumb ? `<img class="rdb-thumb" src="${escapeHtml(thumb)}" alt="" />` : ""} ↩ in reply to <strong style="margin-left:4px;">@${escapeHtml(parent.username || "user")}</strong>`;
            const header = card.querySelector(".post-header");
            if (header) header.parentNode.insertBefore(banner, header);
            else card.prepend(banner);
            card.classList.add("reply-drop");
        } catch {}
    },

    pendingFile: null,
    pendingParent: null,

    async triggerReply(postId, card) {
        this.pendingParent = postId;
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.style.display = "none";
        document.body.appendChild(input);
        input.addEventListener("change", async () => {
            const file = input.files?.[0];
            input.remove();
            if (!file) return;
            await this.uploadAndPost(file, postId);
        }, { once: true });
        input.click();
    },

    async uploadAndPost(file, parentPostId) {
        if (!state.user?.uid) { showToast("Please sign in.", "error"); return; }
        showToast("Uploading reply…");
        try {
            const url = await uploadToCloudinary(file);
            // Look up parent post for context (prompt + author)
            const parentSnap = await F.getDoc(F.doc(db, "posts", parentPostId));
            const parent = parentSnap.data() || {};
            const newDoc = {
                uid: state.user.uid,
                username: state.profile?.username || "user",
                imageUrl: url,
                images: [url],
                caption: `↩ Reply to @${parent.username || "user"}`,
                promptText: parent.promptText || "",
                promptDate: parent.promptDate || todayKey(),
                createdAt: F.serverTimestamp(),
                isOnTime: false,
                isReplyDrop: true,
                replyToPostId: parentPostId,
                replyToUid: parent.uid || null,
                replyToUsername: parent.username || null,
                likes: 0,
                likedBy: [],
                commentsCount: 0
            };
            const ref = await F.addDoc(F.collection(db, "posts"), newDoc);
            // Notify parent author
            if (parent.uid && parent.uid !== state.user.uid) {
                await F.addDoc(F.collection(db, "users", parent.uid, "notifications"), {
                    type: "reply_drop",
                    fromUid: state.user.uid,
                    fromUsername: state.profile?.username || "user",
                    postId: ref.id,
                    parentPostId,
                    createdAt: F.serverTimestamp(),
                    seen: false
                }).catch(() => {});
            }
            showToast("Reply drop posted!");
        } catch (e) {
            console.error(e);
            showToast("Couldn't post reply.", "error");
        }
    },

    init() {
        const obs = new MutationObserver((mutations) => {
            for (const m of mutations) {
                m.addedNodes.forEach(n => {
                    if (!(n instanceof HTMLElement)) return;
                    if (n.matches?.(".post-card")) this.enhancePostCard(n);
                    n.querySelectorAll?.(".post-card").forEach(c => this.enhancePostCard(c));
                });
            }
        });
        obs.observe(document.body, { childList: true, subtree: true });
        document.querySelectorAll(".post-card").forEach(c => this.enhancePostCard(c));
    }
};


/* =============================================================
   4. STREAK SHIELDS
   - Stored on user profile: shields (number), shieldsLastEarned (date string)
   - Earn 1 shield each time the user completes a 14-day run
   - Display next to streak pill: 🛡 ×N
   - Auto-applies a shield when user posts after missing exactly 1 day
     (this part requires you to grant the field; see TODO note)
   ============================================================= */

const Shields = {
    cache: { shields: 0, shieldsLastEarned: null },

    async load() {
        const me = state.user?.uid;
        if (!me) return;
        try {
            const snap = await F.getDoc(F.doc(db, "users", me));
            const data = snap.data() || {};
            this.cache.shields = data.shields || 0;
            this.cache.shieldsLastEarned = data.shieldsLastEarned || null;
            this.maybeEarn(data);
            this.render();
        } catch {}
    },

    async maybeEarn(profile) {
        const streak = profile?.streak || state.profile?.streak || 0;
        if (!streak || streak < 14) return;
        // Earn 1 shield every full multiple of 14, but only once per multiple
        const targetTier = Math.floor(streak / 14);
        const lastTier = profile.shieldsTier || 0;
        if (targetTier > lastTier) {
            const me = state.user?.uid;
            if (!me) return;
            try {
                await F.updateDoc(F.doc(db, "users", me), {
                    shields: F.increment(targetTier - lastTier),
                    shieldsTier: targetTier,
                    shieldsLastEarned: todayKey()
                });
                this.cache.shields += (targetTier - lastTier);
                showToast(`🛡 You earned a streak shield! (${this.cache.shields} total)`);
                this.render();
            } catch {}
        }
    },

    render() {
        // Find the streak pill in the UI and append a shield count next to it
        const targets = document.querySelectorAll(
            "[data-streak-pill], .streak-pill, .streak-display, #streak-count, .home-streak"
        );
        const count = this.cache.shields || 0;
        // Remove any old shield pills first
        document.querySelectorAll(".streak-shield-pill").forEach(p => p.remove());
        if (count <= 0) return;
        targets.forEach(el => {
            const pill = document.createElement("span");
            pill.className = "streak-shield-pill";
            pill.title = `You have ${count} streak shield${count === 1 ? "" : "s"}. They auto-protect a missed day.`;
            pill.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3z"/></svg><span class="ssp-count">×${count}</span>`;
            el.appendChild(pill);
        });
    },

    init() {
        // Try a few times because the streak UI may render after auth resolves
        const tryRender = () => this.render();
        if (state.user?.uid) this.load();
        // Re-poll periodically
        let tries = 0;
        const interval = setInterval(() => {
            tries++;
            if (state.user?.uid && this.cache.shields === 0 && tries < 6) this.load();
            tryRender();
            if (tries > 20) clearInterval(interval);
        }, 2000);
    }
};


/* =============================================================
   5. MONTHLY "Year-in-Drops" RECAP
   - Adds a recap trigger to settings/profile
   - Pulls user's posts for the month
   - Renders a 9-grid shareable card, exports PNG via html2canvas
   ============================================================= */

const Recap = {
    monthOffset: 0, // 0 = this month, -1 = previous, etc.

    monthBounds(offset = 0) {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
        const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1);
        return { start, end, label: start.toLocaleString(undefined, { month: "long", year: "numeric" }) };
    },

    async fetchMonth(offset = 0) {
        const me = state.user?.uid;
        if (!me) return { posts: [], totalLikes: 0 };
        const { start, end } = this.monthBounds(offset);
        const startKey = todayKey(start);
        const endKey = todayKey(new Date(end.getTime() - 86400000));
        try {
            const q = F.query(
                F.collection(db, "posts"),
                F.where("uid", "==", me),
                F.where("promptDate", ">=", startKey),
                F.where("promptDate", "<=", endKey)
            );
            const snap = await F.getDocs(q);
            const posts = [];
            let totalLikes = 0;
            snap.forEach(d => {
                const data = d.data() || {};
                posts.push({ id: d.id, ...data });
                totalLikes += data.likes || 0;
            });
            return { posts, totalLikes };
        } catch (e) {
            return { posts: [], totalLikes: 0 };
        }
    },

    async render() {
        const stage = document.getElementById("recap-stage");
        if (!stage) return;
        stage.innerHTML = `<div class="recap-empty">Loading your drops…</div>`;
        const { label } = this.monthBounds(this.monthOffset);
        document.getElementById("recap-title").textContent = `Your ${label}`;
        const { posts, totalLikes } = await this.fetchMonth(this.monthOffset);
        if (!posts.length) {
            stage.innerHTML = `<div class="recap-empty">No drops in ${escapeHtml(label)}.</div>`;
            return;
        }
        // Build 9 cells (most recent 9)
        const sorted = posts.slice().sort((a, b) => {
            const ta = a.createdAt?.toMillis?.() || 0;
            const tb = b.createdAt?.toMillis?.() || 0;
            return tb - ta;
        });
        const cells = [];
        for (let i = 0; i < 9; i++) {
            const p = sorted[i];
            if (p) {
                const url = p.imageUrl || (p.images && p.images[0]) || "";
                cells.push(`<div class="rc-cell" style="background-image:url('${escapeHtml(url)}');"></div>`);
            } else {
                cells.push(`<div class="rc-cell"></div>`);
            }
        }
        const card = `
            <div class="recap-card" id="recap-card-render">
                <div class="rc-header">
                    <span class="rc-month">${escapeHtml(label)}</span>
                    <span class="rc-brand">DROP</span>
                </div>
                <div class="rc-title">${posts.length} drop${posts.length === 1 ? "" : "s"} in your month</div>
                <div class="rc-grid">${cells.join("")}</div>
                <div class="rc-stats">
                    <div class="rc-stat">
                        <span class="rc-stat-num">${posts.length}</span>
                        <span class="rc-stat-label">drops</span>
                    </div>
                    <div class="rc-stat">
                        <span class="rc-stat-num">${totalLikes}</span>
                        <span class="rc-stat-label">likes</span>
                    </div>
                    <div class="rc-stat">
                        <span class="rc-stat-num">${posts.filter(p => p.isOnTime).length}</span>
                        <span class="rc-stat-label">on time</span>
                    </div>
                </div>
            </div>`;
        stage.innerHTML = card;
    },

    async saveImage() {
        const card = document.getElementById("recap-card-render");
        if (!card || typeof window.html2canvas !== "function") {
            showToast("Image rendering not available.", "error");
            return;
        }
        try {
            const canvas = await window.html2canvas(card, { useCORS: true, backgroundColor: null, scale: 2 });
            const url = canvas.toDataURL("image/png");
            const a = document.createElement("a");
            const { label } = this.monthBounds(this.monthOffset);
            a.download = `drop-recap-${label.replace(/\s+/g, "-").toLowerCase()}.png`;
            a.href = url;
            document.body.appendChild(a);
            a.click();
            a.remove();
            showToast("Saved!");
        } catch (e) {
            console.error(e);
            showToast("Couldn't save image.", "error");
        }
    },

    injectTrigger() {
        // Try to attach to the profile/settings view
        const candidates = document.querySelectorAll("#view-profile, #view-settings, .profile-content, .settings-content");
        candidates.forEach(target => {
            if (!target || target.querySelector(".recap-trigger")) return;
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "recap-trigger";
            btn.innerHTML = `
                <span class="rt-icon">✨</span>
                <span class="rt-meta">
                    <span class="rt-title">Your month in drops</span>
                    <span class="rt-sub">A shareable recap of this month</span>
                </span>`;
            btn.addEventListener("click", () => {
                this.monthOffset = 0;
                this.render();
                openDialog("monthly-recap-dialog");
            });
            target.prepend(btn);
        });
    },

    init() {
        _on(document.getElementById("recap-save"), "click", () => this.saveImage());
        _on(document.getElementById("recap-month-prev"), "click", () => { this.monthOffset--; this.render(); });
        _on(document.getElementById("recap-month-next"), "click", () => { if (this.monthOffset < 0) { this.monthOffset++; this.render(); } });

        const obs = new MutationObserver(() => this.injectTrigger());
        obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });
        this.injectTrigger();
    }
};


/* =============================================================
   BOOT
   ============================================================= */

ChatCustom.init();
Songs.init();
ReplyDrops.init();
Shields.init();
Recap.init();

console.log("[features] loaded — chat themes, songs, reply drops, shields, recap");


