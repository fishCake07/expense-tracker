// Category Color & Icon Maps
const EXPENSE_CATEGORIES = [
  { name: "Food & Dining", icon: "🍔", color: "#f97316" },
  { name: "Transportation", icon: "🚗", color: "#3b82f6" },
  { name: "Shopping", icon: "🛍️", color: "#ec4899" },
  { name: "Entertainment", icon: "🎬", color: "#8b5cf6" },
  { name: "Bills & Utilities", icon: "⚡", color: "#eab308" },
  { name: "Health & Medical", icon: "💊", color: "#10b981" },
  { name: "Education", icon: "📚", color: "#06b6d4" },
  { name: "Other", icon: "📦", color: "#64748b" }
];

const INCOME_CATEGORIES = [
  { name: "Salary & Wages", icon: "💼", color: "#10b981" },
  { name: "Freelance & Projects", icon: "💻", color: "#06b6d4" },
  { name: "Investments & Dividends", icon: "📈", color: "#3b82f6" },
  { name: "Business & Sales", icon: "🏷️", color: "#8b5cf6" },
  { name: "Gifts & Allowance", icon: "🎁", color: "#ec4899" },
  { name: "Other Income", icon: "💵", color: "#64748b" }
];

const ALL_CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];
const CATEGORY_COLORS = Object.fromEntries(ALL_CATEGORIES.map(c => [c.name, c.color]));
const CATEGORY_ICONS = Object.fromEntries(ALL_CATEGORIES.map(c => [c.name, c.icon]));

// Application State
const state = {
  transactions: [],
  currency: "$",
  monthlyBudget: 0,
  filterCategory: "ALL",
  selectedCategory: null,
  periodFilter: "ALL",
  searchQuery: "",
  customStartDate: "",
  customEndDate: "",
  currentFormType: "expense"
};

const STORAGE_KEYS = {
  tx: "expense_tracker_transactions_v1",
  currency: "expense_tracker_currency_v1",
  budget: "expense_tracker_budget_v1"
};

// DOM Cache
const $ = (id) => document.getElementById(id);
const dom = {
  form: $("expense-form"),
  tabExpense: $("tab-expense"),
  tabIncome: $("tab-income"),
  amount: $("amount"),
  category: $("category"),
  date: $("date"),
  note: $("note"),
  currencySelect: $("currency-select"),
  currencyDisplay: $("currency-display"),
  budgetSpent: $("budget-spent-display"),
  budgetLimit: $("budget-limit-display"),
  budgetBtnText: $("budget-btn-text"),
  budgetMonthLabel: $("budget-month-label"),
  budgetBarFill: $("budget-bar-fill"),
  budgetRemaining: $("budget-remaining-text"),
  budgetPercentage: $("budget-percentage-text"),
  budgetDialog: $("budget-dialog"),
  budgetForm: $("budget-form"),
  budgetInput: $("budget-input"),
  budgetCurrency: $("budget-dialog-currency"),
  editBudgetBtn: $("edit-budget-btn"),
  cancelBudgetBtn: $("cancel-budget-btn"),
  netBalance: $("net-balance"),
  netBalanceSub: $("net-balance-sub"),
  totalIncome: $("total-income"),
  incomeCount: $("income-count"),
  totalSpend: $("total-spend"),
  txCount: $("transaction-count"),
  topCategory: $("top-category"),
  topCategoryAmt: $("top-category-amount"),
  donutWrapper: $("donut-wrapper"),
  donutSegments: $("donut-segments-group"),
  donutCenter: $("donut-center-info"),
  donutLabel: $("donut-center-label"),
  donutVal: $("donut-center-val"),
  donutHint: $("donut-center-hint"),
  breakdownList: $("category-breakdown-list"),
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
  exportCsvBtn: $("export-csv-btn"),
  exportJsonBtn: $("export-json-btn"),
  importBtn: $("import-btn"),
  importFileInput: $("import-file-input"),
  editDialog: $("edit-dialog"),
  editForm: $("edit-expense-form"),
  editTxId: $("edit-tx-id"),
  editType: $("edit-type"),
  editAmount: $("edit-amount"),
  editCategory: $("edit-category"),
  editDate: $("edit-date"),
  editNote: $("edit-note"),
  editCurrency: $("edit-dialog-currency"),
  cancelEditBtn: $("cancel-edit-btn"),
  toast: $("toast")
};

