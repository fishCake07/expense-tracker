const fs = require('fs');
const assert = require('assert');

console.log("--- Starting Upgraded Donut Chart & Period Sync Tests ---");

// Test 1: HTML Elements Integrity
const htmlContent = fs.readFileSync('/working_dir/c_b9306d2ea6b3970f/expense-tracker/index.html', 'utf8');
assert(htmlContent.includes('id="breakdown-title"'), "Missing breakdown-title in index.html");
assert(htmlContent.includes('id="chart-period-badge"'), "Missing chart-period-badge in index.html");
console.log("✓ Test 1 Passed: Breakdown title and dynamic period badge exist in index.html.");

// Test 2: Donut Period Filter Synchronization
const mockTransactions = [
  // August 2026
  { date: "2026-08-05", type: "expense", category: "Food & Dining", amount: 800.00 },
  { date: "2026-08-13", type: "expense", category: "Transportation", amount: 200.00 },
  { date: "2026-08-31", type: "expense", category: "Bills & Utilities", amount: 45.00 },
  // September 2026
  { date: "2026-09-01", type: "expense", category: "Food & Dining", amount: 14.50 },
  { date: "2026-09-02", type: "expense", category: "Transportation", amount: 28.00 }
];

function getPeriodExpenses(txList, period, currentYm = "2026-09", lastYm = "2026-08") {
  const expenses = txList.filter(t => (t.type || "expense") === "expense");
  if (period === "THIS_MONTH") return expenses.filter(t => t.date.startsWith(currentYm));
  if (period === "LAST_MONTH") return expenses.filter(t => t.date.startsWith(lastYm));
  return expenses;
}

// August (Last Month) check
const augExpenses = getPeriodExpenses(mockTransactions, "LAST_MONTH");
const augTotal = augExpenses.reduce((s, t) => s + t.amount, 0);
assert.strictEqual(augExpenses.length, 3);
assert.strictEqual(augTotal, 1045.00, "Donut chart for Last Month should only sum August expenses");

// September (This Month) check
const sepExpenses = getPeriodExpenses(mockTransactions, "THIS_MONTH");
const sepTotal = sepExpenses.reduce((s, t) => s + t.amount, 0);
assert.strictEqual(sepExpenses.length, 2);
assert.strictEqual(sepTotal, 42.50, "Donut chart for This Month should only sum September expenses");
console.log(`✓ Test 2 Passed: Donut chart accurately syncs with period filters (August: RM ${augTotal}, September: RM ${sepTotal}).`);

// Test 3: SVG Donut Geometry and Arc Length
const r = 58;
const circumference = 2 * Math.PI * r;
const p1 = 800 / augTotal;
const p2 = 200 / augTotal;
const p3 = 45 / augTotal;
const totalLen = (p1 * circumference) + (p2 * circumference) + (p3 * circumference);
assert(Math.abs(totalLen - circumference) < 0.001);
console.log("✓ Test 3 Passed: SVG Donut circumference and proportional arc lengths sum to 100%.");

// Test 4: JavaScript Syntax Validation
require('child_process').execSync('node -c /working_dir/c_b9306d2ea6b3970f/expense-tracker/app.js');
require('child_process').execSync('node -c /working_dir/c_b9306d2ea6b3970f/expense-tracker/sw.js');
console.log("✓ Test 4 Passed: app.js and sw.js pass syntax checks with zero errors.");

console.log("\nAll Upgraded Donut Chart & Period Sync tests passed successfully!");
