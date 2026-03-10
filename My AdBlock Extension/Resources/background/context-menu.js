// ============================================================
// My AdBlock — context-menu.js
// Context menu: "Block this hostname" right-click option.
// Depends on: rule-manager.js (addCustomRule)
// ============================================================

const menus = browser.contextMenus || browser.menus;
const CONTEXT_MENU_ID = "my-adblock-block-host";

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

/**
 * Handle context menu click — show confirmation via content script,
 * or add rule directly if content script is unavailable.
 */
let _contextMenuBusy = false;

async function handleContextMenuClick(info, tab) {
    if (info.menuItemId !== CONTEXT_MENU_ID) return;
    if (_contextMenuBusy) return;
    _contextMenuBusy = true;

    try {
        let hostname = extractHostname(info, tab);

        // Resolve target tab
        let tabId = tab?.id;
        if (tabId === undefined || !hostname) {
            try {
                const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
                if (!tabId) tabId = activeTab?.id;
                if (!hostname && activeTab?.url) {
                    try { hostname = new URL(activeTab.url).hostname; } catch {}
                }
            } catch {
                // ignore
            }
        }

        if (!hostname || tabId === undefined) return;

        // Try content script first, fall back to direct add
        try {
            await Promise.race([
                browser.tabs.sendMessage(tabId, {
                    type: "confirmBlockHost",
                    hostname,
                }),
                new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 2000)),
            ]);
        } catch (e) {
            // Content script not available or timed out — add rule directly
            try {
                await addCustomRule("host", hostname);
            } catch (_) {}
        }
    } finally {
        _contextMenuBusy = false;
    }
}

if (menus) {
    try {
        menus.create({
            id: CONTEXT_MENU_ID,
            title: "My AdBlock - Block this hostname",
            contexts: ["page", "link", "image", "video", "audio", "selection", "editable", "frame"],
        });
    } catch (e) {
        console.warn("[My AdBlock] Failed to create context menu:", e);
    }

    if (menus.onClicked) {
        menus.onClicked.addListener(handleContextMenuClick);
    }
} else {
    console.warn("[My AdBlock] Context menus API not available.");
}
