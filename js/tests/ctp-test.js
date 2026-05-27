/* ================================================================
   js/tests/ctp-test.js — Module de tests automatisés Coach Tracker Pro

   Usage (console du navigateur) :
     CTPTest.run()           // tous les tests
     CTPTest.run('timer')    // groupe spécifique
     CTPTest.run('ios')      // tests compatibilité iOS

   Usage (Node.js simulation) :
     node js/tests/ctp-test.js

   Tests disponibles :
   - timer    : RestTimer (démarrage, tick, fin, boutons)
   - ios      : Compatibilité iOS (z-index, touch-action, user-select)
   - sw       : Service Worker (version cache, assets)
   - store    : Store (dispatch, state)
   - nav      : Navigation (router, swipe)
   ================================================================ */

const CTPTest = (() => {
  'use strict';

  /* ── Résultats ── */
  const _results = { pass: 0, fail: 0, skip: 0, log: [] };

  function _log(icon, name, msg) {
    const line = `${icon} ${name}${msg ? ' — ' + msg : ''}`;
    _results.log.push(line);
    if (typeof console !== 'undefined') console.log(line);
  }

  function pass(name, msg)  { _results.pass++; _log('✅', name, msg); }
  function fail(name, msg)  { _results.fail++; _log('❌', name, msg); }
  function skip(name, msg)  { _results.skip++; _log('⏭', name, msg);  }
  function info(name, msg)  { _log('ℹ️', name, msg); }

  /* ══════════════════════════════════════════════════════════════
     MOCK DOM (pour simulation sans navigateur)
  ══════════════════════════════════════════════════════════════ */
  function _createMockDOM() {
    const elements = {};
    const listeners = {};

    function el(id, tag = 'div') {
      const mock = {
        id,
        tagName: tag.toUpperCase(),
        style: {},
        classList: {
          _classes: new Set(),
          add(...c)    { c.forEach(x => mock.classList._classes.add(x)); },
          remove(...c) { c.forEach(x => mock.classList._classes.delete(x)); },
          toggle(c, force) {
            if (force !== undefined) force ? mock.classList.add(c) : mock.classList.remove(c);
            else mock.classList._classes.has(c) ? mock.classList.remove(c) : mock.classList.add(c);
          },
          contains(c) { return mock.classList._classes.has(c); },
        },
        textContent: '',
        innerHTML: '',
        ontouchstart: null,
        onclick: null,
        dataset: {},
        _listeners: {},
        addEventListener(ev, fn, opts) {
          if (!mock._listeners[ev]) mock._listeners[ev] = [];
          mock._listeners[ev].push(fn);
        },
        dispatchEvent(type, detail = {}) {
          const fns = mock._listeners[type] || [];
          fns.forEach(fn => fn({ type, target: mock, preventDefault: ()=>{}, stopPropagation: ()=>{}, ...detail }));
          if (type === 'touchstart' && mock.ontouchstart) mock.ontouchstart({ type, target: mock, preventDefault: ()=>{}, stopPropagation: ()=>{} });
          if (type === 'click' && mock.onclick) mock.onclick({ type, target: mock });
        },
      };
      elements[id] = mock;
      return mock;
    }

    // Créer tous les éléments du timer
    el('rest-timer-overlay');
    el('rest-timer-card');
    el('rest-timer-ex-name');
    el('rest-timer-time');
    el('rest-ring-fill');
    el('rest-timer-skip', 'button');
    el('rest-timer-next', 'button');
    el('rest-timer-add-btn', 'button');

    // Presets
    ['45','90','120','180'].forEach(sec => {
      const btn = el(`preset-${sec}`, 'button');
      btn.dataset.sec = sec;
      btn.classList._presetSec = sec;
    });

    return {
      getElementById: (id) => elements[id] || null,
      querySelectorAll: (sel) => {
        if (sel === '.rest-timer-preset') {
          return ['45','90','120','180'].map(s => elements[`preset-${s}`]);
        }
        return [];
      },
      elements,
    };
  }

  /* ══════════════════════════════════════════════════════════════
     GROUPE : TIMER
  ══════════════════════════════════════════════════════════════ */
  function _testTimer() {
    info('TIMER', 'Tests du RestTimer');

    // Test 1 : RestTimer existe
    if (typeof RestTimer === 'undefined') {
      fail('timer:exists', 'RestTimer non défini — render_dashboard.js non chargé');
      return;
    }
    pass('timer:exists', 'RestTimer défini');

    // Test 2 : Méthodes requises
    const methods = ['start', 'stop', 'addTime', 'setDuration', '_bindButtons', '_tick', '_finish', '_render'];
    methods.forEach(m => {
      if (typeof RestTimer[m] === 'function') pass(`timer:method:${m}`);
      else fail(`timer:method:${m}`, `méthode ${m} manquante`);
    });

    // Test 3 : État initial
    if (RestTimer._interval === null) pass('timer:initial:interval');
    else fail('timer:initial:interval', 'interval devrait être null');

    if (RestTimer._autoCloseTimer === null || RestTimer._autoCloseTimer === undefined)
      pass('timer:initial:autoclose');
    else fail('timer:initial:autoclose', 'autoCloseTimer devrait être null');

    // Test 4 : Vérifier que _bindButtons est dans start()
    const startSrc = RestTimer.start.toString();
    if (startSrc.includes('_bindButtons')) pass('timer:binds-in-start', '_bindButtons() appelé dans start()');
    else fail('timer:binds-in-start', '_bindButtons() non appelé dans start() — les boutons ne seront pas liés');

    // Test 5 : Vérifier que _bindButtons utilise ontouchstart
    const bindSrc = RestTimer._bindButtons.toString();
    if (bindSrc.includes('ontouchstart')) pass('timer:ontouchstart', 'ontouchstart utilisé dans _bindButtons');
    else fail('timer:ontouchstart', 'ontouchstart manquant — boutons iOS non fonctionnels');

    // Test 6 : Auto-close dans _finish
    const finishSrc = RestTimer._finish.toString();
    if (finishSrc.includes('autoCloseTimer') || finishSrc.includes('setTimeout')) pass('timer:autoclose', 'auto-fermeture présente dans _finish');
    else fail('timer:autoclose', 'auto-fermeture manquante dans _finish');

    // Test 7 : stop() nettoie les timers
    const stopSrc = RestTimer.stop.toString();
    if (stopSrc.includes('clearInterval') && stopSrc.includes('clearTimeout'))
      pass('timer:stop:cleanup');
    else fail('timer:stop:cleanup', 'stop() ne nettoie pas tous les timers');

    // Test 8 : Simulation démarrage timer (si DOM disponible)
    if (typeof document !== 'undefined') {
      const overlay = document.getElementById('rest-timer-overlay');
      if (overlay) {
        const prevDisplay = overlay.style.display;
        try {
          RestTimer.stop(); // reset
          RestTimer.start(5, 'Test Exercise', null);
          if (overlay.style.display === 'flex') pass('timer:start:overlay-visible');
          else fail('timer:start:overlay-visible', `display=${overlay.style.display}`);

          if (RestTimer._remaining === 5) pass('timer:start:remaining');
          else fail('timer:start:remaining', `remaining=${RestTimer._remaining}`);

          // Vérifier que ontouchstart est lié
          const skipBtn = document.getElementById('rest-timer-skip');
          if (skipBtn && typeof skipBtn.ontouchstart === 'function')
            pass('timer:start:skip-bound');
          else fail('timer:start:skip-bound', 'rest-timer-skip.ontouchstart non lié');

          const nextBtn = document.getElementById('rest-timer-next');
          if (nextBtn && typeof nextBtn.ontouchstart === 'function')
            pass('timer:start:next-bound');
          else fail('timer:start:next-bound', 'rest-timer-next.ontouchstart non lié');

          // Simuler tap sur Passer
          let stopped = false;
          const origStop = RestTimer.stop.bind(RestTimer);
          RestTimer.stop = function() { stopped = true; origStop(); };
          if (skipBtn && skipBtn.ontouchstart) {
            skipBtn.ontouchstart({ preventDefault: ()=>{}, stopPropagation: ()=>{} });
            if (stopped) pass('timer:tap:skip-works', 'tap sur Passer = timer stoppé');
            else fail('timer:tap:skip-works', 'tap sur Passer sans effet');
          }
          RestTimer.stop = origStop;

        } catch(e) {
          fail('timer:start:error', e.message);
        }
      } else {
        skip('timer:dom', 'overlay DOM non trouvé');
      }
    } else {
      skip('timer:dom', 'pas de DOM (Node.js)');
    }
  }

  /* ══════════════════════════════════════════════════════════════
     GROUPE : iOS COMPAT
  ══════════════════════════════════════════════════════════════ */
  function _testIOS() {
    info('IOS', 'Tests compatibilité iOS Safari');

    if (typeof document === 'undefined' || typeof getComputedStyle === 'undefined') {
      skip('ios', 'DOM et getComputedStyle requis — lancez depuis le navigateur');
      return;
    }

    // Test 1 : z-index timer overlay
    const overlay = document.getElementById('rest-timer-overlay');
    if (overlay) {
      const zIdx = parseInt(overlay.style.zIndex || getComputedStyle(overlay).zIndex || '0');
      if (zIdx >= 9000) pass('ios:zindex', `z-index=${zIdx} (≥9000 requis)`);
      else fail('ios:zindex', `z-index=${zIdx} trop bas — peut être bloqué par backdrop (8999)`);

      // Test 2 : backdrop-filter absent (cause bug iOS)
      const bf = overlay.style.backdropFilter || getComputedStyle(overlay).backdropFilter || '';
      if (!bf || bf === 'none') pass('ios:no-backdrop-filter', 'backdrop-filter absent ✓');
      else fail('ios:no-backdrop-filter', `backdrop-filter="${bf}" présent — bug iOS connu`);
    } else {
      fail('ios:overlay', 'rest-timer-overlay non trouvé dans le DOM');
    }

    // Test 3 : touch-action sur les boutons
    ['rest-timer-skip', 'rest-timer-next', 'rest-timer-add-btn'].forEach(id => {
      const btn = document.getElementById(id);
      if (!btn) { fail(`ios:touch-action:${id}`, 'bouton non trouvé'); return; }
      const ta = getComputedStyle(btn).touchAction;
      if (ta === 'manipulation') pass(`ios:touch-action:${id}`, `touch-action=${ta}`);
      else fail(`ios:touch-action:${id}`, `touch-action="${ta}" — doit être "manipulation"`);
    });

    // Test 4 : -webkit-appearance sur les boutons
    ['rest-timer-skip', 'rest-timer-next'].forEach(id => {
      const btn = document.getElementById(id);
      if (!btn) return;
      const wa = getComputedStyle(btn).webkitAppearance || '';
      if (wa === 'none' || wa === '') pass(`ios:appearance:${id}`);
      else info(`ios:appearance:${id}`, `webkitAppearance=${wa}`);
    });

    // Test 5 : Overlay position:fixed et TRBL explicites
    if (overlay) {
      const cs = getComputedStyle(overlay);
      if (cs.position === 'fixed') pass('ios:position-fixed');
      else fail('ios:position-fixed', `position=${cs.position}`);
    }
  }

  /* ══════════════════════════════════════════════════════════════
     GROUPE : SERVICE WORKER
  ══════════════════════════════════════════════════════════════ */
  function _testSW() {
    info('SW', 'Tests Service Worker');

    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      skip('sw', 'Service Worker non disponible');
      return;
    }

    navigator.serviceWorker.getRegistrations().then(regs => {
      if (regs.length === 0) {
        info('sw:registrations', 'Aucun SW enregistré');
        return;
      }

      regs.forEach(reg => {
        const scope = reg.scope;
        const isCTP = scope.includes('coach-tracker-pro');
        if (isCTP) pass('sw:ctp-registered', `scope=${scope}`);
        else fail('sw:foreign-sw', `SW étranger: scope=${scope} — peut interférer`);

        const sw = reg.active || reg.installing || reg.waiting;
        if (sw) {
          const scriptURL = sw.scriptURL;
          if (scriptURL.includes('sw.js')) pass('sw:correct-script', scriptURL);
          else fail('sw:correct-script', `Script inattendu: ${scriptURL}`);
        }
      });
    });
  }

  /* ══════════════════════════════════════════════════════════════
     GROUPE : NAVIGATION
  ══════════════════════════════════════════════════════════════ */
  function _testNav() {
    info('NAV', 'Tests Router et navigation');

    if (typeof Router === 'undefined') {
      fail('nav:router', 'Router non défini');
      return;
    }
    pass('nav:router', 'Router défini');

    // Méthodes
    ['navigate', 'register', 'init', 'current', 'back'].forEach(m => {
      if (typeof Router[m] === 'function') pass(`nav:${m}`);
      else fail(`nav:${m}`, `méthode ${m} manquante`);
    });

    // Swipe - vérifier que les scrollables sont ignorés
    const swipeSrc = Router.init.toString();
    if (swipeSrc.includes('isHorizontallyScrollable') || swipeSrc.includes('scrollWidth'))
      pass('nav:swipe-scroll-check', 'swipe ignore les conteneurs scrollables');
    else fail('nav:swipe-scroll-check', 'swipe peut naviguer accidentellement sur tableaux');
  }

  /* ══════════════════════════════════════════════════════════════
     GROUPE : STORE
  ══════════════════════════════════════════════════════════════ */
  function _testStore() {
    info('STORE', 'Tests Store');

    if (typeof Store === 'undefined') {
      fail('store:exists', 'Store non défini');
      return;
    }
    pass('store:exists');

    ['dispatch', 'getState', 'load'].forEach(m => {
      if (typeof Store[m] === 'function') pass(`store:${m}`);
      else fail(`store:${m}`, `méthode ${m} manquante`);
    });

    // Test dispatch APP_SET_TAB
    try {
      const before = Store.getState().app._currentTab || 'weekly';
      Store.dispatch({ type: 'APP_SET_TAB', payload: 'dashboard' }, { skipUndo: true });
      const after = Store.getState().app._currentTab;
      if (after === 'dashboard') pass('store:dispatch', 'APP_SET_TAB fonctionne');
      else fail('store:dispatch', `tab non mis à jour: ${after}`);
      // Toujours restaurer
      Store.dispatch({ type: 'APP_SET_TAB', payload: before }, { skipUndo: true });
    } catch(e) {
      fail('store:dispatch', e.message);
    }
  }

  /* ══════════════════════════════════════════════════════════════
     RUNNER PRINCIPAL
  ══════════════════════════════════════════════════════════════ */
  function run(group) {
    _results.pass = 0;
    _results.fail = 0;
    _results.skip = 0;
    _results.log  = [];

    const groups = {
      timer: _testTimer,
      ios:   _testIOS,
      sw:    _testSW,
      nav:   _testNav,
      store: _testStore,
    };

    console.log('');
    console.log('════════════════════════════════════');
    console.log('  CTP Test Suite');
    console.log('════════════════════════════════════');

    if (group && groups[group]) {
      groups[group]();
    } else {
      Object.values(groups).forEach(fn => fn());
    }

    console.log('');
    console.log('════════════════════════════════════');
    console.log(`  ✅ ${_results.pass} passés`);
    console.log(`  ❌ ${_results.fail} échoués`);
    console.log(`  ⏭  ${_results.skip} ignorés`);
    console.log('════════════════════════════════════');

    if (_results.fail > 0) {
      console.warn(`⚠️  ${_results.fail} test(s) échoué(s) — NE PAS DÉPLOYER`);
    } else {
      console.log('🚀 Tous les tests passent — OK pour déployer');
    }

    return { pass: _results.pass, fail: _results.fail, skip: _results.skip };
  }

  // Auto-run si ?test=1 dans l'URL
  if (typeof window !== 'undefined' && window.location?.search?.includes('test=1')) {
    window.addEventListener('DOMContentLoaded', () => setTimeout(() => run(), 500));
  }

  return { run };

})();

// Accessible depuis la console du navigateur
if (typeof window !== 'undefined') window.CTPTest = CTPTest;
