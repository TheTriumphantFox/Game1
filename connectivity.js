// ─── Map connectivity enforcement ─────────────────────────────────────────────
// Generation has two different accessibility contracts:
//   * without armor, the open border exits must share one ordinary walking route;
//   * with the traversal powers supplied by armor, every generated feature and
//     every remaining walkable area must be reachable.
//
// The second check is a planning model, not a new equip state. Its five states
// represent no armor, Water, Earth, Air, and Shadow. The graph may change armor
// on ordinary ground, but refuses a change while standing on the Water-only or
// Earth-only tile that the current armor makes possible. That mirrors
// setActiveArmorElement() and lets a route combine powers without pretending
// that two armors can be active at once.

const MAP_CONNECTIVITY_DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const MAP_CONNECTIVITY_DIRS8 = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1]
];
// Shadow is absent because Shadow Step is: the armor grants the Umbral Veil now
// (elements.js), which changes what enemies notice and nothing about what tiles
// the hero can reach.
const MAP_CONNECTIVITY_ARMOR_STATES = ['none', 'water', 'earth', 'air'];

function connectivityCellIndex(c, r) { return r * MCOLS + c; }

function connectivityInBounds(c, r) {
  return c >= 0 && r >= 0 && c < MCOLS && r < MROWS;
}

// A chest is a target the player stands beside, never a tile the player stands
// on. The same distinction is used by isSolid() and the runtime interaction.
function connectivityCanStand(m, c, r, armorState) {
  if (!connectivityInBounds(c, r)) return false;
  const t = m[r][c];
  if (isChestTile(t)) return false;
  if (!SOLID_TILES.has(t)) return true;
  if (armorState === 'water' && t === T.MEDIUM_WATER) return true;
  if (armorState === 'earth' && t === T.LEDGE_FACE) return true;
  return false;
}

// The movement height rule belongs to map-helpers.js. Keep the generation graph
// independent of live enemies, though: actorSurfaceZ() can see a sleeping golem
// in the current runtime enemy list, while a freshly generated map has no such
// actor. Earth armor is the all-armor state that can climb every shelf.
function connectivityStepAllowed(m, c1, r1, c2, r2, armorState) {
  if (!connectivityCanStand(m, c2, r2, armorState)) return false;
  const target = m[r2][c2];
  if (armorState === 'water' && target === T.MEDIUM_WATER) return true;
  if (armorState === 'earth') return true;
  if (isRampStep(m, c1, r1, c2, r2)) return true;
  return surfaceZ(m, c2, r2) - surfaceZ(m, c1, r1) <= STEP_UP_MAX;
}

function connectivityIsGlideGap(t) {
  // abilities.js is later in the script graph, so use its runtime helper when it
  // exists and retain the tile list as a safe generation-time fallback.
  if (typeof isGlideGap === 'function') return isGlideGap(t);
  return t === T.WATER || t === T.DEEP_WATER || t === T.MEDIUM_WATER ||
         t === T.LAVA || t === T.SHADOW_RIFT || t === T.BOG_POOL ||
         t === T.OASIS_WATER || t === T.FOUNTAIN_WATER;
}

function connectivityAbilitySolid(m, c, r) {
  if (!connectivityInBounds(c, r)) return true;
  return SOLID_TILES.has(m[r][c]) || isChestTile(m[r][c]);
}

// These are the things a player can deliberately reach or trigger on an
// overworld/village map. Ordinary decorative walls and deep water remain
// obstacles by design; they are not destinations that need a standing tile.
function connectivityIsFeatureTile(t) {
  return isChestTile(t) ||
    t === T.SHRINE || t === T.SEALED_SHRINE || t === T.DUNGEON_DOOR ||
    t === T.DOOR || t === T.INN_DOOR || t === T.STORE_DOOR ||
    t === T.HERB_DOOR || t === T.SMITH_DOOR || t === T.SHRINE_DOOR ||
    t === T.WATERFALL_DOOR || t === T.CAVE_ENTRANCE || t === T.CAVE_EXIT ||
    t === T.CAVE_DESCENT || t === T.CHEST_EXIT || t === T.SKY_ASCENT ||
    t === T.SKY_EXIT || t === T.TOWER_STAIRS_UP || t === T.TOWER_STAIRS_DOWN ||
    t === T.WIND_GUST || t === T.WHIRLPOOL || t === T.PORTAL ||
    t === T.FIREPLACE || t === T.GRAN_BOW || t === T.GAS_VENT ||
    t === T.RUNE_MARK || t === T.FLOOR;
}

