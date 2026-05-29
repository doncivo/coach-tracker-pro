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

/* calDayKey / calDayLabel — définis plus bas dans ce fichier (version correcte) */


/* ================================================================
   NUTRITION — Redesign complet (style référence Yazio)
   Images 1→4 : recherche avec photos, portion modal, ring calorique
   ================================================================ */

/* ================================================================
   NUTRITION — Refactoring complet v2
   Bugs corrigés : overlay scope, MEAL_NAMES emoji doublé,
   données persistées, iOS scroll, keyboard safe area
   ================================================================ */

// Noms propres (sans emoji) pour usage interne
const MEAL_LABELS = ['Petit-déjeuner','Déjeuner','Dîner','Collation'];
const MEAL_ICONS  = ['🌅','☀️','🌙','🍎'];

// MEAL_NAMES déclaré dans render_corps.js ligne 116 — pas de redéclaration ici

/* ── helpers ── */
function _kcal100(food) { return Math.round(food.cal || 0); }
function _foodEmoji(name) {
  const n = (name||'').toLowerCase();
  if(n.includes('poulet')||n.includes('volaille')) return '🍗';
  if(n.includes('bœuf')||n.includes('boeuf')||n.includes('steak')) return '🥩';
  if(n.includes('porc')||n.includes('jambon')||n.includes('saucisse')) return '🥓';
  if(n.includes('poisson')||n.includes('saumon')||n.includes('thon')||n.includes('cabillaud')) return '🐟';
  if(n.includes('crevette')) return '🍤';
  if(n.includes('oeuf')||n.includes('œuf')) return '🥚';
  if(n.includes('riz')) return '🍚';
  if(n.includes('pâtes')||n.includes('pasta')||n.includes('spaghetti')) return '🍝';
  if(n.includes('pain')||n.includes('baguette')||n.includes('brioche')) return '🥖';
  if(n.includes('pomme de terre')||n.includes('patate')) return '🥔';
  if(n.includes('banane')) return '🍌';
  if(n.includes('pomme')&&!n.includes('terre')) return '🍎';
  if(n.includes('yaourt')||n.includes('fromage blanc')) return '🥛';
  if(n.includes('lait')) return '🥛';
  if(n.includes('fromage')) return '🧀';
  if(n.includes('avocat')) return '🥑';
  if(n.includes('brocoli')||n.includes('épinard')||n.includes('haricot')) return '🥦';
  if(n.includes('carotte')) return '🥕';
  if(n.includes('tomate')) return '🍅';
  if(n.includes('chocolat')||n.includes('nutella')) return '🍫';
  if(n.includes('whey')||n.includes('protéine')) return '💪';
  if(n.includes('huile')||n.includes('beurre')) return '🫙';
  if(n.includes('noix')||n.includes('amande')||n.includes('cacahuète')) return '🥜';
  if(n.includes('miel')) return '🍯';
  return '🍽️';
}

/* ── calDayKey / calDayLabel ── */
function calDayKey(offset) {
  const d = new Date(); d.setDate(d.getDate() - offset);
  return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
}
function calDayLabel(offset) {
  if(offset===0) return "Aujourd'hui";
  if(offset===1) return 'Hier';
  if(offset===-1) return 'Demain';
  const d = new Date(); d.setDate(d.getDate()-offset);
  return d.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'short'});
}

/* ================================================================
   renderCalTracker — vue principale nutrition
   ================================================================ */
