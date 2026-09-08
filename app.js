
// ================= LOAN AMORTIZATION & PAYMENT ENGINE =================
function processLoanPayment(loan, paymentAmt, sourceBank) {
  const bank = sourceBank || state.bankAccounts.find(b => b.id === loan.linkedBankAccountId || b.bank === loan.bank) || state.bankAccounts[0];
  const bankName = bank ? bank.name : "Bank Account";
  const bankBal = bank ? getReconciledBankBalance(bank) : 0;

  if (bank && paymentAmt > bankBal) {
    const shortfall = (paymentAmt - bankBal).toFixed(2);
    if (!confirm(`⚠️ Insufficient Funds in ${bankName}!

Available Balance: ${formatCurrency(bankBal)}
Installment Due: ${formatCurrency(paymentAmt)}
Shortfall: ${formatCurrency(shortfall)}

Proceed anyway (Account will become overdrawn)?`)) {
      return false;
    }
  }

  let monthlyInterest = 0;
  let principalPaid = 0;

  if (loan.type === "CAR_EIR" || loan.type === "HOME_SBR" || loan.type === "PERSONAL") {
    // Group A: Exact 3-step reducing balance formula
    const monthlyRate = (loan.rate / 100) / 12;
    monthlyInterest = Number(((loan.remainingPrincipal || loan.originalPrincipal) * monthlyRate).toFixed(2));
    principalPaid = Math.max(0, Number((paymentAmt - monthlyInterest).toFixed(2)));
    loan.remainingPrincipal = Math.max(0, Number(((loan.remainingPrincipal || loan.originalPrincipal) - principalPaid).toFixed(2)));
  } else if (loan.type === "CAR_FLAT") {
    // Group B: Rule of 78 frontloaded interest calculation
    const n = loan.tenureMonths || 84;
    const k = Math.min(n, (loan.tenureMonths - (loan.remainingMonths || n) + 1));
    const sumOfDigits = (n * (n + 1)) / 2;
    const totalInterest = loan.totalInterest || (loan.originalPrincipal * (loan.rate / 100) * (n / 12));
    const factor = Math.max(0, (n - k + 1)) / sumOfDigits;
    monthlyInterest = Number((totalInterest * factor).toFixed(2));
    principalPaid = Math.max(0, Number((paymentAmt - monthlyInterest).toFixed(2)));
    loan.remainingPrincipal = Math.max(0, Number(((loan.remainingPrincipal || loan.originalPrincipal) - principalPaid).toFixed(2)));
  } else {
    // Group C: PTPTN (1% flat Ujrah) & 0% IPP
    const effectiveRate = (loan.rate !== undefined && loan.rate !== null && !isNaN(loan.rate) && loan.rate > 0) ? loan.rate : 1.0;
    monthlyInterest = loan.type === "PTPTN" ? Number(((loan.originalPrincipal * (effectiveRate / 100)) / 12).toFixed(2)) : 0;
    principalPaid = Math.max(0, Number((paymentAmt - monthlyInterest).toFixed(2)));
    loan.remainingPrincipal = Math.max(0, Number(((loan.remainingPrincipal || loan.originalPrincipal) - principalPaid).toFixed(2)));
  }

  loan.remainingMonths = Math.max(0, (loan.remainingMonths !== undefined ? loan.remainingMonths : loan.tenureMonths) - 1);
  loan.totalInterestPaid = Number(((loan.totalInterestPaid || 0) + monthlyInterest).toFixed(2));
  const currentYm = getLocalDateString().substring(0, 7);
  loan.lastPaidMonth = currentYm;

  // 1. Deduct funds from linked bank account
  if (bank) {
    bank.balance = Number(((bank.balance || 0) - paymentAmt).toFixed(2));
  }

  // 2. Log transaction into ledger
  state.transactions.unshift({
    id: "tx_loan_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
    type: "expense",
    amount: paymentAmt,
    category: "Bills & Utilities",
    wallet: "Bank Transfer",
    cardId: bank ? bank.id : null,
    cardName: bank ? bank.name : "Bank Transfer",
    cardType: null,
    isLoanPayment: true,
    loanId: loan.id,
    loanName: loan.name,
    date: getLocalDateString(),
    note: `Loan Installment: ${loan.name} (Principal: ${formatCurrency(principalPaid)}, Interest: ${formatCurrency(monthlyInterest)})`,
    createdAt: Date.now()
  });

  // 3. Record decision in notifications
  state.notifications.unshift({
    id: "notif_loan_" + loan.id + "_" + currentYm,
    type: "statement",
    cardId: loan.id,
    title: `✓ Paid: ${loan.name}`,
    time: new Date().toISOString(),
    isRead: true,
    decision: `Paid ${formatCurrency(paymentAmt)} (Principal: ${formatCurrency(principalPaid)} • Interest: ${formatCurrency(monthlyInterest)})`,
    body: `Installment confirmed for ${currentYm}. Remaining balance: ${formatCurrency(loan.remainingPrincipal)} (${loan.remainingMonths} mos left).`
  });

  saveStorage();
  render();
  showToast(`Paid ${formatCurrency(paymentAmt)} for ${loan.name}! (Principal: ${formatCurrency(principalPaid)}, Interest: ${formatCurrency(monthlyInterest)})`);
  return true;
}

function promptManualLoanPayment(loanId) {
  const loan = state.loans.find(l => l.id === loanId);
  if (!loan) return;
  const currentYm = getLocalDateString().substring(0, 7);

  if (loan.lastPaidMonth === currentYm) {
    if (!confirm(`The installment for ${loan.name} was already debited for this month (${currentYm}). Make an extra payment?`)) {
      return;
    }
  }

  processLoanPayment(loan, loan.monthlyInstallment);
}

let activeDueLoan = null;

function checkLoanDueAlerts() {
  if (!state.loans || !state.loans.length) return;
  const now = new Date();
  const todayDay = now.getDate();
  const currentYm = getLocalDateString().substring(0, 7);
  const monthName = now.toLocaleString(undefined, { month: "long" });

  const dueLoan = state.loans.find(l => {
    const due = l.dueDay || 1;
    const isDue = todayDay >= due;
    const notPaidThisMonth = l.lastPaidMonth !== currentYm;
    const hasDebt = (l.remainingPrincipal > 0 || l.remainingMonths > 0);
    return isDue && notPaidThisMonth && hasDebt;
  });

  if (!dueLoan || !dom.loanDueDialog) return;

  // If dismissed during this immediate session, keep in notification center and remind again on next reload
  if (sessionStorage.getItem("dismissed_loan_prompt_" + dueLoan.id + "_" + currentYm)) return;

  activeDueLoan = dueLoan;
  const bank = state.bankAccounts.find(b => b.id === dueLoan.linkedBankAccountId || b.bank === dueLoan.bank) || state.bankAccounts[0];
  const bankBal = bank ? getReconciledBankBalance(bank) : 0;
  const bankName = bank ? bank.name : "Bank Account";

  // Ensure an actionable reminder card exists in Notification Center
  const notifId = "notif_due_loan_" + dueLoan.id + "_" + currentYm;
  if (!state.notifications.some(n => n.id === notifId)) {
    state.notifications.unshift({
      id: notifId,
      type: "action_due",
      loanId: dueLoan.id,
      loanName: dueLoan.name,
      billedAmount: dueLoan.monthlyInstallment,
      title: `🔔 Loan Installment Due: ${dueLoan.name}`,
      time: new Date().toISOString(),
      isRead: false,
      decision: null,
      body: `Monthly installment of ${formatCurrency(dueLoan.monthlyInstallment)} is due for ${monthName}. Payment source: 🏦 ${bankName}.`
    });
    saveStorage();
    updateNotificationBadge();
  }

  if (dom.loanDueTitle) dom.loanDueTitle.textContent = dueLoan.name;
  if (dom.loanDueSubtitle) dom.loanDueSubtitle.textContent = `${monthName} installment confirmation.`;
  if (dom.loanDueAmount) dom.loanDueAmount.textContent = formatCurrency(dueLoan.monthlyInstallment);
  if (dom.loanDueSource) dom.loanDueSource.textContent = `🏦 ${bankName}`;
  if (dom.loanDueSourceBalance) dom.loanDueSourceBalance.textContent = `Available Balance: ${formatCurrency(bankBal)}`;

  setTimeout(() => {
    dom.loanDueDialog?.showModal ? dom.loanDueDialog.showModal() : null;
  }, 600);
}


// Reconcile Credit Card Unbilled Spends against logged transactions
function reconcileCreditCardUnbilled() {
  if (!state.creditCards || !state.creditCards.length) return;
  const now = new Date();

  state.creditCards.forEach(card => {
    const todayDay = now.getDate();
    let cycleStartYear = now.getFullYear();
    let cycleStartMonth = now.getMonth();
    if (todayDay <= card.statementDay) {
      cycleStartMonth -= 1;
      if (cycleStartMonth < 0) {
        cycleStartMonth = 11;
        cycleStartYear -= 1;
      }
    }
    const cycleStartDate = new Date(cycleStartYear, cycleStartMonth, card.statementDay + 1);
    const cycleStartStr = `${cycleStartDate.getFullYear()}-${String(cycleStartDate.getMonth() + 1).padStart(2, "0")}-${String(cycleStartDate.getDate()).padStart(2, "0")}`;

    let cycleSpend = 0;
    let foundMatchingTx = false;

    state.transactions.forEach(t => {
      if (t.type === "expense" && (t.wallet === "Credit Card" || t.cardType === "credit")) {
        const isThisCard = (!t.cardId && !t.cardName) || t.cardId === card.id || t.cardName === card.name;
        if (isThisCard && t.date && t.date >= cycleStartStr) {
          cycleSpend += t.amount;
          foundMatchingTx = true;
        }
      }
    });

    card.unbilledBalance = foundMatchingTx ? Number(cycleSpend.toFixed(2)) : 0.00;
  });
}

// Single Source of Truth Helpers for Debit Cards and Bank Accounts
function getDebitCardMonthlySpend(cardId, cardName, bank) {
  const currentYm = getLocalDateString().substring(0, 7);
  let spend = 0;
  state.transactions.forEach(t => {
    if (t.type === "expense" && (t.wallet === "Debit Card" || t.cardType === "debit")) {
      const isMatch = (cardId && t.cardId === cardId) ||
                      (cardName && t.cardName === cardName) ||
                      (!t.cardId && !t.cardName && t.note && t.note.toLowerCase().includes(bank.toLowerCase()));
      if (isMatch && t.date && t.date.startsWith(currentYm)) {
        spend += t.amount;
      }
    }
  });
  return Number(spend.toFixed(2));
}

function getReconciledBankBalance(bank) {
  const initial = (bank.initialBalance !== undefined && bank.initialBalance !== null)
    ? Number(bank.initialBalance)
    : Number(bank.balance || 0);

  const currentYm = getLocalDateString().substring(0, 7);
  let netChange = 0;

  state.transactions.forEach(t => {
    // Reconcile transactions strictly within the active month to mirror real-world monthly baselines
    if (t.date && t.date.startsWith(currentYm)) {
      const isThisBank = (t.cardId && t.cardId === bank.id) ||
                         (t.cardName && t.cardName === bank.name) ||
                         (!t.cardId && !t.cardName && t.note && t.note.toLowerCase().includes(bank.bank.toLowerCase()));

      const isLinkedDebit = (t.wallet === "Debit Card" || t.cardType === "debit") &&
        state.debitCards.some(dc => (dc.bankAccountId === bank.id || dc.bank === bank.bank) && ((t.cardId && t.cardId === dc.id) || (t.cardName && t.cardName === dc.name)));

      if (isThisBank || isLinkedDebit) {
        if (t.type === "income") {
          netChange += t.amount;
        } else if (t.type === "expense" && (t.wallet === "Bank Transfer" || t.wallet === "Debit Card" || t.cardType === "debit")) {
          netChange -= t.amount;
        }
      }
    }
  });

  return Number((initial + netChange).toFixed(2));
}

// Category Presets
const DEFAULT_EXPENSE_CATEGORIES = [
  { name: "Food & Dining", icon: "🍔", color: "#f97316" },
  { name: "Transportation", icon: "🚗", color: "#3b82f6" },
  { name: "Shopping", icon: "🛍️", color: "#ec4899" },
  { name: "Entertainment", icon: "🎬", color: "#8b5cf6" },
  { name: "Groceries", icon: "🛒", color: "#84cc16" },
  { name: "Bills & Utilities", icon: "⚡", color: "#eab308" },
  { name: "Health & Medical", icon: "💊", color: "#10b981" },
  { name: "Savings & Investments", icon: "💰", color: "#059669" },
  { name: "Education", icon: "📚", color: "#06b6d4" },
  { name: "Other", icon: "📦", color: "#64748b" }
];

const DEFAULT_INCOME_CATEGORIES = [
  { name: "Salary & Wages", icon: "💼", color: "#10b981" },
  { name: "Freelance & Projects", icon: "💻", color: "#06b6d4" },
  { name: "Investments & Dividends", icon: "📈", color: "#3b82f6" },
  { name: "Business & Sales", icon: "🏷️", color: "#8b5cf6" },
  { name: "Gifts & Allowance", icon: "🎁", color: "#ec4899" },
  { name: "Other Income", icon: "💵", color: "#64748b" }
];

// Application State
const state = {
  transactions: [],
  subscriptions: [],
  customCategories: [],
  currency: "RM",
  theme: "auto",
  activeTab: "dashboard",
  filterCategory: "ALL",
  selectedCategory: null,
  periodFilter: "THIS_MONTH",
  searchQuery: "",
  customStartDate: "",
  customEndDate: "",
  currentFormType: "expense",
  analysisGranularity: "month",
  analysisRange: 6,
  autoSweepSurplus: false,
  loans: [],
  creditCards: [],
  debitCards: [],
  bankAccounts: [],
  notifications: [],
  selectedBankId: null,
  selectedBankName: null,
  pickerTargetContext: "transaction",
  activeNotifTab: "all",
  selectedCardId: null,
  selectedCardType: null,
  selectedCardName: null,
  attachedReceipt: null,
  editAttachedReceipt: null
};

const STORAGE_KEYS = {
  tx: "expense_tracker_transactions_v1",
  currency: "expense_tracker_currency_v1",
  subs: "expense_tracker_subscriptions_v1",
  customCats: "expense_tracker_custom_categories_v1",
  theme: "expense_tracker_theme_v1",
  autoSweep: "expense_tracker_auto_sweep_v1",
  loans: "expense_tracker_loans_v1",
  cards: "expense_tracker_credit_cards_v1",
  debitCards: "expense_tracker_debit_cards_v1",
  banks: "expense_tracker_banks_v1",
  notifications: "expense_tracker_notifications_v1",
  lastSeenRelease: "expense_tracker_last_seen_release_v1",
  fabPos: "expense_tracker_fab_pos_v1"
};

// DOM Cache
const $ = (id) => document.getElementById(id);
const dom = {
  selectedCardId: $("selected-source-id"),
  selectedCardName: $("selected-source-name"),
  selectedCardType: $("selected-wallet"),
  // Safe Aliases for Property Lookups
  selectedWalletInput: $("selected-wallet"),
  cardPickerModal: $("select-card-dialog"),
  pickerAddCardBtn: $("nav-to-add-card-btn"),
  closeDebitCardBtn: $("close-debit-modal-btn"),
  cancelDebitCardBtn: $("cancel-debit-modal-btn"),
  // Income Flow DOM Elements
  categoryLabel: $("category-label"),
  expenseWalletGroup: $("expense-wallet-group"),
  incomeDepositGroup: $("income-deposit-group"),
  incomeDepositSelect: $("income-deposit-select"),
  // Bank Accounts & Picker Elements (Bug 2, 3, 4)
  openAddBankAccountBtn: $("open-add-bank-account-btn"),
  bankAccountsGrid: $("bank-accounts-grid"),
  banksTotalSummary: $("banks-total-summary"),
  bankAccountDialog: $("bank-account-dialog"),
  bankAccountForm: $("bank-account-form"),
  bankAccountEditId: $("bank-account-edit-id"),
  bankAccountName: $("bank-account-name"),
  bankAccountProvider: $("bank-account-provider"),
  closeBankModalBtn: $("close-bank-modal-btn"),
  cancelBankModalBtn: $("cancel-bank-modal-btn"),
  selectBankDialog: $("select-bank-dialog"),
  closeBankPickerBtn: $("close-bank-picker-btn"),
  cancelBankPickerBtn: $("cancel-bank-picker-btn"),
  pickerBanksList: $("picker-banks-list"),
  navToAddBankBtn: $("nav-to-add-bank-btn"),
  pillBankTx: $("pill-bank-tx"),
  pillCardTx: $("pill-card-tx"),
  pillEwalletTx: $("pill-ewallet-tx"),
  pillCashTx: $("pill-cash-tx"),
  pillBankSub: $("pill-bank-sub"),
  pillCardSub: $("pill-card-sub"),
  pillEwalletSub: $("pill-ewallet-sub"),
  subSelectedWallet: $("sub-selected-wallet"),
  subSelectedSourceId: $("sub-selected-source-id"),
  subSelectedSourceName: $("sub-selected-source-name"),
  form: $("expense-form"),
  tabExpense: $("tab-expense"),
  tabIncome: $("tab-income"),
  amount: $("amount"),
  category: $("category"),
  date: $("date"),
  note: $("note"),
  currencySelect: $("currency-select"),
  currencyDisplay: $("currency-display"),
  // Hero Two-Tone Bar
  spendableMonthLabel: $("spendable-month-label"),
  heroSpendableVal: $("hero-spendable-val"),
  heroSpendableTag: $("hero-spendable-tag"),
  heroSpentVal: $("hero-spent-val"),
  heroPoolVal: $("hero-pool-val"),
  twoToneTrack: $("two-tone-track"),
  twoToneSpentFill: $("two-tone-spent-fill"),
  gaugeSpentText: $("gauge-spent-text"),
  gaugeAvailableText: $("gauge-available-text"),
  heroFooterText: $("hero-footer-text"),
  // Monthly Cards below
  totalIncome: $("total-income"),
  incomeCount: $("income-count"),
  totalSaved: $("total-saved"),
  savingsSub: $("savings-sub"),
  totalSpend: $("total-spend"),
  txCount: $("transaction-count"),
  topCategory: $("top-category"),
  topCategoryAmt: $("top-category-amount"),
  // Donut & Breakdown
  breakdownTitle: $("breakdown-title"),
  chartPeriodBadge: $("chart-period-badge"),
  donutWrapper: $("donut-wrapper"),
  donutSegments: $("donut-segments-group"),
  donutCenter: $("donut-center-info"),
  donutLabel: $("donut-center-label"),
  donutVal: $("donut-center-val"),
  donutHint: $("donut-center-hint"),
  breakdownList: $("category-breakdown-list"),
  // Subscriptions
  subsTotalCommitment: $("subs-total-commitment"),
  subscriptionsList: $("subscriptions-list"),
  addSubBtn: $("add-sub-btn"),
  subDialog: $("sub-dialog"),
  subForm: $("sub-form"),
  subName: $("sub-name"),
  subAmount: $("sub-amount"),
  subCategory: $("sub-category"),
  subBillingDay: $("sub-billing-day"),
  subAutoDeduct: $("sub-auto-deduct"),
  subDialogCurrency: $("sub-dialog-currency"),
  cancelSubBtn: $("cancel-sub-btn"),
  // History & Filters
  txList: $("transaction-list"),
  filterCategory: $("filter-category"),
  filterPeriod: $("filter-period"),
  searchInput: $("search-input"),
  clearSearchBtn: $("clear-search-btn"),
  customDateInputs: $("custom-date-inputs"),
  customStartDate: $("custom-start-date"),
  customEndDate: $("custom-end-date"),
  clearAllBtn: $("clear-all-btn"),
  loadSampleBtn: $("load-sample-btn"),
  // Edit Dialog
  editDialog: $("edit-dialog"),
  editForm: $("edit-expense-form"),
  editTxId: $("edit-tx-id"),
  editType: $("edit-type"),
  editAmount: $("edit-amount"),
  editCategory: $("edit-category"),
  editWallet: $("edit-wallet"),
  editDate: $("edit-date"),
  editNote: $("edit-note"),
  editCurrency: $("edit-dialog-currency"),
  cancelEditBtn: $("cancel-edit-btn"),
  editAttachReceiptBtn: $("edit-attach-receipt-btn"),
  editReceiptFileInput: $("edit-receipt-file-input"),
  editReceiptPreviewBox: $("edit-receipt-preview-box"),
  editReceiptPreviewImg: $("edit-receipt-preview-img"),
  editRemoveReceiptBtn: $("edit-remove-receipt-btn"),
  // Custom Category Creator Dialog
  catCreatorDialog: $("category-creator-dialog"),
  catCreatorForm: $("category-creator-form"),
  customCatName: $("custom-cat-name"),
  customCatType: $("custom-cat-type"),
  customCatEmoji: $("custom-cat-emoji"),
  customCatColor: $("custom-cat-color"),
  cancelCatCreatorBtn: $("cancel-cat-creator-btn"),
  openCatModalBtn: $("open-cat-modal-btn"),
  customCategoriesList: $("custom-categories-list"),
  // Analysis Elements
  analysisTotalSpend: $("analysis-total-spend"),
  analysisTotalIncome: $("analysis-total-income"),
  analysisComparisonStat: $("analysis-comparison-stat"),
  analysisLineChart: $("analysis-line-chart") || $("analysis-bar-chart"),
  analysisBarChart: $("analysis-line-chart") || $("analysis-bar-chart"),
  analysisRangeSelect: $("analysis-range-select"),
  chartInteractiveLegend: $("chart-interactive-legend"),
  analysisInsightText: $("analysis-insight-text"),
  walletStatsGrid: $("wallet-stats-grid"),
  paymentSourceList: $("payment-source-list") || $("wallet-stats-grid"),
  pieChartMonthSelect: $("pie-chart-month-select"),
  categoryPieChart: $("category-pie-chart"),
  pieChartBreakdownList: $("pie-chart-breakdown-list"),
  donutCenterOverlay: $("donut-center-overlay"),
  donutCenterLabel: $("donut-center-label"),
  donutCenterTotal: $("donut-center-total"),
  analysisDonutCenterLabel: $("analysis-donut-center-label") || $("donut-center-label"),
  analysisDonutCenterTotal: $("analysis-donut-center-total") || $("donut-center-total"),
  // Settings Elements
  settingsExportCsv: $("settings-export-csv"),
  settingsExportJson: $("settings-export-json"),
  settingsImportBtn: $("settings-import-btn"),
  settingsFileInput: $("settings-file-input"),
  toggleSurplusSweep: $("toggle-surplus-sweep"),
  // Header Notification Bell
  openNotificationsBtn: $("open-notifications-btn"),
  notifBadgeCount: $("notif-badge-count"),
  // Rolling Bar DOM
  rollingNavBar: $("rolling-nav-bar"),
  rollerPrev: $("roller-prev"),
  rollerPrevText: $("roller-prev-text"),
  rollerCurrent: $("roller-current"),
  rollerNext: $("roller-next"),
  rollerNextText: $("roller-next-text"),
  // Dashboard Actions & Installments
  btnDashAddTx: $("btn-dash-add-tx"),
  btnDashAddCommit: $("btn-dash-add-commit"),
  dashboardInstallmentsList: $("dashboard-installments-list"),
  // Loans View DOM
  totalLoanDebt: $("total-loan-debt"),
  totalLoanMonthly: $("total-loan-monthly"),
  totalLoanCount: $("total-loan-count"),
  loanDsrBadge: $("loan-dsr-badge"),
  loanDsrStatus: $("loan-dsr-status"),
  // Dual-Perspective Summary DOM
  dualBudgetSum: $("dual-budget-sum"),
  dualBudgetBreakdownList: $("dual-budget-breakdown-list"),
  dualCcrisSum: $("dual-ccris-sum"),
  dualCcrisDsrVal: $("dual-ccris-dsr-val"),
  dualCcrisDsrBadge: $("dual-ccris-dsr-badge"),
  dualCcrisBreakdownList: $("dual-ccris-breakdown-list"),
  loansList: $("loans-list"),
  openAddLoanBtn: $("open-add-loan-btn"),
  loanDialog: $("loan-dialog"),
  loanForm: $("loan-form"),
  loanEditId: $("loan-edit-id"),
  loanTypeSelect: $("loan-type-select"),
  loanName: $("loan-name"),
  loanBank: $("loan-bank"),
  loanPrincipal: $("loan-principal"),
  loanRate: $("loan-rate"),
  loanRateLabel: $("loan-rate-label"),
  loanRateGroup: $("loan-rate-group"),
  rule78Callout: $("rule78-callout"),
  loanTenure: $("loan-tenure"),
  loanTenureHelper: $("loan-tenure-helper"),
  loanInstallment: $("loan-installment"),
  loanDueDay: $("loan-due-day"),
  loanLinkedBank: $("loan-linked-bank"),
  previewInstallment: $("preview-installment"),
  previewInterest: $("preview-interest"),
  previewTotalRepayable: $("preview-total-repayable"),
  cancelLoanBtn: $("cancel-loan-btn"),
  // Loan Due Dialog DOM
  loanDueDialog: $("loan-due-dialog"),
  closeLoanDueBtn: $("close-loan-due-btn"),
  loanDueTitle: $("loan-due-title"),
  loanDueSubtitle: $("loan-due-subtitle"),
  loanDueAmount: $("loan-due-amount"),
  loanDueSource: $("loan-due-source"),
  loanDueSourceBalance: $("loan-due-source-balance"),
  loanDueYesBtn: $("loan-due-yes-btn"),
  loanDueNoBtn: $("loan-due-no-btn"),
  simulatorDialog: $("simulator-dialog"),
  closeSimBtn: $("close-sim-btn"),
  simLoanTitle: $("sim-loan-title"),
  simExtraPayment: $("sim-extra-payment"),
  simTimeSaved: $("sim-time-saved"),
  simInterestSaved: $("sim-interest-saved"),
  // Credit Cards Section DOM
  cardsTotalCommitment: $("cards-total-commitment"),
  creditCardsGrid: $("credit-cards-grid"),
  openAddCardBtn: $("open-add-card-btn"),
  cardDialog: $("card-dialog"),
  closeCardModalBtn: $("close-card-modal-btn"),
  cancelCardBtn: $("cancel-card-btn"),
  cardForm: $("card-form"),
  cardEditId: $("card-edit-id"),
  cardName: $("card-name"),
  cardBank: $("card-bank"),
  cardStatementDay: $("card-statement-day"),
  cardDueDay: $("card-due-day"),
  cardLimit: $("card-limit"),
  cardBilled: $("card-billed"),
  cardUnbilled: $("card-unbilled"),
  cardPayInFull: $("card-pay-in-full"),
  cardLinkedBank: $("card-linked-bank"),
  // Debit Cards Section DOM
  debitCardsTotalSpend: $("debit-cards-total-spend"),
  debitCardsGrid: $("debit-cards-grid"),
  openAddDebitCardBtn: $("open-add-debit-card-btn"),
  debitCardDialog: $("debit-card-dialog"),
  closeDebitModalBtn: $("close-debit-modal-btn"),
  cancelDebitModalBtn: $("cancel-debit-modal-btn"),
  debitCardForm: $("debit-card-form"),
  debitCardEditId: $("debit-card-edit-id"),
  debitCardName: $("debit-card-name"),
  debitCardBank: $("debit-card-bank"),

  // Card & Bank Picker Sheets DOM
  selectCardDialog: $("select-card-dialog"),
  closeCardPickerBtn: $("close-card-picker-btn"),
  cancelCardPickerBtn: $("cancel-card-picker-btn"),
  navToAddCardBtn: $("nav-to-add-card-btn"),
  pickerCreditCardsList: $("picker-credit-cards-list"),
  pickerDebitCardsList: $("picker-debit-cards-list"),

  // Form Pill References
  pillBankTx: $("pill-bank-tx"),
  pillCardTx: $("pill-card-tx"),
  pillEwalletTx: $("pill-ewallet-tx"),
  pillCashTx: $("pill-cash-tx"),
  selectedWallet: $("selected-wallet"),
  selectedSourceId: $("selected-source-id"),
  selectedSourceName: $("selected-source-name"),
  pillBankSub: $("pill-bank-sub"),
  pillCardSub: $("pill-card-sub"),
  pillEwalletSub: $("pill-ewallet-sub"),
  subSelectedWallet: $("sub-selected-wallet"),
  subSelectedSourceId: $("sub-selected-source-id"),
  subSelectedSourceName: $("sub-selected-source-name"),
  // Notification Center DOM
  notifCenterDialog: $("notification-center-dialog"),
  closeNotifCenterBtn: $("close-notif-center-btn"),
  notificationsList: $("notifications-list"),
  clearAllNotifsBtn: $("clear-all-notifs-btn"),
  // Release Guide DOM
  releaseGuideDialog: $("release-guide-dialog"),
  closeReleaseGuideBtn: $("close-release-guide-btn"),
  confirmReleaseGuideBtn: $("confirm-release-guide-btn"),
  // Receipt Attachment DOM
  attachReceiptBtn: $("attach-receipt-btn"),
  receiptFileInput: $("receipt-file-input"),
  receiptPreviewBox: $("receipt-preview-box"),
  receiptPreviewImg: $("receipt-preview-img"),
  removeReceiptBtn: $("remove-receipt-btn"),
  receiptModal: $("receipt-modal"),
  receiptModalImg: $("receipt-modal-img"),
  receiptModalTitle: $("receipt-modal-title"),
  receiptModalDetails: $("receipt-modal-details"),
  downloadReceiptLink: $("download-receipt-link"),
  closeReceiptModalBtn: $("close-receipt-modal-btn"),
  // Movable FAB & Frosted Hub
  movableMenuBtn: $("movable-menu-btn"),
  navHubBackdrop: $("nav-hub-backdrop"),
  closeNavHubBtn: $("close-nav-hub-btn"),
  toast: $("toast")
};

// Category Lookup Helpers
function getAllCategories() {
  const expense = [...DEFAULT_EXPENSE_CATEGORIES, ...state.customCategories.filter(c => c.type === "expense")];
  const income = [...DEFAULT_INCOME_CATEGORIES, ...state.customCategories.filter(c => c.type === "income")];
  return { expense, income, all: [...expense, ...income] };
}

function getCategoryColor(name) {
  const found = getAllCategories().all.find(c => c.name === name);
  return found ? found.color : "#64748b";
}

function getCategoryIcon(name) {
  const found = getAllCategories().all.find(c => c.name === name);
  return found ? found.icon : "🏷️";
}

// Initialize Application
function init() {
  // Programmatic dialog safeguard: ensure all closed dialogs are strictly closed
  document.querySelectorAll("dialog").forEach(d => {
    if (!d.hasAttribute("open") && d.open) {
      try { d.close(); } catch(e) {}
    }
  });
  loadStorage();
  initTheme();
  setDefaultDate();
  scheduleMidnightRollover();
  initDateLifecycleListeners();
  processAutoDeductions();
  processCreditCardCycles();
  checkMonthEndSweepNotification();
  checkReleaseOnboardingGuide();
  checkLoanDueAlerts();
  populateCategorySelects();
  populateFilterCategories();
  dom.currencySelect.value = state.currency;
  dom.filterPeriod.value = state.periodFilter;
  bindEvents();
  render();
  updateRollingNavBar();
  renderDashboardInstallments();
  registerSW();
  initSwipeGestures();
  initMovableMenuFAB();
  initUniversalBackdropDismissal();
  initModalScrollLock();
  initAndroidBackNavigation();
}

// Local Timezone Helpers (Guarantees rollover at 00:00 local time)
function getLocalDateString(dateObj = new Date()) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const day = String(dateObj.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function setDefaultDate() {
  const today = getLocalDateString();
  dom.date.value = today;
  dom.date.max = today;
}

// Midnight Alarm: Automatically triggers rollover at 00:00:01 local time
function scheduleMidnightRollover() {
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
  const msUntilMidnight = Math.max(1000, tomorrow.getTime() - now.getTime());

  setTimeout(() => {
    setDefaultDate();
    processAutoDeductions();
    checkMonthEndSweepNotification();
    render();
    scheduleMidnightRollover();
  }, msUntilMidnight);
}

// Phone Resume Listeners: Checks for new day whenever phone is unlocked or app reopened
function initDateLifecycleListeners() {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      setDefaultDate();
      processAutoDeductions();
      checkMonthEndSweepNotification();
      checkLoanDueAlerts();
      render();
    }
  });
  window.addEventListener("focus", () => {
    setDefaultDate();
    render();
  });
}

