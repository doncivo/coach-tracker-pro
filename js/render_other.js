/* ============================================================
   render_other.js — Achievements + Library + Calendar
============================================================ */

/* ══ ACHIEVEMENTS ══ */
const ACHIEVEMENTS_DEF=[
  {id:'first_session',icon:'🎯',name:'Première séance',desc:'Terminer sa première séance'},
  {id:'week_streak_3',icon:'🔥',name:'3 jours d\'affilée',desc:'3 séances consécutives'},
  {id:'week_streak_7',icon:'⚡',name:'Semaine parfaite',desc:'7 jours consécutifs'},
  {id:'first_pr',icon:'🏆',name:'Premier PR',desc:'Battre son record personnel'},
  {id:'pr_5',icon:'👑',name:'5 PR',desc:'Battre 5 records personnels'},
  {id:'vol_50t',icon:'💪',name:'50 tonnes',desc:'50t de volume cumulé'},
  {id:'vol_100t',icon:'🦁',name:'100 tonnes',desc:'100t de volume cumulé'},
  {id:'sessions_10',icon:'📈',name:'10 séances',desc:'Compléter 10 séances'},
  {id:'sessions_50',icon:'🚀',name:'50 séances',desc:'Compléter 50 séances'},
  {id:'perfect_week',icon:'⭐',name:'Semaine parfaite',desc:'Tous les exercices faits sur une semaine'},
  {id:'consistency_4',icon:'🗓️',name:'4 semaines',desc:'Adhérence >80% sur 4 semaines'},
  {id:'first_deload',icon:'🔄',name:'Premier deload',desc:'Compléter un bloc de 4 semaines'},
  {id:'sleep_7',icon:'😴',name:'Sommeil optimal',desc:'7j de sommeil ≥7h'},
  {id:'no_pain',icon:'🩺',name:'Sans douleur',desc:'Aucune douleur signalée depuis 4 semaines'

},
];
function checkAndAwardAchievements(){
  const streak=computeStreak();const adh=computeAdherence();
  const totalDone=Object.values(S.history).flatMap(wk=>(wk.days||[])).flatMap(d=>(d.exercises||[])).filter(e=>e.done&&!e.isWarmup).length+S.days.flatMap(d=>d.exercises).filter(e=>e.done&&!e.isWarmup).length;
  const totalVol=Object.values(S.history).flatMap(wk=>(wk.days||[])).flatMap(d=>(d.exercises||[]).filter(e=>!e.isWarmup).map(calcVol)).reduce((a,b)=>a+b,0)/1000;
  const prCount=S.days.flatMap(d=>d.exercises).filter(checkPR).length;
  const hasPainRecent=S.painLog.some(p=>{const d=new Date(p.date+'T00:00');return(Date.now()-d.getTime())<28*86400000;});
  const avgSleep=Object.values(S.sleep||{}).slice(-7).filter(s=>parseFloat(s.hours)>=7).length;
  const checks={first_session:totalDone>=1,week_streak_3:streak.current>=3,week_streak_7:streak.current>=7,first_pr:prCount>=1,pr_5:prCount>=5,vol_50t:totalVol>=50,vol_100t:totalVol>=100,sessions_10:totalDone>=10,sessions_50:totalDone>=50,perfect_week:S.weekCount>=1&&S.days.filter(d=>getDMS(d).some(k=>k&&k!=='rep')).every(d=>d.exercises.filter(e=>e.name.trim()&&!e.isWarmup).every(e=>e.done)),consistency_4:adh.prog4>0&&Math.round(adh.comp4/adh.prog4*100)>=80,first_deload:S.weekCount>=5,sleep_7:avgSleep>=7,no_pain:!hasPainRecent,
    steps_goal_3:lastNDays(7).filter(d=>parseInt(S.steps&&S.steps[d]||0)>=(S.stepsGoal||10000)).length>=3,
    steps_goal_7:lastNDays(7).filter(d=>parseInt(S.steps&&S.steps[d]||0)>=(S.stepsGoal||10000)).length>=7,
    cal_tracked_7:lastNDays(7).filter(d=>{const cl=S.calories&&S.calories[d];let t=0;if(cl&&cl.meals)cl.meals.forEach(m=>(m.items||[]).forEach(it=>t+=parseFloat(it.kcal)||0));return t>0;}).length>=7};
  Object.entries(checks).forEach(([id,unlocked])=>{if(unlocked&&!S.achievements[id]){S.achievements[id]={unlockedAt:todayStr()};showToast('🏆 Badge débloqué: '+ACHIEVEMENTS_DEF.find(a=>a.id===id)?.name,'pr',4000);save();}});
}
/* ── Objectives inline state ── */
/* _objEditing — déclaré dans constants.js */
function renderAchievements() {
  _renderObjectiveView();
  _bindObjectiveButtons();
  _renderBadges();
  _renderObjectiveProgress();
  checkAndAwardAchievements();
}

