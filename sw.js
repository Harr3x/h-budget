// Cache-first Service Worker. Bump CACHE_VERSION on releases.
const CACHE_VERSION = 'budget-v4';
const ASSETS = [
  './', './index.html', './styles.css', './app.js', './manifest.json',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
  './src/state.js', './src/formatters.js', './src/date-utils.js', './src/queries.js',
  './src/recurring.js', './src/theme.js', './src/toast.js', './src/charts.js',
  './src/render.js', './src/banner.js',
  './src/views/entry.js', './src/views/overview.js', './src/views/history.js',
  './src/views/recurring.js', './src/views/settings.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_VERSION).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    caches.match(req).then(hit => {
      if (hit) return hit;
      return fetch(req).then(res => {
        // cache successful same-origin GETs
        if (res.ok && new URL(req.url).origin === self.location.origin) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
