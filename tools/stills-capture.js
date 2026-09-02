// Renders one still PNG for every enemy and every cuttable foliage tile, using
// the game's OWN drawing code, and POSTs each to tools/stills-server.py.
//
// Injected into the booted game document by stills-shot.html, so it runs in the
// game's global scope. That matters: `ctx` is a top-level `let` in config.js,
// not a property of window, so only code in this realm's global scope can
// redirect it at an offscreen canvas — the same trick buildTileSprite already
// uses in render.js.
//
// Not part of the game. Nothing in index.html loads this.

(async function () {
  const TS = 128;                 // pixels per tile; the stills are printed small
  const PAD = 2;                  // tiles of slack around the cell, for overhang
  const report = m => { window.__stills = m; document.title = 'stills: ' + m; };

  // Every cuttable foliage tile, in the Foliage sheet's order (region 0-12,
  // then as that sheet lists them). The set is the one in doSwing
  // (projectiles.js) — that switch is what makes a tile foliage.
  const FOLIAGE = [
    ['forest', 'FLOWER'], ['forest', 'FERN'], ['forest', 'MUSHROOM'],
    ['fire', 'BONES'], ['fire', 'DESERT_SUCCULENT'], ['fire', 'FLOWERING_CACTUS'],
    ['water', 'STONES'], ['water', 'CORAL'], ['water', 'SEASHELL'],
    ['ice', 'FROST_LILY'], ['ice', 'WINTER_BERRY_BUSH'], ['ice', 'FROST_FERN'],
    ['earth', 'MOUNTAIN_SAGE'], ['earth', 'CRYSTAL_CLUSTER'], ['earth', 'MOSS_CLUMP'],
    ['volcanic', 'EMBER_FLOWER'], ['volcanic', 'SULFUR_SHRUB'],
    ['air', 'SKY_BLOOM'], ['air', 'STORM_THISTLE'], ['air', 'WIND_REED'],
    ['lightning', 'VOLT_BLOOM'], ['lightning', 'FULGURITE'], ['lightning', 'SPARK_REED'],
    ['luminous', 'RADIANT_BLOOM'], ['luminous', 'LUMEN_SHARD'], ['luminous', 'GLOW_REED'],
    ['necrotic', 'CORPSE_FLOWER'], ['necrotic', 'BONE_PILE'], ['necrotic', 'WITHERED_SHRUB'],
    ['poison', 'SWAMP_FERN'], ['poison', 'SWAMP_MUSHROOM'], ['poison', 'CATTAIL'],
    ['mana', 'GIANT_BLOOM'], ['mana', 'VERDANT_FERN'], ['mana', 'GIANT_MUSHROOM'],
    ['shadow', 'GLOOM_BLOOM'], ['shadow', 'VOID_FROND'],
  ];

  // ── Offscreen render + trim ────────────────────────────────────────────────
  // Draw into a canvas padded by PAD tiles on every side, then crop to the
  // non-transparent bounding box. Enemy art overhangs its box freely (wings,
  // the dragon), and so does foliage (cactus arms, reeds), so the slack has to
  // be generous and the crop has to be measured rather than assumed.
  function shoot(w, h, draw) {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    const saved = ctx;
    ctx = g;
    try { draw(); } finally { ctx = saved; }
    return trim(cv, g);
  }

  function trim(cv, g) {
    const W = cv.width, H = cv.height;
    const d = g.getImageData(0, 0, W, H).data;
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        // 8 and not 0: several sprites lay down a very faint aura wash that
        // covers most of the padded canvas. Cropping to any non-zero alpha
        // would return the whole canvas and trim nothing.
        if (d[(y * W + x) * 4 + 3] > 8) {
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) return null;                       // nothing drawn
    const tw = x1 - x0 + 1, th = y1 - y0 + 1;
    const out = document.createElement('canvas');
    out.width = tw; out.height = th;
    out.getContext('2d').drawImage(cv, x0, y0, tw, th, 0, 0, tw, th);
    return out;
  }

  function save(name, cv) {
    return new Promise(res => cv.toBlob(
      b => fetch('/__save/' + name, { method: 'POST', body: b }).then(res, res),
      'image/png'));
  }

  // ── Setup ──────────────────────────────────────────────────────────────────
  const savedTP = TILE_PX, savedC = camC, savedR = camR;
  // Skipping the prologue leaves burnLevel at 0.25, and drawFireWash then
  // multiplies a warm #ffba8c over everything for the rest of the session.
  burnLevel = 0;
  TILE_PX = TS;

  const manifest = { enemies: [], foliage: [], missing: [] };

  // ── Enemies ────────────────────────────────────────────────────────────────
  // The fake mirrors the real spawn object in makeEnemyDefs (enemies.js), minus
  // the AI timers nothing in drawEnemy reads. `cutsceneActor` is the one field
  // set for the harness rather than for fidelity: it is drawEnemy's own "this
  // is not a creature you can fight" path, which skips the ground shadow, the
  // HP bar and the name tag and leaves exactly the sprite. z is 0 rather than
  // `hover` because altitude only slides the art up a transparent canvas that
  // is about to be cropped away.
  const keys = Object.keys(DND_ENEMIES);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i], base = DND_ENEMIES[key];
    const size = base.size || 1;
    const cell = Math.ceil((size + PAD * 2) * TS);
    // footBox anchors the sprite to a TILE, so the tile has to sit PAD tiles in
    // from the canvas origin: camC/camR are what put it there.
    camC = -PAD; camR = -PAD;
    const e = {
      id: 7, type: key, x: 0, y: 0,
      hp: base.hp, maxHp: base.hp, spd: base.spd, dmg: base.dmg, xp: base.xp,
      color: base.color, size, name: base.name,
      ranged: !!base.ranged, rooted: !!base.rooted, swims: !!base.swims,
      boss: !!base.boss, flies: !!base.flies, hover: base.hover || 0, z: 0,
      breath: base.breath || null, element: base.element || null,
      bloomT: 0, timer: 0, shootTimer: 0, dead: false, dormant: false,
      cutsceneActor: true,
    };
    let cv = null, err = null;
    try { cv = shoot(cell, cell, () => drawEnemy(e, TS)); }
    catch (ex) { err = ex.message; }
    if (cv) { await save('enemy_' + key + '.png', cv); manifest.enemies.push([key, base.name, cv.width, cv.height]); }
    else manifest.missing.push(['enemy', key, err || 'blank']);
    if (i % 10 === 0) report('enemies ' + i + '/' + keys.length);
  }

  // ── Foliage ────────────────────────────────────────────────────────────────
  // Atlas first, procedural second, which is the game's own order: a region
  // whose props sheet covers the tile draws the authored art (drawTerrainProp,
  // terrain-sprite.js) and everything else falls through to the hand-drawn
  // switch. drawTileOverlay is used rather than drawTileProcedural so the
  // procedural ones come out without the opaque ground square underneath.
  for (const r of new Set(FOLIAGE.map(f => f[0]))) {
    const region = TERRAIN_REGIONS[r];
    if (region) ensureTerrainSheets(region);
  }
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const pending = [...new Set(FOLIAGE.map(f => TERRAIN_REGIONS[f[0]]))]
      .filter(x => x && !terrainPropsReady(x));
    if (!pending.length) break;
    await new Promise(r => setTimeout(r, 200));
  }

  for (let i = 0; i < FOLIAGE.length; i++) {
    const [rid, tname] = FOLIAGE[i];
    const t = T[tname];
    if (t === undefined) { manifest.missing.push(['foliage', rid + '/' + tname, 'no such tile']); continue; }
    const cell = Math.ceil((1 + PAD * 2) * TS);
    camC = -PAD; camR = -PAD;
    const mapObj = { biome: rid };
    let cv = null, err = null, src = 'atlas';
    try {
      cv = shoot(cell, cell, () => {
        if (!drawTerrainProp(mapObj, 0, 0, t, TS)) {
          src = 'procedural';
          drawTileOverlay(0, 0, t, PAD * TS, PAD * TS, TS);
        }
      });
    } catch (ex) { err = ex.message; }
    if (cv) {
      await save('foliage_' + rid + '_' + tname + '.png', cv);
      manifest.foliage.push([rid, tname, src, cv.width, cv.height]);
    } else manifest.missing.push(['foliage', rid + '/' + tname, err || 'blank']);
  }

  TILE_PX = savedTP; camC = savedC; camR = savedR;
  window.__stillsManifest = manifest;
  report('done ' + manifest.enemies.length + ' enemies, ' + manifest.foliage.length +
         ' foliage, ' + manifest.missing.length + ' missing');
})();
