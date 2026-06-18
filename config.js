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
  MOUNTAIN_SAGE:83, MOSS_CLUMP:84, CRYSTAL_CLUSTER:85
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
  [T.STORM_GROUND]: '#3a3a4a',    [T.STORM_CLOUD]: '#2a2a40',
  [T.LUMINOUS_FLOOR]: '#f0e8a8',  [T.LUMINOUS_CRYSTAL]: '#ffe055',
  [T.BLIGHT]: '#3a2a3a',          [T.BLIGHTED_WALL]: '#1a0a1a',
  [T.SLUDGE]: '#5a7a2a',          [T.POISON_WALL]: '#2a4a18',
  [T.MANA_FLOOR]: '#5a3a8a',      [T.MANA_CRYSTAL]: '#aa66ee',
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
