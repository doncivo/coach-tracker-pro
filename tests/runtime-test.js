/**
 * CTP Runtime Test Suite — 3 niveaux de protection
 *
 * Niveau 1 : Analyse statique — variables utilisées avant définition
 * Niveau 2 : Exécution simulée — render functions dans un mock DOM
 * Niveau 3 : Tests fonctionnels — logique métier et store
 *
 * Usage: node tests/runtime-test.js
 */
'use strict';
const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const ROOT = path.join(__dirname, '..');
let pass=0, fail=0, warn=0;

function ok(name, cond, msg)  { if(cond){console.log('  ✅ '+name);pass++;}else{console.log('  ❌ '+name+(msg?' — '+msg.slice(0,120):''));fail++;} }
function wn(name, msg)        { console.log('  ⚠️  '+name+(msg?' — '+msg:''));warn++; }
function section(name)        { console.log('\n── '+name+' ──'); }

// ══════════════════════════════════════════════════════════════
// NIVEAU 1 : ANALYSE STATIQUE
// Détecte les variables utilisées avant leur déclaration
// (ex: le bug doneExs dans renderDashboard)
// ══════════════════════════════════════════════════════════════
section('Analyse statique (use-before-define)');

// Variables courantes dans closures imbriquées — pas de faux positifs
const SKIP_VARS = new Set([
  'row','col','el','btn','inp','val','key','i','j','k','n','m','x','y','w','h',
  'title','name','bar','fill','card','wrap','overlay','hint','ctx','diff',
  'bmi','calc','cat','tab','sec','fn','cb','err','e','t','d','b','v','s',
  'prev','next','cur','idx','ref','box','tag','txt','str','num','arr','obj',
  'item','node','elem','list','data','info','link','icon','text',
  'target','current','start','end','result','output','total','count','index','offset','range',
  'done','pct','barWrap','barFill','progress','percent','label','entry','line','prev','next',
]);

function checkVarsBeforeUse(filepath) {
  const src = fs.readFileSync(filepath, 'utf8');
  const errors = [];

  // Trouve les fonctions top-level et vérifie l'ordre déclaration/usage
  const fnRegex = /^(?:async\s+)?function\s+(\w+)\s*\(/gm;
  let match;
  const functions = [];
  while ((match = fnRegex.exec(src)) !== null) {
    functions.push({ name: match[1], start: match.index });
  }

  functions.forEach((fn, fi) => {
    const end  = fi + 1 < functions.length ? functions[fi+1].start : src.length;
    const body = src.slice(fn.start, end);

    // Enlever les strings et commentaires pour éviter faux positifs
    const clean = body
      .replace(/\/\/[^\n]*/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/'[^']*'/g, "''")
      .replace(/"[^"]*"/g, '""')
      .replace(/`[^`]*`/g, '``');

    // Trouver toutes les déclarations const/let dans le corps direct (pas dans closures)
    // On ignore les déclarations à l'intérieur de function(){} ou =>{}
    let depth = 0;
    let pos   = 0;
    const declarations = [];
    const declRe = /\b(?:const|let)\s+(\w+)/g;
    let dm;

    // Simple: trouver toutes les déclarations
    while ((dm = declRe.exec(clean)) !== null) {
      // Calculer la profondeur à cet endroit
      const before = clean.slice(0, dm.index);
      const opens  = (before.match(/\{/g)||[]).length;
      const closes = (before.match(/\}/g)||[]).length;
      const d = opens - closes;
      // Déclarations au niveau 0 ou 1 seulement (corps de fonction)
      if (d <= 2) {
        declarations.push({ name: dm[1], pos: dm.index, depth: d });
      }
    }

    // Pour chaque déclaration, vérifier si le nom est utilisé avant
    declarations.forEach(decl => {
      if (SKIP_VARS.has(decl.name) || decl.name.startsWith('_') || decl.name.length <= 1) return;
      const beforeDecl = clean.slice(0, decl.pos);
      // Y a-t-il une closure/arrow fn avant ? Si oui, les usages dedans sont OK
      const hasArrow   = /=>\s*\{/.test(beforeDecl);
      const hasFnDecl  = /function\s*\(/.test(beforeDecl);
      if (hasArrow || hasFnDecl) return; // usage dans closure = faux positif probable
      // Usage simple avant déclaration
      // Exclure les accès de propriété (ex: S.mesures.poids) et les clés d'objet
      const propRe = new RegExp(`\.${decl.name}\\b|['"]${decl.name}['"]\\s*:`);
      const cleanBefore = beforeDecl.replace(propRe, '');
      if (new RegExp(`\\b${decl.name}\\b`).test(cleanBefore)) {
        errors.push(`${fn.name}(): '${decl.name}' utilisé avant déclaration (pos ${decl.pos})`);
      }
    });
  });

  return errors;
}

