/* ================================================================
   core/store.js — Store central Coach Tracker Pro
   
   Pattern: Flux unidirectionnel
   Action → Reducer → State → Persist → Notify subscribers
   
   Usage:
     Store.dispatch({ type: 'SET_ACTIVE_DAY', payload: 2 });
     Store.getState().training.activeDay  // → 2
     Store.subscribe(state => renderCurrentView(state));
     Store.undo();
   ================================================================ */

const Store = (() => {

  /* ─────────────────────────────────────────────
     STATE INITIAL — structure par domaine
  ───────────────────────────────────────────── */
  const INITIAL_STATE = {

    training: {
      days:           Array.from({ length: 7 }, (_, i) => mkDay(i, 'A')),
      weekType:       'A',
      weekCount:      1,
      currentBlock:   'Accumulation',
      blockWeek:      1,
      activeDay:      0,
      sessDay:        0,
      sessStartTime:  null,
      sessRecovery:   {},
      history:        {},
      prs:            {},
      bilanOffset:    0,
    },

    activity: {
      steps:          {},
      calories:       {},
      sleep:          {},
      nutrition:      {},
      stepsGoal:      10000,
      caloriesGoal:   2500,
      proteinGoal:    0,
      carbsGoal:      0,
      fatGoal:        0,
    },

    body: {
      mesures: {
        poids: [], poitrine: [], taille: [], hanches: [],
        bras: [], cuisse: [], cou: [], mollet: []
      },
      photos:         [],
      painLog:        [],
      profilTaille:   175,
    },

    goals: {
      objective: {
        text: '', targetDate: '', targetWeight: '',
        targetExercise: '', targetLoad: ''
      },
      achievements:   {},
      goals: [
        { text: "Compléter les 6 séances", done: false },
        { text: "Noter les poids", done: false },
        { text: "Respecter l\\'échauffement", done: false },
      ],
    },

    app: {
      darkMode:       false,
      exViewMode:     'compact',
      notes:          '',
      calYear:        new Date().getFullYear(),
      calMonth:       new Date().getMonth(),
      calChecks:      {},
      _currentTab:    'weekly',
      _schemaVersion: typeof SCHEMA_VERSION !== 'undefined' ? SCHEMA_VERSION : 3,
      _restDuration:  90,
      _restBeep:      true,
      _reminderHour:  null,
      _reminderMinute: null,
      _gender:        'm',
      _dob:           '',
      _level:         'intermediaire',
      _daysPerWeek:   4,
      _place:         'salle',
      _sleepGoal:     8,
      _startDate:     '',
    },

  };

  /* ─────────────────────────────────────────────
     ÉTAT INTERNE
  ───────────────────────────────────────────── */
  let _state       = _deepClone(INITIAL_STATE);
  let _subscribers = [];
  let _saveTimer   = null;
  let _undoStack   = [];
  const UNDO_LIMIT = 10;
  const STORAGE_KEY = 'ctp_v3';
  const UNDO_KEY    = 'ctp_undo';

  /* ─────────────────────────────────────────────
     UTILITAIRES INTERNES
  ───────────────────────────────────────────── */
  function _deepClone(obj) {
    try { return JSON.parse(JSON.stringify(obj)); }
    catch(_) { return Object.assign({}, obj); }
  }

  function _merge(target, source) {
    const result = Object.assign({}, target);
    Object.keys(source).forEach(k => {
      if (source[k] !== null && typeof source[k] === 'object' && !Array.isArray(source[k])) {
        result[k] = _merge(target[k] || {}, source[k]);
      } else {
        result[k] = source[k];
      }
    });
    return result;
  }

  /* ─────────────────────────────────────────────
     PERSISTANCE
  ───────────────────────────────────────────── */
  function _persist() {
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(() => {
      try {
        // Sauvegarder le state aplati (compatible avec l'ancien format ctp_v3)
        const flat = _flattenForStorage(_state);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(flat));

        // Indicateur visuel
        const badge = document.getElementById('save-badge');
        if (badge) {
          badge.classList.add('show');
          setTimeout(() => badge.classList.remove('show'), 1200);
        }
      } catch(e) {
        if (e.name === 'QuotaExceededError' || e.code === 22) {
          // Pruner l'historique si quota dépassé
          const histKeys = Object.keys(_state.training.history).sort();
          if (histKeys.length > 20) {
            const pruned = Object.assign({}, _state.training.history);
            histKeys.slice(0, 5).forEach(k => delete pruned[k]);
            _state = _merge(_state, { training: { history: pruned } });
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(_flattenForStorage(_state)));
            } catch(_) {
              if (typeof showToast === 'function')
                showToast('❌ Stockage plein — données purgées automatiquement.', 'warn', 5000);
            }
          } else {
            if (typeof showToast === 'function')
              showToast('❌ Stockage localStorage plein. Exportez vos données.', 'error', 6000);
          }
        }
      }
    }, 400);
  }

  function _saveUndo() {
    try {
      const snapshot = JSON.stringify({
        days:    _state.training.days.map(d => Object.assign({}, d)),
        history: _state.training.history
      });
      _undoStack.push(snapshot);
      if (_undoStack.length > UNDO_LIMIT) _undoStack.shift();
      localStorage.setItem(UNDO_KEY, JSON.stringify(_undoStack));
    } catch(_) { /* undo non critique */ }
  }

  /* ─────────────────────────────────────────────
     COMPATIBILITÉ: aplatir vers l'ancien format S
     pour ne pas casser les données existantes
  ───────────────────────────────────────────── */
  function _flattenForStorage(state) {
    return Object.assign(
      {},
      state.training,
      state.activity,
      state.body,
      state.goals,
      state.app
    );
  }

  function _inflateFromStorage(flat) {
    if (!flat) return null;
    return {
      training: {
        days:          flat.days          || INITIAL_STATE.training.days,
        weekType:      flat.weekType      || 'A',
        weekCount:     flat.weekCount     || 1,
        currentBlock:  flat.currentBlock  || 'Accumulation',
        blockWeek:     flat.blockWeek     || 1,
        activeDay:     flat.activeDay     || 0,
        sessDay:       flat.sessDay       || 0,
        sessStartTime: flat.sessStartTime || null,
        sessRecovery:  flat.sessRecovery  || {},
        history:       flat.history       || {},
        prs:           flat.prs           || {},
        bilanOffset:   flat.bilanOffset   || 0,
      },
      activity: {
        steps:         flat.steps         || {},
        calories:      flat.calories      || {},
        sleep:         flat.sleep         || {},
        nutrition:     flat.nutrition     || {},
        stepsGoal:     flat.stepsGoal     || 10000,
        caloriesGoal:  flat.caloriesGoal  || 2500,
        proteinGoal:   flat.proteinGoal   || 0,
        carbsGoal:     flat.carbsGoal     || 0,
        fatGoal:       flat.fatGoal       || 0,
      },
      body: {
        mesures:       flat.mesures       || INITIAL_STATE.body.mesures,
        photos:        flat.photos        || [],
        painLog:       flat.painLog       || [],
        profilTaille:  flat.profilTaille  || 175,
      },
      goals: {
        objective:     flat.objective     || INITIAL_STATE.goals.objective,
        achievements:  flat.achievements  || {},
        goals:         flat.goals         || INITIAL_STATE.goals.goals,
      },
      app: {
        darkMode:        flat.darkMode       || false,
        exViewMode:      flat.exViewMode     || 'compact',
        notes:           flat.notes          || '',
        calYear:         flat.calYear        || new Date().getFullYear(),
        calMonth:        flat.calMonth       || new Date().getMonth(),
        calChecks:       flat.calChecks      || {},
        _currentTab:     flat._currentTab    || 'weekly',
        _schemaVersion:  flat._schemaVersion || 3,
        _restDuration:   flat._restDuration  || 90,
        _restBeep:       flat._restBeep      !== undefined ? flat._restBeep : true,
        _reminderHour:   flat._reminderHour  || null,
        _reminderMinute: flat._reminderMinute|| null,
        _gender:         flat._gender        || 'm',
        _dob:            flat._dob           || '',
        _level:          flat._level         || 'intermediaire',
        _daysPerWeek:    flat._daysPerWeek   || 4,
        _place:          flat._place         || 'salle',
        _sleepGoal:      flat._sleepGoal     || 8,
        _startDate:      flat._startDate     || '',
      },
    };
  }

  /* ─────────────────────────────────────────────
     REDUCERS — une fonction pure par domaine
     (state, action) → newDomainState
  ───────────────────────────────────────────── */
  const reducers = {

    training(state, action) {
      switch (action.type) {
        case 'TRAINING_SET_ACTIVE_DAY':
          return Object.assign({}, state, { activeDay: action.payload });
        case 'TRAINING_SET_SESS_DAY':
          return Object.assign({}, state, { sessDay: action.payload, sessStartTime: Date.now() });
        case 'TRAINING_SET_WEEK_TYPE':
          return Object.assign({}, state, { weekType: action.payload });
        case 'TRAINING_SET_BLOCK':
          return Object.assign({}, state, {
            currentBlock: action.payload.block,
            blockWeek: action.payload.blockWeek || 1
          });
        case 'TRAINING_UPDATE_DAY': {
          const days = state.days.map((d, i) =>
            i === action.payload.dayIndex ? Object.assign({}, d, action.payload.changes) : d
          );
          return Object.assign({}, state, { days });
        }
        case 'TRAINING_UPDATE_EXERCISE': {
          const days = state.days.map((d, di) => {
            if (di !== action.payload.dayIndex) return d;
            const exercises = d.exercises.map((ex, ei) =>
              ei === action.payload.exIndex
                ? Object.assign({}, ex, action.payload.changes)
                : ex
            );
            return Object.assign({}, d, { exercises });
          });
          return Object.assign({}, state, { days });
        }
        case 'TRAINING_ADD_EXERCISE': {
          const days = state.days.map((d, di) => {
            if (di !== action.payload.dayIndex) return d;
            return Object.assign({}, d, {
              exercises: [...d.exercises, action.payload.exercise]
            });
          });
          return Object.assign({}, state, { days });
        }
        case 'TRAINING_REMOVE_EXERCISE': {
          const days = state.days.map((d, di) => {
            if (di !== action.payload.dayIndex) return d;
            return Object.assign({}, d, {
              exercises: d.exercises.filter((_, i) => i !== action.payload.exIndex)
            });
          });
          return Object.assign({}, state, { days });
        }
        case 'TRAINING_VALIDATE_SET': {
          const { dayIndex, exIndex, setIndex, weight, reps, rpe, rir } = action.payload;
          const days = state.days.map((d, di) => {
            if (di !== dayIndex) return d;
            const exercises = d.exercises.map((ex, ei) => {
              if (ei !== exIndex) return ex;
              const setData = ex.setData.map((s, si) =>
                si === setIndex
                  ? Object.assign({}, s, { done: true, weight, reps, rpe, rir })
                  : s
              );
              const allDone = setData.slice(0, ex.sets || setData.length).every(s => s.done);
              return Object.assign({}, ex, { setData, done: allDone });
            });
            return Object.assign({}, d, { exercises });
          });
          return Object.assign({}, state, { days });
        }
        case 'TRAINING_ARCHIVE_WEEK':
          return Object.assign({}, state, {
            history: action.payload.history,
            weekCount: state.weekCount + 1,
          });
        case 'TRAINING_UPDATE_PRS':
          return Object.assign({}, state, { prs: action.payload });
        case 'TRAINING_SET_RECOVERY':
          return Object.assign({}, state, {
            sessRecovery: Object.assign({}, state.sessRecovery, action.payload)
          });
        case 'TRAINING_SET_BILAN_OFFSET':
          return Object.assign({}, state, { bilanOffset: action.payload });
        default:
          return state;
      }
    },

    activity(state, action) {
      switch (action.type) {
        case 'ACTIVITY_SET_STEPS':
          return Object.assign({}, state, {
            steps: Object.assign({}, state.steps, { [action.payload.date]: action.payload.value })
          });
        case 'ACTIVITY_SET_STEPS_GOAL':
          return Object.assign({}, state, { stepsGoal: action.payload });
        case 'ACTIVITY_SET_CALORIES_GOAL':
          return Object.assign({}, state, { caloriesGoal: action.payload });
        case 'ACTIVITY_SET_MACRO_GOALS':
          return Object.assign({}, state, {
            proteinGoal: action.payload.protein,
            carbsGoal:   action.payload.carbs,
            fatGoal:     action.payload.fat,
          });
        case 'ACTIVITY_SET_SLEEP':
          return Object.assign({}, state, {
            sleep: Object.assign({}, state.sleep, { [action.payload.date]: action.payload.value })
          });
        case 'ACTIVITY_ADD_MEAL_ITEM': {
          const dayKey = action.payload.date;
          const mealKey = action.payload.meal;
          const dayCalories = state.calories[dayKey] || {};
          const mealItems = dayCalories[mealKey] || [];
          return Object.assign({}, state, {
            calories: Object.assign({}, state.calories, {
              [dayKey]: Object.assign({}, dayCalories, {
                [mealKey]: [...mealItems, action.payload.item]
              })
            })
          });
        }
        case 'ACTIVITY_REMOVE_MEAL_ITEM': {
          const { date, meal, itemIndex } = action.payload;
          const dayCalories = state.calories[date] || {};
          const mealItems = (dayCalories[meal] || []).filter((_, i) => i !== itemIndex);
          return Object.assign({}, state, {
            calories: Object.assign({}, state.calories, {
              [date]: Object.assign({}, dayCalories, { [meal]: mealItems })
            })
          });
        }
        case 'ACTIVITY_SET_NUTRITION':
          return Object.assign({}, state, {
            nutrition: Object.assign({}, state.nutrition, action.payload)
          });
        default:
          return state;
      }
    },

    body(state, action) {
      switch (action.type) {
        case 'BODY_ADD_MESURE': {
          const { key, entry } = action.payload;
          const current = state.mesures[key] || [];
          return Object.assign({}, state, {
            mesures: Object.assign({}, state.mesures, {
              [key]: [...current, entry].sort((a, b) => a.date.localeCompare(b.date))
            })
          });
        }
        case 'BODY_REMOVE_MESURE': {
          const { key, index } = action.payload;
          return Object.assign({}, state, {
            mesures: Object.assign({}, state.mesures, {
              [key]: state.mesures[key].filter((_, i) => i !== index)
            })
          });
        }
        case 'BODY_SET_TAILLE':
          return Object.assign({}, state, { profilTaille: action.payload });
        case 'BODY_ADD_PAIN':
          return Object.assign({}, state, {
            painLog: [...state.painLog, action.payload]
          });
        case 'BODY_REMOVE_PAIN':
          return Object.assign({}, state, {
            painLog: state.painLog.filter((_, i) => i !== action.payload)
          });
        case 'BODY_ADD_PHOTO':
          return Object.assign({}, state, {
            photos: [...state.photos, action.payload]
          });
        default:
          return state;
      }
    },

    goals(state, action) {
      switch (action.type) {
        case 'GOALS_SET_OBJECTIVE':
          return Object.assign({}, state, { objective: action.payload });
        case 'GOALS_UNLOCK_ACHIEVEMENT':
          return Object.assign({}, state, {
            achievements: Object.assign({}, state.achievements, {
              [action.payload]: { date: new Date().toISOString().slice(0, 10) }
            })
          });
        case 'GOALS_ADD_GOAL':
          return Object.assign({}, state, {
            goals: [...state.goals, { text: action.payload, done: false }]
          });
        case 'GOALS_TOGGLE_GOAL':
          return Object.assign({}, state, {
            goals: state.goals.map((g, i) =>
              i === action.payload ? Object.assign({}, g, { done: !g.done }) : g
            )
          });
        case 'GOALS_REMOVE_GOAL':
          return Object.assign({}, state, {
            goals: state.goals.filter((_, i) => i !== action.payload)
          });
        case 'GOALS_UPDATE_GOAL':
          return Object.assign({}, state, {
            goals: state.goals.map((g, i) =>
              i === action.payload.index
                ? Object.assign({}, g, { text: action.payload.text })
                : g
            )
          });
        default:
          return state;
      }
    },

    app(state, action) {
      switch (action.type) {
        case 'APP_SET_TAB':
          return Object.assign({}, state, { _currentTab: action.payload });
        case 'APP_TOGGLE_DARK':
          return Object.assign({}, state, { darkMode: !state.darkMode });
        case 'APP_SET_DARK':
          return Object.assign({}, state, { darkMode: action.payload });
        case 'APP_SET_EX_VIEW':
          return Object.assign({}, state, { exViewMode: action.payload });
        case 'APP_SET_NOTES':
          return Object.assign({}, state, { notes: action.payload });
        case 'APP_SET_CAL':
          return Object.assign({}, state, {
            calYear: action.payload.year,
            calMonth: action.payload.month
          });
        case 'APP_SET_CAL_CHECK':
          return Object.assign({}, state, {
            calChecks: Object.assign({}, state.calChecks, {
              [action.payload.key]: action.payload.value
            })
          });
        case 'APP_SET_REST_DURATION':
          return Object.assign({}, state, { _restDuration: action.payload });
        case 'APP_SET_REST_BEEP':
          return Object.assign({}, state, { _restBeep: action.payload });
        case 'APP_SET_REMINDER':
          return Object.assign({}, state, {
            _reminderHour: action.payload.hour,
            _reminderMinute: action.payload.minute
          });
        case 'APP_SET_PROFIL':
          return Object.assign({}, state, action.payload);
        default:
          return state;
      }
    },

  };

  /* ─────────────────────────────────────────────
     DISPATCH — point d'entrée unique
  ───────────────────────────────────────────── */
  function dispatch(action, opts = {}) {
    if (!action || !action.type) {
      console.warn('[Store] dispatch() appelé sans type d\'action');
      return;
    }

    // Sauvegarder l'état avant mutation pour undo (sauf actions légères)
    const skipUndo = opts.skipUndo || action.skipUndo || false;
    if (!skipUndo) _saveUndo();

    // Appliquer les reducers
    const domain = action.type.split('_')[0].toLowerCase();
    const newState = Object.assign({}, _state);

    if (reducers[domain]) {
      newState[domain] = reducers[domain](_state[domain], action);
    } else {
      // Action globale — essayer tous les reducers
      Object.keys(reducers).forEach(d => {
        const result = reducers[d](_state[d], action);
        if (result !== _state[d]) newState[d] = result;
      });
    }

    _state = newState;

    // Persister (debounce 400ms)
    _persist();

    // Notifier les subscribers
    _subscribers.forEach(fn => {
      try { fn(_state, action); }
      catch(e) { console.error('[Store] Erreur subscriber:', e); }
    });
  }

  /* ─────────────────────────────────────────────
     API PUBLIQUE
  ───────────────────────────────────────────── */
  return {

    /** Lire le state courant (lecture seule) */
    getState() {
      return _state;
    },

    /** Lire un slice spécifique */
    get(domain) {
      return _state[domain];
    },

    /** Dispatcher une action */
    dispatch,

    /** S'abonner aux changements */
    subscribe(fn) {
      _subscribers.push(fn);
      return () => {
        _subscribers = _subscribers.filter(s => s !== fn);
      };
    },

    /** Charger depuis localStorage (au démarrage) */
    load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          // Migrer si nécessaire
          const migrated = typeof migrateState === 'function'
            ? migrateState(parsed)
            : parsed;
          const inflated = _inflateFromStorage(migrated);
          if (inflated) _state = inflated;
        }
        // Charger l'undo stack
        try {
          const undoRaw = localStorage.getItem(UNDO_KEY);
          if (undoRaw) _undoStack = JSON.parse(undoRaw);
        } catch(_) {}
      } catch(e) {
        console.error('[Store] Erreur de chargement:', e);
        if (typeof showToast === 'function')
          showToast('⚠️ Erreur de chargement des données.', 'error', 5000);
      }
    },

    /** Annuler la dernière action */
    undo() {
      if (_undoStack.length === 0) return false;
      try {
        const snapshot = JSON.parse(_undoStack.pop());
        localStorage.setItem(UNDO_KEY, JSON.stringify(_undoStack));
        _state = _merge(_state, {
          training: {
            days:    snapshot.days,
            history: snapshot.history
          }
        });
        _persist();
        _subscribers.forEach(fn => fn(_state, { type: 'UNDO' }));
        return true;
      } catch(e) {
        console.error('[Store] Erreur undo:', e);
        return false;
      }
    },

    /** Réinitialiser complètement (attention: perd toutes les données) */
    reset() {
      _state = _deepClone(INITIAL_STATE);
      _undoStack = [];
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(UNDO_KEY);
      _subscribers.forEach(fn => fn(_state, { type: 'RESET' }));
    },

    /** Exporter le state brut (pour débogage) */
    export() {
      return _deepClone(_state);
    },

    /** Compatibilité: bridge vers l'ancien S global
        Permet la migration progressive sans tout casser d'un coup */
    bridge() {
      const state = _state;
      return Object.assign(
        {},
        state.training,
        state.activity,
        state.body,
        state.goals,
        state.app
      );
    },

  };

})();

/* ================================================================
   COMPATIBILITÉ RÉTROACTIVE
   
   Pendant la migration, le code existant utilise encore S.xxx
   Ce proxy redirige les lectures/écritures vers le Store
   sans modifier le code appelant.
   
   À supprimer une fois tous les modules migrés.
   ================================================================ */
const S_PROXY_ENABLED = false; // Mettre à true pour activer le proxy

if (typeof Proxy !== 'undefined' && S_PROXY_ENABLED) {
  // Proxy ES6 — redirige S.xxx vers Store
  // Activé seulement en dev pour détecter les accès directs
  window._S_raw = {};
  window.S = new Proxy(window._S_raw, {
    get(_, key) {
      const flat = Store.bridge();
      if (key in flat) return flat[key];
      return window._S_raw[key];
    },
    set(_, key, value) {
      // Log les écritures directes pour identifier ce qui reste à migrer
      console.warn('[Store] Écriture directe S.' + key + ' — à migrer vers Store.dispatch()');
      window._S_raw[key] = value;
      return true;
    }
  });
}
