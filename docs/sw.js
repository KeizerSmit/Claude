// Service worker: app-shell offline beschikbaar. API-verkeer gaat altijd naar het netwerk.
const VERSION = 'pulse-v13';
const SHELL = [
  './', 'index.html', 'config.js', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/util.js', 'js/store.js', 'js/auth.js', 'js/api.js', 'js/sync.js',
  'js/metrics.js', 'js/strength.js', 'js/charts.js', 'js/demo.js', 'js/icons.js', 'js/interact.js', 'js/live.js', 'js/activities.js', 'js/healthspan.js', 'js/bodymap.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // Netwerk eerst (zodat updates direct binnenkomen), cache als terugval.
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html')))
  );
});
