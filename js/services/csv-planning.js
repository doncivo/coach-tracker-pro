/* ================================================================
   csv-planning.js — Import / Export du planning en CSV
   
   Format CSV d'import :
   Jour,Exercice,Muscle,Poids,Series,Reps,Repos,Tempo,Note
   Lundi,Développé couché barre,pec,80,4,5-8,180,,
   
   Colonnes acceptées (insensible à la casse) :
   - Jour       : Lundi/Mardi/.../L/M/... (ou index 0-6)
   - Exercice   : nom libre
   - Muscle     : clé muscle (pec/dos/jam/ep/bic/tri/abd/bas/car/mob/rep)
   - Poids      : nombre (kg, optionnel)
   - Séries/Series : entier
   - Reps       : ex: 8-12 ou 8
   - Repos      : secondes (optionnel)
   - Tempo      : ex: 3-1-2 (optionnel)
   - Note       : texte libre (optionnel)
   ================================================================ */

'use strict';

(function() {

const DAY_MAP = {
  'lundi':0,'lun':0,'l':0,'monday':0,'mon':0,'0':0,
  'mardi':1,'mar':1,'m':1,'tuesday':1,'tue':1,'1':1,
  'mercredi':2,'mer':2,'wednesday':2,'wed':2,'2':2,
  'jeudi':3,'jeu':3,'j':3,'thursday':3,'thu':3,'3':3,
  'vendredi':4,'ven':4,'v':4,'friday':4,'fri':4,'4':4,
  'samedi':5,'sam':5,'s':5,'saturday':5,'sat':5,'5':5,
  'dimanche':6,'dim':6,'d':6,'sunday':6,'sun':6,'6':6,
};

const MUSCLE_MAP = {
  'pec':'pec','pectoraux':'pec','poitrine':'pec','chest':'pec',
  'dos':'dos','back':'dos','dorsaux':'dos',
  'jam':'jam','jambes':'jam','legs':'jam','quadriceps':'jam','quads':'jam',
  'ep':'ep','epaules':'ep','shoulders':'ep',
  'bic':'bic','biceps':'bic',
  'tri':'tri','triceps':'tri',
  'abd':'abd','abdominaux':'abd','abs':'abd','core':'abd',
  'bas':'bas','bas du dos':'bas','lower back':'bas',
  'car':'car','cardio':'car',
  'mob':'mob','mobilite':'mob',
  'rep':'rep','repos':'rep','rest':'rep',
};

/* ── Parser CSV robuste (gère guillemets, virgules dans champs) ── */
function parseCSV(text) {
  const lines = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n');
  const rows = [];
  
  function parseLine(line) {
    const result = [];
    let inQuote = false, cur = '';
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuote && line[i+1] === '"') { cur += '"'; i++; }
        else inQuote = !inQuote;
      } else if (c === ',' && !inQuote) {
        result.push(cur.trim()); cur = '';
      } else {
        cur += c;
      }
    }
    result.push(cur.trim());
    return result;
  }
  
  for (const line of lines) {
    if (line.trim()) rows.push(parseLine(line));
  }
  return rows;
}

/* ── Mapper les en-têtes ── */
function mapHeaders(headers) {
  const map = {};
  headers.forEach((h, i) => {
    const key = h.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // enlever accents
      .replace(/[^a-z0-9]/g, '');
    const aliases = {
      jour:    ['jour','day','jours'],
      name:    ['exercice','exercise','nom','name','mouvement'],
      muscle:  ['muscle','groupe','group','muscles'],
      weight:  ['poids','weight','charge','kg'],
      sets:    ['series','sets','serie'],
      reps:    ['reps','repetitions','rep','reps'],
      rest:    ['repos','rest','recuperation','temps'],
      tempo:   ['tempo'],
      note:    ['note','notes','commentaire'],
      warmup:  ['echauffement','warmup','chaud'],
    };
    for (const [field, names] of Object.entries(aliases)) {
      if (names.some(n => key.includes(n))) { map[field] = i; break; }
    }
  });
  return map;
}

