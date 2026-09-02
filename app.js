// Category Icons Map
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
  filterCategory: "ALL"
};

const STORAGE_KEY_TRANSACTIONS = "expense_tracker_transactions_v1";
const STORAGE_KEY_CURRENCY = "expense_tracker_currency_v1";

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

// Initialize Application
function init() {
  loadFromStorage();
  setDefaultDate();
  bindEvents();
  render();
  registerServiceWorker();
}

// Set Date input default to today
function setDefaultDate() {
  const today = new Date().toISOString().split("T")[0];
  dateInput.value = today;
  dateInput.max = today;
}

// Local Storage Handlers
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
  } catch (err) {
    console.error("Failed to read from localStorage", err);
    state.transactions = [];
  }
}

function saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(state.transactions));
    localStorage.setItem(STORAGE_KEY_CURRENCY, state.currency);
  } catch (err) {
    console.error("Failed to save to localStorage", err);
  }
}

// Helper: Format Currency
function formatCurrency(amount) {
  const num = Number(amount) || 0;
  return `${state.currency} ${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Helper: Format Date
function formatDate(dateString) {
  if (!dateString) return "—";
  const [year, month, day] = dateString.split("-");
  if (!year || !month || !day) return dateString;
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// Toast notification helper
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

// Event Listeners
function bindEvents() {
  form.addEventListener("submit", handleAddExpense);

  currencySelect.addEventListener("change", (e) => {
    state.currency = e.target.value;
    currencyDisplay.textContent = state.currency;
    saveToStorage();
    render();
    showToast(`Currency updated to ${state.currency}`);
  });

  filterCategorySelect.addEventListener("change", (e) => {
    state.filterCategory = e.target.value;
    renderTransactionList();
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

  loadSampleBtn.addEventListener("click", () => {
    loadSampleData();
  });
}

// Form Submission & Validation
function handleAddExpense(e) {
  e.preventDefault();

  const amount = parseFloat(amountInput.value);
  const category = categorySelect.value;
  const date = dateInput.value;
  const note = noteInput.value.trim();

  // Reset errors
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

  // Prepend to array
  state.transactions.unshift(newTransaction);
  saveToStorage();

  // Reset form inputs (keep date as today)
  amountInput.value = "";
  categorySelect.value = "";
  noteInput.value = "";
  setDefaultDate();
  amountInput.focus();

  render();
  showToast("Expense added successfully!");
}

// Delete Single Expense
function deleteExpense(id) {
  const targetIndex = state.transactions.findIndex(t => t.id === id);
  if (targetIndex === -1) return;

  const deleted = state.transactions.splice(targetIndex, 1)[0];
  saveToStorage();
  render();
  showToast(`Deleted "${deleted.note}"`);
}

// Render Functions
function render() {
  currencyDisplay.textContent = state.currency;
  renderMetrics();
  renderBreakdown();
  renderTransactionList();
}

function renderMetrics() {
  const total = state.transactions.reduce((sum, t) => sum + t.amount, 0);
  const count = state.transactions.length;

  totalSpendEl.textContent = formatCurrency(total);
  transactionCountEl.textContent = `${count} ${count === 1 ? "expense" : "expenses"} logged`;

  if (count === 0) {
    topCategoryEl.textContent = "—";
    topCategoryAmountEl.textContent = "No expenses yet";
    latestDateEl.textContent = "—";
    latestNoteEl.textContent = "Ready for your first entry";
    return;
  }

  // Calculate top category
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
  topCategoryEl.textContent = `${topIcon} ${maxCategory}`;
  topCategoryAmountEl.textContent = `${formatCurrency(maxAmount)} total`;

  // Latest activity
  const sortedByDate = [...state.transactions].sort((a, b) => new Date(b.date) - new Date(a.date) || b.createdAt - a.createdAt);
  const latest = sortedByDate[0];
  latestDateEl.textContent = formatDate(latest.date);
  latestNoteEl.textContent = latest.note;
}

function renderBreakdown() {
  const total = state.transactions.reduce((sum, t) => sum + t.amount, 0);

  if (state.transactions.length === 0 || total === 0) {
    categoryBreakdownList.innerHTML = `<p class="empty-state">No categorized expenses recorded yet.</p>`;
    return;
  }

  const categoryTotals = {};
  state.transactions.forEach(t => {
    categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
  });

  const sortedCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);

  let html = "";
  sortedCategories.forEach(([cat, amount]) => {
    const percentage = ((amount / total) * 100).toFixed(1);
    const icon = CATEGORY_ICONS[cat] || "🏷️";
    html += `
      <div class="breakdown-item">
        <div class="breakdown-header">
          <span>${icon} ${cat}</span>
          <span>${formatCurrency(amount)} <span style="color:var(--text-muted); font-size:0.8rem">(${percentage}%)</span></span>
        </div>
        <div class="breakdown-bar-bg">
          <div class="breakdown-bar-fill" style="width: ${percentage}%"></div>
        </div>
      </div>
    `;
  });

  categoryBreakdownList.innerHTML = html;
}

function renderTransactionList() {
  let list = [...state.transactions];

  // Sort reverse chronological
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
              <span>${formatDate(tx.date)}</span>
              ${tx.note && tx.note !== tx.category ? `<span>•</span><span class="tx-note" title="${escapeHtml(tx.note)}">${escapeHtml(tx.note)}</span>` : ""}
            </div>
          </div>
        </div>
        <div class="tx-right">
          <span class="tx-amount">-${formatCurrency(tx.amount)}</span>
          <button type="button" class="btn-delete" title="Delete expense" onclick="deleteExpense('${tx.id}')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 6h18"></path>
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>
    `;
  });

  transactionList.innerHTML = html;
}

// Sample Data Loader
function loadSampleData() {
  const today = new Date();
  const getPastDateStr = (daysAgo) => {
    const d = new Date();
    d.setDate(today.getDate() - daysAgo);
    return d.toISOString().split("T")[0];
  };

  const samples = [
    {
      id: "tx_sample_1",
      amount: 14.50,
      category: "Food & Dining",
      date: getPastDateStr(0),
      note: "Chicken Rice & Iced Tea lunch",
      createdAt: Date.now() - 3600000
    },
    {
      id: "tx_sample_2",
      amount: 28.00,
      category: "Transportation",
      date: getPastDateStr(1),
      note: "Petrol refill",
      createdAt: Date.now() - 86400000
    },
    {
      id: "tx_sample_3",
      amount: 65.00,
      category: "Shopping",
      date: getPastDateStr(2),
      note: "Running socks and shorts",
      createdAt: Date.now() - 172800000
    },
    {
      id: "tx_sample_4",
      amount: 45.00,
      category: "Bills & Utilities",
      date: getPastDateStr(3),
      note: "Monthly mobile data plan",
      createdAt: Date.now() - 259200000
    }
  ];

  state.transactions = [...samples, ...state.transactions];
  saveToStorage();
  render();
  showToast("Sample expenses loaded!");
}

// Utility: HTML escaping
function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

// Register Offline Service Worker (PWA)
function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").then(reg => {
        console.log("ServiceWorker registered successfully:", reg.scope);
      }).catch(err => {
        console.log("ServiceWorker registration skipped or failed:", err);
      });
    });
  }
}

// Launch app on load
window.addEventListener("DOMContentLoaded", init);
