// ─── Tile manipulation primitives ─────────────────────────────────────────────
// Pure helpers for creating and mutating tile maps. No game state references.

function makeTile(rows, cols, fill) {
  const m = [];
  for (let r = 0; r < rows; r++) {
    m.push(new Uint8Array(cols).fill(fill));
  }
  return m;
}

function setRect(m, r1, c1, r2, c2, t) {
  for (let r = r1; r <= r2; r++)
    for (let c = c1; c <= c2; c++)
      m[r][c] = t;
}

function setRow(m, r, c1, c2, t) {
  for (let c = c1; c <= c2; c++) m[r][c] = t;
}

function setCol(m, c, r1, r2, t) {
  for (let r = r1; r <= r2; r++) m[r][c] = t;
}

// ─── Seeded generation stream ─────────────────────────────────────────────────
// Map generation is supposed to be reproducible — the builders have always taken a
// `seed` argument — but every one of them ignored it and ran on bare Math.random().
// That is why a map rebuilt on load (anything the player never entered stores no
// tiles, see save.js) came back as an entirely unrelated map rather than the same one.
//
// `rnd()` is the choke point: ~150 of the generation call sites already go through it.
// So rather than thread a generator object through every helper signature, generation
// runs against a module-level stream that the builders swap in for the duration of a
// build. JS is single-threaded and generation is fully synchronous, so there is no
// interleaving to worry about.
//
// The default is Math.random, deliberately: rnd() is ALSO called at runtime by
// enemies.js, player.js, render.js, tower.js and villagers.js, and none of that
// should become deterministic — a save reloaded twice should not replay identical
// loot rolls. Only code running inside a begin/end window sees the seeded stream.
let _genRandom = Math.random;

// mulberry32 — small, fast, well-distributed enough for terrain. Not cryptographic,
// which is irrelevant here.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// FNV-1a over the string form of every part, so a seed can be built from whatever
// identifies a map (world seed, grid coords, depth) without caring about types.
function hashSeed(...parts) {
  let h = 0x811c9dc5;
  for (const p of parts) {
    const s = String(p);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
  }
  return h >>> 0;
}

// Swap in a seeded stream and hand back the previous one, so calls can nest (a
// builder that calls another builder restores rather than clobbering). A null/undefined
// seed keeps the unseeded stream — that is the escape hatch for anything that
// genuinely wants fresh randomness, and what old call sites get by default.
function beginSeededGeneration(seed) {
  const prev = _genRandom;
  if (seed !== undefined && seed !== null) _genRandom = mulberry32(hashSeed(seed));
  return prev;
}
function endSeededGeneration(prev) { _genRandom = prev || Math.random; }

// The generation-side replacement for a bare Math.random(). Every direct call inside
// a mapgen file goes through this so it follows the seeded stream; rnd() below is the
// integer-range form and the one most call sites want.
function genRandom() { return _genRandom(); }

function rnd(a, b) {
  return a + Math.floor(_genRandom() * (b - a + 1));
}

// FNV-1a over a whole tile array. Used to answer one question cheaply: has gameplay
// modified this map since it was generated? A seeded map can be regenerated exactly
// (see beginSeededGeneration), so an untouched one needs no tiles in the save at all —
// but the moment the hero cuts foliage, bombs a rock, or raises a boss chest, the live
// map and its recipe diverge and the tiles have to be stored.
//
// A hash rather than a diff on purpose. Regenerating a map to diff against costs ~6ms,
// which is ~1.5s across a full world on every autosave; hashing is ~0.05ms, so the
// clean/dirty question is answered for the whole world in a few milliseconds and only
// genuinely modified maps pay for their tiles.
function tileHash(mapArr) {
  let h = 0x811c9dc5;
  for (let r = 0; r < MROWS; r++) {
    const row = mapArr[r];
    for (let c = 0; c < MCOLS; c++) {
      h ^= row[c];
      h = Math.imul(h, 0x01000193);
    }
  }
  return h >>> 0;
}

// True if `t` is any tile belonging to a chest (single, large 1×2, or boss
// 2×2). Chests are solid objects — the player opens them by bumping, not by
// standing on them — so this is shared by isSolid and the bump-to-open logic.
function isChestTile(t) {
  return t === T.CHEST || t === T.LARGE_CHEST || t === T.LARGE_CHEST_R ||
         t === T.BOSS_CHEST_TL || t === T.BOSS_CHEST_TR ||
         t === T.BOSS_CHEST_BL || t === T.BOSS_CHEST_BR;
}

