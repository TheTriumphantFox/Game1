// map-gen foliage/landmark scatter (per-region flavor passes)
// Split out of map-gen.js (generation-time only; plain <script> globals, all
// cross-file calls resolve at runtime). See index.html for load order.

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
// berry bushes (cut for winter berries), frost lilies (cut for frost petals), and
// frost ferns (cut for a frost fern frond). All seed onto open SNOW only, so paths,
// ice sheets, drifts, and placed structures are left untouched; all are passable
// 1-HP foliage, so connectivity is unaffected. No-op for every other region.
function scatterWinterFoliage(m, regionId) {
  if (regionId !== 'ice') return;
  scatterOn(m, T.WINTER_BERRY_BUSH, 70, T.SNOW);
  scatterOn(m, T.FROST_LILY, 55, T.SNOW);
  scatterOn(m, T.FROST_FERN, 50, T.SNOW);
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

// Air region: scatter sky growth across the open cloud floor — sky blooms (cut
// for sky petals), wind reeds (cut for wind seeds), and storm thistles (cut for
// thistle down). Seeds onto open CLOUD only (the region's walkable floor off the
// brighter CLOUDBANK puffs), so paths, cloud edges, and placed structures are
// left untouched; all are passable 1-HP foliage that revert to CLOUD when cut,
// so connectivity is unaffected. No-op for every other region.
function scatterAirFoliage(m, regionId) {
  if (regionId !== 'air') return;
  scatterOn(m, T.SKY_BLOOM, 60, T.CLOUD);
  scatterOn(m, T.WIND_REED, 60, T.CLOUD);
  scatterOn(m, T.STORM_THISTLE, 40, T.CLOUD);
}

// Lightning region: scatter storm growth across the open storm-cloud floor — volt
// blooms (cut for volt petals), spark reeds (cut for spark seeds), and fulgurite
// shards (cut for fulgurite). Seeds onto open STORM_GROUND only (the region's
// walkable floor off the brighter STORM_BANK puffs), so paths, storm edges, and
// placed structures are left untouched; all are passable 1-HP foliage that revert
// to STORM_GROUND when cut, so connectivity is unaffected. The storm-region twin
// of scatterAirFoliage. No-op for every other region.
function scatterLightningFoliage(m, regionId) {
  if (regionId !== 'lightning') return;
  scatterOn(m, T.VOLT_BLOOM, 60, T.STORM_GROUND);
  scatterOn(m, T.SPARK_REED, 60, T.STORM_GROUND);
  scatterOn(m, T.FULGURITE, 40, T.STORM_GROUND);
}

// Volcanic region: scatter the caldera's fire-touched growth across the open
// cooled-lava floor — ember-lilies (cut for Emberbloom) and brimstone shrubs (cut
// for Sulfur Moss). Seeds onto plain VOLCANIC_GROUND only (off the glowing magma
// cracks / paths), all passable 1-HP foliage that revert to VOLCANIC_GROUND when
// cut, so connectivity is unaffected. No-op for every other region.
function scatterVolcanicFoliage(m, regionId) {
  if (regionId !== 'volcanic') return;
  scatterOn(m, T.EMBER_FLOWER, 60, T.VOLCANIC_GROUND);
  scatterOn(m, T.SULFUR_SHRUB, 55, T.VOLCANIC_GROUND);
}

// Shadow region: scatter the umbral waste's pale growth across the open floor —
// duskcap clusters (cut for Duskcaps) and black void-ferns (cut for Void Petals).
// Seeds onto plain SHADOW_GROUND only (off the gloom-dapple pools / paths), all
// passable 1-HP foliage that revert to SHADOW_GROUND when cut, so connectivity is
// unaffected. No-op for every other region.
function scatterShadowFoliage(m, regionId) {
  if (regionId !== 'shadow') return;
  scatterOn(m, T.GLOOM_BLOOM, 60, T.SHADOW_GROUND);
  scatterOn(m, T.VOID_FROND,  55, T.SHADOW_GROUND);
}

// Luminous region: dapple a share of the walkable LUMINOUS_FLOOR with brighter
// LUMINOUS_GLOW pools — places where the warm healing light pools more thickly —
// so the floor reads as a living wash of radiance rather than one flat sheet.
// Both tiles are passable, so connectivity is unaffected. The luminous twin of
// sprinkleCloudFloor; runs after the seal, before the foliage scatter (so growth
// seeds onto the remaining plain floor, not the glow pools). No-op elsewhere.
function sprinkleLuminousGlow(m, regionId) {
  if (regionId !== 'luminous') return;
  for (let r = 0; r < MROWS; r++)
    for (let c = 0; c < MCOLS; c++)
      if (m[r][c] === T.LUMINOUS_FLOOR && Math.random() < 0.20) m[r][c] = T.LUMINOUS_GLOW;
}

// Luminous region: scatter the sanctum's radiant growth across the open floor —
// haloed radiant blooms, slender glow-reeds, and glowing lumen-shards. All seed
// onto plain LUMINOUS_FLOOR only (off the brighter glow pools), so paths, pillars,
// and placed structures are left untouched; all are passable, 1-HP, sword-cuttable
// foliage that revert to LUMINOUS_FLOOR when cut, each shedding its own forage (the
// bloom a Light Mote, the reed a Sun Seed, the shard a Prism Shard), so
// connectivity is unaffected. The luminous twin of scatterAirFoliage. No-op
// for every other region.
function scatterLuminousFoliage(m, regionId) {
  if (regionId !== 'luminous') return;
  scatterOn(m, T.RADIANT_BLOOM, 70, T.LUMINOUS_FLOOR);
  scatterOn(m, T.GLOW_REED,     55, T.LUMINOUS_FLOOR);
  scatterOn(m, T.LUMEN_SHARD,   40, T.LUMINOUS_FLOOR);
}

// Luminous region: raise a scattering of LIGHT_PILLAR shafts — solid columns of
// radiant light — as cathedral-like landmarks across the sanctum. Each is placed
// only on an open floor/glow tile whose whole 8-neighbourhood is also open, so a
// lone solid pillar can never pinch a corridor or seal a pocket; that makes it
// safe to run after the connectivity seal (like the other regions' decorative
// passes). No-op for every other region.
function addLightPillars(m, regionId, depth) {
  if (regionId !== 'luminous') return;
  const isOpen = (r, c) => m[r][c] === T.LUMINOUS_FLOOR || m[r][c] === T.LUMINOUS_GLOW;
  const pillarCount = 10 + Math.floor(depth / 2);
  let placed = 0, tries = 0;
  while (placed < pillarCount && tries < pillarCount * 40) {
    tries++;
    const r = rnd(4, MROWS - 5), c = rnd(4, MCOLS - 5);
    if (!isOpen(r, c)) continue;
    let clear = true;
    for (let dr = -1; dr <= 1 && clear; dr++)
      for (let dc = -1; dc <= 1; dc++)
        if ((dr || dc) && !isOpen(r + dr, c + dc)) { clear = false; break; }
    if (!clear) continue;
    m[r][c] = T.LIGHT_PILLAR;
    placed++;
  }
}

// Necrotic region: dapple a share of the walkable BLIGHT floor with GRAVE_DIRT —
// mounds of fresh-turned burial soil — so the wastes read as a churned, mass-grave
// burial ground rather than one flat sheet of blight. Both tiles are passable, so
// connectivity is unaffected. The necrotic twin of sprinkleLuminousGlow; runs
// after the seal, before the foliage scatter (so growth seeds onto the remaining
// plain floor, not the grave mounds). No-op for every other region.
function sprinkleGraveDirt(m, regionId) {
  if (regionId !== 'necrotic') return;
  for (let r = 0; r < MROWS; r++)
    for (let c = 0; c < MCOLS; c++)
      if (m[r][c] === T.BLIGHT && Math.random() < 0.16) m[r][c] = T.GRAVE_DIRT;
}

// Necrotic region: strew the wastes' decay across the open BLIGHT — heaps of
// BONE_PILE, dead WITHERED_SHRUB brambles, and pale CORPSE_FLOWER carrion blooms.
// All seed onto plain BLIGHT only (off the grave-dirt mounds), so paths, lava
// pits, and placed structures are left untouched; all are passable, 1-HP,
// sword-cuttable foliage that revert to BLIGHT when cut (shedding bone meal,
// witherwood, and grave blooms respectively), so connectivity is unaffected.
// The necrotic twin of scatterLuminousFoliage.
// No-op for every other region.
function scatterNecroticFoliage(m, regionId) {
  if (regionId !== 'necrotic') return;
  scatterOn(m, T.BONE_PILE,      80, T.BLIGHT);
  scatterOn(m, T.WITHERED_SHRUB, 60, T.BLIGHT);
  scatterOn(m, T.CORPSE_FLOWER,  45, T.BLIGHT);
}

// Necrotic region: claw a share of the crypt-wall (BLIGHTED_WALL) border up into
// gnarled, leafless DEAD_TREEs so the wastes are ringed by a dead forest rather
// than bare walls. Runs after the connectivity seal so sealed pockets get trees
// too; DEAD_TREE is solid like BLIGHTED_WALL, so traversal is unaffected. The
// necrotic twin of sprinkleSnowPines. No-op for every other region.
function sprinkleDeadTrees(m, regionId, chance = 0.30) {
  if (regionId !== 'necrotic') return;
  for (let r = 0; r < MROWS; r++)
    for (let c = 0; c < MCOLS; c++)
      if (m[r][c] === T.BLIGHTED_WALL && Math.random() < chance) m[r][c] = T.DEAD_TREE;
}

// Necrotic region: stand a scattering of cracked TOMBSTONEs across the wastes as
// graveyard landmarks. Each is placed only on an open blight/grave-dirt tile whose
// whole 8-neighbourhood is also open, so a lone solid headstone can never pinch a
// corridor or seal a pocket — making it safe to run after the connectivity seal
// (exactly like the luminous region's light pillars). No-op for every other region.
function addTombstones(m, regionId, depth) {
  if (regionId !== 'necrotic') return;
  const isOpen = (r, c) => m[r][c] === T.BLIGHT || m[r][c] === T.GRAVE_DIRT;
  const count = 14 + Math.floor(depth / 2);
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
    m[r][c] = T.TOMBSTONE;
    placed++;
  }
}

