// ─── Rendering ────────────────────────────────────────────────────────────────
// Every frame: draw visible tiles, projectiles, enemies, player,
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
// water/glow/torches, neighbour-autotiled terrain like mountains/cliffs/CLIMB,
// and state-driven chests) keeps drawing procedurally.
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
//
// Tiles that vary ONLY by a deterministic (col,row) hash get a second chance via
// VARIANT_TILE_HASH below: one cached sprite per hash value instead of per type.
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
  // Ashfall ruins. The three static ones cache; T.EMBER is animated (it flickers
  // like T.TORCH) and is deliberately left out, same as every other live tile.
  T.CHARRED_GRASS, T.SCORCHED_FLOOR, T.BURNT_WALL, T.RUBBLE,
].filter(v => v !== undefined));

// Tiles that are pure per (type, size, hash-variant): their art is static and
// tile-bounded, but picks one of a few looks from a deterministic (col,row) hash
// so neighbours differ. Cached one sprite per variant (village ground is ~all
// marble + cobblestone, so this is what keeps village FPS at overworld levels).
// Each hash fn MUST mirror the seed math in its render-tiles.js case exactly
// (MARBLE and COBBLESTONE cases); cobble's variant is the pre-division `& 15`.
const VARIANT_TILE_HASH = new Map([
  [T.MARBLE,      (col, row) => ((col * 73) ^ (row * 41)) & 7],   // 8 vein variants
  [T.COBBLESTONE, (col, row) => (col * 113 + row * 71) & 15],     // 16 jitter variants
].filter(([t]) => t !== undefined));

