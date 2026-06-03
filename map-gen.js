// ─── Map generators ───────────────────────────────────────────────────────────
// Regions are linear: forest → fire (desert) → water → ice → earth → air →
// lightning → luminous → necrotic → poison → mana. Each region is 20 overworld
// maps + 1 boss village, defined declaratively in REGIONS below. Forest and
// fire (desert) keep their bespoke buildForestMap / buildDesertMap builders
// for the richer art; the seven later regions share the generic
// buildRegionMap which palette-swaps a desert-style layout.

// Pool of evocative names — depth number appended for clarity in the HUD.
const FOREST_NAMES = [
  'Whispering Grove', 'Mossy Hollow', 'Thornwood Pass', 'Shadowed Glade',
  'Fernwood Thicket', 'Ancient Canopy', 'Bogwood Crossing', 'Moonlit Clearing',
  'Crimson Oak Dell', 'Twisted Roots', 'Spider Hollow', 'Frostvine Path',
  'Elder Stump', 'Lanternfly Glade', 'Fungal Depths', 'Ruins of Sylvan',
  'Brookside Thicket', 'Mirkwood Passage', 'Glowshroom Hollow', 'Bramblewood'
];

const DESERT_NAMES = [
  'Scorching Dunes', 'Bleached Wastes', 'Sunbaked Flats', 'Mirage Hollow',
  'Cactus Reach', 'Bonefield', 'Vulture Crossing', 'Glassand Plateau',
  'Salt Pan', 'Wind-Carved Cliffs', 'Sandstone Maze', 'Sirocco Pass',
  'Dust Devil Plains', 'Sunstruck Ruins', 'Forgotten Oasis', 'Buzzard Gulch',
  'Quicksand Basin', 'Obsidian Spires', 'Ember Reach', 'Skeleton Mesa'
];

