// ─── Final castle tower map generation ────────────────────────────────────────
// The endgame castle rising from the last (shadow) village: a 14-floor ascending
// tower, one floor per elemental region in game order (forest → … → shadow) and
// the dragon's throne hall at the pinnacle. Floors are proper castle floor plans
// — a perimeter gallery, a central corridor spine and cross, a great hall, and
// BSP-style wing rooms — dressed in stone, carpet, torchlight, heraldic banners
// and arched windows, with each region's element bleeding through in courtyards
// and accent pools. Plain <script> globals (see index.html load order).
//
// ⚠ Connectivity: ensureConnectivity() floods from the four BORDER exit gates,
// and a tower floor has no open border — calling it would seal the whole castle.
// Floors are instead connected by construction (every room is carved a corridor
// straight into the gallery/spine network) and then self-verified with a flood
// from the entry stair that walls off any unreachable pocket (defense in depth,
// run BEFORE chests are placed so no chest is ever sealed away).

// Landmark centrepiece for each floor's elemental courtyards. Most regions have
// a REGION_LANDMARKS entry; the four later regions keep bespoke landmark passes
// in their own map builders, so they get hand-picked stand-ins here.
const TOWER_COURTYARD_LANDMARK = {
  luminous: () => T.LIGHT_PILLAR,
  necrotic: () => T.TOMBSTONE,
  poison:   () => T.FALLEN_LOG,
  mana:     () => T.GREAT_TREE,
};
function towerLandmarkTile(regionId) {
  const spec = REGION_LANDMARKS[regionId];
  if (spec) return spec.tile;
  const f = TOWER_COURTYARD_LANDMARK[regionId];
  return f ? f() : T.STATUE;
}

// Flood from (sr, sc) over passable tiles and seal every unreached passable tile
// back to WALL. Chest tiles aren't passable per SOLID_TILES semantics but none
// exist yet when this runs (chests are placed after). Returns reached count.
function towerSealUnreachable(m, sr, sc) {
  const seen = new Uint8Array(MROWS * MCOLS);
  const stack = [[sr, sc]];
  seen[sr * MCOLS + sc] = 1;
  let reached = 0;
  while (stack.length) {
    const [r, c] = stack.pop();
    reached++;
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= MROWS || nc >= MCOLS) continue;
      const k = nr * MCOLS + nc;
      if (seen[k] || SOLID_TILES.has(m[nr][nc])) continue;
      seen[k] = 1;
      stack.push([nr, nc]);
    }
  }
  for (let r = 0; r < MROWS; r++)
    for (let c = 0; c < MCOLS; c++)
      if (!SOLID_TILES.has(m[r][c]) && !seen[r * MCOLS + c]) m[r][c] = T.WALL;
  return reached;
}

// Stamp a solid accent pool (LAVA, SHADOW_RIFT, …) only where the pool AND its
// full 1-tile ring sit on plain FLOOR — a solid accent can then never wall a
// corridor or pinch a doorway (the tombstone-idiom safety check).
function towerStampAccentPool(m, r0, c0, h, w, tile) {
  for (let r = r0 - 1; r <= r0 + h; r++)
    for (let c = c0 - 1; c <= c0 + w - 1 + 1; c++) {
      if (r < 0 || c < 0 || r >= MROWS || c >= MCOLS) return false;
      if (m[r][c] !== T.FLOOR && m[r][c] !== T.CARPET) return false;
    }
  for (let r = r0; r < r0 + h; r++)
    for (let c = c0; c < c0 + w; c++)
      if (m[r][c] === T.FLOOR) m[r][c] = tile;
  return true;
}

// Swap wall-run tiles facing walkable floor to a dressing tile (BANNER /
// CASTLE_WINDOW) every `stride` tiles. Solid→solid, so it can never change
// connectivity. `faceTiles` is the set a wall must face to qualify.
function towerDressWalls(m, dressing, stride, phase) {
  const walkable = (r, c) =>
    r >= 0 && c >= 0 && r < MROWS && c < MCOLS && !SOLID_TILES.has(m[r][c]);
  for (let r = 1; r < MROWS - 1; r++)
    for (let c = 1; c < MCOLS - 1; c++) {
      if (m[r][c] !== T.WALL) continue;
      if ((r * 31 + c) % stride !== phase) continue;
      // Face into open floor on exactly one side (a wall face, not a corner nub).
      if (walkable(r + 1, c) || walkable(r - 1, c) || walkable(r, c + 1) || walkable(r, c - 1))
        m[r][c] = dressing;
    }
}

