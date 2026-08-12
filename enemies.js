// ─── Enemy definitions ────────────────────────────────────────────────────────
// Stats based on D&D 5e creatures, scaled lightly for arcade pacing.
// `ranged: true` enemies fire projectiles and try to keep distance.
// `swims: true` enemies treat the MEDIUM_WATER shelf as open ground (see
// stepEnemies in projectiles.js); everyone else stops at the shallows.

// `element` (optional) tags the element this enemy's attacks deal. When the
// player wears matching elemental armor, that damage is halved (see
// applyElementalArmor in elements.js). It also makes the enemy vulnerable to its
// opposite element — hits have a chance to deal bonus opposite-element damage
// (see OPPOSITE / rollOppositeVuln). Untagged enemies deal pure physical damage
// that no elemental armor reduces and carry no vulnerability.
const DND_ENEMIES = {
  // Regular enemies are grouped into one tier per region (see ENEMY_POOLS and
  // REGIONS.enemyTier). Each region's roster is drawn from D&D 5e Monster Manual
  // creatures chosen to match that region's element, and the bands climb in
  // power from forest (tier 0) up to the arcane mana region (tier 10).

  // ── Tier 0 · Forest — fey, beasts & plants. Gentlest region. ──
  goblin:         { name: 'Goblin',              hp: 7,   spd: 600,  dmg: 1,  xp: 50,    color: '#558844', size: 0.6,  cr: '1/4' },
  wolf:           { name: 'Wolf',                hp: 11,  spd: 450,  dmg: 2,  xp: 100,   color: '#886644', size: 0.7,  cr: '1/4' },
  pixie:          { name: 'Pixie Swarm',         hp: 9,   spd: 400,  dmg: 1,  xp: 50,    color: '#88aaff', size: 0.5,  ranged: true, cr: '1/4', element: 'luminous' },
  dryad:          { name: 'Dryad',               hp: 22,  spd: 650,  dmg: 3,  xp: 450,   color: '#44aa44', size: 0.8,  cr: 1, element: 'poison' },
  giant_spider:   { name: 'Giant Spider',        hp: 24,  spd: 500,  dmg: 3,  xp: 450,   color: '#4a3a55', size: 0.8,  ranged: true, cr: 1, element: 'poison' },
  owlbear:        { name: 'Owlbear',             hp: 28,  spd: 550,  dmg: 3,  xp: 450,   color: '#8a6622', size: 0.95, cr: 3 },

  // ── Prologue only · Hendricks' dog ──
  // Not part of any tier or pool, and never rolled by makeEnemyDefs — the
  // prologue places this one by hand (see spawnPrologueDog in prologue.js) and it
  // is the only creature in Elderbrook. The numbers come from the script rather
  // than from CR math: 3 HP, 1 damage, and the player's punch does 1, so it takes
  // exactly two hits to break its nerve. It cannot be killed (doPunch clamps it
  // at 1 HP and never calls killEnemy) and it awards no XP, because it is a
  // frightened animal in a tutorial, not a kill. `cr` is a flavour tag only and
  // is never read at runtime, so 0 is honest here.
  hendricks_dog:  { name: "Hendricks' Dog",      hp: 3,   spd: 380,  dmg: 1,  xp: 0,     color: '#9a7b46', size: 0.55, cr: 0 },

  // ── Tier 1 · Fire / Desert — flame cultists, hounds & elementals of fire. ──
  cultist:        { name: 'Cultist',             hp: 24,  spd: 600,  dmg: 4,  xp: 200,   color: '#884488', size: 0.75, ranged: true, cr: '1/8', element: 'fire' },
  magma_mephit:   { name: 'Magma Mephit',        hp: 28,  spd: 600,  dmg: 4,  xp: 200,   color: '#cc4422', size: 0.6,  ranged: true, cr: '1/2', element: 'fire' },
  gnoll:          { name: 'Gnoll',               hp: 32,  spd: 550,  dmg: 4,  xp: 200,   color: '#9a7838', size: 0.85, cr: '1/2' },
  hell_hound:     { name: 'Hell Hound',          hp: 45,  spd: 450,  dmg: 5,  xp: 700,   color: '#aa3322', size: 0.85, ranged: true, cr: 3, element: 'fire' },
  giant_scorpion: { name: 'Giant Scorpion',      hp: 50,  spd: 600,  dmg: 5,  xp: 700,   color: '#8a6a2a', size: 0.95, cr: 3, element: 'poison' },
  salamander:     { name: 'Salamander',          hp: 58,  spd: 600,  dmg: 6,  xp: 1100,  color: '#dd5522', size: 1.0,  ranged: true, cr: 5, element: 'fire' },

  // ── Tier 2 · Water — sahuagin, sea hags & elementals of the deep. ──
  sahuagin:       { name: 'Sahuagin',            hp: 34,  spd: 550,  dmg: 4,  xp: 450,   color: '#3a7a6a', size: 0.8,  cr: '1/2', element: 'water', swims: true },
  kuo_toa:        { name: 'Kuo-toa',             hp: 38,  spd: 600,  dmg: 5,  xp: 450,   color: '#5a8a7a', size: 0.8,  ranged: true, cr: '1/4', element: 'water', swims: true },
  hunter_shark:   { name: 'Hunter Shark',        hp: 48,  spd: 450,  dmg: 5,  xp: 700,   color: '#557788', size: 1.0,  cr: 2, swims: true },
  merrow:         { name: 'Merrow',              hp: 56,  spd: 550,  dmg: 6,  xp: 1100,  color: '#3a6a8a', size: 1.05, cr: 2, element: 'water', swims: true },
  sea_hag:        { name: 'Sea Hag',             hp: 64,  spd: 600,  dmg: 6,  xp: 1100,  color: '#4a7a5a', size: 0.85, ranged: true, cr: 2, element: 'poison', swims: true },
  water_elemental:{ name: 'Water Elemental',     hp: 80,  spd: 650,  dmg: 7,  xp: 1800,  color: '#2a88cc', size: 1.25, cr: 5, element: 'water', swims: true },

  // ── Tier 3 · Ice — yetis, winter wolves & frost giants. ──
  ice_mephit:     { name: 'Ice Mephit',          hp: 44,  spd: 600,  dmg: 5,  xp: 700,   color: '#aaddee', size: 0.6,  ranged: true, cr: '1/2', element: 'ice' },
  winter_wolf:    { name: 'Winter Wolf',         hp: 58,  spd: 450,  dmg: 6,  xp: 1100,  color: '#cce6f0', size: 0.95, ranged: true, cr: 3, element: 'ice' },
  yeti:           { name: 'Yeti',                hp: 66,  spd: 550,  dmg: 6,  xp: 1100,  color: '#dde8ee', size: 1.05, cr: 3, element: 'ice' },
  mammoth:        { name: 'Mammoth',             hp: 90,  spd: 700,  dmg: 8,  xp: 2900,  color: '#7a5a3a', size: 1.5,  cr: 6 },
  white_dragon:   { name: 'Young White Dragon',  hp: 96,  spd: 600,  dmg: 8,  xp: 2900,  color: '#bfe6f5', size: 1.35, ranged: true, cr: 6, element: 'ice' },
  frost_giant:    { name: 'Frost Giant',         hp: 105, spd: 700,  dmg: 9,  xp: 2900,  color: '#9cc8e0', size: 1.55, cr: 8, element: 'ice' },

  // ── Tier 4 · Earth — gargoyles, burrowers & stone giants. ──
  gargoyle:       { name: 'Gargoyle',            hp: 64,  spd: 550,  dmg: 6,  xp: 1100,  color: '#777066', size: 0.95, cr: 2, element: 'earth' },
  ankheg:         { name: 'Ankheg',              hp: 72,  spd: 600,  dmg: 7,  xp: 1100,  color: '#6a5a2a', size: 1.05, ranged: true, cr: 2, element: 'poison' },
  displacer:      { name: 'Displacer Beast',     hp: 82,  spd: 500,  dmg: 8,  xp: 1800,  color: '#554488', size: 1.1,  cr: 3 },
  bulette:        { name: 'Bulette',             hp: 96,  spd: 550,  dmg: 8,  xp: 1800,  color: '#5a5048', size: 1.2,  cr: 5 },
  earth_elemental:{ name: 'Earth Elemental',     hp: 108, spd: 700,  dmg: 9,  xp: 1800,  color: '#7a6a45', size: 1.3,  cr: 5, element: 'earth' },
  stone_giant:    { name: 'Stone Giant',         hp: 120, spd: 700,  dmg: 10, xp: 2900,  color: '#8a857a', size: 1.5,  cr: 7, element: 'earth' },

  // ── Tier 5 · Air — harpies, griffons, wyverns & rocs of the high sky. ──
  harpy:          { name: 'Harpy',               hp: 82,  spd: 500,  dmg: 7,  xp: 1800,  color: '#a88a55', size: 0.85, ranged: true, cr: 1, element: 'air' },
  griffon:        { name: 'Griffon',             hp: 90,  spd: 450,  dmg: 8,  xp: 1800,  color: '#b8915a', size: 1.1,  cr: 2 },
  manticore:      { name: 'Manticore',           hp: 98,  spd: 500,  dmg: 8,  xp: 1800,  color: '#9a5a3a', size: 1.1,  ranged: true, cr: 3 },
  air_elemental:  { name: 'Air Elemental',       hp: 115, spd: 400,  dmg: 9,  xp: 2900,  color: '#ccd8e8', size: 1.25, cr: 5, element: 'air' },
  wyvern:         { name: 'Wyvern',              hp: 120, spd: 550,  dmg: 9,  xp: 3900,  color: '#775522', size: 1.3,  ranged: true, cr: 6, element: 'air' },
  roc:            { name: 'Roc',                 hp: 142, spd: 600,  dmg: 11, xp: 5900,  color: '#8a6a4a', size: 1.7,  cr: 11, element: 'air' },

  // ── Tier 6 · Lightning — will-o'-wisps, behir, blue dragons & storm giants. ──
  will_o_wisp:    { name: "Will-o'-Wisp",        hp: 105, spd: 350,  dmg: 9,  xp: 2900,  color: '#ccff66', size: 0.5,  ranged: true, cr: 2, element: 'lightning' },
  blue_wyrmling:  { name: 'Blue Dragon Wyrmling',hp: 118, spd: 550,  dmg: 10, xp: 2900,  color: '#3a7acc', size: 0.95, ranged: true, cr: 3, element: 'lightning' },
  behir:          { name: 'Behir',               hp: 150, spd: 600,  dmg: 12, xp: 5900,  color: '#2a6aaa', size: 1.4,  ranged: true, cr: 11, element: 'lightning' },
  young_blue_dragon:{ name: 'Young Blue Dragon', hp: 162, spd: 600,  dmg: 12, xp: 5900,  color: '#3a88dd', size: 1.4,  ranged: true, cr: 9, element: 'lightning' },
  storm_giant:    { name: 'Storm Giant',         hp: 172, spd: 700,  dmg: 13, xp: 7200,  color: '#88aadd', size: 1.65, ranged: true, cr: 13, element: 'lightning' },

  // ── Tier 7 · Luminous — celestials: couatls, unicorns & angels. ──
  pegasus:        { name: 'Pegasus',             hp: 124, spd: 500,  dmg: 10, xp: 3900,  color: '#eef2ff', size: 1.1,  cr: 2, element: 'luminous' },
  couatl:         { name: 'Couatl',              hp: 132, spd: 500,  dmg: 11, xp: 3900,  color: '#ffcc66', size: 1.0,  ranged: true, cr: 4, element: 'luminous' },
  unicorn:        { name: 'Unicorn',             hp: 142, spd: 450,  dmg: 12, xp: 3900,  color: '#fff0f6', size: 1.1,  cr: 5, element: 'luminous' },
  ki_rin:         { name: 'Ki-rin',              hp: 175, spd: 550,  dmg: 14, xp: 7200,  color: '#ffe89a', size: 1.3,  ranged: true, cr: 12, element: 'luminous' },
  deva:           { name: 'Deva',                hp: 182, spd: 550,  dmg: 14, xp: 7200,  color: '#fff2c0', size: 1.2,  ranged: true, cr: 10, element: 'luminous' },
  planetar:       { name: 'Planetar',            hp: 200, spd: 600,  dmg: 15, xp: 11500, color: '#fffae0', size: 1.4,  ranged: true, cr: 16, element: 'luminous' },

  // ── Tier 8 · Necrotic — the undead: skeletons, wraiths, vampires & liches. ──
  skeleton:       { name: 'Skeleton',            hp: 140, spd: 700,  dmg: 12, xp: 5000,  color: '#ccccaa', size: 0.85, ranged: true, cr: 3, element: 'necrotic' },
  zombie:         { name: 'Zombie',              hp: 150, spd: 900,  dmg: 12, xp: 5000,  color: '#668844', size: 0.9,  cr: 3, element: 'necrotic' },
  ghost:          { name: 'Ghost',               hp: 158, spd: 550,  dmg: 13, xp: 5900,  color: '#c8d8e0', size: 0.95, ranged: true, cr: 4, element: 'necrotic' },
  wraith:         { name: 'Wraith',              hp: 170, spd: 600,  dmg: 14, xp: 7200,  color: '#445566', size: 0.95, ranged: true, cr: 5, element: 'necrotic' },
  vampire:        { name: 'Vampire Spawn',       hp: 182, spd: 550,  dmg: 14, xp: 7200,  color: '#882244', size: 0.95, cr: 5, element: 'necrotic' },
  lich:           { name: 'Lich',                hp: 220, spd: 700,  dmg: 16, xp: 13000, color: '#553388', size: 1.0,  ranged: true, cr: 21, element: 'necrotic' },

  // ── Tier 9 · Poison — toxic mire: crawlers, trolls, treants & venom dragons. ──
  carrion_crawler:{ name: 'Carrion Crawler',     hp: 172, spd: 600,  dmg: 14, xp: 8000,  color: '#9aaa44', size: 1.1,  ranged: true, cr: 2, element: 'poison' },
  troll:          { name: 'Troll',               hp: 185, spd: 800,  dmg: 14, xp: 8000,  color: '#558833', size: 1.2,  cr: 5, element: 'poison' },
  otyugh:         { name: 'Otyugh',              hp: 195, spd: 700,  dmg: 15, xp: 11500, color: '#8a8a4a', size: 1.2,  cr: 5, element: 'poison' },
  treant:         { name: 'Treant',              hp: 205, spd: 1000, dmg: 15, xp: 11500, color: '#4a5a2a', size: 1.4,  cr: 9, element: 'poison' },
  green_dragon:   { name: 'Young Green Dragon',  hp: 240, spd: 600,  dmg: 17, xp: 16000, color: '#3a6a3a', size: 1.45, ranged: true, cr: 8, element: 'poison' },
  purple_worm:    { name: 'Purple Worm',         hp: 290, spd: 750,  dmg: 19, xp: 20000, color: '#7a4a7a', size: 1.8,  cr: 15, element: 'poison' },

  // ── Tier 10 · Mana / Arcane — aberrations & spellcasters. The final region. ──
  nothic:         { name: 'Nothic',              hp: 210, spd: 550,  dmg: 16, xp: 11000, color: '#8a6aaa', size: 0.85, ranged: true, cr: 2, element: 'mana' },
  helmed_horror:  { name: 'Helmed Horror',       hp: 230, spd: 650,  dmg: 17, xp: 11000, color: '#667088', size: 1.0,  cr: 4, element: 'mana' },
  mind_flayer:    { name: 'Mind Flayer',         hp: 245, spd: 600,  dmg: 18, xp: 13000, color: '#7755aa', size: 1.0,  ranged: true, cr: 7, element: 'mana' },
  githyanki:      { name: 'Githyanki Knight',    hp: 258, spd: 550,  dmg: 18, xp: 14000, color: '#cc8844', size: 1.05, cr: 8, element: 'mana' },
  beholder:       { name: 'Beholder',            hp: 280, spd: 700,  dmg: 20, xp: 16000, color: '#aa66aa', size: 1.3,  ranged: true, cr: 13, element: 'mana' },
  rakshasa:       { name: 'Rakshasa',            hp: 295, spd: 550,  dmg: 21, xp: 18000, color: '#aa4444', size: 1.1,  ranged: true, cr: 13, element: 'mana' },

  // ── Tier 5 · Volcanic — magmin, azer, fire snakes & red dragons of the caldera. ──
  magmin:          { name: 'Magmin',             hp: 72,  spd: 600,  dmg: 8,  xp: 1800,  color: '#cc4422', size: 0.7,  cr: 2, element: 'volcanic' },
  fire_snake:      { name: 'Fire Snake',         hp: 80,  spd: 550,  dmg: 8,  xp: 1800,  color: '#dd5522', size: 0.8,  cr: 2, element: 'volcanic' },
  azer:            { name: 'Azer',               hp: 92,  spd: 600,  dmg: 9,  xp: 1800,  color: '#e08030', size: 0.85, cr: 2, element: 'volcanic' },
  red_wyrmling:    { name: 'Red Dragon Wyrmling',hp: 105, spd: 550,  dmg: 10, xp: 2900,  color: '#cc3322', size: 0.95, ranged: true, cr: 4, element: 'volcanic' },
  fire_elemental:  { name: 'Fire Elemental',     hp: 115, spd: 700,  dmg: 10, xp: 2900,  color: '#ff5522', size: 1.25, cr: 5, element: 'volcanic' },
  young_red_dragon:{ name: 'Young Red Dragon',   hp: 128, spd: 600,  dmg: 11, xp: 3900,  color: '#bb2211', size: 1.35, ranged: true, cr: 6, element: 'volcanic' },

  // ── Tier 12 · Shadow — shades, bodaks, nightmares & nightwalkers of the void. ──
  shade:           { name: 'Shade',              hp: 300, spd: 550,  dmg: 22, xp: 18000, color: '#3a2a5a', size: 0.9,  cr: 8,  element: 'shadow' },
  shadow_mastiff:  { name: 'Shadow Mastiff',     hp: 320, spd: 500,  dmg: 23, xp: 18000, color: '#2a2038', size: 1.0,  cr: 9,  element: 'shadow' },
  bodak:           { name: 'Bodak',              hp: 345, spd: 600,  dmg: 25, xp: 20000, color: '#4a3a6a', size: 1.0,  ranged: true, cr: 10, element: 'shadow' },
  nightmare:       { name: 'Nightmare',          hp: 360, spd: 450,  dmg: 26, xp: 20000, color: '#5a3a7a', size: 1.15, cr: 10, element: 'shadow' },
  shadow_demon:    { name: 'Shadow Demon',       hp: 380, spd: 550,  dmg: 28, xp: 24000, color: '#2a1a44', size: 1.05, ranged: true, cr: 12, element: 'shadow' },
  nightwalker:     { name: 'Nightwalker',        hp: 400, spd: 600,  dmg: 30, xp: 30000, color: '#1a0f2e', size: 1.4,  ranged: true, cr: 16, element: 'shadow' },

  lich_boss:      { name: 'FOREST LICH',         hp: 350,  spd: 600, dmg: 14, xp:  2250, color: '#6600cc', size: 1.5, ranged: true, boss: true, cr: 'Boss', element: 'necrotic' },
  mummy_lord:     { name: 'MUMMY LORD',          hp: 420,  spd: 650, dmg: 16, xp:  5500, color: '#c89858', size: 1.5, ranged: true, boss: true, cr: 'Boss', element: 'fire' },
  kraken_boss:    { name: 'ABYSSAL KRAKEN',      hp: 500,  spd: 700, dmg: 18, xp:  9000, color: '#2a88cc', size: 1.6, ranged: true, boss: true, cr: 'Boss', element: 'water', swims: true },
  frost_titan:    { name: 'FROST TITAN',         hp: 580,  spd: 750, dmg: 20, xp: 14500, color: '#9cdcff', size: 1.7,              boss: true, cr: 'Boss', element: 'ice' },
  gaia_colossus:  { name: 'GAIA COLOSSUS',       hp: 680,  spd: 800, dmg: 22, xp: 14500, color: '#7a6a45', size: 1.8,              boss: true, cr: 'Boss' },
  magma_tyrant:   { name: 'MAGMA TYRANT',        hp: 700,  spd: 650, dmg: 22, xp: 20000, color: '#cc3311', size: 1.7, ranged: true, boss: true, cr: 'Boss', element: 'volcanic' },
  wind_djinn:     { name: 'STORMCROWN DJINN',    hp: 620,  spd: 500, dmg: 22, xp: 29500, color: '#c8d8f0', size: 1.6, ranged: true, boss: true, cr: 'Boss', element: 'air' },
  storm_lord:     { name: 'VOLTHEART LORD',      hp: 700,  spd: 550, dmg: 24, xp: 36000, color: '#ffe055', size: 1.7, ranged: true, boss: true, cr: 'Boss' },
  seraph_judge:   { name: 'SERAPH OF JUDGEMENT', hp: 760,  spd: 600, dmg: 24, xp: 57500, color: '#fff2a0', size: 1.7, ranged: true, boss: true, cr: 'Boss', element: 'luminous' },
  death_knight:   { name: 'PALE KING',           hp: 860,  spd: 650, dmg: 28, xp: 65000, color: '#aa66dd', size: 1.8, ranged: true, boss: true, cr: 'Boss', element: 'necrotic' },
  hydra_queen:    { name: 'HYDRA QUEEN',         hp: 940,  spd: 700, dmg: 28, xp:100000, color: '#88cc44', size: 1.9, ranged: true, boss: true, cr: 'Boss', element: 'poison' },
  archmage_void:  { name: 'VOID ARCHMAGE',       hp:1100,  spd: 600, dmg: 32, xp: 90000, color: '#aa66ee', size: 1.9, ranged: true, boss: true, cr: 'Boss' },
  eclipse_sovereign:{ name: 'ECLIPSE SOVEREIGN', hp:1250,  spd: 600, dmg: 34, xp:150000, color: '#1a0f2e', size: 2.0, ranged: true, boss: true, cr: 'Boss', element: 'shadow' },

  // The final boss atop the castle tower — sleeps on its hoard until every
  // region boss guarding the throne hall has fallen. `flies` lets it soar over
  // every solid tile (see stepEnemies); `breath` gives it a wall-crossing
  // fire-breath fan instead of the stock single shot (see stepEnemyRanged).
  adult_red_dragon: { name: 'ADULT RED DRAGON',  hp:2200,  spd: 450, dmg: 40, xp:250000, color: '#aa1100', size: 2.8, ranged: true, boss: true, cr: 'Boss', element: 'fire', flies: true, breath: 'fire', finalBoss: true },
};

