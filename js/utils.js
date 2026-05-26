/* ============================================================
   utils.js — Toast + Export + Navigation + Helpers
============================================================ */

/* ══ TOAST ══ */
function showToast(msg,type='save',dur=2500){
  const t=document.createElement('div');t.className=`toast toast-${type}`;t.textContent=msg;
  document.body.appendChild(t);setTimeout(()=>t.remove(),dur);
}
function showPRToast(name){showToast('🏆 NOUVEAU PR ! '+name,'pr',3500);}

/* ══ EXPORT / IMPORT ══ */
document.getElementById('export-btn').addEventListener('click',()=>{
  const b=new Blob([JSON.stringify(S,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(b);
  a.download='coach-tracker-'+localDateStr()+'.json';a.click();
  showToast('Export réussi ✓','save');
});
document.getElementById('import-btn').addEventListener('click',()=>document.getElementById('import-file').click());
document.getElementById('import-file').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return;
  const reader = new FileReader();
  reader.onload = async (ev) => {
    let data;
    try { data = JSON.parse(ev.target.result); }
    catch(err) { showToast('❌ Fichier JSON invalide.', 'error'); return; }

    const { ok, errors } = validateImport(data);
    if (!ok) {
      showToast('❌ Import refusé: ' + errors[0], 'error', 5000);
      return;
    }

    const confirmed = await Modal.confirm(
      'Importer ces données ? Vos données actuelles seront remplacées.\n\nUn backup automatique sera créé.',
      'Importer', 'Annuler'
    );
    if (!confirmed) return;

    // Backup before import
    try {
      localStorage.setItem('ctp_backup_' + localDateStr(), localStorage.getItem('ctp_v3') || '');
    } catch(e) { /* backup non critique */ }

    try {
      const migrated = migrateState(data);
      Object.keys(migrated).forEach(k => { if (k in S || k === '_schemaVersion') S[k] = migrated[k]; });
      save(true);
      showToast('✅ Import réussi. Rechargement...', 'save', 1500);
      setTimeout(() => location.reload(), 1600);
    } catch(err) {
      showToast('Erreur import: ' + err.message, 'error', 5000);
    }
  };
  reader.readAsText(f); e.target.value = '';
});

/* ══ DARK MODE ══ */
document.getElementById('darkmode-btn').addEventListener('click',()=>{
  S.darkMode=!S.darkMode;document.documentElement.setAttribute('data-theme',S.darkMode?'dark':'light');
  document.getElementById('darkmode-btn').textContent=S.darkMode?'☀️':'🌙';save();
});

/* ══ KEYBOARD SHORTCUTS ══ */
document.addEventListener('keydown',e=>{
  if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.tagName==='SELECT')return;
  if(e.key==='d'||e.key==='D'){document.getElementById('darkmode-btn').click();}
  if(e.key===' '){e.preventDefault();if(_cr)pauseChrono();else startChrono();}
  if(e.key==='r'||e.key==='R'){e.preventDefault();resetChrono();}
  if(e.key>='1'&&e.key<='7'){const i=parseInt(e.key)-1;S.activeDay=i;renderDayTabs();renderDayDetail(i);}
  if((e.ctrlKey||e.metaKey)&&e.key==='z'){e.preventDefault();undoAction();}
});

/* ══ WEEK MANAGEMENT ══ */
function archiveWeek(){
  const key=localDateStr(); // local date, not UTC
  S.history[key]={weekType:S.weekType,weekCount:S.weekCount,block:S.currentBlock,blockWeek:S.blockWeek,
    days:S.days.map(d=>({date:d.date,muscles:[...d.muscles],cardio:{...d.cardio},
      exercises:d.exercises.map(e=>({name:e.name,muscle:e.muscle,weight:e.weight,sets:e.sets,reps:e.reps,repsAchieved:e.repsAchieved||'',rpe:e.rpe||'',rir:e.rir||'',note:e.note||'',done:e.done,isWarmup:e.isWarmup||false,supersetGroup:e.supersetGroup||''}))
    }))};
  // Update next week weights (progressive overload planning)
  planNextWeekWeights();
  save();showToast('Semaine archivée ✓','save');
}
function planNextWeekWeights(){
  S.days.forEach(d=>{
    d.exercises.forEach(ex=>{
      if(!ex.weight||!ex.repsAchieved)return;
      if(shouldOverload(ex)){
        const cw=parseFloat(ex.weight)||0;
        ex.suggestedNextWeight=String(Math.round((cw*1.025)/2.5)*2.5);
      } else if(isFailure(ex)){
        const cw=parseFloat(ex.weight)||0;
        ex.suggestedNextWeight=String(Math.round((cw*0.975)/2.5)*2.5);
      } else {
        ex.suggestedNextWeight=ex.weight;
      }
    });
  });
}
document.getElementById('archive-week-btn').addEventListener('click',()=>{archiveWeek();const b=document.getElementById('archive-week-btn');b.innerHTML='<span>✅</span>';setTimeout(()=>b.innerHTML='<span>📁</span>',2000);});
document.getElementById('toggle-week-btn').addEventListener('click',async()=>{
  const _ok=await Modal.confirm('Archiver et basculer en semaine '+(S.weekType==='A'?'B':'A')+' ?');
  if(!_ok)return;
  archiveWeek();S.weekType=S.weekType==='A'?'B':'A';S.weekCount++;S.blockWeek++;
  if(S.blockWeek>6){S.blockWeek=1;const bi=TRAINING_BLOCKS.indexOf(S.currentBlock);S.currentBlock=TRAINING_BLOCKS[(bi+1)%TRAINING_BLOCKS.length];}
  S.days=Array.from({length:7},(_,i)=>mkDay(i,S.weekType));
  // Pre-fill suggested weights
  S.days.forEach(d=>d.exercises.forEach(ex=>{
    const h=exHist(ex.name);if(h.length){const lw=h[h.length-1];ex.weight=lw.suggestedNextWeight||lw.weight||'';}
  }));
  save();updateWeekBadges();renderDayTabs();renderDayDetail(S.activeDay);updateStats();
  showToast('Semaine '+(S.weekType==='A'?'A':'B')+' démarrée — Bloc: '+S.currentBlock,'save');
});
document.getElementById('block-btn').addEventListener('click',async()=>{
  const sel=await Modal.form('Choisir le bloc d entraînement',[
    {key:'block',label:'Bloc',type:'select',options:TRAINING_BLOCKS,value:TRAINING_BLOCKS.indexOf(S.currentBlock)+1}
  ]);
  if(!sel)return;const idx=parseInt(sel.block)-1;if(idx>=0&&idx<4){S.currentBlock=TRAINING_BLOCKS[idx];S.blockWeek=1;save();updateWeekBadges();showToast('Bloc: '+S.currentBlock,'save');}
});
function updateWeekBadges(){
  document.getElementById('week-type-badge').textContent='Sem. '+S.weekType;
  document.getElementById('week-counter-badge').textContent='Sem. '+S.weekCount+' · '+S.currentBlock;
}

