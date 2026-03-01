// ============================================================
// My AdBlock — popup.js
// Stats display, blocked-request list, and custom rule management.
// ============================================================

// ---------------------
// DOM references
// ---------------------

// Stats
const sessionCountEl = document.getElementById("sessionCount");
const allTimeCountEl = document.getElementById("allTimeCount");
const ruleCountEl = document.getElementById("ruleCount");

// Blocked requests section
const blockedToggle = document.getElementById("blockedToggle");
const blockedArrow = document.getElementById("blockedArrow");
const blockedBody = document.getElementById("blockedBody");
const blockedList = document.getElementById("blockedList");
const searchInput = document.getElementById("searchInput");
const clearSessionBtn = document.getElementById("clearSessionBtn");

// Custom rules section
const rulesToggle = document.getElementById("rulesToggle");
const rulesArrow = document.getElementById("rulesArrow");
const rulesBody = document.getElementById("rulesBody");
const customRulesList = document.getElementById("customRulesList");
const ruleTypeSelect = document.getElementById("ruleType");
const ruleValueInput = document.getElementById("ruleValue");
const addRuleBtn = document.getElementById("addRuleBtn");
const ruleError = document.getElementById("ruleError");
const exportRulesBtn = document.getElementById("exportRulesBtn");
const importRulesBtn = document.getElementById("importRulesBtn");
const importFileInput = document.getElementById("importFileInput");

// ---------------------
// State
// ---------------------
let currentBlockedRequests = [];
let rulesCurrentPage = 1;
let rulesSearchQuery = "";
const RULES_PAGE_SIZE = 50;

// ---------------------
// Constants
// ---------------------
const STATS_REFRESH_INTERVAL_MS = 3000;
const TOAST_DURATION_MS = 4000;

// ---------------------
// Formatting helpers
// ---------------------

function formatNumber(n) {
    return n.toLocaleString();
}

function formatTime(ts) {
    return new Date(ts).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
}

// ---------------------
// Toast notification (reuses #ruleError element)
// ---------------------

let toastTimer = null;

function showToast(msg, { isError = true } = {}) {
    clearTimeout(toastTimer);
    ruleError.textContent = msg;
    ruleError.style.color = isError ? "" : "var(--accent)";
    ruleError.classList.remove("hidden");

    toastTimer = setTimeout(() => {
        ruleError.classList.add("hidden");
        ruleError.style.color = "";
    }, TOAST_DURATION_MS);
}

// ---------------------
// Toggle section expand / collapse
// ---------------------

function setupAccordion(toggleBtn, arrowEl, bodyEl, otherArrowEl, otherBodyEl) {
    toggleBtn.addEventListener("click", () => {
        const isCollapsed = bodyEl.classList.contains("collapsed");

        // Toggle this section
        bodyEl.classList.toggle("collapsed", !isCollapsed);
        bodyEl.classList.toggle("expanded", isCollapsed);
        arrowEl.classList.toggle("expanded", isCollapsed);

        // If expanding, collapse the other section
        if (isCollapsed) {
            otherBodyEl.classList.add("collapsed");
            otherBodyEl.classList.remove("expanded");
            otherArrowEl.classList.remove("expanded");
        }
    });
}

setupAccordion(blockedToggle, blockedArrow, blockedBody, rulesArrow, rulesBody);
setupAccordion(rulesToggle, rulesArrow, rulesBody, blockedArrow, blockedBody);

// ---------------------
// Load stats from background
// ---------------------

async function loadStats() {
    try {
        const stats = await browser.runtime.sendMessage({ type: "getStats" });
        sessionCountEl.textContent = formatNumber(stats.sessionBlocked || 0);
        allTimeCountEl.textContent = formatNumber(stats.allTimeBlocked || 0);
        currentBlockedRequests = stats.blockedRequests || [];
        renderBlockedList(currentBlockedRequests);
    } catch (e) {
        console.error("Failed to load stats:", e);
    }

    try {
        const counts = await browser.runtime.sendMessage({ type: "getRuleCounts" });
        ruleCountEl.textContent = counts.total;
    } catch (e) {
        console.error("Failed to load rule counts:", e);
    }
}

