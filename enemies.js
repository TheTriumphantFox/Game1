// ─── Enemy definitions ────────────────────────────────────────────────────────
// Stats based on D&D 5e creatures, scaled lightly for arcade pacing.
// `ranged: true` enemies fire projectiles and try to keep distance.

const DND_ENEMIES = {
  goblin:    { name: 'Goblin',          hp: 7,   spd: 600,  dmg: 1,  xp: 50,    color: '#558844', size: 0.6,  cr: '1/4' },
  wolf:      { name: 'Wolf',            hp: 11,  spd: 450,  dmg: 2,  xp: 100,   color: '#886644', size: 0.7,  cr: '1/4' },
  skeleton:  { name: 'Skeleton',        hp: 13,  spd: 700,  dmg: 2,  xp: 100,   color: '#ccccaa', size: 0.75, ranged: true, cr: '1/4' },
  zombie:    { name: 'Zombie',          hp: 22,  spd: 900,  dmg: 3,  xp: 100,   color: '#668844', size: 0.8,  cr: '1/4' },
  cultist:   { name: 'Cultist',         hp: 9,   spd: 600,  dmg: 2,  xp: 100,   color: '#884488', size: 0.75, ranged: true, cr: '1/8' },
  dryad:     { name: 'Dryad',           hp: 22,  spd: 650,  dmg: 3,  xp: 450,   color: '#44aa44', size: 0.8,  cr: 1 },
  troll:     { name: 'Troll',           hp: 84,  spd: 800,  dmg: 7,  xp: 1800,  color: '#558833', size: 1.2,  cr: 5 },
  wyvern:    { name: 'Wyvern',          hp: 110, spd: 550,  dmg: 8,  xp: 3900,  color: '#775522', size: 1.3,  cr: 6 },
  vampire:   { name: 'Vampire Spawn',   hp: 82,  spd: 550,  dmg: 7,  xp: 1800,  color: '#882244', size: 0.9,  cr: 5 },
  wraith:    { name: 'Wraith',          hp: 67,  spd: 600,  dmg: 6,  xp: 1800,  color: '#445566', size: 0.9,  ranged: true, cr: 5 },
  lich:      { name: 'Lich',            hp: 135, spd: 700,  dmg: 10, xp: 10000, color: '#553388', size: 1.0,  ranged: true, cr: 21 },
  beholder:  { name: 'Beholder',        hp: 180, spd: 700,  dmg: 12, xp: 10000, color: '#446633', size: 1.2,  ranged: true, cr: 13 },
  owlbear:   { name: 'Owlbear',         hp: 59,  spd: 550,  dmg: 7,  xp: 1800,  color: '#8a6622', size: 1.1,  cr: 3 },
  treant:    { name: 'Treant',          hp: 138, spd: 1000, dmg: 8,  xp: 3900,  color: '#4a5a2a', size: 1.4,  cr: 9 },
  pixie:     { name: 'Pixie Swarm',     hp: 7,   spd: 400,  dmg: 1,  xp: 50,    color: '#88aaff', size: 0.5,  ranged: true, cr: '1/4' },
  displacer: { name: 'Displacer Beast', hp: 85,  spd: 500,  dmg: 7,  xp: 1800,  color: '#554488', size: 1.1,  cr: 3 },
  lich_boss: { name: 'FOREST LICH',     hp: 350, spd: 600,  dmg: 14, xp: 33000, color: '#6600cc', size: 1.5,  ranged: true, boss: true, cr: 'Boss' },
};

// Difficulty curve — picks from progressively harder pools as the player
// explores further from the starting map.
const ENEMY_POOLS = [
  ['goblin', 'wolf', 'pixie'],                                              // tier 0: first few maps
  ['goblin', 'wolf', 'skeleton', 'dryad', 'pixie'],                         // tier 1
  ['skeleton', 'zombie', 'cultist', 'dryad', 'owlbear'],                    // tier 2
  ['zombie', 'cultist', 'owlbear', 'troll', 'displacer', 'wraith'],         // tier 3
  ['troll', 'wyvern', 'vampire', 'wraith', 'beholder', 'lich'],             // tier 4
  ['lich', 'beholder', 'treant', 'wyvern', 'lich_boss'],                    // tier 5: village
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
  const pool = getEnemyPool(depth);
  // Forest maps spawn a flat 20 enemies regardless of depth. The village
  // keeps its arena-balanced size (depth-based + boss).
  const baseCount = 4 + Math.floor(depth / 2);
  const count = mapType === 'village' ? baseCount : 20;
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
        defs.push({ type, x, y });
        placed = true;
        break;
      }
    }
    // If we couldn't find an open tile in MAX_TRIES, drop the spawn rather
    // than place it inside a wall. With normal forest density this should
    // basically never happen.
    if (!placed) continue;
  }

  if (mapType === 'village') {
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
    defs.push({ type: 'lich_boss', x: bx, y: by });
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
      return {
        id: i, type: def.type, x: def.x, y: def.y,
        hp: base.hp, maxHp: base.hp,
        spd: base.spd, dmg: base.dmg, xp: base.xp,
        color: base.color, size: base.size || 1,
        name: base.name, ranged: base.ranged || false,
        boss: base.boss || false,
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
