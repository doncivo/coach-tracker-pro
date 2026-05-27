/* ================================================================
   services/search.js — Recherche globale Coach Tracker Pro

   Accessible depuis le bouton 🔍 dans le header.
   Cherche dans : bibliothèque exercices, planning courant, onglets.
   ================================================================ */

const Search = (() => {

  /* ─────────────────────────────────────────────
     INDEX
  ───────────────────────────────────────────── */

  function _buildIndex() {
    const index = [];

    // Onglets de navigation
    const tabs = [
      { id: 'dashboard',   icon: '🏠', title: 'Accueil',       subtitle: 'Dashboard & score de forme' },
      { id: 'weekly',      icon: '📋', title: 'Planning',      subtitle: 'Programme de la semaine' },
      { id: 'session',     icon: '⚡', title: 'Séance',        subtitle: 'Entraînement en cours' },
      { id: 'progression', icon: '📈', title: 'Progression',   subtitle: 'Courbes de force' },
      { id: 'corps',       icon: '💪', title: 'Corps',         subtitle: 'Mesures, nutrition, activité' },
      { id: 'bilan',       icon: '📊', title: 'Bilan',         subtitle: 'Résumé hebdomadaire' },
      { id: 'kpi',         icon: '🎯', title: 'KPI',           subtitle: 'Indicateurs de performance' },
      { id: 'achievements',icon: '🏆', title: 'Objectifs',     subtitle: 'Badges et objectifs' },
      { id: 'library',     icon: '📚', title: 'Bibliothèque',  subtitle: 'Tous les exercices' },
      { id: 'monthly',     icon: '📅', title: 'Calendrier',    subtitle: 'Vue mensuelle' },
      { id: 'settings',    icon: '⚙️', title: 'Paramètres',   subtitle: 'Configuration' },
    ];
    tabs.forEach(t => index.push({
      type: 'nav',
      title: t.title, subtitle: t.subtitle, icon: t.icon,
      action: () => typeof switchTab === 'function' && switchTab(t.id),
    }));

    // Exercices du planning courant
    const days   = (typeof S !== 'undefined' ? S.days : null) || [];
    const dNames = typeof DAYS !== 'undefined' ? DAYS : ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
    days.forEach((day, di) => {
      (day.exercises || []).filter(e => e.name?.trim() && !e.isWarmup).forEach(ex => {
        index.push({
          type:     'plan',
          title:    ex.name,
          subtitle: `${dNames[di]} · ${ex.sets || '?'}×${ex.reps || '?'}` + (ex.weight ? ` · ${ex.weight}kg` : ''),
          icon:     '📅',
          action:   () => {
            if (typeof S !== 'undefined') S.activeDay = di;
            if (typeof switchTab === 'function') switchTab('weekly');
          },
        });
      });
    });

    // Bibliothèque d'exercices
    const lib = typeof EXERCISE_LIBRARY !== 'undefined' ? EXERCISE_LIBRARY : [];
    lib.forEach(ex => {
      const mm = typeof MM !== 'undefined' ? MM : {};
      const muscle = mm[ex.muscle]?.label || ex.muscle || '';
      index.push({
        type:     'exercise',
        title:    ex.name,
        subtitle: muscle + (ex.pattern ? ' · ' + ex.pattern : ''),
        icon:     '💪',
        action:   () => {
          if (typeof switchTab === 'function') switchTab('library');
          setTimeout(() => {
            const inp = document.getElementById('lib-search');
            if (inp) {
              inp.value = ex.name;
              inp.dispatchEvent(new Event('input'));
              inp.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 150);
        },
      });
    });

    return index;
  }

  function _query(q) {
    if (!q || q.length < 2) return [];
    const lq = q.toLowerCase().trim();
    return _buildIndex()
      .filter(item =>
        item.title.toLowerCase().includes(lq) ||
        item.subtitle.toLowerCase().includes(lq)
      )
      .sort((a, b) => {
        // Exact match boost
        const aExact = a.title.toLowerCase().startsWith(lq);
        const bExact = b.title.toLowerCase().startsWith(lq);
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        // Nav first
        if (a.type === 'nav' && b.type !== 'nav') return -1;
        if (a.type !== 'nav' && b.type === 'nav') return 1;
        return 0;
      })
      .slice(0, 12);
  }

  /* ─────────────────────────────────────────────
     OVERLAY
  ───────────────────────────────────────────── */

  let _overlay = null;

  function _createOverlay() {
    const ov = document.createElement('div');
    ov.id = 'search-global-overlay';
    ov.style.cssText = [
      'display:none',
      'position:fixed',
      'top:0', 'left:0', 'right:0', 'bottom:0',
      'background:rgba(0,0,0,.55)',
      'z-index:9500',
      'flex-direction:column',
      'align-items:stretch',
    ].join(';');

    // ── Barre de recherche ──
    const bar = document.createElement('div');
    bar.style.cssText = [
      'background:var(--surface)',
      'border-bottom:1px solid var(--border)',
      'display:flex', 'align-items:center', 'gap:10px',
      'padding:max(12px, env(safe-area-inset-top,12px)) 16px 12px',
    ].join(';');

    const icon = document.createElement('span');
    icon.textContent = '🔍';
    icon.style.cssText = 'font-size:18px;flex-shrink:0';

    const inp = document.createElement('input');
    inp.id           = 'search-global-inp';
    inp.type         = 'search';
    inp.placeholder  = 'Exercice, onglet, groupe…';
    inp.autocomplete = 'off';
    inp.autocorrect  = 'off';
    inp.spellcheck   = false;
    inp.style.cssText = [
      'flex:1', 'border:none', 'background:transparent',
      'font-size:17px', 'color:var(--text)', 'outline:none',
      'font-family:var(--font)', '-webkit-appearance:none',
    ].join(';');

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Annuler';
    closeBtn.style.cssText = [
      'border:none', 'background:none', 'font-size:14px',
      'color:var(--teal-d)', 'padding:4px 0',
      'cursor:pointer', 'font-weight:600', 'font-family:var(--font)',
      'touch-action:manipulation', '-webkit-appearance:none',
      'flex-shrink:0',
    ].join(';');

    bar.appendChild(icon);
    bar.appendChild(inp);
    bar.appendChild(closeBtn);

    // ── Résultats ──
    const results = document.createElement('div');
    results.id = 'search-global-results';
    results.style.cssText = [
      'flex:1', 'overflow-y:auto',
      'background:var(--bg)',
      '-webkit-overflow-scrolling:touch',
      'max-height:calc(100vh - 80px)',
    ].join(';');

    _showHint(results);

    // ── Événements ──
    inp.addEventListener('input', () => _renderResults(inp.value, results));

    function doClose() {
      ov.style.display = 'none';
      inp.value = '';
      _showHint(results);
    }

    closeBtn.ontouchstart = (e) => { e.preventDefault(); doClose(); };
    closeBtn.onclick      = doClose;

    ov.ontouchstart = (e) => { if (e.target === ov) doClose(); };
    ov.onclick      = (e) => { if (e.target === ov) doClose(); };

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && ov.style.display !== 'none') doClose();
    });

    ov.appendChild(bar);
    ov.appendChild(results);
    return ov;
  }

  function _showHint(results) {
    results.innerHTML = '<div style="padding:32px 16px;text-align:center;color:var(--muted);font-size:13px">Recherchez un exercice, un onglet…</div>';
  }

  function _renderResults(query, results) {
    results.innerHTML = '';
    const q = query.trim();

    if (q.length < 2) { _showHint(results); return; }

    const items = _query(q);

    if (!items.length) {
      results.innerHTML = `<div style="padding:32px 16px;text-align:center;color:var(--muted);font-size:13px">Aucun résultat pour « ${q} »</div>`;
      return;
    }

    const typeLabels = { nav: 'Navigation', plan: 'Mon planning', exercise: 'Bibliothèque' };
    let lastType = null;

    items.forEach(item => {
      if (item.type !== lastType) {
        const hdr = document.createElement('div');
        hdr.style.cssText = 'padding:10px 16px 4px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);background:var(--bg)';
        hdr.textContent = typeLabels[item.type] || item.type;
        results.appendChild(hdr);
        lastType = item.type;
      }

      const row = document.createElement('div');
      row.style.cssText = [
        'display:flex', 'align-items:center', 'gap:12px',
        'padding:12px 16px',
        'border-bottom:1px solid var(--border)',
        'background:var(--card)',
        'cursor:pointer',
        'touch-action:manipulation',
        '-webkit-tap-highlight-color:transparent',
      ].join(';');

      const rowIcon = document.createElement('span');
      rowIcon.textContent = item.icon;
      rowIcon.style.cssText = 'font-size:22px;flex-shrink:0';

      const text = document.createElement('div');
      text.style.cssText = 'flex:1;min-width:0';
      text.innerHTML = `<div style="font-weight:600;font-size:14px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${item.title}</div><div style="font-size:11px;color:var(--muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${item.subtitle}</div>`;

      const chevron = document.createElement('span');
      chevron.textContent = '›';
      chevron.style.cssText = 'color:var(--muted);font-size:18px;flex-shrink:0';

      row.appendChild(rowIcon);
      row.appendChild(text);
      row.appendChild(chevron);

      function doAction() {
        if (_overlay) _overlay.style.display = 'none';
        item.action();
      }

      row.ontouchstart = (e) => { e.preventDefault(); e.stopPropagation(); doAction(); };
      row.onclick      = doAction;

      results.appendChild(row);
    });
  }

  /* ─────────────────────────────────────────────
     API PUBLIQUE
  ───────────────────────────────────────────── */

  function open() {
    if (!_overlay) {
      _overlay = _createOverlay();
      document.body.appendChild(_overlay);
    }
    _overlay.style.display = 'flex';
    const inp = document.getElementById('search-global-inp');
    if (inp) setTimeout(() => inp.focus(), 80);
  }

  function close() {
    if (_overlay) _overlay.style.display = 'none';
  }

  return { open, close, query: _query };

})();

window.openSearch  = Search.open;
window.closeSearch = Search.close;