// ---------------------
// Render blocked requests list
// ---------------------

function renderBlockedList(requests) {
    if (!requests || requests.length === 0) {
        blockedList.innerHTML = '<p class="empty-msg">No blocked requests yet.</p>';
        return;
    }

    const fragment = document.createDocumentFragment();

    // Show newest first
    for (const req of [...requests].reverse()) {
        const entry = document.createElement("div");
        entry.className = "blocked-entry";

        const time = document.createElement("span");
        time.className = "blocked-time";
        time.textContent = formatTime(req.timestamp);

        const url = document.createElement("span");
        url.className = "blocked-url";
        url.textContent = req.url;
        url.title = req.url + (req.matchedRule ? `\nRule: ${req.matchedRule}` : "");

        entry.append(time, url);
        fragment.appendChild(entry);
    }

    blockedList.innerHTML = "";
    blockedList.appendChild(fragment);
}

// ---------------------
// Search filter
// ---------------------

searchInput.addEventListener("input", () => {
    const query = searchInput.value.toLowerCase().trim();
    if (!query) {
        renderBlockedList(currentBlockedRequests);
        return;
    }
    renderBlockedList(
        currentBlockedRequests.filter((r) => r.url.toLowerCase().includes(query))
    );
});

// ---------------------
// Clear session
// ---------------------

clearSessionBtn.addEventListener("click", async () => {
    try {
        await browser.runtime.sendMessage({ type: "clearSession" });
        sessionCountEl.textContent = "0";
        currentBlockedRequests = [];
        renderBlockedList([]);
    } catch (e) {
        console.error("Failed to clear session:", e);
    }
});

// ---------------------
// Custom rules — load & render
// ---------------------

async function loadCustomRules(page) {
    if (page !== undefined) rulesCurrentPage = page;
    try {
        const result = await browser.runtime.sendMessage({
            type: "getCustomRules",
            page: rulesCurrentPage,
            pageSize: RULES_PAGE_SIZE,
            search: rulesSearchQuery,
        });
        rulesCurrentPage = result.page;
        renderCustomRules(result.rules || []);
        renderRulesPagination(result.page, result.totalPages, result.totalCount);
    } catch (e) {
        console.error("Failed to load custom rules:", e);
    }
}