/* ── Import principal ── */
window.importPlanningCSV = function(file) {
  return new Promise((resolve, reject) => {
    if (!file) { reject(new Error('Aucun fichier')); return; }
    if (file.size > 1024 * 1024) { reject(new Error('Fichier trop grand (max 1 MB)')); return; }
    
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const rows = parseCSV(e.target.result);
        if (rows.length < 2) throw new Error('CSV vide ou trop court');
        
        const headers = rows[0];
        const colMap  = mapHeaders(headers);
        
        if (colMap.jour === undefined) throw new Error('Colonne "Jour" introuvable');
        if (colMap.name === undefined) throw new Error('Colonne "Exercice" introuvable');
        
        // Grouper par jour
        const dayExercises = {0:[],1:[],2:[],3:[],4:[],5:[],6:[]};
        const errors = [];
        
        rows.slice(1).forEach((row, ri) => {
          if (!row.length || !row[colMap.jour]?.trim()) return;
          
          const dayRaw = row[colMap.jour].toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
          const dayIdx = DAY_MAP[dayRaw];
          
          if (dayIdx === undefined) {
            errors.push('Ligne '+(ri+2)+' : jour inconnu "'+row[colMap.jour]+'"');
            return;
          }
          
          const name = (row[colMap.name] || '').trim();
          if (!name) return;
          
          // Sanitize strings
          const esc = s => (typeof escHtml === 'function' ? escHtml(s) : s).slice(0, 200);
          
          const muscleRaw = ((colMap.muscle !== undefined ? row[colMap.muscle] : '') || '')
            .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
          const muscle = MUSCLE_MAP[muscleRaw] || 'pec';
          
          const weight = (colMap.weight !== undefined ? row[colMap.weight] : '') || '';
          const sets   = (colMap.sets   !== undefined ? row[colMap.sets]   : '') || '3';
          const reps   = (colMap.reps   !== undefined ? row[colMap.reps]   : '') || '8-12';
          const rest   = (colMap.rest   !== undefined ? row[colMap.rest]   : '') || '';
          const tempo  = (colMap.tempo  !== undefined ? row[colMap.tempo]  : '') || '';
          const note   = (colMap.note   !== undefined ? row[colMap.note]   : '') || '';
          const isWarm = colMap.warmup !== undefined && row[colMap.warmup]?.toLowerCase() === 'oui';
          
          dayExercises[dayIdx].push({
            id: typeof uid === 'function' ? uid() : Math.random().toString(36).slice(2),
            name: esc(name),
            muscle,
            weight: String(parseFloat(weight) || ''),
            sets:   String(parseInt(sets) || 3),
            reps:   esc(reps),
            rest:   String(parseInt(rest) || ''),
            tempo:  esc(tempo),
            note:   esc(note),
            repsAchieved: '', rpe: '', rir: '',
            done: false, isWarmup: isWarm,
            supersetGroup: '', setData: null,
          });
        });
        
        resolve({ dayExercises, errors, total: Object.values(dayExercises).flat().length });
      } catch(err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
};

/* ── Prévisualisation avant application ── */
window.showCSVImportPreview = function(dayExercises, errors, total) {
  document.getElementById('csv-preview-overlay')?.remove();
  
  const overlay = document.createElement('div');
  overlay.id = 'csv-preview-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.6);z-index:9400;display:flex;align-items:flex-end;justify-content:center';
  
  const sheet = document.createElement('div');
  sheet.style.cssText = 'background:var(--surface);border-radius:24px 24px 0 0;padding:20px 16px calc(20px + env(safe-area-inset-bottom,0px));width:100%;max-width:520px;max-height:85vh;overflow-y:auto;-webkit-overflow-scrolling:touch';
  
  const handle = document.createElement('div');
  handle.style.cssText = 'width:36px;height:4px;border-radius:2px;background:var(--border);margin:0 auto 14px';
  
  const title = document.createElement('div');
  title.style.cssText = 'font-size:16px;font-weight:700;color:var(--text);margin-bottom:4px';
  title.textContent = '📥 Apercu du programme CSV';
  
  const sub = document.createElement('div');
  sub.style.cssText = 'font-size:11px;color:var(--muted);margin-bottom:12px';
  sub.textContent = total + ' exercices detectes sur 7 jours';
  
  sheet.appendChild(handle); sheet.appendChild(title); sheet.appendChild(sub);
  
  // Erreurs
  if (errors.length > 0) {
    const errBox = document.createElement('div');
    errBox.style.cssText = 'background:rgba(229,62,62,.08);border:1px solid rgba(229,62,62,.3);border-radius:10px;padding:8px 12px;margin-bottom:10px';
    const errTitle = document.createElement('div');
    errTitle.style.cssText = 'font-size:11px;font-weight:700;color:var(--red);margin-bottom:4px';
    errTitle.textContent = '⚠ ' + errors.length + ' avertissement(s)';
    errBox.appendChild(errTitle);
    errors.slice(0,5).forEach(err => {
      const e = document.createElement('div');
      e.style.cssText = 'font-size:10px;color:var(--muted)';
      e.textContent = err;
      errBox.appendChild(e);
    });
    sheet.appendChild(errBox);
  }
  
  // Preview par jour
  const DAYS_FR = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];
  Object.entries(dayExercises).forEach(([di, exs]) => {
    if (!exs.length) return;
    const dayCard = document.createElement('div');
    dayCard.style.cssText = 'background:var(--card);border-radius:12px;padding:10px 12px;margin-bottom:8px;border:1px solid var(--border)';
    const dayTitle = document.createElement('div');
    dayTitle.style.cssText = 'font-size:12px;font-weight:700;color:var(--text);margin-bottom:6px';
    dayTitle.textContent = DAYS_FR[di] + ' — ' + exs.length + ' exercice(s)';
    dayCard.appendChild(dayTitle);
    exs.forEach(ex => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:3px 0;border-bottom:1px solid var(--border)';
      row.innerHTML = '<span style="font-size:11px;flex:1;color:var(--text)">' + ex.name + '</span>' +
        '<span style="font-size:9px;color:var(--muted)">' + ex.sets + 'x' + ex.reps + (ex.weight?' · '+ex.weight+'kg':'') + '</span>';
      dayCard.appendChild(row);
    });
    sheet.appendChild(dayCard);
  });
  
  // Buttons
  const btns = document.createElement('div');
  btns.style.cssText = 'display:flex;gap:8px;margin-top:12px';
  
  const applyBtn = document.createElement('button');
  applyBtn.style.cssText = 'flex:1;padding:13px;border-radius:14px;border:none;background:var(--teal);color:#fff;font-size:15px;font-weight:700;font-family:var(--font);cursor:pointer;touch-action:manipulation;-webkit-appearance:none';
  applyBtn.textContent = total > 0 ? 'Appliquer le programme' : 'Aucun exercice a importer';
  applyBtn.disabled = total === 0;
  
  const cancelBtn = document.createElement('button');
  cancelBtn.style.cssText = 'flex:1;padding:13px;border-radius:14px;border:1.5px solid var(--border);background:transparent;color:var(--muted);font-size:15px;font-weight:700;font-family:var(--font);cursor:pointer;touch-action:manipulation;-webkit-appearance:none';
  cancelBtn.textContent = 'Annuler';
  
  const doApply = async () => {
    overlay.remove();
    if (!await Modal.confirm('Remplacer le planning actuel par le CSV importe ? Cette action est irreversible.')) return;
    
    save(); // snapshot avant
    Object.entries(dayExercises).forEach(([di, exs]) => {
      if (exs.length === 0) return;
      Store.dispatch({ type:'TRAINING_UPDATE_DAY', payload:{ dayIndex:parseInt(di), changes:{ exercises: exs }}});
    });
    save(true);
    renderDayTabs(); renderDayDetail(S.activeDay || 0);
    showToast('Programme importe : ' + total + ' exercices sur ' + Object.values(dayExercises).filter(e=>e.length>0).length + ' jours', 'save', 4000);
  };
  
  applyBtn.ontouchstart = (e) => { e.preventDefault(); doApply(); };
  applyBtn.onclick = doApply;
  cancelBtn.ontouchstart = (e) => { e.preventDefault(); overlay.remove(); };
  cancelBtn.onclick = () => overlay.remove();
  
  btns.appendChild(cancelBtn); btns.appendChild(applyBtn);
  sheet.appendChild(btns);
  
  // Download template link
  const tplLink = document.createElement('button');
  tplLink.style.cssText = 'width:100%;margin-top:8px;border:none;background:none;color:var(--teal);font-size:12px;font-weight:600;font-family:var(--font);cursor:pointer;text-align:center;touch-action:manipulation;-webkit-appearance:none;text-decoration:underline';
  tplLink.textContent = 'Telecharger un modele CSV vide';
  tplLink.onclick = exportCSVTemplate;
  tplLink.ontouchstart = (e) => { e.preventDefault(); exportCSVTemplate(); };
  sheet.appendChild(tplLink);
  
  overlay.appendChild(sheet);
  overlay.ontouchstart = (e) => { if (e.target === overlay) overlay.remove(); };
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  document.body.appendChild(overlay);
};

