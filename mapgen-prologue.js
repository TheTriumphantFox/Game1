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
// Script: .claude/skills/the-rpg-game/references/prologue-script.md

// The village's name. The script never names it; change it here and nowhere else.
// (Note this is unrelated to REGIONS[0].villageName, 'Village of the Lost' —
// that's the forest region's *boss* village, generated much later.)
const HOME_VILLAGE_NAME = 'Elderbrook';
const HOME_LAYOUT_VERSION = 2;

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
// Take the market row down to what survives the fire. Three of the four trades
// live: the innkeeper, the shopkeeper and the herbalist stay standing where they
// started (no temporary camp), and the blacksmith does not.
//
// Note this does NOT clear `activated`, which an earlier version did. That flag
// is what spawnVillagersForMap reads to stand the keepers back up on re-entry, so
// clearing it emptied the ruin of the very people the script keeps alive. What
// marks the difference now is `shopsRuined`: the trades still open, but the store
// has nothing left to sell and the whole row drops to forest prices (see
// storeRegion in shop-general.js).
function hvRuinShops(mapObj) {
  if (!mapObj) return;
  mapObj.shopsRuined = true;
  mapObj.smithDoor = undefined;   // the blacksmith is dead; nobody to stand there
}

// ─── Landmark coordinates ─────────────────────────────────────────────────────
// Every position the prologue script needs, named once. prologue.js reads these
// rather than carrying magic numbers, so moving a building moves the scene with
// it. All are [col, row] in the standard 150×150 grid.
const HOME = {
  // ── The family home ──
  // A broader 13×10 footprint sets the family home apart from the compact
  // neighbours and gives the opening scene room to breathe. The south wall stays
  // on row 52 so enlarging it does not move the door or the scripted road home.
  house: { r1: 43, c1: 69, w: 12, h: 9 },  // walls span rows 43–52, cols 69–81
  door:      { x: 75, y: 52 },   // south-facing door in the house's south wall
  hearth:    { x: 80, y: 46 },   // FIREPLACE — Mother stands beside it
  window:    { x: 71, y: 43 },   // CASTLE_WINDOW set into the north wall
  // Where each family member stands in Beat 1.
  motherAt:      { x: 79, y: 46 },
  fatherAt:      { x: 73, y: 50 },   // near the door, without blocking it
  grandmotherAt: { x: 71, y: 46 },  // seated beneath the window
  // Where the player spawns — mid-room, facing south toward the door.
  spawn:     { x: 75, y: 48 },
  // The household chest, against the south-west wall inside the house. Named
  // rather than left as an inline offset because it is story furniture now: it
  // holds Grandmother's Sword, it is locked until Beat 5, and handlePickup has to
  // recognise it to keep generic chest loot out of it (see isHomeStoryChest).
  chest:     { x: 70, y: 51 },
  // Where the bow rests in Beat 1 — against the north wall, beside her chair, on
  // the far side from the window she keeps looking out of. Beat 4's fire moves it
  // to `bowAt` (hvPinGrandmother), which is the "just out of her reach" tile.
  bowRestAt: { x: 72, y: 45 },
  // Where the grandmother lies in Beat 5, pinned near the hearth, and the tile
  // her bow ends up on ("just out of her reach").
  dyingAt:   { x: 77, y: 47 },
  bowAt:     { x: 74, y: 47 },
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
  market:    { x: 66, y: 91 },   // the stall itself — a counter of TABLE tiles
  merchantAt:{ x: 66, y: 90 },   // Wren, standing behind her counter
  gate:      { x: 55, y: 78 },   // the Hendricks' gate on the west road
  // The dog. It stands in the northern of the gate's two road tiles, which puts
  // it squarely on the way to the shopkeeper: the errand runs west along the road
  // (past the mill), through this gap, and up to the store door. `dogShooedTo` is
  // where it slinks off to when the player shoos it aside — off the road, north
  // of the fence line, still visible, no longer in the way.
  dogAt:       { x: 55, y: 78 },
  dogShooedTo: { x: 53, y: 75 },
  // The mill Father sends the player past. It sits hard against the west side of
  // the market spur (col 66), so the walk from the house to the shopkeeper runs
  // the length of its east wall and "the shortcut past the mill" is a true
  // description of the route rather than a landmark that isn't there.
  //
  // The footprint is boxed in on every side and the clearances are tight, so if
  // this ever moves, re-check all four: the west road (rows 78-79) above it, the
  // market pad (rows 89-93, cols 63-69) below it, the Hendricks' fence (col 55,
  // rows 73-84) to the west, and the market spur (col 66) to the east.
  mill:      { r1: 81, c1: 56, w: 9, h: 4, door: { x: 60, y: 85 } },
  // Idle spots for the flavour villagers introduced in Beat 2. Named because
  // Beat 4 needs to know where to have them flee from.
  childAt:   { x: 87, y: 85 },
  friendAt:  { x: 62, y: 70 },
  elderAt:   { x: 88, y: 72 },
  // Where the "do you feel that?" villager is standing when the sky changes.
  watcherAt: { x: 87, y: 80 },
  // Rooftops the birds go up off in Beat 3 — one per building, at roughly the
  // centre of each roof. Here rather than in prologue.js for the same reason
  // every other landmark is: move a building and its birds move with it.
  // Family home, the four neighbours, the inn, the store, and the mill.
  roosts: [
    { x: 75, y: 47 }, { x: 49, y: 50 }, { x: 61, y: 50 },
    { x: 89, y: 50 }, { x: 101, y: 50 }, { x: 98, y: 63 },
    { x: 55, y: 63 }, { x: 60, y: 83 },
  ],

  // ── The market row ──
  // One house per trade, ringing the square. Same hvHouse shape as the
  // neighbours' homes — only the door tile differs. `door` is where hvHouse puts
  // it, (r1 + h, c1 + ⌊w/2⌋), named here so the map object and the keepers can
  // read the position without re-deriving it.
  //
  // Every compact footprint clears the north–south spine, west road, Four
  // Springs, market pad, and Hendricks' fence. Each door has walkable ground
  // immediately south of it and every scripted villager mark remains outdoors.
  shops: {
    inn:   { r1: 60, c1: 94, w: 8, h: 6, door: { x: 98, y: 66 } },   // NE of the square
    store: { r1: 60, c1: 51, w: 8, h: 6, door: { x: 55, y: 66 } },   // west, above the gate
    herb:  { r1: 88, c1: 94, w: 8, h: 6, door: { x: 98, y: 94 } },   // SE of the square
    smith: { r1: 88, c1: 48, w: 8, h: 6, door: { x: 52, y: 94 } },   // south-west
  },
};

