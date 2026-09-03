// Category Presets
const DEFAULT_EXPENSE_CATEGORIES = [
  { name: "Food & Dining", icon: "🍔", color: "#f97316" },
  { name: "Transportation", icon: "🚗", color: "#3b82f6" },
  { name: "Shopping", icon: "🛍️", color: "#ec4899" },
  { name: "Entertainment", icon: "🎬", color: "#8b5cf6" },
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
  autoSweepSurplus: false,
  attachedReceipt: null,
  editAttachedReceipt: null
};

const STORAGE_KEYS = {
  tx: "expense_tracker_transactions_v1",
  currency: "expense_tracker_currency_v1",
  subs: "expense_tracker_subscriptions_v1",
  customCats: "expense_tracker_custom_categories_v1",
  theme: "expense_tracker_theme_v1",
  autoSweep: "expense_tracker_auto_sweep_v1"
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
  editDate: $("edit-date"),
  editNote: $("edit-note"),
  editCurrency: $("edit-dialog-currency"),
  cancelEditBtn: $("cancel-edit-btn"),
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
  // Wallet DOM
  selectedWalletInput: $("selected-wallet"),
  editWallet: $("edit-wallet"),
  walletStatsGrid: $("wallet-stats-grid"),
  // Analysis Elements
  analysisTotalSpend: $("analysis-total-spend"),
  analysisTotalIncome: $("analysis-total-income"),
  analysisComparisonStat: $("analysis-comparison-stat"),
  analysisBarChart: $("analysis-bar-chart"),
  analysisInsightText: $("analysis-insight-text"),
  // Settings Elements
  settingsExportCsv: $("settings-export-csv"),
  settingsExportJson: $("settings-export-json"),
  settingsImportBtn: $("settings-import-btn"),
  settingsFileInput: $("settings-file-input"),
  toggleSurplusSweep: $("toggle-surplus-sweep"),
  // Sub 3-Wallet DOM
  subSelectedWallet: $("sub-selected-wallet"),
  // Receipt Attachment DOM
  attachReceiptBtn: $("attach-receipt-btn"),
  receiptFileInput: $("receipt-file-input"),
  receiptPreviewBox: $("receipt-preview-box"),
  receiptPreviewImg: $("receipt-preview-img"),
  removeReceiptBtn: $("remove-receipt-btn"),
  editAttachReceiptBtn: $("edit-attach-receipt-btn"),
  editReceiptFileInput: $("edit-receipt-file-input"),
  editReceiptPreviewBox: $("edit-receipt-preview-box"),
  editReceiptPreviewImg: $("edit-receipt-preview-img"),
  editRemoveReceiptBtn: $("edit-remove-receipt-btn"),
  receiptModal: $("receipt-modal"),
  receiptModalImg: $("receipt-modal-img"),
  receiptModalTitle: $("receipt-modal-title"),
  receiptModalDetails: $("receipt-modal-details"),
  downloadReceiptLink: $("download-receipt-link"),
  closeReceiptModalBtn: $("close-receipt-modal-btn"),
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
  loadStorage();
  initTheme();
  setDefaultDate();
  scheduleMidnightRollover();
  initDateLifecycleListeners();
  processAutoDeductions();
  checkMonthEndSweepNotification();
  populateCategorySelects();
  populateFilterCategories();
  dom.currencySelect.value = state.currency;
  dom.filterPeriod.value = state.periodFilter;
  bindEvents();
  render();
  registerSW();
  initSwipeGestures();
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
    renderHeroSpendableGaugeAndMetrics();
    renderSubscriptions();
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
      renderHeroSpendableGaugeAndMetrics();
      renderSubscriptions();
    }
  });
  window.addEventListener("focus", () => {
    setDefaultDate();
    renderHeroSpendableGaugeAndMetrics();
  });
}

// Local Storage
function loadStorage() {
  try {
    const tx = localStorage.getItem(STORAGE_KEYS.tx);
    if (tx) state.transactions = JSON.parse(tx);
    const curr = localStorage.getItem(STORAGE_KEYS.currency);
    if (curr) state.currency = curr;
    const subs = localStorage.getItem(STORAGE_KEYS.subs);
    if (subs) state.subscriptions = JSON.parse(subs);
    const cats = localStorage.getItem(STORAGE_KEYS.customCats);
    if (cats) state.customCategories = JSON.parse(cats);
    const th = localStorage.getItem(STORAGE_KEYS.theme);
    if (th) state.theme = th;
    const swp = localStorage.getItem(STORAGE_KEYS.autoSweep);
    if (swp !== null) state.autoSweepSurplus = (swp === "true");
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
  } catch (e) {}
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
}