// The 2×2 King's Hoard boss chest sits on the village plaza, south of the central
// fountain. Its anchor (top-left tile) is deterministic from the map size, so both
// the village builder (which paints the plaza) and the runtime place/remove logic
// (player.js — the chest only materialises once the boss falls, and is stripped
// the moment the hero first leaves the village) derive its position from here.
function villageBossChestAnchor() {
  return { r: Math.floor(MROWS / 2) + 6, c: Math.floor(MCOLS / 2) - 1 };
}

// Returns true if the tile at (c, r) blocks movement.
// Used both by movement code and the connectivity flood-fill.
// The blocking-tile list lives in SOLID_TILES (config.js); chests block too but
// are kept separate (see SOLID_TILES / isChestTile) so the connectivity flood can
// still treat them as walkable triggers.
function isSolid(map, c, r) {
  if (c < 0 || r < 0 || c >= MCOLS || r >= MROWS) return true;
  const t = map[r][c];
  return SOLID_TILES.has(t) || isChestTile(t);
}

// The height an actor STANDS AT on this tile, in world units, as opposed to how
// tall the tile LOOKS (that is TILE_HEIGHT in config.js).
//
// The rule: a passable tile is walked THROUGH, not climbed ONTO, so its surface
// is the ground however tall its art is. A fern is 0.3 to the renderer and 0 to
// the hero's knees. That is what keeps one height table honest for both jobs
// instead of needing a second column that can drift out of step with the first.
//
// A solid tile reports its full height. Nothing can stand there today, so this
// is only meaningful to a caller asking "how high is the thing in front of me",
// which is what the projectile gate in 5c wants: an arrow clears a ROCK (0.40)
// and not a WALL (1.60).
//
// Out of bounds reports 0 rather than a height. The border is not a ledge, and a
// caller pairing this with isSolid() already gets "blocked" from that.
// T.LEDGE is the ONE exception to the rule above, and it is deliberate: it is
// the only passable tile in the game that you stand ON TOP OF rather than walk
// THROUGH, so it reports its height even though it does not block. That is what
// a shelf IS. Everything else passable stays 0, so the fern rule is intact.
function surfaceZ(map, c, r) {
  if (c < 0 || r < 0 || c >= MCOLS || r >= MROWS) return 0;
  const t = map[r][c];
  if (t === T.LEDGE) return TILE_HEIGHT[t];
  return isSolid(map, c, r) ? TILE_HEIGHT[t] : 0;
}

// ─── Ledge shelves ────────────────────────────────────────────────────────────

// How far up an actor can step WITHOUT a ramp. A ledge is a full tile, so it
// cannot be climbed and an actor has to find a T.CLIMB ramp or a way around,
// which is the whole point of the mechanic. Anything shorter is a kerb and is
// walked up without comment.
//
// Lives here rather than in player.js because it is not the hero's rule: the
// hero, enemies and the pathfinder all measure against it, and a movement
// constant owned by one of three callers is one refactor away from drifting.
const STEP_UP_MAX = 0.50;

// A ramp is the sanctioned way up. Stepping onto or off one skips the step-up
// gate and skips the fall, because a ramp is the slope between two heights
// rather than either of them. T.CLIMB already means exactly this for plateaus,
// so ledges reuse it rather than inventing a second word for the same idea.
//
// Both directions are exempt, not just "onto": walking DOWN a ramp off a shelf
// must not trigger a one-tile drop animation halfway along the slope.
function isRampStep(map, c1, r1, c2, r2) {
  return (map[r1] && map[r1][c1] === T.CLIMB) ||
         (map[r2] && map[r2][c2] === T.CLIMB);
}

// Can an actor standing at (c1, r1) step to (c2, r2) without a ramp? Solidity is
// the caller's business; this answers height only.
//
// One rule, one place. The hero (player.js), enemies (projectiles.js) and the
// tap-to-travel pathfinder (main.js) all ask here, because a pathfinder that
// disagrees with the movement it is planning for walks the hero into a wall it
// cannot climb and then gives up.
function stepUpBlocked(map, c1, r1, c2, r2) {
  if (isRampStep(map, c1, r1, c2, r2)) return false;
  return surfaceZ(map, c2, r2) - surfaceZ(map, c1, r1) > STEP_UP_MAX;
}

