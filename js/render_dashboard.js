/* ============================================================
   render_dashboard.js — Page Accueil
============================================================ */

function renderDashboard(){
  const wrap = document.getElementById('dash-wrap');
  if(!wrap) return;
  wrap.innerHTML = '';

  const today    = new Date();
  const todayStr = localDateStr(today);
  const hours    = today.getHours();
  const dayIdx   = today.getDay()===0?6:today.getDay()-1;
  const todayDay = S.days[dayIdx]||{};
  const todayName= ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'][dayIdx];
  const dateFmt  = today.toLocaleDateString('fr-FR',{day:'numeric',month:'long'});
  const greetTxt = hours<5?'Bonne nuit':hours<12?'Bonjour':hours<18?'Bonne après-midi':'Bonsoir';
  const greetEmoji = hours<5?'🌙':hours<12?'☀️':hours<18?'🌤️':'🌙';

  // ── HERO: Greeting + Score de forme ──
  const fs = computeFitnessScore();
  const scoreColor = fs.score>=80?'var(--green)':fs.score>=60?'var(--teal)':fs.score>=40?'var(--orange)':'var(--red)';
  const grade = fs.score>=90?'Excellent 🔥':fs.score>=75?'Très bien 💪':fs.score>=60?'Bien 👍':fs.score>=45?'Correct 📈':'À améliorer 💤';
  const circ = 2*Math.PI*38;
  const dashArr = circ*(fs.score/100);

  const hero = document.createElement('div');
  hero.className = 'dash-hero';
  hero.innerHTML = `
    <div class="dash-hero-left">
      <div class="dash-greeting">${greetEmoji} ${greetTxt} !</div>
      <div class="dash-date">${todayName} ${dateFmt}</div>
      <div class="dash-week-badge">Semaine ${S.weekType||'A'} — Bloc ${S.currentBlock||1}</div>
      <div class="dash-grade" style="color:${scoreColor}">${grade}</div>
    </div>
    <div class="dash-hero-right">
      <svg class="dash-score-svg" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="38" fill="none" stroke="var(--border)" stroke-width="8"/>
        <circle cx="50" cy="50" r="38" fill="none" stroke="${scoreColor}" stroke-width="8"
          stroke-linecap="round" stroke-dasharray="${dashArr.toFixed(1)} ${circ.toFixed(1)}"
          stroke-dashoffset="${(circ*0.25).toFixed(1)}"
          style="transition:stroke-dasharray 1s ease"/>
        <text x="50" y="46" text-anchor="middle" font-family="var(--mono)" font-size="20" font-weight="800" fill="var(--text)">${fs.score}</text>
        <text x="50" y="60" text-anchor="middle" font-size="9" fill="var(--muted)">/ 100</text>
      </svg>
      <div class="dash-score-lbl">Score de forme</div>
    </div>`;
  wrap.appendChild(hero);

  // ── STATS RAPIDES ──
  const stepsToday = parseInt(S.steps&&S.steps[todayStr]||0)||0;
  const stepsGoal  = S.stepsGoal||10000;
  const stepsPct   = Math.min(100,Math.round(stepsToday/stepsGoal*100));
  const calToday   = (()=>{ const cd=S.calories&&S.calories[todayStr]; let t=0; if(cd&&cd.meals) cd.meals.forEach(m=>(m.items||[]).forEach(it=>t+=it.cal||0)); return Math.round(t); })();
  const calGoal    = S.caloriesGoal||2500;
  const calPct     = Math.min(100,Math.round(calToday/calGoal*100));
  const sleepLast  = (()=>{ const d=lastNDays(1)[0]; const sl=S.sleep&&S.sleep[d]; return parseFloat(sl&&(sl.hours||sl.h)||0)||0; })();
  const sleepGoal  = S._sleepGoal||8;
  const st         = computeStreak();
  const tdee       = computeTDEE();

  const stats = [
    {icon:'👣', val:stepsToday>=1000?(stepsToday/1000).toFixed(1)+'k':stepsToday, lbl:'Pas', sub:`${stepsPct}% de l'objectif`, pct:stepsPct, color:'--green'},
    {icon:'🔥', val:calToday+'', lbl:'kcal', sub:`/ ${calGoal} objectif`, pct:calPct, color:'--orange'},
    {icon:'😴', val:sleepLast?sleepLast+'h':'—', lbl:'Sommeil', sub:`Obj. ${sleepGoal}h`, pct:sleepLast?Math.min(100,Math.round(sleepLast/sleepGoal*100)):0, color:'--purple'},
    {icon:'🔥', val:st.current+'j', lbl:'Streak', sub:`Record ${st.record}j`, pct:Math.min(100,Math.round(st.current/(st.record||1)*100)), color:'--red'},
  ];

  const statsGrid = document.createElement('div');
  statsGrid.className = 'dash-stats-grid';
  stats.forEach(s=>{
    const el = document.createElement('div');
    el.className = 'dash-stat-card';
    el.innerHTML = `
      <div class="dash-stat-icon">${s.icon}</div>
      <div class="dash-stat-val">${s.val}</div>
      <div class="dash-stat-lbl">${s.lbl}</div>
      <div class="dash-stat-bar-wrap">
        <div class="dash-stat-bar" style="width:${s.pct}%;background:var(${s.color})"></div>
      </div>
      <div class="dash-stat-sub">${s.sub}</div>`;
    statsGrid.appendChild(el);
  });
  wrap.appendChild(statsGrid);

  // ── SÉANCE DU JOUR ──
  const exs = (todayDay.exercises||[]).filter(e=>e.name&&e.name.trim()&&!e.isWarmup);
  const doneExs = exs.filter(e=>e.done);
  const isRest  = exs.length===0||(exs[0]&&exs[0].name&&exs[0].name.toLowerCase().includes('repos'));
  const sessionPct = exs.length? Math.round(doneExs.length/exs.length*100):0;

  const sessionCard = document.createElement('div');
  sessionCard.className = 'dash-session-card';
  if(isRest || exs.length===0){
    sessionCard.innerHTML = `
      <div class="dash-session-header">
        <span class="dash-session-day">📅 ${todayName.toUpperCase()}</span>
        <span class="dash-session-badge rest">Repos</span>
      </div>
      <div class="dash-session-msg">🛋️ Journée de récupération<br><small style="color:var(--muted)">Marche, étirements, sommeil</small></div>
      <button class="dash-session-btn secondary" onclick="switchTab('weekly')">📋 Voir planning</button>`;
  } else {
    const groups = [...new Set(exs.map(e=>e.muscles&&e.muscles[0]||'').filter(Boolean))].slice(0,3);
    sessionCard.innerHTML = `
      <div class="dash-session-header">
        <span class="dash-session-day">💪 ${todayName.toUpperCase()}</span>
        <span class="dash-session-badge ${doneExs.length>0?'progress':'upcoming'}">${doneExs.length>0?doneExs.length+'/'+exs.length+' faits':'À venir'}</span>
      </div>
      ${groups.length?`<div class="dash-session-muscles">${groups.join(' · ')}</div>`:''}
      <div class="dash-session-exs">${exs.slice(0,3).map(e=>`
        <div class="dash-session-ex ${e.done?'done':''}">
          <span class="dash-session-ex-dot ${e.done?'done':''}"></span>
          <span>${e.name}</span>
          <span class="dash-session-ex-sets">${e.sets||3}×${e.reps||'?'}</span>
        </div>`).join('')}${exs.length>3?`<div style="font-size:10px;color:var(--muted);margin-top:4px">+${exs.length-3} exercices</div>`:''}</div>
      ${sessionPct>0?`<div class="dash-session-progress-wrap">
        <div class="dash-session-progress-bar" style="width:${sessionPct}%"></div>
      </div>`:''}
      <div style="display:flex;gap:8px;margin-top:12px">
        <button class="dash-session-btn primary" onclick="switchTab('session')" style="flex:2">▶ ${doneExs.length>0?'Continuer':'Commencer'}</button>
        <button class="dash-session-btn secondary" onclick="switchTab('weekly')" style="flex:1">📋</button>
      </div>`;
  }
  wrap.appendChild(sessionCard);

  // ── OBJECTIF + PROGRESSION ──
  const obj = S.objective;
  if(obj&&obj.text){
    const objCard = document.createElement('div');
    objCard.className = 'dash-obj-card';
    const poids = (S.mesures&&S.mesures.poids&&S.mesures.poids.length)?
      parseFloat(S.mesures.poids[S.mesures.poids.length-1].val)||0:0;
    const targetW = parseFloat(obj.targetWeight)||0;
    const startW  = (S.mesures&&S.mesures.poids&&S.mesures.poids[0])?
      parseFloat(S.mesures.poids[0].val)||0:poids;
    const progress = (startW&&targetW&&poids&&startW!==targetW)?
      Math.min(100,Math.max(0,Math.round(Math.abs(startW-poids)/Math.abs(startW-targetW)*100))):0;
    const targetDate = obj.targetDate?new Date(obj.targetDate):null;
    const daysLeft = targetDate?Math.ceil((targetDate-today)/86400000):null;

    objCard.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        <span style="font-size:18px">🎯</span>
        <div>
          <div style="font-size:12px;font-weight:700;color:var(--text)">${escHtml(obj.text)}</div>
          ${daysLeft!==null?`<div style="font-size:10px;color:var(--muted)">${daysLeft>0?daysLeft+' jours restants':'Objectif atteint !'}</div>`:''}
        </div>
        ${poids&&targetW?`<div style="margin-left:auto;text-align:right">
          <div style="font-size:13px;font-weight:700;font-family:var(--mono);color:var(--teal-d)">${poids}kg</div>
          <div style="font-size:10px;color:var(--muted)">→ ${targetW}kg</div>
        </div>`:''}
      </div>
      ${progress>0?`<div style="background:var(--border);border-radius:6px;height:6px;overflow:hidden">
        <div style="width:${progress}%;height:100%;background:var(--teal);border-radius:6px;transition:width 1s"></div>
      </div>
      <div style="font-size:10px;color:var(--muted);margin-top:4px">${progress}% atteint</div>`:''}`;
    wrap.appendChild(objCard);
  }

  // ── ALERTES ──
  const pains = activePains();
  const alerts = [];
  if(stepsToday<stepsGoal*0.3&&hours>14) alerts.push({icon:'👣',txt:`Seulement ${stepsToday.toLocaleString('fr')} pas — Allez marcher !`,color:'orange',tab:'corps'});
  if(sleepLast>0&&sleepLast<6) alerts.push({icon:'😴',txt:`Sommeil insuffisant (${sleepLast}h) — Repos prioritaire`,color:'red',tab:'corps'});
  if(pains.length>0) alerts.push({icon:'⚠️',txt:`${pains.length} douleur${pains.length>1?'s':''} signalée${pains.length>1?'s':''}`,color:'red',tab:'corps'});
  if(st.current===0&&hours>18) alerts.push({icon:'💪',txt:`Pas encore entraîné aujourd'hui`,color:'teal',tab:'session'});

  if(alerts.length){
    const alertsWrap = document.createElement('div');
    alertsWrap.style.cssText = 'display:flex;flex-direction:column;gap:6px';
    alerts.forEach(a=>{
      const al = document.createElement('div');
      al.className = `dash-alert dash-alert-${a.color}`;
      al.innerHTML = `<span>${a.icon}</span><span style="flex:1">${a.txt}</span><span style="font-size:10px;opacity:.7;cursor:pointer" onclick="switchTab('${a.tab}')">Voir →</span>`;
      alertsWrap.appendChild(al);
    });
    wrap.appendChild(alertsWrap);
  }

  // ── VOLUME HEBDO + BREAKDOWN PPL ──
  setTimeout(()=>{
    // Volume chart
    const volData = computeWeeklyVolume(8);
    if(volData.some(v=>v.value>0)){
      const {wrap:vw,canvas:vc} = mkChartWrap('dash-vol-chart','📊 Volume hebdomadaire','kg/sem');
      wrap.appendChild(vw);
      Charts.barChart(vc, volData.map(v=>({label:v.label,value:v.value,color:v.label==='Cette sem.'?'--teal':'--border'})),{height:120,yFmt:v=>v>=1000?(v/1000).toFixed(1)+'t':Math.round(v)+'kg'});
    }

    // PPL donut
    const ppl = computePPL();
    if(ppl.some(p=>p.value>0)){
      const {wrap:pw,canvas:pc} = mkChartWrap('dash-ppl-chart','🎯 Répartition musculaire','cette semaine');
      wrap.appendChild(pw);
      Charts.donutChart(pc, ppl.map(p=>({label:p.label,value:p.value,color:p.color})),{size:100});
    }
  }, 80);
}




// ╔══════════════════════════════════════════════════════╗
// ║  ONBOARDING WIZARD                                   ║
// ╚══════════════════════════════════════════════════════╝
const ONBOARD_KEY = 'ctp_onboard_done_v2';

const ONBOARD_STEPS = [
  { id:'identity', icon:'👤', title:'Votre profil',
    sub:'Ces données servent au calcul de votre IMC et TDEE',
    fields:()=>`
      <div class="onboard-row">
        <div class="onboard-field"><label class="onboard-label">⚧ Sexe</label>
          <select class="onboard-inp" id="ob-gender"><option value="m">Homme</option><option value="f">Femme</option></select></div>
        <div class="onboard-field"><label class="onboard-label">📅 Âge</label>
          <input type="number" class="onboard-inp" id="ob-age" placeholder="30" min="10" max="100"></div>
      </div>
      <div class="onboard-row">
        <div class="onboard-field"><label class="onboard-label">📏 Taille (cm)</label>
          <input type="number" class="onboard-inp" id="ob-height" placeholder="175" min="130" max="230"></div>
        <div class="onboard-field"><label class="onboard-label">⚖️ Poids (kg)</label>
          <input type="number" class="onboard-inp" id="ob-weight" placeholder="75" min="30" max="300" step="0.1"></div>
      </div>
      <div id="ob-bmi-box" style="display:none;margin-top:10px;background:var(--bg);border:1px solid var(--teal);border-radius:10px;padding:10px 14px;font-size:12px">
        IMC : <strong id="ob-bmi-val"></strong> — <span id="ob-bmi-cat"></span>
      </div>`,
    onShow:()=>{
      const calc=()=>{
        const h=parseFloat(document.getElementById('ob-height')?.value);
        const w=parseFloat(document.getElementById('ob-weight')?.value);
        if(h>100&&w>20){
          const bmi=Math.round(w/(h/100)**2*10)/10;
          const cat=bmi<18.5?'Insuffisant':bmi<25?'Normal ✅':bmi<30?'Surpoids':'Obésité';
          document.getElementById('ob-bmi-val').textContent=bmi;
          document.getElementById('ob-bmi-cat').textContent=cat;
          document.getElementById('ob-bmi-box').style.display='block';
        }
      };
      document.getElementById('ob-height')?.addEventListener('input',calc);
      document.getElementById('ob-weight')?.addEventListener('input',calc);
    },
    save:()=>{
      const h=parseInt(document.getElementById('ob-height')?.value)||0;
      const w=parseFloat(document.getElementById('ob-weight')?.value)||0;
      const g=document.getElementById('ob-gender')?.value||'m';
      const a=parseInt(document.getElementById('ob-age')?.value)||30;
      if(h>0) S.profilTaille=h;
      if(w>0){ if(!S.mesures.poids)S.mesures.poids=[];
        const td=localDateStr(); if(!S.mesures.poids.find(e=>e.date===td)) S.mesures.poids.push({date:td,val:String(w)});}
      S._gender=g; S._age=a; save();
    }
  },
  { id:'measures', icon:'📏', title:'Mensurations',
    sub:'Pour le suivi corporel et le % de masse grasse (US Navy)',
    fields:()=>`
      <div class="onboard-row">
        <div class="onboard-field"><label class="onboard-label">🎽 Poitrine (cm)</label>
          <input type="number" class="onboard-inp" id="ob-chest" placeholder="100" min="50" max="200" step="0.5"></div>
        <div class="onboard-field"><label class="onboard-label">👔 Taille (cm)</label>
          <input type="number" class="onboard-inp" id="ob-waist" placeholder="85" min="50" max="200" step="0.5"></div>
      </div>
      <div class="onboard-row">
        <div class="onboard-field"><label class="onboard-label">🍑 Hanches (cm)</label>
          <input type="number" class="onboard-inp" id="ob-hips" placeholder="95" min="50" max="200" step="0.5"></div>
        <div class="onboard-field"><label class="onboard-label">📏 Tour de cou (cm)</label>
          <input type="number" class="onboard-inp" id="ob-neck" placeholder="38" min="20" max="60" step="0.5"></div>
      </div>
      <div class="onboard-row">
        <div class="onboard-field"><label class="onboard-label">💪 Bras contracté (cm)</label>
          <input type="number" class="onboard-inp" id="ob-arm" placeholder="35" min="15" max="70" step="0.5"></div>
        <div class="onboard-field"><label class="onboard-label">🦵 Cuisse (cm)</label>
          <input type="number" class="onboard-inp" id="ob-thigh" placeholder="58" min="20" max="100" step="0.5"></div>
      </div>
      <div class="onboard-info-box">💡 Toutes les mesures sont optionnelles. La formule US Navy utilise taille + tour de taille + tour de cou.</div>`,
    onShow:()=>{},
    save:()=>{
      const today=localDateStr();
      [{id:'ob-chest',key:'poitrine'},{id:'ob-waist',key:'taille'},{id:'ob-hips',key:'hanches'},
       {id:'ob-arm',key:'bras'},{id:'ob-thigh',key:'cuisse'},{id:'ob-neck',key:'cou'}].forEach(({id,key})=>{
        const v=document.getElementById(id)?.value;
        if(v&&parseFloat(v)>0){if(!S.mesures[key])S.mesures[key]=[];
          if(!S.mesures[key].find(e=>e.date===today))S.mesures[key].push({date:today,val:v});}
      }); save();
    }
  },
  { id:'goals', icon:'🎯', title:'Vos objectifs',
    sub:"Définissez votre objectif principal",
    fields:()=>`
      <div class="onboard-field"><label class="onboard-label">🏆 Objectif principal</label>
        <div class="onboard-chips" id="ob-goal-chips">
          <div class="onboard-chip" data-val="prise_masse">💪 Prise de masse</div>
          <div class="onboard-chip" data-val="perte_poids">🔥 Perte de poids</div>
          <div class="onboard-chip" data-val="force">🏋️ Force</div>
          <div class="onboard-chip" data-val="sante">❤️ Santé</div>
          <div class="onboard-chip" data-val="recompo">⚡ Recomposition</div>
        </div>
      </div>
      <div class="onboard-row">
        <div class="onboard-field"><label class="onboard-label">⚖️ Poids cible (kg)</label>
          <input type="number" class="onboard-inp" id="ob-target-weight" placeholder="70" min="30" max="300" step="0.1"></div>
        <div class="onboard-field"><label class="onboard-label">📅 Date cible</label>
          <input type="date" class="onboard-inp" id="ob-target-date" min="${new Date().toISOString().slice(0,10)}"></div>
      </div>
      <div class="onboard-field"><label class="onboard-label">👣 Objectif pas/jour</label>
        <div class="onboard-chips" id="ob-steps-chips">
          <div class="onboard-chip" data-val="5000">5 000</div>
          <div class="onboard-chip sel" data-val="10000">10 000</div>
          <div class="onboard-chip" data-val="12000">12 000</div>
          <div class="onboard-chip" data-val="15000">15 000</div>
        </div>
      </div>
      <div class="onboard-field"><label class="onboard-label">🔥 Calories/jour</label>
        <input type="number" class="onboard-inp" id="ob-cal-goal" placeholder="2500" min="1000" max="6000" step="50">
        <div id="ob-tdee-hint" style="font-size:11px;color:var(--muted);margin-top:4px"></div>
      </div>`,
    onShow:()=>{
      document.getElementById('ob-goal-chips')?.addEventListener('click',e=>{
        const ch=e.target.closest('.onboard-chip');if(!ch)return;
        document.querySelectorAll('#ob-goal-chips .onboard-chip').forEach(x=>x.classList.remove('sel'));
        ch.classList.add('sel');
      });
      document.getElementById('ob-steps-chips')?.addEventListener('click',e=>{
        const ch=e.target.closest('.onboard-chip');if(!ch)return;
        document.querySelectorAll('#ob-steps-chips .onboard-chip').forEach(x=>x.classList.remove('sel'));
        ch.classList.add('sel');
      });
      try{const td=computeTDEE();if(td.tdee>0){
        const hint=document.getElementById('ob-tdee-hint');
        if(hint)hint.textContent='TDEE estimé: ~'+td.tdee+' kcal/j';
        const inp=document.getElementById('ob-cal-goal');
        if(inp&&!inp.value)inp.value=td.tdee;
      }}catch(e){}
    },
    save:()=>{
      const gc=document.querySelector('#ob-goal-chips .onboard-chip.sel');
      const sc=document.querySelector('#ob-steps-chips .onboard-chip.sel');
      const tw=document.getElementById('ob-target-weight')?.value;
      const td=document.getElementById('ob-target-date')?.value;
      const cg=parseInt(document.getElementById('ob-cal-goal')?.value)||0;
      if(gc){const gm={prise_masse:'Prise de masse musculaire',perte_poids:'Perte de poids',force:'Force et performance',sante:'Santé générale',recompo:'Recomposition corporelle'};
        S.objective=S.objective||{};S.objective.text=gm[gc.dataset.val]||gc.textContent.trim();
        if(tw)S.objective.targetWeight=tw;if(td)S.objective.targetDate=td;S.objective._createdAt=localDateStr();}
      if(sc)S.stepsGoal=parseInt(sc.dataset.val)||10000;
      if(cg>0)S.caloriesGoal=cg; save();
    }
  },
  { id:'training', icon:'💪', title:'Entraînement',
    sub:'Pour personnaliser votre planning',
    fields:()=>`
      <div class="onboard-field"><label class="onboard-label">📅 Date de début</label>
        <input type="date" class="onboard-inp" id="ob-start-date" value="${new Date().toISOString().slice(0,10)}"></div>
      <div class="onboard-field"><label class="onboard-label">⚡ Niveau</label>
        <div class="onboard-chips" id="ob-level-chips">
          <div class="onboard-chip" data-val="debutant">🌱 Débutant</div>
          <div class="onboard-chip sel" data-val="intermediaire">💪 Intermédiaire</div>
          <div class="onboard-chip" data-val="avance">🔥 Avancé</div>
        </div>
      </div>
      <div class="onboard-field"><label class="onboard-label">📆 Jours / semaine</label>
        <div class="onboard-chips" id="ob-days-chips">
          <div class="onboard-chip" data-val="2">2j</div><div class="onboard-chip" data-val="3">3j</div>
          <div class="onboard-chip sel" data-val="4">4j</div><div class="onboard-chip" data-val="5">5j</div>
          <div class="onboard-chip" data-val="6">6j</div>
        </div>
      </div>
      <div class="onboard-field"><label class="onboard-label">🏠 Lieu</label>
        <div class="onboard-chips" id="ob-place-chips">
          <div class="onboard-chip sel" data-val="salle">🏋️ Salle</div>
          <div class="onboard-chip" data-val="maison">🏠 Maison</div>
          <div class="onboard-chip" data-val="mixte">⚡ Mixte</div>
        </div>
      </div>
      <div class="onboard-info-box">🎉 <strong>Tout est prêt !</strong> Vous pouvez modifier ces données à tout moment dans Corps et Paramètres.</div>`,
    onShow:()=>{
      ['ob-level-chips','ob-days-chips','ob-place-chips'].forEach(cid=>{
        document.getElementById(cid)?.addEventListener('click',e=>{
          const ch=e.target.closest('.onboard-chip');if(!ch)return;
          document.querySelectorAll('#'+cid+' .onboard-chip').forEach(x=>x.classList.remove('sel'));
          ch.classList.add('sel');
        });
      });
    },
    save:()=>{
      const lc=document.querySelector('#ob-level-chips .onboard-chip.sel');
      const dc=document.querySelector('#ob-days-chips .onboard-chip.sel');
      const pc=document.querySelector('#ob-place-chips .onboard-chip.sel');
      const sd=document.getElementById('ob-start-date')?.value;
      if(lc)S._level=lc.dataset.val;
      if(dc)S._daysPerWeek=parseInt(dc.dataset.val)||4;
      if(pc)S._place=pc.dataset.val;
      if(sd)S._startDate=sd;
      save();
    }
  }
];

/* _obStep — déclaré dans constants.js */
function _obRender(){
  const step=ONBOARD_STEPS[_obStep];
  const bar=document.getElementById('onboard-steps-bar');
  if(bar){bar.innerHTML='';ONBOARD_STEPS.forEach((_,i)=>{const d=document.createElement('div');d.className='onboard-step-dot'+(i<=_obStep?' done':'');bar.appendChild(d);});}
  const body=document.getElementById('onboard-body');
  if(body){body.innerHTML=`<div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:4px">${step.icon} ${step.title}</div><div style="font-size:12px;color:var(--muted);margin-bottom:18px">${step.sub}</div>${step.fields()}`;
    setTimeout(()=>step.onShow(),50);}
  const back=document.getElementById('onboard-back');
  const next=document.getElementById('onboard-next');
  if(back)back.style.display=_obStep>0?'block':'none';
  if(next)next.textContent=_obStep===ONBOARD_STEPS.length-1?'🚀 Démarrer !':'Suivant →';
}

function _obNext(){ONBOARD_STEPS[_obStep].save();if(_obStep<ONBOARD_STEPS.length-1){_obStep++;_obRender();}else{_obFinish();}}
function _obBack(){if(_obStep>0){_obStep--;_obRender();}}
function _obFinish(){localStorage.setItem(ONBOARD_KEY,'1');const ov=document.getElementById('onboard-overlay');if(ov)ov.style.display='none';save();try{updateStats();renderDashboard();}catch(e){}showToast('✅ Configuration terminée ! Bienvenue 🏋️','ok',4000);}

function showOnboarding(){
  _obStep=0;
  const ov=document.getElementById('onboard-overlay');
  if(!ov){setTimeout(showOnboarding,200);return;}
  ov.style.display='flex';
  _obRender();
  if(!_obListenersBound){
    _obListenersBound=true;
    document.getElementById('onboard-next')?.addEventListener('click',_obNext);
    document.getElementById('onboard-back')?.addEventListener('click',_obBack);
    document.getElementById('onboard-skip')?.addEventListener('click',()=>{ONBOARD_STEPS[_obStep].save();_obFinish();});
  }
}

function checkOnboarding(){if(!localStorage.getItem(ONBOARD_KEY))setTimeout(showOnboarding,800);}
function resetOnboarding(){localStorage.removeItem(ONBOARD_KEY);showOnboarding();}


// ╔══════════════════════════════════════════════════════╗
// ║  MINUTEUR DE REPOS                                   ║
// ╚══════════════════════════════════════════════════════╝

const RestTimer = {
  _interval: null,
  _total: 90,
  _remaining: 90,
  _targetTime: null,      // horloge murale — survit au background iOS
  _exName: '',
  _nextSetCb: null,
  _beepCtx: null,
  _autoCloseTimer: null,

  // ── Ouvrir le timer ──
  start(durationSec, exName, onNextSet) {
    this.stop();
    this._total      = durationSec || (S._restDuration || 90);
    this._remaining  = this._total;
    this._targetTime = Date.now() + this._total * 1000;  // horloge murale
    this._exName     = exName || '';
    this._nextSetCb  = onNextSet || null;

    const overlay = document.getElementById('rest-timer-overlay');
    const card    = document.getElementById('rest-timer-card');
    const exEl    = document.getElementById('rest-timer-ex-name');
    if (!overlay) return;

    if (exEl) exEl.textContent = exName || '';
    if (card) card.classList.remove('done-pulse');
    document.getElementById('rest-ring-fill')?.classList.remove('done');

    document.querySelectorAll('.rest-timer-preset').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.sec) === this._total);
    });

    overlay.style.display = 'flex';
    this._render();
    this._bindButtons(overlay);
    this._interval = setInterval(() => this._tick(), 500); // 500ms pour plus de précision
  },

  // ── Tick — basé sur l'horloge murale (résiste au background iOS) ──
  _tick() {
    const newRemaining = Math.max(0, Math.round((this._targetTime - Date.now()) / 1000));
    if (newRemaining === this._remaining && newRemaining > 0) return; // pas de changement
    this._remaining = newRemaining;
    this._render();
    if (this._remaining <= 1 && this._remaining > 0) {
      this._beep(880, 0.15); // bip de fin imminent
    }
    if (this._remaining <= 0) {
      this._finish();
    }
  },

  // ── Resynchronisation quand l'app revient au premier plan ──
  _onVisibilityChange() {
    if (document.visibilityState === 'visible' && this._interval && this._targetTime) {
      this._remaining = Math.max(0, Math.round((this._targetTime - Date.now()) / 1000));
      this._render();
      if (this._remaining <= 0) this._finish();
    }
  },
  _bindButtons(overlay) {
    const t = this;

    function bind(el, fn) {
      if (!el) return;
      // Nettoyer les anciens handlers
      el.ontouchstart = null;
      el.onclick      = null;
      // ontouchstart : se déclenche immédiatement, sans délai iOS
      el.ontouchstart = function(e) {
        e.stopPropagation();
        e.preventDefault(); // empêche le click synthétique
        fn();
      };
      // onclick : fallback desktop uniquement
      el.onclick = function(e) { fn(); };
    }

    bind(document.getElementById('rest-timer-skip'), () => t.stop());

    bind(document.getElementById('rest-timer-next'), () => {
      const cb = t._nextSetCb;
      t.stop();
      if (cb) setTimeout(cb, 50);
    });

    bind(document.getElementById('rest-timer-add-btn'), () => {
      t.addTime(15);
    });

    document.querySelectorAll('.rest-timer-preset').forEach(btn => {
      bind(btn, () => {
        const sec = parseInt(btn.dataset.sec);
        document.querySelectorAll('.rest-timer-preset').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        t.setDuration(sec);
      });
    });

    // Tap sur le fond = fermer
    if (overlay) {
      overlay.ontouchstart = function(e) {
        if (e.target === overlay) {
          e.preventDefault();
          t.stop();
        }
      };
      overlay.onclick = function(e) {
        if (e.target === overlay) t.stop();
      };
    }
  },

  // ── Tick — délégué à _onVisibilityChange + wall clock ──
  _tick() {
    const newRemaining = Math.max(0, Math.round((this._targetTime - Date.now()) / 1000));
    if (newRemaining === this._remaining && newRemaining > 0) return;
    this._remaining = newRemaining;
    this._render();
    if (this._remaining === 3 || this._remaining === 2 || this._remaining === 1) {
      this._beep(880, 0.15);
    }
    if (this._remaining <= 0) this._finish();
  },

  // ── Affichage ──
  _render() {
    const sec  = Math.max(0, this._remaining);
    const min  = Math.floor(sec / 60);
    const s    = sec % 60;
    const disp = `${min}:${String(s).padStart(2,'0')}`;

    const timeEl = document.getElementById('rest-timer-time');
    if (timeEl) timeEl.textContent = disp;

    const circ = 2 * Math.PI * 68;
    const fill = document.getElementById('rest-ring-fill');
    if (fill) {
      const pct    = Math.max(0, this._remaining / this._total);
      fill.style.strokeDashoffset = circ * (1 - pct);
      fill.style.stroke = pct > 0.5 ? 'var(--teal)' : pct > 0.25 ? 'var(--orange)' : 'var(--red)';
    }
  },

  // ── Fin du repos ──
  _finish() {
    clearInterval(this._interval);
    this._interval = null;

    const card   = document.getElementById('rest-timer-card');
    const fill   = document.getElementById('rest-ring-fill');
    const timeEl = document.getElementById('rest-timer-time');

    if (card)   card.classList.add('done-pulse');
    if (fill)   { fill.style.stroke = 'var(--green)'; fill.classList.add('done'); }
    if (timeEl) timeEl.textContent = '0:00';

    if (S._restBeep !== false) {
      this._beep(660, 0.2);
      setTimeout(() => this._beep(880, 0.2), 200);
      setTimeout(() => this._beep(1100, 0.3), 400);
    }

    // Auto-fermeture après 8s
    this._autoCloseTimer = setTimeout(() => this.stop(), 8000);

    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        new Notification('⏱ Repos terminé !', {
          body: 'Prêt pour la prochaine série' + (this._exName ? ' de ' + this._exName : ''),
          icon: './icons/icon-192.png',
          silent: true
        });
      } catch(e) {}
    }
  },

  // ── Stopper ──
  stop() {
    clearInterval(this._interval);
    clearTimeout(this._autoCloseTimer);
    this._interval      = null;
    this._autoCloseTimer = null;
    const overlay = document.getElementById('rest-timer-overlay');
    if (overlay) overlay.style.display = 'none';
    const card = document.getElementById('rest-timer-card');
    if (card) card.classList.remove('done-pulse');
  },

  // ── +temps ──
  addTime(sec) {
    this._remaining  = Math.min(this._remaining + sec, 600);
    this._total      = Math.max(this._total, this._remaining);
    this._targetTime = Date.now() + this._remaining * 1000; // resync horloge murale
    this._render();
  },

  // ── Changer durée ──
  setDuration(sec) {
    this._total      = sec;
    this._remaining  = sec;
    this._targetTime = Date.now() + sec * 1000; // resync horloge murale
    S._restDuration  = sec;
    save();
    this._render();
    clearInterval(this._interval);
    this._interval = setInterval(() => this._tick(), 500);
  },

  // ── Son ──
  _beep(freq, dur) {
    try {
      if (!this._beepCtx) this._beepCtx = new (window.AudioContext || window.webkitAudioContext)();
      const ctx  = this._beepCtx;
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + dur);
    } catch(e) {}
  }
};

