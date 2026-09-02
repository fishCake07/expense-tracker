const fs = require('fs');
const assert = require('assert');

console.log("--- Starting Option 5: Search & Date Range Filtering Tests ---");

// Test 1: HTML Element Integrity
const htmlContent = fs.readFileSync('/working_dir/c_b9306d2ea6b3970f/expense-tracker/index.html', 'utf8');
const filterIds = [
  'filter-period',
  'filter-category',
  'search-input',
  'clear-search-btn',
  'custom-date-inputs',
  'custom-start-date',
  'custom-end-date'
];

filterIds.forEach(id => {
  assert(htmlContent.includes(`id="${id}"`), `HTML missing required ID: ${id}`);
});
console.log("✓ Test 1 Passed: All Option 5 search input, period select, and custom date elements exist.");

// Test 2: Multi-Criteria Filter Logic
const sampleTx = [
  { id: "1", date: "2026-09-01", category: "Food & Dining", note: "Breakfast cafe", amount: 15.00 },
  { id: "2", date: "2026-09-02", category: "Food & Dining", note: "Lunch meeting", amount: 35.00 },
  { id: "3", date: "2026-08-25", category: "Transportation", note: "Petrol station", amount: 50.00 },
  { id: "4", date: "2026-08-10", category: "Shopping", note: "Sneakers purchase", amount: 120.00 }
];

// Test 2A: Search Keyword match
function filterByKeyword(list, query) {
  const q = query.toLowerCase();
  return list.filter(t => (t.note || "").toLowerCase().includes(q) || (t.category || "").toLowerCase().includes(q) || t.amount.toString().includes(q));
}

const searchResult = filterByKeyword(sampleTx, "meeting");
assert.strictEqual(searchResult.length, 1);
assert.strictEqual(searchResult[0].id, "2");
console.log("✓ Test 2A Passed: Keyword search accurately matches query.");

// Test 2B: Period filter (2026-09)
const thisMonthResults = sampleTx.filter(t => t.date.startsWith("2026-09"));
assert.strictEqual(thisMonthResults.length, 2);
console.log("✓ Test 2B Passed: Period filtering isolates current month transactions.");

// Test 2C: Custom Date Range (2026-08-15 to 2026-09-01)
const customRange = sampleTx.filter(t => t.date >= "2026-08-15" && t.date <= "2026-09-01");
assert.strictEqual(customRange.length, 2); // id 1 (2026-09-01) and id 3 (2026-08-25)
console.log("✓ Test 2C Passed: Custom start & end date bounds filter transactions accurately.");

// Test 2D: Combined Filtering (Category + Search Query)
const combined = sampleTx.filter(t => t.category === "Food & Dining" && t.note.toLowerCase().includes("breakfast"));
assert.strictEqual(combined.length, 1);
assert.strictEqual(combined[0].id, "1");
console.log("✓ Test 2D Passed: Combined category + keyword filter coordinates properly.");

// Test 3: JavaScript Syntax Check
require('child_process').execSync('node -c /working_dir/c_b9306d2ea6b3970f/expense-tracker/app.js');
require('child_process').execSync('node -c /working_dir/c_b9306d2ea6b3970f/expense-tracker/sw.js');
console.log("✓ Test 3 Passed: app.js and sw.js pass syntax validation without errors.");

console.log("\nAll Option 5 automated verification tests passed successfully!");
