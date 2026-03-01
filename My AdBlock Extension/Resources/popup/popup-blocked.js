// ============================================================
// My AdBlock — popup-blocked.js
// Renders blocked-request list and handles search/clear.
// Depends on: popup-ui.js (formatTime), popup-stats.js (currentBlockedRequests, loadStats)
// ============================================================

// ---------------------
// DOM references
// ---------------------
const blockedList = document.getElementById("blockedList");
const searchInput = document.getElementById("searchInput");
const clearSessionBtn = document.getElementById("clearSessionBtn");

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