// Poison region: churn boggy BOG mire into the open SLUDGE floor — sunken,
// waterlogged hollows where the swamp pools into mud (each one slows the hero to
// half speed, like the earth region's MUD clumps / the ice region's drifts).
// Grown as organic clumps over SLUDGE only, so paths, the thicket border, bog
// pools, and placed structures are left untouched; BOG is passable, so this never
// affects connectivity. Runs after the seal, before the foliage scatter (so growth
// seeds onto the remaining plain SLUDGE, not the mire). The swamp twin of the
// necrotic region's sprinkleGraveDirt. No-op for every other region.
function addPoisonBogs(m, regionId, depth) {
  if (regionId !== 'poison') return;
  const clumps = 12 + Math.floor(depth / 2);
  for (let i = 0; i < clumps; i++) growClump(m, rnd(10, 44), T.SLUDGE, T.BOG);
}

// Poison region: choke the open mire with the swamp's rank growth — clumps of
// CATTAIL bulrush reeds, bushy SWAMP_FERN fronds, and glowing SWAMP_MUSHROOM
// toadstools. Done as a probability sweep over the open SLUDGE floor (rather than a
// sparse scatter) so the swamp reads as densely overgrown: roughly a third of the
// bare mire sprouts growth, with the rest left open to walk. Seeds onto plain
// SLUDGE only (off the boggy mire and bog pools), so paths and placed structures
// are untouched; all are passable, 1-HP, sword-cuttable foliage that revert to
// SLUDGE when cut (cattails shed Reed Pith, ferns an Herbal, toadstools a
// Mushroom), so connectivity is unaffected. The swamp twin of scatterNecroticFoliage.
// No-op for every other region.
function scatterPoisonFoliage(m, regionId) {
  if (regionId !== 'poison') return;
  for (let r = 1; r < MROWS - 1; r++)
    for (let c = 1; c < MCOLS - 1; c++) {
      if (m[r][c] !== T.SLUDGE) continue;
      const roll = Math.random();
      if      (roll < 0.14) m[r][c] = T.CATTAIL;
      else if (roll < 0.26) m[r][c] = T.SWAMP_FERN;
      else if (roll < 0.35) m[r][c] = T.SWAMP_MUSHROOM;
    }
}

