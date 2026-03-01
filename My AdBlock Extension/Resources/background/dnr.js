// ============================================================
// My AdBlock — dnr.js
// declarativeNetRequest helpers: rule building, batch registration.
// ============================================================

// ---------------------
// Constants
// ---------------------
const DYNAMIC_RULE_ID_START = 10000;

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
// Rule building
// ---------------------

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

// ---------------------
// ID management
// ---------------------

/** Compute the next rule ID from an existing array of custom rules. */
function nextRuleId(rules) {
    if (rules.length === 0) return DYNAMIC_RULE_ID_START;
    let max = rules[0].id;
    for (let i = 1; i < rules.length; i++) {
        if (rules[i].id > max) max = rules[i].id;
    }
    return max + 1;
}

// ---------------------
// DNR slot management
// ---------------------

/** Return how many more DNR dynamic rules we can register. */
async function getAvailableDnrSlots() {
    try {
        const existing = await browser.declarativeNetRequest.getDynamicRules();
        return Math.max(0, MAX_DYNAMIC_RULES - existing.length);
    } catch {
        return MAX_DYNAMIC_RULES;
    }
}

// ---------------------
// Batch operations
// ---------------------

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
            break;
        }
    }
    return registered;
}

/**
 * Remove all dynamic rules in batches.
 */
async function clearAllDnrRules() {
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
}
