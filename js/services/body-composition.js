/* ================================================================
   body-composition.js v2
   
   1. Silhouette — 2 colonnes style Renpho (images 3/6)
   2. Composition corporelle — grille 3×3 avec catégories colorées (image 4)
   3. Suivi poids — jauge circulaire + 3 stats (image 5)
   4. Tracker d'eau
   5. Slider objectif par mensuration
   6. Renpho via HealthKit
   ================================================================ */

'use strict';

/* ────────────────────────────────────────────────────────────────
   HELPERS PARTAGÉS
   ──────────────────────────────────────────────────────────────── */

function _latestMesure(key) {
  const entries = (S.mesures?.[key] || []).slice().sort((a,b)=>a.date.localeCompare(b.date));
  const last = entries[entries.length-1];
  return last ? parseFloat(last.val || last.value) || null : null;
}

function _getObjectif(key) {
  if (S.mesureObjectifs?.[key]) return S.mesureObjectifs[key];
  if (typeof calcMesureObjectif === 'function') {
    const d = calcMesureObjectif(key);
    return d ? d.athlétique : null;
  }
  return null;
}

/* ════════════════════════════════════════════════════════════════
   1. SILHOUETTE CORPORELLE — 2 colonnes (style Renpho images 3/6)
   ════════════════════════════════════════════════════════════════ */

