/* ============================================================
   render_bilan.js — Bilan + KPI + Progression
============================================================ */

/* ══ BILAN ══ */
function renderBilan(){
  const offset=S.bilanOffset||0;const lbl=document.getElementById('bilan-week-lbl');
  lbl.textContent=offset===0?'Semaine courante':offset===-1?'Semaine précédente':'Sem. '+Math.abs(offset)+' avant';
  const cont=document.getElementById('bilan-content');cont.innerHTML='';
  const days=offset===0?S.days:(()=>{const keys=Object.keys(S.history).sort();const idx=keys.length+offset;if(idx<0||idx>=keys.length)return null;return(S.history[keys[idx]]||{}).days;})();
  if(!days){cont.innerHTML='<div style="text-align:center;padding:40px;color:var(--muted)">Aucune donnée pour cette période.</div>';return;}
  let totalEx=0,doneEx=0,activeDays=0,totalVol=0;const volByMuscle={};const dayComp=[];
  days.forEach((d,i)=>{const exs=(d.exercises||[]).filter(e=>e.name&&e.name.trim()&&!e.isWarmup);totalEx+=exs.length;const dn=exs.filter(e=>e.done).length;doneEx+=dn;const pct=exs.length>0?Math.round(dn/exs.length*100):0;dayComp.push({day:DAYS_SH[i],pct,done:dn,total:exs.length,bg:DAY_BG[i]});if(exs.length>0)activeDays++;exs.forEach(ex=>{const v=calcVol(ex);totalVol+=v;if(ex.muscle&&v)volByMuscle[ex.muscle]=(volByMuscle[ex.muscle]||0)+v;});});
  const weeksN=S.weekCount||1;const deloadDue=weeksN%5===0&&offset===0;
  if(deloadDue)cont.appendChild(Object.assign(document.createElement('div'),{className:'alert alert-warn',textContent:'🔄 Deload recommandé ! Réduisez le volume de 40% cette semaine.'}));
  // Sleep / nutrition correlation
  // avgSleep: use last 7 calendar days, not random 7 keys
  const _today7=new Date();
  const _sleepVals=Array.from({length:7},(_,i)=>{const d=new Date(_today7);d.setDate(d.getDate()-i);const k=localDateStr(d);return S.sleep&&S.sleep[k]?parseFloat(S.sleep[k].hours||0):0;}).filter(h=>h>0);
  const avgSleep=_sleepVals.length?Math.round(_sleepVals.reduce((a,b)=>a+b,0)/_sleepVals.length*10)/10:0;
  if(avgSleep>0&&avgSleep<6)cont.appendChild(Object.assign(document.createElement('div'),{className:'alert alert-warn',textContent:`😴 Sommeil moyen: ${Math.round(avgSleep*10)/10}h — Insuffisant pour la récupération musculaire (recommandé: 7-9h).`}));
  const grid=document.createElement('div');grid.className='bilan-grid';
  function bc(title){const c=document.createElement('div');c.className='bilan-card';const t=document.createElement('div');t.className='bilan-card-title';t.textContent=title;c.appendChild(t);return c;}
  const c1=bc('Complétion globale');c1.innerHTML+=`<div class="bilan-big">${totalEx>0?Math.round(doneEx/totalEx*100):0}%</div><div class="bilan-sub">${doneEx}/${totalEx} exercices · ${activeDays} jours actifs</div>`;grid.appendChild(c1);
  const c2=bc('Volume total');
  // S vs S-1 comparison
  let volPrev=0;
  const histKeys=Object.keys(S.history).sort();
  if(histKeys.length>0){
    const prevKey=histKeys[histKeys.length-1+(offset===0?0:offset-1)];
    const prevDays=(S.history[prevKey]||{}).days||[];
    prevDays.forEach(d=>(d.exercises||[]).forEach(ex=>{volPrev+=calcVol(ex);}));
  }
  const volDiff=totalVol-volPrev;
  const volDiffPct=volPrev>0?Math.round(volDiff/volPrev*100):0;
  const volDiffStr=volPrev>0?(volDiff>=0?'▲':'▼')+Math.abs(volDiffPct)+'% vs sem. préc.':'';
  const volDiffColor=volDiff>=0?'var(--green)':'var(--red)';
  c2.innerHTML+=`<div class="bilan-big">${Math.round(totalVol/1000*10)/10}<span style="font-size:13px;color:var(--muted)"> t</span></div>
    ${volDiffStr?`<div style="font-size:11px;color:${volDiffColor};font-weight:700;margin-top:2px">${volDiffStr}</div>`:''}
    <div class="bilan-sub">Séries de travail (hors éch.)</div>`;
  grid.appendChild(c2);
  const c3=bc('Par jour');dayComp.forEach((dc,i)=>{const row=document.createElement('div');row.className='bilan-day-row';row.style.background=DAY_BG[i];const dot=document.createElement('div');dot.className='bilan-day-dot';dot.style.background=dc.pct===100?'var(--green)':dc.pct>0?'var(--orange)':'var(--border)';const name=document.createElement('span');name.style.fontWeight='600';name.textContent=dc.day;const bar=document.createElement('div');bar.style.cssText='flex:1;height:4px;background:rgba(0,0,0,.1);border-radius:2px;overflow:hidden';const fill=document.createElement('div');fill.style.cssText=`width:${dc.pct}%;height:100%;background:${dc.pct===100?'var(--green)':'var(--teal)'};border-radius:2px`;bar.appendChild(fill);const ps=document.createElement('span');ps.style.cssText='font-family:var(--mono);font-size:9px;color:var(--muted)';ps.textContent=dc.total>0?dc.pct+'%':'—';row.appendChild(dot);row.appendChild(name);row.appendChild(bar);row.appendChild(ps);c3.appendChild(row);});grid.appendChild(c3);
  const c4=bc('Volume par groupe');const maxV=Math.max(...Object.values(volByMuscle),1);MK.filter(k=>volByMuscle[k]).sort((a,b)=>volByMuscle[b]-volByMuscle[a]).forEach(k=>{const m=MM[k];const vv=volByMuscle[k];const row=document.createElement('div');row.className='vol-row';const lb=document.createElement('div');lb.className='vol-label';lb.textContent=m.label;lb.title=m.label;const bar=document.createElement('div');bar.className='bar-wrap';const fill=document.createElement('div');fill.className='bar-fill';fill.style.cssText=`width:${Math.round(vv/maxV*100)}%;background:${m.calColor}`;bar.appendChild(fill);const num=document.createElement('div');num.className='vol-num';num.textContent=Math.round(vv/1000*10)/10+'t';row.appendChild(lb);row.appendChild(bar);row.appendChild(num);c4.appendChild(row);});if(!Object.keys(volByMuscle).length)c4.innerHTML+='<div style="color:var(--muted);font-size:10px">Renseignez les poids.</div>';grid.appendChild(c4);
  const pp=pushPull();const tot=pp.push+pp.pull||1;const ppPct=Math.round(pp.push/tot*100),plPct=100-ppPct;const balanced=Math.abs(ppPct-50)<15;const c5=bc('Ratio Push/Pull');c5.innerHTML+=`<div style="display:flex;height:10px;border-radius:5px;overflow:hidden;margin-top:6px"><div style="width:${ppPct}%;background:#ffe0ea"></div><div style="width:${plPct}%;background:#e0d8ff"></div></div><div style="display:flex;justify-content:space-between;margin-top:4px;font-size:9px"><span style="color:#c0506a;font-weight:600">Push ${ppPct}%</span><span style="color:#6050b0;font-weight:600">Pull ${plPct}%</span></div><div style="font-size:10px;margin-top:5px;font-weight:600;color:${balanced?'var(--green)':'var(--red)'}">${balanced?'✅ Équilibré':'⚠️ Déséquilibré'}</div>`;grid.appendChild(c5);
  const deloadIn=(5-((weeksN-1)%5))%5||5;const c6=bc('Cycle · '+S.currentBlock);c6.innerHTML+=`<div class="bilan-big">${weeksN}</div><div class="bilan-sub">Sem. bloc: ${S.blockWeek}</div><div style="margin-top:7px;font-size:10px;color:var(--muted)">Prochain deload: <strong style="color:${deloadIn<=1?'var(--red)':'var(--orange)'}">${deloadIn} sem.</strong></div>`;grid.appendChild(c6);
  // Sleep summary
  if(avgSleep>0){const c7=bc('Sommeil moy. (7j)');c7.innerHTML+=`<div class="bilan-big">${Math.round(avgSleep*10)/10}<span style="font-size:13px;color:var(--muted)">h</span></div><div class="bilan-sub">${avgSleep>=7?'✅ Optimal':'⚠️ Insuffisant (recommandé: 7-9h)'}</div>`;grid.appendChild(c7);}
  // Steps bilan card
  const days7bilan=lastNDays(7);
  const bSteps=days7bilan.reduce((a,d)=>a+(parseInt(S.steps&&S.steps[d]||0)||0),0);
  const bCals=computeDailyCalories(7).reduce((a,p)=>a+p.y,0);
  const bSleep=computeDailySleep(7).filter(p=>p.y>0);
  const bSleepAvg=bSleep.length?bSleep.reduce((a,p)=>a+p.y,0)/bSleep.length:0;
  if(bSteps>0){const cS=bc('Pas (7j)');cS.innerHTML+=`<div class="bilan-big">${Math.round(bSteps/1000*10)/10}<span style="font-size:13px;color:var(--muted)">k</span></div><div class="bilan-sub">${Math.round(bSteps/7).toLocaleString('fr')} moy/j · obj ${(S.stepsGoal||10000).toLocaleString('fr')}</div>`;grid.appendChild(cS);}
  if(bCals>0){const cC=bc('Calories (7j)');const tdeeR=computeTDEE();const diff=Math.round(bCals/7-tdeeR.tdee);cC.innerHTML+=`<div class="bilan-big">${Math.round(bCals/7).toLocaleString('fr')}<span style="font-size:13px;color:var(--muted)">kcal/j</span></div><div class="bilan-sub" style="color:${diff>200?'var(--orange)':diff<-200?'var(--teal)':'var(--green)'}">${diff>0?'+'+diff:diff} kcal vs TDEE</div>`;grid.appendChild(cC);}
  if(bSleepAvg>0){const cSl=bc('Sommeil (7j)');cSl.innerHTML+=`<div class="bilan-big">${bSleepAvg.toFixed(1)}<span style="font-size:13px;color:var(--muted)">h/nuit</span></div><div class="bilan-sub" style="color:${bSleepAvg>=7?'var(--green)':bSleepAvg>=6?'var(--orange)':'var(--red)'}">${bSleepAvg>=7?'Optimal ✅':bSleepAvg>=6?'Insuffisant ⚠️':'Critique ❌'}</div>`;grid.appendChild(cSl);}
  // Recent sessions from history
  const recentSess=Object.entries(S.history||{}).sort(([a],[b])=>b.localeCompare(a)).slice(0,5).flatMap(([d,v])=>(Array.isArray(v)?v:[]).filter(e=>e.volume>0).map(e=>({...e,date:d})));
  if(recentSess.length){
    const cSess=bc('Séances récentes');
    cSess.style.gridColumn='1/-1';
    recentSess.forEach(s=>{
      const r=document.createElement('div');
      r.style.cssText='display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid var(--border);font-size:11px';
      const left=document.createElement('div');
      left.textContent=(s.name||'Séance')+' · '+s.date;
      left.style.color='var(--text)';
      const right=document.createElement('div');
      right.style.cssText='display:flex;gap:10px;color:var(--muted)';
      right.innerHTML=`<span>📦 ${s.volume>=1000?(s.volume/1000).toFixed(1)+'t':Math.round(s.volume)+'kg'}</span>${s.duration?`<span>⏱ ${s.duration}'</span>`:""}`;
      r.appendChild(left);r.appendChild(right);
      cSess.appendChild(r);
    });
    grid.appendChild(cSess);
  }
  cont.appendChild(grid);
  // Conflict alerts
  for(let i=0;i<6;i++){const m1=getDM(days[i]||{exercises:[],muscles:[]}).filter(k=>k!=='rep');const m2=getDM(days[i+1]||{exercises:[],muscles:[]}).filter(k=>k!=='rep');const ov=m1.filter(m=>m2.includes(m));if(ov.length){const al=document.createElement('div');al.className='alert alert-warn';al.textContent=`⚠️ ${DAYS_SH[i]} → ${DAYS_SH[i+1]}: même groupe (${ov.map(k=>MM[k].label).join(', ')}) — récupération insuffisante`;cont.appendChild(al);}}
  // Plateau alerts
  const plateaux=S.days.flatMap(d=>d.exercises).filter(e=>e.name&&isPlateau(e.name));
  plateaux.forEach(ex=>{const al=document.createElement('div');al.className='alert alert-warn';al.textContent=`📊 Plateau détecté: ${ex.name} — 3+ semaines sans progression. Essayez de changer la fourchette de reps ou le tempo.`;cont.appendChild(al);

  // ── Bilan Charts ──
  // Volume chart (current vs previous week)
  const bilanChartsDiv = document.createElement('div');
  bilanChartsDiv.style.cssText = 'margin-top:16px;display:flex;flex-direction:column;gap:12px';

  // Steps for the week
  const days7b = lastNDays(7);
  const stepsThisWeek = days7b.map(d=>parseInt(S.steps&&S.steps[d]||0)||0);
  const totalStepsWeek = stepsThisWeek.reduce((a,v)=>a+v,0);
  if(totalStepsWeek>0){
    const stepsWrapB = document.createElement('div');stepsWrapB.className='chart-wrap';
    stepsWrapB.innerHTML='<div class="chart-wrap-title">👣 Pas cette semaine</div>';
    const stepsCanvB = document.createElement('canvas');stepsCanvB.className='chart-canvas';
    stepsWrapB.appendChild(stepsCanvB);
    bilanChartsDiv.appendChild(stepsWrapB);
    const dNames=['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
    setTimeout(()=>Charts.barChart(stepsCanvB,days7b.map((d,i)=>({label:dNames[i],value:stepsThisWeek[i],color:stepsThisWeek[i]>=(S.stepsGoal||10000)?'--green':'--teal'})),{height:120,goal:S.stepsGoal||10000,yFmt:v=>v>=1000?Math.round(v/1000)+'k':Math.round(v)}),50);
  }

  // Calories for the week
  const calThisWeek = computeDailyCalories(7);
  const totalCalWeek = calThisWeek.reduce((a,p)=>a+p.y,0);
  if(totalCalWeek>0){
    const calWrapB = document.createElement('div');calWrapB.className='chart-wrap';
    calWrapB.innerHTML='<div class="chart-wrap-title">🔥 Calories cette semaine</div>';
    const calCanvB = document.createElement('canvas');calCanvB.className='chart-canvas';
    calWrapB.appendChild(calCanvB);
    bilanChartsDiv.appendChild(calWrapB);
    setTimeout(()=>Charts.lineChart(calCanvB,[{label:'Calories',values:calThisWeek,color:'--orange'}],{height:120,goal:S.caloriesGoal||2500,fill:true}),50);
  }

  // Sleep for the week
  const sleepThisWeek = computeDailySleep(7);
  const validSleep = sleepThisWeek.filter(p=>p.y>0);
  if(validSleep.length>0){
    const sleepWrapB = document.createElement('div');sleepWrapB.className='chart-wrap';
    sleepWrapB.innerHTML='<div class="chart-wrap-title">😴 Sommeil cette semaine</div>';
    const sleepCanvB = document.createElement('canvas');sleepCanvB.className='chart-canvas';
    sleepWrapB.appendChild(sleepCanvB);
    bilanChartsDiv.appendChild(sleepWrapB);
    setTimeout(()=>Charts.lineChart(sleepCanvB,[{label:'Sommeil (h)',values:sleepThisWeek,color:'--purple'}],{height:120,goal:7.5,fill:true,yMin:0,yMax:10,yFmt:v=>v.toFixed(1)+'h'}),50);
  }

  cont.appendChild(bilanChartsDiv);
});
}
document.getElementById('bilan-prev')?.addEventListener('click',()=>{S.bilanOffset=(S.bilanOffset||0)-1;save();renderBilan();});
document.getElementById('bilan-next')?.addEventListener('click',()=>{if((S.bilanOffset||0)<0){S.bilanOffset++;save();renderBilan();}});
document.getElementById('export-pdf-btn')?.addEventListener('click', exportBilanPDF);

/* ══ KPI ══ */
function computeTonnageComp(){const cur=weekVol();const keys=Object.keys(S.history).sort();const lastKey=keys[keys.length-1];const prev={};if(lastKey){(S.history[lastKey].days||[]).forEach(d=>{(d.exercises||[]).filter(e=>!e.isWarmup).forEach(ex=>{const v=calcVol(ex);if(v&&ex.muscle)prev[ex.muscle]=(prev[ex.muscle]||0)+v;});});}return{cur,prev};}

function computeBodyComp(){const t=parseFloat(S.profilTaille)||0;if(!t||t<100||t>250)return null;const lP=(S.mesures.poids||[]).slice(-1)[0];const lT2=(S.mesures.taille||[]).slice(-1)[0];const lCou=(S.mesures.cou||[]).slice(-1)[0];if(!lP)return null;const poids=parseFloat(lP.val)||0;const imc=poids&&t?Math.round(poids/(t/100)**2*10)/10:null;let bf=null;if(lT2&&t){const abdomen=parseFloat(lT2.val)||0;const cou=lCou?parseFloat(lCou.val)||38:38;if(abdomen>cou&&t)bf=Math.round((495/(1.0324-0.19077*Math.log10(abdomen-cou)+0.15456*Math.log10(t))-450)*10)/10;if(bf)bf=Math.max(3,Math.min(bf,45));}const leanMass=bf&&poids?Math.round(poids*(1-bf/100)*10)/10:null;return{poids,imc,bf,leanMass,taille:t};}
function computeWeekRecovery(){const scores=[];const today=new Date();for(let i=6;i>=0;i--){const d=new Date(today);d.setDate(d.getDate()-i);const key=`${S.sessDay}-${localDateStr(d)}`;const r=S.sessRecovery[key];if(r)scores.push(r);}return scores.length?{avg:Math.round(scores.reduce((a,b)=>a+b,0)/scores.length*10)/10,count:scores.length}:null;}
function computeIntensityZones(){
  const zones=[];
  S.days.forEach(function(d){
    d.exercises.filter(function(e){return !e.isWarmup;}).forEach(function(ex){
      if(!ex.weight||!ex.repsAchieved)return;
      const h=exHist(ex.name);
      const best1rm=Math.max.apply(null,h.map(function(r){return calc1RM(r.weight,r.repsAchieved||r.reps);}).concat([calc1RM(ex.weight,ex.repsAchieved)]));
      if(!best1rm)return;
      const pct=Math.round((parseFloat(ex.weight)||0)/best1rm*100);
      const m=MM[ex.muscle];
      const zone=pct<65?'Trop léger':pct<75?'End-force':pct<85?'Hypertrophie OK':pct<95?'Force':'1RM zone';
      zones.push({name:ex.name,pct:pct,muscle:ex.muscle,color:m?m.calColor:'var(--teal)',zone:zone});
    });
  });
  return zones.filter(function(z){return z.pct>0;});
}
function computeRepSuccessRate(dayIdx){const d=S.days[dayIdx];let tt=0,at=0,ct=0;d.exercises.filter(e=>!e.isWarmup).forEach(ex=>{if(!ex.repsAchieved||!ex.sets)return;const sets=parseInt(ex.sets)||0;const m=(ex.reps||'').match(/(\d+)/g);if(!m)return;const target=parseInt(m[0])*sets;const achieved=ex.repsAchieved.split('/').reduce((a,b)=>a+(parseInt(b)||0),0);if(target>0){tt+=target;at+=achieved;ct++;}});return ct>0?{rate:Math.round(at/tt*100),count:ct}:null;}

function renderKPI(){
  const wrap=document.getElementById('kpi-wrap');wrap.innerHTML='';
  // ── Fitness Score at top of KPI ──
  const fsKPI=computeFitnessScore();
  const fsColor=fsKPI.score>=80?'var(--green)':fsKPI.score>=60?'var(--teal)':fsKPI.score>=40?'var(--orange)':'var(--red)';
  const fsGrade=fsKPI.score>=90?'Excellent 🔥':fsKPI.score>=75?'Très bien 💪':fsKPI.score>=60?'Bien 👍':fsKPI.score>=45?'Correct ⚡':'À améliorer 📈';
  const fsCard=document.createElement('div');
  fsCard.className='chart-wrap';
  fsCard.style.cssText='margin-bottom:6px;padding:16px';
  const fsCirc=2*Math.PI*34;
  const fsDash=fsCirc*(fsKPI.score/100);
  fsCard.innerHTML=`<div style="display:flex;align-items:center;gap:16px">
    <div style="position:relative;width:80px;height:80px;flex-shrink:0">
      <svg viewBox="0 0 90 90" width="80" height="80" style="transform:rotate(-90deg)">
        <circle cx="45" cy="45" r="34" fill="none" stroke="var(--border)" stroke-width="7"/>
        <circle cx="45" cy="45" r="34" fill="none" stroke="${fsColor}" stroke-width="7" stroke-linecap="round"
          stroke-dasharray="${fsDash.toFixed(1)} ${fsCirc.toFixed(1)}"/>
      </svg>
      <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:var(--mono);font-size:18px;font-weight:700">${fsKPI.score}</div>
    </div>
    <div style="flex:1">
      <div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:4px">${fsGrade}</div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:10px">Score de forme global sur 7 jours</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${fsKPI.breakdown.map(b=>`<span style="font-size:10px;padding:2px 8px;border-radius:10px;background:var(--bg);border:1px solid var(--border);color:var(--text)">${b.icon} ${b.label}: <strong>${b.pts}</strong></span>`).join('')}
      </div>
    </div>
  </div>`;
  wrap.appendChild(fsCard);
  // ── ÉVOLUTION 4 SEMAINES des 6 composants ──
  (function() {
    // Collect the last 4 weeks of fitness scores from history
    const histKeys = Object.keys(S.history || {}).sort().slice(-4);
    if (histKeys.length < 2) return;

    const weeklyScores = histKeys.map(k => {
      const wk = S.history[k];
      // Store computed score for each week using archived data
      return { week: k.slice(5), label: 'S'+k.slice(5,7) };
    });

    const evoCard = document.createElement('div');
    evoCard.className = 'chart-wrap';
    evoCard.style.cssText = 'margin-bottom:6px;padding:16px';
    const evoTitle = document.createElement('div');
    evoTitle.style.cssText = 'font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-bottom:12px';
    evoTitle.textContent = 'Evolution sur 4 semaines';
    evoCard.appendChild(evoTitle);

    // Show current breakdown as a visual progress set
    fsKPI.breakdown.forEach(b => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:8px';
      const icon = document.createElement('span');
      icon.style.cssText = 'font-size:14px;width:20px;flex-shrink:0';
      icon.textContent = b.icon;
      const lbl = document.createElement('span');
      lbl.style.cssText = 'font-size:11px;font-weight:600;width:70px;flex-shrink:0;color:var(--text)';
      lbl.textContent = b.label;
      const barOuter = document.createElement('div');
      barOuter.style.cssText = 'flex:1;height:8px;background:var(--border);border-radius:4px;overflow:hidden';
      const barInner = document.createElement('div');
      barInner.style.cssText = 'height:100%;border-radius:4px;transition:width .8s ease;background:var(--'+
        (b.color||'--teal').replace('--','')+')';
      barInner.style.width = '0%';
      barOuter.appendChild(barInner);
      const pts = document.createElement('span');
      pts.style.cssText = 'font-family:var(--mono);font-size:11px;font-weight:700;width:30px;text-align:right;color:var('+b.color+')';
      pts.textContent = b.pts;
      const wt = document.createElement('span');
      wt.style.cssText = 'font-size:9px;color:var(--muted);width:24px;text-align:right';
      wt.textContent = b.weight+'%';
      row.appendChild(icon); row.appendChild(lbl); row.appendChild(barOuter); row.appendChild(pts); row.appendChild(wt);
      evoCard.appendChild(row);
      setTimeout(() => { barInner.style.width = b.pts + '%'; }, 100);
    });

    wrap.appendChild(evoCard);
  })();

  function mkSec(title){const t=document.createElement('div');t.className='kpi-section-title';t.textContent=title;wrap.appendChild(t);const g=document.createElement('div');g.className='kpi-grid';wrap.appendChild(g);return g;}
  function mkCard(label,val,sub,status,delta){const c=document.createElement('div');c.className='kpi-card'+(status==='alert'?' kpi-alert':status==='warn'?' kpi-warn':status==='good'?' kpi-good':'');const l=document.createElement('div');l.className='kpi-label';l.textContent=label;const v=document.createElement('div');v.className='kpi-val '+(status?'kpi-'+status+'-col':'');v.textContent=val;const s=document.createElement('div');s.className='kpi-sub';s.textContent=sub||'';c.appendChild(l);c.appendChild(v);c.appendChild(s);if(delta&&delta!==0){const d2=document.createElement('div');d2.className='kpi-delta '+(delta>0?'up':'down');d2.textContent=(delta>0?'▲ +':' ▼ ')+Math.abs(delta)+'%';c.appendChild(d2);}return c;}

  // Section 1: Volume & Charge
  const g1=mkSec('📦 Charge & Volume');
  const tc=computeTonnageComp();const curT=Object.values(tc.cur).reduce((a,b)=>a+b,0);const prevT=Object.values(tc.prev).reduce((a,b)=>a+b,0);const tDelta=prevT>0?Math.round((curT-prevT)/prevT*100):0;
  g1.appendChild(mkCard('Volume semaine',Math.round(curT/1000*10)/10+'t',prevT?'S-1: '+Math.round(prevT/1000*10)/10+'t':' Première semaine',tDelta>0?'good':tDelta<0?'warn':'',tDelta));
  const atl=computeATLCTL();const atlCard=mkCard('ATL (charge aiguë)',atl.atl?atl.atl.toLocaleString('fr')+'kg':'—','CTL: '+( atl.ctl?atl.ctl.toLocaleString('fr')+'kg':'—'),atl.ratio>125?'alert':atl.ratio>100?'warn':'good','');
  if(atl.ratio){const sub2=document.createElement('div');sub2.style.cssText='font-size:9px;margin-top:3px;font-weight:600;color:'+(atl.ratio>125?'var(--red)':atl.ratio<80?'var(--orange)':'var(--green)');sub2.textContent='ATL/CTL: '+atl.ratio+'% '+(atl.ratio>125?'⚠ Surcharge':atl.ratio<80?'↓ Sous-chargé':'✅ Optimal');atlCard.appendChild(sub2);const tsb=document.createElement('div');tsb.style.cssText='font-size:9px;color:var(--muted);margin-top:2px';tsb.textContent='TSB: '+(atl.tsb>0?'+':'')+atl.tsb;atlCard.appendChild(tsb);}
  g1.appendChild(atlCard);
  // Tonnage by muscle
  const allM=[...new Set([...Object.keys(tc.cur),...Object.keys(tc.prev)])];const maxTon=Math.max(...allM.map(k=>Math.max(tc.cur[k]||0,tc.prev[k]||0)),1);const tCard=document.createElement('div');tCard.className='kpi-card kpi-wide';tCard.innerHTML='<div class="kpi-label">Tonnage par groupe — S vs S-1</div>';allM.forEach(k=>{const m=MM[k];if(!m)return;const cur=(tc.cur[k]||0),prev=(tc.prev[k]||0);const delta=prev>0?Math.round((cur-prev)/prev*100):null;const row=document.createElement('div');row.className='kpi-tonnage-row';row.innerHTML=`<span style="width:52px;font-size:9px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${m.label.split(' ')[0]}</span><div class="kpi-bar-wrap" style="flex:1"><div class="kpi-bar" style="width:${Math.round(cur/maxTon*100)}%;background:${m.calColor}"></div></div><span style="font-family:var(--mono);font-size:9px;width:34px;text-align:right">${Math.round(cur/1000*10)/10}t</span><span style="font-size:9px;font-weight:700;width:36px;text-align:right;color:${delta>0?'var(--green)':delta<0?'var(--red)':'var(--muted)'}">${delta!==null?(delta>0?'+':'')+delta+'%':'—'}</span>`;tCard.appendChild(row);});if(!allM.length){tCard.innerHTML+='<div style="font-size:10px;color:var(--muted);margin-top:4px">Renseignez des poids et archivez une semaine.</div>';}g1.appendChild(tCard);

  // Section 2: Intensité
  const g2=mkSec('⚡ Intensité & RPE');
  const zones=computeIntensityZones();const zCard=document.createElement('div');zCard.className='kpi-card kpi-wide';zCard.innerHTML='<div class="kpi-label">% du 1RM par exercice</div>';if(zones.length){zones.slice(0,10).forEach(z=>{const row=document.createElement('div');row.style.cssText='display:flex;align-items:center;gap:5px;margin-top:4px;font-size:9px';// Safe DOM — no innerHTML with user data (exercise names)
const zName=document.createElement('span');zName.style.cssText='flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text)';zName.textContent=z.name.length>30?z.name.slice(0,30)+'…':z.name;
const zBar=document.createElement('div');zBar.className='kpi-bar-wrap';zBar.style.cssText='flex:0 0 80px';const zFill=document.createElement('div');zFill.className='kpi-bar';zFill.style.cssText=`width:${z.pct}%;background:${z.pct>=85?'var(--red)':z.pct>=65?'var(--green)':'var(--orange)'}`;zBar.appendChild(zFill);
const zPct=document.createElement('span');zPct.style.cssText=`font-family:var(--mono);font-weight:700;width:34px;text-align:right;color:${z.pct>=85?'var(--red)':z.pct>=65?'var(--green)':'var(--orange)'}`;zPct.textContent=z.pct+'%';
const zZone=document.createElement('span');zZone.style.cssText='color:var(--muted);width:80px;text-align:right';zZone.textContent=z.zone;
row.appendChild(zName);row.appendChild(zBar);row.appendChild(zPct);row.appendChild(zZone);zCard.appendChild(row);});const leg=document.createElement('div');leg.style.cssText='display:flex;gap:10px;margin-top:8px;flex-wrap:wrap';leg.innerHTML='<span style="font-size:8px;color:var(--orange)">▬ &lt;65%</span><span style="font-size:8px;color:var(--green)">▬ 65–84% Hypertrophie ✓</span><span style="font-size:8px;color:var(--red)">▬ ≥85% Force</span>';zCard.appendChild(leg);}else{zCard.innerHTML+='<div style="font-size:10px;color:var(--muted);margin-top:4px">Renseignez poids et reps réalisées.</div>';}g2.appendChild(zCard);
  const rateCard=document.createElement('div');rateCard.className='kpi-card';rateCard.innerHTML='<div class="kpi-label">Taux de réussite reps</div>';let hasRate=false;S.days.forEach((d,i)=>{const res=computeRepSuccessRate(i);if(!res)return;hasRate=true;const row=document.createElement('div');row.style.cssText='display:flex;align-items:center;gap:5px;font-size:10px;margin-top:4px';const color=res.rate>=95?'var(--green)':res.rate>=85?'var(--orange)':'var(--red)';row.innerHTML=`<span style="width:28px;font-size:9px;color:var(--muted)">${DAYS_SH[i]}</span><div class="kpi-bar-wrap" style="flex:1"><div class="kpi-bar" style="width:${res.rate}%;background:${color}"></div></div><span style="font-family:var(--mono);font-weight:700;color:${color};font-size:10px;width:36px;text-align:right">${res.rate}%</span>`;rateCard.appendChild(row);});if(!hasRate){rateCard.innerHTML+='<div style="font-size:10px;color:var(--muted);margin-top:4px">Renseignez les reps réalisées.</div>';}const rl=document.createElement('div');rl.style.cssText='font-size:8px;color:var(--muted);margin-top:6px';rl.textContent='≥95% ✅ · 85–94% ⚠ Ajuster · <85% ↓ Trop lourd';rateCard.appendChild(rl);g2.appendChild(rateCard);

  // Section 3: Récup
  const g3=mkSec('💤 Récupération & Régularité');
  const rec=computeWeekRecovery();g3.appendChild(mkCard('Récupération moy.',rec?rec.avg+'/3 '+(rec.avg>=2.5?'🔥':rec.avg>=1.5?'😐':'😴'):'—',rec?rec.count+' séances renseignées':'Mode Séance → récupération',rec?(rec.avg>=2.5?'good':rec.avg>=1.5?'warn':'alert'):'',''));
  const restDays=S.days.filter(d=>getDMS(d).includes('rep')).length;const activeDays2=S.days.filter(d=>getDMS(d).some(k=>k&&k!=='rep')).length;const restRatio=activeDays2>0?Math.round(restDays/activeDays2*100)/100:0;
  g3.appendChild(mkCard('Ratio Repos/Entr.',restRatio.toFixed(2),restDays+' repos · '+activeDays2+' actifs · rec. 0.25–0.5',restRatio<0.2?'alert':restRatio>0.6?'warn':'good',''));
  const streak=computeStreak();g3.appendChild(mkCard('Streak actuel',streak.current+' j 🔥','Record: '+streak.record+' jours',streak.current>0?'good':'',''));
  const adh=computeAdherence();const adhRate=adh.prog4>0?Math.round(adh.comp4/adh.prog4*100):0;g3.appendChild(mkCard('Adhérence (4 sem.)',adhRate+'%',adh.comp4+'/'+adh.prog4+' séances complètes',adhRate>=80?'good':adhRate>=60?'warn':'alert',''));
  // Sleep
  const avgSleep=(()=>{const _t=new Date();const _sv=Array.from({length:7},(_,i)=>{const _d=new Date(_t);_d.setDate(_d.getDate()-i);const _k=localDateStr(_d);return S.sleep&&S.sleep[_k]?parseFloat(S.sleep[_k].hours||0):0;}).filter(h=>h>0);return _sv.length?Math.round(_sv.reduce((a,b)=>a+b,0)/_sv.length*10)/10:0;})();
  g3.appendChild(mkCard('Sommeil moy. (7j)',avgSleep?Math.round(avgSleep*10)/10+'h':'—',avgSleep>=7?'Optimal ✅':'Insuffisant (rec. 7-9h)',avgSleep>=7?'good':avgSleep>5&&avgSleep>0?'warn':avgSleep>0?'alert':'',''));

  // Section 4: Corps
  const g4=mkSec('💪 Corps & Composition');
  const bc2=computeBodyComp();
  if(bc2){
    const imcZone=bc2.imc<18.5?'Insuffisance':bc2.imc<25?'Normal ✅':bc2.imc<30?'Surpoids':'Obésité';
    const imcC=mkCard('IMC',bc2.imc?String(bc2.imc):'—',bc2.imc?imcZone:'Renseignez taille dans Corps',bc2.imc?(bc2.imc>=18.5&&bc2.imc<25?'good':bc2.imc<18.5?'warn':'alert'):'','');
    if(bc2.imc){const r=bc2.imc/40;const c2=2*Math.PI*21;const offset=c2*(1-Math.min(r,1));const color=bc2.imc>=18.5&&bc2.imc<25?'var(--green)':bc2.imc<18.5?'var(--orange)':'var(--red)';const gw=document.createElement('div');gw.className='kpi-gauge-wrap';gw.innerHTML=`<div class="kpi-gauge"><svg viewBox="0 0 52 52"><circle class="kpi-gauge-bg" cx="26" cy="26" r="21"/><circle class="kpi-gauge-fill" cx="26" cy="26" r="21" stroke="${color}" stroke-dasharray="${c2}" stroke-dashoffset="${offset}" style="transform:rotate(-90deg);transform-origin:26px 26px"/></svg><div class="kpi-gauge-text">${bc2.imc}</div></div>`;imcC.appendChild(gw);}
    g4.appendChild(imcC);
    g4.appendChild(mkCard('% Masse grasse',bc2.bf?bc2.bf+'%':'—',bc2.bf?'Formule US Navy':'Ajoutez tour de taille',bc2.bf?(bc2.bf<15?'good':bc2.bf<25?'good':bc2.bf<35?'warn':'alert'):'',''));
    g4.appendChild(mkCard('Masse maigre',bc2.leanMass?bc2.leanMass+' kg':'—',bc2.leanMass?bc2.poids+'kg total · '+Math.round(bc2.bf||0)+'% MG':'Données insuffisantes',bc2.leanMass?'good':'',''));
  } else {g4.appendChild(mkCard('Composition corporelle','—','Renseignez taille (onglet Corps) et poids','',''));}
  // Delta mensuel
  const deltaCard=document.createElement('div');deltaCard.className='kpi-card';deltaCard.innerHTML='<div class="kpi-label">Évolution mensuelle (30j)</div>';let hasDelta=false;
  MESURES_DEF.forEach(({key,label,unit,icon})=>{const entries=(S.mesures[key]||[]).sort((a,b)=>a.date.localeCompare(b.date));if(entries.length<2)return;const latest=entries[entries.length-1];const target=new Date(latest.date+'T00:00');target.setDate(target.getDate()-30);const closest=entries.reduce((best,e)=>{return Math.abs(new Date(e.date+'T00:00')-target)<Math.abs(new Date(best.date+'T00:00')-target)?e:best;});if(closest===latest)return;const diff=Math.round((parseFloat(latest.val)-parseFloat(closest.val))*10)/10;const isGood=(key==='bras'||key==='poitrine')?diff>0:(key==='taille'||key==='hanches')?diff<0:key==='poids'?diff<0:true;hasDelta=true;const row=document.createElement('div');row.style.cssText='display:flex;align-items:center;gap:5px;font-size:10px;margin-top:4px';row.innerHTML=`<span>${icon}</span><span style="flex:1;color:var(--muted)">${label}</span><span style="font-family:var(--mono);font-weight:700;color:${isGood?'var(--green)':'var(--red)'}">${diff>0?'+':''}${diff} ${unit}</span>`;deltaCard.appendChild(row);});
  if(!hasDelta){deltaCard.innerHTML+='<div style="font-size:10px;color:var(--muted);margin-top:4px">Saisissez des mesures sur 30+ jours.</div>';}g4.appendChild(deltaCard);

  // ── Steps section ──
  const g5=mkSec('👣 Activité — Pas');
  const days7=lastNDays(7);
  const stepsTotals=days7.map(d=>parseInt(S.steps&&S.steps[d]||0)||0);
  const stepsAvg=Math.round(stepsTotals.reduce((a,v)=>a+v,0)/7);
  const stepsBest=Math.max(...stepsTotals);
  const stepsGoal=S.stepsGoal||10000;
  const stepsAchieved=stepsTotals.filter(v=>v>=stepsGoal).length;
  g5.appendChild(mkCard('Moy. 7j',stepsAvg.toLocaleString('fr'),'pas/jour',stepsAvg>=stepsGoal?'good':stepsAvg>=stepsGoal*0.7?'warn':'alert',''));
  g5.appendChild(mkCard('Meilleur',stepsBest.toLocaleString('fr'),'pas en 1j',stepsBest>=stepsGoal?'good':'',''));
  g5.appendChild(mkCard('Objectifs atteints',stepsAchieved+'/7','jours',stepsAchieved>=5?'good':stepsAchieved>=3?'warn':'alert',''));

  // Steps bar chart
  const stepsChartWrap=document.createElement('div');stepsChartWrap.style.gridColumn='1/-1';
  const stepsCanvas=document.createElement('canvas');stepsCanvas.className='chart-canvas';
  stepsChartWrap.appendChild(stepsCanvas);
  wrap.appendChild(stepsChartWrap);
  setTimeout(()=>Charts.barChart(stepsCanvas,days7.map((d,i)=>({label:d.slice(5),value:stepsTotals[i],color:stepsTotals[i]>=stepsGoal?'--green':'--teal'})),{height:130,goal:stepsGoal,yFmt:v=>v>=1000?Math.round(v/1000)+'k':Math.round(v)}),50);

  // ── Calories section ──
  const g6=mkSec('🔥 Calories & Nutrition');
  const calGoal=S.caloriesGoal||2500;
  const calVals=computeDailyCalories(7).map(p=>p.y);
  const calAvg=Math.round(calVals.reduce((a,v)=>a+v,0)/7);
  const tdeeR=computeTDEE();
  const calDiff=calAvg-tdeeR.tdee;
  const calDiffLbl=calDiff>=0?'+'+calDiff+'kcal surplus':calDiff+'kcal déficit';
  g6.appendChild(mkCard('Moy. 7j',calAvg?calAvg.toLocaleString('fr')+' kcal':'—','calories/jour',calAvg>0?(Math.abs(calAvg-calGoal)<calGoal*0.1?'good':'warn'):'',''));
  g6.appendChild(mkCard('TDEE estimé',tdeeR.tdee.toLocaleString('fr')+' kcal',`BMR ${tdeeR.bmr} × ${tdeeR.mult}`,'',''));
  g6.appendChild(mkCard('Balance',calAvg>0?calDiffLbl:'—',calDiff>200?'Prise de masse':calDiff<-200?'Perte de poids':'Maintien',calAvg>0?(Math.abs(calDiff)<300?'good':'warn'):'',''));

  // Calories line chart
  const calChartWrap=document.createElement('div');calChartWrap.style.gridColumn='1/-1';
  const calCanvas=document.createElement('canvas');calCanvas.className='chart-canvas';
  calChartWrap.appendChild(calCanvas);
  wrap.appendChild(calChartWrap);
  setTimeout(()=>Charts.lineChart(calCanvas,[{label:'Calories',values:computeDailyCalories(14),color:'--orange'}],{height:130,goal:calGoal,fill:true,yFmt:v=>Math.round(v)+'kcal'}),50);

  // ── Sleep section ──
  const g7=mkSec('😴 Sommeil');
  const sleepVals=computeDailySleep(7).map(p=>p.y);
  const sleepAvg=sleepVals.filter(v=>v>0).length?sleepVals.filter(v=>v>0).reduce((a,v)=>a+v,0)/sleepVals.filter(v=>v>0).length:0;
  const sleepGood=sleepVals.filter(v=>v>=7&&v<=9).length;
  g7.appendChild(mkCard('Moy. 7j',sleepAvg?sleepAvg.toFixed(1)+'h':'—','heures/nuit',sleepAvg>=7?'good':sleepAvg>=6?'warn':sleepAvg>0?'alert':'',''));
  g7.appendChild(mkCard('Nuits optimales',sleepGood+'/7','(7-9h)',sleepGood>=5?'good':sleepGood>=3?'warn':'alert',''));
  const sleepDebt=Math.max(0,7*7-sleepVals.filter(v=>v>0).reduce((a,v)=>a+v,0));
  g7.appendChild(mkCard('Dette de sommeil',sleepDebt?sleepDebt.toFixed(1)+'h':'0h','sur 7 jours',sleepDebt<3?'good':sleepDebt<7?'warn':'alert',''));

  // Sleep line chart
  const sleepChartWrap=document.createElement('div');sleepChartWrap.style.gridColumn='1/-1';
  const sleepCanvas=document.createElement('canvas');sleepCanvas.className='chart-canvas';
  sleepChartWrap.appendChild(sleepCanvas);
  wrap.appendChild(sleepChartWrap);
  setTimeout(()=>Charts.lineChart(sleepCanvas,[{label:'Sommeil',values:computeDailySleep(14),color:'--purple'}],{height:130,goal:7.5,fill:true,yFmt:v=>v.toFixed(1)+'h',yMin:0,yMax:12}),50);

  // ── Douleurs dans KPI ──
  const pains=activePains();
  if(pains.length){
    const g8=mkSec('⚠️ Douleurs actives (14j)');
    pains.forEach(p=>{
      const card=mkCard(p.zone||'Zone inconnue',p.intensity?'Intensité '+p.intensity+'/10':'Signalée',p.note||p.date||'','alert','');
      g8.appendChild(card);
    });
  }

  // ── KPI: radar final ──
  const radarWrap=document.createElement('div');radarWrap.style.gridColumn='1/-1';radarWrap.className='chart-wrap';
  radarWrap.innerHTML='<div class="chart-wrap-title">🕸️ Radar global</div>';
  const radarCanvas=document.createElement('canvas');radarCanvas.className='chart-canvas';
  radarWrap.appendChild(radarCanvas);
  wrap.appendChild(radarWrap);
  const fs2=computeFitnessScore();
  setTimeout(()=>Charts.radarChart(radarCanvas,fs2.breakdown.map(b=>({label:b.label,value:b.pts})),{height:220}),50);

}
