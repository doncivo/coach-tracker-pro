
/* ── Bouton ⚙️ Réglages dans le header — exécution directe (DOMContentLoaded déjà passé) ── */
(function _wireSettingsBtn() {
  const settingsBtn = document.getElementById('settings-hdr-btn');
  if (settingsBtn) {
    const goSettings = () => (typeof switchTab === 'function') ? switchTab('settings') : Router.navigate('settings');
    settingsBtn.addEventListener('click', goSettings);
    settingsBtn.ontouchstart = (e) => { e.preventDefault(); goSettings(); };
  }
})();


/* ── Masquer le splash screen après chargement ── */
(function() {
  function hideSplash() {
    const splash = document.getElementById('app-splash');
    if (!splash) return;
    splash.style.opacity = '0';
    setTimeout(() => splash.remove(), 320);
  }
  // Masquer dès que le DOM est prêt et que les scripts sont chargés
  if (document.readyState === 'complete') {
    setTimeout(hideSplash, 100);
  } else {
    window.addEventListener('load', () => setTimeout(hideSplash, 100));
  }
})();

/* ============================================================
   init.js — Point d'entrée Coach Tracker Pro
   Ordre: Store.load → Router.register → Router.init → navigate
============================================================ */

/* ── 0. Initialiser la gestion d'erreurs ── */
Errors.init({ dev: false });

/* ── 1. Charger les données ── */
Store.load();

/* ── 2. S est maintenant un proxy réactif (state-bridge.js)
   Les lectures/écritures sont automatiquement routées vers Store ── */

/* ── 3. Appliquer les préférences UI ── */
_exView = S.exViewMode || 'compact';
document.documentElement.setAttribute('data-theme', S.darkMode ? 'dark' : 'light');
const _dmBtn = document.getElementById('darkmode-btn');
if (_dmBtn) _dmBtn.textContent = S.darkMode ? '☀️' : '🌙';

/* ── 4. Enregistrer toutes les routes ── */
Router.register('dashboard',   () => DashboardView.render());
Router.register('weekly',      () => PlanningView.render());
Router.register('session',     () => SessionView.render());
Router.register('progression', () => ProgressionView.render());
Router.register('corps',       () => CorpsView.render());
Router.register('bilan',       () => BilanView.render());
Router.register('kpi',         () => KPIView.render());
Router.register('achievements',() => AchievementsView.render());
Router.register('library',     () => LibraryView.render());
Router.register('monthly',     () => CalendarView.render());
Router.register('settings',    () => SettingsView.render());

/* ── 5. Initialiser le router (event listeners nav) ── */
Router.init();

/* ── 6. Alias de compatibilité ──
   switchTab() utilisé partout dans le code existant
   On le redirige vers Router.navigate() sans rien casser */
function switchTab(tabName) {
  Router.navigate(tabName);
  Store.dispatch({ type: 'APP_SET_TAB', payload: tabName }, { skipUndo: true });
}

/* ── 7. Init des composants ── */
updateWeekBadges();
PlanningView._syncS();
renderDayTabs();
renderDayDetail(S.activeDay || 0);
renderGoals();

const _notesArea = document.getElementById('notes-area');
if (_notesArea) _notesArea.value = S.notes || '';

updateStats();
updateChronoDsp();
checkWeeklyAutoSave();
Notify.restore(); // Restaurer le rappel quotidien
checkAndAwardAchievements();

// ── Onboarding — vérification robuste ──
// Vérifier aussi si les données vitales sont présentes (profil non configuré)
(function _checkOnboardingRobust() {
  const done = localStorage.getItem('ctp_onboard_done_v2');
  const hasProfile = S.profilTaille && S.profilTaille !== 175; // 175 = valeur par défaut
  const hasHistory = Object.keys(S.history || {}).length > 0;

  // Afficher l'onboarding si :
  // - jamais fait (clé absente)
  // - OU profil vide ET pas d'historique (données vraiment fraîches)
  const shouldShow = !done || (!hasProfile && !hasHistory && !done);

  if (shouldShow) {
    setTimeout(() => {
      if (typeof showOnboarding === 'function') {
        showOnboarding();
      }
    }, 600); // 600ms pour laisser le DOM se stabiliser
  }
})();

_initRestTimerButtons(); // no-op depuis v45 — bindings dans RestTimer.start()
// restoreReminder() retiré — doublon de Notify.restore() ci-dessus

