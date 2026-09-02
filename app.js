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

const STORAGE_KEYS = {
  tx: "expense_tracker_transactions_v1",
  currency: "expense_tracker_currency_v1",
  budget: "expense_tracker_budget_v1"
};

// DOM Cache
const $ = (id) => document.getElementById(id);
const dom = {
  form: $("expense-form"),
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
  totalSpend: $("total-spend"),
  txCount: $("transaction-count"),
  topCategory: $("top-category"),
  topCategoryAmt: $("top-category-amount"),
  latestDate: $("latest-date"),
  latestNote: $("latest-note"),
  donutWrapper: $("donut-wrapper"),
  donutSegments: $("donut-segments-group"),
  donutCenter: $("donut-center-info"),
  donutLabel: $("donut-center-label"),
  donutVal: $("donut-center-val"),
  donutHint: $("donut-center-hint"),
  breakdownList: $("category-breakdown-list"),
  txList: $("transaction-list"),
  filterCategory: $("filter-category"),
  clearAllBtn: $("clear-all-btn"),
  loadSampleBtn: $("load-sample-btn"),
  exportCsvBtn: $("export-csv-btn"),
  exportJsonBtn: $("export-json-btn"),
  importBtn: $("import-btn"),
  importFileInput: $("import-file-input"),
  toast: $("toast")
};

// Initialize
function init() {
  loadStorage();
  setDefaultDate();
  bindEvents();
  render();
  registerSW();
}

function setDefaultDate() {
  const today = new Date().toISOString().split("T")[0];
  dom.date.value = today;
  dom.date.max = today;
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
  dom.form.addEventListener("submit", handleAddExpense);

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
    if (!state.transactions.length) return showToast("No expenses to clear.");
    if (confirm("Delete all logged expenses? This cannot be undone.")) {
      state.transactions = [];
      deselectCategory();
      saveStorage();
      render();
      showToast("All expenses cleared.");
    }
  });

  dom.loadSampleBtn.addEventListener("click", loadSampleData);

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

  // Option 3: Export & Import Listeners
  dom.exportCsvBtn.addEventListener("click", exportToCSV);
  dom.exportJsonBtn.addEventListener("click", exportToJSON);
  dom.importBtn.addEventListener("click", () => dom.importFileInput.click());
  dom.importFileInput.addEventListener("change", handleFileImport);
}

function promptBudget() {
  const p = prompt("Enter monthly budget target:", state.monthlyBudget || "");
  if (p !== null) {
    state.monthlyBudget = Math.max(0, parseFloat(p) || 0);
    saveStorage();
    renderBudget();
  }
}

// Add Expense
function handleAddExpense(e) {
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
  showToast("Expense added!");
}

