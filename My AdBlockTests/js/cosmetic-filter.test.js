// ============================================================
// Tests for cosmetic-filter.js
// ============================================================

const {
    describe, it, assertEqual, assertTrue, assertFalse,
    printResults, createDOMMock, loadScript,
} = require("./test-harness");

// Set up global DOM mock
globalThis.document = createDOMMock();

// Load the module under test
loadScript("../../My AdBlock Extension/Resources/content/cosmetic-filter.js");

// ---------------------
// AD_SELECTORS
// ---------------------

describe("AD_SELECTORS", () => {
    it("should be a non-empty array", () => {
        assertTrue(Array.isArray(AD_SELECTORS));
        assertTrue(AD_SELECTORS.length > 0);
    });

    it("should include Google Ads selectors", () => {
        assertTrue(AD_SELECTORS.includes('ins.adsbygoogle'));
        assertTrue(AD_SELECTORS.includes('[id^="google_ads"]'));
        assertTrue(AD_SELECTORS.includes('[id^="div-gpt-ad"]'));
    });

    it("should include doubleclick iframe selector", () => {
        assertTrue(AD_SELECTORS.includes('iframe[src*="doubleclick.net"]'));
    });

    it("should include common ad container selectors", () => {
        assertTrue(AD_SELECTORS.includes('#ad-container'));
        assertTrue(AD_SELECTORS.includes('.ad-container'));
        assertTrue(AD_SELECTORS.includes('.advertisement'));
        assertTrue(AD_SELECTORS.includes('.sponsored-content'));
    });

    it("should include Taboola and Outbrain selectors", () => {
        assertTrue(AD_SELECTORS.includes('.taboola'));
        assertTrue(AD_SELECTORS.includes('.outbrain'));
        assertTrue(AD_SELECTORS.includes('[class*="taboola"]'));
        assertTrue(AD_SELECTORS.includes('[class*="outbrain"]'));
    });

    it("should include data attribute selectors", () => {
        assertTrue(AD_SELECTORS.includes('[data-ad]'));
        assertTrue(AD_SELECTORS.includes('[data-ad-slot]'));
        assertTrue(AD_SELECTORS.includes('[data-google-query-id]'));
    });

    it("should include ARIA label selectors", () => {
        assertTrue(AD_SELECTORS.includes('[aria-label="advertisement"]'));
        assertTrue(AD_SELECTORS.includes('[aria-label="Advertisement"]'));
        assertTrue(AD_SELECTORS.includes('[aria-label="Sponsored"]'));
    });
});

// ---------------------
// AD_SELECTOR_STRING
// ---------------------

describe("AD_SELECTOR_STRING", () => {
    it("should be a comma-separated string of all selectors", () => {
        assertTrue(typeof AD_SELECTOR_STRING === "string");
        // Each selector should appear in the combined string
        for (const sel of AD_SELECTORS) {
            assertTrue(AD_SELECTOR_STRING.includes(sel));
        }
    });
});

// ---------------------
// injectAdHidingCSS
// ---------------------

describe("injectAdHidingCSS", () => {
    it("should create a style element", () => {
        // Override getElementById to return null (style not yet injected)
        const origGetById = document.getElementById;
        document.getElementById = (id) => null;

        let appendedNode = null;
        const origAppend = document.head.appendChild;
        document.head.appendChild = (node) => { appendedNode = node; };

        injectAdHidingCSS();

        assertTrue(appendedNode !== null);
        assertEqual(appendedNode.id, "my-adblock-cosmetic-css");

        document.getElementById = origGetById;
        document.head.appendChild = origAppend;
    });

    it("should include display:none rules in style content", () => {
        document.getElementById = (id) => null;
        let appendedNode = null;
        document.head.appendChild = (node) => { appendedNode = node; };

        injectAdHidingCSS();

        assertTrue(appendedNode.textContent.includes("display: none !important"));
        assertTrue(appendedNode.textContent.includes("visibility: hidden !important"));

        document.getElementById = createDOMMock().getElementById;
    });

    it("should include rules for all selectors", () => {
        document.getElementById = (id) => null;
        let appendedNode = null;
        document.head.appendChild = (node) => { appendedNode = node; };

        injectAdHidingCSS();

        for (const sel of AD_SELECTORS) {
            assertTrue(
                appendedNode.textContent.includes(sel),
                `Style should contain selector: ${sel}`
            );
        }

        document.getElementById = createDOMMock().getElementById;
    });

    it("should not inject twice (idempotent)", () => {
        let callCount = 0;
        document.head.appendChild = () => { callCount++; };

        // First call — style not present → inject
        document.getElementById = (id) => null;
        injectAdHidingCSS();
        assertEqual(callCount, 1);

        // Second call — style already present → skip
        document.getElementById = (id) => (id === "my-adblock-cosmetic-css" ? { id } : null);
        injectAdHidingCSS();
        assertEqual(callCount, 1);

        document.getElementById = createDOMMock().getElementById;
    });
});

// ---------------------
// removeAdElements
// ---------------------

describe("removeAdElements", () => {
    it("should call querySelectorAll with AD_SELECTOR_STRING", () => {
        let queriedSelector = null;
        document.querySelectorAll = (sel) => {
            queriedSelector = sel;
            return [];
        };

        removeAdElements();
        assertEqual(queriedSelector, AD_SELECTOR_STRING);
    });

    it("should call remove() on each matched element", () => {
        let removedCount = 0;
        const mockAds = [
            { remove() { removedCount++; } },
            { remove() { removedCount++; } },
            { remove() { removedCount++; } },
        ];
        document.querySelectorAll = () => mockAds;

        removeAdElements();
        assertEqual(removedCount, 3);
    });

    it("should not throw when no elements found", () => {
        document.querySelectorAll = () => [];
        removeAdElements(); // Should not throw
    });
});

printResults();