function renderCalTracker() {
  const content = document.getElementById('cal-content');
  if (!content) return;

  // ── État ──
  const dk = calDayKey(_calDayOffset);
  const calState = Store.getState().activity.calories;
  if (!calState[dk]) calState[dk] = { meals:[{items:[]},{items:[]},{items:[]},{items:[]}] };
  const dayData = calState[dk];
  if (!dayData.meals) dayData.meals = [];
  while (dayData.meals.length < 4) dayData.meals.push({items:[]});

  const goal = S.caloriesGoal || 2500;
  let totalCal=0, totalP=0, totalC=0, totalF=0;
  dayData.meals.forEach(m=>(m.items||[]).forEach(it=>{
    totalCal += parseFloat(it.cal)    || 0;
    totalP   += parseFloat(it.protein)|| 0;
    totalC   += parseFloat(it.carbs)  || 0;
    totalF   += parseFloat(it.fat)    || 0;
  }));

  content.innerHTML = '';

  // ── 1. SÉLECTEUR 7 JOURS ──
  const weekRow = document.createElement('div');
  weekRow.style.cssText = 'display:flex;justify-content:space-between;padding:8px 0 14px;';
  const DN = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
  for (let i = -3; i <= 3; i++) {
    const d   = new Date(); d.setDate(d.getDate() + i - _calDayOffset);
    const act = i === 0;
    const key = calDayKey(_calDayOffset - i);
    const hasDot = !act && (calState[key]?.meals||[]).some(m=>(m.items||[]).length>0);

    const btn = document.createElement('div');
    btn.style.cssText = `
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      width:40px;padding:6px 0;border-radius:12px;cursor:pointer;touch-action:manipulation;user-select:none;
      background:${act?'var(--teal)':'transparent'};
      -webkit-tap-highlight-color:transparent;
    `;
    const dn  = document.createElement('div');
    dn.style.cssText = `font-size:10px;font-weight:600;color:${act?'rgba(255,255,255,.75)':'var(--muted)'}`;
    dn.textContent = DN[d.getDay()];
    const dd  = document.createElement('div');
    dd.style.cssText = `font-size:16px;font-weight:800;color:${act?'#fff':'var(--text)'}`;
    dd.textContent = d.getDate();
    btn.appendChild(dn); btn.appendChild(dd);
    if (hasDot) {
      const dot = document.createElement('div');
      dot.style.cssText='width:4px;height:4px;border-radius:50%;background:var(--teal);margin-top:3px';
      btn.appendChild(dot);
    }
    const diff = i;
    const doDay = () => { _calDayOffset -= diff; renderCalTracker(); };
    btn.ontouchstart = e => { e.preventDefault(); doDay(); };
    btn.onclick = doDay;
    weekRow.appendChild(btn);
  }
  content.appendChild(weekRow);

  // ── 2. ANNEAU + MACROS ──
  const ringRow = document.createElement('div');
  ringRow.style.cssText = 'display:flex;align-items:center;gap:16px;padding:0 2px 16px';

  // Anneau SVG
  const R=50, SW=9, C=2*Math.PI*R;
  const pct = Math.min(1, totalCal/goal);
  const ringColor = totalCal > goal ? 'var(--red)' : totalCal > goal*0.8 ? 'var(--orange)' : 'var(--teal)';
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns,'svg');
  svg.setAttribute('viewBox','0 0 120 120');
  svg.style.cssText = 'width:115px;height:115px;flex-shrink:0';

  const mkCirc = (stroke,sw,dash,off,t) => {
    const c = document.createElementNS(ns,'circle');
    c.setAttribute('cx','60');c.setAttribute('cy','60');c.setAttribute('r',String(R));
    c.setAttribute('fill','none');c.setAttribute('stroke',stroke);c.setAttribute('stroke-width',String(sw));
    if(dash) { c.setAttribute('stroke-dasharray',dash); c.setAttribute('stroke-dashoffset',off); }
    if(t) c.setAttribute('transform',t);
    c.setAttribute('stroke-linecap','round');
    return c;
  };
  svg.appendChild(mkCirc('var(--border)',SW));
  svg.appendChild(mkCirc(ringColor,SW,C.toFixed(1),(C*(1-pct)).toFixed(1),'rotate(-90 60 60)'));

  const mkTxt = (y,size,weight,fill,text) => {
    const t = document.createElementNS(ns,'text');
    t.setAttribute('x','60');t.setAttribute('y',y);t.setAttribute('text-anchor','middle');
    t.setAttribute('font-size',String(size));t.setAttribute('font-weight',String(weight));
    t.setAttribute('fill',fill); t.textContent = text; return t;
  };
  svg.appendChild(mkTxt('50','9','500','var(--muted)','Calories'));
  svg.appendChild(mkTxt('69','22','800','var(--text)',String(Math.round(totalCal))));
  const restTxt = totalCal>goal
    ? '▲ +'+Math.round(totalCal-goal)
    : '▼ '+Math.round(goal-totalCal);
  svg.appendChild(mkTxt('83','9','600',ringColor, restTxt+' kcal'));
  ringRow.appendChild(svg);

  // Macros droite
  const macCol = document.createElement('div');
  macCol.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:11px';
  const gP=S.proteinGoal||0, gC=S.carbsGoal||0, gF=S.fatGoal||0;
  [
    {lbl:'Glucides',  v:Math.round(totalC), g:gC, c:'#7b68ee'},
    {lbl:'Protéines', v:Math.round(totalP), g:gP, c:'#1eb8a0'},
    {lbl:'Lipides',   v:Math.round(totalF), g:gF, c:'#ff7b7b'},
  ].forEach(({lbl,v,g,c})=>{
    const row=document.createElement('div');
    const top=document.createElement('div');top.style.cssText='display:flex;justify-content:space-between;margin-bottom:4px';
    const l=document.createElement('span');l.style.cssText='font-size:12px;font-weight:600;color:var(--text)';l.textContent=lbl;
    const r=document.createElement('span');r.style.cssText='font-size:12px;color:var(--muted)';
    r.textContent = g>0 ? v+'g / '+g+'g' : v+'g';
    top.appendChild(l);top.appendChild(r);
    const bar=document.createElement('div');bar.style.cssText='height:5px;background:var(--border);border-radius:3px;overflow:hidden';
    const fill=document.createElement('div');
    fill.style.cssText=`height:100%;width:${g>0?Math.min(100,v/g*100):0}%;background:${c};border-radius:3px;transition:width .4s`;
    bar.appendChild(fill);row.appendChild(top);row.appendChild(bar);
    macCol.appendChild(row);
  });
  ringRow.appendChild(macCol);
  content.appendChild(ringRow);

  // ── 3. SECTIONS REPAS ──
  const mealsWrap = document.createElement('div');
  mealsWrap.style.cssText = 'display:flex;flex-direction:column;gap:10px;padding-bottom:16px';

  dayData.meals.forEach((meal, mi) => {
    const items    = meal.items || [];
    const mealCal  = items.reduce((a,it)=>a+(parseFloat(it.cal)||0),0);

    const section = document.createElement('div');
    section.style.cssText = 'background:var(--card);border-radius:16px;overflow:hidden;border:1px solid var(--border)';

    // Header
    const hdr = document.createElement('div');
    hdr.style.cssText = 'display:flex;align-items:center;padding:13px 14px;gap:10px;min-height:52px';
    const ic = document.createElement('span');ic.style.cssText='font-size:20px';ic.textContent=MEAL_ICONS[mi];
    const nm = document.createElement('div');nm.style.cssText='flex:1;font-size:15px;font-weight:700;color:var(--text)';nm.textContent=MEAL_LABELS[mi];
    const kc = document.createElement('div');kc.style.cssText='font-size:14px;font-weight:700;color:var(--muted)';
    kc.textContent = mealCal>0 ? Math.round(mealCal)+' kcal' : '';
    hdr.append(ic,nm,kc);
    section.appendChild(hdr);

    // Items
    if (items.length) {
      const list = document.createElement('div');
      list.style.cssText = 'border-top:1px solid var(--border)';
      items.forEach((item,ii)=>{
        const row=document.createElement('div');
        row.style.cssText='display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--border)';

        // Thumbnail
        const thumb=document.createElement('div');
        thumb.style.cssText='width:42px;height:42px;border-radius:10px;overflow:hidden;flex-shrink:0;background:var(--bg);display:flex;align-items:center;justify-content:center;font-size:22px';
        if(item.imageUrl){
          const img=document.createElement('img');
          img.src=item.imageUrl;img.style.cssText='width:100%;height:100%;object-fit:cover';
          img.onerror=()=>{thumb.removeChild(img);thumb.textContent=item.emoji||'🍽️';};
          thumb.appendChild(img);
        } else {
          thumb.textContent=item.emoji||_foodEmoji(item.name||'');
        }

        const info=document.createElement('div');info.style.cssText='flex:1;min-width:0';
        const iN=document.createElement('div');iN.style.cssText='font-size:13px;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap';iN.textContent=item.name;
        const iS=document.createElement('div');iS.style.cssText='font-size:11px;color:var(--muted);margin-top:2px';
        iS.textContent=(item.weight?item.weight+'g · ':'')+'P:'+Math.round(item.protein||0)+'g G:'+Math.round(item.carbs||0)+'g L:'+Math.round(item.fat||0)+'g';
        info.appendChild(iN);info.appendChild(iS);

        const iK=document.createElement('div');iK.style.cssText='font-size:13px;font-weight:700;color:var(--text);flex-shrink:0';iK.textContent=Math.round(item.cal)+' kcal';

        const del=document.createElement('button');
        del.style.cssText='border:none;background:none;color:var(--muted);cursor:pointer;touch-action:manipulation;-webkit-appearance:none;width:36px;height:36px;display:flex;align-items:center;justify-content:center;flex-shrink:0;border-radius:50%';
        del.innerHTML='<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4l8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
        const doDel=()=>{ items.splice(ii,1); save(); renderCalTracker(); };
        del.ontouchstart=e=>{e.preventDefault();doDel();}; del.onclick=doDel;

        row.append(thumb,info,iK,del);
        list.appendChild(row);
      });
      section.appendChild(list);
    }

    // Bouton ajouter
    const addBtn = document.createElement('button');
    addBtn.style.cssText=`
      width:100%;padding:14px;border:none;
      background:${items.length?'var(--bg)':'var(--surface)'};
      color:var(--teal-d);font-size:14px;font-weight:700;font-family:var(--font);
      cursor:pointer;touch-action:manipulation;-webkit-appearance:none;
      border-top:${items.length?'1px solid var(--border)':'none'};
      display:flex;align-items:center;justify-content:center;gap:8px;
      -webkit-tap-highlight-color:transparent;
    `;
    addBtn.innerHTML='<span style="font-size:20px;color:var(--teal);font-weight:300">＋</span><span>Ajouter un aliment</span>';
    const doAdd=()=>_showNutritionSearch(mi,dk);
    addBtn.ontouchstart=e=>{e.preventDefault();doAdd();}; addBtn.onclick=doAdd;
    section.appendChild(addBtn);
    mealsWrap.appendChild(section);
  });
  content.appendChild(mealsWrap);
}

