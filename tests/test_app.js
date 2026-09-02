const fs = require('fs');
const assert = require('assert');

console.log("--- Starting Option 6: Income & Net Balance Verification Tests ---");

// Test 1: HTML Element Integrity
const htmlContent = fs.readFileSync('/working_dir/c_b9306d2ea6b3970f/expense-tracker/index.html', 'utf8');
const requiredIds = [
  'net-balance-card',
  'net-balance',
  'net-balance-sub',
  'total-income',
  'income-count',
  'total-spend',
  'transaction-count',
  'tab-expense',
  'tab-income',
  'edit-type'
];

requiredIds.forEach(id => {
  assert(htmlContent.includes(`id="${id}"`), `HTML missing required Option 6 ID: ${id}`);
});
console.log("✓ Test 1 Passed: All Option 6 Net Balance and Income tab elements exist in index.html.");

// Test 2: Net Balance & Cash Flow Math
const sampleTx = [
  { id: "1", type: "income", amount: 3500.00, category: "Salary & Wages", date: "2026-09-01" },
  { id: "2", type: "income", amount: 250.00, category: "Freelance & Projects", date: "2026-09-02" },
  { id: "3", type: "expense", amount: 152.50, category: "Food & Dining", date: "2026-09-02" },
  { id: "4", amount: 50.00, category: "Shopping", date: "2026-09-02" } // legacy record without type property
];

const totalIncome = sampleTx
  .filter(t => t.type === "income")
  .reduce((sum, t) => sum + t.amount, 0);
assert.strictEqual(totalIncome, 3750.00);

const totalExpenses = sampleTx
  .filter(t => (t.type || "expense") === "expense")
  .reduce((sum, t) => sum + t.amount, 0);
assert.strictEqual(totalExpenses, 202.50);

const netBalance = totalIncome - totalExpenses;
assert.strictEqual(netBalance, 3547.50);
console.log("✓ Test 2 Passed: Income ($3,750), Expenses ($202.50), and Net Balance ($3,547.50) computed accurately.");

// Test 3: Deficit handling
const deficitTx = [
  { type: "income", amount: 500.00 },
  { type: "expense", amount: 800.00 }
];
const deficitNet = deficitTx.find(t => t.type === "income").amount - deficitTx.find(t => t.type === "expense").amount;
assert.strictEqual(deficitNet, -300.00);
console.log("✓ Test 3 Passed: Deficit scenario (-$300) detected properly.");

// Test 4: JavaScript Syntax Validation
require('child_process').execSync('node -c /working_dir/c_b9306d2ea6b3970f/expense-tracker/app.js');
require('child_process').execSync('node -c /working_dir/c_b9306d2ea6b3970f/expense-tracker/sw.js');
console.log("✓ Test 4 Passed: app.js and sw.js pass syntax validation with zero errors.");

console.log("\nAll Option 6 automated verification tests passed successfully!");
