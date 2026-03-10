// ============================================================
// Tests for rule-manager.js
// ============================================================

const {
    describe, it, assertEqual, assertDeepEqual, assertTrue, assertContains,
    printResults, createBrowserMock, loadScript,
} = require("./test-harness");

// Set up global browser mock
globalThis.browser = createBrowserMock();

// Load dependencies in order
loadScript("../../My AdBlock Extension/Resources/shared/easylist-parser.js");
loadScript("../../My AdBlock Extension/Resources/background/storage.js");
loadScript("../../My AdBlock Extension/Resources/background/dnr.js");
loadScript("../../My AdBlock Extension/Resources/background/rule-manager.js");

function resetAll() {
    browser.storage.local._reset();
    browser.declarativeNetRequest._reset();
}

// ---------------------
// addCustomRule
// ---------------------

describe("addCustomRule", () => {
    it("should add a host rule successfully", async () => {
        resetAll();
        const result = await addCustomRule("host", "ads.example.com");
        assertTrue(result.success);
        assertEqual(result.rule.ruleType, "host");
        assertEqual(result.rule.value, "ads.example.com");
        assertEqual(result.rule.urlFilter, "||ads.example.com");
        assertTrue(result.rule.dnrRegistered);
    });

    it("should add a pattern rule successfully", async () => {
        resetAll();
        const result = await addCustomRule("pattern", "/ads/banner");
        assertTrue(result.success);
        assertEqual(result.rule.ruleType, "pattern");
        assertEqual(result.rule.value, "/ads/banner");
        assertEqual(result.rule.urlFilter, "*/ads/banner*");
    });

    it("should trim and lowercase the value", async () => {
        resetAll();
        const result = await addCustomRule("host", "  ADS.COM  ");
        assertTrue(result.success);
        assertEqual(result.rule.value, "ads.com");
    });

    it("should reject empty value", async () => {
        resetAll();
        const result = await addCustomRule("host", "");
        assertTrue(!!result.error);
        assertContains(result.error, "empty");
    });

    it("should reject whitespace-only value", async () => {
        resetAll();
        const result = await addCustomRule("host", "   ");
        assertTrue(!!result.error);
    });

    it("should reject duplicate rule", async () => {
        resetAll();
        await addCustomRule("host", "ads.com");
        const result = await addCustomRule("host", "ads.com");
        assertTrue(!!result.error);
        assertContains(result.error, "already exists");
    });

    it("should assign sequential IDs", async () => {
        resetAll();
        const r1 = await addCustomRule("host", "a.com");
        const r2 = await addCustomRule("host", "b.com");
        assertEqual(r2.rule.id, r1.rule.id + 1);
    });

    it("should register rule with DNR", async () => {
        resetAll();
        await addCustomRule("host", "ads.com");
        assertEqual(browser.declarativeNetRequest._dynamicRules.length, 1);
    });

    it("should persist rule to storage", async () => {
        resetAll();
        await addCustomRule("host", "ads.com");
        const stored = browser.storage.local._store.customRules;
        assertEqual(stored.length, 1);
        assertEqual(stored[0].value, "ads.com");
    });
});

// ---------------------
// removeCustomRule
// ---------------------

describe("removeCustomRule", () => {
    it("should remove an existing rule", async () => {
        resetAll();
        const { rule } = await addCustomRule("host", "ads.com");
        const result = await removeCustomRule(rule.id);
        assertTrue(result.success);
    });

    it("should remove from storage", async () => {
        resetAll();
        const { rule } = await addCustomRule("host", "ads.com");
        await removeCustomRule(rule.id);
        assertEqual(browser.storage.local._store.customRules.length, 0);
    });

    it("should remove from DNR", async () => {
        resetAll();
        const { rule } = await addCustomRule("host", "ads.com");
        await removeCustomRule(rule.id);
        assertEqual(browser.declarativeNetRequest._dynamicRules.length, 0);
    });

    it("should return error for non-existent rule", async () => {
        resetAll();
        const result = await removeCustomRule(99999);
        assertTrue(!!result.error);
        assertContains(result.error, "not found");
    });

    it("should handle string ruleId", async () => {
        resetAll();
        const { rule } = await addCustomRule("host", "ads.com");
        const result = await removeCustomRule(String(rule.id));
        assertTrue(result.success);
    });

    it("should backfill a storage-only rule into freed DNR slot", async () => {
        resetAll();
        // Add two rules, force second to not be DNR-registered
        const { rule: r1 } = await addCustomRule("host", "a.com");
        const { rule: r2 } = await addCustomRule("host", "b.com");

        // Manually mark r2 as not DNR-registered
        const stored = browser.storage.local._store.customRules;
        stored[1].dnrRegistered = false;

        // Remove r1 (which is DNR-registered) — should backfill r2
        await removeCustomRule(r1.id);
        const updated = browser.storage.local._store.customRules;
        assertTrue(updated[0].dnrRegistered);
    });
});

