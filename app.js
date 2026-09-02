// Category Color & Icon Maps
const CATEGORY_COLORS = {
  "Food & Dining": "#f97316",
  "Transportation": "#3b82f6",
  "Shopping": "#ec4899",
  "Entertainment": "#8b5cf6",
  "Bills & Utilities": "#eab308",
  "Health & Medical": "#10b981",
  "Education": "#06b6d4",
  "Other": "#64748b"
};

const CATEGORY_ICONS = {
  "Food & Dining": "🍔",
  "Transportation": "🚗",
  "Shopping": "🛍️",
  "Entertainment": "🎬",
  "Bills & Utilities": "⚡",
  "Health & Medical": "💊",
  "Education": "📚",
  "Other": "📦"
};

// Application State
const state = {
  transactions: [],
  currency: "$",
  monthlyBudget: 0,
  filterCategory: "ALL",
  selectedCategory: null
};

const STORAGE_KEY_TRANSACTIONS = "expense_tracker_transactions_v1";
const STORAGE_KEY_CURRENCY = "expense_tracker_currency_v1";
const STORAGE_KEY_BUDGET = "expense_tracker_budget_v1";

// DOM Elements
const form = document.getElementById("expense-form");
const amountInput = document.getElementById("amount");
const categorySelect = document.getElementById("category");
const dateInput = document.getElementById("date");
const noteInput = document.getElementById("note");
const currencySelect = document.getElementById("currency-select");
const currencyDisplay = document.getElementById("currency-display");

const totalSpendEl = document.getElementById("total-spend");
const transactionCountEl = document.getElementById("transaction-count");
const topCategoryEl = document.getElementById("top-category");
const topCategoryAmountEl = document.getElementById("top-category-amount");
const latestDateEl = document.getElementById("latest-date");
const latestNoteEl = document.getElementById("latest-note");

const categoryBreakdownList = document.getElementById("category-breakdown-list");
const transactionList = document.getElementById("transaction-list");
const filterCategorySelect = document.getElementById("filter-category");
const clearAllBtn = document.getElementById("clear-all-btn");
const loadSampleBtn = document.getElementById("load-sample-btn");
const toastEl = document.getElementById("toast");

// Budget Elements (Option 1)
const budgetMonthLabel = document.getElementById("budget-month-label");
const budgetSpentDisplay = document.getElementById("budget-spent-display");
const budgetLimitDisplay = document.getElementById("budget-limit-display");
const editBudgetBtn = document.getElementById("edit-budget-btn");
const budgetBtnText = document.getElementById("budget-btn-text");
const budgetBarFill = document.getElementById("budget-bar-fill");
const budgetRemainingText = document.getElementById("budget-remaining-text");
const budgetPercentageText = document.getElementById("budget-percentage-text");
const budgetDialog = document.getElementById("budget-dialog");
const budgetForm = document.getElementById("budget-form");
const budgetInput = document.getElementById("budget-input");
const cancelBudgetBtn = document.getElementById("cancel-budget-btn");
const budgetDialogCurrency = document.getElementById("budget-dialog-currency");

// Initialize Application
function init() {
  loadFromStorage();
  setDefaultDate();
  bindEvents();
  render();
  registerServiceWorker();
}

function setDefaultDate() {
  const today = new Date().toISOString().split("T")[0];
  dateInput.value = today;
  dateInput.max = today;
}

function loadFromStorage() {
  try {
    const savedTransactions = localStorage.getItem(STORAGE_KEY_TRANSACTIONS);
    if (savedTransactions) {
      state.transactions = JSON.parse(savedTransactions);
    }
    const savedCurrency = localStorage.getItem(STORAGE_KEY_CURRENCY);
    if (savedCurrency) {
      state.currency = savedCurrency;
      currencySelect.value = savedCurrency;
    }
    const savedBudget = localStorage.getItem(STORAGE_KEY_BUDGET);
    if (savedBudget !== null) {
      state.monthlyBudget = parseFloat(savedBudget) || 0;
    }
  } catch (err) {
    state.transactions = [];
  }
}

function saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(state.transactions));
    localStorage.setItem(STORAGE_KEY_CURRENCY, state.currency);
    localStorage.setItem(STORAGE_KEY_BUDGET, state.monthlyBudget.toString());
  } catch (err) {}
}

