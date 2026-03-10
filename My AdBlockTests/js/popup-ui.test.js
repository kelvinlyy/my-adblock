// ============================================================
// Tests for popup-ui.js
// ============================================================

const {
    describe, it, assertEqual, assertTrue, assertFalse,
    printResults, createDOMMock, loadScript,
} = require("./test-harness");

// Set up global DOM mock
globalThis.document = createDOMMock();
// Pre-register elements used by popup-ui.js
document._registerElement("ruleError");

// Load the module under test
loadScript("../../My AdBlock Extension/Resources/popup/popup-ui.js");

// ---------------------
// formatNumber
// ---------------------

describe("formatNumber", () => {
    it("should format 0", () => {
        assertEqual(formatNumber(0), "0");
    });

    it("should format small numbers", () => {
        assertEqual(formatNumber(42), "42");
    });

    it("should format large numbers with locale separators", () => {
        const result = formatNumber(1000000);
        // Locale-dependent, but should contain the digits
        assertTrue(result.includes("1"));
        assertTrue(result.includes("000"));
    });

    it("should handle negative numbers", () => {
        const result = formatNumber(-5);
        assertTrue(result.includes("5"));
    });
});

// ---------------------
// formatTime
// ---------------------

describe("formatTime", () => {
    it("should format a timestamp as HH:MM:SS", () => {
        const ts = new Date(2024, 0, 1, 14, 30, 45).getTime();
        const result = formatTime(ts);
        // Should contain hour, minute, second
        assertTrue(result.includes("30"));
        assertTrue(result.includes("45"));
    });

    it("should handle midnight timestamp", () => {
        const ts = new Date(2024, 0, 1, 0, 0, 0).getTime();
        const result = formatTime(ts);
        assertTrue(typeof result === "string");
        assertTrue(result.length > 0);
    });
});

// ---------------------
// showToast
// ---------------------

describe("showToast", () => {
    it("should set message text on ruleError element", () => {
        const el = document.getElementById("ruleError");
        showToast("Test message");
        assertEqual(el.textContent, "Test message");
    });

    it("should remove hidden class", () => {
        const el = document.getElementById("ruleError");
        el._classList.add("hidden");
        showToast("Test");
        assertFalse(el._classList.has("hidden"));
    });

    it("should set error color by default", () => {
        const el = document.getElementById("ruleError");
        showToast("Error message");
        assertEqual(el.style.color, "");
    });

    it("should set accent color for non-error toast", () => {
        const el = document.getElementById("ruleError");
        showToast("Success!", { isError: false });
        assertEqual(el.style.color, "var(--accent)");
    });
});

// ---------------------
// setupToggle
// ---------------------

describe("setupToggle", () => {
    it("should attach a click listener to the toggle button", () => {
        const btn = document.createElement("button");
        const arrow = document.createElement("span");
        const body = document.createElement("div");
        const otherArrow = document.createElement("span");
        const otherBody = document.createElement("div");

        body._classList.add("collapsed");

        setupToggle(btn, arrow, body, otherArrow, otherBody);

        assertTrue(btn._eventListeners["click"].length > 0);
    });

    it("should expand collapsed section on click", () => {
        const btn = document.createElement("button");
        const arrow = document.createElement("span");
        const body = document.createElement("div");
        const otherArrow = document.createElement("span");
        const otherBody = document.createElement("div");

        body._classList.add("collapsed");

        setupToggle(btn, arrow, body, otherArrow, otherBody);
        btn.click();

        assertFalse(body._classList.has("collapsed"));
        assertTrue(body._classList.has("expanded"));
        assertTrue(arrow._classList.has("expanded"));
    });

    it("should collapse expanded section on click", () => {
        const btn = document.createElement("button");
        const arrow = document.createElement("span");
        const body = document.createElement("div");
        const otherArrow = document.createElement("span");
        const otherBody = document.createElement("div");

        body._classList.add("expanded");

        setupToggle(btn, arrow, body, otherArrow, otherBody);
        btn.click();

        assertTrue(body._classList.has("collapsed"));
        assertFalse(body._classList.has("expanded"));
        assertFalse(arrow._classList.has("expanded"));
    });

    it("should collapse other section when expanding", () => {
        const btn = document.createElement("button");
        const arrow = document.createElement("span");
        const body = document.createElement("div");
        const otherArrow = document.createElement("span");
        const otherBody = document.createElement("div");

        body._classList.add("collapsed");
        otherBody._classList.add("expanded");

        setupToggle(btn, arrow, body, otherArrow, otherBody);
        btn.click();

        // This section expanded
        assertTrue(body._classList.has("expanded"));
        // Other section collapsed
        assertTrue(otherBody._classList.has("collapsed"));
        assertFalse(otherBody._classList.has("expanded"));
        assertFalse(otherArrow._classList.has("expanded"));
    });
});

printResults();