// Torches on floor tiles hugging a wall, spaced out on a hash stride so the
// galleries and halls read torch-lit without carpeting the place in flames.
function towerPlaceTorches(m, stride) {
  const isWall = (r, c) => m[r][c] === T.WALL || m[r][c] === T.BANNER || m[r][c] === T.CASTLE_WINDOW;
  for (let r = 2; r < MROWS - 2; r++)
    for (let c = 2; c < MCOLS - 2; c++) {
      if (m[r][c] !== T.FLOOR) continue;
      if ((r * 53 + c * 17) % stride !== 0) continue;
      if (isWall(r - 1, c) || isWall(r + 1, c) || isWall(r, c - 1) || isWall(r, c + 1))
        m[r][c] = T.TORCH;
    }
}

// One elemental courtyard: refloor a wing room's interior with the region's
// ground, scatter its decoration (solid decorations get the 8-neighbourhood
// safety check), and stand the region's landmark at its heart.
function towerDressCourtyard(m, room, region) {
  const { r0, c0, r1, c1 } = room;
  // Interior only — keep a 1-tile flagstone rim so the doorway threshold and
  // wall foot stay castle stone.
  const ir0 = r0 + 1, ic0 = c0 + 1, ir1 = r1 - 1, ic1 = c1 - 1;
  if (ir1 - ir0 < 4 || ic1 - ic0 < 4) return;
  for (let r = ir0; r <= ir1; r++)
    for (let c = ic0; c <= ic1; c++)
      if (m[r][c] === T.FLOOR) m[r][c] = region.ground;
  const groundOk = (r, c) => m[r][c] === region.ground || m[r][c] === region.decoration;
  // Scatter the region's decoration across the courtyard ground. A solid
  // decoration (e.g. the water region's open WATER) only lands where its whole
  // 8-neighbourhood is courtyard ground, so it can never plug the doorway.
  const solidDeco = SOLID_TILES.has(region.decoration);
  let placed = 0, tries = 0;
  while (placed < 12 && tries < 300) {
    tries++;
    const r = rnd(ir0 + 1, ir1 - 1), c = rnd(ic0 + 1, ic1 - 1);
    if (m[r][c] !== region.ground) continue;
    if (solidDeco) {
      let clear = true;
      for (let dr = -1; dr <= 1 && clear; dr++)
        for (let dc = -1; dc <= 1; dc++)
          if ((dr || dc) && !groundOk(r + dr, c + dc)) { clear = false; break; }
      if (!clear) continue;
    }
    m[r][c] = region.decoration;
    placed++;
  }
  // Landmark centrepiece — solid, so it needs the same full-ring check.
  const lm = towerLandmarkTile(region.id);
  const cr = Math.floor((ir0 + ir1) / 2), cc = Math.floor((ic0 + ic1) / 2);
  let ok = true;
  for (let dr = -1; dr <= 1 && ok; dr++)
    for (let dc = -1; dc <= 1; dc++)
      if ((dr || dc) && !groundOk(cr + dr, cc + dc)) { ok = false; break; }
  if (ok) m[cr][cc] = lm;
}

