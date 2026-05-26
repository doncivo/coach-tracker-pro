/* ================================================================
   views/calendar.js — Vue Calendrier mensuel
   ================================================================ */

const CalendarView = {

  render() {
    CalendarView._syncS();
    if (typeof renderCalendar === 'function') renderCalendar();
  },

  prevMonth() {
    const state = Store.getState();
    let { calYear, calMonth } = state.app;
    calMonth--;
    if (calMonth < 0) { calMonth = 11; calYear--; }
    Store.dispatch({
      type: 'APP_SET_CAL',
      payload: { year: calYear, month: calMonth }
    }, { skipUndo: true });
    CalendarView.render();
  },

  nextMonth() {
    const state = Store.getState();
    let { calYear, calMonth } = state.app;
    calMonth++;
    if (calMonth > 11) { calMonth = 0; calYear++; }
    Store.dispatch({
      type: 'APP_SET_CAL',
      payload: { year: calYear, month: calMonth }
    }, { skipUndo: true });
    CalendarView.render();
  },

  _syncS() {
    if (typeof S === 'undefined' || typeof Store === 'undefined') return;
    const state = Store.getState();
    S.calYear    = state.app.calYear;
    S.calMonth   = state.app.calMonth;
    S.history    = state.training.history;
    S.calChecks  = state.app.calChecks;
    S.days       = state.training.days;
  },

};
