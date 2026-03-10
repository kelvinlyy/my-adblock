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
let sessionBlockedRequests = []; // { url, timestamp, matchedRule, ruleType, tabId }

// Per-tab blocked counts for current page load — reset when tab navigates
const tabBlockedCounts = new Map(); // tabId → count

// Per-tab session counts — persist across navigations, cleared on tab close
const tabSessionCounts = new Map(); // tabId → count

// ---------------------
// Dedup — avoid double-counting the same URL on the same page
// ---------------------
const recentlyLogged = new Map(); // url → timestamp
const DEDUP_TTL_MS = 2000;
const DEDUP_CLEANUP_INTERVAL_MS = 10000;

function dedup(url) {
    const now = Date.now();
    const prev = recentlyLogged.get(url);
    if (prev && now - prev < DEDUP_TTL_MS) return false;
    recentlyLogged.set(url, now);
    return true;
}

// Periodic cleanup instead of per-entry setTimeout
setInterval(() => {
    const cutoff = Date.now() - DEDUP_TTL_MS;
    for (const [url, ts] of recentlyLogged) {
        if (ts < cutoff) recentlyLogged.delete(url);
    }
}, DEDUP_CLEANUP_INTERVAL_MS);

// ---------------------
// Record a blocked request (called when content.js reports one)
// ---------------------
function recordBlocked(url, matchedRule, ruleType, pageHostname, tabId) {
    if (!dedup(url)) return;

    sessionBlockedRequests.push({ url, timestamp: Date.now(), matchedRule, ruleType, tabId });

    // Track per-tab counts
    if (tabId != null) {
        tabBlockedCounts.set(tabId, (tabBlockedCounts.get(tabId) || 0) + 1);
        tabSessionCounts.set(tabId, (tabSessionCounts.get(tabId) || 0) + 1);
    }

    // Cap session log to prevent unbounded growth
    if (sessionBlockedRequests.length > SESSION_LOG_MAX) {
        sessionBlockedRequests = sessionBlockedRequests.slice(-SESSION_LOG_TRIM);
    }

    incrementAllTimeBlockedCount();
}

// ---------------------
// Reset tab count on navigation
// ---------------------
try {
    browser.webNavigation.onCommitted.addListener((details) => {
        if (details.frameId === 0) {
            tabBlockedCounts.delete(details.tabId);
        }
    });
} catch (_) {
    // webNavigation may not be available
}

// Clean up when tab is closed
try {
    browser.tabs.onRemoved.addListener((tabId) => {
        tabBlockedCounts.delete(tabId);
        tabSessionCounts.delete(tabId);
    });
} catch (_) {}

// ---------------------
// Session accessors
// ---------------------

function getSessionStats(tabId) {
    return {
        sessionBlocked: tabId != null ? (tabSessionCounts.get(tabId) || 0) : 0,
        siteBlocked: tabId != null ? (tabBlockedCounts.get(tabId) || 0) : 0,
        blockedRequests: sessionBlockedRequests.slice(-500),
    };
}

function clearSession() {
    sessionBlockedRequests = [];
    tabBlockedCounts.clear();
    tabSessionCounts.clear();
}
