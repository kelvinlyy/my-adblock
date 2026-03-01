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
setupToggle(
    document.getElementById("blockedToggle"),
    document.getElementById("blockedArrow"),
    document.getElementById("blockedBody")
);
setupToggle(
    document.getElementById("rulesToggle"),
    document.getElementById("rulesArrow"),
    document.getElementById("rulesBody")
);

// ---------------------
// Init
// ---------------------
loadStats();
loadCustomRules();

// Auto-refresh stats while popup is open
setInterval(loadStats, STATS_REFRESH_INTERVAL_MS);
