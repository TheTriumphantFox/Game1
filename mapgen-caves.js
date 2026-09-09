// map-gen cave-level maze/chamber carving
// Split out of map-gen.js (generation-time only; plain <script> globals, all
// cross-file calls resolve at runtime). See index.html for load order.

// The transition tile (just inside the rock border) and its inner landing tile
// for one edge.
function caveEdgeSpot(edge) {
  const cx = Math.floor(MCOLS / 2), cy = Math.floor(MROWS / 2);
  const inset = 2;
  switch (edge) {
    case 'top':    return { tr: inset,             tc: cx, lr: inset + 1,         lc: cx };
    case 'bottom': return { tr: MROWS - 1 - inset, tc: cx, lr: MROWS - 2 - inset, lc: cx };
    case 'left':   return { tr: cy, tc: inset,             lr: cy, lc: inset + 1 };
    default:       return { tr: cy, tc: MCOLS - 1 - inset, lr: cy, lc: MCOLS - 2 - inset }; // right
  }
}

// How many of the maze's UNUSED adjacencies get opened as extra loops, after the
// spanning tree is finished.
//
// A recursive-backtracker maze is a tree: exactly one route between any two
// points, which in a cave the size of these means every wrong turn is a dead end
// you have to walk back out of, and the way home is the way you came. That is a
// maze; it is not a cave system. These braids turn a share of the walls the tree
// left standing into openings, so most junctions have a way round.
//
// 0.35 is measured rather than picked. On the 18×18 cell grid these maps carve,
// the tree uses 323 of 612 possible links and leaves roughly a quarter of its
// cells as dead ends; 0.35 adds about 118 more links, which takes the dead-end
// count to single figures (measured across five maps: 6-10 of 324) while still
// leaving 37% of the interior solid rock. So it is a cave system with pillars
// and ways round, not one open hall — at 1.0 every cell joins every neighbour
// and the interior really would be a hall.
//
// Braided AFTER the tree, never instead of it: the tree is what guarantees the
// cave is fully connected, and every extra link only ever adds a route.
const CAVE_LOOP_FRACTION = 0.35;

