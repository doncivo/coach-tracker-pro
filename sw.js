const CACHE = 'ctp-v26';
const ASSETS = [
  './', './index.html',
  './design/tokens.css', './css/style.css',
  './js/core/errors.js',
  './js/data/constants.js', './js/data/exercises.js',
  './js/core/store.js',
  './js/store/training.js', './js/store/activity.js',
  './js/store/body.js', './js/store/goals.js', './js/store/app.js',
  './js/services/persist.js', './js/services/compute.js',
  './js/core/state-bridge.js', './js/core/router.js',
  './js/utils.js', './js/charts.js',
  './js/render_dashboard.js', './js/render_planning.js',
  './js/render_session.js', './js/render_corps.js',
  './js/render_bilan.js', './js/render_other.js',
  './js/views/dashboard.js', './js/views/bilan.js',
  './js/views/kpi.js', './js/views/progression.js',
  './js/views/corps.js', './js/views/planning.js',
  './js/views/session.js', './js/views/library.js',
  './js/views/calendar.js', './js/views/achievements.js',
  './js/views/settings.js', './js/init.js'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(c => c || fetch(e.request)));
});
