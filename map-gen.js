// ─── Map generators ───────────────────────────────────────────────────────────
// Two map types: forest (procedural) and village (fixed layout for the boss).
// Both call ensureConnectivity at the end to guarantee no orphaned content.

// Pool of evocative names — depth number appended for clarity in the HUD.
const FOREST_NAMES = [
  'Whispering Grove', 'Mossy Hollow', 'Thornwood Pass', 'Shadowed Glade',
  'Fernwood Thicket', 'Ancient Canopy', 'Bogwood Crossing', 'Moonlit Clearing',
  'Crimson Oak Dell', 'Twisted Roots', 'Spider Hollow', 'Frostvine Path',
  'Elder Stump', 'Lanternfly Glade', 'Fungal Depths', 'Ruins of Sylvan',
  'Brookside Thicket', 'Mirkwood Passage', 'Glowshroom Hollow', 'Bramblewood'
];

const DESERT_NAMES = [
  'Scorching Dunes', 'Bleached Wastes', 'Sunbaked Flats', 'Mirage Hollow',
  'Cactus Reach', 'Bonefield', 'Vulture Crossing', 'Glassand Plateau',
  'Salt Pan', 'Wind-Carved Cliffs', 'Sandstone Maze', 'Sirocco Pass',
  'Dust Devil Plains', 'Sunstruck Ruins', 'Forgotten Oasis', 'Buzzard Gulch',
  'Quicksand Basin', 'Obsidian Spires', 'Ember Reach', 'Skeleton Mesa'
];

