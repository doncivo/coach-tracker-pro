/* ============================================================
   render_corps.js — Page Corps
============================================================ */

/* ══ CORPS ══ */

/* ══ STEPS TRACKER ══ */
/* _calDayOffset — déclaré dans constants.js */

function renderStepsGrid() {
  const grid = document.getElementById('steps-grid');
  const summary = document.getElementById('steps-summary');
  const goalInp = document.getElementById('steps-goal-inp');
  if (!grid) return;

  // Load goal from state
  if (goalInp) {
    goalInp.value = S.stepsGoal || 10000;
    goalInp.addEventListener('change', e => {
      S.stepsGoal = parseInt(e.target.value) || 10000;
      save(); renderStepsGrid();
    });
  }

  const goal = S.stepsGoal || 10000;
  grid.innerHTML = '';
  let totalSteps = 0, daysWithData = 0, bestDay = 0, bestDaySteps = 0;
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ds = localDateStr(d);
    const steps = parseInt((S.steps && S.steps[ds]) || 0);
    const pct = Math.min(100, Math.round(steps / goal * 100));
    const reached = steps >= goal;
    if (steps > 0) { totalSteps += steps; daysWithData++; }
    if (steps > bestDaySteps) { bestDaySteps = steps; bestDay = i; }

    const card = document.createElement('div');
    card.className = 'steps-day-card' + (reached ? ' goal-reached' : '');
    card.setAttribute('data-date', ds);

    const lbl = document.createElement('div');
    lbl.className = 'steps-day-lbl';
    lbl.textContent = DAYS_SH[(d.getDay() + 6) % 7];

    const dateEl = document.createElement('div');
    dateEl.className = 'steps-day-date';
    dateEl.textContent = d.toLocaleDateString('fr-FR', {day:'2-digit', month:'2-digit'});

    const inp = document.createElement('input');
    inp.type = 'number';
    inp.className = 'steps-inp';
    inp.value = steps || '';
    inp.placeholder = '0';
    inp.min = 0;
    inp.max = 100000;
    inp.step = 100;
    inp.setAttribute('aria-label', 'Pas du ' + DAYS[( d.getDay() + 6) % 7]);
    inp.addEventListener('change', e => {
      if (!S.steps) S.steps = {};
      Store.dispatch({type:'ACTIVITY_SET_STEPS',payload:{date:ds,value:parseInt(e.target.value)||0}});
      save(); renderStepsGrid();
    });

    const barWrap = document.createElement('div');
    barWrap.className = 'steps-bar-wrap';
    const bar = document.createElement('div');
    bar.className = 'steps-bar' + (reached ? ' goal-ok' : '');
    bar.style.width = pct + '%';
    barWrap.appendChild(bar);

    const emoji = document.createElement('div');
    emoji.style.cssText = 'font-size:14px;line-height:1';
    emoji.textContent = reached ? '🎯' : pct >= 75 ? '💪' : pct >= 50 ? '🚶' : steps > 0 ? '🐌' : '';

    card.appendChild(lbl);
    card.appendChild(dateEl);
    card.appendChild(inp);
    card.appendChild(barWrap);
    card.appendChild(emoji);
    grid.appendChild(card);
  }

  // Steps chart
  const stepsChartC = document.getElementById('steps-chart-container');
  if (stepsChartC) setTimeout(() => renderStepsChart(stepsChartC), 50);
  // Summary
  if (summary) {
    summary.innerHTML = '';
    const avg = daysWithData > 0 ? Math.round(totalSteps / daysWithData) : 0;
    const daysReached = Array.from({length:7},(_,i)=>{const d=new Date(today);d.setDate(d.getDate()-i);return parseInt((S.steps&&S.steps[localDateStr(d)])||0)>=goal;}).filter(Boolean).length;

    [
      {val: totalSteps.toLocaleString('fr'), lbl: 'Total 7j'},
      {val: avg.toLocaleString('fr'), lbl: 'Moyenne/jour'},
      {val: bestDaySteps.toLocaleString('fr'), lbl: 'Meilleur jour'},
      {val: daysReached + '/7', lbl: 'Jours objectif ✓'},
    ].forEach(({val, lbl}) => {
      const s = document.createElement('div');
      s.className = 'steps-stat';
      const v = document.createElement('div');
      v.className = 'steps-stat-val';
      v.textContent = val;
      const l = document.createElement('div');
      l.className = 'steps-stat-lbl';
      l.textContent = lbl;
      s.appendChild(v); s.appendChild(l);
      summary.appendChild(s);
    });
  }
}

/* ══ CALORIES TRACKER ══ */
const MEAL_NAMES = ['Petit-déjeuner 🌅', 'Déjeuner 🌞', 'Dîner 🌙', 'Collation 🍎'];

function calDayKey(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return localDateStr(d);
}

function calDayLabel(offset) {
  if (offset === 0) return "Aujourd'hui";
  if (offset === -1) return 'Hier';
  if (offset === 1) return 'Demain';
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString('fr-FR', {weekday:'long', day:'2-digit', month:'long'});
}

