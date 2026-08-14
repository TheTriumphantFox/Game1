// ─── World coordinate registry ────────────────────────────────────────────────
// Maps live in a spatial grid. Each map has (gx, gy) coordinates and
// worldGrid["gx,gy"] -> mapId. This means a closed loop (right → down → left
// → up) correctly returns the player to the original map instead of generating
// a new one.

let worldMaps = [];      // index = mapId; stores map data, enemyDefs etc.
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

// ─── World seed ───────────────────────────────────────────────────────────────
// Rolled once per world and persisted, so a map's terrain can be regenerated from
// its identity instead of stored tile-by-tile. Each overworld map's own seed is
// hashSeed(worldSeed, gx, gy) — the GRID CELL, deliberately not the map id: `id` is
// worldMaps.length at creation time, which shifts with how many caves, grottos and
// dungeons the player happened to open first, so the same place would seed
// differently between two playthroughs of the same route. The resolved seed is also
// stored per map (mapSeed), so changing this derivation later can't invalidate a
// save that was written under the old rule.
let worldSeed = 0;

// One ruined dungeon per region. `regionDungeonPlaced[N]` flips to true once the
// region's dungeon-hosting overworld map has been generated, so no second dungeon
// is ever stamped for that region (see createOverworldMap / stampRuinedDungeon).
// The depth (map count into the region) at which the dungeon may first appear.
let regionDungeonPlaced = {};
const DUNGEON_MIN_DEPTH = 3;

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
  if (cm.type === 'castle_tower') return T.FLOOR;   // castle exposes flagstone
  return regionById(cm.biome).ground;
}

// Initialise a fresh world with the home village at (0, 0). Walking south out
// of the village creates forest [1] as a southern neighbor — same topology the
// lone starter cabin had before the prologue replaced it.
function initWorld() {
  worldMaps = [];
  worldGrid = {};
  // A fresh world rolls a fresh seed. Everything generated from here on is
  // reproducible from it plus the map's grid cell.
  worldSeed = (Math.random() * 0x100000000) >>> 0;
  mapsVisited = 1;
  desertsVisited = 0;
  currentRegionIdx = 0;
  regionMapsVisited = {};
  regionDungeonPlaced = {};
  for (let i = 0; i < REGIONS.length; i++) { regionMapsVisited[i] = 0; regionDungeonPlaced[i] = false; }
  mapSequence = [0];
  const firstMap = createHomeVillageMap(0, 0, 0);
  firstMap.visited = true;
  worldMaps.push(firstMap);
  worldGrid[gridKey(0, 0)] = 0;
  currentMapId = 0;
  placePlayerInFamilyHome(firstMap);
}

// Stand the player in the middle of the family home, facing south toward the
// door — their mother is by the hearth to the east, their father by the door,
// their grandmother at the window. Coordinates come from HOME in
// mapgen-prologue.js so the staging and the map can't drift apart.
function placePlayerInFamilyHome(villageMap) {
  player.x = HOME.spawn.x;
  player.y = HOME.spawn.y;
  player.renderX = player.x;
  player.renderY = player.y;
  player.swordDir = { x: 0, y: 1 };   // facing south, toward the door
}

function createHomeVillageMap(id, gx, gy) {
  // A save written after the prologue rebuilds the ruin; a fresh game gets the
  // village whole. hasFlag is safe here even mid-boot — it tolerates a player
  // whose flags bag hasn't been populated yet.
  const ruined = (typeof hasFlag === 'function') && hasFlag('prologue_complete');
  const obj = {
    id, gx, gy,
    name: HOME_VILLAGE_NAME,
    type: 'homevillage', biome: 'forest',
    homeLayoutVersion: HOME_LAYOUT_VERSION,
    map: ruined ? buildRuinedHomeVillage() : buildHomeVillageMap(),
    enemyDefs: [],        // home is peaceful, before and after
    openedChests: new Set(),
    visited: false, depth: 0
  };
  // The household chest lost its lock in the fire and has stood open ever since
  // (pgBurnChestOpen, prologue.js). A ruin rebuilt from scratch has to remember
  // that, or the one chest in the game with a story attached reappears shut.
  if (ruined) obj.openedChests.add(`${HOME.chest.x},${HOME.chest.y}`);
  // The market row opens with the village and dies with it — a standing
  // Elderbrook carries the same shop fields an activated village does, and the
  // ruin carries none (see homeVillageShopFields / hvCloseShops).
  if (!ruined) Object.assign(obj, homeVillageShopFields());
  return obj;
}

