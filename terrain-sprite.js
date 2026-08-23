// ─── Terrain: baked ground and foot-anchored props ────────────────────────────
// Re-skins a region's terrain from the two sheets tools/make-terrain-sheet.lua
// generates for it, replacing the oldest cases in the procedural switch:
// T.GRASS is three fillRects and T.TREE is three arcs plus a 4x4 rectangle for
// a trunk, and between them they cover most of the pixels on a forest map.
//
// Read concept-art/village-layouts/ELEMENTS.md and terrain-art-plan.md
// first. The short version of why this file is shaped the way it is:
//
//   Element 59: there is no visible tile seam anywhere in the concept art. Not
//   in the grass, not in the treeline, not in the paving. Every paved area is
//   bounded by a continuous kerb with rounded corners, and nothing in the
//   picture is 48 pixels wide.
//
// So the tile grid stays as the GAMEPLAY structure (collision, connectivity,
// mapgen, save recipes all read it and none of that should move for a paint
// job), and stops being the DRAWING unit. Two mechanisms:
//
//   Baked ground. Turf, cobble, marble, dirt and water are painted once into
//     offscreen chunk canvases of CHUNK x CHUNK tiles and blitted whole. Inside
//     a chunk a paved area is traced into its real boundary loops and drawn as
//     one rounded path, so a road bend is an arc and a verge is a rounded
//     rectangle, which is what actually removes the seam. Per-cell work still
//     happens in there, but it happens ONCE per chunk rather than once per
//     frame, so it is free to be as expensive as it likes.
//
//   Foot-anchored props. Trees, flower drifts and boulders stop being tile art.
//     Each is a sprite anchored at its foot on a tile and drawn at whatever
//     size it wants, overhanging its neighbours freely, with the frame chosen
//     by a (col,row) hash. drawColossalTree and drawBigLandmark already work
//     exactly this way; this generalises the pattern from "the rare giant" to
//     "the ordinary tree", and routes it through the same depth merge so the
//     hero passes behind a canopy and in front of a trunk he has walked past.
//
// ONE SET OF ROLES, MANY SKINS. The thirteen concept sketches share their
// geometry exactly and differ only in palette and in which object fills each
// slot, so the generator emits the SAME frame names for every region and this
// file carries ONE frame table. A region is a different pair of PNGs, not a
// different code path. See TERRAIN_REGIONS below for the regions that are built.
//
// Sheets load LAZILY, per region, when a map of that region is first drawn.
// Thirteen regions' sheets are about 13 MB decoded and only one is ever on
// screen, so loading them all up front would be waste that grows with every
// region added.
//
// Loading is async and failure is survivable, same contract as
// village-sprite.js: until the images are ready, and forever if they 404, every
// entry point here reports "not mine" and the caller draws exactly what it drew
// before this file existed. The procedural switch stays in place underneath.

// Which of the game's thirteen region ids this art is built for, and which
// generated sheet pair each one uses. A region absent from here is untouched:
// its maps draw exactly as they did before this file existed.
//
// The key on the left is `mapObj.biome`, which is the REGION ID from regions.js
// and not an English word. The desert region's id is 'fire' (its village is the
// Oasis of the Damned), which is why the mapping is not an identity.
const TERRAIN_REGIONS = {
  forest: 'forest',
  fire:   'desert',
  water:  'coast',
  ice:    'ice',
  earth:    'earth',
  volcanic: 'volcanic',
  air:       'air',
  lightning: 'lightning',
  luminous:  'luminous',
  necrotic:  'necrotic',
  poison:    'poison',
  mana:      'mana',
  shadow:    'shadow',
};

const TERRAIN_ATLAS_OK = typeof TERRAIN_ATLAS !== 'undefined' && !!TERRAIN_ATLAS;

// Fallback shapes, used only so a missing atlas cannot throw on a property read.
const TP_FALLBACK_G = { tile: 48, cols: 4, frames: {} };
const TP_FALLBACK_P = { w: 96, h: 144, cols: 4, footX: 48, footY: 138, frames: {} };

// One record per region, created on first use: the two Images and their states.
const terrainSheets = new Map();

function terrainRegionOf(mapObj) {
  if (!mapObj) return null;
  return TERRAIN_REGIONS[mapObj.biome] || null;
}

function terrainAtlas(region) {
  if (!TERRAIN_ATLAS_OK || !region) return null;
  const a = TERRAIN_ATLAS[region];
  if (!a || !a.ground || !a.ground.frames || !(a.ground.tile > 0)) return null;
  if (!a.props || !a.props.frames || !(a.props.w > 0)) return null;
  return a;
}

// Kick off the two image loads for a region, once. Everything downstream asks
// about readiness rather than awaiting, so a slow or failed load degrades to
// "not mine" instead of stalling a frame.
function ensureTerrainSheets(region) {
  const a = terrainAtlas(region);
  if (!a) return null;
  let rec = terrainSheets.get(region);
  if (rec) return rec;
  rec = { groundImg: new Image(), propsImg: new Image(),
          groundState: 'loading', propsState: 'loading' };
  rec.groundImg.onload  = () => {
    rec.groundState = 'ready';
    // A sheet arriving mid-session invalidates any chunk baked without it.
    terrainGroundReset();
  };
  rec.groundImg.onerror = () => { rec.groundState = 'error'; };
  rec.propsImg.onload   = () => { rec.propsState = 'ready'; };
  rec.propsImg.onerror  = () => { rec.propsState = 'error'; };
  terrainSheets.set(region, rec);
  rec.groundImg.src = a.ground.sheet;
  rec.propsImg.src  = a.props.sheet;
  return rec;
}

function terrainGroundReady(region) {
  const rec = ensureTerrainSheets(region);
  return !!rec && rec.groundState === 'ready';
}

function terrainPropsReady(region) {
  const rec = ensureTerrainSheets(region);
  return !!rec && rec.propsState === 'ready';
}

// Which maps this art belongs to. Deliberately a PURE function of mapObj, with
// no reference to whether the images have loaded, because mapTallTiles memoizes
// its answer per map and would otherwise bake in whatever the load state
// happened to be on the first frame. The "have the pixels arrived yet" question
// is asked separately, at draw time, by terrainGroundReady / terrainPropsReady.
function terrainArtMap(mapObj) {
  return !!terrainRegionOf(mapObj) && !!terrainAtlas(terrainRegionOf(mapObj));
}

// ─── Ground categories ────────────────────────────────────────────────────────
// Which of the sheet's five ground materials a tile's FLOOR is made of. This is
// the tile's ground, not the tile: T.TREE's ground is shaded turf and the tree
// itself is a prop drawn on top of it, which is the whole point of the split.
//
// A tile absent from this table is not baked at all and falls through to the
// procedural switch untouched, so walls, doors, bridges, chests, portals and
// every non-forest tile keep exactly the art they have today.

// FGC_DEEP is separate from FGC_WATER because the coast concept's lagoon and
// its ocean are further apart than any other pair of materials in any sketch,
// and painting both from one ramp loses the breakwater entirely. The forest and
// the desert get the split for free: both already had T.DEEP_WATER mapped to
// the same tone as their shallows.
//
// FGC_LAVA is the one category whose tile is ALSO drawn by the procedural
// switch. See the volcanic block below: the bake supplies the rounded shape and
// the crust, and the animated glow draws over it. That combination is the
// general answer to the "baked water is static" gap, applied here first.
const FGC_BASE = 0, FGC_BASE_DARK = 1, FGC_PAVE = 2,
      FGC_PLAZA = 3, FGC_DIRT = 4, FGC_WATER = 5, FGC_DEEP = 6, FGC_LAVA = 7;

