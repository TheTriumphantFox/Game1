// ─── Configuration ────────────────────────────────────────────────────────────
// Tile types, map dimensions, viewport setup, and color palette.
// All other modules import these via the global scope.

const canvas = document.getElementById('c');
// `let` (not const) so the sprite cache can briefly redirect drawing into an
// offscreen canvas while pre-painting tiles, then restore it (see render.js
// buildTileSprite). The swap is fully synchronous, so nothing else ever observes
// the redirected context.
let ctx = canvas.getContext('2d');

const TS = 16;          // tile size in logical px (not actually used for rendering — TILE_PX is)
const MCOLS = 150;
const MROWS = 150;

// Exit gate positions — centre of each border edge
const EXIT_COL = Math.floor(MCOLS / 2);
const EXIT_ROW = Math.floor(MROWS / 2);

// Dynamic viewport — fills the window, recomputed on resize
let TILE_PX = 48;       // rendered pixels per tile (zoom level)
let VCOLS = 1, VROWS = 1, PW = 1, PH = 1;

// Tile type enum. Numeric so we can store maps as Uint8Array for fast (de)serialization.
const T = {
  GRASS:0, TREE:1, WATER:2, PATH:3, WALL:4, FLOOR:5,
  CHEST:6, DOOR:7, ROCK:8, SAND:9, FLOWER:10, DUNGEON_DOOR:11,
  DEEP_WATER:12, LAVA:13, BRIDGE:14, PILLAR:15, TORCH:16, STATUE:17,
  SHRINE:18, MUSHROOM:19, FERN:20,
  CAVE_ENTRANCE:21, CAVE_EXIT:22, LARGE_CHEST:23, CAVE_FLOOR:24,
  INN_DOOR:25, STORE_DOOR:26,
  FOUNTAIN_WATER:27, FOUNTAIN_SPOUT:28, MARBLE:29, COBBLESTONE:30,
  BED:31, TABLE:32, CHAIR:33, FIREPLACE:34,
  CACTUS:35, DUNE:36, OASIS_WATER:37, BONES:38,
  // Multi-tile chest extensions. LARGE_CHEST_R is the right half of the
  // 1×2 large chest (anchor = LARGE_CHEST on its west). BOSS_CHEST_TL is the
  // top-left anchor of the 2×2 boss chest; the other three tiles are its
  // extensions.
  LARGE_CHEST_R:39,
  BOSS_CHEST_TL:40, BOSS_CHEST_TR:41, BOSS_CHEST_BL:42, BOSS_CHEST_BR:43,
  // Third village shop door — the Herbalist (trades ingredients for potions).
  HERB_DOOR:44,
  // Fourth village shop door — the Blacksmith (handles all armor).
  SMITH_DOOR:45,

  // ─── Elemental region tiles (one passable ground + one solid border per
  // elemental region beyond forest/desert). Used by REGIONS in map-gen.js and
  // rendered with their TILE_COLORS fallback unless overridden in render.js.
  SNOW:46, ICE:47, GLACIER:48,                       // ice region
  MUD:49, MOUNTAIN:50,                               // earth region (MOUNTAIN wall; SCREE ground, dirt PATH trails, ROCK accent, MUD bogs)
  CLOUD:51, CLOUDWALL:52,                            // air region
  // Lightning region — built exactly like the air region (a cloud island the
  // hero walks across), but rendered as dark, angry storm clouds. STORM_GROUND
  // is the walkable dark storm-cloud floor (CLOUD's counterpart) and STORM_CLOUD
  // is the solid border: a churning sea of black thunderheads, veined with
  // lightning, surrounding the island (SKY_GROUND's counterpart). STORM_BANK and
  // STORM_EDGE are defined further down with the other late tiles.
  STORM_GROUND:53, STORM_CLOUD:54,                   // lightning region
  LUMINOUS_FLOOR:55, LUMINOUS_CRYSTAL:56,            // luminous region
  BLIGHT:57, BLIGHTED_WALL:58,                       // necrotic region
  SLUDGE:59, POISON_WALL:60,                         // poison region
  MANA_FLOOR:61, MANA_CRYSTAL:62,                    // mana region
  // Cabin fast-travel portal. Step onto it to open the destination menu.
  PORTAL:63,
  SHALLOW_WATER:64,                                  // wadeable shallow water (water-region paths)
  // Forest terrain features — a vertical WATERFALL (animated falling water) and
  // a rocky CLIFF face. Both solid. Streams reuse WATER + BRIDGE.
  WATERFALL:65, CLIFF:66,
  // Desert terrain features — a PLATEAU (solid mesa rock band spanning the map
  // edge-to-edge) and the CLIMB tile (passable ramp that lets a path cross a
  // plateau). FLOWERING_CACTUS is a passable, 1-HP, sword-cuttable cactus that
  // grows near desert water.
  PLATEAU:67, CLIMB:68, FLOWERING_CACTUS:69,
  // Water region: a mid-depth water tile sitting between the wadeable
  // SHALLOW_WATER rim and the solid DEEP_WATER. Too deep to cross (solid).
  MEDIUM_WATER:70,
  // A swirling WHIRLPOOL — a single-tile hazard set far out in open medium
  // water (no closer than 8 tiles to any shallow water or land). Solid.
  WHIRLPOOL:71,
  // Ice region: snow-covered pine mixed into the glacier border so the walls
  // read as a frozen treeline. Solid, like GLACIER.
  SNOW_PINE:72,
  // Ice region: deep powder banks scattered across the snowfields — the ice
  // region's answer to the desert DUNE. Passable but trudging through one
  // halves walk speed (see stepPlayerMovement).
  SNOW_DRIFT:73,
  // A hidden doorway concealed behind the rushing water at the base of a
  // forest WATERFALL. Renders exactly like the falling water but with a faint
  // glow (the only indicator). Passable — stepping into it drops the player
  // into a chain of hidden cave maps (see tryCaveTransition).
  WATERFALL_DOOR:74,
  // A passage leading deeper into a cave chain — placed at the back of every
  // non-final cave chamber. Passable; stepping on it descends one level.
  CAVE_DESCENT:75,
  // Natural rock wall of the cave labyrinth — solid, like WALL, but rendered as
  // craggy stone instead of dressed dungeon brick.
  CAVE_WALL:76,
  // Ice region natural growth. Both passable, 1-HP, sword-cuttable foliage that
  // revert to SNOW when cut (like the forest's flowers): a WINTER_BERRY_BUSH
  // (drops winter berries) and a FROST_LILY flower (drops frost petals).
  WINTER_BERRY_BUSH:77, FROST_LILY:78,
  // Water region beach finds on the sand — passable, 1-HP, sword-cuttable, revert
  // to SAND when cut: a cluster of STONES (drops stone shards), a SEASHELL (drops
  // seashells), and a branch of CORAL (drops coral).
  STONES:79, SEASHELL:80, CORAL:81,
  // Earth region's open ground — loose mountain SCREE (broken rock/gravel) that
  // covers the slopes beyond the maintained dirt PATH trails. Passable, normal
  // walk speed; the dirt PATH stays the "main path", SCREE is everything off it.
  SCREE:82,
  // Earth region natural growth strewn across the open SCREE slopes. All three
  // are passable, 1-HP, sword-cuttable foliage that revert to SCREE when cut
  // (like the forest's flowers): a MOUNTAIN_SAGE shrub (drops sage), a MOSS_CLUMP
  // ground cover (drops moss), and a CRYSTAL_CLUSTER of amethyst (drops crystals).
  MOUNTAIN_SAGE:83, MOSS_CLUMP:84, CRYSTAL_CLUSTER:85,
  // Air region. The hero walks on a floor of cloud: CLOUD is the base walkable
  // cloud surface and CLOUDBANK is the brighter, fluffier second cloud tile
  // dappled across it, so the floor reads as a rolling bank of two cloud tiles
  // (both passable). SKY_GROUND is the solid border framing the map — the
  // distant earth seen far below, beyond the edge of the cloud, from the height
  // of the clouds (a hazy patchwork of fields and water). (CLOUDWALL, the old
  // solid cloud border, is retained for backward compatibility but no longer
  // placed in fresh air maps.)
  CLOUDBANK:86, SKY_GROUND:87,
  // The impassable fluffy lip of the cloud — a 2-to-4-tile band ringing the whole
  // walkable area, so the cloud the hero stands on has a billowing edge they
  // can't step past (beyond it is the SKY_GROUND earth far below). Solid.
  CLOUD_EDGE:88,
  // Air region natural growth strewn across the open CLOUD floor. All three are
  // passable, 1-HP, sword-cuttable foliage that revert to CLOUD when cut (like
  // the forest's flowers): a SKY_BLOOM flower (drops sky petals), a tuft of
  // WIND_REED grass (drops wind seeds), and a STORM_THISTLE puff (drops thistle
  // down).
  SKY_BLOOM:89, WIND_REED:90, STORM_THISTLE:91,
  // Lightning region's two extra cloud-island tiles, the dark counterparts of
  // the air region's CLOUDBANK / CLOUD_EDGE. STORM_BANK is the brighter, lit
  // storm puff dappled across the walkable STORM_GROUND floor (passable, like
  // CLOUDBANK); STORM_EDGE is the impassable, billowing dark lip ringing the
  // walkable area where the storm island drops away into the thunderheads
  // (solid, like CLOUD_EDGE).
  STORM_BANK:92, STORM_EDGE:93,
  // Lightning region natural growth strewn across the open STORM_GROUND floor —
  // the storm region's answer to the air region's sky blooms / wind reeds /
  // storm thistles. All three are passable, 1-HP, sword-cuttable foliage that
  // revert to STORM_GROUND when cut (like the forest's flowers): a VOLT_BLOOM
  // flower (drops volt petals), a tuft of SPARK_REED grass (drops spark seeds),
  // and a FULGURITE cluster of lightning-fused glass shards (drops fulgurite).
  VOLT_BLOOM:94, SPARK_REED:95, FULGURITE:96,
  // Luminous region — a hallowed, sun-washed sanctum of warm white healing light.
  // LUMINOUS_GLOW is a brighter pool of concentrated radiance dappled across the
  // walkable LUMINOUS_FLOOR (passable, the luminous twin of the cloud regions'
  // CLOUDBANK). The three growths are passable, 1-HP, sword-cuttable foliage that
  // revert to LUMINOUS_FLOOR when cut, each shedding a distinct radiant forage: a
  // RADIANT_BLOOM (haloed white-gold flower, sheds a Light Mote), a GLOW_REED
  // (slender light-stalks tipped with glowing motes, sheds a Sun Seed), and a
  // LUMEN_SHARD (cluster of glowing crystal, sheds a Prism Shard). LIGHT_PILLAR
  // is a solid shaft of radiant light rising from the floor — a luminous landmark
  // (solid, like a column), placed only out in the open so it never walls a path.
  LUMINOUS_GLOW:97, RADIANT_BLOOM:98, GLOW_REED:99, LUMEN_SHARD:100, LIGHT_PILLAR:101,
  // Necrotic region — a morbid underworld of undead and decay. GRAVE_DIRT is a
  // mound of fresh-turned burial soil dappled across the walkable BLIGHT floor
  // (passable, the necrotic twin of the cloud regions' CLOUDBANK / the luminous
  // LUMINOUS_GLOW). The three growths are passable, 1-HP, sword-cuttable foliage
  // that revert to BLIGHT when cut: a BONE_PILE (heap of bones, the blight-backed
  // answer to the desert BONES, sheds bone meal), a WITHERED_SHRUB (dead thorn
  // bramble, sheds witherwood), and a CORPSE_FLOWER (pale carrion bloom, sheds a
  // grave bloom). DEAD_TREE is
  // a gnarled leafless tree clawing up out of the crypt-wall border (solid, like
  // the ice region's SNOW_PINE); TOMBSTONE is a cracked leaning headstone — a
  // solid graveyard landmark placed only in the open so it never walls a path.
  GRAVE_DIRT:102, DEAD_TREE:103, WITHERED_SHRUB:104, CORPSE_FLOWER:105, BONE_PILE:106, TOMBSTONE:107,
  // Poison region — a fetid swamp of bog and rank vegetation. SLUDGE is the
  // walkable mire floor and POISON_WALL the dense thicket border. BOG is a
  // sunken, waterlogged patch of mire dappled across the SLUDGE (passable, but
  // trudging through one halves walk speed — the swamp twin of the earth MUD /
  // ice SNOW_DRIFT); BOG_POOL is a deep pool of stagnant, scum-skinned bog water
  // (solid, the poison region's accent — crossed by plank bridges, the murky
  // counterpart of the water region's DEEP/MEDIUM_WATER). CATTAIL (a clump of
  // bulrush reeds) and SWAMP_FERN (a bushy marsh fern) are passable, 1-HP,
  // sword-cuttable foliage that revert to SLUDGE when cut — the cattail sheds Reed
  // Pith, the fern an Herbal;
  // MANGROVE is a gnarled, moss-draped swamp tree clawing up out of the thicket
  // border (solid, like the necrotic region's DEAD_TREE). SWAMP_MUSHROOM is a
  // cluster of glowing, sickly poison toadstools — the swamp's own muck-backed
  // toadstool (passable, 1-HP, cut for a Mushroom), drawn on the mire so it blends
  // where the forest's grass-backed MUSHROOM would clash. FALLEN_LOG is a rotting,
  // moss-grown tree trunk lying across the swamp — a solid 2–4-tile landmark laid
  // in straight horizontal or vertical runs (the swamp's answer to the necrotic
  // region's TOMBSTONE), placed only out in the open so it never walls a path.
  BOG:108, BOG_POOL:109, CATTAIL:110, SWAMP_FERN:111, MANGROVE:112, SWAMP_MUSHROOM:113,
  FALLEN_LOG:114,
  // Mana region — a forest flourishing past nature, gorged on raw life energy:
  // everything grows abnormally large and lush, lit from within by violet mana.
  // MANA_FLOOR is the walkable verdant turf and MANA_CRYSTAL the dense, mana-veined
  // treeline border. MANA_MOSS is a thicker cushion of overgrown moss dappled
  // across the floor (passable, the mana twin of the cloud regions' CLOUDBANK /
  // the luminous LUMINOUS_GLOW). The three growths are passable, 1-HP,
  // sword-cuttable foliage that revert to MANA_FLOOR when cut, each abnormally
  // oversized: a GIANT_BLOOM (huge violet arcane flower, sheds a Mana Petal), a
  // VERDANT_FERN (towering lush fern, sheds a Heart Frond), and a GIANT_MUSHROOM
  // (colossal glowing toadstool, sheds a Glow Cap). GREAT_TREE is an abnormally
  // large ancient tree — solid, like the necrotic region's DEAD_TREE — used both
  // as the treeline border dressing (clawed out of MANA_CRYSTAL) and as a colossal
  // landmark standing in the open clearings.
  MANA_MOSS:115, GIANT_BLOOM:116, VERDANT_FERN:117, GIANT_MUSHROOM:118, GREAT_TREE:119,
  // An exceptionally large ancient tree set sporadically into the mana treeline
  // border — NOT bound to the tile grid: only this one anchor tile is solid, but
  // it is rendered in a dedicated overlay pass (drawColossalTree, after the tile
  // grid like the whirlpool suction) as a single giant tree sprite spanning several
  // tiles, overflowing its own tile into the neighbouring border/canopy. Solid,
  // and only ever placed on already-solid border tiles, so connectivity is
  // unaffected.
  COLOSSAL_TREE:120,
  // Fire (desert) region natural growth — a DESERT_SUCCULENT: a low agave/aloe
  // rosette of blue-green blades growing in the open sand. Passable, 1-HP,
  // sword-cuttable foliage that reverts to SAND when cut and sheds Aloe — the
  // desert's third forage alongside the bone piles (bone meal) and the
  // near-water flowering cacti (herbal).
  DESERT_SUCCULENT:121,
  // Ice region natural growth — a FROST_FERN: a hardy, frost-rimed fern frond
  // unfurling from the snow. Passable, 1-HP, sword-cuttable foliage that reverts
  // to SNOW when cut and sheds a Frost Fern frond — the snowfield's third forage
  // alongside the winter berry bushes and frost lilies.
  FROST_FERN:122,
  // ─── Elemental region open-ground landmarks ──────────────────────────────────
  // One solid landmark per early region, standing out in a clearing — each
  // region's own answer to the necrotic TOMBSTONE / poison FALLEN_LOG / mana
  // GREAT_TREE / luminous LIGHT_PILLAR (the "later region" features). All are solid
  // and, like those, placed only where the whole 8-neighbourhood is open ground, so
  // a lone landmark can never wall a path (safe after the connectivity seal). See
  // REGION_LANDMARKS / addRegionLandmarks in map-gen.js and their draws in render.js.
  //   MOSS_BOULDER   — forest:    a great lichen-and-moss-covered grey boulder.
  //   DESERT_OBELISK — fire:      a weathered, half-buried sandstone obelisk.
  //   DRIFTWOOD      — water:     a large bleached driftwood trunk on the beach.
  //   ICE_SPIRE      — ice:       a jagged shard of blue glacial ice from the snow.
  //   STANDING_STONE — earth:     a leaning megalithic menhir on the scree slopes.
  //   CLOUD_SPIRE    — air:       a towering column of piled white cumulus cloud.
  //   STORM_SPIRE    — lightning: the dark twin — a thunderhead column veined with
  //                               crackling lightning.
  MOSS_BOULDER:123, DESERT_OBELISK:124, DRIFTWOOD:125, ICE_SPIRE:126,
  STANDING_STONE:127, CLOUD_SPIRE:128, STORM_SPIRE:129,

  // ─── Volcanic region (id 'volcanic') ─────────────────────────────────────────
  // A scorched caldera of cooled basalt and open lava. VOLCANIC_ROCK is the solid
  // obsidian border wall; VOLCANIC_GROUND the walkable cooled-lava/ash floor;
  // MAGMA_CRACK a glowing fissure dappled across the floor (passable, the volcanic
  // twin of the cloud regions' CLOUDBANK). Accent is the existing solid T.LAVA
  // (open magma pools, bridged). EMBER_FLOWER (a fire-lily, sheds Emberbloom) and
  // SULFUR_SHRUB (a brimstone bush, sheds Sulfur Moss) are passable, 1-HP,
  // sword-cuttable foliage that revert to VOLCANIC_GROUND when cut. OBSIDIAN_SPIRE
  // is the region's solid open-ground landmark (a jagged shard of black glass).
  VOLCANIC_ROCK:130, VOLCANIC_GROUND:131, MAGMA_CRACK:132,
  EMBER_FLOWER:133, SULFUR_SHRUB:134, OBSIDIAN_SPIRE:135,

  // ─── Shadow region (id 'shadow') ─────────────────────────────────────────────
  // The final region — a lightless umbral waste. SHADOW_WALL is the solid
  // void-stone border; SHADOW_GROUND the walkable umbral floor; SHADOW_DAPPLE a
  // pooled deeper-gloom tile dappled across it (passable). SHADOW_RIFT is a void
  // chasm accent (solid, bridged — the shadow twin of the fire/necrotic LAVA).
  // GLOOM_BLOOM (a pale duskcap cluster, sheds Duskcaps) and VOID_FROND (a black
  // fern, sheds Void Petals) are passable, 1-HP, sword-cuttable foliage that revert
  // to SHADOW_GROUND when cut. SHADOW_MONOLITH is the region's solid open-ground
  // landmark (a featureless black obelisk that drinks the light).
  SHADOW_WALL:136, SHADOW_GROUND:137, SHADOW_DAPPLE:138, SHADOW_RIFT:139,
  GLOOM_BLOOM:140, VOID_FROND:141, SHADOW_MONOLITH:142
};

