/* ================================================================
   services/notify.js — Notifications & rappels d'entraînement

   Responsabilités:
   - Demander la permission notifications
   - Envoyer des notifications locales (Notification API)
   - Planifier un rappel quotidien récurrent
   - Annuler le rappel
   - Restaurer le rappel au démarrage (depuis Store)
   - Notification de fin de repos (chrono séance)
   ================================================================ */

const Notify = (() => {

  const ICON   = './icons/icon-192.png';
  const BADGE  = './icons/favicon-32.png';

  /* ─────────────────────────────────────────────
     PERMISSION
  ───────────────────────────────────────────── */

  async function requestPermission() {
    if (!('Notification' in window)) {
      if (typeof showToast === 'function')
        showToast('Notifications non supportées sur ce navigateur', 'warn');
      return false;
    }
    if (Notification.permission === 'granted') return true;

    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      if (typeof showToast === 'function')
        showToast('✅ Notifications activées !', 'save');
      return true;
    }
    if (typeof showToast === 'function')
      showToast('Notifications refusées — vérifiez les réglages Safari', 'warn');
    return false;
  }

  function isGranted() {
    return typeof Notification !== 'undefined' &&
           Notification.permission === 'granted';
  }

  /* ─────────────────────────────────────────────
     ENVOI IMMÉDIAT
  ───────────────────────────────────────────── */

  function send(title, body, opts) {
    if (!isGranted()) return;
    try {
      new Notification(title, Object.assign({
        body,
        icon:  ICON,
        badge: BADGE,
        vibrate: [200, 100, 200],
      }, opts || {}));
    } catch(e) {
      Errors.warn('Notification échouée', 'notify.js', e.message);
    }
  }

  /* ─────────────────────────────────────────────
     NOTIFICATION FIN DE REPOS (chrono séance)
  ───────────────────────────────────────────── */

  function scheduleRest(seconds) {
    if (!isGranted()) return;
    if (window._restNotifTimer) clearTimeout(window._restNotifTimer);
    window._restNotifTimer = setTimeout(() => {
      send('⏰ Repos terminé !', 'Prêt pour la série suivante ?');
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([300, 100, 300]);
      }
    }, seconds * 1000);
  }

  function cancelRest() {
    if (window._restNotifTimer) {
      clearTimeout(window._restNotifTimer);
      window._restNotifTimer = null;
    }
  }

  /* ─────────────────────────────────────────────
     RAPPEL QUOTIDIEN RÉCURRENT
  ───────────────────────────────────────────── */

  function _getNextMs(hour, minute) {
    const now  = new Date();
    const next = new Date();
    next.setHours(hour, minute, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next - now;
  }

  function _buildReminderMessage() {
    try {
      const state  = Store.getState();
      const today  = new Date();
      const dayIdx = (today.getDay() + 6) % 7; // lundi=0
      const day    = state.training.days[dayIdx];
      if (!day) return { title: "💪 C'est l'heure !", body: 'Ouvre Coach Tracker Pro.' };

      const exs = (day.exercises || [])
        .filter(e => e.name && e.name.trim() && !e.isWarmup);

      if (exs.length === 0) {
        return {
          title: '😴 Journée de repos',
          body:  'Récupération active recommandée.',
        };
      }

      const names   = exs.slice(0, 2).map(e => e.name).join(', ');
      const extra   = exs.length > 2 ? ` +${exs.length - 2}` : '';
      const muscles = [...new Set((day.muscles || []).filter(Boolean))].join(', ');

      return {
        title: "💪 C'est l'heure de t'entraîner !",
        body:  `${exs.length} exercice${exs.length > 1 ? 's' : ''} — ${names}${extra}` +
               (muscles ? ` (${muscles})` : ''),
      };
    } catch(_) {
      return { title: "💪 C'est l'heure !", body: 'Ouvre Coach Tracker Pro.' };
    }
  }

  function schedule(hour, minute) {
    // Sauvegarder dans le Store
    Store.dispatch({
      type:    'APP_SET_REMINDER',
      payload: { hour, minute }
    }, { skipUndo: true });

    // Annuler le timer précédent
    _cancel();

    function fire() {
      const { title, body } = _buildReminderMessage();
      send(title, body);
      // Replanifier pour demain même heure
      window._reminderTimeout = setTimeout(fire, _getNextMs(hour, minute));
    }

    window._reminderTimeout = setTimeout(fire, _getNextMs(hour, minute));

    const hh = String(hour).padStart(2, '0');
    const mm = String(minute).padStart(2, '0');
    if (typeof showToast === 'function')
      showToast(`🔔 Rappel planifié à ${hh}:${mm}`, 'ok', 3000);
  }

  function _cancel() {
    if (window._reminderTimeout) {
      clearTimeout(window._reminderTimeout);
      window._reminderTimeout = null;
    }
  }

  function cancel() {
    _cancel();
    Store.dispatch({
      type:    'APP_SET_REMINDER',
      payload: { hour: null, minute: null }
    }, { skipUndo: true });
    if (typeof showToast === 'function')
      showToast('🔕 Rappel annulé', 'warn', 2000);
  }

  /** Restaurer au démarrage depuis le Store */
  function restore() {
    const state = Store.getState();
    const h = state.app._reminderHour;
    const m = state.app._reminderMinute;
    if (h != null && m != null) {
      schedule(h, m);
    }
  }

  /* ─────────────────────────────────────────────
     COMPATIBILITÉ — fonctions globales legacy
  ───────────────────────────────────────────── */

  window.requestNotifPermission    = requestPermission;
  window.sendLocalNotif            = (title, body, icon) => send(title, body, icon ? {icon} : {});
  window.scheduleRestNotif         = scheduleRest;
  window.scheduleTrainingReminder  = schedule;
  window.cancelTrainingReminder    = cancel;
  window.restoreReminder           = restore;

  /* ─────────────────────────────────────────────
     API PUBLIQUE
  ───────────────────────────────────────────── */
  return {
    requestPermission,
    isGranted,
    send,
    scheduleRest,
    cancelRest,
    schedule,
    cancel,
    restore,
  };

})();
