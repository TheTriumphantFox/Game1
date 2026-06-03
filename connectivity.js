// ─── Map connectivity enforcement ─────────────────────────────────────────────
// Runs after map generation. Flood-fills from the 4 exits and ensures every
// passable tile is reachable. Two passes:
//   1. Carve corridors to unreachable "interesting" tiles (chests, shrines).
//   2. Seal remaining unreachable passable tiles as TREE so the player isn't
//      teased by visible but unreachable terrain.

function ensureConnectivity(m, preserveFloor, sealTile) {
  const W = MCOLS, H = MROWS;
  const seal = sealTile === undefined ? T.TREE : sealTile;
  const reachable = new Uint8Array(W * H);
  const stack = [];

  // Can the player walk on this tile? Same logic as isSolid() inverted, with
  // chests/shrines/torches treated as walkable since the player triggers them
  // by stepping onto them.
  const passable = (c, r) => {
    if (c < 0 || r < 0 || c >= W || r >= H) return false;
    const t = m[r][c];
    return !(t === T.TREE || t === T.WATER || t === T.WALL || t === T.ROCK ||
             t === T.DEEP_WATER || t === T.LAVA || t === T.PILLAR || t === T.STATUE ||
             t === T.FOUNTAIN_WATER || t === T.FOUNTAIN_SPOUT ||
             t === T.CACTUS || t === T.OASIS_WATER ||
             // Elemental region borders
             t === T.GLACIER || t === T.MOUNTAIN || t === T.CLOUDWALL ||
             t === T.STORM_CLOUD || t === T.LUMINOUS_CRYSTAL ||
             t === T.BLIGHTED_WALL || t === T.POISON_WALL || t === T.MANA_CRYSTAL);
  };

  // Tiles we must keep reachable even if it means carving a path to them.
  // preserveFloor=true is used for village maps where house interiors (FLOOR)
  // are intentionally walled off but contain doors/chests.
  const isInteresting = (t) =>
    t === T.CHEST || t === T.SHRINE || t === T.TORCH ||
    t === T.DUNGEON_DOOR || t === T.DOOR ||
    t === T.LARGE_CHEST || t === T.LARGE_CHEST_R ||
    t === T.BOSS_CHEST_TL || t === T.BOSS_CHEST_TR ||
    t === T.BOSS_CHEST_BL || t === T.BOSS_CHEST_BR ||
    (preserveFloor && t === T.FLOOR);

  // Seed the flood from each of the four exit tiles
  const seeds = [
    [EXIT_ROW, 0], [EXIT_ROW, W - 1],
    [0, EXIT_COL], [H - 1, EXIT_COL]
  ];
  for (const [sr, sc] of seeds) {
    if (passable(sc, sr)) {
      reachable[sr * W + sc] = 1;
      stack.push([sr, sc]);
    }
  }

  // Flood (DFS via stack — order doesn't matter for connectivity)
  while (stack.length) {
    const [r, c] = stack.pop();
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= H || nc < 0 || nc >= W) continue;
      if (reachable[nr * W + nc]) continue;
      if (!passable(nc, nr)) continue;
      reachable[nr * W + nc] = 1;
      stack.push([nr, nc]);
    }
  }

  // Pass 1 — rescue treasure pockets by carving a corridor to the nearest
  // reachable tile. Bounded search radius keeps it cheap.
  for (let r = 1; r < H - 1; r++) {
    for (let c = 1; c < W - 1; c++) {
      if (reachable[r * W + c]) continue;
      if (!isInteresting(m[r][c])) continue;

      // Spiral outward from (r, c) until we hit a reachable tile
      let found = null;
      for (let radius = 1; radius <= 30 && !found; radius++) {
        for (let dr = -radius; dr <= radius && !found; dr++) {
          for (let dc = -radius; dc <= radius; dc++) {
            if (Math.abs(dr) !== radius && Math.abs(dc) !== radius) continue;
            const tr = r + dr, tc = c + dc;
            if (tr < 1 || tr >= H - 1 || tc < 1 || tc >= W - 1) continue;
            if (reachable[tr * W + tc]) { found = {r: tr, c: tc}; break; }
          }
        }
      }
      if (found) {
        // Carve PATH tiles in a rough L-shape from (r,c) to (found.r, found.c)
        let pr = r, pc = c;
        const safety = Math.abs(r - found.r) + Math.abs(c - found.c) + 4;
        for (let step = 0; step < safety; step++) {
          if (pr === found.r && pc === found.c) break;
          // Don't paint over the interesting tile itself
          if (!isInteresting(m[pr][pc])) m[pr][pc] = T.PATH;
          reachable[pr * W + pc] = 1;
          if (pr !== found.r && (pc === found.c || Math.random() < 0.5)) {
            pr += Math.sign(found.r - pr);
          } else {
            pc += Math.sign(found.c - pc);
          }
        }
      }
    }
  }

  // Pass 2 — seal any remaining unreachable passable area as trees
  for (let r = 1; r < H - 1; r++) {
    for (let c = 1; c < W - 1; c++) {
      if (reachable[r * W + c]) continue;
      if (!passable(c, r)) continue;
      if (isInteresting(m[r][c])) continue;  // can't connect, but at least don't seal
      m[r][c] = seal;
    }
  }
}
