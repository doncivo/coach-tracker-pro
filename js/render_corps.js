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


/* ================================================================
   NUTRITION — Redesign complet (style référence Yazio)
   Images 1→4 : recherche avec photos, portion modal, ring calorique
   ================================================================ */

const MEAL_ICONS_NEW = ['🌅','☀️','🌙','🍎'];

function renderCalTracker() {
  const content = document.getElementById('cal-content');
  if (!content) return;

  const dk = calDayKey(_calDayOffset);
  if (!S.calories) S.calories = {};

  // Initialiser la structure si absente
  const calState = Store.getState().activity.calories;
  if (!calState[dk]) calState[dk] = { meals:[{items:[]},{items:[]},{items:[]},{items:[]}] };
  const dayData = calState[dk];
  if (!dayData.meals) dayData.meals = [{items:[]},{items:[]},{items:[]},{items:[]}];
  while (dayData.meals.length < 4) dayData.meals.push({items:[]});

  const goal = S.caloriesGoal || 2500;
  let totalCal=0, totalP=0, totalC=0, totalF=0;
  dayData.meals.forEach(m=>(m.items||[]).forEach(item=>{
    totalCal += parseFloat(item.cal)||0;
    totalP   += parseFloat(item.protein)||0;
    totalC   += parseFloat(item.carbs)||0;
    totalF   += parseFloat(item.fat)||0;
  }));

  content.innerHTML = '';

  // ── 1. SÉLECTEUR DE JOURS (semaine) ──
  const weekNav = document.createElement('div');
  weekNav.style.cssText = 'display:flex;align-items:center;gap:0;padding:8px 0 12px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch';
  weekNav.style.cssText += ';justify-content:space-between';

  const today = new Date();
  for (let i=-3; i<=3; i++) {
    const d = new Date(today); d.setDate(today.getDate() + i - _calDayOffset);
    const isActive = i === 0;
    const dayNames = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
    const dayN = dayNames[d.getDay()];
    const dayNum = d.getDate();

    const dayBtn = document.createElement('div');
    dayBtn.style.cssText = `
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      width:40px;flex-shrink:0;padding:6px 0;border-radius:12px;cursor:pointer;touch-action:manipulation;
      ${isActive ? 'background:var(--teal);' : ''}
      transition:background .15s;
    `;

    const dName = document.createElement('div');
    dName.style.cssText = `font-size:10px;font-weight:600;color:${isActive?'rgba(255,255,255,.8)':'var(--muted)'}`;
    dName.textContent = dayN;

    const dNum = document.createElement('div');
    dNum.style.cssText = `font-size:15px;font-weight:800;color:${isActive?'#fff':'var(--text)'};margin-top:1px`;
    dNum.textContent = dayNum;

    // Point si repas enregistré
    const hasFood = (calState[calDayKey(_calDayOffset - i)]?.meals||[]).some(m=>(m.items||[]).length>0);
    if (hasFood && !isActive) {
      const dot = document.createElement('div');
      dot.style.cssText = 'width:4px;height:4px;border-radius:50%;background:var(--teal);margin-top:3px';
      dayBtn.appendChild(dName); dayBtn.appendChild(dNum); dayBtn.appendChild(dot);
    } else {
      dayBtn.appendChild(dName); dayBtn.appendChild(dNum);
    }

    const diff = i;
    const doTap = () => { _calDayOffset -= diff; renderCalTracker(); };
    dayBtn.ontouchstart=(e)=>{e.preventDefault();doTap();}; dayBtn.onclick=doTap;
    weekNav.appendChild(dayBtn);
  }
  content.appendChild(weekNav);

  // ── 2. ANNEAU CALORIQUE + MACROS ──
  const ringWrap = document.createElement('div');
  ringWrap.style.cssText = 'display:flex;align-items:center;gap:16px;padding:0 4px 16px';

  // Anneau SVG
  const RADIUS=50, STROKE=10, CIRC=2*Math.PI*RADIUS;
  const pct = Math.min(100, totalCal/goal*100);
  const offset = CIRC*(1 - pct/100);
  const ringColor = totalCal > goal ? 'var(--red)' : totalCal > goal*0.8 ? 'var(--orange)' : 'var(--teal)';

  const svgEl = document.createElementNS('http://www.w3.org/2000/svg','svg');
  svgEl.setAttribute('viewBox','0 0 120 120'); svgEl.style.cssText='width:110px;height:110px;flex-shrink:0';

  const bg = document.createElementNS('http://www.w3.org/2000/svg','circle');
  bg.setAttribute('cx','60');bg.setAttribute('cy','60');bg.setAttribute('r',RADIUS);
  bg.setAttribute('fill','none');bg.setAttribute('stroke','var(--border)');bg.setAttribute('stroke-width',STROKE);

  const prog = document.createElementNS('http://www.w3.org/2000/svg','circle');
  prog.setAttribute('cx','60');prog.setAttribute('cy','60');prog.setAttribute('r',RADIUS);
  prog.setAttribute('fill','none');prog.setAttribute('stroke',ringColor);prog.setAttribute('stroke-width',STROKE);
  prog.setAttribute('stroke-linecap','round');
  prog.setAttribute('stroke-dasharray',CIRC.toFixed(1));
  prog.setAttribute('stroke-dashoffset',offset.toFixed(1));
  prog.setAttribute('transform','rotate(-90 60 60)');

  const lbl1 = document.createElementNS('http://www.w3.org/2000/svg','text');
  lbl1.setAttribute('x','60');lbl1.setAttribute('y','52');lbl1.setAttribute('text-anchor','middle');
  lbl1.setAttribute('font-size','9');lbl1.setAttribute('fill','var(--muted)');lbl1.textContent='Apport en Calories';

  const lbl2 = document.createElementNS('http://www.w3.org/2000/svg','text');
  lbl2.setAttribute('x','60');lbl2.setAttribute('y','70');lbl2.setAttribute('text-anchor','middle');
  lbl2.setAttribute('font-size','22');lbl2.setAttribute('font-weight','800');lbl2.setAttribute('fill','var(--text)');
  lbl2.textContent = Math.round(totalCal);

  const lbl3 = document.createElementNS('http://www.w3.org/2000/svg','text');
  lbl3.setAttribute('x','60');lbl3.setAttribute('y','84');lbl3.setAttribute('text-anchor','middle');
  lbl3.setAttribute('font-size','10');lbl3.setAttribute('fill',ringColor);
  lbl3.textContent = (totalCal > goal ? '▲ ' : '▼ ') + Math.abs(Math.round(goal-totalCal)) + ' kcal';

  svgEl.append(bg,prog,lbl1,lbl2,lbl3);
  ringWrap.appendChild(svgEl);

  // Macros droite
  const macrosCol = document.createElement('div');
  macrosCol.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:10px';

  const macroGoals = { p:S.proteinGoal||0, c:S.carbsGoal||0, f:S.fatGoal||0 };
  [
    {lbl:'Glucides',  val:Math.round(totalC), goal:macroGoals.c, color:'#7b68ee'},
    {lbl:'Protéines', val:Math.round(totalP), goal:macroGoals.p, color:'#1eb8a0'},
    {lbl:'Lipides',   val:Math.round(totalF), goal:macroGoals.f, color:'#ff7b7b'},
  ].forEach(({lbl,val,goal:mg,color})=>{
    const row=document.createElement('div');
    const top=document.createElement('div');top.style.cssText='display:flex;justify-content:space-between;margin-bottom:3px';
    const ln=document.createElement('span');ln.style.cssText='font-size:12px;font-weight:600;color:var(--text)';ln.textContent=lbl;
    const lv=document.createElement('span');lv.style.cssText='font-size:12px;font-weight:700;color:var(--muted)';
    lv.textContent = mg > 0 ? val+'g / '+mg+'g' : val+'g';
    top.appendChild(ln); top.appendChild(lv);
    const bar=document.createElement('div');bar.style.cssText='height:5px;background:var(--border);border-radius:3px;overflow:hidden';
    const fill=document.createElement('div');
    const pctM = mg>0 ? Math.min(100,val/mg*100) : 0;
    fill.style.cssText=`height:100%;width:${pctM}%;background:${color};border-radius:3px;transition:width .5s`;
    bar.appendChild(fill);
    row.appendChild(top); row.appendChild(bar);
    macrosCol.appendChild(row);
  });
  ringWrap.appendChild(macrosCol);
  content.appendChild(ringWrap);

  // ── 3. SECTIONS REPAS ──
  const mealsWrap = document.createElement('div');
  mealsWrap.style.cssText = 'display:flex;flex-direction:column;gap:10px';

  dayData.meals.forEach((meal, mi) => {
    const mealCal = (meal.items||[]).reduce((a,it)=>a+(parseFloat(it.cal)||0),0);
    const hasItems = (meal.items||[]).length > 0;

    const section = document.createElement('div');
    section.style.cssText = 'background:var(--card);border-radius:16px;overflow:hidden;border:1px solid var(--border)';

    // Header repas
    const hdr = document.createElement('div');
    hdr.style.cssText = 'display:flex;align-items:center;padding:12px 14px;gap:10px';

    const mIcon = document.createElement('span'); mIcon.style.cssText='font-size:18px';mIcon.textContent=MEAL_ICONS_NEW[mi];
    const mName = document.createElement('div');
    mName.style.cssText = 'flex:1;font-size:15px;font-weight:700;color:var(--text)';
    mName.textContent = MEAL_NAMES[mi];
    const mCal = document.createElement('div');
    mCal.style.cssText = 'font-size:14px;font-weight:700;color:var(--text);margin-right:4px';
    mCal.textContent = Math.round(mealCal) > 0 ? Math.round(mealCal)+' kcal' : '';
    const arrow = document.createElement('span');
    arrow.style.cssText = 'color:var(--muted);font-size:14px';
    arrow.textContent = hasItems ? '›' : '';
    hdr.append(mIcon, mName, mCal, arrow);
    section.appendChild(hdr);

    // Items alimentaires
    if (hasItems) {
      const itemsList = document.createElement('div');
      itemsList.style.cssText = 'border-top:1px solid var(--border)';

      (meal.items||[]).forEach((item, ii) => {
        const itemRow = document.createElement('div');
        itemRow.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--border)';

        // Photo ou emoji
        const imgWrap = document.createElement('div');
        imgWrap.style.cssText = 'width:40px;height:40px;border-radius:10px;overflow:hidden;flex-shrink:0;background:var(--bg);display:flex;align-items:center;justify-content:center';
        if (item.imageUrl) {
          const img = document.createElement('img');
          img.src = item.imageUrl; img.style.cssText='width:100%;height:100%;object-fit:cover';
          img.onerror = () => { imgWrap.textContent = item.emoji || '🍽️'; imgWrap.style.fontSize='20px'; };
          imgWrap.appendChild(img);
        } else {
          imgWrap.style.fontSize='20px'; imgWrap.textContent = item.emoji || '🍽️';
        }

        const info = document.createElement('div'); info.style.cssText='flex:1;min-width:0';
        const iName = document.createElement('div');
        iName.style.cssText='font-size:13px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
        iName.textContent = item.name;
        const iSub = document.createElement('div');
        iSub.style.cssText='font-size:11px;color:var(--muted);margin-top:1px';
        iSub.textContent = (item.weight ? item.weight+'g · ' : '') + 'P:'+Math.round(item.protein||0)+'g G:'+Math.round(item.carbs||0)+'g L:'+Math.round(item.fat||0)+'g';
        info.appendChild(iName); info.appendChild(iSub);

        const iCal = document.createElement('div');
        iCal.style.cssText='font-size:13px;font-weight:700;color:var(--text);flex-shrink:0';
        iCal.textContent = Math.round(item.cal)+' kcal';

        const delBtn = document.createElement('button');
        delBtn.style.cssText='border:none;background:none;color:var(--muted);font-size:18px;cursor:pointer;touch-action:manipulation;-webkit-appearance:none;padding:4px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;flex-shrink:0';
        delBtn.textContent='ⅱ';
        delBtn.innerHTML='<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="6" width="12" height="1.5" rx=".75" fill="currentColor"/></svg>';
        const doDel=()=>{ meal.items.splice(ii,1); save(); renderCalTracker(); };
        delBtn.ontouchstart=(e)=>{e.preventDefault();doDel();}; delBtn.onclick=doDel;

        itemRow.append(imgWrap, info, iCal, delBtn);
        itemsList.appendChild(itemRow);
      });
      section.appendChild(itemsList);
    }

    // Bouton "Ajouter un aliment"
    const addBtn = document.createElement('button');
    addBtn.style.cssText = `
      width:100%;padding:13px;border:none;
      background:${hasItems?'var(--bg)':'var(--bg)'};
      color:var(--teal-d);font-size:14px;font-weight:700;
      font-family:var(--font);cursor:pointer;touch-action:manipulation;-webkit-appearance:none;
      border-top:1px solid var(--border);
      display:flex;align-items:center;justify-content:center;gap:6px;
    `;
    addBtn.innerHTML='<span style="font-size:18px;color:var(--teal)">＋</span> Ajouter un aliment';
    const doAdd=()=>_showNutritionSearch(mi, dk);
    addBtn.ontouchstart=(e)=>{e.preventDefault();doAdd();}; addBtn.onclick=doAdd;
    section.appendChild(addBtn);

    mealsWrap.appendChild(section);
  });
  content.appendChild(mealsWrap);
}

