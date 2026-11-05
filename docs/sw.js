// Service worker: app direct uit de cache starten (stale-while-revalidate),
// nieuwe versie op de achtergrond ophalen. API-verkeer gaat altijd naar het netwerk.
const VERSION = 'pulse-v28';
const SHELL = [
  './', 'index.html', 'config.js', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/util.js', 'js/store.js', 'js/auth.js', 'js/api.js', 'js/sync.js',
  'js/metrics.js', 'js/strength.js', 'js/charts.js', 'js/demo.js', 'js/icons.js', 'js/interact.js', 'js/live.js',
  'js/activities.js', 'js/healthspan.js', 'js/bodymap.js', 'js/share.js', 'js/coach.js', 'js/patterns.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => Promise.all(SHELL.map((u) => c.add(new Request(u, { cache: 'reload' })).catch(() => {})))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(caches.open(VERSION).then(async (cache) => {
    const cached = await cache.match(e.request, { ignoreSearch: true });
    const network = fetch(e.request).then((res) => { if (res.ok) cache.put(e.request, res.clone()); return res; }).catch(() => null);
    if (cached) { e.waitUntil(network); return cached; }
    return (await network) || (await cache.match('index.html')) || Response.error();
  }));
});