// Retained for saves written before the home village replaced the lone starter
// cabin: those store type 'house' for map 0, and save.js rebuilds them with
// buildStarterHouseMap. Nothing in a fresh game calls these two any more.
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
function buildOverworldForRegion(regionIdx, seed, depth, openSides, placeDungeon) {
  if (regionIdx === 0) return buildForestMap(seed, depth, openSides, placeDungeon);
  if (regionIdx === 1) return buildDesertMap(seed, depth, openSides, placeDungeon);
  return buildRegionMap(seed, depth, openSides, REGIONS[regionIdx], placeDungeon);
}

// Construct a map for the given region at (gx, gy). When the player has
// already visited 20 maps in `regionIdx`, the next new neighbor becomes the
// region's village (boss arena) instead of another overworld map.
function createOverworldMap(id, gx, gy, regionIdx) {
  const region = REGIONS[regionIdx];
  const visited = regionMapsVisited[regionIdx] || 0;

  if (visited >= 20) {
    // The 21st new area in a region is its village. The FINAL region's village
    // is special: exactly two exits — the one the player entered through, and
    // one leading out to the castle tower (see enterCastleTower). All earlier
    // villages keep their four exits.
    let exits = { left: true, right: true, up: true, down: true };
    let castleExitDir;
    if (regionIdx === REGIONS.length - 1) {
      // Entry side = the existing neighbor whose facing edge opens toward this
      // cell (there is always exactly one at creation time — the map the
      // player is stepping out of).
      let entry = null;
      for (const dir of ['left', 'right', 'up', 'down']) {
        const nId = worldGrid[gridKey(gx + DIR_DELTA[dir].dx, gy + DIR_DELTA[dir].dy)];
        if (nId !== undefined && mapEdgeOpen(worldMaps[nId], OPPOSITE_DIR[dir])) { entry = dir; break; }
      }
      entry = entry || 'down';
      // Castle side: the side opposite the entry, falling back to the first
      // other side with an empty grid cell (so the gate never faces an
      // already-built map).
      const prefs = [OPPOSITE_DIR[entry], ...['left', 'right', 'up', 'down'].filter(d => d !== entry)];
      castleExitDir = prefs.find(d =>
        worldGrid[gridKey(gx + DIR_DELTA[d].dx, gy + DIR_DELTA[d].dy)] === undefined) || OPPOSITE_DIR[entry];
      exits = { left: false, right: false, up: false, down: false };
      exits[entry] = true;
      exits[castleExitDir] = true;
    }
    const mapTiles = buildVillageMap(region.id, exits);
    const enemyType = `${region.id}_village`;
    const enemyDefs = makeEnemyDefs(20, enemyType, mapTiles);
    return {
      id, gx, gy,
      name: region.villageName,
      type: 'village', biome: region.id,
      regionIdx, castleExitDir,
      map: mapTiles, enemyDefs, openedChests: new Set(),
      visited: false, depth: 20
    };
  }

  const depth = Math.min(visited + 1, 20);
  const namePool = region.names || FOREST_NAMES;
  // Seeded on the grid cell like the terrain, so the same world seed names the same
  // place the same thing. Derived straight from the seed rather than drawn from the
  // generation stream, so adding or removing a name never shifts the terrain.
  const mapSeed = hashSeed(worldSeed, gx, gy);
  const name = namePool[hashSeed(mapSeed, 'name') % namePool.length] + ` [${depth}]`;
  // Open every side that isn't blocked by an existing, non-reciprocating
  // neighbor, so we never create a one-way transition into a sealed map.
  const openSides = reconcileOpenSides(gx, gy, { left: true, right: true, up: true, down: true });
  // Exactly one ruined dungeon per region: host it on the first overworld map at
  // or past DUNGEON_MIN_DEPTH, then never again for this region. Depth climbs by 1
  // per new overworld map, so a qualifying map is always generated before the
  // region's village (depth 20) — the region's dungeon is guaranteed to exist.
  let placeDungeon = false;
  if (!regionDungeonPlaced[regionIdx] && depth >= DUNGEON_MIN_DEPTH) {
    placeDungeon = true;
    regionDungeonPlaced[regionIdx] = true;
  }
  // mapSeed is resolved above, with the name — both key off the grid cell.
  const mapTiles = buildOverworldForRegion(regionIdx, mapSeed, depth, openSides, placeDungeon);
  const enemyDefs = makeEnemyDefs(depth, region.id, mapTiles);
  return {
    id, gx, gy,
    name, type: region.id, biome: region.id,
    regionIdx,
    // The generation recipe, kept on the map and persisted with it. depth and
    // openSides alone aren't enough: placeDungeon is decided from mutable world state
    // (whichever map in the region got past DUNGEON_MIN_DEPTH first), so a rebuild
    // that didn't know about it dropped the region's only dungeon entrance.
    mapSeed, placeDungeon,
    // Hash of the map as generated. save.js compares the live tiles against this to
    // decide whether they need storing at all — see tileHash in map-helpers.js.
    pristineHash: tileHash(mapTiles),
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
    // The final region's dev village mirrors the real one: two exits (enter
    // from the south, castle gate to the north) so the tower stays reachable
    // when fast-traveling straight to the endgame.
    const isFinalRegion = regionIdx === REGIONS.length - 1;
    const exits = isFinalRegion
      ? { left: false, right: false, up: true, down: true }
      : { left: true, right: true, up: true, down: true };
    const mapTiles = buildVillageMap(region.id, exits);
    worldMaps.push({
      id, gx: 10000 + regionIdx, gy: 10000,   // off-grid; not in worldGrid
      name: region.villageName,
      type: 'village', biome: region.id, regionIdx,
      castleExitDir: isFinalRegion ? 'up' : undefined,
      map: mapTiles, enemyDefs: makeEnemyDefs(20, `${region.id}_village`, mapTiles),
      openedChests: new Set(),
      visited: true, depth: 20, devSpawned: true
    });
  }
  const obj = worldMaps[id];
  // Dev: force-clear the village so it has a portal and no monsters.
  if (!obj.activated) activateVillage(obj);
  else if (typeof installVillageShrineEntrance === 'function') installVillageShrineEntrance(obj);
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
  // Root = the overworld map this whole chain hangs off. Level 1 returns straight
  // to it (returnMapId IS the overworld); deeper levels inherit it from the level
  // above (the map we return to). The final level's CHEST_EXIT portal uses this to
  // jump the hero all the way out in one step. See tryCaveTransition.
  const root = chainDepth <= 1
    ? { mapId: returnMapId, x: returnX, y: returnY }
    : rootReturnOf(worldMaps[returnMapId], returnMapId, returnX, returnY);
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
    returnMapId, returnX, returnY,
    rootMapId: root.mapId, rootX: root.x, rootY: root.y
  };
  worldMaps.push(obj);
  return newId;
}

