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

function setupToggle(toggleBtn, arrowEl, bodyEl) {
    toggleBtn.addEventListener("click", () => {
        const isCollapsed = bodyEl.classList.contains("collapsed");
        bodyEl.classList.toggle("collapsed", !isCollapsed);
        bodyEl.classList.toggle("expanded", isCollapsed);
        arrowEl.classList.toggle("expanded", isCollapsed);
    });
}

setupToggle(blockedToggle, blockedArrow, blockedBody);
setupToggle(rulesToggle, rulesArrow, rulesBody);

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
        ruleCountEl.textContent = `${counts.total} (${counts.builtinCount} + ${counts.customCount})`;
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

async function loadCustomRules() {
    try {
        const result = await browser.runtime.sendMessage({ type: "getCustomRules" });
        renderCustomRules(result.rules || []);
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
// Export rules
// ---------------------

exportRulesBtn.addEventListener("click", async () => {
    try {
        const result = await browser.runtime.sendMessage({ type: "exportRules" });
        if (result.error) {
            showToast(result.error);
            return;
        }

        const json = JSON.stringify(result.data, null, 2);
        const filename = `my-adblock-rules-${new Date().toISOString().slice(0, 10)}.json`;

        const nativeResp = await browser.runtime.sendNativeMessage("application.id", {
            action: "exportRules",
            json,
            filename,
        });

        if (nativeResp.error) {
            showToast(nativeResp.error);
            return;
        }

        showToast(
            `${result.data.rules.length} rule(s) exported to ${nativeResp.path || "Downloads"}.`,
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

importRulesBtn.addEventListener("click", () => importFileInput.click());

importFileInput.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset so the same file can be re-imported
    importFileInput.value = "";

    try {
        const text = await file.text();

        let parsed;
        try {
            parsed = JSON.parse(text);
        } catch {
            showToast("Invalid JSON file.");
            return;
        }

        // Support both { rules: [...] } and plain array [...]
        const rules = Array.isArray(parsed) ? parsed : parsed.rules;
        if (!Array.isArray(rules)) {
            showToast("No rules array found in file.");
            return;
        }

        const result = await browser.runtime.sendMessage({ type: "importRules", rules });

        if (result.error) {
            showToast(result.error);
            return;
        }

        const msg = `Imported ${result.imported} rule(s)` +
            (result.skipped > 0 ? `, ${result.skipped} skipped` : "") + ".";
        showToast(msg, { isError: false });

        await loadCustomRules();
        await loadStats();
    } catch (e) {
        showToast("Failed to import rules.");
        console.error(e);
    }
});

// ---------------------
// Init
// ---------------------

loadStats();
loadCustomRules();

// Auto-refresh stats while popup is open
setInterval(loadStats, STATS_REFRESH_INTERVAL_MS);