// Initialize
function init() {
  loadStorage();
  setDefaultDate();
  populateCategorySelects();
  bindEvents();
  render();
  registerSW();
}

function setDefaultDate() {
  const today = new Date().toISOString().split("T")[0];
  dom.date.value = today;
  dom.date.max = today;
}

function populateCategorySelects(isIncome = false, targetEl = dom.category) {
  const list = isIncome ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  targetEl.innerHTML = `<option value="" disabled selected>Select category</option>` +
    list.map(c => `<option value="${c.name}">${c.icon} ${c.name}</option>`).join("");
}

function loadStorage() {
  try {
    const tx = localStorage.getItem(STORAGE_KEYS.tx);
    if (tx) state.transactions = JSON.parse(tx);
    const curr = localStorage.getItem(STORAGE_KEYS.currency);
    if (curr) {
      state.currency = curr;
      dom.currencySelect.value = curr;
    }
    const bg = localStorage.getItem(STORAGE_KEYS.budget);
    if (bg) state.monthlyBudget = parseFloat(bg) || 0;
  } catch (e) {
    state.transactions = [];
  }
}

function saveStorage() {
  try {
    localStorage.setItem(STORAGE_KEYS.tx, JSON.stringify(state.transactions));
    localStorage.setItem(STORAGE_KEYS.currency, state.currency);
    localStorage.setItem(STORAGE_KEYS.budget, state.monthlyBudget.toString());
  } catch (e) {}
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

// Event Bindings
function bindEvents() {
  // Option 6: Type Toggle Tabs (Expense vs Income)
  dom.tabExpense.addEventListener("click", () => setFormType("expense"));
  dom.tabIncome.addEventListener("click", () => setFormType("income"));

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

  dom.clearAllBtn.addEventListener("click", () => {
    if (!state.transactions.length) return showToast("No records to clear.");
    if (confirm("Delete all logged transactions? This cannot be undone.")) {
      state.transactions = [];
      deselectCategory();
      saveStorage();
      render();
      showToast("All records cleared.");
    }
  });

  dom.loadSampleBtn.addEventListener("click", loadSampleData);

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

  // Budget dialog
  dom.editBudgetBtn.addEventListener("click", () => {
    dom.budgetInput.value = state.monthlyBudget > 0 ? state.monthlyBudget : "";
    dom.budgetCurrency.textContent = state.currency;
    dom.budgetDialog?.showModal ? dom.budgetDialog.showModal() : promptBudget();
  });

  dom.cancelBudgetBtn.addEventListener("click", () => dom.budgetDialog.close());

  dom.budgetForm.addEventListener("submit", (e) => {
    e.preventDefault();
    state.monthlyBudget = Math.max(0, parseFloat(dom.budgetInput.value) || 0);
    saveStorage();
    renderBudget();
    dom.budgetDialog.close();
    showToast(state.monthlyBudget > 0 ? `Budget set to ${formatCurrency(state.monthlyBudget)}` : "Budget cleared.");
  });

  // Donut center tap to deselect
  dom.donutCenter.addEventListener("click", (e) => {
    e.stopPropagation();
    if (state.selectedCategory) deselectCategory();
  });

  // Export & Import Listeners
  dom.exportCsvBtn.addEventListener("click", exportToCSV);
  dom.exportJsonBtn.addEventListener("click", exportToJSON);
  dom.importBtn.addEventListener("click", () => dom.importFileInput.click());
  dom.importFileInput.addEventListener("change", handleFileImport);

  // Edit Dialog Listeners
  dom.cancelEditBtn.addEventListener("click", () => dom.editDialog.close());
  dom.editForm.addEventListener("submit", handleSaveEdit);
  dom.editType.addEventListener("change", (e) => {
    populateCategorySelects(e.target.value === "income", dom.editCategory);
  });
}

function setFormType(type) {
  state.currentFormType = type;
  dom.tabExpense.classList.toggle("active", type === "expense");
  dom.tabIncome.classList.toggle("active", type === "income");
  populateCategorySelects(type === "income", dom.category);
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

function promptBudget() {
  const p = prompt("Enter monthly budget target:", state.monthlyBudget || "");
  if (p !== null) {
    state.monthlyBudget = Math.max(0, parseFloat(p) || 0);
    saveStorage();
    renderBudget();
  }
}

// Add Transaction (Expense or Income)
function handleAddTransaction(e) {
  e.preventDefault();
  const amt = parseFloat(dom.amount.value);
  const cat = dom.category.value;
  const dt = dom.date.value;
  const nt = dom.note.value.trim();

  $("amount-error").textContent = (!amt || amt <= 0) ? "Enter an amount greater than 0." : "";
  $("category-error").textContent = !cat ? "Please select a category." : "";
  $("date-error").textContent = !dt ? "Please choose a date." : "";

  if (!amt || amt <= 0 || !cat || !dt) return;

  state.transactions.unshift({
    id: "tx_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
    type: state.currentFormType, // "expense" or "income"
    amount: Number(amt.toFixed(2)),
    category: cat,
    date: dt,
    note: nt || cat,
    createdAt: Date.now()
  });

  saveStorage();
  dom.amount.value = "";
  dom.category.value = "";
  dom.note.value = "";
  setDefaultDate();
  dom.amount.focus();

  render();
  showToast(`${state.currentFormType === "income" ? "Income" : "Expense"} added!`);
}

// Option 4: Edit Transaction Functions
function openEditModal(id) {
  const tx = state.transactions.find(t => t.id === id);
  if (!tx) return;

  const isIncome = tx.type === "income";
  dom.editTxId.value = tx.id;
  dom.editType.value = isIncome ? "income" : "expense";
  populateCategorySelects(isIncome, dom.editCategory);

  dom.editAmount.value = tx.amount;
  dom.editCategory.value = tx.category;
  dom.editDate.value = tx.date;
  dom.editNote.value = tx.note === tx.category ? "" : tx.note;
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

  if (!amt || amt <= 0 || !cat || !dt) return;

  tx.type = type;
  tx.amount = Number(amt.toFixed(2));
  tx.category = cat;
  tx.date = dt;
  tx.note = nt || cat;

  saveStorage();
  render();
  dom.editDialog.close();
  showToast("Transaction updated!");
}

function deleteExpense(id) {
  const idx = state.transactions.findIndex(t => t.id === id);
  if (idx === -1) return;
  const deleted = state.transactions.splice(idx, 1)[0];
  saveStorage();
  render();
  showToast(`Deleted "${deleted.note}"`);
}

// Option 5: Multi-Criteria Filter Logic
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
      const matchAmt = t.amount.toString().includes(state.searchQuery);
      if (!matchNote && !matchCat && !matchAmt) return false;
    }

    return true;
  });
}

