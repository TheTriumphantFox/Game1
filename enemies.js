// ─── Enemy definitions ────────────────────────────────────────────────────────
// Stats based on D&D 5e creatures, scaled lightly for arcade pacing.
// `ranged: true` enemies fire projectiles and try to keep distance.
// `swims: true` enemies treat the MEDIUM_WATER shelf as open ground (see
// stepEnemies in projectiles.js); everyone else stops at the shallows.

// `hover` (optional) is how high above the ground this creature rides, in world
// units where 1.0 is one tile edge. It lifts the sprite up the screen and
// tightens its shadow, and that is ALL it does.
//
// It is deliberately not `flies`. Those two words sound like the same idea and
// are not. `flies` means "ignores solid terrain" (stepEnemies, projectiles.js)
// and is on exactly one creature, the final-boss dragon. Reusing it to get a
// harpy off the ground would also let the harpy cross walls and drift off the
// map edge, so altitude is its own field and the two never imply each other.
//
// IT MUST STAY VISUAL. Nothing about damage, targeting, melee reach, arrow
// collision or pathing may read `hover` or `e.z`. The moment altitude gates a
// hit, every hovering enemy becomes unhittable and the whole air region breaks.
// If a later pass wants airborne creatures to be harder to hit, that is a
// gameplay change with its own balance work, not a side effect of this field.
//
// Who gets it: creatures that spend their time in the air rather than merely
// being able to leave the ground. Deliberately excluded, each for a reason:
// the gargoyle perches, the mephits are ground skirmishers here, the undead
// floaters (ghost, wraith, shadow_demon) drift but are drawn standing, and the
// final-boss dragon is left at 0 in this pass because its fight is tuned and
// its sprite is bespoke. Any of them becomes one number when the art wants it.

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
  // Every creature here deals exactly 1 damage. That is deliberate and not a
  // stub: forest is where the player learns to fight, so the roster varies by
  // HP, speed and reach while the cost of a mistake stays flat. Do not 'restore'
  // these to their CR-derived values. Two things are NOT flattened with them —
  // the Village of the Lost's Greater variants still double to 2 (see the tier15
  // multiplier in the spawn loop), and the FOREST LICH keeps its boss damage.
  goblin:         { name: 'Goblin',              hp: 7,   spd: 600,  dmg: 1,  xp: 50,    color: '#558844', size: 0.6,  cr: '1/4' },
  wolf:           { name: 'Wolf',                hp: 11,  spd: 450,  dmg: 1,  xp: 100,   color: '#886644', size: 0.7,  cr: '1/4' },
  pixie:          { name: 'Pixie Swarm',         hp: 9,   spd: 400,  dmg: 1,  xp: 50,    color: '#88aaff', size: 0.5,  ranged: true, cr: '1/4', element: 'luminous', hover: 0.40 },
  dryad:          { name: 'Dryad',               hp: 22,  spd: 650,  dmg: 1,  xp: 450,   color: '#44aa44', size: 0.8,  cr: 1, element: 'poison' },
  giant_spider:   { name: 'Giant Spider',        hp: 24,  spd: 500,  dmg: 1,  xp: 450,   color: '#4a3a55', size: 0.8,  ranged: true, cr: 1, element: 'poison' },
  owlbear:        { name: 'Owlbear',             hp: 28,  spd: 550,  dmg: 1,  xp: 450,   color: '#8a6622', size: 0.95, cr: 3 },

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
  // ── Dormant golems (one per golem region; see GOLEM_REGIONS below). ──
  // Statues until something wakes them. Slow, heavy hitters with more HP than
  // their tier's roster, because a woken golem is a fight the player chose to
  // start — by walking past unarmored or by hitting it — rather than a wandering
  // spawn that found them.
  // The golems are NOT authored here. There is one per region from Fire up, and
  // each one's stats are derived from its own region's roster rather than typed
  // out twelve times — see GOLEM_REGIONS below, which builds them into this
  // object at load time.

  // ── Tier 4 · Earth — gargoyles, burrowers & stone giants. ──
  gargoyle:       { name: 'Gargoyle',            hp: 64,  spd: 550,  dmg: 6,  xp: 1100,  color: '#777066', size: 0.95, cr: 2, element: 'earth' },
  ankheg:         { name: 'Ankheg',              hp: 72,  spd: 600,  dmg: 7,  xp: 1100,  color: '#6a5a2a', size: 1.05, ranged: true, cr: 2, element: 'poison' },
  displacer:      { name: 'Displacer Beast',     hp: 82,  spd: 500,  dmg: 8,  xp: 1800,  color: '#554488', size: 1.1,  cr: 3 },
  bulette:        { name: 'Bulette',             hp: 96,  spd: 550,  dmg: 8,  xp: 1800,  color: '#5a5048', size: 1.2,  cr: 5 },
  earth_elemental:{ name: 'Earth Elemental',     hp: 108, spd: 700,  dmg: 9,  xp: 1800,  color: '#7a6a45', size: 1.3,  cr: 5, element: 'earth' },
  stone_giant:    { name: 'Stone Giant',         hp: 120, spd: 700,  dmg: 10, xp: 2900,  color: '#8a857a', size: 1.5,  cr: 7, element: 'earth' },

  // ── Tier 5 · Air — harpies, griffons, wyverns & rocs of the high sky. ──
  harpy:          { name: 'Harpy',               hp: 82,  spd: 500,  dmg: 7,  xp: 1800,  color: '#a88a55', size: 0.85, ranged: true, cr: 1, element: 'air', hover: 0.30 },
  griffon:        { name: 'Griffon',             hp: 90,  spd: 450,  dmg: 8,  xp: 1800,  color: '#b8915a', size: 1.1,  cr: 2, hover: 0.28 },
  manticore:      { name: 'Manticore',           hp: 98,  spd: 500,  dmg: 8,  xp: 1800,  color: '#9a5a3a', size: 1.1,  ranged: true, cr: 3 },
  air_elemental:  { name: 'Air Elemental',       hp: 115, spd: 400,  dmg: 9,  xp: 2900,  color: '#ccd8e8', size: 1.25, cr: 5, element: 'air', hover: 0.35 },
  wyvern:         { name: 'Wyvern',              hp: 120, spd: 550,  dmg: 9,  xp: 3900,  color: '#775522', size: 1.3,  ranged: true, cr: 6, element: 'air', hover: 0.32 },
  roc:            { name: 'Roc',                 hp: 142, spd: 600,  dmg: 11, xp: 5900,  color: '#8a6a4a', size: 1.7,  cr: 11, element: 'air', hover: 0.40 },

  // ── Tier 6 · Lightning — will-o'-wisps, behir, blue dragons & storm giants. ──
  will_o_wisp:    { name: "Will-o'-Wisp",        hp: 105, spd: 350,  dmg: 9,  xp: 2900,  color: '#ccff66', size: 0.5,  ranged: true, cr: 2, element: 'lightning', hover: 0.50 },
  blue_wyrmling:  { name: 'Blue Dragon Wyrmling',hp: 118, spd: 550,  dmg: 10, xp: 2900,  color: '#3a7acc', size: 0.95, ranged: true, cr: 3, element: 'lightning' },
  behir:          { name: 'Behir',               hp: 150, spd: 600,  dmg: 12, xp: 5900,  color: '#2a6aaa', size: 1.4,  ranged: true, cr: 11, element: 'lightning' },
  young_blue_dragon:{ name: 'Young Blue Dragon', hp: 162, spd: 600,  dmg: 12, xp: 5900,  color: '#3a88dd', size: 1.4,  ranged: true, cr: 9, element: 'lightning' },
  storm_giant:    { name: 'Storm Giant',         hp: 172, spd: 700,  dmg: 13, xp: 7200,  color: '#88aadd', size: 1.65, ranged: true, cr: 13, element: 'lightning' },

  // ── Tier 7 · Luminous — celestials: couatls, unicorns & angels. ──
  pegasus:        { name: 'Pegasus',             hp: 124, spd: 500,  dmg: 10, xp: 3900,  color: '#eef2ff', size: 1.1,  cr: 2, element: 'luminous', hover: 0.26 },
  couatl:         { name: 'Couatl',              hp: 132, spd: 500,  dmg: 11, xp: 3900,  color: '#ffcc66', size: 1.0,  ranged: true, cr: 4, element: 'luminous', hover: 0.34 },
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
  // Rooted, not a wanderer. Low HP for its tier because it cannot chase, cannot
  // dodge and cannot be surprised — its danger is entirely the ground it denies.
  toxic_bloom:    { name: 'Toxic Bloom',         hp: 96,  spd: 9999, dmg: 12, xp: 6000,  color: '#8ab83a', size: 1.15, cr: 4, element: 'poison', rooted: true },

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

