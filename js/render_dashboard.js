/* ============================================================
   render_dashboard.js — Page Accueil
============================================================ */

function renderDashboard(){
  const wrap = document.getElementById('dash-wrap');
  if(!wrap) return;
  wrap.innerHTML = '';

  const today    = new Date();
  const todayStr = localDateStr(today);
  const hours    = today.getHours();
  const dayIdx   = today.getDay()===0?6:today.getDay()-1;
  const todayDay = S.days[dayIdx]||{};
  const todayName= ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'][dayIdx];
  const dateFmt  = today.toLocaleDateString('fr-FR',{day:'numeric',month:'long'});
  const greetTxt = hours<5?'Bonne nuit':hours<12?'Bonjour':hours<18?'Bonne après-midi':'Bonsoir';
  const greetEmoji = hours<5?'🌙':hours<12?'☀️':hours<18?'🌤️':'🌙';

  // ── HERO: Greeting + Score de forme ──
  const fs = computeFitnessScore();
  const scoreColor = fs.score>=80?'var(--green)':fs.score>=60?'var(--teal)':fs.score>=40?'var(--orange)':'var(--red)';
  const grade = fs.score>=90?'Excellent 🔥':fs.score>=75?'Très bien 💪':fs.score>=60?'Bien 👍':fs.score>=45?'Correct 📈':'À améliorer 💤';
  const circ = 2*Math.PI*38;
  const dashArr = circ*(fs.score/100);

  const hero = document.createElement('div');
  hero.className = 'dash-hero';
  hero.innerHTML = `
    <div class="dash-hero-left">
      <div class="dash-greeting">${greetEmoji} ${greetTxt} !</div>
      <div class="dash-date">${todayName} ${dateFmt}</div>
      <div class="dash-week-badge">Semaine ${S.weekType||'A'} — Bloc ${S.currentBlock||1}</div>
      <div class="dash-grade" style="color:${scoreColor}">${grade}</div>
    </div>
    <div class="dash-hero-right">
      <svg class="dash-score-svg" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="38" fill="none" stroke="var(--border)" stroke-width="8"/>
        <circle cx="50" cy="50" r="38" fill="none" stroke="${scoreColor}" stroke-width="8"
          stroke-linecap="round" stroke-dasharray="${dashArr.toFixed(1)} ${circ.toFixed(1)}"
          stroke-dashoffset="${(circ*0.25).toFixed(1)}"
          style="transition:stroke-dasharray 1s ease"/>
        <text x="50" y="46" text-anchor="middle" font-family="var(--mono)" font-size="20" font-weight="800" fill="var(--text)">${fs.score}</text>
        <text x="50" y="60" text-anchor="middle" font-size="9" fill="var(--muted)">/ 100</text>
      </svg>
      <div class="dash-score-lbl">Score de forme</div>
    </div>`;
  wrap.appendChild(hero);

  // ── ACTIONS RAPIDES ──
  // Calculer les données de séance tôt (nécessaires pour le sous-titre du bouton Séance)
  const _exsEarly     = (todayDay.exercises || []).filter(e => e.name && e.name.trim() && !e.isWarmup);
  const _doneExsEarly = _exsEarly.filter(e => e.done);

  const lastPoids0  = (S.mesures?.poids || []).slice(-1)[0];
  const stepsNow    = parseInt(S.steps?.[todayStr] || 0) || 0;
  const sleepNow    = parseFloat(S.sleep?.[todayStr]?.hours) || 0;

  const quickActions = [
    {
      icon: '▶', label: 'Séance', sub: _doneExsEarly.length > 0 ? _doneExsEarly.length + '/' + _exsEarly.length + ' faits' : _exsEarly.length > 0 ? 'Commencer' : 'Repos',
      color: '--teal',
      action: () => switchTab('session'),
    },
    {
      icon: '⚖', label: 'Peser', sub: lastPoids0 ? lastPoids0.val + 'kg' : 'Non renseigné',
      color: '--purple',
      action: () => _quickLogModal('weight'),
    },
    {
      icon: '👟', label: 'Pas', sub: stepsNow >= 1000 ? (stepsNow/1000).toFixed(1) + 'k' : stepsNow > 0 ? String(stepsNow) : 'Non renseigné',
      color: '--green',
      action: () => _quickLogModal('steps'),
    },
    {
      icon: '😴', label: 'Sommeil', sub: sleepNow > 0 ? sleepNow + 'h' : 'Non renseigné',
      color: '--blue',
      action: () => _quickLogModal('sleep'),
    },
  ];

  const qaRow = document.createElement('div');
  qaRow.className = 'dash-qa-row';

  quickActions.forEach(qa => {
    const btn = document.createElement('button');
    btn.className = 'dash-qa-btn';
    btn.innerHTML = `
      <span class="dash-qa-icon" style="color:var(${qa.color})">${qa.icon}</span>
      <span class="dash-qa-label">${qa.label}</span>
      <span class="dash-qa-sub">${qa.sub}</span>`;
    btn.ontouchstart = (e) => { e.preventDefault(); qa.action(); };
    btn.onclick = qa.action;
    qaRow.appendChild(btn);
  });

  wrap.appendChild(qaRow);

  // ── INDICATEUR DE FATIGUE (RPE moyen 3 dernières séances) ──
  (function() {
    const recentRPEs = [];
    Object.values(S.history || {}).forEach(wk => {
      (wk.days || []).forEach(d => {
        (d.exercises || []).forEach(ex => {
          (ex.setData || []).forEach(s => {
            if (s.rpe && s.rpe !== '—' && parseFloat(s.rpe) > 0) {
              recentRPEs.push({ rpe: parseFloat(s.rpe), date: d.date || '' });
            }
          });
        });
      });
    });
    recentRPEs.sort((a, b) => b.date.localeCompare(a.date));
    const last30 = recentRPEs.slice(0, 30);
    if (!last30.length) return;
    const avg = last30.reduce((s, r) => s + r.rpe, 0) / last30.length;
    const rounded = Math.round(avg * 10) / 10;
    let status, color, icon, advice;
    if (avg < 7)       { status='Tres frais';  color='var(--green)';  icon='🟢'; advice='Chargez plus lourd aujourd hui'; }
    else if (avg < 8)  { status='Frais';        color='var(--teal)';   icon='🟢'; advice='Bonne forme, continuez'; }
    else if (avg < 8.5){ status='Normal';       color='var(--muted)';  icon='🟡'; advice='Recuperation standard suffisante'; }
    else if (avg < 9)  { status='Fatigue';      color='var(--orange)'; icon='🟠'; advice='Privilegiez le sommeil ce soir'; }
    else               { status='Surmenage';    color='var(--red)';    icon='🔴'; advice='Considerez une seance allégée'; }
    const card = document.createElement('div');
    card.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--card);border-radius:14px;margin:0 0 10px;border:1px solid var(--border)';
    const left = document.createElement('div'); left.style.cssText='flex:1';
    const tl=document.createElement('div');tl.style.cssText='font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em';tl.textContent='Etat de forme';
    const st=document.createElement('div');st.style.cssText='font-size:16px;font-weight:800;color:'+color+';margin-top:2px';st.textContent=icon+' '+status;
    const adv=document.createElement('div');adv.style.cssText='font-size:10px;color:var(--muted);margin-top:1px';adv.textContent=advice;
    left.appendChild(tl);left.appendChild(st);left.appendChild(adv);
    const right=document.createElement('div');right.style.cssText='text-align:right';
    const rpe=document.createElement('div');rpe.style.cssText='font-family:var(--mono);font-size:22px;font-weight:800;color:'+color;rpe.textContent=rounded;
    const rpeL=document.createElement('div');rpeL.style.cssText='font-size:9px;color:var(--muted)';rpeL.textContent='RPE moy.';
    right.appendChild(rpe);right.appendChild(rpeL);
    card.appendChild(left);card.appendChild(right);
    wrap.appendChild(card);
  })();


  const stepsToday = parseInt(S.steps&&S.steps[todayStr]||0)||0;
  const stepsGoal  = S.stepsGoal||10000;
  const stepsPct   = Math.min(100,Math.round(stepsToday/stepsGoal*100));
  const calToday   = (()=>{ const cd=S.calories&&S.calories[todayStr]; let t=0; if(cd&&cd.meals) cd.meals.forEach(m=>(m.items||[]).forEach(it=>t+=it.cal||0)); return Math.round(t); })();
  const calGoal    = S.caloriesGoal||2500;
  const calPct     = Math.min(100,Math.round(calToday/calGoal*100));
  const sleepLast  = (()=>{ const d=lastNDays(1)[0]; const sl=S.sleep&&S.sleep[d]; return parseFloat(sl&&(sl.hours||sl.h)||0)||0; })();
  const sleepGoal  = S._sleepGoal||8;
  const st         = computeStreak();
  const tdee       = computeTDEE();

  const stats = [
    {icon:'👣', val:stepsToday>=1000?(stepsToday/1000).toFixed(1)+'k':stepsToday, lbl:'Pas', sub:`${stepsPct}% de l'objectif`, pct:stepsPct, color:'--green'},
    {icon:'🔥', val:calToday+'', lbl:'kcal', sub:`/ ${calGoal} objectif`, pct:calPct, color:'--orange'},
    {icon:'😴', val:sleepLast?sleepLast+'h':'—', lbl:'Sommeil', sub:`Obj. ${sleepGoal}h`, pct:sleepLast?Math.min(100,Math.round(sleepLast/sleepGoal*100)):0, color:'--purple'},
    {icon:'🔥', val:st.current+'j', lbl:'Streak', sub:`Record ${st.record}j`, pct:Math.min(100,Math.round(st.current/(st.record||1)*100)), color:'--red'},
  ];

  const statsGrid = document.createElement('div');
  statsGrid.className = 'dash-stats-grid';
  stats.forEach(s=>{
    const el = document.createElement('div');
    el.className = 'dash-stat-card';
    el.innerHTML = `
      <div class="dash-stat-icon">${s.icon}</div>
      <div class="dash-stat-val">${s.val}</div>
      <div class="dash-stat-lbl">${s.lbl}</div>
      <div class="dash-stat-bar-wrap">
        <div class="dash-stat-bar" style="width:${s.pct}%;background:var(${s.color})"></div>
      </div>
      <div class="dash-stat-sub">${s.sub}</div>`;
    statsGrid.appendChild(el);
  });
  wrap.appendChild(statsGrid);

  // ── RÉCUPÉRATION APPLE WATCH (si données disponibles) ──
  if (typeof renderRecoveryWidget === 'function') renderRecoveryWidget(wrap);

  // ── COURBE POIDS (si ≥3 mesures) ──
  const weightEntries = (S.mesures?.poids || []).slice(-10);
  if (weightEntries.length >= 2) {
    const wCard = document.createElement('div');
    wCard.className = 'dash-weight-card';
    const first = parseFloat(weightEntries[0].val || weightEntries[0].value) || 0;
    const last  = parseFloat(weightEntries[weightEntries.length-1].val || weightEntries[weightEntries.length-1].value) || 0;
    const diff  = Math.round((last - first) * 10) / 10;
    const diffStr = (diff > 0 ? '+' : '') + diff + ' kg';
    const diffColor = diff < 0 ? 'var(--green)' : diff > 0 ? 'var(--orange)' : 'var(--muted)';

    wCard.innerHTML = `
      <div class="dash-weight-header">
        <span class="dash-weight-title">⚖️ Évolution du poids</span>
        <span class="dash-weight-stats">
          <span style="font-family:var(--mono);font-weight:700;font-size:15px">${last}kg</span>
          <span style="font-size:11px;color:${diffColor};font-weight:700;margin-left:6px">${diffStr}</span>
        </span>
      </div>
      <div class="dash-weight-spark" id="dash-weight-canvas"></div>`;
    wrap.appendChild(wCard);

    // Dessiner le sparkline après rendu DOM
    setTimeout(() => {
      const sparkWrap = document.getElementById('dash-weight-canvas');
      if (!sparkWrap) return;
      const vals = weightEntries.map(e => parseFloat(e.val || e.value) || 0).filter(v => v > 0);
      if (vals.length < 2) return;
      const W = sparkWrap.clientWidth || 280, H = 48;
      const cv = document.createElement('canvas');
      cv.width = W; cv.height = H; cv.style.cssText = 'width:100%;display:block';
      sparkWrap.appendChild(cv);
      const ctx2 = cv.getContext('2d');
      const min = Math.min(...vals) - 1, max = Math.max(...vals) + 1;
      const xStep = W / (vals.length - 1);
      const yPos = v => H - ((v - min) / (max - min)) * (H - 8) - 4;
      // Fill area
      const grad = ctx2.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, 'rgba(91,168,160,.25)');
      grad.addColorStop(1, 'rgba(91,168,160,.02)');
      ctx2.beginPath();
      vals.forEach((v, i) => i === 0 ? ctx2.moveTo(0, yPos(v)) : ctx2.lineTo(i * xStep, yPos(v)));
      ctx2.lineTo((vals.length-1)*xStep, H); ctx2.lineTo(0, H); ctx2.closePath();
      ctx2.fillStyle = grad; ctx2.fill();
      // Line
      ctx2.beginPath();
      ctx2.strokeStyle = 'var(--teal)'; ctx2.lineWidth = 2; ctx2.lineJoin = 'round';
      vals.forEach((v, i) => i === 0 ? ctx2.moveTo(0, yPos(v)) : ctx2.lineTo(i * xStep, yPos(v)));
      ctx2.stroke();
      // Last dot
      const lx = (vals.length-1)*xStep, ly = yPos(vals[vals.length-1]);
      ctx2.beginPath(); ctx2.arc(lx, ly, 3.5, 0, Math.PI*2);
      ctx2.fillStyle = 'var(--teal)'; ctx2.fill();
    }, 60);
  }
  const breakdownCard = document.createElement('div');
  breakdownCard.className = 'dash-breakdown-card';
  breakdownCard.innerHTML = `<div class="dash-breakdown-title">Détail du score de forme</div>`;

  const tips = {
    'Assiduité': s => s >= 90 ? 'Presence exemplaire cette semaine !' : s >= 60 ? 'Bonne presence, continuez !' : 'Essayez de venir au moins 3 fois cette semaine',
    'Programme': s => s >= 90 ? 'Programme suivi a la lettre !' : s >= 60 ? 'Quelques exercices sautes — restez au programme' : 'Beaucoup d exercices non realises — adaptez le programme',
    'Pas':       s => s >= 80 ? 'Objectif pas atteint !' : 'Il manque des pas pour atteindre votre objectif',
    'Sommeil':   s => s >= 80 ? 'Recuperation optimale' : 'Dormez plus pour optimiser vos gains',
    'Nutrition': s => s >= 80 ? 'Apports bien equilibres' : 'Renseignez vos repas dans Corps',
    'Recup.':    s => s >= 80 ? 'Recuperation excellente' : 'Notez votre recuperation apres les seances',
    'Récup.':    s => s >= 80 ? 'Recuperation excellente' : 'Notez votre recuperation apres les seances',
  };

  fs.breakdown.forEach(b => {
    const row = document.createElement('div');
    row.className = 'dash-breakdown-row';
    const tip  = (tips[b.label] || (() => ''))(b.pts);
    row.innerHTML = `
      <div class="dash-breakdown-left">
        <span class="dash-breakdown-icon">${b.icon}</span>
        <div class="dash-breakdown-info">
          <div class="dash-breakdown-name">${b.label}</div>
          <div class="dash-breakdown-tip">${tip}</div>
        </div>
      </div>
      <div class="dash-breakdown-right">
        <div class="dash-breakdown-bar-wrap">
          <div class="dash-breakdown-bar" style="width:${b.pts}%;background:var(${b.color||'--teal'})"></div>
        </div>
        <span class="dash-breakdown-pts" style="color:var(${b.color||'--teal'})">${b.pts}</span>
      </div>`;
    breakdownCard.appendChild(row);
  });

  wrap.appendChild(breakdownCard);

  // ── SÉANCE DU JOUR (prominente, au-dessus des stats) ──
  const exs = (todayDay.exercises||[]).filter(e=>e.name&&e.name.trim()&&!e.isWarmup);
  const doneExs = exs.filter(e=>e.done);
  const isRest  = exs.length===0||(exs[0]&&exs[0].name&&exs[0].name.toLowerCase().includes('repos'));
  const sessionPct = exs.length? Math.round(doneExs.length/exs.length*100):0;

  const sessionCard = document.createElement('div');
  sessionCard.className = 'dash-session-card';
  if(isRest || exs.length===0){
    sessionCard.innerHTML = `
      <div class="dash-session-header">
        <span class="dash-session-day">📅 ${todayName.toUpperCase()}</span>
        <span class="dash-session-badge rest">Repos</span>
      </div>
      <div class="dash-session-msg">🛋️ Journée de récupération<br><small style="color:var(--muted)">Marche, étirements, sommeil</small></div>
      <button class="dash-session-btn secondary" onclick="switchTab('weekly')">📋 Voir planning</button>`;
  } else {
    const groups = [...new Set(exs.map(e=>e.muscles&&e.muscles[0]||'').filter(Boolean))].slice(0,3);
    sessionCard.innerHTML = `
      <div class="dash-session-header">
        <span class="dash-session-day">💪 ${todayName.toUpperCase()}</span>
        <span class="dash-session-badge ${doneExs.length>0?'progress':'upcoming'}">${doneExs.length>0?doneExs.length+'/'+exs.length+' faits':'À venir'}</span>
      </div>
      ${groups.length?`<div class="dash-session-muscles">${groups.join(' · ')}</div>`:''}
      <div class="dash-session-exs">${exs.slice(0,3).map(e=>`
        <div class="dash-session-ex ${e.done?'done':''}">
          <span class="dash-session-ex-dot ${e.done?'done':''}"></span>
          <span>${e.name}</span>
          <span class="dash-session-ex-sets">${e.sets||3}×${e.reps||'?'}</span>
        </div>`).join('')}${exs.length>3?`<div style="font-size:10px;color:var(--muted);margin-top:4px">+${exs.length-3} exercices</div>`:''}</div>
      ${sessionPct>0?`<div class="dash-session-progress-wrap">
        <div class="dash-session-progress-bar" style="width:${sessionPct}%"></div>
      </div>`:''}
      <div style="display:flex;gap:8px;margin-top:12px">
        <button class="dash-session-btn primary" onclick="switchTab('session')" style="flex:2">▶ ${doneExs.length>0?'Continuer':'Commencer'}</button>
        <button class="dash-session-btn secondary" onclick="switchTab('weekly')" style="flex:1">📋</button>
      </div>`;
  }
  wrap.appendChild(sessionCard);

  // ── OBJECTIF + PROGRESSION ──
  const obj = S.objective;
  if(obj&&obj.text){
    const objCard = document.createElement('div');
    objCard.className = 'dash-obj-card';
    const poids = (S.mesures&&S.mesures.poids&&S.mesures.poids.length)?
      parseFloat(S.mesures.poids[S.mesures.poids.length-1].val)||0:0;
    const targetW = parseFloat(obj.targetWeight)||0;
    const startW  = (S.mesures&&S.mesures.poids&&S.mesures.poids[0])?
      parseFloat(S.mesures.poids[0].val)||0:poids;
    const progress = (startW&&targetW&&poids&&startW!==targetW)?
      Math.min(100,Math.max(0,Math.round(Math.abs(startW-poids)/Math.abs(startW-targetW)*100))):0;
    const targetDate = obj.targetDate?new Date(obj.targetDate):null;
    const daysLeft = targetDate?Math.ceil((targetDate-today)/86400000):null;

    objCard.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        <span style="font-size:18px">🎯</span>
        <div>
          <div style="font-size:12px;font-weight:700;color:var(--text)">${escHtml(obj.text)}</div>
          ${daysLeft!==null?`<div style="font-size:10px;color:var(--muted)">${daysLeft>0?daysLeft+' jours restants':'Objectif atteint !'}</div>`:''}
        </div>
        ${poids&&targetW?`<div style="margin-left:auto;text-align:right">
          <div style="font-size:13px;font-weight:700;font-family:var(--mono);color:var(--teal-d)">${poids}kg</div>
          <div style="font-size:10px;color:var(--muted)">→ ${targetW}kg</div>
        </div>`:''}
      </div>
      ${progress>0?`<div style="background:var(--border);border-radius:6px;height:6px;overflow:hidden">
        <div style="width:${progress}%;height:100%;background:var(--teal);border-radius:6px;transition:width 1s"></div>
      </div>
      <div style="font-size:10px;color:var(--muted);margin-top:4px">${progress}% atteint</div>`:''}`;
    wrap.appendChild(objCard);
  }

  // ── ALERTES ──
  const pains = activePains();
  const alerts = [];
  if(stepsToday<stepsGoal*0.3&&hours>14) alerts.push({icon:'👣',txt:`Seulement ${stepsToday.toLocaleString('fr')} pas — Allez marcher !`,color:'orange',tab:'corps'});
  if(sleepLast>0&&sleepLast<6) alerts.push({icon:'😴',txt:`Sommeil insuffisant (${sleepLast}h) — Repos prioritaire`,color:'red',tab:'corps'});
  if(pains.length>0) alerts.push({icon:'⚠️',txt:`${pains.length} douleur${pains.length>1?'s':''} signalée${pains.length>1?'s':''}`,color:'red',tab:'corps'});
  if(st.current===0&&hours>18) alerts.push({icon:'💪',txt:`Pas encore entraîné aujourd'hui`,color:'teal',tab:'session'});

  // Alerte décharge (deload)
  const weeksN = S.weekCount || 1;
  const deloadIn = (5 - ((weeksN - 1) % 5)) % 5 || 5;
  if (deloadIn === 1) alerts.push({icon:'🔄',txt:'Semaine de décharge recommandée la semaine prochaine — Réduisez le volume de 40%',color:'orange',tab:'bilan'});
  if (weeksN % 5 === 0) alerts.push({icon:'🔄',txt:'Semaine de décharge ! Réduisez les charges de 40% et récupérez.',color:'red',tab:'bilan'});

  if(alerts.length){
    const alertsWrap = document.createElement('div');
    alertsWrap.style.cssText = 'display:flex;flex-direction:column;gap:6px';
    alerts.forEach(a=>{
      const al = document.createElement('div');
      al.className = `dash-alert dash-alert-${a.color}`;
      al.innerHTML = `<span>${a.icon}</span><span style="flex:1">${a.txt}</span><span style="font-size:10px;opacity:.7;cursor:pointer" onclick="switchTab('${a.tab}')">Voir →</span>`;
      alertsWrap.appendChild(al);
    });
    wrap.appendChild(alertsWrap);
  }


  // ── CALENDRIER D'ENTRAÎNEMENT (28 jours) ──
  (function() {
    const calCard = document.createElement('div');
    calCard.className = 'dash-cal-card';

    const calTitle = document.createElement('div');
    calTitle.className = 'dash-cal-title';
    calTitle.innerHTML = `🔥 Streak <strong style="color:var(--red)">${st.current}j</strong> &nbsp;·&nbsp; Record <strong>${st.record}j</strong> &nbsp;·&nbsp; ${st.monthActive} séances ce mois`;
    calCard.appendChild(calTitle);

    // Grille 28 jours (4 semaines)
    const grid = document.createElement('div');
    grid.className = 'dash-cal-grid';

    // En-têtes jours
    ['L','M','M','J','V','S','D'].forEach(d => {
      const lbl = document.createElement('div');
      lbl.className = 'dash-cal-lbl'; lbl.textContent = d;
      grid.appendChild(lbl);
    });

    // Construire un lookup date → entraîné
    const trainedDates = new Set();
    const today = new Date();

    // Semaine courante
    (S.days || []).forEach(d => {
      if (d.date && (d.exercises||[]).some(e => e.done && !e.isWarmup)) {
        trainedDates.add(d.date);
      }
    });
    // Historique
    Object.values(S.history || {}).forEach(wk => {
      (wk.days || []).forEach(d => {
        if (d.date && (d.exercises||[]).some(e => e.done && !e.isWarmup)) {
          trainedDates.add(d.date);
        }
      });
    });

    // Aligner sur le lundi de la semaine la plus ancienne des 28 derniers jours
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 27);
    // Reculer jusqu'au lundi
    while (startDate.getDay() !== 1) startDate.setDate(startDate.getDate() - 1);

    const todayStr2 = localDateStr(today);
    for (let i = 0; i < 35; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const ds = localDateStr(d);
      const isFuture = ds > todayStr2;
      const isToday  = ds === todayStr2;
      const trained  = trainedDates.has(ds);
      const inRange  = ds >= localDateStr(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 27));

      const cell = document.createElement('div');
      cell.className = 'dash-cal-cell'
        + (trained  ? ' cal-trained'  : '')
        + (isToday  ? ' cal-today'    : '')
        + (isFuture ? ' cal-future'   : '')
        + (!inRange ? ' cal-out'      : '');

      if (isToday && !trained) cell.style.cssText = 'border:2px solid var(--teal)';
      grid.appendChild(cell);
    }

    calCard.appendChild(grid);
    wrap.appendChild(calCard);
  })();

  // ── DERNIÈRES SÉANCES ──
  const histKeys = Object.keys(S.history || {}).sort().reverse();
  const recentSessions = [];
  for (const k of histKeys) {
    const entries = (S.history[k] || []).filter(e => e.name && e.exercises);
    entries.forEach(e => recentSessions.push({ ...e, date: k }));
    if (recentSessions.length >= 3) break;
  }

  if (recentSessions.length > 0) {
    const histCard = document.createElement('div');
    histCard.className = 'dash-hist-card';
    histCard.innerHTML = '<div class="dash-hist-title">Dernières séances</div>';

    recentSessions.slice(0, 3).forEach(sess => {
      const d = new Date(sess.date + 'T12:00:00');
      const dateStr = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
      const vol = sess.volume >= 1000 ? (sess.volume / 1000).toFixed(1) + 't' : Math.round(sess.volume || 0) + 'kg';
      const exNames = (sess.exercises || []).filter(e => !e.isWarmup && e.done).map(e => e.name).slice(0, 3);
      const prsCount = (sess.exercises || []).filter(e => typeof checkPR === 'function' && checkPR(e)).length;

      const row = document.createElement('div');
      row.className = 'dash-hist-row';
      row.innerHTML = `
        <div class="dash-hist-left">
          <div class="dash-hist-name">${dateStr} — ${sess.name || 'Séance'}</div>
          <div class="dash-hist-exs">${exNames.join(', ')}${(sess.exercises||[]).filter(e=>!e.isWarmup&&e.done).length > 3 ? ' +' + ((sess.exercises||[]).filter(e=>!e.isWarmup&&e.done).length - 3) : ''}</div>
        </div>
        <div class="dash-hist-right">
          <span class="dash-hist-vol">${vol}</span>
          ${sess.duration ? `<span class="dash-hist-dur">${sess.duration}'</span>` : ''}
          ${prsCount > 0 ? `<span class="dash-hist-pr">🏆${prsCount}</span>` : ''}
        </div>`;
      histCard.appendChild(row);
    });

    const seeAllBtn = document.createElement('button');
    seeAllBtn.className = 'dash-hist-btn';
    seeAllBtn.textContent = 'Voir toute la progression →';
    seeAllBtn.ontouchstart = (e) => { e.preventDefault(); switchTab('progression'); };
    seeAllBtn.onclick = () => switchTab('progression');
    histCard.appendChild(seeAllBtn);

    wrap.appendChild(histCard);
  }

  // ── VOLUME HEBDO + BREAKDOWN PPL + COMPARAISON -4 SEMAINES ──
  setTimeout(()=>{
    // Comparaison -4 semaines
    const volData8 = computeWeeklyVolume(8);
    const curWeekVol  = volData8.find(v=>v.label==='Cette sem.')?.value || 0;
    const week4AgoVol = volData8.length >= 5 ? volData8[volData8.length-5]?.value || 0 : 0;
    if (curWeekVol > 0 && week4AgoVol > 0) {
      const delta4 = Math.round((curWeekVol - week4AgoVol) / week4AgoVol * 100);
      const comp4Card = document.createElement('div');
      comp4Card.style.cssText = 'background:var(--card);border-radius:14px;padding:10px 14px;margin-bottom:10px;border:1px solid var(--border);display:flex;align-items:center;justify-content:space-between';
      const cl = document.createElement('div');
      const ct=document.createElement('div');ct.style.cssText='font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em';ct.textContent='vs il y a 4 semaines';
      const cv=document.createElement('div');cv.style.cssText='font-size:14px;font-weight:700;color:var(--text);margin-top:2px';
      cv.textContent = (curWeekVol>=1000?(curWeekVol/1000).toFixed(1)+'t':Math.round(curWeekVol)+'kg') + ' cette semaine';
      cl.appendChild(ct);cl.appendChild(cv);
      const cr = document.createElement('div');cr.style.cssText='text-align:right';
      const cd=document.createElement('div');
      cd.style.cssText='font-size:18px;font-weight:800;color:'+(delta4>0?'var(--green)':delta4<0?'var(--red)':'var(--muted)');
      cd.textContent=(delta4>0?'+':'')+delta4+'%';
      const cs=document.createElement('div');cs.style.cssText='font-size:9px;color:var(--muted)';
      cs.textContent=(week4AgoVol>=1000?(week4AgoVol/1000).toFixed(1)+'t':Math.round(week4AgoVol)+'kg')+' à S-4';
      cr.appendChild(cd);cr.appendChild(cs);
      comp4Card.appendChild(cl);comp4Card.appendChild(cr);
      wrap.appendChild(comp4Card);
    }

    // Volume chart
    const volData = computeWeeklyVolume(8);
    if(volData.some(v=>v.value>0)){
      const {wrap:vw,canvas:vc} = mkChartWrap('dash-vol-chart','📊 Volume hebdomadaire','kg/sem');
      wrap.appendChild(vw);
      Charts.barChart(vc, volData.map(v=>({label:v.label,value:v.value,color:v.label==='Cette sem.'?'--teal':'--border'})),{height:120,yFmt:v=>v>=1000?(v/1000).toFixed(1)+'t':Math.round(v)+'kg'});
    }

    // PPL donut
    const ppl = computePPL();
    if(ppl.some(p=>p.value>0)){
      const {wrap:pw,canvas:pc} = mkChartWrap('dash-ppl-chart','🎯 Répartition musculaire','cette semaine');
      wrap.appendChild(pw);
      Charts.donutChart(pc, ppl.map(p=>({label:p.label,value:p.value,color:p.color})),{size:100});
    }
  }, 80);
}

/* ─────────────────────────────────────────────────────────
   QUICK LOG MODAL — Saisie rapide poids / pas / sommeil
───────────────────────────────────────────────────────── */
function _quickLogModal(type) {
  // Fermer si déjà ouvert
  document.getElementById('quick-log-overlay')?.remove();

  const configs = {
    weight: {
      title: '⚖ Peser aujourd\'hui',
      label: 'Poids corporel',
      unit:  'kg',
      placeholder: '75.0',
      inputMode: 'decimal',
      current: () => {
        const last = (S.mesures?.poids || []).slice(-1)[0];
        return last ? last.val : '';
      },
      save: (val) => {
        Store.dispatch({
          type: 'BODY_ADD_MESURE',
          payload: { key: 'poids', entry: { val, date: localDateStr() } },
        });
        save();
        renderDashboard();
        showToast('⚖ Poids enregistré : ' + val + 'kg', 'save', 2000);
      },
    },
    steps: {
      title: '👟 Pas aujourd\'hui',
      label: 'Nombre de pas',
      unit:  'pas',
      placeholder: '10000',
      inputMode: 'numeric',
      current: () => String(parseInt(S.steps?.[localDateStr()] || 0) || ''),
      save: (val) => {
        Store.dispatch({
          type: 'ACTIVITY_SET_STEPS',
          payload: { date: localDateStr(), value: parseInt(val) || 0 },
        }, { skipUndo: true });
        save();
        renderDashboard();
        showToast('👟 Pas enregistrés : ' + parseInt(val).toLocaleString('fr'), 'save', 2000);
      },
    },
    sleep: {
      title: '😴 Sommeil cette nuit',
      label: 'Heures de sommeil',
      unit:  'h',
      placeholder: '7.5',
      inputMode: 'decimal',
      current: () => {
        const sl = S.sleep?.[localDateStr()];
        return sl?.hours ? String(sl.hours) : '';
      },
      save: (val) => {
        Store.dispatch({
          type: 'ACTIVITY_SET_SLEEP',
          payload: { date: localDateStr(), value: { hours: parseFloat(val) || 0, quality: 1 } },
        }, { skipUndo: true });
        save();
        renderDashboard();
        showToast('😴 Sommeil enregistré : ' + val + 'h', 'save', 2000);
      },
    },
  };

  const cfg = configs[type];
  if (!cfg) return;

  // ── Overlay ──
  const overlay = document.createElement('div');
  overlay.id = 'quick-log-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.55);z-index:9200;display:flex;align-items:flex-end;justify-content:center';

  const card = document.createElement('div');
  card.style.cssText = [
    'background:var(--surface)',
    'border-radius:24px 24px 0 0',
    'padding:24px 20px calc(24px + env(safe-area-inset-bottom,0px))',
    'width:100%', 'max-width:480px',
    'display:flex', 'flex-direction:column', 'gap:16px',
  ].join(';');

  // Handle bar
  const handle = document.createElement('div');
  handle.style.cssText = 'width:36px;height:4px;border-radius:2px;background:var(--border);margin:0 auto 4px';
  card.appendChild(handle);

  // Title
  const title = document.createElement('div');
  title.style.cssText = 'font-size:17px;font-weight:700;color:var(--text);text-align:center';
  title.textContent = cfg.title;
  card.appendChild(title);

  // Current value hint
  const current = cfg.current();
  if (current) {
    const hint = document.createElement('div');
    hint.style.cssText = 'font-size:12px;color:var(--muted);text-align:center';
    hint.textContent = 'Dernière valeur : ' + current + ' ' + cfg.unit;
    card.appendChild(hint);
  }

  // Input
  const inputWrap = document.createElement('div');
  inputWrap.style.cssText = 'display:flex;align-items:center;gap:10px;background:var(--bg);border-radius:14px;padding:12px 16px;border:2px solid var(--teal)';

  const inp = document.createElement('input');
  inp.type        = 'text';
  inp.inputMode   = cfg.inputMode;
  inp.placeholder = cfg.placeholder;
  inp.value       = current;
  inp.style.cssText = 'flex:1;border:none;background:transparent;font-size:28px;font-weight:700;font-family:var(--mono);color:var(--text);outline:none;min-width:0;text-align:center;-webkit-appearance:none';

  const unitLbl = document.createElement('span');
  unitLbl.style.cssText = 'font-size:16px;font-weight:600;color:var(--muted);flex-shrink:0';
  unitLbl.textContent = cfg.unit;

  inputWrap.appendChild(inp);
  inputWrap.appendChild(unitLbl);
  card.appendChild(inputWrap);

  // Save button
  const saveBtn = document.createElement('button');
  saveBtn.style.cssText = 'width:100%;padding:15px;border-radius:16px;border:none;background:var(--teal);color:#fff;font-size:16px;font-weight:700;font-family:var(--font);cursor:pointer;touch-action:manipulation;-webkit-appearance:none';
  saveBtn.textContent = 'Enregistrer';

  function doSave() {
    const v = inp.value.trim().replace(',', '.');
    if (!v || isNaN(parseFloat(v))) { inp.focus(); return; }
    cfg.save(v);
    overlay.remove();
  }

  saveBtn.ontouchstart = (e) => { e.preventDefault(); doSave(); };
  saveBtn.onclick = doSave;
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doSave(); } });
  card.appendChild(saveBtn);

  // Cancel
  const cancelBtn = document.createElement('button');
  cancelBtn.style.cssText = 'width:100%;padding:10px;border-radius:12px;border:none;background:none;color:var(--muted);font-size:14px;font-family:var(--font);cursor:pointer;touch-action:manipulation;-webkit-appearance:none';
  cancelBtn.textContent = 'Annuler';
  cancelBtn.ontouchstart = (e) => { e.preventDefault(); overlay.remove(); };
  cancelBtn.onclick = () => overlay.remove();
  card.appendChild(cancelBtn);

  overlay.appendChild(card);

  overlay.ontouchstart = (e) => { if (e.target === overlay) overlay.remove(); };
  overlay.onclick      = (e) => { if (e.target === overlay) overlay.remove(); };

  document.body.appendChild(overlay);

  // Focus input after animation
  setTimeout(() => { inp.focus(); inp.select(); }, 100);
}




// ╔══════════════════════════════════════════════════════╗
// ║  ONBOARDING WIZARD                                   ║
// ╚══════════════════════════════════════════════════════╝
const ONBOARD_KEY = 'ctp_onboard_done_v2';

const ONBOARD_STEPS = [
  { id:'identity', icon:'👤', title:'Votre profil',
    sub:'Ces données servent au calcul de votre IMC et TDEE',
    fields:()=>`
      <div class="onboard-row">
        <div class="onboard-field"><label class="onboard-label">⚧ Sexe</label>
          <select class="onboard-inp" id="ob-gender"><option value="m">Homme</option><option value="f">Femme</option></select></div>
        <div class="onboard-field"><label class="onboard-label">📅 Âge</label>
          <input type="number" class="onboard-inp" id="ob-age" placeholder="30" min="10" max="100"></div>
      </div>
      <div class="onboard-row">
        <div class="onboard-field"><label class="onboard-label">📏 Taille (cm)</label>
          <input type="number" class="onboard-inp" id="ob-height" placeholder="175" min="130" max="230"></div>
        <div class="onboard-field"><label class="onboard-label">⚖️ Poids (kg)</label>
          <input type="number" class="onboard-inp" id="ob-weight" placeholder="75" min="30" max="300" step="0.1"></div>
      </div>
      <div style="font-size:11px;color:var(--muted);background:var(--bg);border-radius:8px;padding:8px 10px;margin-top:6px">
        💡 Tour de poignet et autres mesures disponibles dans Corps → Mensurations
      </div>
      <div id="ob-bmi-box" style="display:none;margin-top:10px;background:var(--bg);border:1px solid var(--teal);border-radius:10px;padding:10px 14px;font-size:12px">
        IMC : <strong id="ob-bmi-val"></strong> — <span id="ob-bmi-cat"></span>
      </div>`,
    onShow:()=>{
      const calc=()=>{
        const h=parseFloat(document.getElementById('ob-height')?.value);
        const w=parseFloat(document.getElementById('ob-weight')?.value);
        if(h>100&&w>20){
          const bmi=Math.round(w/(h/100)**2*10)/10;
          const cat=bmi<18.5?'Insuffisant':bmi<25?'Normal ✅':bmi<30?'Surpoids':'Obésité';
          document.getElementById('ob-bmi-val').textContent=bmi;
          document.getElementById('ob-bmi-cat').textContent=cat;
          document.getElementById('ob-bmi-box').style.display='block';
        }
      };
      document.getElementById('ob-height')?.addEventListener('input',calc);
      document.getElementById('ob-weight')?.addEventListener('input',calc);
    },
    save:()=>{
      const h=parseInt(document.getElementById('ob-height')?.value)||0;
      const w=parseFloat(document.getElementById('ob-weight')?.value)||0;
      const g=document.getElementById('ob-gender')?.value||'m';
      const a=parseInt(document.getElementById('ob-age')?.value)||30;
      if(h>0) S.profilTaille=h;
      if(w>0){ if(!S.mesures.poids)S.mesures.poids=[];
        const td=localDateStr(); if(!S.mesures.poids.find(e=>e.date===td)) S.mesures.poids.push({date:td,val:String(w)});}
      S._gender=g; S.profilSexe=g; S.profilAge=a; save(); // sync both legacy + new fields
    }
  },
  { id:'measures', icon:'📏', title:'Mensurations',
    sub:'Pour le suivi corporel et le % de masse grasse (US Navy)',
    fields:()=>`
      <div class="onboard-row">
        <div class="onboard-field"><label class="onboard-label">🎽 Poitrine (cm)</label>
          <input type="number" class="onboard-inp" id="ob-chest" placeholder="100" min="50" max="200" step="0.5"></div>
        <div class="onboard-field"><label class="onboard-label">👔 Taille (cm)</label>
          <input type="number" class="onboard-inp" id="ob-waist" placeholder="85" min="50" max="200" step="0.5"></div>
      </div>
      <div class="onboard-row">
        <div class="onboard-field"><label class="onboard-label">🍑 Hanches (cm)</label>
          <input type="number" class="onboard-inp" id="ob-hips" placeholder="95" min="50" max="200" step="0.5"></div>
        <div class="onboard-field"><label class="onboard-label">📏 Tour de cou (cm)</label>
          <input type="number" class="onboard-inp" id="ob-neck" placeholder="38" min="20" max="60" step="0.5"></div>
      </div>
      <div class="onboard-row">
        <div class="onboard-field"><label class="onboard-label">💪 Bras contracté (cm)</label>
          <input type="number" class="onboard-inp" id="ob-arm" placeholder="35" min="15" max="70" step="0.5"></div>
        <div class="onboard-field"><label class="onboard-label">🦵 Cuisse (cm)</label>
          <input type="number" class="onboard-inp" id="ob-thigh" placeholder="58" min="20" max="100" step="0.5"></div>
      </div>
      <div class="onboard-info-box">💡 Toutes les mesures sont optionnelles. La formule US Navy utilise taille + tour de taille + tour de cou.</div>`,
    onShow:()=>{},
    save:()=>{
      const today=localDateStr();
      [{id:'ob-chest',key:'poitrine'},{id:'ob-waist',key:'taille'},{id:'ob-hips',key:'hanches'},
       {id:'ob-arm',key:'bras'},{id:'ob-thigh',key:'cuisse'},{id:'ob-neck',key:'cou'}].forEach(({id,key})=>{
        const v=document.getElementById(id)?.value;
        if(v&&parseFloat(v)>0){if(!S.mesures[key])S.mesures[key]=[];
          if(!S.mesures[key].find(e=>e.date===today))S.mesures[key].push({date:today,val:v});}
      }); save();
    }
  },
  { id:'goals', icon:'🎯', title:'Vos objectifs',
    sub:"Définissez votre objectif principal",
    fields:()=>`
      <div class="onboard-field"><label class="onboard-label">🏆 Objectif principal</label>
        <div class="onboard-chips" id="ob-goal-chips">
          <div class="onboard-chip" data-val="prise_masse">💪 Prise de masse</div>
          <div class="onboard-chip" data-val="perte_poids">🔥 Perte de poids</div>
          <div class="onboard-chip" data-val="force">🏋️ Force</div>
          <div class="onboard-chip" data-val="sante">❤️ Santé</div>
          <div class="onboard-chip" data-val="recompo">⚡ Recomposition</div>
        </div>
      </div>
      <div class="onboard-row">
        <div class="onboard-field"><label class="onboard-label">⚖️ Poids cible (kg)</label>
          <input type="number" class="onboard-inp" id="ob-target-weight" placeholder="70" min="30" max="300" step="0.1"></div>
        <div class="onboard-field"><label class="onboard-label">📅 Date cible</label>
          <input type="date" class="onboard-inp" id="ob-target-date" min="${new Date().toISOString().slice(0,10)}"></div>
      </div>
      <div class="onboard-field"><label class="onboard-label">👣 Objectif pas/jour</label>
        <div class="onboard-chips" id="ob-steps-chips">
          <div class="onboard-chip" data-val="5000">5 000</div>
          <div class="onboard-chip sel" data-val="10000">10 000</div>
          <div class="onboard-chip" data-val="12000">12 000</div>
          <div class="onboard-chip" data-val="15000">15 000</div>
        </div>
      </div>
      <div class="onboard-field"><label class="onboard-label">🔥 Calories/jour</label>
        <input type="number" class="onboard-inp" id="ob-cal-goal" placeholder="2500" min="1000" max="6000" step="50">
        <div id="ob-tdee-hint" style="font-size:11px;color:var(--muted);margin-top:4px"></div>
      </div>`,
    onShow:()=>{
      document.getElementById('ob-goal-chips')?.addEventListener('click',e=>{
        const ch=e.target.closest('.onboard-chip');if(!ch)return;
        document.querySelectorAll('#ob-goal-chips .onboard-chip').forEach(x=>x.classList.remove('sel'));
        ch.classList.add('sel');
      });
      document.getElementById('ob-steps-chips')?.addEventListener('click',e=>{
        const ch=e.target.closest('.onboard-chip');if(!ch)return;
        document.querySelectorAll('#ob-steps-chips .onboard-chip').forEach(x=>x.classList.remove('sel'));
        ch.classList.add('sel');
      });
      try{const td=computeTDEE();if(td.tdee>0){
        const hint=document.getElementById('ob-tdee-hint');
        if(hint)hint.textContent='TDEE estimé: ~'+td.tdee+' kcal/j';
        const inp=document.getElementById('ob-cal-goal');
        if(inp&&!inp.value)inp.value=td.tdee;
      }}catch(e){}
    },
    save:()=>{
      const gc=document.querySelector('#ob-goal-chips .onboard-chip.sel');
      const sc=document.querySelector('#ob-steps-chips .onboard-chip.sel');
      const tw=document.getElementById('ob-target-weight')?.value;
      const td=document.getElementById('ob-target-date')?.value;
      const cg=parseInt(document.getElementById('ob-cal-goal')?.value)||0;
      if(gc){const gm={prise_masse:'Prise de masse musculaire',perte_poids:'Perte de poids',force:'Force et performance',sante:'Santé générale',recompo:'Recomposition corporelle'};
        S.objective=S.objective||{};S.objective.text=gm[gc.dataset.val]||gc.textContent.trim();
        if(tw)S.objective.targetWeight=tw;if(td)S.objective.targetDate=td;S.objective._createdAt=localDateStr();}
      if(sc)S.stepsGoal=parseInt(sc.dataset.val)||10000;
      if(cg>0)S.caloriesGoal=cg; save();
    }
  },
  { id:'training', icon:'💪', title:'Entraînement',
    sub:'Pour personnaliser votre planning',
    fields:()=>`
      <div class="onboard-field"><label class="onboard-label">📅 Date de début</label>
        <input type="date" class="onboard-inp" id="ob-start-date" value="${new Date().toISOString().slice(0,10)}"></div>
      <div class="onboard-field"><label class="onboard-label">⚡ Niveau</label>
        <div class="onboard-chips" id="ob-level-chips">
          <div class="onboard-chip" data-val="debutant">🌱 Débutant</div>
          <div class="onboard-chip sel" data-val="intermediaire">💪 Intermédiaire</div>
          <div class="onboard-chip" data-val="avance">🔥 Avancé</div>
        </div>
      </div>
      <div class="onboard-field"><label class="onboard-label">📆 Jours / semaine</label>
        <div class="onboard-chips" id="ob-days-chips">
          <div class="onboard-chip" data-val="2">2j</div><div class="onboard-chip" data-val="3">3j</div>
          <div class="onboard-chip sel" data-val="4">4j</div><div class="onboard-chip" data-val="5">5j</div>
          <div class="onboard-chip" data-val="6">6j</div>
        </div>
      </div>
      <div class="onboard-field"><label class="onboard-label">🏠 Lieu</label>
        <div class="onboard-chips" id="ob-place-chips">
          <div class="onboard-chip sel" data-val="salle">🏋️ Salle</div>
          <div class="onboard-chip" data-val="maison">🏠 Maison</div>
          <div class="onboard-chip" data-val="mixte">⚡ Mixte</div>
        </div>
      </div>
      <div class="onboard-info-box">🎉 <strong>Tout est prêt !</strong> Vous pouvez modifier ces données à tout moment dans Corps et Paramètres.</div>`,
    onShow:()=>{
      ['ob-level-chips','ob-days-chips','ob-place-chips'].forEach(cid=>{
        document.getElementById(cid)?.addEventListener('click',e=>{
          const ch=e.target.closest('.onboard-chip');if(!ch)return;
          document.querySelectorAll('#'+cid+' .onboard-chip').forEach(x=>x.classList.remove('sel'));
          ch.classList.add('sel');
        });
      });
    },
    save:()=>{
      const lc=document.querySelector('#ob-level-chips .onboard-chip.sel');
      const dc=document.querySelector('#ob-days-chips .onboard-chip.sel');
      const pc=document.querySelector('#ob-place-chips .onboard-chip.sel');
      const sd=document.getElementById('ob-start-date')?.value;
      if(lc)S._level=lc.dataset.val;
      if(dc)S._daysPerWeek=parseInt(dc.dataset.val)||4;
      if(pc)S._place=pc.dataset.val;
      if(sd)S._startDate=sd;
      save();
    }
  }
];

/* _obStep — déclaré dans constants.js */
function _obRender(){
  const step=ONBOARD_STEPS[_obStep];
  const bar=document.getElementById('onboard-steps-bar');
  if(bar){bar.innerHTML='';ONBOARD_STEPS.forEach((_,i)=>{const d=document.createElement('div');d.className='onboard-step-dot'+(i<=_obStep?' done':'');bar.appendChild(d);});}
  const body=document.getElementById('onboard-body');
  if(body){body.innerHTML=`<div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:4px">${step.icon} ${step.title}</div><div style="font-size:12px;color:var(--muted);margin-bottom:18px">${step.sub}</div>${step.fields()}`;
    setTimeout(()=>step.onShow(),50);}
  const back=document.getElementById('onboard-back');
  const next=document.getElementById('onboard-next');
  if(back)back.style.display=_obStep>0?'block':'none';
  if(next)next.textContent=_obStep===ONBOARD_STEPS.length-1?'🚀 Démarrer !':'Suivant →';
}

function _obNext(){ONBOARD_STEPS[_obStep].save();if(_obStep<ONBOARD_STEPS.length-1){_obStep++;_obRender();}else{_obFinish();}}
function _obBack(){if(_obStep>0){_obStep--;_obRender();}}
function _obFinish(){localStorage.setItem(ONBOARD_KEY,'1');const ov=document.getElementById('onboard-overlay');if(ov)ov.style.display='none';save();try{updateStats();renderDashboard();}catch(e){}showToast('✅ Configuration terminée ! Bienvenue 🏋️','ok',4000);}

function showOnboarding(){
  _obStep=0;
  const ov=document.getElementById('onboard-overlay');
  if(!ov){setTimeout(showOnboarding,200);return;}
  ov.style.display='flex';
  _obRender();
  // Re-bind toujours (iOS Safari requires fresh listeners after innerHTML changes)
  const nextBtn=document.getElementById('onboard-next');
  const backBtn=document.getElementById('onboard-back');
  const skipEl=document.getElementById('onboard-skip');
  if(nextBtn){
    nextBtn.onclick=_obNext;
    nextBtn.ontouchstart=(e)=>{e.preventDefault();_obNext();};
  }
  if(backBtn){
    backBtn.onclick=_obBack;
    backBtn.ontouchstart=(e)=>{e.preventDefault();_obBack();};
  }
  if(skipEl){
    skipEl.onclick=()=>{ONBOARD_STEPS[_obStep].save();_obFinish();};
    skipEl.ontouchstart=(e)=>{e.preventDefault();ONBOARD_STEPS[_obStep].save();_obFinish();};
  }
  _obListenersBound=true;
}

function checkOnboarding(){if(!localStorage.getItem(ONBOARD_KEY))setTimeout(showOnboarding,800);}
function resetOnboarding(){localStorage.removeItem(ONBOARD_KEY);showOnboarding();}


// ╔══════════════════════════════════════════════════════╗
// ║  MINUTEUR DE REPOS                                   ║
// ╚══════════════════════════════════════════════════════╝

const RestTimer = {
  _interval: null,
  _total: 90,
  _remaining: 90,
  _targetTime: null,      // horloge murale — survit au background iOS
  _exName: '',
  _nextSetCb: null,
  _beepCtx: null,
  _autoCloseTimer: null,

  // ── Ouvrir le timer ──
  start(durationSec, exName, onNextSet) {
    this.stop();
    this._total      = durationSec || (S._restDuration || 90);
    this._remaining  = this._total;
    this._targetTime = Date.now() + this._total * 1000;  // horloge murale
    this._exName     = exName || '';
    this._nextSetCb  = onNextSet || null;

    const overlay = document.getElementById('rest-timer-overlay');
    const card    = document.getElementById('rest-timer-card');
    const exEl    = document.getElementById('rest-timer-ex-name');
    if (!overlay) return;

    if (exEl) exEl.textContent = exName || '';
    if (card) card.classList.remove('done-pulse');
    document.getElementById('rest-ring-fill')?.classList.remove('done');

    document.querySelectorAll('.rest-timer-preset').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.sec) === this._total);
    });

    overlay.style.display = 'flex';
    this._render();
    this._bindButtons(overlay);
    this._interval = setInterval(() => this._tick(), 500); // 500ms pour plus de précision
  },

  // ── Tick — basé sur l'horloge murale (résiste au background iOS) ──
  _tick() {
    const newRemaining = Math.max(0, Math.round((this._targetTime - Date.now()) / 1000));
    if (newRemaining === this._remaining && newRemaining > 0) return; // pas de changement
    this._remaining = newRemaining;
    this._render();
    if (this._remaining <= 1 && this._remaining > 0) {
      this._beep(880, 0.15); // bip de fin imminent
    }
    if (this._remaining <= 0) {
      this._finish();
    }
  },

  // ── Resynchronisation quand l'app revient au premier plan ──
  _onVisibilityChange() {
    if (document.visibilityState === 'visible' && this._interval && this._targetTime) {
      this._remaining = Math.max(0, Math.round((this._targetTime - Date.now()) / 1000));
      this._render();
      if (this._remaining <= 0) this._finish();
    }
  },
  _bindButtons(overlay) {
    const t = this;

    function bind(el, fn) {
      if (!el) return;
      // Nettoyer les anciens handlers
      el.ontouchstart = null;
      el.onclick      = null;
      // ontouchstart : se déclenche immédiatement, sans délai iOS
      el.ontouchstart = function(e) {
        e.stopPropagation();
        e.preventDefault(); // empêche le click synthétique
        fn();
      };
      // onclick : fallback desktop uniquement
      el.onclick = function(e) { fn(); };
    }

    bind(document.getElementById('rest-timer-skip'), () => t.stop());

    bind(document.getElementById('rest-timer-next'), () => {
      const cb = t._nextSetCb;
      t.stop();
      if (cb) setTimeout(cb, 50);
    });

    bind(document.getElementById('rest-timer-add-btn'), () => {
      t.addTime(15);
    });

    document.querySelectorAll('.rest-timer-preset').forEach(btn => {
      bind(btn, () => {
        const sec = parseInt(btn.dataset.sec);
        document.querySelectorAll('.rest-timer-preset').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        t.setDuration(sec);
      });
    });

    // Tap sur le fond = fermer
    if (overlay) {
      overlay.ontouchstart = function(e) {
        if (e.target === overlay) {
          e.preventDefault();
          t.stop();
        }
      };
      overlay.onclick = function(e) {
        if (e.target === overlay) t.stop();
      };
    }
  },

  // ── Tick — délégué à _onVisibilityChange + wall clock ──
  _tick() {
    const newRemaining = Math.max(0, Math.round((this._targetTime - Date.now()) / 1000));
    if (newRemaining === this._remaining && newRemaining > 0) return;
    this._remaining = newRemaining;
    this._render();
    if (this._remaining === 3 || this._remaining === 2 || this._remaining === 1) {
      this._beep(880, 0.15);
    }
    if (this._remaining <= 0) this._finish();
  },

  // ── Affichage ──
  _render() {
    const sec  = Math.max(0, this._remaining);
    const min  = Math.floor(sec / 60);
    const s    = sec % 60;
    const disp = `${min}:${String(s).padStart(2,'0')}`;

    const timeEl = document.getElementById('rest-timer-time');
    if (timeEl) timeEl.textContent = disp;

    const circ = 2 * Math.PI * 68;
    const fill = document.getElementById('rest-ring-fill');
    if (fill) {
      const pct    = Math.max(0, this._remaining / this._total);
      fill.style.strokeDashoffset = circ * (1 - pct);
      fill.style.stroke = pct > 0.5 ? 'var(--teal)' : pct > 0.25 ? 'var(--orange)' : 'var(--red)';
    }
  },

  // ── Fin du repos ──
  _finish() {
    clearInterval(this._interval);
    this._interval = null;

    const card   = document.getElementById('rest-timer-card');
    const fill   = document.getElementById('rest-ring-fill');
    const timeEl = document.getElementById('rest-timer-time');

    if (card)   card.classList.add('done-pulse');
    if (fill)   { fill.style.stroke = 'var(--green)'; fill.classList.add('done'); }
    if (timeEl) timeEl.textContent = '0:00';

    if (S._restBeep !== false) {
      this._beep(660, 0.2);
      setTimeout(() => this._beep(880, 0.2), 200);
      setTimeout(() => this._beep(1100, 0.3), 400);
    }

    // Auto-fermeture après 8s
    this._autoCloseTimer = setTimeout(() => this.stop(), 8000);

    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        new Notification('⏱ Repos terminé !', {
          body: 'Prêt pour la prochaine série' + (this._exName ? ' de ' + this._exName : ''),
          icon: './icons/icon-192.png',
          silent: true
        });
      } catch(e) {}
    }
  },

  // ── Stopper ──
  stop() {
    clearInterval(this._interval);
    clearTimeout(this._autoCloseTimer);
    this._interval      = null;
    this._autoCloseTimer = null;
    const overlay = document.getElementById('rest-timer-overlay');
    if (overlay) overlay.style.display = 'none';
    const card = document.getElementById('rest-timer-card');
    if (card) card.classList.remove('done-pulse');
  },

  // ── +temps ──
  addTime(sec) {
    this._remaining  = Math.min(this._remaining + sec, 600);
    this._total      = Math.max(this._total, this._remaining);
    this._targetTime = Date.now() + this._remaining * 1000; // resync horloge murale
    this._render();
  },

  // ── Changer durée ──
  setDuration(sec) {
    this._total      = sec;
    this._remaining  = sec;
    this._targetTime = Date.now() + sec * 1000; // resync horloge murale
    S._restDuration  = sec;
    save();
    this._render();
    clearInterval(this._interval);
    this._interval = setInterval(() => this._tick(), 500);
  },

  // ── Son ──
  _beep(freq, dur) {
    try {
      if (!this._beepCtx) this._beepCtx = new (window.AudioContext || window.webkitAudioContext)();
      const ctx  = this._beepCtx;
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + dur);
    } catch(e) {}
  }
};

