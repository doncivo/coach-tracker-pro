/* ================================================================
   data/programs.js — Programmes d'entraînement prédéfinis

   Chaque programme est un tableau de 7 jours (lun→dim)
   au même format que PA (programme actif).

   Structure d'un jour:
   { muscles: string[], cardio: {...}, warmup: string,
     exercises: [ mkEx(name, muscle, sets, reps) ] }

   Programmes disponibles:
   - PPL_A / PPL_B  : Push/Pull/Legs (alternance semaines A/B)
   - FULLBODY       : Full Body 3 jours/semaine
   - UPPERLOWER     : Upper/Lower 4 jours/semaine
   - ARNOLD         : Arnold Split (chest+back / shoulder+arms / legs)
   - BEGINNER       : Programme débutant 3 jours/semaine
================================================================ */

/* ─────────────────────────────────────────────
   PPL — Push Pull Legs (semaine A)
───────────────────────────────────────────── */
const PPL_A = [
  // Lundi — PUSH
  {
    muscles: ['pec','ep','tri'],
    cardio:  {type:'Vélo elliptique', duration:'5', speed:'', distance:''},
    warmup:  '5 min elliptique · Rotations épaules 2×15 · 2 séries légères développé',
    exercises: [
      mkEx('Développé couché barre','pec','4','5–8'),
      mkEx('Développé incliné haltères','pec','3','8–12'),
      mkEx('Écarté poulie haute','pec','3','12–15'),
      mkEx('Développé militaire barre','ep','4','6–10'),
      mkEx('Élévations latérales','ep','3','12–15'),
      mkEx('Dips lestés','tri','3','8–12'),
      mkEx('Extensions triceps poulie','tri','3','12–15'),
    ],
  },
  // Mardi — PULL
  {
    muscles: ['dos','bic'],
    cardio:  {type:'Rameur', duration:'5', speed:'', distance:''},
    warmup:  '5 min rameur · Face pull 2×15 · Band pull-apart 2×20',
    exercises: [
      mkEx('Tractions pronation','dos','4','5–8'),
      mkEx('Rowing barre Pendlay','dos','4','6–10'),
      mkEx('Tirage horizontal câble','dos','3','10–12'),
      mkEx('Tirage vertical serré','dos','3','10–12'),
      mkEx('Curl barre droite','bic','3','8–12'),
      mkEx('Curl marteau haltères','bic','3','10–15'),
    ],
  },
  // Mercredi — LEGS
  {
    muscles: ['jam','bas'],
    cardio:  {type:'Vélo', duration:'5', speed:'', distance:''},
    warmup:  '5 min vélo · Mobilité hanches 10×/côté · 2 séries légères squat',
    exercises: [
      mkEx('Squat barre','jam','4','5–8'),
      mkEx('Leg press','jam','3','10–12'),
      mkEx('Fentes marchées haltères','jam','3','10/jambe'),
      mkEx('Leg curl allongé','jam','3','10–12'),
      mkEx('Romanian deadlift','bas','3','8–12'),
      mkEx('Mollets debout','jam','4','15–20'),
    ],
  },
  // Jeudi — PUSH (B)
  {
    muscles: ['pec','ep','tri'],
    cardio:  {type:'Corde à sauter', duration:'5', speed:'', distance:''},
    warmup:  '5 min corde · Cercles épaules · 2 séries légères',
    exercises: [
      mkEx('Développé incliné barre','pec','4','6–10'),
      mkEx('Développé couché haltères','pec','3','8–12'),
      mkEx('Pompes lestées','pec','3','12–15'),
      mkEx('Développé militaire haltères','ep','3','8–12'),
      mkEx('Oiseau face à face','ep','3','12–15'),
      mkEx('Skull crusher','tri','3','10–12'),
      mkEx('Kick-back triceps','tri','3','12–15'),
    ],
  },
  // Vendredi — PULL (B)
  {
    muscles: ['dos','bic','bas'],
    cardio:  {type:'Rameur', duration:'5', speed:'', distance:''},
    warmup:  '5 min rameur · Rotations thoraciques · Band pull-apart',
    exercises: [
      mkEx('Soulevé de terre conventionnel','bas','4','4–6'),
      mkEx('Tractions supination','dos','3','6–10'),
      mkEx('Rowing haltère unilatéral','dos','3','10–12'),
      mkEx('Tirage poulie haute prise large','dos','3','10–12'),
      mkEx('Curl concentré','bic','3','10–12'),
      mkEx('Curl incliné haltères','bic','3','12–15'),
    ],
  },
  // Samedi — LEGS (B)
  {
    muscles: ['jam','bas'],
    cardio:  {type:'Marche rapide', duration:'10', speed:'', distance:''},
    warmup:  '10 min marche · Mobilité cheville et hanche · 2 séries légères',
    exercises: [
      mkEx('Squat avant barre','jam','4','6–10'),
      mkEx('Hack squat machine','jam','3','10–12'),
      mkEx('Leg extension','jam','3','12–15'),
      mkEx('Soulevé de terre jambes tendues','bas','4','8–12'),
      mkEx('Good morning','bas','3','10–12'),
      mkEx('Mollets assis','jam','4','15–20'),
    ],
  },
  // Dimanche — REPOS
  {
    muscles: ['rep'],
    cardio:  {type:'', duration:'', speed:'', distance:''},
    warmup:  '',
    exercises: [],
  },
];