// Main Render
function render() {
  dom.currencyDisplay.textContent = state.currency;
  dom.budgetCurrency.textContent = state.currency;
  renderBudget();
  renderMetrics();
  renderBreakdown();
  renderTransactionList();
}

// Render Budget (Calculated from Expenses only)
function renderBudget() {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  dom.budgetMonthLabel.textContent = `Monthly Budget (${now.toLocaleString(undefined, { month: "long", year: "numeric" })})`;

  const monthSpend = state.transactions
    .filter(t => (t.type || "expense") === "expense" && t.date && t.date.startsWith(ym))
    .reduce((sum, t) => sum + t.amount, 0);

  dom.budgetSpent.textContent = formatCurrency(monthSpend);

  if (!state.monthlyBudget || state.monthlyBudget <= 0) {
    dom.budgetLimit.textContent = "Not set";
    dom.budgetBtnText.textContent = "Set Budget";
    dom.budgetBarFill.style.width = "0%";
    dom.budgetBarFill.className = "budget-bar-fill";
    dom.budgetRemaining.textContent = "No budget target set";
    dom.budgetRemaining.className = "budget-remaining";
    dom.budgetPercentage.textContent = "—";
    return;
  }

  dom.budgetBtnText.textContent = "Edit Budget";
  dom.budgetLimit.textContent = formatCurrency(state.monthlyBudget);

  const pct = (monthSpend / state.monthlyBudget) * 100;
  dom.budgetBarFill.style.width = `${Math.min(100, Math.max(0, pct))}%`;
  dom.budgetBarFill.className = "budget-bar-fill";
  dom.budgetRemaining.className = "budget-remaining";

  if (monthSpend > state.monthlyBudget) {
    dom.budgetBarFill.classList.add("danger");
    dom.budgetRemaining.classList.add("over");
    dom.budgetRemaining.textContent = `⚠️ Over budget by ${formatCurrency(monthSpend - state.monthlyBudget)}`;
  } else {
    dom.budgetRemaining.textContent = `Remaining: ${formatCurrency(state.monthlyBudget - monthSpend)}`;
    if (pct >= 80) dom.budgetBarFill.classList.add("warning");
  }
  dom.budgetPercentage.textContent = `${pct.toFixed(0)}% spent`;
}