// ─── Solid tiles ──────────────────────────────────────────────────────────────
// Single source of truth for "this tile blocks movement", used by isSolid()
// (player + enemy movement) and — inverted — by the connectivity flood-fill's
// passable() in connectivity.js. These were previously two hand-maintained lists
// that drifted (e.g. STORM_EDGE was solid for movement but missing from the flood
// list, so the flood leaked through storm-region borders). Add a blocking tile
// here once and both stay in sync.
//
// Chests are deliberately NOT listed here: they block movement too, but isSolid()
// adds them via isChestTile(), while the connectivity flood treats them as
// walkable triggers (so they aren't sealed). Keeping them out of this set is what
// preserves that distinction — see passable() in connectivity.js.
const SOLID_TILES = new Set([
  T.TREE, T.WATER, T.WALL, T.ROCK, T.CAVE_WALL,
  T.DEEP_WATER, T.MEDIUM_WATER, T.WHIRLPOOL,
  T.LAVA, T.PILLAR, T.STATUE,
  T.FOUNTAIN_WATER, T.FOUNTAIN_SPOUT,
  T.CACTUS, T.OASIS_WATER,
  T.WATERFALL, T.CLIFF, T.PLATEAU,
  // Elemental region borders
  T.GLACIER, T.SNOW_PINE, T.MOUNTAIN, T.CLOUDWALL,
  T.SKY_GROUND, T.CLOUD_EDGE,
  T.STORM_CLOUD, T.STORM_EDGE, T.LUMINOUS_CRYSTAL, T.LIGHT_PILLAR,
  T.BLIGHTED_WALL, T.POISON_WALL, T.MANA_CRYSTAL,
  T.DEAD_TREE, T.TOMBSTONE,
  T.BOG_POOL, T.MANGROVE, T.FALLEN_LOG,
  T.GREAT_TREE, T.COLOSSAL_TREE,
  // Elemental region open-ground landmarks
  T.MOSS_BOULDER, T.DESERT_OBELISK, T.DRIFTWOOD,
  T.ICE_SPIRE, T.STANDING_STONE,
  T.CLOUD_SPIRE, T.STORM_SPIRE,
  // Volcanic region: obsidian border wall, void-rift accent unused here (LAVA is
  // already listed), plus the obsidian-shard landmark.
  T.VOLCANIC_ROCK, T.OBSIDIAN_SPIRE,
  // Shadow region: void-stone border, the SHADOW_RIFT chasm accent, and the
  // black-obelisk landmark.
  T.SHADOW_WALL, T.SHADOW_RIFT, T.SHADOW_MONOLITH,
].filter(v => v !== undefined));

