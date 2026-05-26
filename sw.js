const CACHE = 'ctp-v10';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/constants.js',
  './js/core/store.js',
  './js/utils.js',
  './js/charts.js',
  './js/render_dashboard.js',
  './js/render_planning.js',
  './js/render_session.js',
  './js/render_corps.js',
  './js/render_bilan.js',
  './js/render_other.js',
  './js/init.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