// Stamp a rectangular ledge shelf whose ENTIRE perimeter is faced, which is the
// invariant the connectivity flood-fill depends on (see T.LEDGE in config.js).
//
// Every tile of the rect becomes LEDGE, then every tile of it that touches a
// non-ledge neighbour becomes LEDGE_FACE. That leaves the shelf sealed to the
// flood exactly as it is sealed to the player, so the two cannot disagree.
//
// `ramps` is a list of [c, r] inside the rect that become T.CLIMB instead: the
// only way up, for the flood and for the hero alike. A shelf with no ramps is
// legal and simply unreachable, so ensureConnectivity will seal its interior;
// that is correct, and it is why this returns the tile count it laid, so a
// caller can assert it built what it meant to.
function stampLedgeShelf(map, c1, r1, c2, r2, ramps) {
  const lo = (a, b) => Math.max(1, Math.min(a, b));
  const hi = (a, b, m) => Math.min(m - 2, Math.max(a, b));
  const cA = lo(c1, c2), cB = hi(c1, c2, MCOLS);
  const rA = lo(r1, r2), rB = hi(r1, r2, MROWS);
  if (cB < cA || rB < rA) return { ledge: 0, face: 0, ramp: 0 };

  for (let r = rA; r <= rB; r++) for (let c = cA; c <= cB; c++) map[r][c] = T.LEDGE;

  // Face every edge tile. Tested against the rect rather than the tile array so
  // two shelves laid side by side do not face each other along the seam.
  const inRect = (c, r) => c >= cA && c <= cB && r >= rA && r <= rB;
  let face = 0;
  for (let r = rA; r <= rB; r++) {
    for (let c = cA; c <= cB; c++) {
      if (inRect(c - 1, r) && inRect(c + 1, r) && inRect(c, r - 1) && inRect(c, r + 1)) continue;
      map[r][c] = T.LEDGE_FACE;
      face++;
    }
  }

  let ramp = 0;
  for (const [rc, rr] of (ramps || [])) {
    if (!inRect(rc, rr)) continue;
    map[rr][rc] = T.CLIMB;
    ramp++;
    if (face > 0) face--;
  }
  const total = (cB - cA + 1) * (rB - rA + 1);
  return { ledge: total - face - ramp, face, ramp };
}

// Audit: every LEDGE tile that touches a lower, passable, non-ramp neighbour is
// a hole in the invariant above, because the flood can walk in there and the
// player cannot. Returns the offending coordinates, empty when the map is sound.
//
// Not called in the game loop; it is a level-design check, meant to be run from
// the console or a probe over a freshly generated map.
function findUnfacedLedgeEdges(map) {
  const bad = [];
  for (let r = 0; r < MROWS; r++) {
    for (let c = 0; c < MCOLS; c++) {
      if (map[r][c] !== T.LEDGE) continue;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = c + dc, nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= MCOLS || nr >= MROWS) continue;
        if (isSolid(map, nc, nr)) continue;              // faced, or otherwise blocked
        if (isRampStep(map, c, r, nc, nr)) continue;     // sanctioned way up
        if (surfaceZ(map, nc, nr) >= surfaceZ(map, c, r)) continue;  // level ground
        bad.push([c, r, nc, nr]);
      }
    }
  }
  return bad;
}

// Medium-depth water is solid to ordinary walkers, but not to everything:
// projectiles fly over it and aquatic (`swims: true`) enemies move through it.
// Bounds-checked so callers can pair it directly with isSolid().
function isMediumWater(map, c, r) {
  return c >= 0 && r >= 0 && c < MCOLS && r < MROWS && map[r][c] === T.MEDIUM_WATER;
}