// Each REGIONS entry fully describes one elemental region:
//   id           short string identifier (also the world map `biome`)
//   element      sword-element id this region thematically grants
//   border       solid wall tile that frames every map (wraps the playfield)
//   ground       open passable tile carved out of the border by the builder
//   decoration   sparse passable tile scattered onto ground for texture
//   accent       hazard / water-feature tile (water, lava, ice patch, etc.)
//   names        20 evocative location names appended with depth `[N]`
//   villageName  fixed name shown when the region's boss arena is generated
//   enemyTier    index into ENEMY_POOLS for non-village spawns
//   boss         DND_ENEMIES key spawned in the region's village
//
// The first two entries (forest, fire) keep their bespoke builders, but the
// table still drives village palette, enemy pool, names, and progression order.
const REGIONS = [
  { id:'forest',    element:null,        border:T.TREE,            ground:T.GRASS,          decoration:T.FLOWER,   accent:T.WATER,       names:FOREST_NAMES, villageName:'Village of the Lost',     enemyTier:1, boss:'lich_boss'      },
  { id:'fire',      element:'fire',      border:T.CACTUS,          ground:T.SAND,           decoration:T.BONES,    accent:T.LAVA,        names:DESERT_NAMES, villageName:'Oasis of the Damned',     enemyTier:2, boss:'mummy_lord'     },
  { id:'water',     element:'water',     border:T.DEEP_WATER,      ground:T.SAND,           decoration:T.WATER,    accent:T.WATER,       names:[
      'Tidepool Reach','Coral Strait','Lagoon Hollow','Brinepath','Surfbreak Sands',
      'Kelpforest Crossing','Saltspray Cove','Mermaid Atoll','Drowned Ruins','Pearl Banks',
      'Stormtide Beach','Anemone Flats','Sunken Causeway','Crashing Shoals','Riftwater Pass',
      'Driftwood Cay','Shellwhisper Bay','Algae Maze','Whirlpool Basin','Abyssal Edge'
    ], villageName:'Tideborn Refuge',           enemyTier:2, boss:'kraken_boss'    },
  { id:'ice',       element:'ice',       border:T.GLACIER,         ground:T.SNOW,           decoration:T.ICE,      accent:T.WATER,       names:[
      'Frostbite Plain','Glacier Pass','Crystal Tundra','Snowdrift Hollow','Frozen Glade',
      'Hoarfrost Reach','Icefall Crossing','Permafrost Maze','Blizzard Pass','Glacial Ruins',
      'Aurora Shelf','Frost-veined Hollow','Sleet Basin','Wintervale','Cryomire',
      'Brittle Crag','Diamond Dust Plain','Spire of Ice','Snowblind Crossing','Glasslake'
    ], villageName:'Frostfast Hold',            enemyTier:3, boss:'frost_titan'    },
  { id:'earth',     element:null,        border:T.MOUNTAIN,        ground:T.PATH,           decoration:T.MUD,      accent:T.ROCK,        names:[
      'Granite Pass','Boulder Hollow','Quarry Trail','Stoneroot Glen','Slatefall Reach',
      'Earthcrack Maze','Cinder Ridge','Marble Vein','Mudbog Crossing','Tremor Basin',
      'Old Roads','Tumulus Field','Caveborn Path','Sediment Flats','Mossy Crag',
      'Sunken Plateau','Iron Gulch','Echo Canyon','Magmaroot Hollow','Petrified Grove'
    ], villageName:'Stoneheart Burrow',         enemyTier:3, boss:'gaia_colossus'  },
  { id:'air',       element:'wind',      border:T.CLOUDWALL,       ground:T.CLOUD,          decoration:T.CLOUD,    accent:T.WATER,       names:[
      'Skywharf','Cumulus Crossing','Zephyr Vault','Updraft Reach','Drifting Bastion',
      'Thunderhead Pass','Mist-veiled Path','Featherfall Hollow','Cirrus Ribbon','Stratos Spine',
      'Galewall','Wisp Field','Halcyon Reach','Stormthrone Approach','Falcon Roost',
      'Cloudbreak','Sky-stair','High Tundra','Whispering Currents','Aetherwake'
    ], villageName:'Stormcrown Aerie',          enemyTier:4, boss:'wind_djinn'     },
  { id:'lightning', element:null,        border:T.STORM_CLOUD,     ground:T.STORM_GROUND,   decoration:T.ROCK,     accent:T.LAVA,        names:[
      'Sparkfen','Voltaic Plain','Thunderfork Pass','Stormglass Reach','Static Maze',
      'Galvanic Hollow','Arcwire Crossing','Lichtning Field','Tesla Spires','Surge Basin',
      'Brimwire','Ferrum Edge','Crackleway','Boltcaster Ridge','Shockmarsh',
      'Magnet Crag','Glasspowder Plain','Filament Gardens','Plasma Bowl','Coronet'
    ], villageName:'Voltheart Bastion',         enemyTier:4, boss:'storm_lord'     },
  { id:'luminous',  element:'luminous',  border:T.LUMINOUS_CRYSTAL, ground:T.LUMINOUS_FLOOR, decoration:T.MUSHROOM, accent:T.WATER, names:[
      'Sunhalo Reach','Dawnlit Field','Prism Garden','Goldenmoss Hollow','Halo Pass',
      'Bright Causeway','Aureate Steps','Lambent Glade','Daystar Crossing','Lustrous Vault',
      'Beacon Plain','Argent Maze','Lumenrise','Suncast Ridge','Mirrorbright Atrium',
      'Effulgent Brook','Coronal Field','Glimmerwash','Radiant Apse','Shining Sanctum'
    ], villageName:'Solarspire Sanctum',        enemyTier:4, boss:'seraph_judge'   },
  { id:'necrotic',  element:'necrotic',  border:T.BLIGHTED_WALL,   ground:T.BLIGHT,         decoration:T.BONES,    accent:T.LAVA,        names:[
      'Witherfen','Boneyard Crossing','Pall Glade','Hollow Reach','Decay Plain',
      'Shroudwood','Mourner\'s Pass','Cinderash Field','Gravesong Maze','Black Marrow',
      'Pall-veiled Ruins','Tomb-iron Reach','Carrion Flats','Sepulchre Trail','Funeral Causeway',
      'Witch-light Hollow','Coffinroot','Wraithmire','Reliquary Ribs','Last Rites Plain'
    ], villageName:'Ossuary of the Pale King',  enemyTier:5, boss:'death_knight'   },
  { id:'poison',    element:'poison',    border:T.POISON_WALL,     ground:T.SLUDGE,         decoration:T.MUSHROOM, accent:T.DEEP_WATER,  names:[
      'Venomvale','Toxic Bog','Spore Pass','Mireheart','Slime Reach',
      'Acidlake Crossing','Foulweed Hollow','Plague Trail','Hexbog Maze','Murkfen',
      'Rotwood Edge','Stagnant Causeway','Bilegrove','Cankerstump','Pestilent Field',
      'Snake-fang Hollow','Greenfog Reach','Necrosis Plain','Bubble Marsh','Witherwart'
    ], villageName:'Mire-warden Citadel',       enemyTier:5, boss:'hydra_queen'    },
  { id:'mana',      element:null,        border:T.MANA_CRYSTAL,    ground:T.MANA_FLOOR,     decoration:T.FLOWER, accent:T.DEEP_WATER, names:[
      'Arcanum Reach','Spellwell Plain','Sigil Garden','Channeled Pass','Aether Field',
      'Glyphvein Maze','Lifeweave Hollow','Runestone Crossing','Conduit Spire','Resonant Bowl',
      'Astral Causeway','Mage-glass Plateau','Echo Lattice','Filigree Field','Mantra Plain',
      'Distortion Reach','Astral Wash','Crystal Choir','Theurgy Trail','Heartmoon'
    ], villageName:'Heartstone Conclave',       enemyTier:5, boss:'archmage_void'  },
];

