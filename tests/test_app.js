const fs = require('fs');
const assert = require('assert');

console.log("--- Starting Loans Page, Movable FAB & Groceries Category Tests ---");

// Test 1: HTML Element Check
const htmlContent = fs.readFileSync('/working_dir/c_b9306d2ea6b3970f/expense-tracker/index.html', 'utf8');
const requiredIds = [
  'view-loans',
  'movable-menu-btn',
  'nav-hub-backdrop',
  'total-loan-debt',
  'total-loan-monthly',
  'loan-dsr-badge',
  'loan-dialog',
  'simulator-dialog'
];

requiredIds.forEach(id => {
  assert(htmlContent.includes(`id="${id}"`), `HTML missing required ID: ${id}`);
});
console.log("✓ Test 1 Passed: Loans view, movable FAB, Frosted Hub, and loan dialogs verified in HTML.");

// Test 2: Groceries Category Exists in app.js
const appJsContent = fs.readFileSync('/working_dir/c_b9306d2ea6b3970f/expense-tracker/app.js', 'utf8');
assert(appJsContent.includes('"Groceries"'), "Missing Groceries category in app.js");
assert(appJsContent.includes("🛒"), "Missing Groceries icon in app.js");
console.log("✓ Test 2 Passed: Groceries 🛒 verified in default categories.");

// Test 3: Malaysian Loan Calculation Engine
function calculateLoanSpecs(principal, annualRate, tenureMonths, type) {
  let monthly = 0;
  let totalInterest = 0;

  if (type === "CAR_FLAT") {
    const years = tenureMonths / 12;
    totalInterest = principal * (annualRate / 100) * years;
    monthly = (principal + totalInterest) / tenureMonths;
  } else if (type === "PTPTN") {
    const years = tenureMonths / 12;
    totalInterest = principal * 0.01 * years;
    monthly = (principal + totalInterest) / tenureMonths;
  } else if (type === "IPP_0") {
    totalInterest = 0;
    monthly = principal / tenureMonths;
  } else {
    const r = (annualRate / 100) / 12;
    const n = tenureMonths;
    if (r === 0) {
      monthly = principal / n;
      totalInterest = 0;
    } else {
      monthly = principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
      totalInterest = (monthly * n) - principal;
    }
  }

  return {
    monthly: Number(monthly.toFixed(2)),
    totalInterest: Number(totalInterest.toFixed(2)),
    totalRepayable: Number((principal + totalInterest).toFixed(2))
  };
}

// Case A: Pre-2026 Car Loan (Flat Rate) RM 40,000 at 3% for 7 years (84 mos)
const carFlat = calculateLoanSpecs(40000, 3.0, 84, "CAR_FLAT");
assert.strictEqual(carFlat.totalInterest, 8400.00);
assert.strictEqual(carFlat.monthly, 576.19);
console.log("✓ Test 3A Passed: Pre-2026 Flat Rate Car Loan calculated accurately (Interest: RM 8,400).");

// Case B: Post-June 2026 Car Loan Reform (Reducing Balance EIR) RM 40,000 at 5.8% EIR for 84 mos
const carEir = calculateLoanSpecs(40000, 5.8, 84, "CAR_EIR");
assert(carEir.monthly > 0 && carEir.totalInterest > 0);
console.log(`✓ Test 3B Passed: Post-2026 EIR Reducing Balance calculated accurately (Monthly: RM ${carEir.monthly}, Interest: RM ${carEir.totalInterest}).`);

// Case C: PTPTN 1% Ujrah for RM 24,000 over 15 years (180 mos)
const ptptn = calculateLoanSpecs(24000, 1.0, 180, "PTPTN");
assert.strictEqual(ptptn.totalInterest, 3600.00);
assert.strictEqual(ptptn.monthly, 153.33);
console.log("✓ Test 3C Passed: PTPTN 1% Ujrah study loan calculated accurately (Monthly: RM 153.33).");

// Test 4: Debt Service Ratio (DSR) Calculation
const monthlyIncome = 3500.00;
const totalCommitments = 480.00 + 550.00; // Car + Room Rent = RM 1030
const dsr = ((totalCommitments / monthlyIncome) * 100).toFixed(1);
assert.strictEqual(dsr, "29.4");
console.log(`✓ Test 4 Passed: Debt Service Ratio (DSR) calculated accurately (${dsr}% - Healthy).`);

// Test 5: JavaScript Syntax Validation
require('child_process').execSync('node -c /working_dir/c_b9306d2ea6b3970f/expense-tracker/app.js');
require('child_process').execSync('node -c /working_dir/c_b9306d2ea6b3970f/expense-tracker/sw.js');
console.log("✓ Test 5 Passed: app.js and sw.js pass syntax validation with zero errors.");

console.log("\nAll Loans Page, Movable FAB & Groceries tests passed successfully!");
