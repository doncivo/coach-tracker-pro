/* ================================================================
   views/settings.js — Vue Paramètres
   ================================================================ */

const SettingsView = {

  render() {
    SettingsView._syncS();
    if (typeof renderSettings === 'function') renderSettings();
  },

  /** Mettre à jour le profil utilisateur */
  setProfil(changes) {
    Store.dispatch({ type: 'APP_SET_PROFIL', payload: changes }, { skipUndo: true });
    // Sync S pour compatibilité
    Object.assign(S, changes);
  },

  /** Basculer dark mode */
  toggleDark() {
    App.toggleDark();
  },

  /** Durée repos (secondes) */
  setRestDuration(sec) {
    Store.dispatch({ type: 'APP_SET_REST_DURATION', payload: sec }, { skipUndo: true });
    S._restDuration = sec;
  },

  /** Bip de repos */
  setRestBeep(val) {
    Store.dispatch({ type: 'APP_SET_REST_BEEP', payload: val }, { skipUndo: true });
    S._restBeep = val;
  },

  /** Définir l'objectif calorique */
  setCalGoal(cal) {
    Store.dispatch({ type: 'ACTIVITY_SET_CALORIES_GOAL', payload: cal });
    S.caloriesGoal = cal;
  },

  /** Définir l'objectif de pas */
  setStepsGoal(steps) {
    Store.dispatch({ type: 'ACTIVITY_SET_STEPS_GOAL', payload: steps });
    S.stepsGoal = steps;
  },

  _syncS() {
    if (typeof S === 'undefined' || typeof Store === 'undefined') return;
    const state = Store.getState();
    // App prefs
    Object.assign(S, state.app);
    // Activity goals
    S.stepsGoal    = state.activity.stepsGoal;
    S.caloriesGoal = state.activity.caloriesGoal;
    S.proteinGoal  = state.activity.proteinGoal;
    S.carbsGoal    = state.activity.carbsGoal;
    S.fatGoal      = state.activity.fatGoal;
    // Body
    S.profilTaille = state.body.profilTaille;
    S.mesures      = state.body.mesures;
  },

};