// Local Storage
function loadStorage() {
  try {
    const tx = localStorage.getItem(STORAGE_KEYS.tx);
    if (tx) {
      state.transactions = JSON.parse(tx);
      // Auto-heal legacy sample transactions to link to specific accounts
      state.transactions.forEach(t => {
        const noteLower = (t.note || "").toLowerCase();
        if (t.wallet === "Bank Account") t.wallet = "Bank Transfer";
        if (!t.cardName && !t.cardId) {
          if (noteLower.includes("salary")) {
            t.wallet = "Bank Transfer";
            t.cardId = "bank_public";
            t.cardName = "Public Bank Salary Account";
          } else if (noteLower.includes("rent") || noteLower.includes("fibre") || noteLower.includes("deposit")) {
            t.wallet = "Bank Transfer";
            t.cardId = "bank_maybank";
            t.cardName = "Maybank Savings";
          } else if (noteLower.includes("car loan")) {
            t.wallet = "Bank Transfer";
            t.cardId = "bank_public";
            t.cardName = "Public Bank Salary Account";
          } else if (noteLower.includes("petrol") || noteLower.includes("spotify") || noteLower.includes("cafe")) {
            t.wallet = "Credit Card";
            t.cardId = "card_maybank";
            t.cardName = "Maybank Visa Signature";
            t.cardType = "credit";
          } else if (noteLower.includes("lotus")) {
            t.wallet = "Debit Card";
            t.cardId = "debit_maybank";
            t.cardName = "Maybank Visa Debit";
            t.cardType = "debit";
          }
        }
      });
    }
    const curr = localStorage.getItem(STORAGE_KEYS.currency);
    if (curr) state.currency = curr;
    const subs = localStorage.getItem(STORAGE_KEYS.subs);
    if (subs) {
      state.subscriptions = JSON.parse(subs);
      // Auto-heal legacy subscriptions to link them to specific accounts
      state.subscriptions.forEach(sub => {
        if (!sub.sourceName && sub.cardName) sub.sourceName = sub.cardName;
        if (sub.wallet === "Bank Account") sub.wallet = "Bank Transfer";
        const nameLower = (sub.name || "").toLowerCase();
        if (!sub.sourceName) {
          if (sub.id === "sub_rent" || nameLower.includes("rent") || sub.id === "sub_wifi" || nameLower.includes("fibre")) {
            sub.wallet = "Bank Transfer";
            sub.sourceId = "bank_maybank";
            sub.sourceName = "Maybank Savings";
          } else if (sub.id === "sub_car" || nameLower.includes("car loan")) {
            sub.wallet = "Bank Transfer";
            sub.sourceId = "bank_public";
            sub.sourceName = "Public Bank Salary Account";
          } else if (sub.id === "sub_spotify" || nameLower.includes("spotify") || nameLower.includes("netifli") || nameLower.includes("netflix")) {
            sub.wallet = "Credit Card";
            sub.sourceId = "card_maybank";
            sub.sourceName = "Maybank Visa Signature";
          }
        }
      });
    }
    const cats = localStorage.getItem(STORAGE_KEYS.customCats);
    if (cats) state.customCategories = JSON.parse(cats);
    const th = localStorage.getItem(STORAGE_KEYS.theme);
    if (th) state.theme = th;
    const swp = localStorage.getItem(STORAGE_KEYS.autoSweep);
    if (swp !== null) state.autoSweepSurplus = (swp === "true");
    const ln = localStorage.getItem(STORAGE_KEYS.loans);
    if (ln) state.loans = JSON.parse(ln);
    const cd = localStorage.getItem(STORAGE_KEYS.cards);
    if (cd) state.creditCards = JSON.parse(cd);
    const dcd = localStorage.getItem(STORAGE_KEYS.debitCards);
    if (dcd) state.debitCards = JSON.parse(dcd);
    const bks = localStorage.getItem(STORAGE_KEYS.banks);
    if (bks) {
      state.bankAccounts = JSON.parse(bks);
      state.bankAccounts.forEach(b => {
        if (b.initialBalance === undefined || b.initialBalance === null) {
          b.initialBalance = b.balance || 0;
        }
      });
    }
    const nt = localStorage.getItem(STORAGE_KEYS.notifications);
    if (nt) state.notifications = JSON.parse(nt);
  } catch (e) {
    state.transactions = [];
  }
}

function saveStorage() {
  try {
    localStorage.setItem(STORAGE_KEYS.tx, JSON.stringify(state.transactions));
    localStorage.setItem(STORAGE_KEYS.currency, state.currency);
    localStorage.setItem(STORAGE_KEYS.subs, JSON.stringify(state.subscriptions));
    localStorage.setItem(STORAGE_KEYS.customCats, JSON.stringify(state.customCategories));
    localStorage.setItem(STORAGE_KEYS.theme, state.theme);
    localStorage.setItem(STORAGE_KEYS.autoSweep, state.autoSweepSurplus ? "true" : "false");
    localStorage.setItem(STORAGE_KEYS.loans, JSON.stringify(state.loans));
    localStorage.setItem(STORAGE_KEYS.cards, JSON.stringify(state.creditCards));
    localStorage.setItem(STORAGE_KEYS.debitCards, JSON.stringify(state.debitCards));
    localStorage.setItem(STORAGE_KEYS.banks, JSON.stringify(state.bankAccounts));
    localStorage.setItem(STORAGE_KEYS.notifications, JSON.stringify(state.notifications));
  } catch (e) {
    // iOS Safari 5MB QuotaExceededError Recovery Safeguard
    if (e.name === "QuotaExceededError" || e.code === 22 || e.code === 1014) {
      let freed = false;
      for (let i = state.transactions.length - 1; i >= 0; i--) {
        if (state.transactions[i].receiptImage) {
          state.transactions[i].receiptImage = null;
          freed = true;
          break;
        }
      }
      if (freed) {
        try {
          localStorage.setItem(STORAGE_KEYS.tx, JSON.stringify(state.transactions));
          showToast("Storage quota nearly full. Pruned oldest receipt to preserve ledger.");
        } catch (retryErr) {}
      } else {
        showToast("Storage quota full! Export a JSON backup to clear old records.");
      }
    }
  }
}


// Wallet Helpers (Queue Item 1)
function getWalletIcon(wallet) {
  if (!wallet) return "🏦";
  if (wallet.includes("Card")) return "💳";
  if (wallet.includes("E-Wallet")) return "📱";
  if (wallet.includes("Cash")) return "💵";
  return "🏦";
}

// Client-Side Smart Image Compression (Compresses camera photos to ~50KB to prevent local storage bloat)
function compressReceiptPhoto(file, callback) {
  if (!file || !file.type.startsWith("image/")) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 800; // Optimal resolution for clear text reading while keeping file size tiny
      let w = img.width;
      let h = img.height;

      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);

      const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.72);
      callback(compressedDataUrl);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// Receipt Full-Screen Inspection Modal
function viewReceiptModal(txId) {
  const tx = state.transactions.find(t => t.id === txId);
  if (!tx || !tx.receiptImage) return;

  dom.receiptModalImg.src = tx.receiptImage;
  dom.receiptModalTitle.textContent = `${tx.category} Photo / Receipt`;
  dom.receiptModalDetails.textContent = `${formatDate(tx.date)} • ${formatCurrency(tx.amount)} • ${tx.note}`;
  dom.downloadReceiptLink.href = tx.receiptImage;
  dom.downloadReceiptLink.download = `receipt_${tx.date}_${tx.category.replace(/\s+/g, "_")}.jpg`;

  dom.receiptModal?.showModal ? dom.receiptModal.showModal() : window.open(tx.receiptImage);
}

const formatCurrency = (amt) => `${state.currency} ${(Number(amt) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function formatDate(ds) {
  if (!ds) return "—";
  const [y, m, d] = ds.split("-");
  return (!y || !m || !d) ? ds : new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

let toastTimer;
function showToast(msg) {
  if (!dom.toast) return;
  dom.toast.textContent = msg;
  dom.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => dom.toast.classList.remove("show"), 2600);
}

// Theme Handling (Option 7)
function initTheme() {
  applyTheme(state.theme);
  document.querySelectorAll(".theme-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.theme === state.theme);
  });
  try {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if (state.theme === "auto") {
        applyTheme("auto");
      }
    });
  } catch (e) {}
}

function applyTheme(theme) {
  state.theme = theme;
  saveStorage();
  let effectiveTheme = theme;
  if (theme === "auto") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    effectiveTheme = prefersDark ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", effectiveTheme);
  } else {
    document.documentElement.setAttribute("data-theme", theme);
  }

  // Synchronize system status bar theme-color for Android & mobile PWA
  const statusColor = effectiveTheme === "dark" ? "#0b0f19" : "#f8fafc";
  let metaTheme = document.getElementById("theme-color-meta") || document.querySelector('meta[name="theme-color"]:not([media])');
  if (!metaTheme && typeof document !== "undefined" && document.head) {
    metaTheme = document.createElement("meta");
    metaTheme.setAttribute("name", "theme-color");
    metaTheme.setAttribute("id", "theme-color-meta");
    document.head.appendChild(metaTheme);
  }
  if (metaTheme) {
    metaTheme.setAttribute("content", statusColor);
  }
  const mediaThemes = document.querySelectorAll('meta[name="theme-color"][media]');
  mediaThemes.forEach(m => {
    const media = m.getAttribute("media") || "";
    if (media.includes("light")) {
      m.setAttribute("content", effectiveTheme === "dark" ? "#0b0f19" : "#f8fafc");
    } else if (media.includes("dark")) {
      m.setAttribute("content", effectiveTheme === "dark" ? "#0b0f19" : "#f8fafc");
    }
  });
}

// Navigation Tabs Router (Direction-Aware Slide & Haptic)
const TAB_ORDER = ["commitments", "transactions", "dashboard", "analysis", "settings"];

function switchTab(tabName, direction = null) {
  if (state.activeTab === tabName) return;

  const prevIdx = TAB_ORDER.indexOf(state.activeTab);
  const nextIdx = TAB_ORDER.indexOf(tabName);
  const effectiveDirection = direction || (nextIdx > prevIdx ? "forward" : "backward");

  state.activeTab = tabName;

  document.querySelectorAll(".app-view").forEach(v => {
    v.classList.remove("active", "slide-from-right", "slide-from-left");
  });

  const targetView = $(`view-${tabName}`);
  if (targetView) {
    targetView.classList.add("active");
    if (effectiveDirection === "forward") {
      targetView.classList.add("slide-from-right");
    } else if (effectiveDirection === "backward") {
      targetView.classList.add("slide-from-left");
    }
  }

  // Update nav buttons
  document.querySelectorAll(".nav-tab-btn, .mobile-nav-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.tab === tabName);
  });

  window.scrollTo({ top: 0, behavior: "smooth" });

  // Light haptic feedback if supported on mobile
  if (typeof navigator.vibrate === "function") {
    try { navigator.vibrate(12); } catch (e) {}
  }

  updateRollingNavBar();

  if (tabName === "commitments") {
    renderSubscriptions();
    renderCreditCards();
    renderDebitCards();
    renderLoans();
  } else if (tabName === "transactions") {
    renderTransactionList();
  } else if (tabName === "dashboard") {
    renderHeroSpendableGaugeAndMetrics();
    renderBreakdown();
    renderDashboardInstallments();
  } else if (tabName === "analysis") {
    renderAnalysis();
    renderAnalysisPieChart();
  } else if (tabName === "settings") {
    renderSettings();
  }
}

// Dynamic Rolling Header Carousel Engine
function updateRollingNavBar() {
  const currentTab = state.activeTab || "dashboard";
  const idx = TAB_ORDER.indexOf(currentTab);

  if (dom.rollerCurrent) {
    dom.rollerCurrent.textContent = currentTab.toUpperCase();
    // Re-trigger scale-in animation (small to big)
    dom.rollerCurrent.classList.remove("scale-animate");
    void dom.rollerCurrent.offsetWidth; // force reflow
    dom.rollerCurrent.classList.add("scale-animate");
  }

  // Previous Page Side Indicator
  if (dom.rollerPrev && dom.rollerPrevText) {
    if (idx > 0) {
      dom.rollerPrev.style.visibility = "visible";
      dom.rollerPrevText.textContent = TAB_ORDER[idx - 1].toUpperCase();
    } else {
      dom.rollerPrev.style.visibility = "hidden";
      dom.rollerPrevText.textContent = "";
    }
  }

  // Next Page Side Indicator
  if (dom.rollerNext && dom.rollerNextText) {
    if (idx < TAB_ORDER.length - 1) {
      dom.rollerNext.style.visibility = "visible";
      dom.rollerNextText.textContent = TAB_ORDER[idx + 1].toUpperCase();
    } else {
      dom.rollerNext.style.visibility = "hidden";
      dom.rollerNextText.textContent = "";
    }
  }
}

// Touch Swipe Gesture Handler (Dashboard <-> Analysis <-> Settings)

// Movable Floating Action Button & Frosted Glass Hub (Rock-Solid Tap & 1.5s Long-Press Drag)
function initMovableMenuFAB() {
  const fab = dom.movableMenuBtn;
  if (!fab) return;

  // Restore saved position
  try {
    const savedPos = localStorage.getItem(STORAGE_KEYS.fabPos);
    if (savedPos) {
      const { left, top } = JSON.parse(savedPos);
      if (left !== undefined && top !== undefined && left < window.innerWidth && top < window.innerHeight) {
        fab.style.left = `${left}px`;
        fab.style.top = `${top}px`;
        fab.style.bottom = "auto";
      }
    }
  } catch (e) {}

  let longPressTimer = null;
  let isDragActive = false;
  let wasDragged = false;
  let startX = 0, startY = 0;
  let initialLeft = 0, initialTop = 0;

  const onPointerDown = (e) => {
    isDragActive = false;
    wasDragged = false;

    startX = e.clientX;
    startY = e.clientY;

    const rect = fab.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;

    clearTimeout(longPressTimer);

    // 1.5s hold threshold to unlock dragging
    longPressTimer = setTimeout(() => {
      isDragActive = true;
      wasDragged = true;
      fab.classList.add("drag-ready");

      if (typeof navigator.vibrate === "function") {
        try { navigator.vibrate([35, 40, 35]); } catch (err) {}
      }

      showToast("Ready to move! Drag to reposition.");
    }, 1500);
  };

  const onPointerMove = (e) => {
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    // If moved before 1.5s hold completed, cancel long-press
    if (!isDragActive) {
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        clearTimeout(longPressTimer);
      }
      return;
    }

    // Dragging mode active
    wasDragged = true;
    const newLeft = Math.max(10, Math.min(window.innerWidth - 62, initialLeft + dx));
    const newTop = Math.max(50, Math.min(window.innerHeight - 70, initialTop + dy));

    fab.style.left = `${newLeft}px`;
    fab.style.top = `${newTop}px`;
    fab.style.bottom = "auto";
  };

  const onPointerUp = () => {
    clearTimeout(longPressTimer);

    if (isDragActive) {
      fab.classList.remove("drag-ready");
      isDragActive = false;

      // Save position
      const rect = fab.getBoundingClientRect();
      localStorage.setItem(STORAGE_KEYS.fabPos, JSON.stringify({ left: rect.left, top: rect.top }));
    }
  };

  fab.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);

  // Native click event: 100% reliable on iOS & Android on a normal single tap!
  fab.addEventListener("click", (e) => {
    e.preventDefault();
    if (wasDragged) {
      wasDragged = false;
      return; // Do not open menu if user just finished dragging
    }
    openNavHub();
  });

  // Hub Close Listeners
  if (dom.closeNavHubBtn) {
    dom.closeNavHubBtn.addEventListener("click", closeNavHub);
  }

  if (dom.navHubBackdrop) {
    dom.navHubBackdrop.addEventListener("click", (e) => {
      if (e.target === dom.navHubBackdrop) closeNavHub();
    });
  }

  // Hub Item Click Listeners (2x2 Grid)
  document.querySelectorAll(".hub-item-card").forEach(card => {
    card.addEventListener("click", () => {
      const tab = card.dataset.tab;
      document.querySelectorAll(".hub-item-card").forEach(c => c.classList.remove("active"));
      card.classList.add("active");
      closeNavHub();
      switchTab(tab);
    });
  });
}

function openNavHub() {
  if (!dom.navHubBackdrop) return;
  document.querySelectorAll(".hub-item-card").forEach(c => {
    c.classList.toggle("active", c.dataset.tab === state.activeTab);
  });
  dom.navHubBackdrop.style.display = "flex";
}

function closeNavHub() {
  if (dom.navHubBackdrop) dom.navHubBackdrop.style.display = "none";
}


// Universal Click-Outside Backdrop Dismissal for ALL Modals (iOS & Android)
// Modal Scroll Lock Engine (Prevents background rubber-band scroll bleed on iOS Safari)
// Android System Back Button & Modal History Navigation Controller
function initAndroidBackNavigation() {
  let isClosingFromPopState = false;

  const pushModalHistory = (identifier) => {
    try {
      history.pushState({ modalOpen: true, modalId: identifier }, "");
    } catch (e) {}
  };

  // Observe all dialogs opening/closing
  const observer = new MutationObserver((mutations) => {
    mutations.forEach(m => {
      if (m.type === "attributes" && m.attributeName === "open") {
        const dialog = m.target;
        if (dialog.hasAttribute("open") || dialog.open) {
          pushModalHistory(dialog.id || "dialog");
        }
      }
    });
  });

  document.querySelectorAll("dialog").forEach(d => {
    observer.observe(d, { attributes: true, attributeFilter: ["open"] });
    d.addEventListener("close", () => {
      if (!isClosingFromPopState) {
        if (history.state && history.state.modalOpen) {
          try { history.back(); } catch (e) {}
        }
      }
    });
  });

  // Handle dynamic Nav Hub
  if (dom.movableMenuBtn) {
    const origOpenNavHub = openNavHub;
    openNavHub = function() {
      origOpenNavHub();
      pushModalHistory("nav-hub");
    };
    const origCloseNavHub = closeNavHub;
    closeNavHub = function() {
      origCloseNavHub();
      if (!isClosingFromPopState) {
        if (history.state && history.state.modalOpen) {
          try { history.back(); } catch (e) {}
        }
      }
    };
  }

  // Handle hardware / gesture back navigation on Android
  window.addEventListener("popstate", () => {
    isClosingFromPopState = true;
    try {
      // 1. Close Nav Hub if active
      if (dom.navHubBackdrop && (dom.navHubBackdrop.style.display === "flex" || dom.navHubBackdrop.style.display === "block")) {
        closeNavHub();
        return;
      }
      // 2. Close topmost open dialog
      const openDialogs = Array.from(document.querySelectorAll("dialog")).filter(d => d.open || d.hasAttribute("open"));
      if (openDialogs.length > 0) {
        const topDialog = openDialogs[openDialogs.length - 1];
        try { topDialog.close(); } catch (err) {}
      }
    } finally {
      isClosingFromPopState = false;
    }
  });
}

function initModalScrollLock() {
  const syncBodyScrollLock = () => {
    const hasOpenDialog = Array.from(document.querySelectorAll("dialog")).some(d => d.open || d.hasAttribute("open"));
    if (hasOpenDialog) {
      document.body.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
    }
  };

  document.querySelectorAll("dialog").forEach(dialog => {
    dialog.addEventListener("close", syncBodyScrollLock);
    dialog.addEventListener("cancel", syncBodyScrollLock);
  });

  const observer = new MutationObserver(syncBodyScrollLock);
  document.querySelectorAll("dialog").forEach(dialog => {
    observer.observe(dialog, { attributes: true, attributeFilter: ["open"] });
  });
}

function initUniversalBackdropDismissal() {
  document.querySelectorAll("dialog").forEach(dialog => {
    dialog.addEventListener("click", (e) => {
      // If clicking directly on the native <dialog> backdrop
      if (e.target === dialog) {
        dialog.close();
      }
    });
  });
}

function initSwipeGestures() {
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;
  let isIgnoredTarget = false;

  document.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
    touchStartTime = Date.now();

    // Ignore touches starting inside inputs, charts with horizontal scroll, open dialogs,
    // or within 25px of the screen edge to preserve native iOS Safari Back/Forward navigation
    const isNearEdge = touchStartX < 25 || touchStartX > (window.innerWidth - 25);
    const target = e.target;
    isIgnoredTarget = isNearEdge || !!target.closest("input, select, textarea, dialog[open], .emoji-btn, .color-swatch-btn, .movable-menu-fab, .wallet-pill-group, .chart-scroll-container, .line-chart-wrapper, .donut-wrapper, .donut-chart-wrapper, .chart-hover-zone");
  }, { passive: true });

  document.addEventListener("touchend", (e) => {
    if (isIgnoredTarget || e.changedTouches.length !== 1) return;

    const t = e.changedTouches[0];
    const diffX = t.clientX - touchStartX;
    const diffY = t.clientY - touchStartY;
    const timeTaken = Date.now() - touchStartTime;

    // Conditions: at least 50px distance, quick swipe (< 500ms), and predominantly horizontal (|dx| > 1.8 * |dy|)
    if (Math.abs(diffX) >= 50 && Math.abs(diffX) > Math.abs(diffY) * 1.8 && timeTaken <= 500) {
      const currentIdx = TAB_ORDER.indexOf(state.activeTab);

      if (diffX < 0) {
        // Swiped Left (Finger moved right to left) -> Next tab
        if (currentIdx < TAB_ORDER.length - 1) {
          switchTab(TAB_ORDER[currentIdx + 1], "forward");
        }
      } else {
        // Swiped Right (Finger moved left to right) -> Previous tab
        if (currentIdx > 0) {
          switchTab(TAB_ORDER[currentIdx - 1], "backward");
        }
      }
    }
  }, { passive: true });
}

// Category Dropdown Population (Includes Option 7C "Custom Category➕")
function populateCategorySelects(isIncome = (state.currentFormType === "income"), targetEl = dom.category) {
  const cats = getAllCategories();
  const list = isIncome ? cats.income : cats.expense;

  let optionsHtml = `<option value="" disabled selected>Select category</option>`;
  optionsHtml += list.map(c => `<option value="${c.name}">${c.icon} ${c.name}</option>`).join("");
  optionsHtml += `<option value="__ADD_CUSTOM__" style="color:var(--primary); font-weight:700;">➕ Custom Category...</option>`;

  targetEl.innerHTML = optionsHtml;
}

function populateFilterCategories() {
  const cats = getAllCategories();
  dom.filterCategory.innerHTML = `<option value="ALL">All Categories</option>` +
    cats.all.map(c => `<option value="${c.name}">${c.icon} ${c.name}</option>`).join("");
}

// Event Bindings
function bindEvents() {
  // Navigation Tabs (Desktop & Mobile)
  document.querySelectorAll(".nav-tab-btn, .mobile-nav-btn").forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  // Type Toggle Tabs
  dom.tabExpense.addEventListener("click", () => setFormType("expense"));
  dom.tabIncome.addEventListener("click", () => setFormType("income"));

  // Category select intercept for "Custom Category..."
  dom.category.addEventListener("change", (e) => {
    if (e.target.value === "__ADD_CUSTOM__") {
      openCategoryCreatorModal(state.currentFormType);
      dom.category.value = "";
    }
  });

  dom.editCategory.addEventListener("change", (e) => {
    if (e.target.value === "__ADD_CUSTOM__") {
      openCategoryCreatorModal(dom.editType.value);
      dom.editCategory.value = "";
    }
  });

  dom.form.addEventListener("submit", handleAddTransaction);

  dom.currencySelect.addEventListener("change", (e) => {
    state.currency = e.target.value;
    saveStorage();
    render();
    showToast(`Currency set to ${state.currency}`);
  });

  dom.filterCategory.addEventListener("change", (e) => {
    e.target.value === "ALL" ? deselectCategory() : selectCategory(e.target.value);
  });

  // Loans Modal & Simulator Event Listeners
  if (dom.openAddLoanBtn) {
    dom.openAddLoanBtn.addEventListener("click", () => {
      openAddLoanModal();
    });
  }

  if (dom.cancelLoanBtn) dom.cancelLoanBtn.addEventListener("click", () => dom.loanDialog.close());
  const closeLoanModalBtn = document.getElementById("close-loan-modal-btn");
  if (closeLoanModalBtn) closeLoanModalBtn.addEventListener("click", () => dom.loanDialog.close());
  if (dom.loanForm) dom.loanForm.addEventListener("submit", handleSaveNewLoan);
  if (dom.closeSimBtn) dom.closeSimBtn.addEventListener("click", () => dom.simulatorDialog.close());

  if (dom.loanPrincipal) dom.loanPrincipal.addEventListener("input", updateLoanLivePreview);
  if (dom.loanRate) dom.loanRate.addEventListener("input", updateLoanLivePreview);
  if (dom.loanTenure) dom.loanTenure.addEventListener("input", updateLoanLivePreview);
  if (dom.loanTypeSelect) dom.loanTypeSelect.addEventListener("change", updateLoanFormMechanismConditioning);

  // Loan Due Dialog Listeners (Yes / No Flow)
  if (dom.closeLoanDueBtn) dom.closeLoanDueBtn.addEventListener("click", () => dom.loanDueDialog?.close());
  if (dom.loanDueNoBtn) {
    dom.loanDueNoBtn.addEventListener("click", () => {
      if (activeDueLoan) {
        const currentYm = getLocalDateString().substring(0, 7);
        sessionStorage.setItem("dismissed_loan_prompt_" + activeDueLoan.id + "_" + currentYm, "true");
      }
      dom.loanDueDialog?.close();
      showToast("Installment reminder kept in Notification Center.");
    });
  }
  if (dom.loanDueYesBtn) {
    dom.loanDueYesBtn.addEventListener("click", () => {
      if (activeDueLoan) {
        const currentYm = getLocalDateString().substring(0, 7);
        const notifId = "notif_due_loan_" + activeDueLoan.id + "_" + currentYm;
        const notif = state.notifications.find(n => n.id === notifId);
        if (processLoanPayment(activeDueLoan, activeDueLoan.monthlyInstallment)) {
          if (notif) {
            notif.decision = `Paid ${formatCurrency(activeDueLoan.monthlyInstallment)} on ${new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
            notif.isRead = true;
          }
          saveStorage();
          render();
        }
        dom.loanDueDialog?.close();
      }
    });
  }
  if (dom.simExtraPayment) dom.simExtraPayment.addEventListener("input", calculateSimResults);

  dom.clearAllBtn.addEventListener("click", () => {
    if (!state.transactions.length) return showToast("No records to clear.");
    if (confirm("Delete all logged transactions? This cannot be undone.")) {
      state.transactions = [];
      // Synchronize all sources to Single Source of Truth
      state.debitCards.forEach(dc => { dc.totalSpentThisMonth = 0.00; });
      state.creditCards.forEach(c => { c.unbilledBalance = 0.00; });
      state.bankAccounts.forEach(b => {
        if (b.initialBalance !== undefined && b.initialBalance !== null) {
          b.balance = b.initialBalance;
        }
      });
      deselectCategory();
      saveStorage();
      render();
      showToast("All records cleared and balances reconciled.");
    }
  });

  dom.loadSampleBtn.addEventListener("click", loadSampleData);

  // Header Notification Bell Click
  if (dom.openNotificationsBtn) {
    dom.openNotificationsBtn.addEventListener("click", () => {
      renderNotificationsFeed();
      dom.notifCenterDialog?.showModal ? dom.notifCenterDialog.showModal() : alert("Notification Center");
    });
  }

  if (dom.closeNotifCenterBtn) {
    dom.closeNotifCenterBtn.addEventListener("click", () => dom.notifCenterDialog.close());
  }

  // Notification Filter Tabs
  document.querySelectorAll(".notif-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".notif-tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.activeNotifTab = btn.dataset.notifTab;
      renderNotificationsFeed();
    });
  });

  if (dom.clearAllNotifsBtn) {
    dom.clearAllNotifsBtn.addEventListener("click", () => {
      state.notifications.forEach(n => n.isRead = true);
      saveStorage();
      updateNotificationBadge();
      renderNotificationsFeed();
      showToast("Marked all notifications as read.");
    });
  }


  // Credit Card Modal Handlers
  if (dom.openAddCardBtn) {
    dom.openAddCardBtn.addEventListener("click", () => {
      dom.cardEditId.value = "";
      dom.cardName.value = "";
      dom.cardBank.value = "Maybank";
      dom.cardStatementDay.value = "25";
      dom.cardDueDay.value = "15";
      dom.cardLimit.value = "10000";
      dom.cardBilled.value = "0.00";
      dom.cardUnbilled.value = "0.00";
      dom.cardPayInFull.checked = true;
      populateCardLinkedBankSelect();
      $("card-modal-title").textContent = "Add New Credit Card";
      dom.cardDialog?.showModal ? dom.cardDialog.showModal() : alert("Add card dialog");
    });
  }

  if (dom.closeCardModalBtn) dom.closeCardModalBtn.addEventListener("click", () => dom.cardDialog.close());
  if (dom.cancelCardBtn) dom.cancelCardBtn.addEventListener("click", () => dom.cardDialog.close());
  if (dom.cardForm) dom.cardForm.addEventListener("submit", handleSaveCreditCard);

  // Release Guide Modal Handlers: Mark as seen and keep permanently archived in Notification Center
  const closeGuide = () => {
    const latestRelease = APP_RELEASES_REGISTRY[0];
    localStorage.setItem(STORAGE_KEYS.lastSeenRelease, latestRelease.version);

    // Ensure notification exists and mark as read
    const notifId = "notif_release_" + latestRelease.version;
    const notif = state.notifications.find(n => n.id === notifId);
    if (notif) {
      notif.isRead = true;
    } else {
      state.notifications.unshift({
        id: notifId,
        type: "guide",
        title: `🎉 ${latestRelease.title}`,
        time: new Date().toISOString(),
        isRead: true,
        body: latestRelease.features.join(" • ")
      });
    }

    saveStorage();
    updateNotificationBadge();
    renderNotificationsFeed();
    dom.releaseGuideDialog?.close();
  };

  if (dom.confirmReleaseGuideBtn) dom.confirmReleaseGuideBtn.addEventListener("click", closeGuide);
  if (dom.closeReleaseGuideBtn) dom.closeReleaseGuideBtn.addEventListener("click", closeGuide);

  // Rolling Navigation Bar Carousel Clicks
  if (dom.rollerPrev) {
    dom.rollerPrev.addEventListener("click", () => {
      const idx = TAB_ORDER.indexOf(state.activeTab);
      if (idx > 0) switchTab(TAB_ORDER[idx - 1], "backward");
    });
  }

  if (dom.rollerNext) {
    dom.rollerNext.addEventListener("click", () => {
      const idx = TAB_ORDER.indexOf(state.activeTab);
      if (idx < TAB_ORDER.length - 1) switchTab(TAB_ORDER[idx + 1], "forward");
    });
  }

  // Dashboard Primary Action Buttons (Option 1 Gradients)
  if (dom.btnDashAddTx) {
    dom.btnDashAddTx.addEventListener("click", () => {
      switchTab("transactions", "backward");
      setTimeout(() => { dom.amount?.focus(); }, 250);
    });
  }

  if (dom.btnDashAddCommit) {
    dom.btnDashAddCommit.addEventListener("click", () => {
      switchTab("commitments", "backward");
    });
  }

  // Analysis Pie Chart Month Select
  if (dom.pieChartMonthSelect) {
    dom.pieChartMonthSelect.addEventListener("change", (e) => {
      selectedPieMonth = e.target.value;
      renderAnalysisPieChart();
    });
  }

  // Search & Period Listeners
  dom.searchInput.addEventListener("input", (e) => {
    state.searchQuery = e.target.value.trim().toLowerCase();
    dom.clearSearchBtn.style.display = state.searchQuery ? "block" : "none";
    renderTransactionList();
  });

  dom.clearSearchBtn.addEventListener("click", () => {
    dom.searchInput.value = "";
    state.searchQuery = "";
    dom.clearSearchBtn.style.display = "none";
    renderTransactionList();
  });

  dom.filterPeriod.addEventListener("change", (e) => {
    state.periodFilter = e.target.value;
    dom.customDateInputs.style.display = state.periodFilter === "CUSTOM" ? "flex" : "none";
    render();
  });

  dom.customStartDate.addEventListener("change", (e) => {
    state.customStartDate = e.target.value;
    if (state.periodFilter === "CUSTOM") render();
  });

  dom.customEndDate.addEventListener("change", (e) => {
    state.customEndDate = e.target.value;
    if (state.periodFilter === "CUSTOM") render();
  });

  // Donut center tap to deselect
  dom.donutCenter.addEventListener("click", (e) => {
    e.stopPropagation();
    if (state.selectedCategory) deselectCategory();
  });

  // Edit Dialog Listeners
  dom.cancelEditBtn.addEventListener("click", () => dom.editDialog.close());
  dom.editForm.addEventListener("submit", handleSaveEdit);
  dom.editType.addEventListener("change", (e) => {
    populateCategorySelects(e.target.value === "income", dom.editCategory);
  });

  // Subscriptions Listeners
  dom.addSubBtn.addEventListener("click", () => {
    populateCategorySelects(false, dom.subCategory);
    dom.subName.value = "";
    dom.subAmount.value = "";
    dom.subBillingDay.value = "";
    dom.subDialogCurrency.textContent = state.currency;
    if (dom.subSelectedWallet) dom.subSelectedWallet.value = "Bank Transfer";
    if (dom.subSelectedSourceId) dom.subSelectedSourceId.value = "";
    if (dom.subSelectedSourceName) dom.subSelectedSourceName.value = "";
    if (dom.pillBankSub) dom.pillBankSub.textContent = "🏦 Bank Transfer ▾";
    if (dom.pillCardSub) dom.pillCardSub.textContent = "💳 Card ▾";
    document.querySelectorAll("#sub-wallet-pill-group .wallet-pill-btn").forEach(b => b.classList.remove("active"));
    if (dom.pillBankSub) dom.pillBankSub.classList.add("active");
    dom.subDialog?.showModal ? dom.subDialog.showModal() : promptSubFallback();
  });

  dom.cancelSubBtn.addEventListener("click", () => dom.subDialog.close());
  dom.subForm.addEventListener("submit", handleAddSubscription);

  // Custom Category Creator Dialog Listeners (Option 7C)
  dom.openCatModalBtn.addEventListener("click", () => openCategoryCreatorModal("expense"));
  dom.cancelCatCreatorBtn.addEventListener("click", () => dom.catCreatorDialog.close());
  dom.catCreatorForm.addEventListener("submit", handleSaveCustomCategory);

  document.querySelectorAll(".emoji-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".emoji-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      dom.customCatEmoji.value = btn.dataset.emoji;
    });
  });

  document.querySelectorAll(".color-swatch-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".color-swatch-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      dom.customCatColor.value = btn.dataset.color;
    });
  });

  // Analysis Range Dropdown Listener (Dual-Line Trajectory)
  if (dom.analysisRangeSelect) {
    dom.analysisRangeSelect.addEventListener("change", (e) => {
      state.analysisRange = parseInt(e.target.value, 10) || 6;
      renderAnalysis();
    });
  }

  // Analysis Granularity Switcher (Fallback / Legacy)
  document.querySelectorAll(".gran-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".gran-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.analysisGranularity = btn.dataset.gran;
      renderAnalysis();
    });
  });

  // ================= WALLET & PAYMENT METHOD LISTENERS (BUGS 3 & 4) =================
  // Transaction Form Payment Method Selection
  if (dom.pillBankTx) {
    dom.pillBankTx.addEventListener("click", () => {
      state.pickerTargetContext = "transaction";
      openBankPicker();
    });
  }
  if (dom.pillCardTx) {
    dom.pillCardTx.addEventListener("click", () => {
      state.pickerTargetContext = "transaction";
      openCardPicker();
    });
  }
  if (dom.pillEwalletTx) {
    dom.pillEwalletTx.addEventListener("click", () => {
      document.querySelectorAll("#wallet-pill-group .wallet-pill-btn").forEach(b => b.classList.remove("active"));
      dom.pillEwalletTx.classList.add("active");
      if (dom.selectedWallet) dom.selectedWallet.value = "E-Wallet";
      if (dom.selectedSourceId) dom.selectedSourceId.value = "";
      if (dom.selectedSourceName) dom.selectedSourceName.value = "";
      if (dom.pillBankTx) dom.pillBankTx.textContent = "🏦 Bank Transfer ▾";
      if (dom.pillCardTx) dom.pillCardTx.textContent = "💳 Card ▾";
      state.selectedCardId = null;
      state.selectedCardType = null;
      state.selectedCardName = null;
      state.selectedBankId = null;
      state.selectedBankName = null;
    });
  }
  if (dom.pillCashTx) {
    dom.pillCashTx.addEventListener("click", () => {
      document.querySelectorAll("#wallet-pill-group .wallet-pill-btn").forEach(b => b.classList.remove("active"));
      dom.pillCashTx.classList.add("active");
      if (dom.selectedWallet) dom.selectedWallet.value = "Cash";
      if (dom.selectedSourceId) dom.selectedSourceId.value = "";
      if (dom.selectedSourceName) dom.selectedSourceName.value = "";
      if (dom.pillBankTx) dom.pillBankTx.textContent = "🏦 Bank Transfer ▾";
      if (dom.pillCardTx) dom.pillCardTx.textContent = "💳 Card ▾";
      state.selectedCardId = null;
      state.selectedCardType = null;
      state.selectedCardName = null;
      state.selectedBankId = null;
      state.selectedBankName = null;
    });
  }

  // Subscription Form Payment Method Selection (Bug 3)
  if (dom.pillBankSub) {
    dom.pillBankSub.addEventListener("click", () => {
      state.pickerTargetContext = "subscription";
      openBankPicker();
    });
  }
  if (dom.pillCardSub) {
    dom.pillCardSub.addEventListener("click", () => {
      state.pickerTargetContext = "subscription";
      openCardPicker();
    });
  }
  if (dom.pillEwalletSub) {
    dom.pillEwalletSub.addEventListener("click", () => {
      document.querySelectorAll("#sub-wallet-pill-group .wallet-pill-btn").forEach(b => b.classList.remove("active"));
      dom.pillEwalletSub.classList.add("active");
      if (dom.subSelectedWallet) dom.subSelectedWallet.value = "E-Wallet";
      if (dom.subSelectedSourceId) dom.subSelectedSourceId.value = "";
      if (dom.subSelectedSourceName) dom.subSelectedSourceName.value = "";
      if (dom.pillBankSub) dom.pillBankSub.textContent = "🏦 Bank Transfer ▾";
      if (dom.pillCardSub) dom.pillCardSub.textContent = "💳 Card ▾";
    });
  }

  // Card Picker Modal Listeners
  if (dom.closeCardPickerBtn) dom.closeCardPickerBtn.addEventListener("click", () => dom.selectCardDialog?.close());
  if (dom.cancelCardPickerBtn) dom.cancelCardPickerBtn.addEventListener("click", () => dom.selectCardDialog?.close());
  if (dom.navToAddCardBtn) {
    dom.navToAddCardBtn.addEventListener("click", () => {
      dom.selectCardDialog?.close();
      switchTab("commitments");
      showToast("Navigate to Commitments to add a new card.");
    });
  }

  // Bank Picker Modal Listeners (Option A)
  if (dom.closeBankPickerBtn) dom.closeBankPickerBtn.addEventListener("click", () => dom.selectBankDialog?.close());
  if (dom.cancelBankPickerBtn) dom.cancelBankPickerBtn.addEventListener("click", () => dom.selectBankDialog?.close());
  if (dom.navToAddBankBtn) {
    dom.navToAddBankBtn.addEventListener("click", () => {
      dom.selectBankDialog?.close();
      openAddBankAccountModal();
    });
  }

  // Bank Account Modal Listeners (Bug 2)
  if (dom.openAddBankAccountBtn) {
    dom.openAddBankAccountBtn.addEventListener("click", () => {
      openAddBankAccountModal();
    });
  }
  if (dom.closeBankModalBtn) dom.closeBankModalBtn.addEventListener("click", () => dom.bankAccountDialog?.close());
  if (dom.cancelBankModalBtn) dom.cancelBankModalBtn.addEventListener("click", () => dom.bankAccountDialog?.close());
  if (dom.bankAccountForm) dom.bankAccountForm.addEventListener("submit", handleSaveBankAccount);

  // Debit Card Modal Listeners
  if (dom.openAddDebitCardBtn) {
    dom.openAddDebitCardBtn.addEventListener("click", () => {
      if (dom.debitCardEditId) dom.debitCardEditId.value = "";
      if (dom.debitCardName) dom.debitCardName.value = "";
      if (dom.debitCardBank) dom.debitCardBank.value = "Maybank";
      document.getElementById("debit-modal-title").textContent = "Add Debit Card";
      dom.debitCardDialog?.showModal ? dom.debitCardDialog.showModal() : alert("Add debit card");
    });
  }
  if (dom.closeDebitModalBtn) dom.closeDebitModalBtn.addEventListener("click", () => dom.debitCardDialog?.close());
  if (dom.cancelDebitCardBtn) dom.cancelDebitCardBtn.addEventListener("click", () => dom.debitCardDialog?.close());
  if (dom.debitCardForm) dom.debitCardForm.addEventListener("submit", handleSaveDebitCard);



  // Theme Buttons (Option 7)
  document.querySelectorAll(".theme-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".theme-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      applyTheme(btn.dataset.theme);
      showToast(`Theme changed to ${btn.dataset.theme}`);
    });
  });

  // Settings Data Actions (Option 3 Integration)
  dom.settingsExportCsv.addEventListener("click", exportToCSV);
  dom.settingsExportJson.addEventListener("click", exportToJSON);
  if (dom.settingsImportBtn && dom.settingsImportBtn.tagName === "BUTTON") { dom.settingsImportBtn.addEventListener("click", () => dom.settingsFileInput.click()); }
  dom.settingsFileInput.addEventListener("change", handleFileImport);

  const purgeBtn = document.getElementById("force-update-cache-btn");
  if (purgeBtn) {
    purgeBtn.addEventListener("click", async () => {
      showToast("Purging all caches & service workers...");
      try {
        if ("serviceWorker" in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map(r => r.unregister()));
        }
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map(k => caches.delete(k)));
        }
        sessionStorage.clear();
        showToast("Cache purged! Reloading fresh build...");
        setTimeout(() => {
          window.location.href = window.location.pathname + "?nocache=" + Date.now();
        }, 400);
      } catch (err) {
        window.location.href = window.location.pathname + "?nocache=" + Date.now();
      }
    });
  }



  // Receipt Attachment Handlers (Add Form)
  if (dom.attachReceiptBtn) {
    dom.attachReceiptBtn.addEventListener("click", () => dom.receiptFileInput.click());
    dom.receiptFileInput.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      compressReceiptPhoto(file, (dataUrl) => {
        state.attachedReceipt = dataUrl;
        dom.receiptPreviewImg.src = dataUrl;
        dom.receiptPreviewBox.style.display = "block";
        showToast("Receipt photo attached!");
      });
    });

    dom.removeReceiptBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      state.attachedReceipt = null;
      dom.receiptFileInput.value = "";
      dom.receiptPreviewImg.src = "";
      dom.receiptPreviewBox.style.display = "none";
    });
  }

  // Receipt Attachment Handlers (Edit Modal)
  if (dom.editAttachReceiptBtn) {
    dom.editAttachReceiptBtn.addEventListener("click", () => dom.editReceiptFileInput.click());
    dom.editReceiptFileInput.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      compressReceiptPhoto(file, (dataUrl) => {
        state.editAttachedReceipt = dataUrl;
        dom.editReceiptPreviewImg.src = dataUrl;
        dom.editReceiptPreviewBox.style.display = "block";
        showToast("Receipt photo updated!");
      });
    });

    dom.editRemoveReceiptBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      state.editAttachedReceipt = null;
      dom.editReceiptFileInput.value = "";
      dom.editReceiptPreviewImg.src = "";
      dom.editReceiptPreviewBox.style.display = "none";
    });
  }

  if (dom.closeReceiptModalBtn) {
    dom.closeReceiptModalBtn.addEventListener("click", () => dom.receiptModal.close());

  // Click outside modal card on backdrop to exit
  if (dom.receiptModal) {
    dom.receiptModal.addEventListener("click", (e) => {
      if (e.target === dom.receiptModal) {
        dom.receiptModal.close();
      }
    });
  }
  }

  // Auto-Sweep Month-End Surplus Toggle (With Instant Accrued Amount Feedback)
  if (dom.toggleSurplusSweep) {
    dom.toggleSurplusSweep.addEventListener("change", (e) => {
      state.autoSweepSurplus = e.target.checked;
      saveStorage();
      renderHeroSpendableGaugeAndMetrics();

      if (state.autoSweepSurplus) {
        const { totalPastSurplus } = calculatePastMonthsSurplus();
        if (totalPastSurplus > 0) {
          showToast(`Auto-sweep enabled: ${formatCurrency(totalPastSurplus)} past surplus added to Total Saved 💰`);
        } else {
          showToast("Auto-sweep enabled: unspent month-end cash will accrue into Total Saved 💰");
        }
      } else {
        showToast("Auto-sweep disabled: past surplus excluded from Total Saved");
      }
    });
  }
}

