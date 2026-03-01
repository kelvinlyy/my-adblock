// ============================================================
// My AdBlock — popup-stats.js
// Loads and renders stats from the background service worker.
// Depends on: popup-ui.js (formatNumber)
// ============================================================

// ---------------------
// DOM references
// ---------------------
const sessionCountEl = document.getElementById("sessionCount");
const allTimeCountEl = document.getElementById("allTimeCount");
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
        const stats = await browser.runtime.sendMessage({ type: "getStats" });
        sessionCountEl.textContent = formatNumber(stats.sessionBlocked || 0);
        allTimeCountEl.textContent = formatNumber(stats.allTimeBlocked || 0);
        currentBlockedRequests = stats.blockedRequests || [];
        renderBlockedList(currentBlockedRequests);
    } catch (e) {
        console.error("Failed to load stats:", e);
    }

    try {
        const counts = await browser.runtime.sendMessage({ type: "getRuleCounts" });
        ruleCountEl.textContent = formatNumber(counts.total || 0);
    } catch (e) {
        console.error("Failed to load rule counts:", e);
    }
}
