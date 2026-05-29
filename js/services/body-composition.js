/* ================================================================
   body-composition.js
   
   1. Silhouette corporelle SVG avec mesures positionnées
   2. Slider objectif par mensuration
   3. Tracker d'eau journalier
   4. Composition corporelle enrichie (BMR, âge métabolique, masse)
   5. Suivi poids avec objectif et % progression
   6. Renpho via HealthKit — types additionnels
   ================================================================ */

'use strict';

/* ════════════════════════════════════════════════════════════════
   1. SILHOUETTE CORPORELLE SVG
   ════════════════════════════════════════════════════════════════ */

window.renderBodySilhouette = function(containerEl) {
  if (!containerEl) return;
  containerEl.innerHTML = '';

  const getLatest = (key) => {
    const entries = (S.mesures?.[key] || []).slice().sort((a,b)=>a.date.localeCompare(b.date));
    const last = entries[entries.length - 1];
    return last ? parseFloat(last.val || last.value) || null : null;
  };

  const getObj = (key) => {
    const custom = S.mesureObjectifs?.[key];
    if (custom) return custom;
    if (typeof calcMesureObjectif === 'function') {
      const def = calcMesureObjectif(key);
      return def ? def.athlétique : null;
    }
    return null;
  };

  // Valeurs actuelles
  const vals = {
    cou:      getLatest('cou'),
    bras:     getLatest('bras'),
    brasG:    getLatest('bras-g'),
    poitrine: getLatest('poitrine'),
    taille:   getLatest('taille'),
    hanches:  getLatest('hanches'),
    cuisse:   getLatest('cuisse'),
    cuisseG:  getLatest('cuisse-g'),
    mollet:   getLatest('mollet'),
    molletG:  getLatest('mollet-g'),
  };

  // Couleur selon proximité objectif
  function getColor(key, val) {
    if (!val) return 'var(--muted)';
    const obj = getObj(key);
    if (!obj) return 'var(--teal-d)';
    const diff = Math.abs(val - obj) / obj;
    if (diff < 0.03) return '#38a169'; // ≤3% → vert
    if (diff < 0.10) return '#d69e2e'; // ≤10% → jaune
    return '#e53e3e'; // >10% → rouge
  }

  function label(key, val, unit='cm') {
    if (!val) return '—';
    return val.toFixed(1) + unit;
  }

  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:relative;width:100%;max-width:380px;margin:0 auto;user-select:none';

  // SVG silhouette
  const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 380 520');
  svg.setAttribute('xmlns','http://www.w3.org/2000/svg');
  svg.style.cssText = 'width:100%;display:block';

  // Corps silhouette SVG path (simplifié, style référence)
  const silhouettePath = `
    M190,30 C175,30 160,45 158,62 C156,78 162,90 162,100
    C150,110 135,115 128,130 C118,148 115,168 112,190
    C108,215 106,240 108,262 C110,275 115,285 115,300
    C112,325 108,345 105,368 C102,388 100,408 100,430
    C100,450 105,465 115,470 C128,472 138,462 142,448
    C146,434 148,418 150,400 C152,382 154,362 156,345
    C160,330 162,320 165,310
    C168,320 170,330 174,345 C176,362 178,382 180,400
    C182,418 184,434 188,448 C192,462 202,472 215,470
    C225,465 230,450 230,430 C230,408 228,388 225,368
    C222,345 218,325 215,300 C215,285 220,275 222,262
    C224,240 222,215 218,190 C215,168 212,148 202,130
    C195,115 180,110 168,100
    C168,90 174,78 172,62 C170,45 205,30 190,30 Z
  `;

  const bodyFill = document.createElementNS('http://www.w3.org/2000/svg','path');
  bodyFill.setAttribute('d', silhouettePath);
  bodyFill.setAttribute('fill', 'rgba(91,168,160,0.15)');
  bodyFill.setAttribute('stroke', 'rgba(91,168,160,0.6)');
  bodyFill.setAttribute('stroke-width', '1.5');
  svg.appendChild(bodyFill);

  // Tête
  const head = document.createElementNS('http://www.w3.org/2000/svg','circle');
  head.setAttribute('cx','190'); head.setAttribute('cy','22'); head.setAttribute('r','20');
  head.setAttribute('fill','rgba(91,168,160,0.2)'); head.setAttribute('stroke','rgba(91,168,160,0.6)'); head.setAttribute('stroke-width','1.5');
  svg.appendChild(head);

  wrapper.appendChild(svg);

  // Labels positionnés autour de la silhouette
  const measures = [
    { key:'cou',      val:vals.cou,      label:'Cou',       x:'50%', y:'12%',  anchor:'center',  line:{x1:190,y1:55,x2:190,y2:42} },
    { key:'poitrine', val:vals.poitrine, label:'Poitrine',  x:'5%',  y:'25%',  anchor:'left',    line:{x1:115,y1:130,x2:140,y2:130} },
    { key:'taille',   val:vals.taille,   label:'Taille',    x:'72%', y:'40%',  anchor:'left',    line:{x1:218,y1:210,x2:210,y2:210} },
    { key:'hanches',  val:vals.hanches,  label:'Hanches',   x:'5%',  y:'52%',  anchor:'left',    line:{x1:108,y1:270,x2:135,y2:270} },
    { key:'bras',     val:vals.bras,     label:'Bras D',    x:'72%', y:'28%',  anchor:'left',    line:{x1:210,y1:145,x2:205,y2:145} },
    { key:'bras-g',   val:vals.brasG,    label:'Bras G',    x:'5%',  y:'28%',  anchor:'left',    line:{x1:128,y1:145,x2:145,y2:145} },
    { key:'cuisse',   val:vals.cuisse,   label:'Cuisse D',  x:'62%', y:'65%',  anchor:'left',    line:{x1:215,y1:340,x2:208,y2:340} },
    { key:'cuisse-g', val:vals.cuisseG,  label:'Cuisse G',  x:'5%',  y:'65%',  anchor:'left',    line:{x1:108,y1:340,x2:148,y2:340} },
    { key:'mollet',   val:vals.mollet,   label:'Mollet D',  x:'62%', y:'80%',  anchor:'left',    line:{x1:215,y1:415,x2:208,y2:415} },
    { key:'mollet-g', val:vals.molletG,  label:'Mollet G',  x:'5%',  y:'80%',  anchor:'left',    line:{x1:108,y1:415,x2:148,y2:415} },
  ];

  measures.forEach(m => {
    const color = getColor(m.key, m.val);
    const displayVal = m.val ? m.val.toFixed(1) + ' cm' : '—';
    const obj = getObj(m.key);

    // Ligne de connexion SVG
    if (m.line && m.val) {
      const line = document.createElementNS('http://www.w3.org/2000/svg','line');
      line.setAttribute('x1', m.line.x1); line.setAttribute('y1', m.line.y1);
      line.setAttribute('x2', m.line.x2); line.setAttribute('y2', m.line.y2);
      line.setAttribute('stroke', color); line.setAttribute('stroke-width', '1.5');
      line.setAttribute('stroke-dasharray', '3,2');
      svg.appendChild(line);

      // Point sur le corps
      const dot = document.createElementNS('http://www.w3.org/2000/svg','circle');
      dot.setAttribute('cx', m.line.x1); dot.setAttribute('cy', m.line.y1); dot.setAttribute('r', '3');
      dot.setAttribute('fill', color);
      svg.appendChild(dot);
    }

    // Label HTML
    const labelDiv = document.createElement('div');
    labelDiv.style.cssText = `
      position:absolute;left:${m.x};top:${m.y};transform:translateY(-50%);
      cursor:pointer;
    `;
    const card = document.createElement('div');
    card.style.cssText = `
      background:var(--card);border:1.5px solid ${color};border-radius:10px;
      padding:4px 8px;min-width:70px;
      ${m.anchor === 'left' ? '' : 'text-align:center;transform:translateX(-50%)'}
    `;
    const nm = document.createElement('div');
    nm.style.cssText = 'font-size:9px;font-weight:700;text-transform:uppercase;color:var(--muted);letter-spacing:.04em';
    nm.textContent = m.label;
    const vl = document.createElement('div');
    vl.style.cssText = `font-size:13px;font-weight:800;font-family:var(--mono);color:${color}`;
    vl.textContent = displayVal;
    card.appendChild(nm); card.appendChild(vl);

    // Objectif si défini
    if (obj && m.val) {
      const objLine = document.createElement('div');
      objLine.style.cssText = 'font-size:8px;color:var(--muted);margin-top:1px';
      objLine.textContent = '→ ' + obj + 'cm';
      card.appendChild(objLine);
    }

    // Tap → ouvrir slider objectif
    const doTap = () => _showObjectifSlider(m.key, m.label, m.val, obj);
    card.ontouchstart = (e) => { e.preventDefault(); doTap(); };
    card.onclick = doTap;
    labelDiv.appendChild(card);
    wrapper.appendChild(labelDiv);
  });

  containerEl.appendChild(wrapper);

  // Légende couleurs
  const legend = document.createElement('div');
  legend.style.cssText = 'display:flex;justify-content:center;gap:12px;margin-top:10px;flex-wrap:wrap';
  [['#38a169','≤3% de l\'objectif'],['#d69e2e','≤10%'],['#e53e3e','>10%'],['var(--muted)','Non mesuré']].forEach(([col,lbl])=>{
    const item = document.createElement('div');
    item.style.cssText = 'display:flex;align-items:center;gap:4px;font-size:10px;color:var(--muted)';
    const dot = document.createElement('span');
    dot.style.cssText = `width:8px;height:8px;border-radius:50%;background:${col};flex-shrink:0`;
    item.appendChild(dot); item.appendChild(document.createTextNode(lbl));
    legend.appendChild(item);
  });
  containerEl.appendChild(legend);
};