// _initRestTimerButtons : conservé pour compatibilité — bindings faits dans RestTimer.start() via _bindButtons
// no-op depuis v45 — voir RestTimer.start() → _bindButtons()
function _initRestTimerButtons() {
  // Écouter visibilitychange pour resynchroniser le timer quand l'app revient au premier plan
  document.addEventListener('visibilitychange', () => {
    RestTimer._onVisibilityChange();
  });
  // Les bindings boutons sont maintenant faits dans RestTimer.start() via ontouchstart
}


// ╔══════════════════════════════════════════════════════╗
// ║  CALCUL AUTOMATIQUE DES MACROS                       ║
// ╚══════════════════════════════════════════════════════╝

function computeMacroGoals() {
  const tdee = computeTDEE().tdee;
  const goal = S.objective?.text || '';
  let calTarget = S.caloriesGoal || tdee;
  
  // Ajuster selon l'objectif
  if(goal.includes('masse') || goal.includes('Prise'))      calTarget = Math.round(tdee * 1.10); // +10%
  else if(goal.includes('poids') || goal.includes('Perte')) calTarget = Math.round(tdee * 0.80); // -20%
  else if(goal.includes('Force') || goal.includes('force')) calTarget = Math.round(tdee * 1.05); // +5%
  else calTarget = tdee; // maintien
  
  const poids = parseFloat((S.mesures.poids||[]).slice(-1)[0]?.val) || 75;
  
  // Protéines: 2g/kg pour prise de masse, 1.8g/kg pour perte, 1.6g/kg maintien
  let protMulti = 1.8;
  if(goal.includes('masse')) protMulti = 2.2;
  else if(goal.includes('Perte') || goal.includes('poids')) protMulti = 2.0;
  
  const protG  = Math.round(poids * protMulti);          // protéines (g)
  const protCal = protG * 4;
  
  // Lipides: 25% des calories
  const fatCal = Math.round(calTarget * 0.25);
  const fatG   = Math.round(fatCal / 9);
  
  // Glucides: le reste
  const carbCal = calTarget - protCal - fatCal;
  const carbG   = Math.round(Math.max(0, carbCal) / 4);
  
  return {
    calories: calTarget,
    protein:  protG,
    carbs:    carbG,
    fat:      fatG,
    protCal, carbCal: Math.max(0, carbCal), fatCal
  };
}

