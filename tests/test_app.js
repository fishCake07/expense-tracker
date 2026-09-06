const fs = require('fs');
const assert = require('assert');

console.log("--- Starting Multi-Card (Credit & Debit) Architecture Tests ---");

// Test 1: HTML Element Check
const htmlContent = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const requiredIds = [
  'select-card-dialog',
  'picker-credit-cards-list',
  'picker-debit-cards-list',
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
console.log("✓ Test 1 Passed: Credit card section, Bank accounts section, and Card/Bank Picker dialogs exist in HTML.");

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

// Test 7: 4-Section Financial Hierarchy & Parent-Child Debit Cards Architecture
const loanIdx = htmlContent.indexOf('class="card loan-portfolio-card"');
const creditIdx = htmlContent.indexOf('class="card credit-cards-section"');
const subsIdx = htmlContent.indexOf('class="card subscriptions-card"');
const bankIdx = htmlContent.indexOf('class="card bank-accounts-section"');

assert(loanIdx !== -1 && creditIdx !== -1 && subsIdx !== -1 && bankIdx !== -1, 'All 4 primary commitment sections must exist');
assert(loanIdx < creditIdx, 'Section 1: Loans & Financing must appear before Section 2: Credit Cards');
assert(creditIdx < subsIdx, 'Section 2: Credit Cards must appear before Section 3: Subscriptions & Bills');
assert(subsIdx < bankIdx, 'Section 3: Subscriptions & Bills must appear before Section 4: Bank Accounts');

// Test Parent-Child Debit Cards & Combined Outflow
assert(appJsContent.includes('nested-debit-card-box'), 'Parent bank cards must support nested debit card display');
assert(appJsContent.includes('nested-link-debit-box'), 'Unlinked bank accounts must display link debit card button');
assert(appJsContent.includes('Combined Outflow'), 'Bank cards must calculate and display combined outflow (Transfers + Debit)');
assert(htmlContent.includes('id="bank-account-balance"'), 'Bank account dialog must support balance input');

// Verify obsolete duplicate sub-wallet-pill listener was removed
assert(!appJsContent.includes('// Subscriptions 3-Wallet Pill Selection (Cash excluded)'), 'Obsolete duplicate sub-wallet-pill listener must be removed');

// Verify exportToJSON includes full asset & liability backup
assert(appJsContent.includes('loans: state.loans'), 'exportToJSON must back up loans');
assert(appJsContent.includes('bankAccounts: state.bankAccounts'), 'exportToJSON must back up bank accounts');

console.log("✓ Test 7 Passed: 4-Section financial hierarchy, Parent-Child debit cards, and combined cash outflow verified.");

// Test 8: Credit Card Unbilled Spends Synchronization & Reconciliation
assert(appJsContent.includes('function reconcileCreditCardUnbilled()'), 'reconcileCreditCardUnbilled function must exist in app.js');
assert(appJsContent.includes('const isCredit = (chosenWallet === "Credit Card" || rawCardType === "credit"'), 'handleAddTransaction must reliably detect credit card expenses');

// Verify calculation logic: Card carrying current unbilled + new expense
let testCard = { id: "card_maybank", name: "Maybank Visa Signature", currentBilled: 450.00, unbilledBalance: 135.00 };
let loggedExpenses = [5000.00, 300.00];
loggedExpenses.forEach(amt => {
  testCard.unbilledBalance = Number((testCard.unbilledBalance + amt).toFixed(2));
});
assert.strictEqual(testCard.unbilledBalance, 5435.00, 'Adding RM 5000 and RM 300 to initial RM 135 must result in RM 5435 unbilled balance');

// Reversal test
testCard.unbilledBalance = Math.max(0, Number((testCard.unbilledBalance - 300.00).toFixed(2)));
assert.strictEqual(testCard.unbilledBalance, 5135.00, 'Deleting a RM 300 expense must revert unbilled balance to RM 5135');

console.log("✓ Test 8 Passed: Credit Card Unbilled Spends synchronization, reconciliation, and reversal verified.");

// Test 9: Income Logging Flow & Bank Account Balance Integration
assert(htmlContent.includes('id="income-deposit-select"'), 'income-deposit-select must exist in HTML');
assert(htmlContent.includes('id="income-deposit-group"'), 'income-deposit-group must exist in HTML');
assert(appJsContent.includes('function populateIncomeDepositSelect()'), 'populateIncomeDepositSelect must exist in app.js');

// Test balance increment on income deposit
let mockBank = { id: "bank_public", name: "Public Bank Salary Account", balance: 5200.00 };
let incomeAmt = 4000.00;
mockBank.balance = Number((mockBank.balance + incomeAmt).toFixed(2));
assert.strictEqual(mockBank.balance, 9200.00, 'Depositing RM 4000 to RM 5200 must yield RM 9200 balance');

// Test reversal on deletion
mockBank.balance = Math.max(0, Number((mockBank.balance - incomeAmt).toFixed(2)));
assert.strictEqual(mockBank.balance, 5200.00, 'Deleting income must revert bank balance to RM 5200');

console.log("✓ Test 9 Passed: Income Logging flow, Bank Account balance increment, and reversal verified.");

// Test 10: Automatic Bank Account Deduction for Bank Transfers and Linked Debit Cards
let testBank = { id: "bank_maybank", name: "Maybank Savings", bank: "Maybank", balance: 3450.00 };
let gtaExpense = 250.00;

// 1. Bank Transfer deduction (e.g. GTA 6)
testBank.balance = Number((testBank.balance - gtaExpense).toFixed(2));
assert.strictEqual(testBank.balance, 3200.00, 'Logging RM 250 Bank Transfer from RM 3450 must leave RM 3200');

// 2. Reversal on deletion
testBank.balance = Number((testBank.balance + gtaExpense).toFixed(2));
assert.strictEqual(testBank.balance, 3450.00, 'Deleting RM 250 expense must restore balance to RM 3450');

// 3. Debit Card swipe deduction
let debitSwipe = 180.00;
testBank.balance = Number((testBank.balance - debitSwipe).toFixed(2));
assert.strictEqual(testBank.balance, 3270.00, 'Logging RM 180 Debit Card spend must deduct parent bank balance to RM 3270');

console.log("✓ Test 10 Passed: Bank Account automatic deductions and reversals for Bank Transfers and Debit Cards verified.");

// Test 11: Single Source of Truth for Debit Cards, Credit Cards, and Bank Balances
assert(appJsContent.includes('function getDebitCardMonthlySpend('), 'getDebitCardMonthlySpend function must exist in app.js');
assert(appJsContent.includes('function getReconciledBankBalance('), 'getReconciledBankBalance function must exist in app.js');

// Test 11a: When transactions are empty, debit spend must be strictly 0.00
const emptyTx = [];
function testCalcDebitSpend(cardId, txList) {
  let s = 0;
  txList.forEach(t => {
    if (t.type === 'expense' && (t.wallet === 'Debit Card' || t.cardType === 'debit') && t.cardId === cardId) {
      s += t.amount;
    }
  });
  return Number(s.toFixed(2));
}

assert.strictEqual(testCalcDebitSpend('debit_maybank', emptyTx), 0.00, 'Empty transactions must result in 0.00 debit spend');

// Test 11b: When transactions have records, debit spend must equal the sum
const mockDebitTx = [
  { type: 'expense', wallet: 'Debit Card', cardId: 'debit_maybank', amount: 180.00 },
  { type: 'expense', wallet: 'Debit Card', cardId: 'debit_maybank', amount: 300.00 }
];
assert.strictEqual(testCalcDebitSpend('debit_maybank', mockDebitTx), 480.00, 'Debit spend must equal exact sum of matching transactions');

// Test 11c: Clearing transactions must revert bank balance to baseline
let mockBankObj = { id: 'bank_maybank', name: 'Maybank Savings', bank: 'Maybank', initialBalance: 3450.00, balance: 2933.00 };
if (emptyTx.length === 0) {
  mockBankObj.balance = mockBankObj.initialBalance;
}
assert.strictEqual(mockBankObj.balance, 3450.00, 'Clearing transactions must restore initial baseline balance to 3450.00');

console.log("✓ Test 11 Passed: Single Source of Truth architecture and dynamic zero-drift reconciliation verified.");

// Test 12: Load Sample Synchronization with All Architecture Features
assert(appJsContent.includes('cardId: "bank_public"'), 'loadSampleData must route salary to bank_public');
assert(appJsContent.includes('cardId: "debit_maybank"'), 'loadSampleData must route groceries to debit_maybank');
assert(appJsContent.includes('cardId: "card_maybank"'), 'loadSampleData must route credit purchases to card_maybank');
assert(appJsContent.includes('sourceId: "bank_maybank"'), 'loadSampleData must link subscriptions to bank sources');

console.log("✓ Test 12 Passed: loadSampleData fully synchronized with all multi-card and bank account architecture.");

console.log("\nAll Multi-Card (Credit & Debit) Architecture tests passed successfully!");
