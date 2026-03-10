// ============================================================
// Tests for blocklist-matcher.js
// ============================================================

const {
    describe, it, assertEqual, assertTrue, assertFalse,
    printResults, createBrowserMock, loadScript,
} = require("./test-harness");

// Set up global browser mock
globalThis.browser = createBrowserMock();
globalThis.location = { hostname: "example.com" };

// Stub scanExistingResources (defined in resource-scanner.js, loaded separately)
globalThis.scanExistingResources = () => {};

// Load the module under test
loadScript("../../My AdBlock Extension/Resources/content/blocklist-matcher.js");

function resetMatcher() {
    customRules = [];
    blocklistReady = false;
    reportedUrls.clear();
}

// ---------------------
// matchesBlocklist
// ---------------------

describe("matchesBlocklist", () => {
    it("should match exact host rule", () => {
        resetMatcher();
        customRules = [{ ruleType: "host", value: "ads.example.com" }];
        blocklistReady = true;
        const result = matchesBlocklist("https://ads.example.com/ad.js");
        assertTrue(result.matched);
        assertEqual(result.rule, "ads.example.com");
        assertEqual(result.type, "host");
    });

    it("should match subdomain of host rule", () => {
        resetMatcher();
        customRules = [{ ruleType: "host", value: "example.com" }];
        blocklistReady = true;
        const result = matchesBlocklist("https://sub.example.com/page");
        assertTrue(result.matched);
    });

    it("should not match partial hostname (no dot prefix)", () => {
        resetMatcher();
        customRules = [{ ruleType: "host", value: "ample.com" }];
        blocklistReady = true;
        const result = matchesBlocklist("https://example.com/page");
        assertFalse(result.matched);
    });

    it("should match pattern rule in URL", () => {
        resetMatcher();
        customRules = [{ ruleType: "pattern", value: "/ads/banner" }];
        blocklistReady = true;
        const result = matchesBlocklist("https://cdn.example.com/ads/banner.js");
        assertTrue(result.matched);
        assertEqual(result.type, "pattern");
    });

    it("should not match pattern not in URL", () => {
        resetMatcher();
        customRules = [{ ruleType: "pattern", value: "/promo/" }];
        blocklistReady = true;
        const result = matchesBlocklist("https://example.com/page");
        assertFalse(result.matched);
    });

    it("should be case-insensitive for host matching", () => {
        resetMatcher();
        customRules = [{ ruleType: "host", value: "ads.com" }];
        blocklistReady = true;
        const result = matchesBlocklist("https://ADS.COM/ad.js");
        assertTrue(result.matched);
    });

    it("should be case-insensitive for pattern matching", () => {
        resetMatcher();
        customRules = [{ ruleType: "pattern", value: "/ads/" }];
        blocklistReady = true;
        const result = matchesBlocklist("https://example.com/ADS/banner.js");
        assertTrue(result.matched);
    });

    it("should return not matched for invalid URL", () => {
        resetMatcher();
        customRules = [{ ruleType: "host", value: "ads.com" }];
        blocklistReady = true;
        const result = matchesBlocklist("not-a-valid-url");
        assertFalse(result.matched);
    });

    it("should return not matched when no rules", () => {
        resetMatcher();
        customRules = [];
        blocklistReady = true;
        const result = matchesBlocklist("https://ads.com/ad.js");
        assertFalse(result.matched);
    });

    it("should match first matching rule", () => {
        resetMatcher();
        customRules = [
            { ruleType: "host", value: "ads.com" },
            { ruleType: "pattern", value: "/ads/" },
        ];
        blocklistReady = true;
        const result = matchesBlocklist("https://ads.com/ads/banner.js");
        assertEqual(result.type, "host"); // Host rule checked first
    });
});

// ---------------------
// reportBlocked
// ---------------------

describe("reportBlocked", () => {
    it("should send message to background", () => {
        resetMatcher();
        let sentMessage = null;
        browser.runtime.sendMessage = (msg) => {
            sentMessage = msg;
            return Promise.resolve();
        };

        reportBlocked("https://ads.com/ad.js", "ads.com", "host");
        assertEqual(sentMessage.type, "reportBlocked");
        assertEqual(sentMessage.url, "https://ads.com/ad.js");
        assertEqual(sentMessage.matchedRule, "ads.com");
    });

    it("should not report same URL twice", () => {
        resetMatcher();
        let callCount = 0;
        browser.runtime.sendMessage = () => { callCount++; return Promise.resolve(); };

        reportBlocked("https://ads.com/ad.js", "ads.com", "host");
        reportBlocked("https://ads.com/ad.js", "ads.com", "host");
        assertEqual(callCount, 1);
    });

    it("should report different URLs", () => {
        resetMatcher();
        let callCount = 0;
        browser.runtime.sendMessage = () => { callCount++; return Promise.resolve(); };

        reportBlocked("https://ads.com/1.js", "ads.com", "host");
        reportBlocked("https://ads.com/2.js", "ads.com", "host");
        assertEqual(callCount, 2);
    });
});

// ---------------------
// checkAndReport
// ---------------------

describe("checkAndReport", () => {
    it("should do nothing when blocklist not ready", () => {
        resetMatcher();
        blocklistReady = false;
        let called = false;
        browser.runtime.sendMessage = () => { called = true; return Promise.resolve(); };
        checkAndReport("https://ads.com/ad.js");
        assertFalse(called);
    });

    it("should skip null/empty URLs", () => {
        resetMatcher();
        blocklistReady = true;
        customRules = [{ ruleType: "host", value: "ads.com" }];
        let called = false;
        browser.runtime.sendMessage = () => { called = true; return Promise.resolve(); };
        checkAndReport(null);
        checkAndReport("");
        assertFalse(called);
    });

    it("should skip about:blank", () => {
        resetMatcher();
        blocklistReady = true;
        let called = false;
        browser.runtime.sendMessage = () => { called = true; return Promise.resolve(); };
        checkAndReport("about:blank");
        assertFalse(called);
    });

    it("should skip data: URLs", () => {
        resetMatcher();
        blocklistReady = true;
        let called = false;
        browser.runtime.sendMessage = () => { called = true; return Promise.resolve(); };
        checkAndReport("data:image/png;base64,abc");
        assertFalse(called);
    });

    it("should report matching URL", () => {
        resetMatcher();
        blocklistReady = true;
        customRules = [{ ruleType: "host", value: "ads.com" }];
        let sentMessage = null;
        browser.runtime.sendMessage = (msg) => { sentMessage = msg; return Promise.resolve(); };

        checkAndReport("https://ads.com/ad.js");
        assertTrue(sentMessage !== null);
        assertEqual(sentMessage.url, "https://ads.com/ad.js");
    });

    it("should not report non-matching URL", () => {
        resetMatcher();
        blocklistReady = true;
        customRules = [{ ruleType: "host", value: "ads.com" }];
        let called = false;
        browser.runtime.sendMessage = () => { called = true; return Promise.resolve(); };

        checkAndReport("https://safe.com/page.html");
        assertFalse(called);
    });
});

printResults();