// Nav day buttons (kept)
document.getElementById('cal-day-prev').addEventListener('click', () => { _calDayOffset--; renderCalTracker(); });
document.getElementById('cal-day-next').addEventListener('click', () => { if (_calDayOffset < 0) { _calDayOffset++; renderCalTracker(); } });



/* ================================================================
   RECHERCHE ALIMENTAIRE — style image 2 (avec photos)
   ================================================================ */

function _showNutritionSearch(mealIndex, dayKey) {
  document.getElementById('nutr-search-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'nutr-search-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:var(--surface);z-index:9800;display:flex;flex-direction:column';

  // Header
  const hdr = document.createElement('div');
  hdr.style.cssText = 'padding:max(16px,env(safe-area-inset-top)) 16px 0;background:var(--surface)';

  const searchBar = document.createElement('div');
  searchBar.style.cssText = 'display:flex;align-items:center;gap:8px;background:var(--bg);border-radius:14px;padding:10px 14px;margin-bottom:12px';

  const searchIcon = document.createElement('span');
  searchIcon.textContent = '🔍'; searchIcon.style.cssText='font-size:16px;flex-shrink:0';

  const inp = document.createElement('input');
  inp.type='text'; inp.placeholder='Rechercher un aliment...';
  inp.setAttribute('autocomplete','off');
  inp.style.cssText = 'flex:1;border:none;background:transparent;font-size:16px;font-family:var(--font);color:var(--text);outline:none;-webkit-appearance:none';

  const scanBtn = document.createElement('button');
  scanBtn.style.cssText='border:none;background:none;font-size:20px;cursor:pointer;touch-action:manipulation;-webkit-appearance:none;padding:0;flex-shrink:0';
  scanBtn.textContent='⊡';

  const cancelBtn = document.createElement('button');
  cancelBtn.style.cssText='border:none;background:none;color:var(--teal-d);font-size:15px;font-weight:700;font-family:var(--font);cursor:pointer;touch-action:manipulation;-webkit-appearance:none;flex-shrink:0';
  cancelBtn.textContent='Annuler';
  const doClose=()=>overlay.remove();
  cancelBtn.ontouchstart=(e)=>{e.preventDefault();doClose();}; cancelBtn.onclick=doClose;

  searchBar.append(searchIcon, inp, cancelBtn);
  hdr.appendChild(searchBar);
  overlay.appendChild(hdr);

  // Results
  const results = document.createElement('div');
  results.style.cssText = 'flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch';

  overlay.appendChild(results);
  document.body.appendChild(overlay);
  setTimeout(()=>inp.focus(), 200);

  // Show default results (common foods)
  _renderFoodResults(results, [], mealIndex, dayKey, inp);

  let debounceTimer;
  let _controller = null;
  inp.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const q = inp.value.trim();
    debounceTimer = setTimeout(() => {
      if (_controller) _controller.abort();
      _controller = new AbortController();
      _renderFoodResults(results, [], mealIndex, dayKey, inp); // local instant
      if (q.length >= 2) _fetchOFFResults(q, results, mealIndex, dayKey, inp, _controller.signal);
    }, 300);
  });
}

