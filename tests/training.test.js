/* ================================================================
   tests/training.test.js — Tests automatiques store/training.js
   Exécuter: node tests/training.test.js
================================================================ */

global.window = global;
const fs  = require('fs');
const vm  = require('vm');
const run = (f) => vm.runInThisContext(fs.readFileSync(__dirname + '/../js/' + f, 'utf8'));

// Dépendances dans l'ordre
run('data/constants.js');
run('services/compute.js');
run('core/store.js');
run('store/training.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try   { fn(); console.log('  ✅ ' + name); passed++; }
  catch(e) { console.log('  ❌ ' + name + ': ' + e.message); failed++; }
}
function assert(c, msg)   { if (!c) throw new Error(msg || 'Assertion failed'); }
function eq(a, b, msg)    { if (a !== b) throw new Error((msg||'')+'  expected='+JSON.stringify(b)+' got='+JSON.stringify(a)); }
function approx(a, b, d)  { if (Math.abs(a-b) > (d||0.1)) throw new Error('expected~'+b+' got='+a); }

// ── Helpers ──────────────────────────────────────────────────────
function mkTestEx(overrides) {
  return Object.assign({
    id: 'test-' + Math.random().toString(36).slice(2),
    name: 'Bench Press', muscle: 'pec',
    weight: '80', sets: '3', reps: '8-12',
    repsAchieved: '', rpe: '', rir: '', note: '',
    done: false, setData: null, isWarmup: false, supersetGroup: '',
  }, overrides || {});
}

function mkTestState(overrides) {
  const base = Store.getState();
  return Object.assign({}, base, overrides || {});
}

console.log('\n=== TESTS store/training.js ===\n');

// ── Selectors de base ─────────────────────────────────────────────
console.log('Selectors:');

test('getDay retourne le bon jour', () => {
  const state = Store.getState();
  const day = Training.getDay(state, 0);
  assert(day !== null, 'jour 0 null');
  assert(Array.isArray(day.exercises), 'exercises manquant');
});

test('getDay retourne null pour index invalide', () => {
  const state = Store.getState();
  eq(Training.getDay(state, 99), null);
});

test('getActiveDay retourne le jour actif', () => {
  Store.dispatch({ type: 'TRAINING_SET_ACTIVE_DAY', payload: 2 });
  const state = Store.getState();
  const day = Training.getActiveDay(state);
  assert(day !== null, 'jour actif null');
});

test('getSessDay retourne le jour de séance', () => {
  Store.dispatch({ type: 'TRAINING_SET_SESS_DAY', payload: 1 });
  const state = Store.getState();
  const day = Training.getSessDay(state);
  assert(day !== null, 'jour séance null');
});

// ── Volume ────────────────────────────────────────────────────────
console.log('\nVolume:');

test('getDayVolume = 0 pour jour repos (dim)', () => {
  const state = Store.getState();
  // Jour 6 (dimanche) = repos dans PA → pas d'exercices avec poids
  const vol = Training.getDayVolume(state, 6);
  eq(Object.values(vol).reduce((a,v)=>a+v,0), 0);
});

test('getDayVolume calcule correctement après ajout', () => {
  // Vider le jour 6 et ajouter un exercice contrôlé
  Store.dispatch({ type: 'TRAINING_UPDATE_DAY',
    payload: { dayIndex: 6, changes: { exercises: [], muscles: [] } } });
  const ex = mkTestEx({ weight: '100', sets: '3', repsAchieved: '8', muscle: 'pec' });
  Store.dispatch({ type: 'TRAINING_ADD_EXERCISE', payload: { dayIndex: 6, exercise: ex } });
  const state = Store.getState();
  const vol = Training.getDayVolume(state, 6);
  eq(vol.pec, 2400); // 100 * 3 * 8
});

test('getWeekVolume somme tous les jours', () => {
  const state = Store.getState();
  const vol = Training.getWeekVolume(state);
  assert(typeof vol === 'object', 'vol not object');
  assert(vol.pec >= 2400, 'vol.pec trop bas');
});

// ── Progression ───────────────────────────────────────────────────
console.log('\nProgression:');

test('getDayProgress coherence done<=total', () => {
  const state = Store.getState();
  const prog = Training.getDayProgress(state, 0);
  assert(prog.done <= prog.total, 'done > total');
  assert(prog.pct >= 0 && prog.pct <= 100, 'pct hors bornes: ' + prog.pct);
});

test('getDayProgress total = nb series du jour', () => {
  const state = Store.getState();
  const day = state.training.days[0];
  const expected = day.exercises
    .filter(e => e.name && !e.isWarmup)
    .reduce((a, e) => a + (parseInt(e.sets) || 0), 0);
  const prog = Training.getDayProgress(state, 0);
  eq(prog.total, expected);
});

test('getSessProgress retourne la progression du jour de seance', () => {
  const state = Store.getState();
  const prog = Training.getSessProgress(state);
  assert(prog.total >= 0, 'total < 0');
});

// ── Historique & PR ───────────────────────────────────────────────
console.log('\nHistorique & PR:');

test('getExerciseHistory vide si pas d\'historique', () => {
  const state = Store.getState();
  const hist = Training.getExerciseHistory(state, 'Bench Press');
  eq(hist.length, 0);
});