// Return the tiles from which a feature can actually be used. Chests need a
// cardinal neighbour because tryChestInteraction() does; a whirlpool pulls from
// any adjacent king-move tile. Other features are entered directly.
function connectivityFeatureGoals(m, c, r) {
  if (!connectivityInBounds(c, r)) return [];
  const t = m[r][c];
  const dirs = isChestTile(t) || t === T.WHIRLPOOL
    ? (isChestTile(t) ? MAP_CONNECTIVITY_DIRS4 : MAP_CONNECTIVITY_DIRS8)
    : null;
  if (!dirs) return [[c, r]];
  return dirs
    .map(([dc, dr]) => [c + dc, r + dr])
    .filter(([gc, gr]) => connectivityInBounds(gc, gr));
}

function connectivityFeatureReachable(m, reachable, c, r) {
  return connectivityFeatureGoals(m, c, r)
    .some(([gc, gr]) => reachable[connectivityCellIndex(gc, gr)]);
}

// Open exits are identified from their actual border tile, not from an
// openSides argument that the generator may no longer have. The first one is
// the deterministic root; the others become explicit connectivity targets.
function connectivityOpenExitSeeds(m) {
  return [
    [0, EXIT_ROW], [MCOLS - 1, EXIT_ROW],
    [EXIT_COL, 0], [EXIT_COL, MROWS - 1]
  ].filter(([c, r]) => connectivityCanStand(m, c, r, 'none'));
}

function connectivityPrimaryStart(m) {
  const exits = connectivityOpenExitSeeds(m);
  if (exits.length) return [exits[0]];
  for (let r = 1; r < MROWS - 1; r++) {
    for (let c = 1; c < MCOLS - 1; c++) {
      if (connectivityCanStand(m, c, r, 'none')) return [[c, r]];
    }
  }
  return [];
}

// Ordinary, armor-free reachability. Eight directions match the keyboard
// movement rule, which accepts a diagonal destination when that destination is
// legal and otherwise slides to a legal axis step.
function connectivityReachableWithoutArmor(m, starts) {
  const reachable = new Uint8Array(MCOLS * MROWS);
  const queue = [];
  for (const [c, r] of (starts || [])) {
    if (!connectivityCanStand(m, c, r, 'none')) continue;
    const at = connectivityCellIndex(c, r);
    if (reachable[at]) continue;
    reachable[at] = 1;
    queue.push([c, r]);
  }
  for (let head = 0; head < queue.length; head++) {
    const [c, r] = queue[head];
    for (const [dc, dr] of MAP_CONNECTIVITY_DIRS8) {
      const nc = c + dc, nr = r + dr;
      const ni = connectivityCellIndex(nc, nr);
      if (!connectivityInBounds(nc, nr) || reachable[ni]) continue;
      if (!connectivityStepAllowed(m, c, r, nc, nr, 'none')) continue;
      reachable[ni] = 1;
      queue.push([nc, nr]);
    }
  }
  return reachable;
}

