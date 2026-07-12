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

const OPPOSITE_DIR = { left: 'right', right: 'left', up: 'down', down: 'up' };

// Is the exit gate on `side` of this map walkable — i.e. a real transition?
// Mirrors the overworld border-gap test (a carved PATH gate at the edge mid).
function mapEdgeOpen(mapObj, side) {
  if (!mapObj || !mapObj.map) return false;
  const m = mapObj.map;
  if (side === 'left')  return !isSolid(m, 0, EXIT_ROW);
  if (side === 'right') return !isSolid(m, MCOLS - 1, EXIT_ROW);
  if (side === 'up')    return !isSolid(m, EXIT_COL, 0);
  return !isSolid(m, EXIT_COL, MROWS - 1);   // down
}

// Given the open sides a new map at (gx, gy) wants, seal any side facing an
// already-existing neighbor that has NO transition back toward this map. This
// keeps shared borders consistent: a freshly generated map never opens a one-way
// doorway into an existing map that can't return the favor (which previously
// stranded the hero on a solid tile). Empty neighbor cells are left as requested
// — they'll reciprocate this map's opening when they're generated later.
function reconcileOpenSides(gx, gy, baseOpen) {
  const open = { ...baseOpen };
  for (const dir of ['left', 'right', 'up', 'down']) {
    const nId = worldGrid[gridKey(gx + DIR_DELTA[dir].dx, gy + DIR_DELTA[dir].dy)];
    if (nId !== undefined && !mapEdgeOpen(worldMaps[nId], OPPOSITE_DIR[dir])) {
      open[dir] = false;   // neighbor doesn't lead back here → don't open toward it
    }
  }
  return open;
}

function currentMap() { return worldMaps[currentMapId]; }
function mapData()    { return currentMap().map; }

// The tile a destroyed object (cut foliage, bombed rock) should leave behind:
// the current map's natural ground, never a hardcoded grass. Caves and grottos
// expose bare stone, so they revert to CAVE_FLOOR; every region overworld map
// and village uses its own region ground (grass in forest, sand in desert/water,
// snow in ice, …) resolved from the map's biome.
function mapGroundTile() {
  const cm = currentMap();
  if (!cm) return T.GRASS;
  if (cm.type === 'cave' || cm.type === 'cave_chain') return T.CAVE_FLOOR;
  return regionById(cm.biome).ground;
}

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
  // Open every side that isn't blocked by an existing, non-reciprocating
  // neighbor, so we never create a one-way transition into a sealed map.
  const openSides = reconcileOpenSides(gx, gy, { left: true, right: true, up: true, down: true });
  const mapTiles = buildOverworldForRegion(regionIdx, id, depth, openSides);
  const enemyDefs = makeEnemyDefs(depth, region.id, mapTiles);
  return {
    id, gx, gy,
    name, type: region.id, biome: region.id,
    regionIdx,
    map: mapTiles, enemyDefs, openedChests: new Set(),
    visited: false, depth
  };
}

// Find an existing village map for `regionIdx`, or -1 if none has been built.
function findRegionVillageId(regionIdx) {
  for (let i = 0; i < worldMaps.length; i++) {
    const m = worldMaps[i];
    if (m && m.type === 'village' && m.regionIdx === regionIdx) return i;
  }
  return -1;
}

// DEV fast-travel: return the village id for `regionIdx` as an ACTIVE (cleared)
// village — building it on demand if the player hasn't reached that region yet,
// then activating it so it is monster-free and carries a portal. Demand-built
// villages live off the walkable (gx, gy) grid (not registered in worldGrid) so
// they only exist as portal destinations and never interfere with overworld
// neighbor generation.
function getOrCreateActiveRegionVillage(regionIdx) {
  let id = findRegionVillageId(regionIdx);
  if (id < 0) {
    const region = REGIONS[regionIdx];
    if (!region) return -1;
    id = worldMaps.length;
    const mapTiles = buildVillageMap(region.id);
    worldMaps.push({
      id, gx: 10000 + regionIdx, gy: 10000,   // off-grid; not in worldGrid
      name: region.villageName,
      type: 'village', biome: region.id, regionIdx,
      map: mapTiles, enemyDefs: makeEnemyDefs(20, `${region.id}_village`, mapTiles),
      openedChests: new Set(),
      visited: true, depth: 20, devSpawned: true
    });
  }
  const obj = worldMaps[id];
  // Dev: force-clear the village so it has a portal and no monsters.
  if (!obj.activated) activateVillage(obj);
  obj.savedEnemies = [];   // monster-free on (re)entry
  return id;
}

