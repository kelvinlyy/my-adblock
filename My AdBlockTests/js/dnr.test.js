// ============================================================
// Tests for dnr.js
// ============================================================

const {
    describe, it, assertEqual, assertDeepEqual, assertTrue,
    printResults, createBrowserMock, loadScript,
} = require("./test-harness");

// Set up global browser mock
globalThis.browser = createBrowserMock();

// Load the module under test
loadScript("../../My AdBlock Extension/Resources/background/dnr.js");

// ---------------------
// buildUrlFilter
// ---------------------

describe("buildUrlFilter", () => {
    it("should prepend || for host rules", () => {
        assertEqual(buildUrlFilter("host", "ads.example.com"), "||ads.example.com");
    });

    it("should wrap plain pattern with wildcards", () => {
        assertEqual(buildUrlFilter("pattern", "/ads/banner"), "*/ads/banner*");
    });

    it("should not double-wrap if pattern starts with *", () => {
        assertEqual(buildUrlFilter("pattern", "*/ads/*"), "*/ads/*");
    });

    it("should not wrap if pattern starts with |", () => {
        assertEqual(buildUrlFilter("pattern", "|https://ads.com"), "|https://ads.com");
    });

    it("should handle empty pattern", () => {
        assertEqual(buildUrlFilter("pattern", ""), "**");
    });
});

// ---------------------
// buildDnrRule
// ---------------------

describe("buildDnrRule", () => {
    it("should create a valid DNR rule object", () => {
        const rule = buildDnrRule(10001, "||ads.example.com");
        assertEqual(rule.id, 10001);
        assertEqual(rule.priority, 1);
        assertEqual(rule.action.type, "block");
        assertEqual(rule.condition.urlFilter, "||ads.example.com");
        assertTrue(Array.isArray(rule.condition.resourceTypes));
    });

    it("should include all expected resource types", () => {
        const rule = buildDnrRule(1, "test");
        const types = rule.condition.resourceTypes;
        assertTrue(types.includes("script"));
        assertTrue(types.includes("image"));
        assertTrue(types.includes("xmlhttprequest"));
        assertTrue(types.includes("sub_frame"));
        assertTrue(types.includes("stylesheet"));
        assertTrue(types.includes("font"));
        assertTrue(types.includes("media"));
        assertTrue(types.includes("ping"));
        assertTrue(types.includes("other"));
    });
});

// ---------------------
// nextRuleId
// ---------------------

describe("nextRuleId", () => {
    it("should return DYNAMIC_RULE_ID_START for empty array", () => {
        assertEqual(nextRuleId([]), 10000);
    });

    it("should return max id + 1", () => {
        assertEqual(nextRuleId([{ id: 10000 }, { id: 10002 }, { id: 10001 }]), 10003);
    });

    it("should handle single element", () => {
        assertEqual(nextRuleId([{ id: 10005 }]), 10006);
    });

    it("should handle non-sequential ids", () => {
        assertEqual(nextRuleId([{ id: 10000 }, { id: 20000 }]), 20001);
    });
});

// ---------------------
// getAvailableDnrSlots
// ---------------------

describe("getAvailableDnrSlots", () => {
    it("should return MAX_DYNAMIC_RULES when no rules exist", async () => {
        browser.declarativeNetRequest._reset();
        const slots = await getAvailableDnrSlots();
        assertEqual(slots, 29500);
    });

    it("should subtract existing rules from max", async () => {
        browser.declarativeNetRequest._reset();
        browser.declarativeNetRequest._dynamicRules = [{ id: 1 }, { id: 2 }, { id: 3 }];
        const slots = await getAvailableDnrSlots();
        assertEqual(slots, 29497);
    });

    it("should return 0 when at capacity", async () => {
        browser.declarativeNetRequest._reset();
        browser.declarativeNetRequest._dynamicRules = Array.from({ length: 29500 }, (_, i) => ({ id: i }));
        const slots = await getAvailableDnrSlots();
        assertEqual(slots, 0);
    });

    it("should return MAX_DYNAMIC_RULES on API error", async () => {
        const orig = browser.declarativeNetRequest.getDynamicRules;
        browser.declarativeNetRequest.getDynamicRules = () => Promise.reject(new Error("fail"));
        const slots = await getAvailableDnrSlots();
        assertEqual(slots, 29500);
        browser.declarativeNetRequest.getDynamicRules = orig;
    });
});

// ---------------------
// batchRegisterDnrRules
// ---------------------

describe("batchRegisterDnrRules", () => {
    it("should register all rules and return count", async () => {
        browser.declarativeNetRequest._reset();
        const rules = [
            { id: 1, action: { type: "block" }, condition: {} },
            { id: 2, action: { type: "block" }, condition: {} },
        ];
        const count = await batchRegisterDnrRules(rules);
        assertEqual(count, 2);
        assertEqual(browser.declarativeNetRequest._dynamicRules.length, 2);
    });

    it("should stop on error and return partial count", async () => {
        browser.declarativeNetRequest._reset();
        let callCount = 0;
        const orig = browser.declarativeNetRequest.updateDynamicRules;
        browser.declarativeNetRequest.updateDynamicRules = async (opts) => {
            callCount++;
            if (callCount > 1) throw new Error("batch fail");
            browser.declarativeNetRequest._dynamicRules.push(...opts.addRules);
        };

        // Create rules exceeding one batch to trigger multiple calls
        const rules = Array.from({ length: 6000 }, (_, i) => ({ id: i }));
        const count = await batchRegisterDnrRules(rules);
        assertEqual(count, 5000); // Only first batch succeeds
        browser.declarativeNetRequest.updateDynamicRules = orig;
    });

    it("should handle empty array", async () => {
        browser.declarativeNetRequest._reset();
        const count = await batchRegisterDnrRules([]);
        assertEqual(count, 0);
    });
});

// ---------------------
// clearAllDnrRules
// ---------------------

describe("clearAllDnrRules", () => {
    it("should remove all dynamic rules", async () => {
        browser.declarativeNetRequest._reset();
        browser.declarativeNetRequest._dynamicRules = [{ id: 1 }, { id: 2 }, { id: 3 }];
        await clearAllDnrRules();
        assertEqual(browser.declarativeNetRequest._dynamicRules.length, 0);
    });

    it("should handle no existing rules", async () => {
        browser.declarativeNetRequest._reset();
        await clearAllDnrRules();
        assertEqual(browser.declarativeNetRequest._dynamicRules.length, 0);
    });

    it("should not throw on API error", async () => {
        const orig = browser.declarativeNetRequest.getDynamicRules;
        browser.declarativeNetRequest.getDynamicRules = () => Promise.reject(new Error("fail"));
        await clearAllDnrRules(); // Should not throw
        browser.declarativeNetRequest.getDynamicRules = orig;
    });
});

printResults();
