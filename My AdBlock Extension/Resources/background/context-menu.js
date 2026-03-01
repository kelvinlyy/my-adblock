// ============================================================
// My AdBlock — context-menu.js
// Context menu: "Block this hostname" right-click option.
// Depends on: rule-manager.js (addCustomRule)
// ============================================================

const menus = browser.contextMenus || browser.menus;
const CONTEXT_MENU_ID = "my-adblock-block-host";

if (menus) {
    try {
        menus.create({
            id: CONTEXT_MENU_ID,
            title: "My AdBlock — Block this hostname",
            contexts: ["page", "link", "image", "video", "audio", "selection", "editable", "frame"],
        });
    } catch (e) {
        console.warn("[My AdBlock] Failed to create context menu:", e);
    }
} else {
    console.warn("[My AdBlock] Context menus API not available.");
}

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

if (menus && menus.onClicked) {
menus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId !== CONTEXT_MENU_ID) return;

    const hostname = extractHostname(info, tab);
    if (!hostname) return;

    // Resolve target tab
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

    // Ask content script to show confirmation dialog
    try {
        await browser.tabs.sendMessage(tabId, {
            type: "confirmBlockHost",
            hostname,
        });
    } catch (e) {
        console.error("[My AdBlock] Failed to send confirmBlockHost to content script:", e);
    }
});
} // end if (menus && menus.onClicked)
