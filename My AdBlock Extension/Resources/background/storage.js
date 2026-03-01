// ============================================================
// My AdBlock — storage.js
// Storage helpers for reading/writing custom rules.
// ============================================================

// ---------------------
// Constants
// ---------------------
const STORAGE_KEY_ALL_TIME = "allTimeBlockedCount";
const STORAGE_KEY_CUSTOM_RULES = "customRules";

// ---------------------
// Storage helpers
// ---------------------

/** Read custom rules from storage (returns array). */
async function getStoredCustomRules() {
    const data = await browser.storage.local.get({ [STORAGE_KEY_CUSTOM_RULES]: [] });
    return data[STORAGE_KEY_CUSTOM_RULES] || [];
}

/** Persist custom rules to storage. */
async function saveCustomRules(rules) {
    try {
        await browser.storage.local.set({ [STORAGE_KEY_CUSTOM_RULES]: rules });
    } catch (e) {
        console.error("[My AdBlock] Failed to save rules:", e.message);
        throw e;
    }
}

/** Read the all-time blocked count. */
async function getAllTimeBlockedCount() {
    const data = await browser.storage.local.get({ [STORAGE_KEY_ALL_TIME]: 0 });
    return data[STORAGE_KEY_ALL_TIME] || 0;
}

/** Increment the all-time blocked count by 1. */
function incrementAllTimeBlockedCount() {
    browser.storage.local.get({ [STORAGE_KEY_ALL_TIME]: 0 }).then((data) => {
        browser.storage.local.set({ [STORAGE_KEY_ALL_TIME]: (data[STORAGE_KEY_ALL_TIME] || 0) + 1 });
    });
}
