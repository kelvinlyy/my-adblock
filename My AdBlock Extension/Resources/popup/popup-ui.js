// ============================================================
// My AdBlock — popup-ui.js
// Shared UI utilities: section toggles & toast notifications.
// ============================================================

// ---------------------
// Constants
// ---------------------
const TOAST_DURATION_MS = 4000;

// ---------------------
// Toast notification (reuses #ruleError element)
// ---------------------

let _toastTimer = null;

function showToast(msg, { isError = true } = {}) {
    const ruleError = document.getElementById("ruleError");
    clearTimeout(_toastTimer);
    ruleError.textContent = msg;
    ruleError.style.color = isError ? "" : "var(--accent)";
    ruleError.classList.remove("hidden");

    _toastTimer = setTimeout(() => {
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
