// ============================================================
// Tests for popup-blocked.js (renderBlockedList)
// ============================================================

const {
    describe, it, assertEqual, assertTrue, assertContains,
    printResults, createDOMMock, createBrowserMock, loadScript,
} = require("./test-harness");

// Set up global mocks
globalThis.document = createDOMMock();
globalThis.browser = createBrowserMock();

// Pre-register elements needed by popup modules
document._registerElement("ruleError");
document._registerElement("siteCount");
document._registerElement("sessionCount");
document._registerElement("ruleCount");
document._registerElement("blockedList");
document._registerElement("searchInput");
document._registerElement("clearSessionBtn");

// Load popup-ui.js first (provides formatTime)
loadScript("../../My AdBlock Extension/Resources/popup/popup-ui.js");

// Provide global DOM elements that popup-stats.js expects
globalThis.siteCountEl = document.getElementById("siteCount");
globalThis.sessionCountEl = document.getElementById("sessionCount");
globalThis.ruleCountEl = document.getElementById("ruleCount");
globalThis.currentBlockedRequests = [];

// Provide globals that popup-blocked.js expects
globalThis.blockedList = document.getElementById("blockedList");
globalThis.searchInput = document.getElementById("searchInput");
globalThis.clearSessionBtn = document.getElementById("clearSessionBtn");

// Stub renderBlockedList before loading (popup-blocked.js defines it)
// Need to load it manually since it references DOM at top level
// We'll define the function directly to test it

// Instead of loading the file (which has side-effects with addEventListener),
// we'll extract and test renderBlockedList by loading the file
loadScript("../../My AdBlock Extension/Resources/popup/popup-blocked.js");

// ---------------------
// renderBlockedList
// ---------------------

describe("renderBlockedList", () => {
    it("should show empty message for null requests", () => {
        renderBlockedList(null);
        assertContains(blockedList.innerHTML, "No blocked requests yet");
    });

    it("should show empty message for empty array", () => {
        renderBlockedList([]);
        assertContains(blockedList.innerHTML, "No blocked requests yet");
    });

    it("should render blocked entries", () => {
        const requests = [
            { url: "https://ads.com/ad.js", timestamp: Date.now(), matchedRule: "ads.com" },
            { url: "https://tracker.net/pixel.gif", timestamp: Date.now() },
        ];

        let appendedFragment = null;
        blockedList.appendChild = (frag) => { appendedFragment = frag; };

        renderBlockedList(requests);

        // innerHTML should be cleared
        assertEqual(blockedList.innerHTML, "");
        // Fragment should have entries
        assertTrue(appendedFragment !== null);
        assertEqual(appendedFragment.children.length, 2);
    });

    it("should show entries in reverse order (newest first)", () => {
        const requests = [
            { url: "https://first.com/1", timestamp: 1000 },
            { url: "https://second.com/2", timestamp: 2000 },
        ];

        let appendedFragment = null;
        blockedList.appendChild = (frag) => { appendedFragment = frag; };

        renderBlockedList(requests);

        // Second (newer) should be first in rendered output
        const firstEntry = appendedFragment.children[0];
        const urlSpan = firstEntry.children[1];
        assertEqual(urlSpan.textContent, "https://second.com/2");
    });

    it("should include matched rule in title tooltip", () => {
        const requests = [
            { url: "https://ads.com/ad.js", timestamp: Date.now(), matchedRule: "ads.com" },
        ];

        let appendedFragment = null;
        blockedList.appendChild = (frag) => { appendedFragment = frag; };

        renderBlockedList(requests);

        const urlSpan = appendedFragment.children[0].children[1];
        assertContains(urlSpan.title, "ads.com");
        assertContains(urlSpan.title, "Rule:");
    });

    it("should not include Rule: in title when no matchedRule", () => {
        const requests = [
            { url: "https://ads.com/ad.js", timestamp: Date.now() },
        ];

        let appendedFragment = null;
        blockedList.appendChild = (frag) => { appendedFragment = frag; };

        renderBlockedList(requests);

        const urlSpan = appendedFragment.children[0].children[1];
        assertEqual(urlSpan.title.includes("Rule:"), false);
    });
});

printResults();
