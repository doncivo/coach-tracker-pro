/* ================================================================
   store/goals.js — Selectors + Thunks du domaine Goals
   Gère: objectif principal, achievements, liste de goals
   ================================================================ */

const Goals = (() => {

  const selectors = {

    getObjective(state) {
      return state.goals.objective || {};
    },

    getAchievements(state) {
      return state.goals.achievements || {};
    },

    isUnlocked(state, key) {
      return !!(state.goals.achievements || {})[key];
    },

    getGoals(state) {
      return [...(state.goals.goals || [])];
    },

    getProgress(state) {
      const goals = state.goals.goals || [];
      const done  = goals.filter(g => g.done).length;
      return { done, total: goals.length, pct: goals.length ? Math.round(done/goals.length*100) : 0 };
    },

  };

  const thunks = {

    setObjective(obj) {
      Store.dispatch({ type: 'GOALS_SET_OBJECTIVE', payload: obj });
    },

    unlock(key) {
      if (!selectors.isUnlocked(Store.getState(), key)) {
        Store.dispatch({ type: 'GOALS_UNLOCK_ACHIEVEMENT', payload: key });
      }
    },

    addGoal(text) {
      Store.dispatch({ type: 'GOALS_ADD_GOAL', payload: text });
    },

    toggleGoal(index) {
      Store.dispatch({ type: 'GOALS_TOGGLE_GOAL', payload: index });
    },

    removeGoal(index) {
      Store.dispatch({ type: 'GOALS_REMOVE_GOAL', payload: index });
    },

    updateGoal(index, text) {
      Store.dispatch({ type: 'GOALS_UPDATE_GOAL', payload: { index, text } });
    },

  };

  return {
    ...selectors,
    setObjective: thunks.setObjective,
    unlock:       thunks.unlock,
    addGoal:      thunks.addGoal,
    toggleGoal:   thunks.toggleGoal,
    removeGoal:   thunks.removeGoal,
    updateGoal:   thunks.updateGoal,
    getSlice()   { return Store.get('goals'); },
  };

})();