// Reachability with a combinable armor inventory. Ordinary tiles collapse to
// one cell with every traversal state available: once the hero is standing on
// ordinary ground, they can change armor there. Medium water keeps only the
// Water bit and a ledge face keeps only the Earth bit, so the graph cannot walk
// into water as Water armor and immediately phase through a cliff face as Earth
// armor without first finding ordinary ground. This is the same safety rule as
// armorChangeBlockedHere(), expressed without depending on the live player.
function connectivityReachableWithArmor(m, starts) {
  const W = MCOLS, H = MROWS, N = W * H;
  const NONE = 1 << MAP_CONNECTIVITY_ARMOR_STATES.indexOf('none');
  const WATER = 1 << MAP_CONNECTIVITY_ARMOR_STATES.indexOf('water');
  const EARTH = 1 << MAP_CONNECTIVITY_ARMOR_STATES.indexOf('earth');
  const AIR = 1 << MAP_CONNECTIVITY_ARMOR_STATES.indexOf('air');
  const ALL = NONE | WATER | EARTH | AIR;
  const masks = new Uint8Array(N);
  const reachable = new Uint8Array(N);
  const queue = [];

  // Ordinary ground grants every state because armor changes are legal there.
  // The two special standing tiles grant only the armor that makes them legal.
  const standingMask = (c, r) => {
    if (!connectivityInBounds(c, r) || isChestTile(m[r][c])) return 0;
    const t = m[r][c];
    if (!SOLID_TILES.has(t)) return ALL;
    if (t === T.MEDIUM_WATER) return WATER;
    if (t === T.LEDGE_FACE) return EARTH;
    return 0;
  };
  const enqueue = (c, r, incoming) => {
    const allowed = standingMask(c, r);
    const arrived = incoming & allowed;
    if (!arrived) return;
    const cell = connectivityCellIndex(c, r);
    const next = allowed === ALL ? ALL : arrived;
    const added = next & ~masks[cell];
    if (!added) return;
    masks[cell] |= next;
    reachable[cell] = 1;
    queue.push(cell);
  };

  for (const [c, r] of (starts || [])) enqueue(c, r, ALL);

  // The Air glide's range is a level curve now (2 tiles at armor level 1, 12 at
  // level 6). This models the LEVEL-6 range, and that is the right end of the
  // curve for what this flood is asked: it answers "can a fully equipped hero
  // ever reach this", not "can a hero reach it right now". Nothing the player
  // MUST reach depends on it — ensureConnectivity carves required routes against
  // the armor-free flood — so the only thing keyed off this graph is optional
  // content, and optional content behind an upgradeable armor is reachable.
  //
  // Modelling the level-1 range instead reports every glide islet the secret
  // pass places as unreachable: those are laid within GLIDE_RANGE (3-4 tiles,
  // abilities.js), which is level 2 and up.
  const airRange = (typeof GLIDE_ARMOR_RANGE_MAX === 'number') ? GLIDE_ARMOR_RANGE_MAX : 12;

  for (let head = 0; head < queue.length; head++) {
    const cell = queue[head];
    const r = Math.floor(cell / W), c = cell % W;
    const mask = masks[cell];
    const source = m[r][c];

    // Ordinary movement. Earth can enter any non-solid ordinary target, while
    // Water and Earth are the only states that can enter their special tiles.
    for (const [dc, dr] of MAP_CONNECTIVITY_DIRS8) {
      const nc = c + dc, nr = r + dr;
      if (!connectivityInBounds(nc, nr)) continue;
      const targetMask = standingMask(nc, nr);
      if (targetMask === ALL) {
        const canMove = source === T.MEDIUM_WATER
          ? !!(mask & WATER) && connectivityStepAllowed(m, c, r, nc, nr, 'water')
          : !!(mask & EARTH) && connectivityStepAllowed(m, c, r, nc, nr, 'earth');
        if (canMove) enqueue(nc, nr, ALL);
      } else if (targetMask === WATER) {
        if ((mask & WATER) && connectivityStepAllowed(m, c, r, nc, nr, 'water'))
          enqueue(nc, nr, WATER);
      } else if (targetMask === EARTH) {
        if ((mask & EARTH) && connectivityStepAllowed(m, c, r, nc, nr, 'earth'))
          enqueue(nc, nr, EARTH);
      }
    }

    // Air's glide is an active ability, and therefore only originates from
    // ordinary ground where its armor can be equipped safely.
    if (source !== T.MEDIUM_WATER && source !== T.LEDGE_FACE && (mask & AIR)) {
      for (const [dc, dr] of MAP_CONNECTIVITY_DIRS4) {
        let sawGap = false;
        for (let distance = 1; distance <= airRange; distance++) {
          const nc = c + dc * distance, nr = r + dr * distance;
          if (!connectivityInBounds(nc, nr)) break;
          const t = m[nr][nc];
          if (connectivityIsGlideGap(t)) { sawGap = true; continue; }
          if (!sawGap) break;
          if (standingMask(nc, nr) !== ALL) break;
          enqueue(nc, nr, AIR);
          break;
        }
      }
    }
  }
  return reachable;
}

