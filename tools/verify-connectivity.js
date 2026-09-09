// Behavioural check on overworld accessibility. Run this inside a booted game
// (connectivity-check.html injects it) so it exercises the real generation chain.
//
// The check has two deliberately different contracts:
//   * no armor: every open border exit must be reachable from one root exit;
//   * combined armor: every generated feature, armor-traversable terrain tile,
//     and ordinary standing tile that survived generation must be reachable.
//
// The combined graph models changing between owned Water, Earth and Air armor on
// ordinary ground. (Shadow was in this set until Shadow Step was retired; the
// Umbral Veil that replaced it changes what enemies notice, not what tiles the
// hero can stand on.) It does not pretend that multiple armors can be
// active simultaneously. Deep water, walls, and other intentionally solid
// scenery are not reported as failures because no current armor can stand on
// them; a feature beside such scenery still has to be usable.

(function () {
  const MAPS_PER_REGION = 20;
  const OPEN = { left: true, right: true, up: true, down: true };
  const out = {
    maps: 0, features: 0, armorReachableCells: 0,
    failures: [], failureCount: 0, byRegion: {}, regressions: {}
  };

  function fail(region, seed, kind, detail) {
    out.failureCount++;
    if (out.failures.length < 24)
      out.failures.push({ region, seed, kind, ...detail });
  }

  function inspect(regionIdx, seed) {
    const region = REGIONS[regionIdx];
    const map = buildOverworldForRegion(regionIdx, seed, 10, OPEN, true);
    // Exercise the post-generation ability-secret pass too. It adds the real
    // Air chest features that are intentionally armor-gated.
    const mapObj = {
      id: regionIdx * 1000 + seed,
      gx: 0, gy: 0, type: region.id, biome: region.id, map
    };
    if (typeof ensureAbilitySecret === 'function') ensureAbilitySecret(mapObj);

    const starts = connectivityPrimaryStart(map);
    const noArmor = connectivityReachableWithoutArmor(map, starts);
    const withArmor = connectivityReachableWithArmor(map, starts);
    const exits = connectivityOpenExitSeeds(map);
    if (exits.length !== 4) fail(region.id, seed, 'exit-count', { count: exits.length });
    for (const [x, y] of exits) {
      if (!noArmor[connectivityCellIndex(x, y)])
        fail(region.id, seed, 'exit', { x, y });
    }

    let features = 0;
    let armorCells = 0;
    for (let r = 1; r < MROWS - 1; r++) {
      for (let c = 1; c < MCOLS - 1; c++) {
        const t = map[r][c];
        const cell = connectivityCellIndex(c, r);
        if (connectivityIsFeatureTile(t)) {
          features++;
          if (!connectivityFeatureReachable(map, withArmor, c, r))
            fail(region.id, seed, 'feature', { x: c, y: r, tile: t });
        } else if ((t === T.MEDIUM_WATER || t === T.LEDGE_FACE) && !withArmor[cell]) {
          fail(region.id, seed, 'armor-terrain', { x: c, y: r, tile: t });
        } else if (connectivityCanStand(map, c, r, 'none') && !withArmor[cell]) {
          // The production pass should seal an ordinary pocket unless the
          // combined armor graph can reach it. This catches visual terrain that
          // looks walkable but is stranded behind a generation mistake.
          fail(region.id, seed, 'ordinary-pocket', { x: c, y: r, tile: t });
        }
        if (withArmor[cell]) armorCells++;
      }
    }
    out.features += features;
    out.armorReachableCells += armorCells;
    return { features, exits: exits.length, abilitySecret: mapObj.abilitySecret };
  }

  for (let regionIdx = 0; regionIdx < REGIONS.length; regionIdx++) {
    const region = REGIONS[regionIdx];
    const rec = out.byRegion[region.id] = { maps: 0, features: 0, failures: 0 };
    for (let seed = 1; seed <= MAPS_PER_REGION; seed++) {
      const before = out.failureCount;
      const result = inspect(regionIdx, seed);
      out.maps++;
      rec.maps++;
      rec.features += result.features;
      rec.failures += out.failureCount - before;
      if ((regionIdx === 0 && seed === 4) || (regionIdx === 1 && seed === 1))
        out.regressions[`${region.id}-${seed}`] = result;
    }
  }

  window.__connectivityCheck = out;
  document.title = out.failureCount ? `connectivity FAIL ${out.failureCount}` : 'connectivity ok';
})();