// Delete Expense
function deleteExpense(id) {
  const idx = state.transactions.findIndex(t => t.id === id);
  if (idx === -1) return;
  const deleted = state.transactions.splice(idx, 1)[0];
  saveStorage();
  render();
  showToast(`Deleted "${deleted.note}"`);
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

// Render Budget
function renderBudget() {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  dom.budgetMonthLabel.textContent = `Monthly Budget (${now.toLocaleString(undefined, { month: "long", year: "numeric" })})`;

  const monthSpend = state.transactions
    .filter(t => t.date && t.date.startsWith(ym))
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

// Render Metrics
function renderMetrics() {
  const total = state.transactions.reduce((s, t) => s + t.amount, 0);
  const count = state.transactions.length;

  dom.totalSpend.textContent = formatCurrency(total);
  dom.txCount.textContent = `${count} ${count === 1 ? "expense" : "expenses"} logged`;

  if (!count) {
    dom.topCategory.textContent = "—";
    dom.topCategoryAmt.textContent = "No expenses yet";
    dom.latestDate.textContent = "—";
    dom.latestNote.textContent = "Ready for your first entry";
    return;
  }

  const totals = {};
  state.transactions.forEach(t => totals[t.category] = (totals[t.category] || 0) + t.amount);
  const top = Object.entries(totals).sort((a, b) => b[1] - a[1])[0];
  dom.topCategory.textContent = `${CATEGORY_ICONS[top[0]] || "🏷️"} ${top[0]}`;
  dom.topCategoryAmt.textContent = `${formatCurrency(top[1])} total`;

  const latest = [...state.transactions].sort((a, b) => new Date(b.date) - new Date(a.date) || b.createdAt - a.createdAt)[0];
  dom.latestDate.textContent = formatDate(latest.date);
  dom.latestNote.textContent = latest.note;
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

// Render Donut & Breakdown
function renderBreakdown() {
  const total = state.transactions.reduce((s, t) => s + t.amount, 0);

  if (!total || !state.transactions.length) {
    dom.breakdownList.innerHTML = `<p class="empty-state">No categorized expenses recorded yet.</p>`;
    if (dom.donutSegments) dom.donutSegments.innerHTML = "";
    dom.donutWrapper?.classList.remove("has-selection");
    dom.donutLabel.textContent = "Total";
    dom.donutVal.textContent = formatCurrency(0);
    if (dom.donutHint) dom.donutHint.style.display = "none";
    return;
  }

  const totals = {};
  state.transactions.forEach(t => totals[t.category] = (totals[t.category] || 0) + t.amount);
  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);

  // SVG Donut
  if (dom.donutSegments) {
    const r = 58;
    const c = 2 * Math.PI * r; // ~364.42
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

    // Center Readout
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

    // Segment events
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

  // Breakdown Bars
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

// Transaction List Render
function renderTransactionList() {
  let list = [...state.transactions].sort((a, b) => new Date(b.date) - new Date(a.date) || b.createdAt - a.createdAt);
  if (state.filterCategory !== "ALL") {
    list = list.filter(t => t.category === state.filterCategory);
  }

  if (!list.length) {
    dom.txList.innerHTML = `<div class="empty-state"><p>${state.transactions.length ? "No expenses match the selected category." : "No expenses recorded yet. Fill out the form to add your first expense!"}</p></div>`;
    return;
  }

  dom.txList.innerHTML = list.map(tx => `
    <div class="transaction-item" data-id="${tx.id}">
      <div class="tx-left">
        <div class="tx-icon-badge" aria-hidden="true">${CATEGORY_ICONS[tx.category] || "🏷️"}</div>
        <div class="tx-info">
          <span class="tx-category">${escapeHtml(tx.category)}</span>
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
            <path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    </div>
  `).join("");
}

// Sample Data Loader

// Option 3: Export to CSV
function exportToCSV() {
  if (!state.transactions.length) return showToast("No expenses to export.");

  const headers = ["Date", "Category", "Note", "Amount", "Currency"];
  const rows = state.transactions.map(t => [
    t.date,
    `"${(t.category || "").replace(/"/g, '""')}"`,
    `"${(t.note || "").replace(/"/g, '""')}"`,
    t.amount.toFixed(2),
    state.currency
  ]);

  const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\r\n");
  const today = new Date().toISOString().split("T")[0];
  downloadBlob(new Blob([csvContent], { type: "text/csv;charset=utf-8;" }), `expenses_${today}.csv`);
  showToast(`Exported ${state.transactions.length} expenses to CSV!`);
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

// Helper: Trigger browser download via anchor
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

// Option 3: Import JSON or CSV file
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
      dom.importFileInput.value = ""; // Reset file input
    }
  };

  reader.readAsText(file);
}

function importJSONData(jsonStr) {
  const parsed = JSON.parse(jsonStr);
  const incomingTx = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.transactions) ? parsed.transactions : null);

  if (!incomingTx) {
    return showToast("Invalid backup format: No transactions found.");
  }

  const validTx = incomingTx.filter(t => t && t.amount > 0 && t.category && t.date);
  if (!validTx.length) {
    return showToast("No valid expense records found in backup.");
  }

  const shouldMerge = state.transactions.length > 0 && confirm("Do you want to MERGE with existing expenses?\n\nClick OK to Merge.\nClick Cancel to REPLACE all existing expenses.");

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
  showToast(`Successfully imported ${validTx.length} expenses!`);
}

function importCSVData(csvStr) {
  const lines = csvStr.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length <= 1) return showToast("CSV file is empty or missing data.");

  const imported = [];
  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length >= 4) {
      const [date, category, note, amountStr] = cols;
      const amt = parseFloat(amountStr);
      if (date && category && !isNaN(amt) && amt > 0) {
        imported.push({
          id: "tx_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6) + "_" + i,
          amount: Number(amt.toFixed(2)),
          category: category.trim(),
          date: date.trim(),
          note: (note || category).trim(),
          createdAt: Date.now()
        });
      }
    }
  }

  if (!imported.length) return showToast("Could not find valid rows in CSV.");

  state.transactions = [...imported, ...state.transactions];
  saveStorage();
  render();
  showToast(`Imported ${imported.length} expenses from CSV!`);
}

// Simple RFC 4180 CSV line parser
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

function loadSampleData() {
  const d = (ago) => {
    const dt = new Date();
    dt.setDate(dt.getDate() - ago);
    return dt.toISOString().split("T")[0];
  };

  const samples = [
    { id: "tx_s1", amount: 14.50, category: "Food & Dining", date: d(0), note: "Chicken Rice & Iced Tea lunch", createdAt: Date.now() - 3600000 },
    { id: "tx_s2", amount: 28.00, category: "Transportation", date: d(1), note: "Petrol refill", createdAt: Date.now() - 86400000 },
    { id: "tx_s3", amount: 65.00, category: "Shopping", date: d(2), note: "Running socks and shorts", createdAt: Date.now() - 172800000 },
    { id: "tx_s4", amount: 45.00, category: "Bills & Utilities", date: d(3), note: "Monthly mobile data plan", createdAt: Date.now() - 259200000 }
  ];

  state.transactions = [...samples, ...state.transactions];
  if (!state.monthlyBudget) state.monthlyBudget = 1000;
  saveStorage();
  render();
  showToast("Sample expenses & RM 1,000 budget loaded!");
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
