const DB_NAME = "polygon-madikeri-offline";
const DB_VERSION = 1;
const STORE = "cache";
const FALLBACK_PREFIX = "polygon-offline:";

function openDb() {
  if (!window.indexedDB) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function offlinePut(key, value) {
  const db = await openDb();
  if (!db) {
    try { localStorage.setItem(FALLBACK_PREFIX + key, JSON.stringify(value)); } catch {}
    return;
  }
  await new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = resolve;
      tx.onerror = resolve;
      tx.onabort = resolve;
    } catch { resolve(); }
  });
  db.close();
}

export async function offlineGet(key) {
  const db = await openDb();
  if (!db) {
    try {
      const raw = localStorage.getItem(FALLBACK_PREFIX + key);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => { resolve(req.result ?? null); db.close(); };
      req.onerror = () => { resolve(null); db.close(); };
    } catch { resolve(null); }
  });
}

export async function offlineDelete(key) {
  const db = await openDb();
  if (!db) {
    try { localStorage.removeItem(FALLBACK_PREFIX + key); } catch {}
    return;
  }
  await new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = resolve;
      tx.onerror = resolve;
      tx.onabort = resolve;
    } catch { resolve(); }
  });
  db.close();
}

export async function offlineGetQueue(key) {
  return (await offlineGet(key)) || [];
}