// ─── Floors 1–13: castle floor plan ───────────────────────────────────────────
function buildTowerFloorPlan(region) {
  const m = makeTile(MROWS, MCOLS, T.WALL);
  const midR = EXIT_ROW, midC = EXIT_COL;                       // 75, 75

  // Perimeter gallery — a 5-wide corridor ring just inside the tower's outer
  // wall (footprint ~130×130 centered).
  const G0 = 12, G1 = 16, G2 = 133, G3 = 137;
  setRect(m, G0, G0, G1, G3, T.FLOOR);                          // north gallery
  setRect(m, G2, G0, G3, G3, T.FLOOR);                          // south gallery
  setRect(m, G0, G0, G3, G1, T.FLOOR);                          // west gallery
  setRect(m, G0, G2, G3, G3, T.FLOOR);                          // east gallery

  // Central spine (N–S) and cross (E–W) — every floor shares this axis so the
  // castle reads coherent as you climb.
  setRect(m, G0, midC - 3, G3, midC + 3, T.FLOOR);
  setRect(m, midR - 3, G0, midR + 3, G3, T.FLOOR);

  // Great hall at the heart — also guarantees the map centre is open for the
  // village-branch boss spawn spiral.
  const hallR0 = midR - 22, hallR1 = midR + 22, hallC0 = midC - 15, hallC1 = midC + 15;
  setRect(m, hallR0, hallC0, hallR1, hallC1, T.FLOOR);

  // Wing rooms — each quadrant between gallery/spine gets a small grid of
  // varied-size chambers, and every room is guaranteed onto the network by a
  // 3-wide corridor carved from its heart straight to the spine or cross.
  const rooms = [];
  const quads = [
    { r0: G1 + 3, r1: midR - 7, c0: G1 + 3, c1: midC - 7 },     // NW
    { r0: G1 + 3, r1: midR - 7, c0: midC + 7, c1: G2 - 3 },     // NE
    { r0: midR + 7, r1: G2 - 3, c0: G1 + 3, c1: midC - 7 },     // SW
    { r0: midR + 7, r1: G2 - 3, c0: midC + 7, c1: G2 - 3 },     // SE
  ];
  for (const q of quads) {
    // 2×2 cells per quadrant, each cell hosting one inset room.
    const cellH = Math.floor((q.r1 - q.r0) / 2), cellW = Math.floor((q.c1 - q.c0) / 2);
    for (let i = 0; i < 2; i++)
      for (let j = 0; j < 2; j++) {
        const cr0 = q.r0 + i * cellH, cc0 = q.c0 + j * cellW;
        const inR = rnd(2, 4), inC = rnd(2, 4);
        const r0 = cr0 + inR, c0 = cc0 + inC;
        const r1 = Math.min(cr0 + cellH - rnd(2, 4), q.r1);
        const c1 = Math.min(cc0 + cellW - rnd(2, 4), q.c1);
        if (r1 - r0 < 6 || c1 - c0 < 6) continue;
        setRect(m, r0, c0, r1, c1, T.FLOOR);
        rooms.push({ r0, c0, r1, c1 });
        // Corridor from the room's heart straight to the nearest axis (the
        // spine column or cross row), 3 wide — merges with existing floor on
        // the way, guaranteeing the room joins the connected network.
        const rc = Math.floor((r0 + r1) / 2), cc = Math.floor((c0 + c1) / 2);
        if (Math.abs(cc - midC) <= Math.abs(rc - midR)) {
          const step = cc < midC ? 1 : -1;                       // toward spine
          for (let c = cc; c !== midC; c += step) setRect(m, rc - 1, c, rc + 1, c, T.FLOOR);
        } else {
          const step = rc < midR ? 1 : -1;                       // toward cross
          for (let r = rc; r !== midR; r += step) setRect(m, r, cc - 1, r, cc + 1, T.FLOOR);
        }
      }
  }

  return { m, rooms, hall: { r0: hallR0, c0: hallC0, r1: hallR1, c1: hallC1 } };
}