function renderCalTracker() {
  const lbl = document.getElementById('cal-day-lbl');
  const content = document.getElementById('cal-content');
  const goalInp = document.getElementById('cal-goal-inp');
  if (!content) return;

  if (goalInp) {
    goalInp.value = S.caloriesGoal || 2500;
    goalInp.addEventListener('change', e => {
      S.caloriesGoal = parseInt(e.target.value) || 2500;
      save(); renderCalTracker();
    });
  }

  // ── TDEE dynamique ──
  const tdeeBtn = document.getElementById('tdee-calc-btn');
  if (tdeeBtn && !tdeeBtn._bound) {
    tdeeBtn._bound = true;
    const calcAndShow = () => {
      const poids = parseFloat((S.mesures?.poids||[]).slice(-1)[0]?.val) || 75;
      const taille = S.profilTaille || 175;
      const age = S.profilAge || 30;
      const sex = S.profilSexe || 'H';

      // BMR (Mifflin-St Jeor)
      const bmr = sex==='H'
        ? Math.round(10*poids + 6.25*taille - 5*age + 5)
        : Math.round(10*poids + 6.25*taille - 5*age - 161);

      // Activité réelle : séances last 7 days
      const trainedDays7 = Object.values(S.history||{})
        .flatMap(wk=>(wk.days||[]))
        .filter(d=>{
          const today=new Date(); const dDate=new Date(d.date+'T12:00:00');
          const diff=(today-dDate)/(1000*60*60*24);
          return diff<=7 && (d.exercises||[]).some(e=>e.done&&!e.isWarmup);
        }).length;

      const mult = trainedDays7>=5?1.725:trainedDays7>=3?1.55:trainedDays7>=1?1.375:1.2;
      const tdee = Math.round(bmr * mult);

      const sug = document.getElementById('tdee-suggestion');
      if (!sug) return;
      sug.style.display='block';
      sug.innerHTML='';

      const row=document.createElement('div');
      row.style.cssText='background:rgba(91,168,160,.08);border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:6px';

      const info=document.createElement('div');
      info.style.cssText='font-size:11px;color:var(--text)';
      info.innerHTML='<strong>BMR :</strong> '+bmr+' kcal &nbsp; <strong>Activité :</strong> '+trainedDays7+' séances/sem (×'+mult+') &nbsp; → <strong style="color:var(--teal-d)">TDEE : '+tdee+' kcal</strong>';

      const goals=[
        {label:'Sèche (-20%)',   kcal:Math.round(tdee*0.80), color:'var(--blue)'},
        {label:'Maintenance',    kcal:tdee,                   color:'var(--teal)'},
        {label:'Prise (+15%)',   kcal:Math.round(tdee*1.15),  color:'var(--green)'},
      ];
      const btns=document.createElement('div');btns.style.cssText='display:flex;gap:6px;flex-wrap:wrap';
      goals.forEach(g=>{
        const b=document.createElement('button');
        b.style.cssText='padding:5px 10px;border-radius:8px;border:1.5px solid var(--border);background:var(--bg);font-size:11px;font-weight:600;font-family:var(--font);cursor:pointer;touch-action:manipulation;-webkit-appearance:none;color:'+g.color;
        b.textContent=g.label+' : '+g.kcal+' kcal';
        const apply=()=>{
          S.caloriesGoal=g.kcal;
          if(goalInp)goalInp.value=g.kcal;
          save(); renderCalTracker();
          sug.style.display='none';
          showToast('Objectif calorique : '+g.kcal+' kcal/j','save',2000);
        };
        b.ontouchstart=(e)=>{e.preventDefault();apply();}; b.onclick=apply;
        btns.appendChild(b);
      });

      row.appendChild(info); row.appendChild(btns);
      sug.appendChild(row);
    };
    tdeeBtn.ontouchstart=(e)=>{e.preventDefault();calcAndShow();}; tdeeBtn.onclick=calcAndShow;
  }

  if (lbl) {
    lbl.textContent = calDayLabel(_calDayOffset);
    // Capitalize first letter
    lbl.textContent = lbl.textContent.charAt(0).toUpperCase() + lbl.textContent.slice(1);
  }

  const dk = calDayKey(_calDayOffset);
  if (!S.calories) S.calories = {};
  if (!S.calories[dk]) {
    // Initialiser la structure de repas directement
    const calState = Store.getState().activity.calories;
    calState[dk] = { meals: [{items:[]},{items:[]},{items:[]},{items:[]}] };
  }
  // Ensure 4 meals
  const calDk = Store.getState().activity.calories[dk];
  if (calDk) { while (calDk.meals.length < 4) calDk.meals.push({items:[]}); }

  const dayData = S.calories[dk];
  const goal = S.caloriesGoal || 2500;

  // Totals
  let totalCal = 0, totalP = 0, totalC = 0, totalF = 0;
  dayData.meals.forEach(m => (m.items || []).forEach(item => {
    totalCal += item.cal || 0;
    totalP += item.protein || 0;
    totalC += item.carbs || 0;
    totalF += item.fat || 0;
  }));
  const pct = Math.min(100, Math.round(totalCal / goal * 100));
  const over = totalCal > goal;

  // Cal chart
  const calChartC = document.getElementById('cal-chart-container');
  if (calChartC) setTimeout(() => renderCalChart(calChartC), 50);
  content.innerHTML = '';

  // Total banner
  const totalBanner = document.createElement('div');
  totalBanner.className = 'cal-total-bar';
  totalBanner.style.marginTop = '10px';
  totalBanner.style.marginBottom = '12px';

  const row1 = document.createElement('div');
  row1.className = 'cal-total-row';
  const valEl = document.createElement('div');
  valEl.className = 'cal-total-val';
  valEl.textContent = Math.round(totalCal).toLocaleString('fr') + ' kcal';
  valEl.style.color = over ? 'var(--red)' : 'var(--teal-d)';
  const goalEl = document.createElement('div');
  goalEl.style.cssText = 'text-align:right';
  goalEl.innerHTML = `<div style="font-size:12px;color:var(--muted)">Objectif : ${goal.toLocaleString('fr')} kcal</div>
    <div style="font-size:13px;font-weight:700;color:${over?'var(--red)':'var(--green)'}">${over?'▲ +':'▼ '}${Math.abs(goal-Math.round(totalCal)).toLocaleString('fr')} kcal ${over?'en excès':'restants'}</div>`;
  row1.appendChild(valEl); row1.appendChild(goalEl);

  const barW = document.createElement('div'); barW.className = 'cal-goal-bar-wrap';
  const barF = document.createElement('div'); barF.className = 'cal-goal-bar' + (over?' over':'');
  barF.style.width = pct + '%';
  barW.appendChild(barF);

  const macroRow = document.createElement('div'); macroRow.className = 'cal-macro-row';
  const macroGoals = {
    p: S.proteinGoal || 0,
    c: S.carbsGoal   || 0,
    f: S.fatGoal      || 0,
  };
  [
    {lbl:'Protéines', val:Math.round(totalP), goal:macroGoals.p, unit:'g', color:'var(--purple)'},
    {lbl:'Glucides',  val:Math.round(totalC), goal:macroGoals.c, unit:'g', color:'var(--orange)'},
    {lbl:'Lipides',   val:Math.round(totalF), goal:macroGoals.f, unit:'g', color:'var(--blue)'},
  ].forEach(({lbl, val, goal, unit, color}) => {
    const mc = document.createElement('div'); mc.className = 'cal-macro-card';
    const mv = document.createElement('div'); mv.className = 'cal-macro-val'; mv.style.color = color; mv.textContent = val + unit;
    const ml = document.createElement('div'); ml.className = 'cal-macro-lbl'; ml.textContent = lbl;
    mc.appendChild(mv); mc.appendChild(ml); // Progress bar vs goal
    if(goal > 0) {
      const pctM = Math.min(100, Math.round(val/goal*100));
      const overM = val > goal;
      const bw = document.createElement('div');
      bw.style.cssText='background:var(--border);border-radius:4px;height:3px;margin-top:3px;overflow:hidden';
      const bf = document.createElement('div');
      bf.style.cssText=`width:${pctM}%;height:100%;background:${overM?'var(--red)':color};border-radius:4px`;
      bw.appendChild(bf); mc.appendChild(bw);
      const gl = document.createElement('div');
      gl.style.cssText='font-size:9px;color:var(--muted);margin-top:1px;text-align:center';
      gl.textContent=val+'/'+goal+'g';
      mc.appendChild(gl);
    }
    macroRow.appendChild(mc);
  });

  totalBanner.appendChild(row1); totalBanner.appendChild(barW); totalBanner.appendChild(macroRow);
  content.appendChild(totalBanner);

  // Macro auto-calc button
  const macroGoals2 = { p:S.proteinGoal||0, c:S.carbsGoal||0, f:S.fatGoal||0 };
  const macroCalcRow = document.createElement('div');
  macroCalcRow.style.cssText='display:flex;gap:8px;align-items:center;margin:4px 0 8px;flex-wrap:wrap';
  const macroCalcBtn = document.createElement('button');
  macroCalcBtn.className='btn btn-ghost';
  macroCalcBtn.style.cssText='font-size:11px;padding:5px 10px;min-height:30px';
  macroCalcBtn.innerHTML='🧮 Calculer mes macros';
  macroCalcBtn.title='Calcul automatique basé sur ton TDEE et ton objectif';
  macroCalcBtn.addEventListener('click', applyMacroGoals);
  const macroHint2 = document.createElement('span');
  macroHint2.style.cssText='font-size:10px;color:var(--muted)';
  macroHint2.textContent = macroGoals2.p>0
    ? `Obj: P ${macroGoals2.p}g · G ${macroGoals2.c}g · L ${macroGoals2.f}g`
    : 'Basé sur ton TDEE et objectif';
  macroCalcRow.appendChild(macroCalcBtn);
  macroCalcRow.appendChild(macroHint2);
  content.appendChild(macroCalcRow);

  // Meals
  const mealsWrap = document.createElement('div');
  mealsWrap.className = 'cal-meals';

  dayData.meals.forEach((meal, mi) => {
    const mealCal = (meal.items || []).reduce((a, item) => a + (item.cal || 0), 0);
    const card = document.createElement('div');
    card.className = 'cal-meal-card';

    // Header
    const mHdr = document.createElement('div');
    mHdr.className = 'cal-meal-hdr';
    mHdr.setAttribute('role', 'button');
    mHdr.setAttribute('aria-label', 'Afficher ' + MEAL_NAMES[mi]);

    const mName = document.createElement('div'); mName.className = 'cal-meal-name'; mName.textContent = MEAL_NAMES[mi];
    const mTotal = document.createElement('div'); mTotal.className = 'cal-meal-total';
    mTotal.textContent = Math.round(mealCal) + ' kcal';

    const addItemBtn = document.createElement('button');
    addItemBtn.className = 'btn btn-teal btn-sm';
    addItemBtn.textContent = '+ Ajouter';
    addItemBtn.style.cssText = 'margin-left:8px;min-height:38px;font-size:12px';

    mHdr.appendChild(mName); mHdr.appendChild(mTotal); mHdr.appendChild(addItemBtn);

    // Body
    const mBody = document.createElement('div');
    mBody.className = 'cal-meal-body';

    // Food items
    (meal.items || []).forEach((item, ii) => {
      const fRow = document.createElement('div'); fRow.className = 'cal-food-row';
      const fName = document.createElement('div'); fName.className = 'cal-food-name'; fName.textContent = item.name;
      const fCal = document.createElement('div'); fCal.className = 'cal-food-cals'; fCal.textContent = Math.round(item.cal) + ' kcal';
      const fMacro = document.createElement('div'); fMacro.className = 'cal-food-macros';
      fMacro.textContent = `P:${item.protein||0}g G:${item.carbs||0}g L:${item.fat||0}g`;
      const fDel = document.createElement('button'); fDel.className = 'cal-food-del'; fDel.textContent = '×';
      fDel.setAttribute('aria-label', 'Supprimer ' + item.name);
      fDel.addEventListener('click', () => {
        meal.items.splice(ii, 1); save(); renderCalTracker();
      });
      fRow.appendChild(fName); fRow.appendChild(fCal); fRow.appendChild(fMacro); fRow.appendChild(fDel);
      mBody.appendChild(fRow);
    });

    // Add food form
    const form = document.createElement('div');
    form.className = 'add-food-form';
    form.style.display = 'none';

    // Scan button
    const scanRow = document.createElement('div');
    scanRow.style.cssText = 'display:flex;gap:6px;margin-bottom:8px';
    const scanBtn = document.createElement('button');
    scanBtn.className = 'btn btn-ghost';
    scanBtn.style.cssText = 'font-size:11px;padding:5px 10px;min-height:30px;flex:1';
    scanBtn.innerHTML = '📷 Scanner code-barres';
    const usdaBtn = document.createElement('button');usdaBtn.style.cssText='font-size:11px;padding:5px 10px;min-height:30px;flex:1;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--teal-d);font-family:var(--font);cursor:pointer;touch-action:manipulation;-webkit-appearance:none';usdaBtn.textContent='🔍 USDA';
    usdaBtn.addEventListener('click',()=>{if(typeof USDA!=='undefined')USDA.showSearch(result=>{nameInp.value=result.name;calInp.value=result.cal;protInp.value=result.protein;carbInp.value=result.carbs;fatInp.value=result.fat;});});usdaBtn.ontouchstart=(e)=>{e.stopPropagation();};
    scanRow.appendChild(usdaBtn);
    scanBtn.addEventListener('click', () => {
      window._barcodeCb = (result) => {
        // Si le résultat est un code-barres brut (barcode), appeler Open Food Facts
        if (result._rawBarcode && typeof OpenFoodFacts !== 'undefined') {
          OpenFoodFacts.scanAndFill(result._rawBarcode, (product) => {
            nameInp.value   = product.name    || '';
            calInp.value    = product.cal     || '';
            protInp.value   = product.protein || '';
            carbInp.value   = product.carbs   || '';
            fatInp.value    = product.fat     || '';
          });
        } else {
          nameInp.value   = result.name;
          calInp.value    = result.cal;
          protInp.value   = result.protein;
          carbInp.value   = result.carbs;
          fatInp.value    = result.fat;
        }
      };
      openBarcodeScanner(window._barcodeCb);
    });
    scanRow.appendChild(scanBtn);
    form.appendChild(scanRow);

    const nameInp = document.createElement('input'); nameInp.type='text'; nameInp.placeholder='Aliment (ex: Riz cuit, Poulet grillé...)'; nameInp.setAttribute('aria-label',"Nom de l'aliment");
    const macroRow2 = document.createElement('div'); macroRow2.className = 'macro-row';
    const calInp  = document.createElement('input'); calInp.type='number'; calInp.placeholder='kcal'; calInp.min=0; calInp.max=5000; calInp.step=1; calInp.setAttribute('aria-label','Calories');
    const protInp = document.createElement('input'); protInp.type='number'; protInp.placeholder='Prot. g'; protInp.min=0; protInp.step=0.1; protInp.setAttribute('aria-label','Protéines');
    const carbInp = document.createElement('input'); carbInp.type='number'; carbInp.placeholder='Gluc. g'; carbInp.min=0; carbInp.step=0.1; carbInp.setAttribute('aria-label','Glucides');
    const fatInp  = document.createElement('input'); fatInp.type='number'; fatInp.placeholder='Lip. g'; fatInp.min=0; fatInp.step=0.1; fatInp.setAttribute('aria-label','Lipides');
    macroRow2.appendChild(calInp); macroRow2.appendChild(protInp); macroRow2.appendChild(carbInp); macroRow2.appendChild(fatInp);

    const btnRow = document.createElement('div'); btnRow.className = 'add-food-btn-row';
    const addBtn2 = document.createElement('button'); addBtn2.className = 'btn btn-teal'; addBtn2.textContent = 'Ajouter'; addBtn2.style.flex='1';
    const cancelBtn2 = document.createElement('button'); cancelBtn2.className = 'btn btn-ghost'; cancelBtn2.textContent = 'Annuler'; cancelBtn2.style.flex='1';

    addBtn2.addEventListener('click', () => {
      const name = nameInp.value.trim();
      const cal  = parseFloat(calInp.value) || 0;
      if (!name || !cal) { showToast('Renseignez au minimum le nom et les calories.', 'warn'); return; }
      if (!meal.items) meal.items = [];
      meal.items.push({
        name,
        cal:  Math.round(cal),
        protein: parseFloat(protInp.value) || 0,
        carbs:   parseFloat(carbInp.value) || 0,
        fat:     parseFloat(fatInp.value)  || 0,
      });
      save(); renderCalTracker();
    });
    // Enter to add
    [nameInp, calInp, protInp, carbInp, fatInp].forEach(inp => {
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addBtn2.click(); } });
    });
    cancelBtn2.addEventListener('click', () => { form.style.display = 'none'; });

    btnRow.appendChild(cancelBtn2); btnRow.appendChild(addBtn2);
    form.appendChild(nameInp); form.appendChild(macroRow2); form.appendChild(btnRow);
    mBody.appendChild(form);

    addItemBtn.addEventListener('click', e => {
      e.stopPropagation();
      form.style.display = form.style.display === 'none' ? 'flex' : 'none';
      form.style.flexDirection = 'column';
      if (form.style.display !== 'none') setTimeout(() => nameInp.focus(), 50);
    });

    card.appendChild(mHdr); card.appendChild(mBody);
    mealsWrap.appendChild(card);
  });

  content.appendChild(mealsWrap);
}

