/* ================================================================
   views/corps.js — Vue Corps (activité, nutrition, mesures)
   ================================================================ */

const CorpsView = {

  render() {
    CorpsView._syncS();
    if (typeof renderCorps === 'function') renderCorps();
  },

  _syncS() {
    if (typeof S === 'undefined' || typeof Store === 'undefined') return;
    const state = Store.getState();
    S.mesures      = state.body.mesures;
    S.profilTaille = state.body.profilTaille;
    S.photos       = state.body.photos;
    S.painLog      = state.body.painLog;
    S.steps        = state.activity.steps;
    S.calories     = state.activity.calories;
    S.sleep        = state.activity.sleep;
    S.nutrition    = state.activity.nutrition;
    S.stepsGoal    = state.activity.stepsGoal;
    S.caloriesGoal = state.activity.caloriesGoal;
    S.proteinGoal  = state.activity.proteinGoal;
    S.carbsGoal    = state.activity.carbsGoal;
    S.fatGoal      = state.activity.fatGoal;
    S.objective    = state.goals.objective;
    S.profilTaille = state.body.profilTaille;
    S._gender      = state.app._gender;
    S._dob         = state.app._dob;
    S._sleepGoal   = state.app._sleepGoal;
  },

};
