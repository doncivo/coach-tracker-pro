/* ================================================================
   services/persist.js — Persistance centralisée

   Responsabilités:
   - save()         : sérialiser le Store → localStorage (debounce 400ms)
   - load()         : désérialiser localStorage → Store
   - migrateState() : migrations de schema (v1→v2→v3→...)
   - exportData()   : télécharger un JSON de sauvegarde
   - importData()   : importer un JSON de sauvegarde
   - exportCSV()    : exporter l'historique en CSV

   RÈGLE: save() n'est appelé QUE depuis Store.dispatch().
   Aucun autre module ne doit l'appeler directement.
   ================================================================ */

const Persist = (() => {

  /* ─────────────────────────────────────────────
     CONSTANTES
  ───────────────────────────────────────────── */
  const STORAGE_KEY   = 'ctp_v3';
  const UNDO_KEY      = 'ctp_undo';
  const AUTOSAVE_KEY  = 'lastAutoSave';
  const SCHEMA_VER    = typeof SCHEMA_VERSION !== 'undefined' ? SCHEMA_VERSION : 3;
  const DEBOUNCE_MS   = 400;
  const UNDO_LIMIT    = 10;

  let _saveTimer = null;

  /* ─────────────────────────────────────────────
     SÉRIALISATION — Store → objet plat (compat ctp_v3)
  ───────────────────────────────────────────── */
  function _flatten(state) {
    return Object.assign(
      {},
      state.training,
      state.activity,
      state.body,
      state.goals,
      state.app
    );
  }

  /* ─────────────────────────────────────────────
     SAVE — debounce 400ms, indicateur visuel
  ───────────────────────────────────────────── */
  function save(state, opts) {
    opts = opts || {};

    // Undo snapshot (sauf si skipUndo)
    if (!opts.skipUndo) {
      _saveUndo(state);
    }

    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(() => {
      _writeToDisk(state);
    }, DEBOUNCE_MS);
  }

  function _writeToDisk(state) {
    try {
      const flat = _flatten(state);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(flat));
      _showSaveBadge();
    } catch(e) {
      if (e.name === 'QuotaExceededError' || e.code === 22) {
        _handleQuotaExceeded(state);
      } else {
        Errors.error('Erreur sauvegarde localStorage', 'persist.js', e.message);
      }
    }
  }

  function _handleQuotaExceeded(state) {
    const histKeys = Object.keys(state.training.history || {}).sort();
    if (histKeys.length > 20) {
      // Pruner les 5 plus anciennes semaines
      const pruned = Object.assign({}, state.training.history);
      histKeys.slice(0, 5).forEach(k => delete pruned[k]);
      Store.dispatch({
        type: 'TRAINING_ARCHIVE_WEEK',
        payload: { history: pruned, weekCount: state.training.weekCount }
      }, { skipUndo: true });
      if (typeof showToast === 'function')
        showToast('⚠️ Stockage plein — 5 semaines anciennes supprimées.', 'warn', 5000);
    } else {
      if (typeof showToast === 'function')
        showToast('❌ Stockage localStorage plein. Exportez vos données.', 'error', 6000);
    }
  }

  function _showSaveBadge() {
    const b = document.getElementById('save-badge');
    if (b) {
      b.classList.add('show');
      setTimeout(() => b.classList.remove('show'), 1200);
    }
  }

  /* ─────────────────────────────────────────────
     UNDO STACK
  ───────────────────────────────────────────── */
  function _saveUndo(state) {
    try {
      const snapshot = JSON.stringify({
        days:    (state.training.days || []).map(d => Object.assign({}, d)),
        history: state.training.history
      });
      const stack = JSON.parse(localStorage.getItem(UNDO_KEY) || '[]');
      stack.push(snapshot);
      if (stack.length > UNDO_LIMIT) stack.shift();
      localStorage.setItem(UNDO_KEY, JSON.stringify(stack));
    } catch(_) { /* undo non critique */ }
  }

  function loadUndoStack() {
    try {
      return JSON.parse(localStorage.getItem(UNDO_KEY) || '[]');
    } catch(_) { return []; }
  }

  /* ─────────────────────────────────────────────
     LOAD — localStorage → state structuré
  ───────────────────────────────────────────── */
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed  = JSON.parse(raw);
      const migrated = migrateState(parsed);
      return migrated;
    } catch(e) {
      Errors.error('Erreur chargement données', 'persist.js', e.message);
      if (typeof showToast === 'function')
        showToast('⚠️ Erreur de chargement — données réinitialisées.', 'error', 5000);
      return null;
    }
  }

  /* ─────────────────────────────────────────────
     MIGRATIONS DE SCHEMA
  ───────────────────────────────────────────── */
  function migrateState(raw) {
    if (!raw) return raw;
    const v = raw._schemaVersion || 1;
    let s = Object.assign({}, raw);

    // v1 → v2: sleep, nutrition, painLog, achievements, objective
    if (v < 2) {
      s.sleep        = s.sleep        || {};
      s.nutrition    = s.nutrition    || {};
      s.painLog      = s.painLog      || [];
      s.achievements = s.achievements || {};
      s.objective    = s.objective    || {
        text: '', targetDate: '', targetWeight: '', targetExercise: '', targetLoad: ''
      };
    }

    // v2 → v3: isWarmup, supersetGroup, tempo, rir, id, nouveaux champs
    if (v < 3) {
      s.currentBlock  = s.currentBlock  || 'Accumulation';
      s.steps         = s.steps         || {};
      s.calories      = s.calories      || {};
      s.stepsGoal     = s.stepsGoal     || 10000;
      s.caloriesGoal  = s.caloriesGoal  || 2500;
      s.blockWeek     = s.blockWeek     || 1;
      s.profilTaille  = s.profilTaille  || 175;

      const assignIds = (days) => (days || []).forEach(d =>
        (d.exercises || []).forEach(ex => {
          if (!ex.id) ex.id = typeof uid === 'function' ? uid() : Math.random().toString(36).slice(2);
          if (ex.isWarmup    === undefined) ex.isWarmup    = false;
          if (!ex.supersetGroup)             ex.supersetGroup = '';
          if (!ex.tempo)                     ex.tempo        = '';
          if (!ex.rir)                       ex.rir          = '';
        })
      );
      assignIds(s.days);
      Object.values(s.history || {}).forEach(wk => assignIds(wk.days || []));
    }

    // Garanties sur les champs profil (toutes versions)
    s._schemaVersion = SCHEMA_VER;
    s._gender        = s._gender        || 'm';
    s._dob           = s._dob           || '';
    s._level         = s._level         || 'intermediaire';
    s._daysPerWeek   = s._daysPerWeek   || 4;
    s._place         = s._place         || 'salle';
    s._sleepGoal     = s._sleepGoal     || 8;
    s._startDate     = s._startDate     || '';
    s._restDuration  = s._restDuration  || 90;
    if (s._restBeep === undefined) s._restBeep = true;

    // Garanties sur les mesures
    if (!s.mesures) s.mesures = {};
    ['poids','poitrine','taille','hanches','bras','cuisse','cou','mollet']
      .forEach(k => { if (!s.mesures[k]) s.mesures[k] = []; });

    // Garanties sur les champs critiques
    if (!s.calChecks)  s.calChecks  = {};
    if (!s.history)    s.history    = {};
    if (!s.prs)        s.prs        = {};
    if (!s.sleep)      s.sleep      = {};
    if (!s.nutrition)  s.nutrition  = {};
    if (!s.painLog)    s.painLog    = [];
    if (!s.sessRecovery) s.sessRecovery = {};
    if (!s.photos)     s.photos     = [];
    if (!s.achievements) s.achievements = {};
    if (!s.weekCount)  s.weekCount  = 1;
    if (!s.goals)      s.goals      = [];

    return s;
  }

  /* ─────────────────────────────────────────────
     AUTO-SAVE HEBDOMADAIRE (dimanche)
  ───────────────────────────────────────────── */
  function checkWeeklyAutoSave() {
    const today = new Date();
    if (today.getDay() !== 0) return; // seulement le dimanche

    const key      = typeof localDateStr === 'function' ? localDateStr(today) : today.toISOString().slice(0, 10);
    const lastSave = localStorage.getItem(AUTOSAVE_KEY);

    if (lastSave !== key) {
      if (typeof Training !== 'undefined') Training.archiveWeek();
      localStorage.setItem(AUTOSAVE_KEY, key);
    }
  }

  /* ─────────────────────────────────────────────
     EXPORT JSON
  ───────────────────────────────────────────── */
  function exportJSON() {
    try {
      const state  = Store.getState();
      const flat   = _flatten(state);
      const json   = JSON.stringify(flat, null, 2);
      const blob   = new Blob([json], { type: 'application/json' });
      const url    = URL.createObjectURL(blob);
      const date   = new Date().toISOString().slice(0, 10);
      const a      = document.createElement('a');
      a.href       = url;
      a.download   = `ctp-backup-${date}.json`;
      a.click();
      URL.revokeObjectURL(url);
      if (typeof showToast === 'function')
        showToast('✅ Sauvegarde exportée', 'save');
    } catch(e) {
      Errors.error('Erreur export JSON', 'persist.js', e.message);
    }
  }

  /* ─────────────────────────────────────────────
     IMPORT JSON
  ───────────────────────────────────────────── */
  /* ── Validation schéma import JSON ── */
  function _validateImport(raw) {
    if (!raw || typeof raw !== 'object') throw new Error('Format invalide (pas un objet)');

    // Taille maximale : 10 MB
    const size = JSON.stringify(raw).length;
    if (size > 10 * 1024 * 1024) throw new Error('Fichier trop volumineux (max 10 MB)');

    // Champs requis
    const required = ['training'];
    for (const k of required) {
      if (!(k in raw) && !(raw.training)) {
        // Try legacy format
        if (!raw.days && !raw.weekType) throw new Error('Structure manquante : ' + k);
      }
    }

    // Valider les tableaux critiques
    if (raw.training?.days && !Array.isArray(raw.training.days))
      throw new Error('training.days doit être un tableau');

    if (raw.training?.days?.length > 7)
      throw new Error('Trop de jours (' + raw.training.days.length + ') — max 7');

    // Nettoyer les chaînes dangereuses dans les noms d'exercices
    function sanitizeStr(s) {
      if (typeof s !== 'string') return '';
      return s.replace(/<[^>]*>/g, '').slice(0, 200); // strip HTML, limit length
    }

    if (raw.training?.days) {
      raw.training.days.forEach(d => {
        (d.exercises || []).forEach(ex => {
          ex.name   = sanitizeStr(ex.name || '');
          ex.note   = sanitizeStr(ex.note || '');
          ex.weight = String(parseFloat(ex.weight) || '').slice(0, 10);
          ex.sets   = String(parseInt(ex.sets) || '').slice(0, 4);
          ex.reps   = sanitizeStr(ex.reps || '').slice(0, 20);
        });
      });
    }

    return raw;
  }

  function importJSON(file) {
    return new Promise((resolve, reject) => {
      // Vérifier la taille du fichier avant lecture
      if (file.size > 10 * 1024 * 1024) {
        if (typeof showToast === 'function')
          showToast('❌ Fichier trop volumineux (max 10 MB)', 'error', 4000);
        reject(new Error('File too large'));
        return;
      }

      const reader = new FileReader();
      reader.onload = e => {
        try {
          const raw      = JSON.parse(e.target.result);
          const validated = _validateImport(raw);
          const migrated = migrateState(validated);
          Store.load._fromObject(migrated);
          if (typeof showToast === 'function')
            showToast('✅ Données importées et validées', 'save');
          resolve(migrated);
        } catch(err) {
          const msg = err.message || 'Fichier invalide';
          if (typeof showToast === 'function')
            showToast('❌ Import refusé : ' + msg, 'error', 5000);
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  /* ─────────────────────────────────────────────
     EXPORT CSV (historique d'entraînement)
  ───────────────────────────────────────────── */
  function exportCSV() {
    try {
      const state   = Store.getState();
      const history = state.training.history;
      const rows    = ['Semaine,Jour,Exercice,Muscle,Séries,Reps,Poids,RPE,Volume'];

      Object.entries(history)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([week, wk]) => {
          (wk.days || []).forEach((d, di) => {
            (d.exercises || []).forEach(ex => {
              if (!ex.name || ex.isWarmup) return;
              const sets = ex.sets || '';
              const reps = ex.repsAchieved || ex.reps || '';
              const w    = ex.weight || '';
              const rpe  = ex.rpe || '';
              const vol  = (parseFloat(w) || 0) * (parseInt(reps) || 0);
              // Protéger contre CSV injection (cellules commençant par =, +, -, @, TAB, CR)
              function csvCell(v) {
                const s = String(v || '');
                return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
              }
              rows.push([week, di+1, '"'+csvCell(ex.name)+'"', csvCell(ex.muscle), sets, reps, w, rpe, vol].join(','));
            });
          });
        });

      const csv  = rows.join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url  = URL.createObjectURL(blob);
      const date = new Date().toISOString().slice(0, 10);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `ctp-historique-${date}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      if (typeof showToast === 'function')
        showToast('✅ CSV exporté', 'save');
    } catch(e) {
      Errors.error('Erreur export CSV', 'persist.js', e.message);
    }
  }

  /* ─────────────────────────────────────────────
     RESET COMPLET
  ───────────────────────────────────────────── */
  function resetAll() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(UNDO_KEY);
    localStorage.removeItem(AUTOSAVE_KEY);
    Store.reset();
    if (typeof showToast === 'function')
      showToast('🗑️ Toutes les données supprimées', 'warn');
  }

  /* ─────────────────────────────────────────────
     COMPATIBILITÉ — fonctions globales legacy
  ───────────────────────────────────────────── */

  // save() global redirige vers Persist.save()
  // Tous les 92 appels existants continueront de fonctionner
  window.save = function(skipUndo) {
    Persist.save(Store.getState(), { skipUndo: !!skipUndo });
    // Sync S (legacy) depuis le Store
    const flat = Store.bridge();
    Object.assign(S, flat);
  };

  // load() global
  window.load = function() {
    Store.load();
    // Sync S (legacy)
    const flat = Store.bridge();
    Object.assign(S, flat);
  };

  // migrateState() global (utilisé dans Store.load)
  window.migrateState = migrateState;

  // undoAction() global
  window.undoAction = function() {
    const success = Store.undo();
    if (success) {
      // Sync S (legacy)
      const flat = Store.bridge();
      Object.assign(S, flat);
      if (typeof renderDayTabs === 'function')  renderDayTabs();
      if (typeof renderDayDetail === 'function') renderDayDetail(S.activeDay || 0);
      if (typeof showToast === 'function') showToast('↩ Action annulée', 'save');
    } else {
      if (typeof showToast === 'function') showToast('Rien à annuler', 'warn');
    }
  };

  // exportData() global
  window.exportData = exportJSON;

  // exportCSV() global
  window.exportCSV = exportCSV;

  // importData() global
  window.importData = function() {
    const inp  = document.createElement('input');
    inp.type   = 'file';
    inp.accept = '.json';
    inp.onchange = e => {
      if (!e.target.files[0]) return;
      if (!confirm('Importer ces données ? Vos données actuelles seront remplacées.\n\nUn backup sera créé automatiquement.')) return;
      exportJSON(); // backup auto
      importJSON(e.target.files[0]).then(() => {
        window.load();
        if (typeof switchTab === 'function') switchTab(S._currentTab || 'dashboard');
      });
    };
    inp.click();
  };

  // checkWeeklyAutoSave() global
  window.checkWeeklyAutoSave = checkWeeklyAutoSave;

  /* ─────────────────────────────────────────────
     CONNECTER AU STORE — save automatique à chaque dispatch
  ───────────────────────────────────────────── */
  Store.subscribe(function(state, action) {
    // Ne pas sauvegarder pour les actions de navigation pure
    const skipTypes = ['APP_SET_TAB', 'UNDO', 'RESET'];
    if (skipTypes.includes(action.type)) return;
    // Le Store gère déjà son propre debounce interne
    // mais on force la sync de S (legacy) à chaque changement
    const flat = Store.bridge();
    Object.assign(S, flat);
  });

  /* ─────────────────────────────────────────────
     API PUBLIQUE
  ───────────────────────────────────────────── */
  return {
    save,
    load,
    migrateState,
    exportJSON,
    importJSON,
    exportCSV,
    resetAll,
    checkWeeklyAutoSave,
    STORAGE_KEY,
    SCHEMA_VER,
  };

})();