// Poison region: claw a share of the thicket border (POISON_WALL) up into gnarled,
// moss-draped MANGROVE swamp trees so the mire is ringed by a drowned forest rather
// than a bare hedge. Runs after the connectivity seal so sealed pockets get trees
// too; MANGROVE is solid like POISON_WALL, so traversal is unaffected. The swamp
// twin of the necrotic region's sprinkleDeadTrees. No-op for every other region.
function sprinkleMangroves(m, regionId, chance = 0.28) {
  if (regionId !== 'poison') return;
  for (let r = 0; r < MROWS; r++)
    for (let c = 0; c < MCOLS; c++)
      if (m[r][c] === T.POISON_WALL && Math.random() < chance) m[r][c] = T.MANGROVE;
}

// Poison region: lay a scattering of rotting FALLEN_LOG trunks across the swamp as
// landmarks — the swamp's answer to the necrotic region's tombstones, but a 2–4
// tile run instead of a single headstone. Each log is a straight horizontal or
// vertical run placed only where its whole footprint AND the 8-neighbour ring
// around it are open swamp terrain (mire, bog, or foliage) — so the solid trunk is
// always an island in open ground that can never pinch a corridor or seal a pocket,
// making it safe to run after the connectivity seal (exactly like addTombstones).
// The ring check also keeps logs ≥1 tile apart, so runs stay straight and never
// fuse into L/T/cross shapes (the renderer assumes straight runs). No-op elsewhere.
function addFallenLogs(m, regionId, depth) {
  if (regionId !== 'poison') return;
  const isOpen = (r, c) => {
    if (r < 1 || c < 1 || r >= MROWS - 1 || c >= MCOLS - 1) return false;
    const t = m[r][c];
    return t === T.SLUDGE || t === T.BOG || t === T.CATTAIL ||
           t === T.SWAMP_FERN || t === T.SWAMP_MUSHROOM;
  };
  const count = 9 + Math.floor(depth / 3);
  let placed = 0, tries = 0;
  while (placed < count && tries < count * 80) {
    tries++;
    const horiz = Math.random() < 0.5;
    const len = rnd(2, 4);
    const r0 = rnd(2, MROWS - 3 - (horiz ? 0 : len));
    const c0 = rnd(2, MCOLS - 3 - (horiz ? len : 0));
    // Build the footprint, then require it plus its full 8-neighbour ring be open.
    const cells = [];
    for (let k = 0; k < len; k++) cells.push(horiz ? [r0, c0 + k] : [r0 + k, c0]);
    let clear = true;
    for (const [r, c] of cells) {
      for (let dr = -1; dr <= 1 && clear; dr++)
        for (let dc = -1; dc <= 1; dc++)
          if (!isOpen(r + dr, c + dc)) { clear = false; break; }
      if (!clear) break;
    }
    if (!clear) continue;
    for (const [r, c] of cells) m[r][c] = T.FALLEN_LOG;
    placed++;
  }
}