function applyMacroGoals() {
  const mg = computeMacroGoals();
  S.caloriesGoal  = mg.calories;
  S.proteinGoal   = mg.protein;
  S.carbsGoal     = mg.carbs;
  S.fatGoal       = mg.fat;
  save();
  showToast(
    `🎯 Macros calculées : ${mg.calories} kcal · P ${mg.protein}g · G ${mg.carbs}g · L ${mg.fat}g`,
    'ok', 5000
  );
  renderCalTracker();
}


// ╔══════════════════════════════════════════════════════╗
// ║  NOTIFICATIONS PUSH                                  ║
// ╚══════════════════════════════════════════════════════╝



/* sendLocalNotif — défini dans utils.js */

// ── Planifier rappel d'entraînement quotidien ──
function scheduleTrainingReminder(hour, minute) {
  // Sauvegarde l'heure choisie
  S._reminderHour   = hour;
  S._reminderMinute = minute;
  save();

  // Calcule le délai jusqu'à la prochaine occurrence
  function getNextMs() {
    const now  = new Date();
    const next = new Date();
    next.setHours(hour, minute, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1); // demain si déjà passé
    return next - now;
  }

  // Annuler le timer précédent
  if (window._reminderTimeout) clearTimeout(window._reminderTimeout);

  function fire() {
    const today = new Date();
    // Vérifier si une séance est prévue aujourd'hui
    const dayIdx = (today.getDay() + 6) % 7; // lundi=0
    const todayDay = S.days[dayIdx];
    const hasSession = todayDay?.exercises?.some(e => e.name?.trim() && !e.isWarmup);
    
    if (hasSession) {
      const exs = todayDay.exercises.filter(e => e.name?.trim() && !e.isWarmup);
      sendLocalNotif(
        "💪 C'est l'heure de t'entraîner !",
        `${exs.length} exercice${exs.length>1?'s':''} au programme — ${exs.slice(0,2).map(e=>e.name).join(', ')}${exs.length>2?' +'+( exs.length-2):''}`,
        './icons/icon-192.png'
      );
    } else {
      sendLocalNotif("😴 Journée de repos", "Récupération active recommandée.", './icons/icon-192.png');
    }
    // Replanifier pour demain
    window._reminderTimeout = setTimeout(fire, getNextMs());
  }

  window._reminderTimeout = setTimeout(fire, getNextMs());
  showToast(`🔔 Rappel planifié à ${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`, 'ok', 3000);
}

