
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

/** Increment the all-time blocked count by 1 (batched to avoid race conditions). */
let _pendingIncrements = 0;
let _flushTimer = null;

function incrementAllTimeBlockedCount() {
    _pendingIncrements++;
    if (!_flushTimer) {
        _flushTimer = setTimeout(_flushBlockedCount, 1000);
    }
}

async function _flushBlockedCount() {
    _flushTimer = null;
    const delta = _pendingIncrements;
    _pendingIncrements = 0;
    if (delta <= 0) return;

    try {
        const data = await browser.storage.local.get({ [STORAGE_KEY_ALL_TIME]: 0 });
        await browser.storage.local.set({ [STORAGE_KEY_ALL_TIME]: (data[STORAGE_KEY_ALL_TIME] || 0) + delta });
    } catch (e) {
        console.warn("[My AdBlock] Failed to flush blocked count:", e.message);
    }
}
