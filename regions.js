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
//   skyRegion    (optional) marks a "cloud island" region — the hero walks on a
//                floor of cloud (ground) dappled with brighter puffs (decoration),
//                ringed by an impassable frayed lip (cloudEdge) carved out of the
//                surrounding border, and bare rock is suppressed. Air (white) and
//                lightning (dark, angry storm clouds) share this build.
//   cloudEdge    (skyRegion only) impassable lip tile fraying the cloud island's
//                rim, eaten out of the border by ringCloudEdges
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
  { id:'volcanic',  element:'volcanic',  border:T.VOLCANIC_ROCK,   ground:T.VOLCANIC_GROUND, decoration:T.MAGMA_CRACK, accent:T.LAVA, names:[
      'Cinderpath','Magma Hollow','Ashfall Reach','Emberflow Crossing','Caldera Rim',
      'Basalt Maze','Obsidian Field','Pyroclast Pass','Smoldering Flats','Molten Vein',
      'Brimstone Basin','Scoria Ridge','Sulfur Hollow','Lavafall Crossing','Charburn Reach',
      'Fumarole Field','Igneous Steps','Cindercone Trail','Firespring Bowl','Vulcan Throat'
    ], villageName:'Cinderhearth Bastion',      enemyTier:5, boss:'magma_tyrant'   },
  { id:'air',       element:'air',       skyRegion:true, cloudEdge:T.CLOUD_EDGE, border:T.SKY_GROUND,      ground:T.CLOUD,          decoration:T.CLOUDBANK, accent:T.WATER,      names:[
      'Skywharf','Cumulus Crossing','Zephyr Vault','Updraft Reach','Drifting Bastion',
      'Thunderhead Pass','Mist-veiled Path','Featherfall Hollow','Cirrus Ribbon','Stratos Spine',
      'Galewall','Wisp Field','Halcyon Reach','Stormthrone Approach','Falcon Roost',
      'Cloudbreak','Sky-stair','High Tundra','Whispering Currents','Aetherwake'
    ], villageName:'Stormcrown Aerie',          enemyTier:6, boss:'wind_djinn'     },
  { id:'lightning', element:null,        skyRegion:true, cloudEdge:T.STORM_EDGE, border:T.STORM_CLOUD,     ground:T.STORM_GROUND,   decoration:T.STORM_BANK, accent:T.WATER,      names:[
      'Sparkfen','Voltaic Plain','Thunderfork Pass','Stormglass Reach','Static Maze',
      'Galvanic Hollow','Arcwire Crossing','Lichtning Field','Tesla Spires','Surge Basin',
      'Brimwire','Ferrum Edge','Crackleway','Boltcaster Ridge','Shockmarsh',
      'Magnet Crag','Glasspowder Plain','Filament Gardens','Plasma Bowl','Coronet'
    ], villageName:'Voltheart Bastion',         enemyTier:7, boss:'storm_lord'     },
  { id:'luminous',  element:'luminous',  border:T.LUMINOUS_CRYSTAL, ground:T.LUMINOUS_FLOOR, decoration:T.LUMINOUS_GLOW, accent:T.WATER, names:[
      'Sunhalo Reach','Dawnlit Field','Prism Garden','Goldenmoss Hollow','Halo Pass',
      'Bright Causeway','Aureate Steps','Lambent Glade','Daystar Crossing','Lustrous Vault',
      'Beacon Plain','Argent Maze','Lumenrise','Suncast Ridge','Mirrorbright Atrium',
      'Effulgent Brook','Coronal Field','Glimmerwash','Radiant Apse','Shining Sanctum'
    ], villageName:'Solarspire Sanctum',        enemyTier:8, boss:'seraph_judge'   },
  { id:'necrotic',  element:'necrotic',  border:T.BLIGHTED_WALL,   ground:T.BLIGHT,         decoration:T.BONE_PILE, accent:T.LAVA,        names:[
      'Witherfen','Boneyard Crossing','Pall Glade','Hollow Reach','Decay Plain',
      'Shroudwood','Mourner\'s Pass','Cinderash Field','Gravesong Maze','Black Marrow',
      'Pall-veiled Ruins','Tomb-iron Reach','Carrion Flats','Sepulchre Trail','Funeral Causeway',
      'Witch-light Hollow','Coffinroot','Wraithmire','Reliquary Ribs','Last Rites Plain'
    ], villageName:'Ossuary of the Pale King',  enemyTier:9, boss:'death_knight'   },
  { id:'poison',    element:'poison',    border:T.POISON_WALL,     ground:T.SLUDGE,         decoration:T.MUSHROOM, accent:T.BOG_POOL,    names:[
      'Venomvale','Toxic Bog','Spore Pass','Mireheart','Slime Reach',
      'Acidlake Crossing','Foulweed Hollow','Plague Trail','Hexbog Maze','Murkfen',
      'Rotwood Edge','Stagnant Causeway','Bilegrove','Cankerstump','Pestilent Field',
      'Snake-fang Hollow','Greenfog Reach','Necrosis Plain','Bubble Marsh','Witherwart'
    ], villageName:'Mire-warden Citadel',       enemyTier:10, boss:'hydra_queen'    },
  { id:'mana',      element:null,        edgeWater:true, border:T.MANA_CRYSTAL,    ground:T.MANA_FLOOR,     decoration:T.FLOWER, accent:T.DEEP_WATER, names:[
      'Arcanum Reach','Spellwell Plain','Sigil Garden','Channeled Pass','Aether Field',
      'Glyphvein Maze','Lifeweave Hollow','Runestone Crossing','Conduit Spire','Resonant Bowl',
      'Astral Causeway','Mage-glass Plateau','Echo Lattice','Filigree Field','Mantra Plain',
      'Distortion Reach','Astral Wash','Crystal Choir','Theurgy Trail','Heartmoon'
    ], villageName:'Heartstone Conclave',       enemyTier:11, boss:'archmage_void'  },
  { id:'shadow',    element:'shadow',    border:T.SHADOW_WALL,     ground:T.SHADOW_GROUND,  decoration:T.SHADOW_DAPPLE, accent:T.SHADOW_RIFT, names:[
      'Duskfen','Umbral Plain','Gloomfork Pass','Nightglass Reach','Shade Maze',
      'Eclipse Hollow','Voidwire Crossing','Penumbra Field','Starless Basin','Blackmire',
      'Duskveil Ruins','Nihil Reach','Umbral Flats','Sable Causeway','Moonless Field',
      'Wraithdark Hollow','Gloamroot','Nyxmire','Eventide Ribs','Last Light Plain'
    ], villageName:'Umbral Sanctum',            enemyTier:12, boss:'eclipse_sovereign' },
];