// Drunk-walk path carving. Biases toward the target but takes random detours,
// producing organic winding corridors.
function drunkWalk(m, sr, sc, er, ec, t, width) {
  let r = sr, c = sc;
  const maxSteps = (MROWS + MCOLS) * 4;
  for (let i = 0; i < maxSteps && (Math.abs(r - er) + Math.abs(c - ec)) > 3; i++) {
    const dr = er - r, dc = ec - c;
    let mr = 0, mc = 0;
    if (genRandom() < 0.65) {  // bias toward target
      if (Math.abs(dr) > Math.abs(dc)) mr = Math.sign(dr);
      else mc = Math.sign(dc);
    } else {
      if (genRandom() < 0.5) mr = (genRandom() < 0.5 ? 1 : -1);
      else mc = (genRandom() < 0.5 ? 1 : -1);
    }
    r = Math.max(1, Math.min(MROWS - 2, r + mr));
    c = Math.max(1, Math.min(MCOLS - 2, c + mc));
    for (let dr2 = -width; dr2 <= width; dr2++)
      for (let dc2 = -width; dc2 <= width; dc2++) {
        const nr = r + dr2, nc = c + dc2;
        if (nr > 0 && nr < MROWS - 1 && nc > 0 && nc < MCOLS - 1) m[nr][nc] = t;
      }
  }
  // Always ensure the endpoint is reached, even if we exhausted steps
  for (let dr2 = -width; dr2 <= width; dr2++)
    for (let dc2 = -width; dc2 <= width; dc2++) {
      const nr = er + dr2, nc = ec + dc2;
      if (nr > 0 && nr < MROWS - 1 && nc > 0 && nc < MCOLS - 1) m[nr][nc] = t;
    }
}

// Water-aware corridor carve. On dry ground it behaves like drunkWalk — biasing
// toward the target with the odd detour, painting `t` in a (2·width+1) brush.
// But it never wades along or paves dirt over standing water laid earlier: when a
// step would enter water it lays a single-tile BRIDGE plank straight across the
// water to the far bank, choosing the SHORTEST of the four cardinal directions so
// the plank always cuts transversely across the channel (never runs lengthwise
// down it), then resumes walking from the far bank. Every crossing is therefore a
// tidy 1-tile footbridge (well within "no wider than 2") meeting dry land at both
// ends. If a plank already runs parallel right beside this crossing (another
// corridor's, or a stream's bridgeStream plank), it reuses that one instead of
// laying a second beside it — so crossings never stack into a wide span. Channels
// wider than CAP are left alone (the walk routes around them). Used for the main
// path network in regions threaded by edge-to-edge water (forest streams, mana
// rivers): carve the water first, then run this so the corridors bridge it. Pair
// with anchorBridgeStubs (not anchorBridgesOnLand) to tidy ends without widening.
function bridgeWalk(m, sr, sc, er, ec, t, width) {
  const CAP = 16;                                        // widest channel we'll plank across
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const paintLand = (cr, cc) => {
    for (let dr = -width; dr <= width; dr++)
      for (let dc = -width; dc <= width; dc++) {
        const nr = cr + dr, nc = cc + dc;
        if (nr <= 0 || nr >= MROWS - 1 || nc <= 0 || nc >= MCOLS - 1) continue;
        const cur = m[nr][nc];
        if (isBridgeWater(cur) || cur === T.BRIDGE) continue;   // leave water / planks be
        if (!isProtectedFeature(cur)) m[nr][nc] = t;
      }
  };
  // Shortest straight cardinal crossing from dry tile (lr,lc) over the adjacent
  // water to the first dry tile beyond. Returns {dr,dc,fr,fc} or null.
  const findCrossing = (lr, lc) => {
    let best = null;
    for (const [dr, dc] of DIRS) {
      let pr = lr + dr, pc = lc + dc, steps = 1;
      if (pr <= 0 || pr >= MROWS - 1 || pc <= 0 || pc >= MCOLS - 1) continue;
      if (!isBridgeWater(m[pr][pc])) continue;           // this direction isn't into water
      while (steps <= CAP && pr > 0 && pr < MROWS - 1 && pc > 0 && pc < MCOLS - 1 &&
             isBridgeWater(m[pr][pc])) { pr += dr; pc += dc; steps++; }
      if (pr <= 0 || pr >= MROWS - 1 || pc <= 0 || pc >= MCOLS - 1) continue;
      if (isBridgeWater(m[pr][pc])) continue;            // no dry bank within CAP
      if (!best || steps < best.steps) best = { dr, dc, fr: pr, fc: pc, steps };
    }
    return best;
  };
  let r = sr, c = sc;
  const maxSteps = (MROWS + MCOLS) * 4;
  // If we start on water — e.g. an exit corridor whose gate mouth sits on a
  // stream/river mouth (they start right at the border) — plank straight toward
  // the target to the first dry tile, so the corridor gets a foothold on land and
  // the gate isn't left walled off by water. Without this the walk has no dry
  // start to work from and the gate's whole side of the channel is cut off.
  if (isBridgeWater(m[r][c])) {
    let mr = Math.abs(er - r) > Math.abs(ec - c) ? Math.sign(er - r) : 0;
    let mc = mr === 0 ? Math.sign(ec - c) : 0;
    if (mr === 0 && mc === 0) mc = 1;
    let steps = 0;
    while (steps < CAP && r > 0 && r < MROWS - 1 && c > 0 && c < MCOLS - 1 &&
           isBridgeWater(m[r][c])) {
      if (!isProtectedFeature(m[r][c])) m[r][c] = T.BRIDGE;
      r += mr; c += mc; steps++;
    }
  }
  if (!isBridgeWater(m[r][c])) paintLand(r, c);
  for (let i = 0; i < maxSteps && (Math.abs(r - er) + Math.abs(c - ec)) > 1; i++) {
    const dr = er - r, dc = ec - c;
    let mr = 0, mc = 0;
    if (genRandom() < 0.65) {                          // bias toward target
      if (Math.abs(dr) > Math.abs(dc)) mr = Math.sign(dr);
      else                             mc = Math.sign(dc);
    } else {                                             // occasional detour
      if (genRandom() < 0.5) mr = (genRandom() < 0.5 ? 1 : -1);
      else                     mc = (genRandom() < 0.5 ? 1 : -1);
    }
    const nr = r + mr, nc = c + mc;
    if (nr <= 0 || nr >= MROWS - 1 || nc <= 0 || nc >= MCOLS - 1) continue;
    if (isBridgeWater(m[nr][nc])) {                       // about to enter water — plank across
      const x = findCrossing(r, c);
      if (!x) continue;                                  // channel too wide here — route around
      // Anti-stack: if a plank already runs parallel right beside this crossing
      // (another corridor's, or a stream's bridgeStream plank), reuse it rather
      // than laying a second parallel plank — that keeps every crossing 1 tile
      // wide and never gives anchorBridgesOnLand a stacked pair to widen.
      const pr = x.dr !== 0 ? 0 : 1, pc = x.dc !== 0 ? 0 : 1;   // perpendicular to the crossing
      const f0r = r + x.dr, f0c = c + x.dc;
      if (m[f0r + pr][f0c + pc] !== T.BRIDGE && m[f0r - pr][f0c - pc] !== T.BRIDGE) {
        for (let qr = f0r, qc = f0c; qr !== x.fr || qc !== x.fc; qr += x.dr, qc += x.dc)
          if (!isProtectedFeature(m[qr][qc])) m[qr][qc] = T.BRIDGE;
      }
      r = x.fr; c = x.fc;                                // resume on the far bank
    } else {
      r = nr; c = nc;
    }
    paintLand(r, c);
  }
  if (!isBridgeWater(m[er][ec])) paintLand(er, ec);
}

