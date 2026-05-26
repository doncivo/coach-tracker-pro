/* ============================================================
   init.js — Initialisation
============================================================ */

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