function formatCurrency(amount) {
  const num = Number(amount) || 0;
  return `${state.currency}${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateString) {
  if (!dateString) return "—";
  const [year, month, day] = dateString.split("-");
  if (!year || !month || !day) return dateString;
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function getCurrentMonthSpending() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = String(now.getMonth() + 1).padStart(2, "0");
  const monthPrefix = `${currentYear}-${currentMonth}`;

  return state.transactions
    .filter(t => t.date && t.date.startsWith(monthPrefix))
    .reduce((sum, t) => sum + t.amount, 0);
}

let toastTimeout;
function showToast(message) {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toastEl.classList.remove("show");
  }, 2600);
}

function bindEvents() {
  form.addEventListener("submit", handleAddExpense);

  currencySelect.addEventListener("change", (e) => {
    state.currency = e.target.value;
    currencyDisplay.textContent = state.currency;
    budgetDialogCurrency.textContent = state.currency;
    saveToStorage();
    render();
    showToast(`Currency updated to ${state.currency}`);
  });

  filterCategorySelect.addEventListener("change", (e) => {
    const val = e.target.value;
    if (val === "ALL") {
      deselectCategory();
    } else {
      selectCategory(val);
    }
  });

  clearAllBtn.addEventListener("click", () => {
    if (state.transactions.length === 0) {
      showToast("No expenses to clear.");
      return;
    }
    if (confirm("Are you sure you want to delete all expenses? This cannot be undone.")) {
      state.transactions = [];
      saveToStorage();
      render();
      showToast("All expenses cleared.");
    }
  });

  loadSampleBtn.addEventListener("click", loadSampleData);

  editBudgetBtn.addEventListener("click", () => {
    budgetInput.value = state.monthlyBudget > 0 ? state.monthlyBudget : "";
    budgetDialogCurrency.textContent = state.currency;
    if (typeof budgetDialog.showModal === "function") {
      budgetDialog.showModal();
    } else {
      const prompted = prompt("Enter monthly budget target:", state.monthlyBudget || "");
      if (prompted !== null) saveNewBudget(parseFloat(prompted));
    }
  });

  cancelBudgetBtn.addEventListener("click", () => budgetDialog.close());

  budgetForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const val = parseFloat(budgetInput.value);
    saveNewBudget(isNaN(val) ? 0 : val);
    budgetDialog.close();
  });
}

function saveNewBudget(val) {
  state.monthlyBudget = Math.max(0, val || 0);
  saveToStorage();
  renderBudget();
  showToast(state.monthlyBudget > 0 ? `Monthly budget set to ${formatCurrency(state.monthlyBudget)}` : "Budget cleared.");
}

function handleAddExpense(e) {
  e.preventDefault();

  const amount = parseFloat(amountInput.value);
  const category = categorySelect.value;
  const date = dateInput.value;
  const note = noteInput.value.trim();

  document.getElementById("amount-error").textContent = "";
  document.getElementById("category-error").textContent = "";
  document.getElementById("date-error").textContent = "";

  let hasError = false;

  if (isNaN(amount) || amount <= 0) {
    document.getElementById("amount-error").textContent = "Please enter a valid amount greater than 0.";
    hasError = true;
  }

  if (!category) {
    document.getElementById("category-error").textContent = "Please select a category.";
    hasError = true;
  }

  if (!date) {
    document.getElementById("date-error").textContent = "Please choose a date.";
    hasError = true;
  }

  if (hasError) return;

  const newTransaction = {
    id: "tx_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
    amount: Number(amount.toFixed(2)),
    category,
    date,
    note: note || category,
    createdAt: Date.now()
  };

  state.transactions.unshift(newTransaction);
  saveToStorage();

  amountInput.value = "";
  categorySelect.value = "";
  noteInput.value = "";
  setDefaultDate();
  amountInput.focus();

  render();
  showToast("Expense added successfully!");
}

function deleteExpense(id) {
  const targetIndex = state.transactions.findIndex(t => t.id === id);
  if (targetIndex === -1) return;

  const deleted = state.transactions.splice(targetIndex, 1)[0];
  saveToStorage();
  render();
  showToast(`Deleted "${deleted.note}"`);
}

function render() {
  currencyDisplay.textContent = state.currency;
  budgetDialogCurrency.textContent = state.currency;
  renderBudget();
  renderMetrics();
  renderBreakdown();
  renderTransactionList();
}

function renderBudget() {
  const now = new Date();
  const monthName = now.toLocaleString(undefined, { month: "long", year: "numeric" });
  budgetMonthLabel.textContent = `Monthly Budget (${monthName})`;

  const currentMonthSpent = getCurrentMonthSpending();
  budgetSpentDisplay.textContent = formatCurrency(currentMonthSpent);

  if (!state.monthlyBudget || state.monthlyBudget <= 0) {
    budgetLimitDisplay.textContent = "Not set";
    budgetBtnText.textContent = "Set Budget";
    budgetBarFill.style.width = "0%";
    budgetBarFill.className = "budget-bar-fill";
    budgetRemainingText.textContent = "No budget target set";
    budgetRemainingText.className = "budget-remaining";
    budgetPercentageText.textContent = "—";
    return;
  }

  budgetBtnText.textContent = "Edit Budget";
  budgetLimitDisplay.textContent = formatCurrency(state.monthlyBudget);

  const percentage = (currentMonthSpent / state.monthlyBudget) * 100;
  const clampedPercentage = Math.min(100, Math.max(0, percentage));
  budgetBarFill.style.width = `${clampedPercentage}%`;

  budgetBarFill.className = "budget-bar-fill";
  budgetRemainingText.className = "budget-remaining";

  if (currentMonthSpent > state.monthlyBudget) {
    const overAmt = currentMonthSpent - state.monthlyBudget;
    budgetBarFill.classList.add("danger");
    budgetRemainingText.classList.add("over");
    budgetRemainingText.textContent = `⚠️ Over budget by ${formatCurrency(overAmt)}`;
    budgetPercentageText.textContent = `${percentage.toFixed(0)}% spent`;
  } else {
    const remaining = state.monthlyBudget - currentMonthSpent;
    budgetRemainingText.textContent = `Remaining: ${formatCurrency(remaining)}`;
    budgetPercentageText.textContent = `${percentage.toFixed(0)}% spent`;

    if (percentage >= 80) {
      budgetBarFill.classList.add("warning");
    }
  }
}

function renderMetrics() {
  const total = state.transactions.reduce((sum, t) => sum + t.amount, 0);
  const count = state.transactions.length;

  totalSpendEl.textContent = formatCurrency(total);
  transactionCountEl.textContent = `${count}${count === 1 ? "expense" : "expenses"} logged`;

  if (count === 0) {
    topCategoryEl.textContent = "—";
    topCategoryAmountEl.textContent = "No expenses yet";
    latestDateEl.textContent = "—";
    latestNoteEl.textContent = "Ready for your first entry";
    return;
  }

  const categoryTotals = {};
  state.transactions.forEach(t => {
    categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
  });

  let maxCategory = "";
  let maxAmount = -1;
  for (const [cat, sum] of Object.entries(categoryTotals)) {
    if (sum > maxAmount) {
      maxAmount = sum;
      maxCategory = cat;
    }
  }

  const topIcon = CATEGORY_ICONS[maxCategory] || "🏷️";
  topCategoryEl.textContent = `${topIcon}${maxCategory}`;
  topCategoryAmountEl.textContent = `${formatCurrency(maxAmount)} total`;

  const sortedByDate = [...state.transactions].sort((a, b) => new Date(b.date) - new Date(a.date) || b.createdAt - a.createdAt);
  const latest = sortedByDate[0];
  latestDateEl.textContent = formatDate(latest.date);
  latestNoteEl.textContent = latest.note;
}

// Select & Deselect Handlers (Option 2)
function selectCategory(cat) {
  const donutWrapper = document.getElementById("donut-wrapper");
  const centerLabel = document.getElementById("donut-center-label");
  const centerVal = document.getElementById("donut-center-val");
  const segmentsGroup = document.getElementById("donut-segments-group");

  state.selectedCategory = cat;
  state.filterCategory = cat;
  filterCategorySelect.value = cat;

  if (donutWrapper) donutWrapper.classList.add("has-selection");

  if (segmentsGroup) {
    const segmentEls = segmentsGroup.querySelectorAll(".donut-segment");
    segmentEls.forEach(seg => {
      if (seg.dataset.category === cat) {
        seg.classList.add("active");
        const amt = parseFloat(seg.dataset.amount);
        const pct = seg.dataset.percentage;
        if (centerLabel) centerLabel.textContent = cat;
        if (centerVal) centerVal.textContent = `${formatCurrency(amt)} (${pct}%)`;
      } else {
        seg.classList.remove("active");
      }
    });
  }

  const listItems = categoryBreakdownList.querySelectorAll(".breakdown-item");
  listItems.forEach(item => {
    if (item.dataset.category === cat) {
      item.style.backgroundColor = "var(--bg-subtle)";
      item.style.fontWeight = "700";
    } else {
      item.style.backgroundColor = "";
      item.style.fontWeight = "";
    }
  });

  renderTransactionList();
  showToast(`Filtered by ${cat} (tap again to reset)`);
}

function deselectCategory() {
  const total = state.transactions.reduce((sum, t) => sum + t.amount, 0);
  const donutWrapper = document.getElementById("donut-wrapper");
  const centerLabel = document.getElementById("donut-center-label");
  const centerVal = document.getElementById("donut-center-val");
  const segmentsGroup = document.getElementById("donut-segments-group");

  state.selectedCategory = null;
  state.filterCategory = "ALL";
  filterCategorySelect.value = "ALL";

  if (donutWrapper) donutWrapper.classList.remove("has-selection");

  if (segmentsGroup) {
    const segmentEls = segmentsGroup.querySelectorAll(".donut-segment");
    segmentEls.forEach(seg => seg.classList.remove("active"));
  }

  if (centerLabel) centerLabel.textContent = "Total";
  if (centerVal) centerVal.textContent = formatCurrency(total);

  const listItems = categoryBreakdownList.querySelectorAll(".breakdown-item");
  listItems.forEach(item => {
    item.style.backgroundColor = "";
    item.style.fontWeight = "";
  });

  renderTransactionList();
  showToast("Showing all expenses");
}

function toggleCategory(cat) {
  if (state.selectedCategory === cat) {
    deselectCategory();
  } else {
    selectCategory(cat);
  }
}

function renderBreakdown() {
  const total = state.transactions.reduce((sum, t) => sum + t.amount, 0);
  const donutWrapper = document.getElementById("donut-wrapper");
  const segmentsGroup = document.getElementById("donut-segments-group");
  const centerInfo = document.getElementById("donut-center-info");
  const centerLabel = document.getElementById("donut-center-label");
  const centerVal = document.getElementById("donut-center-val");

  if (state.transactions.length === 0 || total === 0) {
    categoryBreakdownList.innerHTML = `<p class="empty-state">No categorized expenses recorded yet.</p>`;
    if (segmentsGroup) segmentsGroup.innerHTML = "";
    if (donutWrapper) donutWrapper.classList.remove("has-selection");
    if (centerLabel) centerLabel.textContent = "Total";
    if (centerVal) centerVal.textContent = formatCurrency(0);
    return;
  }

  const categoryTotals = {};
  state.transactions.forEach(t => {
    categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
  });

  const sortedCategories = Object.entries(categoryTotals).sort((a, b) => b - a);

  if (segmentsGroup) {
    const radius = 58;
    const circumference = 2 * Math.PI * radius;
    let accumulatedPercent = 0;
    let svgSegments = "";

    sortedCategories.forEach(([cat, amount]) => {
      const percent = amount / total;
      const strokeLength = percent * circumference;
      const strokeDashoffset = -accumulatedPercent * circumference;
      const color = CATEGORY_COLORS[cat] || "#64748b";
      const isSelected = state.selectedCategory === cat;

      svgSegments += `
        <circle 
          class="donut-segment ${isSelected ? "active" : ""}" 
          cx="80" 
          cy="80" 
          r="${radius}" 
          stroke="${color}" 
          stroke-dasharray="${strokeLength.toFixed(2)}${circumference.toFixed(2)}" 
          stroke-dashoffset="${strokeDashoffset.toFixed(2)}"
          data-category="${cat}"
          data-amount="${amount}"
          data-percentage="${(percent * 100).toFixed(1)}"
        />
      `;
      accumulatedPercent += percent;
    });

    segmentsGroup.innerHTML = svgSegments;

    if (state.selectedCategory && categoryTotals[state.selectedCategory]) {
      const selAmount = categoryTotals[state.selectedCategory];
      const selPct = ((selAmount / total) * 100).toFixed(1);
      if (donutWrapper) donutWrapper.classList.add("has-selection");
      if (centerLabel) centerLabel.textContent = state.selectedCategory;
      if (centerVal) centerVal.textContent = `${formatCurrency(selAmount)} (${selPct}%)`;
    } else {
      if (donutWrapper) donutWrapper.classList.remove("has-selection");
      if (centerLabel) centerLabel.textContent = "Total";
      if (centerVal) centerVal.textContent = formatCurrency(total);
    }

    const segmentEls = segmentsGroup.querySelectorAll(".donut-segment");
    segmentEls.forEach(seg => {
      const cat = seg.dataset.category;
      const amt = parseFloat(seg.dataset.amount);
      const pct = seg.dataset.percentage;

      seg.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleCategory(cat);
      });

      seg.addEventListener("mouseenter", () => {
        if (!state.selectedCategory) {
          seg.classList.add("active");
          if (centerLabel) centerLabel.textContent = cat;
          if (centerVal) centerVal.textContent = `${formatCurrency(amt)} (${pct}%)`;
        }
      });

      seg.addEventListener("mouseleave", () => {
        if (!state.selectedCategory) {
          seg.classList.remove("active");
          if (centerLabel) centerLabel.textContent = "Total";
          if (centerVal) centerVal.textContent = formatCurrency(total);
        }
      });
    });

    if (centerInfo) {
      centerInfo.onclick = (e) => {
        e.stopPropagation();
        if (state.selectedCategory) deselectCategory();
      };
      centerInfo.onkeydown = (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (state.selectedCategory) deselectCategory();
        }
      };
    }
  }

  let listHtml = "";
  sortedCategories.forEach(([cat, amount]) => {
    const percentage = ((amount / total) * 100).toFixed(1);
    const icon = CATEGORY_ICONS[cat] || "🏷️";
    const color = CATEGORY_COLORS[cat] || "#4f46e5";
    const isSelected = state.selectedCategory === cat;

    listHtml += `
      <div 
        class="breakdown-item" 
        data-category="${cat}" 
        title="Click to toggle filter for ${cat}"
        style="${isSelected ? "background-color: var(--bg-subtle); font-weight: 700;" : ""}"
      >
        <div class="breakdown-header">
          <span class="breakdown-header-title">
            <span class="category-dot" style="background-color: ${color};"></span>
            ${icon}${cat}
          </span>
          <span>${formatCurrency(amount)} <span style="color:var(--text-muted); font-size:0.8rem">(${percentage}%)</span></span>
        </div>
        <div class="breakdown-bar-bg">
          <div class="breakdown-bar-fill" style="width: ${percentage}\%; background-color:${color};"></div>
        </div>
      </div>
    `;
  });

  categoryBreakdownList.innerHTML = listHtml;

  const listItems = categoryBreakdownList.querySelectorAll(".breakdown-item");
  listItems.forEach(item => {
    item.addEventListener("click", () => {
      const cat = item.dataset.category;
      toggleCategory(cat);
    });
  });
}

function renderTransactionList() {
  let list = [...state.transactions];
  list.sort((a, b) => new Date(b.date) - new Date(a.date) || b.createdAt - a.createdAt);

  if (state.filterCategory !== "ALL") {
    list = list.filter(t => t.category === state.filterCategory);
  }

  if (list.length === 0) {
    transactionList.innerHTML = `
      <div class="empty-state">
        <p>${state.transactions.length === 0 ? "No expenses recorded yet. Fill out the form to add your first expense!" : "No expenses match the selected category."}</p>
      </div>
    `;
    return;
  }

  let html = "";
  list.forEach(tx => {
    const icon = CATEGORY_ICONS[tx.category] || "🏷️";
    html += `
      <div class="transaction-item" data-id="${tx.id}">
        <div class="tx-left">
          <div class="tx-icon-badge" aria-hidden="true">${icon}</div>
          <div class="tx-info">
            <span class="tx-category">${tx.category}</span>
            <div class="tx-meta">
              <span>${formatDate(tx.date)}</span>${tx.note && tx.note !== tx.category ? `<span>•</span><span class="tx-note" title="${escapeHtml(tx.note)}">${escapeHtml(tx.note)}</span>` : ""}
            </div>
          </div>
        </div>
        <div class="tx-right">
          <span class="tx-amount">-${formatCurrency(tx.amount)}</span>
          <button type="button" class="btn-delete" title="Delete expense" onclick="deleteExpense('${tx.id}')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 6h18"></path>
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
              <path d="M8 6V4c0-1 1