// Option 6: Render Cash Flow & Net Balance Metrics
function renderMetrics() {
  const expenses = state.transactions.filter(t => (t.type || "expense") === "expense");
  const incomes = state.transactions.filter(t => t.type === "income");

  const totalExpenseAmt = expenses.reduce((s, t) => s + t.amount, 0);
  const totalIncomeAmt = incomes.reduce((s, t) => s + t.amount, 0);
  const netBalanceAmt = totalIncomeAmt - totalExpenseAmt;

  dom.totalSpend.textContent = formatCurrency(totalExpenseAmt);
  dom.txCount.textContent = `${expenses.length} ${expenses.length === 1 ? "expense" : "expenses"} logged`;

  dom.totalIncome.textContent = formatCurrency(totalIncomeAmt);
  dom.incomeCount.textContent = `${incomes.length} ${incomes.length === 1 ? "earning" : "earnings"} logged`;

  dom.netBalance.textContent = formatCurrency(netBalanceAmt);
  if (netBalanceAmt >= 0) {
    dom.netBalance.className = "metric-value positive";
    dom.netBalanceSub.textContent = "Positive cash flow (savings)";
  } else {
    dom.netBalance.className = "metric-value negative";
    dom.netBalanceSub.textContent = "Deficit (spending exceeds income)";
  }

  if (!expenses.length) {
    dom.topCategory.textContent = "—";
    dom.topCategoryAmt.textContent = "No expenses yet";
    return;
  }

  const totals = {};
  expenses.forEach(t => totals[t.category] = (totals[t.category] || 0) + t.amount);
  const top = Object.entries(totals).sort((a, b) => b[1] - a[1])[0];
  dom.topCategory.textContent = `${CATEGORY_ICONS[top[0]] || "🏷️"} ${top[0]}`;
  dom.topCategoryAmt.textContent = `${formatCurrency(top[1])} total`;
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

// Render Donut & Breakdown (Focuses on Expenses)
function renderBreakdown() {
  const expenses = state.transactions.filter(t => (t.type || "expense") === "expense");
  const total = expenses.reduce((s, t) => s + t.amount, 0);

  if (!total || !expenses.length) {
    dom.breakdownList.innerHTML = `<p class="empty-state">No categorized expenses recorded yet.</p>`;
    if (dom.donutSegments) dom.donutSegments.innerHTML = "";
    dom.donutWrapper?.classList.remove("has-selection");
    dom.donutLabel.textContent = "Total";
    dom.donutVal.textContent = formatCurrency(0);
    if (dom.donutHint) dom.donutHint.style.display = "none";
    return;
  }

  const totals = {};
  expenses.forEach(t => totals[t.category] = (totals[t.category] || 0) + t.amount);
  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);

  if (dom.donutSegments) {
    const r = 58;
    const c = 2 * Math.PI * r;
    let acc = 0;
    let segHtml = "";

    sorted.forEach(([cat, amt]) => {
      const p = amt / total;
      const len = p * c;
      const off = -acc * c;
      const isSel = state.selectedCategory === cat;
      const color = CATEGORY_COLORS[cat] || "#64748b";

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

    if (state.selectedCategory && totals[state.selectedCategory]) {
      const selAmt = totals[state.selectedCategory];
      const selPct = ((selAmt / total) * 100).toFixed(1);
      dom.donutWrapper?.classList.add("has-selection");
      dom.donutLabel.textContent = state.selectedCategory;
      dom.donutVal.textContent = `${formatCurrency(selAmt)} (${selPct}%)`;
      if (dom.donutHint) dom.donutHint.style.display = "block";
    } else {
      dom.donutWrapper?.classList.remove("has-selection");
      dom.donutLabel.textContent = "Total";
      dom.donutVal.textContent = formatCurrency(total);
      if (dom.donutHint) dom.donutHint.style.display = "none";
    }

    dom.donutSegments.querySelectorAll(".donut-segment").forEach(seg => {
      const cat = seg.dataset.category;
      seg.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleCategory(cat);
      });
      seg.addEventListener("mouseenter", () => {
        if (!state.selectedCategory) {
          dom.donutLabel.textContent = cat;
          dom.donutVal.textContent = `${formatCurrency(seg.dataset.amount)} (${seg.dataset.percentage}%)`;
        }
      });
      seg.addEventListener("mouseleave", () => {
        if (!state.selectedCategory) {
          dom.donutLabel.textContent = "Total";
          dom.donutVal.textContent = formatCurrency(total);
        }
      });
    });
  }

  let listHtml = "";
  sorted.forEach(([cat, amt]) => {
    const pct = ((amt / total) * 100).toFixed(1);
    const color = CATEGORY_COLORS[cat] || "#4f46e5";
    const isSel = state.selectedCategory === cat;

    listHtml += `
      <div class="breakdown-item ${isSel ? "selected" : ""}" data-category="${cat}" style="${isSel ? "background:var(--bg-subtle); font-weight:700;" : ""}">
        <div class="breakdown-header">
          <span class="breakdown-header-title">
            <span class="category-dot" style="background-color:${color};"></span>
            ${CATEGORY_ICONS[cat] || "🏷️"} ${cat}
          </span>
          <span>${formatCurrency(amt)} <span style="color:var(--text-muted); font-size:0.8rem">(${pct}%)</span></span>
        </div>
        <div class="breakdown-bar-bg">
          <div class="breakdown-bar-fill" style="width:${pct}%; background-color:${color};"></div>
        </div>
      </div>
    `;
  });

  dom.breakdownList.innerHTML = listHtml;
  dom.breakdownList.querySelectorAll(".breakdown-item").forEach(item => {
    item.addEventListener("click", () => toggleCategory(item.dataset.category));
  });
}

