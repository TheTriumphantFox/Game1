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
    case T.DEEP_WATER:
      ctx.fillStyle = '#1a3388'; ctx.fillRect(x+2,y+s*0.4,s-4,3); break;
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
    case T.LARGE_CHEST: {
      const opened = currentMap().openedChests.has(`big_${col},${row}`);
      // Slight gold halo around it when closed
      if (!opened) {
        const pulse = Math.sin(Date.now()/300) * 2;
        const halo = ctx.createRadialGradient(x+s/2, y+s/2, 1, x+s/2, y+s/2, s*0.6 + pulse);
        halo.addColorStop(0, 'rgba(255,210,80,0.55)');
        halo.addColorStop(1, 'rgba(255,210,80,0)');
        ctx.fillStyle = halo;
        ctx.fillRect(x-s*0.2, y-s*0.2, s*1.4, s*1.4);
      }
      // Chest body — larger than the regular CHEST
      ctx.fillStyle = opened ? '#3a2210' : '#995500';
      ctx.fillRect(x+s*0.10, y+s*0.30, s*0.80, s*0.62);
      ctx.fillStyle = opened ? '#221406' : '#cc7700';
      ctx.fillRect(x+s*0.10, y+s*0.20, s*0.80, s*0.18);
      // Iron bands
      ctx.fillStyle = opened ? '#1a1106' : '#553300';
      ctx.fillRect(x+s*0.10, y+s*0.36, s*0.80, s*0.05);
      ctx.fillRect(x+s*0.10, y+s*0.75, s*0.80, s*0.05);
      ctx.fillRect(x+s/2-s*0.04, y+s*0.20, s*0.08, s*0.72);
      // Lock / star
      ctx.fillStyle = opened ? '#665533' : '#ffdd55';
      ctx.beginPath();
      ctx.arc(x+s/2, y+s/2+s*0.04, s*0.10, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = opened ? '#332211' : '#ffffff';
      ctx.fillRect(x+s/2-s*0.02, y+s/2-s*0.02, s*0.04, s*0.12);
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
  const bob = moving ? Math.round(Math.sin(Date.now() / 110) * 1) : 0;

  ctx.save();

  // Shadow ellipse
  ctx.fillStyle = 'rgba(0,0,0,0.40)';
  ctx.beginPath();
  ctx.ellipse(sx + s/2, sy + s*0.93, s*0.28, s*0.07, 0, 0, Math.PI*2);
  ctx.fill();

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

  ctx.restore();
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
  const glowColor = d.type === 'rupee' ? '40,220,90' : '255,120,160';
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
  // Exit markers
  ctx.fillStyle = '#ffff00'; ctx.font = '8px monospace'; ctx.textAlign = 'left';
  ctx.fillText('▶', mx+mw-6,                            my+Math.floor(EXIT_ROW*scale)+4);
  ctx.fillText('◀', mx+1,                               my+Math.floor(EXIT_ROW*scale)+4);
  ctx.textAlign = 'center';
  ctx.fillText('▲', mx+Math.floor(EXIT_COL*scale),      my+6);
  ctx.fillText('▼', mx+Math.floor(EXIT_COL*scale),      my+mh-1);

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