function applyTheme(theme) {
  state.theme = theme;
  saveStorage();
  if (theme === "auto") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.setAttribute("data-theme", prefersDark ? "dark" : "light");
  } else {
    document.documentElement.setAttribute("data-theme", theme);
  }
}

// Navigation Tabs Router (Direction-Aware Slide & Haptic)
const TAB_ORDER = ["dashboard", "analysis", "settings"];

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

  if (tabName === "analysis") renderAnalysis();
  if (tabName === "settings") renderSettings();
}

// Touch Swipe Gesture Handler (Dashboard <-> Analysis <-> Settings)
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

    // Ignore touches starting inside inputs, charts with horizontal scroll, or open dialogs
    const target = e.target;
    isIgnoredTarget = !!target.closest("input, select, textarea, .chart-scroll-container, dialog[open], .emoji-btn, .color-swatch-btn");
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

  // Analysis Granularity Switcher (Option 7B)
  document.querySelectorAll(".gran-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".gran-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.analysisGranularity = btn.dataset.gran;
      renderAnalysis();
    });
  });

  // Wallet Pill Selection (Queue Item 1)
  document.querySelectorAll(".wallet-pill-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".wallet-pill-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      if (dom.selectedWalletInput) dom.selectedWalletInput.value = btn.dataset.wallet;
    });
  });

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
  dom.settingsImportBtn.addEventListener("click", () => dom.settingsFileInput.click());
  dom.settingsFileInput.addEventListener("change", handleFileImport);

  // Subscriptions 3-Wallet Pill Selection (Cash excluded)
  document.querySelectorAll("#sub-wallet-pill-group .wallet-pill-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#sub-wallet-pill-group .wallet-pill-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      if (dom.subSelectedWallet) dom.subSelectedWallet.value = btn.dataset.wallet;
    });
  });

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
      const rect = dom.receiptModal.getBoundingClientRect();
      const isInDialog = (
        rect.top <= e.clientY && e.clientY <= rect.top + rect.height &&
        rect.left <= e.clientX && e.clientX <= rect.left + rect.width
      );
      if (!isInDialog) {
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

  const chosenWallet = dom.selectedWalletInput ? dom.selectedWalletInput.value : "Bank Account";
  state.transactions.unshift({
    id: "tx_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
    type: state.currentFormType,
    amount: Number(amt.toFixed(2)),
    category: cat,
    wallet: chosenWallet,
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
  dom.amount.focus();

  render();
  showToast(`${state.currentFormType === "income" ? "Income" : "Expense"} added!`);
}

// Edit Transaction Functions
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
  if (dom.editWallet) dom.editWallet.value = tx.wallet || "Bank Account";
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

  tx.type = type;
  tx.amount = Number(amt.toFixed(2));
  tx.category = cat;
  tx.wallet = dom.editWallet ? dom.editWallet.value : (tx.wallet || "Bank Account");
  tx.receiptImage = state.editAttachedReceipt || null;
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

      const newTx = {
        id: "tx_auto_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
        type: "expense",
        amount: sub.amount,
        category: sub.category,
        wallet: sub.wallet || "Bank Account",
        date: autoDate,
        note: `${sub.name} (Auto-debited)`,
        createdAt: Date.now()
      };

      state.transactions.unshift(newTx);
      sub.lastLoggedMonth = currentYm;
      autoLoggedCount++;
      names.push(sub.name);
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
  const subWallet = dom.subSelectedWallet ? dom.subSelectedWallet.value : "Bank Account";
  state.subscriptions.push({
    id: "sub_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
    name,
    amount: Number(amount.toFixed(2)),
    category,
    billingDay,
    wallet: subWallet,
    autoDeduct: isAuto,
    lastLoggedMonth: null,
    createdAt: Date.now()
  });

  saveStorage();
  renderSubscriptions();
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
  renderSubscriptions();
  showToast("Bill added!");
}

function deleteSubscription(id) {
  const idx = state.subscriptions.findIndex(s => s.id === id);
  if (idx === -1) return;
  const deleted = state.subscriptions.splice(idx, 1)[0];
  saveStorage();
  renderSubscriptions();
  showToast(`Removed "${deleted.name}"`);
}

function logSubscriptionNow(id) {
  const sub = state.subscriptions.find(s => s.id === id);
  if (!sub) return;

  const now = new Date();
  const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const today = getLocalDateString();

  state.transactions.unshift({
    id: "tx_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
    type: "expense",
    amount: sub.amount,
    category: sub.category,
    wallet: sub.wallet || "Bank Account",
    date: today,
    note: `${sub.name} (Monthly Bill)`,
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
              <span class="tx-badge-wallet">${getWalletIcon(sub.wallet)} ${escapeHtml(sub.wallet || "Bank Account")}</span>
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
  renderBreakdown();
  renderTransactionList();
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
              <span class="tx-badge-wallet">${getWalletIcon(tx.wallet)} ${escapeHtml(tx.wallet || "Bank Account")}</span>
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

// Option 7B: Analysis Page Engine (Bar Chart & Trend Comparisons)
function renderAnalysis() {
  const gran = state.analysisGranularity; // "month", "day", "year"
  const now = new Date();

  let buckets = [];
  // 1. Prepare Intervals
  if (gran === "month") {
    // Last 6 months
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleString(undefined, { month: "short" });
      buckets.push({ key: ym, label, expenses: 0, income: 0, savings: 0 });
    }
  } else if (gran === "day") {
    // Days in current month (up to 31)
    const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const dayStr = String(d).padStart(2, "0");
      const fullDate = `${currentYm}-${dayStr}`;
      buckets.push({ key: fullDate, label: `${d}`, expenses: 0, income: 0, savings: 0 });
    }
  } else if (gran === "year") {
    // Last 3 years
    for (let i = 2; i >= 0; i--) {
      const yr = String(now.getFullYear() - i);
      buckets.push({ key: yr, label: yr, expenses: 0, income: 0, savings: 0 });
    }
  }

  // 2. Aggregate Data
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

  // 3. Render Totals in Header
  const totalExp = buckets.reduce((s, b) => s + b.expenses, 0);
  const totalInc = buckets.reduce((s, b) => s + b.income, 0);
  dom.analysisTotalSpend.textContent = formatCurrency(totalExp);
  dom.analysisTotalIncome.textContent = formatCurrency(totalInc);

  // Comparison stat vs previous period
  if (buckets.length >= 2) {
    const currentBucket = buckets[buckets.length - 1];
    const prevBucket = buckets[buckets.length - 2];
    if (prevBucket.expenses > 0) {
      const diffPct = (((currentBucket.expenses - prevBucket.expenses) / prevBucket.expenses) * 100).toFixed(0);
      if (diffPct < 0) {
        dom.analysisComparisonStat.innerHTML = `<span class="text-success">📉 ${Math.abs(diffPct)}% lower</span>`;
        dom.analysisInsightText.textContent = `Great progress! You spent ${Math.abs(diffPct)}% less in ${currentBucket.label} compared to ${prevBucket.label}.`;
      } else {
        dom.analysisComparisonStat.innerHTML = `<span class="text-danger">📈 +${diffPct}% higher</span>`;
        dom.analysisInsightText.textContent = `Spending in ${currentBucket.label} is ${diffPct}% higher than in ${prevBucket.label}. Keep an eye on non-essential categories.`;
      }
    } else {
      dom.analysisComparisonStat.textContent = "—";
      dom.analysisInsightText.textContent = "Log more expenses across consecutive periods to generate detailed comparative insights.";
    }
  }

  // 4. Render SVG Bar Chart
  const svg = dom.analysisBarChart;
  const maxVal = Math.max(1, ...buckets.map(b => Math.max(b.expenses, b.income, b.savings)));
  const chartHeight = 150;
  const chartWidth = 540;
  const paddingLeft = 40;
  const paddingBottom = 30;
  const usableWidth = chartWidth - paddingLeft - 20;
  const usableHeight = chartHeight;

  const colWidth = usableWidth / buckets.length;
  const barWidth = Math.max(4, Math.min(18, colWidth / 3.5));

  let svgContent = `
    <line x1="${paddingLeft}" y1="${chartHeight}" x2="${chartWidth - 10}" y2="${chartHeight}" stroke="var(--border-color)" stroke-width="1.5" />
    <line x1="${paddingLeft}" y1="${chartHeight / 2}" x2="${chartWidth - 10}" y2="${chartHeight / 2}" stroke="var(--border-color)" stroke-width="1" stroke-dasharray="4" opacity="0.6" />
    <text x="${paddingLeft - 8}" y="${chartHeight}" font-size="10" fill="var(--text-muted)" text-anchor="end">0</text>
    <text x="${paddingLeft - 8}" y="${chartHeight / 2 + 4}" font-size="10" fill="var(--text-muted)" text-anchor="end">${(maxVal / 2).toFixed(0)}</text>
    <text x="${paddingLeft - 8}" y="12" font-size="10" fill="var(--text-muted)" text-anchor="end">${maxVal.toFixed(0)}</text>
  `;

  buckets.forEach((b, i) => {
    const xBase = paddingLeft + (i * colWidth) + (colWidth / 2);
    const expH = (b.expenses / maxVal) * usableHeight;
    const incH = (b.income / maxVal) * usableHeight;
    const savH = (b.savings / maxVal) * usableHeight;

    // Bars
    svgContent += `
      <g class="chart-col-group">
        <!-- Expenses Bar (Red) -->
        <rect x="${xBase - barWidth * 1.6}" y="${chartHeight - expH}" width="${barWidth}" height="${expH}" fill="#ef4444" rx="2" />
        <!-- Income Bar (Green) -->
        <rect x="${xBase - barWidth * 0.5}" y="${chartHeight - incH}" width="${barWidth}" height="${incH}" fill="#10b981" rx="2" />
        <!-- Savings Bar (Emerald) -->
        <rect x="${xBase + barWidth * 0.6}" y="${chartHeight - savH}" width="${barWidth}" height="${savH}" fill="#059669" rx="2" />
        <!-- Label -->
        <text x="${xBase}" y="${chartHeight + 18}" font-size="${gran === 'day' ? 9 : 11}" font-weight="600" fill="var(--text-muted)" text-anchor="middle">${b.label}</text>
      </g>
    `;
  });

  svg.innerHTML = svgContent;

  // Render Spending by Wallet Breakdown (Queue Item 1)
  renderWalletBreakdown(buckets);
}

function renderWalletBreakdown(buckets) {
  if (!dom.walletStatsGrid) return;

  const activeKeys = new Set(buckets.map(b => b.key));
  const periodExpenses = state.transactions.filter(t => {
    if ((t.type || "expense") !== "expense") return false;
    if (!t.date) return false;
    return buckets.some(b => t.date.startsWith(b.key));
  });

  const totalExp = periodExpenses.reduce((s, t) => s + t.amount, 0);

  const walletTotals = {
    "Bank Account": 0,
    "Credit Card": 0,
    "E-Wallet": 0,
    "Cash": 0
  };

  periodExpenses.forEach(t => {
    const w = t.wallet || "Bank Account";
    walletTotals[w] = (walletTotals[w] || 0) + t.amount;
  });

  dom.walletStatsGrid.innerHTML = Object.entries(walletTotals).map(([wallet, amount]) => {
    const pct = totalExp > 0 ? ((amount / totalExp) * 100).toFixed(0) : 0;
    const icon = getWalletIcon(wallet);
    return `
      <div class="wallet-stat-card">
        <div class="wallet-stat-header">
          <span>${icon} ${wallet}</span>
          <span class="wallet-stat-pct">${pct}%</span>
        </div>
        <div class="wallet-stat-amount">${formatCurrency(amount)}</div>
      </div>
    `;
  }).join("");
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
  downloadBlob(new Blob([csvContent], { type: "text/csv;charset=utf-8;" }), `expenses_${today}.csv`);
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
    customCategories: state.customCategories
  };

  const jsonStr = JSON.stringify(backupData, null, 2);
  const today = getLocalDateString();
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

function handleFileImport(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  const isJson = file.name.endsWith(".json");
  const isCsv = file.name.endsWith(".csv");

  reader.onload = (evt) => {
    try {
      const content = evt.target.result;
      if (isJson) importJSONData(content);
      else if (isCsv) importCSVData(content);
      else showToast("Unsupported file format. Use .json or .csv.");
    } catch (err) {
      showToast("Failed to parse imported file.");
    } finally {
      if (dom.settingsFileInput) dom.settingsFileInput.value = "";
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
    if (Array.isArray(parsed.subscriptions)) state.subscriptions = parsed.subscriptions;
    if (Array.isArray(parsed.customCategories)) state.customCategories = parsed.customCategories;
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
  state.periodFilter = "THIS_MONTH";
  dom.filterPeriod.value = "THIS_MONTH";
  dom.customDateInputs.style.display = "none";
  deselectCategory();
}

// Malaysian Working Professional (打工族) Real-Life Simulation (Jan 1 to Sep 3, 2026)
function loadSampleData() {
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
    { note: "Weekend Cafe Dinner & Cake treat", amt: 35.00, cat: "Food & Dining", wallet: "Credit Card", hasReceipt: true },
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

    // 1. Monthly Employment Salary on Day 1
    if (dayOfMonth === 1) {
      simulatedTransactions.push({
        id: "tx_sim_" + (idCount++),
        type: "income",
        amount: 3500.00,
        category: "Salary & Wages",
        wallet: "Bank Account",
        date: dateStr,
        note: `Employment Salary (${cur.toLocaleString(undefined, { month: "short" })})`,
        createdAt: cur.getTime() + 1000
      });

      // Room Rental on Day 1
      simulatedTransactions.push({
        id: "tx_sim_" + (idCount++),
        type: "expense",
        amount: 550.00,
        category: "Bills & Utilities",
        wallet: "Bank Account",
        date: dateStr,
        note: `Room Rental (${cur.toLocaleString(undefined, { month: "short" })})`,
        createdAt: cur.getTime() + 2000
      });
    }

    // 2. Monthly Savings Deposit on Day 2
    if (dayOfMonth === 2) {
      simulatedTransactions.push({
        id: "tx_sim_" + (idCount++),
        type: "expense",
        amount: 600.00,
        category: "Savings & Investments",
        wallet: "Bank Account",
        date: dateStr,
        note: "Bank Savings Deposit (Pay yourself first)",
        createdAt: cur.getTime() + 3000
      });

      // Spotify Subscription on Day 2
      simulatedTransactions.push({
        id: "tx_sim_" + (idCount++),
        type: "expense",
        amount: 15.90,
        category: "Entertainment",
        wallet: "Credit Card",
        date: dateStr,
        note: "Spotify Premium (Auto-debited)",
        createdAt: cur.getTime() + 4000
      });
    }

    // 3. Monthly Car Loan Installment on Day 5
    if (dayOfMonth === 5) {
      simulatedTransactions.push({
        id: "tx_sim_" + (idCount++),
        type: "expense",
        amount: 480.00,
        category: "Bills & Utilities",
        wallet: "Bank Account",
        date: dateStr,
        note: "Car Loan Installment (Hire Purchase)",
        createdAt: cur.getTime() + 5000
      });
    }

    // 4. CelcomDigi Postpaid Bill on Day 15
    if (dayOfMonth === 15) {
      simulatedTransactions.push({
        id: "tx_sim_" + (idCount++),
        type: "expense",
        amount: 45.00,
        category: "Bills & Utilities",
        wallet: "E-Wallet",
        date: dateStr,
        note: "CelcomDigi Postpaid Bill",
        createdAt: cur.getTime() + 6000
      });
    }

    // 5. Home Fibre Internet on Day 22
    if (dayOfMonth === 22) {
      simulatedTransactions.push({
        id: "tx_sim_" + (idCount++),
        type: "expense",
        amount: 89.00,
        category: "Bills & Utilities",
        wallet: "Bank Account",
        date: dateStr,
        note: "Home Fibre Internet 100Mbps",
        createdAt: cur.getTime() + 7000
      });
    }

    // 6. Weekly Shell Petrol RON95 refill on Mondays
    if (dayOfWeek === 1) {
      simulatedTransactions.push({
        id: "tx_sim_" + (idCount++),
        type: "expense",
        amount: 45.50,
        category: "Transportation",
        wallet: "Credit Card",
        date: dateStr,
        note: "Shell RON95 Petrol refill",
        receiptImage: receipts.fuel,
        createdAt: cur.getTime() + 8000
      });
    }

    // 7. Bi-weekly Hypermarket Groceries at Lotus's
    if (dayOfMonth === 10 || dayOfMonth === 24) {
      simulatedTransactions.push({
        id: "tx_sim_" + (idCount++),
        type: "expense",
        amount: 142.00,
        category: "Food & Dining",
        wallet: "Credit Card",
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

  state.subscriptions = [
    { id: "sub_rent", name: "Room Rental", amount: 550.00, category: "Bills & Utilities", billingDay: 1, wallet: "Bank Account", autoDeduct: true, lastLoggedMonth: currentYm, createdAt: Date.now() },
    { id: "sub_spotify", name: "Spotify Premium", amount: 15.90, category: "Entertainment", billingDay: 2, wallet: "Credit Card", autoDeduct: true, lastLoggedMonth: currentYm, createdAt: Date.now() },
    { id: "sub_car", name: "Car Loan Installment", amount: 480.00, category: "Bills & Utilities", billingDay: 5, wallet: "Bank Account", autoDeduct: true, lastLoggedMonth: null, createdAt: Date.now() },
    { id: "sub_mobile", name: "CelcomDigi Postpaid", amount: 45.00, category: "Bills & Utilities", billingDay: 15, wallet: "E-Wallet", autoDeduct: true, lastLoggedMonth: null, createdAt: Date.now() },
    { id: "sub_wifi", name: "Home Fibre Internet", amount: 89.00, category: "Bills & Utilities", billingDay: 22, wallet: "Bank Account", autoDeduct: true, lastLoggedMonth: null, createdAt: Date.now() }
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