// Transaction List Render (Supports Income & Expense)
function renderTransactionList() {
  const filtered = getFilteredTransactions();
  let list = [...filtered].sort((a, b) => new Date(b.date) - new Date(a.date) || b.createdAt - a.createdAt);

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
    const icon = CATEGORY_ICONS[tx.category] || (isIncome ? "💵" : "🏷️");
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

// Option 3: Export to CSV (Includes Type column)
function exportToCSV() {
  if (!state.transactions.length) return showToast("No transactions to export.");

  const headers = ["Date", "Type", "Category", "Note", "Amount", "Currency"];
  const rows = state.transactions.map(t => [
    t.date,
    t.type || "expense",
    `"${(t.category || "").replace(/"/g, '""')}"`,
    `"${(t.note || "").replace(/"/g, '""')}"`,
    t.amount.toFixed(2),
    state.currency
  ]);

  const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\r\n");
  const today = new Date().toISOString().split("T")[0];
  downloadBlob(new Blob([csvContent], { type: "text/csv;charset=utf-8;" }), `expenses_${today}.csv`);
  showToast(`Exported ${state.transactions.length} transactions to CSV!`);
}

// Option 3: Export to JSON (Full Backup)
function exportToJSON() {
  const backupData = {
    appName: "Expense Tracker",
    version: 1,
    exportedAt: new Date().toISOString(),
    currency: state.currency,
    monthlyBudget: state.monthlyBudget,
    transactions: state.transactions
  };

  const jsonStr = JSON.stringify(backupData, null, 2);
  const today = new Date().toISOString().split("T")[0];
  downloadBlob(new Blob([jsonStr], { type: "application/json;charset=utf-8;" }), `expense_tracker_backup_${today}.json`);
  showToast("Full backup file downloaded!");
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Import JSON or CSV file
function handleFileImport(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  const isJson = file.name.endsWith(".json");
  const isCsv = file.name.endsWith(".csv");

  reader.onload = (evt) => {
    try {
      const content = evt.target.result;
      if (isJson) {
        importJSONData(content);
      } else if (isCsv) {
        importCSVData(content);
      } else {
        showToast("Unsupported file format. Use .json or .csv.");
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to parse imported file.");
    } finally {
      dom.importFileInput.value = "";
    }
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
    if (parsed.monthlyBudget) state.monthlyBudget = parsed.monthlyBudget;
  }

  saveStorage();
  render();
  showToast(`Successfully imported ${validTx.length} transactions!`);
}

function importCSVData(csvStr) {
  const lines = csvStr.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length <= 1) return showToast("CSV file is empty.");

  const imported = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length >= 4) {
      let [date, typeOrCat, catOrNote, noteOrAmt, amtStr] = cols;
      let type = "expense";
      let category = typeOrCat;
      let note = catOrNote;
      let amt = parseFloat(noteOrAmt);

      if (cols.length >= 5 && (typeOrCat === "expense" || typeOrCat === "income")) {
        type = typeOrCat;
        category = catOrNote;
        note = noteOrAmt;
        amt = parseFloat(amtStr);
      }

      if (date && category && !isNaN(amt) && amt > 0) {
        imported.push({
          id: "tx_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6) + "_" + i,
          type,
          amount: Number(amt.toFixed(2)),
          category: category.trim(),
          date: date.trim(),
          note: (note || category).trim(),
          createdAt: Date.now()
        });
      }
    }
  }

  if (!imported.length) return showToast("No valid rows found in CSV.");
  state.transactions = [...imported, ...state.transactions];
  saveStorage();
  render();
  showToast(`Imported ${imported.length} transactions from CSV!`);
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
  state.periodFilter = "ALL";
  dom.filterPeriod.value = "ALL";
  dom.customDateInputs.style.display = "none";
  deselectCategory();
}