/* ════════════════════════════════════════════════════════════════
   2. SLIDER OBJECTIF PAR MENSURATION
   ════════════════════════════════════════════════════════════════ */

window._showObjectifSlider = function(key, label, currentVal, currentObj) {
  document.getElementById('obj-slider-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'obj-slider-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.55);z-index:9400;display:flex;align-items:flex-end;justify-content:center';

  const sheet = document.createElement('div');
  sheet.style.cssText = 'background:var(--surface);border-radius:24px 24px 0 0;padding:20px 16px calc(24px + env(safe-area-inset-bottom,0px));width:100%;max-width:480px';

  const handle = document.createElement('div');
  handle.style.cssText = 'width:36px;height:4px;border-radius:2px;background:var(--border);margin:0 auto 14px';

  const title = document.createElement('div');
  title.style.cssText = 'font-size:16px;font-weight:700;color:var(--text);margin-bottom:4px';
  title.textContent = 'Objectif — ' + label;

  const current = document.createElement('div');
  current.style.cssText = 'font-size:11px;color:var(--muted);margin-bottom:16px';
  current.textContent = currentVal ? 'Actuel : ' + currentVal.toFixed(1) + ' cm' : 'Aucune mesure';

  // Valeur affichée en grand
  const bigVal = document.createElement('div');
  bigVal.style.cssText = 'text-align:center;font-family:var(--mono);font-size:42px;font-weight:800;color:var(--teal);margin-bottom:4px';

  const bigUnit = document.createElement('div');
  bigUnit.style.cssText = 'text-align:center;font-size:12px;color:var(--muted);margin-bottom:20px';
  bigUnit.textContent = 'cm · Objectif';

  // Déterminer plage selon la mensuration
  const ranges = {
    cou: [30,55], bras:[25,55], 'bras-g':[25,55],
    poitrine:[80,140], taille:[55,120], hanches:[70,130],
    cuisse:[40,80], 'cuisse-g':[40,80], mollet:[25,55], 'mollet-g':[25,55], poids:[40,200]
  };
  const [minV, maxV] = ranges[key] || [20, 150];
  let objVal = currentObj || (currentVal ? Math.round(currentVal * 0.95) : Math.round((minV+maxV)/2));

  bigVal.textContent = objVal.toFixed(1);

  // Range slider stylisé
  const sliderWrap = document.createElement('div');
  sliderWrap.style.cssText = 'padding:0 8px;margin-bottom:8px';

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = minV; slider.max = maxV; slider.step = '0.5';
  slider.value = objVal;
  slider.style.cssText = 'width:100%;-webkit-appearance:none;height:6px;border-radius:3px;outline:none;background:linear-gradient(to right,var(--teal) '+((objVal-minV)/(maxV-minV)*100)+'%,var(--border) '+((objVal-minV)/(maxV-minV)*100)+'%);touch-action:none';

  slider.addEventListener('input', () => {
    objVal = parseFloat(slider.value);
    bigVal.textContent = objVal.toFixed(1);
    const pct = (objVal - minV) / (maxV - minV) * 100;
    slider.style.background = `linear-gradient(to right,var(--teal) ${pct}%,var(--border) ${pct}%)`;
  });

  // Afficher le min/max
  const rangeRow = document.createElement('div');
  rangeRow.style.cssText = 'display:flex;justify-content:space-between;font-size:10px;color:var(--muted);margin-top:4px';
  const rMin = document.createElement('span'); rMin.textContent = minV + ' cm';
  const rMax = document.createElement('span'); rMax.textContent = maxV + ' cm';
  rangeRow.appendChild(rMin); rangeRow.appendChild(rMax);

  sliderWrap.appendChild(slider); sliderWrap.appendChild(rangeRow);

  // Suggestions rapides
  const suggestions = document.createElement('div');
  suggestions.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px';

  if (typeof calcMesureObjectif === 'function') {
    const def = calcMesureObjectif(key);
    if (def) {
      [['Santé', def.santé], ['Athlétique', def.athlétique]].forEach(([lbl2, v2]) => {
        if (!v2) return;
        const chip = document.createElement('button');
        chip.style.cssText = 'padding:5px 12px;border-radius:8px;border:1px solid var(--teal);background:transparent;color:var(--teal-d);font-size:11px;font-weight:600;font-family:var(--font);cursor:pointer;touch-action:manipulation;-webkit-appearance:none';
        chip.textContent = lbl2 + ': ' + v2 + 'cm';
        const doChip = () => {
          slider.value = v2; objVal = v2;
          bigVal.textContent = v2.toFixed(1);
          const pct = (v2 - minV) / (maxV - minV) * 100;
          slider.style.background = `linear-gradient(to right,var(--teal) ${pct}%,var(--border) ${pct}%)`;
        };
        chip.ontouchstart=(e)=>{e.preventDefault();doChip();}; chip.onclick=doChip;
        suggestions.appendChild(chip);
      });
    }
  }

  // Boutons
  const btns = document.createElement('div');
  btns.style.cssText = 'display:flex;gap:8px';

  const saveBtn = document.createElement('button');
  saveBtn.style.cssText = 'flex:2;padding:13px;border-radius:14px;border:none;background:var(--teal);color:#fff;font-size:15px;font-weight:700;font-family:var(--font);cursor:pointer;touch-action:manipulation;-webkit-appearance:none';
  saveBtn.textContent = 'Enregistrer';

  const cancelBtn = document.createElement('button');
  cancelBtn.style.cssText = 'flex:1;padding:13px;border-radius:14px;border:1.5px solid var(--border);background:transparent;color:var(--muted);font-size:14px;font-weight:700;font-family:var(--font);cursor:pointer;touch-action:manipulation;-webkit-appearance:none';
  cancelBtn.textContent = 'Annuler';

  const doSave = () => {
    if (!S.mesureObjectifs) S.mesureObjectifs = {};
    S.mesureObjectifs[key] = objVal;
    save();
    overlay.remove();
    if (typeof renderCorps === 'function') renderCorps();
    if (typeof showToast === 'function') showToast('Objectif ' + label + ' : ' + objVal + ' cm', 'save', 2000);
  };
  saveBtn.ontouchstart=(e)=>{e.preventDefault();doSave();}; saveBtn.onclick=doSave;
  cancelBtn.ontouchstart=(e)=>{e.preventDefault();overlay.remove();}; cancelBtn.onclick=()=>overlay.remove();
  btns.appendChild(cancelBtn); btns.appendChild(saveBtn);

  sheet.append(handle,title,current,bigVal,bigUnit,sliderWrap,suggestions,btns);
  overlay.appendChild(sheet);
  overlay.ontouchstart=(e)=>{if(e.target===overlay)overlay.remove();};
  overlay.onclick=(e)=>{if(e.target===overlay)overlay.remove();};
  document.body.appendChild(overlay);
};


