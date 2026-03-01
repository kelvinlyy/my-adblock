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

/**
 * Safari allows up to 30 000 combined dynamic + session rules.
 * We reserve a small buffer so other operations don't fail.
 */
const MAX_DYNAMIC_RULES = 29500;

/** Max rules per single updateDynamicRules call to avoid timeouts. */
const DNR_BATCH_SIZE = 5000;

/** Resource types applied to every blocking rule. */
const DNR_RESOURCE_TYPES = [
    "script", "image", "xmlhttprequest", "sub_frame",
    "stylesheet", "font", "media", "ping", "other"
];

// ---------------------
// Session state
// ---------------------
let sessionBlockedCount = 0;
let sessionBlockedRequests = []; // { url, timestamp, matchedRule, ruleType }

// ---------------------
// Helpers
// ---------------------

/** Read custom rules from storage (returns array). */
async function getStoredCustomRules() {
    const data = await browser.storage.local.get({ [STORAGE_KEY_CUSTOM_RULES]: [] });
    return data[STORAGE_KEY_CUSTOM_RULES] || [];
}

/** Persist custom rules to storage. */
async function saveCustomRules(rules) {
    try {
        await browser.storage.local.set({ [STORAGE_KEY_CUSTOM_RULES]: rules });
    } catch (e) {
        console.error("[My AdBlock] Failed to save rules:", e.message);
        throw e;
    }
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
    if (rules.length === 0) return DYNAMIC_RULE_ID_START;
    let max = rules[0].id;
    for (let i = 1; i < rules.length; i++) {
        if (rules[i].id > max) max = rules[i].id;
    }
    return max + 1;
}

/** Return how many more DNR dynamic rules we can register. */
async function getAvailableDnrSlots() {
    try {
        const existing = await browser.declarativeNetRequest.getDynamicRules();
        return Math.max(0, MAX_DYNAMIC_RULES - existing.length);
    } catch {
        return MAX_DYNAMIC_RULES;
    }
}

/**
 * Register an array of DNR rule objects in batches.
 * Returns the number of rules successfully registered.
 */
async function batchRegisterDnrRules(dnrRules) {
    let registered = 0;
    for (let i = 0; i < dnrRules.length; i += DNR_BATCH_SIZE) {
        const batch = dnrRules.slice(i, i + DNR_BATCH_SIZE);
        try {
            await browser.declarativeNetRequest.updateDynamicRules({
                addRules: batch,
                removeRuleIds: [],
            });
            registered += batch.length;
        } catch (e) {
            console.warn(`[My AdBlock] DNR batch ${i}–${i + batch.length} failed:`, e.message);
            break; // stop on first failure — remaining rules still work via content script
        }
    }
    return registered;
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
                customRules: custom.map((r) => ({ ruleType: r.ruleType, value: r.value })),
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
            return getCustomRulesPaginated(message.page || 1, message.pageSize || 50, message.search || "");

        case "addCustomRule":
            return addCustomRule(message.ruleType, message.value);

        case "removeCustomRule":
            return removeCustomRule(message.ruleId);

        case "getRuleCounts":
            return getRuleCounts();

        case "exportRules":
            return exportRules();

        case "importRulesBatch":
            return importRulesBatch(message.rules);

        case "importFinalize":
            return importFinalize();

        case "clearAllRules":
            return clearAllRules();

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
    let dnrRegistered = false;

    const availableSlots = await getAvailableDnrSlots();
    if (availableSlots > 0) {
        try {
            await browser.declarativeNetRequest.updateDynamicRules({
                addRules: [buildDnrRule(id, urlFilter)],
                removeRuleIds: [],
            });
            dnrRegistered = true;
        } catch (e) {
            console.warn("[My AdBlock] DNR registration failed, rule will work via content script:", e.message);
        }
    }

    const newEntry = { id, ruleType, value: trimmed, urlFilter, dnrRegistered };
    customRules.push(newEntry);
    await saveCustomRules(customRules);

    return { success: true, rule: newEntry };
}