// Render local + remote results
function _renderFoodResults(results, remoteItems, mealIndex, dayKey, inp) {
  results.innerHTML = '';
  const q = inp.value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');

  // Section header
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:8px 16px;border-bottom:1px solid var(--border)';
  const hlbl = document.createElement('div');
  hlbl.style.cssText='font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)';
  hlbl.textContent = q.length >= 2 ? 'Résultats de la recherche' : 'Aliments fréquents';
  const createBtn = document.createElement('button');
  createBtn.style.cssText='border:none;background:none;color:var(--teal-d);font-size:13px;font-weight:700;font-family:var(--font);cursor:pointer;touch-action:manipulation;-webkit-appearance:none;padding:4px 8px;border-radius:8px;background:rgba(91,168,160,.1)';
  createBtn.textContent='Créer';
  const doCreate=()=>{
    // Ouvrir la saisie manuelle
    results.innerHTML = '';
    overlay.remove();
    _showManualAddForm(mealIndex, dayKey, inp.value);
  };
  createBtn.ontouchstart=(e)=>{e.preventDefault();doCreate();}; createBtn.onclick=doCreate;
  header.appendChild(hlbl); header.appendChild(createBtn);
  results.appendChild(header);

  // Local foods (from FOODS_FR)
  const localFoods = typeof searchFoodsFR === 'function'
    ? (q.length >= 2 ? searchFoodsFR(inp.value.trim()) : (typeof FOODS_FR!=='undefined'?FOODS_FR:[]).slice(0,12))
    : [];

  const allFoods = [...localFoods.map(f=>({...f, isLocal:true})), ...remoteItems];

  if (!allFoods.length && q.length >= 2) {
    const empty = document.createElement('div');
    empty.style.cssText='padding:40px 16px;text-align:center;color:var(--muted);font-size:13px';
    empty.textContent='Aucun résultat pour "'+inp.value+'"';
    results.appendChild(empty);
    return;
  }

  allFoods.forEach(food => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--border);cursor:pointer;touch-action:manipulation';

    // Photo/emoji
    const imgWrap = document.createElement('div');
    imgWrap.style.cssText='width:56px;height:56px;border-radius:12px;overflow:hidden;flex-shrink:0;background:var(--bg);display:flex;align-items:center;justify-content:center;font-size:24px';

    if (food.imageUrl) {
      const img = document.createElement('img');
      img.src=food.imageUrl; img.style.cssText='width:100%;height:100%;object-fit:cover';
      img.onerror=()=>{imgWrap.removeChild(img);imgWrap.textContent=food.emoji||'🍽️';};
      imgWrap.appendChild(img);
    } else {
      imgWrap.textContent = food.emoji || _foodEmoji(food.n||food.name||'');
    }

    // Info
    const info = document.createElement('div'); info.style.cssText='flex:1;min-width:0';
    const nm = document.createElement('div');
    nm.style.cssText='font-size:14px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
    nm.textContent = food.n || food.name || '';
    const cals = document.createElement('div');
    cals.style.cssText='font-size:12px;color:var(--muted);margin-top:2px';
    cals.textContent = Math.round(food.cal||food.kcal100||0) + 'kcal / 100g';
    info.appendChild(nm); info.appendChild(cals);

    // + button
    const plusBtn = document.createElement('button');
    plusBtn.style.cssText='width:32px;height:32px;border-radius:50%;border:2px solid var(--teal);background:transparent;color:var(--teal);font-size:20px;cursor:pointer;touch-action:manipulation;-webkit-appearance:none;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-weight:300';
    plusBtn.textContent='+';

    const doSelect=()=>{
      document.getElementById('nutr-search-overlay')?.remove();
      _showPortionModal(food, mealIndex, dayKey);
    };
    row.ontouchstart=(e)=>{e.preventDefault();doSelect();}; row.onclick=doSelect;
    plusBtn.ontouchstart=(e)=>{e.preventDefault();e.stopPropagation();doSelect();};

    row.append(imgWrap, info, plusBtn);
    results.appendChild(row);
  });

  // Loading indicator if searching remotely
  if (q.length >= 2) {
    const loading = document.createElement('div');
    loading.id = 'nutr-loading';
    loading.style.cssText='padding:16px;text-align:center;color:var(--muted);font-size:12px';
    loading.textContent='Recherche en cours…';
    results.appendChild(loading);
  }
}