/* ══ AUTO-SAVE weekly backup ══ */
function checkWeeklyAutoSave(){
  const today=new Date();if(today.getDay()===0){// Sunday
    const key='lastAutoSave';const last=localStorage.getItem(key);
    const todayStr=localDateStr(today);
    if(last!==todayStr){archiveWeek();localStorage.setItem(key,todayStr);}
  }
}

/* ══ HELPERS ══ */
function getDM(d){const s=new Set((d.muscles||[]).filter(Boolean));(d.exercises||[]).forEach(ex=>{if(ex.muscle)s.add(ex.muscle);});return MK.filter(k=>s.has(k));}
function getDMS(d){return(d.muscles||[]).filter(Boolean);}
function calcVol(ex){const w=parseFloat(ex.weight)||0,s=parseInt(ex.sets)||0,r=parseInt(ex.repsAchieved||ex.reps)||0;return w&&s&&r&&!ex.isWarmup?w*s*r:0;}
function calc1RM(w,r){const ww=parseFloat(w)||0,rr=parseInt(r)||0;return ww&&rr?Math.round(ww*(1+rr/30)):0;}
function dayVol(d){const v={};d.exercises.filter(e=>!e.isWarmup).forEach(ex=>{const vv=calcVol(ex);if(vv&&ex.muscle)v[ex.muscle]=(v[ex.muscle]||0)+vv;});return v;}
function weekVol(){const v={};S.days.forEach(d=>Object.entries(dayVol(d)).forEach(([k,vv])=>v[k]=(v[k]||0)+vv));return v;}
function exHist(nameOrId){
  // Search by id first (stable across renames), fallback to name
  const byId   = ex => ex.id && ex.id === nameOrId;
  const byName = ex => ex.name === nameOrId;
  const r=[];
  Object.entries(S.history).sort(([a],[b])=>a.localeCompare(b)).forEach(([wk,wkD])=>{
    (wkD.days||[]).forEach(d=>(d.exercises||[]).forEach(ex=>{
      if((byId(ex)||byName(ex))&&ex.weight)
        r.push({weekKey:wk,weekCount:wkD.weekCount||1,weight:ex.weight,repsAchieved:ex.repsAchieved,sets:ex.sets,reps:ex.reps,done:ex.done,suggestedNextWeight:ex.suggestedNextWeight,id:ex.id,name:ex.name});
    }));
  });return r;
}
// Helper: resolve exercise lookup key (prefer id, fallback name)
function exKey(ex){return ex.id||ex.name;}
function lastW(ex){
  if(typeof ex==='object') return exHist(exKey(ex)).slice(-1)[0]?.weight||'';
  return exHist(ex).slice(-1)[0]?.weight||''; // backward compat with string
}
function shouldOverload(ex){if(!ex.repsAchieved)return false;const a=parseInt(ex.repsAchieved),m=(ex.reps||'').match(/(\d+)/g);if(!m)return false;return a>=parseInt(m[m.length-1]);}
function isFailure(ex){if(!ex.repsAchieved||!ex.reps)return false;const a=parseInt(ex.repsAchieved),m=(ex.reps||'').match(/(\d+)/g);if(!m)return false;const minTarget=parseInt(m[0]);return a<minTarget*0.85;}
function isPlateau(nameOrEx){
  const key=typeof nameOrEx==='object'?exKey(nameOrEx):nameOrEx;
  const h=exHist(key).slice(-3);if(h.length<3)return false;
  const ws=h.map(r=>parseFloat(r.weight)||0);return ws.every(w=>w===ws[0])&&ws[0]>0;
}
function checkPR(ex){
  if(!ex.weight||!ex.repsAchieved)return false;
  const h=exHist(exKey(ex));if(!h.length)return false;
  const maxHist1rm=Math.max(...h.map(r=>calc1RM(r.weight,r.repsAchieved||r.reps)));
  return calc1RM(ex.weight,ex.repsAchieved)>maxHist1rm&&calc1RM(ex.weight,ex.repsAchieved)>0;
}
function rpeColor(rpe){const r=parseFloat(rpe)||0;return r<=0?'':r<=7?'rpe-easy':r<=8.5?'rpe-target':'rpe-hard';}
function pushPull(){const v=weekVol();let push=0,pull=0;MUSCLES.forEach(m=>{const vv=v[m.key]||0;if(m.type==='push')push+=vv;else if(m.type==='pull')pull+=vv;});return{push,pull};}
// todayStr() now uses localDateStr() to avoid UTC offset bug (was: toISOString)
function todayStr(){return localDateStr();}
function strengthStandard(ex,poids){
  // Returns level based on ratio weight/bodyweight
  const libEx=EXERCISE_LIBRARY.find(e=>ex.name.includes(e.name.slice(0,10)));
  if(!libEx||!libEx.std_ratio||!poids)return null;
  const w=parseFloat(ex.weight)||0;const ratio=w/poids;
  if(ratio>=libEx.std_ratio.bw90)return{level:'Avancé',color:'var(--purple)'};
  if(ratio>=libEx.std_ratio.bw75)return{level:'Intermédiaire',color:'var(--green)'};
  if(ratio>=libEx.std_ratio.bw60)return{level:'Débutant+',color:'var(--orange)'};
  return{level:'Débutant',color:'var(--red)'};
}