async function removeCustomRule(ruleId) {
    const numericId = Number(ruleId);
    const customRules = await getStoredCustomRules();
    const idx = customRules.findIndex((r) => Number(r.id) === numericId);

    if (idx === -1) {
        return { error: "Rule not found" };
    }

    const removed = customRules[idx];

    // Only remove from DNR if it was registered there
    if (removed.dnrRegistered) {
        try {
            await browser.declarativeNetRequest.updateDynamicRules({
                addRules: [],
                removeRuleIds: [numericId],
            });
        } catch (e) {
            return { error: `Failed to remove rule: ${e.message}` };
        }
    }

    customRules.splice(idx, 1);

    // Backfill: promote a storage-only rule into the freed DNR slot
    if (removed.dnrRegistered) {
        const backfill = customRules.find((r) => !r.dnrRegistered);
        if (backfill) {
            try {
                await browser.declarativeNetRequest.updateDynamicRules({
                    addRules: [buildDnrRule(backfill.id, backfill.urlFilter)],
                    removeRuleIds: [],
                });
                backfill.dnrRegistered = true;
            } catch {
                // Not critical — rule still works via content script
            }
        }
    }

    try {
        await saveCustomRules(customRules);
    } catch (e) {
        return { error: `Rule removed from memory but failed to save: ${e.message}` };
    }

    return { success: true };
}

async function getRuleCounts() {
    const customRules = await getStoredCustomRules();
    return { total: customRules.length };
}

async function getCustomRulesPaginated(page, pageSize, search) {
    let allRules = await getStoredCustomRules();

    // Filter by search query if provided
    if (search) {
        const q = search.toLowerCase();
        allRules = allRules.filter((r) => r.value.includes(q));
    }

    // Sort by id descending (newest/last-created first)
    allRules.sort((a, b) => b.id - a.id);

    const totalCount = allRules.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const safePage = Math.max(1, Math.min(page, totalPages));

    const start = (safePage - 1) * pageSize;
    const rules = allRules.slice(start, start + pageSize);

    return { rules, page: safePage, pageSize, totalCount, totalPages };
}

// ---------------------
// EasyList Export Helper
// ---------------------

/**
 * Convert an internal custom rule back to EasyList filter syntax.
 */
function ruleToEasyListLine(rule) {
    if (rule.ruleType === "host") {
        return `||${rule.value}^`;
    }
    return rule.value;
}

// ---------------------
// Import / Export  (EasyList text format)
// ---------------------

async function exportRules() {
    const customRules = await getStoredCustomRules();

    const header = [
        "[Adblock Plus 2.0]",
        `! Title: My AdBlock — Custom Rules`,
        `! Exported: ${new Date().toISOString()}`,
        `! Total rules: ${customRules.length}`,
        "",
    ];

    const filterLines = customRules.map((r) => ruleToEasyListLine(r));
    const text = header.concat(filterLines).join("\n");

    return {
        success: true,
        data: {
            text,
            count: customRules.length,
        },
    };
}

/**
 * Import a small batch of pre-parsed rules.
 * Called repeatedly by popup.js with chunks of ~500 rules.
 * Saves to storage only — DNR registration happens in importFinalize().
 */
async function importRulesBatch(incomingRules) {
    if (!Array.isArray(incomingRules) || incomingRules.length === 0) {
        return { imported: 0, skipped: 0 };
    }

    const existingRules = await getStoredCustomRules();
    const existingValues = new Set(existingRules.map((r) => r.value));
    let id = nextRuleId(existingRules);

    const newEntries = [];
    let skipped = 0;

    for (const rule of incomingRules) {
        const ruleType = rule.ruleType;
        const value = (rule.value || "").trim().toLowerCase();

        if (!value || (ruleType !== "host" && ruleType !== "pattern")) {
            skipped++;
            continue;
        }
        if (existingValues.has(value)) {
            skipped++;
            continue;
        }

        const urlFilter = buildUrlFilter(ruleType, value);
        newEntries.push({ id, ruleType, value, urlFilter, dnrRegistered: false });
        existingValues.add(value);
        id++;
    }

    if (newEntries.length > 0) {
        await saveCustomRules([...existingRules, ...newEntries]);
    }

    return { imported: newEntries.length, skipped };
}

/**
 * After all batches are imported to storage, register DNR rules.
 * Called once by popup.js after all importRulesBatch calls complete.
 */
async function importFinalize() {
    const customRules = await getStoredCustomRules();

    // Clear existing DNR rules
    try {
        const existing = await browser.declarativeNetRequest.getDynamicRules();
        const ids = existing.map((r) => r.id);
        if (ids.length > 0) {
            for (let i = 0; i < ids.length; i += DNR_BATCH_SIZE) {
                await browser.declarativeNetRequest.updateDynamicRules({
                    addRules: [],
                    removeRuleIds: ids.slice(i, i + DNR_BATCH_SIZE),
                });
            }
        }
    } catch (e) {
        console.warn("[My AdBlock] Failed to clear DNR rules:", e.message);
    }

    // Register up to the limit
    const toRegister = customRules.slice(0, MAX_DYNAMIC_RULES);
    const dnrRules = toRegister.map((r) => buildDnrRule(r.id, r.urlFilter));
    const registered = await batchRegisterDnrRules(dnrRules);

    // Update flags
    let changed = false;
    const registeredIds = new Set(toRegister.slice(0, registered).map((r) => r.id));
    for (const rule of customRules) {
        const shouldBe = registeredIds.has(rule.id);
        if (rule.dnrRegistered !== shouldBe) {
            rule.dnrRegistered = shouldBe;
            changed = true;
        }
    }
    if (changed) {
        await saveCustomRules(customRules);
    }

    return { success: true, total: customRules.length, dnrRegistered: registered };
}