// Mana region: carve 1d6 large rivers winding edge-to-edge across the map — W→E or
// N→S, like the forest's water channels but wider (a 5-tile band vs the forest's
// 3). Each is carved as WATER and spanned by one to three plank bridges, then the
// water-handling block in buildRegionMap demotes it to swimmable MEDIUM_WATER (the
// forest stream idiom, scaled up). Run BEFORE the main path network (mana sets
// region.edgeWater) so the central corridors bridge any river they cross on a slim
// plank rather than fording it with dirt; the decorative bridges here span it
// elsewhere, and the swim-reachable far banks keep connectivity intact
// (ensureConnectivity floods through medium water). carveStream skips protected
// structures, so chests/shrines/doors are never paved over. No-op for every other region.
function addManaRivers(m, regionId, depth) {
  if (regionId !== 'mana') return;
  const rivers = rnd(1, 6);   // 1d6
  for (let i = 0; i < rivers; i++) {
    const cells = Math.random() < 0.5
      ? carveStream(m, rnd(15, MROWS - 16), 1,                 rnd(15, MROWS - 16), MCOLS - 2, 2)  // W→E, 5-wide
      : carveStream(m, 1,                   rnd(15, MCOLS - 16), MROWS - 2,          rnd(15, MCOLS - 16), 2); // N→S
    if (cells.length > 6) {
      bridgeStream(m, cells, Math.floor(cells.length / 2));
      if (cells.length > 40) bridgeStream(m, cells, Math.floor(cells.length / 4));
      if (cells.length > 80) bridgeStream(m, cells, Math.floor(cells.length * 3 / 4));
    }
  }
}