// Resolve the overworld root-return target for a map: its own root fields if it
// already carries them (a chain/sky-cave level above), else the map itself at
// (fx, fy) — used so a chain's deepest CHEST_EXIT lands back on the overworld.
function rootReturnOf(m, fallbackId, fx, fy) {
  if (m && m.rootMapId != null) return { mapId: m.rootMapId, x: m.rootX, y: m.rootY };
  return { mapId: fallbackId, x: fx, y: fy };
}

// ─── Ruined dungeon ────────────────────────────────────────────────────────────
// Build the single-level dungeon behind an overworld DUNGEON_DOOR. Like caves,
// dungeons live off the (gx, gy) grid — reachable only by stepping onto their
// door, and returning through the dungeon's own DUNGEON_DOOR (an edge tile that
// leads back to (returnMapId, returnX, returnY): the overworld door that opened
// it). Stocked from the region's own overworld roster. `entryLand` is the inner
// landing tile beside the exit door, where the hero arrives on entry.
function createDungeonMap(returnMapId, returnX, returnY, regionIdx) {
  const newId = worldMaps.length;
  const region = REGIONS[regionIdx] || REGIONS[0];
  const built = buildDungeonLevelMap();
  const obj = {
    id: newId, gx: 0, gy: 0,
    name: 'Ruined Dungeon',
    type: 'dungeon', biome: region.id, regionIdx,
    depth: region.enemyTier,
    map: built.map,
    entryLand: built.entryLand,
    enemyDefs: makeEnemyDefs(20, region.id, built.map),
    openedChests: new Set(),
    visited: true,
    returnMapId, returnX, returnY,
    // Single level: the overworld door IS the root, so the chest portal returns to
    // the same place as the edge door — just without the walk back through the maze.
    rootMapId: returnMapId, rootX: returnX, rootY: returnY
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
  // Root overworld map for the chain (see createCaveChainMap) — the final level's
  // CHEST_EXIT portal drops the hero all the way back down to it in one step.
  const root = chainDepth <= 1
    ? { mapId: returnMapId, x: returnX, y: returnY }
    : rootReturnOf(worldMaps[returnMapId], returnMapId, returnX, returnY);
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
    returnMapId, returnX, returnY,
    rootMapId: root.mapId, rootX: root.x, rootY: root.y
  };
  worldMaps.push(obj);
  return newId;
}