function _renderObjectiveView() {
  const hasObj = S.objective && S.objective.text;
  const viewEmpty   = document.getElementById('obj-view-empty');
  const viewContent = document.getElementById('obj-view-content');
  if (!viewEmpty || !viewContent) return;

  if (hasObj) {
    viewEmpty.style.display   = 'none';
    viewContent.style.display = 'block';

    // Title
    const titleEl = document.getElementById('obj-view-title');
    if (titleEl) titleEl.textContent = S.objective.text;

    // Countdown
    const countdown = document.getElementById('obj-view-countdown');
    if (countdown && S.objective.targetDate) {
      const daysLeft = Math.ceil((new Date(S.objective.targetDate) - Date.now()) / 86400000);
      countdown.style.display = 'inline-flex';
      countdown.textContent   = daysLeft >= 0 ? '⏳ ' + daysLeft + ' jours restants' : '⚠️ Échéance dépassée';
      countdown.style.cssText += ';background:' + (daysLeft < 30 ? 'rgba(229,62,62,.1)' : 'rgba(91,168,160,.1)') +
        ';border:1px solid ' + (daysLeft < 30 ? 'var(--red)' : 'var(--teal)') +
        ';color:' + (daysLeft < 30 ? 'var(--red)' : 'var(--teal-d)');
    } else if (countdown) countdown.style.display = 'none';

    // Weight
    const weightEl = document.getElementById('obj-view-weight');
    if (weightEl) {
      if (S.objective.targetWeight) {
        weightEl.style.display = 'block';
        weightEl.textContent   = '⚖️ Poids cible : ' + S.objective.targetWeight + ' kg';
        // Compare with latest weight
        const latest = (S.mesures.poids || []).slice(-1)[0];
        if (latest) {
          const diff = Math.round((parseFloat(S.objective.targetWeight) - parseFloat(latest.val)) * 10) / 10;
          weightEl.textContent += '  (actuel : ' + latest.val + ' kg, écart : ' + (diff > 0 ? '+' : '') + diff + ' kg)';
        }
      } else weightEl.style.display = 'none';
    }

    // Exercise
    const exEl = document.getElementById('obj-view-exercise');
    if (exEl) {
      if (S.objective.targetExercise && S.objective.targetLoad) {
        exEl.style.display = 'block';
        exEl.textContent   = '🏋️ ' + S.objective.targetExercise + ' → ' + S.objective.targetLoad + ' kg';
        // Compare with current weight for this exercise
        const exH = S.days.flatMap(d => d.exercises).find(e => e.name === S.objective.targetExercise);
        if (exH && exH.weight) {
          const diff = Math.round((parseFloat(S.objective.targetLoad) - parseFloat(exH.weight)) * 10) / 10;
          exEl.textContent += '  (actuel : ' + exH.weight + ' kg, manque : ' + diff + ' kg)';
        }
      } else exEl.style.display = 'none';
    }

    // ── Milestones ──
    const milestonesEl = document.getElementById('obj-milestones');
    if(milestonesEl && S.objective){
      milestonesEl.innerHTML = '';
      const milestones = [];
      
      // Weight milestones
      if(S.objective.targetWeight){
        const targetW = parseFloat(S.objective.targetWeight);
        const latestW = parseFloat((S.mesures.poids||[]).slice(-1)[0]?.val)||0;
        const startW = parseFloat((S.mesures.poids||[])[0]?.val)||latestW;
        if(latestW>0 && startW!==targetW){
          const totalChange = targetW-startW;
          const currentChange = latestW-startW;
          const pct = Math.min(100,Math.max(0,Math.round(Math.abs(currentChange)/Math.abs(totalChange)*100)));
          // Milestones at 25%, 50%, 75%, 100%
          [25,50,75,100].forEach(milestone=>{
            const achieved = pct>=milestone;
            const milestoneW = startW + (totalChange*milestone/100);
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:12px';
            row.innerHTML = `<span style="font-size:16px">${achieved?'✅':'⭕'}</span>
              <div style="flex:1">
                <div style="font-weight:600;color:var(--text)">${milestone}% — ${milestoneW.toFixed(1)} kg</div>
                <div style="background:var(--border);border-radius:4px;height:4px;margin-top:3px;overflow:hidden">
                  <div style="width:${achieved?100:0}%;height:100%;background:${achieved?'var(--green)':'var(--border)'};border-radius:4px"></div>
                </div>
              </div>
              <span style="color:${achieved?'var(--green)':'var(--muted)'};font-size:11px;font-weight:600">${achieved?'Atteint':'En cours'}</span>`;
            milestones.push(row);
          });
        }
      }
      
      // Sessions milestone
      const totalSessions = Object.values(S.history||{}).reduce((a,day)=>{
        if(Array.isArray(day)) return a+day.filter(e=>e.volume>0).length;
        return a+(day&&day.days?1:0);
      },0);
      const sessGoals = [10,25,50,100,200];
      const nextSessGoal = sessGoals.find(g=>g>totalSessions)||sessGoals[sessGoals.length-1];
      const sessMilestone = document.createElement('div');
      sessMilestone.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:12px';
      sessMilestone.innerHTML = `<span style="font-size:16px">💪</span>
        <div style="flex:1">
          <div style="font-weight:600;color:var(--text)">${totalSessions} séances — prochain objectif: ${nextSessGoal}</div>
          <div style="background:var(--border);border-radius:4px;height:4px;margin-top:3px;overflow:hidden">
            <div style="width:${Math.round(totalSessions/nextSessGoal*100)}%;height:100%;background:var(--teal);border-radius:4px;transition:width .6s"></div>
          </div>
        </div>
        <span style="color:var(--muted);font-size:11px">${Math.round(totalSessions/nextSessGoal*100)}%</span>`;
      milestones.push(sessMilestone);
      
      if(milestones.length){
        const title = document.createElement('div');
        title.style.cssText = 'font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--teal-d);margin-bottom:8px';
        title.textContent = '🎯 Jalons de progression';
        milestonesEl.appendChild(title);
        milestones.forEach(m=>milestonesEl.appendChild(m));
      }
    }
  } else {
    viewEmpty.style.display   = 'block';
    viewContent.style.display = 'none';
  }
}

function _bindObjectiveButtons() {
  const editBtn   = document.getElementById('obj-edit-btn');
  const saveBtn   = document.getElementById('obj-save-btn');
  const cancelBtn = document.getElementById('obj-cancel-btn');
  const editPane  = document.getElementById('obj-edit');
  const viewPane  = document.getElementById('obj-view');
  if (!editBtn || !saveBtn || !cancelBtn || !editPane || !viewPane) return;

  function openEdit() {
    _objEditing = true;
    // Pre-fill inputs with current values
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
    set('obj-inp-text',     S.objective.text        || '');
    set('obj-inp-date',     S.objective.targetDate  || '');
    set('obj-inp-weight',   S.objective.targetWeight|| '');
    set('obj-inp-exercise', S.objective.targetExercise || '');
    set('obj-inp-load',     S.objective.targetLoad  || '');
    editPane.style.display = 'block';
    editBtn.style.display  = 'none';
    saveBtn.style.display  = 'inline-flex';
    cancelBtn.style.display = 'inline-flex';
    // Focus first input
    const first = document.getElementById('obj-inp-text');
    if (first) setTimeout(() => first.focus(), 50);
  }

  function closeEdit() {
    _objEditing = false;
    editPane.style.display  = 'none';
    editBtn.style.display   = 'inline-flex';
    saveBtn.style.display   = 'none';
    cancelBtn.style.display = 'none';
  }

  function saveObj() {
    const get = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
    const text = get('obj-inp-text');
    if (!text) { showToast('Renseignez au minimum votre objectif principal.', 'warn'); return; }
    S.objective = {
      text,
      targetDate:     get('obj-inp-date'),
      targetWeight:   get('obj-inp-weight'),
      targetExercise: get('obj-inp-exercise'),
      targetLoad:     get('obj-inp-load'),
    };
    save();
    showToast('Objectif enregistré ✓', 'save');
    closeEdit();
    _renderObjectiveView();
    _renderObjectiveProgress();
  }

  // Rebind each time (onclick avoids duplicate listeners)
  editBtn.onclick   = openEdit;
  cancelBtn.onclick = closeEdit;
  saveBtn.onclick   = saveObj;

  // Enter key on inputs
  ['obj-inp-text','obj-inp-date','obj-inp-weight','obj-inp-exercise','obj-inp-load'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); saveObj(); } };
  });

  // If no objective yet, auto-open edit mode on first visit
  if (!_objEditing && !S.objective.text) {
    // Don't auto-open, just highlight the button
    editBtn.style.animation = 'pulse-btn 1.5s ease 2';
  }
}