// Nav buttons for calorie day selector
document.getElementById('cal-day-prev').addEventListener('click', () => { _calDayOffset--; renderCalTracker(); });
document.getElementById('cal-day-next').addEventListener('click', () => { if (_calDayOffset < 0) { _calDayOffset++; renderCalTracker(); } });


function renderStepsChart(container) {
  if (!container) return;
  const today = new Date();
  const data = Array.from({length:7}, (_,i) => {
    const d = new Date(today); d.setDate(d.getDate() - (6-i));
    const ds = localDateStr(d);
    return {
      label: DAYS_SH[(d.getDay()+6)%7],
      value: parseInt((S.steps&&S.steps[ds])||0),
      color: parseInt((S.steps&&S.steps[ds])||0) >= (S.stepsGoal||10000) ? 'var(--green)' : 'var(--teal)',
    };
  });
  ChartEngine.bar(container, data, {height: 90});
}

function renderCalChart(container) {
  if (!container) return;
  const today = new Date();
  const data = Array.from({length:7}, (_,i) => {
    const d = new Date(today); d.setDate(d.getDate() - (6-i));
    const ds = localDateStr(d);
    const total = (S.calories&&S.calories[ds]) ?
      (S.calories[ds].meals||[]).flatMap(m=>m.items||[]).reduce((a,it)=>a+(it.cal||0),0) : 0;
    return {
      label: DAYS_SH[(d.getDay()+6)%7],
      value: Math.round(total),
      color: total > (S.caloriesGoal||2500) ? 'var(--red)' : total > 0 ? 'var(--orange)' : 'var(--border)',
    };
  });
  ChartEngine.bar(container, data, {height: 90});
}

