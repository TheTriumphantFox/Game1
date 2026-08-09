// ─── Prologue: the home village ───────────────────────────────────────────────
// Map 0. Where the game opens, where it burns, and — because the ruin is never
// rebuilt — where the player comes home to for the rest of the game.
//
// This replaces the old lone starter cabin (buildStarterHouseMap, still in
// mapgen-village.js and still referenced by save.js for maps written before this
// change). Like that cabin and like buildVillageMap, every tile here is placed by
// hand: no procedural generation, no seed, nothing random. A scripted scene needs
// to know exactly where the hearth is.
//
// Houses in this game have walkable interiors on the same map — T.DOOR is not in
// SOLID_TILES, so the player just walks through it (see the house() helper in
// mapgen-village.js). That's why the family home needs no separate interior map,
// and why Beats 1, 2, 4 and 5 all play out on this one map.
//
// Exits: SOUTH only, exactly like the cabin it replaces. Walking out the bottom
// still creates forest [1] as the southern neighbour, so world topology is
// unchanged — see initWorld / getOrCreateNeighbor in world.js.
//
// Script: .claude/skills/hyrule-quest/references/prologue-script.md

// The village's name. The script never names it; change it here and nowhere else.
// (Note this is unrelated to REGIONS[0].villageName, 'Village of the Lost' —
// that's the forest region's *boss* village, generated much later.)
const HOME_VILLAGE_NAME = 'Elderbrook';

// ─── The market row ───────────────────────────────────────────────────────────
// Elderbrook trades at the world's LAST region's rates. Its four shops are
// stocked and priced exactly like the final village's — the same ore, the same
// element, the same forge tolls — because a market this small is only worth
// walking into if it sells what the endgame sells. storeRegion (shop-general.js)
// routes all four shops through this, which is the single point every price,
// recipe and stock list in the game already hangs off.
//
// This applies to the village standing. The fire takes the market row with
// everything else (hvCharTile turns each shop door to rubble, and hvCloseShops
// drops the bookkeeping), so the ruin the player comes home to for the rest of
// the game has no shops in it.
function homeVillageShopRegionIdx() {
  return (typeof REGIONS !== 'undefined') ? REGIONS.length - 1 : 0;
}

// The shop bookkeeping a standing Elderbrook carries on its map object: the four
// door positions a keeper stands behind, plus the `activated` flag every other
// village raises when its shops open (see activateVillage in mapgen-village.js).
// Same field names and same {r, c} door shape, so villagers.js and save.js read
// this village exactly as they read any other.
function homeVillageShopFields() {
  const at = t => ({ r: HOME.shops[t].door.y, c: HOME.shops[t].door.x });
  return {
    activated: true,
    innDoor:   at('inn'),
    storeDoor: at('store'),
    herbDoor:  at('herb'),
    smithDoor: at('smith'),
  };
}

// Shut the market row for good. Called when the fire takes the village: without
// it, `activated` and the door coordinates would survive on the map object and
// spawnVillagersForMap would stand four merchants back up in the ash.
function hvCloseShops(mapObj) {
  if (!mapObj) return;
  mapObj.activated = false;
  mapObj.innDoor = mapObj.storeDoor = mapObj.herbDoor = mapObj.smithDoor = undefined;
}

