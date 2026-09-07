// Behavioural check for the v2 save tile representation. Run this inside a
// booted game (save-size-check.html injects it) so it exercises real generation,
// serialization, localStorage, and the load path together.
//
// The workload mirrors the audit's long-run case: one tile changed on 180 seeded
// overworld maps. The important assertions are that those maps use sparse deltas,
// the payload fits an empty browser profile, and every changed grid round-trips.

(function () {
  const PROBE_KEY = 'stormdrift_h3_size_probe';
  const CHANGED_MAPS = 180;
  const out = { failures: [], changedMaps: 0, deltaMaps: 0, packedMaps: 0,
                bytes: 0, stored: false, roundTrip: false };

  try {
    initWorld();
    worldSeed = 0x13579BDF;
    generateFullWorld();

    const targets = worldMaps.filter(m => m.mapSeed != null).slice(0, CHANGED_MAPS);
    const expected = new Map();
    for (const m of targets) {
      m.visited = true;
      const old = m.map[75][75];
      m.map[75][75] = old === T.PATH ? T.GRASS : T.PATH;
      expected.set(m.id, tileHash(m.map));
    }
    out.changedMaps = targets.length;

    const data = buildSaveData();
    const json = JSON.stringify(data);
    out.bytes = json.length;
    out.deltaMaps = data.worldMapsLite.filter(m => m.mapDelta !== undefined).length;
    out.packedMaps = data.worldMapsLite.filter(m => m.mapTiles).length;
    if (out.deltaMaps !== out.changedMaps)
      out.failures.push(`expected ${out.changedMaps} sparse maps, got ${out.deltaMaps}`);
    if (out.bytes >= 1000000)
      out.failures.push(`payload is ${out.bytes} bytes`);

    localStorage.removeItem(PROBE_KEY);
    try {
      localStorage.setItem(PROBE_KEY, json);
      out.stored = true;
    } catch (e) {
      out.failures.push(`localStorage: ${e.name}`);
    } finally {
      localStorage.removeItem(PROBE_KEY);
    }

    applyLoadData(JSON.parse(json));
    out.roundTrip = [...expected].every(([id, hash]) => {
      const map = worldMaps.find(m => m.id === id);
      return !!map && tileHash(map.map) === hash;
    });
    if (!out.roundTrip) out.failures.push('changed map tiles did not round-trip');
  } catch (e) {
    out.failures.push(e.message || String(e));
  }

  out.ok = out.failures.length === 0;
  window.__saveSizeCheck = out;
  document.title = out.ok ? 'save size ok' : `save size FAIL ${out.failures.length}`;
})();
