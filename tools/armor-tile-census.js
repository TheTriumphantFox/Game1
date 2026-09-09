// How much of each region only opens up once you are wearing its armor.
//
// Run inside a booted game (armor-census.html injects it), so it measures the
// real generation chain rather than a model of it. Answers one question per
// region, as a percentage of that region's reachable ground:
//
//   armorOnlyPct   share of standable tiles a hero can reach ONLY by using an
//                  armor traversal — everything cut off behind medium water, a
//                  ledge face, or a glide gap, plus those tiles themselves.
//   byArmor        the same figure split by which armor opens it, and whether
//                  that armor is the region's OWN.
//
// "Reachable" on both sides of the ratio, deliberately. Counting armor-gated
// tiles against the whole 150×150 grid would bury the answer under the border
// ring and the solid scenery no hero ever stands on; the interesting number is
// the share of the walkable region, which is what connectivityReachable* returns.
//
// The armor model is connectivity.js's, so this cannot drift from what the
// connectivity verifier already assumes: Water on T.MEDIUM_WATER, Earth on
// T.LEDGE_FACE, and Air's glide at its LEVEL-6 range. So the figure is "what a
// fully equipped hero can reach that a bare one cannot" — the ceiling of the
// answer. A hero part-way up the Air upgrade curve reaches less.

(function () {
  const MAPS_PER_REGION = 20;
  const OPEN = { left: true, right: true, up: true, down: true };

  // Which armor a tile the hero is STANDING on belongs to. Air is absent on
  // purpose: a glide crosses a gap and lands on ordinary ground, so no tile in
  // the game is "an Air tile" — its share is measured as the ground it opens.
  const ARMOR_TILE = new Map([[T.MEDIUM_WATER, 'water'], [T.LEDGE_FACE, 'earth']]);

  const out = { mapsPerRegion: MAPS_PER_REGION, regions: [], totals: {} };

  function census(regionIdx, seed) {
    const region = REGIONS[regionIdx];
    const map = buildOverworldForRegion(regionIdx, seed, 10, OPEN, true);
    // The ability-secret pass adds the glide islet, which is the one deliberately
    // Air-gated feature on an overworld map. Stamp it, or Air reads as zero
    // everywhere by construction.
    const mapObj = { id: regionIdx * 1000 + seed, gx: 0, gy: 0,
                     type: region.id, biome: region.id, map };
    if (typeof ensureAbilitySecret === 'function') ensureAbilitySecret(mapObj);

    const starts = connectivityPrimaryStart(map);
    const bare = connectivityReachableWithoutArmor(map, starts);
    const armed = connectivityReachableWithArmor(map, starts);

    let reachable = 0, armorOnly = 0;
    const byArmor = { water: 0, earth: 0, air: 0 };
    for (let r = 1; r < MROWS - 1; r++) {
      for (let c = 1; c < MCOLS - 1; c++) {
        const cell = connectivityCellIndex(c, r);
        if (!armed[cell]) continue;
        reachable++;
        if (bare[cell]) continue;
        armorOnly++;
        // Standing on an armor's own tile attributes to that armor; anything
        // else the bare flood could not get to is ground an active traversal
        // reached, which on an overworld map is the glide.
        const own = ARMOR_TILE.get(map[r][c]);
        byArmor[own || 'air']++;
      }
    }
    return { reachable, armorOnly, byArmor };
  }

  const grand = { reachable: 0, armorOnly: 0, water: 0, earth: 0, air: 0 };
  for (let i = 0; i < REGIONS.length; i++) {
    const acc = { reachable: 0, armorOnly: 0, water: 0, earth: 0, air: 0 };
    for (let seed = 1; seed <= MAPS_PER_REGION; seed++) {
      const c = census(i, seed);
      acc.reachable += c.reachable;
      acc.armorOnly += c.armorOnly;
      acc.water += c.byArmor.water;
      acc.earth += c.byArmor.earth;
      acc.air += c.byArmor.air;
    }
    for (const k of Object.keys(grand)) grand[k] += acc[k];
    const pct = (n) => acc.reachable ? +(100 * n / acc.reachable).toFixed(2) : 0;
    const region = REGIONS[i];
    const ownArmor = region.element;
    out.regions.push({
      region: region.id,
      ownArmor: ownArmor || '(none)',
      reachableTiles: acc.reachable,
      armorOnlyPct: pct(acc.armorOnly),
      // The headline the design question actually asked for: how much needs THIS
      // region's own armor, as opposed to any armor at all.
      ownArmorOnlyPct: ownArmor && acc[ownArmor] !== undefined ? pct(acc[ownArmor]) : 0,
      byArmorPct: { water: pct(acc.water), earth: pct(acc.earth), air: pct(acc.air) },
    });
  }
  const gpct = (n) => grand.reachable ? +(100 * n / grand.reachable).toFixed(2) : 0;
  out.totals = {
    reachableTiles: grand.reachable,
    armorOnlyPct: gpct(grand.armorOnly),
    byArmorPct: { water: gpct(grand.water), earth: gpct(grand.earth), air: gpct(grand.air) },
  };

  window.__armorCensus = out;
})();