function _renderObjectiveProgress() {
  const card = document.getElementById('obj-progress-card');
  const body = document.getElementById('obj-progress-body');
  if (!card || !body) return;

  if (!S.objective || !S.objective.text) {
    card.style.display = 'none';
    return;
  }
  card.style.display = 'block';
  body.innerHTML = '';

  // Weight progress
  if (S.objective.targetWeight) {
    const target = parseFloat(S.objective.targetWeight) || 0;
    const entries = (S.mesures.poids || []).slice().sort((a, b) => a.date.localeCompare(b.date));
    if (entries.length >= 1) {
      const current = parseFloat(entries[entries.length - 1].val) || 0;
      const start   = parseFloat(entries[0].val) || current;
      const totalToLose = start - target; // positive if losing weight
      const done    = totalToLose > 0 ? Math.max(0, start - current) : Math.max(0, current - start);
      const pct     = totalToLose !== 0 ? Math.min(100, Math.round(done / Math.abs(totalToLose) * 100)) : 0;
      const row     = mkObjStatRow('⚖️ Poids', current + ' kg → ' + target + ' kg (' + pct + '%)');
      const barWrap = document.createElement('div');
      barWrap.className = 'obj-progress-bar-wrap';
      const bar = document.createElement('div');
      bar.className = 'obj-progress-bar';
      bar.style.width = pct + '%';
      barWrap.appendChild(bar);
      body.appendChild(row);
      body.appendChild(barWrap);
    }
  }

  // Exercise progress
  if (S.objective.targetExercise && S.objective.targetLoad) {
    const target = parseFloat(S.objective.targetLoad) || 0;
    const exH    = exHist(S.objective.targetExercise);
    const current = exH.length ? parseFloat(exH[exH.length - 1].weight) || 0 : 0;
    const start   = exH.length > 1 ? parseFloat(exH[0].weight) || 0 : current * 0.7;
    const totalGain = target - start;
    const done    = totalGain > 0 ? Math.max(0, current - start) : 0;
    const pct     = totalGain > 0 ? Math.min(100, Math.round(done / totalGain * 100)) : (current >= target ? 100 : 0);
    const row     = mkObjStatRow('🏋️ ' + S.objective.targetExercise, (current || '?') + ' kg → ' + target + ' kg (' + pct + '%)');
    const barWrap = document.createElement('div');
    barWrap.className = 'obj-progress-bar-wrap';
    const bar = document.createElement('div');
    bar.className = 'obj-progress-bar';
    bar.style.width = pct + '%';
    barWrap.appendChild(bar);
    body.appendChild(row);
    body.appendChild(barWrap);
  }

  // Days elapsed / remaining
  if (S.objective.targetDate) {
    const target   = new Date(S.objective.targetDate);
    const today    = new Date();
    const total    = Math.ceil((target - new Date(S.objective._createdAt || localDateStr())) / 86400000);
    const elapsed  = Math.ceil((today - new Date(S.objective._createdAt || localDateStr())) / 86400000);
    const daysLeft = Math.ceil((target - today) / 86400000);
    const pct      = total > 0 ? Math.min(100, Math.round(elapsed / total * 100)) : 100;
    body.appendChild(mkObjStatRow('📅 Temps écoulé', (daysLeft >= 0 ? daysLeft + ' jours restants' : 'Échéance dépassée')));
    const bw = document.createElement('div');bw.className='obj-progress-bar-wrap';
    const b  = document.createElement('div');b.className='obj-progress-bar';b.style.cssText='width:'+pct+'%;background:linear-gradient(90deg,var(--orange),var(--red))';
    bw.appendChild(b);body.appendChild(bw);
  }

  if (!body.children.length) {
    const nd = document.createElement('div');nd.style.cssText='color:var(--muted);font-size:11px';nd.textContent='Renseignez des mesures et des données pour voir votre progression.';body.appendChild(nd);
  }
}

function mkObjStatRow(lbl, val) {
  const row = document.createElement('div');row.className = 'obj-stat-row';
  const l   = document.createElement('span');l.className = 'obj-stat-lbl';l.textContent = lbl;
  const v   = document.createElement('span');v.className = 'obj-stat-val';v.textContent = val;
  row.appendChild(l);row.appendChild(v);return row;
}

function _renderBadges() {
  const grid = document.getElementById('ach-grid');
  if (!grid) return;
  grid.innerHTML = '';
  let unlockedCount = 0;

  // Calculer la progression vers chaque badge
  function getProgress(ach) {
    try {
      const streak    = computeStreak();
      const totalDone = Object.values(S.history||{}).flatMap(wk=>(wk.days||[])).flatMap(d=>(d.exercises||[])).filter(e=>e.done&&!e.isWarmup).length
                      + (S.days||[]).flatMap(d=>d.exercises||[]).filter(e=>e.done&&!e.isWarmup).length;
      const totalVol  = Object.values(S.history||{}).flatMap(wk=>(wk.days||[])).flatMap(d=>(d.exercises||[]).filter(e=>!e.isWarmup).map(calcVol)).reduce((a,b)=>a+b,0)/1000;
      const prCount   = (S.days||[]).flatMap(d=>d.exercises||[]).filter(checkPR).length;
      const avgSleep7 = Object.values(S.sleep||{}).slice(-7).filter(s=>parseFloat(s?.hours)>=7).length;

      const map = {
        first_session:  { curr: Math.min(1, totalDone), max: 1 },
        week_streak_3:  { curr: Math.min(3, streak.current), max: 3 },
        week_streak_7:  { curr: Math.min(7, streak.current), max: 7 },
        first_pr:       { curr: Math.min(1, prCount), max: 1 },
        pr_5:           { curr: Math.min(5, prCount), max: 5 },
        vol_50t:        { curr: Math.min(50, Math.round(totalVol)), max: 50 },
        vol_100t:       { curr: Math.min(100, Math.round(totalVol)), max: 100 },
        sessions_10:    { curr: Math.min(10, totalDone), max: 10 },
        sessions_50:    { curr: Math.min(50, totalDone), max: 50 },
        sleep_7:        { curr: Math.min(7, avgSleep7), max: 7 },
        steps_goal_3:   { curr: Math.min(3, lastNDays(7).filter(d=>parseInt(S.steps?.[d]||0)>=(S.stepsGoal||10000)).length), max: 3 },
        steps_goal_7:   { curr: Math.min(7, lastNDays(7).filter(d=>parseInt(S.steps?.[d]||0)>=(S.stepsGoal||10000)).length), max: 7 },
      };
      return map[ach.id] || null;
    } catch(e) { return null; }
  }

  ACHIEVEMENTS_DEF.forEach(ach => {
    const unlocked = !!S.achievements[ach.id];
    if (unlocked) unlockedCount++;

    const card = document.createElement('div');
    card.className = 'ach-card ' + (unlocked ? 'unlocked' : 'locked');
    card.title = unlocked ? ('Débloqué le ' + S.achievements[ach.id].unlockedAt) : ach.desc;

    const iconEl = document.createElement('div'); iconEl.className = 'ach-icon'; iconEl.textContent = ach.icon;
    const nameEl = document.createElement('div'); nameEl.className = 'ach-name'; nameEl.textContent = ach.name;
    const descEl = document.createElement('div'); descEl.className = 'ach-desc'; descEl.textContent = ach.desc;
    card.appendChild(iconEl); card.appendChild(nameEl); card.appendChild(descEl);

    if (unlocked) {
      const dateEl = document.createElement('div');
      dateEl.className = 'ach-date';
      dateEl.textContent = '✓ ' + S.achievements[ach.id].unlockedAt;
      card.appendChild(dateEl);
    } else {
      // Barre de progression vers le badge
      const prog = getProgress(ach);
      if (prog && prog.max > 1) {
        const pct = Math.round(prog.curr / prog.max * 100);
        const progWrap = document.createElement('div');
        progWrap.style.cssText = 'margin-top:4px';
        const progBar = document.createElement('div');
        progBar.style.cssText = 'height:3px;background:var(--border);border-radius:2px;overflow:hidden;margin-bottom:2px';
        const fill = document.createElement('div');
        fill.style.cssText = `height:100%;width:${pct}%;background:var(--teal);border-radius:2px;transition:width .6s`;
        progBar.appendChild(fill);
        const progLbl = document.createElement('div');
        progLbl.style.cssText = 'font-size:9px;color:var(--muted);text-align:right';
        progLbl.textContent = prog.curr + '/' + prog.max;
        progWrap.appendChild(progBar); progWrap.appendChild(progLbl);
        card.appendChild(progWrap);
      } else if (prog && prog.curr === 0) {
        const lockEl = document.createElement('div');
        lockEl.style.cssText = 'font-size:9px;color:var(--muted);margin-top:4px';
        lockEl.textContent = '🔒 Non débloqué';
        card.appendChild(lockEl);
      }
    }

    grid.appendChild(card);
  });

  const cnt = document.getElementById('ach-unlocked-count');
  if (cnt) cnt.textContent = unlockedCount + '/' + ACHIEVEMENTS_DEF.length;
}

