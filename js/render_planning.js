/* ============================================================
   render_planning.js — Page Planning (Tabs + Detail + Stats + Goals)
============================================================ */

function renderDayTabs(){
  const nav=document.getElementById('day-tabs');nav.innerHTML='';
  for(let i=0;i<7;i++){
    const d=S.days[i];const total=d.exercises.filter(e=>e.name.trim()&&!e.isWarmup).length;
    const done=d.exercises.filter(e=>e.done&&e.name.trim()&&!e.isWarmup).length;
    const pct=total>0?Math.round(done/total*100):0;const muscles=getDM(d);
    const tab=document.createElement('div');tab.className='day-tab'+(S.activeDay===i?' active':'');tab.setAttribute('data-d',i);
    const dateDisp=d.date?new Date(d.date+'T00:00').toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'}):'';
    const tagsHtml=muscles.length?muscles.map(k=>{const m=MM[k];return`<span class="dt-mtag" style="background:${m.calBg};color:${m.calColor}">${m.label.split(' ')[0]}</span>`;}).join(''):'<span class="dt-mtag" style="opacity:.3">—</span>';
    const st=total===0?'':(pct===100?'✅':pct>0?'🔄':'⬜');
    // Pain alert on worked muscles
    const dayMuscleKeys=getDM(d);
    const recentPains=activePains();
    const painOnDay=recentPains.some(p=>{
      const pz=(p.zone||'').toLowerCase();
      return dayMuscleKeys.some(mk=>MM[mk]&&MM[mk].label.toLowerCase().split(' ').some(w=>pz.includes(w)));
    });
    tab.innerHTML=`<span class="dt-name">${DAYS_SH[i]}</span>${dateDisp?`<span class="dt-date">${dateDisp}</span>`:''}<div class="dt-muscles">${tagsHtml}</div><div class="dt-prog"><div class="dt-prog-bar" style="width:${pct}%"></div></div><span class="dt-status">${st}</span>${painOnDay?'<span title="Douleur signalée sur ce groupe musculaire" style="font-size:11px">⚠️</span>':''}`;
    tab.addEventListener('click',()=>{S.activeDay=i;renderDayTabs();renderDayDetail(i);});
    nav.appendChild(tab);
  }
  _renderWeekHeatmap();
}

/* ── Heatmap musculaire hebdomadaire ── */
function _renderWeekHeatmap() {
  const wrap = document.getElementById('week-heatmap');
  if (!wrap) return;
  wrap.innerHTML = '';

  // Groupes musculaires pertinents (hors repos, mobilité, cardio)
  const groups = [
    { keys: ['pec','ep','tri'], label: 'Push',  color: '#c0506a' },
    { keys: ['dos','bic'],      label: 'Pull',  color: '#6050b0' },
    { keys: ['jam'],            label: 'Legs',  color: '#3a9060' },
    { keys: ['abd','bas'],      label: 'Core',  color: '#904090' },
    { keys: ['car'],            label: 'Cardio',color: '#b07800' },
  ];

  // Calculer le volume par groupe et par jour
  const volByDayGroup = S.days.map(d => {
    const result = {};
    groups.forEach(g => {
      const vol = (d.exercises || [])
        .filter(e => !e.isWarmup && g.keys.includes(e.muscle))
        .reduce((sum, e) => sum + (parseFloat(e.weight)||0) * (parseInt(e.sets)||0) * (parseInt(e.reps)||1), 0);
      result[g.label] = vol;
    });
    return result;
  });

  const maxVol = Math.max(...volByDayGroup.flatMap(d => Object.values(d)), 1);

  const grid = document.createElement('div');
  grid.className = 'week-heatmap';

  // En-tête : jours
  const headerRow = document.createElement('div');
  headerRow.className = 'whm-row whm-header';
  const corner = document.createElement('div'); corner.className = 'whm-label'; corner.textContent = '';
  headerRow.appendChild(corner);
  S.days.forEach((d, i) => {
    const cell = document.createElement('div');
    cell.className = 'whm-day-lbl' + (i === S.activeDay ? ' whm-active' : '');
    cell.textContent = ['L','M','M','J','V','S','D'][i];
    cell.ontouchstart = (e) => { e.preventDefault(); S.activeDay=i; renderDayTabs(); renderDayDetail(i); };
    cell.onclick = () => { S.activeDay=i; renderDayTabs(); renderDayDetail(i); };
    headerRow.appendChild(cell);
  });
  grid.appendChild(headerRow);

  // Lignes : groupes musculaires
  groups.forEach(g => {
    const row = document.createElement('div');
    row.className = 'whm-row';

    const lbl = document.createElement('div');
    lbl.className = 'whm-label'; lbl.textContent = g.label;
    lbl.style.color = g.color;
    row.appendChild(lbl);

    S.days.forEach((d, i) => {
      const vol = volByDayGroup[i][g.label] || 0;
      const pct = Math.min(1, vol / maxVol);
      const cell = document.createElement('div');
      cell.className = 'whm-cell' + (i === S.activeDay ? ' whm-active' : '');
      if (vol > 0) {
        const alpha = 0.15 + pct * 0.85;
        cell.style.background = g.color;
        cell.style.opacity = alpha.toFixed(2);
        cell.title = g.label + ' ' + DAYS_SH[i] + ' : ' + Math.round(vol) + 'kg';
      }
      cell.ontouchstart = (e) => { e.preventDefault(); S.activeDay=i; renderDayTabs(); renderDayDetail(i); };
      cell.onclick = () => { S.activeDay=i; renderDayTabs(); renderDayDetail(i); };
      row.appendChild(cell);
    });
    grid.appendChild(row);
  });

  wrap.appendChild(grid);
}

/* ── Copier un jour depuis la semaine précédente ── */
function _copyDayFromHistory(dayIndex) {
  // Trouver la semaine archivée la plus récente
  const histKeys = Object.keys(S.history || {}).sort();
  if (!histKeys.length) {
    showToast('Aucun historique disponible', 'warn', 2500);
    return;
  }

  const lastKey  = histKeys[histKeys.length - 1];
  const lastWeek = S.history[lastKey];
  const srcDay   = lastWeek?.days?.[dayIndex];

  if (!srcDay || !(srcDay.exercises || []).filter(e => e.name?.trim()).length) {
    showToast('Aucun exercice à copier (sem. ' + lastKey + ')', 'warn', 3000);
    return;
  }

  // Copier les exercices sans marquer comme faits
  const copied = (srcDay.exercises || []).map(e => ({
    id:            uid(),
    name:          e.name || '',
    muscle:        e.muscle || '',
    weight:        e.weight || '',
    sets:          e.sets || '',
    reps:          e.reps || '',
    repsAchieved:  '',
    rpe:           e.rpe || '',
    rir:           e.rir || '',
    tempo:         e.tempo || '',
    rest:          e.rest || '',
    note:          e.note || '',
    done:          false,
    isWarmup:      e.isWarmup || false,
    supersetGroup: e.supersetGroup || '',
    setData:       null,
  }));

  save(); // snapshot avant modification
  Store.dispatch({
    type:    'TRAINING_UPDATE_DAY',
    payload: { dayIndex, changes: { exercises: copied } },
  });
  save(true);
  renderDayTabs();
  renderDayDetail(S.activeDay);
  showToast('📋 ' + DAYS[dayIndex] + ' copié depuis ' + lastKey, 'save', 2500);
}