// Paint a pure tile once into a trimmed offscreen sprite. Renders into a scratch
// canvas padded by a full tile on every side (so art that overhangs the tile box
// — cactus arms, pine tips, statue heads — is captured), finds the drawn bounding
// box, and trims to it. Returns { canvas, dx, dy } to blit at (sx+dx, sy+dy), or
// null if the art reached the scratch edge (pad too small → keep it procedural).
//
// It reuses the existing procedural switch verbatim by briefly redirecting the
// global `ctx` at the scratch context — synchronous, restored in finally.
function buildTileSprite(t, s, col = 0, row = 0) {
  const si  = Math.ceil(s);
  const pad = si;                          // one tile of slack per side
  const W   = si + pad * 2;
  const scratch = makeSpriteCanvas(W, W);
  const g = scratch.getContext('2d');
  const saved = ctx;
  ctx = g;                                 // redirect drawTileProcedural's draws
  try { drawTileProcedural(col, row, t, pad, pad, s); }
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
  // Hash-variant tiles: cached per (type, variant). String keys can't collide
  // with the numeric type keys above, so they share tileSpriteCache (and its
  // size-change invalidation) for free.
  const hashFn = VARIANT_TILE_HASH.get(t);
  if (hashFn) {
    const key = t + ':' + hashFn(col, row);
    let e = tileSpriteCache.get(key);
    if (e === undefined) {
      e = buildTileSprite(t, s, col, row) || false;  // false = clipped, never re-probe
      tileSpriteCache.set(key, e);
    }
    if (e) {
      ctx.drawImage(e.canvas, Math.floor(sx) + e.dx, Math.floor(sy) + e.dy);
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
  const s = ts;
  // Foot-anchored like every other actor now. The hero is size 1.0, so this is
  // exactly the tile corner it has always been and nothing moves today. What it
  // buys is the seam for Phase 5a, where the hop becomes real player.z state
  // instead of an offset invented inside the renderer.
  const pfb = footBox(px, py, 0, s);
  const sx = pfb.x, sy = pfb.y;
  const blink = player.invincible > 0 && Math.floor(Date.now() / 80) % 2 === 0;
  if (blink) return;

  const sd = player.swordDir;
  const facing = sd.y > 0 ? 'down' : sd.y < 0 ? 'up' : sd.x > 0 ? 'right' : 'left';
  const isSide = facing === 'left' || facing === 'right';
  const flipX = facing === 'left';   // mirror side-view details

  // ── Elf-knight palette (matches the character-sheet portrait) ──
  const P_STEEL = '#b9bfca', P_STEEL_D = '#868d99', P_STEEL_L = '#e4e8ee';
  const P_LEATHER = '#6f4a24', P_LEATHER_D = '#452c12';
  const P_CAPE = '#3f6a2f', P_CAPE_D = '#294a1f', P_CAPE_L = '#568c3d';
  const P_HAIR = '#e6c257', P_HAIR_D = '#b58f34', P_HAIR_L = '#f7df8a';
  const P_SKIN = '#f2d59c', P_SKIN_D = '#d0a870';
  const P_GOLD = '#d8b24a';
  const P_SHIELD = '#5e7a49', P_TREE = '#dbe2e6';

  // Subtle walking bob — only oscillates when a movement key is held
  const moving = !!(keys['ArrowLeft']||keys['ArrowRight']||keys['ArrowUp']||keys['ArrowDown']);
  // Unrounded: snapping the bob to whole pixels jerked the sprite ±1px at each
  // sine crossing, which read as frame jitter on top of the tile glide.
  const walkBob = moving ? Math.sin(Date.now() / 110) : 0;

  // ── Climb / jump animation ──────────────────────────────────────────────────
  // Climbing: an effortful scramble (faster vertical bob + slight side sway)
  // while standing on a CLIMB ramp through a plateau. Jumping: a short hop arc
  // when mounting or leaving a ramp lip, or crossing the waterline.
  const _pmap = (typeof mapData === 'function') ? mapData() : null;
  const onClimb = !!(_pmap && _pmap[player.y] && _pmap[player.y][player.x] === T.CLIMB);
  // Swimming through MEDIUM_WATER (Water armor): the lower body is underwater.
  // Everything below this tile-fraction waterline is clipped away, and a ripple
  // ring is drawn at the surface so the sprite reads as submerged, not cropped.
  const swimming = !!(_pmap && _pmap[player.y] && _pmap[player.y][player.x] === T.MEDIUM_WATER);
  const WATERLINE = 0.55;
  // The hop is real state now (player.z, stepped by stepPlayerJump in player.js).
  // This reads it and converts world units to pixels; it no longer owns the arc,
  // and it no longer CLEARS anything, which is what stops the renderer mutating
  // game state.
  //
  // Applied through `bob` rather than by passing z into footBox, deliberately.
  // The swimming clip below is a world-space waterline: it has to stay at the
  // surface while the hero hops out of it. Lifting the box would carry the clip
  // up with him and he would haul out of a rising hole in the water.
  // groundZ is the shelf he is standing on, z is the hop and any remaining drop
  // above it. The body is lifted by the sum; the shadow below is placed on the
  // shelf and shrinks only with z. See the field comments on `player`.
  const jumpLift = ((player.z || 0) + (player.groundZ || 0)) * s;
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

  // Shadow ellipse. Stays on the ground, tightening and fading as the player
  // rises, and tracks the climbing sway so it sits under the body.
  //
  // Altitude is now player.z and ONLY player.z. Until Phase 5a this was fed the
  // combined hop + scramble offset, because that is what the old airT used and
  // matching it verbatim is what kept Phase 2 pixel-identical. But a scramble is
  // not altitude: the hero is still standing on the ramp, so shrinking his
  // shadow every time he walks up a slope was always wrong, it was just wrong
  // consistently. climbLift and climbSway stay what they are, a body animation.
  // The sway is still passed, so the shadow keeps tracking sideways under him.
  //
  // The Elderbrook interior sun offset and the airborne shrink/fade live inside
  // groundShadow, so enemies and villagers get them too.
  groundShadow(px, py, (player.z || 0) + (player.groundZ || 0), 0.28, 0.07, 0.40,
               climbSway / s, undefined, player.groundZ || 0);
  // Sway the body horizontally during a climb (shadow already placed above).
  if (climbSway) ctx.translate(climbSway, 0);

  // ── Worn elemental armor aura (behind the body) ───────────────────────
  // The active elemental armor cloaks the hero in its element's signature FX —
  // a luminous glow, a shroud of shadow-mist, licking flames, and so on.
  if (player.activeArmorElement) {
    drawElementFX(sx + s / 2, sy + s * 0.5 + bob, s * 0.62, player.activeArmorElement, 0.6, 0);
  }

  // ── Sprite-sheet path (hero-sheet.png, see hero-sprite.js) ────────────
  // One blit stands in for the entire procedural body below — cape through
  // swinging sword. Everything around it (shadow, auras, low-HP tint, swim
  // clip and ripple) is shared, so the two paths stay visually consistent.
  //
  // walkBob is already baked into the walk frames, so only the jump/climb lift
  // is applied here; climbSway is in the transform above. Falls through to the
  // procedural sprite until the sheet loads, and permanently if it fails.
  if (heroSheetReady()) {
    const spriteY = sy + (bob - walkBob);
    drawHeroSprite(sx, spriteY, s, facing, moving);

    // Elemental sword FX still bursts from the blade tip. The sheet is one flat
    // image, so unlike the procedural blade it can't take the element's tint.
    if (player.swordTimer > 0 && player.activeSwordElement) {
      const tip = heroSwordTip(sx, spriteY, s);
      drawElementFX(tip.x, tip.y, s * 0.55, player.activeSwordElement,
                    0.85 + 0.15 * (1 - player.swordTimer / 180), 0);
    }

    finishPlayerDraw(sx, sy, s, bob, lowHp, dangerPulse, swimming);
    return;
  }

  // ── Flowing green cape (behind the whole body) ────────
  const capeSway = walkBob * s * 0.05;
  ctx.fillStyle = P_CAPE_D;
  ctx.beginPath();
  ctx.moveTo(sx + s*0.30, sy + s*0.34 + bob);
  ctx.lineTo(sx + s*0.70, sy + s*0.34 + bob);
  ctx.lineTo(sx + s*0.84 + capeSway, sy + s*0.92 + bob);
  ctx.lineTo(sx + s*0.16 + capeSway, sy + s*0.92 + bob);
  ctx.closePath();
  ctx.fill();
  // Lit left fold of the cape
  ctx.fillStyle = P_CAPE;
  ctx.beginPath();
  ctx.moveTo(sx + s*0.30, sy + s*0.34 + bob);
  ctx.lineTo(sx + s*0.50, sy + s*0.34 + bob);
  ctx.lineTo(sx + s*0.50 + capeSway, sy + s*0.92 + bob);
  ctx.lineTo(sx + s*0.16 + capeSway, sy + s*0.92 + bob);
  ctx.closePath();
  ctx.fill();

  // ── Boots (dark leather) ──────────────────────────────
  ctx.fillStyle = P_LEATHER_D;
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
  ctx.fillStyle = '#160c04';
  ctx.fillRect(sx + s*0.28, sy + s*0.91 + bob, s*0.44, s*0.03);

  // ── Leather faulds (skirt) under the breastplate ──────
  ctx.fillStyle = P_LEATHER;
  ctx.beginPath();
  ctx.moveTo(sx + s*0.26, sy + s*0.63 + bob);
  ctx.lineTo(sx + s*0.74, sy + s*0.63 + bob);
  ctx.lineTo(sx + s*0.78, sy + s*0.85 + bob);
  ctx.lineTo(sx + s*0.22, sy + s*0.85 + bob);
  ctx.closePath();
  ctx.fill();

  // ── Steel breastplate (torso) ─────────────────────────
  ctx.fillStyle = P_STEEL;
  ctx.beginPath();
  ctx.moveTo(sx + s*0.28, sy + s*0.42 + bob);
  ctx.lineTo(sx + s*0.72, sy + s*0.42 + bob);
  ctx.lineTo(sx + s*0.74, sy + s*0.66 + bob);
  ctx.lineTo(sx + s*0.50, sy + s*0.72 + bob);
  ctx.lineTo(sx + s*0.26, sy + s*0.66 + bob);
  ctx.closePath();
  ctx.fill();
  // Right-side core shadow
  ctx.fillStyle = P_STEEL_D;
  ctx.beginPath();
  ctx.moveTo(sx + s*0.50, sy + s*0.42 + bob);
  ctx.lineTo(sx + s*0.72, sy + s*0.42 + bob);
  ctx.lineTo(sx + s*0.74, sy + s*0.66 + bob);
  ctx.lineTo(sx + s*0.50, sy + s*0.72 + bob);
  ctx.closePath();
  ctx.fill();
  // Center ridge highlight
  ctx.strokeStyle = P_STEEL_L;
  ctx.lineWidth = Math.max(1, s*0.02);
  ctx.beginPath();
  ctx.moveTo(sx + s*0.50, sy + s*0.44 + bob);
  ctx.lineTo(sx + s*0.50, sy + s*0.70 + bob);
  ctx.stroke();
  // Green cape collar gathered at the neck + skin décolletage
  ctx.fillStyle = P_CAPE_L;
  ctx.fillRect(sx + s*0.40, sy + s*0.40 + bob, s*0.20, s*0.05);
  ctx.fillStyle = P_SKIN;
  ctx.beginPath();
  ctx.moveTo(sx + s*0.44, sy + s*0.42 + bob);
  ctx.lineTo(sx + s*0.56, sy + s*0.42 + bob);
  ctx.lineTo(sx + s*0.50, sy + s*0.50 + bob);
  ctx.closePath();
  ctx.fill();

  // ── Belt + buckle ─────────────────────────────────────
  ctx.fillStyle = P_LEATHER_D;
  ctx.fillRect(sx + s*0.24, sy + s*0.62 + bob, s*0.52, s*0.05);
  ctx.fillStyle = P_GOLD;
  ctx.fillRect(sx + s*0.47, sy + s*0.61 + bob, s*0.06, s*0.07);

  // ── Arms (leather sleeves + steel pauldrons) ──────────
  ctx.fillStyle = P_LEATHER;
  if (isSide) {
    ctx.fillRect(sx + s*0.40, sy + s*0.50 + bob, s*0.10, s*0.18);
    ctx.fillRect(sx + s*0.52, sy + s*0.50 + bob, s*0.10, s*0.18);
  } else {
    ctx.fillRect(sx + s*0.16, sy + s*0.50 + bob, s*0.11, s*0.18);
    ctx.fillRect(sx + s*0.73, sy + s*0.50 + bob, s*0.11, s*0.18);
  }
  ctx.fillStyle = P_STEEL_L;
  if (isSide) {
    ctx.fillRect(sx + s*0.39, sy + s*0.44 + bob, s*0.12, s*0.08);
    ctx.fillRect(sx + s*0.51, sy + s*0.44 + bob, s*0.12, s*0.08);
  } else {
    ctx.fillRect(sx + s*0.15, sy + s*0.44 + bob, s*0.13, s*0.09);
    ctx.fillRect(sx + s*0.72, sy + s*0.44 + bob, s*0.13, s*0.09);
  }

  // ── Round tree-emblem shield (idle only; hidden during swing/away) ──
  if (facing !== 'up' && player.swordTimer <= 0 && player.punchTimer <= 0) {
    const cxs = flipX ? sx + s*0.80 : sx + s*0.20;   // shield centre
    const cys = sy + s*0.62 + bob;
    const rr  = s*0.20;
    // steel rim
    ctx.fillStyle = P_STEEL_D;
    ctx.beginPath(); ctx.ellipse(cxs, cys, rr, rr*1.15, 0, 0, Math.PI*2); ctx.fill();
    // green field
    ctx.fillStyle = P_SHIELD;
    ctx.beginPath(); ctx.ellipse(cxs, cys, rr*0.80, rr*0.96, 0, 0, Math.PI*2); ctx.fill();
    // silver tree of life
    ctx.strokeStyle = P_TREE;
    ctx.lineWidth = Math.max(1, s*0.028);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cxs, cys + rr*0.62); ctx.lineTo(cxs, cys - rr*0.10);          // trunk
    ctx.moveTo(cxs, cys + rr*0.15); ctx.lineTo(cxs - rr*0.42, cys - rr*0.22); // low branches
    ctx.moveTo(cxs, cys + rr*0.15); ctx.lineTo(cxs + rr*0.42, cys - rr*0.22);
    ctx.moveTo(cxs, cys - rr*0.05); ctx.lineTo(cxs - rr*0.30, cys - rr*0.52); // upper branches
    ctx.moveTo(cxs, cys - rr*0.05); ctx.lineTo(cxs + rr*0.30, cys - rr*0.52);
    ctx.stroke();
    // silver canopy
    ctx.fillStyle = P_TREE;
    ctx.beginPath(); ctx.arc(cxs, cys - rr*0.42, rr*0.17, 0, Math.PI*2); ctx.fill();
  }

  // ── Long blonde hair (behind the head, flowing to the shoulders) ──
  ctx.fillStyle = P_HAIR_D;
  if (facing === 'up') {
    // full mane covering the back of the head
    ctx.beginPath();
    ctx.ellipse(sx + s/2, sy + s*0.34 + bob, s*0.26, s*0.30, 0, 0, Math.PI*2);
    ctx.fill();
  } else {
    // side locks framing the face and streaming down past the shoulders
    ctx.beginPath();
    ctx.moveTo(sx + s*0.27, sy + s*0.18 + bob);
    ctx.lineTo(sx + s*0.40, sy + s*0.18 + bob);
    ctx.lineTo(sx + s*0.37, sy + s*0.62 + bob);
    ctx.lineTo(sx + s*0.25, sy + s*0.58 + bob);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(sx + s*0.60, sy + s*0.18 + bob);
    ctx.lineTo(sx + s*0.73, sy + s*0.18 + bob);
    ctx.lineTo(sx + s*0.77, sy + s*0.64 + bob);   // longer windswept lock
    ctx.lineTo(sx + s*0.63, sy + s*0.60 + bob);
    ctx.closePath(); ctx.fill();
  }

  // ── Head + face (front / side views) ──────────────────
  if (facing !== 'up') {
    // skin with subtle shading
    ctx.fillStyle = P_SKIN_D;
    ctx.beginPath();
    ctx.arc(sx + s/2, sy + s*0.29 + bob, s*0.19, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = P_SKIN;
    ctx.beginPath();
    ctx.arc(sx + s/2 - s*0.02, sy + s*0.28 + bob, s*0.16, 0, Math.PI*2);
    ctx.fill();

    // Pointed elf ears
    ctx.fillStyle = P_SKIN_D;
    if (facing === 'right') {
      ctx.beginPath();
      ctx.moveTo(sx + s*0.30, sy + s*0.27 + bob);
      ctx.lineTo(sx + s*0.21, sy + s*0.24 + bob);
      ctx.lineTo(sx + s*0.32, sy + s*0.35 + bob);
      ctx.closePath(); ctx.fill();
    } else if (facing === 'left') {
      ctx.beginPath();
      ctx.moveTo(sx + s*0.70, sy + s*0.27 + bob);
      ctx.lineTo(sx + s*0.79, sy + s*0.24 + bob);
      ctx.lineTo(sx + s*0.68, sy + s*0.35 + bob);
      ctx.closePath(); ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(sx + s*0.31, sy + s*0.29 + bob);
      ctx.lineTo(sx + s*0.22, sy + s*0.30 + bob);
      ctx.lineTo(sx + s*0.33, sy + s*0.37 + bob);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(sx + s*0.69, sy + s*0.29 + bob);
      ctx.lineTo(sx + s*0.78, sy + s*0.30 + bob);
      ctx.lineTo(sx + s*0.67, sy + s*0.37 + bob);
      ctx.closePath(); ctx.fill();
    }

    // Blonde bangs / fringe over the forehead
    ctx.fillStyle = P_HAIR;
    ctx.beginPath();
    ctx.moveTo(sx + s*0.30, sy + s*0.13 + bob);
    ctx.lineTo(sx + s*0.70, sy + s*0.13 + bob);
    ctx.lineTo(sx + s*0.66, sy + s*0.27 + bob);
    ctx.lineTo(sx + s*0.55, sy + s*0.19 + bob);
    ctx.lineTo(sx + s*0.50, sy + s*0.26 + bob);
    ctx.lineTo(sx + s*0.45, sy + s*0.19 + bob);
    ctx.lineTo(sx + s*0.34, sy + s*0.27 + bob);
    ctx.closePath(); ctx.fill();
    // top highlight
    ctx.fillStyle = P_HAIR_L;
    ctx.fillRect(sx + s*0.40, sy + s*0.13 + bob, s*0.20, s*0.03);

    // Narrow blue elf eyes
    if (facing === 'down') {
      ctx.fillStyle = '#28405e';
      ctx.fillRect(sx + s*0.38, sy + s*0.29 + bob, s*0.07, s*0.06);
      ctx.fillRect(sx + s*0.55, sy + s*0.29 + bob, s*0.07, s*0.06);
      ctx.fillStyle = '#fff';
      ctx.fillRect(sx + s*0.40, sy + s*0.30 + bob, s*0.02, s*0.02);
      ctx.fillRect(sx + s*0.57, sy + s*0.30 + bob, s*0.02, s*0.02);
    } else {
      const ex = facing === 'right' ? sx + s*0.56 : sx + s*0.36;
      ctx.fillStyle = '#28405e';
      ctx.fillRect(ex, sy + s*0.29 + bob, s*0.09, s*0.06);
      ctx.fillStyle = '#fff';
      ctx.fillRect(ex + (facing === 'right' ? s*0.05 : 0), sy + s*0.30 + bob, s*0.02, s*0.02);
    }
  }

  // ── Punch (a jab, not an arc) ────────────────────────
  // The pre-weapon action (see doPunch). Deliberately a different shape from the
  // sword: a fist thrusts straight out one tile and comes back, so there's no
  // mistaking the two, and no blade is ever drawn before the player owns one.
  if (player.punchTimer > 0) {
    const phase = 1 - Math.max(0, Math.min(1, player.punchTimer / 150));   // 0 → 1
    // Out on the first half, back on the second.
    const reach = Math.sin(phase * Math.PI) * s * 0.55;
    const cx = sx + s / 2 + sd.x * reach;
    const cy = sy + s / 2 + bob + sd.y * reach;
    const rr = s * 0.13;
    ctx.fillStyle = P_SKIN_D;
    ctx.beginPath(); ctx.arc(cx, cy, rr * 1.15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = P_SKIN;
    ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.fill();
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

  finishPlayerDraw(sx, sy, s, bob, lowHp, dangerPulse, swimming);
}

// Tail shared by both drawPlayer paths (sprite sheet and procedural): the low-HP
// tint, the ctx.restore that closes the swim clip, and the waterline ripple that
// has to be drawn outside that clip so its full rings show.
function finishPlayerDraw(sx, sy, s, bob, lowHp, dangerPulse, swimming) {
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
  // A drop keeps the TILE-CENTRE anchor (see the contract note on screenPX in
  // projectiles.js): it is a floating pickup, not a creature standing on the
  // ground, so it is not foot-anchored.
  const cx = worldX(d.x + 0.5);
  const baseY = worldY(d.y + 0.5);
  // The bob is now a real height in world units rather than a raw pixel offset,
  // with +z up, matching every other z in the renderer. Same arc and the same
  // pixels as the old downward bobOff; what it buys is a shadow that can react
  // to it. Deliberately a local and not written onto `d`: the renderer should
  // not be writing game state, and this value is a pure function of d.bob, which
  // is stepped elsewhere. drawPlayer used to be the counter-example, clearing
  // playerJumpStart as it drew; Phase 5a moved that arc out to stepPlayerJump so
  // there is no longer a precedent here to follow.
  const z = -Math.sin(d.bob / 220) * 0.10;
  const cy = baseY - z * ts;
  const pulse = 1 + Math.sin(d.bob / 180) * 0.07;

  ctx.save();

  // Ground shadow. New here: a bobbing drop with nothing under it reads as
  // sliding along the floor rather than floating above it. Small and faint,
  // because a drop is small, and it tightens as the bob lifts.
  //
  // It needs its own yFrac. SHADOW_Y (0.93) is built for an ACTOR, whose box
  // bottom is the foot plane at 1.00, and it sits one shadow-radius above that
  // so the ellipse's lower edge just touches the feet. A drop is anchored at
  // its tile CENTRE instead, so the default would leave the shadow 0.43 tiles
  // (20.6px at TILE_PX 48) below the item, detached from it with bare floor in
  // between. The same construction applied to a drop: the art reaches about
  // 0.24 tile below the centre (the heart's V is the deepest, at 0.238 before
  // its pulse), so 0.74 is this item's own "foot plane" and 0.69 puts the
  // ellipse's lower edge on it.
  groundShadow(d.x, d.y, z, 0.15, 0.05, 0.28, 0, 0.69);

  // Soft glow tinted to the drop type
  const trophy = (typeof TROPHY_META !== 'undefined') ? TROPHY_META[d.type] : null;
  const oreMeta = (d.type === 'ore' && typeof ORE_TYPES !== 'undefined')
    ? ORE_TYPES.find(o => o.id === d.ore) : null;
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
    d.type === 'guildhead'   ? '204,51,68'   :  // bloody trophy-head red
    oreMeta               ? hexToRGB(oreMeta.color) :
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
  } else if (oreMeta || trophy || d.type === 'potion' || d.type === 'arrows' || d.type === 'mushroom' || d.type === 'bonemeal' || d.type === 'winterberry' || d.type === 'frostpetal' || d.type === 'seashell' || d.type === 'coral' || d.type === 'sage' || d.type === 'moss' || d.type === 'crystal' || d.type === 'skypetal' || d.type === 'windseed' || d.type === 'thistledown' || d.type === 'voltpetal' || d.type === 'sparkseed' || d.type === 'fulgurite' || d.type === 'witherwood' || d.type === 'gravebloom' || d.type === 'mote' || d.type === 'manapetal' || d.type === 'heartfrond' || d.type === 'glowcap' || d.type === 'fiddlehead' || d.type === 'aloe' || d.type === 'frostfern' || d.type === 'sunseed' || d.type === 'prism' || d.type === 'reedpith' || d.type === 'guildhead') {
    // Trophy items + potion + arrow bundle + mushroom + bone meal + winter berry
    // + frost petal: render as a glyph centered on the tile. Arrow drops show the
    // elemental icon and the count; the rest show their thematic icon.
    const icon =
      oreMeta               ? oreMeta.icon :
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
      d.type === 'guildhead'   ? '💀' :
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
    // A thrown bomb rides its arc (5c). The shadow stays on the ground and
    // tightens as it rises, which is the thing that actually sells the throw:
    // without it the bomb just slides up the screen. tx/ty are tile CENTRES, so
    // step back half a tile to get the tile coordinate groundShadow wants, and
    // put the ellipse at the bomb's own underside (0.5 + 0.22) rather than at an
    // actor's foot plane.
    const bz = p.z || 0;
    groundShadow(p.tx - 0.5, p.ty - 0.5, bz, 0.18, 0.06, 0.35, 0, 0.72);
    const by = sy - bz * TILE_PX;
    ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(sx,by,br,0,Math.PI*2); ctx.fill();
    // Fuse spark blinks
    if (Math.floor(Date.now()/100 + p.life) % 2 === 0) {
      ctx.fillStyle = '#ff4400';
      ctx.beginPath(); ctx.arc(sx, by - br, br*0.5, 0, Math.PI*2); ctx.fill();
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
// Per-map cached offscreen canvas. Rebuilt only when the map changes — much
// cheaper than redrawing every tile every frame. Every tile is painted: fog of
// war is gone, so a map is fully drawn from the moment it is entered.

let minimapDirty = true;
let minimapCanvases = {};   // keyed by mapId
const MINIMAP_SCALE = 1.2;  // minimap pixels per world tile

// Which of the four map edges actually lead somewhere, so the minimap only
// draws an exit arrow where a real transition exists. An edge counts when the
// border has a walkable gap at the exit gate (overworld exit) OR a cave
// transition tile (CAVE_EXIT / CAVE_DESCENT) sits at that edge's midpoint
// (waterfall cave levels). Interior transitions — a cache cave's central exit,
// a whirlpool, a hidden waterfall door — aren't edges and get no arrow.
function edgeTransitions(mapObj) {
  const m = mapObj.map;
  const isTrans = (t) => t === T.CAVE_EXIT || t === T.CAVE_DESCENT ||
                         t === T.SKY_EXIT  || t === T.SKY_ASCENT ||
                         t === T.TOWER_STAIRS_UP || t === T.TOWER_STAIRS_DOWN;
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

// Build (or refresh, when the tiles have changed) the current map's cached
// minimap canvas at MINIMAP_SCALE and return it. Shared by the corner minimap and the
// full-screen minimap view so the terrain paint lives in exactly one place.
function buildMinimapCanvas() {
  const scale = MINIMAP_SCALE;
  const mw = Math.floor(MCOLS * scale), mh = Math.floor(MROWS * scale);
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
        const t = mapObj.map[r][c];
        mc2.fillStyle = TILE_COLORS[t] || '#111';
        mc2.fillRect(Math.floor(c*scale), Math.floor(r*scale), Math.ceil(scale), Math.ceil(scale));
      }
    }
    minimapDirty = false;
  }
  return mmc;
}

function drawMinimap() {
  const scale = MINIMAP_SCALE;
  const mw = Math.floor(MCOLS * scale), mh = Math.floor(MROWS * scale);
  const mx = PW - mw - 8, my = 8;

  const mmc = buildMinimapCanvas();

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.fillRect(mx-2, my-2, mw+4, mh+4);
  ctx.drawImage(mmc, mx, my);

  // Player dot
  ctx.fillStyle = '#ffcc00';
  ctx.fillRect(mx + Math.floor(player.x*scale) - 1, my + Math.floor(player.y*scale) - 1, 3, 3);
  // Enemy dots (live) — larger, centered on the tile and ringed with a dark
  // backing so they stay legible against any terrain color. Bosses are drawn
  // noticeably bigger than regular foes so they read at a glance.
  enemies.filter(e => !e.dead).forEach(e => {
    const sz = e.boss ? 6 : 4;
    const cx = mx + Math.floor(e.x*scale), cy = my + Math.floor(e.y*scale);
    ctx.fillStyle = '#000';
    ctx.fillRect(cx - sz/2 - 1, cy - sz/2 - 1, sz + 2, sz + 2);
    ctx.fillStyle = e.boss ? '#ff33ff' : '#ff5555';
    ctx.fillRect(cx - sz/2, cy - sz/2, sz, sz);
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

  // Active-village shop markers (I = inn, $ = store)
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

// ─── Show minimap toggle (set by Tab key) ─────────────────────────────────────
let showMinimap = false;

// ─── View modes (cycled by a double-tap on the empty bottom bar) ──────────────
// 0 = normal zoom, 1 = zoomed out (see more of the map at once), 2 = full-screen
// minimap. Zoom is driven by TILE_PX (render + camera already read it live, and
// the sprite cache re-bakes when it changes — see ensureSpriteCacheSize).
const VIEW_BASE_PX     = 48;   // matches TILE_PX's config.js default
const VIEW_ZOOM_OUT_PX = 24;   // half-scale: twice the tiles on screen
let viewMode = 0;

function cycleViewMode() {
  viewMode = (viewMode + 1) % 3;
  // Mode 1 zooms the world out; every other mode uses the base tile size (mode 2
  // draws the full minimap over the top, so the world size under it doesn't matter).
  TILE_PX = (viewMode === 1) ? VIEW_ZOOM_OUT_PX : VIEW_BASE_PX;
  if (typeof clampCam === 'function') clampCam(true);   // snap: no scroll on a zoom jump
  if (typeof updateHUD === 'function') updateHUD();
  const label = viewMode === 0 ? '🔍 Normal view'
              : viewMode === 1 ? '🗺️ Zoomed out'
              :                   '🗺️ Full map';
  if (typeof showMsg === 'function') showMsg(label, 1200);
  if (typeof buzz === 'function') buzz(10);
}

// The whole-screen map: the cached minimap terrain scaled up to fill the view,
// with live player / enemy / exit markers over it. Reuses buildMinimapCanvas so
// its terrain stays in sync with the corner minimap.
function drawFullMinimap() {
  const mmc = buildMinimapCanvas();
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.92)';
  ctx.fillRect(0, 0, PW, PH);

  const margin = 18;
  const s  = Math.min((PW - margin * 2) / mmc.width, (PH - margin * 2) / mmc.height);
  const dw = mmc.width * s, dh = mmc.height * s;
  const ox = (PW - dw) / 2, oy = (PH - dh) / 2;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(mmc, ox, oy, dw, dh);

  // world tile (x,y) → screen: ox + x * (MINIMAP_SCALE * s)
  const ws = MINIMAP_SCALE * s;
  const dot = (tx, ty, size, color, ring) => {
    const cx = ox + tx * ws, cy = oy + ty * ws;
    if (ring) { ctx.fillStyle = '#000'; ctx.fillRect(cx - size/2 - 1, cy - size/2 - 1, size + 2, size + 2); }
    ctx.fillStyle = color;
    ctx.fillRect(cx - size/2, cy - size/2, size, size);
  };

  // Enemies (bosses bigger), then the player on top.
  if (typeof enemies !== 'undefined') {
    enemies.filter(e => !e.dead).forEach(e => dot(e.x, e.y, e.boss ? 10 : 6, e.boss ? '#ff33ff' : '#ff5555', true));
  }
  dot(player.x, player.y, Math.max(6, ws * 1.4), '#ffcc00', true);

  // Edge exit arrows where a real transition exists.
  const exits = edgeTransitions(currentMap());
  ctx.fillStyle = '#ffff00';
  ctx.font = `bold ${Math.round(Math.max(12, ws * 3))}px monospace`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  if (exits.right) ctx.fillText('▶', ox + dw - 6, oy + EXIT_ROW * ws);
  if (exits.left)  ctx.fillText('◀', ox + 6,      oy + EXIT_ROW * ws);
  if (exits.up)    ctx.fillText('▲', ox + EXIT_COL * ws, oy + 6);
  if (exits.down)  ctx.fillText('▼', ox + EXIT_COL * ws, oy + dh - 6);

  // Title / hint.
  ctx.fillStyle = '#9fe89f';
  ctx.font = 'bold 15px monospace';
  ctx.fillText(currentMap().name, PW / 2, Math.max(14, oy - 12));
  ctx.fillStyle = '#5e8a5e';
  ctx.font = '11px monospace';
  ctx.fillText('double-tap the bar to exit', PW / 2, Math.max(30, oy - 12) + 16);

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.restore();
}

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

// ─── Cinematic layer (cutscene.js drives these) ───────────────────────────────
// Full-screen state that scripted beats set and render() draws. It lives here
// rather than in cutscene.js because this file owns every full-screen draw —
// same reasoning that keeps stormFlashLevel here rather than in whatever decides
// it's storming.
//
//   fadeLevel      0..1 black curtain over everything, including the HUD
//   letterboxLevel 0..1 how far the cinematic bars have slid in
//   shakeMag       peak camera shake in pixels; decays over shakeMs
//   burnLevel      0..1 orange fire wash + ember fall (Beat 4's burning village)
let fadeLevel = 0;
let letterboxLevel = 0;
let shakeMag = 0, shakeMs = 0;
let burnLevel = 0;
let _cineLast = 0;              // Date.now() of the previous frame, for decay
let _shakeX = 0, _shakeY = 0;   // this frame's offset, applied in render()

// Decay the shake and roll this frame's offset. Called once per frame at the top
// of render(); uses wall-clock delta because render() has no dt of its own (the
// same reason updateStormFlash takes Date.now()).
function updateCinematics(now) {
  const dt = _cineLast ? Math.min(now - _cineLast, 80) : 16;
  _cineLast = now;
  if (shakeMs > 0) {
    shakeMs -= dt;
    if (shakeMs <= 0) { shakeMs = 0; shakeMag = 0; }
  }
  if (shakeMag > 0) {
    // Random per frame rather than a sine — a rumble, not a wobble.
    _shakeX = (Math.random() * 2 - 1) * shakeMag;
    _shakeY = (Math.random() * 2 - 1) * shakeMag;
  } else {
    _shakeX = 0; _shakeY = 0;
  }
}

// Orange wash + heat haze for a burning map. Same shape as drawStormFlash — a
// composited full-screen fill — because the tile colours are baked into cached
// sprites (see buildTileSprite) and can't be recoloured per-frame.
function drawFireWash() {
  if (burnLevel <= 0.001) return;
  const a = Math.min(1, burnLevel);
  ctx.save();
  // A light multiply to warm the scene. Kept deliberately weak: the charred
  // tiles underneath are already near-black, and a heavy wash on top of them
  // makes the run home unnavigable — the player has to be able to see the road.
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = 'rgba(255,186,140,' + (0.30 * a).toFixed(3) + ')';
  ctx.fillRect(0, 0, PW, PH);
  // Most of the effect comes from the additive glow instead, brightest at the
  // bottom of the screen where the fire is. Additive lifts the scene rather than
  // crushing it, so it reads as lit by fire instead of dimmed by smoke.
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(0, PH, 0, 0);
  g.addColorStop(0,    'rgba(255,120,40,' + (0.34 * a).toFixed(3) + ')');
  g.addColorStop(0.55, 'rgba(255,95,30,'  + (0.17 * a).toFixed(3) + ')');
  g.addColorStop(1,    'rgba(200,60,20,'  + (0.07 * a).toFixed(3) + ')');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, PW, PH);
  ctx.restore();
}

// ─── The Red Dragon Emperor (prologue) ────────────────────────────────────────
// Drawn from `prologueEmperor` (cutscene.js) — a position, an altitude and a
// scale, nothing more. He is not an entry in `enemies` and never goes through
// enemies.js, which is the whole trick: the script's "unbeatable by design"
// encounter needs no combat lock, because there is no creature to swing at.
//
// The sprite itself is the existing adult_red_dragon art (render-enemies.js),
// reused wholesale by handing drawEnemy an enemy-shaped object rather than
// copying two hundred lines of wing and scale drawing into a second place. The
// `cutsceneActor` flag on it suppresses the HP bar and boss name tag.
// ─── Beat 3: birds and wind ───────────────────────────────────────────────────
// The flock that goes up off the rooftops when the light changes. Each bird is
// two stroked wing-strokes in a V, which at this tile size reads as a bird far
// better than any body would; `alt` lifts it off its own ground shadow so the
// flock visibly climbs away rather than sliding across the roofs.
function drawPrologueBirds(ts) {
  if (typeof prologueBirds === 'undefined' || !prologueBirds.length) return;
  ctx.save();
  ctx.lineCap = 'round';
  for (const b of prologueBirds) {
    const fade = Math.max(0, Math.min(1, b.life / 700));
    const sx = (b.x - camC) * ts;
    const sy = (b.y - camR) * ts - b.alt * ts;
    // Wingbeat: the V opens and closes. Fast, because small birds do.
    const beat = Math.sin(Date.now() / 70 + b.flap);
    const span = ts * 0.20;
    const lift = beat * ts * 0.11;
    ctx.strokeStyle = `rgba(28,24,20,${(0.75 * fade).toFixed(3)})`;
    ctx.lineWidth = Math.max(1, ts * 0.035);
    ctx.beginPath();
    ctx.moveTo(sx - span, sy - lift);
    ctx.quadraticCurveTo(sx - span * 0.4, sy + lift * 0.5, sx, sy);
    ctx.quadraticCurveTo(sx + span * 0.4, sy + lift * 0.5, sx + span, sy - lift);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
  ctx.restore();
}

// The wind picking up. Streaks blowing west to east across the whole viewport,
// density and opacity driven by prologueWind (0 = still, 1 = full). Drawn in
// screen space rather than world space: it is weather, not something standing on
// a tile, and it should not slide when the camera pans.
function drawPrologueWind(ts) {
  if (typeof prologueWind === 'undefined' || prologueWind <= 0.01) return;
  const w = prologueWind;
  const now = Date.now();
  ctx.save();
  ctx.strokeStyle = `rgba(232,238,246,${(0.16 * w).toFixed(3)})`;
  ctx.lineWidth = Math.max(1, ts * 0.03);
  ctx.lineCap = 'round';
  const count = Math.round(46 * w);
  for (let i = 0; i < count; i++) {
    // Deterministic lanes, scrolled by time — no per-frame randomness, so the
    // streaks flow instead of flickering.
    const lane = (i * 97) % PH;
    const speed = 0.55 + ((i * 37) % 40) / 100;
    const len = ts * (0.7 + ((i * 53) % 60) / 60);
    let x = ((now * speed * 0.35) + i * 173) % (PW + 240) - 120;
    const y = lane + Math.sin(now / 700 + i) * ts * 0.12;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y + ts * 0.06);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
  ctx.restore();
}

// ─── Beat 4: the dragon's breath ──────────────────────────────────────────────
// A wall of flame that leaves the Emperor and crosses the whole screen. Drawn as
// an expanding ring clipped to a forward arc rather than as a fixed-width beam,
// because it has to read as coming FROM him from wherever the camera happens to
// be sitting — the player is somewhere in the village, not on a fixed mark.
//
// Three layers: an outer body of deep orange, a hotter core inside it, and a
// leading edge of near-white where the fire is actually eating the ground. The
// whole thing fades out over the last third of its life so it thins into smoke
// rather than snapping off.
function drawPrologueBreath(ts) {
  if (typeof prologueBreath === 'undefined' || !prologueBreath) return;
  const B = prologueBreath;
  const t = Math.max(0, Math.min(1, B.t / B.ms));
  // Ease out: it leaves him fast and slows as it spreads.
  const eased = 1 - Math.pow(1 - t, 2.2);
  const ox = (B.x - camC) * ts, oy = (B.y - camR) * ts;
  // Far enough to clear the diagonal of any viewport.
  const maxR = Math.hypot(PW, PH) * 1.15;
  const r = eased * maxR;
  const fade = t < 0.66 ? 1 : 1 - (t - 0.66) / 0.34;
  if (r <= 1 || fade <= 0) return;

  ctx.save();
  const band = Math.max(ts * 1.4, maxR * 0.16);
  // Outer body.
  const grad = ctx.createRadialGradient(ox, oy, Math.max(0, r - band), ox, oy, r);
  grad.addColorStop(0.00, `rgba(150,30,0,0)`);
  grad.addColorStop(0.45, `rgba(214,74,12,${(0.42 * fade).toFixed(3)})`);
  grad.addColorStop(0.80, `rgba(255,140,36,${(0.62 * fade).toFixed(3)})`);
  grad.addColorStop(0.97, `rgba(255,226,150,${(0.80 * fade).toFixed(3)})`);
  grad.addColorStop(1.00, `rgba(255,255,230,0)`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(ox, oy, r, 0, Math.PI * 2);
  ctx.arc(ox, oy, Math.max(0, r - band), 0, Math.PI * 2, true);
  ctx.fill();

  // Leading edge — a bright, ragged rim. The wobble is a function of angle and
  // elapsed time, so it churns without any per-frame randomness.
  ctx.strokeStyle = `rgba(255,244,214,${(0.55 * fade).toFixed(3)})`;
  ctx.lineWidth = Math.max(2, ts * 0.14);
  ctx.beginPath();
  for (let a = 0; a <= Math.PI * 2 + 0.001; a += Math.PI / 48) {
    const wob = 1 + Math.sin(a * 7 + B.t / 90) * 0.020 + Math.sin(a * 13 - B.t / 140) * 0.012;
    const rx = ox + Math.cos(a) * r * wob;
    const ry = oy + Math.sin(a) * r * wob;
    if (a === 0) ctx.moveTo(rx, ry); else ctx.lineTo(rx, ry);
  }
  ctx.stroke();

  // A wash of heat over everything the front has already passed, so the ground
  // behind the fire is lit rather than untouched.
  ctx.fillStyle = `rgba(190,60,10,${(0.16 * fade).toFixed(3)})`;
  ctx.beginPath();
  ctx.arc(ox, oy, Math.max(0, r - band * 0.9), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPrologueEmperor(ts) {
  if (typeof prologueEmperor === 'undefined' || !prologueEmperor) return;
  const E = prologueEmperor;
  const alt = E.alt || 0;
  const scale = E.scale || 1;

  // Ground shadow, cast where he actually is. High up it's a small soft smudge;
  // as he drops it swells and darkens, which is what sells the descent — the
  // player watches the shadow before they look up.
  const gx = (E.x - camC) * ts, gy = (E.y - camR) * ts;
  const near = Math.max(0, 1 - alt / 14);
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,' + (0.12 + near * 0.34).toFixed(3) + ')';
  ctx.beginPath();
  ctx.ellipse(gx, gy, ts * (1.6 + near * 2.6) * scale, ts * (0.5 + near * 0.9) * scale,
              0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // The dragon himself, lifted up the screen by his altitude. That lift is now
  // a real z on the actor rather than a translate wrapped around the call, so
  // he goes through exactly the same path as every other sprite.
  //
  // The y offset is not a fudge, it is the beat's authored composition. This
  // cutscene was hand-placed against drawEnemy's OLD tile-centred box, which
  // for a 5.5-tile sprite sank his feet (size - 1) / 2 tiles below his tile
  // row. Foot anchoring would otherwise jump him 2.25 tiles up the screen mid
  // beat, and Beat 3 is the most visible sprite in the game. Passing the foot
  // plane the art was composed for reproduces it exactly. Genuinely replanting
  // him on the ground is an art decision for Phase 6, not a refactor.
  const emperorSize = 5.5 * scale;
  const emperorFootY = E.y + (emperorSize - 1) / 2;
  ctx.save();
  drawEnemy({
    type: 'adult_red_dragon',
    x: E.x, y: emperorFootY, z: alt,
    size: emperorSize,
    hp: 1, maxHp: 1,
    name: 'The Red Dragon Emperor',
    element: 'fire',     // gives him the fire aura every fire-element enemy wears
    id: 9901,            // stable id → stable idle-bob phase
    cutsceneActor: true
  }, ts);
  ctx.restore();
}

// ─── Ashfall ───
// Slow grey flakes drifting down over a burning map. Screen-anchored rather than
// world-anchored (unlike drawDriftClouds) because ash is falling *on the camera*,
// not sitting at a map coordinate — and it means the field survives a teleport
// between the village and the ruined house without popping.
//
// Self-contained rather than routed through spawnParticle: the particle system's
// lifetime is ~0.75s and its array is cleared on load / new game / map change,
// neither of which suits a continuous atmospheric layer.
let _ashFlakes = null;

function drawAshfall() {
  if (burnLevel <= 0.02) return;
  if (!_ashFlakes) {
    _ashFlakes = [];
    for (let i = 0; i < 70; i++) {
      _ashFlakes.push({
        x: Math.random(), y: Math.random(),        // normalised to the viewport
        vy: 0.00004 + Math.random() * 0.00009,     // fraction of screen per ms
        sway: Math.random() * Math.PI * 2,
        r: 0.7 + Math.random() * 1.6,
        a: 0.25 + Math.random() * 0.45
      });
    }
  }
  const dt = 16;   // fixed step: exact flake timing is imperceptible, and this
                   // keeps the layer off the wall-clock plumbing above
  ctx.save();
  ctx.globalAlpha = 1;
  for (const f of _ashFlakes) {
    f.y += f.vy * dt;
    f.sway += dt * 0.0016;
    if (f.y > 1.05) { f.y = -0.05; f.x = Math.random(); }
    const px = (f.x + Math.sin(f.sway) * 0.012) * PW;
    const py = f.y * PH;
    ctx.fillStyle = 'rgba(210,205,198,' + (f.a * Math.min(1, burnLevel)).toFixed(3) + ')';
    ctx.beginPath();
    ctx.arc(px, py, f.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Cinematic bars. Drawn over the HUD but under the fade, so a scene can letterbox
// without the black curtain and vice versa.
function drawLetterbox() {
  if (letterboxLevel <= 0.001) return;
  const h = Math.round(PH * 0.11 * Math.min(1, letterboxLevel));
  if (h <= 0) return;
  ctx.save();
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, PW, h);
  ctx.fillRect(0, PH - h, PW, h);
  ctx.restore();
}

// The black curtain. Last thing drawn, over absolutely everything — a fade that
// leaves the HUD floating on top isn't a fade.
function drawFadeOverlay() {
  if (fadeLevel <= 0.001) return;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,' + Math.min(1, fadeLevel).toFixed(3) + ')';
  ctx.fillRect(0, 0, PW, PH);
  ctx.restore();
}

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
// ─── The depth layer ──────────────────────────────────────────────────────────
// Everything that can occlude or be occluded, drawn in one back-to-front order
// instead of the fixed pass order the flat renderer uses.
//
// Kinds are small ints, ordered so that a plain numeric compare breaks ties the
// way the flat renderer already did. For objects on the SAME row the order below
// reproduces render()'s old sequence exactly, so the only behavioural change is
// across rows, which is the whole point.
//
// Tall tiles sort FIRST within a row: a wall and an actor standing beside it are
// on the same row, and the actor should be in front of it.
const DEPTH_TALL     = 0;
const DEPTH_DROP     = 1;
const DEPTH_PROJ     = 2;
const DEPTH_ENEMY    = 3;
const DEPTH_VILLAGER = 4;
const DEPTH_PLAYER   = 5;
// A forest-village roof sorts AFTER every actor on its own row, because its job
// is to hide the people inside the house. Its key is the house's south row, so
// an actor inside (rows r1..r2) is covered while one standing south of the door
// (r2 + 1) is not. That replaces redrawPlayerInFront, which drew the whole hero
// a second time to get the same effect for the one pilot cottage.
const DEPTH_ROOF     = 6;

// Sub-kinds for a tall tile, so the merge can dispatch without a string compare.
const TALL_EXTRUDE  = 0;
const TALL_COLOSSAL = 1;
const TALL_LANDMARK = 2;

// Per-map, memoized, row-sorted list of every tall tile, as flat triples
// (col, row, subKind). Flat because a forest is ~35% TREE and this list can run
// to a thousand entries: an array of objects would be a thousand allocations to
// walk past every frame. Row-major scan order means it comes out sorted by row
// for free, which is what lets the merge below be a merge and not a sort.
//
// Membership is by EXPLICIT SET, not by height. The plan called for a
// DEPTH_SORT_MIN_Z = 0.6 floor to keep short props out; that floor is not used,
// because nothing here is selected by height in the first place. Applying it
// would in fact be wrong now: burnt walls stand at 0.50 and must be in this
// list. When tall tiles are one day chosen by consulting TILE_HEIGHT, that is
// the moment to add the floor.
function mapTallTiles(mapObj) {
  let list = mapObj._tallTiles;
  if (list) return list;
  list = [];
  const g = mapObj.map;
  for (let r = 0; r < MROWS; r++) {
    const row = g[r];
    for (let c = 0; c < MCOLS; c++) {
      const t = row[c];
      if (t === T.COLOSSAL_TREE)          list.push(c, r, TALL_COLOSSAL);
      else if (BIG_LANDMARK_TILES.has(t)) list.push(c, r, TALL_LANDMARK);
      else if (EXTRUDED_TILES.has(t))     list.push(c, r, TALL_EXTRUDE);
    }
  }
  mapObj._tallTiles = list;
  return list;
}

// Just the ledge tiles, for the flat renderer. The pilot map gets these through
// mapTallTiles and the depth merge; every other map needs them too, because a
// ledge's height is gameplay rather than decoration, and it is the one extruded
// type that must not be left flat off-pilot (see the pass in render()).
//
// A separate memoized list rather than a filter over mapTallTiles, so the common
// case (a forest with ~1000 tall tiles and no ledges) is an empty array and not
// a thousand comparisons every frame.
function mapLedgeTiles(mapObj) {
  let list = mapObj._ledgeTiles;
  if (list) return list;
  list = [];
  const g = mapObj.map;
  for (let r = 0; r < MROWS; r++) {
    const row = g[r];
    for (let c = 0; c < MCOLS; c++) {
      if (row[c] === T.LEDGE || row[c] === T.LEDGE_FACE) list.push(c, r);
    }
  }
  mapObj._ledgeTiles = list;
  return list;
}

// Anything that edits a tile has to drop the memoized scans, or the depth layer
// keeps drawing a wall that was blown up and skips one that appeared.
//
// Nothing in the game currently edits a tile that is IN these lists (the bomb
// takes ROCK and SNOW_DRIFT, the shrines swap gates for floor), so this is
// insurance rather than a fix. It is wired anyway, because the failure mode is
// silent and the next tall tile type added could easily be a destructible one.
function invalidateTallTiles(mapObj) {
  if (!mapObj) return;
  mapObj._tallTiles = null;
  mapObj._ledgeTiles = null;
  mapObj._colossalTrees = null;
  mapObj._bigLandmarks = null;
}

// Draw one tall tile, with the cull margins its art needs. Each kind overhangs
// its own tile differently, so the margins are per-kind and are the same ones
// the three separate passes used before they were folded in here.
function drawTallTile(map, c, r, sub, ts, startC, startR, endC, endR) {
  switch (sub) {
    case TALL_EXTRUDE:
      // A wall lifted 1.6 tiles up the screen is drawn from an anchor that can
      // sit off the bottom edge while its cap is still plainly in view.
      if (c >= startC - 1 && c <= endC + 1 && r >= startR - 1 && r <= endR + 3)
        drawTileExtrusion(map, c, r, ts);
      break;
    case TALL_COLOSSAL:
      if (c >= startC - 3 && c <= endC + 3 && r >= startR - 1 && r <= endR + 4)
        drawColossalTree(c, r, ts);
      break;
    case TALL_LANDMARK:
      if (c >= startC - 3 && c <= endC + 3 && r >= startR - 2 && r <= endR + 4)
        drawBigLandmark(map[r][c], c, r, ts);
      break;
  }
}

// The depth layer: one back-to-front walk over the tall tiles and the actors.
//
// A MERGE, not a sort. The tall-tile list is already row-sorted at build time
// and can be a thousand entries; the actors are at most a few dozen. So the
// actors get the comparison sort and are then walked alongside the tall list in
// O(n + m), with no sort of the big list at all.
//
// The key is the FOOT ROW and only the foot row. Not foot row plus z: in an
// oblique projection the camera sits at a fixed angle, so screen depth is world
// Y. A bird five tiles up over row 10 must still be hidden by a wall on row 12,
// and lifting its key by its altitude would pop it in front of that wall.
function drawDepthLayer(mapObj, map, ts, startC, startR, endC, endR) {
  const actors = [];
  // Pushed in the flat renderer's own pass order, so a stable sort leaves
  // same-row, same-kind objects (enemies by spawn order, villagers by spawn
  // order) exactly where they were.
  for (const d of drops) actors.push({ y: d.y, k: DEPTH_DROP, o: d });
  // A projectile is anchored differently from everything else in this list: it
  // carries tx/ty, not x/y, and its ty is a tile CENTRE (spawned at y + 0.5),
  // whereas every actor here keys on its tile ROW. So subtract the half tile.
  //
  // Keying on the non-existent p.y instead put `undefined` into the sort. That
  // is not merely wrong for the projectile: (a.y - b.y) is then NaN, NaN is
  // falsy, so the comparator silently fell through to the kind compare and
  // stopped being a consistent total order, which can misorder unrelated actors
  // anywhere in the frame.
  for (const p of projectiles) actors.push({ y: p.ty - 0.5, k: DEPTH_PROJ, o: p });
  for (const e of enemies) { if (!e.dead) actors.push({ y: e.y, k: DEPTH_ENEMY, o: e }); }
  if (typeof villagers !== 'undefined') {
    for (const v of villagers) actors.push({ y: v.renderY, k: DEPTH_VILLAGER, o: v });
  }
  actors.push({ y: player.renderY, k: DEPTH_PLAYER, o: player });
  // Roofs join the same stream rather than getting a third one: a village has a
  // handful of houses, and this is what lets a hero standing at the door be in
  // front of the roof he is standing under the eaves of.
  if (typeof mapForestHouseRoofs === 'function' && roofsApply(mapObj)) {
    for (const h of mapForestHouseRoofs(mapObj)) {
      if (forestRoofVisible(h, ts, startC, startR, endC, endR))
        actors.push({ y: h.r2, k: DEPTH_ROOF, o: h });
    }
  }

  // Array.prototype.sort is stable in every engine this runs on, so equal
  // (y, kind) pairs keep insertion order and spawn order survives.
  actors.sort((a, b) => (a.y - b.y) || (a.k - b.k));

  const tall = mapTallTiles(mapObj);
  let ti = 0;

  for (const act of actors) {
    // `<=` so a tall tile on the same row as an actor is drawn first, which is
    // the DEPTH_TALL = 0 tie-break expressed as a comparison.
    while (ti < tall.length && tall[ti + 1] <= act.y) {
      drawTallTile(map, tall[ti], tall[ti + 1], tall[ti + 2], ts, startC, startR, endC, endR);
      ti += 3;
    }
    switch (act.k) {
      case DEPTH_DROP:     drawDrop(act.o, ts); break;
      case DEPTH_PROJ:     drawProjectile(act.o); break;
      case DEPTH_ENEMY:    drawEnemy(act.o, ts); break;
      case DEPTH_VILLAGER: drawVillager(act.o, ts); break;
      case DEPTH_PLAYER:   drawPlayer(ts); break;
      case DEPTH_ROOF:     drawForestHouseRoof(act.o, mapObj, ts); break;
    }
  }
  // Everything still standing south of the last actor.
  while (ti < tall.length) {
    drawTallTile(map, tall[ti], tall[ti + 1], tall[ti + 2], ts, startC, startR, endC, endR);
    ti += 3;
  }
}

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

// Forest houses keep their walkable interiors on the outdoor map. Find each
// rectangular shell from its south-facing door so a roof can be drawn as a
// separate foreground layer without changing collision or save data. This also
// recognises Elderbrook's older, larger homes and already-generated save maps.
const FOREST_ROOF_DOOR_TILES = new Set([
  T.DOOR, T.INN_DOOR, T.STORE_DOOR, T.HERB_DOOR, T.SMITH_DOOR, T.SHRINE_DOOR,
].filter(t => t !== undefined));

function mapForestHouseRoofs(mapObj) {
  if (mapObj._forestHouseRoofs) return mapObj._forestHouseRoofs;
  const m = mapObj.map;
  const wall = t => t === T.WALL || t === T.CASTLE_WINDOW;
  const roofs = [];
  const seen = new Set();
  for (let r = 1; r < MROWS - 1; r++) {
    for (let c = 1; c < MCOLS - 1; c++) {
      if (!FOREST_ROOF_DOOR_TILES.has(m[r][c])) continue;
      let c1 = c - 1, c2 = c + 1;
      while (c1 >= 0 && wall(m[r][c1])) c1--;
      while (c2 < MCOLS && wall(m[r][c2])) c2++;
      c1++; c2--;
      if (c2 - c1 < 5 || c2 - c1 > 24) continue;
      let r1 = r;
      while (r1 > 0 && wall(m[r1 - 1][c1])) r1--;
      if (r - r1 < 4 || r - r1 > 20) continue;
      // Reject accidental wall runs: a house has a mostly intact north wall and
      // an intact east side matching the west side used to find its top.
      let northWall = 0;
      for (let x = c1; x <= c2; x++) if (wall(m[r1][x])) northWall++;
      if (northWall < (c2 - c1 + 1) * 0.7 || !wall(m[r1][c2])) continue;
      const key = `${c1},${r1},${c2},${r}`;
      if (seen.has(key)) continue;
      seen.add(key);
      roofs.push({ c1, r1, c2, r2:r, doorC:c });
    }
  }
  mapObj._forestHouseRoofs = roofs;
  return roofs;
}

function forestShopSignStyle(doorTile) {
  if (doorTile === T.INN_DOOR) return {
    board:'#7c322f', trim:'#e0b65a', ink:'#fff0bd', symbol:'mug',
  };
  if (doorTile === T.STORE_DOOR) return {
    board:'#315c42', trim:'#d6b45b', ink:'#fff0bd', symbol:'parcel',
  };
  if (doorTile === T.HERB_DOOR) return {
    board:'#406332', trim:'#c7d276', ink:'#f1f3c9', symbol:'leaf',
  };
  if (doorTile === T.SMITH_DOOR) return {
    board:'#4b4542', trim:'#df803d', ink:'#ffe0ae', symbol:'hammer',
  };
  return null;
}

// Painted boards hang beneath the front gable, where they remain readable even
// while the roof hides the shop interior. Simple geometric emblems keep each
// trade recognisable without relying on emoji or platform-specific fonts.
function drawForestShopSign(doorTile, centreX, bottom, ts) {
  const style = forestShopSignStyle(doorTile);
  if (!style) return;

  const boardW = ts * 1.24;
  const boardH = ts * 0.92;
  const boardX = centreX - boardW / 2;
  const boardY = bottom + ts * 0.28;
  const chainInset = boardW * 0.22;

  // Two iron hooks make the board look physically attached to the eave.
  ctx.strokeStyle = '#292421';
  ctx.lineWidth = Math.max(1.5, ts * 0.065);
  ctx.beginPath();
  ctx.moveTo(boardX + chainInset, bottom - ts * 0.02);
  ctx.lineTo(boardX + chainInset, boardY + ts * 0.04);
  ctx.moveTo(boardX + boardW - chainInset, bottom - ts * 0.02);
  ctx.lineTo(boardX + boardW - chainInset, boardY + ts * 0.04);
  ctx.stroke();
  ctx.fillStyle = '#181310';
  ctx.beginPath(); ctx.arc(boardX + chainInset, boardY + ts * 0.07, ts * 0.07, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(boardX + boardW - chainInset, boardY + ts * 0.07, ts * 0.07, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = 'rgba(16,9,5,0.48)';
  ctx.fillRect(boardX + ts * 0.10, boardY + ts * 0.11, boardW, boardH);
  ctx.fillStyle = style.trim;
  ctx.fillRect(boardX - ts * 0.07, boardY - ts * 0.07, boardW + ts * 0.14, boardH + ts * 0.14);
  ctx.fillStyle = '#322018';
  ctx.fillRect(boardX, boardY, boardW, boardH);
  ctx.fillStyle = style.board;
  ctx.fillRect(boardX + ts * 0.08, boardY + ts * 0.08, boardW - ts * 0.16, boardH - ts * 0.16);

  const iconX = boardX + boardW * 0.50;
  const iconY = boardY + boardH * 0.50;
  ctx.strokeStyle = style.ink;
  ctx.fillStyle = style.ink;
  ctx.lineWidth = Math.max(1.25, ts * 0.055);
  if (style.symbol === 'mug') {
    ctx.strokeRect(iconX - ts * 0.22, iconY - ts * 0.21, ts * 0.36, ts * 0.41);
    ctx.beginPath(); ctx.arc(iconX + ts * 0.16, iconY - ts * 0.01, ts * 0.15, -Math.PI / 2, Math.PI / 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(iconX - ts * 0.15, iconY - ts * 0.29); ctx.lineTo(iconX - ts * 0.08, iconY - ts * 0.40); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(iconX + ts * 0.01, iconY - ts * 0.29); ctx.lineTo(iconX + ts * 0.08, iconY - ts * 0.40); ctx.stroke();
  } else if (style.symbol === 'parcel') {
    ctx.strokeRect(iconX - ts * 0.25, iconY - ts * 0.21, ts * 0.50, ts * 0.42);
    ctx.beginPath(); ctx.moveTo(iconX, iconY - ts * 0.21); ctx.lineTo(iconX, iconY + ts * 0.21); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(iconX - ts * 0.25, iconY - ts * 0.04); ctx.lineTo(iconX + ts * 0.25, iconY - ts * 0.04); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(iconX - ts * 0.15, iconY - ts * 0.31); ctx.lineTo(iconX, iconY - ts * 0.21); ctx.lineTo(iconX + ts * 0.15, iconY - ts * 0.31); ctx.stroke();
  } else if (style.symbol === 'leaf') {
    ctx.beginPath();
    ctx.ellipse(iconX, iconY - ts * 0.04, ts * 0.29, ts * 0.16, -0.65, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath(); ctx.moveTo(iconX - ts * 0.22, iconY + ts * 0.24); ctx.lineTo(iconX + ts * 0.18, iconY - ts * 0.20); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(iconX - ts * 0.04, iconY + ts * 0.04); ctx.lineTo(iconX - ts * 0.22, iconY - ts * 0.05); ctx.stroke();
  } else {
    ctx.save();
    ctx.translate(iconX, iconY);
    ctx.rotate(-0.62);
    ctx.fillRect(-ts * 0.045, -ts * 0.06, ts * 0.09, ts * 0.42);
    ctx.fillRect(-ts * 0.23, -ts * 0.21, ts * 0.46, ts * 0.15);
    ctx.restore();
  }
}

// The enlarged Elderbrook family home is the 2.5D art-direction pilot. It keeps
// the ordinary tile map and collision underneath, then replaces only this one
// shell with timber, plaster, depth shadows and local light inspired by the
// forest-village concept art. The ruin deliberately keeps its established
// scorched rendering so Ashfall still destroys the warm home shown in Beat 1.
// Does this map render in 2.5D? Elderbrook is the art pilot and the only map
// that does, so every other map keeps today's flat renderer exactly.
//
// The plan called for a stored `mapObj._oblique` flag. This is derived from the
// map's type instead, for two reasons. Map objects are long-lived and carry
// memoized render caches (_tallTiles, _colossalTrees, _bigLandmarks), so adding
// a stored field raises a "does this reach the save?" question that a pure
// function does not raise at all. And derived means every Elderbrook already in
// an existing save is covered without a migration, including the ruined one.
//
// Deliberately NOT isIntactElderbrookHome: the ruin is the same village with the
// same walls, and its walls should stand up too.
function isObliqueMap(mapObj) {
  return !!mapObj && mapObj.type === 'homevillage';
}

function isIntactElderbrookHome(mapObj) {
  if (!mapObj || mapObj.type !== 'homevillage' || typeof HOME === 'undefined') return false;
  return !(typeof hasFlag === 'function' &&
    (hasFlag('village_burning') || hasFlag('prologue_complete')));
}

function isFamilyHomeRoof(h, mapObj) {
  if (!isIntactElderbrookHome(mapObj)) return false;
  const H = HOME.house;
  return h.c1 === H.c1 && h.r1 === H.r1 &&
         h.c2 === H.c1 + H.w && h.r2 === H.r1 + H.h;
}

function isInsideIntactElderbrookHomePosition(x, y) {
  if (typeof currentMap !== 'function' || typeof HOME === 'undefined') return false;
  const mapObj = currentMap();
  if (!isIntactElderbrookHome(mapObj)) return false;
  const H = HOME.house;
  return x >= H.c1 && x <= H.c1 + H.w && y >= H.r1 && y <= H.r1 + H.h;
}

// Directional finishing pass for the enlarged family-home interior. Shared tile
// sprites stay untouched elsewhere in the world; only furniture in this room
// receives the pilot's upper-left highlights and lower-right contact shadows.
function drawElderbrookInteriorFurnishingLight(mapObj, ts) {
  const H = HOME.house;
  const r2 = H.r1 + H.h, c2 = H.c1 + H.w;
  const map = mapObj.map;

  ctx.save();

  // The dining candle is a small local source, just like the hearth and wall
  // torches. It warms the nearby tabletop without changing the sun direction.
  const candleX = (H.c1 + 7.5 - camC) * ts;
  const candleY = (H.r1 + 2.22 - camR) * ts;
  const candleGlow = ctx.createRadialGradient(candleX, candleY, ts * 0.03,
    candleX, candleY, ts * 1.15);
  candleGlow.addColorStop(0, 'rgba(255,221,135,0.20)');
  candleGlow.addColorStop(1, 'rgba(255,180,76,0)');
  ctx.fillStyle = candleGlow;
  ctx.fillRect(candleX - ts * 1.15, candleY - ts * 1.15, ts * 2.3, ts * 2.3);

  const groundShadow = (x, y, rx, ry, angle = 0.10) => {
    ctx.fillStyle = 'rgba(39,22,12,0.24)';
    ctx.beginPath();
    ctx.ellipse(x + ts * 0.57, y + ts * 0.88, ts * rx, ts * ry,
      angle, 0, Math.PI * 2);
    ctx.fill();
  };

  for (let r = H.r1 + 1; r < r2; r++) {
    for (let c = H.c1 + 1; c < c2; c++) {
      const tile = map[r][c];
      const x = (c - camC) * ts, y = (r - camR) * ts;

      switch (tile) {
        case T.BED:
          groundShadow(x, y, 0.40, 0.095);
          // Lit mattress/head edge; shaded east frame and foot edge.
          ctx.fillStyle = 'rgba(255,248,225,0.34)';
          ctx.fillRect(x + ts * 0.13, y + ts * 0.19, ts * 0.60, ts * 0.035);
          ctx.fillRect(x + ts * 0.11, y + ts * 0.21, ts * 0.035, ts * 0.46);
          ctx.fillStyle = 'rgba(39,20,10,0.22)';
          ctx.fillRect(x + ts * 0.87, y + ts * 0.22, ts * 0.035, ts * 0.60);
          ctx.fillRect(x + ts * 0.16, y + ts * 0.80, ts * 0.71, ts * 0.035);
          break;

        case T.TABLE:
          groundShadow(x, y, 0.40, 0.10);
          ctx.fillStyle = 'rgba(233,176,103,0.34)';
          ctx.fillRect(x + ts * 0.11, y + ts * 0.235, ts * 0.61, ts * 0.035);
          ctx.fillRect(x + ts * 0.095, y + ts * 0.25, ts * 0.035, ts * 0.31);
          ctx.fillStyle = 'rgba(31,16,8,0.25)';
          ctx.fillRect(x + ts * 0.87, y + ts * 0.29, ts * 0.035, ts * 0.36);
          break;

        case T.CHAIR:
          groundShadow(x, y, 0.25, 0.075);
          ctx.fillStyle = 'rgba(224,157,87,0.34)';
          ctx.fillRect(x + ts * 0.30, y + ts * 0.15, ts * 0.27, ts * 0.025);
          ctx.fillRect(x + ts * 0.30, y + ts * 0.18, ts * 0.025, ts * 0.35);
          ctx.fillStyle = 'rgba(31,16,8,0.24)';
          ctx.fillRect(x + ts * 0.70, y + ts * 0.51, ts * 0.025, ts * 0.38);
          break;

        case T.CHEST: {
          const opened = mapObj.openedChests.has(`${c},${r}`);
          groundShadow(x, y, 0.43, 0.105);

          if (opened) {
            // Raised lid: dark outer silhouette, warm inner boards, and a deep
            // black cavity make the open state immediately distinct.
            ctx.fillStyle = '#24160f';
            ctx.beginPath();
            ctx.moveTo(x + ts * 0.10, y + ts * 0.42);
            ctx.lineTo(x + ts * 0.16, y + ts * 0.11);
            ctx.lineTo(x + ts * 0.88, y + ts * 0.18);
            ctx.lineTo(x + ts * 0.91, y + ts * 0.47);
            ctx.closePath(); ctx.fill();
            const openLid = ctx.createLinearGradient(x, y, x + ts, y + ts * 0.48);
            openLid.addColorStop(0, '#a66a34');
            openLid.addColorStop(1, '#58331f');
            ctx.fillStyle = openLid;
            ctx.beginPath();
            ctx.moveTo(x + ts * 0.16, y + ts * 0.39);
            ctx.lineTo(x + ts * 0.21, y + ts * 0.17);
            ctx.lineTo(x + ts * 0.83, y + ts * 0.22);
            ctx.lineTo(x + ts * 0.86, y + ts * 0.41);
            ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#160f0b';
            ctx.beginPath();
            ctx.moveTo(x + ts * 0.13, y + ts * 0.43);
            ctx.lineTo(x + ts * 0.88, y + ts * 0.43);
            ctx.lineTo(x + ts * 0.80, y + ts * 0.58);
            ctx.lineTo(x + ts * 0.20, y + ts * 0.58);
            ctx.closePath(); ctx.fill();
          } else {
            // Domed lid gives the closed chest the classic treasure-trunk shape.
            ctx.fillStyle = '#26170f';
            ctx.beginPath();
            ctx.moveTo(x + ts * 0.07, y + ts * 0.47);
            ctx.lineTo(x + ts * 0.12, y + ts * 0.30);
            ctx.quadraticCurveTo(x + ts * 0.50, y + ts * 0.09,
                                 x + ts * 0.88, y + ts * 0.30);
            ctx.lineTo(x + ts * 0.94, y + ts * 0.47);
            ctx.closePath(); ctx.fill();
            const lidWood = ctx.createLinearGradient(x + ts * 0.12, y + ts * 0.18,
              x + ts * 0.88, y + ts * 0.46);
            lidWood.addColorStop(0, '#bd7a3a');
            lidWood.addColorStop(0.55, '#895126');
            lidWood.addColorStop(1, '#4c2c1c');
            ctx.fillStyle = lidWood;
            ctx.beginPath();
            ctx.moveTo(x + ts * 0.13, y + ts * 0.44);
            ctx.lineTo(x + ts * 0.17, y + ts * 0.31);
            ctx.quadraticCurveTo(x + ts * 0.50, y + ts * 0.15,
                                 x + ts * 0.83, y + ts * 0.31);
            ctx.lineTo(x + ts * 0.87, y + ts * 0.44);
            ctx.closePath(); ctx.fill();
            // Upper-left rim catches the room's morning light.
            ctx.strokeStyle = 'rgba(255,210,126,0.58)';
            ctx.lineWidth = Math.max(1, ts * 0.028);
            ctx.beginPath();
            ctx.moveTo(x + ts * 0.18, y + ts * 0.31);
            ctx.quadraticCurveTo(x + ts * 0.43, y + ts * 0.17,
                                 x + ts * 0.61, y + ts * 0.20);
            ctx.stroke();
          }

          // Heavy lower box and recessed front panel remain visible in both
          // states, so the object never collapses into an orange square.
          ctx.fillStyle = '#25170f';
          ctx.fillRect(x + ts * 0.06, y + ts * 0.44, ts * 0.88, ts * 0.47);
          const chestFace = ctx.createLinearGradient(x + ts * 0.09, y + ts * 0.47,
            x + ts * 0.91, y + ts * 0.89);
          chestFace.addColorStop(0, '#a8622d');
          chestFace.addColorStop(0.58, '#75401f');
          chestFace.addColorStop(1, '#42271a');
          ctx.fillStyle = chestFace;
          ctx.fillRect(x + ts * 0.10, y + ts * 0.48, ts * 0.80, ts * 0.38);
          ctx.strokeStyle = 'rgba(49,25,13,0.72)';
          ctx.lineWidth = Math.max(1, ts * 0.028);
          ctx.strokeRect(x + ts * 0.20, y + ts * 0.56, ts * 0.60, ts * 0.22);

          // Iron bands, corner plates, bolts and feet make the storage function
          // legible even before the player notices the lock.
          ctx.fillStyle = '#3e4140';
          ctx.fillRect(x + ts * 0.10, y + ts * 0.44, ts * 0.80, ts * 0.075);
          ctx.fillRect(x + ts * 0.18, y + ts * 0.32, ts * 0.075, ts * 0.56);
          ctx.fillRect(x + ts * 0.75, y + ts * 0.32, ts * 0.075, ts * 0.56);
          ctx.fillStyle = '#242625';
          ctx.fillRect(x + ts * 0.10, y + ts * 0.80, ts * 0.10, ts * 0.10);
          ctx.fillRect(x + ts * 0.80, y + ts * 0.80, ts * 0.10, ts * 0.10);
          ctx.fillStyle = '#a7a39a';
          for (const px of [0.215, 0.785]) {
            for (const py of [0.48, 0.82]) {
              ctx.beginPath();
              ctx.arc(x + ts * px, y + ts * py, ts * 0.018, 0, Math.PI * 2);
              ctx.fill();
            }
          }

          // Oversized brass escutcheon and keyhole are the final recognition cue.
          ctx.fillStyle = '#d5a640';
          ctx.fillRect(x + ts * 0.42, y + ts * 0.45, ts * 0.16, ts * 0.20);
          ctx.fillStyle = '#f0cc67';
          ctx.fillRect(x + ts * 0.44, y + ts * 0.47, ts * 0.10, ts * 0.035);
          ctx.fillStyle = '#3b2918';
          ctx.beginPath();
          ctx.arc(x + ts * 0.50, y + ts * 0.54, ts * 0.026, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillRect(x + ts * 0.485, y + ts * 0.55, ts * 0.03, ts * 0.06);
          break;
        }

        case T.FIREPLACE:
          // The stone body still obeys daylight; the fire remains an emissive
          // radial source layered over that masonry.
          ctx.fillStyle = 'rgba(225,213,188,0.28)';
          ctx.fillRect(x + ts * 0.05, y + ts * 0.045, ts * 0.68, ts * 0.04);
          ctx.fillRect(x + ts * 0.045, y + ts * 0.07, ts * 0.04, ts * 0.61);
          ctx.fillStyle = 'rgba(25,18,15,0.25)';
          ctx.fillRect(x + ts * 0.91, y + ts * 0.14, ts * 0.045, ts * 0.77);
          ctx.fillRect(x + ts * 0.15, y + ts * 0.91, ts * 0.80, ts * 0.045);
          break;

        case T.PORTAL:
          groundShadow(x, y, 0.40, 0.105);
          ctx.fillStyle = 'rgba(225,211,242,0.26)';
          ctx.fillRect(x + ts * 0.10, y + ts * 0.095, ts * 0.55, ts * 0.035);
          ctx.fillRect(x + ts * 0.095, y + ts * 0.12, ts * 0.035, ts * 0.53);
          ctx.fillStyle = 'rgba(20,12,27,0.30)';
          ctx.fillRect(x + ts * 0.87, y + ts * 0.18, ts * 0.035, ts * 0.70);
          ctx.fillRect(x + ts * 0.18, y + ts * 0.87, ts * 0.70, ts * 0.035);
          break;

        case T.TORCH:
          groundShadow(x, y, 0.27, 0.07);
          ctx.fillStyle = 'rgba(255,226,151,0.28)';
          ctx.fillRect(x + ts * 0.255, y + ts * 0.775, ts * 0.25, ts * 0.025);
          ctx.fillRect(x + ts * 0.255, y + ts * 0.79, ts * 0.025, ts * 0.13);
          break;

        case T.GRAN_BOW:
          // Offset shadow and a fine upper-left rim follow the bow's own arc.
          ctx.strokeStyle = 'rgba(39,22,12,0.26)';
          ctx.lineWidth = Math.max(1, ts * 0.055);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(x + ts * 0.27, y + ts * 0.21);
          ctx.quadraticCurveTo(x + ts * 0.91, y + ts * 0.55, x + ts * 0.27, y + ts * 0.89);
          ctx.stroke();
          ctx.strokeStyle = 'rgba(255,225,166,0.44)';
          ctx.lineWidth = Math.max(0.8, ts * 0.025);
          ctx.beginPath();
          ctx.moveTo(x + ts * 0.20, y + ts * 0.14);
          ctx.quadraticCurveTo(x + ts * 0.82, y + ts * 0.47, x + ts * 0.20, y + ts * 0.79);
          ctx.stroke();
          ctx.lineCap = 'butt';
          break;
      }
    }
  }

  ctx.restore();
}

function drawElderbrookFamilyHomeDepth(mapObj, ts) {
  if (!isIntactElderbrookHome(mapObj)) return;
  const H = HOME.house;
  const r2 = H.r1 + H.h, c2 = H.c1 + H.w;
  const left = (H.c1 - camC) * ts, top = (H.r1 - camR) * ts;
  const right = (c2 + 1 - camC) * ts, bottom = (r2 + 1 - camR) * ts;
  const inside = player.x >= H.c1 && player.x <= c2 &&
                 player.y >= H.r1 && player.y <= r2;
  const map = mapObj.map;

  ctx.save();

  // A south-east cast shadow anchors the building to the ground. It remains
  // visible around the roof outside and around the exposed shell inside.
  ctx.fillStyle = 'rgba(37,24,13,0.34)';
  ctx.fillRect(right, top + ts * 0.34, ts * 0.30, bottom - top);
  ctx.fillRect(left + ts * 0.34, bottom, right - left, ts * 0.30);

  if (inside) {
    const innerLeft = left + ts, innerTop = top + ts;
    const innerW = right - left - ts * 2, innerH = bottom - top - ts * 2;

    // Long floorboards remove the checkerboard feel without changing any tile.
    // Only bare FLOOR cells get seams, so the lines never cut across furniture.
    ctx.strokeStyle = 'rgba(63,35,17,0.25)';
    ctx.lineWidth = Math.max(0.75, ts * 0.018);
    for (let r = H.r1 + 1; r < r2; r++) {
      for (let c = H.c1 + 1; c < c2; c++) {
        if (map[r][c] !== T.FLOOR) continue;
        const x = (c - camC) * ts, y = (r - camR) * ts;
        for (const f of [0.32, 0.66]) {
          ctx.beginPath(); ctx.moveTo(x, y + ts * f); ctx.lineTo(x + ts, y + ts * f); ctx.stroke();
        }
        if ((r * 11 + c * 7) % 5 === 0) {
          ctx.fillStyle = 'rgba(73,40,19,0.24)';
          ctx.beginPath(); ctx.ellipse(x + ts * 0.72, y + ts * 0.49,
            ts * 0.08, ts * 0.035, 0, 0, Math.PI * 2); ctx.fill();
        }
      }
    }

    // Upper-left morning light and lower-right ambient shade give the single
    // room a consistent light direction, matching the concept sheet.
    ctx.save();
    ctx.beginPath(); ctx.rect(innerLeft, innerTop, innerW, innerH); ctx.clip();
    const shade = ctx.createLinearGradient(innerLeft, innerTop, right - ts, bottom - ts);
    shade.addColorStop(0, 'rgba(255,236,184,0.08)');
    shade.addColorStop(0.55, 'rgba(70,39,20,0.03)');
    shade.addColorStop(1, 'rgba(36,20,12,0.23)');
    ctx.fillStyle = shade; ctx.fillRect(innerLeft, innerTop, innerW, innerH);

    const wx = (HOME.window.x + 0.5 - camC) * ts;
    const wy = (HOME.window.y + 1 - camR) * ts;
    const sun = ctx.createLinearGradient(wx, wy, wx + ts * 4.6, wy + ts * 4.2);
    sun.addColorStop(0, 'rgba(255,239,172,0.30)');
    sun.addColorStop(1, 'rgba(255,239,172,0)');
    ctx.fillStyle = sun;
    ctx.beginPath();
    ctx.moveTo(wx - ts * 0.26, wy);
    ctx.lineTo(wx + ts * 0.36, wy);
    ctx.lineTo(wx + ts * 4.9, wy + ts * 4.5);
    ctx.lineTo(wx + ts * 3.2, wy + ts * 4.5);
    ctx.closePath(); ctx.fill();

    const hx = (HOME.hearth.x + 0.5 - camC) * ts;
    const hy = (HOME.hearth.y + 0.62 - camR) * ts;
    const firelight = ctx.createRadialGradient(hx, hy, ts * 0.10, hx, hy, ts * 3.1);
    firelight.addColorStop(0, 'rgba(255,173,69,0.28)');
    firelight.addColorStop(0.45, 'rgba(255,133,43,0.10)');
    firelight.addColorStop(1, 'rgba(255,112,28,0)');
    ctx.fillStyle = firelight; ctx.fillRect(hx - ts * 3.1, hy - ts * 3.1, ts * 6.2, ts * 6.2);
    ctx.restore();
  }

  // Repaint the one-tile shell as warm lime plaster held by dark oak framing.
  // The lower and right bevels turn the wall band into a raised volume.
  const plaster = ctx.createLinearGradient(left, top, right, bottom);
  plaster.addColorStop(0, '#c7a879'); plaster.addColorStop(1, '#8c6847');
  const wallTile = (c, r) => {
    const x = (c - camC) * ts, y = (r - camR) * ts;
    ctx.fillStyle = plaster; ctx.fillRect(x, y, ts + 0.5, ts + 0.5);
    ctx.fillStyle = '#d9bd88'; ctx.fillRect(x + ts * 0.08, y + ts * 0.08, ts * 0.84, ts * 0.10);
    ctx.fillStyle = '#4a2b19';
    ctx.fillRect(x, y, ts * 0.11, ts);
    ctx.fillRect(x + ts * 0.89, y, ts * 0.11, ts);
    ctx.fillRect(x, y, ts, ts * 0.10);
    ctx.fillStyle = '#5b351f'; ctx.fillRect(x, y + ts * 0.82, ts, ts * 0.18);
    ctx.fillStyle = 'rgba(35,19,11,0.44)'; ctx.fillRect(x + ts * 0.90, y + ts * 0.10, ts * 0.10, ts * 0.72);
  };

  for (let c = H.c1; c <= c2; c++) {
    if (map[H.r1][c] === T.WALL || map[H.r1][c] === T.CASTLE_WINDOW) wallTile(c, H.r1);
    if (map[r2][c] === T.WALL) wallTile(c, r2);
  }
  for (let r = H.r1 + 1; r < r2; r++) {
    if (map[r][H.c1] === T.WALL) wallTile(H.c1, r);
    if (map[r][c2] === T.WALL) wallTile(c2, r);
  }

  // Deep inset leaded window, with a bright upper-left glint.
  {
    const x = (HOME.window.x - camC) * ts, y = (HOME.window.y - camR) * ts;
    ctx.fillStyle = '#3c2418'; ctx.fillRect(x + ts * 0.16, y + ts * 0.12, ts * 0.68, ts * 0.82);
    ctx.fillStyle = '#203b38'; ctx.fillRect(x + ts * 0.25, y + ts * 0.20, ts * 0.50, ts * 0.62);
    const glass = ctx.createLinearGradient(x + ts * 0.25, y + ts * 0.20, x + ts * 0.75, y + ts * 0.82);
    glass.addColorStop(0, '#9fd48f'); glass.addColorStop(0.5, '#4e8f69'); glass.addColorStop(1, '#244d43');
    ctx.fillStyle = glass; ctx.fillRect(x + ts * 0.29, y + ts * 0.24, ts * 0.42, ts * 0.54);
    ctx.strokeStyle = '#d6b46c'; ctx.lineWidth = Math.max(1, ts * 0.035);
    ctx.beginPath();
    ctx.moveTo(x + ts * 0.50, y + ts * 0.24); ctx.lineTo(x + ts * 0.50, y + ts * 0.78);
    ctx.moveTo(x + ts * 0.29, y + ts * 0.50); ctx.lineTo(x + ts * 0.71, y + ts * 0.50); ctx.stroke();
    ctx.fillStyle = 'rgba(236,255,210,0.60)'; ctx.fillRect(x + ts * 0.31, y + ts * 0.27, ts * 0.13, ts * 0.05);
  }

  // A timber threshold replaces the purple placeholder door for this home only.
  {
    const x = (HOME.door.x - camC) * ts, y = (HOME.door.y - camR) * ts;
    ctx.fillStyle = '#2a190f'; ctx.fillRect(x + ts * 0.06, y, ts * 0.88, ts);
    const threshold = ctx.createLinearGradient(x, y, x, y + ts);
    threshold.addColorStop(0, '#b47a3e'); threshold.addColorStop(1, '#6b3b20');
    ctx.fillStyle = threshold; ctx.fillRect(x + ts * 0.15, y, ts * 0.70, ts);
    ctx.strokeStyle = 'rgba(55,27,13,0.60)'; ctx.lineWidth = Math.max(1, ts * 0.035);
    for (const f of [0.26, 0.52, 0.78]) {
      ctx.beginPath(); ctx.moveTo(x + ts * 0.17, y + ts * f); ctx.lineTo(x + ts * 0.83, y + ts * f); ctx.stroke();
    }
    ctx.fillStyle = '#d39a55'; ctx.fillRect(x + ts * 0.15, y, ts * 0.70, ts * 0.08);
  }

  if (inside) {
    // Inner wall lips are the strongest depth cue while the roof is hidden.
    const northLip = ctx.createLinearGradient(0, top + ts, 0, top + ts * 1.34);
    northLip.addColorStop(0, 'rgba(35,20,11,0.42)'); northLip.addColorStop(1, 'rgba(35,20,11,0)');
    ctx.fillStyle = northLip; ctx.fillRect(left + ts, top + ts, right - left - ts * 2, ts * 0.34);
    const eastLip = ctx.createLinearGradient(right - ts * 1.28, 0, right - ts, 0);
    eastLip.addColorStop(0, 'rgba(35,20,11,0)'); eastLip.addColorStop(1, 'rgba(35,20,11,0.34)');
    ctx.fillStyle = eastLip; ctx.fillRect(right - ts * 1.28, top + ts, ts * 0.28, bottom - top - ts * 2);

    drawElderbrookInteriorFurnishingLight(mapObj, ts);
  }

  ctx.restore();
}

// Does this map have forest-village roofs at all? Split out so the depth layer
// can ask it without duplicating the rule.
function roofsApply(mapObj) {
  if (!mapObj || mapObj.biome !== 'forest' ||
      (mapObj.type !== 'village' && mapObj.type !== 'homevillage')) return false;
  // Once the Ashfall begins, Elderbrook's intact roofs are gone; the charred
  // wall and rubble tiles beneath become the visible ruined architecture. This
  // is why the roof layer is dead on the pilot map in every post-prologue save:
  // it only ever draws during the prologue.
  if (mapObj.type === 'homevillage' && typeof hasFlag === 'function' &&
      (hasFlag('village_burning') || hasFlag('prologue_complete'))) return false;
  return true;
}

function drawForestVillageRoofs(mapObj, ts, startC, startR, endC, endR) {
  if (!roofsApply(mapObj)) return;
  // On the pilot the roofs are depth-sorted with everything else instead (see
  // drawDepthLayer), so this pass must not draw them a second time.
  if (isObliqueMap(mapObj)) return;

  for (const h of mapForestHouseRoofs(mapObj)) {
    if (!forestRoofVisible(h, ts, startC, startR, endC, endR)) continue;
    drawForestHouseRoof(h, mapObj, ts);
  }
}

// Is this house's roof drawn at all this frame? Off-screen, or the player is
// inside it. Split out so the depth layer can ask the same question before
// entering a roof into the merge.
function forestRoofVisible(h, ts, startC, startR, endC, endR) {
  if (h.c2 < startC - 1 || h.c1 > endC + 1 || h.r2 < startR - 1 || h.r1 > endR + 1) return false;
  // Crossing the doorway counts as entering: the whole roof vanishes at once
  // and exposes walls, floor, furniture, villagers, and the hero underneath.
  if (player.x >= h.c1 && player.x <= h.c2 && player.y >= h.r1 && player.y <= h.r2) return false;
  return true;
}

// One house's roof. Was the body of the loop above; it is a function now so the
// pilot map can draw each roof at its own depth instead of stacking them all on
// top of every actor at the end of the frame.
function drawForestHouseRoof(h, mapObj, ts) {
  {

    const left = (h.c1 - camC - 0.28) * ts;
    const top = (h.r1 - camR - 0.45) * ts;
    const right = (h.c2 + 1 - camC + 0.28) * ts;
    const bottom = (h.r2 + 1 - camR + 0.20) * ts;
    const familyHome = isFamilyHomeRoof(h, mapObj);
    // The pilot roof stops short of the south edge so a projected front wall can
    // stand beneath it. Generic cottages retain their established full footprint.
    const roofBottom = familyHome ? bottom - ts * 2.08 : bottom;
    const width = right - left, height = bottom - top;
    const roofHeight = roofBottom - top;
    const ridgeY = top + roofHeight * 0.43;
    const centreX = (h.doorC + 0.5 - camC) * ts;
    const seed = (h.c1 * 37 + h.r1 * 61) >>> 0;
    const northRoof = familyHome ? '#6f4728' : (seed % 3 === 0 ? '#6f3525' : '#743a28');
    const southRoof = familyHome ? '#98623a' : (seed % 2 ? '#914d31' : '#88452e');
    const roofEdge = familyHome ? '#342015' : '#3a1d17';
    const ridge = familyHome ? '#d39a58' : '#c27a4a';

    ctx.save();
    // Deep eave shadow makes the roof read as a raised structure rather than a
    // recoloured patch of ground.
    ctx.fillStyle = familyHome ? 'rgba(26,17,9,0.58)' : 'rgba(18,10,5,0.48)';
    ctx.fillRect(left + ts * 0.14, top + ts * 0.28, width, height);

    // North and south roof planes, with clipped corners and a bright ridge.
    ctx.beginPath();
    ctx.moveTo(left + ts * 0.22, top);
    ctx.lineTo(right - ts * 0.22, top);
    ctx.lineTo(right, ridgeY);
    ctx.lineTo(left, ridgeY);
    ctx.closePath();
    const northRoofLight = ctx.createLinearGradient(0, top, 0, ridgeY);
    northRoofLight.addColorStop(0, familyHome ? '#4a2d1c' : northRoof);
    northRoofLight.addColorStop(1, familyHome ? '#865936' : northRoof);
    ctx.fillStyle = northRoofLight; ctx.fill();
    ctx.strokeStyle = roofEdge; ctx.lineWidth = Math.max(1.5, ts * 0.07); ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(left, ridgeY);
    ctx.lineTo(right, ridgeY);
    ctx.lineTo(right - ts * 0.18, roofBottom);
    ctx.lineTo(left + ts * 0.18, roofBottom);
    ctx.closePath();
    const southRoofLight = ctx.createLinearGradient(0, ridgeY, 0, roofBottom);
    southRoofLight.addColorStop(0, familyHome ? '#b57a48' : southRoof);
    southRoofLight.addColorStop(0.58, southRoof);
    southRoofLight.addColorStop(1, familyHome ? '#633c25' : southRoof);
    ctx.fillStyle = southRoofLight; ctx.fill(); ctx.stroke();
    ctx.strokeStyle = ridge; ctx.lineWidth = Math.max(1, ts * 0.08);
    ctx.beginPath(); ctx.moveTo(left + ts * 0.05, ridgeY); ctx.lineTo(right - ts * 0.05, ridgeY); ctx.stroke();

    // Layered shingle courses break up the large planes at every zoom level.
    ctx.strokeStyle = 'rgba(48,20,15,0.55)'; ctx.lineWidth = Math.max(1, ts * 0.035);
    for (let y = ridgeY + ts * 0.48; y < roofBottom - ts * 0.18; y += ts * 0.52) {
      ctx.beginPath(); ctx.moveTo(left + ts * 0.20, y); ctx.lineTo(right - ts * 0.20, y); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(224,132,78,0.28)';
    for (let y = top + ts * 0.38; y < ridgeY - ts * 0.12; y += ts * 0.52) {
      ctx.beginPath(); ctx.moveTo(left + ts * 0.22, y); ctx.lineTo(right - ts * 0.22, y); ctx.stroke();
    }

    if (familyHome) {
      // Staggered shingle joints and a thick south fascia make the larger pilot
      // roof feel built from overlapping material instead of a flat polygon.
      ctx.strokeStyle = 'rgba(49,29,17,0.38)';
      ctx.lineWidth = Math.max(0.8, ts * 0.025);
      let course = 0;
      for (let y = top + ts * 0.38; y < roofBottom - ts * 0.20; y += ts * 0.52, course++) {
        const offset = (course % 2) * ts * 0.46;
        for (let x = left + ts * 0.42 + offset; x < right - ts * 0.24; x += ts * 0.92) {
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, Math.min(y + ts * 0.42, roofBottom - ts * 0.18)); ctx.stroke();
        }
      }

      // Projected front elevation: warm infill, oak frame, two inset windows and
      // a panelled door. This is deliberately taller than one tile so the player
      // sees a house facade as well as its top-down roof plane.
      const facadeTop = roofBottom - ts * 0.03;
      const facadeBottom = bottom + ts * 0.10;
      // Pull the front plane inside the roof silhouette. Matching shallow wall
      // returns keep the depth cue without distorting either end of the house.
      const facadeLeft = left + ts * 0.42;
      const facadeRight = right - ts * 0.42;
      const facadeH = facadeBottom - facadeTop;
      ctx.fillStyle = 'rgba(28,17,10,0.52)';
      ctx.fillRect(facadeLeft + ts * 0.18, facadeTop + ts * 0.24,
        facadeRight - facadeLeft, facadeH);

      // Deep west/east returns sit behind the front wall. Their angled lower
      // edges and different light values establish the building's actual depth.
      ctx.fillStyle = '#735338';
      ctx.beginPath();
      ctx.moveTo(left + ts * 0.18, facadeTop - ts * 0.08);
      ctx.lineTo(facadeLeft, facadeTop + ts * 0.12);
      ctx.lineTo(facadeLeft, facadeBottom);
      ctx.lineTo(left + ts * 0.20, facadeBottom - ts * 0.27);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#513722';
      ctx.beginPath();
      ctx.moveTo(facadeRight, facadeTop + ts * 0.12);
      ctx.lineTo(right - ts * 0.18, facadeTop - ts * 0.08);
      ctx.lineTo(right - ts * 0.16, facadeBottom - ts * 0.30);
      ctx.lineTo(facadeRight, facadeBottom);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(37,22,13,0.72)';
      ctx.lineWidth = Math.max(1, ts * 0.04);
      ctx.beginPath();
      ctx.moveTo(facadeRight, facadeTop + ts * 0.12);
      ctx.lineTo(facadeRight, facadeBottom);
      ctx.stroke();

      const face = ctx.createLinearGradient(facadeLeft, facadeTop, facadeRight, facadeBottom);
      face.addColorStop(0, '#cdb27f'); face.addColorStop(0.58, '#b18a5c'); face.addColorStop(1, '#805c3e');
      ctx.fillStyle = face;
      ctx.fillRect(facadeLeft, facadeTop, facadeRight - facadeLeft, facadeH);

      // A hard roof contact shadow separates the upper plane from the vertical
      // wall and makes the eave appear to float in front of it.
      const eaveShade = ctx.createLinearGradient(0, facadeTop, 0, facadeTop + ts * 0.42);
      eaveShade.addColorStop(0, 'rgba(24,14,8,0.64)');
      eaveShade.addColorStop(1, 'rgba(24,14,8,0)');
      ctx.fillStyle = eaveShade;
      ctx.fillRect(facadeLeft, facadeTop, facadeRight - facadeLeft, ts * 0.42);

      // Hand-trowelled plaster variation. Deterministic marks keep the front from
      // becoming a featureless rectangle without adding animation noise.
      ctx.strokeStyle = 'rgba(93,62,39,0.18)';
      ctx.lineWidth = Math.max(0.65, ts * 0.015);
      for (let i = 0; i < 28; i++) {
        const fx = facadeLeft + ts * 0.35 +
          ((Math.sin(seed * 0.13 + i * 4.17) * 0.5 + 0.5) * (facadeRight - facadeLeft - ts * 0.70));
        const fy = facadeTop + ts * 0.28 +
          ((Math.sin(seed * 0.29 + i * 7.31) * 0.5 + 0.5) * (facadeH - ts * 0.72));
        ctx.beginPath(); ctx.moveTo(fx - ts * 0.07, fy); ctx.lineTo(fx + ts * 0.08, fy + ts * 0.025); ctx.stroke();
      }

      // Stone sill / foundation projects forward below the timber wall.
      ctx.fillStyle = '#4c433a';
      ctx.fillRect(facadeLeft - ts * 0.05, facadeBottom - ts * 0.23,
        facadeRight - facadeLeft + ts * 0.10, ts * 0.27);
      ctx.fillStyle = '#716358';
      for (let x = facadeLeft; x < facadeRight; x += ts * 0.72) {
        ctx.fillRect(x, facadeBottom - ts * 0.20, ts * 0.60, ts * 0.06);
      }
      ctx.strokeStyle = '#342e29'; ctx.lineWidth = Math.max(0.8, ts * 0.022);
      for (let x = facadeLeft + ts * 0.52; x < facadeRight; x += ts * 0.72) {
        ctx.beginPath(); ctx.moveTo(x, facadeBottom - ts * 0.22); ctx.lineTo(x, facadeBottom); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(198,181,157,0.38)';
      ctx.fillRect(facadeLeft, facadeBottom - ts * 0.22, facadeRight - facadeLeft, ts * 0.035);

      // Offset beam shadows put the timber frame physically in front of the
      // plaster rather than painting brown lines directly onto it.
      ctx.fillStyle = 'rgba(29,17,10,0.42)';
      ctx.fillRect(facadeLeft + ts * 0.07, facadeTop + ts * 0.08,
        facadeRight - facadeLeft, ts * 0.16);
      ctx.fillRect(facadeLeft + ts * 0.07, facadeBottom - ts * 0.24,
        facadeRight - facadeLeft, ts * 0.14);
      ctx.fillRect(facadeLeft + ts * 0.07, facadeTop + ts * 0.08, ts * 0.16, facadeH);
      ctx.fillRect(facadeRight - ts * 0.09, facadeTop + ts * 0.08, ts * 0.16, facadeH);

      // Continuous beams and end posts make the face read as one structure, not
      // a row of separate tile squares.
      ctx.fillStyle = '#422719';
      ctx.fillRect(facadeLeft, facadeTop, facadeRight - facadeLeft, ts * 0.16);
      ctx.fillRect(facadeLeft, facadeBottom - ts * 0.31, facadeRight - facadeLeft, ts * 0.14);
      ctx.fillRect(facadeLeft, facadeTop, ts * 0.16, facadeH);
      ctx.fillRect(facadeRight - ts * 0.16, facadeTop, ts * 0.16, facadeH);
      for (const x of [centreX - width * 0.30, centreX + width * 0.30]) {
        ctx.fillRect(x - ts * 0.06, facadeTop + ts * 0.08, ts * 0.12, facadeH - ts * 0.34);
      }

      // Four diagonal braces make the timber frame structural and break the long
      // horizontal frontage into readable bays.
      const leftWindowX = centreX - width * 0.25;
      const rightWindowX = centreX + width * 0.25;
      const braceTop = facadeTop + ts * 0.24;
      const braceBottom = facadeBottom - ts * 0.36;
      ctx.strokeStyle = '#57341f'; ctx.lineWidth = Math.max(2, ts * 0.10);
      ctx.lineCap = 'square';
      const braces = [
        [facadeLeft + ts * 0.18, braceBottom, leftWindowX - ts * 0.62, braceTop],
        [leftWindowX + ts * 0.62, braceTop, centreX - ts * 0.68, braceBottom],
        [centreX + ts * 0.68, braceBottom, rightWindowX - ts * 0.62, braceTop],
        [rightWindowX + ts * 0.62, braceTop, facadeRight - ts * 0.18, braceBottom],
      ];
      for (const [x1,y1,x2,y2] of braces) {
        ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
        ctx.strokeStyle = 'rgba(202,139,77,0.32)'; ctx.lineWidth = Math.max(0.8, ts * 0.025);
        ctx.beginPath();
        ctx.moveTo(x1 - ts * 0.025, y1 - ts * 0.025);
        ctx.lineTo(x2 - ts * 0.025, y2 - ts * 0.025);
        ctx.stroke();
        ctx.strokeStyle = '#57341f'; ctx.lineWidth = Math.max(2, ts * 0.10);
      }
      ctx.lineCap = 'butt';

      const drawFacadeWindow = (cx) => {
        const wx = cx - ts * 0.54, wy = facadeTop + ts * 0.46;
        // Carve a dark opening first, then build four visible reveal planes
        // around the glass. This reads as a deep window niche at game scale.
        ctx.fillStyle = '#25170f';
        ctx.fillRect(wx - ts * 0.14, wy - ts * 0.14, ts * 1.36, ts * 1.04);
        ctx.fillStyle = '#d1b27d';
        ctx.beginPath();
        ctx.moveTo(wx - ts * 0.14, wy - ts * 0.14);
        ctx.lineTo(wx + ts * 1.22, wy - ts * 0.14);
        ctx.lineTo(wx + ts * 1.08, wy);
        ctx.lineTo(wx, wy); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#6b482e';
        ctx.beginPath();
        ctx.moveTo(wx + ts * 1.08, wy);
        ctx.lineTo(wx + ts * 1.22, wy - ts * 0.14);
        ctx.lineTo(wx + ts * 1.22, wy + ts * 0.90);
        ctx.lineTo(wx + ts * 1.08, wy + ts * 0.76); ctx.closePath(); ctx.fill();
        const pane = ctx.createLinearGradient(wx, wy, wx + ts * 1.08, wy + ts * 0.76);
        pane.addColorStop(0, '#9ed3a1'); pane.addColorStop(0.48, '#4f8d72'); pane.addColorStop(1, '#274b46');
        ctx.fillStyle = pane; ctx.fillRect(wx, wy, ts * 1.08, ts * 0.76);
        ctx.strokeStyle = '#d6aa61'; ctx.lineWidth = Math.max(1, ts * 0.035);
        ctx.beginPath();
        ctx.moveTo(cx, wy); ctx.lineTo(cx, wy + ts * 0.76);
        ctx.moveTo(wx, wy + ts * 0.38); ctx.lineTo(wx + ts * 1.08, wy + ts * 0.38); ctx.stroke();
        ctx.fillStyle = 'rgba(239,255,211,0.55)';
        ctx.fillRect(wx + ts * 0.07, wy + ts * 0.06, ts * 0.24, ts * 0.06);
        // Projecting sill and flower box bring the windows forward from the wall.
        ctx.fillStyle = '#4a2c1b'; ctx.fillRect(wx - ts * 0.13, wy + ts * 0.76, ts * 1.34, ts * 0.13);
        ctx.fillStyle = '#704224'; ctx.fillRect(wx - ts * 0.04, wy + ts * 0.86, ts * 1.16, ts * 0.22);
        ctx.fillStyle = '#3f5f2e';
        for (const dx of [0.10,0.32,0.54,0.76,0.98]) {
          ctx.beginPath(); ctx.arc(wx + ts * dx, wy + ts * 0.84, ts * 0.10, 0, Math.PI * 2); ctx.fill();
        }
        for (const [dx,color] of [[0.18,'#f2cf55'],[0.49,'#e86d6d'],[0.82,'#eee4a0']]) {
          ctx.fillStyle = color; ctx.beginPath(); ctx.arc(wx + ts * dx, wy + ts * 0.78, ts * 0.045, 0, Math.PI * 2); ctx.fill();
        }
      };
      drawFacadeWindow(leftWindowX);
      drawFacadeWindow(rightWindowX);

      const doorW = ts * 0.88;
      const doorX = centreX - doorW / 2;
      const doorY = facadeTop + ts * 0.23;
      const doorH = facadeBottom - doorY - ts * 0.23;
      // Deep jamb and header reveal put the door behind the facade plane.
      ctx.fillStyle = '#21140d';
      ctx.fillRect(doorX - ts * 0.18, doorY - ts * 0.16, doorW + ts * 0.36, doorH + ts * 0.16);
      ctx.fillStyle = '#b48b59';
      ctx.beginPath();
      ctx.moveTo(doorX - ts * 0.18, doorY - ts * 0.16);
      ctx.lineTo(doorX + doorW + ts * 0.18, doorY - ts * 0.16);
      ctx.lineTo(doorX + doorW, doorY);
      ctx.lineTo(doorX, doorY); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#5d3d28';
      ctx.beginPath();
      ctx.moveTo(doorX + doorW, doorY);
      ctx.lineTo(doorX + doorW + ts * 0.18, doorY - ts * 0.16);
      ctx.lineTo(doorX + doorW + ts * 0.18, doorY + doorH);
      ctx.lineTo(doorX + doorW, doorY + doorH); ctx.closePath(); ctx.fill();
      const doorFace = ctx.createLinearGradient(doorX, doorY, doorX + doorW, doorY + doorH);
      doorFace.addColorStop(0, '#966039'); doorFace.addColorStop(1, '#55321f');
      ctx.fillStyle = doorFace; ctx.fillRect(doorX, doorY, doorW, doorH);
      ctx.strokeStyle = '#3d2417'; ctx.lineWidth = Math.max(1, ts * 0.04);
      ctx.strokeRect(doorX + ts * 0.12, doorY + ts * 0.12, doorW - ts * 0.24, doorH * 0.30);
      ctx.strokeRect(doorX + ts * 0.12, doorY + doorH * 0.52, doorW - ts * 0.24, doorH * 0.32);
      // Blacksmith-made strap hinges and nail heads give the door real hardware.
      ctx.fillStyle = '#292727';
      for (const fy of [0.20,0.67]) {
        ctx.fillRect(doorX + ts * 0.04, doorY + doorH * fy, doorW * 0.52, ts * 0.075);
        ctx.beginPath(); ctx.arc(doorX + ts * 0.13, doorY + doorH * fy + ts * 0.037, ts * 0.025, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(doorX + doorW * 0.46, doorY + doorH * fy + ts * 0.037, ts * 0.025, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#d6a84f';
      ctx.beginPath(); ctx.arc(doorX + doorW * 0.76, doorY + doorH * 0.54, ts * 0.055, 0, Math.PI * 2); ctx.fill();
      // Projecting threshold: light top plane, dark front riser and ground shadow.
      ctx.fillStyle = 'rgba(24,14,9,0.48)';
      ctx.fillRect(doorX - ts * 0.28, doorY + doorH + ts * 0.12, doorW + ts * 0.56, ts * 0.18);
      ctx.fillStyle = '#8b765e';
      ctx.beginPath();
      ctx.moveTo(doorX - ts * 0.18, doorY + doorH);
      ctx.lineTo(doorX + doorW + ts * 0.18, doorY + doorH);
      ctx.lineTo(doorX + doorW + ts * 0.30, doorY + doorH + ts * 0.14);
      ctx.lineTo(doorX - ts * 0.30, doorY + doorH + ts * 0.14);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#4f4438';
      ctx.fillRect(doorX - ts * 0.30, doorY + doorH + ts * 0.14,
        doorW + ts * 0.60, ts * 0.11);

      const drawEntryLantern = (lx) => {
        const ly = facadeTop + ts * 0.83;
        const glow = ctx.createRadialGradient(lx, ly, ts * 0.04, lx, ly, ts * 0.72);
        glow.addColorStop(0, 'rgba(255,205,99,0.32)'); glow.addColorStop(1, 'rgba(255,164,55,0)');
        ctx.fillStyle = glow; ctx.fillRect(lx - ts * 0.72, ly - ts * 0.72, ts * 1.44, ts * 1.44);
        ctx.strokeStyle = '#2d261f'; ctx.lineWidth = Math.max(1.2, ts * 0.045);
        ctx.beginPath(); ctx.moveTo(lx, ly - ts * 0.32); ctx.lineTo(lx, ly - ts * 0.16); ctx.stroke();
        ctx.fillStyle = '#342b22'; ctx.fillRect(lx - ts * 0.12, ly - ts * 0.16, ts * 0.24, ts * 0.38);
        ctx.fillStyle = '#ffc45f'; ctx.fillRect(lx - ts * 0.065, ly - ts * 0.09, ts * 0.13, ts * 0.20);
        ctx.fillStyle = '#1f1b17'; ctx.fillRect(lx - ts * 0.16, ly + ts * 0.20, ts * 0.32, ts * 0.07);
      };
      drawEntryLantern(centreX - ts * 0.82);
      drawEntryLantern(centreX + ts * 0.82);

      // A visible soffit, exposed rafter tails, and fascia turn the roof edge into
      // a thick overhang rather than a single line at the top of the wall.
      ctx.fillStyle = '#26180f';
      ctx.beginPath();
      ctx.moveTo(left + ts * 0.18, roofBottom - ts * 0.16);
      ctx.lineTo(right - ts * 0.18, roofBottom - ts * 0.16);
      ctx.lineTo(right - ts * 0.36, roofBottom + ts * 0.20);
      ctx.lineTo(left + ts * 0.36, roofBottom + ts * 0.20);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#5b3822';
      for (let x = left + ts * 0.48; x < right - ts * 0.38; x += ts * 0.72) {
        ctx.fillRect(x, roofBottom + ts * 0.02, ts * 0.14, ts * 0.28);
      }
      ctx.fillStyle = '#3a2417'; ctx.fillRect(left + ts * 0.18, roofBottom - ts * 0.18, width - ts * 0.36, ts * 0.22);
      ctx.fillStyle = '#bd8150'; ctx.fillRect(left + ts * 0.26, roofBottom - ts * 0.18, width - ts * 0.52, ts * 0.055);
    }

    // Generic cottages retain their small front gable. The larger family house
    // uses a clean, uninterrupted eave above the door.
    if (!familyHome) {
      const gableHalf = Math.min(ts * 1.45, width * 0.22);
      const gablePeakY = ridgeY - ts * 0.10;
      const gableBaseY = bottom + ts * 0.12;
      ctx.beginPath();
      ctx.moveTo(centreX, gablePeakY);
      ctx.lineTo(centreX + gableHalf, gableBaseY);
      ctx.lineTo(centreX - gableHalf, gableBaseY);
      ctx.closePath();
      ctx.fillStyle = '#7c3828'; ctx.fill();
      ctx.strokeStyle = roofEdge; ctx.stroke();
      ctx.strokeStyle = '#c78452'; ctx.lineWidth = Math.max(1.5, ts * 0.06);
      ctx.beginPath();
      ctx.moveTo(centreX, gablePeakY + ts * 0.14);
      ctx.lineTo(centreX, gableBaseY - ts * 0.10);
      ctx.stroke();
    }

    // Chimney and a restrained patch of moss tie the cottages to the forest.
    const chimneyX = right - ts * (1.35 + (seed % 3) * 0.18);
    if (familyHome) {
      // Anchor the stack to the visible south slope. The enlarged family roof's
      // north edge can sit above the camera while the player approaches.
      const chimneyY = roofBottom - ts * 1.65;
      const chimneyW = ts * 0.72;
      const chimneyH = ts * 1.08;
      const sideW = ts * 0.22;

      // Long roof shadow anchors the stack and establishes its height above the
      // shingles before any masonry is drawn.
      ctx.fillStyle = 'rgba(27,17,11,0.34)';
      ctx.beginPath();
      ctx.moveTo(chimneyX + ts * 0.10, chimneyY + chimneyH * 0.72);
      ctx.lineTo(chimneyX + chimneyW + sideW, chimneyY + chimneyH * 0.58);
      ctx.lineTo(chimneyX + chimneyW + ts * 1.12, chimneyY + chimneyH + ts * 0.38);
      ctx.lineTo(chimneyX + ts * 0.48, chimneyY + chimneyH + ts * 0.44);
      ctx.closePath(); ctx.fill();

      // Warm front face with a darker east side creates a compact masonry block.
      const chimneyFace = ctx.createLinearGradient(chimneyX, chimneyY,
        chimneyX + chimneyW, chimneyY + chimneyH);
      chimneyFace.addColorStop(0, '#927765');
      chimneyFace.addColorStop(1, '#5d493d');
      ctx.fillStyle = chimneyFace;
      ctx.fillRect(chimneyX, chimneyY, chimneyW, chimneyH);
      ctx.fillStyle = '#44352e';
      ctx.beginPath();
      ctx.moveTo(chimneyX + chimneyW, chimneyY);
      ctx.lineTo(chimneyX + chimneyW + sideW, chimneyY - ts * 0.10);
      ctx.lineTo(chimneyX + chimneyW + sideW, chimneyY + chimneyH - ts * 0.10);
      ctx.lineTo(chimneyX + chimneyW, chimneyY + chimneyH);
      ctx.closePath(); ctx.fill();

      // Offset mortar courses wrap from the lit face onto the side plane.
      ctx.strokeStyle = 'rgba(49,37,31,0.68)';
      ctx.lineWidth = Math.max(0.8, ts * 0.025);
      for (const f of [0.27, 0.56, 0.84]) {
        const mortarY = chimneyY + chimneyH * f;
        ctx.beginPath();
        ctx.moveTo(chimneyX, mortarY);
        ctx.lineTo(chimneyX + chimneyW, mortarY);
        ctx.lineTo(chimneyX + chimneyW + sideW, mortarY - ts * 0.10);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(chimneyX + chimneyW * 0.48, chimneyY);
      ctx.lineTo(chimneyX + chimneyW * 0.48, chimneyY + chimneyH * 0.27);
      ctx.moveTo(chimneyX + chimneyW * 0.24, chimneyY + chimneyH * 0.27);
      ctx.lineTo(chimneyX + chimneyW * 0.24, chimneyY + chimneyH * 0.56);
      ctx.moveTo(chimneyX + chimneyW * 0.68, chimneyY + chimneyH * 0.56);
      ctx.lineTo(chimneyX + chimneyW * 0.68, chimneyY + chimneyH * 0.84);
      ctx.stroke();

      // The cap has separate top and front planes plus a dark flue opening.
      const capLeft = chimneyX - ts * 0.10;
      const capRight = chimneyX + chimneyW + ts * 0.11;
      const capY = chimneyY - ts * 0.09;
      ctx.fillStyle = '#332821';
      ctx.fillRect(capLeft, capY + ts * 0.10, capRight - capLeft, ts * 0.16);
      ctx.fillStyle = '#806a59';
      ctx.beginPath();
      ctx.moveTo(capLeft, capY + ts * 0.10);
      ctx.lineTo(capRight, capY + ts * 0.10);
      ctx.lineTo(capRight + sideW, capY);
      ctx.lineTo(capLeft + sideW, capY);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#211b17';
      ctx.beginPath();
      ctx.ellipse(chimneyX + chimneyW * 0.58 + sideW * 0.35,
        capY + ts * 0.055, ts * 0.20, ts * 0.075, -0.12, 0, Math.PI * 2);
      ctx.fill();
      // Two soft smoke wisps lift away from the opening and reinforce the
      // chimney's vertical silhouette without becoming a large particle effect.
      ctx.fillStyle = 'rgba(207,205,193,0.22)';
      ctx.beginPath();
      ctx.ellipse(chimneyX + chimneyW * 0.48, capY - ts * 0.20,
        ts * 0.15, ts * 0.10, -0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(207,205,193,0.12)';
      ctx.beginPath();
      ctx.ellipse(chimneyX + chimneyW * 0.35, capY - ts * 0.43,
        ts * 0.22, ts * 0.13, -0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(210,179,145,0.48)';
      ctx.lineWidth = Math.max(0.8, ts * 0.025);
      ctx.beginPath();
      ctx.moveTo(chimneyX + ts * 0.02, chimneyY + ts * 0.02);
      ctx.lineTo(chimneyX + ts * 0.02, chimneyY + chimneyH - ts * 0.03);
      ctx.stroke();

      // Small timber stoop beneath the entrance, like the concept cottages.
      ctx.fillStyle = 'rgba(31,18,10,0.45)';
      ctx.fillRect(centreX - ts * 0.72 + ts * 0.08, bottom + ts * 0.04, ts * 1.44, ts * 0.36);
      ctx.fillStyle = '#8b5a32'; ctx.fillRect(centreX - ts * 0.72, bottom, ts * 1.44, ts * 0.18);
      ctx.fillStyle = '#6b4025'; ctx.fillRect(centreX - ts * 0.58, bottom + ts * 0.18, ts * 1.16, ts * 0.17);
      ctx.strokeStyle = '#d19a5c'; ctx.lineWidth = Math.max(1, ts * 0.035);
      ctx.beginPath(); ctx.moveTo(centreX - ts * 0.68, bottom + ts * 0.04); ctx.lineTo(centreX + ts * 0.68, bottom + ts * 0.04); ctx.stroke();
    } else {
      ctx.fillStyle = '#59473f';
      ctx.fillRect(chimneyX, top + ts * 0.55, ts * 0.55, ts * 0.82);
      ctx.fillStyle = '#2f2522';
      ctx.fillRect(chimneyX - ts * 0.08, top + ts * 0.48, ts * 0.71, ts * 0.18);
    }
    ctx.fillStyle = 'rgba(73,105,49,0.64)';
    ctx.beginPath(); ctx.ellipse(left + width * 0.24, ridgeY - ts * 0.18,
      ts * 0.72, ts * 0.26, -0.15, 0, Math.PI * 2); ctx.fill();

    // Read the live door tile instead of caching it with the footprint. Forest
    // villages assign their four shop types after the base map is generated.
    drawForestShopSign(mapObj.map[h.r2][h.doorC], centreX, bottom, ts);
    ctx.restore();
  }
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

  // Cinematic state (shake decay, this frame's jolt offset) — see the block near
  // updateStormFlash. The shake is applied as a canvas translate rather than by
  // moving camC/camR, so it can't fight clampCam or leak into tile culling.
  updateCinematics(Date.now());
  ctx.save();
  if (_shakeX || _shakeY) ctx.translate(_shakeX, _shakeY);

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

  // The blight, laid over the finished tile pass (corruption.js). Here rather
  // than inside drawTile because it is a property of the *place*, not of any
  // tile type — it has to shift grass, sand and cobble alike, and it must not
  // poison the tile sprite cache, which is keyed on tile type alone.
  if (typeof drawCorruptionOverlay === 'function') {
    drawCorruptionOverlay(ts, startC, startR, endC, endR);
  }

  // Whirlpool suction overlays — after the tile pass so the churn spills over
  // the surrounding 3×3 of water instead of being overdrawn by neighbors.
  const whirlpools = mapFeatureTiles(mapObj, T.WHIRLPOOL, '_whirlpools');
  for (let i = 0; i < whirlpools.length; i += 2) {
    const mc = whirlpools[i], mr = whirlpools[i + 1];
    if (mc >= startC && mc <= endC && mr >= startR && mr <= endR) drawWhirlpoolSuction(mc, mr, ts);
  }

  if (typeof drawShrineOverlays === 'function') drawShrineOverlays(ts);

  // Architectural depth for the single Elderbrook family-home pilot. It sits
  // over the flat tile pass but under actors and the removable roof layer.
  drawElderbrookFamilyHomeDepth(mapObj, ts);

  // Entities. On the 2.5D pilot they are merged with the tall tiles into one
  // back-to-front order (see drawDepthLayer, which also draws the extrusions,
  // colossal trees and big landmarks that the passes below still handle for
  // every other map). Everywhere else this is the fixed order it has always
  // been, which is what makes "nothing else changes" structural.
  //
  // Worth being explicit, because it is a shipped feel that this ends: the
  // player is no longer unconditionally on top. He stays on top within his own
  // row, but a wall one row south of him now covers him.
  if (isObliqueMap(mapObj)) {
    drawDepthLayer(mapObj, map, ts, startC, startR, endC, endR);
  } else {
    drops.forEach(d => drawDrop(d, ts));
    projectiles.forEach(p => drawProjectile(p));
    for (const e of enemies) {
      if (e.dead) continue;
      drawEnemy(e, ts);
    }
    if (typeof villagers !== 'undefined') {
      villagers.forEach(v => drawVillager(v, ts));
    }
    drawPlayer(ts);
  }

  // Intact forest roofs are a foreground layer: they hide indoor activity from
  // outside, then disappear for the one cottage the player has entered.
  drawForestVillageRoofs(mapObj, ts, startC, startR, endC, endR);

  // The Emperor's crown, rolling to the hero's feet and then lying there. After
  // the entities because it comes to rest against the player's boot and has to
  // be seen doing it (see rollEmperorCrown, tower.js).
  if (typeof drawEmperorCrown === 'function') drawEmperorCrown(ts);

  // Where the errand is pointing. After the entities so a villager standing on
  // the spot can't paint over their own marker.
  if (typeof drawPrologueObjective === 'function') drawPrologueObjective(ts);

  // Beat 3's ambient shift. Wind blows across everything at ground level; the
  // birds are above the rooftops, so both sit above the entities and below the
  // Emperor, who is higher than either.
  if (typeof drawPrologueWind === 'function') drawPrologueWind(ts);
  if (typeof drawPrologueBirds === 'function') drawPrologueBirds(ts);

  // The breath sweeps over the ground and everyone standing on it, but under the
  // Emperor himself — it is coming out of him.
  if (typeof drawPrologueBreath === 'function') drawPrologueBreath(ts);

  // The Emperor — after every ground entity, because he is in the sky above all
  // of them, and before the canopy pass so a tree can still occlude him.
  drawPrologueEmperor(ts);

  // Extruded walls — the 2.5D pilot. Joins the existing family of "tall things
  // drawn after the entity pass" below, which is where a thing an actor can
  // stand behind has always gone. Ordering these tall passes against each other,
  // and against the actors, is the depth merge in Phase 4; this one only has to
  // stand up.
  //
  // Per-map, so every other map in the game renders exactly as before. The list
  // is the same memoized per-map scan the colossal trees use.
  //
  // Culled one tile wide and, crucially, well below the viewport: a wall lifted
  // 1.6 tiles up the screen is drawn from an anchor that can sit off the bottom
  // edge while its cap is still plainly in view.
  // Both wall types, because Elderbrook is two villages. The intact one the
  // prologue plays in is built from 443 T.WALL; every post-prologue save sits in
  // the ruin, which has none of those and 1606 T.BURNT_WALL instead. Extruding
  // only T.WALL stood up a village the player sees once.
  //
  // Colossal-tree canopies — drawn AFTER the entities (drops, enemies, villagers,
  // player) so the player and enemies pass BEHIND the overhanging canopy, and after
  // the tile grid so neighbours can't overdraw the giant. The scan range is widened
  // a few tiles below / either side of the viewport so a giant whose anchor sits just
  // off-screen still pokes its canopy into view.
  //
  // This pass, and the landmark pass below it, are the FLAT renderer's version of
  // depth: tall things drawn after every actor, unconditionally. On the pilot map
  // both are folded into drawDepthLayer instead, along with the extrusions, so a
  // hero south of a giant is now in front of it rather than always behind it.
  if (!isObliqueMap(mapObj)) {
  const colossalTrees = mapFeatureTiles(mapObj, T.COLOSSAL_TREE, '_colossalTrees');
  for (let i = 0; i < colossalTrees.length; i += 2) {
    const mc = colossalTrees[i], mr = colossalTrees[i + 1];
    if (mc >= startC - 3 && mc <= endC + 3 && mr >= startR - 1 && mr <= endR + 4)
      drawColossalTree(mc, mr, ts);
  }

  // Enlarged region landmarks — the elemental / non-forest regions' answer to the
  // colossal trees, given the same after-entities overlay treatment. Scan range is
  // widened a few tiles (a giant whose foot sits just off-screen still overhangs into
  // view).
  const bigLandmarks = mapBigLandmarkTiles(mapObj);
  for (let i = 0; i < bigLandmarks.length; i += 2) {
    const mc = bigLandmarks[i], mr = bigLandmarks[i + 1];
    if (mc >= startC - 3 && mc <= endC + 3 && mr >= startR - 2 && mr <= endR + 4)
      drawBigLandmark(map[mr][mc], mc, mr, ts);
  }

  // Ledges stand up on EVERY map, not just the 2.5D pilot.
  //
  // Walls extrude only on the pilot, and that is right: a flat wall still reads
  // as a wall, so leaving it flat elsewhere costs nothing. A ledge is different
  // in kind. Its height is not decoration, it is the gameplay: surfaceZ and the
  // step-up gate apply on every map, so a shelf drawn flat would be an invisible
  // wall to walk into and would draw the hero standing a full tile above ground
  // that looks level. The feature has to be visible wherever it works.
  //
  // Costs nothing on the 100+ maps that have no ledges: the scan is memoized per
  // map and comes back empty, so this loop does not execute.
  const ledges = mapLedgeTiles(mapObj);
  for (let i = 0; i < ledges.length; i += 2) {
    const mc = ledges[i], mr = ledges[i + 1];
    if (mc >= startC - 1 && mc <= endC + 1 && mr >= startR - 1 && mr <= endR + 3)
      drawTileExtrusion(map, mc, mr, ts);
  }
  }   // end of the flat renderer's tall passes

  // Lightning-region storm flash — over the world, under the HUD/minimap.
  drawStormFlash();

  // Particles
  ctx.save();
  particles.forEach(p => {
    // p.fade is the lifetime at which a particle is fully opaque; long-lived
    // embers set their own so they don't sit pinned at alpha 1 for a second.
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life / (p.fade || 50)));
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

  // Burning-village wash and ashfall — over the world and its particles, under
  // the HUD. Wash first so the ash reads as pale grey against the orange.
  drawFireWash();
  drawAshfall();

  // End of the shaken world layer. Everything below is screen furniture and must
  // stay nailed down while the ground rocks.
  ctx.restore();

  if (viewMode === 2) drawFullMinimap();
  else if (showMinimap) drawMinimap();

  // Touch movement pad — over the world, under the radial menu (it hides itself
  // while the menu is up anyway).
  drawTouchJoystick();

  // Radial inventory menu — drawn last so it's always on top
  if (typeof drawRadialMenu === 'function') drawRadialMenu();

  // Cinematic bars, then the black curtain — over absolutely everything,
  // including the HUD and the radial menu. A fade that leaves UI floating on
  // top isn't a fade.
  drawLetterbox();
  drawFadeOverlay();
}

// The movement pad: a base ring anchored in the bottom-left corner of the canvas
// with a knob that tracks the thumb (clamped to the ring edge). Always on screen
// in touch mode, dimmed until it's being held — how far the knob sits from the
// centre is also the walking pace, so the drawing doubles as the speed readout.
// State and geometry live in main.js (touchJoystick / joyHome / joyPadVisible).
function drawTouchJoystick() {
  if (typeof joyPadVisible !== 'function' || !joyPadVisible()) return;
  const j = touchJoystick, h = joyHome();
  if (j.active) drawJoystickRing(h.x, h.y, j.x, j.y, 1);
  else          drawJoystickRing(h.x, h.y, h.x, h.y, 0.5);
}

// The stick at (cx,cy) with its knob pulled toward (fx,fy); `alpha` fades the
// whole control so the same drawing serves both the resting and held states.
function drawJoystickRing(cx, cy, fx, fy, alpha) {
  const R = 46;
  ctx.save();
  ctx.globalAlpha = alpha;
  // Base ring
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(20, 40, 20, 0.28)';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(170, 255, 120, 0.5)';
  ctx.stroke();
  // Knob — offset toward the finger, capped at the ring edge
  let dx = fx - cx, dy = fy - cy;
  const d = Math.hypot(dx, dy);
  if (d > R) { dx = dx / d * R; dy = dy / d * R; }
  ctx.beginPath(); ctx.arc(cx + dx, cy + dy, 20, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(170, 255, 120, 0.85)';
  ctx.fill();
  ctx.restore();
}