/* ══ TABS ══ */
// Central tab switching function — syncs both top tabs and bottom nav



function _dashCard(title) {
  const card = document.createElement('div');
  card.style.cssText = 'background:var(--card);border:1px solid var(--border);border-radius:var(--r);box-shadow:var(--sh);padding:14px;display:flex;flex-direction:column;gap:6px';
  const t = document.createElement('div'); t.className = 'dash-section-title'; t.textContent = title;
  card.appendChild(t);
  return card;
}

function _getDailyLoad(ds) {
  const mD = S.days.find(d => d.date === ds);
  if (mD) { const v = Object.values(dayVol(mD)).reduce((a, b) => a + b, 0); if (v) return v; }
  for (const wk of Object.values(S.history)) {
    const hD = (wk.days || []).find(d => d.date === ds);
    if (hD) return (hD.exercises || []).filter(e => !e.isWarmup).reduce((a, ex) => a + calcVol(ex), 0);
  }
  return 0;
}

function _buildWeeklyVolumeData() {
  const MUSCLE_COLORS = {pec:'#ffe0ea',dos:'#e0d8ff',jam:'#d4f0e8',ep:'#fde8d5',bic:'#fdf5d4',tri:'#d4e8f8',abd:'#ffd9cc'};
  const weeks = Object.entries(S.history).sort(([a],[b]) => a.localeCompare(b)).slice(-8);
  const cur = {key:'current', days: S.days, weekCount: S.weekCount};
  [...weeks.map(([k,w]) => ({key:k,...w})), cur].forEach(w => {}); // normalize
  return [...weeks, ['current', {days: S.days, weekCount: S.weekCount}]].map(([key, wk]) => {
    const vol = (wk.days || []).reduce((acc, d) => {
      (d.exercises || []).filter(e => !e.isWarmup).forEach(ex => {
        const v = calcVol(ex); if (v && ex.muscle) acc += v;
      });
      return acc;
    }, 0);
    const lbl = key === 'current' ? 'Actuel' : 'S' + (wk.weekCount || '?');
    const isB = (wk.weekType || 'A') === 'B';
    return {label: lbl, value: Math.round(vol / 1000 * 10) / 10 * 1000, color: isB ? 'var(--purple)' : 'var(--teal)'};
  }).filter(d => d.value > 0);
}

function _buildAlerts() {
  const alerts = [];
  S.days.forEach((d, i) => {
    d.exercises.filter(e => !e.isWarmup && e.name).forEach(ex => {
      if (shouldOverload(ex)) alerts.push({type:'good', msg:'↑ ' + ex.name + ' — Augmentez la charge !'});
      else if (isFailure(ex))   alerts.push({type:'bad',  msg:'↓ ' + ex.name + ' — Trop lourd, réduisez.'});
      else if (isPlateau(exKey(ex))) alerts.push({type:'bad', msg:'⚠ ' + ex.name + ' — Plateau détecté (3+ semaines).'});
    });
  });
  const atl = computeATLCTL();
  if (atl.tsb < -20) alerts.push({type:'bad', msg:'🔴 TSB très négatif (' + atl.tsb + ') — Repos conseillé.'});
  const streak = computeStreak();
  if (streak.current >= 7) alerts.push({type:'good', msg:'🔥 Streak de ' + streak.current + ' jours — Excellent !'});
  return alerts;
}