// ─── Waterfall cave chain ──────────────────────────────────────────────────────
// Build one level of a hidden cave chain reached through a WATERFALL_DOOR. Chains
// live off the (gx, gy) grid — reachable only by stepping behind the falls, then
// descending through CAVE_DESCENT tiles. Each level's CAVE_EXIT returns to
// (returnMapId, returnX, returnY): the overworld door for level 1, the previous
// level's descent tile thereafter. `sourceTier` (the originating region's
// enemyTier) bands the cave roster and is stored as `depth` so save-load can
// regenerate matching enemies. `chainDepth`/`chainLen` track position in the
// 1d6-long chain; the final level holds the large chest instead of a way deeper.
function createCaveChainMap(returnMapId, returnX, returnY, sourceTier, chainDepth, chainLen) {
  const newId = worldMaps.length;
  const isFinal = chainDepth >= chainLen;
  const built = buildCaveLevelMap(isFinal);
  const obj = {
    id: newId, gx: 0, gy: 0,
    name: isFinal ? 'Cave — The Deep Hollow' : `Hidden Cave (${chainDepth}/${chainLen})`,
    type: 'cave_chain', depth: sourceTier,
    sourceTier, chainDepth, chainLen,
    map: built.map,
    // Inner landing tiles beside this level's two transitions: `entryLand` is
    // beside the CAVE_EXIT (where you arrive descending into this level);
    // `deeperLand` is beside the CAVE_DESCENT (where you arrive climbing back up
    // from below). `deeperLand` is null on the final level (no way deeper).
    entryLand: built.entryLand,
    deeperLand: built.deeperLand,
    enemyDefs: makeCaveEnemyDefs(sourceTier, built.map),
    openedChests: new Set(),
    visited: true,
    returnMapId, returnX, returnY
    // Fog is created lazily — a full-sized cave is explored, not pre-revealed.
  };
  worldMaps.push(obj);
  return newId;
}

// ─── Sky caves (air / lightning) ───────────────────────────────────────────────
// The cloud regions float above the world, so they hold no buried caves. Instead
// a WIND_GUST updraft out on the overworld cloud floor lifts the hero UP into a
// hidden sky cave — the same chained-labyrinth structure as a waterfall cave, but
// built from the region's OWN cloud tiles (see buildSkyCaveLevelMap) and stocked
// with the region's OWN enemy roster. Like caves, sky caves live off the (gx, gy)
// grid — reachable only through their gust, then climbing SKY_ASCENT gusts higher.
// Each level's SKY_EXIT returns to (returnMapId, returnX, returnY): the overworld
// gust for level 1, the previous level's ascent gust thereafter. `chainDepth` /
// `chainLen` track position in the 1d6-long chain; the final level holds the large
// chest instead of a way higher.
const SKY_CAVE_NAMES = { air: 'Cloud Hollow', lightning: 'Storm Hollow' };
function createSkyCaveMap(returnMapId, returnX, returnY, regionIdx, chainDepth, chainLen) {
  const newId = worldMaps.length;
  const region = REGIONS[regionIdx];
  const isFinal = chainDepth >= chainLen;
  const built = buildSkyCaveLevelMap(isFinal, region);
  const label = SKY_CAVE_NAMES[region.id] || 'Sky Hollow';
  const obj = {
    id: newId, gx: 0, gy: 0,
    name: isFinal ? `${label} — The High Reach` : `${label} (${chainDepth}/${chainLen})`,
    type: 'sky_cave', biome: region.id, regionIdx,
    depth: region.enemyTier, sourceTier: region.enemyTier,
    chainDepth, chainLen,
    map: built.map,
    // Inner landing tiles beside this level's two gusts (see createCaveChainMap):
    // `entryLand` is beside the SKY_EXIT (where the updraft sets you down arriving),
    // `deeperLand` beside the SKY_ASCENT (where you land dropping back from higher).
    entryLand: built.entryLand,
    deeperLand: built.deeperLand,
    // Region's own roster — the sky cave is "made of the region's enemies".
    enemyDefs: makeEnemyDefs(20, region.id, built.map),
    openedChests: new Set(),
    visited: true,
    returnMapId, returnX, returnY
    // Fog is created lazily — a full-sized sky cave is explored, not pre-revealed.
  };
  worldMaps.push(obj);
  return newId;
}