// Per region, because the same slot is a different tile in each: the forest's
// open ground is T.GRASS and the desert's is T.SAND, and the desert's roads are
// the pale fieldstone of the concept rather than the forest's dirt track.
const TERRAIN_GROUND_CAT = {
  forest: new Map([
    [T.GRASS,         FGC_BASE],
    [T.FLOWER,        FGC_BASE],
    [T.ROCK,          FGC_BASE],
    [T.STONES,        FGC_BASE],
    // Decorations that keep their existing art and only want the ground
    // underneath fixed. See TERRAIN_OVERLAY_TILES below.
    [T.FERN,          FGC_BASE],
    [T.MUSHROOM,      FGC_BASE],
    [T.VERDANT_FERN,  FGC_BASE],
    [T.MOSS_BOULDER,  FGC_BASE],
    // Ground under a canopy is shaded ground. Element 35: every canopy casts
    // its own shadow onto whatever is beneath it.
    [T.TREE,          FGC_BASE_DARK],
    [T.PATH,          FGC_DIRT],
    [T.COBBLESTONE,   FGC_PAVE],
    [T.MARBLE,        FGC_PLAZA],
    [T.WATER,         FGC_WATER],
    [T.SHALLOW_WATER, FGC_WATER],
    [T.DEEP_WATER,    FGC_DEEP],
  ].filter(([t]) => t !== undefined)),

  desert: new Map([
    [T.SAND,             FGC_BASE],
    [T.DUNE,             FGC_BASE],
    [T.ROCK,             FGC_BASE],
    [T.BONES,            FGC_BASE],
    [T.BONE_PILE,        FGC_BASE],
    [T.DESERT_OBELISK,   FGC_BASE],
    [T.FLOWERING_CACTUS, FGC_BASE],
    [T.DESERT_SUCCULENT, FGC_BASE],
    [T.CACTUS,           FGC_BASE_DARK],
    // The desert concept paves its roads and its house walks in the same pale
    // fieldstone as its ring, so T.PATH is PAVE here and DIRT in the forest.
    [T.PATH,             FGC_PAVE],
    [T.COBBLESTONE,      FGC_PAVE],
    [T.MARBLE,           FGC_PLAZA],
    [T.OASIS_WATER,      FGC_WATER],
    [T.WATER,            FGC_WATER],
    [T.SHALLOW_WATER,    FGC_WATER],
    [T.DEEP_WATER,       FGC_DEEP],
  ].filter(([t]) => t !== undefined)),

  // Tideborn Refuge. The open ground here is beach, and the region's border is
  // ocean rather than a treeline, so most of a coast map is one of the three
  // water tones with sand bars threaded through it.
  coast: new Map([
    [T.SAND,          FGC_BASE],
    [T.CORAL,         FGC_BASE],
    [T.SEASHELL,      FGC_BASE],
    [T.DRIFTWOOD,     FGC_BASE],
    [T.ROCK,          FGC_BASE],
    [T.STONES,        FGC_BASE],
    // Wet sand: the band the tide has just left, which the concept paints a
    // clear step darker than the dry beach behind it.
    [T.DUNE,          FGC_BASE_DARK],
    // regions.js gives this region `path: T.SAND`, so its overworld has no
    // T.PATH at all. The village does, and the concept paves it in the same
    // cool grey fieldstone as the ring, so PAVE is right for both.
    [T.PATH,          FGC_PAVE],
    [T.COBBLESTONE,   FGC_PAVE],
    [T.MARBLE,        FGC_PLAZA],
    [T.SHALLOW_WATER, FGC_WATER],
    [T.WATER,         FGC_WATER],
    [T.MEDIUM_WATER,  FGC_WATER],
    [T.DEEP_WATER,    FGC_DEEP],
  ].filter(([t]) => t !== undefined)),

  // Frostfast Hold. Back to the forest's shape: a border you can stand beside
  // (a glacier wall rather than a treeline), open ground between the roads, and
  // decorations scattered across it.
  ice: new Map([
    [T.SNOW,              FGC_BASE],
    [T.FROST_LILY,        FGC_BASE],
    [T.FROST_FERN,        FGC_BASE],
    [T.WINTER_BERRY_BUSH, FGC_BASE],
    [T.ICE_SPIRE,         FGC_BASE],
    [T.ROCK,              FGC_BASE],
    [T.STONES,            FGC_BASE],
    // Walkable ice keeps its own art (it is a surface with a look of its own,
    // and a bombable drift has to stay readable as one), and only wants the
    // snow underneath it fixed. Both are in TERRAIN_OVERLAY_TILES.
    [T.ICE,               FGC_BASE],
    [T.SNOW_DRIFT,        FGC_BASE],
    // Snow in shadow: under the pines and along the foot of the glacier.
    [T.SNOW_PINE,         FGC_BASE_DARK],
    [T.GLACIER,           FGC_BASE_DARK],
    [T.PATH,              FGC_PAVE],
    [T.COBBLESTONE,       FGC_PAVE],
    [T.MARBLE,            FGC_PLAZA],
    [T.WATER,             FGC_WATER],
    [T.SHALLOW_WATER,     FGC_WATER],
    [T.DEEP_WATER,        FGC_DEEP],
  ].filter(([t]) => t !== undefined)),

  // Stoneheart Burrow. T.MOUNTAIN is deliberately ABSENT: it is the region's
  // border and its procedural art autotiles against its neighbours to cap the
  // crests, which this per-cell system cannot express. Replacing it would trade
  // a cliff face for a row of boulders, so the mountainside keeps the art it
  // has and everything the hero actually walks on is re-skinned.
  earth: new Map([
    [T.SCREE,            FGC_BASE],
    [T.MOUNTAIN_SAGE,    FGC_BASE],
    [T.CRYSTAL_CLUSTER,  FGC_BASE],
    [T.STANDING_STONE,   FGC_BASE],
    [T.ROCK,             FGC_BASE],
    [T.STONES,           FGC_BASE],
    // Ground cover and bogs keep their own art over baked scree.
    [T.MOSS_CLUMP,       FGC_BASE],
    [T.MUD,              FGC_BASE_DARK],
    [T.PATH,             FGC_DIRT],
    [T.COBBLESTONE,      FGC_PAVE],
    [T.MARBLE,           FGC_PLAZA],
    [T.WATER,            FGC_WATER],
    [T.SHALLOW_WATER,    FGC_WATER],
    [T.DEEP_WATER,       FGC_DEEP],
  ].filter(([t]) => t !== undefined)),

  // Cinderhearth Bastion. T.LAVA and T.MAGMA_CRACK are baked AND still drawn by
  // the procedural switch, which is the interesting case.
  //
  // Both animate, and their pulsing glow is the whole reason the region reads
  // as volcanic, so freezing them was never acceptable. But leaving them out of
  // the bake entirely left every flow with hard square tile edges next to
  // ground whose every boundary is a rounded region, which looked worse than
  // either option on its own.
  //
  // Both are therefore in the ground table AND in TERRAIN_OVERLAY_TILES: the
  // bake supplies the rounded shape and the static crust, and the tile draws
  // its moving glow on top with its own base square suppressed. This is the
  // general answer to the water gap, and water should get the same treatment.
  volcanic: new Map([
    [T.VOLCANIC_GROUND, FGC_BASE],
    [T.EMBER_FLOWER,    FGC_BASE],
    [T.SULFUR_SHRUB,    FGC_BASE],
    [T.OBSIDIAN_SPIRE,  FGC_BASE],
    [T.ROCK,            FGC_BASE],
    [T.STONES,          FGC_BASE],
    // Ash in the shadow of the caldera rim.
    [T.VOLCANIC_ROCK,   FGC_BASE_DARK],
    [T.LAVA,            FGC_LAVA],
    [T.MAGMA_CRACK,     FGC_BASE],
    [T.PATH,            FGC_PAVE],
    [T.COBBLESTONE,     FGC_PAVE],
    [T.MARBLE,          FGC_PLAZA],
    [T.WATER,           FGC_WATER],
    [T.SHALLOW_WATER,   FGC_WATER],
    [T.DEEP_WATER,      FGC_DEEP],
  ].filter(([t]) => t !== undefined)),

  // Stormcrown Aerie. A sky region: the map is a cloud island floating in open
  // blue, so the deep-water category holds the SKY, which is exactly its role
  // (the impassable far surface past the map's rim).
  air: new Map([
    [T.CLOUD,          FGC_BASE],
    [T.SKY_BLOOM,      FGC_BASE],
    [T.WIND_REED,      FGC_BASE],
    [T.STORM_THISTLE,  FGC_BASE],
    [T.CLOUD_SPIRE,    FGC_BASE],
    // The brighter puffs standing above the walkable floor, and the island's
    // rim. Both take the second ground tone, which for this region is LIGHTER
    // than the first rather than darker; see the palette note in the generator.
    [T.CLOUDBANK,      FGC_BASE_DARK],
    [T.CLOUD_EDGE,     FGC_BASE_DARK],
    [T.SKY_GROUND,     FGC_DEEP],
    [T.PATH,           FGC_PAVE],
    [T.COBBLESTONE,    FGC_PAVE],
    [T.MARBLE,         FGC_PLAZA],
    [T.WATER,          FGC_WATER],
    [T.SHALLOW_WATER,  FGC_WATER],
    [T.DEEP_WATER,     FGC_DEEP],
  ].filter(([t]) => t !== undefined)),

  // Voltheart Bastion. The air region's structure with the lights off. Three
  // cloud tones rather than two: the walkable storm floor, the darker banks
  // dappled across it, and the near-black border thunderhead in the deep slot.
  //
  // T.STORM_SPIRE is mapped for its GROUND only and never as a prop. Its own
  // art crackles, and the existing enlarged-landmark pass already draws it at
  // 3x with that animation intact; taking it as a foot-anchored sprite would
  // trade a crackling spire for a still one.
  lightning: new Map([
    [T.STORM_GROUND,  FGC_BASE],
    [T.VOLT_BLOOM,    FGC_BASE],
    [T.SPARK_REED,    FGC_BASE],
    [T.FULGURITE,     FGC_BASE],
    [T.STORM_SPIRE,   FGC_BASE],
    [T.STORM_BANK,    FGC_BASE_DARK],
    [T.STORM_EDGE,    FGC_BASE_DARK],
    [T.STORM_CLOUD,   FGC_DEEP],
    [T.PATH,          FGC_PAVE],
    [T.COBBLESTONE,   FGC_PAVE],
    [T.MARBLE,        FGC_PLAZA],
    [T.WATER,         FGC_WATER],
    [T.SHALLOW_WATER, FGC_WATER],
    [T.DEEP_WATER,    FGC_DEEP],
  ].filter(([t]) => t !== undefined)),

  // Solarspire Sanctum. The region where EVERY tile animates, and therefore the
  // fullest use of bake-plus-overlay anywhere: the floor, its glow pools and its
  // blooms are all in the ground table AND in TERRAIN_OVERLAY_TILES, so the bake
  // gives them a textured golden floor with rounded paved regions and each tile
  // still draws its own pulsing light over the top.
  //
  // This region gets the SMALLEST frame-time win of the thirteen as a direct
  // result, because its ground tiles still draw every frame. That is the right
  // trade: the shimmer is the region.
  luminous: new Map([
    [T.LUMINOUS_FLOOR,   FGC_BASE],
    [T.LUMINOUS_GLOW,    FGC_BASE],
    [T.RADIANT_BLOOM,    FGC_BASE],
    // The light pillar keeps its animated enlarged-landmark art, exactly like
    // the lightning region's storm spire; only its ground is baked.
    [T.LIGHT_PILLAR,     FGC_BASE],
    // The crystal border is the one thing here taken as a prop. It gives up its
    // pulse for a shape, and it is worth it: this wall is the region's
    // signature and as flat tiles it was a coloured band.
    [T.LUMINOUS_CRYSTAL, FGC_BASE_DARK],
    [T.PATH,             FGC_PAVE],
    [T.COBBLESTONE,      FGC_PAVE],
    [T.MARBLE,           FGC_PLAZA],
    [T.WATER,            FGC_WATER],
    [T.SHALLOW_WATER,    FGC_WATER],
    [T.DEEP_WATER,       FGC_DEEP],
  ].filter(([t]) => t !== undefined)),

  // Ossuary of the Pale King. A graveyard: dark blight underfoot, crypt walls
  // and dead trees around the rim, headstones everywhere.
  //
  // Two tiles animate and both take bake-plus-overlay: the crypt wall and the
  // corpse flowers. The dead trees do not animate and become props, which is
  // what turns the border from a wall into a dead forest.
  necrotic: new Map([
    [T.BLIGHT,         FGC_BASE],
    [T.BONE_PILE,      FGC_BASE],
    [T.WITHERED_SHRUB, FGC_BASE],
    [T.TOMBSTONE,      FGC_BASE],
    [T.BONES,          FGC_BASE],
    [T.CORPSE_FLOWER,  FGC_BASE],
    [T.GRAVE_DIRT,     FGC_BASE_DARK],
    [T.BLIGHTED_WALL,  FGC_BASE_DARK],
    [T.DEAD_TREE,      FGC_BASE_DARK],
    [T.LAVA,           FGC_LAVA],
    [T.PATH,           FGC_PAVE],
    [T.COBBLESTONE,    FGC_PAVE],
    [T.MARBLE,         FGC_PLAZA],
    [T.WATER,          FGC_WATER],
    [T.SHALLOW_WATER,  FGC_WATER],
    [T.DEEP_WATER,     FGC_DEEP],
  ].filter(([t]) => t !== undefined)),

  // Mire-warden Citadel. The mire, bog and stagnant pools are baked, while
  // their moving bubbles and scum remain procedural overlays. The multi-tile
  // fallen log also remains an overlay because its caps and orientation depend
  // on neighboring log tiles. Mangroves, reeds and ferns become depth-sorted
  // props over the baked swamp floor.
  poison: new Map([
    [T.SLUDGE,         FGC_BASE],
    [T.CATTAIL,        FGC_BASE],
    [T.SWAMP_FERN,     FGC_BASE],
    [T.SWAMP_MUSHROOM, FGC_BASE],
    [T.FALLEN_LOG,     FGC_BASE],
    [T.MUSHROOM,       FGC_BASE],
    [T.ROCK,           FGC_BASE],
    [T.STONES,         FGC_BASE],
    [T.BOG,            FGC_BASE_DARK],
    [T.POISON_WALL,    FGC_BASE_DARK],
    [T.MANGROVE,       FGC_BASE_DARK],
    [T.BOG_POOL,       FGC_DEEP],
    [T.PATH,           FGC_PAVE],
    [T.COBBLESTONE,    FGC_PAVE],
    [T.MARBLE,         FGC_PLAZA],
    [T.WATER,          FGC_WATER],
    [T.SHALLOW_WATER,  FGC_WATER],
    [T.DEEP_WATER,     FGC_DEEP],
  ].filter(([t]) => t !== undefined)),

  // Heartstone Conclave. Crystal growth and ancient trees become tall props;
  // the moss, giant bloom and giant mushroom retain their distinctive tile
  // drawings over the cool teal baked floor.
  mana: new Map([
    [T.MANA_FLOOR,     FGC_BASE],
    [T.MANA_MOSS,      FGC_BASE],
    [T.GIANT_BLOOM,    FGC_BASE],
    [T.VERDANT_FERN,   FGC_BASE],
    [T.GIANT_MUSHROOM, FGC_BASE],
    [T.FLOWER,         FGC_BASE],
    [T.ROCK,           FGC_BASE],
    [T.STONES,         FGC_BASE],
    [T.MANA_CRYSTAL,   FGC_BASE_DARK],
    [T.GREAT_TREE,     FGC_BASE_DARK],
    [T.COLOSSAL_TREE,  FGC_BASE_DARK],
    [T.PATH,           FGC_PAVE],
    [T.COBBLESTONE,    FGC_PAVE],
    [T.MARBLE,         FGC_PLAZA],
    [T.WATER,          FGC_WATER],
    [T.SHALLOW_WATER,  FGC_WATER],
    [T.DEEP_WATER,     FGC_DEEP],
  ].filter(([t]) => t !== undefined)),

  // Umbral Sanctum. Black stone walls become broken depth-sorted masses while
  // the rifts keep their breathing violet light. Dapple and duskcap art stays
  // over the bake so the open waste is not reduced to a flat dark field.
  shadow: new Map([
    [T.SHADOW_GROUND,   FGC_BASE],
    [T.SHADOW_DAPPLE,   FGC_BASE],
    [T.GLOOM_BLOOM,     FGC_BASE],
    [T.VOID_FROND,      FGC_BASE],
    [T.SHADOW_MONOLITH, FGC_BASE],
    [T.ROCK,            FGC_BASE],
    [T.STONES,          FGC_BASE],
    [T.SHADOW_WALL,     FGC_BASE_DARK],
    [T.SHADOW_RIFT,     FGC_DEEP],
    [T.PATH,            FGC_PAVE],
    [T.COBBLESTONE,     FGC_PAVE],
    [T.MARBLE,          FGC_PLAZA],
    [T.WATER,           FGC_WATER],
    [T.SHALLOW_WATER,   FGC_WATER],
    [T.DEEP_WATER,      FGC_DEEP],
  ].filter(([t]) => t !== undefined)),
};

