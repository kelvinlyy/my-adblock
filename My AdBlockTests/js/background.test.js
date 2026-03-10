// ============================================================
// Tests for background.js message router
// ============================================================

const {
    describe, it, assertEqual, assertTrue, assertContains,
    printResults, createBrowserMock, loadScript,
} = require("./test-harness");

// Set up global browser mock
globalThis.browser = createBrowserMock();

// Load all dependencies in correct order
loadScript("../../My AdBlock Extension/Resources/shared/easylist-parser.js");
loadScript("../../My AdBlock Extension/Resources/background/storage.js");
loadScript("../../My AdBlock Extension/Resources/background/dnr.js");
loadScript("../../My AdBlock Extension/Resources/background/rule-manager.js");
loadScript("../../My AdBlock Extension/Resources/background/session-tracker.js");

// context-menu.js has side effects, skip re-loading it
// (extractHostname & handleContextMenuClick already defined)

// Load background.js — registers message listener
loadScript("../../My AdBlock Extension/Resources/background/background.js");

function resetAll() {
    browser.storage.local._reset();
    browser.declarativeNetRequest._reset();
    clearSession();
    recentlyLogged.clear();
}

// Simulate sending a message to the background listener
function sendMessage(msg, sender = { tab: { id: 1 } }) {
    const listener = browser.runtime._messageListeners[
        browser.runtime._messageListeners.length - 1
    ];
    return listener(msg, sender);
}

// ---------------------
// Message router tests
// ---------------------

describe("background.js — reportBlocked", () => {
    it("should record a blocked request", async () => {
        resetAll();
        const result = await sendMessage({
            type: "reportBlocked",
            url: "https://ads.com/ad.js",
            matchedRule: "ads.com",
            ruleType: "host",
            pageHostname: "example.com",
        });
        assertTrue(result.ok);
    });
});

describe("background.js — getBlocklist", () => {
    it("should return custom rules", async () => {
        resetAll();
        await addCustomRule("host", "ads.com");
        const result = await sendMessage({ type: "getBlocklist" });
        assertEqual(result.customRules.length, 1);
        assertEqual(result.customRules[0].ruleType, "host");
        assertEqual(result.customRules[0].value, "ads.com");
    });

    it("should return empty array when no rules", async () => {
        resetAll();
        const result = await sendMessage({ type: "getBlocklist" });
        assertEqual(result.customRules.length, 0);
    });
});

describe("background.js — getStats", () => {
    it("should return session stats for tab", async () => {
        resetAll();
        recordBlocked("https://ads.com/1", "ads.com", "host", "page.com", 1);
        const result = await sendMessage({ type: "getStats", tabId: 1 });
        assertEqual(result.siteBlocked, 1);
        assertEqual(result.sessionBlocked, 1);
    });
});

describe("background.js — clearSession", () => {
    it("should clear session data", async () => {
        resetAll();
        recordBlocked("https://ads.com/1", "ads.com", "host", "page.com", 1);
        const result = await sendMessage({ type: "clearSession" });
        assertTrue(result.success);
        const stats = await sendMessage({ type: "getStats", tabId: 1 });
        assertEqual(stats.siteBlocked, 0);
    });
});

describe("background.js — addCustomRule", () => {
    it("should add a rule via message", async () => {
        resetAll();
        const result = await sendMessage({
            type: "addCustomRule",
            ruleType: "host",
            value: "ads.com",
        });
        assertTrue(result.success);
        assertEqual(result.rule.value, "ads.com");
    });
});

describe("background.js — removeCustomRule", () => {
    it("should remove a rule via message", async () => {
        resetAll();
        const added = await sendMessage({
            type: "addCustomRule",
            ruleType: "host",
            value: "ads.com",
        });
        const result = await sendMessage({
            type: "removeCustomRule",
            ruleId: added.rule.id,
        });
        assertTrue(result.success);
    });
});

describe("background.js — getCustomRules", () => {
    it("should return paginated rules", async () => {
        resetAll();
        await addCustomRule("host", "a.com");
        await addCustomRule("host", "b.com");
        const result = await sendMessage({
            type: "getCustomRules",
            page: 1,
            pageSize: 50,
            search: "",
        });
        assertEqual(result.rules.length, 2);
        assertEqual(result.totalCount, 2);
    });
});

describe("background.js — getRuleCounts", () => {
    it("should return total count", async () => {
        resetAll();
        await addCustomRule("host", "a.com");
        const result = await sendMessage({ type: "getRuleCounts" });
        assertEqual(result.total, 1);
    });
});

describe("background.js — exportRules", () => {
    it("should return EasyList text", async () => {
        resetAll();
        await addCustomRule("host", "ads.com");
        const result = await sendMessage({ type: "exportRules" });
        assertTrue(result.success);
        assertContains(result.data.text, "||ads.com^");
    });
});

describe("background.js — downloadExport", () => {
    it("should send native message", async () => {
        resetAll();
        const result = await sendMessage({
            type: "downloadExport",
            text: "test data",
            filename: "rules.txt",
        });
        assertTrue(result.success);
    });
});

describe("background.js — importRulesBatch", () => {
    it("should import rules batch", async () => {
        resetAll();
        const result = await sendMessage({
            type: "importRulesBatch",
            rules: [{ ruleType: "host", value: "ads.com" }],
        });
        assertEqual(result.imported, 1);
    });
});

describe("background.js — importFinalize", () => {
    it("should finalize import and register DNR", async () => {
        resetAll();
        await sendMessage({
            type: "importRulesBatch",
            rules: [{ ruleType: "host", value: "ads.com" }],
        });
        const result = await sendMessage({ type: "importFinalize" });
        assertTrue(result.success);
        assertEqual(result.dnrRegistered, 1);
    });
});

describe("background.js — clearAllRules", () => {
    it("should clear all rules", async () => {
        resetAll();
        await addCustomRule("host", "ads.com");
        const result = await sendMessage({ type: "clearAllRules" });
        assertTrue(result.success);
        const counts = await sendMessage({ type: "getRuleCounts" });
        assertEqual(counts.total, 0);
    });
});

describe("background.js — unknown message", () => {
    it("should return error for unknown type", async () => {
        const result = await sendMessage({ type: "unknownType" });
        assertTrue(!!result.error);
        assertContains(result.error, "Unknown");
    });
});

printResults();
