/**
 * db.js — Local persistence layer for the Expense Tracker.
 *
 * Replaces localStorage as the primary store (IndexedDB has a far higher
 * capacity and won't silently drop receipt photos when quota is hit), and
 * adds two layers of automatic local backup:
 *
 *   1. Rolling snapshots: every so often, a full JSON snapshot of all app
 *      data is written into a dedicated IndexedDB object store. The last
 *      SNAPSHOT_LIMIT snapshots are kept, oldest pruned automatically.
 *      This guards against a single corrupted/partial record.
 *
 *   2. Linked folder backups (optional, Chromium-based browsers only):
 *      the user can pick a real folder on disk via the File System Access
 *      API. After that, every save also writes a dated JSON backup file
 *      into that folder — a copy that lives outside the browser's storage
 *      sandbox, so it survives "Clear browsing data".
 *
 * Everything here is additive and self-contained; app.js only needs to call
 * the small public API below. All data lives entirely on-device — nothing
 * is ever sent over the network.
 */
const ExpenseDB = (() => {
  const DB_NAME = "expense_tracker_db";
  const DB_VERSION = 1;
  const KV_STORE = "kv";
  const SNAPSHOT_STORE = "snapshots";
  const SNAPSHOT_LIMIT = 7;
  const SNAPSHOT_MIN_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12h
  const FOLDER_HANDLE_KEY = "__backupFolderHandle";
  const LAST_SNAPSHOT_KEY = "__lastSnapshotAt";
  const LAST_FOLDER_BACKUP_KEY = "__lastFolderBackupAt";

  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) {
        reject(new Error("IndexedDB not supported"));
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(KV_STORE)) {
          db.createObjectStore(KV_STORE, { keyPath: "key" });
        }
        if (!db.objectStoreNames.contains(SNAPSHOT_STORE)) {
          db.createObjectStore(SNAPSHOT_STORE, { keyPath: "id", autoIncrement: true });
        }
      };
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  function tx(storeName, mode) {
    return openDB().then((db) => db.transaction(storeName, mode).objectStore(storeName));
  }

  // ---- Key/value store (mirrors the old localStorage keys) ----

  async function getItem(key) {
    const store = await tx(KV_STORE, "readonly");
    return new Promise((resolve, reject) => {
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : undefined);
      req.onerror = () => reject(req.error);
    });
  }

  async function setItem(key, value) {
    const store = await tx(KV_STORE, "readwrite");
    return new Promise((resolve, reject) => {
      const req = store.put({ key, value });
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  // Batch write — all entries share one transaction so a save is atomic.
  async function setItems(entries) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const t = db.transaction(KV_STORE, "readwrite");
      const store = t.objectStore(KV_STORE);
      entries.forEach(([key, value]) => store.put({ key, value }));
      t.oncomplete = () => resolve(true);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  }

  async function getAllKV() {
    const store = await tx(KV_STORE, "readonly");
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  // ---- One-time migration from the legacy localStorage keys ----

  async function migrateFromLocalStorage(storageKeys) {
    const existing = await getAllKV();
    const existingKeys = new Set(existing.map((r) => r.key));
    const toMigrate = [];
    Object.values(storageKeys).forEach((lsKey) => {
      if (existingKeys.has(lsKey)) return; // already migrated
      const raw = localStorage.getItem(lsKey);
      if (raw !== null && raw !== undefined) {
        toMigrate.push([lsKey, raw]);
      }
    });
    if (toMigrate.length) {
      await setItems(toMigrate);
    }
    return toMigrate.length;
  }

  // ---- Rolling internal snapshots ----

  async function snapshotIfDue(buildSnapshotFn) {
    try {
      const lastAt = (await getItem(LAST_SNAPSHOT_KEY)) || 0;
      if (Date.now() - lastAt < SNAPSHOT_MIN_INTERVAL_MS) return false;
      const snapshotData = buildSnapshotFn();
      const db = await openDB();
      await new Promise((resolve, reject) => {
        const t = db.transaction(SNAPSHOT_STORE, "readwrite");
        t.objectStore(SNAPSHOT_STORE).add({
          takenAt: Date.now(),
          data: snapshotData
        });
        t.oncomplete = resolve;
        t.onerror = () => reject(t.error);
      });
      await pruneSnapshots();
      await setItem(LAST_SNAPSHOT_KEY, Date.now());
      return true;
    } catch (e) {
      console.warn("Snapshot skipped:", e);
      return false;
    }
  }

  async function pruneSnapshots() {
    const db = await openDB();
    const all = await new Promise((resolve, reject) => {
      const req = db.transaction(SNAPSHOT_STORE, "readonly").objectStore(SNAPSHOT_STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    if (all.length <= SNAPSHOT_LIMIT) return;
    all.sort((a, b) => a.takenAt - b.takenAt);
    const toDelete = all.slice(0, all.length - SNAPSHOT_LIMIT);
    const t = db.transaction(SNAPSHOT_STORE, "readwrite");
    const store = t.objectStore(SNAPSHOT_STORE);
    toDelete.forEach((row) => store.delete(row.id));
  }

  async function listSnapshots() {
    const store = await tx(SNAPSHOT_STORE, "readonly");
    const all = await new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    return all.sort((a, b) => b.takenAt - a.takenAt);
  }

  async function getSnapshot(id) {
    const store = await tx(SNAPSHOT_STORE, "readonly");
    return new Promise((resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function forceSnapshot(buildSnapshotFn) {
    await setItem(LAST_SNAPSHOT_KEY, 0); // reset throttle
    return snapshotIfDue(buildSnapshotFn);
  }

  // ---- Linked folder backups (File System Access API) ----

  function folderBackupsSupported() {
    return typeof window.showDirectoryPicker === "function";
  }

  async function linkBackupFolder() {
    if (!folderBackupsSupported()) throw new Error("not_supported");
    const handle = await window.showDirectoryPicker({ mode: "readwrite" });
    await setItem(FOLDER_HANDLE_KEY, handle);
    return handle;
  }

  async function unlinkBackupFolder() {
    await setItem(FOLDER_HANDLE_KEY, null);
  }

  async function getLinkedFolderHandle() {
    if (!folderBackupsSupported()) return null;
    const handle = await getItem(FOLDER_HANDLE_KEY);
    return handle || null;
  }

  async function ensureFolderPermission(handle) {
    const opts = { mode: "readwrite" };
    if ((await handle.queryPermission(opts)) === "granted") return true;
    if ((await handle.requestPermission(opts)) === "granted") return true;
    return false;
  }

  // Writes one rolling "latest" file plus (at most once/day) a dated copy,
  // so the folder stays tidy instead of accumulating a file per save.
  async function writeFolderBackup(jsonString) {
    const handle = await getLinkedFolderHandle();
    if (!handle) return false;
    const ok = await ensureFolderPermission(handle);
    if (!ok) return false;

    const latestFile = await handle.getFileHandle("expense-tracker-latest-backup.json", { create: true });
    const latestWritable = await latestFile.createWritable();
    await latestWritable.write(jsonString);
    await latestWritable.close();

    const lastDailyAt = (await getItem(LAST_FOLDER_BACKUP_KEY)) || 0;
    if (Date.now() - lastDailyAt > 24 * 60 * 60 * 1000) {
      const dateStr = new Date().toISOString().slice(0, 10);
      const datedFile = await handle.getFileHandle(`expense-tracker-backup-${dateStr}.json`, { create: true });
      const datedWritable = await datedFile.createWritable();
      await datedWritable.write(jsonString);
      await datedWritable.close();
      await setItem(LAST_FOLDER_BACKUP_KEY, Date.now());
    }
    return true;
  }

  return {
    getItem,
    setItem,
    setItems,
    migrateFromLocalStorage,
    snapshotIfDue,
    forceSnapshot,
    listSnapshots,
    getSnapshot,
    folderBackupsSupported,
    linkBackupFolder,
    unlinkBackupFolder,
    getLinkedFolderHandle,
    writeFolderBackup
  };
})();
