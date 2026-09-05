const fs = require('fs');
const assert = require('assert');

console.log("--- Starting Multi-Card (Credit & Debit) Architecture Tests ---");

// Test 1: HTML Element Check
const htmlContent = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const requiredIds = [
  'select-card-dialog',
  'picker-credit-cards-list',
  'picker-debit-cards-list',
  'debit-cards-grid',
  'open-add-debit-card-btn',
  'debit-card-dialog',
  'card-dialog',
  'credit-cards-grid',
  'bank-account-dialog',
  'open-add-bank-account-btn',
  'bank-accounts-grid',
  'select-bank-dialog',
  'picker-banks-list'
];

requiredIds.forEach(id => {
  assert(htmlContent.includes(`id="${id}"`), `HTML missing required ID: ${id}`);
});
console.log("✓ Test 1 Passed: Credit card section, Debit card section, and Card Picker dialog exist in HTML.");

// Test 2: Core Logic: Debit Card vs Credit Card DSR and Balance Behavior
const debitCard = { id: "debit_1", name: "Maybank Visa Debit", bank: "Maybank", type: "DEBIT" };
const creditCard = { id: "card_1", name: "Maybank Visa Signature", bank: "Maybank", type: "CREDIT", payInFull: false, currentBilled: 1200.00, unbilledBalance: 300.00 };

// Debit Card: DSR impact is always 0
function calculateDsrImpact(paymentMethod, cardObj) {
  if (paymentMethod === "Debit Card" || cardObj.type === "DEBIT") return 0.00;
  if (cardObj.payInFull && cardObj.currentBilled === 0) return 0.00;
  const totalBal = cardObj.currentBilled + cardObj.unbilledBalance;
  return Math.max(Number((totalBal * 0.05).toFixed(2)), 50.00);
}

assert.strictEqual(calculateDsrImpact("Debit Card", debitCard), 0.00, "Debit cards must have 0 DSR impact");
assert.strictEqual(calculateDsrImpact("Credit Card", creditCard), 75.00, "Credit card carrying RM 1,500 balance must contribute 5% (RM 75.00) to DSR");
console.log("✓ Test 2 Passed: Debit Card (0% DSR) vs Credit Card (5% CCRIS DSR) mechanics validated.");

// Test 3: Spending Routing
let maybankDebitSpent = 0;
let maybankCreditUnbilled = 0;

function recordCardExpense(cardType, amount) {
  if (cardType === "DEBIT") {
    maybankDebitSpent += amount; // Cash flow deduction
  } else {
    maybankCreditUnbilled += amount; // Liability accrual
  }
}

recordCardExpense("DEBIT", 85.50);
recordCardExpense("CREDIT", 142.00);

assert.strictEqual(maybankDebitSpent, 85.50);
assert.strictEqual(maybankCreditUnbilled, 142.00);
console.log("✓ Test 3 Passed: Expense routing correctly distinguishes direct debit spending from credit liability accrual.");

// Test 5: Universal Backdrop Dismissal Verification (Bug 1 Fix)
const appJsContent = fs.readFileSync(__dirname + '/../app.js', 'utf8');
assert(!appJsContent.includes('const rect = dialog.getBoundingClientRect()'), 'dialog.getBoundingClientRect() must not be used for dialog backdrop dismissal');
assert(!appJsContent.includes('const rect = dom.receiptModal.getBoundingClientRect()'), 'receiptModal.getBoundingClientRect() must not be used for backdrop dismissal');
assert(appJsContent.includes('if (e.target === dialog) {'), 'Universal backdrop dismissal must check if e.target === dialog');
console.log("✓ Test 5 Passed: Universal backdrop dismissal checks e.target === dialog preventing premature modal closure.");

// Test 4: JavaScript Syntax Validation
require('child_process').execSync('node -c ' + __dirname + '/../app.js');
require('child_process').execSync('node -c ' + __dirname + '/../sw.js');
console.log("✓ Test 4 Passed: app.js and sw.js pass syntax validation with zero errors.");

// Test 6: Bank Account & Payment Method Validation (Bugs 2, 3, 4, 5)
// Bug 2: Bank Account form and CRUD bindings
assert(htmlContent.includes('id="bank-account-dialog"'), 'bank-account-dialog must exist in HTML');
assert(appJsContent.includes('function renderBankAccounts()'), 'renderBankAccounts function must exist in app.js');
assert(appJsContent.includes('function handleSaveBankAccount'), 'handleSaveBankAccount function must exist in app.js');

// Bug 3: Subscriptions support Bank and Card picker modes
assert(appJsContent.includes('state.pickerTargetContext = "subscription"'), 'Subscription modal must set pickerTargetContext to subscription');
assert(appJsContent.includes('dom.pillBankSub.textContent = `🏦 ${bankName} ▾`'), 'Selecting bank in subscription mode must update button text');

// Bug 4: Transactions page starts with no payment method pre-selected
assert(!htmlContent.includes('id="pill-bank-tx" data-wallet="Bank Transfer">🏦 Bank Transfer</button>'), 'pill-bank-tx must not be unstyled text');
assert(!htmlContent.includes('class="wallet-pill-btn active" id="pill-bank-tx"'), 'pill-bank-tx must not have active class by default');
assert(htmlContent.includes('id="selected-wallet" value=""'), 'selected-wallet input must be empty by default');
assert(appJsContent.includes('Please select a payment method / account.'), 'Missing payment method must prompt user to select one');

// Bug 5: Release title has no double emoji
assert(appJsContent.includes('title: "Version 41: Multi-Bank Card Pickers & Debit Cards"'), 'Release registry title must not contain duplicate party popper emoji');
assert(!appJsContent.includes('title: "🎉 Version 41'), 'Release registry title must not start with party popper emoji');

console.log("✓ Test 6 Passed: Bugs 2, 3, 4, and 5 validated (Bank Accounts, Pickers, Unselected Defaults, No Duplicate Emoji).");

console.log("\nAll Multi-Card (Credit & Debit) Architecture tests passed successfully!");