window.renderBodySilhouette = function(containerEl) {
  if (!containerEl) return;
  containerEl.innerHTML = '';

  // Mesures gauche / droite
  const leftMeasures = [
    { key:'cou',       label:'Cou' },
    { key:'bras-g',    label:'Biceps G' },
    { key:'poitrine',  label:'Poitrine' },
    { key:'taille',    label:'Abdomen' },
    { key:'cuisse-g',  label:'Cuisse G' },
    { key:'mollet-g',  label:'Mollet G' },
  ];
  const rightMeasures = [
    { key:'cou',       label:'Épaule',   display:'shoulder' }, // approximation
    { key:'bras',      label:'Biceps D' },
    { key:'hanches',   label:'Taille' },
    { key:'hanches',   label:'Hanche' },
    { key:'cuisse',    label:'Cuisse D' },
    { key:'mollet',    label:'Mollet D' },
  ];

  // Correction — épaule = pas dans nos mesures, on utilise la poitrine comme proxy
  const measDefs = [
    { side:'L', key:'cou',      label:'Cou' },
    { side:'L', key:'bras-g',   label:'Biceps G' },
    { side:'L', key:'poitrine', label:'Poitrine' },
    { side:'L', key:'taille',   label:'Abdomen' },
    { side:'L', key:'cuisse-g', label:'Cuisse G' },
    { side:'L', key:'mollet-g', label:'Mollet G' },
    { side:'R', key:'poitrine', label:'Épaule' },
    { side:'R', key:'bras',     label:'Biceps D' },
    { side:'R', key:'taille',   label:'Taille' },
    { side:'R', key:'hanches',  label:'Hanche' },
    { side:'R', key:'cuisse',   label:'Cuisse D' },
    { side:'R', key:'mollet',   label:'Mollet D' },
  ];

  function chipColor(key, val) {
    if (!val) return { bg:'var(--border)', color:'var(--muted)' };
    const obj = _getObjectif(key);
    if (!obj) return { bg:'rgba(91,168,160,.15)', color:'var(--teal-d)' };
    const diff = Math.abs(val - obj) / obj;
    if (diff < 0.03) return { bg:'rgba(56,161,105,.15)', color:'#38a169' };
    if (diff < 0.10) return { bg:'rgba(214,158,46,.15)', color:'#d69e2e' };
    return { bg:'rgba(229,62,62,.15)', color:'#e53e3e' };
  }

  function makeMeasureCard(m) {
    const val = _latestMesure(m.key);
    const { bg, color } = chipColor(m.key, val);
    const obj = _getObjectif(m.key);

    const card = document.createElement('div');
    card.style.cssText = `
      background:var(--card);border-radius:12px;padding:8px 10px;
      border-left:3px solid ${color};cursor:pointer;
      touch-action:manipulation;
    `;

    const lbl = document.createElement('div');
    lbl.style.cssText = 'font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);margin-bottom:2px';
    lbl.textContent = m.label;

    const valEl = document.createElement('div');
    valEl.style.cssText = `font-size:14px;font-weight:800;font-family:var(--mono);color:${color}`;
    valEl.textContent = val ? val.toFixed(1) + ' cm' : '—';

    card.appendChild(lbl);
    card.appendChild(valEl);

    if (obj && val) {
      const objEl = document.createElement('div');
      objEl.style.cssText = 'font-size:9px;color:var(--muted);margin-top:2px';
      const diff = (val - obj).toFixed(1);
      objEl.textContent = '→ ' + obj + 'cm (' + (diff > 0 ? '+' : '') + diff + ')';
      card.appendChild(objEl);
    }

    const doTap = () => {
      if (typeof _showObjectifSlider === 'function')
        _showObjectifSlider(m.key, m.label, val, obj);
    };
    card.ontouchstart = (e) => { e.preventDefault(); doTap(); };
    card.onclick = doTap;

    return card;
  }

  // Layout principal : 3 colonnes — gauche | silhouette | droite
  const layout = document.createElement('div');
  layout.style.cssText = 'display:grid;grid-template-columns:1fr 90px 1fr;gap:6px;align-items:start;padding:4px 0';

  // Colonne gauche
  const leftCol = document.createElement('div');
  leftCol.style.cssText = 'display:flex;flex-direction:column;gap:6px';
  measDefs.filter(m=>m.side==='L').forEach(m => leftCol.appendChild(makeMeasureCard(m)));

  // Silhouette SVG centrale
  const svgWrap = document.createElement('div');
  svgWrap.style.cssText = 'display:flex;align-items:center;justify-content:center;padding:4px 0';

  const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 80 280');
  svg.style.cssText = 'width:100%;max-width:80px';

  // Silhouette humaine simplifiée style médical
  const body = document.createElementNS('http://www.w3.org/2000/svg','g');
  body.setAttribute('fill','rgba(91,168,160,0.2)');
  body.setAttribute('stroke','rgba(91,168,160,0.7)');
  body.setAttribute('stroke-width','1.2');

  // Tête
  const head = document.createElementNS('http://www.w3.org/2000/svg','ellipse');
  head.setAttribute('cx','40'); head.setAttribute('cy','16'); head.setAttribute('rx','10'); head.setAttribute('ry','12');

  // Cou
  const neck = document.createElementNS('http://www.w3.org/2000/svg','rect');
  neck.setAttribute('x','35'); neck.setAttribute('y','26'); neck.setAttribute('width','10'); neck.setAttribute('height','8'); neck.setAttribute('rx','2');

  // Torse
  const torso = document.createElementNS('http://www.w3.org/2000/svg','path');
  torso.setAttribute('d','M20,34 Q16,60 18,90 L22,90 L22,140 L58,140 L58,90 L62,90 Q64,60 60,34 Z');

  // Bras gauche
  const armL = document.createElementNS('http://www.w3.org/2000/svg','path');
  armL.setAttribute('d','M20,36 Q8,45 6,80 Q6,90 10,95 Q14,100 16,95 Q18,85 18,75 L18,55 Z');

  // Bras droit
  const armR = document.createElementNS('http://www.w3.org/2000/svg','path');
  armR.setAttribute('d','M60,36 Q72,45 74,80 Q74,90 70,95 Q66,100 64,95 Q62,85 62,75 L62,55 Z');

  // Jambe gauche
  const legL = document.createElementNS('http://www.w3.org/2000/svg','path');
  legL.setAttribute('d','M22,140 L22,200 Q22,220 26,230 Q30,238 34,230 Q36,220 36,205 L38,155 Z');

  // Jambe droite
  const legR = document.createElementNS('http://www.w3.org/2000/svg','path');
  legR.setAttribute('d','M58,140 L58,200 Q58,220 54,230 Q50,238 46,230 Q44,220 44,205 L42,155 Z');

  [head,neck,torso,armL,armR,legL,legR].forEach(el => body.appendChild(el));
  svg.appendChild(body);
  svgWrap.appendChild(svg);

  // Colonne droite
  const rightCol = document.createElement('div');
  rightCol.style.cssText = 'display:flex;flex-direction:column;gap:6px';
  measDefs.filter(m=>m.side==='R').forEach(m => rightCol.appendChild(makeMeasureCard(m)));

  layout.appendChild(leftCol);
  layout.appendChild(svgWrap);
  layout.appendChild(rightCol);
  containerEl.appendChild(layout);

  // Légende
  const legend = document.createElement('div');
  legend.style.cssText = 'display:flex;justify-content:center;gap:10px;margin-top:10px;flex-wrap:wrap;padding:0 4px';
  [['#38a169','Objectif atteint'],['#d69e2e','En cours'],['#e53e3e','Loin'],['var(--muted)','Non mesuré']].forEach(([col,lbl])=>{
    const item=document.createElement('div');
    item.style.cssText='display:flex;align-items:center;gap:3px;font-size:9px;color:var(--muted)';
    const dot=document.createElement('span');
    dot.style.cssText=`width:6px;height:6px;border-radius:50%;background:${col};flex-shrink:0;display:inline-block`;
    item.appendChild(dot); item.appendChild(document.createTextNode(lbl));
    legend.appendChild(item);
  });
  containerEl.appendChild(legend);

  // Note : tap sur une mesure pour définir l'objectif
  const hint = document.createElement('div');
  hint.style.cssText = 'text-align:center;font-size:9px;color:var(--muted);margin-top:6px;font-style:italic';
  hint.textContent = 'Appuyez sur une mesure pour définir votre objectif';
  containerEl.appendChild(hint);
};


/* ════════════════════════════════════════════════════════════════
   2. COMPOSITION CORPORELLE — style image 4 (3×3 cartes colorées)
   ════════════════════════════════════════════════════════════════ */

