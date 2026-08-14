// map-gen terrain primitives + water depth banding
// Split out of map-gen.js (generation-time only; plain <script> globals, all
// cross-file calls resolve at runtime). See index.html for load order.

// ─── Cliff face ─────────────────────────────────────────────────────────────
// Stamp a band of solid CLIFF rock hugging one random map edge, leaving a clear
// gap at that edge's exit gate so the border corridor still gets through. A few
// loose ROCK boulders are scattered at the cliff's inner foot for a talus look.
// Called by buildForestMap to rough up the map perimeter.
function addCliffFace(m) {
  const edge = rnd(0, 3);                       // 0 top, 1 bottom, 2 left, 3 right
  const thick = rnd(2, 4);
  const span  = rnd(30, 90);
  if (edge === 0 || edge === 1) {               // horizontal band (top / bottom)
    const r0 = edge === 0 ? 1 : MROWS - 1 - thick;
    const c0 = rnd(1, Math.max(2, MCOLS - 1 - span));
    const c1 = Math.min(MCOLS - 2, c0 + span);
    const footR = edge === 0 ? r0 + thick : r0 - 1;
    for (let c = c0; c <= c1; c++) {
      if (Math.abs(c - EXIT_COL) < 4) continue;       // keep the exit gate clear
      for (let dr = 0; dr < thick; dr++) {
        const r = r0 + dr;
        if (r > 0 && r < MROWS - 1 && !isProtectedFeature(m[r][c])) m[r][c] = T.CLIFF;
      }
      if (footR > 0 && footR < MROWS - 1 && genRandom() < 0.25 &&
          !isProtectedFeature(m[footR][c])) m[footR][c] = T.ROCK;
    }
  } else {                                      // vertical band (left / right)
    const c0 = edge === 2 ? 1 : MCOLS - 1 - thick;
    const r0 = rnd(1, Math.max(2, MROWS - 1 - span));
    const r1 = Math.min(MROWS - 2, r0 + span);
    const footC = edge === 2 ? c0 + thick : c0 - 1;
    for (let r = r0; r <= r1; r++) {
      if (Math.abs(r - EXIT_ROW) < 4) continue;       // keep the exit gate clear
      for (let dc = 0; dc < thick; dc++) {
        const c = c0 + dc;
        if (c > 0 && c < MCOLS - 1 && !isProtectedFeature(m[r][c])) m[r][c] = T.CLIFF;
      }
      if (footC > 0 && footC < MCOLS - 1 && genRandom() < 0.25 &&
          !isProtectedFeature(m[r][footC])) m[r][footC] = T.ROCK;
    }
  }
}

// ─── Earth region: mountain terrain ──────────────────────────────────────────
// The earth region is carved out of solid MOUNTAIN, so making its walls read as
// rugged peaks (see the MOUNTAIN renderer) already frames it as a mountain range.
// This roughs up the valley floor to match: a couple of rocky CLIFF bands hugging
// the edges and loose talus boulders strewn across the open SCREE slopes. Runs
// before the exit re-cut + connectivity seal (like the forest's cliff pass), so the
// gates are reopened through any band and any stray pocket a band closes is cleaned
// up. No-op for every other region.
function addMountainTerrain(m, regionId) {
  if (regionId !== 'earth') return;
  const cliffs = rnd(2, 3);
  for (let i = 0; i < cliffs; i++) addCliffFace(m);
  scatterOn(m, T.ROCK, 90, T.SCREE);   // loose talus boulders across the open slopes
}

// ─── Earth region: mud bogs ──────────────────────────────────────────────────
// Wet mud pooled across the open SCREE slopes as boggy clumps of 9–30 tiles (not
// lone speckles) — each one slows the hero to half speed (see stepPlayerMovement).
// Bogs sit off the maintained dirt PATH, so the main trail stays clean footing and
// going off-trail is what gets you mired. Run AFTER ensureConnectivity: MUD only
// ever replaces walkable SCREE (both passable, so connectivity is untouched), and
// growing it post-seal means nothing re-cuts a clump and splits it below 9 tiles.
// No-op for every other region.
function addMudBogs(m, regionId) {
  if (regionId !== 'earth') return;
  const clumps = rnd(4, 8);
  for (let i = 0; i < clumps; i++) growMudClump(m, rnd(9, 30));
}

// Grow one organic clump of up to `size` MUD tiles outward from a random SCREE
// seed. MUD is passable, so this never affects connectivity.
function growMudClump(m, size) { return growClump(m, size, T.SCREE, T.MUD); }