function renderSleepChart(container) {
  if (!container) return;
  const today = new Date();
  const data = Array.from({length:7}, (_,i) => {
    const d = new Date(today); d.setDate(d.getDate() - (6-i));
    const ds = localDateStr(d);
    const h = parseFloat((S.sleep&&S.sleep[ds]&&S.sleep[ds].hours)||0);
    return {label: DAYS_SH[(d.getDay()+6)%7], value: h, color: h>=7?'var(--green)':h>=6?'var(--orange)':h>0?'var(--red)':'var(--border)'};
  });
  ChartEngine.bar(container, data, {height: 90});
}

function renderCorps(){
  const profilInp=document.getElementById('profil-taille');if(profilInp){profilInp.value=S.profilTaille||'';profilInp.addEventListener('input',e=>{S.profilTaille=parseInt(e.target.value)||0;save();renderCorps();});}
  // Profil poignet + sexe + age
  const poignetInp=document.getElementById('profil-poignet');if(poignetInp){poignetInp.value=S.profilPoignet||17;poignetInp.addEventListener('input',e=>{S.profilPoignet=parseFloat(e.target.value)||17;save();renderCorps();});}
  const sexeSelC=document.getElementById('profil-sexe');if(sexeSelC){sexeSelC.value=S.profilSexe||'H';sexeSelC.addEventListener('change',e=>{S.profilSexe=e.target.value;save();renderCorps();});}
  const ageInp=document.getElementById('profil-age');if(ageInp){ageInp.value=S.profilAge||30;ageInp.addEventListener('input',e=>{S.profilAge=parseInt(e.target.value)||30;save();});}
  // ── % MG et Ratio taille/hanches ──
  const bfWhrDiv = document.getElementById('corps-bf-whr');
  if (bfWhrDiv) {
    bfWhrDiv.innerHTML = '';
    const bf = typeof calcBodyFat === 'function' ? calcBodyFat() : null;
    const whr = typeof calcWHR === 'function' ? calcWHR() : null;

    if (bf !== null) {
      const cat = typeof bodyFatCategory === 'function' ? bodyFatCategory(bf, S.profilSexe||'H') : null;
      const chip = document.createElement('div');
      chip.style.cssText = 'padding:5px 10px;border-radius:10px;background:var(--card);border:1px solid var(--border);font-size:11px;font-weight:600';
      chip.innerHTML = '<span style="color:var(--muted)">% Masse grasse : </span><strong style="color:'+(cat?cat.color:'var(--text)')+'">'+bf+'%</strong>'+(cat?' <span style="font-size:9px;color:'+cat.color+'">'+cat.label+'</span>':'');
      bfWhrDiv.appendChild(chip);
    } else {
      const hint = document.createElement('div');
      hint.style.cssText = 'font-size:9px;color:var(--muted);font-style:italic';
      hint.textContent = 'Renseignez cou + tour de taille + taille profil pour le % masse grasse';
      bfWhrDiv.appendChild(hint);
    }

    if (whr) {
      const sex = S.profilSexe || 'H';
      const riskOk = (sex==='H' && whr.risk < 0.90) || (sex==='F' && whr.risk < 0.85);
      const chip2 = document.createElement('div');
      chip2.style.cssText = 'padding:5px 10px;border-radius:10px;background:var(--card);border:1px solid var(--border);font-size:11px;font-weight:600';
      chip2.innerHTML = '<span style="color:var(--muted)">Ratio T/H : </span><strong style="color:'+(riskOk?'var(--green)':'var(--red)')+'">'+whr.ratio+'</strong><span style="font-size:9px;color:'+(riskOk?'var(--green)':'var(--red)')+'"> '+(riskOk?'Sain':'Risque')+'</span>';
      bfWhrDiv.appendChild(chip2);
    }
  }

  // Steps & Calories
  renderStepsGrid();
  renderCalTracker();
  // Sleep grid
  renderSleepGrid();// Nutrition grid
  renderNutriGrid();// Mesures
  const grid=document.getElementById('corps-grid');grid.innerHTML='';
  // Group paired measurements (G/D) together
  const renderedPairs = new Set();
  MESURES_DEF.forEach(({key,label,unit,icon,pair,hidden})=>{
    // Skip hidden entries (they're rendered as part of their pair)
    if (hidden && renderedPairs.has(pair)) return;
    const entries=(S.mesures[key]||[]).slice().sort((a,b)=>a.date.localeCompare(b.date));
    const card=document.createElement('div');card.className='corps-card';

    // ── Header avec valeur actuelle ──
    const hdr=document.createElement('div');hdr.style.cssText='padding:8px 12px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);background:var(--bg)';
    const ht=document.createElement('div');ht.style.cssText='font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--teal-d)';ht.textContent=icon+' '+label;
    const latest=entries.length?entries[entries.length-1]:null;
    const currentVal = latest ? (parseFloat(latest.val||latest.value)||0) : 0;
    if(latest){const lv=document.createElement('div');lv.style.cssText='font-size:11px;font-weight:700;font-family:var(--mono);color:var(--teal-d)';lv.textContent=(latest.val||latest.value)+' '+unit;hdr.appendChild(ht);hdr.appendChild(lv);}else hdr.appendChild(ht);
    card.appendChild(hdr);

    // ── Objectif suggéré + barre progression ──
    if(currentVal>0 && typeof calcMesureObjectif==='function'){
      const objDef = calcMesureObjectif(key);
      const customObj = S.mesureObjectifs[key];
      const target = customObj || (objDef ? objDef.athlétique : null);

      if(objDef){
        const objSection = document.createElement('div');
        objSection.style.cssText='padding:8px 12px;border-bottom:1px solid var(--border);background:var(--surface)';

        // Ligne : Actuel → Objectif
        const objRow = document.createElement('div');
        objRow.style.cssText='display:flex;align-items:center;justify-content:space-between;margin-bottom:5px';
        const objLeft = document.createElement('div');
        objLeft.style.cssText='font-size:10px;color:var(--muted)';
        objLeft.textContent='Actuel : '+currentVal+unit;
        const objRight = document.createElement('div');
        objRight.style.cssText='display:flex;align-items:center;gap:6px';
        const objLbl = document.createElement('span');
        objLbl.style.cssText='font-size:10px;color:var(--muted)';
        objLbl.textContent='Objectif :';

        // Input objectif personnalisé
        const objInp = document.createElement('input');
        objInp.type='text';objInp.inputMode='decimal';
        objInp.value=customObj||target||'';
        objInp.placeholder=target||'?';
        objInp.style.cssText='width:60px;border:1px solid var(--border);border-radius:6px;padding:2px 6px;font-size:12px;font-weight:700;font-family:var(--mono);background:var(--bg);color:var(--text);text-align:center;-webkit-appearance:none';
        objInp.addEventListener('change',e=>{
          const v=parseFloat(e.target.value)||null;
          if(!S.mesureObjectifs)S.mesureObjectifs={};
          S.mesureObjectifs[key]=v;
          save();renderCorps();
        });
        const objUnit=document.createElement('span');objUnit.style.cssText='font-size:10px;color:var(--muted)';objUnit.textContent=unit;
        objRight.appendChild(objLbl);objRight.appendChild(objInp);objRight.appendChild(objUnit);
        objRow.appendChild(objLeft);objRow.appendChild(objRight);

        // Barre de progression
        if(target){
          const dir = objDef.direction||'up';
          let pct;
          if(dir==='down'){
            // Plus bas = mieux (taille, hanches si trop grand)
            const startRef = Math.max(currentVal*1.2, target*1.2);
            pct = Math.min(100, Math.max(0, (startRef-currentVal)/(startRef-target)*100));
          } else if(dir==='up'){
            pct = Math.min(100, Math.max(0, currentVal/target*100));
          } else {
            // both — neutral for weight, complex
            pct = Math.min(100, Math.max(0, Math.min(currentVal,target)/Math.max(currentVal,target)*100));
          }
          const delta = Math.round((currentVal - target) * 10) / 10;
          const reached = Math.abs(delta) < 0.5;
          const color = reached ? 'var(--green)' : (pct >= 80 ? 'var(--teal)' : pct >= 50 ? 'var(--orange)' : 'var(--red)');

          const barWrap=document.createElement('div');barWrap.style.cssText='height:5px;background:var(--border);border-radius:3px;overflow:hidden;margin:4px 0';
          const barFill=document.createElement('div');barFill.style.cssText=`height:100%;width:${pct}%;background:${color};border-radius:3px;transition:width .6s`;
          barWrap.appendChild(barFill);

          const barInfo=document.createElement('div');barInfo.style.cssText='display:flex;justify-content:space-between;font-size:9px;color:var(--muted)';
          const pctLbl=document.createElement('span');pctLbl.textContent=Math.round(pct)+'% vers objectif';
          const deltaLbl=document.createElement('span');
          deltaLbl.style.color=reached?'var(--green)':color;
          deltaLbl.textContent=reached?'Objectif atteint !':(delta>0?'+':'')+delta+unit+' de difference';

          barInfo.appendChild(pctLbl);barInfo.appendChild(deltaLbl);

          // Suggestions santé vs athlétique
          const suggestions=document.createElement('div');
          suggestions.style.cssText='display:flex;gap:4px;margin-top:4px;flex-wrap:wrap';
          if(objDef.santé&&objDef.santé!==objDef.athlétique){
            const s1=document.createElement('span');
            s1.style.cssText='font-size:9px;padding:1px 6px;border-radius:5px;background:rgba(56,161,105,.1);color:var(--green);cursor:pointer;border:1px solid rgba(56,161,105,.2)';
            s1.textContent='Sante: '+objDef.santé+unit;
            s1.title='Cliquer pour definir comme objectif';
            s1.ontouchstart=(e)=>{e.preventDefault();if(!S.mesureObjectifs)S.mesureObjectifs={};S.mesureObjectifs[key]=objDef.santé;save();renderCorps();};
            s1.onclick=()=>{if(!S.mesureObjectifs)S.mesureObjectifs={};S.mesureObjectifs[key]=objDef.santé;save();renderCorps();};
            suggestions.appendChild(s1);
          }
          const s2=document.createElement('span');
          s2.style.cssText='font-size:9px;padding:1px 6px;border-radius:5px;background:rgba(91,168,160,.1);color:var(--teal-d);cursor:pointer;border:1px solid rgba(91,168,160,.2)';
          s2.textContent='Athletique: '+objDef.athlétique+unit;
          s2.title='Cliquer pour definir comme objectif';
          s2.ontouchstart=(e)=>{e.preventDefault();if(!S.mesureObjectifs)S.mesureObjectifs={};S.mesureObjectifs[key]=objDef.athlétique;save();renderCorps();};
          s2.onclick=()=>{if(!S.mesureObjectifs)S.mesureObjectifs={};S.mesureObjectifs[key]=objDef.athlétique;save();renderCorps();};
          suggestions.appendChild(s2);

          objSection.appendChild(objRow);objSection.appendChild(barWrap);objSection.appendChild(barInfo);objSection.appendChild(suggestions);

          // Estimation date
          if(typeof estimateDateObjectif==='function'){
            const est=estimateDateObjectif(key,target);
            if(est&&!reached){
              const estEl=document.createElement('div');
              estEl.style.cssText='font-size:9px;color:var(--muted);margin-top:4px';
              if(est.message){
                estEl.textContent='⚠ '+est.message;
              } else {
                estEl.textContent='Estimation : atteint en '+est.months+' mois ('+est.date+') au rythme de '+(est.rate>0?'+':'')+est.rate+unit+'/mois';
              }
              objSection.appendChild(estEl);
            }
          }
        } else {
          objSection.appendChild(objRow);
        }
        card.appendChild(objSection);
      }
    }
    const body=document.createElement('div');body.style.padding='10px 12px';
    if(key==='poids'&&entries.length){const last=entries[entries.length-1];const prev=entries.length>1?entries[entries.length-2]:null;const diff=prev?Math.round((parseFloat(last.val)-parseFloat(prev.val))*10)/10:0;const big=document.createElement('div');big.className='poids-big';big.textContent=last.val;const sub=document.createElement('div');sub.style.cssText='font-size:10px;color:var(--muted);margin-top:2px';sub.textContent=unit+(prev?` · ${diff>0?'+':''}${diff} depuis dernière entrée`:'');body.appendChild(big);body.appendChild(sub);}
    entries.slice(-5).reverse().forEach((e,idx,arr)=>{const me=document.createElement('div');me.className='mesure-entry';const dt=document.createElement('div');dt.className='mesure-date';dt.textContent=new Date(e.date+'T00:00').toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'2-digit'});const vl=document.createElement('div');vl.className='mesure-val';vl.textContent=e.value||e.value||'';const un=document.createElement('div');un.className='mesure-unit';un.textContent=unit;const dl=document.createElement('div');dl.className='mesure-delta';const nxt=arr[idx-1];if(nxt){const diff=Math.round((parseFloat(e.value)-parseFloat(nxt.val))*10)/10;dl.textContent=(diff>0?'+':'')+diff;dl.style.color=diff>0?(key==='bras'||key==='poitrine'?'var(--green)':'var(--red)'):(key==='taille'||key==='hanches'?'var(--green)':'var(--red)');}const delBtn=document.createElement('button');delBtn.className='mesure-del';delBtn.textContent='×';delBtn.addEventListener('click',()=>{S.mesures[key].splice(S.mesures[key].indexOf(e),1);save();renderCorps();});me.appendChild(dt);me.appendChild(vl);me.appendChild(un);me.appendChild(dl);me.appendChild(delBtn);body.appendChild(me);});
    // Canvas chart
    if(entries.length>1){const canvas=document.createElement('canvas');canvas.className='corps-canvas';canvas.height=65;body.appendChild(canvas);setTimeout(()=>{const W=canvas.offsetWidth||230;canvas.width=W;const ctx=canvas.getContext('2d');const vals=entries.map(e=>parseFloat(e.value)||0);const minV=Math.min(...vals),maxV=Math.max(...vals);const pad=6,cH=58;ctx.clearRect(0,0,W,65);ctx.strokeStyle='var(--teal)';ctx.lineWidth=2;ctx.lineJoin='round';ctx.beginPath();const step=(W-pad*2)/(vals.length-1||1);vals.forEach((v,i)=>{const x=pad+i*step;const y=maxV===minV?cH/2:pad+(1-(v-minV)/(maxV-minV))*(cH-pad*2);i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);});ctx.stroke();vals.forEach((v,i)=>{const x=pad+i*step;const y=maxV===minV?cH/2:pad+(1-(v-minV)/(maxV-minV))*(cH-pad*2);ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.fillStyle='var(--teal)';ctx.fill();ctx.fillStyle='var(--muted)';ctx.font='8px DM Mono,monospace';ctx.textAlign='center';ctx.fillText(v,x,63);});},100);}
    const form=document.createElement('div');
    form.style.cssText='display:flex;align-items:center;gap:6px;margin-top:8px;flex-wrap:wrap';
    const dateInp=document.createElement('input');
    dateInp.type='date';dateInp.className='mesure-inp';
    dateInp.style.cssText='flex:1;min-width:120px;max-width:140px;font-size:14px;padding:8px 10px';
    dateInp.value=todayStr();
    const valInp=document.createElement('input');
    valInp.type='number';valInp.className='mesure-inp';
    valInp.placeholder=unit;valInp.step='0.1';
    valInp.style.cssText='width:80px;font-size:16px;padding:8px 10px;text-align:center';
    valInp.setAttribute('inputmode','decimal');
    const addBtn=document.createElement('button');
    addBtn.className='btn btn-teal';
    addBtn.style.cssText='flex:1;min-height:40px;font-size:13px;font-weight:700';
    addBtn.textContent='+ Ajouter';
    valInp.addEventListener('keydown',e=>{if(e.key==='Enter')addBtn.click();});
    addBtn.addEventListener('click',()=>{if(!valInp.value)return;if(!S.mesures[key])S.mesures[key]=[];Store.dispatch({type:'BODY_ADD_MESURE',payload:{key:key,entry:{value:parseFloat(valInp.value),date:todayStr()}}});S.mesures[key].sort((a,b)=>a.date.localeCompare(b.date));valInp.value='';save();renderCorps();});
    form.appendChild(dateInp);form.appendChild(valInp);form.appendChild(addBtn);body.appendChild(form);

    // ── Asymétrie G/D ──
    if (pair) {
      renderedPairs.add(key);
      const pairDef = MESURES_DEF.find(m => m.key === pair);
      if (pairDef) {
        // Input pour le membre gauche
        const pairSection = document.createElement('div');
        pairSection.style.cssText = 'border-top:1px dashed var(--border);margin-top:8px;padding-top:8px';
        const pairTitle = document.createElement('div');
        pairTitle.style.cssText = 'font-size:10px;font-weight:700;color:var(--muted);margin-bottom:6px;text-transform:uppercase';
        pairTitle.textContent = '↕ Comparaison G/D';

        // Valeurs actuelles
        const rightVal = parseFloat(currentVal) || 0;
        const pairEntries = (S.mesures[pair] || []).slice().sort((a,b)=>a.date.localeCompare(b.date));
        const pairLatest = pairEntries.length ? pairEntries[pairEntries.length-1] : null;
        const leftVal = pairLatest ? (parseFloat(pairLatest.val || pairLatest.value) || 0) : 0;

        // Asymmetry display
        if (rightVal > 0 && leftVal > 0) {
          const diff = Math.abs(rightVal - leftVal);
          const asymRow = document.createElement('div');
          asymRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:8px;padding:6px 10px;border-radius:8px;background:'+(diff>1?'rgba(229,62,62,.08)':'rgba(56,161,105,.08)');
          const asymIcon = document.createElement('span');
          asymIcon.textContent = diff > 1 ? '⚠️' : '✅';
          const asymText = document.createElement('div');
          asymText.style.cssText = 'font-size:11px;flex:1';
          asymText.innerHTML = '<strong>D:</strong> '+rightVal+'cm &nbsp; <strong>G:</strong> '+leftVal+'cm';
          const asymDiff = document.createElement('span');
          asymDiff.style.cssText = 'font-size:11px;font-weight:700;color:'+(diff>1?'var(--red)':'var(--green)');
          asymDiff.textContent = diff > 1 ? 'Écart '+diff.toFixed(1)+'cm' : 'Symétrique';
          asymRow.appendChild(asymIcon); asymRow.appendChild(asymText); asymRow.appendChild(asymDiff);
          pairSection.appendChild(pairTitle); pairSection.appendChild(asymRow);
        } else {
          pairSection.appendChild(pairTitle);
        }

        // Form to add LEFT side measurement
        const pairForm = document.createElement('div');
        pairForm.style.cssText = 'display:flex;align-items:center;gap:6px';
        const pairLbl = document.createElement('label');
        pairLbl.style.cssText = 'font-size:11px;font-weight:700;color:var(--muted);width:70px';
        pairLbl.textContent = 'Gauche :';
        if (pairLatest) {
          const curG = document.createElement('span');
          curG.style.cssText = 'font-size:12px;font-weight:700;font-family:var(--mono);color:var(--teal-d);width:50px';
          curG.textContent = (pairLatest.val||pairLatest.value)+unit;
          pairForm.appendChild(pairLbl); pairForm.appendChild(curG);
        }
        const pairValInp = document.createElement('input');
        pairValInp.type='number'; pairValInp.className='mesure-inp';
        pairValInp.placeholder=unit; pairValInp.step='0.1';
        pairValInp.style.cssText='width:70px;font-size:16px;padding:6px 8px;text-align:center';
        pairValInp.setAttribute('inputmode','decimal');
        const pairAddBtn = document.createElement('button');
        pairAddBtn.className='btn btn-ghost btn-sm'; pairAddBtn.textContent='+ G';
        pairValInp.addEventListener('keydown', e=>{if(e.key==='Enter')pairAddBtn.click();});
        pairAddBtn.addEventListener('click', ()=>{
          if(!pairValInp.value)return;
          if(!S.mesures[pair])S.mesures[pair]=[];
          Store.dispatch({type:'BODY_ADD_MESURE',payload:{key:pair,entry:{value:parseFloat(pairValInp.value),val:parseFloat(pairValInp.value),date:todayStr()}}});
          S.mesures[pair].sort((a,b)=>a.date.localeCompare(b.date));
          pairValInp.value=''; save(); renderCorps();
        });
        if(!pairLatest) pairForm.appendChild(pairLbl);
        pairForm.appendChild(pairValInp); pairForm.appendChild(pairAddBtn);
        pairSection.appendChild(pairForm);
        body.appendChild(pairSection);
      }
    }

    card.appendChild(body);grid.appendChild(card);
  });
  renderStreakHeatmap();
  renderPainList();

  // ── Corps Charts ──
  setTimeout(()=>{
    // Weight evolution chart
    const weightSection = document.getElementById('corps-charts-weight');
    if(weightSection){
      const weightEntries=(S.mesures.poids||[]).slice().sort((a,b)=>a.date.localeCompare(b.date));
      if(weightEntries.length>1){
        const {wrap:ww,canvas:wc}=mkChartWrap('corps-weight-chart','⚖️ Évolution du poids','kg');
        weightSection.innerHTML='';weightSection.appendChild(ww);
        const targetW=parseFloat(S.objective&&S.objective.targetWeight)||null;
        Charts.lineChart(wc,[{label:'Poids',values:weightEntries.map(e=>({x:e.date,y:parseFloat(e.value)||0})),color:'--teal'}],{height:150,goal:targetW||undefined,yFmt:v=>v.toFixed(1)+'kg'});
      }
    }
    // Steps last 30 days
    const stepsSection = document.getElementById('corps-charts-steps');
    if(stepsSection){
      const stepsData=computeDailySteps(30);
      if(stepsData.some(p=>p.y>0)){
        const {wrap:sw,canvas:sc}=mkChartWrap('corps-steps-chart','👣 Pas — 30 jours','quotidien');
        stepsSection.innerHTML='';stepsSection.appendChild(sw);
        Charts.barChart(sc,stepsData.map(p=>({label:p.x.slice(5),value:p.y,color:p.y>=(S.stepsGoal||10000)?'--green':'--teal'})),{height:130,goal:S.stepsGoal||10000,yFmt:v=>v>=1000?Math.round(v/1000)+'k':Math.round(v)});
      }
    }
    // Calories last 30 days
    const calSection = document.getElementById('corps-charts-cal');
    if(calSection){
      const calData=computeDailyCalories(30);
      if(calData.some(p=>p.y>0)){
        const {wrap:cw,canvas:cc}=mkChartWrap('corps-cal-chart','🔥 Calories — 30 jours','kcal/j');
        calSection.innerHTML='';calSection.appendChild(cw);
        Charts.lineChart(cc,[{label:'Calories',values:calData,color:'--orange'}],{height:130,goal:S.caloriesGoal||2500,fill:true});
        const td=computeTDEE();
        const tdeeInfo=document.createElement('div');
        tdeeInfo.style.cssText='font-size:11px;color:var(--muted);margin-top:6px;padding:0 4px';
        tdeeInfo.innerHTML=`TDEE estimé: <strong>${td.tdee} kcal</strong> (BMR ${td.bmr} × ${td.mult} — ${td.sessions} séances/sem.)`;
        cw.appendChild(tdeeInfo);
      }
    }
    // Sleep last 30 days
    const sleepSection = document.getElementById('corps-charts-sleep');
    if(sleepSection){
      const sleepData=computeDailySleep(30);
      if(sleepData.some(p=>p.y>0)){
        const {wrap:slw,canvas:slc}=mkChartWrap('corps-sleep-chart','😴 Sommeil — 30 jours','heures/nuit');
        sleepSection.innerHTML='';sleepSection.appendChild(slw);
        Charts.lineChart(slc,[{label:'Sommeil',values:sleepData,color:'--purple'}],{height:130,goal:7.5,fill:true,yMin:0,yMax:12,yFmt:v=>v.toFixed(1)+'h'});
      } else {
        sleepSection.innerHTML=`<div class="chart-no-data" style="padding:12px;font-size:11px;color:var(--muted);text-align:center">😴 Renseignez vos heures de sommeil pour voir l'évolution</div>`;
      }
    }
    // Show placeholder for weight if no data
    const weightSection2=document.getElementById('corps-charts-weight');
    if(weightSection2&&!weightSection2.children.length){
      weightSection2.innerHTML=`<div class="chart-no-data" style="padding:12px;font-size:11px;color:var(--muted);text-align:center">⚖️ Ajoutez votre poids dans Mesures pour voir l'évolution</div>`;
    }
  }, 80);

}
function renderSleepGrid(){
  const grid=document.getElementById('sleep-grid');if(!grid)return;grid.innerHTML='';
  // Sleep chart
  const sleepChartC = document.getElementById('sleep-chart-container');
  if (sleepChartC) setTimeout(() => renderSleepChart(sleepChartC), 50);
  for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);const ds=localDateStr(d);const dayData=S.sleep[ds]||{hours:'',quality:0};
    const card=document.createElement('div');card.className='sleep-day-card';
    const lbl=document.createElement('div');lbl.className='sleep-day-lbl';lbl.textContent=DAYS_SH[(d.getDay()+6)%7];
    const inp=document.createElement('input');inp.type='number';inp.className='sleep-inp';inp.value=dayData.hours||'';inp.placeholder='h';inp.min=0;inp.max=12;inp.step=0.5;
    inp.addEventListener('change',e=>{if(!S.sleep[ds])S.sleep[ds]={hours:'',quality:0};S.sleep[ds].hours=e.target.value;save();});
    const qualRow=document.createElement('div');qualRow.className='sleep-qual-row';
    ['😴','😐','🔥'].forEach((emoji,qi)=>{const btn=document.createElement('button');btn.className='sleep-qual-btn'+(dayData.quality===qi+1?' sel':'');btn.textContent=emoji;btn.addEventListener('click',()=>{if(!S.sleep[ds])S.sleep[ds]={hours:'',quality:0};Store.dispatch({type:'ACTIVITY_SET_SLEEP',payload:{date:ds,value:{hours:(S.sleep[ds]||{}).hours||0,quality:qi+1}}});qualRow.querySelectorAll('.sleep-qual-btn').forEach((b,bi)=>b.classList.toggle('sel',bi===qi));});qualRow.appendChild(btn);});
    const dateDisp=document.createElement('div');dateDisp.style.cssText='font-size:8px;color:var(--muted);font-family:var(--mono)';dateDisp.textContent=d.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'});
    card.appendChild(lbl);card.appendChild(dateDisp);card.appendChild(inp);card.appendChild(qualRow);grid.appendChild(card);
  }
}
function renderNutriGrid(){
  const grid=document.getElementById('nutri-grid');if(!grid)return;grid.innerHTML='';
  for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);const ds=localDateStr(d);const val=S.nutrition[ds]||'';
    const row=document.createElement('div');row.className='nutri-row';
    const lbl=document.createElement('div');lbl.className='nutri-day';lbl.textContent=DAYS_SH[(d.getDay()+6)%7];
    ['deficit','maint','surplus'].forEach(n=>{const btn=document.createElement('button');btn.className='nutri-btn'+(val===n?' sel-'+n:'');btn.textContent=n==='deficit'?'Déficit':n==='maint'?'Maint.':'Surplus';btn.addEventListener('click',()=>{S.nutrition[ds]=val===n?'':n;save();renderNutriGrid();});row.appendChild(btn);});
    row.insertBefore(lbl,row.firstChild);grid.appendChild(row);
  }
}
function renderStreakHeatmap(){
  const hm=document.getElementById('streak-heatmap');if(!hm)return;hm.innerHTML='';
  const today=new Date();
  const DAYS=['L','M','M','J','V','S','D'];
  
  // Build a 13-week grid (91 days) — like GitHub graph
  const wrapper=document.createElement('div');
  wrapper.style.cssText='overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:4px';
  
  const grid=document.createElement('div');
  grid.style.cssText='display:grid;grid-template-rows:repeat(7,10px);grid-auto-flow:column;gap:2px;width:max-content';
  
  // Day labels on left
  const labelCol=document.createElement('div');
  labelCol.style.cssText='display:grid;grid-template-rows:repeat(7,10px);gap:2px;margin-right:4px;font-size:8px;color:var(--muted);text-align:right;flex-shrink:0';
  DAYS.forEach(d=>{const l=document.createElement('div');l.style.cssText='line-height:10px';l.textContent=d;labelCol.appendChild(l);});
  
  // Fill 91 days (13 weeks)
  const startOffset=91-1;
  for(let i=startOffset;i>=0;i--){
    const d=new Date(today);d.setDate(d.getDate()-i);
    const ds=localDateStr(d);
    const dot=document.createElement('div');
    dot.style.cssText='width:10px;height:10px;border-radius:2px;cursor:default';
    dot.title=ds;
    const matchDay=S.days.find(d2=>d2.date===ds);
    const histDay=Object.values(S.history).flatMap(wk=>(wk.days||[])).find(d2=>d2.date===ds);
    const aDay=matchDay||histDay;
    const trained=aDay&&(aDay.exercises||[]).some(e=>e.done&&!e.isWarmup);
    const isRest=aDay&&getDMS(aDay).includes('rep');
    if(trained) dot.style.background='var(--teal)';
    else if(isRest) dot.style.background='#d4e8f8';
    else dot.style.background='var(--border)';
    grid.appendChild(dot);
  }
  
  const row=document.createElement('div');
  row.style.cssText='display:flex;align-items:flex-start';
  row.appendChild(labelCol);
  row.appendChild(wrapper);
  wrapper.appendChild(grid);
  hm.appendChild(row);
}
function renderPainList(){
  const pl=document.getElementById('pain-list');if(!pl)return;pl.innerHTML='';
  if(!S.painLog.length){pl.innerHTML='<div style="font-size:10px;color:var(--muted)">Aucune douleur signalée.</div>';return;}
  S.painLog.slice(-10).reverse().forEach((p,i)=>{
    const row=document.createElement('div');row.className='pain-entry';
    const level=PAIN_LEVELS.find(l=>l.val===p.level)||PAIN_LEVELS[0];
    // Safe DOM construction — no innerHTML with user data
    const ico2=document.createElement('span');ico2.textContent=level.emoji;
    const part=document.createElement('span');part.style.cssText='flex:1;font-weight:600';part.textContent=p.part;
    const dt2=document.createElement('span');dt2.style.cssText='color:var(--muted);font-size:9px;font-family:var(--mono)';dt2.textContent=p.date;
    const note2=document.createElement('span');note2.style.cssText='font-size:10px;color:var(--muted);margin-left:6px';note2.textContent=p.note||'';
    row.appendChild(ico2);row.appendChild(part);row.appendChild(dt2);row.appendChild(note2);
    const del=document.createElement('button');del.className='mesure-del';del.textContent='×';del.addEventListener('click',()=>{S.painLog.splice(S.painLog.length-1-i,1);save();renderPainList();});row.appendChild(del);pl.appendChild(row);
  });
}
document.getElementById('add-pain-btn').addEventListener('click',async()=>{
  const _painForm=await Modal.form('Ajouter une douleur',[
    {key:'part',label:'Zone',type:'select',options:BODY_PARTS,value:1},
    {key:'level',label:'Intensité',type:'select',options:['🟡 Légère','🟠 Modérée','🔴 Forte'],value:1},
    {key:'note',label:'Note (optionnel)',type:'text',placeholder:'Ex: après développé incliné...'}
  ]);
  if(!_painForm)return;
  const idx=parseInt(_painForm.part)-1;if(idx<0||idx>=BODY_PARTS.length)return;
  const level=parseInt(_painForm.level)||1;
  const note=_painForm.note||'';
  Store.dispatch({type:'BODY_ADD_PAIN',payload:{part:BODY_PARTS[idx],level:Math.min(3,Math.max(1,level)),date:todayStr(),note}});
  save();renderPainList();showToast('Douleur enregistrée','save');
});
document.getElementById('add-photo-btn').addEventListener('click',()=>{
  const input=document.createElement('input');input.type='file';input.accept='image/*';input.onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>{S.photos.push({date:todayStr(),data:ev.target.result.slice(0,50)+'...'});save();showToast('Photo enregistrée ✓','save');};r.readAsDataURL(f);};input.click();
});
