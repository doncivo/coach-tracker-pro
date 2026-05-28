/* ================================================================
   api-integrations.js
   
   1. Open Food Facts — nutrition depuis code-barres
   2. Apple HealthKit bridge — sync via iOS Shortcuts + URL params
   3. Wger REST API — enrichissement exercices (images, instructions)
   ================================================================ */

'use strict';

/* ════════════════════════════════════════════════════════════════
   1. OPEN FOOD FACTS
   Docs : https://world.openfoodfacts.org/data
   CORS : oui, gratuit, pas d'auth
   ════════════════════════════════════════════════════════════════ */

const OpenFoodFacts = {
  BASE: 'https://world.openfoodfacts.org/api/v0/product/',

  async lookup(barcode) {
    if (!barcode || !/^\d{8,14}$/.test(barcode.toString())) {
      throw new Error('Code-barres invalide');
    }
    const url = OpenFoodFacts.BASE + barcode + '.json';
    const resp = await fetch(url, { headers: { 'User-Agent': 'CoachTrackerPro/1.0' } });
    if (!resp.ok) throw new Error('Produit non trouve (HTTP ' + resp.status + ')');
    const data = await resp.json();
    if (data.status === 0 || !data.product) throw new Error('Produit inconnu dans Open Food Facts');

    const p = data.product;
    const n = p.nutriments || {};
    return {
      name:    p.product_name_fr || p.product_name || p.generic_name || 'Produit inconnu',
      brand:   p.brands || '',
      cal:     Math.round(n['energy-kcal_100g'] || n['energy-kcal'] || 0),
      protein: Math.round((n.proteins_100g || 0) * 10) / 10,
      carbs:   Math.round((n.carbohydrates_100g || 0) * 10) / 10,
      fat:     Math.round((n.fat_100g || 0) * 10) / 10,
      fiber:   Math.round((n.fiber_100g || 0) * 10) / 10,
      sugar:   Math.round((n.sugars_100g || 0) * 10) / 10,
      imageUrl: p.image_front_small_url || p.image_url || null,
      barcode,
    };
  },

  /* Affiche un modal de confirmation avant d'insérer les données */
  async scanAndFill(barcode, callback) {
    if (typeof showToast === 'function') showToast('Recherche du produit...', 'save', 2000);
    try {
      const product = await OpenFoodFacts.lookup(barcode);
      OpenFoodFacts._showProductModal(product, callback);
    } catch(err) {
      if (typeof showToast === 'function') showToast('OFF : ' + err.message, 'error', 4000);
      // Fallback : retourner données vides avec le code-barres
      if (callback) callback({ name: 'Produit ' + barcode, cal: 0, protein: 0, carbs: 0, fat: 0 });
    }
  },

  _showProductModal(product, callback) {
    document.getElementById('off-product-modal')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'off-product-modal';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.55);z-index:9500;display:flex;align-items:flex-end;justify-content:center';

    const sheet = document.createElement('div');
    sheet.style.cssText = 'background:var(--surface);border-radius:24px 24px 0 0;padding:20px 16px calc(20px + env(safe-area-inset-bottom,0px));width:100%;max-width:480px';

    const handle = document.createElement('div');
    handle.style.cssText = 'width:36px;height:4px;border-radius:2px;background:var(--border);margin:0 auto 14px';

    // Product header
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;gap:12px;align-items:flex-start;margin-bottom:14px';

    if (product.imageUrl) {
      const img = document.createElement('img');
      img.src = product.imageUrl; img.alt = '';
      img.style.cssText = 'width:56px;height:56px;border-radius:10px;object-fit:contain;background:var(--bg);border:1px solid var(--border);flex-shrink:0';
      img.onerror = () => img.remove();
      header.appendChild(img);
    }

    const info = document.createElement('div');
    info.style.cssText = 'flex:1;min-width:0';
    const pName = document.createElement('div');
    pName.style.cssText = 'font-size:15px;font-weight:700;color:var(--text);margin-bottom:2px';
    pName.textContent = product.name;
    const pBrand = document.createElement('div');
    pBrand.style.cssText = 'font-size:11px;color:var(--muted)';
    pBrand.textContent = product.brand || 'Open Food Facts';
    info.appendChild(pName); if (product.brand) info.appendChild(pBrand);
    header.appendChild(info);

    // Nutrition per 100g
    const nutGrid = document.createElement('div');
    nutGrid.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:6px;background:var(--bg);border-radius:12px;padding:12px;margin-bottom:12px';
    [
      ['Calories', product.cal, 'kcal', 'var(--orange)'],
      ['Proteines', product.protein, 'g', 'var(--red)'],
      ['Glucides', product.carbs, 'g', 'var(--teal)'],
      ['Lipides', product.fat, 'g', 'var(--purple)'],
    ].forEach(([lbl, val, unit, color]) => {
      const cell = document.createElement('div');
      cell.style.cssText = 'text-align:center';
      cell.innerHTML = '<div style="font-family:var(--mono);font-size:16px;font-weight:800;color:'+color+'">'+val+'</div>' +
        '<div style="font-size:9px;color:var(--muted)">'+lbl+'</div>' +
        '<div style="font-size:8px;color:var(--muted)">'+unit+'/100g</div>';
      nutGrid.appendChild(cell);
    });

    // Portion selector
    const portRow = document.createElement('div');
    portRow.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:14px';
    const portLbl = document.createElement('label');
    portLbl.style.cssText = 'font-size:12px;font-weight:700;color:var(--muted);flex-shrink:0';
    portLbl.textContent = 'Portion :';
    const portInp = document.createElement('input');
    portInp.type='number'; portInp.min=10; portInp.max=2000; portInp.step=10; portInp.value='100';
    portInp.style.cssText = 'width:80px;padding:8px 10px;border-radius:10px;border:1.5px solid var(--teal);background:var(--bg);font-size:16px;font-weight:700;font-family:var(--mono);color:var(--text);text-align:center;-webkit-appearance:none';
    const portUnit = document.createElement('span');
    portUnit.style.cssText = 'font-size:12px;color:var(--muted)';
    portUnit.textContent = 'g — soit :';
    const portCalc = document.createElement('span');
    portCalc.style.cssText = 'font-size:13px;font-weight:700;color:var(--orange)';

    function updatePortCalc() {
      const p2 = parseFloat(portInp.value) || 100;
      const ratio = p2 / 100;
      portCalc.textContent = Math.round(product.cal * ratio) + ' kcal, ' + Math.round(product.protein * ratio * 10) / 10 + 'g prot.';
    }
    updatePortCalc();
    portInp.addEventListener('input', updatePortCalc);
    portRow.append(portLbl, portInp, portUnit, portCalc);

    // Buttons
    const btns = document.createElement('div');
    btns.style.cssText = 'display:flex;gap:8px';

    const addBtn = document.createElement('button');
    addBtn.style.cssText = 'flex:2;padding:13px;border-radius:14px;border:none;background:var(--teal);color:#fff;font-size:15px;font-weight:700;font-family:var(--font);cursor:pointer;touch-action:manipulation;-webkit-appearance:none';
    addBtn.textContent = '+ Ajouter a ce repas';

    const cancelBtn = document.createElement('button');
    cancelBtn.style.cssText = 'flex:1;padding:13px;border-radius:14px;border:1.5px solid var(--border);background:transparent;color:var(--muted);font-size:14px;font-weight:700;font-family:var(--font);cursor:pointer;touch-action:manipulation;-webkit-appearance:none';
    cancelBtn.textContent = 'Annuler';

    const doAdd = () => {
      const portion = parseFloat(portInp.value) || 100;
      const ratio = portion / 100;
      overlay.remove();
      if (callback) callback({
        name:    product.name + (portion !== 100 ? ' (' + portion + 'g)' : ''),
        cal:     Math.round(product.cal     * ratio),
        protein: Math.round(product.protein * ratio * 10) / 10,
        carbs:   Math.round(product.carbs   * ratio * 10) / 10,
        fat:     Math.round(product.fat     * ratio * 10) / 10,
      });
    };
    addBtn.ontouchstart = (e) => { e.preventDefault(); doAdd(); };
    addBtn.onclick = doAdd;
    cancelBtn.ontouchstart = (e) => { e.preventDefault(); overlay.remove(); };
    cancelBtn.onclick = () => overlay.remove();
    btns.append(cancelBtn, addBtn);

    sheet.append(handle, header, nutGrid, portRow, btns);
    overlay.appendChild(sheet);
    overlay.ontouchstart = (e) => { if (e.target === overlay) overlay.remove(); };
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    document.body.appendChild(overlay);
  },
};
window.OpenFoodFacts = OpenFoodFacts;