// Re-anchor people saved on an older Elderbrook layout. The map itself is
// rebuilt on load (save.js); this keeps the cast, surviving merchants, and their
// story state while moving their feet to the redesigned buildings.
function migrateHomeVillageVillagers(saved, ruined) {
  if (!saved || !saved.length) return null;
  const castMarks = {
    mother: ruined ? HOME.motherFellAt : HOME.motherAt,
    father: ruined ? HOME.fatherFellAt : HOME.fatherAt,
    grandmother: ruined ? HOME.dyingAt : HOME.grandmotherAt,
    child: HOME.childAt,
    friend: HOME.friendAt,
    elder: HOME.elderAt,
    watcher: HOME.watcherAt,
  };
  const shopDoors = {
    inn:HOME.shops.inn.door, store:HOME.shops.store.door,
    herb:HOME.shops.herb.door, smith:HOME.shops.smith.door,
  };
  const moved = [];
  for (const original of saved) {
    // The portal moved inside the compact family cottage. Dropping its keeper
    // lets ensurePortalKeeper place a fresh one beside the live portal tile.
    if (original.role === 'portal') continue;
    if (ruined && original.role === 'smith') continue;
    const v = { ...original };
    const door = shopDoors[v.role];
    const mark = door ? { x:door.x, y:door.y - 2 } : castMarks[v.pgTalk];
    if (mark) {
      v.x = mark.x; v.y = mark.y;
      v.renderX = mark.x; v.renderY = mark.y;
    }
    moved.push(v);
  }
  return moved.length ? moved : null;
}

// The village clearing — everything outside this is forest border.
const HV_R1 = 40, HV_C1 = 44, HV_R2 = 118, HV_C2 = 108;