// Fallback colors used by the minimap renderer (richer art in render.js)
const TILE_COLORS = {
  [T.GRASS]: '#3a7a3a', [T.TREE]: '#1a4a1a', [T.WATER]: '#2255aa',
  [T.PATH]: '#8a7050', [T.WALL]: '#484848', [T.FLOOR]: '#9a7550',
  [T.CHEST]: '#7a4400', [T.DOOR]: '#663399', [T.ROCK]: '#777',
  [T.SAND]: '#d4b070', [T.FLOWER]: '#4a8a3a', [T.DUNGEON_DOOR]: '#220033',
  [T.DEEP_WATER]: '#112266', [T.LAVA]: '#cc2200', [T.BRIDGE]: '#885522',
  [T.PILLAR]: '#555', [T.TORCH]: '#663300', [T.STATUE]: '#888',
  [T.SHRINE]: '#225522', [T.MUSHROOM]: '#3a7a3a', [T.FERN]: '#3a7a3a',
  [T.CAVE_ENTRANCE]: '#0a0a0a', [T.CAVE_EXIT]: '#332266',
  [T.LARGE_CHEST]: '#cc8800', [T.CAVE_FLOOR]: '#3a2a1a',
  [T.INN_DOOR]: '#aa3322', [T.STORE_DOOR]: '#33aa55', [T.HERB_DOOR]: '#66bb44',
  [T.SMITH_DOOR]: '#7088aa',
  [T.FOUNTAIN_WATER]: '#3366cc', [T.FOUNTAIN_SPOUT]: '#888888',
  [T.MARBLE]: '#e8e4d8', [T.COBBLESTONE]: '#7a7a78',
  [T.BED]: '#8a4480', [T.TABLE]: '#6a3a18', [T.CHAIR]: '#5a2a10', [T.FIREPLACE]: '#3a3a3a',
  [T.CACTUS]: '#3a7a3a', [T.DUNE]: '#c89858', [T.OASIS_WATER]: '#2a88cc', [T.BONES]: '#e8e0c0',
  [T.LARGE_CHEST_R]: '#cc8800',
  // Boss chest base color matches the dark royal-purple body so the 10%
  // padding around each quadrant blends instead of flashing magenta.
  [T.BOSS_CHEST_TL]: '#3a0a66', [T.BOSS_CHEST_TR]: '#3a0a66',
  [T.BOSS_CHEST_BL]: '#3a0a66', [T.BOSS_CHEST_BR]: '#3a0a66',
  // Elemental region palette — picked for readable contrast on the minimap.
  [T.SNOW]: '#e4ecf2',           [T.ICE]: '#a8d8ee',            [T.GLACIER]: '#5a9ac8',
  // Snow pine — dark evergreen so the treeline reads against snow + glacier.
  [T.SNOW_PINE]: '#2a5a3e',
  // Snow drift — a shade deeper/bluer than open SNOW so the banks read on the
  // minimap the way DUNE does against SAND.
  [T.SNOW_DRIFT]: '#c9d6e4',
  [T.MUD]: '#5a3a18',             [T.MOUNTAIN]: '#4a4035',
  [T.CLOUD]: '#dde6f2',           [T.CLOUDWALL]: '#a0b0c8',
  // Lightning region — the air palette gone dark and stormy. STORM_GROUND is the
  // walkable dark-slate cloud floor, STORM_BANK the slightly lit puff dappled
  // across it, STORM_EDGE the shaded lip, and STORM_CLOUD the near-black
  // thunderhead border. Brightness order mirrors air (floor < bank, edge between
  // floor and border) so the island reads on the minimap.
  [T.STORM_GROUND]: '#313749',    [T.STORM_CLOUD]: '#1b1f2c',
  [T.STORM_BANK]: '#3e4660',      [T.STORM_EDGE]: '#272c3c',
  // Luminous region — warm white healing light. The floor is a hallowed,
  // sun-washed ivory; the brighter LUMINOUS_GLOW pools read whiter still; and the
  // border crystal is a glowing white-gold so the sanctum is framed in radiance.
  [T.LUMINOUS_FLOOR]: '#f5edd8',  [T.LUMINOUS_CRYSTAL]: '#ffe9a6',
  [T.LUMINOUS_GLOW]: '#fdf4d2',   [T.LIGHT_PILLAR]: '#fff6e0',
  // Luminous growth — all bright warm-gold so they read against the pale floor on
  // the minimap: a haloed bloom, light-tipped reeds, and a glowing crystal shard.
  [T.RADIANT_BLOOM]: '#ffe9a0', [T.GLOW_REED]: '#f4e6b0', [T.LUMEN_SHARD]: '#fdf0c8',
  [T.BLIGHT]: '#3a2a3a',          [T.BLIGHTED_WALL]: '#1a0a1a',
  // Necrotic decay — grave dirt reads a shade darker/browner than the blight
  // floor (like SNOW_DRIFT against SNOW); a dead tree and withered shrub are grey
  // deadwood against the dark wall/ground; the carrion bloom a sickly grey-green;
  // the bone pile bleached bone; the tombstone a pale grave-grey, all readable on
  // the minimap.
  [T.GRAVE_DIRT]: '#2a1f28',      [T.DEAD_TREE]: '#4a4048',
  [T.WITHERED_SHRUB]: '#6a5a52',  [T.CORPSE_FLOWER]: '#9aa86a',
  [T.BONE_PILE]: '#d8cfb2',       [T.TOMBSTONE]: '#7a747e',
  // Poison swamp — a murky olive mire floor framed by a dark thicket border.
  // BOG patches read a shade darker/wetter than the SLUDGE (like SNOW_DRIFT vs
  // SNOW); BOG_POOL is near-black stagnant water; the reeds and fern are
  // readable greens; the mangrove a dark mossy trunk-green against the thicket.
  [T.SLUDGE]: '#566b2c',          [T.POISON_WALL]: '#28401a',
  [T.BOG]: '#3c4a1f',             [T.BOG_POOL]: '#1f3018',
  [T.CATTAIL]: '#7e8a44',         [T.SWAMP_FERN]: '#3f7a30',  [T.MANGROVE]: '#2c3c1a',
  [T.SWAMP_MUSHROOM]: '#8a6fb0',  [T.FALLEN_LOG]: '#5a4326',
  // Mana region — a verdant, overgrown forest gorged on life energy. The floor is
  // a lush emerald turf; the brighter MANA_MOSS cushions read greener still; the
  // border is a deep, mana-veined treeline; and GREAT_TREE is the darkest, most
  // massive canopy. The three growths are an oversized violet bloom, a rich-green
  // towering fern, and a violet glowing toadstool, all readable on the minimap.
  [T.MANA_FLOOR]: '#2e7d4f',      [T.MANA_CRYSTAL]: '#163d28',
  [T.MANA_MOSS]: '#3da868',       [T.GREAT_TREE]: '#0e2c1c',
  [T.COLOSSAL_TREE]: '#0a2216',   // exceptionally large ancient tree — darkest canopy
  [T.GIANT_BLOOM]: '#b46ce0',     [T.VERDANT_FERN]: '#3f9a4a',
  [T.GIANT_MUSHROOM]: '#a070d8',
  [T.PORTAL]: '#aa66ff',
  // Shallow water — lighter/greener than deep WATER so a wadeable channel reads
  // distinctly from the deep-water border and pools.
  [T.SHALLOW_WATER]: '#5aa8c8',
  // Medium-depth water — a shade between the bright shallows and the navy deep.
  [T.MEDIUM_WATER]: '#2c6699',
  // Whirlpool — dark swirling vortex set in the medium-water shelf.
  [T.WHIRLPOOL]: '#16406e',
  // Forest water/terrain features — bright falling water + rocky cliff face.
  [T.WATERFALL]: '#3f7fd0', [T.CLIFF]: '#6a5f52',
  // Waterfall doorway reads as falling water on the minimap; the cave descent
  // is a dark hole.
  [T.WATERFALL_DOOR]: '#3f7fd0', [T.CAVE_DESCENT]: '#0a0a0a',
  // Cave rock wall — dark craggy stone, lighter than the near-black cave floor
  // so the labyrinth's tunnels read clearly on the minimap.
  [T.CAVE_WALL]: '#463d35',
  // Desert terrain features — sandstone plateau, sandy climbing ramp, and a
  // flowering cactus (green body reads against sand on the minimap).
  [T.PLATEAU]: '#b5743a', [T.CLIMB]: '#caa46a', [T.FLOWERING_CACTUS]: '#3a7a3a',
  // Ice region natural growth — frosted berry bush (deep evergreen) and a pale
  // ice-blue frost lily, both readable against the snowfield on the minimap.
  [T.WINTER_BERRY_BUSH]: '#3f6a4e', [T.FROST_LILY]: '#9fcfe8',
  // Water region beach finds — grey stones, a cream seashell, and orange coral,
  // all readable against the sand on the minimap.
  [T.STONES]: '#7a746b', [T.SEASHELL]: '#f0dcc4', [T.CORAL]: '#e8765a',
  // Earth region scree — pale grey-brown rubble, distinct from the warmer dirt
  // PATH (#a08860) so the off-trail slopes read separately on the minimap.
  [T.SCREE]: '#8a8174',
  // Earth region natural growth — sage-green shrub, mossy green cushion, and a
  // pale amethyst crystal cluster, all readable against the grey SCREE.
  [T.MOUNTAIN_SAGE]: '#7c9a6a', [T.MOSS_CLUMP]: '#5a7a3a', [T.CRYSTAL_CLUSTER]: '#a87fd0',
  // Air region — CLOUDBANK is the brighter puff dappled across the walkable
  // CLOUD floor (whiter than the base cloud), and SKY_GROUND is the solid border:
  // a hazy blue-green of the distant earth seen far below from cloud height.
  [T.CLOUDBANK]: '#eaf1fb', [T.SKY_GROUND]: '#8fa48f',
  // Cloud edge — the impassable rim, a touch greyer/shaded than the bright floor
  // so the lip reads distinctly from the cloud the hero walks on.
  [T.CLOUD_EDGE]: '#bcc8de',
  // Air region natural growth — a pink sky bloom, golden wind reed, and an
  // electric-blue storm thistle, all readable against the pale cloud floor.
  [T.SKY_BLOOM]: '#f2a8d0', [T.WIND_REED]: '#d8c47a', [T.STORM_THISTLE]: '#a8d0f0',
  // Lightning region natural growth — an electric-blue volt bloom, a golden
  // spark reed, and a violet-white fulgurite cluster, all bright enough to read
  // against the dark storm-cloud floor on the minimap.
  [T.VOLT_BLOOM]: '#7ec8ff', [T.SPARK_REED]: '#e8c468', [T.FULGURITE]: '#b3a6ff',
  // Fire region desert succulent — a blue-green rosette readable against the sand.
  [T.DESERT_SUCCULENT]: '#5aa86a',
  // Ice region frost fern — a pale frosted green readable against the snowfield.
  [T.FROST_FERN]: '#a8d8c0',
  // Elemental region open-ground landmarks — each readable against its region's
  // ground on the minimap: a grey boulder on grass, a tan obelisk on sand, pale
  // bleached driftwood on sand, a bright ice shard on snow, a dark menhir on scree,
  // a brilliant white cloud spire on the pale cloud floor, and a dark storm spire
  // on the slate storm floor.
  [T.MOSS_BOULDER]: '#6b6a60',    [T.DESERT_OBELISK]: '#b59560',
  [T.DRIFTWOOD]: '#cfc4b0',       [T.ICE_SPIRE]: '#7fc0e4',
  [T.STANDING_STONE]: '#5f584e',  [T.CLOUD_SPIRE]: '#f4f8ff',
  [T.STORM_SPIRE]: '#48527a',
  // Volcanic region — a dark basalt border, a cooled charcoal-ash floor, and
  // glowing MAGMA_CRACK fissures dappled across it (bright molten orange). The
  // EMBER_FLOWER fire-lily and SULFUR_SHRUB brimstone bush read warm against the
  // dark floor; OBSIDIAN_SPIRE is a near-black glass shard.
  [T.VOLCANIC_ROCK]: '#2b2320',   [T.VOLCANIC_GROUND]: '#4a3b34',
  [T.MAGMA_CRACK]: '#ff5522',     [T.EMBER_FLOWER]: '#ff9944',
  [T.SULFUR_SHRUB]: '#c9b23a',    [T.OBSIDIAN_SPIRE]: '#171014',
  // Shadow region — a lightless umbral waste. A void-stone border near-black,
  // an umbral floor a shade lighter, SHADOW_DAPPLE deeper-gloom pools, and the
  // SHADOW_RIFT void chasm the darkest of all. The GLOOM_BLOOM duskcaps read pale,
  // VOID_FROND a cold violet; SHADOW_MONOLITH a flat black obelisk.
  [T.SHADOW_WALL]: '#100b18',     [T.SHADOW_GROUND]: '#241d33',
  [T.SHADOW_DAPPLE]: '#1a1526',   [T.SHADOW_RIFT]: '#080510',
  [T.GLOOM_BLOOM]: '#9a86c4',     [T.VOID_FROND]: '#6f4fb0',
  [T.SHADOW_MONOLITH]: '#0b0712',
};