// Fetch OpenFoodFacts for real photos
async function _fetchOFFResults(q, results, mealIndex, dayKey, inp, signal) {
  try {
    const url = 'https://world.openfoodfacts.org/cgi/search.pl?search_terms=' +
      encodeURIComponent(q) + '&action=process&json=1&lc=fr&cc=fr&page_size=8' +
      '&fields=product_name_fr,product_name,image_small_url,nutriments';
    const resp = await fetch(url, { signal });
    if (!resp.ok) return;
    const data = await resp.json();
    const products = (data.products||[]).filter(p=>p.nutriments?.['energy-kcal_100g']>0);

    const remoteItems = products.map(p => ({
      n: p.product_name_fr || p.product_name || '',
      cal: Math.round(p.nutriments['energy-kcal_100g']||0),
      prot: Math.round(p.nutriments['proteins_100g']||0),
      carbs: Math.round(p.nutriments['carbohydrates_100g']||0),
      fat: Math.round(p.nutriments['fat_100g']||0),
      imageUrl: p.image_small_url || null,
    })).filter(f=>f.n && f.cal > 0);

    _renderFoodResults(results, remoteItems, mealIndex, dayKey, inp);
    document.getElementById('nutr-loading')?.remove();
  } catch(e) {
    if (e.name !== 'AbortError') document.getElementById('nutr-loading')?.remove();
  }
}

// Emoji par catégorie d'aliment
function _foodEmoji(name) {
  const n = name.toLowerCase();
  if (n.includes('poulet')||n.includes('volaille')) return '🍗';
  if (n.includes('bœuf')||n.includes('beef')||n.includes('steak')) return '🥩';
  if (n.includes('porc')||n.includes('jambon')) return '🥓';
  if (n.includes('poisson')||n.includes('saumon')||n.includes('thon')) return '🐟';
  if (n.includes('œuf')||n.includes('oeuf')) return '🥚';
  if (n.includes('riz')) return '🍚';
  if (n.includes('pâtes')||n.includes('pasta')) return '🍝';
  if (n.includes('pain')||n.includes('baguette')) return '🥖';
  if (n.includes('pomme de terre')) return '🥔';
  if (n.includes('banane')) return '🍌';
  if (n.includes('pomme')) return '🍎';
  if (n.includes('yaourt')||n.includes('lait')) return '🥛';
  if (n.includes('fromage')) return '🧀';
  if (n.includes('avocat')) return '🥑';
  if (n.includes('brocoli')) return '🥦';
  if (n.includes('carotte')) return '🥕';
  if (n.includes('chocolat')) return '🍫';
  if (n.includes('whey')||n.includes('protéine')) return '💪';
  return '🍽️';
}