// ─── Airborne altitude ────────────────────────────────────────────────────────

// How fast altitude closes on its target, as the fraction of the remaining gap
// covered per 16ms frame. An exponential ease rather than a fixed climb rate, so
// a creature settles into its hover without an arrival corner and a Roc at 0.40
// takes no longer to look settled than a Pegasus at 0.26.
const HOVER_EASE_PER_FRAME = 0.08;

// The altitude this creature is currently heading for.
//
// Reads the type table when the instance has no `hover` of its own, which makes
// this independent of construction order. Guild elites and the Man-Eater bounty
// are injected into `enemies` AFTER spawnEnemiesForMap's defaulting pass (see
// ensureGuildElitesOnMap), so an instance-only lookup would leave a guild-quarry
// harpy sitting on the floor.
//
// A sleeping creature rests on the ground: the dormant dragon is on its hoard,
// not holding a hover in its sleep. It eases back up when it wakes.
function enemyHoverTarget(e) {
  if (e.dead || e.dormant) return 0;
  if (typeof e.hover === 'number') return e.hover;
  const base = DND_ENEMIES[e.type];
  return (base && base.hover) || 0;
}

// Ease one enemy's altitude toward its target. Called every frame from
// stepEnemies, deliberately OUTSIDE that function's step-cadence gate: enemies
// only act every e.spd ms (350 to 1000), so easing inside the gate would make a
// climb stair-step a third of a tile at a time.
//
// Always writes a number, so a record from a save that predates `hover` can
// never leave e.z undefined and turn into NaN the first time the renderer
// multiplies it by TILE_PX.
// `map` is the grid stepEnemies resolved this enemy's movement against, and is
// passed in rather than fetched, so an enemy's standing height can never come
// from a different grid than the one it is walking on.
function stepEnemyHover(e, dt, map) {
  // The surface it is standing on (5d), derived from the tile every frame for
  // the same reason the hero's is: nothing has to remember to update it. Snaps
  // rather than eases, because an enemy steps a whole tile at a time anyway and
  // there is no drop animation on this side yet.
  const _m = map || ((typeof mapData === 'function') ? mapData() : null);
  e.groundZ = _m ? surfaceZ(_m, e.x, e.y) : 0;

  const target = enemyHoverTarget(e);
  const z = e.z || 0;
  if (z === target) { e.z = target; return; }
  const k = Math.min(1, HOVER_EASE_PER_FRAME * (dt / 16));
  const next = z + (target - z) * k;
  // Snap the last sliver so a hovering creature reaches a stable altitude
  // instead of asymptotically approaching it forever, which would keep the
  // shadow's alpha changing in the last decimal place every frame.
  e.z = Math.abs(target - next) < 0.001 ? target : next;
}

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

// ─── Dormant golems ──────────────────────────────────────────────────────────
// One state machine, three regions. Ice, Earth and Volcanic each get a golem
// that stands as a statue until something wakes it, and the region's own armor
// is what lets the hero walk past. Written once here rather than three times,
// because three copies of "wake if the player is close" is how three of them end
// up with different radii.
//
// The rules, as decided:
//
//   • Coming within GOLEM_WAKE_RADIUS without the region's armor wakes it.
//   • Hitting one ALWAYS wakes it, armor or not. Armor protects the careful,
//     not the player who chose to start a fight.
//   • Once awake it stays awake for the visit. Re-equipping the armor mid-fight
//     does not settle it, which stops the wake/sleep cycle being farmable and
//     keeps the state machine to two states.
//
// A dormant golem is SOLID but CLIMBABLE, which is the interesting half. See
// golemStandZ.
// One golem per region from Fire (1) up. FOREST IS DELIBERATELY ABSENT and this
// is the only entry in the table that needs a reason: the rule that makes golems
// legible is "the region's own armor keeps it asleep", and forest is tier 0 and
// has no armor (see ELEMENTAL_ARMOR_ABILITIES, elements.js — it starts at fire).
// A forest golem would either be permanently hostile on approach or need some
// second pacifier invented for it, and either one breaks the sentence. So the
// gentlest region simply has none.
//
// `rgn` is the region's index, and it is written here rather than looked up from
// REGIONS so this file still loads on its own in the headless harnesses.
const GOLEM_REGIONS = {
  fire:      { rgn: 1,  type: 'sandstone_golem', name: 'Sandstone Golem', armor: 'fire',      color: '#c89858' },
  water:     { rgn: 2,  type: 'coral_golem',     name: 'Coral Golem',     armor: 'water',     color: '#e8765a' },
  ice:       { rgn: 3,  type: 'ice_golem',       name: 'Ice Golem',       armor: 'ice',       color: '#a8d8ea' },
  earth:     { rgn: 4,  type: 'stone_golem',     name: 'Stone Golem',     armor: 'earth',     color: '#8a857a' },
  volcanic:  { rgn: 5,  type: 'obsidian_golem',  name: 'Obsidian Golem',  armor: 'volcanic',  color: '#3a2f36' },
  air:       { rgn: 6,  type: 'cloud_golem',     name: 'Cloudstone Golem',armor: 'air',       color: '#bcc8de' },
  lightning: { rgn: 7,  type: 'fulgurite_golem', name: 'Fulgurite Golem', armor: 'lightning', color: '#7ec8ff' },
  luminous:  { rgn: 8,  type: 'lumen_golem',     name: 'Lumen Golem',     armor: 'luminous',  color: '#ffe9a6' },
  necrotic:  { rgn: 9,  type: 'bone_golem',      name: 'Bone Golem',      armor: 'necrotic',  color: '#d8cfb4' },
  poison:    { rgn: 10, type: 'mire_golem',      name: 'Mire Golem',      armor: 'poison',    color: '#7a8a3a' },
  mana:      { rgn: 11, type: 'rune_golem',      name: 'Rune Golem',      armor: 'mana',      color: '#4aa06a' },
  shadow:    { rgn: 12, type: 'umbral_golem',    name: 'Umbral Golem',    armor: 'shadow',    color: '#4a3d63' },
};
const GOLEM_TYPES = new Set(Object.values(GOLEM_REGIONS).map(g => g.type));
const GOLEM_WAKE_RADIUS = 3.5;

