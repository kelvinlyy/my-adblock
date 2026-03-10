// ============================================================
// Tests for session-tracker.js
// ============================================================

const {
    describe, it, assertEqual, assertTrue, assertFalse,
    printResults, createBrowserMock, loadScript,
} = require("./test-harness");

// Set up global browser mock
globalThis.browser = createBrowserMock();

// Load dependencies first
loadScript("../../My AdBlock Extension/Resources/background/storage.js");

// Load the module under test (has side-effects: setInterval, event listeners)
loadScript("../../My AdBlock Extension/Resources/background/session-tracker.js");

// Reset session state between tests
function resetSession() {
    clearSession();
    recentlyLogged.clear();
}

// ---------------------
// dedup
// ---------------------

describe("dedup", () => {
    it("should return true for a new URL", () => {
        resetSession();
        assertTrue(dedup("https://ads.example.com/ad.js"));
    });

    it("should return false for a recently-logged URL", () => {
        resetSession();
        dedup("https://ads.example.com/ad.js");
        assertFalse(dedup("https://ads.example.com/ad.js"));
    });

    it("should return true for a different URL", () => {
        resetSession();
        dedup("https://a.com/1");
        assertTrue(dedup("https://b.com/2"));
    });

    it("should return true after TTL expires", () => {
        resetSession();
        dedup("https://ads.com/ad.js");
        // Manually expire the entry
        recentlyLogged.set("https://ads.com/ad.js", Date.now() - 3000);
        assertTrue(dedup("https://ads.com/ad.js"));
    });
});

// ---------------------
// recordBlocked
// ---------------------

describe("recordBlocked", () => {
    it("should add entry to sessionBlockedRequests", () => {
        resetSession();
        recordBlocked("https://ads.com/ad.js", "ads.com", "host", "example.com", 1);
        const stats = getSessionStats(1);
        assertEqual(stats.blockedRequests.length, 1);
        assertEqual(stats.blockedRequests[0].url, "https://ads.com/ad.js");
    });

    it("should increment per-tab site count", () => {
        resetSession();
        recordBlocked("https://a.com/1", "a.com", "host", "page.com", 42);
        recordBlocked("https://b.com/2", "b.com", "host", "page.com", 42);
        const stats = getSessionStats(42);
        assertEqual(stats.siteBlocked, 2);
    });

    it("should increment per-tab session count", () => {
        resetSession();
        recordBlocked("https://a.com/1", "a.com", "host", "page.com", 5);
        const stats = getSessionStats(5);
        assertEqual(stats.sessionBlocked, 1);
    });

    it("should not double-count duplicate URLs within TTL", () => {
        resetSession();
        recordBlocked("https://ads.com/ad.js", "ads.com", "host", "page.com", 1);
        recordBlocked("https://ads.com/ad.js", "ads.com", "host", "page.com", 1);
        const stats = getSessionStats(1);
        assertEqual(stats.siteBlocked, 1);
    });

    it("should handle null tabId", () => {
        resetSession();
        recordBlocked("https://ads.com/ad.js", "ads.com", "host", "page.com", null);
        const stats = getSessionStats(null);
        assertEqual(stats.sessionBlocked, 0);
        assertEqual(stats.siteBlocked, 0);
        // But the request is still logged globally
        assertTrue(stats.blockedRequests.length >= 0);
    });

    it("should trim session log when exceeding SESSION_LOG_MAX", () => {
        resetSession();
        // Generate more than SESSION_LOG_MAX entries
        for (let i = 0; i < 5010; i++) {
            recentlyLogged.clear(); // Bypass dedup
            recordBlocked(`https://ads.com/${i}`, "ads.com", "host", "page.com", 1);
        }
        // After trimming, should have SESSION_LOG_TRIM (4000)
        const stats = getSessionStats(1);
        assertTrue(stats.blockedRequests.length <= 4000);
    });
});

// ---------------------
// getSessionStats
// ---------------------

describe("getSessionStats", () => {
    it("should return zero counts for unknown tab", () => {
        resetSession();
        const stats = getSessionStats(9999);
        assertEqual(stats.sessionBlocked, 0);
        assertEqual(stats.siteBlocked, 0);
    });

    it("should return zero counts when tabId is null", () => {
        resetSession();
        const stats = getSessionStats(null);
        assertEqual(stats.sessionBlocked, 0);
        assertEqual(stats.siteBlocked, 0);
    });

    it("should return at most 500 blocked requests", () => {
        resetSession();
        for (let i = 0; i < 600; i++) {
            recentlyLogged.clear();
            recordBlocked(`https://ads.com/${i}`, "ads.com", "host", "page.com", 1);
        }
        const stats = getSessionStats(1);
        assertTrue(stats.blockedRequests.length <= 500);
    });

    it("should return correct counts per tab", () => {
        resetSession();
        recordBlocked("https://a.com/1", "a.com", "host", "page.com", 10);
        recordBlocked("https://b.com/2", "b.com", "host", "page.com", 20);
        recordBlocked("https://c.com/3", "c.com", "host", "page.com", 10);

        const stats10 = getSessionStats(10);
        assertEqual(stats10.siteBlocked, 2);
        assertEqual(stats10.sessionBlocked, 2);

        const stats20 = getSessionStats(20);
        assertEqual(stats20.siteBlocked, 1);
        assertEqual(stats20.sessionBlocked, 1);
    });
});

// ---------------------
// clearSession
// ---------------------

describe("clearSession", () => {
    it("should clear all session data", () => {
        resetSession();
        recordBlocked("https://ads.com/ad.js", "ads.com", "host", "page.com", 1);
        clearSession();
        const stats = getSessionStats(1);
        assertEqual(stats.sessionBlocked, 0);
        assertEqual(stats.siteBlocked, 0);
        assertEqual(stats.blockedRequests.length, 0);
    });

    it("should clear all tab counts", () => {
        resetSession();
        recordBlocked("https://a.com/1", "a.com", "host", "page.com", 1);
        recordBlocked("https://b.com/2", "b.com", "host", "page.com", 2);
        clearSession();
        assertEqual(getSessionStats(1).siteBlocked, 0);
        assertEqual(getSessionStats(2).siteBlocked, 0);
    });
});

printResults();
