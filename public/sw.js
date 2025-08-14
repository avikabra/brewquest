self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

const CACHE = 'brewquest-v1';
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Do not cache AI routes or API posts
  if (/\/api\/ai\//.test(req.url)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req);
    const network = fetch(req).then((res) => {
      const cacheable = res.ok && res.type !== 'opaque' && req.url.startsWith(self.location.origin);
      if (cacheable) cache.put(req, res.clone());
      return res;
    }).catch(() => cached);
    return cached || network;
  })());
});