// ─── Tile procedural drawing ──────────────────────────────────────────────────
// drawTileProcedural + drawColossalTree + drawWhirlpoolSuction, split out of
// render.js (these three are ~half the file). Plain <script> globals, no module
// system — loaded before render.js in index.html. See render.js for render().

// Each tile type has a base color (from TILE_COLORS) and a switch case below
// that adds visual detail. `s` is the tile size in pixels (== TILE_PX).
//
// This is the procedural path: it issues the tile's raw canvas calls. For pure
// tiles it's invoked once by buildTileSprite to populate the cache; the thin
// drawTile() wrapper above blits that cache thereafter. Animated / hashed /
// autotiled / stateful tiles reach here every frame.
// When true, drawTileProcedural is running as the enlarged-landmark overlay pass
// (see drawBigLandmark): the region's signature open-ground landmarks skip their
// flat ground fill and draw only their object art (which the overlay has scaled up
// ~2.6× about its foot), so the giant sits on the real clearing floor drawn by the
// normal tile pass instead of over a stamped square of its own base colour. Default
// false — the normal tile pass and the sprite cache draw landmarks ground-only.
let landmarkOverlayPass = false;

function drawTileProcedural(col, row, t, sx, sy, s) {
  const x = sx, y = sy;
  if (!landmarkOverlayPass) {                 // overlay pass paints no base square
    ctx.fillStyle = TILE_COLORS[t] || '#111';
    ctx.fillRect(x, y, s, s);
  }

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
      if (!landmarkOverlayPass) { ctx.fillStyle = '#f4ead0'; ctx.fillRect(x, y, s, s); break; }
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
      if (!landmarkOverlayPass) { ctx.fillStyle = '#352637'; ctx.fillRect(x, y, s, s); break; }   // blight base
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
      if (!landmarkOverlayPass) {
        ctx.fillStyle = '#3a7a3a'; ctx.fillRect(x, y, s, s);           // grass base
        ctx.fillStyle = '#3d7530'; ctx.fillRect(x+2, y+3, 4, 2); ctx.fillRect(x+s-6, y+s-5, 4, 2);
        break; }
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
      if (!landmarkOverlayPass) { ctx.fillStyle = '#d4b070'; ctx.fillRect(x, y, s, s); break; }   // sand base
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
      if (!landmarkOverlayPass) { ctx.fillStyle = '#d4b070'; ctx.fillRect(x, y, s, s); break; }   // sand base
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
      if (!landmarkOverlayPass) { ctx.fillStyle = '#e4ecf2'; ctx.fillRect(x, y, s, s); break; }   // snow base
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
      if (!landmarkOverlayPass) {
        ctx.fillStyle = '#8a8174'; ctx.fillRect(x, y, s, s);           // scree base
        ctx.fillStyle = '#766d61'; ctx.fillRect(x+s*0.18, y+s*0.20, 3, 2); ctx.fillRect(x+s*0.66, y+s*0.74, 3, 2);   // rubble flecks
        break; }
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
      if (!landmarkOverlayPass) { ctx.fillStyle = '#dde6f2'; ctx.fillRect(x, y, s, s); break; }   // cloud base
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
      if (!landmarkOverlayPass) { ctx.fillStyle = '#313749'; ctx.fillRect(x, y, s, s); break; }   // storm floor base
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
      if (!landmarkOverlayPass) { ctx.fillStyle = '#4a3b34'; ctx.fillRect(x, y, s, s); break; }   // caldera base
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
      if (!landmarkOverlayPass) { ctx.fillStyle = '#241d33'; ctx.fillRect(x, y, s, s); break; }   // umbral base
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

// ─── Enlarged open-ground landmark overlay ──────────────────────────────────
// The elemental / non-forest regions' answer to the mana forest's colossal trees:
// every region's signature open-ground landmark (mossy boulder, sandstone obelisk,
// ice/cloud/storm/obsidian spire, standing stone, shadow monolith, tombstone, light
// pillar, driftwood) is placed on a tile whose whole 8-neighbourhood is open ground
// (see addRegionLandmarks / addTombstones / addLightPillars), so it can be drawn HERE
// blown up ~2.6× about its foot into a multi-tile giant that overhangs the clearing.
// Like drawColossalTree this runs after the entity pass so the hero and enemies walk
// BEHIND the overhang. It re-issues the landmark's own tile art via drawTileProcedural
// with landmarkOverlayPass set, so the object is drawn (scaled) without its flat
// ground square — the base tile itself already rendered as plain clearing floor.
// The poison FALLEN_LOG keeps its own seamless multi-tile run and is not enlarged here.
const BIG_LANDMARK_SCALE = 3.0;   // ~2.5-tile-tall giants, matching the colossal trees
function drawBigLandmark(tile, col, row, ts) {
  const s = ts;
  const x = (col - camC) * s;
  const y = (row - camR) * s;
  const baseX = x + s * 0.5, baseY = y + s * 0.9;   // planted at the landmark's foot
  ctx.save();
  ctx.translate(baseX, baseY);
  ctx.scale(BIG_LANDMARK_SCALE, BIG_LANDMARK_SCALE);
  ctx.translate(-baseX, -baseY);
  landmarkOverlayPass = true;
  try { drawTileProcedural(col, row, tile, x, y, s); }
  finally { landmarkOverlayPass = false; }
  ctx.restore();
}

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
