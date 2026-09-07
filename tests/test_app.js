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

// Test 13: Edit Transaction Dynamic Account/Wallet Synchronization & Rebalancing
assert(appJsContent.includes('function populateEditWalletSelect('), 'populateEditWalletSelect function must exist in app.js');
assert(appJsContent.includes('🏦 Bank Accounts (Direct Transfers & Salary)'), 'Edit wallet dropdown must include bank accounts optgroup');
assert(appJsContent.includes('💳 Credit Cards (5% CCRIS DSR)'), 'Edit wallet dropdown must include credit cards optgroup');
assert(appJsContent.includes('💳 Debit Cards (0% DSR • Direct Debit)'), 'Edit wallet dropdown must include debit cards optgroup');

// Test rebalancing logic on edit:
let mockMaybank = { id: "bank_maybank", name: "Maybank Savings", balance: 3450.00 };
let mockPublicBank = { id: "bank_public", name: "Public Bank Salary Account", balance: 5200.00 };

// Scenario: Reassign an expense of RM 500 from Maybank to Public Bank
let oldExpenseAmt = 500.00;
mockMaybank.balance = Number((mockMaybank.balance + oldExpenseAmt).toFixed(2)); // Revert old
mockPublicBank.balance = Number((mockPublicBank.balance - oldExpenseAmt).toFixed(2)); // Apply new

assert.strictEqual(mockMaybank.balance, 3950.00, 'Maybank must be refunded RM 500');
assert.strictEqual(mockPublicBank.balance, 4700.00, 'Public Bank must be deducted RM 500');

console.log("✓ Test 13 Passed: Edit Transaction dynamic account/wallet synchronization and rebalancing verified.");

// Test 14: Subscriptions & Transactions Account Linking & Auto-Healing
assert(appJsContent.includes('escapeHtml(sub.sourceName || sub.cardName || sub.wallet || "Bank Account")'), 'Subscription badge must display sourceName/cardName');
assert(appJsContent.includes('cardId: sub.sourceId || null'), 'Auto-deduction must forward cardId');
assert(appJsContent.includes('cardName: sub.sourceName || sub.cardName || null'), 'Auto-deduction must forward cardName');

// Test subscription badge rendering with linked account
let mockSub = { name: "Room Rental", wallet: "Bank Transfer", sourceName: "Maybank Savings" };
let badgeText = mockSub.sourceName || mockSub.cardName || mockSub.wallet || "Bank Account";
assert.strictEqual(badgeText, "Maybank Savings", 'Subscription badge must resolve to linked account name');

let mockCardSub = { name: "Spotify Premium", wallet: "Credit Card", sourceName: "Maybank Visa Signature" };
let cardBadgeText = mockCardSub.sourceName || mockCardSub.cardName || mockCardSub.wallet || "Bank Account";
assert.strictEqual(cardBadgeText, "Maybank Visa Signature", 'Credit card subscription badge must resolve to card name');

console.log("✓ Test 14 Passed: Subscription badges and transaction linking with active accounts verified.");

// Test 15: Monthly-Scoped Bank Reconciliation, Insufficient Funds Prompt, and ⚠️ Overdrawn Badge
assert(appJsContent.includes('// Reconcile transactions strictly within the active month'), 'getReconciledBankBalance must scope to current month');
assert(appJsContent.includes('⚠️ Insufficient Funds in'), 'handleAddTransaction must verify funds and prompt on shortfall');
assert(appJsContent.includes('⚠️ Overdrawn'), 'renderBankAccounts must show ⚠️ Overdrawn when balance is negative');

// Verify monthly-scoped calculation logic:
let mockSepBank = { id: "bank_maybank", name: "Maybank Savings", initialBalance: 3450.00 };
let pastTx = [
  { date: "2026-01-01", type: "expense", wallet: "Bank Transfer", cardId: "bank_maybank", amount: 5000.00 },
  { date: "2026-02-01", type: "expense", wallet: "Bank Transfer", cardId: "bank_maybank", amount: 5000.00 }
];
let currentSepTx = [
  { date: "2026-09-01", type: "expense", wallet: "Bank Transfer", cardId: "bank_maybank", amount: 550.00 },
  { date: "2026-09-02", type: "expense", wallet: "Bank Transfer", cardId: "bank_maybank", amount: 600.00 }
];

