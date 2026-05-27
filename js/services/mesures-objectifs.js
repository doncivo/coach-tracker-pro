/* ================================================================
   mesures-objectifs.js — Calcul des objectifs corporels
   Formules : Steve Reeves (poignet), taille proportionnelle,
              IMC Lorentz, Navy body fat, ratio taille/hanches
   ================================================================ */

'use strict';

/* ── Calcul objectif pour chaque mensuration ── */
window.calcMesureObjectif = function(key) {
  const H   = S.profilTaille  || 175;
  const P   = S.profilPoignet || 17;
  const sex = S.profilSexe    || 'H';

  // Lorentz ideal weight
  const lorentz = sex === 'H'
    ? Math.round(H - 100 - (H - 150) / 4)
    : Math.round(H - 100 - (H - 150) / 2);

  // IMC 22.5 (milieu zone saine)
  const imcIdeal = Math.round(22.5 * (H / 100) ** 2);

  const targets = {
    poids:    { santé: lorentz,              athlétique: imcIdeal,          direction: 'both', label: 'kg' },
    taille:   { santé: Math.round(H * 0.50), athlétique: Math.round(H * 0.45), direction: 'down', label: 'cm' },
    hanches:  { santé: Math.round(H * 0.54), athlétique: Math.round(H * 0.53), direction: 'both', label: 'cm' },
    poitrine: { santé: Math.round(P * 6.10), athlétique: Math.round(P * 6.50), direction: 'up', label: 'cm' },
    bras:     { santé: Math.round(P * 2.30), athlétique: Math.round(P * 2.52), direction: 'up', label: 'cm' },
    cuisse:   { santé: Math.round(H * 0.28), athlétique: Math.round(H * 0.31), direction: 'up', label: 'cm' },
    cou:      { santé: Math.round(P * 2.30), athlétique: Math.round(P * 2.52), direction: 'up', label: 'cm' },
    mollet:   { santé: Math.round(P * 1.75), athlétique: Math.round(P * 1.92), direction: 'up', label: 'cm' },
  };

  return targets[key] || null;
};

/* ── Estimation date d'atteinte d'un objectif ── */
window.estimateDateObjectif = function(key, target) {
  const entries = (S.mesures[key] || []).slice().sort((a, b) => a.date.localeCompare(b.date));
  if (entries.length < 2) return null;

  // Calcul tendance sur les 3 derniers mois (en cm/mois ou kg/mois)
  const recent = entries.slice(-6);
  const first = parseFloat(recent[0].val || recent[0].value) || 0;
  const last  = parseFloat(recent[recent.length - 1].val || recent[recent.length - 1].value) || 0;
  if (!first || !last) return null;

  const monthsElapsed = (new Date(recent[recent.length-1].date) - new Date(recent[0].date)) / (1000 * 60 * 60 * 24 * 30);
  if (monthsElapsed < 0.5) return null;

  const ratePerMonth = (last - first) / monthsElapsed; // peut être négatif
  if (Math.abs(ratePerMonth) < 0.01) return null;

  const needed = target - last;
  if ((needed > 0 && ratePerMonth <= 0) || (needed < 0 && ratePerMonth >= 0)) {
    return { months: null, message: 'Tendance inverse — ajustez votre programme' };
  }

  const months = Math.ceil(Math.abs(needed / ratePerMonth));
  if (months > 60) return { months: null, message: 'Objectif lointain (> 5 ans au rythme actuel)' };

  const targetDate = new Date();
  targetDate.setMonth(targetDate.getMonth() + months);
  return {
    months,
    date: targetDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
    rate: Math.round(ratePerMonth * 10) / 10,
    message: null,
  };
};

/* ── % Masse grasse (formule Navy) ── */
window.calcBodyFat = function() {
  const sex    = S.profilSexe    || 'H';
  const taille = parseFloat((S.mesures.taille  || []).slice(-1)[0]?.val) || 0; // tour de taille cm
  const cou    = parseFloat((S.mesures.cou     || []).slice(-1)[0]?.val) || 0;
  const hanches= parseFloat((S.mesures.hanches || []).slice(-1)[0]?.val) || 0;
  const H      = S.profilTaille || 175;

  if (!taille || !cou || !H) return null;

  let bf;
  if (sex === 'H') {
    if (taille <= cou) return null;
    bf = 495 / (1.0324 - 0.19077 * Math.log10(taille - cou) + 0.15456 * Math.log10(H)) - 450;
  } else {
    if (!hanches) return null;
    bf = 495 / (1.29579 - 0.35004 * Math.log10(taille + hanches - cou) + 0.22100 * Math.log10(H)) - 450;
  }

  if (isNaN(bf) || bf < 1 || bf > 60) return null;
  return Math.round(bf * 10) / 10;
};

/* ── Ratio taille/hanches ── */
window.calcWHR = function() {
  const taille = parseFloat((S.mesures.taille  || []).slice(-1)[0]?.val) || 0;
  const hanches= parseFloat((S.mesures.hanches || []).slice(-1)[0]?.val) || 0;
  if (!taille || !hanches) return null;
  return { ratio: Math.round(taille / hanches * 100) / 100, risk: taille / hanches };
};

/* ── Description de la catégorie de % MG ── */
window.bodyFatCategory = function(bf, sex) {
  if (sex === 'H') {
    if (bf < 6)  return { label: 'Essentiel',     color: 'var(--orange)' };
    if (bf < 14) return { label: 'Athlete',        color: 'var(--teal)' };
    if (bf < 18) return { label: 'Forme',          color: 'var(--green)' };
    if (bf < 25) return { label: 'Acceptable',     color: 'var(--muted)' };
    return           { label: 'Surpoids',           color: 'var(--red)' };
  } else {
    if (bf < 14) return { label: 'Essentiel',     color: 'var(--orange)' };
    if (bf < 21) return { label: 'Athlete',        color: 'var(--teal)' };
    if (bf < 25) return { label: 'Forme',          color: 'var(--green)' };
    if (bf < 32) return { label: 'Acceptable',     color: 'var(--muted)' };
    return           { label: 'Surpoids',           color: 'var(--red)' };
  }
};