// Difficulty curve — one pool per region, in progression order. Each region's
// REGIONS.enemyTier indexes straight into this table (forest = 0 … shadow = 12),
// so every region is its own distinct, progressively harder roster. Villages
// reuse their region's pool as "Greater" (tier-1.5) variants plus the region
// boss — both added by makeEnemyDefs.
const ENEMY_POOLS = [
  ['goblin', 'wolf', 'pixie', 'dryad', 'giant_spider', 'owlbear'],                    //  0 · Forest
  ['cultist', 'magma_mephit', 'gnoll', 'hell_hound', 'giant_scorpion', 'salamander'], //  1 · Fire / Desert
  ['sahuagin', 'kuo_toa', 'hunter_shark', 'merrow', 'sea_hag', 'water_elemental'],    //  2 · Water
  ['ice_mephit', 'winter_wolf', 'yeti', 'mammoth', 'white_dragon', 'frost_giant'],    //  3 · Ice
  ['gargoyle', 'ankheg', 'displacer', 'bulette', 'earth_elemental', 'stone_giant'],   //  4 · Earth
  ['magmin', 'fire_snake', 'azer', 'red_wyrmling', 'fire_elemental', 'young_red_dragon'], //  5 · Volcanic
  ['harpy', 'griffon', 'manticore', 'air_elemental', 'wyvern', 'roc'],                //  6 · Air
  ['will_o_wisp', 'blue_wyrmling', 'behir', 'young_blue_dragon', 'storm_giant'],      //  7 · Lightning
  ['pegasus', 'couatl', 'unicorn', 'ki_rin', 'deva', 'planetar'],                     //  8 · Luminous
  ['skeleton', 'zombie', 'ghost', 'wraith', 'vampire', 'lich'],                       //  9 · Necrotic
  ['carrion_crawler', 'troll', 'otyugh', 'treant', 'green_dragon', 'purple_worm'],    // 10 · Poison
  ['nothic', 'helmed_horror', 'mind_flayer', 'githyanki', 'beholder', 'rakshasa'],    // 11 · Mana / Arcane
  ['shade', 'shadow_mastiff', 'bodak', 'nightmare', 'shadow_demon', 'nightwalker'],   // 12 · Shadow
];