// ─── Monster trophies ─────────────────────────────────────────────────────────
// Single source of truth for enemy-drop trophies. Each entry's inventory key is
// the plural `id + 's'` (fang → player.fangs). One record here drives every
// trophy table instead of the old 8-way scatter:
//   • TROPHY_META   (projectiles.js) → { icon, label, color } for ground drops
//   • TROPHY_SELL   (shop.js)        → General Store sell rows (value)
//   • PASSIVE_DROPS (radial.js)      → drops-satchel / ledger rows
//   • DROP_CAT_OF   (radial.js)      → 'monster' bucket (biological parts)
//   • save defaults (player.js / save.js, via trophyDefaults())
// Flags: `monster` = biological body-part (buckets under Monster Parts; mineral /
// elemental / crafted trophies omit it and fall through to Materials). `granted`
// = seeded at STARTING_ITEM_AMOUNT on a fresh player (fang/finger/bone/wing), else
// starts at 0. Snowball is NOT here — it's a non-enemy drift drop, hand-listed in
// each table. To add a monster trophy: add a row here + wire the enemy in
// ENEMY_DROPS (player.js).
const TROPHIES = [
  { id: 'fang',              icon: '🦷', label: 'Fang',              color: '#f0eedd', value: 10, monster: true, granted: true },
  { id: 'finger',           icon: '🫳', label: 'Finger',            color: '#d8a070', value: 10, monster: true, granted: true },
  { id: 'bone',              icon: '🦴', label: 'Bone',              color: '#f4ead8', value: 12, monster: true, granted: true },
  { id: 'wing',              icon: '🪶', label: 'Wing',              color: '#aaccff', value: 25, monster: true, granted: true },
  { id: 'organ',             icon: '🫀', label: 'Organ',             color: '#aa3344', value: 15, monster: true },
  { id: 'feather',           icon: '🪶', label: 'Feather',           color: '#c8b890', value: 20, monster: true },
  { id: 'silk',              icon: '🕸️', label: 'Silk',              color: '#ddddee', value: 12, monster: true },
  { id: 'talisman',          icon: '📿', label: 'Talisman',          color: '#aa66cc', value: 20 },
  { id: 'ember',             icon: '🔥', label: 'Ember',             color: '#ff7733', value: 15 },
  { id: 'venom',             icon: '☠️', label: 'Venom Sac',         color: '#88cc44', value: 18, monster: true },
  { id: 'fin',               icon: '🐟', label: 'Fin',               color: '#5599cc', value: 15, monster: true },
  { id: 'pearl',             icon: '🦪', label: 'Pearl',             color: '#f0e8dd', value: 30 },
  { id: 'core',              icon: '💠', label: 'Elemental Core',    color: '#66ccff', value: 40 },
  { id: 'shard',             icon: '🧊', label: 'Ice Shard',         color: '#aaddee', value: 22 },
  { id: 'pelt',              icon: '🧥', label: 'Pelt',              color: '#aa8855', value: 25, monster: true },
  { id: 'tusk',              icon: '🦣', label: 'Tusk',              color: '#e8dcc0', value: 35, monster: true },
  { id: 'scale',             icon: '🐉', label: 'Dragon Scale',      color: '#44aa66', value: 35, monster: true },
  { id: 'stone',             icon: '🪨', label: 'Stone Shard',       color: '#8a857a', value: 25 },
  { id: 'spark',             icon: '⚡', label: 'Storm Spark',       color: '#ffee33', value: 35 },
  { id: 'horn',              icon: '🦄', label: 'Horn',              color: '#ffeeff', value: 50, monster: true },
  { id: 'mote',              icon: '✨', label: 'Light Mote',        color: '#ffee88', value: 45 },
  { id: 'ectoplasm',         icon: '👻', label: 'Ectoplasm',         color: '#ccddee', value: 40, monster: true },
  { id: 'eye',               icon: '👁️', label: 'Eye',               color: '#cc88dd', value: 50, monster: true },
  { id: 'brain',             icon: '🧠', label: 'Brain',             color: '#ffaabb', value: 55, monster: true },
  { id: 'dryad_bloom',       icon: '🌷', label: 'Dryad Bloom',       color: '#d98fb0', value: 12 },
  { id: 'gnoll_fang',        icon: '🦷', label: 'Gnoll Fang',        color: '#d9c9a0', value: 14, monster: true },
  { id: 'hound_fang',        icon: '🦷', label: 'Hellhound Fang',    color: '#cc5522', value: 16, monster: true },
  { id: 'salamander_hide',   icon: '🦎', label: 'Salamander Hide',   color: '#ff5a2a', value: 16, monster: true },
  { id: 'kuotoa_gill',       icon: '🐠', label: 'Kuo-toa Gill',      color: '#79b08a', value: 16, monster: true },
  { id: 'shark_tooth',       icon: '🦈', label: 'Shark Tooth',       color: '#9bb6c8', value: 18, monster: true },
  { id: 'hag_hair',          icon: '🧶', label: 'Sea Hag Hair',      color: '#5e7d63', value: 18, monster: true },
  { id: 'frost_fang',        icon: '❄️', label: 'Frost Fang',        color: '#cce6ff', value: 22, monster: true },
  { id: 'rime',              icon: '🧊', label: 'Rime Crystal',      color: '#bfe0ff', value: 26 },
  { id: 'acid_gland',        icon: '🧪', label: 'Acid Gland',        color: '#aacc33', value: 24, monster: true },
  { id: 'displacer_hide',    icon: '🐆', label: 'Displacer Hide',    color: '#4a3a6a', value: 26, monster: true },
  { id: 'bulette_plate',     icon: '🛡️', label: 'Bulette Plate',     color: '#6a7a5a', value: 30, monster: true },
  { id: 'earth_heart',       icon: '🟤', label: 'Earthen Heart',     color: '#8a6a4a', value: 38 },
  { id: 'granite',           icon: '🗿', label: 'Granite Slab',      color: '#8a857a', value: 28 },
  { id: 'harpy_plume',       icon: '🪶', label: 'Harpy Plume',       color: '#b59ad6', value: 24, monster: true },
  { id: 'griffon_feather',   icon: '🦅', label: 'Griffon Feather',   color: '#c8a45a', value: 26, monster: true },
  { id: 'manticore_spike',   icon: '🗡️', label: 'Manticore Spike',   color: '#aa4433', value: 28, monster: true },
  { id: 'zephyr',            icon: '🌀', label: 'Zephyr Wisp',       color: '#cfe8ff', value: 38 },
  { id: 'wyvern_scale',      icon: '🐲', label: 'Wyvern Scale',      color: '#6a8a4a', value: 32, monster: true },
  { id: 'roc_plume',         icon: '🪶', label: 'Roc Plume',         color: '#b0855a', value: 30, monster: true },
  { id: 'wyrmling_scale',    icon: '🐉', label: 'Wyrmling Scale',    color: '#4477cc', value: 30, monster: true },
  { id: 'behir_scale',       icon: '🐍', label: 'Behir Scale',       color: '#4488cc', value: 32, monster: true },
  { id: 'bluedragon_scale',  icon: '🐉', label: 'Blue Dragon Scale', color: '#3366cc', value: 36, monster: true },
  { id: 'stormgiant_bolt',   icon: '🌩️', label: 'Tempest Bolt',      color: '#ffe066', value: 40 },
  { id: 'pegasus_feather',   icon: '🪽', label: 'Pegasus Feather',   color: '#eaf2ff', value: 36, monster: true },
  { id: 'couatl_scale',      icon: '🌈', label: 'Couatl Scale',      color: '#66ccaa', value: 36, monster: true },
  { id: 'kirin_horn',        icon: '🦌', label: 'Ki-rin Horn',       color: '#ffe6aa', value: 40, monster: true },
  { id: 'planetar_halo',     icon: '😇', label: 'Planetar Halo',     color: '#fff0b0', value: 48 },
  { id: 'wraith_shroud',     icon: '🧣', label: 'Wraith Shroud',     color: '#556677', value: 42, monster: true },
  { id: 'vampire_fang',      icon: '🧛', label: 'Vampire Fang',      color: '#aa2233', value: 40, monster: true },
  { id: 'phylactery',        icon: '🔮', label: 'Phylactery',        color: '#66ddaa', value: 50 },
  { id: 'crawler_venom',     icon: '🐛', label: 'Carrion Bile',      color: '#99bb44', value: 28, monster: true },
  { id: 'troll_hide',        icon: '🟢', label: 'Troll Hide',        color: '#6a8a4a', value: 30, monster: true },
  { id: 'otyugh_tentacle',   icon: '🦑', label: 'Otyugh Tentacle',   color: '#88aa55', value: 30, monster: true },
  { id: 'treant_heartwood',  icon: '🪵', label: 'Heartwood',         color: '#8a6a3a', value: 30 },
  { id: 'greendragon_scale', icon: '🐉', label: 'Green Dragon Scale',color: '#44aa55', value: 38, monster: true },
  { id: 'worm_stinger',      icon: '🪱', label: 'Worm Stinger',      color: '#aa66aa', value: 36, monster: true },
  { id: 'horror_plate',      icon: '🛡️', label: 'Animus Plate',      color: '#8899aa', value: 42 },
  { id: 'gith_blade',        icon: '⚔️', label: 'Githyanki Blade',   color: '#b0c0d0', value: 48 },
  { id: 'eyestalk',          icon: '👁️', label: 'Eyestalk',          color: '#cc66bb', value: 52, monster: true },
  { id: 'rakshasa_claw',     icon: '🐾', label: 'Rakshasa Claw',     color: '#cc8844', value: 50, monster: true },
  // ── Volcanic region ──
  { id: 'cinder_core',       icon: '🔥', label: 'Cinder Core',       color: '#ff7733', value: 26 },
  { id: 'firesnake_fang',    icon: '🦷', label: 'Fire Snake Fang',   color: '#dd5522', value: 26, monster: true },
  { id: 'azer_ingot',        icon: '🔩', label: 'Azer Ingot',        color: '#e0a050', value: 28 },
  { id: 'redwyrmling_scale', icon: '🐉', label: 'Red Wyrmling Scale',color: '#cc3322', value: 30, monster: true },
  { id: 'magma_core',        icon: '💠', label: 'Magma Core',        color: '#ff5522', value: 34 },
  { id: 'reddragon_scale',   icon: '🐲', label: 'Red Dragon Scale',  color: '#bb2211', value: 38, monster: true },
  // ── Shadow region ──
  { id: 'umbral_shard',      icon: '🌑', label: 'Umbral Shard',      color: '#3a2a5a', value: 48 },
  { id: 'mastiff_fang',      icon: '🦷', label: 'Shadow Mastiff Fang',color: '#2a2038', value: 50, monster: true },
  { id: 'bodak_eye',         icon: '👁️', label: 'Bodak Eye',         color: '#4a3a6a', value: 52, monster: true },
  { id: 'nightmare_hoof',    icon: '🐴', label: 'Nightmare Hoof',    color: '#5a3a7a', value: 54, monster: true },
  { id: 'demon_horn',        icon: '😈', label: 'Shadow Demon Horn', color: '#2a1a44', value: 56, monster: true },
  { id: 'void_heart',        icon: '🖤', label: 'Void Heart',        color: '#1a0f2e', value: 60, monster: true },
  // ── Rare enemy drops ──────────────────────────────────────────────────────
  // A second, prized trophy each monster drops only 5–10% of the time (see the
  // rare `chance` entries in ENEMY_DROPS, player.js). Same registry plumbing as
  // every other trophy — the General Store buys it, it shows in the Drops
  // satchel / ledger, and (for `monster` parts) buckets under Monster Parts.
  // Forest
  { id: 'goblin_ear',        icon: '👂', label: 'Goblin Ear',        color: '#caa079', value: 20, monster: true },
  { id: 'wolf_claw',         icon: '🐾', label: 'Wolf Claw',         color: '#b0a090', value: 22, monster: true },
  { id: 'pixie_dust',        icon: '🫧', label: 'Pixie Dust',        color: '#ffd6f5', value: 45 },
  { id: 'dryad_sap',         icon: '🍯', label: 'Dryad Sap',         color: '#d9a94a', value: 30 },
  { id: 'spinneret',         icon: '🕷️', label: 'Spinneret Gland',   color: '#6a5a7a', value: 26, monster: true },
  { id: 'owlbear_claw',      icon: '🐾', label: 'Owlbear Claw',      color: '#8a6a4a', value: 32, monster: true },
  // Fire / Desert
  { id: 'cult_tome',         icon: '📕', label: 'Cult Tome',         color: '#8a2a3a', value: 40 },
  { id: 'mephit_ash',        icon: '🌋', label: 'Mephit Ash',        color: '#c4552a', value: 30 },
  { id: 'gnoll_ear',         icon: '👂', label: 'Gnoll Ear',         color: '#c9a060', value: 28, monster: true },
  { id: 'hound_heart',       icon: '🫀', label: 'Hellhound Heart',   color: '#cc3322', value: 32, monster: true },
  { id: 'scorpion_stinger',  icon: '🦂', label: 'Scorpion Stinger',  color: '#b0803a', value: 30, monster: true },
  { id: 'salamander_tail',   icon: '🦎', label: 'Salamander Tail',   color: '#ff6a3a', value: 32, monster: true },
  // Water
  { id: 'sahuagin_trident',  icon: '🔱', label: 'Sahuagin Trident',  color: '#5aa0c0', value: 32 },
  { id: 'kuotoa_eye',        icon: '👁️', label: 'Kuo-toa Eye',       color: '#79b0a0', value: 30, monster: true },
  { id: 'shark_fin',         icon: '🦈', label: 'Shark Fin',         color: '#8ba6b8', value: 34, monster: true },
  { id: 'merrow_scale',      icon: '🐚', label: 'Merrow Scale',      color: '#4a90a0', value: 36, monster: true },
  { id: 'hag_eye',           icon: '👁️', label: 'Sea Hag Eye',       color: '#5e7d63', value: 36, monster: true },
  { id: 'tidal_pearl',       icon: '🌊', label: 'Tidal Pearl',       color: '#4aa0d0', value: 45 },
  // Ice
  { id: 'mephit_frost',      icon: '❄️', label: 'Mephit Frost',      color: '#bfe0ff', value: 32 },
  { id: 'winterwolf_pelt',   icon: '🧥', label: 'Winter Wolf Pelt',  color: '#dbeeff', value: 34, monster: true },
  { id: 'yeti_claw',         icon: '🐾', label: 'Yeti Claw',         color: '#e8f4ff', value: 34, monster: true },
  { id: 'mammoth_hide',      icon: '🧥', label: 'Mammoth Hide',      color: '#c8a878', value: 40, monster: true },
  { id: 'whitedragon_horn',  icon: '🐲', label: 'White Dragon Horn', color: '#cce6ff', value: 44, monster: true },
  { id: 'frostgiant_rune',   icon: '🔹', label: 'Frost Rune',        color: '#bfe0ff', value: 46 },
  // Earth
  { id: 'gargoyle_horn',     icon: '😈', label: 'Gargoyle Horn',     color: '#8a857a', value: 34, monster: true },
  { id: 'ankheg_shell',      icon: '🐚', label: 'Ankheg Shell',      color: '#9aac53', value: 34, monster: true },
  { id: 'displacer_tentacle',icon: '🐙', label: 'Displacer Tentacle',color: '#4a3a6a', value: 36, monster: true },
  { id: 'bulette_fin',       icon: '🦈', label: 'Bulette Fin',       color: '#6a7a5a', value: 38, monster: true },
  { id: 'terra_crystal',     icon: '🔶', label: 'Terra Crystal',     color: '#b08a4a', value: 48 },
  { id: 'stonegiant_heart',  icon: '🪨', label: 'Stone Giant Heart', color: '#8a857a', value: 44, monster: true },
  // Air
  { id: 'harpy_talon',       icon: '🦅', label: 'Harpy Talon',       color: '#b59ad6', value: 34, monster: true },
  { id: 'griffon_claw',      icon: '🐾', label: 'Griffon Claw',      color: '#c8a45a', value: 36, monster: true },
  { id: 'manticore_tail',    icon: '🦂', label: 'Manticore Tail',    color: '#aa4433', value: 38, monster: true },
  { id: 'aeolian_crystal',   icon: '🔹', label: 'Aeolian Crystal',   color: '#cfe8ff', value: 48 },
  { id: 'wyvern_sting',      icon: '🦂', label: 'Wyvern Stinger',    color: '#6a8a4a', value: 40, monster: true },
  { id: 'roc_talon',         icon: '🦅', label: 'Roc Talon',         color: '#b0855a', value: 40, monster: true },
  // Lightning
  { id: 'wisp_essence',      icon: '✨', label: 'Wisp Essence',      color: '#ffee33', value: 42 },
  { id: 'wyrmling_horn',     icon: '🐉', label: 'Wyrmling Horn',     color: '#4477cc', value: 40, monster: true },
  { id: 'behir_fang',        icon: '🦷', label: 'Behir Fang',        color: '#4488cc', value: 40, monster: true },
  { id: 'bluedragon_claw',   icon: '🐾', label: 'Blue Dragon Claw',  color: '#3366cc', value: 46, monster: true },
  { id: 'storm_rune',        icon: '🌩️', label: 'Storm Rune',        color: '#ffe066', value: 50 },
  // Luminous
  { id: 'pegasus_hoof',      icon: '🐴', label: 'Pegasus Hoof',      color: '#eaf2ff', value: 44, monster: true },
  { id: 'couatl_feather',    icon: '🪶', label: 'Couatl Feather',    color: '#66ccaa', value: 44, monster: true },
  { id: 'unicorn_mane',      icon: '🦄', label: 'Unicorn Mane',      color: '#ffeeff', value: 55, monster: true },
  { id: 'kirin_scale',       icon: '🦌', label: 'Ki-rin Scale',      color: '#ffe6aa', value: 48, monster: true },
  { id: 'deva_feather',      icon: '🪽', label: 'Deva Feather',      color: '#fff0b0', value: 46, monster: true },
  { id: 'planetar_blade',    icon: '⚔️', label: 'Planetar Blade',    color: '#fff0b0', value: 54 },
  // Necrotic
  { id: 'skull',             icon: '💀', label: 'Skull',             color: '#f4ead8', value: 24, monster: true },
  { id: 'rot_gland',         icon: '🧟', label: 'Rot Gland',         color: '#8a9a5a', value: 24, monster: true },
  { id: 'spectral_chain',    icon: '⛓️', label: 'Spectral Chain',    color: '#ccddee', value: 42 },
  { id: 'wraith_essence',    icon: '🌫️', label: 'Wraith Essence',    color: '#556677', value: 46 },
  { id: 'vampire_cloak',     icon: '🧛', label: 'Vampire Cloak',     color: '#aa2233', value: 48 },
  { id: 'lich_crown',        icon: '👑', label: 'Lich Crown',        color: '#66ddaa', value: 55 },
  // Poison
  { id: 'crawler_mandible',  icon: '🐛', label: 'Crawler Mandible',  color: '#99bb44', value: 34, monster: true },
  { id: 'troll_claw',        icon: '🐾', label: 'Troll Claw',        color: '#6a8a4a', value: 36, monster: true },
  { id: 'otyugh_maw',        icon: '🦑', label: 'Otyugh Maw',        color: '#88aa55', value: 36, monster: true },
  { id: 'treant_bark',       icon: '🪵', label: 'Treant Bark',       color: '#8a6a3a', value: 36 },
  { id: 'greendragon_fang',  icon: '🦷', label: 'Green Dragon Fang', color: '#44aa55', value: 46, monster: true },
  { id: 'worm_hide',         icon: '🪱', label: 'Worm Hide',         color: '#aa66aa', value: 44, monster: true },
  // Mana / Arcane
  { id: 'nothic_eye',        icon: '👁️', label: 'Nothic Eye',        color: '#cc88dd', value: 44, monster: true },
  { id: 'horror_visor',      icon: '🪖', label: 'Animus Visor',      color: '#8899aa', value: 48 },
  { id: 'flayer_tentacle',   icon: '🦑', label: 'Flayer Tentacle',   color: '#cc88bb', value: 52, monster: true },
  { id: 'gith_crystal',      icon: '🔮', label: 'Githyanki Crystal', color: '#b0c0d0', value: 54 },
  { id: 'beholder_eye',      icon: '👁️', label: 'Beholder Eye',      color: '#cc66bb', value: 56, monster: true },
  { id: 'rakshasa_pelt',     icon: '🐅', label: 'Rakshasa Pelt',     color: '#cc8844', value: 54, monster: true },
  // Volcanic
  { id: 'magmin_slag',       icon: '🌋', label: 'Magmin Slag',       color: '#ff6a2a', value: 32 },
  { id: 'firesnake_scale',   icon: '🐍', label: 'Fire Snake Scale',  color: '#dd5522', value: 34, monster: true },
  { id: 'azer_hammer',       icon: '🔨', label: 'Azer Hammer',       color: '#e0a050', value: 36 },
  { id: 'redwyrmling_horn',  icon: '🐉', label: 'Red Wyrmling Horn', color: '#cc3322', value: 38, monster: true },
  { id: 'flame_heart',       icon: '🔥', label: 'Flame Heart',       color: '#ff5522', value: 46 },
  { id: 'reddragon_claw',    icon: '🐾', label: 'Red Dragon Claw',   color: '#bb2211', value: 48, monster: true },
  // Shadow
  { id: 'shade_essence',     icon: '🌑', label: 'Shade Essence',     color: '#3a2a5a', value: 52 },
  { id: 'mastiff_pelt',      icon: '🐕', label: 'Shadow Mastiff Pelt',color: '#2a2038', value: 56, monster: true },
  { id: 'bodak_skull',       icon: '💀', label: 'Bodak Skull',       color: '#4a3a6a', value: 58, monster: true },
  { id: 'nightmare_mane',    icon: '🐴', label: 'Nightmare Mane',    color: '#5a3a7a', value: 60, monster: true },
  { id: 'demon_claw',        icon: '🐾', label: 'Shadow Demon Claw', color: '#2a1a44', value: 62, monster: true },
  { id: 'nightwalker_shard', icon: '🖤', label: 'Nightwalker Shard', color: '#1a0f2e', value: 66 },
];