/* _exView — déclaré dans constants.js */
function renderDayDetail(i){
  const detail=document.getElementById('day-detail');const d=S.days[i];
  detail.innerHTML='';detail.style.animation='none';void detail.offsetHeight;detail.style.animation='';

  // Header
  const hdr=document.createElement('div');hdr.className='day-hdr-card';hdr.style.background=DAY_BG[i]; hdr.style.border='2px solid '+DAY_COL[i]+'40';
  const left=document.createElement('div');left.className='dhc-left';
  const dn=document.createElement('div');dn.className='dhc-dayname';dn.style.color=DAY_COL[i];
  dn.textContent=DAYS[i]+' — Sem. '+S.weekType+' · '+S.currentBlock;
  left.appendChild(dn);
  const dr=document.createElement('div');dr.className='dhc-row';
  const dl=document.createElement('span');dl.style.cssText='font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)';dl.textContent='Date :';
  const di2=document.createElement('input');di2.type='date';di2.className='inp';di2.style.cssText='font-family:var(--mono);font-size:10px;width:130px';di2.value=d.date||'';
  di2.addEventListener('change',e=>{S.days[i].date=e.target.value;save();renderDayTabs();});
  dr.appendChild(dl);dr.appendChild(di2);left.appendChild(dr);
  left.appendChild(buildMusclePicker(i));
  hdr.appendChild(left);
  const ra=document.createElement('div');ra.className='dhc-actions';
  const lb=document.createElement('button');lb.className='btn btn-teal btn-sm';lb.textContent='⚡ Séance';
  lb.addEventListener('click',()=>{S.sessDay=i;renderSession();document.querySelector('[data-tab="session"]').click();});

  // Copier depuis la semaine précédente
  const cpBtn=document.createElement('button');cpBtn.className='btn btn-ghost btn-sm';cpBtn.textContent='📋';
  cpBtn.title='Copier depuis la semaine précédente';
  cpBtn.addEventListener('click',()=>_copyDayFromHistory(i));

  const rb=document.createElement('button');rb.className='btn btn-ghost btn-sm';rb.textContent='↺';
  rb.addEventListener('click',async()=>{
    const ok=await Modal.confirm('Réinitialiser '+DAYS[i]+' ?');
    if(!ok)return;
    save(); // snapshot BEFORE reset (for undo)
    Store.dispatch({type:"TRAINING_UPDATE_DAY",payload:{dayIndex:i,changes:mkDay(i,S.weekType)}});
    save(true); // skipUndo=true to avoid double snapshot
    renderDayTabs();renderDayDetail(i);
  });
  ra.appendChild(lb);ra.appendChild(cpBtn);ra.appendChild(rb);hdr.appendChild(ra);detail.appendChild(hdr);

  // Pain alerts for muscles planned today
  const todayPains=activePains();
  if(todayPains.length>0){
    const dayMuscles=(d.muscles||[]).concat((d.exercises||[]).map(e=>e.muscle).filter(Boolean));
    const relevantPains=todayPains.filter(p=>{
      const z=(p.zone||'').toLowerCase();
      return dayMuscles.some(m=>(m||'').toLowerCase().includes(z)||z.includes((m||'').toLowerCase()));
    });
    if(relevantPains.length>0){
      const painAlert=document.createElement('div');
      painAlert.style.cssText='background:var(--red);color:#fff;border-radius:var(--rs);padding:10px 14px;font-size:12px;display:flex;align-items:center;gap:8px;cursor:pointer;margin-bottom:4px';
      painAlert.innerHTML='<span style="font-size:16px">⚠️</span><span><strong>Douleur signalée</strong> sur une zone prévue aujourd\'hui : '+relevantPains.map(p=>p.zone||'?').join(', ')+"<br><small>Considérez adapter l'exercice ou consulter votre praticien.</small></span>";
      painAlert.addEventListener('click',()=>switchTab('corps'));
      detail.appendChild(painAlert);
    }
  }

  // Warmup
  const ws=document.createElement('div');ws.className='card';
  ws.innerHTML='<div class="card-hdr"><div class="card-title">🔥 Échauffement</div></div>';
  const wb=document.createElement('div');wb.style.cssText='padding:7px 12px;background:rgba(255,200,50,.06)';
  const wt=document.createElement('textarea');wt.style.cssText='width:100%;border:none;background:transparent;font-family:var(--font);font-size:11px;color:#7a6020;outline:none;resize:none;line-height:1.5;min-height:30px';
  wt.placeholder="Protocole d échauffement...";wt.value=d.warmup||'';wt.rows=2;
  wt.addEventListener('input',e=>{S.days[i].warmup=e.target.value;_debouncedSave();});
  wb.appendChild(wt);ws.appendChild(wb);detail.appendChild(ws);

  // Exercises section
  const es=document.createElement('div');es.className='card';
  const eh=document.createElement('div');eh.className='card-hdr';
  const et=document.createElement('div');et.className='card-title';et.innerHTML='💪 Exercices';
  const eright=document.createElement('div');eright.style.cssText='display:flex;align-items:center;gap:6px';
  const em=document.createElement('span');em.style.cssText='font-size:10px;color:var(--muted)';em.id='ex-meta-'+i;
  const vt=document.createElement('div');vt.className='ex-view-toggle';
  const viewModes=[
    {val:'compact',lbl:'Compact',icon:'☰',tip:'Vue compacte — colonnes essentielles'},
    {val:'detail',lbl:'Détail',icon:'⊞',tip:'Vue détail — toutes les colonnes (RPE, Tempo, Note…)'},
    {val:'cards',lbl:'Cartes',icon:'📱',tip:'Vue cartes — optimisée mobile'},
  ];
  viewModes.forEach((mode,vi)=>{
    const vb=document.createElement('button');
    vb.className='ex-view-btn'+(_exView===mode.val?' active':'');
    vb.innerHTML=`${mode.icon} ${mode.lbl}`;
    vb.title=mode.tip;
    vb.setAttribute('aria-label',mode.tip);
    vb.addEventListener('click',()=>{
      S.exViewMode=mode.val;
      _exView=mode.val;
      save();
      // Rebuild ALL exercise tables to apply new view
      document.querySelectorAll('.ex-view-btn').forEach(b=>b.classList.remove('active'));
      document.querySelectorAll('.ex-view-btn').forEach(b=>{
        if(b.innerHTML.includes(mode.icon)) b.classList.add('active');
      });
      renderDayDetail(S.activeDay);
    });
    vt.appendChild(vb);
  });
  eright.appendChild(em);eright.appendChild(vt);

  // Bouton programme prédéfini
  if(typeof PROGRAMS!=='undefined'&&PROGRAMS.length){
    const progBtn=document.createElement('button');
    progBtn.className='btn btn-ghost btn-sm';
    progBtn.style.cssText='font-size:10px;padding:3px 8px;border:1px solid var(--border)';
    progBtn.textContent='📋 Programme';
    progBtn.title='Charger un programme prédéfini';
    progBtn.addEventListener('click',()=>_showProgramPicker());
    progBtn.ontouchstart=(e)=>{e.stopPropagation();};
    eright.appendChild(progBtn);
  }

  eh.appendChild(et);eh.appendChild(eright);es.appendChild(eh);
  const tw=document.createElement('div');tw.className='ex-table-wrap';
  const tb=document.createElement('table');tb.className='ex-table';tb.setAttribute('role','table');tb.setAttribute('aria-label','Exercices du jour');
  const tbody=document.createElement('tbody');tb.appendChild(tbody);tw.appendChild(tb);es.appendChild(tw);

  function updateExMeta(){
    const tot=d.exercises.filter(e=>e.name.trim()&&!e.isWarmup).length;
    const dn=d.exercises.filter(e=>e.done&&e.name.trim()&&!e.isWarmup).length;
    const vol=Object.values(dayVol(d)).reduce((a,b)=>a+b,0);
    em.textContent=`${dn}/${tot} · ${vol>0?Math.round(vol/1000*10)/10+'t':'—'}`;
    updateStats();checkAndAwardAchievements();
  }

  buildExTable(i,tbody,d,updateExMeta);

  const addBtn=document.createElement('button');addBtn.className='add-ex-btn';addBtn.textContent='+ Ajouter un exercice';
  addBtn.addEventListener('click',()=>{
    const def={id:uid(),name:'',muscle:getDMS(d)[0]||'',weight:'',sets:'',reps:'',rest:'',tempo:'',repsAchieved:'',rpe:'',rir:'',note:'',done:false,setData:null,isWarmup:false,supersetGroup:''};
    S.days[i].exercises.push(def);buildExTable(i,tbody,d,updateExMeta);updateExMeta();save();renderDayTabs();
  });
  es.appendChild(addBtn);
  // Add warmup set button
  const addWuBtn=document.createElement('button');addWuBtn.style.cssText='margin:0 8px 6px;border:1px dashed rgba(255,200,50,.5);background:rgba(255,200,50,.07);color:#7a6020;font-family:var(--font);font-size:10px;padding:4px 8px;border-radius:var(--rs);cursor:pointer';
  addWuBtn.textContent='+ Série échauffement';
  addWuBtn.addEventListener('click',()=>{
    const def={id:uid(),name:'',muscle:getDMS(d)[0]||'',weight:'',sets:'2',reps:'15',rest:'',tempo:'',repsAchieved:'',rpe:'',rir:'',note:'',done:false,setData:null,isWarmup:true,supersetGroup:''};
    S.days[i].exercises.unshift(def);buildExTable(i,tbody,d,updateExMeta);updateExMeta();save();renderDayTabs();
  });
  es.appendChild(addWuBtn);
  updateExMeta();detail.appendChild(es);

  // Cardio
  const cs=document.createElement('div');cs.className='card';cs.innerHTML='<div class="card-hdr"><div class="card-title">🏃 Cardio</div></div>';
  const cg=document.createElement('div');cg.style.cssText='display:grid;grid-template-columns:200px 76px 76px 76px;gap:6px;padding:9px 12px';
  const ctg=document.createElement('div');ctg.innerHTML='<label style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);display:block;margin-bottom:3px">Type</label>';
  const csel=document.createElement('select');csel.className='inp';csel.style.cssText='cursor:pointer;width:100%;font-size:10px';
  CARDIO_TYPES.forEach(t=>{const o=document.createElement('option');o.value=t;o.textContent=t;if(t===d.cardio.type)o.selected=true;csel.appendChild(o);});
  csel.addEventListener('change',e=>{S.days[i].cardio.type=e.target.value;save();});
  ctg.appendChild(csel);cg.appendChild(ctg);
  [{field:'duration',label:'Durée',ph:'min'},{field:'speed',label:'Vitesse',ph:'km/h'},{field:'distance',label:'Distance',ph:'km'}].forEach(({field,label,ph})=>{
    const g=document.createElement('div');g.innerHTML=`<label style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);display:block;margin-bottom:3px">${label}</label>`;
    const inp=document.createElement('input');inp.type='text';inp.className='inp';inp.placeholder=ph;inp.style.cssText='font-family:var(--mono);font-size:11px;text-align:center;width:100%';inp.value=d.cardio[field]||'';
    inp.addEventListener('input',e=>{S.days[i].cardio[field]=e.target.value;_debouncedSave();});
    g.appendChild(inp);cg.appendChild(g);
  });
  cs.appendChild(cg);detail.appendChild(cs);
}