/* ================================================================
   MODAL PORTION — style image 3
   ================================================================ */

function _showPortionModal(food, mealIndex, dayKey) {
  document.getElementById('portion-modal-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'portion-modal-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5);z-index:9900;display:flex;align-items:flex-end;justify-content:center';

  const sheet = document.createElement('div');
  sheet.style.cssText = 'background:var(--surface);border-radius:24px 24px 0 0;width:100%;max-width:520px;max-height:90vh;overflow-y:auto;-webkit-overflow-scrolling:touch;padding-bottom:env(safe-area-inset-bottom,20px)';

  const handle = document.createElement('div');
  handle.style.cssText='width:36px;height:4px;border-radius:2px;background:var(--border);margin:12px auto 0';

  // Food header
  const foodHdr = document.createElement('div');
  foodHdr.style.cssText = 'display:flex;align-items:center;gap:12px;padding:14px 16px 12px;border-bottom:1px solid var(--border)';

  const imgWrap2 = document.createElement('div');
  imgWrap2.style.cssText='width:56px;height:56px;border-radius:12px;overflow:hidden;flex-shrink:0;background:var(--bg);display:flex;align-items:center;justify-content:center;font-size:26px';
  if (food.imageUrl) {
    const img=document.createElement('img');img.src=food.imageUrl;img.style.cssText='width:100%;height:100%;object-fit:cover';
    img.onerror=()=>{imgWrap2.textContent=_foodEmoji(food.n||'');};
    imgWrap2.appendChild(img);
  } else { imgWrap2.textContent = food.emoji || _foodEmoji(food.n||food.name||''); }

  const fInfo=document.createElement('div');fInfo.style.cssText='flex:1;min-width:0';
  const fName=document.createElement('div');fName.style.cssText='font-size:15px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
  fName.textContent=food.n||food.name||'';
  const fSub=document.createElement('div');fSub.style.cssText='font-size:12px;color:var(--muted);margin-top:2px';
  fSub.textContent=Math.round(food.cal||0)+'kcal / 100g';
  fInfo.appendChild(fName); fInfo.appendChild(fSub);
  foodHdr.append(imgWrap2, fInfo);
  sheet.append(handle, foodHdr);

  // Portion section
  const portionSec = document.createElement('div');
  portionSec.style.cssText = 'padding:16px;border-bottom:1px solid var(--border)';

  const portionLbl = document.createElement('div');
  portionLbl.style.cssText='display:flex;align-items:center;justify-content:space-between;margin-bottom:14px';
  const pLbl1=document.createElement('span');pLbl1.style.cssText='font-size:14px;font-weight:700;color:var(--text)';pLbl1.textContent='Taille de la portion';
  portionLbl.appendChild(pLbl1);

  // Gram input large
  const gramWrap = document.createElement('div');
  gramWrap.style.cssText='display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:8px';

  const gramInp = document.createElement('input');
  gramInp.type='number'; gramInp.value='100'; gramInp.min='1'; gramInp.max='5000';
  gramInp.style.cssText='font-family:var(--mono);font-size:42px;font-weight:800;color:var(--text);border:none;border-bottom:2px solid var(--teal);background:transparent;text-align:center;width:120px;-webkit-appearance:none;outline:none';
  gramInp.setAttribute('inputmode','numeric');

  const gramUnit=document.createElement('span');gramUnit.style.cssText='font-size:16px;color:var(--muted);font-weight:600';gramUnit.textContent='g';

  gramWrap.append(gramInp, gramUnit);

  // Kcal preview
  const kcalPreview = document.createElement('div');
  kcalPreview.style.cssText='text-align:center;font-size:16px;color:var(--muted);font-weight:600;margin-bottom:14px';

  function updatePreview() {
    const g = parseFloat(gramInp.value)||0;
    const r = g/100;
    kcalPreview.textContent = Math.round((food.cal||0)*r) + ' kcal';
  }
  updatePreview();
  gramInp.addEventListener('input', updatePreview);

  // Unit buttons
  const unitRow = document.createElement('div');
  unitRow.style.cssText='display:flex;gap:6px;justify-content:center;flex-wrap:wrap';
  [['oz','28.3'],['ml','1'],['lb:oz','453'],['g','1'],['fl.oz','30']].forEach(([lbl,mult])=>{
    const b=document.createElement('button');
    const isG = lbl==='g';
    b.style.cssText=`padding:6px 12px;border-radius:8px;border:1.5px solid ${isG?'var(--teal)':'var(--border)'};background:${isG?'transparent':'transparent'};color:${isG?'var(--teal)':'var(--muted)'};font-size:13px;font-weight:${isG?'700':'500'};font-family:var(--font);cursor:pointer;touch-action:manipulation;-webkit-appearance:none`;
    if(isG) b.style.color='var(--teal)'; else b.style.color='var(--muted)';
    b.textContent=lbl;
    // For simplicity keep in grams, just update label
    const doUnit=()=>{ gramUnit.textContent=lbl; unitRow.querySelectorAll('button').forEach(bb=>{ bb.style.borderColor='var(--border)';bb.style.color='var(--muted)';bb.style.fontWeight='500';}); b.style.borderColor='var(--teal)';b.style.color='var(--teal)';b.style.fontWeight='700'; };
    b.ontouchstart=(e)=>{e.preventDefault();doUnit();}; b.onclick=doUnit;
    unitRow.appendChild(b);
  });

  portionSec.append(portionLbl, gramWrap, kcalPreview, unitRow);
  sheet.appendChild(portionSec);

  // Meal selector
  const mealSec = document.createElement('div');
  mealSec.style.cssText = 'padding:14px 16px;border-bottom:1px solid var(--border)';
  const mealLbl=document.createElement('div');mealLbl.style.cssText='font-size:14px;font-weight:700;color:var(--text);margin-bottom:10px';mealLbl.textContent='Repas';
  const mealRow=document.createElement('div');mealRow.style.cssText='display:flex;gap:6px;overflow-x:auto;scrollbar-width:none';

  let selectedMeal = mealIndex;
  const mealBtns = [];
  MEAL_NAMES.forEach((name,mi)=>{
    const mb=document.createElement('button');
    const isSelected = mi===mealIndex;
    mb.style.cssText=`padding:8px 14px;border-radius:12px;border:none;font-size:13px;font-weight:700;font-family:var(--font);cursor:pointer;touch-action:manipulation;-webkit-appearance:none;display:flex;align-items:center;gap:5px;white-space:nowrap;background:${isSelected?'rgba(91,168,160,.15)':'var(--bg)'};color:${isSelected?'var(--teal-d)':'var(--muted)'}`;
    mb.innerHTML=MEAL_ICONS_NEW[mi]+' '+name;
    const doMeal=()=>{
      selectedMeal=mi;
      mealBtns.forEach((b2,i2)=>{
        b2.style.background=i2===mi?'rgba(91,168,160,.15)':'var(--bg)';
        b2.style.color=i2===mi?'var(--teal-d)':'var(--muted)';
      });
    };
    mb.ontouchstart=(e)=>{e.preventDefault();doMeal();}; mb.onclick=doMeal;
    mealBtns.push(mb);
    mealRow.appendChild(mb);
  });
  mealSec.append(mealLbl, mealRow);
  sheet.appendChild(mealSec);

  // Confirmer button
  const confirmBtn = document.createElement('button');
  confirmBtn.style.cssText='display:block;width:calc(100% - 32px);margin:14px 16px;padding:15px;border-radius:16px;border:none;background:var(--teal);color:#fff;font-size:16px;font-weight:700;font-family:var(--font);cursor:pointer;touch-action:manipulation;-webkit-appearance:none';
  confirmBtn.textContent='Confirmer';

  const doConfirm=()=>{
    const g = parseFloat(gramInp.value)||100;
    const r = g/100;
    const item = {
      name:    food.n || food.name || '',
      weight:  Math.round(g),
      cal:     Math.round((food.cal||0)*r),
      protein: Math.round((food.prot||food.protein||0)*r*10)/10,
      carbs:   Math.round((food.carbs||0)*r*10)/10,
      fat:     Math.round((food.fat||0)*r*10)/10,
      imageUrl: food.imageUrl || null,
      emoji:   food.emoji || _foodEmoji(food.n||food.name||''),
    };

    // Ajouter au repas sélectionné
    const calState = Store.getState().activity.calories;
    if (!calState[dayKey]) calState[dayKey]={meals:[{items:[]},{items:[]},{items:[]},{items:[]}]};
    while (calState[dayKey].meals.length<4) calState[dayKey].meals.push({items:[]});
    calState[dayKey].meals[selectedMeal].items.push(item);
    save();
    overlay.remove();
    renderCalTracker();
    showToast(item.name+' ajouté — '+item.cal+' kcal', 'save', 2000);
  };
  confirmBtn.ontouchstart=(e)=>{e.preventDefault();doConfirm();}; confirmBtn.onclick=doConfirm;
  sheet.appendChild(confirmBtn);

  overlay.appendChild(sheet);
  overlay.ontouchstart=(e)=>{if(e.target===overlay)overlay.remove();};
  overlay.onclick=(e)=>{if(e.target===overlay)overlay.remove();};
  document.body.appendChild(overlay);
}

