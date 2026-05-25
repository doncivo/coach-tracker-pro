/* ═══════════════════════════════════════
   features.js — Fonctionnalités et navigation
   Dépend de: tous les modules précédents
═══════════════════════════════════════ */

// Variables d'état des features
let _barcodeStream = null;
let _calDayOffset = 0;
let _sessTimer = null;
let _sessActiveEx = 0;

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

function checkOnboarding(){if(!localStorage.getItem(ONBOARD_KEY))setTimeout(showOnboarding,800);}

function resetOnboarding(){localStorage.removeItem(ONBOARD_KEY);showOnboarding();}

function switchTab(tabName) {
  // Deactivate all panes
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.bnav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.bnav-more-btn').forEach(b => b.classList.remove('active'));
  // Activate target pane
  const pane = document.getElementById('tab-' + tabName);
  if (pane) pane.classList.add('active');
  // Sync top tab
  const topBtn = document.querySelector('.tab-btn[data-tab="' + tabName + '"]');
  if (topBtn) topBtn.classList.add('active');
  // Sync bottom nav — main items
  const bnavBtn = document.querySelector('.bnav-btn[data-tab="' + tabName + '"]');
  if (bnavBtn) {
    bnavBtn.classList.add('active');
  } else {
    // It's in the "More" drawer
    const moreBtn = document.querySelector('.bnav-more-btn[data-tab="' + tabName + '"]');
    if (moreBtn) moreBtn.classList.add('active');
    document.getElementById('bnav-more-btn').classList.add('active');
  }
  // Close more menu
  const mm = document.getElementById('bnav-more-menu');
  if (mm) { mm.classList.remove('open'); }
  const mb = document.getElementById('bnav-more-btn');
  if (mb) mb.setAttribute('aria-expanded','false');
  // Render content
  if(tabName==='dashboard')renderDashboard();
  if(tabName==='weekly'){renderDayTabs();renderDayDetail(S.activeDay||0);}
  if(tabName==='monthly')renderCalendar();
  if(tabName==='session')renderSession();
  if(tabName==='progression')renderProgression();
  if(tabName==='bilan')renderBilan();
  if(tabName==='corps'){
    // Activate nutrition section by default
    document.querySelectorAll('.corps-subbtn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.corps-section').forEach(s => s.classList.remove('active'));
    const nutritionBtn = document.querySelector('.corps-subbtn[data-corps="nutrition"]');
    const nutritionSect = document.getElementById('corps-sect-nutrition');
    if(nutritionBtn) nutritionBtn.classList.add('active');
    if(nutritionSect) nutritionSect.classList.add('active');
    initCorpsSubNav();
    renderCalTracker();
    renderCorps();
  }
  if(tabName==='kpi')renderKPI();
  if(tabName==='achievements')renderAchievements();
  if(tabName==='library')renderLibrary();if(tabName==='settings')renderSettings();
  // Store current tab
  S._currentTab = tabName;
}

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

function updateWeekBadges(){
  document.getElementById('week-type-badge').textContent='Sem. '+S.weekType;
  document.getElementById('week-counter-badge').textContent='Sem. '+S.weekCount+' · '+S.currentBlock;
}

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

function checkWeeklyAutoSave(){
  const today=new Date();if(today.getDay()===0){// Sunday
    const key='lastAutoSave';const last=localStorage.getItem(key);
    const todayStr=localDateStr(today);
    if(last!==todayStr){archiveWeek();localStorage.setItem(key,todayStr);}
  }
}

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

function renderGoals(){
  const list=document.getElementById('goals-list');list.innerHTML='';
  S.goals.forEach((g,i)=>{const row=document.createElement('div');row.className='goal-row';const cb=document.createElement('input');cb.type='checkbox';cb.className='goal-cb';cb.checked=g.done;cb.addEventListener('change',e=>{S.goals[i].done=e.target.checked;save();});const inp=document.createElement('input');inp.type='text';inp.className='goal-inp';inp.placeholder='Objectif...';inp.value=g.text||'';inp.addEventListener('input',e=>{S.goals[i].text=e.target.value;save();});const del=document.createElement('button');del.className='goal-del';del.textContent='×';del.addEventListener('click',()=>{S.goals.splice(i,1);save();renderGoals();});row.appendChild(cb);row.appendChild(inp);row.appendChild(del);list.appendChild(row);});
}

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
const TAB_ORDER = ['dashboard','weekly','session','progression','corps','bilan','kpi','achievements','library','monthly','settings'];
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