// Quick lookup helper.
function regionById(id) { return REGIONS.find(r => r.id === id) || REGIONS[0]; }

// Display names for each region's Health Potion. Potions heal Nd4 (N = 1-indexed
// region number), so the ladder reads as ascending potency rather than by element —
// naming a heal after its region ("Fire Potion") is confusing and collides with the
// element-resistance Elixirs ("Fire Elixir"). This map is the single source of truth;
// every UI/message site resolves through regionPotionName() below. Tier 1 (forest) is
// also the generic starter potion (player.potions), so 'Minor Healing Potion' is the
// generic name too.
const REGION_POTION_NAMES = {
  forest:    'Minor Healing Potion',
  fire:      'Lesser Healing Potion',
  water:     'Modest Healing Potion',
  ice:       'Healing Potion',
  earth:     'Greater Healing Potion',
  volcanic:  'Major Healing Potion',
  air:       'Superior Healing Potion',
  lightning: 'Grand Healing Potion',
  luminous:  'Supreme Healing Potion',
  necrotic:  'Master Healing Potion',
  poison:    'Mythic Healing Potion',
  mana:      'Ancient Healing Potion',
  shadow:    'Divine Healing Potion',
};
function regionPotionName(id) { return REGION_POTION_NAMES[id] || REGION_POTION_NAMES.forest; }

