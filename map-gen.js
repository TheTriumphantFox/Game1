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

// ─── Forest map ───────────────────────────────────────────────────────────────
// Starts as wall-to-wall trees, then carves open regions, paths, water features,
// and finally scatters decorations and treasure.
function buildForestMap(seed, depth) {
  const m = makeTile(MROWS, MCOLS, T.TREE);

  // Phase 1: random open grass patches
  const patchCount = 60 + depth * 2;
  for (let i = 0; i < patchCount; i++) {
    const pr = rnd(5, MROWS - 6), pc = rnd(5, MCOLS - 6);
    const pw = rnd(3, 10), ph = rnd(3, 10);
    setRect(m, pr, pc, Math.min(pr + ph, MROWS - 2), Math.min(pc + pw, MCOLS - 2), T.GRASS);
  }

  // Phase 2: main path network connecting centre to each exit
  const midR = Math.floor(MROWS / 2), midC = Math.floor(MCOLS / 2);
  drunkWalk(m, midR, midC, 1,           EXIT_COL,    T.PATH, 1);
  drunkWalk(m, midR, midC, MROWS - 2,   EXIT_COL,    T.PATH, 1);
  drunkWalk(m, midR, midC, EXIT_ROW,    1,           T.PATH, 1);
  drunkWalk(m, midR, midC, EXIT_ROW,    MCOLS - 2,   T.PATH, 1);
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

  // Ensure exit corridors are wide and reach interior
  cutExits(m, true, true, true, true);
  drunkWalk(m, EXIT_ROW, 1,           EXIT_ROW, midC,    T.PATH, 1);
  drunkWalk(m, EXIT_ROW, MCOLS - 2,   EXIT_ROW, midC,    T.PATH, 1);
  drunkWalk(m, 1,           EXIT_COL, midR,     EXIT_COL, T.PATH, 1);
  drunkWalk(m, MROWS - 2,   EXIT_COL, midR,     EXIT_COL, T.PATH, 1);

  // Final border lock + re-cut exits
  for (let c = 0; c < MCOLS; c++) { m[0][c] = T.TREE; m[MROWS - 1][c] = T.TREE; }
  for (let r = 0; r < MROWS; r++) { m[r][0] = T.TREE; m[r][MCOLS - 1] = T.TREE; }
  cutExits(m, true, true, true, true);

  // Now place the single chest. Done after all path carving so nothing can
  // overwrite it; ensureConnectivity preserves CHEST tiles.
  if (chestSpot) m[chestSpot.r][chestSpot.c] = T.CHEST;

  // Guarantee everything passable is reachable from at least one exit
  ensureConnectivity(m);

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

// ─── Village map ──────────────────────────────────────────────────────────────
// Fixed layout used as the 21st map (the boss arena). 15 houses arranged in a
// 3×5 grid around a central fountain plaza.
function buildVillageMap() {
  const m = makeTile(MROWS, MCOLS, T.PATH);

  // Tree border (forest hugging the village)
  for (let r = 0; r < MROWS; r++) { m[r][0] = T.TREE; m[r][MCOLS - 1] = T.TREE; }
  for (let c = 0; c < MCOLS; c++) { m[0][c] = T.TREE; m[MROWS - 1][c] = T.TREE; }
  // Inner tree ring (thicker forest)
  for (let r = 1; r < 8; r++)             for (let c = 1; c < MCOLS - 1; c++) m[r][c] = T.TREE;
  for (let r = MROWS - 8; r < MROWS - 1; r++) for (let c = 1; c < MCOLS - 1; c++) m[r][c] = T.TREE;
  for (let r = 1; r < MROWS - 1; r++)     for (let c = 1; c < 8; c++)         m[r][c] = T.TREE;
  for (let r = 1; r < MROWS - 1; r++)     for (let c = MCOLS - 8; c < MCOLS - 1; c++) m[r][c] = T.TREE;

  // Village plaza (open paths)
  setRect(m, 8, 8, MROWS - 9, MCOLS - 9, T.PATH);

  // Central fountain with corner torches
  const midR = Math.floor(MROWS / 2), midC = Math.floor(MCOLS / 2);
  setRect(m, midR - 8, midC - 8, midR + 8, midC + 8, T.SAND);
  setRect(m, midR - 4, midC - 4, midR + 4, midC + 4, T.WATER);
  m[midR][midC] = T.STATUE;
  m[midR - 5][midC - 5] = T.TORCH; m[midR - 5][midC + 5] = T.TORCH;
  m[midR + 5][midC - 5] = T.TORCH; m[midR + 5][midC + 5] = T.TORCH;

  // Helper: build a house with walls, floor, a south-facing door, and torches.
  // Chest is deferred to the end of buildVillageMap so paths can't overwrite it.
  function house(r1, c1, w, h) {
    setRect(m, r1, c1, r1 + h, c1 + w, T.WALL);
    setRect(m, r1 + 1, c1 + 1, r1 + h - 1, c1 + w - 1, T.FLOOR);
    m[r1 + h][c1 + Math.floor(w / 2)] = T.DOOR;
    m[r1 + 1][c1 + 1] = T.TORCH;
    m[r1 + 1][c1 + w - 1] = T.TORCH;
  }

  // 3×5 grid of houses. One randomly chosen house position becomes the chest
  // spot — written at the very end.
  const hw = 16, hh = 12;
  const housePlacements = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 5; col++) {
      const hr = 14 + row * (hh + 14);
      const hc = 14 + col * (hw + 16);
      if (hr + hh < MROWS - 14 && hc + hw < MCOLS - 14) {
        housePlacements.push({ hr, hc });
      }
    }
  }
  housePlacements.forEach(({ hr, hc }) => house(hr, hc, hw, hh));
  const chestHouse = housePlacements.length
    ? housePlacements[Math.floor(Math.random() * housePlacements.length)]
    : null;

  // Roads through the village
  setRow(m, midR - 20, 8, MCOLS - 9, T.PATH);
  setRow(m, midR,      8, MCOLS - 9, T.PATH);
  setRow(m, midR + 20, 8, MCOLS - 9, T.PATH);
  setCol(m, midC - 20, 8, MROWS - 9, T.PATH);
  setCol(m, midC,      8, MROWS - 9, T.PATH);
  setCol(m, midC + 20, 8, MROWS - 9, T.PATH);

  scatter(m, T.FLOWER, 120);

  // Exit paths through the forest ring
  cutExits(m, true, true, true, true);
  drunkWalk(m, EXIT_ROW, 1,         EXIT_ROW, midC,    T.PATH, 2);
  drunkWalk(m, EXIT_ROW, MCOLS - 2, EXIT_ROW, midC,    T.PATH, 2);
  drunkWalk(m, 1,         EXIT_COL, midR,     EXIT_COL, T.PATH, 2);
  drunkWalk(m, MROWS - 2, EXIT_COL, midR,     EXIT_COL, T.PATH, 2);

  for (let c = 0; c < MCOLS; c++) { m[0][c] = T.TREE; m[MROWS - 1][c] = T.TREE; }
  for (let r = 0; r < MROWS; r++) { m[r][0] = T.TREE; m[r][MCOLS - 1] = T.TREE; }
  cutExits(m, true, true, true, true);

  // Place the village's single chest now, after all path carving.
  if (chestHouse) m[chestHouse.hr + 2][chestHouse.hc + Math.floor(hw / 2)] = T.CHEST;

  // preserveFloor=true so house interiors aren't sealed as trees
  ensureConnectivity(m, true);

  return m;
}