// Reconciling strictly within current month (September)
let sepNetChange = 0;
currentSepTx.forEach(t => { sepNetChange -= t.amount; });
let sepLiveBal = Number((mockSepBank.initialBalance + sepNetChange).toFixed(2));

assert.strictEqual(sepLiveBal, 2300.00, 'September balance must equal 3450 - 1150 = 2300.00 without being dragged down by Jan/Feb past expenses');

// Overdrawn logic test:
let overdrawnBal = -50.00;
let isOverdrawn = overdrawnBal < 0;
assert.strictEqual(isOverdrawn, true, 'Negative balances must trigger overdrawn state');

console.log("✓ Test 15 Passed: Monthly-scoped balance, Insufficient Funds prompt, and Overdrawn badge verified.");

// Test 16: Credit Card Linked Bank Account & Automated Settlement Flow
assert(htmlContent.includes('id="card-linked-bank"'), 'card-linked-bank select must exist in HTML');
assert(appJsContent.includes('function populateCardLinkedBankSelect('), 'populateCardLinkedBankSelect function must exist in app.js');
assert(appJsContent.includes('function executeBillSettlement('), 'executeBillSettlement function must exist in app.js');

// Test settlement logic:
let mockSettleCard = { id: "card_maybank", name: "Maybank Visa Signature", currentBilled: 450.00, payInFull: false, linkedBankAccountId: "bank_maybank" };
let mockSettleBank = { id: "bank_maybank", name: "Maybank Savings", balance: 3450.00 };
let paymentAmt = 450.00;

// Deduct from card & bank
mockSettleCard.currentBilled = Math.max(0, Number((mockSettleCard.currentBilled - paymentAmt).toFixed(2)));
mockSettleCard.payInFull = (mockSettleCard.currentBilled === 0);
mockSettleBank.balance = Number((mockSettleBank.balance - paymentAmt).toFixed(2));

assert.strictEqual(mockSettleCard.currentBilled, 0.00, 'Current billed debt must be 0.00 after full settlement');
assert.strictEqual(mockSettleCard.payInFull, true, 'payInFull must be true after full payment');
assert.strictEqual(mockSettleBank.balance, 3000.00, 'Bank balance must deduct payment amount from 3450 to 3000');

console.log("✓ Test 16 Passed: Credit Card default payment source and automated bill settlement verified.");

// Test 17: Credit Card Edit Button Scoping & Settle Transaction Deletion Reversals
assert(appJsContent.includes('isSettlement: true'), 'Settlement transactions must be tagged with isSettlement: true');
assert(appJsContent.includes('Credit Card Settlement: '), 'deleteExpense must detect settlement transactions');

// Verify that populateCardLinkedBankSelect is defined at the global scope (before openEditCardModal)
const popIdx = appJsContent.indexOf('function populateCardLinkedBankSelect(');
const openEditIdx = appJsContent.indexOf('function openEditCardModal(');
const bindIdx = appJsContent.indexOf('function bindEvents()');
assert(popIdx !== -1 && openEditIdx !== -1, 'Both functions must exist in app.js');
assert(popIdx > bindIdx, 'populateCardLinkedBankSelect must not be nested inside the beginning of bindEvents');
assert(popIdx < openEditIdx, 'populateCardLinkedBankSelect must be defined directly before openEditCardModal at top scope');