// _initRestTimerButtons : conservé pour compatibilité — bindings faits dans RestTimer.start() via _bindButtons
// no-op depuis v45 — voir RestTimer.start() → _bindButtons()
function _initRestTimerButtons() {
  // Écouter visibilitychange pour resynchroniser le timer quand l'app revient au premier plan
  document.addEventListener('visibilitychange', () => {
    RestTimer._onVisibilityChange();
  });
  // Les bindings boutons sont maintenant faits dans RestTimer.start() via ontouchstart
}


// ╔══════════════════════════════════════════════════════╗
// ║  CALCUL AUTOMATIQUE DES MACROS                       ║
// ╚══════════════════════════════════════════════════════╝

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

function applyMacroGoals() {
  const mg = computeMacroGoals();
  S.caloriesGoal  = mg.calories;
  S.proteinGoal   = mg.protein;
  S.carbsGoal     = mg.carbs;
  S.fatGoal       = mg.fat;
  save();
  showToast(
    `🎯 Macros calculées : ${mg.calories} kcal · P ${mg.protein}g · G ${mg.carbs}g · L ${mg.fat}g`,
    'ok', 5000
  );
  renderCalTracker();
}


// ╔══════════════════════════════════════════════════════╗
// ║  NOTIFICATIONS PUSH                                  ║
// ╚══════════════════════════════════════════════════════╝