window.renderBodyComposition = function(containerEl) {
  if (!containerEl) return;
  containerEl.innerHTML = '';

  const weight = _latestMesure('poids');
  const sex    = S.profilSexe  || 'H';
  const age    = S.profilAge   || 30;
  const height = S.profilTaille || 175;

  const bfRenpho = S.bodyCompo?.fatPct;
  const bfNavy   = typeof calcBodyFat === 'function' ? calcBodyFat() : null;
  const bfPct    = bfRenpho || bfNavy;

  // BMR Mifflin-St Jeor
  const bmr = weight ? (sex==='H'
    ? Math.round(10*weight + 6.25*height - 5*age + 5)
    : Math.round(10*weight + 6.25*height - 5*age - 161)) : null;

  // Métriques dérivées
  const bmi          = weight&&height ? Math.round(weight/(height/100)**2 *10)/10 : null;
  const fatMassKg    = bfPct&&weight  ? Math.round(weight*bfPct/100 *10)/10 : null;
  const leanMassKg   = fatMassKg      ? Math.round((weight-fatMassKg)*10)/10 : null;
  const muscleMassKg = S.bodyCompo?.leanMass || (leanMassKg ? Math.round(leanMassKg*0.75*10)/10 : null);
  const waterPct     = S.bodyCompo?.waterPct || (bfPct ? Math.round((1-bfPct/100)*73) : null);
  const boneMassKg   = S.bodyCompo?.boneMass || (weight ? Math.round(weight*0.037*10)/10 : null);
  const protPct      = S.bodyCompo?.protPct  || (leanMassKg&&weight ? Math.round(leanMassKg*0.16/weight*100*10)/10 : null);
  const visceral     = S.bodyCompo?.visceralFat;
  const subFatPct    = S.bodyCompo?.subFatPct || (bfPct ? Math.round(bfPct*0.86*10)/10 : null);

  // Âge métabolique estimé
  let metaAge = age;
  if (bmr) {
    const avg = (a) => sex==='H' ? 1900-(a-20)*8 : 1500-(a-20)*7;
    for (let a=18; a<=80; a++) if (Math.abs(bmr-avg(a)) < Math.abs(bmr-avg(metaAge))) metaAge=a;
  }

  // Système de catégories (style Renpho)
  function getCat(type, val, sexe) {
    if (val === null || val === undefined) return { label:'—', color:'var(--muted)', bg:'var(--border)' };
    const H = sexe === 'H';
    const cats = {
      bmi:   [[18.5,{label:'Insuffisant',color:'#3182ce',bg:'rgba(49,130,206,.1)'}],[25,{label:'Normal',color:'#38a169',bg:'rgba(56,161,105,.1)'}],[30,{label:'Surpoids',color:'#d69e2e',bg:'rgba(214,158,46,.1)'}],[99,{label:'Obèse',color:'#e53e3e',bg:'rgba(229,62,62,.1)'}]],
      fat:   H ? [[6,{label:'Essentiel',color:'#3182ce',bg:'rgba(49,130,206,.1)'}],[14,{label:'Athlète',color:'#38a169',bg:'rgba(56,161,105,.1)'}],[18,{label:'Forme',color:'#38a169',bg:'rgba(56,161,105,.1)'}],[25,{label:'Normale',color:'#d69e2e',bg:'rgba(214,158,46,.1)'}],[99,{label:'Obèse',color:'#e53e3e',bg:'rgba(229,62,62,.1)'}]]
            : [[14,{label:'Essentiel',color:'#3182ce',bg:'rgba(49,130,206,.1)'}],[21,{label:'Athlète',color:'#38a169',bg:'rgba(56,161,105,.1)'}],[25,{label:'Forme',color:'#38a169',bg:'rgba(56,161,105,.1)'}],[32,{label:'Normale',color:'#d69e2e',bg:'rgba(214,158,46,.1)'}],[99,{label:'Obèse',color:'#e53e3e',bg:'rgba(229,62,62,.1)'}]],
      muscle:H ? [[33,{label:'Faible',color:'#e53e3e',bg:'rgba(229,62,62,.1)'}],[39,{label:'Faible',color:'#d69e2e',bg:'rgba(214,158,46,.1)'}],[44,{label:'Normale',color:'#38a169',bg:'rgba(56,161,105,.1)'}],[99,{label:'Élevée',color:'#38a169',bg:'rgba(56,161,105,.1)'}]]
            : [[24,{label:'Faible',color:'#e53e3e',bg:'rgba(229,62,62,.1)'}],[30,{label:'Faible',color:'#d69e2e',bg:'rgba(214,158,46,.1)'}],[35,{label:'Normale',color:'#38a169',bg:'rgba(56,161,105,.1)'}],[99,{label:'Élevée',color:'#38a169',bg:'rgba(56,161,105,.1)'}]],
      water: [[45,{label:'Faible',color:'#e53e3e',bg:'rgba(229,62,62,.1)'}],[60,{label:'Normale',color:'#38a169',bg:'rgba(56,161,105,.1)'}],[99,{label:'Élevée',color:'#3182ce',bg:'rgba(49,130,206,.1)'}]],
      visceral:[[9,{label:'Sain',color:'#38a169',bg:'rgba(56,161,105,.1)'}],[14,{label:'Élevée',color:'#d69e2e',bg:'rgba(214,158,46,.1)'}],[99,{label:'Très élevée',color:'#e53e3e',bg:'rgba(229,62,62,.1)'}]],
      bmr:   H?[[1500,{label:'Faible',color:'#d69e2e',bg:'rgba(214,158,46,.1)'}],[1800,{label:'Normale',color:'#38a169',bg:'rgba(56,161,105,.1)'}],[99999,{label:'Élevée',color:'#38a169',bg:'rgba(56,161,105,.1)'}]]
              :[[1200,{label:'Faible',color:'#d69e2e',bg:'rgba(214,158,46,.1)'}],[1500,{label:'Normale',color:'#38a169',bg:'rgba(56,161,105,.1)'}],[99999,{label:'Élevée',color:'#38a169',bg:'rgba(56,161,105,.1)'}]],
    };
    const scale = cats[type];
    if (!scale) return { label:'Normal', color:'#38a169', bg:'rgba(56,161,105,.1)' };
    for (const [threshold, cat] of scale) if (val < threshold) return cat;
    return scale[scale.length-1][1];
  }

  const metrics = [
    { label:'Poids',           val:weight,         unit:'kg',   fmt:v=>v.toFixed(2), type:'none',    sub: bmi?'IMC '+bmi:'' },
    { label:'IMC',             val:bmi,            unit:'',     fmt:v=>v.toFixed(1), type:'bmi',     sub:'' },
    { label:'Graisse Corp.',   val:bfPct,          unit:'%',    fmt:v=>v.toFixed(1), type:'fat',     sub: fatMassKg?fatMassKg+'kg':'' },
    { label:'Muscle squelettique', val: S.bodyCompo?.musclePct||null, unit:'%', fmt:v=>v.toFixed(1), type:'muscle', sub:'' },
    { label:'Masse maigre',   val:leanMassKg,     unit:'kg',   fmt:v=>v.toFixed(2), type:'none',    sub:'Hors masse grasse', catColor:'#38a169', catLabel:'Normale' },
    { label:'Gras sous-cutané',val:subFatPct,     unit:'%',    fmt:v=>v.toFixed(1), type:'fat',     sub:'' },
    { label:'Graisse viscérale',val:visceral,     unit:'',     fmt:v=>String(Math.round(v)), type:'visceral', sub:'Objectif <10' },
    { label:'Eau corporelle',  val:waterPct,       unit:'%',    fmt:v=>v.toFixed(1), type:'water',   sub:'' },
    { label:'Masse musculaire',val:muscleMassKg,  unit:'kg',   fmt:v=>v.toFixed(2), type:'none',    sub:'', catColor:'#38a169', catLabel:'Élevée' },
    { label:'Masse osseuse',   val:boneMassKg,    unit:'kg',   fmt:v=>v.toFixed(2), type:'none',    sub:'', catColor:'#d69e2e', catLabel:'Moyenne' },
    { label:'Protéines',       val:protPct,        unit:'%',    fmt:v=>v.toFixed(1), type:'none',    sub:'', catColor:'#d69e2e', catLabel:'Normale' },
    { label:'Métabolisme base',val:bmr,           unit:'kcal', fmt:v=>String(Math.round(v)), type:'bmr', sub:'' },
    { label:'Âge métabolique', val:metaAge,       unit:' ans', fmt:v=>String(Math.round(v)), type:'none', sub:'vs '+age+' ans réels',
      catColor: metaAge<=age?'#38a169':'#e53e3e', catLabel: metaAge<=age?'Normale':metaAge-age+'ans +' },
  ];

  // Header
  const hdr = document.createElement('div');
  hdr.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:10px';
  const hTitle = document.createElement('div');
  hTitle.style.cssText = 'font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)';
  hTitle.textContent = '🔬 Composition corporelle';
  const hBadge = document.createElement('div');
  hBadge.style.cssText = 'font-size:9px;font-weight:700;padding:2px 8px;border-radius:6px;cursor:pointer;' +
    (bfRenpho ? 'background:rgba(56,161,105,.1);color:#38a169;border:1px solid rgba(56,161,105,.3)' : 'background:var(--bg);color:var(--muted);border:1px solid var(--border)');
  hBadge.textContent = bfRenpho ? '✅ Renpho' : '⚙ Sync Renpho';
  hBadge.onclick = () => { if(typeof AppleWatch!=='undefined') AppleWatch.showWatchGuide(); };
  hdr.appendChild(hTitle); hdr.appendChild(hBadge);
  containerEl.appendChild(hdr);

  // Grille 3 colonnes
  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:8px';

  metrics.forEach(m => {
    const hasVal = m.val !== null && m.val !== undefined;
    const cat = m.catColor ? { label:m.catLabel, color:m.catColor, bg:'transparent' } : getCat(m.type, m.val, sex);

    const card = document.createElement('div');
    card.style.cssText = 'background:var(--card);border-radius:16px;padding:12px 8px 10px;border:1px solid var(--border);display:flex;flex-direction:column;align-items:center;gap:2px;text-align:center;position:relative;overflow:hidden';

    // Fond coloré très léger
    if (hasVal && cat.bg !== 'transparent') {
      card.style.background = cat.bg.replace(')', ',0.5)').replace('rgba', 'rgba');
    }

    const lbl = document.createElement('div');
    lbl.style.cssText = 'font-size:9px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;line-height:1.2;margin-bottom:3px';
    lbl.textContent = m.label;

    const valEl = document.createElement('div');
    valEl.style.cssText = `font-size:17px;font-weight:800;font-family:var(--mono);color:${hasVal?cat.color:'var(--muted)'}`;
    valEl.textContent = hasVal ? m.fmt(m.val) + m.unit : '—';

    const catEl = document.createElement('div');
    catEl.style.cssText = `margin-top:5px;font-size:10px;font-weight:700;padding:2px 8px;border-radius:6px;background:${hasVal?cat.bg:'var(--border)'};color:${hasVal?cat.color:'var(--muted)'}`;
    catEl.textContent = hasVal ? cat.label : 'Non mesuré';

    card.appendChild(lbl);
    card.appendChild(valEl);
    if (m.sub && hasVal) {
      const sub = document.createElement('div');
      sub.style.cssText = 'font-size:8px;color:var(--muted);line-height:1.2';
      sub.textContent = m.sub;
      card.appendChild(sub);
    }
    card.appendChild(catEl);
    grid.appendChild(card);
  });

  containerEl.appendChild(grid);

  // Source
  const note = document.createElement('div');
  note.style.cssText = 'font-size:9px;color:var(--muted);text-align:center;margin-top:8px;font-style:italic';
  note.textContent = bfRenpho
    ? 'Données Renpho via Apple Santé · ' + (S.bodyCompo?.lastSync || 'Sync récente')
    : 'Estimations Mifflin/Navy · Connectez Renpho via Apple Santé pour plus de précision';
  containerEl.appendChild(note);
};


