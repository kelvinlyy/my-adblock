/**
 * Updates the UI state based on whether the extension is enabled.
 * Called from ViewController.swift via evaluateJavaScript.
 *
 * @param {boolean|undefined} enabled – true if on, false if off, undefined if unknown.
 * @param {boolean} useSettingsInsteadOfPreferences – true on macOS 13+ ("Settings" wording).
 */
function show(enabled, useSettingsInsteadOfPreferences) {
    if (useSettingsInsteadOfPreferences) {
        document.querySelector(".state-on").innerText =
            "My AdBlock's extension is currently on. You can turn it off in the Extensions section of Safari Settings.";
        document.querySelector(".state-off").innerText =
            "My AdBlock's extension is currently off. You can turn it on in the Extensions section of Safari Settings.";
        document.querySelector(".state-unknown").innerText =
            "You can turn on My AdBlock's extension in the Extensions section of Safari Settings.";
        document.querySelector(".open-preferences").innerText =
            "Quit and Open Safari Settings…";
    }

    if (typeof enabled === "boolean") {
        document.body.classList.toggle("state-on", enabled);
        document.body.classList.toggle("state-off", !enabled);
    } else {
        document.body.classList.remove("state-on", "state-off");
    }
}

function openPreferences() {
    webkit.messageHandlers.controller.postMessage("open-preferences");
}

document.querySelector("button.open-preferences").addEventListener("click", openPreferences);