// Quick lookup helper.
function regionById(id) { return REGIONS.find(r => r.id === id) || REGIONS[0]; }

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

  // Phase 2: main path network connecting centre to each *open* exit
  const midR = Math.floor(MROWS / 2), midC = Math.floor(MCOLS / 2);
  if (open.up)    drunkWalk(m, midR, midC, 1,         EXIT_COL,   T.PATH, 1);
  if (open.down)  drunkWalk(m, midR, midC, MROWS - 2, EXIT_COL,   T.PATH, 1);
  if (open.left)  drunkWalk(m, midR, midC, EXIT_ROW,  1,          T.PATH, 1);
  if (open.right) drunkWalk(m, midR, midC, EXIT_ROW,  MCOLS - 2,  T.PATH, 1);
  // Extra wandering grass paths for visual variety
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

  // Ensure exit corridors are wide and reach interior — only for *open* sides
  cutExits(m, open.left, open.right, open.up, open.down);
  if (open.left)  drunkWalk(m, EXIT_ROW, 1,           EXIT_ROW, midC,    T.PATH, 1);
  if (open.right) drunkWalk(m, EXIT_ROW, MCOLS - 2,   EXIT_ROW, midC,    T.PATH, 1);
  if (open.up)    drunkWalk(m, 1,           EXIT_COL, midR,     EXIT_COL, T.PATH, 1);
  if (open.down)  drunkWalk(m, MROWS - 2,   EXIT_COL, midR,     EXIT_COL, T.PATH, 1);

  // Final border lock + re-cut exits
  for (let c = 0; c < MCOLS; c++) { m[0][c] = T.TREE; m[MROWS - 1][c] = T.TREE; }
  for (let r = 0; r < MROWS; r++) { m[r][0] = T.TREE; m[r][MCOLS - 1] = T.TREE; }
  cutExits(m, open.left, open.right, open.up, open.down);

  // Now place the single chest. Done after all path carving so nothing can
  // overwrite it; ensureConnectivity preserves CHEST tiles.
  if (chestSpot) m[chestSpot.r][chestSpot.c] = T.CHEST;

  // Guarantee everything passable is reachable from at least one exit
  ensureConnectivity(m);

  return m;
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

  // Phase 5: oases — small water pools ringed by cacti (one or two per map)
  const oasisCount = 1 + (Math.random() < 0.5 ? 1 : 0);
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

  // Phase 7: bone decorations scattered across sand
  scatter(m, T.BONES, 60);
  // Sparse cacti scattered as obstacles in open sand
  for (let i = 0; i < 120; i++) {
    const rr = rnd(2, MROWS - 3), rc = rnd(2, MCOLS - 3);
    if (m[rr][rc] === T.SAND && Math.random() < 0.5) m[rr][rc] = T.CACTUS;
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

  ensureConnectivity(m, false, T.CACTUS);

  return m;
}

// ─── Village activation ──────────────────────────────────────────────────────
// Called when the player clears every enemy in a village map. Converts four
// random house doors into an INN_DOOR, a STORE_DOOR, a HERB_DOOR, and a
// SMITH_DOOR so the player can rest, shop, trade ingredients, and buy armor.
// Idempotent — re-entering the cleared village keeps the doors.
function activateVillage(mapObj) {
  if (!mapObj || mapObj.activated) return false;
  const m = mapObj.map;
  const doors = [];
  for (let r = 0; r < MROWS; r++)
    for (let c = 0; c < MCOLS; c++)
      if (m[r][c] === T.DOOR) doors.push({ r, c });
  if (doors.length < 4) return false;
  // Shuffle (Fisher–Yates) and pick the first four for inn + store + herbalist
  // + blacksmith.
  for (let i = doors.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [doors[i], doors[j]] = [doors[j], doors[i]];
  }
  m[doors[0].r][doors[0].c] = T.INN_DOOR;
  m[doors[1].r][doors[1].c] = T.STORE_DOOR;
  m[doors[2].r][doors[2].c] = T.HERB_DOOR;
  m[doors[3].r][doors[3].c] = T.SMITH_DOOR;
  mapObj.activated = true;
  // Remember where the player can come back to
  mapObj.innDoor = doors[0];
  mapObj.storeDoor = doors[1];
  mapObj.herbDoor = doors[2];
  mapObj.smithDoor = doors[3];
  // Rename so the HUD reflects the change
  if (!/Active/.test(mapObj.name)) mapObj.name = mapObj.name + ' (Active)';
  // Reveal the whole village so the player can find the new doors immediately.
  if (!mapObj.fog) mapObj.fog = new Uint8Array(MROWS * MCOLS);
  mapObj.fog.fill(1);
  return true;
}