function renderCustomRules(rules) {
    if (!rules || rules.length === 0) {
        const msg = rulesSearchQuery
            ? `No rules matching "${rulesSearchQuery}".`
            : "No custom rules added.";
        customRulesList.innerHTML = `<p class="empty-msg">${msg}</p>`;
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

function renderRulesPagination(page, totalPages, totalCount) {
    const paginationEl = document.getElementById("rulesPagination");
    if (!paginationEl) return;

    if (totalCount === 0) {
        paginationEl.classList.add("hidden");
        return;
    }
    paginationEl.classList.remove("hidden");

    const prevBtn = document.getElementById("rulesPrevBtn");
    const nextBtn = document.getElementById("rulesNextBtn");
    const pageInfo = document.getElementById("rulesPageInfo");

    pageInfo.textContent = `Page ${page} / ${totalPages}  (${totalCount.toLocaleString()} rules)`;
    prevBtn.disabled = page <= 1;
    nextBtn.disabled = page >= totalPages;
}

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
        await loadCustomRules(1);
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
// Clear all rules
// ---------------------

let clearAllPending = false;
let clearAllTimer = null;

document.getElementById("clearAllRulesBtn")?.addEventListener("click", async () => {
    const btn = document.getElementById("clearAllRulesBtn");
    if (!btn) return;

    // First click — ask for confirmation
    if (!clearAllPending) {
        clearAllPending = true;
        btn.textContent = "Confirm?";
        btn.classList.add("btn-danger-confirm");

        // Reset after 3 seconds if not confirmed
        clearAllTimer = setTimeout(() => {
            clearAllPending = false;
            btn.textContent = "✕ Clear All";
            btn.classList.remove("btn-danger-confirm");
        }, 3000);
        return;
    }

    // Second click — confirmed
    clearAllPending = false;
    clearTimeout(clearAllTimer);
    btn.textContent = "✕ Clear All";
    btn.classList.remove("btn-danger-confirm");

    try {
        showToast("Clearing all rules…", { isError: false });
        const result = await browser.runtime.sendMessage({ type: "clearAllRules" });
        if (result.error) {
            showToast(result.error);
            return;
        }
        showToast("All rules cleared.", { isError: false });
        await loadCustomRules(1);
        await loadStats();
    } catch (e) {
        showToast("Failed to clear rules.");
        console.error(e);
    }
});

// ---------------------
// Export rules
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
// Import rules
// ---------------------

const IMPORT_BATCH_SIZE = 500;

importRulesBtn.addEventListener("click", () => importFileInput.click());

importFileInput.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset so the same file can be re-imported
    importFileInput.value = "";

    try {
        showToast("Parsing EasyList file…", { isError: false });

        const text = await file.text();

        // Parse EasyList text locally (uses shared easylist-parser.js)
        const rules = parseEasyList(text);

        if (!rules || rules.length === 0) {
            showToast("No valid EasyList rules found in file.");
            return;
        }

        showToast(`Parsed ${rules.length} rules. Importing…`, { isError: false });

        // Send to background in batches
        let totalImported = 0;
        let totalSkipped = 0;

        for (let i = 0; i < rules.length; i += IMPORT_BATCH_SIZE) {
            const batch = rules.slice(i, i + IMPORT_BATCH_SIZE);
            const result = await browser.runtime.sendMessage({
                type: "importRulesBatch",
                rules: batch,
            });

            if (result.error) {
                showToast(`Batch error: ${result.error}`);
                return;
            }

            totalImported += result.imported || 0;
            totalSkipped += result.skipped || 0;

            // Update progress
            const pct = Math.min(100, Math.round(((i + batch.length) / rules.length) * 100));
            showToast(`Importing… ${pct}% (${totalImported} added)`, { isError: false });
        }

        if (totalImported === 0) {
            showToast(`No new rules imported (${totalSkipped} skipped as duplicates).`);
            return;
        }

        // Finalize: register DNR rules
        showToast("Registering rules…", { isError: false });
        const finalResult = await browser.runtime.sendMessage({ type: "importFinalize" });

        let msg = `Imported ${totalImported} rule(s)`;
        if (totalSkipped > 0) msg += `, ${totalSkipped} skipped`;
        if (finalResult.dnrRegistered != null) {
            const contentOnly = finalResult.total - finalResult.dnrRegistered;
            if (contentOnly > 0) msg += ` (${finalResult.dnrRegistered} engine, ${contentOnly} script)`;
        }
        msg += ".";
        showToast(msg, { isError: false });

        await loadCustomRules(1);
        await loadStats();
    } catch (e) {
        showToast("Failed to import rules.");
        console.error(e);
    }
});

// ---------------------
// Rules search
// ---------------------

let rulesSearchTimer = null;

document.getElementById("rulesSearchInput")?.addEventListener("input", (e) => {
    clearTimeout(rulesSearchTimer);
    rulesSearchTimer = setTimeout(() => {
        rulesSearchQuery = e.target.value.trim();
        loadCustomRules(1); // reset to page 1 on new search
    }, 300);
});

// ---------------------
// Pagination controls
// ---------------------

document.getElementById("rulesPrevBtn")?.addEventListener("click", () => {
    if (rulesCurrentPage > 1) loadCustomRules(rulesCurrentPage - 1);
});

document.getElementById("rulesNextBtn")?.addEventListener("click", () => {
    loadCustomRules(rulesCurrentPage + 1);
});

// ---------------------
// Init
// ---------------------

loadStats();
loadCustomRules();

// Auto-refresh stats while popup is open
setInterval(loadStats, STATS_REFRESH_INTERVAL_MS);
