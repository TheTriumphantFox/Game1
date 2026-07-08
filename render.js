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

// Each tile type has a base color (from TILE_COLORS) and a switch case below
// that adds visual detail. `s` is the tile size in pixels (== TILE_PX).
//
// This is the procedural path: it issues the tile's raw canvas calls. For pure
// tiles it's invoked once by buildTileSprite to populate the cache; the thin
// drawTile() wrapper above blits that cache thereafter. Animated / hashed /
// autotiled / stateful tiles reach here every frame.
function drawTileProcedural(col, row, t, sx, sy, s) {
  const x = sx, y = sy;
  ctx.fillStyle = TILE_COLORS[t] || '#111';
  ctx.fillRect(x, y, s, s);

  switch (t) {
    case T.GRASS:
      ctx.fillStyle = '#3d7530'; ctx.fillRect(x+2,y+3,4,2); ctx.fillRect(x+s-6,y+s-5,4,2);
      ctx.fillStyle = '#5a9a4a'; ctx.fillRect(x+s/2,y+s/2-2,3,3); break;
    case T.TREE: {
      ctx.fillStyle = '#0d2a0d'; ctx.fillRect(x,y,s,s);
      ctx.fillStyle = '#2d6a1a'; ctx.beginPath(); ctx.arc(x+s/2,y+s/2+2,s*0.38,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#3a8a22'; ctx.beginPath(); ctx.arc(x+s/2-2,y+s/2-2,s*0.26,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#4aaa2a'; ctx.beginPath(); ctx.arc(x+s/2+1,y+s/2-4,s*0.18,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#5a6a40'; ctx.fillRect(x+s/2-2,y+s-4,4,4); break; }
    case T.WATER: {
      // Subtle wave animation
      const w = Math.sin(Date.now()/600 + col*0.5 + row*0.3);
      ctx.fillStyle = '#3366cc'; ctx.fillRect(x+2,y+s*0.3+w*2,s*0.4,3);
      ctx.fillStyle = '#4488ee'; ctx.fillRect(x+s*0.5,y+s*0.6-w*2,s*0.35,2); break; }
    case T.DEEP_WATER: {
      // Deep open sea — layered swells drifting at different phases give a
      // restless surface, a darker trough across the lower half adds a sense of
      // depth, and occasional bright glints twinkle across the water so it never
      // reads as a flat block.
      const tt = Date.now() / 700;
      const a = Math.sin(tt + col * 0.45 + row * 0.30);
      const b = Math.sin(tt * 1.3 - col * 0.30 + row * 0.50 + 1.7);
      // Darker deep trough hugging the lower half.
      ctx.fillStyle = '#0c1a4a'; ctx.fillRect(x, y + s * 0.55, s, s * 0.45);
      // Two drifting swell highlights in different blues and phases.
      ctx.fillStyle = '#23459a'; ctx.fillRect(x + 1, y + s * 0.32 + a * 2.5, s - 2, 3);
      ctx.fillStyle = '#3a66c4'; ctx.fillRect(x + s * 0.35, y + s * 0.62 + b * 2.5, s * 0.55, 2);
      // Foam/glint flecks — twinkle in via a fast per-tile phase.
      const g = Math.sin(tt * 2.1 + col * 1.7 + row * 1.1);
      if (g > 0.8) {
        ctx.fillStyle = 'rgba(190,215,255,0.9)';
        ctx.fillRect(x + s * 0.30, y + s * 0.28 + a, 2, 2);
        ctx.fillRect(x + s * 0.62, y + s * 0.50 + b, 1, 1);
      }
      break; }
    case T.MEDIUM_WATER: {
      // Mid-depth shelf: darker than the shallows, lighter than the deep, with a
      // single slow ripple so it still reads as moving water.
      const mw = Math.sin(Date.now()/650 + col*0.4 + row*0.35);
      ctx.fillStyle = '#3f79ad'; ctx.fillRect(x+2, y+s*0.35+mw*2, s*0.5, 2);
      ctx.fillStyle = '#214d7a'; ctx.fillRect(x+s*0.45, y+s*0.6-mw*2, s*0.4, 2); break; }
    case T.WHIRLPOOL: {
      // Swirling vortex set in the medium shelf — concentric funnel rings step
      // down into a dark central eye, three bright foam arms whip around them
      // at two depths, and the eye pulses as the vortex gulps water down. The
      // wider suction ring spilling over the neighboring tiles (the 1-tile
      // pull zone) is drawn as an overlay pass in render() — see
      // drawWhirlpoolSuction.
      const cx = x + s / 2, cy = y + s / 2;
      const rot = Date.now() / 150;             // fast, hungry churn
      const gulp = Math.sin(Date.now() / 320);  // eye pulse phase
      // Concentric funnel: light/dark rings stepping inward for a 3-D drain look.
      const rings = [[0.46, '#3f79ad'], [0.36, '#a9cdee'], [0.27, '#2c5d8e'],
                     [0.18, '#cfe4fa']];
      for (const [f, col] of rings) {
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(cx, cy, s * f, 0, Math.PI * 2); ctx.fill();
      }
      // Foam arms spiralling around the funnel — the inner set spins faster,
      // the way a real vortex accelerates toward its throat.
      ctx.strokeStyle = '#eaf4ff';
      for (let k = 0; k < 3; k++) {
        const ang = rot + k * (Math.PI * 2 / 3);
        ctx.lineWidth = Math.max(1, s * 0.07);
        ctx.beginPath(); ctx.arc(cx, cy, s * 0.34, ang, ang + Math.PI * 0.7); ctx.stroke();
        const ang2 = rot * 1.6 + k * (Math.PI * 2 / 3);
        ctx.lineWidth = Math.max(1, s * 0.05);
        ctx.beginPath(); ctx.arc(cx, cy, s * 0.22, ang2, ang2 + Math.PI * 0.5); ctx.stroke();
      }
      // Pulsing dark eye the funnel gulps through.
      ctx.fillStyle = '#06142a';
      ctx.beginPath(); ctx.arc(cx, cy, s * (0.10 + 0.035 * gulp), 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 1;
      break; }
    case T.SHALLOW_WATER: {
      // Wadeable channel: sandy base showing through tinted water + gentle ripples.
      ctx.fillStyle = '#5aa8c8'; ctx.fillRect(x, y, s, s);
      // Sandy bottom hint dappling through the water
      ctx.fillStyle = 'rgba(212,176,112,0.30)';
      ctx.fillRect(x+s*0.18, y+s*0.6, s*0.22, s*0.18);
      ctx.fillRect(x+s*0.6,  y+s*0.25, s*0.2,  s*0.16);
      // Ripple highlights (animated, phase per tile so they don't pulse in unison)
      const sw = Math.sin(Date.now()/500 + col*0.5 + row*0.4);
      ctx.fillStyle = '#9fd6e8'; ctx.fillRect(x+2, y+s*0.32+sw*2, s*0.45, 2);
      ctx.fillStyle = '#c8eef8'; ctx.fillRect(x+s*0.45, y+s*0.62-sw*2, s*0.32, 2);
      break; }
    case T.PATH:
      ctx.fillStyle = '#a08860'; ctx.fillRect(x+1,y+1,s-2,s-2);
      ctx.fillStyle = '#b09870'; ctx.fillRect(x+3,y+3,s-6,s-6); break;
    case T.WALL:
      ctx.fillStyle = '#555'; ctx.fillRect(x,y,s,s);
      ctx.fillStyle = '#333'; ctx.fillRect(x,y,s,2); ctx.fillRect(x,y,2,s);
      ctx.fillStyle = '#666'; ctx.fillRect(x+s-2,y,2,s); ctx.fillRect(x,y+s-2,s,2); break;
    case T.FLOOR:
      ctx.fillStyle = '#8a6540'; ctx.fillRect(x,y,s,2); ctx.fillRect(x,y,2,s);
      ctx.fillStyle = '#aa8560'; ctx.fillRect(x+s-2,y,2,s); break;
    case T.CHEST: {
      const opened = currentMap().openedChests.has(`${col},${row}`);
      if (!opened) {
        ctx.fillStyle = '#cc7700'; ctx.fillRect(x+3,y+s*0.3,s-6,s*0.6);
        ctx.fillStyle = '#ffaa00'; ctx.fillRect(x+3,y+s*0.22,s-6,s*0.2);
        ctx.fillStyle = '#ffdd00'; ctx.fillRect(x+s/2-2,y+s*0.3,4,5);
      } else {
        ctx.fillStyle = '#553300'; ctx.fillRect(x+3,y+s*0.45,s-6,s*0.4);
        ctx.fillStyle = '#774400'; ctx.fillRect(x+3,y+s*0.38,s-6,s*0.1);
      }
      break; }
    case T.DOOR:
      ctx.fillStyle = '#884acc'; ctx.fillRect(x+4,y+2,s-8,s-2);
      ctx.fillStyle = '#cc88ff'; ctx.fillRect(x+s/2-2,y+s/2-4,4,8); break;
    case T.ROCK:
      ctx.fillStyle = '#999'; ctx.beginPath(); ctx.arc(x+s/2,y+s/2,s*0.38,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#aaa'; ctx.beginPath(); ctx.arc(x+s/2-3,y+s/2-3,s*0.2,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#666'; ctx.beginPath(); ctx.arc(x+s/2+4,y+s/2+3,s*0.12,0,Math.PI*2); ctx.fill(); break;
    case T.MOUNTAIN: {
      // Rugged mountain rock — the earth region is carved out of MOUNTAIN, so its
      // walls ARE the mountainsides. Craggy brown-grey faceting (lit upper-left,
      // shadowed lower-right, a jagged fault and a mineral glint), plus a pale
      // rocky/snow cap on any top edge that faces open ground so the crests catch
      // the light like peaks (brighter where a side is open too — an exposed summit).
      // Hashed per tile so the range reads as living rock, not a tiled grid.
      const M = mapData();
      const isMtn = (rr, cc) =>
        (rr < 0 || cc < 0 || rr >= MROWS || cc >= MCOLS) ? true : M[rr][cc] === T.MOUNTAIN;
      const h = (col * 131 + row * 83);
      const j = (a, n) => (((h >> a) & 3) / 3) * n;
      ctx.fillStyle = '#4a4035'; ctx.fillRect(x, y, s, s);            // base rock
      ctx.fillStyle = '#655849';                                       // lit facet (upper-left)
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + s*(0.58 + j(0,0.14)), y);
      ctx.lineTo(x + s*(0.30 + j(2,0.12)), y + s*(0.52 + j(4,0.10)));
      ctx.lineTo(x, y + s*(0.58 + j(6,0.10)));
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#2f2820';                                       // shadowed recess (lower-right)
      ctx.beginPath();
      ctx.moveTo(x + s, y + s*(0.30 + j(0,0.12)));
      ctx.lineTo(x + s, y + s);
      ctx.lineTo(x + s*(0.40 + j(2,0.12)), y + s);
      ctx.lineTo(x + s*(0.64 + j(4,0.08)), y + s*0.50);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#241d16'; ctx.lineWidth = 1.5;                // jagged fault line
      ctx.beginPath();
      ctx.moveTo(x + s*(0.44 + j(8,0.12)), y);
      ctx.lineTo(x + s*(0.54 + j(6,0.10)), y + s*0.50);
      ctx.lineTo(x + s*(0.42 + j(4,0.12)), y + s);
      ctx.stroke();
      ctx.fillStyle = '#8a7d68';                                       // mineral glint
      ctx.fillRect(x + s*0.22 + (h & 7), y + s*0.30, 2, 2);
      if (!isMtn(row - 1, col)) {                                      // crest cap toward open sky
        const summit = !isMtn(row, col - 1) || !isMtn(row, col + 1);
        ctx.fillStyle = summit ? 'rgba(234,238,244,0.88)' : 'rgba(200,192,178,0.82)';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + s, y);
        ctx.lineTo(x + s*(0.72 + j(2,0.10)), y + s*(0.22 + j(4,0.08)));
        ctx.lineTo(x + s*(0.34 + j(6,0.10)), y + s*(0.16 + j(8,0.08)));
        ctx.closePath(); ctx.fill();
      }
      ctx.lineWidth = 1;
      break; }
    case T.MUD: {
      // Wet mud churned into the mountain trails — darker than the dirt PATH, with
      // a glossy puddle and a couple of embedded pebbles. Static per tile (no anim).
      const h = (col * 67 + row * 97);
      ctx.fillStyle = '#5a3a18'; ctx.fillRect(x, y, s, s);            // mud base
      ctx.fillStyle = '#492f13';                                       // darker churned patches
      ctx.fillRect(x + s*0.12, y + s*0.50, s*0.40, s*0.34);
      ctx.fillRect(x + s*0.52, y + s*0.16, s*0.32, s*0.26);
      ctx.fillStyle = 'rgba(120,140,150,0.28)';                        // puddle sheen
      ctx.beginPath();
      ctx.ellipse(x + s*0.36, y + s*0.62, s*0.18, s*0.10, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = '#7a6a55'; ctx.fillRect(x + s*0.66 + (h & 3), y + s*0.66, 2, 2);  // pebbles
      ctx.fillStyle = '#6a5a45'; ctx.fillRect(x + s*0.22, y + s*0.26 + (h & 3), 2, 2);
      break; }
    case T.SCREE: {
      // Loose mountain scree — the earth region's open ground beyond the dirt PATH.
      // A pale grey-brown rubble base strewn with little angular stones in mixed
      // greys, hashed per tile so the slope reads as broken rock rather than a flat
      // fill. Static (no animation), and clearly cooler/greyer than the warm PATH.
      const h = (col * 53 + row * 89);
      ctx.fillStyle = '#8a8174'; ctx.fillRect(x, y, s, s);             // rubble base
      ctx.fillStyle = '#7c7368';                                        // faint mottling
      ctx.fillRect(x + s*0.10, y + s*0.55, s*0.34, s*0.30);
      ctx.fillRect(x + s*0.55, y + s*0.12, s*0.30, s*0.24);
      // Scattered angular pebbles — positions/shades hashed so each tile differs.
      const peb = [['#9c9384', 0.22, 0.30, 3], ['#6f6659', 0.62, 0.58, 3],
                   ['#aaa094', 0.40, 0.72, 2], ['#5f574c', 0.78, 0.34, 2]];
      for (let i = 0; i < peb.length; i++) {
        const [cstr, fx, fy, sz] = peb[i];
        ctx.fillStyle = cstr;
        const jx = ((h >> (i * 2)) & 3) - 1;
        const jy = ((h >> (i * 2 + 1)) & 3) - 1;
        ctx.fillRect(x + s*fx + jx, y + s*fy + jy, sz, sz);
      }
      break; }
    case T.CLOUDWALL: {
      // Air region border — a solid bank of cloud. Puffy white lobes overlapping
      // the tile edges so the frame reads as one continuous cloud mass rather
      // than a grid, lit on top and shaded along the underside. Hashed per tile
      // so the bank rolls instead of repeating. Static (no per-frame work — there
      // are a lot of border tiles).
      const h = (col * 131 + row * 83);
      const j = (a, n) => (((h >> a) & 3) / 3) * n;
      ctx.fillStyle = '#9fb0c8'; ctx.fillRect(x, y, s, s);              // cloud body
      ctx.fillStyle = '#8595af'; ctx.fillRect(x, y + s*0.62, s, s*0.38);// shaded underside
      ctx.fillStyle = '#eef3fb';                                        // puffy white lobes
      ctx.beginPath();
      ctx.arc(x + s*(0.30 + j(0,0.10)), y + s*(0.38 + j(2,0.08)), s*(0.30 + j(4,0.06)), 0, Math.PI*2);
      ctx.arc(x + s*(0.72 + j(6,0.08)), y + s*(0.44 + j(8,0.06)), s*(0.26 + j(0,0.06)), 0, Math.PI*2);
      ctx.arc(x + s*0.52,               y + s*(0.26 + j(4,0.06)), s*0.22, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';                          // sunlit crest
      ctx.beginPath(); ctx.arc(x + s*0.40, y + s*0.30, s*0.15, 0, Math.PI*2); ctx.fill();
      break; }
    case T.CLOUDBANK: {
      // The brighter, fluffier second cloud tile dappled across the walkable cloud
      // floor — denser, whiter puffs than the base CLOUD so the surface reads as a
      // rolling bank of cloud rather than one flat sheet. Passable. Static, hashed.
      const h = (col * 97 + row * 57);
      const j = (a, n) => (((h >> a) & 3) / 3) * n;
      ctx.fillStyle = '#eef4fc'; ctx.fillRect(x, y, s, s);              // bright cloud base
      ctx.fillStyle = '#ffffff';                                        // fluffy white lobes
      ctx.beginPath();
      ctx.arc(x + s*(0.32 + j(0,0.10)), y + s*(0.40 + j(2,0.08)), s*(0.26 + j(4,0.05)), 0, Math.PI*2);
      ctx.arc(x + s*(0.62 + j(6,0.08)), y + s*(0.36 + j(8,0.06)), s*(0.24 + j(0,0.05)), 0, Math.PI*2);
      ctx.arc(x + s*(0.50 + j(2,0.06)), y + s*(0.62 + j(4,0.06)), s*0.20, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = 'rgba(180,198,222,0.30)';                         // faint dimple shadow
      ctx.beginPath(); ctx.arc(x + s*0.74, y + s*0.66, s*0.10, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.95)';                         // glint of sun
      ctx.fillRect(x + s*0.34, y + s*0.30, 2, 2);
      break; }
    case T.SKY_GROUND: {
      // The air region's solid border — the earth seen far below from the height
      // of the clouds, framing the cloud the hero walks on. A hazy blue-green land
      // base dappled with muted field and forest patches and the odd thread of a
      // river/road, all desaturated by the distance (aerial perspective) and
      // veiled with a soft haze so the edge reads as the world far below. Hashed,
      // static.
      const h = (col * 73 + row * 51);
      const q = (a) => (h >> a) & 3;
      ctx.fillStyle = '#8fa48f'; ctx.fillRect(x, y, s, s);              // hazy land base
      // Muted patchwork of fields / forest / water far below.
      const patches = [
        ['#7e9a74', 0.04, 0.08, 0.44, 0.40],
        ['#9aa884', 0.50, 0.46, 0.46, 0.48],
        ['#6f8f8a', 0.16, 0.56, 0.34, 0.36],
      ];
      for (let i = 0; i < patches.length; i++) {
        const [cstr, fx, fy, fw, fh] = patches[i];
        ctx.fillStyle = cstr;
        ctx.fillRect(x + s*fx + q(i*2), y + s*fy, s*fw, s*fh);
      }
      // A tiny far-below river/road winding through some tiles.
      if (q(6) === 0) {
        ctx.strokeStyle = 'rgba(160,188,206,0.55)'; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x,         y + s*(0.30 + 0.10*q(0)));
        ctx.lineTo(x + s*0.5, y + s*(0.54 + 0.06*q(2)));
        ctx.lineTo(x + s,     y + s*(0.40 + 0.10*q(4)));
        ctx.stroke();
        ctx.lineWidth = 1;
      }
      // Field-boundary speckles, then a soft atmospheric haze veil over it all.
      ctx.fillStyle = 'rgba(70,92,80,0.40)';
      ctx.fillRect(x + s*0.30 + q(0), y + s*0.32 + q(2), 1, 1);
      ctx.fillRect(x + s*0.66,        y + s*0.70,        1, 1);
      ctx.fillStyle = 'rgba(212,226,238,0.20)'; ctx.fillRect(x, y, s, s);
      break; }
    case T.CLOUD: {
      // The air region's walkable ground — a soft floor of cloud the hero strolls
      // across (you're standing on the cloud, so it's opaque, not a see-through
      // wisp). Pale cloud base with hashed sunlit puffs and faint blue dimples so
      // the surface rolls gently instead of reading flat. Passable. Static.
      const h = (col * 61 + row * 97);
      const j = (a, n) => (((h >> a) & 3) / 3) * n;
      ctx.fillStyle = '#e3ecf7'; ctx.fillRect(x, y, s, s);              // cloud floor base
      ctx.fillStyle = '#ffffff';                                        // sunlit puffs
      ctx.beginPath();
      ctx.arc(x + s*(0.30 + j(0,0.12)), y + s*(0.34 + j(2,0.10)), s*(0.20 + j(4,0.05)), 0, Math.PI*2);
      ctx.arc(x + s*(0.68 + j(6,0.10)), y + s*(0.60 + j(8,0.08)), s*(0.18 + j(0,0.05)), 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = 'rgba(150,170,200,0.22)';                         // soft dimple shadows
      ctx.beginPath();
      ctx.arc(x + s*(0.58 + j(2,0.08)), y + s*(0.30 + j(4,0.06)), s*0.12, 0, Math.PI*2);
      ctx.arc(x + s*(0.28 + j(8,0.06)), y + s*(0.66 + j(6,0.06)), s*0.10, 0, Math.PI*2);
      ctx.fill();
      break; }
    case T.CLOUD_EDGE: {
      // The impassable lip of the cloud ringing the walkable floor. Billowing
      // white puffs along the top curl down into a shaded, wispy underside so the
      // tile reads as the rounded edge of the cloud dropping away — clearly puffier
      // and darker-bottomed than the flat CLOUD floor, signalling "can't walk off
      // here." Lobes overlap the tile edges so the rim stays continuous. Hashed
      // per tile, static.
      const h = (col * 89 + row * 53);
      const j = (a, n) => (((h >> a) & 3) / 3) * n;
      ctx.fillStyle = '#cfd9ea'; ctx.fillRect(x, y, s, s);              // cloud-edge body
      ctx.fillStyle = '#9aa8c2'; ctx.fillRect(x, y + s*0.56, s, s*0.44);// shaded underside (curls under)
      ctx.fillStyle = '#7e8ca8'; ctx.fillRect(x, y + s*0.82, s, s*0.18);// deepest shadow (the drop-off)
      ctx.fillStyle = '#f4f8fe';                                        // billowing white puffs on top
      ctx.beginPath();
      ctx.arc(x + s*(0.26 + j(0,0.10)), y + s*(0.34 + j(2,0.08)), s*(0.24 + j(4,0.06)), 0, Math.PI*2);
      ctx.arc(x + s*(0.62 + j(6,0.08)), y + s*(0.30 + j(8,0.06)), s*(0.26 + j(0,0.06)), 0, Math.PI*2);
      ctx.arc(x + s*(0.90 + j(2,0.05)), y + s*(0.42 + j(4,0.05)), s*0.18, 0, Math.PI*2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(210,220,236,0.5)'; ctx.lineWidth = 1;     // wispy tendrils trailing off
      ctx.beginPath();
      ctx.moveTo(x + s*(0.30 + j(6,0.10)), y + s*0.64); ctx.lineTo(x + s*(0.24 + j(8,0.10)), y + s*0.92);
      ctx.moveTo(x + s*(0.70 + j(2,0.10)), y + s*0.68); ctx.lineTo(x + s*(0.78 + j(4,0.10)), y + s*0.95);
      ctx.stroke(); ctx.lineWidth = 1;
      break; }
    case T.STORM_GROUND: {
      // Lightning region's walkable floor — the dark-storm twin of CLOUD. The hero
      // strolls across a floor of brooding dark cloud: a dark slate base with
      // hashed, faintly-lit billows and deep shadow dimples so the surface rolls
      // gently, plus the odd cold electric glint hinting at the charge in the air.
      // Passable. Static, hashed per tile.
      const h = (col * 61 + row * 97);
      const j = (a, n) => (((h >> a) & 3) / 3) * n;
      ctx.fillStyle = '#2f3548'; ctx.fillRect(x, y, s, s);              // dark cloud-floor base
      ctx.fillStyle = '#3c4360';                                        // faintly lit billows
      ctx.beginPath();
      ctx.arc(x + s*(0.30 + j(0,0.12)), y + s*(0.34 + j(2,0.10)), s*(0.20 + j(4,0.05)), 0, Math.PI*2);
      ctx.arc(x + s*(0.68 + j(6,0.10)), y + s*(0.60 + j(8,0.08)), s*(0.18 + j(0,0.05)), 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = 'rgba(8,10,22,0.42)';                             // deep shadow dimples
      ctx.beginPath();
      ctx.arc(x + s*(0.58 + j(2,0.08)), y + s*(0.30 + j(4,0.06)), s*0.12, 0, Math.PI*2);
      ctx.arc(x + s*(0.28 + j(8,0.06)), y + s*(0.66 + j(6,0.06)), s*0.10, 0, Math.PI*2);
      ctx.fill();
      if (((h >> 4) & 7) === 0) {                                       // rare cold electric glint
        ctx.fillStyle = 'rgba(150,192,240,0.55)';
        ctx.fillRect(x + s*(0.44 + j(2,0.18)), y + s*(0.40 + j(6,0.20)), 1.5, 1.5);
      }
      break; }
    case T.STORM_BANK: {
      // The brighter, lit storm puff dappled across the walkable STORM_GROUND floor
      // — the dark-storm twin of CLOUDBANK. Raised, slightly paler dark lobes catch
      // a cold crest of light so the floor reads as a rolling bank of storm cloud
      // rather than one flat dark sheet. Passable. Static, hashed.
      const h = (col * 97 + row * 57);
      const j = (a, n) => (((h >> a) & 3) / 3) * n;
      ctx.fillStyle = '#3a4158'; ctx.fillRect(x, y, s, s);              // lit storm-puff base
      ctx.fillStyle = '#49516f';                                        // raised dark lobes
      ctx.beginPath();
      ctx.arc(x + s*(0.32 + j(0,0.10)), y + s*(0.40 + j(2,0.08)), s*(0.26 + j(4,0.05)), 0, Math.PI*2);
      ctx.arc(x + s*(0.62 + j(6,0.08)), y + s*(0.36 + j(8,0.06)), s*(0.24 + j(0,0.05)), 0, Math.PI*2);
      ctx.arc(x + s*(0.50 + j(2,0.06)), y + s*(0.62 + j(4,0.06)), s*0.20, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = 'rgba(6,8,18,0.38)';                              // dimple shadow
      ctx.beginPath(); ctx.arc(x + s*0.74, y + s*0.66, s*0.10, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(172,206,246,0.5)';                          // cold crest glint
      ctx.fillRect(x + s*0.34, y + s*0.30, 2, 2);
      break; }
    case T.STORM_EDGE: {
      // The impassable lip of the storm island ringing the walkable floor — the
      // dark-storm twin of CLOUD_EDGE. Billowing dark lobes along the top curl down
      // into a near-black, wispy underside so the tile reads as the rounded edge of
      // the cloud dropping away into the thunderheads below — clearly puffier and
      // darker-bottomed than the flat STORM_GROUND floor, signalling "can't walk off
      // here." A faint cold rim light catches the lobe crests. Hashed, static.
      const h = (col * 89 + row * 53);
      const j = (a, n) => (((h >> a) & 3) / 3) * n;
      ctx.fillStyle = '#333950'; ctx.fillRect(x, y, s, s);              // storm-edge body
      ctx.fillStyle = '#22273a'; ctx.fillRect(x, y + s*0.56, s, s*0.44);// shaded underside (curls under)
      ctx.fillStyle = '#131723'; ctx.fillRect(x, y + s*0.82, s, s*0.18); // deepest shadow (the drop-off)
      ctx.fillStyle = '#3f475f';                                        // billowing dark lobes on top
      ctx.beginPath();
      ctx.arc(x + s*(0.26 + j(0,0.10)), y + s*(0.34 + j(2,0.08)), s*(0.24 + j(4,0.06)), 0, Math.PI*2);
      ctx.arc(x + s*(0.62 + j(6,0.08)), y + s*(0.30 + j(8,0.06)), s*(0.26 + j(0,0.06)), 0, Math.PI*2);
      ctx.arc(x + s*(0.90 + j(2,0.05)), y + s*(0.42 + j(4,0.05)), s*0.18, 0, Math.PI*2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(150,190,240,0.30)'; ctx.lineWidth = 1;    // cold rim light on the crests
      ctx.beginPath();
      ctx.arc(x + s*(0.26 + j(0,0.10)), y + s*(0.30 + j(2,0.08)), s*(0.24 + j(4,0.06)), Math.PI*1.15, Math.PI*1.85);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(20,24,38,0.7)'; ctx.lineWidth = 1;        // wispy dark tendrils trailing off
      ctx.beginPath();
      ctx.moveTo(x + s*(0.30 + j(6,0.10)), y + s*0.64); ctx.lineTo(x + s*(0.24 + j(8,0.10)), y + s*0.92);
      ctx.moveTo(x + s*(0.70 + j(2,0.10)), y + s*0.68); ctx.lineTo(x + s*(0.78 + j(4,0.10)), y + s*0.95);
      ctx.stroke(); ctx.lineWidth = 1;
      break; }
    case T.STORM_CLOUD: {
      // Lightning region's solid border — the dark-storm twin of SKY_GROUND. Where
      // air frames its cloud island with the hazy earth far below, lightning frames
      // it with a churning sea of near-black thunderheads: overlapping dark lobes in
      // a couple of cold shades, a shadowed underbelly, and — on a scattered ~1-in-8
      // of tiles — a frozen fork of lightning veining through, so the whole border
      // reads as a wall of very angry storm cloud. Hashed, static (a lot of border
      // tiles, so no per-frame work).
      const h = (col * 73 + row * 51);
      const q = (a) => (h >> a) & 3;
      const j = (a, n) => (((h >> a) & 3) / 3) * n;
      ctx.fillStyle = '#1a1e2b'; ctx.fillRect(x, y, s, s);              // near-black storm base
      ctx.fillStyle = '#242a3b';                                        // dark thunderhead lobes
      ctx.beginPath();
      ctx.arc(x + s*(0.30 + j(0,0.12)), y + s*(0.36 + j(2,0.10)), s*(0.30 + j(4,0.06)), 0, Math.PI*2);
      ctx.arc(x + s*(0.74 + j(6,0.10)), y + s*(0.46 + j(8,0.08)), s*(0.26 + j(0,0.06)), 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = '#2e354a';                                        // cold-lit crest of a lobe
      ctx.beginPath();
      ctx.arc(x + s*(0.40 + j(2,0.08)), y + s*(0.28 + j(4,0.06)), s*0.16, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = 'rgba(4,6,14,0.55)';                              // shadowed underbelly
      ctx.fillRect(x, y + s*0.66, s, s*0.34);
      if (((h >> 5) & 7) === 0) {                                       // a lightning vein in the cloud
        // Faint as charged-cloud texture between strikes, then blazes in sync
        // with the whole-screen flash (stormFlashLevel, set once per frame).
        const fl = stormFlashLevel;
        ctx.strokeStyle = 'rgba(110,150,225,' + (0.12 + 0.5*fl).toFixed(3) + ')'; ctx.lineWidth = 3; // soft glow
        ctx.beginPath();
        ctx.moveTo(x + s*(0.38 + 0.12*q(0)), y);
        ctx.lineTo(x + s*0.50,               y + s*0.44);
        ctx.lineTo(x + s*(0.38 + 0.12*q(2)), y + s*0.50);
        ctx.lineTo(x + s*(0.58 + 0.10*q(4)), y + s);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(178,212,252,' + (0.22 + 0.73*fl).toFixed(3) + ')'; ctx.lineWidth = 1.2; // bright core
        ctx.stroke();
        ctx.lineWidth = 1;
      }
      ctx.fillStyle = 'rgba(8,10,20,0.18)'; ctx.fillRect(x, y, s, s);   // faint dark haze veil
      break; }
    case T.FLOWER: {
      // ── Grass base (static — doesn't sway) ─────────────────────────────
      ctx.fillStyle = '#3a7a3a'; ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#4d9a4d';
      for (let i = 0; i < 3; i++) {
        const bx = x + ((col * 7 + row * 11 + i * 3) % 7) * s / 8;
        const by = y + ((col * 5 + row * 13 + i * 7) % 7) * s / 8;
        ctx.fillRect(bx, by, 1, 3);
      }
      ctx.fillStyle = '#2a5a2a';
      ctx.fillRect(x + s*0.08, y + s*0.88, 3, 2);
      ctx.fillRect(x + s*0.85, y + s*0.82, 3, 2);

      // ── Subtle wind sway applied to the whole flower-head layer below ──
      // Per-tile phase so a field of flowers doesn't sway in unison.
      const swayPhase = Date.now() / 1500 + col * 0.31 + row * 0.73;
      const swayX = Math.sin(swayPhase) * s * 0.045;
      const swayY = Math.cos(swayPhase * 1.3) * s * 0.018;
      ctx.save();
      ctx.translate(swayX, swayY);

      // Pick one of 8 flower variants based on tile coordinates (stable per tile)
      const variant = ((col * 73) ^ (row * 41)) & 7;
      const cx = x + s/2, cy = y + s/2;

      switch (variant) {
        case 0: {  // Pink daisy — stem + leaf + layered shaded petals
          // Stem
          ctx.fillStyle = '#1a5a1a';
          ctx.fillRect(x + s*0.48, y + s*0.50, s*0.04, s*0.38);
          // Leaf
          ctx.fillStyle = '#2a7a2a';
          ctx.beginPath();
          ctx.ellipse(x + s*0.38, y + s*0.68, s*0.09, s*0.045, -0.4, 0, Math.PI*2);
          ctx.fill();
          ctx.strokeStyle = '#1a4a14';
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(x + s*0.31, y + s*0.68); ctx.lineTo(x + s*0.45, y + s*0.66);
          ctx.stroke();

          // Use a higher head position than tile centre — flower sits above the stem
          const hcx = x + s/2, hcy = y + s*0.36;

          // 8 outer petals (slight elongation for a soft, full look)
          ctx.fillStyle = '#aa3a77';        // outer shadow
          for (let i = 0; i < 8; i++) {
            const a = i * Math.PI / 4;
            const px = hcx + Math.cos(a) * s*0.15;
            const py = hcy + Math.sin(a) * s*0.15;
            ctx.beginPath();
            ctx.ellipse(px, py, s*0.10, s*0.07, a, 0, Math.PI*2);
            ctx.fill();
          }
          // 8 brighter petal faces, offset toward upper-left for a "lit from above" feel
          ctx.fillStyle = '#ff7ab8';
          for (let i = 0; i < 8; i++) {
            const a = i * Math.PI / 4;
            const px = hcx + Math.cos(a) * s*0.13 - 0.5;
            const py = hcy + Math.sin(a) * s*0.13 - 0.5;
            ctx.beginPath();
            ctx.ellipse(px, py, s*0.075, s*0.05, a, 0, Math.PI*2);
            ctx.fill();
          }
          // Specular petal tips
          ctx.fillStyle = 'rgba(255,210,230,0.7)';
          for (let i = 0; i < 8; i += 2) {
            const a = i * Math.PI / 4;
            const px = hcx + Math.cos(a) * s*0.17;
            const py = hcy + Math.sin(a) * s*0.17;
            ctx.beginPath();
            ctx.arc(px, py, s*0.02, 0, Math.PI*2);
            ctx.fill();
          }
          // Yellow centre with darker pollen ring
          ctx.fillStyle = '#cc8800';
          ctx.beginPath(); ctx.arc(hcx, hcy, s*0.085, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = '#ffdd33';
          ctx.beginPath(); ctx.arc(hcx, hcy, s*0.065, 0, Math.PI*2); ctx.fill();
          // Pollen dots
          ctx.fillStyle = '#aa5500';
          for (let i = 0; i < 5; i++) {
            const a = i * Math.PI * 2 / 5;
            ctx.fillRect(hcx + Math.cos(a) * s*0.03 - 0.5,
                         hcy + Math.sin(a) * s*0.03 - 0.5, 1.5, 1.5);
          }
          // Centre highlight
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(hcx - s*0.02, hcy - s*0.02, s*0.015, 0, Math.PI*2);
          ctx.fill();
          break;
        }
        case 1: {  // Red tulip
          ctx.fillStyle = '#1a5a1a';
          ctx.fillRect(x + s*0.48, y + s*0.46, s*0.04, s*0.40);
          ctx.fillStyle = '#2a7a2a';
          ctx.beginPath();
          ctx.ellipse(x + s*0.38, y + s*0.66, s*0.12, s*0.05, -0.4, 0, Math.PI*2);
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(x + s*0.62, y + s*0.74, s*0.10, s*0.04, 0.4, 0, Math.PI*2);
          ctx.fill();
          // Tulip bell
          ctx.fillStyle = '#bb2244';
          ctx.beginPath();
          ctx.moveTo(x + s*0.32, y + s*0.46);
          ctx.bezierCurveTo(x + s*0.28, y + s*0.18, x + s*0.72, y + s*0.18, x + s*0.68, y + s*0.46);
          ctx.bezierCurveTo(x + s*0.60, y + s*0.42, x + s*0.40, y + s*0.42, x + s*0.32, y + s*0.46);
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#ee4466';
          ctx.beginPath();
          ctx.ellipse(x + s*0.42, y + s*0.30, s*0.05, s*0.10, -0.1, 0, Math.PI*2);
          ctx.fill();
          ctx.fillStyle = '#882233';
          ctx.beginPath();
          ctx.ellipse(x + s*0.58, y + s*0.32, s*0.04, s*0.10, 0.1, 0, Math.PI*2);
          ctx.fill();
          break;
        }
        case 2: {  // Blue bellflower cluster
          ctx.fillStyle = '#1a5a1a';
          ctx.fillRect(x + s*0.30, y + s*0.45, s*0.03, s*0.45);
          ctx.fillRect(x + s*0.50, y + s*0.32, s*0.03, s*0.58);
          ctx.fillRect(x + s*0.70, y + s*0.40, s*0.03, s*0.50);
          // 3 bells
          const bells = [
            { x: 0.32, y: 0.42, r: 0.085 },
            { x: 0.52, y: 0.28, r: 0.110 },
            { x: 0.72, y: 0.36, r: 0.080 }
          ];
          for (const b of bells) {
            ctx.fillStyle = '#3355cc';
            ctx.beginPath(); ctx.arc(x + s*b.x, y + s*b.y, s*b.r, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#5577ee';
            ctx.beginPath(); ctx.arc(x + s*b.x - 1, y + s*b.y - 1, s*b.r * 0.55, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#aabbff';
            ctx.beginPath(); ctx.arc(x + s*b.x - 2, y + s*b.y - 2, s*b.r * 0.25, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#ffee88';
            ctx.fillRect(x + s*b.x - 0.5, y + s*b.y + s*b.r*0.4, 1.5, 1.5);
          }
          break;
        }
        case 3: {  // White-purple cluster
          const flowers = [
            { x: 0.22, y: 0.32, color: '#bb88ee' },
            { x: 0.62, y: 0.24, color: '#ffffff' },
            { x: 0.38, y: 0.55, color: '#dd99dd' },
            { x: 0.76, y: 0.62, color: '#ffffff' },
            { x: 0.18, y: 0.78, color: '#aa66cc' },
            { x: 0.56, y: 0.80, color: '#ffeeff' }
          ];
          for (const f of flowers) {
            ctx.fillStyle = f.color;
            ctx.beginPath(); ctx.arc(x + s*f.x, y + s*f.y, s*0.07, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#ffdd00';
            ctx.fillRect(x + s*f.x - 1, y + s*f.y - 1, 2, 2);
          }
          break;
        }
        case 4: {  // Sunflower
          // Wide stem
          ctx.fillStyle = '#1a5a1a';
          ctx.fillRect(x + s*0.47, y + s*0.50, s*0.06, s*0.40);
          // Big leaves
          ctx.fillStyle = '#2a7a2a';
          ctx.beginPath();
          ctx.ellipse(x + s*0.30, y + s*0.65, s*0.16, s*0.06, -0.3, 0, Math.PI*2);
          ctx.fill();
          // Head sits just above the tile centre. Use a tile-relative y so the
          // head stays anchored when the camera scrolls (the previous code
          // multiplied cy by 0.85, which scaled with y and made the head drift).
          const headY = y + s * 0.42;
          // 8 yellow petals
          ctx.fillStyle = '#ffbb22';
          for (let i = 0; i < 8; i++) {
            const a = i * Math.PI / 4;
            ctx.save();
            ctx.translate(cx + Math.cos(a) * s*0.16, headY + Math.sin(a) * s*0.16);
            ctx.rotate(a);
            ctx.beginPath();
            ctx.ellipse(0, 0, s*0.10, s*0.06, 0, 0, Math.PI*2);
            ctx.fill();
            ctx.restore();
          }
          // Bright inner petal layer
          ctx.fillStyle = '#ffdd44';
          for (let i = 0; i < 8; i++) {
            const a = i * Math.PI / 4 + Math.PI / 8;
            ctx.beginPath();
            ctx.arc(cx + Math.cos(a) * s*0.13, headY + Math.sin(a) * s*0.13, s*0.05, 0, Math.PI*2);
            ctx.fill();
          }
          // Brown seeded center
          ctx.fillStyle = '#5a2a08';
          ctx.beginPath(); ctx.arc(cx, headY, s*0.11, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = '#7a4418';
          ctx.beginPath(); ctx.arc(cx, headY, s*0.08, 0, Math.PI*2); ctx.fill();
          // Seed dots
          ctx.fillStyle = '#3a1c04';
          for (let i = 0; i < 6; i++) {
            const a = i * Math.PI / 3;
            ctx.fillRect(cx + Math.cos(a) * s*0.04 - 0.5, headY + Math.sin(a) * s*0.04 - 0.5, 1.5, 1.5);
          }
          break;
        }
        case 5: {  // Yellow daffodils
          ctx.fillStyle = '#1a5a1a';
          ctx.fillRect(x + s*0.48, y + s*0.55, s*0.04, s*0.35);
          ctx.fillStyle = '#2a7a2a';
          ctx.beginPath();
          ctx.ellipse(x + s*0.62, y + s*0.72, s*0.10, s*0.04, 0.3, 0, Math.PI*2);
          ctx.fill();
          // 5 yellow petals
          const fcx = x + s*0.50, fcy = y + s*0.40;
          ctx.fillStyle = '#ffee44';
          for (let i = 0; i < 5; i++) {
            const a = i * Math.PI * 2 / 5 - Math.PI / 2;
            ctx.save();
            ctx.translate(fcx + Math.cos(a) * s*0.13, fcy + Math.sin(a) * s*0.13);
            ctx.rotate(a + Math.PI / 2);
            ctx.beginPath();
            ctx.ellipse(0, 0, s*0.06, s*0.10, 0, 0, Math.PI*2);
            ctx.fill();
            ctx.restore();
          }
          // Orange trumpet
          ctx.fillStyle = '#ee7711';
          ctx.beginPath(); ctx.arc(fcx, fcy, s*0.08, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = '#cc5500';
          ctx.beginPath(); ctx.arc(fcx, fcy, s*0.05, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = '#ffcc66';
          ctx.beginPath(); ctx.arc(fcx - 1, fcy - 1, s*0.025, 0, Math.PI*2); ctx.fill();
          break;
        }
        case 6: {  // Red rose
          // Stem with leaf
          ctx.fillStyle = '#1a4a1a';
          ctx.fillRect(x + s*0.49, y + s*0.45, s*0.04, s*0.45);
          ctx.fillStyle = '#2a6a2a';
          ctx.beginPath();
          ctx.ellipse(x + s*0.38, y + s*0.72, s*0.09, s*0.05, -0.3, 0, Math.PI*2);
          ctx.fill();
          // Layered red rose
          const rcx = x + s*0.50, rcy = y + s*0.36;
          ctx.fillStyle = '#5a1122';
          ctx.beginPath(); ctx.arc(rcx, rcy, s*0.18, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = '#992244';
          ctx.beginPath(); ctx.arc(rcx, rcy, s*0.14, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = '#cc3355';
          ctx.beginPath(); ctx.arc(rcx, rcy, s*0.10, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = '#ee5577';
          ctx.beginPath(); ctx.arc(rcx - 1, rcy - 1, s*0.06, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = '#ff8899';
          ctx.beginPath(); ctx.arc(rcx - 2, rcy - 2, s*0.025, 0, Math.PI*2); ctx.fill();
          // Suggest petal seams
          ctx.strokeStyle = '#3a0a14';
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(rcx, rcy - s*0.10); ctx.lineTo(rcx, rcy + s*0.10);
          ctx.moveTo(rcx - s*0.10, rcy); ctx.lineTo(rcx + s*0.10, rcy);
          ctx.stroke();
          break;
        }
        case 7: {  // Mixed wildflower cluster — full petals + leaves
          const flowers = [
            { x: 0.22, y: 0.32, color: '#ff66aa', tip: '#ffaadd' },
            { x: 0.70, y: 0.26, color: '#ffdd44', tip: '#ffffaa' },
            { x: 0.36, y: 0.62, color: '#aa66dd', tip: '#ccaaff' },
            { x: 0.78, y: 0.66, color: '#66bbff', tip: '#aaddff' },
            { x: 0.16, y: 0.78, color: '#ff9966', tip: '#ffccaa' },
            { x: 0.58, y: 0.82, color: '#dd44aa', tip: '#ff99cc' }
          ];
          // Stems
          ctx.fillStyle = '#2a6a2a';
          for (const f of flowers) {
            ctx.fillRect(x + s*f.x - 0.5, y + s*f.y, 1, s * (0.92 - f.y));
          }
          // Small leaves on a few stems
          ctx.fillStyle = '#3a7a2a';
          [flowers[0], flowers[2], flowers[4]].forEach(f => {
            ctx.beginPath();
            ctx.ellipse(x + s*(f.x - 0.04), y + s*(f.y + 0.18), s*0.04, s*0.02, -0.3, 0, Math.PI*2);
            ctx.fill();
          });
          // 5-petal pseudo-blooms with brighter highlight + yellow centre
          for (const f of flowers) {
            ctx.fillStyle = f.color;
            for (let i = 0; i < 5; i++) {
              const a = i * Math.PI * 2 / 5 - Math.PI / 2;
              ctx.beginPath();
              ctx.arc(x + s*f.x + Math.cos(a) * s*0.038,
                      y + s*f.y + Math.sin(a) * s*0.038,
                      s*0.035, 0, Math.PI*2);
              ctx.fill();
            }
            // Soft tip highlight
            ctx.fillStyle = f.tip;
            ctx.beginPath();
            ctx.arc(x + s*f.x - 1, y + s*f.y - 1, s*0.025, 0, Math.PI*2);
            ctx.fill();
            // Bright centre dot
            ctx.fillStyle = '#ffee00';
            ctx.beginPath();
            ctx.arc(x + s*f.x, y + s*f.y, s*0.022, 0, Math.PI*2);
            ctx.fill();
          }
          break;
        }
      }

      // Restore the sway transform
      ctx.restore();
      break; }
    case T.DUNGEON_DOOR: {
      ctx.fillStyle = '#220033'; ctx.fillRect(x,y,s,s);
      const pulse = Math.sin(Date.now()/300) * 2;
      ctx.fillStyle = '#440066'; ctx.beginPath(); ctx.arc(x+s/2,y+s/2,s*0.38+pulse,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#cc44ff'; ctx.beginPath(); ctx.arc(x+s/2,y+s/2,s*0.1,0,Math.PI*2); ctx.fill();
      break; }
    case T.LAVA: {
      const lw = Math.sin(Date.now()/400 + col + row) * 2;
      ctx.fillStyle = '#ff5500'; ctx.fillRect(x+2,y+s*0.3+lw,s-4,5);
      ctx.fillStyle = '#ff8800'; ctx.fillRect(x+s*0.3,y+s*0.6-lw,s*0.4,3); break; }
    case T.BRIDGE:
      ctx.fillStyle = '#aa7733'; ctx.fillRect(x+2,y+2,s-4,s-4);
      ctx.fillStyle = '#cc9944'; ctx.fillRect(x+3,y+s/2-1,s-6,2);
      ctx.fillStyle = '#884411'; ctx.fillRect(x+2,y+2,2,s-4); ctx.fillRect(x+s-4,y+2,2,s-4); break;
    case T.PILLAR:
      ctx.fillStyle = '#888'; ctx.beginPath(); ctx.arc(x+s/2,y+s/2,s*0.38,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#aaa'; ctx.beginPath(); ctx.arc(x+s/2-3,y+s/2-3,s*0.15,0,Math.PI*2); ctx.fill(); break;
    case T.TORCH: {
      // Pulsing animation timer + a faster flicker for individual flame jitter
      const tt = Date.now();
      const flicker = (Math.sin(tt / 80 + col * 1.7 + row * 1.3) * 0.5 + 0.5);
      const sway    = Math.sin(tt / 120 + col + row * 2) * 0.7;

      // ── Soft warm halo (extends past the tile so it lights its neighbours)
      const glow = ctx.createRadialGradient(x + s/2, y + s*0.25, 0,
                                            x + s/2, y + s*0.25, s * 0.95);
      glow.addColorStop(0, `rgba(255, 200, 90, ${0.40 + flicker * 0.25})`);
      glow.addColorStop(0.6, `rgba(255, 160, 60, ${0.15 + flicker * 0.08})`);
      glow.addColorStop(1, 'rgba(255, 160, 60, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(x - s*0.45, y - s*0.45, s * 1.9, s * 1.9);

      // ── Stone pedestal base
      ctx.fillStyle = '#3a3a3a'; ctx.fillRect(x + s*0.24, y + s*0.92, s*0.52, s*0.05);  // shadow
      ctx.fillStyle = '#5a5a5a'; ctx.fillRect(x + s*0.26, y + s*0.78, s*0.48, s*0.16);  // body
      ctx.fillStyle = '#7a7a7a'; ctx.fillRect(x + s*0.26, y + s*0.78, s*0.48, s*0.04);  // top edge
      ctx.fillStyle = '#444';    ctx.fillRect(x + s*0.26, y + s*0.86, s*0.48, s*0.02);  // middle band

      // ── Wooden post (with darker right edge for depth)
      ctx.fillStyle = '#3a1c08'; ctx.fillRect(x + s*0.43, y + s*0.40, s*0.14, s*0.42);
      ctx.fillStyle = '#6a3a18'; ctx.fillRect(x + s*0.43, y + s*0.40, s*0.08, s*0.42);
      ctx.fillStyle = '#8a5028'; ctx.fillRect(x + s*0.44, y + s*0.40, s*0.03, s*0.42);

      // ── Gold bands wrapping the post
      ctx.fillStyle = '#e0b040';
      ctx.fillRect(x + s*0.41, y + s*0.50, s*0.18, s*0.05);
      ctx.fillRect(x + s*0.41, y + s*0.66, s*0.18, s*0.05);
      ctx.fillStyle = '#ffd070';
      ctx.fillRect(x + s*0.41, y + s*0.50, s*0.18, s*0.02);
      ctx.fillRect(x + s*0.41, y + s*0.66, s*0.18, s*0.02);

      // ── Brazier cup at top (dark iron with rim highlight)
      ctx.fillStyle = '#2a1408'; ctx.fillRect(x + s*0.26, y + s*0.32, s*0.48, s*0.16);
      ctx.fillStyle = '#5a3a18'; ctx.fillRect(x + s*0.26, y + s*0.32, s*0.48, s*0.04);   // rim
      ctx.fillStyle = '#8a5a28'; ctx.fillRect(x + s*0.26, y + s*0.32, s*0.48, s*0.015);  // rim highlight
      ctx.fillStyle = '#1a0a04'; ctx.fillRect(x + s*0.30, y + s*0.36, s*0.40, s*0.10);   // interior shadow
      // Glowing ember bed inside the cup
      ctx.fillStyle = `rgba(255, 120, 40, ${0.55 + flicker * 0.3})`;
      ctx.fillRect(x + s*0.30, y + s*0.42, s*0.40, s*0.05);

      // ── Multi-layer flame ──
      const flameTop = y + s*0.04 - flicker * s*0.04;        // tip Y
      const flameBase = y + s*0.32;                          // bottom of flame
      const cxF = x + s/2 + sway * s*0.02;                   // gentle horizontal sway

      // Outer flame (deep red-orange)
      ctx.fillStyle = `rgba(255, 110, 30, ${0.75 + flicker * 0.2})`;
      ctx.beginPath();
      ctx.moveTo(cxF, flameTop);
      ctx.bezierCurveTo(cxF + s*0.20, y + s*0.16, cxF + s*0.18, flameBase, cxF, flameBase);
      ctx.bezierCurveTo(cxF - s*0.18, flameBase, cxF - s*0.20, y + s*0.16, cxF, flameTop);
      ctx.closePath();
      ctx.fill();

      // Mid flame (orange-yellow)
      ctx.fillStyle = `rgba(255, 180, 60, ${0.85 + flicker * 0.15})`;
      ctx.beginPath();
      ctx.moveTo(cxF, flameTop + s*0.04);
      ctx.bezierCurveTo(cxF + s*0.13, y + s*0.18, cxF + s*0.12, flameBase, cxF, flameBase);
      ctx.bezierCurveTo(cxF - s*0.12, flameBase, cxF - s*0.13, y + s*0.18, cxF, flameTop + s*0.04);
      ctx.closePath();
      ctx.fill();

      // Inner flame (bright yellow)
      ctx.fillStyle = `rgba(255, 230, 130, 0.95)`;
      ctx.beginPath();
      ctx.ellipse(cxF, y + s*0.22 - flicker * s*0.02, s*0.06, s*0.12, 0, 0, Math.PI*2);
      ctx.fill();

      // White-hot core
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(cxF, y + s*0.24 - flicker * s*0.015, s*0.025, s*0.05, 0, 0, Math.PI*2);
      ctx.fill();

      // ── Floating embers spawning above the flame
      for (let i = 0; i < 4; i++) {
        const phase = ((tt / 700) + i * 0.27 + col * 0.13 + row * 0.19) % 1;
        const ex = cxF + Math.sin(tt / 180 + i * 1.7) * s * 0.12;
        const ey = y + s*0.22 - phase * s * 0.35;
        const alpha = (1 - phase) * 0.85;
        ctx.fillStyle = `rgba(255, ${130 + Math.floor(phase * 100)}, 40, ${alpha})`;
        ctx.fillRect(ex - 1, ey - 1, 2, 2);
      }
      break; }
    case T.STATUE:
      ctx.fillStyle = '#aaa'; ctx.fillRect(x+4,y+2,s-8,s-4);
      ctx.fillStyle = '#999'; ctx.beginPath(); ctx.arc(x+s/2,y+4,5,0,Math.PI*2); ctx.fill(); break;
    case T.BED: {
      // Wooden floor base
      ctx.fillStyle = '#9a7550'; ctx.fillRect(x, y, s, s);
      // Dark wooden frame
      ctx.fillStyle = '#3a1c08';
      ctx.fillRect(x + s*0.06, y + s*0.14, s*0.88, s*0.76);
      // Bedposts at four corners
      ctx.fillStyle = '#2a1004';
      ctx.fillRect(x + s*0.04, y + s*0.10, s*0.10, s*0.10);
      ctx.fillRect(x + s*0.86, y + s*0.10, s*0.10, s*0.10);
      ctx.fillRect(x + s*0.04, y + s*0.84, s*0.10, s*0.10);
      ctx.fillRect(x + s*0.86, y + s*0.84, s*0.10, s*0.10);
      // Mattress
      ctx.fillStyle = '#e8e0f0';
      ctx.fillRect(x + s*0.12, y + s*0.20, s*0.76, s*0.62);
      // Pillow at the top (north end)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + s*0.18, y + s*0.24, s*0.64, s*0.18);
      ctx.strokeStyle = '#cccccc';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x + s*0.18, y + s*0.24, s*0.64, s*0.18);
      // Blanket (covers lower portion)
      ctx.fillStyle = '#8a3a66';
      ctx.fillRect(x + s*0.12, y + s*0.46, s*0.76, s*0.36);
      // Blanket fold/seam
      ctx.fillStyle = '#a8508a';
      ctx.fillRect(x + s*0.12, y + s*0.46, s*0.76, s*0.04);
      // Blanket stripes
      ctx.fillStyle = '#a85088';
      ctx.fillRect(x + s*0.14, y + s*0.58, s*0.72, 1);
      ctx.fillRect(x + s*0.14, y + s*0.68, s*0.72, 1);
      ctx.fillRect(x + s*0.14, y + s*0.78, s*0.72, 1);
      break; }
    case T.TABLE: {
      // Wooden floor base
      ctx.fillStyle = '#9a7550'; ctx.fillRect(x, y, s, s);
      // Tabletop (wide rounded rectangle)
      ctx.fillStyle = '#6a3a18';
      ctx.fillRect(x + s*0.10, y + s*0.24, s*0.80, s*0.42);
      // Wood-grain highlights
      ctx.fillStyle = '#7d4a22';
      ctx.fillRect(x + s*0.10, y + s*0.24, s*0.80, s*0.06);
      ctx.fillStyle = '#4a2208';
      ctx.fillRect(x + s*0.10, y + s*0.34, s*0.80, 1);
      ctx.fillRect(x + s*0.10, y + s*0.50, s*0.80, 1);
      ctx.fillRect(x + s*0.10, y + s*0.62, s*0.80, 1);
      // Table legs
      ctx.fillStyle = '#3a1c08';
      ctx.fillRect(x + s*0.16, y + s*0.66, s*0.06, s*0.26);
      ctx.fillRect(x + s*0.78, y + s*0.66, s*0.06, s*0.26);
      // Centrepiece: candle in a small holder
      ctx.fillStyle = '#ccc';   // holder plate
      ctx.beginPath();
      ctx.ellipse(x + s*0.50, y + s*0.36, s*0.10, s*0.035, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = '#eeeec0';  // candle shaft
      ctx.fillRect(x + s*0.48, y + s*0.26, s*0.04, s*0.10);
      // Flame
      const ft = Math.sin(Date.now() / 220 + col * 1.7 + row * 1.1);
      ctx.fillStyle = `rgba(255, 180, 60, 0.95)`;
      ctx.beginPath();
      ctx.ellipse(x + s*0.50, y + s*0.22 - ft*0.5, s*0.025, s*0.05, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 240, 160, 0.95)';
      ctx.beginPath();
      ctx.ellipse(x + s*0.50, y + s*0.23 - ft*0.3, s*0.012, s*0.025, 0, 0, Math.PI*2);
      ctx.fill();
      break; }
    case T.CHAIR: {
      // Wooden floor base
      ctx.fillStyle = '#9a7550'; ctx.fillRect(x, y, s, s);
      // Backrest (top half)
      ctx.fillStyle = '#5a2a10';
      ctx.fillRect(x + s*0.30, y + s*0.16, s*0.40, s*0.06);
      // Backrest verticals
      ctx.fillStyle = '#6a3618';
      ctx.fillRect(x + s*0.32, y + s*0.22, s*0.05, s*0.30);
      ctx.fillRect(x + s*0.46, y + s*0.22, s*0.05, s*0.30);
      ctx.fillRect(x + s*0.62, y + s*0.22, s*0.05, s*0.30);
      // Seat cushion
      ctx.fillStyle = '#7a4a22';
      ctx.fillRect(x + s*0.26, y + s*0.50, s*0.48, s*0.16);
      // Seat top edge
      ctx.fillStyle = '#a06030';
      ctx.fillRect(x + s*0.26, y + s*0.50, s*0.48, s*0.04);
      // Legs
      ctx.fillStyle = '#3a1c08';
      ctx.fillRect(x + s*0.28, y + s*0.66, s*0.06, s*0.26);
      ctx.fillRect(x + s*0.66, y + s*0.66, s*0.06, s*0.26);
      break; }
    case T.FIREPLACE: {
      // Wooden floor base
      ctx.fillStyle = '#9a7550'; ctx.fillRect(x, y, s, s);
      // Stone hearth — outer light grey
      ctx.fillStyle = '#7a7a78';
      ctx.fillRect(x + s*0.04, y + s*0.04, s*0.92, s*0.92);
      // Stone pattern — slightly irregular blocks
      ctx.fillStyle = '#5a5a58';
      ctx.fillRect(x + s*0.06, y + s*0.10, s*0.30, s*0.04);
      ctx.fillRect(x + s*0.40, y + s*0.06, s*0.26, s*0.04);
      ctx.fillRect(x + s*0.70, y + s*0.10, s*0.24, s*0.04);
      // Inner firebox (dark void)
      ctx.fillStyle = '#1a0a04';
      ctx.fillRect(x + s*0.18, y + s*0.30, s*0.64, s*0.60);
      // Iron pot crossbar
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + s*0.18, y + s*0.32);
      ctx.lineTo(x + s*0.82, y + s*0.32);
      ctx.stroke();
      // Cooking pot
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(x + s*0.34, y + s*0.34, s*0.32, s*0.16);
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(x + s*0.34, y + s*0.50, s*0.32, s*0.04);
      // Pot handle (curve)
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x + s*0.50, y + s*0.34, s*0.18, Math.PI, 0);
      ctx.stroke();
      // Animated flame inside the firebox
      const tt = Date.now();
      const flick = Math.sin(tt / 100 + col * 1.7 + row * 1.1) * 0.5 + 0.5;
      // Outer red
      ctx.fillStyle = `rgba(220, 60, 20, ${0.85 + flick * 0.15})`;
      ctx.beginPath();
      ctx.moveTo(x + s*0.28, y + s*0.88);
      ctx.bezierCurveTo(x + s*0.20, y + s*0.66, x + s*0.50, y + s*0.55 - flick*2, x + s*0.50, y + s*0.55);
      ctx.bezierCurveTo(x + s*0.50, y + s*0.55 - flick*2, x + s*0.80, y + s*0.66, x + s*0.72, y + s*0.88);
      ctx.closePath(); ctx.fill();
      // Mid orange
      ctx.fillStyle = `rgba(255, 160, 40, ${0.90 + flick * 0.10})`;
      ctx.beginPath();
      ctx.moveTo(x + s*0.34, y + s*0.88);
      ctx.bezierCurveTo(x + s*0.30, y + s*0.72, x + s*0.50, y + s*0.62, x + s*0.50, y + s*0.62);
      ctx.bezierCurveTo(x + s*0.50, y + s*0.62, x + s*0.70, y + s*0.72, x + s*0.66, y + s*0.88);
      ctx.closePath(); ctx.fill();
      // Yellow core
      ctx.fillStyle = `rgba(255, 230, 130, 0.95)`;
      ctx.beginPath();
      ctx.ellipse(x + s*0.50, y + s*0.78, s*0.06, s*0.10, 0, 0, Math.PI*2);
      ctx.fill();
      // Glowing logs at base
      ctx.fillStyle = '#aa4400';
      ctx.fillRect(x + s*0.24, y + s*0.86, s*0.20, 3);
      ctx.fillRect(x + s*0.56, y + s*0.86, s*0.20, 3);
      // Warm glow halo spilling out
      const glow = ctx.createRadialGradient(x + s*0.5, y + s*0.7, 1, x + s*0.5, y + s*0.7, s*0.7);
      glow.addColorStop(0, `rgba(255, 180, 80, ${0.30 + flick * 0.15})`);
      glow.addColorStop(1, 'rgba(255, 180, 80, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(x - s*0.2, y - s*0.2, s*1.4, s*1.4);
      break; }
    case T.COBBLESTONE: {
      // Dark grout base
      ctx.fillStyle = '#2c2c2a'; ctx.fillRect(x, y, s, s);
      // Four irregular cobble stones, sizes and positions jittered by tile
      // coords so adjacent tiles aren't identical.
      const j = ((col * 113 + row * 71) & 15) / 16;
      const stones = [
        { cx: 0.25 + j * 0.04, cy: 0.24,         w: 0.27, h: 0.24, c: '#6e6e6c' },
        { cx: 0.72,             cy: 0.30 + j*0.05, w: 0.22, h: 0.22, c: '#828280' },
        { cx: 0.30,             cy: 0.72,         w: 0.26, h: 0.22, c: '#5e5e5c' },
        { cx: 0.74 - j * 0.04,  cy: 0.70,         w: 0.22, h: 0.22, c: '#787876' },
      ];
      for (const sn of stones) {
        ctx.fillStyle = sn.c;
        ctx.beginPath();
        ctx.ellipse(x + s*sn.cx, y + s*sn.cy, s*sn.w, s*sn.h, 0, 0, Math.PI*2);
        ctx.fill();
      }
      // Soft top-left highlights — fakes light source
      ctx.fillStyle = 'rgba(190,190,185,0.45)';
      ctx.beginPath();
      ctx.ellipse(x + s*0.22, y + s*0.20, s*0.10, s*0.05, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x + s*0.69, y + s*0.27, s*0.08, s*0.04, 0, 0, Math.PI*2); ctx.fill();
      break; }
    case T.MARBLE: {
      // Polished cream marble base
      ctx.fillStyle = '#e8e4d8'; ctx.fillRect(x, y, s, s);
      // Soft top highlight (sheen)
      ctx.fillStyle = 'rgba(255, 250, 240, 0.45)';
      ctx.fillRect(x + 1, y + 1, s - 2, s * 0.32);
      // Pseudo-random veining — pick one of a handful of vein paths so
      // adjacent tiles aren't identical but the pattern stays coherent.
      const seed = ((col * 73) ^ (row * 41)) & 7;
      ctx.strokeStyle = 'rgba(110, 105, 90, 0.55)';
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      if      (seed === 0) { ctx.moveTo(x + s*0.10, y + s*0.20); ctx.lineTo(x + s*0.70, y + s*0.85); }
      else if (seed === 1) { ctx.moveTo(x + s*0.30, y);          ctx.lineTo(x + s*0.85, y + s*0.60); }
      else if (seed === 2) { ctx.moveTo(x,           y + s*0.50); ctx.lineTo(x + s,      y + s*0.62); }
      else if (seed === 3) { ctx.moveTo(x + s*0.20, y + s*0.90); ctx.lineTo(x + s*0.60, y + s*0.10); }
      else if (seed === 4) { ctx.moveTo(x + s*0.70, y + s*0.20); ctx.lineTo(x + s*0.50, y + s*0.95); }
      // 5/6/7: no vein (smooth tile)
      ctx.stroke();
      // Grout lines between tiles for the "tiled plaza" feel
      ctx.strokeStyle = 'rgba(170, 165, 150, 0.55)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
      break; }
    case T.FOUNTAIN_WATER: {
      // Dark inset basin
      ctx.fillStyle = '#0e2a66'; ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#1d4d99'; ctx.fillRect(x+1, y+1, s-2, s-2);
      // Three layered ripples flowing outward — different speeds + offsets
      // give the impression of continuous circulating water.
      const t = Date.now() / 230;
      for (let layer = 0; layer < 3; layer++) {
        const phase = t * (1 - layer * 0.18) + col * 0.55 + row * 0.45 + layer * 1.4;
        const yOff = Math.sin(phase) * (1.5 - layer * 0.3);
        const alpha = 0.45 - layer * 0.13;
        ctx.fillStyle = `rgba(170, 215, 255, ${alpha})`;
        ctx.fillRect(x + 2, y + s*0.22 + layer * s*0.22 + yOff, s - 4, 1.5);
      }
      // Foam highlights — pseudo-random sparkles
      const sparkle = Math.sin(t * 1.6 + col * 1.7 + row * 1.3) * 0.5 + 0.5;
      if (sparkle > 0.72) {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillRect(x + s*0.3 + (col % 3) * 3, y + s*0.42 + (row % 3) * 3, 2, 2);
        ctx.fillRect(x + s*0.7 - (col % 2) * 3, y + s*0.6, 1.5, 1.5);
      }
      break; }
    case T.FOUNTAIN_SPOUT: {
      // Stone pedestal base
      ctx.fillStyle = '#5a5a5a'; ctx.fillRect(x+s*0.12, y+s*0.55, s*0.76, s*0.40);
      ctx.fillStyle = '#888';    ctx.fillRect(x+s*0.12, y+s*0.55, s*0.76, s*0.06);
      ctx.fillStyle = '#bbb';    ctx.fillRect(x+s*0.18, y+s*0.55, s*0.64, s*0.02);
      ctx.fillStyle = '#444';    ctx.fillRect(x+s*0.12, y+s*0.92, s*0.76, s*0.05);
      // Upper basin (smaller round bowl)
      ctx.fillStyle = '#aaa'; ctx.fillRect(x+s*0.22, y+s*0.42, s*0.56, s*0.10);
      ctx.fillStyle = '#888'; ctx.fillRect(x+s*0.22, y+s*0.50, s*0.56, s*0.04);
      ctx.fillStyle = '#ccc'; ctx.fillRect(x+s*0.22, y+s*0.42, s*0.56, s*0.02);
      // Spout neck
      ctx.fillStyle = '#888'; ctx.fillRect(x+s*0.44, y+s*0.32, s*0.12, s*0.12);

      // Water jet — vertical column with pulsing height
      const t = Date.now() / 260;
      const jet = Math.abs(Math.sin(t * 1.6)) * 0.35 + 0.55;   // 0.55–0.90
      const jetH = s * jet;
      // Soft glow around the jet
      const glow = ctx.createRadialGradient(x+s/2, y+s*0.30-jetH*0.25, 1,
                                            x+s/2, y+s*0.30-jetH*0.25, s*0.7);
      glow.addColorStop(0, 'rgba(150,200,255,0.45)');
      glow.addColorStop(1, 'rgba(150,200,255,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(x - s*0.3, y - jetH, s*1.6, jetH + s*0.5);
      // Vertical core
      ctx.fillStyle = 'rgba(140, 200, 255, 0.85)';
      ctx.fillRect(x + s*0.45, y + s*0.30 - jetH, s*0.10, jetH);
      // Brighter inner core
      ctx.fillStyle = 'rgba(220, 240, 255, 0.95)';
      ctx.fillRect(x + s*0.47, y + s*0.30 - jetH, s*0.06, jetH);
      // Top burst — droplets arcing outward
      for (let i = 0; i < 8; i++) {
        const angle = -Math.PI/2 + (i / 7) * Math.PI - Math.PI/2;
        const phase = (t * 2.2 + i * 0.7) % 1;
        const r = phase * s * 0.55;
        const dx = Math.cos(angle) * r;
        const dy = -Math.abs(Math.sin(angle)) * r + (phase * phase) * s * 0.35;
        const alpha = (1 - phase) * 0.9;
        ctx.fillStyle = `rgba(180, 220, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(x + s/2 + dx, y + s*0.30 - jetH + dy, s*0.05, 0, Math.PI*2);
        ctx.fill();
      }
      // Water trickle down the sides of the upper basin
      const trick = Math.sin(t * 3) * 0.5 + 0.5;
      ctx.fillStyle = `rgba(140, 200, 255, ${0.6 + trick * 0.3})`;
      ctx.fillRect(x + s*0.24, y + s*0.50, s*0.03, s*0.08);
      ctx.fillRect(x + s*0.74, y + s*0.50, s*0.03, s*0.08);
      break; }
    case T.SHRINE:
      ctx.fillStyle = '#336633'; ctx.fillRect(x,y,s,s);
      ctx.fillStyle = '#55aa55'; ctx.fillRect(x+3,y+3,s-6,s-6);
      ctx.fillStyle = '#aaffaa'; ctx.beginPath(); ctx.arc(x+s/2,y+s/2,s*0.22,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x+s/2-1,y+2,2,s-4); ctx.fillRect(x+2,y+s/2-1,s-4,2); break;
    case T.MUSHROOM:
      ctx.fillStyle = '#3a7a3a'; ctx.fillRect(x,y,s,s);
      ctx.fillStyle = '#cc3300'; ctx.beginPath(); ctx.arc(x+s/2,y+s*0.4,s*0.28,Math.PI,0); ctx.fill();
      ctx.fillStyle = '#aa2200'; ctx.beginPath(); ctx.arc(x+s/2,y+s*0.42,s*0.28,0,Math.PI); ctx.fill();
      ctx.fillStyle = '#ffaaaa'; ctx.fillRect(x+s/2-1,y+s*0.3,2,2); ctx.fillRect(x+s/2+3,y+s*0.32,2,2);
      ctx.fillStyle = '#ddddaa'; ctx.fillRect(x+s/2-2,y+s*0.42,4,s*0.3); break;
    case T.FERN:
      ctx.fillStyle = '#3a7a3a'; ctx.fillRect(x,y,s,s);
      ctx.save();
      ctx.strokeStyle = '#44aa44'; ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const fa = -Math.PI/4 + i * Math.PI/4;
        ctx.beginPath();
        ctx.moveTo(x+s/2, y+s*0.7);
        ctx.lineTo(x+s/2 + Math.cos(fa)*s*0.42, y+s/2 + Math.sin(fa)*s*0.42);
        ctx.stroke();
      }
      ctx.restore(); break;
    case T.CAVE_FLOOR:
      ctx.fillStyle = '#2a1d10'; ctx.fillRect(x,y,s,s);
      // scattered pebble specks
      ctx.fillStyle = '#3a2818'; ctx.fillRect(x+s*0.2,y+s*0.3,2,2); ctx.fillRect(x+s*0.7,y+s*0.6,2,2);
      ctx.fillStyle = '#1a100a'; ctx.fillRect(x+s*0.5,y+s*0.2,2,2); ctx.fillRect(x+s*0.3,y+s*0.7,2,2);
      break;
    case T.CAVE_WALL: {
      // Natural cave rock — craggy dark stone with angular facets, a jagged crack,
      // and a mineral glint, lit softly from the upper-left. Hashing on tile coords
      // keeps each tile stable (no flicker) yet distinct, so a big rock mass reads
      // as fractured living stone rather than a tiled grid.
      const h = (col * 131 + row * 197);
      const j = (a, n) => (((h >> a) & 3) / 3) * n;        // 0..n jitter
      ctx.fillStyle = '#443b33'; ctx.fillRect(x, y, s, s); // base rock
      // Lit facet (upper-left)
      ctx.fillStyle = '#564b40';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + s * (0.55 + j(0, 0.14)), y);
      ctx.lineTo(x + s * (0.30 + j(2, 0.12)), y + s * (0.50 + j(4, 0.10)));
      ctx.lineTo(x, y + s * (0.55 + j(6, 0.10)));
      ctx.closePath(); ctx.fill();
      // Shadowed recess (lower-right)
      ctx.fillStyle = '#2d2620';
      ctx.beginPath();
      ctx.moveTo(x + s, y + s * (0.32 + j(0, 0.12)));
      ctx.lineTo(x + s, y + s);
      ctx.lineTo(x + s * (0.38 + j(2, 0.12)), y + s);
      ctx.lineTo(x + s * (0.62 + j(4, 0.08)), y + s * 0.50);
      ctx.closePath(); ctx.fill();
      // Jagged crack threading through
      ctx.strokeStyle = '#211c18'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + s * (0.42 + j(8, 0.12)), y);
      ctx.lineTo(x + s * (0.52 + j(6, 0.10)), y + s * 0.48);
      ctx.lineTo(x + s * (0.40 + j(4, 0.12)), y + s);
      ctx.stroke();
      // Mineral glint
      ctx.fillStyle = '#6f6456';
      ctx.fillRect(x + s * 0.20 + (h & 7), y + s * 0.28, 2, 2);
      break; }
    case T.CAVE_ENTRANCE: {
      // Dark hole with a flicker of light from inside
      ctx.fillStyle = '#1a3a1a'; ctx.fillRect(x,y,s,s);
      const grad = ctx.createRadialGradient(x+s/2, y+s/2, 1, x+s/2, y+s/2, s*0.48);
      grad.addColorStop(0, '#000');
      grad.addColorStop(0.7, '#0a0a14');
      grad.addColorStop(1, '#1a1a1a');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x+s/2, y+s/2, s*0.44, 0, Math.PI*2);
      ctx.fill();
      // pulsing glint
      const glow = (Math.sin(Date.now()/280) * 0.5 + 0.5) * 0.6 + 0.2;
      ctx.fillStyle = `rgba(255,180,80,${glow})`;
      ctx.beginPath();
      ctx.arc(x+s/2, y+s/2+s*0.05, s*0.10, 0, Math.PI*2);
      ctx.fill();
      break; }
    case T.CAVE_EXIT: {
      // Glowing portal back to the overworld
      ctx.fillStyle = '#2a1d10'; ctx.fillRect(x,y,s,s);
      const pulse = Math.sin(Date.now()/240) * 3;
      const grad = ctx.createRadialGradient(x+s/2, y+s/2, 1, x+s/2, y+s/2, s*0.42 + pulse);
      grad.addColorStop(0, '#aaffcc');
      grad.addColorStop(0.5, '#3388aa');
      grad.addColorStop(1, '#221133');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x+s/2, y+s/2, s*0.40 + pulse, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x+s/2, y+s/2, s*0.08, 0, Math.PI*2);
      ctx.fill();
      break; }
    case T.PORTAL: {
      // Cabin fast-travel portal — a vertical violet arch on the floor.
      ctx.fillStyle = '#9a7550'; ctx.fillRect(x,y,s,s);
      const pulse = (Math.sin(Date.now()/220) * 0.5 + 0.5);
      // Outer halo
      const halo = ctx.createRadialGradient(x+s/2, y+s/2, 1, x+s/2, y+s/2, s*0.9);
      halo.addColorStop(0, `rgba(180,120,255,${0.45 + pulse*0.25})`);
      halo.addColorStop(1, 'rgba(180,120,255,0)');
      ctx.fillStyle = halo;
      ctx.fillRect(x-s*0.4, y-s*0.4, s*1.8, s*1.8);
      // Stone frame (arch)
      ctx.fillStyle = '#3a2a4a';
      ctx.fillRect(x+s*0.10, y+s*0.10, s*0.80, s*0.80);
      // Swirling violet portal disc
      const grad = ctx.createRadialGradient(x+s/2, y+s/2, 1, x+s/2, y+s/2, s*0.40);
      grad.addColorStop(0, '#ffeeff');
      grad.addColorStop(0.45, '#cc77ff');
      grad.addColorStop(1, '#3a1066');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x+s/2, y+s/2, s*0.35 + pulse*2, 0, Math.PI*2);
      ctx.fill();
      // Sparkle core
      ctx.fillStyle = `rgba(255,255,255,${0.6 + pulse*0.4})`;
      ctx.beginPath();
      ctx.arc(x+s/2, y+s/2, s*0.08, 0, Math.PI*2);
      ctx.fill();
      break; }
    case T.INN_DOOR: {
      // Pulsing warm halo so the inn is visible from across the map.
      const pulse = (Math.sin(Date.now()/280) * 0.5 + 0.5);
      const halo = ctx.createRadialGradient(x+s/2, y+s/2, 1, x+s/2, y+s/2, s*0.9);
      halo.addColorStop(0, `rgba(255,160,80,${0.35 + pulse*0.25})`);
      halo.addColorStop(1, 'rgba(255,160,80,0)');
      ctx.fillStyle = halo;
      ctx.fillRect(x-s*0.4, y-s*0.4, s*1.8, s*1.8);

      // Stone threshold + red door
      ctx.fillStyle = '#604030'; ctx.fillRect(x+1,y+1,s-2,s-2);
      ctx.fillStyle = '#c2553a'; ctx.fillRect(x+s*0.18,y+s*0.30,s*0.64,s*0.62);
      ctx.fillStyle = '#8a3a22'; ctx.fillRect(x+s*0.18,y+s*0.30,s*0.64,s*0.08);
      // Door frame
      ctx.fillStyle = '#2a1408'; ctx.fillRect(x+s*0.18,y+s*0.28,s*0.06,s*0.64);
      ctx.fillRect(x+s*0.76,y+s*0.28,s*0.06,s*0.64);
      // Brass handle
      ctx.fillStyle = '#ffcc00';
      ctx.beginPath();
      ctx.arc(x+s*0.70, y+s*0.62, s*0.04, 0, Math.PI*2); ctx.fill();

      // Sign plank above the door — bright red with "INN" text
      ctx.fillStyle = '#7a3010';
      ctx.fillRect(x+s*0.05, y+s*0.02, s*0.90, s*0.22);
      ctx.fillStyle = '#cc3a18';
      ctx.fillRect(x+s*0.07, y+s*0.04, s*0.86, s*0.18);
      // Border highlight
      ctx.strokeStyle = '#ffd070';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x+s*0.07, y+s*0.04, s*0.86, s*0.18);
      // INN text (vanilla letters render reliably in any font)
      ctx.fillStyle = '#fff8d0';
      ctx.font = `bold ${Math.round(s*0.20)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('INN', x+s/2, y+s*0.14);
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';

      // Lantern hanging on the frame — pulsing
      ctx.fillStyle = `rgba(255,220,120,${0.5 + pulse*0.5})`;
      ctx.beginPath();
      ctx.arc(x+s*0.18, y+s*0.40, s*0.07, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#ffcc00';
      ctx.beginPath();
      ctx.arc(x+s*0.18, y+s*0.40, s*0.035, 0, Math.PI*2); ctx.fill();
      break; }
    case T.STORE_DOOR: {
      // Pulsing green halo
      const pulse = (Math.sin(Date.now()/280) * 0.5 + 0.5);
      const halo = ctx.createRadialGradient(x+s/2, y+s/2, 1, x+s/2, y+s/2, s*0.9);
      halo.addColorStop(0, `rgba(120,255,160,${0.35 + pulse*0.25})`);
      halo.addColorStop(1, 'rgba(120,255,160,0)');
      ctx.fillStyle = halo;
      ctx.fillRect(x-s*0.4, y-s*0.4, s*1.8, s*1.8);

      // Threshold + green door
      ctx.fillStyle = '#1f5a2a'; ctx.fillRect(x+1,y+1,s-2,s-2);
      ctx.fillStyle = '#42aa55'; ctx.fillRect(x+s*0.18,y+s*0.30,s*0.64,s*0.62);
      ctx.fillStyle = '#2c7a38'; ctx.fillRect(x+s*0.18,y+s*0.30,s*0.64,s*0.08);
      ctx.fillStyle = '#1a3a20'; ctx.fillRect(x+s*0.18,y+s*0.28,s*0.04,s*0.64);
      ctx.fillRect(x+s*0.78,y+s*0.28,s*0.04,s*0.64);
      // Brass handle
      ctx.fillStyle = '#ffcc00';
      ctx.beginPath();
      ctx.arc(x+s*0.70, y+s*0.62, s*0.04, 0, Math.PI*2); ctx.fill();

      // Striped awning + "SHOP" sign
      ctx.fillStyle = '#552010';
      ctx.fillRect(x+s*0.05, y+s*0.02, s*0.90, s*0.10);
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = i % 2 ? '#ffeebb' : '#cc3322';
        ctx.fillRect(x+s*0.05 + i*s*0.15, y+s*0.07, s*0.15, s*0.06);
      }
      // Sign plank
      ctx.fillStyle = '#3a2810';
      ctx.fillRect(x+s*0.20, y+s*0.13, s*0.60, s*0.13);
      ctx.fillStyle = '#ffd070';
      ctx.font = `bold ${Math.round(s*0.16)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('SHOP', x+s/2, y+s*0.19);
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';
      break; }
    case T.HERB_DOOR: {
      // Pulsing leafy-green halo
      const pulse = (Math.sin(Date.now()/280) * 0.5 + 0.5);
      const halo = ctx.createRadialGradient(x+s/2, y+s/2, 1, x+s/2, y+s/2, s*0.9);
      halo.addColorStop(0, `rgba(150,230,90,${0.35 + pulse*0.25})`);
      halo.addColorStop(1, 'rgba(150,230,90,0)');
      ctx.fillStyle = halo;
      ctx.fillRect(x-s*0.4, y-s*0.4, s*1.8, s*1.8);

      // Threshold + wooden door
      ctx.fillStyle = '#3a5a28'; ctx.fillRect(x+1,y+1,s-2,s-2);
      ctx.fillStyle = '#7a5a30'; ctx.fillRect(x+s*0.18,y+s*0.30,s*0.64,s*0.62);
      ctx.fillStyle = '#5a3f20'; ctx.fillRect(x+s*0.18,y+s*0.30,s*0.64,s*0.08);
      // Door frame
      ctx.fillStyle = '#2a1c08'; ctx.fillRect(x+s*0.18,y+s*0.28,s*0.05,s*0.64);
      ctx.fillRect(x+s*0.77,y+s*0.28,s*0.05,s*0.64);
      // Brass handle
      ctx.fillStyle = '#ffcc00';
      ctx.beginPath();
      ctx.arc(x+s*0.70, y+s*0.62, s*0.04, 0, Math.PI*2); ctx.fill();

      // Hanging herb bundles either side of the door
      ctx.strokeStyle = '#3a7a2a'; ctx.lineWidth = 1.5;
      for (const hx of [0.10, 0.90]) {
        ctx.beginPath();
        ctx.moveTo(x+s*hx, y+s*0.30); ctx.lineTo(x+s*hx, y+s*0.58);
        ctx.stroke();
        ctx.fillStyle = '#4a9a3a';
        ctx.beginPath(); ctx.ellipse(x+s*hx, y+s*0.58, s*0.05, s*0.10, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#6aba4a';
        ctx.beginPath(); ctx.ellipse(x+s*hx - s*0.02, y+s*0.56, s*0.025, s*0.06, 0, 0, Math.PI*2); ctx.fill();
      }

      // Sign plank with a green mortar-and-pestle dot + "HERB" text
      ctx.fillStyle = '#2a3a18';
      ctx.fillRect(x+s*0.08, y+s*0.02, s*0.84, s*0.22);
      ctx.fillStyle = '#3a5a24';
      ctx.fillRect(x+s*0.10, y+s*0.04, s*0.80, s*0.18);
      ctx.strokeStyle = '#aaee70';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x+s*0.10, y+s*0.04, s*0.80, s*0.18);
      ctx.fillStyle = '#eaffd0';
      ctx.font = `bold ${Math.round(s*0.16)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('HERB', x+s/2, y+s*0.14);
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';
      break; }
    case T.SMITH_DOOR: {
      // Pulsing steely-blue halo
      const pulse = (Math.sin(Date.now()/280) * 0.5 + 0.5);
      const halo = ctx.createRadialGradient(x+s/2, y+s/2, 1, x+s/2, y+s/2, s*0.9);
      halo.addColorStop(0, `rgba(150,180,230,${0.32 + pulse*0.22})`);
      halo.addColorStop(1, 'rgba(150,180,230,0)');
      ctx.fillStyle = halo;
      ctx.fillRect(x-s*0.4, y-s*0.4, s*1.8, s*1.8);

      // Stone threshold + heavy iron-banded door
      ctx.fillStyle = '#3a3a44'; ctx.fillRect(x+1,y+1,s-2,s-2);
      ctx.fillStyle = '#5a4a3a'; ctx.fillRect(x+s*0.18,y+s*0.30,s*0.64,s*0.62);
      ctx.fillStyle = '#3a2c20'; ctx.fillRect(x+s*0.18,y+s*0.30,s*0.64,s*0.08);
      // Iron bands across the door
      ctx.fillStyle = '#888894';
      ctx.fillRect(x+s*0.18, y+s*0.46, s*0.64, s*0.05);
      ctx.fillRect(x+s*0.18, y+s*0.72, s*0.64, s*0.05);
      // Door frame
      ctx.fillStyle = '#1a1a22'; ctx.fillRect(x+s*0.18,y+s*0.28,s*0.05,s*0.64);
      ctx.fillRect(x+s*0.77,y+s*0.28,s*0.05,s*0.64);
      // Iron ring handle
      ctx.strokeStyle = '#cccccc'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x+s*0.68, y+s*0.62, s*0.05, 0, Math.PI*2); ctx.stroke();

      // Anvil silhouette beside the door
      ctx.fillStyle = '#55555f';
      ctx.fillRect(x+s*0.04, y+s*0.66, s*0.12, s*0.05);   // top face
      ctx.fillRect(x+s*0.07, y+s*0.71, s*0.06, s*0.10);   // stem/base

      // Sign plank with "SMITH" text
      ctx.fillStyle = '#26262e';
      ctx.fillRect(x+s*0.06, y+s*0.02, s*0.88, s*0.22);
      ctx.fillStyle = '#3a3a48';
      ctx.fillRect(x+s*0.08, y+s*0.04, s*0.84, s*0.18);
      ctx.strokeStyle = '#aab4d0';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x+s*0.08, y+s*0.04, s*0.84, s*0.18);
      ctx.fillStyle = '#dfe6f5';
      ctx.font = `bold ${Math.round(s*0.15)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('SMITH', x+s/2, y+s*0.14);
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';
      break; }
    case T.LARGE_CHEST:
    case T.LARGE_CHEST_R: {
      // 1×2 chest: LARGE_CHEST is the left anchor, LARGE_CHEST_R is the right
      // half. Opened state is tracked on the anchor coords.
      const isRight = t === T.LARGE_CHEST_R;
      const ax = isRight ? col - 1 : col;
      const opened = currentMap().openedChests.has(`big_${ax},${row}`);
      // Slight gold halo around it when closed — drawn once per half so it
      // wraps the full body even at the seam.
      if (!opened) {
        const pulse = Math.sin(Date.now()/300) * 2;
        const halo = ctx.createRadialGradient(x+s/2, y+s/2, 1, x+s/2, y+s/2, s*0.8 + pulse);
        halo.addColorStop(0, 'rgba(255,210,80,0.45)');
        halo.addColorStop(1, 'rgba(255,210,80,0)');
        ctx.fillStyle = halo;
        ctx.fillRect(x-s*0.3, y-s*0.3, s*1.6, s*1.6);
      }
      // Chest body — extends the full tile horizontally (no inset on the
      // shared seam) so the two halves read as one wide chest.
      const leftEdge  = isRight ? x         : x + s*0.10;
      const rightEdge = isRight ? x + s*0.90 : x + s;
      const bodyW = rightEdge - leftEdge;
      ctx.fillStyle = opened ? '#3a2210' : '#995500';
      ctx.fillRect(leftEdge, y+s*0.30, bodyW, s*0.62);
      ctx.fillStyle = opened ? '#221406' : '#cc7700';
      ctx.fillRect(leftEdge, y+s*0.20, bodyW, s*0.18);
      // Iron bands run continuously across both halves
      ctx.fillStyle = opened ? '#1a1106' : '#553300';
      ctx.fillRect(leftEdge, y+s*0.36, bodyW, s*0.05);
      ctx.fillRect(leftEdge, y+s*0.75, bodyW, s*0.05);
      // Lock / star sits at the seam — drawn on the LEFT half only so it
      // straddles the centreline of the 2-tile chest.
      if (!isRight) {
        ctx.fillStyle = opened ? '#665533' : '#ffdd55';
        ctx.beginPath();
        ctx.arc(x+s, y+s/2+s*0.04, s*0.12, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = opened ? '#332211' : '#ffffff';
        ctx.fillRect(x+s-s*0.02, y+s/2-s*0.02, s*0.04, s*0.14);
      }
      break; }
    case T.BOSS_CHEST_TL:
    case T.BOSS_CHEST_TR:
    case T.BOSS_CHEST_BL:
    case T.BOSS_CHEST_BR: {
      // 2×2 boss chest — purple/gold royal palette with a pulsing magenta
      // halo, jewelled lock, and continuous iron bands across the seams.
      const isTop  = t === T.BOSS_CHEST_TL || t === T.BOSS_CHEST_TR;
      const isLeft = t === T.BOSS_CHEST_TL || t === T.BOSS_CHEST_BL;
      const ax = isLeft ? col : col - 1;
      const ay = isTop  ? row : row - 1;
      const opened = currentMap().openedChests.has(`boss_${ax},${ay}`);

      if (!opened) {
        const pulse = Math.sin(Date.now()/250) * 3;
        const halo = ctx.createRadialGradient(x+s/2, y+s/2, 1, x+s/2, y+s/2, s*1.1 + pulse);
        halo.addColorStop(0, 'rgba(220,80,255,0.55)');
        halo.addColorStop(1, 'rgba(220,80,255,0)');
        ctx.fillStyle = halo;
        ctx.fillRect(x-s*0.4, y-s*0.4, s*1.8, s*1.8);
      }

      // Body: fill the whole tile but inset by 10% only on the OUTER edges so
      // the four quadrants meet seamlessly. The body uses a deep regal purple,
      // the lid uses a brighter violet, and the iron bands are near-black.
      const leftPad   = isLeft  ? s*0.10 : 0;
      const rightPad  = isLeft  ? 0      : s*0.10;
      const topPad    = isTop   ? s*0.10 : 0;
      const bottomPad = isTop   ? 0      : s*0.10;
      const bx = x + leftPad;
      const by = y + topPad;
      const bw = s - leftPad - rightPad;
      const bh = s - topPad - bottomPad;

      // Lid (top row of tiles) vs body (bottom row of tiles)
      if (isTop) {
        // Lid: brighter violet on top, royal purple lower-lid
        ctx.fillStyle = opened ? '#1a0a22' : '#5a1a8a';
        ctx.fillRect(bx, by, bw, bh);
        // Lid trim along the BOTTOM seam of the top quadrants
        ctx.fillStyle = opened ? '#0a0410' : '#8833cc';
        ctx.fillRect(bx, y + s - 2, bw, 2);
        // Outer-edge top trim
        ctx.fillStyle = opened ? '#0a0410' : '#aa55ee';
        ctx.fillRect(bx, by, bw, Math.max(2, s*0.06));
      } else {
        // Body: deep regal purple
        ctx.fillStyle = opened ? '#120618' : '#3a0a66';
        ctx.fillRect(bx, by, bw, bh);
        // Body planking — vertical streak for grain
        ctx.fillStyle = opened ? '#0a020c' : '#240648';
        ctx.fillRect(bx + bw*0.3, by, 1, bh);
        ctx.fillRect(bx + bw*0.7, by, 1, bh);
        // Bottom trim
        ctx.fillStyle = opened ? '#0a0410' : '#5a1aaa';
        ctx.fillRect(bx, y + s - Math.max(2, s*0.06), bw, Math.max(2, s*0.06));
      }

      // Iron band across the seam between lid and body — drawn on BOTH the
      // top and bottom rows so it lines up no matter which quadrant draws first
      ctx.fillStyle = opened ? '#1a1106' : '#221122';
      if (isTop)  ctx.fillRect(bx, y + s - 3, bw, 3);
      else        ctx.fillRect(bx, y,         bw, 3);

      // Vertical iron strap down the centre seam between left/right quadrants
      ctx.fillStyle = opened ? '#1a1106' : '#221122';
      if (isLeft) ctx.fillRect(x + s - 2, by, 2, bh);
      else        ctx.fillRect(x,         by, 2, bh);

      // Jewelled lock — diamond gem at the very centre of the 2×2 chest.
      // Each quadrant draws its own quarter of the gem so it spans the seam.
      const cxg = isLeft ? x + s : x;
      const cyg = isTop  ? y + s : y;
      ctx.save();
      ctx.beginPath();
      // Clip to this tile so the four quarter-draws stay in their cells
      ctx.rect(x, y, s, s);
      ctx.clip();
      // Gold backplate
      ctx.fillStyle = opened ? '#443322' : '#ffcc33';
      ctx.beginPath();
      ctx.arc(cxg, cyg, s*0.22, 0, Math.PI*2);
      ctx.fill();
      // Inner gem (cyan when open? no — magenta gem when closed, dull when open)
      ctx.fillStyle = opened ? '#221122' : '#ff66ff';
      ctx.beginPath();
      ctx.moveTo(cxg, cyg - s*0.16);
      ctx.lineTo(cxg + s*0.12, cyg);
      ctx.lineTo(cxg, cyg + s*0.16);
      ctx.lineTo(cxg - s*0.12, cyg);
      ctx.closePath();
      ctx.fill();
      // Specular highlight on the gem
      if (!opened) {
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath();
        ctx.arc(cxg - s*0.04, cyg - s*0.04, s*0.025, 0, Math.PI*2);
        ctx.fill();
      }
      ctx.restore();
      break; }
    case T.SAND: {
      // Warm sand base with a few darker grain specks for texture.
      ctx.fillStyle = '#d4b070'; ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#b89456';
      ctx.fillRect(x + ((col * 7 + row * 5) % 7), y + ((col * 3 + row * 11) % 7), 2, 2);
      ctx.fillRect(x + s - 5 - ((col * 13) % 4), y + s - 4 - ((row * 7) % 4), 2, 2);
      ctx.fillStyle = '#e6c890';
      ctx.fillRect(x + s/2 - 1, y + s/2 - 1, 2, 2);
      break; }
    case T.DUNE: {
      // Sand base with a soft curved highlight to suggest a dune crest.
      ctx.fillStyle = '#c89858'; ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#e8c890';
      ctx.beginPath();
      ctx.arc(x + s/2, y + s*0.65, s*0.42, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#a87838';
      ctx.fillRect(x + s*0.15, y + s*0.7, s*0.7, 2);
      break; }
    case T.SNOW_DRIFT: {
      // The ice region's dune: a deep powder bank. Snow base, a soft white
      // crest mound, and a cool shadow line under its lee side.
      ctx.fillStyle = '#c9d6e4'; ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#f4f8fc';
      ctx.beginPath();
      ctx.arc(x + s/2, y + s*0.65, s*0.42, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#a8bcd0';
      ctx.fillRect(x + s*0.15, y + s*0.7, s*0.7, 2);
      // A couple of sparkle flecks so fresh powder glints.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + s*0.30, y + s*0.42, 2, 2);
      ctx.fillRect(x + s*0.62, y + s*0.52, 1, 1);
      break; }
    case T.ICE: {
      // Frozen-over water: pale blue sheet with a diagonal sheen band and
      // hairline cracks so it reads as slick, walkable lake ice.
      ctx.fillStyle = '#a8d8ee'; ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#cdeaf8';
      ctx.beginPath();
      ctx.moveTo(x + s*0.15, y);  ctx.lineTo(x + s*0.45, y);
      ctx.lineTo(x + s*0.15, y + s); ctx.lineTo(x, y + s); ctx.lineTo(x, y + s*0.55);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#7fb8d8'; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + s*0.55, y + s*0.18); ctx.lineTo(x + s*0.72, y + s*0.42);
      ctx.lineTo(x + s*0.64, y + s*0.66);
      ctx.moveTo(x + s*0.72, y + s*0.42); ctx.lineTo(x + s*0.88, y + s*0.50);
      ctx.stroke();
      ctx.fillStyle = '#eaf6fc';
      ctx.fillRect(x + s*0.22, y + s*0.72, 2, 2);
      break; }
    case T.OASIS_WATER: {
      // Brighter turquoise pool with a small shimmer wave.
      const w = Math.sin(Date.now()/500 + col*0.6 + row*0.4);
      ctx.fillStyle = '#2a88cc'; ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#66bbee'; ctx.fillRect(x+2, y+s*0.3+w*2, s*0.45, 3);
      ctx.fillStyle = '#aaddff'; ctx.fillRect(x+s*0.5, y+s*0.6-w*2, s*0.35, 2);
      break; }
    case T.CACTUS: {
      // Sand backdrop so cacti read against a desert palette regardless of
      // where they land. Trunk + two arms + dotted spines.
      ctx.fillStyle = '#d4b070'; ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#2d6a2d';
      ctx.fillRect(x + s*0.42, y + s*0.18, s*0.16, s*0.74);
      ctx.fillRect(x + s*0.18, y + s*0.45, s*0.20, s*0.10);
      ctx.fillRect(x + s*0.18, y + s*0.30, s*0.06, s*0.20);
      ctx.fillRect(x + s*0.62, y + s*0.55, s*0.20, s*0.10);
      ctx.fillRect(x + s*0.76, y + s*0.40, s*0.06, s*0.20);
      ctx.fillStyle = '#5aaa5a';
      ctx.fillRect(x + s*0.46, y + s*0.22, s*0.04, s*0.66);
      ctx.fillStyle = '#ffffaa';
      ctx.fillRect(x + s*0.50, y + s*0.20, 2, 2);
      ctx.fillRect(x + s*0.50, y + s*0.85, 2, 2);
      break; }
    case T.SNOW_PINE: {
      // Snow-covered pine — the ice region's border treeline. Snowfield
      // backdrop, trunk, then three evergreen tiers drawn bottom-up, each with
      // a ledge of snow resting along its lower boughs and a capped tip.
      ctx.fillStyle = '#dde8ee'; ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#c8d8e2'; ctx.fillRect(x, y + s*0.88, s, s*0.12);
      ctx.fillStyle = '#5a4530';
      ctx.fillRect(x + s*0.44, y + s*0.76, s*0.12, s*0.16);
      const tier = (apexY, baseY, hw, colr) => {
        ctx.fillStyle = colr;
        ctx.beginPath();
        ctx.moveTo(x + s*0.5,        y + s*apexY);
        ctx.lineTo(x + s*(0.5 - hw), y + s*baseY);
        ctx.lineTo(x + s*(0.5 + hw), y + s*baseY);
        ctx.closePath(); ctx.fill();
      };
      tier(0.28, 0.80, 0.36, '#1e4a30');
      ctx.fillStyle = '#f0f6fa'; ctx.fillRect(x + s*0.20, y + s*0.74, s*0.60, s*0.06);
      tier(0.14, 0.56, 0.27, '#266040');
      ctx.fillStyle = '#f0f6fa'; ctx.fillRect(x + s*0.28, y + s*0.51, s*0.44, s*0.05);
      tier(0.02, 0.34, 0.18, '#2e7050');
      ctx.fillStyle = '#f0f6fa'; ctx.fillRect(x + s*0.37, y + s*0.30, s*0.26, s*0.04);
      tier(0.02, 0.14, 0.07, '#ffffff');
      break; }
    case T.WINTER_BERRY_BUSH: {
      // Snowfield base with a faint shadow band, then a frosted evergreen shrub
      // (two overlapping mounds) crowned with snow caps and dotted with deep
      // blue-purple winter berries. Berry positions are fixed so the bush is
      // stable per tile (no twinkle).
      ctx.fillStyle = '#e4ecf2'; ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#d2dde8'; ctx.fillRect(x, y + s*0.86, s, s*0.14);
      ctx.fillStyle = '#2e5a40';
      ctx.beginPath(); ctx.arc(x + s*0.40, y + s*0.62, s*0.26, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + s*0.63, y + s*0.58, s*0.22, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#3e7a52';
      ctx.beginPath(); ctx.arc(x + s*0.46, y + s*0.55, s*0.16, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#f4f8fc';
      ctx.beginPath(); ctx.arc(x + s*0.40, y + s*0.45, s*0.10, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + s*0.63, y + s*0.43, s*0.08, 0, Math.PI*2); ctx.fill();
      const berry = (bx, by) => {
        ctx.fillStyle = '#5a3a8a';
        ctx.beginPath(); ctx.arc(bx, by, s*0.06, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#9a7ad8';
        ctx.beginPath(); ctx.arc(bx - s*0.018, by - s*0.018, s*0.022, 0, Math.PI*2); ctx.fill();
      };
      berry(x + s*0.33, y + s*0.67);
      berry(x + s*0.52, y + s*0.72);
      berry(x + s*0.67, y + s*0.63);
      break; }
    case T.FROST_LILY: {
      // Snowfield base, a slender green stem with one leaf, and a six-petal
      // pale ice-blue flower lit from above with a frosty blue center.
      ctx.fillStyle = '#e4ecf2'; ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#d2dde8'; ctx.fillRect(x, y + s*0.86, s, s*0.14);
      ctx.strokeStyle = '#2e6a4a'; ctx.lineWidth = Math.max(1, s*0.045); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x + s*0.5, y + s*0.9); ctx.lineTo(x + s*0.5, y + s*0.46); ctx.stroke();
      ctx.fillStyle = '#3e8a5e';
      ctx.beginPath(); ctx.ellipse(x + s*0.40, y + s*0.70, s*0.10, s*0.045, -0.5, 0, Math.PI*2); ctx.fill();
      const fcx = x + s*0.5, fcy = y + s*0.38;
      ctx.fillStyle = '#bfe2f5';
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3 - Math.PI/2;
        ctx.beginPath();
        ctx.ellipse(fcx + Math.cos(a)*s*0.16, fcy + Math.sin(a)*s*0.16, s*0.10, s*0.055, a, 0, Math.PI*2);
        ctx.fill();
      }
      ctx.fillStyle = '#eaf6fd';
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3 - Math.PI/2;
        ctx.beginPath();
        ctx.ellipse(fcx + Math.cos(a)*s*0.13, fcy + Math.sin(a)*s*0.13, s*0.06, s*0.03, a, 0, Math.PI*2);
        ctx.fill();
      }
      ctx.fillStyle = '#7fb8da';
      ctx.beginPath(); ctx.arc(fcx, fcy, s*0.05, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(fcx - s*0.015, fcy - s*0.015, s*0.02, 0, Math.PI*2); ctx.fill();
      break; }
    case T.FROST_FERN: {
      // Snowfield base + a frost-rimed fern: a pair of arching fronds, each a
      // green midrib lined with little leaflets and dusted white with frost at the
      // tip. Static per tile.
      ctx.fillStyle = '#e4ecf2'; ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#d2dde8'; ctx.fillRect(x, y + s*0.86, s, s*0.14);
      const ffrond = (bx, by, tipx, tipy, base, frost) => {
        ctx.strokeStyle = base; ctx.lineCap = 'round';
        ctx.lineWidth = Math.max(1, s*0.045);
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo((bx+tipx)/2, by - s*0.12, tipx, tipy); ctx.stroke();
        ctx.lineWidth = Math.max(1, s*0.022);
        for (let i = 1; i <= 5; i++) {
          const t = i / 6;
          const mx = bx + (tipx - bx) * t;
          const my = by + (tipy - by) * t - Math.sin(t*Math.PI) * s*0.06;
          const ll = s*0.10 * (1 - t*0.45);
          ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx - ll, my - ll*0.7); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx + ll, my - ll*0.7); ctx.stroke();
        }
        ctx.fillStyle = frost;
        ctx.beginPath(); ctx.arc(tipx, tipy, s*0.05, 0, Math.PI*2); ctx.fill();
      };
      ffrond(x + s*0.5, y + s*0.9, x + s*0.30, y + s*0.30, '#4e9a72', '#eaf6fd');
      ffrond(x + s*0.5, y + s*0.9, x + s*0.74, y + s*0.40, '#3e8a62', '#eaf6fd');
      break; }
    case T.STONES: {
      // Sand backdrop + a small cluster of smooth grey beach stones, each lit
      // from the upper-left with a soft highlight.
      ctx.fillStyle = '#d4b070'; ctx.fillRect(x, y, s, s);
      const stone = (sx, sy, rw, rh, base, lit) => {
        ctx.fillStyle = base;
        ctx.beginPath(); ctx.ellipse(sx, sy, rw, rh, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = lit;
        ctx.beginPath(); ctx.ellipse(sx - rw*0.25, sy - rh*0.3, rw*0.45, rh*0.4, 0, 0, Math.PI*2); ctx.fill();
      };
      stone(x + s*0.36, y + s*0.60, s*0.20, s*0.15, '#6f6a62', '#8f8a80');
      stone(x + s*0.64, y + s*0.52, s*0.16, s*0.13, '#7a746b', '#9a948a');
      stone(x + s*0.52, y + s*0.73, s*0.14, s*0.10, '#615c54', '#807a70');
      break; }
    case T.SEASHELL: {
      // Sand backdrop + a pale scallop shell: a ridged fan opening upward from a
      // hinge at the bottom, warm cream with a pink blush near the hinge.
      ctx.fillStyle = '#d4b070'; ctx.fillRect(x, y, s, s);
      const hx = x + s*0.5, hy = y + s*0.74, a0 = Math.PI*1.18, a1 = Math.PI*1.82;
      ctx.fillStyle = '#f2dcc4';
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.arc(hx, hy, s*0.34, a0, a1, false); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#e8b8a0';
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.arc(hx, hy, s*0.15, a0, a1, false); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#d8b89a'; ctx.lineWidth = Math.max(1, s*0.025);
      for (let i = 0; i <= 4; i++) {
        const a = a0 + (a1 - a0) * (i / 4);
        ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + Math.cos(a)*s*0.33, hy + Math.sin(a)*s*0.33); ctx.stroke();
      }
      break; }
    case T.CORAL: {
      // Sand backdrop + a branching coral in warm orange-pink, like a small reef
      // fragment on the tidal bar, with lighter polyp tips.
      ctx.fillStyle = '#d4b070'; ctx.fillRect(x, y, s, s);
      ctx.strokeStyle = '#e8765a'; ctx.lineWidth = Math.max(2, s*0.09); ctx.lineCap = 'round';
      const bx = x + s*0.5, by = y + s*0.86;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx, y + s*0.45); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx, y + s*0.62); ctx.lineTo(x + s*0.28, y + s*0.40); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx, y + s*0.55); ctx.lineTo(x + s*0.72, y + s*0.34); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx, y + s*0.48); ctx.lineTo(x + s*0.40, y + s*0.24); ctx.stroke();
      ctx.fillStyle = '#ffa98e';
      [[bx, y+s*0.45], [x+s*0.28, y+s*0.40], [x+s*0.72, y+s*0.34], [x+s*0.40, y+s*0.24]].forEach(([px, py]) => {
        ctx.beginPath(); ctx.arc(px, py, s*0.06, 0, Math.PI*2); ctx.fill();
      });
      break; }
    case T.MOUNTAIN_SAGE: {
      // Scree backdrop + a low, hardy sage shrub: a few rounded silver-green leaf
      // clumps on short woody stems, lit from the upper-left. Static per tile.
      ctx.fillStyle = '#8a8174'; ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#7c7368'; ctx.fillRect(x, y + s*0.86, s, s*0.14);   // ground shadow
      ctx.strokeStyle = '#5a4a32'; ctx.lineWidth = Math.max(1, s*0.05); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x + s*0.42, y + s*0.9); ctx.lineTo(x + s*0.40, y + s*0.55); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + s*0.58, y + s*0.9); ctx.lineTo(x + s*0.62, y + s*0.58); ctx.stroke();
      const clump = (cx2, cy2, rr, base, lit) => {
        ctx.fillStyle = base;
        ctx.beginPath(); ctx.arc(cx2, cy2, rr, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = lit;
        ctx.beginPath(); ctx.arc(cx2 - rr*0.3, cy2 - rr*0.3, rr*0.5, 0, Math.PI*2); ctx.fill();
      };
      clump(x + s*0.40, y + s*0.50, s*0.18, '#6f8c5e', '#9cb487');
      clump(x + s*0.62, y + s*0.52, s*0.16, '#7c9a6a', '#a8c094');
      clump(x + s*0.52, y + s*0.38, s*0.14, '#84a070', '#b4cc9e');
      break; }
    case T.MOSS_CLUMP: {
      // Scree backdrop + a low cushion of green moss spreading over the rubble,
      // with a couple of tiny spore stalks. Blotch positions hashed per tile so
      // the patches read as living moss, not a flat fill. Static (no anim).
      const h = (col * 71 + row * 59);
      ctx.fillStyle = '#8a8174'; ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#4c6a30';                                            // base cushion
      ctx.beginPath(); ctx.ellipse(x + s*0.5, y + s*0.66, s*0.34, s*0.22, 0, 0, Math.PI*2); ctx.fill();
      const blob = [['#5a7a3a', 0.34, 0.58, 0.13], ['#6a8c46', 0.62, 0.62, 0.11],
                    ['#52723a', 0.50, 0.74, 0.10], ['#74986a', 0.46, 0.55, 0.07]];
      for (let i = 0; i < blob.length; i++) {
        const [cstr, fx, fy, fr] = blob[i];
        ctx.fillStyle = cstr;
        const jx = (((h >> (i*2)) & 3) - 1) * s*0.02;
        ctx.beginPath(); ctx.arc(x + s*fx + jx, y + s*fy, s*fr, 0, Math.PI*2); ctx.fill();
      }
      ctx.strokeStyle = '#9ab07a'; ctx.lineWidth = Math.max(1, s*0.03); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x + s*0.40, y + s*0.66); ctx.lineTo(x + s*0.38, y + s*0.50); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + s*0.60, y + s*0.70); ctx.lineTo(x + s*0.63, y + s*0.56); ctx.stroke();
      ctx.fillStyle = '#cfe0a8';
      ctx.beginPath(); ctx.arc(x + s*0.38, y + s*0.49, s*0.03, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + s*0.63, y + s*0.55, s*0.03, 0, Math.PI*2); ctx.fill();
      break; }
    case T.CRYSTAL_CLUSTER: {
      // Scree backdrop + a small cluster of angular amethyst crystals jutting up,
      // each a tapered prism in violet with a lighter lit face and a bright tip.
      ctx.fillStyle = '#8a8174'; ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#7c7368';
      ctx.beginPath(); ctx.ellipse(x + s*0.5, y + s*0.82, s*0.30, s*0.10, 0, 0, Math.PI*2); ctx.fill();
      const shard = (bx, tipx, tipy, halfw, base, lit, tip) => {
        const baseY = y + s*0.84;
        ctx.fillStyle = base;
        ctx.beginPath();
        ctx.moveTo(bx - halfw, baseY);
        ctx.lineTo(tipx, tipy);
        ctx.lineTo(bx + halfw, baseY);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = lit;                                               // lit left face
        ctx.beginPath();
        ctx.moveTo(bx - halfw, baseY);
        ctx.lineTo(tipx, tipy);
        ctx.lineTo(bx, baseY);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = tip;                                               // bright tip
        ctx.beginPath(); ctx.arc(tipx, tipy, s*0.035, 0, Math.PI*2); ctx.fill();
      };
      shard(x + s*0.38, x + s*0.34, y + s*0.34, s*0.11, '#7a4ea8', '#a87fd0', '#e0cdf4');
      shard(x + s*0.62, x + s*0.68, y + s*0.42, s*0.10, '#6a4296', '#9a6fc4', '#dcc6f0');
      shard(x + s*0.50, x + s*0.50, y + s*0.24, s*0.12, '#8a5ec0', '#b890e0', '#f0e6fc');
      break; }
    case T.SKY_BLOOM: {
      // Cloud-floor base, a slender green stem with one leaf, and a six-petal
      // pink sky bloom lit from above with a bright golden center.
      ctx.fillStyle = '#e3ecf7'; ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#d2deec'; ctx.fillRect(x, y + s*0.86, s, s*0.14);
      ctx.strokeStyle = '#4a8a5e'; ctx.lineWidth = Math.max(1, s*0.045); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x + s*0.5, y + s*0.9); ctx.lineTo(x + s*0.5, y + s*0.46); ctx.stroke();
      ctx.fillStyle = '#5aa070';
      ctx.beginPath(); ctx.ellipse(x + s*0.40, y + s*0.70, s*0.10, s*0.045, -0.5, 0, Math.PI*2); ctx.fill();
      const sbx = x + s*0.5, sby = y + s*0.38;
      ctx.fillStyle = '#f2a8d0';
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3 - Math.PI/2;
        ctx.beginPath();
        ctx.ellipse(sbx + Math.cos(a)*s*0.16, sby + Math.sin(a)*s*0.16, s*0.10, s*0.055, a, 0, Math.PI*2);
        ctx.fill();
      }
      ctx.fillStyle = '#ffd6ec';
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3 - Math.PI/2;
        ctx.beginPath();
        ctx.ellipse(sbx + Math.cos(a)*s*0.13, sby + Math.sin(a)*s*0.13, s*0.06, s*0.03, a, 0, Math.PI*2);
        ctx.fill();
      }
      ctx.fillStyle = '#f4c84a';
      ctx.beginPath(); ctx.arc(sbx, sby, s*0.05, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff2c0';
      ctx.beginPath(); ctx.arc(sbx - s*0.015, sby - s*0.015, s*0.02, 0, Math.PI*2); ctx.fill();
      break; }
    case T.WIND_REED: {
      // Cloud-floor base + a tuft of tall, pale-gold reed blades all sweeping to
      // one side in the wind, each tipped with a fluffy seed head. Static per tile.
      ctx.fillStyle = '#e3ecf7'; ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#d2deec'; ctx.fillRect(x, y + s*0.86, s, s*0.14);
      const blade = (bx, ctrlx, tipx, tipy, base, head) => {
        ctx.strokeStyle = base; ctx.lineWidth = Math.max(1, s*0.05); ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(bx, y + s*0.9);
        ctx.quadraticCurveTo(ctrlx, y + s*0.55, tipx, tipy);
        ctx.stroke();
        ctx.fillStyle = head;
        ctx.beginPath(); ctx.ellipse(tipx, tipy, s*0.05, s*0.085, 0.6, 0, Math.PI*2); ctx.fill();
      };
      blade(x + s*0.42, x + s*0.55, x + s*0.72, y + s*0.26, '#c4ad62', '#f0e2a6');
      blade(x + s*0.50, x + s*0.62, x + s*0.80, y + s*0.34, '#d8c47a', '#f6ecc0');
      blade(x + s*0.38, x + s*0.46, x + s*0.58, y + s*0.34, '#b89e54', '#e8d894');
      break; }
    case T.STORM_THISTLE: {
      // Cloud-floor base + a short stem topped by a spiky electric-blue thistle:
      // a rounded puff head ringed with radiating spikes, with a brighter crown.
      ctx.fillStyle = '#e3ecf7'; ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#d2deec'; ctx.fillRect(x, y + s*0.86, s, s*0.14);
      ctx.strokeStyle = '#5a7a9a'; ctx.lineWidth = Math.max(1, s*0.05); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x + s*0.5, y + s*0.9); ctx.lineTo(x + s*0.5, y + s*0.5); ctx.stroke();
      const tcx = x + s*0.5, tcy = y + s*0.40;
      // radiating spikes
      ctx.strokeStyle = '#9cc4e6'; ctx.lineWidth = Math.max(1, s*0.03);
      for (let i = 0; i < 10; i++) {
        const a = i * Math.PI / 5;
        ctx.beginPath();
        ctx.moveTo(tcx + Math.cos(a)*s*0.10, tcy + Math.sin(a)*s*0.10);
        ctx.lineTo(tcx + Math.cos(a)*s*0.22, tcy + Math.sin(a)*s*0.22);
        ctx.stroke();
      }
      // puff head
      ctx.fillStyle = '#a8d0f0';
      ctx.beginPath(); ctx.arc(tcx, tcy, s*0.13, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#dcefff';
      ctx.beginPath(); ctx.arc(tcx - s*0.04, tcy - s*0.04, s*0.07, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(tcx - s*0.05, tcy - s*0.05, s*0.025, 0, Math.PI*2); ctx.fill();
      break; }
    case T.VOLT_BLOOM: {
      // Storm-floor base + a slender stem and a six-petal electric-blue bloom with
      // a bright crackling yellow-white core — the lightning region's storm-cloud
      // twin of the air region's pink SKY_BLOOM. Static per tile.
      ctx.fillStyle = '#2f3548'; ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#272c3c'; ctx.fillRect(x, y + s*0.86, s, s*0.14);
      ctx.strokeStyle = '#3f6a86'; ctx.lineWidth = Math.max(1, s*0.045); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x + s*0.5, y + s*0.9); ctx.lineTo(x + s*0.5, y + s*0.46); ctx.stroke();
      ctx.fillStyle = '#3e7a90';
      ctx.beginPath(); ctx.ellipse(x + s*0.40, y + s*0.70, s*0.10, s*0.045, -0.5, 0, Math.PI*2); ctx.fill();
      const vbx = x + s*0.5, vby = y + s*0.38;
      ctx.fillStyle = '#4aa6ee';                                         // electric-blue petals
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3 - Math.PI/2;
        ctx.beginPath();
        ctx.ellipse(vbx + Math.cos(a)*s*0.16, vby + Math.sin(a)*s*0.16, s*0.10, s*0.055, a, 0, Math.PI*2);
        ctx.fill();
      }
      ctx.fillStyle = '#b6e6ff';                                         // brighter inner petal faces
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3 - Math.PI/2;
        ctx.beginPath();
        ctx.ellipse(vbx + Math.cos(a)*s*0.13, vby + Math.sin(a)*s*0.13, s*0.06, s*0.03, a, 0, Math.PI*2);
        ctx.fill();
      }
      ctx.fillStyle = '#fff2a0';                                         // crackling charged core
      ctx.beginPath(); ctx.arc(vbx, vby, s*0.055, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(vbx - s*0.015, vby - s*0.015, s*0.022, 0, Math.PI*2); ctx.fill();
      break; }
    case T.SPARK_REED: {
      // Storm-floor base + a tuft of dark reed blades sweeping to one side, each
      // tipped with a bright glowing spark instead of a seed head — the storm twin
      // of the air region's golden WIND_REED. Static per tile.
      ctx.fillStyle = '#2f3548'; ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#272c3c'; ctx.fillRect(x, y + s*0.86, s, s*0.14);
      const sblade = (bx, ctrlx, tipx, tipy, base, spark) => {
        ctx.strokeStyle = base; ctx.lineWidth = Math.max(1, s*0.05); ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(bx, y + s*0.9);
        ctx.quadraticCurveTo(ctrlx, y + s*0.55, tipx, tipy);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,238,150,0.45)';                        // spark glow
        ctx.beginPath(); ctx.arc(tipx, tipy, s*0.07, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = spark;                                           // bright spark tip
        ctx.beginPath(); ctx.arc(tipx, tipy, s*0.035, 0, Math.PI*2); ctx.fill();
      };
      sblade(x + s*0.42, x + s*0.55, x + s*0.72, y + s*0.26, '#4a5570', '#fff2a0');
      sblade(x + s*0.50, x + s*0.62, x + s*0.80, y + s*0.34, '#576285', '#fff8c8');
      sblade(x + s*0.38, x + s*0.46, x + s*0.58, y + s*0.34, '#404a63', '#ffe28a');
      break; }
    case T.FULGURITE: {
      // Storm-floor base + a small cluster of angular lightning-fused glass shards
      // jutting up, each a tapered violet-white prism with a lit face and a bright
      // tip — the storm twin of the earth region's amethyst CRYSTAL_CLUSTER. Static.
      ctx.fillStyle = '#2f3548'; ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#272c3c';
      ctx.beginPath(); ctx.ellipse(x + s*0.5, y + s*0.82, s*0.30, s*0.10, 0, 0, Math.PI*2); ctx.fill();
      const fshard = (bx, tipx, tipy, halfw, base, lit, tip) => {
        const baseY = y + s*0.84;
        ctx.fillStyle = base;
        ctx.beginPath();
        ctx.moveTo(bx - halfw, baseY);
        ctx.lineTo(tipx, tipy);
        ctx.lineTo(bx + halfw, baseY);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = lit;                                             // lit left face
        ctx.beginPath();
        ctx.moveTo(bx - halfw, baseY);
        ctx.lineTo(tipx, tipy);
        ctx.lineTo(bx, baseY);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = tip;                                             // bright glassy tip
        ctx.beginPath(); ctx.arc(tipx, tipy, s*0.035, 0, Math.PI*2); ctx.fill();
      };
      fshard(x + s*0.38, x + s*0.34, y + s*0.34, s*0.11, '#6a5ec0', '#9a8fe0', '#e6e0ff');
      fshard(x + s*0.62, x + s*0.68, y + s*0.42, s*0.10, '#5a4fb0', '#8a7fd6', '#dcd4ff');
      fshard(x + s*0.50, x + s*0.50, y + s*0.24, s*0.12, '#7a6ed0', '#a89ff0', '#f2eeff');
      break; }
    case T.LUMINOUS_FLOOR: {
      // Warm, sun-washed ivory floor of the sanctum: a gentle wash of light from
      // above, fine gold flecks bedded in the stone, and the occasional mote
      // drifting and twinkling like dust caught in a shaft of sunlight.
      const tt = Date.now() / 900;
      ctx.fillStyle = 'rgba(255,251,232,0.30)'; ctx.fillRect(x, y, s, s*0.55);
      ctx.fillStyle = 'rgba(255,251,232,0.16)'; ctx.fillRect(x, y + s*0.55, s, s*0.25);
      const hf = (col * 73856093) ^ (row * 19349663);
      ctx.fillStyle = 'rgba(220,188,112,0.55)';
      ctx.fillRect(x + (hf & 7)/7*s*0.74 + s*0.12, y + ((hf>>3)&7)/7*s*0.74 + s*0.12, 2, 2);
      ctx.fillStyle = 'rgba(232,206,140,0.45)';
      ctx.fillRect(x + ((hf>>6)&7)/7*s*0.74 + s*0.12, y + ((hf>>9)&7)/7*s*0.74 + s*0.12, 1, 1);
      const tw = Math.sin(tt + col*0.7 + row*0.5);
      if (tw > 0.4) {
        const mx = x + s*0.5 + Math.sin(tt*0.8 + row)*s*0.24;
        const my = y + s*0.5 + Math.cos(tt*0.6 + col)*s*0.2;
        ctx.fillStyle = `rgba(255,246,206,${0.25 + tw*0.45})`;
        ctx.beginPath(); ctx.arc(mx, my, s*0.06*tw, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = `rgba(255,255,255,${tw*0.5})`;
        ctx.beginPath(); ctx.arc(mx, my, s*0.022*tw, 0, Math.PI*2); ctx.fill();
      }
      break; }
    case T.LUMINOUS_GLOW: {
      // A pool where the healing light gathers more thickly — brighter and warmer
      // than the surrounding floor, breathing a soft radiant bloom with a bright
      // twinkle at its heart. Dappled sparsely, so the glows read as pools.
      const tt = Date.now() / 800;
      const pulse = 0.5 + 0.5 * Math.sin(tt + col*0.4 + row*0.4);
      ctx.fillStyle = `rgba(255,250,224,${0.32 + pulse*0.20})`;
      ctx.beginPath(); ctx.arc(x + s*0.5, y + s*0.5, s*0.5, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = `rgba(255,253,240,${0.28 + pulse*0.24})`;
      ctx.beginPath(); ctx.arc(x + s*0.5, y + s*0.5, s*0.3, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${0.35 + pulse*0.45})`;
      ctx.beginPath(); ctx.arc(x + s*0.5, y + s*0.46, s*0.05, 0, Math.PI*2); ctx.fill();
      break; }
    case T.LUMINOUS_CRYSTAL: {
      // The sanctum's border: a wall of glowing white-gold crystal. A warm bed,
      // then upright faceted shards with lit faces and bright tips, washed in a
      // soft, slowly breathing halo so the frame reads as luminous, not stone.
      ctx.fillStyle = '#e9cd86'; ctx.fillRect(x, y, s, s);
      const sh = 0.4 + 0.12 * Math.sin(Date.now()/700 + col*0.5 + row*0.5);
      ctx.fillStyle = `rgba(255,248,214,${sh})`;
      ctx.beginPath(); ctx.arc(x + s*0.5, y + s*0.5, s*0.52, 0, Math.PI*2); ctx.fill();
      const cshard = (bx, halfw, tipy, base, lit, tip) => {
        const baseY = y + s*0.98;
        ctx.fillStyle = base;
        ctx.beginPath();
        ctx.moveTo(x + s*(bx - halfw), baseY);
        ctx.lineTo(x + s*bx, y + s*tipy);
        ctx.lineTo(x + s*(bx + halfw), baseY);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = lit;
        ctx.beginPath();
        ctx.moveTo(x + s*(bx - halfw), baseY);
        ctx.lineTo(x + s*bx, y + s*tipy);
        ctx.lineTo(x + s*bx, baseY);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = tip;
        ctx.beginPath(); ctx.arc(x + s*bx, y + s*tipy, s*0.05, 0, Math.PI*2); ctx.fill();
      };
      cshard(0.28, 0.16, 0.30, '#f0d99a', '#fbeec2', '#ffffff');
      cshard(0.70, 0.15, 0.22, '#ecd592', '#f8e8b8', '#fffdf2');
      cshard(0.50, 0.20, 0.08, '#f6e3ab', '#fff2cc', '#ffffff');
      break; }
    case T.RADIANT_BLOOM: {
      // Floor base + a slender stem and a six-petal white-gold bloom ringed by a
      // soft, breathing halo of light with a brilliant glowing core — the luminous
      // sanctum's flower, twin of the air region's pink SKY_BLOOM.
      ctx.fillStyle = '#f5edd8'; ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#ece1c4'; ctx.fillRect(x, y + s*0.86, s, s*0.14);
      ctx.strokeStyle = '#b8a86a'; ctx.lineWidth = Math.max(1, s*0.045); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x + s*0.5, y + s*0.9); ctx.lineTo(x + s*0.5, y + s*0.46); ctx.stroke();
      ctx.fillStyle = '#cdb96e';
      ctx.beginPath(); ctx.ellipse(x + s*0.40, y + s*0.70, s*0.10, s*0.045, -0.5, 0, Math.PI*2); ctx.fill();
      const rbx = x + s*0.5, rby = y + s*0.38;
      const halo = 0.4 + 0.18 * Math.sin(Date.now()/600 + col*0.6 + row*0.6);
      ctx.fillStyle = `rgba(255,244,200,${halo})`;
      ctx.beginPath(); ctx.arc(rbx, rby, s*0.30, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fbf3da';
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3 - Math.PI/2;
        ctx.beginPath();
        ctx.ellipse(rbx + Math.cos(a)*s*0.16, rby + Math.sin(a)*s*0.16, s*0.10, s*0.055, a, 0, Math.PI*2);
        ctx.fill();
      }
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3 - Math.PI/2;
        ctx.beginPath();
        ctx.ellipse(rbx + Math.cos(a)*s*0.13, rby + Math.sin(a)*s*0.13, s*0.06, s*0.03, a, 0, Math.PI*2);
        ctx.fill();
      }
      ctx.fillStyle = '#f2c84a';
      ctx.beginPath(); ctx.arc(rbx, rby, s*0.055, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff7d8';
      ctx.beginPath(); ctx.arc(rbx - s*0.015, rby - s*0.015, s*0.025, 0, Math.PI*2); ctx.fill();
      break; }
    case T.GLOW_REED: {
      // Floor base + a tuft of slender pale-gold light-stalks, each rising and
      // tipped with a softly glowing mote of warm light — the luminous twin of the
      // air region's golden WIND_REED, standing still in the hallowed calm. Static.
      ctx.fillStyle = '#f5edd8'; ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#ece1c4'; ctx.fillRect(x, y + s*0.86, s, s*0.14);
      const stalk = (bx, ctrlx, tipx, tipy, base) => {
        ctx.strokeStyle = base; ctx.lineWidth = Math.max(1, s*0.05); ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(bx, y + s*0.9);
        ctx.quadraticCurveTo(ctrlx, y + s*0.55, tipx, tipy);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,244,190,0.5)';
        ctx.beginPath(); ctx.arc(tipx, tipy, s*0.08, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fff6d6';
        ctx.beginPath(); ctx.arc(tipx, tipy, s*0.035, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(tipx - s*0.01, tipy - s*0.01, s*0.015, 0, Math.PI*2); ctx.fill();
      };
      stalk(x + s*0.42, x + s*0.50, x + s*0.60, y + s*0.24, '#d8c684');
      stalk(x + s*0.52, x + s*0.60, x + s*0.72, y + s*0.32, '#e4d49a');
      stalk(x + s*0.38, x + s*0.40, x + s*0.42, y + s*0.30, '#ccb86e');
      break; }
    case T.LUMEN_SHARD: {
      // Floor base + a small cluster of glowing white-gold crystal shards jutting
      // up, each a tapered prism with a lit face and a brilliant tip, wrapped in a
      // soft breathing halo — the luminous twin of the earth region's amethyst.
      ctx.fillStyle = '#f5edd8'; ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#ece1c4';
      ctx.beginPath(); ctx.ellipse(x + s*0.5, y + s*0.82, s*0.30, s*0.10, 0, 0, Math.PI*2); ctx.fill();
      const lhalo = 0.32 + 0.14 * Math.sin(Date.now()/650 + col*0.5 + row*0.5);
      ctx.fillStyle = `rgba(255,246,206,${lhalo})`;
      ctx.beginPath(); ctx.arc(x + s*0.5, y + s*0.5, s*0.34, 0, Math.PI*2); ctx.fill();
      const lshard = (bx, tipx, tipy, halfw, base, lit, tip) => {
        const baseY = y + s*0.84;
        ctx.fillStyle = base;
        ctx.beginPath();
        ctx.moveTo(bx - halfw, baseY); ctx.lineTo(tipx, tipy); ctx.lineTo(bx + halfw, baseY);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = lit;
        ctx.beginPath();
        ctx.moveTo(bx - halfw, baseY); ctx.lineTo(tipx, tipy); ctx.lineTo(bx, baseY);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = tip;
        ctx.beginPath(); ctx.arc(tipx, tipy, s*0.04, 0, Math.PI*2); ctx.fill();
      };
      lshard(x + s*0.38, x + s*0.34, y + s*0.34, s*0.11, '#e6cf90', '#f6e8bc', '#ffffff');
      lshard(x + s*0.62, x + s*0.68, y + s*0.42, s*0.10, '#dcc684', '#efdcab', '#fffdf0');
      lshard(x + s*0.50, x + s*0.50, y + s*0.22, s*0.12, '#f0dba0', '#fdefca', '#ffffff');
      break; }
    case T.LIGHT_PILLAR: {
      // A solid shaft of radiant light rising from the sanctum floor — a luminous
      // landmark. A warm-gold crystalline column with a brilliant white core,
      // breathing a soft halo, capped in light at the top.
      ctx.fillStyle = '#f4ead0'; ctx.fillRect(x, y, s, s);
      const pulse = 0.5 + 0.5 * Math.sin(Date.now()/700 + col*0.4 + row*0.4);
      ctx.fillStyle = `rgba(255,246,206,${0.4 + pulse*0.25})`;
      ctx.beginPath(); ctx.arc(x + s*0.5, y + s*0.5, s*0.5, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#f0dca0';
      ctx.beginPath();
      ctx.moveTo(x + s*0.34, y + s*0.96); ctx.lineTo(x + s*0.40, y + s*0.06);
      ctx.lineTo(x + s*0.60, y + s*0.06); ctx.lineTo(x + s*0.66, y + s*0.96);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff8e4';
      ctx.beginPath();
      ctx.moveTo(x + s*0.42, y + s*0.96); ctx.lineTo(x + s*0.46, y + s*0.06);
      ctx.lineTo(x + s*0.54, y + s*0.06); ctx.lineTo(x + s*0.58, y + s*0.96);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = `rgba(255,255,255,${0.7 + pulse*0.3})`; ctx.lineWidth = Math.max(1, s*0.04);
      ctx.beginPath(); ctx.moveTo(x + s*0.5, y + s*0.04); ctx.lineTo(x + s*0.5, y + s*0.96); ctx.stroke();
      ctx.fillStyle = `rgba(255,255,255,${0.5 + pulse*0.4})`;
      ctx.beginPath(); ctx.arc(x + s*0.5, y + s*0.1, s*0.1, 0, Math.PI*2); ctx.fill();
      break; }
    case T.BONES: {
      // Sand backdrop + a small bleached skull-and-rib silhouette.
      ctx.fillStyle = '#d4b070'; ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#f0e8c8';
      ctx.beginPath(); ctx.arc(x + s*0.35, y + s*0.45, s*0.16, 0, Math.PI*2); ctx.fill();
      ctx.fillRect(x + s*0.48, y + s*0.50, s*0.40, 2);
      ctx.fillRect(x + s*0.48, y + s*0.62, s*0.30, 2);
      ctx.fillRect(x + s*0.48, y + s*0.74, s*0.22, 2);
      ctx.fillStyle = '#5a4a30';
      ctx.fillRect(x + s*0.30, y + s*0.42, 2, 2);
      ctx.fillRect(x + s*0.38, y + s*0.42, 2, 2);
      break; }
    case T.BLIGHT: {
      // Blighted underworld earth — a dark mottled purple-grey crust patched with
      // rot, raked by hairline cracks, and breathing a faint sickly-green miasma.
      // Detail is hashed per tile so the wastes read as living decay, not a grid.
      const h = (col * 131 + row * 83);
      const j = (a, n) => (((h >> a) & 3) / 3) * n;
      ctx.fillStyle = '#352637'; ctx.fillRect(x, y, s, s);            // base crust
      ctx.fillStyle = '#2a1b2c';                                       // rot blotches
      ctx.beginPath(); ctx.arc(x + s*(0.30 + j(0,0.35)), y + s*(0.32 + j(2,0.30)), s*(0.13 + j(4,0.06)), 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + s*(0.66 - j(6,0.20)), y + s*(0.70 - j(8,0.20)), s*(0.10 + j(10,0.05)), 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#45354b';                                       // pale ashen scuff
      ctx.fillRect(x + s*(0.12 + j(2,0.20)), y + s*(0.16 + j(0,0.30)), s*0.16, s*0.045);
      ctx.strokeStyle = '#1c121f'; ctx.lineWidth = 1;                  // hairline crack
      ctx.beginPath();
      ctx.moveTo(x + s*(0.18 + j(4,0.20)), y + s*(0.84 - j(6,0.20)));
      ctx.lineTo(x + s*(0.46 + j(8,0.18)), y + s*(0.56 - j(2,0.18)));
      ctx.lineTo(x + s*(0.82 - j(0,0.20)), y + s*(0.70 - j(4,0.18)));
      ctx.stroke();
      if ((h & 1) === 0) {                                             // miasma breath on ~half
        const mia = 0.05 + 0.05 * Math.sin(Date.now()/900 + col*0.7 + row*0.5);
        ctx.fillStyle = `rgba(120,170,70,${mia})`;
        ctx.beginPath(); ctx.arc(x + s*(0.5 + j(6,0.18)), y + s*(0.5 - j(8,0.18)), s*0.34, 0, Math.PI*2); ctx.fill();
      }
      break; }
    case T.BLIGHTED_WALL: {
      // Crypt wall of the necrotic wastes — packed grave-dark stone, faceted and
      // mortar-seamed, veined with a faint breathing necrotic-green glow and
      // embedded with bones (a half-buried skull or a rib cage). Hashed per tile
      // so the catacomb wall never reads as a tiled grid.
      const h = (col * 131 + row * 83);
      const j = (a, n) => (((h >> a) & 3) / 3) * n;
      ctx.fillStyle = '#1a0e1c'; ctx.fillRect(x, y, s, s);            // grave-dark stone
      ctx.fillStyle = '#281830';                                       // lit block (upper-left)
      ctx.fillRect(x, y, s*(0.58 + j(0,0.18)), s*(0.50 + j(2,0.16)));
      ctx.fillStyle = '#120812';                                       // shadowed recess (lower-right)
      ctx.fillRect(x + s*(0.50 - j(4,0.10)), y + s*(0.50 + j(6,0.08)), s*0.5, s*0.5);
      ctx.strokeStyle = '#0c060e'; ctx.lineWidth = 1;                  // mortar seam
      ctx.beginPath(); ctx.moveTo(x, y + s*(0.50 + j(8,0.10))); ctx.lineTo(x + s, y + s*(0.46 + j(0,0.10))); ctx.stroke();
      const gl = 0.28 + 0.18 * Math.sin(Date.now()/700 + col*0.6 + row*0.4);   // necrotic vein glow
      ctx.strokeStyle = `rgba(126,196,92,${gl})`; ctx.lineWidth = Math.max(1, s*0.04); ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x + s*(0.20 + j(2,0.18)), y + s*0.08);
      ctx.lineTo(x + s*(0.42 + j(4,0.10)), y + s*0.50);
      ctx.lineTo(x + s*(0.30 + j(6,0.18)), y + s*0.94);
      ctx.stroke();
      ctx.fillStyle = '#cfc6ac';                                       // embedded bone
      if ((h % 3) === 0) {
        const skx = x + s*(0.62 + j(8,0.08)), sky = y + s*(0.60 - j(0,0.08));
        ctx.beginPath(); ctx.arc(skx, sky, s*0.13, 0, Math.PI*2); ctx.fill();
        ctx.fillRect(skx - s*0.10, sky + s*0.08, s*0.20, s*0.07);     // jaw
        ctx.fillStyle = '#0c060e';
        ctx.fillRect(skx - s*0.075, sky - s*0.02, s*0.045, s*0.045);  // eye sockets
        ctx.fillRect(skx + s*0.03,  sky - s*0.02, s*0.045, s*0.045);
        ctx.fillRect(skx - s*0.012, sky + s*0.04, s*0.025, s*0.04);   // nasal
      } else {
        const rbx = x + s*(0.66 + j(8,0.06)), rby = y + s*(0.28 + j(2,0.10));
        ctx.fillRect(rbx, rby, s*0.022, s*0.36);                      // spine
        for (let i = 0; i < 3; i++) {
          ctx.fillRect(rbx - s*0.12, rby + i*s*0.12, s*0.12, s*0.025);
          ctx.fillRect(rbx + s*0.02, rby + i*s*0.12, s*0.12, s*0.025);
        }
      }
      break; }
    case T.GRAVE_DIRT: {
      // A mound of fresh-turned grave soil heaped on the blight — darker churned
      // earth, raked furrows, and a stray splinter of bone working its way up.
      // Hashed per tile; static.
      const h = (col * 137 + row * 89);
      const j = (a, n) => (((h >> a) & 3) / 3) * n;
      ctx.fillStyle = '#352637'; ctx.fillRect(x, y, s, s);            // blight base
      ctx.fillStyle = '#241a1c';                                       // heaped mound
      ctx.beginPath(); ctx.ellipse(x + s*0.5, y + s*0.64, s*0.40, s*0.26, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#2f2122';
      ctx.beginPath(); ctx.ellipse(x + s*0.5, y + s*0.58, s*0.32, s*0.19, 0, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#1a1214'; ctx.lineWidth = 1;                  // raked furrows
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(x + s*(0.26 + i*0.18 + j(0,0.04)), y + s*0.48);
        ctx.lineTo(x + s*(0.32 + i*0.18 + j(2,0.04)), y + s*0.80);
        ctx.stroke();
      }
      ctx.strokeStyle = '#cfc6ac'; ctx.lineWidth = Math.max(1, s*0.04); ctx.lineCap = 'round';  // bone splinter
      ctx.beginPath();
      ctx.moveTo(x + s*(0.58 + j(4,0.1)), y + s*0.62);
      ctx.lineTo(x + s*(0.66 + j(6,0.1)), y + s*0.44);
      ctx.stroke();
      break; }
    case T.DEAD_TREE: {
      // A gnarled, leafless dead tree clawing up from the wastes — the necrotic
      // region's border growth (replaces stretches of crypt wall, like the ice
      // region's snow pines). Grave-dark backdrop, a twisted pale-grey trunk
      // leaning per hash, and bare forking branches. Static, solid.
      const h = (col * 131 + row * 83);
      const lean = (((h >> 0) & 3) / 3 - 0.5) * 0.16;
      ctx.fillStyle = '#160c18'; ctx.fillRect(x, y, s, s);            // grave-dark backdrop
      const bx = x + s*0.5, basey = y + s*0.97, forky = y + s*0.46;
      ctx.strokeStyle = '#4a4048'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(1.5, s*0.10);                           // trunk
      ctx.beginPath(); ctx.moveTo(bx, basey); ctx.lineTo(x + s*(0.5+lean), forky); ctx.stroke();
      ctx.lineWidth = Math.max(1, s*0.05);                             // branches
      const branch = (x1,y1,x2,y2,x3,y3) => {
        ctx.beginPath(); ctx.moveTo(x + s*x1, y + s*y1);
        ctx.lineTo(x + s*x2, y + s*y2); ctx.lineTo(x + s*x3, y + s*y3); ctx.stroke();
      };
      branch(0.5+lean, 0.52, 0.28, 0.36, 0.14, 0.20);
      branch(0.5+lean, 0.46, 0.72, 0.30, 0.86, 0.14);
      branch(0.5+lean, 0.46, 0.5+lean*1.6, 0.18, 0.40, 0.06);
      ctx.strokeStyle = '#5e5460'; ctx.lineWidth = Math.max(1, s*0.03);  // trunk highlight
      ctx.beginPath(); ctx.moveTo(bx - s*0.02, basey); ctx.lineTo(x + s*(0.5+lean) - s*0.02, forky); ctx.stroke();
      break; }
    case T.WITHERED_SHRUB: {
      // A dead, leafless bramble of grey thorny twigs — the wastes' withered shrub
      // (cut for bone meal). Blight base with a faint shadow, then a tangle of bare
      // forking twigs ticked with thorns and clinging a couple of shrivelled
      // berries. Static.
      ctx.fillStyle = '#352637'; ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#281c2a'; ctx.beginPath(); ctx.ellipse(x+s*0.5, y+s*0.82, s*0.30, s*0.08, 0,0,Math.PI*2); ctx.fill();
      ctx.lineCap = 'round';
      const twig = (x1,y1,x2,y2,w) => { ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x+s*x1,y+s*y1); ctx.lineTo(x+s*x2,y+s*y2); ctx.stroke(); };
      ctx.strokeStyle = '#6a5a52';
      twig(0.5,0.86, 0.36,0.40, Math.max(1,s*0.045)); twig(0.36,0.40, 0.22,0.22, Math.max(1,s*0.04)); twig(0.36,0.40, 0.42,0.18, Math.max(1,s*0.035));
      twig(0.5,0.86, 0.62,0.44, Math.max(1,s*0.045)); twig(0.62,0.44, 0.78,0.28, Math.max(1,s*0.04)); twig(0.62,0.44, 0.58,0.20, Math.max(1,s*0.035));
      twig(0.5,0.86, 0.5,0.32, Math.max(1,s*0.04));
      ctx.strokeStyle = '#7a6a60';                                     // thorns
      twig(0.30,0.30, 0.24,0.34, Math.max(1,s*0.022)); twig(0.70,0.34, 0.76,0.38, Math.max(1,s*0.022)); twig(0.46,0.24, 0.40,0.28, Math.max(1,s*0.022));
      ctx.fillStyle = '#4a2a3a';                                       // shrivelled berries
      ctx.beginPath(); ctx.arc(x+s*0.42,y+s*0.30, s*0.04,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(x+s*0.66,y+s*0.36, s*0.035,0,Math.PI*2); ctx.fill();
      break; }
    case T.CORPSE_FLOWER: {
      // A carrion bloom of the underworld — a drooping black stalk with a limp
      // leaf, crowned by a pale, sickly grey-green flower exhaling a faint, slowly
      // breathing spore-glow over a dark rotten core (cut for bone meal). Blight base.
      ctx.fillStyle = '#352637'; ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#281c2a'; ctx.beginPath(); ctx.ellipse(x+s*0.5, y+s*0.84, s*0.26, s*0.07, 0,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#3a2e34'; ctx.lineWidth = Math.max(1, s*0.05); ctx.lineCap = 'round';   // drooping stalk
      ctx.beginPath(); ctx.moveTo(x+s*0.5, y+s*0.9); ctx.quadraticCurveTo(x+s*0.62, y+s*0.58, x+s*0.5, y+s*0.42); ctx.stroke();
      ctx.fillStyle = '#4a4a30';                                       // limp leaf
      ctx.beginPath(); ctx.ellipse(x+s*0.36, y+s*0.66, s*0.11, s*0.04, -0.3, 0, Math.PI*2); ctx.fill();
      const fcx = x+s*0.5, fcy = y+s*0.36;
      const gl = 0.16 + 0.12*Math.sin(Date.now()/700 + col*0.6 + row*0.6);   // spore-glow halo
      ctx.fillStyle = `rgba(150,190,90,${gl})`;
      ctx.beginPath(); ctx.arc(fcx, fcy, s*0.24, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#b9c29a';                                       // sickly five-petal bloom
      for (let i=0;i<5;i++){ const a=i*Math.PI*2/5 - Math.PI/2; ctx.beginPath(); ctx.ellipse(fcx+Math.cos(a)*s*0.13, fcy+Math.sin(a)*s*0.13, s*0.09, s*0.05, a, 0, Math.PI*2); ctx.fill(); }
      ctx.fillStyle = '#3a2a1a'; ctx.beginPath(); ctx.arc(fcx, fcy, s*0.06, 0, Math.PI*2); ctx.fill();        // rotten core
      ctx.fillStyle = '#7a8a4a'; ctx.beginPath(); ctx.arc(fcx-s*0.015, fcy-s*0.015, s*0.025, 0, Math.PI*2); ctx.fill();
      break; }
    case T.BONE_PILE: {
      // A heap of bones cast across the blight — crossed long bones, a grinning
      // skull, and a jaw (cut for bone meal). The necrotic region's blight-backed
      // answer to the desert's sand-backed BONES. Static.
      ctx.fillStyle = '#352637'; ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#281c2a'; ctx.beginPath(); ctx.ellipse(x+s*0.5, y+s*0.78, s*0.34, s*0.10, 0,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#d8cfb2'; ctx.lineWidth = Math.max(1.5, s*0.07); ctx.lineCap = 'round';   // crossed long bones
      ctx.beginPath(); ctx.moveTo(x+s*0.26, y+s*0.74); ctx.lineTo(x+s*0.74, y+s*0.56); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x+s*0.30, y+s*0.56); ctx.lineTo(x+s*0.70, y+s*0.78); ctx.stroke();
      const skx = x+s*0.42, sky = y+s*0.40;                            // skull
      ctx.fillStyle = '#e6dcc0'; ctx.beginPath(); ctx.arc(skx, sky, s*0.16, 0, Math.PI*2); ctx.fill();
      ctx.fillRect(skx - s*0.10, sky + s*0.10, s*0.20, s*0.10);        // jaw
      ctx.fillStyle = '#2a1d22';
      ctx.beginPath(); ctx.arc(skx - s*0.06, sky - s*0.01, s*0.035, 0, Math.PI*2); ctx.fill();   // eye sockets
      ctx.beginPath(); ctx.arc(skx + s*0.06, sky - s*0.01, s*0.035, 0, Math.PI*2); ctx.fill();
      ctx.fillRect(skx - s*0.015, sky + s*0.05, s*0.03, s*0.05);       // nasal
      ctx.fillRect(skx - s*0.06, sky + s*0.13, s*0.025, s*0.05);       // teeth gaps
      ctx.fillRect(skx + s*0.035, sky + s*0.13, s*0.025, s*0.05);
      break; }
    case T.TOMBSTONE: {
      // A cracked, leaning headstone rising from the wastes — a solid graveyard
      // landmark. Blight base with a cast shadow, a rounded grey slab canted to one
      // side (per hash), a chiselled cross, a fracture, and dead lichen at its foot.
      const h = (col * 137 + row * 71);
      const lean = (((h >> 0) & 3) / 3 - 0.5) * 0.16;
      ctx.fillStyle = '#352637'; ctx.fillRect(x, y, s, s);            // blight base
      ctx.fillStyle = '#221820';                                       // cast shadow
      ctx.beginPath(); ctx.ellipse(x+s*0.54, y+s*0.86, s*0.34, s*0.09, 0,0,Math.PI*2); ctx.fill();
      ctx.save();
      ctx.translate(x+s*0.5, y+s*0.7); ctx.rotate(lean); ctx.translate(-(x+s*0.5), -(y+s*0.7));
      ctx.fillStyle = '#6a6470';                                       // rounded slab body
      ctx.beginPath();
      ctx.moveTo(x+s*0.30, y+s*0.88);
      ctx.lineTo(x+s*0.30, y+s*0.36);
      ctx.arc(x+s*0.5, y+s*0.36, s*0.20, Math.PI, 0);
      ctx.lineTo(x+s*0.70, y+s*0.88);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#807a86'; ctx.fillRect(x+s*0.30, y+s*0.36, s*0.05, s*0.52);   // lit left edge
      ctx.fillStyle = '#4e4856'; ctx.fillRect(x+s*0.65, y+s*0.36, s*0.05, s*0.52);   // shadowed right edge
      ctx.fillStyle = '#3e3844';                                       // chiselled cross
      ctx.fillRect(x+s*0.47, y+s*0.42, s*0.06, s*0.26);
      ctx.fillRect(x+s*0.40, y+s*0.50, s*0.20, s*0.06);
      ctx.strokeStyle = '#2e2a34'; ctx.lineWidth = 1;                  // fracture
      ctx.beginPath(); ctx.moveTo(x+s*0.40, y+s*0.30); ctx.lineTo(x+s*0.52, y+s*0.52); ctx.lineTo(x+s*0.44, y+s*0.76); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#4a5a30';                                       // dead lichen at the foot
      ctx.beginPath(); ctx.arc(x+s*0.36, y+s*0.84, s*0.04, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(x+s*0.62, y+s*0.86, s*0.03, 0, Math.PI*2); ctx.fill();
      break; }
    case T.SLUDGE: {
      // Swamp mire floor — a murky olive muck mottled with dark wet blotches and
      // patches of pale algae scum, weeping a stray gas bubble or two. Hashed per
      // tile so the swamp reads as living muck rather than a flat green grid. Static.
      const h = (col * 131 + row * 83);
      const j = (a, n) => (((h >> a) & 3) / 3) * n;
      ctx.fillStyle = '#4a5a26'; ctx.fillRect(x, y, s, s);            // murky mire base
      ctx.fillStyle = '#3b4a1e';                                       // dark wet blotches
      ctx.beginPath(); ctx.ellipse(x+s*(0.32+j(0,0.30)), y+s*(0.34+j(2,0.28)), s*(0.16+j(4,0.06)), s*(0.11+j(6,0.05)), 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x+s*(0.68-j(8,0.20)), y+s*(0.70-j(10,0.20)), s*(0.13+j(0,0.05)), s*(0.09+j(2,0.04)), 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#6f8438';                                       // pale algae scum
      ctx.beginPath(); ctx.ellipse(x+s*(0.60+j(4,0.20)), y+s*(0.30+j(6,0.20)), s*0.10, s*0.06, 0.4, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#5a6c2e'; ctx.fillRect(x+s*(0.14+j(2,0.10)), y+s*(0.60+j(8,0.10)), s*0.12, s*0.04);  // muck streak
      ctx.fillStyle = '#7b8c44';                                       // gas bubbles
      ctx.beginPath(); ctx.arc(x+s*(0.44+j(6,0.20)), y+s*(0.50-j(4,0.20)), s*0.03, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(x+s*(0.50+j(10,0.20)), y+s*(0.62-j(0,0.20)), s*0.022, 0, Math.PI*2); ctx.fill();
      break; }
    case T.POISON_WALL: {
      // Dense swamp thicket — the impassable border. Layered clumps of dark, rank
      // foliage massed over a deep shadow, a hanging vine, a sickly-lit crown, and a
      // glowing spore or two. Hashed per tile so the hedge never reads as a grid.
      const h = (col * 131 + row * 83);
      const j = (a, n) => (((h >> a) & 3) / 3) * n;
      ctx.fillStyle = '#16280e'; ctx.fillRect(x, y, s, s);            // deep thicket shadow
      ctx.fillStyle = '#1f3a14';                                       // massed foliage clumps
      ctx.beginPath(); ctx.arc(x+s*(0.32+j(0,0.12)), y+s*(0.40+j(2,0.12)), s*(0.34+j(4,0.06)), 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(x+s*(0.70-j(6,0.12)), y+s*(0.58-j(8,0.12)), s*(0.30+j(10,0.06)), 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#2c4d1c';
      ctx.beginPath(); ctx.arc(x+s*(0.50+j(2,0.12)), y+s*(0.34+j(6,0.10)), s*0.22, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#3a6126';                                       // sickly-lit leaves (upper-left)
      ctx.beginPath(); ctx.arc(x+s*(0.34+j(4,0.10)), y+s*(0.30+j(0,0.10)), s*0.12, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#24401a'; ctx.lineWidth = Math.max(1, s*0.04); ctx.lineCap = 'round';   // hanging vine
      ctx.beginPath();
      ctx.moveTo(x+s*(0.62+j(8,0.10)), y);
      ctx.quadraticCurveTo(x+s*(0.70+j(2,0.10)), y+s*0.40, x+s*(0.60+j(6,0.10)), y+s*0.80);
      ctx.stroke();
      ctx.fillStyle = '#6fae3a';                                       // glowing spore
      ctx.beginPath(); ctx.arc(x+s*(0.46+j(0,0.10)), y+s*(0.52+j(8,0.10)), s*0.03, 0, Math.PI*2); ctx.fill();
      break; }
    case T.BOG: {
      // A sunken, waterlogged bog hollow churned into the mire — darker, wetter muck
      // with a glossy skin of standing water, a reflective glint, and a gas bubble
      // slowly rising and bursting. The hollow's centre and size are jittered per
      // tile so a cluster of bogs reads as organic puddles, not a grid of pods.
      // Trudging through it halves walk speed. Animated.
      const h = (col * 137 + row * 71);
      const j = (a, n) => (((h >> a) & 3) / 3) * n;
      const hcx = 0.5 + j(0,0.18) - 0.09, hcy = 0.56 + j(2,0.16) - 0.08;   // hollow centre
      ctx.fillStyle = '#39481d'; ctx.fillRect(x, y, s, s);            // wet mire base
      ctx.fillStyle = '#2a3716';                                       // sunken hollow
      ctx.beginPath(); ctx.ellipse(x+s*hcx, y+s*hcy, s*(0.34+j(4,0.12)), s*(0.27+j(6,0.10)), j(8,0.6), 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#46602a';                                       // glossy standing-water skin
      ctx.beginPath(); ctx.ellipse(x+s*(hcx-0.02), y+s*(hcy-0.06), s*(0.22+j(10,0.08)), s*0.16, j(8,0.6), 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(150,190,120,0.35)';                        // reflective highlight
      ctx.beginPath(); ctx.ellipse(x+s*(hcx-0.10), y+s*(hcy-0.12), s*0.10, s*0.04, -0.4, 0, Math.PI*2); ctx.fill();
      const bb = 0.5 + 0.5*Math.sin(Date.now()/600 + col*0.7 + row*0.5);   // rising gas bubble
      ctx.fillStyle = `rgba(170,200,120,${0.30+0.30*bb})`;
      ctx.beginPath(); ctx.arc(x+s*(hcx+0.12), y+s*(hcy+0.02-bb*0.12), s*0.035, 0, Math.PI*2); ctx.fill();
      break; }
    case T.BOG_POOL: {
      // A deep pool of stagnant bog water — the poison region's accent (crossed by
      // plank bridges). Near-black toxic murk with a darker trough below, drifting
      // streaks of green scum on the surface, and a lily pad floating on some tiles.
      // Surface slides slowly; the murky counterpart of the water region's depths.
      const tt = Date.now() / 800;
      const a = Math.sin(tt + col * 0.5 + row * 0.3);
      const h = (col * 131 + row * 83);
      ctx.fillStyle = '#16280f'; ctx.fillRect(x, y, s, s);            // deep murk base
      ctx.fillStyle = '#1d3415'; ctx.fillRect(x, y + s*0.5, s, s*0.5); // darker deep trough
      ctx.fillStyle = '#33521f'; ctx.fillRect(x+s*0.10, y+s*0.30+a*2, s*0.50, s*0.05);   // scum streaks
      ctx.fillStyle = '#284018'; ctx.fillRect(x+s*0.45, y+s*0.62-a*2, s*0.40, s*0.05);
      if ((h & 1) === 0) {                                             // green scum film
        ctx.fillStyle = '#4a7a2c';
        ctx.beginPath(); ctx.ellipse(x+s*0.5, y+s*0.5, s*0.18, s*0.10, 0, 0, Math.PI*2); ctx.fill();
      }
      if ((h % 4) === 0) {                                            // floating lily pad
        const lx = x + s*(0.40 + ((h>>3)&3)/3*0.28), ly = y + s*(0.38 + ((h>>5)&3)/3*0.30);
        ctx.fillStyle = '#3f7a30';
        ctx.beginPath(); ctx.arc(lx, ly, s*0.15, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#1a2f13';                                     // notch wedge
        ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx+s*0.17, ly-s*0.07); ctx.lineTo(lx+s*0.17, ly+s*0.07); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#4f9038';                                     // pad highlight
        ctx.beginPath(); ctx.arc(lx-s*0.03, ly-s*0.03, s*0.06, 0, Math.PI*2); ctx.fill();
      }
      break; }
    case T.CATTAIL: {
      // A clump of bulrush reeds in the mire — arching reed blades and a couple of
      // brown cattail seed-heads on tall stalks (cut for an Herbal). Muck base with
      // a wet shadow. Static.
      ctx.fillStyle = '#4a5a26'; ctx.fillRect(x, y, s, s);            // muck base
      ctx.fillStyle = '#3b4a1e'; ctx.beginPath(); ctx.ellipse(x+s*0.5, y+s*0.84, s*0.30, s*0.08, 0,0,Math.PI*2); ctx.fill();  // wet shadow
      ctx.lineCap = 'round';
      const reed = (tx, col2) => { ctx.strokeStyle = col2; ctx.lineWidth = Math.max(1, s*0.04);
        ctx.beginPath(); ctx.moveTo(x+s*0.5, y+s*0.9); ctx.quadraticCurveTo(x+s*(0.5+(tx-0.5)*0.5), y+s*0.42, x+s*tx, y+s*0.12); ctx.stroke(); };
      reed(0.30, '#5c8a34'); reed(0.72, '#5c8a34'); reed(0.52, '#6a9a40');
      reed(0.40, '#4a722a'); reed(0.62, '#4a722a');
      ctx.strokeStyle = '#6a8a3a'; ctx.lineWidth = Math.max(1, s*0.05);   // cattail stalks
      ctx.beginPath(); ctx.moveTo(x+s*0.42, y+s*0.9); ctx.lineTo(x+s*0.42, y+s*0.32); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x+s*0.60, y+s*0.9); ctx.lineTo(x+s*0.60, y+s*0.40); ctx.stroke();
      ctx.fillStyle = '#6b4a22';                                       // brown bulrush spikes
      ctx.beginPath(); ctx.ellipse(x+s*0.42, y+s*0.26, s*0.06, s*0.13, 0,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x+s*0.60, y+s*0.34, s*0.05, s*0.11, 0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#8a6533';                                       // spike highlight
      ctx.beginPath(); ctx.ellipse(x+s*0.405, y+s*0.22, s*0.02, s*0.05, 0,0,Math.PI*2); ctx.fill();
      break; }
    case T.SWAMP_FERN: {
      // A bushy marsh fern — a fanning rosette of arching fronds ticked with
      // leaflets, lusher and broader than the forest fern (cut for an Herbal). Muck
      // base with a wet shadow. Static.
      ctx.fillStyle = '#4a5a26'; ctx.fillRect(x, y, s, s);            // muck base
      ctx.fillStyle = '#3b4a1e'; ctx.beginPath(); ctx.ellipse(x+s*0.5, y+s*0.82, s*0.28, s*0.08, 0,0,Math.PI*2); ctx.fill();
      const cx2 = x+s*0.5, base = y+s*0.86;
      for (let i = 0; i < 5; i++) {
        const ang = -Math.PI/2 + (i-2)*0.5;                           // fan the fronds out
        const tipx = cx2 + Math.cos(ang)*s*0.42, tipy = base + Math.sin(ang)*s*0.42;
        const midx = cx2 + Math.cos(ang)*s*0.22 - Math.sin(ang)*s*0.06, midy = base + Math.sin(ang)*s*0.22;
        ctx.strokeStyle = (i % 2) ? '#3f7a30' : '#4f8f38'; ctx.lineWidth = Math.max(1, s*0.045); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(cx2, base); ctx.quadraticCurveTo(midx, midy, tipx, tipy); ctx.stroke();
        ctx.lineWidth = Math.max(1, s*0.02);                          // leaflet ticks
        for (let k = 1; k <= 3; k++) {
          const t = k/4, px = cx2 + (tipx-cx2)*t, py = base + (tipy-base)*t;
          ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px+Math.cos(ang+1.2)*s*0.06, py+Math.sin(ang+1.2)*s*0.06); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px+Math.cos(ang-1.2)*s*0.06, py+Math.sin(ang-1.2)*s*0.06); ctx.stroke();
        }
      }
      break; }
    case T.MANGROVE: {
      // A gnarled, moss-draped mangrove clawing up out of the thicket — the swamp's
      // border tree (replaces stretches of POISON_WALL, like the necrotic region's
      // dead trees). Deep shadow, splayed prop roots, a leaning trunk, a heavy dark
      // canopy with a sickly-lit crown, and curtains of hanging moss. Static, solid.
      const h = (col * 131 + row * 83);
      const lean = (((h >> 0) & 3) / 3 - 0.5) * 0.14;
      ctx.fillStyle = '#14240d'; ctx.fillRect(x, y, s, s);            // deep swamp shadow
      ctx.strokeStyle = '#3a2e1c'; ctx.lineWidth = Math.max(1, s*0.05); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(x+s*0.5, y+s*0.70); ctx.quadraticCurveTo(x+s*0.34, y+s*0.82, x+s*0.24, y+s*0.98); ctx.stroke();  // prop roots
      ctx.beginPath(); ctx.moveTo(x+s*0.5, y+s*0.70); ctx.quadraticCurveTo(x+s*0.66, y+s*0.82, x+s*0.78, y+s*0.98); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x+s*0.5, y+s*0.72); ctx.lineTo(x+s*0.5, y+s*0.98); ctx.stroke();
      ctx.strokeStyle = '#46371f'; ctx.lineWidth = Math.max(1.5, s*0.11);   // leaning trunk
      ctx.beginPath(); ctx.moveTo(x+s*0.5, y+s*0.74); ctx.lineTo(x+s*(0.5+lean), y+s*0.40); ctx.stroke();
      ctx.fillStyle = '#1d3a13';                                       // heavy dark canopy
      ctx.beginPath(); ctx.arc(x+s*(0.42+lean), y+s*0.34, s*0.26, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(x+s*(0.64+lean), y+s*0.40, s*0.20, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#2c5320';
      ctx.beginPath(); ctx.arc(x+s*(0.40+lean), y+s*0.28, s*0.16, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#3a6a28';                                       // sickly-lit crown
      ctx.beginPath(); ctx.arc(x+s*(0.36+lean), y+s*0.24, s*0.09, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = 'rgba(120,150,90,0.6)'; ctx.lineWidth = Math.max(1, s*0.022);   // hanging moss
      ctx.beginPath(); ctx.moveTo(x+s*(0.50+lean), y+s*0.42); ctx.lineTo(x+s*(0.52+lean), y+s*0.62); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x+s*(0.66+lean), y+s*0.46); ctx.lineTo(x+s*(0.64+lean), y+s*0.64); ctx.stroke();
      break; }
    case T.SWAMP_MUSHROOM: {
      // A cluster of sickly poison toadstools on the mire — drawn on the muck base
      // so it sits in the swamp instead of clashing like the forest's grass-backed
      // mushroom. A taller capped toadstool and a small one, lurid purple caps
      // freckled with pale spots, each breathing a faint, slowly pulsing spore-glow
      // (cut for a Mushroom). Animated glow.
      ctx.fillStyle = '#4a5a26'; ctx.fillRect(x, y, s, s);            // muck base
      ctx.fillStyle = '#3b4a1e'; ctx.beginPath(); ctx.ellipse(x+s*0.5, y+s*0.84, s*0.30, s*0.08, 0,0,Math.PI*2); ctx.fill();  // wet shadow
      const glow = 0.16 + 0.12*Math.sin(Date.now()/700 + col*0.6 + row*0.5);
      // taller toadstool (left)
      const ax = 0.40, ay = 0.40;
      ctx.fillStyle = `rgba(170,120,210,${glow})`;                     // spore-glow halo
      ctx.beginPath(); ctx.arc(x+s*ax, y+s*ay, s*0.24, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#cfc2a0'; ctx.fillRect(x+s*(ax-0.045), y+s*ay, s*0.09, s*0.34);   // pale stalk
      ctx.fillStyle = '#7a4aa0';                                       // lurid purple cap
      ctx.beginPath(); ctx.arc(x+s*ax, y+s*ay, s*0.20, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#5e3683'; ctx.beginPath(); ctx.arc(x+s*ax, y+s*(ay+0.02), s*0.20, 0, Math.PI); ctx.fill();   // cap underside
      ctx.fillStyle = '#e6d8f2';                                       // freckled spots
      ctx.fillRect(x+s*(ax-0.10), y+s*(ay-0.07), s*0.04, s*0.04);
      ctx.fillRect(x+s*(ax+0.05), y+s*(ay-0.05), s*0.035, s*0.035);
      ctx.fillRect(x+s*(ax-0.02), y+s*(ay-0.11), s*0.03, s*0.03);
      // small toadstool (right)
      const bx2 = 0.66, by2 = 0.58;
      ctx.fillStyle = '#cfc2a0'; ctx.fillRect(x+s*(bx2-0.03), y+s*by2, s*0.06, s*0.22);  // stalk
      ctx.fillStyle = '#8a55b4';
      ctx.beginPath(); ctx.arc(x+s*bx2, y+s*by2, s*0.13, Math.PI, 0); ctx.fill();        // cap
      ctx.fillStyle = '#e6d8f2'; ctx.fillRect(x+s*(bx2-0.05), y+s*(by2-0.05), s*0.03, s*0.03);
      break; }
    case T.FALLEN_LOG: {
      // A rotting, moss-grown tree trunk lying across the swamp — the poison
      // region's tombstone-style landmark, but a straight 2–4 tile run. Orientation
      // and which ends are open are read from the neighbouring tiles, so a multi-tile
      // trunk joins seamlessly and caps its true ends with exposed tree-ring end
      // grain. (Placement keeps runs straight, so only horizontal/vertical and a lone
      // single-tile log occur.) Static.
      const M = (typeof mapData === 'function') ? mapData() : null;
      const isLog = (rr, cc) => !!M && rr >= 0 && cc >= 0 && rr < MROWS && cc < MCOLS && M[rr][cc] === T.FALLEN_LOG;
      const leftL = isLog(row, col-1), rightL = isLog(row, col+1);
      const upL = isLog(row-1, col), downL = isLog(row+1, col);
      const vert = upL || downL;                                      // vertical run?
      const h = (col*131 + row*83);
      const j = (a, n) => (((h >> a) & 3) / 3) * n;
      ctx.fillStyle = '#4a5a26'; ctx.fillRect(x, y, s, s);            // muck base
      if (!vert) {
        // ── Horizontal trunk (spans the tile width so runs join) ──
        const top = y + s*0.28, bh = s*0.44;
        ctx.fillStyle = '#2e3a18'; ctx.fillRect(x, top + bh*0.86, s, s*0.12);   // cast shadow
        ctx.fillStyle = '#4a3622'; ctx.fillRect(x, top, s, bh);                 // bark mid
        ctx.fillStyle = '#5e472b'; ctx.fillRect(x, top, s, bh*0.34);            // lit upper curve
        ctx.fillStyle = '#332415'; ctx.fillRect(x, top + bh*0.74, s, bh*0.26);  // shadowed underside
        ctx.strokeStyle = '#3a2a18'; ctx.lineWidth = Math.max(1, s*0.02);       // bark grooves
        for (let i = 0; i < 3; i++) {
          const gy = top + bh*(0.30 + i*0.22) + j(i*2,0.04)*s;
          ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x+s, gy + (j(i*2+1,0.06)-0.03)*s); ctx.stroke();
        }
        ctx.fillStyle = '#4f7a35';                                              // moss on the lit top
        ctx.beginPath(); ctx.ellipse(x+s*(0.30+j(0,0.40)), top+bh*0.22, s*0.12, s*0.05, 0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle = '#5e9040';
        ctx.beginPath(); ctx.ellipse(x+s*(0.66-j(4,0.30)), top+bh*0.16, s*0.07, s*0.035, 0,0,Math.PI*2); ctx.fill();
        const cap = (ex) => {                                                   // sawn end grain
          ctx.fillStyle = '#6a5232'; ctx.beginPath(); ctx.ellipse(ex, top+bh/2, s*0.07, bh*0.5, 0, 0, Math.PI*2); ctx.fill();
          ctx.strokeStyle = '#4a3a22'; ctx.lineWidth = Math.max(1, s*0.015);
          for (let rr = 1; rr <= 2; rr++) { ctx.beginPath(); ctx.ellipse(ex, top+bh/2, s*0.07*rr/2.6, bh*0.5*rr/2.6, 0,0,Math.PI*2); ctx.stroke(); }
          ctx.fillStyle = '#2e2415'; ctx.beginPath(); ctx.arc(ex, top+bh/2, s*0.014, 0, Math.PI*2); ctx.fill();
        };
        if (!leftL)  cap(x + s*0.05);
        if (!rightL) cap(x + s*0.95);
      } else {
        // ── Vertical trunk (spans the tile height so runs join) ──
        const left = x + s*0.28, bw = s*0.44;
        ctx.fillStyle = '#2e3a18'; ctx.fillRect(left + bw*0.86, y, s*0.12, s);   // cast shadow
        ctx.fillStyle = '#4a3622'; ctx.fillRect(left, y, bw, s);                 // bark mid
        ctx.fillStyle = '#5e472b'; ctx.fillRect(left, y, bw*0.34, s);            // lit left curve
        ctx.fillStyle = '#332415'; ctx.fillRect(left + bw*0.74, y, bw*0.26, s);  // shadowed side
        ctx.strokeStyle = '#3a2a18'; ctx.lineWidth = Math.max(1, s*0.02);        // bark grooves
        for (let i = 0; i < 3; i++) {
          const gx = left + bw*(0.30 + i*0.22) + j(i*2,0.04)*s;
          ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx + (j(i*2+1,0.06)-0.03)*s, y+s); ctx.stroke();
        }
        ctx.fillStyle = '#4f7a35';                                              // moss on the lit side
        ctx.beginPath(); ctx.ellipse(left+bw*0.22, y+s*(0.30+j(0,0.40)), s*0.05, s*0.12, 0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle = '#5e9040';
        ctx.beginPath(); ctx.ellipse(left+bw*0.16, y+s*(0.66-j(4,0.30)), s*0.035, s*0.07, 0,0,Math.PI*2); ctx.fill();
        const cap = (ey) => {
          ctx.fillStyle = '#6a5232'; ctx.beginPath(); ctx.ellipse(left+bw/2, ey, bw*0.5, s*0.07, 0, 0, Math.PI*2); ctx.fill();
          ctx.strokeStyle = '#4a3a22'; ctx.lineWidth = Math.max(1, s*0.015);
          for (let rr = 1; rr <= 2; rr++) { ctx.beginPath(); ctx.ellipse(left+bw/2, ey, bw*0.5*rr/2.6, s*0.07*rr/2.6, 0,0,Math.PI*2); ctx.stroke(); }
          ctx.fillStyle = '#2e2415'; ctx.beginPath(); ctx.arc(left+bw/2, ey, s*0.014, 0, Math.PI*2); ctx.fill();
        };
        if (!upL)   cap(y + s*0.05);
        if (!downL) cap(y + s*0.95);
      }
      break; }
    case T.WATERFALL: {
      // Falling water — deep-blue base with bright vertical streaks scrolling
      // downward and a flicker of mist. The scroll uses a wrapped offset so the
      // streaks appear to fall continuously.
      ctx.fillStyle = '#2f5fb0'; ctx.fillRect(x, y, s, s);
      ctx.fillStyle = 'rgba(30,60,120,0.5)'; ctx.fillRect(x, y, s*0.5, s);   // shaded side
      const tt = Date.now();
      for (let i = 0; i < 4; i++) {
        const lane  = x + s * (0.12 + i * 0.24);
        const speed = 230 + (i % 2) * 90;
        const yy = ((tt / speed * s) + i * 7 + col * 5 + row * 13) % s;
        ctx.fillStyle = 'rgba(210,235,255,0.9)';
        ctx.fillRect(lane, y + yy,     2, s * 0.45);
        ctx.fillRect(lane, y + yy - s, 2, s * 0.45);   // wrapped tail
      }
      // Drifting mist sparkle
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(x + s*0.3, y + ((tt / 120 + col * 3 + row * 7) % s), 1.5, 1.5);
      break; }
    case T.WATERFALL_DOOR: {
      // Identical to the falling water — a concealed door — save for a faint
      // glow welling up from behind the curtain. That glow is the ONLY hint the
      // passage exists.
      ctx.fillStyle = '#2f5fb0'; ctx.fillRect(x, y, s, s);
      ctx.fillStyle = 'rgba(30,60,120,0.5)'; ctx.fillRect(x, y, s*0.5, s);
      // Glow behind the water, under the streaks.
      const dpulse = Math.sin(Date.now()/360) * 0.5 + 0.5;
      const dgrad = ctx.createRadialGradient(x+s/2, y+s*0.62, 1, x+s/2, y+s*0.62, s*0.62);
      dgrad.addColorStop(0, `rgba(150,235,255,${0.30 + dpulse*0.38})`);
      dgrad.addColorStop(1, 'rgba(150,235,255,0)');
      ctx.fillStyle = dgrad; ctx.fillRect(x, y, s, s);
      const dtt = Date.now();
      for (let i = 0; i < 4; i++) {
        const lane  = x + s * (0.12 + i * 0.24);
        const speed = 230 + (i % 2) * 90;
        const yy = ((dtt / speed * s) + i * 7 + col * 5 + row * 13) % s;
        ctx.fillStyle = 'rgba(210,235,255,0.9)';
        ctx.fillRect(lane, y + yy,     2, s * 0.45);
        ctx.fillRect(lane, y + yy - s, 2, s * 0.45);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(x + s*0.3, y + ((dtt / 120 + col * 3 + row * 7) % s), 1.5, 1.5);
      break; }
    case T.CAVE_DESCENT: {
      // A passage leading deeper — a dark pit with downward chevrons, distinct
      // from the CAVE_EXIT's bright return portal.
      ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x, y, s, s);
      const cgrad = ctx.createRadialGradient(x+s/2, y+s/2, 1, x+s/2, y+s/2, s*0.48);
      cgrad.addColorStop(0, '#000');
      cgrad.addColorStop(0.65, '#0a0a10');
      cgrad.addColorStop(1, '#2a1d10');
      ctx.fillStyle = cgrad;
      ctx.beginPath(); ctx.arc(x+s/2, y+s/2, s*0.44, 0, Math.PI*2); ctx.fill();
      const cglow = (Math.sin(Date.now()/300) * 0.5 + 0.5) * 0.5 + 0.3;
      ctx.strokeStyle = `rgba(150,200,160,${cglow})`;
      ctx.lineWidth = Math.max(1, s*0.04);
      for (let i = 0; i < 2; i++) {
        const yy = y + s*(0.40 + i*0.16);
        ctx.beginPath();
        ctx.moveTo(x+s*0.36, yy);
        ctx.lineTo(x+s*0.50, yy + s*0.12);
        ctx.lineTo(x+s*0.64, yy);
        ctx.stroke();
      }
      break; }
    case T.CLIFF: {
      // Rocky cliff face — same craggy faceting as the cave walls and the same
      // edge-aware 3D relief as the desert mesa, in grey forest stone. A band
      // hugging a map edge reads as a real wall: sunlit cap + shadow foot on its
      // exposed long faces, thin bevels on the ends, all rotating with the band so
      // an up/down cliff mirrors a left/right one. Light stays in the upper-left.
      const M = mapData();
      const isCliff = (rr, cc) =>
        (rr < 0 || cc < 0 || rr >= MROWS || cc >= MCOLS) ? true : M[rr][cc] === T.CLIFF;
      // Band orientation: the shorter run of solid cliff is its thickness, so that
      // axis is "across" the wall.
      const runLen = (dr, dc) => { let k = 1; while (k <= 14 && isCliff(row + dr*k, col + dc*k)) k++; return k; };
      const vSpan = Math.min(runLen(-1, 0), runLen(1, 0));
      const hSpan = Math.min(runLen(0, -1), runLen(0, 1));
      const vertical = hSpan < vSpan;                       // thin horizontally → up/down band
      const upOpen = !isCliff(row - 1, col), downOpen = !isCliff(row + 1, col);
      const leftOpen = !isCliff(row, col - 1), rightOpen = !isCliff(row, col + 1);
      const h = (col * 113 + row * 71);

      // Body: craggy grey stone — lit facet upper-left, shadowed recess lower-right,
      // a jagged fracture, and a mineral glint, all hashed per tile so a cliff reads
      // as fractured living rock rather than a tiled grid.
      const j = (a, n) => (((h >> a) & 3) / 3) * n;
      ctx.fillStyle = '#6a5f52'; ctx.fillRect(x, y, s, s);          // base rock
      ctx.fillStyle = '#7e7363';                                    // lit facet (upper-left)
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + s*(0.55 + j(0, 0.14)), y);
      ctx.lineTo(x + s*(0.30 + j(2, 0.12)), y + s*(0.50 + j(4, 0.10)));
      ctx.lineTo(x, y + s*(0.55 + j(6, 0.10)));
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#463d33';                                    // shadowed recess (lower-right)
      ctx.beginPath();
      ctx.moveTo(x + s, y + s*(0.32 + j(0, 0.12)));
      ctx.lineTo(x + s, y + s);
      ctx.lineTo(x + s*(0.38 + j(2, 0.12)), y + s);
      ctx.lineTo(x + s*(0.62 + j(4, 0.08)), y + s*0.50);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#2c261e'; ctx.lineWidth = 1.5;             // jagged fracture
      ctx.beginPath();
      ctx.moveTo(x + s*(0.42 + j(8, 0.12)), y);
      ctx.lineTo(x + s*(0.52 + j(6, 0.10)), y + s*0.48);
      ctx.lineTo(x + s*(0.40 + j(4, 0.12)), y + s);
      ctx.stroke();
      ctx.fillStyle = '#a89a84';                                    // mineral glint
      ctx.fillRect(x + s*0.20 + (h & 7), y + s*0.28, 2, 2);

      const CAP = '#8a7e6a', RIM = '#b2a68e', LIP = 'rgba(28,24,18,0.6)';
      const FOOT = 'rgba(26,22,16,0.5)', GND = 'rgba(10,9,7,0.65)';
      const LITB = 'rgba(232,224,206,0.30)', SHB = 'rgba(34,30,22,0.5)';
      const tk = Math.max(1, s*0.03), bv = Math.max(2, s*0.04);

      if (!vertical) {
        // Horizontal band (runs left/right): cap on top, foot on bottom, thin
        // bevels on the left/right ends.
        if (upOpen)   { ctx.fillStyle = CAP; ctx.fillRect(x, y, s, s*0.24); ctx.fillStyle = RIM; ctx.fillRect(x, y, s, s*0.08); ctx.fillStyle = LIP; ctx.fillRect(x, y + s*0.24, s, tk); }
        if (downOpen) { ctx.fillStyle = FOOT; ctx.fillRect(x, y + s*0.76, s, s*0.24); ctx.fillStyle = GND; ctx.fillRect(x, y + s - bv, s, bv); }
        if (leftOpen)  { ctx.fillStyle = LITB; ctx.fillRect(x, y, bv, s); }
        if (rightOpen) { ctx.fillStyle = SHB;  ctx.fillRect(x + s - bv, y, bv, s); }
      } else {
        // Vertical band (runs up/down): the same relief rotated 90° — cap on the
        // LEFT, foot on the RIGHT, bevels on the top/bottom ends.
        if (leftOpen)  { ctx.fillStyle = CAP; ctx.fillRect(x, y, s*0.24, s); ctx.fillStyle = RIM; ctx.fillRect(x, y, s*0.08, s); ctx.fillStyle = LIP; ctx.fillRect(x + s*0.24, y, tk, s); }
        if (rightOpen) { ctx.fillStyle = FOOT; ctx.fillRect(x + s*0.76, y, s*0.24, s); ctx.fillStyle = GND; ctx.fillRect(x + s - bv, y, bv, s); }
        if (upOpen)   { ctx.fillStyle = LITB; ctx.fillRect(x, y, s, bv); }
        if (downOpen) { ctx.fillStyle = SHB;  ctx.fillRect(x, y + s - bv, s, bv); }
      }
      break; }
    case T.PLATEAU: {
      // Raised sandstone mesa with real relief. Craggy rock texture (faceted like
      // the cave walls) under a sunlit cap and shadow foot that rotate with the
      // band, so an up/down (vertical) mesa reads as the left/right one turned 90°,
      // matching the ramp that runs through it. Light stays in the upper-left in
      // both: the LIT cap sits on the top (horizontal band) or LEFT (vertical band)
      // exposed face; the shadow foot on the bottom / right; bevels on the ends.
      const M = mapData();
      const isMesa = (rr, cc) =>
        (rr < 0 || cc < 0 || rr >= MROWS || cc >= MCOLS) ? true : M[rr][cc] === T.PLATEAU;
      // Band orientation: scan how far the solid mass (PLATEAU + the CLIMB ramp
      // cut through it) runs along each axis. A band is thin across its short
      // axis, so the shorter span is the band's thickness → that axis is "across"
      // the wall. Treating CLIMB as part of the mass keeps ramp slots from
      // breaking the scan.
      const inSpan = (rr, cc) =>
        (rr < 0 || cc < 0 || rr >= MROWS || cc >= MCOLS) ? false : (M[rr][cc] === T.PLATEAU || M[rr][cc] === T.CLIMB);
      const runLen = (dr, dc) => { let k = 1; while (k <= 14 && inSpan(row + dr*k, col + dc*k)) k++; return k; };
      const vSpan = Math.min(runLen(-1, 0), runLen(1, 0));
      const hSpan = Math.min(runLen(0, -1), runLen(0, 1));
      const vertical = hSpan < vSpan;                       // thin horizontally → up/down band
      const upOpen = !isMesa(row - 1, col), downOpen = !isMesa(row + 1, col);
      const leftOpen = !isMesa(row, col - 1), rightOpen = !isMesa(row, col + 1);
      const h = (col * 97 + row * 53);

      // Body: craggy sandstone, faceted like the cave walls — a lit facet in the
      // upper-left, a shadowed recess lower-right, a jagged fracture, and a quartz
      // glint, all hashed per tile so a mesa reads as fractured living rock. Warm
      // sandstone tones instead of the cave's grey; the facet light (upper-left)
      // matches the sun, so it reinforces the cap/foot relief drawn over it.
      const j = (a, n) => (((h >> a) & 3) / 3) * n;
      ctx.fillStyle = '#a86a30'; ctx.fillRect(x, y, s, s);          // base rock
      ctx.fillStyle = '#bd7e3c';                                    // lit facet (upper-left)
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + s*(0.55 + j(0, 0.14)), y);
      ctx.lineTo(x + s*(0.30 + j(2, 0.12)), y + s*(0.50 + j(4, 0.10)));
      ctx.lineTo(x, y + s*(0.55 + j(6, 0.10)));
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#7c4a20';                                    // shadowed recess (lower-right)
      ctx.beginPath();
      ctx.moveTo(x + s, y + s*(0.32 + j(0, 0.12)));
      ctx.lineTo(x + s, y + s);
      ctx.lineTo(x + s*(0.38 + j(2, 0.12)), y + s);
      ctx.lineTo(x + s*(0.62 + j(4, 0.08)), y + s*0.50);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#5a3416'; ctx.lineWidth = 1.5;             // jagged fracture
      ctx.beginPath();
      ctx.moveTo(x + s*(0.42 + j(8, 0.12)), y);
      ctx.lineTo(x + s*(0.52 + j(6, 0.10)), y + s*0.48);
      ctx.lineTo(x + s*(0.40 + j(4, 0.12)), y + s);
      ctx.stroke();
      ctx.fillStyle = '#d8b070';                                    // quartz glint
      ctx.fillRect(x + s*0.20 + (h & 7), y + s*0.28, 2, 2);

      const CAP = '#d29a58', RIM = '#f2cd92', LIP = 'rgba(46,24,9,0.6)';
      const FOOT = 'rgba(34,18,7,0.5)', GND = 'rgba(14,7,3,0.65)';
      const LITB = 'rgba(255,228,180,0.34)', SHB = 'rgba(40,20,8,0.5)';
      const tk = Math.max(1, s*0.03), bv = Math.max(2, s*0.04);

      if (!vertical) {
        // Horizontal band (runs left/right): cap on top, foot on bottom, thin
        // bevels on the left/right ends.
        if (upOpen)   { ctx.fillStyle = CAP; ctx.fillRect(x, y, s, s*0.24); ctx.fillStyle = RIM; ctx.fillRect(x, y, s, s*0.08); ctx.fillStyle = LIP; ctx.fillRect(x, y + s*0.24, s, tk); }
        if (downOpen) { ctx.fillStyle = FOOT; ctx.fillRect(x, y + s*0.76, s, s*0.24); ctx.fillStyle = GND; ctx.fillRect(x, y + s - bv, s, bv); }
        if (leftOpen)  { ctx.fillStyle = LITB; ctx.fillRect(x, y, bv, s); }
        if (rightOpen) { ctx.fillStyle = SHB;  ctx.fillRect(x + s - bv, y, bv, s); }
      } else {
        // Vertical band (runs up/down): the same relief rotated 90° — cap on the
        // LEFT, foot on the RIGHT, bevels on the top/bottom ends.
        if (leftOpen)  { ctx.fillStyle = CAP; ctx.fillRect(x, y, s*0.24, s); ctx.fillStyle = RIM; ctx.fillRect(x, y, s*0.08, s); ctx.fillStyle = LIP; ctx.fillRect(x + s*0.24, y, tk, s); }
        if (rightOpen) { ctx.fillStyle = FOOT; ctx.fillRect(x + s*0.76, y, s*0.24, s); ctx.fillStyle = GND; ctx.fillRect(x + s - bv, y, bv, s); }
        if (upOpen)   { ctx.fillStyle = LITB; ctx.fillRect(x, y, s, bv); }
        if (downOpen) { ctx.fillStyle = SHB;  ctx.fillRect(x, y + s - bv, s, bv); }
      }
      break; }
    case T.CLIMB: {
      // A staircase cut into the mesa: bright sunlit treads over dark risers give
      // strong relief so it reads as a way up/over the rock. Step orientation
      // follows the slot — horizontal treads for a vertical (N/S) ramp, vertical
      // treads for a horizontal (E/W) ramp — inferred from where the flanking
      // PLATEAU walls sit (1 tile away on the slot's edge columns, 2 at its
      // centre). Rock walls are drawn on whichever sides touch the mesa, so the
      // ramp seats into a carved slot. Step pitch (i+0.5)/STEPS keeps the stairs
      // continuous across tile borders.
      const M = mapData();
      const isMesa = (rr, cc) =>
        (rr < 0 || cc < 0 || rr >= MROWS || cc >= MCOLS) ? false : M[rr][cc] === T.PLATEAU;
      const wallLR = isMesa(row, col-1) || isMesa(row, col+1) || isMesa(row, col-2) || isMesa(row, col+2);
      const wallUD = isMesa(row-1, col) || isMesa(row+1, col) || isMesa(row-2, col) || isMesa(row+2, col);
      const horizTreads = wallLR || !wallUD;   // default: horizontal treads

      // Pale sandy ramp body — distinctly lighter than the orange mesa rock, so
      // the cut reads as a separate ramp at a glance.
      ctx.fillStyle = '#cea766'; ctx.fillRect(x, y, s, s);

      // Bold stair steps in SOLID tones (not faint overlays) so they pop against
      // both the ramp body and the mesa's subtle strata: a dark riser face with a
      // bright tread cap perched on its up-slope edge.
      const STEPS = 4;
      const riser = Math.max(2, s*0.13), tread = Math.max(1, s*0.05);
      if (horizTreads) {
        for (let i = 0; i < STEPS; i++) {
          const yy = y + s*(i + 0.5)/STEPS;
          ctx.fillStyle = '#6e4422'; ctx.fillRect(x + s*0.04, yy, s*0.92, riser);          // riser face (shadow)
          ctx.fillStyle = '#f6e6be'; ctx.fillRect(x + s*0.04, yy - tread, s*0.92, tread);  // sunlit tread cap
        }
      } else {
        for (let i = 0; i < STEPS; i++) {
          const xx = x + s*(i + 0.5)/STEPS;
          ctx.fillStyle = '#6e4422'; ctx.fillRect(xx, y + s*0.04, riser, s*0.92);
          ctx.fillStyle = '#f6e6be'; ctx.fillRect(xx - tread, y + s*0.04, tread, s*0.92);
        }
      }

      // Rock side-walls where the slot abuts the mesa (frames the cut). Drawn
      // last so they cap the step ends cleanly.
      const wall = (wx, wy, ww, wh, sx2, sy2, sw, sh) => {
        ctx.fillStyle = '#7a4a22'; ctx.fillRect(wx, wy, ww, wh);
        ctx.fillStyle = 'rgba(38,20,8,0.5)'; ctx.fillRect(sx2, sy2, sw, sh);
      };
      if (isMesa(row, col-1)) wall(x, y, s*0.12, s, x + s*0.12, y, 2, s);
      if (isMesa(row, col+1)) wall(x + s*0.88, y, s*0.12, s, x + s*0.88 - 2, y, 2, s);
      if (isMesa(row-1, col)) wall(x, y, s, s*0.12, x, y + s*0.12, s, 2);
      if (isMesa(row+1, col)) wall(x, y + s*0.88, s, s*0.12, x, y + s*0.88 - 2, s, 2);
      break; }
    case T.FLOWERING_CACTUS: {
      // Sand backdrop + a cactus crowned with small magenta blossoms.
      ctx.fillStyle = '#d4b070'; ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#2d6a2d';
      ctx.fillRect(x + s*0.42, y + s*0.28, s*0.16, s*0.64);
      ctx.fillRect(x + s*0.20, y + s*0.50, s*0.20, s*0.10);
      ctx.fillRect(x + s*0.20, y + s*0.36, s*0.06, s*0.18);
      ctx.fillRect(x + s*0.60, y + s*0.58, s*0.20, s*0.10);
      ctx.fillRect(x + s*0.74, y + s*0.44, s*0.06, s*0.18);
      ctx.fillStyle = '#5aaa5a';
      ctx.fillRect(x + s*0.46, y + s*0.32, s*0.04, s*0.56);
      // Blossoms — a crown bloom plus one on each arm tip.
      ctx.fillStyle = '#e85aa8';
      ctx.beginPath(); ctx.arc(x + s*0.50, y + s*0.26, s*0.10, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + s*0.23, y + s*0.34, s*0.06, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + s*0.77, y + s*0.42, s*0.06, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#ffd24a';
      ctx.fillRect(x + s*0.48, y + s*0.24, 3, 3);
      break; }
    case T.DESERT_SUCCULENT: {
      // Sand backdrop + a low agave/aloe rosette: a ring of thick blue-green
      // blades fanning out from a central crown, each lit along one edge. Static
      // per tile.
      ctx.fillStyle = '#d4b070'; ctx.fillRect(x, y, s, s);
      const dcx = x + s*0.5, dcy = y + s*0.60;
      const blade = (ang, len, half, base, lit) => {
        ctx.save(); ctx.translate(dcx, dcy); ctx.rotate(ang);
        ctx.fillStyle = base;
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(-half, -len*0.5); ctx.lineTo(0, -len); ctx.lineTo(half, -len*0.5);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = lit;
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(0, -len); ctx.lineTo(half, -len*0.5);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      };
      const blades = 7;
      for (let i = 0; i < blades; i++) blade((i / blades) * Math.PI*2, s*0.34, s*0.07, '#4f9a64', '#6fc488');
      ctx.fillStyle = '#3a7a4e';
      ctx.beginPath(); ctx.arc(dcx, dcy, s*0.07, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#bfe6c8';
      ctx.beginPath(); ctx.arc(dcx - s*0.02, dcy - s*0.02, s*0.03, 0, Math.PI*2); ctx.fill();
      break; }
    case T.MANA_FLOOR: {
      // Verdant, mana-rich turf of the flourishing forest — a lush emerald sward
      // mottled with darker grass clumps, a couple of short lit blades, and a
      // faint static mote of violet life-energy welling up from the soil. Hashed
      // per tile so the floor reads as living turf rather than a flat grid. Static.
      const h = (col * 131 + row * 83);
      const j = (a, n) => (((h >> a) & 3) / 3) * n;
      ctx.fillStyle = '#2e7d4f'; ctx.fillRect(x, y, s, s);           // lush turf base
      ctx.fillStyle = '#276e45';                                      // darker grass clumps
      ctx.beginPath(); ctx.ellipse(x+s*(0.30+j(0,0.30)), y+s*(0.34+j(2,0.28)), s*(0.16+j(4,0.06)), s*(0.11+j(6,0.05)), 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x+s*(0.70-j(8,0.22)), y+s*(0.70-j(10,0.20)), s*(0.13+j(0,0.05)), s*(0.09+j(2,0.04)), 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#3a945c';                                      // lit grass tufts
      ctx.fillRect(x+s*(0.18+j(2,0.10)), y+s*(0.58+j(8,0.10)), s*0.03, s*0.10);
      ctx.fillRect(x+s*(0.64+j(6,0.12)), y+s*(0.28+j(4,0.10)), s*0.03, s*0.09);
      ctx.fillStyle = 'rgba(190,130,235,0.22)';                       // faint violet mana mote
      ctx.beginPath(); ctx.arc(x+s*(0.40+j(4,0.24)), y+s*(0.46+j(10,0.20)), s*0.045, 0, Math.PI*2); ctx.fill();
      break; }
    case T.MANA_MOSS: {
      // A thicker cushion of overgrown moss pooled across the turf — the floor
      // dapple where life energy gathers, lusher and brighter than the plain turf,
      // freckled with tiny violet sporelings. Passable; the mana twin of the
      // luminous region's glow pools. Hashed per tile. Static.
      const h = (col * 137 + row * 71);
      const j = (a, n) => (((h >> a) & 3) / 3) * n;
      ctx.fillStyle = '#2e7d4f'; ctx.fillRect(x, y, s, s);           // turf base
      ctx.fillStyle = '#39a062';                                      // mossy cushion
      ctx.beginPath(); ctx.ellipse(x+s*(0.48+j(0,0.14)-0.07), y+s*(0.52+j(2,0.14)-0.07), s*(0.36+j(4,0.08)), s*(0.30+j(6,0.07)), j(8,0.5), 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#46bd76';                                      // lit moss clumps
      ctx.beginPath(); ctx.arc(x+s*(0.36+j(2,0.16)), y+s*(0.40+j(8,0.14)), s*0.11, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(x+s*(0.64-j(6,0.16)), y+s*(0.62-j(4,0.14)), s*0.09, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(198,142,238,0.55)';                       // violet sporelings
      ctx.beginPath(); ctx.arc(x+s*(0.30+j(10,0.4)), y+s*(0.64+j(0,0.2)), s*0.025, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(x+s*(0.66+j(4,0.2)), y+s*(0.34+j(8,0.2)), s*0.02, 0, Math.PI*2); ctx.fill();
      break; }
    case T.COLOSSAL_TREE:   // the anchor tile renders as treeline; the giant tree
                            // itself is drawn in the drawColossalTree overlay pass
    case T.MANA_CRYSTAL: {
      // The flourishing forest's border — a dense, towering treeline gorged on
      // mana: massed clumps of deep canopy over a shadow, a hanging vine, a
      // sickly-lit crown, and a glowing violet sap-vein threading up the trunk with
      // a mote of life-energy. The mana twin of the poison region's thicket wall.
      // Hashed per tile so the treeline never reads as a grid. Static, solid.
      const h = (col * 131 + row * 83);
      const j = (a, n) => (((h >> a) & 3) / 3) * n;
      ctx.fillStyle = '#0f2c1c'; ctx.fillRect(x, y, s, s);            // deep treeline shadow
      ctx.fillStyle = '#1c4a2e';                                       // massed canopy clumps
      ctx.beginPath(); ctx.arc(x+s*(0.32+j(0,0.12)), y+s*(0.40+j(2,0.12)), s*(0.34+j(4,0.06)), 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(x+s*(0.70-j(6,0.12)), y+s*(0.58-j(8,0.12)), s*(0.30+j(10,0.06)), 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#2a6440';
      ctx.beginPath(); ctx.arc(x+s*(0.50+j(2,0.12)), y+s*(0.34+j(6,0.10)), s*0.22, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#3f8a55';                                       // lush-lit crown (upper-left)
      ctx.beginPath(); ctx.arc(x+s*(0.34+j(4,0.10)), y+s*(0.30+j(0,0.10)), s*0.12, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = 'rgba(176,116,228,0.6)'; ctx.lineWidth = Math.max(1, s*0.045); ctx.lineCap = 'round';   // glowing mana vein
      ctx.beginPath();
      ctx.moveTo(x+s*(0.60+j(8,0.10)), y+s);
      ctx.quadraticCurveTo(x+s*(0.66+j(2,0.10)), y+s*0.50, x+s*(0.58+j(6,0.10)), y+s*0.16);
      ctx.stroke();
      ctx.fillStyle = 'rgba(206,150,244,0.85)';                       // violet life-mote
      ctx.beginPath(); ctx.arc(x+s*(0.46+j(0,0.10)), y+s*(0.46+j(8,0.10)), s*0.035, 0, Math.PI*2); ctx.fill();
      break; }
    case T.GREAT_TREE: {
      // An abnormally large ancient tree gorged on mana — a colossal landmark used
      // both as the treeline border dressing and standing proud in the open
      // clearings. A heavy buttressed trunk with splayed roots, a vast multi-lobed
      // canopy overflowing the tile, a sickly-lit crown, and a scatter of glowing
      // violet blossoms with one slowly breathing brighter. Static trunk, faint
      // pulse on the blossoms. Solid.
      const h = (col * 113 + row * 71);
      const j = (a, n) => (((h >> a) & 3) / 3) * n;
      const lean = (((h >> 0) & 3) / 3 - 0.5) * 0.10;
      ctx.fillStyle = '#0e2c1c'; ctx.fillRect(x, y, s, s);            // forest-floor shadow
      ctx.strokeStyle = '#3a2c1a'; ctx.lineWidth = Math.max(1, s*0.05); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(x+s*0.5, y+s*0.72); ctx.quadraticCurveTo(x+s*0.34, y+s*0.84, x+s*0.22, y+s); ctx.stroke();   // splayed roots
      ctx.beginPath(); ctx.moveTo(x+s*0.5, y+s*0.72); ctx.quadraticCurveTo(x+s*0.66, y+s*0.84, x+s*0.78, y+s); ctx.stroke();
      ctx.fillStyle = '#4a3820';                                       // buttressed trunk
      ctx.beginPath();
      ctx.moveTo(x+s*0.40, y+s);
      ctx.lineTo(x+s*(0.45+lean), y+s*0.40);
      ctx.lineTo(x+s*(0.55+lean), y+s*0.40);
      ctx.lineTo(x+s*0.60, y+s);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#5a4628'; ctx.fillRect(x+s*(0.45+lean), y+s*0.42, s*0.04, s*0.56);   // lit trunk edge
      ctx.fillStyle = '#143d26';                                       // vast canopy
      ctx.beginPath(); ctx.arc(x+s*(0.40+lean), y+s*0.34, s*0.30, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(x+s*(0.66+lean), y+s*0.40, s*0.24, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(x+s*(0.56+lean), y+s*0.20, s*0.22, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#205a38';
      ctx.beginPath(); ctx.arc(x+s*(0.44+lean), y+s*0.28, s*0.18, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#2f7a49';                                       // sickly-lit crown (upper-left)
      ctx.beginPath(); ctx.arc(x+s*(0.36+lean), y+s*0.20, s*0.11, 0, Math.PI*2); ctx.fill();
      const bp = 0.5 + 0.5*Math.sin(Date.now()/700 + col*0.5 + row*0.4);   // breathing blossom
      const blossom = (bx, by, rad, a) => { ctx.fillStyle = `rgba(200,142,242,${a})`; ctx.beginPath(); ctx.arc(x+s*bx, y+s*by, s*rad, 0, Math.PI*2); ctx.fill(); };
      blossom(0.34+lean, 0.30, 0.035, 0.85);
      blossom(0.58+lean, 0.24, 0.030, 0.80);
      blossom(0.64+lean, 0.44, 0.030, 0.75);
      blossom(0.46+lean, 0.42, 0.045, 0.55 + 0.40*bp);   // the breathing one
      break; }
    case T.GIANT_BLOOM: {
      // An abnormally large arcane flower gorged on mana — a thick green stalk and
      // two broad leaves carrying a huge violet many-petalled bloom around a
      // glowing golden-violet heart that slowly pulses. Drawn on the verdant turf
      // so it sits in the forest (cut for a Mana Petal). Animated heart-glow.
      ctx.fillStyle = '#2e7d4f'; ctx.fillRect(x, y, s, s);           // turf base
      ctx.fillStyle = '#276e45'; ctx.beginPath(); ctx.ellipse(x+s*0.5, y+s*0.86, s*0.30, s*0.08, 0,0,Math.PI*2); ctx.fill();   // ground shadow
      ctx.strokeStyle = '#3f9a4a'; ctx.lineWidth = Math.max(1.5, s*0.07); ctx.lineCap = 'round';   // thick stalk
      ctx.beginPath(); ctx.moveTo(x+s*0.5, y+s*0.92); ctx.lineTo(x+s*0.5, y+s*0.40); ctx.stroke();
      ctx.fillStyle = '#358a40';                                       // broad leaves
      ctx.beginPath(); ctx.ellipse(x+s*0.34, y+s*0.66, s*0.16, s*0.07, -0.5, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x+s*0.66, y+s*0.72, s*0.14, s*0.06, 0.5, 0, Math.PI*2); ctx.fill();
      const cx2 = x+s*0.5, cy2 = y+s*0.34;                            // bloom centre
      ctx.fillStyle = '#9a4fcf';                                       // violet petals
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2;
        ctx.beginPath(); ctx.ellipse(cx2 + Math.cos(a)*s*0.18, cy2 + Math.sin(a)*s*0.18, s*0.12, s*0.07, a, 0, Math.PI*2); ctx.fill();
      }
      ctx.fillStyle = '#b76ce6';                                       // lit inner petals
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2 + 0.39;
        ctx.beginPath(); ctx.ellipse(cx2 + Math.cos(a)*s*0.10, cy2 + Math.sin(a)*s*0.10, s*0.07, s*0.045, a, 0, Math.PI*2); ctx.fill();
      }
      const gp = 0.5 + 0.5*Math.sin(Date.now()/600 + col*0.6 + row*0.5);   // pulsing heart-glow
      const grad = ctx.createRadialGradient(cx2, cy2, 1, cx2, cy2, s*0.16);
      grad.addColorStop(0, `rgba(255,228,150,${0.7+0.3*gp})`);
      grad.addColorStop(0.5, `rgba(210,150,244,${0.5+0.3*gp})`);
      grad.addColorStop(1, 'rgba(210,150,244,0)');
      ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(cx2, cy2, s*0.16, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#ffe9b0'; ctx.beginPath(); ctx.arc(cx2, cy2, s*0.05, 0, Math.PI*2); ctx.fill();   // bright core
      break; }
    case T.VERDANT_FERN: {
      // A towering, lush fern gorged on mana — a fanning rosette of tall arching
      // fronds ticked with leaflets, broader and taller than the forest fern, the
      // newest fronds tipped violet with fresh growth. Drawn on the verdant turf
      // (cut for a Heart Frond). Static.
      ctx.fillStyle = '#2e7d4f'; ctx.fillRect(x, y, s, s);           // turf base
      ctx.fillStyle = '#276e45'; ctx.beginPath(); ctx.ellipse(x+s*0.5, y+s*0.84, s*0.30, s*0.08, 0,0,Math.PI*2); ctx.fill();   // shadow
      const cx2 = x+s*0.5, base = y+s*0.90;
      for (let i = 0; i < 7; i++) {
        const ang = -Math.PI/2 + (i-3)*0.42;                         // fan the fronds wide
        const reach = s*(0.46 - Math.abs(i-3)*0.02);
        const tipx = cx2 + Math.cos(ang)*reach, tipy = base + Math.sin(ang)*reach;
        const midx = cx2 + Math.cos(ang)*reach*0.5 - Math.sin(ang)*s*0.06, midy = base + Math.sin(ang)*reach*0.5;
        ctx.strokeStyle = (i % 2) ? '#368a3f' : '#45a851'; ctx.lineWidth = Math.max(1, s*0.05); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(cx2, base); ctx.quadraticCurveTo(midx, midy, tipx, tipy); ctx.stroke();
        ctx.lineWidth = Math.max(1, s*0.022);                        // leaflet ticks
        for (let k = 1; k <= 3; k++) {
          const t = k/4, px = cx2 + (tipx-cx2)*t, py = base + (tipy-base)*t;
          ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px+Math.cos(ang+1.2)*s*0.07, py+Math.sin(ang+1.2)*s*0.07); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px+Math.cos(ang-1.2)*s*0.07, py+Math.sin(ang-1.2)*s*0.07); ctx.stroke();
        }
        ctx.fillStyle = 'rgba(196,140,236,0.85)';                     // violet new-growth tip
        ctx.beginPath(); ctx.arc(tipx, tipy, s*0.025, 0, Math.PI*2); ctx.fill();
      }
      break; }
    case T.GIANT_MUSHROOM: {
      // A colossal toadstool gorged on mana — a fat pale stalk and a great violet
      // cap glowing from beneath, freckled with pale spots and breathing a slow
      // violet spore-glow. Far larger than the swamp's toadstool. Drawn on the
      // verdant turf (cut for a Glow Cap). Animated glow.
      ctx.fillStyle = '#2e7d4f'; ctx.fillRect(x, y, s, s);           // turf base
      ctx.fillStyle = '#276e45'; ctx.beginPath(); ctx.ellipse(x+s*0.5, y+s*0.86, s*0.30, s*0.08, 0,0,Math.PI*2); ctx.fill();   // shadow
      const glow = 0.18 + 0.14*Math.sin(Date.now()/650 + col*0.6 + row*0.5);
      ctx.fillStyle = `rgba(186,128,232,${glow})`;                     // spore-glow halo
      ctx.beginPath(); ctx.arc(x+s*0.5, y+s*0.42, s*0.40, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#d8cfb0';                                       // fat pale stalk
      ctx.beginPath();
      ctx.moveTo(x+s*0.40, y+s*0.92);
      ctx.quadraticCurveTo(x+s*0.42, y+s*0.56, x+s*0.44, y+s*0.46);
      ctx.lineTo(x+s*0.56, y+s*0.46);
      ctx.quadraticCurveTo(x+s*0.58, y+s*0.56, x+s*0.60, y+s*0.92);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#bdb393'; ctx.fillRect(x+s*0.53, y+s*0.48, s*0.04, s*0.42);   // stalk shadow
      ctx.fillStyle = '#7a8c52';                                       // green glowing underside
      ctx.beginPath(); ctx.ellipse(x+s*0.5, y+s*0.46, s*0.30, s*0.10, 0, 0, Math.PI); ctx.fill();
      ctx.fillStyle = '#8a4fc0';                                       // great violet cap
      ctx.beginPath(); ctx.ellipse(x+s*0.5, y+s*0.44, s*0.34, s*0.26, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#a06cda';                                       // lit cap dome
      ctx.beginPath(); ctx.ellipse(x+s*0.44, y+s*0.36, s*0.18, s*0.14, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#e8d8f4';                                       // pale freckles
      ctx.beginPath(); ctx.arc(x+s*0.36, y+s*0.34, s*0.035, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(x+s*0.56, y+s*0.30, s*0.030, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(x+s*0.62, y+s*0.40, s*0.025, 0, Math.PI*2); ctx.fill();
      break; }
    case T.MOSS_BOULDER: {
      // A great lichen-and-moss-covered boulder squatting in a forest clearing — the
      // forest's open-ground landmark (its answer to the necrotic tombstone / mana
      // great tree). A rounded grey mass lit from the upper-left over a cast shadow on
      // the grass, raked by weathered cracks, with cushions of moss on its crown. Solid.
      const h = (col*137 + row*71);
      const j = (a, n) => (((h >> a) & 3) / 3) * n;
      ctx.fillStyle = '#3a7a3a'; ctx.fillRect(x, y, s, s);             // grass base
      ctx.fillStyle = '#3d7530'; ctx.fillRect(x+2, y+3, 4, 2); ctx.fillRect(x+s-6, y+s-5, 4, 2);
      ctx.fillStyle = '#2c5a2c';                                       // cast shadow
      ctx.beginPath(); ctx.ellipse(x+s*0.54, y+s*0.82, s*0.40, s*0.12, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#6e6a64';                                       // boulder mass
      ctx.beginPath(); ctx.ellipse(x+s*0.5, y+s*0.56, s*0.38, s*0.34, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#847f77';                                       // lit upper-left
      ctx.beginPath(); ctx.ellipse(x+s*(0.40+j(0,0.04)), y+s*0.44, s*0.22, s*0.17, -0.5, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#54514c';                                       // shadowed lower-right
      ctx.beginPath(); ctx.ellipse(x+s*0.64, y+s*0.68, s*0.18, s*0.14, -0.4, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#4a4742'; ctx.lineWidth = Math.max(1, s*0.025);   // cracks
      ctx.beginPath(); ctx.moveTo(x+s*0.46, y+s*0.30); ctx.lineTo(x+s*0.52, y+s*0.52); ctx.lineTo(x+s*0.46, y+s*0.74); ctx.stroke();
      ctx.fillStyle = '#4f7a35';                                       // moss cushions on the crown
      ctx.beginPath(); ctx.ellipse(x+s*(0.40+j(2,0.10)), y+s*0.38, s*0.14, s*0.07, -0.3, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#5e9040';
      ctx.beginPath(); ctx.ellipse(x+s*(0.60-j(4,0.08)), y+s*0.50, s*0.10, s*0.05, 0.2, 0, Math.PI*2); ctx.fill();
      break; }
    case T.DESERT_OBELISK: {
      // A weathered sandstone obelisk half-buried in the dunes — the desert's
      // open-ground landmark. A four-sided shaft narrowing to a pyramidion cap, its
      // left face sunlit and right face shadowed, scored by a weather crack and worn
      // glyph notches, with a drift of sand mounded at its foot. Static. Solid.
      const cx = x+s*0.5;
      const top = y+s*0.06, capH = s*0.13, shTop = top+capH, bot = y+s*0.9;
      const htop = s*0.07, hbot = s*0.15;                              // half-widths at cap base / ground
      ctx.fillStyle = '#d4b070'; ctx.fillRect(x, y, s, s);             // sand base
      ctx.fillStyle = '#b89055';                                       // sand drift / cast shadow
      ctx.beginPath(); ctx.ellipse(cx+s*0.06, bot, s*0.28, s*0.08, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#cbb27e';                                       // shaft — lit left face
      ctx.beginPath(); ctx.moveTo(cx-hbot, bot); ctx.lineTo(cx-htop, shTop); ctx.lineTo(cx, shTop); ctx.lineTo(cx, bot); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#a8895a';                                       // shaft — shadowed right face
      ctx.beginPath(); ctx.moveTo(cx, bot); ctx.lineTo(cx, shTop); ctx.lineTo(cx+htop, shTop); ctx.lineTo(cx+hbot, bot); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#d8c08a';                                       // pyramidion — lit left
      ctx.beginPath(); ctx.moveTo(cx-htop, shTop); ctx.lineTo(cx, top); ctx.lineTo(cx, shTop); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#b59a66';                                       // pyramidion — shadowed right
      ctx.beginPath(); ctx.moveTo(cx, top); ctx.lineTo(cx+htop, shTop); ctx.lineTo(cx, shTop); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#8a6f44'; ctx.lineWidth = Math.max(1, s*0.02);   // weather crack
      ctx.beginPath(); ctx.moveTo(cx-hbot*0.5, bot-s*0.06); ctx.lineTo(cx-hbot*0.3, shTop+s*0.10); ctx.stroke();
      ctx.fillStyle = '#8a6f44';                                       // worn glyph notches
      ctx.fillRect(cx-s*0.05, shTop+s*0.10, s*0.10, s*0.02);
      ctx.fillRect(cx-s*0.04, shTop+s*0.20, s*0.08, s*0.02);
      ctx.fillRect(cx-s*0.04, shTop+s*0.30, s*0.08, s*0.02);
      break; }
    case T.DRIFTWOOD: {
      // A large bleached driftwood trunk washed up on the beach — the water region's
      // open-ground landmark (its answer to the poison region's fallen log). A pale,
      // sea-worn log lying at a slight angle with a broken forked branch, weather-split
      // grooves, and exposed end grain, over a cast shadow on the sand. Static. Solid.
      const h = (col*131 + row*83);
      const j = (a, n) => (((h >> a) & 3) / 3) * n;
      ctx.fillStyle = '#d4b070'; ctx.fillRect(x, y, s, s);             // sand base
      ctx.fillStyle = '#b8945a';                                       // cast shadow on sand
      ctx.beginPath(); ctx.ellipse(x+s*0.52, y+s*0.66, s*0.40, s*0.12, -0.12, 0, Math.PI*2); ctx.fill();
      ctx.save();
      ctx.translate(x+s*0.5, y+s*0.52); ctx.rotate(-0.14 + j(0,0.12)); ctx.translate(-(x+s*0.5), -(y+s*0.52));
      const ty = y+s*0.40, th = s*0.26;
      ctx.fillStyle = '#b3a890'; ctx.fillRect(x+s*0.08, ty, s*0.84, th);              // log body
      ctx.fillStyle = '#d8cdb6'; ctx.fillRect(x+s*0.08, ty, s*0.84, th*0.34);         // lit upper curve
      ctx.fillStyle = '#94886f'; ctx.fillRect(x+s*0.08, ty+th*0.74, s*0.84, th*0.26); // shadowed underside
      ctx.strokeStyle = '#9a8d74'; ctx.lineWidth = Math.max(1, s*0.018);              // weather-split grooves
      for (let i = 0; i < 3; i++) {
        const gy = ty + th*(0.34 + i*0.22);
        ctx.beginPath(); ctx.moveTo(x+s*0.10, gy + j(i*2,0.03)*s); ctx.lineTo(x+s*0.90, gy + (j(i*2+1,0.04)-0.02)*s); ctx.stroke();
      }
      ctx.strokeStyle = '#b3a890'; ctx.lineWidth = Math.max(2, s*0.10); ctx.lineCap = 'round';   // forked broken branch
      ctx.beginPath(); ctx.moveTo(x+s*0.70, ty+th*0.5); ctx.lineTo(x+s*0.92, ty-s*0.10); ctx.stroke();
      ctx.fillStyle = '#c2b496';                                       // end grain (left end)
      ctx.beginPath(); ctx.ellipse(x+s*0.09, ty+th*0.5, s*0.05, th*0.5, 0, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#9a8d74'; ctx.lineWidth = Math.max(1, s*0.012);
      ctx.beginPath(); ctx.ellipse(x+s*0.09, ty+th*0.5, s*0.026, th*0.26, 0, 0, Math.PI*2); ctx.stroke();
      ctx.restore();
      break; }
    case T.ICE_SPIRE: {
      // A jagged shard of blue glacial ice thrusting up from the snowfield — the ice
      // region's open-ground landmark (its frozen answer to the luminous light pillar).
      // A tall translucent crystal with a bright sunlit left facet and a deep blue
      // shadow facet, a smaller shard at its foot, a cool cast shadow, and a glint. Solid.
      const h = (col*137 + row*71);
      const j = (a, n) => (((h >> a) & 3) / 3 - 0.5) * n;
      ctx.fillStyle = '#e4ecf2'; ctx.fillRect(x, y, s, s);             // snow base
      ctx.fillStyle = '#cdd9e6';                                       // cast shadow on snow
      ctx.beginPath(); ctx.ellipse(x+s*0.54, y+s*0.86, s*0.34, s*0.09, 0, 0, Math.PI*2); ctx.fill();
      const apexX = x+s*(0.48+j(0,0.10)), apexY = y+s*0.06;
      ctx.fillStyle = '#8cc2de';                                       // small side shard
      ctx.beginPath(); ctx.moveTo(x+s*0.66, y+s*0.50); ctx.lineTo(x+s*0.78, y+s*0.88); ctx.lineTo(x+s*0.58, y+s*0.88); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#6fb0d6';                                       // main spire — shadow facet
      ctx.beginPath(); ctx.moveTo(apexX, apexY); ctx.lineTo(x+s*0.62, y+s*0.9); ctx.lineTo(x+s*0.34, y+s*0.9); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#cdecf8';                                       // main spire — lit facet
      ctx.beginPath(); ctx.moveTo(apexX, apexY); ctx.lineTo(x+s*0.48, y+s*0.9); ctx.lineTo(x+s*0.34, y+s*0.9); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = Math.max(1, s*0.03);   // bright edge
      ctx.beginPath(); ctx.moveTo(apexX, apexY); ctx.lineTo(x+s*0.40, y+s*0.9); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';                         // glint
      ctx.beginPath(); ctx.arc(apexX-s*0.02, apexY+s*0.12, s*0.03, 0, Math.PI*2); ctx.fill();
      break; }
    case T.STANDING_STONE: {
      // A leaning megalithic standing stone (menhir) raised on the scree slopes — the
      // earth region's open-ground landmark. A tall weathered slab canted slightly to
      // one side, sunlit on the left and shadowed on the right, freckled with lichen
      // and bearing a faint carved ring, over a cast shadow on the rubble. Solid.
      const h = (col*131 + row*71);
      const lean = (((h >> 0) & 3) / 3 - 0.5) * 0.16;
      ctx.fillStyle = '#8a8174'; ctx.fillRect(x, y, s, s);             // scree base
      ctx.fillStyle = '#766d61'; ctx.fillRect(x+s*0.18, y+s*0.20, 3, 2); ctx.fillRect(x+s*0.66, y+s*0.74, 3, 2);   // rubble flecks
      ctx.fillStyle = '#5f584e';                                       // cast shadow
      ctx.beginPath(); ctx.ellipse(x+s*0.56, y+s*0.86, s*0.30, s*0.08, 0, 0, Math.PI*2); ctx.fill();
      ctx.save();
      ctx.translate(x+s*0.5, y+s*0.84); ctx.rotate(lean); ctx.translate(-(x+s*0.5), -(y+s*0.84));
      ctx.fillStyle = '#7c756a';                                       // slab body (rounded top)
      ctx.beginPath();
      ctx.moveTo(x+s*0.36, y+s*0.86); ctx.lineTo(x+s*0.34, y+s*0.26);
      ctx.arc(x+s*0.5, y+s*0.26, s*0.16, Math.PI, 0); ctx.lineTo(x+s*0.64, y+s*0.86); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#938b7e'; ctx.fillRect(x+s*0.35, y+s*0.18, s*0.05, s*0.68);    // lit left edge
      ctx.fillStyle = '#5f594f'; ctx.fillRect(x+s*0.59, y+s*0.18, s*0.05, s*0.68);    // shadowed right edge
      ctx.strokeStyle = '#615a50'; ctx.lineWidth = Math.max(1, s*0.025);              // carved ring
      ctx.beginPath(); ctx.arc(x+s*0.49, y+s*0.46, s*0.07, 0, Math.PI*2); ctx.stroke();
      ctx.fillStyle = '#8a9a5a';                                       // lichen freckles
      ctx.beginPath(); ctx.arc(x+s*0.44, y+s*0.66, s*0.035, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(x+s*0.56, y+s*0.34, s*0.028, 0, Math.PI*2); ctx.fill();
      ctx.restore();
      break; }
    case T.CLOUD_SPIRE: {
      // A towering column of piled white cumulus rising from the cloud floor — the air
      // region's open-ground landmark. A stack of overlapping billows, each lit bright
      // on its upper-left and soft-shadowed beneath, brightening toward a sunlit crown.
      // Solid.
      const h = (col*131 + row*83);
      const j = (a, n) => (((h >> a) & 3) / 3 - 0.5) * n;
      ctx.fillStyle = '#dde6f2'; ctx.fillRect(x, y, s, s);             // cloud base
      const puff = (px, py, r, shade, lit) => {
        ctx.fillStyle = shade; ctx.beginPath(); ctx.arc(x+s*px, y+s*py, s*r, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = lit;   ctx.beginPath(); ctx.arc(x+s*(px-0.05), y+s*(py-0.05), s*r*0.62, 0, Math.PI*2); ctx.fill();
      };
      puff(0.52, 0.78, 0.24, '#c4d2e6', '#eef4ff');                    // base billow
      puff(0.44+j(2,0.06), 0.56, 0.22, '#ccd8ea', '#f2f7ff');
      puff(0.56, 0.40, 0.19, '#d4deee', '#f6faff');
      puff(0.48+j(4,0.06), 0.22, 0.15, '#dde6f2', '#ffffff');         // sunlit crown
      break; }
    case T.STORM_SPIRE: {
      // The dark twin of the air region's cloud spire — a churning column of black
      // thunderhead rising from the storm floor, veined by a crackling bolt of
      // lightning that flickers down its core with a brief glow at the strike. The
      // lightning region's open-ground landmark. Animated flicker. Solid.
      const h = (col*131 + row*83);
      const j = (a, n) => (((h >> a) & 3) / 3 - 0.5) * n;
      ctx.fillStyle = '#313749'; ctx.fillRect(x, y, s, s);             // storm floor base
      const puff = (px, py, r, shade, lit) => {
        ctx.fillStyle = shade; ctx.beginPath(); ctx.arc(x+s*px, y+s*py, s*r, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = lit;   ctx.beginPath(); ctx.arc(x+s*(px-0.05), y+s*(py-0.05), s*r*0.62, 0, Math.PI*2); ctx.fill();
      };
      puff(0.52, 0.78, 0.24, '#1b1f2c', '#3a4258');                    // base billow
      puff(0.44+j(2,0.06), 0.56, 0.22, '#202636', '#404a64');
      puff(0.56, 0.40, 0.19, '#262d40', '#48526e');
      puff(0.48+j(4,0.06), 0.22, 0.15, '#2c3548', '#525d7e');         // lit crown
      const flick = 0.35 + 0.65 * Math.pow(0.5 + 0.5*Math.sin(Date.now()/90 + col*1.3 + row*0.9), 3);
      ctx.strokeStyle = `rgba(190,205,255,${flick})`; ctx.lineWidth = Math.max(1, s*0.04); ctx.lineCap = 'round';   // lightning vein
      ctx.beginPath();
      ctx.moveTo(x+s*0.50, y+s*0.10); ctx.lineTo(x+s*0.44, y+s*0.34); ctx.lineTo(x+s*0.56, y+s*0.50);
      ctx.lineTo(x+s*0.46, y+s*0.72); ctx.lineTo(x+s*0.52, y+s*0.90); ctx.stroke();
      ctx.lineCap = 'butt';
      ctx.fillStyle = `rgba(220,228,255,${flick*0.5})`;               // glow at a node
      ctx.beginPath(); ctx.arc(x+s*0.56, y+s*0.50, s*0.06, 0, Math.PI*2); ctx.fill();
      break; }

    // ─── Volcanic region ─────────────────────────────────────────────────────
    case T.VOLCANIC_ROCK: {
      // Border wall of the caldera — cooled black basalt, faceted lit-upper-left /
      // shadowed-lower-right like the mountain rock, seamed by a jagged fault and,
      // on some blocks, still-hot molten rock glowing in a crack. Hashed; static.
      const h = (col * 131 + row * 83);
      const j = (a, n) => (((h >> a) & 3) / 3) * n;
      ctx.fillStyle = '#2b2320'; ctx.fillRect(x, y, s, s);            // base basalt
      ctx.fillStyle = '#3c322c';                                       // lit facet (upper-left)
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + s*(0.56 + j(0,0.14)), y);
      ctx.lineTo(x + s*(0.30 + j(2,0.12)), y + s*(0.52 + j(4,0.10)));
      ctx.lineTo(x, y + s*(0.58 + j(6,0.10)));
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#15100d';                                       // shadowed recess (lower-right)
      ctx.beginPath();
      ctx.moveTo(x + s, y + s*(0.30 + j(0,0.12)));
      ctx.lineTo(x + s, y + s);
      ctx.lineTo(x + s*(0.40 + j(2,0.12)), y + s);
      ctx.lineTo(x + s*(0.64 + j(4,0.08)), y + s*0.50);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#0d0907'; ctx.lineWidth = 1.5;                // jagged fault
      ctx.beginPath();
      ctx.moveTo(x + s*(0.44 + j(8,0.12)), y);
      ctx.lineTo(x + s*(0.52 - j(2,0.10)), y + s*0.5);
      ctx.lineTo(x + s*(0.40 + j(6,0.12)), y + s);
      ctx.stroke();
      if ((h % 3) === 0) {                                             // molten vein in a crack
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#ff5a1e'; ctx.lineWidth = Math.max(1, s*0.05);
        ctx.beginPath();
        ctx.moveTo(x + s*(0.20 + j(2,0.10)), y + s*0.70);
        ctx.lineTo(x + s*(0.36 + j(4,0.08)), y + s*0.52);
        ctx.stroke();
        ctx.strokeStyle = '#ffd23a'; ctx.lineWidth = Math.max(1, s*0.02); ctx.stroke();
        ctx.lineCap = 'butt';
      }
      break; }
    case T.VOLCANIC_GROUND: {
      // Walkable cooled-lava floor — dark charcoal basalt broken into cracked
      // flagstones, dusted with pale ash and, on some tiles, a faint warm hairline
      // where the rock hasn't fully cooled. Hashed per tile; static.
      const h = (col * 137 + row * 89);
      const j = (a, n) => (((h >> a) & 3) / 3) * n;
      ctx.fillStyle = '#4a3b34'; ctx.fillRect(x, y, s, s);            // ash-basalt base
      ctx.fillStyle = '#3b2e29';                                       // darker cracked plate
      ctx.beginPath();
      ctx.moveTo(x + s*(0.10+j(0,0.1)), y + s*0.14);
      ctx.lineTo(x + s*(0.56+j(2,0.1)), y + s*0.10);
      ctx.lineTo(x + s*(0.48+j(4,0.1)), y + s*0.52);
      ctx.lineTo(x + s*0.14, y + s*0.48);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#2a201d'; ctx.lineWidth = 1;                  // seams between plates
      ctx.beginPath(); ctx.moveTo(x, y + s*(0.55+j(6,0.1))); ctx.lineTo(x+s, y + s*(0.50+j(2,0.1))); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + s*(0.6+j(4,0.1)), y); ctx.lineTo(x + s*(0.55+j(8,0.1)), y+s); ctx.stroke();
      ctx.fillStyle = '#6a574d';                                       // ash fleck
      ctx.fillRect(x + s*(0.24+j(0,0.4)), y + s*(0.6+j(2,0.2)), 2, 2);
      if ((h & 3) === 0) {                                             // faint warm crack on ~1/4
        ctx.strokeStyle = 'rgba(255,110,40,0.5)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x + s*0.3, y + s*0.72); ctx.lineTo(x + s*0.5, y + s*0.66); ctx.stroke();
      }
      break; }
    case T.MAGMA_CRACK: {
      // A glowing fissure where molten rock shows through the cooled floor — dappled
      // across the caldera like the cloud regions' brighter puffs, but a pulsing seam
      // of orange-and-yellow magma breathing heat. Animated.
      const h = (col * 137 + row * 89);
      const j = (a, n) => (((h >> a) & 3) / 3 - 0.5) * n;
      ctx.fillStyle = '#4a3b34'; ctx.fillRect(x, y, s, s);            // cooled-floor base
      const pulse = 0.6 + 0.4 * Math.sin(Date.now()/500 + col*0.6 + row*0.5);
      ctx.fillStyle = `rgba(255,90,20,${0.18*pulse})`;                 // soft heat glow
      ctx.beginPath(); ctx.arc(x+s*0.5, y+s*0.5, s*0.42, 0, Math.PI*2); ctx.fill();
      ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(255,60,10,${0.7+0.3*pulse})`; ctx.lineWidth = Math.max(1.5, s*0.11);   // molten seam
      ctx.beginPath();
      ctx.moveTo(x + s*(0.14+j(0,0.1)), y + s*(0.30+j(2,0.15)));
      ctx.lineTo(x + s*0.46, y + s*0.52);
      ctx.lineTo(x + s*(0.84+j(4,0.1)), y + s*(0.70+j(6,0.15)));
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,210,60,${0.8*pulse})`; ctx.lineWidth = Math.max(1, s*0.04); ctx.stroke();   // hot core
      ctx.lineCap = 'butt';
      break; }
    case T.EMBER_FLOWER: {
      // A fire-lily rooted in the ash — the caldera's forage (cut for Emberbloom). A
      // charred stem and a five-petal bloom in molten orange with a glowing
      // yellow-white heart, ringed by a faint warm halo. Static.
      ctx.fillStyle = '#4a3b34'; ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#3b2e29'; ctx.fillRect(x, y + s*0.86, s, s*0.14);   // ash at the foot
      ctx.strokeStyle = '#5a3a20'; ctx.lineWidth = Math.max(1, s*0.045); ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(x+s*0.5, y+s*0.9); ctx.lineTo(x+s*0.5, y+s*0.48); ctx.stroke();
      ctx.lineCap='butt';
      const bx = x+s*0.5, by = y+s*0.40;
      ctx.fillStyle = 'rgba(255,120,40,0.35)';                             // warm halo
      ctx.beginPath(); ctx.arc(bx, by, s*0.26, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#e8531f';                                            // outer petals
      for (let i=0;i<5;i++){ const a=i*Math.PI*2/5 - Math.PI/2;
        ctx.beginPath(); ctx.ellipse(bx+Math.cos(a)*s*0.14, by+Math.sin(a)*s*0.14, s*0.09, s*0.05, a, 0, Math.PI*2); ctx.fill(); }
      ctx.fillStyle = '#ff9a3c';                                            // inner petals
      for (let i=0;i<5;i++){ const a=i*Math.PI*2/5 - Math.PI/2;
        ctx.beginPath(); ctx.ellipse(bx+Math.cos(a)*s*0.09, by+Math.sin(a)*s*0.09, s*0.05, s*0.03, a, 0, Math.PI*2); ctx.fill(); }
      ctx.fillStyle = '#ffe08a'; ctx.beginPath(); ctx.arc(bx, by, s*0.055, 0, Math.PI*2); ctx.fill();   // heart
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(bx-s*0.015, by-s*0.015, s*0.02, 0, Math.PI*2); ctx.fill();
      break; }
    case T.SULFUR_SHRUB: {
      // A low brimstone shrub crusted with sulfur-yellow nodules — the caldera's
      // second forage (cut for Sulfur Moss). A dark twiggy mound with clustered
      // yellow-green crystal buds. Hashed; static.
      const h = (col*137 + row*71);
      const j = (a,n)=>(((h>>a)&3)/3-0.5)*n;
      ctx.fillStyle = '#4a3b34'; ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#33291f';                                          // twiggy mound
      ctx.beginPath(); ctx.ellipse(x+s*0.5, y+s*0.66, s*0.28, s*0.18, 0, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#4a3d28'; ctx.lineWidth = Math.max(1, s*0.035); ctx.lineCap='round';
      for (let i=0;i<4;i++){ const a=(i/4)*Math.PI - Math.PI*0.1;
        ctx.beginPath(); ctx.moveTo(x+s*0.5, y+s*0.72);
        ctx.lineTo(x+s*(0.5+Math.cos(a)*0.32), y+s*(0.72-Math.sin(a)*0.34)); ctx.stroke(); }
      ctx.lineCap='butt';
      const bud=(px,py,r)=>{ ctx.fillStyle='#c9b23a'; ctx.beginPath(); ctx.arc(x+s*px,y+s*py,s*r,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#eadd7a'; ctx.beginPath(); ctx.arc(x+s*(px-0.02),y+s*(py-0.02),s*r*0.5,0,Math.PI*2); ctx.fill(); };
      bud(0.34+j(0,0.06),0.44,0.08); bud(0.6+j(2,0.06),0.40,0.09); bud(0.5+j(4,0.06),0.56,0.07);
      break; }
    case T.OBSIDIAN_SPIRE: {
      // A jagged shard of black volcanic glass thrust up from the caldera floor — the
      // volcanic region's open-ground landmark (its molten answer to the ice spire).
      // A glossy near-black crystal with a lit facet, a smaller shard at its foot, a
      // warm molten glow bleeding from its base, and a bright edge glint. Static.
      const h=(col*137+row*71);
      const j=(a,n)=>(((h>>a)&3)/3-0.5)*n;
      ctx.fillStyle = '#4a3b34'; ctx.fillRect(x, y, s, s);            // caldera base
      ctx.fillStyle = 'rgba(255,90,20,0.28)';                          // molten glow at foot
      ctx.beginPath(); ctx.ellipse(x+s*0.5, y+s*0.86, s*0.34, s*0.10, 0, 0, Math.PI*2); ctx.fill();
      const apexX=x+s*(0.48+j(0,0.10)), apexY=y+s*0.06;
      ctx.fillStyle = '#120d14';                                       // small side shard
      ctx.beginPath(); ctx.moveTo(x+s*0.66, y+s*0.52); ctx.lineTo(x+s*0.78, y+s*0.88); ctx.lineTo(x+s*0.58, y+s*0.88); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#0c0810';                                       // main spire — shadow facet
      ctx.beginPath(); ctx.moveTo(apexX, apexY); ctx.lineTo(x+s*0.62, y+s*0.9); ctx.lineTo(x+s*0.34, y+s*0.9); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#2a2230';                                       // main spire — lit facet
      ctx.beginPath(); ctx.moveTo(apexX, apexY); ctx.lineTo(x+s*0.48, y+s*0.9); ctx.lineTo(x+s*0.34, y+s*0.9); ctx.closePath(); ctx.fill();
      ctx.strokeStyle='rgba(255,150,90,0.8)'; ctx.lineWidth=Math.max(1,s*0.03);   // glossy warm edge
      ctx.beginPath(); ctx.moveTo(apexX, apexY); ctx.lineTo(x+s*0.40, y+s*0.9); ctx.stroke();
      ctx.fillStyle='rgba(255,220,190,0.9)'; ctx.beginPath(); ctx.arc(apexX-s*0.02, apexY+s*0.12, s*0.025, 0, Math.PI*2); ctx.fill();  // glint
      break; }

    // ─── Shadow region ───────────────────────────────────────────────────────
    case T.SHADOW_WALL: {
      // Border of the umbral waste — void-stone so dark it barely catches light,
      // faceted like the crypt wall but drinking the glow, its seams and a cold
      // violet edge-sheen the only things that read, flecked with faint starlight
      // caught in the black. Hashed per tile; static.
      const h=(col*131+row*83);
      const j=(a,n)=>(((h>>a)&3)/3)*n;
      ctx.fillStyle = '#100b18'; ctx.fillRect(x, y, s, s);            // void-stone base
      ctx.fillStyle = '#1b1430';                                       // faintly lit facet (upper-left)
      ctx.fillRect(x, y, s*(0.56+j(0,0.16)), s*(0.50+j(2,0.14)));
      ctx.fillStyle = '#070510';                                       // shadowed recess (lower-right)
      ctx.fillRect(x + s*(0.5-j(4,0.1)), y + s*(0.5+j(6,0.08)), s*0.5, s*0.5);
      ctx.strokeStyle = '#05030a'; ctx.lineWidth = 1;                  // mortar seam
      ctx.beginPath(); ctx.moveTo(x, y + s*(0.5+j(8,0.1))); ctx.lineTo(x+s, y + s*(0.46+j(0,0.1))); ctx.stroke();
      ctx.strokeStyle = 'rgba(150,110,220,0.35)'; ctx.lineWidth = Math.max(1, s*0.02);   // cold violet edge sheen
      ctx.beginPath(); ctx.moveTo(x + s*0.06, y + s*0.1); ctx.lineTo(x + s*0.06, y + s*0.9); ctx.stroke();
      ctx.fillStyle = 'rgba(200,190,255,0.8)';                          // starlight flecks
      ctx.fillRect(x + s*(0.3+j(2,0.5)), y + s*(0.25+j(4,0.4)), 1, 1);
      if ((h%2)===0) ctx.fillRect(x + s*(0.6+j(6,0.3)), y + s*(0.6+j(8,0.3)), 1, 1);
      break; }
    case T.SHADOW_GROUND: {
      // Walkable umbral floor — a deep violet-black waste, mottled with darker
      // hollows and a faint lighter patch, with a stray cold-violet mote hanging in
      // the gloom. Hashed per tile; static.
      const h=(col*137+row*89);
      const j=(a,n)=>(((h>>a)&3)/3)*n;
      ctx.fillStyle = '#241d33'; ctx.fillRect(x, y, s, s);            // umbral base
      ctx.fillStyle = '#1b1526';                                       // darker hollow
      ctx.beginPath(); ctx.ellipse(x+s*(0.4+j(0,0.3)), y+s*(0.5+j(2,0.2)), s*0.22, s*0.15, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#2e2640';                                       // faint lighter patch
      ctx.beginPath(); ctx.ellipse(x+s*(0.7-j(4,0.2)), y+s*(0.3+j(6,0.2)), s*0.14, s*0.09, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(150,120,210,0.5)';                          // cold mote
      ctx.fillRect(x+s*(0.55+j(0,0.3)), y+s*(0.62+j(4,0.2)), 2, 2);
      break; }
    case T.SHADOW_DAPPLE: {
      // A pool of deeper gloom gathered on the umbral floor — a soft dark hollow
      // rimmed by a faint cold-violet edge, the shadow twin of the cloud regions'
      // brighter puffs. Static.
      ctx.fillStyle = '#241d33'; ctx.fillRect(x, y, s, s);            // floor base
      ctx.fillStyle = '#15101f';
      ctx.beginPath(); ctx.arc(x+s*0.5, y+s*0.5, s*0.42, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#0d0a15';
      ctx.beginPath(); ctx.arc(x+s*0.5, y+s*0.5, s*0.26, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = 'rgba(140,110,200,0.25)'; ctx.lineWidth = Math.max(1, s*0.02);
      ctx.beginPath(); ctx.arc(x+s*0.5, y+s*0.5, s*0.4, 0, Math.PI*2); ctx.stroke();
      break; }
    case T.SHADOW_RIFT: {
      // A void chasm torn in the waste — near-black depths breathing a faint cold
      // violet light from far below, its jagged rim catching the last of it. The
      // shadow region's accent, crossed by plank bridges. Animated glow.
      ctx.fillStyle = '#080510'; ctx.fillRect(x, y, s, s);            // the void
      const pulse = 0.5 + 0.5*Math.sin(Date.now()/700 + col*0.5 + row*0.4);
      ctx.fillStyle = `rgba(110,80,180,${0.10+0.14*pulse})`;          // light from below
      ctx.beginPath(); ctx.ellipse(x+s*0.5, y+s*0.5, s*0.3, s*0.4, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = `rgba(160,120,230,${0.14*pulse})`;
      ctx.beginPath(); ctx.ellipse(x+s*0.5, y+s*0.5, s*0.14, s*0.22, 0, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#1b1430'; ctx.lineWidth = Math.max(1, s*0.06); ctx.lineJoin = 'round';   // jagged rim
      ctx.beginPath();
      ctx.moveTo(x, y+s*0.2); ctx.lineTo(x+s*0.3, y+s*0.36); ctx.lineTo(x+s*0.1, y+s*0.6); ctx.lineTo(x+s*0.4, y+s*0.9);
      ctx.stroke();
      break; }
    case T.GLOOM_BLOOM: {
      // A cluster of pale duskcap mushrooms pushing up through the gloom — the
      // shadow waste's forage (cut for Duskcaps). Slender pale stems under
      // grey-violet caps, each with a faint underglow. Hashed; static.
      const h=(col*137+row*71);
      const j=(a,n)=>(((h>>a)&3)/3-0.5)*n;
      ctx.fillStyle = '#241d33'; ctx.fillRect(x, y, s, s);
      const cap=(px,py,r)=>{
        ctx.strokeStyle='#cfc6df'; ctx.lineWidth=Math.max(1,s*0.05); ctx.lineCap='round';   // stem
        ctx.beginPath(); ctx.moveTo(x+s*px, y+s*(py+0.28)); ctx.lineTo(x+s*px, y+s*py); ctx.stroke();
        ctx.lineCap='butt';
        ctx.fillStyle='rgba(150,120,210,0.4)'; ctx.beginPath(); ctx.arc(x+s*px, y+s*py, s*r*1.4, 0, Math.PI*2); ctx.fill();   // underglow
        ctx.fillStyle='#6a5f80'; ctx.beginPath(); ctx.ellipse(x+s*px, y+s*py, s*r, s*r*0.7, 0, Math.PI, 0); ctx.fill();       // cap
        ctx.fillStyle='#9a86c4'; ctx.beginPath(); ctx.ellipse(x+s*(px-0.02), y+s*(py-0.01), s*r*0.6, s*r*0.4, 0, Math.PI, 0); ctx.fill();
      };
      cap(0.40+j(0,0.06), 0.52, 0.14); cap(0.62+j(2,0.06), 0.44, 0.17); cap(0.52+j(4,0.06), 0.62, 0.11);
      break; }
    case T.VOID_FROND: {
      // A black void-fern unfurling from the umbral floor — the shadow waste's second
      // forage (cut for Void Petals). A dark central spine and paired fronds tipped
      // with cold violet light. Hashed lean; static.
      const h=(col*131+row*71);
      const lean=(((h>>0)&3)/3-0.5)*0.2;
      ctx.fillStyle = '#241d33'; ctx.fillRect(x, y, s, s);
      const tipX = x+s*(0.5+lean), tipY = y+s*0.14, baseX = x+s*0.5, baseY = y+s*0.92;
      ctx.strokeStyle = '#0d0a15'; ctx.lineWidth = Math.max(1.5, s*0.06); ctx.lineCap='round';   // spine
      ctx.beginPath(); ctx.moveTo(baseX, baseY); ctx.quadraticCurveTo(x+s*(0.5+lean*2), y+s*0.5, tipX, tipY); ctx.stroke();
      ctx.strokeStyle = '#1e1730'; ctx.lineWidth = Math.max(1, s*0.03);                            // fronds
      for (let i=1;i<=4;i++){ const t=i/5; const fx=baseX+(tipX-baseX)*t, fy=baseY+(tipY-baseY)*t; const l=s*0.2*(1-t*0.5);
        ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx-l, fy-l*0.4); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx+l, fy-l*0.4); ctx.stroke(); }
      ctx.lineCap='butt';
      ctx.fillStyle = 'rgba(160,120,230,0.9)'; ctx.beginPath(); ctx.arc(tipX, tipY, s*0.03, 0, Math.PI*2); ctx.fill();   // violet tip
      break; }
    case T.SHADOW_MONOLITH: {
      // A featureless black monolith standing in the waste — the shadow region's
      // open-ground landmark (its void answer to the earth standing stone). A tall
      // slab so dark it reads only as an absence, edged by a thin cold-violet outline
      // and a faint light-drinking halo, over a cast shadow. Hashed lean; static.
      const h=(col*131+row*71);
      const lean=(((h>>0)&3)/3-0.5)*0.08;
      ctx.fillStyle = '#241d33'; ctx.fillRect(x, y, s, s);            // umbral base
      ctx.fillStyle = 'rgba(90,60,150,0.18)';                          // light-drinking halo
      ctx.beginPath(); ctx.arc(x+s*0.5, y+s*0.5, s*0.44, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#150f22';                                       // cast shadow
      ctx.beginPath(); ctx.ellipse(x+s*0.54, y+s*0.88, s*0.28, s*0.07, 0, 0, Math.PI*2); ctx.fill();
      ctx.save();
      ctx.translate(x+s*0.5, y+s*0.86); ctx.rotate(lean); ctx.translate(-(x+s*0.5), -(y+s*0.86));
      ctx.fillStyle = '#05030a';                                       // the slab — near-total black
      ctx.beginPath();
      ctx.moveTo(x+s*0.38, y+s*0.88); ctx.lineTo(x+s*0.40, y+s*0.16);
      ctx.lineTo(x+s*0.5, y+s*0.10); ctx.lineTo(x+s*0.60, y+s*0.16);
      ctx.lineTo(x+s*0.62, y+s*0.88); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(150,110,220,0.5)'; ctx.lineWidth = Math.max(1, s*0.02);   // cold violet outline
      ctx.stroke();
      ctx.restore();
      break; }
  }
}

// ─── Colossal tree overlay ──────────────────────────────────────────────────
// An exceptionally large ancient tree of the mana forest, NOT bound to the tile
// grid: anchored at one solid border tile (col,row) but drawn as a single giant
// sprite ~3–4 tiles tall and ~3–4 wide, overflowing into the neighbouring tiles.
// Drawn in a dedicated pass after the tile grid (like drawWhirlpoolSuction) so the
// surrounding tiles can't overdraw it. A heavy buttressed trunk rises from the
// anchor's foot into a vast multi-lobed canopy with a sun-lit crown and a scatter
// of glowing violet mana-blossoms (one slowly breathing) under a soft glow halo.
// Size and lean are hashed per anchor so no two read alike. Static trunk/canopy,
// faint pulse on the blossoms + halo.
function drawColossalTree(col, row, ts) {
  const s = ts;
  const baseX = (col - camC) * s + s * 0.5;     // trunk foot — tile centre
  const baseY = (row - camR) * s + s;           // trunk foot — tile bottom
  const h = (col * 113 + row * 71);
  const j = (a, n) => (((h >> a) & 3) / 3) * n;
  const W = s * (1.05 + j(0, 0.35));            // unit scale (1.05 .. 1.40 tiles)
  const lean = (j(2, 1) - 0.5) * 0.18;          // slight trunk lean
  const canX = baseX + lean * W * 2.2;          // canopy centre
  const canY = baseY - W * 1.95;

  // Ground shadow at the foot.
  ctx.fillStyle = 'rgba(8,24,14,0.45)';
  ctx.beginPath(); ctx.ellipse(baseX, baseY - s*0.04, W*0.72, W*0.20, 0, 0, Math.PI*2); ctx.fill();

  // Splayed buttress roots.
  ctx.strokeStyle = '#33271a'; ctx.lineWidth = Math.max(2, W*0.07); ctx.lineCap='round'; ctx.lineJoin='round';
  ctx.beginPath(); ctx.moveTo(baseX, baseY - W*0.12); ctx.quadraticCurveTo(baseX - W*0.38, baseY - W*0.02, baseX - W*0.62, baseY + s*0.12); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(baseX, baseY - W*0.12); ctx.quadraticCurveTo(baseX + W*0.38, baseY - W*0.02, baseX + W*0.62, baseY + s*0.12); ctx.stroke();

  // Thick tapering trunk from foot to canopy.
  const topY = canY + W*0.65;
  ctx.fillStyle = '#4a3820';
  ctx.beginPath();
  ctx.moveTo(baseX - W*0.24, baseY);
  ctx.quadraticCurveTo(baseX - W*0.17, baseY - W*0.9, canX - W*0.13, topY);
  ctx.lineTo(canX + W*0.13, topY);
  ctx.quadraticCurveTo(baseX + W*0.17, baseY - W*0.9, baseX + W*0.24, baseY);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#5a4628';                    // lit trunk edge (upper-left)
  ctx.beginPath();
  ctx.moveTo(baseX - W*0.24, baseY);
  ctx.quadraticCurveTo(baseX - W*0.17, baseY - W*0.9, canX - W*0.13, topY);
  ctx.lineTo(canX - W*0.05, topY);
  ctx.quadraticCurveTo(baseX - W*0.07, baseY - W*0.9, baseX - W*0.11, baseY);
  ctx.closePath(); ctx.fill();

  // A couple of arcing boughs up into the canopy.
  ctx.strokeStyle = '#4a3820'; ctx.lineWidth = Math.max(2, W*0.08); ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(baseX, baseY - W*0.95); ctx.quadraticCurveTo(canX - W*0.7, canY + W*0.5, canX - W*0.98, canY + W*0.15); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(baseX, baseY - W*1.15); ctx.quadraticCurveTo(canX + W*0.7, canY + W*0.45, canX + W*1.0, canY); ctx.stroke();

  // Vast canopy — overlapping blobs, dark base → mid green → lit crown.
  const blob = (dx, dy, r, c2) => { ctx.fillStyle = c2; ctx.beginPath(); ctx.arc(canX + dx*W, canY + dy*W, r*W, 0, Math.PI*2); ctx.fill(); };
  blob(0,    0.25, 1.18, '#0f2c1c');
  blob(-0.85, 0.4, 0.82, '#0f2c1c');
  blob(0.9,   0.42, 0.82, '#0f2c1c');
  blob(-0.5, -0.05, 0.9,  '#163f29');
  blob(0.55, -0.02, 0.9,  '#163f29');
  blob(0,   -0.5,  0.82, '#163f29');
  blob(0.05, 0.18, 1.0,  '#1c5234');
  blob(-0.55,-0.5,  0.5,  '#2f7a49');           // sun-lit crown (upper-left)
  blob(-0.18,-0.62, 0.42, '#2f7a49');
  blob(0.25,-0.32,  0.4,  '#256b3e');

  // Glowing violet mana-blossoms, one slowly breathing.
  const bp = 0.5 + 0.5*Math.sin(Date.now()/700 + col*0.5 + row*0.4);
  const blossom = (dx, dy, r, a) => { ctx.fillStyle = `rgba(202,144,244,${a})`; ctx.beginPath(); ctx.arc(canX+dx*W, canY+dy*W, r*W, 0, Math.PI*2); ctx.fill(); };
  blossom(-0.58, -0.46, 0.07, 0.85);
  blossom(0.38, -0.42, 0.06, 0.8);
  blossom(0.62, 0.12, 0.06, 0.72);
  blossom(-0.32, 0.28, 0.06, 0.7);
  blossom(0.06, -0.16, 0.09, 0.45 + 0.4*bp);    // the breathing one

  // Soft violet glow halo over the crown.
  const g = ctx.createRadialGradient(canX, canY, W*0.2, canX, canY, W*1.55);
  g.addColorStop(0, `rgba(150,90,210,${0.05 + 0.06*bp})`);
  g.addColorStop(1, 'rgba(150,90,210,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(canX, canY, W*1.55, 0, Math.PI*2); ctx.fill();
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
  const walkBob = moving ? Math.round(Math.sin(Date.now() / 110) * 1) : 0;

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

// ─── Enemy sprites ────────────────────────────────────────────────────────────
// Each type has hand-drawn pixel art. Generic fallback at the end.
function drawEnemy(e, ts) {
  const sx = (e.x - camC) * ts, sy = (e.y - camR) * ts;
  const s = ts * e.size;
  const ox = (ts - s) / 2, oy = (ts - s) / 2;

  // Per-enemy idle bob — phase by id so a swarm doesn't bob in unison.
  const phase = (e.id || 0) * 0.74;
  const bob = Math.sin(Date.now() / 220 + phase) * 1.6;
  // Faster wing/aura pulse for ranged/flying types
  const flap = Math.sin(Date.now() / 90 + phase) * 0.5 + 0.5;
  // Damage flash: brief white tint when recently hit (e.hp < e.maxHp by a bit
  // doesn't track recency, but invincible doesn't apply — use a synthetic
  // 'lastHit' set elsewhere if needed; default off).
  const hurt = e.hurtT && e.hurtT > 0 ? Math.min(1, e.hurtT / 150) : 0;

  const px = sx + ox, py = sy + oy + bob;
  const cx = sx + ts / 2, cy = sy + ts / 2 + bob;

  ctx.save();

  // ── Shadow under feet ────────────────────────────────────────────────
  ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
  ctx.beginPath();
  ctx.ellipse(sx + ts / 2, sy + ts * 0.93, ts * 0.30 * e.size, ts * 0.07 * e.size, 0, 0, Math.PI * 2);
  ctx.fill();

  // ── Elemental aura (behind the sprite) ───────────────────────────────
  // Enemies whose attacks carry an element wear that element's signature FX,
  // so the threat reads at a glance and matches its projectiles/contact hits.
  if (e.element) {
    drawElementFX(cx, cy, ts * 0.6 * e.size, e.element, 0.55, (e.id || 0) * 0.37);
  }

  // ── Per-type sprite (uses px/py which include the bob offset) ────────
  switch (e.type) {
    case 'goblin': {
      // Body
      ctx.fillStyle = '#2a5520'; ctx.fillRect(px + s*0.18, py + s*0.46, s*0.64, s*0.40);
      ctx.fillStyle = '#3a6a28'; ctx.fillRect(px + s*0.18, py + s*0.46, s*0.32, s*0.40);  // light side
      // Loincloth
      ctx.fillStyle = '#7a5018'; ctx.fillRect(px + s*0.22, py + s*0.66, s*0.56, s*0.10);
      // Head
      ctx.fillStyle = '#558844';
      ctx.beginPath(); ctx.arc(cx, py + s*0.30, s*0.26, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#3f6a30';   // shaded right
      ctx.beginPath(); ctx.arc(cx + s*0.06, py + s*0.32, s*0.22, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#558844';
      ctx.beginPath(); ctx.arc(cx - s*0.03, py + s*0.28, s*0.21, 0, Math.PI*2); ctx.fill();
      // Pointed ears
      ctx.fillStyle = '#3f6a30';
      ctx.beginPath();
      ctx.moveTo(px + s*0.18, py + s*0.30); ctx.lineTo(px + s*0.06, py + s*0.18); ctx.lineTo(px + s*0.22, py + s*0.38);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(px + s*0.82, py + s*0.30); ctx.lineTo(px + s*0.94, py + s*0.18); ctx.lineTo(px + s*0.78, py + s*0.38);
      ctx.closePath(); ctx.fill();
      // Horns
      ctx.fillStyle = '#2a1408';
      ctx.fillRect(px + s*0.30, py + s*0.04, s*0.10, s*0.16);
      ctx.fillRect(px + s*0.60, py + s*0.04, s*0.10, s*0.16);
      // Eyes (red, with white pupil dots)
      ctx.fillStyle = '#000'; ctx.fillRect(px + s*0.34, py + s*0.28, s*0.10, s*0.07);
      ctx.fillStyle = '#000'; ctx.fillRect(px + s*0.56, py + s*0.28, s*0.10, s*0.07);
      ctx.fillStyle = '#ff3322';
      ctx.fillRect(px + s*0.36, py + s*0.30, s*0.06, s*0.04);
      ctx.fillRect(px + s*0.58, py + s*0.30, s*0.06, s*0.04);
      ctx.fillStyle = '#ffeebb';
      ctx.fillRect(px + s*0.40, py + s*0.31, s*0.02, s*0.02);
      ctx.fillRect(px + s*0.62, py + s*0.31, s*0.02, s*0.02);
      // Sneer (tiny tooth)
      ctx.fillStyle = '#fff';
      ctx.fillRect(px + s*0.46, py + s*0.42, s*0.03, s*0.04);
      break;
    }
    case 'wolf': {
      // Body
      ctx.fillStyle = '#5a3a20'; ctx.fillRect(px + s*0.10, py + s*0.36, s*0.72, s*0.40);
      ctx.fillStyle = '#74502a'; ctx.fillRect(px + s*0.10, py + s*0.36, s*0.72, s*0.18);
      // Head (right-leaning, snout pointing right)
      ctx.fillStyle = '#5a3a20';
      ctx.beginPath(); ctx.arc(px + s*0.74, py + s*0.36, s*0.20, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#74502a';
      ctx.beginPath(); ctx.arc(px + s*0.72, py + s*0.32, s*0.16, 0, Math.PI*2); ctx.fill();
      // Snout
      ctx.fillStyle = '#3a2410';
      ctx.fillRect(px + s*0.84, py + s*0.36, s*0.12, s*0.10);
      ctx.fillStyle = '#000';
      ctx.fillRect(px + s*0.94, py + s*0.38, s*0.04, s*0.04);
      // Ears
      ctx.fillStyle = '#3a2410';
      ctx.beginPath();
      ctx.moveTo(px + s*0.62, py + s*0.18);
      ctx.lineTo(px + s*0.66, py + s*0.30);
      ctx.lineTo(px + s*0.74, py + s*0.22);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(px + s*0.78, py + s*0.18);
      ctx.lineTo(px + s*0.86, py + s*0.20);
      ctx.lineTo(px + s*0.82, py + s*0.30);
      ctx.closePath(); ctx.fill();
      // Yellow eye
      ctx.fillStyle = '#ffd040';
      ctx.fillRect(px + s*0.78, py + s*0.30, s*0.05, s*0.05);
      ctx.fillStyle = '#000';
      ctx.fillRect(px + s*0.80, py + s*0.31, s*0.02, s*0.03);
      // Legs (animated stagger)
      const legPhase = Math.sin(Date.now()/180 + phase) > 0;
      ctx.fillStyle = '#3a2410';
      [0.14, 0.36, 0.54, 0.72].forEach((cx2, idx) => {
        const legLen = (idx % 2 === (legPhase ? 0 : 1)) ? s*0.20 : s*0.24;
        ctx.fillRect(px + s*cx2, py + s*0.74, s*0.10, legLen);
      });
      // Tail
      ctx.strokeStyle = '#3a2410';
      ctx.lineWidth = Math.max(2, s*0.06);
      ctx.beginPath();
      ctx.moveTo(px + s*0.10, py + s*0.48);
      ctx.lineTo(px - s*0.04, py + s*0.34);
      ctx.stroke();
      break;
    }
    case 'skeleton': {
      // Ribcage
      ctx.fillStyle = '#d6d4b6';
      ctx.fillRect(px + s*0.30, py + s*0.44, s*0.40, s*0.40);
      ctx.fillStyle = '#a8a48a';
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(px + s*0.32, py + s*0.50 + i * s*0.08, s*0.36, s*0.03);
      }
      // Spine
      ctx.fillStyle = '#a8a48a';
      ctx.fillRect(px + s*0.48, py + s*0.44, s*0.04, s*0.40);
      // Pelvis
      ctx.fillStyle = '#d6d4b6';
      ctx.fillRect(px + s*0.26, py + s*0.82, s*0.48, s*0.10);
      // Skull
      ctx.fillStyle = '#e8e6c8';
      ctx.beginPath(); ctx.arc(cx, py + s*0.26, s*0.22, 0, Math.PI*2); ctx.fill();
      // Eye sockets
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(px + s*0.40, py + s*0.26, s*0.05, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + s*0.60, py + s*0.26, s*0.05, 0, Math.PI*2); ctx.fill();
      // Soul-flame in sockets
      ctx.fillStyle = `rgba(180,220,255,${0.4 + flap * 0.5})`;
      ctx.fillRect(px + s*0.38, py + s*0.24, s*0.04, s*0.04);
      ctx.fillRect(px + s*0.58, py + s*0.24, s*0.04, s*0.04);
      // Jaw / teeth
      ctx.fillStyle = '#000';
      ctx.fillRect(px + s*0.40, py + s*0.36, s*0.20, s*0.05);
      ctx.fillStyle = '#e8e6c8';
      for (let i = 0; i < 4; i++) ctx.fillRect(px + s*0.42 + i * s*0.045, py + s*0.36, s*0.02, s*0.05);
      // Arm bones holding a bow (ranged enemy)
      ctx.strokeStyle = '#d6d4b6';
      ctx.lineWidth = Math.max(2, s*0.06);
      ctx.beginPath();
      ctx.moveTo(px + s*0.18, py + s*0.50); ctx.lineTo(px + s*0.06, py + s*0.40);
      ctx.moveTo(px + s*0.82, py + s*0.50); ctx.lineTo(px + s*0.94, py + s*0.40);
      ctx.stroke();
      break;
    }
    case 'zombie': {
      // Body — slumped pose
      ctx.fillStyle = '#4a5e2e'; ctx.fillRect(px + s*0.20, py + s*0.42, s*0.60, s*0.46);
      ctx.fillStyle = '#5a7038'; ctx.fillRect(px + s*0.20, py + s*0.42, s*0.30, s*0.46);
      // Tattered clothing rips
      ctx.fillStyle = '#2a3a18';
      ctx.fillRect(px + s*0.28, py + s*0.62, s*0.06, s*0.18);
      ctx.fillRect(px + s*0.66, py + s*0.66, s*0.06, s*0.16);
      // Head — green-grey skin, dripping
      ctx.fillStyle = '#5a7038';
      ctx.beginPath(); ctx.arc(cx, py + s*0.30, s*0.24, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#7a9048';
      ctx.beginPath(); ctx.arc(cx - s*0.04, py + s*0.28, s*0.18, 0, Math.PI*2); ctx.fill();
      // Sunken eyes
      ctx.fillStyle = '#0a0a06';
      ctx.fillRect(px + s*0.36, py + s*0.26, s*0.08, s*0.06);
      ctx.fillRect(px + s*0.56, py + s*0.26, s*0.08, s*0.06);
      ctx.fillStyle = '#ffeebb';
      ctx.fillRect(px + s*0.40, py + s*0.27, s*0.02, s*0.02);
      ctx.fillRect(px + s*0.60, py + s*0.27, s*0.02, s*0.02);
      // Drool / blood
      ctx.fillStyle = '#993322';
      ctx.fillRect(px + s*0.46, py + s*0.42, s*0.04, s*0.06);
      // Outstretched arms
      ctx.fillStyle = '#5a7038';
      ctx.fillRect(px + s*0.04, py + s*0.48, s*0.18, s*0.10);
      ctx.fillRect(px + s*0.78, py + s*0.48, s*0.18, s*0.10);
      break;
    }
    case 'cultist': {
      // Robe
      ctx.fillStyle = '#4a2266'; ctx.fillRect(px + s*0.18, py + s*0.34, s*0.64, s*0.58);
      ctx.fillStyle = '#3a1a52';
      ctx.beginPath();
      ctx.moveTo(px + s*0.18, py + s*0.34); ctx.lineTo(px + s*0.50, py + s*0.34); ctx.lineTo(px + s*0.50, py + s*0.92); ctx.lineTo(px + s*0.18, py + s*0.92);
      ctx.closePath(); ctx.fill();
      // Hood (overhang)
      ctx.fillStyle = '#1a0a26';
      ctx.beginPath();
      ctx.moveTo(px + s*0.20, py + s*0.36);
      ctx.lineTo(px + s*0.50, py + s*0.10);
      ctx.lineTo(px + s*0.80, py + s*0.36);
      ctx.closePath(); ctx.fill();
      // Glowing eyes in shadow
      ctx.fillStyle = `rgba(255,140,200,${0.6 + flap * 0.4})`;
      ctx.fillRect(px + s*0.40, py + s*0.28, s*0.06, s*0.04);
      ctx.fillRect(px + s*0.54, py + s*0.28, s*0.06, s*0.04);
      // Tassel
      ctx.fillStyle = '#ffd070';
      ctx.fillRect(px + s*0.48, py + s*0.50, s*0.04, s*0.10);
      break;
    }
    case 'dryad': {
      // Body — leafy bark
      ctx.fillStyle = '#3a6a2a'; ctx.fillRect(px + s*0.22, py + s*0.42, s*0.56, s*0.46);
      ctx.fillStyle = '#4a8a3a';
      // Leaf cluster crown
      [
        [0.5, 0.18], [0.32, 0.22], [0.68, 0.22], [0.40, 0.10], [0.60, 0.10]
      ].forEach(([fx, fy]) => {
        ctx.beginPath();
        ctx.ellipse(px + s*fx, py + s*fy, s*0.12, s*0.08, 0, 0, Math.PI*2);
        ctx.fill();
      });
      // Face
      ctx.fillStyle = '#d7a868';
      ctx.beginPath(); ctx.arc(cx, py + s*0.36, s*0.18, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.fillRect(px + s*0.40, py + s*0.34, s*0.06, s*0.05);
      ctx.fillRect(px + s*0.54, py + s*0.34, s*0.06, s*0.05);
      // Bark cracks
      ctx.strokeStyle = '#1a3a14';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px + s*0.32, py + s*0.50); ctx.lineTo(px + s*0.38, py + s*0.78);
      ctx.moveTo(px + s*0.66, py + s*0.50); ctx.lineTo(px + s*0.60, py + s*0.78);
      ctx.stroke();
      break;
    }
    case 'troll': {
      // Hulking body
      ctx.fillStyle = '#456a30'; ctx.fillRect(px + s*0.12, py + s*0.30, s*0.76, s*0.60);
      ctx.fillStyle = '#5a8a3a'; ctx.fillRect(px + s*0.12, py + s*0.30, s*0.40, s*0.60);
      // Head
      ctx.fillStyle = '#5a8a3a';
      ctx.beginPath(); ctx.arc(cx, py + s*0.22, s*0.22, 0, Math.PI*2); ctx.fill();
      // Tusks
      ctx.fillStyle = '#f0e6c0';
      ctx.beginPath();
      ctx.moveTo(px + s*0.40, py + s*0.32); ctx.lineTo(px + s*0.43, py + s*0.46); ctx.lineTo(px + s*0.47, py + s*0.32);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(px + s*0.53, py + s*0.32); ctx.lineTo(px + s*0.57, py + s*0.46); ctx.lineTo(px + s*0.60, py + s*0.32);
      ctx.closePath(); ctx.fill();
      // Tiny eyes
      ctx.fillStyle = '#000';
      ctx.fillRect(px + s*0.40, py + s*0.20, s*0.07, s*0.05);
      ctx.fillRect(px + s*0.53, py + s*0.20, s*0.07, s*0.05);
      ctx.fillStyle = '#ffaa44';
      ctx.fillRect(px + s*0.42, py + s*0.21, s*0.02, s*0.03);
      ctx.fillRect(px + s*0.55, py + s*0.21, s*0.02, s*0.03);
      // Club
      ctx.fillStyle = '#3a2410';
      ctx.fillRect(px + s*0.84, py + s*0.30, s*0.10, s*0.42);
      ctx.fillStyle = '#553a18';
      ctx.beginPath(); ctx.arc(px + s*0.89, py + s*0.28, s*0.10, 0, Math.PI*2); ctx.fill();
      break;
    }
    case 'wyvern': {
      // Wings (flapping)
      const wf = Math.sin(Date.now()/120 + phase) * 0.2 + 1;
      ctx.fillStyle = '#5a3a18';
      ctx.beginPath();
      ctx.moveTo(px + s*0.04, py + s*0.40 / wf);
      ctx.lineTo(px + s*0.50, py + s*0.36);
      ctx.lineTo(px + s*0.30, py + s*0.60);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(px + s*0.96, py + s*0.40 / wf);
      ctx.lineTo(px + s*0.50, py + s*0.36);
      ctx.lineTo(px + s*0.70, py + s*0.60);
      ctx.closePath(); ctx.fill();
      // Body
      ctx.fillStyle = '#7a5022';
      ctx.beginPath(); ctx.ellipse(cx, py + s*0.50, s*0.22, s*0.30, 0, 0, Math.PI*2); ctx.fill();
      // Head
      ctx.fillStyle = '#5a3a18';
      ctx.beginPath(); ctx.arc(cx, py + s*0.26, s*0.16, 0, Math.PI*2); ctx.fill();
      // Horns
      ctx.fillStyle = '#3a2410';
      ctx.beginPath();
      ctx.moveTo(px + s*0.42, py + s*0.18); ctx.lineTo(px + s*0.36, py + s*0.04); ctx.lineTo(px + s*0.48, py + s*0.16);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(px + s*0.58, py + s*0.18); ctx.lineTo(px + s*0.64, py + s*0.04); ctx.lineTo(px + s*0.52, py + s*0.16);
      ctx.closePath(); ctx.fill();
      // Eye
      ctx.fillStyle = '#ffaa44';
      ctx.fillRect(px + s*0.46, py + s*0.24, s*0.08, s*0.05);
      ctx.fillStyle = '#000';
      ctx.fillRect(px + s*0.49, py + s*0.25, s*0.02, s*0.03);
      // Tail
      ctx.strokeStyle = '#7a5022';
      ctx.lineWidth = Math.max(2, s*0.06);
      ctx.beginPath();
      ctx.moveTo(cx, py + s*0.78);
      ctx.lineTo(cx + Math.sin(Date.now()/180 + phase) * s*0.20, py + s);
      ctx.stroke();
      break;
    }
    case 'vampire': {
      // Cape
      ctx.fillStyle = '#1a0612';
      ctx.beginPath();
      ctx.moveTo(px + s*0.50, py + s*0.40);
      ctx.lineTo(px + s*0.06, py + s*0.86);
      ctx.lineTo(px + s*0.94, py + s*0.86);
      ctx.closePath(); ctx.fill();
      // Body
      ctx.fillStyle = '#2a0a18';
      ctx.fillRect(px + s*0.32, py + s*0.42, s*0.36, s*0.42);
      // Red sash
      ctx.fillStyle = '#aa1122';
      ctx.fillRect(px + s*0.32, py + s*0.66, s*0.36, s*0.06);
      // Pale face
      ctx.fillStyle = '#f0e0d8';
      ctx.beginPath(); ctx.arc(cx, py + s*0.28, s*0.20, 0, Math.PI*2); ctx.fill();
      // Slicked hair
      ctx.fillStyle = '#0a0606';
      ctx.fillRect(px + s*0.30, py + s*0.10, s*0.40, s*0.12);
      // Red eyes
      ctx.fillStyle = '#ff0022';
      ctx.fillRect(px + s*0.36, py + s*0.28, s*0.07, s*0.05);
      ctx.fillRect(px + s*0.57, py + s*0.28, s*0.07, s*0.05);
      // Fangs
      ctx.fillStyle = '#fff';
      ctx.fillRect(px + s*0.44, py + s*0.38, s*0.03, s*0.05);
      ctx.fillRect(px + s*0.53, py + s*0.38, s*0.03, s*0.05);
      break;
    }
    case 'wraith': {
      // Aura
      const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, s*0.55);
      aura.addColorStop(0, `rgba(100,160,200,${0.45 + flap * 0.25})`);
      aura.addColorStop(1, 'rgba(100,160,200,0)');
      ctx.fillStyle = aura;
      ctx.fillRect(sx - ts*0.1, sy - ts*0.1, ts*1.2, ts*1.2);
      // Tattered robe — wavering bottom
      ctx.fillStyle = '#2a3a4a';
      ctx.beginPath();
      ctx.moveTo(px + s*0.20, py + s*0.30);
      ctx.lineTo(px + s*0.80, py + s*0.30);
      for (let i = 6; i >= 0; i--) {
        const fx = px + s*0.20 + (s*0.60) * (i/6);
        const fy = py + s*0.90 + Math.sin(Date.now()/240 + phase + i*0.6) * s*0.05;
        ctx.lineTo(fx, fy);
      }
      ctx.closePath(); ctx.fill();
      // Hood shadow
      ctx.fillStyle = '#0a1218';
      ctx.beginPath();
      ctx.moveTo(px + s*0.22, py + s*0.34);
      ctx.lineTo(px + s*0.50, py + s*0.10);
      ctx.lineTo(px + s*0.78, py + s*0.34);
      ctx.closePath(); ctx.fill();
      // Glowing eyes
      ctx.fillStyle = `rgba(140,220,255,${0.7 + flap * 0.3})`;
      ctx.fillRect(px + s*0.38, py + s*0.24, s*0.08, s*0.05);
      ctx.fillRect(px + s*0.54, py + s*0.24, s*0.08, s*0.05);
      break;
    }
    case 'pixie': {
      // Trailing sparkles
      for (let i = 0; i < 4; i++) {
        const a = Date.now()/300 + i + phase;
        ctx.fillStyle = `rgba(180,220,255,${0.4 + 0.4 * Math.sin(a)})`;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * s*0.32, cy + Math.sin(a) * s*0.32, s*0.04, 0, Math.PI*2);
        ctx.fill();
      }
      // Wings (translucent, fluttering)
      const wing = 1 + Math.sin(Date.now()/60 + phase) * 0.4;
      ctx.fillStyle = `rgba(200,220,255,${0.4 + flap * 0.2})`;
      ctx.beginPath();
      ctx.ellipse(cx - s*0.22, cy - s*0.04, s*0.20 * wing, s*0.14, -0.3, 0, Math.PI*2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + s*0.22, cy - s*0.04, s*0.20 * wing, s*0.14, 0.3, 0, Math.PI*2);
      ctx.fill();
      // Body
      ctx.fillStyle = '#88aaff';
      ctx.beginPath(); ctx.arc(cx, cy, s*0.20, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#c0d8ff';
      ctx.beginPath(); ctx.arc(cx - s*0.05, cy - s*0.04, s*0.14, 0, Math.PI*2); ctx.fill();
      // Tiny eyes
      ctx.fillStyle = '#000';
      ctx.fillRect(cx - s*0.08, cy - s*0.02, s*0.03, s*0.03);
      ctx.fillRect(cx + s*0.05, cy - s*0.02, s*0.03, s*0.03);
      break;
    }
    case 'displacer': {
      // Body (long panther shape)
      ctx.fillStyle = '#22153a';
      ctx.beginPath(); ctx.ellipse(cx, py + s*0.62, s*0.36, s*0.20, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#3a2a55';
      ctx.beginPath(); ctx.ellipse(cx - s*0.04, py + s*0.58, s*0.26, s*0.15, 0, 0, Math.PI*2); ctx.fill();
      // Head
      ctx.fillStyle = '#3a2a55';
      ctx.beginPath(); ctx.arc(px + s*0.26, py + s*0.46, s*0.18, 0, Math.PI*2); ctx.fill();
      // Two tentacles (animated)
      ctx.strokeStyle = '#554488';
      ctx.lineWidth = Math.max(2, s*0.06);
      ctx.lineCap = 'round';
      [-1, 1].forEach((side, i) => {
        const sway = Math.sin(Date.now()/200 + phase + i) * s*0.10;
        ctx.beginPath();
        ctx.moveTo(px + s*0.20, py + s*0.40);
        ctx.quadraticCurveTo(px + (0.04 + side*0.0) * s, py + s*(0.18 + i*0.05), px + s*0.06 + sway, py + s*0.06);
        ctx.stroke();
      });
      // Tentacle tip pads
      ctx.fillStyle = '#aa66dd';
      [-1, 1].forEach((side, i) => {
        const sway = Math.sin(Date.now()/200 + phase + i) * s*0.10;
        ctx.beginPath(); ctx.arc(px + s*0.06 + sway, py + s*0.06, s*0.05, 0, Math.PI*2); ctx.fill();
      });
      // Eyes
      ctx.fillStyle = '#ffcc44';
      ctx.fillRect(px + s*0.20, py + s*0.42, s*0.05, s*0.04);
      ctx.fillRect(px + s*0.30, py + s*0.42, s*0.05, s*0.04);
      // Tail
      ctx.strokeStyle = '#3a2a55';
      ctx.lineWidth = Math.max(2, s*0.05);
      ctx.beginPath();
      ctx.moveTo(px + s*0.84, py + s*0.60);
      ctx.lineTo(px + s*0.98, py + s*0.42 + Math.sin(Date.now()/200 + phase) * s*0.04);
      ctx.stroke();
      break;
    }
    case 'beholder': {
      // Outer shell
      ctx.fillStyle = '#1a2a14';
      ctx.beginPath(); ctx.arc(cx, cy, s*0.44, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#3a5a28';
      ctx.beginPath(); ctx.arc(cx, cy, s*0.40, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#557a32';
      ctx.beginPath(); ctx.arc(cx - s*0.06, cy - s*0.06, s*0.32, 0, Math.PI*2); ctx.fill();
      // Central glowing eye
      ctx.fillStyle = `rgba(255,210,60,${0.7 + flap * 0.3})`;
      ctx.beginPath(); ctx.arc(cx, cy, s*0.18, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#ffe080';
      ctx.beginPath(); ctx.arc(cx, cy, s*0.13, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(cx, cy, s*0.06, 0, Math.PI*2); ctx.fill();
      // Eye stalks
      const stalkPhase = Date.now() / 180 + phase;
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3 - Math.PI / 6 + Math.sin(stalkPhase + i) * 0.1;
        const tip = { x: cx + Math.cos(a) * s*0.55, y: cy + Math.sin(a) * s*0.55 };
        ctx.strokeStyle = '#557a32';
        ctx.lineWidth = Math.max(2, s*0.05);
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * s*0.40, cy + Math.sin(a) * s*0.40);
        ctx.lineTo(tip.x, tip.y);
        ctx.stroke();
        // Tip eye
        ctx.fillStyle = '#88cc44';
        ctx.beginPath(); ctx.arc(tip.x, tip.y, s*0.06, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.arc(tip.x, tip.y, s*0.03, 0, Math.PI*2); ctx.fill();
      }
      // Tooth-fanged maw
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(cx, cy + s*0.30, s*0.16, s*0.06, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 5; i++) {
        ctx.fillRect(cx - s*0.14 + i * s*0.07, cy + s*0.27, s*0.03, s*0.05);
      }
      break;
    }
    case 'treant': {
      // Bark trunk
      ctx.fillStyle = '#2a3a1a';
      ctx.fillRect(px + s*0.30, py + s*0.40, s*0.40, s*0.50);
      ctx.fillStyle = '#3a4a22';
      ctx.fillRect(px + s*0.30, py + s*0.40, s*0.20, s*0.50);
      // Bark grain
      ctx.strokeStyle = '#1a2a0a';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(px + s*0.34, py + s*0.46 + i * s*0.14);
        ctx.lineTo(px + s*0.66, py + s*0.46 + i * s*0.14 + s*0.04);
        ctx.stroke();
      }
      // Roots
      ctx.fillStyle = '#1a2a0a';
      ctx.fillRect(px + s*0.20, py + s*0.86, s*0.18, s*0.10);
      ctx.fillRect(px + s*0.62, py + s*0.86, s*0.18, s*0.10);
      // Leafy crown
      ctx.fillStyle = '#3a6a22';
      [[0.50, 0.30], [0.30, 0.34], [0.70, 0.34], [0.40, 0.20], [0.60, 0.20], [0.50, 0.12]].forEach(([fx, fy]) => {
        ctx.beginPath(); ctx.arc(px + s*fx, py + s*fy, s*0.16, 0, Math.PI*2); ctx.fill();
      });
      ctx.fillStyle = '#4a8a32';
      [[0.45, 0.26], [0.58, 0.30], [0.50, 0.16]].forEach(([fx, fy]) => {
        ctx.beginPath(); ctx.arc(px + s*fx, py + s*fy, s*0.10, 0, Math.PI*2); ctx.fill();
      });
      // Branch arms
      ctx.strokeStyle = '#2a3a1a';
      ctx.lineWidth = Math.max(3, s*0.10);
      ctx.beginPath();
      ctx.moveTo(px + s*0.30, py + s*0.50);
      ctx.lineTo(px + s*0.06, py + s*0.32);
      ctx.moveTo(px + s*0.70, py + s*0.50);
      ctx.lineTo(px + s*0.94, py + s*0.32);
      ctx.stroke();
      // Glowing eyes
      ctx.fillStyle = `rgba(255,90,30,${0.7 + flap * 0.3})`;
      ctx.fillRect(px + s*0.40, py + s*0.50, s*0.08, s*0.06);
      ctx.fillRect(px + s*0.54, py + s*0.50, s*0.08, s*0.06);
      // Gnarled mouth
      ctx.fillStyle = '#0a1206';
      ctx.fillRect(px + s*0.44, py + s*0.62, s*0.12, s*0.04);
      break;
    }
    case 'owlbear': {
      // Body
      ctx.fillStyle = '#4a3208'; ctx.fillRect(px + s*0.16, py + s*0.34, s*0.68, s*0.56);
      ctx.fillStyle = '#7a5018'; ctx.fillRect(px + s*0.16, py + s*0.34, s*0.34, s*0.56);
      // Chest tuft
      ctx.fillStyle = '#c8a464';
      ctx.beginPath(); ctx.ellipse(cx, py + s*0.62, s*0.18, s*0.20, 0, 0, Math.PI*2); ctx.fill();
      // Head (rounded owl head)
      ctx.fillStyle = '#8a6622';
      ctx.beginPath(); ctx.arc(cx, py + s*0.28, s*0.28, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#a07a30';
      ctx.beginPath(); ctx.arc(cx - s*0.06, py + s*0.26, s*0.22, 0, Math.PI*2); ctx.fill();
      // Big owl eyes
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(px + s*0.40, py + s*0.26, s*0.10, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + s*0.60, py + s*0.26, s*0.10, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#ffaa00';
      ctx.beginPath(); ctx.arc(px + s*0.40, py + s*0.26, s*0.07, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + s*0.60, py + s*0.26, s*0.07, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(px + s*0.40, py + s*0.26, s*0.035, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + s*0.60, py + s*0.26, s*0.035, 0, Math.PI*2); ctx.fill();
      // Beak
      ctx.fillStyle = '#552a08';
      ctx.beginPath();
      ctx.moveTo(px + s*0.46, py + s*0.34);
      ctx.lineTo(px + s*0.54, py + s*0.34);
      ctx.lineTo(px + s*0.50, py + s*0.42);
      ctx.closePath(); ctx.fill();
      // Ear tufts
      ctx.fillStyle = '#4a3208';
      ctx.beginPath(); ctx.moveTo(px + s*0.24, py + s*0.10); ctx.lineTo(px + s*0.30, py + s*0.04); ctx.lineTo(px + s*0.34, py + s*0.14); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px + s*0.76, py + s*0.10); ctx.lineTo(px + s*0.70, py + s*0.04); ctx.lineTo(px + s*0.66, py + s*0.14); ctx.closePath(); ctx.fill();
      // Claws
      ctx.fillStyle = '#f0e0a0';
      ctx.fillRect(px + s*0.18, py + s*0.86, s*0.04, s*0.06);
      ctx.fillRect(px + s*0.78, py + s*0.86, s*0.04, s*0.06);
      break;
    }
    case 'lich':
    case 'lich_boss': {
      // Boss aura
      if (e.boss) {
        const auraR = s*0.65 + Math.sin(Date.now()/220) * s*0.04;
        const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, auraR);
        aura.addColorStop(0, 'rgba(180, 60, 255, 0.45)');
        aura.addColorStop(1, 'rgba(180, 60, 255, 0)');
        ctx.fillStyle = aura;
        ctx.fillRect(cx - auraR, cy - auraR, auraR*2, auraR*2);
      }
      // Tattered robe (sway)
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.moveTo(px + s*0.22, py + s*0.34);
      ctx.lineTo(px + s*0.78, py + s*0.34);
      for (let i = 7; i >= 0; i--) {
        const fx = px + s*0.22 + (s*0.56) * (i/7);
        const fy = py + s*0.92 + Math.sin(Date.now()/220 + phase + i*0.5) * s*0.04;
        ctx.lineTo(fx, fy);
      }
      ctx.closePath(); ctx.fill();
      // Inner shadow
      ctx.fillStyle = 'rgba(0,0,0,0.40)';
      ctx.fillRect(px + s*0.40, py + s*0.38, s*0.20, s*0.45);
      // Skull head
      ctx.fillStyle = '#e8e4c0';
      ctx.beginPath(); ctx.arc(cx, py + s*0.26, s*0.22, 0, Math.PI*2); ctx.fill();
      // Jaw
      ctx.fillStyle = '#000';
      ctx.fillRect(px + s*0.40, py + s*0.36, s*0.20, s*0.06);
      ctx.fillStyle = '#e8e4c0';
      for (let i = 0; i < 4; i++) ctx.fillRect(px + s*0.41 + i * s*0.046, py + s*0.36, s*0.024, s*0.06);
      // Glowing soul eyes
      ctx.fillStyle = `rgba(180,80,255,${0.7 + flap * 0.3})`;
      ctx.fillRect(px + s*0.38, py + s*0.24, s*0.08, s*0.05);
      ctx.fillRect(px + s*0.54, py + s*0.24, s*0.08, s*0.05);
      ctx.fillStyle = '#fff';
      ctx.fillRect(px + s*0.40, py + s*0.25, s*0.03, s*0.03);
      ctx.fillRect(px + s*0.56, py + s*0.25, s*0.03, s*0.03);
      // Crown
      ctx.fillStyle = '#ffcc00';
      ctx.fillRect(px + s*0.32, py + s*0.06, s*0.36, s*0.06);
      [0.34, 0.42, 0.50, 0.58, 0.66].forEach(fx => {
        ctx.beginPath();
        ctx.moveTo(px + s*fx, py + s*0.06);
        ctx.lineTo(px + s*(fx + 0.04), py + s*0.06);
        ctx.lineTo(px + s*(fx + 0.02), py - s*0.02);
        ctx.closePath(); ctx.fill();
      });
      // Floating spell-orb
      const orbY = py + s*0.50 + Math.sin(Date.now()/180 + phase) * s*0.04;
      ctx.fillStyle = `rgba(220,120,255,${0.6 + flap * 0.4})`;
      ctx.beginPath(); ctx.arc(px + s*0.10, orbY, s*0.10, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(px + s*0.10, orbY, s*0.04, 0, Math.PI*2); ctx.fill();
      break;
    }
    case 'mummy_lord': {
      // Amber boss aura
      if (e.boss) {
        const auraR = s*0.65 + Math.sin(Date.now()/220) * s*0.04;
        const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, auraR);
        aura.addColorStop(0, 'rgba(230, 180, 60, 0.45)');
        aura.addColorStop(1, 'rgba(230, 180, 60, 0)');
        ctx.fillStyle = aura;
        ctx.fillRect(cx - auraR, cy - auraR, auraR*2, auraR*2);
      }
      // Bandaged body
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.moveTo(px + s*0.26, py + s*0.32);
      ctx.lineTo(px + s*0.74, py + s*0.32);
      ctx.lineTo(px + s*0.70, py + s*0.92);
      ctx.lineTo(px + s*0.30, py + s*0.92);
      ctx.closePath(); ctx.fill();
      // Bandage wrap lines (sway slightly so it reads as cloth)
      ctx.strokeStyle = 'rgba(120,90,40,0.55)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 5; i++) {
        const wy = py + s*(0.40 + i*0.11) + Math.sin(Date.now()/300 + phase + i) * s*0.01;
        ctx.beginPath();
        ctx.moveTo(px + s*0.28, wy);
        ctx.lineTo(px + s*0.72, wy + s*0.03);
        ctx.stroke();
      }
      // Crossed arm bandages
      ctx.strokeStyle = 'rgba(120,90,40,0.7)';
      ctx.beginPath(); ctx.moveTo(px + s*0.30, py + s*0.44); ctx.lineTo(px + s*0.70, py + s*0.62); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px + s*0.70, py + s*0.44); ctx.lineTo(px + s*0.30, py + s*0.62); ctx.stroke();
      // Head (wrapped, with an exposed face slit)
      ctx.fillStyle = '#e8d8a8';
      ctx.beginPath(); ctx.arc(cx, py + s*0.24, s*0.22, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(120,90,40,0.5)';
      ctx.fillRect(px + s*0.30, py + s*0.16, s*0.40, s*0.02);
      ctx.fillRect(px + s*0.30, py + s*0.30, s*0.40, s*0.02);
      // Pharaoh nemes headdress — gold band with blue stripes
      ctx.fillStyle = '#ffcc33';
      ctx.fillRect(px + s*0.26, py + s*0.06, s*0.48, s*0.07);
      ctx.fillStyle = '#2a6ac0';
      for (let i = 0; i < 4; i++) ctx.fillRect(px + s*0.29 + i*s*0.12, py + s*0.06, s*0.04, s*0.07);
      // Lappets framing the face
      ctx.fillStyle = '#ffcc33';
      ctx.fillRect(px + s*0.22, py + s*0.12, s*0.06, s*0.26);
      ctx.fillRect(px + s*0.72, py + s*0.12, s*0.06, s*0.26);
      // Glowing eyes
      ctx.fillStyle = `rgba(120,220,200,${0.7 + flap * 0.3})`;
      ctx.fillRect(px + s*0.38, py + s*0.22, s*0.08, s*0.05);
      ctx.fillRect(px + s*0.54, py + s*0.22, s*0.08, s*0.05);
      ctx.fillStyle = '#fff';
      ctx.fillRect(px + s*0.40, py + s*0.23, s*0.03, s*0.03);
      ctx.fillRect(px + s*0.56, py + s*0.23, s*0.03, s*0.03);
      break;
    }
    case 'giant_spider': {
      // Legs — 4 per side, skittering
      ctx.strokeStyle = '#241c2e'; ctx.lineWidth = Math.max(2, s*0.05); ctx.lineCap = 'round';
      for (let i = 0; i < 4; i++) {
        const ly = py + s*0.40 + i * s*0.10;
        const k = Math.sin(Date.now()/160 + phase + i) * s*0.04;
        ctx.beginPath();
        ctx.moveTo(cx - s*0.10, py + s*0.54); ctx.lineTo(px + s*0.02, ly + k);
        ctx.moveTo(cx + s*0.10, py + s*0.54); ctx.lineTo(px + s*0.98, ly - k);
        ctx.stroke();
      }
      // Abdomen
      ctx.fillStyle = '#352841';
      ctx.beginPath(); ctx.ellipse(cx, py + s*0.66, s*0.26, s*0.22, 0, 0, Math.PI*2); ctx.fill();
      // Hourglass marking
      ctx.fillStyle = '#aa3344';
      ctx.beginPath(); ctx.moveTo(cx, py + s*0.56); ctx.lineTo(cx - s*0.06, py + s*0.66); ctx.lineTo(cx, py + s*0.76); ctx.lineTo(cx + s*0.06, py + s*0.66); ctx.closePath(); ctx.fill();
      // Cephalothorax
      ctx.fillStyle = '#4a3a55';
      ctx.beginPath(); ctx.arc(cx, py + s*0.42, s*0.16, 0, Math.PI*2); ctx.fill();
      // Cluster of red eyes
      ctx.fillStyle = '#ff3344';
      [[-0.06,0.38],[0.06,0.38],[-0.03,0.44],[0.03,0.44]].forEach(([ex,ey]) => ctx.fillRect(cx + s*ex, py + s*ey, s*0.03, s*0.03));
      // Fangs
      ctx.fillStyle = '#e8e0d0';
      ctx.fillRect(cx - s*0.05, py + s*0.50, s*0.03, s*0.05);
      ctx.fillRect(cx + s*0.02, py + s*0.50, s*0.03, s*0.05);
      break;
    }
    case 'magma_mephit': {
      // Wings (small bat wings, flapping)
      const mwf = Math.sin(Date.now()/100 + phase) * 0.25 + 1;
      ctx.fillStyle = '#6a1a0a';
      ctx.beginPath(); ctx.moveTo(cx - s*0.10, py + s*0.44); ctx.lineTo(px + s*0.02, py + s*0.30/mwf); ctx.lineTo(px + s*0.08, py + s*0.56); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + s*0.10, py + s*0.44); ctx.lineTo(px + s*0.98, py + s*0.30/mwf); ctx.lineTo(px + s*0.92, py + s*0.56); ctx.closePath(); ctx.fill();
      // Body — dark crust
      ctx.fillStyle = '#3a1408';
      ctx.beginPath(); ctx.arc(cx, py + s*0.54, s*0.24, 0, Math.PI*2); ctx.fill();
      // Glowing lava cracks
      ctx.strokeStyle = `rgba(255,140,40,${0.6 + flap*0.4})`; ctx.lineWidth = Math.max(1.5, s*0.04);
      ctx.beginPath();
      ctx.moveTo(cx - s*0.12, py + s*0.46); ctx.lineTo(cx - s*0.02, py + s*0.58); ctx.lineTo(cx - s*0.10, py + s*0.66);
      ctx.moveTo(cx + s*0.10, py + s*0.44); ctx.lineTo(cx + s*0.02, py + s*0.56);
      ctx.stroke();
      // Head
      ctx.fillStyle = '#3a1408';
      ctx.beginPath(); ctx.arc(cx, py + s*0.30, s*0.16, 0, Math.PI*2); ctx.fill();
      // Horns
      ctx.fillStyle = '#1a0a04';
      ctx.beginPath(); ctx.moveTo(cx - s*0.10, py + s*0.20); ctx.lineTo(cx - s*0.16, py + s*0.06); ctx.lineTo(cx - s*0.04, py + s*0.18); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + s*0.10, py + s*0.20); ctx.lineTo(cx + s*0.16, py + s*0.06); ctx.lineTo(cx + s*0.04, py + s*0.18); ctx.closePath(); ctx.fill();
      // Burning eyes
      ctx.fillStyle = `rgba(255,210,80,${0.7 + flap*0.3})`;
      ctx.fillRect(cx - s*0.08, py + s*0.28, s*0.05, s*0.04);
      ctx.fillRect(cx + s*0.03, py + s*0.28, s*0.05, s*0.04);
      break;
    }
    case 'gnoll': {
      // Body
      ctx.fillStyle = '#6a5226'; ctx.fillRect(px + s*0.26, py + s*0.42, s*0.42, s*0.46);
      ctx.fillStyle = '#84682e'; ctx.fillRect(px + s*0.26, py + s*0.42, s*0.21, s*0.46);
      // Spear
      ctx.strokeStyle = '#3a2410'; ctx.lineWidth = Math.max(2, s*0.05);
      ctx.beginPath(); ctx.moveTo(px + s*0.80, py + s*0.10); ctx.lineTo(px + s*0.80, py + s*0.92); ctx.stroke();
      ctx.fillStyle = '#bcb0a0';
      ctx.beginPath(); ctx.moveTo(px + s*0.80, py + s*0.02); ctx.lineTo(px + s*0.74, py + s*0.18); ctx.lineTo(px + s*0.86, py + s*0.18); ctx.closePath(); ctx.fill();
      // Hyena head (snout right)
      ctx.fillStyle = '#84682e';
      ctx.beginPath(); ctx.arc(px + s*0.44, py + s*0.30, s*0.20, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#6a5226'; ctx.fillRect(px + s*0.52, py + s*0.30, s*0.20, s*0.12);
      ctx.fillStyle = '#1a1206'; ctx.fillRect(px + s*0.70, py + s*0.32, s*0.04, s*0.04);
      // Mane spikes
      ctx.fillStyle = '#4a3a1a';
      [0.30,0.40,0.50].forEach(fx => { ctx.beginPath(); ctx.moveTo(px + s*fx, py + s*0.14); ctx.lineTo(px + s*(fx+0.04), py + s*0.02); ctx.lineTo(px + s*(fx+0.08), py + s*0.16); ctx.closePath(); ctx.fill(); });
      // Eye + teeth
      ctx.fillStyle = '#ffcc33'; ctx.fillRect(px + s*0.46, py + s*0.26, s*0.06, s*0.04);
      ctx.fillStyle = '#000'; ctx.fillRect(px + s*0.48, py + s*0.27, s*0.02, s*0.02);
      ctx.fillStyle = '#fff'; ctx.fillRect(px + s*0.58, py + s*0.40, s*0.10, s*0.03);
      break;
    }
    case 'hell_hound': {
      // Flame aura
      const ha = ctx.createRadialGradient(cx, py + s*0.55, 0, cx, py + s*0.55, s*0.5);
      ha.addColorStop(0, `rgba(255,120,30,${0.35 + flap*0.25})`);
      ha.addColorStop(1, 'rgba(255,60,10,0)');
      ctx.fillStyle = ha; ctx.fillRect(sx - ts*0.1, sy - ts*0.1, ts*1.2, ts*1.2);
      // Body
      ctx.fillStyle = '#1a1010'; ctx.fillRect(px + s*0.14, py + s*0.46, s*0.62, s*0.34);
      ctx.fillStyle = '#33201c'; ctx.fillRect(px + s*0.14, py + s*0.46, s*0.62, s*0.16);
      // Head (right)
      ctx.fillStyle = '#1a1010';
      ctx.beginPath(); ctx.arc(px + s*0.74, py + s*0.46, s*0.18, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#33201c'; ctx.fillRect(px + s*0.84, py + s*0.46, s*0.12, s*0.08);
      // Ear
      ctx.fillStyle = '#1a1010';
      ctx.beginPath(); ctx.moveTo(px + s*0.64, py + s*0.30); ctx.lineTo(px + s*0.68, py + s*0.40); ctx.lineTo(px + s*0.74, py + s*0.32); ctx.closePath(); ctx.fill();
      // Burning eye + maw
      ctx.fillStyle = `rgba(255,180,40,${0.7 + flap*0.3})`; ctx.fillRect(px + s*0.78, py + s*0.42, s*0.05, s*0.04);
      ctx.fillStyle = '#ff5510'; ctx.fillRect(px + s*0.86, py + s*0.52, s*0.08, s*0.03);
      // Legs
      ctx.fillStyle = '#1a1010';
      [0.20,0.40,0.58].forEach(fx => ctx.fillRect(px + s*fx, py + s*0.78, s*0.08, s*0.14));
      // Flame mane flicker
      ctx.fillStyle = `rgba(255,140,30,${0.6 + flap*0.4})`;
      [0.30,0.44,0.58].forEach((fx,i) => { const fl = Math.sin(Date.now()/110 + i + phase)*s*0.04; ctx.beginPath(); ctx.moveTo(px + s*fx, py + s*0.46); ctx.lineTo(px + s*(fx+0.03), py + s*0.30 - fl); ctx.lineTo(px + s*(fx+0.07), py + s*0.46); ctx.closePath(); ctx.fill(); });
      break;
    }
    case 'giant_scorpion': {
      // Body segments
      ctx.fillStyle = '#7a5e22';
      ctx.beginPath(); ctx.ellipse(cx, py + s*0.60, s*0.22, s*0.16, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#94772e';
      ctx.beginPath(); ctx.ellipse(cx, py + s*0.56, s*0.16, s*0.10, 0, 0, Math.PI*2); ctx.fill();
      // Legs
      ctx.strokeStyle = '#5a4418'; ctx.lineWidth = Math.max(1.5, s*0.04); ctx.lineCap = 'round';
      for (let i=0;i<3;i++){ const ly = py + s*0.56 + i*s*0.08; ctx.beginPath(); ctx.moveTo(cx - s*0.12, ly); ctx.lineTo(px + s*0.04, ly + s*0.10); ctx.moveTo(cx + s*0.12, ly); ctx.lineTo(px + s*0.96, ly + s*0.10); ctx.stroke(); }
      // Pincers
      ctx.fillStyle = '#94772e';
      ctx.beginPath(); ctx.arc(px + s*0.16, py + s*0.46, s*0.10, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + s*0.84, py + s*0.46, s*0.10, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#5a4418';
      ctx.fillRect(px + s*0.08, py + s*0.40, s*0.06, s*0.10);
      ctx.fillRect(px + s*0.86, py + s*0.40, s*0.06, s*0.10);
      // Tail arcing over
      ctx.fillStyle = '#7a5e22';
      [[0.62,0.50],[0.70,0.38],[0.74,0.24],[0.70,0.12]].forEach(([fx,fy]) => { ctx.beginPath(); ctx.arc(px + s*fx, py + s*fy, s*0.06, 0, Math.PI*2); ctx.fill(); });
      // Stinger
      ctx.fillStyle = '#3a2a0a';
      ctx.beginPath(); ctx.moveTo(px + s*0.66, py + s*0.10); ctx.lineTo(px + s*0.60, py + s*0.02); ctx.lineTo(px + s*0.74, py + s*0.10); ctx.closePath(); ctx.fill();
      // Eyes
      ctx.fillStyle = '#1a1206';
      ctx.fillRect(cx - s*0.05, py + s*0.52, s*0.03, s*0.03);
      ctx.fillRect(cx + s*0.02, py + s*0.52, s*0.03, s*0.03);
      break;
    }
    case 'salamander': {
      // Heat glow
      const sga = ctx.createRadialGradient(cx, cy, 0, cx, cy, s*0.5);
      sga.addColorStop(0, `rgba(255,110,30,${0.3 + flap*0.2})`);
      sga.addColorStop(1, 'rgba(255,60,10,0)');
      ctx.fillStyle = sga; ctx.fillRect(sx - ts*0.1, sy - ts*0.1, ts*1.2, ts*1.2);
      // Coiled serpent body
      ctx.strokeStyle = '#cc3a14'; ctx.lineWidth = Math.max(4, s*0.16); ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(px + s*0.16, py + s*0.86);
      ctx.quadraticCurveTo(px + s*0.92, py + s*0.78, px + s*0.60, py + s*0.54);
      ctx.quadraticCurveTo(px + s*0.30, py + s*0.34, cx, py + s*0.26);
      ctx.stroke();
      ctx.strokeStyle = '#ff6a2a'; ctx.lineWidth = Math.max(2, s*0.07);
      ctx.beginPath();
      ctx.moveTo(px + s*0.18, py + s*0.84);
      ctx.quadraticCurveTo(px + s*0.86, py + s*0.76, px + s*0.58, py + s*0.54);
      ctx.stroke();
      // Head
      ctx.fillStyle = '#cc3a14';
      ctx.beginPath(); ctx.arc(cx, py + s*0.24, s*0.16, 0, Math.PI*2); ctx.fill();
      // Snake eyes
      ctx.fillStyle = '#ffe070';
      ctx.fillRect(cx - s*0.08, py + s*0.20, s*0.05, s*0.04);
      ctx.fillRect(cx + s*0.03, py + s*0.20, s*0.05, s*0.04);
      ctx.fillStyle = '#000';
      ctx.fillRect(cx - s*0.06, py + s*0.21, s*0.015, s*0.03);
      ctx.fillRect(cx + s*0.05, py + s*0.21, s*0.015, s*0.03);
      // Forked tongue
      ctx.strokeStyle = '#ffcc40'; ctx.lineWidth = Math.max(1.5, s*0.03);
      ctx.beginPath(); ctx.moveTo(cx, py + s*0.34); ctx.lineTo(cx, py + s*0.42); ctx.stroke();
      break;
    }
    case 'sahuagin': {
      // Body
      ctx.fillStyle = '#2f6a5c'; ctx.fillRect(px + s*0.28, py + s*0.42, s*0.40, s*0.46);
      ctx.fillStyle = '#3f8a78'; ctx.fillRect(px + s*0.28, py + s*0.42, s*0.20, s*0.46);
      // Dorsal fin
      ctx.fillStyle = '#1f4a40';
      ctx.beginPath(); ctx.moveTo(cx, py + s*0.18); ctx.lineTo(px + s*0.40, py + s*0.40); ctx.lineTo(px + s*0.60, py + s*0.40); ctx.closePath(); ctx.fill();
      // Head
      ctx.fillStyle = '#3f8a78';
      ctx.beginPath(); ctx.arc(cx, py + s*0.32, s*0.18, 0, Math.PI*2); ctx.fill();
      // Gills
      ctx.strokeStyle = '#1f4a40'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(px + s*0.34, py + s*0.34); ctx.lineTo(px + s*0.38, py + s*0.40); ctx.moveTo(px + s*0.30, py + s*0.38); ctx.lineTo(px + s*0.34, py + s*0.44); ctx.stroke();
      // Fish eyes
      ctx.fillStyle = '#ffdd55';
      ctx.beginPath(); ctx.arc(px + s*0.42, py + s*0.30, s*0.05, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + s*0.58, py + s*0.30, s*0.05, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(px + s*0.42, py + s*0.30, s*0.02, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + s*0.58, py + s*0.30, s*0.02, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#0a1a18'; ctx.fillRect(px + s*0.42, py + s*0.40, s*0.16, s*0.04);
      // Trident
      ctx.strokeStyle = '#bcae90'; ctx.lineWidth = Math.max(2, s*0.05);
      ctx.beginPath(); ctx.moveTo(px + s*0.80, py + s*0.12); ctx.lineTo(px + s*0.80, py + s*0.92);
      ctx.moveTo(px + s*0.72, py + s*0.14); ctx.lineTo(px + s*0.72, py + s*0.02);
      ctx.moveTo(px + s*0.80, py + s*0.12); ctx.lineTo(px + s*0.80, py - s*0.02);
      ctx.moveTo(px + s*0.88, py + s*0.14); ctx.lineTo(px + s*0.88, py + s*0.02);
      ctx.stroke();
      break;
    }
    case 'kuo_toa': {
      // Hunched body
      ctx.fillStyle = '#5a7a68';
      ctx.beginPath(); ctx.ellipse(cx, py + s*0.60, s*0.26, s*0.28, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#6f9080';
      ctx.beginPath(); ctx.ellipse(cx - s*0.05, py + s*0.56, s*0.18, s*0.20, 0, 0, Math.PI*2); ctx.fill();
      // Head
      ctx.fillStyle = '#6f9080';
      ctx.beginPath(); ctx.arc(cx, py + s*0.30, s*0.18, 0, Math.PI*2); ctx.fill();
      // Bulging eyes on stalks
      ctx.fillStyle = '#5a7a68';
      ctx.fillRect(px + s*0.30, py + s*0.20, s*0.06, s*0.06);
      ctx.fillRect(px + s*0.64, py + s*0.20, s*0.06, s*0.06);
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(px + s*0.32, py + s*0.18, s*0.07, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + s*0.68, py + s*0.18, s*0.07, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(px + s*0.32, py + s*0.18, s*0.03, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + s*0.68, py + s*0.18, s*0.03, 0, Math.PI*2); ctx.fill();
      // Gaping mouth
      ctx.fillStyle = '#0a1a14';
      ctx.beginPath(); ctx.arc(cx, py + s*0.40, s*0.07, 0, Math.PI*2); ctx.fill();
      // Spindly arms
      ctx.strokeStyle = '#5a7a68'; ctx.lineWidth = Math.max(2, s*0.05); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(px + s*0.30, py + s*0.50); ctx.lineTo(px + s*0.10, py + s*0.64); ctx.moveTo(px + s*0.70, py + s*0.50); ctx.lineTo(px + s*0.90, py + s*0.64); ctx.stroke();
      break;
    }
    case 'hunter_shark': {
      // Torpedo body
      ctx.fillStyle = '#54707c';
      ctx.beginPath(); ctx.ellipse(cx, py + s*0.56, s*0.40, s*0.18, 0, 0, Math.PI*2); ctx.fill();
      // Pale belly
      ctx.fillStyle = '#aab8bf';
      ctx.beginPath(); ctx.ellipse(cx, py + s*0.64, s*0.34, s*0.09, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#54707c';
      // Tail fin (left)
      ctx.beginPath(); ctx.moveTo(px + s*0.06, py + s*0.56); ctx.lineTo(px - s*0.04, py + s*0.40); ctx.lineTo(px - s*0.04, py + s*0.72); ctx.closePath(); ctx.fill();
      // Dorsal fin
      ctx.beginPath(); ctx.moveTo(cx - s*0.02, py + s*0.40); ctx.lineTo(cx + s*0.10, py + s*0.18); ctx.lineTo(cx + s*0.18, py + s*0.42); ctx.closePath(); ctx.fill();
      // Pectoral fin
      ctx.beginPath(); ctx.moveTo(cx + s*0.04, py + s*0.66); ctx.lineTo(cx - s*0.02, py + s*0.84); ctx.lineTo(cx + s*0.16, py + s*0.68); ctx.closePath(); ctx.fill();
      // Gill slits
      ctx.strokeStyle = '#36505a'; ctx.lineWidth = 1.5;
      for (let i=0;i<3;i++){ ctx.beginPath(); ctx.moveTo(px + s*0.62 + i*s*0.05, py + s*0.48); ctx.lineTo(px + s*0.62 + i*s*0.05, py + s*0.62); ctx.stroke(); }
      // Eye
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(px + s*0.80, py + s*0.52, s*0.035, 0, Math.PI*2); ctx.fill();
      // Toothy grin
      ctx.fillStyle = '#0a1a1e'; ctx.fillRect(px + s*0.80, py + s*0.60, s*0.16, s*0.04);
      ctx.fillStyle = '#fff';
      for (let i=0;i<4;i++) ctx.fillRect(px + s*0.81 + i*s*0.04, py + s*0.60, s*0.015, s*0.04);
      break;
    }
    case 'merrow': {
      // Hulking body
      ctx.fillStyle = '#2f5a7a'; ctx.fillRect(px + s*0.18, py + s*0.36, s*0.58, s*0.54);
      ctx.fillStyle = '#3f7090'; ctx.fillRect(px + s*0.18, py + s*0.36, s*0.30, s*0.54);
      // Spiny back fin
      ctx.fillStyle = '#1f4055';
      [0.22,0.34,0.46].forEach(fx => { ctx.beginPath(); ctx.moveTo(px + s*fx, py + s*0.36); ctx.lineTo(px + s*(fx+0.04), py + s*0.18); ctx.lineTo(px + s*(fx+0.10), py + s*0.36); ctx.closePath(); ctx.fill(); });
      // Head
      ctx.fillStyle = '#3f7090';
      ctx.beginPath(); ctx.arc(cx + s*0.02, py + s*0.26, s*0.20, 0, Math.PI*2); ctx.fill();
      // Underbite teeth
      ctx.fillStyle = '#0a2030'; ctx.fillRect(px + s*0.42, py + s*0.34, s*0.22, s*0.06);
      ctx.fillStyle = '#e8f0f0';
      for (let i=0;i<5;i++) ctx.fillRect(px + s*0.43 + i*s*0.045, py + s*0.36, s*0.02, s*0.05);
      // Yellow eyes
      ctx.fillStyle = '#ffdd44';
      ctx.fillRect(px + s*0.44, py + s*0.22, s*0.06, s*0.05);
      ctx.fillRect(px + s*0.58, py + s*0.22, s*0.06, s*0.05);
      ctx.fillStyle = '#000';
      ctx.fillRect(px + s*0.46, py + s*0.23, s*0.02, s*0.03);
      ctx.fillRect(px + s*0.60, py + s*0.23, s*0.02, s*0.03);
      // Harpoon
      ctx.strokeStyle = '#3a2410'; ctx.lineWidth = Math.max(2, s*0.05);
      ctx.beginPath(); ctx.moveTo(px + s*0.84, py + s*0.16); ctx.lineTo(px + s*0.84, py + s*0.92); ctx.stroke();
      ctx.fillStyle = '#bcb0a0';
      ctx.beginPath(); ctx.moveTo(px + s*0.84, py + s*0.06); ctx.lineTo(px + s*0.78, py + s*0.20); ctx.lineTo(px + s*0.90, py + s*0.20); ctx.closePath(); ctx.fill();
      break;
    }
    case 'sea_hag': {
      // Sickly aura
      const sha = ctx.createRadialGradient(cx, cy, 0, cx, cy, s*0.5);
      sha.addColorStop(0, `rgba(90,180,90,${0.25 + flap*0.2})`);
      sha.addColorStop(1, 'rgba(90,180,90,0)');
      ctx.fillStyle = sha; ctx.fillRect(sx - ts*0.1, sy - ts*0.1, ts*1.2, ts*1.2);
      // Ragged robe
      ctx.fillStyle = '#2f5a3a';
      ctx.beginPath(); ctx.moveTo(px + s*0.26, py + s*0.40); ctx.lineTo(px + s*0.74, py + s*0.40);
      for (let i=6;i>=0;i--){ const fx = px + s*0.26 + s*0.48*(i/6); const fy = py + s*0.90 + Math.sin(Date.now()/240 + phase + i*0.6)*s*0.04; ctx.lineTo(fx, fy); }
      ctx.closePath(); ctx.fill();
      // Green face
      ctx.fillStyle = '#5a8a4a';
      ctx.beginPath(); ctx.arc(cx, py + s*0.30, s*0.18, 0, Math.PI*2); ctx.fill();
      // Stringy hair
      ctx.strokeStyle = '#3a5a2a'; ctx.lineWidth = Math.max(1.5, s*0.03);
      [0.30,0.40,0.60,0.70].forEach(fx => { ctx.beginPath(); ctx.moveTo(px + s*fx, py + s*0.18); ctx.lineTo(px + s*(fx-0.04), py + s*0.46); ctx.stroke(); });
      // Crooked nose
      ctx.fillStyle = '#4a7a3a';
      ctx.beginPath(); ctx.moveTo(cx, py + s*0.30); ctx.lineTo(cx - s*0.04, py + s*0.40); ctx.lineTo(cx + s*0.04, py + s*0.38); ctx.closePath(); ctx.fill();
      // Glowing eyes
      ctx.fillStyle = `rgba(200,255,120,${0.7+flap*0.3})`;
      ctx.fillRect(px + s*0.40, py + s*0.26, s*0.06, s*0.04);
      ctx.fillRect(px + s*0.54, py + s*0.26, s*0.06, s*0.04);
      // Clawed casting hand + hex orb
      ctx.strokeStyle = '#5a8a4a'; ctx.lineWidth = Math.max(2, s*0.05); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(px + s*0.70, py + s*0.50); ctx.lineTo(px + s*0.90, py + s*0.40); ctx.stroke();
      ctx.fillStyle = `rgba(160,255,120,${0.6+flap*0.4})`;
      ctx.beginPath(); ctx.arc(px + s*0.92, py + s*0.38, s*0.06, 0, Math.PI*2); ctx.fill();
      break;
    }
    case 'water_elemental': {
      // Translucent body
      ctx.fillStyle = 'rgba(40,130,200,0.55)';
      ctx.beginPath();
      ctx.moveTo(px + s*0.10, py + s*0.90);
      ctx.bezierCurveTo(px + s*0.0, py + s*0.40, px + s*0.30, py + s*0.10 + Math.sin(Date.now()/200+phase)*s*0.04, cx, py + s*0.16);
      ctx.bezierCurveTo(px + s*0.70, py + s*0.10, px + s*1.0, py + s*0.40, px + s*0.90, py + s*0.90);
      ctx.closePath(); ctx.fill();
      // Inner highlight
      ctx.fillStyle = 'rgba(120,200,255,0.5)';
      ctx.beginPath(); ctx.ellipse(cx - s*0.06, py + s*0.50, s*0.18, s*0.30, 0, 0, Math.PI*2); ctx.fill();
      // Foam crest
      ctx.fillStyle = 'rgba(230,250,255,0.8)';
      for (let i=0;i<4;i++){ ctx.beginPath(); ctx.arc(px + s*0.28 + i*s*0.16, py + s*0.20 + Math.sin(Date.now()/160+i+phase)*s*0.03, s*0.05, 0, Math.PI*2); ctx.fill(); }
      // Eyes
      ctx.fillStyle = '#eaffff';
      ctx.beginPath(); ctx.arc(px + s*0.42, py + s*0.46, s*0.06, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + s*0.60, py + s*0.46, s*0.06, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#1a4a6a';
      ctx.beginPath(); ctx.arc(px + s*0.42, py + s*0.46, s*0.03, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + s*0.60, py + s*0.46, s*0.03, 0, Math.PI*2); ctx.fill();
      break;
    }
    case 'ice_mephit': {
      const iwf = Math.sin(Date.now()/100 + phase) * 0.25 + 1;
      // Crystal wings
      ctx.fillStyle = 'rgba(170,220,240,0.8)';
      ctx.beginPath(); ctx.moveTo(cx - s*0.10, py + s*0.44); ctx.lineTo(px + s*0.02, py + s*0.28/iwf); ctx.lineTo(px + s*0.08, py + s*0.56); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + s*0.10, py + s*0.44); ctx.lineTo(px + s*0.98, py + s*0.28/iwf); ctx.lineTo(px + s*0.92, py + s*0.56); ctx.closePath(); ctx.fill();
      // Body
      ctx.fillStyle = '#7fc0dd';
      ctx.beginPath(); ctx.arc(cx, py + s*0.54, s*0.24, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#aee0f0';
      ctx.beginPath(); ctx.arc(cx - s*0.06, py + s*0.50, s*0.16, 0, Math.PI*2); ctx.fill();
      // Head
      ctx.fillStyle = '#7fc0dd';
      ctx.beginPath(); ctx.arc(cx, py + s*0.30, s*0.16, 0, Math.PI*2); ctx.fill();
      // Ice-shard horns
      ctx.fillStyle = '#dff4ff';
      ctx.beginPath(); ctx.moveTo(cx - s*0.10, py + s*0.20); ctx.lineTo(cx - s*0.14, py + s*0.04); ctx.lineTo(cx - s*0.04, py + s*0.18); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + s*0.10, py + s*0.20); ctx.lineTo(cx + s*0.14, py + s*0.04); ctx.lineTo(cx + s*0.04, py + s*0.18); ctx.closePath(); ctx.fill();
      // Eyes
      ctx.fillStyle = `rgba(220,250,255,${0.7+flap*0.3})`;
      ctx.fillRect(cx - s*0.08, py + s*0.28, s*0.05, s*0.04);
      ctx.fillRect(cx + s*0.03, py + s*0.28, s*0.05, s*0.04);
      break;
    }
    case 'winter_wolf': {
      // Body
      ctx.fillStyle = '#cfe2ee'; ctx.fillRect(px + s*0.10, py + s*0.38, s*0.70, s*0.40);
      ctx.fillStyle = '#eaf4fa'; ctx.fillRect(px + s*0.10, py + s*0.38, s*0.70, s*0.18);
      // Head (right)
      ctx.fillStyle = '#cfe2ee';
      ctx.beginPath(); ctx.arc(px + s*0.74, py + s*0.38, s*0.20, 0, Math.PI*2); ctx.fill();
      // Snout + frost breath
      ctx.fillStyle = '#b0ccdc'; ctx.fillRect(px + s*0.84, py + s*0.38, s*0.12, s*0.10);
      ctx.fillStyle = `rgba(200,235,255,${0.4+flap*0.3})`;
      ctx.beginPath(); ctx.arc(px + s*1.00, py + s*0.44, s*0.06, 0, Math.PI*2); ctx.fill();
      // Ear
      ctx.fillStyle = '#b0ccdc';
      ctx.beginPath(); ctx.moveTo(px + s*0.62, py + s*0.18); ctx.lineTo(px + s*0.66, py + s*0.32); ctx.lineTo(px + s*0.74, py + s*0.24); ctx.closePath(); ctx.fill();
      // Ice-blue eye
      ctx.fillStyle = '#3aa0ff'; ctx.fillRect(px + s*0.78, py + s*0.32, s*0.05, s*0.05);
      // Legs
      const wlp = Math.sin(Date.now()/180 + phase) > 0;
      ctx.fillStyle = '#b0ccdc';
      [0.14,0.34,0.52,0.70].forEach((fx,idx) => { const ll = (idx%2===(wlp?0:1))?s*0.20:s*0.24; ctx.fillRect(px + s*fx, py + s*0.74, s*0.10, ll); });
      // Frost on back
      ctx.fillStyle = '#ffffff';
      [0.22,0.40,0.58].forEach(fx => ctx.fillRect(px + s*fx, py + s*0.36, s*0.06, s*0.04));
      break;
    }
    case 'yeti': {
      // Shaggy body
      ctx.fillStyle = '#e6eef2'; ctx.fillRect(px + s*0.18, py + s*0.34, s*0.64, s*0.56);
      // Fur tufts
      ctx.fillStyle = '#cdd9e0';
      for (let i=0;i<6;i++){ ctx.beginPath(); ctx.moveTo(px + s*0.18 + i*s*0.11, py + s*0.90); ctx.lineTo(px + s*0.23 + i*s*0.11, py + s*0.80); ctx.lineTo(px + s*0.28 + i*s*0.11, py + s*0.90); ctx.closePath(); ctx.fill(); }
      // Head
      ctx.fillStyle = '#e6eef2';
      ctx.beginPath(); ctx.arc(cx, py + s*0.28, s*0.24, 0, Math.PI*2); ctx.fill();
      // Blue face patch
      ctx.fillStyle = '#9fc4dd';
      ctx.beginPath(); ctx.ellipse(cx, py + s*0.32, s*0.14, s*0.16, 0, 0, Math.PI*2); ctx.fill();
      // Angry eyes
      ctx.fillStyle = '#1a3a5a';
      ctx.fillRect(px + s*0.42, py + s*0.28, s*0.06, s*0.04);
      ctx.fillRect(px + s*0.54, py + s*0.28, s*0.06, s*0.04);
      // Fanged mouth
      ctx.fillStyle = '#0a2030'; ctx.fillRect(px + s*0.42, py + s*0.40, s*0.18, s*0.05);
      ctx.fillStyle = '#fff';
      ctx.fillRect(px + s*0.44, py + s*0.40, s*0.03, s*0.05);
      ctx.fillRect(px + s*0.55, py + s*0.40, s*0.03, s*0.05);
      // Arms + claws
      ctx.fillStyle = '#e6eef2';
      ctx.fillRect(px + s*0.06, py + s*0.42, s*0.16, s*0.12);
      ctx.fillRect(px + s*0.78, py + s*0.42, s*0.16, s*0.12);
      ctx.fillStyle = '#dfe8ee';
      [0.06,0.12,0.18].forEach(fx => ctx.fillRect(px + s*fx, py + s*0.54, s*0.03, s*0.06));
      [0.78,0.84,0.90].forEach(fx => ctx.fillRect(px + s*fx, py + s*0.54, s*0.03, s*0.06));
      break;
    }
    case 'mammoth': {
      // Body mass
      ctx.fillStyle = '#6a4a2a';
      ctx.beginPath(); ctx.ellipse(cx, py + s*0.56, s*0.40, s*0.30, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#82602f';
      ctx.beginPath(); ctx.ellipse(cx - s*0.04, py + s*0.50, s*0.30, s*0.22, 0, 0, Math.PI*2); ctx.fill();
      // Shaggy fur skirt
      ctx.fillStyle = '#553a1f';
      for (let i=0;i<7;i++) { ctx.beginPath(); ctx.moveTo(px + s*0.16 + i*s*0.10, py + s*0.82); ctx.lineTo(px + s*0.20 + i*s*0.10, py + s*0.94); ctx.lineTo(px + s*0.24 + i*s*0.10, py + s*0.82); ctx.closePath(); ctx.fill(); }
      // Head
      ctx.fillStyle = '#82602f';
      ctx.beginPath(); ctx.arc(px + s*0.70, py + s*0.46, s*0.22, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#6a4a2a';
      ctx.beginPath(); ctx.arc(px + s*0.70, py + s*0.30, s*0.12, 0, Math.PI*2); ctx.fill();
      // Trunk
      ctx.strokeStyle = '#82602f'; ctx.lineWidth = Math.max(4, s*0.12); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(px + s*0.78, py + s*0.50); ctx.quadraticCurveTo(px + s*0.96, py + s*0.66, px + s*0.86, py + s*0.86); ctx.stroke();
      // Tusk
      ctx.strokeStyle = '#f0e6cc'; ctx.lineWidth = Math.max(3, s*0.07);
      ctx.beginPath(); ctx.moveTo(px + s*0.66, py + s*0.58); ctx.quadraticCurveTo(px + s*0.62, py + s*0.84, px + s*0.78, py + s*0.84); ctx.stroke();
      // Eye
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(px + s*0.74, py + s*0.42, s*0.03, 0, Math.PI*2); ctx.fill();
      break;
    }
    case 'white_dragon': {
      const dwf = Math.sin(Date.now()/120 + phase) * 0.2 + 1;
      // Wings
      ctx.fillStyle = '#a9d2e6';
      ctx.beginPath(); ctx.moveTo(px + s*0.04, py + s*0.38/dwf); ctx.lineTo(px + s*0.48, py + s*0.34); ctx.lineTo(px + s*0.28, py + s*0.62); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px + s*0.96, py + s*0.38/dwf); ctx.lineTo(px + s*0.52, py + s*0.34); ctx.lineTo(px + s*0.72, py + s*0.62); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#d6ecf5';
      ctx.beginPath(); ctx.moveTo(px + s*0.10, py + s*0.40/dwf); ctx.lineTo(px + s*0.46, py + s*0.38); ctx.lineTo(px + s*0.30, py + s*0.56); ctx.closePath(); ctx.fill();
      // Body
      ctx.fillStyle = '#cfe6f0';
      ctx.beginPath(); ctx.ellipse(cx, py + s*0.54, s*0.22, s*0.30, 0, 0, Math.PI*2); ctx.fill();
      // Head
      ctx.fillStyle = '#e6f3f8';
      ctx.beginPath(); ctx.arc(cx, py + s*0.26, s*0.17, 0, Math.PI*2); ctx.fill();
      // Frill horns
      ctx.fillStyle = '#9fc4dd';
      ctx.beginPath(); ctx.moveTo(px + s*0.42, py + s*0.16); ctx.lineTo(px + s*0.30, py + s*0.04); ctx.lineTo(px + s*0.48, py + s*0.14); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px + s*0.58, py + s*0.16); ctx.lineTo(px + s*0.70, py + s*0.04); ctx.lineTo(px + s*0.52, py + s*0.14); ctx.closePath(); ctx.fill();
      // Frost breath
      ctx.fillStyle = `rgba(200,235,255,${0.4+flap*0.3})`;
      ctx.beginPath(); ctx.arc(cx, py + s*0.40, s*0.07, 0, Math.PI*2); ctx.fill();
      // Eye
      ctx.fillStyle = '#3aa0ff'; ctx.fillRect(px + s*0.46, py + s*0.24, s*0.07, s*0.05);
      ctx.fillStyle = '#000'; ctx.fillRect(px + s*0.49, py + s*0.25, s*0.02, s*0.03);
      // Tail
      ctx.strokeStyle = '#cfe6f0'; ctx.lineWidth = Math.max(2, s*0.06);
      ctx.beginPath(); ctx.moveTo(cx, py + s*0.80); ctx.lineTo(cx + Math.sin(Date.now()/180+phase)*s*0.20, py + s); ctx.stroke();
      break;
    }
    case 'frost_giant': {
      // Legs
      ctx.fillStyle = '#7fa6c2'; ctx.fillRect(px + s*0.30, py + s*0.66, s*0.16, s*0.26); ctx.fillRect(px + s*0.54, py + s*0.66, s*0.16, s*0.26);
      // Torso
      ctx.fillStyle = '#8fb6d2'; ctx.fillRect(px + s*0.26, py + s*0.30, s*0.48, s*0.42);
      ctx.fillStyle = '#a6cbe2'; ctx.fillRect(px + s*0.26, py + s*0.30, s*0.24, s*0.42);
      // Fur kilt
      ctx.fillStyle = '#d8e6ee'; ctx.fillRect(px + s*0.26, py + s*0.60, s*0.48, s*0.10);
      // Head
      ctx.fillStyle = '#a6cbe2';
      ctx.beginPath(); ctx.arc(cx, py + s*0.20, s*0.16, 0, Math.PI*2); ctx.fill();
      // Beard
      ctx.fillStyle = '#e8f2f8'; ctx.fillRect(px + s*0.40, py + s*0.24, s*0.20, s*0.12);
      // Eyes
      ctx.fillStyle = '#1a3a5a'; ctx.fillRect(px + s*0.42, py + s*0.18, s*0.05, s*0.04); ctx.fillRect(px + s*0.53, py + s*0.18, s*0.05, s*0.04);
      // Ice axe
      ctx.strokeStyle = '#5a4428'; ctx.lineWidth = Math.max(2, s*0.05);
      ctx.beginPath(); ctx.moveTo(px + s*0.80, py + s*0.20); ctx.lineTo(px + s*0.80, py + s*0.86); ctx.stroke();
      ctx.fillStyle = 'rgba(200,235,255,0.9)';
      ctx.beginPath(); ctx.moveTo(px + s*0.74, py + s*0.20); ctx.lineTo(px + s*0.96, py + s*0.16); ctx.lineTo(px + s*0.86, py + s*0.34); ctx.closePath(); ctx.fill();
      break;
    }
    case 'gargoyle': {
      const gwf = Math.sin(Date.now()/140 + phase)*0.15 + 1;
      // Stone wings
      ctx.fillStyle = '#5a564e';
      ctx.beginPath(); ctx.moveTo(cx - s*0.06, py + s*0.40); ctx.lineTo(px + s*0.0, py + s*0.20/gwf); ctx.lineTo(px + s*0.10, py + s*0.30); ctx.lineTo(px + s*0.06, py + s*0.54); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + s*0.06, py + s*0.40); ctx.lineTo(px + s*1.0, py + s*0.20/gwf); ctx.lineTo(px + s*0.90, py + s*0.30); ctx.lineTo(px + s*0.94, py + s*0.54); ctx.closePath(); ctx.fill();
      // Crouched body
      ctx.fillStyle = '#6f6a60'; ctx.fillRect(px + s*0.30, py + s*0.46, s*0.40, s*0.40);
      ctx.fillStyle = '#827c70'; ctx.fillRect(px + s*0.30, py + s*0.46, s*0.20, s*0.40);
      // Head
      ctx.fillStyle = '#827c70';
      ctx.beginPath(); ctx.arc(cx, py + s*0.34, s*0.17, 0, Math.PI*2); ctx.fill();
      // Horns
      ctx.fillStyle = '#4a463e';
      ctx.beginPath(); ctx.moveTo(px + s*0.40, py + s*0.24); ctx.lineTo(px + s*0.34, py + s*0.10); ctx.lineTo(px + s*0.46, py + s*0.22); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px + s*0.60, py + s*0.24); ctx.lineTo(px + s*0.66, py + s*0.10); ctx.lineTo(px + s*0.54, py + s*0.22); ctx.closePath(); ctx.fill();
      // Glowing eyes + snarl
      ctx.fillStyle = `rgba(255,210,120,${0.6+flap*0.3})`;
      ctx.fillRect(px + s*0.42, py + s*0.32, s*0.06, s*0.04); ctx.fillRect(px + s*0.54, py + s*0.32, s*0.06, s*0.04);
      ctx.fillStyle = '#2a2620'; ctx.fillRect(px + s*0.44, py + s*0.42, s*0.12, s*0.03);
      // Crack
      ctx.strokeStyle = '#4a463e'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(px + s*0.40, py + s*0.52); ctx.lineTo(px + s*0.48, py + s*0.70); ctx.stroke();
      break;
    }
    case 'ankheg': {
      // Segmented body (arched)
      const segs = [[0.20,0.62],[0.34,0.54],[0.48,0.50],[0.62,0.54],[0.76,0.62]];
      ctx.fillStyle = '#5e5226';
      segs.forEach(([fx,fy]) => { ctx.beginPath(); ctx.ellipse(px + s*fx, py + s*fy, s*0.12, s*0.10, 0, 0, Math.PI*2); ctx.fill(); });
      ctx.fillStyle = '#7a6c34';
      segs.forEach(([fx,fy]) => { ctx.beginPath(); ctx.ellipse(px + s*fx, py + s*(fy-0.02), s*0.07, s*0.05, 0, 0, Math.PI*2); ctx.fill(); });
      // Legs
      ctx.strokeStyle = '#3e3618'; ctx.lineWidth = Math.max(1.5, s*0.04); ctx.lineCap = 'round';
      [0.30,0.48,0.66].forEach(fx => { ctx.beginPath(); ctx.moveTo(px + s*fx, py + s*0.62); ctx.lineTo(px + s*(fx-0.06), py + s*0.84); ctx.moveTo(px + s*fx, py + s*0.62); ctx.lineTo(px + s*(fx+0.06), py + s*0.84); ctx.stroke(); });
      // Head
      ctx.fillStyle = '#7a6c34';
      ctx.beginPath(); ctx.arc(px + s*0.18, py + s*0.46, s*0.14, 0, Math.PI*2); ctx.fill();
      // Mandibles
      ctx.strokeStyle = '#3e3618'; ctx.lineWidth = Math.max(2, s*0.05);
      ctx.beginPath(); ctx.moveTo(px + s*0.10, py + s*0.42); ctx.lineTo(px + s*0.0, py + s*0.38); ctx.moveTo(px + s*0.10, py + s*0.52); ctx.lineTo(px + s*0.0, py + s*0.56); ctx.stroke();
      // Acid drip
      ctx.fillStyle = `rgba(150,220,80,${0.6+flap*0.4})`;
      ctx.beginPath(); ctx.arc(px + s*0.02, py + s*0.48, s*0.04, 0, Math.PI*2); ctx.fill();
      // Eyes
      ctx.fillStyle = '#1a1606'; ctx.fillRect(px + s*0.16, py + s*0.42, s*0.03, s*0.03); ctx.fillRect(px + s*0.22, py + s*0.42, s*0.03, s*0.03);
      break;
    }
    case 'bulette': {
      // Armored body
      ctx.fillStyle = '#4e463e';
      ctx.beginPath(); ctx.ellipse(cx, py + s*0.62, s*0.38, s*0.24, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#635a50';
      ctx.beginPath(); ctx.ellipse(cx - s*0.04, py + s*0.56, s*0.28, s*0.16, 0, 0, Math.PI*2); ctx.fill();
      // Plate segments
      ctx.strokeStyle = '#2e2820'; ctx.lineWidth = 1.5;
      [0.36,0.50,0.64].forEach(fx => { ctx.beginPath(); ctx.moveTo(px + s*fx, py + s*0.42); ctx.lineTo(px + s*fx, py + s*0.80); ctx.stroke(); });
      // Dorsal fin (signature)
      ctx.fillStyle = '#3a342c';
      ctx.beginPath(); ctx.moveTo(cx - s*0.10, py + s*0.40); ctx.lineTo(cx, py + s*0.10); ctx.lineTo(cx + s*0.14, py + s*0.42); ctx.closePath(); ctx.fill();
      // Head + jaws (right)
      ctx.fillStyle = '#635a50';
      ctx.beginPath(); ctx.arc(px + s*0.80, py + s*0.58, s*0.16, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#1a160e'; ctx.fillRect(px + s*0.80, py + s*0.62, s*0.16, s*0.06);
      ctx.fillStyle = '#e8e0c8';
      for (let i=0;i<4;i++) ctx.fillRect(px + s*0.81 + i*s*0.04, py + s*0.62, s*0.02, s*0.05);
      // Eye + stubby legs
      ctx.fillStyle = '#ffcc33'; ctx.fillRect(px + s*0.82, py + s*0.52, s*0.04, s*0.03);
      ctx.fillStyle = '#3a342c';
      [0.28,0.50].forEach(fx => ctx.fillRect(px + s*fx, py + s*0.80, s*0.10, s*0.12));
      break;
    }
    case 'earth_elemental': {
      // Rocky mass
      ctx.fillStyle = '#6a5d40';
      ctx.beginPath();
      ctx.moveTo(px + s*0.16, py + s*0.90); ctx.lineTo(px + s*0.10, py + s*0.46); ctx.lineTo(px + s*0.30, py + s*0.24);
      ctx.lineTo(px + s*0.54, py + s*0.16); ctx.lineTo(px + s*0.74, py + s*0.26); ctx.lineTo(px + s*0.92, py + s*0.48); ctx.lineTo(px + s*0.86, py + s*0.90);
      ctx.closePath(); ctx.fill();
      // Lighter facet
      ctx.fillStyle = '#84764e';
      ctx.beginPath(); ctx.moveTo(px + s*0.30, py + s*0.26); ctx.lineTo(px + s*0.52, py + s*0.18); ctx.lineTo(px + s*0.46, py + s*0.46); ctx.lineTo(px + s*0.26, py + s*0.50); ctx.closePath(); ctx.fill();
      // Cracks + moss
      ctx.strokeStyle = '#3e3622'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(px + s*0.40, py + s*0.20); ctx.lineTo(px + s*0.44, py + s*0.88); ctx.moveTo(px + s*0.62, py + s*0.30); ctx.lineTo(px + s*0.66, py + s*0.86); ctx.stroke();
      ctx.fillStyle = '#5a7a30';
      ctx.fillRect(px + s*0.20, py + s*0.44, s*0.10, s*0.04);
      ctx.fillRect(px + s*0.66, py + s*0.40, s*0.10, s*0.04);
      // Glowing gem eyes
      ctx.fillStyle = `rgba(255,200,90,${0.6+flap*0.3})`;
      ctx.fillRect(px + s*0.40, py + s*0.44, s*0.07, s*0.05);
      ctx.fillRect(px + s*0.54, py + s*0.44, s*0.07, s*0.05);
      break;
    }
    case 'stone_giant': {
      // Legs
      ctx.fillStyle = '#75706a'; ctx.fillRect(px + s*0.30, py + s*0.66, s*0.16, s*0.26); ctx.fillRect(px + s*0.54, py + s*0.66, s*0.16, s*0.26);
      // Torso
      ctx.fillStyle = '#857f76'; ctx.fillRect(px + s*0.26, py + s*0.30, s*0.48, s*0.42);
      ctx.fillStyle = '#9a948a'; ctx.fillRect(px + s*0.26, py + s*0.30, s*0.24, s*0.42);
      // Head
      ctx.fillStyle = '#9a948a';
      ctx.beginPath(); ctx.arc(cx, py + s*0.20, s*0.16, 0, Math.PI*2); ctx.fill();
      // Heavy brow + deep eyes
      ctx.fillStyle = '#5e594f'; ctx.fillRect(px + s*0.40, py + s*0.16, s*0.20, s*0.04);
      ctx.fillStyle = '#1a1812'; ctx.fillRect(px + s*0.42, py + s*0.18, s*0.05, s*0.04); ctx.fillRect(px + s*0.53, py + s*0.18, s*0.05, s*0.04);
      // Cracks
      ctx.strokeStyle = '#5e594f'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(px + s*0.34, py + s*0.36); ctx.lineTo(px + s*0.40, py + s*0.66); ctx.moveTo(px + s*0.60, py + s*0.34); ctx.lineTo(px + s*0.56, py + s*0.64); ctx.stroke();
      // Boulder in hand
      ctx.fillStyle = '#6a655c';
      ctx.beginPath(); ctx.arc(px + s*0.86, py + s*0.42, s*0.14, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#807a70';
      ctx.beginPath(); ctx.arc(px + s*0.82, py + s*0.38, s*0.07, 0, Math.PI*2); ctx.fill();
      break;
    }
    case 'harpy': {
      const hwf = Math.sin(Date.now()/110 + phase)*0.3 + 1;
      // Feathered wings
      ctx.fillStyle = '#7a6030';
      ctx.beginPath(); ctx.moveTo(cx - s*0.06, py + s*0.42); ctx.lineTo(px + s*0.0, py + s*0.20/hwf); ctx.lineTo(px + s*0.16, py + s*0.30); ctx.lineTo(px + s*0.14, py + s*0.56); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + s*0.06, py + s*0.42); ctx.lineTo(px + s*1.0, py + s*0.20/hwf); ctx.lineTo(px + s*0.84, py + s*0.30); ctx.lineTo(px + s*0.86, py + s*0.56); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#9a7c40';
      ctx.beginPath(); ctx.moveTo(cx - s*0.04, py + s*0.42); ctx.lineTo(px + s*0.10, py + s*0.26/hwf); ctx.lineTo(px + s*0.18, py + s*0.40); ctx.closePath(); ctx.fill();
      // Torso
      ctx.fillStyle = '#caa86a';
      ctx.beginPath(); ctx.ellipse(cx, py + s*0.56, s*0.16, s*0.22, 0, 0, Math.PI*2); ctx.fill();
      // Head + wild hair
      ctx.fillStyle = '#caa86a';
      ctx.beginPath(); ctx.arc(cx, py + s*0.30, s*0.13, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#5a4420';
      for (let i=0;i<5;i++){ ctx.beginPath(); ctx.moveTo(cx - s*0.12 + i*s*0.06, py + s*0.22); ctx.lineTo(cx - s*0.16 + i*s*0.06, py + s*0.06); ctx.lineTo(cx - s*0.08 + i*s*0.06, py + s*0.20); ctx.closePath(); ctx.fill(); }
      // Eyes
      ctx.fillStyle = '#fff'; ctx.fillRect(cx - s*0.07, py + s*0.28, s*0.04, s*0.04); ctx.fillRect(cx + s*0.03, py + s*0.28, s*0.04, s*0.04);
      ctx.fillStyle = '#000'; ctx.fillRect(cx - s*0.06, py + s*0.29, s*0.02, s*0.02); ctx.fillRect(cx + s*0.04, py + s*0.29, s*0.02, s*0.02);
      // Talons
      ctx.strokeStyle = '#3a2c14'; ctx.lineWidth = Math.max(2, s*0.04); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx - s*0.06, py + s*0.78); ctx.lineTo(cx - s*0.10, py + s*0.90); ctx.moveTo(cx + s*0.06, py + s*0.78); ctx.lineTo(cx + s*0.10, py + s*0.90); ctx.stroke();
      break;
    }
    case 'griffon': {
      const grf = Math.sin(Date.now()/120 + phase)*0.2 + 1;
      // Wing
      ctx.fillStyle = '#9a7c40';
      ctx.beginPath(); ctx.moveTo(cx, py + s*0.42); ctx.lineTo(px + s*0.12, py + s*0.16/grf); ctx.lineTo(px + s*0.34, py + s*0.30); ctx.lineTo(px + s*0.30, py + s*0.54); ctx.closePath(); ctx.fill();
      // Lion hindquarters
      ctx.fillStyle = '#b8915a';
      ctx.beginPath(); ctx.ellipse(px + s*0.34, py + s*0.62, s*0.26, s*0.18, 0, 0, Math.PI*2); ctx.fill();
      // Chest
      ctx.fillStyle = '#caa86a';
      ctx.fillRect(px + s*0.56, py + s*0.50, s*0.18, s*0.36);
      // Eagle head (right)
      ctx.fillStyle = '#e8e2d0';
      ctx.beginPath(); ctx.arc(px + s*0.72, py + s*0.34, s*0.16, 0, Math.PI*2); ctx.fill();
      // Beak
      ctx.fillStyle = '#ffc23a';
      ctx.beginPath(); ctx.moveTo(px + s*0.84, py + s*0.32); ctx.lineTo(px + s*0.98, py + s*0.38); ctx.lineTo(px + s*0.84, py + s*0.42); ctx.closePath(); ctx.fill();
      // Eye
      ctx.fillStyle = '#ffcc33'; ctx.beginPath(); ctx.arc(px + s*0.73, py + s*0.32, s*0.05, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(px + s*0.74, py + s*0.32, s*0.025, 0, Math.PI*2); ctx.fill();
      // Tail + forelegs
      ctx.strokeStyle = '#8a6a38'; ctx.lineWidth = Math.max(2, s*0.05);
      ctx.beginPath(); ctx.moveTo(px + s*0.10, py + s*0.62); ctx.lineTo(px - s*0.02, py + s*0.74); ctx.stroke();
      ctx.fillStyle = '#9a7c40';
      ctx.fillRect(px + s*0.40, py + s*0.80, s*0.08, s*0.12); ctx.fillRect(px + s*0.60, py + s*0.80, s*0.08, s*0.12);
      break;
    }
    case 'manticore': {
      const mcf = Math.sin(Date.now()/120 + phase)*0.2 + 1;
      // Bat wings
      ctx.fillStyle = '#6a3a24';
      ctx.beginPath(); ctx.moveTo(cx, py + s*0.40); ctx.lineTo(px + s*0.10, py + s*0.14/mcf); ctx.lineTo(px + s*0.30, py + s*0.26); ctx.lineTo(px + s*0.26, py + s*0.50); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx, py + s*0.40); ctx.lineTo(px + s*0.90, py + s*0.14/mcf); ctx.lineTo(px + s*0.70, py + s*0.26); ctx.lineTo(px + s*0.74, py + s*0.50); ctx.closePath(); ctx.fill();
      // Lion body
      ctx.fillStyle = '#9a5a36';
      ctx.beginPath(); ctx.ellipse(cx, py + s*0.62, s*0.30, s*0.20, 0, 0, Math.PI*2); ctx.fill();
      // Mane + face
      ctx.fillStyle = '#7a4426';
      ctx.beginPath(); ctx.arc(cx, py + s*0.40, s*0.20, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#c89a6a';
      ctx.beginPath(); ctx.arc(cx, py + s*0.42, s*0.13, 0, Math.PI*2); ctx.fill();
      // Eyes + teeth
      ctx.fillStyle = '#330000'; ctx.fillRect(cx - s*0.06, py + s*0.40, s*0.04, s*0.04); ctx.fillRect(cx + s*0.02, py + s*0.40, s*0.04, s*0.04);
      ctx.fillStyle = '#fff';
      for (let i=0;i<5;i++) ctx.fillRect(cx - s*0.10 + i*s*0.05, py + s*0.48, s*0.02, s*0.03);
      // Spiked tail (over back)
      ctx.strokeStyle = '#9a5a36'; ctx.lineWidth = Math.max(2, s*0.05);
      ctx.beginPath(); ctx.moveTo(px + s*0.80, py + s*0.62); ctx.quadraticCurveTo(px + s*0.98, py + s*0.40, px + s*0.86, py + s*0.20); ctx.stroke();
      ctx.fillStyle = '#e8e0c8';
      [[0.86,0.20],[0.80,0.26],[0.92,0.26]].forEach(([fx,fy]) => { ctx.beginPath(); ctx.moveTo(px + s*fx, py + s*fy); ctx.lineTo(px + s*(fx+0.02), py + s*(fy-0.10)); ctx.lineTo(px + s*(fx+0.05), py + s*fy); ctx.closePath(); ctx.fill(); });
      break;
    }
    case 'air_elemental': {
      // Swirling vortex rings
      const spin = Date.now()/300 + phase;
      for (let i=0;i<4;i++){
        const r = s*0.36 - i*s*0.06;
        ctx.strokeStyle = `rgba(210,225,240,${0.25 + i*0.12})`;
        ctx.lineWidth = Math.max(2, s*0.06);
        ctx.beginPath();
        ctx.ellipse(cx, py + s*0.30 + i*s*0.14, r, r*0.5, Math.sin(spin+i)*0.4, 0, Math.PI*2);
        ctx.stroke();
      }
      // Wispy core
      ctx.fillStyle = 'rgba(235,242,250,0.5)';
      ctx.beginPath(); ctx.ellipse(cx, py + s*0.46, s*0.16, s*0.26, 0, 0, Math.PI*2); ctx.fill();
      // Eyes
      ctx.fillStyle = `rgba(255,255,255,${0.7+flap*0.3})`;
      ctx.beginPath(); ctx.arc(cx - s*0.08, py + s*0.36, s*0.05, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + s*0.08, py + s*0.36, s*0.05, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#88aacc';
      ctx.beginPath(); ctx.arc(cx - s*0.08, py + s*0.36, s*0.02, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + s*0.08, py + s*0.36, s*0.02, 0, Math.PI*2); ctx.fill();
      break;
    }
    case 'roc': {
      const rwf = Math.sin(Date.now()/100 + phase)*0.28 + 1;
      // Huge wings
      ctx.fillStyle = '#6a4f30';
      ctx.beginPath(); ctx.moveTo(cx - s*0.04, py + s*0.46); ctx.lineTo(px - s*0.06, py + s*0.16/rwf); ctx.lineTo(px + s*0.22, py + s*0.30); ctx.lineTo(px + s*0.30, py + s*0.56); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + s*0.04, py + s*0.46); ctx.lineTo(px + s*1.06, py + s*0.16/rwf); ctx.lineTo(px + s*0.78, py + s*0.30); ctx.lineTo(px + s*0.70, py + s*0.56); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#8a6a40';
      ctx.beginPath(); ctx.moveTo(px - s*0.06, py + s*0.16/rwf); ctx.lineTo(px + s*0.12, py + s*0.22); ctx.lineTo(px + s*0.02, py + s*0.34); ctx.closePath(); ctx.fill();
      // Body
      ctx.fillStyle = '#7a5c38';
      ctx.beginPath(); ctx.ellipse(cx, py + s*0.62, s*0.20, s*0.26, 0, 0, Math.PI*2); ctx.fill();
      // Head
      ctx.fillStyle = '#b8a878';
      ctx.beginPath(); ctx.arc(cx, py + s*0.34, s*0.15, 0, Math.PI*2); ctx.fill();
      // Beak
      ctx.fillStyle = '#ffc23a';
      ctx.beginPath(); ctx.moveTo(cx - s*0.02, py + s*0.40); ctx.lineTo(cx, py + s*0.54); ctx.lineTo(cx + s*0.08, py + s*0.40); ctx.closePath(); ctx.fill();
      // Eyes
      ctx.fillStyle = '#ffcc33'; ctx.beginPath(); ctx.arc(cx - s*0.06, py + s*0.32, s*0.04, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(cx + s*0.06, py + s*0.32, s*0.04, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(cx - s*0.06, py + s*0.32, s*0.02, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(cx + s*0.06, py + s*0.32, s*0.02, 0, Math.PI*2); ctx.fill();
      break;
    }
    case 'will_o_wisp': {
      // Outer glow
      const wg = ctx.createRadialGradient(cx, cy, 0, cx, cy, s*0.5);
      wg.addColorStop(0, `rgba(200,255,120,${0.6+flap*0.3})`);
      wg.addColorStop(1, 'rgba(180,255,80,0)');
      ctx.fillStyle = wg; ctx.fillRect(sx - ts*0.1, sy - ts*0.1, ts*1.2, ts*1.2);
      // Electric tendrils
      ctx.strokeStyle = `rgba(230,255,160,${0.5+flap*0.5})`; ctx.lineWidth = Math.max(1.5, s*0.03);
      for (let i=0;i<4;i++){ const a = Date.now()/200 + i*Math.PI/2 + phase; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a)*s*0.34, cy + Math.sin(a)*s*0.34 + Math.sin(Date.now()/90+i)*s*0.04); ctx.stroke(); }
      // Core
      ctx.fillStyle = '#eaffc0';
      ctx.beginPath(); ctx.arc(cx, cy, s*0.16, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(cx - s*0.03, cy - s*0.03, s*0.07, 0, Math.PI*2); ctx.fill();
      break;
    }
    case 'blue_wyrmling': {
      const bwf = Math.sin(Date.now()/120 + phase)*0.2 + 1;
      // Wings
      ctx.fillStyle = '#2f6aaa';
      ctx.beginPath(); ctx.moveTo(px + s*0.10, py + s*0.40/bwf); ctx.lineTo(px + s*0.48, py + s*0.38); ctx.lineTo(px + s*0.30, py + s*0.58); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px + s*0.90, py + s*0.40/bwf); ctx.lineTo(px + s*0.52, py + s*0.38); ctx.lineTo(px + s*0.70, py + s*0.58); ctx.closePath(); ctx.fill();
      // Body
      ctx.fillStyle = '#3a82cc';
      ctx.beginPath(); ctx.ellipse(cx, py + s*0.56, s*0.20, s*0.26, 0, 0, Math.PI*2); ctx.fill();
      // Head
      ctx.fillStyle = '#4a92dd';
      ctx.beginPath(); ctx.arc(cx, py + s*0.30, s*0.16, 0, Math.PI*2); ctx.fill();
      // Nose horn (blue dragon signature)
      ctx.fillStyle = '#dfeeff';
      ctx.beginPath(); ctx.moveTo(cx, py + s*0.18); ctx.lineTo(cx - s*0.03, py + s*0.04); ctx.lineTo(cx + s*0.04, py + s*0.18); ctx.closePath(); ctx.fill();
      // Spark breath
      ctx.strokeStyle = `rgba(255,240,120,${0.6+flap*0.4})`; ctx.lineWidth = Math.max(1.5, s*0.03);
      ctx.beginPath(); ctx.moveTo(cx, py + s*0.42); ctx.lineTo(cx + s*0.06, py + s*0.50); ctx.lineTo(cx - s*0.02, py + s*0.54); ctx.lineTo(cx + s*0.04, py + s*0.62); ctx.stroke();
      // Eye
      ctx.fillStyle = '#ffee44'; ctx.fillRect(cx - s*0.08, py + s*0.26, s*0.05, s*0.04);
      ctx.fillStyle = '#000'; ctx.fillRect(cx - s*0.065, py + s*0.27, s*0.02, s*0.03);
      break;
    }
    case 'behir': {
      // Long sinuous body
      ctx.strokeStyle = '#23598f'; ctx.lineWidth = Math.max(5, s*0.18); ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(px + s*0.10, py + s*0.84);
      ctx.quadraticCurveTo(px + s*0.40, py + s*0.86, px + s*0.50, py + s*0.60);
      ctx.quadraticCurveTo(px + s*0.60, py + s*0.34, cx + s*0.06, py + s*0.24);
      ctx.stroke();
      ctx.strokeStyle = '#3a78b8'; ctx.lineWidth = Math.max(2, s*0.08);
      ctx.beginPath();
      ctx.moveTo(px + s*0.12, py + s*0.82);
      ctx.quadraticCurveTo(px + s*0.40, py + s*0.84, px + s*0.50, py + s*0.60);
      ctx.stroke();
      // Many little legs
      ctx.strokeStyle = '#1a4570'; ctx.lineWidth = Math.max(1.5, s*0.04);
      [[0.20,0.84],[0.34,0.84],[0.48,0.66],[0.55,0.46]].forEach(([fx,fy]) => { ctx.beginPath(); ctx.moveTo(px + s*fx, py + s*fy); ctx.lineTo(px + s*(fx-0.04), py + s*(fy+0.12)); ctx.stroke(); });
      // Head
      ctx.fillStyle = '#3a78b8';
      ctx.beginPath(); ctx.arc(cx + s*0.06, py + s*0.22, s*0.15, 0, Math.PI*2); ctx.fill();
      // Crackle
      ctx.strokeStyle = `rgba(255,240,120,${0.5+flap*0.5})`; ctx.lineWidth = Math.max(1.5, s*0.03);
      ctx.beginPath(); ctx.moveTo(cx + s*0.12, py + s*0.14); ctx.lineTo(cx + s*0.20, py + s*0.20); ctx.lineTo(cx + s*0.14, py + s*0.24); ctx.stroke();
      // Eye
      ctx.fillStyle = '#ffee44'; ctx.fillRect(cx + s*0.02, py + s*0.18, s*0.05, s*0.04);
      ctx.fillStyle = '#000'; ctx.fillRect(cx + s*0.035, py + s*0.19, s*0.02, s*0.03);
      break;
    }
    case 'young_blue_dragon': {
      const dbf = Math.sin(Date.now()/120 + phase)*0.2 + 1;
      // Wings
      ctx.fillStyle = '#2a5e9a';
      ctx.beginPath(); ctx.moveTo(px + s*0.04, py + s*0.36/dbf); ctx.lineTo(px + s*0.48, py + s*0.34); ctx.lineTo(px + s*0.28, py + s*0.62); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px + s*0.96, py + s*0.36/dbf); ctx.lineTo(px + s*0.52, py + s*0.34); ctx.lineTo(px + s*0.72, py + s*0.62); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#3a78b8';
      ctx.beginPath(); ctx.moveTo(px + s*0.10, py + s*0.38/dbf); ctx.lineTo(px + s*0.46, py + s*0.36); ctx.lineTo(px + s*0.30, py + s*0.56); ctx.closePath(); ctx.fill();
      // Body
      ctx.fillStyle = '#3a7ec0';
      ctx.beginPath(); ctx.ellipse(cx, py + s*0.54, s*0.22, s*0.30, 0, 0, Math.PI*2); ctx.fill();
      // Head
      ctx.fillStyle = '#4a8ed0';
      ctx.beginPath(); ctx.arc(cx, py + s*0.26, s*0.17, 0, Math.PI*2); ctx.fill();
      // Big nose horn
      ctx.fillStyle = '#dfeeff';
      ctx.beginPath(); ctx.moveTo(cx, py + s*0.12); ctx.lineTo(cx - s*0.04, py - s*0.02); ctx.lineTo(cx + s*0.05, py + s*0.12); ctx.closePath(); ctx.fill();
      // Lightning breath
      ctx.strokeStyle = `rgba(255,245,140,${0.6+flap*0.4})`; ctx.lineWidth = Math.max(2, s*0.04);
      ctx.beginPath(); ctx.moveTo(cx, py + s*0.40); ctx.lineTo(cx + s*0.08, py + s*0.50); ctx.lineTo(cx - s*0.02, py + s*0.56); ctx.lineTo(cx + s*0.06, py + s*0.66); ctx.stroke();
      // Eye
      ctx.fillStyle = '#ffee44'; ctx.fillRect(px + s*0.46, py + s*0.24, s*0.07, s*0.05);
      ctx.fillStyle = '#000'; ctx.fillRect(px + s*0.49, py + s*0.25, s*0.02, s*0.03);
      // Tail
      ctx.strokeStyle = '#3a7ec0'; ctx.lineWidth = Math.max(2, s*0.06);
      ctx.beginPath(); ctx.moveTo(cx, py + s*0.80); ctx.lineTo(cx + Math.sin(Date.now()/180+phase)*s*0.20, py + s); ctx.stroke();
      break;
    }
    case 'storm_giant': {
      // Static aura
      const sgaa = ctx.createRadialGradient(cx, cy, 0, cx, cy, s*0.55);
      sgaa.addColorStop(0, `rgba(150,180,255,${0.2+flap*0.2})`);
      sgaa.addColorStop(1, 'rgba(150,180,255,0)');
      ctx.fillStyle = sgaa; ctx.fillRect(sx - ts*0.1, sy - ts*0.1, ts*1.2, ts*1.2);
      // Legs
      ctx.fillStyle = '#6f86b8'; ctx.fillRect(px + s*0.30, py + s*0.66, s*0.16, s*0.26); ctx.fillRect(px + s*0.54, py + s*0.66, s*0.16, s*0.26);
      // Torso
      ctx.fillStyle = '#8298c8'; ctx.fillRect(px + s*0.26, py + s*0.30, s*0.48, s*0.42);
      ctx.fillStyle = '#9aaed8'; ctx.fillRect(px + s*0.26, py + s*0.30, s*0.24, s*0.42);
      // Head
      ctx.fillStyle = '#9aaed8';
      ctx.beginPath(); ctx.arc(cx, py + s*0.20, s*0.16, 0, Math.PI*2); ctx.fill();
      // Hair / beard
      ctx.fillStyle = '#dfe6f4'; ctx.fillRect(px + s*0.40, py + s*0.22, s*0.20, s*0.14);
      // Glowing eyes
      ctx.fillStyle = `rgba(220,240,255,${0.7+flap*0.3})`; ctx.fillRect(px + s*0.42, py + s*0.18, s*0.05, s*0.04); ctx.fillRect(px + s*0.53, py + s*0.18, s*0.05, s*0.04);
      // Lightning bolt in hand
      ctx.strokeStyle = `rgba(255,245,140,${0.6+flap*0.4})`; ctx.lineWidth = Math.max(2, s*0.04);
      ctx.beginPath(); ctx.moveTo(px + s*0.82, py + s*0.16); ctx.lineTo(px + s*0.90, py + s*0.34); ctx.lineTo(px + s*0.80, py + s*0.42); ctx.lineTo(px + s*0.90, py + s*0.62); ctx.stroke();
      break;
    }
    case 'pegasus': {
      const pwf = Math.sin(Date.now()/120 + phase)*0.2 + 1;
      // Wing
      ctx.fillStyle = '#e8eef8';
      ctx.beginPath(); ctx.moveTo(cx, py + s*0.46); ctx.lineTo(px + s*0.12, py + s*0.18/pwf); ctx.lineTo(px + s*0.36, py + s*0.32); ctx.lineTo(px + s*0.34, py + s*0.56); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.moveTo(cx - s*0.02, py + s*0.46); ctx.lineTo(px + s*0.18, py + s*0.26/pwf); ctx.lineTo(px + s*0.30, py + s*0.42); ctx.closePath(); ctx.fill();
      // Body
      ctx.fillStyle = '#f4f6fb';
      ctx.beginPath(); ctx.ellipse(px + s*0.42, py + s*0.62, s*0.28, s*0.16, 0, 0, Math.PI*2); ctx.fill();
      // Neck + head (right)
      ctx.fillStyle = '#f4f6fb';
      ctx.beginPath(); ctx.moveTo(px + s*0.60, py + s*0.56); ctx.lineTo(px + s*0.74, py + s*0.30); ctx.lineTo(px + s*0.84, py + s*0.34); ctx.lineTo(px + s*0.72, py + s*0.60); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(px + s*0.80, py + s*0.30, s*0.10, 0, Math.PI*2); ctx.fill();
      // Mane
      ctx.fillStyle = '#ffe89a';
      ctx.beginPath(); ctx.moveTo(px + s*0.70, py + s*0.30); ctx.lineTo(px + s*0.62, py + s*0.52); ctx.lineTo(px + s*0.70, py + s*0.52); ctx.closePath(); ctx.fill();
      // Eye + legs
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(px + s*0.83, py + s*0.28, s*0.02, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#e0e4ee';
      [0.30,0.42,0.54].forEach(fx => ctx.fillRect(px + s*fx, py + s*0.76, s*0.06, s*0.16));
      break;
    }
    case 'couatl': {
      const cwf = Math.sin(Date.now()/110 + phase)*0.25 + 1;
      // Feathered wings
      ctx.fillStyle = '#3aa0c0';
      ctx.beginPath(); ctx.moveTo(cx - s*0.04, py + s*0.44); ctx.lineTo(px + s*0.04, py + s*0.18/cwf); ctx.lineTo(px + s*0.24, py + s*0.34); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + s*0.04, py + s*0.44); ctx.lineTo(px + s*0.96, py + s*0.18/cwf); ctx.lineTo(px + s*0.76, py + s*0.34); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#caa840';
      ctx.beginPath(); ctx.moveTo(cx - s*0.02, py + s*0.44); ctx.lineTo(px + s*0.14, py + s*0.28/cwf); ctx.lineTo(px + s*0.26, py + s*0.40); ctx.closePath(); ctx.fill();
      // Coiled body
      ctx.strokeStyle = '#e0b84a'; ctx.lineWidth = Math.max(4, s*0.14); ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(px + s*0.30, py + s*0.88);
      ctx.quadraticCurveTo(px + s*0.74, py + s*0.78, px + s*0.52, py + s*0.56);
      ctx.quadraticCurveTo(px + s*0.34, py + s*0.40, cx, py + s*0.34);
      ctx.stroke();
      // Head
      ctx.fillStyle = '#f0cc5a';
      ctx.beginPath(); ctx.arc(cx, py + s*0.30, s*0.14, 0, Math.PI*2); ctx.fill();
      // Eyes (glowing)
      ctx.fillStyle = `rgba(255,250,200,${0.7+flap*0.3})`;
      ctx.fillRect(cx - s*0.07, py + s*0.28, s*0.04, s*0.04); ctx.fillRect(cx + s*0.03, py + s*0.28, s*0.04, s*0.04);
      // Halo arc
      ctx.strokeStyle = `rgba(255,240,160,${0.4+flap*0.3})`; ctx.lineWidth = Math.max(1.5, s*0.03);
      ctx.beginPath(); ctx.arc(cx, py + s*0.22, s*0.18, Math.PI*1.1, Math.PI*1.9); ctx.stroke();
      break;
    }
    case 'unicorn': {
      // Body
      ctx.fillStyle = '#f6f4fa';
      ctx.beginPath(); ctx.ellipse(px + s*0.42, py + s*0.62, s*0.28, s*0.16, 0, 0, Math.PI*2); ctx.fill();
      // Neck + head (right)
      ctx.fillStyle = '#f6f4fa';
      ctx.beginPath(); ctx.moveTo(px + s*0.60, py + s*0.56); ctx.lineTo(px + s*0.74, py + s*0.28); ctx.lineTo(px + s*0.86, py + s*0.32); ctx.lineTo(px + s*0.74, py + s*0.60); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(px + s*0.82, py + s*0.28, s*0.11, 0, Math.PI*2); ctx.fill();
      // Spiral horn (glowing)
      ctx.strokeStyle = `rgba(255,240,170,${0.7+flap*0.3})`; ctx.lineWidth = Math.max(2, s*0.05);
      ctx.beginPath(); ctx.moveTo(px + s*0.86, py + s*0.20); ctx.lineTo(px + s*0.98, py + s*0.02); ctx.stroke();
      ctx.fillStyle = '#fff4c0';
      ctx.beginPath(); ctx.arc(px + s*0.98, py + s*0.02, s*0.03, 0, Math.PI*2); ctx.fill();
      // Mane
      ctx.fillStyle = '#ffd0e0';
      ctx.beginPath(); ctx.moveTo(px + s*0.70, py + s*0.28); ctx.lineTo(px + s*0.60, py + s*0.54); ctx.lineTo(px + s*0.70, py + s*0.54); ctx.closePath(); ctx.fill();
      // Eye + legs
      ctx.fillStyle = '#5a3aaa'; ctx.beginPath(); ctx.arc(px + s*0.84, py + s*0.26, s*0.025, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#e6e2ee';
      [0.30,0.42,0.54].forEach(fx => ctx.fillRect(px + s*fx, py + s*0.76, s*0.06, s*0.16));
      break;
    }
    case 'ki_rin': {
      // Glow
      const kga = ctx.createRadialGradient(cx, cy, 0, cx, cy, s*0.5);
      kga.addColorStop(0, `rgba(255,230,140,${0.25+flap*0.2})`);
      kga.addColorStop(1, 'rgba(255,230,140,0)');
      ctx.fillStyle = kga; ctx.fillRect(sx - ts*0.1, sy - ts*0.1, ts*1.2, ts*1.2);
      // Sinuous body
      ctx.strokeStyle = '#e8c24a'; ctx.lineWidth = Math.max(4, s*0.15); ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(px + s*0.14, py + s*0.86);
      ctx.quadraticCurveTo(px + s*0.46, py + s*0.74, px + s*0.46, py + s*0.52);
      ctx.quadraticCurveTo(px + s*0.46, py + s*0.34, px + s*0.66, py + s*0.28);
      ctx.stroke();
      // Flame-mane
      ctx.fillStyle = '#ffae3a';
      [[0.40,0.40],[0.36,0.52],[0.40,0.64]].forEach(([fx,fy]) => { ctx.beginPath(); ctx.moveTo(px + s*fx, py + s*fy); ctx.lineTo(px + s*(fx-0.12), py + s*(fy-0.04)); ctx.lineTo(px + s*fx, py + s*(fy+0.08)); ctx.closePath(); ctx.fill(); });
      // Head
      ctx.fillStyle = '#f4cc5a';
      ctx.beginPath(); ctx.arc(px + s*0.70, py + s*0.26, s*0.14, 0, Math.PI*2); ctx.fill();
      // Antlers
      ctx.strokeStyle = '#caa030'; ctx.lineWidth = Math.max(2, s*0.04);
      ctx.beginPath(); ctx.moveTo(px + s*0.66, py + s*0.16); ctx.lineTo(px + s*0.60, py + s*0.04); ctx.moveTo(px + s*0.74, py + s*0.16); ctx.lineTo(px + s*0.80, py + s*0.04); ctx.stroke();
      // Eye
      ctx.fillStyle = 'rgba(255,255,220,0.9)'; ctx.fillRect(px + s*0.72, py + s*0.24, s*0.05, s*0.04);
      ctx.fillStyle = '#000'; ctx.fillRect(px + s*0.735, py + s*0.25, s*0.02, s*0.03);
      break;
    }
    case 'deva': {
      const dvf = Math.sin(Date.now()/130 + phase)*0.15 + 1;
      // Feathered wings
      ctx.fillStyle = '#f2f4fa';
      ctx.beginPath(); ctx.moveTo(cx - s*0.06, py + s*0.40); ctx.lineTo(px + s*0.02, py + s*0.14/dvf); ctx.lineTo(px + s*0.10, py + s*0.26); ctx.lineTo(px + s*0.16, py + s*0.40); ctx.lineTo(px + s*0.10, py + s*0.56); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + s*0.06, py + s*0.40); ctx.lineTo(px + s*0.98, py + s*0.14/dvf); ctx.lineTo(px + s*0.90, py + s*0.26); ctx.lineTo(px + s*0.84, py + s*0.40); ctx.lineTo(px + s*0.90, py + s*0.56); ctx.closePath(); ctx.fill();
      // Robe
      ctx.fillStyle = '#e6ecf6';
      ctx.beginPath(); ctx.moveTo(px + s*0.34, py + s*0.40); ctx.lineTo(px + s*0.66, py + s*0.40); ctx.lineTo(px + s*0.74, py + s*0.90); ctx.lineTo(px + s*0.26, py + s*0.90); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffd86a'; ctx.fillRect(px + s*0.34, py + s*0.56, s*0.32, s*0.05);
      // Head
      ctx.fillStyle = '#f0d8c0';
      ctx.beginPath(); ctx.arc(cx, py + s*0.30, s*0.14, 0, Math.PI*2); ctx.fill();
      // Halo
      ctx.strokeStyle = `rgba(255,240,150,${0.6+flap*0.4})`; ctx.lineWidth = Math.max(2, s*0.04);
      ctx.beginPath(); ctx.arc(cx, py + s*0.14, s*0.12, 0, Math.PI*2); ctx.stroke();
      // Serene eyes
      ctx.fillStyle = 'rgba(180,210,255,0.9)';
      ctx.fillRect(cx - s*0.07, py + s*0.28, s*0.04, s*0.03); ctx.fillRect(cx + s*0.03, py + s*0.28, s*0.04, s*0.03);
      break;
    }
    case 'planetar': {
      const plf = Math.sin(Date.now()/130 + phase)*0.15 + 1;
      // Radiance
      const pla = ctx.createRadialGradient(cx, cy, 0, cx, cy, s*0.55);
      pla.addColorStop(0, `rgba(255,250,210,${0.25+flap*0.2})`);
      pla.addColorStop(1, 'rgba(255,250,210,0)');
      ctx.fillStyle = pla; ctx.fillRect(sx - ts*0.1, sy - ts*0.1, ts*1.2, ts*1.2);
      // Wings
      ctx.fillStyle = '#fbfcff';
      ctx.beginPath(); ctx.moveTo(cx - s*0.06, py + s*0.38); ctx.lineTo(px - s*0.02, py + s*0.10/plf); ctx.lineTo(px + s*0.12, py + s*0.24); ctx.lineTo(px + s*0.16, py + s*0.40); ctx.lineTo(px + s*0.08, py + s*0.58); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + s*0.06, py + s*0.38); ctx.lineTo(px + s*1.02, py + s*0.10/plf); ctx.lineTo(px + s*0.88, py + s*0.24); ctx.lineTo(px + s*0.84, py + s*0.40); ctx.lineTo(px + s*0.92, py + s*0.58); ctx.closePath(); ctx.fill();
      // Robe
      ctx.fillStyle = '#dfe8f2';
      ctx.beginPath(); ctx.moveTo(px + s*0.34, py + s*0.40); ctx.lineTo(px + s*0.66, py + s*0.40); ctx.lineTo(px + s*0.72, py + s*0.90); ctx.lineTo(px + s*0.28, py + s*0.90); ctx.closePath(); ctx.fill();
      // Head (green-skinned angel)
      ctx.fillStyle = '#a8d0a0';
      ctx.beginPath(); ctx.arc(cx, py + s*0.28, s*0.14, 0, Math.PI*2); ctx.fill();
      // Halo
      ctx.strokeStyle = `rgba(255,245,170,${0.7+flap*0.3})`; ctx.lineWidth = Math.max(2, s*0.05);
      ctx.beginPath(); ctx.arc(cx, py + s*0.12, s*0.13, 0, Math.PI*2); ctx.stroke();
      // Glowing eyes
      ctx.fillStyle = '#ffffff'; ctx.fillRect(cx - s*0.07, py + s*0.26, s*0.04, s*0.03); ctx.fillRect(cx + s*0.03, py + s*0.26, s*0.04, s*0.03);
      // Radiant greatsword
      ctx.fillStyle = `rgba(255,250,200,${0.7+flap*0.3})`;
      ctx.fillRect(px + s*0.74, py + s*0.36, s*0.05, s*0.52);
      ctx.fillStyle = '#ffd86a'; ctx.fillRect(px + s*0.70, py + s*0.36, s*0.13, s*0.04);
      break;
    }
    case 'ghost': {
      // Translucent body with wavy tail
      ctx.fillStyle = `rgba(200,220,230,${0.4+flap*0.15})`;
      ctx.beginPath();
      ctx.moveTo(px + s*0.26, py + s*0.34);
      ctx.bezierCurveTo(px + s*0.20, py + s*0.10, px + s*0.80, py + s*0.10, px + s*0.74, py + s*0.34);
      ctx.lineTo(px + s*0.74, py + s*0.74);
      for (let i=4;i>=0;i--){ const fx = px + s*0.30 + s*0.40*(i/4); const fy = py + s*0.86 + Math.sin(Date.now()/200 + phase + i)*s*0.05; ctx.lineTo(fx, fy); }
      ctx.lineTo(px + s*0.26, py + s*0.74);
      ctx.closePath(); ctx.fill();
      // Inner glow
      ctx.fillStyle = 'rgba(230,245,250,0.3)';
      ctx.beginPath(); ctx.ellipse(cx - s*0.04, py + s*0.34, s*0.12, s*0.16, 0, 0, Math.PI*2); ctx.fill();
      // Hollow eyes + mouth
      ctx.fillStyle = `rgba(80,140,170,${0.7+flap*0.3})`;
      ctx.beginPath(); ctx.ellipse(px + s*0.42, py + s*0.30, s*0.05, s*0.07, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(px + s*0.58, py + s*0.30, s*0.05, s*0.07, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx, py + s*0.46, s*0.05, s*0.08, 0, 0, Math.PI*2); ctx.fill();
      break;
    }
    case 'carrion_crawler': {
      // Long body
      ctx.fillStyle = '#7a8a2e';
      ctx.beginPath(); ctx.ellipse(cx, py + s*0.62, s*0.20, s*0.30, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#94a43a';
      ctx.beginPath(); ctx.ellipse(cx - s*0.04, py + s*0.60, s*0.12, s*0.24, 0, 0, Math.PI*2); ctx.fill();
      // Segment ridges
      ctx.strokeStyle = '#5a6820'; ctx.lineWidth = 1.5;
      [0.46,0.58,0.70,0.82].forEach(fy => { ctx.beginPath(); ctx.moveTo(px + s*0.32, py + s*fy); ctx.lineTo(px + s*0.68, py + s*fy); ctx.stroke(); });
      // Many legs
      ctx.strokeStyle = '#4a5818'; ctx.lineWidth = Math.max(1.5, s*0.03); ctx.lineCap = 'round';
      [0.50,0.62,0.74,0.86].forEach(fy => { ctx.beginPath(); ctx.moveTo(px + s*0.32, py + s*fy); ctx.lineTo(px + s*0.16, py + s*(fy+0.06)); ctx.moveTo(px + s*0.68, py + s*fy); ctx.lineTo(px + s*0.84, py + s*(fy+0.06)); ctx.stroke(); });
      // Head
      ctx.fillStyle = '#94a43a';
      ctx.beginPath(); ctx.arc(cx, py + s*0.28, s*0.16, 0, Math.PI*2); ctx.fill();
      // Writhing tentacle mouth
      ctx.strokeStyle = '#aa66aa'; ctx.lineWidth = Math.max(1.5, s*0.03); ctx.lineCap = 'round';
      for (let i=0;i<5;i++){ const a = -Math.PI/2 + (i-2)*0.4; const wob = Math.sin(Date.now()/150 + i + phase)*0.2; ctx.beginPath(); ctx.moveTo(cx, py + s*0.36); ctx.lineTo(cx + Math.cos(a+wob)*s*0.16, py + s*0.36 + Math.sin(a+wob)*s*0.16); ctx.stroke(); }
      // Eyes
      ctx.fillStyle = '#1a2206'; ctx.fillRect(cx - s*0.06, py + s*0.24, s*0.03, s*0.03); ctx.fillRect(cx + s*0.03, py + s*0.24, s*0.03, s*0.03);
      break;
    }
    case 'otyugh': {
      // Bloated body
      ctx.fillStyle = '#7a7a3a';
      ctx.beginPath(); ctx.ellipse(cx, py + s*0.62, s*0.34, s*0.26, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#92923f';
      ctx.beginPath(); ctx.ellipse(cx - s*0.04, py + s*0.56, s*0.24, s*0.18, 0, 0, Math.PI*2); ctx.fill();
      // Three stumpy legs
      ctx.fillStyle = '#5a5a28';
      [0.24,0.46,0.68].forEach(fx => ctx.fillRect(px + s*fx, py + s*0.80, s*0.10, s*0.14));
      // Big toothy maw
      ctx.fillStyle = '#2a1a14';
      ctx.beginPath(); ctx.ellipse(cx, py + s*0.62, s*0.20, s*0.09, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#d8d0b0';
      for (let i=0;i<6;i++) ctx.fillRect(cx - s*0.18 + i*s*0.06, py + s*0.56, s*0.025, s*0.05);
      // Tentacle eye-stalks
      ctx.strokeStyle = '#7a7a3a'; ctx.lineWidth = Math.max(2, s*0.05); ctx.lineCap = 'round';
      const ow = Math.sin(Date.now()/200 + phase)*s*0.04;
      ctx.beginPath(); ctx.moveTo(px + s*0.38, py + s*0.40); ctx.lineTo(px + s*0.30 + ow, py + s*0.14); ctx.moveTo(px + s*0.62, py + s*0.40); ctx.lineTo(px + s*0.70 - ow, py + s*0.14); ctx.stroke();
      ctx.fillStyle = '#ffcc33';
      ctx.beginPath(); ctx.arc(px + s*0.30 + ow, py + s*0.12, s*0.05, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + s*0.70 - ow, py + s*0.12, s*0.05, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(px + s*0.30 + ow, py + s*0.12, s*0.02, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + s*0.70 - ow, py + s*0.12, s*0.02, 0, Math.PI*2); ctx.fill();
      break;
    }
    case 'green_dragon': {
      const dgf = Math.sin(Date.now()/120 + phase)*0.2 + 1;
      // Wings
      ctx.fillStyle = '#2a5a2a';
      ctx.beginPath(); ctx.moveTo(px + s*0.04, py + s*0.36/dgf); ctx.lineTo(px + s*0.48, py + s*0.34); ctx.lineTo(px + s*0.28, py + s*0.62); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px + s*0.96, py + s*0.36/dgf); ctx.lineTo(px + s*0.52, py + s*0.34); ctx.lineTo(px + s*0.72, py + s*0.62); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#3a7a3a';
      ctx.beginPath(); ctx.moveTo(px + s*0.10, py + s*0.38/dgf); ctx.lineTo(px + s*0.46, py + s*0.36); ctx.lineTo(px + s*0.30, py + s*0.56); ctx.closePath(); ctx.fill();
      // Body
      ctx.fillStyle = '#3a6e34';
      ctx.beginPath(); ctx.ellipse(cx, py + s*0.54, s*0.22, s*0.30, 0, 0, Math.PI*2); ctx.fill();
      // Head + swept frill
      ctx.fillStyle = '#4a8240';
      ctx.beginPath(); ctx.arc(cx, py + s*0.26, s*0.17, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#2a5a2a';
      ctx.beginPath(); ctx.moveTo(px + s*0.40, py + s*0.20); ctx.lineTo(px + s*0.28, py + s*0.30); ctx.lineTo(px + s*0.42, py + s*0.30); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px + s*0.60, py + s*0.20); ctx.lineTo(px + s*0.72, py + s*0.30); ctx.lineTo(px + s*0.58, py + s*0.30); ctx.closePath(); ctx.fill();
      // Poison breath
      ctx.fillStyle = `rgba(150,220,80,${0.5+flap*0.3})`;
      ctx.beginPath(); ctx.arc(cx, py + s*0.44, s*0.06, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + s*0.04, py + s*0.54, s*0.05, 0, Math.PI*2); ctx.fill();
      // Eye
      ctx.fillStyle = '#ddee44'; ctx.fillRect(px + s*0.46, py + s*0.24, s*0.07, s*0.05);
      ctx.fillStyle = '#000'; ctx.fillRect(px + s*0.49, py + s*0.25, s*0.02, s*0.03);
      // Tail
      ctx.strokeStyle = '#3a6e34'; ctx.lineWidth = Math.max(2, s*0.06);
      ctx.beginPath(); ctx.moveTo(cx, py + s*0.80); ctx.lineTo(cx + Math.sin(Date.now()/180+phase)*s*0.20, py + s); ctx.stroke();
      break;
    }
    case 'purple_worm': {
      // Massive segmented body (arching up)
      ctx.strokeStyle = '#5e2e5e'; ctx.lineWidth = Math.max(6, s*0.26); ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(px + s*0.16, py + s*0.92);
      ctx.quadraticCurveTo(px + s*0.10, py + s*0.50, px + s*0.40, py + s*0.34);
      ctx.quadraticCurveTo(px + s*0.62, py + s*0.22, cx + s*0.04, py + s*0.22);
      ctx.stroke();
      ctx.strokeStyle = '#7a417a'; ctx.lineWidth = Math.max(3, s*0.12);
      ctx.beginPath();
      ctx.moveTo(px + s*0.18, py + s*0.90);
      ctx.quadraticCurveTo(px + s*0.14, py + s*0.52, px + s*0.40, py + s*0.36);
      ctx.stroke();
      // Segment rings
      ctx.strokeStyle = '#3e1e3e'; ctx.lineWidth = Math.max(1.5, s*0.03);
      [[0.16,0.78],[0.13,0.62],[0.24,0.44],[0.42,0.34]].forEach(([fx,fy]) => { ctx.beginPath(); ctx.arc(px + s*fx, py + s*fy, s*0.13, 0.3, 2.8); ctx.stroke(); });
      // Round maw
      ctx.fillStyle = '#3a1a3a';
      ctx.beginPath(); ctx.arc(cx + s*0.10, py + s*0.24, s*0.16, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#1a0a1a';
      ctx.beginPath(); ctx.arc(cx + s*0.10, py + s*0.24, s*0.10, 0, Math.PI*2); ctx.fill();
      // Ring of teeth
      ctx.fillStyle = '#e0d8c0';
      for (let i=0;i<8;i++){ const a = i*Math.PI/4 + Date.now()/600; ctx.beginPath(); ctx.moveTo(cx + s*0.10 + Math.cos(a)*s*0.10, py + s*0.24 + Math.sin(a)*s*0.10); ctx.lineTo(cx + s*0.10 + Math.cos(a)*s*0.15, py + s*0.24 + Math.sin(a)*s*0.15); ctx.lineTo(cx + s*0.10 + Math.cos(a+0.3)*s*0.11, py + s*0.24 + Math.sin(a+0.3)*s*0.11); ctx.closePath(); ctx.fill(); }
      break;
    }
    case 'nothic': {
      // Hunched body
      ctx.fillStyle = '#5a4a6a';
      ctx.beginPath(); ctx.ellipse(cx, py + s*0.64, s*0.26, s*0.24, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#6e5a82';
      ctx.beginPath(); ctx.ellipse(cx - s*0.05, py + s*0.60, s*0.16, s*0.16, 0, 0, Math.PI*2); ctx.fill();
      // Spindly arms + claws
      ctx.strokeStyle = '#4a3a5a'; ctx.lineWidth = Math.max(2, s*0.05); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(px + s*0.30, py + s*0.56); ctx.lineTo(px + s*0.10, py + s*0.78); ctx.moveTo(px + s*0.70, py + s*0.56); ctx.lineTo(px + s*0.90, py + s*0.78); ctx.stroke();
      ctx.strokeStyle = '#c8b8d0'; ctx.lineWidth = Math.max(1.5, s*0.03);
      [[0.08,0.78],[0.12,0.82],[0.88,0.78],[0.92,0.82]].forEach(([fx,fy]) => { ctx.beginPath(); ctx.moveTo(px + s*fx, py + s*(fy-0.06)); ctx.lineTo(px + s*fx, py + s*fy); ctx.stroke(); });
      // Head
      ctx.fillStyle = '#6e5a82';
      ctx.beginPath(); ctx.arc(cx, py + s*0.34, s*0.18, 0, Math.PI*2); ctx.fill();
      // One huge glowing eye
      ctx.fillStyle = `rgba(180,120,220,${0.5+flap*0.3})`;
      ctx.beginPath(); ctx.arc(cx, py + s*0.34, s*0.13, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#e0c0ff';
      ctx.beginPath(); ctx.arc(cx, py + s*0.34, s*0.09, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#2a0a3a';
      ctx.beginPath(); ctx.arc(cx, py + s*0.34, s*0.045, 0, Math.PI*2); ctx.fill();
      // Jagged grin
      ctx.fillStyle = '#1a0a1a'; ctx.fillRect(px + s*0.42, py + s*0.50, s*0.16, s*0.03);
      break;
    }
    case 'helmed_horror': {
      // Shield (left)
      ctx.fillStyle = '#4a5066';
      ctx.beginPath(); ctx.moveTo(px + s*0.06, py + s*0.40); ctx.lineTo(px + s*0.26, py + s*0.40); ctx.lineTo(px + s*0.26, py + s*0.66); ctx.lineTo(px + s*0.16, py + s*0.78); ctx.lineTo(px + s*0.06, py + s*0.66); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#6a7088'; ctx.fillRect(px + s*0.13, py + s*0.46, s*0.06, s*0.20);
      // Cuirass
      ctx.fillStyle = '#586078'; ctx.fillRect(px + s*0.32, py + s*0.40, s*0.36, s*0.40);
      ctx.fillStyle = '#6a7290'; ctx.fillRect(px + s*0.32, py + s*0.40, s*0.18, s*0.40);
      ctx.strokeStyle = '#3a4054'; ctx.lineWidth = 1.5;
      [0.50,0.62,0.72].forEach(fy => { ctx.beginPath(); ctx.moveTo(px + s*0.32, py + s*fy); ctx.lineTo(px + s*0.68, py + s*fy); ctx.stroke(); });
      // Great helm
      ctx.fillStyle = '#6a7290';
      ctx.beginPath(); ctx.arc(cx, py + s*0.26, s*0.16, Math.PI, 0); ctx.fill();
      ctx.fillRect(px + s*0.34, py + s*0.26, s*0.32, s*0.14);
      // Visor glow
      ctx.fillStyle = `rgba(180,120,255,${0.6+flap*0.4})`;
      ctx.fillRect(px + s*0.38, py + s*0.28, s*0.24, s*0.04);
      // Sword (right)
      ctx.fillStyle = '#c8cee0'; ctx.fillRect(px + s*0.80, py + s*0.16, s*0.05, s*0.56);
      ctx.fillStyle = '#8a7038'; ctx.fillRect(px + s*0.74, py + s*0.70, s*0.16, s*0.05);
      break;
    }
    case 'mind_flayer': {
      // Psionic aura
      const mfa = ctx.createRadialGradient(cx, py + s*0.30, 0, cx, py + s*0.30, s*0.4);
      mfa.addColorStop(0, `rgba(160,90,220,${0.3+flap*0.25})`);
      mfa.addColorStop(1, 'rgba(160,90,220,0)');
      ctx.fillStyle = mfa; ctx.fillRect(sx - ts*0.1, sy - ts*0.1, ts*1.2, ts*1.2);
      // Robe
      ctx.fillStyle = '#3a2a52';
      ctx.beginPath(); ctx.moveTo(px + s*0.30, py + s*0.42); ctx.lineTo(px + s*0.70, py + s*0.42); ctx.lineTo(px + s*0.78, py + s*0.90); ctx.lineTo(px + s*0.22, py + s*0.90); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#4a3668'; ctx.fillRect(px + s*0.30, py + s*0.42, s*0.20, s*0.48);
      // Bulbous head
      ctx.fillStyle = '#7a55a0';
      ctx.beginPath(); ctx.arc(cx, py + s*0.30, s*0.18, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#9070b8';
      ctx.beginPath(); ctx.arc(cx - s*0.05, py + s*0.26, s*0.11, 0, Math.PI*2); ctx.fill();
      // Eyes
      ctx.fillStyle = '#e8e0f0'; ctx.fillRect(cx - s*0.10, py + s*0.28, s*0.06, s*0.03); ctx.fillRect(cx + s*0.04, py + s*0.28, s*0.06, s*0.03);
      // Four writhing face tentacles
      ctx.strokeStyle = '#7a55a0'; ctx.lineWidth = Math.max(2, s*0.05); ctx.lineCap = 'round';
      for (let i=0;i<4;i++){ const tx = cx - s*0.12 + i*s*0.08; const wob = Math.sin(Date.now()/160 + i + phase)*s*0.05; ctx.beginPath(); ctx.moveTo(tx, py + s*0.40); ctx.quadraticCurveTo(tx + wob, py + s*0.50, tx + wob*1.4, py + s*0.58); ctx.stroke(); }
      break;
    }
    case 'githyanki': {
      // Armor body
      ctx.fillStyle = '#7a2a2a'; ctx.fillRect(px + s*0.30, py + s*0.40, s*0.40, s*0.46);
      ctx.fillStyle = '#9a3a3a'; ctx.fillRect(px + s*0.30, py + s*0.40, s*0.20, s*0.46);
      ctx.fillStyle = '#e0b040'; ctx.fillRect(px + s*0.30, py + s*0.56, s*0.40, s*0.04);
      // Spiky pauldrons
      ctx.fillStyle = '#caa030';
      ctx.beginPath(); ctx.moveTo(px + s*0.28, py + s*0.42); ctx.lineTo(px + s*0.22, py + s*0.30); ctx.lineTo(px + s*0.38, py + s*0.40); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px + s*0.72, py + s*0.42); ctx.lineTo(px + s*0.78, py + s*0.30); ctx.lineTo(px + s*0.62, py + s*0.40); ctx.closePath(); ctx.fill();
      // Head (yellow-green)
      ctx.fillStyle = '#bcc24a';
      ctx.beginPath(); ctx.arc(cx, py + s*0.28, s*0.15, 0, Math.PI*2); ctx.fill();
      // Pointed ears
      ctx.fillStyle = '#a4aa3a';
      ctx.beginPath(); ctx.moveTo(px + s*0.38, py + s*0.26); ctx.lineTo(px + s*0.28, py + s*0.16); ctx.lineTo(px + s*0.42, py + s*0.30); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px + s*0.62, py + s*0.26); ctx.lineTo(px + s*0.72, py + s*0.16); ctx.lineTo(px + s*0.58, py + s*0.30); ctx.closePath(); ctx.fill();
      // Eyes
      ctx.fillStyle = '#1a1a06'; ctx.fillRect(px + s*0.44, py + s*0.26, s*0.04, s*0.04); ctx.fillRect(px + s*0.53, py + s*0.26, s*0.04, s*0.04);
      // Silver greatsword
      ctx.fillStyle = '#d8dce8'; ctx.fillRect(px + s*0.80, py + s*0.10, s*0.05, s*0.66);
      ctx.fillStyle = '#e0b040'; ctx.fillRect(px + s*0.75, py + s*0.72, s*0.15, s*0.05);
      break;
    }
    case 'rakshasa': {
      // Fine robe
      ctx.fillStyle = '#7a2030';
      ctx.beginPath(); ctx.moveTo(px + s*0.30, py + s*0.42); ctx.lineTo(px + s*0.70, py + s*0.42); ctx.lineTo(px + s*0.78, py + s*0.90); ctx.lineTo(px + s*0.22, py + s*0.90); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#9a2a3a'; ctx.fillRect(px + s*0.44, py + s*0.42, s*0.12, s*0.48);
      ctx.fillStyle = '#e0b848'; ctx.fillRect(px + s*0.46, py + s*0.42, s*0.08, s*0.48);
      // Tiger head
      ctx.fillStyle = '#d88a3a';
      ctx.beginPath(); ctx.arc(cx, py + s*0.28, s*0.18, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#f0e0d0';
      ctx.beginPath(); ctx.arc(cx, py + s*0.34, s*0.10, 0, Math.PI*2); ctx.fill();
      // Ears
      ctx.fillStyle = '#d88a3a';
      ctx.beginPath(); ctx.arc(px + s*0.36, py + s*0.16, s*0.06, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + s*0.64, py + s*0.16, s*0.06, 0, Math.PI*2); ctx.fill();
      // Stripes
      ctx.strokeStyle = '#3a1a0a'; ctx.lineWidth = Math.max(1.5, s*0.03);
      ctx.beginPath(); ctx.moveTo(px + s*0.36, py + s*0.18); ctx.lineTo(px + s*0.40, py + s*0.26); ctx.moveTo(px + s*0.64, py + s*0.18); ctx.lineTo(px + s*0.60, py + s*0.26); ctx.moveTo(cx, py + s*0.12); ctx.lineTo(cx, py + s*0.20); ctx.stroke();
      // Glowing eyes
      ctx.fillStyle = `rgba(255,210,60,${0.7+flap*0.3})`;
      ctx.fillRect(px + s*0.42, py + s*0.26, s*0.06, s*0.04); ctx.fillRect(px + s*0.54, py + s*0.26, s*0.06, s*0.04);
      // Fanged snout
      ctx.fillStyle = '#1a0a0a'; ctx.fillRect(px + s*0.46, py + s*0.36, s*0.08, s*0.03);
      ctx.fillStyle = '#fff'; ctx.fillRect(px + s*0.46, py + s*0.36, s*0.02, s*0.04); ctx.fillRect(px + s*0.53, py + s*0.36, s*0.02, s*0.04);
      break;
    }
    case 'kraken_boss': {
      if (e.boss) {
        const auraR = s*0.62 + Math.sin(Date.now()/220)*s*0.04;
        const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, auraR);
        aura.addColorStop(0, 'rgba(40,140,210,0.40)'); aura.addColorStop(1, 'rgba(40,140,210,0)');
        ctx.fillStyle = aura; ctx.fillRect(cx-auraR, cy-auraR, auraR*2, auraR*2);
      }
      // Writhing tentacles
      ctx.lineCap = 'round';
      for (let pass=0; pass<2; pass++){
        ctx.strokeStyle = pass ? '#3a96d8' : '#1f6aa0';
        ctx.lineWidth = pass ? Math.max(1.5, s*0.03) : Math.max(3, s*0.07);
        for (let i=0;i<6;i++){
          const t = (i-2.5)/2.5;
          const baseX = cx + t*s*0.22;
          const sway = Math.sin(Date.now()/240 + phase + i)*s*0.12;
          ctx.beginPath();
          ctx.moveTo(baseX, py + s*(0.52 + pass*0.02));
          ctx.quadraticCurveTo(baseX + t*s*0.30, py + s*0.74, cx + t*s*0.46 + sway, py + s*(0.96 - pass*0.02));
          ctx.stroke();
        }
      }
      // Mantle / head
      ctx.fillStyle = '#2a7ec0';
      ctx.beginPath();
      ctx.moveTo(cx, py + s*0.04);
      ctx.quadraticCurveTo(px + s*0.16, py + s*0.30, px + s*0.26, py + s*0.56);
      ctx.quadraticCurveTo(cx, py + s*0.68, px + s*0.74, py + s*0.56);
      ctx.quadraticCurveTo(px + s*0.84, py + s*0.30, cx, py + s*0.04);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#3a96d8';
      ctx.beginPath(); ctx.ellipse(cx - s*0.05, py + s*0.30, s*0.15, s*0.22, 0, 0, Math.PI*2); ctx.fill();
      // Glowing eyes
      ctx.fillStyle = `rgba(255,240,140,${0.7+flap*0.3})`;
      ctx.beginPath(); ctx.arc(px + s*0.40, py + s*0.40, s*0.08, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + s*0.60, py + s*0.40, s*0.08, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.fillRect(px + s*0.385, py + s*0.38, s*0.03, s*0.07);
      ctx.fillRect(px + s*0.585, py + s*0.38, s*0.03, s*0.07);
      // Beak
      ctx.fillStyle = '#0a2a3a';
      ctx.beginPath(); ctx.moveTo(cx - s*0.06, py + s*0.52); ctx.lineTo(cx, py + s*0.62); ctx.lineTo(cx + s*0.06, py + s*0.52); ctx.closePath(); ctx.fill();
      break;
    }
    case 'frost_titan': {
      if (e.boss) {
        const auraR = s*0.62 + Math.sin(Date.now()/220)*s*0.04;
        const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, auraR);
        aura.addColorStop(0, 'rgba(160,220,255,0.40)'); aura.addColorStop(1, 'rgba(160,220,255,0)');
        ctx.fillStyle = aura; ctx.fillRect(cx-auraR, cy-auraR, auraR*2, auraR*2);
      }
      // Legs
      ctx.fillStyle = '#6fa6cc'; ctx.fillRect(px + s*0.30, py + s*0.68, s*0.16, s*0.24); ctx.fillRect(px + s*0.54, py + s*0.68, s*0.16, s*0.24);
      // Torso
      ctx.fillStyle = '#8cc4e6'; ctx.fillRect(px + s*0.24, py + s*0.34, s*0.52, s*0.40);
      ctx.fillStyle = '#aadcf4'; ctx.fillRect(px + s*0.24, py + s*0.34, s*0.26, s*0.40);
      // Shoulder ice shards
      ctx.fillStyle = '#dff2ff';
      [[0.22,0.36],[0.30,0.30],[0.70,0.30],[0.78,0.36]].forEach(([fx,fy]) => { ctx.beginPath(); ctx.moveTo(px+s*fx, py+s*fy); ctx.lineTo(px+s*(fx+0.03), py+s*(fy-0.16)); ctx.lineTo(px+s*(fx+0.08), py+s*fy); ctx.closePath(); ctx.fill(); });
      // Head
      ctx.fillStyle = '#aadcf4';
      ctx.beginPath(); ctx.arc(cx, py + s*0.22, s*0.17, 0, Math.PI*2); ctx.fill();
      // Icicle beard
      ctx.fillStyle = '#e8f6ff';
      [0.40,0.47,0.54,0.61].forEach(fx => { ctx.beginPath(); ctx.moveTo(px+s*fx, py+s*0.28); ctx.lineTo(px+s*(fx+0.02), py+s*0.42); ctx.lineTo(px+s*(fx+0.05), py+s*0.28); ctx.closePath(); ctx.fill(); });
      // Ice crown
      ctx.fillStyle = '#dff2ff';
      [0.34,0.42,0.50,0.58,0.66].forEach(fx => { ctx.beginPath(); ctx.moveTo(px+s*fx, py+s*0.12); ctx.lineTo(px+s*(fx+0.02), py-s*0.04); ctx.lineTo(px+s*(fx+0.05), py+s*0.12); ctx.closePath(); ctx.fill(); });
      // Glowing eyes
      ctx.fillStyle = `rgba(120,220,255,${0.7+flap*0.3})`;
      ctx.fillRect(px + s*0.42, py + s*0.20, s*0.06, s*0.05); ctx.fillRect(px + s*0.53, py + s*0.20, s*0.06, s*0.05);
      // Ice greatsword (right)
      ctx.fillStyle = 'rgba(210,240,255,0.92)';
      ctx.beginPath(); ctx.moveTo(px + s*0.82, py + s*0.06); ctx.lineTo(px + s*0.88, py + s*0.20); ctx.lineTo(px + s*0.85, py + s*0.74); ctx.lineTo(px + s*0.79, py + s*0.74); ctx.lineTo(px + s*0.76, py + s*0.20); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#6fa6cc'; ctx.fillRect(px + s*0.74, py + s*0.74, s*0.16, s*0.05);
      break;
    }
    case 'gaia_colossus': {
      if (e.boss) {
        const auraR = s*0.60 + Math.sin(Date.now()/220)*s*0.04;
        const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, auraR);
        aura.addColorStop(0, 'rgba(210,150,60,0.32)'); aura.addColorStop(1, 'rgba(210,150,60,0)');
        ctx.fillStyle = aura; ctx.fillRect(cx-auraR, cy-auraR, auraR*2, auraR*2);
      }
      // Boulder legs
      ctx.fillStyle = '#5e5436'; ctx.fillRect(px + s*0.28, py + s*0.70, s*0.18, s*0.22); ctx.fillRect(px + s*0.54, py + s*0.70, s*0.18, s*0.22);
      // Craggy torso
      ctx.fillStyle = '#6e6242';
      ctx.beginPath();
      ctx.moveTo(px + s*0.22, py + s*0.74); ctx.lineTo(px + s*0.18, py + s*0.36); ctx.lineTo(px + s*0.34, py + s*0.24);
      ctx.lineTo(px + s*0.66, py + s*0.24); ctx.lineTo(px + s*0.82, py + s*0.36); ctx.lineTo(px + s*0.78, py + s*0.74);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#867748';
      ctx.beginPath(); ctx.moveTo(px + s*0.34, py + s*0.26); ctx.lineTo(px + s*0.50, py + s*0.24); ctx.lineTo(px + s*0.46, py + s*0.52); ctx.lineTo(px + s*0.26, py + s*0.54); ctx.closePath(); ctx.fill();
      // Glowing molten core
      ctx.fillStyle = `rgba(255,150,40,${0.6+flap*0.4})`;
      ctx.beginPath(); ctx.arc(cx, py + s*0.50, s*0.10, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#ffd070';
      ctx.beginPath(); ctx.arc(cx, py + s*0.50, s*0.05, 0, Math.PI*2); ctx.fill();
      // Glowing cracks
      ctx.strokeStyle = `rgba(255,140,40,${0.4+flap*0.3})`; ctx.lineWidth = Math.max(1.5, s*0.03);
      ctx.beginPath(); ctx.moveTo(cx, py + s*0.40); ctx.lineTo(px + s*0.32, py + s*0.30); ctx.moveTo(cx, py + s*0.60); ctx.lineTo(px + s*0.70, py + s*0.70); ctx.stroke();
      // Boulder fists
      ctx.fillStyle = '#5e5436';
      ctx.beginPath(); ctx.arc(px + s*0.16, py + s*0.58, s*0.12, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + s*0.84, py + s*0.58, s*0.12, 0, Math.PI*2); ctx.fill();
      // Head
      ctx.fillStyle = '#6e6242';
      ctx.beginPath(); ctx.arc(cx, py + s*0.20, s*0.13, 0, Math.PI*2); ctx.fill();
      // Moss patches
      ctx.fillStyle = '#4a6a28';
      ctx.fillRect(px + s*0.30, py + s*0.26, s*0.10, s*0.04);
      ctx.fillRect(px + s*0.60, py + s*0.30, s*0.12, s*0.04);
      // Eyes
      ctx.fillStyle = `rgba(255,180,60,${0.7+flap*0.3})`;
      ctx.fillRect(px + s*0.43, py + s*0.18, s*0.05, s*0.04); ctx.fillRect(px + s*0.52, py + s*0.18, s*0.05, s*0.04);
      break;
    }
    case 'wind_djinn': {
      if (e.boss) {
        const auraR = s*0.58 + Math.sin(Date.now()/220)*s*0.04;
        const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, auraR);
        aura.addColorStop(0, 'rgba(190,210,240,0.35)'); aura.addColorStop(1, 'rgba(190,210,240,0)');
        ctx.fillStyle = aura; ctx.fillRect(cx-auraR, cy-auraR, auraR*2, auraR*2);
      }
      // Vortex tail
      ctx.fillStyle = 'rgba(150,180,220,0.55)';
      ctx.beginPath();
      ctx.moveTo(px + s*0.34, py + s*0.56);
      ctx.quadraticCurveTo(px + s*0.10, py + s*0.78, cx + Math.sin(Date.now()/200+phase)*s*0.10, py + s*0.96);
      ctx.quadraticCurveTo(px + s*0.90, py + s*0.78, px + s*0.66, py + s*0.56);
      ctx.closePath(); ctx.fill();
      // Swirl lines
      ctx.strokeStyle = 'rgba(220,235,250,0.6)'; ctx.lineWidth = Math.max(1.5, s*0.03);
      for (let i=0;i<3;i++){ ctx.beginPath(); ctx.ellipse(cx, py + s*0.70 + i*s*0.08, s*0.18 - i*s*0.04, s*0.05, Math.sin(Date.now()/260+i)*0.4, 0, Math.PI*2); ctx.stroke(); }
      // Torso
      ctx.fillStyle = '#9fb8d8';
      ctx.beginPath(); ctx.moveTo(px + s*0.30, py + s*0.58); ctx.lineTo(px + s*0.36, py + s*0.34); ctx.lineTo(px + s*0.64, py + s*0.34); ctx.lineTo(px + s*0.70, py + s*0.58); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#b8cde6';
      ctx.fillRect(px + s*0.36, py + s*0.34, s*0.14, s*0.24);
      // Crossed arms
      ctx.strokeStyle = '#9fb8d8'; ctx.lineWidth = Math.max(4, s*0.10); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(px + s*0.34, py + s*0.42); ctx.lineTo(px + s*0.62, py + s*0.52); ctx.moveTo(px + s*0.66, py + s*0.42); ctx.lineTo(px + s*0.38, py + s*0.52); ctx.stroke();
      // Head
      ctx.fillStyle = '#b8cde6';
      ctx.beginPath(); ctx.arc(cx, py + s*0.24, s*0.15, 0, Math.PI*2); ctx.fill();
      // Turban + gem
      ctx.fillStyle = '#3a6ad0';
      ctx.beginPath(); ctx.arc(cx, py + s*0.16, s*0.16, Math.PI, 0); ctx.fill();
      ctx.fillRect(px + s*0.36, py + s*0.14, s*0.28, s*0.06);
      ctx.fillStyle = `rgba(255,230,120,${0.7+flap*0.3})`;
      ctx.beginPath(); ctx.arc(cx, py + s*0.12, s*0.04, 0, Math.PI*2); ctx.fill();
      // Beard
      ctx.fillStyle = '#dfe8f4'; ctx.fillRect(px + s*0.42, py + s*0.30, s*0.16, s*0.12);
      // Glowing eyes
      ctx.fillStyle = `rgba(220,245,255,${0.7+flap*0.3})`;
      ctx.fillRect(px + s*0.43, py + s*0.22, s*0.05, s*0.04); ctx.fillRect(px + s*0.52, py + s*0.22, s*0.05, s*0.04);
      break;
    }
    case 'storm_lord': {
      if (e.boss) {
        const auraR = s*0.60 + Math.sin(Date.now()/220)*s*0.04;
        const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, auraR);
        aura.addColorStop(0, `rgba(255,225,90,${0.35+flap*0.15})`); aura.addColorStop(1, 'rgba(255,225,90,0)');
        ctx.fillStyle = aura; ctx.fillRect(cx-auraR, cy-auraR, auraR*2, auraR*2);
      }
      // Crackling bolts
      ctx.strokeStyle = `rgba(255,245,150,${0.5+flap*0.5})`; ctx.lineWidth = Math.max(1.5, s*0.03);
      for (let i=0;i<3;i++){ const a = Date.now()/300 + i*2.1 + phase; const r1=s*0.40, r2=s*0.56;
        ctx.beginPath(); ctx.moveTo(cx+Math.cos(a)*r1, cy+Math.sin(a)*r1); ctx.lineTo(cx+Math.cos(a+0.2)*r2, cy+Math.sin(a+0.2)*r2); ctx.lineTo(cx+Math.cos(a+0.1)*r1, cy+Math.sin(a+0.1)*r1); ctx.stroke(); }
      // Legs
      ctx.fillStyle = '#7a6420'; ctx.fillRect(px + s*0.32, py + s*0.68, s*0.14, s*0.24); ctx.fillRect(px + s*0.54, py + s*0.68, s*0.14, s*0.24);
      // Armored torso
      ctx.fillStyle = '#caa830'; ctx.fillRect(px + s*0.28, py + s*0.36, s*0.44, s*0.38);
      ctx.fillStyle = '#e6c84a'; ctx.fillRect(px + s*0.28, py + s*0.36, s*0.22, s*0.38);
      // Pauldrons
      ctx.fillStyle = '#8a6e1e';
      ctx.beginPath(); ctx.moveTo(px + s*0.26, py + s*0.38); ctx.lineTo(px + s*0.18, py + s*0.28); ctx.lineTo(px + s*0.40, py + s*0.36); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px + s*0.74, py + s*0.38); ctx.lineTo(px + s*0.82, py + s*0.28); ctx.lineTo(px + s*0.60, py + s*0.36); ctx.closePath(); ctx.fill();
      // Head
      ctx.fillStyle = '#e6c84a';
      ctx.beginPath(); ctx.arc(cx, py + s*0.24, s*0.14, 0, Math.PI*2); ctx.fill();
      // Lightning crown
      ctx.fillStyle = '#fff2a0';
      [0.36,0.44,0.50,0.56,0.64].forEach(fx => { ctx.beginPath(); ctx.moveTo(px+s*fx, py+s*0.14); ctx.lineTo(px+s*(fx+0.02), py-s*0.02); ctx.lineTo(px+s*(fx+0.05), py+s*0.14); ctx.closePath(); ctx.fill(); });
      // Glowing eyes
      ctx.fillStyle = 'rgba(255,250,180,0.85)';
      ctx.fillRect(px + s*0.43, py + s*0.22, s*0.05, s*0.04); ctx.fillRect(px + s*0.52, py + s*0.22, s*0.05, s*0.04);
      // Bolt scepter (right)
      ctx.strokeStyle = `rgba(255,245,150,${0.7+flap*0.3})`; ctx.lineWidth = Math.max(2, s*0.05);
      ctx.beginPath(); ctx.moveTo(px + s*0.84, py + s*0.10); ctx.lineTo(px + s*0.92, py + s*0.34); ctx.lineTo(px + s*0.82, py + s*0.44); ctx.lineTo(px + s*0.92, py + s*0.70); ctx.stroke();
      break;
    }
    case 'seraph_judge': {
      if (e.boss) {
        const auraR = s*0.64 + Math.sin(Date.now()/220)*s*0.05;
        const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, auraR);
        aura.addColorStop(0, `rgba(255,245,180,${0.45+flap*0.2})`); aura.addColorStop(1, 'rgba(255,245,180,0)');
        ctx.fillStyle = aura; ctx.fillRect(cx-auraR, cy-auraR, auraR*2, auraR*2);
      }
      // Six wings (three pairs)
      const swf = Math.sin(Date.now()/150 + phase)*0.12 + 1;
      ctx.fillStyle = '#fbf6e0';
      [[0.20,0.18],[0.14,0.40],[0.20,0.62]].forEach(([wx,wy]) => {
        ctx.beginPath(); ctx.moveTo(cx - s*0.04, py + s*(wy+0.06)); ctx.lineTo(px + s*(wx-0.06), py + s*wy/swf); ctx.lineTo(px + s*(wx+0.10), py + s*(wy+0.10)); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(cx + s*0.04, py + s*(wy+0.06)); ctx.lineTo(px + s*(1-wx+0.06), py + s*wy/swf); ctx.lineTo(px + s*(1-wx-0.10), py + s*(wy+0.10)); ctx.closePath(); ctx.fill();
      });
      // Robe
      ctx.fillStyle = '#fff4d0';
      ctx.beginPath(); ctx.moveTo(px + s*0.36, py + s*0.40); ctx.lineTo(px + s*0.64, py + s*0.40); ctx.lineTo(px + s*0.72, py + s*0.90); ctx.lineTo(px + s*0.28, py + s*0.90); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffe08a'; ctx.fillRect(px + s*0.36, py + s*0.56, s*0.28, s*0.05);
      // Radiant head
      ctx.fillStyle = '#fff0c0';
      ctx.beginPath(); ctx.arc(cx, py + s*0.28, s*0.13, 0, Math.PI*2); ctx.fill();
      // Halo
      ctx.strokeStyle = `rgba(255,235,140,${0.7+flap*0.3})`; ctx.lineWidth = Math.max(2, s*0.05);
      ctx.beginPath(); ctx.arc(cx, py + s*0.10, s*0.13, 0, Math.PI*2); ctx.stroke();
      // Blazing eyes
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx - s*0.07, py + s*0.26, s*0.04, s*0.04); ctx.fillRect(cx + s*0.03, py + s*0.26, s*0.04, s*0.04);
      // Radiant greatsword (center-front, vertical)
      ctx.fillStyle = `rgba(255,250,210,${0.8+flap*0.2})`;
      ctx.fillRect(cx - s*0.025, py + s*0.40, s*0.05, s*0.46);
      ctx.fillStyle = '#ffd86a'; ctx.fillRect(cx - s*0.10, py + s*0.40, s*0.20, s*0.04);
      break;
    }
    case 'death_knight': {
      if (e.boss) {
        const auraR = s*0.62 + Math.sin(Date.now()/220)*s*0.04;
        const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, auraR);
        aura.addColorStop(0, 'rgba(170,90,220,0.42)'); aura.addColorStop(1, 'rgba(170,90,220,0)');
        ctx.fillStyle = aura; ctx.fillRect(cx-auraR, cy-auraR, auraR*2, auraR*2);
      }
      // Armored legs
      ctx.fillStyle = '#2a2238'; ctx.fillRect(px + s*0.32, py + s*0.70, s*0.14, s*0.22); ctx.fillRect(px + s*0.54, py + s*0.70, s*0.14, s*0.22);
      // Tattered cape
      ctx.fillStyle = '#1a1428';
      ctx.beginPath(); ctx.moveTo(px + s*0.26, py + s*0.38); ctx.lineTo(px + s*0.20, py + s*0.80); ctx.lineTo(px + s*0.32, py + s*0.74); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px + s*0.74, py + s*0.38); ctx.lineTo(px + s*0.80, py + s*0.80); ctx.lineTo(px + s*0.68, py + s*0.74); ctx.closePath(); ctx.fill();
      // Cuirass
      ctx.fillStyle = '#3a3050'; ctx.fillRect(px + s*0.28, py + s*0.36, s*0.44, s*0.40);
      ctx.fillStyle = '#4e4270'; ctx.fillRect(px + s*0.28, py + s*0.36, s*0.22, s*0.40);
      // Spiked pauldrons
      ctx.fillStyle = '#2a2238';
      ctx.beginPath(); ctx.moveTo(px + s*0.26, py + s*0.38); ctx.lineTo(px + s*0.16, py + s*0.26); ctx.lineTo(px + s*0.40, py + s*0.36); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px + s*0.74, py + s*0.38); ctx.lineTo(px + s*0.84, py + s*0.26); ctx.lineTo(px + s*0.60, py + s*0.36); ctx.closePath(); ctx.fill();
      // Skull face in helm
      ctx.fillStyle = '#d8d2bc';
      ctx.beginPath(); ctx.arc(cx, py + s*0.24, s*0.15, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = `rgba(180,90,255,${0.7+flap*0.3})`;
      ctx.beginPath(); ctx.arc(px + s*0.44, py + s*0.24, s*0.04, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + s*0.56, py + s*0.24, s*0.04, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#000'; ctx.fillRect(px + s*0.46, py + s*0.30, s*0.08, s*0.05);
      // Horned crown helm
      ctx.fillStyle = '#2a2238';
      ctx.beginPath(); ctx.moveTo(px + s*0.38, py + s*0.14); ctx.lineTo(px + s*0.30, py + s*0.0); ctx.lineTo(px + s*0.46, py + s*0.12); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px + s*0.62, py + s*0.14); ctx.lineTo(px + s*0.70, py + s*0.0); ctx.lineTo(px + s*0.54, py + s*0.12); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffcc00'; ctx.fillRect(px + s*0.42, py + s*0.08, s*0.16, s*0.04);
      // Runeblade (right)
      ctx.fillStyle = '#5a4e78'; ctx.fillRect(px + s*0.82, py + s*0.10, s*0.05, s*0.64);
      ctx.fillStyle = `rgba(180,90,255,${0.5+flap*0.4})`; ctx.fillRect(px + s*0.835, py + s*0.14, s*0.02, s*0.56);
      ctx.fillStyle = '#3a3050'; ctx.fillRect(px + s*0.76, py + s*0.72, s*0.16, s*0.05);
      break;
    }
    case 'hydra_queen': {
      if (e.boss) {
        const auraR = s*0.62 + Math.sin(Date.now()/220)*s*0.04;
        const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, auraR);
        aura.addColorStop(0, 'rgba(120,200,70,0.38)'); aura.addColorStop(1, 'rgba(120,200,70,0)');
        ctx.fillStyle = aura; ctx.fillRect(cx-auraR, cy-auraR, auraR*2, auraR*2);
      }
      // Body mass
      ctx.fillStyle = '#4a7a2a';
      ctx.beginPath(); ctx.ellipse(cx, py + s*0.72, s*0.34, s*0.22, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#5e9636';
      ctx.beginPath(); ctx.ellipse(cx - s*0.04, py + s*0.68, s*0.24, s*0.15, 0, 0, Math.PI*2); ctx.fill();
      // Five necks + heads
      const necks = [[0.20,0.16],[0.36,0.06],[0.50,0.02],[0.64,0.06],[0.80,0.16]];
      necks.forEach(([hx,hy], i) => {
        const sway = Math.sin(Date.now()/220 + phase + i*1.3)*s*0.03;
        ctx.strokeStyle = '#5e9636'; ctx.lineWidth = Math.max(3, s*0.08); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(cx, py + s*0.58); ctx.quadraticCurveTo(px + s*hx + sway, py + s*0.40, px + s*hx + sway, py + s*(hy+0.10)); ctx.stroke();
        ctx.fillStyle = '#6faa3e';
        ctx.beginPath(); ctx.arc(px + s*hx + sway, py + s*(hy+0.08), s*0.085, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#5e9636';
        ctx.fillRect(px + s*hx + sway - s*0.02, py + s*(hy+0.10), s*0.10, s*0.05);
        ctx.fillStyle = `rgba(220,255,120,${0.7+flap*0.3})`;
        ctx.fillRect(px + s*hx + sway - s*0.03, py + s*(hy+0.04), s*0.03, s*0.03);
        ctx.fillStyle = '#dff0c0';
        ctx.fillRect(px + s*hx + sway + s*0.02, py + s*(hy+0.14), s*0.015, s*0.03);
      });
      // Poison drip from center head
      ctx.fillStyle = `rgba(150,230,80,${0.6+flap*0.4})`;
      ctx.beginPath(); ctx.arc(px + s*0.50, py + s*0.20, s*0.03, 0, Math.PI*2); ctx.fill();
      break;
    }
    case 'archmage_void': {
      if (e.boss) {
        const auraR = s*0.62 + Math.sin(Date.now()/220)*s*0.04;
        const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, auraR);
        aura.addColorStop(0, 'rgba(170,100,240,0.42)'); aura.addColorStop(1, 'rgba(170,100,240,0)');
        ctx.fillStyle = aura; ctx.fillRect(cx-auraR, cy-auraR, auraR*2, auraR*2);
      }
      // Void rift behind
      ctx.fillStyle = '#0a0418';
      ctx.beginPath(); ctx.arc(cx, py + s*0.42, s*0.40, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = `rgba(180,110,255,${0.4+flap*0.4})`; ctx.lineWidth = Math.max(1.5, s*0.03);
      for (let i=0;i<3;i++){ ctx.beginPath(); ctx.arc(cx, py + s*0.42, s*(0.40 - i*0.06), Date.now()/800 + i, Date.now()/800 + i + 2.2); ctx.stroke(); }
      // Floating runes
      ctx.fillStyle = '#c8a0ff';
      for (let i=0;i<5;i++){ const a = Date.now()/600 + i*1.26; ctx.fillRect(cx + Math.cos(a)*s*0.34 - s*0.012, py + s*0.42 + Math.sin(a)*s*0.30 - s*0.012, s*0.025, s*0.025); }
      // Robe
      ctx.fillStyle = '#3a1f5a';
      ctx.beginPath(); ctx.moveTo(px + s*0.32, py + s*0.42); ctx.lineTo(px + s*0.68, py + s*0.42); ctx.lineTo(px + s*0.78, py + s*0.92); ctx.lineTo(px + s*0.22, py + s*0.92); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#4e2c78';
      ctx.beginPath(); ctx.moveTo(px + s*0.32, py + s*0.42); ctx.lineTo(px + s*0.50, py + s*0.42); ctx.lineTo(px + s*0.50, py + s*0.92); ctx.lineTo(px + s*0.22, py + s*0.92); ctx.closePath(); ctx.fill();
      // Hood
      ctx.fillStyle = '#2a1444';
      ctx.beginPath(); ctx.moveTo(px + s*0.34, py + s*0.40); ctx.lineTo(cx, py + s*0.10); ctx.lineTo(px + s*0.66, py + s*0.40); ctx.closePath(); ctx.fill();
      // Glowing eyes in hood
      ctx.fillStyle = `rgba(200,140,255,${0.7+flap*0.3})`;
      ctx.fillRect(px + s*0.42, py + s*0.30, s*0.06, s*0.04); ctx.fillRect(px + s*0.52, py + s*0.30, s*0.06, s*0.04);
      // Arcane orb in hand
      ctx.fillStyle = `rgba(190,120,255,${0.6+flap*0.4})`;
      ctx.beginPath(); ctx.arc(px + s*0.82, py + s*0.56, s*0.08, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#f0e0ff';
      ctx.beginPath(); ctx.arc(px + s*0.80, py + s*0.54, s*0.03, 0, Math.PI*2); ctx.fill();
      break;
    }
    // ─── Volcanic region ───────────────────────────────────────────────
    case 'magmin': {
      // A small molten imp — a lump of cracked black rock lit from within by lava,
      // trailing heat, with two burning eyes. Fiery aura pulse.
      const ga = ctx.createRadialGradient(cx, cy, 0, cx, cy, s*0.5);
      ga.addColorStop(0, `rgba(255,120,30,${0.32+flap*0.22})`); ga.addColorStop(1, 'rgba(255,60,10,0)');
      ctx.fillStyle = ga; ctx.fillRect(sx - ts*0.1, sy - ts*0.1, ts*1.2, ts*1.2);
      ctx.fillStyle = '#2a1206';
      ctx.beginPath(); ctx.arc(cx, py + s*0.58, s*0.26, 0, Math.PI*2); ctx.fill();       // body
      ctx.fillRect(px + s*0.24, py + s*0.72, s*0.16, s*0.20); ctx.fillRect(px + s*0.60, py + s*0.72, s*0.16, s*0.20);   // legs
      ctx.strokeStyle = `rgba(255,140,40,${0.6+flap*0.4})`; ctx.lineWidth = Math.max(1.5, s*0.05); ctx.lineCap='round';   // lava cracks
      ctx.beginPath();
      ctx.moveTo(cx - s*0.14, py + s*0.48); ctx.lineTo(cx - s*0.02, py + s*0.60); ctx.lineTo(cx - s*0.12, py + s*0.72);
      ctx.moveTo(cx + s*0.12, py + s*0.50); ctx.lineTo(cx + s*0.02, py + s*0.62);
      ctx.stroke(); ctx.lineCap='butt';
      ctx.fillStyle = '#2a1206';
      ctx.beginPath(); ctx.arc(cx, py + s*0.32, s*0.17, 0, Math.PI*2); ctx.fill();        // head
      ctx.fillStyle = `rgba(255,210,80,${0.75+flap*0.25})`;
      ctx.fillRect(cx - s*0.09, py + s*0.30, s*0.06, s*0.05); ctx.fillRect(cx + s*0.03, py + s*0.30, s*0.06, s*0.05);   // eyes
      ctx.fillStyle = '#ff6a1e'; ctx.fillRect(cx - s*0.05, py + s*0.40, s*0.10, s*0.03);  // mouth
      break;
    }
    case 'fire_snake': {
      // A serpent of living fire — a coiling ember body brightening toward a flat
      // viper head with a glowing forked tongue. Heat shimmer.
      const ga = ctx.createRadialGradient(cx, cy, 0, cx, cy, s*0.5);
      ga.addColorStop(0, `rgba(255,110,30,${0.28+flap*0.2})`); ga.addColorStop(1, 'rgba(255,60,10,0)');
      ctx.fillStyle = ga; ctx.fillRect(sx - ts*0.1, sy - ts*0.1, ts*1.2, ts*1.2);
      ctx.strokeStyle = '#b8300f'; ctx.lineWidth = Math.max(3, s*0.14); ctx.lineCap='round';
      ctx.beginPath();
      ctx.moveTo(px + s*0.14, py + s*0.86);
      ctx.quadraticCurveTo(px + s*0.86, py + s*0.80, px + s*0.44, py + s*0.56);
      ctx.quadraticCurveTo(px + s*0.14, py + s*0.40, px + s*0.62, py + s*0.28);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,150,50,${0.7+flap*0.3})`; ctx.lineWidth = Math.max(1.5, s*0.06); ctx.stroke();
      ctx.lineCap='butt';
      ctx.fillStyle = '#d23a12';
      ctx.beginPath(); ctx.ellipse(px + s*0.66, py + s*0.26, s*0.15, s*0.10, -0.3, 0, Math.PI*2); ctx.fill();   // head
      ctx.fillStyle = '#ffdf6a'; ctx.fillRect(px + s*0.70, py + s*0.22, s*0.05, s*0.04);
      ctx.fillStyle = '#000'; ctx.fillRect(px + s*0.72, py + s*0.23, s*0.02, s*0.02);
      ctx.strokeStyle = `rgba(255,200,60,${0.7+flap*0.3})`; ctx.lineWidth = Math.max(1, s*0.025);   // tongue
      ctx.beginPath(); ctx.moveTo(px + s*0.80, py + s*0.28); ctx.lineTo(px + s*0.92, py + s*0.26); ctx.stroke();
      break;
    }
    case 'azer': {
      // A fire dwarf smith — brass-skinned, a beard and crest of live flame, a heavy
      // hammer in hand. Squat armored humanoid.
      ctx.fillStyle = '#7a4a1c'; ctx.fillRect(px + s*0.30, py + s*0.70, s*0.14, s*0.22); ctx.fillRect(px + s*0.52, py + s*0.70, s*0.14, s*0.22);   // legs
      ctx.fillStyle = '#5a3414'; ctx.fillRect(px + s*0.28, py + s*0.54, s*0.40, s*0.22);   // apron
      ctx.fillStyle = '#c78a34'; ctx.fillRect(px + s*0.30, py + s*0.38, s*0.36, s*0.24);   // brass torso
      ctx.fillStyle = '#e2ab54'; ctx.fillRect(px + s*0.30, py + s*0.38, s*0.18, s*0.24);
      ctx.fillStyle = '#c78a34';
      ctx.beginPath(); ctx.arc(cx - s*0.02, py + s*0.28, s*0.15, 0, Math.PI*2); ctx.fill();   // head
      ctx.fillStyle = `rgba(255,140,30,${0.7+flap*0.3})`;                                    // flame beard + crest
      [0.34,0.44,0.54].forEach((fx,i)=>{ const fl=Math.sin(Date.now()/110+i+phase)*s*0.03;
        ctx.beginPath(); ctx.moveTo(px + s*fx, py + s*0.36); ctx.lineTo(px + s*(fx+0.03), py + s*0.50 + fl); ctx.lineTo(px + s*(fx+0.06), py + s*0.36); ctx.closePath(); ctx.fill(); });
      ctx.beginPath(); ctx.moveTo(cx - s*0.10, py + s*0.16); ctx.lineTo(cx - s*0.02, py + s*0.0); ctx.lineTo(cx + s*0.06, py + s*0.16); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffe070'; ctx.fillRect(cx - s*0.08, py + s*0.26, s*0.05, s*0.04); ctx.fillRect(cx + s*0.02, py + s*0.26, s*0.05, s*0.04);   // eyes
      ctx.strokeStyle = '#5a3414'; ctx.lineWidth = Math.max(2, s*0.05); ctx.beginPath(); ctx.moveTo(px + s*0.78, py + s*0.24); ctx.lineTo(px + s*0.78, py + s*0.80); ctx.stroke();   // hammer haft
      ctx.fillStyle = '#8a8078'; ctx.fillRect(px + s*0.68, py + s*0.16, s*0.20, s*0.14);   // hammer head
      break;
    }
    case 'red_wyrmling': {
      // A red dragon wyrmling — scarlet scales, ribbed wings, a horned head with a
      // spark of fire breath. Small, quick, airborne.
      const dwf = Math.sin(Date.now()/120 + phase) * 0.2 + 1;
      ctx.fillStyle = '#a02010';
      ctx.beginPath(); ctx.moveTo(px + s*0.06, py + s*0.40/dwf); ctx.lineTo(px + s*0.46, py + s*0.36); ctx.lineTo(px + s*0.28, py + s*0.60); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px + s*0.94, py + s*0.40/dwf); ctx.lineTo(px + s*0.54, py + s*0.36); ctx.lineTo(px + s*0.72, py + s*0.60); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#c8341c';
      ctx.beginPath(); ctx.ellipse(cx, py + s*0.54, s*0.20, s*0.26, 0, 0, Math.PI*2); ctx.fill();   // body
      ctx.fillStyle = '#e0492a';
      ctx.beginPath(); ctx.arc(cx, py + s*0.28, s*0.16, 0, Math.PI*2); ctx.fill();       // head
      ctx.fillStyle = '#5a1408';                                                          // horns
      ctx.beginPath(); ctx.moveTo(px + s*0.42, py + s*0.16); ctx.lineTo(px + s*0.32, py + s*0.04); ctx.lineTo(px + s*0.48, py + s*0.14); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px + s*0.58, py + s*0.16); ctx.lineTo(px + s*0.68, py + s*0.04); ctx.lineTo(px + s*0.52, py + s*0.14); ctx.closePath(); ctx.fill();
      ctx.fillStyle = `rgba(255,170,50,${0.5+flap*0.4})`; ctx.beginPath(); ctx.arc(cx, py + s*0.42, s*0.06, 0, Math.PI*2); ctx.fill();   // breath spark
      ctx.fillStyle = '#ffd23a'; ctx.fillRect(px + s*0.46, py + s*0.26, s*0.06, s*0.04);
      ctx.fillStyle = '#000'; ctx.fillRect(px + s*0.48, py + s*0.27, s*0.02, s*0.03);
      ctx.strokeStyle = '#c8341c'; ctx.lineWidth = Math.max(2, s*0.06);
      ctx.beginPath(); ctx.moveTo(cx, py + s*0.78); ctx.lineTo(cx + Math.sin(Date.now()/180+phase)*s*0.18, py + s); ctx.stroke();   // tail
      break;
    }
    case 'fire_elemental': {
      // A body of living flame — layered tongues of fire rising from the ground,
      // brightening to a white-hot core with two dark eyes. Fully animated.
      const t = Date.now();
      const flame = (fx, w, hgt, colr, spd) => {
        ctx.fillStyle = colr;
        ctx.beginPath();
        ctx.moveTo(px + s*(fx - w), py + s*0.92);
        for (let i=0;i<=6;i++){ const p=i/6; const wob=Math.sin(t/spd + p*6 + phase + fx*4)*s*0.05*(1-p);
          ctx.lineTo(px + s*fx + wob - Math.sin(p*Math.PI)*s*w*0.2, py + s*(0.92 - hgt*p)); }
        for (let i=6;i>=0;i--){ const p=i/6; const wob=Math.sin(t/spd + p*6 + phase + fx*4)*s*0.05*(1-p);
          ctx.lineTo(px + s*fx + wob + Math.sin(p*Math.PI)*s*w*0.2 + s*w*(1-p)*0.4, py + s*(0.92 - hgt*p)); }
        ctx.closePath(); ctx.fill();
      };
      flame(0.5, 0.34, 0.92, '#b8300f', 220);
      flame(0.46, 0.24, 0.80, '#ff6a1e', 170);
      flame(0.52, 0.16, 0.66, '#ffb038', 130);
      flame(0.49, 0.08, 0.50, '#ffe79a', 100);
      ctx.fillStyle = '#2a0a04';                                                          // eyes
      ctx.beginPath(); ctx.arc(cx - s*0.07, py + s*0.44, s*0.045, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + s*0.07, py + s*0.44, s*0.045, 0, Math.PI*2); ctx.fill();
      break;
    }
    case 'young_red_dragon': {
      // A young red dragon — a heavy scarlet wyrm with great ribbed wings, a horned
      // crest, and a hot glow building in its throat. Ranged breath attacker.
      const dwf = Math.sin(Date.now()/130 + phase) * 0.18 + 1;
      ctx.fillStyle = '#8a1808';
      ctx.beginPath(); ctx.moveTo(px + s*0.02, py + s*0.34/dwf); ctx.lineTo(px + s*0.44, py + s*0.30); ctx.lineTo(px + s*0.22, py + s*0.64); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px + s*0.98, py + s*0.34/dwf); ctx.lineTo(px + s*0.56, py + s*0.30); ctx.lineTo(px + s*0.78, py + s*0.64); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#a82212';
      ctx.beginPath(); ctx.moveTo(px + s*0.08, py + s*0.38/dwf); ctx.lineTo(px + s*0.42, py + s*0.34); ctx.lineTo(px + s*0.26, py + s*0.56); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px + s*0.92, py + s*0.38/dwf); ctx.lineTo(px + s*0.58, py + s*0.34); ctx.lineTo(px + s*0.74, py + s*0.56); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#bb2a16';
      ctx.beginPath(); ctx.ellipse(cx, py + s*0.56, s*0.22, s*0.30, 0, 0, Math.PI*2); ctx.fill();   // body
      ctx.fillStyle = '#d8562a'; ctx.beginPath(); ctx.ellipse(cx, py + s*0.62, s*0.10, s*0.18, 0, 0, Math.PI*2); ctx.fill();   // belly
      ctx.fillStyle = '#cc3418';
      ctx.beginPath(); ctx.arc(cx, py + s*0.26, s*0.17, 0, Math.PI*2); ctx.fill();       // head
      ctx.fillStyle = '#5a1408';                                                          // horn crest
      [0.38,0.5,0.62].forEach(fx=>{ ctx.beginPath(); ctx.moveTo(px + s*fx, py + s*0.14); ctx.lineTo(px + s*(fx+0.02), py + s*0.0); ctx.lineTo(px + s*(fx+0.08), py + s*0.14); ctx.closePath(); ctx.fill(); });
      ctx.fillStyle = `rgba(255,180,50,${0.5+flap*0.45})`; ctx.beginPath(); ctx.arc(cx, py + s*0.40, s*0.08, 0, Math.PI*2); ctx.fill();   // throat glow
      ctx.fillStyle = '#ffd23a'; ctx.fillRect(px + s*0.46, py + s*0.24, s*0.07, s*0.05);
      ctx.fillStyle = '#000'; ctx.fillRect(px + s*0.49, py + s*0.25, s*0.025, s*0.035);
      ctx.strokeStyle = '#bb2a16'; ctx.lineWidth = Math.max(2, s*0.07);
      ctx.beginPath(); ctx.moveTo(cx, py + s*0.82); ctx.lineTo(cx + Math.sin(Date.now()/170+phase)*s*0.22, py + s); ctx.stroke();   // tail
      break;
    }

    // ─── Shadow region ─────────────────────────────────────────────────
    case 'shade': {
      // A drifting shadow — a smoky black humanoid with a wavering hem and two cold
      // violet eyes, wrapped in a dark aura. Insubstantial.
      const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, s*0.55);
      aura.addColorStop(0, `rgba(120,80,190,${0.4+flap*0.22})`); aura.addColorStop(1, 'rgba(70,40,120,0)');
      ctx.fillStyle = aura; ctx.fillRect(sx - ts*0.1, sy - ts*0.1, ts*1.2, ts*1.2);
      ctx.fillStyle = '#160f22';
      ctx.beginPath();
      ctx.moveTo(px + s*0.24, py + s*0.26); ctx.lineTo(px + s*0.76, py + s*0.26);
      for (let i=6;i>=0;i--){ const fx=px + s*0.24 + s*0.52*(i/6); const fy=py + s*0.94 + Math.sin(Date.now()/220+phase+i*0.7)*s*0.06; ctx.lineTo(fx, fy); }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#221636';                                                          // wispy arms
      ctx.beginPath(); ctx.moveTo(px + s*0.24, py + s*0.34); ctx.lineTo(px + s*0.10, py + s*0.56); ctx.lineTo(px + s*0.30, py + s*0.50); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px + s*0.76, py + s*0.34); ctx.lineTo(px + s*0.90, py + s*0.56); ctx.lineTo(px + s*0.70, py + s*0.50); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#0c0814';
      ctx.beginPath(); ctx.arc(cx, py + s*0.24, s*0.16, 0, Math.PI*2); ctx.fill();        // head void
      ctx.fillStyle = `rgba(170,120,240,${0.75+flap*0.25})`;
      ctx.fillRect(px + s*0.40, py + s*0.22, s*0.07, s*0.05); ctx.fillRect(px + s*0.53, py + s*0.22, s*0.07, s*0.05);   // eyes
      break;
    }
    case 'shadow_mastiff': {
      // A hound of living shadow — a low black dog wreathed in gloom, a spectral
      // violet eye, a maw of pale fangs, and a smoky tail. Shadowy aura.
      const aura = ctx.createRadialGradient(cx, py + s*0.55, 0, cx, py + s*0.55, s*0.5);
      aura.addColorStop(0, `rgba(110,70,180,${0.3+flap*0.2})`); aura.addColorStop(1, 'rgba(60,30,110,0)');
      ctx.fillStyle = aura; ctx.fillRect(sx - ts*0.1, sy - ts*0.1, ts*1.2, ts*1.2);
      ctx.fillStyle = '#120c1c'; ctx.fillRect(px + s*0.14, py + s*0.46, s*0.62, s*0.34);
      ctx.fillStyle = '#221636'; ctx.fillRect(px + s*0.14, py + s*0.46, s*0.62, s*0.14);
      ctx.fillStyle = '#120c1c';
      ctx.beginPath(); ctx.arc(px + s*0.74, py + s*0.46, s*0.18, 0, Math.PI*2); ctx.fill();   // head
      ctx.fillStyle = '#221636'; ctx.fillRect(px + s*0.84, py + s*0.46, s*0.12, s*0.08);      // snout
      ctx.fillStyle = '#120c1c';                                                              // ear
      ctx.beginPath(); ctx.moveTo(px + s*0.64, py + s*0.30); ctx.lineTo(px + s*0.68, py + s*0.42); ctx.lineTo(px + s*0.76, py + s*0.32); ctx.closePath(); ctx.fill();
      ctx.fillStyle = `rgba(180,130,245,${0.75+flap*0.25})`; ctx.fillRect(px + s*0.78, py + s*0.42, s*0.05, s*0.04);   // eye
      ctx.fillStyle = '#e8e0f2'; ctx.fillRect(px + s*0.86, py + s*0.52, s*0.08, s*0.02);      // fangs
      ctx.fillStyle = '#120c1c';                                                              // legs
      [0.20,0.40,0.58].forEach(fx => ctx.fillRect(px + s*fx, py + s*0.78, s*0.08, s*0.14));
      ctx.strokeStyle = '#221636'; ctx.lineWidth = Math.max(2, s*0.06);
      ctx.beginPath(); ctx.moveTo(px + s*0.14, py + s*0.50); ctx.lineTo(px - s*0.02, py + s*0.36 + Math.sin(Date.now()/200+phase)*s*0.04); ctx.stroke();   // tail
      break;
    }
    case 'bodak': {
      // A bodak — a gaunt grey-violet corpse hollowed by the void, its killing gaze
      // a single burning eye. Emaciated undead humanoid.
      ctx.fillStyle = '#3a3348';
      ctx.beginPath(); ctx.moveTo(px + s*0.34, py + s*0.40); ctx.lineTo(px + s*0.66, py + s*0.40); ctx.lineTo(px + s*0.60, py + s*0.90); ctx.lineTo(px + s*0.40, py + s*0.90); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#4a4258'; ctx.fillRect(px + s*0.40, py + s*0.40, s*0.10, s*0.50);
      ctx.strokeStyle = '#221c30'; ctx.lineWidth = 1;                                     // ribs
      for (let i=0;i<3;i++){ ctx.beginPath(); ctx.moveTo(px + s*0.40, py + s*(0.48+i*0.08)); ctx.lineTo(px + s*0.60, py + s*(0.48+i*0.08)); ctx.stroke(); }
      ctx.strokeStyle = '#3a3348'; ctx.lineWidth = Math.max(2, s*0.05); ctx.lineCap='round';   // arms
      ctx.beginPath(); ctx.moveTo(px + s*0.34, py + s*0.44); ctx.lineTo(px + s*0.20, py + s*0.70);
      ctx.moveTo(px + s*0.66, py + s*0.44); ctx.lineTo(px + s*0.80, py + s*0.70); ctx.stroke(); ctx.lineCap='butt';
      ctx.fillStyle = '#4a4258';
      ctx.beginPath(); ctx.arc(cx, py + s*0.26, s*0.16, 0, Math.PI*2); ctx.fill();        // skull
      ctx.fillStyle = '#221c30'; ctx.fillRect(px + s*0.42, py + s*0.30, s*0.16, s*0.06);  // jaw shadow
      ctx.fillStyle = `rgba(180,120,255,${0.8+flap*0.2})`;
      ctx.beginPath(); ctx.arc(cx, py + s*0.24, s*0.055, 0, Math.PI*2); ctx.fill();       // gaze
      ctx.fillStyle = '#f0e6ff'; ctx.beginPath(); ctx.arc(cx, py + s*0.24, s*0.02, 0, Math.PI*2); ctx.fill();
      break;
    }
    case 'nightmare': {
      // A nightmare — a coal-black steed with a mane and hooves of violet flame,
      // eyes like embers. Fiery-maned horse.
      ctx.fillStyle = '#0e0a18';                                                          // legs
      [0.22,0.38,0.56,0.70].forEach((fx,idx) => { const ll=(idx%2? s*0.22:s*0.18); ctx.fillRect(px + s*fx, py + s*0.70, s*0.08, ll); });
      ctx.fillStyle = `rgba(150,90,240,${0.6+flap*0.4})`;                                  // hoof flames
      [0.22,0.38,0.56,0.70].forEach(fx => ctx.fillRect(px + s*fx, py + s*0.90, s*0.08, s*0.06));
      ctx.fillStyle = '#161020'; ctx.beginPath(); ctx.ellipse(cx, py + s*0.56, s*0.30, s*0.18, 0, 0, Math.PI*2); ctx.fill();   // body
      ctx.fillStyle = '#221636'; ctx.beginPath(); ctx.ellipse(cx - s*0.04, py + s*0.50, s*0.20, s*0.10, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#161020';                                                          // neck + head (right)
      ctx.beginPath(); ctx.moveTo(px + s*0.66, py + s*0.52); ctx.lineTo(px + s*0.80, py + s*0.24); ctx.lineTo(px + s*0.92, py + s*0.28); ctx.lineTo(px + s*0.82, py + s*0.52); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#0e0a18'; ctx.fillRect(px + s*0.86, py + s*0.24, s*0.10, s*0.10);  // muzzle
      ctx.fillStyle = `rgba(150,90,240,${0.6+flap*0.4})`;                                  // mane flames
      [0.60,0.68,0.76].forEach((fx,i)=>{ const fl=Math.sin(Date.now()/110+i+phase)*s*0.04; ctx.beginPath(); ctx.moveTo(px + s*fx, py + s*0.44); ctx.lineTo(px + s*(fx+0.03), py + s*0.22 - fl); ctx.lineTo(px + s*(fx+0.07), py + s*0.44); ctx.closePath(); ctx.fill(); });
      ctx.fillStyle = `rgba(200,140,255,${0.8+flap*0.2})`; ctx.fillRect(px + s*0.84, py + s*0.30, s*0.05, s*0.04);   // ember eye
      break;
    }
    case 'shadow_demon': {
      // A shadow demon — a winged blot of darkness with hooked claws and a fanged
      // violet grin, its bat-wings beating. Ranged terror.
      const wf = Math.sin(Date.now()/100 + phase) * 0.22 + 1;
      ctx.fillStyle = '#160f24';                                                          // wings
      ctx.beginPath(); ctx.moveTo(cx - s*0.06, py + s*0.42); ctx.lineTo(px + s*0.0, py + s*0.20/wf); ctx.lineTo(px + s*0.06, py + s*0.40); ctx.lineTo(px + s*0.02, py + s*0.56); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + s*0.06, py + s*0.42); ctx.lineTo(px + s*1.0, py + s*0.20/wf); ctx.lineTo(px + s*0.94, py + s*0.40); ctx.lineTo(px + s*0.98, py + s*0.56); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#0e0a18';                                                          // smoky body
      ctx.beginPath();
      ctx.moveTo(px + s*0.34, py + s*0.34); ctx.lineTo(px + s*0.66, py + s*0.34);
      for (let i=5;i>=0;i--){ const fx=px + s*0.34 + s*0.32*(i/5); const fy=py + s*0.92 + Math.sin(Date.now()/200+phase+i)*s*0.05; ctx.lineTo(fx, fy); }
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#2a1e40'; ctx.lineWidth = Math.max(1.5, s*0.03); ctx.lineCap='round';   // claws
      ctx.beginPath(); ctx.moveTo(px + s*0.34, py + s*0.52); ctx.lineTo(px + s*0.24, py + s*0.66); ctx.moveTo(px + s*0.66, py + s*0.52); ctx.lineTo(px + s*0.76, py + s*0.66); ctx.stroke(); ctx.lineCap='butt';
      ctx.fillStyle = '#0e0a18';                                                          // horns
      ctx.beginPath(); ctx.moveTo(px + s*0.40, py + s*0.20); ctx.lineTo(px + s*0.32, py + s*0.06); ctx.lineTo(px + s*0.48, py + s*0.18); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px + s*0.60, py + s*0.20); ctx.lineTo(px + s*0.68, py + s*0.06); ctx.lineTo(px + s*0.52, py + s*0.18); ctx.closePath(); ctx.fill();
      ctx.fillStyle = `rgba(180,120,255,${0.8+flap*0.2})`;                                 // eyes
      ctx.fillRect(px + s*0.40, py + s*0.26, s*0.06, s*0.04); ctx.fillRect(px + s*0.54, py + s*0.26, s*0.06, s*0.04);
      ctx.strokeStyle = `rgba(190,140,255,${0.6+flap*0.3})`; ctx.lineWidth = Math.max(1, s*0.025);   // grin
      ctx.beginPath(); ctx.arc(cx, py + s*0.34, s*0.08, 0.15*Math.PI, 0.85*Math.PI); ctx.stroke();
      break;
    }
    case 'nightwalker': {
      // A nightwalker — a towering, impossibly gaunt figure of absolute darkness that
      // radiates the void: long-limbed, a featureless head, two pinprick violet eyes,
      // wisps of unlight rising off it. The waste's apex horror.
      const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, s*0.6);
      aura.addColorStop(0, `rgba(90,50,160,${0.4+flap*0.2})`); aura.addColorStop(1, 'rgba(40,20,80,0)');
      ctx.fillStyle = aura; ctx.fillRect(sx - ts*0.15, sy - ts*0.15, ts*1.3, ts*1.3);
      ctx.fillStyle = '#080510';                                                          // long torso
      ctx.beginPath(); ctx.moveTo(px + s*0.38, py + s*0.28); ctx.lineTo(px + s*0.62, py + s*0.28); ctx.lineTo(px + s*0.58, py + s*0.88); ctx.lineTo(px + s*0.42, py + s*0.88); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#080510'; ctx.lineWidth = Math.max(2.5, s*0.06); ctx.lineCap='round';   // long arms
      ctx.beginPath();
      ctx.moveTo(px + s*0.38, py + s*0.34); ctx.lineTo(px + s*0.20, py + s*0.60); ctx.lineTo(px + s*0.16, py + s*0.90);
      ctx.moveTo(px + s*0.62, py + s*0.34); ctx.lineTo(px + s*0.80, py + s*0.60); ctx.lineTo(px + s*0.84, py + s*0.90);
      ctx.stroke(); ctx.lineCap='butt';
      ctx.fillStyle = '#080510'; ctx.fillRect(px + s*0.42, py + s*0.86, s*0.07, s*0.14); ctx.fillRect(px + s*0.51, py + s*0.86, s*0.07, s*0.14);   // legs
      ctx.fillStyle = '#05030a';
      ctx.beginPath(); ctx.ellipse(cx, py + s*0.20, s*0.13, s*0.17, 0, 0, Math.PI*2); ctx.fill();   // head
      ctx.fillStyle = `rgba(190,140,255,${0.85+flap*0.15})`;                              // pinprick eyes
      ctx.beginPath(); ctx.arc(cx - s*0.05, py + s*0.18, s*0.025, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + s*0.05, py + s*0.18, s*0.025, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = `rgba(120,80,200,${0.3+flap*0.3})`; ctx.lineWidth = Math.max(1, s*0.02);   // void wisps
      for (let i=0;i<3;i++){ const wx=0.3+i*0.2; ctx.beginPath(); ctx.moveTo(px + s*wx, py + s*0.6); ctx.lineTo(px + s*(wx+0.04*Math.sin(Date.now()/300+i)), py + s*0.3); ctx.stroke(); }
      break;
    }

    case 'magma_tyrant': {
      // A colossal molten titan — a hulking body of fissured black obsidian coursing
      // with lava, a crown of jagged basalt, and a white-hot maw. Boss: an orange
      // heat aura; cracks and eyes pulse.
      if (e.boss) {
        const auraR = s*0.62 + Math.sin(Date.now()/220)*s*0.04;
        const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, auraR);
        aura.addColorStop(0, 'rgba(255,110,30,0.42)'); aura.addColorStop(1, 'rgba(255,60,10,0)');
        ctx.fillStyle = aura; ctx.fillRect(cx-auraR, cy-auraR, auraR*2, auraR*2);
      }
      ctx.fillStyle = '#241410'; ctx.fillRect(px + s*0.30, py + s*0.68, s*0.16, s*0.24); ctx.fillRect(px + s*0.54, py + s*0.68, s*0.16, s*0.24);   // legs
      ctx.fillStyle = '#2a1a14';                                                          // torso
      ctx.beginPath();
      ctx.moveTo(px + s*0.22, py + s*0.72); ctx.lineTo(px + s*0.28, py + s*0.30); ctx.lineTo(px + s*0.50, py + s*0.20);
      ctx.lineTo(px + s*0.72, py + s*0.30); ctx.lineTo(px + s*0.78, py + s*0.72); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#3a241a'; ctx.beginPath(); ctx.moveTo(px + s*0.28, py + s*0.30); ctx.lineTo(px + s*0.50, py + s*0.20); ctx.lineTo(px + s*0.48, py + s*0.60); ctx.lineTo(px + s*0.30, py + s*0.62); ctx.closePath(); ctx.fill();
      const glow = 0.6 + flap*0.4;                                                        // molten cracks
      ctx.strokeStyle = `rgba(255,120,30,${glow})`; ctx.lineWidth = Math.max(2, s*0.05); ctx.lineCap='round';
      ctx.beginPath();
      ctx.moveTo(px + s*0.36, py + s*0.28); ctx.lineTo(px + s*0.44, py + s*0.48); ctx.lineTo(px + s*0.36, py + s*0.70);
      ctx.moveTo(px + s*0.62, py + s*0.30); ctx.lineTo(px + s*0.56, py + s*0.52); ctx.lineTo(px + s*0.64, py + s*0.70);
      ctx.moveTo(px + s*0.30, py + s*0.70); ctx.lineTo(px + s*0.70, py + s*0.70);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,225,120,${glow})`; ctx.lineWidth = Math.max(1, s*0.02); ctx.stroke(); ctx.lineCap='butt';
      ctx.fillStyle = '#241410'; ctx.beginPath(); ctx.arc(cx, py + s*0.22, s*0.15, 0, Math.PI*2); ctx.fill();   // head
      ctx.fillStyle = '#1a0e0a';                                                          // basalt crown
      [0.36,0.5,0.64].forEach(fx=>{ ctx.beginPath(); ctx.moveTo(px + s*fx, py + s*0.12); ctx.lineTo(px + s*(fx+0.02), py - s*0.02); ctx.lineTo(px + s*(fx+0.08), py + s*0.12); ctx.closePath(); ctx.fill(); });
      ctx.fillStyle = `rgba(255,235,150,${0.85+flap*0.15})`;                              // white-hot eyes
      ctx.fillRect(cx - s*0.09, py + s*0.20, s*0.06, s*0.05); ctx.fillRect(cx + s*0.03, py + s*0.20, s*0.06, s*0.05);
      ctx.fillStyle = `rgba(255,120,30,${glow})`; ctx.fillRect(cx - s*0.06, py + s*0.30, s*0.12, s*0.03);   // maw
      break;
    }
    case 'eclipse_sovereign': {
      // The Eclipse Sovereign — the final horror. A regal void-figure crowned before
      // a black sun ringed with a shifting corona, its robe woven of unlight, its
      // gaze two cold violet stars. Boss: a violet void aura + eclipse disc behind.
      if (e.boss) {
        const auraR = s*0.66 + Math.sin(Date.now()/220)*s*0.05;
        const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, auraR);
        aura.addColorStop(0, 'rgba(150,90,230,0.42)'); aura.addColorStop(1, 'rgba(80,40,140,0)');
        ctx.fillStyle = aura; ctx.fillRect(cx-auraR, cy-auraR, auraR*2, auraR*2);
      }
      ctx.fillStyle = '#050310';                                                          // black sun
      ctx.beginPath(); ctx.arc(cx, py + s*0.34, s*0.30, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = `rgba(180,130,255,${0.45+flap*0.4})`; ctx.lineWidth = Math.max(1.5, s*0.02);   // corona
      for (let i=0;i<12;i++){ const a=i*Math.PI/6 + Date.now()/1600; const r1=s*0.31, r2=s*0.31+s*0.06*(0.6+0.4*Math.sin(Date.now()/300+i));
        ctx.beginPath(); ctx.moveTo(cx+Math.cos(a)*r1, py+s*0.34+Math.sin(a)*r1); ctx.lineTo(cx+Math.cos(a)*r2, py+s*0.34+Math.sin(a)*r2); ctx.stroke(); }
      ctx.fillStyle = '#120b22';                                                          // robe
      ctx.beginPath(); ctx.moveTo(px + s*0.30, py + s*0.40); ctx.lineTo(px + s*0.70, py + s*0.40); ctx.lineTo(px + s*0.80, py + s*0.94); ctx.lineTo(px + s*0.20, py + s*0.94); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#1e1236'; ctx.beginPath(); ctx.moveTo(px + s*0.30, py + s*0.40); ctx.lineTo(px + s*0.50, py + s*0.40); ctx.lineTo(px + s*0.50, py + s*0.94); ctx.lineTo(px + s*0.20, py + s*0.94); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = `rgba(160,110,240,${0.5+flap*0.3})`; ctx.lineWidth = Math.max(1, s*0.02);   // trim
      ctx.beginPath(); ctx.moveTo(px + s*0.50, py + s*0.42); ctx.lineTo(px + s*0.50, py + s*0.92); ctx.stroke();
      ctx.fillStyle = '#080512';                                                          // hood/head void
      ctx.beginPath(); ctx.moveTo(px + s*0.34, py + s*0.40); ctx.lineTo(cx, py + s*0.12); ctx.lineTo(px + s*0.66, py + s*0.40); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#2a1a44';                                                          // jagged crown
      [0.36,0.44,0.5,0.56,0.64].forEach((fx,i)=>{ const th=(i===2?0.14:0.08); ctx.beginPath(); ctx.moveTo(px + s*fx, py + s*0.18); ctx.lineTo(px + s*(fx+0.02), py + s*(0.18-th)); ctx.lineTo(px + s*(fx+0.05), py + s*0.18); ctx.closePath(); ctx.fill(); });
      ctx.fillStyle = `rgba(190,140,255,${0.7+flap*0.3})`; ctx.fillRect(px + s*0.47, py + s*0.06, s*0.06, s*0.04);   // crown jewel
      ctx.fillStyle = `rgba(200,150,255,${0.85+flap*0.15})`;                              // star eyes
      ctx.beginPath(); ctx.arc(px + s*0.44, py + s*0.30, s*0.035, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + s*0.56, py + s*0.30, s*0.035, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(px + s*0.44, py + s*0.30, s*0.012, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + s*0.56, py + s*0.30, s*0.012, 0, Math.PI*2); ctx.fill();
      break;
    }
    default: {
      // Generic fallback: a stylized blob with eyes
      ctx.fillStyle = e.color;
      ctx.beginPath(); ctx.ellipse(cx, py + s*0.55, s*0.32, s*0.36, 0, 0, Math.PI*2); ctx.fill();
      // Highlight
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath(); ctx.ellipse(cx - s*0.10, py + s*0.42, s*0.12, s*0.10, 0, 0, Math.PI*2); ctx.fill();
      // Eyes
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(px + s*0.40, py + s*0.46, s*0.06, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + s*0.60, py + s*0.46, s*0.06, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(px + s*0.40, py + s*0.46, s*0.03, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + s*0.60, py + s*0.46, s*0.03, 0, Math.PI*2); ctx.fill();
    }
  }

  // ── HP bar — pill background with gradient fill ──────────────────────
  const barW = ts * e.size * 0.92;
  const barX = sx + ox + s * 0.04, barY = sy + oy - 8;
  const barH = 5;
  ctx.fillStyle = '#000';
  ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(barX, barY, barW, barH);
  const pct = Math.max(0, e.hp / e.maxHp);
  if (pct > 0) {
    const grad = ctx.createLinearGradient(barX, 0, barX + barW * pct, 0);
    if (pct > 0.5)      { grad.addColorStop(0, '#22aa22'); grad.addColorStop(1, '#66ee66'); }
    else if (pct > 0.25){ grad.addColorStop(0, '#cc8800'); grad.addColorStop(1, '#ffcc44'); }
    else                { grad.addColorStop(0, '#882222'); grad.addColorStop(1, '#ee4444'); }
    ctx.fillStyle = grad;
    ctx.fillRect(barX, barY, barW * pct, barH);
    // Specular line
    ctx.fillStyle = 'rgba(255,255,255,0.30)';
    ctx.fillRect(barX, barY, barW * pct, 1);
  }

  // Boss / elite name tag
  if (e.boss || e.hp > 80) {
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#000';
    ctx.strokeText(e.name, sx + ts / 2, barY - 3);
    ctx.fillStyle = e.boss ? '#ff66ff' : '#ffcc00';
    ctx.fillText(e.name, sx + ts / 2, barY - 3);
    ctx.textAlign = 'left';
  }

  ctx.restore();
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
    d.type === 'rupee'    ? '40,220,90'   :
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
  } else if (d.type === 'rupee') {
    // Hexagonal-ish green Zelda-style rupee
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
  const isTrans = (t) => t === T.CAVE_EXIT || t === T.CAVE_DESCENT;
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
// ─── Whirlpool suction overlay ────────────────────────────────────────────────
// Drawn after the tile pass so the churn can spill over the neighboring water
// tiles without being overdrawn: faint foam streamlines plus spray droplets
// being dragged from the 1-tile pull ring down into the eye. Telegraphs the
// grab radius of stepWhirlpoolPull.
function drawWhirlpoolSuction(col, row, s) {
  const cx = Math.floor((col - camC) * s) + s / 2;
  const cy = Math.floor((row - camR) * s) + s / 2;
  const t = Date.now() / 1000;
  ctx.save();
  // Three spiral streamlines winding from the pull ring into the funnel.
  ctx.strokeStyle = 'rgba(214,236,255,0.38)';
  ctx.lineWidth = Math.max(1, s * 0.05);
  for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    for (let i = 0; i <= 12; i++) {
      const f = i / 12;
      const ang = -t * 4 + k * (Math.PI * 2 / 3) + f * 2.6;
      const r = s * (1.45 - 1.05 * f);
      const px = cx + Math.cos(ang) * r, py = cy + Math.sin(ang) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  // Spray droplets caught in the current — each loops from rim to eye,
  // shrinking as it's pulled down.
  ctx.fillStyle = 'rgba(234,244,255,0.85)';
  for (let k = 0; k < 6; k++) {
    const f = (t * 0.55 + k / 6) % 1;
    const ang = -t * 4 + k * 2.3 + f * 3.2;
    const r = s * (1.5 - 1.25 * f);
    ctx.beginPath();
    ctx.arc(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r,
            Math.max(1, s * 0.06 * (1 - f * 0.6)), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

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
  for (let mr = startR; mr <= endR; mr++) {
    for (let mc = startC; mc <= endC; mc++) {
      if (mr < 0 || mr >= MROWS || mc < 0 || mc >= MCOLS) continue;
      if (map[mr][mc] === T.WHIRLPOOL) drawWhirlpoolSuction(mc, mr, ts);
    }
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
  for (let mr = startR - 1; mr <= endR + 4; mr++) {
    for (let mc = startC - 3; mc <= endC + 3; mc++) {
      if (mr < 0 || mr >= MROWS || mc < 0 || mc >= MCOLS) continue;
      if (map[mr][mc] === T.COLOSSAL_TREE && !isFoggy(mapObj, mc, mr)) drawColossalTree(mc, mr, ts);
    }
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

  // Radial inventory menu — drawn last so it's always on top
  if (typeof drawRadialMenu === 'function') drawRadialMenu();
}