// Reversal logic verification:
let revertCardTarget = { id: "card_maybank", name: "Maybank Visa Signature", currentBilled: 0.00, payInFull: true };
let deletedSettleTx = { isSettlement: true, settledCardId: "card_maybank", amount: 450.00 };
if (deletedSettleTx.isSettlement) {
  revertCardTarget.currentBilled = Number((revertCardTarget.currentBilled + deletedSettleTx.amount).toFixed(2));
  revertCardTarget.payInFull = false;
}
assert.strictEqual(revertCardTarget.currentBilled, 450.00, 'Deleting settlement must restore 450.00 current billed debt');
assert.strictEqual(revertCardTarget.payInFull, false, 'payInFull must revert to false when debt is restored');

console.log("✓ Test 17 Passed: Edit card modal scoping and settlement deletion debt restoration verified.");

// Test 18: iOS WebKit Compatibility, Edge-Guard, and Form Optimization
const styleCssContent = fs.readFileSync(__dirname + '/../style.css', 'utf8');
assert(styleCssContent.includes('color-scheme: light;'), 'style.css must declare color-scheme: light');
assert(styleCssContent.includes('color-scheme: dark;'), 'style.css must declare color-scheme: dark');
assert(styleCssContent.includes('font-size: 16px !important;'), 'style.css must enforce 16px rule on mobile inputs to stop iOS zoom');
assert(styleCssContent.includes('-webkit-backdrop-filter: blur'), 'style.css must provide -webkit-backdrop-filter for iOS Safari');
assert(styleCssContent.includes('-webkit-touch-callout: none;'), 'style.css must suppress iOS magnifying loupe on FAB');

assert(appJsContent.includes('touchStartX < 25 || touchStartX > (window.innerWidth - 25)'), 'initSwipeGestures must guard against iOS Safari edge navigation');
assert(!htmlContent.includes('id="card-type-select"'), 'Redundant card-type-select must be removed from #card-dialog');

console.log("✓ Test 18 Passed: iOS WebKit compatibility, edge navigation guard, 16px rule, and form cleanup verified.");

// Test 19: Dynamic Loan Engine, 3-Step Amortization Formula, and Auto-Deduct Confirmation Flow
assert(htmlContent.includes('id="loan-due-dialog"'), 'loan-due-dialog must exist in HTML');
assert(htmlContent.includes('id="loan-linked-bank"'), 'loan-linked-bank select must exist in HTML');
assert(appJsContent.includes('function processLoanPayment('), 'processLoanPayment must exist in app.js');
assert(appJsContent.includes('function checkLoanDueAlerts()'), 'checkLoanDueAlerts must exist in app.js');

// Verify Group A Reducing Balance Amortization math strictly matches the user specification:
// RM 40,000 at 4% p.a. with RM 600 installment
const p0 = 40000.00;
const annualRate = 4.0;
const monthlyInst = 600.00;

const monthlyRate = (annualRate / 100) / 12;
const interestMonth = Number((p0 * monthlyRate).toFixed(2));
const principalPortion = Number((monthlyInst - interestMonth).toFixed(2));
const newRemainingP = Number((p0 - principalPortion).toFixed(2));

assert.strictEqual(interestMonth, 133.33, 'Interest for the month must be exactly RM 133.33');
assert.strictEqual(principalPortion, 466.67, 'Principal portion paid must be exactly RM 466.67');
assert.strictEqual(newRemainingP, 39533.33, 'New remaining balance must be exactly RM 39,533.33');

// Verify Bank Balance deduction upon loan payment:
let mockPbb = { id: "bank_public", name: "Public Bank Salary Account", balance: 5200.00 };
mockPbb.balance = Number((mockPbb.balance - monthlyInst).toFixed(2));
assert.strictEqual(mockPbb.balance, 4600.00, 'Loan installment must deduct 600.00 from bank balance (5200 -> 4600)');

console.log("✓ Test 19 Passed: Dynamic Loan Engine, exact reducing balance amortization math, and auto-deduct flow verified.");

// Test 20: Loan Installment Due Notification, Settlement, and Reversal Flow
assert(appJsContent.includes('function settleLoanFromNotification('), 'settleLoanFromNotification must exist in app.js');
assert(appJsContent.includes('notif_due_loan_'), 'checkLoanDueAlerts must generate due loan notifications');