/* ================================================================
   _showNutritionSearch — écran de recherche (style image 2)
   ================================================================ */
function _showNutritionSearch(mealIndex, dayKey) {
  document.getElementById('nutr-search-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'nutr-search-overlay';
  overlay.style.cssText = [
    'position:fixed','top:0','left:0','right:0','bottom:0',
    'background:var(--surface)','z-index:9800',
    'display:flex','flex-direction:column',
  ].join(';');

  // ── Header (safe area) ──
  const hdr = document.createElement('div');
  hdr.style.cssText = 'flex-shrink:0;padding:max(env(safe-area-inset-top,16px),16px) 16px 0;background:var(--surface)';

  const bar = document.createElement('div');
  bar.style.cssText = 'display:flex;align-items:center;gap:10px;background:var(--bg);border-radius:14px;padding:11px 14px;margin-bottom:10px';

  const icon = document.createElement('span');icon.textContent='🔍';icon.style.cssText='font-size:16px;flex-shrink:0;opacity:.5';

  const inp = document.createElement('input');
  inp.type='search'; inp.placeholder='Rechercher un aliment...';
  inp.setAttribute('autocomplete','off'); inp.setAttribute('autocorrect','off');
  inp.style.cssText='flex:1;border:none;background:transparent;font-size:16px;font-family:var(--font);color:var(--text);outline:none;-webkit-appearance:none;min-width:0';

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent='Annuler';
  cancelBtn.style.cssText='border:none;background:none;color:var(--teal-d);font-size:15px;font-weight:700;font-family:var(--font);cursor:pointer;touch-action:manipulation;-webkit-appearance:none;flex-shrink:0;padding:0 0 0 8px';
  const doClose = () => overlay.remove();
  cancelBtn.ontouchstart=e=>{e.preventDefault();doClose();}; cancelBtn.onclick=doClose;

  bar.append(icon,inp,cancelBtn);
  hdr.appendChild(bar);
  overlay.appendChild(hdr);

  // ── Résultats (scrollable) ──
  const results = document.createElement('div');
  // min-height:0 obligatoire sur iOS Safari pour que flex:1 soit scrollable
  results.style.cssText = 'flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch';
  overlay.appendChild(results);

  document.body.appendChild(overlay);

  // Focus après animation
  setTimeout(()=>{inp.focus();inp.select();}, 250);

  // Affichage initial
  _renderFoodResults(overlay, results, mealIndex, dayKey, inp, []);

  // Recherche
  let timer, ctrl;
  inp.addEventListener('input',()=>{
    clearTimeout(timer);
    const q = inp.value.trim();
    timer = setTimeout(()=>{
      if(ctrl) ctrl.abort();
      ctrl = new AbortController();
      // Local instantané
      _renderFoodResults(overlay, results, mealIndex, dayKey, inp, []);
      // Remote si ≥2 chars
      if(q.length >= 2) _fetchOFF(q, overlay, results, mealIndex, dayKey, inp, ctrl.signal);
    }, 280);
  });
}

/* ── Rendu des résultats (local + remote) ── */
function _renderFoodResults(overlay, results, mealIndex, dayKey, inp, remoteItems) {
  results.innerHTML = '';
  const raw = inp.value.trim();
  const q   = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');

  // Header : label + bouton Créer
  const rhdr = document.createElement('div');
  rhdr.style.cssText='display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-bottom:1px solid var(--border);flex-shrink:0';
  const rLbl=document.createElement('div');
  rLbl.style.cssText='font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)';
  rLbl.textContent = q.length>=2 ? 'Résultats de la recherche' : 'Aliments fréquents';

  const crBtn=document.createElement('button');
  crBtn.textContent='Créer';
  crBtn.style.cssText='border:none;background:rgba(91,168,160,.12);color:var(--teal-d);font-size:13px;font-weight:700;font-family:var(--font);cursor:pointer;touch-action:manipulation;-webkit-appearance:none;padding:5px 12px;border-radius:8px';
  const doCreate=()=>{
    // Utiliser getElementById pour ne pas dépendre du scope closure
    document.getElementById('nutr-search-overlay')?.remove();
    _showManualAddForm(mealIndex, dayKey, raw);
  };
  crBtn.ontouchstart=e=>{e.preventDefault();doCreate();}; crBtn.onclick=doCreate;
  rhdr.append(rLbl,crBtn);
  results.appendChild(rhdr);

  // Aliments locaux
  const localFoods = q.length>=2
    ? (searchFoodsFR(raw)||[])
    : (FOODS_FR||[]).slice(0,15);

  const allFoods = [
    ...localFoods.map(f=>({...f, _isLocal:true})),
    ...remoteItems,
  ];

  if (!allFoods.length) {
    const empty=document.createElement('div');
    empty.style.cssText='padding:40px 16px;text-align:center;color:var(--muted);font-size:13px';
    empty.textContent = q.length>=2 ? 'Aucun résultat pour "'+raw+'"' : '';
    results.appendChild(empty);
    return;
  }

  allFoods.forEach(food=>{
    const row=document.createElement('div');
    row.style.cssText='display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--border);cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation';

    // Photo ou emoji
    const thumb=document.createElement('div');
    thumb.style.cssText='width:56px;height:56px;border-radius:12px;overflow:hidden;flex-shrink:0;background:var(--bg);display:flex;align-items:center;justify-content:center;font-size:26px';
    if(food.imageUrl){
      const img=document.createElement('img');
      img.src=food.imageUrl;img.style.cssText='width:100%;height:100%;object-fit:cover';
      img.onerror=()=>{thumb.removeChild(img);thumb.textContent=_foodEmoji(food.n||'');};
      thumb.appendChild(img);
    } else {
      thumb.textContent=food.emoji||_foodEmoji(food.n||'');
    }

    // Info
    const info=document.createElement('div');info.style.cssText='flex:1;min-width:0';
    const nm=document.createElement('div');nm.style.cssText='font-size:14px;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap';nm.textContent=food.n||food.name||'';
    const kc=document.createElement('div');kc.style.cssText='font-size:12px;color:var(--muted);margin-top:2px';kc.textContent=_kcal100(food)+'kcal / 100g';
    info.append(nm,kc);

    // + bouton
    const plus=document.createElement('button');
    plus.style.cssText='width:34px;height:34px;border-radius:50%;border:2px solid var(--teal);background:transparent;color:var(--teal);font-size:22px;font-weight:300;cursor:pointer;touch-action:manipulation;-webkit-appearance:none;display:flex;align-items:center;justify-content:center;flex-shrink:0;line-height:1';
    plus.textContent='+';

    const doSelect=()=>{
      document.getElementById('nutr-search-overlay')?.remove();
      _showPortionModal(food, mealIndex, dayKey);
    };
    row.ontouchstart=e=>{e.preventDefault();doSelect();}; row.onclick=doSelect;
    plus.ontouchstart=e=>{e.stopPropagation();}; // pas de preventDefault pour laisser le row gérer

    row.append(thumb,info,plus);
    results.appendChild(row);
  });

  // Indicateur chargement si recherche active
  if(q.length>=2){
    const ld=document.createElement('div');ld.id='nutr-ld';
    ld.style.cssText='padding:14px;text-align:center;color:var(--muted);font-size:12px';ld.textContent='Recherche en cours…';
    results.appendChild(ld);
  }
}

/* ── Fetch OpenFoodFacts ── */
async function _fetchOFF(q, overlay, results, mealIndex, dayKey, inp, signal) {
  try {
    const url='https://world.openfoodfacts.org/cgi/search.pl?search_terms='+encodeURIComponent(q)
      +'&action=process&json=1&lc=fr&cc=fr&page_size=10'
      +'&fields=product_name_fr,product_name,image_small_url,nutriments';
    const resp = await fetch(url,{signal});
    if(!resp.ok) return;
    const data = await resp.json();
    const remote = (data.products||[])
      .filter(p=>p.nutriments?.['energy-kcal_100g']>0 && (p.product_name_fr||p.product_name))
      .map(p=>({
        n:    p.product_name_fr||p.product_name,
        cal:  Math.round(p.nutriments['energy-kcal_100g']||0),
        prot: Math.round(p.nutriments['proteins_100g']||0),
        carbs:Math.round(p.nutriments['carbohydrates_100g']||0),
        fat:  Math.round(p.nutriments['fat_100g']||0),
        imageUrl: p.image_small_url||null,
      }));
    if(document.getElementById('nutr-search-overlay'))
      _renderFoodResults(overlay, results, mealIndex, dayKey, inp, remote);
  } catch(e){
    if(e.name!=='AbortError') document.getElementById('nutr-ld')?.remove();
  }
}

/* ================================================================
   _showPortionModal — saisie portion (style image 3)
   ================================================================ */
function _showPortionModal(food, mealIndex, dayKey) {
  document.getElementById('portion-overlay')?.remove();

  const overlay=document.createElement('div');overlay.id='portion-overlay';
  overlay.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5);z-index:9900;display:flex;align-items:flex-end;justify-content:center';

  const sheet=document.createElement('div');
  // padding-bottom couvre la home bar iOS
  sheet.style.cssText='background:var(--surface);border-radius:24px 24px 0 0;width:100%;max-width:520px;display:flex;flex-direction:column;max-height:92vh;overflow:hidden';

  // Handle
  const hdl=document.createElement('div');hdl.style.cssText='width:36px;height:4px;border-radius:2px;background:var(--border);margin:14px auto 0;flex-shrink:0';

  // Food info
  const fhdr=document.createElement('div');fhdr.style.cssText='display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid var(--border);flex-shrink:0';
  const fthumb=document.createElement('div');fthumb.style.cssText='width:56px;height:56px;border-radius:12px;overflow:hidden;flex-shrink:0;background:var(--bg);display:flex;align-items:center;justify-content:center;font-size:28px';
  if(food.imageUrl){const img=document.createElement('img');img.src=food.imageUrl;img.style.cssText='width:100%;height:100%;object-fit:cover';img.onerror=()=>{fthumb.removeChild(img);fthumb.textContent=_foodEmoji(food.n||'');};fthumb.appendChild(img);}
  else fthumb.textContent=food.emoji||_foodEmoji(food.n||food.name||'');
  const finf=document.createElement('div');finf.style.cssText='flex:1;min-width:0';
  const fnm=document.createElement('div');fnm.style.cssText='font-size:15px;font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap';fnm.textContent=food.n||food.name||'';
  const fkc=document.createElement('div');fkc.style.cssText='font-size:12px;color:var(--muted);margin-top:2px';fkc.textContent=_kcal100(food)+'kcal / 100g';
  finf.append(fnm,fkc);fhdr.append(fthumb,finf);

  // Scrollable body (important pour iOS avec clavier ouvert)
  const body=document.createElement('div');
  body.style.cssText='flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;padding-bottom:max(env(safe-area-inset-bottom,20px),20px)';

  // ── Portion ──
  const portSec=document.createElement('div');portSec.style.cssText='padding:20px 16px;border-bottom:1px solid var(--border)';
  const portLbl=document.createElement('div');portLbl.style.cssText='font-size:14px;font-weight:700;color:var(--text);margin-bottom:16px;text-align:center';portLbl.textContent='Taille de la portion';

  // Grammes grand input
  const gWrap=document.createElement('div');gWrap.style.cssText='display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:6px';
  const gInp=document.createElement('input');
  gInp.type='number';gInp.value='100';gInp.min='1';gInp.max='5000';
  gInp.setAttribute('inputmode','decimal');
  gInp.style.cssText='font-family:var(--mono);font-size:48px;font-weight:800;color:var(--text);border:none;border-bottom:2.5px solid var(--teal);background:transparent;text-align:right;width:130px;-webkit-appearance:none;outline:none;padding:0';
  const gUnit=document.createElement('span');gUnit.style.cssText='font-size:20px;color:var(--muted);font-weight:600;padding-bottom:4px';gUnit.textContent='g';
  gWrap.append(gInp,gUnit);

  // Preview kcal
  const prev=document.createElement('div');prev.style.cssText='text-align:center;font-size:17px;font-weight:700;color:var(--muted);margin-bottom:16px';
  const updatePrev=()=>{
    const g=parseFloat(gInp.value)||0;
    prev.textContent=Math.round((food.cal||0)*g/100)+' kcal';
  };
  updatePrev();
  gInp.addEventListener('input',updatePrev);

  // Unités (cosmétique)
  const uRow=document.createElement('div');uRow.style.cssText='display:flex;gap:6px;justify-content:center;flex-wrap:wrap';
  let activeUnit='g';
  [['oz',28.35],['ml',1],['g',1],['fl.oz',29.57]].forEach(([lbl,factor])=>{
    const b=document.createElement('button');
    const isSel=lbl===activeUnit;
    b.style.cssText=`padding:7px 14px;border-radius:10px;border:1.5px solid ${isSel?'var(--teal)':'var(--border)'};background:transparent;color:${isSel?'var(--teal)':'var(--muted)'};font-size:13px;font-weight:${isSel?700:500};font-family:var(--font);cursor:pointer;touch-action:manipulation;-webkit-appearance:none`;
    b.textContent=lbl;
    const doU=()=>{
      // Convertit la valeur courante vers la nouvelle unité
      const prevG = (parseFloat(gInp.value)||0) * (activeUnit==='oz'?28.35:activeUnit==='fl.oz'?29.57:1);
      activeUnit=lbl;
      gInp.value=prevG>0 ? (prevG/factor).toFixed(lbl==='g'?0:1) : (lbl==='g'?'100':'3.5');
      gUnit.textContent=lbl;
      updatePrev();
      uRow.querySelectorAll('button').forEach((bb,ii)=>{
        const s=[['oz',28.35],['ml',1],['g',1],['fl.oz',29.57]][ii][0];
        bb.style.borderColor=s===lbl?'var(--teal)':'var(--border)';
        bb.style.color=s===lbl?'var(--teal)':'var(--muted)';
        bb.style.fontWeight=s===lbl?'700':'500';
      });
    };
    b.ontouchstart=e=>{e.preventDefault();doU();}; b.onclick=doU;
    uRow.appendChild(b);
  });

  portSec.append(portLbl,gWrap,prev,uRow);

  // ── Repas ──
  const mealSec=document.createElement('div');mealSec.style.cssText='padding:14px 16px;border-bottom:1px solid var(--border)';
  const mLbl=document.createElement('div');mLbl.style.cssText='font-size:14px;font-weight:700;color:var(--text);margin-bottom:10px';mLbl.textContent='Repas';
  const mRow=document.createElement('div');mRow.style.cssText='display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;padding-bottom:2px';
  let selMeal=mealIndex;
  const mBtns=[];
  MEAL_LABELS.forEach((name,mi)=>{
    const b=document.createElement('button');
    const sel=mi===mealIndex;
    b.style.cssText=`display:flex;align-items:center;gap:5px;padding:8px 14px;border-radius:12px;border:none;font-size:13px;font-weight:700;font-family:var(--font);cursor:pointer;touch-action:manipulation;-webkit-appearance:none;white-space:nowrap;flex-shrink:0;background:${sel?'rgba(91,168,160,.15)':'var(--bg)'};color:${sel?'var(--teal-d)':'var(--muted)'}`;
    b.textContent=MEAL_ICONS[mi]+' '+name;
    const doM=()=>{
      selMeal=mi;
      mBtns.forEach((bb,i)=>{bb.style.background=i===mi?'rgba(91,168,160,.15)':'var(--bg)';bb.style.color=i===mi?'var(--teal-d)':'var(--muted)';});
    };
    b.ontouchstart=e=>{e.preventDefault();doM();}; b.onclick=doM;
    mBtns.push(b);mRow.appendChild(b);
  });
  mealSec.append(mLbl,mRow);

  // ── Confirmer ──
  const confBtn=document.createElement('button');
  confBtn.style.cssText='display:block;width:calc(100% - 32px);margin:16px;padding:16px;border-radius:16px;border:none;background:var(--teal);color:#fff;font-size:16px;font-weight:700;font-family:var(--font);cursor:pointer;touch-action:manipulation;-webkit-appearance:none;-webkit-appearance:none;flex-shrink:0';
  confBtn.textContent='Confirmer';

  const doConf=()=>{
    // Convertir en grammes
    const uFactor = activeUnit==='oz'?28.35:activeUnit==='fl.oz'?29.57:1;
    const g = (parseFloat(gInp.value)||100) * uFactor;
    const r = g/100;
    const item={
      name:    food.n||food.name||'',
      weight:  Math.round(g),
      cal:     Math.round((food.cal||0)*r),
      protein: Math.round((food.prot||food.protein||0)*r*10)/10,
      carbs:   Math.round((food.carbs||0)*r*10)/10,
      fat:     Math.round((food.fat||0)*r*10)/10,
      imageUrl:food.imageUrl||null,
      emoji:   food.emoji||_foodEmoji(food.n||food.name||''),
    };
    // Persist via Store
    const calState=Store.getState().activity.calories;
    if(!calState[dayKey]) calState[dayKey]={meals:[{items:[]},{items:[]},{items:[]},{items:[]}]};
    while(calState[dayKey].meals.length<4) calState[dayKey].meals.push({items:[]});
    calState[dayKey].meals[selMeal].items.push(item);
    save();
    overlay.remove();
    renderCalTracker();
    showToast(item.name+' · '+item.cal+' kcal','save',2000);
  };
  confBtn.ontouchstart=e=>{e.preventDefault();doConf();}; confBtn.onclick=doConf;

  body.append(portSec,mealSec);
  sheet.append(hdl,fhdr,body,confBtn);
  overlay.appendChild(sheet);

  // Fermer sur tap backdrop
  overlay.ontouchstart=e=>{if(e.target===overlay)overlay.remove();};
  overlay.onclick=e=>{if(e.target===overlay)overlay.remove();};
  document.body.appendChild(overlay);

  // Focus sur le champ grammes avec délai (iOS)
  setTimeout(()=>{gInp.focus();gInp.select();},300);
}

