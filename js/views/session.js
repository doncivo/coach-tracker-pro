/* ================================================================
   views/session.js — Vue Séance (entraînement actif)
   ================================================================ */

const SessionView = {

  render() {
    SessionView._syncS();
    if (typeof renderSession === 'function') renderSession();
  },

  /** Changer le jour de séance */
  setSessDay(dayIndex) {
    Store.dispatch({
      type: 'TRAINING_SET_SESS_DAY',
      payload: dayIndex
    }, { skipUndo: true });
    S.sessDay      = dayIndex;
    S.sessStartTime = Date.now();
    SessionView.render();
  },

  /** Enregistrer la récupération */
  setRecovery(dayKey, value) {
    Store.dispatch({
      type: 'TRAINING_SET_RECOVERY',
      payload: { [dayKey]: value }
    }, { skipUndo: true });
    S.sessRecovery = Store.getState().training.sessRecovery;
  },

  /** Valider une série */
  validateSet(payload) {
    Training.validateSet(payload);
    SessionView._syncS();
  },

  /** Démarrer la séance (enregistrer l'heure) */
  start() {
    const now = Date.now();
    Store.dispatch({
      type: 'TRAINING_UPDATE_DAY',
      payload: { dayIndex: Store.getState().training.sessDay, changes: {} }
    }, { skipUndo: true });
    S.sessStartTime = now;
  },

  _syncS() {
    if (typeof S === 'undefined' || typeof Store === 'undefined') return;
    const state = Store.getState();
    S.days         = state.training.days;
    S.sessDay      = state.training.sessDay;
    S.sessStartTime = state.training.sessStartTime;
    S.sessRecovery = state.training.sessRecovery;
    S.history      = state.training.history;
    S.prs          = state.training.prs;
    S.nutrition    = state.activity.nutrition;
    S.mesures      = state.body.mesures;
    S.objective    = state.goals.objective;
    S._restDuration = state.app._restDuration;
    S._restBeep    = state.app._restBeep;
    S.exViewMode   = state.app.exViewMode;
    S.activeDay    = state.training.activeDay;
    S.weekType     = state.training.weekType;
  },

};