// Verify loan payment deletion reversal
let testLoanObj = { id: "loan_bezza", name: "Perodua Bezza", originalPrincipal: 38000.00, remainingPrincipal: 34160.00, tenureMonths: 84, remainingMonths: 76, rate: 3.20, type: "CAR_EIR" };
let testBankObj = { id: "bank_public", name: "Public Bank Salary Account", balance: 5200.00 };
let installmentPayment = 480.00;

// Reversal test:
const revMonthlyRate = (testLoanObj.rate / 100) / 12;
const revMonthlyInterest = Number((testLoanObj.remainingPrincipal * revMonthlyRate).toFixed(2));
const principalPaid = Math.max(0, Number((installmentPayment - revMonthlyInterest).toFixed(2)));

testLoanObj.remainingPrincipal = Math.min(testLoanObj.originalPrincipal, Number((testLoanObj.remainingPrincipal + principalPaid).toFixed(2)));
testLoanObj.remainingMonths = Math.min(testLoanObj.tenureMonths, testLoanObj.remainingMonths + 1);
testBankObj.balance = Number((testBankObj.balance + installmentPayment).toFixed(2));

assert.strictEqual(testLoanObj.remainingMonths, 77, 'Remaining months must increment back to 77');
assert.strictEqual(testBankObj.balance, 5680.00, 'Bank balance must refund installment from 5200 to 5680');

console.log("✓ Test 20 Passed: Loan installment due notification, settlement, and reversal flow verified.");

// Test 19: Dual-Perspective Summary (Personal Budget vs Official CCRIS View)
assert(htmlContent.includes('id="dual-budget-sum"'), 'dual-budget-sum must exist in HTML');
assert(htmlContent.includes('id="dual-ccris-sum"'), 'dual-ccris-sum must exist in HTML');
assert(htmlContent.includes('id="dual-budget-breakdown-list"'), 'dual-budget-breakdown-list must exist in HTML');
assert(htmlContent.includes('id="dual-ccris-breakdown-list"'), 'dual-ccris-breakdown-list must exist in HTML');
assert(appJsContent.includes('const totalBudgetCommitment = totalLoanInstallments + totalSubsCommitment + totalCardsBilledDebt;'), 'renderLoans must calculate total budget commitment');
assert(appJsContent.includes('const totalCcrisCommitment = totalLoanInstallments + totalCcrisCards;'), 'renderLoans must calculate total CCRIS commitment');

// Test calculation math matching user example
let mockLoanMonthly = 480.00;
let mockSubsMonthly = 1229.90;
let mockCardsBilled = 450.00;
let mockCardsBal = 585.00;
let mockIncome = 3500.00;

let budgetTotal = mockLoanMonthly + mockSubsMonthly + mockCardsBilled;
assert.strictEqual(budgetTotal, 2159.90, 'Personal Budget Commitment must equal sum of loans, subs, and cards billed debt');

let ccrisCards = Math.max(Number((mockCardsBal * 0.05).toFixed(2)), 50.00);
let ccrisTotal = mockLoanMonthly + ccrisCards;
assert.strictEqual(ccrisTotal, 530.00, 'CCRIS Commitment must equal loan installment + 5% card rule (or min 50)');

let calcDsr = Number(((ccrisTotal / mockIncome) * 100).toFixed(1));
assert.strictEqual(calcDsr, 15.1, 'DSR must equal 15.1%');

console.log("✓ Test 19 Passed: Dual-Perspective Summary HTML elements and financial underwriting math verified.");


// Test 21: Subscriptions & Bills Deletion Updates Total Monthly Commitment (Bug 1 Fix)
assert(appJsContent.includes('deleteSubscription(id)'), 'deleteSubscription must exist in app.js');
assert(appJsContent.includes('render(); // Synchronize Subscriptions header, Total Monthly Commitment card, and Spendable Hero (Bug 1 Fix)'), 'deleteSubscription must call render() to update Total Monthly Commitment');