/* ════════════════════════════════════════════════════════════════
   3. SUIVI POIDS — jauge circulaire style image 5
   ════════════════════════════════════════════════════════════════ */

window.renderWeightProgress = function(containerEl) {
  if (!containerEl) return;
  containerEl.innerHTML = '';

  const entries = (S.mesures?.poids || []).slice().sort((a,b)=>a.date.localeCompare(b.date));
  if (!entries.length) {
    const empty = document.createElement('div');
    empty.style.cssText = 'padding:16px;text-align:center;color:var(--muted);font-size:12px;background:var(--card);border-radius:18px;border:1px solid var(--border);margin-bottom:10px';
    empty.textContent = 'Renseignez votre poids pour commencer le suivi';
    containerEl.appendChild(empty); return;
  }

  const current = parseFloat(entries[entries.length-1]?.val || entries[entries.length-1]?.value) || 0;
  const first   = parseFloat(entries[0]?.val || entries[0]?.value) || current;
  const lastDate = entries[entries.length-1]?.date || '';
  const target  = parseFloat(S.objective?.targetWeight) || null;

  const pctProgress = target && first !== target
    ? Math.max(0, Math.min(100, Math.round((first-current)/(first-target)*100)))
    : 0;
  const totalLost = Math.round((first - current)*10)/10;
  const toGo = target ? Math.round(Math.abs(current - target)*10)/10 : null;

  const wrap = document.createElement('div');
  wrap.style.cssText = 'background:var(--card);border-radius:20px;padding:16px;border:1px solid var(--border);margin-bottom:10px';

  // ── Jauge circulaire SVG ──
  const circleWrap = document.createElement('div');
  circleWrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;margin-bottom:14px';

  const RADIUS = 70, STROKE = 8, CIRC = 2 * Math.PI * RADIUS;
  const offset = CIRC * (1 - pctProgress/100);

  const svgEl = document.createElementNS('http://www.w3.org/2000/svg','svg');
  svgEl.setAttribute('viewBox','0 0 164 164');
  svgEl.style.cssText = 'width:164px;height:164px;flex-shrink:0';

  // Cercle de fond
  const bgCircle = document.createElementNS('http://www.w3.org/2000/svg','circle');
  bgCircle.setAttribute('cx','82'); bgCircle.setAttribute('cy','82'); bgCircle.setAttribute('r',RADIUS);
  bgCircle.setAttribute('fill','none'); bgCircle.setAttribute('stroke','var(--border)');
  bgCircle.setAttribute('stroke-width',STROKE);

  // Cercle de progression
  const progCircle = document.createElementNS('http://www.w3.org/2000/svg','circle');
  progCircle.setAttribute('cx','82'); progCircle.setAttribute('cy','82'); progCircle.setAttribute('r',RADIUS);
  progCircle.setAttribute('fill','none');
  progCircle.setAttribute('stroke', pctProgress >= 80 ? '#38a169' : pctProgress >= 40 ? '#5ba8a0' : '#d69e2e');
  progCircle.setAttribute('stroke-width', STROKE);
  progCircle.setAttribute('stroke-linecap','round');
  progCircle.setAttribute('stroke-dasharray', CIRC.toFixed(1));
  progCircle.setAttribute('stroke-dashoffset', offset.toFixed(1));
  progCircle.setAttribute('transform','rotate(-90 82 82)');
  progCircle.style.transition = 'stroke-dashoffset 1s ease';

  // Indicateur sommet (triangle/point)
  if (pctProgress > 0) {
    const dot = document.createElementNS('http://www.w3.org/2000/svg','circle');
    const angle = (-90 + pctProgress * 3.6) * Math.PI / 180;
    const dx = 82 + RADIUS * Math.cos(angle);
    const dy = 82 + RADIUS * Math.sin(angle);
    dot.setAttribute('cx', dx.toFixed(1)); dot.setAttribute('cy', dy.toFixed(1));
    dot.setAttribute('r','5');
    dot.setAttribute('fill', pctProgress >= 80 ? '#38a169' : '#5ba8a0');
    svgEl.appendChild(bgCircle); svgEl.appendChild(progCircle); svgEl.appendChild(dot);
  } else {
    svgEl.appendChild(bgCircle); svgEl.appendChild(progCircle);
  }

  // Texte central
  const textG = document.createElementNS('http://www.w3.org/2000/svg','g');

  const labelText = document.createElementNS('http://www.w3.org/2000/svg','text');
  labelText.setAttribute('x','82'); labelText.setAttribute('y','62');
  labelText.setAttribute('text-anchor','middle'); labelText.setAttribute('font-size','10');
  labelText.setAttribute('fill','var(--muted)'); labelText.setAttribute('font-weight','500');
  labelText.textContent = 'Poids';

  const weightText = document.createElementNS('http://www.w3.org/2000/svg','text');
  weightText.setAttribute('x','82'); weightText.setAttribute('y','90');
  weightText.setAttribute('text-anchor','middle'); weightText.setAttribute('font-size','26');
  weightText.setAttribute('fill','var(--text)'); weightText.setAttribute('font-weight','800');
  weightText.textContent = current.toFixed(1);

  const unitText = document.createElementNS('http://www.w3.org/2000/svg','text');
  unitText.setAttribute('x','82'); unitText.setAttribute('y','106');
  unitText.setAttribute('text-anchor','middle'); unitText.setAttribute('font-size','10');
  unitText.setAttribute('fill','var(--muted)');
  unitText.textContent = 'kg';

  const dateText = document.createElementNS('http://www.w3.org/2000/svg','text');
  dateText.setAttribute('x','82'); dateText.setAttribute('y','122');
  dateText.setAttribute('text-anchor','middle'); dateText.setAttribute('font-size','9');
  dateText.setAttribute('fill','var(--muted)');
  dateText.textContent = lastDate ? new Date(lastDate+'T12:00').toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'}) : '';

  textG.append(labelText, weightText, unitText, dateText);
  svgEl.appendChild(textG);
  circleWrap.appendChild(svgEl);

  // Bouton objectif sous le cercle
  const targetBtn = document.createElement('button');
  targetBtn.style.cssText = 'margin-top:4px;border:none;background:none;font-size:12px;color:var(--teal-d);cursor:pointer;touch-action:manipulation;-webkit-appearance:none;font-weight:700;font-family:var(--font)';
  targetBtn.textContent = target ? '🎯 Objectif : ' + target + 'kg' : '+ Définir un objectif de poids';
  const doSetTarget = () => {
    if (typeof _showObjectifSlider === 'function') _showObjectifSlider('poids','Poids', current, target);
    else {
      const t = prompt('Objectif poids (kg):', target||'');
      if (t && !isNaN(t)) { S.objective.targetWeight = parseFloat(t); save(); renderWeightProgress(containerEl); }
    }
  };
  targetBtn.ontouchstart = (e) => { e.preventDefault(); doSetTarget(); };
  targetBtn.onclick = doSetTarget;
  circleWrap.appendChild(targetBtn);

  // ── 3 stats en bas ──
  const statsRow = document.createElement('div');
  statsRow.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:6px;border-top:1px solid var(--border);padding-top:12px';

  const stats = [
    { label:'Perte totale', val: totalLost !== 0 ? (totalLost<0?'+':'-') + Math.abs(totalLost) + 'kg' : '0 kg', color: totalLost < 0 ? '#38a169' : totalLost > 0 ? 'var(--red)' : 'var(--muted)' },
    { label:'Progrès',      val: target ? pctProgress + '%' : '—',   color: pctProgress >= 80 ? '#38a169' : pctProgress >= 40 ? 'var(--teal)' : 'var(--muted)' },
    { label:'Objectif',     val: target ? target.toFixed(1) + 'kg' : '—',  color: 'var(--text)' },
  ];

  stats.forEach(s => {
    const cell = document.createElement('div');
    cell.style.cssText = 'text-align:center;padding:4px 2px';
    const v = document.createElement('div');
    v.style.cssText = `font-family:var(--mono);font-size:15px;font-weight:800;color:${s.color}`;
    v.textContent = s.val;
    const l = document.createElement('div');
    l.style.cssText = 'font-size:10px;color:var(--muted);margin-top:2px';
    l.textContent = s.label;
    cell.appendChild(v); cell.appendChild(l);
    statsRow.appendChild(cell);
  });

  wrap.appendChild(circleWrap);
  wrap.appendChild(statsRow);
  containerEl.appendChild(wrap);
};