/* ════════════════════════════════════════════════════════════════
   3. TRACKER D'EAU
   ════════════════════════════════════════════════════════════════ */

window.renderWaterTracker = function(containerEl) {
  if (!containerEl) return;
  containerEl.innerHTML = '';

  const today = typeof localDateStr === 'function' ? localDateStr() : new Date().toISOString().slice(0,10);
  if (!S.water) S.water = { daily:{}, goal:2500 };
  const current = parseInt(S.water.daily?.[today] || 0);
  const goal    = parseInt(S.water.goal || 2500);
  const pct     = Math.min(100, Math.round(current / goal * 100));

  const wrap = document.createElement('div');
  wrap.style.cssText = 'background:var(--card);border-radius:18px;padding:16px;border:1px solid var(--border)';

  // Header
  const hdr = document.createElement('div');
  hdr.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:14px';
  const htitle = document.createElement('div');
  htitle.style.cssText = 'font-size:15px;font-weight:700;color:var(--text)';
  htitle.textContent = '💧 Hydratation';
  const goalBtn = document.createElement('button');
  goalBtn.style.cssText = 'border:none;background:none;font-size:11px;color:var(--muted);cursor:pointer;touch-action:manipulation;-webkit-appearance:none';
  goalBtn.textContent = 'Objectif: ' + (goal/1000).toFixed(1) + 'L';
  goalBtn.onclick = () => {
    const newGoal = prompt('Objectif eau (ml) :', goal);
    if (newGoal && !isNaN(newGoal)) {
      S.water.goal = parseInt(newGoal);
      save(); renderWaterTracker(containerEl);
    }
  };
  hdr.appendChild(htitle); hdr.appendChild(goalBtn);

  // Progress visual — verre d'eau animé
  const glassWrap = document.createElement('div');
  glassWrap.style.cssText = 'display:flex;align-items:center;gap:16px;margin-bottom:14px';

  const glass = document.createElement('div');
  glass.style.cssText = 'width:52px;height:70px;border:2.5px solid var(--blue,#3182ce);border-top:none;border-radius:0 0 12px 12px;position:relative;overflow:hidden;flex-shrink:0;background:transparent';
  const fill = document.createElement('div');
  fill.style.cssText = `position:absolute;bottom:0;left:0;right:0;height:${pct}%;background:rgba(49,130,206,0.35);transition:height .6s ease;border-radius:0 0 10px 10px`;
  glass.appendChild(fill);

  const info = document.createElement('div');
  info.style.cssText = 'flex:1';
  const mainNum = document.createElement('div');
  mainNum.style.cssText = 'font-family:var(--mono);font-size:28px;font-weight:800;color:var(--blue,#3182ce)';
  mainNum.textContent = (current/1000).toFixed(2) + 'L';
  const sub = document.createElement('div');
  sub.style.cssText = 'font-size:11px;color:var(--muted)';
  sub.textContent = current + 'ml / ' + goal + 'ml (' + pct + '%)';
  const bar = document.createElement('div');
  bar.style.cssText = 'height:5px;background:var(--border);border-radius:3px;overflow:hidden;margin-top:6px';
  const barFill = document.createElement('div');
  barFill.style.cssText = `height:100%;width:${pct}%;background:var(--blue,#3182ce);border-radius:3px;transition:width .6s`;
  bar.appendChild(barFill);
  info.append(mainNum, sub, bar);
  glassWrap.append(glass, info);

  // Boutons d'ajout rapide
  const addRow = document.createElement('div');
  addRow.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:6px';
  [['150ml','150'],['250ml','250'],['500ml','500'],['750ml','750']].forEach(([lbl3,ml])=>{
    const btn = document.createElement('button');
    btn.style.cssText = 'padding:10px 4px;border-radius:10px;border:1.5px solid var(--border);background:var(--bg);color:var(--text);font-size:12px;font-weight:700;font-family:var(--font);cursor:pointer;touch-action:manipulation;-webkit-appearance:none';
    btn.textContent = '+' + lbl3;
    const doAdd = () => {
      if (!S.water.daily) S.water.daily = {};
      S.water.daily[today] = (S.water.daily[today] || 0) + parseInt(ml);
      save(); renderWaterTracker(containerEl);
    };
    btn.ontouchstart=(e)=>{e.preventDefault();doAdd();}; btn.onclick=doAdd;
    addRow.appendChild(btn);
  });

  // Réinitialiser
  const resetBtn = document.createElement('button');
  resetBtn.style.cssText = 'width:100%;margin-top:6px;padding:8px;border:none;background:none;color:var(--muted);font-size:11px;font-family:var(--font);cursor:pointer;touch-action:manipulation;-webkit-appearance:none';
  resetBtn.textContent = 'Réinitialiser aujourd\'hui';
  resetBtn.onclick=()=>{if(S.water.daily)S.water.daily[today]=0;save();renderWaterTracker(containerEl);};

  wrap.append(hdr,glassWrap,addRow,resetBtn);
  containerEl.appendChild(wrap);
};