// Scatter decorative tiles only on plain grass — never overwrites chests etc.
function scatter(m, tile, count) {
  for (let i = 0; i < count; i++) {
    const r = rnd(2, MROWS - 3), c = rnd(2, MCOLS - 3);
    if (m[r][c] === T.GRASS) m[r][c] = tile;
  }
}

// Like scatter() but seeds onto an arbitrary base tile (e.g. SAND in the desert,
// which has no grass for the plain scatter() to land on).
function scatterOn(m, tile, count, base) {
  for (let i = 0; i < count; i++) {
    const r = rnd(2, MROWS - 3), c = rnd(2, MCOLS - 3);
    if (m[r][c] === base) m[r][c] = tile;
  }
}

// True for placed structures that terrain features (streams, waterfalls, cliffs)
// must never paint over — chests, shrines, dungeon bits, doors, and portals.
function isProtectedFeature(t) {
  return isChestTile(t) || t === T.SHRINE || t === T.DUNGEON_DOOR ||
         t === T.FLOOR || t === T.PILLAR || t === T.TORCH ||
         t === T.DOOR || t === T.PORTAL;
}

// Carve a winding channel from (sr,sc) toward (er,ec). Paints a band `width`
// tiles to each side of a meandering centre line — width 1 → a 3-tile-wide
// stream, width 0 → a single-tile trickle. Skips protected structures. `tile`
// is the fill (default T.WATER; the ice region passes T.ICE for frozen streams).
// Returns the centre-line cells so callers can drop bridges or splash pools
// along the course.
function carveStream(m, sr, sc, er, ec, width, tile) {
  width = width === undefined ? 1 : width;
  tile = tile === undefined ? T.WATER : tile;
  const cells = [];
  let r = sr, c = sc;
  const maxSteps = (MROWS + MCOLS) * 4;
  for (let i = 0; i < maxSteps && (Math.abs(r - er) + Math.abs(c - ec)) > 2; i++) {
    const dr = er - r, dc = ec - c;
    let mr = 0, mc = 0;
    if (genRandom() < 0.7) {                 // bias toward the mouth
      if (Math.abs(dr) > Math.abs(dc)) mr = Math.sign(dr);
      else                             mc = Math.sign(dc);
    } else {                                    // meander for an organic course
      if (genRandom() < 0.5) mr = (genRandom() < 0.5 ? 1 : -1);
      else                     mc = (genRandom() < 0.5 ? 1 : -1);
    }
    r = Math.max(1, Math.min(MROWS - 2, r + mr));
    c = Math.max(1, Math.min(MCOLS - 2, c + mc));
    cells.push([r, c]);
    for (let dr2 = -width; dr2 <= width; dr2++)
      for (let dc2 = -width; dc2 <= width; dc2++) {
        const nr = r + dr2, nc = c + dc2;
        if (nr > 0 && nr < MROWS - 1 && nc > 0 && nc < MCOLS - 1 &&
            !isProtectedFeature(m[nr][nc])) m[nr][nc] = tile;
      }
  }
  return cells;
}