// Every golem is measured against the toughest thing in its own region's pool,
// so a golem is always "a little worse than the worst you have already met here"
// and stays that way if a roster is retuned. Twelve hand-typed stat blocks would
// each be one more number to forget.
//
// HP is the only figure that is scaled; damage, XP and CR are taken straight
// from the region's top creature. 1.10 is the ratio the three original golems
// already sat at against their regions (1.05, 1.08, 1.13), so this reproduces
// them within a few points rather than inventing a new curve.
const GOLEM_HP_MUL = 1.10;
const GOLEM_SPD = 780;    // the slowest thing in the game; every roster is 450-800
const GOLEM_SIZE = 3;     // three tiles tall AWAKE. Purely a render scale: nothing
                          // outside the draw code reads `size`, so the hitbox is
                          // one tile like everything else. Asleep it draws as a
                          // one-tile pile instead (drawEnemy, render-enemies.js).

for (const spec of Object.values(GOLEM_REGIONS)) {
  const pool = ENEMY_POOLS[spec.rgn] || [];
  const top = pool.map(k => DND_ENEMIES[k]).reduce((a, b) => (b.hp > a.hp ? b : a));
  DND_ENEMIES[spec.type] = {
    name: spec.name,
    hp: Math.round(top.hp * GOLEM_HP_MUL / 5) * 5,   // to the nearest 5, so the
    spd: GOLEM_SPD,                                  // sheet reads as authored
    dmg: top.dmg,
    xp: top.xp,
    color: spec.color,
    size: GOLEM_SIZE,
    cr: top.cr,
    // A region's element id and its region id are the same string for all twelve
    // of these, which is what makes the armor that answers the golem the armor
    // forged in its region.
    element: Object.keys(GOLEM_REGIONS).find(k => GOLEM_REGIONS[k] === spec),
  };
}

// How high a sleeping golem stands, and it is 0.5 for a precise reason:
// STEP_UP_MAX is 0.5, so exactly this height is the tallest thing an actor can
// step onto WITHOUT a ramp. That makes a dormant golem climbable by anyone, in
// every region, with no new movement rule — it falls straight out of the
// existing step-up maths.
//
// It also composes. A ledge stands at 1.0 and cannot be stepped up from the
// ground, but a golem asleep beside one is a 0.5 step to the golem and another
// 0.5 step to the shelf. Keeping a golem asleep therefore opens routes, which is
// what makes wearing the region's armor change the map and not just the danger.
const GOLEM_STAND_Z = 0.5;

function isGolem(e) { return !!e && GOLEM_TYPES.has(e.type); }

// ─── The obsidian golem's melt ───────────────────────────────────────────────
// Obsidian is the one golem whose two states are more than a pose. Hardened, it
// is the same climbable statue as its Ice and Earth siblings. Woken, it runs
// MOLTEN — and a molten thing in a region that already measures how hot the hero
// is should be measured by it. So an awake obsidian golem is a heat source: it
// feeds the overheat meter (HEAT_REGIONS.volcanic, abilities.js) from wherever
// it is standing, whatever the hero is standing on.
//
// That is what makes it different from a big enemy with a big number. Fighting
// one on cool ground still costs, retreating is a real option, and Volcanic
// armor answers the fight and the region with one decision instead of two.
//
// Contribution falls off linearly with distance and is summed over every molten
// golem in range, then clamped: standing between two is worse than standing
// beside one, but a crowd cannot multiply the meter arbitrarily.
const MOLTEN_HEAT_RADIUS = 4.5;
const MOLTEN_HEAT_PER_SEC = 0.10;   // adjacent to one, at full strength
const MOLTEN_HEAT_MAX = 0.22;       // ceiling however many are crowding in

function isMoltenGolem(e) {
  return !!e && e.type === 'obsidian_golem' && !e.dormant && !e.dead;
}

// Heat per second radiated onto (x, y) by every molten golem in range.
function moltenHeatAt(x, y) {
  if (typeof enemies === 'undefined') return 0;
  let sum = 0;
  for (const e of enemies) {
    if (!isMoltenGolem(e)) continue;
    const d = Math.hypot(e.x - x, e.y - y);
    if (d > MOLTEN_HEAT_RADIUS) continue;
    sum += MOLTEN_HEAT_PER_SEC * (1 - d / MOLTEN_HEAT_RADIUS);
  }
  return Math.min(MOLTEN_HEAT_MAX, sum);
}

// The stand-height contributed by a sleeping golem on this tile, or 0. An AWAKE
// golem contributes nothing — it is walking around, not furniture.
function golemStandZ(c, r) {
  if (typeof enemies === 'undefined') return 0;
  for (const e of enemies) {
    if (e.dead || !e.dormant || !isGolem(e)) continue;
    if (e.x === c && e.y === r) return GOLEM_STAND_Z;
  }
  return 0;
}

// Is there a sleeping golem here? Movement asks, so it can let the hero step ONTO
// one instead of being stopped by it the way an ordinary enemy stops them.
function dormantGolemAt(c, r) {
  if (typeof enemies === 'undefined') return false;
  return enemies.some(e => !e.dead && e.dormant && isGolem(e) && e.x === c && e.y === r);
}

function stepGolems() {
  if (typeof enemies === 'undefined' || typeof player === 'undefined') return;
  const cm = (typeof currentMap === 'function') ? currentMap() : null;
  const spec = cm ? GOLEM_REGIONS[cm.biome] : null;
  const armored = !!(spec && typeof wearingElementalArmor === 'function' &&
                     wearingElementalArmor(spec.armor));
  for (const e of enemies) {
    if (e.dead || !e.dormant || !isGolem(e)) continue;
    // Damage wakes it, whatever the source and whatever the hero is wearing.
    // Read off HP rather than hooked into each of the several places that
    // subtract it — the same reasoning the Emperor's thresholds are watched by,
    // and it cannot be forgotten by a new damage source added later.
    const hurt = e.hp < e.maxHp;
    const near = !armored &&
      Math.hypot(e.x - player.x, e.y - player.y) <= GOLEM_WAKE_RADIUS;
    if (!hurt && !near) continue;
    wakeGolem(e);
  }
}

