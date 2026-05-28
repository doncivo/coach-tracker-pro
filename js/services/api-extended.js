/* ================================================================
   api-extended.js
   
   1. Claude API (Anthropic) — Coach IA, génération de programme
   2. USDA FoodData Central — Base nutrition 600k aliments
   3. PubMed API — Études scientifiques par exercice
   4. ICS / CalDAV — Export planning vers calendrier iPhone
   5. Spotify — Musique pendant la séance
   ================================================================ */

'use strict';

/* ════════════════════════════════════════════════════════════════
   1. CLAUDE API — Coach IA
   Génération de programme, questions sur l'entraînement
   ════════════════════════════════════════════════════════════════ */

const ClaudeCoach = {

  _history: [], // historique de la conversation

  async ask(userMessage) {
    // Construire le contexte de l'utilisateur
    const fs = typeof computeFitnessScore === 'function' ? computeFitnessScore() : null;
    const lastPoids = (S.mesures?.poids || []).slice(-1)[0];
    const weekVol = typeof computeWeeklyVolume === 'function' ? (computeWeeklyVolume(1)[0]?.value || 0) : 0;
    const streak = typeof computeStreak === 'function' ? computeStreak() : { current: 0 };

    const systemPrompt = [
      'Tu es un coach sportif expert en musculation, nutrition et planification. Reponds en francais.',
      'Tu analyses les donnees de l utilisateur et donnes des conseils personnalises, concis et actionnables.',
      'Ne genere pas de markdown. Texte simple uniquement.',
      '',
      '=== PROFIL UTILISATEUR ===',
      'Poids: ' + (lastPoids ? lastPoids.val + 'kg' : 'non renseigne'),
      'Taille: ' + (S.profilTaille || '?') + 'cm',
      'Age: ' + (S.profilAge || '?') + ' ans',
      'Sexe: ' + (S.profilSexe === 'H' ? 'Homme' : 'Femme'),
      'Objectif: ' + (S.objective?.type || 'non defini'),
      'Bloc actuel: ' + (S.currentBlock || 1) + ' / Semaine: ' + (S.weekCount || 1),
      'Score de forme: ' + (fs ? fs.score + '/100' : 'N/A'),
      'Streak: ' + streak.current + ' jours',
      'Volume cette semaine: ' + (weekVol >= 1000 ? (weekVol/1000).toFixed(1) + 't' : Math.round(weekVol) + 'kg'),
      '',
      '=== PLANNING ACTUEL ===',
      S.days.map((d, i) => {
        const exs = (d.exercises || []).filter(e => e.name && !e.isWarmup);
        return ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'][i] + ': ' + (exs.length ? exs.map(e => e.name + (e.weight?' '+e.weight+'kg':'')).join(', ') : 'Repos');
      }).join('\n'),
    ].join('\n');

    // Appel API Claude
    const messages = [
      ...ClaudeCoach._history,
      { role: 'user', content: userMessage },
    ];

    const claudeKey = S.apiKeys?.claude || '';
    if (!claudeKey) {
      ClaudeCoach._history.push({ role:'user', content:userMessage });
      const noKeyMsg = 'Cle API manquante — allez dans Reglages > Integrations API > Coach IA, collez votre cle API Anthropic (console.anthropic.com)';
      ClaudeCoach._history.push({ role:'assistant', content:noKeyMsg });
      return noKeyMsg;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': claudeKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: systemPrompt,
        messages,
      }),
    });

    if (!response.ok) throw new Error('Claude API erreur ' + response.status);
    const data = await response.json();
    const reply = data.content?.[0]?.text || 'Pas de reponse';

    // Ajouter à l'historique
    ClaudeCoach._history.push({ role: 'user', content: userMessage });
    ClaudeCoach._history.push({ role: 'assistant', content: reply });
    // Garder max 10 échanges
    if (ClaudeCoach._history.length > 20) ClaudeCoach._history = ClaudeCoach._history.slice(-20);

    return reply;
  },

  showChat() {
    document.getElementById('claude-chat-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'claude-chat-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.55);z-index:9500;display:flex;flex-direction:column;justify-content:flex-end';

    const sheet = document.createElement('div');
    sheet.style.cssText = 'background:var(--surface);height:80vh;max-height:80vh;display:flex;flex-direction:column;border-radius:24px 24px 0 0;overflow:hidden';

    // Header
    const hdr = document.createElement('div');
    hdr.style.cssText = 'padding:14px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;flex-shrink:0';
    const hdrIcon = document.createElement('span'); hdrIcon.style.cssText='font-size:22px'; hdrIcon.textContent='🤖';
    const hdrText = document.createElement('div');
    hdrText.innerHTML = '<div style="font-size:14px;font-weight:700;color:var(--text)">Coach IA</div><div style="font-size:10px;color:var(--muted)">Propulsé par Claude · Votre profil est partagé</div>';
    const closeBtn = document.createElement('button');
    closeBtn.style.cssText='margin-left:auto;border:none;background:none;font-size:20px;color:var(--muted);cursor:pointer;touch-action:manipulation;-webkit-appearance:none;padding:0 4px';
    closeBtn.textContent='✕';
    closeBtn.ontouchstart=(e)=>{e.preventDefault();overlay.remove();};
    closeBtn.onclick=()=>overlay.remove();
    hdr.append(hdrIcon, hdrText, closeBtn);

    // Messages
    const msgs = document.createElement('div');
    msgs.style.cssText = 'flex:1;overflow-y:auto;padding:12px 16px;display:flex;flex-direction:column;gap:10px;-webkit-overflow-scrolling:touch';

    // Suggestions rapides
    const suggestions = [
      'Analyse mon programme cette semaine',
      'Génère un programme PPL 4 jours/semaine',
      'Comment progresser sur le Squat en plateau ?',
      'Que manger avant et après la séance ?',
      'Quand faire ma semaine de décharge ?',
    ];

    const sugRow = document.createElement('div');
    sugRow.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;padding-bottom:4px';
    suggestions.forEach(s => {
      const chip = document.createElement('button');
      chip.style.cssText = 'padding:6px 10px;border-radius:10px;border:1.5px solid var(--teal);background:transparent;color:var(--teal-d);font-size:11px;font-weight:600;font-family:var(--font);cursor:pointer;touch-action:manipulation;-webkit-appearance:none;white-space:nowrap';
      chip.textContent = s;
      chip.ontouchstart=(e)=>{e.preventDefault();sendMessage(s);};
      chip.onclick=()=>sendMessage(s);
      sugRow.appendChild(chip);
    });
    msgs.appendChild(sugRow);

    // Input
    const inputRow = document.createElement('div');
    inputRow.style.cssText = 'padding:10px 12px;border-top:1px solid var(--border);display:flex;gap:8px;flex-shrink:0;background:var(--surface)';
    const inp = document.createElement('input');
    inp.type='text'; inp.placeholder='Posez une question à votre coach...';
    inp.style.cssText='flex:1;padding:10px 14px;border-radius:14px;border:1.5px solid var(--teal);background:var(--bg);font-size:16px;font-family:var(--font);color:var(--text);-webkit-appearance:none;outline:none';
    const sendBtn = document.createElement('button');
    sendBtn.style.cssText='padding:10px 16px;border-radius:14px;border:none;background:var(--teal);color:#fff;font-size:16px;cursor:pointer;touch-action:manipulation;-webkit-appearance:none;flex-shrink:0';
    sendBtn.textContent='▶';

    function addMsg(text, role) {
      const msg = document.createElement('div');
      msg.style.cssText = role==='user'
        ? 'align-self:flex-end;background:var(--teal);color:#fff;padding:10px 14px;border-radius:16px 16px 4px 16px;max-width:85%;font-size:13px;line-height:1.5'
        : 'align-self:flex-start;background:var(--card);color:var(--text);padding:10px 14px;border-radius:16px 16px 16px 4px;max-width:85%;font-size:13px;line-height:1.5;border:1px solid var(--border)';
      msg.textContent = text;
      msgs.appendChild(msg);
      msgs.scrollTop = msgs.scrollHeight;
      return msg;
    }

    function addLoading() {
      const msg = document.createElement('div');
      msg.style.cssText = 'align-self:flex-start;background:var(--card);color:var(--muted);padding:10px 14px;border-radius:16px 16px 16px 4px;font-size:13px;border:1px solid var(--border)';
      msg.textContent = '...';
      msgs.appendChild(msg);
      msgs.scrollTop = msgs.scrollHeight;
      return msg;
    }

    async function sendMessage(text) {
      const q = text || inp.value.trim();
      if (!q) return;
      inp.value = '';
      sugRow.style.display = 'none';
      addMsg(q, 'user');
      sendBtn.disabled = true;
      inp.disabled = true;
      const loading = addLoading();
      try {
        const reply = await ClaudeCoach.ask(q);
        loading.remove();
        addMsg(reply, 'assistant');
      } catch(e) {
        loading.textContent = 'Erreur : ' + e.message;
      }
      sendBtn.disabled = false;
      inp.disabled = false;
      inp.focus();
    }

    sendBtn.ontouchstart=(e)=>{e.preventDefault();sendMessage();};
    sendBtn.onclick=()=>sendMessage();
    inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();sendMessage();}});
    inputRow.append(inp, sendBtn);

    // Afficher l'historique existant
    ClaudeCoach._history.forEach(m => addMsg(m.content, m.role));

    sheet.append(hdr, msgs, inputRow);
    overlay.appendChild(sheet);
    overlay.ontouchstart=(e)=>{if(e.target===overlay)overlay.remove();};
    overlay.onclick=(e)=>{if(e.target===overlay)overlay.remove();};
    document.body.appendChild(overlay);
    setTimeout(()=>inp.focus(), 300);
  },
};
window.ClaudeCoach = ClaudeCoach;