/* ══ BIBLIOTHÈQUE ══ */
function renderLibrary(){
  const search=(document.getElementById('lib-search').value||'').toLowerCase();
  const muscleFilter=document.getElementById('lib-filter-muscle').value;
  const patternFilter=document.getElementById('lib-filter-pattern').value;
  const equipFilter=(document.getElementById('lib-filter-equipment')||{}).value||'';
  const diffFilter=(document.getElementById('lib-filter-difficulty')||{}).value||'';
  // Populate muscle filter
  const mf=document.getElementById('lib-filter-muscle');if(mf.options.length<=1){MUSCLES.filter(m=>m.key!=='rep').forEach(m=>{const o=document.createElement('option');o.value=m.key;o.textContent=m.label;mf.appendChild(o);});}
  const grid=document.getElementById('lib-grid');grid.innerHTML='';
  const filtered=EXERCISE_LIBRARY.filter(ex=>{if(search&&!ex.name.toLowerCase().includes(search)&&!(ex.muscle||'').includes(search)&&!(ex.tips||'').toLowerCase().includes(search))return false;if(muscleFilter&&ex.muscle!==muscleFilter)return false;if(patternFilter&&ex.pattern!==patternFilter)return false;if(equipFilter&&ex.equipment!==equipFilter)return false;if(diffFilter&&ex.difficulty!==diffFilter)return false;return true;});
  filtered.forEach(ex=>{
    const m=MM[ex.muscle]||{calBg:'#eee',calColor:'#999'};
    const card=document.createElement('div');card.className='lib-card';
    const hdr=document.createElement('div');hdr.className='lib-card-hdr';
    const name=document.createElement('div');name.style.cssText='font-weight:600;font-size:11px;flex:1';name.textContent=ex.name;
    const muscle=document.createElement('span');muscle.className='lib-tag';muscle.style.cssText=`background:${m.calBg};color:${m.calColor}`;muscle.textContent=m.label||ex.muscle;
    const diff=document.createElement('span');diff.className='lib-tag';diff.style.cssText='background:var(--bg);color:var(--muted);margin-left:4px';diff.textContent=ex.difficulty;
    hdr.appendChild(name);hdr.appendChild(muscle);hdr.appendChild(diff);card.appendChild(hdr);
    const body=document.createElement('div');body.className='lib-card-body';
    if(ex.muscles_secondary&&ex.muscles_secondary.length){const secDiv=document.createElement('div');secDiv.className='lib-muscles';const secLbl=document.createElement('span');secLbl.style.cssText='font-size:8px;color:var(--muted);font-weight:700;text-transform:uppercase;width:100%';secLbl.textContent='Muscles secondaires:';secDiv.appendChild(secLbl);ex.muscles_secondary.forEach(mk=>{const mm=MM[mk];if(!mm)return;const p=document.createElement('span');p.className='lib-tag';p.style.cssText=`background:${mm.calBg};color:${mm.calColor}`;p.textContent=mm.label;secDiv.appendChild(p);});body.appendChild(secDiv);}
    if(ex.tips){const tipDiv=document.createElement('div');tipDiv.className='lib-tip';tipDiv.textContent='💡 '+ex.tips;body.appendChild(tipDiv);}
    if(ex.alternatives&&ex.alternatives.length){const altDiv=document.createElement('div');altDiv.style.cssText='margin-top:6px';const altLbl=document.createElement('div');altLbl.style.cssText='font-size:8px;color:var(--muted);font-weight:700;text-transform:uppercase;margin-bottom:3px';altLbl.textContent='Alternatives:';altDiv.appendChild(altLbl);ex.alternatives.forEach(alt=>{const a=document.createElement('span');a.style.cssText='font-size:9px;color:var(--teal-d);background:var(--teal-l);padding:1px 6px;border-radius:6px;margin-right:4px;margin-bottom:2px;display:inline-block';a.textContent=alt;altDiv.appendChild(a);});body.appendChild(altDiv);}
    if(ex.equipment){const eq=document.createElement('div');eq.style.cssText='margin-top:5px;font-size:9px;color:var(--muted)';eq.textContent='Équipement: '+ex.equipment;body.appendChild(eq);}
    // Add to planning button
    const addBtn=document.createElement('button');addBtn.className='btn btn-ghost btn-sm';addBtn.style.cssText='margin-top:8px;width:100%';addBtn.textContent='+ Ajouter au planning ('+DAYS_SH[S.activeDay]+')';
    addBtn.addEventListener('click',()=>{const d=S.days[S.activeDay];const newEx={id:uid(),name:ex.name,muscle:ex.muscle,weight:'',sets:'3',reps:'8–12',rest:'',tempo:'',repsAchieved:'',rpe:'',rir:'',note:'',done:false,setData:null,isWarmup:false,supersetGroup:''};d.exercises.push(newEx);save();showToast(ex.name+' ajouté à '+DAYS[S.activeDay],'save');});

    // Wger enrichment button + detail panel
    const wgerRow = document.createElement('div');
    wgerRow.style.cssText = 'display:flex;gap:6px;margin-top:6px';
    const wgerBtn = document.createElement('button');
    wgerBtn.className = 'btn btn-ghost btn-sm';
    wgerBtn.style.cssText = 'flex:1;font-size:10px;border-color:rgba(91,168,160,.3);color:var(--teal-d)';
    wgerBtn.textContent = '🏋️ Wger — Images & instructions';
    const wgerPanel = document.createElement('div');
    wgerPanel.style.cssText = 'margin-top:6px;display:none';
    let wgerLoaded = false;
    const toggleWger = () => {
      if (wgerPanel.style.display === 'none') {
        wgerPanel.style.display = 'block';
        wgerBtn.textContent = '▲ Masquer Wger';
        if (!wgerLoaded) {
          wgerLoaded = true;
          if (typeof WgerAPI !== 'undefined') WgerAPI.showExerciseDetail(ex.name, wgerPanel);
        }
      } else {
        wgerPanel.style.display = 'none';
        wgerBtn.textContent = '🏋️ Wger — Images & instructions';
      }
    };
    wgerBtn.ontouchstart=(e)=>{e.preventDefault();toggleWger();};
    wgerBtn.onclick=toggleWger;
    // PubMed button
    const pubmedBtn=document.createElement('button');pubmedBtn.className='btn btn-ghost btn-sm';pubmedBtn.style.cssText='flex:1;font-size:10px;border-color:rgba(229,62,62,.3);color:var(--red)';pubmedBtn.textContent='📚 PubMed';
    const pubmedPanel=document.createElement('div');pubmedPanel.style.cssText='margin-top:6px;display:none';
    let pubmedLoaded=false;
    const togglePubmed=()=>{
      if(pubmedPanel.style.display==='none'){pubmedPanel.style.display='block';pubmedBtn.textContent='▲ PubMed';if(!pubmedLoaded){pubmedLoaded=true;if(typeof PubMed!=='undefined')PubMed.showStudies(ex.name,pubmedPanel);}}
      else{pubmedPanel.style.display='none';pubmedBtn.textContent='📚 PubMed';}
    };
    pubmedBtn.ontouchstart=(e)=>{e.preventDefault();togglePubmed();}; pubmedBtn.onclick=togglePubmed;
    wgerRow.appendChild(wgerBtn); wgerRow.appendChild(pubmedBtn);
    body.appendChild(wgerRow); body.appendChild(wgerPanel); body.appendChild(pubmedPanel);
    body.appendChild(addBtn);card.appendChild(body);grid.appendChild(card);
  });
  if(!filtered.length)grid.innerHTML='<div class="prog-no-data">Aucun exercice trouvé.</div>';
}
['lib-search','lib-filter-muscle','lib-filter-pattern'].forEach(id=>{const el=document.getElementById(id);if(el)el.addEventListener('input',renderLibrary);});

