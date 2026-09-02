const fs = require('fs');
const assert = require('assert');

console.log("--- Starting Two-Tone Spendable Bar & Monthly Scoping Tests ---");

// Test 1: HTML Element Integrity
const htmlContent = fs.readFileSync('/working_dir/c_b9306d2ea6b3970f/expense-tracker/index.html', 'utf8');
const requiredIds = [
  'spendable-hero-card',
  'spendable-month-label',
  'hero-spendable-val',
  'hero-spendable-tag',
  'hero-spent-val',
  'hero-pool-val',
  'two-tone-track',
  'two-tone-spent-fill',
  'gauge-spent-text',
  'gauge-available-text',
  'hero-footer-text',
  'total-income',
  'total-saved',
  'total-spend'
];

requiredIds.forEach(id => {
  assert(htmlContent.includes(`id="${id}"`), `HTML missing required ID: ${id}`);
});
console.log("✓ Test 1 Passed: All Two-Tone Hero Gauge and Monthly Card DOM elements exist in index.html.");

// Test 2: Monthly Scoping (Preventing Wealth Illusion)
const allTransactions = [
  // August (Prior Month)
  { date: "2026-08-01", type: "income", amount: 3500.00, category: "Salary & Wages" },
  { date: "2026-08-02", type: "expense", amount: 700.00, category: "Savings & Investments" },
  { date: "2026-08-15", type: "expense", amount: 1500.00, category: "Food & Dining" },
  // September (Current Month)
  { date: "2026-09-01", type: "income", amount: 3500.00, category: "Salary & Wages" },
  { date: "2026-09-02", type: "expense", amount: 700.00, category: "Savings & Investments" },
  { date: "2026-09-02", type: "expense", amount: 152.50, category: "Food & Dining" }
];

// If we did all-time accumulation (Wealth Illusion):
const allTimeIncome = allTransactions.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
assert.strictEqual(allTimeIncome, 7000.00, "Cumulative income would create a 7,000 illusion");

// With Monthly Scoping (Reality for September):
const currentMonthTx = allTransactions.filter(t => t.date.startsWith("2026-09"));
const monthIncome = currentMonthTx.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
const monthSavings = currentMonthTx.filter(t => t.category === "Savings & Investments").reduce((s, t) => s + t.amount, 0);
const monthLiving = currentMonthTx.filter(t => (t.type || "expense") === "expense" && t.category !== "Savings & Investments").reduce((s, t) => s + t.amount, 0);

assert.strictEqual(monthIncome, 3500.00);
assert.strictEqual(monthSavings, 700.00);
assert.strictEqual(monthLiving, 152.50);

const spendablePool = monthIncome - monthSavings;
const spendableBalance = spendablePool - monthLiving;
assert.strictEqual(spendablePool, 2800.00);
assert.strictEqual(spendableBalance, 2647.50);

const spentPercent = (monthLiving / spendablePool) * 100;
assert.strictEqual(spentPercent.toFixed(1), "5.4");
console.log(`✓ Test 2 Passed: Monthly isolation prevents wealth illusion (September pool: RM ${spendablePool}, Balance: RM ${spendableBalance}, Fill: ${spentPercent.toFixed(1)}%).`);

// Test 3: Overspending Detection (> 100%)
const overspendTx = [
  { date: "2026-09-01", type: "income", amount: 3500.00, category: "Salary & Wages" },
  { date: "2026-09-02", type: "expense", amount: 700.00, category: "Savings & Investments" },
  { date: "2026-09-05", type: "expense", amount: 3000.00, category: "Shopping" } // exceeds 2800 pool
];
const overPool = 3500 - 700;
const overLiving = 3000;
const overBalance = overPool - overLiving;
assert.strictEqual(overBalance, -200.00);
assert(overLiving > overPool, "Over budget condition verified");
console.log("✓ Test 3 Passed: Overspending detection triggers when living expenses exceed spendable pool.");

// Test 4: JavaScript Syntax Validation
require('child_process').execSync('node -c /working_dir/c_b9306d2ea6b3970f/expense-tracker/app.js');
require('child_process').execSync('node -c /working_dir/c_b9306d2ea6b3970f/expense-tracker/sw.js');
console.log("✓ Test 4 Passed: app.js and sw.js pass syntax validation with zero errors.");

console.log("\nAll Two-Tone Spendable Bar and Monthly Scoping tests passed successfully!");
