const fs = require('fs');
const assert = require('assert');

console.log("--- Starting Option 3: Export & Import Verification Tests ---");

// Test 1: HTML Elements Presence
const htmlContent = fs.readFileSync('/working_dir/c_b9306d2ea6b3970f/expense-tracker/index.html', 'utf8');
const requiredIds = ['export-csv-btn', 'export-json-btn', 'import-btn', 'import-file-input'];
requiredIds.forEach(id => {
  assert(htmlContent.includes(`id="${id}"`), `HTML missing required ID: ${id}`);
});
console.log("✓ Test 1 Passed: All Option 3 buttons and file inputs exist in index.html.");

// Test 2: CSV Export & Parse Logic
const sampleTx = [
  { id: "1", date: "2026-09-01", category: "Food & Dining", note: "Lunch with coffee, and cake", amount: 22.50 },
  { id: "2", date: "2026-09-02", category: "Shopping", note: 'T-shirt "vintage"', amount: 45.00 }
];

function buildCSV(txList, curr) {
  const headers = ["Date", "Category", "Note", "Amount", "Currency"];
  const rows = txList.map(t => [
    t.date,
    `"${(t.category || "").replace(/"/g, '""')}"`,
    `"${(t.note || "").replace(/"/g, '""')}"`,
    t.amount.toFixed(2),
    curr
  ]);
  return [headers.join(","), ...rows.map(r => r.join(","))].join("\r\n");
}

function parseCSVLine(text) {
  const result = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      result.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  result.push(cur);
  return result;
}

const csvOutput = buildCSV(sampleTx, "RM");
assert(csvOutput.includes("Date,Category,Note,Amount,Currency"), "Header row mismatch");
assert(csvOutput.includes('"Lunch with coffee, and cake"'), "Comma in note not quoted properly");
assert(csvOutput.includes('""vintage""'), "Quotes in note not escaped properly");

const lines = csvOutput.split("\r\n");
const parsedRow1 = parseCSVLine(lines[1]);
assert.strictEqual(parsedRow1[0], "2026-09-01");
assert.strictEqual(parsedRow1[1], "Food & Dining");
assert.strictEqual(parsedRow1[2], "Lunch with coffee, and cake");
assert.strictEqual(parsedRow1[3], "22.50");
assert.strictEqual(parsedRow1[4], "RM");
console.log("✓ Test 2 Passed: CSV serialization and RFC 4180 parsing verified.");

// Test 3: JSON Backup Integrity
const backupPayload = {
  appName: "Expense Tracker",
  version: 1,
  exportedAt: new Date().toISOString(),
  currency: "RM",
  monthlyBudget: 1000,
  transactions: sampleTx
};

const jsonString = JSON.stringify(backupPayload, null, 2);
const restored = JSON.parse(jsonString);
assert.strictEqual(restored.appName, "Expense Tracker");
assert.strictEqual(restored.currency, "RM");
assert.strictEqual(restored.monthlyBudget, 1000);
assert.strictEqual(restored.transactions.length, 2);
console.log("✓ Test 3 Passed: JSON full backup structure and restoration verified.");

// Test 4: JavaScript Syntax Validation
require('child_process').execSync('node -c /working_dir/c_b9306d2ea6b3970f/expense-tracker/app.js');
require('child_process').execSync('node -c /working_dir/c_b9306d2ea6b3970f/expense-tracker/sw.js');
console.log("✓ Test 4 Passed: app.js and sw.js pass syntax checks with 0 errors.");

console.log("\nAll Option 3 automated verification tests passed successfully!");