// ---------------------
// getRuleCounts
// ---------------------

describe("getRuleCounts", () => {
    it("should return 0 when no rules", async () => {
        resetAll();
        const result = await getRuleCounts();
        assertEqual(result.total, 0);
    });

    it("should return correct count", async () => {
        resetAll();
        await addCustomRule("host", "a.com");
        await addCustomRule("host", "b.com");
        const result = await getRuleCounts();
        assertEqual(result.total, 2);
    });
});

// ---------------------
// getCustomRulesPaginated
// ---------------------

describe("getCustomRulesPaginated", () => {
    it("should return all rules on first page", async () => {
        resetAll();
        await addCustomRule("host", "a.com");
        await addCustomRule("host", "b.com");
        const result = await getCustomRulesPaginated(1, 50, "");
        assertEqual(result.rules.length, 2);
        assertEqual(result.totalCount, 2);
        assertEqual(result.totalPages, 1);
        assertEqual(result.page, 1);
    });

    it("should paginate correctly", async () => {
        resetAll();
        for (let i = 0; i < 5; i++) await addCustomRule("host", `r${i}.com`);
        const page1 = await getCustomRulesPaginated(1, 2, "");
        assertEqual(page1.rules.length, 2);
        assertEqual(page1.totalPages, 3);

        const page2 = await getCustomRulesPaginated(2, 2, "");
        assertEqual(page2.rules.length, 2);
        assertEqual(page2.page, 2);

        const page3 = await getCustomRulesPaginated(3, 2, "");
        assertEqual(page3.rules.length, 1);
    });

    it("should sort by id descending (newest first)", async () => {
        resetAll();
        await addCustomRule("host", "a.com");
        await addCustomRule("host", "b.com");
        await addCustomRule("host", "c.com");
        const result = await getCustomRulesPaginated(1, 50, "");
        assertTrue(result.rules[0].id > result.rules[1].id);
        assertTrue(result.rules[1].id > result.rules[2].id);
    });

    it("should filter by search query", async () => {
        resetAll();
        await addCustomRule("host", "ads.example.com");
        await addCustomRule("host", "tracker.net");
        await addCustomRule("host", "ads.tracker.io");

        const result = await getCustomRulesPaginated(1, 50, "ads");
        assertEqual(result.totalCount, 2);
    });

    it("should clamp page to valid range", async () => {
        resetAll();
        await addCustomRule("host", "a.com");
        const result = await getCustomRulesPaginated(999, 50, "");
        assertEqual(result.page, 1);
    });

    it("should handle empty rules", async () => {
        resetAll();
        const result = await getCustomRulesPaginated(1, 50, "");
        assertEqual(result.rules.length, 0);
        assertEqual(result.totalPages, 1);
    });
});

// ---------------------
// exportRules
// ---------------------

describe("exportRules", () => {
    it("should export rules in EasyList format", async () => {
        resetAll();
        await addCustomRule("host", "ads.com");
        await addCustomRule("pattern", "/promo/");
        const result = await exportRules();
        assertTrue(result.success);
        assertEqual(result.data.count, 2);
        assertContains(result.data.text, "[Adblock Plus 2.0]");
        assertContains(result.data.text, "||ads.com^");
        assertContains(result.data.text, "/promo/");
    });

    it("should include header with metadata", async () => {
        resetAll();
        const result = await exportRules();
        assertContains(result.data.text, "! Title: My AdBlock");
        assertContains(result.data.text, "! Exported:");
        assertContains(result.data.text, "! Total rules: 0");
    });

    it("should handle empty rules", async () => {
        resetAll();
        const result = await exportRules();
        assertTrue(result.success);
        assertEqual(result.data.count, 0);
    });
});

// ---------------------
// importRulesBatch
// ---------------------

