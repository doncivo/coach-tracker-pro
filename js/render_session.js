/* ═══════════════════════════════════════
   render_session.js — Page Séance
   Dépend de: state.js, utils.js, features.js
═══════════════════════════════════════ */

function renderSession(){
  startSessTimer();
  // Day selector
  const sel=document.getElementById('sess-day-sel');sel.innerHTML='';
  DAYS_SH.forEach((n,i)=>{const btn=document.createElement('button');btn.className='sess-day-btn'+(S.sessDay===i?' active':'');btn.setAttribute('data-d',i);btn.textContent=n;btn.addEventListener('click',()=>{S.sessDay=i;S.sessStartTime=Date.now();_sessActiveEx=0;save();renderSession();});sel.appendChild(btn);});
  // Recovery
  const rkey=`${S.sessDay}-${todayStr()}`;
  document.querySelectorAll('.recovery-btn').forEach(btn=>{const r=parseInt(btn.dataset.r);btn.classList.toggle('sel',S.sessRecovery[rkey]===r);btn.onclick=()=>{S.sessRecovery[rkey]=r;save();document.querySelectorAll('.recovery-btn').forEach(b=>b.classList.toggle('sel',parseInt(b.dataset.r)===r));};});
  // Nutrition today
  const nkey=todayStr();
  document.querySelectorAll('.nutri-btn').forEach(btn=>{btn.classList.remove('sel-deficit','sel-maint','sel-surplus');if(S.nutrition[nkey]===btn.dataset.n)btn.classList.add('sel-'+btn.dataset.n);btn.onclick=()=>{S.nutrition[nkey]=btn.dataset.n;document.querySelectorAll('.nutri-btn').forEach(b=>b.classList.remove('sel-deficit','sel-maint','sel-surplus'));btn.classList.add('sel-'+btn.dataset.n);save();};});
  const d=S.days[S.sessDay];const exercises=d.exercises.filter(e=>e.name.trim());
  updateSessProgress(d,exercises);
  const navEl=document.getElementById('sess-nav');const mainEl=document.getElementById('sess-main');
  if(!exercises.length){navEl.innerHTML='';mainEl.innerHTML='<div style="text-align:center;padding:50px;color:var(--muted);font-size:12px">Aucun exercice pour ce jour.<br>Ajoutez des exercices dans le Planning.</div>';return;}
  if(_sessActiveEx>=exercises.length)_sessActiveEx=0;
  renderSessNav(d,exercises);renderSessExercise(d,exercises,_sessActiveEx);
}

function updateSessProgress(d,exercises){
  const done=exercises.filter(e=>e.done).length;
  const pb=document.getElementById('sess-prog-bar');const pe=document.getElementById('sess-prog-ex');
  if(pb)pb.style.width=(exercises.length?Math.round(done/exercises.length*100):0)+'%';
  if(pe)pe.textContent=done+'/'+exercises.length;
  const vol=Object.values(dayVol(d)).reduce((a,b)=>a+b,0);
  const vl=document.getElementById('sess-vol-live');if(vl)vl.innerHTML='📦 <strong>'+(vol>0?Math.round(vol/1000*10)/10+'t':'—')+'</strong>';
  let best1rm=0;d.exercises.forEach(ex=>{const rm=calc1RM(ex.weight,ex.repsAchieved);if(rm>best1rm)best1rm=rm;});
  const r1=document.getElementById('sess-1rm-live');if(r1)r1.innerHTML='🏋️ <strong>'+(best1rm?best1rm+'kg':'—')+'</strong>';
}