// Frame names per category, picked per cell by a (col,row) hash so neighbours
// differ. Shared across regions, because the generator emits identical frame
// names for every region and only the pixels differ. Every ground frame is
// seamless in both axes, so a run of mixed variants has no boundary either.
const FG_VARIANTS = [
  ['ground_a', 'ground_b', 'ground_c', 'ground_d'],
  ['ground_dark_a', 'ground_dark_b'],
  ['pave_a', 'pave_b', 'pave_c', 'pave_d'],
  ['plaza_a', 'plaza_b', 'plaza_c', 'plaza_d'],
  ['dirt_a', 'dirt_b'],
  ['water_a', 'water_b'],
  ['deep_a', 'deep_b'],
  ['lava_a', 'lava_b'],
];

// The paved categories, in painting order: each is traced as a region and drawn
// over the base. Plaza after pave because it sits inside the ring road and has
// to win where they meet.
// Every category that is TRACED as a region and drawn over the base, in
// painting order. Deep before shallow, so a lagoon traced over an ocean wins at
// the shoreline rather than the other way round.
//
const FG_TRACED = [FGC_BASE_DARK, FGC_DIRT, FGC_PAVE, FGC_PLAZA,
                   FGC_DEEP, FGC_WATER, FGC_LAVA];

// Tracing the SECOND ground tone is opt-in per region, and the opt-in is there
// for a measured reason.
//
// The two ground tones used to have the one hard-edged square boundary left in
// the renderer, because the second tone was painted per cell in the base pass
// rather than traced. That never showed in the first six regions: there the
// second tone only appears under a treeline or a cactus band, where props cover
// it. On the air region it is T.CLOUDBANK, an open floor over a third of the
// map, and the square edges were glaring.
//
// Tracing it everywhere fixed that and cost too much. It is a full extra region
// trace, clip and per-cell fill per chunk, over an area that on a forest map is
// most of the map, and it roughly doubled the bake: walking 100 tiles went from
// dropping ZERO frames to dropping one to three, with spikes to 48 ms. So it is
// paid only where it buys something.
const TERRAIN_TRACE_DARK = { air: true, lightning: true };

