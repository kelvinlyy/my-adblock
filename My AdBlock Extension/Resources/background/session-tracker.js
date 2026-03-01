// ============================================================
// My AdBlock — session-tracker.js
// Tracks blocked requests within the current session.
// Depends on: storage.js (incrementAllTimeBlockedCount)
// ============================================================

// ---------------------
// Constants
// ---------------------
const SESSION_LOG_MAX = 5000;
const SESSION_LOG_TRIM = 4000;

// ---------------------
// Session state
// ---------------------
let sessionBlockedCount = 0;
let sessionBlockedRequests = []; // { url, timestamp, matchedRule, ruleType }

// ---------------------
// Dedup — avoid double-counting the same URL on the same page
// ---------------------
const recentlyLogged = new Set();
const DEDUP_TTL_MS = 2000;

function dedup(url) {
    if (recentlyLogged.has(url)) return false;
    recentlyLogged.add(url);
    setTimeout(() => recentlyLogged.delete(url), DEDUP_TTL_MS);
    return true;
}

// ---------------------
// Record a blocked request (called when content.js reports one)
// ---------------------
function recordBlocked(url, matchedRule, ruleType) {
    if (!dedup(url)) return;

    sessionBlockedCount++;
    sessionBlockedRequests.push({ url, timestamp: Date.now(), matchedRule, ruleType });

    // Cap session log to prevent unbounded growth
    if (sessionBlockedRequests.length > SESSION_LOG_MAX) {
        sessionBlockedRequests = sessionBlockedRequests.slice(-SESSION_LOG_TRIM);
    }

    incrementAllTimeBlockedCount();
}

// ---------------------
// Session accessors
// ---------------------

function getSessionStats() {
    return {
        sessionBlocked: sessionBlockedCount,
        blockedRequests: sessionBlockedRequests.slice(-500),
    };
}

function clearSession() {
    sessionBlockedCount = 0;
    sessionBlockedRequests = [];
}