/* ══ RECHERCHE GLOBALE ══ */
/* _searchOpen — déclaré dans constants.js */
function openSearch() {
  if (_searchOpen) return;
  _searchOpen = true;
  const overlay = document.createElement('div');
  overlay.className = 'search-overlay';
  overlay.id = 'search-overlay';

  const box = document.createElement('div'); box.className = 'search-box';
  const inputWrap = document.createElement('div'); inputWrap.className = 'search-inp-wrap';
  const searchIcon = document.createElement('span'); searchIcon.textContent = '🔍'; searchIcon.style.fontSize = '18px';
  const inp = document.createElement('input');
  inp.type = 'search'; inp.placeholder = 'Rechercher un exercice, groupe musculaire...';
  inp.setAttribute('autofocus', '');
  const closeBtn = document.createElement('button');
  closeBtn.style.cssText = 'background:none;border:none;font-size:20px;cursor:pointer;color:var(--muted);padding:4px;min-height:44px;min-width:44px';
  closeBtn.textContent = '✕';
  closeBtn.addEventListener('click', closeSearch);

  inputWrap.appendChild(searchIcon); inputWrap.appendChild(inp); inputWrap.appendChild(closeBtn);
  const results = document.createElement('div'); results.className = 'search-results';

  box.appendChild(inputWrap); box.appendChild(results);
  overlay.appendChild(box);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeSearch(); });
  document.body.appendChild(overlay);
  setTimeout(() => inp.focus(), 100);

  inp.addEventListener('input', () => _runSearch(inp.value.trim().toLowerCase(), results));
  inp.addEventListener('keydown', e => { if (e.key === 'Escape') closeSearch(); });
  _runSearch('', results);
}

function closeSearch() {
  const ov = document.getElementById('search-overlay');
  if (ov) ov.remove();
  _searchOpen = false;
}

function _runSearch(q, results) {
  results.innerHTML = '';
  const hits = [];

  // Exercises in planning
  S.days.forEach((d, di) => {
    d.exercises.filter(ex => ex.name && (!q || ex.name.toLowerCase().includes(q))).forEach(ex => {
      hits.push({icon:'💪', title: ex.name, sub: DAYS[di] + ' · ' + (MM[ex.muscle]?.label||ex.muscle||''), badge: ex.weight?ex.weight+'kg':'', badgeColor:'var(--teal)', action: () => { switchTab('weekly'); setTimeout(() => { S.activeDay=di; renderDayTabs(); renderDayDetail(di); }, 100); closeSearch(); }});
    });
  });

  // Library exercises
  EXERCISE_LIBRARY.filter(ex => !q || ex.name.toLowerCase().includes(q) || (ex.muscle||'').includes(q)).slice(0,8).forEach(ex => {
    const m = MM[ex.muscle];
    hits.push({icon:'📚', title: ex.name, sub: (m?.label||ex.muscle||'') + ' · ' + ex.difficulty, badge: ex.pattern, badgeColor:'var(--border)', action: () => { switchTab('library'); closeSearch(); }});
  });

  // History
  Object.entries(S.history).sort(([a],[b])=>b.localeCompare(a)).slice(0,5).forEach(([k,wk]) => {
    if (q && !k.includes(q) && !('semaine').includes(q)) return;
    const vol = (wk.days||[]).reduce((acc,d) => acc + (d.exercises||[]).filter(e=>!e.isWarmup).reduce((a,ex)=>a+calcVol(ex),0), 0);
    hits.push({icon:'📅', title: 'Semaine ' + (wk.weekType||'A') + ' — ' + k, sub: 'Volume: ' + Math.round(vol/1000*10)/10 + 't', badge:'Historique', badgeColor:'var(--purple)', action: () => { switchTab('bilan'); closeSearch(); }});
  });

  if (!hits.length) {
    const nd = document.createElement('div'); nd.className = 'search-no-result';
    nd.textContent = q ? 'Aucun résultat pour "' + q + '"' : 'Commencez à taper pour rechercher...';
    results.appendChild(nd); return;
  }

  hits.slice(0, 20).forEach(h => {
    const item = document.createElement('div'); item.className = 'search-result-item';
    const icon = document.createElement('div'); icon.className = 'search-result-icon'; icon.textContent = h.icon;
    const txt  = document.createElement('div'); txt.className = 'search-result-text';
    const title = document.createElement('div'); title.className = 'search-result-title'; title.textContent = h.title;
    const sub   = document.createElement('div'); sub.className = 'search-result-sub'; sub.textContent = h.sub;
    txt.appendChild(title); txt.appendChild(sub);
    const badge = document.createElement('span'); badge.className = 'search-result-badge';
    badge.style.cssText = 'background:' + h.badgeColor + '22;color:' + h.badgeColor + ';border:1px solid ' + h.badgeColor + '44';
    badge.textContent = h.badge;
    item.appendChild(icon); item.appendChild(txt); item.appendChild(badge);
    item.addEventListener('click', h.action);
    results.appendChild(item);
  });
}


