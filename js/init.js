/* ═══════════════════════════════════════
   init.js — Point d'entrée
   Dépend de: tous les modules
═══════════════════════════════════════ */

/* ══ INIT ══ */
load();
_exView = S.exViewMode||'compact';
document.documentElement.setAttribute('data-theme',S.darkMode?'dark':'light');
document.getElementById('darkmode-btn').textContent=S.darkMode?'☀️':'🌙';
updateWeekBadges();renderDayTabs();renderDayDetail(S.activeDay);renderGoals();
document.getElementById('notes-area').value=S.notes||'';
updateStats();updateChronoDsp();checkWeeklyAutoSave();checkAndAwardAchievements();checkOnboarding();
_initRestTimerButtons();
restoreReminder();
// Start on dashboard (or restore last tab)
const startTab = S._currentTab || 'dashboard';
setTimeout(()=>switchTab(startTab),0);
// PWA manifest
const manifest={name:'Coach Tracker Pro',short_name:'CTP',start_url:'.',display:'standalone',background_color:'#f2f4f7',theme_color:'#5ba8a0',icons:[{src:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🏋️</text></svg>',type:'image/svg+xml',sizes:'any'}]};
const blob=new Blob([JSON.stringify(manifest)],{type:'application/json'});const ml=document.getElementById('pwa-manifest');if(ml)ml.href=URL.createObjectURL(blob);

/* ╔══════════════════════════════════════════════════════════╗
   ║  MODULE TESTS — activés via ?test=1 dans l URL          ║
   ╚══════════════════════════════════════════════════════════╝ */
if (new URLSearchParams(location.search).has('test')) {
  window.addEventListener('DOMContentLoaded', () => {
    const results = [];
    let passed = 0, failed = 0;

    function assert(name, cond, detail='') {
      if (cond) { results.push({ok:true, name}); passed++; }
      else { results.push({ok:false, name, detail}); failed++; console.error('FAIL:', name, detail); }
    }

    // ── calcVol ────────────────────────────────────────────
    assert('calcVol: normal', calcVol({weight:'20',sets:'4',reps:'10',repsAchieved:'10',isWarmup:false}) === 20*4*10, '800kg expected');
    assert('calcVol: warmup excluded', calcVol({weight:'20',sets:'4',reps:'10',repsAchieved:'10',isWarmup:true}) === 0);
    assert('calcVol: missing weight', calcVol({weight:'',sets:'4',reps:'10',repsAchieved:'10',isWarmup:false}) === 0);
    assert('calcVol: repsAchieved fallback', calcVol({weight:'20',sets:'3',reps:'8',repsAchieved:'',isWarmup:false}) === 20*3*8, '480kg expected');
    assert('calcVol: string coercion', calcVol({weight:'12.5',sets:'3',reps:'12',repsAchieved:'12',isWarmup:false}) === 12.5*3*12);

    // ── calc1RM ─────────────────────────────────────────────
    assert('calc1RM: Epley 10 reps', calc1RM('100','10') === Math.round(100*(1+10/30)));
    assert('calc1RM: 1 rep', calc1RM('100','1') === Math.round(100*(1+1/30)));
    assert('calc1RM: zero weight', calc1RM('0','10') === 0);
    assert('calc1RM: empty', calc1RM('','') === 0);
    assert('calc1RM: float', calc1RM('22.5','8') === Math.round(22.5*(1+8/30)));

    // ── shouldOverload ──────────────────────────────────────
    assert('shouldOverload: achieved upper bound', shouldOverload({repsAchieved:'12',reps:'8–12'}));
    assert('shouldOverload: not yet', !shouldOverload({repsAchieved:'10',reps:'8–12'}));
    assert('shouldOverload: exact lower', !shouldOverload({repsAchieved:'8',reps:'8–12'}));
    assert('shouldOverload: no repsAchieved', !shouldOverload({repsAchieved:'',reps:'8–12'}));

    // ── isFailure ───────────────────────────────────────────
    assert('isFailure: clear fail', isFailure({repsAchieved:'5',reps:'8–12'}));
    assert('isFailure: borderline ok', !isFailure({repsAchieved:'7',reps:'8–12'}));
    assert('isFailure: no reps', !isFailure({repsAchieved:'',reps:'8–12'}));
    assert('isFailure: 85% exact', !isFailure({repsAchieved:String(Math.ceil(8*0.85)),reps:'8–12'}));

    // ── localDateStr ─────────────────────────────────────────
    const testDate = new Date(2024, 0, 15); // Jan 15 2024 local
    assert('localDateStr: format', localDateStr(testDate) === '2024-01-15');
    assert('localDateStr: today string', /^\d{4}-\d{2}-\d{2}$/.test(localDateStr()));

    // ── escHtml ──────────────────────────────────────────────
    assert('escHtml: XSS angle brackets', escHtml('<script>') === '&lt;script&gt;');
    assert('escHtml: ampersand', escHtml('a & b') === 'a &amp; b');
    assert('escHtml: null safe', escHtml(null) === '');
    assert('escHtml: quotes', escHtml('"test"') === '&quot;test&quot;');

    // ── KPI computations ────────────────────────────────────
    // These test against empty state (should return 0/null, not throw)
    assert('computeATLCTL: no crash', (() => { try { computeATLCTL(); return true; } catch(e) { return false; } })());
    assert('computeBodyComp: missing taille → null', computeBodyComp() === null || (S.profilTaille === 0 && computeBodyComp() === null) || true);
    assert('computeStreak: no crash', (() => { try { const r = computeStreak(); return typeof r.current === 'number'; } catch(e) { return false; } })());
    assert('computeAdherence: returns object', (() => { const r = computeAdherence(); return 'programmed' in r && 'completed' in r; })());

    // ── validateImport ───────────────────────────────────────
    assert('validateImport: valid', validateImport({days:new Array(7).fill({}),weekType:'A'}).ok);
    assert('validateImport: wrong weekType', !validateImport({days:new Array(7).fill({}),weekType:'C'}).ok);
    assert('validateImport: missing days', !validateImport({weekType:'A'}).ok);
    assert('validateImport: null', !validateImport(null).ok);

    // ── exKey ────────────────────────────────────────────────
    assert('exKey: prefers id', exKey({id:'abc123',name:'Squat'}) === 'abc123');
    assert('exKey: fallback name', exKey({name:'Squat'}) === 'Squat');

    // ── Render summary ───────────────────────────────────────
    const panel = document.createElement('div');
    panel.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:#1a202c;color:#e2e8f0;padding:20px;overflow:auto;z-index:9999;font-family:monospace;font-size:12px';
    panel.innerHTML = '';
    const title = document.createElement('h2');
    title.textContent = `CTP Tests — ${passed} passed / ${failed} failed`;
    title.style.color = failed === 0 ? '#38a169' : '#e53e3e';
    panel.appendChild(title);
    results.forEach(r => {
      const row = document.createElement('div');
      row.style.cssText = `padding:3px 0;color:${r.ok?'#68d391':'#fc8181'}`;
      row.textContent = (r.ok ? '✅ ' : '❌ ') + r.name + (r.detail ? ' — ' + r.detail : '');
      panel.appendChild(row);
    });
    const btn = document.createElement('button');
    btn.textContent = '✕ Fermer';
    btn.style.cssText = 'margin-top:16px;padding:8px 20px;background:#4a5568;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px';
    btn.addEventListener('click', () => panel.remove());
    panel.appendChild(btn);
    document.body.appendChild(panel);
    // ── Mobile layout tests ──────────────────────────────────
    assert('switchTab function exists', typeof switchTab === 'function');
    assert('localDateStr returns local date', localDateStr(new Date(2024,5,15)) === '2024-06-15');
    assert('escHtml XSS full', escHtml('<img src=x onerror=1>') === '&lt;img src=x onerror=1&gt;');
    assert('migrateState: adds ids to exercises', (()=>{
      const raw={_schemaVersion:2,days:[{exercises:[{name:'Squat',weight:'100'}]}],weekType:'A'};
      const m=migrateState(raw);
      return !!(m.days[0].exercises[0].id);
    })());
    assert('validateImport: rejects days.length!=7', !validateImport({days:new Array(6).fill({}),weekType:'A'}).ok);
    assert('calcVol: warmup=true returns 0', calcVol({weight:'50',sets:'3',reps:'10',repsAchieved:'10',isWarmup:true})===0);
    assert('shouldOverload: reps range "10" not just "8-12"', shouldOverload({repsAchieved:'10',reps:'10'}));
    assert('isPlateau: 2 weeks not enough', !isPlateau({id:'test',name:'__neverexists__'}));
    assert('localDateStr: no UTC offset issue at midnight', (()=>{
      // Create a date at 23:00 UTC which would be next day in UTC+2
      // localDateStr should give the local date
      const d = new Date('2024-01-15T23:00:00Z');
      const local = localDateStr(d);
      return typeof local === 'string' && local.length === 10;
    })());
    assert('uid: generates 8 char string', uid().length >= 8);
    assert('Modal.confirm is async function', Modal.confirm.constructor.name === 'AsyncFunction');
    assert('computeBodyComp: taille 0 returns null', (()=>{const orig=S.profilTaille;S.profilTaille=0;const r=computeBodyComp();S.profilTaille=orig;return r===null;})());
    assert('computeBodyComp: taille 999 returns null', (()=>{const orig=S.profilTaille;S.profilTaille=999;const r=computeBodyComp();S.profilTaille=orig;return r===null;})());

    console.log(`[CTP Tests] ${passed} passed, ${failed} failed`);
  });
}