// Mana region: dapple a generous share of the walkable MANA_FLOOR with MANA_MOSS —
// thick cushions of overgrown moss where the forest's life energy pools — so the
// turf reads as a flourishing, overgrown floor rather than one flat sward. Both
// tiles are passable, so connectivity is unaffected. The mana twin of the luminous
// region's sprinkleLuminousGlow; runs after the seal, before the foliage scatter
// (so growth seeds onto the remaining plain turf, not the moss). The dapple is
// denser than the other regions' (~28%) to sell the "everything flourishing" look.
// No-op for every other region.
function sprinkleManaMoss(m, regionId) {
  if (regionId !== 'mana') return;
  for (let r = 0; r < MROWS; r++)
    for (let c = 0; c < MCOLS; c++)
      if (m[r][c] === T.MANA_FLOOR && Math.random() < 0.28) m[r][c] = T.MANA_MOSS;
}

// Mana region: choke the open turf with the forest's abnormally large growth —
// huge GIANT_BLOOM arcane flowers, towering VERDANT_FERN fronds, and colossal
// GIANT_MUSHROOM toadstools. Done as a dense probability sweep over the open
// MANA_FLOOR (rather than a sparse scatter) so the forest reads as wildly
// overgrown: roughly 45% of the bare turf sprouts growth, with the rest left open
// to walk. Seeds onto plain MANA_FLOOR only (off the moss dapple), so paths and
// placed structures are untouched; all three are passable, 1-HP, sword-cuttable
// foliage that revert to MANA_FLOOR when cut (blooms shed a Mana Petal, ferns a
// Heart Frond, toadstools a Glow Cap), so connectivity is unaffected. The mana
// twin of the poison region's scatterPoisonFoliage. No-op for every other region.
function scatterManaFoliage(m, regionId) {
  if (regionId !== 'mana') return;
  for (let r = 1; r < MROWS - 1; r++)
    for (let c = 1; c < MCOLS - 1; c++) {
      if (m[r][c] !== T.MANA_FLOOR) continue;
      const roll = Math.random();
      if      (roll < 0.18) m[r][c] = T.GIANT_BLOOM;
      else if (roll < 0.33) m[r][c] = T.VERDANT_FERN;
      else if (roll < 0.45) m[r][c] = T.GIANT_MUSHROOM;
    }
}

// Mana region: claw a share of the mana-veined treeline border (MANA_CRYSTAL) up
// into abnormally large GREAT_TREEs so the flourishing forest is ringed by ancient
// giants rather than a flat hedge. Runs after the connectivity seal so sealed
// pockets get trees too; GREAT_TREE is solid like MANA_CRYSTAL, so traversal is
// unaffected. The mana twin of the poison region's sprinkleMangroves. No-op for
// every other region.
function sprinkleGreatTrees(m, regionId, chance = 0.30) {
  if (regionId !== 'mana') return;
  for (let r = 0; r < MROWS; r++)
    for (let c = 0; c < MCOLS; c++)
      if (m[r][c] === T.MANA_CRYSTAL && Math.random() < chance) m[r][c] = T.GREAT_TREE;
}

