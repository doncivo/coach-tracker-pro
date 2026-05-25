/* ═══════════════════════════════════════
   features.js — Fonctionnalités et navigation
   Dépend de: tous les modules précédents
═══════════════════════════════════════ */

// Variables d'état
let _barcodeStream = null;
let _sessTimer = null;
let _sessActiveEx = 0;

const MEAL_NAMES = ['Petit-déjeuner 🌅', 'Déjeuner 🌞', 'Dîner 🌙', 'Collation 🍎'];

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

const ACHIEVEMENTS_DEF=[
  {id:'first_session',icon:'🎯',name:'Première séance',desc:'Terminer sa première séance'},
  {id:'week_streak_3',icon:'🔥',name:'3 jours d\'affilée',desc:'3 séances consécutives'},
  {id:'week_streak_7',icon:'⚡',name:'Semaine parfaite',desc:'7 jours consécutifs'},
  {id:'first_pr',icon:'🏆',name:'Premier PR',desc:'Battre son record personnel'},
  {id:'pr_5',icon:'👑',name:'5 PR',desc:'Battre 5 records personnels'},
  {id:'vol_50t',icon:'💪',name:'50 tonnes',desc:'50t de volume cumulé'},
  {id:'vol_100t',icon:'🦁',name:'100 tonnes',desc:'100t de volume cumulé'},
  {id:'sessions_10',icon:'📈',name:'10 séances',desc:'Compléter 10 séances'},
  {id:'sessions_50',icon:'🚀',name:'50 séances',desc:'Compléter 50 séances'},
  {id:'perfect_week',icon:'⭐',name:'Semaine parfaite',desc:'Tous les exercices faits sur une semaine'},
  {id:'consistency_4',icon:'🗓️',name:'4 semaines',desc:'Adhérence >80% sur 4 semaines'},
  {id:'first_deload',icon:'🔄',name:'Premier deload',desc:'Compléter un bloc de 4 semaines'},
  {id:'sleep_7',icon:'😴',name:'Sommeil optimal',desc:'7j de sommeil ≥7h'},
  {id:'no_pain',icon:'🩺',name:'Sans douleur',desc:'Aucune douleur signalée depuis 4 semaines'

},
];

function _initRestTimerButtons() {
  // Skip
  document.getElementById('rest-timer-skip')?.addEventListener('click', () => {
    RestTimer.stop();
  });

  // Série suivante
  document.getElementById('rest-timer-next')?.addEventListener('click', () => {
    RestTimer.stop();
    if(RestTimer._nextSetCb) RestTimer._nextSetCb();
  });

  // +15s
  document.getElementById('rest-timer-add-btn')?.addEventListener('click', () => {
    RestTimer.addTime(15);
  });

  // Presets
  document.querySelectorAll('.rest-timer-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      const sec = parseInt(btn.dataset.sec);
      document.querySelectorAll('.rest-timer-preset').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      RestTimer.setDuration(sec);
    });
  });

  // Fermer en cliquant sur le fond
  document.getElementById('rest-timer-overlay')?.addEventListener('click', (e) => {
    if(e.target.id === 'rest-timer-overlay') RestTimer.stop();
  });
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


