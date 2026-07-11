// ─── Rendering ────────────────────────────────────────────────────────────────
// Every frame: draw visible tiles, fog, projectiles, enemies, player,
// particles, damage numbers, exit arrows, and (toggleable) minimap.

// ─── Sprite cache ─────────────────────────────────────────────────────────────
// Procedural tile/enemy art is otherwise re-issued as dozens of canvas calls per
// sprite *every frame*. Instead we paint each static sprite once into an offscreen
// canvas (keyed by type) and blit it with a single drawImage per frame. Animated
// tiles (water, whirlpool, storm) and per-frame entity overlays (enemy hurt-flash,
// HP bars, the idle bob) bypass the cache and keep drawing procedurally — they'll
// be split out in later steps. This step only sets up the cache; nothing reads it
// yet, so rendering is unchanged.
//
// Sprites are sized to the current TILE_PX. TILE_PX is effectively constant today
// (config.js sets 48 and never reassigns it), but should a zoom ever change it,
// the per-frame size guard drops every sprite so they repaint at the new size.

let spriteCacheTS = 0;                 // the TILE_PX every cached sprite was painted at
const tileSpriteCache = new Map();     // tile type (number) → { canvas, dx, dy } | false

// Drop every cached sprite. Called when the tile pixel size changes so stale-size
// art can't be blitted; the next draw of each type repaints it at the new size.
function invalidateSpriteCaches() {
  tileSpriteCache.clear();
}

// Run once per frame (top of render). When the tile size differs from what the
// caches were built at, wipe them so every sprite repaints at the current size.
function ensureSpriteCacheSize() {
  if (TILE_PX !== spriteCacheTS) {
    invalidateSpriteCaches();
    spriteCacheTS = TILE_PX;
  }
}

// Allocate a transparent offscreen canvas to paint one sprite into. Dimensions are
// rounded up so a fractional tile size never clips the sprite's right/bottom edge.
function makeSpriteCanvas(w, h) {
  const cv = document.createElement('canvas');
  cv.width  = Math.max(1, Math.ceil(w));
  cv.height = Math.max(1, Math.ceil(h));
  return cv;
}

// Tiles whose drawTile output is a pure function of (type, size) — identical
// pixels regardless of column, row, neighbours, game state, or time. Only these
// are safe to paint once and blit from cache; every other tile (animated
// water/glow/torches, per-tile hash noise, neighbour-autotiled terrain like
// mountains/cliffs/CLIMB, and state-driven chests) keeps drawing procedurally.
//
// Derived empirically rather than by reading the switch: each tile type was
// rendered at several positions, Date.now() values, AND neighbourhood fills, and
// kept only when every render came out pixel-identical (47 of the tile types).
// That neighbour pass matters — CLIMB looked pure at fixed positions but is
// mesa-edge autotiled, so it's correctly excluded. CHEST renders identically only
// because the probe never opens it, so it's force-excluded as state-dependent.
//
// Fail-safe by construction: a tile missing here is simply never cached (still
// correct, just unoptimised), so new tiles need no edit unless you want caching.
// Several of these (TREE, CACTUS, STATUE, …) draw above/beside their tile box, so
// buildTileSprite captures each sprite's full drawn extent, not just s×s.
const CACHEABLE_TILES = new Set([
  T.BED, T.BONES, T.BONE_PILE, T.BRIDGE, T.CACTUS, T.CATTAIL, T.CAVE_FLOOR,
  T.CHAIR, T.CORAL, T.CRYSTAL_CLUSTER, T.DESERT_OBELISK, T.DESERT_SUCCULENT,
  T.DOOR, T.DUNE, T.FERN, T.FLOOR, T.FLOWERING_CACTUS, T.FROST_FERN, T.FROST_LILY,
  T.FULGURITE, T.GLACIER, T.GLOW_REED, T.GRASS, T.ICE, T.MOUNTAIN_SAGE,
  T.MUSHROOM, T.PATH, T.PILLAR, T.ROCK, T.SEASHELL, T.SHRINE, T.SKY_BLOOM,
  T.SNOW, T.SNOW_DRIFT, T.SNOW_PINE, T.SPARK_REED, T.STATUE, T.STONES,
  T.STORM_THISTLE, T.SWAMP_FERN, T.TREE, T.VERDANT_FERN, T.VOLT_BLOOM, T.WALL,
  T.WIND_REED, T.WINTER_BERRY_BUSH, T.WITHERED_SHRUB,
  // Volcanic + shadow region foliage (static, tile-bounded — like the other cached
  // growths). Their walls/floors/dapples/landmarks/animated tiles stay procedural.
  T.EMBER_FLOWER, T.SULFUR_SHRUB, T.GLOOM_BLOOM, T.VOID_FROND,
].filter(v => v !== undefined));

// Paint a pure tile once into a trimmed offscreen sprite. Renders into a scratch
// canvas padded by a full tile on every side (so art that overhangs the tile box
// — cactus arms, pine tips, statue heads — is captured), finds the drawn bounding
// box, and trims to it. Returns { canvas, dx, dy } to blit at (sx+dx, sy+dy), or
// null if the art reached the scratch edge (pad too small → keep it procedural).
//
// It reuses the existing procedural switch verbatim by briefly redirecting the
// global `ctx` at the scratch context — synchronous, restored in finally.
function buildTileSprite(t, s) {
  const si  = Math.ceil(s);
  const pad = si;                          // one tile of slack per side
  const W   = si + pad * 2;
  const scratch = makeSpriteCanvas(W, W);
  const g = scratch.getContext('2d');
  const saved = ctx;
  ctx = g;                                 // redirect drawTileProcedural's draws
  try { drawTileProcedural(0, 0, t, pad, pad, s); }
  finally { ctx = saved; }

  // Bounding box of every non-transparent pixel (the opaque base fill guarantees
  // the box itself counts; overhang extends it).
  const data = g.getImageData(0, 0, W, W).data;
  let minX = W, minY = W, maxX = -1, maxY = -1;
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      if (data[(y * W + x) * 4 + 3] !== 0) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;                                            // nothing drawn
  if (minX === 0 || minY === 0 || maxX === W - 1 || maxY === W - 1)     // clipped — bail
    return null;
  const tw = maxX - minX + 1, th = maxY - minY + 1;
  const cv = makeSpriteCanvas(tw, th);
  cv.getContext('2d').drawImage(scratch, minX, minY, tw, th, 0, 0, tw, th);
  return { canvas: cv, dx: minX - pad, dy: minY - pad };
}

// Fetch the cached sprite for a pure tile, building it on first use. Stores `false`
// when a tile can't be cached (clipped) so it isn't re-probed every frame.
function getTileSprite(t, s) {
  let e = tileSpriteCache.get(t);
  if (e === undefined) {
    e = buildTileSprite(t, s) || false;
    tileSpriteCache.set(t, e);
  }
  return e;
}

// ─── Tile rendering ───────────────────────────────────────────────────────────
// Draw one map tile. Pure tiles (CACHEABLE_TILES) are painted once and blitted
// from cache here; every other tile falls through to the procedural switch.
function drawTile(col, row, t, sx, sy, s) {
  if (CACHEABLE_TILES.has(t)) {
    const spr = getTileSprite(t, s);
    if (spr) {
      ctx.drawImage(spr.canvas, Math.floor(sx) + spr.dx, Math.floor(sy) + spr.dy);
      return;
    }
  }
  drawTileProcedural(col, row, t, sx, sy, s);
}


