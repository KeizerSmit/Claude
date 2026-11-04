// Lokale opslag in IndexedDB. Twee databases: echte data en demodata, zodat demo
// nooit je eigen krachtlogs overschrijft.

const STORES = ['days', 'kv'];
let db = null;
let dbName = null;

function open(name) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, 1);
    req.onupgradeneeded = () => {
      const d = req.result;
      for (const s of STORES) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function isDemo() {
  try { return localStorage.getItem('pulse.demo') === '1'; } catch { return false; }
}

export function setDemo(on) {
  try { localStorage.setItem('pulse.demo', on ? '1' : '0'); } catch { /* geen opslag */ }
}

export async function init() {
  const name = isDemo() ? 'pulse-demo' : 'pulse';
  if (db && dbName === name) return;
  if (db) db.close();
  db = await open(name);
  dbName = name;
}

function tx(store, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    let result;
    const r = fn(s);
    if (r && 'onsuccess' in r) r.onsuccess = () => { result = r.result; };
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export const kv = {
  get: (k) => tx('kv', 'readonly', (s) => s.get(k)),
  set: (k, v) => tx('kv', 'readwrite', (s) => s.put(v, k)),
  del: (k) => tx('kv', 'readwrite', (s) => s.delete(k)),
};

export const days = {
  get: (d) => tx('days', 'readonly', (s) => s.get(d)),
  put: (day) => tx('days', 'readwrite', (s) => s.put(day, day.date)),
  putMany: (list) => tx('days', 'readwrite', (s) => { for (const d of list) s.put(d, d.date); }),
  all: () => tx('days', 'readonly', (s) => s.getAll()),
  clear: () => tx('days', 'readwrite', (s) => s.clear()),
};

export async function clearAll() {
  await tx('days', 'readwrite', (s) => s.clear());
  await tx('kv', 'readwrite', (s) => s.clear());
}

export async function deleteDemoDb() {
  if (dbName === 'pulse-demo' && db) { db.close(); db = null; dbName = null; }
  await new Promise((res) => { const r = indexedDB.deleteDatabase('pulse-demo'); r.onsuccess = r.onerror = r.onblocked = () => res(); });
}