/* ── Sélecteur de programme prédéfini ── */
function _showProgramPicker() {
  document.getElementById('prog-picker-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'prog-picker-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5);z-index:9100;display:flex;align-items:flex-end;justify-content:center';

  const sheet = document.createElement('div');
  sheet.style.cssText = 'background:var(--surface);border-radius:24px 24px 0 0;padding:20px 16px calc(20px + env(safe-area-inset-bottom,0px));width:100%;max-width:480px;max-height:80vh;overflow-y:auto;-webkit-overflow-scrolling:touch';

  const handle = document.createElement('div');
  handle.style.cssText = 'width:36px;height:4px;border-radius:2px;background:var(--border);margin:0 auto 16px';
  sheet.appendChild(handle);

  const title = document.createElement('div');
  title.style.cssText = 'font-size:16px;font-weight:700;color:var(--text);margin-bottom:4px';
  title.textContent = '📋 Charger un programme';
  const sub = document.createElement('div');
  sub.style.cssText = 'font-size:11px;color:var(--muted);margin-bottom:16px';
  sub.textContent = 'Remplace le planning de la semaine entière';
  sheet.appendChild(title); sheet.appendChild(sub);

  (PROGRAMS||[]).forEach(prog => {
    const btn = document.createElement('button');
    btn.style.cssText = 'display:flex;align-items:center;gap:12px;width:100%;text-align:left;padding:14px 16px;border-radius:14px;border:1.5px solid var(--border);background:var(--card);font-family:var(--font);cursor:pointer;touch-action:manipulation;-webkit-appearance:none;margin-bottom:8px';
    const icon = document.createElement('span'); icon.style.cssText = 'font-size:26px;flex-shrink:0'; icon.textContent = prog.icon||'💪';
    const info = document.createElement('div'); info.style.cssText = 'flex:1;min-width:0';
    info.innerHTML = '<div style="font-size:14px;font-weight:700;color:var(--text)">'+prog.label+'</div><div style="font-size:11px;color:var(--muted);margin-top:2px">'+(prog.description||'')+'</div>';
    btn.appendChild(icon); btn.appendChild(info);
    const doLoad = async () => {
      overlay.remove();
      const ok = await Modal.confirm('Charger "'+prog.label+'" ? Le planning actuel sera remplacé.');
      if(!ok) return;
      if(typeof loadProgram==='function'){
        loadProgram(prog.id);
        renderDayTabs(); renderDayDetail(0);
        showToast('✅ Programme '+prog.label+' chargé','save',2500);
      }
    };
    btn.ontouchstart=(e)=>{e.preventDefault();doLoad();}; btn.onclick=doLoad;
    sheet.appendChild(btn);
  });

  const cancel = document.createElement('button');
  cancel.style.cssText = 'width:100%;padding:10px;border:none;background:none;color:var(--muted);font-size:14px;font-family:var(--font);cursor:pointer;touch-action:manipulation;-webkit-appearance:none;margin-top:4px';
  cancel.textContent = 'Annuler';
  cancel.ontouchstart=(e)=>{e.preventDefault();overlay.remove();}; cancel.onclick=()=>overlay.remove();
  sheet.appendChild(cancel);
  overlay.appendChild(sheet);
  overlay.ontouchstart=(e)=>{if(e.target===overlay)overlay.remove();};
  overlay.onclick=(e)=>{if(e.target===overlay)overlay.remove();};
  document.body.appendChild(overlay);
}

