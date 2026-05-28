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

// Returns true if the tile at (c, r) blocks movement.
// Used both by movement code and the connectivity flood-fill.
function isSolid(map, c, r) {
  if (c < 0 || r < 0 || c >= MCOLS || r >= MROWS) return true;
  const t = map[r][c];
  return t === T.TREE || t === T.WATER || t === T.WALL || t === T.ROCK ||
         t === T.DEEP_WATER || t === T.LAVA || t === T.PILLAR || t === T.STATUE ||
         t === T.FOUNTAIN_WATER || t === T.FOUNTAIN_SPOUT ||
         t === T.CACTUS || t === T.OASIS_WATER;
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
