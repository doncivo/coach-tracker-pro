/* ================================================================
   views/bilan.js — Vue Bilan hebdomadaire
   ================================================================ */

const BilanView = {

  render() {
    BilanView._syncS();
    if (typeof renderBilan === 'function') renderBilan();
  },

  prevWeek() {
    const state = Store.getState();
    Store.dispatch({
      type: 'TRAINING_SET_BILAN_OFFSET',
      payload: state.training.bilanOffset + 1
    }, { skipUndo: true });
    BilanView.render();
  },

  nextWeek() {
    const state = Store.getState();
    const offset = state.training.bilanOffset;
    if (offset <= 0) return;
    Store.dispatch({
      type: 'TRAINING_SET_BILAN_OFFSET',
      payload: offset - 1
    }, { skipUndo: true });
    BilanView.render();
  },

  _syncS() {
    if (typeof S === 'undefined' || typeof Store === 'undefined') return;
    const state = Store.getState();
    S.history      = state.training.history;
    S.days         = state.training.days;
    S.weekType     = state.training.weekType;
    S.weekCount    = state.training.weekCount;
    S.currentBlock = state.training.currentBlock;
    S.blockWeek    = state.training.blockWeek;
    S.bilanOffset  = state.training.bilanOffset;
    S.steps        = state.activity.steps;
    S.sleep        = state.activity.sleep;
    S.calories     = state.activity.calories;
    S.stepsGoal    = state.activity.stepsGoal;
    S.caloriesGoal = state.activity.caloriesGoal;
    S.proteinGoal  = state.activity.proteinGoal;
    S.carbsGoal    = state.activity.carbsGoal;
    S.fatGoal      = state.activity.fatGoal;
    S.nutrition    = state.activity.nutrition;
    S.mesures      = state.body.mesures;
    S.profilTaille = state.body.profilTaille;
    S._gender      = state.app._gender;
    S._dob         = state.app._dob;
  },

};
