#!/usr/bin/env node
// ============================================================
// My AdBlock — run-tests.js
// Runs all JS test suites sequentially.
// Usage: node My\ AdBlockTests/js/run-tests.js
// ============================================================

const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const testsDir = __dirname;
const testFiles = fs.readdirSync(testsDir)
    .filter((f) => f.endsWith(".test.js"))
    .sort();

console.log(`\n🧪 My AdBlock — JavaScript Test Suite`);
console.log(`   Found ${testFiles.length} test file(s)\n`);
console.log("═".repeat(50));

let totalPassed = 0;
let totalFailed = 0;
let totalTests = 0;
let failedSuites = [];

for (const file of testFiles) {
    const filePath = path.join(testsDir, file);
    console.log(`\n📄 ${file}`);

    let output = "";
    try {
        output = execSync(`node "${filePath}"`, {
            encoding: "utf-8",
            timeout: 30000,
        });
    } catch (e) {
        // execSync throws on non-zero exit — but output may still be valid
        output = (e.stdout || "") + (e.stderr || "");
    }

    console.log(output);

    // Parse results from output
    const match = output.match(/(\d+) passing, (\d+) failing, (\d+) total/);
    if (match) {
        totalPassed += parseInt(match[1]);
        totalFailed += parseInt(match[2]);
        totalTests += parseInt(match[3]);
        if (parseInt(match[2]) > 0) failedSuites.push(file);
    } else {
        // No results parsed — count as a failure
        failedSuites.push(file);
        totalFailed++;
        totalTests++;
    }
}

console.log("\n" + "═".repeat(50));
console.log(`\n🏁 Final Results: ${totalPassed} passing, ${totalFailed} failing, ${totalTests} total`);

if (failedSuites.length > 0) {
    console.log(`\n❌ Failed suites: ${failedSuites.join(", ")}`);
    process.exitCode = 1;
} else {
    console.log(`\n✅ All tests passed!`);
}