// Mana region: raise a scattering of colossal GREAT_TREEs standing proud in the
// open clearings — the forest's abnormally large landmark, the mana region's answer
// to the luminous region's light pillars / the necrotic region's tombstones. Each
// is placed only on an open turf/moss/growth tile whose whole 8-neighbourhood is
// also open, so a lone solid giant can never pinch a corridor or seal a pocket —
// making it safe to run after the connectivity seal. No-op for every other region.
// `tile` is the landmark tile to stamp (default GREAT_TREE; the mana village passes
// COLOSSAL_TREE so its open clearings sprout the giant trees instead). `count`
// overrides the default density and `minGap` enforces a minimum Manhattan spacing
// between landmarks (0 = none) — used to keep the big colossal canopies from
// overlapping in the village.
function addGreatTrees(m, regionId, depth, tile = T.GREAT_TREE, count, minGap = 0) {
  if (regionId !== 'mana') return;
  const isOpen = (r, c) => {
    const t = m[r][c];
    return t === T.MANA_FLOOR || t === T.MANA_MOSS || t === T.GIANT_BLOOM ||
           t === T.VERDANT_FERN || t === T.GIANT_MUSHROOM;
  };
  if (count === undefined) count = 10 + Math.floor(depth / 2);
  let placed = 0, tries = 0;
  const at = [];
  while (placed < count && tries < count * 40) {
    tries++;
    const r = rnd(4, MROWS - 5), c = rnd(4, MCOLS - 5);
    if (!isOpen(r, c)) continue;
    if (minGap > 0 && at.some(([pr, pc]) => Math.abs(pr - r) + Math.abs(pc - c) < minGap)) continue;
    let clear = true;
    for (let dr = -1; dr <= 1 && clear; dr++)
      for (let dc = -1; dc <= 1; dc++)
        if ((dr || dc) && !isOpen(r + dr, c + dc)) { clear = false; break; }
    if (!clear) continue;
    m[r][c] = tile;
    at.push([r, c]);
    placed++;
  }
}

// Mana region: set a few exceptionally large COLOSSAL_TREEs sporadically into the
// treeline border — the ancient giants of the flourishing forest. Each anchor is a
// single solid border tile (MANA_CRYSTAL, or one of its GREAT_TREE dressings) sitting
// at the inner rim of the border (open ground within 2 tiles) so the overlay canopy
// the renderer draws — a single giant tree spanning several tiles, not bound to the
// grid — overhangs into view rather than being buried off-screen. `count` (default
// 1d4+2) and `minGap` (default 22-tile Manhattan spacing) tune how many and how
// dense; the overworld passes ×3 the default for a forest thick with giants, the
// village a smaller rim count. Always kept clear of the exit gates. Runs after the
// connectivity seal — COLOSSAL_TREE only ever replaces an already-solid border tile
// (solid → solid), so the passable graph is never affected. No-op elsewhere.
function addColossalTrees(m, regionId, count, minGap = 22) {
  if (regionId !== 'mana') return;
  const isBorderTree = (t) => t === T.MANA_CRYSTAL || t === T.GREAT_TREE;
  const isOpen = (t) => t === T.MANA_FLOOR || t === T.MANA_MOSS || t === T.PATH ||
    t === T.GIANT_BLOOM || t === T.VERDANT_FERN || t === T.GIANT_MUSHROOM ||
    t === T.MEDIUM_WATER || t === T.BRIDGE;
  const NB = [[0,1],[0,-1],[1,0],[-1,0],[0,2],[0,-2],[2,0],[-2,0]];
  const gates = [[EXIT_ROW,1],[EXIT_ROW,MCOLS-2],[1,EXIT_COL],[MROWS-2,EXIT_COL]];
  const cands = [];
  for (let r = 3; r < MROWS - 3; r++)
    for (let c = 3; c < MCOLS - 3; c++) {
      if (!isBorderTree(m[r][c])) continue;
      if (gates.some(([gr, gc]) => Math.abs(gr - r) + Math.abs(gc - c) < 7)) continue;  // clear of exits
      let rim = false;                                       // inner rim only
      for (const [dr, dc] of NB) { const row2 = m[r + dr]; if (row2 && isOpen(row2[c + dc])) { rim = true; break; } }
      if (rim) cands.push([r, c]);
    }
  if (!cands.length) return;
  for (let i = cands.length - 1; i > 0; i--) {               // Fisher–Yates shuffle
    const k = Math.floor(Math.random() * (i + 1));
    const tmp = cands[i]; cands[i] = cands[k]; cands[k] = tmp;
  }
  const want = (count === undefined) ? rnd(1, 4) + 2 : count;
  const placed = [];
  for (const [r, c] of cands) {
    if (placed.length >= want) break;
    if (placed.some(([pr, pc]) => Math.abs(pr - r) + Math.abs(pc - c) < minGap)) continue;
    m[r][c] = T.COLOSSAL_TREE;
    placed.push([r, c]);
  }
}

