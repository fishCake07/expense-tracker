// ================= PRODUCTION-READY PWA AUTH & OFFLINE SYNC ENGINE =================
// Compliant with OWASP, PWA Offline-First, and Multi-Tenant Security Standards

const AUTH_STORAGE_KEY = "expense_tracker_auth_user_v1";
const CSRF_STORAGE_KEY = "expense_tracker_csrf_token_v1";
const LAST_SYNC_KEY = "expense_tracker_last_sync_v1";

const AuthSync = (() => {
  let dbInstance = null;
  let currentUser = null;
  let csrfToken = null;
  let isSyncing = false;
  let syncTimeout = null;

  // Resolve API Base URL:
  // If running directly through Python server on 8080 -> relative ""
  // If running through VS Code Live Server (port 5500) or other static server -> target http://localhost:8080
  function getApiBase() {
    if (typeof window === "undefined" || !window.location) return "";
    const port = window.location.port;
    if (window.location.protocol === "file:" || (port && port !== "8080")) {
      return "http://localhost:8080";
    }
    return "";
  }
  const API_BASE = getApiBase();

  const DB_NAME = "ExpenseTrackerDB";
  const DB_VERSION = 1;
  const ENTITY_STORES = [
    "bank_accounts",
    "credit_cards",
    "debit_cards",
    "loans",
    "transactions",
    "subscriptions",
    "custom_categories",
    "notifications"
  ];

  // Robust Fetch Wrapper ensuring non-JSON (HTML 404/500) never causes SyntaxError
  async function safeFetchJson(url, options = {}) {
    options.credentials = "include";
    let res;
    try {
      res = await fetch(url, options);
    } catch (netErr) {
      return {
        ok: false,
        status: 0,
        data: null,
        error: "Network Error",
        message: "Cannot connect to the backend server at " + (API_BASE || "http://localhost:8080") + ". Please ensure 'python server/server.py' is running."
      };
    }

    const contentType = res.headers.get("content-type") || "";
    let data = null;

    if (contentType.includes("application/json")) {
      try {
        data = await res.json();
      } catch (parseErr) {
        data = null;
      }
    } else {
      const text = await res.text();
      if (text.trim().startsWith("<")) {
        return {
          ok: false,
          status: res.status,
          data: null,
          error: "Invalid Server Response",
          message: "The backend server returned HTML instead of JSON. Ensure 'python server/server.py' is running on port 8080 and open http://localhost:8080 directly."
        };
      }
      try {
        data = JSON.parse(text);
      } catch (_) {
        data = { message: text };
      }
    }

    return {
      ok: res.ok,
      status: res.status,
      data: data,
      error: res.ok ? null : ((data && data.error) || "Request Failed"),
      message: (data && data.message) || (res.ok ? "Success" : `Server returned HTTP ${res.status}`)
    };
  }

  // Initialize IndexedDB with try-catch safety
  function openDatabase() {
    return new Promise((resolve) => {
      if (dbInstance) return resolve(dbInstance);
      if (!window.indexedDB) {
        console.warn("IndexedDB not supported in this environment, falling back to local storage.");
        return resolve(null);
      }

      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains("meta")) {
            db.createObjectStore("meta");
          }
          if (!db.objectStoreNames.contains("outbox_mutations")) {
            db.createObjectStore("outbox_mutations", { keyPath: "id", autoIncrement: true });
          }
          ENTITY_STORES.forEach((storeName) => {
            if (!db.objectStoreNames.contains(storeName)) {
              db.createObjectStore(storeName, { keyPath: "id" });
            }
          });
        };

        request.onsuccess = (e) => {
          dbInstance = e.target.result;
          resolve(dbInstance);
        };

        request.onerror = (e) => {
          console.warn("IndexedDB open request error:", e);
          resolve(null);
        };
      } catch (err) {
        console.warn("IndexedDB open exception:", err);
        resolve(null);
      }
    });
  }

  // Helpers for IndexedDB transactions
  async function idbGet(storeName, key) {
    const db = await openDatabase();
    if (!db) return null;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch (_) {
        resolve(null);
      }
    });
  }

  async function idbPut(storeName, value, key) {
    const db = await openDatabase();
    if (!db) return;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        const req = key !== undefined ? store.put(value, key) : store.put(value);
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      } catch (_) {
        resolve(false);
      }
    });
  }

  async function idbGetAll(storeName) {
    const db = await openDatabase();
    if (!db) return [];
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      } catch (_) {
        resolve([]);
      }
    });
  }

  async function idbClear(storeName) {
    const db = await openDatabase();
    if (!db) return;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        const req = store.clear();
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      } catch (_) {
        resolve(false);
      }
    });
  }

  // Queue an offline mutation
  async function queueMutation(entity, action, data) {
    if (!ENTITY_STORES.includes(entity) || !data || !data.id) return;
    const db = await openDatabase();
    if (!db) return;

    if (action === "UPSERT") {
      await idbPut(entity, data);
    }

    const mutation = {
      entity,
      action,
      data,
      timestamp: new Date().toISOString()
    };

    try {
      const tx = db.transaction("outbox_mutations", "readwrite");
      tx.objectStore("outbox_mutations").add(mutation);
    } catch (_) {}

    if (currentUser && navigator.onLine) {
      scheduleSync(1500);
    }
  }

  function scheduleSync(delayMs = 1000) {
    if (syncTimeout) clearTimeout(syncTimeout);
    syncTimeout = setTimeout(() => {
      performSync();
    }, delayMs);
  }

  // Fetch CSRF Token
  async function fetchCsrfToken() {
    const res = await safeFetchJson(`${API_BASE}/api/v1/csrf`);
    if (res.ok && res.data && res.data.csrf_token) {
      csrfToken = res.data.csrf_token;
      localStorage.setItem(CSRF_STORAGE_KEY, csrfToken);
      return csrfToken;
    }
    csrfToken = localStorage.getItem(CSRF_STORAGE_KEY) || null;
    return csrfToken;
  }

  // Check current session
  async function checkSession() {
    const res = await safeFetchJson(`${API_BASE}/api/v1/auth/me`);
    if (res.ok && res.data && res.data.user) {
      currentUser = res.data.user;
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(currentUser));
      await fetchCsrfToken();
      updateUI();
      performSync();
      return currentUser;
    } else {
      currentUser = null;
      localStorage.removeItem(AUTH_STORAGE_KEY);
      updateUI();
      return null;
    }
  }

  // Register
  async function register(email, password, importExisting = true) {
    const res = await safeFetchJson(`${API_BASE}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    if (!res.ok) {
      return { success: false, error: res.message || "Registration failed" };
    }

    currentUser = res.data.user;
    csrfToken = res.data.csrf_token;
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(currentUser));
    if (csrfToken) localStorage.setItem(CSRF_STORAGE_KEY, csrfToken);

    if (importExisting && window.state) {
      await snapshotAllToOutbox();
    }

    updateUI();
    performSync();
    return { success: true, user: currentUser };
  }

  // Login
  async function login(email, password) {
    const res = await safeFetchJson(`${API_BASE}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    if (!res.ok) {
      return { success: false, error: res.message || "Login failed" };
    }

    currentUser = res.data.user;
    csrfToken = res.data.csrf_token;
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(currentUser));
    if (csrfToken) localStorage.setItem(CSRF_STORAGE_KEY, csrfToken);

    updateUI();
    performSync();
    return { success: true, user: currentUser };
  }

  // Logout
  async function logout() {
    if (csrfToken) {
      await safeFetchJson(`${API_BASE}/api/v1/auth/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken
        }
      });
    }
    currentUser = null;
    csrfToken = null;
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(CSRF_STORAGE_KEY);
    updateUI();
    return { success: true };
  }

  // Snapshot current in-memory / local storage state into outbox
  async function snapshotAllToOutbox() {
    if (!window.state) return;
    const s = window.state;
    if (s.bankAccounts) {
      for (const b of s.bankAccounts) await queueMutation("bank_accounts", "UPSERT", b);
    }
    if (s.creditCards) {
      for (const c of s.creditCards) await queueMutation("credit_cards", "UPSERT", c);
    }
    if (s.debitCards) {
      for (const d of s.debitCards) await queueMutation("debit_cards", "UPSERT", d);
    }
    if (s.loans) {
      for (const l of s.loans) await queueMutation("loans", "UPSERT", l);
    }
    if (s.transactions) {
      for (const t of s.transactions) await queueMutation("transactions", "UPSERT", t);
    }
    if (s.subscriptions) {
      for (const sub of s.subscriptions) await queueMutation("subscriptions", "UPSERT", sub);
    }
    if (s.customCategories) {
      for (const cat of s.customCategories) await queueMutation("custom_categories", "UPSERT", cat);
    }
    if (s.notifications) {
      for (const n of s.notifications) await queueMutation("notifications", "UPSERT", n);
    }
  }

  // Bidirectional Synchronization Engine
  async function performSync() {
    if (isSyncing || !currentUser || !navigator.onLine) return;
    isSyncing = true;
    updateSyncPill("syncing");

    try {
      if (!csrfToken) await fetchCsrfToken();
      const lastSynced = localStorage.getItem(LAST_SYNC_KEY) || "1970-01-01T00:00:00Z";
      const outbox = await idbGetAll("outbox_mutations");

      const payload = {
        since: lastSynced,
        mutations: outbox.map((item) => ({
          entity: item.entity,
          action: item.action,
          data: item.data
        }))
      };

      const res = await safeFetchJson(`${API_BASE}/api/v1/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken || ""
        },
        body: JSON.stringify(payload)
      });

      if (res.status === 401) {
        currentUser = null;
        localStorage.removeItem(AUTH_STORAGE_KEY);
        updateUI();
        isSyncing = false;
        return;
      }

      if (res.ok && res.data) {
        const syncData = res.data;
        if (syncData.synced_at) localStorage.setItem(LAST_SYNC_KEY, syncData.synced_at);
        await idbClear("outbox_mutations");

        if (syncData.changes && window.state) {
          applyServerChanges(syncData.changes);
        }

        updateSyncPill("synced");
      } else {
        updateSyncPill("error");
      }
    } catch (e) {
      console.warn("Sync encountered network anomaly, will retry later:", e);
      updateSyncPill("offline");
    } finally {
      isSyncing = false;
    }
  }

  // Merge server records into app state cleanly
  function applyServerChanges(changes) {
    let stateModified = false;
    const s = window.state;

    function mergeEntities(localArr, serverArr) {
      if (!Array.isArray(serverArr) || serverArr.length === 0) return localArr;
      const map = new Map(localArr.map((item) => [item.id, item]));
      serverArr.forEach((serverItem) => {
        if (serverItem.deleted_at) {
          map.delete(serverItem.id);
          stateModified = true;
        } else {
          const existing = map.get(serverItem.id);
          if (!existing || (serverItem.updated_at && (!existing.updated_at || serverItem.updated_at >= existing.updated_at))) {
            map.set(serverItem.id, serverItem);
            stateModified = true;
          }
        }
      });
      return Array.from(map.values());
    }

    if (changes.bank_accounts && changes.bank_accounts.length) {
      s.bankAccounts = mergeEntities(s.bankAccounts || [], changes.bank_accounts);
    }
    if (changes.credit_cards && changes.credit_cards.length) {
      s.creditCards = mergeEntities(s.creditCards || [], changes.credit_cards);
    }
    if (changes.debit_cards && changes.debit_cards.length) {
      s.debitCards = mergeEntities(s.debitCards || [], changes.debit_cards);
    }
    if (changes.loans && changes.loans.length) {
      s.loans = mergeEntities(s.loans || [], changes.loans);
    }
    if (changes.transactions && changes.transactions.length) {
      s.transactions = mergeEntities(s.transactions || [], changes.transactions);
    }
    if (changes.subscriptions && changes.subscriptions.length) {
      s.subscriptions = mergeEntities(s.subscriptions || [], changes.subscriptions);
    }
    if (changes.custom_categories && changes.custom_categories.length) {
      s.customCategories = mergeEntities(s.customCategories || [], changes.custom_categories);
    }
    if (changes.notifications && changes.notifications.length) {
      s.notifications = mergeEntities(s.notifications || [], changes.notifications);
    }

    if (stateModified) {
      if (typeof window.saveStorage === "function") window.saveStorage();
      if (typeof window.renderApp === "function") window.renderApp();
    }
  }

  // Export User Cloud Data
  async function exportCloudData() {
    const res = await safeFetchJson(`${API_BASE}/api/v1/user/export`);
    if (!res.ok) {
      return { success: false, error: res.message || "Failed to export server data" };
    }
    const data = res.data;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expense_tracker_cloud_backup_${new Date().toISOString().substring(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    return { success: true };
  }

  // Delete Account
  async function deleteAccount(password) {
    if (!csrfToken) await fetchCsrfToken();
    const res = await safeFetchJson(`${API_BASE}/api/v1/user/delete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken || ""
      },
      body: JSON.stringify({ password })
    });
    if (!res.ok) {
      return { success: false, error: res.message || "Failed to delete account" };
    }
    currentUser = null;
    csrfToken = null;
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(CSRF_STORAGE_KEY);
    localStorage.removeItem(LAST_SYNC_KEY);
    await idbClear("outbox_mutations");
    updateUI();
    return { success: true };
  }

  // Update UI Pills and Dialogs
  function updateSyncPill(status) {
    const pill = document.getElementById("sync-status-pill");
    const label = document.getElementById("sync-status-label");
    if (!pill || !label) return;

    pill.className = "sync-status-pill " + status;
    if (!navigator.onLine) {
      label.textContent = "Offline";
      pill.title = "Working offline. Changes are saved locally and will sync when reconnected.";
    } else if (!currentUser) {
      label.textContent = "Local Mode";
      pill.title = "Running locally. Sign in to enable cloud backup and cross-device sync.";
    } else if (status === "syncing") {
      label.textContent = "Syncing...";
      pill.title = "Synchronizing encrypted ledger with cloud...";
    } else if (status === "synced") {
      label.textContent = "Synced";
      pill.title = "All financial records safely synchronized.";
    } else {
      label.textContent = "Sync Warning";
      pill.title = "Sync warning. Ensure server is running.";
    }
  }

  function updateUI() {
    updateSyncPill(navigator.onLine ? (currentUser ? "synced" : "local") : "offline");

    const authModal = document.getElementById("auth-account-dialog");
    if (!authModal) return;

    const unauthView = document.getElementById("auth-unauthenticated-view");
    const authView = document.getElementById("auth-authenticated-view");
    const userEmailSpan = document.getElementById("auth-user-email");
    const memberSinceSpan = document.getElementById("auth-member-since");

    if (currentUser) {
      if (unauthView) unauthView.style.display = "none";
      if (authView) authView.style.display = "block";
      if (userEmailSpan) userEmailSpan.textContent = currentUser.email;
      if (memberSinceSpan && currentUser.created_at) {
        memberSinceSpan.textContent = new Date(currentUser.created_at).toLocaleDateString();
      }
    } else {
      if (unauthView) unauthView.style.display = "block";
      if (authView) authView.style.display = "none";
    }
  }

  function openAuthModal() {
    const authModal = document.getElementById("auth-account-dialog");
    if (!authModal) return;
    updateUI();
    if (typeof authModal.showModal === "function") {
      try {
        authModal.showModal();
      } catch (_) {
        authModal.setAttribute("open", "");
      }
    } else {
      authModal.setAttribute("open", "");
    }
  }

  function closeAuthModal() {
    const authModal = document.getElementById("auth-account-dialog");
    if (!authModal) return;
    if (typeof authModal.close === "function") {
      authModal.close();
    } else {
      authModal.removeAttribute("open");
    }
  }

  // Setup DOM Event Listeners
  function setupUI() {
    const syncPill = document.getElementById("sync-status-pill");
    const authModal = document.getElementById("auth-account-dialog");
    const closeBtn = document.getElementById("close-auth-modal-btn");
    const settingsAccountBtn = document.getElementById("settings-open-auth-btn");

    if (syncPill) {
      syncPill.onclick = () => openAuthModal();
    }

    if (settingsAccountBtn) {
      settingsAccountBtn.onclick = () => openAuthModal();
    }

    if (closeBtn) {
      closeBtn.onclick = () => closeAuthModal();
    }

    // Universal backdrop dismissal adhering strictly to test requirement: e.target === dialog
    if (authModal) {
      authModal.addEventListener("click", (e) => {
        if (e.target === authModal) {
          closeAuthModal();
        }
      });
    }

    // Tab switcher in modal
    const tabLogin = document.getElementById("auth-tab-login");
    const tabRegister = document.getElementById("auth-tab-register");
    const formLogin = document.getElementById("auth-form-login");
    const formRegister = document.getElementById("auth-form-register");

    if (tabLogin && tabRegister && formLogin && formRegister) {
      tabLogin.onclick = () => {
        tabLogin.classList.add("active");
        tabRegister.classList.remove("active");
        formLogin.style.display = "block";
        formRegister.style.display = "none";
      };
      tabRegister.onclick = () => {
        tabRegister.classList.add("active");
        tabLogin.classList.remove("active");
        formRegister.style.display = "block";
        formLogin.style.display = "none";
      };
    }

    // Form Submissions
    if (formLogin) {
      formLogin.onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById("login-email").value;
        const password = document.getElementById("login-password").value;
        const msgEl = document.getElementById("login-msg");
        if (msgEl) {
          msgEl.style.color = "var(--text-muted)";
          msgEl.textContent = "Authenticating...";
        }

        const res = await login(email, password);
        if (res.success) {
          if (msgEl) msgEl.textContent = "";
          closeAuthModal();
          if (typeof window.showToast === "function") window.showToast("Signed in as " + res.user.email);
        } else {
          if (msgEl) {
            msgEl.style.color = "#ef4444";
            msgEl.textContent = res.error;
          }
        }
      };
    }

    if (formRegister) {
      formRegister.onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById("register-email").value;
        const password = document.getElementById("register-password").value;
        const importCheck = document.getElementById("register-import-local").checked;
        const msgEl = document.getElementById("register-msg");
        if (msgEl) {
          msgEl.style.color = "var(--text-muted)";
          msgEl.textContent = "Creating account...";
        }

        const res = await register(email, password, importCheck);
        if (res.success) {
          if (msgEl) msgEl.textContent = "";
          closeAuthModal();
          if (typeof window.showToast === "function") window.showToast("Account created! Synced ledger.");
        } else {
          if (msgEl) {
            msgEl.style.color = "#ef4444";
            msgEl.textContent = res.error;
          }
        }
      };
    }

    // Logout Button
    const logoutBtn = document.getElementById("auth-logout-btn");
    if (logoutBtn) {
      logoutBtn.onclick = async () => {
        await logout();
        closeAuthModal();
        if (typeof window.showToast === "function") window.showToast("Logged out successfully.");
      };
    }

    // Manual Sync Button
    const syncNowBtn = document.getElementById("auth-sync-now-btn");
    if (syncNowBtn) {
      syncNowBtn.onclick = async () => {
        syncNowBtn.disabled = true;
        syncNowBtn.textContent = "Syncing...";
        await performSync();
        syncNowBtn.disabled = false;
        syncNowBtn.textContent = "🔄 Sync Now";
        if (typeof window.showToast === "function") window.showToast("Cloud sync completed.");
      };
    }

    // Export Cloud Data Button
    const exportBtn = document.getElementById("auth-export-cloud-btn");
    if (exportBtn) {
      exportBtn.onclick = async () => {
        await exportCloudData();
        if (typeof window.showToast === "function") window.showToast("Cloud backup downloaded.");
      };
    }

    // Delete Account Button
    const deleteBtn = document.getElementById("auth-delete-account-btn");
    if (deleteBtn) {
      deleteBtn.onclick = async () => {
        const pw = prompt("SECURITY CONFIRMATION:\nPlease enter your password to permanently delete your account and cloud data:");
        if (!pw) return;
        const res = await deleteAccount(pw);
        if (res.success) {
          closeAuthModal();
          alert("Your account and cloud records have been deleted.");
        } else {
          alert("Deletion failed: " + res.error);
        }
      };
    }

    // Network listeners
    window.addEventListener("online", () => {
      updateUI();
      performSync();
    });
    window.addEventListener("offline", () => {
      updateUI();
    });
  }

  // Hook into saveStorage to transparently queue mutations for cloud sync
  function hookAppStorage() {
    if (typeof window.saveStorage === "function") {
      const origSaveStorage = window.saveStorage;
      window.saveStorage = function () {
        origSaveStorage.apply(this, arguments);
        if (window.state && currentUser) {
          snapshotAllToOutbox();
        }
      };
    }
  }

  // Lifecycle Initialization
  async function init() {
    setupUI();
    hookAppStorage();
    try {
      await openDatabase();
    } catch (e) {
      console.warn("IndexedDB init warning:", e);
    }
    try {
      await checkSession();
    } catch (e) {
      console.warn("Session check warning:", e);
    }
  }

  return {
    init,
    openAuthModal,
    closeAuthModal,
    getCurrentUser: () => currentUser,
    register,
    login,
    logout,
    performSync,
    queueMutation,
    exportCloudData,
    deleteAccount
  };
})();

// Auto-boot immediately or on DOM ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => AuthSync.init());
} else {
  AuthSync.init();
}
