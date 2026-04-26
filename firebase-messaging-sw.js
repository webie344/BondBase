/* =============================================================
   Drop — Firebase Messaging Service Worker
   -------------------------------------------------------------
   This file MUST sit at the root of your site (same folder as
   index.html) and MUST be named exactly firebase-messaging-sw.js
   — both rules are set by the browser and Firebase, not by us.

   It runs in the background even when your tab is closed and is
   what allows users to receive notifications when they're not
   on the site.

   You should not need to edit this file again. The only thing
   that must match your app is the firebaseConfig block below.
   ============================================================= */

importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js");

firebase.initializeApp({
    apiKey: "AIzaSyC9jF-ocy6HjsVzWVVlAyXW-4aIFgA79-A",
    authDomain: "crypto-6517d.firebaseapp.com",
    projectId: "crypto-6517d",
    storageBucket: "crypto-6517d.firebasestorage.app",
    messagingSenderId: "60263975159",
    appId: "1:60263975159:web:bd53dcaad86d6ed9592bf2"
});

const messaging = firebase.messaging();

// Background messages: this fires when a push arrives and the site
// is closed or in another tab. We show a real OS-level notification.
messaging.onBackgroundMessage((payload) => {
    const n = payload?.notification || {};
    const data = payload?.data || {};
    const title = n.title || data.title || "Drop";
    const options = {
        body: n.body || data.body || "",
        icon: n.icon || "/icon-192.png",
        badge: "/icon-192.png",
        tag: data.tag || "drop-notification",
        data: { url: data.url || "/" }
    };
    self.registration.showNotification(title, options);
});

// When the user taps the notification, focus an existing tab if open,
// otherwise open a new one at the URL we attached.
self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const targetUrl = event.notification?.data?.url || "/";
    event.waitUntil(
        clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
            for (const w of wins) {
                if ("focus" in w) { w.navigate(targetUrl); return w.focus(); }
            }
            if (clients.openWindow) return clients.openWindow(targetUrl);
        })
    );
});