function shareSess(di, exercises, vol, dur) {
  const prs = exercises.filter(ex => checkPR(ex));
  const text = [
    '🏋️ Séance terminée — ' + DAYS[di],
    'Semaine ' + S.weekType + ' · ' + S.currentBlock,
    '📦 Volume : ' + Math.round(vol/1000*10)/10 + ' tonnes',
    dur ? '⏱ Durée : ' + dur + ' min' : '',
    prs.length ? '🏆 PR : ' + prs.map(e=>e.name).join(', ') : '',
    '',
    '💪 Exercices :',
    ...exercises.filter(e=>!e.isWarmup&&e.name).map(e=>`  • ${e.name}: ${e.weight}kg × ${e.repsAchieved||e.sets+'×'+e.reps}`),
    '',
    '🔗 Coach Tracker Pro — https://doncivo.github.io/coach-tracker-pro',
  ].filter(Boolean).join('\n');

  if (navigator.share) {
    navigator.share({ title: 'Ma séance — Coach Tracker Pro', text }).catch(() => _copyToClipboard(text));
  } else {
    _copyToClipboard(text);
    showToast('📋 Résumé copié dans le presse-papier !', 'save', 3000);
  }
}

function _copyToClipboard(text) {
  if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
  else { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
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
}


/* ══ NOTIFICATIONS ══ */
async function requestNotifPermission() {
  if (!('Notification' in window)) { showToast('Notifications non supportées sur ce navigateur', 'warn'); return false; }
  const perm = await Notification.requestPermission();
  if (perm === 'granted') { showToast('✅ Notifications activées !', 'save'); return true; }
  else { showToast('Notifications refusées', 'warn'); return false; }
}

function sendLocalNotif(title, body, icon) {
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: icon || './icons/icon-192.png', badge: './icons/favicon-32.png' });
  }
}

function scheduleRestNotif(seconds) {
  if (Notification.permission === 'granted') {
    setTimeout(() => sendLocalNotif('⏰ Repos terminé !', 'Prêt pour la série suivante ?'), seconds * 1000);
  }
}