const RestTimer = {
  _interval: null,
  _total: 90,       // durée choisie
  _remaining: 90,   // secondes restantes
  _exName: '',      // nom de l'exercice
  _nextSetCb: null, // callback quand on clique "Série suivante"
  _beepCtx: null,   // AudioContext pour les bips

  // ── Ouvrir le timer ──
  start(durationSec, exName, onNextSet) {
    this.stop();
    this._total     = durationSec || (S._restDuration || 90);
    this._remaining = this._total;
    this._exName    = exName || '';
    this._nextSetCb = onNextSet || null;

    const overlay = document.getElementById('rest-timer-overlay');
    const card    = document.getElementById('rest-timer-card');
    const exEl    = document.getElementById('rest-timer-ex-name');
    if(!overlay) return;

    if(exEl) exEl.textContent = exName || '';
    card.classList.remove('done-pulse');
    document.getElementById('rest-ring-fill')?.classList.remove('done');

    // Sync preset buttons to chosen duration
    document.querySelectorAll('.rest-timer-preset').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.sec) === this._total);
    });

    overlay.style.display = 'flex';
    this._render();
    this._interval = setInterval(() => this._tick(), 1000);
  },

  // ── Tick ──
  _tick() {
    this._remaining--;
    this._render();
    if(this._remaining <= 0) {
      this._finish();
    } else if(this._remaining <= 3) {
      this._beep(880, 0.15); // bip de fin imminent
    }
  },

  // ── Mettre à jour l'affichage ──
  _render() {
    const sec  = Math.max(0, this._remaining);
    const min  = Math.floor(sec / 60);
    const s    = sec % 60;
    const disp = `${min}:${String(s).padStart(2,'0')}`;

    const timeEl = document.getElementById('rest-timer-time');
    if(timeEl) timeEl.textContent = disp;

    // Anneau SVG
    const circ = 2 * Math.PI * 68; // r=68
    const fill = document.getElementById('rest-ring-fill');
    if(fill) {
      const pct  = Math.max(0, this._remaining / this._total);
      const offset = circ * (1 - pct);
      fill.style.strokeDashoffset = offset;
      // Couleur selon temps restant
      fill.style.stroke = pct > 0.5 ? 'var(--teal)' : pct > 0.25 ? 'var(--orange)' : 'var(--red)';
    }
  },

  // ── Fin du repos ──
  _finish() {
    clearInterval(this._interval);
    this._interval = null;

    const card = document.getElementById('rest-timer-card');
    const fill = document.getElementById('rest-ring-fill');
    const timeEl = document.getElementById('rest-timer-time');

    if(card) card.classList.add('done-pulse');
    if(fill) { fill.style.stroke = 'var(--green)'; fill.classList.add('done'); }
    if(timeEl) timeEl.textContent = '0:00';

    // Bip triple de fin
    if(S._restBeep!==false) this._beep(660, 0.2);
    setTimeout(() => this._beep(880, 0.2), 200);
    setTimeout(() => this._beep(1100, 0.3), 400);

    // Notification si PWA
    if(typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try { new Notification('⏱ Repos terminé !', { body: 'Prêt pour la prochaine série de ' + (this._exName||''), icon:'./icons/icon-192.png', silent:true }); } catch(e){}
    }
  },

  // ── Stopper ──
  stop() {
    clearInterval(this._interval);
    this._interval = null;
    const overlay = document.getElementById('rest-timer-overlay');
    if(overlay) overlay.style.display = 'none';
    const card = document.getElementById('rest-timer-card');
    if(card) card.classList.remove('done-pulse');
  },

  // ── Ajouter du temps ──
  addTime(sec) {
    this._remaining = Math.min(this._remaining + sec, 600);
    this._total = Math.max(this._total, this._remaining);
    this._render();
  },

  // ── Changer la durée ──
  setDuration(sec) {
    this._total     = sec;
    this._remaining = sec;
    S._restDuration = sec;
    save();
    this._render();
    // Restart interval
    clearInterval(this._interval);
    this._interval = setInterval(() => this._tick(), 1000);
  },

  // ── Son (WebAudio API) ──
  _beep(freq, dur) {
    try {
      if(!this._beepCtx) this._beepCtx = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = this._beepCtx;
      const osc = ctx.createOscillator();
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

// cancelTrainingReminder est dans utils.js


function restoreReminder() {
  if (S._reminderHour != null && S._reminderMinute != null) {
    scheduleTrainingReminder(S._reminderHour, S._reminderMinute);
  }
}

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

function _obFinish(){localStorage.setItem(ONBOARD_KEY,'1');const ov=document.getElementById('onboard-overlay');if(ov)ov.style.display='none';save();try{updateStats();renderDashboard();}catch(e){}showToast('✅ Configuration terminée ! Bienvenue 🏋️','ok',4000);}

function checkOnboarding(){if(!localStorage.getItem(ONBOARD_KEY))setTimeout(showOnboarding,800);}

function resetOnboarding(){localStorage.removeItem(ONBOARD_KEY);showOnboarding();}

// switchTab est dans utils.js


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

// updateWeekBadges est dans utils.js


function startSessTimer(){if(!S.sessStartTime)S.sessStartTime=Date.now();clearInterval(_sessTimer);_sessTimer=setInterval(()=>{const dur=Math.round((Date.now()-S.sessStartTime)/60000);const el=document.getElementById('sess-duration');if(el)el.textContent=dur+' min';},30000);}

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

// checkWeeklyAutoSave est dans utils.js


function checkAndAwardAchievements(){
  const streak=computeStreak();const adh=computeAdherence();
  const totalDone=Object.values(S.history).flatMap(wk=>(wk.days||[])).flatMap(d=>(d.exercises||[])).filter(e=>e.done&&!e.isWarmup).length+S.days.flatMap(d=>d.exercises).filter(e=>e.done&&!e.isWarmup).length;
  const totalVol=Object.values(S.history).flatMap(wk=>(wk.days||[])).flatMap(d=>(d.exercises||[]).filter(e=>!e.isWarmup).map(calcVol)).reduce((a,b)=>a+b,0)/1000;
  const prCount=S.days.flatMap(d=>d.exercises).filter(checkPR).length;
  const hasPainRecent=S.painLog.some(p=>{const d=new Date(p.date+'T00:00');return(Date.now()-d.getTime())<28*86400000;});
  const avgSleep=Object.values(S.sleep||{}).slice(-7).filter(s=>parseFloat(s.hours)>=7).length;
  const checks={first_session:totalDone>=1,week_streak_3:streak.current>=3,week_streak_7:streak.current>=7,first_pr:prCount>=1,pr_5:prCount>=5,vol_50t:totalVol>=50,vol_100t:totalVol>=100,sessions_10:totalDone>=10,sessions_50:totalDone>=50,perfect_week:S.weekCount>=1&&S.days.filter(d=>getDMS(d).some(k=>k&&k!=='rep')).every(d=>d.exercises.filter(e=>e.name.trim()&&!e.isWarmup).every(e=>e.done)),consistency_4:adh.prog4>0&&Math.round(adh.comp4/adh.prog4*100)>=80,first_deload:S.weekCount>=5,sleep_7:avgSleep>=7,no_pain:!hasPainRecent,
    steps_goal_3:lastNDays(7).filter(d=>parseInt(S.steps&&S.steps[d]||0)>=(S.stepsGoal||10000)).length>=3,
    steps_goal_7:lastNDays(7).filter(d=>parseInt(S.steps&&S.steps[d]||0)>=(S.stepsGoal||10000)).length>=7,
    cal_tracked_7:lastNDays(7).filter(d=>{const cl=S.calories&&S.calories[d];let t=0;if(cl&&cl.meals)cl.meals.forEach(m=>(m.items||[]).forEach(it=>t+=parseFloat(it.kcal)||0));return t>0;}).length>=7};
  Object.entries(checks).forEach(([id,unlocked])=>{if(unlocked&&!S.achievements[id]){S.achievements[id]={unlockedAt:todayStr()};showToast('🏆 Badge débloqué: '+ACHIEVEMENTS_DEF.find(a=>a.id===id)?.name,'pr',4000);save();}});
}

/* renderGoals défini dans module précédent */

function renderAlertsPanel(){
  const ap=document.getElementById('alerts-panel');if(!ap)return;
  const alerts=[];
  // Plateau detection
  S.days.flatMap(d=>d.exercises).filter(e=>e.name.trim()).forEach(ex=>{if(isPlateau(ex.name))alerts.push({type:'warn',msg:'⚠️ Plateau: '+ex.name.slice(0,25)});});
  // Consecutive same muscle
  for(let i=0;i<6;i++){const m1=getDM(S.days[i]).filter(k=>k!=='rep');const m2=getDM(S.days[i+1]).filter(k=>k!=='rep');const ov=m1.filter(m=>m2.includes(m));if(ov.length)alerts.push({type:'bad',msg:'🔴 '+DAYS_SH[i]+'/'+DAYS_SH[i+1]+': même groupe'});}
  // RPE warnings
  S.days.forEach(d=>d.exercises.forEach(ex=>{const rpe=parseFloat(ex.rpe)||0;if(rpe>=9.5)alerts.push({type:'warn',msg:'🔴 RPE '+rpe+': '+ex.name.slice(0,20)});}));
  // Pain alerts
  const pains14=activePains();
  pains14.forEach(p=>{
    alerts.push({type:'bad',msg:'⚠️ Douleur: '+(p.zone||p.part||'Zone inconnue')+(p.intensity?' ('+p.intensity+'/10)':'')});
  });
  // Untrained muscles this week
  const trainedMuscles=new Set(S.days.flatMap(d=>getDM(d)));
  const allMuscles=MK.filter(k=>k!=='rep'&&k!=='cardio');
  const untrained=allMuscles.filter(k=>!trainedMuscles.has(k));
  if(untrained.length>0&&untrained.length<allMuscles.length){
    alerts.push({type:'info',msg:'💡 Non travaillé: '+untrained.slice(0,3).map(k=>MM[k]?.label.split(' ')[0]||k).join(', ')+(untrained.length>3?'…':'')});
  }
  if(!alerts.length){ap.innerHTML='<span style="color:var(--muted)">Aucune alerte ✅</span>';return;}
  ap.innerHTML='';
  alerts.slice(0,7).forEach(a=>{
    const row=document.createElement('div');
    row.style.cssText=`font-size:9px;padding:2px 0;border-bottom:1px solid var(--border);color:${a.type==='bad'?'var(--red)':a.type==='info'?'var(--teal-d)':'var(--orange)'}`;
    row.textContent=a.msg;
    ap.appendChild(row);
  });
}

// ── Swipe gesture between tabs ────────────────────────────────

let _swipeStartX = 0, _swipeStartY = 0, _swipeActive = false;
document.addEventListener('touchstart', e => {
  _swipeStartX = e.touches[0].clientX;
  _swipeStartY = e.touches[0].clientY;
  _swipeActive = true;
}, { passive: true });
document.addEventListener('touchmove', e => {
  if (!_swipeActive) return;
  const dx = e.touches[0].clientX - _swipeStartX;
  const dy = e.touches[0].clientY - _swipeStartY;
  // Cancel if vertical scroll dominates
  if (Math.abs(dy) > Math.abs(dx)) _swipeActive = false;
}, { passive: true });
document.addEventListener('touchend', e => {
  if (!_swipeActive) return;
  _swipeActive = false;
  const dx = e.changedTouches[0].clientX - _swipeStartX;
  const dy = Math.abs(e.changedTouches[0].clientY - _swipeStartY);
  // Only horizontal swipe > 60px with small vertical component
  if (Math.abs(dx) < 60 || dy > 50) return;
  const cur = S._currentTab || 'weekly';
  const idx = TAB_ORDER.indexOf(cur);
  if (dx < 0 && idx < TAB_ORDER.length - 1) switchTab(TAB_ORDER[idx + 1]); // swipe left → next
  if (dx > 0 && idx > 0) switchTab(TAB_ORDER[idx - 1]); // swipe right → prev
});

/* ══ MUSCLE PICKER ══ */

