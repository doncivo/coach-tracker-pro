/* ================================================================
   icloud-watch.js
   
   1. iCloud Drive — Sauvegarde/restauration JSON automatique
   2. Apple Watch — HealthKit enrichi (HRV, RHR, VO2max, sommeil)
   3. Score de récupération WHOOP-style
   ================================================================ */

'use strict';

/* ════════════════════════════════════════════════════════════════
   1. iCLOUD DRIVE
   Mécanisme : Web Share API (iOS) → Files app → iCloud Drive
   Import : file picker → sélection depuis iCloud Drive
   ════════════════════════════════════════════════════════════════ */

const iCloudDrive = {

  /* Exporter vers iCloud Drive via Share Sheet iOS */
  async export(silent = false) {
    try {
      const state = Store.getState();
      const flat  = typeof _flattenState === 'function' ? _flattenState(state) : state;
      const json  = JSON.stringify(flat, null, 2);
      const date  = typeof localDateStr === 'function' ? localDateStr() : new Date().toISOString().slice(0,10);
      const fileName = 'ctp-backup-' + date + '.json';

      const file = new File([json], fileName, { type: 'application/json' });

      // iOS Safari Share API → ouvre la feuille de partage
      // L'utilisateur peut choisir "Enregistrer dans Fichiers" → iCloud Drive
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Coach Tracker Pro — Sauvegarde',
          text:  'Sauvegarde du ' + date,
        });
        // Enregistrer timestamp
        if (!S.icloudBackup) S.icloudBackup = {};
        S.icloudBackup.lastBackup = new Date().toISOString();
        save();
        if (!silent && typeof showToast === 'function') {
          showToast('Sauvegarde partagee vers iCloud Drive', 'save', 3000);
        }
        return true;
      }

      // Fallback : téléchargement classique
      const blob = new Blob([json], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = fileName; a.click();
      URL.revokeObjectURL(url);
      if (!silent && typeof showToast === 'function') {
        showToast('Sauvegarde telechargee (Share API non disponible)', 'save', 3000);
      }
      return true;
    } catch(err) {
      if (err.name !== 'AbortError') {
        console.error('iCloud export error:', err);
        if (typeof showToast === 'function') showToast('Erreur export : ' + err.message, 'error', 4000);
      }
      return false;
    }
  },

  /* Importer depuis iCloud Drive */
  import() {
    return new Promise((resolve, reject) => {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = '.json';
      inp.style.display = 'none';
      inp.addEventListener('change', async e => {
        const file = e.target.files[0];
        inp.remove();
        if (!file) { resolve(false); return; }
        try {
          if (typeof importJSON === 'function') {
            await importJSON(file);
            if (typeof showToast === 'function') showToast('Donnees restaurees depuis iCloud Drive', 'save', 3000);
            if (typeof renderDashboard === 'function') renderDashboard();
            resolve(true);
          }
        } catch(err) {
          if (typeof showToast === 'function') showToast('Erreur import : ' + err.message, 'error', 4000);
          reject(err);
        }
      });
      document.body.appendChild(inp);
      inp.click();
    });
  },

  /* Indicateur de dernière sauvegarde */
  getLastBackupLabel() {
    const last = S.icloudBackup?.lastBackup;
    if (!last) return 'Jamais sauvegarde';
    const d = new Date(last);
    const now = new Date();
    const diffH = Math.round((now - d) / (1000 * 60 * 60));
    if (diffH < 1)   return 'Il y a moins d 1h';
    if (diffH < 24)  return 'Il y a ' + diffH + 'h';
    const diffD = Math.floor(diffH / 24);
    return 'Il y a ' + diffD + ' jour' + (diffD > 1 ? 's' : '');
  },

  /* Guide de configuration dans les Réglages */
  showGuide() {
    document.getElementById('icloud-guide-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'icloud-guide-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.55);z-index:9500;display:flex;align-items:flex-end;justify-content:center';

    const sheet = document.createElement('div');
    sheet.style.cssText = 'background:var(--surface);border-radius:24px 24px 0 0;padding:20px 16px calc(24px + env(safe-area-inset-bottom,0px));width:100%;max-width:480px;max-height:85vh;overflow-y:auto;-webkit-overflow-scrolling:touch;display:flex;flex-direction:column;gap:12px';

    const handle = document.createElement('div');
    handle.style.cssText = 'width:36px;height:4px;border-radius:2px;background:var(--border);margin:0 auto';

    const title = document.createElement('div');
    title.style.cssText = 'font-size:17px;font-weight:700;color:var(--text)';
    title.textContent = '☁️ Sauvegarde iCloud Drive';

    // Status
    const statusCard = document.createElement('div');
    statusCard.style.cssText = 'background:var(--card);border-radius:14px;padding:14px;border:1px solid var(--border);display:flex;align-items:center;gap:12px';
    const statusIcon = document.createElement('span'); statusIcon.style.cssText='font-size:28px'; statusIcon.textContent='☁️';
    const statusInfo = document.createElement('div');
    statusInfo.innerHTML = '<div style="font-size:13px;font-weight:700;color:var(--text)">Derniere sauvegarde</div>' +
      '<div style="font-size:12px;color:var(--muted);margin-top:2px">' + iCloudDrive.getLastBackupLabel() + '</div>';
    statusCard.appendChild(statusIcon); statusCard.appendChild(statusInfo);

    // Boutons principaux
    const btnGrid = document.createElement('div');
    btnGrid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px';

    const exportBtn = document.createElement('button');
    exportBtn.style.cssText = 'padding:14px;border-radius:14px;border:none;background:var(--teal);color:#fff;font-size:14px;font-weight:700;font-family:var(--font);cursor:pointer;touch-action:manipulation;-webkit-appearance:none;display:flex;flex-direction:column;align-items:center;gap:4px';
    exportBtn.innerHTML = '<span style="font-size:22px">📤</span><span>Sauvegarder</span><span style="font-size:10px;opacity:.8">vers iCloud Drive</span>';
    const doExport = () => { overlay.remove(); iCloudDrive.export(); };
    exportBtn.ontouchstart = (e) => { e.preventDefault(); doExport(); };
    exportBtn.onclick = doExport;

    const importBtn = document.createElement('button');
    importBtn.style.cssText = 'padding:14px;border-radius:14px;border:1.5px solid var(--teal);background:transparent;color:var(--teal-d);font-size:14px;font-weight:700;font-family:var(--font);cursor:pointer;touch-action:manipulation;-webkit-appearance:none;display:flex;flex-direction:column;align-items:center;gap:4px';
    importBtn.innerHTML = '<span style="font-size:22px">📥</span><span>Restaurer</span><span style="font-size:10px;opacity:.7">depuis iCloud Drive</span>';
    const doImport = () => { overlay.remove(); iCloudDrive.import(); };
    importBtn.ontouchstart = (e) => { e.preventDefault(); doImport(); };
    importBtn.onclick = doImport;

    btnGrid.appendChild(exportBtn); btnGrid.appendChild(importBtn);

    // Instructions
    const instrCard = document.createElement('div');
    instrCard.style.cssText = 'background:var(--bg);border-radius:12px;padding:12px 14px;border:1px solid var(--border)';
    const instrTitle = document.createElement('div');
    instrTitle.style.cssText = 'font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:8px';
    instrTitle.textContent = 'Comment ca marche';
    const steps = [
      '📤 Sauvegarder → ouvre la feuille de partage iOS',
      '→ Appuyer "Enregistrer dans Fichiers"',
      '→ Choisir iCloud Drive → Sauvegarder',
      '📥 Restaurer → parcourir iCloud Drive',
      '→ Selectionner le fichier ctp-backup-DATE.json',
    ];
    steps.forEach(s => {
      const el = document.createElement('div');
      el.style.cssText = 'font-size:11px;color:var(--muted);padding:3px 0;line-height:1.4';
      el.textContent = s;
      instrCard.appendChild(el);
    });
    instrCard.insertBefore(instrTitle, instrCard.firstChild);

    // Auto-backup option
    const autoRow = document.createElement('div');
    autoRow.style.cssText = 'display:flex;align-items:center;gap:10px;background:var(--card);border-radius:12px;padding:12px 14px;border:1px solid var(--border)';
    const autoLbl = document.createElement('div');
    autoLbl.style.cssText = 'flex:1';
    autoLbl.innerHTML = '<div style="font-size:13px;font-weight:600;color:var(--text)">Rappel hebdomadaire</div><div style="font-size:10px;color:var(--muted);margin-top:1px">Notification chaque lundi pour sauvegarder</div>';
    const autoToggle = document.createElement('input');
    autoToggle.type='checkbox'; autoToggle.checked = S.icloudBackup?.autoBackup !== false;
    autoToggle.style.cssText='width:20px;height:20px;accent-color:var(--teal);cursor:pointer;flex-shrink:0';
    autoToggle.addEventListener('change', e => {
      if (!S.icloudBackup) S.icloudBackup = {};
      S.icloudBackup.autoBackup = e.target.checked;
      save();
    });
    autoRow.appendChild(autoLbl); autoRow.appendChild(autoToggle);

    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = 'padding:12px;border:none;background:none;color:var(--muted);font-size:14px;font-family:var(--font);cursor:pointer;touch-action:manipulation;-webkit-appearance:none;width:100%';
    closeBtn.textContent = 'Fermer';
    closeBtn.ontouchstart=(e)=>{e.preventDefault();overlay.remove();}; closeBtn.onclick=()=>overlay.remove();

    sheet.append(handle, title, statusCard, btnGrid, instrCard, autoRow, closeBtn);
    overlay.appendChild(sheet);
    overlay.ontouchstart=(e)=>{if(e.target===overlay)overlay.remove();};
    overlay.onclick=(e)=>{if(e.target===overlay)overlay.remove();};
    document.body.appendChild(overlay);
  },
};
window.iCloudDrive = iCloudDrive;