function buildExTable(di,tbody,d,onUpdate){
  tbody.innerHTML='';
  const isDetail=_exView==='detail';

  // ── Vue Cartes (mode mobile) ──
  if (_exView === 'cards') {
    // Cacher le tableau, utiliser le parent comme conteneur de cartes
    const wrap = tbody.parentElement;
    let thead = wrap.querySelector('thead'); if(thead) thead.remove();
    tbody.style.display = 'block';
    d.exercises.forEach((_, ei) => {
      const card = buildExCard(di, ei, d, onUpdate);
      tbody.appendChild(card);
    });
    return;
  }
  let thead=tbody.parentElement.querySelector('thead');if(thead)thead.remove();
  thead=document.createElement('thead');
  if(isDetail){
    thead.innerHTML=`<tr><th style="width:20px">☐</th><th class="th-name">Exercice</th><th style="width:75px">Groupe</th><th style="width:55px">Poids (kg)</th><th style="width:36px">Sér.</th><th style="width:55px">Rép.cible</th><th style="width:55px">Rép.faites</th><th style="width:38px">RPE</th><th style="width:32px">RIR</th><th style="width:48px">Tempo</th><th style="width:44px">Repos</th><th style="width:52px">Volume</th><th style="width:46px">1RM</th><th style="width:50px">Préc.</th><th style="width:80px">Prochain</th><th style="width:110px">Note</th><th style="width:20px"></th></tr>`;
  } else {
    thead.innerHTML=`<tr><th style="width:20px">☐</th><th class="th-name">Exercice</th><th style="width:75px">Groupe</th><th style="width:55px">Poids (kg)</th><th style="width:36px">Sér.</th><th style="width:55px">Rép.cible</th><th style="width:55px">Rép.faites</th><th style="width:38px">RPE</th><th style="width:32px">RIR</th><th style="width:50px">Préc.</th><th style="width:20px"></th></tr>`;
  }
  tbody.parentElement.insertBefore(thead,tbody);

  // Group by supersets
  let ssIdx=0;
  d.exercises.forEach((_,ei)=>{
    const row=buildExRow(di,ei,d,onUpdate,isDetail);tbody.appendChild(row);
  });
}

/* ── Vue Cartes — optimisée mobile ── */
function buildExCard(di, ei, d, onUpdate) {
  const ex = d.exercises[ei];
  const m  = MM[ex.muscle || ''];

  const card = document.createElement('div');
  card.className = 'plan-ex-card'
    + (ex.done        ? ' pec-done'    : '')
    + (ex.isWarmup    ? ' pec-warmup'  : '')
    + (shouldOverload(ex) && !ex.isWarmup ? ' pec-overload' : '')
    + (checkPR(ex)    ? ' pec-pr'      : '');

  // ── Ligne 1 : Checkbox + Nom + Muscle + Statut ──
  const row1 = document.createElement('div');
  row1.className = 'pec-row1';

  const cb = document.createElement('input');
  cb.type = 'checkbox'; cb.className = 'pec-cb'; cb.checked = ex.done;
  cb.setAttribute('aria-label', 'Exercice terminé');
  cb.addEventListener('change', e => {
    ex.done = e.target.checked;
    card.classList.toggle('pec-done', ex.done);
    if (d.exercises.filter(e => e.name.trim() && !e.isWarmup).every(e => e.done)) showSessionComplete(di, d);
    onUpdate(); save(); renderDayTabs(); checkAndAwardAchievements();
  });
  cb.ontouchstart = (e) => { e.stopPropagation(); };

  const nameInp = document.createElement('input');
  nameInp.type = 'text'; nameInp.className = 'pec-name';
  nameInp.placeholder = ex.isWarmup ? 'Échauffement...' : 'Exercice';
  nameInp.value = ex.name || '';
  nameInp.setAttribute('autocomplete','off');
  nameInp.addEventListener('input', e => { ex.name = e.target.value; onUpdate(); _debouncedSave(); renderDayTabs(); _updateAc(e.target.value); });
  nameInp.addEventListener('blur', () => setTimeout(() => { acList.style.display = 'none'; }, 200));

  // ── Autocomplete dropdown ──
  const acWrap = document.createElement('div');
  acWrap.style.cssText = 'position:relative;flex:1;min-width:0';
  const acList = document.createElement('div');
  acList.className = 'pec-ac-list';
  acList.style.display = 'none';
  acWrap.appendChild(nameInp);
  acWrap.appendChild(acList);

  function _updateAc(q) {
    const s = q.trim().toLowerCase();
    if (s.length < 2) { acList.style.display = 'none'; return; }
    const hits = EXERCISE_LIBRARY.filter(l => l.name.toLowerCase().includes(s)).slice(0, 6);
    if (!hits.length) { acList.style.display = 'none'; return; }
    acList.innerHTML = '';
    hits.forEach(lib => {
      const item = document.createElement('div');
      item.className = 'pec-ac-item';
      const nm = document.createElement('span'); nm.textContent = lib.name;
      const m = MM[lib.muscle || ''];
      const badge = document.createElement('span');
      badge.className = 'pec-muscle';
      if (m) { badge.style.cssText = `background:${m.calBg};color:${m.calColor}`; badge.textContent = m.label; }
      item.appendChild(nm); if (m) item.appendChild(badge);
      const pick = () => {
        ex.name   = lib.name;
        if (!ex.muscle) ex.muscle = lib.muscle;
        nameInp.value = lib.name;
        acList.style.display = 'none';
        onUpdate(); save(); renderDayDetail(S.activeDay);
      };
      item.ontouchstart = (e) => { e.preventDefault(); pick(); };
      item.onmousedown  = (e) => { e.preventDefault(); pick(); };
      acList.appendChild(item);
    });
    acList.style.display = 'block';
  }

  const badges = document.createElement('div');
  badges.className = 'pec-badges';
  if (m) {
    const mb = document.createElement('span');
    mb.className = 'pec-muscle';
    mb.style.cssText = `background:${m.calBg};color:${m.calColor}`;
    mb.textContent = m.label;
    badges.appendChild(mb);
  }
  if (!ex.isWarmup && checkPR(ex)) {
    const pb = document.createElement('span');
    pb.className = 'pec-badge-pr'; pb.textContent = '🏆 PR'; badges.appendChild(pb);
  }
  if (!ex.isWarmup && shouldOverload(ex)) {
    const ob = document.createElement('span');
    ob.className = 'pec-badge-ol';
    ob.textContent = '↑ ' + Math.round((parseFloat(ex.weight)||0) * 1.025 / 2.5) * 2.5 + 'kg'; badges.appendChild(ob);
  }
  if (isPlateau(ex.name)) {
    const plb = document.createElement('span');
    plb.className = 'pec-badge-plateau'; plb.textContent = '⚠ Plateau'; badges.appendChild(plb);
  }

  row1.appendChild(cb); row1.appendChild(acWrap); row1.appendChild(badges);
  card.appendChild(row1);

  // ── Ligne 2 : Poids × Séries × Reps ──
  const row2 = document.createElement('div');
  row2.className = 'pec-row2';

  function mkInput(val, placeholder, width, onChange) {
    const inp = document.createElement('input');
    inp.type = 'text'; inp.inputMode = 'decimal';
    inp.className = 'pec-inp'; inp.value = val || ''; inp.placeholder = placeholder;
    inp.style.width = width;
    inp.addEventListener('input', e => onChange(e.target.value));
    return inp;
  }

  const wInp = mkInput(ex.weight, 'kg', '70px', v => { ex.weight = v; refreshCard(); save(); });
  const sInp = mkInput(ex.sets, 'sér', '40px', v => { ex.sets = v; save(); });
  const rInp = mkInput(ex.reps, '6-12', '60px', v => { ex.reps = v; save(); });
  const rAInp = mkInput(ex.repsAchieved, '✓ reps', '70px', v => {
    const wasPR = checkPR(ex); ex.repsAchieved = v;
    if (!wasPR && checkPR(ex)) showPRToast(ex.name);
    card.classList.toggle('pec-pr', checkPR(ex));
    card.classList.toggle('pec-overload', shouldOverload(ex) && !ex.isWarmup);
    refreshCard(); onUpdate(); save();
  });
  rAInp.style.fontWeight = '700';

  const prevLbl = document.createElement('span');
  prevLbl.className = 'pec-prev';

  function refreshCard() {
    const lw = lastW(ex.name);
    if (shouldOverload(ex) && !ex.isWarmup) prevLbl.innerHTML = `<span style="color:var(--green)">↑${Math.round((parseFloat(ex.weight)||0)*1.025/2.5)*2.5}?</span>`;
    else if (isFailure(ex)) prevLbl.innerHTML = `<span style="color:var(--red)">↓${Math.round((parseFloat(ex.weight)||0)*0.975/2.5)*2.5}?</span>`;
    else prevLbl.textContent = lw ? 'Préc: ' + lw : '';
  }
  refreshCard();

  const sep1 = document.createElement('span'); sep1.className = 'pec-sep'; sep1.textContent = 'kg';
  const sep2 = document.createElement('span'); sep2.className = 'pec-sep'; sep2.textContent = '×';
  const sep3 = document.createElement('span'); sep3.className = 'pec-sep'; sep3.textContent = '→';

  row2.append(wInp, sep1, sInp, sep2, rInp, sep3, rAInp, prevLbl);
  card.appendChild(row2);

  // ── Ligne 3 (extensible) : RPE, RIR, Muscle ──
  const expand = document.createElement('button');
  expand.className = 'pec-expand'; expand.textContent = '▸ Détails';
  expand.ontouchstart = (e) => { e.preventDefault(); toggleDetails(); };
  expand.onclick = toggleDetails;

  const details = document.createElement('div');
  details.className = 'pec-details'; details.style.display = 'none';

  function toggleDetails() {
    const open = details.style.display === 'none';
    details.style.display = open ? 'flex' : 'none';
    expand.textContent = open ? '▾ Détails' : '▸ Détails';
  }

  // RPE
  const rpeSel = document.createElement('select'); rpeSel.className = 'pec-sel';
  RPE_OPTS.forEach(v => { const o = document.createElement('option'); o.value=v; o.textContent=v; if(v===ex.rpe)o.selected=true; rpeSel.appendChild(o); });
  rpeSel.addEventListener('change', e => { ex.rpe = e.target.value; save(); });
  const rpeWrap = document.createElement('label'); rpeWrap.className = 'pec-detail-lbl';
  rpeWrap.innerHTML = 'RPE '; rpeWrap.appendChild(rpeSel);

  // RIR
  const rirSel = document.createElement('select'); rirSel.className = 'pec-sel';
  RIR_OPTS.forEach(v => { const o = document.createElement('option'); o.value=v; o.textContent=v; if(v===ex.rir)o.selected=true; rirSel.appendChild(o); });
  rirSel.addEventListener('change', e => { ex.rir = e.target.value; save(); });
  const rirWrap = document.createElement('label'); rirWrap.className = 'pec-detail-lbl';
  rirWrap.innerHTML = 'RIR '; rirWrap.appendChild(rirSel);

  // Note
  const noteInp = document.createElement('input');
  noteInp.type = 'text'; noteInp.className = 'pec-note'; noteInp.placeholder = '📝 Note...'; noteInp.value = ex.note || '';
  noteInp.addEventListener('input', e => { ex.note = e.target.value; _debouncedSave(); });

  // Delete
  const delBtn = document.createElement('button');
  delBtn.className = 'pec-del'; delBtn.textContent = '🗑';
  delBtn.title = 'Supprimer l\'exercice';
  delBtn.ontouchstart = (e) => { e.preventDefault(); doDelete(); };
  delBtn.onclick = doDelete;
  function doDelete() {
    withLock('del-ex-'+di+'-'+ei, () => {
      d.exercises.splice(ei, 1);
      save(); onUpdate(); renderDayDetail(S.activeDay);
    });
  }

  details.append(rpeWrap, rirWrap, noteInp, delBtn);
  card.appendChild(expand);
  card.appendChild(details);

  return card;
}

