/* ================================================================
   views/settings.js — Vue Paramètres
   ================================================================ */

const SettingsView = {

  render() {
    try {
      SettingsView._syncS();
      if (typeof renderSettings === 'function') {
        renderSettings();
      } else {
        const w = document.getElementById('settings-wrap');
        if (w) w.innerHTML = '<div style="padding:20px;color:var(--muted)">Chargement des réglages...</div>';
      }
    } catch(e) {
      console.error('[Settings] Erreur render:', e);
      const w = document.getElementById('settings-wrap');
      if (w) {
        w.innerHTML = '';
        const errDiv = document.createElement('div');
        errDiv.style.cssText = 'padding:20px;background:var(--card);border-radius:14px;margin:16px';
        errDiv.innerHTML = '<div style="font-size:16px;font-weight:700;color:var(--red);margin-bottom:8px">Erreur de chargement</div>' +
          '<div style="font-size:12px;color:var(--muted);margin-bottom:12px">' + e.message + '</div>' +
          '<button onclick="renderSettings()" style="padding:8px 16px;border-radius:8px;border:none;background:var(--teal);color:#fff;font-size:14px;font-weight:700;cursor:pointer">Réessayer</button>';
        w.appendChild(errDiv);
      }
    }
  },

  /** Mettre à jour le profil utilisateur */
  setProfil(changes) {
    Store.dispatch({ type: 'APP_SET_PROFIL', payload: changes }, { skipUndo: true });
    // Sync S pour compatibilité
    Object.assign(S, changes);
  },

  /** Basculer dark mode */
  toggleDark() {
    App.toggleDark();
  },

  /** Durée repos (secondes) */
  setRestDuration(sec) {
    Store.dispatch({ type: 'APP_SET_REST_DURATION', payload: sec }, { skipUndo: true });
    S._restDuration = sec;
  },

  /** Bip de repos */
  setRestBeep(val) {
    Store.dispatch({ type: 'APP_SET_REST_BEEP', payload: val }, { skipUndo: true });
    S._restBeep = val;
  },

  /** Définir l'objectif calorique */
  setCalGoal(cal) {
    Store.dispatch({ type: 'ACTIVITY_SET_CALORIES_GOAL', payload: cal });
    S.caloriesGoal = cal;
  },

  /** Définir l'objectif de pas */
  setStepsGoal(steps) {
    Store.dispatch({ type: 'ACTIVITY_SET_STEPS_GOAL', payload: steps });
    S.stepsGoal = steps;
  },

  _syncS() {
    if (typeof S === 'undefined' || typeof Store === 'undefined') return;
    const state = Store.getState();
    // App prefs
    Object.assign(S, state.app);
    // Activity goals
    S.stepsGoal    = state.activity.stepsGoal;
    S.caloriesGoal = state.activity.caloriesGoal;
    S.proteinGoal  = state.activity.proteinGoal;
    S.carbsGoal    = state.activity.carbsGoal;
    S.fatGoal      = state.activity.fatGoal;
    // Body
    S.profilTaille = state.body.profilTaille;
    S.mesures      = state.body.mesures;
  },

};