// Build the list of enemy spawn points for a new map.
// `mapType === 'village'` guarantees the boss spawn.
// `map` is the tile array; enemies will only spawn on non-solid tiles. After
// connectivity enforcement (see connectivity.js), any non-solid tile is also
// reachable from a map exit, so this guarantees no orphaned spawns.
function makeEnemyDefs(depth, mapType, map) {
  // The starter house is a peaceful interior — no spawns.
  // Home is peaceful — the lone starter cabin of older saves, and the home
  // village that replaced it. It stays peaceful after it burns, too: the ruin is
  // the player's base for the rest of the game, not a combat map.
  if (mapType === 'house' || mapType === 'homevillage') return [];

  // Whirlpool grottos hold a fixed school of 10 swimmers; `depth` carries the
  // source region's enemy tier (see createWhirlpoolGrottoMap).
  if (mapType === 'whirlpool_grotto') return makeGrottoEnemyDefs(depth, map);

  // Waterfall cave chambers pull a tier-matched cave roster (see
  // createCaveChainMap); `depth` carries the originating region's enemy tier.
  if (mapType === 'cave_chain') return makeCaveEnemyDefs(depth, map);

  // Resolve the region this map belongs to. `mapType` is either a region id
  // ('forest', 'fire', 'water', ...) for overworld maps or `<id>_village` /
  // legacy 'village'/'desert_village' for boss arenas. The REGIONS table from
  // map-gen.js drives pool tier + boss; legacy strings stay supported.
  let regionId = mapType;
  let isVillage = false;
  if (mapType === 'village')           { regionId = 'forest'; isVillage = true; }
  else if (mapType === 'desert_village') { regionId = 'fire'; isVillage = true; }
  else if (mapType && mapType.endsWith('_village')) {
    regionId = mapType.slice(0, -'_village'.length);
    isVillage = true;
  }
  const region = (typeof REGIONS !== 'undefined')
    ? (REGIONS.find(r => r.id === regionId) || REGIONS[0])
    : null;
  const tierIdx = region ? region.enemyTier : 1;
  const pool = ENEMY_POOLS[Math.min(tierIdx, ENEMY_POOLS.length - 1)];
  const tier15 = isVillage;
  // Overworld maps spawn a flat 20 enemies regardless of depth. Villages keep
  // an arena-balanced size (depth-based + boss).
  const baseCount = 4 + Math.floor(depth / 2);
  const count = isVillage ? baseCount : 20;
  const defs = [];
  const spread = 20;        // keep enemies away from map edges
  const MAX_TRIES = 60;     // search budget per spawn

  for (let i = 0; i < count; i++) {
    const type = pool[Math.floor(Math.random() * pool.length)];
    let placed = false;
    for (let t = 0; t < MAX_TRIES; t++) {
      const x = rnd(spread, MCOLS - spread);
      const y = rnd(spread, MROWS - spread);
      if (!map || !isSolid(map, x, y)) {
        const def = { type, x, y };
        if (tier15) def.tier15 = true;
        defs.push(def);
        placed = true;
        break;
      }
    }
    // If we couldn't find an open tile in MAX_TRIES, drop the spawn rather
    // than place it inside a wall. With normal forest density this should
    // basically never happen.
    if (!placed) continue;
  }

  if (isVillage) {
    let bx = Math.floor(MCOLS / 2), by = Math.floor(MROWS / 2) - 10;
    if (map && isSolid(map, bx, by)) {
      // Spiral outward for a passable tile near the intended boss arena.
      outer: for (let radius = 1; radius < 30; radius++) {
        for (let dr = -radius; dr <= radius; dr++) {
          for (let dc = -radius; dc <= radius; dc++) {
            if (Math.abs(dr) !== radius && Math.abs(dc) !== radius) continue;
            const tx = bx + dc, ty = by + dr;
            if (tx >= 0 && ty >= 0 && tx < MCOLS && ty < MROWS && !isSolid(map, tx, ty)) {
              bx = tx; by = ty; break outer;
            }
          }
        }
      }
    }
    const bossType = (region && region.boss) || 'lich_boss';
    defs.push({ type: bossType, x: bx, y: by });
  }
  return defs;
}