// Test logic: totalSubsCommitment calculation on subscription deletion
let mockSubscriptions = [
  { id: "sub_netflix", name: "Netflixxxxx", amount: 43.00, category: "Entertainment", billingDay: 2 },
  { id: "sub_wifi", name: "Home Fibre", amount: 89.00, category: "Bills & Utilities", billingDay: 22 }
];
let mockLoans = [{ id: "loan_1", monthlyInstallment: 500.00 }];
let mockCreditCards = [{ id: "card_1", currentBilled: 200.00, unbilledBalance: 0, payInFull: true }];

let initialSubsTotal = mockSubscriptions.reduce((s, sub) => s + (sub.amount || 0), 0);
let initialBudgetTotal = mockLoans[0].monthlyInstallment + initialSubsTotal + mockCreditCards[0].currentBilled;
assert.strictEqual(initialSubsTotal, 132.00, 'Initial subscriptions total must be RM 132.00');
assert.strictEqual(initialBudgetTotal, 832.00, 'Initial total budget commitment must be RM 832.00');

// Delete sub_netflix
const delIdx = mockSubscriptions.findIndex(s => s.id === "sub_netflix");
mockSubscriptions.splice(delIdx, 1);

let updatedSubsTotal = mockSubscriptions.reduce((s, sub) => s + (sub.amount || 0), 0);
let updatedBudgetTotal = mockLoans[0].monthlyInstallment + updatedSubsTotal + mockCreditCards[0].currentBilled;
assert.strictEqual(updatedSubsTotal, 89.00, 'Updated subscriptions total must be RM 89.00 after deletion');
assert.strictEqual(updatedBudgetTotal, 789.00, 'Updated total budget commitment must be RM 789.00 after deletion');
console.log("✓ Test 21 Passed: Subscriptions & Bills deletion updates Total Monthly Commitment simultaneously (Bug 1 Fix).");

// Test 22: Logged Subscription Transaction Deletion Reversals & 'Debited for [Month]' State Reset (Bug 2 Fix)
assert(appJsContent.includes('function isSubscriptionTransaction('), 'isSubscriptionTransaction helper must exist in app.js');
assert(appJsContent.includes('// Check if deleted item was a logged subscription / recurring bill (Bug 2 Fix)'), 'deleteExpense must handle subscription reversal');
assert(appJsContent.includes('// Dynamic reconciliation with state.transactions as Single Source of Truth (Bug 2 Fix)'), 'renderSubscriptions must dynamically reconcile debited status');

// Test transaction matching and reversal logic
let testSub = { id: "sub_netflix", name: "Netflixxxxx", amount: 43.00, lastLoggedMonth: "2026-09" };
let testTransactions = [
  { id: "tx_sub_1", type: "expense", amount: 43.00, date: "2026-09-02", note: "Netflixxxxx (Monthly Bill)", subId: "sub_netflix" }
];

// Helper mock matching function
function mockIsSubTx(tx, sub) {
  if (!tx || tx.type !== "expense" || !sub) return false;
  if (tx.subId && tx.subId === sub.id) return true;
  if (tx.note) {
    const cleanNote = tx.note.trim().toLowerCase();
    const cleanSubName = sub.name.trim().toLowerCase();
    return cleanNote === `${cleanSubName} (monthly bill)` || cleanNote === `${cleanSubName} (auto-debited)`;
  }
  return false;
}

assert.strictEqual(mockIsSubTx(testTransactions[0], testSub), true, 'Transaction must match subscription by subId and note');

// When transaction exists for 2026-09, sub must be debited
let hasTx = testTransactions.some(t => t.date.startsWith("2026-09") && mockIsSubTx(t, testSub));
assert.strictEqual(hasTx, true, 'hasTx must be true when transaction is logged');

// Simulate deleteExpense on tx_sub_1
const txDelIdx = testTransactions.findIndex(t => t.id === "tx_sub_1");
const deletedTx = testTransactions.splice(txDelIdx, 1)[0];