/**
 * Remove all custom rules from storage and DNR.
 * Clears storage first (fast), then cleans up DNR rules.
 */
async function clearAllRules() {
    // Clear storage first — this is instant and ensures rules are gone
    await saveCustomRules([]);

    // Then clean up DNR rules (may be slow with many rules)
    try {
        const existing = await browser.declarativeNetRequest.getDynamicRules();
        const ids = existing.map((r) => r.id);
        for (let i = 0; i < ids.length; i += DNR_BATCH_SIZE) {
            await browser.declarativeNetRequest.updateDynamicRules({
                addRules: [],
                removeRuleIds: ids.slice(i, i + DNR_BATCH_SIZE),
            });
        }
    } catch (e) {
        console.warn("[My AdBlock] Failed to clear DNR rules:", e.message);
    }

    return { success: true };
}

// ---------------------
// Context menu — "Block this hostname"
// Safari may expose contextMenus as browser.menus in some versions.
// ---------------------

const menus = browser.contextMenus || browser.menus;
const CONTEXT_MENU_ID = "my-adblock-block-host";

menus.create({
    id: CONTEXT_MENU_ID,
    title: "My AdBlock — Block this hostname",
    contexts: ["page", "link", "image", "video", "audio", "selection", "editable", "frame"],
});

/**
 * Extract the most relevant hostname from the context menu click info.
 * Priority: element src URL → link URL → frame URL → page URL.
 */
function extractHostname(info, tab) {
    const candidates = [info.srcUrl, info.linkUrl, info.frameUrl, info.pageUrl, tab?.url];
    for (const url of candidates) {
        if (url) {
            try {
                return new URL(url).hostname;
            } catch {
                // not a valid URL — try next
            }
        }
    }
    return null;
}

menus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId !== CONTEXT_MENU_ID) return;

    const hostname = extractHostname(info, tab);
    if (!hostname) return;

    // Resolve target tab — prefer the tab from the callback, fall back to querying the active tab
    let tabId = tab?.id;
    if (tabId === undefined) {
        try {
            const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
            tabId = activeTab?.id;
        } catch {
            // ignore
        }
    }
    if (tabId === undefined) return;

    // Ask the content script to show a confirmation prompt
    try {
        await browser.tabs.sendMessage(tabId, {
            type: "confirmBlockHost",
            hostname,
        });
    } catch (e) {
        console.error("[My AdBlock] Failed to send confirmBlockHost to content script:", e);
    }
});

// ---------------------
// Restore dynamic rules & populate cache on startup
// ---------------------
async function restoreDynamicRules() {
    const customRules = await getStoredCustomRules();

    if (customRules.length === 0) return;

    // Clear all existing dynamic rules first (in batches)
    try {
        const existingDynamic = await browser.declarativeNetRequest.getDynamicRules();
        const existingIds = existingDynamic.map((r) => r.id);
        if (existingIds.length > 0) {
            for (let i = 0; i < existingIds.length; i += DNR_BATCH_SIZE) {
                const batch = existingIds.slice(i, i + DNR_BATCH_SIZE);
                await browser.declarativeNetRequest.updateDynamicRules({
                    addRules: [],
                    removeRuleIds: batch,
                });
            }
        }
    } catch (e) {
        console.error("[My AdBlock] Failed to clear existing dynamic rules:", e);
    }

    // Only register up to the limit
    const toRegister = customRules.slice(0, MAX_DYNAMIC_RULES);
    const dnrRules = toRegister.map((r) => buildDnrRule(r.id, r.urlFilter));
    const registered = await batchRegisterDnrRules(dnrRules);

    // Update dnrRegistered flags
    let changed = false;
    const registeredIds = new Set(toRegister.slice(0, registered).map((r) => r.id));
    for (const rule of customRules) {
        const shouldBe = registeredIds.has(rule.id);
        if (rule.dnrRegistered !== shouldBe) {
            rule.dnrRegistered = shouldBe;
            changed = true;
        }
    }
    if (changed) {
        await saveCustomRules(customRules);
    }
}

restoreDynamicRules();
console.log("[My AdBlock] Background service worker loaded.");