/* ════════════════════════════════════════════════════════════════
   2. APPLE HEALTHKIT BRIDGE
   Mécanisme : iOS Shortcut → ouvre URL avec params → app importe
   URL format : https://app.com/?hk_steps=8500&hk_sleep=7.5&hk_weight=80.5&hk_date=2026-05-28&hk_cal=2100
   ════════════════════════════════════════════════════════════════ */

const HealthKitBridge = {

  /* Lire les params URL au démarrage */
  readURLParams() {
    const params = new URLSearchParams(window.location.search);
    const hkDate    = params.get('hk_date');
    const hkSteps   = parseInt(params.get('hk_steps'))    || null;
    const hkSleep   = parseFloat(params.get('hk_sleep'))  || null;
    const hkWeight  = parseFloat(params.get('hk_weight')) || null;
    const hkCal     = parseInt(params.get('hk_calories')) || null;
    const hkHR      = parseInt(params.get('hk_hr_avg'))   || null;

    if (!hkDate && !hkSteps && !hkSleep && !hkWeight) return false;

    const dateKey = hkDate || (typeof localDateStr === 'function' ? localDateStr() : new Date().toISOString().slice(0,10));
    let imported = [];

    if (hkSteps) {
      Store.dispatch({ type:'ACTIVITY_SET_STEPS', payload: { date:dateKey, value:hkSteps } }, { skipUndo:true });
      imported.push(hkSteps.toLocaleString('fr') + ' pas');
    }
    if (hkSleep) {
      Store.dispatch({ type:'ACTIVITY_SET_SLEEP', payload: { date:dateKey, value:{ hours:hkSleep, quality:1 } } }, { skipUndo:true });
      imported.push(hkSleep + 'h sommeil');
    }
    if (hkWeight) {
      Store.dispatch({ type:'BODY_ADD_MESURE', payload: { key:'poids', entry:{ val:hkWeight, date:dateKey } } });
      imported.push(hkWeight + 'kg poids');
    }
    if (hkCal) {
      imported.push(hkCal + ' kcal actives');
    }

    if (imported.length > 0) {
      if (typeof save === 'function') save();
      // Nettoyer l'URL
      window.history.replaceState({}, '', window.location.pathname);
      setTimeout(() => {
        if (typeof showToast === 'function') showToast('HealthKit sync : ' + imported.join(', '), 'save', 4000);
        if (typeof renderDashboard === 'function') renderDashboard();
      }, 1000);
      return true;
    }
    return false;
  },

  /* Generér le guide Shortcut pour l'utilisateur */
  getShortcutURL() {
    return window.location.origin + window.location.pathname;
  },

  showSetupGuide() {
    document.getElementById('hk-setup-overlay')?.remove();

    const appURL = HealthKitBridge.getShortcutURL();
    const overlay = document.createElement('div');
    overlay.id = 'hk-setup-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.6);z-index:9500;display:flex;align-items:flex-end;justify-content:center';

    const sheet = document.createElement('div');
    sheet.style.cssText = 'background:var(--surface);border-radius:24px 24px 0 0;padding:20px 16px calc(24px + env(safe-area-inset-bottom,0px));width:100%;max-width:520px;max-height:90vh;overflow-y:auto;-webkit-overflow-scrolling:touch';

    const handle = document.createElement('div');
    handle.style.cssText = 'width:36px;height:4px;border-radius:2px;background:var(--border);margin:0 auto 14px';

    const title = document.createElement('div');
    title.style.cssText = 'font-size:17px;font-weight:700;color:var(--text);margin-bottom:6px';
    title.textContent = 'Connexion Apple Sante';

    const sub = document.createElement('div');
    sub.style.cssText = 'font-size:12px;color:var(--muted);margin-bottom:16px;line-height:1.5';
    sub.textContent = 'Creez un raccourci iOS qui lit vos donnees Apple Sante et les envoie automatiquement a Coach Tracker.';

    // Steps
    const steps = [
      { icon: '1️⃣', title: 'Ouvrir Raccourcis', body: 'Sur iPhone, ouvrez l\'app Raccourcis et creez un nouveau raccourci.' },
      { icon: '2️⃣', title: 'Ajouter les actions', body: 'Ajoutez : "Chercher echantillons de sante" pour Pas, Sommeil et Poids. Choisissez la periode "Aujourd\'hui".' },
      { icon: '3️⃣', title: 'Ouvrir l\'URL', body: 'Ajoutez l\'action "Ouvrir l\'URL" avec l\'URL ci-dessous (remplacez les valeurs par vos resultats Sante).' },
      { icon: '4️⃣', title: 'Automatiser', body: 'Ajoutez une Automatisation iOS qui lance ce raccourci chaque matin a 8h.' },
    ];

    steps.forEach(s => {
      const step = document.createElement('div');
      step.style.cssText = 'display:flex;gap:10px;margin-bottom:12px;padding:10px 12px;background:var(--card);border-radius:12px;border:1px solid var(--border)';
      const icon = document.createElement('span'); icon.style.cssText = 'font-size:18px;flex-shrink:0'; icon.textContent = s.icon;
      const text = document.createElement('div');
      const t = document.createElement('div'); t.style.cssText = 'font-size:12px;font-weight:700;color:var(--text);margin-bottom:2px'; t.textContent = s.title;
      const b = document.createElement('div'); b.style.cssText = 'font-size:11px;color:var(--muted);line-height:1.4'; b.textContent = s.body;
      text.appendChild(t); text.appendChild(b);
      step.appendChild(icon); step.appendChild(text);
      sheet.appendChild(step);
    });

    // URL template
    const urlBox = document.createElement('div');
    urlBox.style.cssText = 'background:var(--bg);border-radius:12px;padding:12px;margin-bottom:14px;border:1px solid var(--border)';
    const urlLbl = document.createElement('div');
    urlLbl.style.cssText = 'font-size:10px;font-weight:700;text-transform:uppercase;color:var(--muted);margin-bottom:6px';
    urlLbl.textContent = 'URL du raccourci (copier-coller dans Raccourcis)';
    const urlExample = document.createElement('div');
    urlExample.style.cssText = 'font-family:var(--mono);font-size:10px;color:var(--text);word-break:break-all;line-height:1.5';
    urlExample.textContent = appURL + '?hk_date=DATE&hk_steps=PAS&hk_sleep=SOMMEIL&hk_weight=POIDS';

    const copyBtn = document.createElement('button');
    copyBtn.style.cssText = 'margin-top:8px;width:100%;padding:8px;border-radius:8px;border:none;background:var(--teal);color:#fff;font-size:12px;font-weight:700;font-family:var(--font);cursor:pointer;touch-action:manipulation;-webkit-appearance:none';
    copyBtn.textContent = 'Copier l\'URL';
    copyBtn.onclick = () => {
      navigator.clipboard?.writeText(appURL + '?hk_date=DATE&hk_steps=PAS&hk_sleep=SOMMEIL&hk_weight=POIDS');
      if (typeof showToast === 'function') showToast('URL copiee !', 'save', 2000);
    };
    copyBtn.ontouchstart = (e) => { e.preventDefault(); copyBtn.onclick(); };

    urlBox.appendChild(urlLbl); urlBox.appendChild(urlExample); urlBox.appendChild(copyBtn);
    sheet.appendChild(urlBox);

    // Test button
    const testDiv = document.createElement('div');
    testDiv.style.cssText = 'background:rgba(91,168,160,.08);border:1px solid rgba(91,168,160,.3);border-radius:12px;padding:12px;margin-bottom:14px';
    const testLbl = document.createElement('div');
    testLbl.style.cssText = 'font-size:11px;font-weight:700;color:var(--teal-d);margin-bottom:8px';
    testLbl.textContent = 'Tester l\'import manuellement';
    const testRow = document.createElement('div');
    testRow.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap';
    function mkTestInp(ph, w) {
      const i = document.createElement('input'); i.type='number'; i.placeholder=ph;
      i.style.cssText='width:'+w+';padding:6px 8px;border-radius:8px;border:1px solid var(--border);background:var(--bg);font-size:14px;font-family:var(--mono);color:var(--text);text-align:center;-webkit-appearance:none';
      return i;
    }
    const tSteps = mkTestInp('Pas', '80px');
    const tSleep = mkTestInp('Sommeil', '75px');
    const tWeight= mkTestInp('Poids', '70px');
    const tApply = document.createElement('button');
    tApply.style.cssText = 'padding:6px 12px;border-radius:8px;border:none;background:var(--teal);color:#fff;font-size:12px;font-weight:700;font-family:var(--font);cursor:pointer;touch-action:manipulation;-webkit-appearance:none';
    tApply.textContent = 'Importer';
    tApply.onclick = () => {
      const steps = parseInt(tSteps.value)||0, sleep = parseFloat(tSleep.value)||0, weight = parseFloat(tWeight.value)||0;
      const today = typeof localDateStr === 'function' ? localDateStr() : new Date().toISOString().slice(0,10);
      if (steps)  Store.dispatch({ type:'ACTIVITY_SET_STEPS',  payload:{ date:today, value:steps  }}, {skipUndo:true});
      if (sleep)  Store.dispatch({ type:'ACTIVITY_SET_SLEEP',  payload:{ date:today, value:{ hours:sleep, quality:1 }}}, {skipUndo:true});
      if (weight) Store.dispatch({ type:'BODY_ADD_MESURE',     payload:{ key:'poids', entry:{ val:weight, date:today }}});
      if (typeof save==='function') save();
      overlay.remove();
      if (typeof showToast==='function') showToast('Donnees importees depuis HealthKit test', 'save', 3000);
      if (typeof renderDashboard==='function') renderDashboard();
    };
    tApply.ontouchstart=(e)=>{e.preventDefault();tApply.onclick();};
    testRow.append(tSteps, tSleep, tWeight, tApply);
    testDiv.appendChild(testLbl); testDiv.appendChild(testRow);
    sheet.appendChild(testDiv);

    const closeBtn = document.createElement('button');
    closeBtn.style.cssText='width:100%;padding:12px;border:none;background:none;color:var(--muted);font-size:14px;font-family:var(--font);cursor:pointer;touch-action:manipulation;-webkit-appearance:none';
    closeBtn.textContent='Fermer';
    closeBtn.ontouchstart=(e)=>{e.preventDefault();overlay.remove();};
    closeBtn.onclick=()=>overlay.remove();
    sheet.appendChild(closeBtn);

    sheet.prepend(sub); sheet.prepend(title); sheet.prepend(handle);
    overlay.appendChild(sheet);
    overlay.ontouchstart=(e)=>{if(e.target===overlay)overlay.remove();};
    overlay.onclick=(e)=>{if(e.target===overlay)overlay.remove();};
    document.body.appendChild(overlay);
  },
};
window.HealthKitBridge = HealthKitBridge;