// ── 10. Indicateur hors-ligne ──
(function() {
  function _showOfflineBanner(isOffline) {
    let banner = document.getElementById('offline-banner');
    if (isOffline) {
      if (!banner) {
        banner = document.createElement('div');
        banner.id = 'offline-banner';
        banner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#c53030;color:#fff;text-align:center;font-size:12px;font-weight:700;padding:6px 12px;z-index:99998;';
        banner.textContent = '📵 Hors-ligne — les données sont sauvegardées localement';
        document.body.prepend(banner);
      }
    } else {
      if (banner) {
        banner.textContent = '✓ Connexion rétablie';
        banner.style.background = '#276749';
        setTimeout(() => banner?.remove(), 2500);
      }
    }
  }

  window.addEventListener('offline', () => _showOfflineBanner(true));
  window.addEventListener('online',  () => _showOfflineBanner(false));

  // Vérifier au démarrage si hors-ligne
  if (!navigator.onLine) _showOfflineBanner(true);
})();

/* ── 8. Naviguer vers l'onglet de démarrage ── */


/* ── Service Worker update notification ── */
if ('serviceWorker' in navigator && navigator.serviceWorker.ready && typeof navigator.serviceWorker.ready.then === 'function') {
  navigator.serviceWorker.ready.then(reg => {
    reg.addEventListener('updatefound', () => {
      const newSW = reg.installing;
      if (!newSW) return;
      newSW.addEventListener('statechange', () => {
        if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
          // Nouvelle version disponible — notifier sans forcer le rechargement
          const banner = document.createElement('div');
          banner.id = '_sw-update-banner';
          banner.style.cssText = 'position:fixed;bottom:80px;left:12px;right:12px;background:var(--teal);color:#fff;border-radius:14px;padding:12px 16px;z-index:9999;display:flex;align-items:center;justify-content:space-between;gap:10px;box-shadow:0 4px 16px rgba(0,0,0,.2)';
          banner.innerHTML = '';
          const txt = document.createElement('span');
          txt.style.cssText = 'font-size:13px;font-weight:600';
          txt.textContent = '🔄 Mise à jour disponible';
          const btn = document.createElement('button');
          btn.style.cssText = 'background:#fff;color:var(--teal);border:none;border-radius:8px;padding:6px 14px;font-weight:700;font-size:12px;cursor:pointer;touch-action:manipulation;-webkit-appearance:none';
          btn.textContent = 'Actualiser';
          btn.ontouchstart = (e) => { e.preventDefault(); window.location.reload(); };
          btn.onclick = () => window.location.reload();
          banner.appendChild(txt); banner.appendChild(btn);
          document.body.appendChild(banner);
          // Auto-dismiss after 30s
          setTimeout(() => banner?.remove(), 30000);
        }
      });
    });
  });
}

/* ── Error boundary — wraps render functions to prevent total crash ── */
(function() {
  const _SAFE_RENDERS = [
    'renderDashboard','renderDayTabs','renderDayDetail','renderSession',
    'renderProgression','renderBilan','renderCorps','renderGoals','updateStats',
  ];

  function _showErrorBanner(fnName, err) {
    // Remove previous banner
    document.getElementById('_err-boundary-banner')?.remove();
    const banner = document.createElement('div');
    banner.id = '_err-boundary-banner';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#c53030;color:#fff;font-size:12px;font-weight:600;padding:8px 14px;z-index:99999;display:flex;align-items:center;justify-content:space-between;gap:10px';
    banner.innerHTML = '';
    const msg = document.createElement('span');
    msg.textContent = 'Erreur dans ' + fnName + ' - Rechargez si l ecran est vide';
    const close = document.createElement('button');
    close.textContent = '✕';
    close.style.cssText = 'background:none;border:none;color:#fff;font-size:14px;cursor:pointer;padding:0 4px';
    close.onclick = () => banner.remove();
    banner.appendChild(msg); banner.appendChild(close);
    document.body.appendChild(banner);
    console.error('[CTP Error Boundary]', fnName, err);
    // Auto-dismiss after 8s
    setTimeout(() => banner?.remove(), 8000);
  }

  // Wrap each render function with try-catch
  window.addEventListener('load', () => {
    _SAFE_RENDERS.forEach(name => {
      const original = window[name];
      if (typeof original !== 'function') return;
      window[name] = function(...args) {
        try {
          return original.apply(this, args);
        } catch(e) {
          _showErrorBanner(name, e);
          // Don't re-throw — prevents total app crash
        }
      };
    });
  });
})();


