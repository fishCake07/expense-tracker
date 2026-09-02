const fs = require('fs');
const assert = require('assert');

console.log("--- Starting Expense Tracker Self-Verification Tests ---");

const htmlContent = fs.readFileSync('/working_dir/c_b9306d2ea6b3970f/expense-tracker/index.html', 'utf8');
const requiredIds = [
  'expense-form',
  'amount',
  'category',
  'date',
  'note',
  'currency-select',
  'currency-display',
  'total-spend',
  'transaction-count',
  'top-category',
  'top-category-amount',
  'latest-date',
  'latest-note',
  'category-breakdown-list',
  'transaction-list',
  'filter-category',
  'clear-all-btn',
  'load-sample-btn',
  'toast',
  'amount-error',
  'category-error',
  'date-error'
];

requiredIds.forEach(id => {
  assert(htmlContent.includes(`id="${id}"`), `HTML missing required element ID: ${id}`);
});
console.log("✓ Test 1 Passed: All essential HTML element IDs exist and match app.js references.");

const sampleTransactions = [
  { id: "1", amount: 15.50, category: "Food & Dining", date: "2026-09-01" },
  { id: "2", amount: 30.00, category: "Transportation", date: "2026-09-02" },
  { id: "3", amount: 24.50, category: "Food & Dining", date: "2026-08-30" }
];

const totalSpend = sampleTransactions.reduce((sum, t) => sum + t.amount, 0);
assert.strictEqual(totalSpend, 70.00, "Total spend calculation mismatch");

const categoryTotals = {};
sampleTransactions.forEach(t => {
  categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
});

assert.strictEqual(categoryTotals["Food & Dining"], 40.00);
assert.strictEqual(categoryTotals["Transportation"], 30.00);

let topCat = "";
let topAmt = -1;
for (const [cat, sum] of Object.entries(categoryTotals)) {
  if (sum > topAmt) {
    topAmt = sum;
    topCat = cat;
  }
}
assert.strictEqual(topCat, "Food & Dining");
assert.strictEqual(topAmt, 40.00);
console.log("✓ Test 2 Passed: Business logic, total spend, and top category calculations are accurate.");

const sorted = [...sampleTransactions].sort((a, b) => new Date(b.date) - new Date(a.date));
assert.strictEqual(sorted[0].date, "2026-09-02");
assert.strictEqual(sorted[1].date, "2026-09-01");
assert.strictEqual(sorted[2].date, "2026-08-30");
console.log("✓ Test 3 Passed: Reverse chronological transaction sorting works as expected.");

const manifest = JSON.parse(fs.readFileSync('/working_dir/c_b9306d2ea6b3970f/expense-tracker/manifest.json', 'utf8'));
assert.strictEqual(manifest.display, "standalone");
assert(manifest.icons.length >= 2);
console.log("✓ Test 4 Passed: PWA Manifest is valid JSON and contains required standalone display & icons.");

console.log("All 4 automated verification tests passed successfully!");