/* ─────────────────────────────────────────────
   FULL BODY — 3 jours / semaine
───────────────────────────────────────────── */
const FULLBODY = [
  // Lundi — Full Body A
  {
    muscles: ['pec','dos','jam','ep'],
    cardio:  {type:'Rameur', duration:'5', speed:'', distance:''},
    warmup:  '5 min rameur · Mobilité globale · 2 séries légères par mouvement',
    exercises: [
      mkEx('Squat barre','jam','3','5'),
      mkEx('Développé couché barre','pec','3','5'),
      mkEx('Rowing barre','dos','3','5'),
      mkEx('Développé militaire barre','ep','3','8'),
      mkEx('Curl barre','bic','2','10'),
      mkEx('Extensions triceps','tri','2','10'),
      mkEx('Gainage planche','abd','3','45s'),
    ],
  },
  // Mardi — REPOS
  {
    muscles: ['rep'],
    cardio:  {type:'Marche', duration:'20', speed:'', distance:''},
    warmup:  '',
    exercises: [],
  },
  // Mercredi — Full Body B
  {
    muscles: ['pec','dos','jam'],
    cardio:  {type:'Vélo', duration:'5', speed:'', distance:''},
    warmup:  '5 min vélo · Activation fessiers · 2 séries légères',
    exercises: [
      mkEx('Soulevé de terre','bas','3','5'),
      mkEx('Développé incliné haltères','pec','3','8'),
      mkEx('Tractions assistées','dos','3','8'),
      mkEx('Fentes marchées','jam','3','10/jambe'),
      mkEx('Curl haltères','bic','2','12'),
      mkEx('Dips barre fixe','tri','2','10'),
      mkEx('Crunchs','abd','3','15'),
    ],
  },
  // Jeudi — REPOS
  {
    muscles: ['rep'],
    cardio:  {type:'', duration:'', speed:'', distance:''},
    warmup:  '',
    exercises: [],
  },
  // Vendredi — Full Body C
  {
    muscles: ['pec','dos','jam','abd'],
    cardio:  {type:'Corde à sauter', duration:'5', speed:'', distance:''},
    warmup:  '5 min corde · Mobilité hanche · 2 séries légères',
    exercises: [
      mkEx('Leg press','jam','3','10'),
      mkEx('Développé couché haltères','pec','3','10'),
      mkEx('Tirage horizontal câble','dos','3','10'),
      mkEx('Soulevé de terre roumain','bas','3','10'),
      mkEx('Développé militaire haltères','ep','2','12'),
      mkEx('Relevés de jambes suspendus','abd','3','15'),
    ],
  },
  // Samedi — Mobilité
  {
    muscles: ['mob'],
    cardio:  {type:'Marche', duration:'30', speed:'', distance:''},
    warmup:  '',
    exercises: [
      mkEx('Étirement hip flexor','mob','2','60s/côté',true),
      mkEx('Mobilité thoracique','mob','2','10',true),
      mkEx('Pigeon yoga','mob','2','60s/côté',true),
    ],
  },
  // Dimanche — REPOS
  {
    muscles: ['rep'],
    cardio:  {type:'', duration:'', speed:'', distance:''},
    warmup:  '',
    exercises: [],
  },
];