// ─── Landmark coordinates ─────────────────────────────────────────────────────
// Every position the prologue script needs, named once. prologue.js reads these
// rather than carrying magic numbers, so moving a building moves the scene with
// it. All are [col, row] in the standard 150×150 grid.
const HOME = {
  // ── The family home (a house, walls included, in the village's north-east) ──
  house: { r1: 48, c1: 66, w: 20, h: 14 },   // walls span rows 48–62, cols 66–86
  door:      { x: 76, y: 62 },   // south-facing door in the house's south wall
  hearth:    { x: 82, y: 50 },   // FIREPLACE — Mother stands beside it
  window:    { x: 72, y: 48 },   // CASTLE_WINDOW set into the north wall
  // Where each family member stands in Beat 1.
  motherAt:      { x: 81, y: 51 },
  fatherAt:      { x: 76, y: 60 },   // "near the door"
  grandmotherAt: { x: 72, y: 50 },   // "seated by the window"
  // Where the player spawns — mid-room, facing south toward the door.
  spawn:     { x: 76, y: 55 },
  // Where the grandmother lies in Beat 5, pinned near the hearth, and the tile
  // her bow ends up on ("just out of her reach").
  dyingAt:   { x: 80, y: 52 },
  bowAt:     { x: 78, y: 52 },
  // Where Mother and Father are found after the strike. They start Beat 1 inside
  // the house, but they cannot still be standing in it when the player gets home:
  // Beat 5's narration is "No sign of your mother or your father", and the room
  // belongs to Grandmother's scene. So the fire puts them out on the road, coming
  // the other way — they went looking for the player. Both marks sit inside the
  // band hvClearRouteHome keeps walkable (cols 74–76), so neither can end up
  // stranded behind rubble.
  motherFellAt: { x: 76, y: 71 },
  fatherFellAt: { x: 74, y: 66 },

  // ── The village ──
  center:    { x: 75, y: 78 },   // cobbled square, where the Emperor descends
  market:    { x: 66, y: 88 },   // the stall itself — a counter of TABLE tiles
  merchantAt:{ x: 66, y: 87 },   // Wren, standing behind her counter
  gate:      { x: 55, y: 78 },   // the Hendricks' gate on the west road
  // Idle spots for the flavour villagers introduced in Beat 2. Named because
  // Beat 4 needs to know where to have them flee from.
  childAt:   { x: 84, y: 84 },
  friendAt:  { x: 62, y: 70 },
  elderAt:   { x: 88, y: 72 },
  // Where the "do you feel that?" villager is standing when the sky changes.
  watcherAt: { x: 79, y: 82 },

  // ── The market row ──
  // One house per trade, ringing the square. Same hvHouse shape as the
  // neighbours' homes — only the door tile differs. `door` is where hvHouse puts
  // it, (r1 + h, c1 + ⌊w/2⌋), named here so the map object and the keepers can
  // read the position without re-deriving it.
  //
  // Every rect is clear of what gets laid after the buildings: the north–south
  // spine (cols 75–76), the west road (rows 78–79), the market spur and pad, the
  // plaza, and the Hendricks' fence line (col 55, rows 73–84). Each door also has
  // walkable ground directly south of it, which is the side a door opens onto.
  //
  // They are also clear of every mark the cast stands on above — the inn sits at
  // col 90 rather than 88 precisely because Old Hendricks' mark is (88, 72), and
  // a building laid over a villager leaves them standing inside its wall.
  shops: {
    inn:   { r1: 64,  c1: 90, w: 14, h: 10, door: { x: 97, y: 74  } },   // NE of the square
    store: { r1: 62,  c1: 44, w: 14, h: 10, door: { x: 51, y: 72  } },   // west, above the gate
    herb:  { r1: 84,  c1: 88, w: 14, h: 10, door: { x: 95, y: 94  } },   // SE of the square
    smith: { r1: 104, c1: 44, w: 14, h: 10, door: { x: 51, y: 114 } },   // south-west, off the road
  },
};

// The village clearing — everything outside this is forest border.
const HV_R1 = 40, HV_C1 = 44, HV_R2 = 118, HV_C2 = 108;

