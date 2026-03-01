// ============================================================
// My AdBlock — resource-scanner.js  (content script)
// PerformanceObserver, DOM scanning, and MutationObserver
// for detecting ad resource loads.
// Depends on: blocklist-matcher.js (checkAndReport, blocklistReady),
//             cosmetic-filter.js (removeAdElements)
// ============================================================

// ---------------------
// Constants
// ---------------------

/** Selector for DOM elements whose src/href should be checked. */
const RESOURCE_ELEMENT_SELECTOR =
    "script[src], img[src], iframe[src], link[href], video[src], source[src]";

/** Polling interval (ms) when PerformanceObserver is unavailable. */
const POLL_INTERVAL_MS = 2000;

/** Debounce delay (ms) for MutationObserver callbacks. */
const MUTATION_DEBOUNCE_MS = 500;

// ---------------------
// PerformanceObserver — detects all resource load attempts
// ---------------------
function startPerformanceObserver() {
    try {
        const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                checkAndReport(entry.name);
            }
        });
        observer.observe({ type: "resource", buffered: true });
    } catch {
        console.warn("[My AdBlock] PerformanceObserver not available, using polling fallback.");
        startPollingFallback();
    }
}

// ---------------------
// Scan resources already in performance buffer
// ---------------------
function scanExistingResources() {
    try {
        const entries = performance.getEntriesByType("resource");
        for (const entry of entries) {
            checkAndReport(entry.name);
        }
    } catch {
        // ignore
    }
}

// ---------------------
// Fallback: poll performance entries periodically
// ---------------------
let pollingInterval = null;

function startPollingFallback() {
    if (pollingInterval) return;
    pollingInterval = setInterval(scanExistingResources, POLL_INTERVAL_MS);
}

// ---------------------
// DOM scanning — check src/href attributes on elements
// ---------------------
function scanDOMResources() {
    if (!blocklistReady) return;

    try {
        const elements = document.querySelectorAll(RESOURCE_ELEMENT_SELECTOR);
        for (const el of elements) {
            const url = el.src || el.href;
            if (url) checkAndReport(url);
        }
    } catch {
        // ignore
    }
}

// ---------------------
// MutationObserver — catch dynamically inserted elements
// ---------------------
let mutationTimeout = null;

function startMutationObserver() {
    const observer = new MutationObserver(() => {
        if (mutationTimeout) return;
        mutationTimeout = setTimeout(() => {
            mutationTimeout = null;
            scanDOMResources();
            removeAdElements();
        }, MUTATION_DEBOUNCE_MS);
    });

    observer.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true,
    });
}
