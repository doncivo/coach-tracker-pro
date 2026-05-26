/* ================================================================
   store/training.js — Selectors + Thunks du domaine Training

   Les REDUCERS sont dans core/store.js (Training.*).
   Ce fichier contient:
   - Selectors: fonctions pures (state) → données dérivées
   - Thunks: actions complexes (multi-dispatch)
   - Helpers: calculs métier réutilisables
   - Compat: aliases globaux pour le code existant

   Usage:
     Training.getDay(Store.getState(), 0)
     Training.archiveWeek()
     Training.validateSet({ dayIndex:0, exIndex:1, setIndex:0, weight:'80', reps:'8' })
   ================================================================ */

const Training = (() => {

  /* ─────────────────────────────────────────────
     HELPERS MÉTIER (fonctions pures)
  ───────────────────────────────────────────── */

  /** Calcule le 1RM estimé (formule Epley) */
  function calc1RM(weight, reps) {
    const w = parseFloat(weight) || 0;
    const r = parseInt(reps) || 0;
    if (!w || !r || r <= 0) return 0;
    if (r === 1) return w;
    return Math.round(w * (1 + r / 30) * 10) / 10;
  }

  /** Clé unique d'un exercice pour l'historique */
  function exKey(ex) {
    return (ex.name || '').trim().toLowerCase();
  }

  /** Vérifier si une série dépasse le haut de la fourchette de reps */
  function shouldOverload(ex) {
    if (!ex.repsAchieved) return false;
    const achieved = parseInt(ex.repsAchieved);
    const match = (ex.reps || '').match(/(\d+)/g);
    if (!match) return false;
    return achieved >= parseInt(match[match.length - 1]);
  }

  /** Vérifier si une série est un échec (sous le bas de la fourchette) */
  function isFailure(ex) {
    if (!ex.repsAchieved) return false;
    const achieved = parseInt(ex.repsAchieved);
    const match = (ex.reps || '').match(/(\d+)/g);
    if (!match) return false;
    return achieved < parseInt(match[0]);
  }

  /** Plateau: pas de progression depuis N semaines */
  function isPlateau(exName) {
    const state = Store.getState();
    const hist = _exHist(state, exName);
    if (hist.length < 3) return false;
    const recent = hist.slice(-3);
    const weights = recent.map(r => parseFloat(r.weight) || 0);
    return weights.every(w => w === weights[0]);
  }

  /* ─────────────────────────────────────────────
     HELPERS PRIVÉS
  ───────────────────────────────────────────── */

  function _exHist(state, exName) {
    const key = exName.trim().toLowerCase();
    const result = [];
    const weeks = Object.values(state.training.history || {});
    weeks.forEach(wk => {
      (wk.days || []).forEach(d => {
        (d.exercises || []).forEach(ex => {
          if (exKey(ex) === key && ex.weight && (ex.repsAchieved || ex.reps)) {
            result.push({
              weight:       ex.weight,
              reps:         ex.reps,
              repsAchieved: ex.repsAchieved || ex.reps,
              rpe:          ex.rpe || '',
              date:         d.date || wk.date || '',
            });
          }
        });
      });
    });
    return result;
  }

  function _dayVol(d) {
    const v = {};
    (d.exercises || []).forEach(ex => {
      if (!ex.name || ex.isWarmup || !ex.muscle) return;
      const m   = ex.muscle;
      // Utiliser calcVol (poids × séries × reps) si disponible
      // Sinon fallback sur le nombre de séries
      let vol;
      if (typeof Compute !== 'undefined') {
        vol = Compute.calcVol(ex);
      } else {
        vol = ex.setData
          ? ex.setData.filter(s => s && s.done).length
          : (parseInt(ex.sets) || 0);
      }
      if (vol > 0) v[m] = (v[m] || 0) + vol;
    });
    return v;
  }

  /* ─────────────────────────────────────────────
     SELECTORS — (state) → données dérivées
  ───────────────────────────────────────────── */

  const selectors = {

    /** Récupérer un jour par index */
    getDay(state, index) {
      return state.training.days[index] || null;
    },

    /** Jour actif (planning) */
    getActiveDay(state) {
      return state.training.days[state.training.activeDay] || null;
    },

    /** Jour de séance */
    getSessDay(state) {
      return state.training.days[state.training.sessDay] || null;
    },

    /** Volume par muscle pour la semaine courante */
    getWeekVolume(state) {
      const v = {};
      state.training.days.forEach(d => {
        Object.entries(_dayVol(d)).forEach(([m, sets]) => {
          v[m] = (v[m] || 0) + sets;
        });
      });
      return v;
    },

    /** Volume par muscle pour un jour */
    getDayVolume(state, dayIndex) {
      const d = state.training.days[dayIndex];
      return d ? _dayVol(d) : {};
    },

    /** Historique d'un exercice (toutes les semaines archivées) */
    getExerciseHistory(state, exName) {
      return _exHist(state, exName);
    },

    /** Progression d'un jour (séries validées / total) */
    getDayProgress(state, dayIndex) {
      const d = state.training.days[dayIndex];
      if (!d) return { done: 0, total: 0, pct: 0 };
      const exercises = (d.exercises || []).filter(e => e.name && !e.isWarmup);
      let done = 0, total = 0;
      exercises.forEach(ex => {
        const nSets = parseInt(ex.sets) || 0;
        total += nSets;
        if (ex.setData) {
          done += ex.setData.slice(0, nSets).filter(s => s && s.done).length;
        } else if (ex.done) {
          done += nSets;
        }
      });
      return { done, total, pct: total > 0 ? Math.round(done / total * 100) : 0 };
    },

    /** Progression totale de la séance courante */
    getSessProgress(state) {
      return selectors.getDayProgress(state, state.training.sessDay);
    },

    /** Vérifier si un exercice est un PR */
    isPR(state, dayIndex, exIndex) {
      const ex = (state.training.days[dayIndex] || {}).exercises?.[exIndex];
      if (!ex || !ex.weight || !ex.repsAchieved) return false;
      const hist = _exHist(state, exKey(ex));
      if (!hist.length) return false;
      const maxHist = Math.max(...hist.map(r => calc1RM(r.weight, r.repsAchieved || r.reps)));
      return calc1RM(ex.weight, ex.repsAchieved) > maxHist;
    },

    /** Récupérer le poids suggéré pour la semaine prochaine */
    getSuggestedWeight(state, dayIndex, exIndex) {
      const ex = (state.training.days[dayIndex] || {}).exercises?.[exIndex];
      if (!ex) return null;
      return ex.suggestedNextWeight || ex.weight || null;
    },

    /** Nombre de semaines entraînées */
    getWeeksCount(state) {
      return Object.keys(state.training.history).length;
    },

    /** Résumé de la semaine courante */
    getWeekSummary(state) {
      const t = state.training;
      return {
        weekType:     t.weekType,
        weekCount:    t.weekCount,
        currentBlock: t.currentBlock,
        blockWeek:    t.blockWeek,
        volume:       selectors.getWeekVolume(state),
        daysWithWork: t.days.filter(d =>
          d.exercises && d.exercises.some(e => e.name && !e.isWarmup)
        ).length,
      };
    },

  };

  /* ─────────────────────────────────────────────
     THUNKS — actions complexes multi-dispatch
  ───────────────────────────────────────────── */

  const thunks = {

    /** Archiver la semaine courante et préparer la suivante */
    archiveWeek() {
      const state   = Store.getState();
      const t       = state.training;
      const key     = typeof localDateStr === 'function' ? localDateStr() : new Date().toISOString().slice(0, 10);

      // Snapshot de la semaine
      const weekSnapshot = {
        weekType:   t.weekType,
        weekCount:  t.weekCount,
        block:      t.currentBlock,
        blockWeek:  t.blockWeek,
        date:       key,
        days: t.days.map(d => ({
          date:      d.date,
          muscles:   [...(d.muscles || [])],
          cardio:    { ...(d.cardio || {}) },
          exercises: (d.exercises || []).map(e => ({
            name:          e.name,
            muscle:        e.muscle,
            weight:        e.weight,
            sets:          e.sets,
            reps:          e.reps,
            repsAchieved:  e.repsAchieved || '',
            rpe:           e.rpe || '',
            rir:           e.rir || '',
            note:          e.note || '',
            done:          e.done,
            isWarmup:      e.isWarmup || false,
            supersetGroup: e.supersetGroup || '',
          }))
        }))
      };

      // Planifier les poids de la semaine suivante
      const updatedDays = _planNextWeights(t.days);

      Store.dispatch({
        type: 'TRAINING_ARCHIVE_WEEK',
        payload: {
          history: { ...t.history, [key]: weekSnapshot },
          weekCount: t.weekCount + 1,
        }
      });

      // Mettre à jour les jours avec les poids suggérés
      updatedDays.forEach((day, i) => {
        Store.dispatch({
          type: 'TRAINING_UPDATE_DAY',
          payload: { dayIndex: i, changes: { exercises: day.exercises } },
          skipUndo: true,
        });
      });

      if (typeof showToast === 'function') showToast('Semaine archivée ✓', 'save');
    },

    /** Valider une série et vérifier PR automatiquement */
    validateSet(payload) {
      const { dayIndex, exIndex, setIndex, weight, reps, rpe, rir } = payload;
      const state = Store.getState();

      Store.dispatch({
        type: 'TRAINING_VALIDATE_SET',
        payload: { dayIndex, exIndex, setIndex, weight, reps, rpe: rpe || '', rir: rir || '' }
      });

      // Vérifier PR après validation
      const newState = Store.getState();
      if (selectors.isPR(newState, dayIndex, exIndex)) {
        const ex = newState.training.days[dayIndex].exercises[exIndex];
        if (typeof showToast === 'function') {
          showToast('🏆 PR ! ' + (ex.name || '') + ' — ' + calc1RM(weight, reps).toFixed(1) + ' kg 1RM', 'ok', 3000);
        }
        // Enregistrer le PR
        const prs = { ...newState.training.prs };
        prs[exKey(ex)] = { weight, reps, date: typeof localDateStr === 'function' ? localDateStr() : new Date().toISOString().slice(0, 10) };
        Store.dispatch({ type: 'TRAINING_UPDATE_PRS', payload: prs, skipUndo: true });
      }
    },

    /** Réinitialiser la semaine (garder le planning, effacer les performances) */
    resetWeek() {
      const state = Store.getState();
      const cleanDays = state.training.days.map(d => ({
        ...d,
        exercises: (d.exercises || []).map(ex => ({
          ...ex,
          done:         false,
          repsAchieved: '',
          setData:      null,
        }))
      }));
      cleanDays.forEach((day, i) => {
        Store.dispatch({
          type: 'TRAINING_UPDATE_DAY',
          payload: { dayIndex: i, changes: { exercises: day.exercises } }
        });
      });
      if (typeof showToast === 'function') showToast('Semaine réinitialisée', 'warn');
    },

    /** Synchroniser les muscles d'un jour depuis ses exercices */
    syncMuscles(dayIndex) {
      const state = Store.getState();
      const d = state.training.days[dayIndex];
      if (!d) return;
      const seen = [];
      (d.exercises || [])
        .filter(e => !e.isWarmup && e.muscle)
        .forEach(e => { if (!seen.includes(e.muscle)) seen.push(e.muscle); });
      const muscles = ['', '', ''];
      seen.slice(0, 3).forEach((k, i) => { muscles[i] = k; });
      Store.dispatch({
        type: 'TRAINING_UPDATE_DAY',
        payload: { dayIndex, changes: { muscles } },
        skipUndo: true,
      });
    },

  };

  /* ─────────────────────────────────────────────
     HELPERS PRIVÉS DES THUNKS
  ───────────────────────────────────────────── */

  function _planNextWeights(days) {
    return days.map(d => ({
      ...d,
      exercises: (d.exercises || []).map(ex => {
        if (!ex.weight || !ex.repsAchieved) return ex;
        const cw = parseFloat(ex.weight) || 0;
        let suggested;
        if (shouldOverload(ex)) {
          suggested = String(Math.round((cw * 1.025) / 2.5) * 2.5);
        } else if (isFailure(ex)) {
          suggested = String(Math.round((cw * 0.975) / 2.5) * 2.5);
        } else {
          suggested = ex.weight;
        }
        return { ...ex, suggestedNextWeight: suggested };
      })
    }));
  }

  /* ─────────────────────────────────────────────
     COMPATIBILITÉ — aliases globaux
     Le code existant appelle ces fonctions directement.
     On les réexpose en global pour zéro régression.
  ───────────────────────────────────────────── */

  // Ces fonctions seront disponibles globalement
  // exactement comme avant
  window.calc1RM       = calc1RM;
  window.exKey         = exKey;
  window.shouldOverload = shouldOverload;
  window.isFailure     = isFailure;
  window.isPlateau     = isPlateau;

  // exHist global (utilisé dans renderProgression, etc.)
  window.exHist = function(name) {
    return _exHist(Store.getState(), name);
  };

  // dayVol global
  window.dayVol = function(d) {
    return _dayVol(d);
  };

  // weekVol global
  window.weekVol = function() {
    return selectors.getWeekVolume(Store.getState());
  };

  // archiveWeek global (bouton dans l'UI)
  window.archiveWeek = thunks.archiveWeek;

  /* ─────────────────────────────────────────────
     API PUBLIQUE
  ───────────────────────────────────────────── */
  return {
    // Selectors
    ...selectors,

    // Thunks
    archiveWeek:    thunks.archiveWeek,
    validateSet:    thunks.validateSet,
    resetWeek:      thunks.resetWeek,
    syncMuscles:    thunks.syncMuscles,

    // Helpers exposés
    calc1RM,
    exKey,
    shouldOverload,
    isFailure,
    isPlateau,

    // Accès direct au slice training
    getSlice() { return Store.get('training'); },
  };

})();