/* ════════════════════════════════════════════════════════════════
   4. COMPOSITION CORPORELLE ENRICHIE
   ════════════════════════════════════════════════════════════════ */

window.renderBodyComposition = function(containerEl) {
  if (!containerEl) return;
  containerEl.innerHTML = '';

  const getLatestVal = (key) => {
    const e = (S.mesures?.[key]||[]).slice().sort((a,b)=>a.date.localeCompare(b.date));
    const last = e[e.length-1]; return last ? parseFloat(last.val||last.value)||null : null;
  };

  const weight  = getLatestVal('poids');
  const sex     = S.profilSexe || 'H';
  const age     = S.profilAge  || 30;
  const height  = S.profilTaille || 175;

  // % MG — Renpho en priorité, sinon estimation Navy
  const bfRenpho = S.bodyCompo?.fatPct || null;
  const bfNavy   = typeof calcBodyFat === 'function' ? calcBodyFat() : null;
  const bfPct    = bfRenpho || bfNavy;

  if (!weight) {
    containerEl.innerHTML = '<div style="padding:16px;color:var(--muted);font-size:12px;text-align:center">Renseignez votre poids dans Corps → Mensurations</div>';
    return;
  }

  // Calculs
  const bmi         = weight && height ? Math.round(weight / (height/100)**2 * 10) / 10 : null;
  const fatMassKg    = bfPct && weight ? Math.round(weight * bfPct/100 * 10)/10 : null;
  const leanMassKg   = fatMassKg ? Math.round((weight - fatMassKg)*10)/10 : null;
  const muscleMassKg = S.bodyCompo?.leanMass || (leanMassKg ? Math.round(leanMassKg * 0.75 * 10)/10 : null);

  // BMR Mifflin-St Jeor
  const bmr = sex === 'H'
    ? Math.round(10*weight + 6.25*height - 5*age + 5)
    : Math.round(10*weight + 6.25*height - 5*age - 161);

  // Âge métabolique estimé — comparer BMR au BMR moyen de chaque décennie
  const avgBMRForAge = (a) => sex==='H' ? 1900 - (a-20)*8 : 1500 - (a-20)*7;
  let metaAge = age;
  if (bmr) {
    for (let a=18; a<=80; a++) {
      if (Math.abs(bmr - avgBMRForAge(a)) < Math.abs(bmr - avgBMRForAge(metaAge))) metaAge = a;
    }
  }

  // % eau estimé
  const waterPct = S.bodyCompo?.waterPct || (bfPct ? Math.round((1 - bfPct/100) * 73) : null);

  const metrics = [
    { label:'Poids',         val:weight+'kg',                     sub: bmi?'IMC '+bmi:'',          color:weight>90?'var(--red)':'var(--teal)',   icon:'⚖️' },
    { label:'Masse grasse',  val:bfPct?bfPct+'%':'—',             sub:fatMassKg?fatMassKg+'kg':'',  color:bfPct>25?'var(--orange)':'var(--teal)',  icon:'🔴' },
    { label:'Masse maigre',  val:leanMassKg?leanMassKg+'kg':'—',  sub:'hors masse grasse',           color:'var(--teal)',                           icon:'💪' },
    { label:'Masse muscul.', val:muscleMassKg?muscleMassKg+'kg':'—',sub:S.bodyCompo?.leanMass?'Renpho':'Estimé', color:'#38a169',                icon:'🦾' },
    { label:'BMR',           val:bmr+'kcal',                       sub:'Métabolisme de base',         color:'var(--blue,#3182ce)',                  icon:'🔥' },
    { label:'Âge métabol.', val:metaAge+' ans',                   sub:metaAge<age?'✅ '+Math.abs(metaAge-age)+' ans sous âge réel':metaAge>age?'⚠️ '+Math.abs(metaAge-age)+' ans au-dessus':'= âge réel', color:metaAge<=age?'#38a169':'var(--orange)', icon:'📊' },
    { label:'% Eau',         val:waterPct?waterPct+'%':'—',        sub:'Hydratation corporelle',      color:'var(--blue,#3182ce)',                  icon:'💧' },
    { label:'Graisse visc.', val:S.bodyCompo?.visceralFat?S.bodyCompo.visceralFat:'—', sub:'Objectif <10', color:S.bodyCompo?.visceralFat>10?'var(--red)':'#38a169', icon:'🫁' },
    { label:'IMC',           val:bmi?String(bmi):'—',              sub:bmi?bmi<18.5?'Insuffisant':bmi<25?'Normal':bmi<30?'Surpoids':'Obésité':'', color:bmi&&bmi<25?'#38a169':bmi&&bmi<30?'var(--orange)':'var(--red)', icon:'📏' },
  ];

  const title = document.createElement('div');
  title.style.cssText = 'font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:10px;display:flex;align-items:center;justify-content:space-between';
  const titleLeft = document.createElement('span'); titleLeft.textContent = '🔬 Composition corporelle';
  const renphoHint = document.createElement('span');
  renphoHint.style.cssText = 'font-size:9px;color:var(--teal-d);font-weight:600;cursor:pointer';
  renphoHint.textContent = bfRenpho ? '✅ Renpho' : '⚙ Sync Renpho';
  renphoHint.onclick = () => { if(typeof AppleWatch!=='undefined') AppleWatch.showWatchGuide(); };
  title.appendChild(titleLeft); title.appendChild(renphoHint);
  containerEl.appendChild(title);

  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:8px';

  metrics.forEach(m => {
    const card = document.createElement('div');
    card.style.cssText = 'background:var(--card);border-radius:14px;padding:10px 8px;border:1px solid var(--border);text-align:center';
    const ic = document.createElement('div'); ic.style.cssText='font-size:18px;margin-bottom:4px'; ic.textContent=m.icon;
    const lbl = document.createElement('div'); lbl.style.cssText='font-size:9px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.04em'; lbl.textContent=m.label;
    const val = document.createElement('div'); val.style.cssText=`font-size:16px;font-weight:800;font-family:var(--mono);color:${m.color};margin:3px 0`; val.textContent=m.val;
    const sub = document.createElement('div'); sub.style.cssText='font-size:9px;color:var(--muted);line-height:1.2'; sub.textContent=m.sub;
    card.append(ic,lbl,val,sub);
    grid.appendChild(card);
  });

  containerEl.appendChild(grid);

  // Note source des données
  const note = document.createElement('div');
  note.style.cssText = 'font-size:9px;color:var(--muted);margin-top:8px;text-align:center;font-style:italic';
  note.textContent = bfRenpho
    ? 'Données Renpho via Apple Santé — synchronisez régulièrement'
    : 'Estimations basées sur formule Navy/Mifflin — sync Renpho pour plus de précision';
  containerEl.appendChild(note);
};


