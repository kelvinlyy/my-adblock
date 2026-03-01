// ============================================================
// My AdBlock — cosmetic-filter.js  (content script)
// CSS-based and DOM-based ad element hiding.
// ============================================================

// ---------------------
// Selectors for common ad elements
// ---------------------
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

// ---------------------
// Inject CSS to hide ads immediately
// ---------------------
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

// ---------------------
// Remove ad elements from the DOM
// ---------------------
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
