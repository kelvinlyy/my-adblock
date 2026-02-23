// ============================================================
// My AdBlock — background.js (Service Worker)
// Logs blocked requests, maintains counters, manages custom rules.
// Counting relies on content.js reporting blocked URLs via message.
// ============================================================

// ---------------------
// Constants
// ---------------------
const STORAGE_KEY_ALL_TIME = "allTimeBlockedCount";
const STORAGE_KEY_CUSTOM_RULES = "customRules";
const DYNAMIC_RULE_ID_START = 10000;
const SESSION_LOG_MAX = 5000;
const SESSION_LOG_TRIM = 4000;

/** Resource types applied to every blocking rule. */
const DNR_RESOURCE_TYPES = [
    "script", "image", "xmlhttprequest", "sub_frame",
    "stylesheet", "font", "media", "ping", "other"
];

// ---------------------
// Built-in blocklist (mirrors rules.json — used by content script)
// ---------------------
const BLOCKED_HOSTS = [
    "doubleclick.net",
    "googleadservices.com",
    "googlesyndication.com",
    "adservice.google.com",
    "ads.yahoo.com",
    "adnxs.com",
    "adsafeprotected.com",
    "moatads.com",
    "outbrain.com",
    "taboola.com",
    "scorecardresearch.com",
    "quantserve.com",
    "adzerk.net",
    "rubiconproject.com",
    "pubmatic.com",
    "openx.net",
    "criteo.com",
    "bluekai.com",
    "exelate.com",
    "zergnet.com",
    "amazon-adsystem.com",
    "advertising.com",
    "bidswitch.net",
    "casalemedia.com",
    "demdex.net",
    "mathtag.com",
    "serving-sys.com",
    "turn.com",
    "medianet.com",
    "sharethrough.com",
];

const BLOCKED_PATH_PATTERNS = [
    "/ads/",
    "/ad/",
    "/adserver/",
    "/advertising/",
    "/tracking/",
    "/tracker/",
    "/analytics/",
    "/pixel/",
    "/beacon/",
    "/telemetry/",
    "/pagead/",
    "/adsense/",
    "/adclick/",
    "/sponsored/",
];

// ---------------------
// Session state
// ---------------------
let sessionBlockedCount = 0;
let sessionBlockedRequests = []; // { url, timestamp, matchedRule, ruleType }

// In-memory cache of custom rules for content script
let customRulesCache = [];

// ---------------------
// Helpers
// ---------------------

/** Read custom rules from storage (returns array). */
async function getStoredCustomRules() {
    const data = await browser.storage.local.get({ [STORAGE_KEY_CUSTOM_RULES]: [] });
    return data[STORAGE_KEY_CUSTOM_RULES] || [];
}

/** Persist custom rules and update cache. */
async function saveCustomRules(rules) {
    await browser.storage.local.set({ [STORAGE_KEY_CUSTOM_RULES]: rules });
    customRulesCache = rules;
}

/** Compute the `urlFilter` string for a custom rule. */
function buildUrlFilter(ruleType, value) {
    if (ruleType === "host") {
        return `||${value}`;
    }
    return value.startsWith("*") || value.startsWith("|") ? value : `*${value}*`;
}

/** Create a declarativeNetRequest rule object. */
function buildDnrRule(id, urlFilter) {
    return {
        id,
        priority: 1,
        action: { type: "block" },
        condition: { urlFilter, resourceTypes: DNR_RESOURCE_TYPES },
    };
}

/** Compute the next rule ID from an existing array of custom rules. */
function nextRuleId(rules) {
    return rules.length > 0
        ? Math.max(...rules.map((r) => r.id)) + 1
        : DYNAMIC_RULE_ID_START;
}

// ---------------------
// Dedup — avoid double-counting the same URL on the same page
// ---------------------
const recentlyLogged = new Set();
const DEDUP_TTL_MS = 2000;

function dedup(url) {
    if (recentlyLogged.has(url)) return false;
    recentlyLogged.add(url);
    setTimeout(() => recentlyLogged.delete(url), DEDUP_TTL_MS);
    return true;
}

// ---------------------
// Record a blocked request (called when content.js reports one)
// ---------------------
function recordBlocked(url, matchedRule, ruleType) {
    if (!dedup(url)) return;

    sessionBlockedCount++;
    sessionBlockedRequests.push({ url, timestamp: Date.now(), matchedRule, ruleType });

    // Cap session log to prevent unbounded growth
    if (sessionBlockedRequests.length > SESSION_LOG_MAX) {
        sessionBlockedRequests = sessionBlockedRequests.slice(-SESSION_LOG_TRIM);
    }

    // Increment persistent all-time counter
    browser.storage.local.get({ [STORAGE_KEY_ALL_TIME]: 0 }).then((data) => {
        browser.storage.local.set({ [STORAGE_KEY_ALL_TIME]: (data[STORAGE_KEY_ALL_TIME] || 0) + 1 });
    });
}