const filesToCheck = [
  'js/render_dashboard.js','js/render_session.js','js/render_planning.js',
  'js/render_corps.js','js/render_bilan.js','js/render_other.js',
];

filesToCheck.forEach(f => {
  const fpath = path.join(ROOT, f);
  if (!fs.existsSync(fpath)) { wn(f, 'fichier manquant'); return; }
  const errors = checkVarsBeforeUse(fpath);
  if (errors.length === 0) {
    ok(f, true);
  } else {
    errors.slice(0, 3).forEach(e => ok(`${path.basename(f)}: ${e}`, false));
  }
});

// ══════════════════════════════════════════════════════════════
// NIVEAU 2 : EXÉCUTION SIMULÉE
// Charge toute l'app en une passe → partage scope des const
// → exécute chaque render function et capture les crashes
// ══════════════════════════════════════════════════════════════
section('Exécution simulée (Mock DOM)');

// Mock DOM minimal mais complet
function mkEl(tag) {
  const el = {
    tagName:(tag||'div').toUpperCase(), _children:[], _listeners:{},
    style:new Proxy({},{set(t,k,v){t[k]=v;return true;},get(t,k){return t[k]||'';}}),
    classList:{_s:new Set(),add(...c){c.forEach(x=>this._s.add(x));},remove(...c){c.forEach(x=>this._s.delete(x));},
      toggle(c,f){f!=null?(f?this.add(c):this.remove(c)):(this._s.has(c)?this.remove(c):this.add(c));},contains(c){return this._s.has(c);}},
    innerHTML:'',textContent:'',innerText:'',id:'',className:'',value:'',type:'',
    checked:false,name:'',href:'',src:'',dataset:{},inputMode:'',placeholder:'',
    min:'',max:'',step:'',autocomplete:'',autocorrect:'',spellcheck:false,
    getAttribute(k){return this[k]!=null?String(this[k]):null;},
    setAttribute(k,v){this[k]=v;},removeAttribute(k){delete this[k];},
    appendChild(c){if(c&&typeof c==='object'){this._children.push(c);if(c&&typeof c==='object')c.parentElement=el;}return c||el;},
    prepend(c){if(c&&typeof c==='object')this._children.unshift(c);return c||el;},
    removeChild(c){this._children=this._children.filter(x=>x!==c);return c;},
    insertBefore(n,r){this._children.unshift(n);return n;},
    replaceChild(n,o){const i=this._children.indexOf(o);if(i>=0)this._children[i]=n;return o;},
    querySelector(s){return this._children.find(c=>typeof c==='object')||null;},
    querySelectorAll(s){return this._children.filter(c=>typeof c==='object');},
    closest(s){return null;},matches(s){return false;},contains(){return false;},
    addEventListener(ev,fn,o){if(!this._listeners[ev])this._listeners[ev]=[];this._listeners[ev].push(fn);},
    removeEventListener(){},dispatchEvent(){return true;},
    getBoundingClientRect(){return{top:0,left:0,right:100,bottom:100,width:100,height:100,x:0,y:0};},
    scrollIntoView(){},focus(){},blur(){},click(){},cloneNode(){return mkEl(tag);},
    parentElement:null,parentNode:null,children:[],childNodes:[],firstChild:null,lastChild:null,nextSibling:null,
    offsetWidth:300,offsetHeight:400,scrollWidth:300,clientWidth:300,scrollHeight:800,clientHeight:400,
    ontouchstart:null,onclick:null,onchange:null,oninput:null,onkeydown:null,onkeyup:null,
    select(){},scrollTo(){},
    remove(){ if(this.parentElement&&this.parentElement._children) this.parentElement._children=this.parentElement._children.filter(c=>c!==this); },
    insertAdjacentHTML(pos,html){},
    cloneNode(deep){ return mkEl(this._tag); },
  };
  return el;
}

