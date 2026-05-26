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
const EXERCISE_LIBRARY = [

  /* ═══════════════════════════════════════
     PECTORAUX (22 exercices)
  ═══════════════════════════════════════ */
  {name:'Développé incliné haltères',muscle:'pec',pattern:'push',equipment:'haltères',difficulty:'intermédiaire',muscles_secondary:['ep','tri'],tips:'Prise neutre pour protéger les épaules. Descendre jusqu\'à étirement complet.',alternatives:['Développé incliné barre','Pompes inclinées','Développé convergent machine'],std_ratio:{bw60:0.5,bw75:0.65,bw90:0.8}},
  {name:'Développé couché barre',muscle:'pec',pattern:'push',equipment:'barre',difficulty:'intermédiaire',muscles_secondary:['ep','tri'],tips:'Pieds à plat, omoplate rétractées. Descendre la barre au niveau des mamelons.',alternatives:['Développé haltères couché','Pompes','Pec deck'],std_ratio:{bw60:0.75,bw75:1.0,bw90:1.25}},
  {name:'Développé haltères couché',muscle:'pec',pattern:'push',equipment:'haltères',difficulty:'débutant',muscles_secondary:['ep','tri'],tips:'Amplitude maximale pour l\'étirement. Contrôler la descente lentement.',alternatives:['Développé couché barre','Pec deck','Pompes'],std_ratio:{bw60:0.35,bw75:0.45,bw90:0.6}},
  {name:'Développé couché machine',muscle:'pec',pattern:'push',equipment:'machine',difficulty:'débutant',muscles_secondary:['ep','tri'],tips:'Régler la poignée au niveau de la poitrine. Idéal pour les débutants.',alternatives:['Développé couché barre','Développé haltères couché'],std_ratio:{bw60:0.5,bw75:0.65,bw90:0.85}},
  {name:'Développé incliné barre',muscle:'pec',pattern:'push',equipment:'barre',difficulty:'intermédiaire',muscles_secondary:['ep','tri'],tips:'Inclinaison 30-45°. Cible le faisceau supérieur du pectoral.',alternatives:['Développé incliné haltères','Développé convergent machine'],std_ratio:{bw60:0.6,bw75:0.8,bw90:1.0}},
  {name:'Développé décliné barre',muscle:'pec',pattern:'push',equipment:'barre',difficulty:'intermédiaire',muscles_secondary:['tri'],tips:'Cible le faisceau inférieur. Bonne alternative si douleurs aux épaules.',alternatives:['Dips','Développé décliné haltères'],std_ratio:{bw60:0.8,bw75:1.0,bw90:1.3}},
  {name:'Développé convergent machine',muscle:'pec',pattern:'push',equipment:'machine',difficulty:'débutant',muscles_secondary:['ep','tri'],tips:'Mouvement convergent = meilleure contraction pectorale. Idéal en finition.',alternatives:['Pec deck','Cross-over poulie'],std_ratio:{bw60:0.55,bw75:0.7,bw90:0.9}},
  {name:'Écartés haltères couché',muscle:'pec',pattern:'fly',equipment:'haltères',difficulty:'intermédiaire',muscles_secondary:[],tips:'Légère flexion des coudes. Ne pas descendre trop bas pour protéger les épaules.',alternatives:['Pec deck','Cross-over poulie','Écartés poulie'],std_ratio:{bw60:0.2,bw75:0.28,bw90:0.38}},
  {name:'Écartés inclinés haltères',muscle:'pec',pattern:'fly',equipment:'haltères',difficulty:'intermédiaire',muscles_secondary:[],tips:'30-45° d\'inclinaison. Cible le haut du pectoral. Amplitude contrôlée.',alternatives:['Pec deck','Cross-over poulie incliné'],std_ratio:{bw60:0.18,bw75:0.25,bw90:0.33}},
  {name:'Pec deck',muscle:'pec',pattern:'fly',equipment:'machine',difficulty:'débutant',muscles_secondary:[],tips:'Garder les coudes légèrement fléchis. Chercher la contraction maximale en fin de mouvement.',alternatives:['Écartés haltères','Cross-over poulie'],std_ratio:{bw60:0.35,bw75:0.5,bw90:0.65}},
  {name:'Cross-over poulie',muscle:'pec',pattern:'fly',equipment:'câble',difficulty:'intermédiaire',muscles_secondary:[],tips:'Angle variable selon la hauteur des poulies. Croiser les mains pour contraction maximale.',alternatives:['Pec deck','Écartés haltères'],std_ratio:{bw60:0.25,bw75:0.35,bw90:0.45}},
  {name:'Écartés poulie',muscle:'pec',pattern:'fly',equipment:'câble',difficulty:'débutant',muscles_secondary:[],tips:'Tension constante tout au long du mouvement. Meilleure alternative aux écartés haltères.',alternatives:['Pec deck','Écartés haltères'],std_ratio:{bw60:0.2,bw75:0.28,bw90:0.38}},
  {name:'Pompes',muscle:'pec',pattern:'push',equipment:'poids du corps',difficulty:'débutant',muscles_secondary:['ep','tri'],tips:'Corps gainé comme une planche. Descendre jusqu\'à ce que la poitrine touche presque le sol.',alternatives:['Développé couché barre','Développé haltères couché'],std_ratio:{bw60:1,bw75:1,bw90:1}},
  {name:'Pompes inclinées',muscle:'pec',pattern:'push',equipment:'poids du corps',difficulty:'débutant',muscles_secondary:['ep','tri'],tips:'Pieds surélevés = plus de charge sur le haut du pectoral. Corps gaîné.',alternatives:['Développé incliné haltères','Développé incliné barre'],std_ratio:{bw60:1,bw75:1,bw90:1}},
  {name:'Pompes avec lest',muscle:'pec',pattern:'push',equipment:'poids du corps',difficulty:'avancé',muscles_secondary:['ep','tri'],tips:'Utiliser un gilet lesté ou des disques sur le dos. Corps parfaitement gainé.',alternatives:['Développé couché barre','Dips lestés'],std_ratio:{bw60:1,bw75:1,bw90:1}},
  {name:'Dips (pectoraux)',muscle:'pec',pattern:'push',equipment:'poids du corps',difficulty:'intermédiaire',muscles_secondary:['tri','ep'],tips:'Se pencher légèrement en avant pour cibler les pectoraux plutôt que les triceps.',alternatives:['Développé décliné barre','Pompes'],std_ratio:{bw60:1,bw75:1,bw90:1}},
  {name:'Pull-over haltère (pec)',muscle:'pec',pattern:'fly',equipment:'haltères',difficulty:'intermédiaire',muscles_secondary:['dos'],tips:'Haltère tenu à deux mains. Descendre lentement en arc derrière la tête.',alternatives:['Pull-over câble','Pull-over machine'],std_ratio:{bw60:0.3,bw75:0.4,bw90:0.5}},
  {name:'Pull-over câble',muscle:'pec',pattern:'fly',equipment:'câble',difficulty:'intermédiaire',muscles_secondary:['dos'],tips:'Tension constante grâce au câble. Meilleure variante pour l\'isolation.',alternatives:['Pull-over haltère'],std_ratio:{bw60:0.25,bw75:0.35,bw90:0.45}},
  {name:'Landmine press',muscle:'pec',pattern:'push',equipment:'barre',difficulty:'intermédiaire',muscles_secondary:['ep','tri'],tips:'Mouvement arc de cercle. Excellent pour le haut du pectoral sans stress épaule.',alternatives:['Développé incliné barre','Arnold press'],std_ratio:{bw60:0.35,bw75:0.45,bw90:0.6}},
  {name:'Floor press',muscle:'pec',pattern:'push',equipment:'barre',difficulty:'intermédiaire',muscles_secondary:['tri'],tips:'Allongé au sol. Amplitude limitée = moins de stress sur les épaules.',alternatives:['Développé couché barre','Board press'],std_ratio:{bw60:0.65,bw75:0.85,bw90:1.05}},
  {name:'Développé haltères décliné',muscle:'pec',pattern:'push',equipment:'haltères',difficulty:'intermédiaire',muscles_secondary:['tri'],tips:'Tête en bas 15-30°. Cibler le bas du pectoral sans contraindre les épaules.',alternatives:['Développé décliné barre','Dips'],std_ratio:{bw60:0.4,bw75:0.52,bw90:0.68}},
  {name:'Cable fly bas vers haut',muscle:'pec',pattern:'fly',equipment:'câble',difficulty:'débutant',muscles_secondary:[],tips:'Poulies en bas. Mouvement du bas vers le haut pour cibler le haut des pectoraux.',alternatives:['Écartés inclinés haltères','Développé incliné machine'],std_ratio:{bw60:0.18,bw75:0.25,bw90:0.33}},

  /* ═══════════════════════════════════════
     DOS (28 exercices)
  ═══════════════════════════════════════ */
  {name:'Tirage vertical poulie',muscle:'dos',pattern:'pull',equipment:'câble',difficulty:'débutant',muscles_secondary:['bic'],tips:'Barre derrière la nuque est à éviter. Tirer vers le menton en avant, omoplate vers le bas.',alternatives:['Tractions','Tirage machine'],std_ratio:{bw60:0.7,bw75:0.9,bw90:1.1}},
  {name:'Tractions',muscle:'dos',pattern:'pull',equipment:'poids du corps',difficulty:'intermédiaire',muscles_secondary:['bic'],tips:'Partir bras tendus. Tirer avec les coudes vers les hanches. Pas de balancement.',alternatives:['Tirage vertical poulie','Tirage machine'],std_ratio:{bw60:1,bw75:1,bw90:1}},
  {name:'Tractions lestées',muscle:'dos',pattern:'pull',equipment:'poids du corps',difficulty:'avancé',muscles_secondary:['bic'],tips:'Utiliser une ceinture lestée. Corps stable, pas de balancement.',alternatives:['Tirage vertical poulie lourde'],std_ratio:{bw60:1.2,bw75:1.4,bw90:1.6}},
  {name:'Rowing poulie basse',muscle:'dos',pattern:'pull',equipment:'câble',difficulty:'débutant',muscles_secondary:['bic','ep'],tips:'Dos droit, tirer avec les coudes en arrière. Serrer les omoplates en fin de mouvement.',alternatives:['Rowing barre','Rowing haltère'],std_ratio:{bw60:0.65,bw75:0.85,bw90:1.05}},
  {name:'Rowing barre',muscle:'dos',pattern:'pull',equipment:'barre',difficulty:'intermédiaire',muscles_secondary:['bic','bas'],tips:'Dos parallèle au sol, barre sous les genoux. Tirer vers le nombril.',alternatives:['Rowing poulie basse','Rowing barre T'],std_ratio:{bw60:0.6,bw75:0.8,bw90:1.0}},
  {name:'Rowing haltère',muscle:'dos',pattern:'pull',equipment:'haltères',difficulty:'débutant',muscles_secondary:['bic'],tips:'Main et genou sur un banc. Tirer le coude vers le plafond. Amplitude maximale.',alternatives:['Rowing poulie basse','Rowing barre'],std_ratio:{bw60:0.3,bw75:0.42,bw90:0.55}},
  {name:'Rowing barre T',muscle:'dos',pattern:'pull',equipment:'barre',difficulty:'intermédiaire',muscles_secondary:['bic'],tips:'Excellent pour l\'épaisseur du dos. Barre entre les jambes, tirer vers la poitrine.',alternatives:['Rowing barre','Rowing machine'],std_ratio:{bw60:0.55,bw75:0.75,bw90:0.95}},
  {name:'Rowing machine',muscle:'dos',pattern:'pull',equipment:'machine',difficulty:'débutant',muscles_secondary:['bic'],tips:'Poitrine contre le pad. Tirer les coudes en arrière en serrant les omoplates.',alternatives:['Rowing haltère','Rowing poulie basse'],std_ratio:{bw60:0.55,bw75:0.75,bw90:0.95}},
  {name:'Pulldown bras tendus',muscle:'dos',pattern:'pull',equipment:'câble',difficulty:'débutant',muscles_secondary:[],tips:'Isolation du grand dorsal. Bras quasi tendus, pousser la barre vers les cuisses.',alternatives:['Pull-over haltère','Pulldown machine'],std_ratio:{bw60:0.25,bw75:0.35,bw90:0.45}},
  {name:'Pull-over haltère',muscle:'dos',pattern:'pull',equipment:'haltères',difficulty:'intermédiaire',muscles_secondary:['pec'],tips:'Couché sur banc transversalement. Descendre l\'haltère en arc en gardant les bras légèrement fléchis.',alternatives:['Pull-over câble','Pulldown bras tendus'],std_ratio:{bw60:0.3,bw75:0.4,bw90:0.5}},
  {name:'Reverse pec deck',muscle:'dos',pattern:'pull',equipment:'machine',difficulty:'débutant',muscles_secondary:['ep'],tips:'Face au pad. Écarter les bras en arrière pour cibler les deltoïdes postérieurs et rhomboïdes.',alternatives:['Oiseau haltères','Face pulls'],std_ratio:{bw60:0.25,bw75:0.35,bw90:0.45}},
  {name:'Shrugs barre',muscle:'dos',pattern:'autre',equipment:'barre',difficulty:'débutant',muscles_secondary:[],tips:'Trapèzes supérieurs. Haussement d\'épaules pur, pas de rotation. Amplitude maximale.',alternatives:['Shrugs haltères','Shrugs à la machine'],std_ratio:{bw60:1.0,bw75:1.4,bw90:1.8}},
  {name:'Shrugs haltères',muscle:'dos',pattern:'autre',equipment:'haltères',difficulty:'débutant',muscles_secondary:[],tips:'Plus d\'amplitude que la barre. Monter le plus haut possible, pause en haut.',alternatives:['Shrugs barre','Shrugs câble'],std_ratio:{bw60:0.5,bw75:0.65,bw90:0.85}},
  {name:'Shrugs câble',muscle:'dos',pattern:'autre',equipment:'câble',difficulty:'débutant',muscles_secondary:[],tips:'Tension constante. Idéal pour garder la tension sur les trapèzes tout le mouvement.',alternatives:['Shrugs barre','Shrugs haltères'],std_ratio:{bw60:0.5,bw75:0.65,bw90:0.85}},
  {name:'Face pulls',muscle:'dos',pattern:'pull',equipment:'câble',difficulty:'débutant',muscles_secondary:['ep'],tips:'Poulie haute, corde, tirer vers le visage. Coudes hauts. Indispensable pour la santé épaule.',alternatives:['Oiseau haltères','Reverse pec deck'],std_ratio:{bw60:0.25,bw75:0.35,bw90:0.45}},
  {name:'Oiseau haltères',muscle:'dos',pattern:'fly',equipment:'haltères',difficulty:'débutant',muscles_secondary:['ep'],tips:'Penché en avant, écarter les bras en arrière. Cibler deltoïdes postérieurs et rhomboïdes.',alternatives:['Face pulls','Reverse pec deck'],std_ratio:{bw60:0.12,bw75:0.18,bw90:0.25}},
  {name:'Tirage col',muscle:'dos',pattern:'pull',equipment:'câble',difficulty:'débutant',muscles_secondary:['bic','ep'],tips:'Prise large, tirer vers la clavicule. Variante du tirage vertical plus axée épaisseur.',alternatives:['Tirage vertical poulie','Rowing poulie basse'],std_ratio:{bw60:0.65,bw75:0.85,bw90:1.05}},
  {name:'Tirage neutre machine',muscle:'dos',pattern:'pull',equipment:'machine',difficulty:'débutant',muscles_secondary:['bic'],tips:'Prise neutre = moins de stress sur les coudes. Tirer vers la poitrine.',alternatives:['Tirage vertical poulie','Rowing machine'],std_ratio:{bw60:0.65,bw75:0.85,bw90:1.05}},
  {name:'Tirage unilatéral câble',muscle:'dos',pattern:'pull',equipment:'câble',difficulty:'intermédiaire',muscles_secondary:['bic'],tips:'Un bras à la fois. Rotation du torse pour plus d\'amplitude et meilleure isolation.',alternatives:['Rowing haltère','Tirage vertical poulie'],std_ratio:{bw60:0.3,bw75:0.4,bw90:0.55}},
  {name:'Deadlift sumo',muscle:'dos',pattern:'hinge',equipment:'barre',difficulty:'avancé',muscles_secondary:['jamp','bas'],tips:'Prise entre les jambes écartées. Moins de stress lombaire que le conventionnel.',alternatives:['Soulevé de terre conventionnel','Trap bar deadlift'],std_ratio:{bw60:1.0,bw75:1.4,bw90:1.8}},
  {name:'Trap bar deadlift',muscle:'dos',pattern:'hinge',equipment:'barre',difficulty:'intermédiaire',muscles_secondary:['jamp','bas'],tips:'Poignées neutres. Position plus naturelle = moins de stress lombaire.',alternatives:['Soulevé de terre conventionnel','Deadlift sumo'],std_ratio:{bw60:1.1,bw75:1.5,bw90:1.9}},
  {name:'Seal row',muscle:'dos',pattern:'pull',equipment:'barre',difficulty:'intermédiaire',muscles_secondary:['bic'],tips:'Allongé face contre un banc surélevé. Élimine le balancement du corps.',alternatives:['Rowing barre','Rowing haltère'],std_ratio:{bw60:0.45,bw75:0.6,bw90:0.8}},
  {name:'Rack pull',muscle:'dos',pattern:'hinge',equipment:'barre',difficulty:'avancé',muscles_secondary:['bas','jamp'],tips:'SDT partiel à partir des genoux. Charge plus lourde, focus sur le haut du dos.',alternatives:['Soulevé de terre conventionnel','Shrugs barre'],std_ratio:{bw60:1.3,bw75:1.7,bw90:2.2}},
  {name:'Inverted row',muscle:'dos',pattern:'pull',equipment:'poids du corps',difficulty:'débutant',muscles_secondary:['bic'],tips:'Excellent pour débuter les tractions. Corps rigide, tirer la poitrine vers la barre.',alternatives:['Rowing machine','Tractions assistées'],std_ratio:{bw60:1,bw75:1,bw90:1}},
  {name:'Rowing Pendlay',muscle:'dos',pattern:'pull',equipment:'barre',difficulty:'avancé',muscles_secondary:['bic','bas'],tips:'Barre posée au sol entre chaque rep. Explosif, excellent pour la force.',alternatives:['Rowing barre','Rowing barre T'],std_ratio:{bw60:0.55,bw75:0.75,bw90:0.95}},
  {name:'Tirage poulie haute prise serrée',muscle:'dos',pattern:'pull',equipment:'câble',difficulty:'débutant',muscles_secondary:['bic'],tips:'Prise serrée = plus de biceps. Tirer vers le menton.',alternatives:['Tirage vertical poulie','Tirage col'],std_ratio:{bw60:0.65,bw75:0.85,bw90:1.05}},
  {name:'Straight arm pulldown',muscle:'dos',pattern:'pull',equipment:'câble',difficulty:'débutant',muscles_secondary:[],tips:'Bras quasi tendus. Excellent pour l\'isolation du grand dorsal et la connexion muscle-cerveau.',alternatives:['Pulldown bras tendus','Pull-over câble'],std_ratio:{bw60:0.22,bw75:0.3,bw90:0.4}},
  {name:'Meadows row',muscle:'dos',pattern:'pull',equipment:'barre',difficulty:'avancé',muscles_secondary:['bic'],tips:'Barre en angle dans un coin. Excellente amplitude et contraction du grand dorsal.',alternatives:['Rowing haltère','Tirage unilatéral câble'],std_ratio:{bw60:0.35,bw75:0.48,bw90:0.62}},

  /* ═══════════════════════════════════════
     ÉPAULES (20 exercices)
  ═══════════════════════════════════════ */
  {name:'Développé militaire barre',muscle:'ep',pattern:'push',equipment:'barre',difficulty:'intermédiaire',muscles_secondary:['tri'],tips:'Debout ou assis. Barre à la hauteur de la clavicule. Pousser droit au-dessus de la tête.',alternatives:['Développé haltères assis','Arnold press','Développé militaire machine'],std_ratio:{bw60:0.5,bw75:0.65,bw90:0.85}},
  {name:'Développé haltères assis',muscle:'ep',pattern:'push',equipment:'haltères',difficulty:'débutant',muscles_secondary:['tri'],tips:'Haltères en haut, pousser vers le ciel. Ne pas verrouiller les coudes. Amplitude complète.',alternatives:['Développé militaire barre','Arnold press'],std_ratio:{bw60:0.22,bw75:0.3,bw90:0.4}},
  {name:'Développé militaire machine',muscle:'ep',pattern:'push',equipment:'machine',difficulty:'débutant',muscles_secondary:['tri'],tips:'Guidé = idéal pour débutants. Régler la hauteur de la poignée.',alternatives:['Développé haltères assis','Développé militaire barre'],std_ratio:{bw60:0.35,bw75:0.48,bw90:0.62}},
  {name:'Arnold press',muscle:'ep',pattern:'push',equipment:'haltères',difficulty:'intermédiaire',muscles_secondary:['tri'],tips:'Rotation des paumes pendant le mouvement. Cible les 3 faisceaux du deltoïde.',alternatives:['Développé haltères assis','Développé militaire barre'],std_ratio:{bw60:0.2,bw75:0.28,bw90:0.38}},
  {name:'Élévations latérales',muscle:'ep',pattern:'raise',equipment:'haltères',difficulty:'débutant',muscles_secondary:[],tips:'Légère flexion des coudes. Lever jusqu\'à l\'horizontal. Contrôler la descente.',alternatives:['Élévations câble','Élévations machine'],std_ratio:{bw60:0.1,bw75:0.14,bw90:0.18}},
  {name:'Élévations latérales câble',muscle:'ep',pattern:'raise',equipment:'câble',difficulty:'débutant',muscles_secondary:[],tips:'Tension constante tout le mouvement. Souvent plus efficace que les haltères.',alternatives:['Élévations latérales','Élévations machine'],std_ratio:{bw60:0.08,bw75:0.11,bw90:0.15}},
  {name:'Élévations latérales machine',muscle:'ep',pattern:'raise',equipment:'machine',difficulty:'débutant',muscles_secondary:[],tips:'Idéal pour l\'isolation. Pad contre le bras pour stabiliser.',alternatives:['Élévations latérales','Élévations câble'],std_ratio:{bw60:0.1,bw75:0.14,bw90:0.18}},
  {name:'Élévations frontales barre',muscle:'ep',pattern:'raise',equipment:'barre',difficulty:'débutant',muscles_secondary:[],tips:'Prise pronation. Lever jusqu\'à hauteur des yeux. Éviter de prendre l\'élan.',alternatives:['Élévations frontales haltères','Élévations frontales câble'],std_ratio:{bw60:0.2,bw75:0.28,bw90:0.38}},
  {name:'Élévations frontales haltères',muscle:'ep',pattern:'raise',equipment:'haltères',difficulty:'débutant',muscles_secondary:[],tips:'Alterné ou simultané. Bras quasi tendus. Monter jusqu\'à la hauteur de l\'épaule.',alternatives:['Élévations frontales barre','Élévations frontales câble'],std_ratio:{bw60:0.1,bw75:0.14,bw90:0.18}},
  {name:'Élévations frontales câble',muscle:'ep',pattern:'raise',equipment:'câble',difficulty:'débutant',muscles_secondary:[],tips:'Poulie basse. Tension constante = meilleur stimulus.',alternatives:['Élévations frontales haltères','Élévations frontales barre'],std_ratio:{bw60:0.1,bw75:0.14,bw90:0.18}},
  {name:'Oiseau à la poulie',muscle:'ep',pattern:'fly',equipment:'câble',difficulty:'débutant',muscles_secondary:['dos'],tips:'Poulie haute ou basse. Cibler les deltoïdes postérieurs. Coudes légèrement fléchis.',alternatives:['Face pulls','Oiseau haltères'],std_ratio:{bw60:0.1,bw75:0.14,bw90:0.18}},
  {name:'Y-raise incliné',muscle:'ep',pattern:'raise',equipment:'haltères',difficulty:'débutant',muscles_secondary:['dos'],tips:'Couché sur banc incliné 30-45°. Lever en Y. Excellent pour la coiffe des rotateurs.',alternatives:['Face pulls','Oiseau haltères'],std_ratio:{bw60:0.05,bw75:0.08,bw90:0.12}},
  {name:'Rotations externes câble',muscle:'ep',pattern:'autre',equipment:'câble',difficulty:'débutant',muscles_secondary:[],tips:'Coude à 90° contre le corps. Rotation externe pure. Indispensable pour la santé épaule.',alternatives:['Rotations externes haltère','Y-raise incliné'],std_ratio:{bw60:0.08,bw75:0.1,bw90:0.14}},
  {name:'Rotations externes haltère',muscle:'ep',pattern:'autre',equipment:'haltères',difficulty:'débutant',muscles_secondary:[],tips:'Allongé sur le côté. Coude à 90°. Mouvement lent et contrôlé.',alternatives:['Rotations externes câble','Y-raise incliné'],std_ratio:{bw60:0.05,bw75:0.07,bw90:0.1}},
  {name:'Upright row barre',muscle:'ep',pattern:'pull',equipment:'barre',difficulty:'intermédiaire',muscles_secondary:['dos'],tips:'Prise légèrement plus large que les épaules. Coudes au-dessus des poignets. Attention impingement.',alternatives:['Upright row haltères','Face pulls'],std_ratio:{bw60:0.45,bw75:0.6,bw90:0.78}},
  {name:'Upright row haltères',muscle:'ep',pattern:'pull',equipment:'haltères',difficulty:'intermédiaire',muscles_secondary:['dos'],tips:'Plus de liberté de mouvement qu\'avec la barre. Moins de risque d\'impingement.',alternatives:['Upright row barre','Face pulls'],std_ratio:{bw60:0.2,bw75:0.28,bw90:0.38}},
  {name:'Push press',muscle:'ep',pattern:'push',equipment:'barre',difficulty:'avancé',muscles_secondary:['jamp','tri'],tips:'Légère flexion des jambes pour prendre de l\'élan. Mouvement explosif. Force et puissance.',alternatives:['Développé militaire barre','Jerk'],std_ratio:{bw60:0.6,bw75:0.8,bw90:1.0}},
  {name:'Handstand push-up',muscle:'ep',pattern:'push',equipment:'poids du corps',difficulty:'avancé',muscles_secondary:['tri'],tips:'Contre un mur. Mains à la largeur des épaules. Forcer les triceps en fin de mouvement.',alternatives:['Développé militaire barre','Pike push-up'],std_ratio:{bw60:1,bw75:1,bw90:1}},
  {name:'Pike push-up',muscle:'ep',pattern:'push',equipment:'poids du corps',difficulty:'intermédiaire',muscles_secondary:['tri'],tips:'Hanches en l\'air, corps en V. Descendre la tête vers le sol entre les mains.',alternatives:['Handstand push-up','Développé militaire machine'],std_ratio:{bw60:1,bw75:1,bw90:1}},
  {name:'Cuban press',muscle:'ep',pattern:'autre',equipment:'haltères',difficulty:'intermédiaire',muscles_secondary:[],tips:'Combo: upright row + rotation externe + développé. Excellent pour la coiffe des rotateurs.',alternatives:['Rotations externes câble','Y-raise incliné'],std_ratio:{bw60:0.08,bw75:0.12,bw90:0.16}},

  /* ═══════════════════════════════════════
     BICEPS (18 exercices)
  ═══════════════════════════════════════ */
  {name:'Curl barre EZ',muscle:'bic',pattern:'curl',equipment:'barre',difficulty:'débutant',muscles_secondary:['ep'],tips:'Prise semi-pronée. Moins de stress sur les poignets que la barre droite.',alternatives:['Curl barre droite','Curl haltères alterné'],std_ratio:{bw60:0.35,bw75:0.45,bw90:0.58}},
  {name:'Curl barre droite',muscle:'bic',pattern:'curl',equipment:'barre',difficulty:'débutant',muscles_secondary:[],tips:'Prise supination. Coudes fixes. Contraction maximale en haut du mouvement.',alternatives:['Curl barre EZ','Curl haltères alterné'],std_ratio:{bw60:0.38,bw75:0.5,bw90:0.65}},
  {name:'Curl haltères alterné',muscle:'bic',pattern:'curl',equipment:'haltères',difficulty:'débutant',muscles_secondary:[],tips:'Supination du poignet pendant la montée. Alterner les bras ou simultané.',alternatives:['Curl barre EZ','Curl câble'],std_ratio:{bw60:0.18,bw75:0.24,bw90:0.32}},
  {name:'Curl incliné haltères',muscle:'bic',pattern:'curl',equipment:'haltères',difficulty:'intermédiaire',muscles_secondary:[],tips:'Assis sur banc incliné. Bras tendus en arrière = étirement maximal du biceps long.',alternatives:['Curl haltères alterné','Curl câble'],std_ratio:{bw60:0.14,bw75:0.2,bw90:0.27}},
  {name:'Curl câble',muscle:'bic',pattern:'curl',equipment:'câble',difficulty:'débutant',muscles_secondary:[],tips:'Tension constante tout le mouvement. Barre droite ou corde.',alternatives:['Curl barre EZ','Curl haltères alterné'],std_ratio:{bw60:0.3,bw75:0.4,bw90:0.52}},
  {name:'Spider curl',muscle:'bic',pattern:'curl',equipment:'haltères',difficulty:'intermédiaire',muscles_secondary:[],tips:'Allongé face contre un banc incliné. Élimine l\'élan. Isolation parfaite.',alternatives:['Curl Larry Scott','Curl préacher machine'],std_ratio:{bw60:0.16,bw75:0.22,bw90:0.3}},
  {name:'Curl Larry Scott (préacher)',muscle:'bic',pattern:'curl',equipment:'barre',difficulty:'intermédiaire',muscles_secondary:[],tips:'Bras posés sur le pad. Élimine complètement l\'élan. Étirement maximal en bas.',alternatives:['Spider curl','Curl machine'],std_ratio:{bw60:0.28,bw75:0.38,bw90:0.5}},
  {name:'Curl préacher machine',muscle:'bic',pattern:'curl',equipment:'machine',difficulty:'débutant',muscles_secondary:[],tips:'Amplitude complète. Pause en bas pour l\'étirement maximal.',alternatives:['Curl Larry Scott','Spider curl'],std_ratio:{bw60:0.3,bw75:0.4,bw90:0.52}},
  {name:'Curl inversé barre EZ',muscle:'bic',pattern:'curl',equipment:'barre',difficulty:'débutant',muscles_secondary:[],tips:'Prise pronation. Cible le brachial et le brachio-radial. Complémentaire au curl standard.',alternatives:['Curl inversé haltères','Curl marteau'],std_ratio:{bw60:0.22,bw75:0.3,bw90:0.4}},
  {name:'Curl marteau',muscle:'bic',pattern:'curl',equipment:'haltères',difficulty:'débutant',muscles_secondary:[],tips:'Prise neutre (pouce vers le haut). Cible le brachio-radial et le brachial.',alternatives:['Curl inversé barre EZ','Curl corde câble'],std_ratio:{bw60:0.2,bw75:0.28,bw90:0.38}},
  {name:'Curl marteau câble corde',muscle:'bic',pattern:'curl',equipment:'câble',difficulty:'débutant',muscles_secondary:[],tips:'Corde à la poulie basse. Prise neutre. Tension constante.',alternatives:['Curl marteau','Curl inversé barre EZ'],std_ratio:{bw60:0.18,bw75:0.25,bw90:0.33}},
  {name:'Curl concentration',muscle:'bic',pattern:'curl',equipment:'haltères',difficulty:'débutant',muscles_secondary:[],tips:'Assis, coude contre la cuisse. Isolation totale. Connexion muscle-cerveau maximale.',alternatives:['Spider curl','Curl préacher machine'],std_ratio:{bw60:0.14,bw75:0.2,bw90:0.27}},
  {name:'Curl unilatéral câble bas',muscle:'bic',pattern:'curl',equipment:'câble',difficulty:'débutant',muscles_secondary:[],tips:'Un bras, poulie basse. Permet une rotation du torse pour plus d\'amplitude.',alternatives:['Curl câble','Curl concentration'],std_ratio:{bw60:0.14,bw75:0.2,bw90:0.27}},
  {name:'Curl 21s',muscle:'bic',pattern:'curl',equipment:'barre',difficulty:'intermédiaire',muscles_secondary:[],tips:'7 reps bas → mi-chemin, 7 reps mi-chemin → haut, 7 reps complètes. Intensité maximale.',alternatives:['Curl barre droite','Curl câble'],std_ratio:{bw60:0.25,bw75:0.33,bw90:0.43}},
  {name:'Chin-up',muscle:'bic',pattern:'pull',equipment:'poids du corps',difficulty:'intermédiaire',muscles_secondary:['dos'],tips:'Prise supination, légèrement plus étroit que pull-up. Plus de biceps que les tractions.',alternatives:['Curl barre droite','Tirage vertical prise serrée'],std_ratio:{bw60:1,bw75:1,bw90:1}},
  {name:'Tirage prise supination',muscle:'bic',pattern:'pull',equipment:'câble',difficulty:'débutant',muscles_secondary:['dos'],tips:'Prise sous la barre. Plus de recrutement des biceps que la prise pronation.',alternatives:['Chin-up','Curl câble'],std_ratio:{bw60:0.65,bw75:0.85,bw90:1.05}},
  {name:'Curl isométrique',muscle:'bic',pattern:'curl',equipment:'haltères',difficulty:'débutant',muscles_secondary:[],tips:'Maintenir la position à 90° pendant 20-30 secondes. Excellent pour la densité musculaire.',alternatives:['Curl concentration','Spider curl'],std_ratio:{bw60:0.12,bw75:0.17,bw90:0.23}},
  {name:'Curl haltère assis sur banc incliné 60°',muscle:'bic',pattern:'curl',equipment:'haltères',difficulty:'intermédiaire',muscles_secondary:[],tips:'Inclinaison 60°. Étirement encore plus grand du biceps long que l\'incliné standard.',alternatives:['Curl incliné haltères','Spider curl'],std_ratio:{bw60:0.13,bw75:0.18,bw90:0.25}},

  /* ═══════════════════════════════════════
     TRICEPS (18 exercices)
  ═══════════════════════════════════════ */
  {name:'Pushdown corde',muscle:'tri',pattern:'push',equipment:'câble',difficulty:'débutant',muscles_secondary:[],tips:'Corde à la poulie haute. Écarter les mains en bas pour la contraction maximale.',alternatives:['Pushdown barre','Extension triceps machine'],std_ratio:{bw60:0.22,bw75:0.3,bw90:0.4}},
  {name:'Pushdown barre',muscle:'tri',pattern:'push',equipment:'câble',difficulty:'débutant',muscles_secondary:[],tips:'Barre droite ou V. Coudes fixes contre le corps. Verrouilller les coudes en bas.',alternatives:['Pushdown corde','Extension triceps machine'],std_ratio:{bw60:0.25,bw75:0.35,bw90:0.45}},
  {name:'Extension triceps couchée (skullcrusher)',muscle:'tri',pattern:'push',equipment:'barre',difficulty:'intermédiaire',muscles_secondary:[],tips:'Allongé sur banc. Descendre la barre vers le front. Coudes fixes pointant au plafond.',alternatives:['Extension haltère couché','Extension câble couché'],std_ratio:{bw60:0.35,bw75:0.45,bw90:0.58}},
  {name:'Extension triceps au-dessus tête',muscle:'tri',pattern:'push',equipment:'câble',difficulty:'intermédiaire',muscles_secondary:[],tips:'Long chef du triceps = meilleur étirement. Coudes fixes près des oreilles.',alternatives:['Extension couchée','Extension haltère'],std_ratio:{bw60:0.18,bw75:0.22,bw90:0.28}},
  {name:'Extension haltère au-dessus tête',muscle:'tri',pattern:'push',equipment:'haltères',difficulty:'débutant',muscles_secondary:[],tips:'Un haltère tenu à deux mains ou un haltère par main. Coudes fixes près des oreilles.',alternatives:['Extension triceps câble','Extension couchée'],std_ratio:{bw60:0.15,bw75:0.2,bw90:0.27}},
  {name:'Dips barre parallèles',muscle:'tri',pattern:'push',equipment:'poids du corps',difficulty:'intermédiaire',muscles_secondary:['pec','ep'],tips:'Corps droit = plus de triceps. Se pencher = plus de pectoraux. Descendre jusqu\'à 90°.',alternatives:['Pushdown corde','Dips assistés'],std_ratio:{bw60:1,bw75:1,bw90:1}},
  {name:'Dips assistés',muscle:'tri',pattern:'push',equipment:'machine',difficulty:'débutant',muscles_secondary:['pec','ep'],tips:'Machine à contrepoids. Idéal pour progresser vers les dips au poids du corps.',alternatives:['Dips barre parallèles','Pushdown corde'],std_ratio:{bw60:0.7,bw75:0.85,bw90:1}},
  {name:'Dips lestés',muscle:'tri',pattern:'push',equipment:'poids du corps',difficulty:'avancé',muscles_secondary:['pec','ep'],tips:'Ceinture lestée. Corps droit pour cibler les triceps. Technique parfaite requise.',alternatives:['Dips barre parallèles','Close grip bench'],std_ratio:{bw60:1.2,bw75:1.4,bw90:1.6}},
  {name:'Close grip bench press',muscle:'tri',pattern:'push',equipment:'barre',difficulty:'intermédiaire',muscles_secondary:['pec'],tips:'Prise serrée (largeur d\'épaule). Coudes proches du corps. Excellent pour la force des triceps.',alternatives:['Dips barre parallèles','Pushdown corde'],std_ratio:{bw60:0.65,bw75:0.85,bw90:1.05}},
  {name:'Diamond push-up',muscle:'tri',pattern:'push',equipment:'poids du corps',difficulty:'intermédiaire',muscles_secondary:['pec'],tips:'Mains en forme de losange sous la poitrine. Coudes le long du corps.',alternatives:['Close grip bench press','Pushdown corde'],std_ratio:{bw60:1,bw75:1,bw90:1}},
  {name:'Kickback triceps haltère',muscle:'tri',pattern:'push',equipment:'haltères',difficulty:'débutant',muscles_secondary:[],tips:'Penché en avant, bras parallèle au sol. Étendre le coude complètement en arrière.',alternatives:['Pushdown corde','Extension haltère'],std_ratio:{bw60:0.1,bw75:0.14,bw90:0.18}},
  {name:'Kickback triceps câble',muscle:'tri',pattern:'push',equipment:'câble',difficulty:'débutant',muscles_secondary:[],tips:'Poulie basse. Penché en avant. Tension constante contrairement aux haltères.',alternatives:['Kickback triceps haltère','Pushdown corde'],std_ratio:{bw60:0.1,bw75:0.14,bw90:0.18}},
  {name:'Extension triceps machine',muscle:'tri',pattern:'push',equipment:'machine',difficulty:'débutant',muscles_secondary:[],tips:'Idéal pour débutants ou finition. Amplitude contrôlée.',alternatives:['Pushdown corde','Pushdown barre'],std_ratio:{bw60:0.22,bw75:0.3,bw90:0.4}},
  {name:'JM press',muscle:'tri',pattern:'push',equipment:'barre',difficulty:'avancé',muscles_secondary:[],tips:'Hybride entre skullcrusher et close grip. Excellent pour la force.',alternatives:['Close grip bench press','Skullcrusher'],std_ratio:{bw60:0.5,bw75:0.65,bw90:0.82}},
  {name:'Tate press',muscle:'tri',pattern:'push',equipment:'haltères',difficulty:'intermédiaire',muscles_secondary:[],tips:'Haltères en position verticale. Descendre les coudes vers les côtés de la poitrine.',alternatives:['Skullcrusher','Extension haltère'],std_ratio:{bw60:0.15,bw75:0.2,bw90:0.27}},
  {name:'Overhead cable extension',muscle:'tri',pattern:'push',equipment:'câble',difficulty:'débutant',muscles_secondary:[],tips:'Dos à la poulie haute. Corde ou barre. Étirement maximal du long chef.',alternatives:['Extension haltère au-dessus tête','Extension machine'],std_ratio:{bw60:0.2,bw75:0.27,bw90:0.35}},
  {name:'Board press',muscle:'tri',pattern:'push',equipment:'barre',difficulty:'avancé',muscles_secondary:['pec'],tips:'Planche sur la poitrine pour limiter l\'amplitude. Force des triceps en fin de mouvement.',alternatives:['Close grip bench press','Floor press'],std_ratio:{bw60:0.75,bw75:0.95,bw90:1.2}},
  {name:'Skullcrusher haltères',muscle:'tri',pattern:'push',equipment:'haltères',difficulty:'intermédiaire',muscles_secondary:[],tips:'Même principe que la barre mais plus libre. Moins de stress sur les coudes.',alternatives:['Skullcrusher barre','Tate press'],std_ratio:{bw60:0.18,bw75:0.25,bw90:0.33}},

  /* ═══════════════════════════════════════
     JAMBES (35 exercices)
  ═══════════════════════════════════════ */
  {name:'Squat barre (arrière)',muscle:'jamp',pattern:'squat',equipment:'barre',difficulty:'intermédiaire',muscles_secondary:['bas'],tips:'Barre sur les trapèzes. Descendre jusqu\'à ce que les cuisses soient parallèles au sol minimum.',alternatives:['Squat goblet','Leg press','Squat front'],std_ratio:{bw60:1.0,bw75:1.4,bw90:1.8}},
  {name:'Squat avant (front squat)',muscle:'jamp',pattern:'squat',equipment:'barre',difficulty:'avancé',muscles_secondary:['bas','ep'],tips:'Barre sur les clavicules. Plus vertical = plus de quadriceps. Mobilité de cheville requise.',alternatives:['Squat barre','Hack squat machine','Goblet squat'],std_ratio:{bw60:0.75,bw75:1.05,bw90:1.35}},
  {name:'Hack squat machine',muscle:'jamp',pattern:'squat',equipment:'machine',difficulty:'débutant',muscles_secondary:[],tips:'Pieds hauts sur la plateforme = plus de fessiers. Pieds bas = plus de quadriceps.',alternatives:['Squat barre','Leg press','Presse à cuisses'],std_ratio:{bw60:1.0,bw75:1.4,bw90:1.8}},
  {name:'Presse à cuisses',muscle:'jamp',pattern:'squat',equipment:'machine',difficulty:'débutant',muscles_secondary:[],tips:'Pieds à la largeur des épaules. Ne pas verrouiller les genoux en haut.',alternatives:['Squat barre','Hack squat machine','Leg press'],std_ratio:{bw60:1.2,bw75:1.7,bw90:2.2}},
  {name:'Leg press',muscle:'jamp',pattern:'squat',equipment:'machine',difficulty:'débutant',muscles_secondary:[],tips:'Pieds haut pour les fessiers, bas pour les quadriceps. Amplitude maximale sans arrondir le bas du dos.',alternatives:['Presse à cuisses','Hack squat machine'],std_ratio:{bw60:1.2,bw75:1.7,bw90:2.2}},
  {name:'Goblet squat',muscle:'jamp',pattern:'squat',equipment:'haltères',difficulty:'débutant',muscles_secondary:['bas'],tips:'Haltère contre la poitrine. Excellent pour apprendre la technique du squat. Dos droit.',alternatives:['Squat barre','Leg press','Squat kettlebell'],std_ratio:{bw60:0.35,bw75:0.5,bw90:0.65}},
  {name:'Bulgarian split squat',muscle:'jamp',pattern:'lunge',equipment:'haltères',difficulty:'intermédiaire',muscles_secondary:['bas'],tips:'Pied arrière sur banc. Descendre le genou arrière vers le sol. Excellent pour les fessiers.',alternatives:['Fentes','Hip thrust','Romanian deadlift'],std_ratio:{bw60:0.25,bw75:0.35,bw90:0.48}},
  {name:'Fentes marchées',muscle:'jamp',pattern:'lunge',equipment:'haltères',difficulty:'débutant',muscles_secondary:['bas'],tips:'Enjamber en avant, genou arrière près du sol. Alterner les jambes.',alternatives:['Bulgarian split squat','Fentes statiques'],std_ratio:{bw60:0.2,bw75:0.28,bw90:0.38}},
  {name:'Fentes statiques',muscle:'jamp',pattern:'lunge',equipment:'haltères',difficulty:'débutant',muscles_secondary:['bas'],tips:'Position de départ fendu. Descendre et monter sur place. Plus stable que les fentes marchées.',alternatives:['Fentes marchées','Bulgarian split squat'],std_ratio:{bw60:0.2,bw75:0.28,bw90:0.38}},
  {name:'Fentes barre',muscle:'jamp',pattern:'lunge',equipment:'barre',difficulty:'intermédiaire',muscles_secondary:['bas'],tips:'Barre sur les épaules. Même technique que les fentes haltères mais plus lourdes.',alternatives:['Fentes marchées','Bulgarian split squat'],std_ratio:{bw60:0.6,bw75:0.85,bw90:1.1}},
  {name:'Hip thrust barre',muscle:'jamp',pattern:'hinge',equipment:'barre',difficulty:'intermédiaire',muscles_secondary:[],tips:'Épaules sur banc, barre sur les hanches. Extension complète des hanches en haut.',alternatives:['Hip thrust machine','Glute bridge','Kickback câble'],std_ratio:{bw60:0.85,bw75:1.2,bw90:1.55}},
  {name:'Hip thrust machine',muscle:'jamp',pattern:'hinge',equipment:'machine',difficulty:'débutant',muscles_secondary:[],tips:'Régler selon la morphologie. Contraction maximale des fessiers en extension.',alternatives:['Hip thrust barre','Glute bridge','Leg press'],std_ratio:{bw60:0.85,bw75:1.2,bw90:1.55}},
  {name:'Glute bridge',muscle:'jamp',pattern:'hinge',equipment:'poids du corps',difficulty:'débutant',muscles_secondary:[],tips:'Allongé, pieds à plat. Soulever les hanches. Version débutant du hip thrust.',alternatives:['Hip thrust barre','Hip thrust machine'],std_ratio:{bw60:1,bw75:1,bw90:1}},
  {name:'SDT roumain haltères',muscle:'jamp',pattern:'hinge',equipment:'haltères',difficulty:'débutant',muscles_secondary:['bas'],tips:'Dos droit, plier aux hanches. Descendre les haltères le long des jambes. Étirement des ischio.',alternatives:['SDT roumain barre','Nordic curl','Leg curl'],std_ratio:{bw60:0.3,bw75:0.42,bw90:0.55}},
  {name:'SDT roumain barre',muscle:'jamp',pattern:'hinge',equipment:'barre',difficulty:'intermédiaire',muscles_secondary:['bas'],tips:'Même que haltères mais plus de charge possible. Barre proche du corps.',alternatives:['SDT roumain haltères','Good morning'],std_ratio:{bw60:0.75,bw75:1.05,bw90:1.35}},
  {name:'Soulevé de terre conventionnel',muscle:'jamp',pattern:'hinge',equipment:'barre',difficulty:'intermédiaire',muscles_secondary:['dos','bas'],tips:'Prise en crochet ou pronation. Barre sur les tibias. Dos droit. Pousser le sol sous les pieds.',alternatives:['Trap bar deadlift','SDT roumain barre','Deadlift sumo'],std_ratio:{bw60:1.0,bw75:1.5,bw90:2.0}},
  {name:'Leg curl couché',muscle:'jamp',pattern:'curl',equipment:'machine',difficulty:'débutant',muscles_secondary:[],tips:'Isolation des ischio-jambiers. Amplitude complète. Pause en haut.',alternatives:['Leg curl assis','Nordic curl','SDT roumain'],std_ratio:{bw60:0.35,bw75:0.48,bw90:0.62}},
  {name:'Leg curl assis',muscle:'jamp',pattern:'curl',equipment:'machine',difficulty:'débutant',muscles_secondary:[],tips:'Position assise = plus d\'activation du biceps fémoral. Amplitude maximale.',alternatives:['Leg curl couché','Nordic curl'],std_ratio:{bw60:0.35,bw75:0.48,bw90:0.62}},
  {name:'Nordic curl',muscle:'jamp',pattern:'curl',equipment:'poids du corps',difficulty:'avancé',muscles_secondary:[],tips:'Genou au sol, partenaire ou machine. Descendre lentement en contrôlant. Très intense.',alternatives:['Leg curl couché','SDT roumain'],std_ratio:{bw60:1,bw75:1,bw90:1}},
  {name:'Leg extension',muscle:'jamp',pattern:'autre',equipment:'machine',difficulty:'débutant',muscles_secondary:[],tips:'Isolation des quadriceps. Ne pas bloquer les genoux en haut. Contrôler la descente.',alternatives:['Presse à cuisses','Hack squat','Squat barre'],std_ratio:{bw60:0.4,bw75:0.55,bw90:0.72}},
  {name:'Mollets assis (machine)',muscle:'jamp',pattern:'calf',equipment:'machine',difficulty:'débutant',muscles_secondary:[],tips:'Cible le soléaire. Amplitude maximale. Pause en bas pour l\'étirement.',alternatives:['Mollets debout','Mollets à la presse'],std_ratio:{bw60:0.5,bw75:0.7,bw90:0.9}},
  {name:'Mollets debout',muscle:'jamp',pattern:'calf',equipment:'machine',difficulty:'débutant',muscles_secondary:[],tips:'Cible le gastrocnémien. Une jambe ou deux. Amplitude maximale.',alternatives:['Mollets assis','Mollets à la presse'],std_ratio:{bw60:0.75,bw75:1.0,bw90:1.35}},
  {name:'Mollets à la presse',muscle:'jamp',pattern:'calf',equipment:'machine',difficulty:'débutant',muscles_secondary:[],tips:'Pieds en bout de la plateforme. Extension complète des chevilles.',alternatives:['Mollets debout','Mollets assis'],std_ratio:{bw60:1.0,bw75:1.4,bw90:1.8}},
  {name:'Mollets haltères debout',muscle:'jamp',pattern:'calf',equipment:'haltères',difficulty:'débutant',muscles_secondary:[],tips:'Un haltère dans chaque main ou un seul. Sur step pour plus d\'amplitude.',alternatives:['Mollets debout machine','Mollets assis'],std_ratio:{bw60:0.4,bw75:0.55,bw90:0.72}},
  {name:'Step-up',muscle:'jamp',pattern:'lunge',equipment:'haltères',difficulty:'débutant',muscles_secondary:['bas'],tips:'Marche ou banc. Pousser avec le talon. Excellent pour les fessiers et quadriceps.',alternatives:['Fentes','Bulgarian split squat'],std_ratio:{bw60:0.2,bw75:0.28,bw90:0.38}},
  {name:'Box jump',muscle:'jamp',pattern:'squat',equipment:'poids du corps',difficulty:'intermédiaire',muscles_secondary:[],tips:'Sauter sur une boîte. Atterrir silencieusement avec les genoux fléchis. Développe la puissance.',alternatives:['Squat sauté','Jump squat'],std_ratio:{bw60:1,bw75:1,bw90:1}},
  {name:'Squat sauté',muscle:'jamp',pattern:'squat',equipment:'poids du corps',difficulty:'intermédiaire',muscles_secondary:[],tips:'Squat puis saut explosif. Atterrir en douceur. Excellent pour la puissance musculaire.',alternatives:['Box jump','Leg press'],std_ratio:{bw60:1,bw75:1,bw90:1}},
  {name:'Sumo squat',muscle:'jamp',pattern:'squat',equipment:'haltères',difficulty:'débutant',muscles_secondary:[],tips:'Pieds très écartés, pointes en dehors. Haltère entre les jambes. Cible les adducteurs.',alternatives:['Plie squat','Goblet squat'],std_ratio:{bw60:0.35,bw75:0.5,bw90:0.65}},
  {name:'Pistol squat',muscle:'jamp',pattern:'squat',equipment:'poids du corps',difficulty:'avancé',muscles_secondary:['bas'],tips:'Squat sur une jambe. Bras en avant pour contrebalancer. Progression: squat assisté.',alternatives:['Bulgarian split squat','Step-up'],std_ratio:{bw60:1,bw75:1,bw90:1}},
  {name:'Kickback fessier câble',muscle:'jamp',pattern:'hinge',equipment:'câble',difficulty:'débutant',muscles_secondary:[],tips:'Poulie basse, cheville attachée. Extension de la hanche. Isolation des fessiers.',alternatives:['Hip thrust','Glute bridge'],std_ratio:{bw60:0.15,bw75:0.22,bw90:0.3}},
  {name:'Abduction hanche machine',muscle:'jamp',pattern:'autre',equipment:'machine',difficulty:'débutant',muscles_secondary:[],tips:'Cible les abducteurs et le moyen fessier. Indispensable pour équilibre musculaire.',alternatives:['Monster walk bande élastique'],std_ratio:{bw60:0.3,bw75:0.42,bw90:0.55}},
  {name:'Adduction hanche machine',muscle:'jamp',pattern:'autre',equipment:'machine',difficulty:'débutant',muscles_secondary:[],tips:'Cible les adducteurs. Complémentaire à l\'abduction.',alternatives:['Sumo squat'],std_ratio:{bw60:0.35,bw75:0.48,bw90:0.62}},
  {name:'Single leg RDL',muscle:'jamp',pattern:'hinge',equipment:'haltères',difficulty:'intermédiaire',muscles_secondary:['bas'],tips:'Soulevé de terre roumain sur une jambe. Excellent pour l\'équilibre et les ischio.',alternatives:['SDT roumain haltères','Nordic curl'],std_ratio:{bw60:0.15,bw75:0.22,bw90:0.3}},
  {name:'Leg press pied haut',muscle:'jamp',pattern:'squat',equipment:'machine',difficulty:'débutant',muscles_secondary:[],tips:'Pieds hauts sur la plateforme = activation maximale des fessiers et ischio.',alternatives:['Hip thrust barre','Presse à cuisses standard'],std_ratio:{bw60:1.2,bw75:1.7,bw90:2.2}},
  {name:'Cable pull-through',muscle:'jamp',pattern:'hinge',equipment:'câble',difficulty:'débutant',muscles_secondary:['bas'],tips:'Poulie basse entre les jambes. Extension des hanches. Excellent pour apprendre le mouvement de charnière.',alternatives:['Hip thrust','SDT roumain'],std_ratio:{bw60:0.35,bw75:0.5,bw90:0.65}},

  /* ═══════════════════════════════════════
     BAS DU DOS (12 exercices)
  ═══════════════════════════════════════ */
  {name:'Soulevé de terre (érecteurs)',muscle:'bas',pattern:'hinge',equipment:'barre',difficulty:'intermédiaire',muscles_secondary:['jamp','dos'],tips:'Dos droit, barre close du corps. Poussez le sol, ne tirez pas la barre.',alternatives:['Trap bar deadlift','Good morning','Rack pull'],std_ratio:{bw60:1.0,bw75:1.5,bw90:2.0}},
  {name:'Good morning',muscle:'bas',pattern:'hinge',equipment:'barre',difficulty:'intermédiaire',muscles_secondary:['jamp'],tips:'Barre sur les épaules. Flexion des hanches, dos droit. Ressent dans les érecteurs et ischio.',alternatives:['Soulevé de terre','Hyperextension'],std_ratio:{bw60:0.4,bw75:0.55,bw90:0.72}},
  {name:'Hyperextension',muscle:'bas',pattern:'hinge',equipment:'machine',difficulty:'débutant',muscles_secondary:['jamp'],tips:'Banc à 45°. Dos arrondi en bas, droit ou légèrement cambré en haut. Contrôle.',alternatives:['Good morning','Superman'],std_ratio:{bw60:0.4,bw75:0.55,bw90:0.72}},
  {name:'Hyperextension lestée',muscle:'bas',pattern:'hinge',equipment:'machine',difficulty:'intermédiaire',muscles_secondary:['jamp'],tips:'Tenir un disque contre la poitrine. Progression après maîtrise du mouvement non lest.',alternatives:['Good morning','Soulevé de terre'],std_ratio:{bw60:0.4,bw75:0.55,bw90:0.72}},
  {name:'Superman',muscle:'bas',pattern:'hinge',equipment:'poids du corps',difficulty:'débutant',muscles_secondary:[],tips:'Allongé face au sol. Lever bras et jambes simultanément. Isolation des érecteurs.',alternatives:['Hyperextension','Bird dog'],std_ratio:{bw60:1,bw75:1,bw90:1}},
  {name:'Bird dog',muscle:'bas',pattern:'autre',equipment:'poids du corps',difficulty:'débutant',muscles_secondary:['abd'],tips:'À 4 pattes. Étendre le bras et la jambe opposés. Gainage et stabilité lombaire.',alternatives:['Superman','Planche'],std_ratio:{bw60:1,bw75:1,bw90:1}},
  {name:'Rack pull (bas du dos)',muscle:'bas',pattern:'hinge',equipment:'barre',difficulty:'avancé',muscles_secondary:['dos','jamp'],tips:'SDT partiel à partir des genoux. Charges très lourdes. Focus sur le haut du dos et les trapèzes.',alternatives:['Soulevé de terre','Shrugs barre'],std_ratio:{bw60:1.3,bw75:1.7,bw90:2.2}},
  {name:'Jefferson curl',muscle:'bas',pattern:'hinge',equipment:'haltères',difficulty:'avancé',muscles_secondary:[],tips:'Flexion vertébrale contrôlée. Déconseillé aux personnes avec problèmes lombaires. Renforce l\'ensemble de la chaîne postérieure.',alternatives:['Good morning','Hyperextension'],std_ratio:{bw60:0.2,bw75:0.3,bw90:0.4}},
  {name:'Deadlift roumain barre',muscle:'bas',pattern:'hinge',equipment:'barre',difficulty:'intermédiaire',muscles_secondary:['jamp'],tips:'Jambes quasi tendues. Dos droit. Descendre jusqu\'à sentir l\'étirement des ischio.',alternatives:['Good morning','SDT conventionnel'],std_ratio:{bw60:0.75,bw75:1.05,bw90:1.35}},
  {name:'Back extension machine',muscle:'bas',pattern:'hinge',equipment:'machine',difficulty:'débutant',muscles_secondary:[],tips:'Machine guidée. Amplitude contrôlée. Idéal pour la rééducation ou les débutants.',alternatives:['Hyperextension','Superman'],std_ratio:{bw60:0.35,bw75:0.48,bw90:0.62}},
  {name:'Glute ham raise',muscle:'bas',pattern:'hinge',equipment:'machine',difficulty:'avancé',muscles_secondary:['jamp'],tips:'Extension de hanche + flexion du genou. Cible les érecteurs et les ischio simultanément.',alternatives:['Nordic curl','Hyperextension lestée'],std_ratio:{bw60:1,bw75:1,bw90:1}},
  {name:'Zercher squat',muscle:'bas',pattern:'squat',equipment:'barre',difficulty:'avancé',muscles_secondary:['jamp','abd'],tips:'Barre dans le creux des coudes. Très difficile techniquement. Fort recrutement du core.',alternatives:['Squat avant','Goblet squat'],std_ratio:{bw60:0.65,bw75:0.9,bw90:1.15}},

  /* ═══════════════════════════════════════
     ABDOMINAUX / CORE (18 exercices)
  ═══════════════════════════════════════ */
  {name:'Planche',muscle:'abd',pattern:'autre',equipment:'poids du corps',difficulty:'débutant',muscles_secondary:['bas','ep'],tips:'Corps droit comme une planche. Ne pas laisser les hanches tomber. Respiration normale.',alternatives:['Planche sur mains','Hollow hold'],std_ratio:{bw60:1,bw75:1,bw90:1}},
  {name:'Planche latérale',muscle:'abd',pattern:'autre',equipment:'poids du corps',difficulty:'débutant',muscles_secondary:[],tips:'Corps en ligne droite. Cible les obliques. Variante avec rotation de la hanche.',alternatives:['Obliques câble','Rotation russe'],std_ratio:{bw60:1,bw75:1,bw90:1}},
  {name:'Planche dynamique',muscle:'abd',pattern:'autre',equipment:'poids du corps',difficulty:'intermédiaire',muscles_secondary:['ep'],tips:'Alterner planche basse et haute. Stabilité totale, pas de rotation du bassin.',alternatives:['Planche','Pike push-up'],std_ratio:{bw60:1,bw75:1,bw90:1}},
  {name:'Crunch câble',muscle:'abd',pattern:'flexion',equipment:'câble',difficulty:'débutant',muscles_secondary:[],tips:'Poulie haute. Crunch en avant en arrondissant le dos. Contrôler la remontée.',alternatives:['Crunch au sol','Decline crunch'],std_ratio:{bw60:0.12,bw75:0.18,bw90:0.25}},
  {name:'Crunch au sol',muscle:'abd',pattern:'flexion',equipment:'poids du corps',difficulty:'débutant',muscles_secondary:[],tips:'Ne pas attraper la nuque. Soulever les omoplates, pas le dos entier. Expirer en montant.',alternatives:['Crunch câble','Sit-up'],std_ratio:{bw60:1,bw75:1,bw90:1}},
  {name:'Sit-up',muscle:'abd',pattern:'flexion',equipment:'poids du corps',difficulty:'débutant',muscles_secondary:['jamp'],tips:'Flexion complète du tronc. Plus de recrutement que le crunch mais aussi du psoas.',alternatives:['Crunch au sol','Decline sit-up'],std_ratio:{bw60:1,bw75:1,bw90:1}},
  {name:'Leg raise',muscle:'abd',pattern:'flexion',equipment:'poids du corps',difficulty:'intermédiaire',muscles_secondary:[],tips:'Suspendu à une barre ou allongé. Lever les jambes jusqu\'à 90°. Contrôler la descente.',alternatives:['Knee raise','Toes to bar'],std_ratio:{bw60:1,bw75:1,bw90:1}},
  {name:'Knee raise',muscle:'abd',pattern:'flexion',equipment:'poids du corps',difficulty:'débutant',muscles_secondary:[],tips:'Suspendu ou sur captain\'s chair. Ramener les genoux vers la poitrine. Version accessible.',alternatives:['Leg raise','Crunch câble'],std_ratio:{bw60:1,bw75:1,bw90:1}},
  {name:'Toes to bar',muscle:'abd',pattern:'flexion',equipment:'poids du corps',difficulty:'avancé',muscles_secondary:[],tips:'Suspendu à la barre. Lever les pieds jusqu\'à toucher la barre. Contrôle total.',alternatives:['Leg raise','Knee raise'],std_ratio:{bw60:1,bw75:1,bw90:1}},
  {name:'Ab wheel (roulette)',muscle:'abd',pattern:'autre',equipment:'autre',difficulty:'avancé',muscles_secondary:['bas','ep'],tips:'Partir en boule, rouler en avant en gardant le dos droit. Difficile mais très efficace.',alternatives:['Planche','Dragon flag'],std_ratio:{bw60:1,bw75:1,bw90:1}},
  {name:'Pallof press',muscle:'abd',pattern:'anti-rotation',equipment:'câble',difficulty:'intermédiaire',muscles_secondary:['ep'],tips:'Résister à la rotation. Pousser le câble devant soi et revenir. Core anti-rotation.',alternatives:['Planche latérale','Rotation russe'],std_ratio:{bw60:0.1,bw75:0.15,bw90:0.2}},
  {name:'Rotation russe',muscle:'abd',pattern:'rotation',equipment:'haltères',difficulty:'intermédiaire',muscles_secondary:[],tips:'Assis, pieds levés, se pencher en arrière. Rotation du tronc avec haltère ou médecine ball.',alternatives:['Pallof press','Obliques câble'],std_ratio:{bw60:0.1,bw75:0.15,bw90:0.2}},
  {name:'Obliques câble',muscle:'abd',pattern:'rotation',equipment:'câble',difficulty:'débutant',muscles_secondary:[],tips:'Poulie haute, debout de côté. Tirer vers le bas en fléchissant latéralement.',alternatives:['Rotation russe','Planche latérale'],std_ratio:{bw60:0.12,bw75:0.18,bw90:0.25}},
  {name:'Dragon flag',muscle:'abd',pattern:'flexion',equipment:'poids du corps',difficulty:'avancé',muscles_secondary:['jamp'],tips:'Allongé sur banc. Lever le corps entier en rigidité. Exercice de Bruce Lee. Très difficile.',alternatives:['Ab wheel','Toes to bar'],std_ratio:{bw60:1,bw75:1,bw90:1}},
  {name:'Hollow hold',muscle:'abd',pattern:'autre',equipment:'poids du corps',difficulty:'intermédiaire',muscles_secondary:[],tips:'Dos au sol, creuser le ventre, lever bras et jambes légèrement. Position de gymnaste.',alternatives:['Planche','Crunch câble'],std_ratio:{bw60:1,bw75:1,bw90:1}},
  {name:'Dead bug',muscle:'abd',pattern:'anti-extension',equipment:'poids du corps',difficulty:'débutant',muscles_secondary:['bas'],tips:'Dos au sol, bras et jambes en l\'air. Descendre bras et jambe opposés alternativement.',alternatives:['Bird dog','Hollow hold'],std_ratio:{bw60:1,bw75:1,bw90:1}},
  {name:'Mountain climber',muscle:'abd',pattern:'autre',equipment:'poids du corps',difficulty:'intermédiaire',muscles_secondary:['ep','jamp'],tips:'Position de planche. Ramener alternativement les genoux vers la poitrine rapidement.',alternatives:['Planche dynamique','Burpee'],std_ratio:{bw60:1,bw75:1,bw90:1}},
  {name:'Decline crunch',muscle:'abd',pattern:'flexion',equipment:'machine',difficulty:'intermédiaire',muscles_secondary:[],tips:'Banc décliné. Descendre lentement, remonter en contractant les abdos. Plus difficile que le crunch plat.',alternatives:['Crunch câble','Sit-up'],std_ratio:{bw60:1,bw75:1,bw90:1}},

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


/* ── Variables d'état global (accessibles dans tous les modules) ── */
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
