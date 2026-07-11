// map-gen biomes: forest, desert, generic elemental region builders
// Split out of map-gen.js (generation-time only; plain <script> globals, all
// cross-file calls resolve at runtime). See index.html for load order.

// ─── Earth region: cave entrances ────────────────────────────────────────────
// Set 1d6 tunnel mouths into the rock walls — each a CAVE_ENTRANCE replacing a
// solid MOUNTAIN/CLIFF tile that backs onto open ground, so the hero can walk
// straight off the trail into the cliffside (stepping in drops them into a hidden
// 1d6-level cave chain, exactly like a bombed-open tunnel). Run AFTER
// ensureConnectivity so the seal can't wall the mouths back up: CAVE_ENTRANCE is
// passable, and placing each against already-reachable open ground (PATH/SCREE/MUD)
// keeps every mouth reachable. Mouths are spread out (min Manhattan gap) so they
// don't cluster.
// No-op for every other region.
function addEarthCaveEntrances(m, regionId) {
  if (regionId !== 'earth') return;
  const NB4 = [[1,0],[-1,0],[0,1],[0,-1]];
  const isWallRock  = (t) => t === T.MOUNTAIN || t === T.CLIFF;
  const isOpenFloor = (t) => t === T.PATH || t === T.MUD || t === T.SCREE;
  const cands = [];
  for (let r = 2; r < MROWS - 2; r++)
    for (let c = 2; c < MCOLS - 2; c++) {
      if (!isWallRock(m[r][c])) continue;
      for (const [dr, dc] of NB4)
        if (isOpenFloor(m[r + dr][c + dc])) { cands.push([r, c]); break; }
    }
  if (!cands.length) return;
  for (let i = cands.length - 1; i > 0; i--) {        // Fisher–Yates shuffle
    const k = Math.floor(Math.random() * (i + 1));
    const tmp = cands[i]; cands[i] = cands[k]; cands[k] = tmp;
  }
  const want = rnd(1, 6);
  const MIN_GAP = 12;
  const placed = [];
  for (const [r, c] of cands) {
    if (placed.length >= want) break;
    if (placed.some(([pr, pc]) => Math.abs(pr - r) + Math.abs(pc - c) < MIN_GAP)) continue;
    m[r][c] = T.CAVE_ENTRANCE;
    placed.push([r, c]);
  }
}