/* ════════════════════════════════════════════════════════════════
   2. USDA FOODDATA CENTRAL
   600 000 aliments, micronutriments détaillés
   Gratuit, DEMO_KEY = 30 req/h sans inscription
   ════════════════════════════════════════════════════════════════ */

const USDA = {
  BASE: 'https://api.nal.usda.gov/fdc/v1',

  async search(query, maxResults = 8, signal = null) {
    const key = (S.apiKeys?.usda) || 'DEMO_KEY';
    const url = USDA.BASE + '/foods/search?query=' + encodeURIComponent(query) +
                '&api_key=' + key + '&pageSize=' + maxResults + '&dataType=Survey%20(FNDDS),Foundation';
    const resp = await fetch(url, { signal });
    if (!resp.ok) throw new Error('USDA erreur ' + resp.status);
    const data = await resp.json();
    return (data.foods || []).map(f => ({
      fdcId:    f.fdcId,
      name:     f.description,
      brand:    f.brandOwner || '',
      cal:      Math.round(f.foodNutrients?.find(n => n.nutrientName?.includes('Energy') && n.unitName === 'KCAL')?.value || 0),
      protein:  Math.round((f.foodNutrients?.find(n => n.nutrientName?.includes('Protein'))?.value || 0) * 10) / 10,
      carbs:    Math.round((f.foodNutrients?.find(n => n.nutrientName?.includes('Carbohydrate'))?.value || 0) * 10) / 10,
      fat:      Math.round((f.foodNutrients?.find(n => n.nutrientName?.includes('Total lipid'))?.value || 0) * 10) / 10,
      fiber:    Math.round((f.foodNutrients?.find(n => n.nutrientName?.includes('Fiber'))?.value || 0) * 10) / 10,
    }));
  },

  showSearch(callback) {
    document.getElementById('usda-search-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'usda-search-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.55);z-index:9500;display:flex;align-items:flex-end;justify-content:center';

    const sheet = document.createElement('div');
    sheet.style.cssText = 'background:var(--surface);border-radius:24px 24px 0 0;padding:16px;width:100%;max-width:520px;max-height:80vh;overflow-y:auto;-webkit-overflow-scrolling:touch;display:flex;flex-direction:column;gap:10px';

    const handle = document.createElement('div');
    handle.style.cssText = 'width:36px;height:4px;border-radius:2px;background:var(--border);margin:0 auto';

    const title = document.createElement('div');
    title.style.cssText = 'font-size:16px;font-weight:700;color:var(--text)';
    title.textContent = '🇺🇸 USDA FoodData — 600k aliments';

    const inp = document.createElement('input');
    inp.type='text'; inp.placeholder='Chercher un aliment (ex: poulet roti, riz blanc...)';
    inp.setAttribute('autocomplete','off');
    inp.style.cssText='padding:12px 14px;border-radius:12px;border:1.5px solid var(--teal);background:var(--bg);font-size:16px;font-family:var(--font);color:var(--text);-webkit-appearance:none;outline:none;width:100%;box-sizing:border-box';

    const results = document.createElement('div');
    results.style.cssText = 'display:flex;flex-direction:column;gap:6px';

    let debounceTimer;
    let _usdaController = null;

    inp.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      const q = inp.value.trim();
      if (q.length < 2) { results.innerHTML=''; return; }
      results.innerHTML = '<div style="font-size:11px;color:var(--muted);padding:8px">Recherche...</div>';
      debounceTimer = setTimeout(async () => {
        // Annuler la requête précédente
        if (_usdaController) { _usdaController.abort(); }
        _usdaController = new AbortController();
        try {
          const foods = await USDA.search(q, 8, _usdaController.signal);
          results.innerHTML = '';
          if (!foods.length) { results.innerHTML='<div style="font-size:11px;color:var(--muted);padding:8px">Aucun résultat</div>'; return; }
          foods.forEach(food => {
            const row = document.createElement('button');
            row.style.cssText='display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:10px 12px;border-radius:10px;border:1px solid var(--border);background:var(--card);font-family:var(--font);cursor:pointer;touch-action:manipulation;-webkit-appearance:none';
            const info = document.createElement('div');
            info.style.cssText='flex:1;min-width:0';
            info.innerHTML='<div style="font-size:12px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+food.name+'</div>' +
              '<div style="font-size:10px;color:var(--muted);margin-top:1px">'+food.cal+'kcal · P:'+food.protein+'g · G:'+food.carbs+'g · L:'+food.fat+'g (pour 100g)</div>';
            const add = document.createElement('span');
            add.style.cssText='color:var(--teal);font-size:16px;flex-shrink:0'; add.textContent='+';
            row.appendChild(info); row.appendChild(add);
            const doAdd=()=>{ overlay.remove(); if(callback) callback({ name:food.name, cal:food.cal, protein:food.protein, carbs:food.carbs, fat:food.fat }); };
            row.ontouchstart=(e)=>{e.preventDefault();doAdd();}; row.onclick=doAdd;
            results.appendChild(row);
          });
        } catch(e) {
          if (e.name === 'AbortError') return; // requête annulée — normal
          results.innerHTML='<div style="font-size:11px;color:var(--red);padding:8px">Erreur : '+e.message+'</div>';
        }
      }, 400);
    });

    const cancel = document.createElement('button');
    cancel.style.cssText='width:100%;padding:10px;border:none;background:none;color:var(--muted);font-size:14px;font-family:var(--font);cursor:pointer;touch-action:manipulation;-webkit-appearance:none';
    cancel.textContent='Annuler';
    cancel.ontouchstart=(e)=>{e.preventDefault();overlay.remove();}; cancel.onclick=()=>overlay.remove();

    sheet.append(handle, title, inp, results, cancel);
    overlay.appendChild(sheet);
    overlay.ontouchstart=(e)=>{if(e.target===overlay)overlay.remove();};
    overlay.onclick=(e)=>{if(e.target===overlay)overlay.remove();};
    document.body.appendChild(overlay);
    setTimeout(()=>inp.focus(), 200);
  },
};
window.USDA = USDA;


