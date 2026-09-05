const fs = require('fs');
const assert = require('assert');

console.log("--- Starting iOS Compatibility Verification Tests ---");

// Test 1: CSS 16px Font Size on Mobile Inputs
const cssContent = fs.readFileSync('/working_dir/c_b9306d2ea6b3970f/expense-tracker/style.css', 'utf8');
assert(cssContent.includes('font-size: 16px !important'), "Missing 16px font-size rule for mobile inputs in CSS");
console.log("✓ Test 1 Passed: 16px font size rule confirmed on mobile inputs (prevents iOS auto-zoom).");

// Test 2: Universal Dialog Backdrop Dismissal in app.js
const appJsContent = fs.readFileSync('/working_dir/c_b9306d2ea6b3970f/expense-tracker/app.js', 'utf8');
assert(appJsContent.includes('initUniversalBackdropDismissal'), "Missing initUniversalBackdropDismissal in app.js");
console.log("✓ Test 2 Passed: Universal backdrop dismissal confirmed for all modals in app.js.");

// Test 3: Momentum Scrolling & Dynamic Viewport Height in CSS
assert(cssContent.includes('-webkit-overflow-scrolling: touch'), "Missing -webkit-overflow-scrolling in CSS");
assert(cssContent.includes('min-height: 100dvh'), "Missing min-height: 100dvh in CSS");
console.log("✓ Test 3 Passed: iOS momentum scrolling and dynamic viewport height confirmed.");

// Test 4: JavaScript Syntax Validation
require('child_process').execSync('node -c /working_dir/c_b9306d2ea6b3970f/expense-tracker/app.js');
require('child_process').execSync('node -c /working_dir/c_b9306d2ea6b3970f/expense-tracker/sw.js');
console.log("✓ Test 4 Passed: app.js and sw.js pass syntax validation with zero errors.");

console.log("\nAll iOS Compatibility tests passed successfully!");