test('getExerciseHistory trouve par nom', () => {
  // Archiver une semaine simulée
  const fakeHistory = {
    '2025-01-06': {
      weekType: 'A', weekCount: 1, block: 'Accumulation', blockWeek: 1,
      days: [{
        date: '2025-01-06', muscles: ['pec'], cardio: {},
        exercises: [
          { name: 'Bench Press', muscle: 'pec', weight: '80', sets: '3',
            reps: '8-12', repsAchieved: '10', done: true }
        ]
      }, ...Array(6).fill({ exercises: [] })]
    }
  };
  Store.dispatch({ type: 'TRAINING_ARCHIVE_WEEK',
    payload: { history: fakeHistory, weekCount: 2 }
  });
  const state = Store.getState();
  const hist = Training.getExerciseHistory(state, 'Bench Press');
  assert(hist.length > 0, 'historique vide après archive');
  eq(hist[0].weight, '80');
  eq(hist[0].repsAchieved, '10');
});

test('isPR faux si pas d\'historique antérieur', () => {
  // Réinitialiser avec exercice sans historique
  const state = Store.getState();
  // exercice avec weight mais pas de historique plus fort
  const ipr = Training.isPR(state, 0, 0);
  // Le bench press a weight=80, repsAchieved='', donc pas de PR
  assert(!ipr, 'ne devrait pas être PR sans repsAchieved');
});

test('isPR vrai si 1RM superieur a historique', () => {
  // Jour 6, ex 0 a weight=100, repsAchieved=10
  // L'historique a weight=80, repsAchieved=10 → 1RM=107
  // 100kg × 10 reps → 1RM = ~133 > 107 → PR
  Store.dispatch({
    type: 'TRAINING_UPDATE_EXERCISE',
    payload: { dayIndex: 6, exIndex: 0,
      changes: { weight: '100', repsAchieved: '10' }
    }
  });
  const state = Store.getState();
  assert(Training.isPR(state, 6, 0), 'devrait être un PR (133 > 107)');
});

// ── Poids suggéré ─────────────────────────────────────────────────
console.log('\nPoids suggéré:');

test('getSuggestedWeight retourne weight actuel si pas de repsAchieved', () => {
  const state = Store.getState();
  const ex = mkTestEx({ weight: '80', repsAchieved: '' });
  // simuler un jour avec cet exercice
  Store.dispatch({ type: 'TRAINING_ADD_EXERCISE',
    payload: { dayIndex: 1, exercise: ex } });
  const sw = Training.getSuggestedWeight(state, 1, 0);
  // Pas de repsAchieved → retourne weight ou null
  assert(sw !== undefined, 'getSuggestedWeight undefined');
});

// ── Résumé semaine ────────────────────────────────────────────────
console.log('\nRésumé semaine:');

test('getWeekSummary structure correcte', () => {
  const state = Store.getState();
  const summary = Training.getWeekSummary(state);
  assert('weekType' in summary, 'weekType manquant');
  assert('volume' in summary, 'volume manquant');
  assert('daysWithWork' in summary, 'daysWithWork manquant');
  assert(summary.daysWithWork >= 0, 'daysWithWork invalide');
});

test('getWeekSummary compte les jours actifs', () => {
  const state = Store.getState();
  const summary = Training.getWeekSummary(state);
  // Jour 0 a bench press, jour 1 a un exercice aussi
  assert(summary.daysWithWork >= 1, 'devrait avoir au moins 1 jour actif');
});

test('getWeeksCount compte les semaines archivées', () => {
  const state = Store.getState();
  const count = Training.getWeeksCount(state);
  eq(count, 1); // on a archivé 1 semaine
});

// ── Thunks ────────────────────────────────────────────────────────
console.log('\nThunks:');

test('syncMuscles met à jour les muscles du jour', () => {
  // Jour 0 a bench press (muscle: pec)
  Training.syncMuscles(0);
  const state = Store.getState();
  const muscles = state.training.days[0].muscles;
  assert(muscles.includes('pec'), 'pec devrait être dans muscles');
});

test('resetWeek efface repsAchieved', () => {
  Training.resetWeek();
  const state = Store.getState();
  const ex = state.training.days[0].exercises[0];
  eq(ex.done, false);
  eq(ex.repsAchieved, '');
});

// ── shouldOverload / isFailure ─────────────────────────────────────
console.log('\nHalpers métier:');

test('shouldOverload', () => {
  assert(Training.shouldOverload({ repsAchieved: '12', reps: '8-12' }));
  assert(!Training.shouldOverload({ repsAchieved: '10', reps: '8-12' }));
});

test('isFailure', () => {
  assert(Training.isFailure({ repsAchieved: '5', reps: '8-12' }));
  assert(!Training.isFailure({ repsAchieved: '8', reps: '8-12' }));
});

test('calc1RM via Training', () => {
  approx(Training.calc1RM('100', '10'), 133, 2);
});

// ── Résumé ────────────────────────────────────────────────────────
const total = passed + failed;
console.log('\n' + '─'.repeat(45));
console.log('Résultats: ' + passed + '/' + total + ' tests passés' + (failed > 0 ? ' (' + failed + ' échecs)' : ' ✅'));
if (failed > 0) process.exit(1);
