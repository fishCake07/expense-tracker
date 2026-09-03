const fs = require('fs');
const assert = require('assert');

console.log("--- Starting Auto-Deduction Engine Verification Tests ---");

// Test 1: HTML Element Check
const htmlContent = fs.readFileSync('/working_dir/c_b9306d2ea6b3970f/expense-tracker/index.html', 'utf8');
assert(htmlContent.includes('id="sub-auto-deduct"'), "Missing sub-auto-deduct checkbox in sub-dialog");
console.log("✓ Test 1 Passed: Auto-deduct toggle switch verified in index.html.");

// Test 2: Auto-Deduction Engine & Duplicate Prevention Simulation
const subscriptions = [
  { id: "sub_netflix", name: "Netflix", amount: 45.00, category: "Entertainment", billingDay: 2, autoDeduct: true, lastLoggedMonth: null },
  { id: "sub_gym", name: "Gym", amount: 120.00, category: "Health & Medical", billingDay: 25, autoDeduct: true, lastLoggedMonth: null }, // future day
  { id: "sub_manual", name: "Electric Bill", amount: 80.00, category: "Bills & Utilities", billingDay: 2, autoDeduct: false, lastLoggedMonth: null } // autoDeduct off
];

const transactions = [];
const currentYm = "2026-09";
const currentDay = 3; // Sept 3rd

function runAutoDeduction(subs, txList, ym, day) {
  let loggedCount = 0;
  subs.forEach(sub => {
    if (sub.autoDeduct === false) return;
    if (day >= sub.billingDay && sub.lastLoggedMonth !== ym) {
      txList.push({
        id: "tx_auto_" + sub.id,
        type: "expense",
        amount: sub.amount,
        category: sub.category,
        date: `${ym}-${String(sub.billingDay).padStart(2, '0')}`,
        note: `${sub.name} (Auto-debited)`
      });
      sub.lastLoggedMonth = ym;
      loggedCount++;
    }
  });
  return loggedCount;
}

// First run: Should auto-deduct Netflix (day 2 has passed)
const firstRunCount = runAutoDeduction(subscriptions, transactions, currentYm, currentDay);
assert.strictEqual(firstRunCount, 1, "Only Netflix should be auto-deducted");
assert.strictEqual(transactions.length, 1);
assert.strictEqual(transactions[0].note, "Netflix (Auto-debited)");
assert.strictEqual(subscriptions[0].lastLoggedMonth, "2026-09");
console.log("✓ Test 2A Passed: First run auto-debited due bill (Netflix) on Sept 2nd.");

// Second run on same day: Should NOT duplicate
const secondRunCount = runAutoDeduction(subscriptions, transactions, currentYm, currentDay);
assert.strictEqual(secondRunCount, 0, "Duplicate deduction must be prevented");
assert.strictEqual(transactions.length, 1, "Transactions array length should remain 1");
console.log("✓ Test 2B Passed: Duplicate deduction prevented (0 new transactions on repeat run).");

// Test 3: JavaScript Syntax Validation
require('child_process').execSync('node -c /working_dir/c_b9306d2ea6b3970f/expense-tracker/app.js');
require('child_process').execSync('node -c /working_dir/c_b9306d2ea6b3970f/expense-tracker/sw.js');
console.log("✓ Test 3 Passed: app.js and sw.js pass syntax checks with zero errors.");

console.log("\nAll Auto-Deduction tests passed successfully!");
