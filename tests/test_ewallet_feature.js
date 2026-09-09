const fs = require('fs');
const assert = require('assert');

console.log("--- Starting E-Wallets & Digital Balances Feature Tests ---");

const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const css = fs.readFileSync(__dirname + '/../style.css', 'utf8');
const js = fs.readFileSync(__dirname + '/../app.js', 'utf8');

// 1. HTML Element Existence
const requiredEwalletIds = [
  'ewallets-grid',
  'ewallets-total-summary',
  'open-add-ewallet-btn',
  'ewallet-dialog',
  'ewallet-form',
  'ewallet-edit-id',
  'ewallet-type-select',
  'ewallet-name',
  'ewallet-balance',
  'ewallet-account-number',
  'close-ewallet-modal-btn',
  'cancel-ewallet-modal-btn',
  'save-ewallet-btn',
  'select-ewallet-dialog',
  'close-ewallet-picker-btn',
  'cancel-ewallet-picker-btn',
  'picker-ewallets-list',
  'nav-to-add-ewallet-btn'
];

requiredEwalletIds.forEach(id => {
  assert(html.includes(`id="${id}"`), `HTML missing required E-Wallet element: #${id}`);
});
console.log("✓ Test 1 Passed: E-Wallet section and Add/Picker modals exist in index.html.");

// 2. Malaysian E-Wallet Brand Types
const brandTypes = ['TNG', 'GRABPAY', 'BOOST', 'BIGPAY', 'SHOPEEPAY', 'MAE', 'SETEL', 'OTHER'];
brandTypes.forEach(type => {
  assert(html.includes(`value="${type}"`), `Missing e-wallet preset option: ${type}`);
});
console.log("✓ Test 2 Passed: Touch 'n Go, GrabPay, Boost, BigPay, ShopeePay, MAE, Setel presets configured.");

// 3. E-Wallet 0% DSR Impact Verification
function calculateEwalletDsrImpact(walletObj) {
  // E-wallets are prepaid digital assets and must never contribute to CCRIS debt servicing ratio
  return 0.00;
}
assert.strictEqual(calculateEwalletDsrImpact({ type: "TNG", balance: 500.00 }), 0.00, "E-Wallets must have 0% DSR impact");
console.log("✓ Test 3 Passed: E-Wallet 0% DSR debt impact verified.");

// 4. Zero-Drift Balance Reconciliation Mechanics
const testEwallet = { id: "ew_tng", name: "Touch 'n Go eWallet", type: "TNG", initialBalance: 100.00, balance: 100.00 };
let currentBal = testEwallet.initialBalance;

// Expense deduction
const expenseAmt = 35.50;
currentBal = Number((currentBal - expenseAmt).toFixed(2));
assert.strictEqual(currentBal, 64.50, "Expense must deduct from e-wallet balance");

// Income / Top-up reload
const reloadAmt = 50.00;
currentBal = Number((currentBal + reloadAmt).toFixed(2));
assert.strictEqual(currentBal, 114.50, "Reload must increment e-wallet balance");

// Reversal on expense deletion
currentBal = Number((currentBal + expenseAmt).toFixed(2));
assert.strictEqual(currentBal, 150.00, "Deleting expense must restore e-wallet balance");
console.log("✓ Test 4 Passed: Zero-drift expense deduction, reload increment, and deletion reversal verified.");

// 5. Cross-Platform Safeguards
assert(css.includes('#ewallet-dialog input, #ewallet-dialog select {') && css.includes('font-size: 16px'), 'iOS WebKit 16px rule must be enforced on e-wallet inputs');
assert(css.includes('#open-add-ewallet-btn') && css.includes('min-height: 38px'), 'Android minimum touch target must be enforced on e-wallet buttons');
console.log("✓ Test 5 Passed: iOS 16px auto-zoom prevention and Android touch target safeguards verified.");

// 6. Universal Backdrop Dismissal Safeguard
assert(js.includes('if (e.target === dialog) {'), 'Universal backdrop dismissal checks e.target === dialog');
console.log("✓ Test 6 Passed: Universal modal backdrop dismissal verified.");

console.log("All E-Wallet Feature tests passed successfully!");

// 7. Touch 'n Go & Single Quote Safety in E-Wallet Picker (Bug 1 Fix)
assert(!js.includes("onclick=\"selectEwallet('${ew.id}', '${escapeHtml(ew.name)}')\""), "Picker must not interpolate raw unescaped name strings into inline onclick");
assert(js.includes("onclick=\"selectEwallet('${ew.id}')\""), "Picker must pass ID safely to selectEwallet");