/* sendLocalNotif — défini dans utils.js */

// ── Planifier rappel d'entraînement quotidien ──
function scheduleTrainingReminder(hour, minute) {
  // Sauvegarde l'heure choisie
  S._reminderHour   = hour;
  S._reminderMinute = minute;
  save();

  // Calcule le délai jusqu'à la prochaine occurrence
  function getNextMs() {
    const now  = new Date();
    const next = new Date();
    next.setHours(hour, minute, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1); // demain si déjà passé
    return next - now;
  }

  // Annuler le timer précédent
  if (window._reminderTimeout) clearTimeout(window._reminderTimeout);

  function fire() {
    const today = new Date();
    // Vérifier si une séance est prévue aujourd'hui
    const dayIdx = (today.getDay() + 6) % 7; // lundi=0
    const todayDay = S.days[dayIdx];
    const hasSession = todayDay?.exercises?.some(e => e.name?.trim() && !e.isWarmup);
    
    if (hasSession) {
      const exs = todayDay.exercises.filter(e => e.name?.trim() && !e.isWarmup);
      sendLocalNotif(
        "💪 C'est l'heure de t'entraîner !",
        `${exs.length} exercice${exs.length>1?'s':''} au programme — ${exs.slice(0,2).map(e=>e.name).join(', ')}${exs.length>2?' +'+( exs.length-2):''}`,
        './icons/icon-192.png'
      );
    } else {
      sendLocalNotif("😴 Journée de repos", "Récupération active recommandée.", './icons/icon-192.png');
    }
    // Replanifier pour demain
    window._reminderTimeout = setTimeout(fire, getNextMs());
  }

  window._reminderTimeout = setTimeout(fire, getNextMs());
  showToast(`🔔 Rappel planifié à ${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`, 'ok', 3000);
}

