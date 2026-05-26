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
}

/* ══ DAY DETAIL ══ */
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
  const rb=document.createElement('button');rb.className='btn btn-ghost btn-sm';rb.textContent='↺';
  rb.addEventListener('click',async()=>{
    const ok=await Modal.confirm('Réinitialiser '+DAYS[i]+' ?');
    if(!ok)return;
    save(); // snapshot BEFORE reset (for undo)
    Store.dispatch({type:"TRAINING_UPDATE_DAY",payload:{dayIndex:i,changes:mkDay(i,S.weekType)}});
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
  ni.addEventListener('input',e=>{ex.name=e.target.value;onUpdate();save();renderDayTabs();});
  // Autocomplete from library
  ni.addEventListener('keyup',e=>{if(ni.value.length<2)return;const match=EXERCISE_LIBRARY.filter(l=>l.name.toLowerCase().includes(ni.value.toLowerCase())).slice(0,4);if(match.length&&e.key!=='Enter'){/* could show dropdown */}});
  nameWrap.appendChild(dh);
  if(ex.isWarmup){const wb=document.createElement('span');wb.className='warmup-badge';wb.textContent='Éch.';nameWrap.appendChild(wb);}
  if(ex.supersetGroup){const sb=document.createElement('span');sb.className='superset-badge';sb.textContent='SS-'+ex.supersetGroup;nameWrap.appendChild(sb);}
  nameWrap.appendChild(ni);
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

function showSessionComplete(di,d){
  const existing=document.getElementById('sess-complete-'+di);if(existing)return;
  const vol=Object.values(dayVol(d)).reduce((a,b)=>a+b,0);
  const prs=d.exercises.filter(checkPR).map(e=>e.name);
  const dur=S.sessStartTime?Math.round((Date.now()-S.sessStartTime)/60000):0;
  const popup=document.createElement('div');popup.id='sess-complete-'+di;popup.className='sess-complete-popup';
  // Build popup safely — no user data in innerHTML
  popup.innerHTML='';
  function _mkStat(val,lbl){const d=document.createElement('div');d.style.textAlign='center';const v=document.createElement('div');v.style.cssText='font-size:22px;font-weight:700;font-family:var(--mono)';v.textContent=val;const l=document.createElement('div');l.style.cssText='font-size:9px;opacity:.8';l.textContent=lbl;d.appendChild(v);d.appendChild(l);return d;}
  const hd=document.createElement('div');hd.style.cssText='font-size:20px;margin-bottom:6px';hd.textContent='🎉 Séance terminée !';popup.appendChild(hd);
  const sub=document.createElement('div');sub.style.cssText='font-size:11px;opacity:.85;margin-bottom:10px';sub.textContent=DAYS[di]+' — Sem. '+S.weekType+' · '+S.currentBlock;popup.appendChild(sub);
  const stats=document.createElement('div');stats.style.cssText='display:flex;justify-content:center;gap:20px;flex-wrap:wrap;margin-bottom:10px';
  stats.appendChild(_mkStat(Math.round(vol/1000*10)/10+'t','Volume'));
  if(dur)stats.appendChild(_mkStat(dur+"'",'Durée'));
  if(prs.length)stats.appendChild(_mkStat('🏆'+prs.length,'PR'));
  popup.appendChild(stats);
  if(prs.length){const pl=document.createElement('div');pl.style.cssText='font-size:10px;opacity:.9;margin-bottom:10px';prs.forEach(n=>{const s=document.createElement('span');s.textContent='🏆 '+n+' ';pl.appendChild(s);});popup.appendChild(pl);}
  const closeBtn=document.createElement('button');closeBtn.style.cssText='background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.3);color:#fff;padding:5px 16px;border-radius:10px;cursor:pointer;font-family:var(--font);font-weight:600;font-size:11px';closeBtn.textContent='Fermer';closeBtn.addEventListener('click',()=>popup.remove());
  const shareBtn=document.createElement('button');shareBtn.style.cssText='background:rgba(255,255,255,.25);border:1px solid rgba(255,255,255,.4);color:#fff;padding:5px 16px;border-radius:10px;cursor:pointer;font-family:var(--font);font-weight:600;font-size:11px;margin-left:8px';shareBtn.textContent='📤 Partager';shareBtn.addEventListener('click',()=>shareSess(di,exercises,vol,dur));
  const btnRow2=document.createElement('div');btnRow2.style.cssText='display:flex;gap:6px;justify-content:center;flex-wrap:wrap';btnRow2.appendChild(closeBtn);btnRow2.appendChild(shareBtn);popup.appendChild(btnRow2);
  const detail=document.getElementById('day-detail');if(detail)detail.prepend(popup);
  // Save session summary to history
  const sessDate = localDateStr();
  if(!S.history) S.history = {};
  if(!S.history[sessDate]) S.history[sessDate] = [];
  // Store session summary as a special entry
  const sessVol2 = Object.values(dayVol(d)).reduce((a,b)=>a+b,0);
  const sessDur2 = S.sessStartTime?Math.round((Date.now()-S.sessStartTime)/60000):0;
  const sessSets2 = (d.exercises||[]).reduce((a,ex)=>a+(ex.repsAchieved&&ex.repsAchieved!==''?1:0),0);
  // Enrich history with session data
  const histEntry = {
    name: DAYS[di]||'Séance',
    date: sessDate,
    volume: sessVol2,
    duration: sessDur2,
    sets: sessSets2,
    exercises: (d.exercises||[]).map(e=>({
      name:e.name, muscle:e.muscle, weight:e.weight,
      sets:e.sets, reps:e.reps, repsAchieved:e.repsAchieved||'',
      done:e.done, isWarmup:e.isWarmup||false
    }))
  };
  // Avoid duplicates — replace if same date+name
  const existIdx = S.history[sessDate].findIndex(h=>h.name===histEntry.name);
  if(existIdx>=0) S.history[sessDate][existIdx] = histEntry;
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