// ─── The village, before ──────────────────────────────────────────────────────
function buildHomeVillageMap() {
  const m = makeTile(MROWS, MCOLS, T.TREE);

  // The clearing: grass, with a cobbled square at its heart.
  setRect(m, HV_R1, HV_C1, HV_R2, HV_C2, T.GRASS);
  setRect(m, HOME.center.y - 6, HOME.center.x - 8,
             HOME.center.y + 6, HOME.center.x + 8, T.COBBLESTONE);

  // Roads. A north–south spine from the family home down to the south gate (the
  // route the player runs in Beat 4), and a west road out to the Hendricks' gate
  // (the one Father tells them to take). Both are laid before the buildings so
  // nothing ends up straddling a road.
  setCol(m, HOME.center.x,     HOME.door.y,      MROWS - 1,      T.PATH);
  setCol(m, HOME.center.x + 1, HOME.door.y,      MROWS - 1,      T.PATH);
  setRow(m, HOME.center.y,     HV_C1 + 2,        HOME.center.x,  T.PATH);
  setRow(m, HOME.center.y + 1, HV_C1 + 2,        HOME.center.x,  T.PATH);
  // A short spur down to the market stall so the errand has somewhere to go.
  setCol(m, HOME.market.x, HOME.center.y, HOME.market.y, T.PATH);
  setRow(m, HOME.market.y, HOME.market.x, HOME.center.x, T.PATH);

  // ── Neighbours' houses ──
  // Small hamlet, not the eighteen-house boss village: enough homes that losing
  // them means something, few enough that the player can take it in at once.
  // Shape and furnishing follow the house() helper in mapgen-village.js.
  const neighbours = [
    { r1: 50, c1: 46, w: 14, h: 10 },   // west of the family home
    { r1: 92, c1: 48, w: 14, h: 10 },   // south-west
    { r1: 96, c1: 84, w: 14, h: 10 },   // south-east
    { r1: 52, c1: 92, w: 14, h: 10 },   // east
  ];
  for (const h of neighbours) hvHouse(m, h.r1, h.c1, h.w, h.h);

  // ── The market row ──
  // Built exactly like the homes, then the door tile is swapped for the trade's
  // own. That door tile is the whole of a shop as far as the rest of the game is
  // concerned: placeShopkeepers (villagers.js) stands a keeper behind a counter
  // just inside it, and stepping up to them opens the modal.
  const SHOP_DOOR_TILE = {
    inn: T.INN_DOOR, store: T.STORE_DOOR, herb: T.HERB_DOOR, smith: T.SMITH_DOOR,
  };
  for (const trade in HOME.shops) {
    const s = HOME.shops[trade];
    hvHouse(m, s.r1, s.c1, s.w, s.h);
    m[s.door.y][s.door.x] = SHOP_DOOR_TILE[trade];
  }

  // ── The family home ──
  // Built last of the buildings so nothing overwrites it, and furnished by hand
  // rather than by hvHouse: the hearth, the window and the standing room matter
  // to the staging in a way a generic interior doesn't.
  const H = HOME.house;
  const hr2 = H.r1 + H.h, hc2 = H.c1 + H.w;
  setRect(m, H.r1, H.c1, hr2, hc2, T.WALL);
  setRect(m, H.r1 + 1, H.c1 + 1, hr2 - 1, hc2 - 1, T.FLOOR);
  m[HOME.door.y][HOME.door.x] = T.DOOR;
  // The window Grandmother is watching the sky through. CASTLE_WINDOW is a solid
  // wall-swap dressing (see SOLID_TILES) — exactly what a window in a wall is.
  m[HOME.window.y][HOME.window.x] = T.CASTLE_WINDOW;
  m[HOME.hearth.y][HOME.hearth.x] = T.FIREPLACE;
  m[H.r1 + 1][H.c1 + 1]   = T.TORCH;
  m[H.r1 + 1][hc2 - 1]    = T.TORCH;
  // Two beds along the west wall, a table with chairs in the middle.
  m[H.r1 + 2][H.c1 + 2] = T.BED;
  m[H.r1 + 3][H.c1 + 2] = T.BED;
  m[H.r1 + 6][H.c1 + 9] = T.TABLE;
  m[H.r1 + 6][H.c1 + 7] = T.CHAIR;
  m[H.r1 + 6][H.c1 + 11] = T.CHAIR;
  // The household chest, tucked in the south-west corner.
  m[hr2 - 2][H.c1 + 2] = T.CHEST;
  // Fast-travel portal in the south-east corner, opposite the chest — same
  // arrangement the starter cabin had, so home stays a portal destination once
  // the world opens up. A Gatekeeper spawns beside it (ensurePortalKeeper in
  // villagers.js); talk to them to open the destinations menu. It survives the
  // fire: hvCharTile leaves T.PORTAL alone, deliberately.
  m[hr2 - 2][hc2 - 2] = T.PORTAL;

  // ── The market stall ──
  // Open-sided: a cobbled pad with a counter, not a building. The merchant
  // villager standing behind it is what the errand actually points at.
  setRect(m, HOME.market.y - 2, HOME.market.x - 3,
             HOME.market.y + 2, HOME.market.x + 3, T.COBBLESTONE);
  m[HOME.market.y][HOME.market.x - 1] = T.TABLE;
  m[HOME.market.y][HOME.market.x]     = T.TABLE;
  m[HOME.market.y][HOME.market.x + 1] = T.TABLE;

  // ── The Hendricks' gate on the west road ──
  // A fence line across the road with a gap in it. The gap is where the dog is
  // (see prologue.js) — the obstacle is the animal, not the tiles, because this
  // game has no lockable-door system and inventing one for a tutorial beat would
  // be a second door mechanic to maintain forever.
  for (let r = HOME.center.y - 5; r <= HOME.center.y + 6; r++) {
    if (r === HOME.center.y || r === HOME.center.y + 1) continue;   // the road gap
    m[r][HOME.gate.x] = T.PILLAR;
  }

  // A few flowers so the "before" reads as somewhere worth losing. Placed by a
  // coordinate rule rather than scatterOn() because that uses bare Math.random,
  // and SKILL.md is explicit that generation paths shouldn't gain new unseeded
  // randomness — this map is hand-authored, so it may as well be reproducible.
  for (let r = HV_R1 + 3; r < HV_R2 - 2; r += 3) {
    for (let c = HV_C1 + 3; c < HV_C2 - 2; c += 3) {
      if (m[r][c] !== T.GRASS) continue;
      if ((r * 5 + c * 3) % 7 !== 0) continue;
      m[r][c] = T.FLOWER;
    }
  }

  // South-only exit, exactly like the cabin this replaces: re-seal the border,
  // cut the south gate, and stamp the village's own gate post on it.
  for (let r = 0; r < MROWS; r++) { m[r][0] = T.TREE; m[r][MCOLS - 1] = T.TREE; }
  for (let c = 0; c < MCOLS; c++) { m[0][c] = T.TREE; m[MROWS - 1][c] = T.TREE; }
  cutExits(m, false, false, false, true);

  return m;
}