// ─── Player sprite ────────────────────────────────────────────────────────────
// Layered: shadow → boots → tunic → arms → shield (when idle) → head → hair →
// hat → eyes → swinging sword. Sprite faces swordDir (down/up/left/right).
function drawPlayer(ts) {
  // Use smoothed render coords so the sprite glides rather than tile-snaps.
  const px = player.renderX, py = player.renderY;
  const sx = (px - camC) * ts, sy = (py - camR) * ts, s = ts;
  const blink = player.invincible > 0 && Math.floor(Date.now() / 80) % 2 === 0;
  if (blink) return;

  const sd = player.swordDir;
  const facing = sd.y > 0 ? 'down' : sd.y < 0 ? 'up' : sd.x > 0 ? 'right' : 'left';
  const isSide = facing === 'left' || facing === 'right';
  const flipX = facing === 'left';   // mirror side-view details

  // Subtle walking bob — only oscillates when a movement key is held
  const moving = !!(keys['ArrowLeft']||keys['ArrowRight']||keys['ArrowUp']||keys['ArrowDown']||
                    keys['a']||keys['A']||keys['d']||keys['D']||keys['w']||keys['W']||keys['s']||keys['S']);
  // Unrounded: snapping the bob to whole pixels jerked the sprite ±1px at each
  // sine crossing, which read as frame jitter on top of the tile glide.
  const walkBob = moving ? Math.sin(Date.now() / 110) : 0;

  // ── Climb / jump animation ──────────────────────────────────────────────────
  // Climbing: an effortful scramble (faster vertical bob + slight side sway)
  // while standing on a CLIMB ramp through a plateau. Jumping: a short hop arc
  // when mounting or leaving a ramp lip (playerJumpStart is set on the step that
  // crosses the climb/ground boundary — see stepPlayerMovement).
  const _pmap = (typeof mapData === 'function') ? mapData() : null;
  const onClimb = !!(_pmap && _pmap[player.y] && _pmap[player.y][player.x] === T.CLIMB);
  // Swimming through MEDIUM_WATER (Water armor): the lower body is underwater.
  // Everything below this tile-fraction waterline is clipped away, and a ripple
  // ring is drawn at the surface so the sprite reads as submerged, not cropped.
  const swimming = !!(_pmap && _pmap[player.y] && _pmap[player.y][player.x] === T.MEDIUM_WATER);
  const WATERLINE = 0.55;
  let jumpLift = 0;
  if (typeof playerJumpStart !== 'undefined' && playerJumpStart >= 0) {
    const jt = (Date.now() - playerJumpStart) / PLAYER_JUMP_MS;
    if (jt >= 1) playerJumpStart = -1;
    else jumpLift = Math.sin(jt * Math.PI) * s * 0.45;   // hop arc up to ~0.45 tile
  }
  let climbLift = 0, climbSway = 0;
  if (onClimb) {
    const cph = Date.now() / 95;
    climbLift = Math.abs(Math.sin(cph)) * s * 0.12;       // scrambling rise
    climbSway = Math.sin(cph) * s * 0.05;                 // weight shifts side to side
  }
  // Lift the whole body (negative Y) by the combined hop + scramble offset.
  const bob = walkBob - jumpLift - climbLift;

  ctx.save();

  // Submerge the lower body while swimming: only draw above the waterline.
  // The rect is generous on the sides/top so the hat, jump arcs, and sword
  // swing stay inside; the ground shadow at the feet is clipped out with it.
  if (swimming) {
    ctx.beginPath();
    ctx.rect(sx - s * 2, sy - s * 2, s * 5, s * (2 + WATERLINE));
    ctx.clip();
  }

  // ── Low-HP danger state (≤3 HP): pulsing red glow + flash ──
  // dangerPulse oscillates 0→1; the glow rides on shadowBlur so the whole
  // sprite gets a red aura, and a red overlay flashes on top below.
  const lowHp = player.hp > 0 && player.hp <= 3;
  let dangerPulse = 0;
  if (lowHp) {
    dangerPulse = 0.5 + 0.5 * Math.sin(Date.now() / 140);
    ctx.shadowColor = `rgba(255,40,40,${(0.55 + 0.45 * dangerPulse).toFixed(3)})`;
    ctx.shadowBlur = s * (0.30 + 0.40 * dangerPulse);
  }

  // Shadow ellipse — stays on the ground, tightening and fading as the player
  // rises, and tracks the climbing sway so it sits under the body.
  const airT = Math.max(0, Math.min(1, (jumpLift + climbLift) / (s * 0.45)));
  const shScale = 1 - 0.45 * airT;
  ctx.fillStyle = `rgba(0,0,0,${(0.40 * (1 - 0.4 * airT)).toFixed(3)})`;
  ctx.beginPath();
  ctx.ellipse(sx + s/2 + climbSway, sy + s*0.93, s*0.28*shScale, s*0.07*shScale, 0, 0, Math.PI*2);
  ctx.fill();
  // Sway the body horizontally during a climb (shadow already placed above).
  if (climbSway) ctx.translate(climbSway, 0);

  // ── Worn elemental armor aura (behind the body) ───────────────────────
  // The active elemental armor cloaks the hero in its element's signature FX —
  // a luminous glow, a shroud of shadow-mist, licking flames, and so on.
  if (player.activeArmorElement) {
    drawElementFX(sx + s / 2, sy + s * 0.5 + bob, s * 0.62, player.activeArmorElement, 0.6, 0);
  }

  // ── Boots ─────────────────────────────────────────────
  ctx.fillStyle = '#3a240e';
  if (isSide) {
    // staggered footing
    const frontX = flipX ? sx + s*0.30 : sx + s*0.52;
    const backX  = flipX ? sx + s*0.52 : sx + s*0.30;
    ctx.fillRect(backX,  sy + s*0.84 + bob, s*0.18, s*0.10);
    ctx.fillRect(frontX, sy + s*0.86 + bob, s*0.18, s*0.10);
  } else {
    ctx.fillRect(sx + s*0.28, sy + s*0.84 + bob, s*0.18, s*0.10);
    ctx.fillRect(sx + s*0.54, sy + s*0.84 + bob, s*0.18, s*0.10);
  }
  // Boot soles
  ctx.fillStyle = '#1a1006';
  ctx.fillRect(sx + s*0.28, sy + s*0.91 + bob, s*0.44, s*0.03);

  // ── Tunic (trapezoid + shading) ───────────────────────
  ctx.fillStyle = '#2a8a2a';
  ctx.beginPath();
  ctx.moveTo(sx + s*0.26, sy + s*0.44 + bob);
  ctx.lineTo(sx + s*0.74, sy + s*0.44 + bob);
  ctx.lineTo(sx + s*0.80, sy + s*0.84 + bob);
  ctx.lineTo(sx + s*0.20, sy + s*0.84 + bob);
  ctx.closePath();
  ctx.fill();
  // Right-side shading
  ctx.fillStyle = '#1c6a1c';
  ctx.beginPath();
  ctx.moveTo(sx + s*0.50, sy + s*0.44 + bob);
  ctx.lineTo(sx + s*0.74, sy + s*0.44 + bob);
  ctx.lineTo(sx + s*0.80, sy + s*0.84 + bob);
  ctx.lineTo(sx + s*0.50, sy + s*0.84 + bob);
  ctx.closePath();
  ctx.fill();
  // V-neck collar (skin)
  ctx.fillStyle = '#f8d070';
  ctx.beginPath();
  ctx.moveTo(sx + s*0.42, sy + s*0.44 + bob);
  ctx.lineTo(sx + s*0.58, sy + s*0.44 + bob);
  ctx.lineTo(sx + s*0.50, sy + s*0.52 + bob);
  ctx.closePath();
  ctx.fill();
  // Belt + buckle
  ctx.fillStyle = '#5a3a14';
  ctx.fillRect(sx + s*0.22, sy + s*0.68 + bob, s*0.56, s*0.06);
  ctx.fillStyle = '#e0b040';
  ctx.fillRect(sx + s*0.46, sy + s*0.68 + bob, s*0.08, s*0.06);

  // ── Arms ──────────────────────────────────────────────
  ctx.fillStyle = '#f8d070';
  if (isSide) {
    ctx.fillRect(sx + s*0.38, sy + s*0.52 + bob, s*0.10, s*0.18);
    ctx.fillRect(sx + s*0.52, sy + s*0.52 + bob, s*0.10, s*0.18);
  } else {
    ctx.fillRect(sx + s*0.18, sy + s*0.52 + bob, s*0.10, s*0.18);
    ctx.fillRect(sx + s*0.72, sy + s*0.52 + bob, s*0.10, s*0.18);
  }

  // ── Shield (idle only; hidden during swing or when facing away) ──
  if (facing !== 'up' && player.swordTimer <= 0) {
    const shx = flipX ? sx + s*0.76 : sx + s*0.06;
    const shy = sy + s*0.48 + bob;
    ctx.fillStyle = '#7a5018';            // wood backing
    ctx.fillRect(shx, shy, s*0.18, s*0.28);
    ctx.fillStyle = '#b07028';            // wood face
    ctx.fillRect(shx + s*0.02, shy + s*0.02, s*0.14, s*0.24);
    ctx.fillStyle = '#cc2222';            // red crest
    ctx.beginPath();
    ctx.moveTo(shx + s*0.09, shy + s*0.04);
    ctx.lineTo(shx + s*0.03, shy + s*0.18);
    ctx.lineTo(shx + s*0.09, shy + s*0.26);
    ctx.lineTo(shx + s*0.15, shy + s*0.18);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffcc00';            // gold boss
    ctx.fillRect(shx + s*0.07, shy + s*0.14, s*0.04, s*0.04);
  }

  // ── Head (skin with subtle shading) ───────────────────
  ctx.fillStyle = '#e8c060';
  ctx.beginPath();
  ctx.arc(sx + s/2, sy + s*0.30 + bob, s*0.21, 0, Math.PI*2);
  ctx.fill();
  ctx.fillStyle = '#f8d070';
  ctx.beginPath();
  ctx.arc(sx + s/2 - s*0.03, sy + s*0.29 + bob, s*0.18, 0, Math.PI*2);
  ctx.fill();

  // Pointed Hylian ears (only side / front views show them)
  ctx.fillStyle = '#e8c060';
  if (facing === 'right') {
    ctx.beginPath();
    ctx.moveTo(sx + s*0.30, sy + s*0.28 + bob);
    ctx.lineTo(sx + s*0.22, sy + s*0.26 + bob);
    ctx.lineTo(sx + s*0.32, sy + s*0.36 + bob);
    ctx.closePath(); ctx.fill();
  } else if (facing === 'left') {
    ctx.beginPath();
    ctx.moveTo(sx + s*0.70, sy + s*0.28 + bob);
    ctx.lineTo(sx + s*0.78, sy + s*0.26 + bob);
    ctx.lineTo(sx + s*0.68, sy + s*0.36 + bob);
    ctx.closePath(); ctx.fill();
  } else if (facing === 'down') {
    ctx.beginPath();
    ctx.moveTo(sx + s*0.30, sy + s*0.30 + bob);
    ctx.lineTo(sx + s*0.22, sy + s*0.32 + bob);
    ctx.lineTo(sx + s*0.32, sy + s*0.38 + bob);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(sx + s*0.70, sy + s*0.30 + bob);
    ctx.lineTo(sx + s*0.78, sy + s*0.32 + bob);
    ctx.lineTo(sx + s*0.68, sy + s*0.38 + bob);
    ctx.closePath(); ctx.fill();
  }

  // Hair tufts under brim
  ctx.fillStyle = '#d8a040';
  if (facing === 'up') {
    ctx.fillRect(sx + s*0.30, sy + s*0.20 + bob, s*0.40, s*0.14);  // back of head
  } else {
    ctx.fillRect(sx + s*0.30, sy + s*0.20 + bob, s*0.10, s*0.08);
    ctx.fillRect(sx + s*0.60, sy + s*0.20 + bob, s*0.10, s*0.08);
  }

  // ── Pointed cap ───────────────────────────────────────
  // Brim
  ctx.fillStyle = '#1a7a1a';
  ctx.fillRect(sx + s*0.14, sy + s*0.16 + bob, s*0.72, s*0.06);
  // Cone (leans toward facing direction)
  const tilt = facing === 'left' ? -1 : facing === 'right' ? 1 : 0;
  ctx.fillStyle = '#229a22';
  ctx.beginPath();
  ctx.moveTo(sx + s*0.26, sy + s*0.16 + bob);
  ctx.lineTo(sx + s*0.74, sy + s*0.16 + bob);
  ctx.lineTo(sx + s/2 + tilt * s*0.18, sy - s*0.18 + bob);
  ctx.closePath();
  ctx.fill();
  // Cone highlight stripe
  ctx.fillStyle = '#3aba3a';
  ctx.beginPath();
  ctx.moveTo(sx + s*0.32, sy + s*0.16 + bob);
  ctx.lineTo(sx + s*0.40, sy + s*0.16 + bob);
  ctx.lineTo(sx + s/2 + tilt * s*0.12 - s*0.05, sy - s*0.10 + bob);
  ctx.closePath();
  ctx.fill();

  // ── Eyes ──────────────────────────────────────────────
  if (facing !== 'up') {
    ctx.fillStyle = '#000';
    if (facing === 'down') {
      ctx.fillRect(sx + s*0.38, sy + s*0.30 + bob, s*0.07, s*0.07);
      ctx.fillRect(sx + s*0.55, sy + s*0.30 + bob, s*0.07, s*0.07);
      ctx.fillStyle = '#fff';
      ctx.fillRect(sx + s*0.40, sy + s*0.31 + bob, s*0.02, s*0.02);
      ctx.fillRect(sx + s*0.57, sy + s*0.31 + bob, s*0.02, s*0.02);
    } else {
      const ex = facing === 'right' ? sx + s*0.56 : sx + s*0.36;
      ctx.fillRect(ex, sy + s*0.30 + bob, s*0.09, s*0.07);
      ctx.fillStyle = '#fff';
      ctx.fillRect(ex + (facing === 'right' ? s*0.05 : 0), sy + s*0.31 + bob, s*0.02, s*0.02);
    }
  }

  // ── Sword swing (animated arc) ────────────────────────
  if (player.swordTimer > 0) {
    const phase = 1 - Math.max(0, Math.min(1, player.swordTimer / 180)); // 0 → 1
    const baseAngle = Math.atan2(sd.y, sd.x);
    const swingArc = Math.PI * 0.85;
    const a = baseAngle - swingArc / 2 + swingArc * phase;
    const cx = sx + s/2, cy = sy + s/2 + bob;
    const hilt = s * 0.32, len = s * 1.25;
    const baseX = cx + Math.cos(a) * hilt, baseY = cy + Math.sin(a) * hilt;
    const tipX  = cx + Math.cos(a) * len,  tipY  = cy + Math.sin(a) * len;

    // An equipped elemental sword tints the whole swing in its element's colour
    // and glows: the motion trail, blade gradient, and tip sparkle all pick it up.
    const swElem = (player.activeSwordElement)
      ? elementInfo(player.activeSwordElement) : null;
    const trailCol = swElem ? swElem.color : '#ffffff';
    if (swElem) { ctx.shadowColor = swElem.color; ctx.shadowBlur = s * 0.35; }

    // Motion trail
    for (let i = 3; i >= 1; i--) {
      const tA = a - swingArc * 0.06 * i;
      ctx.globalAlpha = 0.10 * i;
      ctx.strokeStyle = trailCol;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(tA) * hilt, cy + Math.sin(tA) * hilt);
      ctx.lineTo(cx + Math.cos(tA) * len,  cy + Math.sin(tA) * len);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Blade with gradient — element-tinted at the hilt fading to a white edge
    // when an elemental sword is equipped, otherwise plain steel.
    const grad = ctx.createLinearGradient(baseX, baseY, tipX, tipY);
    grad.addColorStop(0, swElem ? swElem.color : '#bdbdbd');
    grad.addColorStop(0.6, swElem ? swElem.color : '#f0f0f0');
    grad.addColorStop(1, '#ffffff');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(baseX, baseY);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Elemental signature FX bursting from the blade tip.
    if (player.activeSwordElement) {
      drawElementFX(tipX, tipY, s * 0.55, player.activeSwordElement, 0.85 + 0.15 * phase, 0);
    }

    // Crossguard
    const cA = a + Math.PI / 2;
    ctx.strokeStyle = '#aa6a18';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(baseX - Math.cos(cA) * s*0.12, baseY - Math.sin(cA) * s*0.12);
    ctx.lineTo(baseX + Math.cos(cA) * s*0.12, baseY + Math.sin(cA) * s*0.12);
    ctx.stroke();

    // Pommel
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath();
    ctx.arc(baseX, baseY, 3, 0, Math.PI*2);
    ctx.fill();

    // Tip sparkle on the leading edge
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(tipX, tipY, 2.4, 0, Math.PI*2);
    ctx.fill();
  }

  // ── Low-HP red flash overlay (drawn last so it tints the whole sprite) ──
  if (lowHp) {
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.16 + 0.26 * dangerPulse;
    ctx.fillStyle = '#ff2020';
    ctx.beginPath();
    ctx.arc(sx + s/2, sy + s*0.48 + bob, s*0.46, 0, Math.PI*2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.restore();

  // ── Waterline ripple (outside the clip so the full rings show) ──
  if (swimming) {
    const ph = Date.now() / 350;
    ctx.strokeStyle = 'rgba(191,230,244,0.75)';
    ctx.lineWidth = Math.max(1, s * 0.045);
    ctx.beginPath();
    ctx.ellipse(sx + s/2, sy + s*WATERLINE, s * (0.30 + 0.03 * Math.sin(ph)), s*0.085, 0, 0, Math.PI*2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(90,168,200,0.45)';
    ctx.beginPath();
    ctx.ellipse(sx + s/2, sy + s*WATERLINE + s*0.03, s * (0.40 + 0.04 * Math.sin(ph + 1.3)), s*0.11, 0, 0, Math.PI*2);
    ctx.stroke();
  }
}


// Floor pickup (currently only HP hearts). Bobs and pulses; blinks when expiring.
function drawDrop(d, ts) {
  // Blink during the final 2 seconds
  if (d.life < 2000 && Math.floor(d.life / 140) % 2 === 0) return;
  const cx = (d.x - camC + 0.5) * ts;
  const baseY = (d.y - camR + 0.5) * ts;
  const bobOff = Math.sin(d.bob / 220) * ts * 0.10;
  const cy = baseY + bobOff;
  const pulse = 1 + Math.sin(d.bob / 180) * 0.07;

  ctx.save();

  // Soft glow tinted to the drop type
  const trophy = (typeof TROPHY_META !== 'undefined') ? TROPHY_META[d.type] : null;
  const arrowElem = (d.type === 'arrows' && d.element)
    ? SWORD_ELEMENTS[d.element] : null;
  const hexToRGB = (h) => {
    const n = parseInt((h || '#ffffff').slice(1), 16);
    return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
  };
  const glowColor =
    d.type === 'ruby'    ? '40,220,90'   :
    d.type === 'herbal'   ? '120,210,80'  :
    d.type === 'mushroom' ? '200,112,74'  :
    d.type === 'potion'   ? '255,120,180' :
    d.type === 'bonemeal' ? '232,224,200' :  // pale bone-dust
    d.type === 'winterberry' ? '154,122,216' :  // blue-purple berry
    d.type === 'frostpetal'  ? '191,226,245' :  // pale ice-blue petal
    d.type === 'seashell'    ? '232,184,160' :  // pale shell
    d.type === 'coral'       ? '232,118,90'  :  // coral orange
    d.type === 'sage'        ? '124,154,106' :  // sage green
    d.type === 'moss'        ? '120,168,80'  :  // moss green
    d.type === 'crystal'     ? '168,127,208' :  // amethyst violet
    d.type === 'skypetal'    ? '242,168,208' :  // pink sky bloom
    d.type === 'windseed'    ? '216,196,122' :  // golden wind seed
    d.type === 'thistledown' ? '168,208,240' :  // airy storm-blue
    d.type === 'voltpetal'   ? '126,200,255' :  // electric-blue volt bloom
    d.type === 'sparkseed'   ? '255,226,122' :  // bright spark gold
    d.type === 'fulgurite'   ? '179,166,255' :  // fused-glass violet
    d.type === 'witherwood'  ? '106,90,82'   :  // grey deadwood
    d.type === 'gravebloom'  ? '154,168,106' :  // sickly carrion green
    d.type === 'mote'        ? '255,232,160' :  // warm white-gold light mote
    d.type === 'manapetal'   ? '182,108,224' :  // violet mana bloom
    d.type === 'heartfrond'  ? '99,200,116'  :  // lush fern green
    d.type === 'glowcap'     ? '170,120,224' :  // glowing violet cap
    d.type === 'fiddlehead'  ? '63,154,58'   :  // coiled fern shoot green
    d.type === 'aloe'        ? '90,168,106'  :  // desert succulent green
    d.type === 'frostfern'   ? '168,216,192' :  // frost-rimed fern green
    d.type === 'sunseed'     ? '244,230,176' :  // warm gold light-seed
    d.type === 'prism'       ? '253,240,200' :  // bright prism shard
    d.type === 'reedpith'    ? '200,184,106' :  // pale reed-pith tan
    arrowElem             ? hexToRGB(arrowElem.color) :
    d.type === 'arrows'   ? '221,170,68' :  // plain arrows: warm tan/wood
    trophy                ? hexToRGB(trophy.color) :
                            '255,120,160';
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, ts * 0.42);
  glow.addColorStop(0, `rgba(${glowColor},0.55)`);
  glow.addColorStop(1, `rgba(${glowColor},0)`);
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, ts * 0.42, 0, Math.PI * 2);
  ctx.fill();

  if (d.type === 'hp') {
    const lobeR = ts * 0.14 * pulse;
    // Two lobes
    ctx.fillStyle = '#cc1f3a';
    ctx.beginPath();
    ctx.arc(cx - lobeR * 0.95, cy - lobeR * 0.6, lobeR, 0, Math.PI * 2);
    ctx.arc(cx + lobeR * 0.95, cy - lobeR * 0.6, lobeR, 0, Math.PI * 2);
    ctx.fill();
    // Bottom V
    ctx.beginPath();
    ctx.moveTo(cx - lobeR * 1.85, cy - lobeR * 0.25);
    ctx.lineTo(cx + lobeR * 1.85, cy - lobeR * 0.25);
    ctx.lineTo(cx, cy + lobeR * 1.7);
    ctx.closePath();
    ctx.fill();
    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.arc(cx - lobeR * 0.85, cy - lobeR * 0.95, lobeR * 0.34, 0, Math.PI * 2);
    ctx.fill();
    // Value label
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.font = `bold ${Math.round(ts * 0.28)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lblY = cy + ts * 0.05;
    ctx.strokeText('+' + d.val, cx, lblY);
    ctx.fillText('+' + d.val, cx, lblY);
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
  } else if (d.type === 'ruby') {
    // Hexagonal-ish green Zelda-style ruby
    const w = ts * 0.12 * pulse, h = ts * 0.20 * pulse;
    ctx.fillStyle = '#22aa3a';
    ctx.beginPath();
    ctx.moveTo(cx,        cy - h);
    ctx.lineTo(cx + w,    cy - h * 0.4);
    ctx.lineTo(cx + w,    cy + h * 0.4);
    ctx.lineTo(cx,        cy + h);
    ctx.lineTo(cx - w,    cy + h * 0.4);
    ctx.lineTo(cx - w,    cy - h * 0.4);
    ctx.closePath();
    ctx.fill();
    // Inner facet
    ctx.fillStyle = '#5fe070';
    ctx.beginPath();
    ctx.moveTo(cx,             cy - h * 0.6);
    ctx.lineTo(cx + w * 0.55,  cy - h * 0.2);
    ctx.lineTo(cx,             cy + h * 0.6);
    ctx.lineTo(cx - w * 0.55,  cy - h * 0.2);
    ctx.closePath();
    ctx.fill();
    // Shimmer highlight
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.35, cy - h * 0.55);
    ctx.lineTo(cx - w * 0.1,  cy - h * 0.85);
    ctx.lineTo(cx - w * 0.05, cy - h * 0.25);
    ctx.closePath();
    ctx.fill();
  } else if (d.type === 'herbal') {
    // Leafy sprig: a brown stem with three teardrop leaves
    const s = ts * 0.18 * pulse;
    ctx.strokeStyle = '#5a3a1a';
    ctx.lineWidth = Math.max(1, ts * 0.04);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy + s * 0.9);
    ctx.lineTo(cx, cy - s * 0.9);
    ctx.stroke();
    // Three leaves: top, lower-left, lower-right
    const leaf = (lx, ly, rot) => {
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(rot);
      ctx.fillStyle = '#3f9a3a';
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.55, s * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1f5a1f';
      ctx.lineWidth = Math.max(1, ts * 0.02);
      ctx.beginPath();
      ctx.moveTo(-s * 0.5, 0);
      ctx.lineTo(s * 0.5, 0);
      ctx.stroke();
      ctx.restore();
    };
    leaf(cx,             cy - s * 0.75, 0);
    leaf(cx - s * 0.45,  cy + s * 0.05, -Math.PI / 4);
    leaf(cx + s * 0.45,  cy + s * 0.05,  Math.PI / 4);
  } else if (trophy || d.type === 'potion' || d.type === 'arrows' || d.type === 'mushroom' || d.type === 'bonemeal' || d.type === 'winterberry' || d.type === 'frostpetal' || d.type === 'seashell' || d.type === 'coral' || d.type === 'sage' || d.type === 'moss' || d.type === 'crystal' || d.type === 'skypetal' || d.type === 'windseed' || d.type === 'thistledown' || d.type === 'voltpetal' || d.type === 'sparkseed' || d.type === 'fulgurite' || d.type === 'witherwood' || d.type === 'gravebloom' || d.type === 'mote' || d.type === 'manapetal' || d.type === 'heartfrond' || d.type === 'glowcap' || d.type === 'fiddlehead' || d.type === 'aloe' || d.type === 'frostfern' || d.type === 'sunseed' || d.type === 'prism' || d.type === 'reedpith') {
    // Trophy items + potion + arrow bundle + mushroom + bone meal + winter berry
    // + frost petal: render as a glyph centered on the tile. Arrow drops show the
    // elemental icon and the count; the rest show their thematic icon.
    const icon =
      d.type === 'arrows'   ? (arrowElem ? arrowElem.icon : '🏹') :
      d.type === 'potion'   ? '🧪' :
      d.type === 'mushroom' ? '🍄' :
      d.type === 'bonemeal' ? '🧂' :
      d.type === 'winterberry' ? '🫐' :
      d.type === 'frostpetal'  ? '💮' :
      d.type === 'seashell'    ? '🐚' :
      d.type === 'coral'       ? '🪸' :
      d.type === 'sage'        ? '🌿' :
      d.type === 'moss'        ? '🌱' :
      d.type === 'crystal'     ? '🔮' :
      d.type === 'skypetal'    ? '🌸' :
      d.type === 'windseed'    ? '🌾' :
      d.type === 'thistledown' ? '💨' :
      d.type === 'voltpetal'   ? '🌼' :
      d.type === 'sparkseed'   ? '🌾' :
      d.type === 'fulgurite'   ? '🔷' :
      d.type === 'witherwood'  ? '🪵' :
      d.type === 'gravebloom'  ? '🥀' :
      d.type === 'mote'        ? '✨' :
      d.type === 'manapetal'   ? '🪻' :
      d.type === 'heartfrond'  ? '🍃' :
      d.type === 'glowcap'     ? '🍄' :
      d.type === 'fiddlehead'  ? '🌿' :
      d.type === 'aloe'        ? '🪴' :
      d.type === 'frostfern'   ? '❄️' :
      d.type === 'sunseed'     ? '🌟' :
      d.type === 'prism'       ? '🔆' :
      d.type === 'reedpith'    ? '🌾' :
      (trophy ? trophy.icon : '❓');
    const size = Math.round(ts * 0.42 * pulse);
    ctx.font = `${size}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, cx, cy);
    if (d.type === 'arrows' && d.val > 1) {
      // Stack count badge in the lower-right
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.font = `bold ${Math.round(ts * 0.22)}px monospace`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const lbl = 'x' + d.val;
      ctx.strokeText(lbl, cx + ts * 0.12, cy + ts * 0.18);
      ctx.fillText(lbl, cx + ts * 0.12, cy + ts * 0.18);
    }
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
  }

  ctx.restore();
}