/* ================================================================
   _showManualAddForm — saisie manuelle
   ================================================================ */
function _showManualAddForm(mealIndex, dayKey, prefill) {
  document.getElementById('manual-overlay')?.remove();
  const ov=document.createElement('div');ov.id='manual-overlay';
  ov.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5);z-index:9900;display:flex;align-items:flex-end;justify-content:center';
  const sh=document.createElement('div');sh.style.cssText='background:var(--surface);border-radius:24px 24px 0 0;width:100%;max-width:520px;padding:16px 16px max(env(safe-area-inset-bottom,20px),20px)';

  const hdl=document.createElement('div');hdl.style.cssText='width:36px;height:4px;border-radius:2px;background:var(--border);margin:0 auto 16px';
  const ttl=document.createElement('div');ttl.style.cssText='font-size:16px;font-weight:700;color:var(--text);margin-bottom:14px';ttl.textContent='Créer un aliment';

  const mkI=(ph,type,val)=>{
    const i=document.createElement('input');i.type=type||'text';i.placeholder=ph;if(val)i.value=val;
    i.style.cssText='width:100%;padding:12px 14px;border-radius:12px;border:1.5px solid var(--border);background:var(--bg);font-size:16px;font-family:var(--font);color:var(--text);-webkit-appearance:none;outline:none;box-sizing:border-box;margin-bottom:8px';
    return i;
  };
  const nI=mkI('Nom de l\'aliment','text',prefill);
  const cI=mkI('Calories (kcal/100g)','number');
  const pI=mkI('Protéines g/100g','number');
  const gI2=mkI('Glucides g/100g','number');
  const fI=mkI('Lipides g/100g','number');
  const wI=mkI('Poids consommé (g)','number','100');

  const row=document.createElement('div');row.style.cssText='display:flex;gap:8px;margin-top:4px';
  const cBt=document.createElement('button');cBt.textContent='Annuler';cBt.style.cssText='flex:1;padding:14px;border-radius:14px;border:1.5px solid var(--border);background:transparent;color:var(--muted);font-size:14px;font-weight:700;font-family:var(--font);cursor:pointer;touch-action:manipulation;-webkit-appearance:none';
  const aBt=document.createElement('button');aBt.textContent='Ajouter';aBt.style.cssText='flex:2;padding:14px;border-radius:14px;border:none;background:var(--teal);color:#fff;font-size:14px;font-weight:700;font-family:var(--font);cursor:pointer;touch-action:manipulation;-webkit-appearance:none';

  const doA=()=>{
    const name=nI.value.trim();const cal100=parseFloat(cI.value)||0;const w=parseFloat(wI.value)||100;
    if(!name||!cal100){showToast('Nom et calories requis','warn');return;}
    const r=w/100;
    const calState=Store.getState().activity.calories;
    if(!calState[dayKey])calState[dayKey]={meals:[{items:[]},{items:[]},{items:[]},{items:[]}]};
    while(calState[dayKey].meals.length<4)calState[dayKey].meals.push({items:[]});
    calState[dayKey].meals[mealIndex].items.push({name,weight:Math.round(w),cal:Math.round(cal100*r),protein:Math.round((parseFloat(pI.value)||0)*r*10)/10,carbs:Math.round((parseFloat(gI2.value)||0)*r*10)/10,fat:Math.round((parseFloat(fI.value)||0)*r*10)/10,emoji:_foodEmoji(name)});
    save();ov.remove();renderCalTracker();showToast(name+' ajouté','save',2000);
  };
  aBt.ontouchstart=e=>{e.preventDefault();doA();}; aBt.onclick=doA;
  cBt.ontouchstart=e=>{e.preventDefault();ov.remove();}; cBt.onclick=()=>ov.remove();
  row.append(cBt,aBt);
  sh.append(hdl,ttl,nI,cI,pI,gI2,fI,wI,row);
  ov.appendChild(sh);
  ov.ontouchstart=e=>{if(e.target===ov)ov.remove();};ov.onclick=e=>{if(e.target===ov)ov.remove();};
  document.body.appendChild(ov);
  setTimeout(()=>nI.focus(),200);
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


