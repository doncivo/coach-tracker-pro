/* ================================================================
   core/router.js — Routeur de navigation Coach Tracker Pro

   Responsabilités:
   - Gérer l'onglet actif (activation du pane DOM)
   - Synchroniser la bottom nav et le top nav
   - Appeler le renderer de la vue active
   - Gérer le swipe entre onglets
   - Persister l'onglet courant via Store

   Usage:
     Router.register('dashboard', () => renderDashboard());
     Router.navigate('dashboard');
     Router.current();   // → 'dashboard'
     Router.back();
     Router.next();
   ================================================================ */

const Router = (() => {

  /* ─────────────────────────────────────────────
     ÉTAT INTERNE
  ───────────────────────────────────────────── */
  let _routes      = {};   // { tabName: renderFn }
  let _current     = null;
  let _history     = [];   // pile de navigation
  let _renderCache = {};   // { 'tab-hash-X': lastHash } — évite re-renders inutiles
  let _initialized = false;

  // Swipe
  let _swipeStartX  = 0;
  let _swipeStartY  = 0;
  let _swipeActive  = false;
  const SWIPE_THRESHOLD = 60; // px min pour déclencher

  /* ─────────────────────────────────────────────
     ENREGISTREMENT DES ROUTES
  ───────────────────────────────────────────── */
  function register(tabName, renderFn) {
    if (typeof renderFn !== 'function') {
      console.warn('[Router] register() : renderFn doit être une fonction pour', tabName);
      return;
    }
    _routes[tabName] = renderFn;
  }

  /* ─────────────────────────────────────────────
     NAVIGATION
  ───────────────────────────────────────────── */
  function navigate(tabName, opts) {
    opts = opts || {};

    if (!tabName) return;
    if (!_routes[tabName] && !opts.force) {
      console.warn('[Router] navigate() : onglet non enregistré :', tabName);
      return;
    }

    // Sauvegarder dans l'historique
    if (_current && _current !== tabName) {
      _history.push(_current);
      if (_history.length > 20) _history.shift();
    }

    _current = tabName;

    // 1. Désactiver tous les panes
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.bnav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.bnav-more-btn').forEach(b => b.classList.remove('active'));

    // 2. Activer le pane cible
    const pane = document.getElementById('tab-' + tabName);
    if (pane) pane.classList.add('active');

    // 3. Sync top nav
    const topBtn = document.querySelector('.tab-btn[data-tab="' + tabName + '"]');
    if (topBtn) topBtn.classList.add('active');

    // 4. Sync bottom nav
    const bnavBtn = document.querySelector('.bnav-btn[data-tab="' + tabName + '"]');
    if (bnavBtn) {
      bnavBtn.classList.add('active');
    } else {
      // Dans le drawer "Plus"
      const moreBtn = document.querySelector('.bnav-more-btn[data-tab="' + tabName + '"]');
      if (moreBtn) moreBtn.classList.add('active');
      const moreBtnMain = document.getElementById('bnav-more-btn');
      if (moreBtnMain) moreBtnMain.classList.add('active');
    }

    // 5. Fermer le menu "Plus"
    const mm = document.getElementById('bnav-more-menu');
    if (mm) mm.classList.remove('open');
    const mb = document.getElementById('bnav-more-btn');
    if (mb) mb.setAttribute('aria-expanded', 'false');
    const bd = document.getElementById('bnav-backdrop');
    if (bd) bd.style.display = 'none';

    // 6. Gérer Corps (sous-nav spéciale)
    if (tabName === 'corps') {
      document.querySelectorAll('.corps-subbtn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.corps-section').forEach(s => s.classList.remove('active'));
      const nutritionBtn  = document.querySelector('.corps-subbtn[data-corps="nutrition"]');
      const nutritionSect = document.getElementById('corps-sect-nutrition');
      if (nutritionBtn)  nutritionBtn.classList.add('active');
      if (nutritionSect) nutritionSect.classList.add('active');
      if (typeof initCorpsSubNav === 'function') initCorpsSubNav();
    }

    // 7. Persister dans le store
    if (typeof Store !== 'undefined') {
      Store.dispatch({ type: 'APP_SET_TAB', payload: tabName }, { skipUndo: true });
    } else if (typeof S !== 'undefined') {
      S._currentTab = tabName; // compat legacy
    }

    // 8. Appeler le renderer — avec cache basé sur hash d'état
    if (_routes[tabName]) {
      try {
        // Calculer un hash léger de l'état pour éviter les re-renders inutiles
        const _state   = (typeof Store !== 'undefined') ? Store.getState() : null;
        const _hashKey = 'tab-hash-' + tabName;
        let   _hash    = null;

        if (_state) {
          // Hash basé sur les données pertinentes pour chaque onglet
          const _relevant = {
            dashboard:   [_state.training?.weekCount, _state.activity?.steps, _state.body?.mesures?.poids?.length, Date.now() >> 13],
            weekly:      [JSON.stringify(_state.training?.days?.map(d => [d.exercises?.length, d.exercises?.filter(e=>e.done).length]))],
            session:     [_state.training?.sessDay, JSON.stringify(_state.training?.days?.[_state.training?.sessDay]?.exercises?.map(e=>[e.done,e.repsAchieved]))],
            progression: [Object.keys(_state.training?.history||{}).length, _state.training?.weekCount],
            corps:       [_state.body?.mesures?.poids?.length, _state.activity?.steps, Date.now() >> 14],
            bilan:       [_state.training?.weekCount, _state.app?.bilanOffset],
            achievements:[_state.app?.weekCount, JSON.stringify(_state.app?.achievements)],
          };
          const _parts = _relevant[tabName];
          if (_parts) _hash = _parts.join('|');
        }

        const _prevHash = _renderCache[_hashKey];
        if (_hash && _hash === _prevHash && !opts.force) {
          // État identique — skip le re-render complet
        } else {
          if (_hash) _renderCache[_hashKey] = _hash;
          _routes[tabName]();
        }
      } catch(e) {
        console.error('[Router] Erreur rendu de', tabName, ':', e);
      }
    }
  }

  /* ─────────────────────────────────────────────
     NAVIGATION RELATIVE
  ───────────────────────────────────────────── */
  function back() {
    if (_history.length === 0) return;
    const prev = _history.pop();
    navigate(prev);
  }

  function next() {
    const tabs = Object.keys(_routes);
    const idx  = tabs.indexOf(_current);
    if (idx < tabs.length - 1) navigate(tabs[idx + 1]);
  }

  function prev() {
    const tabs = Object.keys(_routes);
    const idx  = tabs.indexOf(_current);
    if (idx > 0) navigate(tabs[idx - 1]);
  }

  /* ─────────────────────────────────────────────
     SWIPE GESTURE (mobile)
  ───────────────────────────────────────────── */

  // Vérifie si un élément (ou un de ses parents) est scrollable horizontalement
  function _isHorizontallyScrollable(el) {
    while (el && el !== document.body) {
      const style    = window.getComputedStyle(el);
      const overflow = style.overflowX;
      const canScroll = overflow === 'auto' || overflow === 'scroll';
      if (canScroll && el.scrollWidth > el.clientWidth) return true;
      el = el.parentElement;
    }
    return false;
  }

  // Vérifie si le touch vient d'un élément interactif (input, select, bouton, etc.)
  function _isInteractiveElement(el) {
    const tags = ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'A'];
    while (el && el !== document.body) {
      if (tags.includes(el.tagName)) return true;
      if (el.getAttribute('contenteditable') === 'true') return true;
      el = el.parentElement;
    }
    return false;
  }

  let _swipeOriginEl = null; // élément source du touch

  function _initSwipe() {
    document.addEventListener('touchstart', e => {
      _swipeOriginEl = e.target;
      _swipeStartX   = e.touches[0].clientX;
      _swipeStartY   = e.touches[0].clientY;

      // Désactiver immédiatement si l'élément est interactif ou scrollable
      if (_isInteractiveElement(_swipeOriginEl) || _isHorizontallyScrollable(_swipeOriginEl)) {
        _swipeActive = false;
      } else {
        _swipeActive = true;
      }
    }, { passive: true });

    document.addEventListener('touchmove', e => {
      if (!_swipeActive) return;
      const dx = e.touches[0].clientX - _swipeStartX;
      const dy = e.touches[0].clientY - _swipeStartY;
      // Annuler si scroll vertical dominant
      if (Math.abs(dy) > Math.abs(dx) * 1.5) {
        _swipeActive = false;
      }
      // Annuler si on glisse sur un conteneur scrollable (détection en cours de mouvement)
      if (_swipeActive && _isHorizontallyScrollable(_swipeOriginEl)) {
        _swipeActive = false;
      }
    }, { passive: true });

    document.addEventListener('touchend', e => {
      if (!_swipeActive) return;
      _swipeActive = false;

      const dx = e.changedTouches[0].clientX - _swipeStartX;
      const dy = e.changedTouches[0].clientY - _swipeStartY;

      // Ignorer si scroll vertical
      if (Math.abs(dy) > Math.abs(dx) * 1.5) return;
      if (Math.abs(dx) < SWIPE_THRESHOLD) return;

      const tabs = Object.keys(_routes);
      const idx  = tabs.indexOf(_current);

      if (dx < 0 && idx < tabs.length - 1) {
        navigate(tabs[idx + 1]); // swipe gauche → suivant
      } else if (dx > 0 && idx > 0) {
        navigate(tabs[idx - 1]); // swipe droite → précédent
      }
    }, { passive: true });
  }

  /* ─────────────────────────────────────────────
     INIT — event listeners nav
  ───────────────────────────────────────────── */
  function init() {
    if (_initialized) return;
    _initialized = true;

    // Bottom nav — boutons principaux
    document.querySelectorAll('.bnav-btn[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => navigate(btn.getAttribute('data-tab')));
    });

    // Bottom nav — drawer "Plus" (items)
    // iOS Safari fix: touchend sur les boutons du drawer
    document.querySelectorAll('.bnav-more-btn[data-tab]').forEach(btn => {
      let _drawerTouchHandled = false;
      btn.addEventListener('touchend', function(e) {
        _drawerTouchHandled = true;
        e.preventDefault();
        navigate(btn.getAttribute('data-tab'));
      }, { passive: false });
      btn.addEventListener('click', function(e) {
        if (_drawerTouchHandled) { _drawerTouchHandled = false; return; }
        navigate(btn.getAttribute('data-tab'));
      });
    });

    // Top nav (desktop)
    document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => navigate(btn.getAttribute('data-tab')));
    });

    // Bouton "Plus" (ouvrir/fermer drawer)
    // iOS Safari fix: touchend + preventDefault évite les problèmes de click sur position:fixed
    const moreBtnToggle = document.getElementById('bnav-more-btn');
    if (moreBtnToggle) {
      let _plusTouchHandled = false;

      function _toggleMoreMenu(e) {
        e.stopPropagation();
        const menu = document.getElementById('bnav-more-menu');
        if (!menu) return;
        const isOpen = menu.classList.toggle('open');
        moreBtnToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        const bd = document.getElementById('bnav-backdrop');
        if (bd) bd.style.display = isOpen ? 'block' : 'none';
      }

      // touchend → prioritaire sur iOS (évite le délai 300ms et les bugs click/fixed)
      moreBtnToggle.addEventListener('touchend', function(e) {
        _plusTouchHandled = true;
        e.preventDefault(); // empêche le click synthétique iOS de se déclencher aussi
        _toggleMoreMenu(e);
      }, { passive: false });

      // click → fallback desktop (ignoré si touchend a déjà géré)
      moreBtnToggle.addEventListener('click', function(e) {
        if (_plusTouchHandled) { _plusTouchHandled = false; return; }
        _toggleMoreMenu(e);
      });
    }

    // Backdrop — fermer le drawer
    const _backdrop = document.createElement('div');
    _backdrop.id    = 'bnav-backdrop';
    _backdrop.style.cssText = 'display:none;position:fixed;inset:0;z-index:8999;background:transparent';
    _backdrop.addEventListener('click', function() {
      const menu = document.getElementById('bnav-more-menu');
      const btn  = document.getElementById('bnav-more-btn');
      if (menu) menu.classList.remove('open');
      if (btn)  btn.setAttribute('aria-expanded', 'false');
      _backdrop.style.display = 'none';
    });
    document.body.appendChild(_backdrop);

    // Fermer aussi sur Escape (desktop)
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        const menu = document.getElementById('bnav-more-menu');
        const btn  = document.getElementById('bnav-more-btn');
        if (menu && menu.classList.contains('open')) {
          menu.classList.remove('open');
          if (btn) btn.setAttribute('aria-expanded', 'false');
          const bd = document.getElementById('bnav-backdrop');
          if (bd) bd.style.display = 'none';
        }
      }
    });

    // Bouton de recherche globale
    const searchBtn = document.getElementById('search-btn');
    if (searchBtn) {
      let _searchTouched = false;
      searchBtn.addEventListener('touchend', function(e) {
        _searchTouched = true;
        e.preventDefault();
        if (typeof Search !== 'undefined') Search.open();
      }, { passive: false });
      searchBtn.addEventListener('click', function() {
        if (_searchTouched) { _searchTouched = false; return; }
        if (typeof Search !== 'undefined') Search.open();
      });
    }

    // Swipe mobile
    _initSwipe();
  }

  /* ─────────────────────────────────────────────
     API PUBLIQUE
  ───────────────────────────────────────────── */
  return {
    /** Enregistrer une route: Router.register('dashboard', renderDashboard) */
    register,

    /** Naviguer vers un onglet */
    navigate,

    /** Forcer un re-render du tab courant (invalide le cache) */
    invalidate(tabName) {
      if (tabName) delete _renderCache['tab-hash-' + tabName];
      else _renderCache = {};
    },

    /** Onglet courant */
    current() { return _current; },

    /** Historique de navigation */
    history() { return [..._history]; },

    /** Retour arrière */
    back,

    /** Onglet suivant dans l'ordre d'enregistrement */
    next,

    /** Onglet précédent */
    prev,

    /** Initialiser les event listeners (appeler au DOMContentLoaded) */
    init,

    /** Lister toutes les routes enregistrées */
    routes() { return Object.keys(_routes); },

    /** Vérifier si une route existe */
    has(tabName) { return tabName in _routes; },
  };

})();