// Element 4: a thin continuous kerb, with a darker line outside it for
// definition. Water gets a dark shore line instead, because a pale kerb around
// a pond would read as a swimming pool. Per region, so the desert's bleached
// stone does not get the forest's cool grey edge.
const TERRAIN_KERB = {
  forest: { dark: '#6f6858', light: '#cbc4ae', shore: '#2c4a3a' },
  desert: { dark: '#9c7b52', light: '#f0d1a6', shore: '#1d6a86' },
  // The coast's shore line is the pale wet-sand edge the concept draws wherever
  // water meets beach, not a dark outline: this is the one region where the
  // waterline is the brightest thing in the frame rather than the darkest.
  coast:  { dark: '#8b867a', light: '#e2ddd0', shore: '#f2e6cc' },
  // Snow banked against the kerb: the pale edge is brighter than the paving it
  // borders, which is the opposite of every other region.
  ice:    { dark: '#9aa3ac', light: '#eef4fa', shore: '#7ba5cc' },
  earth:  { dark: '#5d5446', light: '#bcb4a6', shore: '#3a4a3a' },
  volcanic: { dark: '#1c1613', light: '#675a4e', shore: '#123a4e' },
  // The "shore" here is the cloud island's rim against open sky, so it is the
  // brightest edge of any region rather than a dark waterline.
  air:      { dark: '#98a0ac', light: '#f4f5f8', shore: '#ffffff' },
  // The island rim again, but lit by the bolts running round it rather than by
  // daylight. Kept DIM: a bolt-white shore line drew a hard bright outline
  // around every thunderhead and read as a cartoon border, not as weather.
  lightning: { dark: '#2b2e3f', light: '#a0a1b1', shore: '#4a4470' },
  luminous:  { dark: '#c0ac78', light: '#f9f5e6', shore: '#8fbcd4' },
  necrotic:  { dark: '#3a3230', light: '#9c948c', shore: '#1c3844' },
  poison:    { dark: '#565344', light: '#c0bdae', shore: '#4c6c29' },
  mana:      { dark: '#514e6b', light: '#c0b4d5', shore: '#258aa0' },
  shadow:    { dark: '#151118', light: '#8a8385', shore: '#432366' },
};

// Tiles whose GROUND is baked but whose own decoration still has to be drawn,
// because this art does not replace it. A fern and a mushroom are fine as they
// are; all they needed was to stop painting a flat green square through the
// ground underneath them.
const TERRAIN_OVERLAY_TILES = new Set(
  [T.FERN, T.MUSHROOM, T.VERDANT_FERN, T.DUNE,
   T.ICE, T.SNOW_DRIFT, T.MOSS_CLUMP, T.MUD,
   // Both animate. The bake gives them their shape; these keep their motion.
   T.LAVA, T.MAGMA_CRACK,
   // The whole luminous region animates. Its floor, glow pools and blooms all
   // draw their light as translucent washes, so they sit on the bake perfectly.
   T.LUMINOUS_FLOOR, T.LUMINOUS_GLOW, T.RADIANT_BLOOM,
   // The necrotic corpse flowers pulse. The crypt wall pulses too but is a
   // PROP here rather than an overlay: as a tile it painted flat saturated
   // purple squares that read as a checkerboard against the baked blight, and
   // trading that pulse for stone rubble is the same call the luminous crystal
   // wall got.
   T.CORPSE_FLOWER,
   // Poison keeps its bubbles, drifting pool scum and mushroom glow. Fallen
   // logs stay here too because each segment reads its neighboring log tiles.
   T.BOG, T.BOG_POOL, T.SWAMP_MUSHROOM, T.FALLEN_LOG,
   // Mana keeps its moss cushions and the animated hearts of its oversized
   // flowers and mushrooms. Shadow keeps its open gloom and rift glow.
   T.MANA_MOSS, T.GIANT_BLOOM, T.GIANT_MUSHROOM,
   T.SHADOW_DAPPLE, T.SHADOW_RIFT, T.GLOOM_BLOOM,
  ].filter(t => t !== undefined));

function terrainGroundCat(region, t) {
  const m = TERRAIN_GROUND_CAT[region];
  if (!m) return -1;
  const c = m.get(t);
  return c === undefined ? -1 : c;
}

// How the tile loop should treat this tile.
//
//   FG_COVER_NONE     not ours. Draw it exactly as before.
//   FG_COVER_FULL     the bake (and, for a tree, the prop pass) is the whole
//                     tile. Skip it.
//   FG_COVER_OVERLAY  the bake is the ground; draw the tile's own art on top of
//                     it without its base square.
//
// Asks readiness too, so a failed sheet load leaves every tile to the
// procedural switch and the game looks exactly as it did before.
const FG_COVER_NONE = 0, FG_COVER_FULL = 1, FG_COVER_OVERLAY = 2;

function terrainGroundCovers(mapObj, t) {
  const region = terrainRegionOf(mapObj);
  if (!region || !terrainGroundReady(region)) return FG_COVER_NONE;
  if (terrainGroundCat(region, t) < 0) return FG_COVER_NONE;
  // A region can promote a tile that is an overlay elsewhere into a prop. The
  // depth-sorted sprite owns its decoration, so the flat procedural art must
  // not also draw underneath it.
  if (terrainPropSet(region, t)) return FG_COVER_FULL;
  return TERRAIN_OVERLAY_TILES.has(t) ? FG_COVER_OVERLAY : FG_COVER_FULL;
}

// ─── Chunk cache ──────────────────────────────────────────────────────────────
// CHUNK is 16 tiles: at TILE_PX 48 that is a 768px chunk plus a 1-tile bleed
// margin on each side, so 864x864 and about 3 MB decoded. A 1280x800 viewport
// spans at most 3x2 of them, so an LRU of 12 holds a screen with slack.
//
// The bleed margin is not decoration. Corner rounding and the kerb stroke both
// depend on cells OUTSIDE the chunk, and without the margin a road crossing a
// chunk boundary would grow a rounded end-cap and a kerb across the middle of
// itself. The margin is baked and then cropped away by the blit.

