// ============================================================
// Tests for storage.js
// ============================================================

const {
    describe, it, assertEqual, assertDeepEqual, assertTrue,
    printResults, createBrowserMock, loadScript,
} = require("./test-harness");

// Set up global browser mock
globalThis.browser = createBrowserMock();

// Load the module under test
loadScript("../../My AdBlock Extension/Resources/background/storage.js");

// Reset storage between tests
function resetStorage() {
    browser.storage.local._reset();
    _pendingIncrements = 0;
    if (_flushTimer) { clearTimeout(_flushTimer); _flushTimer = null; }
}

// ---------------------
// getStoredCustomRules
// ---------------------

describe("getStoredCustomRules", () => {
    it("should return empty array when no rules stored", async () => {
        resetStorage();
        const rules = await getStoredCustomRules();
        assertDeepEqual(rules, []);
    });

    it("should return stored rules", async () => {
        resetStorage();
        const expected = [{ id: 1, value: "ads.com" }];
        browser.storage.local._store.customRules = expected;
        const rules = await getStoredCustomRules();
        assertDeepEqual(rules, expected);
    });
});

// ---------------------
// saveCustomRules
// ---------------------

describe("saveCustomRules", () => {
    it("should persist rules to storage", async () => {
        resetStorage();
        const rules = [{ id: 1, value: "test.com" }];
        await saveCustomRules(rules);
        assertDeepEqual(browser.storage.local._store.customRules, rules);
    });

    it("should overwrite existing rules", async () => {
        resetStorage();
        await saveCustomRules([{ id: 1, value: "old.com" }]);
        await saveCustomRules([{ id: 2, value: "new.com" }]);
        assertEqual(browser.storage.local._store.customRules.length, 1);
        assertEqual(browser.storage.local._store.customRules[0].value, "new.com");
    });

    it("should throw on storage error", async () => {
        resetStorage();
        const orig = browser.storage.local.set;
        browser.storage.local.set = () => Promise.reject(new Error("quota exceeded"));
        let threw = false;
        try {
            await saveCustomRules([]);
        } catch (e) {
            threw = true;
            assertEqual(e.message, "quota exceeded");
        }
        assertTrue(threw);
        browser.storage.local.set = orig;
    });
});

// ---------------------
// getAllTimeBlockedCount
// ---------------------

describe("getAllTimeBlockedCount", () => {
    it("should return 0 when no count stored", async () => {
        resetStorage();
        const count = await getAllTimeBlockedCount();
        assertEqual(count, 0);
    });

    it("should return stored count", async () => {
        resetStorage();
        browser.storage.local._store.allTimeBlockedCount = 42;
        const count = await getAllTimeBlockedCount();
        assertEqual(count, 42);
    });
});

// ---------------------
// incrementAllTimeBlockedCount
// ---------------------

describe("incrementAllTimeBlockedCount", () => {
    it("should increment pending count", () => {
        resetStorage();
        incrementAllTimeBlockedCount();
        assertEqual(_pendingIncrements, 1);
    });

    it("should accumulate multiple increments", () => {
        resetStorage();
        incrementAllTimeBlockedCount();
        incrementAllTimeBlockedCount();
        incrementAllTimeBlockedCount();
        assertEqual(_pendingIncrements, 3);
    });

    it("should set a flush timer", () => {
        resetStorage();
        incrementAllTimeBlockedCount();
        assertTrue(_flushTimer !== null);
    });
});

// ---------------------
// _flushBlockedCount
// ---------------------

describe("_flushBlockedCount", () => {
    it("should write accumulated delta to storage", async () => {
        resetStorage();
        browser.storage.local._store.allTimeBlockedCount = 10;
        _pendingIncrements = 5;
        await _flushBlockedCount();
        assertEqual(browser.storage.local._store.allTimeBlockedCount, 15);
        assertEqual(_pendingIncrements, 0);
    });

    it("should do nothing when delta is 0", async () => {
        resetStorage();
        browser.storage.local._store.allTimeBlockedCount = 10;
        _pendingIncrements = 0;
        await _flushBlockedCount();
        assertEqual(browser.storage.local._store.allTimeBlockedCount, 10);
    });

    it("should initialize count from 0 if not present", async () => {
        resetStorage();
        _pendingIncrements = 3;
        await _flushBlockedCount();
        assertEqual(browser.storage.local._store.allTimeBlockedCount, 3);
    });

    it("should clear _flushTimer", async () => {
        resetStorage();
        _flushTimer = setTimeout(() => {}, 99999);
        _pendingIncrements = 1;
        await _flushBlockedCount();
        assertEqual(_flushTimer, null);
    });
});

printResults();