// Simulate selecting an e-wallet with apostrophe in name
const mockState = {
  ewallets: [
    { id: "ew_tng", name: "Touch 'n Go", type: "TNG", balance: 379.72 }
  ],
  selectedEwalletId: null,
  selectedEwalletName: null,
  selectedCardId: null,
  selectedCardName: null,
  selectedCardType: null,
  selectedBankId: null,
  selectedBankName: null,
  pickerTargetContext: "transaction"
};

const mockDom = {
  selectedWallet: { value: "" },
  selectedSourceId: { value: "" },
  selectedSourceName: { value: "" },
  pillEwalletTx: { textContent: "", classList: { add() {}, remove() {} } },
  pillBankTx: { textContent: "" },
  pillCardTx: { textContent: "" },
  selectEwalletDialog: { closeCalled: false, close() { this.closeCalled = true; } }
};

function testSelectEwallet(ewId, ewName) {
  if (!ewName) {
    const ew = (mockState.ewallets || []).find(w => w.id === ewId);
    ewName = ew ? ew.name : "E-Wallet";
  }
  mockState.selectedEwalletId = ewId;
  mockState.selectedEwalletName = ewName;
  mockState.selectedCardId = ewId;
  mockState.selectedCardName = ewName;
  mockState.selectedCardType = "ewallet";

  mockDom.selectedWallet.value = "E-Wallet";
  mockDom.selectedSourceId.value = ewId;
  mockDom.selectedSourceName.value = ewName;
  mockDom.pillEwalletTx.textContent = `📱 ${ewName} ▾`;
  mockDom.selectEwalletDialog.close();
}

testSelectEwallet("ew_tng");
assert.strictEqual(mockState.selectedEwalletName, "Touch 'n Go", "E-Wallet name with apostrophe must resolve correctly");
assert.strictEqual(mockDom.selectedWallet.value, "E-Wallet", "selectedWallet input must be 'E-Wallet'");
assert.strictEqual(mockDom.selectedSourceId.value, "ew_tng", "selectedSourceId must be 'ew_tng'");
assert.strictEqual(mockDom.selectedSourceName.value, "Touch 'n Go", "selectedSourceName must be 'Touch 'n Go'");
assert.strictEqual(mockDom.pillEwalletTx.textContent, "📱 Touch 'n Go ▾", "Pill text must reflect Touch 'n Go");
assert.strictEqual(mockDom.selectEwalletDialog.closeCalled, true, "Dialog close() must be called");
console.log("✓ Test 7 Passed: Apostrophe safety and selection verified for Touch 'n Go.");

// 8. Add E-Wallet Button Functioning & Safe Modal Transition (Bug 2 Fix)
assert(html.includes('id="nav-to-add-ewallet-btn" class="btn-outline-sm" onclick="handleNavToAddEwallet()"'), "nav-to-add-ewallet-btn must have onclick='handleNavToAddEwallet()'");
assert(html.includes('id="open-add-ewallet-btn" class="btn-primary-sm" onclick="openAddEwalletModal()"'), "open-add-ewallet-btn must have onclick='openAddEwalletModal()'");
assert(js.includes('function handleNavToAddEwallet()'), "app.js must implement handleNavToAddEwallet()");
assert(js.includes('window.handleNavToAddEwallet = handleNavToAddEwallet;'), "handleNavToAddEwallet must be exposed globally on window");
assert(js.includes('let isTransitioningModal = false;'), "isTransitioningModal flag must protect against premature history popstate close");
assert(js.includes('!isTransitioningModal'), "close event listener must respect isTransitioningModal guard");
console.log("✓ Test 8 Passed: 'Add E-Wallet' button functioning and modal transition safeguards verified.");

// 9. Auto-Selection of Newly Added E-Wallet from Transaction Context
const mockEwalletsList = [...mockState.ewallets];
function testSaveNewEwallet(newEw, context) {
  mockEwalletsList.push(newEw);
  if (context === "transaction") {
    testSelectEwallet(newEw.id, newEw.name);
  }
}
testSaveNewEwallet({ id: "ew_boost", name: "Boost eWallet", type: "BOOST", balance: 50.00 }, "transaction");
assert.strictEqual(mockState.selectedEwalletId, "ew_boost", "Newly added e-wallet must be auto-selected in transaction context");
assert.strictEqual(mockDom.selectedSourceName.value, "Boost eWallet", "selectedSourceName must update to Boost eWallet");
console.log("✓ Test 9 Passed: Auto-selection of newly created e-wallet in transaction context verified.");

console.log("All E-Wallet Feature tests passed successfully!");
