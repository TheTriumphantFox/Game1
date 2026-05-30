// ─── World coordinate registry ────────────────────────────────────────────────
// Maps live in a spatial grid. Each map has (gx, gy) coordinates and
// worldGrid["gx,gy"] -> mapId. This means a closed loop (right → down → left
// → up) correctly returns the player to the original map instead of generating
// a new one.

let worldMaps = [];      // index = mapId; stores map data, fog, enemyDefs etc.
let worldGrid = {};      // "gx,gy" -> mapId
let currentMapId = 0;
let mapsVisited = 0;     // # of distinct maps the player has entered
let mapSequence = [];    // ordered visit log (for UI / debugging)
let desertsVisited = 0;  // # of distinct desert maps the player has entered

const DIR_DELTA = {
  right: { dx:  1, dy:  0 },
  left:  { dx: -1, dy:  0 },
  down:  { dx:  0, dy:  1 },
  up:    { dx:  0, dy: -1 }
};

function gridKey(gx, gy) { return `${gx},${gy}`; }

function currentMap() { return worldMaps[currentMapId]; }
function mapData()    { return currentMap().map; }

// Initialise a fresh world with one starting map at (0, 0).
function initWorld() {
  worldMaps = [];
  worldGrid = {};
  mapsVisited = 1;
  desertsVisited = 0;
  mapSequence = [0];
  const firstMap = createForestMap(0, 0, 0);
  firstMap.visited = true;
  worldMaps.push(firstMap);
  worldGrid[gridKey(0, 0)] = 0;
  currentMapId = 0;
}

// Construct a map object at the given grid position. Decides forest vs village
// based on the current `mapsVisited` count (forest village is always #21).
function createForestMap(id, gx, gy) {
  const depth = Math.min(mapsVisited, 20);
  const name = depth >= 20
    ? 'Village of the Lost'
    : FOREST_NAMES[Math.floor(Math.random() * FOREST_NAMES.length)] + ` [${mapsVisited + 1}]`;
  const type = depth >= 20 ? 'village' : 'forest';
  const mapTiles = type === 'village' ? buildVillageMap('forest') : buildForestMap(id, depth);
  const enemyDefs = makeEnemyDefs(depth, type, mapTiles);
  return {
    id, gx, gy, name, type, biome: 'forest', map: mapTiles,
    enemyDefs, openedChests: new Set(),
    visited: false, depth
  };
}

// Construct a desert map object. Depth grows with `desertsVisited` so deeper
// reaches pack more cacti / rocks. After 20 desert maps the next new area is
// the desert village (boss arena), mirroring the forest village at #21.
function createDesertMap(id, gx, gy) {
  if (desertsVisited >= 20) {
    const mapTiles = buildDesertVillageMap();
    const enemyDefs = makeEnemyDefs(20, 'desert_village', mapTiles);
    return {
      id, gx, gy, name: 'Oasis of the Damned', type: 'village', biome: 'desert',
      map: mapTiles, enemyDefs, openedChests: new Set(),
      visited: false, depth: 20
    };
  }
  const depth = Math.min(desertsVisited + 1, 20);
  const name = DESERT_NAMES[Math.floor(Math.random() * DESERT_NAMES.length)] + ` [${depth}]`;
  const mapTiles = buildDesertMap(id, depth);
  const enemyDefs = makeEnemyDefs(depth, 'desert', mapTiles);
  return {
    id, gx, gy, name, type: 'desert', biome: 'desert', map: mapTiles,
    enemyDefs, openedChests: new Set(),
    visited: false, depth
  };
}

// Build a one-shot cave map that returns to (returnMapId, returnX, returnY).
// Caves are not part of the (gx, gy) grid — they're only reachable via a
// CAVE_ENTRANCE tile on the source map.
function createCaveMap(returnMapId, returnX, returnY) {
  const newId = worldMaps.length;
  const mapTiles = buildCaveMap();
  const obj = {
    id: newId, gx: 0, gy: 0,
    name: 'Hidden Cave',
    type: 'cave', depth: 0,
    map: mapTiles,
    enemyDefs: [],
    openedChests: new Set(),
    visited: true,
    returnMapId, returnX, returnY,
    // Pre-reveal the small chamber so the player can see what they walked into
    fog: (() => {
      const f = new Uint8Array(MCOLS * MROWS);
      const cx = Math.floor(MCOLS / 2), cy = Math.floor(MROWS / 2);
      for (let r = cy - 12; r <= cy + 12; r++)
        for (let c = cx - 12; c <= cx + 12; c++)
          if (r >= 0 && r < MROWS && c >= 0 && c < MCOLS) f[r * MCOLS + c] = 1;
      return f;
    })()
  };
  worldMaps.push(obj);
  return newId;
}