// Lay a plank BRIDGE across a carved stream at centre-line cell `idx`,
// perpendicular to the local flow so it always reaches both banks. Scans the
// contiguous water band at that point and stamps BRIDGE across it plus one tile
// of margin onto each bank.
function bridgeStream(m, cells, idx) {
  if (!cells.length) return;
  idx = Math.max(0, Math.min(cells.length - 1, idx));
  const [br, bc] = cells[idx];
  const a = cells[Math.max(0, idx - 3)];
  const b = cells[Math.min(cells.length - 1, idx + 3)];
  const flowsNS = Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]);
  if (flowsNS) {                               // horizontal plank
    let lc = bc, rc = bc;
    while (lc > 1         && m[br][lc - 1] === T.WATER) lc--;
    while (rc < MCOLS - 2 && m[br][rc + 1] === T.WATER) rc++;
    for (let c = lc - 1; c <= rc + 1; c++)
      if (c > 0 && c < MCOLS - 1 && !isProtectedFeature(m[br][c])) m[br][c] = T.BRIDGE;
  } else {                                     // vertical plank
    let tr = br, dn = br;
    while (tr > 1         && m[tr - 1][bc] === T.WATER) tr--;
    while (dn < MROWS - 2 && m[dn + 1][bc] === T.WATER) dn++;
    for (let r = tr - 1; r <= dn + 1; r++)
      if (r > 0 && r < MROWS - 1 && !isProtectedFeature(m[r][bc])) m[r][bc] = T.BRIDGE;
  }
}

// Any still-water tile a bridge should not begin or end on. Excludes WATERFALL
// (a bridge should stop against it, not pave through falling water).
function isBridgeWater(t) {
  return t === T.WATER || t === T.DEEP_WATER || t === T.SHALLOW_WATER ||
         t === T.MEDIUM_WATER || t === T.OASIS_WATER;
}

// Deep / standing water belongs only to the water region. Everywhere else every
// still-water tile (plain WATER, DEEP_WATER pools, desert OASIS_WATER) is demoted
// to MEDIUM_WATER — swimmable only while wearing the Water armor, solid otherwise.
// WATERFALL (animated falling water) is intentionally left alone. All of these
// tiles are solid to isSolid, so this never changes connectivity. Call after all
// stream/bridge carving (those scan for T.WATER) and before connectivity.
function demoteWaterToMedium(m) {
  for (let r = 1; r < MROWS - 1; r++)
    for (let c = 1; c < MCOLS - 1; c++) {
      const t = m[r][c];
      if (t === T.WATER || t === T.DEEP_WATER || t === T.OASIS_WATER)
        m[r][c] = T.MEDIUM_WATER;
    }
}

