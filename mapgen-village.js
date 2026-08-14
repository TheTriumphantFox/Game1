// map-gen village + starter cabin/cave map builders
// Split out of map-gen.js (generation-time only; plain <script> globals, all
// cross-file calls resolve at runtime). See index.html for load order.

// ─── Village activation ──────────────────────────────────────────────────────
// Called when the player clears every enemy in a village map. Converts four
// random house doors into an INN_DOOR, a STORE_DOOR, a HERB_DOOR, and a
// SMITH_DOOR so the player can rest, shop, trade ingredients, and buy armor.
// Idempotent — re-entering the cleared village keeps the doors.
function activateVillage(mapObj) {
  if (!mapObj || mapObj.activated) return false;
  const m = mapObj.map;
  // Reserve the NW inner-ring house for the fast-travel portal so it never gets
  // a stationary shopkeeper. Its door is excluded from the shop pool below.
  const pl = villagePortalLayout(mapObj.biome, m);
  const sl = villageShrineLayout(mapObj.biome, m);
  const doors = [];
  for (let r = 0; r < MROWS; r++)
    for (let c = 0; c < MCOLS; c++)
      if (m[r][c] === T.DOOR &&
          !(r === pl.doorR && c === pl.doorC) &&
          !(r === sl.doorR && c === sl.doorC)) doors.push({ r, c });
  if (doors.length < 4) return false;
  // Shuffle (Fisher–Yates) and pick the first four for inn + store + herbalist
  // + blacksmith.
  for (let i = doors.length - 1; i > 0; i--) {
    const j = Math.floor(genRandom() * (i + 1));
    [doors[i], doors[j]] = [doors[j], doors[i]];
  }
  m[doors[0].r][doors[0].c] = T.INN_DOOR;
  m[doors[1].r][doors[1].c] = T.STORE_DOOR;
  m[doors[2].r][doors[2].c] = T.HERB_DOOR;
  m[doors[3].r][doors[3].c] = T.SMITH_DOOR;
  // The village is now cleared — open the fast-travel portal in the reserved
  // NW house. (Stamped over interior FLOOR, which is already reachable via the
  // house door, so no connectivity re-run is needed.)
  m[pl.portalR][pl.portalC] = T.PORTAL;
  mapObj.activated = true;
  // Remember where the player can come back to
  mapObj.innDoor = doors[0];
  mapObj.storeDoor = doors[1];
  mapObj.herbDoor = doors[2];
  mapObj.smithDoor = doors[3];
  if (typeof installVillageShrineEntrance === 'function') installVillageShrineEntrance(mapObj);
  // Rename so the HUD reflects the change
  if (!/Active/.test(mapObj.name)) mapObj.name = mapObj.name + ' (Active)';
  return true;
}

// ─── Starter house map ───────────────────────────────────────────────────────
// A small, furnished one-room house used as the game's starting map. The
// playable area is a 21×16 room hugging the south border so the room's south
// wall coincides with the map's south exit — walking south out the door
// triggers the normal map transition into forest [2]. Everything outside the
// room is wrapped in T.TREE so it's solid and never gets rendered.
//
// Furnishings (north-up):
//   ┌────────────────────┐
//   │ 🛏  🛏              │   bed in the NW corner
//   │ 🛏  🛏    🔥        │   fireplace against the north wall
//   │                    │
//   │       T            │   table with chairs flanking it
//   │      C T C         │
//   │       C            │
//   │   📦                │   chest in the SW
//   └─────D──────────────┘   door at south-centre = map's south exit
function buildStarterHouseMap() {
  const m = makeTile(MROWS, MCOLS, T.TREE);
  const HW = 21, HH = 16;
  const r1 = MROWS - 1 - HH;                    // north interior wall row
  const c1 = Math.floor(MCOLS / 2) - Math.floor(HW / 2);
  const r2 = MROWS - 1;                         // south wall == map border
  const c2 = c1 + HW;

  // Walls + interior floor
  setRect(m, r1, c1, r2, c2, T.WALL);
  setRect(m, r1 + 1, c1 + 1, r2 - 1, c2 - 1, T.FLOOR);

  // Corner torches for ambience
  m[r1 + 1][c1 + 1] = T.TORCH;
  m[r1 + 1][c2 - 1] = T.TORCH;

  // Bed in the NW (2 tiles stacked vertically)
  m[r1 + 2][c1 + 2] = T.BED;
  m[r1 + 3][c1 + 2] = T.BED;

  // Fireplace against the north wall, east side
  m[r1 + 2][c2 - 3] = T.FIREPLACE;

  // Dining table + flanking chairs near the room centre
  const tr = r1 + Math.floor(HH / 2) + 1;
  const tc = c1 + Math.floor(HW / 2);
  m[tr][tc]     = T.TABLE;
  m[tr][tc - 2] = T.CHAIR;
  m[tr][tc + 2] = T.CHAIR;

  // A storage chest tucked in the SW corner
  m[r2 - 2][c1 + 2] = T.CHEST;

  // Fast-travel portal — opposite the chest, in the SE corner of the cabin.
  // A Gatekeeper spawns beside it (see ensurePortalKeeper); talk to them to
  // open the destinations menu — stepping on the tile no longer does.
  m[r2 - 2][c2 - 2] = T.PORTAL;

  // South-only exit: cut the standard 5-wide PATH gate at the map border
  // first, then stamp a DOOR tile dead-centre on it so the room visibly has
  // one obvious way out. Walking onto either the door or the flanking PATH
  // tiles triggers the normal map transition to forest [2].
  cutExits(m, false, false, false, true);
  m[r2][EXIT_COL] = T.DOOR;

  return m;
}

