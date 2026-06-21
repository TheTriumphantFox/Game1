// ─── Configuration ────────────────────────────────────────────────────────────
// Tile types, map dimensions, viewport setup, and color palette.
// All other modules import these via the global scope.

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

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
  // revert to LUMINOUS_FLOOR when cut and each shed a Light Mote: a RADIANT_BLOOM
  // (haloed white-gold flower), a GLOW_REED (slender light-stalks tipped with
  // glowing motes), and a LUMEN_SHARD (cluster of glowing crystal). LIGHT_PILLAR
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
  // sword-cuttable foliage that revert to SLUDGE when cut and shed an Herbal;
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
  COLOSSAL_TREE:120
};

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
};

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
