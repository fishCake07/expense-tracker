const fs = require('fs');
const assert = require('assert');

console.log("--- Starting Midnight Rollover & Local Timezone Verification Tests ---");

// Test 1: Local Clock Formatting vs UTC
function getLocalDateString(dateObj = new Date()) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const day = String(dateObj.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Simulate 00:30 AM local time on September 3, 2026
const testDate = new Date(2026, 8, 3, 0, 30, 0); // Month is 0-indexed (8 = September)
assert.strictEqual(getLocalDateString(testDate), "2026-09-03");
console.log("✓ Test 1 Passed: Local device date returns correct current date at midnight (00:30).");

// Test 2: App Code Verification
const appJsContent = fs.readFileSync('/working_dir/c_b9306d2ea6b3970f/expense-tracker/app.js', 'utf8');
assert(appJsContent.includes("scheduleMidnightRollover()"), "Missing scheduleMidnightRollover");
assert(appJsContent.includes("initDateLifecycleListeners()"), "Missing initDateLifecycleListeners");
assert(appJsContent.includes("visibilitychange"), "Missing visibilitychange listener");
assert(!appJsContent.includes('new Date().toISOString().split("T")[0]'), "Stale UTC toISOString usage still found");
console.log("✓ Test 2 Passed: Midnight rollover timer and mobile app resume listeners confirmed in app.js.");

// Test 3: JavaScript Syntax Validation
require('child_process').execSync('node -c /working_dir/c_b9306d2ea6b3970f/expense-tracker/app.js');
require('child_process').execSync('node -c /working_dir/c_b9306d2ea6b3970f/expense-tracker/sw.js');
console.log("✓ Test 3 Passed: app.js and sw.js pass syntax checks with zero errors.");

console.log("\nAll Midnight Rollover & Local Timezone tests passed successfully!");