function cancelTrainingReminder() {
  if (window._reminderTimeout) clearTimeout(window._reminderTimeout);
  S._reminderHour = null; S._reminderMinute = null;
  save();
  showToast('🔕 Rappel annulé', 'warn', 2000);
}

// ── Relancer le rappel au démarrage si configuré ──
function restoreReminder() {
  if (S._reminderHour != null && S._reminderMinute != null) {
    scheduleTrainingReminder(S._reminderHour, S._reminderMinute);
  }
}


// ╔══════════════════════════════════════════════════════╗
// ║  SCAN CODE-BARRES — Open Food Facts                  ║
// ╚══════════════════════════════════════════════════════╝

/* _barcodeStream — déclaré dans constants.js */
async function openBarcodeScanner(onResult) {
  // Demander accès caméra
  if (!navigator.mediaDevices?.getUserMedia) {
    showToast('Caméra non disponible', 'warn'); return;
  }

  const overlay = document.getElementById('barcode-overlay');
  const video   = document.getElementById('barcode-video');
  const status  = document.getElementById('barcode-status');
  if (!overlay || !video) return;

  overlay.style.display = 'flex';
  status.textContent = '📷 Ouverture de la caméra...';

  try {
    _barcodeStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
    });
    video.srcObject = _barcodeStream;
    await video.play();
    status.textContent = '📷 Pointez le code-barres';

    // Utiliser BarcodeDetector si disponible (Chrome/Safari récent)
    if ('BarcodeDetector' in window) {
      const detector = new BarcodeDetector({ formats: ['ean_13','ean_8','upc_a','upc_e','code_128','code_39'] });
      let scanning = true;
      
      const scan = async () => {
        if (!scanning) return;
        try {
          const codes = await detector.detect(video);
          if (codes.length > 0) {
            scanning = false;
            const barcode = codes[0].rawValue;
            status.textContent = `✅ Code détecté: ${barcode} — Recherche...`;
            await lookupBarcode(barcode, onResult);
            closeBarcodeScanner();
          }
        } catch(e) {}
        if (scanning) requestAnimationFrame(scan);
      };
      requestAnimationFrame(scan);

    } else {
      // Fallback: saisie manuelle
      status.textContent = '⚠️ Scanner non supporté — saisissez le code manuellement';
      const manualWrap = document.getElementById('barcode-manual');
      if (manualWrap) manualWrap.style.display = 'flex';
    }

  } catch(err) {
    status.textContent = '❌ Accès caméra refusé — saisissez le code manuellement';
    const manualWrap = document.getElementById('barcode-manual');
    if (manualWrap) manualWrap.style.display = 'flex';
  }
}

