/* ═══════════════════════════════════════
   render_other.js — Paramètres, Bibliothèque, Calendrier, Objectifs
   Dépend de: state.js, utils.js
═══════════════════════════════════════ */

function renderSettings() {
  const wrap = document.getElementById('settings-wrap');
  if (!wrap) return;
  wrap.innerHTML = '';

  // ── PROFIL ──
  const profSec = _settingsSection('👤 Profil');
  _settingsRow(profSec, 'Taille', 'Utilisée pour le calcul IMC & masse grasse', () => {
    const inp = document.createElement('input'); inp.type='number'; inp.className='settings-inp';
    inp.value=S.profilTaille||''; inp.placeholder='cm'; inp.min=100; inp.max=250;
    inp.addEventListener('change', e => { S.profilTaille=parseInt(e.target.value)||0; save(); });
    return inp;
  });
  _settingsRow(profSec, 'Objectif pas/jour', 'Pour le tracker de pas quotidiens', () => {
    const inp = document.createElement('input'); inp.type='number'; inp.className='settings-inp';
    inp.value=S.stepsGoal||10000; inp.min=1000; inp.max=50000; inp.step=500;
    inp.addEventListener('change', e => { S.stepsGoal=parseInt(e.target.value)||10000; save(); });
    return inp;
  });
  _settingsRow(profSec, 'Objectif calories/jour', 'Pour le tracker de calories', () => {
    const inp = document.createElement('input'); inp.type='number'; inp.className='settings-inp';
    inp.value=S.caloriesGoal||2500; inp.min=500; inp.max=6000; inp.step=50;
    inp.addEventListener('change', e => { S.caloriesGoal=parseInt(e.target.value)||2500; save(); });
    return inp;
  });
  wrap.appendChild(profSec);

  // ── PROGRAMME ──
  const progSec = _settingsSection('📋 Programme');
  _settingsRow(progSec, 'Semaine actuelle', 'A ou B', () => {
    const sp = document.createElement('span'); sp.style.cssText='font-size:13px;font-weight:700;color:var(--teal-d)';
    sp.textContent = 'Semaine ' + S.weekType + ' — N°' + S.weekCount;
    return sp;
  });
  _settingsRow(progSec, 'Bloc actuel', S.currentBlock, () => {
    const btn = document.createElement('button'); btn.className='btn btn-ghost btn-sm';
    btn.textContent='Changer'; btn.addEventListener('click', () => document.getElementById('block-btn')?.click());
    return btn;
  });
  _settingsRow(progSec, 'Archiver la semaine', 'Sauvegarder et passer à la suivante', () => {
    const btn = document.createElement('button'); btn.className='btn btn-teal btn-sm';
    btn.textContent='Archiver'; btn.addEventListener('click', () => { archiveWeek(); renderSettings(); });
    return btn;
  });
  wrap.appendChild(progSec);

  // ── APPARENCE ──
  // ── Section Entraînement ──
  const trainSec = _settingsSection('⚡ Entraînement');
  _settingsRow(trainSec, 'Repos entre séries', 'Durée par défaut du minuteur de repos', () => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap';
    [{sec:45,lbl:'45s'},{sec:60,lbl:'1 min'},{sec:90,lbl:'1:30'},{sec:120,lbl:'2 min'},{sec:180,lbl:'3 min'}].forEach(({sec,lbl}) => {
      const btn = document.createElement('button');
      btn.className = 'rest-timer-preset' + (S._restDuration===sec?' active':'');
      btn.textContent = lbl;
      btn.style.cssText = 'padding:6px 12px;min-height:34px;font-size:12px';
      btn.addEventListener('click', () => {
        S._restDuration = sec;
        save();
        wrap.querySelectorAll('.rest-timer-preset').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        showToast('⏱ Repos par défaut : ' + lbl, 'ok', 2000);
      });
      wrap.appendChild(btn);
    });
    return wrap;
  });
  _settingsRow(trainSec, 'Son du minuteur', 'Bip sonore à la fin du repos', () => {
    const tog = document.createElement('label');
    tog.style.cssText = 'display:flex;align-items:center;gap:8px;cursor:pointer';
    const inp = document.createElement('input'); inp.type='checkbox';
    inp.checked = S._restBeep !== false;
    inp.addEventListener('change', () => { S._restBeep = inp.checked; save(); });
    const lbl = document.createElement('span'); lbl.style.fontSize='12px'; lbl.textContent = inp.checked ? '🔔 Activé' : '🔕 Désactivé';
    inp.addEventListener('change', () => { lbl.textContent = inp.checked ? '🔔 Activé' : '🔕 Désactivé'; });
    tog.appendChild(inp); tog.appendChild(lbl);
    return tog;
  });

  const appSec = _settingsSection('🎨 Apparence');
  _settingsRow(appSec, 'Mode sombre', 'Thème sombre pour économiser la batterie', () => {
    const label = document.createElement('label'); label.className='toggle-wrap';
    const inp = document.createElement('input'); inp.type='checkbox'; inp.className='toggle-inp'; inp.checked=S.darkMode||false;
    inp.addEventListener('change', e => { S.darkMode=e.target.checked; document.documentElement.setAttribute('data-theme', e.target.checked?'dark':'light'); save(); });
    const slider = document.createElement('span'); slider.className='toggle-slider';
    label.appendChild(inp); label.appendChild(slider); return label;
  });
  wrap.appendChild(appSec);

  // ── NOTIFICATIONS ──
  const notifSec = _settingsSection('🔔 Notifications');
  const notifPerm = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
  const notifStatus = notifPerm === 'granted' ? '✅ Activées' : notifPerm === 'denied' ? '❌ Refusées (modifier dans Réglages → Safari)' : '⬜ Non configurées';
  _settingsRow(notifSec, 'Autorisation', notifStatus, () => {
    if (notifPerm === 'granted') return null;
    const btn = document.createElement('button'); btn.className='btn btn-teal btn-sm';
    btn.textContent = notifPerm === 'denied' ? 'Ouvrir Réglages' : 'Activer';
    btn.addEventListener('click', requestNotifPermission);
    return btn;
  });
  _settingsRow(notifSec, 'Rappel entraînement', "Notification quotidienne à l'heure de ta séance", () => {
    const wrap2 = document.createElement('div');
    wrap2.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap';
    const timeInp = document.createElement('input');
    timeInp.type = 'time'; timeInp.className = 'onboard-inp';
    timeInp.style.cssText = 'width:110px;padding:6px 10px;font-size:14px';
    const h = S._reminderHour; const m = S._reminderMinute;
    timeInp.value = (h!=null) ? (String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')) : '08:00';
    const setBtn = document.createElement('button'); setBtn.className='btn btn-teal btn-sm';
    setBtn.textContent = (h!=null) ? '✅ Modifer' : '🔔 Activer';
    setBtn.addEventListener('click', async () => {
      const [hh,mm] = timeInp.value.split(':').map(Number);
      if(isNaN(hh)||isNaN(mm)) return;
      const ok = notifPerm === 'granted' || await requestNotifPermission();
      if(ok) { scheduleTrainingReminder(hh, mm); setBtn.textContent='✅ Modifer'; }
    });
    const cancelBtn = document.createElement('button'); cancelBtn.className='btn btn-ghost btn-sm';
    cancelBtn.textContent='🔕 Annuler';
    cancelBtn.style.display = (h!=null) ? 'block' : 'none';
    cancelBtn.addEventListener('click', () => { cancelTrainingReminder(); cancelBtn.style.display='none'; setBtn.textContent='🔔 Activer'; });
    wrap2.appendChild(timeInp); wrap2.appendChild(setBtn); wrap2.appendChild(cancelBtn);
    return wrap2;
  });
  wrap.appendChild(notifSec);

  // ── DONNÉES ──
  const dataSec = _settingsSection('💾 Données');
  _settingsRow(dataSec, 'Exporter mes données', 'Fichier JSON de sauvegarde complet', () => {
    const btn = document.createElement('button'); btn.className='btn btn-ghost btn-sm';
    btn.textContent='⬇ Exporter'; btn.addEventListener('click', () => document.getElementById('export-btn')?.click());
    return btn;
  });
  _settingsRow(dataSec, 'Importer des données', 'Restaurer depuis un fichier JSON', () => {
    const btn = document.createElement('button'); btn.className='btn btn-ghost btn-sm';
    btn.textContent='⬆ Importer'; btn.addEventListener('click', () => document.getElementById('import-btn')?.click());
    return btn;
  });
  _settingsRow(dataSec, 'Données de démonstration', 'Générer 8 semaines d\u2019entra\u00eenement', () => {
    const btn = document.createElement('button'); btn.className='btn btn-ghost btn-sm';
    btn.textContent='🎲 Démo'; btn.addEventListener('click', () => document.getElementById('gen-sample-data')?.click());
    return btn;
  });
  _settingsRow(dataSec, 'Reconfiguration', 'Relancer l\'assistant de démarrage', () => {
    const btn = document.createElement('button');
    btn.className = 'btn btn-ghost btn-sm';
    btn.textContent = '🔄 Reconfigurer';
    btn.addEventListener('click', () => resetOnboarding());
    return btn;
  });
  _settingsRow(dataSec, 'Espace utilisé', 'localStorage', () => {
    const sp = document.createElement('span'); sp.style.cssText='font-family:var(--mono);font-size:12px;color:var(--muted)';
    try {
      const used = new Blob([JSON.stringify(S)]).size;
      sp.textContent = (used/1024).toFixed(1) + ' KB / ~5 MB';
    } catch(e) { sp.textContent = '—'; }
    return sp;
  });
  _settingsRow(dataSec, 'Version du schéma', '', () => {
    const sp = document.createElement('span'); sp.style.cssText='font-family:var(--mono);font-size:12px;color:var(--muted)';
    sp.textContent = 'v' + (S._schemaVersion||3); return sp;
  });
  wrap.appendChild(dataSec);

  // ── COMPARAISON A/B ──
  const abSec = _settingsSection('📊 Comparaison Semaine A vs B');
  const abContainer = document.createElement('div'); abContainer.style.padding = '12px';
  abSec.appendChild(abContainer);
  wrap.appendChild(abSec);
  setTimeout(() => renderABCompare(abContainer), 50);

  // ── TESTS ──
  _settingsRow(dataSec, 'Tests unitaires (?test=1)', 'Vérifier l\'intégrité de l\'application', () => {
    const btn = document.createElement('button'); btn.className='btn btn-ghost btn-sm';
    btn.textContent='🧪 Lancer'; btn.addEventListener('click', () => window.open(location.href.split('?')[0]+'?test=1','_blank'));
    return btn;
  });
}

