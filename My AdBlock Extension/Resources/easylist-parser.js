// ============================================================
// My AdBlock — easylist-parser.js
// Shared EasyList parser used by both popup.js and background.js
// ============================================================

/**
 * Parse raw EasyList / Adblock Plus filter list text into an array of
 * { ruleType: "host"|"pattern", value: string } objects.
 */
function parseEasyList(text) {
    const lines = text.split(/\r?\n/);
    const rules = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Skip empty lines
        if (!line) continue;

        // Skip comments and header lines
        if (line.charCodeAt(0) === 33 /* ! */ || line.charCodeAt(0) === 91 /* [ */) continue;

        // Skip exception / allowlist rules (@@)
        if (line.charCodeAt(0) === 64 && line.charCodeAt(1) === 64) continue;

        // Skip element-hiding / cosmetic rules
        if (line.includes("##") || line.includes("#@#") || line.includes("#?#")) continue;

        // Strip $-options (e.g. $third-party,script)
        let filterPart = line;
        const dollarIdx = line.lastIndexOf("$");
        if (dollarIdx >= 0) {
            filterPart = line.substring(0, dollarIdx);
        }

        if (!filterPart) continue;

        const converted = convertEasyListLineToRule(filterPart);
        if (converted) {
            rules.push(converted);
        }
    }

    return rules;
}

/**
 * Convert a single EasyList filter string (options already stripped)
 * into an internal { ruleType, value } object, or null if unsupported.
 */
function convertEasyListLineToRule(filter) {
    // Host-blocking pattern: ||domain.com^ or ||domain.com
    const hostMatch = filter.match(/^\|\|([a-z0-9._-]+)\^?$/i);
    if (hostMatch) {
        return { ruleType: "host", value: hostMatch[1].toLowerCase() };
    }

    // Treat any remaining filter as a URL pattern
    let pattern = filter;

    // Remove leading/trailing anchors
    pattern = pattern.replace(/^\|{1,2}/, "").replace(/\|$/, "");

    // Replace ^ (separator placeholder) with a wildcard
    pattern = pattern.replace(/\^/g, "*");

    // Collapse multiple consecutive wildcards
    pattern = pattern.replace(/\*{2,}/g, "*");

    pattern = pattern.trim();
    if (!pattern || pattern === "*") return null;

    return { ruleType: "pattern", value: pattern.toLowerCase() };
}

/**
 * Convert an internal custom rule back to EasyList filter syntax.
 */
function ruleToEasyListLine(rule) {
    if (rule.ruleType === "host") {
        return `||${rule.value}^`;
    }
    return rule.value;
}
