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
            recordBlocked(message.url, message.matchedRule, message.ruleType);
            return Promise.resolve({ ok: true });

        case "getBlocklist":
            return getStoredCustomRules().then((custom) => ({
                customRules: custom.map((r) => ({ ruleType: r.ruleType, value: r.value })),
            }));

        case "getStats":
            return getAllTimeBlockedCount().then((allTime) => ({
                ...getSessionStats(),
                allTimeBlocked: allTime,
            }));

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
    const customRules = await getStoredCustomRules();

    if (customRules.length === 0) return;

    await clearAllDnrRules();

    const toRegister = customRules.slice(0, MAX_DYNAMIC_RULES);
    const dnrRules = toRegister.map((r) => buildDnrRule(r.id, r.urlFilter));
    const registered = await batchRegisterDnrRules(dnrRules);

    // Update dnrRegistered flags
    let changed = false;
    const registeredIds = new Set(toRegister.slice(0, registered).map((r) => r.id));
    for (const rule of customRules) {
        const shouldBe = registeredIds.has(rule.id);
        if (rule.dnrRegistered !== shouldBe) {
            rule.dnrRegistered = shouldBe;
            changed = true;
        }
    }
    if (changed) {
        await saveCustomRules(customRules);
    }
}

restoreDynamicRules();
console.log("[My AdBlock] Background service worker loaded.");
