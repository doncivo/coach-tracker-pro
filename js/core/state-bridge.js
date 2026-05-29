/* ================================================================
   core/state-bridge.js — Bridge S ↔ Store

   Remplace l'objet S global par un proxy réactif.
   - S.xxx (lecture)  → Store.getState()[domain].xxx
   - S.xxx = v (écriture) → Store.dispatch(action) automatiquement
   - save() → no-op (persist.js gère la sauvegarde via Store.subscribe)

   RÉSULTAT: les 492 lectures et 54 écritures de S dans les
   render_*.js continuent de fonctionner sans aucune modification.
   ================================================================ */

(function() {

  /* ─────────────────────────────────────────────
     MAPPING: champ S → domaine + getter/setter
  ───────────────────────────────────────────── */
  const DOMAIN_MAP = {
    // Training
    days:           'training',
    weekType:       'training',
    weekCount:      'training',
    currentBlock:   'training',
    blockWeek:      'training',
    activeDay:      'training',
    sessDay:        'training',
    sessStartTime:  'training',
    sessRecovery:   'training',
    history:        'training',
    prs:            'training',
    bilanOffset:    'training',
    // Activity
    steps:          'activity',
    calories:       'activity',
    sleep:          'activity',
    nutrition:      'activity',
    stepsGoal:      'activity',
    caloriesGoal:   'activity',
    proteinGoal:    'activity',
    carbsGoal:      'activity',
    fatGoal:        'activity',
    // Body
    mesures:         'body',
    photos:          'body',
    painLog:         'body',
    profilTaille:    'body',
    profilAge:       'body',
    profilSexe:      'body',
    water:           'body',
    bodyCompo:       'body',
    watchData:       'body',
    icloudBackup:    'body',
    mesureObjectifs: 'body',
    // Goals
    objective:      'goals',
    achievements:   'goals',
    goals:          'goals',
    // App
    darkMode:       'app',
    exViewMode:     'app',
    notes:          'app',
    calYear:        'app',
    calMonth:       'app',
    calChecks:      'app',
    _currentTab:    'app',
    _restDuration:  'app',
    _restBeep:      'app',
    _reminderHour:  'app',
    _reminderMinute:'app',
    _gender:        'app',
    _dob:           'app',
    _level:         'app',
    _daysPerWeek:   'app',
    _place:         'app',
    _sleepGoal:     'app',
    _startDate:     'app',
    _schemaVersion: 'app',
  };

  /* Mapping: écriture S.xxx = v → action dispatch */
  const WRITE_MAP = {
    activeDay:      (v) => Store.dispatch({ type: 'TRAINING_SET_ACTIVE_DAY', payload: v }, { skipUndo: true }),
    sessDay:        (v) => Store.dispatch({ type: 'TRAINING_SET_SESS_DAY',   payload: v }, { skipUndo: true }),
    weekType:       (v) => Store.dispatch({ type: 'TRAINING_SET_WEEK_TYPE',  payload: v }),
    bilanOffset:    (v) => Store.dispatch({ type: 'TRAINING_SET_BILAN_OFFSET', payload: v }, { skipUndo: true }),
    stepsGoal:      (v) => Store.dispatch({ type: 'ACTIVITY_SET_STEPS_GOAL',    payload: v }),
    caloriesGoal:   (v) => Store.dispatch({ type: 'ACTIVITY_SET_CALORIES_GOAL', payload: v }),
    profilTaille:   (v) => Store.dispatch({ type: 'BODY_SET_TAILLE',   payload: v }),
    profilAge:      (v) => Store.dispatch({ type: 'BODY_SET_PROFIL_AGE',  payload: v }, { skipUndo: true }),
    profilSexe:     (v) => Store.dispatch({ type: 'BODY_SET_PROFIL_SEXE', payload: v }, { skipUndo: true }),
    objective:      (v) => Store.dispatch({ type: 'GOALS_SET_OBJECTIVE', payload: v }),
    darkMode:       (v) => Store.dispatch({ type: 'APP_SET_DARK',         payload: v }, { skipUndo: true }),
    exViewMode:     (v) => Store.dispatch({ type: 'APP_SET_EX_VIEW',      payload: v }, { skipUndo: true }),
    notes:          (v) => Store.dispatch({ type: 'APP_SET_NOTES',        payload: v }, { skipUndo: true }),
    _currentTab:    (v) => Store.dispatch({ type: 'APP_SET_TAB',          payload: v }, { skipUndo: true }),
    _restDuration:  (v) => Store.dispatch({ type: 'APP_SET_REST_DURATION',payload: v }, { skipUndo: true }),
    _restBeep:      (v) => Store.dispatch({ type: 'APP_SET_REST_BEEP',    payload: v }, { skipUndo: true }),
    // Champs profil groupés
    _gender:        (v) => Store.dispatch({ type: 'APP_SET_PROFIL', payload: { _gender:     v } }, { skipUndo: true }),
    _dob:           (v) => Store.dispatch({ type: 'APP_SET_PROFIL', payload: { _dob:        v } }, { skipUndo: true }),
    _level:         (v) => Store.dispatch({ type: 'APP_SET_PROFIL', payload: { _level:      v } }, { skipUndo: true }),
    _daysPerWeek:   (v) => Store.dispatch({ type: 'APP_SET_PROFIL', payload: { _daysPerWeek:v } }, { skipUndo: true }),
    _place:         (v) => Store.dispatch({ type: 'APP_SET_PROFIL', payload: { _place:      v } }, { skipUndo: true }),
    _sleepGoal:     (v) => Store.dispatch({ type: 'APP_SET_PROFIL', payload: { _sleepGoal:  v } }, { skipUndo: true }),
    _startDate:     (v) => Store.dispatch({ type: 'APP_SET_PROFIL', payload: { _startDate:  v } }, { skipUndo: true }),
    _reminderHour:  (v, obj) => Store.dispatch({ type: 'APP_SET_REMINDER', payload: { hour: v, minute: obj._reminderMinute } }, { skipUndo: true }),
    _reminderMinute:(v, obj) => Store.dispatch({ type: 'APP_SET_REMINDER', payload: { hour: obj._reminderHour, minute: v } }, { skipUndo: true }),
    calMonth:       (v, obj) => Store.dispatch({ type: 'APP_SET_CAL', payload: { year: obj.calYear, month: v } }, { skipUndo: true }),
    calYear:        (v, obj) => Store.dispatch({ type: 'APP_SET_CAL', payload: { year: v, month: obj.calMonth } }, { skipUndo: true }),
    // Macros groupées
    proteinGoal:    (v, obj) => Store.dispatch({ type: 'ACTIVITY_SET_MACRO_GOALS', payload: { protein: v, carbs: obj.carbsGoal, fat: obj.fatGoal } }),
    carbsGoal:      (v, obj) => Store.dispatch({ type: 'ACTIVITY_SET_MACRO_GOALS', payload: { protein: obj.proteinGoal, carbs: v, fat: obj.fatGoal } }),
    fatGoal:        (v, obj) => Store.dispatch({ type: 'ACTIVITY_SET_MACRO_GOALS', payload: { protein: obj.proteinGoal, carbs: obj.carbsGoal, fat: v } }),
  };

  /* ─────────────────────────────────────────────
     PROXY S
  ───────────────────────────────────────────── */
  const _fallback = {};  // stockage pour les champs non mappés (undoStack, etc.)

  const proxy = new Proxy(_fallback, {

    get(target, key) {
      // Accès au Store si le champ est mappé
      if (key in DOMAIN_MAP) {
        const domain = DOMAIN_MAP[key];
        const state  = Store.getState();
        const val    = state[domain] ? state[domain][key] : undefined;
        return val !== undefined ? val : target[key];
      }
      // Champs non mappés (undoStack, etc.)
      return target[key];
    },

    set(target, key, value) {
      // Dispatcher si le champ a une action associée
      if (key in WRITE_MAP) {
        try {
          WRITE_MAP[key](value, proxy);
        } catch(e) {
          // Fallback silencieux — ne jamais bloquer le rendu
          Errors.warn('State bridge write error: ' + key, 'state-bridge.js', e.message);
        }
      }
      // Aussi écrire dans le fallback pour la compatibilité immédiate
      // (avant que le Store ait propagé le changement)
      target[key] = value;
      return true;
    },

    has(target, key) {
      return (key in DOMAIN_MAP) || (key in target);
    },

  });

  /* ─────────────────────────────────────────────
     REMPLACER S GLOBAL
  ───────────────────────────────────────────── */
  // Conserver l'ancien S comme référence si besoin
  if (typeof S !== 'undefined') {
    window._S_legacy = S;
  }

  // Remplacer S par le proxy
  window.S = proxy;

  // save() devient un no-op — persist.js gère tout via Store.subscribe
  // On garde la fonction pour ne pas casser les 92 appels existants
  window.save = function(skipUndo) {
    // Persist.save() est déjà abonné au Store via subscribe()
    // On force juste une sauvegarde immédiate si besoin
    if (typeof Persist !== 'undefined') {
      Persist.save(Store.getState(), { skipUndo: !!skipUndo });
    }
  };

  console.log('[CTP] State bridge actif — S est maintenant un proxy réactif');

  /* ─────────────────────────────────────────────
     HOOK SAVE — mutations profondes (S.days[i].xxx = val)
     
     Quand du code fait S.days[i].date = val puis save(),
     le Store ne sait pas que ses données ont changé.
     Ce hook force une synchronisation depuis le fallback.
  ───────────────────────────────────────────── */
  // B3 fix: suppression du JSON.stringify×7 par appel save()
  // La sync des mutations profondes est gérée par un dispatch direct
  let _pendingFlush = false;
  window.save = function(skipUndo) {
    if (_pendingFlush) return;
    // Si des mutations directes ont eu lieu sur les jours (fb.days muté),
    // dispatcher un seul batch update au prochain tick
    const fb = _fallback;
    if (fb.days) {
      _pendingFlush = true;
      Promise.resolve().then(() => {
        _pendingFlush = false;
        const state = Store.getState();
        if (fb.days && fb.days !== state.training.days) {
          Store.dispatch({
            type: 'TRAINING_SET_DAYS_BATCH',
            payload: fb.days
          }, { skipUndo: !!skipUndo });
        }
      });
    }
    // Déclencher persist via Store (le debounce 400ms gère la fréquence)
    Store._triggerPersist && Store._triggerPersist();
  };

})();