// ─── Elemental visual FX ───────────────────────────────────────────────────────
// Render an element's animated signature (see ELEMENT_FX / elements.js) centred
// at (cx, cy) within radius r. Drives the look of glowing sword swings, trailing
// arrows, worn-armor auras, and elemental enemies + their attacks from one place.
//   intensity : 0..1 opacity multiplier (subtle auras use ~0.5, procs use ~1)
//   seed      : per-source phase offset so a crowd doesn't pulse in unison
const _ELEM_RGB_CACHE = {};
function elemRGB(hex) {
  if (_ELEM_RGB_CACHE[hex]) return _ELEM_RGB_CACHE[hex];
  const n = parseInt((hex || '#ffffff').slice(1), 16);
  return (_ELEM_RGB_CACHE[hex] = `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`);
}

function drawElementFX(cx, cy, r, elemId, intensity = 1, seed = 0) {
  const fx = elementFX(elemId);
  if (!fx || r <= 0) return;
  const c1 = elemRGB(fx.c1), c2 = elemRGB(fx.c2);
  const now = Date.now() / 1000 + seed;
  const I = Math.max(0, Math.min(1, intensity));
  ctx.save();

  switch (fx.style) {
    case 'glow': {
      // Soft radiant halo that breathes, plus a few orbiting twinkles.
      const pulse = 0.72 + 0.28 * Math.sin(now * 3.1);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0,   `rgba(${c2},${(0.55 * I * pulse).toFixed(3)})`);
      g.addColorStop(0.5, `rgba(${c1},${(0.34 * I * pulse).toFixed(3)})`);
      g.addColorStop(1,   `rgba(${c1},0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(${c2},${(0.9 * I).toFixed(3)})`;
      for (let i = 0; i < 4; i++) {
        const a = now * 1.7 + i * (Math.PI / 2);
        const tr = r * (0.35 + 0.4 * (0.5 + 0.5 * Math.sin(now * 2.3 + i)));
        const tx = cx + Math.cos(a) * tr, ty = cy + Math.sin(a) * tr;
        const tw = r * 0.06 * (0.6 + 0.4 * Math.sin(now * 5 + i));
        ctx.beginPath(); ctx.arc(tx, ty, Math.max(0.6, tw), 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    case 'mist': {
      // Roiling shroud — a coloured haze so the darkness reads, deep-shade blobs
      // for body, and bright embers rising through it. The coloured layer (c1)
      // keeps shadow/necrotic visible where the near-black shade alone would not.
      const gg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 1.1);
      gg.addColorStop(0,   `rgba(${c1},${(0.5 * I).toFixed(3)})`);
      gg.addColorStop(0.55,`rgba(${c1},${(0.24 * I).toFixed(3)})`);
      gg.addColorStop(1,   `rgba(${c1},0)`);
      ctx.fillStyle = gg;
      ctx.beginPath(); ctx.arc(cx, cy, r * 1.1, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 6; i++) {
        const ph = now * 1.05 + i * 1.047;
        const ox = Math.cos(ph) * r * 0.5;
        const oy = Math.sin(ph * 1.3) * r * 0.34 - r * 0.12;
        const br = r * (0.46 + 0.16 * Math.sin(now * 1.9 + i));
        const g = ctx.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, br);
        g.addColorStop(0,   `rgba(${c2},${(0.52 * I).toFixed(3)})`);
        g.addColorStop(0.55,`rgba(${c1},${(0.30 * I).toFixed(3)})`);
        g.addColorStop(1,   `rgba(${c1},0)`);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(cx + ox, cy + oy, br, 0, Math.PI * 2); ctx.fill();
      }
      // Bright embers rising through the smoke give the dark aura a live edge.
      for (let i = 0; i < 4; i++) {
        const prog = ((now * 0.55 + i * 0.31) % 1);
        const mx = cx + Math.sin(now * 1.6 + i * 2) * r * 0.42;
        const my = cy + r * 0.4 - prog * r * 1.05;
        const mr = r * 0.06 * (1 - prog * 0.4);
        ctx.fillStyle = `rgba(${c1},${((1 - prog) * 0.9 * I).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(mx, my, Math.max(0.7, mr), 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    case 'flame': {
      // Flickering tongues licking upward from the base.
      const baseY = cy + r * 0.35;
      for (let i = 0; i < 5; i++) {
        const fxo = (i - 2) * r * 0.28;
        const flick = 0.6 + 0.4 * Math.sin(now * 11 + i * 1.9);
        const h = r * (0.85 + 0.5 * flick);
        const w = r * 0.22 * (0.7 + 0.3 * flick);
        const bx = cx + fxo + Math.sin(now * 7 + i) * r * 0.05;
        const g = ctx.createLinearGradient(bx, baseY, bx, baseY - h);
        g.addColorStop(0,   `rgba(${c1},${(0.75 * I).toFixed(3)})`);
        g.addColorStop(0.6, `rgba(${c2},${(0.6 * I).toFixed(3)})`);
        g.addColorStop(1,   `rgba(${c2},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(bx - w, baseY);
        ctx.quadraticCurveTo(bx - w * 0.5, baseY - h * 0.6, bx, baseY - h);
        ctx.quadraticCurveTo(bx + w * 0.5, baseY - h * 0.6, bx + w, baseY);
        ctx.closePath(); ctx.fill();
      }
      break;
    }
    case 'erupt': {
      // A volcano mid-eruption: a molten crater that pulses with blasts, an
      // ash/ember plume, and lava bombs hurled skyward that arc and fall back.
      const baseY = cy + r * 0.42;
      const craterY = baseY - r * 0.14;
      const rnd = (k) => { const v = Math.sin(k * 127.1 + seed * 311.7 + 0.5) * 43758.5; return v - Math.floor(v); };
      const blast = 0.68 + 0.32 * Math.sin(now * 6.0);

      // Molten glow at the crater, throbbing like repeated detonations.
      const g = ctx.createRadialGradient(cx, baseY, 0, cx, baseY, r * 0.98);
      g.addColorStop(0,    `rgba(${c2},${(0.78 * I * blast).toFixed(3)})`);
      g.addColorStop(0.35, `rgba(${c1},${(0.5 * I).toFixed(3)})`);
      g.addColorStop(1,    `rgba(${c1},0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, baseY, r * 0.98, 0, Math.PI * 2); ctx.fill();

      // Dark ash/ember plume billowing up out of the crater.
      const plume = ctx.createLinearGradient(cx, craterY, cx, cy - r * 1.05);
      plume.addColorStop(0,   `rgba(${c1},${(0.42 * I).toFixed(3)})`);
      plume.addColorStop(0.5, `rgba(90,60,60,${(0.28 * I).toFixed(3)})`);
      plume.addColorStop(1,   `rgba(70,64,68,0)`);
      ctx.fillStyle = plume;
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.16, craterY);
      ctx.quadraticCurveTo(cx - r * 0.52, cy - r * 0.6, cx - r * 0.3, cy - r * 1.05);
      ctx.lineTo(cx + r * 0.3, cy - r * 1.05);
      ctx.quadraticCurveTo(cx + r * 0.52, cy - r * 0.6, cx + r * 0.16, craterY);
      ctx.closePath(); ctx.fill();

      // Dark volcano mound with a glowing crater mouth.
      ctx.fillStyle = `rgba(38,20,14,${(0.6 * I).toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.62, baseY + r * 0.3);
      ctx.lineTo(cx - r * 0.22, craterY);
      ctx.lineTo(cx + r * 0.22, craterY);
      ctx.lineTo(cx + r * 0.62, baseY + r * 0.3);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = `rgba(${c2},${(0.9 * I * blast).toFixed(3)})`;
      ctx.beginPath(); ctx.ellipse(cx, craterY, r * 0.24, r * 0.07, 0, 0, Math.PI * 2); ctx.fill();

      // Lava bombs blasted skyward, arcing under gravity and fading as they fall.
      const G = r * 2.7;
      for (let i = 0; i < 9; i++) {
        const prog = ((now * (0.7 + rnd(i) * 0.5) + rnd(i + 40)) % 1);
        const ang = -Math.PI / 2 + (rnd(i + 7) - 0.5) * 1.7;      // spread around straight-up
        const sp = r * (1.3 + rnd(i + 13) * 0.8);
        const vx = Math.cos(ang) * sp, vy = Math.sin(ang) * sp;
        const bx = cx + vx * prog;
        const by = craterY + vy * prog + 0.5 * G * prog * prog;
        if (by > baseY + r * 0.32) continue;                      // already landed
        const bs = r * (0.12 + rnd(i + 21) * 0.06) * (1 - prog * 0.25);
        const a = (prog < 0.85 ? 1 : (1 - prog) / 0.15) * I;
        // motion-blur trail pointing back along velocity
        const cvy = vy + G * prog;
        ctx.strokeStyle = `rgba(${c1},${(0.5 * a).toFixed(3)})`;
        ctx.lineWidth = Math.max(1, bs * 0.7);
        ctx.beginPath();
        ctx.moveTo(bx - vx * 0.07, by - cvy * 0.07);
        ctx.lineTo(bx, by);
        ctx.stroke();
        // glowing molten bomb: hot halo under a bright core
        ctx.fillStyle = `rgba(${c1},${(0.55 * a).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(bx, by, Math.max(1.2, bs * 1.7), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(${c2},${(0.95 * a).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(bx, by, Math.max(0.8, bs), 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    case 'drip': {
      // Acidic sheen + droplets that swell at the base and fall, fading out.
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, `rgba(${c1},${(0.32 * I).toFixed(3)})`);
      g.addColorStop(1, `rgba(${c1},0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 4; i++) {
        const prog = ((now * 1.1 + i * 0.61) % 1);
        const dx = cx + (i - 1.5) * r * 0.42;
        const dy = cy + r * 0.15 + prog * r * 0.95;
        const dr = r * 0.14 * (1 - prog * 0.5);
        const a = (prog < 0.85 ? 0.85 : (1 - prog) / 0.15 * 0.85) * I;
        ctx.fillStyle = `rgba(${c2},${a.toFixed(3)})`;
        ctx.beginPath(); ctx.arc(dx, dy, Math.max(0.6, dr), 0, Math.PI * 2); ctx.fill();
        // teardrop tail
        ctx.beginPath();
        ctx.moveTo(dx - dr * 0.7, dy);
        ctx.lineTo(dx, dy - dr * 1.6);
        ctx.lineTo(dx + dr * 0.7, dy);
        ctx.closePath(); ctx.fill();
      }
      break;
    }
    case 'bubble': {
      // Wet blue sheen with rising bubbles.
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, `rgba(${c1},${(0.34 * I).toFixed(3)})`);
      g.addColorStop(1, `rgba(${c1},0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = Math.max(0.8, r * 0.05);
      for (let i = 0; i < 5; i++) {
        const prog = ((now * 0.7 + i * 0.37) % 1);
        const bx = cx + Math.sin(now * 1.5 + i * 2) * r * 0.35;
        const by = cy + r * 0.45 - prog * r * 1.1;
        const br = r * (0.08 + 0.09 * (i % 3) / 2);
        ctx.strokeStyle = `rgba(${c2},${((1 - prog) * 0.8 * I).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.stroke();
      }
      break;
    }
    case 'frost': {
      // Pale cold glow with radiating crystalline spikes.
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, `rgba(${c2},${(0.4 * I).toFixed(3)})`);
      g.addColorStop(1, `rgba(${c1},0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      const spin = now * 0.4;
      for (let i = 0; i < 6; i++) {
        const a = spin + i * (Math.PI / 3);
        const len = r * (0.55 + 0.12 * Math.sin(now * 2 + i));
        const bx = cx + Math.cos(a) * r * 0.2, by = cy + Math.sin(a) * r * 0.2;
        const tx = cx + Math.cos(a) * len, ty = cy + Math.sin(a) * len;
        const pa = a + Math.PI / 2, pw = r * 0.1;
        ctx.fillStyle = `rgba(${c2},${(0.5 * I).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(bx + Math.cos(pa) * pw, by + Math.sin(pa) * pw);
        ctx.lineTo(tx, ty);
        ctx.lineTo(bx - Math.cos(pa) * pw, by - Math.sin(pa) * pw);
        ctx.closePath(); ctx.fill();
      }
      break;
    }
    case 'spark': {
      // Jittering electric arcs, re-randomised in quantised time steps.
      const step = Math.floor(now * 14);
      const rnd = (k) => {
        const v = Math.sin((step * 12.9898 + k * 78.233 + seed) * 43758.5453);
        return v - Math.floor(v);
      };
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, `rgba(${c2},${(0.3 * I).toFixed(3)})`);
      g.addColorStop(1, `rgba(${c1},0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = `rgba(${c2},${(0.9 * I).toFixed(3)})`;
      ctx.lineWidth = Math.max(1, r * 0.06);
      ctx.lineCap = 'round';
      for (let b = 0; b < 3; b++) {
        const a0 = rnd(b) * Math.PI * 2;
        let x = cx, y = cy;
        ctx.beginPath(); ctx.moveTo(x, y);
        for (let j = 1; j <= 4; j++) {
          const a = a0 + (rnd(b * 7 + j) - 0.5) * 1.6;
          const seg = r * 0.32;
          x += Math.cos(a) * seg; y += Math.sin(a) * seg;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      break;
    }
    case 'dust': {
      // A churning cloud of grit with orbiting pebbles and bright flecks kicked
      // up around the source. Pale specks give the earthy brown strong contrast.
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 1.1);
      g.addColorStop(0,   `rgba(${c2},${(0.5 * I).toFixed(3)})`);
      g.addColorStop(0.6, `rgba(${c1},${(0.34 * I).toFixed(3)})`);
      g.addColorStop(1,   `rgba(${c1},0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, r * 1.1, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 9; i++) {
        const a = now * 1.7 + i * (Math.PI * 2 / 9);
        const orb = r * (0.44 + 0.3 * Math.sin(now * 1.3 + i * 2));
        const px2 = cx + Math.cos(a) * orb, py2 = cy + Math.sin(a) * orb * 0.7 + r * 0.12;
        const ps = r * (0.16 + 0.09 * (i % 3) / 2);
        // Every third fleck is a bright near-white mote so the grit pops.
        const bright = (i % 3 === 0);
        const col = bright ? '255,246,220' : (i % 2 ? c2 : c1);
        ctx.fillStyle = `rgba(${col},${((bright ? 1 : 0.95) * I).toFixed(3)})`;
        ctx.fillRect(px2 - ps / 2, py2 - ps / 2, ps, ps);
      }
      break;
    }
    case 'wind': {
      // Bold swirling gusts sweeping around the source. Each gust is a dark
      // underlay + bright core so the pale air arcs read on any terrain, with
      // streaking motes riding the leading edge.
      ctx.lineCap = 'round';
      // Bound the spin into [0,2π): `now` is Date.now()-based (~1e9), and canvas
      // arc() renders degenerately when handed start/end angles that large.
      const spin = (now * 2.6) % (Math.PI * 2);
      for (let i = 0; i < 4; i++) {
        const a0 = spin + i * (Math.PI / 2);
        const rr = r * (0.44 + 0.18 * i / 4);
        const sweep = Math.PI * 1.2;
        // dark underlay for contrast against light terrain
        ctx.strokeStyle = `rgba(58,72,86,${(0.72 * I).toFixed(3)})`;
        ctx.lineWidth = Math.max(2.5, r * 0.2);
        ctx.beginPath(); ctx.arc(cx, cy, rr, a0, a0 + sweep); ctx.stroke();
        // bright core
        ctx.strokeStyle = `rgba(${i % 2 ? c1 : c2},${Math.min(1, 1.15 * I).toFixed(3)})`;
        ctx.lineWidth = Math.max(1.2, r * 0.1);
        ctx.beginPath(); ctx.arc(cx, cy, rr, a0, a0 + sweep); ctx.stroke();
        // arrowhead mote flung off the leading edge
        const ae = a0 + sweep;
        const mx = cx + Math.cos(ae) * rr, my = cy + Math.sin(ae) * rr;
        ctx.fillStyle = `rgba(${c2},${Math.min(1, 1.1 * I).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(mx, my, Math.max(1, r * 0.09), 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
  }
  ctx.restore();
}

function drawProjectile(p) {
  const sx = (p.tx - camC) * TILE_PX, sy = (p.ty - camR) * TILE_PX;
  ctx.save();
  if (p.type === 'arrow') {
    const len = TILE_PX * 0.4;
    const mag = Math.sqrt(p.vx*p.vx + p.vy*p.vy) || 1;
    const nx = p.vx/mag, ny = p.vy/mag;
    ctx.strokeStyle = p.color || '#ddaa44'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sx - nx*len, sy - ny*len);
    ctx.lineTo(sx + nx*len, sy + ny*len);
    ctx.stroke();
    ctx.fillStyle = '#8855aa';
    ctx.beginPath(); ctx.arc(sx + nx*len, sy + ny*len, 3, 0, Math.PI*2); ctx.fill();
    // Elemental arrows trail their element's signature FX from the arrowhead.
    if (p.element) {
      drawElementFX(sx + nx*len, sy + ny*len, TILE_PX * 0.42, p.element, 0.9, p.tx);
    }
  } else if (p.type === 'bomb') {
    const br = TILE_PX * 0.22;
    ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(sx,sy,br,0,Math.PI*2); ctx.fill();
    // Fuse spark blinks
    if (Math.floor(Date.now()/100 + p.life) % 2 === 0) {
      ctx.fillStyle = '#ff4400';
      ctx.beginPath(); ctx.arc(sx, sy - br, br*0.5, 0, Math.PI*2); ctx.fill();
    }
  } else {
    // Enemy projectile (magic ball). Elemental attacks carry their element's
    // signature FX so an incoming spell reads the same as the foe that threw it.
    if (p.element) {
      drawElementFX(sx, sy, TILE_PX * 0.45, p.element, 0.95, p.tx + p.ty);
    }
    ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(sx,sy,5,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,200,0.6)'; ctx.beginPath(); ctx.arc(sx,sy,3,0,Math.PI*2); ctx.fill();
  }
  ctx.restore();
}

// ─── Minimap ──────────────────────────────────────────────────────────────────
// Per-map cached offscreen canvas. Rebuilt only when fog changes or the map
// changes — much cheaper than redrawing every tile every frame.

let minimapDirty = true;
let minimapCanvases = {};   // keyed by mapId

// Which of the four map edges actually lead somewhere, so the minimap only
// draws an exit arrow where a real transition exists. An edge counts when the
// border has a walkable gap at the exit gate (overworld exit) OR a cave
// transition tile (CAVE_EXIT / CAVE_DESCENT) sits at that edge's midpoint
// (waterfall cave levels). Interior transitions — a cache cave's central exit,
// a whirlpool, a hidden waterfall door — aren't edges and get no arrow.
function edgeTransitions(mapObj) {
  const m = mapObj.map;
  const isTrans = (t) => t === T.CAVE_EXIT || t === T.CAVE_DESCENT ||
                         t === T.SKY_EXIT  || t === T.SKY_ASCENT;
  const gap = (c, r) => !isSolid(m, c, r);                 // overworld border gap
  const nearMid = (rows, cols) => {                        // cave transition at edge mid
    for (const r of rows) for (const c of cols) if (isTrans(m[r][c])) return true;
    return false;
  };
  const band = [0, 1, 2, 3, 4];
  return {
    left:  gap(0, EXIT_ROW)        || nearMid([EXIT_ROW], band),
    right: gap(MCOLS - 1, EXIT_ROW)|| nearMid([EXIT_ROW], band.map(c => MCOLS - 1 - c)),
    up:    gap(EXIT_COL, 0)        || nearMid(band, [EXIT_COL]),
    down:  gap(EXIT_COL, MROWS - 1)|| nearMid(band.map(r => MROWS - 1 - r), [EXIT_COL])
  };
}

function drawMinimap() {
  const scale = 1.2;
  const mw = Math.floor(MCOLS * scale), mh = Math.floor(MROWS * scale);
  const mx = PW - mw - 8, my = 8;

  let mmc = minimapCanvases[currentMapId];
  if (minimapDirty || !mmc || mmc.width !== mw || mmc.height !== mh) {
    if (!mmc) {
      mmc = document.createElement('canvas');
      minimapCanvases[currentMapId] = mmc;
    }
    mmc.width = mw; mmc.height = mh;
    const mc2 = mmc.getContext('2d');
    mc2.fillStyle = '#000';
    mc2.fillRect(0, 0, mw, mh);
    const mapObj = currentMap();
    for (let r = 0; r < MROWS; r++) {
      for (let c = 0; c < MCOLS; c++) {
        if (isFoggy(mapObj, c, r)) continue;
        const t = mapObj.map[r][c];
        mc2.fillStyle = TILE_COLORS[t] || '#111';
        mc2.fillRect(Math.floor(c*scale), Math.floor(r*scale), Math.ceil(scale), Math.ceil(scale));
      }
    }
    minimapDirty = false;
  }

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.fillRect(mx-2, my-2, mw+4, mh+4);
  ctx.drawImage(mmc, mx, my);

  // Player dot
  ctx.fillStyle = '#ffcc00';
  ctx.fillRect(mx + Math.floor(player.x*scale) - 1, my + Math.floor(player.y*scale) - 1, 3, 3);
  // Enemy dots (live)
  enemies.filter(e => !e.dead).forEach(e => {
    ctx.fillStyle = e.boss ? '#ff00ff' : '#ff4444';
    ctx.fillRect(mx + Math.floor(e.x*scale), my + Math.floor(e.y*scale), 2, 2);
  });
  // Exit markers — only on edges that actually lead somewhere.
  const exits = edgeTransitions(currentMap());
  ctx.fillStyle = '#ffff00'; ctx.font = '8px monospace';
  ctx.textAlign = 'left';
  if (exits.right) ctx.fillText('▶', mx+mw-6, my+Math.floor(EXIT_ROW*scale)+4);
  if (exits.left)  ctx.fillText('◀', mx+1,    my+Math.floor(EXIT_ROW*scale)+4);
  ctx.textAlign = 'center';
  if (exits.up)    ctx.fillText('▲', mx+Math.floor(EXIT_COL*scale), my+6);
  if (exits.down)  ctx.fillText('▼', mx+Math.floor(EXIT_COL*scale), my+mh-1);

  // Villager dots — only meaningful in an active village
  if (typeof villagers !== 'undefined') {
    ctx.fillStyle = '#88ddff';
    villagers.forEach(v => {
      ctx.fillRect(mx + Math.floor(v.x * scale), my + Math.floor(v.y * scale), 2, 2);
    });
  }

  // Active-village shop markers (I = inn, $ = store) — always on top of fog
  const cm = currentMap();
  if (cm && cm.activated) {
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    if (cm.innDoor) {
      ctx.fillStyle = '#ff8844';
      ctx.fillText('I', mx + Math.floor(cm.innDoor.c * scale), my + Math.floor(cm.innDoor.r * scale) + 4);
    }
    if (cm.storeDoor) {
      ctx.fillStyle = '#44ff88';
      ctx.fillText('$', mx + Math.floor(cm.storeDoor.c * scale), my + Math.floor(cm.storeDoor.r * scale) + 4);
    }
    if (cm.herbDoor) {
      ctx.fillStyle = '#aaee66';
      ctx.fillText('H', mx + Math.floor(cm.herbDoor.c * scale), my + Math.floor(cm.herbDoor.r * scale) + 4);
    }
    if (cm.smithDoor) {
      ctx.fillStyle = '#aac4ee';
      ctx.fillText('B', mx + Math.floor(cm.smithDoor.c * scale), my + Math.floor(cm.smithDoor.r * scale) + 4);
    }
  }
  ctx.restore();
}

// ─── Fog overlay ──────────────────────────────────────────────────────────────
function drawFog() {
  const mapObj = currentMap();
  if (!mapObj.fog) return;
  ctx.save();
  const startC = Math.floor(camC), startR = Math.floor(camR);
  const endC = Math.ceil(camC + PW/TILE_PX) + 1;
  const endR = Math.ceil(camR + PH/TILE_PX) + 1;
  for (let mr = startR; mr <= endR; mr++) {
    for (let mc = startC; mc <= endC; mc++) {
      if (mc < 0 || mc >= MCOLS || mr < 0 || mr >= MROWS) continue;
      if (!isFoggy(mapObj, mc, mr)) continue;
      const sx = (mc - camC) * TILE_PX, sy = (mr - camR) * TILE_PX;
      ctx.fillStyle = '#000';
      ctx.fillRect(Math.floor(sx), Math.floor(sy), Math.ceil(TILE_PX)+1, Math.ceil(TILE_PX)+1);
    }
  }
  ctx.restore();
}

// ─── Show minimap toggle (set by Tab key) ─────────────────────────────────────
let showMinimap = false;

// ─── Main render entry point ──────────────────────────────────────────────────

// ─── Lightning-region storm flashes ───────────────────────────────────────────
// The lightning region's sky periodically cracks with lightning: a brief whole-
// screen illumination (sometimes a quick double/triple flicker) plus a couple of
// jagged forks streaking down from the top of the view, and the dark thunderhead
// border (STORM_CLOUD) blazes its veins in sync. Driven once per frame from
// render(); `stormFlashLevel` (0..1) is the current brightness, read both here
// for the overlay and by drawTile's STORM_CLOUD case for the border crackle.
let stormFlashLevel = 0;
const stormFlash = { pulses: null, end: 0, next: 0, bolts: [] };

// A strike is 1–3 sharp pulses, each an exponential decay (amp, time-constant k),
// spaced a few tens of ms apart — that spacing is what gives the flickery,
// stuttering quality of real lightning rather than one clean fade.
function buildStormBolts() {
  const n = Math.random() < 0.62 ? 1 : (Math.random() < 0.7 ? 2 : 0);
  const bolts = [];
  for (let i = 0; i < n; i++) {
    const segs = 5 + (Math.random() * 4 | 0);
    const yEnd = 0.42 + Math.random() * 0.42;
    let bx = 0.1 + Math.random() * 0.8;
    const pts = [{ x: bx, y: 0 }];
    for (let s = 1; s <= segs; s++) {
      bx += (Math.random() - 0.5) * 0.13;
      pts.push({ x: bx, y: (s / segs) * yEnd });
    }
    // Optional single side-branch forking off a mid joint.
    const branch = [];
    if (Math.random() < 0.6 && pts.length > 3) {
      const j = 2 + (Math.random() * (pts.length - 3) | 0);
      let fx = pts[j].x, fy = pts[j].y;
      const bsegs = 2 + (Math.random() * 3 | 0);
      branch.push({ x: fx, y: fy });
      for (let s = 1; s <= bsegs; s++) {
        fx += (Math.random() - 0.5) * 0.16 + 0.05;
        fy += (yEnd - fy) * 0.4 * Math.random() + 0.04;
        branch.push({ x: fx, y: Math.min(1, fy) });
      }
    }
    bolts.push({ main: pts, branch });
  }
  return bolts;
}

function updateStormFlash(now, isStorm) {
  if (!isStorm) {
    stormFlashLevel = 0; stormFlash.pulses = null;
    if (!stormFlash.next) stormFlash.next = now + 1200;
    return;
  }
  if (now >= stormFlash.next && !stormFlash.pulses) {
    const n = 1 + (Math.random() < 0.55 ? 1 : 0) + (Math.random() < 0.3 ? 1 : 0);
    const pulses = [];
    let t = now;
    for (let i = 0; i < n; i++) {
      pulses.push({ t, amp: 0.7 + Math.random() * 0.3, k: 85 + Math.random() * 80 });
      t += 45 + Math.random() * 95;
    }
    stormFlash.pulses = pulses;
    stormFlash.end = t + 220;
    stormFlash.bolts = buildStormBolts();
    stormFlash.next = stormFlash.end + 2200 + Math.random() * 6000;   // 2.2–8.4s between strikes
  }
  let lvl = 0;
  if (stormFlash.pulses) {
    for (const p of stormFlash.pulses)
      if (now >= p.t) lvl = Math.max(lvl, p.amp * Math.exp(-(now - p.t) / p.k));
    if (now > stormFlash.end) stormFlash.pulses = null;
  }
  stormFlashLevel = lvl;
}

// The whole-screen wash + sky forks for the current flash level. Drawn over the
// world but under the HUD/minimap so it lights the scene without washing out UI.
function drawStormFlash() {
  const a = stormFlashLevel;
  if (a <= 0.001) return;
  ctx.save();
  ctx.fillStyle = 'rgba(150,180,236,' + (0.42 * a).toFixed(3) + ')';   // pale blue-white illumination
  ctx.fillRect(0, 0, PW, PH);
  if (a > 0.35 && stormFlash.bolts && stormFlash.bolts.length) {
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const b of stormFlash.bolts) {
      const trace = (pts, glowW, coreW) => {
        ctx.beginPath();
        ctx.moveTo(pts[0].x * PW, pts[0].y * PH);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x * PW, pts[i].y * PH);
        ctx.strokeStyle = 'rgba(140,176,238,' + (0.55 * a).toFixed(3) + ')'; ctx.lineWidth = glowW; ctx.stroke();
        ctx.strokeStyle = 'rgba(242,248,255,' + (0.95 * a).toFixed(3) + ')'; ctx.lineWidth = coreW; ctx.stroke();
      };
      trace(b.main, 7, 2.2);
      if (b.branch && b.branch.length > 1) trace(b.branch, 4, 1.4);
    }
  }
  ctx.restore();
}

// ─── Drifting overhead clouds (earth & air overworld) ─────────────────────────
// A purely decorative top layer: a handful of soft, transparent clouds floating
// over the mountain slopes (earth) and cloud islands (air). They are anchored to
// the world, not the screen — each cloud's centre is a world-tile coordinate, so
// as the player walks and the camera follows, the clouds scroll past the view
// instead of riding along with the player. They are NOT snapped to the tile grid
// (free-floating sub-tile soft sprites), and they also drift slowly on their own
// wind. Each is a pre-rendered soft sprite blitted at low alpha so the world shows
// through; once a cloud leaves the view (from the wind or the camera scrolling) it
// recycles in on the opposite edge so the field keeps covering wherever the player
// is. Driven from render() via drawDriftClouds() only on the relevant maps.
// Two sprite sets, the same soft shapes in different colours: white clouds for the
// earth/air maps, dark slate-grey clouds for the lightning region's storm sky. The
// active set is chosen per-frame by render() from the current map's region.
let cloudSpritesLight = null;  // white clouds (earth, air)
let cloudSpritesDark = null;   // dark-grey storm clouds (lightning)
let driftClouds = null;        // live cloud instances (positions in world-tile coords)
let driftCloudsLast = 0;       // timestamp of the previous drift step

// Pre-render one fluffy cloud to an offscreen canvas as a cluster of soft
// radial-gradient lobes (in colour `rgb`, e.g. '255,255,255') on a transparent
// ground. Three variants give some shape variety. Drawn once; the per-frame cost
// is just drawImage.
function buildCloudSprite(variant, rgb) {
  const W = 240, H = 130;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  const lobeSets = [
    [[0.50,0.58,0.42],[0.30,0.62,0.30],[0.70,0.62,0.30],[0.40,0.46,0.26],[0.62,0.47,0.24],[0.50,0.40,0.22]],
    [[0.50,0.60,0.40],[0.26,0.64,0.27],[0.74,0.63,0.26],[0.44,0.47,0.24],[0.60,0.50,0.21]],
    [[0.50,0.58,0.44],[0.32,0.61,0.31],[0.68,0.60,0.28],[0.50,0.43,0.25],[0.38,0.52,0.20]],
  ];
  for (const [fx, fy, fr] of lobeSets[variant % lobeSets.length]) {
    const cx = fx * W, cy = fy * H, r = fr * W;
    const g = c.createRadialGradient(cx, cy, r * 0.12, cx, cy, r);
    g.addColorStop(0,    `rgba(${rgb},0.95)`);
    g.addColorStop(0.55, `rgba(${rgb},0.50)`);
    g.addColorStop(1,    `rgba(${rgb},0)`);
    c.fillStyle = g;
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
  }
  return cv;
}

// Spawn the cloud field. Sizes are a fraction of the viewport (so the layer adapts
// to any window size), but each cloud's POSITION is a world-tile coordinate — it is
// scattered across the current view and then anchored to the map underneath it.
function initDriftClouds() {
  // Build both colour sets up front (shapes shared, just recoloured). The dark set
  // is a cool slate-grey to read as brooding storm cloud over the dark lightning map.
  cloudSpritesLight = [buildCloudSprite(0,'255,255,255'), buildCloudSprite(1,'255,255,255'), buildCloudSprite(2,'255,255,255')];
  cloudSpritesDark  = [buildCloudSprite(0,'92,101,125'),  buildCloudSprite(1,'92,101,125'),  buildCloudSprite(2,'92,101,125')];
  driftClouds = [];
  const ts = TILE_PX || 48;
  for (let i = 0; i < 7; i++) {
    const scale = 0.26 + Math.random() * 0.40;          // width as a fraction of the viewport
    const w = scale * PW;
    const sx = Math.random() * (PW + 2 * w) - w;          // scatter across the view (+ margin)…
    const sy = Math.random() * (PH * 0.85);
    driftClouds.push({
      sprite: i % 3,
      wx: camC + sx / ts,                                 // …then anchor to the world (tile coords)
      wy: camR + sy / ts,
      scale,
      speed: 0.25 + Math.random() * 0.45,                 // wind drift: world tiles/sec, eastward
      vy:    (Math.random() - 0.5) * 0.12,                // slight vertical wander
      alpha: 0.10 + Math.random() * 0.12,                 // transparency — keep the world visible
    });
  }
}

// Advance and draw the cloud field. Called once per frame on cloud-drift maps,
// after the world/HUD-less scene is laid down. `dark` picks the colour set (dark
// grey over lightning, white over earth/air); `alphaMul` scales the per-cloud
// transparency so the darker storm clouds can read a touch stronger on the dark map.
// The set is resolved AFTER initDriftClouds() so it's never read before it's built.
function drawDriftClouds(dark, alphaMul) {
  if (!driftClouds) initDriftClouds();
  const sprites = dark ? cloudSpritesDark : cloudSpritesLight;
  alphaMul = alphaMul || 1;
  const now = Date.now();
  let dt = now - (driftCloudsLast || now);
  driftCloudsLast = now;
  if (dt < 0 || dt > 120) dt = 16;           // seed first frame / clamp after tab-away
  const ds = dt / 1000;
  const ts = TILE_PX || 48;
  ctx.save();
  for (const cl of driftClouds) {
    cl.wx += cl.speed * ds;                   // drift on the wind, in world space
    cl.wy += cl.vy * ds;
    const w = cl.scale * PW, h = w * 0.54;    // sprite aspect (130/240)
    // World → screen via the same camera transform the tiles use.
    const sx = (cl.wx - camC) * ts, sy = (cl.wy - camR) * ts;
    // Recycle once it leaves the view — whether from the wind or from the camera
    // scrolling with the player — by re-entering on the OPPOSITE edge, so the field
    // keeps covering wherever the player has moved to.
    let tx = null, ty = null;
    if      (sx - w / 2 > PW) { tx = -w / 2 - Math.random() * 0.15 * PW; ty = Math.random() * (PH + h) - h / 2; }
    else if (sx + w / 2 < 0)  { tx = PW + w / 2 + Math.random() * 0.15 * PW; ty = Math.random() * (PH + h) - h / 2; }
    else if (sy - h / 2 > PH) { ty = -h / 2 - Math.random() * 0.15 * PH; tx = Math.random() * (PW + w) - w / 2; }
    else if (sy + h / 2 < 0)  { ty = PH + h / 2 + Math.random() * 0.15 * PH; tx = Math.random() * (PW + w) - w / 2; }
    if (tx !== null) {
      cl.scale  = 0.26 + Math.random() * 0.40;
      cl.alpha  = 0.10 + Math.random() * 0.12;
      cl.sprite = Math.floor(Math.random() * sprites.length);
      cl.wx = camC + tx / ts;                 // re-anchor the recycled cloud to the world
      cl.wy = camR + ty / ts;
      continue;
    }
    ctx.globalAlpha = Math.min(0.6, cl.alpha * alphaMul);
    ctx.drawImage(sprites[cl.sprite], sx - w / 2, sy - h / 2, w, h);
  }
  ctx.restore();
}

// Whirlpool and colossal-tree tiles are placed only at map generation and are
// never mutated during play, so their positions are found once per map and
// cached on the map object (as a flat [c0,r0, c1,r1, …] array) instead of
// rescanning the whole viewport for them every frame. The cache rebuilds for
// free whenever a fresh map object appears (generation or load, which rebuilds
// worldMaps from scratch).
function mapFeatureTiles(mapObj, tileType, cacheKey) {
  let list = mapObj[cacheKey];
  if (list) return list;
  list = [];
  const g = mapObj.map;
  for (let r = 0; r < MROWS; r++) {
    const row = g[r];
    for (let c = 0; c < MCOLS; c++) {
      if (row[c] === tileType) { list.push(c, r); }
    }
  }
  mapObj[cacheKey] = list;
  return list;
}

// The signature open-ground landmark tiles enlarged into multi-tile giants by the
// drawBigLandmark overlay pass — one per region (the poison FALLEN_LOG is a seamless
// multi-tile run and keeps its own draw). Placed once at generation and never mutated.
const BIG_LANDMARK_TILES = new Set([
  T.MOSS_BOULDER, T.DESERT_OBELISK, T.DRIFTWOOD, T.ICE_SPIRE, T.STANDING_STONE,
  T.CLOUD_SPIRE, T.STORM_SPIRE, T.OBSIDIAN_SPIRE, T.SHADOW_MONOLITH,
  T.LIGHT_PILLAR, T.TOMBSTONE,
].filter(v => v !== undefined));

// Like mapFeatureTiles but collects every enlarged-landmark tile in one scan, sorted
// top-to-bottom so lower (nearer) giants paint over higher ones. Cached per map.
function mapBigLandmarkTiles(mapObj) {
  let list = mapObj._bigLandmarks;
  if (list) return list;
  const pts = [];
  const g = mapObj.map;
  for (let r = 0; r < MROWS; r++) {
    const row = g[r];
    for (let c = 0; c < MCOLS; c++) if (BIG_LANDMARK_TILES.has(row[c])) pts.push([c, r]);
  }
  pts.sort((a, b) => a[1] - b[1]);   // painter's order: lower rows drawn last (in front)
  list = [];
  for (const [c, r] of pts) list.push(c, r);
  mapObj._bigLandmarks = list;
  return list;
}

function render() {
  ensureSpriteCacheSize();   // drop cached sprites if the tile size changed
  ctx.clearRect(0, 0, PW, PH);
  const ts = TILE_PX;
  const map = mapData();
  const mapObj = currentMap();

  // Advance the lightning-region storm flash (no-op on every other map). Done
  // before the tile pass so the STORM_CLOUD border can crackle in sync this frame.
  const isStormMap = !!mapObj && mapObj.biome === 'lightning' &&
                     (mapObj.type === 'lightning' || mapObj.type === 'village');
  updateStormFlash(Date.now(), isStormMap);

  // Only render the visible viewport range (+1 tile margin on each side)
  const startC = Math.floor(camC), startR = Math.floor(camR);
  const endC = Math.ceil(camC + PW/TILE_PX) + 1;
  const endR = Math.ceil(camR + PH/TILE_PX) + 1;

  for (let mr = startR; mr <= endR; mr++) {
    for (let mc = startC; mc <= endC; mc++) {
      const sx = Math.floor((mc - camC) * ts);
      const sy = Math.floor((mr - camR) * ts);
      const tw = Math.ceil(ts) + 1;
      if (mc < 0 || mc >= MCOLS || mr < 0 || mr >= MROWS) {
        ctx.fillStyle = '#050a05';
        ctx.fillRect(sx, sy, tw, tw);
        continue;
      }
      drawTile(mc, mr, map[mr][mc], sx, sy, ts);
    }
  }

  // Whirlpool suction overlays — after the tile pass so the churn spills over
  // the surrounding 3×3 of water instead of being overdrawn by neighbors.
  const whirlpools = mapFeatureTiles(mapObj, T.WHIRLPOOL, '_whirlpools');
  for (let i = 0; i < whirlpools.length; i += 2) {
    const mc = whirlpools[i], mr = whirlpools[i + 1];
    if (mc >= startC && mc <= endC && mr >= startR && mr <= endR) drawWhirlpoolSuction(mc, mr, ts);
  }

  drawFog();
  drops.forEach(d => { if (!isFoggy(mapObj, d.x, d.y)) drawDrop(d, ts); });
  projectiles.forEach(p => drawProjectile(p));
  for (const e of enemies) {
    if (e.dead) continue;
    if (!isFoggy(mapObj, e.x, e.y)) drawEnemy(e, ts);
  }
  if (typeof villagers !== 'undefined') {
    villagers.forEach(v => {
      if (!isFoggy(mapObj, v.x, v.y)) drawVillager(v, ts);
    });
  }
  drawPlayer(ts);

  // Colossal-tree canopies — drawn AFTER the entities (drops, enemies, villagers,
  // player) so the player and enemies pass BEHIND the overhanging canopy, and after
  // the tile grid so neighbours can't overdraw the giant. The scan range is widened
  // a few tiles below / either side of the viewport so a giant whose anchor sits just
  // off-screen still pokes its canopy into view. Only drawn once the anchor tile is
  // unfogged (its ~3-tile canopy reveals together with the base, so fog clipping the
  // canopy is unnecessary — the player can't see a tree without standing near it).
  const colossalTrees = mapFeatureTiles(mapObj, T.COLOSSAL_TREE, '_colossalTrees');
  for (let i = 0; i < colossalTrees.length; i += 2) {
    const mc = colossalTrees[i], mr = colossalTrees[i + 1];
    if (mc >= startC - 3 && mc <= endC + 3 && mr >= startR - 1 && mr <= endR + 4 &&
        !isFoggy(mapObj, mc, mr)) drawColossalTree(mc, mr, ts);
  }

  // Enlarged region landmarks — the elemental / non-forest regions' answer to the
  // colossal trees, given the same after-entities overlay treatment. Scan range is
  // widened a few tiles (a giant whose foot sits just off-screen still overhangs into
  // view) and each is drawn only once its foot tile is unfogged.
  const bigLandmarks = mapBigLandmarkTiles(mapObj);
  for (let i = 0; i < bigLandmarks.length; i += 2) {
    const mc = bigLandmarks[i], mr = bigLandmarks[i + 1];
    if (mc >= startC - 3 && mc <= endC + 3 && mr >= startR - 2 && mr <= endR + 4 &&
        !isFoggy(mapObj, mc, mr)) drawBigLandmark(map[mr][mc], mc, mr, ts);
  }

  // Lightning-region storm flash — over the world, under the HUD/minimap.
  drawStormFlash();

  // Particles
  ctx.save();
  particles.forEach(p => {
    ctx.globalAlpha = Math.max(0, p.life / 50);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
  });
  ctx.restore();

  // Damage numbers
  ctx.save();
  // One font string per frame instead of one per number.
  const dmgFont = `bold ${Math.round(ts * 0.35)}px monospace`;
  damageNumbers.forEach(d => {
    const ent = d.entity === 'player' ? player : d.entity;
    if (!ent) return;
    // Anchor to smoothed coords when available (player) so the number doesn't
    // pop along with the logical tile step.
    const ex = ent.renderX != null ? ent.renderX : ent.x;
    const ey = ent.renderY != null ? ent.renderY : ent.y;
    const sp = screenPX(ex, ey);
    const y = sp.y - ts * 0.65 - d.rise;   // above the HP bar / head, then floats up
    ctx.globalAlpha = Math.max(0, d.life / 1000);
    ctx.fillStyle = d.color;
    ctx.font = dmgFont;
    ctx.textAlign = 'center';
    ctx.fillText(d.val, sp.x, y);
  });
  ctx.textAlign = 'left';
  ctx.restore();

  // Drifting overhead clouds — a top layer of soft, transparent clouds floating
  // over the earth (high mountain slopes), air (cloud islands), and lightning
  // (storm sky) overworld maps. White over earth/air; dark slate-grey, a touch
  // stronger, over the dark lightning region. World-anchored so they scroll past
  // as the player moves (not glued to the camera), free-floating off the tile grid,
  // and drawn over the whole scene but under the HUD/minimap. (Villages, caves, and
  // other regions skip it.)
  const cloudBiome = (!!mapObj && mapObj.type === mapObj.biome &&
      (mapObj.biome === 'earth' || mapObj.biome === 'air' || mapObj.biome === 'lightning'))
    ? mapObj.biome : null;
  if (cloudBiome === 'lightning') drawDriftClouds(true, 1.5);
  else if (cloudBiome)            drawDriftClouds(false, 1.0);

  if (showMinimap) drawMinimap();

  // Floating touch joystick — over the world, under the radial menu (which pauses
  // movement, so the stick is never active while the menu is up anyway).
  drawTouchJoystick();

  // Radial inventory menu — drawn last so it's always on top
  if (typeof drawRadialMenu === 'function') drawRadialMenu();
}

// The floating virtual stick: a base ring where the finger first landed and a
// knob that tracks the current drag (clamped to the leash radius). Only visible
// while a touch is being held. State lives in main.js (touchJoystick).
function drawTouchJoystick() {
  if (typeof touchJoystick === 'undefined' || !touchJoystick.active) return;
  const R = 46, cx = touchJoystick.cx, cy = touchJoystick.cy;
  ctx.save();
  // Base ring
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(20, 40, 20, 0.28)';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(170, 255, 120, 0.5)';
  ctx.stroke();
  // Knob — offset toward the finger, capped at the ring edge
  let dx = touchJoystick.x - cx, dy = touchJoystick.y - cy;
  const d = Math.hypot(dx, dy);
  if (d > R) { dx = dx / d * R; dy = dy / d * R; }
  ctx.beginPath(); ctx.arc(cx + dx, cy + dy, 20, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(170, 255, 120, 0.85)';
  ctx.fill();
  ctx.restore();
}