function wakeGolem(e) {
  e.dormant = false;
  // It was furniture a frame ago and the hero may be standing on top of it. Drop
  // them: the support just stood up. Without this the hero hangs half a tile in
  // the air until their next step recomputes groundZ.
  if (typeof player !== 'undefined' && player.x === e.x && player.y === e.y &&
      typeof startPlayerFall === 'function') {
    startPlayerFall(GOLEM_STAND_Z);
  }
  const sp = (typeof screenPX === 'function') ? screenPX(e.x, e.y) : null;
  if (sp && typeof spawnParticle === 'function') {
    spawnParticle(sp.x, sp.y, '#e8e0d0', 14, 4);
    spawnParticle(sp.x, sp.y, e.color || '#888888', 10, 3);
  }
  if (typeof buzz === 'function') buzz([0, 40, 30, 60]);
  if (typeof showMsg === 'function') {
    const base = (typeof DND_ENEMIES !== 'undefined' && DND_ENEMIES[e.type]) || null;
    const name = base ? base.name : 'golem';
    showMsg(e.type === 'obsidian_golem'
      ? `\u{1F30B} The ${name} cracks open and runs molten!`
      : `\u{1F5FF} The ${name} grinds awake!`, 1800);
  }
  if (typeof minimapDirty !== 'undefined') minimapDirty = true;
}

// ─── The Eclipse Sovereign ───────────────────────────────────────────────────
// The Shadow temple's boss reads the player's mind — which, in a game, means it
// reads their CONTROLS. The frog on the Earth dead-ends has been telling the
// player this since tier 4: "It knows the sword before you swing it… A mind
// can't be hidden. But hands can be taught new habits — change how you hold the
// reins, and the thing wearing your face guesses wrong."
//
// How it works, and the important part is what the baseline is:
//
//   • When the fight starts, the Sovereign SNAPSHOTS the player's current
//     bindings and handedness. Not the game's defaults — whatever the player
//     walked in using. So arriving with an already-custom layout buys nothing,
//     and the fight has to be solved during the fight.
//   • Every gameplay key the player presses is checked against that snapshot.
//     While the snapshot still describes their controls, the read LANDS: the
//     Sovereign blinks clear of the attack before it arrives, and the swing
//     hits the space it just left.
//   • Rebind anything mid-fight and the snapshot is stale. The read FAILS: it
//     commits to a counter for an action the player is no longer taking, blinks
//     the wrong way, and is left staggered and open. That stagger is the damage
//     window, and it is the only reliable one.
//
// Blinking rather than an invulnerability flag is deliberate. It needs no hook
// into any of the several places enemy HP is decremented, and "your sword passes
// through where it was standing" tells the story better than a damage number
// that says 0.
//
// It RE-LEARNS. Left alone on a stable layout it re-snapshots after
// SOVEREIGN_RELEARN_MS and starts reading correctly again, so one trip to the
// Controls window is a reprieve rather than a win and the fight is a rhythm of
// changing the board under it. Set the constant to Infinity for a one-change
// fight; this was a judgement call and it is a one-line change.
const SOVEREIGN_TYPE = 'eclipse_sovereign';
const SOVEREIGN_ENGAGE_RADIUS = 11;
const SOVEREIGN_RELEARN_MS = 14000;
const SOVEREIGN_READ_COOLDOWN_MS = 900;   // between reads, so it is not a strobe
const SOVEREIGN_WHIFF_STAGGER_MS = 1900;  // the opening a failed read leaves
const SOVEREIGN_BLINK_RANGE = 3;
const SOVEREIGN_NUDGE_MS = 22000;   // before it spells the counter out

// The actions worth reading. Menu, minimap and the weapon hotkeys are not
// combat inputs and predicting them would only add noise.
const SOVEREIGN_READ_ACTIONS = ['up', 'down', 'left', 'right', 'melee', 'bow', 'bomb', 'ability'];

let sovereign = null;   // { snapshot, padLeft, learnedAt, readCdMs, blind }

function findSovereign() {
  if (typeof enemies === 'undefined') return null;
  return enemies.find(e => e.type === SOVEREIGN_TYPE && !e.dead && !e.dormant) || null;
}

function snapshotControls() {
  const snap = {};
  if (typeof KEY_ACTIONS !== 'undefined') {
    for (const a of KEY_ACTIONS) snap[a.id] = (typeof keyBinding === 'function') ? keyBinding(a.id) : a.def;
  }
  return snap;
}

function sovereignLearn(now) {
  sovereign.snapshot = snapshotControls();
  sovereign.padLeft = (typeof touchPadOnLeft === 'function') ? touchPadOnLeft() : true;
  sovereign.learnedAt = now;
  sovereign.blind = false;
}

function stepEclipseSovereign(dt) {
  const e = findSovereign();
  if (!e) { sovereign = null; return; }
  const near = Math.hypot(e.x - player.x, e.y - player.y) <= SOVEREIGN_ENGAGE_RADIUS;
  if (!sovereign) {
    if (!near) return;                       // the fight has not started yet
    sovereign = { snapshot: null, padLeft: true, learnedAt: 0, readCdMs: 0, blind: false,
                  openedAt: Date.now(), nudges: 0 };
    sovereignLearn(Date.now());
    // The fight explains itself, to everyone, every time.
    //
    // It used to say less to a hero who had met the Earth frog. That was wrong:
    // the frog is a clue on a sealed dead-end most players never open, and
    // building the explanation around it made a missable NPC into the place the
    // answer lived. Nothing checks for the frog now, and this fight assumes
    // nobody has heard of it.
    if (typeof showMsg === 'function') {
      showMsg('\u{1F311} The Eclipse Sovereign learns your hands — it knows every key you hold.', 2800);
    }
    return;
  }
  if (sovereign.readCdMs > 0) sovereign.readCdMs -= dt;

  // A second, blunter nudge, once, if they are still fighting it on the layout
  // it read at the start. One toast at the top of a boss fight is easy to miss,
  // and this is the only route to the answer that every player is guaranteed to
  // get. Suppressed for anyone who has already changed something or already
  // blinded it — nobody who has worked it out gets nagged about it.
  if (sovereign.nudges === 0 && !sovereign.blind &&
      Date.now() - sovereign.openedAt > SOVEREIGN_NUDGE_MS &&
      !sovereignSnapshotStale()) {
    sovereign.nudges = 1;
    if (typeof showMsg === 'function') {
      showMsg('\u{1F311} It reads the hands you came in with. Change your controls.', 3400);
    }
  }

  // Re-learn. Only while it is NOT blind — being blinded is what buys the player
  // time, and the clock on the new layout starts when it recovers.
  if (sovereign.blind && Date.now() - sovereign.learnedAt >= SOVEREIGN_RELEARN_MS) {
    sovereignLearn(Date.now());
    if (typeof showMsg === 'function') {
      showMsg('\u{1F311} It has learned your new hands.', 2400);
    }
  }
}