// Sky regions (air, lightning): the hero walks on a floor of cloud (region.ground
// — CLOUD for air, STORM_GROUND for lightning). Dapple a share of that floor with
// the brighter puff tile (region.decoration — CLOUDBANK / STORM_BANK) so the
// walkable surface reads as a rolling bank of two cloud tiles instead of one flat
// sheet. Both tiles are passable, so this never affects connectivity. Runs after
// the seal, like the other regions' decorative passes. No-op for non-sky regions.
function sprinkleCloudFloor(m, regionId) {
  const region = regionById(regionId);
  if (!region.skyRegion) return;
  const FLOOR = region.ground, PUFF = region.decoration;
  for (let r = 0; r < MROWS; r++)
    for (let c = 0; c < MCOLS; c++)
      if (m[r][c] === FLOOR && Math.random() < 0.22) m[r][c] = PUFF;
}

// Sky regions (air, lightning): ring the entire walkable area with an impassable
// band of the cloudEdge tile (CLOUD_EDGE / STORM_EDGE) — the billowing lip of the
// cloud the hero stands on, so they can't step off it. The band is ~2 tiles solid,
// fraying out irregularly to 3–4 tiles so the rim reads as a ragged cloud edge
// rather than a clean wall; beyond it the region's border (SKY_GROUND earth below
// for air, churning STORM_CLOUD thunderheads for lightning) remains. Measured by
// BFS distance from every passable tile and only ever converts the solid border
// tile (never walkable tiles or the accent sky-pools), so the passable graph — and
// thus connectivity and the exits — is untouched. Runs after the connectivity
// seal. No-op for non-sky regions.
function ringCloudEdges(m, regionId) {
  const region = regionById(regionId);
  if (!region.skyRegion) return;
  const BORDER = region.border, EDGE = region.cloudEdge;
  const W = MCOLS, H = MROWS, MAXB = 4;
  const NB4 = [[1,0],[-1,0],[0,1],[0,-1]];
  // Multi-source BFS: distance (in tiles) from the nearest passable tile, capped
  // at MAXB. Sources are every walkable tile (cloud floor, paths, bridges).
  const dist = new Int16Array(W * H).fill(-1);
  const q = [];
  for (let r = 0; r < H; r++)
    for (let c = 0; c < W; c++)
      if (!isSolid(m, c, r)) { dist[r * W + c] = 0; q.push(r * W + c); }
  for (let head = 0; head < q.length; head++) {
    const idx = q[head], r = (idx / W) | 0, c = idx % W, d = dist[idx];
    if (d >= MAXB) continue;
    for (const [dr, dc] of NB4) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= H || nc >= W) continue;
      const ni = nr * W + nc;
      if (dist[ni] !== -1) continue;
      dist[ni] = d + 1; q.push(ni);
    }
  }
  // Paint the band. The inner 2 tiles are always edge; tiles 3–4 out are frayed
  // in via a coarse (2×2-block) spatial hash so the outer boundary is clumpy and
  // organic, giving a rim that wavers between 2 and 4 tiles wide.
  for (let r = 0; r < H; r++)
    for (let c = 0; c < W; c++) {
      if (m[r][c] !== BORDER) continue;                  // only eat the solid border
      const d = dist[r * W + c];
      if (d < 1) continue;
      let inBand = d <= 2;
      if (!inBand && d <= MAXB) {
        const fray = ((((c >> 1) * 73) ^ ((r >> 1) * 131)) >>> 0);
        inBand = (d === 3) ? ((fray & 3) !== 0)          // ~75% at 3 out
                           : ((fray & 7) < 3);           // ~37% at 4 out
      }
      if (inBand) m[r][c] = EDGE;
    }
}

