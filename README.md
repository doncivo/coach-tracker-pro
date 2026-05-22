# 🏋️ Coach Tracker Pro

Application web de suivi d'entraînement en hypertrophie — **Double fréquence A/B**.

## 🚀 Démo live

👉 **[Ouvrir l'application](https://VOTRE_USERNAME.github.io/coach-tracker-pro)**

> Remplacez `VOTRE_USERNAME` par votre nom d'utilisateur GitHub après le déploiement.

---

## 📱 Fonctionnalités

### Programme
- Planning semaine A/B avec 7 jours configurables
- Périodisation par blocs : Accumulation → Intensification → Réalisation → Deload
- Détection automatique des plateaux (3 semaines sans progression)
- Surcharge progressive automatique (+2.5% si fourchette haute atteinte)
- Séries d'échauffement exclues du volume

### Séance
- Mode séance avec navigation par exercice
- Saisie poids × reps par série avec validation individuelle
- RPE (Rate of Perceived Exertion) et RIR (Reps In Reserve)
- Chrono de repos avec présélections 1'/1'30/2'/3'
- Feedback RPE en temps réel (alerte si trop facile ou trop lourd)
- Détection des PR automatique avec notification
- Mode Focus plein écran

### Progression
- Historique des charges par exercice
- Estimation du 1RM (formule d'Epley)
- Graphiques d'évolution avec prédiction linéaire (+4 et +8 semaines)
- Détection plateau avec suggestions
- Standards de force relatifs au poids de corps

### Corps
- Suivi des mensurations (poids, poitrine, taille, hanches, bras, cuisse)
- Tracker sommeil 7 jours (heures + qualité)
- Tracker nutrition (déficit / maintenance / surplus)
- Journal de douleurs localisées
- Heatmap régularité 90 jours

### KPI Dashboard
- ATL / CTL (charge aiguë vs chronique) avec TSB
- Taux de réussite des répétitions
- % du 1RM par exercice avec zones (hypertrophie / force)
- Ratio Push/Pull, streak, adhérence 4 semaines
- IMC, masse grasse estimée (US Navy), masse maigre

### Objectifs & Badges
- 14 badges débloquables automatiquement
- Objectif daté avec compte à rebours
- Barre de progression vers les objectifs

### Bibliothèque
- 53 exercices avec muscles secondaires, tips, alternatives
- Standards de force par niveau

---

## 📲 Installation en tant qu'app (PWA)

### Sur iPhone / iPad (Safari)
1. Ouvrir l'URL dans Safari
2. Appuyer sur **Partager** (icône carré avec flèche)
3. Sélectionner **"Sur l'écran d'accueil"**
4. L'app s'installe comme une app native

### Sur Android (Chrome)
1. Ouvrir l'URL dans Chrome
2. Appuyer sur les **⋮** (menu)
3. Sélectionner **"Ajouter à l'écran d'accueil"**

---

## 🛠️ Technique

| Aspect | Détail |
|--------|--------|
| **Type** | Single Page App — HTML/CSS/JS vanilla |
| **Dépendances** | Aucune (zéro framework, zéro bibliothèque) |
| **Stockage** | localStorage (données 100% locales) |
| **Taille** | ~250 KB (tout inclus) |
| **PWA** | Service Worker + manifest offline-first |
| **Compatibilité** | Safari iOS 14+, Chrome 90+, Firefox 88+ |
| **Sécurité** | Zéro XSS (DOM sécurisé), zéro appel réseau |

---

## 💾 Sauvegarde & Export

Toutes les données sont stockées localement dans le navigateur.  
Utilisez **Export JSON** (bouton en haut) pour sauvegarder et transférer vos données.

---

## 📖 Utilisation des tests

Ajouter `?test=1` à l'URL pour lancer les 43 tests unitaires intégrés :

```
https://VOTRE_USERNAME.github.io/coach-tracker-pro?test=1
```

---

## 📄 Licence

MIT — Libre d'utilisation, de modification et de distribution.