// Does the snapshot still describe how this player is playing? Handedness counts
// for the same reason it does everywhere else: on a touch device there are no
// keys to rebind, and moving the controls to the other side of the screen is
// that player's version of the same act.
function sovereignSnapshotStale() {
  if (!sovereign || !sovereign.snapshot) return false;
  const padLeft = (typeof touchPadOnLeft === 'function') ? touchPadOnLeft() : true;
  if (padLeft !== sovereign.padLeft) return true;
  for (const id of SOVEREIGN_READ_ACTIONS) {
    const now = (typeof keyBinding === 'function') ? keyBinding(id) : null;
    if (!sameKey(now, sovereign.snapshot[id])) return true;
  }
  return false;
}

// Called from the keydown handler with the RAW key, before translation — the
// Sovereign reads fingers, not intentions.
function sovereignObserveKey(rawKey) {
  const e = findSovereign();
  if (!e || !sovereign || !sovereign.snapshot) return;
  if (Math.hypot(e.x - player.x, e.y - player.y) > SOVEREIGN_ENGAGE_RADIUS) return;
  if (sovereign.readCdMs > 0) return;
  // "Was this a combat input" comes from the player's CURRENT bindings; only the
  // prediction comes from the snapshot. Asking the snapshot both questions was
  // the first version and it was silently broken: after a rebind the player
  // presses a key the snapshot has never heard of, so the Sovereign observed
  // nothing, never guessed wrong, and could never be punished — the one thing
  // the whole fight is built to make happen.
  let action = null;
  for (const id of SOVEREIGN_READ_ACTIONS) {
    const bound = (typeof keyBinding === 'function') ? keyBinding(id) : null;
    if (bound && sameKey(rawKey, bound)) { action = id; break; }
  }
  if (!action) return;
  sovereign.readCdMs = SOVEREIGN_READ_COOLDOWN_MS;
  if (sovereignSnapshotStale()) sovereignReadFails(e);
  else sovereignReadLands(e);
}

function sovereignReadLands(e) {
  sovereign.blind = false;
  // Step clear of where the blow is about to land. Away from the hero, so the
  // swing closes on empty ground.
  blinkSovereign(e, +1);
  if (typeof showMsg === 'function') showMsg('\u{1F311} It moves before you do.', 1100);
}

function sovereignReadFails(e) {
  if (!sovereign.blind) {
    sovereign.blind = true;
    sovereign.learnedAt = Date.now();     // the re-learn clock starts here
    if (typeof showMsg === 'function') {
      showMsg('\u2728 It guesses wrong — the shadow is open!', 2200);
    }
  }
  // Commits the wrong way: TOWARD the hero, into the attack, and is left reeling.
  blinkSovereign(e, -1);
  e.staggerT = Math.max(e.staggerT || 0, SOVEREIGN_WHIFF_STAGGER_MS);
}

// Step a few tiles along the hero axis. `sign` +1 is away, -1 is toward.
function blinkSovereign(e, sign) {
  const map = (typeof mapData === 'function') ? mapData() : null;
  if (!map) return;
  const dx = e.x - player.x, dy = e.y - player.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  for (let d = SOVEREIGN_BLINK_RANGE; d >= 1; d--) {
    const nx = Math.round(e.x + ux * d * sign);
    const ny = Math.round(e.y + uy * d * sign);
    if (nx < 1 || ny < 1 || nx >= MCOLS - 1 || ny >= MROWS - 1) continue;
    if (isSolid(map, nx, ny)) continue;
    if (nx === player.x && ny === player.y) continue;
    const sp = screenPX(e.x, e.y);
    spawnParticle(sp.x, sp.y, '#5a3f8a', 12, 4);
    e.x = nx; e.y = ny;
    const np = screenPX(nx, ny);
    spawnParticle(np.x, np.y, '#8b5cf6', 12, 4);
    return;
  }
}

// Read by the renderer: the boss is open right now.
function sovereignIsBlind() { return !!(sovereign && sovereign.blind); }

// ─── Skeleton allies ─────────────────────────────────────────────────────────
// Necrotic armor raises the dead to fight beside the hero. The first allied
// units in this game, so a few decisions are load-bearing and are written down
// here rather than discovered later.
//
// They rise ONLY when there is a fight to join, anywhere the armor is worn.
// "In a fight" is defined as a live enemy within SKELETON_MUSTER_RADIUS of the
// hero — proximity, not a damage timer. That matters because this codebase has
// no in-combat concept at all, and inventing one for this would be a subsystem;
// proximity is computable from what already exists and is the same shape the
// golem wake check uses.
//
// Enemies do NOT retarget onto them. Enemy targeting reads the player's position
// in fourteen places and rewriting all of it would risk skeletons pulling so
// much aggro that the player becomes a spectator. Instead they body-block: an
// enemy cannot walk through one, and an enemy that tries to step into a skeleton
// attacks it instead. That gives them a real job — a wall that hits back — for a
// fraction of the cost, and it keeps the hero the thing the horde is coming for.
//
// They do not block the HERO. Being boxed in by your own minions in a corridor
// would be infuriating, and there is no upside to it.
//
// Their kills go through killEnemy (player.js), so XP and drops land exactly as
// if the hero had swung. An armor that quietly cost you progression is an armor
// nobody wears.
const SKELETON_MAX = 3;
const SKELETON_MUSTER_RADIUS = 8;    // a live enemy this close counts as a fight
const SKELETON_SUMMON_MS = 1500;     // they rise one at a time
const SKELETON_LINGER_MS = 4000;     // quiet for this long and they crumble
const SKELETON_DEATH_COOLDOWN_MS = 6000;  // a fallen one is not replaced at once
const SKELETON_HP = 24;
const SKELETON_DAMAGE = 6;
const SKELETON_ATTACK_MS = 900;
const SKELETON_STEP_MS = 260;
const SKELETON_SEEK_RADIUS = 9;

let allies = [];
let skeletonSummonMs = 0;
let skeletonDeathCooldownMs = 0;
let skeletonQuietMs = 0;
let skeletonNextId = 0;

function skeletonAt(c, r) {
  return allies.some(a => !a.dead && a.x === c && a.y === r);
}
function skeletonObjAt(c, r) {
  return allies.find(a => !a.dead && a.x === c && a.y === r) || null;
}

function nearestLiveEnemy(x, y, radius) {
  if (typeof enemies === 'undefined') return null;
  let best = null, bestD = radius;
  for (const e of enemies) {
    if (e.dead || e.dormant) continue;
    const d = Math.hypot(e.x - x, e.y - y);
    if (d <= bestD) { bestD = d; best = e; }
  }
  return best;
}

