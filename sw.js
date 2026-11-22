// Service worker: keeps every file on the device so Si det works without internet.
importScripts('js/precache.js');

const CACHE = `si-det-${self.PRECACHE_VERSION}`;
// The picture library never changes per file (one ARASAAC id = one picture), so it
// lives in its own cache and an app update only fetches pictures it doesn't have yet.
const LIB_CACHE = 'si-det-library';

async function fillLibrary() {
  const c = await caches.open(LIB_CACHE);
  const have = new Set((await c.keys()).map((r) => new URL(r.url).pathname.split('/').pop()));
  const want = new Set((self.LIBRARY || []).map((f) => f.split('/').pop()));
  for (const r of await c.keys()) if (!want.has(new URL(r.url).pathname.split('/').pop())) await c.delete(r);
  const todo = (self.LIBRARY || []).filter((f) => !have.has(f.split('/').pop()));
  // A few at a time; a picture that fails is fetched from the network when needed.
  for (let i = 0; i < todo.length; i += 24) await Promise.allSettled(todo.slice(i, i + 24).map((f) => c.add(f)));
}

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    await (await caches.open(CACHE)).addAll(self.PRECACHE);
    await fillLibrary();
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('si-det-') && k !== CACHE && k !== LIB_CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return; // symbol search goes straight to the network
  e.respondWith((async () => {
    const hit = await caches.match(e.request, { ignoreSearch: true });
    if (hit) return hit;
    try {
      return await fetch(e.request);
    } catch {
      return (await caches.match('index.html')) || Response.error();
    }
  })());
});
