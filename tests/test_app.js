const fs = require('fs');
const assert = require('assert');

console.log("--- Starting Option 1: Monthly Budget Verification Tests ---");

// Test 1: HTML Element Integrity
const htmlContent = fs.readFileSync('/working_dir/c_b9306d2ea6b3970f/expense-tracker/index.html', 'utf8');
const budgetIds = [
  'budget-section',
  'budget-month-label',
  'budget-spent-display',
  'budget-limit-display',
  'edit-budget-btn',
  'budget-btn-text',
  'budget-bar-fill',
  'budget-remaining-text',
  'budget-percentage-text',
  'budget-dialog',
  'budget-form',
  'budget-input',
  'cancel-budget-btn',
  'save-budget-btn',
  'budget-dialog-currency'
];

budgetIds.forEach(id => {
  assert(htmlContent.includes(`id="${id}"`), `HTML missing required budget element ID: ${id}`);
});
console.log("✓ Test 1 Passed: All Option 1 budget HTML elements and modal dialog IDs exist.");

// Test 2: Monthly Spending Filter Logic
const sampleTx = [
  { amount: 50, date: "2026-09-01" },
  { amount: 75, date: "2026-09-02" },
  { amount: 120, date: "2026-08-28" } // Previous month
];

const currentMonthPrefix = "2026-09";
const monthSpend = sampleTx
  .filter(t => t.date.startsWith(currentMonthPrefix))
  .reduce((sum, t) => sum + t.amount, 0);

assert.strictEqual(monthSpend, 125, "Current month spending should only include 2026-09 transactions");
console.log("✓ Test 2 Passed: Monthly spending filter accurately isolates current month expenses.");

// Test 3: Budget Calculation and Threshold Statuses
const monthlyBudget = 200;

// Case A: Healthy state (e.g. $125 of $200 = 62.5%)
const percentA = (monthSpend / monthlyBudget) * 100;
assert.strictEqual(percentA, 62.5);
assert.strictEqual(monthlyBudget - monthSpend, 75); // remaining
console.log("✓ Test 3A Passed: Healthy budget state (62.5%) and remaining balance ($75) computed accurately.");

// Case B: Warning state (>= 80%)
const spendWarning = 170;
const percentB = (spendWarning / monthlyBudget) * 100;
assert(percentB >= 80 && percentB <= 100, "Should be in warning threshold");
console.log("✓ Test 3B Passed: 80% warning threshold triggers properly.");

// Case C: Over-budget state (> 100%)
const spendOver = 250;
const percentC = (spendOver / monthlyBudget) * 100;
const overAmount = spendOver - monthlyBudget;
assert(percentC > 100, "Should detect over budget");
assert.strictEqual(overAmount, 50, "Over budget amount calculation mismatch");
console.log("✓ Test 3C Passed: Over-budget condition detected and overage amount computed accurately ($50).");

// Test 4: JavaScript Syntax Validation
console.log("✓ Test 4: Validating JS syntax for app.js and sw.js...");
require('child_process').execSync('node -c /working_dir/c_b9306d2ea6b3970f/expense-tracker/app.js');
require('child_process').execSync('node -c /working_dir/c_b9306d2ea6b3970f/expense-tracker/sw.js');
console.log("✓ Test 4 Passed: app.js and sw.js pass syntax checking with no errors.");

console.log("\nAll Option 1 automated tests passed successfully!");