// ─── Final castle tower ────────────────────────────────────────────────────────
// Build one floor of the endgame castle rising from the last (shadow) village —
// a 14-floor ascending chain (see buildTowerFloorMap / enterCastleTower). Floors
// live off the (gx, gy) grid like caves; TOWER_STAIRS_UP climbs one floor,
// TOWER_STAIRS_DOWN returns to (returnMapId, returnX, returnY): the village
// gate for floor 1, the previous floor's stair-up thereafter. Floors 1–13 are
// each one region in game order, stocked exactly like that region's village
// (Greater roster + region boss); floor 14 is the dragon's throne hall (see
// makeTowerFinaleDefs), pre-lit so the staged finale reads at a glance.
function createTowerFloorMap(returnMapId, returnX, returnY, floorIdx) {
  const newId = worldMaps.length;
  const isFinal = floorIdx >= 14;
  const region = REGIONS[Math.min(floorIdx, 13) - 1];
  const built = buildTowerFloorMap(floorIdx);
  const regionLabel = region.id.charAt(0).toUpperCase() + region.id.slice(1);
  const obj = {
    id: newId, gx: 0, gy: 0,
    name: isFinal ? 'Dragon’s Throne — Castle Pinnacle'
                  : `Castle Tower — ${regionLabel} Hall (Floor ${floorIdx}/14)`,
    type: 'castle_tower', biome: region.id,
    // Drives the per-boss ruby payout (100 × regionIdx+1) and heart scaling in
    // killEnemy: themed floors pay at their region's rate, the pinnacle at the
    // final region's.
    regionIdx: isFinal ? REGIONS.length - 1 : floorIdx - 1,
    floorIdx, chainDepth: floorIdx, chainLen: 14, depth: 20,
    map: built.map,
    entryLand: built.entryLand,
    deeperLand: built.deeperLand,
    enemyDefs: isFinal ? makeTowerFinaleDefs(built.map)
                       : makeEnemyDefs(20, `${region.id}_village`, built.map),
    openedChests: new Set(),
    visited: true,
    returnMapId, returnX, returnY
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
    returnMapId, returnX, returnY
  };
  worldMaps.push(obj);
  return newId;
}