// Ice-region counterpart of demoteWaterToMedium: every standing-water tile
// freezes over into walkable (and slippery — see stepPlayerMovement) ICE
// sheets instead of swimmable medium water.
function freezeWaterToIce(m) {
  for (let r = 0; r < MROWS; r++)
    for (let c = 0; c < MCOLS; c++) {
      const t = m[r][c];
      if (t === T.WATER || t === T.DEEP_WATER || t === T.OASIS_WATER)
        m[r][c] = T.ICE;
    }
}

// Maybe drop a single 1-tile WHIRLPOOL out in open medium water. `chance` is
// the per-map spawn roll; `clearance` is the minimum Chebyshev / king-move
// distance the chosen MEDIUM_WATER tile must keep from the nearest shallow
// water or land. The defaults fit big open water (~30% of maps, 8 tiles off
// the medium shelf); small-pool regions pass a lower clearance — anything ≥2
// still keeps the vortex AND its 1-tile suction ring fully inside swim-only
// water, never beside where the player can wade or stand. The whirlpool tile
// is solid (so it never changes connectivity), exactly like the medium water
// it replaces. Returns true if one was placed. Run after all water has been
// finalized (depth banding / demotion) and after connectivity.
const WHIRLPOOL_CLEARANCE = 8;
function placeWhirlpool(m, chance = 0.30, clearance = WHIRLPOOL_CLEARANCE) {
  if (genRandom() >= chance) return false;
  // "Open" = water deep enough to be far from shore (medium or deep). Every
  // other tile (land, shallow water, features) seeds a multi-source 8-connected
  // BFS so each open-water tile learns its Chebyshev distance to the shore.
  const isOpen = (t) => t === T.MEDIUM_WATER || t === T.DEEP_WATER;
  const dist = new Int16Array(MROWS * MCOLS).fill(-1);
  const queue = [];
  for (let r = 0; r < MROWS; r++)
    for (let c = 0; c < MCOLS; c++)
      if (!isOpen(m[r][c])) { dist[r * MCOLS + c] = 0; queue.push(r * MCOLS + c); }
  const NB = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  for (let head = 0; head < queue.length; head++) {
    const idx = queue[head];
    const r = (idx / MCOLS) | 0, c = idx % MCOLS, d = dist[idx];
    for (const [dr, dc] of NB) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= MROWS || nc < 0 || nc >= MCOLS) continue;
      const ni = nr * MCOLS + nc;
      if (dist[ni] !== -1 || !isOpen(m[nr][nc])) continue;
      dist[ni] = d + 1;
      queue.push(ni);
    }
  }
  // Collect every medium-water tile far enough from shore, then pick one.
  const candidates = [];
  for (let r = 1; r < MROWS - 1; r++)
    for (let c = 1; c < MCOLS - 1; c++)
      if (m[r][c] === T.MEDIUM_WATER && dist[r * MCOLS + c] >= clearance)
        candidates.push([r, c]);
  if (!candidates.length) return false;
  const [wr, wc] = candidates[Math.floor(genRandom() * candidates.length)];
  m[wr][wc] = T.WHIRLPOOL;
  return true;
}

// Make every BRIDGE plank terminate on land. For each end of a bridge run, if
// the tile just beyond it is water, extend the plank across that water until it
// reaches a non-water tile — but only when land is actually within reach, so we
// never pave an endless bridge to nowhere. Result: bridges always connect land
// to land and never start or end at a water tile. Runs after all water + bridge
// placement (and, for the water region, after the depth banding).
function anchorBridgesOnLand(m) {
  const CAP = 40;                                  // max tiles to extend an end
  const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  for (let r = 1; r < MROWS - 1; r++)
    for (let c = 1; c < MCOLS - 1; c++) {
      if (m[r][c] !== T.BRIDGE) continue;
      for (const [dr, dc] of dirs) {
        // (r,c) is an end of a run along this axis only if the opposite
        // neighbour is also a bridge, and it faces water in this direction.
        if (m[r - dr][c - dc] !== T.BRIDGE) continue;
        if (!isBridgeWater(m[r + dr][c + dc])) continue;
        // Look ahead for the first non-water tile within CAP.
        let nr = r + dr, nc = c + dc, steps = 0, reached = false;
        while (steps < CAP && nr > 0 && nr < MROWS - 1 && nc > 0 && nc < MCOLS - 1) {
          if (!isBridgeWater(m[nr][nc])) { reached = true; break; }
          nr += dr; nc += dc; steps++;
        }
        if (!reached) continue;                    // no land in reach — leave it
        // Pave BRIDGE over the intervening water up to (not onto) that land.
        for (let pr = r + dr, pc = c + dc; pr !== nr || pc !== nc; pr += dr, pc += dc)
          if (!isProtectedFeature(m[pr][pc])) m[pr][pc] = T.BRIDGE;
      }
    }
}