/* ════════════════════════════════════════════════════════════════
   5. SUIVI POIDS AVEC OBJECTIF ET PROGRESSION
   ════════════════════════════════════════════════════════════════ */

window.renderWeightProgress = function(containerEl) {
  if (!containerEl) return;
  containerEl.innerHTML = '';

  const entries = (S.mesures?.poids || []).slice().sort((a,b)=>a.date.localeCompare(b.date));
  if (!entries.length) return;

  const current = parseFloat(entries[entries.length-1]?.val || entries[entries.length-1]?.value) || 0;
  const first   = parseFloat(entries[0]?.val || entries[0]?.value) || current;
  const target  = parseFloat(S.objective?.targetWeight) || null;

  const wrap = document.createElement('div');
  wrap.style.cssText = 'background:var(--card);border-radius:18px;padding:16px;border:1px solid var(--border);margin-bottom:12px';

  const hdr2 = document.createElement('div');
  hdr2.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:12px';
  const htitle2 = document.createElement('div');
  htitle2.style.cssText = 'font-size:15px;font-weight:700;color:var(--text)';
  htitle2.textContent = '⚖️ Suivi du poids';
  const setTarget = document.createElement('button');
  setTarget.style.cssText = 'border:none;background:none;font-size:11px;color:var(--teal-d);cursor:pointer;touch-action:manipulation;-webkit-appearance:none;font-weight:700';
  setTarget.textContent = target ? 'Objectif: '+target+'kg' : '+ Objectif';
  setTarget.onclick = () => {
    if (typeof _showObjectifSlider === 'function') _showObjectifSlider('poids','Poids', current, target);
    else {
      const t = prompt('Objectif poids (kg):', target||'');
      if (t && !isNaN(t)) { S.objective.targetWeight = parseFloat(t); save(); renderWeightProgress(containerEl); }
    }
  };
  hdr2.append(htitle2, setTarget);

  // Poids actuel gros
  const mainRow = document.createElement('div');
  mainRow.style.cssText = 'display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:12px';
  const mainLeft = document.createElement('div');
  const mainNum2 = document.createElement('div');
  mainNum2.style.cssText = 'font-family:var(--mono);font-size:38px;font-weight:800;color:var(--text)';
  mainNum2.textContent = current.toFixed(1);
  const mainUnit2 = document.createElement('span');
  mainUnit2.style.cssText = 'font-size:16px;font-weight:400;color:var(--muted)';
  mainUnit2.textContent = ' kg';
  mainNum2.appendChild(mainUnit2);

  // Delta depuis le début
  const delta = current - first;
  const deltaEl = document.createElement('div');
  deltaEl.style.cssText = 'font-size:12px;color:' + (delta < 0 ? '#38a169' : delta > 0 ? 'var(--red)' : 'var(--muted)') + ';margin-top:2px';
  deltaEl.textContent = (delta > 0 ? '+' : '') + delta.toFixed(1) + 'kg depuis le départ';
  mainLeft.append(mainNum2, deltaEl);

  const mainRight = document.createElement('div');
  mainRight.style.cssText = 'text-align:right';
  if (target) {
    const pctVal = first !== target ? Math.max(0, Math.min(100, Math.round((first-current)/(first-target)*100))) : 0;
    const toGo = Math.abs(current - target).toFixed(1);
    const pctEl = document.createElement('div');
    pctEl.style.cssText = 'font-family:var(--mono);font-size:28px;font-weight:800;color:' + (pctVal>=80?'#38a169':pctVal>=40?'var(--teal)':'var(--orange)');
    pctEl.textContent = pctVal + '%';
    const pctSub = document.createElement('div');
    pctSub.style.cssText = 'font-size:10px;color:var(--muted)';
    pctSub.textContent = 'Il reste ' + toGo + 'kg';
    mainRight.append(pctEl, pctSub);
  }
  mainRow.append(mainLeft, mainRight);

  // Barre de progression
  if (target && first !== target) {
    const pctBar = Math.max(0, Math.min(100, Math.round((first-current)/(first-target)*100)));
    const barOuter = document.createElement('div');
    barOuter.style.cssText = 'height:8px;background:var(--border);border-radius:4px;overflow:hidden;margin-bottom:10px';
    const barInner = document.createElement('div');
    barInner.style.cssText = `height:100%;width:${pctBar}%;border-radius:4px;background:linear-gradient(to right,var(--teal),#38a169);transition:width .8s`;
    barOuter.appendChild(barInner);
    wrap.append(hdr2, mainRow, barOuter);

    // Stats
    const statsRow = document.createElement('div');
    statsRow.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:4px';
    [
      ['Départ', first.toFixed(1)+'kg'],
      ['Actuel', current.toFixed(1)+'kg'],
      ['Objectif', target.toFixed(1)+'kg'],
    ].forEach(([lbl4,v4])=>{
      const c4=document.createElement('div');c4.style.cssText='text-align:center;background:var(--bg);border-radius:10px;padding:8px 4px';
      const l4=document.createElement('div');l4.style.cssText='font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em';l4.textContent=lbl4;
      const v4el=document.createElement('div');v4el.style.cssText='font-size:13px;font-weight:700;font-family:var(--mono);color:var(--text);margin-top:2px';v4el.textContent=v4;
      c4.append(l4,v4el); statsRow.appendChild(c4);
    });
    wrap.appendChild(statsRow);
  } else {
    wrap.append(hdr2, mainRow);
    const noTarget = document.createElement('div');
    noTarget.style.cssText = 'font-size:12px;color:var(--muted);text-align:center;padding:8px;background:var(--bg);border-radius:10px';
    noTarget.textContent = 'Appuyez sur "+ Objectif" pour définir votre objectif de poids';
    wrap.appendChild(noTarget);
  }

  containerEl.appendChild(wrap);
};