// Grow one organic blob of up to `size` `fill` tiles outward from a random `base`
// seed, converting `base` only (so paths, walls, structures, and decor are never
// touched). Picks a random frontier cell each step so the blob spreads into a
// rounded clump rather than a line. Used for the earth region's mud bogs and the
// poison region's boggy mire — both `fill` tiles are passable, so this never
// affects connectivity.
function growClump(m, size, base, fill) {
  const NB4 = [[1,0],[-1,0],[0,1],[0,-1]];
  let sr = -1, sc = -1;
  for (let t = 0; t < 200; t++) {
    const r = rnd(3, MROWS - 4), c = rnd(3, MCOLS - 4);
    if (m[r][c] === base) { sr = r; sc = c; break; }
  }
  if (sr < 0) return 0;
  m[sr][sc] = fill;
  let placed = 1;
  const frontier = [[sr, sc]];
  while (placed < size && frontier.length) {
    const fi = Math.floor(genRandom() * frontier.length);
    const [r, c] = frontier[fi];
    const opts = [];
    for (const [dr, dc] of NB4) {
      const nr = r + dr, nc = c + dc;
      if (nr > 0 && nr < MROWS - 1 && nc > 0 && nc < MCOLS - 1 && m[nr][nc] === base) opts.push([nr, nc]);
    }
    if (!opts.length) { frontier.splice(fi, 1); continue; }   // dead end — retire this cell
    const [nr, nc] = opts[Math.floor(genRandom() * opts.length)];
    m[nr][nc] = fill; placed++;
    frontier.push([nr, nc]);
  }
  return placed;
}

// ─── Generic elemental region map ────────────────────────────────────────────
// ─── Water-region depth gradient ───────────────────────────────────────────────
// The water region walks on SAND; everything off the sand is open water. Re-band
// that water by its distance from the nearest walkable land so it shelves out to
// sea like a beach: a thin SHALLOW_WATER rim hugging the sand (wadeable, "off the
// path"), then a MEDIUM_WATER shelf a random 3–8 tiles wide, then DEEP_WATER out
// to the border. SHALLOW is passable; MEDIUM and DEEP are too deep to cross.
function applyWaterDepthBands(m) {
  const SHALLOW_W = 2;                 // wadeable rim hugging the sand
  const MEDIUM_W = rnd(3, 8);          // medium-depth shelf before the deep water
  const isWater = (t) => t === T.DEEP_WATER || t === T.WATER ||
                         t === T.SHALLOW_WATER || t === T.MEDIUM_WATER;
  // Multi-source BFS: every non-water (land/feature) tile seeds the flood at
  // distance 0, so each water tile learns its step distance to the nearest land.
  const dist = new Int16Array(MROWS * MCOLS).fill(-1);
  const queue = [];
  for (let r = 0; r < MROWS; r++)
    for (let c = 0; c < MCOLS; c++)
      if (!isWater(m[r][c])) { dist[r * MCOLS + c] = 0; queue.push(r * MCOLS + c); }
  for (let head = 0; head < queue.length; head++) {
    const idx = queue[head];
    const r = (idx / MCOLS) | 0, c = idx % MCOLS, d = dist[idx];
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= MROWS || nc < 0 || nc >= MCOLS) continue;
      const ni = nr * MCOLS + nc;
      if (dist[ni] !== -1 || !isWater(m[nr][nc])) continue;
      dist[ni] = d + 1;
      queue.push(ni);
    }
  }
  // Re-band each water tile by distance. The border ring is skipped so the solid
  // map edge stays intact; water with no path to land (d <= 0) is left as-is.
  for (let r = 1; r < MROWS - 1; r++)
    for (let c = 1; c < MCOLS - 1; c++) {
      if (!isWater(m[r][c])) continue;
      const d = dist[r * MCOLS + c];
      if (d <= 0) continue;
      if      (d <= SHALLOW_W)            m[r][c] = T.SHALLOW_WATER;
      else if (d <= SHALLOW_W + MEDIUM_W) m[r][c] = T.MEDIUM_WATER;
      else                                m[r][c] = T.DEEP_WATER;
    }
}

// Carve `count` wadeable SHALLOW_WATER secondary channels between random points,
// meandering like drunkWalk but stamping shallow water. Run AFTER the depth
// banding so the channels read as the water region's secondary paths cutting
// across the deeper water. Never overwrites the SAND main paths/land, placed
// structures (chests, shrines, …), or bridges.
function carveShallowChannels(m, count) {
  for (let i = 0; i < count; i++) {
    let r = rnd(10, MROWS - 10), c = rnd(10, MCOLS - 10);
    const er = rnd(10, MROWS - 10), ec = rnd(10, MCOLS - 10);
    const maxSteps = (MROWS + MCOLS) * 4;
    for (let s = 0; s < maxSteps && (Math.abs(r - er) + Math.abs(c - ec)) > 2; s++) {
      let mr = 0, mc = 0;
      if (genRandom() < 0.65) {                 // bias toward the far point
        if (Math.abs(er - r) > Math.abs(ec - c)) mr = Math.sign(er - r);
        else                                     mc = Math.sign(ec - c);
      } else {                                     // occasional meander
        if (genRandom() < 0.5) mr = (genRandom() < 0.5 ? 1 : -1);
        else                     mc = (genRandom() < 0.5 ? 1 : -1);
      }
      r = Math.max(1, Math.min(MROWS - 2, r + mr));
      c = Math.max(1, Math.min(MCOLS - 2, c + mc));
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr, nc = c + dc, t = m[nr][nc];
          if (nr > 0 && nr < MROWS - 1 && nc > 0 && nc < MCOLS - 1 &&
              !isProtectedFeature(t) && t !== T.SAND && t !== T.BRIDGE)
            m[nr][nc] = T.SHALLOW_WATER;
        }
    }
  }
}