// ---------------------
// Message handler (popup + content script ↔ background)
// ---------------------
browser.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
    switch (message.type) {
        case "reportBlocked":
            recordBlocked(message.url, message.matchedRule, message.ruleType);
            return Promise.resolve({ ok: true });

        case "getBlocklist":
            return getStoredCustomRules().then((custom) => ({
                hosts: BLOCKED_HOSTS,
                pathPatterns: BLOCKED_PATH_PATTERNS,
                customRules: custom,
            }));

        case "getStats":
            return browser.storage.local.get({ [STORAGE_KEY_ALL_TIME]: 0 }).then((data) => ({
                sessionBlocked: sessionBlockedCount,
                allTimeBlocked: data[STORAGE_KEY_ALL_TIME] || 0,
                blockedRequests: sessionBlockedRequests.slice(-500),
            }));

        case "clearSession":
            sessionBlockedCount = 0;
            sessionBlockedRequests = [];
            return Promise.resolve({ success: true });

        case "getCustomRules":
            return getStoredCustomRules().then((rules) => ({ rules }));

        case "addCustomRule":
            return addCustomRule(message.ruleType, message.value);

        case "removeCustomRule":
            return removeCustomRule(message.ruleId);

        case "getRuleCounts":
            return getRuleCounts();

        case "exportRules":
            return exportRules();

        case "importRules":
            return importRules(message.rules);

        default:
            return Promise.resolve({ error: "Unknown message type" });
    }
});

// ---------------------
// Custom rule management
// ---------------------

async function addCustomRule(ruleType, value) {
    if (!value || !value.trim()) {
        return { error: "Rule value cannot be empty" };
    }

    const trimmed = value.trim().toLowerCase();
    const customRules = await getStoredCustomRules();

    if (customRules.some((r) => r.value === trimmed)) {
        return { error: "Rule already exists" };
    }

    const id = nextRuleId(customRules);
    const urlFilter = buildUrlFilter(ruleType, trimmed);

    try {
        await browser.declarativeNetRequest.updateDynamicRules({
            addRules: [buildDnrRule(id, urlFilter)],
            removeRuleIds: [],
        });
    } catch (e) {
        return { error: `Failed to register rule: ${e.message}` };
    }

    const newEntry = { id, ruleType, value: trimmed, urlFilter };
    customRules.push(newEntry);
    await saveCustomRules(customRules);

    return { success: true, rule: newEntry };
}

async function removeCustomRule(ruleId) {
    const customRules = await getStoredCustomRules();
    const idx = customRules.findIndex((r) => r.id === ruleId);

    if (idx === -1) {
        return { error: "Rule not found" };
    }

    try {
        await browser.declarativeNetRequest.updateDynamicRules({
            addRules: [],
            removeRuleIds: [ruleId],
        });
    } catch (e) {
        return { error: `Failed to remove rule: ${e.message}` };
    }

    customRules.splice(idx, 1);
    await saveCustomRules(customRules);

    return { success: true };
}

async function getRuleCounts() {
    const customRules = await getStoredCustomRules();
    const customCount = customRules.length;

    let builtinCount = 43;
    try {
        const rulesets = await browser.declarativeNetRequest.getEnabledRulesets();
        if (!rulesets.includes("builtin_rules")) {
            builtinCount = 0;
        }
    } catch {
        // fallback
    }

    return { builtinCount, customCount, total: builtinCount + customCount };
}

// ---------------------
// Import / Export
// ---------------------

async function exportRules() {
    const customRules = await getStoredCustomRules();

    return {
        success: true,
        data: {
            version: 1,
            exportedAt: new Date().toISOString(),
            rules: customRules.map((r) => ({ ruleType: r.ruleType, value: r.value })),
        },
    };
}

async function importRules(incomingRules) {
    if (!Array.isArray(incomingRules) || incomingRules.length === 0) {
        return { error: "No valid rules found in file." };
    }

    const existingRules = await getStoredCustomRules();
    const existingValues = new Set(existingRules.map((r) => r.value));
    let id = nextRuleId(existingRules);

    const newEntries = [];
    const dnrRulesToAdd = [];
    let skipped = 0;

    for (const incoming of incomingRules) {
        const { ruleType } = incoming;
        const value = (incoming.value || "").trim().toLowerCase();

        if (!value || !["host", "pattern"].includes(ruleType)) {
            skipped++;
            continue;
        }
        if (existingValues.has(value)) {
            skipped++;
            continue;
        }

        const urlFilter = buildUrlFilter(ruleType, value);
        newEntries.push({ id, ruleType, value, urlFilter });
        dnrRulesToAdd.push(buildDnrRule(id, urlFilter));

        existingValues.add(value);
        id++;
    }

    if (newEntries.length === 0) {
        return { error: `No new rules to import (${skipped} skipped as duplicates or invalid).` };
    }

    try {
        await browser.declarativeNetRequest.updateDynamicRules({
            addRules: dnrRulesToAdd,
            removeRuleIds: [],
        });
    } catch (e) {
        return { error: `Failed to register imported rules: ${e.message}` };
    }

    await saveCustomRules([...existingRules, ...newEntries]);

    return { success: true, imported: newEntries.length, skipped };
}

// ---------------------
// Restore dynamic rules & populate cache on startup
// ---------------------
async function restoreDynamicRules() {
    const customRules = await getStoredCustomRules();
    customRulesCache = customRules;

    if (customRules.length === 0) return;

    const dnrRules = customRules.map((r) => buildDnrRule(r.id, r.urlFilter));

    const existingDynamic = await browser.declarativeNetRequest.getDynamicRules();
    const existingIds = existingDynamic.map((r) => r.id);

    try {
        await browser.declarativeNetRequest.updateDynamicRules({
            addRules: dnrRules,
            removeRuleIds: existingIds,
        });
    } catch (e) {
        console.error("[My AdBlock] Failed to restore dynamic rules:", e);
    }
}

restoreDynamicRules();
console.log("[My AdBlock] Background service worker loaded.");
