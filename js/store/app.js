/* ================================================================
   store/app.js — Selectors + Thunks du domaine App
   Gère: tab actif, dark mode, préférences UI, profil utilisateur
   ================================================================ */

const App = (() => {

  const selectors = {

    getCurrentTab(state)    { return state.app._currentTab || 'dashboard'; },
    isDarkMode(state)       { return !!state.app.darkMode; },
    getExViewMode(state)    { return state.app.exViewMode || 'compact'; },
    getNotes(state)         { return state.app.notes || ''; },
    getRestDuration(state)  { return state.app._restDuration || 90; },
    getRestBeep(state)      { return state.app._restBeep !== false; },
    getProfil(state) {
      return {
        gender:     state.app._gender      || 'm',
        dob:        state.app._dob         || '',
        level:      state.app._level       || 'intermediaire',
        daysPerWeek:state.app._daysPerWeek || 4,
        place:      state.app._place       || 'salle',
        sleepGoal:  state.app._sleepGoal   || 8,
        startDate:  state.app._startDate   || '',
      };
    },

  };

  const thunks = {

    toggleDark() {
      const isDark = !Store.getState().app.darkMode;
      Store.dispatch({ type: 'APP_TOGGLE_DARK' }, { skipUndo: true });
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
      const btn = document.getElementById('darkmode-btn');
      if (btn) btn.textContent = isDark ? '☀️' : '🌙';
    },

    setNotes(text) {
      Store.dispatch({ type: 'APP_SET_NOTES', payload: text }, { skipUndo: true });
    },

    setRestDuration(sec) {
      Store.dispatch({ type: 'APP_SET_REST_DURATION', payload: sec }, { skipUndo: true });
    },

    setRestBeep(val) {
      Store.dispatch({ type: 'APP_SET_REST_BEEP', payload: val }, { skipUndo: true });
    },

    setReminder(hour, minute) {
      Store.dispatch({ type: 'APP_SET_REMINDER', payload: { hour, minute } }, { skipUndo: true });
    },

    setProfil(profil) {
      Store.dispatch({ type: 'APP_SET_PROFIL', payload: profil }, { skipUndo: true });
    },

    setCalMonth(year, month) {
      Store.dispatch({ type: 'APP_SET_CAL', payload: { year, month } }, { skipUndo: true });
    },

  };

  return {
    ...selectors,
    toggleDark:      thunks.toggleDark,
    setNotes:        thunks.setNotes,
    setRestDuration: thunks.setRestDuration,
    setRestBeep:     thunks.setRestBeep,
    setReminder:     thunks.setReminder,
    setProfil:       thunks.setProfil,
    setCalMonth:     thunks.setCalMonth,
    getSlice()      { return Store.get('app'); },
  };

})();
