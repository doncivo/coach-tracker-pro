/* ================================================================
   store/activity.js — Selectors + Thunks du domaine Activity

   Gère: steps, calories (repas), sleep, nutrition (deficit/maint/surplus)
         stepsGoal, caloriesGoal, proteinGoal, carbsGoal, fatGoal

   Structure des données:
   - steps:     { 'YYYY-MM-DD': number }
   - calories:  { 'YYYY-MM-DD': { meals: [{items:[{name,cal,prot,carbs,fat}]}] } }
   - sleep:     { 'YYYY-MM-DD': { hours: number, quality: number } }
   - nutrition: { 'YYYY-MM-DD': 'deficit'|'maint'|'surplus' }
   ================================================================ */

const Activity = (() => {

  /* ─────────────────────────────────────────────
     HELPERS PRIVÉS
  ───────────────────────────────────────────── */

  /** Derniers N jours sous forme 'YYYY-MM-DD' */
  function _lastNDays(n) {
    return Array.from({ length: n }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().slice(0, 10);
    }).reverse();
  }

  /** Calculer les calories totales d'une journée */
  function _calForDay(activity, dateStr) {
    const day = activity.calories[dateStr];
    if (!day || !day.meals) return 0;
    return day.meals.reduce((total, meal) => {
      return total + (meal.items || []).reduce((t, item) => t + (parseFloat(item.cal) || 0), 0);
    }, 0);
  }

  /** Calculer les macros d'une journée */
  function _macrosForDay(activity, dateStr) {
    const day = activity.calories[dateStr];
    const result = { cal: 0, prot: 0, carbs: 0, fat: 0 };
    if (!day || !day.meals) return result;
    day.meals.forEach(meal => {
      (meal.items || []).forEach(item => {
        result.cal   += parseFloat(item.cal)   || 0;
        result.prot  += parseFloat(item.prot)  || 0;
        result.carbs += parseFloat(item.carbs) || 0;
        result.fat   += parseFloat(item.fat)   || 0;
      });
    });
    return result;
  }

  /** Obtenir les heures de sommeil d'un jour */
  function _sleepHours(activity, dateStr) {
    const s = activity.sleep[dateStr];
    if (!s) return 0;
    return parseFloat(s.hours || s.h || s) || 0;
  }

  /* ─────────────────────────────────────────────
     SELECTORS
  ───────────────────────────────────────────── */
  const selectors = {

    /** Pas du jour */
    getStepsToday(state) {
      const today = new Date().toISOString().slice(0, 10);
      return parseInt(state.activity.steps[today] || 0) || 0;
    },

    /** Données pas sur N jours */
    getStepsLastDays(state, n) {
      n = n || 7;
      return _lastNDays(n).map(d => ({
        date: d,
        value: parseInt(state.activity.steps[d] || 0) || 0,
      }));
    },

    /** Calories consommées aujourd'hui */
    getCaloriesToday(state) {
      const today = new Date().toISOString().slice(0, 10);
      return _calForDay(state.activity, today);
    },

    /** Macros du jour */
    getMacrosToday(state) {
      const today = new Date().toISOString().slice(0, 10);
      return _macrosForDay(state.activity, today);
    },

    /** Calories sur N jours */
    getCalLastDays(state, n) {
      n = n || 7;
      return _lastNDays(n).map(d => ({
        date:  d,
        cal:   _calForDay(state.activity, d),
        macros: _macrosForDay(state.activity, d),
      }));
    },

    /** Heures de sommeil aujourd'hui */
    getSleepToday(state) {
      const today = new Date().toISOString().slice(0, 10);
      return _sleepHours(state.activity, today);
    },

    /** Données sommeil sur N jours */
    getSleepLastDays(state, n) {
      n = n || 7;
      return _lastNDays(n).map(d => ({
        date:    d,
        hours:   _sleepHours(state.activity, d),
        quality: (state.activity.sleep[d] || {}).quality || 0,
      }));
    },

    /** Moyenne de sommeil sur N jours */
    getAvgSleep(state, n) {
      n = n || 7;
      const days = _lastNDays(n);
      const total = days.reduce((sum, d) => sum + _sleepHours(state.activity, d), 0);
      return Math.round(total / n * 10) / 10;
    },

    /** Statut nutrition du jour (deficit/maint/surplus) */
    getNutritionToday(state) {
      const today = new Date().toISOString().slice(0, 10);
      return state.activity.nutrition[today] || '';
    },

    /** Bilan nutrition sur N jours */
    getNutritionLastDays(state, n) {
      n = n || 7;
      return _lastNDays(n).map(d => ({
        date:  d,
        value: state.activity.nutrition[d] || '',
      }));
    },

    /** Calcul TDEE (dépense énergétique totale) */
    getTDEE(state) {
      const body     = state.body;
      const training = state.training;
      const app      = state.app;

      const poids  = parseFloat((body.mesures.poids || [])[0]?.value || 70) || 70;
      const taille = parseFloat(body.profilTaille) || 175;
      const gender = app._gender || 'm';

      // Âge depuis date de naissance
      let age = 30;
      if (app._dob) {
        const dob = new Date(app._dob);
        age = Math.floor((Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
      }

      // BMR (Mifflin-St Jeor)
      const bmr = gender === 'f'
        ? 10 * poids + 6.25 * taille - 5 * age - 161
        : 10 * poids + 6.25 * taille - 5 * age + 5;

      // Multiplicateur d'activité basé sur les séances réelles
      const days7 = _lastNDays(7);
      const sessions = days7.filter(d =>
        training.history[d] && training.history[d].days &&
        training.history[d].days.some(day =>
          day.exercises && day.exercises.some(e => e.done)
        )
      ).length;

      const mult = sessions >= 5 ? 1.725
                 : sessions >= 3 ? 1.55
                 : sessions >= 1 ? 1.375
                 : 1.2;

      return {
        tdee:     Math.round(bmr * mult),
        bmr:      Math.round(bmr),
        mult,
        sessions,
      };
    },

    /** Calcul des macros recommandées */
    getMacroTargets(state) {
      const { tdee } = selectors.getTDEE(state);
      const goal   = state.activity.caloriesGoal || tdee;
      const pGoal  = state.activity.proteinGoal;
      const cGoal  = state.activity.carbsGoal;
      const fGoal  = state.activity.fatGoal;

      // Si objectifs personnalisés définis, les utiliser
      if (pGoal > 0 && cGoal > 0 && fGoal > 0) {
        return { cal: goal, prot: pGoal, carbs: cGoal, fat: fGoal };
      }

      // Sinon: calcul automatique (40/35/25)
      return {
        cal:   goal,
        prot:  Math.round(goal * 0.30 / 4), // 30% protéines
        carbs: Math.round(goal * 0.45 / 4), // 45% glucides
        fat:   Math.round(goal * 0.25 / 9), // 25% lipides
      };
    },

    /** Résumé activity complet pour le dashboard */
    getSummary(state) {
      const today   = new Date().toISOString().slice(0, 10);
      const act     = state.activity;
      return {
        stepsToday:    selectors.getStepsToday(state),
        stepsGoal:     act.stepsGoal,
        stepsPct:      Math.min(100, Math.round(selectors.getStepsToday(state) / (act.stepsGoal || 10000) * 100)),
        calToday:      selectors.getCaloriesToday(state),
        calGoal:       act.caloriesGoal,
        calPct:        Math.min(100, Math.round(selectors.getCaloriesToday(state) / (act.caloriesGoal || 2500) * 100)),
        sleepToday:    selectors.getSleepToday(state),
        sleepGoal:     state.app._sleepGoal || 8,
        nutritionToday: selectors.getNutritionToday(state),
      };
    },

  };

  /* ─────────────────────────────────────────────
     THUNKS — actions complexes
  ───────────────────────────────────────────── */
  const thunks = {

    /** Enregistrer les pas du jour */
    setSteps(value, dateStr) {
      const date = dateStr || new Date().toISOString().slice(0, 10);
      Store.dispatch({
        type: 'ACTIVITY_SET_STEPS',
        payload: { date, value: parseInt(value) || 0 }
      });
    },

    /** Enregistrer le sommeil */
    setSleep(hours, quality, dateStr) {
      const date = dateStr || new Date().toISOString().slice(0, 10);
      Store.dispatch({
        type: 'ACTIVITY_SET_SLEEP',
        payload: { date, value: { hours: parseFloat(hours) || 0, quality: quality || 0 } }
      });
    },

    /** Définir le statut nutrition du jour */
    setNutrition(status, dateStr) {
      const date = dateStr || new Date().toISOString().slice(0, 10);
      Store.dispatch({
        type: 'ACTIVITY_SET_NUTRITION',
        payload: { [date]: status }
      });
    },

    /** Ajouter un aliment à un repas */
    addMealItem(meal, item, dateStr) {
      const date = dateStr || new Date().toISOString().slice(0, 10);
      Store.dispatch({
        type: 'ACTIVITY_ADD_MEAL_ITEM',
        payload: { date, meal, item }
      });
    },

    /** Supprimer un aliment d'un repas */
    removeMealItem(meal, itemIndex, dateStr) {
      const date = dateStr || new Date().toISOString().slice(0, 10);
      Store.dispatch({
        type: 'ACTIVITY_REMOVE_MEAL_ITEM',
        payload: { date, meal, itemIndex }
      });
    },

    /** Mettre à jour les objectifs caloriques et macros */
    setGoals(goals) {
      if (goals.calories !== undefined) {
        Store.dispatch({ type: 'ACTIVITY_SET_CALORIES_GOAL', payload: goals.calories });
      }
      if (goals.steps !== undefined) {
        Store.dispatch({ type: 'ACTIVITY_SET_STEPS_GOAL', payload: goals.steps });
      }
      if (goals.protein !== undefined || goals.carbs !== undefined || goals.fat !== undefined) {
        Store.dispatch({
          type: 'ACTIVITY_SET_MACRO_GOALS',
          payload: {
            protein: goals.protein || 0,
            carbs:   goals.carbs   || 0,
            fat:     goals.fat     || 0,
          }
        });
      }
    },

    /** Calculer et appliquer les macros automatiquement selon TDEE + objectif */
    setMacrosFromObjective(objective) {
      const state    = Store.getState();
      const body     = state.body;
      const app      = state.app;
      const training = state.training;

      const poids  = parseFloat((body.mesures.poids || []).slice(-1)[0]?.value || 70);
      const taille = parseFloat(body.profilTaille) || 175;
      const gender = app._gender || 'm';
      let age = 30;
      if (app._dob) {
        const dob = new Date(app._dob);
        age = Math.floor((Date.now() - dob) / (1000 * 60 * 60 * 24 * 365.25));
      }

      const bmr  = Compute.calcBMR(poids, taille, age, gender);
      const days7 = Compute.lastNDays(7);
      const sessions = days7.filter(d =>
        training.history[d] &&
        training.history[d].days &&
        training.history[d].days.some(day =>
          day.exercises && day.exercises.some(e => e.done)
        )
      ).length;
      const { tdee } = Compute.calcTDEE(bmr, sessions);

      // Objectif → ajustement calorique
      const obj      = objective || state.goals.objective;
      const goalText = ((obj && obj.text) || '').toLowerCase();
      let targetCal  = tdee;
      if      (goalText.includes('prise') || goalText.includes('muscle') || goalText.includes('bulk'))
        targetCal = Math.round(tdee * 1.10);
      else if (goalText.includes('perte') || goalText.includes('sèche') || goalText.includes('cut'))
        targetCal = Math.round(tdee * 0.82);

      const goal   = goalText.includes('muscle') || goalText.includes('bulk') ? 'bulk'
                   : goalText.includes('perte')  || goalText.includes('sèche') ? 'cut'
                   : 'maint';
      const macros = Compute.calcMacros(targetCal, goal);

      Store.dispatch({ type: 'ACTIVITY_SET_CALORIES_GOAL', payload: targetCal });
      Store.dispatch({ type: 'ACTIVITY_SET_MACRO_GOALS', payload: {
        protein: macros.prot,
        carbs:   macros.carbs,
        fat:     macros.fat,
      }});

      if (typeof showToast === 'function') {
        const msg = 'Macros: ' + macros.prot + 'g prot · ' + macros.carbs + 'g gluc · ' +
                    macros.fat + 'g lip (' + targetCal + ' kcal)';
        showToast('🥗 ' + msg, 'save', 4000);
      }
      return { tdee, targetCal, macros };
    },

  };

  /* ─────────────────────────────────────────────
     COMPATIBILITÉ — fonctions globales legacy
  ───────────────────────────────────────────── */

  // computeTDEE global (utilisé dans renderDashboard, renderBilan)
  window.computeTDEE = function() {
    return selectors.getTDEE(Store.getState());
  };

  // Accès direct aux données activity depuis le code existant
  // (les vues lisent encore S.steps, S.calories, etc.)
  // Ces fonctions permettent au nouveau code d'utiliser Activity.*
  // sans casser l'ancien

  /* ─────────────────────────────────────────────
     API PUBLIQUE
  ───────────────────────────────────────────── */
  return {
    // Selectors
    ...selectors,

    // Thunks
    setSteps:      thunks.setSteps,
    setSleep:      thunks.setSleep,
    setNutrition:  thunks.setNutrition,
    addMealItem:   thunks.addMealItem,
    removeMealItem: thunks.removeMealItem,
    setGoals:      thunks.setGoals,
    setMacrosFromObjective: thunks.setMacrosFromObjective,

    // Helpers exposés
    calForDay:    (dateStr) => _calForDay(Store.getState().activity, dateStr),
    macrosForDay: (dateStr) => _macrosForDay(Store.getState().activity, dateStr),
    sleepHours:   (dateStr) => _sleepHours(Store.getState().activity, dateStr),
    lastNDays:    _lastNDays,

    // Accès direct au slice
    getSlice() { return Store.get('activity'); },
  };

})();