// A neighbour's house: walls, floor, south door, torches and enough furniture to
// read as lived-in. Mirrors house() in mapgen-village.js — same construction, same
// order — so the two sets of buildings match.
function hvHouse(m, r1, c1, w, h) {
  setRect(m, r1, c1, r1 + h, c1 + w, T.WALL);
  setRect(m, r1 + 1, c1 + 1, r1 + h - 1, c1 + w - 1, T.FLOOR);
  m[r1 + h][c1 + Math.floor(w / 2)] = T.DOOR;
  m[r1 + 1][c1 + 1] = T.TORCH;
  m[r1 + 1][c1 + w - 1] = T.TORCH;
  m[r1 + 2][c1 + 2] = T.BED;
  m[r1 + 3][c1 + 2] = T.BED;
  m[r1 + 2][c1 + w - 2] = T.FIREPLACE;
  const tr = r1 + Math.floor(h / 2);
  const tc = c1 + Math.floor(w / 2);
  m[tr][tc] = T.TABLE;
  m[tr][tc - 2] = T.CHAIR;
  m[tr][tc + 2] = T.CHAIR;
}

// ─── The village, burning ─────────────────────────────────────────────────────
// Char the map in place, out to `radius` tiles from the village centre. Beat 4
// calls this repeatedly with a growing radius so the fire visibly spreads rather
// than cutting to a finished ruin — the script's "tiles beginning to char/corrupt
// in real time".
//
// Mutating mapObj.map[r][c] directly is the established idiom here (see
// activateVillage in mapgen-village.js and tryUnsealShrine in world.js). Callers
// must set minimapDirty = true afterwards; the cutscene runner's `tiles` step
// does it for them.
//
// What deliberately does NOT burn: the north–south road home and the family
// home's doorway. The player has to be able to run home through this, and a
// procedurally-placed chunk of rubble across the only route would end the game.
function charHomeVillage(m, radius) {
  const cx = HOME.center.x, cy = HOME.center.y;
  const r2 = radius * radius;
  for (let r = HV_R1 - 4; r <= HV_R2 + 4; r++) {
    if (r < 0 || r >= MROWS) continue;
    for (let c = HV_C1 - 4; c <= HV_C2 + 4; c++) {
      if (c < 0 || c >= MCOLS) continue;
      const dx = c - cx, dy = r - cy;
      if (dx * dx + dy * dy > r2) continue;
      m[r][c] = hvCharTile(m[r][c]);
    }
  }
  // Embers where the buildings were. Deterministic positions (no Math.random in
  // a generation path — see the reproducibility note in SKILL.md), keyed off the
  // tile coordinates so the same wall always catches in the same place.
  for (let r = HV_R1; r <= HV_R2; r++) {
    for (let c = HV_C1; c <= HV_C2; c++) {
      if (m[r][c] !== T.BURNT_WALL) continue;
      const dx = c - cx, dy = r - cy;
      if (dx * dx + dy * dy > r2) continue;
      if ((r * 7 + c * 13) % 11 === 0) m[r][c] = T.EMBER;
    }
  }
  hvClearRouteHome(m);
}