function renderSessNav(d,exercises){
  const nav=document.getElementById('sess-nav');nav.innerHTML='';
  // Also render mobile strip nav
  const strip = document.getElementById('sess-nav-strip');
  if(strip){strip.innerHTML='';
    exercises.forEach((ex,vi)=>{
      const nSets=parseInt(ex.sets)||3;
      if(!ex.setData||ex.setData.length<nSets)ex.setData=Array.from({length:nSets},()=>({weight:ex.weight||'',reps:'',done:false,rpe:'',rir:''}));
      const setsDone=ex.setData.slice(0,nSets).filter(s=>s.done).length;
      const isActive=vi===_sessActiveEx;
      const item=document.createElement('div');
      item.className='sess-strip-item'+(isActive?' active-nav':'')+(ex.done?' done-nav':'');
      const num=document.createElement('div');num.className='sess-strip-num';num.textContent=ex.done?'✓':(vi+1);num.style.color=ex.done?'var(--green)':isActive?'var(--teal-d)':'var(--muted)';
      const dots=document.createElement('div');dots.className='sess-strip-dots';
      for(let si=0;si<Math.min(nSets,6);si++){const dot=document.createElement('div');dot.className='sess-strip-dot'+(si<setsDone?' dot-done':'');dots.appendChild(dot);}
      item.appendChild(num);item.appendChild(dots);
      item.addEventListener('click',()=>{_sessActiveEx=vi;renderSessNav(d,exercises);renderSessExercise(d,exercises,vi);});
      strip.appendChild(item);
    });
    // Scroll active item into view
    setTimeout(()=>{const active=strip.querySelector('.active-nav');if(active)active.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});},50);
  }
  if(d.warmup){const wu=document.createElement('div');wu.style.cssText='padding:6px 8px;font-size:9px;color:#7a6020;background:rgba(255,200,50,.08);border:1px solid rgba(255,200,50,.2);border-radius:var(--rs);margin-bottom:5px;line-height:1.5';wu.textContent='🔥 '+d.warmup.slice(0,70)+(d.warmup.length>70?'…':'');nav.appendChild(wu);}
  exercises.forEach((ex,vi)=>{
    const realIdx=d.exercises.indexOf(ex);const m=MM[ex.muscle];const nSets=parseInt(ex.sets)||3;
    if(!ex.setData||ex.setData.length<nSets)ex.setData=Array.from({length:nSets},()=>({weight:ex.weight||'',reps:'',done:false,rpe:'',rir:''}));
    const setsDone=ex.setData.slice(0,nSets).filter(s=>s.done).length;
    const isActive=vi===_sessActiveEx;
    const item=document.createElement('div');item.className='sess-nav-item'+(isActive?' active-nav':'')+(ex.done?' done-nav':'');
    const num=document.createElement('div');num.className='sess-nav-num'+(ex.done?' done-num':isActive?' active-num':'');num.textContent=ex.done?'✓':(vi+1);
    if(ex.isWarmup)num.className='sess-nav-num snum-warmup';
    const info=document.createElement('div');info.className='sess-nav-info';
    const name=document.createElement('div');name.className='sess-nav-name';name.textContent=ex.name;
    const meta=document.createElement('div');meta.className='sess-nav-meta';meta.textContent=`${ex.sets||'?'}×${ex.reps||'?'}`+(ex.weight?` · ${ex.weight}`:'');
    if(m){const pill=document.createElement('span');pill.style.cssText=`background:${m.calBg};color:${m.calColor};font-size:7px;font-weight:700;padding:1px 4px;border-radius:4px;margin-top:2px;display:inline-block`;pill.textContent=m.label.split(' ')[0];info.appendChild(name);info.appendChild(pill);}
    else info.appendChild(name);
    info.appendChild(meta);
    const dots=document.createElement('div');dots.className='sess-nav-sets';
    for(let si=0;si<Math.min(nSets,8);si++){const dot=document.createElement('div');dot.className='sess-nav-set-dot'+(si<setsDone?' dot-done':'');dots.appendChild(dot);}
    info.appendChild(dots);
    item.appendChild(num);item.appendChild(info);
    item.addEventListener('click',()=>{_sessActiveEx=vi;renderSessNav(d,exercises);renderSessExercise(d,exercises,vi);});
    nav.appendChild(item);
  });
}

