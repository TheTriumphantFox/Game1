// ─── Rendering ────────────────────────────────────────────────────────────────
// Every frame: draw visible tiles, fog, projectiles, enemies, player,
// particles, damage numbers, exit arrows, and (toggleable) minimap.

// ─── Tile rendering ───────────────────────────────────────────────────────────
// Each tile type has a base color (from TILE_COLORS) and a switch case below
// that adds visual detail. `s` is the tile size in pixels (== TILE_PX).
function drawTile(col, row, t, sx, sy, s) {
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
      // Rocky cliff face — layered strata with cracks and a chiselled top-left
      // light edge. Jittered by tile coords so adjacent faces aren't identical.
      ctx.fillStyle = '#6a5f52'; ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#564c40'; ctx.fillRect(x, y,          s, s*0.18);
      ctx.fillStyle = '#7a6e5e'; ctx.fillRect(x, y + s*0.34, s, s*0.16);
      ctx.fillStyle = '#544a3e'; ctx.fillRect(x, y + s*0.62, s, s*0.18);
      const j = (col * 113 + row * 71) & 7;
      ctx.fillStyle = '#857a68';
      ctx.fillRect(x + (j % 4),  y + s*0.20, s*0.30, 2);
      ctx.fillRect(x + s*0.55,   y + s*0.50 + (j % 3), s*0.35, 2);
      ctx.fillStyle = '#3e362c';
      ctx.fillRect(x + s*0.45, y,          2, s);            // vertical crack
      ctx.fillRect(x + s*0.20, y + s*0.55, 2, s*0.40);
      ctx.fillStyle = 'rgba(220,210,190,0.22)';
      ctx.fillRect(x, y, s, 2); ctx.fillRect(x, y, 2, s);   // light edge
      break; }
    case T.PLATEAU: {
      // Sandstone mesa — warm banded strata with darker seams and a sunlit
      // top-left edge. Jittered by tile coords so a long band isn't uniform.
      ctx.fillStyle = '#b5743a'; ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#9c5f2e'; ctx.fillRect(x, y,          s, s*0.16);
      ctx.fillStyle = '#c8854a'; ctx.fillRect(x, y + s*0.32, s, s*0.18);
      ctx.fillStyle = '#8f5526'; ctx.fillRect(x, y + s*0.60, s, s*0.16);
      const jp = (col * 97 + row * 53) & 7;
      ctx.fillStyle = '#a96a32';
      ctx.fillRect(x + (jp % 4), y + s*0.22, s*0.34, 2);
      ctx.fillRect(x + s*0.5,    y + s*0.50 + (jp % 3), s*0.4, 2);
      ctx.fillStyle = '#6e421d';
      ctx.fillRect(x + s*0.5, y, 2, s);                      // vertical seam
      ctx.fillStyle = 'rgba(255,235,200,0.22)';
      ctx.fillRect(x, y, s, 2); ctx.fillRect(x, y, 2, s);   // sunlit edge
      break; }
    case T.CLIMB: {
      // A climbing ramp cut into the plateau — sandy track with carved foot-step
      // rungs so it reads as a way up/over the mesa.
      ctx.fillStyle = '#caa46a'; ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#a8814a'; ctx.fillRect(x + s*0.12, y, s*0.76, s);
      ctx.fillStyle = '#7a5a30';
      for (let i = 0; i < 4; i++) ctx.fillRect(x + s*0.14, y + s*(0.16 + i*0.22), s*0.72, 2);
      ctx.fillStyle = 'rgba(255,240,210,0.35)';
      ctx.fillRect(x + s*0.12, y, 2, s);
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
  }
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

    // Motion trail
    for (let i = 3; i >= 1; i--) {
      const tA = a - swingArc * 0.06 * i;
      ctx.globalAlpha = 0.10 * i;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(tA) * hilt, cy + Math.sin(tA) * hilt);
      ctx.lineTo(cx + Math.cos(tA) * len,  cy + Math.sin(tA) * len);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Blade with gradient
    const grad = ctx.createLinearGradient(baseX, baseY, tipX, tipY);
    grad.addColorStop(0, '#bdbdbd');
    grad.addColorStop(0.6, '#f0f0f0');
    grad.addColorStop(1, '#ffffff');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(baseX, baseY);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();

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
  const arrowElem = (d.type === 'arrows' && typeof SWORD_ELEMENTS !== 'undefined' && d.element)
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
  } else if (trophy || d.type === 'potion' || d.type === 'arrows' || d.type === 'mushroom' || d.type === 'bonemeal') {
    // Trophy items + potion + arrow bundle + mushroom + bone meal: render as a
    // glyph centered on the tile. Arrow drops show the elemental icon and the
    // count; the rest show their thematic icon.
    const icon =
      d.type === 'arrows'   ? (arrowElem ? arrowElem.icon : '🏹') :
      d.type === 'potion'   ? '🧪' :
      d.type === 'mushroom' ? '🍄' :
      d.type === 'bonemeal' ? '🧂' :
      trophy.icon;
    const size = Math.round(ts * 0.42 * pulse);
    ctx.font = `${size}px serif`;
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
    // Elemental arrows get a trailing spark
    if (p.element) {
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(sx - nx*len*1.3, sy - ny*len*1.3, 2, 0, Math.PI*2); ctx.fill();
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
    // Enemy projectile (magic ball)
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

function render() {
  ctx.clearRect(0, 0, PW, PH);
  const ts = TILE_PX;
  const map = mapData();
  const mapObj = currentMap();

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
  enemies.filter(e => !e.dead).forEach(e => {
    if (!isFoggy(mapObj, e.x, e.y)) drawEnemy(e, ts);
  });
  if (typeof villagers !== 'undefined') {
    villagers.forEach(v => {
      if (!isFoggy(mapObj, v.x, v.y)) drawVillager(v, ts);
    });
  }
  drawPlayer(ts);

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
    ctx.font = `bold ${Math.round(ts * 0.35)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(d.val, sp.x, y);
  });
  ctx.textAlign = 'left';
  ctx.restore();

  if (showMinimap) drawMinimap();

  // Radial inventory menu — drawn last so it's always on top
  if (typeof drawRadialMenu === 'function') drawRadialMenu();
}
