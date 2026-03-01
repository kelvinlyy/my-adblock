// ============================================================
// My AdBlock — popup-rules.js
// Custom rule management: add, remove, export, import (EasyList text),
// pagination, search, and clear-all.
// Depends on: popup-ui.js (showToast), popup-stats.js (loadStats),
//             easylist-parser.js (parseEasyList)
// ============================================================

// ---------------------
// Constants
// ---------------------
const IMPORT_BATCH_SIZE = 500;

// ---------------------
// DOM references
// ---------------------
const customRulesList = document.getElementById("customRulesList");
const ruleTypeSelect = document.getElementById("ruleType");
const ruleValueInput = document.getElementById("ruleValue");
const addRuleBtn = document.getElementById("addRuleBtn");
const exportRulesBtn = document.getElementById("exportRulesBtn");
const importRulesBtn = document.getElementById("importRulesBtn");
const importFileInput = document.getElementById("importFileInput");
const clearAllRulesBtn = document.getElementById("clearAllRulesBtn");
const rulesSearchInput = document.getElementById("rulesSearchInput");
const rulesPagination = document.getElementById("rulesPagination");
const rulesPrevBtn = document.getElementById("rulesPrevBtn");
const rulesNextBtn = document.getElementById("rulesNextBtn");
const rulesPageInfo = document.getElementById("rulesPageInfo");

// ---------------------
// Pagination state
// ---------------------
let rulesCurrentPage = 1;
const RULES_PAGE_SIZE = 50;
let rulesSearchQuery = "";

// ---------------------
// Load & render custom rules
// ---------------------

async function loadCustomRules() {
    try {
        const result = await browser.runtime.sendMessage({
            type: "getCustomRules",
            page: rulesCurrentPage,
            pageSize: RULES_PAGE_SIZE,
            search: rulesSearchQuery,
        });
        renderCustomRules(result.rules || []);
        updatePagination(result);
    } catch (e) {
        console.error("Failed to load custom rules:", e);
    }
}

function renderCustomRules(rules) {
    if (!rules || rules.length === 0) {
        customRulesList.innerHTML = '<p class="empty-msg">No custom rules added.</p>';
        return;
    }

    const fragment = document.createDocumentFragment();

    for (const rule of rules) {
        const entry = document.createElement("div");
        entry.className = "rule-entry";

        const tag = document.createElement("span");
        tag.className = `rule-tag ${rule.ruleType}`;
        tag.textContent = rule.ruleType;

        const value = document.createElement("span");
        value.className = "rule-value";
        value.textContent = rule.value;
        value.title = `Filter: ${rule.urlFilter}`;

        const removeBtn = document.createElement("button");
        removeBtn.className = "rule-remove";
        removeBtn.textContent = "✕";
        removeBtn.title = "Remove rule";
        removeBtn.addEventListener("click", () => handleRemoveRule(rule.id));

        entry.append(tag, value, removeBtn);
        fragment.appendChild(entry);
    }

    customRulesList.innerHTML = "";
    customRulesList.appendChild(fragment);
}

// ---------------------
// Pagination
// ---------------------

function updatePagination(result) {
    if (!result || result.totalPages <= 1) {
        rulesPagination.classList.add("hidden");
        return;
    }
    rulesPagination.classList.remove("hidden");
    rulesPageInfo.textContent = `Page ${result.page} / ${result.totalPages}`;
    rulesPrevBtn.disabled = result.page <= 1;
    rulesNextBtn.disabled = result.page >= result.totalPages;
}

rulesPrevBtn.addEventListener("click", () => {
    if (rulesCurrentPage > 1) {
        rulesCurrentPage--;
        loadCustomRules();
    }
});

rulesNextBtn.addEventListener("click", () => {
    rulesCurrentPage++;
    loadCustomRules();
});

// ---------------------
// Rules search
// ---------------------

rulesSearchInput.addEventListener("input", () => {
    rulesSearchQuery = rulesSearchInput.value.trim();
    rulesCurrentPage = 1;
    loadCustomRules();
});

// ---------------------
// Add custom rule
// ---------------------

addRuleBtn.addEventListener("click", handleAddRule);
ruleValueInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleAddRule();
});

async function handleAddRule() {
    const ruleType = ruleTypeSelect.value;
    const value = ruleValueInput.value.trim();

    if (!value) {
        showToast("Please enter a value.");
        return;
    }

    try {
        const result = await browser.runtime.sendMessage({ type: "addCustomRule", ruleType, value });

        if (result.error) {
            showToast(result.error);
            return;
        }

        ruleValueInput.value = "";
        await loadCustomRules();
        await loadStats();
    } catch (e) {
        showToast("Failed to add rule.");
        console.error(e);
    }
}