// ─── Sky regions: wind gusts ─────────────────────────────────────────────────
// Set 1d6 vertical WIND_GUST updrafts out on the open cloud floor of an
// air/lightning map — the cloud regions' answer to the earth region's cave
// mouths. Each updraft is an 8-tile-tall column of rising wind, but ONLY its base
// (bottom) tile lifts the hero UP into a hidden sky cave chain (see
// createSkyCaveMap / tryCaveTransition); the 7 tiles rising above it are inert,
// passable shaft that just reads as the plume of wind (the base is detected as the
// gust tile with no gust directly below it — both here and in tryCaveTransition).
// The whole shaft is stamped only over the region's open floor (ground or its
// brighter puff decoration), so the passable column never punches through the
// cloud-edge rim, and the base is reachable from its sides and below. Run AFTER
// ensureConnectivity and ringCloudEdges (WIND_GUST is passable, seated on
// already-reachable floor). Gusts are spread out (min Manhattan gap between bases)
// so they don't cluster. No-op for every non-sky region.
const WIND_GUST_HEIGHT = 8;   // tiles tall; base + 7-tile rising shaft
function addSkyWindGusts(m, region) {
  if (!region.skyRegion) return;
  const H = WIND_GUST_HEIGHT;
  const isFloor = (t) => t === region.ground || t === region.decoration;
  const cands = [];
  for (let r = 6 + H; r < MROWS - 6; r++)
    for (let c = 6; c < MCOLS - 6; c++) {
      // Base reachable from its sides and below.
      if (!isFloor(m[r][c - 1]) || !isFloor(m[r][c + 1]) || !isFloor(m[r + 1][c])) continue;
      // The whole vertical shaft (base + 7 rising tiles) must be open floor.
      let ok = true;
      for (let k = 0; k < H && ok; k++) if (!isFloor(m[r - k][c])) ok = false;
      if (ok) cands.push([r, c]);
    }
  if (!cands.length) return;
  for (let i = cands.length - 1; i > 0; i--) {        // Fisher–Yates shuffle
    const k = Math.floor(Math.random() * (i + 1));
    const tmp = cands[i]; cands[i] = cands[k]; cands[k] = tmp;
  }
  const want = rnd(1, 6);
  const MIN_GAP = 14;
  const placed = [];
  for (const [r, c] of cands) {
    if (placed.length >= want) break;
    if (placed.some(([pr, pc]) => Math.abs(pr - r) + Math.abs(pc - c) < MIN_GAP)) continue;
    for (let k = 0; k < H; k++) m[r - k][c] = T.WIND_GUST;   // base at r, shaft rising above
    placed.push([r, c]);
  }
}

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

  // Map centre — the hub the main path network and exit corridors fan out from.
  // The corridors themselves are carved later (after the streams) so they bridge
  // the water rather than fording it.
  const midR = Math.floor(MROWS / 2), midC = Math.floor(MCOLS / 2);
  // Extra wandering grass paths for visual variety. Carved before the streams and
  // the main path network so the water (laid next) reads on top of them.
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

  // Phase 3b: streams — winding water channels that cross the whole map edge to
  // edge, each spanned by one or two plank bridges. Count is 1d4-1 (0–3 per map).
  // Carved BEFORE the main path network below so the corridors meet the water and
  // cross it on a slim plank (bridgeWalk) instead of fording it with a dirt path.
  const streamCount = rnd(1, 4) - 1;
  for (let i = 0; i < streamCount; i++) {
    const cells = Math.random() < 0.5
      ? carveStream(m, rnd(15, MROWS - 16), 1,                 rnd(15, MROWS - 16), MCOLS - 2, 1)  // W→E
      : carveStream(m, 1,                   rnd(15, MCOLS - 16), MROWS - 2,          rnd(15, MCOLS - 16), 1); // N→S
    if (cells.length > 6) {
      bridgeStream(m, cells, Math.floor(cells.length / 2));
      if (cells.length > 40) bridgeStream(m, cells, Math.floor(cells.length / 4));
    }
  }

  // Phase 3c: main path network connecting centre to each *open* exit. Carved
  // after the streams so each corridor bridges the water it meets (a slim plank
  // no more than 2 tiles wide) rather than paving a dirt ford across it.
  if (open.up)    bridgeWalk(m, midR, midC, 1,         EXIT_COL,   T.PATH, 1);
  if (open.down)  bridgeWalk(m, midR, midC, MROWS - 2, EXIT_COL,   T.PATH, 1);
  if (open.left)  bridgeWalk(m, midR, midC, EXIT_ROW,  1,          T.PATH, 1);
  if (open.right) bridgeWalk(m, midR, midC, EXIT_ROW,  MCOLS - 2,  T.PATH, 1);

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

  // Phase 11: waterfalls — a source pool at the very top of the map spills down
  // a vertical waterfall into a splash pool, and a stream carries that water to
  // the central walking-path network (joined by a short dirt spur so the water
  // visibly meets a path). Count is 1d4-1 (0–3 per map).
  const waterfallCount = rnd(1, 4) - 1;
  for (let i = 0; i < waterfallCount; i++) {
    // Column well clear of the north exit gate and the side borders.
    let wc = rnd(12, MCOLS - 13);
    if (Math.abs(wc - EXIT_COL) < 7) wc += (wc < EXIT_COL ? -7 : 7);
    wc = Math.max(6, Math.min(MCOLS - 7, wc));

    // Source pool hugging the top edge (the "pool of water at the top").
    setRect(m, 1, wc - 2, 3, wc + 2, T.WATER);
    // The falling water — a 3-wide vertical band of WATERFALL tiles.
    const fallBottom = rnd(10, 20);
    for (let r = 4; r <= fallBottom; r++)
      for (let c = wc - 1; c <= wc + 1; c++)
        if (!isProtectedFeature(m[r][c])) m[r][c] = T.WATERFALL;
    // Splash pool at the base — a WATER ring around a DEEP_WATER centre.
    const pr = fallBottom + 1;
    setRect(m, pr, wc - 3, pr + 3, wc + 3, T.WATER);
    setRect(m, pr + 1, wc - 1, pr + 2, wc + 1, T.DEEP_WATER);
    // Connecting stream from the splash pool to the central path, plus a short
    // dirt spur that joins the water to the path and bridges to keep it crossable.
    const link = carveStream(m, pr + 3, wc, EXIT_ROW, EXIT_COL, 0);
    if (link.length) {
      const [lr, lc] = link[link.length - 1];
      drunkWalk(m, lr, lc, EXIT_ROW, EXIT_COL, T.PATH, 0);
      bridgeStream(m, link, Math.floor(link.length / 2));
      if (link.length > 40) bridgeStream(m, link, Math.floor(link.length / 4));
    }

    // 99% of the time, conceal a doorway behind the rushing water at the very
    // bottom of the falls. The door tile renders like the waterfall itself (so
    // it's unseen) apart from a faint glow — the only hint it's there. No path
    // is carved to it: the hero reaches it by swimming the medium-water splash
    // pool behind the curtain. ensureConnectivity counts medium water as
    // traversable, so the door still validates as reachable.
    if (Math.random() < 0.99) {
      m[fallBottom][wc] = T.WATERFALL_DOOR;
    }
  }

  // Phase 12: cliff faces along the map edges — solid rock bands hugging a
  // random border with a clear gap at the exit gate. Count is 1d4-1 (0–3).
  const cliffCount = rnd(1, 4) - 1;
  for (let i = 0; i < cliffCount; i++) addCliffFace(m);

  // Ensure exit corridors are wide and reach interior — only for *open* sides.
  // bridgeWalk so a corridor meeting a stream bridges it instead of fording it.
  cutExits(m, open.left, open.right, open.up, open.down);
  if (open.left)  bridgeWalk(m, EXIT_ROW, 1,           EXIT_ROW, midC,    T.PATH, 1);
  if (open.right) bridgeWalk(m, EXIT_ROW, MCOLS - 2,   EXIT_ROW, midC,    T.PATH, 1);
  if (open.up)    bridgeWalk(m, 1,           EXIT_COL, midR,     EXIT_COL, T.PATH, 1);
  if (open.down)  bridgeWalk(m, MROWS - 2,   EXIT_COL, midR,     EXIT_COL, T.PATH, 1);

  // Final border lock + re-cut exits
  for (let c = 0; c < MCOLS; c++) { m[0][c] = T.TREE; m[MROWS - 1][c] = T.TREE; }
  for (let r = 0; r < MROWS; r++) { m[r][0] = T.TREE; m[r][MCOLS - 1] = T.TREE; }
  cutExits(m, open.left, open.right, open.up, open.down);

  // Now place the single chest. Done after all path carving so nothing can
  // overwrite it; ensureConnectivity preserves CHEST tiles.
  if (chestSpot) m[chestSpot.r][chestSpot.c] = T.CHEST;

  // Forest is outside the water region, so it carries no deep/standing water:
  // demote every WATER/DEEP_WATER tile (pond rims, streams, waterfall pools) to
  // MEDIUM_WATER. Run after all stream/bridge carving (those scan for T.WATER) so
  // bridges land first; WATERFALL falling tiles are left alone.
  demoteWaterToMedium(m);

  // Make sure every plank bridge lands on solid ground at both ends. The stub
  // variant is used because the bridgeWalk corridors lay many slim stream-crossing
  // planks close together — the full anchor sweep would fuse adjacent ones into a
  // wide span, while this only tidies genuine dangling ends (keeps bridges ≤2 wide).
  anchorBridgeStubs(m);

  // Guarantee everything passable is reachable from at least one exit
  ensureConnectivity(m);

  // Stand a few great mossy BOULDERs out in the open clearings — the forest's
  // open-ground landmark (its answer to the necrotic tombstones / mana great trees).
  // Run after the seal: each lone boulder is placed only where its whole
  // 8-neighbourhood is open grass, so it never walls a path.
  addRegionLandmarks(m, 'forest', depth);

  // Maybe spawn a lone whirlpool far out in open medium water (~30% of maps).
  placeWhirlpool(m);

  return m;
}

