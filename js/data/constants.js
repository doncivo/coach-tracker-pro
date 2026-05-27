/* ================================================================
   data/constants.js — Constantes de configuration
   MUSCLES, DAYS, RPE_OPTS, MESURES_DEF, PA, BLOCKS, etc.
   ================================================================ */

/* ============================================================
   constants.js — Utilitaires + Constantes + State + Persist
============================================================ */


/*

/* ╔══════════════════════════════════════════════════════════╗
   ║  MODULE 0 — UTILITAIRES TRANSVERSAUX                    ║
   ╚══════════════════════════════════════════════════════════╝ */

// ── Échappement HTML (anti-XSS) ──────────────────────────────
const _ESC = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
function escHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, m => _ESC[m]);
}

// ── Date locale YYYY-MM-DD (corrige le bug UTC) ───────────────
function localDateStr(d) {
  const dt = d || new Date();
  const y  = dt.getFullYear();
  const mo = String(dt.getMonth() + 1).padStart(2, '0');
  const da = String(dt.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

// ── ID unique crypto ──────────────────────────────────────────
function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
}

// ── Modales internes async (remplacent prompt/confirm) ────────
const Modal = (() => {
  function _overlay(content, onClose) {
    const ov = document.createElement('div');
    ov.className = 'modal-overlay';
    ov.style.zIndex = '3000';
    const box = document.createElement('div');
    box.className = 'modal';
    box.appendChild(content);
    ov.appendChild(box);
    document.body.appendChild(ov);
    const close = (val) => { ov.remove(); onClose(val); };
    ov.addEventListener('click', e => { if (e.target === ov) close(null); });
    // Focus first focusable element
    setTimeout(() => { const f = box.querySelector('button,input,select,textarea'); if(f) f.focus(); }, 50);
    return close;
  }

  function confirm(message, labelOk = 'Confirmer', labelCancel = 'Annuler') {
    return new Promise(resolve => {
      const wrap = document.createElement('div');
      const msg  = document.createElement('p');
      msg.style.cssText = 'margin-bottom:16px;font-size:13px;line-height:1.5;color:var(--text)';
      msg.textContent = message;
      const btns = document.createElement('div');
      btns.className = 'modal-actions';
      const btnOk  = document.createElement('button');
      btnOk.className  = 'btn btn-teal';
      btnOk.textContent = labelOk;
      const btnNo = document.createElement('button');
      btnNo.className  = 'btn btn-ghost';
      btnNo.textContent = labelCancel;
      btns.appendChild(btnNo); btns.appendChild(btnOk);
      wrap.appendChild(msg); wrap.appendChild(btns);
      const close = _overlay(wrap, v => resolve(!!v));
      btnOk.addEventListener('click', () => close(true));
      btnNo.addEventListener('click', () => close(false));
      wrap.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); close(true); }
        if (e.key === 'Escape') close(false);
      });
    });
  }

  function prompt(message, defaultVal = '', placeholder = '') {
    return new Promise(resolve => {
      const wrap = document.createElement('div');
      const msg  = document.createElement('p');
      msg.style.cssText = 'margin-bottom:10px;font-size:13px;color:var(--text)';
      msg.textContent = message;
      const inp  = document.createElement('input');
      inp.type   = 'text';
      inp.className = 'inp';
      inp.style.width = '100%';
      inp.value  = defaultVal;
      inp.placeholder = placeholder;
      const btns = document.createElement('div');
      btns.className = 'modal-actions';
      btns.style.marginTop = '12px';
      const btnOk = document.createElement('button');
      btnOk.className = 'btn btn-teal';
      btnOk.textContent = 'OK';
      const btnNo = document.createElement('button');
      btnNo.className = 'btn btn-ghost';
      btnNo.textContent = 'Annuler';
      btns.appendChild(btnNo); btns.appendChild(btnOk);
      wrap.appendChild(msg); wrap.appendChild(inp); wrap.appendChild(btns);
      const close = _overlay(wrap, v => resolve(v));
      btnOk.addEventListener('click', () => close(inp.value.trim()||null));
      btnNo.addEventListener('click', () => close(null));
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); close(inp.value.trim()||null); }
        if (e.key === 'Escape') close(null);
      });
    });
  }

  // Generic multi-field form
  function form(title, fields) {
    // fields: [{key, label, type, value, options?}]
    return new Promise(resolve => {
      const wrap = document.createElement('div');
      const t = document.createElement('div');
      t.className = 'modal-title';
      t.textContent = title;
      wrap.appendChild(t);
      const data = {};
      fields.forEach(f => {
        const g = document.createElement('div');
        g.className = 'form-group';
        const lbl = document.createElement('label');
        lbl.textContent = f.label;
        lbl.htmlFor = 'mf_' + f.key;
        g.appendChild(lbl);
        let el;
        if (f.type === 'select') {
          el = document.createElement('select');
          (f.options || []).forEach((o, oi) => {
            const opt = document.createElement('option');
            opt.value = oi + 1;
            opt.textContent = o;
            if (f.value === oi + 1) opt.selected = true;
            el.appendChild(opt);
          });
        } else if (f.type === 'textarea') {
          el = document.createElement('textarea');
          el.rows = 3;
          el.value = f.value || '';
        } else {
          el = document.createElement('input');
          el.type = f.type || 'text';
          el.value = f.value || '';
          el.placeholder = f.placeholder || '';
        }
        el.id = 'mf_' + f.key;
        data[f.key] = () => el.value;
        g.appendChild(el);
        wrap.appendChild(g);
      });
      const btns = document.createElement('div');
      btns.className = 'modal-actions';
      const btnOk = document.createElement('button');
      btnOk.className = 'btn btn-teal';
      btnOk.textContent = 'Enregistrer';
      const btnNo = document.createElement('button');
      btnNo.className = 'btn btn-ghost';
      btnNo.textContent = 'Annuler';
      btns.appendChild(btnNo); btns.appendChild(btnOk);
      wrap.appendChild(btns);
      const close = _overlay(wrap, v => resolve(v));
      btnOk.addEventListener('click', () => {
        const result = {};
        Object.keys(data).forEach(k => result[k] = data[k]());
        close(result);
      });
      btnNo.addEventListener('click', () => close(null));
      wrap.addEventListener('keydown', e => { if (e.key === 'Escape') close(null); });
    });
  }

  return { confirm, prompt, form };
})();