const DOM_IDS = {};
[
  // Dashboard
  'dash-wrap','week-type-badge','week-counter-badge','hdr-fitness-score','darkmode-btn',
  'dash-vol-chart','dash-ppl-chart','alerts-panel','notes-area',
  // Planning
  'day-tabs','day-detail','day-stats-panel','goals-container',
  // Session
  'sess-main','sess-nav','sess-nav-strip','sess-prog-bar','sess-prog-ex','sess-duration',
  'sess-vol-live','sess-1rm-live','sess-day-sel','sess-focus-btn','focus-overlay','focus-chrono-time',
  // Timer
  'rest-timer-overlay','rest-timer-card','rest-timer-time','rest-timer-ex-name',
  'rest-ring-fill','rest-timer-skip','rest-timer-next','rest-timer-add-btn',
  // Corps
  'steps-grid','steps-summary','steps-goal-inp',
  // Bilan
  'bilan-wrap','bilan-prev','bilan-next','export-pdf-btn',
  // Progression
  'prog-cards','prog-muscle-filter','prog-weeks-filter','prog-charts-section',
  // Other
  'lib-search','lib-filter-muscle','lib-filter-pattern','lib-filter-equip','lib-filter-diff',
  'ob-bmi-val','ob-bmi-cat','ob-bmi-box','barcode-overlay','barcode-video','barcode-status',
  'search-global-overlay','search-global-inp','search-global-results',
  'pwa-manifest','focus-btn','search-btn','toggle-week-btn','archive-week-btn','block-btn',
  'export-btn','import-btn','import-file','prog-strength-chart','quick-log-overlay',
].forEach(id => { DOM_IDS[id] = mkEl(); DOM_IDS[id].id = id; });

const mockDoc = {
  createElement(tag){return mkEl(tag);},
  createTextNode(t){return {textContent:t,nodeType:3,parentElement:null};},
  createDocumentFragment(){return mkEl('fragment');},
  getElementById(id){ if(!DOM_IDS[id]){DOM_IDS[id]=mkEl();DOM_IDS[id].id=id;} return DOM_IDS[id]; },
  querySelector(s){return null;},
  querySelectorAll(s){return[];},
  body:Object.assign(mkEl('body'),{
    prepend(c){if(c&&typeof c==='object')this._children.unshift(c);},
    appendChild(c){if(c&&typeof c==='object')this._children.push(c);return c;},
    style:{},
  }),
  documentElement:Object.assign(mkEl('html'),{
    getAttribute(k){return this[k]||null;},setAttribute(k,v){this[k]=v;},style:{},
  }),
  addEventListener(ev,fn,o){},removeEventListener(){},
  visibilityState:'visible',hidden:false,
};