/* ════════════════════════════════════════════════════════════════
   6. RENPHO VIA HEALTHKIT — Mise à jour du guide + nouveaux params
   ════════════════════════════════════════════════════════════════ */

// Étendre AppleWatch._importWatchData pour recevoir les données Renpho
const _origImportWatchData = typeof AppleWatch !== 'undefined' ? AppleWatch._importWatchData?.bind(AppleWatch) : null;
if (typeof AppleWatch !== 'undefined') {
  AppleWatch._importWatchData = function(data) {
    // Appeler l'original
    if (_origImportWatchData) _origImportWatchData(data);

    // Données Renpho additionnelles
    if (data.fatPct)       { if(!S.bodyCompo)S.bodyCompo={}; S.bodyCompo.fatPct      = data.fatPct; }
    if (data.musclePct)    { if(!S.bodyCompo)S.bodyCompo={}; S.bodyCompo.musclePct   = data.musclePct; }
    if (data.leanMass)     { if(!S.bodyCompo)S.bodyCompo={}; S.bodyCompo.leanMass    = data.leanMass; }
    if (data.boneMass)     { if(!S.bodyCompo)S.bodyCompo={}; S.bodyCompo.boneMass    = data.boneMass; }
    if (data.waterPct)     { if(!S.bodyCompo)S.bodyCompo={}; S.bodyCompo.waterPct    = data.waterPct; }
    if (data.visceralFat)  { if(!S.bodyCompo)S.bodyCompo={}; S.bodyCompo.visceralFat = data.visceralFat; }

    if (typeof save === 'function') save();
  };
}