/* ─────────────────────────────────────────────
   UPPER / LOWER — 4 jours / semaine
───────────────────────────────────────────── */
const UPPERLOWER = [
  // Lundi — UPPER A (force)
  {
    muscles: ['pec','dos','ep'],
    cardio:  {type:'Rameur', duration:'5', speed:'', distance:''},
    warmup:  '5 min rameur · Face pull · 2 séries légères développé',
    exercises: [
      mkEx('Développé couché barre','pec','4','4–6'),
      mkEx('Rowing barre Pendlay','dos','4','4–6'),
      mkEx('Développé militaire barre','ep','3','6–8'),
      mkEx('Tractions lestées','dos','3','6–8'),
      mkEx('Dips lestés','tri','3','8–10'),
      mkEx('Curl barre droite','bic','3','8–10'),
    ],
  },
  // Mardi — LOWER A (force)
  {
    muscles: ['jam','bas'],
    cardio:  {type:'Vélo', duration:'5', speed:'', distance:''},
    warmup:  '5 min vélo · Mobilité hanche · 2 séries légères squat',
    exercises: [
      mkEx('Squat barre','jam','4','4–6'),
      mkEx('Romanian deadlift','bas','3','6–8'),
      mkEx('Leg press','jam','3','8–10'),
      mkEx('Leg curl allongé','jam','3','10–12'),
      mkEx('Mollets debout lestés','jam','4','12–15'),
    ],
  },
  // Mercredi — REPOS
  {
    muscles: ['rep'],
    cardio:  {type:'Marche', duration:'20', speed:'', distance:''},
    warmup:  '',
    exercises: [],
  },
  // Jeudi — UPPER B (hypertrophie)
  {
    muscles: ['pec','dos','ep','bic','tri'],
    cardio:  {type:'Elliptique', duration:'5', speed:'', distance:''},
    warmup:  '5 min elliptique · Band pull-apart · Rotations épaules',
    exercises: [
      mkEx('Développé incliné haltères','pec','3','10–12'),
      mkEx('Tirage poulie haute','dos','3','10–12'),
      mkEx('Élévations latérales','ep','4','12–15'),
      mkEx('Écarté poulie basse','pec','3','12–15'),
      mkEx('Rowing haltère 1 bras','dos','3','12–15'),
      mkEx('Curl incliné haltères','bic','3','12–15'),
      mkEx('Skull crusher','tri','3','10–12'),
    ],
  },
  // Vendredi — LOWER B (hypertrophie)
  {
    muscles: ['jam','bas','abd'],
    cardio:  {type:'Vélo', duration:'5', speed:'', distance:''},
    warmup:  '5 min vélo · Activation fessiers · Mobilité cheville',
    exercises: [
      mkEx('Soulevé de terre conventionnel','bas','4','5–8'),
      mkEx('Fentes bulgares haltères','jam','3','10/jambe'),
      mkEx('Leg extension','jam','3','12–15'),
      mkEx('Leg curl assis','jam','3','12–15'),
      mkEx('Hip thrust barre','jam','3','10–12'),
      mkEx('Relevés de jambes','abd','3','15–20'),
    ],
  },
  // Samedi — Mobilité / Cardio optionnel
  {
    muscles: ['mob','car'],
    cardio:  {type:'Marche rapide', duration:'30', speed:'', distance:''},
    warmup:  '',
    exercises: [
      mkEx('Foam rolling dos','mob','1','5min',true),
      mkEx('Étirements chaîne postérieure','mob','2','60s',true),
    ],
  },
  // Dimanche — REPOS
  {
    muscles: ['rep'],
    cardio:  {type:'', duration:'', speed:'', distance:''},
    warmup:  '',
    exercises: [],
  },
];

