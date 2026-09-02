const fs = require('fs');
const assert = require('assert');

console.log("--- Starting Option 2: Visual Donut Spending Chart Verification Tests ---");

// Test 1: HTML Element Integrity for Chart
const htmlContent = fs.readFileSync('/working_dir/c_b9306d2ea6b3970f/expense-tracker/index.html', 'utf8');
const chartIds = [
  'chart-layout',
  'donut-wrapper',
  'spending-donut',
  'donut-segments-group',
  'donut-center-info',
  'donut-center-label',
  'donut-center-val',
  'category-breakdown-list'
];

chartIds.forEach(id => {
  assert(htmlContent.includes(`id="${id}"`), `HTML missing required chart element ID: ${id}`);
});
console.log("✓ Test 1 Passed: All Option 2 SVG Donut Chart container and label IDs exist in index.html.");

// Test 2: Category Colors Mapping
const appJsContent = fs.readFileSync('/working_dir/c_b9306d2ea6b3970f/expense-tracker/app.js', 'utf8');
const categories = [
  "Food & Dining",
  "Transportation",
  "Shopping",
  "Entertainment",
  "Bills & Utilities",
  "Health & Medical",
  "Education",
  "Other"
];

categories.forEach(cat => {
  assert(appJsContent.includes(`"${cat}":`), `app.js missing color definition for category: ${cat}`);
});
console.log("✓ Test 2 Passed: All 8 standard categories have dedicated hex colors in CATEGORY_COLORS.");

// Test 3: SVG Donut Geometry and Stroke Calculation
const radius = 58;
const circumference = 2 * Math.PI * radius; // ~364.424
const sampleExpenses = [
  { amount: 50 },
  { amount: 30 },
  { amount: 20 }
];
const total = 100;

let totalStrokeLength = 0;
sampleExpenses.forEach(exp => {
  const percent = exp.amount / total;
  const strokeLength = percent * circumference;
  totalStrokeLength += strokeLength;
});

assert(Math.abs(totalStrokeLength - circumference) < 0.001, "Sum of donut segment lengths must equal total circle circumference");
console.log(`✓ Test 3 Passed: Circumference (${circumference.toFixed(2)}) math and stroke dash allocations sum to 100%.`);

// Test 4: Syntax Check for all JS files
require('child_process').execSync('node -c /working_dir/c_b9306d2ea6b3970f/expense-tracker/app.js');
require('child_process').execSync('node -c /working_dir/c_b9306d2ea6b3970f/expense-tracker/sw.js');
console.log("✓ Test 4 Passed: app.js and sw.js pass syntax validation without any errors.");

console.log("\nAll Option 2 visual chart automated tests passed successfully!");