// ─── Cave map ─────────────────────────────────────────────────────────────────
// A small 20×20 chamber centred in the standard 150×150 grid, surrounded by
// solid wall. Contains one CAVE_EXIT (back to the source map) and one
// LARGE_CHEST that grants the +2 Sword / +2 Armor reward.
function buildCaveMap() {
  const m = makeTile(MROWS, MCOLS, T.CAVE_WALL);
  const cx = Math.floor(MCOLS / 2);
  const cy = Math.floor(MROWS / 2);
  const half = 10;
  // Hollow out the 20×20 chamber
  setRect(m, cy - half, cx - half, cy + half - 1, cx + half - 1, T.CAVE_FLOOR);
  // A stone-wall trim along the chamber's edge
  setRow(m, cy - half,     cx - half, cx + half - 1, T.ROCK);
  setRow(m, cy + half - 1, cx - half, cx + half - 1, T.ROCK);
  setCol(m, cx - half,     cy - half, cy + half - 1, T.ROCK);
  setCol(m, cx + half - 1, cy - half, cy + half - 1, T.ROCK);
  // Re-open the floor inset by 1 tile
  setRect(m, cy - half + 1, cx - half + 1, cy + half - 2, cx + half - 2, T.CAVE_FLOOR);
  // Player landing spot (bottom of chamber) holds the CAVE_EXIT
  m[cy + half - 2][cx] = T.CAVE_EXIT;
  // Large chest at the back — 2 tiles wide (anchor at cx, extension at cx+1)
  m[cy - half + 3][cx]     = T.LARGE_CHEST;
  m[cy - half + 3][cx + 1] = T.LARGE_CHEST_R;
  // Atmosphere: torches at the corners
  m[cy - half + 1][cx - half + 1] = T.TORCH;
  m[cy - half + 1][cx + half - 2] = T.TORCH;
  m[cy + half - 2][cx - half + 1] = T.TORCH;
  m[cy + half - 2][cx + half - 2] = T.TORCH;
  // A scatter of small chests (1d4) tucked around the chamber, inset one tile
  // from the floor edge so they never abut the ROCK trim.
  placeCaveChests(m, rnd(1, 4), cy - half + 2, cx - half + 2, cy + half - 3, cx + half - 3);
  return m;
}

// ─── Cave-chain level (full-sized labyrinth) ─────────────────────────────────
// One level of the universal hidden cave system (reached by bombing a rock or
// stepping behind a waterfall), built on the full 150×150 grid: a labyrinth of
// narrow CAVE_FLOOR tunnels carved out of solid rock by a recursive-backtracker
// maze. Two transitions sit at the midpoints of two randomly chosen edges
// (top/bottom/left/right): the way back (CAVE_EXIT) you arrived through, and — on
// non-final levels — a passage deeper (CAVE_DESCENT) on a different edge, so the
// hero must thread the maze from one to the other. The final level swaps the
// deeper passage for the reward: a large chest in a small chamber at the heart of
// the labyrinth. Returns the tiles plus the inner landing tile beside each
// transition, so arrivals stand just inside, never on a trigger.

// ─── Water village flooding ──────────────────────────────────────────────────
// The water region's boss village (Tideborn Refuge) is a tidal settlement: most
// of its open ground is wadeable SHALLOW_WATER, with dry SAND only where the
// player actually needs it — a 3-tile sand margin hugging every COBBLESTONE road
// and a 1-tile sand ring around every house wall. House interiors never flood.
//
// Runs after the cobblestone roads and house exteriors are finished (so the
// distance-to-road field is final) and before ensureConnectivity — SHALLOW and
// SAND are both passable, so connectivity is unaffected. Targets ~80% of the
// open village ground as shallow water; the protected sand bands plus any surplus
// dry tiles (kept as the fringe nearest the roads) make up the other ~20%, so the
// water pools out in the open middle of the plaza rather than against the houses.
function floodWaterVillage(m) {
  const SAND_BAND = 3;          // sand tiles kept alongside every cobble road
  const TARGET_WATER = 0.80;    // share of open ground that becomes shallow water
  const NB = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];

  // The flood only touches the open village ground (the SAND laid over the old
  // dirt plaza). Roads (COBBLESTONE), the marble plaza, houses, the fountain, and
  // every placed structure are left exactly as they are.
  const isGround = (r, c) => m[r][c] === T.SAND;

  // Multi-source BFS giving each tile its 8-connected (Chebyshev) ring distance
  // to the nearest COBBLESTONE road. Seeds at distance 0 on every cobble tile.
  const INF = 32767;
  const cobDist = new Int16Array(MROWS * MCOLS).fill(INF);
  const queue = [];
  for (let r = 0; r < MROWS; r++)
    for (let c = 0; c < MCOLS; c++)
      if (m[r][c] === T.COBBLESTONE) { cobDist[r * MCOLS + c] = 0; queue.push(r * MCOLS + c); }
  for (let head = 0; head < queue.length; head++) {
    const idx = queue[head];
    const r = (idx / MCOLS) | 0, c = idx % MCOLS, d = cobDist[idx];
    for (const [dr, dc] of NB) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= MROWS || nc < 0 || nc >= MCOLS) continue;
      const ni = nr * MCOLS + nc;
      if (cobDist[ni] <= d + 1) continue;
      cobDist[ni] = d + 1;
      queue.push(ni);
    }
  }

  // A ground tile is wall-adjacent if any of its 8 neighbours is a house WALL.
  const nearWall = (r, c) => {
    for (const [dr, dc] of NB) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= MROWS || nc < 0 || nc >= MCOLS) continue;
      if (m[nr][nc] === T.WALL) return true;
    }
    return false;
  };

  // Classify every open-ground tile. forcedSand tiles (within the cobble band or
  // hugging a wall) must stay dry; the rest are floodable.
  const free = [];
  let groundCount = 0;
  for (let r = 1; r < MROWS - 1; r++)
    for (let c = 1; c < MCOLS - 1; c++) {
      if (!isGround(r, c)) continue;
      groundCount++;
      if (cobDist[r * MCOLS + c] <= SAND_BAND || nearWall(r, c)) continue;  // forced sand
      free.push(r * MCOLS + c);
    }
  if (!free.length) return;

  // Convert the free tiles farthest from the roads first, so water collects out
  // in the open plaza and the dry fringe sits nearest the cobble. Cap the count
  // so shallow water ends up at ~80% of the open ground.
  free.sort((a, b) => cobDist[b] - cobDist[a]);
  const want = Math.min(free.length, Math.round(TARGET_WATER * groundCount));
  for (let i = 0; i < want; i++) {
    const idx = free[i];
    m[(idx / MCOLS) | 0][idx % MCOLS] = T.SHALLOW_WATER;
  }
}