// 1-exit dead-ends reward the detour with a Hero's Cache. The map builder already
// placed a regular CHEST in a clearing and connectivity guarantees it's reachable
// from the single exit — just upgrade that tile in place. The large chest is 2 tiles
// wide, so also stamp the right-half extension on the tile to the east when it's
// passable; if that tile is blocked, try the west side and swap anchor/extension. As
// a last resort, leave it as a single LARGE_CHEST so the pickup still works.
//
// Lifted out of createSealedNeighbor so the save/load rebuild can re-apply it. A
// dead-end the player never entered isn't stored by tile (save.js), so it is rebuilt
// from its builder on load — and that rebuild used to hand back a plain CHEST,
// silently downgrading the reward for the detour.
function upgradeDeadEndChests(mapTiles) {
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
}

// Which of a map's four border gates are walkable, as the { left, right, up, down }
// shape the map builders take as `openSides`. This is the *result* of generation, read
// back off the finished tiles — which makes it exactly what a rebuild needs to
// reproduce the same topology, so it is persisted with the map (see save.js).
function mapOpenSides(mapObj) {
  return {
    left:  mapEdgeOpen(mapObj, 'left'),  right: mapEdgeOpen(mapObj, 'right'),
    up:    mapEdgeOpen(mapObj, 'up'),    down:  mapEdgeOpen(mapObj, 'down')
  };
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
  const mapSeed = hashSeed(worldSeed, ngx, ngy);
  const mapTiles = buildOverworldForRegion(regionIdx, mapSeed, depth, openSides);
  const enemyDefs = makeEnemyDefs(depth, region.id, mapTiles);
  // Seeded like the overworld names above, off this cell's own seed.
  const name = region.names[hashSeed(mapSeed, 'name') % region.names.length] + ' (Dead End)';
  upgradeDeadEndChests(mapTiles);
  worldMaps.push({
    id: newId, gx: ngx, gy: ngy, name,
    type: region.id, biome: region.id, regionIdx,
    depth, mapSeed,
    // Hashed AFTER upgradeDeadEndChests, so the Hero's Cache is part of the pristine
    // state — the rebuild re-applies that upgrade too (save.js), so the two match.
    pristineHash: tileHash(mapTiles),
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
    // Only maps that actually claim their worldGrid cell can host dead-end
    // neighbors. Off-grid maps (caves, dungeons, grottos, sky caves, castle
    // tower floors, dev villages) carry placeholder gx/gy like (0,0) — stamping
    // neighbors for them would register phantom dead-ends at REAL overworld
    // coordinates next to the starter house.
    if (worldGrid[gridKey(src.gx, src.gy)] !== src.id) continue;
    // Leave the village's unused exits open so they can connect into the next
    // region as the player walks out (mirrors the forest→fire transition).
    if (src.type === 'village' && hasNextRegion) continue;
    for (const dir of ['left', 'right', 'up', 'down']) {
      // Never brick over the final village's castle gate — the tower is the
      // whole point of clearing the last region.
      if (src.type === 'village' && src.castleExitDir === dir) continue;
      // The final village only opens two sides; don't stamp junk dead-end
      // neighbors behind its solid walls.
      if (src.type === 'village' && !mapEdgeOpen(src, dir)) continue;
      const { dx, dy } = DIR_DELTA[dir];
      if (worldGrid[gridKey(src.gx + dx, src.gy + dy)] !== undefined) continue;
      createSealedNeighbor(src.id, dir);
    }
  }
  // Seed this region's lone sealed elemental shrine (#10) now that the region's
  // maps exist and are bounded.
  // Stage 9 shrines now live in each activated village. The old random
  // overworld seal generator remains below solely for tolerant legacy loads.
}

// ─── Sealed elemental shrine (#10) ────────────────────────────────────────────
// One dormant shrine per region, seeded when the region's village is cleared. It
// is unsealed only by striking it with an elemental attack of its randomly-assigned
// element; clue runes ring it and glow in that element's colour, and examining it
// (stepping on) whispers an atmospheric hint. See SEALED_SHRINE / SHRINE_RUNE in
// config.js and the sword/arrow hooks in projectiles.js.

// Atmospheric riddle-clue per element, shown when the hero steps onto a sealed
// shrine — a nudge at which elemental strike breaks the seal.
const ELEMENT_CLUE = {
  fire:      'The stones are scorched black and warm to the touch.',
  water:     'A cold spray beads on the runes, though no stream is near.',
  ice:       'Frost rimes the carvings and your breath fogs the air.',
  lightning: 'The hair on your arms stands; the runes tick with static.',
  earth:     'The ground is packed hard as stone, veined with raw ore.',
  air:       'A restless wind worries the runes and tugs at your cloak.',
  luminous:  'The runes drink the light and give back a warm glow.',
  necrotic:  'A grave-chill hangs here; the runes are pitted with rot.',
  poison:    'An acrid film clings to the carvings, hissing faintly.',
  mana:      'The runes thrum with a violet, otherworldly pulse.',
  volcanic:  'Cracked obsidian rims the seal and heat shimmers off it.',
  shadow:    'The runes swallow every shadow, darker than the night.'
};

// Find an open clearing near a map's centre with a fully-passable 3×3 around it
// (room for the shrine + its 4 diagonal clue runes). Returns {x,y} or null.
function findShrineClearing(m) {
  if (!m) return null;
  const cx = Math.floor(MCOLS / 2), cy = Math.floor(MROWS / 2);
  const ok = (x, y) => x > 1 && y > 1 && x < MCOLS - 2 && y < MROWS - 2 &&
    !isSolid(m, x, y) && !isChestTile(m[y][x]) &&
    m[y][x] !== T.SHRINE && m[y][x] !== T.SEALED_SHRINE &&
    m[y][x] !== T.CAVE_ENTRANCE && m[y][x] !== T.CAVE_EXIT &&
    m[y][x] !== T.CHEST_EXIT && m[y][x] !== T.PORTAL;
  for (let radius = 0; radius <= 45; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;   // ring only
        const x = cx + dx, y = cy + dy;
        let clear = true;
        for (let r = -1; r <= 1 && clear; r++)
          for (let c = -1; c <= 1; c++)
            if (!ok(x + c, y + r)) { clear = false; break; }
        if (clear) return { x, y };
      }
    }
  }
  return null;
}