// ─── Starter house map ───────────────────────────────────────────────────────
// A small, furnished one-room house used as the game's starting map. The
// playable area is a 21×16 room hugging the south border so the room's south
// wall coincides with the map's south exit — walking south out the door
// triggers the normal map transition into forest [2]. Everything outside the
// room is wrapped in T.TREE so it's solid and never gets rendered.
//
// Furnishings (north-up):
//   ┌────────────────────┐
//   │ 🛏  🛏              │   bed in the NW corner
//   │ 🛏  🛏    🔥        │   fireplace against the north wall
//   │                    │
//   │       T            │   table with chairs flanking it
//   │      C T C         │
//   │       C            │
//   │   📦                │   chest in the SW
//   └─────D──────────────┘   door at south-centre = map's south exit
function buildStarterHouseMap() {
  const m = makeTile(MROWS, MCOLS, T.TREE);
  const HW = 21, HH = 16;
  const r1 = MROWS - 1 - HH;                    // north interior wall row
  const c1 = Math.floor(MCOLS / 2) - Math.floor(HW / 2);
  const r2 = MROWS - 1;                         // south wall == map border
  const c2 = c1 + HW;

  // Walls + interior floor
  setRect(m, r1, c1, r2, c2, T.WALL);
  setRect(m, r1 + 1, c1 + 1, r2 - 1, c2 - 1, T.FLOOR);

  // Corner torches for ambience
  m[r1 + 1][c1 + 1] = T.TORCH;
  m[r1 + 1][c2 - 1] = T.TORCH;

  // Bed in the NW (2 tiles stacked vertically)
  m[r1 + 2][c1 + 2] = T.BED;
  m[r1 + 3][c1 + 2] = T.BED;

  // Fireplace against the north wall, east side
  m[r1 + 2][c2 - 3] = T.FIREPLACE;

  // Dining table + flanking chairs near the room centre
  const tr = r1 + Math.floor(HH / 2) + 1;
  const tc = c1 + Math.floor(HW / 2);
  m[tr][tc]     = T.TABLE;
  m[tr][tc - 2] = T.CHAIR;
  m[tr][tc + 2] = T.CHAIR;

  // A storage chest tucked in the SW corner
  m[r2 - 2][c1 + 2] = T.CHEST;

  // South-only exit: cut the standard 5-wide PATH gate at the map border
  // first, then stamp a DOOR tile dead-centre on it so the room visibly has
  // one obvious way out. Walking onto either the door or the flanking PATH
  // tiles triggers the normal map transition to forest [2].
  cutExits(m, false, false, false, true);
  m[r2][EXIT_COL] = T.DOOR;

  return m;
}

// ─── Cave map ─────────────────────────────────────────────────────────────────
// A small 20×20 chamber centred in the standard 150×150 grid, surrounded by
// solid wall. Contains one CAVE_EXIT (back to the source map) and one
// LARGE_CHEST that grants the +2 Sword / +2 Armor reward.
function buildCaveMap() {
  const m = makeTile(MROWS, MCOLS, T.WALL);
  const cx = Math.floor(MCOLS / 2);
  const cy = Math.floor(MROWS / 2);
  const half = 10;
  // Hollow out the 20×20 chamber
  setRect(m, cy - half, cx - half, cy + half - 1, cx + half - 1, T.CAVE_FLOOR);
  // A stone-wall trim along the chamber's edge
  setRow(m, cy - half,     cx - half, cx + half - 1, T.ROCK);
  setRow(m, cy + half - 1, cx - half, cx + half - 1, T.ROCK);
  setCol(m, cx - half,     cy - half, cy + half - 1, T.ROCK);
  setCol(m, cx + half - 1, cy - half, cy + half - 1, T.ROCK);
  // Re-open the floor inset by 1 tile
  setRect(m, cy - half + 1, cx - half + 1, cy + half - 2, cx + half - 2, T.CAVE_FLOOR);
  // Player landing spot (bottom of chamber) holds the CAVE_EXIT
  m[cy + half - 2][cx] = T.CAVE_EXIT;
  // Large chest at the back — 2 tiles wide (anchor at cx, extension at cx+1)
  m[cy - half + 3][cx]     = T.LARGE_CHEST;
  m[cy - half + 3][cx + 1] = T.LARGE_CHEST_R;
  // Atmosphere: torches at the corners
  m[cy - half + 1][cx - half + 1] = T.TORCH;
  m[cy - half + 1][cx + half - 2] = T.TORCH;
  m[cy + half - 2][cx - half + 1] = T.TORCH;
  m[cy + half - 2][cx + half - 2] = T.TORCH;
  return m;
}

