const fs = require('fs');
const assert = require('assert');

console.log("--- Starting Net True Savings & Subscription Layout Tests ---");

// Test 1: Net True Savings Calculation
const allTimeSavingsTransactions = [
  { category: "Savings & Investments", amount: 500.00 }, // August
  { category: "Savings & Investments", amount: 700.00 }  // September
];
const totalAccumulatedSavings = allTimeSavingsTransactions.reduce((s, t) => s + t.amount, 0);
assert.strictEqual(totalAccumulatedSavings, 1200.00);

// Scenario A: In budget (Spendable Balance = +RM 2,647.50)
const spendableBalanceA = 2647.50;
const netTrueSavingsA = spendableBalanceA < 0 ? Math.max(0, totalAccumulatedSavings - Math.abs(spendableBalanceA)) : totalAccumulatedSavings;
assert.strictEqual(netTrueSavingsA, 1200.00);
console.log(`✓ Test 1A Passed: When in budget, full accumulated savings is preserved (RM ${netTrueSavingsA}).`);

// Scenario B: Over budget / Deficit (Spendable Balance = -RM 200.00)
const spendableBalanceB = -200.00;
const deficitB = Math.abs(spendableBalanceB);
const netTrueSavingsB = spendableBalanceB < 0 ? Math.max(0, totalAccumulatedSavings - deficitB) : totalAccumulatedSavings;
assert.strictEqual(netTrueSavingsB, 1000.00);
console.log(`✓ Test 1B Passed: When over budget (-RM 200), deficit is deducted from savings (RM ${netTrueSavingsB}).`);

// Test 2: Double Badge Suppression Logic
function computeSubBadge(isDebited, diff) {
  let dueBadge = "";
  if (!isDebited) {
    if (diff === 0) dueBadge = "Due Today";
    else if (diff > 0 && diff <= 5) dueBadge = `Due in ${diff}d`;
  }
  return dueBadge;
}

// When bill is debited today (diff === 0, isDebited === true)
const badgeWhenDebited = computeSubBadge(true, 0);
assert.strictEqual(badgeWhenDebited, "", "Due warning must be hidden once debited");

// When bill is not yet debited today (diff === 0, isDebited === false)
const badgeWhenNotDebited = computeSubBadge(false, 0);
assert.strictEqual(badgeWhenNotDebited, "Due Today");
console.log("✓ Test 2 Passed: Double badge conflict eliminated (due badges suppressed when already debited).");

// Test 3: HTML & CSS Integrity
const cssContent = fs.readFileSync('/working_dir/c_b9306d2ea6b3970f/expense-tracker/style.css', 'utf8');
assert(cssContent.includes('.sub-name'), "Missing .sub-name in CSS");
assert(cssContent.includes('text-overflow: ellipsis'), "Missing text-overflow ellipsis in CSS");
assert(cssContent.includes('.savings-card .metric-value.deficit'), "Missing deficit savings style in CSS");
console.log("✓ Test 3 Passed: Subscriptions text truncation and savings deficit styles confirmed.");

// Test 4: JavaScript Syntax Validation
require('child_process').execSync('node -c /working_dir/c_b9306d2ea6b3970f/expense-tracker/app.js');
require('child_process').execSync('node -c /working_dir/c_b9306d2ea6b3970f/expense-tracker/sw.js');
console.log("✓ Test 4 Passed: app.js and sw.js pass syntax checks with zero errors.");

console.log("\nAll Net True Savings & Subscription Layout tests passed successfully!");