describe("importRulesBatch", () => {
    it("should import valid rules", async () => {
        resetAll();
        const result = await importRulesBatch([
            { ruleType: "host", value: "ads.com" },
            { ruleType: "pattern", value: "/tracking/" },
        ]);
        assertEqual(result.imported, 2);
        assertEqual(result.skipped, 0);
    });

    it("should skip duplicate values", async () => {
        resetAll();
        await addCustomRule("host", "ads.com");
        const result = await importRulesBatch([
            { ruleType: "host", value: "ads.com" },
            { ruleType: "host", value: "new.com" },
        ]);
        assertEqual(result.imported, 1);
        assertEqual(result.skipped, 1);
    });

    it("should skip invalid ruleTypes", async () => {
        resetAll();
        const result = await importRulesBatch([
            { ruleType: "invalid", value: "ads.com" },
        ]);
        assertEqual(result.imported, 0);
        assertEqual(result.skipped, 1);
    });

    it("should skip empty values", async () => {
        resetAll();
        const result = await importRulesBatch([
            { ruleType: "host", value: "" },
            { ruleType: "host", value: "   " },
        ]);
        assertEqual(result.imported, 0);
        assertEqual(result.skipped, 2);
    });

    it("should handle empty array", async () => {
        resetAll();
        const result = await importRulesBatch([]);
        assertEqual(result.imported, 0);
        assertEqual(result.skipped, 0);
    });

    it("should handle non-array input", async () => {
        resetAll();
        const result = await importRulesBatch(null);
        assertEqual(result.imported, 0);
    });

    it("should mark imported rules as dnrRegistered=false", async () => {
        resetAll();
        await importRulesBatch([{ ruleType: "host", value: "ads.com" }]);
        const rules = browser.storage.local._store.customRules;
        assertEqual(rules[0].dnrRegistered, false);
    });

    it("should deduplicate within the same batch", async () => {
        resetAll();
        const result = await importRulesBatch([
            { ruleType: "host", value: "ads.com" },
            { ruleType: "host", value: "ads.com" },
        ]);
        assertEqual(result.imported, 1);
        assertEqual(result.skipped, 1);
    });
});

// ---------------------
// syncAllDnrRules
// ---------------------

describe("syncAllDnrRules", () => {
    it("should return zeros for empty rules", async () => {
        resetAll();
        const result = await syncAllDnrRules();
        assertEqual(result.total, 0);
        assertEqual(result.dnrRegistered, 0);
    });

    it("should register all rules with DNR", async () => {
        resetAll();
        await addCustomRule("host", "a.com");
        await addCustomRule("host", "b.com");
        browser.declarativeNetRequest._reset(); // Clear DNR
        const result = await syncAllDnrRules();
        assertEqual(result.total, 2);
        assertEqual(result.dnrRegistered, 2);
    });

    it("should update dnrRegistered flags in storage", async () => {
        resetAll();
        // Add rules manually without DNR
        browser.storage.local._store.customRules = [
            { id: 10000, ruleType: "host", value: "a.com", urlFilter: "||a.com", dnrRegistered: false },
        ];
        await syncAllDnrRules();
        const rules = browser.storage.local._store.customRules;
        assertTrue(rules[0].dnrRegistered);
    });
});

// ---------------------
// importFinalize
// ---------------------

describe("importFinalize", () => {
    it("should register imported rules with DNR", async () => {
        resetAll();
        await importRulesBatch([
            { ruleType: "host", value: "ads.com" },
            { ruleType: "host", value: "tracker.net" },
        ]);
        const result = await importFinalize();
        assertTrue(result.success);
        assertEqual(result.total, 2);
        assertEqual(result.dnrRegistered, 2);
    });
});

// ---------------------
// clearAllRules
// ---------------------

describe("clearAllRules", () => {
    it("should remove all rules from storage and DNR", async () => {
        resetAll();
        await addCustomRule("host", "a.com");
        await addCustomRule("host", "b.com");
        const result = await clearAllRules();
        assertTrue(result.success);
        assertDeepEqual(browser.storage.local._store.customRules, []);
        assertEqual(browser.declarativeNetRequest._dynamicRules.length, 0);
    });

    it("should work when already empty", async () => {
        resetAll();
        const result = await clearAllRules();
        assertTrue(result.success);
    });
});

printResults();