function populateIncomeDepositSelect() {
  if (!dom.incomeDepositSelect) return;
  let options = '<option value="">None / External</option>';
  if (state.bankAccounts && state.bankAccounts.length) {
    state.bankAccounts.forEach(b => {
      options += `<option value="${b.id}">🏦 ${escapeHtml(b.name)} (${escapeHtml(b.bank)})</option>`;
    });
  }
  options += '<option value="cash">💵 Physical Cash</option>';
  dom.incomeDepositSelect.innerHTML = options;
}

function setFormType(type) {
  state.currentFormType = type;
  dom.tabExpense.classList.toggle("active", type === "expense");
  dom.tabIncome.classList.toggle("active", type === "income");
  populateCategorySelects(type === "income", dom.category);

  if (dom.categoryLabel) {
    dom.categoryLabel.textContent = type === "income" ? "Income Source *" : "Category *";
  }

  if (dom.expenseWalletGroup && dom.incomeDepositGroup) {
    if (type === "income") {
      dom.expenseWalletGroup.style.display = "none";
      dom.incomeDepositGroup.style.display = "block";
      populateIncomeDepositSelect();
    } else {
      dom.expenseWalletGroup.style.display = "block";
      dom.incomeDepositGroup.style.display = "none";
    }
  }

  const submitBtn = dom.form.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
      Save ${type === "income" ? "Income" : "Expense"}
    `;
  }
}

// Option 7C: Custom Category Creator Functions
function openCategoryCreatorModal(defaultType = "expense") {
  dom.customCatName.value = "";
  dom.customCatType.value = defaultType;
  dom.catCreatorDialog?.showModal ? dom.catCreatorDialog.showModal() : promptCatFallback();
}

function promptCatFallback() {
  const name = prompt("New category name:");
  if (!name) return;
  saveCustomCategoryObject(name, "🏷️", "#6366f1", state.currentFormType);
}

function handleSaveCustomCategory(e) {
  e.preventDefault();
  const name = dom.customCatName.value.trim();
  const type = dom.customCatType.value;
  const icon = dom.customCatEmoji.value || "🏷️";
  const color = dom.customCatColor.value || "#6366f1";

  if (!name) return showToast("Please enter a category name.");

  // Check duplicate
  const all = getAllCategories().all;
  if (all.some(c => c.name.toLowerCase() === name.toLowerCase())) {
    return showToast("Category already exists.");
  }

  saveCustomCategoryObject(name, icon, color, type);
  dom.catCreatorDialog.close();
}

function saveCustomCategoryObject(name, icon, color, type) {
  const newCat = { id: "cat_" + Date.now(), name, icon, color, type };
  state.customCategories.push(newCat);
  saveStorage();
  populateCategorySelects();
  populateFilterCategories();

  // Auto-select in form
  dom.category.value = name;
  renderSettings();
  render();
  showToast(`Created category "${icon} ${name}"!`);
}

function deleteCustomCategory(id) {
  const idx = state.customCategories.findIndex(c => c.id === id);
  if (idx === -1) return;
  const deleted = state.customCategories.splice(idx, 1)[0];
  saveStorage();
  populateCategorySelects();
  populateFilterCategories();
  renderSettings();
  render();
  showToast(`Deleted category "${deleted.name}"`);
}

// Add Transaction
function handleAddTransaction(e) {
  e.preventDefault();
  const amt = parseFloat(dom.amount.value);
  const cat = dom.category.value;
  const dt = dom.date.value;
  const nt = dom.note.value.trim();

  $("amount-error").textContent = (!amt || amt <= 0) ? "Enter an amount greater than 0." : "";
  $("category-error").textContent = !cat ? "Please select a category." : "";
  $("date-error").textContent = !dt ? "Please choose a date." : "";

  if (!amt || amt <= 0 || !cat || !dt || cat === "__ADD_CUSTOM__") return;

  // Handle Income Submission with Bank Account Deposit
  if (state.currentFormType === "income") {
    const depVal = dom.incomeDepositSelect ? dom.incomeDepositSelect.value : "";
    let walletType = "Other";
    let cardId = null;
    let cardName = null;

    if (depVal === "cash") {
      walletType = "Cash";
      cardName = "Physical Cash";
    } else if (depVal) {
      const targetBank = state.bankAccounts.find(b => b.id === depVal);
      if (targetBank) {
        walletType = "Bank Transfer";
        cardId = targetBank.id;
        cardName = targetBank.name;
        targetBank.balance = Number(((targetBank.balance || 0) + amt).toFixed(2));
      }
    }

    state.transactions.unshift({
      id: "tx_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      type: "income",
      amount: Number(amt.toFixed(2)),
      category: cat,
      wallet: walletType,
      cardId: cardId,
      cardName: cardName,
      cardType: null,
      receiptImage: state.attachedReceipt || null,
      date: dt,
      note: nt || cat,
      createdAt: Date.now()
    });

    saveStorage();
    dom.amount.value = "";
    dom.category.value = "";
    dom.note.value = "";
    state.attachedReceipt = null;
    if (dom.receiptFileInput) dom.receiptFileInput.value = "";
    if (dom.receiptPreviewBox) dom.receiptPreviewBox.style.display = "none";
    setDefaultDate();
    if (dom.incomeDepositSelect) dom.incomeDepositSelect.value = "";
    render();
    showToast(`Saved income of ${formatCurrency(amt)}!`);
    dom.amount.focus();
    return;
  }

  const chosenWallet = (dom.selectedWalletInput && dom.selectedWalletInput.value) ? dom.selectedWalletInput.value.trim() : "";
  if (!chosenWallet) {
    showToast("Please select a payment method / account.");
    return;
  }
  
  const cardId = (dom.selectedCardId && dom.selectedCardId.value) ? dom.selectedCardId.value : state.selectedCardId;
  const rawCardType = state.selectedCardType || (dom.selectedCardType ? dom.selectedCardType.value : null);
  const cardName = (dom.selectedCardName && dom.selectedCardName.value) ? dom.selectedCardName.value : (state.selectedCardName || state.selectedBankName);

  const isCredit = (chosenWallet === "Credit Card" || rawCardType === "credit" || rawCardType === "Credit Card" || (cardName && state.creditCards.some(c => c.name === cardName || c.id === cardId)));
  const isDebit = (chosenWallet === "Debit Card" || rawCardType === "debit" || rawCardType === "Debit Card" || (cardName && state.debitCards.some(dc => dc.name === cardName || dc.id === cardId)));

  // Insufficient Funds Pre-Transaction Verification (User Prompt)
  if (state.currentFormType === "expense") {
    let checkBank = null;
    let paymentDesc = "";

    if (isDebit) {
      const targetDebit = state.debitCards.find(dc => dc.id === cardId || dc.name === cardName) || state.debitCards[0];
      if (targetDebit) {
        checkBank = state.bankAccounts.find(b => b.id === targetDebit.bankAccountId || b.bank === targetDebit.bank || (targetDebit.name && b.name.toLowerCase().includes(targetDebit.bank.toLowerCase()))) || state.bankAccounts[0];
        paymentDesc = `Debit Card (${targetDebit.name})`;
      }
    } else if (chosenWallet === "Bank Transfer") {
      checkBank = state.bankAccounts.find(b => b.id === cardId || b.name === cardName || (!cardId && !cardName && b.bank === cardName)) || state.bankAccounts[0];
      paymentDesc = `Bank Transfer (${checkBank ? checkBank.name : "Bank"})`;
    }

    if (checkBank) {
      const liveBal = getReconciledBankBalance(checkBank);
      if (amt > liveBal) {
        const shortfall = (amt - liveBal).toFixed(2);
        const confirmMsg = `⚠️ Insufficient Funds in ${checkBank.name}!

` +
          `Available Balance: ${formatCurrency(liveBal)}
` +
          `Transaction Amount: ${formatCurrency(amt)}
` +
          `Shortfall: ${formatCurrency(shortfall)}

` +
          `Do you still want to proceed? (The account will show ⚠️ Overdrawn).
` +
          `Click Cancel to select another payment account or adjust the amount.`;
        if (!confirm(confirmMsg)) {
          return;
        }
      }
    }
  }

  // Automation for Credit Card vs Debit Card vs Bank Transfer: Immediately update balances
  if (isCredit) {
    const targetCard = state.creditCards.find(c => c.id === cardId || c.name === cardName) || state.creditCards[0];
    if (targetCard && state.currentFormType === "expense") {
      targetCard.unbilledBalance = Number(((targetCard.unbilledBalance || 0) + amt).toFixed(2));
    }
  } else if (isDebit) {
    const targetDebit = state.debitCards.find(dc => dc.id === cardId || dc.name === cardName) || state.debitCards[0];
    if (targetDebit && state.currentFormType === "expense") {
      targetDebit.totalSpentThisMonth = Number(((targetDebit.totalSpentThisMonth || 0) + amt).toFixed(2));
      // Deduct from parent bank account
      const parentBank = state.bankAccounts.find(b => b.id === targetDebit.bankAccountId || b.bank === targetDebit.bank || (targetDebit.name && b.name.toLowerCase().includes(targetDebit.bank.toLowerCase()))) || state.bankAccounts[0];
      if (parentBank) {
        parentBank.balance = Number(((parentBank.balance || 0) - amt).toFixed(2));
      }
    }
  } else if (chosenWallet === "Bank Transfer") {
    // Deduct from bank account directly
    const targetBank = state.bankAccounts.find(b => b.id === cardId || b.name === cardName || (!cardId && !cardName && b.bank === cardName)) || state.bankAccounts[0];
    if (targetBank && state.currentFormType === "expense") {
      targetBank.balance = Number(((targetBank.balance || 0) - amt).toFixed(2));
    }
  }

  const effectiveWallet = isDebit ? "Debit Card" : (isCredit ? "Credit Card" : chosenWallet);
  const effectiveCardType = isDebit ? "debit" : (isCredit ? "credit" : null);

  state.transactions.unshift({
    id: "tx_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
    type: state.currentFormType,
    amount: Number(amt.toFixed(2)),
    category: cat,
    wallet: effectiveWallet,
    cardId: cardId || null,
    cardName: cardName || null,
    cardType: effectiveCardType,
    receiptImage: state.attachedReceipt || null,
    date: dt,
    note: nt || cat,
    createdAt: Date.now()
  });

  saveStorage();
  dom.amount.value = "";
  dom.category.value = "";
  dom.note.value = "";
  state.attachedReceipt = null;
  if (dom.receiptFileInput) dom.receiptFileInput.value = "";
  if (dom.receiptPreviewBox) dom.receiptPreviewBox.style.display = "none";
  setDefaultDate();
  // Reset payment selection to unselected state (Bug 4)
  document.querySelectorAll("#wallet-pill-group .wallet-pill-btn").forEach(b => b.classList.remove("active"));
  if (dom.selectedWallet) dom.selectedWallet.value = "";
  if (dom.selectedSourceId) dom.selectedSourceId.value = "";
  if (dom.selectedSourceName) dom.selectedSourceName.value = "";
  if (dom.pillBankTx) dom.pillBankTx.textContent = "🏦 Bank Transfer ▾";
  if (dom.pillCardTx) dom.pillCardTx.textContent = "💳 Card ▾";
  state.selectedCardId = null;
  state.selectedCardType = null;
  state.selectedCardName = null;
  state.selectedBankId = null;
  state.selectedBankName = null;
  dom.amount.focus();

  render();
  showToast(`${state.currentFormType === "income" ? "Income" : "Expense"} added!`);
}


function populateEditWalletSelect(tx) {
  if (!dom.editWallet) return;

  let html = "";

  // 1. Bank Accounts Optgroup
  if (state.bankAccounts && state.bankAccounts.length) {
    html += '<optgroup label="🏦 Bank Accounts (Direct Transfers & Salary)">';
    state.bankAccounts.forEach(b => {
      html += `<option value="bank:${b.id}">🏦 ${escapeHtml(b.name)} (${escapeHtml(b.bank)})</option>`;
    });
    html += '</optgroup>';
  }

  // 2. Credit Cards Optgroup
  if (state.creditCards && state.creditCards.length) {
    html += '<optgroup label="💳 Credit Cards (5% CCRIS DSR)">';
    state.creditCards.forEach(c => {
      html += `<option value="credit:${c.id}">💳 ${escapeHtml(c.name)} (${escapeHtml(c.bank)})</option>`;
    });
    html += '</optgroup>';
  }

  // 3. Debit Cards Optgroup
  if (state.debitCards && state.debitCards.length) {
    html += '<optgroup label="💳 Debit Cards (0% DSR • Direct Debit)">';
    state.debitCards.forEach(dc => {
      html += `<option value="debit:${dc.id}">💳 ${escapeHtml(dc.name)} (${escapeHtml(dc.bank)})</option>`;
    });
    html += '</optgroup>';
  }

  // 4. Digital Wallets & Cash
  html += '<optgroup label="Cash & Digital Wallets">';
  html += '<option value="ewallet:ewallet">📱 E-Wallet</option>';
  html += '<option value="cash:cash">💵 Cash</option>';
  html += '<option value="other:other">📦 Other</option>';
  html += '</optgroup>';

  dom.editWallet.innerHTML = html;

  // Determine matching selection
  let selectedVal = "";
  if (tx) {
    if (tx.cardId) {
      if (state.bankAccounts.some(b => b.id === tx.cardId)) selectedVal = `bank:${tx.cardId}`;
      else if (state.creditCards.some(c => c.id === tx.cardId)) selectedVal = `credit:${tx.cardId}`;
      else if (state.debitCards.some(dc => dc.id === tx.cardId)) selectedVal = `debit:${tx.cardId}`;
    }

    if (!selectedVal && tx.cardName) {
      const matchBank = state.bankAccounts.find(b => b.name === tx.cardName || b.bank === tx.cardName);
      const matchCredit = state.creditCards.find(c => c.name === tx.cardName);
      const matchDebit = state.debitCards.find(dc => dc.name === tx.cardName);

      if (matchBank) selectedVal = `bank:${matchBank.id}`;
      else if (matchCredit) selectedVal = `credit:${matchCredit.id}`;
      else if (matchDebit) selectedVal = `debit:${matchDebit.id}`;
    }

    if (!selectedVal) {
      if (tx.wallet === "Cash") selectedVal = "cash:cash";
      else if (tx.wallet === "E-Wallet") selectedVal = "ewallet:ewallet";
      else if (tx.wallet === "Credit Card" && state.creditCards.length) selectedVal = `credit:${state.creditCards[0].id}`;
      else if (tx.wallet === "Debit Card" && state.debitCards.length) selectedVal = `debit:${state.debitCards[0].id}`;
      else if ((tx.wallet === "Bank Transfer" || tx.wallet === "Bank Account") && state.bankAccounts.length) {
        const matchByNote = state.bankAccounts.find(b => tx.note && tx.note.toLowerCase().includes(b.bank.toLowerCase()));
        selectedVal = `bank:${matchByNote ? matchByNote.id : state.bankAccounts[0].id}`;
      } else {
        selectedVal = "other:other";
      }
    }
  }

  if (selectedVal) {
    dom.editWallet.value = selectedVal;
  }
}
// Edit Transaction Functions
function openEditModal(id) {
  const tx = state.transactions.find(t => t.id === id);
  if (!tx) return;

  const isIncome = tx.type === "income";
  dom.editTxId.value = tx.id;
  dom.editType.value = isIncome ? "income" : "expense";
  populateCategorySelects(isIncome, dom.editCategory);
  populateEditWalletSelect(tx);

  dom.editAmount.value = tx.amount;
  dom.editCategory.value = tx.category;
  dom.editDate.value = tx.date;
  dom.editNote.value = tx.note === tx.category ? "" : tx.note;

  state.editAttachedReceipt = tx.receiptImage || null;
  if (dom.editReceiptPreviewBox) {
    if (tx.receiptImage) {
      dom.editReceiptPreviewImg.src = tx.receiptImage;
      dom.editReceiptPreviewBox.style.display = "block";
    } else {
      dom.editReceiptPreviewBox.style.display = "none";
    }
  }
  dom.editCurrency.textContent = state.currency;

  $("edit-amount-error").textContent = "";
  $("edit-category-error").textContent = "";
  $("edit-date-error").textContent = "";

  dom.editDialog?.showModal ? dom.editDialog.showModal() : promptEditFallback(tx);
}

function promptEditFallback(tx) {
  const newAmt = prompt("New amount:", tx.amount);
  if (newAmt === null) return;
  const amt = parseFloat(newAmt);
  if (!isNaN(amt) && amt > 0) {
    tx.amount = Number(amt.toFixed(2));
    saveStorage();
    render();
    showToast("Transaction updated!");
  }
}

function handleSaveEdit(e) {
  e.preventDefault();
  const id = dom.editTxId.value;
  const tx = state.transactions.find(t => t.id === id);
  if (!tx) return dom.editDialog.close();

  const amt = parseFloat(dom.editAmount.value);
  const cat = dom.editCategory.value;
  const dt = dom.editDate.value;
  const nt = dom.editNote.value.trim();
  const type = dom.editType.value;

  if (!amt || amt <= 0 || !cat || !dt || cat === "__ADD_CUSTOM__") return;

  const rawVal = dom.editWallet ? dom.editWallet.value : "";
  const [sourceCategory, sourceId] = rawVal.split(":");

  let newWallet = tx.wallet || "Bank Transfer";
  let newCardId = null;
  let newCardName = null;
  let newCardType = null;

  if (sourceCategory === "bank") {
    newWallet = "Bank Transfer";
    const b = state.bankAccounts.find(acc => acc.id === sourceId);
    if (b) {
      newCardId = b.id;
      newCardName = b.name;
    }
  } else if (sourceCategory === "credit") {
    newWallet = "Credit Card";
    newCardType = "credit";
    const c = state.creditCards.find(card => card.id === sourceId);
    if (c) {
      newCardId = c.id;
      newCardName = c.name;
    }
  } else if (sourceCategory === "debit") {
    newWallet = "Debit Card";
    newCardType = "debit";
    const dc = state.debitCards.find(card => card.id === sourceId);
    if (dc) {
      newCardId = dc.id;
      newCardName = dc.name;
    }
  } else if (sourceCategory === "ewallet") {
    newWallet = "E-Wallet";
  } else if (sourceCategory === "cash") {
    newWallet = "Cash";
  } else if (sourceCategory === "other") {
    newWallet = "Other";
  }

  // ================= RECONCILE BALANCES ON EDIT =================
  // 1. Revert effect of old transaction
  if (tx.type === "expense") {
    if (tx.wallet === "Credit Card" || tx.cardType === "credit") {
      const oldCredit = state.creditCards.find(c => c.id === tx.cardId || c.name === tx.cardName) || state.creditCards[0];
      if (oldCredit) {
        oldCredit.unbilledBalance = Math.max(0, Number(((oldCredit.unbilledBalance || 0) - tx.amount).toFixed(2)));
      }
    } else if (tx.wallet === "Debit Card" || tx.cardType === "debit") {
      const oldDebit = state.debitCards.find(dc => dc.id === tx.cardId || dc.name === tx.cardName) || state.debitCards[0];
      if (oldDebit) {
        oldDebit.totalSpentThisMonth = Math.max(0, Number(((oldDebit.totalSpentThisMonth || 0) - tx.amount).toFixed(2)));
      }
      const oldBank = state.bankAccounts.find(b => (oldDebit && b.id === oldDebit.bankAccountId) || (oldDebit && b.bank === oldDebit.bank) || b.id === tx.cardId || b.name === tx.cardName) || state.bankAccounts[0];
      if (oldBank) {
        oldBank.balance = Number(((oldBank.balance || 0) + tx.amount).toFixed(2));
      }
    } else if (tx.wallet === "Bank Transfer" || tx.wallet === "Bank Account") {
      const oldBank = state.bankAccounts.find(b => b.id === tx.cardId || b.name === tx.cardName || b.bank === tx.cardName) || state.bankAccounts[0];
      if (oldBank) {
        oldBank.balance = Number(((oldBank.balance || 0) + tx.amount).toFixed(2));
      }
    }
  } else if (tx.type === "income") {
    if (tx.wallet === "Bank Transfer" || tx.wallet === "Bank Account") {
      const oldBank = state.bankAccounts.find(b => b.id === tx.cardId || b.name === tx.cardName || b.bank === tx.cardName);
      if (oldBank) {
        oldBank.balance = Math.max(0, Number(((oldBank.balance || 0) - tx.amount).toFixed(2)));
      }
    }
  }

  // 2. Apply effect of updated transaction
  const newAmt = Number(amt.toFixed(2));
  if (type === "expense") {
    if (newWallet === "Credit Card" || newCardType === "credit") {
      const targetCredit = state.creditCards.find(c => c.id === newCardId || c.name === newCardName) || state.creditCards[0];
      if (targetCredit) {
        targetCredit.unbilledBalance = Number(((targetCredit.unbilledBalance || 0) + newAmt).toFixed(2));
      }
    } else if (newWallet === "Debit Card" || newCardType === "debit") {
      const targetDebit = state.debitCards.find(dc => dc.id === newCardId || dc.name === newCardName) || state.debitCards[0];
      if (targetDebit) {
        targetDebit.totalSpentThisMonth = Number(((targetDebit.totalSpentThisMonth || 0) + newAmt).toFixed(2));
      }
      const targetBank = state.bankAccounts.find(b => (targetDebit && b.id === targetDebit.bankAccountId) || (targetDebit && b.bank === targetDebit.bank) || b.id === newCardId || b.name === newCardName) || state.bankAccounts[0];
      if (targetBank) {
        targetBank.balance = Number(((targetBank.balance || 0) - newAmt).toFixed(2));
      }
    } else if (newWallet === "Bank Transfer") {
      const targetBank = state.bankAccounts.find(b => b.id === newCardId || b.name === newCardName || b.bank === newCardName) || state.bankAccounts[0];
      if (targetBank) {
        targetBank.balance = Number(((targetBank.balance || 0) - newAmt).toFixed(2));
      }
    }
  } else if (type === "income") {
    if (newWallet === "Bank Transfer") {
      const targetBank = state.bankAccounts.find(b => b.id === newCardId || b.name === newCardName || b.bank === newCardName);
      if (targetBank) {
        targetBank.balance = Number(((targetBank.balance || 0) + newAmt).toFixed(2));
      }
    }
  }

  // 3. Update transaction object
  tx.type = type;
  tx.amount = newAmt;
  tx.category = cat;
  tx.wallet = newWallet;
  tx.cardId = newCardId;
  tx.cardName = newCardName;
  tx.cardType = newCardType;
  tx.receiptImage = state.editAttachedReceipt || null;
  tx.date = dt;
  tx.note = nt || cat;

  saveStorage();
  render();
  dom.editDialog.close();
  showToast("Transaction updated!");
}

// Helper: Match transaction to subscription for zero-drift reconciliation
function isSubscriptionTransaction(tx, sub) {
  if (!tx || (tx.type || "expense") !== "expense" || !sub) return false;
  if (tx.subId && tx.subId === sub.id) return true;
  if (tx.note) {
    const cleanNote = tx.note.trim().toLowerCase();
    const cleanSubName = (sub.name || "").trim().toLowerCase();
    if (!cleanSubName) return false;
    if (cleanNote === `${cleanSubName} (monthly bill)` ||
        cleanNote === `${cleanSubName} (auto-debited)` ||
        cleanNote === cleanSubName ||
        cleanNote.startsWith(`${cleanSubName} (monthly bill)`) ||
        cleanNote.startsWith(`${cleanSubName} (auto-debited)`)) {
      return true;
    }
  }
  return false;
}

function deleteExpense(id) {
  const idx = state.transactions.findIndex(t => t.id === id);
  if (idx === -1) return;
  const deleted = state.transactions.splice(idx, 1)[0];

  // Revert balances if deleted item was an income deposited to a bank
  if (deleted && deleted.type === "income" && deleted.cardId) {
    const targetBank = state.bankAccounts.find(b => b.id === deleted.cardId || b.name === deleted.cardName);
    if (targetBank) {
      targetBank.balance = Math.max(0, Number(((targetBank.balance || 0) - deleted.amount).toFixed(2)));
    }
  }

  // Revert card and bank balances if deleted item was an expense
  if (deleted && deleted.type === "expense") {
    // Check if deleted item was a logged subscription / recurring bill (Bug 2 Fix)
    if (state.subscriptions && state.subscriptions.length) {
      const matchedSub = state.subscriptions.find(s => isSubscriptionTransaction(deleted, s));
      if (matchedSub) {
        const deletedYm = (deleted.date && deleted.date.length >= 7) ? deleted.date.substring(0, 7) : getLocalDateString().substring(0, 7);
        const hasOther = state.transactions.some(t =>
          t.date && t.date.startsWith(deletedYm) && isSubscriptionTransaction(t, matchedSub)
        );
        if (!hasOther && matchedSub.lastLoggedMonth === deletedYm) {
          matchedSub.lastLoggedMonth = null;
        }
      }
    }

    // 1. Check if deleted item was a loan installment payment
    if (deleted.isLoanPayment || deleted.loanId || (deleted.note && deleted.note.startsWith("Loan Installment: "))) {
      const loan = state.loans.find(l => l.id === deleted.loanId || (deleted.note && deleted.note.includes(l.name))) || state.loans[0];
      if (loan) {
        loan.remainingMonths = Math.min(loan.tenureMonths || 84, (loan.remainingMonths || 0) + 1);
        loan.lastPaidMonth = null;
        if (loan.type === "CAR_EIR" || loan.type === "HOME_SBR" || loan.type === "PERSONAL") {
          const monthlyRate = (loan.rate / 100) / 12;
          const monthlyInterest = Number(((loan.remainingPrincipal || loan.originalPrincipal) * monthlyRate).toFixed(2));
          const principalPaid = Math.max(0, Number((deleted.amount - monthlyInterest).toFixed(2)));
          loan.remainingPrincipal = Math.min(loan.originalPrincipal, Number(((loan.remainingPrincipal || 0) + principalPaid).toFixed(2)));
        } else {
          const principalPortion = loan.originalPrincipal / (loan.tenureMonths || 84);
          loan.remainingPrincipal = Math.min(loan.originalPrincipal, Number(((loan.remainingPrincipal || 0) + principalPortion).toFixed(2)));
        }
      }
      const targetBank = state.bankAccounts.find(b => b.id === deleted.cardId || b.name === deleted.cardName || b.bank === deleted.cardName) || state.bankAccounts[0];
      if (targetBank) {
        targetBank.balance = Number(((targetBank.balance || 0) + deleted.amount).toFixed(2));
      }
    } else if (deleted.isSettlement || (deleted.note && deleted.note.startsWith("Credit Card Settlement: "))) {
    // Credit Card Settlement Handled Above
      const cardName = deleted.settledCardName || (deleted.note ? deleted.note.replace("Credit Card Settlement: ", "").trim() : "");
      const targetCard = state.creditCards.find(c => c.id === deleted.settledCardId || c.name === cardName) || state.creditCards[0];
      if (targetCard) {
        targetCard.currentBilled = Number(((targetCard.currentBilled || 0) + deleted.amount).toFixed(2));
        targetCard.payInFull = false;
      }
      // Revert funds back to the bank account that paid this settlement
      const targetBank = state.bankAccounts.find(b => b.id === deleted.cardId || b.name === deleted.cardName || b.bank === deleted.cardName) || state.bankAccounts[0];
      if (targetBank) {
        targetBank.balance = Number(((targetBank.balance || 0) + deleted.amount).toFixed(2));
      }
    } else if (deleted.wallet === "Credit Card" || deleted.cardType === "credit") {
      const card = state.creditCards.find(c => c.id === deleted.cardId || c.name === deleted.cardName) || state.creditCards[0];
      if (card) {
        card.unbilledBalance = Math.max(0, Number(((card.unbilledBalance || 0) - deleted.amount).toFixed(2)));
      }
    } else if (deleted.wallet === "Debit Card" || deleted.cardType === "debit") {
      const dc = state.debitCards.find(c => c.id === deleted.cardId || c.name === deleted.cardName) || state.debitCards[0];
      if (dc) {
        dc.totalSpentThisMonth = Math.max(0, Number(((dc.totalSpentThisMonth || 0) - deleted.amount).toFixed(2)));
      }
      const parentBank = state.bankAccounts.find(b => (dc && b.id === dc.bankAccountId) || (dc && b.bank === dc.bank) || b.id === deleted.cardId || b.name === deleted.cardName) || state.bankAccounts[0];
      if (parentBank) {
        parentBank.balance = Number(((parentBank.balance || 0) + deleted.amount).toFixed(2));
      }
    } else if (deleted.wallet === "Bank Transfer") {
      const targetBank = state.bankAccounts.find(b => b.id === deleted.cardId || b.name === deleted.cardName || b.bank === deleted.cardName) || state.bankAccounts[0];
      if (targetBank) {
        targetBank.balance = Number(((targetBank.balance || 0) + deleted.amount).toFixed(2));
      }
    }
  }

  saveStorage();
  render();
  showToast(`Deleted "${deleted.note}"`);
}

// Subscriptions
// Auto-Deduction Engine for Subscriptions & Fixed Bills
function processAutoDeductions() {
  if (!state.subscriptions || !state.subscriptions.length) return;

  const now = new Date();
  const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const currentDay = now.getDate();

  let autoLoggedCount = 0;
  const names = [];

  state.subscriptions.forEach(sub => {
    if (sub.autoDeduct === false) return;

    // Check if billing day has arrived in this month and not yet logged
    if (currentDay >= sub.billingDay && sub.lastLoggedMonth !== currentYm) {
      const dayStr = String(sub.billingDay).padStart(2, "0");
      const autoDate = `${currentYm}-${dayStr}`;

      const autoCardType = sub.wallet === "Credit Card" ? "credit" : (sub.wallet === "Debit Card" ? "debit" : null);
      const autoWallet = sub.wallet === "Credit Card" ? "Credit Card" : (sub.wallet === "Debit Card" ? "Debit Card" : (sub.wallet === "E-Wallet" ? "E-Wallet" : "Bank Transfer"));
      const newTx = {
        id: "tx_auto_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
        type: "expense",
        amount: sub.amount,
        category: sub.category,
        wallet: autoWallet,
        cardId: sub.sourceId || null,
        cardName: sub.sourceName || sub.cardName || null,
        cardType: autoCardType,
        date: autoDate,
        note: `${sub.name} (Auto-debited)`,
        subId: sub.id,
        isSubscription: true,
        createdAt: Date.now()
      };

      state.transactions.unshift(newTx);
      sub.lastLoggedMonth = currentYm;
      autoLoggedCount++;
      names.push(sub.name);

      // Check if auto-deduction overdraws bank account and record alert in Notification Center
      let autoCheckBank = null;
      if (sub.wallet === "Debit Card") {
        const dc = state.debitCards.find(c => c.id === sub.sourceId || c.name === sub.sourceName || c.name === sub.cardName) || state.debitCards[0];
        if (dc) {
          autoCheckBank = state.bankAccounts.find(b => b.id === dc.bankAccountId || b.bank === dc.bank || (dc.name && b.name.toLowerCase().includes(dc.bank.toLowerCase()))) || state.bankAccounts[0];
        }
      } else if (sub.wallet === "Bank Transfer" || sub.wallet === "Bank Account") {
        autoCheckBank = state.bankAccounts.find(b => b.id === sub.sourceId || b.name === sub.sourceName || b.name === sub.cardName || b.bank === sub.sourceName) || state.bankAccounts[0];
      }

      if (autoCheckBank) {
        const liveBal = getReconciledBankBalance(autoCheckBank);
        if (sub.amount > liveBal) {
          const shortfall = (sub.amount - liveBal).toFixed(2);
          const notifId = "notif_sub_overdrawn_" + sub.id + "_" + currentYm;
          if (!state.notifications.some(n => n.id === notifId)) {
            state.notifications.unshift({
              id: notifId,
              type: "alert",
              cardId: autoCheckBank.id,
              title: `⚠️ Overdrawn Alert: ${autoCheckBank.name}`,
              time: new Date().toISOString(),
              isRead: false,
              decision: `Overdrawn by ${formatCurrency(shortfall)}`,
              body: `Auto-debited "${sub.name}" (${formatCurrency(sub.amount)}) exceeded available balance in ${autoCheckBank.name}. Account is now overdrawn.`
            });
          }
        }
      }
    }
  });

  if (autoLoggedCount > 0) {
    saveStorage();
    render();
    showToast(`🔔 Auto-debited ${autoLoggedCount} bill(s): ${names.join(", ")}`);
  }
}

function handleAddSubscription(e) {
  e.preventDefault();
  const name = dom.subName.value.trim();
  const amount = parseFloat(dom.subAmount.value);
  const category = dom.subCategory.value;
  const billingDay = parseInt(dom.subBillingDay.value, 10);

  if (!name || isNaN(amount) || amount <= 0 || !category || isNaN(billingDay) || billingDay < 1 || billingDay > 31) {
    return showToast("Please enter valid subscription details.");
  }

  const isAuto = dom.subAutoDeduct ? dom.subAutoDeduct.checked : true;
  const subWallet = dom.subSelectedWallet ? dom.subSelectedWallet.value : "Bank Transfer";
  const sourceId = dom.subSelectedSourceId ? dom.subSelectedSourceId.value : "";
  const sourceName = dom.subSelectedSourceName ? dom.subSelectedSourceName.value : "";
  state.subscriptions.push({
    id: "sub_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
    name,
    amount: Number(amount.toFixed(2)),
    category,
    billingDay,
    wallet: subWallet,
    sourceId: sourceId || null,
    sourceName: sourceName || null,
    cardName: sourceName || null,
    autoDeduct: isAuto,
    lastLoggedMonth: null,
    createdAt: Date.now()
  });

  saveStorage();
  render(); // Synchronize Subscriptions header, Total Monthly Commitment card, and Spendable Hero
  dom.subDialog.close();
  showToast(`Added "${name}" to recurring bills!`);
}

function promptSubFallback() {
  const name = prompt("Bill name (e.g. Mobile Plan):");
  if (!name) return;
  const amt = parseFloat(prompt("Monthly Amount:"));
  if (isNaN(amt) || amt <= 0) return;
  const day = parseInt(prompt("Billing Day of month (1-31):"), 10) || 1;

  state.subscriptions.push({
    id: "sub_" + Date.now(),
    name,
    amount: Number(amt.toFixed(2)),
    category: "Bills & Utilities",
    billingDay: day,
    createdAt: Date.now()
  });
  saveStorage();
  render(); // Synchronize Subscriptions header, Total Monthly Commitment card, and Spendable Hero
  showToast("Bill added!");
}

function deleteSubscription(id) {
  const idx = state.subscriptions.findIndex(s => s.id === id);
  if (idx === -1) return;
  const deleted = state.subscriptions.splice(idx, 1)[0];
  saveStorage();
  render(); // Synchronize Subscriptions header, Total Monthly Commitment card, and Spendable Hero (Bug 1 Fix)
  showToast(`Removed "${deleted.name}"`);
}

function logSubscriptionNow(id) {
  const sub = state.subscriptions.find(s => s.id === id);
  if (!sub) return;

  const now = new Date();
  const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const today = getLocalDateString();

  // Insufficient Funds / Overdrawn Pre-Transaction Verification Guard
  let checkBank = null;
  if (sub.wallet === "Debit Card") {
    const dc = state.debitCards.find(c => c.id === sub.sourceId || c.name === sub.sourceName || c.name === sub.cardName) || state.debitCards[0];
    if (dc) {
      checkBank = state.bankAccounts.find(b => b.id === dc.bankAccountId || b.bank === dc.bank || (dc.name && b.name.toLowerCase().includes(dc.bank.toLowerCase()))) || state.bankAccounts[0];
    }
  } else if (sub.wallet === "Bank Transfer" || sub.wallet === "Bank Account") {
    checkBank = state.bankAccounts.find(b => b.id === sub.sourceId || b.name === sub.sourceName || b.name === sub.cardName || b.bank === sub.sourceName) || state.bankAccounts[0];
  } else if (sub.sourceId && state.bankAccounts.some(b => b.id === sub.sourceId)) {
    checkBank = state.bankAccounts.find(b => b.id === sub.sourceId);
  }

  if (checkBank) {
    const liveBal = getReconciledBankBalance(checkBank);
    if (sub.amount > liveBal) {
      const shortfall = (sub.amount - liveBal).toFixed(2);
      const confirmMsg = `⚠️ Insufficient Funds in ${checkBank.name}!

` +
        `Available Balance: ${formatCurrency(liveBal)}
` +
        `Bill Amount: ${formatCurrency(sub.amount)}
` +
        `Shortfall: ${formatCurrency(shortfall)}

` +
        `Do you still want to proceed? (The account will show ⚠️ Overdrawn).
` +
        `Click Cancel to abort.`;
      if (!confirm(confirmMsg)) {
        showToast(`Logging cancelled for "${sub.name}" (Insufficient funds)`);
        return;
      }
    }
  }

  const autoCardType = sub.wallet === "Credit Card" ? "credit" : (sub.wallet === "Debit Card" ? "debit" : null);
  const autoWallet = sub.wallet === "Credit Card" ? "Credit Card" : (sub.wallet === "Debit Card" ? "Debit Card" : (sub.wallet === "E-Wallet" ? "E-Wallet" : "Bank Transfer"));
  state.transactions.unshift({
    id: "tx_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
    type: "expense",
    amount: sub.amount,
    category: sub.category,
    wallet: autoWallet,
    cardId: sub.sourceId || null,
    cardName: sub.sourceName || sub.cardName || null,
    cardType: autoCardType,
    date: today,
    note: `${sub.name} (Monthly Bill)`,
    subId: sub.id,
    isSubscription: true,
    createdAt: Date.now()
  });

  sub.lastLoggedMonth = currentYm;
  saveStorage();
  render();
  showToast(`Logged ${sub.name} (${formatCurrency(sub.amount)}) into this month!`);
}

function renderSubscriptions() {
  const totalMonthly = state.subscriptions.reduce((s, b) => s + b.amount, 0);
  dom.subsTotalCommitment.textContent = `Fixed Commitments: ${formatCurrency(totalMonthly)} / month`;

  if (!state.subscriptions.length) {
    dom.subscriptionsList.innerHTML = `<p class="empty-state">No recurring subscriptions added yet. Click "+ Add Bill" to track fixed commitments.</p>`;
    return;
  }

  const today = new Date();
  const currentDay = today.getDate();
  const sorted = [...state.subscriptions].sort((a, b) => a.billingDay - b.billingDay);

  dom.subscriptionsList.innerHTML = sorted.map(sub => {
    const icon = getCategoryIcon(sub.category);
    const diff = sub.billingDay - currentDay;

    const currentYm = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

    // Dynamic reconciliation with state.transactions as Single Source of Truth (Bug 2 Fix)
    const hasCurrentMonthTx = state.transactions.some(t =>
      t.date && t.date.startsWith(currentYm) && isSubscriptionTransaction(t, sub)
    );
    if (hasCurrentMonthTx) {
      sub.lastLoggedMonth = currentYm;
    } else if (sub.lastLoggedMonth === currentYm) {
      sub.lastLoggedMonth = null;
    }

    const isDebited = sub.lastLoggedMonth === currentYm;
    const monthShort = today.toLocaleString(undefined, { month: "short" });

    // Clean badge logic: If already debited, NEVER show Due Today or Due Soon warnings
    let dueBadge = "";
    if (!isDebited) {
      if (diff === 0) dueBadge = `<span class="badge-due-today">🔔 Due Today</span>`;
      else if (diff > 0 && diff <= 5) dueBadge = `<span class="badge-due-soon">⚠️ Due in ${diff}d</span>`;
    }

    let actionButtonOrBadge = "";
    if (isDebited) {
      actionButtonOrBadge = `<span class="badge-debited" title="Already debited for this month">✓ Debited for ${monthShort}</span>`;
    } else {
      actionButtonOrBadge = `<button type="button" class="btn-log-now" title="Log this bill now" onclick="logSubscriptionNow('${sub.id}')">⚡ Log</button>`;
    }

    const autoTag = sub.autoDeduct === false ? `<span class="sub-tag-manual">Manual</span>` : "";

    return `
      <div class="sub-item" data-id="${sub.id}">
        <div class="sub-left">
          <div class="sub-icon-badge" aria-hidden="true">${icon}</div>
          <div class="sub-info">
            <span class="sub-name" title="${escapeHtml(sub.name)}">${escapeHtml(sub.name)}</span>
            <div class="sub-meta">
              <span>Day ${sub.billingDay}</span>
              <span>•</span>
              <span class="tx-badge-wallet">${getWalletIcon(sub.wallet)} ${escapeHtml(sub.sourceName || sub.cardName || sub.wallet || "Bank Account")}</span>
              ${dueBadge ? `<span>•</span>${dueBadge}` : ""}
              ${autoTag ? `<span>•</span>${autoTag}` : ""}
            </div>
          </div>
        </div>
        <div class="sub-right">
          <span class="sub-amount">${formatCurrency(sub.amount)}</span>
          ${actionButtonOrBadge}
          <button type="button" class="btn-delete" title="Delete subscription" onclick="deleteSubscription('${sub.id}')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>
    `;
  }).join("");
}

// Multi-Criteria Filter Logic
function getFilteredTransactions() {
  const now = new Date();
  const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastYm = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}`;

  return state.transactions.filter(t => {
    if (state.periodFilter === "THIS_MONTH" && (!t.date || !t.date.startsWith(currentYm))) return false;
    if (state.periodFilter === "LAST_MONTH" && (!t.date || !t.date.startsWith(lastYm))) return false;
    if (state.periodFilter === "CUSTOM") {
      if (state.customStartDate && t.date < state.customStartDate) return false;
      if (state.customEndDate && t.date > state.customEndDate) return false;
    }

    if (state.filterCategory !== "ALL" && t.category !== state.filterCategory) return false;

    if (state.searchQuery) {
      const matchNote = (t.note || "").toLowerCase().includes(state.searchQuery);
      const matchCat = (t.category || "").toLowerCase().includes(state.searchQuery);
      const matchWallet = (t.wallet || "").toLowerCase().includes(state.searchQuery);
      const matchAmt = t.amount.toString().includes(state.searchQuery);
      if (!matchNote && !matchCat && !matchWallet && !matchAmt) return false;
    }

    return true;
  });
}

