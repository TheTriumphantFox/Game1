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

// Region progression. `currentRegionIdx` is the index into REGIONS the player
// is currently exploring (0 = forest, 1 = fire, …, 10 = mana). It advances by
// 1 each time the player clears (activates) the current region's village.
// `regionMapsVisited[N]` tracks how many distinct overworld maps the player
// has entered in region N — the 21st new map in any region is its village.
let currentRegionIdx = 0;
let regionMapsVisited = {};

// Legacy alias kept so older save slots that stored `desertsVisited` still
// migrate cleanly. Mirrors regionMapsVisited[1] (the fire region).
let desertsVisited = 0;

const DIR_DELTA = {
  right: { dx:  1, dy:  0 },
  left:  { dx: -1, dy:  0 },
  down:  { dx:  0, dy:  1 },
  up:    { dx:  0, dy: -1 }
};

function gridKey(gx, gy) { return `${gx},${gy}`; }

function currentMap() { return worldMaps[currentMapId]; }
function mapData()    { return currentMap().map; }

// Initialise a fresh world with the starter house at (0, 0). Walking south
// out of the house creates forest [2] as a southern neighbor.
function initWorld() {
  worldMaps = [];
  worldGrid = {};
  mapsVisited = 1;
  desertsVisited = 0;
  currentRegionIdx = 0;
  regionMapsVisited = {};
  for (let i = 0; i < REGIONS.length; i++) regionMapsVisited[i] = 0;
  mapSequence = [0];
  const firstMap = createStarterHouseMap(0, 0, 0);
  firstMap.visited = true;
  worldMaps.push(firstMap);
  worldGrid[gridKey(0, 0)] = 0;
  currentMapId = 0;
  placePlayerInStarterHouse(firstMap);
}

// Stand the player one tile south of the bed, facing south, so spawning reads
// as "just got out of bed." Coordinates mirror the room layout in
// buildStarterHouseMap.
function placePlayerInStarterHouse(houseMap) {
  const HH = 16, HW = 21;
  const r1 = MROWS - 1 - HH;
  const c1 = Math.floor(MCOLS / 2) - Math.floor(HW / 2);
  player.x = c1 + 2;            // aligned with bed column
  player.y = r1 + 4;            // one tile south of the bed's foot
  player.renderX = player.x;
  player.renderY = player.y;
  player.swordDir = { x: 0, y: 1 };  // facing south, toward the door
}

function createStarterHouseMap(id, gx, gy) {
  const mapTiles = buildStarterHouseMap();
  return {
    id, gx, gy,
    name: 'A Quiet Cabin',
    type: 'house', biome: 'forest',
    map: mapTiles,
    enemyDefs: [],        // peaceful start — no enemies inside the house
    openedChests: new Set(),
    visited: false, depth: 0
  };
}

// Pick the right overworld builder for a region. Forest and fire (desert) keep
// their bespoke art; every later region falls back to the generic palette
// builder driven entirely by REGIONS[regionIdx].
function buildOverworldForRegion(regionIdx, seed, depth, openSides) {
  if (regionIdx === 0) return buildForestMap(seed, depth, openSides);
  if (regionIdx === 1) return buildDesertMap(seed, depth, openSides);
  return buildRegionMap(seed, depth, openSides, REGIONS[regionIdx]);
}

// Construct a map for the given region at (gx, gy). When the player has
// already visited 20 maps in `regionIdx`, the next new neighbor becomes the
// region's village (boss arena) instead of another overworld map.
function createOverworldMap(id, gx, gy, regionIdx) {
  const region = REGIONS[regionIdx];
  const visited = regionMapsVisited[regionIdx] || 0;

  if (visited >= 20) {
    // The 21st new area in a region is its village.
    const mapTiles = buildVillageMap(region.id);
    const enemyType = `${region.id}_village`;
    const enemyDefs = makeEnemyDefs(20, enemyType, mapTiles);
    return {
      id, gx, gy,
      name: region.villageName,
      type: 'village', biome: region.id,
      regionIdx,
      map: mapTiles, enemyDefs, openedChests: new Set(),
      visited: false, depth: 20
    };
  }

  const depth = Math.min(visited + 1, 20);
  const namePool = region.names || FOREST_NAMES;
  const name = namePool[Math.floor(Math.random() * namePool.length)] + ` [${depth}]`;
  const mapTiles = buildOverworldForRegion(regionIdx, id, depth);
  const enemyDefs = makeEnemyDefs(depth, region.id, mapTiles);
  return {
    id, gx, gy,
    name, type: region.id, biome: region.id,
    regionIdx,
    map: mapTiles, enemyDefs, openedChests: new Set(),
    visited: false, depth
  };
}

