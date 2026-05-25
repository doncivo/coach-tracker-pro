/* ═══════════════════════════════════════
   state.js — État global + persistance
═══════════════════════════════════════ */

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
// Variables globales partagées entre modules
let _calDayOffset = 0;
let _exView = 'compact';
let _searchOpen = false;
let _swipeStartX = 0;
let _obStep = 0;
let _ci = null;