// A chunk is a fixed number of PIXELS, not a fixed number of tiles.
//
// It was 16 tiles flat, and that was measured wrong at the smaller zoom. At
// TILE_PX 48 a 1280x723 viewport spans about 3x2 of them, comfortably inside an
// LRU of 12. At TILE_PX 24 the same viewport covers twice as many tiles per
// axis and so needs up to 5x3 = 15, which is MORE than the cache holds: every
// frame evicted chunks it was about to need and re-baked them. Measured at
// 28.8 ms median per frame against a 16.7 ms budget, versus 2.3 ms with this
// art switched off. A bake is about 2 ms, and 15 of them per frame is the whole
// number.
//
// Holding the pixel size constant instead makes the chunks-per-screen count
// independent of zoom: 16 tiles at 48, 32 tiles at 24, and the same handful of
// canvases either way.
//
// 384, down from 768. The chunk is the unit of work for ONE bake, so its area
// sets the size of the worst frame: crossing a boundary bakes two or three at
// once. Walking 100 tiles at TILE_PX 24, counting frames over the 16.7 ms
// budget:
//
//   768 px   forest 0, volcanic 2, air 2   (worst frame 31.0 ms)
//   512 px   forest 0, volcanic 1, air 2   (worst frame 21.1 ms)
//   384 px   forest 0, volcanic 1, air 0   (worst frame 16.9 ms)
//
// Total work is unchanged; it is just spread over more, smaller bakes, and the
// per-frame blit count stays trivial either way.
const TERRAIN_CHUNK_PX = 384;
const TERRAIN_CHUNK_MARGIN = 1;
const TERRAIN_CHUNK_LRU_MIN = 12;

const terrainChunks = new Map();     // 'cc,cr' -> canvas
let terrainChunkTs   = 0;            // the TILE_PX every cached chunk was baked at
let terrainChunkMap  = null;         // the map object they belong to
let TERRAIN_CHUNK    = 16;           // chunk edge in tiles, derived from TILE_PX
let terrainChunkLru  = TERRAIN_CHUNK_LRU_MIN;

// Recompute the chunk geometry for a zoom level. Clamped at both ends: too few
// tiles per chunk and the per-chunk overhead dominates, too many and one bake
// becomes a visible hitch.
function terrainChunkGeometry(ts) {
  const S = Math.max(1, Math.round(ts));
  TERRAIN_CHUNK = Math.max(8, Math.min(48, Math.round(TERRAIN_CHUNK_PX / S)));
  // Cap the cache at twice what the viewport can span, so walking never evicts
  // a chunk that is still on screen however the window is shaped.
  const wide = Math.ceil((PW / S) / TERRAIN_CHUNK) + 2;
  const tall = Math.ceil((PH / S) / TERRAIN_CHUNK) + 2;
  terrainChunkLru = Math.max(TERRAIN_CHUNK_LRU_MIN, wide * tall * 2);
}

function terrainGroundReset() {
  terrainChunks.clear();
  terrainChunkTs = 0;
  terrainChunkMap = null;
}

// Drop the chunk containing a tile, plus any neighbour whose bleed margin
// overlaps it. Call this from wherever the world writes a tile: a bombed rock
// or a burnt tile has to change the ground under it.
function terrainGroundInvalidate(col, row) {
  if (terrainChunks.size === 0) return;
  const cc = Math.floor(col / TERRAIN_CHUNK), cr = Math.floor(row / TERRAIN_CHUNK);
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) terrainChunks.delete((cc + dc) + ',' + (cr + dr));
  }
}

function terrainChunkGet(region, mapObj, map, cc, cr, ts) {
  // Any change of zoom or of map invalidates every baked pixel at once, and a
  // change of zoom also re-derives how big a chunk is.
  if (ts !== terrainChunkTs || mapObj !== terrainChunkMap) {
    terrainChunks.clear();
    terrainChunkGeometry(ts);
    terrainChunkTs = ts;
    terrainChunkMap = mapObj;
  }
  const key = cc + ',' + cr;
  const hit = terrainChunks.get(key);
  if (hit) {
    terrainChunks.delete(key);          // LRU: re-insert at the young end
    terrainChunks.set(key, hit);
    return hit;
  }
  const baked = terrainBakeChunk(region, map, cc, cr, ts);
  if (!baked) return null;
  terrainChunks.set(key, baked);
  while (terrainChunks.size > terrainChunkLru) {
    terrainChunks.delete(terrainChunks.keys().next().value);
  }
  return baked;
}

// ─── Region tracing ───────────────────────────────────────────────────────────
// The seam-killer. Given a predicate over cells, walk the boundary between
// in-region and out-of-region cells and return closed loops of grid-space
// points. Because the region is a union of unit cells, every boundary edge is
// axis-aligned and one tile long, so this is an edge walk rather than a real
// marching-squares pass.
//
// Winding is consistent: each cell contributes its open sides clockwise in
// screen space (y down), which makes outer boundaries wind one way and holes
// the other. That is what lets a single nonzero fill leave a hole empty
// without any special handling.
function terrainTraceRegion(inRegion, c0, r0, c1, r1) {
  const out = new Map();               // 'x,y' -> array of end points
  const push = (ax, ay, bx, by) => {
    const k = ax + ',' + ay;
    const list = out.get(k);
    if (list) list.push(bx, by); else out.set(k, [bx, by]);
  };
  for (let r = r0; r < r1; r++) {
    for (let c = c0; c < c1; c++) {
      if (!inRegion(c, r)) continue;
      if (!inRegion(c, r - 1)) push(c,     r,     c + 1, r);
      if (!inRegion(c + 1, r)) push(c + 1, r,     c + 1, r + 1);
      if (!inRegion(c, r + 1)) push(c + 1, r + 1, c,     r + 1);
      if (!inRegion(c - 1, r)) push(c,     r + 1, c,     r);
    }
  }

  const loops = [];
  // A vertex can start TWO edges, where two cells of the region meet only at a
  // corner. Popping an arbitrary one there is not good enough: the walk can
  // leave down the wrong branch, strand the edges it skipped, and return a
  // boundary broken into several partial chains. Closing those chains produced
  // shapes that filled part of a water body and left the rest painted as the
  // ground underneath it.
  //
  // So at a pinch the outgoing edge is chosen by how it turns relative to the
  // incoming one, preferring the sharpest RIGHT turn. The cell winding above is
  // clockwise in screen space (y down), so always turning right keeps the walk
  // hugging the same component instead of jumping to the one touching it at
  // that corner.
  const RIGHT = 3, STRAIGHT = 2, LEFT = 1, BACK = 0;
  const take = (x, y, dx, dy) => {
    const k = x + ',' + y;
    const list = out.get(k);
    if (!list || list.length === 0) return null;
    let bestI = 0;
    if (list.length > 2 && (dx !== 0 || dy !== 0)) {
      let bestRank = -1;
      for (let i = 0; i < list.length; i += 2) {
        const ex = list[i] - x, ey = list[i + 1] - y;
        const cross = dx * ey - dy * ex;
        const dot   = dx * ex + dy * ey;
        const rank = cross > 0 ? RIGHT : cross < 0 ? LEFT : (dot > 0 ? STRAIGHT : BACK);
        if (rank > bestRank) { bestRank = rank; bestI = i; }
      }
    }
    const bx = list[bestI], by = list[bestI + 1];
    list.splice(bestI, 2);
    if (list.length === 0) out.delete(k);
    return [bx, by];
  };
  for (const startKey of Array.from(out.keys())) {
    let seed = out.get(startKey);
    while (seed && seed.length) {
      const comma = startKey.indexOf(',');
      const sx = +startKey.slice(0, comma), sy = +startKey.slice(comma + 1);
      const loop = [sx, sy];
      let cx = sx, cy = sy, dx = 0, dy = 0, guard = 0;
      for (;;) {
        const nxt = take(cx, cy, dx, dy);
        if (!nxt) break;                       // open chain, should not happen
        dx = nxt[0] - cx; dy = nxt[1] - cy;
        cx = nxt[0]; cy = nxt[1];
        if (cx === sx && cy === sy) break;      // closed
        loop.push(cx, cy);
        if (++guard > 1e5) break;               // never spin on malformed data
      }
      if (loop.length >= 6) loops.push(loop);
      seed = out.get(startKey);
    }
  }
  return loops;
}

// Drop the middle point of any three consecutive collinear points, so a
// straight run of tiles becomes one long segment. Without this every corner
// radius would be clamped to half a tile by its own neighbours and long
// straight roads would come out scalloped.
function terrainSimplifyLoop(loop) {
  const n = loop.length / 2;
  if (n < 3) return loop;
  const out = [];
  for (let i = 0; i < n; i++) {
    const px = loop[((i - 1 + n) % n) * 2], py = loop[((i - 1 + n) % n) * 2 + 1];
    const cx = loop[i * 2],                 cy = loop[i * 2 + 1];
    const nx = loop[((i + 1) % n) * 2],     ny = loop[((i + 1) % n) * 2 + 1];
    if ((cx - px) * (ny - cy) - (cy - py) * (nx - cx) !== 0) out.push(cx, cy);
  }
  return out.length >= 6 ? out : loop;
}