// ─── Desert village map ─────────────────────────────────────────────────────
// ─── Village map ──────────────────────────────────────────────────────────────
// Fixed boss-village layouts around a central fountain plaza. The forest has
// its own dense cottage plan; later regions retain the broad elemental layout.
function buildVillageMap(biome, exits = { left: true, right: true, up: true, down: true }) {
  // Resolve the region's palette. `biome` is a region id ('forest', 'fire',
  // 'water', ...). Legacy 'desert' callers map to 'fire'. `exits` selects which
  // cardinal gates are cut — every village opens all four except the FINAL
  // region's, which opens exactly two: the side the player entered from and
  // the castle-tower gate (see createOverworldMap / enterCastleTower).
  const regionId = biome === 'desert' ? 'fire' : (biome || 'forest');
  const region = regionById(regionId);
  const BORDER = region.border;
  const GROUND = region.ground;
  const DECOR  = region.decoration;
  const m = makeTile(MROWS, MCOLS, T.PATH);

  // Perimeter border (forest/cactus hugging the village)
  for (let r = 0; r < MROWS; r++) { m[r][0] = BORDER; m[r][MCOLS - 1] = BORDER; }
  for (let c = 0; c < MCOLS; c++) { m[0][c] = BORDER; m[MROWS - 1][c] = BORDER; }
  // Inner ring (thicker border)
  for (let r = 1; r < 8; r++)             for (let c = 1; c < MCOLS - 1; c++) m[r][c] = BORDER;
  for (let r = MROWS - 8; r < MROWS - 1; r++) for (let c = 1; c < MCOLS - 1; c++) m[r][c] = BORDER;
  for (let r = 1; r < MROWS - 1; r++)     for (let c = 1; c < 8; c++)         m[r][c] = BORDER;
  for (let r = 1; r < MROWS - 1; r++)     for (let c = MCOLS - 8; c < MCOLS - 1; c++) m[r][c] = BORDER;

  // Village plaza (open paths)
  setRect(m, 8, 8, MROWS - 9, MCOLS - 9, T.PATH);

  // ─── Exit corridors FIRST ────────────────────────────────────────────────
  // Cut the four edge exits and drunkWalk approach corridors through the
  // tree ring BEFORE laying down anything else. Doing this first means the
  // village (houses, marble plaza, fountain) is built on top of stable
  // corridors instead of getting chopped by them.
  const midR = Math.floor(MROWS / 2), midC = Math.floor(MCOLS / 2);
  cutExits(m, exits.left, exits.right, exits.up, exits.down);
  if (exits.left)  drunkWalk(m, EXIT_ROW, 1,         EXIT_ROW, midC,    T.PATH, 2);
  if (exits.right) drunkWalk(m, EXIT_ROW, MCOLS - 2, EXIT_ROW, midC,    T.PATH, 2);
  if (exits.up)    drunkWalk(m, 1,         EXIT_COL, midR,     EXIT_COL, T.PATH, 2);
  if (exits.down)  drunkWalk(m, MROWS - 2, EXIT_COL, midR,     EXIT_COL, T.PATH, 2);

  // Marble plaza around the fountain — 21×21 of polished tiles, fitting
  // neatly between the inner ring of houses (which sit at rows 49–61 and
  // 89–101). Painted on top of the corridor so the corridor ends in marble.
  setRect(m, midR - 10, midC - 10, midR + 10, midC + 10, T.MARBLE);

  // Helper: build a house with walls, floor, a south-facing door, torches,
  // and a small interior of furnishings (bed, fireplace, table, chairs).
  // The chest tile is deferred to the end of buildVillageMap so paths can't
  // overwrite it — when present it lands at (r1+2, c1+w/2), which doesn't
  // collide with any of the furniture positions below.
  function house(r1, c1, w, h) {
    setRect(m, r1, c1, r1 + h, c1 + w, T.WALL);
    setRect(m, r1 + 1, c1 + 1, r1 + h - 1, c1 + w - 1, T.FLOOR);
    m[r1 + h][c1 + Math.floor(w / 2)] = T.DOOR;
    m[r1 + 1][c1 + 1] = T.TORCH;
    m[r1 + 1][c1 + w - 1] = T.TORCH;

    // ── Furnishings ──────────────────────────────────────────────────
    // Bed in the upper-left corner (south of the NW torch)
    m[r1 + 2][c1 + 2] = T.BED;
    if (h >= 8) m[r1 + 3][c1 + 2] = T.BED;
    // Fireplace against the upper-right corner (south of the NE torch)
    m[r1 + 2][c1 + w - 2] = T.FIREPLACE;
    // Table near the centre of the room
    const tr = r1 + Math.floor(h / 2);
    const tc = c1 + Math.floor(w / 2);
    m[tr][tc] = T.TABLE;
    // Two chairs flanking the table — one west, one east
    m[tr][tc - 2] = T.CHAIR;
    m[tr][tc + 2] = T.CHAIR;
  }

  // House layouts. Forest cottages are 9x7 tiles (including walls); later
  // elemental villages keep their established 17x13 houses.
  //
  //   • House dimensions: 17 cols wide × 13 rows tall (hw=16, hh=12 inclusive).
  //   • Inner ring (8) wraps the fountain with a 7-tile gap between adjacent
  //     houses in both directions.
  //   • Outer ring (10) lines the village perimeter — top and bottom rows
  //     each carry 4 houses; the two side houses sit at col 10 / col 123,
  //     kept 2 tiles in from the border-wall ring on each side.
  //
  const compactForest = regionId === 'forest';
  const hw = compactForest ? 8 : 16;
  const hh = compactForest ? 6 : 12;
  const HOUSE_W = hw + 1, HOUSE_H = hh + 1;
  // Inner ring — rows 49 / 69 / 89, cols 43 / 67 / 91. Adjacent pairs sit
  // exactly 7 grass tiles apart; every house ends up ≥10 tiles from the
  // fountain colonnade.
  const INNER_GAP = 7;
  const NORTH_ROW = midR - 14 - hh;                          // 49
  const SIDE_ROW  = NORTH_ROW + HOUSE_H + INNER_GAP;         // 69
  const SOUTH_ROW = SIDE_ROW  + HOUSE_H + INNER_GAP;         // 89
  const CENTRE_COL = midC - Math.floor(hw / 2);              // 67
  const WEST_COL   = CENTRE_COL - HOUSE_W - INNER_GAP;       // 43
  const EAST_COL   = CENTRE_COL + HOUSE_W + INNER_GAP;       // 91
  // Outer ring — clear of the E↔W exit corridor at row 75, and kept ≥2 tiles
  // clear of the village's inner border-wall ring on every side (the playfield
  // runs cols/rows 8..141, so the outer houses are pulled in off the wall):
  //   • Top + bottom rows: 4 houses each at cols 10 / 47 / 86 / 123. The two
  //     edge columns sit 2 tiles in from the side wall (houses span 10..26 and
  //     123..139, leaving cols 8–9 and 140–141 as the gap); ~20–22-tile gaps
  //     between adjacent houses. The top row (14) and bottom row (116) already
  //     clear the top/bottom wall by 6 and 13 tiles.
  //   • Side columns 10 and 123: two extra houses each at rows 48 and 82
  //     (21-row gaps from the top, between themselves, and to the bottom).
  //     Both side rows sit clear of row 75, so the W↔E exit corridor reaches
  //     the plaza unobstructed.
  const OUTER_TOP_ROW    = 14;
  const OUTER_BOTTOM_ROW = 116;
  const OUTER_COLS       = [10, 47, 86, 123];  // edge cols 2 tiles in from the wall
  const OUTER_SIDE_ROWS  = [48, 82];           // 21-tile vertical gap on side cols
  const OUTER_SIDE_COLS  = [10, 123];          // side cols, 2 tiles in from the wall
  const elementalHousePlacements = [
    // ── Inner ring (4 corners only) ──────────────────────────────────
    // The cardinal N/S/E/W positions are intentionally left empty so the
    // four exit corridors (row 75 west↔east, col 75 north↔south) reach
    // the plaza unobstructed.
    { hr: NORTH_ROW, hc: WEST_COL },  // NW
    { hr: NORTH_ROW, hc: EAST_COL },  // NE
    { hr: SOUTH_ROW, hc: WEST_COL },  // SW
    { hr: SOUTH_ROW, hc: EAST_COL },  // SE
    // ── Outer ring (12) ──────────────────────────────────────────────
    ...OUTER_COLS.map(hc => ({ hr: OUTER_TOP_ROW,    hc })),
    ...OUTER_COLS.map(hc => ({ hr: OUTER_BOTTOM_ROW, hc })),
    ...OUTER_SIDE_ROWS.flatMap(hr => OUTER_SIDE_COLS.map(hc => ({ hr, hc }))),
  ];
  // Forest-only redraw: forty compact cottages arranged as eight close-knit
  // streets. The central axes remain open for the four gates and the fountain,
  // while the side lanes make the village feel inhabited all the way through.
  const forestHousePlacements = [
    ...[14, 34, 54, 87, 107, 127].map(hc => ({ hr: 16, hc })),
    ...[20, 38, 56, 85, 103, 121].map(hc => ({ hr: 34, hc })),
    ...[40, 52, 89, 101].map(hc => ({ hr: 52, hc })),
    ...[14, 27, 114, 127].map(hc => ({ hr: 66, hc })),
    ...[14, 27, 114, 127].map(hc => ({ hr: 80, hc })),
    ...[40, 52, 89, 101].map(hc => ({ hr: 91, hc })),
    ...[20, 38, 56, 85, 103, 121].map(hc => ({ hr: 108, hc })),
    ...[14, 34, 54, 87, 107, 127].map(hc => ({ hr: 126, hc })),
  ];
  const housePlacements = compactForest ? forestHousePlacements : elementalHousePlacements;
  housePlacements.forEach(({ hr, hc }) => house(hr, hc, hw, hh));
  const chestHouse = housePlacements.length
    ? housePlacements[Math.floor(genRandom() * housePlacements.length)]
    : null;

  scatter(m, DECOR, 120);

  // Re-seal the outer border + re-cut the cardinal exits (some operations
  // above may have painted over border tiles).
  for (let c = 0; c < MCOLS; c++) { m[0][c] = BORDER; m[MROWS - 1][c] = BORDER; }
  for (let r = 0; r < MROWS; r++) { m[r][0] = BORDER; m[r][MCOLS - 1] = BORDER; }
  cutExits(m, exits.left, exits.right, exits.up, exits.down);

  // Place the village's single chest now, after all path carving.
  if (chestHouse) m[chestHouse.hr + 2][chestHouse.hc + Math.floor(hw / 2)] = T.CHEST;

  // ─── 7×7 Roman fountain (placed last so roads can't wipe it) ────────────
  // Pillars along the four edges of a 7×7 footprint (rows ±3, cols ±3). The
  // four corners stay sand so the plaza has clean diagonal approaches.
  for (let dc = -2; dc <= 2; dc++) {
    m[midR - 3][midC + dc] = T.PILLAR;
    m[midR + 3][midC + dc] = T.PILLAR;
  }
  for (let dr = -2; dr <= 2; dr++) {
    m[midR + dr][midC - 3] = T.PILLAR;
    m[midR + dr][midC + 3] = T.PILLAR;
  }
  // Inner 5×5 fountain basin
  setRect(m, midR - 2, midC - 2, midR + 2, midC + 2, T.FOUNTAIN_WATER);
  // Central spurting spout
  m[midR][midC] = T.FOUNTAIN_SPOUT;
  // Cardinal + corner torches around the colonnade for night ambience
  m[midR - 5][midC] = T.TORCH; m[midR + 5][midC] = T.TORCH;
  m[midR][midC - 5] = T.TORCH; m[midR][midC + 5] = T.TORCH;
  m[midR - 5][midC - 5] = T.TORCH; m[midR - 5][midC + 5] = T.TORCH;
  m[midR + 5][midC - 5] = T.TORCH; m[midR + 5][midC + 5] = T.TORCH;

  // ─── Boss chest: 2×2 King's Hoard ───────────────────────────────────────
  // The chest is NO LONGER painted here — the plaza south of the fountain is
  // left as bare marble at build time. The 2×2 King's Hoard (and its flanking
  // torches) materialises only once the village boss is defeated, and is
  // stripped the first time the hero leaves the village (see
  // placeVillageBossChest / removeVillageBossChest in player.js). Its position
  // is villageBossChestAnchor() (map-helpers.js): anchor (TL) at (midR+6,
  // midC-1), inside the 21×21 plaza (midR±10, midC±10), clear of the 7×7
  // fountain colonnade (midR±3).

  // ─── Replace dirt: turn every remaining PATH tile into ground ───────────
  // Forest villages look green (grass); desert villages look sandy (sand).
  for (let r = 0; r < MROWS; r++) {
    for (let c = 0; c < MCOLS; c++) {
      if (m[r][c] === T.PATH) m[r][c] = GROUND;
    }
  }

  // ─── Cobblestone paths: door → plaza, and exit → plaza ──────────────────
  // BFS from each start tile out through passable tiles until we touch the
  // marble plaza OR an existing cobblestone path. Two rules:
  //   1. The path stays ≥ 1 tile away from house walls (the only exception is
  //      the very first "doormat" tile directly south of a door, which is
  //      always wall-adjacent and is seeded directly).
  //   2. BFS also accepts COBBLESTONE as a terminal, so when a new path
  //      reaches another path's tile it merges instead of running parallel.
  //      Combined with #1 this means parallel paths within 3 grass tiles of
  //      each other tend to collapse into a single shared road.
  function tileAdjacentToWall(c, r) {
    for (let d = 0; d < 4; d++) {
      const dr = d === 0 ? 1 : d === 1 ? -1 : 0;
      const dc = d === 2 ? 1 : d === 3 ? -1 : 0;
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= MROWS || nc < 0 || nc >= MCOLS) continue;
      if (m[nr][nc] === T.WALL) return true;
    }
    return false;
  }
  function isPathPassable(c, r) {
    const t = m[r][c];
    if (t === T.MARBLE || t === T.COBBLESTONE) return true;
    if (t !== GROUND && t !== DECOR) return false;
    // 1-tile buffer from walls — ground directly bordering a house wall is
    // off-limits for path routing so the cobble doesn't hug the buildings.
    if (tileAdjacentToWall(c, r)) return false;
    return true;
  }
  function bfsToPlaza(startR, startC) {
    if (startR < 0 || startR >= MROWS || startC < 0 || startC >= MCOLS) return null;
    const startT = m[startR][startC];
    // Allow the start tile (door doormat) even though it's wall-adjacent.
    if (startT !== GROUND && startT !== DECOR &&
        startT !== T.MARBLE && startT !== T.COBBLESTONE) return null;
    const visited = new Uint8Array(MROWS * MCOLS);
    const parent  = new Int32Array(MROWS * MCOLS).fill(-1);
    const queue   = [startR * MCOLS + startC];
    visited[startR * MCOLS + startC] = 1;
    let endIdx = -1, qHead = 0;
    while (qHead < queue.length) {
      const idx = queue[qHead++];
      const r = (idx / MCOLS) | 0, c = idx % MCOLS;
      // Reached the plaza OR an already-laid cobblestone path — done.
      if (idx !== startR * MCOLS + startC &&
          (m[r][c] === T.MARBLE || m[r][c] === T.COBBLESTONE)) {
        endIdx = idx; break;
      }
      for (let d = 0; d < 4; d++) {
        const dr = d === 0 ? 1 : d === 1 ? -1 : 0;
        const dc = d === 2 ? 1 : d === 3 ? -1 : 0;
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr >= MROWS || nc < 0 || nc >= MCOLS) continue;
        const ni = nr * MCOLS + nc;
        if (visited[ni]) continue;
        if (!isPathPassable(nc, nr)) continue;
        visited[ni] = 1;
        parent[ni] = idx;
        queue.push(ni);
      }
    }
    if (endIdx < 0) return null;
    const path = [];
    for (let cur = endIdx; cur >= 0; cur = parent[cur]) {
      path.push([(cur / MCOLS) | 0, cur % MCOLS]);
    }
    return path;
  }
  function layCobble(path) {
    if (!path) return;
    for (const [r, c] of path) {
      // Don't paint over the marble plaza itself — paths stop at its edge.
      if (m[r][c] === GROUND || m[r][c] === DECOR) m[r][c] = T.COBBLESTONE;
    }
  }
  // Lay the exit corridors first so doors that BFS into one of them
  // naturally merge with the trunk instead of running parallel beside it.
  if (exits.left)  layCobble(bfsToPlaza(EXIT_ROW,  1));
  if (exits.right) layCobble(bfsToPlaza(EXIT_ROW,  MCOLS - 2));
  if (exits.up)    layCobble(bfsToPlaza(1,         EXIT_COL));
  if (exits.down)  layCobble(bfsToPlaza(MROWS - 2, EXIT_COL));
  // Then each door — its path will join the nearest exit trunk or marble.
  for (let r = 0; r < MROWS; r++) {
    for (let c = 0; c < MCOLS; c++) {
      const t = m[r][c];
      if (t === T.DOOR || t === T.INN_DOOR || t === T.STORE_DOOR) {
        layCobble(bfsToPlaza(r + 1, c));
      }
    }
  }

  // ─── Decoration against the outside of houses ───────────────────────────
  // For every ground tile adjacent to a WALL, randomly drop a decoration
  // (flowers in the forest, flowering cacti in the desert). Tiles next to a door are
  // skipped so doorways stay clear. Run AFTER cobblestone path-laying so the
  // decoration doesn't end up on the road.
  const isWall = (c, r) =>
    r >= 0 && r < MROWS && c >= 0 && c < MCOLS && m[r][c] === T.WALL;
  const isDoor = (c, r) =>
    r >= 0 && r < MROWS && c >= 0 && c < MCOLS &&
    (m[r][c] === T.DOOR || m[r][c] === T.INN_DOOR || m[r][c] === T.STORE_DOOR);
  // The water, ice, earth, and air villages skip this and dress their own
  // exteriors below. The water village's DECOR is solid WATER (which must never
  // hug a house wall: floodWaterVillage keeps the wall ring dry SAND, then a
  // beach-find pass adds coral + seashells). The ice village's DECOR is ICE —
  // removed here in favour of winter foliage hugging the houses, so the ice
  // village carries no ICE at all. The earth village's DECOR is MUD — replaced
  // below with mountain foliage (sage, moss, crystals), so the earth village
  // carries no MUD at all. The air village's DECOR is CLOUDBANK — replaced below
  // with sky foliage (sky blooms, wind reeds, storm thistles), so the air village
  // keeps a plain CLOUD floor instead.
  // (Lightning is also excluded — like air, it dresses its house rings with storm
  // foliage below instead of the STORM_BANK puffs this generic pass would lay.
  // Luminous is excluded too — it rings its houses with the sanctum's radiant
  // growth below instead of the LUMINOUS_GLOW pools this generic pass would lay,
  // so the luminous village keeps a plain warm LUMINOUS_FLOOR. Necrotic is
  // excluded too — it dresses its house rings with the wastes' decay (bone piles,
  // withered shrubs, carrion blooms) below, then rings the whole village in dead
  // trees, grave-dirt mounds, and cracked tombstones as a graveyard.)
  // (Poison is excluded too — it rings its houses with the swamp's rank growth
  // below, in place of the grass-backed MUSHROOM this generic pass would lay, then
  // claws mangroves out of the thicket border as a drowned forest.)
  // (Mana is excluded too — it rings its houses with the forest's abnormally large
  // growth below, then claws great trees out of the treeline border and raises more
  // as colossal landmarks, so the conclave sits in a flourishing overgrown forest.)
  if (regionId !== 'water' && regionId !== 'ice' && regionId !== 'earth' &&
      regionId !== 'air' && regionId !== 'lightning' && regionId !== 'luminous' &&
      regionId !== 'necrotic' && regionId !== 'poison' && regionId !== 'mana') {
    for (let r = 1; r < MROWS - 1; r++) {
      for (let c = 1; c < MCOLS - 1; c++) {
        if (m[r][c] !== GROUND) continue;
        const adjWall = isWall(c - 1, r) || isWall(c + 1, r) ||
                        isWall(c, r - 1) || isWall(c, r + 1);
        if (!adjWall) continue;
        const adjDoor = isDoor(c - 1, r) || isDoor(c + 1, r) ||
                        isDoor(c, r - 1) || isDoor(c, r + 1);
        if (adjDoor) continue;
        if (genRandom() < 0.55) m[r][c] = DECOR;
      }
    }
  }

  // Ice region: dress the snow ring around every house with winter foliage —
  // frost lilies (ice flowers) and winter berry bushes — in place of the ICE tiles
  // the generic pass above would have laid (the ice village carries no ICE). Mirrors
  // that scan: every SNOW tile touching a house WALL gets a chance, skipping tiles
  // next to a door so entrances stay clear. Both are passable 1-HP foliage that
  // revert to SNOW when cut, so connectivity is unaffected.
  if (regionId === 'ice') {
    for (let r = 1; r < MROWS - 1; r++) {
      for (let c = 1; c < MCOLS - 1; c++) {
        if (m[r][c] !== GROUND) continue;   // GROUND === T.SNOW here
        const adjWall = isWall(c - 1, r) || isWall(c + 1, r) ||
                        isWall(c, r - 1) || isWall(c, r + 1);
        if (!adjWall) continue;
        const adjDoor = isDoor(c - 1, r) || isDoor(c + 1, r) ||
                        isDoor(c, r - 1) || isDoor(c, r + 1);
        if (adjDoor) continue;
        if (genRandom() < 0.55) m[r][c] = genRandom() < 0.5 ? T.FROST_LILY : T.WINTER_BERRY_BUSH;
      }
    }
  }

  // Earth region: dress the scree ring around every house with mountain foliage —
  // sage shrubs, moss clumps, and amethyst crystal clusters — in place of the MUD
  // the generic pass above would have laid (the earth village carries no MUD).
  // Mirrors that scan: every SCREE tile touching a house WALL gets a chance,
  // skipping tiles next to a door so entrances stay clear. All three are passable
  // 1-HP foliage that revert to SCREE when cut, so connectivity is unaffected.
  if (regionId === 'earth') {
    for (let r = 1; r < MROWS - 1; r++) {
      for (let c = 1; c < MCOLS - 1; c++) {
        if (m[r][c] !== GROUND) continue;   // GROUND === T.SCREE here
        const adjWall = isWall(c - 1, r) || isWall(c + 1, r) ||
                        isWall(c, r - 1) || isWall(c, r + 1);
        if (!adjWall) continue;
        const adjDoor = isDoor(c - 1, r) || isDoor(c + 1, r) ||
                        isDoor(c, r - 1) || isDoor(c, r + 1);
        if (adjDoor) continue;
        if (genRandom() < 0.55) {
          const roll = genRandom();
          m[r][c] = roll < 0.4 ? T.MOUNTAIN_SAGE : roll < 0.8 ? T.MOSS_CLUMP : T.CRYSTAL_CLUSTER;
        }
      }
    }
  }

  // Air region: dress the cloud ring around every house with sky foliage — sky
  // blooms, wind reeds, and storm thistles — in place of the CLOUDBANK puffs the
  // generic pass above would have laid (the air village carries no CLOUDBANK).
  // Mirrors that scan: every CLOUD tile touching a house WALL gets a chance,
  // skipping tiles next to a door so entrances stay clear. All three are passable
  // 1-HP foliage that revert to CLOUD when cut, so connectivity is unaffected.
  if (regionId === 'air') {
    for (let r = 1; r < MROWS - 1; r++) {
      for (let c = 1; c < MCOLS - 1; c++) {
        if (m[r][c] !== GROUND) continue;   // GROUND === T.CLOUD here
        const adjWall = isWall(c - 1, r) || isWall(c + 1, r) ||
                        isWall(c, r - 1) || isWall(c, r + 1);
        if (!adjWall) continue;
        const adjDoor = isDoor(c - 1, r) || isDoor(c + 1, r) ||
                        isDoor(c, r - 1) || isDoor(c, r + 1);
        if (adjDoor) continue;
        if (genRandom() < 0.55) {
          const roll = genRandom();
          m[r][c] = roll < 0.4 ? T.SKY_BLOOM : roll < 0.8 ? T.WIND_REED : T.STORM_THISTLE;
        }
      }
    }
  }

  // Lightning region: dress the storm-cloud ring around every house with storm
  // foliage — volt blooms, spark reeds, and fulgurite shards — in place of the
  // STORM_BANK puffs the generic pass above would have laid (the lightning village
  // carries no STORM_BANK). The storm-region twin of the air block above: every
  // STORM_GROUND tile touching a house WALL gets a chance, skipping tiles next to a
  // door so entrances stay clear. All three are passable 1-HP foliage that revert
  // to STORM_GROUND when cut, so connectivity is unaffected.
  if (regionId === 'lightning') {
    for (let r = 1; r < MROWS - 1; r++) {
      for (let c = 1; c < MCOLS - 1; c++) {
        if (m[r][c] !== GROUND) continue;   // GROUND === T.STORM_GROUND here
        const adjWall = isWall(c - 1, r) || isWall(c + 1, r) ||
                        isWall(c, r - 1) || isWall(c, r + 1);
        if (!adjWall) continue;
        const adjDoor = isDoor(c - 1, r) || isDoor(c + 1, r) ||
                        isDoor(c, r - 1) || isDoor(c, r + 1);
        if (adjDoor) continue;
        if (genRandom() < 0.55) {
          const roll = genRandom();
          m[r][c] = roll < 0.4 ? T.VOLT_BLOOM : roll < 0.8 ? T.SPARK_REED : T.FULGURITE;
        }
      }
    }
  }

  // Luminous region: dress the radiant floor ring around every house with the
  // sanctum's growth — radiant blooms, glow-reeds, and lumen-shards — in place of
  // the LUMINOUS_GLOW pools the generic pass above would have laid (the luminous
  // village carries none). The luminous twin of the air/earth blocks: every
  // LUMINOUS_FLOOR tile touching a house WALL gets a chance, skipping tiles next to
  // a door so entrances stay clear. All three are passable 1-HP foliage that revert
  // to LUMINOUS_FLOOR when cut, so connectivity is unaffected.
  if (regionId === 'luminous') {
    for (let r = 1; r < MROWS - 1; r++) {
      for (let c = 1; c < MCOLS - 1; c++) {
        if (m[r][c] !== GROUND) continue;   // GROUND === T.LUMINOUS_FLOOR here
        const adjWall = isWall(c - 1, r) || isWall(c + 1, r) ||
                        isWall(c, r - 1) || isWall(c, r + 1);
        if (!adjWall) continue;
        const adjDoor = isDoor(c - 1, r) || isDoor(c + 1, r) ||
                        isDoor(c, r - 1) || isDoor(c, r + 1);
        if (adjDoor) continue;
        if (genRandom() < 0.55) {
          const roll = genRandom();
          m[r][c] = roll < 0.4 ? T.RADIANT_BLOOM : roll < 0.8 ? T.GLOW_REED : T.LUMEN_SHARD;
        }
      }
    }
  }

  // Necrotic region: dress the blight ring around every house with the wastes'
  // decay — bone piles, withered thorn brambles, and pale carrion blooms — in
  // place of the BONE_PILE the generic pass above would have laid. The necrotic
  // twin of the earth/air/luminous blocks: every BLIGHT tile touching a house WALL
  // gets a chance, skipping tiles next to a door so entrances stay clear. All three
  // are passable 1-HP foliage that revert to BLIGHT when cut, so connectivity is
  // unaffected.
  if (regionId === 'necrotic') {
    for (let r = 1; r < MROWS - 1; r++) {
      for (let c = 1; c < MCOLS - 1; c++) {
        if (m[r][c] !== GROUND) continue;   // GROUND === T.BLIGHT here
        const adjWall = isWall(c - 1, r) || isWall(c + 1, r) ||
                        isWall(c, r - 1) || isWall(c, r + 1);
        if (!adjWall) continue;
        const adjDoor = isDoor(c - 1, r) || isDoor(c + 1, r) ||
                        isDoor(c, r - 1) || isDoor(c, r + 1);
        if (adjDoor) continue;
        if (genRandom() < 0.55) {
          const roll = genRandom();
          m[r][c] = roll < 0.4 ? T.BONE_PILE : roll < 0.8 ? T.WITHERED_SHRUB : T.CORPSE_FLOWER;
        }
      }
    }
  }

  // Poison region: dress the mire ring around every house with the swamp's rank
  // growth — cattail reeds, swamp ferns, and glowing poison toadstools — in place
  // of the grass-backed MUSHROOM the generic pass above would have laid. The swamp
  // twin of the earth/necrotic blocks: every SLUDGE tile touching a house WALL gets
  // a chance, skipping tiles next to a door so entrances stay clear. All three are
  // passable 1-HP foliage that revert to SLUDGE when cut, so connectivity is
  // unaffected.
  if (regionId === 'poison') {
    for (let r = 1; r < MROWS - 1; r++) {
      for (let c = 1; c < MCOLS - 1; c++) {
        if (m[r][c] !== GROUND) continue;   // GROUND === T.SLUDGE here
        const adjWall = isWall(c - 1, r) || isWall(c + 1, r) ||
                        isWall(c, r - 1) || isWall(c, r + 1);
        if (!adjWall) continue;
        const adjDoor = isDoor(c - 1, r) || isDoor(c + 1, r) ||
                        isDoor(c, r - 1) || isDoor(c, r + 1);
        if (adjDoor) continue;
        if (genRandom() < 0.55) {
          const roll = genRandom();
          m[r][c] = roll < 0.4 ? T.CATTAIL : roll < 0.8 ? T.SWAMP_FERN : T.SWAMP_MUSHROOM;
        }
      }
    }
  }

  // Mana region: dress the turf ring around every house with the forest's abnormally
  // large growth — giant blooms, towering ferns, and colossal glowing mushrooms — in
  // place of the FLOWER the generic pass above would have laid. The mana twin of the
  // earth/necrotic/poison blocks: every MANA_FLOOR tile touching a house WALL gets a
  // chance, skipping tiles next to a door so entrances stay clear. All three are
  // passable 1-HP foliage that revert to MANA_FLOOR when cut, so connectivity is
  // unaffected.
  if (regionId === 'mana') {
    for (let r = 1; r < MROWS - 1; r++) {
      for (let c = 1; c < MCOLS - 1; c++) {
        if (m[r][c] !== GROUND) continue;   // GROUND === T.MANA_FLOOR here
        const adjWall = isWall(c - 1, r) || isWall(c + 1, r) ||
                        isWall(c, r - 1) || isWall(c, r + 1);
        if (!adjWall) continue;
        const adjDoor = isDoor(c - 1, r) || isDoor(c + 1, r) ||
                        isDoor(c, r - 1) || isDoor(c, r + 1);
        if (adjDoor) continue;
        if (genRandom() < 0.55) {
          const roll = genRandom();
          m[r][c] = roll < 0.4 ? T.GIANT_BLOOM : roll < 0.8 ? T.VERDANT_FERN : T.GIANT_MUSHROOM;
        }
      }
    }
  }

  // Water region: flood ~80% of the open village ground to wadeable SHALLOW_WATER,
  // keeping a 3-tile sand margin along the cobble roads and a dry sand ring around
  // every house. Done after the roads/exteriors are final and before connectivity.
  if (regionId === 'water') floodWaterVillage(m);

  // Water region: dress the dry sand ring around every house with beach finds —
  // coral and seashells, the water village's answer to the flowers/cacti that hug
  // forest/desert houses. Mirrors the wall-adjacency scan above (every SAND tile
  // touching a house WALL gets a chance; tiles next to a door are skipped so the
  // entrances stay clear), but runs AFTER floodWaterVillage so the flood can't
  // wash the finds away — the wall ring it keeps dry is exactly what we decorate.
  // CORAL and SEASHELL are passable 1-HP foliage, so connectivity is unaffected.
  if (regionId === 'water') {
    for (let r = 1; r < MROWS - 1; r++) {
      for (let c = 1; c < MCOLS - 1; c++) {
        if (m[r][c] !== GROUND) continue;   // GROUND === T.SAND here
        const adjWall = isWall(c - 1, r) || isWall(c + 1, r) ||
                        isWall(c, r - 1) || isWall(c, r + 1);
        if (!adjWall) continue;
        const adjDoor = isDoor(c - 1, r) || isDoor(c + 1, r) ||
                        isDoor(c, r - 1) || isDoor(c, r + 1);
        if (adjDoor) continue;
        if (genRandom() < 0.55) m[r][c] = genRandom() < 0.5 ? T.CORAL : T.SEASHELL;
      }
    }
  }

  // preserveFloor=true so house interiors aren't sealed as border tiles
  ensureConnectivity(m, true, BORDER);

  // The ice village gets the same snowy treeline as its overworld maps.
  sprinkleSnowPines(m, regionId);

  // The necrotic village ("Ossuary of the Pale King") is dressed as a graveyard
  // like its overworld maps: gnarled DEAD_TREEs clawing out of the crypt-wall
  // border, mounds of GRAVE_DIRT churned across the open ground, and cracked
  // TOMBSTONEs standing among them. Run after the connectivity seal —
  // sprinkleDeadTrees only swaps solid wall for solid dead tree, sprinkleGraveDirt
  // only swaps passable blight for passable grave dirt, and addTombstones places
  // lone solid headstones only where the whole 8-neighbourhood is open — so the
  // passable graph (and the village's connectivity) is never affected.
  sprinkleDeadTrees(m, regionId);
  sprinkleGraveDirt(m, regionId);
  addTombstones(m, regionId, 8);

  // The poison village ("Mire-warden Citadel") is framed like its overworld swamp
  // maps: moss-draped MANGROVE trees clawing out of the thicket border so the
  // citadel sits in a drowned forest, with rotting fallen logs strewn across the
  // open mire. Run after the connectivity seal — sprinkleMangroves only swaps solid
  // wall for solid mangrove (solid → solid), and addFallenLogs only lays solid logs
  // where the whole footprint and its ring are open, so the passable graph (and the
  // village's connectivity) is never affected.
  sprinkleMangroves(m, regionId);
  addFallenLogs(m, regionId, 8);

  // The mana village ("Heartstone Conclave") is framed like its overworld maps as a
  // forest flourishing past nature: thick MANA_MOSS dappled across the open turf,
  // abnormally large GREAT_TREEs clawed out of the mana-veined treeline border, and
  // more GREAT_TREEs standing as colossal landmarks in the plaza. Run after the
  // connectivity seal — sprinkleManaMoss only swaps passable turf for passable moss,
  // sprinkleGreatTrees only swaps solid border for solid tree (solid → solid), and
  // addGreatTrees places lone solid giants only where the whole 8-neighbourhood is
  // open — so the passable graph (and the village's connectivity) is never affected.
  sprinkleManaMoss(m, regionId);
  sprinkleGreatTrees(m, regionId);
  // The village's random open landmark trees are the exceptionally large
  // COLOSSAL_TREE (not the smaller GREAT_TREE used in the overworld clearings),
  // spaced out so their big canopies don't overlap; plus a few on the border rim.
  addGreatTrees(m, regionId, 8, T.COLOSSAL_TREE, rnd(4, 6), 16);
  addColossalTrees(m, regionId, rnd(2, 4), 18);

  // The air village gets the same billowing cloud lip as its overworld maps — a
  // CLOUD_EDGE band ringing the walkable plaza just inside the SKY_GROUND border,
  // so the cloud the hero stands on has a fluffy edge in front of the distant
  // earth far below. Run after the connectivity seal: CLOUD_EDGE only ever
  // replaces solid SKY_GROUND (solid → solid), so the passable graph is untouched.
  ringCloudEdges(m, regionId);

  // Early/elemental villages get the same open-ground landmark as their overworld
  // maps — a mossy boulder (forest), obelisk (desert), driftwood (water), ice spire
  // (ice), standing stone (earth), cloud spire (air), or storm spire (lightning) —
  // standing in the open plaza. Run after the connectivity seal AND after
  // ringCloudEdges, like the overworld: each lone landmark drops only where its whole
  // 8-neighbourhood is open ground, so the village's connectivity is never affected.
  addRegionLandmarks(m, regionId, 8);

  // Note: the fast-travel portal is NOT placed here. A village only gains a
  // portal once it is cleared of monsters — see activateVillage, which stamps
  // it into the NW inner-ring house at activation time.
  return m;
}

