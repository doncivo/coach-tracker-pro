/* ================================================================
   views/dashboard.js — Vue Tableau de bord
   ================================================================ */

const DashboardView = {

  render() {
    DashboardView._syncS();
    if (typeof renderDashboard === 'function') renderDashboard();
  },

  _syncS() {
    if (typeof S === 'undefined' || typeof Store === 'undefined') return;
    const state = Store.getState();
    S.days         = state.training.days;
    S.weekType     = state.training.weekType;
    S.currentBlock = state.training.currentBlock;
    S.history      = state.training.history;
    S.prs          = state.training.prs;
    S.mesures      = state.body.mesures;
    S.steps        = state.activity.steps;
    S.calories     = state.activity.calories;
    S.sleep        = state.activity.sleep;
    S.stepsGoal    = state.activity.stepsGoal;
    S.caloriesGoal = state.activity.caloriesGoal;
    S.proteinGoal  = state.activity.proteinGoal;
    S.carbsGoal    = state.activity.carbsGoal;
    S.fatGoal      = state.activity.fatGoal;
    S._sleepGoal   = state.app._sleepGoal;
    S.objective    = state.goals.objective;
    S.achievements = state.goals.achievements;
    S.painLog      = state.body.painLog;
    S.sessRecovery = state.training.sessRecovery;
    S._gender      = state.app._gender;
    S._dob         = state.app._dob;
    S._level       = state.app._level;
    S.profilTaille = state.body.profilTaille;
    S.profilAge    = state.body.profilAge    || 30;
    S.profilSexe   = state.body.profilSexe   || state.app._gender || 'H';
  },

};
