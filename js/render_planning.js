/* ═══════════════════════════════════════
   render_planning.js — Page Planning
   Dépend de: state.js, utils.js, charts.js
═══════════════════════════════════════ */

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

function applySlotColor(sel,val){const m=MM[val];if(m){sel.style.background=m.calBg;sel.style.color=m.calColor;sel.style.borderColor=m.calColor;sel.classList.add('filled');}else{sel.style.background='var(--surface)';sel.style.color='var(--text)';sel.style.borderColor='var(--border)';sel.classList.remove('filled');}}

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
}

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
  const rb=document.createElement('button');rb.className='btn btn-ghost btn-sm';rb.textContent='↺';
  rb.addEventListener('click',async()=>{
    const ok=await Modal.confirm('Réinitialiser '+DAYS[i]+' ?');
    if(!ok)return;
    save(); // snapshot BEFORE reset (for undo)
    S.days[i]=mkDay(i,S.weekType);
    save(true); // skipUndo=true to avoid double snapshot
    renderDayTabs();renderDayDetail(i);
  });
  ra.appendChild(lb);ra.appendChild(rb);hdr.appendChild(ra);detail.appendChild(hdr);

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
  wt.addEventListener('input',e=>{S.days[i].warmup=e.target.value;save();});
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
    {val:'detail',lbl:'Détail',icon:'⊞',tip:'Vue détail — toutes les colonnes (RPE, Tempo, Note…)'}
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
    inp.addEventListener('input',e=>{S.days[i].cardio[field]=e.target.value;save();});
    g.appendChild(inp);cg.appendChild(g);
  });
  cs.appendChild(cg);detail.appendChild(cs);
}

function buildExTable(di,tbody,d,onUpdate){
  tbody.innerHTML='';
  const isDetail=_exView==='detail';
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

function renderGoals(){
  const list=document.getElementById('goals-list');list.innerHTML='';
  S.goals.forEach((g,i)=>{const row=document.createElement('div');row.className='goal-row';const cb=document.createElement('input');cb.type='checkbox';cb.className='goal-cb';cb.checked=g.done;cb.addEventListener('change',e=>{S.goals[i].done=e.target.checked;save();});const inp=document.createElement('input');inp.type='text';inp.className='goal-inp';inp.placeholder='Objectif...';inp.value=g.text||'';inp.addEventListener('input',e=>{S.goals[i].text=e.target.value;save();});const del=document.createElement('button');del.className='goal-del';del.textContent='×';del.addEventListener('click',()=>{S.goals.splice(i,1);save();renderGoals();});row.appendChild(cb);row.appendChild(inp);row.appendChild(del);list.appendChild(row);});
}