/* ════════════════════════════════════════════════════════════════
   3. WGER REST API
   Docs : https://wger.de/api/v2/
   CORS : oui, gratuit, pas d'auth
   ════════════════════════════════════════════════════════════════ */

const WgerAPI = {
  BASE: 'https://wger.de/api/v2',
  LANG: 2, // Francais = 1, Anglais = 2

  _cache: {},

  async searchExercise(name) {
    const q = encodeURIComponent(name);
    const url = WgerAPI.BASE + '/exercise/search/?term=' + q + '&language=french&format=json';
    if (WgerAPI._cache[url]) return WgerAPI._cache[url];

    const resp = await fetch(url);
    if (!resp.ok) throw new Error('Wger : impossible de rechercher');
    const data = await resp.json();
    if (Object.keys(WgerAPI._cache).length > 50) delete WgerAPI._cache[Object.keys(WgerAPI._cache)[0]];
    WgerAPI._cache[url] = data.suggestions || [];
    return data.suggestions || [];
  },

  async getExerciseInfo(id) {
    const url = WgerAPI.BASE + '/exerciseinfo/' + id + '/?format=json';
    if (WgerAPI._cache[url]) return WgerAPI._cache[url];

    const resp = await fetch(url);
    if (!resp.ok) throw new Error('Wger : exercice introuvable');
    const data = await resp.json();
    if (Object.keys(WgerAPI._cache).length > 50) delete WgerAPI._cache[Object.keys(WgerAPI._cache)[0]];
    WgerAPI._cache[url] = data;
    return data;
  },

  /* Afficher les details Wger d'un exercice */
  async showExerciseDetail(exerciseName, targetEl) {
    if (!targetEl) return;
    targetEl.innerHTML = '<div style="font-size:11px;color:var(--muted);padding:8px">Recherche sur Wger...</div>';

    try {
      const suggestions = await WgerAPI.searchExercise(exerciseName);
      if (!suggestions.length) {
        targetEl.innerHTML = '<div style="font-size:11px;color:var(--muted);padding:8px">Aucun resultat Wger pour cet exercice</div>';
        return;
      }

      const first = suggestions[0];
      const info = await WgerAPI.getExerciseInfo(first.data?.id || first.id);

      targetEl.innerHTML = '';
      const card = document.createElement('div');
      card.style.cssText = 'background:var(--card);border-radius:12px;padding:12px;border:1px solid var(--border)';

      const wgerTitle = document.createElement('div');
      wgerTitle.style.cssText = 'font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--teal-d);margin-bottom:8px;display:flex;align-items:center;gap:6px';
      wgerTitle.innerHTML = '<span>🏋️ Wger — ' + (info.translations?.[0]?.name || exerciseName) + '</span>';

      card.appendChild(wgerTitle);

      // Image
      if (info.images && info.images.length > 0) {
        const imgRow = document.createElement('div');
        imgRow.style.cssText = 'display:flex;gap:8px;margin-bottom:10px;overflow-x:auto';
        info.images.slice(0, 3).forEach(img => {
          const i = document.createElement('img');
          i.src = img.image; i.alt = exerciseName;
          i.style.cssText = 'height:90px;border-radius:8px;object-fit:cover;flex-shrink:0;border:1px solid var(--border)';
          i.onerror = () => i.remove();
          imgRow.appendChild(i);
        });
        card.appendChild(imgRow);
      }

      // Muscles
      const allMuscles = [...(info.muscles||[]), ...(info.muscles_secondary||[])];
      if (allMuscles.length > 0) {
        const muscleRow = document.createElement('div');
        muscleRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px';
        const muscLbl = document.createElement('div');
        muscLbl.style.cssText = 'width:100%;font-size:9px;font-weight:700;text-transform:uppercase;color:var(--muted);margin-bottom:2px';
        muscLbl.textContent = 'Muscles';
        muscleRow.appendChild(muscLbl);
        info.muscles?.forEach(m => {
          const chip = document.createElement('span');
          chip.style.cssText = 'font-size:10px;padding:2px 8px;border-radius:6px;background:rgba(91,168,160,.15);color:var(--teal-d);font-weight:600';
          chip.textContent = m.name_en || m.name;
          muscleRow.appendChild(chip);
        });
        info.muscles_secondary?.forEach(m => {
          const chip = document.createElement('span');
          chip.style.cssText = 'font-size:10px;padding:2px 8px;border-radius:6px;background:var(--border);color:var(--muted)';
          chip.textContent = (m.name_en || m.name) + ' (sec.)';
          muscleRow.appendChild(chip);
        });
        card.appendChild(muscleRow);
      }

      // Instructions
      const trans = info.translations?.find(t => t.language === 2) || info.translations?.[0];
      if (trans?.description) {
        const desc = document.createElement('div');
        desc.style.cssText = 'font-size:11px;color:var(--muted);line-height:1.5;max-height:100px;overflow-y:auto';
        // Strip HTML tags from description
        const cleanDesc = (trans.description || '').replace(/<[^>]*>/g,'').trim().slice(0, 400);
        desc.textContent = cleanDesc + (cleanDesc.length >= 400 ? '...' : '');
        card.appendChild(desc);
      }

      targetEl.appendChild(card);
    } catch(err) {
      targetEl.innerHTML = '<div style="font-size:10px;color:var(--muted);padding:8px">Wger hors-ligne ou exercice inconnu</div>';
    }
  },
};
window.WgerAPI = WgerAPI;


/* ════════════════════════════════════════════════════════════════
   INITIALISATION — lire les params URL HealthKit au démarrage
   ════════════════════════════════════════════════════════════════ */

window.addEventListener('load', () => {
  // Lire les donnees HealthKit depuis l'URL
  // Lecture des params URL déléguée à AppleWatch.readWatchData() (icloud-watch.js)
  // HealthKitBridge.readURLParams() désactivé pour éviter le double dispatch
});