function renderCorps(){
  // Inputs profil — guard sur l'élément (dataset) pour survivre aux rechargements SW
  const profilInp  = document.getElementById('profil-taille');
  const poignetInp = document.getElementById('profil-poignet');
  const sexeSelC   = document.getElementById('profil-sexe');
  const ageInp     = document.getElementById('profil-age');

  // Mettre à jour les valeurs
  if(profilInp)  profilInp.value  = S.profilTaille  || '';
  if(poignetInp) poignetInp.value = S.profilPoignet || 17;
  if(sexeSelC)   sexeSelC.value   = S.profilSexe    || 'H';
  if(ageInp)     ageInp.value     = S.profilAge     || 30;

  // Attacher les listeners — guard sur l'élément lui-même (résiste aux rechargements)
  if(profilInp  && !profilInp._bound)  { profilInp._bound  = true; profilInp.addEventListener('input',  e=>{S.profilTaille=parseInt(e.target.value)||0;save();renderCorps();}); }
  if(poignetInp && !poignetInp._bound) { poignetInp._bound = true; poignetInp.addEventListener('input', e=>{S.profilPoignet=parseFloat(e.target.value)||17;save();renderCorps();}); }
  if(sexeSelC   && !sexeSelC._bound)   { sexeSelC._bound   = true; sexeSelC.addEventListener('change',  e=>{S.profilSexe=e.target.value;save();renderCorps();}); }
  if(ageInp     && !ageInp._bound)     { ageInp._bound     = true; ageInp.addEventListener('input',     e=>{S.profilAge=parseInt(e.target.value)||30;save();}); }
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
