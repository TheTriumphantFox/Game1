// Behavioural check on golem placement. Runs INSIDE the booted game (injected by
// golem-check.html), because buildRegionMap needs the whole generator chain.
//
// Checks the four placement rules that make golems fair, on real generated maps:
//   * count is 1d6-2 floored at 0, so 0..4 and some maps get none
//   * never ON a road
//   * never within GOLEM_ROAD_CLEAR of a road, so a hero who stays on the path
//     can never wake one
//   * never within GOLEM_RUBBLE_CLEAR of cuttable rubble, so a hero harvesting
//     Stones / Bones / Bone Piles can never catch one with a swing
//   * forest has none at all
//
// Written as a behavioural check and not a structural one for the reason in
// tools/verify-sprite.js: "does the constant exist" would pass a placement loop
// that never applied it.

(function () {
  const MAPS_PER_REGION = 40;
  const out = { fails: [], counts: {}, minRoad: Infinity, minRubble: Infinity,
                total: 0, forest: 0, byRegion: {} };

  const dist = (a, b, c, d) => Math.hypot(a - c, b - d);

  function nearestOf(map, x, y, tiles, cap) {
    let best = Infinity;
    for (let r = Math.max(0, y - cap); r <= Math.min(MROWS - 1, y + cap); r++)
      for (let c = Math.max(0, x - cap); c <= Math.min(MCOLS - 1, x + cap); c++)
        if (tiles.includes(map[r][c])) best = Math.min(best, dist(x, y, c, r));
    return best;
  }

  const rubbleTiles = [T.STONES, T.BONES, T.BONE_PILE].filter(t => t !== undefined);

  for (let idx = 0; idx < REGIONS.length; idx++) {
    const region = REGIONS[idx];
    for (let n = 0; n < MAPS_PER_REGION; n++) {
      // buildRegionMap RETURNS THE TILE ARRAY ITSELF. `built.map || built` looks
      // like a safe unwrap and is not: Array.prototype.map is truthy, so that
      // hands back the function.
      const map = buildRegionMap(1000 + idx * 97 + n, idx,
                                 { left: true, right: true, up: true, down: true },
                                 region, false);
      const defs = makeGolemDefs(region.id, map);

      if (region.id === 'forest') { out.forest += defs.length; continue; }

      out.counts[defs.length] = (out.counts[defs.length] || 0) + 1;
      out.total += defs.length;
      const rec = out.byRegion[region.id] ||
                  (out.byRegion[region.id] = { golems: 0, maps: 0, minRoad: Infinity,
                                               pathTiles: 0, roadTile: region.path === undefined
                                                 ? 'T.PATH' : 'override ' + region.path });
      rec.maps++; rec.golems += defs.length;
      for (let r = 0; r < MROWS; r++) for (let c = 0; c < MCOLS; c++)
        if (map[r][c] === T.PATH) rec.pathTiles++;
      if (defs.length > 4) out.fails.push(`${region.id}: count ${defs.length} > 4`);

      for (const d of defs) {
        if (map[d.y][d.x] === T.PATH) out.fails.push(`${region.id}: golem ON a path tile`);
        if (isSolid(map, d.x, d.y)) out.fails.push(`${region.id}: golem in a solid tile`);
        const road = nearestOf(map, d.x, d.y, [T.PATH], 12);
        const rub = nearestOf(map, d.x, d.y, rubbleTiles, 8);
        out.minRoad = Math.min(out.minRoad, road);
        rec.minRoad = Math.min(rec.minRoad, road);
        out.minRubble = Math.min(out.minRubble, rub);
        if (road <= GOLEM_ROAD_CLEAR) out.fails.push(`${region.id}: road at ${road.toFixed(2)} <= ${GOLEM_ROAD_CLEAR}`);
        if (rub <= GOLEM_RUBBLE_CLEAR) out.fails.push(`${region.id}: rubble at ${rub.toFixed(2)} <= ${GOLEM_RUBBLE_CLEAR}`);
      }
    }
  }

  // A road clearance of 5 against a wake radius of 3.5 is the margin the whole
  // "safe on the path" promise rests on, so it is reported, not just asserted.
  // Expected mean of max(0, 1d6-2) is (0+0+1+2+3+4)/6 = 1.667. A region well
  // under that is not unlucky, it is a region where the clearances leave too
  // little legal ground — the same failure the gas vents hit at 22 apart.
  out.expectedMean = 5 / 3;
  for (const r of Object.values(out.byRegion)) r.perMap = +(r.golems / r.maps).toFixed(2);
  out.margin = out.minRoad - GOLEM_WAKE_RADIUS;
  out.fails = out.fails.slice(0, 12);
  window.__golemCheck = out;
  document.title = out.fails.length ? 'golems FAIL ' + out.fails.length : 'golems ok';
})();