// ─── Forest map ───────────────────────────────────────────────────────────────
// Starts as wall-to-wall trees, then carves open regions, paths, water features,
// and finally scatters decorations and treasure.
//
// `openSides` is an optional { left, right, up, down } flag set restricting which
// border exits get cut. Defaults to all four open. Sealed dead-end maps spawned
// after the village is saved pass a single-side object here.
function buildForestMap(seed, depth, openSides) {
  const open = openSides || { left: true, right: true, up: true, down: true };
  const m = makeTile(MROWS, MCOLS, T.TREE);

  // Phase 1: random open grass patches
  const patchCount = 60 + depth * 2;
  for (let i = 0; i < patchCount; i++) {
    const pr = rnd(5, MROWS - 6), pc = rnd(5, MCOLS - 6);
    const pw = rnd(3, 10), ph = rnd(3, 10);
    setRect(m, pr, pc, Math.min(pr + ph, MROWS - 2), Math.min(pc + pw, MCOLS - 2), T.GRASS);
  }

  // Phase 2: main path network connecting centre to each *open* exit
  const midR = Math.floor(MROWS / 2), midC = Math.floor(MCOLS / 2);
  if (open.up)    drunkWalk(m, midR, midC, 1,         EXIT_COL,   T.PATH, 1);
  if (open.down)  drunkWalk(m, midR, midC, MROWS - 2, EXIT_COL,   T.PATH, 1);
  if (open.left)  drunkWalk(m, midR, midC, EXIT_ROW,  1,          T.PATH, 1);
  if (open.right) drunkWalk(m, midR, midC, EXIT_ROW,  MCOLS - 2,  T.PATH, 1);
  // Extra wandering grass paths for visual variety
  for (let i = 0; i < 6; i++) {
    const r1 = rnd(10, MROWS - 10), c1 = rnd(10, MCOLS - 10);
    const r2 = rnd(10, MROWS - 10), c2 = rnd(10, MCOLS - 10);
    drunkWalk(m, r1, c1, r2, c2, T.GRASS, 1);
  }

  // Phase 3: special clearings (homes for chests/shrines)
  const clearings = [];
  for (let i = 0; i < 8; i++) {
    const cr = rnd(15, MROWS - 15), cc = rnd(15, MCOLS - 15);
    const cr2 = rnd(8, 16), cc2 = rnd(8, 16);
    setRect(m, cr, cc, Math.min(cr + cr2, MROWS - 2), Math.min(cc + cc2, MCOLS - 2), T.GRASS);
    clearings.push({ r: cr + Math.floor(cr2 / 2), c: cc + Math.floor(cc2 / 2) });
  }

  // Phase 4: water features with bridges
  const waterCount = 2 + Math.floor(depth / 4);
  for (let i = 0; i < waterCount; i++) {
    const wr = rnd(20, MROWS - 25), wc = rnd(20, MCOLS - 25);
    const ws = rnd(5, 12);
    const wr2 = Math.min(wr + ws, MROWS - 2), wc2 = Math.min(wc + ws, MCOLS - 2);
    setRect(m, wr, wc, wr2, wc2, T.WATER);
    if (wr2 - wr > 4 && wc2 - wc > 4) {
      setRect(m, wr + 2, wc + 2, wr2 - 2, wc2 - 2, T.DEEP_WATER);
    }
    const bridgeR = Math.floor((wr + wr2) / 2);
    setRow(m, bridgeR, Math.max(1, wc - 1), Math.min(MCOLS - 2, wc2 + 1), T.BRIDGE);
  }

  // Phase 5: sparse rocks (destructible with bombs)
  for (let i = 0; i < 80 + depth; i++) {
    const rr = rnd(2, MROWS - 3), rc = rnd(2, MCOLS - 3);
    if ((m[rr][rc] === T.GRASS || m[rr][rc] === T.PATH) && Math.random() < 0.3) {
      m[rr][rc] = T.ROCK;
    }
  }

  // Phase 6: decorations — flowers, mushrooms, ferns
  scatter(m, T.FLOWER, 200);
  scatter(m, T.MUSHROOM, 150);
  scatter(m, T.FERN, 180);

  // Phase 7: pick the chest spot now (one per map), but defer the actual write
  // until after the later drunkWalk passes so paths can't overwrite it.
  const chestSpot = clearings.length
    ? clearings[Math.floor(Math.random() * clearings.length)]
    : null;

  // Phase 8: occasional shrine (full HP heal)
  if (clearings.length > 0 && Math.random() < 0.4) {
    const cl = clearings[Math.floor(Math.random() * clearings.length)];
    m[cl.r][cl.c] = T.SHRINE;
    if (cl.c > 0)         m[cl.r][cl.c - 1] = T.TORCH;
    if (cl.c < MCOLS - 1) m[cl.r][cl.c + 1] = T.TORCH;
  }

  // Phase 9: rare ruined dungeon at deeper depths
  if (depth > 5 && Math.random() < 0.5) {
    const dr = rnd(30, MROWS - 40), dc = rnd(30, MCOLS - 40);
    const tooCloseToExit = Math.abs(dr - EXIT_ROW) < 8 || Math.abs(dc - EXIT_COL) < 8;
    if (!tooCloseToExit) {
      setRect(m, dr, dc, dr + 6, dc + 8, T.FLOOR);
      m[dr + 3][dc + 4] = T.DUNGEON_DOOR;
      m[dr][dc] = T.PILLAR;       m[dr][dc + 8] = T.PILLAR;
      m[dr + 6][dc] = T.PILLAR;   m[dr + 6][dc + 8] = T.PILLAR;
      m[dr + 1][dc + 3] = T.TORCH; m[dr + 1][dc + 5] = T.TORCH;
    }
  }

  // Ensure exit corridors are wide and reach interior — only for *open* sides
  cutExits(m, open.left, open.right, open.up, open.down);
  if (open.left)  drunkWalk(m, EXIT_ROW, 1,           EXIT_ROW, midC,    T.PATH, 1);
  if (open.right) drunkWalk(m, EXIT_ROW, MCOLS - 2,   EXIT_ROW, midC,    T.PATH, 1);
  if (open.up)    drunkWalk(m, 1,           EXIT_COL, midR,     EXIT_COL, T.PATH, 1);
  if (open.down)  drunkWalk(m, MROWS - 2,   EXIT_COL, midR,     EXIT_COL, T.PATH, 1);

  // Final border lock + re-cut exits
  for (let c = 0; c < MCOLS; c++) { m[0][c] = T.TREE; m[MROWS - 1][c] = T.TREE; }
  for (let r = 0; r < MROWS; r++) { m[r][0] = T.TREE; m[r][MCOLS - 1] = T.TREE; }
  cutExits(m, open.left, open.right, open.up, open.down);

  // Now place the single chest. Done after all path carving so nothing can
  // overwrite it; ensureConnectivity preserves CHEST tiles.
  if (chestSpot) m[chestSpot.r][chestSpot.c] = T.CHEST;

  // Guarantee everything passable is reachable from at least one exit
  ensureConnectivity(m);

  return m;
}

