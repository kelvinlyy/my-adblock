// ============================================================
// My AdBlock - content.js
// Initialisation & orchestration.
// Modules loaded before this file (via manifest.json content_scripts):
//   blocklist-matcher.js, cosmetic-filter.js, resource-scanner.js
// ============================================================

(() => {
    "use strict";

    // ===========================================================
    // Toast notification
    // ===========================================================

    const TOAST_DURATION_MS = 3000;

    function showPageToast(text, isError = false) {
        const toast = document.createElement("div");
        toast.textContent = text;
        Object.assign(toast.style, {
            position: "fixed",
            bottom: "20px",
            right: "20px",
            zIndex: "2147483647",
            padding: "12px 20px",
            borderRadius: "10px",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif",
            fontSize: "13px",
            fontWeight: "600",
            color: "#fff",
            background: isError ? "rgba(255, 59, 48, 0.92)" : "rgba(0, 122, 255, 0.92)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            opacity: "0",
            transition: "opacity 0.25s ease",
            pointerEvents: "none",
        });
        (document.body || document.documentElement).appendChild(toast);

        requestAnimationFrame(() => { toast.style.opacity = "1"; });

        setTimeout(() => {
            toast.style.opacity = "0";
            setTimeout(() => toast.remove(), 300);
        }, TOAST_DURATION_MS);
    }

    // ===========================================================
    // In-page confirmation modal (replaces prompt() which Safari blocks)
    // ===========================================================

    function showBlockConfirmModal(hostname) {
        return new Promise((resolve) => {
            // Backdrop
            const backdrop = document.createElement("div");
            Object.assign(backdrop.style, {
                position: "fixed",
                top: "0", left: "0", right: "0", bottom: "0",
                zIndex: "2147483646",
                background: "rgba(0,0,0,0.4)",
                backdropFilter: "blur(2px)",
                WebkitBackdropFilter: "blur(2px)",
            });

            // Dialog
            const dialog = document.createElement("div");
            Object.assign(dialog.style, {
                position: "fixed",
                top: "50%", left: "50%",
                transform: "translate(-50%, -50%)",
                zIndex: "2147483647",
                width: "340px",
                padding: "20px 24px",
                borderRadius: "14px",
                fontFamily: "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif",
                fontSize: "13px",
                color: "#1d1d1f",
                background: "#fff",
                boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
            });

            // Title
            const title = document.createElement("div");
            title.textContent = "My AdBlock - Block this hostname?";
            Object.assign(title.style, {
                fontWeight: "700", fontSize: "15px", marginBottom: "12px",
            });

            // Label
            const label = document.createElement("div");
            label.textContent = "Edit if needed, then press Block:";
            Object.assign(label.style, {
                fontSize: "12px", color: "#6e6e73", marginBottom: "8px",
            });

            // Input
            const input = document.createElement("input");
            input.type = "text";
            input.value = hostname;
            Object.assign(input.style, {
                width: "100%", boxSizing: "border-box",
                padding: "8px 10px",
                border: "1px solid #d2d2d7",
                borderRadius: "8px",
                fontSize: "13px",
                fontFamily: "inherit",
                outline: "none",
                marginBottom: "16px",
            });

            // Button row
            const btnRow = document.createElement("div");
            Object.assign(btnRow.style, {
                display: "flex", gap: "8px", justifyContent: "flex-end",
            });

            const cancelBtn = document.createElement("button");
            cancelBtn.textContent = "Cancel";
            Object.assign(cancelBtn.style, {
                padding: "7px 18px", borderRadius: "8px",
                border: "1px solid #d2d2d7", background: "#f5f5f7",
                fontSize: "13px", fontWeight: "600", fontFamily: "inherit",
                cursor: "pointer", color: "#1d1d1f",
            });

            const blockBtn = document.createElement("button");
            blockBtn.textContent = "Block";
            Object.assign(blockBtn.style, {
                padding: "7px 18px", borderRadius: "8px",
                border: "none", background: "#007aff",
                fontSize: "13px", fontWeight: "600", fontFamily: "inherit",
                cursor: "pointer", color: "#fff",
            });

            btnRow.append(cancelBtn, blockBtn);
            dialog.append(title, label, input, btnRow);

            function cleanup(value) {
                backdrop.remove();
                dialog.remove();
                resolve(value);
            }

            cancelBtn.addEventListener("click", () => cleanup(null));
            backdrop.addEventListener("click", () => cleanup(null));
            blockBtn.addEventListener("click", () => {
                const val = input.value.trim();
                cleanup(val || null);
            });
            input.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    const val = input.value.trim();
                    cleanup(val || null);
                } else if (e.key === "Escape") {
                    cleanup(null);
                }
            });

            (document.body || document.documentElement).append(backdrop, dialog);
            input.focus();
            input.select();
        });
    }

    // ===========================================================
    // Track right-clicked element for iframe hostname detection
    // ===========================================================

    let lastContextMenuTarget = null;

    document.addEventListener("contextmenu", (e) => {
        lastContextMenuTarget = e.target;
    }, true);

    // ===========================================================
    // Iframe hostname extraction helpers
    // ===========================================================

    function hostnameFromUrl(url) {
        if (!url) return null;
        try {
            const h = new URL(url).hostname;
            return h || null;
        } catch {
            return null;
        }
    }

    function hostnameFromIframe(iframe) {
        if (!iframe) return null;

        const srcHost = hostnameFromUrl(iframe.src);
        if (srcHost && srcHost !== "about:blank" && srcHost !== location.hostname) {
            return srcHost;
        }

        const srcdoc = iframe.getAttribute("srcdoc");
        if (srcdoc) {
            const host = extractHostFromSrcdoc(srcdoc);
            if (host) return host;
        }

        for (const attr of iframe.attributes) {
            if (attr.name.startsWith("data-") && attr.value) {
                const h = hostnameFromUrl(attr.value);
                if (h && h !== location.hostname) return h;
            }
        }

        return null;
    }

    function extractHostFromSrcdoc(srcdoc) {
        const decoded = srcdoc
            .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
            .replace(/&amp;/g, "&").replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");

        const urlPattern = /https?:\/\/[^\s"'<>]+/gi;
        const matches = decoded.match(urlPattern);
        if (!matches) return null;

        const pageHost = location.hostname;
        const seen = new Set();

        for (const url of matches) {
            const host = hostnameFromUrl(url);
            if (!host || host === pageHost || seen.has(host)) continue;
            seen.add(host);
            return host;
        }

        return null;
    }

    function findIframeHostname(el) {
        if (!el) return null;

        if (el.tagName === "IFRAME") {
            return hostnameFromIframe(el);
        }
        if (el.tagName === "EMBED" || el.tagName === "OBJECT") {
            return hostnameFromUrl(el.src || el.data);
        }

        const children = el.querySelectorAll?.("iframe, embed[src], object[data]");
        if (children) {
            for (const child of children) {
                const host = child.tagName === "IFRAME"
                    ? hostnameFromIframe(child)
                    : hostnameFromUrl(child.src || child.data);
                if (host) return host;
            }
        }

        let current = el;
        for (let depth = 0; depth < 5 && current; depth++) {
            const parent = current.parentElement;
            if (!parent) break;

            if (parent.tagName === "IFRAME") {
                return hostnameFromIframe(parent);
            }

            const siblings = parent.querySelectorAll?.(":scope > iframe, :scope > embed[src], :scope > object[data]");
            if (siblings) {
                for (const sib of siblings) {
                    if (sib === current) continue;
                    const host = sib.tagName === "IFRAME"
                        ? hostnameFromIframe(sib)
                        : hostnameFromUrl(sib.src || sib.data);
                    if (host) return host;
                }
            }

            current = parent;
        }

        return null;
    }

    // ===========================================================
    // Handle confirmBlockHost from background.js (macOS context menu)
    // ===========================================================

    browser.runtime.onMessage.addListener((message, _sender) => {
        if (message.type !== "confirmBlockHost") return false;

        const iframeHost = findIframeHostname(lastContextMenuTarget);
        const hostname = iframeHost || message.hostname;

        return showBlockConfirmModal(hostname).then((host) => {
            if (!host) return { dismissed: true };

            return browser.runtime.sendMessage({
                type: "addCustomRule",
                ruleType: "host",
                value: host,
            }).then((result) => {
                if (result.error) {
                    showPageToast(`My AdBlock: ${result.error}`, true);
                } else {
                    showPageToast(`"${host}" added to blocklist`);
                    fetchBlocklist();
                }
                return { ok: true };
            });
        }).catch((e) => {
            console.error("[My AdBlock] Failed to add rule from context menu:", e);
            return { error: e.message };
        });
    });

    // ===========================================================
    // Init
    // ===========================================================

    // 1. Cosmetic filtering — immediate
    injectAdHidingCSS();
    removeAdElements();

    // 2. Fetch blocklist then start detection
    fetchBlocklist();

    // 3. Start PerformanceObserver for resource detection
    startPerformanceObserver();

    // 4. Start DOM observer when body is ready
    if (document.body) {
        scanDOMResources();
        startMutationObserver();
    } else {
        document.addEventListener("DOMContentLoaded", () => {
            removeAdElements();
            scanDOMResources();
            startMutationObserver();
        });
    }

    // 5. Final scan after page fully loads (catches late resources)
    window.addEventListener("load", () => {
        scanExistingResources();
        scanDOMResources();
    });
})();