/* ════════════════════════════════════════════════════════════════
   4. TRACKER D'EAU
   ════════════════════════════════════════════════════════════════ */

window.renderWaterTracker = function(containerEl) {
  if (!containerEl) return;
  containerEl.innerHTML = '';

  const today   = typeof localDateStr === 'function' ? localDateStr() : new Date().toISOString().slice(0,10);
  if (!S.water) S.water = { daily:{}, goal:2500 };
  const current = parseInt(S.water.daily?.[today] || 0);
  const goal    = parseInt(S.water.goal || 2500);
  const pct     = Math.min(100, Math.round(current / goal * 100));

  const wrap = document.createElement('div');
  wrap.style.cssText = 'background:var(--card);border-radius:18px;padding:16px;border:1px solid var(--border)';

  const hdr = document.createElement('div');
  hdr.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:12px';
  const htitle = document.createElement('div');
  htitle.style.cssText = 'font-size:15px;font-weight:700;color:var(--text)';
  htitle.textContent = '💧 Hydratation';
  const goalBtn = document.createElement('button');
  goalBtn.style.cssText = 'border:none;background:none;font-size:11px;color:var(--muted);cursor:pointer;touch-action:manipulation;-webkit-appearance:none';
  goalBtn.textContent = 'Objectif : ' + (goal/1000).toFixed(1) + 'L';
  goalBtn.onclick = () => { const v=prompt('Objectif eau (ml):',goal); if(v&&!isNaN(v)){S.water.goal=parseInt(v);save();renderWaterTracker(containerEl);} };
  hdr.appendChild(htitle); hdr.appendChild(goalBtn);

  const mainRow = document.createElement('div');
  mainRow.style.cssText = 'display:flex;align-items:center;gap:14px;margin-bottom:12px';

  // Verre SVG animé
  const glassSvg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  glassSvg.setAttribute('viewBox','0 0 48 72'); glassSvg.style.cssText='width:40px;height:60px;flex-shrink:0';
  const glassPath = document.createElementNS('http://www.w3.org/2000/svg','path');
  glassPath.setAttribute('d','M8,2 L40,2 L36,70 L12,70 Z');
  glassPath.setAttribute('fill','rgba(49,130,206,0.08)'); glassPath.setAttribute('stroke','#3182ce'); glassPath.setAttribute('stroke-width','2'); glassPath.setAttribute('stroke-linejoin','round');
  const fillHeight = Math.round(68 * pct / 100);
  const fillY = 70 - fillHeight;
  const waterFill = document.createElementNS('http://www.w3.org/2000/svg','rect');
  waterFill.setAttribute('x','10'); waterFill.setAttribute('y', fillY); waterFill.setAttribute('width','28'); waterFill.setAttribute('height', fillHeight);
  waterFill.setAttribute('fill','rgba(49,130,206,0.35)'); waterFill.setAttribute('clip-path','url(#glassClip)');
  const clipPath = document.createElementNS('http://www.w3.org/2000/svg','clipPath');
  clipPath.setAttribute('id','glassClip');
  const clipRect = document.createElementNS('http://www.w3.org/2000/svg','path');
  clipRect.setAttribute('d','M8,2 L40,2 L36,70 L12,70 Z');
  clipPath.appendChild(clipRect);
  const defs = document.createElementNS('http://www.w3.org/2000/svg','defs');
  defs.appendChild(clipPath);
  glassSvg.appendChild(defs); glassSvg.appendChild(glassPath); glassSvg.appendChild(waterFill);

  const info = document.createElement('div'); info.style.cssText='flex:1';
  const mainNum = document.createElement('div');
  mainNum.style.cssText = 'font-family:var(--mono);font-size:26px;font-weight:800;color:#3182ce';
  mainNum.textContent = (current/1000).toFixed(2) + ' L';
  const sub = document.createElement('div');
  sub.style.cssText = 'font-size:11px;color:var(--muted);margin-top:2px';
  sub.textContent = current + ' ml / ' + goal + ' ml';
  const bar = document.createElement('div');
  bar.style.cssText = 'height:6px;background:var(--border);border-radius:3px;overflow:hidden;margin-top:6px';
  const bf = document.createElement('div');
  bf.style.cssText = `height:100%;width:${pct}%;background:#3182ce;border-radius:3px;transition:width .6s`;
  bar.appendChild(bf);
  const pctEl = document.createElement('div');
  pctEl.style.cssText='font-size:9px;color:#3182ce;margin-top:2px;font-weight:700';
  pctEl.textContent = pct + '% de l\'objectif';
  info.append(mainNum, sub, bar, pctEl);
  mainRow.append(glassSvg, info);

  const addRow = document.createElement('div');
  addRow.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:6px';
  [['150','150ml'],['250','250ml'],['500','500ml'],['750','750ml']].forEach(([ml,lbl])=>{
    const btn=document.createElement('button');
    btn.style.cssText='padding:10px 4px;border-radius:10px;border:1.5px solid #3182ce;background:rgba(49,130,206,0.07);color:#3182ce;font-size:12px;font-weight:700;font-family:var(--font);cursor:pointer;touch-action:manipulation;-webkit-appearance:none';
    btn.textContent='+'+lbl;
    const doAdd=()=>{if(!S.water.daily)S.water.daily={};S.water.daily[today]=(S.water.daily[today]||0)+parseInt(ml);save();renderWaterTracker(containerEl);};
    btn.ontouchstart=(e)=>{e.preventDefault();doAdd();}; btn.onclick=doAdd;
    addRow.appendChild(btn);
  });

  const resetBtn=document.createElement('button');
  resetBtn.style.cssText='width:100%;margin-top:6px;padding:6px;border:none;background:none;color:var(--muted);font-size:11px;font-family:var(--font);cursor:pointer;touch-action:manipulation;-webkit-appearance:none';
  resetBtn.textContent='Réinitialiser aujourd\'hui';
  resetBtn.onclick=()=>{if(S.water?.daily)S.water.daily[today]=0;save();renderWaterTracker(containerEl);};

  wrap.append(hdr, mainRow, addRow, resetBtn);
  containerEl.appendChild(wrap);
};