// Back-compat wrappers used by the boot path / older callers.
function createForestMap(id, gx, gy) { return createOverworldMap(id, gx, gy, 0); }
function createDesertMap(id, gx, gy) { return createOverworldMap(id, gx, gy, 1); }

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
// step back out the same way. Tile palette matches the source's region — the
// village's region for village sources, the source's own region otherwise.
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
  // Source's region index — supplied directly on the map when available,
  // otherwise inferred from its biome string with a forest fallback.
  const regionIdx = (typeof src.regionIdx === 'number')
    ? src.regionIdx
    : Math.max(0, REGIONS.findIndex(r => r.id === src.biome));
  const region = REGIONS[regionIdx];
  const mapTiles = buildOverworldForRegion(regionIdx, newId, depth, openSides);
  const enemyDefs = makeEnemyDefs(depth, region.id, mapTiles);
  const name = (region.names[Math.floor(Math.random() * region.names.length)]) + ' (Dead End)';
  // 1-exit dead-ends reward the detour with a Hero's Cache. The map builder
  // already placed a regular CHEST in a clearing and connectivity guarantees
  // it's reachable from the single exit — just upgrade that tile in place.
  // The large chest is 2 tiles wide, so also stamp the right-half extension on
  // the tile to the east when it's passable; if that tile is blocked, try the
  // west side and swap anchor/extension. As a last resort, leave it as a single
  // LARGE_CHEST so the pickup still works.
  const passable = (c, r) =>
    c > 0 && c < MCOLS - 1 && r > 0 && r < MROWS - 1 &&
    !(mapTiles[r][c] === T.TREE || mapTiles[r][c] === T.CACTUS ||
      mapTiles[r][c] === T.WATER || mapTiles[r][c] === T.DEEP_WATER ||
      mapTiles[r][c] === T.ROCK || mapTiles[r][c] === T.WALL ||
      mapTiles[r][c] === T.CHEST || mapTiles[r][c] === T.LARGE_CHEST ||
      mapTiles[r][c] === T.LARGE_CHEST_R || mapTiles[r][c] === T.SHRINE);
  for (let r = 0; r < MROWS; r++) {
    for (let c = 0; c < MCOLS; c++) {
      if (mapTiles[r][c] !== T.CHEST) continue;
      if (passable(c + 1, r)) {
        mapTiles[r][c]     = T.LARGE_CHEST;
        mapTiles[r][c + 1] = T.LARGE_CHEST_R;
      } else if (passable(c - 1, r)) {
        // Re-anchor one tile west so the chest still spans 2 tiles
        mapTiles[r][c - 1] = T.LARGE_CHEST;
        mapTiles[r][c]     = T.LARGE_CHEST_R;
      } else {
        mapTiles[r][c] = T.LARGE_CHEST;
      }
    }
  }
  worldMaps.push({
    id: newId, gx: ngx, gy: ngy, name,
    type: region.id, biome: region.id, regionIdx,
    depth,
    map: mapTiles, enemyDefs, openedChests: new Set(),
    visited: false, sealed: true
  });
  worldGrid[key] = newId;
  return newId;
}

// Called whenever a region's village is cleared. Walks every overworld map in
// `regionIdx` (and that region's village) and seals any remaining unused
// border with a single-transition dead-end. Bounds the region to what the
// player has touched plus a one-tile buffer. The village's exits stay open
// when a *next* region exists, so the player can walk out into it; the final
// region's village also gets its open exits sealed.
function sealRegion(regionIdx) {
  const region = REGIONS[regionIdx];
  if (!region) return;
  const hasNextRegion = regionIdx + 1 < REGIONS.length;
  const snapshot = worldMaps.slice();
  for (const src of snapshot) {
    if (src.regionIdx !== regionIdx) continue;
    // Leave the village's unused exits open so they can connect into the next
    // region as the player walks out (mirrors the forest→fire transition).
    if (src.type === 'village' && hasNextRegion) continue;
    for (const dir of ['left', 'right', 'up', 'down']) {
      const { dx, dy } = DIR_DELTA[dir];
      if (worldGrid[gridKey(src.gx + dx, src.gy + dy)] !== undefined) continue;
      createSealedNeighbor(src.id, dir);
    }
  }
}

// Back-compat: forest-village clear used to call sealUnusedTransitions, fire
// (desert) clear used to call sealDesertRegion. Both now delegate to sealRegion.
function sealUnusedTransitions() { sealRegion(0); }
function sealDesertRegion()      { sealRegion(1); }

// Walking out of an exit. Compute the neighbor's coordinate; if a map already
// exists there, return it. Otherwise create a new one. The target region is:
//   • current map's region when stepping out of an overworld map
//   • current region + 1 when stepping out of an activated village (until the
//     last region, whose village has no successor)
//   • region 0 (forest) when stepping out of the starter house
function getOrCreateNeighbor(direction) {
  const cur = worldMaps[currentMapId];
  const { dx, dy } = DIR_DELTA[direction];
  const ngx = cur.gx + dx, ngy = cur.gy + dy;
  const key = gridKey(ngx, ngy);
  if (worldGrid[key] !== undefined) return worldGrid[key];

  let targetRegionIdx;
  if (cur.type === 'house') {
    targetRegionIdx = 0;                             // step out → forest
  } else if (cur.type === 'village' && cur.activated) {
    targetRegionIdx = Math.min((cur.regionIdx || 0) + 1, REGIONS.length - 1);
  } else if (typeof cur.regionIdx === 'number') {
    targetRegionIdx = cur.regionIdx;                  // continue current region
  } else {
    // Fallback: infer from biome string. Defaults to forest.
    const idx = REGIONS.findIndex(r => r.id === cur.biome);
    targetRegionIdx = idx >= 0 ? idx : 0;
  }

  const newId = worldMaps.length;
  const newMap = createOverworldMap(newId, ngx, ngy, targetRegionIdx);
  worldMaps.push(newMap);
  worldGrid[key] = newId;
  return newId;
}