function buildExRow(di,ei,d,onUpdate,isDetail){
  const ex=d.exercises[ei];
  const tr=document.createElement('tr');
  if(ex.done)tr.classList.add('done-row');
  if(shouldOverload(ex))tr.classList.add('overload-row');
  if(checkPR(ex))tr.classList.add('pr-row');
  if(isPlateau(ex.name))tr.classList.add('plateau-row');
  if(isFailure(ex))tr.classList.add('fail-row');
  if(ex.isWarmup)tr.classList.add('srow-warmup');
  if(ex.supersetGroup){tr.style.borderLeft='3px solid var(--purple)';}

  function td(el,style,label){const t=document.createElement('td');if(style)t.style.cssText=style;if(label)t.setAttribute('data-label',label);if(el instanceof HTMLElement)t.appendChild(el);else if(el!=null)t.textContent=String(el);return t;}

  // Checkbox
  const cb=document.createElement('input');cb.type='checkbox';cb.className='ex-cb';cb.checked=ex.done;cb.setAttribute('aria-label','Exercice terminé');
  cb.addEventListener('change',e=>{
    ex.done=e.target.checked;tr.classList.toggle('done-row',e.target.checked);
    if(d.exercises.filter(e=>e.name.trim()&&!e.isWarmup).every(e=>e.done))showSessionComplete(di,d);
    onUpdate();save();renderDayTabs();checkAndAwardAchievements();
  });
  tr.appendChild(td(cb,'text-align:center'));

  // Name with badges
  const nameWrap=document.createElement('div');nameWrap.style.cssText='display:flex;align-items:center;gap:4px;min-width:0';
  // Drag handle for reorder
  const dh=document.createElement('span');dh.className='drag-handle';dh.textContent='⠿';dh.title='Glisser pour réordonner';
  dh.draggable=true;
  dh.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain',String(ei));tr.classList.add('dragging');});
  dh.addEventListener('dragend',()=>tr.classList.remove('dragging'));
  tr.addEventListener('dragover',e=>{e.preventDefault();});
  tr.addEventListener('drop',e=>{
    e.preventDefault();const fromIdx=parseInt(e.dataTransfer.getData('text/plain'));
    if(fromIdx===ei||isNaN(fromIdx))return;
    const moved=d.exercises.splice(fromIdx,1)[0];d.exercises.splice(ei,0,moved);
    save();buildExTable(di,tbody_ref,d,onUpdate);
  });
  // tbody_ref resolved lazily via closure (tr not in DOM yet when buildExRow is called)
  const ni=document.createElement('input');ni.type='text';ni.className='ex-name-inp';ni.placeholder=ex.isWarmup?'Échauffement...':'Exercice';ni.value=ex.name||'';
  ni.setAttribute('aria-label','Nom de l exercice');
  ni.setAttribute('autocomplete','off');
  ni.addEventListener('input',e=>{ex.name=e.target.value;onUpdate();_debouncedSave();renderDayTabs();_showNiAc(e.target.value);});
  ni.addEventListener('blur',()=>setTimeout(()=>{niAc.style.display='none';},200));

  // ── Autocomplete dropdown (vue tableau) ──
  const niAc=document.createElement('div');niAc.className='table-ac-list';niAc.style.display='none';
  function _showNiAc(q){
    const s=q.trim().toLowerCase();
    if(s.length<2){niAc.style.display='none';return;}
    const hits=EXERCISE_LIBRARY.filter(l=>l.name.toLowerCase().includes(s)).slice(0,5);
    if(!hits.length){niAc.style.display='none';return;}
    niAc.innerHTML='';
    hits.forEach(lib=>{
      const item=document.createElement('div');item.className='table-ac-item';
      const nm=document.createElement('span');nm.textContent=lib.name;
      const m=MM[lib.muscle||''];
      if(m){const badge=document.createElement('span');badge.className='pec-muscle';badge.style.cssText='background:'+m.calBg+';color:'+m.calColor+';float:right';badge.textContent=m.label;item.appendChild(nm);item.appendChild(badge);}
      else item.appendChild(nm);
      const pick=()=>{ex.name=lib.name;if(!ex.muscle)ex.muscle=lib.muscle;ni.value=lib.name;niAc.style.display='none';onUpdate();save();renderDayDetail(S.activeDay);};
      item.ontouchstart=(e)=>{e.preventDefault();pick();};
      item.onmousedown=(e)=>{e.preventDefault();pick();};
      niAc.appendChild(item);
    });
    niAc.style.display='block';
  }
  nameWrap.appendChild(dh);
  if(ex.isWarmup){const wb=document.createElement('span');wb.className='warmup-badge';wb.textContent='Éch.';nameWrap.appendChild(wb);}
  if(ex.supersetGroup){const sb=document.createElement('span');sb.className='superset-badge';sb.textContent='SS-'+ex.supersetGroup;nameWrap.appendChild(sb);}
  nameWrap.style.position='relative';
  nameWrap.appendChild(ni);
  nameWrap.appendChild(niAc);
  if(checkPR(ex)){const prb=document.createElement('span');prb.className='pr-badge-sm';prb.textContent='PR';nameWrap.appendChild(prb);}
  if(isPlateau(ex.name)){const pb=document.createElement('span');pb.style.cssText='font-size:8px;color:var(--red);font-weight:700';pb.textContent='Plateau';nameWrap.appendChild(pb);}
  tr.appendChild(td(nameWrap));

  // Muscle
  const ms=document.createElement('select');ms.className='ex-muscle-sel';
  const mn=document.createElement('option');mn.value='';mn.textContent='—';ms.appendChild(mn);
  MUSCLES.forEach(m=>{const o=document.createElement('option');o.value=m.key;o.textContent=(getDMS(d).includes(m.key)?'★ ':'')+m.label;if(m.key===ex.muscle)o.selected=true;ms.appendChild(o);});
  function applyMC(){const m=MM[ms.value];if(m){ms.style.background=m.calBg;ms.style.color=m.calColor;}else{ms.style.background='transparent';ms.style.color='var(--muted)';}}
  applyMC();ms.addEventListener('change',e=>{ex.muscle=e.target.value;applyMC();save();syncMuscles(di);});
  tr.appendChild(td(ms));

  // Weight
  const wi=document.createElement('input');wi.type='text';wi.className='ex-num-inp';wi.placeholder='kg';wi.value=ex.weight||'';
  wi.setAttribute('aria-label','Poids en kg');wi.title='Poids (kg)';
  wi.addEventListener('input',e=>{ex.weight=e.target.value;refreshCells();onUpdate();save();});
  tr.appendChild(td(wi));

  // Sets — always shown
  {const si=document.createElement('input');si.type='text';si.className='ex-num-inp';si.placeholder='x';si.value=ex.sets||'';si.style.width='32px';si.addEventListener('input',e=>{ex.sets=e.target.value;refreshCells();onUpdate();save();});tr.appendChild(td(si));}

  // Reps target — always shown
  {const ri=document.createElement('input');ri.type='text';ri.className='ex-num-inp';ri.placeholder='6–12';ri.value=ex.reps||'';ri.style.cssText='color:var(--muted);width:50px';ri.addEventListener('input',e=>{ex.reps=e.target.value;save();});tr.appendChild(td(ri));}

  // Tempo + Rest — detail only
  if(false){/* placeholder */}

  // Reps achieved
  const rai=document.createElement('input');rai.type='text';rai.className='ex-num-inp';rai.placeholder=isDetail?'réalisé':`${ex.sets||'?'}×`;rai.value=ex.repsAchieved||'';rai.style.fontWeight='700';rai.setAttribute('aria-label','Répétitions réalisées');
  rai.addEventListener('input',e=>{
    const wasPR=checkPR(ex);ex.repsAchieved=e.target.value;
    tr.classList.toggle('overload-row',shouldOverload(ex)&&!ex.isWarmup);
    tr.classList.toggle('pr-row',checkPR(ex));tr.classList.toggle('fail-row',isFailure(ex));
    if(!wasPR&&checkPR(ex))showPRToast(ex.name);
    refreshCells();onUpdate();save();
  });
  tr.appendChild(td(rai));

  // RPE
  const rpeSel=document.createElement('select');rpeSel.className='ex-rpe-sel';
  RPE_OPTS.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;if(v===ex.rpe)o.selected=true;rpeSel.appendChild(o);});
  function applyRpeC(){const cls=rpeColor(rpeSel.value);rpeSel.className='ex-rpe-sel '+(cls==='rpe-easy'?'':cls==='rpe-target'?'':cls==='rpe-hard'?'':'');rpeSel.style.color=parseFloat(rpeSel.value)>8.5?'var(--red)':parseFloat(rpeSel.value)>7&&parseFloat(rpeSel.value)>0?'var(--orange)':parseFloat(rpeSel.value)>0?'var(--green)':'var(--muted)';}
  applyRpeC();rpeSel.addEventListener('change',e=>{ex.rpe=e.target.value;applyRpeC();save();});
  tr.appendChild(td(rpeSel));

  // RIR
  const rirSel=document.createElement('select');rirSel.className='ex-rir-sel';
  RIR_OPTS.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;if(v===ex.rir)o.selected=true;rirSel.appendChild(o);});
  rirSel.addEventListener('change',e=>{ex.rir=e.target.value;save();});
  tr.appendChild(td(rirSel));

  // Tempo (detail)
  if(isDetail){const tempoInp=document.createElement('input');tempoInp.type='text';tempoInp.className='ex-num-inp';tempoInp.placeholder='3-1-1';tempoInp.value=ex.tempo||'';tempoInp.addEventListener('input',e=>{ex.tempo=e.target.value;save();});tr.appendChild(td(tempoInp));}

  // Rest (detail)
  if(isDetail){const ri2=document.createElement('input');ri2.type='text';ri2.className='ex-num-inp';ri2.placeholder='s';ri2.value=ex.rest||'';ri2.addEventListener('input',e=>{ex.rest=e.target.value;save();});tr.appendChild(td(ri2));}

  // Volume / 1RM (detail)
  const volTd=document.createElement('td');volTd.className='ex-vol';if(isDetail)tr.appendChild(volTd);
  const rmTd=document.createElement('td');rmTd.className='ex-1rm';if(isDetail)tr.appendChild(rmTd);

  // Previous + next weight
  const prevTd=document.createElement('td');prevTd.className='ex-prev';
  function refreshPrev(){
    const lw=lastW(ex.name);
    if(shouldOverload(ex)&&!ex.isWarmup){const cw=parseFloat(ex.weight)||0;prevTd.innerHTML=`<span class="overload-hint">↑${Math.round((cw*1.025)/2.5)*2.5}?</span>`;}
    else if(isFailure(ex)){const cw=parseFloat(ex.weight)||0;prevTd.innerHTML=`<span class="fail-hint">↓${Math.round((cw*0.975)/2.5)*2.5}?</span>`;}
    else if(isPlateau(ex.name)){prevTd.innerHTML=`<span class="plateau-hint">⚠ Plateau</span>`;}
    else{prevTd.textContent=lw||'—';}
  }
  tr.appendChild(prevTd);

  // Suggested next weight (detail)
  if(isDetail){
    const nextTd=document.createElement('td');nextTd.style.cssText='font-size:8px;color:var(--purple);font-family:var(--mono);text-align:center';
    nextTd.textContent=ex.suggestedNextWeight?'→'+ex.suggestedNextWeight:'—';
    tr.appendChild(nextTd);
  }

  // Note (detail)
  if(isDetail){const noteInp=document.createElement('input');noteInp.type='text';noteInp.className='ex-note-inp';noteInp.placeholder='Note...';noteInp.value=ex.note||'';noteInp.addEventListener('input',e=>{ex.note=e.target.value;save();});tr.appendChild(td(noteInp));}

  function refreshCells(){
    if(!ex.isWarmup){
      const v=calcVol(ex);if(volTd)volTd.textContent=v>0?Math.round(v).toLocaleString('fr')+'kg':'—';
      const rm=calc1RM(ex.weight,ex.repsAchieved||ex.reps);if(rmTd)rmTd.textContent=rm?rm+'kg':'—';
    }
    refreshPrev();
  }
  refreshCells();

  // Strength standard badge (detail)
  if(isDetail&&ex.weight){
    const lastPoids=(S.mesures.poids||[]).slice(-1)[0];
    if(lastPoids){const std=strengthStandard(ex,parseFloat(lastPoids.val));if(std){const sb=document.createElement('span');sb.style.cssText=`font-size:7px;font-weight:700;padding:1px 4px;border-radius:4px;background:rgba(0,0,0,.06);color:${std.color};margin-left:3px`;sb.textContent=std.level;nameWrap.appendChild(sb);}}
  }

  // Copy to another day button
  const copyBtn=document.createElement('button');
  copyBtn.className='ex-del';copyBtn.title='Copier vers…';copyBtn.textContent='📋';
  copyBtn.style.cssText='font-size:11px;opacity:.7;margin-right:2px';
  copyBtn.addEventListener('click',async()=>{
    const dayNames=['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];
    const choices=dayNames.map((n,idx)=>({label:n,value:idx})).filter(ch=>ch.value!==di);
    const result=await Modal.form('📋 Copier vers quel jour?',[
      {type:'select',name:'targetDay',label:'Jour',options:choices.map(ch=>({label:ch.label,value:String(ch.value)}))}
    ]);
    if(!result) return;
    const targetDi=parseInt(result.targetDay);
    if(isNaN(targetDi)) return;
    const exCopy=JSON.parse(JSON.stringify(d.exercises[ei]));
    exCopy.done=false; exCopy.repsAchieved='';
    if(!S.days[targetDi].exercises) S.days[targetDi].exercises=[];
    S.days[targetDi].exercises.push(exCopy);
    save(); renderDayTabs(); renderDayDetail(targetDi);
    showToast('📋 Exercice copié vers '+dayNames[targetDi],'ok',2500);
  });
  tr.appendChild(td(copyBtn));

  // Delete
  const del=document.createElement('button');del.className='ex-del';del.textContent='×';
  del.addEventListener('click',()=>{d.exercises.splice(ei,1);save();buildExTable(di,tr.closest('tbody'),d,onUpdate);renderDayTabs();onUpdate();});
  tr.appendChild(td(del));

  // Drop target for reorder
  tr.addEventListener('drop',e=>{
    e.preventDefault();const fromIdx=parseInt(e.dataTransfer.getData('text/plain'));
    if(fromIdx===ei||isNaN(fromIdx))return;
    const moved=d.exercises.splice(fromIdx,1)[0];d.exercises.splice(ei,0,moved);
    save();
    // Use tr.closest instead of stale tbody_ref
    const tb=tr.closest('tbody');if(tb)buildExTable(di,tb,d,onUpdate);
  });
  tr.addEventListener('dragover',e=>e.preventDefault());
  return tr;
}

