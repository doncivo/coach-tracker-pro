#!/usr/bin/env node
/* run-tests.js — Lance tous les tests du projet */
const { execSync } = require('child_process');
const tests = [
  'tests/compute.test.js',
  'tests/training.test.js',
  'tests/persist.test.js',
];

let total_passed = 0, total_failed = 0;
tests.forEach(t => {
  try {
    const out = execSync('node ' + t, { encoding: 'utf8' });
    const last = out.trim().split('\n').filter(Boolean).pop();
    const m = last.match(/(\d+)\/(\d+)/);
    if (m) { total_passed += +m[1]; total_failed += +m[2] - +m[1]; }
    console.log('✅ ' + t + ': ' + last);
  } catch(e) {
    const last = (e.stdout||'').trim().split('\n').filter(Boolean).pop() || e.message;
    console.log('❌ ' + t + ': ' + last);
    total_failed++;
  }
});
console.log('\n' + '═'.repeat(50));
console.log('TOTAL: ' + total_passed + ' tests passés, ' + total_failed + ' échecs');
if (total_failed > 0) process.exit(1);
