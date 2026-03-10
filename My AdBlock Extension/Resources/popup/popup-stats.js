// ============================================================
// My AdBlock — popup-stats.js
// Loads and renders stats from the background service worker.
// Depends on: popup-ui.js (formatNumber)
// ============================================================

// ---------------------
// DOM references
// ---------------------
const siteCountEl = document.getElementById("siteCount");
const sessionCountEl = document.getElementById("sessionCount");
const ruleCountEl = document.getElementById("ruleCount");

// ---------------------
// State
// ---------------------
let currentBlockedRequests = [];

// ---------------------
// Load stats from background
// ---------------------

async function loadStats() {
    try {
        let tabId = null;
        try {
            const tabs = await browser.tabs.query({ active: true, currentWindow: true });
            if (tabs[0]?.id) {
                tabId = tabs[0].id;
            }
        } catch (_) {}

        const stats = await browser.runtime.sendMessage({ type: "getStats", tabId });
        siteCountEl.textContent = formatNumber(stats.siteBlocked || 0);
        sessionCountEl.textContent = formatNumber(stats.sessionBlocked || 0);
        currentBlockedRequests = stats.blockedRequests || [];
        renderBlockedList(currentBlockedRequests);
    } catch (e) {
        console.error("[My AdBlock] Failed to load stats:", e);
    }

    try {
        const counts = await browser.runtime.sendMessage({ type: "getRuleCounts" });
        ruleCountEl.textContent = formatNumber(counts.total || 0);
    } catch (e) {
        console.error("[My AdBlock] Failed to load rule counts:", e);
    }
}