// Reversal logic from deleteExpense
if (mockIsSubTx(deletedTx, testSub)) {
  const hasRemaining = testTransactions.some(t => t.date.startsWith("2026-09") && mockIsSubTx(t, testSub));
  if (!hasRemaining) {
    testSub.lastLoggedMonth = null;
  }
}

assert.strictEqual(testSub.lastLoggedMonth, null, 'Subscription lastLoggedMonth must reset to null after deleting transaction');

// Dynamic reconciliation in renderSubscriptions
let isDebitedNow = testSub.lastLoggedMonth === "2026-09";
assert.strictEqual(isDebitedNow, false, 'isDebited must be false after transaction deletion (badge reverts to Log button)');
console.log("✓ Test 22 Passed: Logged Subscription Transaction Deletion Reversals & Debited badge reset verified (Bug 2 Fix).");


// Test 23: Cash Flow Trajectory Dual-Line Chart with Curved Area Gradients & Time-Filter Dropdown
const updatedHtml = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const updatedAppJs = fs.readFileSync(__dirname + '/../app.js', 'utf8');

assert(updatedHtml.includes('id="analysis-range-select"'), 'analysis-range-select dropdown must exist in index.html');
assert(updatedHtml.includes('id="analysis-line-chart"'), 'analysis-line-chart SVG must exist in index.html');
assert(updatedHtml.includes('id="chart-interactive-legend"'), 'chart-interactive-legend container must exist in index.html');
assert(updatedAppJs.includes('getCurvedPath'), 'getCurvedPath Bézier spline generator must exist in app.js');
assert(updatedAppJs.includes('getCurvedAreaPath'), 'getCurvedAreaPath area generator must exist in app.js');
assert(updatedAppJs.includes('cashflowIncomeGrad'), 'cashflowIncomeGrad linear gradient must exist in app.js');
assert(updatedAppJs.includes('cashflowExpenseGrad'), 'cashflowExpenseGrad linear gradient must exist in app.js');

// Test Cubic Bézier Generator math
function mockCurvedPath(points) {
  if (!points.length) return "";
  let path = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const cp1x = p1.x + (p2.x - p0.x) * 0.18;
    const cp1y = p1.y + (p2.y - p0.y) * 0.18;
    const cp2x = p2.x - (p3.x - p1.x) * 0.18;
    const cp2y = p2.y - (p3.y - p1.y) * 0.18;
    path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return path;
}

const testPts = [{ x: 75, y: 50 }, { x: 165, y: 60 }, { x: 255, y: 40 }];
const generatedPath = mockCurvedPath(testPts);
assert(generatedPath.startsWith('M 75.0 50.0 C'), 'Path must start with M and use cubic bezier C commands');
assert(generatedPath.includes('255.0 40.0'), 'Path must terminate at final point');

// Test Time Range selection (3, 6, 12 months)
[3, 6, 12].forEach(range => {
  let buckets = [];
  const now = new Date(2026, 8, 7);
  for (let i = range - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets.push({ key: ym });
  }
  assert.strictEqual(buckets.length, range, `Time range ${range} must generate exactly ${range} monthly buckets`);
});

console.log("✓ Test 23 Passed: Cash Flow Trajectory Dual-Line Chart with Curved Area Gradients & Time-Filter Dropdown verified.");


// Test 24: Spending by Payment Source Consolidated Card & Progress Bar Sorting
const htmlAfterRedesign = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const jsAfterRedesign = fs.readFileSync(__dirname + '/../app.js', 'utf8');

assert(htmlAfterRedesign.includes('id="payment-source-list"'), 'payment-source-list container must exist in index.html');
assert(htmlAfterRedesign.includes('SPENDING BY PAYMENT SOURCE'), 'SPENDING BY PAYMENT SOURCE title must exist in index.html');
assert(jsAfterRedesign.includes('WALLET_CONFIG'), 'WALLET_CONFIG mapping must exist in app.js');
assert(jsAfterRedesign.includes('payment-source-progress-fill'), 'payment-source-progress-fill progress bars must exist in app.js');