// Dress a floor plan in its region's element while keeping it unmistakably a
// castle: carpet down the spine, colonnades and torchlight in the great hall,
// heraldic banners and arched windows in the walls, elemental courtyards in two
// wing rooms, and accent pools flanking the hall carpet.
function dressTowerFloor(m, rooms, hall, region) {
  const midR = EXIT_ROW, midC = EXIT_COL;

  // Crimson carpet runner the length of the spine (gatehouse to gatehouse).
  for (let r = 2; r <= MROWS - 3; r++)
    for (let c = midC - 1; c <= midC + 1; c++)
      if (m[r][c] === T.FLOOR) m[r][c] = T.CARPET;

  // Great-hall colonnades — pillar pairs flanking the carpet, skipping the
  // cross-corridor band, each pillar ringed by open floor so it never pinches.
  for (let r = hall.r0 + 3; r <= hall.r1 - 3; r += 5) {
    if (Math.abs(r - midR) <= 4) continue;                       // cross corridor
    for (const c of [midC - 11, midC + 11]) {
      let clear = true;
      for (let dr = -1; dr <= 1 && clear; dr++)
        for (let dc = -1; dc <= 1; dc++)
          if (m[r + dr][c + dc] !== T.FLOOR) { clear = false; break; }
      if (clear) m[r][c] = T.PILLAR;
    }
  }

  // Heraldic banners on room-facing wall runs; arched windows in the outer wall.
  towerDressWalls(m, T.BANNER, 9, 4);
  for (const [wr0, wc0, wr1, wc1] of [[11, 11, 11, 138], [138, 11, 138, 138], [11, 11, 138, 11], [11, 138, 138, 138]]) {
    for (let r = wr0; r <= wr1; r++)
      for (let c = wc0; c <= wc1; c++) {
        if (m[r][c] !== T.WALL) continue;
        if ((r + c) % 11 !== 0) continue;
        // Must face the gallery so the hero actually walks past it.
        if (!SOLID_TILES.has(m[r + (wr0 === wr1 ? (wr0 < 75 ? 1 : -1) : 0)][c + (wc0 === wc1 ? (wc0 < 75 ? 1 : -1) : 0)]))
          m[r][c] = T.CASTLE_WINDOW;
      }
  }

  // Torchlight along the walls.
  towerPlaceTorches(m, 23);

  // Two elemental courtyards in wing rooms (pick the two largest for space).
  const byArea = rooms.slice().sort((a, b) =>
    (b.r1 - b.r0) * (b.c1 - b.c0) - (a.r1 - a.r0) * (a.c1 - a.c0));
  for (const room of byArea.slice(0, 2)) towerDressCourtyard(m, room, region);

  // Elemental accent pools flanking the great hall's carpet — 2×6 channels of
  // the region's accent (open lava, void rift, water…), ring-checked so a solid
  // accent can never wall a path.
  for (const [pr, pc] of [
    [midR - 12, midC - 8], [midR - 12, midC + 3],
    [midR + 10, midC - 8], [midR + 10, midC + 3],
  ]) towerStampAccentPool(m, pr, pc, 2, 6, region.accent);
}

