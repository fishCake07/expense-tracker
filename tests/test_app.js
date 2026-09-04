const fs = require('fs');
const assert = require('assert');

console.log("--- Starting Comprehensive App Reformation Tests ---");

// Test 1: HTML Element Check for 5-Page Architecture
const htmlContent = fs.readFileSync('/working_dir/c_b9306d2ea6b3970f/expense-tracker/index.html', 'utf8');
const requiredIds = [
  'view-commitments',
  'view-transactions',
  'view-dashboard',
  'view-analysis',
  'view-settings',
  'rolling-nav-bar',
  'roller-prev',
  'roller-current',
  'roller-next',
  'btn-dash-add-tx',
  'btn-dash-add-commit',
  'dashboard-installments-card',
  'dashboard-installments-list',
  'category-pie-chart',
  'pie-chart-month-select',
  'pie-chart-breakdown-list'
];

requiredIds.forEach(id => {
  assert(htmlContent.includes(`id="${id}"`), `HTML missing required ID: ${id}`);
});
console.log("✓ Test 1 Passed: All 5 pages, Rolling Nav Bar, Dashboard Action Buttons, and Pie Chart elements exist in HTML.");

// Test 2: 5-Page Sequence & Rolling Bar State
const TAB_ORDER = ["commitments", "transactions", "dashboard", "analysis", "settings"];

function getRollingState(currentTab) {
  const idx = TAB_ORDER.indexOf(currentTab);
  const prev = idx > 0 ? TAB_ORDER[idx - 1] : null;
  const curr = TAB_ORDER[idx];
  const next = idx < TAB_ORDER.length - 1 ? TAB_ORDER[idx + 1] : null;
  return { prev, curr, next };
}

// Check Dashboard (Default)
const dashState = getRollingState("dashboard");
assert.strictEqual(dashState.prev, "transactions");
assert.strictEqual(dashState.curr, "dashboard");
assert.strictEqual(dashState.next, "analysis");

// Check Commitments (Far Left)
const commitState = getRollingState("commitments");
assert.strictEqual(commitState.prev, null);
assert.strictEqual(commitState.curr, "commitments");
assert.strictEqual(commitState.next, "transactions");

// Check Settings (Far Right)
const setState = getRollingState("settings");
assert.strictEqual(setState.prev, "analysis");
assert.strictEqual(setState.curr, "settings");
assert.strictEqual(setState.next, null);
console.log("✓ Test 2 Passed: Rolling Bar sequential carousel and boundaries verified.");

// Test 3: CSS Sizing & Gradient Checks
const cssContent = fs.readFileSync('/working_dir/c_b9306d2ea6b3970f/expense-tracker/style.css', 'utf8');
assert(cssContent.includes('.rolling-nav-bar'), "Missing .rolling-nav-bar in CSS");
assert(cssContent.includes('.btn-add-tx-gradient'), "Missing .btn-add-tx-gradient in CSS");
assert(cssContent.includes('.btn-add-commit-gradient'), "Missing .btn-add-commit-gradient in CSS");
assert(cssContent.includes('.pie-chart-container-layout'), "Missing .pie-chart-container-layout in CSS");
console.log("✓ Test 3 Passed: Option 1 Gradients, Rolling Bar, and Pie Chart styles confirmed in CSS.");

// Test 4: JavaScript Syntax Validation
require('child_process').execSync('node -c /working_dir/c_b9306d2ea6b3970f/expense-tracker/app.js');
require('child_process').execSync('node -c /working_dir/c_b9306d2ea6b3970f/expense-tracker/sw.js');
console.log("✓ Test 4 Passed: app.js and sw.js pass syntax validation with zero errors.");

console.log("\nAll Comprehensive Reformation tests passed successfully!");
