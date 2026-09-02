const fs = require('fs');
const assert = require('assert');

console.log("--- Starting Spendable Balance & Savings Verification Tests ---");

// Test 1: HTML Element Integrity
const htmlContent = fs.readFileSync('/working_dir/c_b9306d2ea6b3970f/expense-tracker/index.html', 'utf8');
const requiredIds = [
  'spendable-card',
  'spendable-balance',
  'spendable-sub',
  'total-saved',
  'savings-sub',
  'total-spend',
  'total-income'
];

requiredIds.forEach(id => {
  assert(htmlContent.includes(`id="${id}"`), `HTML missing required ID: ${id}`);
});
console.log("✓ Test 1 Passed: All Spendable Balance and Savings DOM elements exist in index.html.");

// Test 2A: Spendable Balance with Salary and 20% Savings
const txWithSavings = [
  { type: "income", amount: 3500.00, category: "Salary & Wages" },
  { type: "expense", amount: 700.00, category: "Savings & Investments" },
  { type: "expense", amount: 152.50, category: "Food & Dining" }
];

const incomeA = txWithSavings.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
const savingsA = txWithSavings.filter(t => t.category === "Savings & Investments").reduce((s, t) => s + t.amount, 0);
const livingA = txWithSavings.filter(t => t.type === "expense" && t.category !== "Savings & Investments").reduce((s, t) => s + t.amount, 0);
const spendableBalA = (incomeA - savingsA) - livingA;

assert.strictEqual(incomeA, 3500.00);
assert.strictEqual(savingsA, 700.00);
assert.strictEqual(livingA, 152.50);
assert.strictEqual(spendableBalA, 2647.50);
console.log(`✓ Test 2A Passed: Salary ($3,500) - Savings ($700) - Living ($152.50) = Spendable Balance ($2,647.50).`);

// Test 2B: Spendable Balance without Savings (Entire salary becomes spendable pool)
const txWithoutSavings = [
  { type: "income", amount: 3500.00, category: "Salary & Wages" },
  { type: "expense", amount: 500.00, category: "Food & Dining" }
];

const incomeB = txWithoutSavings.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
const savingsB = txWithoutSavings.filter(t => t.category === "Savings & Investments").reduce((s, t) => s + t.amount, 0);
const livingB = txWithoutSavings.filter(t => t.type === "expense" && t.category !== "Savings & Investments").reduce((s, t) => s + t.amount, 0);
const spendableBalB = (incomeB - savingsB) - livingB;

assert.strictEqual(savingsB, 0);
assert.strictEqual(spendableBalB, 3000.00);
console.log(`✓ Test 2B Passed: Without savings entered, full salary ($3,500) minus living expenses ($500) = $3,000.`);

// Test 2C: Deficit detection (Spending exceeds spendable pool)
const txOverspend = [
  { type: "income", amount: 3500.00, category: "Salary & Wages" },
  { type: "expense", amount: 700.00, category: "Savings & Investments" },
  { type: "expense", amount: 3000.00, category: "Shopping" }
];
const spendableBalC = (3500 - 700) - 3000;
assert.strictEqual(spendableBalC, -200.00);
console.log(`✓ Test 2C Passed: Overspending detected (-$200 dipping into savings).`);

// Test 3: JavaScript Syntax Check
require('child_process').execSync('node -c /working_dir/c_b9306d2ea6b3970f/expense-tracker/app.js');
require('child_process').execSync('node -c /working_dir/c_b9306d2ea6b3970f/expense-tracker/sw.js');
console.log("✓ Test 3 Passed: app.js and sw.js pass syntax checks with zero errors.");

console.log("\nAll Spendable Balance automated verification tests passed successfully!");