// ─── Desert map ───────────────────────────────────────────────────────────────
// Tier-2 overworld unlocked after the village is activated. SAND base with
// cacti as the equivalent of trees (solid border + sparse interior), DUNE
// patches as visual variety, the occasional oasis (water surrounded by
// palm-cactus), bones as decoration, and rock/lava hazards at higher depth.
function buildDesertMap(seed, depth, openSides) {
  const open = openSides || { left: true, right: true, up: true, down: true };
  const m = makeTile(MROWS, MCOLS, T.CACTUS);

  // Phase 1: carve open sand patches across the map
  const patchCount = 60 + depth * 2;
  for (let i = 0; i < patchCount; i++) {
    const pr = rnd(5, MROWS - 6), pc = rnd(5, MCOLS - 6);
    const pw = rnd(3, 10), ph = rnd(3, 10);
    setRect(m, pr, pc, Math.min(pr + ph, MROWS - 2), Math.min(pc + pw, MCOLS - 2), T.SAND);
  }

  // Phase 2: main paths connecting centre to each open exit
  const midR = Math.floor(MROWS / 2), midC = Math.floor(MCOLS / 2);
  if (open.up)    drunkWalk(m, midR, midC, 1,         EXIT_COL,   T.PATH, 1);
  if (open.down)  drunkWalk(m, midR, midC, MROWS - 2, EXIT_COL,   T.PATH, 1);
  if (open.left)  drunkWalk(m, midR, midC, EXIT_ROW,  1,          T.PATH, 1);
  if (open.right) drunkWalk(m, midR, midC, EXIT_ROW,  MCOLS - 2,  T.PATH, 1);
  for (let i = 0; i < 6; i++) {
    const r1 = rnd(10, MROWS - 10), c1 = rnd(10, MCOLS - 10);
    const r2 = rnd(10, MROWS - 10), c2 = rnd(10, MCOLS - 10);
    drunkWalk(m, r1, c1, r2, c2, T.SAND, 1);
  }

  // Phase 3: special clearings (homes for chests/shrines)
  const clearings = [];
  for (let i = 0; i < 8; i++) {
    const cr = rnd(15, MROWS - 15), cc = rnd(15, MCOLS - 15);
    const cr2 = rnd(8, 16), cc2 = rnd(8, 16);
    setRect(m, cr, cc, Math.min(cr + cr2, MROWS - 2), Math.min(cc + cc2, MCOLS - 2), T.SAND);
    clearings.push({ r: cr + Math.floor(cr2 / 2), c: cc + Math.floor(cc2 / 2) });
  }

  // Phase 4: dune fields — soft sand bumps for visual variety (passable)
  const duneCount = 6 + Math.floor(depth / 2);
  for (let i = 0; i < duneCount; i++) {
    const wr = rnd(10, MROWS - 15), wc = rnd(10, MCOLS - 15);
    const ws = rnd(4, 10);
    const wr2 = Math.min(wr + ws, MROWS - 2), wc2 = Math.min(wc + ws, MCOLS - 2);
    for (let r = wr; r <= wr2; r++) {
      for (let c = wc; c <= wc2; c++) {
        if (m[r][c] === T.SAND && Math.random() < 0.7) m[r][c] = T.DUNE;
      }
    }
  }

  // Phase 5: oases — small water pools ringed by cacti (one or two per map)
  const oasisCount = 1 + (Math.random() < 0.5 ? 1 : 0);
  for (let i = 0; i < oasisCount; i++) {
    const or_ = rnd(20, MROWS - 25), oc = rnd(20, MCOLS - 25);
    const os = rnd(3, 5);
    setRect(m, or_, oc, or_ + os, oc + os, T.OASIS_WATER);
    // Cactus halo around the oasis
    for (let dr = -1; dr <= os + 1; dr++) {
      for (let dc = -1; dc <= os + 1; dc++) {
        const nr = or_ + dr, nc = oc + dc;
        if (nr <= 0 || nr >= MROWS - 1 || nc <= 0 || nc >= MCOLS - 1) continue;
        const onEdge = (dr === -1 || dr === os + 1 || dc === -1 || dc === os + 1);
        if (onEdge && m[nr][nc] !== T.OASIS_WATER && Math.random() < 0.45) m[nr][nc] = T.CACTUS;
      }
    }
    // Bridge straight across so the oasis isn't a wall
    const bridgeR = or_ + Math.floor(os / 2);
    setRow(m, bridgeR, Math.max(1, oc - 1), Math.min(MCOLS - 2, oc + os + 1), T.BRIDGE);
  }

  // Phase 6: scattered rocks (bombable) — denser than forest, this is desert
  for (let i = 0; i < 100 + depth; i++) {
    const rr = rnd(2, MROWS - 3), rc = rnd(2, MCOLS - 3);
    if ((m[rr][rc] === T.SAND || m[rr][rc] === T.PATH) && Math.random() < 0.3) {
      m[rr][rc] = T.ROCK;
    }
  }

  // Phase 7: bone decorations scattered across sand
  scatter(m, T.BONES, 60);
  // Sparse cacti scattered as obstacles in open sand
  for (let i = 0; i < 120; i++) {
    const rr = rnd(2, MROWS - 3), rc = rnd(2, MCOLS - 3);
    if (m[rr][rc] === T.SAND && Math.random() < 0.5) m[rr][rc] = T.CACTUS;
  }

  // Phase 8: chest spot (deferred)
  const chestSpot = clearings.length
    ? clearings[Math.floor(Math.random() * clearings.length)]
    : null;

  // Phase 9: occasional shrine (full HP heal) — flanked by torches
  if (clearings.length > 0 && Math.random() < 0.4) {
    const cl = clearings[Math.floor(Math.random() * clearings.length)];
    m[cl.r][cl.c] = T.SHRINE;
    if (cl.c > 0)         m[cl.r][cl.c - 1] = T.TORCH;
    if (cl.c < MCOLS - 1) m[cl.r][cl.c + 1] = T.TORCH;
  }

  // Phase 10: rare sunbaked ruins at deeper depths
  if (depth > 5 && Math.random() < 0.5) {
    const dr = rnd(30, MROWS - 40), dc = rnd(30, MCOLS - 40);
    const tooCloseToExit = Math.abs(dr - EXIT_ROW) < 8 || Math.abs(dc - EXIT_COL) < 8;
    if (!tooCloseToExit) {
      setRect(m, dr, dc, dr + 6, dc + 8, T.FLOOR);
      m[dr + 3][dc + 4] = T.DUNGEON_DOOR;
      m[dr][dc] = T.PILLAR;       m[dr][dc + 8] = T.PILLAR;
      m[dr + 6][dc] = T.PILLAR;   m[dr + 6][dc + 8] = T.PILLAR;
      m[dr + 1][dc + 3] = T.TORCH; m[dr + 1][dc + 5] = T.TORCH;
    }
  }

  // Ensure exit corridors reach interior
  cutExits(m, open.left, open.right, open.up, open.down);
  if (open.left)  drunkWalk(m, EXIT_ROW, 1,           EXIT_ROW, midC,    T.PATH, 1);
  if (open.right) drunkWalk(m, EXIT_ROW, MCOLS - 2,   EXIT_ROW, midC,    T.PATH, 1);
  if (open.up)    drunkWalk(m, 1,           EXIT_COL, midR,     EXIT_COL, T.PATH, 1);
  if (open.down)  drunkWalk(m, MROWS - 2,   EXIT_COL, midR,     EXIT_COL, T.PATH, 1);

  // Final border lock with cacti + re-cut exits
  for (let c = 0; c < MCOLS; c++) { m[0][c] = T.CACTUS; m[MROWS - 1][c] = T.CACTUS; }
  for (let r = 0; r < MROWS; r++) { m[r][0] = T.CACTUS; m[r][MCOLS - 1] = T.CACTUS; }
  cutExits(m, open.left, open.right, open.up, open.down);

  if (chestSpot) m[chestSpot.r][chestSpot.c] = T.CHEST;

  ensureConnectivity(m, false, T.CACTUS);

  return m;
}

