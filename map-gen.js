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
  { id:'forest',    element:null,        border:T.TREE,            ground:T.GRASS,          decoration:T.FLOWER,   accent:T.WATER,       names:FOREST_NAMES, villageName:'Village of the Lost',     enemyTier:0, boss:'lich_boss'      },
  { id:'fire',      element:'fire',      border:T.CACTUS,          ground:T.SAND,           decoration:T.FLOWERING_CACTUS, accent:T.LAVA, names:DESERT_NAMES, villageName:'Oasis of the Damned',     enemyTier:1, boss:'mummy_lord'     },
  { id:'water',     element:'water',     border:T.DEEP_WATER,      ground:T.SAND,           decoration:T.WATER,    accent:T.WATER,       path:T.SAND, names:[
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
  { id:'earth',     element:null,        border:T.MOUNTAIN,        ground:T.SCREE,          decoration:T.MUD,      accent:T.ROCK,        names:[
      'Granite Pass','Boulder Hollow','Quarry Trail','Stoneroot Glen','Slatefall Reach',
      'Earthcrack Maze','Cinder Ridge','Marble Vein','Mudbog Crossing','Tremor Basin',
      'Old Roads','Tumulus Field','Caveborn Path','Sediment Flats','Mossy Crag',
      'Sunken Plateau','Iron Gulch','Echo Canyon','Magmaroot Hollow','Petrified Grove'
    ], villageName:'Stoneheart Burrow',         enemyTier:4, boss:'gaia_colossus'  },
  { id:'air',       element:'wind',      border:T.CLOUDWALL,       ground:T.CLOUD,          decoration:T.CLOUD,    accent:T.WATER,       names:[
      'Skywharf','Cumulus Crossing','Zephyr Vault','Updraft Reach','Drifting Bastion',
      'Thunderhead Pass','Mist-veiled Path','Featherfall Hollow','Cirrus Ribbon','Stratos Spine',
      'Galewall','Wisp Field','Halcyon Reach','Stormthrone Approach','Falcon Roost',
      'Cloudbreak','Sky-stair','High Tundra','Whispering Currents','Aetherwake'
    ], villageName:'Stormcrown Aerie',          enemyTier:5, boss:'wind_djinn'     },
  { id:'lightning', element:null,        border:T.STORM_CLOUD,     ground:T.STORM_GROUND,   decoration:T.ROCK,     accent:T.LAVA,        names:[
      'Sparkfen','Voltaic Plain','Thunderfork Pass','Stormglass Reach','Static Maze',
      'Galvanic Hollow','Arcwire Crossing','Lichtning Field','Tesla Spires','Surge Basin',
      'Brimwire','Ferrum Edge','Crackleway','Boltcaster Ridge','Shockmarsh',
      'Magnet Crag','Glasspowder Plain','Filament Gardens','Plasma Bowl','Coronet'
    ], villageName:'Voltheart Bastion',         enemyTier:6, boss:'storm_lord'     },
  { id:'luminous',  element:'luminous',  border:T.LUMINOUS_CRYSTAL, ground:T.LUMINOUS_FLOOR, decoration:T.MUSHROOM, accent:T.WATER, names:[
      'Sunhalo Reach','Dawnlit Field','Prism Garden','Goldenmoss Hollow','Halo Pass',
      'Bright Causeway','Aureate Steps','Lambent Glade','Daystar Crossing','Lustrous Vault',
      'Beacon Plain','Argent Maze','Lumenrise','Suncast Ridge','Mirrorbright Atrium',
      'Effulgent Brook','Coronal Field','Glimmerwash','Radiant Apse','Shining Sanctum'
    ], villageName:'Solarspire Sanctum',        enemyTier:7, boss:'seraph_judge'   },
  { id:'necrotic',  element:'necrotic',  border:T.BLIGHTED_WALL,   ground:T.BLIGHT,         decoration:T.BONES,    accent:T.LAVA,        names:[
      'Witherfen','Boneyard Crossing','Pall Glade','Hollow Reach','Decay Plain',
      'Shroudwood','Mourner\'s Pass','Cinderash Field','Gravesong Maze','Black Marrow',
      'Pall-veiled Ruins','Tomb-iron Reach','Carrion Flats','Sepulchre Trail','Funeral Causeway',
      'Witch-light Hollow','Coffinroot','Wraithmire','Reliquary Ribs','Last Rites Plain'
    ], villageName:'Ossuary of the Pale King',  enemyTier:8, boss:'death_knight'   },
  { id:'poison',    element:'poison',    border:T.POISON_WALL,     ground:T.SLUDGE,         decoration:T.MUSHROOM, accent:T.DEEP_WATER,  names:[
      'Venomvale','Toxic Bog','Spore Pass','Mireheart','Slime Reach',
      'Acidlake Crossing','Foulweed Hollow','Plague Trail','Hexbog Maze','Murkfen',
      'Rotwood Edge','Stagnant Causeway','Bilegrove','Cankerstump','Pestilent Field',
      'Snake-fang Hollow','Greenfog Reach','Necrosis Plain','Bubble Marsh','Witherwart'
    ], villageName:'Mire-warden Citadel',       enemyTier:9, boss:'hydra_queen'    },
  { id:'mana',      element:null,        border:T.MANA_CRYSTAL,    ground:T.MANA_FLOOR,     decoration:T.FLOWER, accent:T.DEEP_WATER, names:[
      'Arcanum Reach','Spellwell Plain','Sigil Garden','Channeled Pass','Aether Field',
      'Glyphvein Maze','Lifeweave Hollow','Runestone Crossing','Conduit Spire','Resonant Bowl',
      'Astral Causeway','Mage-glass Plateau','Echo Lattice','Filigree Field','Mantra Plain',
      'Distortion Reach','Astral Wash','Crystal Choir','Theurgy Trail','Heartmoon'
    ], villageName:'Heartstone Conclave',       enemyTier:10, boss:'archmage_void'  },
];

// Quick lookup helper.
function regionById(id) { return REGIONS.find(r => r.id === id) || REGIONS[0]; }

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
      if (footR > 0 && footR < MROWS - 1 && Math.random() < 0.25 &&
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
      if (footC > 0 && footC < MCOLS - 1 && Math.random() < 0.25 &&
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
// seed, converting SCREE only (so the dirt PATH, walls, structures, and decor are
// never touched). Picks a random frontier cell each step so the blob spreads into a
// rounded bog rather than a line. MUD is passable, so this never affects connectivity.
function growMudClump(m, size) {
  const NB4 = [[1,0],[-1,0],[0,1],[0,-1]];
  let sr = -1, sc = -1;
  for (let t = 0; t < 200; t++) {
    const r = rnd(3, MROWS - 4), c = rnd(3, MCOLS - 4);
    if (m[r][c] === T.SCREE) { sr = r; sc = c; break; }
  }
  if (sr < 0) return 0;
  m[sr][sc] = T.MUD;
  let placed = 1;
  const frontier = [[sr, sc]];
  while (placed < size && frontier.length) {
    const fi = Math.floor(Math.random() * frontier.length);
    const [r, c] = frontier[fi];
    const opts = [];
    for (const [dr, dc] of NB4) {
      const nr = r + dr, nc = c + dc;
      if (nr > 0 && nr < MROWS - 1 && nc > 0 && nc < MCOLS - 1 && m[nr][nc] === T.SCREE) opts.push([nr, nc]);
    }
    if (!opts.length) { frontier.splice(fi, 1); continue; }   // dead end — retire this cell
    const [nr, nc] = opts[Math.floor(Math.random() * opts.length)];
    m[nr][nc] = T.MUD; placed++;
    frontier.push([nr, nc]);
  }
  return placed;
}

// ─── Earth region: cave entrances ────────────────────────────────────────────
// Set 1d6 tunnel mouths into the rock walls — each a CAVE_ENTRANCE replacing a
// solid MOUNTAIN/CLIFF tile that backs onto open ground, so the hero can walk
// straight off the trail into the cliffside (stepping in drops them into a hidden
// 1d6-level cave chain, exactly like a bombed-open tunnel). Run AFTER
// ensureConnectivity so the seal can't wall the mouths back up: CAVE_ENTRANCE is
// passable, and placing each against already-reachable open ground (PATH/SCREE/MUD)
// keeps every mouth reachable. Mouths are spread out (min Manhattan gap) so they
// don't cluster.
// No-op for every other region.
function addEarthCaveEntrances(m, regionId) {
  if (regionId !== 'earth') return;
  const NB4 = [[1,0],[-1,0],[0,1],[0,-1]];
  const isWallRock  = (t) => t === T.MOUNTAIN || t === T.CLIFF;
  const isOpenFloor = (t) => t === T.PATH || t === T.MUD || t === T.SCREE;
  const cands = [];
  for (let r = 2; r < MROWS - 2; r++)
    for (let c = 2; c < MCOLS - 2; c++) {
      if (!isWallRock(m[r][c])) continue;
      for (const [dr, dc] of NB4)
        if (isOpenFloor(m[r + dr][c + dc])) { cands.push([r, c]); break; }
    }
  if (!cands.length) return;
  for (let i = cands.length - 1; i > 0; i--) {        // Fisher–Yates shuffle
    const k = Math.floor(Math.random() * (i + 1));
    const tmp = cands[i]; cands[i] = cands[k]; cands[k] = tmp;
  }
  const want = rnd(1, 6);
  const MIN_GAP = 12;
  const placed = [];
  for (const [r, c] of cands) {
    if (placed.length >= want) break;
    if (placed.some(([pr, pc]) => Math.abs(pr - r) + Math.abs(pc - c) < MIN_GAP)) continue;
    m[r][c] = T.CAVE_ENTRANCE;
    placed.push([r, c]);
  }
}

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

  // Phase 10: streams — winding water channels that cross the whole map, each
  // spanned by one or two plank bridges so both banks stay reachable. Count is
  // 1d4-1 (0–3 per map). Placed before the exit re-carve below so the central
  // corridors ford any stream they cross.
  const streamCount = rnd(1, 4) - 1;
  for (let i = 0; i < streamCount; i++) {
    const cells = Math.random() < 0.5
      ? carveStream(m, rnd(15, MROWS - 16), 1,                 rnd(15, MROWS - 16), MCOLS - 2, 1)  // W→E
      : carveStream(m, 1,                   rnd(15, MCOLS - 16), MROWS - 2,          rnd(15, MCOLS - 16), 1); // N→S
    if (cells.length > 6) {
      bridgeStream(m, cells, Math.floor(cells.length / 2));
      if (cells.length > 40) bridgeStream(m, cells, Math.floor(cells.length / 4));
    }
  }

  // Phase 11: waterfalls — a source pool at the very top of the map spills down
  // a vertical waterfall into a splash pool, and a stream carries that water to
  // the central walking-path network (joined by a short dirt spur so the water
  // visibly meets a path). Count is 1d4-1 (0–3 per map).
  const waterfallCount = rnd(1, 4) - 1;
  for (let i = 0; i < waterfallCount; i++) {
    // Column well clear of the north exit gate and the side borders.
    let wc = rnd(12, MCOLS - 13);
    if (Math.abs(wc - EXIT_COL) < 7) wc += (wc < EXIT_COL ? -7 : 7);
    wc = Math.max(6, Math.min(MCOLS - 7, wc));

    // Source pool hugging the top edge (the "pool of water at the top").
    setRect(m, 1, wc - 2, 3, wc + 2, T.WATER);
    // The falling water — a 3-wide vertical band of WATERFALL tiles.
    const fallBottom = rnd(10, 20);
    for (let r = 4; r <= fallBottom; r++)
      for (let c = wc - 1; c <= wc + 1; c++)
        if (!isProtectedFeature(m[r][c])) m[r][c] = T.WATERFALL;
    // Splash pool at the base — a WATER ring around a DEEP_WATER centre.
    const pr = fallBottom + 1;
    setRect(m, pr, wc - 3, pr + 3, wc + 3, T.WATER);
    setRect(m, pr + 1, wc - 1, pr + 2, wc + 1, T.DEEP_WATER);
    // Connecting stream from the splash pool to the central path, plus a short
    // dirt spur that joins the water to the path and bridges to keep it crossable.
    const link = carveStream(m, pr + 3, wc, EXIT_ROW, EXIT_COL, 0);
    if (link.length) {
      const [lr, lc] = link[link.length - 1];
      drunkWalk(m, lr, lc, EXIT_ROW, EXIT_COL, T.PATH, 0);
      bridgeStream(m, link, Math.floor(link.length / 2));
      if (link.length > 40) bridgeStream(m, link, Math.floor(link.length / 4));
    }

    // 99% of the time, conceal a doorway behind the rushing water at the very
    // bottom of the falls. The door tile renders like the waterfall itself (so
    // it's unseen) apart from a faint glow — the only hint it's there. No path
    // is carved to it: the hero reaches it by swimming the medium-water splash
    // pool behind the curtain. ensureConnectivity counts medium water as
    // traversable, so the door still validates as reachable.
    if (Math.random() < 0.99) {
      m[fallBottom][wc] = T.WATERFALL_DOOR;
    }
  }

  // Phase 12: cliff faces along the map edges — solid rock bands hugging a
  // random border with a clear gap at the exit gate. Count is 1d4-1 (0–3).
  const cliffCount = rnd(1, 4) - 1;
  for (let i = 0; i < cliffCount; i++) addCliffFace(m);

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

  // Forest is outside the water region, so it carries no deep/standing water:
  // demote every WATER/DEEP_WATER tile (pond rims, streams, waterfall pools) to
  // MEDIUM_WATER. Run after all stream/bridge carving (those scan for T.WATER) so
  // bridges land first; WATERFALL falling tiles are left alone.
  demoteWaterToMedium(m);

  // Make sure every plank bridge lands on solid ground at both ends.
  anchorBridgesOnLand(m);

  // Guarantee everything passable is reachable from at least one exit
  ensureConnectivity(m);

  // Maybe spawn a lone whirlpool far out in open medium water (~30% of maps).
  placeWhirlpool(m);

  return m;
}

// ─── Desert water pool ───────────────────────────────────────────────────────
// A small still pool (4×4 … 10×10 of WATER) ringed by exactly one tile of GRASS,
// set into a SAND plaza so the green ring always sits on passable ground. A SAND
// access corridor is carved from the pool back to map centre so the ring is
// guaranteed reachable (the WATER itself stays solid — the player walks the rim).
function addDesertPool(m, midR, midC) {
  const w = rnd(4, 10), h = rnd(4, 10);
  const r0 = rnd(8, MROWS - h - 9);
  const c0 = rnd(8, MCOLS - w - 9);
  const r1 = r0 + h - 1, c1 = c0 + w - 1;
  // SAND plaza (water + grass ring + 1 tile margin) so nothing walls the rim in
  setRect(m, r0 - 2, c0 - 2, r1 + 2, c1 + 2, T.SAND);
  // 1-tile GRASS ring hugging the water
  setRect(m, r0 - 1, c0 - 1, r1 + 1, c1 + 1, T.GRASS);
  // the pool itself
  setRect(m, r0, c0, r1, c1, T.WATER);
  // guarantee accessibility — a SAND corridor from just below the plaza to centre
  drunkWalk(m, r1 + 2, Math.floor((c0 + c1) / 2), midR, midC, T.SAND, 1);
}

// Carve a 3-wide CLIMB ramp straight through a horizontal PLATEAU band at column
// `cc`, with a SAND lip one tile past each face so the ramp meets open ground on
// both sides. Used so a north/south path can cross the plateau.
function carveClimbV(m, r0, thick, cc) {
  for (let dr = -1; dr <= thick; dr++) {
    const r = r0 + dr;
    if (r <= 0 || r >= MROWS - 1) continue;
    for (let dc = -1; dc <= 1; dc++) {
      const c = cc + dc;
      if (c <= 0 || c >= MCOLS - 1 || isProtectedFeature(m[r][c])) continue;
      m[r][c] = (dr < 0 || dr >= thick) ? T.SAND : T.CLIMB;
    }
  }
}

// Carve a 3-wide CLIMB ramp through a vertical PLATEAU band at row `rr`.
function carveClimbH(m, c0, thick, rr) {
  for (let dc = -1; dc <= thick; dc++) {
    const c = c0 + dc;
    if (c <= 0 || c >= MCOLS - 1) continue;
    for (let dr = -1; dr <= 1; dr++) {
      const r = rr + dr;
      if (r <= 0 || r >= MROWS - 1 || isProtectedFeature(m[r][c])) continue;
      m[r][c] = (dc < 0 || dc >= thick) ? T.SAND : T.CLIMB;
    }
  }
}

// Stamp one solid PLATEAU band spanning the map edge-to-edge (a horizontal band
// touching the left+right borders, or a vertical band touching top+bottom), then
// cut CLIMB ramps through it so paths can still cross. The band is kept wholly to
// one side of the perpendicular exit axis so it never swallows that edge's exit
// corridor — the crossing on the axis it *does* block is restored by a climb.
function addDesertPlateau(m) {
  const thick = rnd(5, 10);
  // A mesa must never bisect an oasis, so reject any candidate band footprint
  // (rows for a horizontal band, columns for a vertical one) that overlaps
  // OASIS_WATER. Oases are small and rare, so a clear strip is found quickly.
  const bandHitsOasis = (horiz, p0) => {
    for (let d = 0; d < thick; d++) {
      const p = p0 + d;
      if (horiz) {
        if (p <= 0 || p >= MROWS - 1) continue;
        for (let c = 1; c < MCOLS - 1; c++) if (m[p][c] === T.OASIS_WATER) return true;
      } else {
        if (p <= 0 || p >= MCOLS - 1) continue;
        for (let r = 1; r < MROWS - 1; r++) if (m[r][p] === T.OASIS_WATER) return true;
      }
    }
    return false;
  };
  if (Math.random() < 0.5) {
    // Horizontal band: pick a row entirely above OR below the E/W exit corridor.
    let r0 = 0;
    for (let tries = 0; tries < 16; tries++) {
      r0 = (Math.random() < 0.5)
        ? rnd(8, EXIT_ROW - thick - 5)
        : rnd(EXIT_ROW + 5, MROWS - thick - 8);
      if (!bandHitsOasis(true, r0)) break;
    }
    // BEFORE stamping, record every column where a walking PATH crosses the band
    // footprint (plus the lip on each face) so each ramp lands exactly on the
    // path the player is already following — keeping climbs and walks aligned.
    const cols = new Set();
    for (let c = 1; c < MCOLS - 1; c++)
      for (let dr = -1; dr <= thick; dr++) {
        const r = r0 + dr;
        if (r > 0 && r < MROWS - 1 && m[r][c] === T.PATH) { cols.add(c); break; }
      }
    for (let c = 1; c < MCOLS - 1; c++)
      for (let dr = 0; dr < thick; dr++) {
        const r = r0 + dr;
        const t = m[r][c];
        if (isProtectedFeature(t) || t === T.WATER || t === T.OASIS_WATER ||
            t === T.CLIMB) continue;
        m[r][c] = T.PLATEAU;
      }
    // Fallback: a band no path happened to cross still needs a way through, or
    // ensureConnectivity would seal off the far side.
    if (cols.size === 0) { cols.add(EXIT_COL); cols.add(rnd(10, MCOLS - 11)); }
    for (const cc of cols) carveClimbV(m, r0, thick, cc);
  } else {
    // Vertical band: pick a column entirely left OR right of the N/S corridor.
    let c0 = 0;
    for (let tries = 0; tries < 16; tries++) {
      c0 = (Math.random() < 0.5)
        ? rnd(8, EXIT_COL - thick - 5)
        : rnd(EXIT_COL + 5, MCOLS - thick - 8);
      if (!bandHitsOasis(false, c0)) break;
    }
    // Record every row where a walking PATH crosses the band (see above).
    const rows = new Set();
    for (let r = 1; r < MROWS - 1; r++)
      for (let dc = -1; dc <= thick; dc++) {
        const c = c0 + dc;
        if (c > 0 && c < MCOLS - 1 && m[r][c] === T.PATH) { rows.add(r); break; }
      }
    for (let r = 1; r < MROWS - 1; r++)
      for (let dc = 0; dc < thick; dc++) {
        const c = c0 + dc;
        const t = m[r][c];
        if (isProtectedFeature(t) || t === T.WATER || t === T.OASIS_WATER ||
            t === T.CLIMB) continue;
        m[r][c] = T.PLATEAU;
      }
    if (rows.size === 0) { rows.add(EXIT_ROW); rows.add(rnd(10, MROWS - 11)); }
    for (const rr of rows) carveClimbH(m, c0, thick, rr);
  }
}

// Sprinkle a cluster of passable FLOWERING_CACTUS tiles onto the SAND/GRASS
// immediately around a randomly chosen desert water tile (pool or oasis). These
// have 1 HP and are cut down by a sword swing (see doSwordSwing).
function addFloweringCactiNearWater(m, waters) {
  if (!waters.length) return;
  const [wr, wc] = waters[Math.floor(Math.random() * waters.length)];
  // 5× the old 2–4 per cluster. The wider radius + larger try budget give the
  // denser bloom enough open SAND/GRASS around the oasis to actually land.
  const target = rnd(2, 4) * 5;
  let placed = 0;
  for (let tries = 0; tries < 200 && placed < target; tries++) {
    const r = wr + rnd(-4, 4), c = wc + rnd(-4, 4);
    if (r <= 0 || r >= MROWS - 1 || c <= 0 || c >= MCOLS - 1) continue;
    if (m[r][c] === T.SAND || m[r][c] === T.GRASS) {
      m[r][c] = T.FLOWERING_CACTUS;
      placed++;
    }
  }
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

  // Phase 5: oases — small water pools ringed by cacti (0–2 per map)
  const oasisCount = rnd(0, 2);
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

  // Phase 7: bone decorations scattered across sand. (Desert ground is SAND, not
  // GRASS, so seed them onto SAND.) Bones have 1 HP and drop bone meal when cut
  // by a sword swing — see doSwordSwing.
  scatterOn(m, T.BONES, 80, T.SAND);
  // Sparse cacti scattered as obstacles in open sand
  for (let i = 0; i < 120; i++) {
    const rr = rnd(2, MROWS - 3), rc = rnd(2, MCOLS - 3);
    if (m[rr][rc] === T.SAND && Math.random() < 0.5) m[rr][rc] = T.CACTUS;
  }

  // Phase 7b: small grass-ringed water pools (1d4-1 per map). Placed after the
  // rock/cactus scatters so nothing walls in their accessible rim.
  const poolCount = rnd(1, 4) - 1;
  for (let i = 0; i < poolCount; i++) addDesertPool(m, midR, midC);

  // Phase 7c: flowering cacti clustered near desert water (1d4-1 per map). Built
  // from the live water tiles so each cluster hugs an actual pool or oasis.
  const floweringCount = rnd(1, 4) - 1;
  if (floweringCount > 0) {
    const waters = [];
    for (let r = 2; r < MROWS - 2; r++)
      for (let c = 2; c < MCOLS - 2; c++)
        if (m[r][c] === T.WATER || m[r][c] === T.OASIS_WATER) waters.push([r, c]);
    for (let i = 0; i < floweringCount; i++) addFloweringCactiNearWater(m, waters);
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

  // Phase 13: edge-to-edge plateaus (1d4-1 per map). Placed last — after the
  // exit corridors, border lock, and chest — so the solid mesa carves across the
  // finished map and only the CLIMB ramps let paths cross it. ensureConnectivity
  // (next) re-links anything the plateau happened to wall off.
  const plateauCount = rnd(1, 4) - 1;
  for (let i = 0; i < plateauCount; i++) addDesertPlateau(m);

  // Desert is outside the water region: demote its pools and OASIS_WATER to
  // MEDIUM_WATER so no deep/standing water survives here.
  demoteWaterToMedium(m);

  // Make sure every plank bridge lands on solid ground at both ends.
  anchorBridgesOnLand(m);

  ensureConnectivity(m, false, T.CACTUS);

  // Fire region: 20% of desert maps hide a whirlpool in a pool/oasis. The
  // small clearance fits these little water bodies while still keeping the
  // vortex and its 1-tile pull ring fully inside swim-only water, away from
  // the walkable rim.
  placeWhirlpool(m, 0.20, 2);

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
  // Reserve the NW inner-ring house for the fast-travel portal so it never gets
  // a stationary shopkeeper. Its door is excluded from the shop pool below.
  const pl = villagePortalLayout();
  const doors = [];
  for (let r = 0; r < MROWS; r++)
    for (let c = 0; c < MCOLS; c++)
      if (m[r][c] === T.DOOR && !(r === pl.doorR && c === pl.doorC)) doors.push({ r, c });
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
  // The village is now cleared — open the fast-travel portal in the reserved
  // NW house. (Stamped over interior FLOOR, which is already reachable via the
  // house door, so no connectivity re-run is needed.)
  m[pl.portalR][pl.portalC] = T.PORTAL;
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

  // Fast-travel portal — opposite the chest, in the SE corner of the cabin.
  // Step onto it to open the destinations menu (see tryPortalInteraction).
  m[r2 - 2][c2 - 2] = T.PORTAL;

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
  const m = makeTile(MROWS, MCOLS, T.CAVE_WALL);
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
  // A scatter of small chests (1d4) tucked around the chamber, inset one tile
  // from the floor edge so they never abut the ROCK trim.
  placeCaveChests(m, rnd(1, 4), cy - half + 2, cx - half + 2, cy + half - 3, cx + half - 3);
  return m;
}

// ─── Cave-chain level (full-sized labyrinth) ─────────────────────────────────
// One level of the universal hidden cave system (reached by bombing a rock or
// stepping behind a waterfall), built on the full 150×150 grid: a labyrinth of
// narrow CAVE_FLOOR tunnels carved out of solid rock by a recursive-backtracker
// maze. Two transitions sit at the midpoints of two randomly chosen edges
// (top/bottom/left/right): the way back (CAVE_EXIT) you arrived through, and — on
// non-final levels — a passage deeper (CAVE_DESCENT) on a different edge, so the
// hero must thread the maze from one to the other. The final level swaps the
// deeper passage for the reward: a large chest in a small chamber at the heart of
// the labyrinth. Returns the tiles plus the inner landing tile beside each
// transition, so arrivals stand just inside, never on a trigger.

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

// Carve a recursive-backtracker maze of CAVE_FLOOR tunnels into the solid-rock
// map `m`, filling the interior inside `margin`. Each cell carves a room of a
// random 3–6-tile size and links to its tree neighbours with a corridor as wide
// as the narrower of the two rooms, so the tunnels bulge and pinch between 3 and
// 6 wide. The cell pitch leaves a ≥2-tile rock wall between unlinked parallel
// corridors, so they never merge by accident. The maze is a single fully-
// connected spanning tree — every carved tile can reach every other.
function carveCaveMaze(m, margin) {
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
    setRect(m, R, C, R + s - 1, C + s - 1, T.CAVE_FLOOR);
  };
  // Carve a corridor joining linked cells A and B — width = min of their rooms,
  // aligned to the shared top (horizontal link) or left (vertical link) edge.
  const link = (ar, ac, br, bc) => {
    const sA = sizes[ar * cols + ac], sB = sizes[br * cols + bc], lw = Math.min(sA, sB);
    const RA = cellR(ar), CA = cellC(ac), RB = cellR(br), CB = cellC(bc);
    if (ar === br) setRect(m, RA, Math.min(CA, CB), RA + lw - 1, Math.max(CA + sA, CB + sB) - 1, T.CAVE_FLOOR);
    else           setRect(m, Math.min(RA, RB), CA, Math.max(RA + sA, RB + sB) - 1, CA + lw - 1, T.CAVE_FLOOR);
  };
  const visited = new Uint8Array(rows * cols);
  const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
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
    stack.push([nr, nc]);
  }
}

// Open a few large chambers across the labyrinth — combat arenas and breathers
// from the tight tunnels. Each is carved straight onto the floor so it overlaps
// the surrounding corridors and stays part of the connected network.
function carveCaveChambers(m, margin, count) {
  for (let i = 0; i < count; i++) {
    const w = rnd(8, 14), h = rnd(8, 14);
    const r = rnd(margin + 2, MROWS - margin - 3 - h);
    const c = rnd(margin + 2, MCOLS - margin - 3 - w);
    setRect(m, r, c, r + h, c + w, T.CAVE_FLOOR);
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
function carveCaveStub(m, tr, tc, dr, dc) {
  let r = tr, c = tc;
  for (let i = 0; i < 12; i++) {
    for (let w = -1; w <= 1; w++) {
      const rr = r + (dc !== 0 ? w : 0);
      const cc = c + (dr !== 0 ? w : 0);
      if (rr > 0 && rr < MROWS - 1 && cc > 0 && cc < MCOLS - 1) m[rr][cc] = T.CAVE_FLOOR;
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
function placeCaveChests(m, count, r0, c0, r1, c1) {
  for (let i = 0; i < count; i++) {
    for (let t = 0; t < 200; t++) {
      const r = rnd(r0, r1), c = rnd(c0, c1);
      if (m[r][c] !== T.CAVE_FLOOR) continue;
      if (m[r - 1][c] !== T.CAVE_FLOOR || m[r + 1][c] !== T.CAVE_FLOOR ||
          m[r][c - 1] !== T.CAVE_FLOOR || m[r][c + 1] !== T.CAVE_FLOOR) continue;
      m[r][c] = T.CHEST;
      break;
    }
  }
}

function buildCaveLevelMap(isFinal) {
  const m = makeTile(MROWS, MCOLS, T.CAVE_WALL);
  const cx = Math.floor(MCOLS / 2), cy = Math.floor(MROWS / 2);
  const margin = 4;                                  // solid rock rim

  // Carve the labyrinth of wide (3–6) winding tunnels across the whole interior.
  carveCaveMaze(m, margin);

  // A handful of larger chambers open up the tunnels here and there.
  carveCaveChambers(m, margin, rnd(2, 4));

  // Occasional pools of water — 1d4-1 per map (0–3).
  carveCavePools(m, margin, rnd(1, 4) - 1);

  // Scatter a little torchlight through the tunnels (passable, just ambience).
  scatterOn(m, T.TORCH, 14, T.CAVE_FLOOR);

  // A small open chamber at the heart of the maze — the prize room on the final
  // level, a breather junction otherwise. It overlaps several maze cells, so it
  // always merges into the connected tunnel network.
  setRect(m, cy - 2, cx - 2, cy + 2, cx + 2, T.CAVE_FLOOR);

  // Two distinct edges: one entrance, one for going deeper (Fisher–Yates pick 2).
  const edges = ['top', 'bottom', 'left', 'right'];
  for (let i = edges.length - 1; i > 0; i--) { const j = rnd(0, i); const t = edges[i]; edges[i] = edges[j]; edges[j] = t; }
  const STEP = { top: [1, 0], bottom: [-1, 0], left: [0, 1], right: [0, -1] };

  const e = caveEdgeSpot(edges[0]);
  carveCaveStub(m, e.tr, e.tc, STEP[edges[0]][0], STEP[edges[0]][1]);
  m[e.tr][e.tc] = T.CAVE_EXIT;
  m[e.lr][e.lc] = T.CAVE_FLOOR;

  let deeperLand = null;
  if (!isFinal) {
    const d = caveEdgeSpot(edges[1]);
    carveCaveStub(m, d.tr, d.tc, STEP[edges[1]][0], STEP[edges[1]][1]);
    m[d.tr][d.tc] = T.CAVE_DESCENT;
    m[d.lr][d.lc] = T.CAVE_FLOOR;
    deeperLand = { x: d.lc, y: d.lr };
  } else {
    m[cy][cx]     = T.LARGE_CHEST;          // the reward at the heart of the deepest cave
    m[cy][cx + 1] = T.LARGE_CHEST_R;
    // Torches flanking the prize chamber.
    m[cy - 2][cx - 2] = T.TORCH; m[cy - 2][cx + 2] = T.TORCH;
    m[cy + 2][cx - 2] = T.TORCH; m[cy + 2][cx + 2] = T.TORCH;
  }

  // Sprinkle 1d4 small chests through the labyrinth. Placed last so the floor
  // check excludes the transitions and (on the final level) the large chest.
  placeCaveChests(m, rnd(1, 4), margin + 1, margin + 1, MROWS - margin - 2, MCOLS - margin - 2);

  return { map: m, entryLand: { x: e.lc, y: e.lr }, deeperLand };
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
      if (Math.random() < 0.65) {                 // bias toward the far point
        if (Math.abs(er - r) > Math.abs(ec - c)) mr = Math.sign(er - r);
        else                                     mc = Math.sign(ec - c);
      } else {                                     // occasional meander
        if (Math.random() < 0.5) mr = (Math.random() < 0.5 ? 1 : -1);
        else                     mc = (Math.random() < 0.5 ? 1 : -1);
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

// Palette-swap of buildDesertMap for the seven later elemental regions (water,
// ice, earth, air, lightning, luminous, necrotic, poison, mana). Takes a
// region object from REGIONS — that supplies border/ground/decoration/accent
// tiles and everything else here is identical structure to the desert builder.
function buildRegionMap(seed, depth, openSides, region) {
  const open = openSides || { left: true, right: true, up: true, down: true };
  const BORDER = region.border, GROUND = region.ground;
  const DECOR = region.decoration, ACCENT = region.accent;
  // Region-specific corridor tile. Defaults to the dirt PATH; the water region
  // overrides this with SHALLOW_WATER so its paths read as a wadeable channel.
  const PATHTILE = region.path || T.PATH;
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
  if (open.up)    drunkWalk(m, midR, midC, 1,         EXIT_COL,   PATHTILE, 1);
  if (open.down)  drunkWalk(m, midR, midC, MROWS - 2, EXIT_COL,   PATHTILE, 1);
  if (open.left)  drunkWalk(m, midR, midC, EXIT_ROW,  1,          PATHTILE, 1);
  if (open.right) drunkWalk(m, midR, midC, EXIT_ROW,  MCOLS - 2,  PATHTILE, 1);
  // Secondary connector paths. Every region but water links them with plain
  // GROUND here; the water region instead carves its secondary routes as
  // SHALLOW_WATER channels later (after the depth banding) so they wade through
  // the water rather than paving more sand.
  if (region.id !== 'water') {
    for (let i = 0; i < 6; i++) {
      const r1 = rnd(10, MROWS - 10), c1 = rnd(10, MCOLS - 10);
      const r2 = rnd(10, MROWS - 10), c2 = rnd(10, MCOLS - 10);
      drunkWalk(m, r1, c1, r2, c2, GROUND, 1);
    }
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

  // Earth region: rough up the map into mountain terrain (rocky cliff bands, mud,
  // talus) before the exit corridors are re-cut through it. No-op elsewhere.
  addMountainTerrain(m, region.id);

  // Ensure exit corridors reach interior
  cutExits(m, open.left, open.right, open.up, open.down);
  if (open.left)  drunkWalk(m, EXIT_ROW, 1,           EXIT_ROW, midC,    PATHTILE, 1);
  if (open.right) drunkWalk(m, EXIT_ROW, MCOLS - 2,   EXIT_ROW, midC,    PATHTILE, 1);
  if (open.up)    drunkWalk(m, 1,           EXIT_COL, midR,     EXIT_COL, PATHTILE, 1);
  if (open.down)  drunkWalk(m, MROWS - 2,   EXIT_COL, midR,     EXIT_COL, PATHTILE, 1);

  // Final border lock + re-cut exits
  for (let c = 0; c < MCOLS; c++) { m[0][c] = BORDER; m[MROWS - 1][c] = BORDER; }
  for (let r = 0; r < MROWS; r++) { m[r][0] = BORDER; m[r][MCOLS - 1] = BORDER; }
  cutExits(m, open.left, open.right, open.up, open.down);

  // cutExits always stamps the border gates with dirt T.PATH. When the region
  // uses a custom corridor tile (e.g. shallow water), repaint those gate tiles
  // to match so the channel runs unbroken to the map edge.
  if (PATHTILE !== T.PATH) {
    for (let r = 0; r < MROWS; r++)
      for (let c = 0; c < MCOLS; c++)
        if (m[r][c] === T.PATH) m[r][c] = PATHTILE;
  }

  // Occasional dry stretches: where the corridor tile is meant to be wadeable
  // water, sprinkle small dry blobs (region.pathDry, e.g. sand bars) so the
  // channel isn't an unbroken ribbon of water. Both tiles stay passable, so
  // connectivity is unaffected.
  if (region.pathDry !== undefined && PATHTILE !== region.pathDry) {
    const dryBlobs = 14 + Math.floor(depth / 3);
    for (let i = 0; i < dryBlobs; i++) {
      const rr = rnd(3, MROWS - 4), rc = rnd(3, MCOLS - 4);
      if (m[rr][rc] !== PATHTILE) continue;            // only break up the path
      const bw = rnd(1, 3), bh = rnd(1, 2);
      for (let dr = 0; dr <= bh; dr++)
        for (let dc = 0; dc <= bw; dc++) {
          const nr = rr + dr, nc = rc + dc;
          if (nr > 0 && nr < MROWS - 1 && nc > 0 && nc < MCOLS - 1 &&
              m[nr][nc] === PATHTILE) m[nr][nc] = region.pathDry;
        }
    }
  }

  if (chestSpot) m[chestSpot.r][chestSpot.c] = T.CHEST;

  // Water region: shelve the open water out from the sand into shallow → medium
  // → deep bands, then carve the SHALLOW_WATER secondary channels across it. Run
  // before connectivity so it sees SHALLOW as walkable and MEDIUM/DEEP as walls.
  if (region.id === 'water') {
    applyWaterDepthBands(m);
    carveShallowChannels(m, 6);
    // Strew bombable ROCK boulders across the beaches/sandbars. The generic
    // Phase-5 scatter rarely lands here (the map is mostly water), so add a
    // dedicated pass on SAND. Solid, so it runs BEFORE ensureConnectivity below
    // re-validates the layout — single boulders on the wide bars never wall it off.
    scatterOn(m, T.ROCK, 60, T.SAND);
  } else if (region.id === 'ice') {
    // Ice region: its standing water is frozen solid — accent pools become
    // walkable, slippery ICE sheets instead of swimmable medium water.
    freezeWaterToIce(m);
  } else {
    // Every other region is outside the water region, so it keeps no deep/
    // standing water — demote its accent pools (WATER, DEEP_WATER for poison/
    // mana, etc.) to MEDIUM_WATER.
    demoteWaterToMedium(m);
  }

  // Make sure every plank bridge lands on solid ground at both ends (run after
  // the water banding so it sees the final shallow/medium/deep tiles).
  anchorBridgesOnLand(m);

  // Seal any orphan passable pockets with the region's border tile so the
  // visual matches the surrounding wall instead of leaking forest TREE. Rescue
  // corridors use the region's corridor tile so they blend in too.
  ensureConnectivity(m, false, BORDER, PATHTILE);

  // Earth region: cut 1d6 cave-entrance tunnels into the rock walls. Done AFTER
  // the seal (CAVE_ENTRANCE is passable, so the seal would otherwise wall stray
  // ones back up) and against already-reachable ground so every mouth is usable.
  addEarthCaveEntrances(m, region.id);

  // Earth region: churn boggy MUD clumps (9–30 tiles) into the trails — each one
  // slows the hero to half speed. After the seal so clumps stay whole (see above).
  addMudBogs(m, region.id);

  // Ice region: 1d4 frozen streams winding edge-to-edge across the map (W→E or
  // N→S, like the forest's water channels), stamped straight as walkable ICE.
  // Carved AFTER ensureConnectivity on purpose: ICE is passable, so if these ran
  // before the seal, any stretch threading through the solid glacier that the
  // exit flood can't reach would be sealed back to glacier (the streams would
  // vanish). Carving after instead only ADDS walkable ice — it can never orphan
  // existing terrain — and the streams reconnect themselves where they cross the
  // central corridors. carveStream skips protected structures (chests, shrines,
  // doors), so nothing important is paved over.
  if (region.id === 'ice') {
    const iceStreamCount = rnd(1, 4);
    for (let i = 0; i < iceStreamCount; i++) {
      if (Math.random() < 0.5)
        carveStream(m, rnd(15, MROWS - 16), 1,                  rnd(15, MROWS - 16), MCOLS - 2, 1, T.ICE);  // W→E
      else
        carveStream(m, 1,                   rnd(15, MCOLS - 16), MROWS - 2,          rnd(15, MCOLS - 16), 1, T.ICE); // N→S
    }
  }

  // Ice region: dress the glacier walls with snow-covered pines so the border
  // reads as a frozen treeline rather than bare ice cliffs. Runs after the
  // connectivity seal so sealed pockets get trees too. SNOW_PINE is solid like
  // GLACIER, so traversal is unaffected.
  sprinkleSnowPines(m, region.id);

  // Ice region: drift fields — deep powder banks mirroring the desert's dune
  // fields. Converts open SNOW only (both passable), so connectivity holds.
  addSnowDrifts(m, region.id, depth);

  // Ice region: wintry foliage on the open snow — winter berry bushes and frost
  // lilies. Runs after the drifts so it seeds onto the remaining plain snow.
  scatterWinterFoliage(m, region.id);

  // Water region: beach finds scattered on the open sand — stones, seashells,
  // and coral. Runs after the water banding so it seeds onto the final sand.
  scatterWaterFoliage(m, region.id);

  // Earth region: hardy mountain growth on the open scree — sage shrubs, moss
  // clumps, and amethyst crystal clusters. Runs after the mud bogs so it seeds
  // onto the remaining plain scree, not the bog clumps.
  scatterEarthFoliage(m, region.id);

  // Maybe spawn a lone whirlpool far out in open medium water (~30% of maps).
  placeWhirlpool(m);

  return m;
}

// Drift fields for ice maps — same shape as the desert's Phase-4 dune fields:
// a handful of square patches where open SNOW piles up into SNOW_DRIFT banks
// (passable, but trudging through one halves walk speed). No-op for every
// other region.
function addSnowDrifts(m, regionId, depth) {
  if (regionId !== 'ice') return;
  const driftCount = 6 + Math.floor(depth / 2);
  for (let i = 0; i < driftCount; i++) {
    const wr = rnd(10, MROWS - 15), wc = rnd(10, MCOLS - 15);
    const ws = rnd(4, 10);
    const wr2 = Math.min(wr + ws, MROWS - 2), wc2 = Math.min(wc + ws, MCOLS - 2);
    for (let r = wr; r <= wr2; r++) {
      for (let c = wc; c <= wc2; c++) {
        if (m[r][c] === T.SNOW && Math.random() < 0.7) m[r][c] = T.SNOW_DRIFT;
      }
    }
  }
}

// Convert a share of an ice map's GLACIER tiles into SNOW_PINE. No-op for
// every other region.
function sprinkleSnowPines(m, regionId, chance = 0.45) {
  if (regionId !== 'ice') return;
  for (let r = 0; r < MROWS; r++)
    for (let c = 0; c < MCOLS; c++)
      if (m[r][c] === T.GLACIER && Math.random() < chance) m[r][c] = T.SNOW_PINE;
}

// Ice region: scatter wintry natural growth across the open snowfields — winter
// berry bushes (cut for winter berries) and frost lilies (cut for frost petals).
// Both seed onto open SNOW only, so paths, ice sheets, drifts, and placed
// structures are left untouched; both are passable 1-HP foliage, so connectivity
// is unaffected. No-op for every other region.
function scatterWinterFoliage(m, regionId) {
  if (regionId !== 'ice') return;
  scatterOn(m, T.WINTER_BERRY_BUSH, 70, T.SNOW);
  scatterOn(m, T.FROST_LILY, 55, T.SNOW);
}

// Water region: scatter beach finds across the open sand — clusters of stones
// (cut for stone shards), seashells, and coral fragments. Seeds onto open SAND
// only (the region's walkable land/bars), so deep/shallow water and placed
// structures are left untouched; all are passable 1-HP foliage, so connectivity
// is unaffected. No-op for every other region.
function scatterWaterFoliage(m, regionId) {
  if (regionId !== 'water') return;
  scatterOn(m, T.STONES, 60, T.SAND);
  scatterOn(m, T.SEASHELL, 55, T.SAND);
  scatterOn(m, T.CORAL, 45, T.SAND);
}

// Earth region: scatter hardy mountain growth across the open scree slopes —
// sage shrubs (cut for sage), moss clumps (cut for moss), and amethyst crystal
// clusters (cut for crystals). Seeds onto open SCREE only (the region's walkable
// ground off the dirt trails), so paths, mud bogs, talus rock, and placed
// structures are left untouched; all are passable 1-HP foliage that revert to
// SCREE when cut, so connectivity is unaffected. No-op for every other region.
function scatterEarthFoliage(m, regionId) {
  if (regionId !== 'earth') return;
  scatterOn(m, T.MOUNTAIN_SAGE, 60, T.SCREE);
  scatterOn(m, T.MOSS_CLUMP, 60, T.SCREE);
  scatterOn(m, T.CRYSTAL_CLUSTER, 40, T.SCREE);
}

// ─── Water village flooding ──────────────────────────────────────────────────
// The water region's boss village (Tideborn Refuge) is a tidal settlement: most
// of its open ground is wadeable SHALLOW_WATER, with dry SAND only where the
// player actually needs it — a 3-tile sand margin hugging every COBBLESTONE road
// and a 1-tile sand ring around every house wall. House interiors never flood.
//
// Runs after the cobblestone roads and house exteriors are finished (so the
// distance-to-road field is final) and before ensureConnectivity — SHALLOW and
// SAND are both passable, so connectivity is unaffected. Targets ~80% of the
// open village ground as shallow water; the protected sand bands plus any surplus
// dry tiles (kept as the fringe nearest the roads) make up the other ~20%, so the
// water pools out in the open middle of the plaza rather than against the houses.
function floodWaterVillage(m) {
  const SAND_BAND = 3;          // sand tiles kept alongside every cobble road
  const TARGET_WATER = 0.80;    // share of open ground that becomes shallow water
  const NB = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];

  // The flood only touches the open village ground (the SAND laid over the old
  // dirt plaza). Roads (COBBLESTONE), the marble plaza, houses, the fountain, and
  // every placed structure are left exactly as they are.
  const isGround = (r, c) => m[r][c] === T.SAND;

  // Multi-source BFS giving each tile its 8-connected (Chebyshev) ring distance
  // to the nearest COBBLESTONE road. Seeds at distance 0 on every cobble tile.
  const INF = 32767;
  const cobDist = new Int16Array(MROWS * MCOLS).fill(INF);
  const queue = [];
  for (let r = 0; r < MROWS; r++)
    for (let c = 0; c < MCOLS; c++)
      if (m[r][c] === T.COBBLESTONE) { cobDist[r * MCOLS + c] = 0; queue.push(r * MCOLS + c); }
  for (let head = 0; head < queue.length; head++) {
    const idx = queue[head];
    const r = (idx / MCOLS) | 0, c = idx % MCOLS, d = cobDist[idx];
    for (const [dr, dc] of NB) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= MROWS || nc < 0 || nc >= MCOLS) continue;
      const ni = nr * MCOLS + nc;
      if (cobDist[ni] <= d + 1) continue;
      cobDist[ni] = d + 1;
      queue.push(ni);
    }
  }

  // A ground tile is wall-adjacent if any of its 8 neighbours is a house WALL.
  const nearWall = (r, c) => {
    for (const [dr, dc] of NB) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= MROWS || nc < 0 || nc >= MCOLS) continue;
      if (m[nr][nc] === T.WALL) return true;
    }
    return false;
  };

  // Classify every open-ground tile. forcedSand tiles (within the cobble band or
  // hugging a wall) must stay dry; the rest are floodable.
  const free = [];
  let groundCount = 0;
  for (let r = 1; r < MROWS - 1; r++)
    for (let c = 1; c < MCOLS - 1; c++) {
      if (!isGround(r, c)) continue;
      groundCount++;
      if (cobDist[r * MCOLS + c] <= SAND_BAND || nearWall(r, c)) continue;  // forced sand
      free.push(r * MCOLS + c);
    }
  if (!free.length) return;

  // Convert the free tiles farthest from the roads first, so water collects out
  // in the open plaza and the dry fringe sits nearest the cobble. Cap the count
  // so shallow water ends up at ~80% of the open ground.
  free.sort((a, b) => cobDist[b] - cobDist[a]);
  const want = Math.min(free.length, Math.round(TARGET_WATER * groundCount));
  for (let i = 0; i < want; i++) {
    const idx = free[i];
    m[(idx / MCOLS) | 0][idx % MCOLS] = T.SHALLOW_WATER;
  }
}

// ─── Desert village map ─────────────────────────────────────────────────────
// Thin wrapper: the same fixed village layout rendered with a desert palette
// (cactus border, sand ground, flowering-cactus decorations). Used as the boss
// arena at the end of the desert region.
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
  //     each carry 4 houses; the two side houses sit at col 10 / col 123,
  //     kept 2 tiles in from the border-wall ring on each side.
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
  // Outer ring — clear of the E↔W exit corridor at row 75, and kept ≥2 tiles
  // clear of the village's inner border-wall ring on every side (the playfield
  // runs cols/rows 8..141, so the outer houses are pulled in off the wall):
  //   • Top + bottom rows: 4 houses each at cols 10 / 47 / 86 / 123. The two
  //     edge columns sit 2 tiles in from the side wall (houses span 10..26 and
  //     123..139, leaving cols 8–9 and 140–141 as the gap); ~20–22-tile gaps
  //     between adjacent houses. The top row (14) and bottom row (116) already
  //     clear the top/bottom wall by 6 and 13 tiles.
  //   • Side columns 10 and 123: two extra houses each at rows 48 and 82
  //     (21-row gaps from the top, between themselves, and to the bottom).
  //     Both side rows sit clear of row 75, so the W↔E exit corridor reaches
  //     the plaza unobstructed.
  const OUTER_TOP_ROW    = 14;
  const OUTER_BOTTOM_ROW = 116;
  const OUTER_COLS       = [10, 47, 86, 123];  // edge cols 2 tiles in from the wall
  const OUTER_SIDE_ROWS  = [48, 82];           // 21-tile vertical gap on side cols
  const OUTER_SIDE_COLS  = [10, 123];          // side cols, 2 tiles in from the wall
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
  // (flowers in the forest, flowering cacti in the desert). Tiles next to a door are
  // skipped so doorways stay clear. Run AFTER cobblestone path-laying so the
  // decoration doesn't end up on the road.
  const isWall = (c, r) =>
    r >= 0 && r < MROWS && c >= 0 && c < MCOLS && m[r][c] === T.WALL;
  const isDoor = (c, r) =>
    r >= 0 && r < MROWS && c >= 0 && c < MCOLS &&
    (m[r][c] === T.DOOR || m[r][c] === T.INN_DOOR || m[r][c] === T.STORE_DOOR);
  // The water, ice, and earth villages skip this and dress their own exteriors
  // below. The water village's DECOR is solid WATER (which must never hug a house
  // wall: floodWaterVillage keeps the wall ring dry SAND, then a beach-find pass
  // adds coral + seashells). The ice village's DECOR is ICE — removed here in
  // favour of winter foliage hugging the houses, so the ice village carries no ICE
  // at all. The earth village's DECOR is MUD — replaced below with mountain
  // foliage (sage, moss, crystals), so the earth village carries no MUD at all.
  if (regionId !== 'water' && regionId !== 'ice' && regionId !== 'earth') {
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
  }

  // Ice region: dress the snow ring around every house with winter foliage —
  // frost lilies (ice flowers) and winter berry bushes — in place of the ICE tiles
  // the generic pass above would have laid (the ice village carries no ICE). Mirrors
  // that scan: every SNOW tile touching a house WALL gets a chance, skipping tiles
  // next to a door so entrances stay clear. Both are passable 1-HP foliage that
  // revert to SNOW when cut, so connectivity is unaffected.
  if (regionId === 'ice') {
    for (let r = 1; r < MROWS - 1; r++) {
      for (let c = 1; c < MCOLS - 1; c++) {
        if (m[r][c] !== GROUND) continue;   // GROUND === T.SNOW here
        const adjWall = isWall(c - 1, r) || isWall(c + 1, r) ||
                        isWall(c, r - 1) || isWall(c, r + 1);
        if (!adjWall) continue;
        const adjDoor = isDoor(c - 1, r) || isDoor(c + 1, r) ||
                        isDoor(c, r - 1) || isDoor(c, r + 1);
        if (adjDoor) continue;
        if (Math.random() < 0.55) m[r][c] = Math.random() < 0.5 ? T.FROST_LILY : T.WINTER_BERRY_BUSH;
      }
    }
  }

  // Earth region: dress the scree ring around every house with mountain foliage —
  // sage shrubs, moss clumps, and amethyst crystal clusters — in place of the MUD
  // the generic pass above would have laid (the earth village carries no MUD).
  // Mirrors that scan: every SCREE tile touching a house WALL gets a chance,
  // skipping tiles next to a door so entrances stay clear. All three are passable
  // 1-HP foliage that revert to SCREE when cut, so connectivity is unaffected.
  if (regionId === 'earth') {
    for (let r = 1; r < MROWS - 1; r++) {
      for (let c = 1; c < MCOLS - 1; c++) {
        if (m[r][c] !== GROUND) continue;   // GROUND === T.SCREE here
        const adjWall = isWall(c - 1, r) || isWall(c + 1, r) ||
                        isWall(c, r - 1) || isWall(c, r + 1);
        if (!adjWall) continue;
        const adjDoor = isDoor(c - 1, r) || isDoor(c + 1, r) ||
                        isDoor(c, r - 1) || isDoor(c, r + 1);
        if (adjDoor) continue;
        if (Math.random() < 0.55) {
          const roll = Math.random();
          m[r][c] = roll < 0.4 ? T.MOUNTAIN_SAGE : roll < 0.8 ? T.MOSS_CLUMP : T.CRYSTAL_CLUSTER;
        }
      }
    }
  }

  // Water region: flood ~80% of the open village ground to wadeable SHALLOW_WATER,
  // keeping a 3-tile sand margin along the cobble roads and a dry sand ring around
  // every house. Done after the roads/exteriors are final and before connectivity.
  if (regionId === 'water') floodWaterVillage(m);

  // Water region: dress the dry sand ring around every house with beach finds —
  // coral and seashells, the water village's answer to the flowers/cacti that hug
  // forest/desert houses. Mirrors the wall-adjacency scan above (every SAND tile
  // touching a house WALL gets a chance; tiles next to a door are skipped so the
  // entrances stay clear), but runs AFTER floodWaterVillage so the flood can't
  // wash the finds away — the wall ring it keeps dry is exactly what we decorate.
  // CORAL and SEASHELL are passable 1-HP foliage, so connectivity is unaffected.
  if (regionId === 'water') {
    for (let r = 1; r < MROWS - 1; r++) {
      for (let c = 1; c < MCOLS - 1; c++) {
        if (m[r][c] !== GROUND) continue;   // GROUND === T.SAND here
        const adjWall = isWall(c - 1, r) || isWall(c + 1, r) ||
                        isWall(c, r - 1) || isWall(c, r + 1);
        if (!adjWall) continue;
        const adjDoor = isDoor(c - 1, r) || isDoor(c + 1, r) ||
                        isDoor(c, r - 1) || isDoor(c, r + 1);
        if (adjDoor) continue;
        if (Math.random() < 0.55) m[r][c] = Math.random() < 0.5 ? T.CORAL : T.SEASHELL;
      }
    }
  }

  // preserveFloor=true so house interiors aren't sealed as border tiles
  ensureConnectivity(m, true, BORDER);

  // The ice village gets the same snowy treeline as its overworld maps.
  sprinkleSnowPines(m, regionId);

  // Note: the fast-travel portal is NOT placed here. A village only gains a
  // portal once it is cleared of monsters — see activateVillage, which stamps
  // it into the NW inner-ring house at activation time.
  return m;
}

// Layout of the village's portal house — the NW inner-ring house. Coordinates
// mirror buildVillageMap's house grid so activateVillage can reserve that
// house (keep it shopkeeper-free) and stamp the portal once the village is
// cleared.
function villagePortalLayout() {
  const midR = Math.floor(MROWS / 2), midC = Math.floor(MCOLS / 2);
  const hw = 16, hh = 12;
  const HOUSE_W = hw + 1;
  const INNER_GAP = 7;
  const NORTH_ROW  = midR - 14 - hh;                      // 49
  const CENTRE_COL = midC - Math.floor(hw / 2);           // 67
  const WEST_COL   = CENTRE_COL - HOUSE_W - INNER_GAP;    // 43
  return {
    portalR: NORTH_ROW + 4,
    portalC: WEST_COL + Math.floor(hw / 2),
    doorR:   NORTH_ROW + hh,
    doorC:   WEST_COL + Math.floor(hw / 2),
  };
}