const ctx = vm.createContext({
  document: mockDoc,
  console,
  Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Symbol,
  parseInt, parseFloat, isNaN, isFinite, encodeURIComponent, decodeURIComponent,
  Promise, Error, TypeError, RangeError, SyntaxError, ReferenceError,
  Map, Set, WeakMap, WeakSet, Proxy, Reflect, Uint8Array, ArrayBuffer,
  setTimeout:(fn,ms)=>{ try{fn();}catch(e){} }, clearTimeout:()=>{},
  setInterval:(fn,ms)=>0, clearInterval:()=>{},
  requestAnimationFrame:(fn)=>{try{fn(0);}catch(e){} }, cancelAnimationFrame:()=>{},
  URL:{createObjectURL:()=>'blob:x',revokeObjectURL:()=>{}},
  Blob:class Blob{constructor(p,t){}},
  FileReader:class FileReader{readAsDataURL(){} readAsText(){} readAsArrayBuffer(){}},
  AudioContext:class AC{
    createOscillator(){return{connect:()=>{},frequency:{value:440},type:'sine',start:()=>{},stop:()=>{}}}
    createGain(){return{connect:()=>{},gain:{setValueAtTime:()=>{},exponentialRampToValueAtTime:()=>{}},destination:{}}}
    get destination(){return{}}
    get currentTime(){return 0}
  },
  webkitAudioContext:class WAC{
    createOscillator(){return{connect:()=>{},frequency:{value:440},type:'sine',start:()=>{},stop:()=>{}}}
    createGain(){return{connect:()=>{},gain:{setValueAtTime:()=>{},exponentialRampToValueAtTime:()=>{}},destination:{}}}
    get destination(){return{}}
    get currentTime(){return 0}
  },
  Notification:{permission:'denied',requestPermission:async()=>'denied'},
  MutationObserver:class{observe(){}disconnect(){}},
  ResizeObserver:class{observe(){}disconnect(){}},
  IntersectionObserver:class{observe(){}disconnect(){}},
  navigator:{onLine:true,share:null,clipboard:null,mediaDevices:null,
    serviceWorker:{register:async()=>({waiting:null,installing:null,active:null,addEventListener:()=>{},scope:''}),
      getRegistrations:async()=>[]}},
  location:{href:'https://test.local/',pathname:'/',search:'',hash:''},
  history:{pushState:()=>{},replaceState:()=>{},back:()=>{}},
  localStorage:{_d:{},getItem(k){return this._d[k]||null;},setItem(k,v){this._d[k]=String(v);},
    removeItem(k){delete this._d[k];},clear(){this._d={};}},
  sessionStorage:{_d:{},getItem(k){return this._d[k]||null;},setItem(k,v){this._d[k]=String(v);},removeItem(k){delete this._d[k];}},
  caches:{keys:async()=>[],open:async()=>({match:async()=>null,put:async()=>{},addAll:async()=>{}})},
  performance:{now:Date.now},
  screen:{width:390,height:844},
  innerWidth:390, innerHeight:844, devicePixelRatio:2,
  matchMedia:()=>({matches:false,addListener:()=>{},removeListener:()=>{},addEventListener:()=>{},dispatchEvent:()=>{}}),
  getComputedStyle:()=>({getPropertyValue:()=>'',touchAction:'manipulation',webkitAppearance:'none',
    position:'static',zIndex:'auto',overflowX:'visible',overflowY:'visible',display:'block'}),
  fetch:async()=>({ok:false,json:async()=>({}),text:async()=>''}),
  BarcodeDetector:undefined,
  HTMLElement:class HTMLElement{},
  HTMLDivElement:class HTMLDivElement{},
  HTMLInputElement:class HTMLInputElement{},
  HTMLButtonElement:class HTMLButtonElement{},
  SVGElement:class SVGElement{},
  Event:class Event{constructor(t,o){this.type=t;this.bubbles=(o||{}).bubbles||false;}},
  CustomEvent:class CustomEvent{constructor(t,o){this.type=t;this.detail=(o||{}).detail;}},
  AbortError:class AbortError extends Error{constructor(){super('AbortError');this.name='AbortError';}},
  DOMParser:class DOMParser{parseFromString(s,t){return{querySelector:()=>null,querySelectorAll:()=>[]};} },
  XMLHttpRequest:class XMLHttpRequest{open(){} send(){} setRequestHeader(){}},
  FormData:class FormData{append(){} get(){return null;} has(){return false;}},
  atob:(s)=>Buffer.from(s,'base64').toString(),
  btoa:(s)=>Buffer.from(s).toString('base64'),
  addEventListener:(ev,fn,o)=>{},
  removeEventListener:(ev,fn)=>{},
  dispatchEvent:()=>true,
  // Implicit globals from constants.js / render files
  _cs: 0, _ct: 0, _cr: false, _ci: null,
  // Alias: some scripts use these as global functions
  _addEventListener:(ev,fn,o)=>{},
  _removeEventListener:(ev,fn)=>{},
});
ctx.window = ctx;

// Charger TOUS les scripts en une passe (partage le scope des const)
const html    = fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]);

// Concaténer tous les scripts + capture des globals à la fin
let allCode  = '';
let loadedCount = 0;
const loadWarnings = [];

