/* =============================================================================
   drop/telegram.js  —  Optional Telegram bot connector
   -----------------------------------------------------------------------------
   Talks to your Cloudflare Worker (so the bot token never lives in the
   browser). Lets the user link their Telegram account by sending a short
   code to the bot, then the worker fans out notifications to that chat.
   ============================================================================= */

let _config = { workerUrl: "", botUsername: "" };

export const Telegram = {
    configure({ workerUrl, botUsername }) {
        _config.workerUrl   = (workerUrl || "").replace(/\/+$/, "");
        _config.botUsername = botUsername || "";
    },
    isConfigured() {
        return !!(_config.workerUrl && _config.botUsername);
    },
    /**
     * Begin the link flow.
     * Returns { code, botLink } — show the link to the user and start polling.
     */
    async startLink(uid) {
        if (!this.isConfigured()) throw new Error("Telegram is not configured.");
        const r = await fetch(_config.workerUrl + "/telegram/start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ uid })
        });
        const data = await r.json();
        if (!r.ok || data.error) throw new Error(data.error || "Could not start Telegram link.");
        return data; // { code, botLink }
    },
    /** Poll the worker every 3s for up to 5 minutes. Resolves true on success. */
    async waitForLink(uid, code, { timeoutMs = 5 * 60 * 1000 } = {}) {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            try {
                const r = await fetch(_config.workerUrl + "/telegram/check", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ uid, code })
                });
                const data = await r.json();
                if (data.ok) return true;
            } catch { /* keep polling */ }
            await new Promise(res => setTimeout(res, 3000));
        }
        return false;
    },
    async disconnect(uid) {
        if (!_config.workerUrl) return;
        await fetch(_config.workerUrl + "/telegram/disconnect", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ uid })
        }).catch(() => {});
    }
};