// ─── Village activation ──────────────────────────────────────────────────────
// Called when the player clears every enemy in a village map. Converts two
// random house doors into an INN_DOOR and a STORE_DOOR so the player can spend
// their rupees. Idempotent — re-entering the cleared village keeps the doors.
function activateVillage(mapObj) {
  if (!mapObj || mapObj.activated) return false;
  const m = mapObj.map;
  const doors = [];
  for (let r = 0; r < MROWS; r++)
    for (let c = 0; c < MCOLS; c++)
      if (m[r][c] === T.DOOR) doors.push({ r, c });
  if (doors.length < 2) return false;
  // Shuffle (Fisher–Yates) and pick the first two for inn + store
  for (let i = doors.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [doors[i], doors[j]] = [doors[j], doors[i]];
  }
  m[doors[0].r][doors[0].c] = T.INN_DOOR;
  m[doors[1].r][doors[1].c] = T.STORE_DOOR;
  mapObj.activated = true;
  // Remember where the player can come back to
  mapObj.innDoor = doors[0];
  mapObj.storeDoor = doors[1];
  // Rename so the HUD reflects the change
  if (!/Active/.test(mapObj.name)) mapObj.name = mapObj.name + ' (Active)';
  // Reveal the whole village so the player can find the new doors immediately.
  if (!mapObj.fog) mapObj.fog = new Uint8Array(MROWS * MCOLS);
  mapObj.fog.fill(1);
  return true;
}