function stepSkeletons(dt) {
  if (typeof player === 'undefined') return;
  const worn = typeof wearingElementalArmor === 'function' && wearingElementalArmor('necrotic');
  if (!worn) { if (allies.length) crumbleAll(); return; }

  if (skeletonDeathCooldownMs > 0) skeletonDeathCooldownMs -= dt;

  // Is there a fight? Proximity to a live, awake enemy.
  const fighting = !!nearestLiveEnemy(player.x, player.y, SKELETON_MUSTER_RADIUS);
  if (fighting) {
    skeletonQuietMs = 0;
    skeletonSummonMs += dt;
    if (allies.length < SKELETON_MAX && skeletonSummonMs >= SKELETON_SUMMON_MS &&
        skeletonDeathCooldownMs <= 0) {
      skeletonSummonMs = 0;
      raiseSkeleton();
    }
  } else {
    skeletonSummonMs = 0;
    skeletonQuietMs += dt;
    if (allies.length && skeletonQuietMs >= SKELETON_LINGER_MS) crumbleAll();
  }

  for (const a of allies) stepOneSkeleton(a, dt);
  allies = allies.filter(a => !a.dead);
}

// Claw one up out of the ground beside the hero. Any open tile will do — they
// rise from whatever is underfoot rather than needing a grave, because the armor
// works in all thirteen regions and twelve of them have no graves.
function raiseSkeleton() {
  const map = (typeof mapData === 'function') ? mapData() : null;
  if (!map) return;
  for (let rad = 1; rad <= 4; rad++) {
    for (let dr = -rad; dr <= rad; dr++) {
      for (let dc = -rad; dc <= rad; dc++) {
        if (Math.abs(dr) !== rad && Math.abs(dc) !== rad) continue;
        const x = player.x + dc, y = player.y + dr;
        if (x < 1 || y < 1 || x >= MCOLS - 1 || y >= MROWS - 1) continue;
        if (isSolid(map, x, y)) continue;
        if (skeletonAt(x, y)) continue;
        if (typeof enemies !== 'undefined' &&
            enemies.some(e => !e.dead && e.x === x && e.y === y)) continue;
        allies.push({
          id: skeletonNextId++, x, y, renderX: x, renderY: y,
          dir: { x: 0, y: 1 },
          hp: SKELETON_HP, maxHp: SKELETON_HP,
          stepT: 0, attackT: 0, bornAt: Date.now(), dead: false,
        });
        const sp = screenPX(x, y);
        spawnParticle(sp.x, sp.y, '#cfc8b4', 12, 4);
        spawnParticle(sp.x, sp.y, '#7a5f8a', 8, 3);
        return;
      }
    }
  }
}

function stepOneSkeleton(a, dt) {
  if (a.dead) return;
  // Render lerp, same easing every other actor uses.
  a.renderX += (a.x - a.renderX) * Math.min(1, dt / 90);
  a.renderY += (a.y - a.renderY) * Math.min(1, dt / 90);

  if (a.attackT > 0) a.attackT -= dt;
  a.stepT += dt;

  const target = nearestLiveEnemy(a.x, a.y, SKELETON_SEEK_RADIUS);
  if (!target) return;

  const dx = target.x - a.x, dy = target.y - a.y;
  a.dir = Math.abs(dx) >= Math.abs(dy)
    ? { x: Math.sign(dx) || 0, y: 0 } : { x: 0, y: Math.sign(dy) || 0 };

  // Adjacent: swing.
  if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
    if (a.attackT > 0) return;
    a.attackT = SKELETON_ATTACK_MS;
    target.hp -= SKELETON_DAMAGE;
    const tp = screenPX(target.x, target.y);
    spawnParticle(tp.x, tp.y, '#cfc8b4', 5, 2);
    if (typeof damageNumbers !== 'undefined') {
      damageNumbers.push({ entity: target, val: SKELETON_DAMAGE, color: '#cfc8b4',
        life: 900, rise: 0 });
    }
    // Through killEnemy so XP, drops, the kill sound and every other death
    // consequence are identical to the hero landing the blow.
    if (target.hp <= 0 && typeof killEnemy === 'function') killEnemy(target);
    return;
  }

  // Otherwise close the distance, on its own cadence.
  if (a.stepT < SKELETON_STEP_MS) return;
  a.stepT = 0;
  const map = (typeof mapData === 'function') ? mapData() : null;
  if (!map) return;
  const tryStep = (mx, my) => {
    const nx = a.x + mx, ny = a.y + my;
    if (nx < 1 || ny < 1 || nx >= MCOLS - 1 || ny >= MROWS - 1) return false;
    if (isSolid(map, nx, ny)) return false;
    if (stepUpBlocked(map, a.x, a.y, nx, ny)) return false;
    if (skeletonAt(nx, ny)) return false;
    if (typeof enemies !== 'undefined' &&
        enemies.some(e => !e.dead && e.x === nx && e.y === ny)) return false;
    a.x = nx; a.y = ny;
    return true;
  };
  if (!tryStep(a.dir.x, a.dir.y)) {
    // Slide along the other axis rather than grinding against a wall.
    tryStep(Math.sign(dx) && !a.dir.x ? Math.sign(dx) : 0,
            Math.sign(dy) && !a.dir.y ? Math.sign(dy) : 0);
  }
}

// Damage from an enemy. Returns true if the hit was taken by a skeleton, so the
// caller knows not to also apply it elsewhere.
function damageSkeletonAt(c, r, dmg) {
  const a = skeletonObjAt(c, r);
  if (!a) return false;
  a.hp -= dmg;
  const sp = screenPX(a.x, a.y);
  spawnParticle(sp.x, sp.y, '#cfc8b4', 6, 3);
  if (a.hp <= 0) fellSkeleton(a);
  return true;
}

function fellSkeleton(a) {
  a.dead = true;
  const sp = screenPX(a.x, a.y);
  spawnParticle(sp.x, sp.y, '#cfc8b4', 14, 4);
  spawnParticle(sp.x, sp.y, '#5a4a6a', 8, 3);
  // The cooldown the design asks for: a fallen skeleton is not replaced at once,
  // so losing one costs something and a wall of them cannot be maintained for
  // free through a long fight.
  skeletonDeathCooldownMs = SKELETON_DEATH_COOLDOWN_MS;
  skeletonSummonMs = 0;
}

function crumbleAll() {
  for (const a of allies) {
    if (a.dead) continue;
    const sp = screenPX(a.x, a.y);
    spawnParticle(sp.x, sp.y, '#cfc8b4', 8, 3);
  }
  allies = [];
  skeletonSummonMs = 0;
  skeletonQuietMs = 0;
}

