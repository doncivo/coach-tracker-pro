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

/* ══ HELPERS ══ */
function getDM(d){const s=new Set((d.muscles||[]).filter(Boolean));(d.exercises||[]).forEach(ex=>{if(ex.muscle)s.add(ex.muscle);});return MK.filter(k=>s.has(k));}
// Helper: resolve exercise lookup key (prefer id, fallback name)
function lastW(ex){
  if(typeof ex==='object') return exHist(exKey(ex)).slice(-1)[0]?.weight||'';
  return exHist(ex).slice(-1)[0]?.weight||''; // backward compat with string
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

// TDEE calculation (Mifflin-St Jeor)

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
