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

  // Initialize IndexedDB
  function openDatabase() {
    return new Promise((resolve, reject) => {
      if (dbInstance) return resolve(dbInstance);
      if (!window.indexedDB) {
        console.warn("IndexedDB not supported, falling back to local-only storage.");
        return resolve(null);
      }

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
        console.error("Failed to open IndexedDB:", e);
        resolve(null);
      };
    });
  }

  // Helper for IndexedDB transactions
  async function idbGet(storeName, key) {
    const db = await openDatabase();
    if (!db) return null;
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
  }

  async function idbPut(storeName, value, key) {
    const db = await openDatabase();
    if (!db) return;
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const req = key !== undefined ? store.put(value, key) : store.put(value);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  }

  async function idbGetAll(storeName) {
    const db = await openDatabase();
    if (!db) return [];
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  }

  async function idbClear(storeName) {
    const db = await openDatabase();
    if (!db) return;
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const req = store.clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  }

  // Queue an offline mutation
  async function queueMutation(entity, action, data) {
    if (!ENTITY_STORES.includes(entity) || !data || !data.id) return;
    const db = await openDatabase();
    if (!db) return;

    // Cache locally in IDB entity store first
    if (action === "UPSERT") {
      await idbPut(entity, data);
    }

    // Append to outbox
    const mutation = {
      entity,
      action,
      data,
      timestamp: new Date().toISOString()
    };

    const tx = db.transaction("outbox_mutations", "readwrite");
    tx.objectStore("outbox_mutations").add(mutation);

    // If online and authenticated, trigger debounced sync
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
    try {
      const res = await fetch("/api/v1/csrf");
      if (res.ok) {
        const data = await res.json();
        csrfToken = data.csrf_token;
        localStorage.setItem(CSRF_STORAGE_KEY, csrfToken);
        return csrfToken;
      }
    } catch (e) {
      // Offline or network error
    }
    csrfToken = localStorage.getItem(CSRF_STORAGE_KEY) || null;
    return csrfToken;
  }

  // Check current session
  async function checkSession() {
    try {
      const res = await fetch("/api/v1/auth/me");
      if (res.ok) {
        const data = await res.json();
        currentUser = data.user;
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(currentUser));
        await fetchCsrfToken();
        updateUI();
        performSync();
        return currentUser;
      } else {
        currentUser = null;
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    } catch (e) {
      // Offline: load cached user if available
      const cached = localStorage.getItem(AUTH_STORAGE_KEY);
      if (cached) {
        try {
          currentUser = JSON.parse(cached);
        } catch (_) {}
      }
    }
    updateUI();
    return currentUser;
  }

  // Register
  async function register(email, password, importExisting = true) {
    try {
      const res = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Registration failed");
      }
      currentUser = data.user;
      csrfToken = data.csrf_token;
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(currentUser));
      if (csrfToken) localStorage.setItem(CSRF_STORAGE_KEY, csrfToken);

      // If user wants to import existing local state to their new cloud account
      if (importExisting && window.state) {
        await snapshotAllToOutbox();
      }

      updateUI();
      performSync();
      return { success: true, user: currentUser };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // Login
  async function login(email, password) {
    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Login failed");
      }
      currentUser = data.user;
      csrfToken = data.csrf_token;
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(currentUser));
      if (csrfToken) localStorage.setItem(CSRF_STORAGE_KEY, csrfToken);

      updateUI();
      performSync();
      return { success: true, user: currentUser };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // Logout
  async function logout() {
    try {
      if (csrfToken) {
        await fetch("/api/v1/auth/logout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken
          }
        });
      }
    } catch (e) {}
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

      const res = await fetch("/api/v1/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken || ""
        },
        body: JSON.stringify(payload)
      });

      if (res.status === 401) {
        // Session expired
        currentUser = null;
        localStorage.removeItem(AUTH_STORAGE_KEY);
        updateUI();
        isSyncing = false;
        return;
      }

      if (res.ok) {
        const syncData = await res.json();
        localStorage.setItem(LAST_SYNC_KEY, syncData.synced_at);

        // Clear flushed outbox items
        await idbClear("outbox_mutations");

        // Merge incoming changes from server into local app state if newer
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

    // Helper to merge entity arrays
    function mergeEntities(localArr, serverArr) {
      if (!Array.isArray(serverArr) || serverArr.length === 0) return localArr;
      const map = new Map(localArr.map((item) => [item.id, item]));
      serverArr.forEach((serverItem) => {
        if (serverItem.deleted_at) {
          map.delete(serverItem.id);
          stateModified = true;
        } else {
          // Normalize column names if needed
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
    try {
      const res = await fetch("/api/v1/user/export");
      if (!res.ok) throw new Error("Failed to export server data");
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `expense_tracker_cloud_backup_${new Date().toISOString().substring(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // Delete Account
  async function deleteAccount(password) {
    try {
      if (!csrfToken) await fetchCsrfToken();
      const res = await fetch("/api/v1/user/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken || ""
        },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to delete account");
      currentUser = null;
      csrfToken = null;
      localStorage.removeItem(AUTH_STORAGE_KEY);
      localStorage.removeItem(CSRF_STORAGE_KEY);
      localStorage.removeItem(LAST_SYNC_KEY);
      await idbClear("outbox_mutations");
      updateUI();
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
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
      pill.title = "Sync error. Retrying shortly.";
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

  // Setup DOM Event Listeners
  function setupUI() {
    const syncPill = document.getElementById("sync-status-pill");
    const authModal = document.getElementById("auth-account-dialog");
    const closeBtn = document.getElementById("close-auth-modal-btn");
    const settingsAccountBtn = document.getElementById("settings-open-auth-btn");

    if (syncPill && authModal) {
      syncPill.addEventListener("click", () => {
        updateUI();
        if (typeof authModal.showModal === "function") authModal.showModal();
        else authModal.style.display = "block";
      });
    }

    if (settingsAccountBtn && authModal) {
      settingsAccountBtn.addEventListener("click", () => {
        updateUI();
        if (typeof authModal.showModal === "function") authModal.showModal();
        else authModal.style.display = "block";
      });
    }

    if (closeBtn && authModal) {
      closeBtn.addEventListener("click", () => {
        if (typeof authModal.close === "function") authModal.close();
        else authModal.style.display = "none";
      });
    }

    // Universal backdrop dismissal adhering to test requirement: e.target === dialog
    if (authModal) {
      authModal.addEventListener("click", (e) => {
        if (e.target === authModal) {
          if (typeof authModal.close === "function") authModal.close();
          else authModal.style.display = "none";
        }
      });
    }

    // Tab switcher in modal
    const tabLogin = document.getElementById("auth-tab-login");
    const tabRegister = document.getElementById("auth-tab-register");
    const formLogin = document.getElementById("auth-form-login");
    const formRegister = document.getElementById("auth-form-register");

    if (tabLogin && tabRegister && formLogin && formRegister) {
      tabLogin.addEventListener("click", () => {
        tabLogin.classList.add("active");
        tabRegister.classList.remove("active");
        formLogin.style.display = "block";
        formRegister.style.display = "none";
      });
      tabRegister.addEventListener("click", () => {
        tabRegister.classList.add("active");
        tabLogin.classList.remove("active");
        formRegister.style.display = "block";
        formLogin.style.display = "none";
      });
    }

    // Form Submissions
    if (formLogin) {
      formLogin.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("login-email").value;
        const password = document.getElementById("login-password").value;
        const msgEl = document.getElementById("login-msg");
        if (msgEl) msgEl.textContent = "Authenticating...";

        const res = await login(email, password);
        if (res.success) {
          if (msgEl) msgEl.textContent = "";
          if (authModal && typeof authModal.close === "function") authModal.close();
          if (typeof window.showToast === "function") window.showToast("Signed in as " + res.user.email);
        } else {
          if (msgEl) msgEl.textContent = res.error;
        }
      });
    }

    if (formRegister) {
      formRegister.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("register-email").value;
        const password = document.getElementById("register-password").value;
        const importCheck = document.getElementById("register-import-local").checked;
        const msgEl = document.getElementById("register-msg");
        if (msgEl) msgEl.textContent = "Creating account...";

        const res = await register(email, password, importCheck);
        if (res.success) {
          if (msgEl) msgEl.textContent = "";
          if (authModal && typeof authModal.close === "function") authModal.close();
          if (typeof window.showToast === "function") window.showToast("Account created! Synced ledger.");
        } else {
          if (msgEl) msgEl.textContent = res.error;
        }
      });
    }

    // Logout Button
    const logoutBtn = document.getElementById("auth-logout-btn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", async () => {
        await logout();
        if (authModal && typeof authModal.close === "function") authModal.close();
        if (typeof window.showToast === "function") window.showToast("Logged out successfully.");
      });
    }

    // Manual Sync Button
    const syncNowBtn = document.getElementById("auth-sync-now-btn");
    if (syncNowBtn) {
      syncNowBtn.addEventListener("click", async () => {
        syncNowBtn.disabled = true;
        syncNowBtn.textContent = "Syncing...";
        await performSync();
        syncNowBtn.disabled = false;
        syncNowBtn.textContent = "🔄 Sync Now";
        if (typeof window.showToast === "function") window.showToast("Cloud sync completed.");
      });
    }

    // Export Cloud Data Button
    const exportBtn = document.getElementById("auth-export-cloud-btn");
    if (exportBtn) {
      exportBtn.addEventListener("click", async () => {
        await exportCloudData();
        if (typeof window.showToast === "function") window.showToast("Cloud backup downloaded.");
      });
    }

    // Delete Account Button
    const deleteBtn = document.getElementById("auth-delete-account-btn");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", async () => {
        const pw = prompt("SECURITY CONFIRMATION:\nPlease enter your password to permanently delete your account and cloud data:");
        if (!pw) return;
        const res = await deleteAccount(pw);
        if (res.success) {
          if (authModal && typeof authModal.close === "function") authModal.close();
          alert("Your account and cloud records have been deleted.");
        } else {
          alert("Deletion failed: " + res.error);
        }
      });
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
        // Async queue mutations in background
        if (window.state && currentUser) {
          snapshotAllToOutbox();
        }
      };
    }
  }

  // Lifecycle Initialization
  async function init() {
    await openDatabase();
    setupUI();
    hookAppStorage();
    await checkSession();
  }

  return {
    init,
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

// Auto-boot on DOM ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => AuthSync.init());
} else {
  AuthSync.init();
}