// ─── Desert water pool ───────────────────────────────────────────────────────
// A small still pool (4×4 … 10×10 of WATER) ringed by exactly one tile of GRASS,
// set into a SAND plaza so the green ring always sits on passable ground. A SAND
// access corridor is carved from the pool back to map centre so the ring is
// guaranteed reachable (the WATER itself stays solid — the player walks the rim).
function addDesertPool(m, midR, midC) {
  const w = rnd(4, 10), h = rnd(4, 10);
  const r0 = rnd(8, MROWS - h - 9);
  const c0 = rnd(8, MCOLS - w - 9);
  const r1 = r0 + h - 1, c1 = c0 + w - 1;
  // SAND plaza (water + grass ring + 1 tile margin) so nothing walls the rim in
  setRect(m, r0 - 2, c0 - 2, r1 + 2, c1 + 2, T.SAND);
  // 1-tile GRASS ring hugging the water
  setRect(m, r0 - 1, c0 - 1, r1 + 1, c1 + 1, T.GRASS);
  // the pool itself
  setRect(m, r0, c0, r1, c1, T.WATER);
  // guarantee accessibility — a SAND corridor from just below the plaza to centre
  drunkWalk(m, r1 + 2, Math.floor((c0 + c1) / 2), midR, midC, T.SAND, 1);
}

// Carve a 3-wide CLIMB ramp straight through a horizontal PLATEAU band at column
// `cc`, with a SAND lip one tile past each face so the ramp meets open ground on
// both sides. Used so a north/south path can cross the plateau.
function carveClimbV(m, r0, thick, cc) {
  for (let dr = -1; dr <= thick; dr++) {
    const r = r0 + dr;
    if (r <= 0 || r >= MROWS - 1) continue;
    for (let dc = -1; dc <= 1; dc++) {
      const c = cc + dc;
      if (c <= 0 || c >= MCOLS - 1 || isProtectedFeature(m[r][c])) continue;
      m[r][c] = (dr < 0 || dr >= thick) ? T.SAND : T.CLIMB;
    }
  }
}

// Carve a 3-wide CLIMB ramp through a vertical PLATEAU band at row `rr`.
function carveClimbH(m, c0, thick, rr) {
  for (let dc = -1; dc <= thick; dc++) {
    const c = c0 + dc;
    if (c <= 0 || c >= MCOLS - 1) continue;
    for (let dr = -1; dr <= 1; dr++) {
      const r = rr + dr;
      if (r <= 0 || r >= MROWS - 1 || isProtectedFeature(m[r][c])) continue;
      m[r][c] = (dc < 0 || dc >= thick) ? T.SAND : T.CLIMB;
    }
  }
}

