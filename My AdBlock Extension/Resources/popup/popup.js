// ============================================================
// My AdBlock — popup.js
// Initialisation & orchestration.
// Modules loaded before this file (via popup.html script tags):
//   popup-ui.js, popup-stats.js, popup-blocked.js, popup-rules.js
// ============================================================

// ---------------------
// Constants
// ---------------------
const STATS_REFRESH_INTERVAL_MS = 3000;

// ---------------------
// Wire up section toggles
// ---------------------
const blockedArrow = document.getElementById("blockedArrow");
const blockedBody = document.getElementById("blockedBody");
const rulesArrow = document.getElementById("rulesArrow");
const rulesBody = document.getElementById("rulesBody");

setupToggle(
    document.getElementById("blockedToggle"),
    blockedArrow,
    blockedBody,
    rulesArrow,
    rulesBody
);
setupToggle(
    document.getElementById("rulesToggle"),
    rulesArrow,
    rulesBody,
    blockedArrow,
    blockedBody
);

// ---------------------
// Init
// ---------------------
loadStats();
loadCustomRules();

// Auto-refresh stats while popup is open
setInterval(loadStats, STATS_REFRESH_INTERVAL_MS);

// ---------------------
// Safari iOS popover sizing fix
// Ensure the popover reads the correct intrinsic content size
// ---------------------
(function fixPopoverSize() {
    document.documentElement.style.width = "100%";
    document.body.style.maxWidth = "400px";
    document.body.style.margin = "0 auto";
})();
