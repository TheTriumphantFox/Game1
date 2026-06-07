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

function rnd(a, b) {
  return a + Math.floor(Math.random() * (b - a + 1));
}

// True if `t` is any tile belonging to a chest (single, large 1×2, or boss
// 2×2). Chests are solid objects — the player opens them by bumping, not by
// standing on them — so this is shared by isSolid and the bump-to-open logic.
function isChestTile(t) {
  return t === T.CHEST || t === T.LARGE_CHEST || t === T.LARGE_CHEST_R ||
         t === T.BOSS_CHEST_TL || t === T.BOSS_CHEST_TR ||
         t === T.BOSS_CHEST_BL || t === T.BOSS_CHEST_BR;
}

// Returns true if the tile at (c, r) blocks movement.
// Used both by movement code and the connectivity flood-fill.
function isSolid(map, c, r) {
  if (c < 0 || r < 0 || c >= MCOLS || r >= MROWS) return true;
  const t = map[r][c];
  return t === T.TREE || t === T.WATER || t === T.WALL || t === T.ROCK ||
         t === T.DEEP_WATER || t === T.LAVA || t === T.PILLAR || t === T.STATUE ||
         t === T.FOUNTAIN_WATER || t === T.FOUNTAIN_SPOUT ||
         t === T.CACTUS || t === T.OASIS_WATER ||
         t === T.WATERFALL || t === T.CLIFF ||
         // Elemental region borders (solid)
         t === T.GLACIER || t === T.MOUNTAIN || t === T.CLOUDWALL ||
         t === T.STORM_CLOUD || t === T.LUMINOUS_CRYSTAL ||
         t === T.BLIGHTED_WALL || t === T.POISON_WALL || t === T.MANA_CRYSTAL ||
         isChestTile(t);
}

// Drunk-walk path carving. Biases toward the target but takes random detours,
// producing organic winding corridors.
function drunkWalk(m, sr, sc, er, ec, t, width) {
  let r = sr, c = sc;
  const maxSteps = (MROWS + MCOLS) * 4;
  for (let i = 0; i < maxSteps && (Math.abs(r - er) + Math.abs(c - ec)) > 3; i++) {
    const dr = er - r, dc = ec - c;
    let mr = 0, mc = 0;
    if (Math.random() < 0.65) {  // bias toward target
      if (Math.abs(dr) > Math.abs(dc)) mr = Math.sign(dr);
      else mc = Math.sign(dc);
    } else {
      if (Math.random() < 0.5) mr = (Math.random() < 0.5 ? 1 : -1);
      else mc = (Math.random() < 0.5 ? 1 : -1);
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

// Scatter decorative tiles only on plain grass — never overwrites chests etc.
function scatter(m, tile, count) {
  for (let i = 0; i < count; i++) {
    const r = rnd(2, MROWS - 3), c = rnd(2, MCOLS - 3);
    if (m[r][c] === T.GRASS) m[r][c] = tile;
  }
}

// True for placed structures that terrain features (streams, waterfalls, cliffs)
// must never paint over — chests, shrines, dungeon bits, doors, and portals.
function isProtectedFeature(t) {
  return isChestTile(t) || t === T.SHRINE || t === T.DUNGEON_DOOR ||
         t === T.FLOOR || t === T.PILLAR || t === T.TORCH ||
         t === T.DOOR || t === T.PORTAL;
}

// Carve a winding water channel (T.WATER) from (sr,sc) toward (er,ec). Paints a
// band `width` tiles to each side of a meandering centre line — width 1 → a
// 3-tile-wide stream, width 0 → a single-tile trickle. Skips protected
// structures. Returns the centre-line cells so callers can drop bridges or
// splash pools along the course.
function carveStream(m, sr, sc, er, ec, width) {
  width = width === undefined ? 1 : width;
  const cells = [];
  let r = sr, c = sc;
  const maxSteps = (MROWS + MCOLS) * 4;
  for (let i = 0; i < maxSteps && (Math.abs(r - er) + Math.abs(c - ec)) > 2; i++) {
    const dr = er - r, dc = ec - c;
    let mr = 0, mc = 0;
    if (Math.random() < 0.7) {                 // bias toward the mouth
      if (Math.abs(dr) > Math.abs(dc)) mr = Math.sign(dr);
      else                             mc = Math.sign(dc);
    } else {                                    // meander for an organic course
      if (Math.random() < 0.5) mr = (Math.random() < 0.5 ? 1 : -1);
      else                     mc = (Math.random() < 0.5 ? 1 : -1);
    }
    r = Math.max(1, Math.min(MROWS - 2, r + mr));
    c = Math.max(1, Math.min(MCOLS - 2, c + mc));
    cells.push([r, c]);
    for (let dr2 = -width; dr2 <= width; dr2++)
      for (let dc2 = -width; dc2 <= width; dc2++) {
        const nr = r + dr2, nc = c + dc2;
        if (nr > 0 && nr < MROWS - 1 && nc > 0 && nc < MCOLS - 1 &&
            !isProtectedFeature(m[nr][nc])) m[nr][nc] = T.WATER;
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