// Per-region open-ground landmark spec for the early/elemental regions — each
// region's own answer to the necrotic TOMBSTONE / poison FALLEN_LOG / mana
// GREAT_TREE / luminous LIGHT_PILLAR. `tile` is the solid landmark stamped into a
// clearing; `open` is the set of tiles that count as open ground there (the
// region's floor, its slow/dapple variants, and its passable foliage) — a landmark
// is placed only where its whole 8-neighbourhood is open ground, so it can never
// pinch a corridor or seal a pocket. The four "later" regions keep their own bespoke
// landmark passes and are intentionally absent here.
const REGION_LANDMARKS = {
  forest:    { tile: T.MOSS_BOULDER,   open: [T.GRASS, T.FLOWER, T.MUSHROOM, T.FERN] },
  fire:      { tile: T.DESERT_OBELISK, open: [T.SAND, T.DUNE, T.DESERT_SUCCULENT, T.BONES] },
  water:     { tile: T.DRIFTWOOD,      open: [T.SAND, T.STONES, T.SEASHELL, T.CORAL] },
  ice:       { tile: T.ICE_SPIRE,      open: [T.SNOW, T.SNOW_DRIFT, T.WINTER_BERRY_BUSH, T.FROST_LILY, T.FROST_FERN] },
  earth:     { tile: T.STANDING_STONE, open: [T.SCREE, T.MUD, T.MOUNTAIN_SAGE, T.MOSS_CLUMP, T.CRYSTAL_CLUSTER] },
  air:       { tile: T.CLOUD_SPIRE,    open: [T.CLOUD, T.CLOUDBANK, T.SKY_BLOOM, T.WIND_REED, T.STORM_THISTLE] },
  lightning: { tile: T.STORM_SPIRE,    open: [T.STORM_GROUND, T.STORM_BANK, T.VOLT_BLOOM, T.SPARK_REED, T.FULGURITE] },
  volcanic:  { tile: T.OBSIDIAN_SPIRE, open: [T.VOLCANIC_GROUND, T.MAGMA_CRACK, T.EMBER_FLOWER, T.SULFUR_SHRUB] },
  shadow:    { tile: T.SHADOW_MONOLITH, open: [T.SHADOW_GROUND, T.SHADOW_DAPPLE, T.GLOOM_BLOOM, T.VOID_FROND] },
};

// Early/elemental regions: stand a scattering of the region's signature landmark out
// in the open clearings — a mossy boulder (forest), a sandstone obelisk (desert), a
// driftwood trunk (water beach), an ice spire (ice), a standing stone (earth), a
// cloud spire (air), or a storm spire (lightning). The exact "tombstone-style"
// landmark idiom: each is placed only on an open ground tile whose whole
// 8-neighbourhood is also open ground, so a lone solid landmark can never wall a path
// — making it safe to run after the connectivity seal (exactly like addTombstones /
// addGreatTrees). No-op for any region without a REGION_LANDMARKS entry.
function addRegionLandmarks(m, regionId, depth) {
  const spec = REGION_LANDMARKS[regionId];
  if (!spec) return;
  const open = spec.open;
  const isOpen = (r, c) => open.includes(m[r][c]);
  const count = 10 + Math.floor(depth / 2);
  let placed = 0, tries = 0;
  while (placed < count && tries < count * 40) {
    tries++;
    const r = rnd(4, MROWS - 5), c = rnd(4, MCOLS - 5);
    if (!isOpen(r, c)) continue;
    let clear = true;
    for (let dr = -1; dr <= 1 && clear; dr++)
      for (let dc = -1; dc <= 1; dc++)
        if ((dr || dc) && !isOpen(r + dr, c + dc)) { clear = false; break; }
    if (!clear) continue;
    m[r][c] = spec.tile;
    placed++;
  }
}