/* ─── helpers DOM sécurisés ────────────────────────────────── */
function el(tag, attrs, ...children) {
  const e = document.createElement(tag);
  if (attrs) Object.entries(attrs).forEach(([k,v]) => {
    if (k === 'cls') e.className = v;
    else if (k === 'txt') e.textContent = v;
    else if (k === 'css') e.style.cssText = v;
    else if (k === 'on') Object.entries(v).forEach(([ev,fn]) => e.addEventListener(ev,fn));
    else if (k.startsWith('aria')) e.setAttribute(k,v);
    else e[k] = v;
  });
  children.flat().forEach(c => c && e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
  return e;
}

/* ══ CONSTANTS ══ */
const DAYS=['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];
const DAYS_SH=['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
const DAY_BG=['var(--c0)','var(--c1)','var(--c2)','var(--c3)','var(--c4)','var(--c5)','var(--c6)'];
const DAY_COL=['var(--t0)','var(--t1)','var(--t2)','var(--t3)','var(--t4)','var(--t5)','var(--t6)'];
const MUSCLES=[
  {key:'pec', label:'Pectoraux',         calBg:'#ffe0ea', calColor:'#c0506a', type:'push'},
  {key:'dos', label:'Dos',               calBg:'#e0d8ff', calColor:'#6050b0', type:'pull'},
  {key:'jam', label:'Jambes',            calBg:'#d8f5e8', calColor:'#3a9060', type:'legs'},
  {key:'ep',  label:'Épaules',           calBg:'#ffecd8', calColor:'#b06830', type:'push'},
  {key:'bic', label:'Biceps',            calBg:'#fff3d0', calColor:'#907020', type:'pull'},
  {key:'tri', label:'Triceps',           calBg:'#d8edff', calColor:'#3070b0', type:'push'},
  {key:'abd', label:'Abdominaux',        calBg:'#ffd8f8', calColor:'#904090', type:'core'},
  {key:'bas', label:'Bas du dos',        calBg:'#d8fff8', calColor:'#208070', type:'core'},
  {key:'car', label:'Cardio',            calBg:'#fff0d0', calColor:'#b07800', type:'cardio'},
  {key:'mob', label:'Mobilité',          calBg:'#e8ffe8', calColor:'#2a8040', type:'mobility'},
  {key:'rep', label:'Repos',             calBg:'#f0f0f0', calColor:'#888888', type:'rest'},
];
const MM=Object.fromEntries(MUSCLES.map(m=>[m.key,m]));
const MK=MUSCLES.map(m=>m.key);
const CARDIO_TYPES=['— Cardio —','Course à pied','Vélo','Elliptique','Rameur','Natation','Corde à sauter','Marche rapide','HIIT','Autre'];
const TRACKING=['Échauffement','Séance principale','Récupération'];
const RPE_OPTS=['—','6','7','7.5','8','8.5','9','9.5','10'];
const RIR_OPTS=['—','0','1','2','3','4','5'];
const MESURES_DEF=[
  {key:'poids',label:'Poids corporel',unit:'kg',icon:'⚖️'},
  {key:'poitrine',label:'Poitrine',unit:'cm',icon:'📏'},
  {key:'taille',label:'Tour de taille',unit:'cm',icon:'📏'},
  {key:'hanches',label:'Hanches',unit:'cm',icon:'📏'},
  {key:'bras',label:'Bras (contracté)',unit:'cm',icon:'💪'},
  {key:'cuisse',label:'Cuisse',unit:'cm',icon:'🦵'},
  {key:'cou',label:'Tour de cou',unit:'cm',icon:'📏'},
  {key:'mollet',label:'Mollet',unit:'cm',icon:'🦵'},
];
const BODY_PARTS=['Épaule droite','Épaule gauche','Coude droit','Coude gauche','Poignet droit','Poignet gauche','Genou droit','Genou gauche','Cheville droite','Cheville gauche','Bas du dos','Cou','Hanche droite','Hanche gauche'];
const PAIN_LEVELS=[{val:1,emoji:'🟡',label:'Légère'},{val:2,emoji:'🟠',label:'Modérée'},{val:3,emoji:'🔴',label:'Forte'}];
const TRAINING_BLOCKS=['Accumulation','Intensification','Réalisation','Deload'];

/* ══ PROGRAM DATA ══ */
function mkEx(n,m,s,r,wu){return{id:uid(),name:n,muscle:m,weight:'',sets:s,reps:r,rest:'',tempo:'',repsAchieved:'',rpe:'',rir:'',note:'',done:false,setData:null,isWarmup:wu||false,supersetGroup:''};}
const PA=[
  {muscles:['pec','bic','abd'],cardio:{type:'Rameur',duration:'5',speed:'',distance:''},warmup:'5 min rameur léger · Face pull 2×15 + rotations externes 2×12/bras · 2 séries légères développé incliné',exercises:[mkEx('Développé incliné haltères (prise neutre)','pec','4','6–10'),mkEx('Développé convergent machine','pec','3','8–12'),mkEx('Développé couché machine (angle plat)','pec','2','10–12'),mkEx('Écartés poulie (bas→haut)','pec','3','12–15'),mkEx('Curl câble unilatéral (poulie basse)','bic','2','12–15/bras'),mkEx('Pompes inclinées (finition)','pec','2','AMRAP'),mkEx('Curl incliné haltères','bic','3','10–12'),mkEx('Curl marteau','bic','2','12–15'),mkEx('Curl pupitre (machine ou EZ)','bic','2','10–12'),mkEx('Planche','abd','3','45–60 s')]},
  {muscles:['dos','tri',''],cardio:{type:'Vélo',duration:'5',speed:'',distance:''},warmup:'5 min vélo · Tirage poulie léger 2×15 + face pulls 1×15',exercises:[mkEx('Tirage vertical poulie prise neutre','dos','4','8–12'),mkEx('Rowing poulie basse prise neutre','dos','4','8–12'),mkEx('Rowing machine poitrine appuyée','dos','3','10–12'),mkEx('Pullover poulie','dos','2','12–15'),mkEx('Rowing unilatéral haltère (banc incliné)','dos','2','10–12/côté'),mkEx('Shrugs haltères (trapèzes supérieurs)','dos','3','10–15'),mkEx('Pushdown corde','tri','3','10–12'),mkEx('Pushdown barre droite (pronation)','tri','2','10–12'),mkEx('Kickback triceps poulie (unilatéral)','tri','2','12–15/bras'),mkEx("Farmer's carry (trapèzes + avant-bras)",'dos','2','30–45 s'),mkEx('Extension triceps au-dessus tête (corde)','tri','2','12–15')]},
  {muscles:['jam','ep',''],cardio:{type:'Vélo',duration:'7',speed:'',distance:''},warmup:'6–7 min vélo · Fentes dynamiques 2×10 + squats PDC 2×10 · Rotations externes 1×15',exercises:[mkEx('Presse à cuisses','jam','4','8–12'),mkEx('Hack squat machine','jam','3','8–12'),mkEx('SDT roumain haltères','jam','3','8–12'),mkEx('Leg curl assis/couché','jam','3','10–15'),mkEx('Mollets debout','jam','4','10–15'),mkEx('Landmine press','ep','3','8–12'),mkEx('Élévations latérales','ep','3','12–20'),mkEx('Face pulls (santé épaule)','ep','2','15–20'),mkEx('Élévations latérales poulie (unilatéral)','ep','2','15–20/bras'),mkEx('Reverse pec deck (arrière épaule)','ep','3','12–20'),mkEx('Y-raise incliné','ep','2','12–15')]},
  {muscles:['pec','bic','abd'],cardio:{type:'Rameur',duration:'5',speed:'',distance:''},warmup:'5 min rameur + face pulls 2×15',exercises:[mkEx('Développé couché machine (ou haltères)','pec','4','8–12'),mkEx('Développé décliné machine / Smith','pec','2','10–12'),mkEx('Développé incliné machine','pec','3','10–12'),mkEx('Pec deck','pec','3','12–15'),mkEx('Cross-over poulie (haut→bas)','pec','2','12–15'),mkEx('Curl barre EZ','bic','3','8–10'),mkEx('Curl pupitre machine / pupitre EZ','bic','2','10–12'),mkEx('Curl câble (poulie) — tension continue','bic','2','12–15'),mkEx('Spider curl (banc incliné)','bic','2','10–12'),mkEx('Curl inversé barre EZ','bic','2','10–15'),mkEx('Wrist curl haltères','bic','2','15–20'),mkEx('Reverse wrist curl','bic','2','15–20'),mkEx('Pallof press','abd','3','12/côté')]},
  {muscles:['dos','tri',''],cardio:{type:'Vélo',duration:'5',speed:'',distance:''},warmup:'5 min vélo + face pulls 2×15',exercises:[mkEx('Rowing barre T / machine','dos','4','8–12'),mkEx('Tirage vertical poulie','dos','3','10–12'),mkEx('Rowing unilatéral poulie','dos','3','10–12/côté'),mkEx('Pulldown bras tendus (poulie)','dos','2','12–15'),mkEx('Reverse pec deck (arrière épaule)','dos','3','12–20'),mkEx('Rowing haut poulie (coudes hauts)','dos','2','12–15'),mkEx('Dips assistés (si épaule OK)','tri','3','8–12'),mkEx('Extension triceps machine','tri','2','8–12'),mkEx('Extension triceps unilatérale poulie','tri','2','12–15'),mkEx('Pushdown barre V (pompe triceps)','tri','2','12–15')]},
  {muscles:['jam','ep',''],cardio:{type:'Rameur',duration:'6',speed:'',distance:''},warmup:'5–7 min rameur · Hip thrust léger 2×12 · Rotations externes 1×15',exercises:[mkEx('Hip thrust barre','jam','4','8–12'),mkEx('Leg press pieds hauts','jam','3','10–12'),mkEx('Fentes bulgares','jam','3','10/jambe'),mkEx('Leg curl','jam','3','12–15'),mkEx('Mollets assis','jam','3','12–20'),mkEx('Élévations latérales machine/poulie','ep','4','12–20'),mkEx('Développé épaules machine (prise neutre)','ep','2','8–12'),mkEx('Oiseau à la poulie (arrière épaule)','ep','3','12–20/bras'),mkEx('Face pulls','ep','2','15–20')]},
  {muscles:['rep','',''],cardio:{type:'Marche rapide',duration:'45',speed:'',distance:''},warmup:'Marche 30–60 min + mobilité 10 min · Étirements dynamiques',exercises:[]}
];
function mkDay(i,wt){const p=PA[i];return{date:'',muscles:[...p.muscles],warmup:p.warmup||'',exercises:p.exercises.map(e=>({...e,setData:null})),cardio:{...p.cardio}};}

/* ══ EXERCISE LIBRARY ══ */

/* ══ SCHEMA & MIGRATION ══ */
const SCHEMA_VERSION = 3;

/**
 * Valide la structure minimale d un state importé.
 * Retourne { ok, errors[] }
 */
function validateImport(data) {
  const errors = [];
  if (typeof data !== 'object' || data === null) {
    return { ok: false, errors: ['Le fichier JSON est invalide ou corrompu.'] };
  }
  if (!Array.isArray(data.days) || data.days.length !== 7) {
    errors.push('days: doit être un tableau de 7 éléments.');
  }
  if (typeof data.weekType !== 'string' || !['A','B'].includes(data.weekType)) {
    errors.push('weekType: doit être "A" ou "B".');
  }
  if (data.mesures && typeof data.mesures !== 'object') {
    errors.push('mesures: format invalide.');
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Migre un state d une version antérieure vers SCHEMA_VERSION.
 */
function migrateState(raw) {
  const v = raw._schemaVersion || 1;
  let s = raw;

  // v1 → v2: ajout des champs sleep/nutrition/painLog
  if (v < 2) {
    s.sleep = s.sleep || {};
    s.nutrition = s.nutrition || {};
    s.painLog = s.painLog || [];
    s.achievements = s.achievements || {};
    s.objective = s.objective || {text:'',targetDate:'',targetWeight:'',targetExercise:'',targetLoad:''};
  }

  // v2 → v3: ajout isWarmup/supersetGroup/tempo/rir/id sur exercices
  if (v < 3) {
    s.currentBlock = s.currentBlock || 'Accumulation';
    s.steps = s.steps || {};
    s.calories = s.calories || {};
    s.stepsGoal = s.stepsGoal || 10000;
    s.caloriesGoal = s.caloriesGoal || 2500;
    s.blockWeek    = s.blockWeek    || 1;
    s.profilTaille = s.profilTaille || 175;
    // Attribuer des IDs aux exercices existants
    const assignIds = (days) => (days || []).forEach(d =>
      (d.exercises || []).forEach(ex => {
        if (!ex.id) ex.id = uid();
        if (ex.isWarmup === undefined) ex.isWarmup = false;
        if (!ex.supersetGroup) ex.supersetGroup = '';
        if (!ex.tempo) ex.tempo = '';
        if (!ex.rir) ex.rir = '';
      })
    );
    assignIds(s.days);
    Object.values(s.history || {}).forEach(wk => assignIds(wk.days));
  }

  s._schemaVersion = SCHEMA_VERSION;
  if(!s._gender)      s._gender      = 'm';
  if(!s._dob)         s._dob         = '';
  if(!s._level)       s._level       = 'intermediaire';
  if(!s._daysPerWeek) s._daysPerWeek = 4;
  if(!s._place)       s._place       = 'salle';
  if(!s._sleepGoal)   s._sleepGoal   = 8;
  if(!s._startDate)   s._startDate   = '';
  if(!s._restDuration) s._restDuration = 90;
  if(s._restBeep===undefined) s._restBeep = true;
  if(!s.mesures.cou)    s.mesures.cou    = [];
  if(!s.mesures.mollet) s.mesures.mollet = [];
  return s;
}

/* ══ STATE ══ */
let S={
  days:Array.from({length:7},(_,i)=>mkDay(i,'A')),
  weekType:'A',weekCount:1,
  currentBlock:'Accumulation',blockWeek:1,
  goals:[{text:"Compléter les 6 séances",done:false},{text:"Noter les poids",done:false},{text:"Respecter l échauffement",done:false}],
  notes:'',
  calYear:new Date().getFullYear(),calMonth:new Date().getMonth(),
  calChecks:{},activeDay:0,sessDay:0,bilanOffset:0,
  history:{},prs:{},
  mesures:{poids:[],poitrine:[],taille:[],hanches:[],bras:[],cuisse:[]},
  sleep:{},nutrition:{},
  steps:{},calories:{},
  stepsGoal:10000,caloriesGoal:2500,
  painLog:[],
  sessRecovery:{},photos:[],
  darkMode:false,exViewMode:'compact',
  profilTaille:175,
  profilPoignet:17,
  profilSexe:'H',
  profilAge:30,
  mesureObjectifs:{},
  objective:{text:'',targetDate:'',targetWeight:'',targetExercise:'',targetLoad:''},
  achievements:{},
  undoStack:[],
  sessStartTime:null,
  _schemaVersion:SCHEMA_VERSION,
  _currentTab:'weekly',
  _restDuration:90,
  _restBeep:true,
  _reminderHour:null,
  _reminderMinute:null,
  proteinGoal:0,
  carbsGoal:0,
  fatGoal:0,
  _gender:'m', _dob:'', _level:'intermediaire',
  _daysPerWeek:4, _place:'salle', _sleepGoal:8, _startDate:'',
};

/* ══ PERSIST ══ */
function load(){
  try {
    const raw = localStorage.getItem('ctp_v3');
    if (raw) {
      const parsed = JSON.parse(raw);
      const migrated = migrateState(parsed);
      Object.keys(migrated).forEach(k => { if (k in S || k === '_schemaVersion') S[k] = migrated[k]; });
    }
  } catch(e) {
    console.error('[CTP] load error:', e);
    showToast('⚠️ Erreur de chargement des données. Vérifiez la console.', 'error', 5000);
  }
  // Ensure all required keys exist (defaults)
  if(!S.calChecks)S.calChecks={};if(!S.history)S.history={};if(!S.prs)S.prs={};
  if(!S.mesures)S.mesures={poids:[],poitrine:[],taille:[],hanches:[],bras:[],cuisse:[]};
  if(!S.sleep)S.sleep={};if(!S.nutrition)S.nutrition={};
  if(!S.painLog)S.painLog=[];if(!S.sessRecovery)S.sessRecovery={};
  if(!S.photos)S.photos=[];if(!S.achievements)S.achievements={};
  if(!S.undoStack)S.undoStack=[];if(!S.weekCount)S.weekCount=1;
  if(!S.objective)S.objective={text:'',targetDate:'',targetWeight:'',targetExercise:'',targetLoad:''};
  if(!S.currentBlock)S.currentBlock='Accumulation';if(!S.blockWeek)S.blockWeek=1;
}
let _st;
function save(skipUndo) {
  // ── Undo stack (stored separately to avoid quota pressure) ──
  if (!skipUndo) {
    try {
      const snapshot = JSON.stringify({ days: S.days.map(d => ({...d})), history: S.history });
      const stack = JSON.parse(localStorage.getItem('ctp_undo') || '[]');
      stack.push(snapshot);
      if (stack.length > 10) stack.shift();
      localStorage.setItem('ctp_undo', JSON.stringify(stack));
    } catch(e) { /* undo non critical */ }
  }
  clearTimeout(_st);
  _st = setTimeout(() => {
    // Save without undoStack to reduce size
    const toSave = { ...S };
    delete toSave.undoStack; // kept in ctp_undo
    try {
      localStorage.setItem('ctp_v3', JSON.stringify(toSave));
    } catch(e) {
      if (e.name === 'QuotaExceededError' || e.code === 22) {
        // Try to prune old history entries
        const histKeys = Object.keys(S.history).sort();
        if (histKeys.length > 20) {
          histKeys.slice(0, 5).forEach(k => delete S.history[k]);
          try { localStorage.setItem('ctp_v3', JSON.stringify(toSave)); }
          catch(_) { showToast('❌ Stockage plein — ancienne donnée supprimée automatiquement.', 'warn', 5000); }
        } else {
          showToast('❌ Stockage localStorage plein. Exportez vos données.', 'error', 6000);
        }
      }
    }
    const b = document.getElementById('save-badge');
    if (b) { b.classList.add('show'); setTimeout(() => b.classList.remove('show'), 1200); }
  }, 400);
}
function undoAction() {
  try {
    const stack = JSON.parse(localStorage.getItem('ctp_undo') || '[]');
    if (!stack.length) return showToast('Rien à annuler', 'warn');
    const prev = JSON.parse(stack.pop());
    localStorage.setItem('ctp_undo', JSON.stringify(stack));
    S.days = prev.days; S.history = prev.history;
    save(true);
    renderDayTabs(); renderDayDetail(S.activeDay);
    showToast('↩ Action annulée', 'save');
  } catch(e) {
    showToast('Annulation impossible', 'error');
  }
}


/* ── Variables d\'\1tat global (accessibles dans tous les modules) ── */
let _searchOpen = false;
let _swipeStartX = 0;
let _obStep = 0;
let _barcodeStream = null;
let _exView = 'compact';
let _ci = null;
let _sessTimer = null;
let _sessActiveEx = 0;
let _calDayOffset = 0;
let _objEditing = false;