// Seed a region's sealed shrine once. Picks a deeper on-grid overworld map of the
// region, stamps the shrine + a 4-rune clue ring on an open clearing, and rolls the
// required element. Idempotent per region (keyed on player.shrineQuests[rid]).
function seedRegionShrine(regionIdx) {
  const region = REGIONS[regionIdx];
  if (!region) return;
  const rid = region.id;
  player.shrineQuests = player.shrineQuests || {};
  if (player.shrineQuests[rid]) return;            // already seeded
  const cands = worldMaps.filter(mm => mm && mm.regionIdx === regionIdx &&
    mm.type === region.id && mm.visited &&          // visited so its tiles persist
    worldGrid[gridKey(mm.gx, mm.gy)] === mm.id);    // on-grid overworld only
  if (!cands.length) return;
  cands.sort((a, b) => (b.depth || 0) - (a.depth || 0));   // deeper first
  for (const target of cands) {
    const spot = findShrineClearing(target.map);
    if (!spot) continue;
    const m = target.map;
    m[spot.y][spot.x] = T.SEALED_SHRINE;
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const rx = spot.x + dx, ry = spot.y + dy;
      if (ry > 0 && ry < MROWS - 1 && rx > 0 && rx < MCOLS - 1 &&
          !isSolid(m, rx, ry) && !isChestTile(m[ry][rx]))
        m[ry][rx] = T.SHRINE_RUNE;
    }
    const ids = (typeof REGION_ELEMENT_IDS !== 'undefined')
      ? REGION_ELEMENT_IDS : Object.keys(SWORD_ELEMENTS);   // never the capstone Dragonbane
    const requiredElement = ids[Math.floor(Math.random() * ids.length)];
    target.shrineElement = requiredElement;
    player.shrineQuests[rid] = { mapId: target.id, requiredElement, status: 'sealed', x: spot.x, y: spot.y };
    return;
  }
}

