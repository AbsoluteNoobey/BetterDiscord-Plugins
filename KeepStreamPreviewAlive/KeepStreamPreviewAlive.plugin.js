/**
 * @name KeepStreamPreviewAlive
 * @author AbsoluteNoobey
 * @version 1.0.0
 * @description Stops Discord hiding your stream preview when Discord is no longer focused
 * @source https://github.com/AbsoluteNoobey/BetterDiscord-Plugins/blob/main/KeepStreamPreviewAlive/KeepStreamPreviewAlive.plugin.js
 * @website https://github.com/AbsoluteNoobey/BetterDiscord-Plugins
 */

module.exports = class KeepStreamPreviewAlive {
    constructor() {
        this.PATCH_ID = "KeepStreamPreviewAlive";
        this.spoofing = false;
        this.observer = null;
        this.playInterval = null;
        this.swallow = e => e.stopImmediatePropagation();
        this.streamingStore = null;
        this.windowStore = null;
        this.userStore = null;
        this.onStoreChange = () => this.evaluate();
    }

    start() {
        try {
            this.streamingStore = BdApi.Webpack.getStore("ApplicationStreamingStore");
            this.windowStore = BdApi.Webpack.getStore("WindowStore");
            this.userStore = BdApi.Webpack.getStore("UserStore");
        } catch (_) {}

        this.streamingStore?.addChangeListener?.(this.onStoreChange);

        this.observer = new MutationObserver(this.onStoreChange);
        this.observer.observe(document.body, { childList: true, subtree: true });

        this.evaluate();
    }

    stop() {
        this.streamingStore?.removeChangeListener?.(this.onStoreChange);
        this.observer?.disconnect();
        this.observer = null;
        this.disable();
    }

    isStreaming() {
        const s = this.streamingStore;
        if (s) {
            try {
                if (typeof s.getCurrentUserActiveStream === "function" && s.getCurrentUserActiveStream()) return true;
                const me = this.userStore?.getCurrentUser?.();
                if (me && typeof s.getActiveStreamForUser === "function" && s.getActiveStreamForUser(me.id)) return true;
            } catch (_) {}
        }
        return !!document.querySelector(
            '[class*="previewContainer"] video, [class*="tileVideo"] video, [class*="streamPreview"] video'
        );
    }

    evaluate() {
        const live = this.isStreaming();
        if (live && !this.spoofing) this.enable();
        else if (!live && this.spoofing) this.disable();
    }

    enable() {
        this.spoofing = true;

        Object.defineProperty(document, "hidden",          { value: false,     configurable: true });
        Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });

        window.addEventListener("blur",             this.swallow, true);
        window.addEventListener("visibilitychange", this.swallow, true);
        document.addEventListener("visibilitychange", this.swallow, true);

        try {
            if (this.windowStore) {
                if (typeof this.windowStore.isFocused === "function") {
                    BdApi.Patcher.instead(this.PATCH_ID, this.windowStore, "isFocused", () => true);
                }
                if (typeof this.windowStore.isVisible === "function") {
                    BdApi.Patcher.instead(this.PATCH_ID, this.windowStore, "isVisible", () => true);
                }
            }
        } catch (_) {}

        window.dispatchEvent(new Event("focus"));

        this.playInterval = setInterval(() => {
            document.querySelectorAll(
                '[class*="previewContainer"] video, [class*="tileVideo"] video, [class*="streamPreview"] video, [class*="tile"] video'
            ).forEach(v => { if (v.paused) v.play().catch(() => {}); });
        }, 1000);
    }

    disable() {
        if (!this.spoofing) return;
        this.spoofing = false;

        try { BdApi.Patcher.unpatchAll(this.PATCH_ID); } catch (_) {}

        window.removeEventListener("blur",             this.swallow, true);
        window.removeEventListener("visibilitychange", this.swallow, true);
        document.removeEventListener("visibilitychange", this.swallow, true);

        clearInterval(this.playInterval);
        this.playInterval = null;

        delete document.hidden;
        delete document.visibilityState;

        document.dispatchEvent(new Event("visibilitychange"));
        if (!document.hasFocus()) window.dispatchEvent(new Event("blur"));
    }
};