// Build the rounded path. arcTo does the work and does it correctly for both
// turn directions, which is exactly what elements 12 and 4 describe: a convex
// corner of a verge becomes a rounded rectangle corner, and the inner elbow
// where a road turns becomes a fillet, with no separate case for either.
//
// The radius is clamped to just under half the shorter adjacent segment so
// adjacent corners on a one-tile-wide path cannot overrun each other.
function terrainRoundedPath(g, loops, px, py, S, radius) {
  g.beginPath();
  for (const raw of loops) {
    const loop = terrainSimplifyLoop(raw);
    const n = loop.length / 2;
    if (n < 3) continue;
    const X = i => px(loop[((i % n) + n) % n * 2]);
    const Y = i => py(loop[((i % n) + n) % n * 2 + 1]);
    const segLen = i => Math.hypot(X(i + 1) - X(i), Y(i + 1) - Y(i));

    // Start halfway along the last segment, so the first arc has a real
    // incoming edge to blend from and the loop closes cleanly.
    g.moveTo((X(-1) + X(0)) / 2, (Y(-1) + Y(0)) / 2);
    for (let i = 0; i < n; i++) {
      const r = Math.min(radius, segLen(i - 1) * 0.49, segLen(i) * 0.49);
      if (r > 0.5) g.arcTo(X(i), Y(i), X(i + 1), Y(i + 1), r);
      else         g.lineTo(X(i), Y(i));
    }
    g.closePath();
  }
}

// ─── Baking ───────────────────────────────────────────────────────────────────

function terrainGroundFrameRect(gdesc, name) {
  const idx = gdesc.frames[name];
  if (idx === undefined) return null;
  const t = gdesc.tile, cols = gdesc.cols;
  return { sx: (idx % cols) * t, sy: Math.floor(idx / cols) * t, s: t };
}

// Cheap deterministic per-cell hash, matching the style the tile cache's
// VARIANT_TILE_HASH already uses so variant choice is stable across a reload.
function terrainCellHash(c, r) {
  return ((c * 113 + r * 71) ^ (c * 31 + r * 17)) >>> 0;
}

function terrainBakeChunk(region, map, cc, cr, ts) {
  const atlas = terrainAtlas(region);
  const rec   = terrainSheets.get(region);
  if (!atlas || !rec) return null;
  const gdesc = atlas.ground;
  const kerb  = TERRAIN_KERB[region] || TERRAIN_KERB.forest;
  const S = Math.max(1, Math.round(ts));
  const M = TERRAIN_CHUNK_MARGIN;
  const side = (TERRAIN_CHUNK + M * 2) * S;
  const cv = makeSpriteCanvas(side, side);
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;      // 1px ink lines turn to grey mush otherwise

  const c0 = cc * TERRAIN_CHUNK - M, r0 = cr * TERRAIN_CHUNK - M;
  const c1 = c0 + TERRAIN_CHUNK + M * 2, r1 = r0 + TERRAIN_CHUNK + M * 2;
  const px = c => (c - c0) * S, py = r => (r - r0) * S;

  const at = (c, r) =>
    (c < 0 || r < 0 || c >= MCOLS || r >= MROWS) ? -1 : terrainGroundCat(region, map[r][c]);

  const blitCell = (cat, c, r) => {
    const names = FG_VARIANTS[cat];
    const f = terrainGroundFrameRect(gdesc, names[terrainCellHash(c, r) % names.length]);
    if (!f) return;
    g.drawImage(rec.groundImg, f.sx, f.sy, f.s, f.s, px(c), py(r), S, S);
  };

  // 1. Base ground, everywhere in the chunk that this art owns at all. Where the
  //    second tone is traced (see TERRAIN_TRACE_DARK) this lays plain base under
  //    it and step 2 draws it as a rounded region; where it is not, the second
  //    tone is blitted straight in here, per cell, which is the cheap path.
  //    Cells the bake does not own are left transparent and the tile loop paints
  //    them over the top with their own opaque square.
  const traceDark = !!TERRAIN_TRACE_DARK[region];
  for (let r = r0; r < r1; r++) {
    for (let c = c0; c < c1; c++) {
      const cat = at(c, r);
      if (cat < 0) continue;
      blitCell(!traceDark && cat === FGC_BASE_DARK ? FGC_BASE_DARK : FGC_BASE, c, r);
    }
  }

  // 2. Each traced material, drawn as one rounded region over that base.
  const radius = S * 0.34;
  for (const cat of FG_TRACED) {
    if (cat === FGC_BASE_DARK && !traceDark) continue;
    // Clamped to the trace range, and that clamp is load-bearing.
    //
    // `at` reads the real map, so without this a region that continues past the
    // range has no boundary edge where it crosses: the traced "boundary" is a
    // set of OPEN chains, not closed loops, and closing them produced shapes
    // that filled part of a water body and left the rest showing the ground
    // painted underneath. It only became obvious on the coast, where water
    // crosses every chunk edge; the forest's paths and plazas mostly sat inside
    // one chunk and closed by luck.
    //
    // The artificial edge this introduces sits at the range boundary, which is
    // TERRAIN_CHUNK_MARGIN tiles outside the area the blit actually shows, so
    // neither its rounding nor its kerb is ever visible. That margin is why it
    // is safe, and it is why the margin cannot be dropped to zero.
    const inRegion = (c, r) =>
      c >= c0 && r >= r0 && c < c1 && r < r1 && at(c, r) === cat;
    let any = false;
    for (let r = r0; r < r1 && !any; r++) {
      for (let c = c0; c < c1; c++) { if (inRegion(c, r)) { any = true; break; } }
    }
    if (!any) continue;

    const loops = terrainTraceRegion(inRegion, c0, r0, c1, r1);
    if (!loops.length) continue;

    // Fill: clip to the rounded region, then blit per-cell variants inside it.
    // One pattern fill would have been simpler and would have thrown away the
    // texture variety the four variants exist for.
    g.save();
    terrainRoundedPath(g, loops, px, py, S, radius);
    g.clip();
    for (let r = r0; r < r1; r++) {
      for (let c = c0; c < c1; c++) if (inRegion(c, r)) blitCell(cat, c, r);
    }
    g.restore();

    // Kerb: stroked on the same path, so it is one continuous line around the
    // whole region with rounded corners, and never a per-cell outline.
    g.save();
    terrainRoundedPath(g, loops, px, py, S, radius);
    g.lineJoin = 'round';
    g.lineCap  = 'round';
    // Weights are deliberately light. The first pass used 0.10 and 0.05 of a
    // tile, and on a one-tile-wide forest track the two strokes between them ate
    // most of the path: the track read as a kerb with a little dirt in it rather
    // than as a path with an edge.
    if (cat === FGC_LAVA || cat === FGC_BASE_DARK) {
      // No kerb at all. A lava flow has no edging, and the boundary between two
      // tones of the same ground is a shading change, not a built edge.
      g.restore();
      continue;
    }
    if (cat === FGC_WATER || cat === FGC_DEEP) {
      // Both water tones take the shore line, not the kerb: a pale dressed-stone
      // edge around open water reads as the lip of a swimming pool.
      g.lineWidth = Math.max(1, S * (cat === FGC_DEEP ? 0.03 : 0.045));
      g.strokeStyle = kerb.shore;
      g.stroke();
    } else {
      g.lineWidth = Math.max(1.5, S * 0.055);
      g.strokeStyle = kerb.dark;
      g.stroke();
      g.lineWidth = Math.max(1, S * 0.028);
      g.strokeStyle = kerb.light;
      g.stroke();
    }
    g.restore();
  }

  return cv;
}