function cancelTrainingReminder() {
  if (window._reminderTimeout) clearTimeout(window._reminderTimeout);
  S._reminderHour = null; S._reminderMinute = null;
  save();
  showToast('🔕 Rappel annulé', 'warn', 2000);
}

// ── Relancer le rappel au démarrage si configuré ──
function restoreReminder() {
  if (S._reminderHour != null && S._reminderMinute != null) {
    scheduleTrainingReminder(S._reminderHour, S._reminderMinute);
  }
}


// ╔══════════════════════════════════════════════════════╗
// ║  SCAN CODE-BARRES — Open Food Facts                  ║
// ╚══════════════════════════════════════════════════════╝

/* _barcodeStream — déclaré dans constants.js */
async function openBarcodeScanner(onResult) {
  // Demander accès caméra
  if (!navigator.mediaDevices?.getUserMedia) {
    showToast('Caméra non disponible', 'warn'); return;
  }

  const overlay = document.getElementById('barcode-overlay');
  const video   = document.getElementById('barcode-video');
  const status  = document.getElementById('barcode-status');
  if (!overlay || !video) return;

  overlay.style.display = 'flex';
  status.textContent = '📷 Ouverture de la caméra...';

  try {
    _barcodeStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
    });
    video.srcObject = _barcodeStream;
    await video.play();
    status.textContent = '📷 Pointez le code-barres';

    // Utiliser BarcodeDetector si disponible (Chrome/Safari récent)
    if ('BarcodeDetector' in window) {
      const detector = new BarcodeDetector({ formats: ['ean_13','ean_8','upc_a','upc_e','code_128','code_39'] });
      let scanning = true;
      
      const scan = async () => {
        if (!scanning) return;
        try {
          const codes = await detector.detect(video);
          if (codes.length > 0) {
            scanning = false;
            const barcode = codes[0].rawValue;
            status.textContent = `✅ Code détecté: ${barcode} — Recherche...`;
            await lookupBarcode(barcode, onResult);
            closeBarcodeScanner();
          }
        } catch(e) {}
        if (scanning) requestAnimationFrame(scan);
      };
      requestAnimationFrame(scan);

    } else {
      // Fallback: saisie manuelle
      status.textContent = '⚠️ Scanner non supporté — saisissez le code manuellement';
      const manualWrap = document.getElementById('barcode-manual');
      if (manualWrap) manualWrap.style.display = 'flex';
    }

  } catch(err) {
    status.textContent = '❌ Accès caméra refusé — saisissez le code manuellement';
    const manualWrap = document.getElementById('barcode-manual');
    if (manualWrap) manualWrap.style.display = 'flex';
  }
}