/* ─────────────────────────────────────────────
   DÉBUTANT — 3 jours / semaine (corps entier)
───────────────────────────────────────────── */
const BEGINNER = [
  // Lundi — Séance A
  {
    muscles: ['pec','dos','jam'],
    cardio:  {type:'Marche', duration:'10', speed:'', distance:''},
    warmup:  '10 min marche · Mobilité générale · 1 série légère par exercice',
    exercises: [
      mkEx('Squat gobelet','jam','3','10–12'),
      mkEx('Développé haltères banc plat','pec','3','10–12'),
      mkEx('Tirage horizontal câble','dos','3','10–12'),
      mkEx('Fentes statiques','jam','2','10/jambe'),
      mkEx('Pompes','pec','2','max'),
      mkEx('Planche','abd','3','30s'),
    ],
  },
  // Mardi — REPOS
  {muscles:['rep'],cardio:{type:'',duration:'',speed:'',distance:''},warmup:'',exercises:[]},
  // Mercredi — Séance B
  {
    muscles: ['jam','ep','dos'],
    cardio:  {type:'Vélo', duration:'10', speed:'', distance:''},
    warmup:  '10 min vélo doux · Cercles épaules · Activation fessiers',
    exercises: [
      mkEx('Romanian deadlift haltères','bas','3','10–12'),
      mkEx('Développé militaire haltères','ep','3','10–12'),
      mkEx('Tirage poulie haute','dos','3','12'),
      mkEx('Leg press machine','jam','3','12'),
      mkEx('Élévations latérales légères','ep','2','15'),
      mkEx('Crunchs','abd','3','15'),
    ],
  },
  // Jeudi — REPOS
  {muscles:['rep'],cardio:{type:'',duration:'',speed:'',distance:''},warmup:'',exercises:[]},
  // Vendredi — Séance C
  {
    muscles: ['pec','bic','tri','abd'],
    cardio:  {type:'Marche', duration:'10', speed:'', distance:''},
    warmup:  '10 min marche · Mobilité poignets et épaules',
    exercises: [
      mkEx('Développé incliné haltères','pec','3','10–12'),
      mkEx('Rowing haltère 1 bras','dos','3','10/côté'),
      mkEx('Curl haltères alternés','bic','3','12'),
      mkEx('Extensions triceps poulie','tri','3','12'),
      mkEx('Hip thrust au sol','jam','3','12'),
      mkEx('Relevés de jambes','abd','3','12'),
    ],
  },
  // Samedi — Marche / Repos actif
  {
    muscles: ['mob'],
    cardio:  {type:'Marche', duration:'30', speed:'', distance:''},
    warmup:  '',
    exercises: [],
  },
  // Dimanche — REPOS
  {muscles:['rep'],cardio:{type:'',duration:'',speed:'',distance:''},warmup:'',exercises:[]},
];

/* ─────────────────────────────────────────────
   CATALOGUE DES PROGRAMMES
   Utilisé par renderSettings pour la sélection
───────────────────────────────────────────── */
const PROGRAMS = [
  {
    id:          'ppl',
    label:       'Push / Pull / Legs',
    description: '6 séances/semaine · Force + hypertrophie · Intermédiaire/Avancé',
    daysPerWeek: 6,
    level:       'intermediaire',
    days:        PPL_A,
    icon:        '🏋️',
  },
  {
    id:          'fullbody',
    label:       'Full Body',
    description: '3 séances/semaine · Mouvements de base · Débutant/Intermédiaire',
    daysPerWeek: 3,
    level:       'debutant',
    days:        FULLBODY,
    icon:        '⚡',
  },
  {
    id:          'upperlower',
    label:       'Upper / Lower',
    description: '4 séances/semaine · Force + volume · Intermédiaire',
    daysPerWeek: 4,
    level:       'intermediaire',
    days:        UPPERLOWER,
    icon:        '💪',
  },
  {
    id:          'beginner',
    label:       'Programme Débutant',
    description: '3 séances/semaine · Haltères et machines · Débutant',
    daysPerWeek: 3,
    level:       'debutant',
    days:        BEGINNER,
    icon:        '🌱',
  },
];

/**
 * Charger un programme dans le planning actif
 * @param {string} programId — id du programme (ppl, fullbody, upperlower, beginner)
 */
function loadProgram(programId) {
  const prog = PROGRAMS.find(p => p.id === programId);
  if (!prog) {
    if (typeof showToast === 'function')
      showToast('Programme introuvable', 'error');
    return false;
  }

  // Confirmer si le planning a déjà des exercices
  const state    = Store.getState();
  const hasWork  = state.training.days.some(d =>
    d.exercises && d.exercises.some(e => e.name && !e.isWarmup)
  );

  if (hasWork) {
    if (!confirm(`Charger "${prog.label}" ? Le planning actuel sera remplacé.`))
      return false;
  }

  // Dispatcher chaque jour
  prog.days.forEach((day, i) => {
    Store.dispatch({
      type:    'TRAINING_UPDATE_DAY',
      payload: {
        dayIndex: i,
        changes:  {
          muscles:   [...(day.muscles || [])],
          cardio:    { ...(day.cardio  || {}) },
          warmup:    day.warmup || '',
          exercises: (day.exercises || []).map(ex => ({ ...ex })),
        }
      }
    });
  });

  if (typeof showToast === 'function')
    showToast(`✅ Programme "${prog.label}" chargé !`, 'save', 3500);

  return true;
}