scripts.forEach(scriptPath => {
  const fpath = path.join(ROOT, scriptPath);
  if (!fs.existsSync(fpath)) return;
  const src = fs.readFileSync(fpath, 'utf8');
  allCode += `\n/* ====== ${scriptPath} ====== */\n${src}\n`;
  loadedCount++;
});

// Ajouter capture des globals à la fin du bloc commun
allCode += `
/* ====== Capture globals pour les tests ====== */
try { window._RT  = RestTimer;          } catch(e){}
try { window._Store = Store;            } catch(e){}
try { window._Search = Search;          } catch(e){}
try { window._Coach = Coach;            } catch(e){}
try { window._Router = Router;          } catch(e){}
try { window._Compute = Compute;        } catch(e){}
try { window._Charts = Charts;          } catch(e){}
try { window._DAYS = DAYS;              } catch(e){}
try { window._switchTab = switchTab;    } catch(e){}
try { window._renderDashboard = renderDashboard; } catch(e){}
try { window._renderDayDetail = renderDayDetail; } catch(e){}
try { window._renderDayTabs = renderDayTabs;     } catch(e){}
try { window._renderProgression = renderProgression; } catch(e){}
try { window._renderGoals = renderGoals;         } catch(e){}
try { window._renderBilan = typeof renderBilan !== 'undefined' ? renderBilan : null; } catch(e){}
try { window._updateStats = updateStats;         } catch(e){}
try { window._quickLogModal = _quickLogModal;    } catch(e){}
`;

let loadError = null;
try {
  vm.runInContext(allCode, ctx, { filename:'<all-scripts>', displayErrors:false });
  ok(`App chargée (${loadedCount} scripts)`, loadedCount >= 30);
  ok('Pas d\'erreur de chargement', true);
} catch(e) {
  ok(`App chargée`, false, e.message);
  loadError = e;
}

// Tester chaque render function
function tryRender(name, fn) {
  try { fn(); ok(`${name} s'exécute sans crash`, true); }
  catch(e) { ok(`${name} s'exécute sans crash`, false, e.message); }
}

if (!loadError) {
  tryRender('renderDashboard()',   () => ctx._renderDashboard && ctx._renderDashboard());
  tryRender('renderDayTabs()',     () => ctx._renderDayTabs && ctx._renderDayTabs());
  tryRender('renderDayDetail(0)', () => ctx._renderDayDetail && ctx._renderDayDetail(0));
  tryRender('renderProgression()',() => ctx._renderProgression && ctx._renderProgression());
  tryRender('renderGoals()',      () => ctx._renderGoals && ctx._renderGoals());
  tryRender('updateStats()',      () => ctx._updateStats && ctx._updateStats());
  tryRender('renderBilan()',      () => ctx._renderBilan && ctx._renderBilan());

  // Timer
  tryRender('RestTimer.start/stop', () => {
    if (!ctx._RT) throw new Error('RestTimer not captured');
    ctx._RT.start(10, 'Test', null);
    ctx._RT.stop();
  });

  // Quick log modals
  ['weight','steps','sleep'].forEach(t => {
    tryRender(`_quickLogModal('${t}')`, () => ctx._quickLogModal && ctx._quickLogModal(t));
  });
}

// ══════════════════════════════════════════════════════════════
// NIVEAU 3 : TESTS FONCTIONNELS
// ══════════════════════════════════════════════════════════════
section('Tests fonctionnels');