// ─── Ground draw ──────────────────────────────────────────────────────────────
// Blit every chunk the viewport touches. Called from render() ahead of the tile
// loop; the tile loop then skips whatever terrainGroundCovers claims.
function drawTerrainGround(mapObj, map, ts, startC, startR, endC, endR) {
  const region = terrainRegionOf(mapObj);
  if (!region || !terrainGroundReady(region)) return false;
  // Refresh the geometry BEFORE the chunk range is computed from it. Doing it
  // only inside terrainChunkGet would compute this frame's range with the
  // previous zoom's chunk size.
  if (ts !== terrainChunkTs || mapObj !== terrainChunkMap) terrainChunkGeometry(ts);
  const S = Math.max(1, Math.round(ts));
  const M = TERRAIN_CHUNK_MARGIN;
  const cc0 = Math.floor(startC / TERRAIN_CHUNK), cc1 = Math.floor(endC / TERRAIN_CHUNK);
  const cr0 = Math.floor(startR / TERRAIN_CHUNK), cr1 = Math.floor(endR / TERRAIN_CHUNK);
  for (let cr = cr0; cr <= cr1; cr++) {
    for (let cc = cc0; cc <= cc1; cc++) {
      const cv = terrainChunkGet(region, mapObj, map, cc, cr, ts);
      if (!cv) continue;
      // Crop the bleed margin away: only the chunk's own CHUNK x CHUNK area is
      // blitted, at the screen position of its top-left tile.
      //
      // BOTH edges are floored and the size is their difference, rather than
      // flooring the origin and using a fixed size. Flooring each chunk's origin
      // independently lets a fractional camera put neighbours one pixel apart,
      // and that gap showed as a hairline running the full width of the screen
      // along every chunk boundary.
      const dx0 = Math.floor((cc * TERRAIN_CHUNK - camC) * ts);
      const dy0 = Math.floor((cr * TERRAIN_CHUNK - camR) * ts);
      const dx1 = Math.floor(((cc + 1) * TERRAIN_CHUNK - camC) * ts);
      const dy1 = Math.floor(((cr + 1) * TERRAIN_CHUNK - camR) * ts);
      ctx.drawImage(cv, M * S, M * S, TERRAIN_CHUNK * S, TERRAIN_CHUNK * S,
                    dx0, dy0, dx1 - dx0, dy1 - dy0);
    }
  }
  return true;
}

// ─── Props ────────────────────────────────────────────────────────────────────
// Frame sets per tile type. The renderer picks one per (col,row) hash, so a
// treeline is a mix of sizes the way element 32 describes rather than a row of
// identical stamps. Weighted by repetition: the big trees appear three times in
// the tree list, so they dominate and the small ones read as undergrowth.

