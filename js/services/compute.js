/* ================================================================
   services/compute.js — Calculs métier purs

   RÈGLE ABSOLUE: aucune référence à S, DOM, Store, ou window.
   Toutes les fonctions prennent leurs données en paramètre.
   Toutes sont testables avec: node compute.js

   Catégories:
   - Temps & dates
   - Identifiants
   - Calculs musculation (1RM, volume, progression)
   - Calculs nutrition (TDEE, macros, BMI)
   - Score fitness global
   - Analyse historique
   ================================================================ */

const Compute = (() => {

  /* ─────────────────────────────────────────────
     TEMPS & DATES
  ───────────────────────────────────────────── */

  /**
   * Date locale au format 'YYYY-MM-DD'
   * @param {Date} [d] — date (défaut: aujourd'hui)
   */
  function localDateStr(d) {
    const dt = d || new Date();
    const y  = dt.getFullYear();
    const mo = String(dt.getMonth() + 1).padStart(2, '0');
    const da = String(dt.getDate()).padStart(2, '0');
    return `${y}-${mo}-${da}`;
  }

  /**
   * Tableau des N derniers jours (du plus ancien au plus récent)
   * @param {number} n
   * @returns {string[]} dates 'YYYY-MM-DD'
   */
  function lastNDays(n) {
    return Array.from({ length: n }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (n - 1 - i));
      return localDateStr(d);
    });
  }

  /**
   * Nombre de jours entre deux dates
   * @param {string} dateA  'YYYY-MM-DD'
   * @param {string} dateB  'YYYY-MM-DD'
   */
  function daysBetween(dateA, dateB) {
    const a = new Date(dateA);
    const b = new Date(dateB);
    return Math.round(Math.abs(b - a) / 86400000);
  }

  /**
   * Vérifier si une date est dans les N derniers jours
   */
  function isRecent(dateStr, nDays) {
    return daysBetween(dateStr, localDateStr()) <= nDays;
  }

  /* ─────────────────────────────────────────────
     IDENTIFIANTS
  ───────────────────────────────────────────── */

  /**
   * Générer un identifiant unique court (8 chars)
   */
  function uid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID().slice(0, 8);
    }
    return Math.random().toString(36).slice(2, 10);
  }

  /**
   * Clé stable pour identifier un exercice (id > nom)
   */
  function exKey(ex) {
    return ex.id || (ex.name || '').trim().toLowerCase();
  }

  /* ─────────────────────────────────────────────
     CALCULS MUSCULATION
  ───────────────────────────────────────────── */

  /**
   * 1RM estimé — formule Epley
   * @param {number|string} weight  poids en kg
   * @param {number|string} reps    répétitions réalisées
   * @returns {number} 1RM arrondi à 0.5kg
   */
  function calc1RM(weight, reps) {
    const w = parseFloat(weight) || 0;
    const r = parseInt(reps) || 0;
    if (!w || r <= 0) return 0;
    if (r === 1) return w;
    return Math.round(w * (1 + r / 30) * 2) / 2;
  }

  /**
   * Volume d'une série (poids × séries × reps)
   * @param {Object} ex  exercice avec weight, sets, repsAchieved|reps
   */
  function calcVol(ex) {
    const w = parseFloat(ex.weight) || 0;
    const s = parseInt(ex.sets) || 0;
    const r = parseInt(ex.repsAchieved || ex.reps) || 0;
    return w && s && r && !ex.isWarmup ? w * s * r : 0;
  }

  /**
   * Volume total d'un jour par groupe musculaire
   * @param {Object} day  { exercises: [...] }
   * @returns {{ [muscle]: number }}
   */
  function dayVolume(day) {
    const v = {};
    (day.exercises || []).forEach(ex => {
      if (ex.isWarmup || !ex.muscle || !ex.name) return;
      const vol = calcVol(ex);
      if (vol > 0) v[ex.muscle] = (v[ex.muscle] || 0) + vol;
    });
    return v;
  }

  /**
   * Volume par muscle pour toute la semaine
   * @param {Object[]} days  tableau de 7 jours
   */
  function weekVolume(days) {
    const v = {};
    (days || []).forEach(d => {
      Object.entries(dayVolume(d)).forEach(([m, vol]) => {
        v[m] = (v[m] || 0) + vol;
      });
    });
    return v;
  }

  /**
   * Groupes musculaires actifs d'un jour
   */
  function getDayMuscles(day) {
    return (day.muscles || []).filter(Boolean);
  }

  /**
   * Surcharger la semaine prochaine ? (reps atteintes ≥ haut fourchette)
   */
  function shouldOverload(ex) {
    if (!ex.repsAchieved) return false;
    const achieved = parseInt(ex.repsAchieved);
    const match = (ex.reps || '').match(/(\d+)/g);
    if (!match) return false;
    return achieved >= parseInt(match[match.length - 1]);
  }

  /**
   * Échec ? (reps atteintes < 85% du bas de la fourchette)
   */
  function isFailure(ex) {
    if (!ex.repsAchieved || !ex.reps) return false;
    const achieved = parseInt(ex.repsAchieved);
    const match = (ex.reps || '').match(/(\d+)/g);
    if (!match) return false;
    return achieved < parseInt(match[0]) * 0.85;
  }

  /**
   * Plateau ? (même poids sur les 3 dernières semaines)
   * @param {Object[]} history  résultat de exHistory()
   */
  function isPlateau(history) {
    if (history.length < 3) return false;
    const recent  = history.slice(-3);
    const weights = recent.map(r => parseFloat(r.weight) || 0);
    return weights.every(w => w === weights[0]) && weights[0] > 0;
  }

  /**
   * Poids suggéré pour la prochaine séance
   * @param {Object} ex  exercice avec weight, repsAchieved, reps
   * @returns {string} poids suggéré
   */
  function suggestedWeight(ex) {
    if (!ex.weight || !ex.repsAchieved) return ex.weight || '';
    const cw = parseFloat(ex.weight) || 0;
    if (shouldOverload(ex)) {
      return String(Math.round((cw * 1.025) / 2.5) * 2.5);
    } else if (isFailure(ex)) {
      return String(Math.round((cw * 0.975) / 2.5) * 2.5);
    }
    return ex.weight;
  }

  /**
   * Historique complet d'un exercice (depuis history{})
   * @param {Object}  history  S.history
   * @param {string}  nameOrId  nom ou id de l'exercice
   * @returns {Object[]} liste ordonnée { weight, reps, repsAchieved, rpe, date }
   */
  function exHistory(history, nameOrId) {
    const byId   = ex => ex.id   && ex.id   === nameOrId;
    const byName = ex => (ex.name || '').trim().toLowerCase() ===
                         nameOrId.trim().toLowerCase();
    const result = [];

    Object.entries(history || {})
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([wk, wkD]) => {
        (wkD.days || []).forEach(d => {
          (d.exercises || []).forEach(ex => {
            if ((byId(ex) || byName(ex)) && ex.weight) {
              result.push({
                weight:       ex.weight,
                reps:         ex.reps,
                repsAchieved: ex.repsAchieved || ex.reps,
                rpe:          ex.rpe || '',
                oneRM:        calc1RM(ex.weight, ex.repsAchieved || ex.reps),
                date:         d.date || wkD.date || wk,
              });
            }
          });
        });
      });

    return result;
  }

  /**
   * Vérifier si la perf actuelle est un PR
   * @param {Object} ex       exercice avec weight, repsAchieved
   * @param {Object} history  S.history
   */
  function isPR(ex, history) {
    if (!ex.weight || !ex.repsAchieved) return false;
    const hist = exHistory(history, exKey(ex));
    if (!hist.length) return false;
    const maxHist = Math.max(...hist.map(r => r.oneRM));
    return calc1RM(ex.weight, ex.repsAchieved) > maxHist;
  }

  /**
   * Progression sur N semaines pour un exercice
   * @returns { firstRM, lastRM, deltaPct, trend: 'up'|'down'|'flat' }
   */
  function exProgression(history, nameOrId) {
    const hist = exHistory(history, nameOrId);
    if (hist.length < 2) return { firstRM: 0, lastRM: 0, deltaPct: 0, trend: 'flat' };
    const firstRM = hist[0].oneRM;
    const lastRM  = hist[hist.length - 1].oneRM;
    const deltaPct = firstRM > 0 ? Math.round((lastRM - firstRM) / firstRM * 100) : 0;
    return {
      firstRM,
      lastRM,
      deltaPct,
      trend: deltaPct > 2 ? 'up' : deltaPct < -2 ? 'down' : 'flat',
    };
  }

  /* ─────────────────────────────────────────────
     CALCULS NUTRITION & MORPHO
  ───────────────────────────────────────────── */

  /**
   * BMI (Indice de Masse Corporelle)
   * @param {number} weightKg   poids en kg
   * @param {number} heightCm   taille en cm
   */
  function calcBMI(weightKg, heightCm) {
    if (!weightKg || !heightCm) return 0;
    const h = heightCm / 100;
    return Math.round(weightKg / (h * h) * 10) / 10;
  }

  /**
   * Catégorie BMI
   */
  function bmiCategory(bmi) {
    if (bmi < 18.5) return { label: 'Insuffisance pondérale', color: '--blue' };
    if (bmi < 25)   return { label: 'Poids normal',            color: '--green' };
    if (bmi < 30)   return { label: 'Surpoids',                color: '--orange' };
    return              { label: 'Obésité',                color: '--red' };
  }

  /**
   * BMR (Métabolisme basal) — formule Mifflin-St Jeor
   * @param {number} weightKg
   * @param {number} heightCm
   * @param {number} age
   * @param {string} gender  'm' | 'f'
   */
  function calcBMR(weightKg, heightCm, age, gender) {
    const w = parseFloat(weightKg) || 70;
    const h = parseFloat(heightCm) || 175;
    const a = parseInt(age) || 30;
    return gender === 'f'
      ? 10 * w + 6.25 * h - 5 * a - 161
      : 10 * w + 6.25 * h - 5 * a + 5;
  }

  /**
   * TDEE (Dépense Énergétique Totale)
   * @param {number} bmr
   * @param {number} sessionsPerWeek  séances d'entraînement par semaine
   */
  function calcTDEE(bmr, sessionsPerWeek) {
    const mult = sessionsPerWeek >= 5 ? 1.725
               : sessionsPerWeek >= 3 ? 1.55
               : sessionsPerWeek >= 1 ? 1.375
               : 1.2;
    return { tdee: Math.round(bmr * mult), bmr: Math.round(bmr), mult, sessionsPerWeek };
  }

  /**
   * Répartition macros recommandée
   * @param {number} calories  objectif calorique
   * @param {string} goal      'perf' | 'cut' | 'bulk' | 'maint'
   */
  function calcMacros(calories, goal) {
    const ratios = {
      perf:  { prot: 0.30, carbs: 0.45, fat: 0.25 },
      cut:   { prot: 0.35, carbs: 0.35, fat: 0.30 },
      bulk:  { prot: 0.25, carbs: 0.50, fat: 0.25 },
      maint: { prot: 0.30, carbs: 0.45, fat: 0.25 },
    };
    const r = ratios[goal] || ratios.maint;
    return {
      prot:  Math.round(calories * r.prot  / 4),
      carbs: Math.round(calories * r.carbs / 4),
      fat:   Math.round(calories * r.fat   / 9),
      calories,
    };
  }

  /**
   * Calories journalières depuis l'objet calories du state
   * @param {Object} caloriesObj  S.calories
   * @param {string[]} days       liste de dates
   */
  function dailyCalories(caloriesObj, days) {
    return (days || []).map(d => {
      const day = (caloriesObj || {})[d];
      let total = 0;
      if (day && day.meals) {
        day.meals.forEach(m => {
          (m.items || []).forEach(item => { total += parseFloat(item.cal) || 0; });
        });
      }
      return { date: d, cal: Math.round(total) };
    });
  }

  /* ─────────────────────────────────────────────
     SCORE FITNESS GLOBAL
  ───────────────────────────────────────────── */

  /**
   * Score fitness composite (0-100)
   *
   * @param {Object} params
   * @param {Object[]} params.days          S.days
   * @param {Object}   params.history       S.history
   * @param {Object}   params.steps         S.steps
   * @param {number}   params.stepsGoal     S.stepsGoal
   * @param {Object}   params.sleep         S.sleep
   * @param {Object}   params.calories      S.calories
   * @param {number}   params.caloriesGoal  S.caloriesGoal
   * @param {Object[]} params.painLog       S.painLog
   * @param {Object}   params.sessRecovery  S.sessRecovery
   *
   * @returns {{ score, breakdown[] }}
   */
  function fitnessScore(params) {
    const {
      days          = [],
      history       = {},
      steps         = {},
      stepsGoal     = 10000,
      sleep         = {},
      calories      = {},
      caloriesGoal  = 2500,
      painLog       = [],
      sessRecovery  = {},
    } = params;

    const days7    = lastNDays(7);
    const today    = localDateStr();

    // ── Assiduité (30%) ──
    const plannedDays  = days.filter(d => d.exercises && d.exercises.length > 0).length;
    const trainedDays  = days7.filter(d => history[d] && history[d].days &&
                           history[d].days.some(day => day.exercises &&
                             day.exercises.some(e => e.done))).length;
    const adherence    = plannedDays > 0 ? Math.min(100, trainedDays / plannedDays * 100) : 50;

    // ── Pas (20%) ──
    const avgSteps     = days7.reduce((a, d) => a + (parseInt(steps[d] || 0) || 0), 0) / 7;
    const stepsScore   = Math.min(100, avgSteps / stepsGoal * 100);

    // ── Sommeil (20%) ──
    const avgSleep     = days7.reduce((a, d) => {
      const s = sleep[d];
      return a + (parseFloat(s && (s.hours || s.h || s)) || 0);
    }, 0) / 7;
    const sleepScore   = avgSleep === 0 ? 50 : Math.min(100, avgSleep / 7.5 * 100);

    // ── Nutrition (15%) ──
    const dailyCals    = dailyCalories(calories, days7).map(p => p.cal);
    const avgCal       = dailyCals.reduce((a, v) => a + v, 0) / 7;
    const calDiff      = Math.abs(avgCal - caloriesGoal) / caloriesGoal;
    const nutScore     = avgCal === 0 ? 50 : Math.max(0, 100 - calDiff * 200);

    // ── Récupération (15%) ──
    const painPenalty  = (painLog || []).filter(p => isRecent(p.date, 7)).length * 10;
    const recSessions  = days7.map(d => sessRecovery[d] || 0).filter(v => v > 0);
    const avgRec       = recSessions.length
      ? recSessions.reduce((a, v) => a + v, 0) / recSessions.length
      : 70;
    const sleepBonus   = avgSleep >= 7 ? 10 : avgSleep >= 6 ? 0 : -10;
    const recovScore   = Math.max(0, Math.min(100, avgRec + sleepBonus - painPenalty));

    const score = Math.round(
      adherence  * 0.30 +
      stepsScore * 0.20 +
      sleepScore * 0.20 +
      nutScore   * 0.15 +
      recovScore * 0.15
    );

    return {
      score: Math.min(100, score),
      breakdown: [
        { icon: '💪', label: 'Assiduité', pts: Math.round(adherence),  max: 100, color: '--teal',   weight: 30 },
        { icon: '👣', label: 'Pas',       pts: Math.round(stepsScore),  max: 100, color: '--green',  weight: 20 },
        { icon: '😴', label: 'Sommeil',   pts: Math.round(sleepScore),  max: 100, color: '--purple', weight: 20 },
        { icon: '🥗', label: 'Nutrition', pts: Math.round(nutScore),    max: 100, color: '--orange', weight: 15 },
        { icon: '🔋', label: 'Récup.',    pts: Math.round(recovScore),  max: 100, color: '--red',    weight: 15 },
      ],
      detail: {
        adherence:   Math.round(adherence),
        stepsScore:  Math.round(stepsScore),
        sleepScore:  Math.round(sleepScore),
        nutScore:    Math.round(nutScore),
        recovScore:  Math.round(recovScore),
        avgSteps:    Math.round(avgSteps),
        avgSleep:    Math.round(avgSleep * 10) / 10,
        avgCal:      Math.round(avgCal),
        trainedDays,
        plannedDays,
      },
    };
  }

  /**
   * Grade lisible depuis un score
   */
  function scoreGrade(score) {
    if (score >= 90) return { label: 'Excellent',   emoji: '🔥', color: '--green' };
    if (score >= 75) return { label: 'Très bien',   emoji: '💪', color: '--teal' };
    if (score >= 60) return { label: 'Bien',         emoji: '👍', color: '--blue' };
    if (score >= 45) return { label: 'Correct',      emoji: '⚡', color: '--orange' };
    return                 { label: 'À améliorer',  emoji: '📈', color: '--red' };
  }

  /* ─────────────────────────────────────────────
     ANALYSE STATISTIQUES AVANCÉES
  ───────────────────────────────────────────── */

  /**
   * Statistiques hebdomadaires agrégées
   * @param {Object} history  S.history
   * @param {number} nWeeks   nombre de semaines à analyser
   */
  function weeklyStats(history, nWeeks) {
    nWeeks = nWeeks || 8;
    return Object.entries(history || {})
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-nWeeks)
      .map(([key, wk]) => {
        const vol       = weekVolume(wk.days || []);
        const totalVol  = Object.values(vol).reduce((a, v) => a + v, 0);
        const exCount   = (wk.days || []).reduce((a, d) =>
          a + (d.exercises || []).filter(e => !e.isWarmup && e.name).length, 0);
        return {
          key,
          weekType:  wk.weekType || 'A',
          weekCount: wk.weekCount || 0,
          totalVol,
          volume:    vol,
          exCount,
        };
      });
  }

  /**
   * Couverture musculaire (% groupes travaillés sur N séances)
   * @param {Object[]} days  S.days
   */
  function muscleCoverage(days) {
    const allMuscles = new Set();
    const worked     = new Set();
    (days || []).forEach(d => {
      (d.exercises || []).forEach(ex => {
        if (ex.isWarmup || !ex.muscle) return;
        allMuscles.add(ex.muscle);
        if (ex.name) worked.add(ex.muscle);
      });
    });
    return {
      worked:  [...worked],
      total:   allMuscles.size,
      pct:     allMuscles.size > 0 ? Math.round(worked.size / allMuscles.size * 100) : 0,
    };
  }

  /* ─────────────────────────────────────────────
     COMPATIBILITÉ — fonctions globales legacy
  ───────────────────────────────────────────── */

  // Toutes ces fonctions étaient globales dans utils.js
  // On les réexpose pour zéro régression
  window.calc1RM           = calc1RM;
  window.calcVol           = calcVol;
  window.localDateStr      = localDateStr;
  window.lastNDays         = lastNDays;
  window.uid               = uid;
  window.exKey             = exKey;
  window.shouldOverload    = shouldOverload;
  window.isFailure         = isFailure;
  window.getDMS            = getDayMuscles;
  window.calcBMI           = calcBMI;
  window.calcBMR           = calcBMR;

  window.computeFitnessScore = function() {
    const s = Store.getState();
    return fitnessScore({
      days:         s.training.days,
      history:      s.training.history,
      steps:        s.activity.steps,
      stepsGoal:    s.activity.stepsGoal,
      sleep:        s.activity.sleep,
      calories:     s.activity.calories,
      caloriesGoal: s.activity.caloriesGoal,
      painLog:      s.body.painLog,
      sessRecovery: s.training.sessRecovery,
    });
  };

  window.computeDailyCalories = function(nDays) {
    const s = Store.getState();
    return dailyCalories(s.activity.calories, lastNDays(nDays || 7));
  };

  /* ─────────────────────────────────────────────
     API PUBLIQUE
  ───────────────────────────────────────────── */
  return {
    // Dates
    localDateStr,
    lastNDays,
    daysBetween,
    isRecent,

    // IDs
    uid,
    exKey,

    // Musculation
    calc1RM,
    calcVol,
    dayVolume,
    weekVolume,
    getDayMuscles,
    shouldOverload,
    isFailure,
    isPlateau,
    suggestedWeight,
    exHistory,
    isPR,
    exProgression,

    // Nutrition
    calcBMI,
    bmiCategory,
    calcBMR,
    calcTDEE,
    calcMacros,
    dailyCalories,

    // Score
    fitnessScore,
    scoreGrade,

    // Stats
    weeklyStats,
    muscleCoverage,
  };

})();