// 10 swimming enemies for a whirlpool grotto, banded by the enemy tier of the
// region whose whirlpool swallowed the player. Only the water roster swims,
// so lower-tier regions face its gentler half and higher tiers its meaner
// half. Spawns sit on open medium water inside the 50×50 arena, clear of the
// center (the player surfaces there) and of the solid return vortex.
function makeGrottoEnemyDefs(sourceTier, map) {
  const swimmers = ENEMY_POOLS[2];
  const pool = sourceTier <= 1 ? swimmers.slice(0, 3)
             : sourceTier === 2 ? swimmers
             :                    swimmers.slice(3);
  const cx = Math.floor(MCOLS / 2), cy = Math.floor(MROWS / 2);
  const defs = [];
  for (let i = 0; i < 10; i++) {
    const type = pool[Math.floor(Math.random() * pool.length)];
    for (let t = 0; t < 80; t++) {
      const x = rnd(cx - 23, cx + 23), y = rnd(cy - 23, cy + 23);
      if (map && map[y][x] !== T.MEDIUM_WATER) continue;
      if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) < 7) continue;
      defs.push({ type, x, y });
      break;
    }
  }
  return defs;
}

// ─── Cave rosters ───────────────────────────────────────────────────────────────
// The subset of each region's tier that would believably lair underground —
// warren beasts & spiders, burrowers, oozy crawlers, undead in crypts, underdark
// aberrations. Indexed by enemyTier, parallel to ENEMY_POOLS — one row per region,
// in the same order, and adding a region means adding a row HERE too. When this
// table was short, makeCaveEnemyDefs silently clamped instead of failing: volcanic
// caves drew from the air row and shadow caves from mana, and the row comments read
// correctly the whole time because they name the intended region, not the index.
// A waterfall cave is
// populated from the *originating region's* tier, so reusing existing enemies
// means their art, trophy drops, and (for ranged types) the 50% arrow-bundle
// drop all carry over unchanged — no new enemy art or loot tables required.
const CAVE_POOLS = [
  ['goblin', 'giant_spider', 'wolf'],                                  //  0 Forest — warren beasts
  ['magma_mephit', 'salamander', 'giant_scorpion'],                   //  1 Fire — lava tubes
  ['kuo_toa', 'sahuagin', 'merrow'],                                  //  2 Water — flooded caverns
  ['ice_mephit', 'yeti', 'white_dragon'],                             //  3 Ice — glacier caves
  ['ankheg', 'bulette', 'gargoyle', 'earth_elemental', 'stone_giant'],//  4 Earth — burrows
  ['magmin', 'fire_snake', 'azer', 'red_wyrmling'],                   //  5 Volcanic — magma chambers
  ['harpy', 'manticore'],                                             //  6 Air — cliff caves
  ['will_o_wisp', 'behir', 'blue_wyrmling'],                          //  7 Lightning — deep caverns
  ['couatl', 'deva', 'ki_rin'],                                       //  8 Luminous — crystal grottos
  ['skeleton', 'zombie', 'ghost', 'wraith', 'vampire'],              //  9 Necrotic — crypts
  ['carrion_crawler', 'otyugh', 'troll', 'purple_worm'],             // 10 Poison — fetid tunnels
  ['nothic', 'mind_flayer', 'beholder'],                             // 11 Mana — underdark
  ['shade', 'shadow_mastiff', 'bodak', 'shadow_demon'],              // 12 Shadow — lightless deeps
];