// Find the shortest deterministic rescue route, preferring existing ordinary
// ground over newly carved tiles. A 0/1 Dijkstra keeps the route bounded by the
// map, unlike the old radius-30 spiral, while still producing small corridors.
function connectivityRepairPath(m, goals, reachable) {
  const W = MCOLS, H = MROWS, N = W * H;
  const goalSet = new Set();
  for (const [c, r] of goals || []) {
    if (connectivityInBounds(c, r)) goalSet.add(connectivityCellIndex(c, r));
  }
  if (!goalSet.size) return null;

  const dist = new Int32Array(N).fill(-1);
  const prev = new Int32Array(N).fill(-1);
  const heap = [];
  const less = (a, b) => a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);
  const push = item => {
    heap.push(item);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!less(heap[i], heap[p])) break;
      [heap[i], heap[p]] = [heap[p], heap[i]];
      i = p;
    }
  };
  const pop = () => {
    if (!heap.length) return null;
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      while (true) {
        const left = i * 2 + 1, right = left + 1;
        let best = i;
        if (left < heap.length && less(heap[left], heap[best])) best = left;
        if (right < heap.length && less(heap[right], heap[best])) best = right;
        if (best === i) break;
        [heap[i], heap[best]] = [heap[best], heap[i]];
        i = best;
      }
    }
    return top;
  };

  for (const goal of goalSet) {
    dist[goal] = 0;
    push([0, goal]);
  }

  let found = -1;
  while (heap.length) {
    const [cost, cell] = pop();
    if (cost !== dist[cell]) continue;
    if (reachable[cell]) { found = cell; break; }
    const r = Math.floor(cell / W), c = cell % W;
    for (const [dc, dr] of MAP_CONNECTIVITY_DIRS4) {
      const nc = c + dc, nr = r + dr;
      if (!connectivityInBounds(nc, nr)) continue;
      const ni = connectivityCellIndex(nc, nr);
      if (reachable[ni]) {
        if (dist[ni] < 0 || cost < dist[ni]) {
          dist[ni] = cost;
          prev[ni] = cell;
          push([cost, ni]);
        }
        continue;
      }
      // The border is a wall except for the explicit goal and already-reachable
      // exit tiles. Never carve a new map edge while rescuing an interior target.
      if ((nc === 0 || nr === 0 || nc === W - 1 || nr === H - 1) && !goalSet.has(ni)) continue;
      const t = m[nr][nc];
      // Pillars, torches, chests, and other protected structures are not fair
      // corridor material. The search goes around them instead.
      if (isChestTile(t) ||
          (typeof isProtectedFeature === 'function' && isProtectedFeature(t) && SOLID_TILES.has(t)) ||
          t === T.WHIRLPOOL) continue;
      const stepCost = connectivityCanStand(m, nc, nr, 'none') ? 0 : 1;
      const nextCost = cost + stepCost;
      if (dist[ni] < 0 || nextCost < dist[ni]) {
        dist[ni] = nextCost;
        prev[ni] = cell;
        push([nextCost, ni]);
      }
    }
  }
  if (found < 0) return null;

  const path = [];
  for (let cell = found; cell >= 0; cell = prev[cell])
    path.push([cell % W, Math.floor(cell / W)]);
  return path;
}

function connectivityApplyRepairPath(m, path, carve, keep) {
  for (const [c, r] of path || []) {
    const cell = connectivityCellIndex(c, r);
    if (keep && keep.has(cell)) continue;
    const t = m[r][c];
    if (isChestTile(t) || connectivityIsFeatureTile(t)) continue;
    if (typeof isProtectedFeature === 'function' && isProtectedFeature(t)) continue;
    m[r][c] = carve;
  }
}

function connectivityRepairTarget(m, goals, reachable, carve, keep) {
  const path = connectivityRepairPath(m, goals, reachable);
  if (!path) return false;
  connectivityApplyRepairPath(m, path, carve, keep);
  return true;
}

function connectivityFeatureKeepSet(m, c, r) {
  const keep = new Set();
  const t = m[r][c];
  if (!isChestTile(t) && t !== T.WHIRLPOOL) keep.add(connectivityCellIndex(c, r));
  return keep;
}

