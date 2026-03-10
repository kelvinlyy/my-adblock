// ============================================================
// My AdBlock — background.js
// Message router & initialisation.
// Modules loaded before this file (via manifest.json background.scripts):
//   storage.js, dnr.js, easylist-parser.js, rule-manager.js,
//   session-tracker.js, context-menu.js
// ============================================================

// ---------------------
// Message handler (popup + content script ↔ background)
// ---------------------
browser.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
    switch (message.type) {
        case "reportBlocked":
            recordBlocked(message.url, message.matchedRule, message.ruleType, message.pageHostname, _sender.tab?.id);
            return Promise.resolve({ ok: true });

        case "getBlocklist":
            return getStoredCustomRules().then((custom) => ({
                customRules: custom.map((r) => ({ ruleType: r.ruleType, value: r.value })),
            }));

        case "getStats":
            return Promise.resolve(getSessionStats(message.tabId));

        case "clearSession":
            clearSession();
            return Promise.resolve({ success: true });

        case "getCustomRules":
            return getCustomRulesPaginated(message.page || 1, message.pageSize || 50, message.search || "");

        case "addCustomRule":
            return addCustomRule(message.ruleType, message.value);

        case "removeCustomRule":
            return removeCustomRule(message.ruleId);

        case "getRuleCounts":
            return getRuleCounts();

        case "exportRules":
            return exportRules();

        case "downloadExport":
            return (async () => {
                try {
                    const resp = await browser.runtime.sendNativeMessage("application.id", {
                        action: "exportRules",
                        json: message.text,
                        filename: message.filename,
                    });
                    return resp;
                } catch (e) {
                    return { error: e.message };
                }
            })();

        case "importRulesBatch":
            return importRulesBatch(message.rules);

        case "importFinalize":
            return importFinalize();

        case "clearAllRules":
            return clearAllRules();

        default:
            return Promise.resolve({ error: "Unknown message type" });
    }
});

// ---------------------
// Restore dynamic rules on startup
// ---------------------
async function restoreDynamicRules() {
    await syncAllDnrRules();
}

restoreDynamicRules();
console.log("[My AdBlock] Background service worker loaded.");
