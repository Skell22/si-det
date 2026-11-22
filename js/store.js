// Local storage on the device (IndexedDB). Nothing leaves the iPad.
// Stores: "kv" for settings and word changes, "blobs" for photos and voice recordings.

const DB_NAME = 'si-det';
let dbPromise;

function db() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('kv');
      req.result.createObjectStore('blobs');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function run(store, mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = () => reject(tx.error);
  });
}

export const kv = {
  get: (k) => run('kv', 'readonly', (s) => s.get(k)),
  set: (k, v) => run('kv', 'readwrite', (s) => s.put(v, k)),
};

export const blobs = {
  get: (k) => run('blobs', 'readonly', (s) => s.get(k)),
  set: (k, v) => run('blobs', 'readwrite', (s) => s.put(v, k)),
  del: (k) => run('blobs', 'readwrite', (s) => s.delete(k)),
  keys: () => run('blobs', 'readonly', (s) => s.getAllKeys()),
  clear: () => run('blobs', 'readwrite', (s) => s.clear()),
};

export async function askToKeepData() {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch { /* not supported */ }
  return false;
}

const toDataURL = (blob) => new Promise((resolve) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.readAsDataURL(blob);
});

export async function exportBackup() {
  const out = { app: 'si-det', version: 1, made: new Date().toISOString(), kv: {}, blobs: {} };
  out.kv.settings = await kv.get('settings');
  out.kv.overrides = await kv.get('overrides');
  for (const k of await blobs.keys()) out.blobs[k] = await toDataURL(await blobs.get(k));
  return new Blob([JSON.stringify(out)], { type: 'application/json' });
}

export async function importBackup(file) {
  const data = JSON.parse(await file.text());
  if (data.app !== 'si-det') throw new Error('Filen er ikke en sikkerhetskopi fra Si det.');
  await kv.set('settings', data.kv?.settings ?? null);
  await kv.set('overrides', data.kv?.overrides ?? {});
  await blobs.clear();
  for (const [k, url] of Object.entries(data.blobs ?? {})) {
    await blobs.set(k, await (await fetch(url)).blob());
  }
}