// Main Render
function render() {
  dom.currencyDisplay.textContent = state.currency;
  dom.editCurrency.textContent = state.currency;
  renderHeroSpendableGaugeAndMetrics();
  renderSubscriptions();
  renderCreditCards();
  renderDebitCards();
  renderBankAccounts();
  renderLoans();
  renderDashboardInstallments();
  renderBreakdown();
  renderTransactionList();
  renderAnalysisPieChart();
  updateRollingNavBar();
  updateNotificationBadge();
}

// Hero Two-Tone Spendable Gauge & Monthly Metrics (Prevents Wealth Illusion)

// Month-End Surplus Sweep Engine (Sweeps unspent spendable pool from closed past months into Total Saved)
function calculatePastMonthsSurplus() {
  const currentYm = getLocalDateString().substring(0, 7);
  const monthGroups = {};

  // Group transactions by month
  state.transactions.forEach(t => {
    if (!t.date || t.date.length < 7) return;
    const ym = t.date.substring(0, 7);
    if (!monthGroups[ym]) {
      monthGroups[ym] = { incomes: 0, savings: 0, living: 0 };
    }
    if (t.type === "income") {
      monthGroups[ym].incomes += t.amount;
    } else if (t.category === "Savings & Investments") {
      monthGroups[ym].savings += t.amount;
    } else {
      monthGroups[ym].living += t.amount;
    }
  });

  let totalPastSurplus = 0;
  let lastMonthSurplus = 0;
  let lastMonthYm = "";

  // Compute surplus only for past closed months (strictly before current month)
  Object.keys(monthGroups).sort().forEach(ym => {
    if (ym < currentYm) {
      const g = monthGroups[ym];
      const pool = Math.max(0, g.incomes - g.savings);
      const surplus = Math.max(0, pool - g.living);
      totalPastSurplus += surplus;
      lastMonthSurplus = surplus;
      lastMonthYm = ym;
    }
  });

  return { totalPastSurplus, lastMonthSurplus, lastMonthYm };
}