function renderSessExercise(d,exercises,vi){
  const mainEl=document.getElementById('sess-main');mainEl.innerHTML='';
  if(!exercises[vi])return;
  const ex=exercises[vi];const realIdx=d.exercises.indexOf(ex);const m=MM[ex.muscle];const nSets=parseInt(ex.sets)||3;
  if(!ex.setData||ex.setData.length<nSets)ex.setData=Array.from({length:nSets},()=>({weight:ex.weight||'',reps:'',done:false,rpe:'',rir:''}));
  const prevW=lastW(ex);const hist=exHist(ex.name).slice(-1);
  // RPE alert
  const avgRpe=ex.setData.filter(s=>s.rpe&&s.rpe!=='—').map(s=>parseFloat(s.rpe)).reduce((a,b)=>a+b,0)/(ex.setData.filter(s=>s.rpe&&s.rpe!=='—').length||1);
  // Header
  const hdr=document.createElement('div');hdr.className='sess-ex-hdr';
  const numBadge=document.createElement('div');numBadge.className='sess-ex-num-big'+(ex.done?' done':'');numBadge.textContent=ex.done?'✓':(vi+1);
  if(ex.isWarmup)numBadge.className='sess-ex-num-big snum-warmup';
  const info=document.createElement('div');info.style.flex='1';
  const nameEl=document.createElement('div');nameEl.className='sess-ex-main-name';nameEl.textContent=ex.name;
  // 1RM estimate from history
  const exHistory=Object.values(S.history||{}).flatMap(wk=>(wk.exercises||(wk.days||[]).flatMap(d=>(d.exercises||[])))||[]).filter(e=>e.name===ex.name&&e.repsAchieved);
  let best1RM=0;
  exHistory.forEach(e=>{
    const sets=e.setData||[{weight:e.weight,reps:e.repsAchieved}];
    sets.forEach(s=>{
      const w=parseFloat(s.weight||e.weight)||0; const r=parseInt(s.reps||s.repsAchieved)||0;
      if(w>0&&r>0){const rm=Math.round(w*(1+r/30)*10)/10; if(rm>best1RM)best1RM=rm;}
    });
  });
  if(best1RM>0){
    const rmEl=document.createElement('div');
    rmEl.style.cssText='font-size:11px;color:var(--teal-d);font-weight:600;margin-top:2px';
    rmEl.textContent='🏋️ 1RM estimé: '+best1RM+'kg';
    nameEl.parentElement?nameEl.parentElement.appendChild(rmEl):null;
  }
  const sub=document.createElement('div');sub.className='sess-ex-sub';
  if(m){const pill=document.createElement('span');pill.className='sess-ex-sub-item';pill.style.cssText=`background:${m.calBg};color:${m.calColor};border-color:${m.calBg}`;pill.textContent=m.label;sub.appendChild(pill);}
  const target=document.createElement('span');target.className='sess-ex-sub-item';target.textContent=`${ex.sets||'?'} × ${ex.reps||'?'}`;sub.appendChild(target);
  if(prevW){const pw=document.createElement('span');pw.className='sess-ex-sub-item';pw.textContent='Préc.: '+prevW;sub.appendChild(pw);}
  if(ex.tempo){const tp=document.createElement('span');tp.className='sess-ex-sub-item';tp.textContent='Tempo: '+ex.tempo;sub.appendChild(tp);}
  if(shouldOverload(ex)&&!ex.isWarmup){const cw=parseFloat(ex.weight)||0;const sg=document.createElement('span');sg.className='sess-ex-sub-item';sg.style.cssText='background:rgba(56,161,105,.1);border:1px solid rgba(56,161,105,.3);color:var(--green);font-weight:700';sg.textContent='↑ Surcharge: '+(cw?Math.round((cw*1.025)/2.5)*2.5+'kg':'suggérée');sub.appendChild(sg);}
  if(checkPR(ex)){const prb=document.createElement('span');prb.className='sess-ex-sub-item';prb.style.cssText='background:#fff3cd;border:1px solid #ffd700;color:#7a5800;font-weight:700';prb.textContent='🏆 PR';sub.appendChild(prb);}
  // Strength standard
  const lastPoids=(S.mesures.poids||[]).slice(-1)[0];
  if(lastPoids&&ex.weight){const std=strengthStandard(ex,parseFloat(lastPoids.val));if(std){const sb=document.createElement('span');sb.className='sess-ex-sub-item';sb.style.color=std.color;sb.textContent=std.level;sub.appendChild(sb);}}
  info.appendChild(nameEl);info.appendChild(sub);
  // Actions
  const acts=document.createElement('div');acts.style.cssText='display:flex;gap:5px;flex-shrink:0;flex-direction:column;align-items:flex-end';
  if(ex.done){const chip=document.createElement('div');chip.style.cssText='padding:5px 12px;border-radius:20px;background:rgba(56,161,105,.12);color:var(--green);font-size:11px;font-weight:700;border:1px solid rgba(56,161,105,.3)';chip.textContent='✅ Terminé';acts.appendChild(chip);}
  const libEx=EXERCISE_LIBRARY.find(e=>ex.name.includes(e.name.slice(0,8)));
  if(libEx&&libEx.alternatives&&libEx.alternatives.length){const altBtn=document.createElement('button');altBtn.className='btn btn-ghost btn-sm';altBtn.textContent='Alternatives';altBtn.addEventListener('click',()=>{showToast('Alternatives: '+libEx.alternatives.join(', '),'save',4000);});acts.appendChild(altBtn);}
  hdr.appendChild(numBadge);hdr.appendChild(info);hdr.appendChild(acts);mainEl.appendChild(hdr);

  // RPE feedback alert
  if(avgRpe>=9&&ex.setData.some(s=>s.done)){
    const al=document.createElement('div');al.className='sess-rpe-alert alert alert-bad';al.style.margin='0 18px';
    al.innerHTML='🔴 <strong>RPE moyen: '+Math.round(avgRpe*10)/10+'</strong> — Envisagez d\'alléger les prochaines séries de 2.5–5kg';
    mainEl.appendChild(al);
  } else if(avgRpe<=7&&avgRpe>0&&ex.setData.some(s=>s.done)){
    const al=document.createElement('div');al.className='sess-rpe-alert alert alert-good';al.style.margin='0 18px';
    al.innerHTML='🟢 <strong>RPE '+Math.round(avgRpe*10)/10+'</strong> — Vous pouvez augmenter la charge';
    mainEl.appendChild(al);
  }

  // Sets table
  const setsArea=document.createElement('div');setsArea.className='sess-sets-area';
  const setsLbl=document.createElement('div');setsLbl.className='sess-sets-label';
  const setsDoneCount=ex.setData.slice(0,nSets).filter(s=>s.done).length;
  setsLbl.innerHTML=`<span>Séries</span><span style="font-family:var(--mono);font-size:11px;color:var(--teal-d)">${setsDoneCount}/${nSets} validées${ex.isWarmup?' · Échauffement':''}</span>`;
  setsArea.appendChild(setsLbl);
  const hasPrev=hist.length>0;
  const table=document.createElement('table');table.className='sess-sets-table';
  table.innerHTML=`<thead><tr><th>Sér.</th><th>Poids</th><th>=</th><th>Reps</th><th>RPE</th><th>RIR</th><th>Vol.</th><th>1RM</th>${hasPrev?'<th style="color:var(--muted);font-style:italic">Préc.</th>':''}<th></th></tr></thead>`;
  const tbody=document.createElement('tbody');
  function refreshNavDots(){const navEl=document.getElementById('sess-nav');if(!navEl)return;const items=navEl.querySelectorAll('.sess-nav-item');const item=items[vi];if(!item)return;const dots=item.querySelectorAll('.sess-nav-set-dot');const sd=ex.setData.slice(0,nSets).filter(s=>s.done).length;dots.forEach((dot,di)=>dot.classList.toggle('dot-done',di<sd));if(ex.done){const num2=item.querySelector('.sess-nav-num');if(num2){num2.classList.add('done-num');num2.textContent='✓';}}}
  ex.setData.slice(0,nSets).forEach((setD,si)=>{
    const tr=document.createElement('tr');const isActive2=!setD.done&&si===ex.setData.slice(0,nSets).findIndex(s=>!s.done);
    tr.className=setD.done?'srow-done':isActive2?'srow-active':ex.isWarmup?'srow-warmup':'';
    const snum=document.createElement('div');snum.className='snum'+(setD.done?' snum-done':isActive2?' snum-active':ex.isWarmup?' snum-warmup':'');snum.textContent=setD.done?'✓':(si+1);
    const tdN=document.createElement('td');tdN.appendChild(snum);tr.appendChild(tdN);
    const wi=document.createElement('input');wi.type='text';wi.className='set-inp inp-w';wi.value=setD.weight||ex.weight||'';wi.placeholder='kg';
    wi.addEventListener('input',e=>{setD.weight=e.target.value;d.exercises[realIdx].weight=e.target.value;refreshRowCalc();save();updateStats();});
    tr.appendChild(Object.assign(document.createElement('td'),{}).appendChild(wi)||document.createElement('td'));
    tr.lastChild.appendChild(wi);tr.lastChild.remove();const tdW=document.createElement('td');tdW.appendChild(wi);tr.appendChild(tdW);
    // Copy previous weight button
    const cpBtn=document.createElement('button');cpBtn.className='set-copy-btn';cpBtn.textContent='=';cpBtn.title='Copier le poids de la série précédente';
    cpBtn.addEventListener('click',()=>{if(si>0){wi.value=ex.setData[si-1].weight||ex.weight||'';setD.weight=wi.value;refreshRowCalc();save();}});
    const tdCp=document.createElement('td');tdCp.appendChild(cpBtn);tr.appendChild(tdCp);
    const ri=document.createElement('input');ri.type='number';ri.className='set-inp inp-r';ri.value=setD.reps||'';ri.placeholder=ex.reps||'?';ri.min=0;ri.max=99;
    ri.addEventListener('input',e=>{setD.reps=e.target.value;refreshRowCalc();save();});
    const tdR=document.createElement('td');tdR.appendChild(ri);tr.appendChild(tdR);
    // RPE
    const rpeSel=document.createElement('select');rpeSel.className='set-inp inp-rpe';
    RPE_OPTS.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;if(v===setD.rpe)o.selected=true;rpeSel.appendChild(o);});
    function applyRpeCol2(){const r=parseFloat(rpeSel.value)||0;rpeSel.style.color=r>=9?'var(--red)':r>=7.5&&r>0?'var(--orange)':r>0?'var(--green)':'var(--muted)';}
    applyRpeCol2();rpeSel.addEventListener('change',e=>{setD.rpe=e.target.value;applyRpeCol2();save();// Refresh RPE alert
    renderSessExercise(d,exercises,vi);});
    const tdRpe=document.createElement('td');tdRpe.appendChild(rpeSel);tr.appendChild(tdRpe);
    // RIR
    const rirSel=document.createElement('select');rirSel.className='set-inp inp-rir';
    RIR_OPTS.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;if(v===setD.rir)o.selected=true;rirSel.appendChild(o);});
    rirSel.addEventListener('change',e=>{setD.rir=e.target.value;save();});
    const tdRir=document.createElement('td');tdRir.appendChild(rirSel);tr.appendChild(tdRir);
    // Vol / 1RM
    const tdVol=document.createElement('td');tdVol.className='set-vol-val';const td1rm=document.createElement('td');td1rm.className='set-1rm-val';
    function refreshRowCalc(){const w=parseFloat(wi.value)||0,r=parseInt(ri.value)||0;tdVol.textContent=w&&r&&!ex.isWarmup?Math.round(w*r)+'kg':'—';const rm=calc1RM(wi.value,ri.value);td1rm.textContent=rm&&!ex.isWarmup?rm+'kg':'—';setsLbl.innerHTML=`<span>Séries</span><span style="font-family:var(--mono);font-size:11px;color:var(--teal-d)">${ex.setData.slice(0,nSets).filter(s=>s.done).length}/${nSets} validées</span>`;updateSessProgress(d,exercises);}
    refreshRowCalc();tr.appendChild(tdVol);tr.appendChild(td1rm);
    // Prev set
    if(hasPrev){const tdPrev=document.createElement('td');tdPrev.className='set-prev-val';const ph=hist[0];tdPrev.textContent=ph?`${ph.weight}×${ph.repsAchieved||ph.reps||'?'}`:'—';tr.appendChild(tdPrev);}
    // Validate button
    const valBtn=document.createElement('button');valBtn.className='set-val-btn '+(setD.done?'validated':'pending');valBtn.textContent=setD.done?'✓':'✓ Go';
    [wi,ri].forEach(inp=>inp.addEventListener('keydown',ev=>{if(ev.key==='Enter'){ev.preventDefault();valBtn.click();}}));
    valBtn.addEventListener('click',()=>{
      setD.done=!setD.done;valBtn.className='set-val-btn '+(setD.done?'validated':'pending');valBtn.textContent=setD.done?'✓':'✓ Go';
      snum.className='snum'+(setD.done?' snum-done':'');snum.textContent=setD.done?'✓':(si+1);
      tr.className=setD.done?'srow-done':'';
      // ── Lancer le minuteur de repos si série validée ──
      if(setD.done) {
        const restSec = parseInt(ex.rest) || S._restDuration || 90;
        const nextSetIdx = ex.setData.slice(0,nSets).findIndex((s,idx)=>idx>si&&!s.done);
        const hasNextSet = nextSetIdx !== -1;
        RestTimer.start(restSec, ex.name, hasNextSet ? () => {
          // Scroller vers la prochaine série
          const rows = setsArea.querySelectorAll('.srow-active, tr');
          if(rows[nextSetIdx]) rows[nextSetIdx].scrollIntoView({behavior:'smooth', block:'nearest'});
        } : null);
      }
      const allDone2=ex.setData.filter(s=>s.done);d.exercises[realIdx].repsAchieved=allDone2.map(s=>s.reps).filter(Boolean).join('/');
      if(ex.setData.slice(0,nSets).every(s=>s.done)){
        const wasPR=checkPR(d.exercises[realIdx]);d.exercises[realIdx].done=true;
        numBadge.className='sess-ex-num-big done';numBadge.textContent='✓';
        if(checkPR(d.exercises[realIdx])&&!wasPR)showPRToast(ex.name);
        const nextVi=exercises.findIndex((e,i)=>i>vi&&!e.done);
        if(nextVi>=0)setTimeout(()=>{_sessActiveEx=nextVi;renderSessNav(d,exercises);renderSessExercise(d,exercises,nextVi);},1200);
      }
      refreshNavDots();refreshRowCalc();resetChrono();startChrono();save();updateStats();renderDayTabs();updateSessProgress(d,exercises);
      if(d.exercises.filter(e=>e.name.trim()&&!e.isWarmup).every(e=>e.done))showSessionComplete(S.sessDay,d);
    });
    const tdBtn=document.createElement('td');tdBtn.appendChild(valBtn);tr.appendChild(tdBtn);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);setsArea.appendChild(table);
  const addSetBtn=document.createElement('button');addSetBtn.className='sess-add-set-btn';addSetBtn.textContent='+ Ajouter une série';
  addSetBtn.addEventListener('click',()=>{ex.setData.push({weight:ex.weight||'',reps:'',done:false,rpe:'',rir:''});d.exercises[realIdx].sets=String((parseInt(ex.sets)||nSets)+1);ex.sets=d.exercises[realIdx].sets;save();renderSessExercise(d,exercises,vi);});
  setsArea.appendChild(addSetBtn);mainEl.appendChild(setsArea);
  // Note
  const noteArea=document.createElement('div');noteArea.className='sess-note-area';
  const noteLbl=document.createElement('div');noteLbl.style.cssText='font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:3px';noteLbl.textContent='📝 Note sur cet exercice';
  const noteInp=document.createElement('textarea');noteInp.className='sess-note-inp';noteInp.rows=2;noteInp.placeholder='Technique, douleur, sensation, amplitude...';noteInp.value=ex.note||'';
  noteInp.addEventListener('input',e=>{d.exercises[realIdx].note=e.target.value;save();});
  noteArea.appendChild(noteLbl);noteArea.appendChild(noteInp);mainEl.appendChild(noteArea);
  // Prev/Next
  const navBtns=document.createElement('div');navBtns.className='sess-nav-btns';
  const prevBtn=document.createElement('button');prevBtn.className='sess-nav-btn';prevBtn.textContent='← Préc.';prevBtn.disabled=vi===0;prevBtn.addEventListener('click',()=>{_sessActiveEx=vi-1;renderSessNav(d,exercises);renderSessExercise(d,exercises,vi-1);});
  const nextBtn=document.createElement('button');nextBtn.className='sess-nav-btn primary';nextBtn.textContent=vi===exercises.length-1?'Terminer ✓':'Suivant →';
  nextBtn.addEventListener('click',()=>{if(vi===exercises.length-1)showSessionComplete(S.sessDay,d);else{_sessActiveEx=vi+1;renderSessNav(d,exercises);renderSessExercise(d,exercises,vi+1);}});
  const sp=document.createElement('div');sp.style.flex='1';
  const ctr=document.createElement('span');ctr.style.cssText='font-size:11px;color:var(--muted);font-family:var(--mono)';ctr.textContent=(vi+1)+' / '+exercises.length;
  navBtns.appendChild(prevBtn);navBtns.appendChild(sp);navBtns.appendChild(ctr);navBtns.appendChild(nextBtn);mainEl.appendChild(navBtns);
}

function render1RMChart(container, exerciseName, color) {
  if (!container) return;
  const hist = exHist(exerciseName);
  if (hist.length < 2) return;
  const data = hist.slice(-12).map(r => ({
    label: 'S' + r.weekCount,
    value: calc1RM(r.weight, r.repsAchieved || r.reps) || parseFloat(r.weight) || 0,
  }));
  ChartEngine.line(container, [{data, color: color||'var(--teal)', fill: true}], {height: 80, yLabel: true});
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