// Carve a recursive-backtracker maze of CAVE_FLOOR tunnels into the solid-rock
// map `m`, filling the interior inside `margin`. Each cell carves a room of a
// random 3–6-tile size and links to its tree neighbours with a corridor as wide
// as the narrower of the two rooms, so the tunnels bulge and pinch between 3 and
// 6 wide. The cell pitch leaves a ≥2-tile rock wall between unlinked parallel
// corridors, so they never merge by accident.
//
// The spanning tree is then BRAIDED (see CAVE_LOOP_FRACTION): a share of the
// adjacencies the tree did not use are opened too, so the result has loops and
// more than one way through instead of one path between any two points.
function carveCaveMaze(m, margin, floor = T.CAVE_FLOOR) {
  const MINW = 3, MAXW = 6, WALLT = 2, PITCH = MAXW + WALLT;   // 8
  const r0 = margin, c0 = margin;
  const rows = Math.floor((MROWS - margin - r0 - MAXW) / PITCH) + 1;
  const cols = Math.floor((MCOLS - margin - c0 - MAXW) / PITCH) + 1;
  const sizes = new Uint8Array(rows * cols);
  for (let i = 0; i < sizes.length; i++) sizes[i] = rnd(MINW, MAXW);
  const cellR = (cr) => r0 + cr * PITCH, cellC = (cc) => c0 + cc * PITCH;
  // Carve a cell's s×s room, anchored at the cell's top-left.
  const room = (cr, cc) => {
    const s = sizes[cr * cols + cc], R = cellR(cr), C = cellC(cc);
    setRect(m, R, C, R + s - 1, C + s - 1, floor);
  };
  // Carve a corridor joining linked cells A and B — width = min of their rooms,
  // aligned to the shared top (horizontal link) or left (vertical link) edge.
  const link = (ar, ac, br, bc) => {
    const sA = sizes[ar * cols + ac], sB = sizes[br * cols + bc], lw = Math.min(sA, sB);
    const RA = cellR(ar), CA = cellC(ac), RB = cellR(br), CB = cellC(bc);
    if (ar === br) setRect(m, RA, Math.min(CA, CB), RA + lw - 1, Math.max(CA + sA, CB + sB) - 1, floor);
    else           setRect(m, Math.min(RA, RB), CA, Math.max(RA + sA, RB + sB) - 1, CA + lw - 1, floor);
  };
  const visited = new Uint8Array(rows * cols);
  const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  // Which adjacencies the tree actually used. Keyed on the pair, smaller cell
  // first, so a link is recorded once however it was walked.
  const linked = new Set();
  const linkKey = (ar, ac, br, bc) => {
    const a = ar * cols + ac, b = br * cols + bc;
    return a < b ? `${a}:${b}` : `${b}:${a}`;
  };
  let sr = rnd(0, rows - 1), sc = rnd(0, cols - 1);
  visited[sr * cols + sc] = 1; room(sr, sc);
  const stack = [[sr, sc]];                           // iterative DFS (no recursion limit)
  while (stack.length) {
    const [cr, cc] = stack[stack.length - 1];
    const opts = [];
    for (const [dr, dc] of DIRS) {
      const nr = cr + dr, nc = cc + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !visited[nr * cols + nc])
        opts.push([nr, nc]);
    }
    if (!opts.length) { stack.pop(); continue; }
    const [nr, nc] = opts[rnd(0, opts.length - 1)];
    visited[nr * cols + nc] = 1;
    room(nr, nc);
    link(cr, cc, nr, nc);
    linked.add(linkKey(cr, cc, nr, nc));
    stack.push([nr, nc]);
  }

  // Braid: open a share of the walls the tree left standing.
  //
  // Every unused adjacency is collected first and then shuffled, rather than
  // rolling a die per wall in scan order. Scan order would bias the loops toward
  // the top-left of the map — the first walls looked at are the first opened —
  // and the whole point is that the extra routes are spread through the cave.
  const spare = [];
  for (let cr = 0; cr < rows; cr++) {
    for (let cc = 0; cc < cols; cc++) {
      // Only east and south, so each adjacency is offered exactly once.
      if (cc + 1 < cols && !linked.has(linkKey(cr, cc, cr, cc + 1))) spare.push([cr, cc, cr, cc + 1]);
      if (cr + 1 < rows && !linked.has(linkKey(cr, cc, cr + 1, cc))) spare.push([cr, cc, cr + 1, cc]);
    }
  }
  for (let i = spare.length - 1; i > 0; i--) {        // Fisher-Yates, on the generator's own rnd
    const j = rnd(0, i);
    const t = spare[i]; spare[i] = spare[j]; spare[j] = t;
  }
  const extra = Math.round(rows * cols * CAVE_LOOP_FRACTION);
  for (let i = 0; i < extra && i < spare.length; i++) {
    const [ar, ac, br, bc] = spare[i];
    link(ar, ac, br, bc);
  }
}

// Open a few large chambers across the labyrinth — combat arenas and breathers
// from the tight tunnels. Each is carved straight onto the floor so it overlaps
// the surrounding corridors and stays part of the connected network.
function carveCaveChambers(m, margin, count, floor = T.CAVE_FLOOR) {
  for (let i = 0; i < count; i++) {
    const w = rnd(8, 14), h = rnd(8, 14);
    const r = rnd(margin + 2, MROWS - margin - 3 - h);
    const c = rnd(margin + 2, MCOLS - margin - 3 - w);
    setRect(m, r, c, r + h, c + w, floor);
  }
}

// Flood a few pools of water onto the cave floor. Each is an elliptical blob of
// wadeable SHALLOW_WATER; tiles deep in its interior (all eight neighbours
// watered) deepen to swim-only MEDIUM_WATER, so a deep core only forms where the
// pool is wide and the shallow rim always offers a way around — connectivity is
// never broken. Only CAVE_FLOOR is flooded, so walls, the heart chamber, and the
// transitions stay intact. `count` is rolled 1d4-1 by the caller (0–3 per map).
function carveCavePools(m, margin, count) {
  const cx = Math.floor(MCOLS / 2), cy = Math.floor(MROWS / 2);
  for (let i = 0; i < count; i++) {
    let cr = 0, cc = 0, found = false;
    for (let t = 0; t < 60 && !found; t++) {
      cr = rnd(margin + 7, MROWS - margin - 8);
      cc = rnd(margin + 7, MCOLS - margin - 8);
      // Centre on open floor and keep clear of the heart so the chest room never
      // floods.
      if (m[cr][cc] === T.CAVE_FLOOR && (Math.abs(cr - cy) > 12 || Math.abs(cc - cx) > 12)) found = true;
    }
    if (!found) continue;
    const rad = rnd(3, 6);
    // Pass 1: elliptical shallow blob over floor only.
    for (let dr = -rad; dr <= rad; dr++)
      for (let dc = -rad; dc <= rad; dc++) {
        const r = cr + dr, c = cc + dc;
        if (r <= margin || r >= MROWS - 1 - margin || c <= margin || c >= MCOLS - 1 - margin) continue;
        if ((dr * dr + dc * dc) <= rad * rad && m[r][c] === T.CAVE_FLOOR) m[r][c] = T.SHALLOW_WATER;
      }
    // Pass 2: deepen interior shallow tiles (all 8 neighbours watered) to medium.
    for (let dr = -rad; dr <= rad; dr++)
      for (let dc = -rad; dc <= rad; dc++) {
        const r = cr + dr, c = cc + dc;
        if (r <= margin || r >= MROWS - 1 - margin || c <= margin || c >= MCOLS - 1 - margin) continue;
        if (m[r][c] !== T.SHALLOW_WATER) continue;
        let interior = true;
        for (let a = -1; a <= 1 && interior; a++)
          for (let b = -1; b <= 1; b++) {
            const t = m[r + a][c + b];
            if (t !== T.SHALLOW_WATER && t !== T.MEDIUM_WATER) { interior = false; break; }
          }
        if (interior) m[r][c] = T.MEDIUM_WATER;
      }
  }
}