async function lookupBarcode(code, onResult) {
  try {
    const url = `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,nutriments,serving_size,brands`;
    const resp = await fetch(url);
    const data = await resp.json();
    
    if (data.status === 1 && data.product) {
      const p = data.product;
      const n = p.nutriments || {};
      const per100 = (key) => Math.round((n[key + '_100g'] || 0) * 10) / 10;
      
      const result = {
        name:    (p.brands ? p.brands.split(',')[0] + ' — ' : '') + (p.product_name || 'Inconnu'),
        cal:     per100('energy-kcal'),
        protein: per100('proteins'),
        carbs:   per100('carbohydrates'),
        fat:     per100('fat'),
        per:     '100g',
      };
      
      if (onResult) onResult(result);
      showToast('✅ Produit trouvé: ' + result.name.slice(0,30), 'ok', 3000);
    } else {
      showToast('❌ Produit introuvable (code: ' + code + ')', 'warn', 3000);
    }
  } catch(e) {
    showToast('❌ Erreur réseau — vérifiez votre connexion', 'warn', 3000);
  }
}

function closeBarcodeScanner() {
  if (_barcodeStream) {
    _barcodeStream.getTracks().forEach(t => t.stop());
    _barcodeStream = null;
  }
  const overlay = document.getElementById('barcode-overlay');
  if (overlay) overlay.style.display = 'none';
  const video = document.getElementById('barcode-video');
  if (video) { video.srcObject = null; }
  const manualWrap = document.getElementById('barcode-manual');
  if (manualWrap) manualWrap.style.display = 'none';
}