// ─── Floor 14: the dragon's throne hall ───────────────────────────────────────
// One vast grand chamber: double colonnades marching up a crimson carpet to a
// marble dais bearing the usurped throne, the dragon's gold hoard spilling down
// its steps, and banner- and window-dressed walls the full height of the hall.
function buildTowerPinnacleMap() {
  const m = makeTile(MROWS, MCOLS, T.WALL);
  const R0 = 20, R1 = 136, C0 = 41, C1 = 108;
  setRect(m, R0, C0, R1, C1, T.FLOOR);

  // Wall dressing ring — banners and arched windows alternating every 6 tiles
  // along each wall of the hall, so the whole chamber reads regal. The parity
  // comes from the slot's position along its wall (not a running counter, which
  // would alternate between opposite walls instead of along each one).
  const dressAt = (r, c, k) => {
    if (m[r][c] !== T.WALL) return;
    m[r][c] = (k % 2 === 0) ? T.BANNER : T.CASTLE_WINDOW;
  };
  for (let c = C0, k = 0; c <= C1; c += 6, k++) { dressAt(R0 - 1, c, k); dressAt(R1 + 1, c, k + 1); }
  for (let r = R0, k = 0; r <= R1; r += 6, k++) { dressAt(r, C0 - 1, k); dressAt(r, C1 + 1, k + 1); }

  // Torches on the floor against the walls, between the dressings.
  for (let c = C0 + 3; c <= C1 - 3; c += 9) { m[R0][c] = T.TORCH; m[R1][c] = T.TORCH; }
  for (let r = R0 + 3; r <= R1 - 3; r += 9) { m[r][C0] = T.TORCH; m[r][C1] = T.TORCH; }

  // Double colonnades marching the length of the hall.
  for (let r = R0 + 10; r <= R1 - 8; r += 6) {
    if (r >= 38 && r <= 52) continue;                            // clear of the hoard
    m[r][52] = T.PILLAR; m[r][97] = T.PILLAR;
  }

  // Marble throne dais at the north end, with the throne, stone sentinels, and
  // torch-lit corners.
  setRect(m, 25, 62, 35, 87, T.MARBLE);
  m[27][74] = T.THRONE;
  m[27][68] = T.STATUE; m[27][81] = T.STATUE;
  m[25][62] = T.TORCH; m[25][87] = T.TORCH;
  m[35][62] = T.TORCH; m[35][87] = T.TORCH;

  // The dragon's hoard — an elliptical drift of gold spilling south off the
  // dais steps. Passable: the hero wades through the coins.
  const hr = 45, hc = 74, radR = 7, radC = 12;
  for (let dr = -radR; dr <= radR; dr++)
    for (let dc = -radC; dc <= radC; dc++) {
      const r = hr + dr, c = hc + dc;
      if ((dr * dr) / (radR * radR) + (dc * dc) / (radC * radC) > 1) continue;
      if (m[r][c] === T.FLOOR || m[r][c] === T.MARBLE) m[r][c] = T.HOARD;
    }

  // South gatehouse — the only way in or out: a stub corridor down to the
  // spiral stair back to floor 13. No stairs up; this is the pinnacle.
  const e = caveEdgeSpot('bottom');                              // (147, 75)
  carveCaveStub(m, e.tr, e.tc, -1, 0, T.FLOOR);
  m[e.tr][e.tc] = T.TOWER_STAIRS_DOWN;
  m[e.lr][e.lc] = T.FLOOR;

  // Crimson carpet from the gatehouse all the way up to the dais steps (laid
  // after the stub so the approach corridor is carpeted too; the hoard keeps
  // its gold).
  for (let r = 36; r < MROWS - 1; r++)
    for (let c = 73; c <= 77; c++)
      if (m[r][c] === T.FLOOR) m[r][c] = T.CARPET;

  return { map: m, entryLand: { x: e.lc, y: e.lr }, deeperLand: null };
}

// ─── Entry point ──────────────────────────────────────────────────────────────
// Build one tower floor. Floors 1–13 are region-themed castle floor plans with
// a stair down at the south gatehouse and a stair up at the north; floor 14 is
// the dragon's throne hall (stair down only). Returns { map, entryLand,
// deeperLand } like the cave/sky builders (deeperLand = landing beside the
// stair up; null on the pinnacle).
function buildTowerFloorMap(floorIdx) {
  if (floorIdx >= 14) return buildTowerPinnacleMap();

  const region = REGIONS[floorIdx - 1] || REGIONS[0];
  const { m, rooms, hall } = buildTowerFloorPlan(region);

  // Gatehouse stubs + spiral stairs: DOWN at the south edge midpoint (back the
  // way you came), UP at the north (deeper into the tower). Fixed placement —
  // "up is always north" — so the climb reads consistently and the minimap
  // edge-arrow probes find them.
  const dn = caveEdgeSpot('bottom');                             // (147, 75)
  carveCaveStub(m, dn.tr, dn.tc, -1, 0, T.FLOOR);
  m[dn.tr][dn.tc] = T.TOWER_STAIRS_DOWN;
  m[dn.lr][dn.lc] = T.FLOOR;
  const up = caveEdgeSpot('top');                                // (2, 75)
  carveCaveStub(m, up.tr, up.tc, 1, 0, T.FLOOR);
  m[up.tr][up.tc] = T.TOWER_STAIRS_UP;
  m[up.lr][up.lc] = T.FLOOR;

  // Dress the floor in its region's element (carpet, pillars, banners, windows,
  // torches, courtyards, accent pools).
  dressTowerFloor(m, rooms, hall, region);

  // Self-verify connectivity from the entry landing, sealing any pocket a
  // dressing pass could conceivably have orphaned — BEFORE chests, so a chest
  // can never be walled away.
  towerSealUnreachable(m, dn.lr, dn.lc);

  // Treasure through the wings.
  placeCaveChests(m, rnd(1, 3), 13, 13, 136, 136, T.FLOOR);

  return { map: m, entryLand: { x: dn.lc, y: dn.lr }, deeperLand: { x: up.lc, y: up.lr } };
}
