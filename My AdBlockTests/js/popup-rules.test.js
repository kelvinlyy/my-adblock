// ============================================================
// Tests for popup-rules.js (renderCustomRules, updatePagination)
// ============================================================

const {
    describe, it, assertEqual, assertTrue, assertFalse, assertContains,
    printResults, createDOMMock, createBrowserMock, loadScript,
} = require("./test-harness");

// Set up global mocks
globalThis.document = createDOMMock();
globalThis.browser = createBrowserMock();

// Pre-register all elements needed by popup modules
const elementIds = [
    "ruleError", "siteCount", "sessionCount", "ruleCount",
    "blockedList", "searchInput", "clearSessionBtn",
    "customRulesList", "ruleType", "ruleValue", "addRuleBtn",
    "exportRulesBtn", "importRulesBtn", "importFileInput",
    "clearAllRulesBtn", "rulesSearchInput", "rulesPagination",
    "rulesPrevBtn", "rulesNextBtn", "rulesPageInfo",
];
for (const id of elementIds) document._registerElement(id);

// Provide navigator mock (popup-rules.js checks for macOS)
globalThis.navigator = { userAgent: "Mozilla/5.0 (Macintosh)" };

// Load popup-ui.js dependency
loadScript("../../My AdBlock Extension/Resources/popup/popup-ui.js");

// Provide global DOM element references that popup-stats.js & popup-blocked.js expect
globalThis.siteCountEl = document.getElementById("siteCount");
globalThis.sessionCountEl = document.getElementById("sessionCount");
globalThis.ruleCountEl = document.getElementById("ruleCount");
globalThis.currentBlockedRequests = [];
globalThis.blockedList = document.getElementById("blockedList");
globalThis.searchInput = document.getElementById("searchInput");
globalThis.clearSessionBtn = document.getElementById("clearSessionBtn");

// Stubs for dependencies
globalThis.loadStats = async () => {};
globalThis.renderBlockedList = () => {};
globalThis.parseEasyList = () => [];

// Load the module under test (has side effects with addEventListener)
loadScript("../../My AdBlock Extension/Resources/popup/popup-rules.js");

// Grab references from global scope (set by vm.runInNewContext)
const customRulesList = document.getElementById("customRulesList");
const rulesPagination = document.getElementById("rulesPagination");
const rulesPrevBtn = document.getElementById("rulesPrevBtn");
const rulesNextBtn = document.getElementById("rulesNextBtn");
const rulesPageInfo = document.getElementById("rulesPageInfo");

// ---------------------
// renderCustomRules
// ---------------------

describe("renderCustomRules", () => {
    it("should show empty message for null rules", () => {
        renderCustomRules(null);
        assertContains(customRulesList.innerHTML, "No custom rules added");
    });

    it("should show empty message for empty array", () => {
        renderCustomRules([]);
        assertContains(customRulesList.innerHTML, "No custom rules added");
    });

    it("should render rule entries", () => {
        const rules = [
            { id: 1, ruleType: "host", value: "ads.com", urlFilter: "||ads.com" },
            { id: 2, ruleType: "pattern", value: "/promo/", urlFilter: "*/promo/*" },
        ];

        let appendedFragment = null;
        customRulesList.appendChild = (frag) => { appendedFragment = frag; };

        renderCustomRules(rules);

        assertEqual(customRulesList.innerHTML, "");
        assertTrue(appendedFragment !== null);
        assertEqual(appendedFragment.children.length, 2);
    });

    it("should display rule type as tag", () => {
        const rules = [
            { id: 1, ruleType: "host", value: "ads.com", urlFilter: "||ads.com" },
        ];

        let appendedFragment = null;
        customRulesList.appendChild = (frag) => { appendedFragment = frag; };

        renderCustomRules(rules);

        const entry = appendedFragment.children[0];
        const tag = entry.children[0];
        assertEqual(tag.textContent, "host");
        assertContains(tag.className, "rule-tag");
        assertContains(tag.className, "host");
    });

    it("should display rule value", () => {
        const rules = [
            { id: 1, ruleType: "host", value: "ads.com", urlFilter: "||ads.com" },
        ];

        let appendedFragment = null;
        customRulesList.appendChild = (frag) => { appendedFragment = frag; };

        renderCustomRules(rules);

        const entry = appendedFragment.children[0];
        const value = entry.children[1];
        assertEqual(value.textContent, "ads.com");
        assertContains(value.title, "||ads.com");
    });

    it("should create remove button for each rule", () => {
        const rules = [
            { id: 1, ruleType: "host", value: "ads.com", urlFilter: "||ads.com" },
        ];

        let appendedFragment = null;
        customRulesList.appendChild = (frag) => { appendedFragment = frag; };

        renderCustomRules(rules);

        const entry = appendedFragment.children[0];
        const removeBtn = entry.children[2];
        assertEqual(removeBtn.textContent, "✕");
        assertContains(removeBtn.className, "rule-remove");
    });
});

// ---------------------
// updatePagination
// ---------------------

describe("updatePagination", () => {
    it("should hide pagination when totalPages <= 1", () => {
        updatePagination({ totalPages: 1, page: 1 });
        assertTrue(rulesPagination._classList.has("hidden"));
    });

    it("should hide pagination for null result", () => {
        updatePagination(null);
        assertTrue(rulesPagination._classList.has("hidden"));
    });

    it("should show pagination when totalPages > 1", () => {
        rulesPagination._classList.add("hidden");
        updatePagination({ totalPages: 3, page: 1 });
        assertFalse(rulesPagination._classList.has("hidden"));
    });

    it("should display correct page info", () => {
        updatePagination({ totalPages: 5, page: 2 });
        assertEqual(rulesPageInfo.textContent, "Page 2 / 5");
    });

    it("should disable prev button on first page", () => {
        updatePagination({ totalPages: 3, page: 1 });
        assertTrue(rulesPrevBtn.disabled);
        assertFalse(rulesNextBtn.disabled);
    });

    it("should disable next button on last page", () => {
        updatePagination({ totalPages: 3, page: 3 });
        assertFalse(rulesPrevBtn.disabled);
        assertTrue(rulesNextBtn.disabled);
    });

    it("should enable both buttons on middle page", () => {
        updatePagination({ totalPages: 3, page: 2 });
        assertFalse(rulesPrevBtn.disabled);
        assertFalse(rulesNextBtn.disabled);
    });
});

printResults();