// ─── Toxic blooms ────────────────────────────────────────────────────────────
// A rooted plant that breathes a mushroom cloud of spores over the ground around
// it on a slow clock. It never moves and never chases, so it is not a fight so
// much as a piece of terrain that hits back: the danger is the ground it denies,
// and walking wide of one costs nothing but distance.
//
// Poison armor is complete immunity to the cloud rather than a reduction. That
// matches how the other regional armors answer their own region — Necrotic
// stops the cursed drain dead, Volcanic removes overheat — and it is separate
// from the -50% elemental block that any Poison armor already gives. The block
// is defence; this is the region's key.
//
// The cloud is TELEGRAPHED. It swells for BLOOM_SWELL_MS before it bursts, and
// the swell is drawn, so being caught is a decision to stand still rather than
// something that happens to a player with no warning. A rooted enemy that hits
// an area with no tell would be unreadable.
const BLOOM_PULSE_MS = 3200;      // between bursts
const BLOOM_SWELL_MS = 900;       // visible wind-up before each one
const BLOOM_RADIUS = 2.6;
const BLOOM_DAMAGE = 6;

function isBloom(e) { return !!e && e.type === 'toxic_bloom' && !e.dead; }

// 0 when idle, ramping to 1 at the instant of the burst. Read by the renderer
// so the swell the player sees is the same number the damage fires on.
function bloomSwell(e) {
  if (!isBloom(e)) return 0;
  const t = e.bloomT || 0;
  if (t < BLOOM_PULSE_MS - BLOOM_SWELL_MS) return 0;
  return (t - (BLOOM_PULSE_MS - BLOOM_SWELL_MS)) / BLOOM_SWELL_MS;
}

function stepToxicBlooms(dt) {
  if (typeof enemies === 'undefined' || typeof player === 'undefined') return;
  const immune = typeof wearingElementalArmor === 'function' &&
                 wearingElementalArmor('poison');
  for (const e of enemies) {
    if (!isBloom(e)) continue;
    e.bloomT = (e.bloomT || 0) + dt;
    if (e.bloomT < BLOOM_PULSE_MS) continue;
    e.bloomT = 0;
    burstBloom(e, immune);
  }
}

function burstBloom(e, immune) {
  const sp = (typeof screenPX === 'function') ? screenPX(e.x, e.y) : null;
  if (sp && typeof spawnParticle === 'function') {
    spawnParticle(sp.x, sp.y, '#8ab83a', 16, 5);
    spawnParticle(sp.x, sp.y, '#c8e08a', 10, 3);
  }
  if (immune) return;                       // the armor is the answer to this
  if (Math.hypot(e.x - player.x, e.y - player.y) > BLOOM_RADIUS) return;
  if (player.invincible > 0) return;
  if (typeof damagePlayer === 'function') damagePlayer(BLOOM_DAMAGE, 'poison');
  player.invincible = 900;
  if (typeof buzz === 'function') buzz([0, 30, 20, 40]);
  if (typeof showMsg === 'function') showMsg('\u2620 Spores burst around you!', 1400);
  if (player.hp <= 0 && typeof respawn === 'function') respawn();
}

// Blooms are placed like the golems and for the same reason: they are rooted, so
// where they stand IS the mechanic. Never on T.PATH, so a road never runs
// through a cloud, and spread out so they deny several separate pockets rather
// than one large one.
const BLOOM_COUNT_MIN = 4, BLOOM_COUNT_MAX = 7, BLOOM_MIN_APART = 9;

function makeBloomDefs(regionId, map) {
  if (regionId !== 'poison' || !map) return [];
  const defs = [];
  const want = rnd(BLOOM_COUNT_MIN, BLOOM_COUNT_MAX);
  for (let i = 0; i < want; i++) {
    for (let t = 0; t < 80; t++) {
      const x = rnd(12, MCOLS - 13), y = rnd(12, MROWS - 13);
      if (isSolid(map, x, y)) continue;
      if (map[y][x] === T.PATH) continue;
      if (defs.some(d => Math.hypot(d.x - x, d.y - y) < BLOOM_MIN_APART)) continue;
      defs.push({ type: 'toxic_bloom', x, y });
      break;
    }
  }
  return defs;
}

// Stand a few sleeping golems on a map, as landmarks rather than as roster
// spawns. Deliberately placed like the hazard blots are: never on T.PATH, so a
// road never runs into one, and spread apart so they read as scattered ancient
// statues rather than as a nest.
//
// They cannot wall a route off even so — a dormant golem is climbable, and a
// woken one walks away — so this is about how they READ, not about connectivity.
// 1d6 - 2, floored at 0. Rolling a 1 or a 2 means this map has no golem on it at
// all, which is a third of maps and is the point: a hazard you meet on every
// single map is scenery, and one you meet on two maps in three is a thing that
// happens to you.
const GOLEM_MIN_APART = 12;

function golemCount() { return Math.max(0, rnd(1, 6) - 2); }

// How far a golem has to sit from the nearest road, and it is derived rather
// than picked: GOLEM_WAKE_RADIUS is 3.5, so anything beyond that cannot be woken
// by someone who stays on the path. 5 leaves a tile and a half of margin for a
// hero who steps off the verge without meaning to commit.
//
// "Road" means T.PATH and nothing else. The corridors the connectivity pass
// carves are laid as PATHTILE, which is T.PATH on twelve of the thirteen
// regions, so they are covered by the same test.
//
// THE WATER REGION IS THE EXCEPTION AND THE RULE IS VACUOUS THERE. It overrides
// `path` to T.SAND (regions.js), which is also its `ground`, so a water map
// contains no T.PATH tile at all — measured: 0 across 40 generated maps — and
// its road is not a distinguishable thing to stand on in the first place. Golems
// there place freely on the sand. That is the honest outcome rather than a gap:
// there is no "stay on the road" promise to keep where the road and the beach
// are the same tile. If the water region ever gets a real corridor tile, this
// test has to learn about it.
const GOLEM_ROAD_CLEAR = 5;

// Golem piles are drawn to blend into the region (see drawEnemy), and three
// regions scatter cuttable rubble that they will read as: Stones in the water
// region, Bones in the desert, Bone Piles in the wastes. A sword swing clears a
// 3x3 of foliage, so a hero harvesting a rubble tile two clear of a pile can
// never catch it — and damage wakes a golem whatever it is wearing.
// Built on call rather than at module scope on purpose: nothing else in this
// file touches T at load time, which is what lets the headless harnesses load it
// on its own to read DND_ENEMIES without dragging config.js in behind it.
const GOLEM_RUBBLE_CLEAR = 2;
function golemRubbleTiles() {
  return [T.STONES, T.BONES, T.BONE_PILE].filter(t => t !== undefined);
}

// Mark every cell within `radius` of any tile in `tiles` as unusable.
//
// One pass over the map per clearance instead of a box scan per candidate. That
// is not premature: see makeGolemDefs for the measurement that made it
// necessary.
function golemBlockOut(map, blocked, tiles, radius) {
  const rr = radius * radius;
  for (let r = 0; r < MROWS; r++) {
    for (let c = 0; c < MCOLS; c++) {
      if (!tiles.includes(map[r][c])) continue;
      for (let dy = -radius; dy <= radius; dy++) {
        const y = r + dy;
        if (y < 0 || y >= MROWS) continue;
        for (let dx = -radius; dx <= radius; dx++) {
          const x = c + dx;
          if (x < 0 || x >= MCOLS) continue;
          if (dx * dx + dy * dy <= rr) blocked[y * MCOLS + x] = 1;
        }
      }
    }
  }
}

