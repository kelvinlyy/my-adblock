// ============================================================
// Tests for easylist-parser.js
// ============================================================

const {
    describe, it, assertEqual, assertDeepEqual, assertNull, assertTrue,
    printResults, loadScript,
} = require("./test-harness");

// Load the module under test into global scope
loadScript("../../My AdBlock Extension/Resources/shared/easylist-parser.js");

// ---------------------
// convertEasyListLineToRule
// ---------------------

describe("convertEasyListLineToRule", () => {
    it("should parse host-blocking pattern ||domain.com^", () => {
        const result = convertEasyListLineToRule("||ads.example.com^");
        assertDeepEqual(result, { ruleType: "host", value: "ads.example.com" });
    });

    it("should parse host-blocking pattern without trailing ^", () => {
        const result = convertEasyListLineToRule("||tracker.net");
        assertDeepEqual(result, { ruleType: "host", value: "tracker.net" });
    });

    it("should parse host with subdomain and dots", () => {
        const result = convertEasyListLineToRule("||sub.ads.example.co.uk^");
        assertDeepEqual(result, { ruleType: "host", value: "sub.ads.example.co.uk" });
    });

    it("should parse host with hyphens and numbers", () => {
        const result = convertEasyListLineToRule("||ad-server-01.example.com^");
        assertDeepEqual(result, { ruleType: "host", value: "ad-server-01.example.com" });
    });

    it("should parse URL pattern with leading ||path", () => {
        const result = convertEasyListLineToRule("||example.com/ads/banner");
        assertDeepEqual(result, { ruleType: "pattern", value: "example.com/ads/banner" });
    });

    it("should parse plain path pattern", () => {
        const result = convertEasyListLineToRule("/ads/banner.js");
        assertDeepEqual(result, { ruleType: "pattern", value: "/ads/banner.js" });
    });

    it("should replace ^ separator with wildcard", () => {
        const result = convertEasyListLineToRule("/ads^banner^");
        assertDeepEqual(result, { ruleType: "pattern", value: "/ads*banner*" });
    });

    it("should collapse multiple consecutive wildcards", () => {
        const result = convertEasyListLineToRule("/ads***/banner");
        assertDeepEqual(result, { ruleType: "pattern", value: "/ads*/banner" });
    });

    it("should remove leading single | anchor", () => {
        const result = convertEasyListLineToRule("|http://ads.com/");
        assertDeepEqual(result, { ruleType: "pattern", value: "http://ads.com/" });
    });

    it("should remove trailing | anchor", () => {
        const result = convertEasyListLineToRule("/ads.js|");
        assertDeepEqual(result, { ruleType: "pattern", value: "/ads.js" });
    });

    it("should return null for empty filter", () => {
        const result = convertEasyListLineToRule("");
        assertNull(result);
    });

    it("should return null for wildcard-only filter", () => {
        const result = convertEasyListLineToRule("*");
        assertNull(result);
    });

    it("should return null for ^ only (becomes *)", () => {
        const result = convertEasyListLineToRule("^");
        assertNull(result);
    });

    it("should lowercase the value", () => {
        const result = convertEasyListLineToRule("||ADS.EXAMPLE.COM^");
        assertDeepEqual(result, { ruleType: "host", value: "ads.example.com" });
    });
});

// ---------------------
// parseEasyList
// ---------------------

describe("parseEasyList", () => {
    it("should parse a complete filter list", () => {
        const text = [
            "[Adblock Plus 2.0]",
            "! Title: Test List",
            "! Last modified: 2024-01-01",
            "",
            "||ads.example.com^",
            "||tracker.net^",
            "/banner/ad.js",
        ].join("\n");

        const rules = parseEasyList(text);
        assertEqual(rules.length, 3);
        assertDeepEqual(rules[0], { ruleType: "host", value: "ads.example.com" });
        assertDeepEqual(rules[1], { ruleType: "host", value: "tracker.net" });
        assertDeepEqual(rules[2], { ruleType: "pattern", value: "/banner/ad.js" });
    });

    it("should skip comment lines starting with !", () => {
        const rules = parseEasyList("! This is a comment\n||ads.com^");
        assertEqual(rules.length, 1);
    });

    it("should skip header lines starting with [", () => {
        const rules = parseEasyList("[Adblock Plus 2.0]\n||ads.com^");
        assertEqual(rules.length, 1);
    });

    it("should skip exception rules starting with @@", () => {
        const rules = parseEasyList("@@||allowed.com^\n||ads.com^");
        assertEqual(rules.length, 1);
        assertDeepEqual(rules[0], { ruleType: "host", value: "ads.com" });
    });

    it("should skip element-hiding rules with ##", () => {
        const rules = parseEasyList("example.com##.ad-banner\n||ads.com^");
        assertEqual(rules.length, 1);
    });

    it("should skip element-hiding exception rules with #@#", () => {
        const rules = parseEasyList("example.com#@#.ad\n||ads.com^");
        assertEqual(rules.length, 1);
    });

    it("should skip procedural cosmetic rules with #?#", () => {
        const rules = parseEasyList("example.com#?#.ad:has-text(ad)\n||ads.com^");
        assertEqual(rules.length, 1);
    });

    it("should strip $-options from filters", () => {
        const rules = parseEasyList("||ads.com^$third-party,script");
        assertEqual(rules.length, 1);
        assertDeepEqual(rules[0], { ruleType: "host", value: "ads.com" });
    });

    it("should skip lines that become empty after stripping $-options", () => {
        const rules = parseEasyList("$third-party");
        assertEqual(rules.length, 0);
    });

    it("should skip empty lines", () => {
        const rules = parseEasyList("\n\n||ads.com^\n\n");
        assertEqual(rules.length, 1);
    });

    it("should handle Windows-style line endings (\\r\\n)", () => {
        const rules = parseEasyList("||a.com^\r\n||b.com^\r\n");
        assertEqual(rules.length, 2);
    });

    it("should return empty array for empty input", () => {
        const rules = parseEasyList("");
        assertEqual(rules.length, 0);
    });

    it("should return empty array for comments-only input", () => {
        const rules = parseEasyList("! comment1\n! comment2\n");
        assertEqual(rules.length, 0);
    });
});

// ---------------------
// ruleToEasyListLine
// ---------------------

describe("ruleToEasyListLine", () => {
    it("should convert host rule to ||domain^", () => {
        const line = ruleToEasyListLine({ ruleType: "host", value: "ads.example.com" });
        assertEqual(line, "||ads.example.com^");
    });

    it("should return pattern value as-is", () => {
        const line = ruleToEasyListLine({ ruleType: "pattern", value: "/ads/banner" });
        assertEqual(line, "/ads/banner");
    });

    it("should roundtrip host rules through parse and back", () => {
        const original = "||ads.example.com^";
        const parsed = parseEasyList(original);
        const back = ruleToEasyListLine(parsed[0]);
        assertEqual(back, original);
    });
});

printResults();