function checkMonthEndSweepNotification() {
  if (!state.autoSweepSurplus) return; // Only notify if user enabled auto-sweep
  const now = new Date();
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousYm = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}`;
  const prevMonthName = lastMonthDate.toLocaleString(undefined, { month: "long" });

  const { lastMonthSurplus, lastMonthYm } = calculatePastMonthsSurplus();

  if (lastMonthYm === previousYm && lastMonthSurplus > 0) {
    const sweptKey = "expense_tracker_last_swept_month";
    const alreadyNotified = localStorage.getItem(sweptKey);

    if (alreadyNotified !== previousYm) {
      setTimeout(() => {
        showToast(`🎉 ${prevMonthName} Closed: ${formatCurrency(lastMonthSurplus)} unspent surplus swept into Total Saved 💰!`);
        localStorage.setItem(sweptKey, previousYm);
      }, 1200);
    }
  }
}

function renderHeroSpendableGaugeAndMetrics() {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthName = now.toLocaleString(undefined, { month: "long", year: "numeric" });

  dom.spendableMonthLabel.textContent = `Spendable Cash Flow (${monthName})`;

  const currentMonthTx = state.transactions.filter(t => t.date && t.date.startsWith(ym));
  const monthlyIncomes = currentMonthTx.filter(t => t.type === "income");
  const monthlyExpenses = currentMonthTx.filter(t => (t.type || "expense") === "expense");

  const monthIncomeAmt = monthlyIncomes.reduce((s, t) => s + t.amount, 0);

  // Month Savings (Savings & Investments)
  const monthSavingsTx = currentMonthTx.filter(t => t.category === "Savings & Investments");
  const monthSavedAmt = monthSavingsTx.reduce((s, t) => s + t.amount, 0);

  // Month Living Expenses (excluding savings)
  const monthLivingTx = monthlyExpenses.filter(t => t.category !== "Savings & Investments");
  const monthLivingAmt = monthLivingTx.reduce((s, t) => s + t.amount, 0);

  // Spendable Pool = Month Income - Month Savings
  const spendablePool = Math.max(0, monthIncomeAmt - monthSavedAmt);
  const spendableBalance = spendablePool - monthLivingAmt;

  dom.heroSpendableVal.textContent = formatCurrency(spendableBalance);
  dom.heroSpentVal.textContent = formatCurrency(monthLivingAmt);
  dom.heroPoolVal.textContent = formatCurrency(spendablePool);

  // Two-Tone Visual Gauge
  if (spendablePool > 0) {
    dom.twoToneTrack.className = "two-tone-track";
    const spentPercent = (monthLivingAmt / spendablePool) * 100;

    if (monthLivingAmt > spendablePool) {
      dom.twoToneTrack.classList.add("overspend");
      dom.twoToneSpentFill.style.width = "100%";
      dom.heroSpendableVal.className = "spendable-balance-val deficit";
      dom.heroSpendableTag.className = "spendable-balance-tag deficit";
      dom.heroSpendableTag.textContent = "Deficit";
      dom.gaugeSpentText.textContent = `🔴 ${spentPercent.toFixed(0)}% Spent`;
      dom.gaugeAvailableText.textContent = `⚠️ Over by ${formatCurrency(monthLivingAmt - spendablePool)}`;
      dom.heroFooterText.textContent = `⚠️ You have exceeded your spendable pool! Currently dipping into savings by ${formatCurrency(monthLivingAmt - spendablePool)}.`;
    } else {
      dom.twoToneSpentFill.style.width = `${spentPercent.toFixed(1)}%`;
      dom.heroSpendableVal.className = "spendable-balance-val";
      dom.heroSpendableTag.className = "spendable-balance-tag";
      dom.heroSpendableTag.textContent = "Available";
      const availPercent = 100 - spentPercent;
      dom.gaugeSpentText.textContent = `🔴 ${spentPercent.toFixed(1)}% (${formatCurrency(monthLivingAmt)})`;
      dom.gaugeAvailableText.textContent = `🟢 ${availPercent.toFixed(1)}% (${formatCurrency(spendableBalance)})`;
      
      const savingsNote = monthSavedAmt > 0 ? ` with ${formatCurrency(monthSavedAmt)} (${((monthSavedAmt/monthIncomeAmt)*100).toFixed(0)}%) locked in savings` : "";
      dom.heroFooterText.textContent = `Based on ${formatCurrency(monthIncomeAmt)} salary${savingsNote}. Safe to spend without touching savings.`;
    }
  } else {
    dom.twoToneTrack.className = "two-tone-track empty";
    dom.twoToneSpentFill.style.width = "0%";
    dom.heroSpendableVal.className = "spendable-balance-val";
    dom.heroSpendableTag.className = "spendable-balance-tag";
    dom.heroSpendableTag.textContent = "Clean Slate";
    dom.gaugeSpentText.textContent = "🔴 0% Spent";
    dom.gaugeAvailableText.textContent = "🟢 Ready for salary";
    dom.heroFooterText.textContent = "Tip: Log your monthly salary and savings to establish your safe spendable pool for this month.";
  }

  // Monthly Stat Cards Below & Net True Savings
  dom.totalIncome.textContent = formatCurrency(monthIncomeAmt);
  dom.incomeCount.textContent = `${monthlyIncomes.length} ${monthlyIncomes.length === 1 ? "earning" : "earnings"} this month`;

  // Net True Savings & Optional Month-End Sweep Integration
  const allTimeExplicitSavings = state.transactions
    .filter(t => t.category === "Savings & Investments")
    .reduce((s, t) => s + t.amount, 0);

  const { totalPastSurplus, lastMonthSurplus } = calculatePastMonthsSurplus();
  // Only add past surplus if user enabled the setting; otherwise only count direct explicit savings
  const effectivePastSurplus = state.autoSweepSurplus ? totalPastSurplus : 0;
  const totalAccumulatedSavings = allTimeExplicitSavings + effectivePastSurplus;

  if (spendableBalance < 0) {
    const deficit = Math.abs(spendableBalance);
    const netTrueSavings = Math.max(0, totalAccumulatedSavings - deficit);
    dom.totalSaved.textContent = formatCurrency(netTrueSavings);
    dom.totalSaved.className = "metric-value deficit";
    dom.savingsSub.className = "metric-sub deficit";
    dom.savingsSub.textContent = `⚠️ Reduced by ${formatCurrency(deficit)} deficit`;
  } else {
    dom.totalSaved.textContent = formatCurrency(totalAccumulatedSavings);
    dom.totalSaved.className = "metric-value";
    dom.savingsSub.className = "metric-sub";

    if (state.autoSweepSurplus && totalPastSurplus > 0) {
      if (monthSavedAmt > 0) {
        dom.savingsSub.textContent = `+${formatCurrency(monthSavedAmt)} this month • ${formatCurrency(totalPastSurplus)} past surplus swept`;
      } else {
        dom.savingsSub.textContent = `${formatCurrency(totalPastSurplus)} unspent surplus swept from past months`;
      }
    } else {
      if (monthSavedAmt > 0) {
        const monthPct = monthIncomeAmt > 0 ? ((monthSavedAmt / monthIncomeAmt) * 100).toFixed(0) : 0;
        dom.savingsSub.textContent = `+${formatCurrency(monthSavedAmt)} this month (${monthPct}%)`;
      } else {
        dom.savingsSub.textContent = allTimeExplicitSavings > 0 ? "Direct savings & investments" : "No savings logged yet";
      }
    }
  }

  dom.totalSpend.textContent = formatCurrency(monthLivingAmt);
  dom.txCount.textContent = `${monthLivingTx.length} ${monthLivingTx.length === 1 ? "expense" : "expenses"} this month`;

  if (!monthLivingTx.length) {
    dom.topCategory.textContent = "—";
    dom.topCategoryAmt.textContent = "No expenses yet";
  } else {
    const catTotals = {};
    monthLivingTx.forEach(t => catTotals[t.category] = (catTotals[t.category] || 0) + t.amount);
    const top = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];
    dom.topCategory.textContent = `${getCategoryIcon(top[0])} ${top[0]}`;
    dom.topCategoryAmt.textContent = `${formatCurrency(top[1])} total`;
  }
}

// Donut Select / Deselect Logic
function selectCategory(cat) {
  state.selectedCategory = cat;
  state.filterCategory = cat;
  dom.filterCategory.value = cat;
  renderBreakdown();
  renderTransactionList();
  showToast(`Filtered by ${cat} (tap again to reset)`);
}

function deselectCategory() {
  state.selectedCategory = null;
  state.filterCategory = "ALL";
  dom.filterCategory.value = "ALL";
  renderBreakdown();
  renderTransactionList();
  showToast("Showing all categories");
}

function toggleCategory(cat) {
  state.selectedCategory === cat ? deselectCategory() : selectCategory(cat);
}

// Upgraded Donut Chart Engine (Period-Synced & Interactive Category Tiles)

// Malaysian Loans & Installments Engine (June 2026 Reform & BNM SBR Guidelines)

// ================= CREDIT CARD & NOTIFICATION CENTER ENGINES =================
function processCreditCardCycles() {
  if (!state.creditCards || !state.creditCards.length) return;

  const now = new Date();
  const todayDay = now.getDate();
  const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  state.creditCards.forEach(card => {
    // 1. Statement Cut-Off Cycle: Freeze unbilled into billed
    if (todayDay >= card.statementDay && card.lastStatementRolledMonth !== currentYm) {
      if (card.unbilledBalance > 0) {
        card.currentBilled = Number((card.currentBilled + card.unbilledBalance).toFixed(2));
        card.unbilledBalance = 0.00;

        // Push statement notification
        state.notifications.unshift({
          id: "notif_stmt_" + card.id + "_" + currentYm,
          type: "statement",
          cardId: card.id,
          title: `📅 ${card.name} Statement Ready`,
          time: new Date().toISOString(),
          isRead: false,
          body: `Statement closed on Day ${card.statementDay}. Total statement bill due: ${formatCurrency(card.currentBilled)} by Day ${card.dueDay}.`
        });
      }
      card.lastStatementRolledMonth = currentYm;
    }

    // 2. Payment Due Date Cycle: Push actionable settlement card
    if (todayDay >= card.dueDay && card.currentBilled > 0 && card.lastDuePromptedMonth !== currentYm) {
      const minDue = Math.max(Number((card.currentBilled * 0.05).toFixed(2)), 50.00);

      state.notifications.unshift({
        id: "notif_due_" + card.id + "_" + currentYm,
        type: "action_due",
        cardId: card.id,
        cardName: card.name,
        billedAmount: card.currentBilled,
        minDue: minDue,
        title: `🔔 Payment Due: ${card.name}`,
        time: new Date().toISOString(),
        isRead: false,
        decision: null,
        body: `Your statement balance of ${formatCurrency(card.currentBilled)} is due on Day ${card.dueDay}. Minimum payment (5% CCRIS rule): ${formatCurrency(minDue)}.`
      });

      card.lastDuePromptedMonth = currentYm;
    }
  });

  saveStorage();
  updateNotificationBadge();
}

function updateNotificationBadge() {
  if (!dom.notifBadgeCount) return;
  const unreadCount = state.notifications.filter(n => !n.isRead).length;
  if (unreadCount > 0) {
    dom.notifBadgeCount.style.display = "inline-block";
    dom.notifBadgeCount.textContent = unreadCount > 9 ? "9+" : unreadCount;
  } else {
    dom.notifBadgeCount.style.display = "none";
  }
}

function renderNotificationsFeed() {
  if (!dom.notificationsList) return;

  const tab = state.activeNotifTab || "all";
  let list = state.notifications;

  if (tab === "action") {
    list = list.filter(n => n.type === "action_due" && !n.decision);
  } else if (tab === "statements") {
    list = list.filter(n => n.type === "statement" || n.type === "guide");
  }

  if (!list.length) {
    dom.notificationsList.innerHTML = `<p class="empty-state">No notifications right now. You're all caught up!</p>`;
    return;
  }

  dom.notificationsList.innerHTML = list.map(n => {
    let actionHtml = "";
    if (n.type === "action_due") {
      if (n.decision) {
        actionHtml = `<div class="btn-decision-stamped">✓ ${escapeHtml(n.decision)}</div>`;
      } else if (n.loanId) {
        actionHtml = `
          <div class="notif-decision-actions">
            <button type="button" class="btn-notif-action btn-action-settle" onclick="settleLoanFromNotification('${n.id}', '${n.loanId}')">✓ Pay Installment (${formatCurrency(n.billedAmount)})</button>
            <button type="button" class="btn-text" style="font-size:0.72rem;" onclick="dismissNotification('${n.id}')">Later</button>
          </div>
        `;
      } else {
        actionHtml = `
          <div class="notif-decision-actions">
            <button type="button" class="btn-notif-action btn-action-settle" onclick="settleCardBillInFull('${n.id}', '${n.cardId}')">✓ Pay in Full (${formatCurrency(n.billedAmount)})</button>
            <button type="button" class="btn-notif-action btn-action-partial" onclick="settleCardBillPartial('${n.id}', '${n.cardId}')">⚡ Partial</button>
            <button type="button" class="btn-text" style="font-size:0.72rem;" onclick="dismissNotification('${n.id}')">Later</button>
          </div>
        `;
      }
    }

    const timeStr = new Date(n.time).toLocaleDateString(undefined, { month: "short", day: "numeric" });

    return `
      <div class="notif-card ${!n.isRead ? "unread" : ""}" data-id="${n.id}">
        <div class="notif-card-header">
          <span class="notif-card-title">${escapeHtml(n.title)}</span>
          <span class="notif-time-badge">${timeStr}</span>
        </div>
        <p class="notif-card-body">${escapeHtml(n.body)}</p>
        ${actionHtml}
      </div>
    `;
  }).join("");
}


function settleLoanFromNotification(notifId, loanId) {
  const loan = state.loans.find(l => l.id === loanId);
  const notif = state.notifications.find(n => n.id === notifId);
  if (!loan) return;

  if (processLoanPayment(loan, loan.monthlyInstallment)) {
    if (notif) {
      notif.decision = `Paid ${formatCurrency(loan.monthlyInstallment)} on ${new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
      notif.isRead = true;
    }
    saveStorage();
    render();
    renderNotificationsFeed();
    showToast(`Confirmed ${loan.name} installment!`);
  }
}

function settleCardBillInFull(notifId, cardId) {
  const card = state.creditCards.find(c => c.id === cardId);
  const notif = state.notifications.find(n => n.id === notifId);

  if (card && card.currentBilled > 0) {
    const paidAmt = card.currentBilled;
    if (executeBillSettlement(card, paidAmt)) {
      if (notif) {
        notif.decision = `Settled in Full (${formatCurrency(paidAmt)}) on ${new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
        notif.isRead = true;
      }
      saveStorage();
      render();
      renderNotificationsFeed();
      showToast(`Settled ${card.name} bill in full!`);
    }
  }
}