// Sample Data Loader (Includes Incomes & Expenses)
function loadSampleData() {
  const d = (ago) => {
    const dt = new Date();
    dt.setDate(dt.getDate() - ago);
    return dt.toISOString().split("T")[0];
  };

  const samples = [
    { id: "tx_s0", type: "income", amount: 3500.00, category: "Salary & Wages", date: d(0), note: "Monthly employment salary", createdAt: Date.now() - 1000 },
    { id: "tx_s1", type: "expense", amount: 14.50, category: "Food & Dining", date: d(0), note: "Chicken Rice & Iced Tea lunch", createdAt: Date.now() - 3600000 },
    { id: "tx_s2", type: "expense", amount: 28.00, category: "Transportation", date: d(1), note: "Petrol refill", createdAt: Date.now() - 86400000 },
    { id: "tx_s3", type: "expense", amount: 65.00, category: "Shopping", date: d(2), note: "Running socks and shorts", createdAt: Date.now() - 172800000 },
    { id: "tx_s4", type: "expense", amount: 45.00, category: "Bills & Utilities", date: d(3), note: "Monthly mobile data plan", createdAt: Date.now() - 259200000 },
    { id: "tx_s5", type: "income", amount: 250.00, category: "Freelance & Projects", date: d(4), note: "Website design consulting", createdAt: Date.now() - 345600000 }
  ];

  state.transactions = [...samples, ...state.transactions];
  if (!state.monthlyBudget) state.monthlyBudget = 1000;
  saveStorage();
  render();
  showToast("Sample transactions with income & expenses loaded!");
}

function escapeHtml(s) {
  return (s || "").replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c] || c));
}

function registerSW() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }
}

window.addEventListener("DOMContentLoaded", init);
