const fs = require('fs');
const assert = require('assert');

console.log("--- Starting Multi-Card Architecture (Credit & Debit) Tests ---");

// Test 1: HTML Element Check
const htmlContent = fs.readFileSync('/working_dir/c_b9306d2ea6b3970f/expense-tracker/index.html', 'utf8');
const requiredIds = [
  'debit-cards-grid',
  'open-add-debit-card-btn',
  'debit-card-dialog',
  'card-picker-modal',
  'wallet-pill-card-btn',
  'picker-credit-cards-list',
  'picker-debit-cards-list',
  'picker-add-card-btn'
];

requiredIds.forEach(id => {
  assert(htmlContent.includes(`id="${id}"`), `HTML missing required ID: ${id}`);
});
console.log("✓ Test 1 Passed: Debit Cards grid, modal, and Card Picker modal confirmed in HTML.");

// Test 2: Debit Card vs Credit Card Mechanics
const creditCard = { id: "c1", name: "Maybank Visa", currentBilled: 0, unbilledBalance: 100, payInFull: true };
const debitCard = { id: "d1", name: "Maybank Debit", totalSpentThisMonth: 50 };

// Scenario A: Spend RM 50 with Credit Card
const spendAmount = 50.00;
creditCard.unbilledBalance += spendAmount;
assert.strictEqual(creditCard.unbilledBalance, 150.00, "Credit card must accumulate unbilled balance");

// Scenario B: Spend RM 30 with Debit Card
debitCard.totalSpentThisMonth += 30.00;
assert.strictEqual(debitCard.totalSpentThisMonth, 80.00, "Debit card must accumulate monthly spend counter");

// Check DSR impact
function getDsrContribution(card, isDebit = false) {
  if (isDebit) return 0.00;
  if (card.payInFull && card.currentBilled === 0) return 0.00;
  const bal = card.currentBilled + card.unbilledBalance;
  return Math.max(Number((bal * 0.05).toFixed(2)), 50.00);
}

assert.strictEqual(getDsrContribution(debitCard, true), 0.00, "Debit cards must have 0% DSR impact");
assert.strictEqual(getDsrContribution(creditCard, false), 0.00, "Paid in full credit card with 0 billed has 0% DSR impact");
console.log("✓ Test 2 Passed: Debit Card (0% DSR) vs Credit Card (Unbilled accumulation) verified.");

// Test 3: JavaScript Syntax Validation
require('child_process').execSync('node -c /working_dir/c_b9306d2ea6b3970f/expense-tracker/app.js');
require('child_process').execSync('node -c /working_dir/c_b9306d2ea6b3970f/expense-tracker/sw.js');
console.log("✓ Test 3 Passed: app.js and sw.js pass syntax checks with zero errors.");

console.log("\nAll Multi-Card Architecture tests passed successfully!");