// Stamp one solid PLATEAU band spanning the map edge-to-edge (a horizontal band
// touching the left+right borders, or a vertical band touching top+bottom), then
// cut CLIMB ramps through it so paths can still cross. The band is kept wholly to
// one side of the perpendicular exit axis so it never swallows that edge's exit
// corridor — the crossing on the axis it *does* block is restored by a climb.
function addDesertPlateau(m) {
  const thick = rnd(5, 10);
  // A mesa must never bisect an oasis, so reject any candidate band footprint
  // (rows for a horizontal band, columns for a vertical one) that overlaps
  // OASIS_WATER. Oases are small and rare, so a clear strip is found quickly.
  const bandHitsOasis = (horiz, p0) => {
    for (let d = 0; d < thick; d++) {
      const p = p0 + d;
      if (horiz) {
        if (p <= 0 || p >= MROWS - 1) continue;
        for (let c = 1; c < MCOLS - 1; c++) if (m[p][c] === T.OASIS_WATER) return true;
      } else {
        if (p <= 0 || p >= MCOLS - 1) continue;
        for (let r = 1; r < MROWS - 1; r++) if (m[r][p] === T.OASIS_WATER) return true;
      }
    }
    return false;
  };
  if (Math.random() < 0.5) {
    // Horizontal band: pick a row entirely above OR below the E/W exit corridor.
    let r0 = 0;
    for (let tries = 0; tries < 16; tries++) {
      r0 = (Math.random() < 0.5)
        ? rnd(8, EXIT_ROW - thick - 5)
        : rnd(EXIT_ROW + 5, MROWS - thick - 8);
      if (!bandHitsOasis(true, r0)) break;
    }
    // BEFORE stamping, record every column where a walking PATH crosses the band
    // footprint (plus the lip on each face) so each ramp lands exactly on the
    // path the player is already following — keeping climbs and walks aligned.
    const cols = new Set();
    for (let c = 1; c < MCOLS - 1; c++)
      for (let dr = -1; dr <= thick; dr++) {
        const r = r0 + dr;
        if (r > 0 && r < MROWS - 1 && m[r][c] === T.PATH) { cols.add(c); break; }
      }
    for (let c = 1; c < MCOLS - 1; c++)
      for (let dr = 0; dr < thick; dr++) {
        const r = r0 + dr;
        const t = m[r][c];
        if (isProtectedFeature(t) || t === T.WATER || t === T.OASIS_WATER ||
            t === T.CLIMB) continue;
        m[r][c] = T.PLATEAU;
      }
    // Fallback: a band no path happened to cross still needs a way through, or
    // ensureConnectivity would seal off the far side.
    if (cols.size === 0) { cols.add(EXIT_COL); cols.add(rnd(10, MCOLS - 11)); }
    for (const cc of cols) carveClimbV(m, r0, thick, cc);
  } else {
    // Vertical band: pick a column entirely left OR right of the N/S corridor.
    let c0 = 0;
    for (let tries = 0; tries < 16; tries++) {
      c0 = (Math.random() < 0.5)
        ? rnd(8, EXIT_COL - thick - 5)
        : rnd(EXIT_COL + 5, MCOLS - thick - 8);
      if (!bandHitsOasis(false, c0)) break;
    }
    // Record every row where a walking PATH crosses the band (see above).
    const rows = new Set();
    for (let r = 1; r < MROWS - 1; r++)
      for (let dc = -1; dc <= thick; dc++) {
        const c = c0 + dc;
        if (c > 0 && c < MCOLS - 1 && m[r][c] === T.PATH) { rows.add(r); break; }
      }
    for (let r = 1; r < MROWS - 1; r++)
      for (let dc = 0; dc < thick; dc++) {
        const c = c0 + dc;
        const t = m[r][c];
        if (isProtectedFeature(t) || t === T.WATER || t === T.OASIS_WATER ||
            t === T.CLIMB) continue;
        m[r][c] = T.PLATEAU;
      }
    if (rows.size === 0) { rows.add(EXIT_ROW); rows.add(rnd(10, MROWS - 11)); }
    for (const rr of rows) carveClimbH(m, c0, thick, rr);
  }
}