// Build the sunken arena reached by diving into a WHIRLPOOL: a 50×50 sheet of
// open medium water set in impassable deep water, with the return vortex east
// of center. The player surfaces at the exact center of the pool.
const GROTTO_HALF = 25;   // 50×50 arena
function buildWhirlpoolGrottoMap() {
  const m = makeTile(MROWS, MCOLS, T.DEEP_WATER);
  const cx = Math.floor(MCOLS / 2), cy = Math.floor(MROWS / 2);
  setRect(m, cy - GROTTO_HALF, cx - GROTTO_HALF,
             cy + GROTTO_HALF - 1, cx + GROTTO_HALF - 1, T.MEDIUM_WATER);
  // The way back out — far enough from the center spawn that the player isn't
  // grabbed again before getting their bearings.
  m[cy][cx + 15] = T.WHIRLPOOL;
  return m;
}

// Create the grotto behind a specific whirlpool. Like caves, grottos live off
// the (gx, gy) grid and are only reachable through their source vortex; the
// grotto's own whirlpool returns to (returnMapId, returnX, returnY) — the
// tile of the vortex that swallowed the player. `sourceTier` (stored as
// depth) bands how mean the swimmers are (see makeGrottoEnemyDefs).
function createWhirlpoolGrottoMap(returnMapId, returnX, returnY, sourceTier) {
  const newId = worldMaps.length;
  const src = worldMaps[returnMapId];
  const mapTiles = buildWhirlpoolGrottoMap();
  const obj = {
    id: newId, gx: 0, gy: 0,
    name: 'Whirlpool Grotto',
    type: 'whirlpool_grotto', biome: src.biome, regionIdx: src.regionIdx,
    depth: sourceTier,
    map: mapTiles,
    enemyDefs: makeEnemyDefs(sourceTier, 'whirlpool_grotto', mapTiles),
    openedChests: new Set(),
    visited: true,
    returnMapId, returnX, returnY,
    // One open pool — pre-reveal all of it so the fight reads at a glance.
    fog: (() => {
      const f = new Uint8Array(MCOLS * MROWS);
      const cx = Math.floor(MCOLS / 2), cy = Math.floor(MROWS / 2);
      for (let r = cy - GROTTO_HALF - 2; r <= cy + GROTTO_HALF + 2; r++)
        for (let c = cx - GROTTO_HALF - 2; c <= cx + GROTTO_HALF + 2; c++)
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
  const baseOpen = { left: false, right: false, up: false, down: false };
  baseOpen[OPPOSITE[direction]] = true;
  // Reconcile against existing neighbors: only keep the entrance open if the
  // source actually leads here (it should — but stay consistent regardless).
  const openSides = reconcileOpenSides(ngx, ngy, baseOpen);

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
      mapTiles[r][c] === T.MEDIUM_WATER ||
      mapTiles[r][c] === T.ROCK || mapTiles[r][c] === T.WALL ||
      mapTiles[r][c] === T.CAVE_WALL ||
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

// The region's dead-end maps ('sealed' single-exit detours carved by sealRegion),
// in creation order (their order in worldMaps). Used by the "Find Timmy" quest to
// pick the 3rd one to hide the lost child on, once the quest is started.
function regionDeadEndMaps(regionIdx) {
  return worldMaps.filter(m => m && m.sealed && m.regionIdx === regionIdx);
}

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
