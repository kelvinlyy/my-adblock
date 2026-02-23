// ============================================================
// My AdBlock — content.js
// 1) Cosmetic filtering: hides common ad elements via CSS + DOM removal
// 2) Blocked-request detection: uses PerformanceObserver to detect
//    resource loads matching the blocklist, then reports them to
//    background.js for counting.
// ============================================================

(() => {
    "use strict";

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
    // Blocklist — fetched from background on init
    // ---------------------
    let blockedHosts = [];
    let blockedPathPatterns = [];
    let customRules = [];
    let blocklistReady = false;

    // Track URLs already reported to avoid duplicates within this page
    const reportedUrls = new Set();

    // ---------------------
    // Fetch blocklist from background.js
    // ---------------------
    async function fetchBlocklist() {
        try {
            const resp = await browser.runtime.sendMessage({ type: "getBlocklist" });
            blockedHosts = resp.hosts || [];
            blockedPathPatterns = resp.pathPatterns || [];
            customRules = resp.customRules || [];
            blocklistReady = true;

            // Process any resources that loaded before the blocklist arrived
            scanExistingResources();
        } catch (e) {
            console.warn("[My AdBlock] Could not fetch blocklist:", e);
        }
    }

    // ---------------------
    // URL matching (runs in content script context)
    // ---------------------
    function matchesBlocklist(url) {
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname.toLowerCase();
            const pathname = urlObj.pathname.toLowerCase();

            for (const host of blockedHosts) {
                if (hostname === host || hostname.endsWith(`.${host}`)) {
                    return { matched: true, rule: host, type: "host" };
                }
            }

            for (const pattern of blockedPathPatterns) {
                if (pathname.includes(pattern)) {
                    return { matched: true, rule: pattern, type: "pattern" };
                }
            }

            for (const rule of customRules) {
                if (rule.ruleType === "host") {
                    if (hostname === rule.value || hostname.endsWith(`.${rule.value}`)) {
                        return { matched: true, rule: rule.value, type: "custom-host" };
                    }
                } else if (url.toLowerCase().includes(rule.value)) {
                    return { matched: true, rule: rule.value, type: "custom-pattern" };
                }
            }
        } catch {
            // invalid URL — ignore
        }
        return { matched: false };
    }

    // ---------------------
    // Report a blocked URL to background.js
    // ---------------------
    function reportBlocked(url, matchedRule, ruleType) {
        if (reportedUrls.has(url)) return;
        reportedUrls.add(url);

        browser.runtime.sendMessage({
            type: "reportBlocked",
            url,
            matchedRule,
            ruleType,
        }).catch(() => {
            // Extension context may be invalidated — ignore
        });
    }

    // ---------------------
    // Check a resource URL and report if it matches blocklist
    // ---------------------
    function checkAndReport(url) {
        if (!blocklistReady) return;
        if (!url || url === "about:blank" || url.startsWith("data:")) return;

        const result = matchesBlocklist(url);
        if (result.matched) {
            reportBlocked(url, result.rule, result.type);
        }
    }

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

    // ===========================================================
    // Cosmetic filtering (ad element hiding)
    // ===========================================================

    const AD_SELECTORS = [
        // Google Ads
        'ins.adsbygoogle',
        'iframe[src*="doubleclick.net"]',
        'iframe[src*="googlesyndication.com"]',
        'iframe[src*="googleadservices.com"]',
        '[id^="google_ads"]',
        '[id^="div-gpt-ad"]',

        // Common ad container IDs
        '#ad-container', '#ad-wrapper', '#ad-banner', '#ads', '#advert',
        '#sidebar-ad', '#top-ad', '#bottom-ad', '#footer-ad',

        // Common ad container classes
        '.ad-container', '.ad-wrapper', '.ad-banner', '.ad-slot',
        '.ad-unit', '.ad-block', '.ad-placement', '.ad-leaderboard',
        '.ad-sidebar', '.ads-banner', '.advertisement', '.advertising',
        '.advert', '.adbanner', '.adbox', '.adspot',
        '.sponsored-content', '.sponsored-ad', '.promoted-content',

        // Third-party widgets
        '.taboola', '.outbrain',
        '[class*="taboola"]', '[class*="outbrain"]',
        '[id*="taboola"]', '[id*="outbrain"]',

        // Data attributes
        '[data-ad]', '[data-ad-slot]', '[data-ad-unit]',
        '[data-adunit]', '[data-google-query-id]',

        // ARIA labels
        '[aria-label="advertisement"]', '[aria-label="Advertisement"]',
        '[aria-label="Sponsored"]',
    ];

    /** Combined selector string for all ad patterns. */
    const AD_SELECTOR_STRING = AD_SELECTORS.join(", ");

    function injectAdHidingCSS() {
        const styleId = "my-adblock-cosmetic-css";
        if (document.getElementById(styleId)) return;

        const style = document.createElement("style");
        style.id = styleId;
        style.textContent = AD_SELECTORS.map(
            (sel) => `${sel} { display: none !important; visibility: hidden !important; height: 0 !important; overflow: hidden !important; }`
        ).join("\n");

        (document.head || document.documentElement).appendChild(style);
    }

    function removeAdElements() {
        try {
            const ads = document.querySelectorAll(AD_SELECTOR_STRING);
            for (const ad of ads) {
                ad.remove();
            }
        } catch {
            // ignore
        }
    }

    // ===========================================================
    // Init
    // ===========================================================

    // 1. Cosmetic filtering — immediate
    injectAdHidingCSS();
    removeAdElements();

    // 2. Fetch blocklist then start detection
    fetchBlocklist();

    // 3. Start PerformanceObserver for resource detection
    startPerformanceObserver();

    // 4. Start DOM observer when body is ready
    if (document.body) {
        scanDOMResources();
        startMutationObserver();
    } else {
        document.addEventListener("DOMContentLoaded", () => {
            removeAdElements();
            scanDOMResources();
            startMutationObserver();
        });
    }

    // 5. Final scan after page fully loads (catches late resources)
    window.addEventListener("load", () => {
        scanExistingResources();
        scanDOMResources();
    });
})();