// Build the enemy spawn list for a waterfall cave chamber. `sourceTier` is the
// originating region's enemyTier; spawns land on open CAVE_FLOOR, kept clear of
// the player's landing strip at the bottom and the back feature up top.
function makeCaveEnemyDefs(sourceTier, map) {
  const tier = Math.max(0, Math.min(sourceTier | 0, CAVE_POOLS.length - 1));
  const pool = CAVE_POOLS[tier];
  const cx = Math.floor(MCOLS / 2), cy = Math.floor(MROWS / 2);
  const count = Math.min(20, 10 + tier);   // gentler caves up top, denser deeper
  const defs = [];
  for (let i = 0; i < count; i++) {
    const type = pool[Math.floor(Math.random() * pool.length)];
    for (let t = 0; t < 100; t++) {
      // Spread across the cavern, clear of the edge landings and the heart.
      const x = rnd(16, MCOLS - 16), y = rnd(16, MROWS - 16);
      if (!map || map[y][x] !== T.CAVE_FLOOR) continue;
      if (Math.abs(x - cx) <= 2 && Math.abs(y - cy) <= 2) continue;  // keep the chest/centre clear
      defs.push({ type, x, y });
      break;
    }
  }
  return defs;
}

// ─── Castle tower finale ────────────────────────────────────────────────────────
// The pinnacle throne hall's roster: every region boss, in game order, standing
// guard on a ring around the hall, plus the Adult Red Dragon asleep on its
// hoard (dormant until the last guardian falls — see killEnemy). Bosses keep
// their exact village stats (no tier15 — they're already boss-statted).
function makeTowerFinaleDefs(map) {
  const defs = [];
  const cx = 74, cy = 78;                    // heart of the grand hall
  const radius = 24;
  const snapOpen = (x, y) => {
    if (!map || !isSolid(map, x, y)) return { x, y };
    for (let r = 1; r < 20; r++)
      for (let dr = -r; dr <= r; dr++)
        for (let dc = -r; dc <= r; dc++) {
          if (Math.abs(dr) !== r && Math.abs(dc) !== r) continue;
          const tx = x + dc, ty = y + dr;
          if (tx > 0 && ty > 0 && tx < MCOLS - 1 && ty < MROWS - 1 && !isSolid(map, tx, ty))
            return { x: tx, y: ty };
        }
    return { x, y };
  };
  REGIONS.forEach((region, i) => {
    const ang = -Math.PI / 2 + (i / REGIONS.length) * Math.PI * 2;
    const p = snapOpen(Math.round(cx + Math.cos(ang) * radius),
                       Math.round(cy + Math.sin(ang) * radius));
    defs.push({ type: region.boss, x: p.x, y: p.y });
  });
  // The dragon, coiled on the crest of its gold.
  defs.push({ type: 'adult_red_dragon', x: 74, y: 45, dormant: true, finalBoss: true });
  return defs;
}

