/* ═══════════════════════════════════════
   utils.js — Utilitaires transversaux
   Dépend de: constants.js, state.js
═══════════════════════════════════════ */


function undoAction() {
  try {
    const stack = JSON.parse(localStorage.getItem('ctp_undo') || '[]');
    if (!stack.length) return showToast('Rien à annuler', 'warn');
    const prev = JSON.parse(stack.pop());
    localStorage.setItem('ctp_undo', JSON.stringify(stack));
    S.days = prev.days; S.history = prev.history;
    save(true);
    renderDayTabs(); renderDayDetail(S.activeDay);
    showToast('↩ Action annulée', 'save');
  } catch(e) {
    showToast('Annulation impossible', 'error');
  }
}

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
let _searchOpen = false;

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


/* renderABCompare défini dans module précédent */


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


/* renderSettings défini dans module précédent */

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
let _swipeStartX = 0, _swipeStartY = 0, _swipeActive = false;
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
/* computeWeeklyVolume défini dans module précédent */

// Daily steps for last N days
/* computeDailySteps défini dans module précédent */

// Daily calories for last N days
/* computeDailyCalories défini dans module précédent */

// Daily sleep for last N days
/* computeDailySleep défini dans module précédent */

// Body weight from mesures history
/* computeWeightHistory défini dans module précédent */

// ATL/CTL over time (fatigue / fitness)
/* computeATLCTL défini dans module précédent */

// Correlation: sleep hours vs session volume
/* computeSleepPerfCorrelation défini dans module précédent */

// Global fitness score (0-100)
/* computeFitnessScore défini dans module précédent */

// TDEE calculation (Mifflin-St Jeor)
/* computeTDEE défini dans module précédent */

// Push/Pull/Legs repartition from history (all time)
/* computePPL défini dans module précédent */

// Douleurs actives (last 14j)
function activePains(){
  return (S.painLog||[]).filter(p=>{ const d=new Date(p.date||p.ts||Date.now()); return (Date.now()-d)/86400000<14; });
}

// ╔══════════════════════════════════════════════════════╗
// ║  CHART ENGINE — reusable canvas charts               ║
// ╚══════════════════════════════════════════════════════╝



