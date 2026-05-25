/* ═══════════════════════════════════════
   compute.js — Calculs analytiques
   Dépend de: constants.js, state.js, utils.js
═══════════════════════════════════════ */

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

function computeDailySteps(n=14){
  return lastNDays(n).map(d=>({ x:d, y:parseInt(S.steps&&S.steps[d]||0)||0 }));
}

function computeDailyCalories(n=14){
  return lastNDays(n).map(d=>{
    const c=S.calories&&S.calories[d];
    let total=0;
    if(c&&c.meals) c.meals.forEach(m=>(m.items||[]).forEach(it=>total+=parseFloat(it.kcal)||0));
    return {x:d, y:total};
  });
}

function computeDailySleep(n=14){
  return lastNDays(n).map(d=>({ x:d, y:parseFloat(S.sleep&&S.sleep[d]&&(S.sleep[d].hours||S.sleep[d].h)||0)||0 }));
}

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

function computeMacroGoals() {
  const tdee = computeTDEE().tdee;
  const goal = S.objective?.text || '';
  let calTarget = S.caloriesGoal || tdee;
  
  // Ajuster selon l'objectif
  if(goal.includes('masse') || goal.includes('Prise'))      calTarget = Math.round(tdee * 1.10); // +10%
  else if(goal.includes('poids') || goal.includes('Perte')) calTarget = Math.round(tdee * 0.80); // -20%
  else if(goal.includes('Force') || goal.includes('force')) calTarget = Math.round(tdee * 1.05); // +5%
  else calTarget = tdee; // maintien
  
  const poids = parseFloat((S.mesures.poids||[]).slice(-1)[0]?.val) || 75;
  
  // Protéines: 2g/kg pour prise de masse, 1.8g/kg pour perte, 1.6g/kg maintien
  let protMulti = 1.8;
  if(goal.includes('masse')) protMulti = 2.2;
  else if(goal.includes('Perte') || goal.includes('poids')) protMulti = 2.0;
  
  const protG  = Math.round(poids * protMulti);          // protéines (g)
  const protCal = protG * 4;
  
  // Lipides: 25% des calories
  const fatCal = Math.round(calTarget * 0.25);
  const fatG   = Math.round(fatCal / 9);
  
  // Glucides: le reste
  const carbCal = calTarget - protCal - fatCal;
  const carbG   = Math.round(Math.max(0, carbCal) / 4);
  
  return {
    calories: calTarget,
    protein:  protG,
    carbs:    carbG,
    fat:      fatG,
    protCal, carbCal: Math.max(0, carbCal), fatCal
  };
}

function computeTonnageComp(){const cur=weekVol();const keys=Object.keys(S.history).sort();const lastKey=keys[keys.length-1];const prev={};if(lastKey){(S.history[lastKey].days||[]).forEach(d=>{(d.exercises||[]).filter(e=>!e.isWarmup).forEach(ex=>{const v=calcVol(ex);if(v&&ex.muscle)prev[ex.muscle]=(prev[ex.muscle]||0)+v;});});}return{cur,prev};}

function computeBodyComp(){const t=parseFloat(S.profilTaille)||0;if(!t||t<100||t>250)return null;const lP=(S.mesures.poids||[]).slice(-1)[0];const lT2=(S.mesures.taille||[]).slice(-1)[0];const lCou=(S.mesures.cou||[]).slice(-1)[0];if(!lP)return null;const poids=parseFloat(lP.val)||0;const imc=poids&&t?Math.round(poids/(t/100)**2*10)/10:null;let bf=null;if(lT2&&t){const abdomen=parseFloat(lT2.val)||0;const cou=lCou?parseFloat(lCou.val)||38:38;if(abdomen>cou&&t)bf=Math.round((495/(1.0324-0.19077*Math.log10(abdomen-cou)+0.15456*Math.log10(t))-450)*10)/10;if(bf)bf=Math.max(3,Math.min(bf,45));}const leanMass=bf&&poids?Math.round(poids*(1-bf/100)*10)/10:null;return{poids,imc,bf,leanMass,taille:t};}

function computeStreak(){
  const today=new Date();
  let cur=0,rec=0,temp=0,inCur=true;
  for(let i=0;i<365;i++){
    const d=new Date(today);d.setDate(d.getDate()-i);const ds=localDateStr(d);
    const mD=S.days.find(day=>day.date===ds);
    const hD=Object.values(S.history).flatMap(wk=>(wk.days||[])).find(day=>day.date===ds);
    const aDay=mD||hD;
    const trained=aDay&&(aDay.exercises||[]).some(e=>e.done&&!e.isWarmup);
    if(trained){
      temp++;
      if(inCur)cur=temp; // still in current streak
    } else {
      inCur=false; // first gap breaks current streak
      if(temp>rec)rec=temp;
      temp=0;
    }
  }
  if(temp>rec)rec=temp;
  // Count active days this calendar month
  const now=new Date();
  let monthActive=0;
  for(let d=1;d<=now.getDate();d++){
    const dd=new Date(now.getFullYear(),now.getMonth(),d);
    const ds=localDateStr(dd);
    const mD=S.days.find(day=>day.date===ds);
    const hD=Object.values(S.history).flatMap(wk=>(wk.days||[])).find(day=>day.date===ds);
    const aDay=mD||hD;
    if(aDay&&(aDay.exercises||[]).some(e=>e.done&&!e.isWarmup)) monthActive++;
  }
  return{current:cur,record:rec,monthActive};
}

function computeAdherence(){const programmed=S.days.filter(d=>getDMS(d).some(k=>k&&k!=='rep')).length;const completed=S.days.filter(d=>{const exs=d.exercises.filter(e=>e.name.trim()&&!e.isWarmup);return exs.length>0&&exs.every(e=>e.done);}).length;let p4=0,c4=0;Object.values(S.history).slice(-4).forEach(wk=>{(wk.days||[]).forEach(d=>{const muscles=(d.muscles||[]).filter(Boolean);if(muscles.some(k=>k!=='rep'))p4++;if((d.exercises||[]).filter(e=>e.name&&!e.isWarmup).every(e=>e.done)&&(d.exercises||[]).some(e=>e.name&&!e.isWarmup))c4++;});});return{programmed,completed,prog4:p4||programmed,comp4:c4||completed};}

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