/* ════════════════════════════════════════════════════════════════
   5. SLIDER OBJECTIF PAR MENSURATION
   ════════════════════════════════════════════════════════════════ */

window._showObjectifSlider = function(key, label, currentVal, currentObj) {
  document.getElementById('obj-slider-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'obj-slider-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.55);z-index:9400;display:flex;align-items:flex-end;justify-content:center';

  const sheet = document.createElement('div');
  sheet.style.cssText = 'background:var(--surface);border-radius:24px 24px 0 0;padding:20px 16px calc(24px + env(safe-area-inset-bottom,0px));width:100%;max-width:480px';

  const handle=document.createElement('div');handle.style.cssText='width:36px;height:4px;border-radius:2px;background:var(--border);margin:0 auto 14px';
  const title=document.createElement('div');title.style.cssText='font-size:16px;font-weight:700;color:var(--text);margin-bottom:4px';title.textContent='Objectif — '+label;
  const curr=document.createElement('div');curr.style.cssText='font-size:11px;color:var(--muted);margin-bottom:16px';curr.textContent=currentVal?'Actuel : '+currentVal.toFixed(1)+' cm':'Aucune mesure enregistrée';

  const bigVal=document.createElement('div');bigVal.style.cssText='text-align:center;font-family:var(--mono);font-size:48px;font-weight:800;color:var(--teal);margin-bottom:4px';
  const bigUnit=document.createElement('div');bigUnit.style.cssText='text-align:center;font-size:12px;color:var(--muted);margin-bottom:18px';bigUnit.textContent='cm · Objectif';

  const ranges={cou:[30,55],'bras':[25,55],'bras-g':[25,55],poitrine:[80,140],taille:[55,120],hanches:[70,130],cuisse:[40,80],'cuisse-g':[40,80],mollet:[25,55],'mollet-g':[25,55],poids:[40,200]};
  const [minV,maxV]=ranges[key]||[20,150];
  let objVal=currentObj||(currentVal?Math.round(currentVal*0.95):Math.round((minV+maxV)/2));
  bigVal.textContent=objVal.toFixed(1);

  const slider=document.createElement('input');slider.type='range';slider.min=minV;slider.max=maxV;slider.step='0.5';slider.value=objVal;
  slider.style.cssText='width:100%;-webkit-appearance:none;appearance:none;height:8px;border-radius:4px;outline:none;cursor:pointer;touch-action:none';
  const updateSlider=()=>{const p=((objVal-minV)/(maxV-minV)*100).toFixed(0);slider.style.background=`linear-gradient(to right,var(--teal) ${p}%,var(--border) ${p}%)`;};
  updateSlider();
  slider.addEventListener('input',()=>{objVal=parseFloat(slider.value);bigVal.textContent=objVal.toFixed(1);updateSlider();});

  const rangeRow=document.createElement('div');rangeRow.style.cssText='display:flex;justify-content:space-between;font-size:10px;color:var(--muted);margin-top:4px;margin-bottom:16px';
  rangeRow.innerHTML='<span>'+minV+' cm</span><span>'+maxV+' cm</span>';

  const suggestions=document.createElement('div');suggestions.style.cssText='display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px';
  if(typeof calcMesureObjectif==='function'){const def=calcMesureObjectif(key);if(def){[['Santé',def.santé],['Athlétique',def.athlétique]].forEach(([l2,v2])=>{if(!v2)return;const c=document.createElement('button');c.style.cssText='padding:6px 12px;border-radius:8px;border:1px solid var(--teal);background:transparent;color:var(--teal-d);font-size:11px;font-weight:600;font-family:var(--font);cursor:pointer;touch-action:manipulation;-webkit-appearance:none';c.textContent=l2+': '+v2+'cm';const d=()=>{slider.value=v2;objVal=v2;bigVal.textContent=v2.toFixed(1);updateSlider();};c.ontouchstart=(e)=>{e.preventDefault();d();};c.onclick=d;suggestions.appendChild(c);});}}

  const btns=document.createElement('div');btns.style.cssText='display:flex;gap:8px';
  const saveBtn=document.createElement('button');saveBtn.style.cssText='flex:2;padding:13px;border-radius:14px;border:none;background:var(--teal);color:#fff;font-size:15px;font-weight:700;font-family:var(--font);cursor:pointer;touch-action:manipulation;-webkit-appearance:none';saveBtn.textContent='Enregistrer';
  const cancelBtn=document.createElement('button');cancelBtn.style.cssText='flex:1;padding:13px;border-radius:14px;border:1.5px solid var(--border);background:transparent;color:var(--muted);font-size:14px;font-weight:700;font-family:var(--font);cursor:pointer;touch-action:manipulation;-webkit-appearance:none';cancelBtn.textContent='Annuler';
  const doSave=()=>{if(!S.mesureObjectifs)S.mesureObjectifs={};S.mesureObjectifs[key]=objVal;if(key==='poids')S.objective.targetWeight=objVal;save();overlay.remove();if(typeof renderCorps==='function')renderCorps();if(typeof showToast==='function')showToast('Objectif '+label+' : '+objVal+(key==='poids'?'kg':' cm'),'save',2000);};
  saveBtn.ontouchstart=(e)=>{e.preventDefault();doSave();};saveBtn.onclick=doSave;
  cancelBtn.ontouchstart=(e)=>{e.preventDefault();overlay.remove();};cancelBtn.onclick=()=>overlay.remove();
  btns.appendChild(cancelBtn);btns.appendChild(saveBtn);

  sheet.append(handle,title,curr,bigVal,bigUnit,slider,rangeRow,suggestions,btns);
  overlay.appendChild(sheet);
  overlay.ontouchstart=(e)=>{if(e.target===overlay)overlay.remove();};
  overlay.onclick=(e)=>{if(e.target===overlay)overlay.remove();};
  document.body.appendChild(overlay);
};


