/* ================================================================
   views/achievements.js — Vue Objectifs & Badges
   ================================================================ */

const AchievementsView = {

  render() {
    AchievementsView._syncS();
    if (typeof renderAchievements === 'function') renderAchievements();
  },

  /** Définir ou mettre à jour l'objectif */
  setObjective(obj) {
    Store.dispatch({ type: 'GOALS_SET_OBJECTIVE', payload: obj });
    AchievementsView.render();
  },

  /** Débloquer un badge */
  unlock(key) {
    Goals.unlock(key);
  },

  _syncS() {
    if (typeof S === 'undefined' || typeof Store === 'undefined') return;
    const state = Store.getState();
    S.objective    = state.goals.objective;
    S.achievements = state.goals.achievements;
    S.history      = state.training.history;
    S.days         = state.training.days;
    S.mesures      = state.body.mesures;
    S.steps        = state.activity.steps;
    S.stepsGoal    = state.activity.stepsGoal;
    S.sleep        = state.activity.sleep;
  },

};
