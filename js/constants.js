/* ═══════════════════════════════════════
   constants.js — Données statiques
   Ne jamais modifier sauf ajout de données
═══════════════════════════════════════ */


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
  {key:'pec',label:'Pectoraux',calBg:'#ffe0ea',calColor:'#c0506a',type:'push'},
  {key:'dos',label:'Dos',calBg:'#e0d8ff',calColor:'#6050b0',type:'pull'},
  {key:'jam',label:'Jambes',calBg:'#d8f5e8',calColor:'#3a9060',type:'legs'},
  {key:'ep',label:'Épaules',calBg:'#ffecd8',calColor:'#b06830',type:'push'},
  {key:'bic',label:'Biceps',calBg:'#fff3d0',calColor:'#907020',type:'pull'},
  {key:'tri',label:'Triceps',calBg:'#d8edff',calColor:'#3070b0',type:'push'},
  {key:'abd',label:'Abdominaux',calBg:'#ffd8f8',calColor:'#904090',type:'core'},
  {key:'bas',label:'Bas du dos & Gainage',calBg:'#d8fff8',calColor:'#208070',type:'core'},
  {key:'rep',label:'Jour de repos',calBg:'#f0f0f0',calColor:'#888',type:'rest'},
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
const EXERCISE_LIBRARY=[
  {name:'Développé incliné haltères',muscle:'pec',pattern:'push',equipment:'haltères',difficulty:'intermédiaire',muscles_secondary:['ep','tri'],tips:'Prise neutre pour protéger les épaules. Descendre jusqu\'à étirement complet.',alternatives:['Développé incliné barre','Pompes inclinées','Développé convergent machine'],std_ratio:{bw60:0.5,bw75:0.65,bw90:0.8}},
  {name:'Développé couché machine',muscle:'pec',pattern:'push',equipment:'machine',difficulty:'débutant',muscles_secondary:['ep','tri'],tips:'Angle plat ou légèrement décliné. Prise neutre si disponible.',alternatives:['Développé couché barre','Développé haltères'],std_ratio:{bw60:0.6,bw75:0.75,bw90:0.9}},
  {name:'Écartés poulie',muscle:'pec',pattern:'push',equipment:'câble',difficulty:'intermédiaire',muscles_secondary:[],tips:'Maintenir une légère flexion du coude. Mouvement en arc de cercle.',alternatives:['Pec deck','Écartés haltères'],std_ratio:{bw60:0.25,bw75:0.3,bw90:0.35}},
  {name:'Tirage vertical poulie',muscle:'dos',pattern:'pull',equipment:'câble',difficulty:'débutant',muscles_secondary:['bic','bas'],tips:'Prise neutre = moins de sollicitation des épaules. Amener la barre au sternum.',alternatives:['Tractions','Tirage vertical machine'],std_ratio:{bw60:0.6,bw75:0.75,bw90:0.9}},
  {name:'Rowing poulie basse',muscle:'dos',pattern:'pull',equipment:'câble',difficulty:'débutant',muscles_secondary:['bic','bas'],tips:'Coudes près du corps. Rétraction des omoplates en fin de mouvement.',alternatives:['Rowing haltère','Rowing barre'],std_ratio:{bw60:0.5,bw75:0.65,bw90:0.8}},
  {name:'Presse à cuisses',muscle:'jam',pattern:'legs',equipment:'machine',difficulty:'débutant',muscles_secondary:[],tips:'Pieds hauts pour les ischio-jambiers. Descendre a 90 degrees minimum.',alternatives:['Squat','Hack squat machine'],std_ratio:{bw60:1.2,bw75:1.5,bw90:1.8}},
  {name:'SDT roumain haltères',muscle:'jam',pattern:'legs',equipment:'haltères',difficulty:'intermédiaire',muscles_secondary:['bas','dos'],tips:'Dos droit tout au long. Pousser les hanches vers l\'arrière, pas le bas.',alternatives:['SDT roumain barre','Good morning'],std_ratio:{bw60:0.4,bw75:0.55,bw90:0.7}},
  {name:'Hip thrust barre',muscle:'jam',pattern:'legs',equipment:'barre',difficulty:'intermédiaire',muscles_secondary:['bas'],tips:'Barre au niveau des hanches. Extension complète sans hyperextension lombaire.',alternatives:['Hip thrust machine','Glute bridge'],std_ratio:{bw60:0.8,bw75:1.0,bw90:1.2}},
  {name:'Élévations latérales',muscle:'ep',pattern:'push',equipment:'haltères',difficulty:'débutant',muscles_secondary:[],tips:'Légère flexion du coude. Monter jusqu\'à hauteur des épaules maximum.',alternatives:['Élévations latérales poulie','Élévations latérales machine'],std_ratio:{bw60:0.1,bw75:0.13,bw90:0.16}},
  {name:'Curl barre EZ',muscle:'bic',pattern:'pull',equipment:'barre EZ',difficulty:'débutant',muscles_secondary:[],tips:'Coudes fixes. Supination en fin de mouvement pour maximiser la contraction.',alternatives:['Curl haltères','Curl câble'],std_ratio:{bw60:0.3,bw75:0.38,bw90:0.45}},
  {name:'Pushdown corde',muscle:'tri',pattern:'push',equipment:'câble',difficulty:'débutant',muscles_secondary:[],tips:'Écarter la corde en bas pour une contraction maximale des 3 chefs.',alternatives:['Pushdown barre','Dips triceps'],std_ratio:{bw60:0.25,bw75:0.3,bw90:0.38}},
  {name:'Planche',muscle:'abd',pattern:'core',equipment:'aucun',difficulty:'débutant',muscles_secondary:['bas'],tips:'Gainage actif : pousser le sol, serrer les fessiers, rentrer le ventre.',alternatives:['Planche latérale','Roulette abdominale'],std_ratio:{}},
  {name:'Curl incliné haltères',muscle:'bic',pattern:'pull',equipment:'haltères',difficulty:'intermédiaire',muscles_secondary:[],tips:'L\'inclinaison allonge le biceps au départ, maximisant l\'étirement.',alternatives:['Curl pupitre','Spider curl'],std_ratio:{bw60:0.15,bw75:0.18,bw90:0.22}},
  {name:'Dips assistés',muscle:'tri',pattern:'push',equipment:'machine',difficulty:'débutant',muscles_secondary:['pec','ep'],tips:'Garder les coudes près du corps pour cibler les triceps.',alternatives:['Dips barre parallèles','Extension triceps'],std_ratio:{}},
  {name:'Face pulls',muscle:'ep',pattern:'pull',equipment:'câble',difficulty:'débutant',muscles_secondary:['dos'],tips:'Essentiel pour la santé des épaules. Tirer vers le visage avec les coudes hauts.',alternatives:['Oiseau haltères','Reverse pec deck'],std_ratio:{}},
  // Pectoraux
  {name:'Pompes inclinées',muscle:'pec',pattern:'push',equipment:'aucun',difficulty:'débutant',muscles_secondary:['ep','tri'],tips:'Inclinaison faible = bas de la poitrine. Grande inclinaison = haut.',alternatives:['Développé décliné','Dips'],std_ratio:{}},
  {name:'Pec deck',muscle:'pec',pattern:'push',equipment:'machine',difficulty:'débutant',muscles_secondary:[],tips:'Maintenir une legere flexion du coude tout au long.',alternatives:['Écartés haltères','Cross-over poulie'],std_ratio:{bw60:0.3,bw75:0.38,bw90:0.45}},
  {name:'Cross-over poulie',muscle:'pec',pattern:'push',equipment:'câble',difficulty:'intermédiaire',muscles_secondary:[],tips:'Croiser les mains en fin de mouvement.',alternatives:['Pec deck','Écartés poulie'],std_ratio:{bw60:0.22,bw75:0.28,bw90:0.35}},
  {name:'Développé haltères couché',muscle:'pec',pattern:'push',equipment:'haltères',difficulty:'intermédiaire',muscles_secondary:['ep','tri'],tips:'Amplitude maximale pour l etirement optimal. Prise neutre possible.',alternatives:['Développé couché barre','Développé machine'],std_ratio:{bw60:0.35,bw75:0.45,bw90:0.55}},
  // Dos
  {name:'Tractions',muscle:'dos',pattern:'pull',equipment:'barre de traction',difficulty:'avancé',muscles_secondary:['bic','bas'],tips:'Prise pronation large pour le dos large. Descendre completement.',alternatives:['Tirage vertical poulie','Tirage supination'],std_ratio:{bw60:0.5,bw75:0.75,bw90:1.0}},
  {name:'Rowing barre',muscle:'dos',pattern:'pull',equipment:'barre',difficulty:'intermédiaire',muscles_secondary:['bic','bas'],tips:'Dos a 45 degres, tirer vers le nombril. Dos droit.',alternatives:['Rowing barre T','Rowing machine'],std_ratio:{bw60:0.5,bw75:0.65,bw90:0.8}},
  {name:'Pulldown bras tendus',muscle:'dos',pattern:'pull',equipment:'câble',difficulty:'débutant',muscles_secondary:['tri'],tips:'Garder les bras quasi tendus. Tirer avec les coudes vers les hanches.',alternatives:['Pull-over haltère','Pullover machine'],std_ratio:{bw60:0.22,bw75:0.28,bw90:0.35}},
  {name:'Reverse pec deck',muscle:'dos',pattern:'pull',equipment:'machine',difficulty:'débutant',muscles_secondary:['ep'],tips:'Cibler l arriere de l epaule et les rhomboides. Coudes a hauteur des epaules.',alternatives:['Oiseau haltères','Face pulls'],std_ratio:{bw60:0.18,bw75:0.22,bw90:0.28}},
  {name:'Pull-over haltère',muscle:'dos',pattern:'pull',equipment:'haltères',difficulty:'intermédiaire',muscles_secondary:['pec','tri'],tips:'Arc de cercle controle. Etirer le grand dorsal en fin d extension.',alternatives:['Pullover poulie','Pulldown bras tendus'],std_ratio:{bw60:0.18,bw75:0.22,bw90:0.28}},
  // Jambes
  {name:'Squat barre',muscle:'jam',pattern:'legs',equipment:'barre',difficulty:'avancé',muscles_secondary:['bas','abd'],tips:'Pieds largeur epaules. Descendre sous le parallele. Genoux dans axe des pieds.',alternatives:['Goblet squat','Hack squat machine'],std_ratio:{bw60:0.8,bw75:1.0,bw90:1.3}},
  {name:'Fentes marchées',muscle:'jam',pattern:'legs',equipment:'haltères',difficulty:'intermédiaire',muscles_secondary:['bas'],tips:'Grand pas en avant. Genou avant ne depasse pas le pied.',alternatives:['Fentes bulgares','Leg press'],std_ratio:{bw60:0.25,bw75:0.35,bw90:0.45}},
  {name:'Leg press',muscle:'jam',pattern:'legs',equipment:'machine',difficulty:'débutant',muscles_secondary:[],tips:'Pieds hauts pour ischio, pieds bas pour quadriceps. Garder le bas du dos plaqué.',alternatives:['Presse à cuisses','Squat'],std_ratio:{bw60:1.2,bw75:1.5,bw90:1.8}},
  {name:'Goblet squat',muscle:'jam',pattern:'legs',equipment:'haltères',difficulty:'débutant',muscles_secondary:['abd','bas'],tips:'Haltere tenu devant la poitrine. Ideal pour apprendre le squat.',alternatives:['Squat barre','Hack squat machine'],std_ratio:{bw60:0.18,bw75:0.25,bw90:0.32}},
  {name:'Nordic curl',muscle:'jam',pattern:'legs',equipment:'aucun',difficulty:'avancé',muscles_secondary:[],tips:'Mouvement excentrique controle. Prevention des blessures.',alternatives:['Leg curl','SDT jambes tendues'],std_ratio:{}},
  {name:'Mollets assis (machine)',muscle:'jam',pattern:'legs',equipment:'machine',difficulty:'débutant',muscles_secondary:[],tips:'Cibler le soléaire (sous le mollet). Amplitude complète, pause en bas.',alternatives:['Mollets debout','Mollets presse'],std_ratio:{bw60:0.5,bw75:0.65,bw90:0.8}},
  // Épaules
  {name:'Développé militaire barre',muscle:'ep',pattern:'push',equipment:'barre',difficulty:'intermédiaire',muscles_secondary:['tri','abd'],tips:'Gainage actif. Barre passant devant ou derrière la tête (devant = plus sûr).',alternatives:['Développé épaules machine','Landmine press'],std_ratio:{bw60:0.35,bw75:0.45,bw90:0.55}},
  {name:'Oiseau à la poulie',muscle:'ep',pattern:'pull',equipment:'câble',difficulty:'débutant',muscles_secondary:['dos'],tips:'Cibler le deltoïde postérieur. Coude légèrement fléchi, tirer horizontalement.',alternatives:['Reverse pec deck','Face pulls'],std_ratio:{bw60:0.06,bw75:0.08,bw90:0.1}},
  {name:'Arnold press',muscle:'ep',pattern:'push',equipment:'haltères',difficulty:'intermédiaire',muscles_secondary:['tri'],tips:'Rotation pendant la montee pour les 3 chefs du deltoide.',alternatives:['Développé militaire','Développé épaules machine'],std_ratio:{bw60:0.16,bw75:0.2,bw90:0.25}},
  {name:'Y-raise incliné',muscle:'ep',pattern:'push',equipment:'haltères',difficulty:'intermédiaire',muscles_secondary:['bas'],tips:'Posture de base de l épaule. Excellent pour renforcer les stabilisateurs.',alternatives:['Face pulls','Reverse pec deck'],std_ratio:{}},
  // Biceps
  {name:'Curl haltères alterné',muscle:'bic',pattern:'pull',equipment:'haltères',difficulty:'débutant',muscles_secondary:[],tips:'Supination complete. Ne pas balancer le corps.',alternatives:['Curl barre EZ','Curl câble'],std_ratio:{bw60:0.14,bw75:0.18,bw90:0.22}},
  {name:'Curl câble',muscle:'bic',pattern:'pull',equipment:'câble',difficulty:'débutant',muscles_secondary:[],tips:'Tension constante du cable = recrutement musculaire optimal.',alternatives:['Curl barre EZ','Curl haltères'],std_ratio:{bw60:0.14,bw75:0.18,bw90:0.22}},
  {name:'Spider curl',muscle:'bic',pattern:'pull',equipment:'haltères',difficulty:'intermédiaire',muscles_secondary:[],tips:'Banc incliné face contre l appui. Le long chef du biceps est en position raccourcie.',alternatives:['Curl pupitre','Curl incliné'],std_ratio:{bw60:0.12,bw75:0.15,bw90:0.18}},
  {name:'Curl inversé barre EZ',muscle:'bic',pattern:'pull',equipment:'barre EZ',difficulty:'intermédiaire',muscles_secondary:[],tips:'Cibler le brachialis. Prise pronation.',alternatives:['Curl marteau','Reverse curl haltères'],std_ratio:{bw60:0.14,bw75:0.18,bw90:0.22}},
  // Triceps
  {name:'Extension triceps couchée (skullcrusher)',muscle:'tri',pattern:'push',equipment:'barre EZ',difficulty:'intermédiaire',muscles_secondary:[],tips:'Descendre la barre vers le front. Long chef du triceps.',alternatives:['Extension haltère','Dips'],std_ratio:{bw60:0.28,bw75:0.35,bw90:0.42}},
  {name:'Dips barre parallèles',muscle:'tri',pattern:'push',equipment:'barre parallèles',difficulty:'intermédiaire',muscles_secondary:['pec','ep'],tips:'Corps vertical cible les triceps. Corps incline cible les pectoraux.',alternatives:['Dips assistés','Pushdown'],std_ratio:{bw60:0.6,bw75:0.8,bw90:1.0}},
  {name:'Extension haltère au-dessus tête',muscle:'tri',pattern:'push',equipment:'haltères',difficulty:'débutant',muscles_secondary:[],tips:'Coudes fixes près de la tête. Long chef du triceps en position allongée.',alternatives:['Extension corde','Skullcrusher'],std_ratio:{bw60:0.12,bw75:0.15,bw90:0.18}},
  // Abdominaux & Gainage
  {name:'Crunch câble',muscle:'abd',pattern:'core',equipment:'câble',difficulty:'débutant',muscles_secondary:[],tips:'S enrouler vers les genoux. Contraction maximale en bas.',alternatives:['Crunch décliné','Ab wheel'],std_ratio:{}},
  {name:'Ab wheel (roulette)',muscle:'abd',pattern:'core',equipment:'aucun',difficulty:'avancé',muscles_secondary:['bas','dos'],tips:'Maintenir le gainage actif tout au long.',alternatives:['Planche','Dragon flag'],std_ratio:{}},
  {name:'Planche latérale',muscle:'abd',pattern:'core',equipment:'aucun',difficulty:'débutant',muscles_secondary:['bas'],tips:'Corps droit de la tete aux pieds. Hanches ne descendent pas.',alternatives:['Planche','Pallof press'],std_ratio:{}},
  {name:'Pallof press',muscle:'abd',pattern:'core',equipment:'câble',difficulty:'intermédiaire',muscles_secondary:['bas'],tips:'Resister a la rotation. Gainage anti-rotation fondamental.',alternatives:['Planche latérale','Crunch câble'],std_ratio:{}},
  // Bas du dos & Gainage
  {name:'Good morning',muscle:'bas',pattern:'legs',equipment:'barre',difficulty:'avancé',muscles_secondary:['jam','bas'],tips:'Mouvement de hanche, pas de flexion lombaire. Excellent exercice d accessoire.',alternatives:['SDT roumain','Hyperextension'],std_ratio:{bw60:0.25,bw75:0.35,bw90:0.45}},
  {name:'Hyperextension',muscle:'bas',pattern:'core',equipment:'machine',difficulty:'débutant',muscles_secondary:['jam'],tips:'Arreter a l alignement corps-jambes. Ne pas hyperextendre.',alternatives:['Good morning','Superman'],std_ratio:{}},
  {name:'Soulevé de terre conventionnel',muscle:'bas',pattern:'legs',equipment:'barre',difficulty:'avancé',muscles_secondary:['jam','dos','bic'],tips:'Dos plat, barre pres du corps. Hanches entre epaules et genoux.',alternatives:['SDT roumain haltères','Trap bar deadlift'],std_ratio:{bw60:1.0,bw75:1.3,bw90:1.6}},
  {name:'Hack squat machine',muscle:'jam',pattern:'legs',equipment:'machine',difficulty:'intermédiaire',muscles_secondary:[],tips:'Pieds avant de la plateforme pour maximiser le quadriceps.',alternatives:['Presse à cuisses','Squat gobelet'],std_ratio:{bw60:0.8,bw75:1.0,bw90:1.2}},
  {name:'Leg curl',muscle:'jam',pattern:'legs',equipment:'machine',difficulty:'débutant',muscles_secondary:[],tips:'Pointe de pied vers vous pour maximiser la flexion des ischio-jambiers.',alternatives:['SDT jambes tendues','Nordic curl'],std_ratio:{bw60:0.3,bw75:0.38,bw90:0.45}},
  {name:'Rowing barre T',muscle:'dos',pattern:'pull',equipment:'barre',difficulty:'intermédiaire',muscles_secondary:['bic','bas'],tips:'Dos horizontal à 45°. Tirer vers le nombril avec les coudes serrés.',alternatives:['Rowing barre','Rowing machine'],std_ratio:{bw60:0.5,bw75:0.65,bw90:0.8}},
  {name:'Shrugs haltères',muscle:'dos',pattern:'pull',equipment:'haltères',difficulty:'débutant',muscles_secondary:[],tips:'Mouvement vertical pur, pas de rotation. Tenir 1s en haut.',alternatives:['Shrugs barre','Shrugs machine'],std_ratio:{bw60:0.5,bw75:0.65,bw90:0.8}},
  {name:'Extension triceps au-dessus tête',muscle:'tri',pattern:'push',equipment:'câble',difficulty:'intermédiaire',muscles_secondary:[],tips:'Long chef du triceps = meilleur étirement. Coudes fixes près des oreilles.',alternatives:['Extension couchée','Extension haltère'],std_ratio:{bw60:0.18,bw75:0.22,bw90:0.28}},
];

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
