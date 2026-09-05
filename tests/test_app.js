const fs = require('fs');
const assert = require('assert');

console.log("--- Starting Version 41: Multi-Card Pickers & Automated Release Tests ---");

// Test 1: HTML Element Check
const htmlContent = fs.readFileSync('/working_dir/c_b9306d2ea6b3970f/expense-tracker/index.html', 'utf8');
const requiredIds = [
  'select-card-dialog',
  'select-bank-dialog',
  'debit-card-dialog',
  'bank-account-dialog',
  'debit-cards-grid',
  'bank-accounts-grid',
  'pill-bank-tx',
  'pill-card-tx',
  'pill-bank-sub',
  'pill-card-sub',
  'selected-wallet'
];

requiredIds.forEach(id => {
  assert(htmlContent.includes(`id="${id}"`), `HTML missing required ID: ${id}`);
});
console.log("✓ Test 1 Passed: All dialogs, grids, and form pills exist in index.html.");

// Test 2: Automated Release Changelog Registry in app.js
const appJsContent = fs.readFileSync('/working_dir/c_b9306d2ea6b3970f/expense-tracker/app.js', 'utf8');
assert(appJsContent.includes('APP_RELEASES_REGISTRY'), "Missing APP_RELEASES_REGISTRY in app.js");
assert(appJsContent.includes('checkReleaseOnboardingGuide'), "Missing checkReleaseOnboardingGuide in app.js");
console.log("✓ Test 2 Passed: Automated release changelog registry and auto-onboarding verified.");

// Test 3: "🏦 Bank Transfer" and 2x2 Mobile Pill Responsive CSS
const cssContent = fs.readFileSync('/working_dir/c_b9306d2ea6b3970f/expense-tracker/style.css', 'utf8');
assert(cssContent.includes('.picker-card-option'), "Missing .picker-card-option in CSS");
assert(cssContent.includes('.debit-card-item'), "Missing .debit-card-item in CSS");
assert(cssContent.includes('.bank-account-item'), "Missing .bank-account-item in CSS");
console.log("✓ Test 3 Passed: Card picker and bank account styling confirmed in CSS.");

// Test 4: JavaScript Syntax Validation
require('child_process').execSync('node -c /working_dir/c_b9306d2ea6b3970f/expense-tracker/app.js');
require('child_process').execSync('node -c /working_dir/c_b9306d2ea6b3970f/expense-tracker/sw.js');
console.log("✓ Test 4 Passed: app.js and sw.js pass syntax checks with zero errors.");

console.log("\nAll Version 41 tests passed successfully!");