if (!loadError) {
  // Store
  try {
    const state = ctx._Store.getState();
    ok('Store.getState() retourne un objet', typeof state === 'object');
    ['training','activity','body','goals','app'].forEach(k => ok(`State.${k} présent`, k in state));
  } catch(e) { ok('Store integrity', false, e.message); }

  // computeFitnessScore
  try {
    const fs2 = ctx.computeFitnessScore();
    ok('computeFitnessScore score [0,100]', !isNaN(fs2.score) && fs2.score >= 0 && fs2.score <= 100);
    ok('breakdown 6 items', fs2.breakdown.length === 6);
    ok('pas de NaN dans breakdown', fs2.breakdown.every(b => !isNaN(b.pts)));
    ok('Assiduite et Programme presents', fs2.breakdown.some(b=>b.label==='Assiduité') && fs2.breakdown.some(b=>b.label==='Programme'));
  } catch(e) { ok('computeFitnessScore', false, e.message); }

  // Coach
  try {
    const ex = {name:'Squat',weight:'100',reps:'5-8',repsAchieved:'8',sets:'3',isWarmup:false,setData:[]};
    const sug = ctx._Coach.analyzeExercise(ex);
    ok('Coach.analyzeExercise retourne objet ou null', sug === null || typeof sug === 'object');
    if (sug) ok('Suggestion a type et title', sug.type && sug.title);
  } catch(e) { ok('Coach.analyzeExercise', false, e.message); }

  // Search
  try {
    const r = ctx._Search.query('squat');
    ok('Search.query retourne tableau ≤12', Array.isArray(r) && r.length <= 12);
  } catch(e) { ok('Search.query', false, e.message); }

  // RestTimer wall clock
  try {
    const RT = ctx._RT;
    RT.start(30, 'Test', null);
    ok('_targetTime dans le futur', RT._targetTime > Date.now());
    RT.addTime(10);
    ok('addTime met à jour _targetTime', RT._remaining === 40);
    RT.stop();
    ok('stop vide _interval', RT._interval === null);
  } catch(e) { ok('RestTimer wall clock', false, e.message); }

  // localDateStr
  try {
    const d = ctx.localDateStr();
    ok('localDateStr() format YYYY-MM-DD', /^\d{4}-\d{2}-\d{2}$/.test(d));
  } catch(e) { ok('localDateStr', false, e.message); }
}

// ══════════════════════════════════════════════════════════════
// NIVEAU 4 : VÉRIFICATIONS FICHIERS
// ══════════════════════════════════════════════════════════════
section('Vérifications fichiers');

const swSrc   = fs.readFileSync(path.join(ROOT,'sw.js'),'utf8');
const htmlSrc = fs.readFileSync(path.join(ROOT,'index.html'),'utf8');

const swVer   = (swSrc.match(/const CACHE = '(ctp-v\d+)'/)   ||[])[1];
const htmlVer = (htmlSrc.match(/const SW_VERSION = '(ctp-v\d+)'/)  ||[])[1];
ok('SW_VERSION == CACHE', swVer === htmlVer, `${swVer} vs ${htmlVer}`);

// SW assets sur disque
const assets = [...swSrc.matchAll(/'(\.\/[^']+)'/g)].map(m=>m[1]);
const missingAssets = assets.filter(a => !fs.existsSync(path.join(ROOT,a.replace('./',''))));
ok(`Tous les assets SW présents (${assets.length})`, missingAssets.length === 0, missingAssets.join(', '));

// Pas d'eval()
filesToCheck.forEach(f => {
  const clean = fs.readFileSync(path.join(ROOT,f),'utf8').replace(/\/\/[^\n]*/g,'').replace(/\/\*[\s\S]*?\*\//g,'');
  ok(`${path.basename(f)} — pas d'eval()`, !clean.includes('eval('));
});

// CSS variables définies
const css    = fs.readFileSync(path.join(ROOT,'css/style.css'),'utf8');
const tokens = fs.readFileSync(path.join(ROOT,'design/tokens.css'),'utf8');
const definedVars = new Set([...(tokens+css).matchAll(/--([\w-]+)\s*:/g)].map(m=>m[1]));
const usedVars    = [...css.matchAll(/var\(--([\w-]+)/g)].map(m=>m[1]);
const undefVars   = [...new Set(usedVars.filter(v => !definedVars.has(v)))];
ok(`Variables CSS toutes définies`, undefVars.length === 0, undefVars.join(', '));

// ══════════════════════════════════════════════════════════════
// RÉSULTAT
// ══════════════════════════════════════════════════════════════
console.log(`\n${'═'.repeat(44)}`);
console.log(`  ✅ ${pass} passés   ❌ ${fail} échoués   ⚠️  ${warn} avertissements`);
console.log('═'.repeat(44));

if (fail > 0) {
  console.log('\n🚫 NE PAS DÉPLOYER — '+fail+' test(s) échoué(s)');
  process.exit(1);
} else {
  console.log('\n🚀 Prêt à déployer');
  process.exit(0);
}