/* ════════════════════════════════════════════════════════════════
   2. APPLE WATCH — HealthKit enrichi
   Données : HRV, FC repos, VO2max, stades sommeil, calories, SpO2
   Format URL : ?hk_data=base64(json)
   ════════════════════════════════════════════════════════════════ */

const AppleWatch = {
  APP_URL: window.location.origin + window.location.pathname,

  /* Parser les données enrichies de l'Apple Watch */
  readWatchData() {
    const params = new URLSearchParams(window.location.search);

    // Format étendu via base64 JSON (nouveau format)
    const hkData = params.get('hk_data');
    if (hkData) {
      try {
        const decoded = JSON.parse(atob(hkData));
        AppleWatch._importWatchData(decoded);
        window.history.replaceState({}, '', window.location.pathname);
        return true;
      } catch(e) { console.warn('hk_data parse error:', e); }
    }

    // Format étendu via params individuels (rétrocompatibilité)
    const hkDate    = params.get('hk_date')     || (typeof localDateStr === 'function' ? localDateStr() : new Date().toISOString().slice(0,10));
    const hkHRV     = parseFloat(params.get('hk_hrv'))          || null;
    const hkRHR     = parseInt(params.get('hk_rhr'))             || null;
    const hkVO2     = parseFloat(params.get('hk_vo2max'))        || null;
    const hkDeep    = parseFloat(params.get('hk_sleep_deep'))    || null;
    const hkREM     = parseFloat(params.get('hk_sleep_rem'))     || null;
    const hkCore    = parseFloat(params.get('hk_sleep_core'))    || null;
    const hkCalAct  = parseInt(params.get('hk_cal_active'))      || null;
    const hkExMin   = parseInt(params.get('hk_exercise_min'))    || null;
    const hkSpO2    = parseFloat(params.get('hk_spo2'))          || null;
    const hkSkinT   = parseFloat(params.get('hk_skin_temp'))     || null;

    // Workout data (JSON encoded)
    let hkWorkout = null;
    try { hkWorkout = params.get('hk_workout') ? JSON.parse(decodeURIComponent(params.get('hk_workout'))) : null; } catch(e) {}

    // Paramètres legacy HealthKitBridge (hk_steps, hk_sleep, hk_weight)
    const hkSteps  = parseInt(params.get('hk_steps'))   || null;
    const hkSleep  = parseFloat(params.get('hk_sleep')) || null;
    const hkWeight = parseFloat(params.get('hk_weight'))|| null;

    const hasNew = hkHRV || hkRHR || hkVO2 || hkDeep || hkCalAct || hkSteps || hkSleep || hkWeight;
    if (!hasNew) return false;

    // Sync legacy steps/sleep/weight via Store
    if (hkSteps)  Store.dispatch({ type:'ACTIVITY_SET_STEPS', payload:{ date:hkDate, value:hkSteps }}, {skipUndo:true});
    if (hkSleep)  Store.dispatch({ type:'ACTIVITY_SET_SLEEP', payload:{ date:hkDate, value:{ hours:hkSleep, quality:1 }}}, {skipUndo:true});
    if (hkWeight) Store.dispatch({ type:'BODY_ADD_MESURE', payload:{ key:'poids', entry:{ val:hkWeight, date:hkDate }}});

    AppleWatch._importWatchData({ date:hkDate, hrv:hkHRV, rhr:hkRHR, vo2max:hkVO2, sleepDeep:hkDeep, sleepRem:hkREM, sleepCore:hkCore, calActive:hkCalAct, exerciseMin:hkExMin, spo2:hkSpO2, skinTemp:hkSkinT, workout:hkWorkout });
    window.history.replaceState({}, '', window.location.pathname);
    return true;
  },

  _importWatchData(data) {
    if (!data || !data.date) return;
    if (!S.watchData) S.watchData = { hrv:{}, rhr:{}, vo2max:{}, sleepDeep:{}, sleepRem:{}, sleepCore:{}, calActive:{}, exerciseMin:{}, spo2:{}, skinTemp:{}, workouts:[] };

    const d = data.date;
    if (data.hrv)        S.watchData.hrv[d]         = data.hrv;
    if (data.rhr)        S.watchData.rhr[d]         = data.rhr;
    if (data.vo2max)     S.watchData.vo2max[d]      = data.vo2max;
    if (data.sleepDeep)  S.watchData.sleepDeep[d]   = data.sleepDeep;
    if (data.sleepRem)   S.watchData.sleepRem[d]    = data.sleepRem;
    if (data.sleepCore)  S.watchData.sleepCore[d]   = data.sleepCore;
    if (data.calActive)  S.watchData.calActive[d]   = data.calActive;
    if (data.exerciseMin)S.watchData.exerciseMin[d] = data.exerciseMin;
    if (data.spo2)       S.watchData.spo2[d]        = data.spo2;
    if (data.skinTemp)   S.watchData.skinTemp[d]    = data.skinTemp;

    if (data.workout) {
      if (!S.watchData.workouts) S.watchData.workouts = [];
      // Éviter les doublons
      const exists = S.watchData.workouts.find(w => w.date === d && w.type === data.workout.type);
      if (!exists) S.watchData.workouts.unshift({ date:d, ...data.workout });
      S.watchData.workouts = S.watchData.workouts.slice(0, 50); // garder 50 derniers
    }

    if (typeof save === 'function') save();

    const imported = [];
    if (data.hrv)   imported.push('HRV ' + data.hrv + 'ms');
    if (data.rhr)   imported.push('FC repos ' + data.rhr + 'bpm');
    if (data.vo2max) imported.push('VO2max ' + data.vo2max);

    setTimeout(() => {
      if (typeof showToast === 'function' && imported.length) showToast('Apple Watch : ' + imported.join(', '), 'save', 4000);
      if (typeof renderDashboard === 'function') renderDashboard();
    }, 800);
  },

  /* Calcul du score de récupération (WHOOP-style) */
  calcRecoveryScore(date) {
    const d = date || (typeof localDateStr === 'function' ? localDateStr() : new Date().toISOString().slice(0,10));
    const wd = S.watchData || {};

    let score = 50; // base neutre
    let factors = [];
    let hasData = false;

    // HRV — indicateur principal (40% du score)
    const hrv = wd.hrv?.[d] || null;
    const hrv7 = Object.values(wd.hrv || {}).slice(-7).filter(v=>v>0);
    const hrvAvg = hrv7.length ? hrv7.reduce((a,b)=>a+b,0)/hrv7.length : null;
    if (hrv && hrvAvg) {
      hasData = true;
      const hrvRatio = hrv / hrvAvg;
      const hrvScore = Math.min(100, Math.max(0, 50 + (hrvRatio - 1) * 150));
      score = score * 0.6 + hrvScore * 0.4;
      factors.push({ label:'HRV', value:Math.round(hrv)+'ms', score:Math.round(hrvScore), icon:'💓', delta: hrv > hrvAvg ? '+' + Math.round(hrv-hrvAvg) + 'ms vs moy' : Math.round(hrv-hrvAvg) + 'ms vs moy' });
    }

    // FC repos — plus basse = meilleure récupération (25%)
    const rhr = wd.rhr?.[d] || null;
    const rhr7 = Object.values(wd.rhr || {}).slice(-7).filter(v=>v>0);
    const rhrAvg = rhr7.length ? rhr7.reduce((a,b)=>a+b,0)/rhr7.length : null;
    if (rhr && rhrAvg) {
      hasData = true;
      const rhrRatio = rhrAvg / rhr; // inversé : FC repos basse = bon
      const rhrScore = Math.min(100, Math.max(0, 50 + (rhrRatio - 1) * 150));
      score = score * 0.75 + rhrScore * 0.25;
      factors.push({ label:'FC Repos', value:rhr+'bpm', score:Math.round(rhrScore), icon:'❤️', delta: rhr < rhrAvg ? '-' + Math.round(rhrAvg-rhr) + 'bpm vs moy' : '+' + Math.round(rhr-rhrAvg) + 'bpm vs moy' });
    }

    // Sommeil (qualité) — stades profond + REM (25%)
    const sleepDeep = wd.sleepDeep?.[d] || 0;
    const sleepRem  = wd.sleepRem?.[d]  || 0;
    const sleepTotal = (S.sleep?.[d]?.hours || 0);
    if (sleepTotal > 0) {
      hasData = true;
      const qualityPct = sleepTotal > 0 ? (sleepDeep + sleepRem) / sleepTotal : 0.3;
      const sleepScore = Math.min(100, Math.max(0,
        (sleepTotal >= 7.5 ? 70 : sleepTotal >= 6 ? 50 : 30) +
        (qualityPct >= 0.35 ? 30 : qualityPct >= 0.25 ? 15 : 0)
      ));
      score = score * 0.75 + sleepScore * 0.25;
      factors.push({ label:'Sommeil', value: (sleepDeep+sleepRem).toFixed(1) + 'h qual./' + sleepTotal + 'h', score:Math.round(sleepScore), icon:'😴', delta: sleepDeep ? Math.round(sleepDeep*60)+'min profond' : '' });
    }

    if (!hasData) return null;

    const finalScore = Math.round(Math.min(100, Math.max(0, score)));
    let status, color, advice;
    if (finalScore >= 80)      { status='Optimal';    color='var(--green)';  advice='Chargez lourd aujourd hui — corps pret'; }
    else if (finalScore >= 65) { status='Bon';        color='var(--teal)';   advice='Seance normale — a lecoute du corps'; }
    else if (finalScore >= 45) { status='Moyen';      color='var(--orange)'; advice='Reduisez l intensite de 20%'; }
    else                       { status='Bas';        color='var(--red)';    advice='Repos ou seance tres legere conseille'; }

    return { score:finalScore, status, color, advice, factors, hrv, rhr, vo2max: wd.vo2max?.[d] };
  },

  /* Afficher le guide Raccourci Apple Watch */
  showWatchGuide() {
    document.getElementById('watch-guide-overlay')?.remove();
    const appURL = AppleWatch.APP_URL;

    const overlay = document.createElement('div');
    overlay.id = 'watch-guide-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.6);z-index:9500;display:flex;align-items:flex-end;justify-content:center';

    const sheet = document.createElement('div');
    sheet.style.cssText = 'background:var(--surface);border-radius:24px 24px 0 0;padding:20px 16px calc(24px + env(safe-area-inset-bottom,0px));width:100%;max-width:520px;max-height:90vh;overflow-y:auto;-webkit-overflow-scrolling:touch;display:flex;flex-direction:column;gap:12px';

    const handle = document.createElement('div');
    handle.style.cssText='width:36px;height:4px;border-radius:2px;background:var(--border);margin:0 auto';

    const title = document.createElement('div');
    title.style.cssText='font-size:17px;font-weight:700;color:var(--text)';
    title.textContent='⌚ Apple Watch — Configuration';

    // Ce que la Watch peut envoyer
    const dataCard = document.createElement('div');
    dataCard.style.cssText='background:var(--card);border-radius:14px;padding:14px;border:1px solid var(--border)';
    const dataTitle=document.createElement('div');dataTitle.style.cssText='font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:10px';dataTitle.textContent='Donnees disponibles depuis votre Watch';
    const dataItems=[
      ['💓','HRV (variabilite cardiaque)','Indicateur cle de recuperation'],
      ['❤️','FC au repos','Plus basse = meilleure recuperation'],
      ['🫁','VO2max estime','Capacite cardio-respiratoire'],
      ['😴','Stades de sommeil','Profond, REM, Core'],
      ['🔥','Calories actives','Depense pendant la journee'],
      ['⏱','Minutes d exercice','Objectif OMS : 30 min/jour'],
      ['🩸','SpO2 (oxygene sanguin)','Series 6+ uniquement'],
      ['🌡','Temperature cutanee','Series 8 / Ultra uniquement'],
    ];
    dataItems.forEach(([icon, label, sub]) => {
      const row=document.createElement('div');row.style.cssText='display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--border)';
      const ic=document.createElement('span');ic.style.cssText='font-size:16px;width:24px;text-align:center;flex-shrink:0';ic.textContent=icon;
      const info=document.createElement('div');
      info.innerHTML='<div style="font-size:12px;font-weight:600;color:var(--text)">'+label+'</div><div style="font-size:10px;color:var(--muted)">'+sub+'</div>';
      row.appendChild(ic);row.appendChild(info);
      dataCard.appendChild(row);
    });
    dataCard.insertBefore(dataTitle,dataCard.firstChild);

    // Étapes du Raccourci
    const stepsCard = document.createElement('div');
    stepsCard.style.cssText='background:var(--bg);border-radius:14px;padding:14px;border:1px solid var(--border)';
    const stepsTitle=document.createElement('div');stepsTitle.style.cssText='font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:10px';stepsTitle.textContent='Configuration du Raccourci iOS';
    [
      '1. Ouvrir l app Raccourcis sur iPhone',
      '2. Creer un nouveau raccourci',
      '3. Ajouter "Chercher echantillons de sante" pour chaque donnee',
      '4. HRV : type HeartRateVariability, derniere nuit',
      '5. FC repos : type RestingHeartRate, aujourd hui',
      '6. VO2max : type VO2Max, dernier',
      '7. Sommeil : type SleepAnalysis avec stades',
      '8. Ajouter action "Ouvrir URL" avec l URL ci-dessous',
      '9. Ajouter une Automatisation : chaque matin a 7h',
    ].forEach(s => {
      const el=document.createElement('div');el.style.cssText='font-size:11px;color:var(--muted);padding:3px 0;line-height:1.5';el.textContent=s;
      stepsCard.appendChild(el);
    });
    stepsCard.insertBefore(stepsTitle,stepsCard.firstChild);

    // URL template
    const urlBox = document.createElement('div');
    urlBox.style.cssText='background:var(--bg);border-radius:12px;padding:12px;border:1.5px solid var(--teal)';
    const urlLbl=document.createElement('div');urlLbl.style.cssText='font-size:10px;font-weight:700;text-transform:uppercase;color:var(--teal-d);margin-bottom:6px';urlLbl.textContent='URL du Raccourci (copier dans Raccourcis)';
    const urlVal=document.createElement('div');
    const urlStr = appURL + '?hk_date=DATE&hk_steps=PAS&hk_hrv=HRV&hk_rhr=FC_REPOS&hk_vo2max=VO2&hk_sleep=SOMMEIL_TOTAL&hk_sleep_deep=PROFOND&hk_sleep_rem=REM&hk_cal_active=CAL&hk_exercise_min=EXERCICE&hk_weight=POIDS&hk_spo2=SPO2';
    urlVal.style.cssText='font-family:var(--mono);font-size:9px;color:var(--text);word-break:break-all;line-height:1.6';
    urlVal.textContent=urlStr;
    const copyBtn=document.createElement('button');copyBtn.style.cssText='margin-top:8px;width:100%;padding:8px;border-radius:8px;border:none;background:var(--teal);color:#fff;font-size:12px;font-weight:700;font-family:var(--font);cursor:pointer;touch-action:manipulation;-webkit-appearance:none';
    copyBtn.textContent='Copier l URL';
    const doCopy=()=>{navigator.clipboard?.writeText(urlStr);if(typeof showToast==='function')showToast('URL copiee !','save',2000);};
    copyBtn.ontouchstart=(e)=>{e.preventDefault();doCopy();}; copyBtn.onclick=doCopy;
    urlBox.append(urlLbl,urlVal,copyBtn);

    // Test manuel
    const testCard = document.createElement('div');
    testCard.style.cssText='background:rgba(91,168,160,.08);border-radius:14px;padding:14px;border:1px solid rgba(91,168,160,.3)';
    const testTitle=document.createElement('div');testTitle.style.cssText='font-size:11px;font-weight:700;color:var(--teal-d);margin-bottom:10px';testTitle.textContent='Test manuel (sans Raccourci)';
    const testGrid=document.createElement('div');testGrid.style.cssText='display:grid;grid-template-columns:1fr 1fr;gap:6px';
    const testInputs={};
    [['hrv','HRV (ms)','45'],['rhr','FC repos (bpm)','52'],['vo2max','VO2max','48'],['sleepDeep','Sommeil prof (h)','1.5'],['sleepRem','Sommeil REM (h)','2.0'],['calActive','Cal. actives','650']].forEach(([key,lbl,ph])=>{
      const wrap=document.createElement('div');
      const l=document.createElement('div');l.style.cssText='font-size:9px;color:var(--muted);margin-bottom:3px';l.textContent=lbl;
      const i=document.createElement('input');i.type='number';i.placeholder=ph;
      i.style.cssText='width:100%;padding:6px 8px;border-radius:8px;border:1px solid var(--border);background:var(--bg);font-size:14px;font-family:var(--mono);color:var(--text);text-align:center;-webkit-appearance:none;box-sizing:border-box';
      testInputs[key]=i; wrap.appendChild(l); wrap.appendChild(i); testGrid.appendChild(wrap);
    });
    const testBtn=document.createElement('button');testBtn.style.cssText='width:100%;margin-top:8px;padding:10px;border-radius:10px;border:none;background:var(--teal);color:#fff;font-size:13px;font-weight:700;font-family:var(--font);cursor:pointer;touch-action:manipulation;-webkit-appearance:none';
    testBtn.textContent='Importer ces valeurs';
    const doTest=()=>{
      const today=typeof localDateStr==='function'?localDateStr():new Date().toISOString().slice(0,10);
      AppleWatch._importWatchData({
        date:today,
        hrv:parseFloat(testInputs.hrv.value)||null,
        rhr:parseInt(testInputs.rhr.value)||null,
        vo2max:parseFloat(testInputs.vo2max.value)||null,
        sleepDeep:parseFloat(testInputs.sleepDeep.value)||null,
        sleepRem:parseFloat(testInputs.sleepRem.value)||null,
        calActive:parseInt(testInputs.calActive.value)||null,
      });
      overlay.remove();
    };
    testBtn.ontouchstart=(e)=>{e.preventDefault();doTest();}; testBtn.onclick=doTest;
    testCard.append(testTitle,testGrid,testBtn);

    const closeBtn=document.createElement('button');closeBtn.style.cssText='padding:12px;border:none;background:none;color:var(--muted);font-size:14px;font-family:var(--font);cursor:pointer;touch-action:manipulation;-webkit-appearance:none;width:100%';closeBtn.textContent='Fermer';
    closeBtn.ontouchstart=(e)=>{e.preventDefault();overlay.remove();}; closeBtn.onclick=()=>overlay.remove();

    sheet.append(handle,title,dataCard,stepsCard,urlBox,testCard,closeBtn);
    overlay.appendChild(sheet);
    overlay.ontouchstart=(e)=>{if(e.target===overlay)overlay.remove();};
    overlay.onclick=(e)=>{if(e.target===overlay)overlay.remove();};
    document.body.appendChild(overlay);
  },
};
window.AppleWatch = AppleWatch;