// ─── Ores ─────────────────────────────────────────────────────────────────────
// Six raw ores, ordered common → rare. A 5% bonus find in any small chest (see
// handlePickup in player.js); which ore drops is set entirely by the region the
// chest sits in, so the earliest regions always yield the most common Grimsilver
// and the final Shadow region the priceless Voidsteel. Each ore is a stackable
// inventory item (key), shows in the Drops satchel (PASSIVE_DROPS), and any
// General Store buys the lot (TROPHY_SELL + the ore sell section in shop.js). The
// inventory key is the id itself (already plural-ish), and `value` is the per-unit
// sell price. Blacksmith flat ore-armor = (tier+1)×2, so Voidsteel forges +12.
const ORE_TYPES = [
  { id: 'grimsilver', icon: '🔘', label: 'Grimsilver', color: '#b9bcc6', value: 20  },
  { id: 'emberbrass', icon: '🟠', label: 'Emberbrass', color: '#d98a3a', value: 35  },
  { id: 'glimmerspar', icon: '🔵', label: 'Glimmerspar', color: '#4f8ff0', value: 60  },
  { id: 'wyrmgold',   icon: '🟡', label: 'Wyrmgold',   color: '#e8c14a', value: 95  },
  { id: 'eclipsium',  icon: '🟣', label: 'Eclipsium',  color: '#9a5cff', value: 150 },
  { id: 'voidsteel',  icon: '⬛', label: 'Voidsteel',  color: '#3a2e52', value: 230 },
];