/* ════════════════════════════════════════════════════════════════
   3. PUBMED API — Études scientifiques
   Gratuit, sans clé API
   ════════════════════════════════════════════════════════════════ */

const PubMed = {
  BASE: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils',
  _cache: {},

  async searchExercise(exerciseName, maxResults = 3) {
    const query = encodeURIComponent(exerciseName + ' resistance training muscle hypertrophy');
    const cacheKey = exerciseName;
    if (PubMed._cache[cacheKey]) return PubMed._cache[cacheKey];

    // Étape 1 : obtenir les IDs
    const searchResp = await fetch(PubMed.BASE + '/esearch.fcgi?db=pubmed&term=' + query + '&retmax=' + maxResults + '&sort=relevance&retmode=json');
    if (!searchResp.ok) throw new Error('PubMed search erreur');
    const searchData = await searchResp.json();
    const ids = searchData.esearchresult?.idlist || [];
    if (!ids.length) return [];

    // Étape 2 : obtenir les résumés
    const summaryResp = await fetch(PubMed.BASE + '/esummary.fcgi?db=pubmed&id=' + ids.join(',') + '&retmode=json');
    if (!summaryResp.ok) throw new Error('PubMed summary erreur');
    const summaryData = await summaryResp.json();

    const results = ids.map(id => {
      const art = summaryData.result?.[id];
      if (!art) return null;
      return {
        id,
        title:   art.title || '',
        authors: art.authors?.slice(0,2).map(a=>a.name).join(', ') || '',
        journal: art.source || '',
        year:    art.pubdate?.slice(0,4) || '',
        url:     'https://pubmed.ncbi.nlm.nih.gov/' + id + '/',
      };
    }).filter(Boolean);

    if (Object.keys(PubMed._cache).length > 50) delete PubMed._cache[Object.keys(PubMed._cache)[0]];
    PubMed._cache[cacheKey] = results;
    return results;
  },

  async showStudies(exerciseName, targetEl) {
    if (!targetEl) return;
    targetEl.innerHTML = '<div style="font-size:11px;color:var(--muted);padding:8px">Recherche PubMed...</div>';
    try {
      const studies = await PubMed.searchExercise(exerciseName);
      targetEl.innerHTML = '';
      if (!studies.length) {
        targetEl.innerHTML = '<div style="font-size:11px;color:var(--muted);padding:8px">Aucune étude trouvée pour cet exercice</div>';
        return;
      }
      const card = document.createElement('div');
      card.style.cssText='background:var(--card);border-radius:12px;padding:10px 12px;border:1px solid var(--border)';
      const lbl=document.createElement('div');lbl.style.cssText='font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:8px';lbl.textContent='📚 PubMed — Études scientifiques';
      card.appendChild(lbl);
      studies.forEach(s => {
        const row=document.createElement('div');row.style.cssText='margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid var(--border)';
        const t=document.createElement('a');t.href=s.url;t.target='_blank';t.rel='noopener';
        t.style.cssText='font-size:11px;font-weight:600;color:var(--teal-d);line-height:1.4;display:block;text-decoration:none';
        t.textContent=s.title.length>120?s.title.slice(0,120)+'…':s.title;
        const meta=document.createElement('div');meta.style.cssText='font-size:9px;color:var(--muted);margin-top:2px';
        meta.textContent=s.authors+(s.journal?' · '+s.journal:'')+(s.year?' ('+s.year+')':'');
        row.appendChild(t);row.appendChild(meta);
        card.appendChild(row);
      });
      targetEl.appendChild(card);
    } catch(e) {
      targetEl.innerHTML='<div style="font-size:10px;color:var(--muted);padding:8px">PubMed hors-ligne</div>';
    }
  },
};
window.PubMed = PubMed;