/* ── Export du planning en CSV ── */
window.exportPlanningCSV = function() {
  const DAYS_FR = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];
  const rows = ['Jour,Exercice,Muscle,Poids,Series,Reps,Repos,Tempo,Note'];
  
  S.days.forEach((d, di) => {
    (d.exercises || []).filter(e => e.name?.trim()).forEach(ex => {
      const cells = [
        DAYS_FR[di],
        '"' + (ex.name||'').replace(/"/g,'""') + '"',
        ex.muscle || '',
        ex.weight || '',
        ex.sets || '3',
        ex.reps || '',
        ex.rest || '',
        ex.tempo || '',
        '"' + (ex.note||'').replace(/"/g,'""') + '"',
      ];
      rows.push(cells.join(','));
    });
  });
  
  const csv = rows.join('\n');
  const blob = new Blob(['\ufeff'+csv], { type:'text/csv;charset=utf-8' }); // BOM pour Excel
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'planning-ctp-' + localDateStr() + '.csv';
  a.click(); URL.revokeObjectURL(url);
  showToast('Planning exporte en CSV', 'save', 2000);
};

/* ── Télécharger un modèle vide ── */
function exportCSVTemplate() {
  const DAYS_FR = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];
  const rows = ['Jour,Exercice,Muscle,Poids,Series,Reps,Repos,Tempo,Note'];
  
  // Exemples
  const examples = [
    ['Lundi','Développé couché barre','pec','80','4','5-8','180','',''],
    ['Lundi','Développé incliné haltères','pec','30','3','8-12','120','',''],
    ['Mardi','Squat','jam','100','4','5-8','180','','Descente 3 secondes'],
    ['Mardi','Leg press','jam','200','3','10-12','120','',''],
    ['Mercredi','Traction','dos','0','4','6-10','180','','Lestage si facile'],
    ['Jeudi','Développé militaire','ep','50','4','8-12','120','',''],
    ['Vendredi','Soulevé de terre','dos','120','4','5-6','240','',''],
    ['Dimanche','Repos','rep','','','','','','Récupération active'],
  ];
  
  examples.forEach(r => rows.push(r.join(',')));
  
  const csv = rows.join('\n');
  const blob = new Blob(['\ufeff'+csv], { type:'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'modele-planning-ctp.csv';
  a.click(); URL.revokeObjectURL(url);
}
window.exportCSVTemplate = exportCSVTemplate;

/* ── Initialisation des boutons ── */
window.addEventListener('load', () => {
  const importBtn = document.getElementById('import-csv-btn');
  const importFile = document.getElementById('import-csv-file');
  const exportBtn = document.getElementById('export-csv-planning-btn');
  
  if (importBtn && importFile) {
    importBtn.addEventListener('click', () => importFile.click());
    importBtn.ontouchstart = (e) => { e.stopPropagation(); };
    
    importFile.addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      importFile.value = ''; // reset pour re-import
      
      try {
        showToast('Analyse du fichier CSV...', 'save', 1500);
        const result = await importPlanningCSV(file);
        showCSVImportPreview(result.dayExercises, result.errors, result.total);
      } catch(err) {
        showToast('Erreur CSV : ' + err.message, 'error', 5000);
      }
    });
  }
  
  if (exportBtn) {
    exportBtn.addEventListener('click', exportPlanningCSV);
    exportBtn.ontouchstart = (e) => { e.stopPropagation(); };
  }

  const icsBtn = document.getElementById('export-ics-btn');
  if (icsBtn) {
    icsBtn.addEventListener('click', () => { if(typeof ICSExport!=='undefined') ICSExport.showExportModal(); });
    icsBtn.ontouchstart = (e) => { e.stopPropagation(); };
  }
  const coachPlanBtn = document.getElementById('coach-ia-planning-btn');
  if (coachPlanBtn) {
    coachPlanBtn.addEventListener('click', () => { if(typeof ClaudeCoach!=='undefined') ClaudeCoach.showChat(); });
    coachPlanBtn.ontouchstart = (e) => { e.stopPropagation(); };
  }
});

})();