async function lookupBarcode(code, onResult) {
  try {
    const url = `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,nutriments,serving_size,brands`;
    const resp = await fetch(url);
    const data = await resp.json();
    
    if (data.status === 1 && data.product) {
      const p = data.product;
      const n = p.nutriments || {};
      const per100 = (key) => Math.round((n[key + '_100g'] || 0) * 10) / 10;
      
      const result = {
        name:    (p.brands ? p.brands.split(',')[0] + ' — ' : '') + (p.product_name || 'Inconnu'),
        cal:     per100('energy-kcal'),
        protein: per100('proteins'),
        carbs:   per100('carbohydrates'),
        fat:     per100('fat'),
        per:     '100g',
      };
      
      if (onResult) onResult(result);
      showToast('✅ Produit trouvé: ' + result.name.slice(0,30), 'ok', 3000);
    } else {
      showToast('❌ Produit introuvable (code: ' + code + ')', 'warn', 3000);
    }
  } catch(e) {
    showToast('❌ Erreur réseau — vérifiez votre connexion', 'warn', 3000);
  }
}

function closeBarcodeScanner() {
  if (_barcodeStream) {
    _barcodeStream.getTracks().forEach(t => t.stop());
    _barcodeStream = null;
  }
  const overlay = document.getElementById('barcode-overlay');
  if (overlay) overlay.style.display = 'none';
  const video = document.getElementById('barcode-video');
  if (video) { video.srcObject = null; }
  const manualWrap = document.getElementById('barcode-manual');
  if (manualWrap) manualWrap.style.display = 'none';
}

