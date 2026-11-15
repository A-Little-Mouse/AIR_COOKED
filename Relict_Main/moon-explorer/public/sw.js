/* Lunar Trace: keeps the Moon's terrain and imagery tiles on the device. Cache-first for GET requests to the data mirror; everything else goes to the network untouched. */
const CACHE = 'lt-moon-tiles-v1'
const MAX_ENTRIES = 900
const MIRROR = /^https:\/\/storage\.googleapis\.com\/.*\/moon\//

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('lt-moon-tiles-') && k !== CACHE) await caches.delete(k)
    await self.clients.claim()
  })())
})

async function trim(cache) {
  const keys = await cache.keys()
  for (let i = 0; i < keys.length - MAX_ENTRIES; i++) await cache.delete(keys[i]) // oldest first
}

self.addEventListener('fetch', (e) => {
  const r = e.request
  if (r.method !== 'GET' || r.headers.has('range') || !MIRROR.test(r.url)) return
  e.respondWith((async () => {
    const cache = await caches.open(CACHE)
    const hit = await cache.match(r)
    if (hit) return hit
    const res = await fetch(r)
    if (res.ok && res.status === 200 && (res.type === 'cors' || res.type === 'basic')) {
      cache.put(r, res.clone()).then(() => trim(cache)).catch(() => undefined)
    }
    return res
  })())
})
