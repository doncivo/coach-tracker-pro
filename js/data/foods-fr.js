/* ================================================================
   foods-fr.js — Base alimentaire française (~250 aliments courants)
   Macros pour 100g : cal (kcal), prot (g), carbs (g), fat (g)
   ================================================================ */

const FOODS_FR = [
  // ── VIANDES ──
  {n:'Poulet blanc (cuit)',      cal:165, prot:31,  carbs:0,   fat:3.6},
  {n:'Poulet cuisse (cuit)',     cal:209, prot:26,  carbs:0,   fat:11},
  {n:'Blanc de dinde',           cal:135, prot:29,  carbs:0,   fat:1.5},
  {n:'Steak haché 5%',           cal:121, prot:21,  carbs:0,   fat:4},
  {n:'Steak haché 15%',          cal:215, prot:17,  carbs:0,   fat:16},
  {n:'Filet de bœuf',            cal:158, prot:28,  carbs:0,   fat:4.8},
  {n:'Côte de porc',             cal:200, prot:22,  carbs:0,   fat:12},
  {n:'Filet mignon de porc',     cal:143, prot:22,  carbs:0,   fat:5.5},
  {n:'Jambon blanc (dégraissé)', cal: 97, prot:17,  carbs:1,   fat:2.5},
  {n:'Jambon de Bayonne',        cal:168, prot:28,  carbs:0,   fat:5.5},
  {n:'Saucisse de Francfort',    cal:295, prot:11,  carbs:2,   fat:27},
  {n:'Merguez',                  cal:310, prot:14,  carbs:1,   fat:27},
  {n:'Veau escalope',            cal:130, prot:24,  carbs:0,   fat:3.5},
  {n:'Agneau gigot',             cal:198, prot:24,  carbs:0,   fat:11},
  {n:'Lapin',                    cal:136, prot:21,  carbs:0,   fat:5.5},

  // ── POISSONS & FRUITS DE MER ──
  {n:'Saumon (cuit)',            cal:208, prot:20,  carbs:0,   fat:13},
  {n:'Thon en boîte (au naturel)',cal:116,prot:26,  carbs:0,   fat:1},
  {n:'Cabillaud',                cal: 82, prot:18,  carbs:0,   fat:0.7},
  {n:'Crevettes',                cal: 85, prot:18,  carbs:0.5, fat:0.9},
  {n:'Coquilles Saint-Jacques',  cal: 88, prot:15,  carbs:3.5, fat:1.5},
  {n:'Sardines en boîte',        cal:208, prot:25,  carbs:0,   fat:11},
  {n:'Maquereau',                cal:205, prot:19,  carbs:0,   fat:14},
  {n:'Sole filet',               cal: 80, prot:17,  carbs:0,   fat:1},
  {n:'Colin (merlu)',            cal: 77, prot:17,  carbs:0,   fat:0.8},

  // ── ŒUFS & LAITIERS ──
  {n:'Œuf entier',               cal:143, prot:13,  carbs:0.7, fat:9.5},
  {n:'Blanc d\'œuf',             cal: 52, prot:11,  carbs:0.7, fat:0.2},
  {n:'Lait entier',              cal: 61, prot:3.2, carbs:4.8, fat:3.3},
  {n:'Lait demi-écrémé',         cal: 46, prot:3.2, carbs:4.7, fat:1.5},
  {n:'Lait écrémé',              cal: 35, prot:3.4, carbs:4.9, fat:0.1},
  {n:'Yaourt nature',            cal: 59, prot:3.8, carbs:4.7, fat:1.6},
  {n:'Yaourt grec',              cal: 97, prot:5.7, carbs:3.9, fat:5},
  {n:'Skyr nature',              cal: 63, prot:11,  carbs:3.5, fat:0.2},
  {n:'Fromage blanc 0%',         cal: 45, prot:8,   carbs:4.1, fat:0.1},
  {n:'Fromage blanc 3%',         cal: 60, prot:6.4, carbs:4,   fat:2.5},
  {n:'Cottage cheese',           cal: 98, prot:11,  carbs:3.4, fat:4.3},
  {n:'Emmental',                 cal:382, prot:29,  carbs:0,   fat:29},
  {n:'Comté',                    cal:409, prot:28,  carbs:0,   fat:33},
  {n:'Camembert',                cal:298, prot:19,  carbs:0.5, fat:24},
  {n:'Mozzarella',               cal:280, prot:18,  carbs:2.2, fat:22},
  {n:'Feta',                     cal:264, prot:14,  carbs:4,   fat:21},
  {n:'Parmesan',                 cal:392, prot:36,  carbs:0,   fat:26},
  {n:'Beurre',                   cal:717, prot:0.9, carbs:0.1, fat:80},
  {n:'Crème fraîche épaisse',    cal:292, prot:2.3, carbs:2.7, fat:30},

  // ── CÉRÉALES & FÉCULENTS ──
  {n:'Riz blanc cuit',           cal:130, prot:2.7, carbs:28,  fat:0.3},
  {n:'Riz brun cuit',            cal:111, prot:2.6, carbs:23,  fat:0.9},
  {n:'Pâtes cuites',             cal:131, prot:5,   carbs:25,  fat:1.1},
  {n:'Pâtes complètes cuites',   cal:124, prot:5.4, carbs:23,  fat:1},
  {n:'Quinoa cuit',              cal:120, prot:4.4, carbs:21,  fat:1.9},
  {n:'Flocons d\'avoine',        cal:389, prot:17,  carbs:66,  fat:7},
  {n:'Pain blanc',               cal:265, prot:8.9, carbs:51,  fat:2},
  {n:'Pain complet',             cal:247, prot:9.8, carbs:44,  fat:3},
  {n:'Pain de seigle',           cal:259, prot:8.3, carbs:48,  fat:2.6},
  {n:'Baguette',                 cal:267, prot:8.8, carbs:55,  fat:0.9},
  {n:'Pomme de terre cuite',     cal: 87, prot:1.9, carbs:20,  fat:0.1},
  {n:'Patate douce cuite',       cal: 90, prot:2,   carbs:21,  fat:0.1},
  {n:'Lentilles cuites',         cal:116, prot:9,   carbs:20,  fat:0.4},
  {n:'Pois chiches cuits',       cal:164, prot:8.9, carbs:27,  fat:2.6},
  {n:'Haricots rouges cuits',    cal:127, prot:8.7, carbs:22,  fat:0.5},
  {n:'Farine de blé T55',        cal:361, prot:10,  carbs:76,  fat:1},
  {n:'Semoule cuite',            cal:112, prot:3.8, carbs:23,  fat:0.2},
  {n:'Boulgour cuit',            cal: 83, prot:3.1, carbs:19,  fat:0.2},
  {n:'Maïs en boîte',            cal: 86, prot:3.2, carbs:19,  fat:1.2},
  {n:'Muesli sans sucre',        cal:366, prot:10,  carbs:63,  fat:7},

  // ── LÉGUMES ──
  {n:'Brocoli',                  cal: 34, prot:2.8, carbs:7,   fat:0.4},
  {n:'Épinards',                 cal: 23, prot:2.9, carbs:3.6, fat:0.4},
  {n:'Haricots verts',           cal: 31, prot:1.8, carbs:7,   fat:0.1},
  {n:'Carottes',                 cal: 41, prot:0.9, carbs:10,  fat:0.2},
  {n:'Courgettes',               cal: 17, prot:1.2, carbs:3.1, fat:0.3},
  {n:'Tomates',                  cal: 18, prot:0.9, carbs:3.9, fat:0.2},
  {n:'Concombre',                cal: 12, prot:0.6, carbs:2.2, fat:0.1},
  {n:'Poivron rouge',            cal: 31, prot:1,   carbs:6,   fat:0.3},
  {n:'Champignons',              cal: 22, prot:3.1, carbs:3.3, fat:0.3},
  {n:'Chou-fleur',               cal: 25, prot:1.9, carbs:5,   fat:0.3},
  {n:'Poireau',                  cal: 31, prot:1.5, carbs:7.3, fat:0.3},
  {n:'Oignon',                   cal: 40, prot:1.1, carbs:9.3, fat:0.1},
  {n:'Ail',                      cal:149, prot:6.4, carbs:33,  fat:0.5},
  {n:'Salade verte',             cal: 15, prot:1.4, carbs:2.2, fat:0.2},
  {n:'Avocat',                   cal:160, prot:2,   carbs:9,   fat:15},
  {n:'Artichaut',                cal: 53, prot:2.9, carbs:10,  fat:0.1},
  {n:'Betterave',                cal: 43, prot:1.6, carbs:10,  fat:0.1},
  {n:'Céleri',                   cal: 16, prot:0.7, carbs:3,   fat:0.2},
  {n:'Endive',                   cal: 17, prot:0.9, carbs:3.5, fat:0.1},
  {n:'Petits pois',              cal: 84, prot:5.4, carbs:14,  fat:0.4},
  {n:'Maïs cuit',                cal:108, prot:3.3, carbs:23,  fat:1.4},

  // ── FRUITS ──
  {n:'Banane',                   cal: 89, prot:1.1, carbs:23,  fat:0.3},
  {n:'Pomme',                    cal: 52, prot:0.3, carbs:14,  fat:0.2},
  {n:'Orange',                   cal: 47, prot:0.9, carbs:12,  fat:0.1},
  {n:'Mangue',                   cal: 60, prot:0.8, carbs:15,  fat:0.4},
  {n:'Fraises',                  cal: 32, prot:0.7, carbs:7.7, fat:0.3},
  {n:'Raisin',                   cal: 69, prot:0.7, carbs:18,  fat:0.2},
  {n:'Kiwi',                     cal: 61, prot:1.1, carbs:15,  fat:0.5},
  {n:'Ananas',                   cal: 50, prot:0.5, carbs:13,  fat:0.1},
  {n:'Pastèque',                 cal: 30, prot:0.6, carbs:8,   fat:0.2},
  {n:'Myrtilles',                cal: 57, prot:0.7, carbs:14,  fat:0.3},
  {n:'Poire',                    cal: 57, prot:0.4, carbs:15,  fat:0.1},
  {n:'Pêche',                    cal: 39, prot:0.9, carbs:10,  fat:0.3},
  {n:'Abricot',                  cal: 48, prot:1.4, carbs:11,  fat:0.4},
  {n:'Citron',                   cal: 29, prot:1.1, carbs:9,   fat:0.3},
  {n:'Cerise',                   cal: 50, prot:1,   carbs:12,  fat:0.3},

  // ── PROTÉINES EN POUDRE & SUPPLÉMENTS ──
  {n:'Whey protéine (poudre)',   cal:370, prot:75,  carbs:10,  fat:4},
  {n:'Caséine (poudre)',         cal:350, prot:80,  carbs:4,   fat:2},
  {n:'Protéine végétale (poudre)',cal:365,prot:70,  carbs:12,  fat:5},
  {n:'Créatine (poudre)',        cal:  0, prot:0,   carbs:0,   fat:0},
  {n:'Gaineur (weight gainer)',  cal:393, prot:20,  carbs:72,  fat:3},

  // ── GRAISSES & HUILES ──
  {n:'Huile d\'olive',           cal:884, prot:0,   carbs:0,   fat:100},
  {n:'Huile de coco',            cal:862, prot:0,   carbs:0,   fat:100},
  {n:'Huile de colza',           cal:884, prot:0,   carbs:0,   fat:100},
  {n:'Amandes',                  cal:579, prot:21,  carbs:22,  fat:50},
  {n:'Noix',                     cal:654, prot:15,  carbs:14,  fat:65},
  {n:'Noix de cajou',            cal:553, prot:18,  carbs:30,  fat:44},
  {n:'Arachides (cacahuètes)',   cal:567, prot:26,  carbs:16,  fat:49},
  {n:'Beurre de cacahuète',      cal:588, prot:25,  carbs:20,  fat:50},
  {n:'Graines de chia',          cal:486, prot:17,  carbs:42,  fat:31},
  {n:'Graines de lin',           cal:534, prot:18,  carbs:29,  fat:42},

  // ── SUCRES & SUCRERIES ──
  {n:'Miel',                     cal:304, prot:0.3, carbs:82,  fat:0},
  {n:'Sucre blanc',              cal:387, prot:0,   carbs:100, fat:0},
  {n:'Sucre roux',               cal:380, prot:0,   carbs:95,  fat:0},
  {n:'Chocolat noir 70%',        cal:598, prot:7.8, carbs:46,  fat:43},
  {n:'Chocolat au lait',         cal:535, prot:7.7, carbs:60,  fat:30},
  {n:'Confiture',                cal:250, prot:0.4, carbs:65,  fat:0.1},
  {n:'Nutella',                  cal:539, prot:6,   carbs:58,  fat:31},

  // ── BOISSONS ──
  {n:'Jus d\'orange',            cal: 45, prot:0.7, carbs:10,  fat:0.2},
  {n:'Lait de soja',             cal: 54, prot:3.6, carbs:6.3, fat:1.8},
  {n:'Lait d\'amande',           cal: 24, prot:1.1, carbs:3.1, fat:1.1},
  {n:'Café (sans sucre)',        cal:  2, prot:0.3, carbs:0,   fat:0},
  {n:'Smoothie banane-lait',     cal: 80, prot:2.5, carbs:16,  fat:1},

  // ── PLATS PRÉPARÉS COURANTS ──
  {n:'Soupe de légumes',         cal: 40, prot:1.5, carbs:7,   fat:1},
  {n:'Omelette nature',          cal:154, prot:10,  carbs:0.5, fat:12},
  {n:'Crêpe nature',             cal:188, prot:5.9, carbs:26,  fat:6.7},
  {n:'Pizza margherita',         cal:266, prot:11,  carbs:33,  fat:10},
  {n:'Burger maison',            cal:295, prot:16,  carbs:24,  fat:14},
  {n:'Salade niçoise',           cal:170, prot:11,  carbs:10,  fat:10},
  {n:'Taboulé',                  cal:140, prot:3.5, carbs:24,  fat:4},
  {n:'Sushi (2 pièces)',         cal:120, prot:5,   carbs:18,  fat:3},
];

window.FOODS_FR = FOODS_FR;

/* Recherche dans la base française */
window.searchFoodsFR = function(query) {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,''); // sans accents
  return FOODS_FR.filter(f => {
    const name = f.n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    return name.includes(q);
  }).slice(0, 12);
};
