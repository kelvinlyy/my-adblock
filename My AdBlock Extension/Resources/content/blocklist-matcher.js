// ============================================================
// My AdBlock — blocklist-matcher.js  (content script)
// URL matching against custom blocklist rules.
// ============================================================

/** @type {{ ruleType: string, value: string }[]} */
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
        customRules = resp.customRules || [];
        blocklistReady = true;

        // Process any resources that loaded before the blocklist arrived
        scanExistingResources();
    } catch (e) {
        console.warn("[My AdBlock] Could not fetch blocklist:", e);
    }
}

// ---------------------
// URL matching
// ---------------------
function matchesBlocklist(url) {
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase();

        for (const rule of customRules) {
            if (rule.ruleType === "host") {
                if (hostname === rule.value || hostname.endsWith(`.${rule.value}`)) {
                    return { matched: true, rule: rule.value, type: "host" };
                }
            } else if (url.toLowerCase().includes(rule.value)) {
                return { matched: true, rule: rule.value, type: "pattern" };
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
        pageHostname: location.hostname,
        matchedRule,
        ruleType,
    }).catch(() => {
        // Extension context may be invalidated — ignore
    });
}

// ---------------------
// Check a resource URL and report if it matches
// ---------------------
function checkAndReport(url) {
    if (!blocklistReady) return;
    if (!url || url === "about:blank" || url.startsWith("data:")) return;

    const result = matchesBlocklist(url);
    if (result.matched) {
        reportBlocked(url, result.rule, result.type);
    }
}