// ---------------------
// Remove custom rule
// ---------------------

async function handleRemoveRule(ruleId) {
    try {
        const result = await browser.runtime.sendMessage({ type: "removeCustomRule", ruleId });

        if (result.error) {
            showToast(result.error);
            return;
        }

        await loadCustomRules();
        await loadStats();
    } catch (e) {
        showToast("Failed to remove rule.");
        console.error(e);
    }
}

// ---------------------
// Update placeholder based on rule type
// ---------------------

ruleTypeSelect.addEventListener("change", () => {
    ruleValueInput.placeholder = ruleTypeSelect.value === "host"
        ? "e.g. ads.example.com"
        : "e.g. /promo/ or */sponsored/*";
});

// ---------------------
// Export rules (EasyList text format via native messaging)
// ---------------------

exportRulesBtn.addEventListener("click", async () => {
    try {
        const result = await browser.runtime.sendMessage({ type: "exportRules" });
        if (result.error) {
            showToast(result.error);
            return;
        }

        const text = result.data.text;
        const filename = `my-adblock-rules-${new Date().toISOString().slice(0, 10)}.txt`;

        const nativeResp = await browser.runtime.sendNativeMessage("application.id", {
            action: "exportRules",
            json: text,
            filename,
        });

        if (nativeResp.error) {
            showToast(nativeResp.error);
            return;
        }

        showToast(
            `${result.data.count} rule(s) exported to ${nativeResp.path || "Downloads"}.`,
            { isError: false }
        );
    } catch (e) {
        showToast(`Export failed: ${e.message}`);
        console.error(e);
    }
});

// ---------------------
// Import rules (EasyList / Adblock Plus text format)
// ---------------------

importRulesBtn.addEventListener("click", () => importFileInput.click());

importFileInput.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset so the same file can be re-imported
    importFileInput.value = "";

    try {
        const text = await file.text();

        // Parse as EasyList / Adblock Plus filter text
        const rules = parseEasyList(text);

        if (!rules || rules.length === 0) {
            showToast("No valid rules found in file.");
            return;
        }

        // Send in batches to avoid message-size limits
        let totalImported = 0;
        let totalSkipped = 0;

        for (let i = 0; i < rules.length; i += IMPORT_BATCH_SIZE) {
            const batch = rules.slice(i, i + IMPORT_BATCH_SIZE);
            const result = await browser.runtime.sendMessage({ type: "importRulesBatch", rules: batch });

            if (result.error) {
                showToast(result.error);
                return;
            }

            totalImported += result.imported || 0;
            totalSkipped += result.skipped || 0;
        }

        // Finalize: register DNR rules
        await browser.runtime.sendMessage({ type: "importFinalize" });

        const msg = `Imported ${totalImported} rule(s)` +
            (totalSkipped > 0 ? `, ${totalSkipped} skipped` : "") + ".";
        showToast(msg, { isError: false });

        await loadCustomRules();
        await loadStats();
    } catch (e) {
        showToast("Failed to import rules.");
        console.error(e);
    }
});

// ---------------------
// Clear all rules
// ---------------------

let clearAllConfirming = false;
let clearAllTimer = null;

clearAllRulesBtn.addEventListener("click", async () => {
    if (!clearAllConfirming) {
        clearAllConfirming = true;
        clearAllRulesBtn.textContent = "Confirm?";
        clearAllRulesBtn.classList.add("btn-danger-confirm");
        clearAllTimer = setTimeout(() => {
            clearAllConfirming = false;
            clearAllRulesBtn.textContent = "✕ Clear All";
            clearAllRulesBtn.classList.remove("btn-danger-confirm");
        }, 3000);
        return;
    }

    clearTimeout(clearAllTimer);
    clearAllConfirming = false;
    clearAllRulesBtn.textContent = "✕ Clear All";
    clearAllRulesBtn.classList.remove("btn-danger-confirm");

    try {
        const result = await browser.runtime.sendMessage({ type: "clearAllRules" });
        if (result.error) {
            showToast(result.error);
            return;
        }
        showToast("All custom rules cleared.", { isError: false });
        await loadCustomRules();
        await loadStats();
    } catch (e) {
        showToast("Failed to clear rules.");
        console.error(e);
    }
});
