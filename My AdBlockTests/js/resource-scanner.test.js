// ============================================================
// Tests for resource-scanner.js
// ============================================================

const {
    describe, it, assertEqual, assertTrue, assertFalse,
    printResults, createBrowserMock, createDOMMock, loadScript,
} = require("./test-harness");

// Set up global mocks
globalThis.browser = createBrowserMock();
globalThis.document = createDOMMock();
globalThis.location = { hostname: "example.com" };

// Stub dependencies from blocklist-matcher.js
let checkAndReportCalls = [];
globalThis.checkAndReport = (url) => { checkAndReportCalls.push(url); };
globalThis.blocklistReady = true;

// Stub cosmetic-filter.js dependency
globalThis.removeAdElements = () => {};

// Stub performance API
globalThis.performance = {
    _entries: [],
    getEntriesByType(type) {
        return this._entries;
    },
};

// Stub PerformanceObserver
globalThis.PerformanceObserver = class {
    constructor(callback) { this._callback = callback; }
    observe() {}
};

// Stub MutationObserver
globalThis.MutationObserver = class {
    constructor(callback) { this._callback = callback; }
    observe() {}
};

// Load the module under test
loadScript("../../My AdBlock Extension/Resources/content/resource-scanner.js");

function resetScanner() {
    checkAndReportCalls = [];
    performance._entries = [];
    pollingInterval = null;
    mutationTimeout = null;
}

// ---------------------
// scanExistingResources
// ---------------------

describe("scanExistingResources", () => {
    it("should call checkAndReport for each performance entry", () => {
        resetScanner();
        performance._entries = [
            { name: "https://ads.com/ad.js" },
            { name: "https://tracker.net/pixel.gif" },
        ];

        scanExistingResources();

        assertEqual(checkAndReportCalls.length, 2);
        assertEqual(checkAndReportCalls[0], "https://ads.com/ad.js");
        assertEqual(checkAndReportCalls[1], "https://tracker.net/pixel.gif");
    });

    it("should handle empty performance entries", () => {
        resetScanner();
        performance._entries = [];
        scanExistingResources();
        assertEqual(checkAndReportCalls.length, 0);
    });

    it("should not throw when performance API fails", () => {
        resetScanner();
        const orig = performance.getEntriesByType;
        performance.getEntriesByType = () => { throw new Error("fail"); };
        scanExistingResources(); // Should not throw
        performance.getEntriesByType = orig;
    });
});

// ---------------------
// scanDOMResources
// ---------------------

describe("scanDOMResources", () => {
    it("should check src/href of resource elements", () => {
        resetScanner();
        blocklistReady = true;

        const mockElements = [
            { src: "https://ads.com/script.js", href: "" },
            { src: "", href: "https://cdn.com/style.css" },
            { src: "https://tracker.com/pixel.gif", href: "" },
        ];
        document.querySelectorAll = () => mockElements;

        scanDOMResources();

        assertEqual(checkAndReportCalls.length, 3);
        assertEqual(checkAndReportCalls[0], "https://ads.com/script.js");
        assertEqual(checkAndReportCalls[1], "https://cdn.com/style.css");
        assertEqual(checkAndReportCalls[2], "https://tracker.com/pixel.gif");
    });

    it("should skip elements without src or href", () => {
        resetScanner();
        blocklistReady = true;

        document.querySelectorAll = () => [{ src: "", href: "" }];
        scanDOMResources();
        assertEqual(checkAndReportCalls.length, 0);
    });

    it("should do nothing when blocklist not ready", () => {
        resetScanner();
        blocklistReady = false;

        document.querySelectorAll = () => [{ src: "https://ads.com/ad.js" }];
        scanDOMResources();
        assertEqual(checkAndReportCalls.length, 0);
    });
});

// ---------------------
// startPollingFallback
// ---------------------

describe("startPollingFallback", () => {
    it("should set pollingInterval", () => {
        resetScanner();
        globalThis.setInterval = (fn, ms) => {
            return 12345; // Fake interval ID
        };

        startPollingFallback();
        assertEqual(pollingInterval, 12345);
    });

    it("should not set multiple intervals", () => {
        resetScanner();
        let callCount = 0;
        globalThis.setInterval = (fn, ms) => {
            callCount++;
            pollingInterval = callCount;
            return callCount;
        };

        startPollingFallback();
        startPollingFallback();
        assertEqual(callCount, 1);
    });
});

// ---------------------
// startPerformanceObserver
// ---------------------

describe("startPerformanceObserver", () => {
    it("should create a PerformanceObserver", () => {
        resetScanner();
        let observerCreated = false;
        globalThis.PerformanceObserver = class {
            constructor(cb) { observerCreated = true; }
            observe() {}
        };

        startPerformanceObserver();
        assertTrue(observerCreated);
    });

    it("should fall back to polling when PerformanceObserver is unavailable", () => {
        resetScanner();
        globalThis.PerformanceObserver = class {
            constructor() { throw new Error("not supported"); }
        };
        let fallbackCalled = false;
        const origSetInterval = globalThis.setInterval;
        globalThis.setInterval = (fn, ms) => { fallbackCalled = true; return 1; };

        startPerformanceObserver();
        assertTrue(fallbackCalled);
        globalThis.setInterval = origSetInterval;
    });
});

// ---------------------
// startMutationObserver
// ---------------------

describe("startMutationObserver", () => {
    it("should create a MutationObserver", () => {
        resetScanner();
        let observerCreated = false;
        globalThis.MutationObserver = class {
            constructor(cb) { observerCreated = true; this._cb = cb; }
            observe() {}
        };

        startMutationObserver();
        assertTrue(observerCreated);
    });

    it("should observe document.body", () => {
        resetScanner();
        let observeTarget = null;
        globalThis.MutationObserver = class {
            constructor(cb) { this._cb = cb; }
            observe(target, opts) { observeTarget = target; }
        };

        startMutationObserver();
        assertTrue(observeTarget !== null);
    });
});

// ---------------------
// Constants
// ---------------------

describe("resource-scanner constants", () => {
    it("should define RESOURCE_ELEMENT_SELECTOR", () => {
        assertTrue(typeof RESOURCE_ELEMENT_SELECTOR === "string");
        assertTrue(RESOURCE_ELEMENT_SELECTOR.includes("script[src]"));
        assertTrue(RESOURCE_ELEMENT_SELECTOR.includes("img[src]"));
        assertTrue(RESOURCE_ELEMENT_SELECTOR.includes("iframe[src]"));
    });

    it("should define POLL_INTERVAL_MS", () => {
        assertEqual(POLL_INTERVAL_MS, 2000);
    });

    it("should define MUTATION_DEBOUNCE_MS", () => {
        assertEqual(MUTATION_DEBOUNCE_MS, 500);
    });
});

printResults();
