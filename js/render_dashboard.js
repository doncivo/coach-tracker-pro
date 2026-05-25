/* ═══════════════════════════════════════
   render_dashboard.js — Page Accueil
   Dépend de: compute.js, charts.js, utils.js
═══════════════════════════════════════ */

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

  // ── STATS RAPIDES ──
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

  // ── SÉANCE DU JOUR ──
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

  // ── VOLUME HEBDO + BREAKDOWN PPL ──
  setTimeout(()=>{
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

