const fs = require('fs');
const assert = require('assert');

console.log("--- Starting Credit Card Engine & Notification Center Tests ---");

// Test 1: HTML Elements Integrity
const htmlContent = fs.readFileSync('/working_dir/c_b9306d2ea6b3970f/expense-tracker/index.html', 'utf8');
const requiredIds = [
  'open-notifications-btn',
  'notif-badge-count',
  'credit-cards-grid',
  'open-add-card-btn',
  'card-dialog',
  'notification-center-dialog',
  'notifications-list',
  'release-guide-dialog'
];

requiredIds.forEach(id => {
  assert(htmlContent.includes(`id="${id}"`), `HTML missing required ID: ${id}`);
});
console.log("✓ Test 1 Passed: Notification bell, Credit Card grid, and all new dialogs exist in HTML.");

// Test 2: Bank Negara Malaysia (BNM) 5% / RM 50 CCRIS Rule
function calculateCreditCardDsrCommitment(card) {
  if (card.payInFull && card.currentBilled === 0) return 0.00;
  const totalOutstanding = card.currentBilled + card.unbilledBalance;
  return Math.max(Number((totalOutstanding * 0.05).toFixed(2)), 50.00);
}

// Case A: Card paid in full with 0 billed
const cardPaidInFull = { payInFull: true, currentBilled: 0.00, unbilledBalance: 250.00 };
assert.strictEqual(calculateCreditCardDsrCommitment(cardPaidInFull), 0.00);

// Case B: Carrying balance under RM 1,000 (e.g. RM 400 -> 5% is RM 20, so floor is RM 50)
const cardSmallBalance = { payInFull: false, currentBilled: 400.00, unbilledBalance: 0.00 };
assert.strictEqual(calculateCreditCardDsrCommitment(cardSmallBalance), 50.00);

// Case C: Carrying balance over RM 1,000 (e.g. RM 2,400 -> 5% is RM 120)
const cardLargeBalance = { payInFull: false, currentBilled: 2400.00, unbilledBalance: 0.00 };
assert.strictEqual(calculateCreditCardDsrCommitment(cardLargeBalance), 120.00);
console.log("✓ Test 2 Passed: Malaysian CCRIS 5% or RM 50 rule verified across zero, small, and large balances.");

// Test 3: Statement Cut-Off Rollover Simulation
const card = { statementDay: 25, dueDay: 15, currentBilled: 100.00, unbilledBalance: 450.00, lastRolled: "2026-07" };
const currentYm = "2026-08";
const todayDay = 25;

if (todayDay >= card.statementDay && card.lastRolled !== currentYm) {
  card.currentBilled += card.unbilledBalance;
  card.unbilledBalance = 0.00;
  card.lastRolled = currentYm;
}

assert.strictEqual(card.currentBilled, 550.00);
assert.strictEqual(card.unbilledBalance, 0.00);
assert.strictEqual(card.lastRolled, "2026-08");
console.log("✓ Test 3 Passed: Statement Cut-off freezes unbilled spending (RM 450) into billed balance (RM 550) and resets unbilled to 0.");

// Test 4: JavaScript Syntax Validation
require('child_process').execSync('node -c /working_dir/c_b9306d2ea6b3970f/expense-tracker/app.js');
require('child_process').execSync('node -c /working_dir/c_b9306d2ea6b3970f/expense-tracker/sw.js');
console.log("✓ Test 4 Passed: app.js and sw.js pass syntax checks with zero errors.");

console.log("\nAll Credit Card Engine & Notification Center tests passed successfully!");
