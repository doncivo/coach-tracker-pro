/* ================================================================
   tests/persist.test.js — Tests services/persist.js
   Exécuter: node tests/persist.test.js
================================================================ */

global.window = global;
// Mock localStorage
global.localStorage = (() => {
  let store = {};
  return {
    getItem:    (k)    => store[k] || null,
    setItem:    (k, v) => { store[k] = String(v); },
    removeItem: (k)    => { delete store[k]; },
    clear:      ()     => { store = {}; },
  };
})();
global.showToast = () => {};
global.Errors = { error: ()=>{}, warn: ()=>{}, info: ()=>{} };

const fs  = require('fs');
const vm  = require('vm');
const run = (f) => vm.runInThisContext(fs.readFileSync(__dirname + '/../js/' + f, 'utf8'));

run('data/constants.js');
run('services/compute.js');
run('core/store.js');
run('store/training.js');
run('store/activity.js');
run('store/body.js');
run('store/goals.js');
run('store/app.js');
run('services/persist.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try   { fn(); console.log('  ✅ ' + name); passed++; }
  catch(e) { console.log('  ❌ ' + name + ': ' + e.message); failed++; }
}
function assert(c, msg) { if (!c) throw new Error(msg || 'Assertion failed'); }
function eq(a, b, msg)  { if (a !== b) throw new Error((msg||'')+' expected='+JSON.stringify(b)+' got='+JSON.stringify(a)); }

console.log('\n=== TESTS services/persist.js ===\n');

// ── migrateState ──────────────────────────────────────────────────
console.log('migrateState:');

test('migrateState retourne objet si null', () => {
  const result = Persist.migrateState(null);
  eq(result, null);
});

test('migrateState v1→v3: ajoute sleep', () => {
  const raw = { _schemaVersion: 1, days: [], history: {}, mesures: {} };
  const migrated = Persist.migrateState(raw);
  assert(typeof migrated.sleep === 'object', 'sleep manquant');
});

test('migrateState v1→v3: ajoute nutrition', () => {
  const raw = { _schemaVersion: 1, days: [], history: {}, mesures: {} };
  const migrated = Persist.migrateState(raw);
  assert(typeof migrated.nutrition === 'object', 'nutrition manquant');
});

test('migrateState v2→v3: ajoute steps', () => {
  const raw = { _schemaVersion: 2, days: [], history: {}, mesures: {},
                sleep: {}, nutrition: {} };
  const migrated = Persist.migrateState(raw);
  assert(typeof migrated.steps === 'object', 'steps manquant');
});

test('migrateState met _schemaVersion a jour', () => {
  const raw = { _schemaVersion: 1, days: [], history: {}, mesures: {} };
  const migrated = Persist.migrateState(raw);
  eq(migrated._schemaVersion, Persist.SCHEMA_VER);
});

test('migrateState garantit les mesures par defaut', () => {
  const raw = { _schemaVersion: 3, days: [], history: {}, mesures: {} };
  const migrated = Persist.migrateState(raw);
  assert(Array.isArray(migrated.mesures.poids), 'poids manquant');
  assert(Array.isArray(migrated.mesures.bras), 'bras manquant');
});

test('migrateState v2→v3: assigne ids aux exercices', () => {
  const raw = {
    _schemaVersion: 2,
    days: [{ exercises: [{ name: 'Bench', muscle: 'pec' }] }],
    history: {}, mesures: {}, sleep: {}, nutrition: {}
  };
  const migrated = Persist.migrateState(raw);
  assert(migrated.days[0].exercises[0].id, 'id manquant apres migration');
});

test('migrateState preserves les donnees existantes', () => {
  const raw = {
    _schemaVersion: 1,
    days: [], history: { '2025-01-01': { weekType: 'A' } },
    mesures: { poids: [{ value: 75, date: '2025-01-01' }] }
  };
  const migrated = Persist.migrateState(raw);
  assert(migrated.history['2025-01-01'], 'historique perdu');
  eq(migrated.mesures.poids[0].value, 75);
});

// ── save / load ───────────────────────────────────────────────────
console.log('\nSave / Load:');

test('save ecrit dans localStorage', (done) => {
  const state = Store.getState();
  Persist.save(state, { skipUndo: true });
  // Attendre le debounce (400ms) — on force flush
  Persist.save._flush && Persist.save._flush();
  // Vérifier après un court délai
  setTimeout(() => {
    const raw = localStorage.getItem(Persist.STORAGE_KEY);
    assert(raw !== null, 'rien dans localStorage apres save');
  }, 0);
});

test('STORAGE_KEY est defini', () => {
  assert(typeof Persist.STORAGE_KEY === 'string', 'STORAGE_KEY manquant');
  assert(Persist.STORAGE_KEY.length > 0, 'STORAGE_KEY vide');
});

test('SCHEMA_VER est un nombre', () => {
  assert(typeof Persist.SCHEMA_VER === 'number', 'SCHEMA_VER pas un nombre');
  assert(Persist.SCHEMA_VER >= 3, 'SCHEMA_VER trop bas');
});

test('load retourne null si localStorage vide', () => {
  localStorage.clear();
  const result = Persist.load();
  eq(result, null);
});

test('load apres save restaure les donnees', () => {
  // Modifier le state
  Store.dispatch({ type: 'TRAINING_SET_WEEK_TYPE', payload: 'B' });
  const state = Store.getState();

  // Simuler save synchrone (bypass debounce)
  const flat = Object.assign({},
    state.training, state.activity, state.body, state.goals, state.app
  );
  localStorage.setItem(Persist.STORAGE_KEY, JSON.stringify(flat));

  // Load
  const loaded = Persist.load();
  assert(loaded !== null, 'load retourne null apres save');
  eq(loaded.weekType, 'B');
});

test('load applique migrateState', () => {
  // Stocker des données v1 dans localStorage
  const v1data = {
    _schemaVersion: 1,
    days: [], history: {}, mesures: { poids: [] },
    weekType: 'A', weekCount: 1
  };
  localStorage.setItem(Persist.STORAGE_KEY, JSON.stringify(v1data));
  const loaded = Persist.load();
  assert(loaded !== null, 'load null');
  assert(typeof loaded.sleep === 'object', 'migration v1→v3 non appliquee');
});

// ── exportCSV ─────────────────────────────────────────────────────
console.log('\nexportCSV:');

test('exportCSV est une fonction', () => {
  assert(typeof Persist.exportCSV === 'function');
});

// ── Résumé ────────────────────────────────────────────────────────
const total = passed + failed;
console.log('\n' + '─'.repeat(45));
console.log('Résultats: ' + passed + '/' + total + ' tests passés' + (failed > 0 ? ' (' + failed + ' échecs)' : ' ✅'));
if (failed > 0) process.exit(1);