// Elderbrook's ceremonial heart: four spring-fed basins around a broad open
// cross. The empty centre is deliberate — villagers can gather there, roads
// meet there, and the Ashfall scene still has a clear landing and escape route.
function hvGrandSquare(m) {
  const cx = HOME.center.x, cy = HOME.center.y;

  // A clipped-corner stone plaza feels circular without needing a curved tile.
  for (let dr = -10; dr <= 10; dr++) {
    for (let dc = -10; dc <= 10; dc++) {
      if (Math.abs(dr) + Math.abs(dc) > 16) continue;
      m[cy + dr][cx + dc] = (Math.abs(dr) <= 7 && Math.abs(dc) <= 7)
        ? T.MARBLE : T.COBBLESTONE;
    }
  }

  // The Four Springs. Wide axial aisles divide the basins, so the square stays
  // navigable even now that water, pillars, statues, and torches are solid.
  const basins = [
    { r:cy - 8, c:cx - 8 }, { r:cy - 8, c:cx + 4 },
    { r:cy + 4, c:cx - 8 }, { r:cy + 4, c:cx + 4 },
  ];
  for (const b of basins) {
    setRect(m, b.r, b.c, b.r + 4, b.c + 4, T.FOUNTAIN_WATER);
    m[b.r + 2][b.c + 2] = T.FOUNTAIN_SPOUT;
  }

  // Statue-and-column corners give the open square a civic silhouette from a
  // distance while leaving both road axes completely unobstructed.
  // The south-west statue sits one tile farther out so the market spur can run
  // cleanly along the plaza's west edge.
  for (const [dc, dr] of [[-9,-9],[9,-9],[-10,9],[9,9]]) {
    m[cy + dr][cx + dc] = T.STATUE;
  }
  for (const [dc, dr] of [[-6,-10],[6,-10],[-10,-6],[10,-6],
                           [-10,6],[10,6],[-6,10],[6,10]]) {
    m[cy + dr][cx + dc] = T.PILLAR;
  }
  for (const [dc, dr] of [[-3,-3],[3,-3],[-3,3],[3,3]]) {
    m[cy + dr][cx + dc] = T.TORCH;
  }
}

