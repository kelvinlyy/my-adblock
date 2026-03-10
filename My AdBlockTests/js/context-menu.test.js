// ============================================================
// Tests for context-menu.js
// ============================================================

const {
    describe, it, assertEqual, assertNull, assertTrue,
    printResults, createBrowserMock, loadScript,
} = require("./test-harness");

// Set up global browser mock
globalThis.browser = createBrowserMock();

// Load dependencies
loadScript("../../My AdBlock Extension/Resources/shared/easylist-parser.js");
loadScript("../../My AdBlock Extension/Resources/background/storage.js");
loadScript("../../My AdBlock Extension/Resources/background/dnr.js");
loadScript("../../My AdBlock Extension/Resources/background/rule-manager.js");

// Load the module under test
loadScript("../../My AdBlock Extension/Resources/background/context-menu.js");

function resetAll() {
    browser.storage.local._reset();
    browser.declarativeNetRequest._reset();
    _contextMenuBusy = false;
}

// ---------------------
// extractHostname
// ---------------------

describe("extractHostname", () => {
    it("should extract hostname from srcUrl", () => {
        const host = extractHostname({ srcUrl: "https://ads.example.com/img.png" }, {});
        assertEqual(host, "ads.example.com");
    });

    it("should extract hostname from linkUrl when no srcUrl", () => {
        const host = extractHostname({ linkUrl: "https://link.example.com/page" }, {});
        assertEqual(host, "link.example.com");
    });

    it("should extract hostname from frameUrl", () => {
        const host = extractHostname({ frameUrl: "https://frame.example.com/" }, {});
        assertEqual(host, "frame.example.com");
    });

    it("should extract hostname from pageUrl", () => {
        const host = extractHostname({ pageUrl: "https://page.example.com/" }, {});
        assertEqual(host, "page.example.com");
    });

    it("should extract hostname from tab.url as fallback", () => {
        const host = extractHostname({}, { url: "https://tab.example.com/" });
        assertEqual(host, "tab.example.com");
    });

    it("should prioritize srcUrl over linkUrl", () => {
        const host = extractHostname({
            srcUrl: "https://src.com/img.png",
            linkUrl: "https://link.com/page",
        }, {});
        assertEqual(host, "src.com");
    });

    it("should return null when no valid URLs", () => {
        const host = extractHostname({}, {});
        assertNull(host);
    });

    it("should skip invalid URLs", () => {
        const host = extractHostname(
            { srcUrl: "not-a-url", pageUrl: "https://valid.com/" },
            {}
        );
        assertEqual(host, "valid.com");
    });

    it("should handle null tab", () => {
        const host = extractHostname({ pageUrl: "https://page.com/" }, null);
        assertEqual(host, "page.com");
    });

    it("should handle undefined tab", () => {
        const host = extractHostname({ pageUrl: "https://page.com/" }, undefined);
        assertEqual(host, "page.com");
    });
});

// ---------------------
// handleContextMenuClick
// ---------------------

describe("handleContextMenuClick", () => {
    it("should ignore non-matching menuItemId", async () => {
        resetAll();
        await handleContextMenuClick({ menuItemId: "other-menu" }, { id: 1 });
        // No error, no rule added
        assertEqual(browser.storage.local._store.customRules, undefined);
    });

    it("should extract hostname and send message to tab", async () => {
        resetAll();
        let sentMessage = null;
        browser.tabs.sendMessage = (tabId, msg) => {
            sentMessage = msg;
            return Promise.resolve({ ok: true });
        };

        await handleContextMenuClick(
            { menuItemId: CONTEXT_MENU_ID, srcUrl: "https://ads.com/ad.png" },
            { id: 1, url: "https://page.com/" }
        );

        assertEqual(sentMessage.type, "confirmBlockHost");
        assertEqual(sentMessage.hostname, "ads.com");
    });

    it("should fall back to addCustomRule if content script is unavailable", async () => {
        resetAll();
        browser.tabs.sendMessage = () => Promise.reject(new Error("no content script"));

        await handleContextMenuClick(
            { menuItemId: CONTEXT_MENU_ID, srcUrl: "https://ads.com/ad.png" },
            { id: 1, url: "https://page.com/" }
        );

        const rules = browser.storage.local._store.customRules;
        assertTrue(Array.isArray(rules));
        assertEqual(rules.length, 1);
        assertEqual(rules[0].value, "ads.com");
    });

    it("should prevent concurrent execution", async () => {
        resetAll();
        _contextMenuBusy = true;
        let called = false;
        browser.tabs.sendMessage = () => { called = true; return Promise.resolve(); };

        await handleContextMenuClick(
            { menuItemId: CONTEXT_MENU_ID, srcUrl: "https://ads.com/ad.png" },
            { id: 1 }
        );

        assertEqual(called, false);
        _contextMenuBusy = false;
    });

    it("should reset busy flag after completion", async () => {
        resetAll();
        browser.tabs.sendMessage = () => Promise.resolve({ ok: true });

        await handleContextMenuClick(
            { menuItemId: CONTEXT_MENU_ID, srcUrl: "https://ads.com/ad.png" },
            { id: 1 }
        );

        assertEqual(_contextMenuBusy, false);
    });
});

printResults();
