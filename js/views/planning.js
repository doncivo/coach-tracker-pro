/* ================================================================
   views/planning.js — Vue Planning hebdomadaire
   ================================================================ */

const PlanningView = {

  render() {
    PlanningView._syncS();
    if (typeof renderDayTabs === 'function') {
      renderDayTabs();
      renderDayDetail(Store.getState().training.activeDay || 0);
    }
  },

  setActiveDay(dayIndex) {
    Store.dispatch({
      type: 'TRAINING_SET_ACTIVE_DAY',
      payload: dayIndex
    }, { skipUndo: true });
    S.activeDay = dayIndex;
    if (typeof renderDayDetail === 'function') renderDayDetail(dayIndex);
    if (typeof renderDayTabs   === 'function') renderDayTabs();
  },

  setExViewMode(mode) {
    Store.dispatch({
      type: 'APP_SET_EX_VIEW',
      payload: mode
    }, { skipUndo: true });
    S.exViewMode = mode;
    PlanningView.render();
  },

  setSessDay(dayIndex) {
    Store.dispatch({
      type: 'TRAINING_SET_SESS_DAY',
      payload: dayIndex
    }, { skipUndo: true });
    S.sessDay = dayIndex;
  },

  _syncS() {
    if (typeof S === 'undefined' || typeof Store === 'undefined') return;
    const state = Store.getState();
    S.days         = state.training.days;
    S.activeDay    = state.training.activeDay;
    S.sessDay      = state.training.sessDay;
    S.weekType     = state.training.weekType;
    S.weekCount    = state.training.weekCount;
    S.currentBlock = state.training.currentBlock;
    S.blockWeek    = state.training.blockWeek;
    S.history      = state.training.history;
    S.prs          = state.training.prs;
    S.goals        = state.goals.goals;
    S.exViewMode   = state.app.exViewMode;
    S._daysPerWeek = state.app._daysPerWeek;
    S._level       = state.app._level;
  },

};