// Conservative cousin of anchorBridgesOnLand for the edge-water regions (forest
// streams, mana rivers), where bridgeWalk lays many slim crossing planks close
// together. It only tidies a TRUE dangling stub — a BRIDGE tile with exactly one
// bridge neighbour — extending it across the water to the far bank. A tile flanked
// by parallel planks has two-plus bridge neighbours, so it is never touched: this
// can't widen a crossing the way the full sweep above would when planks sit side
// by side. Used in place of anchorBridgesOnLand so those regions' bridges still
// always meet land at both ends while staying no more than 2 tiles wide.
function anchorBridgeStubs(m) {
  const CAP = 40;
  const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  for (let r = 1; r < MROWS - 1; r++)
    for (let c = 1; c < MCOLS - 1; c++) {
      if (m[r][c] !== T.BRIDGE) continue;
      let nbrs = 0, ndr = 0, ndc = 0;
      for (const [dr, dc] of dirs) if (m[r + dr][c + dc] === T.BRIDGE) { nbrs++; ndr = dr; ndc = dc; }
      if (nbrs !== 1) continue;                    // only a lone dangling end
      const dr = -ndr, dc = -ndc;                  // point away from the one neighbour
      if (!isBridgeWater(m[r + dr][c + dc])) continue;
      let nr = r + dr, nc = c + dc, steps = 0, reached = false;
      while (steps < CAP && nr > 0 && nr < MROWS - 1 && nc > 0 && nc < MCOLS - 1) {
        if (!isBridgeWater(m[nr][nc])) { reached = true; break; }
        nr += dr; nc += dc; steps++;
      }
      if (!reached) continue;
      for (let pr = r + dr, pc = c + dc; pr !== nr || pc !== nc; pr += dr, pc += dc)
        if (!isProtectedFeature(m[pr][pc])) m[pr][pc] = T.BRIDGE;
    }
}

// Open 5-wide exit gates on the four border edges. Called twice during map
// build (once mid-build, once after the final border lock) since the second
// pass re-seals the border.
function cutExits(m, hasLeft, hasRight, hasUp, hasDown) {
  const ft = T.PATH;
  if (hasRight) for (let dr = -2; dr <= 2; dr++) { const r = EXIT_ROW + dr; if (r > 0 && r < MROWS - 1) m[r][MCOLS - 1] = ft; }
  if (hasLeft)  for (let dr = -2; dr <= 2; dr++) { const r = EXIT_ROW + dr; if (r > 0 && r < MROWS - 1) m[r][0]         = ft; }
  if (hasDown)  for (let dc = -2; dc <= 2; dc++) { const c = EXIT_COL + dc; if (c > 0 && c < MCOLS - 1) m[MROWS - 1][c] = ft; }
  if (hasUp)    for (let dc = -2; dc <= 2; dc++) { const c = EXIT_COL + dc; if (c > 0 && c < MCOLS - 1) m[0][c]         = ft; }
}

// ─── Map tile (de)serialization ───────────────────────────────────────────────
// Base64-pack a map's tiles for compact save-slot storage.
function encodeMap(mapArr) {
  const buf = new Uint8Array(MROWS * MCOLS);
  for (let r = 0; r < MROWS; r++) buf.set(mapArr[r], r * MCOLS);
  const chars = new Array(buf.length);
  for (let i = 0; i < buf.length; i++) chars[i] = String.fromCharCode(buf[i]);
  return btoa(chars.join(''));
}

function decodeMap(b64) {
  const bin = atob(b64);
  const mapArr = [];
  for (let r = 0; r < MROWS; r++) {
    const row = new Uint8Array(MCOLS);
    for (let c = 0; c < MCOLS; c++) row[c] = bin.charCodeAt(r * MCOLS + c);
    mapArr.push(row);
  }
  return mapArr;
}
