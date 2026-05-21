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
  mapSequence = [0];
  const firstMap = createForestMap(0, 0, 0);
  firstMap.visited = true;
  worldMaps.push(firstMap);
  worldGrid[gridKey(0, 0)] = 0;
  currentMapId = 0;
}

// Construct a map object at the given grid position. Decides forest vs village
// based on the current `mapsVisited` count (village is always #21).
function createForestMap(id, gx, gy) {
  const depth = Math.min(mapsVisited, 20);
  const name = depth >= 20
    ? 'Village of the Lost'
    : FOREST_NAMES[Math.floor(Math.random() * FOREST_NAMES.length)] + ` [${mapsVisited + 1}]`;
  const type = depth >= 20 ? 'village' : 'forest';
  const mapTiles = type === 'village' ? buildVillageMap() : buildForestMap(id, depth);
  const enemyDefs = makeEnemyDefs(depth, type, mapTiles);
  return {
    id, gx, gy, name, type, map: mapTiles,
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

// Walking out of an exit. Compute the neighbor's coordinate; if a map already
// exists there, return it. Otherwise create a new one.
function getOrCreateNeighbor(direction) {
  const cur = worldMaps[currentMapId];
  const { dx, dy } = DIR_DELTA[direction];
  const ngx = cur.gx + dx, ngy = cur.gy + dy;
  const key = gridKey(ngx, ngy);
  if (worldGrid[key] !== undefined) return worldGrid[key];

  const newId = worldMaps.length;
  const newMap = createForestMap(newId, ngx, ngy);
  worldMaps.push(newMap);
  worldGrid[key] = newId;
  return newId;
}