function renderAchievements() {
  _renderObjectiveView();
  _bindObjectiveButtons();
  _renderBadges();
  _renderObjectiveProgress();
  checkAndAwardAchievements();
}

function renderLibrary(){
  const search=(document.getElementById('lib-search').value||'').toLowerCase();
  const muscleFilter=document.getElementById('lib-filter-muscle').value;
  const patternFilter=document.getElementById('lib-filter-pattern').value;
  const equipFilter=(document.getElementById('lib-filter-equipment')||{}).value||'';
  const diffFilter=(document.getElementById('lib-filter-difficulty')||{}).value||'';
  // Populate muscle filter
  const mf=document.getElementById('lib-filter-muscle');if(mf.options.length<=1){MUSCLES.filter(m=>m.key!=='rep').forEach(m=>{const o=document.createElement('option');o.value=m.key;o.textContent=m.label;mf.appendChild(o);});}
  const grid=document.getElementById('lib-grid');grid.innerHTML='';
  const filtered=EXERCISE_LIBRARY.filter(ex=>{if(search&&!ex.name.toLowerCase().includes(search)&&!(ex.muscle||'').includes(search)&&!(ex.tips||'').toLowerCase().includes(search))return false;if(muscleFilter&&ex.muscle!==muscleFilter)return false;if(patternFilter&&ex.pattern!==patternFilter)return false;if(equipFilter&&ex.equipment!==equipFilter)return false;if(diffFilter&&ex.difficulty!==diffFilter)return false;return true;});
  filtered.forEach(ex=>{
    const m=MM[ex.muscle]||{calBg:'#eee',calColor:'#999'};
    const card=document.createElement('div');card.className='lib-card';
    const hdr=document.createElement('div');hdr.className='lib-card-hdr';
    const name=document.createElement('div');name.style.cssText='font-weight:600;font-size:11px;flex:1';name.textContent=ex.name;
    const muscle=document.createElement('span');muscle.className='lib-tag';muscle.style.cssText=`background:${m.calBg};color:${m.calColor}`;muscle.textContent=m.label||ex.muscle;
    const diff=document.createElement('span');diff.className='lib-tag';diff.style.cssText='background:var(--bg);color:var(--muted);margin-left:4px';diff.textContent=ex.difficulty;
    hdr.appendChild(name);hdr.appendChild(muscle);hdr.appendChild(diff);card.appendChild(hdr);
    const body=document.createElement('div');body.className='lib-card-body';
    if(ex.muscles_secondary&&ex.muscles_secondary.length){const secDiv=document.createElement('div');secDiv.className='lib-muscles';const secLbl=document.createElement('span');secLbl.style.cssText='font-size:8px;color:var(--muted);font-weight:700;text-transform:uppercase;width:100%';secLbl.textContent='Muscles secondaires:';secDiv.appendChild(secLbl);ex.muscles_secondary.forEach(mk=>{const mm=MM[mk];if(!mm)return;const p=document.createElement('span');p.className='lib-tag';p.style.cssText=`background:${mm.calBg};color:${mm.calColor}`;p.textContent=mm.label;secDiv.appendChild(p);});body.appendChild(secDiv);}
    if(ex.tips){const tipDiv=document.createElement('div');tipDiv.className='lib-tip';tipDiv.textContent='💡 '+ex.tips;body.appendChild(tipDiv);}
    if(ex.alternatives&&ex.alternatives.length){const altDiv=document.createElement('div');altDiv.style.cssText='margin-top:6px';const altLbl=document.createElement('div');altLbl.style.cssText='font-size:8px;color:var(--muted);font-weight:700;text-transform:uppercase;margin-bottom:3px';altLbl.textContent='Alternatives:';altDiv.appendChild(altLbl);ex.alternatives.forEach(alt=>{const a=document.createElement('span');a.style.cssText='font-size:9px;color:var(--teal-d);background:var(--teal-l);padding:1px 6px;border-radius:6px;margin-right:4px;margin-bottom:2px;display:inline-block';a.textContent=alt;altDiv.appendChild(a);});body.appendChild(altDiv);}
    if(ex.equipment){const eq=document.createElement('div');eq.style.cssText='margin-top:5px;font-size:9px;color:var(--muted)';eq.textContent='Équipement: '+ex.equipment;body.appendChild(eq);}
    // Add to planning button
    const addBtn=document.createElement('button');addBtn.className='btn btn-ghost btn-sm';addBtn.style.cssText='margin-top:8px;width:100%';addBtn.textContent='+ Ajouter au planning ('+DAYS_SH[S.activeDay]+')';
    addBtn.addEventListener('click',()=>{const d=S.days[S.activeDay];const newEx={id:uid(),name:ex.name,muscle:ex.muscle,weight:'',sets:'3',reps:'8–12',rest:'',tempo:'',repsAchieved:'',rpe:'',rir:'',note:'',done:false,setData:null,isWarmup:false,supersetGroup:''};d.exercises.push(newEx);save();showToast(ex.name+' ajouté à '+DAYS[S.activeDay],'save');});
    body.appendChild(addBtn);card.appendChild(body);grid.appendChild(card);
  });
  if(!filtered.length)grid.innerHTML='<div class="prog-no-data">Aucun exercice trouvé.</div>';
}