function updateStats(){
  let done=0,total=0,active=0;
  S.days.forEach(d=>{const exs=d.exercises.filter(e=>e.name.trim()&&!e.isWarmup);total+=exs.length;done+=exs.filter(e=>e.done).length;if(getDMS(d).some(k=>k&&k!=='rep'))active++;});
  const setEl=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  setEl('stat-done',done);setEl('stat-total',total);setEl('stat-days',active);setEl('stat-pct',total>0?Math.round(done/total*100)+'%':'0%');
  const vol=weekVol();const maxV=Math.max(...Object.values(vol),1);
  const vd=document.getElementById('vol-bars');
  if(vd){vd.innerHTML='';Object.entries(vol).sort((a,b)=>b[1]-a[1]).forEach(([k,vv])=>{const m=MM[k];if(!m)return;const row=document.createElement('div');row.className='vol-row';const lb=document.createElement('div');lb.className='vol-label';lb.textContent=m.label;lb.title=m.label;const bar=document.createElement('div');bar.className='bar-wrap';const fill=document.createElement('div');fill.className='bar-fill';fill.style.cssText=`width:${Math.round(vv/maxV*100)}%;background:${m.calColor}`;bar.appendChild(fill);const num=document.createElement('div');num.className='vol-num';num.textContent=Math.round(vv/1000*10)/10+'t';row.appendChild(lb);row.appendChild(bar);row.appendChild(num);vd.appendChild(row);});}
  // Push/Pull
  const pp=pushPull();const ppd=document.getElementById('push-pull-ratio');
  if(ppd){ppd.innerHTML='';const tot=pp.push+pp.pull||1;const ppPct=Math.round(pp.push/tot*100),plPct=100-ppPct;const balanced=Math.abs(ppPct-50)<15;const row=document.createElement('div');row.className='vol-row';const lb=document.createElement('div');lb.className='vol-label';lb.textContent='Push/Pull';const dual=document.createElement('div');dual.style.cssText='flex:1;display:flex;height:6px;border-radius:3px;overflow:hidden';const p1=document.createElement('div');p1.style.cssText=`width:${ppPct}%;background:#ffe0ea`;const p2=document.createElement('div');p2.style.cssText=`width:${plPct}%;background:#e0d8ff`;dual.appendChild(p1);dual.appendChild(p2);const val=document.createElement('div');val.style.cssText='font-size:8px;font-family:var(--mono);color:var(--muted);width:36px;text-align:right';val.textContent=ppPct+'/'+plPct;row.appendChild(lb);row.appendChild(dual);row.appendChild(val);ppd.appendChild(row);const ok=document.createElement('div');ok.style.cssText=`font-size:9px;margin-top:3px;font-weight:600;color:${balanced?'var(--green)':'var(--red)'}`;ok.textContent=balanced?'✅ Équilibré':'⚠️ Déséquilibré';ppd.appendChild(ok);}
  // PR panel
  const prp=document.getElementById('pr-panel');
  if(prp){
    const prs=S.days.flatMap(d=>d.exercises).filter(checkPR);
    prp.innerHTML='';
    if(!prs.length){prp.innerHTML='<span style="color:var(--muted)">—</span>';}
    else{prs.forEach(e=>{const row=document.createElement('div');row.style.cssText='display:flex;align-items:center;gap:5px;padding:2px 0;border-bottom:1px solid var(--border);font-size:10px';const ico=document.createElement('span');ico.textContent='🏆';const nm=document.createElement('span');nm.style.cssText='flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';nm.textContent=e.name;row.appendChild(ico);row.appendChild(nm);prp.appendChild(row);});}
  }
  // Alerts panel
  renderAlertsPanel();

  // Update header fitness score badge
  try{
    const fsEl = document.getElementById('hdr-fitness-score');
    if(fsEl){
      const fs = computeFitnessScore();
      const color = fs.score>=80?'#4CAF50':fs.score>=60?'var(--teal)':fs.score>=40?'var(--orange)':'var(--red)';
      fsEl.textContent = '⚡ '+fs.score;
      fsEl.style.background = color;
    }
  }catch(e){}

}

function updateChronoDsp(){
  ['chrono-display','focus-chrono-time'].forEach(id=>{const el=document.getElementById(id);if(!el)return;const m=Math.floor(_cs/60),s=_cs%60;el.textContent=m+':'+(s<10?'0':'')+s;el.className=el.className.replace(/warning|done-clr|pulsing/g,'').trim();if(_ct>0){const rem=_ct-_cs;if(rem<=10&&rem>0)el.className+=' warning';if(rem<=0)el.className+=' done-clr';}});
}

function resetChrono(){pauseChrono();_cs=0;_ct=0;updateChronoDsp();document.querySelectorAll('.rp-act').forEach(b=>b.classList.remove('rp-act'));}

function startChrono(){
  if(_cr)return;_cr=true;
  _ci=setInterval(()=>{_cs++;updateChronoDsp();
    if(_ct>0&&_cs>=_ct){clearInterval(_ci);_cr=false;document.getElementById('chrono-start').textContent='▶';
      ['chrono-display','focus-chrono-time'].forEach(id=>{const el=document.getElementById(id);if(el)el.className+=' pulsing';});
      // Flash screen
      document.body.style.boxShadow='inset 0 0 0 4px var(--green)';setTimeout(()=>document.body.style.boxShadow='',600);
      navigator.vibrate&&navigator.vibrate([200,100,200,100,200]);
      // Scroll to next exercise
      const next=document.querySelector('.sess-nav-item:not(.done-nav)');if(next)next.scrollIntoView({behavior:'smooth',block:'nearest'});
    }
  },1000);
  document.getElementById('chrono-start').textContent='⏸';
}

function cancelTrainingReminder() {
  if (window._reminderTimeout) clearTimeout(window._reminderTimeout);
  S._reminderHour = null; S._reminderMinute = null;
  save();
  showToast('🔕 Rappel annulé', 'warn', 2000);
}

function pauseChrono(){clearInterval(_ci);_cr=false;document.getElementById('chrono-start').textContent='▶';}