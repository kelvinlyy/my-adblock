// ============================================================
// My AdBlock — rule-manager.js
// CRUD operations for custom rules (add, remove, import, export, clear).
// Depends on: storage.js, dnr.js, easylist-parser.js (ruleToEasyListLine)
// ============================================================

// ---------------------
// Add a custom rule
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

// ---------------------
// Remove a custom rule
// ---------------------

async function removeCustomRule(ruleId) {
    const numericId = Number(ruleId);
    const customRules = await getStoredCustomRules();
    const idx = customRules.findIndex((r) => Number(r.id) === numericId);

    if (idx === -1) {
        return { error: "Rule not found" };
    }

    const removed = customRules[idx];

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

// ---------------------
// Get rule counts
// ---------------------

async function getRuleCounts() {
    const customRules = await getStoredCustomRules();
    return { total: customRules.length };
}

// ---------------------
// Get rules paginated
// ---------------------

async function getCustomRulesPaginated(page, pageSize, search) {
    let allRules = await getStoredCustomRules();

    if (search) {
        const q = search.toLowerCase();
        allRules = allRules.filter((r) => r.value.includes(q));
    }

    allRules.sort((a, b) => b.id - a.id);

    const totalCount = allRules.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const safePage = Math.max(1, Math.min(page, totalPages));

    const start = (safePage - 1) * pageSize;
    const rules = allRules.slice(start, start + pageSize);

    return { rules, page: safePage, pageSize, totalCount, totalPages };
}

// ---------------------
// Export rules (EasyList text format)
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

// ---------------------
// Import rules (batch)
// ---------------------

/**
 * Import a small batch of pre-parsed rules.
 * Called repeatedly with chunks of ~500 rules.
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

// ---------------------
// Finalize import (register DNR rules)
// ---------------------

/**
 * After all batches are imported to storage, register DNR rules.
 * Called once after all importRulesBatch calls complete.
 */
async function importFinalize() {
    const customRules = await getStoredCustomRules();

    await clearAllDnrRules();

    const toRegister = customRules.slice(0, MAX_DYNAMIC_RULES);
    const dnrRules = toRegister.map((r) => buildDnrRule(r.id, r.urlFilter));
    const registered = await batchRegisterDnrRules(dnrRules);

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

// ---------------------
// Clear all rules
// ---------------------

async function clearAllRules() {
    await saveCustomRules([]);
    await clearAllDnrRules();
    return { success: true };
}