/* ════════════════════════════════════════════════════════════════
   WIDGET RECUPERATION — WHOOP-style sur le Dashboard
   Appelé depuis render_dashboard.js
   ════════════════════════════════════════════════════════════════ */

window.renderRecoveryWidget = function(wrap) {
  const today = typeof localDateStr === 'function' ? localDateStr() : new Date().toISOString().slice(0,10);
  const rec = AppleWatch.calcRecoveryScore(today);
  if (!rec) return; // pas de données Watch

  const card = document.createElement('div');
  card.style.cssText='background:var(--card);border-radius:18px;padding:16px;margin:0 0 12px;border:1px solid var(--border)';

  const header = document.createElement('div');
  header.style.cssText='display:flex;align-items:center;justify-content:space-between;margin-bottom:12px';
  const htitle=document.createElement('div');htitle.style.cssText='font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)';htitle.textContent='⌚ Recuperation Apple Watch';
  const hbadge=document.createElement('div');hbadge.style.cssText='font-size:11px;font-weight:600;color:var(--muted);cursor:pointer;text-decoration:underline';hbadge.textContent='Config.';
  hbadge.ontouchstart=(e)=>{e.preventDefault();if(typeof AppleWatch!=='undefined')AppleWatch.showWatchGuide();};
  hbadge.onclick=()=>{if(typeof AppleWatch!=='undefined')AppleWatch.showWatchGuide();};
  header.appendChild(htitle);header.appendChild(hbadge);

  // Score principal
  const scoreRow=document.createElement('div');scoreRow.style.cssText='display:flex;align-items:center;gap:16px;margin-bottom:12px';
  const scoreCircle=document.createElement('div');
  scoreCircle.style.cssText='width:70px;height:70px;border-radius:50%;border:4px solid '+rec.color+';display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0';
  const scoreNum=document.createElement('div');scoreNum.style.cssText='font-family:var(--mono);font-size:22px;font-weight:800;color:'+rec.color;scoreNum.textContent=rec.score;
  const scoreUnit=document.createElement('div');scoreUnit.style.cssText='font-size:9px;color:var(--muted)';scoreUnit.textContent='/100';
  scoreCircle.appendChild(scoreNum);scoreCircle.appendChild(scoreUnit);
  const scoreInfo=document.createElement('div');
  const sStatus=document.createElement('div');sStatus.style.cssText='font-size:16px;font-weight:800;color:'+rec.color;sStatus.textContent=rec.status;
  const sAdvice=document.createElement('div');sAdvice.style.cssText='font-size:11px;color:var(--muted);margin-top:3px;line-height:1.4';sAdvice.textContent=rec.advice;
  scoreInfo.appendChild(sStatus);scoreInfo.appendChild(sAdvice);
  scoreRow.appendChild(scoreCircle);scoreRow.appendChild(scoreInfo);

  // Facteurs détaillés
  const factors=document.createElement('div');factors.style.cssText='display:flex;flex-direction:column;gap:6px';
  rec.factors.forEach(f=>{
    const frow=document.createElement('div');frow.style.cssText='display:flex;align-items:center;gap:8px';
    const ficon=document.createElement('span');ficon.style.cssText='font-size:14px;width:20px;text-align:center;flex-shrink:0';ficon.textContent=f.icon;
    const flbl=document.createElement('span');flbl.style.cssText='font-size:11px;font-weight:600;color:var(--text);width:70px;flex-shrink:0';flbl.textContent=f.label;
    const fbar=document.createElement('div');fbar.style.cssText='flex:1;height:5px;background:var(--border);border-radius:3px;overflow:hidden';
    const ffill=document.createElement('div');ffill.style.cssText='height:100%;border-radius:3px;background:var(--teal);transition:width .6s';ffill.style.width='0%';
    fbar.appendChild(ffill);
    const fval=document.createElement('span');fval.style.cssText='font-size:10px;font-family:var(--mono);color:var(--muted);min-width:60px;text-align:right;flex-shrink:0';fval.textContent=f.value;
    const fdelta=document.createElement('span');fdelta.style.cssText='font-size:9px;color:var(--muted);min-width:70px;text-align:right;flex-shrink:0';fdelta.textContent=f.delta||'';
    frow.append(ficon,flbl,fbar,fval,fdelta);
    factors.appendChild(frow);
    setTimeout(()=>{ffill.style.width=f.score+'%';},100);
  });

  // VO2max si disponible
  if (rec.vo2max) {
    const vo2row=document.createElement('div');vo2row.style.cssText='display:flex;align-items:center;gap:8px;margin-top:6px;padding-top:6px;border-top:1px solid var(--border)';
    vo2row.innerHTML='<span style="font-size:14px">🫁</span><span style="font-size:11px;color:var(--muted)">VO2max</span><span style="font-family:var(--mono);font-size:13px;font-weight:700;color:var(--text);margin-left:auto">'+rec.vo2max+' ml/kg/min</span>';
    factors.appendChild(vo2row);
  }

  card.appendChild(header);card.appendChild(scoreRow);card.appendChild(factors);
  wrap.appendChild(card);
};


/* ════════════════════════════════════════════════════════════════
   INITIALISATION
   ════════════════════════════════════════════════════════════════ */

window.addEventListener('load', () => {
  setTimeout(() => {
    if (typeof Store !== 'undefined') {
      // Lire les données Apple Watch depuis l'URL
      AppleWatch.readWatchData();

      // Rappel sauvegarde iCloud (chaque lundi si activé)
      const today = new Date();
      if (today.getDay() === 1 && S.icloudBackup?.autoBackup !== false) {
        const last = S.icloudBackup?.lastBackup;
        const daysSince = last ? Math.floor((Date.now() - new Date(last)) / (1000*60*60*24)) : 999;
        if (daysSince >= 7) {
          setTimeout(() => {
            if (typeof showToast === 'function') showToast('Rappel : pensez a sauvegarder vos donnees sur iCloud', 'warn', 6000);
          }, 3000);
        }
      }
    }
  }, 1000);
});