function connectivityFeatureTargets(m) {
  const targets = [];
  for (let r = 1; r < MROWS - 1; r++) {
    for (let c = 1; c < MCOLS - 1; c++) {
      if (connectivityIsFeatureTile(m[r][c])) targets.push([c, r]);
    }
  }
  return targets;
}

// Medium water and ledge faces are the two solid terrain types that a current
// armor can actually stand on. Keep every instance connected under that armor
// model too; deep water, lava, rifts, and ordinary walls remain intentional
// non-standing scenery.
function connectivityArmorTerrainTargets(m) {
  const targets = [];
  for (let r = 1; r < MROWS - 1; r++) {
    for (let c = 1; c < MCOLS - 1; c++) {
      const t = m[r][c];
      if (t === T.MEDIUM_WATER || t === T.LEDGE_FACE) targets.push([c, r]);
    }
  }
  return targets;
}

function ensureConnectivity(m, preserveFloor, sealTile, carveTile) {
  const W = MCOLS, H = MROWS;
  const seal = sealTile === undefined ? T.TREE : sealTile;
  const carve = carveTile === undefined ? T.PATH : carveTile;
  const starts = connectivityPrimaryStart(m);
  if (!starts.length) return;

  // First prove one armor-free component and explicitly join every open exit to
  // it. This is intentionally separate from the optional-content pass below.
  let reachable = connectivityReachableWithoutArmor(m, starts);
  const exits = connectivityOpenExitSeeds(m);
  for (let i = 1; i < exits.length; i++) {
    const [c, r] = exits[i];
    if (reachable[connectivityCellIndex(c, r)]) continue;
    const keep = new Set([connectivityCellIndex(c, r)]);
    if (connectivityRepairTarget(m, [[c, r]], reachable, carve, keep))
      reachable = connectivityReachableWithoutArmor(m, starts);
  }

  const features = connectivityFeatureTargets(m);

  // Village interiors are ordinary required content: retain their old
  // armor-free guarantee for floors, doors, shrines, and chests. Overworld
  // features deliberately skip this pass and may be reached only with armor.
  if (preserveFloor) {
    for (const [c, r] of features) {
      if (connectivityFeatureReachable(m, reachable, c, r)) continue;
      if (connectivityRepairTarget(m, connectivityFeatureGoals(m, c, r), reachable,
                                   carve, connectivityFeatureKeepSet(m, c, r)))
        reachable = connectivityReachableWithoutArmor(m, starts);
    }
  }

  // Now retain or repair armor-traversable terrain under the combinable armor
  // model. Keep the target tile itself, but allow a deterministic ordinary
  // corridor when a malformed water shelf or ledge face is completely isolated.
  let armored = connectivityReachableWithArmor(m, starts);
  for (const [c, r] of connectivityArmorTerrainTargets(m)) {
    const cell = connectivityCellIndex(c, r);
    if (armored[cell]) continue;
    if (connectivityRepairTarget(m, [[c, r]], armored, carve, new Set([cell])))
      armored = connectivityReachableWithArmor(m, starts);
  }

  // Retain or repair optional content under the same armor model. A fallback
  // corridor is still ordinary ground: if a malformed seed cannot be reached by
  // a real armor power, generation repairs it rather than shipping a visible
  // feature that no loadout can use.
  for (const [c, r] of features) {
    if (connectivityFeatureReachable(m, armored, c, r)) continue;
    if (connectivityRepairTarget(m, connectivityFeatureGoals(m, c, r), armored,
                                 carve, connectivityFeatureKeepSet(m, c, r)))
      armored = connectivityReachableWithArmor(m, starts);
  }

  // Seal only ordinary tiles that no armor route can reach. Armor-reachable
  // pockets, including Water shelves and Earth ledges, remain as optional
  // terrain instead of being paved over by the visual border.
  for (let r = 1; r < H - 1; r++) {
    for (let c = 1; c < W - 1; c++) {
      const cell = connectivityCellIndex(c, r);
      if (armored[cell]) continue;
      if (!connectivityCanStand(m, c, r, 'none')) continue;
      if (connectivityIsFeatureTile(m[r][c])) continue;
      m[r][c] = seal;
    }
  }
}
