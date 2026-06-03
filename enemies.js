// ─── Enemy definitions ────────────────────────────────────────────────────────
// Stats based on D&D 5e creatures, scaled lightly for arcade pacing.
// `ranged: true` enemies fire projectiles and try to keep distance.

// `element` (optional) tags the element this enemy's attacks deal. When the
// player wears matching elemental armor, that damage is halved (see
// applyElementalArmor in elements.js). Untagged enemies deal pure physical
// damage that no elemental armor reduces.
const DND_ENEMIES = {
  goblin:    { name: 'Goblin',          hp: 7,   spd: 600,  dmg: 1,  xp: 50,    color: '#558844', size: 0.6,  cr: '1/4' },
  wolf:      { name: 'Wolf',            hp: 11,  spd: 450,  dmg: 2,  xp: 100,   color: '#886644', size: 0.7,  cr: '1/4' },
  skeleton:  { name: 'Skeleton',        hp: 13,  spd: 700,  dmg: 2,  xp: 100,   color: '#ccccaa', size: 0.75, ranged: true, cr: '1/4', element: 'necrotic' },
  zombie:    { name: 'Zombie',          hp: 22,  spd: 900,  dmg: 3,  xp: 100,   color: '#668844', size: 0.8,  cr: '1/4', element: 'poison' },
  cultist:   { name: 'Cultist',         hp: 9,   spd: 600,  dmg: 2,  xp: 100,   color: '#884488', size: 0.75, ranged: true, cr: '1/8', element: 'fire' },
  dryad:     { name: 'Dryad',           hp: 22,  spd: 650,  dmg: 3,  xp: 450,   color: '#44aa44', size: 0.8,  cr: 1, element: 'poison' },
  troll:     { name: 'Troll',           hp: 84,  spd: 800,  dmg: 7,  xp: 1800,  color: '#558833', size: 1.2,  cr: 5, element: 'poison' },
  wyvern:    { name: 'Wyvern',          hp: 110, spd: 550,  dmg: 8,  xp: 3900,  color: '#775522', size: 1.3,  cr: 6, element: 'air' },
  vampire:   { name: 'Vampire Spawn',   hp: 82,  spd: 550,  dmg: 7,  xp: 1800,  color: '#882244', size: 0.9,  cr: 5, element: 'necrotic' },
  wraith:    { name: 'Wraith',          hp: 67,  spd: 600,  dmg: 6,  xp: 1800,  color: '#445566', size: 0.9,  ranged: true, cr: 5, element: 'ice' },
  lich:      { name: 'Lich',            hp: 135, spd: 700,  dmg: 10, xp: 10000, color: '#553388', size: 1.0,  ranged: true, cr: 21, element: 'necrotic' },
  beholder:  { name: 'Beholder',        hp: 180, spd: 700,  dmg: 12, xp: 10000, color: '#446633', size: 1.2,  ranged: true, cr: 13, element: 'luminous' },
  owlbear:   { name: 'Owlbear',         hp: 59,  spd: 550,  dmg: 7,  xp: 1800,  color: '#8a6622', size: 1.1,  cr: 3 },
  treant:    { name: 'Treant',          hp: 138, spd: 1000, dmg: 8,  xp: 3900,  color: '#4a5a2a', size: 1.4,  cr: 9, element: 'water' },
  pixie:     { name: 'Pixie Swarm',     hp: 7,   spd: 400,  dmg: 1,  xp: 50,    color: '#88aaff', size: 0.5,  ranged: true, cr: '1/4', element: 'luminous' },
  displacer: { name: 'Displacer Beast', hp: 85,  spd: 500,  dmg: 7,  xp: 1800,  color: '#554488', size: 1.1,  cr: 3 },
  lich_boss:      { name: 'FOREST LICH',         hp: 350,  spd: 600, dmg: 14, xp: 33000, color: '#6600cc', size: 1.5, ranged: true, boss: true, cr: 'Boss', element: 'necrotic' },
  mummy_lord:     { name: 'MUMMY LORD',          hp: 420,  spd: 650, dmg: 16, xp: 41000, color: '#c89858', size: 1.5, ranged: true, boss: true, cr: 'Boss', element: 'fire' },
  kraken_boss:    { name: 'ABYSSAL KRAKEN',      hp: 500,  spd: 700, dmg: 18, xp: 50000, color: '#2a88cc', size: 1.6, ranged: true, boss: true, cr: 'Boss', element: 'water' },
  frost_titan:    { name: 'FROST TITAN',         hp: 580,  spd: 750, dmg: 20, xp: 60000, color: '#9cdcff', size: 1.7,              boss: true, cr: 'Boss', element: 'ice' },
  gaia_colossus:  { name: 'GAIA COLOSSUS',       hp: 680,  spd: 800, dmg: 22, xp: 72000, color: '#7a6a45', size: 1.8,              boss: true, cr: 'Boss' },
  wind_djinn:     { name: 'STORMCROWN DJINN',    hp: 620,  spd: 500, dmg: 22, xp: 80000, color: '#c8d8f0', size: 1.6, ranged: true, boss: true, cr: 'Boss', element: 'wind' },
  storm_lord:     { name: 'VOLTHEART LORD',      hp: 700,  spd: 550, dmg: 24, xp: 92000, color: '#ffe055', size: 1.7, ranged: true, boss: true, cr: 'Boss' },
  seraph_judge:   { name: 'SERAPH OF JUDGEMENT', hp: 760,  spd: 600, dmg: 24, xp:105000, color: '#fff2a0', size: 1.7, ranged: true, boss: true, cr: 'Boss', element: 'luminous' },
  death_knight:   { name: 'PALE KING',           hp: 860,  spd: 650, dmg: 28, xp:130000, color: '#aa66dd', size: 1.8, ranged: true, boss: true, cr: 'Boss', element: 'necrotic' },
  hydra_queen:    { name: 'HYDRA QUEEN',         hp: 940,  spd: 700, dmg: 28, xp:160000, color: '#88cc44', size: 1.9, ranged: true, boss: true, cr: 'Boss', element: 'poison' },
  archmage_void:  { name: 'VOID ARCHMAGE',       hp:1100,  spd: 600, dmg: 32, xp:220000, color: '#aa66ee', size: 1.9, ranged: true, boss: true, cr: 'Boss' },
};