// Splice an edge transition into the maze: carve a 3-wide CAVE_FLOOR stub from
// the border transition tile straight inward (toward centre), far enough to punch
// through the rock rim and overlap the first rings of maze tunnels — which
// guarantees the transition joins the labyrinth. (dr, dc) is the inward step.
function carveCaveStub(m, tr, tc, dr, dc, floor = T.CAVE_FLOOR) {
  let r = tr, c = tc;
  for (let i = 0; i < 12; i++) {
    for (let w = -1; w <= 1; w++) {
      const rr = r + (dc !== 0 ? w : 0);
      const cc = c + (dr !== 0 ? w : 0);
      if (rr > 0 && rr < MROWS - 1 && cc > 0 && cc < MCOLS - 1) m[rr][cc] = floor;
    }
    r += dr; c += dc;
  }
}

// Drop `count` small chests (1d4 per cave, rolled by the caller) onto open cave
// floor within the inclusive region [r0..r1] × [c0..c1]. Each lands on a
// CAVE_FLOOR tile whose four orthogonal neighbours are also floor, so a chest —
// which is solid — never plugs a one-wide pinch (it always sits in a spot ≥3
// wide, leaving a way around) and the hero can always stand beside it to open
// it. The floor check also keeps chests off transitions, the large chest,
// torches, and water; and since a placed chest is no longer CAVE_FLOOR, two
// chests never stack or sit flush against each other.
function placeCaveChests(m, count, r0, c0, r1, c1, floor = T.CAVE_FLOOR) {
  for (let i = 0; i < count; i++) {
    for (let t = 0; t < 200; t++) {
      const r = rnd(r0, r1), c = rnd(c0, c1);
      if (m[r][c] !== floor) continue;
      if (m[r - 1][c] !== floor || m[r + 1][c] !== floor ||
          m[r][c - 1] !== floor || m[r][c + 1] !== floor) continue;
      m[r][c] = T.CHEST;
      break;
    }
  }
}

// Default (rock-cave) theme for buildCaveLevelMap: solid craggy walls carved into
// near-black tunnels, torch ambience, and the water-pool pass. `exit` returns to
// the source map / previous level; `descent` leads one level deeper.
const ROCK_CAVE_THEME = {
  wall: T.CAVE_WALL, floor: T.CAVE_FLOOR,
  exit: T.CAVE_EXIT, descent: T.CAVE_DESCENT,
  decoration: T.TORCH, pools: true, torches: true,
};