// ─── Generic elemental region map ────────────────────────────────────────────
// Palette-swap of buildDesertMap for the seven later elemental regions (water,
// ice, earth, air, lightning, luminous, necrotic, poison, mana). Takes a
// region object from REGIONS — that supplies border/ground/decoration/accent
// tiles and everything else here is identical structure to the desert builder.
function buildRegionMap(seed, depth, openSides, region) {
  const open = openSides || { left: true, right: true, up: true, down: true };
  const BORDER = region.border, GROUND = region.ground;
  const DECOR = region.decoration, ACCENT = region.accent;
  const m = makeTile(MROWS, MCOLS, BORDER);

  // Phase 1: carve open ground patches across the map
  const patchCount = 60 + depth * 2;
  for (let i = 0; i < patchCount; i++) {
    const pr = rnd(5, MROWS - 6), pc = rnd(5, MCOLS - 6);
    const pw = rnd(3, 10), ph = rnd(3, 10);
    setRect(m, pr, pc, Math.min(pr + ph, MROWS - 2), Math.min(pc + pw, MCOLS - 2), GROUND);
  }

  // Phase 2: main paths from centre to each open exit
  const midR = Math.floor(MROWS / 2), midC = Math.floor(MCOLS / 2);
  if (open.up)    drunkWalk(m, midR, midC, 1,         EXIT_COL,   T.PATH, 1);
  if (open.down)  drunkWalk(m, midR, midC, MROWS - 2, EXIT_COL,   T.PATH, 1);
  if (open.left)  drunkWalk(m, midR, midC, EXIT_ROW,  1,          T.PATH, 1);
  if (open.right) drunkWalk(m, midR, midC, EXIT_ROW,  MCOLS - 2,  T.PATH, 1);
  for (let i = 0; i < 6; i++) {
    const r1 = rnd(10, MROWS - 10), c1 = rnd(10, MCOLS - 10);
    const r2 = rnd(10, MROWS - 10), c2 = rnd(10, MCOLS - 10);
    drunkWalk(m, r1, c1, r2, c2, GROUND, 1);
  }

  // Phase 3: special clearings (homes for chests / shrines)
  const clearings = [];
  for (let i = 0; i < 8; i++) {
    const cr = rnd(15, MROWS - 15), cc = rnd(15, MCOLS - 15);
    const cw = rnd(8, 16), ch = rnd(8, 16);
    setRect(m, cr, cc, Math.min(cr + ch, MROWS - 2), Math.min(cc + cw, MCOLS - 2), GROUND);
    clearings.push({ r: cr + Math.floor(ch / 2), c: cc + Math.floor(cw / 2) });
  }

  // Phase 4: accent features (water pools, lava pits, ice patches, etc.) with
  // bridges across them so the map stays traversable.
  const accentCount = 2 + Math.floor(depth / 4);
  for (let i = 0; i < accentCount; i++) {
    const ar = rnd(20, MROWS - 25), ac = rnd(20, MCOLS - 25);
    const sz = rnd(5, 10);
    const ar2 = Math.min(ar + sz, MROWS - 2), ac2 = Math.min(ac + sz, MCOLS - 2);
    setRect(m, ar, ac, ar2, ac2, ACCENT);
    const bridgeR = Math.floor((ar + ar2) / 2);
    setRow(m, bridgeR, Math.max(1, ac - 1), Math.min(MCOLS - 2, ac2 + 1), T.BRIDGE);
  }

  // Phase 5: scattered rocks (bombable cover) — palette stays neutral.
  for (let i = 0; i < 80 + depth; i++) {
    const rr = rnd(2, MROWS - 3), rc = rnd(2, MCOLS - 3);
    if ((m[rr][rc] === GROUND || m[rr][rc] === T.PATH) && Math.random() < 0.3) {
      m[rr][rc] = T.ROCK;
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

  // Ensure exit corridors reach interior
  cutExits(m, open.left, open.right, open.up, open.down);
  if (open.left)  drunkWalk(m, EXIT_ROW, 1,           EXIT_ROW, midC,    T.PATH, 1);
  if (open.right) drunkWalk(m, EXIT_ROW, MCOLS - 2,   EXIT_ROW, midC,    T.PATH, 1);
  if (open.up)    drunkWalk(m, 1,           EXIT_COL, midR,     EXIT_COL, T.PATH, 1);
  if (open.down)  drunkWalk(m, MROWS - 2,   EXIT_COL, midR,     EXIT_COL, T.PATH, 1);

  // Final border lock + re-cut exits
  for (let c = 0; c < MCOLS; c++) { m[0][c] = BORDER; m[MROWS - 1][c] = BORDER; }
  for (let r = 0; r < MROWS; r++) { m[r][0] = BORDER; m[r][MCOLS - 1] = BORDER; }
  cutExits(m, open.left, open.right, open.up, open.down);

  if (chestSpot) m[chestSpot.r][chestSpot.c] = T.CHEST;

  // Seal any orphan passable pockets with the region's border tile so the
  // visual matches the surrounding wall instead of leaking forest TREE.
  ensureConnectivity(m, false, BORDER);
  return m;
}

// ─── Desert village map ─────────────────────────────────────────────────────
// Thin wrapper: the same fixed village layout rendered with a desert palette
// (cactus border, sand ground, bone decorations). Used as the boss arena at the
// end of the desert region.
function buildDesertVillageMap() {
  return buildVillageMap('fire');
}

// ─── Village map ──────────────────────────────────────────────────────────────
// Fixed layout used as the boss arena at the end of a region. 18 houses around
// a central fountain plaza. `biome` selects the palette: 'forest' (trees +
// grass + flowers) or 'desert' (cacti + sand + bones).
function buildVillageMap(biome) {
  // Resolve the region's palette. `biome` is a region id ('forest', 'fire',
  // 'water', ...). Legacy 'desert' callers map to 'fire'.
  const regionId = biome === 'desert' ? 'fire' : (biome || 'forest');
  const region = regionById(regionId);
  const BORDER = region.border;
  const GROUND = region.ground;
  const DECOR  = region.decoration;
  const m = makeTile(MROWS, MCOLS, T.PATH);

  // Perimeter border (forest/cactus hugging the village)
  for (let r = 0; r < MROWS; r++) { m[r][0] = BORDER; m[r][MCOLS - 1] = BORDER; }
  for (let c = 0; c < MCOLS; c++) { m[0][c] = BORDER; m[MROWS - 1][c] = BORDER; }
  // Inner ring (thicker border)
  for (let r = 1; r < 8; r++)             for (let c = 1; c < MCOLS - 1; c++) m[r][c] = BORDER;
  for (let r = MROWS - 8; r < MROWS - 1; r++) for (let c = 1; c < MCOLS - 1; c++) m[r][c] = BORDER;
  for (let r = 1; r < MROWS - 1; r++)     for (let c = 1; c < 8; c++)         m[r][c] = BORDER;
  for (let r = 1; r < MROWS - 1; r++)     for (let c = MCOLS - 8; c < MCOLS - 1; c++) m[r][c] = BORDER;

  // Village plaza (open paths)
  setRect(m, 8, 8, MROWS - 9, MCOLS - 9, T.PATH);

  // ─── Exit corridors FIRST ────────────────────────────────────────────────
  // Cut the four edge exits and drunkWalk approach corridors through the
  // tree ring BEFORE laying down anything else. Doing this first means the
  // village (houses, marble plaza, fountain) is built on top of stable
  // corridors instead of getting chopped by them.
  const midR = Math.floor(MROWS / 2), midC = Math.floor(MCOLS / 2);
  cutExits(m, true, true, true, true);
  drunkWalk(m, EXIT_ROW, 1,         EXIT_ROW, midC,    T.PATH, 2);
  drunkWalk(m, EXIT_ROW, MCOLS - 2, EXIT_ROW, midC,    T.PATH, 2);
  drunkWalk(m, 1,         EXIT_COL, midR,     EXIT_COL, T.PATH, 2);
  drunkWalk(m, MROWS - 2, EXIT_COL, midR,     EXIT_COL, T.PATH, 2);

  // Marble plaza around the fountain — 21×21 of polished tiles, fitting
  // neatly between the inner ring of houses (which sit at rows 49–61 and
  // 89–101). Painted on top of the corridor so the corridor ends in marble.
  setRect(m, midR - 10, midC - 10, midR + 10, midC + 10, T.MARBLE);

  // Helper: build a house with walls, floor, a south-facing door, torches,
  // and a small interior of furnishings (bed, fireplace, table, chairs).
  // The chest tile is deferred to the end of buildVillageMap so paths can't
  // overwrite it — when present it lands at (r1+2, c1+w/2), which doesn't
  // collide with any of the furniture positions below.
  function house(r1, c1, w, h) {
    setRect(m, r1, c1, r1 + h, c1 + w, T.WALL);
    setRect(m, r1 + 1, c1 + 1, r1 + h - 1, c1 + w - 1, T.FLOOR);
    m[r1 + h][c1 + Math.floor(w / 2)] = T.DOOR;
    m[r1 + 1][c1 + 1] = T.TORCH;
    m[r1 + 1][c1 + w - 1] = T.TORCH;

    // ── Furnishings ──────────────────────────────────────────────────
    // Bed in the upper-left corner (south of the NW torch)
    m[r1 + 2][c1 + 2] = T.BED;
    m[r1 + 3][c1 + 2] = T.BED;
    // Fireplace against the upper-right corner (south of the NE torch)
    m[r1 + 2][c1 + w - 2] = T.FIREPLACE;
    // Table near the centre of the room
    const tr = r1 + Math.floor(h / 2);
    const tc = c1 + Math.floor(w / 2);
    m[tr][tc] = T.TABLE;
    // Two chairs flanking the table — one west, one east
    m[tr][tc - 2] = T.CHAIR;
    m[tr][tc + 2] = T.CHAIR;
  }

  // 18 houses with uniform spacing.
  //
  //   • House dimensions: 17 cols wide × 13 rows tall (hw=16, hh=12 inclusive).
  //   • Inner ring (8) wraps the fountain with a 7-tile gap between adjacent
  //     houses in both directions.
  //   • Outer ring (10) lines the village perimeter — top and bottom rows
  //     each carry 4 houses with a uniform 22-tile horizontal gap; the two
  //     side houses sit at col 8 / col 125 (same columns as the corners).
  //
  const hw = 16, hh = 12;
  const HOUSE_W = hw + 1, HOUSE_H = hh + 1;     // 17, 13
  // Inner ring — rows 49 / 69 / 89, cols 43 / 67 / 91. Adjacent pairs sit
  // exactly 7 grass tiles apart; every house ends up ≥10 tiles from the
  // fountain colonnade.
  const INNER_GAP = 7;
  const NORTH_ROW = midR - 14 - hh;                          // 49
  const SIDE_ROW  = NORTH_ROW + HOUSE_H + INNER_GAP;         // 69
  const SOUTH_ROW = SIDE_ROW  + HOUSE_H + INNER_GAP;         // 89
  const CENTRE_COL = midC - Math.floor(hw / 2);              // 67
  const WEST_COL   = CENTRE_COL - HOUSE_W - INNER_GAP;       // 43
  const EAST_COL   = CENTRE_COL + HOUSE_W + INNER_GAP;       // 91
  // Outer ring — uniform spacing on every axis AND clear of the E↔W exit
  // corridor at row 75:
  //   • Top + bottom rows: 4 houses each at cols 8 / 47 / 86 / 125, giving
  //     a uniform 22-tile horizontal gap between adjacent houses.
  //   • Side columns 8 and 125: two extra houses each at rows 48 and 82
  //     (21-row gaps from the top, between themselves, and to the bottom).
  //     Both side rows sit clear of row 75, so the W↔E exit corridor reaches
  //     the plaza unobstructed.
  const OUTER_TOP_ROW    = 14;
  const OUTER_BOTTOM_ROW = 116;
  const OUTER_COLS       = [8, 47, 86, 125];   // 22-tile horizontal gap
  const OUTER_SIDE_ROWS  = [48, 82];           // 21-tile vertical gap on side cols
  const OUTER_SIDE_COLS  = [8, 125];           // the two side columns
  const housePlacements = [
    // ── Inner ring (4 corners only) ──────────────────────────────────
    // The cardinal N/S/E/W positions are intentionally left empty so the
    // four exit corridors (row 75 west↔east, col 75 north↔south) reach
    // the plaza unobstructed.
    { hr: NORTH_ROW, hc: WEST_COL },  // NW
    { hr: NORTH_ROW, hc: EAST_COL },  // NE
    { hr: SOUTH_ROW, hc: WEST_COL },  // SW
    { hr: SOUTH_ROW, hc: EAST_COL },  // SE
    // ── Outer ring (12) ──────────────────────────────────────────────
    ...OUTER_COLS.map(hc => ({ hr: OUTER_TOP_ROW,    hc })),
    ...OUTER_COLS.map(hc => ({ hr: OUTER_BOTTOM_ROW, hc })),
    ...OUTER_SIDE_ROWS.flatMap(hr => OUTER_SIDE_COLS.map(hc => ({ hr, hc }))),
  ];
  housePlacements.forEach(({ hr, hc }) => house(hr, hc, hw, hh));
  const chestHouse = housePlacements.length
    ? housePlacements[Math.floor(Math.random() * housePlacements.length)]
    : null;

  scatter(m, DECOR, 120);

  // Re-seal the outer border + re-cut the cardinal exits (some operations
  // above may have painted over border tiles).
  for (let c = 0; c < MCOLS; c++) { m[0][c] = BORDER; m[MROWS - 1][c] = BORDER; }
  for (let r = 0; r < MROWS; r++) { m[r][0] = BORDER; m[r][MCOLS - 1] = BORDER; }
  cutExits(m, true, true, true, true);

  // Place the village's single chest now, after all path carving.
  if (chestHouse) m[chestHouse.hr + 2][chestHouse.hc + Math.floor(hw / 2)] = T.CHEST;

  // ─── 7×7 Roman fountain (placed last so roads can't wipe it) ────────────
  // Pillars along the four edges of a 7×7 footprint (rows ±3, cols ±3). The
  // four corners stay sand so the plaza has clean diagonal approaches.
  for (let dc = -2; dc <= 2; dc++) {
    m[midR - 3][midC + dc] = T.PILLAR;
    m[midR + 3][midC + dc] = T.PILLAR;
  }
  for (let dr = -2; dr <= 2; dr++) {
    m[midR + dr][midC - 3] = T.PILLAR;
    m[midR + dr][midC + 3] = T.PILLAR;
  }
  // Inner 5×5 fountain basin
  setRect(m, midR - 2, midC - 2, midR + 2, midC + 2, T.FOUNTAIN_WATER);
  // Central spurting spout
  m[midR][midC] = T.FOUNTAIN_SPOUT;
  // Cardinal + corner torches around the colonnade for night ambience
  m[midR - 5][midC] = T.TORCH; m[midR + 5][midC] = T.TORCH;
  m[midR][midC - 5] = T.TORCH; m[midR][midC + 5] = T.TORCH;
  m[midR - 5][midC - 5] = T.TORCH; m[midR - 5][midC + 5] = T.TORCH;
  m[midR + 5][midC - 5] = T.TORCH; m[midR + 5][midC + 5] = T.TORCH;

  // ─── Boss chest: 2×2 King's Hoard ───────────────────────────────────────
  // Placed on the marble plaza, south of the fountain so the player can
  // clearly see it on approach from the south exit. Anchor (TL) at
  // (midR+6, midC-1); the four tiles span rows midR+6..midR+7 and cols
  // midC-1..midC. All four tiles sit inside the 21×21 marble plaza
  // (midR±10, midC±10) and clear of the 7×7 fountain colonnade (midR±3).
  const bcr = midR + 6, bcc = midC - 1;
  m[bcr    ][bcc    ] = T.BOSS_CHEST_TL;
  m[bcr    ][bcc + 1] = T.BOSS_CHEST_TR;
  m[bcr + 1][bcc    ] = T.BOSS_CHEST_BL;
  m[bcr + 1][bcc + 1] = T.BOSS_CHEST_BR;
  // Flanking torches for dramatic effect
  m[bcr    ][bcc - 2] = T.TORCH;
  m[bcr    ][bcc + 3] = T.TORCH;

  // ─── Replace dirt: turn every remaining PATH tile into ground ───────────
  // Forest villages look green (grass); desert villages look sandy (sand).
  for (let r = 0; r < MROWS; r++) {
    for (let c = 0; c < MCOLS; c++) {
      if (m[r][c] === T.PATH) m[r][c] = GROUND;
    }
  }

  // ─── Cobblestone paths: door → plaza, and exit → plaza ──────────────────
  // BFS from each start tile out through passable tiles until we touch the
  // marble plaza OR an existing cobblestone path. Two rules:
  //   1. The path stays ≥ 1 tile away from house walls (the only exception is
  //      the very first "doormat" tile directly south of a door, which is
  //      always wall-adjacent and is seeded directly).
  //   2. BFS also accepts COBBLESTONE as a terminal, so when a new path
  //      reaches another path's tile it merges instead of running parallel.
  //      Combined with #1 this means parallel paths within 3 grass tiles of
  //      each other tend to collapse into a single shared road.
  function tileAdjacentToWall(c, r) {
    for (let d = 0; d < 4; d++) {
      const dr = d === 0 ? 1 : d === 1 ? -1 : 0;
      const dc = d === 2 ? 1 : d === 3 ? -1 : 0;
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= MROWS || nc < 0 || nc >= MCOLS) continue;
      if (m[nr][nc] === T.WALL) return true;
    }
    return false;
  }
  function isPathPassable(c, r) {
    const t = m[r][c];
    if (t === T.MARBLE || t === T.COBBLESTONE) return true;
    if (t !== GROUND && t !== DECOR) return false;
    // 1-tile buffer from walls — ground directly bordering a house wall is
    // off-limits for path routing so the cobble doesn't hug the buildings.
    if (tileAdjacentToWall(c, r)) return false;
    return true;
  }
  function bfsToPlaza(startR, startC) {
    if (startR < 0 || startR >= MROWS || startC < 0 || startC >= MCOLS) return null;
    const startT = m[startR][startC];
    // Allow the start tile (door doormat) even though it's wall-adjacent.
    if (startT !== GROUND && startT !== DECOR &&
        startT !== T.MARBLE && startT !== T.COBBLESTONE) return null;
    const visited = new Uint8Array(MROWS * MCOLS);
    const parent  = new Int32Array(MROWS * MCOLS).fill(-1);
    const queue   = [startR * MCOLS + startC];
    visited[startR * MCOLS + startC] = 1;
    let endIdx = -1, qHead = 0;
    while (qHead < queue.length) {
      const idx = queue[qHead++];
      const r = (idx / MCOLS) | 0, c = idx % MCOLS;
      // Reached the plaza OR an already-laid cobblestone path — done.
      if (idx !== startR * MCOLS + startC &&
          (m[r][c] === T.MARBLE || m[r][c] === T.COBBLESTONE)) {
        endIdx = idx; break;
      }
      for (let d = 0; d < 4; d++) {
        const dr = d === 0 ? 1 : d === 1 ? -1 : 0;
        const dc = d === 2 ? 1 : d === 3 ? -1 : 0;
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr >= MROWS || nc < 0 || nc >= MCOLS) continue;
        const ni = nr * MCOLS + nc;
        if (visited[ni]) continue;
        if (!isPathPassable(nc, nr)) continue;
        visited[ni] = 1;
        parent[ni] = idx;
        queue.push(ni);
      }
    }
    if (endIdx < 0) return null;
    const path = [];
    for (let cur = endIdx; cur >= 0; cur = parent[cur]) {
      path.push([(cur / MCOLS) | 0, cur % MCOLS]);
    }
    return path;
  }
  function layCobble(path) {
    if (!path) return;
    for (const [r, c] of path) {
      // Don't paint over the marble plaza itself — paths stop at its edge.
      if (m[r][c] === GROUND || m[r][c] === DECOR) m[r][c] = T.COBBLESTONE;
    }
  }
  // Lay the four exit corridors first so doors that BFS into one of them
  // naturally merge with the trunk instead of running parallel beside it.
  layCobble(bfsToPlaza(EXIT_ROW,  1));
  layCobble(bfsToPlaza(EXIT_ROW,  MCOLS - 2));
  layCobble(bfsToPlaza(1,         EXIT_COL));
  layCobble(bfsToPlaza(MROWS - 2, EXIT_COL));
  // Then each door — its path will join the nearest exit trunk or marble.
  for (let r = 0; r < MROWS; r++) {
    for (let c = 0; c < MCOLS; c++) {
      const t = m[r][c];
      if (t === T.DOOR || t === T.INN_DOOR || t === T.STORE_DOOR) {
        layCobble(bfsToPlaza(r + 1, c));
      }
    }
  }

  // ─── Decoration against the outside of houses ───────────────────────────
  // For every ground tile adjacent to a WALL, randomly drop a decoration
  // (flowers in the forest, bones in the desert). Tiles next to a door are
  // skipped so doorways stay clear. Run AFTER cobblestone path-laying so the
  // decoration doesn't end up on the road.
  const isWall = (c, r) =>
    r >= 0 && r < MROWS && c >= 0 && c < MCOLS && m[r][c] === T.WALL;
  const isDoor = (c, r) =>
    r >= 0 && r < MROWS && c >= 0 && c < MCOLS &&
    (m[r][c] === T.DOOR || m[r][c] === T.INN_DOOR || m[r][c] === T.STORE_DOOR);
  for (let r = 1; r < MROWS - 1; r++) {
    for (let c = 1; c < MCOLS - 1; c++) {
      if (m[r][c] !== GROUND) continue;
      const adjWall = isWall(c - 1, r) || isWall(c + 1, r) ||
                      isWall(c, r - 1) || isWall(c, r + 1);
      if (!adjWall) continue;
      const adjDoor = isDoor(c - 1, r) || isDoor(c + 1, r) ||
                      isDoor(c, r - 1) || isDoor(c, r + 1);
      if (adjDoor) continue;
      if (Math.random() < 0.55) m[r][c] = DECOR;
    }
  }

  // preserveFloor=true so house interiors aren't sealed as border tiles
  ensureConnectivity(m, true, BORDER);

  return m;
}
