/* ============================================================
   init.js — Point d'entrée Coach Tracker Pro
   Ordre: Store.load → Router.register → Router.init → navigate
============================================================ */

/* ── 0. Initialiser la gestion d'erreurs ── */
Errors.init({ dev: false });

/* ── 1. Charger les données ── */
Store.load();

/* ── 2. S est maintenant un proxy réactif (state-bridge.js)
   Les lectures/écritures sont automatiquement routées vers Store ── */

/* ── 3. Appliquer les préférences UI ── */
_exView = S.exViewMode || 'compact';
document.documentElement.setAttribute('data-theme', S.darkMode ? 'dark' : 'light');
const _dmBtn = document.getElementById('darkmode-btn');
if (_dmBtn) _dmBtn.textContent = S.darkMode ? '☀️' : '🌙';

/* ── 4. Enregistrer toutes les routes ── */
Router.register('dashboard',   () => DashboardView.render());
Router.register('weekly',      () => PlanningView.render());
Router.register('session',     () => SessionView.render());
Router.register('progression', () => ProgressionView.render());
Router.register('corps',       () => CorpsView.render());
Router.register('bilan',       () => BilanView.render());
Router.register('kpi',         () => KPIView.render());
Router.register('achievements',() => AchievementsView.render());
Router.register('library',     () => LibraryView.render());
Router.register('monthly',     () => CalendarView.render());
Router.register('settings',    () => SettingsView.render());

/* ── 5. Initialiser le router (event listeners nav) ── */
Router.init();

/* ── 6. Alias de compatibilité ──
   switchTab() utilisé partout dans le code existant
   On le redirige vers Router.navigate() sans rien casser */
function switchTab(tabName) {
  Router.navigate(tabName);
  Store.dispatch({ type: 'APP_SET_TAB', payload: tabName }, { skipUndo: true });
}

/* ── 7. Init des composants ── */
updateWeekBadges();
PlanningView._syncS();
renderDayTabs();
renderDayDetail(S.activeDay || 0);
renderGoals();

const _notesArea = document.getElementById('notes-area');
if (_notesArea) _notesArea.value = S.notes || '';

updateStats();
updateChronoDsp();
checkWeeklyAutoSave();
  Notify.restore(); // Restaurer le rappel quotidien
checkAndAwardAchievements();
checkOnboarding();
_initRestTimerButtons();
restoreReminder();

/* ── 8. Naviguer vers l'onglet de démarrage ── */
const _startTab = S._currentTab || 'weekly';
setTimeout(() => Router.navigate(_startTab), 0);

/* ── 9. PWA manifest dynamique ── */
const _manifest = {
  name: 'Coach Tracker Pro',
  short_name: 'CTP',
  start_url: '.',
  display: 'standalone',
  background_color: '#f2f4f7',
  theme_color: '#5ba8a0',
  icons: [{
    src: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🏋️</text></svg>',
    type: 'image/svg+xml',
    sizes: 'any'
  }]
};
const _blob = new Blob([JSON.stringify(_manifest)], { type: 'application/json' });
const _ml = document.getElementById('pwa-manifest');
if (_ml) _ml.href = URL.createObjectURL(_blob);