function showSessionComplete(di, d) {
  // Éviter les doublons
  if (document.getElementById('sess-complete-overlay')) return;

  const vol  = Object.values(dayVol(d)).reduce((a, b) => a + b, 0);
  const prs  = d.exercises.filter(checkPR).map(e => e.name);
  const dur  = S.sessStartTime ? Math.round((Date.now() - S.sessStartTime) / 60000) : 0;
  const sets = d.exercises.reduce((a, ex) => a + (ex.repsAchieved && ex.repsAchieved !== '' ? 1 : 0), 0);

  // ── Overlay plein écran ──
  const overlay = document.createElement('div');
  overlay.id = 'sess-complete-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:linear-gradient(135deg,var(--teal) 0%,#3d8a84 100%);z-index:8000;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;gap:18px;overflow-y:auto;-webkit-overflow-scrolling:touch';

  function mkStat(val, lbl) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'text-align:center;min-width:72px';
    const v = document.createElement('div');
    v.style.cssText = 'font-size:26px;font-weight:800;font-family:var(--mono);color:#fff';
    v.textContent = val;
    const l = document.createElement('div');
    l.style.cssText = 'font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:rgba(255,255,255,.75);margin-top:2px';
    l.textContent = lbl;
    wrap.appendChild(v); wrap.appendChild(l);
    return wrap;
  }

  const confetti = document.createElement('div');
  confetti.style.cssText = 'font-size:52px';
  confetti.textContent = prs.length > 0 ? '🏆' : '🎉';
  overlay.appendChild(confetti);

  const title = document.createElement('div');
  title.style.cssText = 'font-size:24px;font-weight:800;color:#fff;text-align:center';
  title.textContent = 'Séance terminée !';
  overlay.appendChild(title);

  const sub = document.createElement('div');
  sub.style.cssText = 'font-size:13px;color:rgba(255,255,255,.8);text-align:center';
  sub.textContent = DAYS[di] + ' — Semaine ' + (S.weekType||'A') + ' · Bloc ' + (S.currentBlock||1);
  overlay.appendChild(sub);

  const stats = document.createElement('div');
  stats.style.cssText = 'display:flex;gap:24px;flex-wrap:wrap;justify-content:center;background:rgba(255,255,255,.15);border-radius:18px;padding:18px 24px';
  stats.appendChild(mkStat(vol >= 1000 ? (vol/1000).toFixed(1)+'t' : Math.round(vol)+'kg', 'Volume'));
  if (dur)  stats.appendChild(mkStat(dur + "'", 'Durée'));
  if (sets) stats.appendChild(mkStat(String(sets), 'Séries'));
  if (prs.length) stats.appendChild(mkStat('🏆 '+prs.length, 'PR'));
  overlay.appendChild(stats);

  if (prs.length > 0) {
    const prList = document.createElement('div');
    prList.style.cssText = 'text-align:center;max-width:280px';
    prs.forEach(name => {
      const chip = document.createElement('span');
      chip.style.cssText = 'display:inline-block;background:rgba(255,255,255,.2);color:#fff;border-radius:20px;padding:4px 10px;font-size:11px;font-weight:600;margin:3px';
      chip.textContent = '🏆 ' + name;
      prList.appendChild(chip);
    });
    overlay.appendChild(prList);
  }

  const btns = document.createElement('div');
  btns.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;justify-content:center;width:100%;max-width:300px;margin-top:8px';

  // ── Note de séance ──
  const noteWrap = document.createElement('div');
  noteWrap.style.cssText = 'width:100%;max-width:300px;background:rgba(255,255,255,.12);border-radius:14px;padding:10px 14px';
  const noteLbl = document.createElement('div');
  noteLbl.style.cssText = 'font-size:10px;font-weight:700;color:rgba(255,255,255,.7);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px';
  noteLbl.textContent = '📝 Note de séance';
  const noteTA = document.createElement('textarea');
  noteTA.rows = 2;
  noteTA.placeholder = 'Énergie, douleurs, remarques...';
  noteTA.style.cssText = 'width:100%;border:none;background:transparent;color:#fff;font-family:var(--font);font-size:13px;resize:none;outline:none;line-height:1.5;box-sizing:border-box;-webkit-appearance:none';
  noteWrap.appendChild(noteLbl); noteWrap.appendChild(noteTA);
  overlay.appendChild(noteWrap);

  const closeBtn = document.createElement('button');
  closeBtn.style.cssText = 'flex:1;padding:13px 20px;border-radius:14px;border:2px solid rgba(255,255,255,.5);background:rgba(255,255,255,.15);color:#fff;font-family:var(--font);font-weight:700;font-size:14px;cursor:pointer;touch-action:manipulation;-webkit-appearance:none';
  closeBtn.textContent = 'Fermer';
  const doClose = () => withLock('sess-complete-close', () => { overlay.remove(); if(typeof renderDashboard==='function') renderDashboard(); if(typeof switchTab==='function') switchTab('dashboard'); });
  closeBtn.ontouchstart = (e) => { e.preventDefault(); doClose(); };
  closeBtn.onclick = doClose;

  const shareBtn = document.createElement('button');
  shareBtn.style.cssText = 'flex:1;padding:13px 20px;border-radius:14px;border:none;background:#fff;color:#3d8a84;font-family:var(--font);font-weight:700;font-size:14px;cursor:pointer;touch-action:manipulation;-webkit-appearance:none';
  shareBtn.textContent = '📤 Partager';
  const doShare = () => { if(typeof Share!=='undefined') Share.shareSession(d); };
  shareBtn.ontouchstart = (e) => { e.preventDefault(); doShare(); };
  shareBtn.onclick = doShare;

  btns.appendChild(closeBtn); btns.appendChild(shareBtn);
  overlay.appendChild(btns);
  document.body.appendChild(overlay);

  // ── Sauvegarder dans l'historique ──
  const sessDate = localDateStr();
  if (!S.history) S.history = {};
  if (!S.history[sessDate]) S.history[sessDate] = [];

  const histEntry = {
    name: DAYS[di]||'Séance', date: sessDate,
    volume: vol, duration: dur, sets: sets,
    note: noteTA.value.trim(),
    exercises: (d.exercises||[]).map(e => ({
      name:e.name, muscle:e.muscle, weight:e.weight,
      sets:e.sets, reps:e.reps, repsAchieved:e.repsAchieved||'',
      done:e.done, isWarmup:e.isWarmup||false,
    })),
  };
  const existIdx = S.history[sessDate].findIndex(h => h.name === histEntry.name);
  if (existIdx >= 0) S.history[sessDate][existIdx] = histEntry;
  else S.history[sessDate].push(histEntry);
  S.sessStartTime = null;
  save();
  checkAndAwardAchievements();
}