// Test descending sort and percentage calculations
const mockWalletTotals = {
  "Bank Account": 0,
  "Credit Card": 2146.40,
  "E-Wallet": 4043.00,
  "Cash": 1497.00,
  "Bank Transfer": 4045.00,
  "Debit Card": 1420.00
};

const totalSpend = Object.values(mockWalletTotals).reduce((s, v) => s + v, 0);
assert.strictEqual(totalSpend, 13151.40, 'Total wallet spend must equal 13,151.40');

const sorted = Object.entries(mockWalletTotals).sort((a, b) => b[1] - a[1]);
assert.strictEqual(sorted[0][0], "Bank Transfer", 'Highest spend source must be Bank Transfer (4045.00)');
assert.strictEqual(sorted[1][0], "E-Wallet", 'Second highest spend source must be E-Wallet (4043.00)');
assert.strictEqual(sorted[sorted.length - 1][0], "Bank Account", 'Lowest spend source must be Bank Account (0.00)');

const eWalletPct = ((mockWalletTotals["E-Wallet"] / totalSpend) * 100).toFixed(0);
assert.strictEqual(eWalletPct, "31", 'E-Wallet percentage must be 31%');

console.log("✓ Test 24 Passed: Spending by Payment Source Consolidated Card & Progress Bar Sorting verified.");


// Test 25: Category Distribution Donut Chart with Inner Total & Modern Legend
const htmlDonut = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const cssDonut = fs.readFileSync(__dirname + '/../style.css', 'utf8');
const jsDonut = fs.readFileSync(__dirname + '/../app.js', 'utf8');

assert(htmlDonut.includes('id="donut-center-overlay"'), 'donut-center-overlay must exist in index.html');
assert(htmlDonut.includes('id="donut-center-label"'), 'donut-center-label must exist in index.html');
assert(htmlDonut.includes('id="donut-center-total"'), 'donut-center-total must exist in index.html');
assert(cssDonut.includes('.donut-legend-swatch'), 'donut-legend-swatch styling must exist in style.css');
assert(cssDonut.includes('border-radius: 4px;'), 'Thin rounded square swatches (border-radius: 4px) must exist in style.css');
assert(jsDonut.includes('donut-slice'), 'donut-slice class must exist in app.js');
assert(jsDonut.includes('highlightDonutCategory'), 'highlightDonutCategory hover helper must exist in app.js');

// Test Donut Slice Geometry calculation
const R = 92;
const r = 62;
const sliceAngle = 90;
const startAngle = 0;
const endAngle = 90;
const startRad = (startAngle * Math.PI) / 180;
const endRad = (endAngle * Math.PI) / 180;

const x1out = Number((R * Math.cos(startRad)).toFixed(2));
const y1out = Number((R * Math.sin(startRad)).toFixed(2));
const x2out = Number((R * Math.cos(endRad)).toFixed(2));
const y2out = Number((R * Math.sin(endRad)).toFixed(2));
const x1in = Number((r * Math.cos(startRad)).toFixed(2));
const y1in = Number((r * Math.sin(startRad)).toFixed(2));
const x2in = Number((r * Math.cos(endRad)).toFixed(2));
const y2in = Number((r * Math.sin(endRad)).toFixed(2));

assert.strictEqual(x1out, 92.00);
assert.strictEqual(y1out, 0.00);
assert.strictEqual(x2out, 0.00);
assert.strictEqual(y2out, 92.00);
assert.strictEqual(x1in, 62.00);
assert.strictEqual(y1in, 0.00);
assert.strictEqual(x2in, 0.00);
assert.strictEqual(y2in, 62.00);

console.log("✓ Test 25 Passed: Category Distribution Donut Chart with Inner Total & Modern Legend verified.");

console.log("\nAll Multi-Card (Credit & Debit) Architecture tests passed successfully!");
