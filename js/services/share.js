/* ================================================================
   services/share.js — Partage de séance Coach Tracker Pro

   Responsabilités:
   - Générer un résumé texte de la séance
   - Partager via Web Share API (iOS/Android natif)
   - Fallback: copier dans le presse-papiers
   ================================================================ */

const Share = (() => {

  /* ─────────────────────────────────────────────
     GÉNÉRATION DU TEXTE DE PARTAGE
  ───────────────────────────────────────────── */

  function _sessionText(day) {
    if (!day) return '';

    const exercises = (day.exercises || []).filter(e => e.name?.trim() && !e.isWarmup);
    const done      = exercises.filter(e => e.done);
    const prs       = exercises.filter(e => typeof checkPR === 'function' && checkPR(e));

    // Volume total
    const vol = exercises.reduce((sum, ex) => {
      const sets = ex.setData || [];
      return sum + sets.reduce((s, set) => {
        return s + (parseFloat(set.weight) || 0) * (parseInt(set.reps) || 0);
      }, 0);
    }, 0);

    // Meilleur 1RM de la séance
    let best1RM = 0;
    exercises.forEach(ex => {
      (ex.setData || []).forEach(s => {
        const rm = typeof calc1RM === 'function'
          ? calc1RM(parseFloat(s.weight) || 0, parseInt(s.reps) || 0)
          : 0;
        if (rm > best1RM) best1RM = rm;
      });
    });

    // Infos générales
    const now     = new Date();
    const dateStr = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    const muscles = [...new Set((day.muscles || []).filter(Boolean))].join(' · ');

    let text = `💪 Coach Tracker Pro\n`;
    text += `📅 ${dateStr.charAt(0).toUpperCase() + dateStr.slice(1)}\n`;
    if (muscles) text += `🎯 ${muscles}\n`;
    text += `\n`;

    // Stats clés
    text += `✅ ${done.length}/${exercises.length} exercices\n`;
    if (vol > 100) text += `📦 Volume: ${vol >= 1000 ? (vol / 1000).toFixed(1) + 't' : Math.round(vol) + 'kg'}\n`;
    if (best1RM > 0) text += `🏋️ Meilleur 1RM: ${best1RM}kg\n`;
    if (prs.length > 0) text += `🏆 PRs: ${prs.map(e => e.name).join(', ')}\n`;

    // Détail exercices
    if (done.length > 0) {
      text += `\n`;
      done.forEach(ex => {
        const sets = (ex.setData || []).filter(s => s.done && s.weight);
        if (sets.length > 0) {
          const best  = sets.reduce((b, s) => (parseFloat(s.weight) || 0) > (parseFloat(b.weight) || 0) ? s : b, sets[0]);
          const isPR  = typeof checkPR === 'function' && checkPR(ex);
          const prTag = isPR ? ' 🏆' : '';
          text += `• ${ex.name}: ${best.weight}kg × ${best.reps || ex.reps}${prTag}\n`;
        } else {
          text += `• ${ex.name} ✓\n`;
        }
      });
    }

    text += `\n#fitness #coaching #musculation`;
    return text;
  }

  /* ─────────────────────────────────────────────
     PARTAGE
  ───────────────────────────────────────────── */

  async function shareSession(day) {
    const state  = typeof Store !== 'undefined' ? Store.getState() : null;
    const dayIdx = state?.training?.activeDay ?? 0;
    const d      = day || state?.training?.days?.[dayIdx];

    if (!d) {
      if (typeof showToast === 'function') showToast('Aucune séance à partager', 'warn', 2000);
      return;
    }

    const text = _sessionText(d);
    if (!text) return;

    try {
      // Web Share API (iOS Safari natif → feuille de partage)
      if (navigator.share) {
        await navigator.share({ text, title: 'Ma séance Coach Tracker Pro' });
        if (typeof showToast === 'function') showToast('✅ Partagé !', 'save', 2000);
        return;
      }

      // Fallback : clipboard
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        if (typeof showToast === 'function') showToast('📋 Résumé copié !', 'ok', 3000);
        return;
      }

      // Fallback ultime : execCommand
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      if (typeof showToast === 'function') showToast('📋 Résumé copié !', 'ok', 3000);

    } catch(e) {
      if (typeof Errors !== 'undefined') Errors.warn('Erreur partage', 'share.js', e.message);
      if (typeof showToast === 'function') showToast('Erreur: ' + e.message, 'warn', 3000);
    }
  }

  /* ─────────────────────────────────────────────
     BOUTON DE PARTAGE (injecté dans la séance)
  ───────────────────────────────────────────── */

  function injectShareButton() {
    const container = document.getElementById('sess-progress-area') ||
                      document.querySelector('.sess-topbar') ||
                      document.querySelector('.sess-progress-bar-area');

    if (!container) return;

    // Supprimer le bouton existant dans CE container (recréé à chaque renderSession)
    const existing = container.querySelector('#share-session-btn');
    if (existing) existing.remove();

    const btn = document.createElement('button');
    btn.id        = 'share-session-btn';
    btn.className = 'btn btn-ghost btn-sm';
    btn.style.cssText = 'display:flex;align-items:center;gap:4px;font-size:11px;padding:4px 10px;border-radius:20px;flex-shrink:0';
    btn.innerHTML = '📤 <span>Partager</span>';

    btn.ontouchstart = function(e) {
      e.preventDefault();
      shareSession();
    };
    btn.onclick = function() { shareSession(); };

    container.appendChild(btn);
  }

  /* ─────────────────────────────────────────────
     API PUBLIQUE
  ───────────────────────────────────────────── */
  return {
    shareSession,
    injectShareButton,
    sessionText: _sessionText,
  };

})();

// Alias global
window.shareSession = Share.shareSession;