/* ══ STATS ══ */

function renderAlertsPanel(){
  const ap=document.getElementById('alerts-panel');if(!ap)return;
  const alerts=[];
  // Plateau detection
  S.days.flatMap(d=>d.exercises).filter(e=>e.name.trim()).forEach(ex=>{if(isPlateau(ex.name))alerts.push({type:'warn',msg:'⚠️ Plateau: '+ex.name.slice(0,25)});});
  // Consecutive same muscle
  for(let i=0;i<6;i++){const m1=getDM(S.days[i]).filter(k=>k!=='rep');const m2=getDM(S.days[i+1]).filter(k=>k!=='rep');const ov=m1.filter(m=>m2.includes(m));if(ov.length)alerts.push({type:'bad',msg:'🔴 '+DAYS_SH[i]+'/'+DAYS_SH[i+1]+': même groupe'});}
  // RPE warnings
  S.days.forEach(d=>d.exercises.forEach(ex=>{const rpe=parseFloat(ex.rpe)||0;if(rpe>=9.5)alerts.push({type:'warn',msg:'🔴 RPE '+rpe+': '+ex.name.slice(0,20)});}));
  // Pain alerts
  const pains14=activePains();
  pains14.forEach(p=>{
    alerts.push({type:'bad',msg:'⚠️ Douleur: '+(p.zone||p.part||'Zone inconnue')+(p.intensity?' ('+p.intensity+'/10)':'')});
  });
  // Untrained muscles this week
  const trainedMuscles=new Set(S.days.flatMap(d=>getDM(d)));
  const allMuscles=MK.filter(k=>k!=='rep'&&k!=='cardio');
  const untrained=allMuscles.filter(k=>!trainedMuscles.has(k));
  if(untrained.length>0&&untrained.length<allMuscles.length){
    alerts.push({type:'info',msg:'💡 Non travaillé: '+untrained.slice(0,3).map(k=>MM[k]?.label.split(' ')[0]||k).join(', ')+(untrained.length>3?'…':'')});
  }
  if(!alerts.length){ap.innerHTML='<span style="color:var(--muted)">Aucune alerte ✅</span>';return;}
  ap.innerHTML='';
  alerts.slice(0,7).forEach(a=>{
    const row=document.createElement('div');
    row.style.cssText=`font-size:9px;padding:2px 0;border-bottom:1px solid var(--border);color:${a.type==='bad'?'var(--red)':a.type==='info'?'var(--teal-d)':'var(--orange)'}`;
    row.textContent=a.msg;
    ap.appendChild(row);
  });
}

