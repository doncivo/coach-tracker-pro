/* ================================================================
   views/kpi.js — Vue KPI & Analyse avancée
   ================================================================ */

const KPIView = {

  render() {
    KPIView._syncS();
    if (typeof renderKPI === 'function') renderKPI();
  },

  _syncS() {
    if (typeof S === 'undefined' || typeof Store === 'undefined') return;
    const state = Store.getState();
    // Training
    S.days         = state.training.days;
    S.history      = state.training.history;
    S.prs          = state.training.prs;
    S.weekType     = state.training.weekType;
    S.weekCount    = state.training.weekCount;
    S.currentBlock = state.training.currentBlock;
    S.sessRecovery = state.training.sessRecovery;
    // Activity
    S.steps        = state.activity.steps;
    S.sleep        = state.activity.sleep;
    S.calories     = state.activity.calories;
    S.nutrition    = state.activity.nutrition;
    S.stepsGoal    = state.activity.stepsGoal;
    S.caloriesGoal = state.activity.caloriesGoal;
    // Body
    S.mesures      = state.body.mesures;
    S.profilTaille = state.body.profilTaille;
    S.painLog      = state.body.painLog;
    // App
    S._gender      = state.app._gender;
    S._dob         = state.app._dob;
    S._sleepGoal   = state.app._sleepGoal;
    // Goals
    S.objective    = state.goals.objective;
  },

};