// Map a 0-based region index (forest=0 … shadow=12) to its ore tier. The 13 regions
// band into the 6 ores: the first three (forest/fire/water) keep the common
// Grimsilver, then two regions per ore up the chain:
//   0-2 → Grimsilver, 3-4 → Emberbrass, 5-6 → Glimmerspar, 7-8 → Wyrmgold,
//   9-10 → Eclipsium, 11-12 → Voidsteel (volcanic=5 → Glimmerspar, shadow=12 → Voidsteel).
function oreForRegionIdx(idx) {
  const i = (typeof idx === 'number' && idx >= 0) ? idx : 0;
  const tier = i <= 2 ? 0 : i <= 4 ? 1 : i <= 6 ? 2 : i <= 8 ? 3 : i <= 10 ? 4 : 5;
  return ORE_TYPES[tier];
}

// Resolve which ore a map yields. Overworld/village maps carry `regionIdx`; cave
// chains carry `sourceTier` (the source region's enemyTier, which equals its
// region index); legacy caves fall back to `depth`. Defaults to region 0.
function oreForMap(map) {
  if (!map) return ORE_TYPES[0];
  const idx = typeof map.regionIdx === 'number' ? map.regionIdx
            : typeof map.sourceTier === 'number' ? map.sourceTier
            : typeof map.depth === 'number'      ? map.depth
            : 0;
  return oreForRegionIdx(idx);
}

// Resize canvas to fill viewport minus HUD/bottom bars. Called once at boot and on resize.
function resizeCanvas() {
  const hudH  = document.getElementById('hud')?.offsetHeight        || 0;
  const msgH  = document.getElementById('msg-bar')?.offsetHeight    || 0;
  const wepH  = document.getElementById('weapon-bar')?.offsetHeight || 0;
  const ctrlH = document.getElementById('ctrl-bar')?.offsetHeight   || 0;
  const saveH = document.getElementById('save-row')?.offsetHeight   || 0;
  const usedH = hudH + msgH + wepH + ctrlH + saveH;
  canvas.width  = window.innerWidth;
  canvas.height = Math.max(window.innerHeight - usedH, 200);
  PW = canvas.width;
  PH = canvas.height;
  VCOLS = Math.ceil(PW / TILE_PX) + 2;
  VROWS = Math.ceil(PH / TILE_PX) + 2;
  // clampCam might not be defined yet at first call
  if (typeof clampCam === 'function') clampCam();
}
window.addEventListener('resize', resizeCanvas);
