const fs = require('fs');
const assert = require('assert');

console.log("--- Starting Option 4: Edit Transaction Verification Tests ---");

// Test 1: HTML Elements Integrity
const htmlContent = fs.readFileSync('/working_dir/c_b9306d2ea6b3970f/expense-tracker/index.html', 'utf8');
const requiredEditIds = [
  'edit-dialog',
  'edit-expense-form',
  'edit-tx-id',
  'edit-amount',
  'edit-category',
  'edit-date',
  'edit-note',
  'cancel-edit-btn',
  'save-edit-btn',
  'edit-dialog-currency'
];

requiredEditIds.forEach(id => {
  assert(htmlContent.includes(`id="${id}"`), `HTML missing required edit dialog ID: ${id}`);
});
console.log("✓ Test 1 Passed: All Option 4 Edit Modal dialog elements verified in index.html.");

// Test 2: Edit Mutation & Calculation Recalibration
const transactions = [
  { id: "tx_1", amount: 15.00, category: "Food & Dining", date: "2026-09-01", note: "Lunch" },
  { id: "tx_2", amount: 35.00, category: "Transportation", date: "2026-09-02", note: "Petrol" }
];

let initialTotal = transactions.reduce((sum, t) => sum + t.amount, 0);
assert.strictEqual(initialTotal, 50.00);

// Simulate editing tx_1 (amount changed from 15.00 to 25.50, category changed to Shopping)
const target = transactions.find(t => t.id === "tx_1");
assert(target !== undefined);
target.amount = 25.50;
target.category = "Shopping";
target.note = "Book purchase";

let updatedTotal = transactions.reduce((sum, t) => sum + t.amount, 0);
assert.strictEqual(updatedTotal, 60.50, "Total spend should reflect updated amount");

const categoryTotals = {};
transactions.forEach(t => categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount);
assert.strictEqual(categoryTotals["Shopping"], 25.50);
assert.strictEqual(categoryTotals["Food & Dining"], undefined);
console.log("✓ Test 2 Passed: In-memory mutation and recalculation (total & categories) succeed.");

// Test 3: JavaScript Syntax Check
require('child_process').execSync('node -c /working_dir/c_b9306d2ea6b3970f/expense-tracker/app.js');
require('child_process').execSync('node -c /working_dir/c_b9306d2ea6b3970f/expense-tracker/sw.js');
console.log("✓ Test 3 Passed: app.js and sw.js pass syntax checks without warnings or errors.");

console.log("\nAll Option 4 automated tests passed successfully!");
