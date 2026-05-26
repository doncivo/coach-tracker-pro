/* ================================================================
   views/progression.js — Vue Progression des exercices
   ================================================================ */

const ProgressionView = {

  render() {
    ProgressionView._syncS();
    if (typeof renderProgression === 'function') renderProgression();
  },

  _syncS() {
    if (typeof S === 'undefined' || typeof Store === 'undefined') return;
    const state = Store.getState();
    S.history      = state.training.history;
    S.days         = state.training.days;
    S.prs          = state.training.prs;
    S.weekType     = state.training.weekType;
    S.weekCount    = state.training.weekCount;
    S.currentBlock = state.training.currentBlock;
    S.mesures      = state.body.mesures;
    S.profilTaille = state.body.profilTaille;
    S._gender      = state.app._gender;
  },

};
