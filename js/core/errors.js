/* ================================================================
   core/errors.js — Gestion centralisée des erreurs

   Responsabilités:
   - Capturer toutes les erreurs JS non gérées
   - Capturer les promesses rejetées
   - Logger proprement en dev, silencieux en prod
   - Afficher un toast utilisateur pour les erreurs critiques
   - Rapport d'erreur structuré (pour débogage futur)
   ================================================================ */

const Errors = (() => {

  const _log   = [];
  const MAX_LOG = 50;
  let   _devMode = false;

  /* ─────────────────────────────────────────────
     CATÉGORIES D'ERREURS
  ───────────────────────────────────────────── */
  const LEVEL = {
    INFO:  'info',
    WARN:  'warn',
    ERROR: 'error',
    FATAL: 'fatal',
  };

  /* ─────────────────────────────────────────────
     LOGGER INTERNE
  ───────────────────────────────────────────── */
  function _record(level, message, source, detail) {
    const entry = {
      level,
      message,
      source:    source || 'unknown',
      detail:    detail || null,
      timestamp: new Date().toISOString(),
      tab:       typeof Router !== 'undefined' ? Router.current() : '?',
    };

    _log.push(entry);
    if (_log.length > MAX_LOG) _log.shift();

    // Console
    if (_devMode || level === LEVEL.FATAL || level === LEVEL.ERROR) {
      const fn = level === LEVEL.WARN  ? console.warn
               : level === LEVEL.ERROR ? console.error
               : level === LEVEL.FATAL ? console.error
               : console.log;
      fn('[CTP:' + level.toUpperCase() + '] ' + message,
         source ? '— ' + source : '',
         detail || '');
    }

    // Toast utilisateur pour les erreurs visibles
    if (level === LEVEL.ERROR || level === LEVEL.FATAL) {
      if (typeof showToast === 'function') {
        showToast('❌ ' + _friendlyMessage(message), 'error', 4000);
      }
    }
  }

  /* ─────────────────────────────────────────────
     MESSAGE LISIBLE POUR L'UTILISATEUR
  ───────────────────────────────────────────── */
  function _friendlyMessage(raw) {
    if (!raw) return 'Erreur inconnue';
    if (raw.includes('QuotaExceeded'))    return 'Stockage plein — exportez vos données';
    if (raw.includes('localStorage'))     return 'Impossible d\'accéder au stockage';
    if (raw.includes('NetworkError'))     return 'Erreur réseau';
    if (raw.includes('appendChild'))      return 'Erreur d\'affichage — rechargez la page';
    if (raw.includes('Cannot read'))      return 'Données manquantes — vérifiez la console';
    if (raw.includes('is not a function'))return 'Fonctionnalité non disponible';
    // Message court: 60 chars max
    return raw.length > 60 ? raw.slice(0, 57) + '...' : raw;
  }

  /* ─────────────────────────────────────────────
     INITIALISATION — intercepteurs globaux
  ───────────────────────────────────────────── */
  function init(opts) {
    opts = opts || {};
    _devMode = opts.dev || false;

    // Erreurs JS non gérées
    window.onerror = function(message, source, line, col, error) {
      const src = source
        ? source.replace(window.location.origin, '').split('/').pop() + ':' + line
        : 'unknown';

      // Ignorer les erreurs de scripts tiers (analytics, extensions)
      if (source && !source.includes(window.location.hostname) &&
          !source.includes('coach-tracker') && !source.includes('localhost')) {
        return false;
      }

      _record(LEVEL.ERROR, message, src, error ? error.stack : null);
      return false; // ne pas bloquer l'affichage natif
    };

    // Promesses rejetées non gérées
    window.addEventListener('unhandledrejection', function(e) {
      const reason = e.reason;
      const msg = reason instanceof Error
        ? reason.message
        : String(reason);
      _record(LEVEL.ERROR, '[Promise] ' + msg, null,
              reason instanceof Error ? reason.stack : null);
    });

    if (_devMode) {
      console.log('[CTP] Errors.init() — mode dev actif');
    }
  }

  /* ─────────────────────────────────────────────
     API PUBLIQUE
  ───────────────────────────────────────────── */
  return {
    init,

    info:  (msg, src, detail) => _record(LEVEL.INFO,  msg, src, detail),
    warn:  (msg, src, detail) => _record(LEVEL.WARN,  msg, src, detail),
    error: (msg, src, detail) => _record(LEVEL.ERROR, msg, src, detail),
    fatal: (msg, src, detail) => _record(LEVEL.FATAL, msg, src, detail),

    /** Récupérer le log complet (pour export/debug) */
    getLog() { return [..._log]; },

    /** Exporter le log en texte */
    exportLog() {
      return _log.map(e =>
        '[' + e.timestamp + '] [' + e.level.toUpperCase() + '] ' +
        e.message + (e.source ? ' — ' + e.source : '')
      ).join('\n');
    },

    /** Effacer le log */
    clear() { _log.length = 0; },
  };

})();