/* ── Saisie manuelle ── */
function _showManualAddForm(mealIndex, dayKey, prefillName) {
  document.getElementById('manual-add-overlay')?.remove();
  const overlay=document.createElement('div');overlay.id='manual-add-overlay';
  overlay.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5);z-index:9900;display:flex;align-items:flex-end;justify-content:center';
  const sheet=document.createElement('div');
  sheet.style.cssText='background:var(--surface);border-radius:24px 24px 0 0;width:100%;padding:16px 16px calc(24px + env(safe-area-inset-bottom,0px));max-width:520px';

  const handle=document.createElement('div');handle.style.cssText='width:36px;height:4px;border-radius:2px;background:var(--border);margin:0 auto 16px';
  const title=document.createElement('div');title.style.cssText='font-size:16px;font-weight:700;color:var(--text);margin-bottom:14px';title.textContent='Créer un aliment';

  function mkInp(ph, type='text') {
    const i=document.createElement('input');i.type=type;i.placeholder=ph;
    i.style.cssText='width:100%;padding:12px 14px;border-radius:12px;border:1.5px solid var(--border);background:var(--bg);font-size:16px;font-family:var(--font);color:var(--text);-webkit-appearance:none;outline:none;box-sizing:border-box;margin-bottom:8px';
    return i;
  }
  const nameInp=mkInp('Nom de l\'aliment');if(prefillName)nameInp.value=prefillName;
  const calInp=mkInp('Calories (kcal)','number');
  const protInp=mkInp('Protéines (g)','number');
  const carbInp=mkInp('Glucides (g)','number');
  const fatInp=mkInp('Lipides (g)','number');
  const weightInp=mkInp('Poids (g) — optionnel','number');weightInp.value='100';

  const btns=document.createElement('div');btns.style.cssText='display:flex;gap:8px;margin-top:4px';
  const cancelB=document.createElement('button');cancelB.style.cssText='flex:1;padding:13px;border-radius:14px;border:1.5px solid var(--border);background:transparent;color:var(--muted);font-size:14px;font-weight:700;font-family:var(--font);cursor:pointer;touch-action:manipulation;-webkit-appearance:none';cancelB.textContent='Annuler';
  const addB=document.createElement('button');addB.style.cssText='flex:2;padding:13px;border-radius:14px;border:none;background:var(--teal);color:#fff;font-size:14px;font-weight:700;font-family:var(--font);cursor:pointer;touch-action:manipulation;-webkit-appearance:none';addB.textContent='Ajouter';

  const doAdd2=()=>{
    const name=nameInp.value.trim();const cal=parseFloat(calInp.value)||0;
    if(!name||!cal){showToast('Nom et calories requis','warn');return;}
    const calState=Store.getState().activity.calories;
    if(!calState[dayKey])calState[dayKey]={meals:[{items:[]},{items:[]},{items:[]},{items:[]}]};
    while(calState[dayKey].meals.length<4)calState[dayKey].meals.push({items:[]});
    calState[dayKey].meals[mealIndex].items.push({name,weight:parseInt(weightInp.value)||null,cal:Math.round(cal),protein:parseFloat(protInp.value)||0,carbs:parseFloat(carbInp.value)||0,fat:parseFloat(fatInp.value)||0,emoji:_foodEmoji(name)});
    save();overlay.remove();renderCalTracker();showToast(name+' ajouté','save',2000);
  };
  addB.ontouchstart=(e)=>{e.preventDefault();doAdd2();}; addB.onclick=doAdd2;
  cancelB.ontouchstart=(e)=>{e.preventDefault();overlay.remove();}; cancelB.onclick=()=>overlay.remove();
  btns.append(cancelB,addB);
  sheet.append(handle,title,nameInp,calInp,protInp,carbInp,fatInp,weightInp,btns);
  overlay.appendChild(sheet);
  overlay.ontouchstart=(e)=>{if(e.target===overlay)overlay.remove();};
  overlay.onclick=(e)=>{if(e.target===overlay)overlay.remove();};
  document.body.appendChild(overlay);
  setTimeout(()=>nameInp.focus(),200);
}




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