// Layout of the village's portal house — the NW inner-ring house. Coordinates
// mirror buildVillageMap's house grid so activateVillage can reserve that
// house (keep it shopkeeper-free) and stamp the portal once the village is
// cleared.
function villageUsesCompactForestLayout(biome, map) {
  if (biome !== 'forest') return false;
  if (!map) return true;
  const t = map[58] && map[58][56];
  return t === T.DOOR || t === T.INN_DOOR || t === T.STORE_DOOR ||
         t === T.HERB_DOOR || t === T.SMITH_DOOR || t === T.SHRINE_DOOR;
}

function villagePortalLayout(biome, map) {
  if (villageUsesCompactForestLayout(biome, map)) {
    const r1 = 52, c1 = 52, w = 8, h = 6;
    return {
      portalR: r1 + 4,
      portalC: c1 + Math.floor(w / 2),
      doorR:   r1 + h,
      doorC:   c1 + Math.floor(w / 2),
    };
  }
  const midR = Math.floor(MROWS / 2), midC = Math.floor(MCOLS / 2);
  const hw = 16, hh = 12;
  const HOUSE_W = hw + 1;
  const INNER_GAP = 7;
  const NORTH_ROW  = midR - 14 - hh;                      // 49
  const CENTRE_COL = midC - Math.floor(hw / 2);           // 67
  const WEST_COL   = CENTRE_COL - HOUSE_W - INNER_GAP;    // 43
  return {
    portalR: NORTH_ROW + 4,
    portalC: WEST_COL + Math.floor(hw / 2),
    doorR:   NORTH_ROW + hh,
    doorC:   WEST_COL + Math.floor(hw / 2),
  };
}

// The northeast inner-ring house is reserved for its regional shrine. Its
// south-facing door is never eligible for a shop conversion.
function villageShrineLayout(biome, map) {
  if (villageUsesCompactForestLayout(biome, map)) {
    const r1 = 52, c1 = 89, w = 8, h = 6;
    return {
      doorR: r1 + h,
      doorC: c1 + Math.floor(w / 2),
      returnR: r1 + h + 1,
      returnC: c1 + Math.floor(w / 2),
    };
  }
  const NORTH_ROW = 49, EAST_COL = 91, HW = 17, HH = 13;
  return {
    doorR: NORTH_ROW + HH - 1,
    doorC: EAST_COL + Math.floor(HW / 2),
    returnR: NORTH_ROW + HH,
    returnC: EAST_COL + Math.floor(HW / 2),
  };
}
