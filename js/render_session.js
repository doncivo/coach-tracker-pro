/* ============================================================
   render_session.js — Page Séance + Focus mode
============================================================ */

/* ══ TIMER INTELLIGENT ══ */
function _suggestRestTime(ex) {
  const name   = (ex.name || '').toLowerCase();
  const repStr = (ex.reps || '8');
  const repNum = parseInt(repStr.match(/\d+/)?.[0] || '8');
  const compounds = ['squat', 'soulevé', 'deadlift', 'développé', 'bench',
    'tirage', 'traction', 'rowing', 'press', 'fente', 'hip thrust',
    'leg press', 'rdl', 'soulevé de terre', 'overhead'];
  const isCompound = compounds.some(c => name.includes(c));
  if (repNum <= 3)  return 240; // Force max : 4 min
  if (repNum <= 5)  return 180; // Lourd : 3 min
  if (isCompound && repNum <= 8)  return 150; // Compound modéré : 2:30
  if (isCompound)   return 120; // Compound léger : 2 min
  if (repNum <= 8)  return 90;  // Isolation lourd : 1:30
  return 60;                    // Isolation léger : 1 min
}

/* ══ MINI SPARKLINE HISTORIQUE POIDS ══ */
function _renderWeightSparkline(exName) {
  const hist = exHist(exName).slice(-10);
  const weights = hist.map(h => parseFloat(h.weight) || 0).filter(w => w > 0);
  if (weights.length < 2) return null;

  const W = 110, H = 28;
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;

  const pts = weights.map((w, i) => {
    const x = (i / (weights.length - 1)) * (W - 6) + 3;
    const y = H - 3 - ((w - min) / range) * (H - 6);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const dots = weights.map((w, i) => {
    const x = (i / (weights.length - 1)) * (W - 6) + 3;
    const y = H - 3 - ((w - min) / range) * (H - 6);
    const isLast = i === weights.length - 1;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${isLast ? 3 : 2}" fill="${isLast ? 'var(--teal-d)' : 'var(--teal)'}"/>`;
  }).join('');

  const trend = weights[weights.length - 1] > weights[0] ? '↑' : weights[weights.length - 1] < weights[0] ? '↓' : '→';
  const trendColor = trend === '↑' ? 'var(--green)' : trend === '↓' ? 'var(--red)' : 'var(--muted)';

  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;align-items:center;gap:6px;margin-top:5px;padding:4px 0';
  wrap.innerHTML = `
    <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="overflow:visible;flex-shrink:0">
      <polyline points="${pts}" fill="none" stroke="var(--teal)" stroke-width="1.5"
        stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/>
      ${dots}
    </svg>
    <div style="font-size:10px;line-height:1.4;color:var(--muted)">
      <div style="font-weight:600;color:${trendColor}">${trend} ${weights[weights.length-1]}kg</div>
      <div>${weights[0]}→${weights[weights.length-1]}kg · ${weights.length}s</div>
    </div>`;
  return wrap;
}

/* ══ SESSION MODE ══ */
/* _sessActiveEx — déclaré dans constants.js */
function renderSession(){
  startSessTimer();
  // Injecter bouton partage (share.js)
  if (typeof Share !== 'undefined') setTimeout(() => Share.injectShareButton(), 100);
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
  // Mini sparkline historique poids
  const sparkline = _renderWeightSparkline(ex.name);
  if (sparkline) sub.appendChild(sparkline);
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

  // ══ Vue Carte — remplace le tableau 8 colonnes ══
  const setsArea = document.createElement('div');
  setsArea.className = 'sess-sets-area';

  const setsLbl = document.createElement('div');
  setsLbl.className = 'sess-sets-label';
  const setsDoneCount = ex.setData.slice(0, nSets).filter(s => s.done).length;
  setsLbl.innerHTML = `<span>Séries</span><span style="font-family:var(--mono);font-size:11px;color:var(--teal-d)">${setsDoneCount}/${nSets} validées${ex.isWarmup ? ' · Échauffement' : ''}</span>`;
  setsArea.appendChild(setsLbl);

  const hasPrev = hist.length > 0;
  const cardsWrap = document.createElement('div');
  cardsWrap.className = 'set-cards';

  function refreshNavDots() {
    const navEl = document.getElementById('sess-nav');
    if (!navEl) return;
    const items = navEl.querySelectorAll('.sess-nav-item');
    const item  = items[vi];
    if (!item) return;
    const dots = item.querySelectorAll('.sess-nav-set-dot');
    const sd   = ex.setData.slice(0, nSets).filter(s => s.done).length;
    dots.forEach((dot, di) => dot.classList.toggle('dot-done', di < sd));
    if (ex.done) {
      const num2 = item.querySelector('.sess-nav-num');
      if (num2) { num2.classList.add('done-num'); num2.textContent = '✓'; }
    }
  }

  ex.setData.slice(0, nSets).forEach((setD, si) => {
    const isActive2 = !setD.done && si === ex.setData.slice(0, nSets).findIndex(s => !s.done);
    const card = document.createElement('div');
    card.className = 'set-card' + (setD.done ? ' done' : isActive2 ? ' active' : ex.isWarmup ? ' warmup' : '');

    // ── Ligne primaire : numéro + poids + × + reps + bouton Go ──
    const primary = document.createElement('div');
    primary.className = 'set-card-primary';

    const snum = document.createElement('div');
    snum.className = 'set-card-num';
    snum.textContent = setD.done ? '✓' : (si + 1);

    const wi = document.createElement('input');
    wi.type = 'text'; wi.inputMode = 'decimal';
    wi.className = 'set-card-inp set-card-weight';
    wi.value = setD.weight || ex.weight || '';
    wi.placeholder = 'kg';
    wi.addEventListener('input', e => {
      setD.weight = e.target.value;
      d.exercises[realIdx].weight = e.target.value;
      refreshSecondary(); save(); updateStats();
    });

    const sep = document.createElement('span');
    sep.className = 'set-card-sep'; sep.textContent = '×';

    const ri = document.createElement('input');
    ri.type = 'text'; ri.inputMode = 'numeric';
    ri.className = 'set-card-inp set-card-reps';
    ri.value = setD.reps || '';
    ri.placeholder = ex.reps || '?';
    ri.addEventListener('input', e => { setD.reps = e.target.value; refreshSecondary(); save(); });

    const valBtn = document.createElement('button');
    valBtn.className = 'set-card-go' + (setD.done ? ' validated' : '');
    valBtn.textContent = setD.done ? '✓' : '✓ Go';
    valBtn.setAttribute('touch-action', 'manipulation');

    [wi, ri].forEach(inp => inp.addEventListener('keydown', ev => {
      if (ev.key === 'Enter') { ev.preventDefault(); valBtn.click(); }
    }));

    primary.appendChild(snum);
    primary.appendChild(wi);
    primary.appendChild(sep);
    primary.appendChild(ri);
    primary.appendChild(valBtn);
    card.appendChild(primary);

    // ── Ligne secondaire : RPE, RIR, Vol, 1RM, Préc ──
    const secondary = document.createElement('div');
    secondary.className = 'set-card-secondary';

    const rpeSel = document.createElement('select');
    rpeSel.className = 'set-card-sel';
    RPE_OPTS.forEach(v => {
      const o = document.createElement('option');
      o.value = v; o.textContent = v;
      if (v === setD.rpe) o.selected = true;
      rpeSel.appendChild(o);
    });
    function applyRpeColor() {
      const r = parseFloat(rpeSel.value) || 0;
      rpeSel.style.color = r >= 9 ? 'var(--red)' : r >= 7.5 && r > 0 ? 'var(--orange)' : r > 0 ? 'var(--green)' : 'var(--muted)';
    }
    applyRpeColor();
    rpeSel.addEventListener('change', e => { setD.rpe = e.target.value; applyRpeColor(); save(); renderSessExercise(d, exercises, vi); });

    const rirSel = document.createElement('select');
    rirSel.className = 'set-card-sel';
    RIR_OPTS.forEach(v => {
      const o = document.createElement('option');
      o.value = v; o.textContent = v;
      if (v === setD.rir) o.selected = true;
      rirSel.appendChild(o);
    });
    rirSel.addEventListener('change', e => { setD.rir = e.target.value; save(); });

    const volSpan = document.createElement('span'); volSpan.className = 'set-card-stat set-vol-val';
    const rmSpan  = document.createElement('span'); rmSpan.className  = 'set-card-stat set-1rm-val';

    function refreshSecondary() {
      const w = parseFloat(wi.value) || 0;
      const r = parseInt(ri.value)   || 0;
      volSpan.textContent = w && r && !ex.isWarmup ? '📦 ' + Math.round(w * r) + 'kg' : '';
      const rm = calc1RM(wi.value, ri.value);
      rmSpan.textContent  = rm && !ex.isWarmup ? '🏋 ' + rm + 'kg' : '';
      const setsDone2 = ex.setData.slice(0, nSets).filter(s => s.done).length;
      setsLbl.innerHTML = `<span>Séries</span><span style="font-family:var(--mono);font-size:11px;color:var(--teal-d)">${setsDone2}/${nSets} validées</span>`;
      updateSessProgress(d, exercises);
    }
    refreshSecondary();

    const rpeWrap = document.createElement('label'); rpeWrap.className = 'set-card-label';
    rpeWrap.innerHTML = 'RPE '; rpeWrap.appendChild(rpeSel);
    const rirWrap = document.createElement('label'); rirWrap.className = 'set-card-label';
    rirWrap.innerHTML = 'RIR '; rirWrap.appendChild(rirSel);

    secondary.appendChild(rpeWrap);
    secondary.appendChild(rirWrap);
    secondary.appendChild(volSpan);
    secondary.appendChild(rmSpan);

    if (hasPrev) {
      const ph = hist[0];
      const prevSpan = document.createElement('span');
      prevSpan.className = 'set-card-stat set-prev-val';
      prevSpan.style.color = 'var(--muted)';
      prevSpan.textContent = ph ? `Préc: ${ph.weight}×${ph.repsAchieved || ph.reps || '?'}` : '';
      secondary.appendChild(prevSpan);
    }

    card.appendChild(secondary);

    // ── Validation ──
    function doValidate() {
      setD.done = !setD.done;
      valBtn.className  = 'set-card-go' + (setD.done ? ' validated' : '');
      valBtn.textContent = setD.done ? '✓' : '✓ Go';
      snum.textContent  = setD.done ? '✓' : (si + 1);
      card.className    = 'set-card' + (setD.done ? ' done' : ex.isWarmup ? ' warmup' : '');

      if (setD.done) {
        const restSec    = parseInt(ex.rest) || S._restDuration || _suggestRestTime(ex) || 90;
        const nextSetIdx = ex.setData.slice(0, nSets).findIndex((s, idx) => idx > si && !s.done);
        const hasNextSet = nextSetIdx !== -1;
        RestTimer.start(restSec, ex.name, hasNextSet ? () => {
          const cards2 = cardsWrap.querySelectorAll('.set-card');
          if (cards2[nextSetIdx]) cards2[nextSetIdx].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } : null);
      }

      const allDone2 = ex.setData.filter(s => s.done);
      d.exercises[realIdx].repsAchieved = allDone2.map(s => s.reps).filter(Boolean).join('/');

      if (ex.setData.slice(0, nSets).every(s => s.done)) {
        const wasPR = checkPR(d.exercises[realIdx]);
        d.exercises[realIdx].done = true;
        numBadge.className  = 'sess-ex-num-big done';
        numBadge.textContent = '✓';
        if (checkPR(d.exercises[realIdx]) && !wasPR) showPRToast(ex.name);
        const nextVi = exercises.findIndex((e, i) => i > vi && !e.done);
        if (nextVi >= 0) setTimeout(() => { _sessActiveEx = nextVi; renderSessNav(d, exercises); renderSessExercise(d, exercises, nextVi); }, 1200);
      }
      refreshNavDots(); refreshSecondary(); resetChrono(); startChrono(); save(); updateStats(); renderDayTabs(); updateSessProgress(d, exercises);
      if (d.exercises.filter(e => e.name.trim() && !e.isWarmup).every(e => e.done)) showSessionComplete(S.sessDay, d);
    }

    valBtn.ontouchstart = function(e) { e.preventDefault(); e.stopPropagation(); doValidate(); };
    valBtn.onclick      = function() { doValidate(); };

    cardsWrap.appendChild(card);
  });

  setsArea.appendChild(cardsWrap);

  const addSetBtn = document.createElement('button');
  addSetBtn.className   = 'sess-add-set-btn';
  addSetBtn.textContent = '+ Ajouter une série';
  addSetBtn.addEventListener('click', () => {
    ex.setData.push({ weight: ex.weight || '', reps: '', done: false, rpe: '', rir: '' });
    d.exercises[realIdx].sets = String((parseInt(ex.sets) || nSets) + 1);
    ex.sets = d.exercises[realIdx].sets;
    save(); renderSessExercise(d, exercises, vi);
  });
  setsArea.appendChild(addSetBtn);
  mainEl.appendChild(setsArea);
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

/* ══ FOCUS MODE ══ */
document.getElementById('focus-btn').addEventListener('click',()=>openFocusMode());
document.getElementById('sess-focus-btn').addEventListener('click',()=>openFocusMode());
function openFocusMode(){
  const overlay=document.getElementById('focus-overlay');overlay.style.display='flex';overlay.innerHTML='';
  const d=S.days[S.sessDay];const exercises=d.exercises.filter(e=>e.name.trim());const ex=exercises[_sessActiveEx]||exercises[0];if(!ex){overlay.style.display='none';return;}
  const realIdx=d.exercises.indexOf(ex);const nSets=parseInt(ex.sets)||3;
  if(!ex.setData||ex.setData.length<nSets)ex.setData=Array.from({length:nSets},()=>({weight:ex.weight||'',reps:'',done:false,rpe:'',rir:''}));
  const top=document.createElement('div');top.className='focus-top';
  const name=document.createElement('div');name.className='focus-ex-name';name.textContent=ex.name;
  const exit=document.createElement('button');exit.className='focus-exit';exit.textContent='✕ Quitter';exit.addEventListener('click',()=>{overlay.style.display='none';renderSession();});
  const meta=document.createElement('div');meta.style.cssText='font-size:11px;opacity:.8';meta.textContent=`${ex.sets}×${ex.reps} · Préc: ${lastW(ex.name)||'—'}`;
  top.appendChild(name);const topInfo=document.createElement('div');topInfo.style.cssText='display:flex;flex-direction:column;gap:2px;flex:1;margin-left:10px';topInfo.appendChild(meta);top.appendChild(topInfo);top.appendChild(exit);
  overlay.appendChild(top);
  const body=document.createElement('div');body.className='focus-body';
  // Chrono
  const chronoDiv=document.createElement('div');chronoDiv.className='focus-chrono';
  const chronoTime=document.createElement('div');chronoTime.id='focus-chrono-time';chronoTime.className='focus-chrono-time';chronoTime.textContent='0:00';
  const chronoPrev=document.createElement('div');chronoPrev.className='focus-prev';chronoPrev.textContent=`Dernier: ${lastW(ex.name)||'—'}`;
  chronoDiv.appendChild(chronoTime);chronoDiv.appendChild(chronoPrev);body.appendChild(chronoDiv);
  // Sets
  ex.setData.slice(0,nSets).forEach((setD,si)=>{
    const row=document.createElement('div');row.className='focus-set-row'+(setD.done?' f-done':si===ex.setData.findIndex(s=>!s.done)?' f-active':'');
    const sn=document.createElement('div');sn.style.cssText='font-size:12px;font-weight:700;color:var(--muted);width:24px';sn.textContent=setD.done?'✓':(si+1);
    const wi=document.createElement('input');wi.type='text';wi.className='focus-inp';wi.value=setD.weight||ex.weight||'';wi.placeholder='kg';wi.addEventListener('input',e=>{setD.weight=e.target.value;save();});
    const u1=document.createElement('span');u1.className='focus-unit';u1.textContent='kg ×';
    const ri=document.createElement('input');ri.type='number';ri.className='focus-inp';ri.value=setD.reps||'';ri.placeholder='reps';ri.style.width='70px';ri.addEventListener('input',e=>{setD.reps=e.target.value;save();});
    const u2=document.createElement('span');u2.className='focus-unit';u2.textContent='reps';
    const vb=document.createElement('button');vb.className='focus-val-btn'+(setD.done?' f-validated':'');vb.textContent=setD.done?'✓ Fait':'✓';
    [wi,ri].forEach(inp=>inp.addEventListener('keydown',ev=>{if(ev.key==='Enter'){ev.preventDefault();vb.click();}}));
    vb.addEventListener('click',()=>{setD.done=!setD.done;vb.className='focus-val-btn'+(setD.done?' f-validated':'');vb.textContent=setD.done?'✓ Fait':'✓';row.className='focus-set-row'+(setD.done?' f-done':'');sn.textContent=setD.done?'✓':(si+1);if(setD.done){d.exercises[realIdx].repsAchieved=ex.setData.filter(s=>s.done).map(s=>s.reps).join('/');resetChrono();startChrono();}if(ex.setData.slice(0,nSets).every(s=>s.done)){d.exercises[realIdx].done=true;showToast('✅ Exercice terminé !','save');}save();updateStats();renderDayTabs();});
    row.appendChild(sn);row.appendChild(wi);row.appendChild(u1);row.appendChild(ri);row.appendChild(u2);row.appendChild(vb);body.appendChild(row);
  });
  overlay.appendChild(body);updateChronoDsp();
}

/* ══ PROGRESSION ══ */

/* ══════════════════════════════════════════════════════
   CHART ENGINE — Canvas 2D ultra-léger, zéro dépendance
   ══════════════════════════════════════════════════════ */
const ChartEngine = {
  /* Résout une CSS var en couleur réelle */
  _resolveColor(cv) {
    if (!cv || !cv.startsWith('var(')) return cv || '#5ba8a0';
    const name = cv.slice(4, -1);
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#5ba8a0';
  },

  /* Crée ou recycle un canvas dans un conteneur */
  _canvas(container, h) {
    let cv = container.querySelector('canvas');
    if (!cv) { cv = document.createElement('canvas'); cv.style.cssText = 'width:100%;display:block'; container.appendChild(cv); }
    const W = container.clientWidth || 320;
    cv.width = W; cv.height = h;
    return { cv, ctx: cv.getContext('2d'), W, H: h };
  },

  /* LINE CHART — data: [{label, value, color?}] */
  line(container, datasets, opts = {}) {
    const H = opts.height || 120;
    const { cv, ctx, W, H: CH } = this._canvas(container, H);
    const pad = { t: 10, r: 14, b: 28, l: opts.yLabel ? 38 : 8 };
    const inner = { w: W - pad.l - pad.r, h: CH - pad.t - pad.b };

    // Background
    ctx.clearRect(0, 0, W, CH);

    const allVals = datasets.flatMap(ds => ds.data.map(p => p.value));
    if (!allVals.length) { this._noData(ctx, W, CH); return; }
    const minV = opts.min !== undefined ? opts.min : Math.min(...allVals);
    const maxV = opts.max !== undefined ? opts.max : Math.max(...allVals);
    const range = maxV - minV || 1;

    const toX = i => pad.l + (i / (Math.max(...datasets.map(d => d.data.length)) - 1 || 1)) * inner.w;
    const toY = v => pad.t + (1 - (v - minV) / range) * inner.h;

    // Grid lines
    ctx.strokeStyle = this._resolveColor('var(--border)');
    ctx.lineWidth = 0.5;
    [0, 0.25, 0.5, 0.75, 1].forEach(f => {
      const y = pad.t + f * inner.h;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
      if (opts.yLabel) {
        const val = Math.round(maxV - f * range);
        ctx.fillStyle = this._resolveColor('var(--muted)');
        ctx.font = '9px DM Mono,monospace'; ctx.textAlign = 'right';
        ctx.fillText(val, pad.l - 4, y + 3);
      }
    });

    // Datasets
    datasets.forEach(ds => {
      if (!ds.data.length) return;
      const col = this._resolveColor(ds.color || 'var(--teal)');
      ctx.strokeStyle = col; ctx.lineWidth = ds.width || 2.5;
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      if (ds.dashed) ctx.setLineDash([5, 4]);
      else ctx.setLineDash([]);

      // Fill under
      if (ds.fill) {
        const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + inner.h);
        grad.addColorStop(0, col + '33'); grad.addColorStop(1, col + '05');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ds.data.forEach((p, i) => { const x = toX(i), y = toY(p.value); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
        ctx.lineTo(toX(ds.data.length - 1), pad.t + inner.h);
        ctx.lineTo(toX(0), pad.t + inner.h);
        ctx.closePath(); ctx.fill();
      }

      // Line
      ctx.beginPath();
      ds.data.forEach((p, i) => { const x = toX(i), y = toY(p.value); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
      ctx.stroke();
      ctx.setLineDash([]);

      // Dots + labels
      ds.data.forEach((p, i) => {
        const x = toX(i), y = toY(p.value);
        ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = col; ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
      });
    });

    // X labels
    const labels = datasets[0]?.data.map(p => p.label) || [];
    ctx.fillStyle = this._resolveColor('var(--muted)');
    ctx.font = '9px DM Sans,sans-serif'; ctx.textAlign = 'center';
    const step = Math.ceil(labels.length / 7);
    labels.forEach((lbl, i) => {
      if (i % step !== 0 && i !== labels.length - 1) return;
      ctx.fillText(lbl, toX(i), CH - 4);
    });
  },

  /* BAR CHART — datasets: [{label, value, color?}] */
  bar(container, data, opts = {}) {
    const H = opts.height || 110;
    const { cv, ctx, W, H: CH } = this._canvas(container, H);
    const pad = { t: 10, r: 8, b: 24, l: opts.yLabel ? 36 : 6 };
    const inner = { w: W - pad.l - pad.r, h: CH - pad.t - pad.b };

    ctx.clearRect(0, 0, W, CH);
    if (!data.length) { this._noData(ctx, W, CH); return; }

    const maxV = Math.max(...data.map(d => d.value), 1);
    const gap = 3, bw = (inner.w - gap * (data.length - 1)) / data.length;

    // Grid
    ctx.strokeStyle = this._resolveColor('var(--border)');
    ctx.lineWidth = 0.5;
    [0.5, 1].forEach(f => {
      const y = pad.t + (1 - f) * inner.h;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
    });

    data.forEach((d, i) => {
      const x = pad.l + i * (bw + gap);
      const barH = (d.value / maxV) * inner.h;
      const y = pad.t + inner.h - barH;
      const col = this._resolveColor(d.color || 'var(--teal)');

      const grad = ctx.createLinearGradient(0, y, 0, y + barH);
      grad.addColorStop(0, col); grad.addColorStop(1, col + '88');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(x, y, bw, barH, [3, 3, 0, 0]) : ctx.rect(x, y, bw, barH);
      ctx.fill();

      ctx.fillStyle = this._resolveColor('var(--muted)');
      ctx.font = '9px DM Sans,sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(d.label, x + bw / 2, CH - 4);

      if (d.value > 0) {
        ctx.fillStyle = this._resolveColor('var(--text)');
        ctx.font = 'bold 9px DM Mono,monospace';
        const valStr = d.value >= 1000 ? (d.value/1000).toFixed(1)+'k' : String(d.value);
        ctx.fillText(valStr, x + bw / 2, y - 2);
      }
    });
  },

  /* RADAR CHART — axes: [{label, value (0-1)}] */
  radar(container, axes, opts = {}) {
    const size = opts.size || Math.min(container.clientWidth || 200, 200);
    let cv = container.querySelector('canvas');
    if (!cv) { cv = document.createElement('canvas'); container.appendChild(cv); }
    cv.width = size; cv.height = size;
    cv.style.display = 'block'; cv.style.margin = '0 auto';
    const ctx = cv.getContext('2d');
    const cx = size / 2, cy = size / 2, R = size * 0.38;
    const N = axes.length;
    const angle = i => (Math.PI * 2 / N) * i - Math.PI / 2;

    ctx.clearRect(0, 0, size, size);
    if (!axes.length) return;

    // Grid rings
    [0.25, 0.5, 0.75, 1].forEach(f => {
      ctx.beginPath();
      axes.forEach((_, i) => {
        const a = angle(i), x = cx + Math.cos(a) * R * f, y = cy + Math.sin(a) * R * f;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.strokeStyle = this._resolveColor('var(--border)');
      ctx.lineWidth = f === 1 ? 1.2 : 0.5; ctx.stroke();
    });

    // Spokes
    axes.forEach((_, i) => {
      const a = angle(i);
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      ctx.strokeStyle = this._resolveColor('var(--border)'); ctx.lineWidth = 0.5; ctx.stroke();
    });

    // Data polygon
    const col = this._resolveColor(opts.color || 'var(--teal)');
    ctx.beginPath();
    axes.forEach((ax, i) => {
      const a = angle(i), v = Math.min(1, Math.max(0, ax.value));
      const x = cx + Math.cos(a) * R * v, y = cy + Math.sin(a) * R * v;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = col + '33'; ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke();

    // Dots
    axes.forEach((ax, i) => {
      const a = angle(i), v = Math.min(1, Math.max(0, ax.value));
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * R * v, cy + Math.sin(a) * R * v, 4, 0, Math.PI * 2);
      ctx.fillStyle = col; ctx.fill();
    });

    // Labels
    axes.forEach((ax, i) => {
      const a = angle(i), x = cx + Math.cos(a) * (R + 14), y = cy + Math.sin(a) * (R + 14);
      ctx.fillStyle = this._resolveColor('var(--text)');
      ctx.font = 'bold 9px DM Sans,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(ax.label, x, y);
    });
  },

  _noData(ctx, W, H) {
    ctx.fillStyle = '#aaa'; ctx.font = '11px DM Sans,sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Aucune donnée', W / 2, H / 2);
  },
};


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

function renderProgression(){
  const mf=document.getElementById('prog-muscle-filter');const cv=mf.value;mf.innerHTML='<option value="">Tous les groupes</option>';
  MUSCLES.filter(m=>m.key!=='rep').forEach(m=>{const o=document.createElement('option');o.value=m.key;o.textContent=m.label;if(m.key===cv)o.selected=true;mf.appendChild(o);});
  const wLimit=document.getElementById('prog-weeks-filter').value;
  const cards=document.getElementById('prog-cards');
  // Render summary charts in progression tab
  const progChartsSection = document.getElementById('prog-charts-section');
  if(progChartsSection){
    progChartsSection.innerHTML='';
    // Weekly volume trend
    const volWrap = document.createElement('div');
    progChartsSection.appendChild(volWrap);
    const volData = computeWeeklyVolume(12);
    const {wrap:vw,canvas:vc}=mkChartWrap('prog-vol','📊 Volume hebdomadaire (12 semaines)','kg·reps');
    volWrap.appendChild(vw);
    setTimeout(()=>Charts.barChart(vc,volData,{height:140,yFmt:v=>v>=1000?Math.round(v/1000)+'k':Math.round(v)}),50);

    // Poids evolution
    const weightEntries=(S.mesures.poids||[]).slice().sort((a,b)=>a.date.localeCompare(b.date));
    if(weightEntries.length>1){
      const wWrap=document.createElement('div');
      progChartsSection.appendChild(wWrap);
      const {wrap:ww,canvas:wc}=mkChartWrap('prog-weight','⚖️ Poids corporel',`Objectif: ${S.objective?.targetWeight||'—'}kg`);
      wWrap.appendChild(ww);
      const targetW=parseFloat(S.objective&&S.objective.targetWeight)||null;
      setTimeout(()=>Charts.lineChart(wc,[{label:'Poids',values:weightEntries.map(e=>({x:e.date,y:parseFloat(e.val)||0})),color:'--teal'}],{height:130,goal:targetW||undefined,yFmt:v=>v.toFixed(1)+'kg'}),50);
    }
  }

cards.innerHTML='';
  const allNames=new Set();
  Object.values(S.history).forEach(wk=>(wk.days||[]).forEach(d=>(d.exercises||[]).forEach(ex=>{if(ex.name&&ex.weight&&!ex.isWarmup)allNames.add(ex.name);})));
  S.days.forEach(d=>d.exercises.filter(e=>!e.isWarmup).forEach(ex=>{if(ex.name&&ex.weight)allNames.add(ex.name);}));
  if(!allNames.size){cards.innerHTML='<div class="prog-no-data">💡 Aucune donnée. Renseignez des poids ou cliquez "Données démo".</div>';return;}
  const filter=mf.value;
  const filteredNames=[...allNames].filter(name=>{if(!filter)return true;return S.days.some(d=>d.exercises.some(e=>e.name===name&&e.muscle===filter));});
  filteredNames.forEach(name=>{
    let hist=exHist(name);
    S.days.forEach(d=>d.exercises.filter(e=>!e.isWarmup).forEach(ex=>{if(ex.name===name&&ex.weight)hist.push({weekKey:'current',weekCount:S.weekCount,weight:ex.weight,repsAchieved:ex.repsAchieved,sets:ex.sets,reps:ex.reps,done:ex.done});}));
    if(wLimit!=='all')hist=hist.slice(-parseInt(wLimit));if(!hist.length)return;
    const ex0=S.days.flatMap(d=>d.exercises).find(e=>e.name===name)||{};const m=MM[ex0.muscle||''];
    const isPlat=isPlateau(name);
    const card=document.createElement('div');card.className='prog-card';
    const hdr=document.createElement('div');hdr.className='prog-card-hdr';
    const nm=document.createElement('div');nm.className='prog-card-name';nm.textContent=name;nm.title=name;
    let best1rm=0;hist.forEach(r=>{const rm=calc1RM(r.weight,r.repsAchieved||r.reps);if(rm>best1rm)best1rm=rm;});
    const pill=document.createElement('span');if(m){pill.style.cssText=`background:${m.calBg};color:${m.calColor};font-size:8px;font-weight:700;padding:2px 6px;border-radius:8px`;pill.textContent=m.label;}
    const rm1=document.createElement('span');rm1.style.cssText='font-size:9px;color:var(--purple);font-weight:700;flex-shrink:0';if(best1rm)rm1.textContent='1RM≈'+best1rm+'kg';
    if(isPlat){const pb=document.createElement('span');pb.className='badge-plateau';pb.textContent='⚠ Plateau';hdr.appendChild(pb);}
    hdr.appendChild(nm);hdr.appendChild(pill);hdr.appendChild(rm1);card.appendChild(hdr);
    const body=document.createElement('div');body.className='prog-card-body';
    // Overload badge
    const curEx=S.days.flatMap(d=>d.exercises).find(e=>e.name===name&&!e.isWarmup);
    if(curEx&&shouldOverload(curEx)){const cw=parseFloat(curEx.weight)||0;const sug=Math.round((cw*1.025)/2.5)*2.5;const badge=document.createElement('div');badge.className='badge-overload';badge.style.marginBottom='6px';badge.textContent='⬆ Surcharge: '+sug+'kg (+2.5%)';body.appendChild(badge);}
    if(curEx&&checkPR(curEx)){const pb=document.createElement('div');pb.className='badge-pr';pb.style.marginBottom='6px';pb.textContent='🏆 PR actuel';body.appendChild(pb);}
    if(isPlat){const tips=document.createElement('div');tips.style.cssText='font-size:9px;color:var(--muted);margin-bottom:6px;font-style:italic';tips.textContent='💡 Suggestions: changer la fourchette de reps, modifier le tempo, varier l\'angle.';body.appendChild(tips);}
    // Strength standard
    const lastPoids=(S.mesures.poids||[]).slice(-1)[0];
    if(lastPoids&&curEx&&curEx.weight){const std=strengthStandard(curEx,parseFloat(lastPoids.val));if(std){const sb=document.createElement('div');sb.className='std-comparison';sb.textContent=`Niveau: ${std.level} (${Math.round((parseFloat(curEx.weight)||0)/parseFloat(lastPoids.val)*100)}% du poids corporel)`;body.appendChild(sb);}}
    // Prediction (linear regression)
    if(hist.length>=3){
      const weights=hist.map((r,i)=>({x:i,y:parseFloat(r.weight)||0})).filter(p=>p.y>0);
      if(weights.length>=3){
        const n=weights.length;const sumX=weights.reduce((a,p)=>a+p.x,0);const sumY=weights.reduce((a,p)=>a+p.y,0);const sumXY=weights.reduce((a,p)=>a+p.x*p.y,0);const sumX2=weights.reduce((a,p)=>a+p.x*p.x,0);
        const slope=(n*sumXY-sumX*sumY)/(n*sumX2-sumX*sumX);const intercept=(sumY-slope*sumX)/n;
        const pred4=Math.round((slope*(n+3)+intercept)*10)/10;const pred8=Math.round((slope*(n+7)+intercept)*10)/10;
        if(slope>0&&pred4>0){const pred=document.createElement('div');pred.style.cssText='font-size:9px;color:var(--purple);margin-bottom:6px;font-style:italic';pred.textContent=`📈 Projection: +4 sem. → ${pred4}kg · +8 sem. → ${pred8}kg`;body.appendChild(pred);}
      }
    }
    // History table
    // 1RM chart
    if(hist.length>1){const chartDiv=document.createElement('div');chartDiv.style.cssText='height:80px;margin-bottom:8px';body.appendChild(chartDiv);setTimeout(()=>render1RMChart(chartDiv,name,m?m.calColor:'var(--teal)'),50);}
    const t=document.createElement('table');t.className='prog-table';t.innerHTML='<thead><tr><th>Sem.</th><th>Poids</th><th>Sér.</th><th>Reps</th><th>1RM</th><th>Δ</th><th>RPE moy.</th></tr></thead>';
    const tb=document.createElement('tbody');
    hist.forEach((row,ri)=>{const tr2=document.createElement('tr');const prev=ri>0?hist[ri-1]:null;const wC=parseFloat(row.weight)||0;const wP=prev?parseFloat(prev.weight)||0:0;const delta=prev?(wC-wP):0;const rm=calc1RM(row.weight,row.repsAchieved||row.reps);const wkLbl=row.weekKey==='current'?'<span style="color:var(--teal-d);font-weight:700">Actuel</span>':'S'+row.weekCount;const deltaHtml=ri===0?'<span class="prog-delta-eq">—</span>':delta>0?`<span class="prog-delta-up">+${delta}kg</span>`:delta<0?`<span class="prog-delta-down">${delta}kg</span>`:'<span class="prog-delta-eq">—</span>';tr2.innerHTML=`<td class="prog-table td">${wkLbl}</td><td>${row.weight}</td><td>${row.sets||'—'}</td><td>${row.repsAchieved||row.reps||'—'}</td><td style="color:var(--purple)">${rm||'—'}</td><td>${deltaHtml}</td><td style="color:var(--muted)">—</td>`;tb.appendChild(tr2);});
    t.appendChild(tb);body.appendChild(t);
    // Canvas chart
    if(hist.length>1){const canvas=document.createElement('canvas');canvas.className='prog-canvas';canvas.height=55;body.appendChild(canvas);setTimeout(()=>{const W=canvas.offsetWidth||270;canvas.width=W;const ctx=canvas.getContext('2d');const weights=hist.map(r=>parseFloat(r.weight)||0);const minW=Math.min(...weights),maxW=Math.max(...weights);const pad=8,cH=48;ctx.clearRect(0,0,W,55);ctx.strokeStyle=m?m.calColor:'var(--teal)';ctx.lineWidth=2;ctx.lineJoin='round';ctx.beginPath();const step=(W-pad*2)/(hist.length-1||1);weights.forEach((w,i)=>{const x=pad+i*step;const y=maxW===minW?cH/2:pad+(1-(w-minW)/(maxW-minW))*(cH-pad*2);i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);});ctx.stroke();// Prediction dotted line
    weights.forEach((w,i)=>{const x=pad+i*step;const y=maxW===minW?cH/2:pad+(1-(w-minW)/(maxW-minW))*(cH-pad*2);ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.fillStyle=m?m.calColor:'var(--teal)';ctx.fill();ctx.fillStyle='#999';ctx.font='8px DM Mono,monospace';ctx.textAlign='center';ctx.fillText(w,x,53);});},100);}
    card.appendChild(body);cards.appendChild(card);
  });
  if(!cards.children.length)cards.innerHTML='<div class="prog-no-data">Aucun exercice correspondant.</div>';
}
document.getElementById('prog-muscle-filter').addEventListener('change',renderProgression);
document.getElementById('prog-weeks-filter').addEventListener('change',renderProgression);
document.getElementById('gen-sample-data').addEventListener('click',async()=>{
  const _demoOk=await Modal.confirm('Générer des données de démonstration sur 8 semaines ?');if(!_demoOk)return;
  const exes=[{name:'Développé incliné haltères (prise neutre)',muscle:'pec',baseW:28,inc:1.25},{name:'Tirage vertical poulie prise neutre',muscle:'dos',baseW:55,inc:2.5},{name:'Presse à cuisses',muscle:'jam',baseW:80,inc:5},{name:'Curl incliné haltères',muscle:'bic',baseW:14,inc:1},{name:'Pushdown corde',muscle:'tri',baseW:20,inc:1.25},{name:'Hip thrust barre',muscle:'jam',baseW:60,inc:2.5}];
  for(let w=1;w<=8;w++){const key=localDateStr(new Date(Date.now()-(9-w)*7*86400000));S.history[key]={weekType:w%2===0?'B':'A',weekCount:w,block:w<=4?'Accumulation':'Intensification',days:Array.from({length:7},(_,di)=>{const prog=PA[di];return{date:key,muscles:[...((prog&&prog.muscles)||[])],exercises:((prog&&prog.exercises)||[]).map(ex=>{const base=exes.find(e=>e.name===ex.name);const wt=base?base.baseW+(w-1)*base.inc:0;return Object.assign({},ex,{weight:wt?String(wt):'',repsAchieved:String(8+Math.floor(Math.random()*3)),rpe:String(7+Math.random().toFixed(1)),done:true,isWarmup:ex.isWarmup||false});})};})}}
  save();renderProgression();showToast('Données démo générées ✓','save');
});