// ─── The village, before ──────────────────────────────────────────────────────
function buildHomeVillageMap() {
  const m = makeTile(MROWS, MCOLS, T.TREE);

  // The clearing starts as grass. Roads go down first; the Four Springs is
  // stamped over their central ends so dirt approaches become polished stone
  // as soon as they enter the ceremonial square.
  setRect(m, HV_R1, HV_C1, HV_R2, HV_C2, T.GRASS);

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
  // The mill's own track: south out of its doorway, then east along the market
  // row to join the stall. Laid with the other roads, before the buildings, for
  // the same reason they are — the mill itself is stamped over the top of the
  // stretch that runs under it.
  setCol(m, HOME.mill.door.x, HOME.mill.door.y + 1, HOME.market.y, T.PATH);
  setRow(m, HOME.market.y, HOME.mill.door.x, HOME.market.x, T.PATH);

  hvGrandSquare(m);

  // ── Neighbours' houses ──
  // Compact 9×7 cottages form close streets around the clearing. Every house
  // footprint in Elderbrook has at least three open tiles before the next one;
  // the northern row is spaced outward from the larger family home accordingly.
  // The compact footprint still matches the forest-village redesign.
  const neighbours = [
    { r1: 47,  c1: 45, w: 8, h: 6 },
    { r1: 47,  c1: 57, w: 8, h: 6 },
    { r1: 47,  c1: 85, w: 8, h: 6 },
    { r1: 47,  c1: 97, w: 8, h: 6 },
    { r1: 72,  c1: 44, w: 8, h: 6 },
    { r1: 72,  c1: 99, w: 8, h: 6 },
    { r1: 100, c1: 60, w: 8, h: 6 },
    { r1: 100, c1: 82, w: 8, h: 6 },
    { r1: 108, c1: 45, w: 8, h: 6 },
    { r1: 108, c1: 96, w: 8, h: 6 },
  ];
  for (const h of neighbours) hvHouse(m, h.r1, h.c1, h.w, h.h);

  // ── The mill ──
  // Built like every other building here, then given the one thing that makes it
  // read as a mill rather than a fifth cottage: a pair of millstones lying in the
  // yard beside its door. (Placeholder art — a proper wheel would want its own
  // tile; this is a landmark for a line of dialogue, not a building the player
  // ever goes into.) The stones sit on open grass south-west of the door, clear
  // of the doorway itself and of the market pad east of them, so nothing solid
  // lands on a route.
  {
    const ml = HOME.mill;
    hvMill(m, ml.r1, ml.c1, ml.w, ml.h);
    const yardR = ml.r1 + ml.h + 1;
    m[yardR][ml.c1 + 1] = T.ROCK;
    m[yardR][ml.c1 + 2] = T.ROCK;
  }

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
  // Furnishings use the edges of the larger room: beds along the west wall and
  // a dining setting across the north side. The broad middle and the aisle from
  // spawn to the door stay clear for the opening scene and free movement.
  m[H.r1 + 5][H.c1 + 1] = T.BED;
  m[H.r1 + 6][H.c1 + 1] = T.BED;
  m[H.r1 + 2][H.c1 + 7] = T.TABLE;
  m[H.r1 + 2][H.c1 + 6] = T.CHAIR;
  m[H.r1 + 2][H.c1 + 8] = T.CHAIR;
  // The household chest, tucked in the south-west corner. Story furniture: it
  // holds Grandmother's Sword and stays locked until Beat 5, and it is exempt
  // from the generic small-chest loot table (see handlePickup in player.js).
  m[HOME.chest.y][HOME.chest.x] = T.CHEST;
  // Grandmother's Bow, resting against the wall beside her chair. The script
  // describes it in Beat 1 and pays it off in Beat 5, so it is on the map from
  // the first frame rather than appearing when it becomes useful.
  m[HOME.bowRestAt.y][HOME.bowRestAt.x] = T.GRAN_BOW;
  // Fast-travel portal in the south-east corner, opposite the chest — same
  // arrangement the starter cabin had, so home stays a portal destination once
  // the world opens up. A Gatekeeper spawns beside it (ensurePortalKeeper in
  // villagers.js); talk to them to open the destinations menu. It survives the
  // fire: hvCharTile leaves T.PORTAL alone, deliberately.
  m[hr2 - 1][hc2 - 1] = T.PORTAL;

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
  // The gap is ONE tile wide, not two, so the dog standing in it (HOME.dogAt)
  // actually blocks the road rather than being something the player strolls
  // around without ever learning the action button. Not a hard gate either way:
  // the fence only spans rows 73-84, so anyone determined can walk around its
  // ends through open grass. It blocks the direct route, which is all the beat
  // needs it to do.
  for (let r = HOME.center.y - 5; r <= HOME.center.y + 6; r++) {
    if (r === HOME.center.y) continue;   // the road gap
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

// The mill. Same shell as hvHouse — walls, floor, south door, torches — but
// furnished as a workplace rather than a home, because a building with two beds
// and a dinner table in it reads as somebody's cottage, and Father's directions
// only work if the player can pick this one building out from the other five.
// Inside: a run of grinding stones down the middle and a workbench to bag off at.
// No beds and no dining table, which is the whole point — those are what made it
// read as a home. (Grain sacks were tried here and cut: the only tile in the set
// with the right silhouette is T.BONES, which draws an actual skull and ribcage,
// and a heap of bones on a village mill floor tells a story nobody wrote.)
function hvMill(m, r1, c1, w, h) {
  setRect(m, r1, c1, r1 + h, c1 + w, T.WALL);
  setRect(m, r1 + 1, c1 + 1, r1 + h - 1, c1 + w - 1, T.FLOOR);
  m[r1 + h][c1 + Math.floor(w / 2)] = T.DOOR;
  m[r1 + 1][c1 + 1] = T.TORCH;
  m[r1 + 1][c1 + w - 1] = T.TORCH;
  // The stones themselves, paired down the length of the floor.
  const mr = r1 + Math.floor(h / 2);
  m[mr][c1 + 2] = T.ROCK;
  m[mr][c1 + 3] = T.ROCK;
  m[mr][c1 + 5] = T.ROCK;
  m[mr][c1 + 6] = T.ROCK;
  // Workbench along the east side.
  m[mr][c1 + w - 2] = T.TABLE;
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
    // The blacksmith does not survive Ashfall, so his door burns with the rest.
    case T.SMITH_DOOR:   return T.RUBBLE;
    // The inn, the general store and the herbalist DO survive — the script has
    // all three still standing in the ruin afterwards. Their doorways therefore
    // have to stay passable, or the keepers are walled into buildings the player
    // can see them through and never reach. They keep their own door tiles rather
    // than charring to scorched floor so the three surviving trades are still
    // findable at a glance in a village that is otherwise black.
    case T.INN_DOOR:
    case T.STORE_DOOR:
    case T.HERB_DOOR:    return t;
    // Torches, fireplaces, chests, Grandmother's Bow, the window and the pillars
    // of the Hendricks' fence are left as they are: a hearth in a burnt house
    // still reads as a hearth, and turning the chest to rubble would eat the
    // player's belongings. The chest and the bow specifically MUST survive this
    // pass — Beat 5 is built on the player finding both of them in the ruin, and
    // the script's own image is the chest standing open with its lock burned
    // away. They fall through to the default rather than being listed, so if a
    // case is ever added for them, it has to be a deliberate one.
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
  hvCollapseRouteHome(m);
}

// Collapsing path. The corridor above is cleared wide open, which made the run
// home a straight sprint up a three-wide lane; the script wants "collapsing paths
// forcing minor rerouting". So three chokepoints are dropped back into it, each
// blocking two of the three lanes and alternating which one stays open, so the
// player has to weave rather than hold one direction.
//
// Deterministic, not rolled: the same three rows every time, so the run plays the
// same way for everyone and can be reasoned about. Softlock-proof by construction
// — every chokepoint leaves one lane of the corridor open, and the corridor is
// only the direct route anyway (the village either side of it is open ground).
// HOME_COLLAPSE is asserted against a flood fill in the verification pass.
const HOME_COLLAPSE = [
  { row: 74, blocked: [-1, 0] },   // squeeze east
  { row: 70, blocked: [0, 1] },    // then back west
  { row: 66, blocked: [-1, 1] },   // then thread the middle
];

function hvCollapseRouteHome(m) {
  for (const choke of HOME_COLLAPSE) {
    // Never stamp over the doorway or the tile the player lands on inside it.
    if (choke.row <= HOME.door.y) continue;
    for (const dc of choke.blocked) m[choke.row][HOME.center.x + dc] = T.RUBBLE;
  }
}

// The fallen timber that pins the grandmother, laid once the fire has passed.
// Placed around her rather than on her — she's a villager standing on a walkable
// tile, and the rubble is what the player sees holding her down.
function hvPinGrandmother(m) {
  const g = HOME.dyingAt;
  m[g.y - 1][g.x]     = T.RUBBLE;
  m[g.y - 1][g.x - 1] = T.RUBBLE;
  m[g.y][g.x + 1]     = T.RUBBLE;
  // The bow comes off the wall and onto the floor beside her, "just out of her
  // reach". Moving it rather than spawning a second one keeps one bow in the
  // world: it was a thing the player could see in Beat 1, and it is the same
  // object here. Passable, because Beat 5 walks the player onto it.
  m[HOME.bowRestAt.y][HOME.bowRestAt.x] = T.SCORCHED_FLOOR;
  m[HOME.bowAt.y][HOME.bowAt.x] = T.GRAN_BOW;
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
  // ...but not her bow, if the hero is already carrying it. hvPinGrandmother lays
  // the bow down beside her because that is where Beat 5 finds it; every rebuild
  // after Beat 5 has to take it away again, or the ruin grows a second bow every
  // time it is reconstructed (the skip path, a save with no stored tiles, a fresh
  // world built with prologue_complete already set). The same tile-clearing
  // grantGrandmothersWeapons does, at the one point all three paths share.
  const taken = (typeof hasFlag === 'function') && hasFlag('revenge_triggered');
  if (taken && m[HOME.bowAt.y][HOME.bowAt.x] === T.GRAN_BOW) {
    m[HOME.bowAt.y][HOME.bowAt.x] = T.SCORCHED_FLOOR;
  }
  return m;
}