/* ══ CALENDAR ══ */
function renderCalendar(){
  const {calYear,calMonth}=S;const title=new Date(calYear,calMonth,1).toLocaleDateString('fr-FR',{month:'long',year:'numeric'});document.getElementById('cal-month-title').textContent=title.charAt(0).toUpperCase()+title.slice(1);
  const grid=document.getElementById('cal-grid');grid.innerHTML='';
  ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].forEach(h=>{const dh=document.createElement('div');dh.className='cal-dh';dh.textContent=h;grid.appendChild(dh);});
  const startOffset=(new Date(calYear,calMonth,1).getDay()+6)%7;const daysInMonth=new Date(calYear,calMonth+1,0).getDate();const today=new Date();
  for(let i=0;i<startOffset;i++){const e=document.createElement('div');e.className='cal-cell empty';grid.appendChild(e);}
  for(let day=1;day<=daysInMonth;day++){
    const cell=document.createElement('div');cell.className='cal-cell';if(day===today.getDate()&&calMonth===today.getMonth()&&calYear===today.getFullYear())cell.classList.add('today');
    const ds=`${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const matchDay=S.days.find(d=>d.date===ds);const histDay=Object.values(S.history).flatMap(wk=>(wk.days||[])).find(d=>d.date===ds);const aDay=matchDay||histDay;const allMuscles=aDay?getDM(aDay):[];
    if(aDay){const exs=(aDay.exercises||[]).filter(e=>e.name&&e.name.trim()&&!e.isWarmup);const done=exs.filter(e=>e.done).length;const slots=getDMS(aDay);if(slots.includes('rep'))cell.classList.add('cal-rest');else if(exs.length&&done===exs.length)cell.classList.add('cal-full');else if(done>0)cell.classList.add('cal-partial');}
    if(day<daysInMonth&&matchDay){const nDs=`${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(day+1).padStart(2,'0')}`;const nD=S.days.find(d=>d.date===nDs);if(nD){const m1=getDM(matchDay).filter(k=>k!=='rep');const m2=getDM(nD).filter(k=>k!=='rep');if(m1.some(m=>m2.includes(m)))cell.classList.add('cal-conflict');}}
    const dn=document.createElement('div');dn.className='cal-dn';dn.textContent=day;cell.appendChild(dn);
    if(allMuscles.length){const mw=document.createElement('div');mw.className='cal-muscles';allMuscles.forEach(k=>{const m=MM[k];const p=document.createElement('span');p.className='cal-mpill';p.style.cssText=`background:${m.calBg};color:${m.calColor}`;p.textContent=m.label.split(' ')[0];mw.appendChild(p);});cell.appendChild(mw);}
    if(aDay){const exs=(aDay.exercises||[]).filter(e=>e.name&&e.name.trim()&&!e.isWarmup);if(exs.length){const done=exs.filter(e=>e.done).length;const sl=document.createElement('div');sl.className='cal-status';sl.style.color=done===exs.length?'var(--green)':done>0?'var(--orange)':'var(--muted)';sl.textContent=done===exs.length?'✅':done>0?`🔄 ${done}/${exs.length}`:'';cell.appendChild(sl);}}
    // Sleep indicator
    const sleepData=S.sleep[ds];if(sleepData&&sleepData.hours){const sh=document.createElement('div');sh.style.cssText='font-size:8px;color:var(--muted)';sh.textContent='😴'+sleepData.hours+'h';cell.appendChild(sh);}
    grid.appendChild(cell);
  }

  // ── Calendar Legend ──
  const legend = document.getElementById('cal-legend');
  if(legend){
    legend.innerHTML = '';
    legend.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;padding:10px 4px;font-size:11px';
    const items = [
      {color:'var(--green)',label:'Séance complète (100%)'},
      {color:'var(--teal)',label:'Séance partielle'},
      {color:'var(--orange)',label:'Cardio'},
      {color:'var(--red)',label:'Douleur signalée'},
      {color:'var(--purple)',label:'Sommeil renseigné'},
      {color:'var(--border)',label:'Repos / Sans données'},
    ];
    items.forEach(it=>{
      const item = document.createElement('div');
      item.style.cssText = 'display:flex;align-items:center;gap:5px;cursor:default';
      item.innerHTML = `<div style="width:12px;height:12px;border-radius:3px;background:${it.color};flex-shrink:0"></div><span style="color:var(--muted)">${it.label}</span>`;
      legend.appendChild(item);
    });
  }

}
document.getElementById('prev-month').addEventListener('click',()=>{S.calMonth--;if(S.calMonth<0){S.calMonth=11;S.calYear--;}renderCalendar();save();});
document.getElementById('next-month').addEventListener('click',()=>{S.calMonth++;if(S.calMonth>11){S.calMonth=0;S.calYear++;}renderCalendar();save();});

/* ── Paramètres (déplacé depuis utils.js) ── */
function _settingsSection(title, icon) {
  const sec  = document.createElement('div'); sec.className = 'settings-section';
  const lbl  = document.createElement('div'); lbl.className = 'settings-section-title'; lbl.textContent = title;
  const card = document.createElement('div'); card.className = 'settings-section-card';
  sec.appendChild(lbl);
  sec.appendChild(card);
  sec._card = card; // référence à la card pour y ajouter les rows
  return sec;
}

function _settingsRow(section, label, sub, controlFn, icon) {
  const card = section._card || section;
  const row  = document.createElement('div'); row.className = 'settings-row';

  // Icône colorée optionnelle
  if (icon) {
    const ic = document.createElement('div'); ic.className = 'settings-row-icon';
    ic.style.background = icon.bg || 'var(--teal)';
    ic.textContent = icon.emoji || '';
    row.appendChild(ic);
  }

  // Textes
  const lbl = document.createElement('div'); lbl.className = 'settings-row-label';
  const t   = document.createElement('div'); t.className   = 'settings-row-title'; t.textContent = label;
  lbl.appendChild(t);
  if (sub) {
    const s = document.createElement('div'); s.className = 'settings-row-sub'; s.textContent = sub;
    lbl.appendChild(s);
  }
  row.appendChild(lbl);

  // Contrôle
  const ctrl = controlFn ? controlFn() : null;
  if (ctrl) {
    const cw = document.createElement('div'); cw.className = 'settings-row-control';
    cw.appendChild(ctrl);
    row.appendChild(cw);
  }

  card.appendChild(row);
}

function renderSettings() {
  const wrap = document.getElementById('settings-wrap');
  if (!wrap) return;
  wrap.innerHTML = '';

  // ── TITRE DE PAGE ──
  const pageHdr = document.createElement('div'); pageHdr.className = 'settings-page-header';
  const pageTitle = document.createElement('div'); pageTitle.className = 'settings-page-title';
  pageTitle.textContent = '⚙️ Réglages';
  pageHdr.appendChild(pageTitle);
  wrap.appendChild(pageHdr);

  // ── iCLOUD DRIVE ──
  const icloudSec = _settingsSection('Sauvegarde', {emoji:'☁️', bg:'#5ba8a0'});
  _settingsRow(icloudSec, 'Derniere sauvegarde', typeof iCloudDrive!=='undefined' ? iCloudDrive.getLastBackupLabel() : '—', () => {
    const btn=document.createElement('button');btn.className='btn btn-teal btn-sm';btn.textContent='☁️ Gerer';
    btn.addEventListener('click',()=>{if(typeof iCloudDrive!=='undefined')iCloudDrive.showGuide();});
    btn.ontouchstart=(e)=>{e.stopPropagation();};
    return btn;
  });
  _settingsRow(icloudSec, 'Sauvegarder maintenant', 'Envoyer les donnees vers iCloud Drive', () => {
    const btn=document.createElement('button');btn.className='btn btn-ghost btn-sm';btn.textContent='📤 Exporter';
    btn.addEventListener('click',()=>{if(typeof iCloudDrive!=='undefined')iCloudDrive.export();});
    btn.ontouchstart=(e)=>{e.stopPropagation();};
    return btn;
  });
  _settingsRow(icloudSec, 'Restaurer depuis iCloud', 'Importer un fichier de sauvegarde', () => {
    const btn=document.createElement('button');btn.className='btn btn-ghost btn-sm';btn.textContent='📥 Importer';
    btn.addEventListener('click',()=>{if(typeof iCloudDrive!=='undefined')iCloudDrive.import();});
    btn.ontouchstart=(e)=>{e.stopPropagation();};
    return btn;
  });
  wrap.appendChild(icloudSec);

  // ── APPLE WATCH ──
  const watchSec = _settingsSection('Apple Watch', {emoji:'⌚', bg:'#1c1c1e'});
  const recScore = typeof AppleWatch!=='undefined' ? AppleWatch.calcRecoveryScore() : null;
  _settingsRow(watchSec, 'Score de recuperation', recScore ? recScore.score+'/100 — '+recScore.status : 'Aucune donnee Watch', () => {
    const btn=document.createElement('button');btn.className='btn btn-ghost btn-sm';btn.textContent='⚙ Configurer';
    btn.addEventListener('click',()=>{if(typeof AppleWatch!=='undefined')AppleWatch.showWatchGuide();});
    btn.ontouchstart=(e)=>{e.stopPropagation();};
    return btn;
  });
  wrap.appendChild(watchSec);

  // ── INTÉGRATIONS API ──
  const apiSec = _settingsSection('Intégrations', {emoji:'🔗', bg:'#5856d6'});
  _settingsRow(apiSec, 'Apple Sante (HealthKit)', 'Synchroniser pas, sommeil, poids depuis iPhone', () => {
    const btn = document.createElement('button'); btn.className='btn btn-ghost btn-sm';
    btn.textContent = '⚙ Configurer';
    btn.addEventListener('click', () => { if(typeof HealthKitBridge!=='undefined') HealthKitBridge.showSetupGuide(); });
    btn.ontouchstart = (e) => { e.stopPropagation(); };
    return btn;
  });
  _settingsRow(apiSec, 'Open Food Facts', 'Nutrition automatique par code-barres', () => {
    const btn = document.createElement('button'); btn.className='btn btn-ghost btn-sm';
    btn.style.cssText = 'background:rgba(56,161,105,.1);color:var(--green);border-color:rgba(56,161,105,.3)';
    btn.textContent = '✅ Active';
    return btn;
  });
  _settingsRow(apiSec, 'Wger Exercise DB', 'Images et instructions par exercice', () => {
    const btn = document.createElement('button'); btn.className='btn btn-ghost btn-sm';
    btn.style.cssText = 'background:rgba(56,161,105,.1);color:var(--green);border-color:rgba(56,161,105,.3)';
    btn.textContent = '✅ Active';
    return btn;
  });
  _settingsRow(apiSec, 'Coach IA (Claude)', 'Conseils personnalises et generation de programme', () => {
    const btn=document.createElement('button');btn.className='btn btn-teal btn-sm';btn.textContent='🤖 Ouvrir le Coach';
    btn.addEventListener('click',()=>{if(typeof ClaudeCoach!=='undefined')ClaudeCoach.showChat();});
    btn.ontouchstart=(e)=>{e.stopPropagation();};
    return btn;
  });
  _settingsRow(apiSec, 'Spotify', 'Musique pendant la seance', () => {
    const token = typeof SpotifyPlayer!=='undefined'?SpotifyPlayer.getToken():null;
    const btn=document.createElement('button');btn.className='btn btn-ghost btn-sm';
    btn.style.cssText=token?'background:rgba(29,185,84,.12);color:#1DB954;border-color:rgba(29,185,84,.3)':'';
    btn.textContent=token?'✅ Connecte - Ouvrir':'♫ Connecter Spotify';
    btn.addEventListener('click',()=>{if(typeof SpotifyPlayer!=='undefined')SpotifyPlayer.showPlayer();});
    btn.ontouchstart=(e)=>{e.stopPropagation();};
    return btn;
  });
  _settingsRow(apiSec, 'Coach IA — Cle API Anthropic', 'console.anthropic.com → API Keys', () => {
    const wrap2=document.createElement('div');wrap2.style.cssText='display:flex;gap:6px;align-items:center';
    const inp=document.createElement('input');inp.type='password';inp.className='settings-inp';
    inp.placeholder='sk-ant-...';inp.value=S.apiKeys?.claude||'';
    inp.style.cssText='flex:1;font-family:var(--mono);font-size:12px';
    inp.addEventListener('change',e=>{if(!S.apiKeys)S.apiKeys={};S.apiKeys.claude=e.target.value.trim();save();showToast('Cle Claude sauvegardee','save',2000);});
    const eye=document.createElement('button');eye.style.cssText='border:none;background:none;font-size:16px;cursor:pointer;padding:0 4px;touch-action:manipulation;color:var(--muted)';eye.textContent='👁';
    eye.onclick=()=>{inp.type=inp.type==='password'?'text':'password';};
    wrap2.appendChild(inp);wrap2.appendChild(eye);
    return wrap2;
  });
  _settingsRow(apiSec, 'USDA Food API Key', 'Optionnel : cle pour plus de requetes (api.nal.usda.gov)', () => {
    const inp=document.createElement('input');inp.type='text';inp.className='settings-inp';inp.placeholder='DEMO_KEY (default)';inp.value=S.apiKeys?.usda||'DEMO_KEY';
    inp.addEventListener('change',e=>{if(!S.apiKeys)S.apiKeys={};S.apiKeys.usda=e.target.value||'DEMO_KEY';save();});
    return inp;
  });
  wrap.appendChild(apiSec);

  // ── PROFIL ──
  const profSec = _settingsSection('Profil', {emoji:'👤', bg:'#ff6b35'});
  _settingsRow(profSec, 'Taille', 'Utilisée pour le calcul IMC & masse grasse', () => {
    const inp = document.createElement('input'); inp.type='number'; inp.className='settings-inp';
    inp.value=S.profilTaille||''; inp.placeholder='cm'; inp.min=100; inp.max=250;
    inp.addEventListener('change', e => { S.profilTaille=parseInt(e.target.value)||0; save(); });
    return inp;
  });
  _settingsRow(profSec, 'Objectif pas/jour', 'Pour le tracker de pas quotidiens', () => {
    const inp = document.createElement('input'); inp.type='number'; inp.className='settings-inp';
    inp.value=S.stepsGoal||10000; inp.min=1000; inp.max=50000; inp.step=500;
    inp.addEventListener('change', e => { S.stepsGoal=parseInt(e.target.value)||10000; save(); });
    return inp;
  });
  _settingsRow(profSec, 'Objectif calories/jour', 'Pour le tracker de calories', () => {
    const inp = document.createElement('input'); inp.type='number'; inp.className='settings-inp';
    inp.value=S.caloriesGoal||2500; inp.min=500; inp.max=6000; inp.step=50;
    inp.addEventListener('change', e => { S.caloriesGoal=parseInt(e.target.value)||2500; save(); });
    return inp;
  });
  _settingsRow(profSec, '🧮 Calculer mes macros', 'Calcul automatique depuis ton TDEE + objectif', () => {
    const btn = document.createElement('button'); btn.className='btn btn-teal btn-sm';
    btn.textContent = 'Calculer automatiquement';
    btn.addEventListener('click', () => {
      if (typeof Activity !== 'undefined') {
        Activity.setMacrosFromObjective();
        setTimeout(() => renderSettings(), 300);
      }
    });
    return btn;
  });
  wrap.appendChild(profSec);

  // ── PROGRAMME ──
  const progSec = _settingsSection('📋 Programme');
  _settingsRow(progSec, 'Semaine actuelle', 'A ou B', () => {
    const sp = document.createElement('span'); sp.style.cssText='font-size:13px;font-weight:700;color:var(--teal-d)';
    sp.textContent = 'Semaine ' + S.weekType + ' — N°' + S.weekCount;
    return sp;
  });
  _settingsRow(progSec, 'Bloc actuel', S.currentBlock, () => {
    const btn = document.createElement('button'); btn.className='btn btn-ghost btn-sm';
    btn.textContent='Changer'; btn.addEventListener('click', () => document.getElementById('block-btn')?.click());
    return btn;
  });
  _settingsRow(progSec, 'Archiver la semaine', 'Sauvegarder et passer à la suivante', () => {
    const btn = document.createElement('button'); btn.className='btn btn-teal btn-sm';
    btn.textContent='Archiver'; btn.addEventListener('click', () => { archiveWeek(); renderSettings(); });
    return btn;
  });
  wrap.appendChild(progSec);

  // ── APPARENCE ──
  // ── Section Entraînement ──
  const trainSec = _settingsSection('⚡ Entraînement');
  _settingsRow(trainSec, 'Repos entre séries', 'Durée par défaut du minuteur de repos', () => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap';
    [{sec:45,lbl:'45s'},{sec:60,lbl:'1 min'},{sec:90,lbl:'1:30'},{sec:120,lbl:'2 min'},{sec:180,lbl:'3 min'}].forEach(({sec,lbl}) => {
      const btn = document.createElement('button');
      btn.className = 'rest-timer-preset' + (S._restDuration===sec?' active':'');
      btn.textContent = lbl;
      btn.style.cssText = 'padding:6px 12px;min-height:34px;font-size:12px';
      btn.addEventListener('click', () => {
        S._restDuration = sec;
        save();
        wrap.querySelectorAll('.rest-timer-preset').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        showToast('⏱ Repos par défaut : ' + lbl, 'ok', 2000);
      });
      wrap.appendChild(btn);
    });
    return wrap;
  });
  _settingsRow(trainSec, 'Son du minuteur', 'Bip sonore à la fin du repos', () => {
    const tog = document.createElement('label');
    tog.style.cssText = 'display:flex;align-items:center;gap:8px;cursor:pointer';
    const inp = document.createElement('input'); inp.type='checkbox';
    inp.checked = S._restBeep !== false;
    inp.addEventListener('change', () => { S._restBeep = inp.checked; save(); });
    const lbl = document.createElement('span'); lbl.style.fontSize='12px'; lbl.textContent = inp.checked ? '🔔 Activé' : '🔕 Désactivé';
    inp.addEventListener('change', () => { lbl.textContent = inp.checked ? '🔔 Activé' : '🔕 Désactivé'; });
    tog.appendChild(inp); tog.appendChild(lbl);
    return tog;
  });

  const appSec = _settingsSection('🎨 Apparence');
  _settingsRow(appSec, 'Mode sombre', 'Thème sombre pour économiser la batterie', () => {
    const label = document.createElement('label'); label.className='toggle-wrap';
    const inp = document.createElement('input'); inp.type='checkbox'; inp.className='toggle-inp'; inp.checked=S.darkMode||false;
    inp.addEventListener('change', e => { S.darkMode=e.target.checked; document.documentElement.setAttribute('data-theme', e.target.checked?'dark':'light'); save(); });
    const slider = document.createElement('span'); slider.className='toggle-slider';
    label.appendChild(inp); label.appendChild(slider); return label;
  });
  wrap.appendChild(appSec);

  // ── NOTIFICATIONS ──
  const notifSec = _settingsSection('Notifications', {emoji:'🔔', bg:'#ff9500'});
  const notifPerm = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
  const notifStatus = notifPerm === 'granted' ? '✅ Activées' : notifPerm === 'denied' ? '❌ Refusées (modifier dans Réglages → Safari)' : '⬜ Non configurées';
  _settingsRow(notifSec, 'Autorisation', notifStatus, () => {
    if (notifPerm === 'granted') return null;
    const btn = document.createElement('button'); btn.className='btn btn-teal btn-sm';
    btn.textContent = notifPerm === 'denied' ? 'Ouvrir Réglages' : 'Activer';
    btn.addEventListener('click', requestNotifPermission);
    return btn;
  });
  _settingsRow(notifSec, 'Rappel entraînement', "Notification quotidienne à l'heure de ta séance", () => {
    const wrap2 = document.createElement('div');
    wrap2.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap';
    const timeInp = document.createElement('input');
    timeInp.type = 'time'; timeInp.className = 'onboard-inp';
    timeInp.style.cssText = 'width:110px;padding:6px 10px;font-size:14px';
    const h = S._reminderHour; const m = S._reminderMinute;
    timeInp.value = (h!=null) ? (String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')) : '08:00';
    const setBtn = document.createElement('button'); setBtn.className='btn btn-teal btn-sm';
    setBtn.textContent = (h!=null) ? '✅ Modifer' : '🔔 Activer';
    setBtn.addEventListener('click', async () => {
      const [hh,mm] = timeInp.value.split(':').map(Number);
      if(isNaN(hh)||isNaN(mm)) return;
      const ok = notifPerm === 'granted' || await requestNotifPermission();
      if(ok) { scheduleTrainingReminder(hh, mm); setBtn.textContent='✅ Modifer'; }
    });
    const cancelBtn = document.createElement('button'); cancelBtn.className='btn btn-ghost btn-sm';
    cancelBtn.textContent='🔕 Annuler';
    cancelBtn.style.display = (h!=null) ? 'block' : 'none';
    cancelBtn.addEventListener('click', () => { cancelTrainingReminder(); cancelBtn.style.display='none'; setBtn.textContent='🔔 Activer'; });
    wrap2.appendChild(timeInp); wrap2.appendChild(setBtn); wrap2.appendChild(cancelBtn);
    return wrap2;
  });
  wrap.appendChild(notifSec);

  // ── DONNÉES ──
  const dataSec = _settingsSection('Données', {emoji:'💾', bg:'#34c759'});
  _settingsRow(dataSec, 'Exporter mes données', 'Fichier JSON de sauvegarde complet', () => {
    const btn = document.createElement('button'); btn.className='btn btn-ghost btn-sm';
    btn.textContent='⬇ Exporter'; btn.addEventListener('click', () => document.getElementById('export-btn')?.click());
    return btn;
  });
  _settingsRow(dataSec, 'Exporter historique CSV', 'Compatible Excel / Google Sheets', () => {
    const btn = document.createElement('button'); btn.className='btn btn-ghost btn-sm';
    btn.textContent='📊 Export CSV';
    btn.addEventListener('click', () => {
      if (typeof Persist !== 'undefined') Persist.exportCSV();
      else if (typeof exportCSV === 'function') exportCSV();
    });
    return btn;
  });
  _settingsRow(dataSec, 'Importer des données', 'Restaurer depuis un fichier JSON', () => {
    const btn = document.createElement('button'); btn.className='btn btn-ghost btn-sm';
    btn.textContent='⬆ Importer'; btn.addEventListener('click', () => document.getElementById('import-btn')?.click());
    return btn;
  });
  _settingsRow(dataSec, 'Données de démonstration', 'Générer 8 semaines d\u2019entra\u00eenement', () => {
    const btn = document.createElement('button'); btn.className='btn btn-ghost btn-sm';
    btn.textContent='🎲 Démo'; btn.addEventListener('click', () => document.getElementById('gen-sample-data')?.click());
    return btn;
  });
  _settingsRow(dataSec, 'Reconfiguration', 'Relancer l\'assistant de démarrage', () => {
    const btn = document.createElement('button');
    btn.className = 'btn btn-ghost btn-sm';
    btn.textContent = '🔄 Reconfigurer';
    btn.addEventListener('click', () => resetOnboarding());
    return btn;
  });
  _settingsRow(dataSec, 'Espace utilisé', 'localStorage', () => {
    const sp = document.createElement('span'); sp.style.cssText='font-family:var(--mono);font-size:12px;color:var(--muted)';
    try {
      const used = new Blob([JSON.stringify(Store.bridge())]).size;
      sp.textContent = (used/1024).toFixed(1) + ' KB / ~5 MB';
    } catch(e) { sp.textContent = '—'; }
    return sp;
  });
  _settingsRow(dataSec, 'Version du schéma', '', () => {
    const sp = document.createElement('span'); sp.style.cssText='font-family:var(--mono);font-size:12px;color:var(--muted)';
    sp.textContent = 'v' + (S._schemaVersion||3); return sp;
  });
  wrap.appendChild(dataSec);

  // ── COMPARAISON A/B ──
  const abSec = _settingsSection('📊 Comparaison Semaine A vs B');
  const abContainer = document.createElement('div'); abContainer.style.padding = '12px';
  abSec.appendChild(abContainer);
  wrap.appendChild(abSec);
  setTimeout(() => renderABCompare(abContainer), 50);

  // ── TESTS ──
  _settingsRow(dataSec, 'Tests unitaires (?test=1)', 'Vérifier l\'intégrité de l\'application', () => {
    const btn = document.createElement('button'); btn.className='btn btn-ghost btn-sm';
    btn.textContent='🧪 Lancer'; btn.addEventListener('click', () => window.open(location.href.split('?')[0]+'?test=1','_blank'));
    return btn;
  });
}

function renderABCompare(container) {
  if (!container) return;
  container.innerHTML = '';
  const aWeeks = Object.values(S.history).filter(w => w.weekType === 'A');
  const bWeeks = Object.values(S.history).filter(w => w.weekType === 'B');
  if (!aWeeks.length && !bWeeks.length) {
    container.innerHTML = '<div class="chart-no-data">Archivez des semaines A et B pour comparer.</div>';
    return;
  }
  const avgVol = weeks => {
    if (!weeks.length) return {};
    const totals = {};
    weeks.forEach(wk => (wk.days||[]).forEach(d => (d.exercises||[]).filter(e=>!e.isWarmup).forEach(ex => {
      const v = calcVol(ex); if (v&&ex.muscle) totals[ex.muscle] = (totals[ex.muscle]||0) + v;
    })));
    Object.keys(totals).forEach(k => totals[k] = Math.round(totals[k]/weeks.length));
    return totals;
  };
  const aVol = avgVol(aWeeks), bVol = avgVol(bWeeks);
  const keys = [...new Set([...Object.keys(aVol),...Object.keys(bVol)])];
  if (!keys.length) { container.innerHTML = '<div class="chart-no-data">Aucune donnée de volume.</div>'; return; }

  const maxV = Math.max(...keys.map(k => Math.max(aVol[k]||0, bVol[k]||0)), 1);
  keys.forEach(k => {
    const m = MM[k]; if (!m) return;
    const aV = aVol[k]||0, bV = bVol[k]||0;
    const row = document.createElement('div'); row.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:11px';
    const lbl = document.createElement('div'); lbl.style.cssText = 'width:52px;color:var(--muted);flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap'; lbl.textContent = m.label.split(' ')[0];
    const bars = document.createElement('div'); bars.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:3px';
    [[aV,'var(--teal)','A'],[bV,'var(--purple)','B']].forEach(([v,col,lbl2]) => {
      const bw = document.createElement('div'); bw.style.cssText = 'display:flex;align-items:center;gap:5px';
      const tag = document.createElement('span'); tag.style.cssText = 'font-size:8px;font-weight:700;width:10px;color:'+col; tag.textContent = lbl2;
      const barWrap = document.createElement('div'); barWrap.style.cssText = 'flex:1;height:7px;background:var(--border);border-radius:4px;overflow:hidden';
      const barFill = document.createElement('div'); barFill.style.cssText = `width:${Math.round(v/maxV*100)}%;height:100%;background:${col};border-radius:4px`;
      barWrap.appendChild(barFill);
      const valEl = document.createElement('span'); valEl.style.cssText = 'font-size:9px;font-family:var(--mono);color:var(--muted);width:36px;text-align:right';
      valEl.textContent = Math.round(v/1000*10)/10+'t';
      bw.appendChild(tag); bw.appendChild(barWrap); bw.appendChild(valEl); bars.appendChild(bw);
    });
    row.appendChild(lbl); row.appendChild(bars); container.appendChild(row);
  });
  const legend = document.createElement('div'); legend.style.cssText = 'display:flex;gap:14px;margin-top:8px;font-size:10px;color:var(--muted)';
  [['var(--teal)','Semaine A (moy. '+aWeeks.length+'sem.)'],['var(--purple)','Semaine B (moy. '+bWeeks.length+'sem.)']].forEach(([c,l]) => {
    const li = document.createElement('span'); li.style.cssText = 'display:flex;align-items:center;gap:4px';
    const dot = document.createElement('span'); dot.style.cssText = 'width:10px;height:10px;border-radius:50%;background:'+c;
    li.appendChild(dot); li.appendChild(document.createTextNode(l)); legend.appendChild(li);
  });
  container.appendChild(legend);

  // ── PROGRAMMES PRÉDÉFINIS ──
  if (typeof PROGRAMS !== 'undefined') {
    const progSec = _settingsSection('📋 Programme d\'entraînement');
    wrap.appendChild(progSec);

    _settingsRow(progSec, 'Charger un programme prédéfini',
      'Remplace ton planning par un programme complet', () => {
      const container = document.createElement('div');
      container.style.cssText = 'display:flex;flex-direction:column;gap:8px;margin-top:4px';

      PROGRAMS.forEach(prog => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-ghost';
        btn.style.cssText = 'text-align:left;padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius-md)';
        btn.innerHTML = '<span style="font-size:18px;margin-right:8px">' + prog.icon + '</span>' +
          '<span><strong>' + prog.label + '</strong><br>' +
          '<span style="font-size:11px;color:var(--color-text-muted)">' + prog.description + '</span></span>';
        btn.addEventListener('click', () => {
          if (typeof loadProgram === 'function') {
            loadProgram(prog.id);
            if (typeof renderDayTabs === 'function') renderDayTabs();
            if (typeof renderDayDetail === 'function') renderDayDetail(0);
          }
        });
        container.appendChild(btn);
      });
      return container;
    });
  }

}