/* ── PWA Install Guide — iOS Safari ── */
(function() {
  // Ne montrer que sur iOS Safari hors standalone
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isSafari = /safari/i.test(navigator.userAgent) && !/chrome|crios|fxios/i.test(navigator.userAgent);
  const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  const dismissed = localStorage.getItem('_pwa_guide_dismissed');

  if (!isIOS || !isSafari || isStandalone || dismissed) return;

  // Attendre 3s avant d'afficher (laisser l'app se charger)
  setTimeout(() => {
    if (document.getElementById('pwa-install-guide')) return;

    const banner = document.createElement('div');
    banner.id = 'pwa-install-guide';
    banner.style.cssText = [
      'position:fixed', 'bottom:80px', 'left:12px', 'right:12px',
      'background:var(--surface)', 'border-radius:16px',
      'box-shadow:0 4px 24px rgba(0,0,0,.2)',
      'padding:14px 16px', 'z-index:9500',
      'border:1.5px solid var(--teal)',
      'display:flex', 'align-items:flex-start', 'gap:12px',
    ].join(';');

    const icon = document.createElement('div');
    icon.style.cssText = 'font-size:26px;flex-shrink:0;margin-top:2px';
    icon.textContent = '📲';

    const content = document.createElement('div');
    content.style.cssText = 'flex:1;min-width:0';

    const title = document.createElement('div');
    title.style.cssText = 'font-size:13px;font-weight:700;color:var(--text);margin-bottom:4px';
    title.textContent = 'Installer Coach Tracker Pro';

    const steps = document.createElement('div');
    steps.style.cssText = 'font-size:11px;color:var(--muted);line-height:1.6';
    steps.textContent = 'Appuyez sur [icone] Partager en bas de Safari, puis Sur l ecran d accueil';

    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = 'margin-top:8px;padding:6px 14px;border-radius:10px;border:none;background:var(--teal);color:#fff;font-size:12px;font-weight:700;font-family:var(--font);cursor:pointer;touch-action:manipulation;-webkit-appearance:none';
    closeBtn.textContent = 'Compris';
    closeBtn.ontouchstart = (e) => { e.preventDefault(); dismiss(); };
    closeBtn.onclick = dismiss;

    content.appendChild(title); content.appendChild(steps); content.appendChild(closeBtn);

    const x = document.createElement('button');
    x.style.cssText = 'flex-shrink:0;background:none;border:none;color:var(--muted);font-size:18px;cursor:pointer;padding:0;touch-action:manipulation;-webkit-appearance:none;margin-top:-2px';
    x.textContent = '✕';
    x.ontouchstart = (e) => { e.preventDefault(); dismiss(); };
    x.onclick = dismiss;

    function dismiss() {
      banner.remove();
      localStorage.setItem('_pwa_guide_dismissed', '1');
    }

    banner.appendChild(icon); banner.appendChild(content); banner.appendChild(x);
    document.body.appendChild(banner);

    // Arrow pointing down toward Safari share button
    const arrow = document.createElement('div');
    arrow.style.cssText = 'position:absolute;bottom:-10px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:10px solid transparent;border-right:10px solid transparent;border-top:10px solid var(--teal)';
    banner.style.position = 'fixed';
    banner.appendChild(arrow);

  }, 3000);
})();

const _startTab = S._currentTab || 'weekly';
setTimeout(() => Router.navigate(_startTab), 0);

/* ── Activer le stockage persistant + charger depuis IDB si disponible ── */
(async () => {
  if (typeof IDBStorage === 'undefined') return;
  await IDBStorage.requestPersistent();
  if (typeof Persist !== 'undefined' && typeof Persist.loadFromIDB === 'function') {
    await Persist.loadFromIDB();
  }
})();

/* ── Mise à jour automatique du programme si nouvelle version PA ── */
(function() {
  try {
    const storedVersion = localStorage.getItem('ctp_pa_version');
    if (storedVersion !== _PA_VERSION) {
      // Nouvelle version du programme détectée
      // Réinitialiser les jours de la semaine courante depuis le nouveau PA
      // en préservant l'historique et les données déjà saisies cette semaine
      const hasCompletedSets = (S.days || []).some(d =>
        (d.exercises || []).some(e => e.done || (e.setData && e.setData.some && e.setData.some(s => s.reps)))
      );

      if (!hasCompletedSets) {
        // Aucune série complétée cette semaine → reset propre
        S.days = Array.from({length: 7}, (_, i) => mkDay(i, S.weekType || 'A'));
        save();
        console.log('[CTP] Programme mis à jour vers', _PA_VERSION);
      } else {
        // Des séries ont été faites → proposer via toast (non-destructif)
        setTimeout(() => {
          showToast(
            'Nouveau programme disponible. Archivez la semaine pour l\'appliquer.',
            'save', 5000
          );
        }, 2000);
      }
      localStorage.setItem('ctp_pa_version', _PA_VERSION);
    }
  } catch(e) {
    console.warn('[CTP] Version check failed:', e);
  }
})();

/* ── 9. PWA manifest dynamique ── */
const _manifest = {
  name: 'Coach Tracker Pro',
  short_name: 'CTP',
  start_url: '.',
  display: 'standalone',
  background_color: '#f2f4f7',
  theme_color: '#5ba8a0',
  icons: [{
    src: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🏋️</text></svg>',
    type: 'image/svg+xml',
    sizes: 'any'
  }]
};
const _blob = new Blob([JSON.stringify(_manifest)], { type: 'application/json' });
const _ml = document.getElementById('pwa-manifest');
if (_ml) _ml.href = URL.createObjectURL(_blob);