// ─── Live enemy state per map ─────────────────────────────────────────────────
// `enemies` is the active list for the current map.
// When the player leaves a map, this list is cloned onto map.savedEnemies so
// returning to that map restores the exact state — dead enemies stay dead,
// wounded ones keep their HP.

let enemies = [];

function saveEnemyStateToMap(mapId) {
  if (worldMaps[mapId]) {
    worldMaps[mapId].savedEnemies = enemies.map(e => ({ ...e }));
  }
}

function spawnEnemiesForMap(mid) {
  const rm = worldMaps[mid];
  if (rm.savedEnemies) {
    // Restoring a previously-visited map
    enemies = rm.savedEnemies.map(e => ({ ...e }));
  } else {
    // First visit — instantiate fresh from defs
    enemies = rm.enemyDefs.map((def, i) => {
      const base = DND_ENEMIES[def.type] || DND_ENEMIES.goblin;
      // A Guild Quarry def (see guild.js) — a boss-flagged elite kept at its base
      // creature's stats & drops. Only hit on the rare never-visited target map;
      // visited maps carry the quarry as a live entry in savedEnemies instead.
      if (def.guild && typeof makeGuildBossEnemy === 'function') {
        const gb = makeGuildBossEnemy(def.type, def.x, def.y, def.guild, i);
        return gb;
      }
      // A guild-bounty elite def (#4/5/6, see guild.js) on a never-visited map.
      if (def.bounty && typeof makeBountyEnemy === 'function') {
        return makeBountyEnemy(def.type, def.x, def.y, def.bountyRegion, def.bounty, i);
      }
      // Village "tier 1.5": double HP/damage/XP and grow 1.5x.
      const hpMul  = def.tier15 ? 2   : 1;
      const dmgMul = def.tier15 ? 2   : 1;
      const xpMul  = def.tier15 ? 2   : 1;
      const sizeMul = def.tier15 ? 1.5 : 1;
      const hp = base.hp * hpMul;
      return {
        id: i, type: def.type, x: def.x, y: def.y,
        hp, maxHp: hp,
        // Global XP rebalance: all enemies award half their D&D-derived value.
        spd: base.spd, dmg: base.dmg * dmgMul, xp: Math.floor(base.xp * xpMul * 0.5),
        color: base.color, size: (base.size || 1) * sizeMul,
        name: def.tier15 ? `Greater ${base.name}` : base.name,
        ranged: base.ranged || false,
        swims: base.swims || false,
        boss: base.boss || false,
        // Final-boss dragon plumbing — must be copied here or a never-visited
        // pinnacle spawned after a reload gets an inert dragon (savedEnemies
        // clones and the JSON save carry these automatically).
        flies: base.flies || false,
        breath: base.breath || null,
        dormant: !!def.dormant,
        finalBoss: !!def.finalBoss || !!base.finalBoss,
        tier15: !!def.tier15,
        element: base.element || null,
        timer: Math.random() * base.spd,
        dead: false,
        shootTimer: Math.random() * 1500 + 500
      };
    });
  }
  // Bring the roster into line with the blight (corruption.js). Both branches
  // above need it and neither can do it for itself: a fresh spawn has never seen
  // the template, and a restored one carries whatever it was saved with, which
  // is wrong the moment the hero cleanses the region and walks back in. Doing it
  // here, once, is also what keeps the template out of the saved shape of an
  // enemy — `corrupted` is a derived field that happens to persist.
  if (typeof syncEnemyListCorruption === 'function') {
    syncEnemyListCorruption(enemies, isMapCorrupted(rm));
  }
  projectiles = [];
  particles = [];
  drops = [];   // floor pickups are transient per-visit
  // The Man-Eater bounty (#5) relocates to whatever region overworld map the hero
  // enters while it lives (see guild.js).
  if (typeof ensureManeaterOnMap === 'function') ensureManeaterOnMap(rm);
}