/* ════════════════════════════════════════════════════════════════
   4. ICS / CalDAV — Export calendrier iPhone
   Génère un fichier .ics lisible par Apple Calendar, Google Calendar...
   Sans authentification
   ════════════════════════════════════════════════════════════════ */

const ICSExport = {

  /* Générer un fichier ICS complet du planning hebdomadaire */
  generate(options = {}) {
    const { startHour = 19, durationMin = 60, recurring = false } = options;
    const DAYS_FR = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];
    const now = new Date();
    const uid_base = 'ctp-' + now.getFullYear() + now.getMonth();

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Coach Tracker Pro//FR',
      'CALSCALE:GREGORIAN',
      'X-WR-CALNAME:Coach Tracker Pro',
      'X-WR-CALDESC:Programme d entrainement hebdomadaire',
    ];

    // Trouver le prochain lundi
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=dim
    const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7 || 7;
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + (dayOfWeek === 1 ? 0 : daysUntilMonday));

    S.days.forEach((d, di) => {
      const exs = (d.exercises || []).filter(e => e.name && !e.isWarmup);
      if (!exs.length) return;
      if (!d.date) return; // skip jours sans date — évite Invalid Date dans le ICS
      const isRest = exs[0]?.name?.toLowerCase().includes('repos');
      if (isRest) return;

      const date = new Date(nextMonday);
      date.setDate(nextMonday.getDate() + di);

      const dtStart = ICSExport._formatDT(date, startHour, 0);
      const dtEnd   = ICSExport._formatDT(date, startHour, durationMin);
      const exList  = exs.slice(0, 6).map(e => e.name + (e.weight ? ' ' + e.weight + 'kg' : '')).join('\\n');
      const summary = DAYS_FR[di] + ' — ' + (d.muscles?.join('+') || exs[0]?.name || 'Seance');

      lines.push('BEGIN:VEVENT');
      lines.push('UID:' + uid_base + '-day' + di + '@coachtacker');
      lines.push('DTSTART;TZID=Europe/Paris:' + dtStart);
      lines.push('DTEND;TZID=Europe/Paris:' + dtEnd);
      lines.push('SUMMARY:💪 ' + summary);
      lines.push('DESCRIPTION:Exercices :\\n' + exList);
      lines.push('CATEGORIES:Sport\\,Musculation');
      lines.push('STATUS:CONFIRMED');
      if (recurring) {
        lines.push('RRULE:FREQ=WEEKLY;COUNT=16'); // 4 blocs de 4 semaines
      }
      lines.push('BEGIN:VALARM');
      lines.push('TRIGGER:-PT30M');
      lines.push('ACTION:DISPLAY');
      lines.push('DESCRIPTION:Rappel seance : ' + summary);
      lines.push('END:VALARM');
      lines.push('END:VEVENT');
    });

    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  },

  _formatDT(date, hour, addMin) {
    const d = new Date(date);
    d.setHours(hour, 0, 0, 0);
    d.setMinutes(addMin);
    const pad = n => String(n).padStart(2, '0');
    return d.getFullYear() + pad(d.getMonth()+1) + pad(d.getDate()) + 'T' + pad(d.getHours()) + pad(d.getMinutes()) + '00';
  },

  showExportModal() {
    document.getElementById('ics-export-modal')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'ics-export-modal';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.55);z-index:9500;display:flex;align-items:flex-end;justify-content:center';

    const sheet = document.createElement('div');
    sheet.style.cssText = 'background:var(--surface);border-radius:24px 24px 0 0;padding:20px 16px calc(20px + env(safe-area-inset-bottom,0px));width:100%;max-width:480px;display:flex;flex-direction:column;gap:12px';

    const handle = document.createElement('div');
    handle.style.cssText = 'width:36px;height:4px;border-radius:2px;background:var(--border);margin:0 auto';

    const title = document.createElement('div');
    title.style.cssText = 'font-size:16px;font-weight:700;color:var(--text)';
    title.textContent = '📅 Exporter vers le Calendrier';

    const sub = document.createElement('div');
    sub.style.cssText = 'font-size:11px;color:var(--muted);line-height:1.5';
    sub.textContent = 'Telechargez le fichier .ics et ouvrez-le — il s ajoute automatiquement a Apple Calendar ou Google Calendar avec rappels.';

    // Options
    const opts = document.createElement('div');
    opts.style.cssText = 'background:var(--card);border-radius:12px;padding:12px;border:1px solid var(--border);display:flex;flex-direction:column;gap:8px';

    // Heure de début
    const hourRow = document.createElement('div');
    hourRow.style.cssText = 'display:flex;align-items:center;gap:10px';
    const hourLbl=document.createElement('span');hourLbl.style.cssText='font-size:12px;font-weight:600;color:var(--muted);flex:1';hourLbl.textContent='Heure de seance :';
    const hourInp=document.createElement('input');hourInp.type='number';hourInp.min=6;hourInp.max=22;hourInp.value=19;
    hourInp.style.cssText='width:70px;padding:6px 8px;border-radius:8px;border:1px solid var(--border);background:var(--bg);font-size:15px;font-family:var(--mono);color:var(--text);text-align:center;-webkit-appearance:none';
    const hourUnit=document.createElement('span');hourUnit.style.cssText='font-size:11px;color:var(--muted)';hourUnit.textContent='h';
    hourRow.append(hourLbl, hourInp, hourUnit);

    // Durée
    const durRow = document.createElement('div');
    durRow.style.cssText = 'display:flex;align-items:center;gap:10px';
    const durLbl=document.createElement('span');durLbl.style.cssText='font-size:12px;font-weight:600;color:var(--muted);flex:1';durLbl.textContent='Duree estimee :';
    const durInp=document.createElement('input');durInp.type='number';durInp.min=30;durInp.max=180;durInp.step=15;durInp.value=75;
    durInp.style.cssText='width:70px;padding:6px 8px;border-radius:8px;border:1px solid var(--border);background:var(--bg);font-size:15px;font-family:var(--mono);color:var(--text);text-align:center;-webkit-appearance:none';
    const durUnit=document.createElement('span');durUnit.style.cssText='font-size:11px;color:var(--muted)';durUnit.textContent='min';
    durRow.append(durLbl, durInp, durUnit);

    // Répétition
    const recRow = document.createElement('div');
    recRow.style.cssText = 'display:flex;align-items:center;gap:10px';
    const recLbl=document.createElement('span');recLbl.style.cssText='font-size:12px;font-weight:600;color:var(--muted);flex:1';recLbl.textContent='Repetition :';
    const recSel=document.createElement('select');
    recSel.style.cssText='border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:12px;padding:5px 8px;-webkit-appearance:none;font-family:var(--font)';
    [['false','1 semaine (ponctuel)'],['true','16 semaines (recurrent)']].forEach(([v,l])=>{const o=document.createElement('option');o.value=v;o.textContent=l;recSel.appendChild(o);});
    recRow.append(recLbl, recSel);

    opts.append(hourRow, durRow, recRow);

    // Boutons
    const btns = document.createElement('div');
    btns.style.cssText = 'display:flex;gap:8px';

    const dlBtn = document.createElement('button');
    dlBtn.style.cssText='flex:2;padding:13px;border-radius:14px;border:none;background:var(--teal);color:#fff;font-size:15px;font-weight:700;font-family:var(--font);cursor:pointer;touch-action:manipulation;-webkit-appearance:none';
    dlBtn.textContent='📥 Telecharger .ics';

    const cancelBtn = document.createElement('button');
    cancelBtn.style.cssText='flex:1;padding:13px;border-radius:14px;border:1.5px solid var(--border);background:transparent;color:var(--muted);font-size:14px;font-weight:700;font-family:var(--font);cursor:pointer;touch-action:manipulation;-webkit-appearance:none';
    cancelBtn.textContent='Annuler';

    const doDownload = () => {
      const ics = ICSExport.generate({
        startHour:   parseInt(hourInp.value)||19,
        durationMin: parseInt(durInp.value)||75,
        recurring:   recSel.value==='true',
      });
      const blob = new Blob([ics], { type:'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href=url; a.download='planning-coach-tracker.ics';
      a.click(); URL.revokeObjectURL(url);
      overlay.remove();
      if (typeof showToast==='function') showToast('Fichier .ics genere — ouvrez-le pour ajouter au Calendrier','save',4000);
    };
    dlBtn.ontouchstart=(e)=>{e.preventDefault();doDownload();}; dlBtn.onclick=doDownload;
    cancelBtn.ontouchstart=(e)=>{e.preventDefault();overlay.remove();}; cancelBtn.onclick=()=>overlay.remove();
    btns.append(cancelBtn, dlBtn);

    sheet.append(handle, title, sub, opts, btns);
    overlay.appendChild(sheet);
    overlay.ontouchstart=(e)=>{if(e.target===overlay)overlay.remove();};
    overlay.onclick=(e)=>{if(e.target===overlay)overlay.remove();};
    document.body.appendChild(overlay);
  },
};
window.ICSExport = ICSExport;


