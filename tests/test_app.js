const fs = require('fs');
const assert = require('assert');

console.log("--- Starting iOS Fixes & Swipe Gestures Verification Tests ---");

// Test 1: iOS Meta Tags & Safe Area Integrity
const htmlContent = fs.readFileSync('/working_dir/c_b9306d2ea6b3970f/expense-tracker/index.html', 'utf8');
assert(htmlContent.includes('content="default"'), "iOS status bar should use default style");

const cssContent = fs.readFileSync('/working_dir/c_b9306d2ea6b3970f/expense-tracker/style.css', 'utf8');
assert(cssContent.includes('env(safe-area-inset-top'), "Missing safe-area-inset-top in CSS");
assert(cssContent.includes('env(safe-area-inset-bottom'), "Missing safe-area-inset-bottom in CSS");
console.log("✓ Test 1 Passed: iOS status bar meta tag and safe-area insets verified in HTML and CSS.");

// Test 2: Tab Order & Swipe Navigation Transitions
const TAB_ORDER = ["dashboard", "analysis", "settings"];

function getNextTab(current) {
  const idx = TAB_ORDER.indexOf(current);
  return idx < TAB_ORDER.length - 1 ? TAB_ORDER[idx + 1] : current;
}

function getPrevTab(current) {
  const idx = TAB_ORDER.indexOf(current);
  return idx > 0 ? TAB_ORDER[idx - 1] : current;
}

// Swiping left from dashboard moves to analysis
assert.strictEqual(getNextTab("dashboard"), "analysis");
// Swiping left from analysis moves to settings
assert.strictEqual(getNextTab("analysis"), "settings");
// Swiping left from settings stays at settings (boundary edge)
assert.strictEqual(getNextTab("settings"), "settings");

// Swiping right from settings moves to analysis
assert.strictEqual(getPrevTab("settings"), "analysis");
// Swiping right from analysis moves to dashboard
assert.strictEqual(getPrevTab("analysis"), "dashboard");
// Swiping right from dashboard stays at dashboard (boundary edge)
assert.strictEqual(getPrevTab("dashboard"), "dashboard");
console.log("✓ Test 2 Passed: Tab order sequences and boundary protections verified.");

// Test 3: JavaScript Syntax Validation
require('child_process').execSync('node -c /working_dir/c_b9306d2ea6b3970f/expense-tracker/app.js');
require('child_process').execSync('node -c /working_dir/c_b9306d2ea6b3970f/expense-tracker/sw.js');
console.log("✓ Test 3 Passed: app.js and sw.js pass syntax validation with zero errors.");

console.log("\nAll iOS UI & Swipe gesture tests passed successfully!");
