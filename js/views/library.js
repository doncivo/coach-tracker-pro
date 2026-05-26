/* ================================================================
   views/library.js — Vue Bibliothèque d'exercices

   Wrapper qui:
   1. Récupère les données statiques (EXERCISE_LIBRARY, MUSCLES)
   2. Délègue au renderer existant render_other.js
   3. Ne modifie jamais le state directement
   ================================================================ */

const LibraryView = {

  /** Point d'entrée appelé par Router */
  render() {
    // Sync S depuis Store pour la compat render_other.js
    LibraryView._syncS();
    // Appel du renderer existant
    if (typeof renderLibrary === 'function') renderLibrary();
  },

  /** Ajouter un exercice de la lib au planning */
  addToDay(exercise, dayIndex) {
    const di = dayIndex !== undefined ? dayIndex : Store.getState().training.activeDay;
    const newEx = {
      id:            Compute.uid(),
      name:          exercise.name,
      muscle:        exercise.muscle,
      weight:        '',
      sets:          3,
      reps:          '8-12',
      rest:          '',
      tempo:         '',
      repsAchieved:  '',
      rpe:           '',
      rir:           '',
      note:          '',
      done:          false,
      setData:       null,
      isWarmup:      false,
      supersetGroup: '',
    };
    Store.dispatch({
      type:    'TRAINING_ADD_EXERCISE',
      payload: { dayIndex: di, exercise: newEx }
    });
    if (typeof showToast === 'function') {
      const days = typeof DAYS !== 'undefined' ? DAYS : ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
      showToast(`${exercise.name} ajouté à ${days[di]}`, 'save');
    }
  },

  _syncS() {
    if (typeof S === 'undefined' || typeof Store === 'undefined') return;
    const state = Store.getState();
    S.activeDay = state.training.activeDay;
  },

};

// Alias global pour compatibilité Router
window.renderLibrary = function() {
  LibraryView._syncS();
  // Le renderer existant dans render_other.js
  if (typeof _renderLibraryOriginal === 'function') {
    _renderLibraryOriginal();
  }
};