function buildCaveLevelMap(isFinal, theme = ROCK_CAVE_THEME) {
  const WALL = theme.wall, FLOOR = theme.floor;
  const m = makeTile(MROWS, MCOLS, WALL);
  const cx = Math.floor(MCOLS / 2), cy = Math.floor(MROWS / 2);
  const margin = 4;                                  // solid rim

  // Carve the labyrinth of wide (3–6) winding tunnels across the whole interior.
  carveCaveMaze(m, margin, FLOOR);

  // A handful of larger chambers open up the tunnels here and there.
  carveCaveChambers(m, margin, rnd(2, 4), FLOOR);

  // Occasional pools of water — 1d4-1 per map (0–3). Skipped for themes without
  // standing water (a sky cave of cloud holds none).
  if (theme.pools) carveCavePools(m, margin, rnd(1, 4) - 1);

  // Scatter a little ambience across the floor — torchlight in a rock cave, or a
  // dapple of the region's brighter cloud-puff in a sky cave (both passable).
  if (theme.decoration != null) scatterOn(m, theme.decoration, 14, FLOOR);

  // A small open chamber at the heart of the maze — the prize room on the final
  // level, a breather junction otherwise. It overlaps several maze cells, so it
  // always merges into the connected tunnel network.
  setRect(m, cy - 2, cx - 2, cy + 2, cx + 2, FLOOR);

  // Two distinct edges: one entrance, one for going deeper (Fisher–Yates pick 2).
  const edges = ['top', 'bottom', 'left', 'right'];
  for (let i = edges.length - 1; i > 0; i--) { const j = rnd(0, i); const t = edges[i]; edges[i] = edges[j]; edges[j] = t; }
  const STEP = { top: [1, 0], bottom: [-1, 0], left: [0, 1], right: [0, -1] };

  const e = caveEdgeSpot(edges[0]);
  carveCaveStub(m, e.tr, e.tc, STEP[edges[0]][0], STEP[edges[0]][1], FLOOR);
  m[e.tr][e.tc] = theme.exit;
  m[e.lr][e.lc] = FLOOR;

  let deeperLand = null;
  if (!isFinal) {
    const d = caveEdgeSpot(edges[1]);
    carveCaveStub(m, d.tr, d.tc, STEP[edges[1]][0], STEP[edges[1]][1], FLOOR);
    m[d.tr][d.tc] = theme.descent;
    m[d.lr][d.lc] = FLOOR;
    deeperLand = { x: d.lc, y: d.lr };
  } else {
    m[cy][cx]     = T.LARGE_CHEST;          // the reward at the heart of the deepest cave
    m[cy][cx + 1] = T.LARGE_CHEST_R;
    // A radiant return portal two tiles below the chest — a one-step shortcut back
    // out to the overworld region map, so claiming the prize doesn't mean retracing
    // the whole labyrinth (or climbing back up every chain level). Set below (not
    // flush against) the chest so the spot the hero opens it from stays a plain
    // floor tile — no accidental teleport while reaching for the reward.
    m[cy + 2][cx] = T.CHEST_EXIT;
    if (theme.torches) {                    // torches flanking the prize chamber (rock caves only)
      m[cy - 2][cx - 2] = T.TORCH; m[cy - 2][cx + 2] = T.TORCH;
      m[cy + 2][cx - 2] = T.TORCH; m[cy + 2][cx + 2] = T.TORCH;
    }
  }

  // Sprinkle 1d4 small chests through the labyrinth. Placed last so the floor
  // check excludes the transitions and (on the final level) the large chest.
  placeCaveChests(m, rnd(1, 4), margin + 1, margin + 1, MROWS - margin - 2, MCOLS - margin - 2, FLOOR);

  return { map: m, entryLand: { x: e.lc, y: e.lr }, deeperLand };
}

// Build one level of a sky cave for a cloud region (air / lightning). Same maze,
// chambers, and chest layout as a rock cave, but carved from the region's own
// tiles: an impassable cloud-edge lip (region.cloudEdge) tunneled into a rolling
// floor of the region's ground cloud (region.ground), dappled with its brighter
// puff (region.decoration). The transitions are wind gusts — SKY_EXIT drops the
// hero back out / down a level, SKY_ASCENT lifts them one level higher.
function buildSkyCaveLevelMap(isFinal, region) {
  return buildCaveLevelMap(isFinal, {
    wall: region.cloudEdge, floor: region.ground,
    exit: T.SKY_EXIT, descent: T.SKY_ASCENT,
    decoration: region.decoration, pools: false, torches: false,
  });
}

// ─── Ruined dungeon interior ───────────────────────────────────────────────────
// The single-level dungeon reached by stepping onto a DUNGEON_DOOR out in an
// overworld map (one per region — see stampRuinedDungeon / createDungeonMap). Same
// maze-of-rooms carving as a rock cave, but themed in dressed stone: solid WALL
// tunneled into flagstone FLOOR, torch-lit, with a LARGE_CHEST reward at the heart
// of the labyrinth. There is only one transition — a DUNGEON_DOOR on one edge that
// leads back out to the overworld (built as a "final" level, so no way deeper).
const DUNGEON_THEME = {
  wall: T.WALL, floor: T.FLOOR,
  exit: T.DUNGEON_DOOR, descent: T.DUNGEON_DOOR,   // single level — descent unused
  decoration: T.TORCH, pools: false, torches: true,
};
function buildDungeonLevelMap() {
  // isFinal=true: one exit door + the heart-chest reward, no descent.
  return buildCaveLevelMap(true, DUNGEON_THEME);
}