async function manualBarcodeSearch() {
  const inp = document.getElementById('barcode-manual-inp');
  if (!inp || !inp.value.trim()) return;
  const code = inp.value.trim();
  document.getElementById('barcode-status').textContent = `🔍 Recherche de ${code}...`;
  await lookupBarcode(code, window._barcodeCb);
  closeBarcodeScanner();
}


// ╔══════════════════════════════════════════════════════╗
// ║  EXPORT PDF BILAN                                    ║
// ╚══════════════════════════════════════════════════════╝

function exportBilanPDF() {
  // Générer une page HTML dédiée au bilan, puis window.print()
  const fs = computeFitnessScore();
  const td = computeTDEE();
  const st = computeStreak();
  const bc = computeBodyComp();
  const today = new Date().toLocaleDateString('fr-FR', {day:'numeric',month:'long',year:'numeric'});
  
  // Calculs semaine
  const days7 = lastNDays(7);
  const weekSteps  = days7.reduce((a,d)=>a+(parseInt(S.steps&&S.steps[d]||0)||0),0);
  const weekCals   = computeDailyCalories(7).reduce((a,p)=>a+p.y,0);
  const weekSleep  = computeDailySleep(7).filter(p=>p.y>0);
  const avgSleep   = weekSleep.length ? weekSleep.reduce((a,p)=>a+p.y,0)/weekSleep.length : 0;
  const trained    = days7.filter(d=>S.history&&S.history[d]&&(S.history[d].length||Object.keys(S.history[d]).length)>0).length;
  const volSem     = computeWeeklyVolume(1)[0]?.value || 0;
  
  const poids      = parseFloat((S.mesures?.poids||[]).slice(-1)[0]?.val)||0;
  const objective  = S.objective?.text || 'Non défini';

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Bilan Coach Tracker Pro — ${today}</title>

</head>
<body>

<div class="header">
  <div>
    <h1>🏋️ Coach Tracker Pro</h1>
    <div class="date">Bilan hebdomadaire — ${today}</div>
    <div style="margin-top:8px;font-size:11px;opacity:.85">
      Objectif : <strong>${escHtml(objective)}</strong>${poids>0?' · Poids actuel : '+poids+' kg':''}
    </div>
  </div>
  <div class="score-badge">
    <div class="num">${fs.score}</div>
    <div class="lbl">Score</div>
  </div>
</div>

<div class="section-title">📊 Score de forme global</div>
<div class="score-row">
  ${fs.breakdown.map(b=>`<div class="score-chip">${b.icon} ${b.label} <span class="pts">${b.pts}/100</span></div>`).join('')}
</div>

<div class="section-title">💪 Activité cette semaine</div>
<div class="grid">
  <div class="card">
    <div class="card-title">Entraînement</div>
    <div class="stat"><span class="stat-lbl">Séances réalisées</span><span class="stat-val">${trained}/7 jours</span></div>
    <div class="stat"><span class="stat-lbl">Volume total</span><span class="stat-val">${volSem>=1000?(volSem/1000).toFixed(1)+'t':Math.round(volSem)+'kg'}</span></div>
    <div class="stat"><span class="stat-lbl">Série actuelle</span><span class="stat-val">${st.current} jours</span></div>
    <div class="stat"><span class="stat-lbl">Record</span><span class="stat-val">${st.record} jours</span></div>
  </div>
  <div class="card">
    <div class="card-title">Activité & Récupération</div>
    <div class="stat"><span class="stat-lbl">Pas totaux (7j)</span><span class="stat-val">${weekSteps.toLocaleString('fr')}</span></div>
    <div class="stat"><span class="stat-lbl">Moy. pas/jour</span><span class="stat-val">${Math.round(weekSteps/7).toLocaleString('fr')}</span></div>
    <div class="stat"><span class="stat-lbl">Sommeil moyen</span><span class="stat-val">${avgSleep>0?avgSleep.toFixed(1)+'h':'—'}</span></div>
    <div class="stat"><span class="stat-lbl">Nuits ≥7h</span><span class="stat-val">${weekSleep.filter(p=>p.y>=7).length}/7</span></div>
  </div>
</div>

<div class="section-title">🍽️ Nutrition cette semaine</div>
<div class="grid">
  <div class="card">
    <div class="card-title">Calories</div>
    <div class="stat"><span class="stat-lbl">Total 7j</span><span class="stat-val">${Math.round(weekCals).toLocaleString('fr')} kcal</span></div>
    <div class="stat"><span class="stat-lbl">Moyenne/jour</span><span class="stat-val">${Math.round(weekCals/7).toLocaleString('fr')} kcal</span></div>
    <div class="stat"><span class="stat-lbl">Objectif</span><span class="stat-val">${(S.caloriesGoal||2500).toLocaleString('fr')} kcal</span></div>
    <div class="stat"><span class="stat-lbl">TDEE estimé</span><span class="stat-val">${td.tdee} kcal</span></div>
  </div>
  <div class="card">
    <div class="card-title">Objectifs Macros</div>
    ${S.proteinGoal>0 ? `
    <div class="stat"><span class="stat-lbl">Protéines objectif</span><span class="stat-val">${S.proteinGoal}g/j</span></div>
    <div class="stat"><span class="stat-lbl">Glucides objectif</span><span class="stat-val">${S.carbsGoal}g/j</span></div>
    <div class="stat"><span class="stat-lbl">Lipides objectif</span><span class="stat-val">${S.fatGoal}g/j</span></div>
    ` : '<div style="color:#999;font-size:11px;padding:8px 0">Calcule tes macros dans Corps → Calories</div>'}
  </div>
</div>

${bc ? `
<div class="section-title">⚖️ Composition corporelle</div>
<div class="grid3">
  <div class="card" style="text-align:center">
    <div class="card-title">Poids</div>
    <div style="font-size:24px;font-weight:800;color:#5BA8A0">${bc.poids}<span style="font-size:14px">kg</span></div>
  </div>
  <div class="card" style="text-align:center">
    <div class="card-title">IMC</div>
    <div style="font-size:24px;font-weight:800;color:#5BA8A0">${bc.imc}</div>
    <div style="font-size:10px;color:#666">${bc.imc<18.5?'Insuffisant':bc.imc<25?'Normal ✅':bc.imc<30?'Surpoids':'Obésité'}</div>
  </div>
  ${bc.bf ? `<div class="card" style="text-align:center">
    <div class="card-title">% Masse grasse</div>
    <div style="font-size:24px;font-weight:800;color:#5BA8A0">${bc.bf}<span style="font-size:14px">%</span></div>
    ${bc.leanMass ? `<div style="font-size:10px;color:#666">Masse maigre: ${bc.leanMass}kg</div>` : ''}
  </div>` : '<div class="card"><div class="card-title">% Masse grasse</div><div style="color:#999;font-size:11px">Renseigner le tour de cou pour calculer</div></div>'}
</div>` : ''}

<div style="text-align:center;margin-top:20px">
  <button onclick="window.print()" style="padding:10px 24px;background:#5BA8A0;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer">🖨️ Imprimer / Enregistrer en PDF</button>
</div>

<div class="footer">
  Généré par Coach Tracker Pro · ${today} · doncivo.github.io/coach-tracker-pro
</div>


<!-- ══ SCANNER CODE-BARRES ══ -->
<div id="barcode-overlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:6000;flex-direction:column;align-items:center;justify-content:center;gap:16px">
  <div style="position:relative;width:min(340px,90vw);border-radius:16px;overflow:hidden;background:#000">
    <video id="barcode-video" autoplay playsinline muted style="width:100%;display:block;aspect-ratio:4/3;object-fit:cover"></video>
    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none">
      <div style="width:220px;height:120px;border:3px solid #5BA8A0;border-radius:8px;position:relative">
        <div style="position:absolute;left:0;right:0;top:50%;height:2px;background:linear-gradient(90deg,transparent,#5BA8A0,transparent);animation:scan-anim 1.5s ease-in-out infinite"></div>
      </div>
    </div>
  </div>
  <div id="barcode-status" style="color:#fff;font-size:13px;text-align:center;padding:0 20px;font-weight:600">📷 Initialisation...</div>
  <div id="barcode-manual" style="display:none;gap:8px;align-items:center;flex-wrap:wrap;justify-content:center;padding:0 16px">
    <input id="barcode-manual-inp" type="text" inputmode="numeric" placeholder="Code-barres (ex: 3017620422003)"
      style="padding:10px 14px;border-radius:10px;border:1.5px solid rgba(255,255,255,.3);background:rgba(255,255,255,.1);color:#fff;font-size:16px;width:min(260px,80vw)"
      onkeydown="if(event.key==='Enter')manualBarcodeSearch()">
    <button onclick="manualBarcodeSearch()" style="padding:10px 20px;border-radius:10px;border:none;background:#5BA8A0;color:#fff;font-weight:700;font-size:14px;cursor:pointer">Rechercher</button>
  </div>
  <button onclick="closeBarcodeScanner()" style="padding:10px 28px;border-radius:12px;border:1.5px solid rgba(255,255,255,.3);background:transparent;color:#fff;font-size:14px;font-weight:600;cursor:pointer;margin-top:4px">✕ Fermer</button>
</div>


</body>
</html>`;

  // ── Partage iOS natif ou fallback ──
  // Générer le texte de partage (court, lisible)
  const shareText = [
    `🏋️ Bilan Coach Tracker Pro — ${today}`,
    `Score de forme : ${fs.score}/100 (${grade})`,
    ``,
    `💪 Cette semaine :`,
    `  · Séances : ${trained}/7`,
    `  · Volume  : ${volSem >= 1000 ? (volSem/1000).toFixed(1)+'t' : Math.round(volSem)+'kg'}`,
    `  · Pas     : ${weekSteps.toLocaleString('fr')}`,
    `  · Sommeil : ${avgSleep > 0 ? avgSleep.toFixed(1)+'h' : '—'}`,
    ``,
    fs.breakdown.map(b => `${b.icon} ${b.label} : ${b.pts}/100`).join('\n'),
    ``,
    `Objectif : ${objective}`,
    poids > 0 ? `Poids actuel : ${poids}kg` : '',
  ].filter(l => l !== undefined && l !== null).join('\n');

  // Essayer la Share API iOS (feuille de partage native)
  if (navigator.share) {
    navigator.share({
      title: 'Bilan Coach Tracker Pro',
      text:  shareText,
    }).then(() => {
      showToast('Bilan partagé ✓', 'save', 2000);
    }).catch(err => {
      // Annulé ou erreur → copier dans le presse-papiers
      if (err.name !== 'AbortError') _fallbackExport(shareText, html);
    });
  } else {
    _fallbackExport(shareText, html);
  }

  function _fallbackExport(text, htmlContent) {
    // 1. Copier le texte dans le presse-papiers
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        showToast('📋 Bilan copié dans le presse-papiers', 'save', 3000);
      }).catch(() => _htmlFallback(htmlContent));
    } else {
      _htmlFallback(htmlContent);
    }
  }

  function _htmlFallback(htmlContent) {
    // Dernier recours : ouvrir dans un onglet avec impression
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(htmlContent);
      win.document.close();
      setTimeout(() => win.print(), 800);
    } else {
      const blob = new Blob([htmlContent], {type:'text/html;charset=utf-8'});
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = 'bilan-coach-tracker-'+localDateStr()+'.html';
      a.click(); URL.revokeObjectURL(url);
      showToast('📄 Bilan téléchargé', 'ok', 3000);
    }
  }
}


// ── Corps sub-navigation ──
function initCorpsSubNav() {
  document.querySelectorAll('.corps-subbtn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.corps-subbtn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.corps-section').forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
      const sect = document.getElementById('corps-sect-' + btn.dataset.corps);
      if (sect) sect.classList.add('active');
      if (btn.dataset.corps === 'nutrition') renderCalTracker();
      if (btn.dataset.corps === 'mesures')   renderCorps();
      if (btn.dataset.corps === 'activite')  { renderStepsGrid(); renderSleepGrid(); renderStreakHeatmap(); }
      if (btn.dataset.corps === 'journal')   { renderNutriGrid(); renderPainList(); }
    });
  });
}
