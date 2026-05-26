/* ================================================================
   tests/compute.test.js — Tests automatiques services/compute.js
   Exécuter: node tests/compute.test.js
================================================================ */

// Environnement browser minimal
global.Store = {
  getState: () => ({
    training: { days:[], history:{}, sessRecovery:{}, prs:{} },
    activity: { steps:{}, calories:{}, sleep:{}, nutrition:{},
                stepsGoal:10000, caloriesGoal:2500 },
    body:     { mesures:{ poids:[] }, profilTaille:175, painLog:[] },
    app:      { _gender:'m', _dob:'1990-01-01', _sleepGoal:8 }
  })
};

global.window = global;
const fs   = require('fs');
const vm   = require('vm');
const src  = fs.readFileSync(__dirname + '/../js/services/compute.js', 'utf8');
vm.runInThisContext(src);
// Compute est maintenant dans ce contexte

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('  ✅ ' + name); passed++; }
  catch(e) { console.log('  ❌ ' + name + ': ' + e.message); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function eq(a, b, msg) { if (a !== b) throw new Error((msg||'') + ' expected=' + b + ' got=' + a); }
function approx(a, b, d) { if (Math.abs(a-b) > (d||0.1)) throw new Error('expected~' + b + ' got=' + a); }

console.log('\n=== TESTS compute.js ===\n');

console.log('Dates:');
test('localDateStr YYYY-MM-DD', () => eq(Compute.localDateStr(new Date('2025-05-26T12:00:00')), '2025-05-26'));
test('lastNDays 7 elements', () => eq(Compute.lastNDays(7).length, 7));
test('lastNDays ordre croissant', () => { const d=Compute.lastNDays(3); assert(d[0]<d[1]&&d[1]<d[2]); });
test('daysBetween meme date = 0', () => eq(Compute.daysBetween('2025-01-01','2025-01-01'), 0));
test('daysBetween 7 jours', () => eq(Compute.daysBetween('2025-01-01','2025-01-08'), 7));

console.log('\nIdentifiants:');
test('uid 8 chars', () => eq(Compute.uid().length, 8));
test('uid unique sur 100', () => { const s=new Set(Array.from({length:100},()=>Compute.uid())); assert(s.size===100); });
test('exKey utilise id si present', () => eq(Compute.exKey({id:'abc123',name:'bench'}), 'abc123'));
test('exKey utilise name sinon', () => eq(Compute.exKey({name:'Bench Press'}), 'bench press'));

console.log('\nCalcul 1RM:');
test('calc1RM(100,1) = 100', () => eq(Compute.calc1RM(100,1), 100));
test('calc1RM(80,5) > 80', () => assert(Compute.calc1RM(80,5) > 80));
test('calc1RM(0,5) = 0', () => eq(Compute.calc1RM(0,5), 0));
test('calc1RM(80,0) = 0', () => eq(Compute.calc1RM(80,0), 0));
test('calc1RM formule Epley ~133', () => approx(Compute.calc1RM(100,10), 133, 2));

console.log('\nVolume:');
test('calcVol = poids x series x reps', () => eq(Compute.calcVol({weight:100,sets:3,repsAchieved:'8'}), 2400));
test('calcVol warmup = 0', () => eq(Compute.calcVol({weight:100,sets:3,reps:'8',isWarmup:true}), 0));
test('calcVol sans reps = 0', () => eq(Compute.calcVol({weight:100,sets:3}), 0));
test('dayVolume agregation muscle', () => {
  const v = Compute.dayVolume({exercises:[
    {weight:100,sets:3,repsAchieved:'8',muscle:'pec',isWarmup:false,name:'bench'},
    {weight:60, sets:4,repsAchieved:'10',muscle:'pec',isWarmup:false,name:'fly'},
  ]});
  eq(v.pec, 2400+2400);
});

console.log('\nProgression:');
test('shouldOverload: reps >= max', () => assert(Compute.shouldOverload({repsAchieved:'12',reps:'8-12'})));
test('shouldOverload: reps < max', () => assert(!Compute.shouldOverload({repsAchieved:'10',reps:'8-12'})));
test('shouldOverload: pas de reps', () => assert(!Compute.shouldOverload({reps:'8-12'})));
test('isFailure: reps < 85% min', () => assert(Compute.isFailure({repsAchieved:'5',reps:'8-12'})));
test('isFailure: reps OK', () => assert(!Compute.isFailure({repsAchieved:'8',reps:'8-12'})));
test('suggestedWeight overload > weight', () => {
  const w = parseFloat(Compute.suggestedWeight({weight:'100',repsAchieved:'12',reps:'8-12'}));
  assert(w > 100);
});
test('suggestedWeight failure < weight', () => {
  const w = parseFloat(Compute.suggestedWeight({weight:'100',repsAchieved:'5',reps:'8-12'}));
  assert(w < 100);
});
test('suggestedWeight plateau = weight', () => {
  const w = Compute.suggestedWeight({weight:'100',repsAchieved:'10',reps:'8-12'});
  eq(w, '100');
});

console.log('\nNutrition:');
test('calcBMI normal', () => approx(Compute.calcBMI(75,180), 23.1, 0.2));
test('calcBMI zero si poids=0', () => eq(Compute.calcBMI(0,180), 0));
test('calcBMI zero si taille=0', () => eq(Compute.calcBMI(75,0), 0));
test('bmiCategory poids normal', () => eq(Compute.bmiCategory(22).label, 'Poids normal'));
test('bmiCategory surpoids', () => eq(Compute.bmiCategory(27).label, 'Surpoids'));
test('bmiCategory insuffisance', () => eq(Compute.bmiCategory(17).label, 'Insuffisance pondérale'));
test('calcBMR homme > femme', () => {
  assert(Compute.calcBMR(70,175,30,'m') > Compute.calcBMR(70,175,30,'f'));
});
test('calcTDEE sedentaire mult=1.2', () => eq(Compute.calcTDEE(1700,0).mult, 1.2));
test('calcTDEE actif mult=1.55', () => eq(Compute.calcTDEE(1700,3).mult, 1.55));
test('calcMacros somme ~= calories', () => {
  const m = Compute.calcMacros(2000,'maint');
  const total = m.prot*4 + m.carbs*4 + m.fat*9;
  approx(total, 2000, 50);
});

console.log('\nScore fitness:');
test('fitnessScore dans [0,100]', () => {
  const {score} = Compute.fitnessScore({});
  assert(score >= 0 && score <= 100);
});
test('fitnessScore breakdown 5 items', () => eq(Compute.fitnessScore({}).breakdown.length, 5));
test('fitnessScore steps 100% = bon score', () => {
  const steps = {};
  Compute.lastNDays(7).forEach(d => steps[d] = 10000);
  const {score} = Compute.fitnessScore({steps, stepsGoal:10000});
  assert(score > 40);
});
test('scoreGrade excellent', () => eq(Compute.scoreGrade(95).label, 'Excellent'));
test('scoreGrade a ameliorer', () => eq(Compute.scoreGrade(30).label, 'À améliorer'));

console.log('\n' + '─'.repeat(45));
const total = passed + failed;
console.log('Résultats: ' + passed + '/' + total + ' tests passés' + (failed > 0 ? ' (' + failed + ' échecs)' : ' ✅'));
if (failed > 0) process.exit(1);