function settleCardBillPartial(notifId, cardId) {
  const card = state.creditCards.find(c => c.id === cardId);
  const notif = state.notifications.find(n => n.id === notifId);

  if (card && card.currentBilled > 0) {
    const amtStr = prompt(`Enter amount to pay for ${card.name} (Current Bill: ${formatCurrency(card.currentBilled)}):`);
    const paid = parseFloat(amtStr);
    if (!isNaN(paid) && paid > 0) {
      const settleAmt = Math.min(paid, card.currentBilled);
      if (executeBillSettlement(card, settleAmt)) {
        if (notif) {
          notif.decision = `Paid ${formatCurrency(settleAmt)} (Remaining: ${formatCurrency(card.currentBilled)}) on ${new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
          notif.isRead = true;
        }
        saveStorage();
        render();
        renderNotificationsFeed();
        showToast(`Recorded partial payment of ${formatCurrency(settleAmt)}!`);
      }
    }
  }
}

function dismissNotification(notifId) {
  const notif = state.notifications.find(n => n.id === notifId);
  if (notif) {
    notif.isRead = true;
    saveStorage();
    updateNotificationBadge();
    renderNotificationsFeed();
  }
}


// ================= DEBIT CARDS & CARD PICKER ENGINES =================
function renderDebitCards() {
  if (!dom.debitCardsGrid) return;

  const currentYm = getLocalDateString().substring(0, 7);
  let totalDebitSpend = 0;

  state.debitCards.forEach(dc => {
    totalDebitSpend += (dc.totalSpentThisMonth || 0);
  });

  if (dom.debitCardsTotalSpend) {
    dom.debitCardsTotalSpend.textContent = `Monthly Debit Spending: ${formatCurrency(totalDebitSpend)} • 0% DSR`;
  }

  if (!state.debitCards.length) {
    dom.debitCardsGrid.innerHTML = `<p class="empty-state">No debit cards added. Click "+ Add Debit Card" to track direct bank card spending.</p>`;
    return;
  }

  dom.debitCardsGrid.innerHTML = state.debitCards.map(dc => {
    const spent = dc.totalSpentThisMonth || 0;
    return `
      <div class="debit-card-item" data-bank="${escapeHtml(dc.bank)}" data-id="${dc.id}">
        <div class="card-top-row">
          <div class="card-identity">
            <div class="card-chip-box" style="border-color:#10b981;">💳</div>
            <div>
              <div class="card-title-text">${escapeHtml(dc.name)}</div>
              <div class="card-bank-sub">${escapeHtml(dc.bank)} • Direct Bank Account Debit</div>
            </div>
          </div>
          <button type="button" class="btn-delete" title="Delete debit card" onclick="deleteDebitCard('${dc.id}')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
          </button>
        </div>

        <div class="card-balances-row">
          <div class="card-balance-col" style="grid-column: span 2;">
            <span class="stat-mini-label">Spent This Month (${new Date().toLocaleString(undefined, { month: "short" })})</span>
            <strong class="card-balance-val">${formatCurrency(spent)}</strong>
          </div>
        </div>

        <div class="card-dsr-row">
          <span>DSR Status:</span>
          <span class="badge-debit-dsr">🟢 0% DSR • Direct Debit (No Debt)</span>
        </div>

        <div class="card-actions-row">
          <button type="button" class="btn-outline-sm" onclick="openEditDebitCardModal('${dc.id}')">
            ✏️ Edit Debit Card
          </button>
          <span style="font-size:0.72rem; color:var(--text-muted);">Instant cash deduction</span>
        </div>
      </div>
    `;
  }).join("");
}

function populateLinkedBankSelect(selectedBankId) {
  const sel = document.getElementById("debit-card-linked-bank");
  if (!sel) return;
  if (!state.bankAccounts.length) {
    sel.innerHTML = '<option value="">(No bank accounts configured)</option>';
    return;
  }
  sel.innerHTML = state.bankAccounts.map(b => {
    const isSel = (selectedBankId && (selectedBankId === b.id || selectedBankId === b.bank));
    return `<option value="${b.id}" ${isSel ? "selected" : ""}>${escapeHtml(b.name)} (${escapeHtml(b.bank)})</option>`;
  }).join("");
}

function openAddDebitCardModalForBank(bankId, bankName, provider) {
  if (dom.debitCardEditId) dom.debitCardEditId.value = "";
  if (dom.debitCardName) dom.debitCardName.value = `${provider || bankName} Visa Debit`;
  if (dom.debitCardBank) dom.debitCardBank.value = provider || "Maybank";
  populateLinkedBankSelect(bankId);
  const titleEl = document.getElementById("debit-modal-title");
  if (titleEl) titleEl.textContent = `Link Debit Card to ${bankName}`;
  dom.debitCardDialog?.showModal ? dom.debitCardDialog.showModal() : alert("Add debit card");
}

function openEditDebitCardModal(cardId) {
  const card = state.debitCards.find(c => c.id === cardId);
  if (!card) return;

  dom.debitCardEditId.value = card.id;
  dom.debitCardName.value = card.name;
  dom.debitCardBank.value = card.bank;
  populateLinkedBankSelect(card.bankAccountId || card.bank);

  document.getElementById("debit-modal-title").textContent = "Edit Debit Card";
  dom.debitCardDialog?.showModal ? dom.debitCardDialog.showModal() : alert("Edit debit card");
}

function deleteDebitCard(cardId) {
  const idx = state.debitCards.findIndex(c => c.id === cardId);
  if (idx === -1) return;
  const deleted = state.debitCards.splice(idx, 1)[0];
  if (state.selectedCardId === cardId) {
    state.selectedCardId = null;
    state.selectedCardName = null;
    state.selectedCardType = null;
    if (dom.selectedSourceId) dom.selectedSourceId.value = "";
    if (dom.selectedSourceName) dom.selectedSourceName.value = "";
    if (dom.pillCardTx) dom.pillCardTx.textContent = "💳 Card ▾";
  }
  saveStorage();
  render();
  showToast(`Deleted debit card "${deleted.name}"`);
}

function handleSaveDebitCard(e) {
  e.preventDefault();
  const name = dom.debitCardName.value.trim();
  const bank = dom.debitCardBank.value;
  const linkedBankId = document.getElementById("debit-card-linked-bank")?.value || "";

  if (!name) return showToast("Please enter a card nickname.");

  const editId = dom.debitCardEditId ? dom.debitCardEditId.value : "";
  if (editId) {
    const card = state.debitCards.find(c => c.id === editId);
    if (card) {
      card.name = name;
      card.bank = bank;
      card.bankAccountId = linkedBankId || card.bankAccountId || null;
      showToast(`Updated "${name}"!`);
    }
  } else {
    state.debitCards.push({
      id: "debit_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      name,
      bank,
      bankAccountId: linkedBankId || null,
      totalSpentThisMonth: 0.00,
      createdAt: Date.now()
    });
    showToast(`Added debit card "${name}"!`);
  }

  saveStorage();
  render();
  dom.debitCardDialog?.close();
}


// ================= BANK ACCOUNTS MANAGEMENT (BUG 2) =================
function renderBankAccounts() {
  if (!dom.bankAccountsGrid) return;

  const currentYm = getLocalDateString().substring(0, 7);

  if (dom.banksTotalSummary) {
    if (state.bankAccounts && state.bankAccounts.length > 0) {
      let totalLiquidBalance = 0;
      state.bankAccounts.forEach(b => totalLiquidBalance += (b.balance || 0));
      dom.banksTotalSummary.textContent = `${state.bankAccounts.length} Active Account${state.bankAccounts.length > 1 ? "s" : ""} • Liquid Balance: ${formatCurrency(totalLiquidBalance)}`;
    } else {
      dom.banksTotalSummary.textContent = "Liquid accounts with attached debit cards";
    }
  }

  if (!state.bankAccounts || !state.bankAccounts.length) {
    dom.bankAccountsGrid.innerHTML = `<p class="empty-state">No bank accounts added yet. Click "+ Add Account" to configure liquid assets.</p>`;
    return;
  }

  dom.bankAccountsGrid.innerHTML = state.bankAccounts.map(b => {
    // Reconcile live balance dynamically from baseline and transactions
    b.balance = getReconciledBankBalance(b);

    // 1. Calculate Bank Transfer Outflow for this account in the active month
    let transferOutflow = 0;
    state.transactions.forEach(t => {
      if (t.date && t.date.startsWith(currentYm) && t.type === "expense" && t.wallet === "Bank Transfer") {
        if (t.cardId === b.id || t.cardName === b.name || (!t.cardId && !t.cardName && t.note && t.note.toLowerCase().includes(b.bank.toLowerCase()))) {
          transferOutflow += t.amount;
        }
      }
    });

    // 2. Find Attached Debit Card (Parent-Child) and calculate dynamic monthly spend
    const attachedDebit = state.debitCards.find(dc => dc.bankAccountId === b.id || dc.bank === b.bank || (dc.name && dc.name.toLowerCase().includes(b.bank.toLowerCase())));
    const debitSpent = attachedDebit ? getDebitCardMonthlySpend(attachedDebit.id, attachedDebit.name, attachedDebit.bank) : 0;
    if (attachedDebit) {
      attachedDebit.totalSpentThisMonth = debitSpent;
    }
    const totalOutflow = transferOutflow + debitSpent;

    let attachedCardHtml = "";
    if (attachedDebit) {
      attachedCardHtml = `
        <div class="nested-debit-card-box">
          <div class="nested-debit-card-header">
            <div class="nested-debit-left">
              <span class="nested-debit-icon">💳</span>
              <div>
                <div class="nested-debit-title">Attached Debit Card: <strong>${escapeHtml(attachedDebit.name)}</strong></div>
                <div class="nested-debit-sub">Spent this month: <strong>${formatCurrency(debitSpent)}</strong> | <span class="badge-debit-dsr">0% DSR Direct Debit</span></div>
              </div>
            </div>
            <div class="nested-debit-actions">
              <button type="button" class="btn-outline-xs" title="Edit debit card" onclick="openEditDebitCardModal('${attachedDebit.id}')">✏️ Edit</button>
              <button type="button" class="btn-delete-xs" title="Delete debit card" onclick="deleteDebitCard('${attachedDebit.id}')">✕</button>
            </div>
          </div>
        </div>
      `;
    } else {
      attachedCardHtml = `
        <div class="nested-link-debit-box">
          <button type="button" class="btn-link-debit" onclick="openAddDebitCardModalForBank('${b.id}', '${escapeHtml(b.name)}', '${escapeHtml(b.bank)}')">
            ➕ Link a Debit Card to this Account
          </button>
        </div>
      `;
    }

    return `
      <div class="bank-account-item" data-bank="${escapeHtml(b.bank)}" data-id="${b.id}">
        <div class="card-top-row">
          <div class="card-identity">
            <div class="card-chip-box" style="border-color:#2563eb; color:#2563eb;">🏦</div>
            <div>
              <div class="card-title-text">${escapeHtml(b.name)}</div>
              <div class="card-bank-sub">${escapeHtml(b.bank)} • Liquid Funds Container</div>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:0.4rem;">
            <button type="button" class="btn-outline-sm" onclick="openEditBankAccountModal('${b.id}')">
              ✏️ Edit
            </button>
            <button type="button" class="btn-delete" title="Delete bank account" onclick="deleteBankAccount('${b.id}')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            </button>
          </div>
        </div>

        <div class="card-balances-row">
          <div class="card-balance-col">
            <span class="stat-mini-label">Balance</span>
            <div style="display:flex; align-items:center; flex-wrap:wrap; gap:0.35rem;">
              <strong class="card-balance-val ${b.balance < 0 ? 'text-danger' : ''}" style="${b.balance >= 0 ? 'color:var(--primary);' : ''}">${formatCurrency(b.balance || 0)}</strong>
              ${b.balance < 0 ? '<span class="badge-overdrawn">⚠️ Overdrawn</span>' : ''}
            </div>
          </div>
          <div class="card-balance-col">
            <span class="stat-mini-label">Combined Outflow (${new Date().toLocaleString(undefined, { month: "short" })})</span>
            <strong class="card-balance-val text-danger">${formatCurrency(totalOutflow)}</strong>
          </div>
        </div>

        <div class="card-dsr-row" style="font-size:0.75rem;">
          <span>Outflow Breakdown:</span>
          <span style="color:var(--text-muted);">Transfers: ${formatCurrency(transferOutflow)} • Debit: ${formatCurrency(debitSpent)}</span>
        </div>

        <!-- Attached Debit Card (Parent-Child) -->
        ${attachedCardHtml}
      </div>
    `;
  }).join("");
}

function openAddBankAccountModal() {
  if (dom.bankAccountEditId) dom.bankAccountEditId.value = "";
  if (dom.bankAccountName) dom.bankAccountName.value = "";
  if (dom.bankAccountProvider) dom.bankAccountProvider.value = "Maybank";
  const balInput = document.getElementById("bank-account-balance");
  if (balInput) balInput.value = "";
  const titleEl = document.getElementById("bank-modal-title");
  if (titleEl) titleEl.textContent = "Add Bank Account";
  dom.bankAccountDialog?.showModal ? dom.bankAccountDialog.showModal() : alert("Add bank account");
}

function openEditBankAccountModal(bankId) {
  const bank = state.bankAccounts.find(b => b.id === bankId);
  if (!bank) return;

  if (dom.bankAccountEditId) dom.bankAccountEditId.value = bank.id;
  if (dom.bankAccountName) dom.bankAccountName.value = bank.name;
  if (dom.bankAccountProvider) dom.bankAccountProvider.value = bank.bank;
  const balInput = document.getElementById("bank-account-balance");
  if (balInput) balInput.value = (bank.balance !== undefined && bank.balance !== null) ? bank.balance : "";

  const titleEl = document.getElementById("bank-modal-title");
  if (titleEl) titleEl.textContent = "Edit Bank Account";
  dom.bankAccountDialog?.showModal ? dom.bankAccountDialog.showModal() : alert("Edit bank account");
}

function deleteBankAccount(bankId) {
  const idx = state.bankAccounts.findIndex(b => b.id === bankId);
  if (idx === -1) return;
  const deleted = state.bankAccounts.splice(idx, 1)[0];
  if (state.selectedBankId === bankId) {
    state.selectedBankId = null;
    state.selectedBankName = null;
    if (dom.selectedSourceId) dom.selectedSourceId.value = "";
    if (dom.selectedSourceName) dom.selectedSourceName.value = "";
    if (dom.pillBankTx) dom.pillBankTx.textContent = "🏦 Bank Transfer ▾";
  }
  saveStorage();
  render();
  showToast(`Deleted bank account "${deleted.name}"`);
}

function handleSaveBankAccount(e) {
  e.preventDefault();
  const name = dom.bankAccountName ? dom.bankAccountName.value.trim() : "";
  const provider = dom.bankAccountProvider ? dom.bankAccountProvider.value : "Maybank";
  const balInput = document.getElementById("bank-account-balance");
  const balance = balInput ? (parseFloat(balInput.value) || 0) : 0;

  if (!name) return showToast("Please enter an account name.");

  const editId = dom.bankAccountEditId ? dom.bankAccountEditId.value : "";
  if (editId) {
    const bank = state.bankAccounts.find(b => b.id === editId);
    if (bank) {
      bank.name = name;
      bank.bank = provider;
      bank.initialBalance = Number(balance.toFixed(2));
      bank.balance = Number(balance.toFixed(2));
      showToast(`Updated "${name}"!`);
    }
  } else {
    state.bankAccounts.push({
      id: "bank_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      name,
      bank: provider,
      initialBalance: Number(balance.toFixed(2)),
      balance: Number(balance.toFixed(2)),
      createdAt: Date.now()
    });
    showToast(`Added bank account "${name}"!`);
  }

  saveStorage();
  render();
  dom.bankAccountDialog?.close();
}

// ================= BANK PICKER MODAL (OPTION A) =================
function openBankPicker() {
  if (!dom.selectBankDialog) return;

  if (dom.pickerBanksList) {
    if (!state.bankAccounts || !state.bankAccounts.length) {
      dom.pickerBanksList.innerHTML = `<p class="empty-state" style="padding:0.75rem;">No bank accounts configured. Click "+ Add Bank Account" below.</p>`;
    } else {
      const activeId = state.pickerTargetContext === "subscription"
        ? (dom.subSelectedSourceId ? dom.subSelectedSourceId.value : "")
        : (dom.selectedSourceId ? dom.selectedSourceId.value : "");

      dom.pickerBanksList.innerHTML = state.bankAccounts.map(b => {
        const isSel = activeId === b.id;
        return `
          <div class="picker-card-option ${isSel ? "selected" : ""}" onclick="selectBankAccount('${b.id}', '${escapeHtml(b.name)}')">
            <div class="picker-card-left">
              <div class="picker-chip-icon" style="color:#2563eb;">🏦</div>
              <div>
                <div class="picker-card-name">${escapeHtml(b.name)}</div>
                <div class="picker-card-bank">${escapeHtml(b.bank)} • Direct Transfer</div>
              </div>
            </div>
            <div class="picker-card-right">
              <span class="picker-card-tag" style="background:rgba(37,99,235,0.1); color:#2563eb;">Bank Account</span>
            </div>
          </div>
        `;
      }).join("");
    }
  }

  dom.selectBankDialog?.showModal ? dom.selectBankDialog.showModal() : null;
}

function selectBankAccount(bankId, bankName) {
  state.selectedBankId = bankId;
  state.selectedBankName = bankName;

  if (state.pickerTargetContext === "subscription") {
    if (dom.subSelectedWallet) dom.subSelectedWallet.value = "Bank Transfer";
    if (dom.subSelectedSourceId) dom.subSelectedSourceId.value = bankId;
    if (dom.subSelectedSourceName) dom.subSelectedSourceName.value = bankName;

    document.querySelectorAll("#sub-wallet-pill-group .wallet-pill-btn").forEach(b => b.classList.remove("active"));
    if (dom.pillBankSub) {
      dom.pillBankSub.classList.add("active");
      dom.pillBankSub.textContent = `🏦 ${bankName} ▾`;
    }
  } else {
    // Transaction context
    state.selectedCardId = null;
    state.selectedCardType = null;
    state.selectedCardName = null;

    if (dom.selectedWallet) dom.selectedWallet.value = "Bank Transfer";
    if (dom.selectedSourceId) dom.selectedSourceId.value = bankId;
    if (dom.selectedSourceName) dom.selectedSourceName.value = bankName;

    document.querySelectorAll("#wallet-pill-group .wallet-pill-btn").forEach(b => b.classList.remove("active"));
    if (dom.pillBankTx) {
      dom.pillBankTx.classList.add("active");
      dom.pillBankTx.textContent = `🏦 ${bankName} ▾`;
    }
    if (dom.pillCardTx) {
      dom.pillCardTx.textContent = "💳 Card ▾";
    }
  }

  dom.selectBankDialog?.close();
  showToast(`Selected ${bankName}!`);
}

// Card Picker Modal (Hierarchy: Credit Cards vs Debit Cards)

// ================= INTERACTIVE CARD PICKER (CREDIT VS DEBIT) =================
function openCardPicker() {
  if (!dom.selectCardDialog) return;
  reconcileCreditCardUnbilled();

  // 1. Populate Credit Cards List
  if (dom.pickerCreditCardsList) {
    if (!state.creditCards || !state.creditCards.length) {
      dom.pickerCreditCardsList.innerHTML = `<p class="empty-state" style="padding:0.75rem;">No credit cards configured. Click "+ Add New Card" below.</p>`;
    } else {
      dom.pickerCreditCardsList.innerHTML = state.creditCards.map(c => {
        const activeId = state.pickerTargetContext === "subscription"
          ? (dom.subSelectedSourceId ? dom.subSelectedSourceId.value : "")
          : (state.selectedCardId || (dom.selectedSourceId ? dom.selectedSourceId.value : ""));
        const isSel = activeId === c.id;
        return `
          <div class="picker-card-option ${isSel ? "selected" : ""}" onclick="selectPaymentCard('credit', '${c.id}', '${escapeHtml(c.name)}')">
            <div class="picker-card-left">
              <div class="picker-chip-icon" style="color:var(--primary);">💳</div>
              <div>
                <div class="picker-card-name">${escapeHtml(c.name)}</div>
                <div class="picker-card-bank">${escapeHtml(c.bank)} • Cut-off: Day ${c.statementDay}</div>
              </div>
            </div>
            <div class="picker-card-right">
              <span class="picker-card-balance">${formatCurrency(c.unbilledBalance)}</span>
              <span class="picker-card-tag">Unbilled Spend</span>
            </div>
          </div>
        `;
      }).join("");
    }
  }

  // 2. Populate Debit Cards List
  if (dom.pickerDebitCardsList) {
    if (!state.debitCards || !state.debitCards.length) {
      dom.pickerDebitCardsList.innerHTML = `<p class="empty-state" style="padding:0.75rem;">No debit cards configured. Click "+ Add New Card" below.</p>`;
    } else {
      dom.pickerDebitCardsList.innerHTML = state.debitCards.map(dc => {
        const activeId = state.pickerTargetContext === "subscription"
          ? (dom.subSelectedSourceId ? dom.subSelectedSourceId.value : "")
          : (state.selectedCardId || (dom.selectedSourceId ? dom.selectedSourceId.value : ""));
        const isSel = activeId === dc.id;
        const currentDebitSpend = getDebitCardMonthlySpend(dc.id, dc.name, dc.bank);
        dc.totalSpentThisMonth = currentDebitSpend;
        return `
          <div class="picker-card-option ${isSel ? "selected" : ""}" onclick="selectPaymentCard('debit', '${dc.id}', '${escapeHtml(dc.name)}')">
            <div class="picker-card-left">
              <div class="picker-chip-icon" style="color:#059669;">💳</div>
              <div>
                <div class="picker-card-name">${escapeHtml(dc.name)}</div>
                <div class="picker-card-bank">${escapeHtml(dc.bank)} • Direct Bank Debit</div>
              </div>
            </div>
            <div class="picker-card-right">
              <span class="picker-card-balance">${formatCurrency(currentDebitSpend)}</span>
              <span class="picker-card-tag">Spent This Month</span>
            </div>
          </div>
        `;
      }).join("");
    }
  }

  dom.selectCardDialog?.showModal ? dom.selectCardDialog.showModal() : null;
}

function selectPaymentCard(type, cardId, cardName) {
  if (state.pickerTargetContext === "subscription") {
    if (dom.subSelectedWallet) {
      dom.subSelectedWallet.value = type === "credit" ? "Credit Card" : "Debit Card";
    }
    if (dom.subSelectedSourceId) dom.subSelectedSourceId.value = cardId;
    if (dom.subSelectedSourceName) dom.subSelectedSourceName.value = cardName;

    document.querySelectorAll("#sub-wallet-pill-group .wallet-pill-btn").forEach(b => b.classList.remove("active"));
    if (dom.pillCardSub) {
      dom.pillCardSub.classList.add("active");
      dom.pillCardSub.textContent = `💳 ${cardName} ▾`;
    }
  } else {
    state.selectedCardId = cardId;
    state.selectedCardType = type;
    state.selectedCardName = cardName;
    state.selectedBankId = null;
    state.selectedBankName = null;

    if (dom.selectedWallet) {
      dom.selectedWallet.value = type === "credit" ? "Credit Card" : "Debit Card";
    }
    if (dom.selectedSourceId) dom.selectedSourceId.value = cardId;
    if (dom.selectedSourceName) dom.selectedSourceName.value = cardName;

    document.querySelectorAll("#wallet-pill-group .wallet-pill-btn").forEach(b => b.classList.remove("active"));
    if (dom.pillCardTx) {
      dom.pillCardTx.classList.add("active");
      dom.pillCardTx.textContent = `💳 ${cardName} ▾`;
    }
    if (dom.pillBankTx) {
      dom.pillBankTx.textContent = "🏦 Bank Transfer ▾";
    }
  }

  dom.selectCardDialog?.close();
  showToast(`Selected ${cardName}!`);
}

function renderCreditCards() {
  if (!dom.creditCardsGrid) return;
  reconcileCreditCardUnbilled();

  let totalCardDebt = 0;
  let totalDsrCommitment = 0;

  state.creditCards.forEach(c => {
    const totalBal = c.currentBilled + c.unbilledBalance;
    totalCardDebt += totalBal;

    // BNM 5% CCRIS Rule: If carrying balance or unpaid bill, 5% of balance or RM50
    if (!c.payInFull || c.currentBilled > 0) {
      const card5Pct = Math.max(Number((totalBal * 0.05).toFixed(2)), 50.00);
      totalDsrCommitment += card5Pct;
    }
  });

  if (dom.cardsTotalCommitment) {
    dom.cardsTotalCommitment.textContent = `Total Card Debt: ${formatCurrency(totalCardDebt)} • 5% CCRIS: ${formatCurrency(totalDsrCommitment)}`;
  }

  if (!state.creditCards.length) {
    dom.creditCardsGrid.innerHTML = `<p class="empty-state">No credit cards added. Click "+ Add Card" to track billing cycles, unbilled spends, and DSR impact.</p>`;
    return;
  }

  dom.creditCardsGrid.innerHTML = state.creditCards.map(c => {
    const totalBal = c.currentBilled + c.unbilledBalance;
    const limit = c.creditLimit || 0;
    const utilPct = limit > 0 ? ((totalBal / limit) * 100).toFixed(1) : 0;
    const isOver30 = utilPct > 30;

    let dsrBadgeHtml = "";
    if (c.payInFull && c.currentBilled === 0) {
      dsrBadgeHtml = `<span style="color:#059669; font-weight:700;">🟢 Pay in Full (0% DSR impact)</span>`;
    } else {
      const minDsr = Math.max(Number((totalBal * 0.05).toFixed(2)), 50.00);
      dsrBadgeHtml = `<span style="color:#ef4444; font-weight:700;">⚠️ 5% CCRIS: ${formatCurrency(minDsr)} (~15-18% p.a.)</span>`;
    }

    return `
      <div class="credit-card-item" data-bank="${escapeHtml(c.bank)}" data-id="${c.id}">
        <div class="card-top-row">
          <div class="card-identity">
            <div class="card-chip-box">💳</div>
            <div>
              <div class="card-title-text">${escapeHtml(c.name)}</div>
              <div class="card-bank-sub">${escapeHtml(c.bank)} • Cut-off: Day ${c.statementDay} • Due: Day ${c.dueDay}</div>
            </div>
          </div>
          <button type="button" class="btn-delete" title="Delete card" onclick="deleteCreditCard('${c.id}')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
          </button>
        </div>

        <div class="card-balances-row">
          <div class="card-balance-col">
            <span class="stat-mini-label">Current Bill (Due Soon)</span>
            <strong class="card-balance-val ${c.currentBilled > 0 ? "text-danger" : ""}">${formatCurrency(c.currentBilled)}</strong>
          </div>
          <div class="card-balance-col">
            <span class="stat-mini-label">Unbilled Spends (Next Mo)</span>
            <strong class="card-balance-val">${formatCurrency(c.unbilledBalance)}</strong>
          </div>
        </div>

        ${limit > 0 ? `
          <div class="card-utilization-wrapper">
            <div class="card-util-legend">
              <span>Utilization: ${utilPct}%</span>
              <span>Limit: ${formatCurrency(limit)}</span>
            </div>
            <div class="card-util-track">
              <div class="card-util-fill ${isOver30 ? "danger" : ""}" style="width: ${Math.min(100, utilPct)}%;"></div>
            </div>
          </div>
        ` : ""}

        <div class="card-dsr-row">
          <span>DSR Status:</span>
          ${dsrBadgeHtml}
        </div>

        <div class="card-actions-row">
          <button type="button" class="btn-outline-sm" onclick="openEditCardModal('${c.id}')">
            ✏️ Edit Card / Balances
          </button>
          ${c.currentBilled > 0 ? `
            <button type="button" class="btn-primary-sm" onclick="quickSettleCardPrompt('${c.id}')">
              ⚡ Settle Bill
            </button>
          ` : `<span style="font-size:0.72rem; color:var(--text-muted);">✓ Bill settled</span>`}
        </div>
      </div>
    `;
  }).join("");
}

function populateCardLinkedBankSelect(selectedBankId) {
  const sel = document.getElementById("card-linked-bank");
  if (!sel) return;
  if (!state.bankAccounts || !state.bankAccounts.length) {
    sel.innerHTML = '<option value="">(No bank accounts configured)</option>';
    return;
  }
  sel.innerHTML = state.bankAccounts.map(b => {
    const isSel = selectedBankId ? (selectedBankId === b.id || selectedBankId === b.bank) : false;
    const bal = getReconciledBankBalance(b);
    return `<option value="${b.id}" ${isSel ? "selected" : ""}>🏦 ${escapeHtml(b.name)} (Balance: ${formatCurrency(bal)})</option>`;
  }).join("");
}

function openEditCardModal(cardId) {
  const card = state.creditCards.find(c => c.id === cardId);
  if (!card) return;

  dom.cardEditId.value = card.id;
  dom.cardName.value = card.name;
  dom.cardBank.value = card.bank;
  dom.cardStatementDay.value = card.statementDay;
  dom.cardDueDay.value = card.dueDay;
  dom.cardLimit.value = card.creditLimit || "";
  dom.cardBilled.value = card.currentBilled;
  dom.cardUnbilled.value = card.unbilledBalance;
  dom.cardPayInFull.checked = !!card.payInFull;
  populateCardLinkedBankSelect(card.linkedBankAccountId || card.bank);

  $("card-modal-title").textContent = "Edit Credit Card & Balances";
  dom.cardDialog?.showModal ? dom.cardDialog.showModal() : alert("Edit card dialog");
}

function executeBillSettlement(card, settleAmt, sourceBank) {
  const bank = sourceBank || state.bankAccounts.find(b => b.id === card.linkedBankAccountId || b.bank === card.bank) || state.bankAccounts[0];
  const bankName = bank ? bank.name : "Bank Account";
  const bankBal = bank ? getReconciledBankBalance(bank) : 0;

  if (bank && settleAmt > bankBal) {
    const shortfall = (settleAmt - bankBal).toFixed(2);
    if (!confirm(`⚠️ Insufficient Funds in ${bankName}!

Available Balance: ${formatCurrency(bankBal)}
Settlement Amount: ${formatCurrency(settleAmt)}
Shortfall: ${formatCurrency(shortfall)}

Proceed anyway (Account will become overdrawn)?`)) {
      return false;
    }
  }

  // 1. Deduct bill from credit card
  card.currentBilled = Math.max(0, Number((card.currentBilled - settleAmt).toFixed(2)));
  card.payInFull = (card.currentBilled === 0);

  // 2. Deduct funds from linked bank account
  if (bank) {
    bank.balance = Number(((bank.balance || 0) - settleAmt).toFixed(2));
  }

  // 3. Log settlement expense into ledger with explicit credit card linkage
  state.transactions.unshift({
    id: "tx_settle_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
    type: "expense",
    amount: settleAmt,
    category: "Bills & Utilities",
    wallet: "Bank Transfer",
    cardId: bank ? bank.id : null,
    cardName: bank ? bank.name : "Bank Transfer",
    cardType: null,
    isSettlement: true,
    settledCardId: card.id,
    settledCardName: card.name,
    date: getLocalDateString(),
    note: `Credit Card Settlement: ${card.name}`,
    createdAt: Date.now()
  });

  return true;
}

function quickSettleCardPrompt(cardId) {
  const card = state.creditCards.find(c => c.id === cardId);
  if (!card) return;
  if (card.currentBilled <= 0) return showToast("No current bill to settle.");

  const bank = state.bankAccounts.find(b => b.id === card.linkedBankAccountId || b.bank === card.bank) || state.bankAccounts[0];
  const bankBal = bank ? getReconciledBankBalance(bank) : 0;
  const bankName = bank ? bank.name : "Bank Account";

  const choice = prompt(
    `⚡ Settle Credit Card Bill: ${card.name}
` +
    `Current Bill Due: ${formatCurrency(card.currentBilled)}
` +
    `Default Payment Source: ${bankName} (Available Balance: ${formatCurrency(bankBal)})

` +
    `Choose repayment option:
` +
    `• Enter "F" or press OK to Pay in Full (${formatCurrency(card.currentBilled)})
` +
    `• Enter partial amount (e.g. 100 or 50 for minimum)
` +
    `• Press Cancel to abort`,
    "F"
  );

  if (choice === null) return;

  let settleAmt = 0;
  const trimmed = choice.trim().toUpperCase();
  if (trimmed === "F" || trimmed === "" || trimmed === "FULL") {
    settleAmt = card.currentBilled;
  } else {
    const parsed = parseFloat(choice);
    if (isNaN(parsed) || parsed <= 0) return showToast("Invalid payment amount.");
    settleAmt = Math.min(parsed, card.currentBilled);
  }

  if (executeBillSettlement(card, settleAmt, bank)) {
    saveStorage();
    render();
    showToast(`Paid ${formatCurrency(settleAmt)} from ${bankName}! Bill updated.`);
  }
}

function deleteCreditCard(cardId) {
  const idx = state.creditCards.findIndex(c => c.id === cardId);
  if (idx === -1) return;
  const deleted = state.creditCards.splice(idx, 1)[0];
  if (state.selectedCardId === cardId) {
    state.selectedCardId = null;
    state.selectedCardName = null;
    state.selectedCardType = null;
    if (dom.selectedSourceId) dom.selectedSourceId.value = "";
    if (dom.selectedSourceName) dom.selectedSourceName.value = "";
    if (dom.pillCardTx) dom.pillCardTx.textContent = "💳 Card ▾";
  }
  saveStorage();
  render();
  showToast(`Deleted card "${deleted.name}"`);
}

function handleSaveCreditCard(e) {
  e.preventDefault();
  const name = dom.cardName.value.trim();
  const bank = dom.cardBank.value;
  const statementDay = parseInt(dom.cardStatementDay.value, 10);
  const dueDay = parseInt(dom.cardDueDay.value, 10);
  const limit = parseFloat(dom.cardLimit.value) || 0;
  const billed = parseFloat(dom.cardBilled.value) || 0;
  const unbilled = parseFloat(dom.cardUnbilled.value) || 0;
  const payInFull = dom.cardPayInFull.checked;

  if (!name || isNaN(statementDay) || isNaN(dueDay)) {
    return showToast("Please enter valid card details.");
  }

  const linkedBankId = dom.cardLinkedBank ? dom.cardLinkedBank.value : "";
  const editId = dom.cardEditId.value;
  if (editId) {
    const card = state.creditCards.find(c => c.id === editId);
    if (card) {
      card.name = name;
      card.bank = bank;
      card.statementDay = statementDay;
      card.dueDay = dueDay;
      card.creditLimit = limit;
      card.currentBilled = billed;
      card.unbilledBalance = unbilled;
      card.payInFull = payInFull;
      card.linkedBankAccountId = linkedBankId || card.linkedBankAccountId || null;
      showToast(`Updated "${name}"!`);
    }
  } else {
    state.creditCards.push({
      id: "card_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      name,
      bank,
      statementDay,
      dueDay,
      creditLimit: limit,
      currentBilled: billed,
      unbilledBalance: unbilled,
      payInFull,
      linkedBankAccountId: linkedBankId || null,
      lastStatementRolledMonth: null,
      lastDuePromptedMonth: null,
      createdAt: Date.now()
    });
    showToast(`Added credit card "${name}"!`);
  }

  saveStorage();
  render();
  dom.cardDialog.close();
}

// Automated Release Changelog Registry (Catches new features automatically)
const APP_RELEASES_REGISTRY = [
  {
    version: "v41",
    title: "Version 41: Multi-Bank Card Pickers & Debit Cards",
    date: "September 2026",
    features: [
      "💳 Card Picker Sheet: Choose exact Credit Card or Debit Card per transaction or bill.",
      "🏦 Bank Transfer Sync: Select and track specific bank accounts (Maybank, CIMB, etc.).",
      "🟢 Debit Cards Tracker: 0% DSR direct bank debit tracking with monthly spend counter.",
      "🔔 Automatic Notification Center Archive: Every app update is automatically captured and archived."
    ]
  }
];

function checkReleaseOnboardingGuide() {
  const latestRelease = APP_RELEASES_REGISTRY[0];
  const lastSeen = localStorage.getItem(STORAGE_KEYS.lastSeenRelease);
  const notifId = "notif_release_" + latestRelease.version;

  // 1. Ensure update reminder is permanently archived in Notification Center
  if (!state.notifications.some(n => n.id === notifId)) {
    state.notifications.unshift({
      id: notifId,
      type: "guide",
      title: `🎉 ${latestRelease.title}`,
      time: new Date().toISOString(),
      isRead: (lastSeen === latestRelease.version),
      body: latestRelease.features.join(" • ")
    });
    saveStorage();
    updateNotificationBadge();
  }

  // 2. Only show the pop-up modal once if not yet seen for this release
  if (lastSeen !== latestRelease.version && dom.releaseGuideDialog) {
    const titleEl = dom.releaseGuideDialog.querySelector("h3");
    if (titleEl) titleEl.textContent = latestRelease.title;

    const bodyEl = dom.releaseGuideDialog.querySelector(".release-guide-body");
    if (bodyEl) {
      bodyEl.innerHTML = latestRelease.features.map(f => {
        const [heading, desc] = f.split(":");
        return `
          <div class="guide-feature-box">
            <strong>${heading}</strong>
            <p style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">${desc || ""}</p>
          </div>
        `;
      }).join("");
    }

    setTimeout(() => {
      dom.releaseGuideDialog?.showModal ? dom.releaseGuideDialog.showModal() : null;
    }, 600);
  }
}

function calculateLoanSpecs(principal, annualRate, tenureMonths, type) {
  let monthly = 0;
  let totalInterest = 0;

  if (type === "CAR_FLAT") {
    // Legacy Car Loan: Flat Rate
    const years = tenureMonths / 12;
    totalInterest = principal * (annualRate / 100) * years;
    monthly = (principal + totalInterest) / tenureMonths;
  } else if (type === "PTPTN") {
    // PTPTN Fixed Ujrah Fee: Flat Rate Formula
    const effectiveRate = (annualRate !== undefined && annualRate !== null && !isNaN(annualRate) && annualRate > 0) ? annualRate : 1.0;
    const tenureYears = tenureMonths / 12;
    totalInterest = principal * (effectiveRate / 100) * tenureYears;
    const totalRepayable = principal + totalInterest;
    monthly = totalRepayable / tenureMonths;
  } else if (type === "IPP_0") {
    // 0% Credit Card IPP
    totalInterest = 0;
    monthly = principal / tenureMonths;
  } else {
    // Reducing Balance Monthly Rest (New 2026 Car Loan Reform, SBR Home Mortgage, Personal)
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


function populateLoanLinkedBankSelect(selectedBankId) {
  const sel = document.getElementById("loan-linked-bank");
  if (!sel) return;
  if (!state.bankAccounts || !state.bankAccounts.length) {
    sel.innerHTML = '<option value="">(No bank accounts configured)</option>';
    return;
  }
  sel.innerHTML = state.bankAccounts.map(b => {
    const isSel = selectedBankId ? (selectedBankId === b.id || selectedBankId === b.bank) : false;
    const bal = getReconciledBankBalance(b);
    return `<option value="${b.id}" ${isSel ? "selected" : ""}>🏦 ${escapeHtml(b.name)} (Balance: ${formatCurrency(bal)})</option>`;
  }).join("");
}

function updateLoanFormMechanismConditioning() {
  const type = dom.loanTypeSelect ? dom.loanTypeSelect.value : "CAR_EIR";
  const rateGroup = dom.loanRateGroup;
  const rule78 = dom.rule78Callout;
  const rateInput = dom.loanRate;
  const rateLabel = dom.loanRateLabel;

  if (type === "CAR_FLAT") {
    if (rateGroup) rateGroup.style.display = "block";
    if (rule78) rule78.style.display = "block";
    if (rateLabel) rateLabel.textContent = "Flat Interest Rate (% p.a.) *";
    if (rateInput) {
      rateInput.disabled = false;
      if (rateInput.value === "1.00" || rateInput.value === "0.00" || !rateInput.value) rateInput.value = "3.20";
    }
  } else if (type === "PTPTN") {
    if (rateGroup) rateGroup.style.display = "block";
    if (rule78) rule78.style.display = "none";
    if (rateLabel) rateLabel.textContent = "PTPTN Fixed Ujrah Fee (1.0% p.a.)";
    if (rateInput) {
      rateInput.value = "1.00";
      rateInput.disabled = true;
    }
  } else if (type === "IPP_0") {
    if (rateGroup) rateGroup.style.display = "none";
    if (rule78) rule78.style.display = "none";
    if (rateInput) {
      rateInput.value = "0.00";
      rateInput.disabled = true;
    }
  } else {
    // CAR_EIR, HOME_SBR, PERSONAL
    if (rateGroup) rateGroup.style.display = "block";
    if (rule78) rule78.style.display = "none";
    if (rateLabel) rateLabel.textContent = type === "HOME_SBR" ? "Mortgage Rate (SBR + Spread % p.a.) *" : "Annual Interest Rate (% p.a.) *";
    if (rateInput) {
      rateInput.disabled = false;
      if (rateInput.value === "1.00" || rateInput.value === "0.00" || !rateInput.value) rateInput.value = "3.50";
    }
  }

  updateLoanLivePreview();
}

function openAddLoanModal() {
  if (dom.loanEditId) dom.loanEditId.value = "";
  if (dom.loanName) dom.loanName.value = "";
  if (dom.loanBank) dom.loanBank.value = "";
  if (dom.loanPrincipal) dom.loanPrincipal.value = "";
  if (dom.loanRate) dom.loanRate.value = "3.50";
  if (dom.loanTenure) dom.loanTenure.value = "84";
  if (dom.loanInstallment) dom.loanInstallment.value = "";
  if (dom.loanDueDay) dom.loanDueDay.value = "5";
  const titleEl = document.getElementById("loan-modal-title");
  if (titleEl) titleEl.textContent = "Add Loan Facility";
  populateLoanLinkedBankSelect();
  updateLoanFormMechanismConditioning();
  dom.loanDialog?.showModal ? dom.loanDialog.showModal() : alert("Add loan modal");
}

function openEditLoanModal(loanId) {
  const loan = state.loans.find(l => l.id === loanId);
  if (!loan) return;

  if (dom.loanEditId) dom.loanEditId.value = loan.id;
  if (dom.loanName) dom.loanName.value = loan.name;
  if (dom.loanBank) dom.loanBank.value = loan.bank || "";
  if (dom.loanTypeSelect) dom.loanTypeSelect.value = loan.type || "CAR_EIR";
  if (dom.loanPrincipal) dom.loanPrincipal.value = loan.originalPrincipal || loan.principal || "";
  if (dom.loanRate) dom.loanRate.value = loan.rate !== undefined ? loan.rate : 3.50;
  if (dom.loanTenure) dom.loanTenure.value = loan.tenureMonths || "";
  if (dom.loanInstallment) dom.loanInstallment.value = loan.monthlyInstallment || "";
  if (dom.loanDueDay) dom.loanDueDay.value = loan.dueDay || 5;

  const titleEl = document.getElementById("loan-modal-title");
  if (titleEl) titleEl.textContent = "Edit Loan Facility";
  populateLoanLinkedBankSelect(loan.linkedBankAccountId || loan.bank);
  updateLoanFormMechanismConditioning();
  dom.loanDialog?.showModal ? dom.loanDialog.showModal() : alert("Edit loan modal");
}

let activeSimLoan = null;

function renderLoans() {
  const currentYm = getLocalDateString().substring(0, 7);
  const salaryIncomes = state.transactions.filter(t => t.date && t.date.startsWith(currentYm) && t.type === "income");
  const monthIncomeAmt = salaryIncomes.reduce((s, t) => s + t.amount, 0) || 3500; // default 3500 baseline

  let totalDebt = 0;
  let totalMonthly = 0;

  state.loans.forEach(ln => {
    totalDebt += (ln.remainingPrincipal || ln.principal);
    totalMonthly += ln.monthlyInstallment;
  });

  // Incorporate Malaysian 5% / RM 50 CCRIS Rule for Credit Cards
  if (state.creditCards) {
    state.creditCards.forEach(c => {
      if (!c.payInFull || c.currentBilled > 0) {
        const bal = c.currentBilled + c.unbilledBalance;
        const card5Pct = Math.max(Number((bal * 0.05).toFixed(2)), 50.00);
        totalMonthly += card5Pct;
      }
    });
  }

  // Backward-compatible updates if legacy IDs exist
  if (dom.totalLoanDebt) dom.totalLoanDebt.textContent = formatCurrency(totalDebt);
  if (dom.totalLoanMonthly) dom.totalLoanMonthly.textContent = `${formatCurrency(totalMonthly)} / mo`;
  if (dom.totalLoanCount) dom.totalLoanCount.textContent = `${state.loans.length} active commitments`;

  // ================= DUAL-PERSPECTIVE SUMMARY CALCULATIONS =================
  // 1. Total Monthly Commitment (Personal Cash Flow / Budget View)
  let totalLoanInstallments = 0;
  state.loans.forEach(ln => { totalLoanInstallments += (ln.monthlyInstallment || 0); });

  let totalSubsCommitment = 0;
  if (state.subscriptions) {
    totalSubsCommitment = state.subscriptions.reduce((s, sub) => s + (sub.amount || 0), 0);
  }

  let totalCardsBilledDebt = 0;
  let totalCcrisCards = 0;
  if (state.creditCards) {
    state.creditCards.forEach(c => {
      totalCardsBilledDebt += (c.currentBilled || 0);
      if (!c.payInFull || c.currentBilled > 0) {
        const bal = (c.currentBilled || 0) + (c.unbilledBalance || 0);
        const card5Pct = Math.max(Number((bal * 0.05).toFixed(2)), 50.00);
        totalCcrisCards += card5Pct;
      }
    });
  }

  const totalBudgetCommitment = totalLoanInstallments + totalSubsCommitment + totalCardsBilledDebt;

  if (dom.dualBudgetSum) {
    dom.dualBudgetSum.textContent = `Sum: ${formatCurrency(totalBudgetCommitment)}`;
  }
  if (dom.dualBudgetBreakdownList) {
    dom.dualBudgetBreakdownList.innerHTML = `
      <div class="dual-breakdown-row">
        <span>🚗 / 🏠 Loans &amp; Financing</span>
        <strong>${formatCurrency(totalLoanInstallments)} / mo</strong>
      </div>
      <div class="dual-breakdown-row">
        <span>⚡ Bills &amp; Subscriptions</span>
        <strong>${formatCurrency(totalSubsCommitment)} / mo</strong>
      </div>
      <div class="dual-breakdown-row">
        <span>💳 Credit Card Billed Debt</span>
        <strong>${formatCurrency(totalCardsBilledDebt)}</strong>
      </div>
    `;
  }

  // 2. Total Monthly Installment (Bank Underwriting / Official CCRIS DSR View)
  const totalCcrisCommitment = totalLoanInstallments + totalCcrisCards;
  const dsr = ((totalCcrisCommitment / monthIncomeAmt) * 100).toFixed(1);

  if (dom.dualCcrisSum) {
    dom.dualCcrisSum.textContent = `Sum: ${formatCurrency(totalCcrisCommitment)}`;
  }
  if (dom.dualCcrisDsrVal) {
    dom.dualCcrisDsrVal.textContent = `${dsr}%`;
  }
  if (dom.dualCcrisDsrBadge) {
    if (dsr < 40) {
      dom.dualCcrisDsrBadge.className = "badge-dsr-healthy";
      dom.dualCcrisDsrBadge.textContent = "Healthy (< 40%)";
    } else if (dsr <= 60) {
      dom.dualCcrisDsrBadge.className = "badge-dsr-moderate";
      dom.dualCcrisDsrBadge.textContent = "Moderate (40-60%)";
    } else {
      dom.dualCcrisDsrBadge.className = "badge-dsr-high";
      dom.dualCcrisDsrBadge.textContent = "High (> 60%)";
    }
  }

  if (dom.dualCcrisBreakdownList) {
    let facilitiesHtml = "";
    if (state.loans && state.loans.length) {
      facilitiesHtml += state.loans.map(ln => `
        <div class="dual-breakdown-row">
          <span>${escapeHtml(ln.name)} (${escapeHtml(ln.bank || "Bank")})</span>
          <strong>${formatCurrency(ln.monthlyInstallment)} / mo</strong>
        </div>
      `).join("");
    } else {
      facilitiesHtml += `<div class="dual-breakdown-row" style="color:var(--text-muted);"><span>No active loans</span><span>RM 0.00</span></div>`;
    }
    facilitiesHtml += `
      <div class="dual-breakdown-row" style="border-top:1px dashed var(--border-color); padding-top:0.35rem; margin-top:0.25rem;">
        <span>💳 Credit Cards (5% CCRIS Rule)</span>
        <strong>${formatCurrency(totalCcrisCards)} / mo</strong>
      </div>
    `;
    dom.dualCcrisBreakdownList.innerHTML = facilitiesHtml;
  }

  // Render Loans Cards List
  if (!state.loans.length) {
    dom.loansList.innerHTML = `<p class="empty-state">No active loans or installments. Click "+ Add Loan" to track car, housing, or PTPTN financing.</p>`;
    return;
  }

  dom.loansList.innerHTML = state.loans.map(ln => {
    const orig = ln.originalPrincipal || ln.principal;
    const rem = ln.remainingPrincipal || ln.principal;
    const paid = Math.max(0, orig - rem);
    const pctPaid = orig > 0 ? ((paid / orig) * 100).toFixed(1) : 0;

    let icon = "🏦";
    let typeDesc = "Financing";
    if (ln.type === "CAR_EIR") { icon = "🚗"; typeDesc = "Car Loan (2026 EIR Reform)"; }
    else if (ln.type === "CAR_FLAT") { icon = "🚗"; typeDesc = "Car Loan (Pre-2026 Flat Rate)"; }
    else if (ln.type === "HOME_SBR") { icon = "🏠"; typeDesc = "Home Mortgage (SBR + Spread)"; }
    else if (ln.type === "PTPTN") { icon = "🎓"; typeDesc = "PTPTN Study Loan (1% Ujrah)"; }
    else if (ln.type === "IPP_0") { icon = "📱"; typeDesc = "0% Credit Card Installment"; }

    return `
      <div class="loan-card-item" data-id="${ln.id}">
        <div class="loan-card-header">
          <div class="loan-title-group">
            <div class="loan-type-icon" style="background:var(--bg-subtle);">${icon}</div>
            <div>
              <div class="loan-name-text">${escapeHtml(ln.name)}</div>
              <div class="loan-bank-badge">${escapeHtml(ln.bank || "Malaysian Bank")} • ${typeDesc}</div>
            </div>
          </div>
          <button type="button" class="btn-delete" title="Delete loan" onclick="deleteLoan('${ln.id}')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
          </button>
        </div>

        <div>
          <div class="loan-progress-legend">
            <span>${pctPaid}% Paid Off (${formatCurrency(paid)} repaid)</span>
            <span>${formatCurrency(rem)} left</span>
          </div>
          <div class="loan-progress-track" style="margin-top: 4px;">
            <div class="loan-progress-fill" style="width: ${pctPaid}%;"></div>
          </div>
        </div>

        <div class="loan-metrics-grid">
          <div class="loan-metric-cell">
            <span class="stat-mini-label">Monthly Installment</span>
            <strong>${formatCurrency(ln.monthlyInstallment)}</strong>
          </div>
          <div class="loan-metric-cell">
            <span class="stat-mini-label">Remaining Tenure</span>
            <strong>${ln.remainingMonths || ln.tenureMonths} of ${ln.tenureMonths} mos (${Math.floor((ln.remainingMonths || ln.tenureMonths) / 12)}y ${(ln.remainingMonths || ln.tenureMonths) % 12}m)</strong>
          </div>
          <div class="loan-metric-cell">
            <span class="stat-mini-label">Rate / Mechanism</span>
            <strong>${ln.type === 'CAR_FLAT' ? `${ln.rate.toFixed(2)}% Flat` : (ln.type === 'PTPTN' ? '1% Ujrah' : (ln.type === 'IPP_0' ? '0% IPP' : `${ln.rate.toFixed(2)}% EIR`))}</strong>
          </div>
          <div class="loan-metric-cell">
            <span class="stat-mini-label">Total Interest</span>
            <strong class="text-danger">${formatCurrency(ln.totalInterest)}</strong>
          </div>
        </div>

        <div class="loan-card-dsr-row" style="margin-top: 0.5rem; font-size: 0.75rem; color: var(--text-muted); display: flex; align-items: center; justify-content: space-between;">
          <span>🏦 Auto-Deduct: <strong>${escapeHtml(state.bankAccounts.find(b => b.id === ln.linkedBankAccountId)?.name || ln.bank || 'Bank Account')}</strong> (Day ${ln.dueDay || 5})</span>
          ${ln.lastPaidMonth === currentYm ? '<span style="color:#059669; font-weight:700;">✓ Paid for this month</span>' : '<span style="color:var(--danger); font-weight:700;">⚠️ Payment Due</span>'}
        </div>

        <div class="loan-card-actions" style="margin-top: 0.75rem;">
          <button type="button" class="btn-primary-sm" onclick="promptManualLoanPayment('${ln.id}')">
            ⚡ Pay Installment
          </button>
          <button type="button" class="btn-outline-sm" onclick="openLoanSimulator('${ln.id}')">
            ⚡ Simulator
          </button>
          <button type="button" class="btn-outline-sm" onclick="openEditLoanModal('${ln.id}')">
            ✏️ Edit
          </button>
        </div>
      </div>
    `;
  }).join("");
}

function deleteLoan(id) {
  const idx = state.loans.findIndex(l => l.id === id);
  if (idx === -1) return;
  const deleted = state.loans.splice(idx, 1)[0];
  saveStorage();
  render();
  showToast(`Removed loan "${deleted.name}"`);
}

function updateLoanLivePreview() {
  const principal = parseFloat(dom.loanPrincipal?.value) || 0;
  const rate = parseFloat(dom.loanRate?.value) || 0;
  const tenure = parseInt(dom.loanTenure?.value, 10) || 0;
  const type = dom.loanTypeSelect?.value || "CAR_EIR";

  if (dom.loanTenureHelper) {
    if (tenure > 0) {
      const y = Math.floor(tenure / 12);
      const m = tenure % 12;
      const yStr = y > 0 ? `${y} yr${y > 1 ? 's' : ''}` : '';
      const mStr = m > 0 ? `${m} mo${m > 1 ? 's' : ''}` : '';
      dom.loanTenureHelper.textContent = `${tenure} months = ${[yStr, mStr].filter(Boolean).join(' ')} total`;
    } else {
      dom.loanTenureHelper.textContent = 'e.g. 84 months = 7 years';
    }
  }

  if (principal > 0 && tenure > 0) {
    const specs = calculateLoanSpecs(principal, rate, tenure, type);
    if (dom.loanInstallment) {
      dom.loanInstallment.value = specs.monthly.toFixed(2);
    }
    if (dom.previewInterest) dom.previewInterest.textContent = formatCurrency(specs.totalInterest);
    if (dom.previewTotalRepayable) dom.previewTotalRepayable.textContent = formatCurrency(specs.totalRepayable);
  } else {
    if (dom.previewInterest) dom.previewInterest.textContent = "RM 0.00";
    if (dom.previewTotalRepayable) dom.previewTotalRepayable.textContent = "RM 0.00";
  }
}

function handleSaveNewLoan(e) {
  e.preventDefault();
  const name = dom.loanName.value.trim();
  const bank = dom.loanBank.value.trim();
  const type = dom.loanTypeSelect.value;
  const principal = parseFloat(dom.loanPrincipal.value);
  const rate = parseFloat(dom.loanRate.value) || 0;
  const tenureMonths = parseInt(dom.loanTenure.value, 10);
  const installment = parseFloat(dom.loanInstallment.value) || 0;
  const dueDay = parseInt(dom.loanDueDay.value, 10) || 5;
  const linkedBankId = dom.loanLinkedBank ? dom.loanLinkedBank.value : "";

  if (!name || isNaN(principal) || principal <= 0 || isNaN(tenureMonths) || tenureMonths <= 0 || isNaN(installment) || installment <= 0) {
    return showToast("Please enter valid loan details.");
  }

  // Under-Amortization Validation Guard: Installment must exceed monthly interest charge
  if (type === "CAR_EIR" || type === "HOME_SBR" || type === "PERSONAL") {
    const monthlyInterestOnly = Number(((principal * (rate / 100)) / 12).toFixed(2));
    if (installment <= monthlyInterestOnly) {
      return showToast(`Monthly installment must exceed monthly interest (${formatCurrency(monthlyInterestOnly)}) to amortize the loan.`);
    }
  }

  const specs = calculateLoanSpecs(principal, rate, tenureMonths, type);
  const editId = dom.loanEditId ? dom.loanEditId.value : "";

  if (editId) {
    const existing = state.loans.find(l => l.id === editId);
    if (existing) {
      existing.name = name;
      existing.bank = bank || existing.bank;
      existing.type = type;
      existing.originalPrincipal = principal;
      existing.rate = rate;
      existing.tenureMonths = tenureMonths;
      existing.monthlyInstallment = installment;
      existing.totalInterest = specs.totalInterest;
      existing.dueDay = dueDay;
      existing.linkedBankAccountId = linkedBankId;
      showToast(`Updated loan "${name}"!`);
    }
  } else {
    const newLoan = {
      id: "loan_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      name,
      bank: bank || "Bank Financing",
      type,
      originalPrincipal: principal,
      remainingPrincipal: principal,
      rate,
      tenureMonths,
      remainingMonths: tenureMonths,
      monthlyInstallment: installment,
      totalInterest: specs.totalInterest,
      dueDay,
      linkedBankAccountId: linkedBankId,
      lastPaidMonth: null,
      createdAt: Date.now()
    };
    state.loans.push(newLoan);
    showToast(`Added loan "${name}"!`);
  }

  saveStorage();
  render();
  dom.loanDialog.close();
}

function openLoanSimulator(loanId) {
  const loan = state.loans.find(l => l.id === loanId);
  if (!loan) return;
  activeSimLoan = loan;

  dom.simLoanTitle.textContent = `${loan.name} Prepayment`;
  dom.simExtraPayment.value = 100;
  calculateSimResults();

  dom.simulatorDialog?.showModal ? dom.simulatorDialog.showModal() : prompt("Extra payment simulator available in dialog");
}

function calculateSimResults() {
  if (!activeSimLoan) return;
  const extra = parseFloat(dom.simExtraPayment.value) || 0;
  const baseMonthly = activeSimLoan.monthlyInstallment;
  const remPrincipal = activeSimLoan.remainingPrincipal || activeSimLoan.originalPrincipal;
  const rate = activeSimLoan.rate || 0;

  if (extra <= 0) {
    dom.simTimeSaved.textContent = "0 months";
    dom.simInterestSaved.textContent = formatCurrency(0);
    return;
  }

  const r = (rate / 100) / 12;

  // 1. Dynamic Baseline Amortization Loop (Base Monthly Payment)
  let bal1 = remPrincipal;
  let totalInt1 = 0;
  let m1 = 0;
  const statedTenure = activeSimLoan.remainingMonths || activeSimLoan.tenureMonths || 360;
  while (bal1 > 0.01 && m1 < 1200) {
    const interest = r > 0 ? (bal1 * r) : 0;
    const payment = Math.min(bal1 + interest, baseMonthly);
    const principalPaid = Math.max(0, payment - interest);
    if (principalPaid <= 0.001) {
      m1 = statedTenure;
      totalInt1 = (activeSimLoan.totalInterest || (baseMonthly * statedTenure - remPrincipal));
      break;
    }
    totalInt1 += interest;
    bal1 -= principalPaid;
    m1++;
  }

  // 2. Dynamic Accelerated Amortization Loop (Base + Extra Payment)
  const newMonthly = baseMonthly + extra;
  let bal2 = remPrincipal;
  let totalInt2 = 0;
  let m2 = 0;
  while (bal2 > 0.01 && m2 < 1200) {
    const interest = r > 0 ? (bal2 * r) : 0;
    const payment = Math.min(bal2 + interest, newMonthly);
    const principalPaid = Math.max(0, payment - interest);
    totalInt2 += interest;
    bal2 -= principalPaid;
    m2++;
  }

  const monthsSaved = Math.max(0, m1 - m2);
  const yearsSaved = (monthsSaved / 12).toFixed(1);
  const interestSaved = Math.max(0, Number((totalInt1 - totalInt2).toFixed(2)));

  dom.simTimeSaved.textContent = `${monthsSaved} mos (${yearsSaved} yrs)`;
  dom.simInterestSaved.textContent = formatCurrency(interestSaved);
}


// Dashboard Installment Progress Summary Renderer
function renderDashboardInstallments() {
  if (!dom.dashboardInstallmentsList) return;

  if (!state.loans || !state.loans.length) {
    dom.dashboardInstallmentsList.innerHTML = `<p class="empty-state">No active installments. Tap "+ Add Commitment" to start tracking.</p>`;
    return;
  }

  dom.dashboardInstallmentsList.innerHTML = state.loans.map(ln => {
    const orig = ln.originalPrincipal || ln.principal;
    const rem = ln.remainingPrincipal || ln.principal;
    const paid = Math.max(0, orig - rem);
    const pct = orig > 0 ? ((paid / orig) * 100).toFixed(1) : 0;
    const icon = ln.type === "CAR_EIR" || ln.type === "CAR_FLAT" ? "🚗" : (ln.type === "HOME_SBR" ? "🏠" : (ln.type === "PTPTN" ? "🎓" : "📱"));

    return `
      <div class="dash-installment-item" onclick="switchTab('commitments')" style="cursor:pointer;" title="Tap to view commitments">
        <div class="dash-installment-header">
          <span>${icon} ${escapeHtml(ln.name)}</span>
          <span style="color:var(--primary); font-size:0.8rem;">${pct}% paid</span>
        </div>
        <div class="dash-installment-track">
          <div class="dash-installment-fill" style="width:${pct}%;"></div>
        </div>
        <div class="dash-installment-meta">
          <span>${formatCurrency(ln.monthlyInstallment)} / mo</span>
          <span>${formatCurrency(rem)} left</span>
        </div>
      </div>
    `;
  }).join("");
}

// Analysis Monthly Pie Chart Engine
let selectedPieMonth = "";

// Donut Category Hover Helpers
function highlightDonutCategory(cat, amt, pct, total) {
  if (dom.donutCenterLabel) dom.donutCenterLabel.textContent = cat;
  if (dom.donutCenterTotal) dom.donutCenterTotal.textContent = formatCurrency(amt);
}

function resetDonutCategory(total) {
  if (dom.donutCenterLabel) dom.donutCenterLabel.textContent = "Total Spent";
  if (dom.donutCenterTotal) dom.donutCenterTotal.textContent = formatCurrency(total);
}

function renderAnalysisPieChart() {
  if (!dom.categoryPieChart || !dom.pieChartBreakdownList) return;

  // 1. Populate Month Dropdown
  const months = new Set();
  state.transactions.forEach(t => {
    if (t.date && t.date.length >= 7) months.add(t.date.substring(0, 7));
  });

  const sortedMonths = Array.from(months).sort().reverse();
  const currentLocalYm = getLocalDateString().substring(0, 7);
  if (!sortedMonths.includes(currentLocalYm)) sortedMonths.unshift(currentLocalYm);

  if (!selectedPieMonth || !sortedMonths.includes(selectedPieMonth)) {
    selectedPieMonth = sortedMonths[0];
  }

  if (dom.pieChartMonthSelect) {
    dom.pieChartMonthSelect.innerHTML = sortedMonths.map(ym => {
      const [y, m] = ym.split("-");
      const d = new Date(y, m - 1, 1);
      const label = d.toLocaleString(undefined, { month: "long", year: "numeric" });
      return `<option value="${ym}" ${ym === selectedPieMonth ? "selected" : ""}>${label}</option>`;
    }).join("");
  }

  // 2. Filter Expenses for Selected Month
  const monthExpenses = state.transactions.filter(t => {
    return (t.type || "expense") === "expense" && t.date && t.date.startsWith(selectedPieMonth);
  });

  const total = monthExpenses.reduce((s, t) => s + t.amount, 0);

  if (!total || !monthExpenses.length) {
    if (dom.donutCenterLabel) dom.donutCenterLabel.textContent = "No Expenses";
    if (dom.donutCenterTotal) dom.donutCenterTotal.textContent = formatCurrency(0);
    dom.categoryPieChart.innerHTML = `<circle cx="0" cy="0" r="77" fill="none" stroke="var(--bg-subtle)" stroke-width="28" opacity="0.6"></circle>`;
    dom.pieChartBreakdownList.innerHTML = `<p class="empty-state">No category expenses found for this month.</p>`;
    return;
  }

  // 3. Aggregate by Category & Sort Descending
  const catTotals = {};
  monthExpenses.forEach(t => {
    catTotals[t.category] = (catTotals[t.category] || 0) + t.amount;
  });

  const sortedCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);

  // Update Inner Total default display
  if (dom.donutCenterLabel) dom.donutCenterLabel.textContent = "Total Spent";
  if (dom.donutCenterTotal) dom.donutCenterTotal.textContent = formatCurrency(total);

  // 4. Render SVG Donut Slices (Outer Radius 92, Inner Radius 62)
  let cumulativeAngle = 0;
  const R = 92;
  const r = 62;
  let svgPaths = "";

  sortedCats.forEach(([cat, amt], idx) => {
    const sliceAngle = (amt / total) * 360;
    const startAngle = cumulativeAngle;
    const endAngle = cumulativeAngle + sliceAngle;

    // Convert angles to radians starting at 12 o'clock (-90deg) natively in math
    const startRad = ((startAngle - 90) * Math.PI) / 180;
    const endRad = ((endAngle - 90) * Math.PI) / 180;

    const x1out = R * Math.cos(startRad);
    const y1out = R * Math.sin(startRad);
    const x2out = R * Math.cos(endRad);
    const y2out = R * Math.sin(endRad);

    const x1in = r * Math.cos(startRad);
    const y1in = r * Math.sin(startRad);
    const x2in = r * Math.cos(endRad);
    const y2in = r * Math.sin(endRad);

    const largeArcFlag = sliceAngle > 180 ? 1 : 0;
    const color = getCategoryColor(cat);
    const pct = ((amt / total) * 100).toFixed(1);

    let d = "";
    if (sliceAngle >= 359.99) {
      d = `M 0 -${R} A ${R} ${R} 0 1 1 0 ${R} A ${R} ${R} 0 1 1 0 -${R} M 0 -${r} A ${r} ${r} 0 1 0 0 ${r} A ${r} ${r} 0 1 0 0 -${r} Z`;
    } else {
      d = `M ${x1out.toFixed(2)} ${y1out.toFixed(2)} A ${R} ${R} 0 ${largeArcFlag} 1 ${x2out.toFixed(2)} ${y2out.toFixed(2)} L ${x2in.toFixed(2)} ${y2in.toFixed(2)} A ${r} ${r} 0 ${largeArcFlag} 0 ${x1in.toFixed(2)} ${y1in.toFixed(2)} Z`;
    }

    svgPaths += `
      <path class="pie-slice donut-slice" id="donut-slice-${idx}" d="${d}" fill="${color}" stroke="var(--bg-surface)" stroke-width="2" data-cat="${escapeHtml(cat)}" data-amt="${amt}" data-pct="${pct}" onmouseenter="highlightDonutCategory('${escapeHtml(cat)}', ${amt}, '${pct}', ${total})" onmouseleave="resetDonutCategory(${total})">
        <title>${escapeHtml(cat)}: ${formatCurrency(amt)} (${pct}%)</title>
      </path>
    `;
    cumulativeAngle += sliceAngle;
  });

  dom.categoryPieChart.innerHTML = svgPaths;

  // 5. Render Modern Legend Rows with Thin Rounded Squares & Side-by-Side Values
  dom.pieChartBreakdownList.innerHTML = sortedCats.map(([cat, amt], idx) => {
    const pct = ((amt / total) * 100).toFixed(0);
    const color = getCategoryColor(cat);
    const icon = getCategoryIcon(cat);

    return `
      <div class="donut-legend-row" id="donut-legend-row-${idx}" data-cat="${escapeHtml(cat)}" onmouseenter="highlightDonutCategory('${escapeHtml(cat)}', ${amt}, '${pct}', ${total})" onmouseleave="resetDonutCategory(${total})" onclick="highlightDonutCategory('${escapeHtml(cat)}', ${amt}, '${pct}', ${total})">
        <div class="donut-legend-left">
          <span class="donut-legend-swatch" style="background-color:${color};"></span>
          <span class="donut-legend-name">${icon} ${escapeHtml(cat)}</span>
        </div>
        <div class="donut-legend-right">
          <span class="donut-legend-amount">${formatCurrency(amt)}</span>
          <span class="donut-legend-pct" style="color:${color};">${pct}%</span>
        </div>
      </div>
    `;
  }).join("");
}

function renderBreakdown() {
  const now = new Date();
  const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastYm = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}`;

  // 1. Period Synchronization: Filter expenses by active periodFilter
  let periodLabel = "This Month";
  let periodExpenses = state.transactions.filter(t => (t.type || "expense") === "expense");

  if (state.periodFilter === "THIS_MONTH") {
    periodExpenses = periodExpenses.filter(t => t.date && t.date.startsWith(currentYm));
    periodLabel = now.toLocaleString(undefined, { month: "short", year: "numeric" });
  } else if (state.periodFilter === "LAST_MONTH") {
    periodExpenses = periodExpenses.filter(t => t.date && t.date.startsWith(lastYm));
    periodLabel = lastMonthDate.toLocaleString(undefined, { month: "short", year: "numeric" });
  } else if (state.periodFilter === "CUSTOM") {
    if (state.customStartDate) periodExpenses = periodExpenses.filter(t => t.date >= state.customStartDate);
    if (state.customEndDate) periodExpenses = periodExpenses.filter(t => t.date <= state.customEndDate);
    periodLabel = "Custom Range";
  } else {
    periodLabel = "All Time";
  }

  if (dom.chartPeriodBadge) {
    dom.chartPeriodBadge.textContent = periodLabel;
  }

  const total = periodExpenses.reduce((s, t) => s + t.amount, 0);

  // Handle Empty State for Filtered Period
  if (!total || !periodExpenses.length) {
    dom.breakdownList.innerHTML = `<p class="empty-state">No expenses logged for ${escapeHtml(periodLabel)}.</p>`;
    if (dom.donutSegments) dom.donutSegments.innerHTML = "";
    dom.donutWrapper?.classList.remove("has-selection");
    dom.donutLabel.textContent = periodLabel;
    dom.donutVal.textContent = formatCurrency(0);
    if (dom.donutHint) dom.donutHint.style.display = "none";
    return;
  }

  // Aggregate Category Totals for this Period
  const totals = {};
  periodExpenses.forEach(t => totals[t.category] = (totals[t.category] || 0) + t.amount);
  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);

  // 2. Render Modern SVG Donut Segments
  if (dom.donutSegments) {
    const r = 58;
    const c = 2 * Math.PI * r; // ~364.424
    let acc = 0;
    let segHtml = "";

    sorted.forEach(([cat, amt]) => {
      const p = amt / total;
      const len = p * c;
      const off = -acc * c;
      const isSel = state.selectedCategory === cat;
      const color = getCategoryColor(cat);

      segHtml += `
        <circle 
          class="donut-segment ${isSel ? "active" : ""}" 
          cx="80" cy="80" r="${r}" 
          stroke="${color}" 
          stroke-dasharray="${len.toFixed(2)} ${c.toFixed(2)}" 
          stroke-dashoffset="${off.toFixed(2)}"
          data-category="${cat}"
          data-amount="${amt}"
          data-percentage="${(p * 100).toFixed(1)}"
        />
      `;
      acc += p;
    });

    dom.donutSegments.innerHTML = segHtml;

    // Center Dial Readout
    if (state.selectedCategory && totals[state.selectedCategory]) {
      const selAmt = totals[state.selectedCategory];
      const selPct = ((selAmt / total) * 100).toFixed(1);
      dom.donutWrapper?.classList.add("has-selection");
      dom.donutLabel.textContent = state.selectedCategory;
      dom.donutVal.textContent = formatCurrency(selAmt);
      if (dom.donutHint) {
        dom.donutHint.style.display = "inline-block";
        dom.donutHint.textContent = `${selPct}% • Tap to reset`;
      }
    } else {
      dom.donutWrapper?.classList.remove("has-selection");
      dom.donutLabel.textContent = `${periodLabel} Total`;
      dom.donutVal.textContent = formatCurrency(total);
      if (dom.donutHint) dom.donutHint.style.display = "none";
    }

    // Segment Tap/Click & Desktop Hover Listeners
    dom.donutSegments.querySelectorAll(".donut-segment").forEach(seg => {
      const cat = seg.dataset.category;
      seg.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleCategory(cat);
      });

      // Desktop Hover Preview (only active if no slice is locked/selected)
      seg.addEventListener("mouseenter", () => {
        if (!state.selectedCategory) {
          const amt = parseFloat(seg.dataset.amount);
          const pct = seg.dataset.percentage;
          dom.donutLabel.textContent = cat;
          dom.donutVal.textContent = formatCurrency(amt);
          if (dom.donutHint) {
            dom.donutHint.style.display = "inline-block";
            dom.donutHint.textContent = `${pct}%`;
          }
        }
      });

      seg.addEventListener("mouseleave", () => {
        if (!state.selectedCategory) {
          dom.donutLabel.textContent = `${periodLabel} Total`;
          dom.donutVal.textContent = formatCurrency(total);
          if (dom.donutHint) dom.donutHint.style.display = "none";
        }
      });
    });
  }

  // 3. Render Thumb-Friendly Interactive Category Cards (Tiles)
  let tilesHtml = "";
  sorted.forEach(([cat, amt]) => {
    const pct = ((amt / total) * 100).toFixed(1);
    const color = getCategoryColor(cat);
    const icon = getCategoryIcon(cat);
    const isSel = state.selectedCategory === cat;

    tilesHtml += `
      <div 
        class="breakdown-card-tile ${isSel ? "selected" : ""}" 
        data-category="${cat}" 
        title="Tap to toggle filter for ${cat}"
      >
        <div class="breakdown-tile-top">
          <div class="breakdown-tile-left">
            <span class="breakdown-cat-icon" style="background-color: ${color}20; color: ${color};">
              ${icon}
            </span>
            <span class="breakdown-cat-name">${escapeHtml(cat)}</span>
          </div>
          <div class="breakdown-tile-right">
            <span class="breakdown-tile-amount">${formatCurrency(amt)}</span>
            <span class="breakdown-tile-pct" style="${isSel ? `background:${color}; color:#fff;` : ''}">${pct}%</span>
          </div>
        </div>
        <div class="breakdown-tile-bar-bg">
          <div class="breakdown-tile-bar-fill" style="width: ${pct}%; background-color: ${color};"></div>
        </div>
      </div>
    `;
  });

  dom.breakdownList.innerHTML = tilesHtml;

  // Tile Tap Listeners
  dom.breakdownList.querySelectorAll(".breakdown-card-tile").forEach(tile => {
    tile.addEventListener("click", () => {
      toggleCategory(tile.dataset.category);
    });
  });
}

// Transaction List Render
function renderTransactionList() {
  const filtered = getFilteredTransactions();
  let list = [...filtered].sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.createdAt || 0) - (a.createdAt || 0));

  if (!list.length) {
    const hasActiveFilters = state.filterCategory !== "ALL" || state.periodFilter !== "ALL" || state.searchQuery;
    dom.txList.innerHTML = `
      <div class="empty-state">
        <p>${hasActiveFilters ? "No transactions match your search and filter criteria." : "No transactions recorded yet. Fill out the form to add your first transaction!"}</p>
        ${hasActiveFilters ? '<button type="button" class="btn-text" onclick="resetAllFilters()" style="margin-top:0.4rem;">Reset Filters</button>' : ''}
      </div>
    `;
    return;
  }

  dom.txList.innerHTML = list.map(tx => {
    const isIncome = tx.type === "income";
    const icon = getCategoryIcon(tx.category);
    const sign = isIncome ? "+" : "-";
    const amountClass = isIncome ? "tx-amount income" : "tx-amount expense";

    return `
      <div class="transaction-item" data-id="${tx.id}">
        <div class="tx-left">
          <div class="tx-icon-badge" aria-hidden="true">${icon}</div>
          <div class="tx-info">
            <span class="tx-category">
              ${escapeHtml(tx.category)}
              ${isIncome ? '<span class="tx-badge-type income">Income</span>' : ''}
            </span>
            <div class="tx-meta">
              <span>${formatDate(tx.date)}</span>
              <span>•</span>
              <span class="tx-badge-wallet">${getWalletIcon(tx.wallet)} ${escapeHtml(tx.cardName || tx.wallet || "Bank Account")}</span>
              ${tx.receiptImage ? `
                <button type="button" class="btn-photo-icon" title="View photo / receipt" onclick="viewReceiptModal('${tx.id}')">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                    <circle cx="12" cy="13" r="4"></circle>
                  </svg>
                </button>
              ` : ""}
              ${tx.note && tx.note !== tx.category ? `<span>•</span><span class="tx-note" title="${escapeHtml(tx.note)}">${escapeHtml(tx.note)}</span>` : ""}
            </div>
          </div>
        </div>
        <div class="tx-right">
          <span class="${amountClass}">${sign}${formatCurrency(tx.amount)}</span>
          <button type="button" class="btn-edit" title="Edit transaction" onclick="openEditModal('${tx.id}')">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          <button type="button" class="btn-delete" title="Delete transaction" onclick="deleteExpense('${tx.id}')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>
    `;
  }).join("");
}

// Option 7B: Cash Flow Trajectory Dual-Line Chart Engine with Curved Area Gradients
let activeAnalysisBuckets = [];

function highlightTrajectoryPoint(idx) {
  if (!activeAnalysisBuckets || !activeAnalysisBuckets[idx]) return;
  const b = activeAnalysisBuckets[idx];
  const net = b.income - b.expenses;
  const netSign = net >= 0 ? "+" : "";

  // Highlight active dots and cursor line
  document.querySelectorAll(".chart-point-dot").forEach(d => d.classList.remove("active"));
  const dotInc = document.getElementById("traj-dot-inc-" + idx);
  const dotExp = document.getElementById("traj-dot-exp-" + idx);
  if (dotInc) dotInc.classList.add("active");
  if (dotExp) dotExp.classList.add("active");

  const cursorLine = document.getElementById("traj-cursor-line");
  if (cursorLine && dotInc) {
    const cx = dotInc.getAttribute("cx");
    cursorLine.setAttribute("x1", cx);
    cursorLine.setAttribute("x2", cx);
    cursorLine.style.opacity = "0.75";
  }

  if (dom.chartInteractiveLegend) {
    dom.chartInteractiveLegend.innerHTML = `
      <div class="legend-badge legend-active-month" title="Active Month">
        <span>📅 <strong>${b.label}</strong></span>
      </div>
      <div class="legend-badge legend-income">
        <span class="legend-dot" style="background:#10b981;"></span>
        <span>Income: <strong>${formatCurrency(b.income)}</strong></span>
      </div>
      <div class="legend-badge legend-expense">
        <span class="legend-dot" style="background:#ef4444;"></span>
        <span>Expenses: <strong>${formatCurrency(b.expenses)}</strong></span>
      </div>
      <div class="legend-badge legend-surplus" style="border-color:${net >= 0 ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}">
        <span class="legend-dot" style="background:${net >= 0 ? "#3b82f6" : "#f59e0b"};"></span>
        <span>Net: <strong>${netSign}${formatCurrency(net)}</strong></span>
      </div>
    `;
  }
}

// Helper: Smooth Monotone / Cubic Bézier Spline for Curves
function getCurvedPath(points) {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
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

function getCurvedAreaPath(points, bottomY) {
  if (!points.length) return "";
  const linePath = getCurvedPath(points);
  return `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${bottomY.toFixed(1)} L ${points[0].x.toFixed(1)} ${bottomY.toFixed(1)} Z`;
}

function getChartYScale(maxVal) {
  if (maxVal <= 1000) return { ceil: 1000, mid: 500 };
  if (maxVal <= 2500) return { ceil: 2500, mid: 1250 };
  if (maxVal <= 5000) return { ceil: 5000, mid: 2500 };
  if (maxVal <= 10000) return { ceil: 10000, mid: 5000 };
  const ceil = Math.ceil(maxVal / 2500) * 2500;
  return { ceil, mid: ceil / 2 };
}

function renderAnalysis() {
  const rangeMonths = state.analysisRange || 6;
  const now = new Date();

  let buckets = [];
  // Prepare Intervals based on selected range (default: Last 6 Months)
  for (let i = rangeMonths - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString(undefined, { month: "short" });
    buckets.push({ key: ym, label, expenses: 0, income: 0, savings: 0 });
  }

  // Aggregate Data
  state.transactions.forEach(t => {
    if (!t.date) return;
    buckets.forEach(b => {
      if (t.date.startsWith(b.key)) {
        if (t.type === "income") {
          b.income += t.amount;
        } else if (t.category === "Savings & Investments") {
          b.savings += t.amount;
        } else {
          b.expenses += t.amount;
        }
      }
    });
  });

  activeAnalysisBuckets = buckets;

  // Render Totals in Header Cards
  const totalExp = buckets.reduce((s, b) => s + b.expenses, 0);
  const totalInc = buckets.reduce((s, b) => s + b.income, 0);
  if (dom.analysisTotalSpend) dom.analysisTotalSpend.textContent = formatCurrency(totalExp);
  if (dom.analysisTotalIncome) dom.analysisTotalIncome.textContent = formatCurrency(totalInc);

  // Comparison stat vs previous period
  if (buckets.length >= 2) {
    const currentBucket = buckets[buckets.length - 1];
    const prevBucket = buckets[buckets.length - 2];
    if (prevBucket.expenses > 0) {
      const diffPct = (((currentBucket.expenses - prevBucket.expenses) / prevBucket.expenses) * 100).toFixed(0);
      if (diffPct < 0) {
        if (dom.analysisComparisonStat) dom.analysisComparisonStat.innerHTML = `<span class="text-success">📉 ${Math.abs(diffPct)}% lower</span>`;
        if (dom.analysisInsightText) dom.analysisInsightText.textContent = `Great progress! You spent ${Math.abs(diffPct)}% less in ${currentBucket.label} compared to ${prevBucket.label}.`;
      } else {
        if (dom.analysisComparisonStat) dom.analysisComparisonStat.innerHTML = `<span class="text-danger">📈 +${diffPct}% higher</span>`;
        if (dom.analysisInsightText) dom.analysisInsightText.textContent = `Spending in ${currentBucket.label} is ${diffPct}% higher than in ${prevBucket.label}. Keep an eye on non-essential categories.`;
      }
    } else {
      if (dom.analysisComparisonStat) dom.analysisComparisonStat.textContent = "—";
      if (dom.analysisInsightText) dom.analysisInsightText.textContent = "Log more expenses across consecutive periods to generate detailed comparative insights.";
    }
  }

  // Render Dual-Line Chart with Curved Area Gradients
  const svg = dom.analysisLineChart || dom.analysisBarChart;
  if (svg) {
    const maxDataVal = Math.max(1, ...buckets.map(b => Math.max(b.income, b.expenses)));
    const yScale = getChartYScale(maxDataVal);

    const chartWidth = 560;
    const chartHeight = 230;
    const paddingLeft = 75;
    const paddingRight = 35;
    const paddingTop = 24;
    const paddingBottom = 36;
    const usableWidth = chartWidth - paddingLeft - paddingRight;
    const usableHeight = chartHeight - paddingTop - paddingBottom;
    const chartBottom = paddingTop + usableHeight;
    const chartMid = paddingTop + usableHeight / 2;
    const chartTop = paddingTop;

    const colStep = buckets.length > 1 ? usableWidth / (buckets.length - 1) : usableWidth;
    const incomePoints = [];
    const expensePoints = [];

    buckets.forEach((b, i) => {
      const x = paddingLeft + (i * colStep);
      const incY = Math.max(chartTop, chartBottom - (b.income / yScale.ceil) * usableHeight);
      const expY = Math.max(chartTop, chartBottom - (b.expenses / yScale.ceil) * usableHeight);
      incomePoints.push({ x, y: incY, bucket: b, idx: i });
      expensePoints.push({ x, y: expY, bucket: b, idx: i });
    });

    const incLine = getCurvedPath(incomePoints);
    const expLine = getCurvedPath(expensePoints);
    const incArea = getCurvedAreaPath(incomePoints, chartBottom);
    const expArea = getCurvedAreaPath(expensePoints, chartBottom);

    let svgContent = `
      <defs>
        <linearGradient id="cashflowIncomeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#10b981" stop-opacity="0.30" />
          <stop offset="65%" stop-color="#10b981" stop-opacity="0.08" />
          <stop offset="100%" stop-color="#10b981" stop-opacity="0.00" />
        </linearGradient>
        <linearGradient id="cashflowExpenseGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#ef4444" stop-opacity="0.25" />
          <stop offset="65%" stop-color="#ef4444" stop-opacity="0.06" />
          <stop offset="100%" stop-color="#ef4444" stop-opacity="0.00" />
        </linearGradient>
      </defs>

      <!-- Y Axis Grid lines -->
      <line x1="${paddingLeft}" y1="${chartTop}" x2="${chartWidth - paddingRight}" y2="${chartTop}" stroke="var(--border-color)" stroke-width="1" stroke-dasharray="4" opacity="0.45" />
      <line x1="${paddingLeft}" y1="${chartMid}" x2="${chartWidth - paddingRight}" y2="${chartMid}" stroke="var(--border-color)" stroke-width="1" stroke-dasharray="4" opacity="0.45" />
      <line x1="${paddingLeft}" y1="${chartBottom}" x2="${chartWidth - paddingRight}" y2="${chartBottom}" stroke="var(--border-color)" stroke-width="1.5" />

      <!-- Y Axis Currency Labels -->
      <text x="${paddingLeft - 10}" y="${chartTop + 4}" font-size="10" font-weight="600" fill="var(--text-muted)" text-anchor="end">${formatCurrency(yScale.ceil)}</text>
      <text x="${paddingLeft - 10}" y="${chartMid + 4}" font-size="10" font-weight="600" fill="var(--text-muted)" text-anchor="end">${formatCurrency(yScale.mid)}</text>
      <text x="${paddingLeft - 10}" y="${chartBottom + 4}" font-size="10" font-weight="600" fill="var(--text-muted)" text-anchor="end">${formatCurrency(0)}</text>

      <!-- Curved Area Gradients -->
      <path d="${incArea}" fill="url(#cashflowIncomeGrad)" />
      <path d="${expArea}" fill="url(#cashflowExpenseGrad)" />

      <!-- Cursor Line for Hover/Selection -->
      <line id="traj-cursor-line" x1="${incomePoints[incomePoints.length - 1].x.toFixed(1)}" y1="${chartTop}" x2="${incomePoints[incomePoints.length - 1].x.toFixed(1)}" y2="${chartBottom}" stroke="var(--text-muted)" stroke-width="1" stroke-dasharray="3" opacity="0.5" style="transition:all 0.2s ease;" />

      <!-- Curved Line Strokes -->
      <path d="${incLine}" fill="none" stroke="#10b981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
      <path d="${expLine}" fill="none" stroke="#ef4444" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
    `;

    // Data dots, X labels, and touch hover zones
    buckets.forEach((b, i) => {
      const x = incomePoints[i].x;
      const incY = incomePoints[i].y;
      const expY = expensePoints[i].y;
      const isLatest = (i === buckets.length - 1);

      svgContent += `
        <!-- X Axis Month Label -->
        <text x="${x.toFixed(1)}" y="${chartBottom + 20}" font-size="11" font-weight="600" fill="var(--text-muted)" text-anchor="middle">${b.label}</text>

        <!-- Point Dots -->
        <circle id="traj-dot-inc-${i}" cx="${x.toFixed(1)}" cy="${incY.toFixed(1)}" r="${isLatest ? 5.5 : 4}" fill="var(--bg-surface)" stroke="#10b981" stroke-width="${isLatest ? 3 : 2.5}" class="chart-point-dot ${isLatest ? 'active' : ''}" />
        <circle id="traj-dot-exp-${i}" cx="${x.toFixed(1)}" cy="${expY.toFixed(1)}" r="${isLatest ? 5.5 : 4}" fill="var(--bg-surface)" stroke="#ef4444" stroke-width="${isLatest ? 3 : 2.5}" class="chart-point-dot ${isLatest ? 'active' : ''}" />

        <!-- Interactive Column Tap / Hover Zone -->
        <rect x="${(x - colStep / 2).toFixed(1)}" y="${chartTop}" width="${colStep.toFixed(1)}" height="${(usableHeight + 25).toFixed(1)}" fill="transparent" class="chart-hover-zone" data-idx="${i}" style="cursor:pointer;" onmouseenter="highlightTrajectoryPoint(${i})" onclick="highlightTrajectoryPoint(${i})" />
      `;
    });

    svg.innerHTML = svgContent;

    // Highlight latest month by default in interactive legend
    highlightTrajectoryPoint(buckets.length - 1);
  }

  // Render Spending by Wallet Breakdown
  renderWalletBreakdown(buckets);
}

const WALLET_CONFIG = {
  "E-Wallet": { color: "#8b5cf6", barColor: "#8b5cf6", icon: "📱" },
  "Bank Transfer": { color: "#0d9488", barColor: "#0d9488", icon: "🏛️" },
  "Credit Card": { color: "#6366f1", barColor: "#6366f1", icon: "💳" },
  "Debit Card": { color: "#0284c7", barColor: "#0284c7", icon: "💳" },
  "Cash": { color: "#d97706", barColor: "#d97706", icon: "💵" },
  "Bank Account": { color: "#64748b", barColor: "#64748b", icon: "🏦" }
};

function renderWalletBreakdown(buckets) {
  const container = dom.paymentSourceList || dom.walletStatsGrid;
  if (!container) return;

  const activeKeys = new Set(buckets.map(b => b.key));
  const periodExpenses = state.transactions.filter(t => {
    if ((t.type || "expense") !== "expense") return false;
    if (!t.date) return false;
    return buckets.some(b => t.date.startsWith(b.key));
  });

  const totalExp = periodExpenses.reduce((s, t) => s + t.amount, 0);

  const walletTotals = {
    "Bank Transfer": 0,
    "E-Wallet": 0,
    "Credit Card": 0,
    "Debit Card": 0,
    "Cash": 0
  };

  periodExpenses.forEach(t => {
    let w = t.wallet || "Bank Transfer";
    if (w === "Bank Account") w = "Bank Transfer";
    walletTotals[w] = (walletTotals[w] || 0) + t.amount;
  });

  // Sort descending by spending volume (leaderboard layout)
  const sortedEntries = Object.entries(walletTotals).sort((a, b) => b[1] - a[1]);

  const htmlContent = sortedEntries.map(([wallet, amount]) => {
    const pct = totalExp > 0 ? ((amount / totalExp) * 100).toFixed(0) : 0;
    const cfg = WALLET_CONFIG[wallet] || {
      color: "var(--primary)",
      barColor: "var(--primary)",
      icon: getWalletIcon(wallet)
    };

    return `
      <div class="payment-source-item" data-wallet="${escapeHtml(wallet)}">
        <div class="payment-source-row">
          <span class="payment-source-name">
            <span class="payment-source-dot" style="background-color:${cfg.color};"></span>
            <span class="payment-source-icon" aria-hidden="true">${cfg.icon}</span>
            <span>${escapeHtml(wallet)}</span>
          </span>
          <div class="payment-source-figures">
            <span class="payment-source-amount">${formatCurrency(amount)}</span>
            <span class="payment-source-pct">(${pct}%)</span>
          </div>
        </div>
        <div class="payment-source-progress-track">
          <div class="payment-source-progress-fill" style="width:${pct}%; background-color:${cfg.barColor};"></div>
        </div>
      </div>
    `;
  }).join("");

  container.innerHTML = htmlContent;

  if (dom.walletStatsGrid && dom.walletStatsGrid !== container) {
    dom.walletStatsGrid.innerHTML = htmlContent;
  }
}

// Option 7C & Settings Render
function renderSettings() {
  if (dom.toggleSurplusSweep) {
    dom.toggleSurplusSweep.checked = !!state.autoSweepSurplus;
  }
  const listEl = dom.customCategoriesList;
  if (!state.customCategories.length) {
    listEl.innerHTML = `<p class="empty-state">No custom categories created yet. Click "+ Add Category" to personalize.</p>`;
    return;
  }

  listEl.innerHTML = state.customCategories.map(cat => `
    <div class="custom-cat-item">
      <span>
        <span class="category-dot" style="background-color:${cat.color};"></span>
        ${cat.icon} ${escapeHtml(cat.name)} <span style="font-size:0.75rem; color:var(--text-muted); font-weight:normal;">(${cat.type})</span>
      </span>
      <button type="button" class="btn-delete" title="Delete custom category" onclick="deleteCustomCategory('${cat.id}')">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
        </svg>
      </button>
    </div>
  `).join("");
}

// Backup & Export Handlers
function exportToCSV() {
  if (!state.transactions.length) return showToast("No transactions to export.");

  const headers = ["Date", "Type", "Category", "Wallet", "Note", "Amount", "Currency"];
  const rows = state.transactions.map(t => [
    t.date,
    t.type || "expense",
    `"${(t.category || "").replace(/"/g, '""')}"`,
    `"${(t.wallet || "Bank Account").replace(/"/g, '""')}"`,
    `"${(t.note || "").replace(/"/g, '""')}"`,
    t.amount.toFixed(2),
    state.currency
  ]);

  const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\r\n");
  const today = getLocalDateString();
  exportFile(new Blob([csvContent], { type: "text/csv;charset=utf-8;" }), `expenses_${today}.csv`);
  showToast(`Exported ${state.transactions.length} transactions to CSV!`);
}

