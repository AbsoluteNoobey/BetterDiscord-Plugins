/**
 * @name NoIdleKick
 * @author AbsoluteNoobey
 * @version 1.0.0
 * @description Prevents Discord from auto-disconnecting you when alone in a voice/DM call.
 * @source https://github.com/AbsoluteNoobey/BetterDiscord-Plugins/blob/main/NoIdleKick/NoIdleKick.plugin.js
 * @website https://github.com/AbsoluteNoobey/BetterDiscord-Plugins
 */

module.exports = class NoIdleKick {
    constructor() {
        this.patches = [];
        this.lastActivity = Date.now();
        this._onUserActivity = () => { this.lastActivity = Date.now(); };
    }

    start() {
        const { Webpack, Patcher } = BdApi;

        window.addEventListener("click", this._onUserActivity, true);
        window.addEventListener("keydown", this._onUserActivity, true);

        const AUTO_KICK_MODULE = "167132";
        const LONG_IDLE_THRESHOLD_MS = 60000;
        const ACTIVITY_THRESHOLD_MS = 500;

        const Dispatcher = Webpack.getModule(
            m => typeof m?.dispatch === "function"
              && typeof m?.subscribe === "function"
              && typeof m?.register === "function",
            { searchExports: true }
        );

        if (Dispatcher) {
            const unpatchDispatch = Patcher.before("NoIdleKick", Dispatcher, "dispatch", (_, args) => {
                const action = args?.[0];
                if (!action?.type) return;
                if (action.type === "MESSAGE_CREATE" && action.message?.author?.id === "1") {
                    const stack = new Error().stack || "";
                    const idleFor = Date.now() - this.lastActivity;
                    if (stack.includes(AUTO_KICK_MODULE) || idleFor > LONG_IDLE_THRESHOLD_MS) {
                        args[0] = { type: "NO_OP_NOIDLEKICK" };
                    }
                }
            });
            this.patches.push(unpatchDispatch);
        }

        const VoiceActions = Webpack.getModule(
            m => typeof m?.selectVoiceChannel === "function",
            { searchExports: true }
        );

        if (!VoiceActions || typeof VoiceActions.selectVoiceChannel !== "function") {
            BdApi.UI.showToast("NoIdleKick: couldn't find selectVoiceChannel", { type: "error" });
            return;
        }

        const unpatchSelect = Patcher.instead(
            "NoIdleKick",
            VoiceActions,
            "selectVoiceChannel",
            (thisObj, args, originalFunc) => {
                if (args[0] === null) {
                    const stack = new Error().stack || "";
                    const idleFor = Date.now() - this.lastActivity;
                    if (stack.includes(AUTO_KICK_MODULE) || idleFor > ACTIVITY_THRESHOLD_MS) {
                        return;
                    }
                }
                return originalFunc.apply(thisObj, args);
            }
        );
        this.patches.push(unpatchSelect);
    }

    stop() {
        window.removeEventListener("click", this._onUserActivity, true);
        window.removeEventListener("keydown", this._onUserActivity, true);
        for (const unpatch of this.patches) { try { unpatch(); } catch {} }
        this.patches = [];
        BdApi.Patcher.unpatchAll("NoIdleKick");
    }
};