function renderCalendar(){
  const {calYear,calMonth}=S;const title=new Date(calYear,calMonth,1).toLocaleDateString('fr-FR',{month:'long',year:'numeric'});document.getElementById('cal-month-title').textContent=title.charAt(0).toUpperCase()+title.slice(1);
  const grid=document.getElementById('cal-grid');grid.innerHTML='';
  ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].forEach(h=>{const dh=document.createElement('div');dh.className='cal-dh';dh.textContent=h;grid.appendChild(dh);});
  const startOffset=(new Date(calYear,calMonth,1).getDay()+6)%7;const daysInMonth=new Date(calYear,calMonth+1,0).getDate();const today=new Date();
  for(let i=0;i<startOffset;i++){const e=document.createElement('div');e.className='cal-cell empty';grid.appendChild(e);}
  for(let day=1;day<=daysInMonth;day++){
    const cell=document.createElement('div');cell.className='cal-cell';if(day===today.getDate()&&calMonth===today.getMonth()&&calYear===today.getFullYear())cell.classList.add('today');
    const ds=`${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const matchDay=S.days.find(d=>d.date===ds);const histDay=Object.values(S.history).flatMap(wk=>(wk.days||[])).find(d=>d.date===ds);const aDay=matchDay||histDay;const allMuscles=aDay?getDM(aDay):[];
    if(aDay){const exs=(aDay.exercises||[]).filter(e=>e.name&&e.name.trim()&&!e.isWarmup);const done=exs.filter(e=>e.done).length;const slots=getDMS(aDay);if(slots.includes('rep'))cell.classList.add('cal-rest');else if(exs.length&&done===exs.length)cell.classList.add('cal-full');else if(done>0)cell.classList.add('cal-partial');}
    if(day<daysInMonth&&matchDay){const nDs=`${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(day+1).padStart(2,'0')}`;const nD=S.days.find(d=>d.date===nDs);if(nD){const m1=getDM(matchDay).filter(k=>k!=='rep');const m2=getDM(nD).filter(k=>k!=='rep');if(m1.some(m=>m2.includes(m)))cell.classList.add('cal-conflict');}}
    const dn=document.createElement('div');dn.className='cal-dn';dn.textContent=day;cell.appendChild(dn);
    if(allMuscles.length){const mw=document.createElement('div');mw.className='cal-muscles';allMuscles.forEach(k=>{const m=MM[k];const p=document.createElement('span');p.className='cal-mpill';p.style.cssText=`background:${m.calBg};color:${m.calColor}`;p.textContent=m.label.split(' ')[0];mw.appendChild(p);});cell.appendChild(mw);}
    if(aDay){const exs=(aDay.exercises||[]).filter(e=>e.name&&e.name.trim()&&!e.isWarmup);if(exs.length){const done=exs.filter(e=>e.done).length;const sl=document.createElement('div');sl.className='cal-status';sl.style.color=done===exs.length?'var(--green)':done>0?'var(--orange)':'var(--muted)';sl.textContent=done===exs.length?'✅':done>0?`🔄 ${done}/${exs.length}`:'';cell.appendChild(sl);}}
    // Sleep indicator
    const sleepData=S.sleep[ds];if(sleepData&&sleepData.hours){const sh=document.createElement('div');sh.style.cssText='font-size:8px;color:var(--muted)';sh.textContent='😴'+sleepData.hours+'h';cell.appendChild(sh);}
    grid.appendChild(cell);
  }

  // ── Calendar Legend ──
  const legend = document.getElementById('cal-legend');
  if(legend){
    legend.innerHTML = '';
    legend.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;padding:10px 4px;font-size:11px';
    const items = [
      {color:'var(--green)',label:'Séance complète (100%)'},
      {color:'var(--teal)',label:'Séance partielle'},
      {color:'var(--orange)',label:'Cardio'},
      {color:'var(--red)',label:'Douleur signalée'},
      {color:'var(--purple)',label:'Sommeil renseigné'},
      {color:'var(--border)',label:'Repos / Sans données'},
    ];
    items.forEach(it=>{
      const item = document.createElement('div');
      item.style.cssText = 'display:flex;align-items:center;gap:5px;cursor:default';
      item.innerHTML = `<div style="width:12px;height:12px;border-radius:3px;background:${it.color};flex-shrink:0"></div><span style="color:var(--muted)">${it.label}</span>`;
      legend.appendChild(item);
    });
  }

}

