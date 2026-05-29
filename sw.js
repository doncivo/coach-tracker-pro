const CACHE = 'ctp-v90';
const ASSETS = [
  './', './index.html',
  './design/tokens.css', './css/style.css',
  './js/core/errors.js',
  './js/data/constants.js', './js/data/exercises.js',
  './js/data/foods-fr.js', './js/data/programs.js',
  './js/core/store.js',
  './js/store/training.js', './js/store/activity.js',
  './js/store/body.js', './js/store/goals.js', './js/store/app.js',
  './js/services/idb-storage.js',
  './js/services/persist.js',
  './js/services/csv-planning.js',
  './js/services/mesures-objectifs.js',
  './js/services/api-integrations.js',
  './js/services/api-extended.js',
  './js/services/icloud-watch.js',
  './js/services/body-composition.js', './js/services/compute.js', './js/services/notify.js', './js/services/share.js', './js/services/search.js', './js/services/coach.js',
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
  './js/views/settings.js', './js/init.js',
  './js/tests/ctp-test.js'
];

self.addEventListener('install', e => {
  // N'installe pas skipWaiting automatiquement — attendre activation explicite
  // self.skipWaiting(); // Commenté : évite de couper une session active
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS))
  );
});

self.addEventListener('activate', e => {
  // Prendre le contrôle immédiatement
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => {
        console.log('[SW] Suppression ancien cache:', k);
        return caches.delete(k);
      }))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

// Écouter SKIP_WAITING depuis le client
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