// Frame ROLES per tile type, per region. The renderer picks one per (col,row)
// hash, so a treeline is a mix of sizes the way element 32 describes rather
// than a row of identical stamps. Weighted by repetition: the big growth
// appears several times in each list, so it dominates and the small entries
// read as undergrowth.
//
// The role names are identical across regions by construction (see the header
// of tools/make-terrain-sheet.lua), so what differs here is only WHICH TILE
// maps to which role.
const TERRAIN_PROP_SETS = {
  forest: new Map([
    [T.TREE,   ['growth_big_a', 'growth_big_b', 'growth_big_c', 'growth_big_d',
                'growth_big_e', 'growth_big_a', 'growth_big_d',
                'growth_mid_a', 'growth_mid_b', 'growth_mid_c',
                'growth_small_a', 'growth_small_b', 'growth_alt_a']],
    [T.FLOWER, ['bloom_a', 'bloom_b', 'bloom_c']],
    [T.ROCK,   ['boulder_a', 'boulder_b']],
    [T.STONES, ['boulder_b', 'debris_a']],
    // The forest's signature landmark. Taking it here means it stops going
    // through drawBigLandmark, which drew it by scaling its own 48px tile art
    // up 3x: fine next to the old procedural turf, and plainly a blown-up
    // small sprite next to the new. `landmark` is authored at that size.
    [T.MOSS_BOULDER, ['landmark']],
  ].filter(([t]) => t !== undefined)),

  desert: new Map([
    // The desert concept plants saguaros in the border band where the forest
    // plants trees, mixed with barrel cactus at the small end.
    [T.CACTUS, ['growth_big_a', 'growth_big_b', 'growth_big_c', 'growth_big_d',
                'growth_big_e', 'growth_big_a', 'growth_big_c',
                'growth_mid_a', 'growth_mid_b', 'growth_mid_c',
                'growth_small_a', 'growth_small_b']],
    [T.FLOWERING_CACTUS, ['growth_alt_a', 'growth_alt_b', 'shrub_a']],
    [T.DESERT_SUCCULENT, ['shrub_a', 'shrub_b', 'shrub_c']],
    [T.ROCK,             ['boulder_a', 'boulder_b']],
    // Elements of "of the Damned": rib cages and horned skulls half sunk in
    // the sand, which the concept scatters right across its open ground.
    [T.BONES,            ['debris_a', 'debris_b']],
    [T.BONE_PILE,        ['debris_b', 'debris_a']],
    [T.DESERT_OBELISK,   ['landmark']],
  ].filter(([t]) => t !== undefined)),

  coast: new Map([
    // Coral is this region's growth, and it is scattered on sand at low density
    // rather than sealing a border, so unlike the treeline and the cactus band
    // there is never a wall of it.
    [T.CORAL,     ['growth_big_a', 'growth_big_b', 'growth_big_c', 'growth_big_d',
                   'growth_big_e', 'growth_mid_a', 'growth_mid_b', 'growth_mid_c',
                   'growth_small_a', 'growth_small_b',
                   'growth_alt_a', 'growth_alt_b', 'shrub_a', 'shrub_b', 'shrub_c']],
    [T.SEASHELL,  ['debris_a', 'debris_b', 'bloom_a', 'bloom_b', 'bloom_c']],
    [T.DRIFTWOOD, ['landmark']],
    [T.ROCK,      ['boulder_a', 'boulder_b']],
    [T.STONES,    ['boulder_b', 'debris_a']],
  ].filter(([t]) => t !== undefined)),

  ice: new Map([
    [T.SNOW_PINE,         ['growth_big_a', 'growth_big_b', 'growth_big_c',
                           'growth_big_d', 'growth_big_e', 'growth_big_a',
                           'growth_mid_a', 'growth_mid_b', 'growth_mid_c',
                           'growth_small_a', 'growth_small_b']],
    // The glacier is the border wall, so it gets the wide low ice blocks rather
    // than the tall shards: a band of spires would be a fence, not a cliff.
    [T.GLACIER,           ['rockwall_a', 'rockwall_b', 'rockwall_c',
                           'growth_alt_a', 'growth_alt_b']],
    [T.WINTER_BERRY_BUSH, ['shrub_a', 'shrub_b', 'shrub_c']],
    [T.FROST_LILY,        ['bloom_a', 'bloom_b', 'bloom_c']],
    [T.FROST_FERN,        ['shrub_c', 'bloom_b']],
    [T.ICE_SPIRE,         ['landmark']],
    [T.ROCK,              ['boulder_a', 'boulder_b']],
    [T.STONES,            ['boulder_b', 'debris_a']],
  ].filter(([t]) => t !== undefined)),

  earth: new Map([
    // The landmark slot AND two growth frames, so a field of menhirs varies in
    // size and lean instead of repeating one stone.
    [T.STANDING_STONE,  ['landmark', 'growth_big_a', 'growth_big_b',
                         'growth_big_c', 'growth_big_d', 'growth_big_e']],
    [T.CRYSTAL_CLUSTER, ['bloom_a', 'bloom_b', 'bloom_c',
                         'growth_alt_a', 'growth_alt_b']],
    [T.MOUNTAIN_SAGE,   ['shrub_a', 'shrub_b', 'shrub_c']],
    // Six frames, not two. This region's accent tile is T.ROCK and its mapgen
    // lays it down in solid blocks of talus; with two frames a 9x9 field came
    // out as a visible checkerboard of two alternating boulders.
    [T.ROCK,            ['boulder_a', 'boulder_b', 'rockwall_c', 'debris_a',
                         'boulder_a', 'debris_b']],
    [T.STONES,          ['debris_a', 'debris_b']],
  ].filter(([t]) => t !== undefined)),

  volcanic: new Map([
    // The caldera rim. Six frames, for the same reason earth's talus needed
    // six: this is a border tile laid down in a solid band, not a scatter.
    [T.VOLCANIC_ROCK,  ['rockwall_a', 'rockwall_b', 'rockwall_c',
                        'boulder_a', 'boulder_b', 'growth_alt_a']],
    [T.OBSIDIAN_SPIRE, ['landmark', 'growth_big_a', 'growth_big_b',
                        'growth_big_c', 'growth_big_d', 'growth_big_e']],
    [T.EMBER_FLOWER,   ['bloom_a', 'bloom_b', 'bloom_c']],
    [T.SULFUR_SHRUB,   ['shrub_a', 'shrub_b', 'shrub_c']],
    [T.ROCK,           ['boulder_a', 'boulder_b', 'debris_a', 'debris_b']],
    [T.STONES,         ['debris_a', 'debris_b']],
  ].filter(([t]) => t !== undefined)),

  air: new Map([
    [T.CLOUD_SPIRE,   ['landmark', 'growth_big_a', 'growth_big_b',
                       'growth_big_c', 'growth_big_d', 'growth_big_e',
                       'growth_mid_a', 'growth_mid_b']],
    [T.SKY_BLOOM,     ['bloom_a', 'bloom_b', 'bloom_c']],
    [T.WIND_REED,     ['shrub_a', 'shrub_b', 'debris_a']],
    [T.STORM_THISTLE, ['shrub_c', 'growth_alt_a', 'growth_alt_b']],
  ].filter(([t]) => t !== undefined)),

  lightning: new Map([
    // Fulgurite: glass spires fused where a bolt struck the floor.
    [T.FULGURITE,   ['growth_big_a', 'growth_big_b', 'growth_big_c',
                     'growth_big_d', 'growth_big_e', 'growth_mid_a',
                     'growth_mid_b', 'growth_mid_c', 'growth_small_a',
                     'growth_small_b', 'growth_alt_a', 'growth_alt_b']],
    [T.VOLT_BLOOM,  ['bloom_a', 'bloom_b', 'bloom_c', 'shrub_c', 'debris_a']],
    [T.SPARK_REED,  ['shrub_a', 'shrub_b', 'debris_b']],
  ].filter(([t]) => t !== undefined)),

  // One entry only. Everything else in this region animates and stays on the
  // procedural switch; see the ground table.
  luminous: new Map([
    [T.LUMINOUS_CRYSTAL, ['growth_big_a', 'growth_big_b', 'growth_big_c',
                          'growth_big_d', 'growth_big_e', 'growth_mid_a',
                          'growth_mid_b', 'growth_mid_c', 'rockwall_a',
                          'rockwall_b', 'rockwall_c']],
  ].filter(([t]) => t !== undefined)),

  necrotic: new Map([
    [T.DEAD_TREE,      ['growth_big_a', 'growth_big_b', 'growth_big_c',
                        'growth_big_d', 'growth_big_e', 'growth_mid_a',
                        'growth_mid_b', 'growth_mid_c', 'growth_small_a',
                        'growth_small_b']],
    // Five headstone frames for one tile. This region scatters tombstones
    // across every open patch it has, and at two frames a graveyard reads as a
    // stamped pattern rather than as a graveyard.
    [T.TOMBSTONE,      ['landmark', 'growth_alt_a', 'growth_alt_b',
                        'boulder_a', 'boulder_b']],
    [T.WITHERED_SHRUB, ['shrub_a', 'shrub_b', 'shrub_c']],
    [T.BONE_PILE,      ['debris_a', 'debris_b']],
    [T.BONES,          ['debris_b', 'debris_a']],
    // Crypt-wall rubble. Six frames, because this is a border tile laid down in
    // bands and blocks rather than scattered.
    [T.BLIGHTED_WALL,  ['rockwall_a', 'rockwall_b', 'rockwall_c',
                        'boulder_a', 'growth_alt_a', 'rockwall_b']],
  ].filter(([t]) => t !== undefined)),

  poison: new Map([
    // Both the thicket wall and explicit mangrove tiles use the root-heavy
    // tree frames. The wall includes smaller roles so the border is layered
    // rather than a row of equally tall crowns.
    [T.POISON_WALL, ['growth_big_a', 'growth_big_b', 'growth_big_c',
                     'growth_big_d', 'growth_big_e', 'growth_mid_a',
                     'growth_mid_b', 'growth_mid_c', 'growth_small_a',
                     'growth_small_b', 'rockwall_a', 'rockwall_b',
                     'rockwall_c']],
    [T.MANGROVE,    ['growth_big_a', 'growth_big_b', 'growth_big_c',
                     'growth_big_d', 'growth_big_e', 'growth_mid_a',
                     'growth_mid_b', 'growth_mid_c']],
    [T.CATTAIL,     ['shrub_a', 'shrub_b', 'shrub_c']],
    [T.SWAMP_FERN,  ['bloom_a', 'bloom_b', 'bloom_c']],
    [T.ROCK,        ['boulder_a', 'boulder_b', 'debris_b']],
    [T.STONES,      ['boulder_b', 'debris_b']],
  ].filter(([t]) => t !== undefined)),

  mana: new Map([
    [T.MANA_CRYSTAL, ['growth_alt_a', 'growth_alt_b', 'rockwall_a',
                      'rockwall_b', 'rockwall_c', 'boulder_a', 'boulder_b']],
    [T.GREAT_TREE,   ['growth_big_a', 'growth_big_b', 'growth_big_c',
                      'growth_big_d', 'growth_big_e', 'growth_mid_a',
                      'growth_mid_b', 'growth_mid_c']],
    [T.VERDANT_FERN, ['shrub_a', 'shrub_b', 'shrub_c']],
    [T.FLOWER,       ['bloom_a', 'bloom_b', 'bloom_c', 'debris_b']],
    [T.ROCK,         ['boulder_a', 'boulder_b', 'debris_a']],
    [T.STONES,       ['boulder_b', 'debris_a']],
  ].filter(([t]) => t !== undefined)),

  shadow: new Map([
    [T.SHADOW_WALL, ['growth_big_a', 'growth_big_b', 'growth_big_c',
                     'growth_big_d', 'growth_big_e', 'growth_mid_a',
                     'growth_mid_b', 'growth_mid_c', 'growth_small_a',
                     'growth_small_b', 'rockwall_a', 'rockwall_b',
                     'rockwall_c', 'boulder_a']],
    [T.VOID_FROND, ['shrub_a', 'shrub_b', 'shrub_c']],
    [T.SHADOW_MONOLITH, ['landmark', 'growth_alt_a', 'growth_alt_b']],
    [T.ROCK,       ['boulder_a', 'boulder_b', 'debris_a']],
    [T.STONES,     ['boulder_b', 'debris_a']],
  ].filter(([t]) => t !== undefined)),
};

function terrainPropSet(region, t) {
  const m = region && TERRAIN_PROP_SETS[region];
  return m ? m.get(t) : undefined;
}

function terrainPropCovers(mapObj, t) {
  const region = terrainRegionOf(mapObj);
  return !!region && terrainPropsReady(region) && !!terrainPropSet(region, t);
}

// True for tiles that go through the depth merge on a map of this region. Pure
// in (region, tile), for the same memoization reason terrainArtMap is: the
// caller bakes the answer into a per-map list on the first frame.
function terrainPropTile(mapObj, t) {
  return !!terrainPropSet(terrainRegionOf(mapObj), t);
}

// Draw one prop, anchored at the foot of its tile: bottom-centre of the cell,
// which is where a thing standing on that cell touches the ground. Everything
// above and either side of that point is overhang, and it is deliberately not
// clipped to anything.
function drawTerrainProp(mapObj, col, row, t, ts) {
  const region = terrainRegionOf(mapObj);
  if (!region || !terrainPropsReady(region)) return false;
  const names = terrainPropSet(region, t);
  if (!names) return false;
  const atlas = terrainAtlas(region);
  const rec   = terrainSheets.get(region);
  if (!atlas || !rec) return false;
  const p = atlas.props;
  const idx = p.frames[names[terrainCellHash(col, row) % names.length]];
  if (idx === undefined) return false;

  // The sheets are authored against a 48px tile, so every blit scales by
  // (ts / authored tile): 1:1 at the default zoom, and clean at the 24 the
  // phone check measures at.
  const k  = ts / (atlas.ground.tile || 48);
  const fw = p.w, fh = p.h;
  const sx = (idx % p.cols) * fw, sy = Math.floor(idx / p.cols) * fh;
  const footScreenX = (col + 0.5 - camC) * ts;
  const footScreenY = (row + 1   - camR) * ts;
  ctx.drawImage(rec.propsImg, sx, sy, fw, fh,
                Math.round(footScreenX - p.footX * k),
                Math.round(footScreenY - p.footY * k),
                Math.round(fw * k), Math.round(fh * k));
  return true;
}