async function manualBarcodeSearch() {
  const inp = document.getElementById('barcode-manual-inp');
  if (!inp || !inp.value.trim()) return;
  const code = inp.value.trim();
  document.getElementById('barcode-status').textContent = `🔍 Recherche de ${code}...`;
  await lookupBarcode(code, window._barcodeCb);
  closeBarcodeScanner();
}


// ╔══════════════════════════════════════════════════════╗
// ║  EXPORT PDF BILAN                                    ║
// ╚══════════════════════════════════════════════════════╝

function exportBilanPDF() {
  // Générer une page HTML dédiée au bilan, puis window.print()
  const fs = computeFitnessScore();
  const td = computeTDEE();
  const st = computeStreak();
  const bc = computeBodyComp();
  const today = new Date().toLocaleDateString('fr-FR', {day:'numeric',month:'long',year:'numeric'});
  
  // Calculs semaine
  const days7 = lastNDays(7);
  const weekSteps  = days7.reduce((a,d)=>a+(parseInt(S.steps&&S.steps[d]||0)||0),0);
  const weekCals   = computeDailyCalories(7).reduce((a,p)=>a+p.y,0);
  const weekSleep  = computeDailySleep(7).filter(p=>p.y>0);
  const avgSleep   = weekSleep.length ? weekSleep.reduce((a,p)=>a+p.y,0)/weekSleep.length : 0;
  const trained    = days7.filter(d=>S.history&&S.history[d]&&(S.history[d].length||Object.keys(S.history[d]).length)>0).length;
  const volSem     = computeWeeklyVolume(1)[0]?.value || 0;
  
  const poids      = parseFloat((S.mesures?.poids||[]).slice(-1)[0]?.val)||0;
  const objective  = S.objective?.text || 'Non défini';

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Bilan Coach Tracker Pro — ${today}</title>

</head>
<body>

<div class="header">
  <div>
    <h1>🏋️ Coach Tracker Pro</h1>
    <div class="date">Bilan hebdomadaire — ${today}</div>
    <div style="margin-top:8px;font-size:11px;opacity:.85">
      Objectif : <strong>${escHtml(objective)}</strong>${poids>0?' · Poids actuel : '+poids+' kg':''}
    </div>
  </div>
  <div class="score-badge">
    <div class="num">${fs.score}</div>
    <div class="lbl">Score</div>
  </div>
</div>

<div class="section-title">📊 Score de forme global</div>
<div class="score-row">
  ${fs.breakdown.map(b=>`<div class="score-chip">${b.icon} ${b.label} <span class="pts">${b.pts}/100</span></div>`).join('')}
</div>

<div class="section-title">💪 Activité cette semaine</div>
<div class="grid">
  <div class="card">
    <div class="card-title">Entraînement</div>
    <div class="stat"><span class="stat-lbl">Séances réalisées</span><span class="stat-val">${trained}/7 jours</span></div>
    <div class="stat"><span class="stat-lbl">Volume total</span><span class="stat-val">${volSem>=1000?(volSem/1000).toFixed(1)+'t':Math.round(volSem)+'kg'}</span></div>
    <div class="stat"><span class="stat-lbl">Série actuelle</span><span class="stat-val">${st.current} jours</span></div>
    <div class="stat"><span class="stat-lbl">Record</span><span class="stat-val">${st.record} jours</span></div>
  </div>
  <div class="card">
    <div class="card-title">Activité & Récupération</div>
    <div class="stat"><span class="stat-lbl">Pas totaux (7j)</span><span class="stat-val">${weekSteps.toLocaleString('fr')}</span></div>
    <div class="stat"><span class="stat-lbl">Moy. pas/jour</span><span class="stat-val">${Math.round(weekSteps/7).toLocaleString('fr')}</span></div>
    <div class="stat"><span class="stat-lbl">Sommeil moyen</span><span class="stat-val">${avgSleep>0?avgSleep.toFixed(1)+'h':'—'}</span></div>
    <div class="stat"><span class="stat-lbl">Nuits ≥7h</span><span class="stat-val">${weekSleep.filter(p=>p.y>=7).length}/7</span></div>
  </div>
</div>

<div class="section-title">🍽️ Nutrition cette semaine</div>
<div class="grid">
  <div class="card">
    <div class="card-title">Calories</div>
    <div class="stat"><span class="stat-lbl">Total 7j</span><span class="stat-val">${Math.round(weekCals).toLocaleString('fr')} kcal</span></div>
    <div class="stat"><span class="stat-lbl">Moyenne/jour</span><span class="stat-val">${Math.round(weekCals/7).toLocaleString('fr')} kcal</span></div>
    <div class="stat"><span class="stat-lbl">Objectif</span><span class="stat-val">${(S.caloriesGoal||2500).toLocaleString('fr')} kcal</span></div>
    <div class="stat"><span class="stat-lbl">TDEE estimé</span><span class="stat-val">${td.tdee} kcal</span></div>
  </div>
  <div class="card">
    <div class="card-title">Objectifs Macros</div>
    ${S.proteinGoal>0 ? `
    <div class="stat"><span class="stat-lbl">Protéines objectif</span><span class="stat-val">${S.proteinGoal}g/j</span></div>
    <div class="stat"><span class="stat-lbl">Glucides objectif</span><span class="stat-val">${S.carbsGoal}g/j</span></div>
    <div class="stat"><span class="stat-lbl">Lipides objectif</span><span class="stat-val">${S.fatGoal}g/j</span></div>
    ` : '<div style="color:#999;font-size:11px;padding:8px 0">Calcule tes macros dans Corps → Calories</div>'}
  </div>
</div>

${bc ? `
<div class="section-title">⚖️ Composition corporelle</div>
<div class="grid3">
  <div class="card" style="text-align:center">
    <div class="card-title">Poids</div>
    <div style="font-size:24px;font-weight:800;color:#5BA8A0">${bc.poids}<span style="font-size:14px">kg</span></div>
  </div>
  <div class="card" style="text-align:center">
    <div class="card-title">IMC</div>
    <div style="font-size:24px;font-weight:800;color:#5BA8A0">${bc.imc}</div>
    <div style="font-size:10px;color:#666">${bc.imc<18.5?'Insuffisant':bc.imc<25?'Normal ✅':bc.imc<30?'Surpoids':'Obésité'}</div>
  </div>
  ${bc.bf ? `<div class="card" style="text-align:center">
    <div class="card-title">% Masse grasse</div>
    <div style="font-size:24px;font-weight:800;color:#5BA8A0">${bc.bf}<span style="font-size:14px">%</span></div>
    ${bc.leanMass ? `<div style="font-size:10px;color:#666">Masse maigre: ${bc.leanMass}kg</div>` : ''}
  </div>` : '<div class="card"><div class="card-title">% Masse grasse</div><div style="color:#999;font-size:11px">Renseigner le tour de cou pour calculer</div></div>'}
</div>` : ''}

<div style="text-align:center;margin-top:20px">
  <button onclick="window.print()" style="padding:10px 24px;background:#5BA8A0;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer">🖨️ Imprimer / Enregistrer en PDF</button>
</div>

<div class="footer">
  Généré par Coach Tracker Pro · ${today} · doncivo.github.io/coach-tracker-pro
</div>


<!-- ══ SCANNER CODE-BARRES ══ -->
<div id="barcode-overlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:6000;flex-direction:column;align-items:center;justify-content:center;gap:16px">
  <div style="position:relative;width:min(340px,90vw);border-radius:16px;overflow:hidden;background:#000">
    <video id="barcode-video" autoplay playsinline muted style="width:100%;display:block;aspect-ratio:4/3;object-fit:cover"></video>
    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none">
      <div style="width:220px;height:120px;border:3px solid #5BA8A0;border-radius:8px;position:relative">
        <div style="position:absolute;left:0;right:0;top:50%;height:2px;background:linear-gradient(90deg,transparent,#5BA8A0,transparent);animation:scan-anim 1.5s ease-in-out infinite"></div>
      </div>
    </div>
  </div>
  <div id="barcode-status" style="color:#fff;font-size:13px;text-align:center;padding:0 20px;font-weight:600">📷 Initialisation...</div>
  <div id="barcode-manual" style="display:none;gap:8px;align-items:center;flex-wrap:wrap;justify-content:center;padding:0 16px">
    <input id="barcode-manual-inp" type="text" inputmode="numeric" placeholder="Code-barres (ex: 3017620422003)"
      style="padding:10px 14px;border-radius:10px;border:1.5px solid rgba(255,255,255,.3);background:rgba(255,255,255,.1);color:#fff;font-size:16px;width:min(260px,80vw)"
      onkeydown="if(event.key==='Enter')manualBarcodeSearch()">
    <button onclick="manualBarcodeSearch()" style="padding:10px 20px;border-radius:10px;border:none;background:#5BA8A0;color:#fff;font-weight:700;font-size:14px;cursor:pointer">Rechercher</button>
  </div>
  <button onclick="closeBarcodeScanner()" style="padding:10px 28px;border-radius:12px;border:1.5px solid rgba(255,255,255,.3);background:transparent;color:#fff;font-size:14px;font-weight:600;cursor:pointer;margin-top:4px">✕ Fermer</button>
</div>


</body>
</html>`;

  // Ouvrir dans un nouvel onglet
  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 800);
  } else {
    // Fallback: téléchargement direct
    const blob = new Blob([html], {type:'text/html;charset=utf-8'});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'bilan-coach-tracker-'+localDateStr()+'.html';
    a.click(); URL.revokeObjectURL(url);
    showToast('📄 Bilan téléchargé — ouvre le fichier et imprime en PDF', 'ok', 5000);
  }
}


// ── Corps sub-navigation ──
function initCorpsSubNav() {
  document.querySelectorAll('.corps-subbtn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.corps-subbtn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.corps-section').forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
      const sect = document.getElementById('corps-sect-' + btn.dataset.corps);
      if (sect) sect.classList.add('active');
      if (btn.dataset.corps === 'nutrition') renderCalTracker();
      if (btn.dataset.corps === 'mesures')   renderCorps();
      if (btn.dataset.corps === 'activite')  { renderStepsGrid(); renderSleepGrid(); renderStreakHeatmap(); }
      if (btn.dataset.corps === 'journal')   { renderNutriGrid(); renderPainList(); }
    });
  });
}