// Sprinkle a cluster of passable FLOWERING_CACTUS tiles onto the SAND/GRASS
// immediately around a randomly chosen desert water tile (pool or oasis). These
// have 1 HP and are cut down by a sword swing (see doSwordSwing).
function addFloweringCactiNearWater(m, waters) {
  if (!waters.length) return;
  const [wr, wc] = waters[Math.floor(Math.random() * waters.length)];
  // 5× the old 2–4 per cluster. The wider radius + larger try budget give the
  // denser bloom enough open SAND/GRASS around the oasis to actually land.
  const target = rnd(2, 4) * 5;
  let placed = 0;
  for (let tries = 0; tries < 200 && placed < target; tries++) {
    const r = wr + rnd(-4, 4), c = wc + rnd(-4, 4);
    if (r <= 0 || r >= MROWS - 1 || c <= 0 || c >= MCOLS - 1) continue;
    if (m[r][c] === T.SAND || m[r][c] === T.GRASS) {
      m[r][c] = T.FLOWERING_CACTUS;
      placed++;
    }
  }
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

  // Phase 5: oases — small water pools ringed by cacti (0–2 per map)
  const oasisCount = rnd(0, 2);
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

  // Phase 7: bone decorations scattered across sand. (Desert ground is SAND, not
  // GRASS, so seed them onto SAND.) Bones have 1 HP and drop bone meal when cut
  // by a sword swing — see doSwordSwing.
  scatterOn(m, T.BONES, 80, T.SAND);
  // Desert succulents — low aloe/agave rosettes strewn across the open sand.
  // Passable 1-HP foliage that revert to SAND when cut, each shedding Aloe (the
  // desert's third forage alongside bone meal and the near-water cacti's herbal).
  scatterOn(m, T.DESERT_SUCCULENT, 55, T.SAND);
  // Sparse cacti scattered as obstacles in open sand
  for (let i = 0; i < 120; i++) {
    const rr = rnd(2, MROWS - 3), rc = rnd(2, MCOLS - 3);
    if (m[rr][rc] === T.SAND && Math.random() < 0.5) m[rr][rc] = T.CACTUS;
  }

  // Phase 7b: small grass-ringed water pools (1d4-1 per map). Placed after the
  // rock/cactus scatters so nothing walls in their accessible rim.
  const poolCount = rnd(1, 4) - 1;
  for (let i = 0; i < poolCount; i++) addDesertPool(m, midR, midC);

  // Phase 7c: flowering cacti clustered near desert water (1d4-1 per map). Built
  // from the live water tiles so each cluster hugs an actual pool or oasis.
  const floweringCount = rnd(1, 4) - 1;
  if (floweringCount > 0) {
    const waters = [];
    for (let r = 2; r < MROWS - 2; r++)
      for (let c = 2; c < MCOLS - 2; c++)
        if (m[r][c] === T.WATER || m[r][c] === T.OASIS_WATER) waters.push([r, c]);
    for (let i = 0; i < floweringCount; i++) addFloweringCactiNearWater(m, waters);
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

  // Phase 13: edge-to-edge plateaus (1d4-1 per map). Placed last — after the
  // exit corridors, border lock, and chest — so the solid mesa carves across the
  // finished map and only the CLIMB ramps let paths cross it. ensureConnectivity
  // (next) re-links anything the plateau happened to wall off.
  const plateauCount = rnd(1, 4) - 1;
  for (let i = 0; i < plateauCount; i++) addDesertPlateau(m);

  // Desert is outside the water region: demote its pools and OASIS_WATER to
  // MEDIUM_WATER so no deep/standing water survives here.
  demoteWaterToMedium(m);

  // Make sure every plank bridge lands on solid ground at both ends.
  anchorBridgesOnLand(m);

  ensureConnectivity(m, false, T.CACTUS);

  // Stand a few weathered sandstone OBELISKs out in the open sands — the desert's
  // open-ground landmark (its answer to the necrotic tombstones / mana great trees).
  // Run after the seal: each lone obelisk is placed only where its whole
  // 8-neighbourhood is open desert ground, so it never walls a path.
  addRegionLandmarks(m, 'fire', depth);

  // Fire region: 20% of desert maps hide a whirlpool in a pool/oasis. The
  // small clearance fits these little water bodies while still keeping the
  // vortex and its 1-tile pull ring fully inside swim-only water, away from
  // the walkable rim.
  placeWhirlpool(m, 0.20, 2);

  return m;
}

// Palette-swap of buildDesertMap for the seven later elemental regions (water,
// ice, earth, air, lightning, luminous, necrotic, poison, mana). Takes a
// region object from REGIONS — that supplies border/ground/decoration/accent
// tiles and everything else here is identical structure to the desert builder.
function buildRegionMap(seed, depth, openSides, region) {
  const open = openSides || { left: true, right: true, up: true, down: true };
  const BORDER = region.border, GROUND = region.ground;
  const DECOR = region.decoration, ACCENT = region.accent;
  // Region-specific corridor tile. Defaults to the dirt PATH; the water region
  // overrides this with SHALLOW_WATER so its paths read as a wadeable channel.
  const PATHTILE = region.path || T.PATH;
  const m = makeTile(MROWS, MCOLS, BORDER);

  // Phase 1: carve open ground patches across the map
  const patchCount = 60 + depth * 2;
  for (let i = 0; i < patchCount; i++) {
    const pr = rnd(5, MROWS - 6), pc = rnd(5, MCOLS - 6);
    const pw = rnd(3, 10), ph = rnd(3, 10);
    setRect(m, pr, pc, Math.min(pr + ph, MROWS - 2), Math.min(pc + pw, MCOLS - 2), GROUND);
  }

  // Map centre — the hub the corridors and exit gates fan out from.
  const midR = Math.floor(MROWS / 2), midC = Math.floor(MCOLS / 2);

  // Regions threaded by edge-to-edge water (mana rivers) carve their corridors
  // with bridgeWalk, so a corridor meeting water crosses it on a slim plank (no
  // more than 2 tiles wide) instead of fording it with dirt; every other region
  // keeps the plain drunkWalk.
  const corridorWalk = region.edgeWater ? bridgeWalk : drunkWalk;

  // Phase 2: main paths from centre to each open exit.
  const carveMainPaths = (walk) => {
    if (open.up)    walk(m, midR, midC, 1,         EXIT_COL,   PATHTILE, 1);
    if (open.down)  walk(m, midR, midC, MROWS - 2, EXIT_COL,   PATHTILE, 1);
    if (open.left)  walk(m, midR, midC, EXIT_ROW,  1,          PATHTILE, 1);
    if (open.right) walk(m, midR, midC, EXIT_ROW,  MCOLS - 2,  PATHTILE, 1);
  };
  // Secondary connector paths. Every region but water links them with plain
  // GROUND here; the water region instead carves its secondary routes as
  // SHALLOW_WATER channels later (after the depth banding) so they wade through
  // the water rather than paving more sand.
  const carveSecondaryPaths = (walk) => {
    if (region.id !== 'water') {
      for (let i = 0; i < 6; i++) {
        const r1 = rnd(10, MROWS - 10), c1 = rnd(10, MCOLS - 10);
        const r2 = rnd(10, MROWS - 10), c2 = rnd(10, MCOLS - 10);
        walk(m, r1, c1, r2, c2, GROUND, 1);
      }
    }
  };

  // Phase 3: special clearings (homes for chests / shrines)
  const clearings = [];
  const carveClearings = () => {
    for (let i = 0; i < 8; i++) {
      const cr = rnd(15, MROWS - 15), cc = rnd(15, MCOLS - 15);
      const cw = rnd(8, 16), ch = rnd(8, 16);
      setRect(m, cr, cc, Math.min(cr + ch, MROWS - 2), Math.min(cc + cw, MCOLS - 2), GROUND);
      clearings.push({ r: cr + Math.floor(ch / 2), c: cc + Math.floor(cw / 2) });
    }
  };

  // For edge-water regions the rivers must exist before the main corridors so the
  // corridors bridge them. Carve the clearings and the decorative secondary
  // connectors first, then the rivers (addManaRivers — mana only) over them (as in
  // the original, so the secondary paths read as washed out beneath the water, not
  // dirt fords across it), then the main paths — which bridgeWalk plank across the
  // rivers. Every other region keeps the original order (corridors first, then the
  // clearings; addManaRivers there is a later no-op).
  if (region.edgeWater) {
    carveClearings();
    carveSecondaryPaths(drunkWalk);
    addManaRivers(m, region.id, depth);
    carveMainPaths(corridorWalk);
  } else {
    carveMainPaths(corridorWalk);
    carveSecondaryPaths(corridorWalk);
    carveClearings();
  }

  // Phase 4: accent features (water pools, lava pits, ice patches, etc.) with
  // bridges across them so the map stays traversable. Skipped for the sky regions
  // (air, lightning): a cloud island floating above the world holds no standing
  // water, so there are no pools to place — and thus no bridges. (Their accent is
  // WATER, which the demote pass below would have turned into MEDIUM_WATER; with
  // this skipped no water tile is ever laid, and placeWhirlpool — which needs
  // existing medium water — becomes a no-op too.)
  if (!region.skyRegion) {
    const accentCount = 2 + Math.floor(depth / 4);
    for (let i = 0; i < accentCount; i++) {
      const ar = rnd(20, MROWS - 25), ac = rnd(20, MCOLS - 25);
      const sz = rnd(5, 10);
      const ar2 = Math.min(ar + sz, MROWS - 2), ac2 = Math.min(ac + sz, MCOLS - 2);
      setRect(m, ar, ac, ar2, ac2, ACCENT);
      const bridgeR = Math.floor((ar + ar2) / 2);
      setRow(m, bridgeR, Math.max(1, ac - 1), Math.min(MCOLS - 2, ac2 + 1), T.BRIDGE);
    }
  }

  // Phase 5: scattered rocks (bombable cover) — palette stays neutral. Skipped in
  // the sky regions (air, lightning): bare rocks have no place resting on a
  // floor of cloud.
  if (!region.skyRegion) {
    for (let i = 0; i < 80 + depth; i++) {
      const rr = rnd(2, MROWS - 3), rc = rnd(2, MCOLS - 3);
      if ((m[rr][rc] === GROUND || m[rr][rc] === T.PATH) && Math.random() < 0.3) {
        m[rr][rc] = T.ROCK;
      }
    }
  }

  // Phase 6: decorations strewn across open ground.
  scatter(m, DECOR, 200);

  // Phase 7: pick the chest spot now and defer the actual write until after
  // any later path carving so corridors can't overwrite it.
  const chestSpot = clearings.length
    ? clearings[Math.floor(Math.random() * clearings.length)]
    : null;

  // Phase 8: occasional shrine (full HP heal) — flanked by torches.
  if (clearings.length > 0 && Math.random() < 0.4) {
    const cl = clearings[Math.floor(Math.random() * clearings.length)];
    m[cl.r][cl.c] = T.SHRINE;
    if (cl.c > 0)         m[cl.r][cl.c - 1] = T.TORCH;
    if (cl.c < MCOLS - 1) m[cl.r][cl.c + 1] = T.TORCH;
  }

  // Phase 9: rare ruins at deeper depths.
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

  // Earth region: rough up the map into mountain terrain (rocky cliff bands, mud,
  // talus) before the exit corridors are re-cut through it. No-op elsewhere.
  addMountainTerrain(m, region.id);

  // Ensure exit corridors reach interior. corridorWalk bridges any edge-to-edge
  // water (mana rivers, carved earlier) the corridor meets instead of fording it.
  cutExits(m, open.left, open.right, open.up, open.down);
  if (open.left)  corridorWalk(m, EXIT_ROW, 1,           EXIT_ROW, midC,    PATHTILE, 1);
  if (open.right) corridorWalk(m, EXIT_ROW, MCOLS - 2,   EXIT_ROW, midC,    PATHTILE, 1);
  if (open.up)    corridorWalk(m, 1,           EXIT_COL, midR,     EXIT_COL, PATHTILE, 1);
  if (open.down)  corridorWalk(m, MROWS - 2,   EXIT_COL, midR,     EXIT_COL, PATHTILE, 1);

  // Final border lock + re-cut exits
  for (let c = 0; c < MCOLS; c++) { m[0][c] = BORDER; m[MROWS - 1][c] = BORDER; }
  for (let r = 0; r < MROWS; r++) { m[r][0] = BORDER; m[r][MCOLS - 1] = BORDER; }
  cutExits(m, open.left, open.right, open.up, open.down);

  // cutExits always stamps the border gates with dirt T.PATH. When the region
  // uses a custom corridor tile (e.g. shallow water), repaint those gate tiles
  // to match so the channel runs unbroken to the map edge.
  if (PATHTILE !== T.PATH) {
    for (let r = 0; r < MROWS; r++)
      for (let c = 0; c < MCOLS; c++)
        if (m[r][c] === T.PATH) m[r][c] = PATHTILE;
  }

  // Occasional dry stretches: where the corridor tile is meant to be wadeable
  // water, sprinkle small dry blobs (region.pathDry, e.g. sand bars) so the
  // channel isn't an unbroken ribbon of water. Both tiles stay passable, so
  // connectivity is unaffected.
  if (region.pathDry !== undefined && PATHTILE !== region.pathDry) {
    const dryBlobs = 14 + Math.floor(depth / 3);
    for (let i = 0; i < dryBlobs; i++) {
      const rr = rnd(3, MROWS - 4), rc = rnd(3, MCOLS - 4);
      if (m[rr][rc] !== PATHTILE) continue;            // only break up the path
      const bw = rnd(1, 3), bh = rnd(1, 2);
      for (let dr = 0; dr <= bh; dr++)
        for (let dc = 0; dc <= bw; dc++) {
          const nr = rr + dr, nc = rc + dc;
          if (nr > 0 && nr < MROWS - 1 && nc > 0 && nc < MCOLS - 1 &&
              m[nr][nc] === PATHTILE) m[nr][nc] = region.pathDry;
        }
    }
  }

  if (chestSpot) m[chestSpot.r][chestSpot.c] = T.CHEST;

  // Water region: shelve the open water out from the sand into shallow → medium
  // → deep bands, then carve the SHALLOW_WATER secondary channels across it. Run
  // before connectivity so it sees SHALLOW as walkable and MEDIUM/DEEP as walls.
  if (region.id === 'water') {
    applyWaterDepthBands(m);
    carveShallowChannels(m, 6);
    // Strew bombable ROCK boulders across the beaches/sandbars. The generic
    // Phase-5 scatter rarely lands here (the map is mostly water), so add a
    // dedicated pass on SAND. Solid, so it runs BEFORE ensureConnectivity below
    // re-validates the layout — single boulders on the wide bars never wall it off.
    scatterOn(m, T.ROCK, 60, T.SAND);
  } else if (region.id === 'ice') {
    // Ice region: its standing water is frozen solid — accent pools become
    // walkable, slippery ICE sheets instead of swimmable medium water.
    freezeWaterToIce(m);
  } else {
    // Every other region is outside the water region, so it keeps no deep/
    // standing water — demote its accent pools (WATER, DEEP_WATER for the mana
    // region, etc.) to MEDIUM_WATER. (The poison region's accent is BOG_POOL, a
    // solid murk tile that isn't water, so this leaves its bog pools untouched.)
    demoteWaterToMedium(m);
  }

  // Make sure every plank bridge lands on solid ground at both ends (run after
  // the water banding so it sees the final shallow/medium/deep tiles). Edge-water
  // regions (mana rivers) use the stub variant so the many slim bridgeWalk planks
  // crossing their rivers aren't fused into wide spans (kept ≤2 tiles wide).
  if (region.edgeWater) anchorBridgeStubs(m);
  else                  anchorBridgesOnLand(m);

  // Seal any orphan passable pockets with the region's border tile so the
  // visual matches the surrounding wall instead of leaking forest TREE. Rescue
  // corridors use the region's corridor tile so they blend in too.
  ensureConnectivity(m, false, BORDER, PATHTILE);

  // Earth region: cut 1d6 cave-entrance tunnels into the rock walls. Done AFTER
  // the seal (CAVE_ENTRANCE is passable, so the seal would otherwise wall stray
  // ones back up) and against already-reachable ground so every mouth is usable.
  addEarthCaveEntrances(m, region.id);

  // Earth region: churn boggy MUD clumps (9–30 tiles) into the trails — each one
  // slows the hero to half speed. After the seal so clumps stay whole (see above).
  addMudBogs(m, region.id);

  // Ice region: 1d4 frozen streams winding edge-to-edge across the map (W→E or
  // N→S, like the forest's water channels), stamped straight as walkable ICE.
  // Carved AFTER ensureConnectivity on purpose: ICE is passable, so if these ran
  // before the seal, any stretch threading through the solid glacier that the
  // exit flood can't reach would be sealed back to glacier (the streams would
  // vanish). Carving after instead only ADDS walkable ice — it can never orphan
  // existing terrain — and the streams reconnect themselves where they cross the
  // central corridors. carveStream skips protected structures (chests, shrines,
  // doors), so nothing important is paved over.
  if (region.id === 'ice') {
    const iceStreamCount = rnd(1, 4);
    for (let i = 0; i < iceStreamCount; i++) {
      if (Math.random() < 0.5)
        carveStream(m, rnd(15, MROWS - 16), 1,                  rnd(15, MROWS - 16), MCOLS - 2, 1, T.ICE);  // W→E
      else
        carveStream(m, 1,                   rnd(15, MCOLS - 16), MROWS - 2,          rnd(15, MCOLS - 16), 1, T.ICE); // N→S
    }
  }

  // Ice region: dress the glacier walls with snow-covered pines so the border
  // reads as a frozen treeline rather than bare ice cliffs. Runs after the
  // connectivity seal so sealed pockets get trees too. SNOW_PINE is solid like
  // GLACIER, so traversal is unaffected.
  sprinkleSnowPines(m, region.id);

  // Ice region: drift fields — deep powder banks mirroring the desert's dune
  // fields. Converts open SNOW only (both passable), so connectivity holds.
  addSnowDrifts(m, region.id, depth);

  // Ice region: wintry foliage on the open snow — winter berry bushes and frost
  // lilies. Runs after the drifts so it seeds onto the remaining plain snow.
  scatterWinterFoliage(m, region.id);

  // Water region: beach finds scattered on the open sand — stones, seashells,
  // and coral. Runs after the water banding so it seeds onto the final sand.
  scatterWaterFoliage(m, region.id);

  // Earth region: hardy mountain growth on the open scree — sage shrubs, moss
  // clumps, and amethyst crystal clusters. Runs after the mud bogs so it seeds
  // onto the remaining plain scree, not the bog clumps.
  scatterEarthFoliage(m, region.id);

  // Sky regions (air, lightning): dapple the walkable cloud floor with the
  // brighter puff tile so it reads as a rolling bank of two cloud tiles (the hero
  // walks on the cloud; the border frames it — distant earth for air, churning
  // thunderheads for lightning).
  sprinkleCloudFloor(m, region.id);

  // Air region only: sky growth on the open cloud floor — sky blooms, wind reeds,
  // and storm thistles. Runs after the cloud-floor dapple so it seeds onto the
  // remaining plain CLOUD, not the brighter CLOUDBANK puffs.
  scatterAirFoliage(m, region.id);

  // Lightning region only: storm growth on the open storm-cloud floor — volt
  // blooms, spark reeds, and fulgurite shards. Same idea as the air foliage above,
  // seeded onto the remaining plain STORM_GROUND, not the STORM_BANK puffs.
  scatterLightningFoliage(m, region.id);

  // Volcanic / Shadow regions: scatter their cuttable growth across the open floor
  // (the volcanic/shadow twin of the sky-region foliage passes). Their MAGMA_CRACK
  // / SHADOW_DAPPLE decoration is already dappled by the generic Phase-6 scatter,
  // and their solid landmark (obsidian spire / monolith) by addRegionLandmarks.
  scatterVolcanicFoliage(m, region.id);
  scatterShadowFoliage(m, region.id);

  // Luminous region: pool brighter LUMINOUS_GLOW across the warm-white floor, then
  // strew the sanctum's radiant growth onto the remaining plain floor, and finally
  // raise solid LIGHT_PILLAR shafts of light as landmarks. Order mirrors the sky
  // regions (dapple the floor, then seed foliage onto what's left). No-ops elsewhere.
  sprinkleLuminousGlow(m, region.id);
  scatterLuminousFoliage(m, region.id);
  addLightPillars(m, region.id, depth);

  // Necrotic region: dress the plain blighted wastes into a morbid underworld.
  // Dapple the floor with mounds of fresh-turned GRAVE_DIRT, strew the wastes'
  // decay across the remaining blight (bone heaps, withered thorn brambles,
  // carrion blooms), claw gnarled DEAD_TREEs up out of the crypt-wall border,
  // and stand cracked TOMBSTONEs out in the open. Order mirrors the luminous /
  // sky regions: floor dapple first, then foliage onto the leftover plain floor,
  // then the solid wall dressing and the connectivity-safe solid landmarks.
  sprinkleGraveDirt(m, region.id);
  scatterNecroticFoliage(m, region.id);
  sprinkleDeadTrees(m, region.id);
  addTombstones(m, region.id, depth);

  // Poison region: dress the plain sludge into a fetid swamp. Churn boggy mire
  // hollows into the open floor, strew the swamp's rank growth (reeds, ferns,
  // toadstools) across the remaining mire, and claw moss-draped mangroves up out
  // of the thicket border. Order mirrors the necrotic region: floor dapple first,
  // then foliage onto the leftover plain floor, then the solid wall dressing.
  addPoisonBogs(m, region.id, depth);
  scatterPoisonFoliage(m, region.id);
  sprinkleMangroves(m, region.id);
  addFallenLogs(m, region.id, depth);

  // Mana region: dress the bare mana wastes into a forest flourishing past nature,
  // gorged on life energy so everything grows abnormally large. Pool thick MANA_MOSS
  // across the turf, choke the open floor with oversized growth (giant blooms,
  // towering ferns, colossal glowing mushrooms), claw GREAT_TREEs up out of the
  // mana-veined treeline border, and raise more GREAT_TREEs as colossal landmarks in
  // the clearings. Order mirrors the other late regions: floor dapple first, then
  // dense foliage onto the leftover plain turf, then the solid border dressing, then
  // the connectivity-safe solid landmarks.
  sprinkleManaMoss(m, region.id);
  scatterManaFoliage(m, region.id);
  sprinkleGreatTrees(m, region.id);
  addGreatTrees(m, region.id, depth);
  addColossalTrees(m, region.id, (rnd(1, 4) + 2) * 3, 14);   // 3× the giants — a forest thick with them

  // Sky regions (air, lightning): wrap the walkable cloud in an impassable 2–4
  // tile rim (cloudEdge) so it reads as an island of cloud with a billowing lip
  // the hero can't cross.
  ringCloudEdges(m, region.id);

  // Early/elemental regions (water, ice, earth, air, lightning): stand a scattering
  // of the region's signature landmark out in the open clearings — a driftwood trunk,
  // an ice spire, a standing stone, a cloud spire, or a storm spire (their answer to
  // the necrotic tombstones / poison logs / mana great trees). Run after the seal AND
  // after ringCloudEdges (so the sky regions' billowing CLOUD_EDGE rim is already in
  // place and never overwrites a spire): each lone landmark is placed only where its
  // whole 8-neighbourhood is open ground, so it never walls a path. No-op for the
  // late regions, which keep their own bespoke landmark passes above.
  addRegionLandmarks(m, region.id, depth);

  // Sky regions (air, lightning): set 1d6 vertical wind-gust updrafts out on the
  // open cloud floor — the entrances to this region's hidden sky caves. After the
  // seal, ringCloudEdges, and the landmarks so each gust lands on clear interior
  // floor (WIND_GUST is passable, so it can't be walled by the earlier seal).
  addSkyWindGusts(m, region);

  // Maybe spawn a lone whirlpool far out in open medium water (~30% of maps).
  placeWhirlpool(m);

  return m;
}