// Difficulty curve — picks from progressively harder pools as the player
// explores further from the starting map.
const ENEMY_POOLS = [
  ['goblin', 'wolf', 'pixie'],                                              // tier 0: first few maps
  ['goblin', 'wolf', 'skeleton', 'dryad', 'pixie'],                         // tier 1
  ['skeleton', 'zombie', 'cultist', 'dryad', 'owlbear'],                    // tier 2
  ['zombie', 'cultist', 'owlbear', 'troll', 'displacer', 'wraith'],         // tier 3
  ['troll', 'wyvern', 'vampire', 'wraith', 'beholder', 'lich'],             // tier 4
  ['lich', 'beholder', 'treant', 'wyvern', 'vampire'],                      // tier 5: village pool (boss is added by makeEnemyDefs)
];

function getEnemyPool(depth) {
  const tier = Math.min(Math.floor(depth / 4), ENEMY_POOLS.length - 1);
  return ENEMY_POOLS[tier];
}

// Build the list of enemy spawn points for a new map.
// `mapType === 'village'` guarantees the boss spawn.
// `map` is the tile array; enemies will only spawn on non-solid tiles. After
// connectivity enforcement (see connectivity.js), any non-solid tile is also
// reachable from a map exit, so this guarantees no orphaned spawns.
function makeEnemyDefs(depth, mapType, map) {
  // The starter house is a peaceful interior — no spawns.
  if (mapType === 'house') return [];

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
  // Forest overworld enemies stay vulnerable to necrotic damage. Other regions
  // (fire, water, ice, …) don't carry that flag.
  const necroticVuln = mapType === 'forest';
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
        if (necroticVuln) def.necroticVuln = true;
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
        boss: base.boss || false,
        tier15: !!def.tier15,
        necroticVuln: !!def.necroticVuln,
        element: base.element || null,
        timer: Math.random() * base.spd,
        dead: false,
        shootTimer: Math.random() * 1500 + 500
      };
    });
  }
  projectiles = [];
  particles = [];
  drops = [];   // floor pickups are transient per-visit
}