/* ── Recherche aliments français avec calcul auto par poids ── */
function _showFoodSearchFR(callback) {
  document.getElementById('food-fr-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'food-fr-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.55);z-index:9500;display:flex;align-items:flex-end;justify-content:center';

  const sheet = document.createElement('div');
  sheet.style.cssText = 'background:var(--surface);border-radius:24px 24px 0 0;padding:16px;width:100%;max-width:520px;max-height:85vh;overflow-y:auto;-webkit-overflow-scrolling:touch;display:flex;flex-direction:column;gap:10px';

  const handle = document.createElement('div');
  handle.style.cssText = 'width:36px;height:4px;border-radius:2px;background:var(--border);margin:0 auto';

  const title = document.createElement('div');
  title.style.cssText = 'font-size:17px;font-weight:700;color:var(--text)';
  title.textContent = '🇫🇷 Aliments — Base française';

  // Champ recherche
  const searchInp = document.createElement('input');
  searchInp.type = 'text';
  searchInp.placeholder = 'Tapez un aliment (ex: poulet, riz, yaourt...)';
  searchInp.setAttribute('autocomplete','off');
  searchInp.style.cssText = 'padding:12px 14px;border-radius:12px;border:1.5px solid var(--teal);background:var(--bg);font-size:16px;font-family:var(--font);color:var(--text);-webkit-appearance:none;outline:none;width:100%;box-sizing:border-box';

  // Champ poids
  const weightRow = document.createElement('div');
  weightRow.style.cssText = 'display:flex;align-items:center;gap:8px';
  const weightLbl = document.createElement('span');
  weightLbl.style.cssText = 'font-size:12px;font-weight:700;color:var(--muted);flex-shrink:0';
  weightLbl.textContent = 'Portion :';
  const weightInp = document.createElement('input');
  weightInp.type = 'number'; weightInp.min = 1; weightInp.max = 2000; weightInp.value = 100;
  weightInp.style.cssText = 'width:80px;padding:8px 10px;border-radius:10px;border:1.5px solid var(--border);background:var(--bg);font-size:16px;font-weight:700;font-family:var(--mono);color:var(--text);text-align:center;-webkit-appearance:none';
  const weightUnit = document.createElement('span');
  weightUnit.style.cssText = 'font-size:12px;color:var(--muted)';
  weightUnit.textContent = 'g';
  weightRow.appendChild(weightLbl); weightRow.appendChild(weightInp); weightRow.appendChild(weightUnit);

  // Résultats
  const results = document.createElement('div');
  results.style.cssText = 'display:flex;flex-direction:column;gap:4px;max-height:300px;overflow-y:auto;-webkit-overflow-scrolling:touch';

  function renderResults(q) {
    results.innerHTML = '';
    const foods = (typeof searchFoodsFR === 'function') ? searchFoodsFR(q) : [];

    if (!foods.length && q.length >= 2) {
      results.innerHTML = '<div style="font-size:12px;color:var(--muted);padding:12px;text-align:center">Aucun aliment trouvé pour "'+q+'"</div>';
      return;
    }
    if (!q || q.length < 2) {
      // Afficher les 10 premiers par défaut
      const defaults = (typeof FOODS_FR !== 'undefined' ? FOODS_FR : []).slice(0, 10);
      renderFoodList(defaults, '');
      return;
    }
    renderFoodList(foods, q);
  }

  function renderFoodList(foods, q) {
    results.innerHTML = '';
    foods.forEach(food => {
      const row = document.createElement('button');
      row.style.cssText = 'display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:10px 12px;border-radius:10px;border:1px solid var(--border);background:var(--card);font-family:var(--font);cursor:pointer;touch-action:manipulation;-webkit-appearance:none';

      const info = document.createElement('div');
      info.style.cssText = 'flex:1;min-width:0';

      // Nom de l'aliment
      const nm = document.createElement('div');
      nm.style.cssText = 'font-size:13px;font-weight:600;color:var(--text)';
      nm.textContent = food.n;

      // Macros pour 100g
      const macros100 = document.createElement('div');
      macros100.style.cssText = 'font-size:10px;color:var(--muted);margin-top:1px';
      macros100.textContent = food.cal + 'kcal · P:' + food.prot + 'g · G:' + food.carbs + 'g · L:' + food.fat + 'g  /100g';

      // Macros pour portion calculée en temps réel
      const portionDiv = document.createElement('div');
      portionDiv.style.cssText = 'font-size:11px;color:var(--teal-d);font-weight:600;margin-top:1px';

      function updatePortion() {
        const g = parseFloat(weightInp.value) || 100;
        const r = g / 100;
        portionDiv.textContent = 'Pour ' + g + 'g : ' + Math.round(food.cal * r) + 'kcal · P:' + Math.round(food.prot * r * 10) / 10 + 'g · G:' + Math.round(food.carbs * r * 10) / 10 + 'g · L:' + Math.round(food.fat * r * 10) / 10 + 'g';
      }
      updatePortion();
      weightInp.addEventListener('input', updatePortion);

      info.appendChild(nm); info.appendChild(macros100); info.appendChild(portionDiv);

      const addIcon = document.createElement('span');
      addIcon.style.cssText = 'color:var(--teal);font-size:18px;flex-shrink:0';
      addIcon.textContent = '+';

      row.appendChild(info); row.appendChild(addIcon);

      const doAdd = () => {
        const g = parseFloat(weightInp.value) || 100;
        const r = g / 100;
        overlay.remove();
        if (callback) callback({
          name:    food.n + ' (' + g + 'g)',
          cal:     Math.round(food.cal    * r),
          protein: Math.round(food.prot   * r * 10) / 10,
          carbs:   Math.round(food.carbs  * r * 10) / 10,
          fat:     Math.round(food.fat    * r * 10) / 10,
        });
      };
      row.ontouchstart = (e) => { e.preventDefault(); doAdd(); };
      row.onclick = doAdd;
      results.appendChild(row);
    });
  }

  // Afficher les aliments par défaut au démarrage
  renderResults('');

  searchInp.addEventListener('input', () => renderResults(searchInp.value.trim()));

  const cancel = document.createElement('button');
  cancel.style.cssText = 'padding:12px;border:none;background:none;color:var(--muted);font-size:14px;font-family:var(--font);cursor:pointer;touch-action:manipulation;-webkit-appearance:none;width:100%';
  cancel.textContent = 'Annuler';
  cancel.ontouchstart = (e) => { e.preventDefault(); overlay.remove(); };
  cancel.onclick = () => overlay.remove();

  sheet.append(handle, title, searchInp, weightRow, results, cancel);
  overlay.appendChild(sheet);
  overlay.ontouchstart = (e) => { if (e.target === overlay) overlay.remove(); };
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  document.body.appendChild(overlay);
  setTimeout(() => searchInp.focus(), 200);
}