// Build a dead-end map attached to `sourceId` in `direction`. The only open
// border faces back toward the source map, so the player can step in and must
// step back out the same way. Tile palette matches the source's region: forest
// dead-ends from forest sources, desert dead-ends from desert/village sources.
function createSealedNeighbor(sourceId, direction) {
  const src = worldMaps[sourceId];
  const { dx, dy } = DIR_DELTA[direction];
  const ngx = src.gx + dx, ngy = src.gy + dy;
  const key = gridKey(ngx, ngy);
  if (worldGrid[key] !== undefined) return worldGrid[key];

  const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };
  const openSides = { left: false, right: false, up: false, down: false };
  openSides[OPPOSITE[direction]] = true;

  const newId = worldMaps.length;
  const depth = Math.min(src.depth || 0, 20);
  const isDesert = src.type === 'desert' || src.type === 'village';
  const mapTiles = isDesert
    ? buildDesertMap(newId, depth, openSides)
    : buildForestMap(newId, depth, openSides);
  const region = isDesert ? 'desert' : 'forest';
  const enemyDefs = makeEnemyDefs(depth, region, mapTiles);
  const namePool = isDesert ? DESERT_NAMES : FOREST_NAMES;
  const name = namePool[Math.floor(Math.random() * namePool.length)] + ' (Dead End)';
  // 1-exit dead-ends reward the detour with a Hero's Cache. The map builder
  // already placed a regular CHEST in a clearing and connectivity guarantees
  // it's reachable from the single exit — just upgrade that tile in place.
  for (let r = 0; r < MROWS; r++) {
    for (let c = 0; c < MCOLS; c++) {
      if (mapTiles[r][c] === T.CHEST) { mapTiles[r][c] = T.LARGE_CHEST; }
    }
  }
  worldMaps.push({
    id: newId, gx: ngx, gy: ngy, name, type: region, depth,
    map: mapTiles, enemyDefs, openedChests: new Set(),
    visited: false, sealed: true
  });
  worldGrid[key] = newId;
  return newId;
}

// Called once the village is saved. Walks every forest overworld map and, for
// each cardinal edge that has no neighbor yet, drops in a single-transition
// dead-end forest map. Caves and the village itself are skipped — the village's
// unused exits stay open so the player can walk out into the desert region.
// Snapshot the map list first so the new dead-ends don't themselves get sealed.
function sealUnusedTransitions() {
  const snapshot = worldMaps.slice();
  for (const src of snapshot) {
    if (src.type === 'cave') continue;
    if (src.type === 'village') continue;
    if (src.type === 'desert')  continue;
    for (const dir of ['left', 'right', 'up', 'down']) {
      const { dx, dy } = DIR_DELTA[dir];
      if (worldGrid[gridKey(src.gx + dx, src.gy + dy)] !== undefined) continue;
      createSealedNeighbor(src.id, dir);
    }
  }
}

// Called when the player has visited every desert map (cap = 20). Walks every
// desert overworld map (and the village) and seals any remaining unused edges
// with single-transition desert dead-ends. Bounds the desert just like
// sealUnusedTransitions bounds the forest.
function sealDesertRegion() {
  const snapshot = worldMaps.slice();
  for (const src of snapshot) {
    if (src.type !== 'desert' && src.type !== 'village') continue;
    for (const dir of ['left', 'right', 'up', 'down']) {
      const { dx, dy } = DIR_DELTA[dir];
      if (worldGrid[gridKey(src.gx + dx, src.gy + dy)] !== undefined) continue;
      createSealedNeighbor(src.id, dir);
    }
  }
}

// Walking out of an exit. Compute the neighbor's coordinate; if a map already
// exists there, return it. Otherwise create a new one — desert when leaving an
// active village or another desert tile, forest otherwise.
function getOrCreateNeighbor(direction) {
  const cur = worldMaps[currentMapId];
  const { dx, dy } = DIR_DELTA[direction];
  const ngx = cur.gx + dx, ngy = cur.gy + dy;
  const key = gridKey(ngx, ngy);
  if (worldGrid[key] !== undefined) return worldGrid[key];

  const newId = worldMaps.length;
  // The desert region opens off the forest village and continues through desert
  // tiles. The desert village (biome 'desert') is the end — it leads nowhere new.
  const inDesertRegion = cur.type === 'desert' ||
                         (cur.type === 'village' && cur.biome === 'forest');
  const newMap = inDesertRegion
    ? createDesertMap(newId, ngx, ngy)
    : createForestMap(newId, ngx, ngy);
  worldMaps.push(newMap);
  worldGrid[key] = newId;
  return newId;
}
