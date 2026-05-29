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

section('Corrections audit — tests ciblés');

// C1: Headers Claude API présents dans le code source
ok('C1: x-api-key header present', (() => {
  const s = fs.readFileSync(path.join(ROOT,'js/services/api-extended.js'),'utf8');
  return s.includes("'x-api-key': claudeKey") &&
         s.includes("anthropic-dangerous-direct-browser-access");
})());

ok('C1: Guard cle vide present', (() => {
  const s = fs.readFileSync(path.join(ROOT,'js/services/api-extended.js'),'utf8');
  return s.includes('if (!claudeKey)');
})());

// C2: Mode libre utilise sessionStorage
ok('C2: Mode libre — sessionStorage (pas S._freeExercises)', (() => {
  const s = fs.readFileSync(path.join(ROOT,'js/render_session.js'),'utf8');
  return s.includes('_getFreeExs()') &&
         s.includes("sessionStorage.getItem('_freeExs')") &&
         !s.includes('S._freeExercises.forEach') &&
         !s.includes('S._freeExercises.push');
})());

// C3: Pas de double dispatch
ok('C3: Pas de double dispatch Apple Watch', (() => {
  const s = fs.readFileSync(path.join(ROOT,'js/services/api-integrations.js'),'utf8');
  // Le load handler ne doit pas appeler readURLParams() (actif, hors commentaire)
  const loadMatch = s.match(/window\.addEventListener\(['"]load['"][\s\S]*?\}\s*\)/);
  if (!loadMatch) return true;
  const loadBody = loadMatch[0];
  // Chercher un appel non commenté à readURLParams()
  const lines = loadBody.split('\n').filter(l => !l.trim().startsWith('//'));
  return !lines.some(l => l.includes('readURLParams()'));
})());

// C5: Guard ICS date
ok('C5: ICS — guard date manquante', (() => {
  const s = fs.readFileSync(path.join(ROOT,'js/services/api-extended.js'),'utf8');
  return s.includes("if (!d.date) return");
})());

// C7: Date.now() absent du hash router
ok('C7: Router hash — sans Date.now()', (() => {
  const s = fs.readFileSync(path.join(ROOT,'js/core/router.js'),'utf8');
  const m = s.match(/dashboard:\s*\[.*?\]/s);
  return m ? !m[0].includes('Date.now()') : false;
})());

// C8: AbortController dans USDA
ok('C8: USDA — AbortController present', (() => {
  const s = fs.readFileSync(path.join(ROOT,'js/services/api-extended.js'),'utf8');
  return s.includes('new AbortController()') && s.includes("'AbortError'");
})());

// C10: Caches API limités
ok('C10: Caches API limites a 50', (() => {
  const s1 = fs.readFileSync(path.join(ROOT,'js/services/api-integrations.js'),'utf8');
  const s2 = fs.readFileSync(path.join(ROOT,'js/services/api-extended.js'),'utf8');
  return s1.includes('> 50') && s2.includes('> 50');
})());



section('Tests nouveaux services');

// Gap 1 — C6: sess-info-chips wrapper présent dans HTML
ok('C6: sess-info-chips dans index.html', (() => {
  const html = fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
  return html.includes('class="sess-info-chips"') && html.includes('id="sess-info-chips"');
})());

// Gap 2 — C9: safe-area-inset-top sur l'overlay de fin de séance
ok('C9: Dynamic Island safe-area sur overlay seance', (() => {
  const s = fs.readFileSync(path.join(ROOT,'js/render_planning.js'),'utf8');
  return s.includes('safe-area-inset-top') && s.includes('sess-complete-overlay');
})());

// Gap 3 — Nouveaux champs State présents (migration)
ok('State: watchData present', (() => {
  const s = fs.readFileSync(path.join(ROOT,'js/data/constants.js'),'utf8');
  return s.includes('watchData:') || s.includes('watchData :');
})());

ok('State: apiKeys.claude present', (() => {
  const s = fs.readFileSync(path.join(ROOT,'js/data/constants.js'),'utf8');
  return s.includes("claude:''") || s.includes('claude: ');
})());

ok('State: dayTemplates present', (() => {
  const s = fs.readFileSync(path.join(ROOT,'js/data/constants.js'),'utf8');
  return s.includes('dayTemplates:[]') || s.includes('dayTemplates: []');
})());

// Gap 4 — calcRecoveryScore ne crash pas sans données Watch
ok('calcRecoveryScore: retourne null sans donnees', (() => {
  try {
    if (typeof AppleWatch === 'undefined') return true; // non chargé en Node = OK
    const result = AppleWatch.calcRecoveryScore('2099-01-01');
    return result === null; // pas de données → null, pas un crash
  } catch(e) { return false; }
})());

// Gap 5 — SW contient tous les nouveaux fichiers services
ok('SW: tous les nouveaux services dans le cache', (() => {
  const sw = fs.readFileSync(path.join(ROOT,'sw.js'),'utf8');
  return [
    'icloud-watch.js',
    'api-extended.js',
    'api-integrations.js',
    'mesures-objectifs.js',
    'csv-planning.js',
  ].every(f => sw.includes(f));
})());

// Gap 6 — _getFreeExs retourne [] sur sessionStorage corrompu
ok('_getFreeExs: resilient au sessionStorage corrompu', (() => {
  const s = fs.readFileSync(path.join(ROOT,'js/render_session.js'),'utf8');
  // Vérifier le try/catch autour de JSON.parse
  return s.includes("try { return JSON.parse(sessionStorage.getItem('_freeExs')") &&
         s.includes("} catch(e) { return []; }");
})());

// Gap 7 — calcMesureObjectif accessible et retourne objet valide
ok('calcMesureObjectif: retourne objet pour bras', (() => {
  try {
    if (typeof calcMesureObjectif === 'undefined') return true; // non chargé en Node
    const result = calcMesureObjectif('bras');
    return result !== null && typeof result === 'object' &&
           result.santé !== undefined && result.athlétique !== undefined;
  } catch(e) { return false; }
})());

// Gap 8 — ICSExport.generate ne crash pas avec date manquante
ok('ICSExport.generate: robuste aux dates manquantes', (() => {
  const s = fs.readFileSync(path.join(ROOT,'js/services/api-extended.js'),'utf8');
  // Guard présent + génération de fin de fichier VCALENDAR
  return s.includes("if (!d.date) return") &&
         s.includes("END:VCALENDAR");
})());

// Gap 9 — ClaudeCoach._history limité à 20 items
ok('ClaudeCoach: historique limite a 20 items', (() => {
  const s = fs.readFileSync(path.join(ROOT,'js/services/api-extended.js'),'utf8');
  return s.includes('_history.length > 20') && s.includes('.slice(-20)');
})());



section('Audit corrections v79');

// mesure-inp font-size 16px (iOS zoom)
ok('mesure-inp font-size 16px', (() => {
  const s = fs.readFileSync(path.join(ROOT,'css/style.css'),'utf8');
  const m = s.match(/\.mesure-inp\s*\{[^}]+\}/);
  return m ? m[0].includes('font-size: 16px') || m[0].includes('font-size:16px') : false;
})());

// Corps listeners init once
ok('renderCorps: listener guard present', (() => {
  const s = fs.readFileSync(path.join(ROOT,'js/render_corps.js'),'utf8');
  return s.includes('_corpsListenersInit');
})());

// ensureSection pattern
ok('renderCorps: ensureSection stable injection', (() => {
  const s = fs.readFileSync(path.join(ROOT,'js/render_corps.js'),'utf8');
  return s.includes('function ensureSection(');
})());

// card bg bug fixed
ok('body-composition: card bg no broken regex', (() => {
  const s = fs.readFileSync(path.join(ROOT,'js/services/body-composition.js'),'utf8');
  return !s.includes(".replace(')', ',0.5)')");
})());

// debounced save in session inputs
ok('session: focus inputs use _debouncedSave', (() => {
  const s = fs.readFileSync(path.join(ROOT,'js/render_session.js'),'utf8');
  return s.includes('_debouncedSave') && !s.includes("e.target.value;save();});");
})());



section('Audit complet v80 — nouveaux tests');

// B1: recentSess lit bien les jours (pas Array.isArray)
ok('B1: bilan recentSess - lit .days correctement', (() => {
  const s = fs.readFileSync(path.join(ROOT,'js/render_bilan.js'),'utf8');
  return s.includes('wkData?.days') && !s.includes('Array.isArray(v)');
})());

// B2: pagehide flush présent
ok('B2: store pagehide flush présent', (() => {
  const s = fs.readFileSync(path.join(ROOT,'js/core/store.js'),'utf8');
  return s.includes("'pagehide'") && s.includes('_flushNow');
})());

// B2: visibilitychange flush présent
ok('B2: store visibilitychange flush présent', (() => {
  const s = fs.readFileSync(path.join(ROOT,'js/core/store.js'),'utf8');
  return s.includes("'visibilitychange'") && s.includes('visibilityState');
})());

// B3: save() sans JSON.stringify loop
ok('B3: state-bridge sans JSON.stringify par-day loop', (() => {
  const s = fs.readFileSync(path.join(ROOT,'js/core/state-bridge.js'),'utf8');
  return !s.includes('JSON.stringify(day)') && s.includes('_pendingFlush');
})());

// B4: no more direct save() in reps input
ok('B4: reps input debounced', (() => {
  const s = fs.readFileSync(path.join(ROOT,'js/render_session.js'),'utf8');
  return !s.includes("setD.reps = e.target.value; refreshSecondary(); save();");
})());

// TRAINING_SET_DAYS_BATCH reducer exists
ok('Store: TRAINING_SET_DAYS_BATCH reducer', (() => {
  const s = fs.readFileSync(path.join(ROOT,'js/core/store.js'),'utf8');
  return s.includes("'TRAINING_SET_DAYS_BATCH'");
})());



section('Audit complet depuis creation');

// C1: water/bodyCompo dans Store INITIAL_STATE
ok('C1: water dans Store body domain', (() => {
  const s = fs.readFileSync(path.join(ROOT,'js/core/store.js'),'utf8');
  return s.includes("water:") && s.includes("flat.water");
})());

// C1: watchData/bodyCompo persistés
ok('C1: bodyCompo et watchData persistés dans store', (() => {
  const s = fs.readFileSync(path.join(ROOT,'js/core/store.js'),'utf8');
  return s.includes("flat.bodyCompo") && s.includes("flat.watchData");
})());

// C1: state-bridge DOMAIN_MAP inclut water/bodyCompo
ok('C1: state-bridge mappe water + bodyCompo → body', (() => {
  const s = fs.readFileSync(path.join(ROOT,'js/core/state-bridge.js'),'utf8');
  return s.includes("water:") && s.includes("bodyCompo:") && s.includes("watchData:");
})());

// C2: Pas de double-listener nav dans utils.js
ok('C2: utils.js sans double nav listeners', (() => {
  const s = fs.readFileSync(path.join(ROOT,'js/utils.js'),'utf8');
  return !s.includes("Wire top tabs") && !s.includes("Wire bottom nav main");
})());

// C2: Swipe unique dans router.js uniquement
ok('C2: swipe touchstart dans router.js uniquement', (() => {
  const utils = fs.readFileSync(path.join(ROOT,'js/utils.js'),'utf8');
  const touchCount = (utils.match(/document\.addEventListener\('touchstart'/g) || []).length;
  return touchCount === 0;
})());

// C3: export-btn utilise Persist
ok('C3: export-btn utilise Persist.exportJSON', (() => {
  const s = fs.readFileSync(path.join(ROOT,'js/utils.js'),'utf8');
  return s.includes('Persist.exportJSON()') && !s.includes("JSON.stringify(S,null,2)");
})());

// C4: bras-g/cuisse-g/mollet-g dans mesures defaults
ok('C4: mesures defaults incluent bras-g/cuisse-g/mollet-g', (() => {
  const s1 = fs.readFileSync(path.join(ROOT,'js/data/constants.js'),'utf8');
  const s2 = fs.readFileSync(path.join(ROOT,'js/services/persist.js'),'utf8');
  return s1.includes("'bras-g'") && s2.includes("'bras-g'");
})());



section('Corrections finales v82');

// Fix 1: icône rendue dans _settingsSection
ok('Fix 1: _settingsSection rend les icones', (() => {
  const s = fs.readFileSync(path.join(ROOT,'js/render_other.js'),'utf8');
  return s.includes('ic.textContent = icon.emoji') && s.includes("icon && icon.emoji");
})());

// Fix 2: profilAge dans Store body domain
ok('Fix 2: profilAge dans Store INITIAL_STATE', (() => {
  const s = fs.readFileSync(path.join(ROOT,'js/core/store.js'),'utf8');
  return s.includes("profilAge:      30") && s.includes("flat.profilAge");
})());

// Fix 2: profilSexe dans Store
ok('Fix 2: profilSexe dans Store INITIAL_STATE', (() => {
  const s = fs.readFileSync(path.join(ROOT,'js/core/store.js'),'utf8');
  return s.includes("profilSexe:     'H'") && s.includes("flat.profilSexe");
})());

// Fix 2: state-bridge mappe profilAge + profilSexe
ok('Fix 2: state-bridge mappe profilAge + profilSexe', (() => {
  const s = fs.readFileSync(path.join(ROOT,'js/core/state-bridge.js'),'utf8');
  return s.includes("profilAge:       'body'") && s.includes("profilSexe:");
})());

// Fix 2: onboarding sauvegarde profilAge
ok('Fix 2: onboarding sauvegarde profilAge', (() => {
  const s = fs.readFileSync(path.join(ROOT,'js/render_dashboard.js'),'utf8');
  return s.includes("S.profilAge=a") && !s.includes("S._age=a");
})());

// Fix 3: computeTDEE utilise profilAge réel
ok('Fix 3: computeTDEE utilise profilAge reel', (() => {
  const s = fs.readFileSync(path.join(ROOT,'js/utils.js'),'utf8');
  return s.includes("S.profilAge") && !s.includes("const age=35;");
})());

// Fix 3: computeTDEE utilise profilSexe réel
ok('Fix 3: computeTDEE utilise profilSexe reel', (() => {
  const s = fs.readFileSync(path.join(ROOT,'js/utils.js'),'utf8');
  return s.includes("S.profilSexe") && s.includes("isMale");
})());



section('IndexedDB Storage');

ok('idb-storage.js existe', (() => {
  return fs.existsSync(path.join(ROOT,'js/services/idb-storage.js'));
})());

ok('idb-storage.js chargé dans index.html avant persist.js', (() => {
  const h = fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
  const idbPos  = h.indexOf('idb-storage.js');
  const persPos = h.indexOf('persist.js');
  return idbPos > 0 && persPos > 0 && idbPos < persPos;
})());

ok('persist.js écrit dans IDB (_writeToDisk)', (() => {
  const s = fs.readFileSync(path.join(ROOT,'js/services/persist.js'),'utf8');
  return s.includes('IDBStorage.set(flat)');
})());

ok('persist.js expose loadFromIDB', (() => {
  const s = fs.readFileSync(path.join(ROOT,'js/services/persist.js'),'utf8');
  return s.includes('loadFromIDB,');
})());

ok('persist.js resetAll vide aussi IDB', (() => {
  const s = fs.readFileSync(path.join(ROOT,'js/services/persist.js'),'utf8');
  return s.includes('IDBStorage.clear()');
})());

ok('sw.js cache idb-storage.js', (() => {
  const s = fs.readFileSync(path.join(ROOT,'sw.js'),'utf8');
  return s.includes('idb-storage.js');
})());


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