let _corpsListenersInit = false;

function renderCorps(){
  // Inputs profil — bind une seule fois pour éviter l'empilement de listeners
  const profilInp=document.getElementById('profil-taille');
  if(profilInp){ profilInp.value=S.profilTaille||''; }
  const poignetInp=document.getElementById('profil-poignet');
  if(poignetInp){ poignetInp.value=S.profilPoignet||17; }
  const sexeSelC=document.getElementById('profil-sexe');
  if(sexeSelC){ sexeSelC.value=S.profilSexe||'H'; }
  const ageInp=document.getElementById('profil-age');
  if(ageInp){ ageInp.value=S.profilAge||30; }

  if(!_corpsListenersInit) {
    _corpsListenersInit = true;
    if(profilInp)  profilInp.addEventListener('input',  e=>{S.profilTaille=parseInt(e.target.value)||0;save();renderCorps();});
    if(poignetInp) poignetInp.addEventListener('input', e=>{S.profilPoignet=parseFloat(e.target.value)||17;save();renderCorps();});
    if(sexeSelC)   sexeSelC.addEventListener('change',  e=>{S.profilSexe=e.target.value;save();renderCorps();});
    if(ageInp)     ageInp.addEventListener('input',     e=>{S.profilAge=parseInt(e.target.value)||30;save();});
  }
  // ── Sections dynamiques — injection stable (ordre garanti) ──
  // Utilise ensureSection() pour éviter les doublons et garantir l'ordre

  function ensureSection(id, parentId, style, insertBefore) {
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('div');
      el.id = id;
      el.style.cssText = style || '';
      const parent = document.getElementById(parentId);
      if (parent) {
        const ref = insertBefore ? document.getElementById(insertBefore) : null;
        if (ref && ref.parentNode === parent) parent.insertBefore(el, ref);
        else parent.appendChild(el);
      }
    }
    return el;
  }

  // MESURES tab — ordre : Poids → Silhouette → Corps grid → Composition
  const wpEl  = ensureSection('corps-weight-progress', 'corps-sect-mesures', 'padding:0 12px 10px', 'corps-bf-whr');
  const silEl = ensureSection('corps-silhouette',       'corps-sect-mesures', 'padding:0 12px 10px', 'corps-grid');
  const bcEl  = ensureSection('corps-body-compo',       'corps-sect-mesures', 'padding:0 12px 12px');

  // NUTRITION tab — eau en bas
  const wtEl  = ensureSection('corps-water-tracker',    'corps-sect-nutrition', 'padding:0 12px 12px');

  if (typeof renderWeightProgress === 'function')  renderWeightProgress(wpEl);
  if (typeof renderBodySilhouette === 'function')  renderBodySilhouette(silEl);
  if (typeof renderBodyComposition === 'function') renderBodyComposition(bcEl);
  if (typeof renderWaterTracker === 'function')    renderWaterTracker(wtEl);

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