function makeGolemDefs(regionId, map) {
  const spec = GOLEM_REGIONS[regionId];
  if (!spec || !map) return [];
  const want = golemCount();
  if (!want) return [];

  // The legal ground is built ONCE and drawn from, rather than guessed at with
  // rejection sampling, and that is a measured decision rather than a tidiness
  // one. Sampling 240 candidate tiles per golem still lost 47% of the shadow
  // region's rolls and 39% of lightning's: both regions are dense enough that
  // open ground which is also 5 clear of a road is rare, and random darts miss
  // it. Averaged over 480 maps the world was getting 1.49 golems a map against
  // the 1.667 the die asks for, and the shortfall was landing on two regions.
  //
  // Building the set means a map places exactly what it rolled whenever it has
  // anywhere at all to put it, in every region. It is also the same shape of fix
  // the gas vents needed when their spacing was measured (mapgen-biomes.js).
  const blocked = new Uint8Array(MROWS * MCOLS);
  golemBlockOut(map, blocked, [T.PATH], GOLEM_ROAD_CLEAR);
  golemBlockOut(map, blocked, golemRubbleTiles(), GOLEM_RUBBLE_CLEAR);

  const legal = [];
  for (let y = 14; y <= MROWS - 15; y++) {
    for (let x = 14; x <= MCOLS - 15; x++) {
      if (blocked[y * MCOLS + x]) continue;
      if (isSolid(map, x, y)) continue;
      legal.push(y * MCOLS + x);
    }
  }

  const defs = [];
  const apart = GOLEM_MIN_APART * GOLEM_MIN_APART;
  for (let i = 0; i < want && legal.length; i++) {
    const at = rnd(0, legal.length - 1);
    const cell = legal[at];
    const x = cell % MCOLS, y = (cell - x) / MCOLS;
    defs.push({ type: spec.type, x, y, dormant: true });
    // Spacing is enforced by shrinking the pool rather than by re-rolling, so
    // the next pick cannot fail on it either.
    for (let k = legal.length - 1; k >= 0; k--) {
      const o = legal[k], ox = o % MCOLS, oy = (o - ox) / MCOLS;
      if ((ox - x) * (ox - x) + (oy - y) * (oy - y) < apart) legal.splice(k, 1);
    }
  }
  return defs;
}

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
  // Sleeping golems stand on the OPEN region maps only. A boss village is an
  // arena and does not want statues in it.
  if (!isVillage && region) {
    defs.push(...makeGolemDefs(region.id, map));
    defs.push(...makeBloomDefs(region.id, map));
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
//
// The world does NOT remember its dead. Walk off an overworld map, a cave, a
// dungeon, a grotto, a sky cave or a shrine and its roster is forgotten outright;
// walk back in and every enemy is spawned again from the map's `enemyDefs`, at
// full HP. Clearing ground is a thing you do for the moment, not for good.
//
// The exception is the arenas, where "cleared" is a piece of progression rather
// than a lull: a village (its boss gates the King's Hoard, the gates opening and
// the village activating) and the castle tower's fourteen floors (each a boss
// climb, and the pinnacle's dragon ends the game). Those clone the live list onto
// `map.savedEnemies` on the way out and restore it exactly on the way back —
// dead enemies stay dead, wounded ones keep their HP.
const MAP_TYPES_REMEMBER_ENEMIES = new Set(['village', 'homevillage', 'castle_tower']);

function mapRemembersEnemies(mapObj) {
  return !!mapObj && MAP_TYPES_REMEMBER_ENEMIES.has(mapObj.type);
}

let enemies = [];

function saveEnemyStateToMap(mapId) {
  const rm = worldMaps[mapId];
  if (!rm) return;
  // Everything else drops its roster on the floor here rather than keeping a list
  // that spawnEnemiesForMap would only throw away — one place decides, and the
  // saved shape of a forgetful map stays empty instead of stale.
  rm.savedEnemies = mapRemembersEnemies(rm) ? enemies.map(e => ({ ...e })) : null;
}

function spawnEnemiesForMap(mid) {
  const rm = worldMaps[mid];
  if (rm.savedEnemies) {
    // An arena that remembers being cleared, or the mid-fight roster a save
    // restored for the map the hero was standing on (see applyLoadData).
    enemies = rm.savedEnemies.map(e => ({ ...e }));
  } else {
    // First visit, or any re-entry to a map that doesn't remember — instantiate
    // fresh from defs.
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
        // Rooted enemies never take a step (see the AI loop in projectiles.js).
        // bloomT is the toxic bloom's own pulse clock, staggered on spawn so a
        // field of them breathes out of sync instead of detonating in unison.
        rooted: base.rooted || false,
        bloomT: Math.random() * BLOOM_PULSE_MS,
        swims: base.swims || false,
        boss: base.boss || false,
        // Final-boss dragon plumbing — must be copied here or a never-visited
        // pinnacle spawned after a reload gets an inert dragon (savedEnemies
        // clones and the JSON save carry these automatically).
        flies: base.flies || false,
        // Altitude. `hover` is the height it rides at, `z` is where it is right
        // now; a spawn starts on the ground and eases up, so a Roc drops into
        // the map rather than blinking into existence a third of a tile up.
        hover: base.hover || 0,
        z: 0,
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
  // Same reasoning, for altitude. The savedEnemies branch above spreads its
  // records verbatim, so a roster saved before `hover` existed carries neither
  // field and no Object.assign anywhere covers it. Normalising both here, after
  // both branches, is what keeps the saved shape of an enemy stable from now on.
  // stepEnemyHover is written to tolerate their absence anyway, so this is about
  // the shape on disk rather than about avoiding a crash.
  for (const e of enemies) {
    if (typeof e.hover !== 'number') {
      const base = DND_ENEMIES[e.type];
      e.hover = (base && base.hover) || 0;
    }
    if (typeof e.z !== 'number') e.z = 0;
  }
  projectiles = [];
  particles = [];
  drops = [];   // floor pickups are transient per-visit
  // Damage numbers were missing from this list. They hold a live `entity` reference
  // (projectiles.js) and draw at that entity's tile, so one spawned just before a
  // transition kept floating over the NEW map at the old enemy's coordinates for the
  // remainder of its ~1.1s life.
  damageNumbers = [];
  // Guild elites are injected after generation and so are absent from enemyDefs —
  // a regenerated roster has to be restocked with them from their quest records,
  // or stepping off the map would delete the hero's quarry (see guild.js).
  if (typeof ensureGuildElitesOnMap === 'function') ensureGuildElitesOnMap(rm);
  // The Man-Eater bounty (#5) relocates to whatever region overworld map the hero
  // enters while it lives (see guild.js).
  if (typeof ensureManeaterOnMap === 'function') ensureManeaterOnMap(rm);
}
