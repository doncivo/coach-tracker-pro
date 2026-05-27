/* ================================================================
   services/coach.js — Suggestions de progression intelligentes

   Analyse l'historique et les données de la séance pour
   donner des conseils concrets et actionnables par exercice.
   ================================================================ */

const Coach = (() => {

  /* ─────────────────────────────────────────────
     ANALYSE PAR EXERCICE
  ───────────────────────────────────────────── */

  /**
   * Retourne une suggestion pour un exercice donné.
   * @param {object} ex — exercice du planning
   * @returns {{ type: 'good'|'warn'|'plateau'|'failure'|null, title: string, detail: string, emoji: string }}
   */
  function analyzeExercise(ex) {
    if (!ex || !ex.name || ex.isWarmup) return null;

    const hist = typeof exHist === 'function' ? exHist(ex.name) : [];
    const w    = parseFloat(ex.weight) || 0;
    const repsAchieved = parseInt(ex.repsAchieved) || 0;
    const repTarget    = _parseRepTarget(ex.reps);

    // 1. PR — nouveau record de 1RM
    if (typeof checkPR === 'function' && checkPR(ex)) {
      return {
        type: 'pr', emoji: '🏆',
        title: 'Nouveau PR !',
        detail: `${w}kg — Meilleure performance enregistrée`,
      };
    }

    // 2. Surcharge conseillée — reps atteintes = haut de fourchette
    if (typeof shouldOverload === 'function' && shouldOverload(ex) && w > 0) {
      const nextW = Math.round((w * 1.025) / 2.5) * 2.5;
      return {
        type: 'good', emoji: '↑',
        title: `Augmentez à ${nextW}kg`,
        detail: `Vous avez réussi ${repsAchieved} reps — objectif atteint`,
      };
    }

    // 3. Échec — reps sous le bas de fourchette
    if (typeof isFailure === 'function' && isFailure(ex) && w > 0) {
      const reduceW = Math.round((w * 0.95) / 2.5) * 2.5;
      return {
        type: 'warn', emoji: '↓',
        title: `Réduisez à ${reduceW}kg`,
        detail: `${repsAchieved} reps — sous l'objectif de ${repTarget.min}`,
      };
    }

    // 4. Plateau — poids identique depuis 3 semaines ou plus
    if (typeof isPlateau === 'function' && isPlateau(ex.name)) {
      const strategies = _plateauStrategies(ex, hist);
      return {
        type: 'plateau', emoji: '⚠',
        title: 'Plateau détecté',
        detail: strategies,
      };
    }

    // 5. RPE trop élevé (> 9)
    if (ex.setData) {
      const rpeVals = ex.setData.filter(s => s.rpe && s.rpe !== '—').map(s => parseFloat(s.rpe));
      const avgRpe  = rpeVals.length ? rpeVals.reduce((a, b) => a + b, 0) / rpeVals.length : 0;
      if (avgRpe >= 9 && w > 0) {
        const safeW = Math.round((w * 0.97) / 2.5) * 2.5;
        return {
          type: 'warn', emoji: '🔴',
          title: `RPE élevé (${Math.round(avgRpe * 10) / 10}) — −${w - safeW}kg conseillé`,
          detail: 'Risque de sur-entraînement — réduisez légèrement',
        };
      }
      // RPE trop bas (< 7) — sous-entraînement
      if (avgRpe > 0 && avgRpe <= 6 && w > 0) {
        const bumpW = Math.round((w * 1.025) / 2.5) * 2.5;
        return {
          type: 'good', emoji: '🟢',
          title: `RPE faible (${Math.round(avgRpe * 10) / 10}) — augmentez à ${bumpW}kg`,
          detail: 'Effort insuffisant — vous pouvez charger davantage',
        };
      }
    }

    // 6. Premier enregistrement — pas d'historique
    if (hist.length === 0 && w === 0) {
      return {
        type: 'info', emoji: '💡',
        title: 'Premier entraînement',
        detail: 'Renseignez un poids pour démarrer le suivi de progression',
      };
    }

    return null;
  }

  /* ─────────────────────────────────────────────
     RAPPORT HEBDOMADAIRE
  ───────────────────────────────────────────── */

  /**
   * Retourne une liste de suggestions pour la semaine courante.
   * @returns {Array<{exName, suggestion}>}
   */
  function weeklyReport() {
    if (typeof S === 'undefined') return [];

    const suggestions = [];
    (S.days || []).forEach(day => {
      (day.exercises || []).filter(e => !e.isWarmup && e.name?.trim()).forEach(ex => {
        const s = analyzeExercise(ex);
        if (s && s.type !== 'info') {
          suggestions.push({ exName: ex.name, suggestion: s });
        }
      });
    });

    return suggestions;
  }

  /* ─────────────────────────────────────────────
     HELPERS
  ───────────────────────────────────────────── */

  function _parseRepTarget(repsStr) {
    const nums = (repsStr || '').match(/\d+/g) || ['8'];
    return {
      min: parseInt(nums[0]) || 8,
      max: parseInt(nums[nums.length - 1]) || parseInt(nums[0]) || 8,
    };
  }

  function _plateauStrategies(ex, hist) {
    // Analyser le type d'exercice pour donner une stratégie adaptée
    const name = (ex.name || '').toLowerCase();
    const reps = _parseRepTarget(ex.reps);
    const w    = parseFloat(ex.weight) || 0;

    // Stratégie 1: micro-progression (+1.25kg)
    if (w > 0 && w < 60) {
      return `Essayez +1.25kg (${w + 1.25}kg) ou ajoutez 1 répétition`;
    }

    // Stratégie 2: technique (tempo)
    if (reps.max >= 10) {
      return 'Tentez tempo 3-1-2 ou drop set sur la dernière série';
    }

    // Stratégie 3: déload suggéré
    if (hist.length >= 6) {
      return 'Envisagez une semaine de déload (−20% charge)';
    }

    return 'Variez le tempo, les grips, ou la fourchette de reps';
  }

  /* ─────────────────────────────────────────────
     RENDU DOM
  ───────────────────────────────────────────── */

  /**
   * Crée un badge de suggestion à insérer dans le DOM.
   */
  function renderBadge(suggestion) {
    if (!suggestion) return null;

    const colors = {
      pr:      { bg: '#fff3cd', border: '#ffd700', text: '#7a5800' },
      good:    { bg: 'rgba(56,161,105,.1)', border: 'rgba(56,161,105,.3)', text: 'var(--green)' },
      warn:    { bg: 'rgba(229,62,62,.08)', border: 'rgba(229,62,62,.25)', text: 'var(--red)' },
      plateau: { bg: 'rgba(246,173,85,.12)', border: 'rgba(246,173,85,.4)', text: '#b7791f' },
      info:    { bg: 'var(--surface)', border: 'var(--border)', text: 'var(--muted)' },
    };
    const c = colors[suggestion.type] || colors.info;

    const badge = document.createElement('div');
    badge.className = 'coach-badge';
    badge.style.cssText = [
      `background:${c.bg}`,
      `border:1px solid ${c.border}`,
      `color:${c.text}`,
      'border-radius:10px',
      'padding:7px 11px',
      'font-size:12px',
      'line-height:1.4',
      'margin:6px 12px 0',
    ].join(';');

    badge.innerHTML = `<strong>${suggestion.emoji} ${suggestion.title}</strong><br><span style="opacity:.85;font-size:11px">${suggestion.detail}</span>`;
    return badge;
  }

  /* ─────────────────────────────────────────────
     API PUBLIQUE
  ───────────────────────────────────────────── */
  return { analyzeExercise, weeklyReport, renderBadge };

})();

window.Coach = Coach;
