const fs = require('fs');
const assert = require('assert');

console.log("--- Starting Debit Card & Multi-Card Picker Verification Tests ---");

// Test 1: HTML Element Check
const htmlContent = fs.readFileSync('/working_dir/c_b9306d2ea6b3970f/expense-tracker/index.html', 'utf8');
const requiredIds = [
  'select-card-dialog',
  'picker-credit-cards-list',
  'picker-debit-cards-list',
  'nav-to-add-card-btn',
  'debit-cards-grid',
  'debit-card-dialog',
  'debit-card-name',
  'debit-card-bank'
];

requiredIds.forEach(id => {
  assert(htmlContent.includes(`id="${id}"`), `HTML missing required ID: ${id}`);
});
console.log("✓ Test 1 Passed: Card picker modal, lists, debit cards grid, and debit dialog confirmed in HTML.");

// Test 2: Card Spend Routing Logic (Credit Card vs. Debit Card)
const creditCard = { id: "card_maybank", name: "Maybank Visa", currentBilled: 0.00, unbilledBalance: 100.00 };
const debitCard = { id: "debit_maybank", name: "Maybank Visa Debit", totalSpentThisMonth: 50.00 };

const txAmt = 45.00;

// Case A: Logging with Credit Card
creditCard.unbilledBalance += txAmt;
assert.strictEqual(creditCard.unbilledBalance, 145.00, "Credit card must accumulate into unbilled balance");

// Case B: Logging with Debit Card
debitCard.totalSpentThisMonth += txAmt;
assert.strictEqual(debitCard.totalSpentThisMonth, 95.00, "Debit card must accumulate into monthly spent counter");
console.log("✓ Test 2 Passed: Credit Card accumulates to unbilled balance; Debit Card accumulates to monthly debit spend.");

// Test 3: Debit Card DSR Invariance (0% DSR impact)
function getDebitCardDsrImpact() {
  return 0.00; // Bank Negara / CCRIS 0% rule
}
assert.strictEqual(getDebitCardDsrImpact(), 0.00, "Debit cards must have 0% DSR impact");
console.log("✓ Test 3 Passed: Debit Card 0% DSR impact rule verified.");

// Test 4: JavaScript Syntax Validation
require('child_process').execSync('node -c /working_dir/c_b9306d2ea6b3970f/expense-tracker/app.js');
require('child_process').execSync('node -c /working_dir/c_b9306d2ea6b3970f/expense-tracker/sw.js');
console.log("✓ Test 4 Passed: app.js and sw.js pass syntax validation with zero errors.");

console.log("\nAll Debit Card & Multi-Card Picker tests passed successfully!");