/* ══ GOALS ══ */
function renderGoals(){
  const list=document.getElementById('goals-list');list.innerHTML='';
  S.goals.forEach((g,i)=>{const row=document.createElement('div');row.className='goal-row';const cb=document.createElement('input');cb.type='checkbox';cb.className='goal-cb';cb.checked=g.done;cb.addEventListener('change',e=>{S.goals[i].done=e.target.checked;save();});const inp=document.createElement('input');inp.type='text';inp.className='goal-inp';inp.placeholder='Objectif...';inp.value=g.text||'';inp.addEventListener('input',e=>{S.goals[i].text=e.target.value;save();});const del=document.createElement('button');del.className='goal-del';del.textContent='×';del.addEventListener('click',()=>{S.goals.splice(i,1);save();renderGoals();});row.appendChild(cb);row.appendChild(inp);row.appendChild(del);list.appendChild(row);});
}
document.getElementById('add-goal-btn').addEventListener('click',()=>{Store.dispatch({type:'GOALS_ADD_GOAL',payload:''});renderGoals();});
document.getElementById('notes-area').addEventListener('input',e=>{S.notes=e.target.value;save();});

/* ══ CHRONO ══ */
/* _ci — déclaré dans constants.js */
function updateChronoDsp(){
  ['chrono-display','focus-chrono-time'].forEach(id=>{const el=document.getElementById(id);if(!el)return;const m=Math.floor(_cs/60),s=_cs%60;el.textContent=m+':'+(s<10?'0':'')+s;el.className=el.className.replace(/warning|done-clr|pulsing/g,'').trim();if(_ct>0){const rem=_ct-_cs;if(rem<=10&&rem>0)el.className+=' warning';if(rem<=0)el.className+=' done-clr';}});
}
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
function pauseChrono(){clearInterval(_ci);_cr=false;document.getElementById('chrono-start').textContent='▶';}
function resetChrono(){pauseChrono();_cs=0;_ct=0;updateChronoDsp();document.querySelectorAll('.rp-act').forEach(b=>b.classList.remove('rp-act'));}
document.getElementById('chrono-start').addEventListener('click',()=>{if(_cr)pauseChrono();else startChrono();});
document.getElementById('chrono-reset').addEventListener('click',resetChrono);
document.querySelectorAll('.rest-preset').forEach(btn=>btn.addEventListener('click',()=>{resetChrono();_ct=parseInt(btn.dataset.s);document.querySelectorAll('.rest-preset').forEach(b=>b.classList.remove('rp-act'));btn.classList.add('rp-act');startChrono();}));

/* ══ SESSION DURATION TIMER ══ */
/* _sessTimer — déclaré dans constants.js */
function startSessTimer(){if(!S.sessStartTime)S.sessStartTime=Date.now();clearInterval(_sessTimer);_sessTimer=setInterval(()=>{const dur=Math.round((Date.now()-S.sessStartTime)/60000);const el=document.getElementById('sess-duration');if(el)el.textContent=dur+' min';},30000);}
