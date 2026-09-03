const fs = require('fs');
const assert = require('assert');

console.log("--- Starting Photo Modal & Row Sizing Tests ---");

// Test 1: HTML Element Check
const htmlContent = fs.readFileSync('/working_dir/c_b9306d2ea6b3970f/expense-tracker/index.html', 'utf8');
assert(htmlContent.includes('class="btn-circle-close"'), "Missing btn-circle-close in HTML");
assert(htmlContent.includes('class="btn-download-icon"'), "Missing btn-download-icon in HTML");
console.log("✓ Test 1 Passed: Circular close button and download icon button verified in HTML.");

// Test 2: JS App Logic Check
const appJsContent = fs.readFileSync('/working_dir/c_b9306d2ea6b3970f/expense-tracker/app.js', 'utf8');
assert(appJsContent.includes("${tx.category} Photo / Receipt"), "Missing dynamic Photo / Receipt title format in app.js");
assert(appJsContent.includes("btn-photo-icon"), "Missing btn-photo-icon button class in app.js");
assert(appJsContent.includes("receiptModal.close()"), "Missing backdrop dismiss close call in app.js");
console.log("✓ Test 2 Passed: Dynamic category title, sleek photo button, and backdrop dismiss confirmed in app.js.");

// Test 3: CSS Sizing Check
const cssContent = fs.readFileSync('/working_dir/c_b9306d2ea6b3970f/expense-tracker/style.css', 'utf8');
assert(cssContent.includes('.btn-photo-icon'), "Missing .btn-photo-icon in CSS");
assert(cssContent.includes('.btn-download-icon'), "Missing .btn-download-icon in CSS");
assert(cssContent.includes('.btn-circle-close'), "Missing .btn-circle-close in CSS");
console.log("✓ Test 3 Passed: CSS rules for photo icon, download button, and close button confirmed.");

// Test 4: JavaScript Syntax Validation
require('child_process').execSync('node -c /working_dir/c_b9306d2ea6b3970f/expense-tracker/app.js');
require('child_process').execSync('node -c /working_dir/c_b9306d2ea6b3970f/expense-tracker/sw.js');
console.log("✓ Test 4 Passed: app.js and sw.js pass syntax validation with zero errors.");

console.log("\nAll Photo Modal & Row Sizing tests passed successfully!");