// ─── Cave map ─────────────────────────────────────────────────────────────────
// A small 20×20 chamber centred in the standard 150×150 grid, surrounded by
// solid wall. Contains one CAVE_EXIT (back to the source map) and one
// LARGE_CHEST that grants the +2 Sword / +2 Armor reward.
function buildCaveMap() {
  const m = makeTile(MROWS, MCOLS, T.WALL);
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
  // Large chest at the back
  m[cy - half + 3][cx] = T.LARGE_CHEST;
  // Atmosphere: torches at the corners
  m[cy - half + 1][cx - half + 1] = T.TORCH;
  m[cy - half + 1][cx + half - 2] = T.TORCH;
  m[cy + half - 2][cx - half + 1] = T.TORCH;
  m[cy + half - 2][cx + half - 2] = T.TORCH;
  return m;
}

// ─── Desert village map ─────────────────────────────────────────────────────
// Thin wrapper: the same fixed village layout rendered with a desert palette
// (cactus border, sand ground, bone decorations). Used as the boss arena at the
// end of the desert region.
function buildDesertVillageMap() {
  return buildVillageMap('desert');
}

// ─── Village map ──────────────────────────────────────────────────────────────
// Fixed layout used as the boss arena at the end of a region. 18 houses around
// a central fountain plaza. `biome` selects the palette: 'forest' (trees +
// grass + flowers) or 'desert' (cacti + sand + bones).
function buildVillageMap(biome) {
  const isDesert = biome === 'desert';
  const BORDER = isDesert ? T.CACTUS : T.TREE;   // perimeter wall tile
  const GROUND = isDesert ? T.SAND   : T.GRASS;  // open ground tile
  const DECOR  = isDesert ? T.BONES  : T.FLOWER; // scattered ground decoration
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
  cutExits(m, true, true, true, true);
  drunkWalk(m, EXIT_ROW, 1,         EXIT_ROW, midC,    T.PATH, 2);
  drunkWalk(m, EXIT_ROW, MCOLS - 2, EXIT_ROW, midC,    T.PATH, 2);
  drunkWalk(m, 1,         EXIT_COL, midR,     EXIT_COL, T.PATH, 2);
  drunkWalk(m, MROWS - 2, EXIT_COL, midR,     EXIT_COL, T.PATH, 2);

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
    m[r1 + 3][c1 + 2] = T.BED;
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

  // 18 houses with uniform spacing.
  //
  //   • House dimensions: 17 cols wide × 13 rows tall (hw=16, hh=12 inclusive).
  //   • Inner ring (8) wraps the fountain with a 7-tile gap between adjacent
  //     houses in both directions.
  //   • Outer ring (10) lines the village perimeter — top and bottom rows
  //     each carry 4 houses with a uniform 22-tile horizontal gap; the two
  //     side houses sit at col 8 / col 125 (same columns as the corners).
  //
  const hw = 16, hh = 12;
  const HOUSE_W = hw + 1, HOUSE_H = hh + 1;     // 17, 13
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
  // Outer ring — uniform spacing on every axis AND clear of the E↔W exit
  // corridor at row 75:
  //   • Top + bottom rows: 4 houses each at cols 8 / 47 / 86 / 125, giving
  //     a uniform 22-tile horizontal gap between adjacent houses.
  //   • Side columns 8 and 125: two extra houses each at rows 48 and 82
  //     (21-row gaps from the top, between themselves, and to the bottom).
  //     Both side rows sit clear of row 75, so the W↔E exit corridor reaches
  //     the plaza unobstructed.
  const OUTER_TOP_ROW    = 14;
  const OUTER_BOTTOM_ROW = 116;
  const OUTER_COLS       = [8, 47, 86, 125];   // 22-tile horizontal gap
  const OUTER_SIDE_ROWS  = [48, 82];           // 21-tile vertical gap on side cols
  const OUTER_SIDE_COLS  = [8, 125];           // the two side columns
  const housePlacements = [
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
  housePlacements.forEach(({ hr, hc }) => house(hr, hc, hw, hh));
  const chestHouse = housePlacements.length
    ? housePlacements[Math.floor(Math.random() * housePlacements.length)]
    : null;

  scatter(m, DECOR, 120);

  // Re-seal the outer border + re-cut the cardinal exits (some operations
  // above may have painted over border tiles).
  for (let c = 0; c < MCOLS; c++) { m[0][c] = BORDER; m[MROWS - 1][c] = BORDER; }
  for (let r = 0; r < MROWS; r++) { m[r][0] = BORDER; m[r][MCOLS - 1] = BORDER; }
  cutExits(m, true, true, true, true);

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
  // Lay the four exit corridors first so doors that BFS into one of them
  // naturally merge with the trunk instead of running parallel beside it.
  layCobble(bfsToPlaza(EXIT_ROW,  1));
  layCobble(bfsToPlaza(EXIT_ROW,  MCOLS - 2));
  layCobble(bfsToPlaza(1,         EXIT_COL));
  layCobble(bfsToPlaza(MROWS - 2, EXIT_COL));
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
  // (flowers in the forest, bones in the desert). Tiles next to a door are
  // skipped so doorways stay clear. Run AFTER cobblestone path-laying so the
  // decoration doesn't end up on the road.
  const isWall = (c, r) =>
    r >= 0 && r < MROWS && c >= 0 && c < MCOLS && m[r][c] === T.WALL;
  const isDoor = (c, r) =>
    r >= 0 && r < MROWS && c >= 0 && c < MCOLS &&
    (m[r][c] === T.DOOR || m[r][c] === T.INN_DOOR || m[r][c] === T.STORE_DOOR);
  for (let r = 1; r < MROWS - 1; r++) {
    for (let c = 1; c < MCOLS - 1; c++) {
      if (m[r][c] !== GROUND) continue;
      const adjWall = isWall(c - 1, r) || isWall(c + 1, r) ||
                      isWall(c, r - 1) || isWall(c, r + 1);
      if (!adjWall) continue;
      const adjDoor = isDoor(c - 1, r) || isDoor(c + 1, r) ||
                      isDoor(c, r - 1) || isDoor(c, r + 1);
      if (adjDoor) continue;
      if (Math.random() < 0.55) m[r][c] = DECOR;
    }
  }

  // preserveFloor=true so house interiors aren't sealed as border tiles
  ensureConnectivity(m, true, BORDER);

  return m;
}