/* ════════════════════════════════════════════════════════════════
   6. RENPHO — Extension du parseur HealthKit
   ════════════════════════════════════════════════════════════════ */

window.addEventListener('load', () => {
  setTimeout(() => {
    if (typeof AppleWatch === 'undefined') return;
    const orig = AppleWatch._importWatchData?.bind(AppleWatch);
    AppleWatch._importWatchData = function(data) {
      if (orig) orig(data);
      if (!S.bodyCompo) S.bodyCompo = {};
      if (data.fatPct !== null && data.fatPct !== undefined)     S.bodyCompo.fatPct      = data.fatPct;
      if (data.musclePct !== null && data.musclePct !== undefined) S.bodyCompo.musclePct = data.musclePct;
      if (data.leanMass !== null && data.leanMass !== undefined)   S.bodyCompo.leanMass  = data.leanMass;
      if (data.boneMass !== null && data.boneMass !== undefined)   S.bodyCompo.boneMass  = data.boneMass;
      if (data.waterPct !== null && data.waterPct !== undefined)   S.bodyCompo.waterPct  = data.waterPct;
      if (data.visceralFat !== null && data.visceralFat !== undefined) S.bodyCompo.visceralFat = data.visceralFat;
      if (data.subFatPct !== null && data.subFatPct !== undefined) S.bodyCompo.subFatPct = data.subFatPct;
      if (data.protPct !== null && data.protPct !== undefined)     S.bodyCompo.protPct   = data.protPct;
      S.bodyCompo.lastSync = new Date().toLocaleDateString('fr-FR');
      if (typeof save === 'function') save();
    };
  }, 600);
});