// One tile's before → after. Anything without a burnt counterpart is left alone.
function hvCharTile(t) {
  switch (t) {
    case T.GRASS:
    case T.FLOWER:
    case T.PATH:
    case T.COBBLESTONE:  return T.CHARRED_GRASS;
    case T.FLOOR:        return T.SCORCHED_FLOOR;
    case T.WALL:         return T.BURNT_WALL;
    case T.TREE:         return T.BURNT_WALL;   // the treeline burns to black spars
    case T.BED:
    case T.TABLE:
    case T.CHAIR:
    case T.DOOR:
    // The market row burns like any other door. Elderbrook is never rebuilt, so
    // there is no path back from this — the ruin trades in nothing.
    case T.INN_DOOR:
    case T.STORE_DOOR:
    case T.HERB_DOOR:
    case T.SMITH_DOOR:   return T.RUBBLE;
    // Torches, fireplaces, chests, the window and the pillars of the Hendricks'
    // fence are left as they are: a hearth in a burnt house still reads as a
    // hearth, and turning the chest to rubble would eat the player's belongings.
    default:             return t;
  }
}

// Re-open the way home. Runs after every char pass, because T.DOOR chars to solid
// RUBBLE and the family home's own doorway is on that list.
function hvClearRouteHome(m) {
  for (let r = HOME.door.y; r < MROWS - 1; r++) {
    for (let c = HOME.center.x - 1; c <= HOME.center.x + 1; c++) {
      if (m[r][c] === T.RUBBLE || m[r][c] === T.BURNT_WALL) m[r][c] = T.CHARRED_GRASS;
    }
  }
  // The doorway itself, and the tile inside it.
  m[HOME.door.y][HOME.door.x] = T.CHARRED_GRASS;
  m[HOME.door.y - 1][HOME.door.x] = T.SCORCHED_FLOOR;
}

// The fallen timber that pins the grandmother, laid once the fire has passed.
// Placed around her rather than on her — she's a villager standing on a walkable
// tile, and the rubble is what the player sees holding her down.
function hvPinGrandmother(m) {
  const g = HOME.dyingAt;
  m[g.y - 1][g.x]     = T.RUBBLE;
  m[g.y - 1][g.x - 1] = T.RUBBLE;
  m[g.y][g.x + 1]     = T.RUBBLE;
  // Her bow, lying just out of reach, stays walkable — the player steps onto it.
  m[HOME.bowAt.y][HOME.bowAt.x] = T.SCORCHED_FLOOR;
}

// ─── The village, after ───────────────────────────────────────────────────────
// The finished ruin, built from scratch. Used when a save written after the
// prologue is loaded and map 0 has to be rebuilt from its type rather than from
// stored tiles (see applyLoadData in save.js) — burning a fresh village to the
// same end state guarantees the reload matches what the player left.
function buildRuinedHomeVillage() {
  const m = buildHomeVillageMap();
  charHomeVillage(m, 70);   // comfortably past the far corners of the clearing
  hvPinGrandmother(m);
  return m;
}