function exportToJSON() {
  const backupData = {
    appName: "Expense Tracker",
    version: 2,
    exportedAt: new Date().toISOString(),
    currency: state.currency,
    transactions: state.transactions,
    subscriptions: state.subscriptions,
    customCategories: state.customCategories,
    loans: state.loans,
    creditCards: state.creditCards,
    debitCards: state.debitCards,
    bankAccounts: state.bankAccounts
  };

  const jsonStr = JSON.stringify(backupData, null, 2);
  const today = getLocalDateString();
  exportFile(new Blob([jsonStr], { type: "application/json;charset=utf-8;" }), `expense_tracker_backup_${today}.json`);
  showToast("Full backup file ready!");
}

// Web Share API File Exporter with downloadBlob fallback (Guarantees iOS Standalone PWA export capability)
async function exportFile(blob, filename) {
  if (navigator.canShare && typeof File !== "undefined") {
    try {
      const file = new File([blob], filename, { type: blob.type || "application/octet-stream" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: filename
        });
        showToast(`Saved "${filename}"!`);
        return;
      }
    } catch (err) {
      if (err.name === "AbortError") return; // User dismissed share sheet
    }
  }
  downloadBlob(blob, filename);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 60000); // 60s for iOS Safari download manager
}

function handleFileImport(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  const fileName = (file.name || "").toLowerCase();
  const fileType = (file.type || "").toLowerCase();

  reader.onload = (evt) => {
    try {
      let content = (evt.target.result || "").trim();
      // Strip UTF-8 Byte Order Mark (BOM) if present (common on mobile and Excel exports)
      if (content.charCodeAt(0) === 0xFEFF) {
        content = content.slice(1).trim();
      }

      // Robust Format detection for Android & iOS
      let isJson = fileName.endsWith(".json") || fileType.includes("json");
      let isCsv = fileName.endsWith(".csv") || fileType.includes("csv");

      if (!isJson && !isCsv) {
        // Heuristic inspection of content
        if (content.startsWith("{") || content.startsWith("[")) {
          isJson = true;
        } else if (content.includes(",") && content.includes("\n")) {
          isCsv = true;
        }
      }

      if (isJson) {
        try {
          importJSONData(content);
        } catch (jsonErr) {
          // Fallback to CSV if JSON parse fails
          importCSVData(content);
        }
      } else if (isCsv) {
        importCSVData(content);
      } else {
        // Try JSON first, then CSV
        try {
          importJSONData(content);
        } catch (fallbackErr) {
          importCSVData(content);
        }
      }
    } catch (err) {
      showToast("Failed to parse imported file.");
    } finally {
      if (dom.settingsFileInput) dom.settingsFileInput.value = "";
    }
  };

  reader.onerror = () => {
    showToast("Error reading file from device.");
    if (dom.settingsFileInput) dom.settingsFileInput.value = "";
  };

  reader.readAsText(file);
}