// Attempt to break a sealed shrine at tile (tc,tr) with `element` (the active sword
// or arrow element, or null for a plain strike). Returns true if the tile WAS a
// sealed shrine — so callers (sword swing / arrow) can stop or consume — regardless
// of whether the element matched.
function tryUnsealShrine(tc, tr, element) {
  const cm = (typeof currentMap === 'function') ? currentMap() : null;
  if (!cm || !cm.map) return false;
  if (tr < 0 || tc < 0 || tr >= MROWS || tc >= MCOLS) return false;
  if (cm.map[tr][tc] !== T.SEALED_SHRINE) return false;
  const required = cm.shrineElement;
  // Plain (non-elemental) strike — the seal only answers to a specific element.
  if (!element) {
    if (typeof showMsg === 'function')
      showMsg('🔒 The sealed shrine shrugs off a plain strike — its seal wants a certain element.', 2500);
    return true;
  }
  if (element !== required) {
    const wrong = SWORD_ELEMENTS[element];
    if (typeof showMsg === 'function')
      showMsg(`🔒 The seal rejects the ${wrong ? wrong.label : element} — that is not its element.`, 2500);
    return true;
  }
  // Correct element — shatter the seal.
  const rElem = SWORD_ELEMENTS[required];
  cm.map[tr][tc] = T.SHRINE;
  const ground = (typeof mapGroundTile === 'function') ? mapGroundTile() : T.GRASS;
  for (let r = -1; r <= 1; r++) for (let c = -1; c <= 1; c++) {
    const rx = tc + c, ry = tr + r;
    if (ry >= 0 && rx >= 0 && ry < MROWS && rx < MCOLS && cm.map[ry][rx] === T.SHRINE_RUNE)
      cm.map[ry][rx] = ground;
  }
  const rid = (typeof regionIdForMap === 'function') ? regionIdForMap(cm) : cm.biome;
  player.shrineQuests = player.shrineQuests || {};
  const q = player.shrineQuests[rid] || (player.shrineQuests[rid] = { status: 'sealed' });
  const firstTime = q.status !== 'done';
  q.status = 'done';
  if (firstTime) { player.maxHp += 2; player.hp = player.maxHp; }
  if (typeof buzz === 'function') buzz([0, 20, 20, 40]);
  const sp = screenPX(tc, tr);
  spawnParticle(sp.x, sp.y, rElem ? rElem.color : '#aaffaa', 22, 5);
  spawnParticle(sp.x, sp.y, '#ffffff', 12, 4);
  if (typeof minimapDirty !== 'undefined') minimapDirty = true;
  const msg = `${rElem ? rElem.icon : '🙏'} The ${rElem ? rElem.label : ''} seal shatters — the shrine awakens! +2 Max HP and full health restored.`;
  if (typeof showMapMsg === 'function') showMapMsg(msg);
  else if (typeof showMsg === 'function') showMsg(msg, 4000);
  if (typeof updateHUD === 'function') updateHUD();
  return true;
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
  if (cur.type === 'house' || cur.type === 'homevillage') {
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