/* ════════════════════════════════════════════════════════════════
   5. SPOTIFY — Musique pendant la séance
   OAuth 2.0 PKCE (sans client secret, sécurisé pour PWA)
   ════════════════════════════════════════════════════════════════ */

const SpotifyPlayer = {
  CLIENT_ID: '', // A renseigner dans les réglages
  REDIRECT:  window.location.origin + window.location.pathname,
  SCOPE:     'user-read-playback-state user-modify-playback-state user-read-currently-playing playlist-read-private',

  _token: null,
  _expiry: 0,

  /* Générer un code verifier PKCE */
  async _generatePKCE() {
    const arr = new Uint8Array(32);
    crypto.getRandomValues(arr);
    const verifier = btoa(String.fromCharCode(...arr)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    const challenge = btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
    return { verifier, challenge };
  },

  async connect(clientId) {
    if (!clientId) { if(typeof showToast==='function') showToast('Entrez votre Spotify Client ID dans les reglages','error',3000); return; }
    SpotifyPlayer.CLIENT_ID = clientId;
    S.apiKeys.spotify = clientId;
    if (typeof save==='function') save();

    const { verifier, challenge } = await SpotifyPlayer._generatePKCE();
    localStorage.setItem('spotify_verifier', verifier);
    const params = new URLSearchParams({
      client_id:             clientId,
      response_type:         'code',
      redirect_uri:          SpotifyPlayer.REDIRECT,
      code_challenge_method: 'S256',
      code_challenge:        challenge,
      scope:                 SpotifyPlayer.SCOPE,
      state:                 'ctp_spotify',
    });
    window.location = 'https://accounts.spotify.com/authorize?' + params;
  },

  async handleCallback() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('state') !== 'ctp_spotify' || !params.get('code')) return false;

    const code     = params.get('code');
    const verifier = localStorage.getItem('spotify_verifier');
    const clientId = S.apiKeys?.spotify || '';
    if (!verifier || !clientId) return false;

    const body = new URLSearchParams({
      grant_type:    'authorization_code',
      code,
      redirect_uri:  SpotifyPlayer.REDIRECT,
      client_id:     clientId,
      code_verifier: verifier,
    });

    const resp = await fetch('https://accounts.spotify.com/api/token', {
      method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body: body.toString(),
    });
    if (!resp.ok) return false;
    const data = await resp.json();
    SpotifyPlayer._token  = data.access_token;
    SpotifyPlayer._expiry = Date.now() + data.expires_in * 1000;
    localStorage.setItem('spotify_token',  data.access_token);
    localStorage.setItem('spotify_refresh', data.refresh_token || '');
    localStorage.setItem('spotify_expiry',  SpotifyPlayer._expiry);

    window.history.replaceState({}, '', window.location.pathname);
    return true;
  },

  getToken() {
    if (SpotifyPlayer._token && Date.now() < SpotifyPlayer._expiry) return SpotifyPlayer._token;
    const stored = localStorage.getItem('spotify_token');
    const expiry  = parseInt(localStorage.getItem('spotify_expiry')) || 0;
    if (stored && Date.now() < expiry) {
      SpotifyPlayer._token  = stored;
      SpotifyPlayer._expiry = expiry;
      return stored;
    }
    return null;
  },

  async getNowPlaying() {
    const token = SpotifyPlayer.getToken();
    if (!token) return null;
    const resp = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: { 'Authorization': 'Bearer ' + token },
    });
    if (resp.status === 204 || !resp.ok) return null;
    const data = await resp.json();
    return {
      title:   data.item?.name || '',
      artist:  data.item?.artists?.[0]?.name || '',
      album:   data.item?.album?.name || '',
      image:   data.item?.album?.images?.[2]?.url || '',
      playing: data.is_playing,
      progress: data.progress_ms,
      duration: data.item?.duration_ms,
    };
  },

  async togglePlay() {
    const token = SpotifyPlayer.getToken();
    if (!token) return;
    const now = await SpotifyPlayer.getNowPlaying();
    const endpoint = now?.playing ? '/me/player/pause' : '/me/player/play';
    await fetch('https://api.spotify.com/v1' + endpoint, {
      method: 'PUT', headers: { 'Authorization': 'Bearer ' + token },
    });
  },

  async getWorkoutPlaylists() {
    const token = SpotifyPlayer.getToken();
    if (!token) return [];
    const resp = await fetch('https://api.spotify.com/v1/search?q=workout+gym+training&type=playlist&limit=6', {
      headers: { 'Authorization': 'Bearer ' + token },
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data.playlists?.items || []).filter(Boolean).map(p => ({
      id: p.id, name: p.name, image: p.images?.[0]?.url || '',
      tracks: p.tracks?.total || 0, uri: p.uri,
    }));
  },

  async playPlaylist(uri) {
    const token = SpotifyPlayer.getToken();
    if (!token) return;
    await fetch('https://api.spotify.com/v1/me/player/play', {
      method:'PUT', headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},
      body: JSON.stringify({ context_uri: uri }),
    });
  },

  showPlayer() {
    const token = SpotifyPlayer.getToken();
    if (!token) {
      SpotifyPlayer.showSetup();
      return;
    }

    document.getElementById('spotify-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.id='spotify-overlay';
    overlay.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.55);z-index:9500;display:flex;align-items:flex-end;justify-content:center';

    const sheet = document.createElement('div');
    sheet.style.cssText='background:#121212;border-radius:24px 24px 0 0;padding:20px 16px calc(20px + env(safe-area-inset-bottom,0px));width:100%;max-width:480px;max-height:70vh;overflow-y:auto;-webkit-overflow-scrolling:touch;display:flex;flex-direction:column;gap:12px';

    const handle=document.createElement('div');handle.style.cssText='width:36px;height:4px;border-radius:2px;background:#333;margin:0 auto';

    const title=document.createElement('div');
    title.style.cssText='font-size:16px;font-weight:700;color:#fff;display:flex;align-items:center;gap:8px';
    title.innerHTML='<span style="color:#1DB954">♫</span> Spotify — Musique de seance';

    // Now playing
    const nowRow=document.createElement('div');
    nowRow.id='spotify-now-row';
    nowRow.style.cssText='background:#282828;border-radius:12px;padding:12px;display:flex;align-items:center;gap:12px;min-height:60px';
    nowRow.innerHTML='<div style="color:#999;font-size:12px">Chargement...</div>';
    SpotifyPlayer.getNowPlaying().then(np => {
      nowRow.innerHTML='';
      if (!np) { nowRow.innerHTML='<div style="color:#999;font-size:12px">Aucune lecture en cours — lancez Spotify sur votre appareil</div>'; return; }
      if (np.image) { const img=document.createElement('img');img.src=np.image;img.style.cssText='width:48px;height:48px;border-radius:6px;flex-shrink:0';nowRow.appendChild(img); }
      const info=document.createElement('div');info.style.cssText='flex:1;min-width:0';
      info.innerHTML='<div style="font-size:13px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+np.title+'</div><div style="font-size:11px;color:#999;margin-top:1px">'+np.artist+'</div>';
      const playBtn=document.createElement('button');
      playBtn.style.cssText='width:40px;height:40px;border-radius:50%;border:none;background:#1DB954;font-size:16px;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;touch-action:manipulation';
      playBtn.textContent=np.playing?'⏸':'▶';
      playBtn.ontouchstart=(e)=>{e.preventDefault();SpotifyPlayer.togglePlay().then(()=>SpotifyPlayer.showPlayer());};
      playBtn.onclick=()=>SpotifyPlayer.togglePlay().then(()=>SpotifyPlayer.showPlayer());
      nowRow.append(info, playBtn);
    });

    // Workout playlists
    const plTitle=document.createElement('div');plTitle.style.cssText='font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#999';plTitle.textContent='Playlists Entrainement';
    const plGrid=document.createElement('div');plGrid.style.cssText='display:grid;grid-template-columns:1fr 1fr;gap:8px';
    plGrid.innerHTML='<div style="color:#999;font-size:11px;grid-column:span 2">Chargement...</div>';
    SpotifyPlayer.getWorkoutPlaylists().then(pls=>{
      plGrid.innerHTML='';
      pls.forEach(pl=>{
        const btn=document.createElement('button');
        btn.style.cssText='background:#282828;border:none;border-radius:10px;padding:10px;text-align:left;cursor:pointer;touch-action:manipulation;-webkit-appearance:none;display:flex;flex-direction:column;gap:4px';
        if(pl.image){const img=document.createElement('img');img.src=pl.image;img.style.cssText='width:100%;aspect-ratio:1;border-radius:6px;object-fit:cover;margin-bottom:4px';btn.appendChild(img);}
        const nm=document.createElement('div');nm.style.cssText='font-size:11px;font-weight:600;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';nm.textContent=pl.name;
        const tr=document.createElement('div');tr.style.cssText='font-size:9px;color:#999';tr.textContent=pl.tracks+' titres';
        btn.append(nm,tr);
        const play=()=>{SpotifyPlayer.playPlaylist(pl.uri).then(()=>{if(typeof showToast==='function')showToast('Lecture : '+pl.name,'save',2000);});};
        btn.ontouchstart=(e)=>{e.preventDefault();play();}; btn.onclick=play;
        plGrid.appendChild(btn);
      });
      if(!pls.length) plGrid.innerHTML='<div style="color:#999;font-size:11px;grid-column:span 2">Lancez Spotify sur votre telephone d abord</div>';
    });

    const closeBtn=document.createElement('button');closeBtn.style.cssText='width:100%;padding:10px;border:none;background:none;color:#666;font-size:14px;font-family:var(--font);cursor:pointer;touch-action:manipulation;-webkit-appearance:none';closeBtn.textContent='Fermer';
    closeBtn.ontouchstart=(e)=>{e.preventDefault();overlay.remove();}; closeBtn.onclick=()=>overlay.remove();

    sheet.append(handle,title,nowRow,plTitle,plGrid,closeBtn);
    overlay.appendChild(sheet);
    overlay.ontouchstart=(e)=>{if(e.target===overlay)overlay.remove();};
    overlay.onclick=(e)=>{if(e.target===overlay)overlay.remove();};
    document.body.appendChild(overlay);
  },

  showSetup() {
    document.getElementById('spotify-setup-overlay')?.remove();
    const overlay=document.createElement('div');overlay.id='spotify-setup-overlay';
    overlay.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.6);z-index:9500;display:flex;align-items:flex-end;justify-content:center';
    const sheet=document.createElement('div');
    sheet.style.cssText='background:var(--surface);border-radius:24px 24px 0 0;padding:20px 16px calc(20px + env(safe-area-inset-bottom,0px));width:100%;max-width:480px;display:flex;flex-direction:column;gap:12px';
    const handle=document.createElement('div');handle.style.cssText='width:36px;height:4px;border-radius:2px;background:var(--border);margin:0 auto';
    const title=document.createElement('div');title.style.cssText='font-size:16px;font-weight:700;color:var(--text)';title.textContent='♫ Connecter Spotify';
    const steps=[
      '1. Allez sur developer.spotify.com → Create App',
      '2. Redirect URI : ' + SpotifyPlayer.REDIRECT,
      '3. Copiez votre Client ID ci-dessous',
    ];
    const stepsEl=document.createElement('div');stepsEl.style.cssText='background:var(--bg);border-radius:10px;padding:10px 12px;font-size:11px;color:var(--muted);line-height:1.8';stepsEl.textContent=steps.join('\n');
    const inp=document.createElement('input');inp.type='text';inp.placeholder='Client ID Spotify';
    inp.value=S.apiKeys?.spotify||'';
    inp.style.cssText='padding:12px 14px;border-radius:12px;border:1.5px solid var(--teal);background:var(--bg);font-size:16px;font-family:var(--mono);color:var(--text);-webkit-appearance:none;outline:none;width:100%;box-sizing:border-box';
    const connectBtn=document.createElement('button');connectBtn.style.cssText='padding:13px;border-radius:14px;border:none;background:#1DB954;color:#000;font-size:15px;font-weight:700;font-family:var(--font);cursor:pointer;touch-action:manipulation;-webkit-appearance:none;width:100%';connectBtn.textContent='Connecter Spotify';
    const doConnect=()=>SpotifyPlayer.connect(inp.value.trim());
    connectBtn.ontouchstart=(e)=>{e.preventDefault();doConnect();}; connectBtn.onclick=doConnect;
    const cancel=document.createElement('button');cancel.style.cssText='padding:10px;border:none;background:none;color:var(--muted);font-size:14px;font-family:var(--font);cursor:pointer;touch-action:manipulation;-webkit-appearance:none;width:100%';cancel.textContent='Annuler';
    cancel.ontouchstart=(e)=>{e.preventDefault();overlay.remove();}; cancel.onclick=()=>overlay.remove();
    sheet.append(handle,title,stepsEl,inp,connectBtn,cancel);
    overlay.appendChild(sheet);
    overlay.ontouchstart=(e)=>{if(e.target===overlay)overlay.remove();};
    overlay.onclick=(e)=>{if(e.target===overlay)overlay.remove();};
    document.body.appendChild(overlay);
  },
};
window.SpotifyPlayer = SpotifyPlayer;


/* ════════════════════════════════════════════════════════════════
   INITIALISATION — Gérer les callbacks OAuth et URL params
   ════════════════════════════════════════════════════════════════ */

window.addEventListener('load', () => {
  setTimeout(async () => {
    // Spotify OAuth callback
    if (window.location.search.includes('state=ctp_spotify')) {
      try {
        const ok = await SpotifyPlayer.handleCallback();
        if (ok && typeof showToast==='function') showToast('Spotify connecte avec succes !','save',3000);
      } catch(e) { console.warn('Spotify callback error:', e); }
    }
  }, 500);
});