function importJSONData(jsonStr) {
  const parsed = JSON.parse(jsonStr);
  const incomingTx = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.transactions) ? parsed.transactions : null);

  if (!incomingTx) return showToast("Invalid backup format.");
  const validTx = incomingTx.filter(t => t && t.amount > 0 && t.category && t.date);
  if (!validTx.length) return showToast("No valid records found in backup.");

  const shouldMerge = state.transactions.length > 0 && confirm("Do you want to MERGE with existing records?\n\nClick OK to Merge.\nClick Cancel to REPLACE all records.");

  if (shouldMerge) {
    const existingIds = new Set(state.transactions.map(t => t.id));
    const toAdd = validTx.map(t => existingIds.has(t.id) ? { ...t, id: "tx_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6) } : t);
    state.transactions = [...toAdd, ...state.transactions];
  } else {
    state.transactions = validTx;
    if (parsed.currency) state.currency = parsed.currency;
    if (Array.isArray(parsed.subscriptions)) state.subscriptions = parsed.subscriptions;
    if (Array.isArray(parsed.customCategories)) state.customCategories = parsed.customCategories;
    if (Array.isArray(parsed.loans)) state.loans = parsed.loans;
    if (Array.isArray(parsed.creditCards)) state.creditCards = parsed.creditCards;
    if (Array.isArray(parsed.debitCards)) state.debitCards = parsed.debitCards;
    if (Array.isArray(parsed.bankAccounts)) state.bankAccounts = parsed.bankAccounts;
  }

  saveStorage();
  populateCategorySelects();
  populateFilterCategories();
  render();
  showToast(`Successfully imported ${validTx.length} transactions!`);
}

function importCSVData(csvStr) {
  const lines = csvStr.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length <= 1) return showToast("CSV file is empty.");

  // Smart Header Mapping
  const headerCols = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
  const idxDate = headerCols.findIndex(h => h.includes("date"));
  const idxType = headerCols.findIndex(h => h.includes("type"));
  const idxCat = headerCols.findIndex(h => h.includes("category") || h.includes("cat"));
  const idxWallet = headerCols.findIndex(h => h.includes("wallet") || h.includes("account") || h.includes("source"));
  const idxNote = headerCols.findIndex(h => h.includes("note") || h.includes("desc") || h.includes("memo") || h.includes("detail"));
  const idxAmt = headerCols.findIndex(h => h.includes("amount") || h.includes("amt") || h.includes("price") || h.includes("cost") || h.includes("value"));

  const imported = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (!cols.length) continue;

    let date = "";
    let type = "expense";
    let category = "Other";
    let wallet = "Bank Account";
    let note = "";
    let amt = NaN;

    if (idxAmt !== -1 && idxDate !== -1) {
      // Smart Header-Mapped Parsing
      date = (cols[idxDate] || "").trim();
      if (idxType !== -1 && cols[idxType]) {
        type = cols[idxType].trim().toLowerCase() === "income" ? "income" : "expense";
      }
      if (idxCat !== -1 && cols[idxCat]) {
        category = cols[idxCat].trim() || "Other";
      }
      if (idxWallet !== -1 && cols[idxWallet]) {
        wallet = cols[idxWallet].trim() || "Bank Account";
      }
      if (idxNote !== -1 && cols[idxNote]) {
        note = cols[idxNote].trim();
      }
      const rawAmtStr = (cols[idxAmt] || "").replace(/[^0-9.-]+/g, "");
      amt = parseFloat(rawAmtStr);
    } else if (cols.length >= 7) {
      // Standard 7-column export: Date, Type, Category, Wallet, Note, Amount, Currency
      date = (cols[0] || "").trim();
      type = (cols[1] || "").trim().toLowerCase() === "income" ? "income" : "expense";
      category = (cols[2] || "").trim() || "Other";
      wallet = (cols[3] || "").trim() || "Bank Account";
      note = (cols[4] || "").trim();
      amt = parseFloat((cols[5] || "").replace(/[^0-9.-]+/g, ""));
    } else if (cols.length >= 5) {
      // Legacy 5-column export: Date, Type, Category, Note, Amount
      date = (cols[0] || "").trim();
      type = (cols[1] || "").trim().toLowerCase() === "income" ? "income" : "expense";
      category = (cols[2] || "").trim() || "Other";
      note = (cols[3] || "").trim();
      amt = parseFloat((cols[4] || "").replace(/[^0-9.-]+/g, ""));
    } else if (cols.length >= 4) {
      // Minimal 4-column: Date, Category, Note, Amount
      date = (cols[0] || "").trim();
      category = (cols[1] || "").trim() || "Other";
      note = (cols[2] || "").trim();
      amt = parseFloat((cols[3] || "").replace(/[^0-9.-]+/g, ""));
    }

    if (date && !isNaN(amt) && amt > 0) {
      imported.push({
        id: "tx_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6) + "_" + i,
        type,
        amount: Number(amt.toFixed(2)),
        category: category || "Other",
        wallet: wallet || "Bank Account",
        date,
        note: note || category || "Imported transaction",
        createdAt: Date.now()
      });
    }
  }

  if (!imported.length) return showToast("No valid rows found in CSV.");

  const shouldMerge = state.transactions.length > 0 && confirm("Do you want to MERGE with existing records?\n\nClick OK to Merge.\nClick Cancel to REPLACE all records.");

  if (shouldMerge) {
    state.transactions = [...imported, ...state.transactions];
  } else {
    state.transactions = imported;
  }

  saveStorage();
  populateCategorySelects();
  populateFilterCategories();
  render();
  showToast(`Successfully imported ${imported.length} transactions from CSV!`);
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

function resetAllFilters() {
  state.searchQuery = "";
  dom.searchInput.value = "";
  dom.clearSearchBtn.style.display = "none";
  state.periodFilter = "THIS_MONTH";
  dom.filterPeriod.value = "THIS_MONTH";
  dom.customDateInputs.style.display = "none";
  deselectCategory();
}

// Malaysian Working Professional (打工族) Real-Life Simulation (Jan 1 to Sep 3, 2026)
function loadSampleData() {
  // Completely wipe existing transactions to prevent stacking
  state.transactions = [];
  const receipts = {
    dining: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500" style="background:#fff;font-family:monospace;padding:20px;">
        <text x="200" y="40" text-anchor="middle" font-size="18" font-weight="bold">KOPITIAM &amp; CAFE</text>
        <text x="200" y="65" text-anchor="middle" font-size="12" fill="#666">IPOH, PERAK • TAX INVOICE</text>
        <line x1="20" y1="80" x2="380" y2="80" stroke="#ccc" stroke-dasharray="4"/>
        <text x="30" y="120" font-size="14">1x Hainanese Chicken Rice</text><text x="370" y="120" text-anchor="end" font-size="14">RM 12.50</text>
        <text x="30" y="150" font-size="14">1x Kopi C Ping (Iced)</text><text x="370" y="150" text-anchor="end" font-size="14">RM 3.50</text>
        <text x="30" y="180" font-size="14">1x Kaya Butter Toast (2pcs)</text><text x="370" y="180" text-anchor="end" font-size="14">RM 4.80</text>
        <text x="30" y="210" font-size="14">1x Signature Cake Slice</text><text x="370" y="210" text-anchor="end" font-size="14">RM 14.20</text>
        <line x1="20" y1="240" x2="380" y2="240" stroke="#ccc" stroke-dasharray="4"/>
        <text x="30" y="275" font-size="16" font-weight="bold">TOTAL PAID (TNG QR)</text><text x="370" y="275" text-anchor="end" font-size="16" font-weight="bold">RM 35.00</text>
        <text x="200" y="340" text-anchor="middle" font-size="12" fill="#888">THANK YOU FOR YOUR PATRONAGE</text>
      </svg>
    `),
    fuel: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="400" height="460" viewBox="0 0 400 460" style="background:#fff;font-family:monospace;padding:20px;">
        <text x="200" y="40" text-anchor="middle" font-size="18" font-weight="bold">PETRONAS / SHELL</text>
        <text x="200" y="65" text-anchor="middle" font-size="12" fill="#666">PUMP #04 • OFFICIAL RECEIPT</text>
        <line x1="20" y1="80" x2="380" y2="80" stroke="#ccc" stroke-dasharray="4"/>
        <text x="30" y="125" font-size="14">RON95 FUEL (PUMP 4)</text>
        <text x="30" y="155" font-size="13" fill="#555">22.20 LITRES @ RM 2.05/L</text><text x="370" y="155" text-anchor="end" font-size="15" font-weight="bold">RM 45.50</text>
        <line x1="20" y1="190" x2="380" y2="190" stroke="#ccc" stroke-dasharray="4"/>
        <text x="30" y="230" font-size="16" font-weight="bold">PAID VIA VISA CARD</text><text x="370" y="230" text-anchor="end" font-size="16" font-weight="bold">RM 45.50</text>
        <text x="200" y="300" text-anchor="middle" font-size="12" fill="#888">PETRONAS MESRA POINTS EARNED: 45</text>
      </svg>
    `),
    groceries: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="400" height="520" viewBox="0 0 400 520" style="background:#fff;font-family:monospace;padding:20px;">
        <text x="200" y="40" text-anchor="middle" font-size="18" font-weight="bold">LOTUS'S MALAYSIA</text>
        <text x="200" y="65" text-anchor="middle" font-size="12" fill="#666">STORE #108 • HYPERMARKET</text>
        <line x1="20" y1="80" x2="380" y2="80" stroke="#ccc" stroke-dasharray="4"/>
        <text x="30" y="115" font-size="14">Eggs Grade A 30s</text><text x="370" y="115" text-anchor="end" font-size="14">RM 13.50</text>
        <text x="30" y="145" font-size="14">Cooking Oil 5kg</text><text x="370" y="145" text-anchor="end" font-size="14">RM 34.70</text>
        <text x="30" y="175" font-size="14">Jasmine Fragrant Rice 5kg</text><text x="370" y="175" text-anchor="end" font-size="14">RM 38.00</text>
        <text x="30" y="205" font-size="14">Fresh Chicken Breast 1kg</text><text x="370" y="205" text-anchor="end" font-size="14">RM 18.50</text>
        <text x="30" y="235" font-size="14">Milk &amp; Greek Yogurt</text><text x="370" y="235" text-anchor="end" font-size="14">RM 17.80</text>
        <text x="30" y="265" font-size="14">Vegetables &amp; Fruits</text><text x="370" y="265" text-anchor="end" font-size="14">RM 19.50</text>
        <line x1="20" y1="290" x2="380" y2="290" stroke="#ccc" stroke-dasharray="4"/>
        <text x="30" y="325" font-size="16" font-weight="bold">TOTAL AMOUNT</text><text x="370" y="325" text-anchor="end" font-size="16" font-weight="bold">RM 142.00</text>
        <text x="200" y="390" text-anchor="middle" font-size="12" fill="#888">THANK YOU • PLEASE COME AGAIN</text>
      </svg>
    `)
  };

  const breakfasts = [
    { note: "Mamak Roti Canai (2pcs) & Teh Tarik", amt: 5.50, cat: "Food & Dining", wallet: "E-Wallet" },
    { note: "Kopitiam Kaya Butter Toast & Kopi C", amt: 6.80, cat: "Food & Dining", wallet: "Cash" },
    { note: "Nasi Lemak Bungkus & Teh O Ais", amt: 6.00, cat: "Food & Dining", wallet: "E-Wallet" },
    { note: "Dim Sum & Siew Mai breakfast", amt: 12.50, cat: "Food & Dining", wallet: "E-Wallet", hasReceipt: true },
    { note: "Chee Cheong Fun with sweet sauce", amt: 6.50, cat: "Food & Dining", wallet: "Cash" }
  ];

  const lunches = [
    { note: "Economy Rice (杂饭 2 veg 1 meat)", amt: 11.00, cat: "Food & Dining", wallet: "E-Wallet" },
    { note: "Hainanese Chicken Rice & Iced Barley", amt: 12.50, cat: "Food & Dining", wallet: "E-Wallet" },
    { note: "Ipoh Shredded Chicken Hor Fun", amt: 10.50, cat: "Food & Dining", wallet: "Cash" },
    { note: "Dry Chili Pan Mee with poached egg", amt: 11.50, cat: "Food & Dining", wallet: "E-Wallet" },
    { note: "Mamak Nasi Kandar (Ayam Goreng)", amt: 13.00, cat: "Food & Dining", wallet: "E-Wallet" }
  ];

  const dinners = [
    { note: "Food court Char Kway Teow with cockles", amt: 11.50, cat: "Food & Dining", wallet: "Cash" },
    { note: "Tom Yam Fried Rice & Lemon Tea", amt: 13.50, cat: "Food & Dining", wallet: "E-Wallet" },
    { note: "Claypot Chicken Rice dinner", amt: 14.00, cat: "Food & Dining", wallet: "Cash" },
    { note: "Weekend Cafe Dinner & Cake treat", amt: 35.00, cat: "Food & Dining", wallet: "Credit Card", cardId: "card_maybank", cardName: "Maybank Visa Signature", cardType: "credit", hasReceipt: true },
    { note: "Texas Chicken Combo Dinner", amt: 24.50, cat: "Food & Dining", wallet: "E-Wallet" }
  ];

  const simulatedTransactions = [];
  const start = new Date(2026, 0, 1); // Jan 1, 2026
  const end = new Date(2026, 8, 3);   // Sep 3, 2026

  let cur = new Date(start);
  let idCount = 1;

  while (cur <= end) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    const dateStr = `${y}-${m}-${d}`;
    const dayOfMonth = cur.getDate();
    const dayOfWeek = cur.getDay();

    // 1. Monthly Employment Salary on Day 1 (Deposited to Public Bank)
    if (dayOfMonth === 1) {
      simulatedTransactions.push({
        id: "tx_sim_" + (idCount++),
        type: "income",
        amount: 3500.00,
        category: "Salary & Wages",
        wallet: "Bank Transfer",
        cardId: "bank_public",
        cardName: "Public Bank Salary Account",
        cardType: null,
        date: dateStr,
        note: `Employment Salary (${cur.toLocaleString(undefined, { month: "short" })})`,
        createdAt: cur.getTime() + 1000
      });


    }

    // 2. Monthly Savings Deposit on Day 2 (Transferred to Maybank Savings)
    if (dayOfMonth === 2) {
      simulatedTransactions.push({
        id: "tx_sim_" + (idCount++),
        type: "expense",
        amount: 600.00,
        category: "Savings & Investments",
        wallet: "Bank Transfer",
        cardId: "bank_maybank",
        cardName: "Maybank Savings",
        cardType: null,
        date: dateStr,
        note: "Bank Savings Deposit (Pay yourself first)",
        createdAt: cur.getTime() + 3000
      });

      // Spotify Subscription on Day 2 (Charged to Maybank Visa Signature Credit Card)
      simulatedTransactions.push({
        id: "tx_sim_" + (idCount++),
        type: "expense",
        amount: 15.90,
        category: "Entertainment",
        wallet: "Credit Card",
        cardId: "card_maybank",
        cardName: "Maybank Visa Signature",
        cardType: "credit",
        date: dateStr,
        note: "Spotify Premium (Auto-debited)",
        createdAt: cur.getTime() + 4000
      });
    }



    // 4. CelcomDigi Postpaid Bill on Day 15 (Paid via E-Wallet)
    if (dayOfMonth === 15) {
      simulatedTransactions.push({
        id: "tx_sim_" + (idCount++),
        type: "expense",
        amount: 45.00,
        category: "Bills & Utilities",
        wallet: "E-Wallet",
        cardId: null,
        cardName: null,
        cardType: null,
        date: dateStr,
        note: "CelcomDigi Postpaid Bill",
        createdAt: cur.getTime() + 6000
      });
    }

    // 5. Home Fibre Internet on Day 22 (Paid from Maybank)
    if (dayOfMonth === 22) {
      simulatedTransactions.push({
        id: "tx_sim_" + (idCount++),
        type: "expense",
        amount: 89.00,
        category: "Bills & Utilities",
        wallet: "Bank Transfer",
        cardId: "bank_maybank",
        cardName: "Maybank Savings",
        cardType: null,
        date: dateStr,
        note: "Home Fibre Internet 100Mbps",
        createdAt: cur.getTime() + 7000
      });
    }

    // 6. Weekly Shell Petrol RON95 refill on Mondays (Charged to Maybank Visa Signature Credit Card)
    if (dayOfWeek === 1) {
      simulatedTransactions.push({
        id: "tx_sim_" + (idCount++),
        type: "expense",
        amount: 45.50,
        category: "Transportation",
        wallet: "Credit Card",
        cardId: "card_maybank",
        cardName: "Maybank Visa Signature",
        cardType: "credit",
        date: dateStr,
        note: "Shell RON95 Petrol refill",
        receiptImage: receipts.fuel,
        createdAt: cur.getTime() + 8000
      });
    }

    // 7. Bi-weekly Hypermarket Groceries at Lotus's on Days 10 & 24 (Paid via Maybank Visa Debit Card)
    if (dayOfMonth === 10 || dayOfMonth === 24) {
      simulatedTransactions.push({
        id: "tx_sim_" + (idCount++),
        type: "expense",
        amount: 142.00,
        category: "Groceries",
        wallet: "Debit Card",
        cardId: "debit_maybank",
        cardName: "Maybank Visa Debit",
        cardType: "debit",
        date: dateStr,
        note: "Lotus's Supermarket groceries",
        receiptImage: receipts.groceries,
        createdAt: cur.getTime() + 9000
      });
    }

    // 8. Occasional Touch 'n Go Toll Reload
    if (dayOfMonth === 12 || dayOfMonth === 26) {
      simulatedTransactions.push({
        id: "tx_sim_" + (idCount++),
        type: "expense",
        amount: 30.00,
        category: "Transportation",
        wallet: "E-Wallet",
        date: dateStr,
        note: "Touch 'n Go eWallet toll reload",
        createdAt: cur.getTime() + 9500
      });
    }

    // 9. Everyday 3 Meals (Breakfast, Lunch, Dinner)
    const bf = breakfasts[(dayOfMonth + 1) % breakfasts.length];
    simulatedTransactions.push({
      id: "tx_sim_" + (idCount++),
      type: "expense",
      amount: bf.amt,
      category: bf.cat,
      wallet: bf.wallet,
      date: dateStr,
      note: bf.note,
      receiptImage: bf.hasReceipt ? receipts.dining : null,
      createdAt: cur.getTime() + 10000
    });

    const ln = lunches[(dayOfMonth + 2) % lunches.length];
    simulatedTransactions.push({
      id: "tx_sim_" + (idCount++),
      type: "expense",
      amount: ln.amt,
      category: ln.cat,
      wallet: ln.wallet,
      date: dateStr,
      note: ln.note,
      createdAt: cur.getTime() + 15000
    });

    const dn = dinners[(dayOfMonth + 3) % dinners.length];
    simulatedTransactions.push({
      id: "tx_sim_" + (idCount++),
      type: "expense",
      amount: dn.amt,
      category: dn.cat,
      wallet: dn.wallet,
      cardId: dn.cardId || null,
      cardName: dn.cardName || null,
      cardType: dn.cardType || null,
      date: dateStr,
      note: dn.note,
      receiptImage: dn.hasReceipt ? receipts.dining : null,
      createdAt: cur.getTime() + 20000
    });

    cur.setDate(cur.getDate() + 1);
  }

  // Replace transactions array
  state.transactions = simulatedTransactions.reverse();

  // Populate active subscriptions list for Malaysian worker
  const today = new Date();
  const currentYm = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  // Sample Bank Accounts (Liquid Assets & Payment Accounts)
  state.bankAccounts = [
    {
      id: "bank_maybank",
      name: "Maybank Savings",
      bank: "Maybank",
      initialBalance: 3450.00,
      balance: 3450.00,
      createdAt: Date.now()
    },
    {
      id: "bank_public",
      name: "Public Bank Salary Account",
      bank: "Public Bank",
      initialBalance: 5200.00,
      balance: 5200.00,
      createdAt: Date.now()
    }
  ];

  // Sample Credit Cards: Maybank Visa Signature
  state.creditCards = [
    {
      id: "card_maybank",
      name: "Maybank Visa Signature",
      bank: "Maybank",
      linkedBankAccountId: "bank_maybank",
      statementDay: 25,
      dueDay: 15,
      creditLimit: 10000.00,
      currentBilled: 450.00,
      unbilledBalance: 135.00,
      payInFull: true,
      lastStatementRolledMonth: "2026-08",
      lastDuePromptedMonth: "2026-08",
      createdAt: Date.now()
    }
  ];

  // Sample Debit Cards: Maybank Visa Debit (Linked to Maybank Savings)
  state.debitCards = [
    {
      id: "debit_maybank",
      name: "Maybank Visa Debit",
      bank: "Maybank",
      bankAccountId: "bank_maybank",
      totalSpentThisMonth: 180.00,
      createdAt: Date.now()
    }
  ];

  // Sample Notifications
  state.notifications = [
    {
      id: "notif_due_maybank_sep",
      type: "action_due",
      cardId: "card_maybank",
      cardName: "Maybank Visa Signature",
      billedAmount: 450.00,
      minDue: 50.00,
      title: "🔔 Payment Due: Maybank Visa Signature",
      time: new Date().toISOString(),
      isRead: false,
      decision: null,
      body: "Your statement balance of RM 450.00 is due on Day 15. Minimum payment (5% CCRIS rule): RM 50.00."
    },
    {
      id: "notif_stmt_aug",
      type: "statement",
      cardId: "card_maybank",
      title: "📅 Maybank Visa Statement Ready",
      time: new Date().toISOString(),
      isRead: true,
      body: "Statement closed on Aug 25. Total statement bill: RM 450.00 due on Sep 15."
    }
  ];

  // Sample Active Loans: Perodua Bezza Hire Purchase (Started Jan 2026, 8 months repaid)
  state.loans = [
    {
      id: "loan_bezza",
      name: "Perodua Bezza 1.3X (Hire Purchase)",
      bank: "Public Bank",
      type: "CAR_EIR",
      originalPrincipal: 38000.00,
      remainingPrincipal: 34160.00,
      rate: 3.20,
      tenureMonths: 84, // 7 years
      remainingMonths: 76,
      monthlyInstallment: 480.00,
      totalInterest: 4320.00,
      dueDay: 5,
      linkedBankAccountId: "bank_public",
      lastPaidMonth: "2026-08",
      createdAt: Date.now()
    }
  ];

  state.subscriptions = [
    { id: "sub_spotify", name: "Spotify Premium", amount: 15.90, category: "Entertainment", billingDay: 2, wallet: "Credit Card", sourceId: "card_maybank", sourceName: "Maybank Visa Signature", cardName: "Maybank Visa Signature", autoDeduct: true, lastLoggedMonth: currentYm, createdAt: Date.now() },
    { id: "sub_mobile", name: "CelcomDigi Postpaid", amount: 45.00, category: "Bills & Utilities", billingDay: 15, wallet: "E-Wallet", autoDeduct: true, lastLoggedMonth: null, createdAt: Date.now() },
    { id: "sub_wifi", name: "Home Fibre Internet", amount: 89.00, category: "Bills & Utilities", billingDay: 22, wallet: "Bank Transfer", sourceId: "bank_maybank", sourceName: "Maybank Savings", cardName: "Maybank Savings", autoDeduct: true, lastLoggedMonth: null, createdAt: Date.now() }
  ];

  saveStorage();
  render();
  showToast("Loaded Malaysian workhorse daily routine (Jan 1 – Sep 3, 2026)!");
}


function escapeHtml(s) {
  return (s || "").replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c] || c));
}

// Register Service Worker with Auto-Reload on Update
function registerSW() {
  if ("serviceWorker" in navigator) {
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });

    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").then((reg) => {
        reg.update().catch(() => {});
      }).catch(() => {});
    });
  }
}

window.addEventListener("DOMContentLoaded", init);
