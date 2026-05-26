/* ================================================================
   store/body.js — Selectors + Thunks du domaine Body
   Gère: mesures corporelles, photos, douleurs, taille profil
   ================================================================ */

const Body = (() => {

  const selectors = {

    getLastMesure(state, key) {
      const list = (state.body.mesures[key] || []);
      return list.length ? list[list.length - 1] : null;
    },

    getMesureHistory(state, key) {
      return [...(state.body.mesures[key] || [])];
    },

    getBMI(state) {
      const taille = (state.body.profilTaille || 175) / 100;
      const poids  = parseFloat((state.body.mesures.poids || [])[0]?.value
                     || (state.body.mesures.poids || [])[0] || 0);
      if (!poids || !taille) return 0;
      return Math.round(poids / (taille * taille) * 10) / 10;
    },

    getLastWeight(state) {
      const list = state.body.mesures.poids || [];
      return list.length ? parseFloat(list[list.length-1].value || list[list.length-1]) || 0 : 0;
    },

    getPainLog(state) {
      return [...(state.body.painLog || [])];
    },

    getPhotos(state) {
      return [...(state.body.photos || [])];
    },

  };

  const thunks = {

    addMesure(key, value, date) {
      Store.dispatch({
        type: 'BODY_ADD_MESURE',
        payload: {
          key,
          entry: { value: parseFloat(value) || 0, date: date || new Date().toISOString().slice(0,10) }
        }
      });
    },

    removeMesure(key, index) {
      Store.dispatch({ type: 'BODY_REMOVE_MESURE', payload: { key, index } });
    },

    setTaille(value) {
      Store.dispatch({ type: 'BODY_SET_TAILLE', payload: parseInt(value) || 175 });
    },

    addPain(entry) {
      Store.dispatch({ type: 'BODY_ADD_PAIN', payload: entry });
    },

    removePain(index) {
      Store.dispatch({ type: 'BODY_REMOVE_PAIN', payload: index });
    },

    addPhoto(entry) {
      Store.dispatch({ type: 'BODY_ADD_PHOTO', payload: entry });
    },

  };

  return {
    ...selectors,
    addMesure:   thunks.addMesure,
    removeMesure: thunks.removeMesure,
    setTaille:   thunks.setTaille,
    addPain:     thunks.addPain,
    removePain:  thunks.removePain,
    addPhoto:    thunks.addPhoto,
    getSlice()  { return Store.get('body'); },
  };

})();
