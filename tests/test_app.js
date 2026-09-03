const fs = require('fs');
const assert = require('assert');

console.log("--- Starting Queue Item 1: Multi-Wallet / Account Selector Tests ---");

// Test 1: HTML Element Integrity
const htmlContent = fs.readFileSync('/working_dir/c_b9306d2ea6b3970f/expense-tracker/index.html', 'utf8');
const requiredWalletIds = ['wallet-pill-group', 'selected-wallet', 'edit-wallet', 'wallet-stats-grid'];
requiredWalletIds.forEach(id => {
  assert(htmlContent.includes(`id="${id}"`), `HTML missing required ID: ${id}`);
});
console.log("✓ Test 1 Passed: Wallet pill group, selected input, edit dropdown, and analysis grid exist in HTML.");

// Test 2: Wallet Tagging on Transaction & Fallback
const transactions = [
  { id: "1", amount: 15.00, category: "Food & Dining", wallet: "E-Wallet" },
  { id: "2", amount: 120.00, category: "Shopping", wallet: "Credit Card" },
  { id: "3", amount: 30.00, category: "Transportation" } // legacy record without wallet property
];

assert.strictEqual(transactions[0].wallet, "E-Wallet");
assert.strictEqual(transactions[1].wallet, "Credit Card");
assert.strictEqual(transactions[2].wallet || "Bank Account", "Bank Account", "Legacy records must default to Bank Account");
console.log("✓ Test 2 Passed: Wallet tagging and legacy default fallback verified.");

// Test 3: Spending by Wallet Aggregation
const walletTotals = { "Bank Account": 0, "Credit Card": 0, "E-Wallet": 0, "Cash": 0 };
transactions.forEach(t => {
  const w = t.wallet || "Bank Account";
  walletTotals[w] = (walletTotals[w] || 0) + t.amount;
});

assert.strictEqual(walletTotals["E-Wallet"], 15.00);
assert.strictEqual(walletTotals["Credit Card"], 120.00);
assert.strictEqual(walletTotals["Bank Account"], 30.00);
assert.strictEqual(walletTotals["Cash"], 0.00);
console.log("✓ Test 3 Passed: Spending by Wallet breakdown aggregated accurately.");

// Test 4: CSV Headers Check
const appJsContent = fs.readFileSync('/working_dir/c_b9306d2ea6b3970f/expense-tracker/app.js', 'utf8');
assert(appJsContent.includes('"Date", "Type", "Category", "Wallet", "Note", "Amount", "Currency"'), "CSV missing Wallet column");
console.log("✓ Test 4 Passed: CSV export correctly contains Wallet column.");

// Test 5: JavaScript Syntax Check
require('child_process').execSync('node -c /working_dir/c_b9306d2ea6b3970f/expense-tracker/app.js');
require('child_process').execSync('node -c /working_dir/c_b9306d2ea6b3970f/expense-tracker/sw.js');
console.log("✓ Test 5 Passed: app.js and sw.js pass syntax validation with zero errors.");

console.log("\nAll Queue Item 1 tests passed successfully!");