function renderSettings() {
  const wrap = document.getElementById('settings-wrap');
  if (!wrap) return;
  wrap.innerHTML = '';

  // ── PROFIL ──
  const profSec = _settingsSection('👤 Profil');
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
  const notifSec = _settingsSection('🔔 Notifications');
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
  const dataSec = _settingsSection('💾 Données');
  _settingsRow(dataSec, 'Exporter mes données', 'Fichier JSON de sauvegarde complet', () => {
    const btn = document.createElement('button'); btn.className='btn btn-ghost btn-sm';
    btn.textContent='⬇ Exporter'; btn.addEventListener('click', () => document.getElementById('export-btn')?.click());
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

function _settingsSection(title) {
  const sec = document.createElement('div'); sec.className = 'settings-section';
  const t = document.createElement('div'); t.className = 'settings-section-title'; t.textContent = title;
  sec.appendChild(t); return sec;
}

function _settingsRow(section, label, sub, controlFn) {
  const row = document.createElement('div'); row.className = 'settings-row';
  const lbl = document.createElement('div');
  const lb = document.createElement('div'); lb.className = 'settings-row-label'; lb.textContent = label;
  lbl.appendChild(lb);
  if (sub) { const sb = document.createElement('div'); sb.className = 'settings-row-sub'; sb.textContent = sub; lbl.appendChild(sb); }
  row.appendChild(lbl);
  const ctrl = controlFn();
  if (ctrl) { const cw = document.createElement('div'); cw.className = 'settings-row-control'; cw.appendChild(ctrl); row.appendChild(cw); }
  section.appendChild(row);
}

function switchTab(tabName) {
  // Deactivate all panes
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.bnav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.bnav-more-btn').forEach(b => b.classList.remove('active'));
  // Activate target pane
  const pane = document.getElementById('tab-' + tabName);
  if (pane) pane.classList.add('active');
  // Sync top tab
  const topBtn = document.querySelector('.tab-btn[data-tab="' + tabName + '"]');
  if (topBtn) topBtn.classList.add('active');
  // Sync bottom nav — main items
  const bnavBtn = document.querySelector('.bnav-btn[data-tab="' + tabName + '"]');
  if (bnavBtn) {
    bnavBtn.classList.add('active');
  } else {
    // It's in the "More" drawer
    const moreBtn = document.querySelector('.bnav-more-btn[data-tab="' + tabName + '"]');
    if (moreBtn) moreBtn.classList.add('active');
    document.getElementById('bnav-more-btn').classList.add('active');
  }
  // Close more menu
  const mm = document.getElementById('bnav-more-menu');
  if (mm) { mm.classList.remove('open'); }
  const mb = document.getElementById('bnav-more-btn');
  if (mb) mb.setAttribute('aria-expanded','false');
  // Render content
  if(tabName==='dashboard')renderDashboard();
  if(tabName==='weekly'){renderDayTabs();renderDayDetail(S.activeDay||0);}
  if(tabName==='monthly')renderCalendar();
  if(tabName==='session')renderSession();
  if(tabName==='progression')renderProgression();
  if(tabName==='bilan')renderBilan();
  if(tabName==='corps'){
    // Activate nutrition section by default
    document.querySelectorAll('.corps-subbtn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.corps-section').forEach(s => s.classList.remove('active'));
    const nutritionBtn = document.querySelector('.corps-subbtn[data-corps="nutrition"]');
    const nutritionSect = document.getElementById('corps-sect-nutrition');
    if(nutritionBtn) nutritionBtn.classList.add('active');
    if(nutritionSect) nutritionSect.classList.add('active');
    initCorpsSubNav();
    renderCalTracker();
    renderCorps();
  }
  if(tabName==='kpi')renderKPI();
  if(tabName==='achievements')renderAchievements();
  if(tabName==='library')renderLibrary();if(tabName==='settings')renderSettings();
  // Store current tab
  S._currentTab = tabName;
}

// Wire top tabs
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// Wire bottom nav main buttons
document.querySelectorAll('.bnav-btn[data-tab]').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// Wire "More" button
document.getElementById('bnav-more-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  const menu = document.getElementById('bnav-more-menu');
  const btn  = document.getElementById('bnav-more-btn');
  const open = menu.classList.toggle('open');
  btn.setAttribute('aria-expanded', open ? 'true' : 'false');
});

// Wire "More" drawer items
document.querySelectorAll('.bnav-more-btn[data-tab]').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// Close more menu on outside click
document.addEventListener('click', () => {
  const mm = document.getElementById('bnav-more-menu');
  if (mm) mm.classList.remove('open');
  const mb = document.getElementById('bnav-more-btn');
  if (mb) mb.setAttribute('aria-expanded','false');
});

// ── Swipe gesture between tabs ────────────────────────────────
const TAB_ORDER = ['dashboard','weekly','session','progression','corps','bilan','kpi','achievements','library','monthly','settings'];
/* _swipeStartX — déclaré dans constants.js */
document.addEventListener('touchstart', e => {
  _swipeStartX = e.touches[0].clientX;
  _swipeStartY = e.touches[0].clientY;
  _swipeActive = true;
}, { passive: true });
document.addEventListener('touchmove', e => {
  if (!_swipeActive) return;
  const dx = e.touches[0].clientX - _swipeStartX;
  const dy = e.touches[0].clientY - _swipeStartY;
  // Cancel if vertical scroll dominates
  if (Math.abs(dy) > Math.abs(dx)) _swipeActive = false;
}, { passive: true });
document.addEventListener('touchend', e => {
  if (!_swipeActive) return;
  _swipeActive = false;
  const dx = e.changedTouches[0].clientX - _swipeStartX;
  const dy = Math.abs(e.changedTouches[0].clientY - _swipeStartY);
  // Only horizontal swipe > 60px with small vertical component
  if (Math.abs(dx) < 60 || dy > 50) return;
  const cur = S._currentTab || 'weekly';
  const idx = TAB_ORDER.indexOf(cur);
  if (dx < 0 && idx < TAB_ORDER.length - 1) switchTab(TAB_ORDER[idx + 1]); // swipe left → next
  if (dx > 0 && idx > 0) switchTab(TAB_ORDER[idx - 1]); // swipe right → prev
});

/* ══ MUSCLE PICKER ══ */
function applySlotColor(sel,val){const m=MM[val];if(m){sel.style.background=m.calBg;sel.style.color=m.calColor;sel.style.borderColor=m.calColor;sel.classList.add('filled');}else{sel.style.background='var(--surface)';sel.style.color='var(--text)';sel.style.borderColor='var(--border)';sel.classList.remove('filled');}}
function syncMuscles(di){const d=S.days[di];const seen=[];d.exercises.filter(e=>!e.isWarmup).forEach(ex=>{if(ex.muscle&&!seen.includes(ex.muscle))seen.push(ex.muscle);});const ns=['','',''];seen.slice(0,3).forEach((k,i)=>ns[i]=k);S.days[di].muscles=ns;const el=document.getElementById('mpicker-'+di);if(el)el.querySelectorAll('.muscle-slot-sel').forEach((s,i)=>{s.value=ns[i];applySlotColor(s,ns[i]);});renderDayTabs();save();}
function buildMusclePicker(di){
  const d=S.days[di];if(!Array.isArray(d.muscles))d.muscles=['','',''];while(d.muscles.length<3)d.muscles.push('');
  const wrap=document.createElement('div');wrap.className='muscle-slots';wrap.id='mpicker-'+di;
  const hr=document.createElement('div');hr.style.cssText='display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px';
  const lb=document.createElement('div');lb.style.cssText='font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted)';lb.textContent='Groupes musculaires';
  const ht=document.createElement('span');ht.style.cssText='font-size:7px;color:var(--muted);font-style:italic';ht.textContent='auto-sync';
  hr.appendChild(lb);hr.appendChild(ht);wrap.appendChild(hr);
  const row=document.createElement('div');row.className='muscle-slots-row';
  ['G1','G2','G3'].forEach((lbT,slot)=>{
    const g=document.createElement('div');g.className='muscle-slot';
    const l=document.createElement('div');l.className='muscle-slot-lbl';l.textContent=lbT;g.appendChild(l);
    const sel=document.createElement('select');sel.className='muscle-slot-sel';
    const no=document.createElement('option');no.value='';no.textContent='— Aucun —';sel.appendChild(no);
    MUSCLES.forEach(m=>{const o=document.createElement('option');o.value=m.key;o.textContent=m.label;if(m.key===d.muscles[slot])o.selected=true;sel.appendChild(o);});
    applySlotColor(sel,d.muscles[slot]);
    sel.addEventListener('change',e=>{S.days[di].muscles[slot]=e.target.value;applySlotColor(sel,e.target.value);save();renderDayTabs();});
    g.appendChild(sel);row.appendChild(g);
  });
  wrap.appendChild(row);return wrap;
}

/* ══ DAY TABS ══ */


// ╔══════════════════════════════════════════════════════╗
// ║  DATA COMPUTE HELPERS — cross-tab analytics          ║
// ╚══════════════════════════════════════════════════════╝

// Get last N days as 'YYYY-MM-DD' strings
function lastNDays(n){ return Array.from({length:n},(_,i)=>{ const d=new Date(); d.setDate(d.getDate()-(n-1-i)); return localDateStr(d); }); }

// Weekly volume (kg) from history
function computeWeeklyVolume(weeks=8){
  const today=new Date();
  return Array.from({length:weeks},(_,wi)=>{
    const weekStart=new Date(today); weekStart.setDate(today.getDate()-7*(weeks-1-wi)-today.getDay());
    let vol=0;
    for(let d=0;d<7;d++){
      const date=new Date(weekStart); date.setDate(weekStart.getDate()+d);
      const key=localDateStr(date);
      const hDay=S.history[key];
      if(!hDay) continue;
      const hDayArr=Array.isArray(hDay)?hDay:(hDay.days||[]);
      hDayArr.forEach(ex=>{ if(ex.sets) ex.sets.forEach(set=>{ vol+=(parseFloat(set.weight)||0)*(parseInt(set.reps)||0); }); });
    }
    return {label:`S${wi+1}`,value:vol};
  });
}

// Daily steps for last N days
function computeDailySteps(n=14){
  return lastNDays(n).map(d=>({ x:d, y:parseInt(S.steps&&S.steps[d]||0)||0 }));
}

// Daily calories for last N days
function computeDailyCalories(n=14){
  return lastNDays(n).map(d=>{
    const c=S.calories&&S.calories[d];
    let total=0;
    if(c&&c.meals) c.meals.forEach(m=>(m.items||[]).forEach(it=>total+=parseFloat(it.kcal)||0));
    return {x:d, y:total};
  });
}

// Daily sleep for last N days
function computeDailySleep(n=14){
  return lastNDays(n).map(d=>({ x:d, y:parseFloat(S.sleep&&S.sleep[d]&&(S.sleep[d].hours||S.sleep[d].h)||0)||0 }));
}

// Body weight from mesures history
function computeWeightHistory(){
  const wh=S.history&&Object.entries(S.history)
    .filter(([,v])=>v&&v[0]&&v[0].poids!=null)
    .sort(([a],[b])=>a.localeCompare(b));
  if(!wh||!wh.length){
    // Fallback: use mesures entries if weight stored there
    return [];
  }
  return wh.map(([d,v])=>({x:d,y:parseFloat(v[0].poids)||0}));
}

// ATL/CTL over time (fatigue / fitness)
function computeATLCTL(days=42){
  const dates=lastNDays(days);
  let atl=50,ctl=50;
  const atlDecay=1-1/7, ctlDecay=1-1/42;
  return dates.map(d=>{
    const hDay=S.history[d];
    let load=0;
    if(hDay){const hDayArr=Array.isArray(hDay)?hDay:(hDay.days||[]);hDayArr.forEach(ex=>{ if(ex.sets) ex.sets.forEach(s=>{ load+=(parseFloat(s.weight)||0)*(parseInt(s.reps)||0)/1000; }); });}
    atl = atl*atlDecay + load*(1-atlDecay)*10;
    ctl = ctl*ctlDecay + load*(1-ctlDecay)*10;
    return {x:d, atl:Math.round(atl), ctl:Math.round(ctl), tsb:Math.round(ctl-atl)};
  });
}

// Correlation: sleep hours vs session volume
function computeSleepPerfCorrelation(){
  const pts=[];
  Object.keys(S.history||{}).forEach(d=>{
    const sleepH=parseFloat(S.sleep&&S.sleep[d]&&(S.sleep[d].hours||S.sleep[d].h)||0)||0;
    const hDay=S.history[d];
    let vol=0;
    if(hDay){const hDayArr=Array.isArray(hDay)?hDay:(hDay.days||[]);hDayArr.forEach(ex=>{ if(ex.sets) ex.sets.forEach(s=>{ vol+=(parseFloat(s.weight)||0)*(parseInt(s.reps)||0); }); });}
    if(sleepH>0&&vol>0) pts.push({x:sleepH,y:vol,color:'--teal'});
  });
  return pts;
}

// Global fitness score (0-100)
function computeFitnessScore(){
  const today=localDateStr(new Date());
  const days7=lastNDays(7);

  // Adherence (% séances complétées sur 7j)
  const plannedDays=S.days.filter(d=>d.exercises&&d.exercises.length>0).length;
  const trainedDays=days7.filter(d=>S.history&&S.history[d]&&S.history[d].length>0).length;
  const adherence=plannedDays>0?Math.min(100,trainedDays/plannedDays*100):50;

  // Steps (% vs goal)
  const stepsGoal=S.stepsGoal||10000;
  const avgSteps=days7.reduce((a,d)=>a+(parseInt(S.steps&&S.steps[d]||0)||0),0)/7;
  const stepsScore=Math.min(100,avgSteps/stepsGoal*100);

  // Sleep (7-8h = 100%)
  const avgSleep=days7.reduce((a,d)=>a+(parseFloat(S.sleep&&S.sleep[d]&&(S.sleep[d].hours||S.sleep[d].h)||0)||0),0)/7;
  const sleepScore=avgSleep===0?50:Math.min(100,avgSleep/7.5*100);

  // Nutrition (calories vs goal ±20%)
  const calGoal=S.caloriesGoal||2500;
  const avgCals=computeDailyCalories(7).map(p=>p.y);
  const avgCal=avgCals.reduce((a,v)=>a+v,0)/7;
  const calDiff=Math.abs(avgCal-calGoal)/calGoal;
  const nutScore=avgCal===0?50:Math.max(0,100-calDiff*200);

  // Recovery (based on pain log + sessRecovery)
  const painPenalty=(S.painLog||[]).filter(p=>{ const d=new Date(p.date); const dif=(Date.now()-d)/(86400000); return dif<7; }).length*10;
  const recoverySessions=days7.map(d=>S.sessRecovery&&S.sessRecovery[d]||0).filter(v=>v>0);
  const avgRec=recoverySessions.length?recoverySessions.reduce((a,v)=>a+v,0)/recoverySessions.length:70;
  // Blend with sleep quality for a richer recovery score
  const avgSleepForRec=days7.map(d=>parseFloat(S.sleep&&S.sleep[d]&&(S.sleep[d].hours||S.sleep[d].h)||0)||0).filter(v=>v>0);
  const sleepBonus=avgSleepForRec.length?(avgSleepForRec.reduce((a,v)=>a+v,0)/avgSleepForRec.length>=7?10:avgSleepForRec.reduce((a,v)=>a+v,0)/avgSleepForRec.length>=6?0:-10):0;
  const recovScore=Math.max(0,Math.min(100,avgRec+sleepBonus-painPenalty));

  const score=Math.round((adherence*.3+stepsScore*.2+sleepScore*.2+nutScore*.15+recovScore*.15));
  return {
    score:Math.min(100,score),
    breakdown:[
      {icon:'💪',label:'Assiduité',pts:Math.round(adherence),max:100,color:'--teal'},
      {icon:'👣',label:'Pas',pts:Math.round(stepsScore),max:100,color:'--green'},
      {icon:'😴',label:'Sommeil',pts:Math.round(sleepScore),max:100,color:'--purple'},
      {icon:'🥗',label:'Nutrition',pts:Math.round(nutScore),max:100,color:'--orange'},
      {icon:'🔋',label:'Récup.',pts:Math.round(recovScore),max:100,color:'--red'},
    ]
  };
}

// TDEE calculation (Mifflin-St Jeor)
function computeTDEE(){
  const poids=parseFloat(S.mesures&&S.mesures.poids)||70;
  const taille=parseFloat(S.profilTaille)||175;
  const age=35; // default (could add to profile)
  // Assume male for now (could add gender to profile)
  const bmr=10*poids+6.25*taille-5*age+5;
  // Activity multiplier based on weekly sessions
  const weeks7=lastNDays(7);
  const sessions=weeks7.filter(d=>S.history&&S.history[d]&&S.history[d].length>0).length;
  const mult=sessions>=5?1.725:sessions>=3?1.55:sessions>=1?1.375:1.2;
  return {tdee:Math.round(bmr*mult),bmr:Math.round(bmr),mult,sessions};
}

// Push/Pull/Legs repartition from history (all time)
function computePPL(){
  const push=['développé','press','poussé','overhead','dips','triceps','écarté'];
  const pull=['traction','curl','row','rowing','biceps','soulevé','deadlift','tirage'];
  let P=0,Pu=0,L=0,Other=0;
  Object.values(S.history||{}).forEach(day=>{
    (day||[]).forEach(ex=>{
      const n=(ex.name||'').toLowerCase();
      if(push.some(k=>n.includes(k))) P++;
      else if(pull.some(k=>n.includes(k))) Pu++;
      else if(n.includes('squat')||n.includes('cuisse')||n.includes('fente')||n.includes('leg')) L++;
      else Other++;
    });
  });
  return [{label:'Push',value:P,color:'--teal'},{label:'Pull',value:Pu,color:'--green'},{label:'Legs',value:L,color:'--orange'},{label:'Autre',value:Other,color:'--muted'}];
}

// Douleurs actives (last 14j)
function activePains(){
  return (S.painLog||[]).filter(p=>{ const d=new Date(p.date||p.ts||Date.now()); return (Date.now()-d)/86400000<14; });
}

// ╔══════════════════════════════════════════════════════╗
// ║  CHART ENGINE — reusable canvas charts               ║
// ╚══════════════════════════════════════════════════════╝
