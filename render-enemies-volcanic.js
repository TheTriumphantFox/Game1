// Volcanic creatures and their boss. Reached through ENEMY_ART (render-enemies.js),
// which also draws what every creature shares: shadow, auras, HP bar and name tag.

function drawVolcanicCreature(e, ts, s, px, py, cx, cy, flap, phase, fb, bob, boxTop) {
  switch (e.type) {
    // ─── Volcanic region ───────────────────────────────────────────────
    case 'magmin': {
      const facing = creatureFacing(e);
      if (facing === 'up') {
        // Back: the same rock lump, legs and glowing cracks, a spined back, heat still
        // rising off the back of the head. No face.
        const ga = ctx.createRadialGradient(cx, cy, 0, cx, cy, s*0.5);
        ga.addColorStop(0, `rgba(255,120,30,${0.32+flap*0.22})`); ga.addColorStop(1, 'rgba(255,60,10,0)');
        ctx.fillStyle = ga; ctx.fillRect(fb.x - s*0.1, fb.y - s*0.1, s*1.2, s*1.2);
        ctx.fillStyle = '#2a1206';
        ctx.beginPath(); ctx.arc(cx, py + s*0.58, s*0.26, 0, Math.PI*2); ctx.fill();       // body
        ctx.fillRect(px + s*0.24, py + s*0.72, s*0.16, s*0.20); ctx.fillRect(px + s*0.60, py + s*0.72, s*0.16, s*0.20);   // legs
        ctx.fillStyle = '#3a1a0a';                                                        // broad back plate
        ctx.beginPath(); ctx.arc(cx, py + s*0.58, s*0.20, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#2a1206';                                                        // spine plates
        [0.44,0.56,0.68].forEach(fy => { ctx.beginPath(); ctx.moveTo(cx - s*0.07, py + s*fy); ctx.lineTo(cx, py + s*(fy-0.08)); ctx.lineTo(cx + s*0.07, py + s*fy); ctx.closePath(); ctx.fill(); });
        ctx.strokeStyle = `rgba(255,140,40,${0.6+flap*0.4})`; ctx.lineWidth = Math.max(1.5, s*0.05); ctx.lineCap='round';   // lava cracks down the spine
        ctx.beginPath();
        ctx.moveTo(cx, py + s*0.40); ctx.lineTo(cx, py + s*0.74);
        ctx.moveTo(cx - s*0.14, py + s*0.50); ctx.lineTo(cx - s*0.06, py + s*0.62);
        ctx.moveTo(cx + s*0.14, py + s*0.52); ctx.lineTo(cx + s*0.06, py + s*0.64);
        ctx.stroke(); ctx.lineCap='butt';
        ctx.fillStyle = '#2a1206';
        ctx.beginPath(); ctx.arc(cx, py + s*0.32, s*0.17, 0, Math.PI*2); ctx.fill();        // back of the head
        ctx.fillStyle = '#3a1a0a';
        ctx.beginPath(); ctx.arc(cx, py + s*0.34, s*0.11, 0, Math.PI*2); ctx.fill();       // the skull, lit from within
        ctx.fillStyle = `rgba(255,140,40,${0.55+flap*0.35})`;                             // heat rising off the head
        [-0.10,-0.035,0.03].forEach((fx,i) => { const fl=Math.sin(Date.now()/140+i+phase)*s*0.04;
          ctx.beginPath(); ctx.moveTo(cx + s*fx, py + s*0.22); ctx.lineTo(cx + s*(fx+0.035), py + s*0.02 + fl); ctx.lineTo(cx + s*(fx+0.07), py + s*0.22); ctx.closePath(); ctx.fill(); });
        break;
      }
      if (facing !== 'down') {
        // Side, drawn facing right: a narrower lump, one leg, one eye, the mouth
        // jutting right, cracks on the near flank, heat off the back of the head.
        ctx.save();
        mirrorIfLeft(facing, cx);
        const ga = ctx.createRadialGradient(cx, cy, 0, cx, cy, s*0.5);
        ga.addColorStop(0, `rgba(255,120,30,${0.32+flap*0.22})`); ga.addColorStop(1, 'rgba(255,60,10,0)');
        ctx.fillStyle = ga; ctx.fillRect(fb.x - s*0.1, fb.y - s*0.1, s*1.2, s*1.2);
        ctx.fillStyle = '#2a1206';
        ctx.beginPath(); ctx.ellipse(cx - s*0.04, py + s*0.58, s*0.18, s*0.26, 0, 0, Math.PI*2); ctx.fill();   // body
        ctx.fillRect(px + s*0.42, py + s*0.72, s*0.16, s*0.20);                                              // near leg
        ctx.strokeStyle = `rgba(255,140,40,${0.6+flap*0.4})`; ctx.lineWidth = Math.max(1.5, s*0.05); ctx.lineCap='round';   // lava cracks
        ctx.beginPath();
        ctx.moveTo(cx - s*0.10, py + s*0.48); ctx.lineTo(cx - s*0.02, py + s*0.60); ctx.lineTo(cx - s*0.08, py + s*0.70);
        ctx.stroke(); ctx.lineCap='butt';
        ctx.fillStyle = '#2a1206';
        ctx.beginPath(); ctx.arc(px + s*0.56, py + s*0.32, s*0.16, 0, Math.PI*2); ctx.fill();  // head
        ctx.fillStyle = `rgba(255,210,80,${0.75+flap*0.25})`;
        ctx.fillRect(px + s*0.60, py + s*0.30, s*0.06, s*0.05);                                // one eye
        ctx.fillStyle = '#ff6a1e'; ctx.fillRect(px + s*0.64, py + s*0.40, s*0.08, s*0.03);     // mouth
        ctx.fillStyle = `rgba(255,140,40,${0.5+flap*0.3})`;                                   // heat off the back
        const fl = Math.sin(Date.now()/140+phase)*s*0.03;
        ctx.beginPath(); ctx.moveTo(px + s*0.40, py + s*0.20); ctx.lineTo(px + s*0.43, py + s*0.06 + fl); ctx.lineTo(px + s*0.46, py + s*0.20); ctx.closePath(); ctx.fill();
        ctx.restore();
        break;
      }
      // A small molten imp — a lump of cracked black rock lit from within by lava,
      // trailing heat, with two burning eyes. Fiery aura pulse.
      const ga = ctx.createRadialGradient(cx, cy, 0, cx, cy, s*0.5);
      ga.addColorStop(0, `rgba(255,120,30,${0.32+flap*0.22})`); ga.addColorStop(1, 'rgba(255,60,10,0)');
      ctx.fillStyle = ga; ctx.fillRect(fb.x - s*0.1, fb.y - s*0.1, s*1.2, s*1.2);
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
      const facing = creatureFacing(e);
      if (facing === 'up') {
        // Back: the coil seen from behind with the tail tip nearest, a ridge of hot
        // scales down the spine, and the back of the head beyond. No face.
        const gu = ctx.createRadialGradient(cx, cy, 0, cx, cy, s*0.5);
        gu.addColorStop(0, `rgba(255,110,30,${0.28+flap*0.2})`); gu.addColorStop(1, 'rgba(255,60,10,0)');
        ctx.fillStyle = gu; ctx.fillRect(fb.x - s*0.1, fb.y - s*0.1, s*1.2, s*1.2);
        ctx.strokeStyle = '#b8300f'; ctx.lineWidth = Math.max(3, s*0.14); ctx.lineCap='round';
        ctx.beginPath();
        ctx.moveTo(px + s*0.26, py + s*0.86);
        ctx.quadraticCurveTo(px + s*0.84, py + s*0.78, cx, py + s*0.56);
        ctx.quadraticCurveTo(px + s*0.18, py + s*0.44, cx, py + s*0.32);
        ctx.stroke();
        ctx.strokeStyle = `rgba(255,150,50,${0.7+flap*0.3})`; ctx.lineWidth = Math.max(1.5, s*0.06); ctx.stroke();
        ctx.fillStyle = `rgba(255,150,50,${0.7+flap*0.3})`;                                  // ridge of hot scales
        [[0.34,0.80],[0.60,0.66],[0.42,0.48],[0.56,0.36]].forEach(([fx,fy]) => { ctx.beginPath(); ctx.moveTo(px + s*fx, py + s*fy); ctx.lineTo(px + s*(fx+0.05), py + s*(fy-0.10)); ctx.lineTo(px + s*(fx+0.10), py + s*fy); ctx.closePath(); ctx.fill(); });
        ctx.strokeStyle = '#b8300f'; ctx.lineWidth = Math.max(2, s*0.06);                    // tail tip, nearest the viewer
        ctx.beginPath(); ctx.moveTo(px + s*0.26, py + s*0.84); ctx.lineTo(px + s*0.12, py + s*0.72); ctx.stroke();
        ctx.lineCap='butt';
        ctx.fillStyle = '#b8300f';                                                          // back of the head
        ctx.beginPath(); ctx.ellipse(cx, py + s*0.28, s*0.15, s*0.12, 0, 0, Math.PI*2); ctx.fill();
        break;
      }
      if (facing === 'down') {
        // Front: the coil rising to a head squared to the viewer, both eyes, the
        // tongue flicking down the middle.
        const gf = ctx.createRadialGradient(cx, cy, 0, cx, cy, s*0.5);
        gf.addColorStop(0, `rgba(255,110,30,${0.28+flap*0.2})`); gf.addColorStop(1, 'rgba(255,60,10,0)');
        ctx.fillStyle = gf; ctx.fillRect(fb.x - s*0.1, fb.y - s*0.1, s*1.2, s*1.2);
        ctx.strokeStyle = '#b8300f'; ctx.lineWidth = Math.max(3, s*0.14); ctx.lineCap='round';
        ctx.beginPath();
        ctx.moveTo(px + s*0.20, py + s*0.86);
        ctx.quadraticCurveTo(px + s*0.86, py + s*0.80, cx, py + s*0.58);
        ctx.quadraticCurveTo(px + s*0.16, py + s*0.46, cx, py + s*0.34);
        ctx.stroke();
        ctx.strokeStyle = `rgba(255,150,50,${0.7+flap*0.3})`; ctx.lineWidth = Math.max(1.5, s*0.06); ctx.stroke();
        ctx.lineCap='butt';
        ctx.fillStyle = '#d23a12';                                                          // head on
        ctx.beginPath(); ctx.ellipse(cx, py + s*0.28, s*0.17, s*0.13, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#ffdf6a'; ctx.fillRect(cx - s*0.10, py + s*0.24, s*0.05, s*0.04); ctx.fillRect(cx + s*0.05, py + s*0.24, s*0.05, s*0.04);
        ctx.fillStyle = '#000'; ctx.fillRect(cx - s*0.08, py + s*0.25, s*0.02, s*0.02); ctx.fillRect(cx + s*0.06, py + s*0.25, s*0.02, s*0.02);
        ctx.strokeStyle = `rgba(255,200,60,${0.7+flap*0.3})`; ctx.lineWidth = Math.max(1, s*0.025);   // forked tongue
        ctx.beginPath();
        ctx.moveTo(cx, py + s*0.36); ctx.lineTo(cx, py + s*0.44);
        ctx.moveTo(cx, py + s*0.44); ctx.lineTo(cx - s*0.05, py + s*0.50);
        ctx.moveTo(cx, py + s*0.44); ctx.lineTo(cx + s*0.05, py + s*0.50);
        ctx.stroke();
        break;
      }
      // Side. This was always the fire snake's only view, drawn facing right.
      ctx.save();
      mirrorIfLeft(facing, cx);
      // A serpent of living fire — a coiling ember body brightening toward a flat
      // viper head with a glowing forked tongue. Heat shimmer.
      const ga = ctx.createRadialGradient(cx, cy, 0, cx, cy, s*0.5);
      ga.addColorStop(0, `rgba(255,110,30,${0.28+flap*0.2})`); ga.addColorStop(1, 'rgba(255,60,10,0)');
      ctx.fillStyle = ga; ctx.fillRect(fb.x - s*0.1, fb.y - s*0.1, s*1.2, s*1.2);
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
      ctx.restore();
      break;
    }
    case 'azer': {
      const facing = creatureFacing(e);
      if (facing === 'up') {
        // Back: the same squat back, cross-strapped apron, the flame crest still
        // burning above the back of the head, hammer carried on the other side.
        ctx.fillStyle = '#7a4a1c'; ctx.fillRect(px + s*0.30, py + s*0.70, s*0.14, s*0.22); ctx.fillRect(px + s*0.52, py + s*0.70, s*0.14, s*0.22);   // legs
        ctx.fillStyle = '#5a3414'; ctx.fillRect(px + s*0.28, py + s*0.54, s*0.40, s*0.22);   // apron, seen from behind
        ctx.fillStyle = '#c78a34'; ctx.fillRect(px + s*0.30, py + s*0.38, s*0.36, s*0.24);   // brass back
        ctx.fillStyle = '#e2ab54'; ctx.fillRect(px + s*0.48, py + s*0.38, s*0.18, s*0.24);   // light falls the other way
        ctx.strokeStyle = '#7a4a1c'; ctx.lineWidth = Math.max(2, s*0.05);                    // cross straps
        ctx.beginPath();
        ctx.moveTo(px + s*0.32, py + s*0.40); ctx.lineTo(px + s*0.66, py + s*0.60);
        ctx.moveTo(px + s*0.66, py + s*0.40); ctx.lineTo(px + s*0.32, py + s*0.60);
        ctx.stroke();
        ctx.fillStyle = '#c78a34';
        ctx.beginPath(); ctx.arc(cx, py + s*0.28, s*0.15, 0, Math.PI*2); ctx.fill();          // back of the head
        ctx.fillStyle = `rgba(255,140,30,${0.7+flap*0.3})`;                                  // crest of live flame
        [0.36,0.46,0.56].forEach((fx,i) => { const fl=Math.sin(Date.now()/110+i+phase)*s*0.03;
          ctx.beginPath(); ctx.moveTo(px + s*fx, py + s*0.16); ctx.lineTo(px + s*(fx+0.03), py + s*0.0 + fl); ctx.lineTo(px + s*(fx+0.06), py + s*0.16); ctx.closePath(); ctx.fill(); });
        ctx.strokeStyle = '#5a3414'; ctx.lineWidth = Math.max(2, s*0.05); ctx.beginPath(); ctx.moveTo(px + s*0.22, py + s*0.24); ctx.lineTo(px + s*0.22, py + s*0.80); ctx.stroke();   // hammer haft, other hand
        ctx.fillStyle = '#8a8078'; ctx.fillRect(px + s*0.12, py + s*0.16, s*0.20, s*0.14);   // hammer head
        break;
      }
      if (facing !== 'down') {
        // Side, drawn facing right: one leg, one eye, the flame beard in profile,
        // the hammer swung forward.
        ctx.save();
        mirrorIfLeft(facing, cx);
        ctx.fillStyle = '#7a4a1c'; ctx.fillRect(px + s*0.42, py + s*0.70, s*0.14, s*0.22);   // near leg
        ctx.fillStyle = '#5a3414'; ctx.fillRect(px + s*0.36, py + s*0.54, s*0.26, s*0.22);   // apron
        ctx.fillStyle = '#c78a34'; ctx.fillRect(px + s*0.38, py + s*0.38, s*0.24, s*0.24);   // brass side
        ctx.fillStyle = '#c78a34';
        ctx.beginPath(); ctx.arc(px + s*0.54, py + s*0.28, s*0.14, 0, Math.PI*2); ctx.fill();  // head in profile
        ctx.fillStyle = `rgba(255,140,30,${0.7+flap*0.3})`;                                  // flame beard, in profile
        [0.52,0.60].forEach((fx,i) => { const fl=Math.sin(Date.now()/110+i+phase)*s*0.03;
          ctx.beginPath(); ctx.moveTo(px + s*fx, py + s*0.36); ctx.lineTo(px + s*(fx+0.03), py + s*0.50 + fl); ctx.lineTo(px + s*(fx+0.06), py + s*0.36); ctx.closePath(); ctx.fill(); });
        ctx.beginPath(); ctx.moveTo(px + s*0.44, py + s*0.16); ctx.lineTo(px + s*0.52, py + s*0.0); ctx.lineTo(px + s*0.60, py + s*0.16); ctx.closePath(); ctx.fill();   // crest
        ctx.fillStyle = '#ffe070'; ctx.fillRect(px + s*0.60, py + s*0.26, s*0.05, s*0.04);    // one eye
        ctx.fillStyle = '#c78a34'; ctx.fillRect(px + s*0.56, py + s*0.42, s*0.20, s*0.06);    // near arm, forward
        ctx.strokeStyle = '#5a3414'; ctx.lineWidth = Math.max(2, s*0.05); ctx.beginPath(); ctx.moveTo(px + s*0.76, py + s*0.30); ctx.lineTo(px + s*0.76, py + s*0.78); ctx.stroke();   // hammer haft
        ctx.fillStyle = '#8a8078'; ctx.fillRect(px + s*0.68, py + s*0.20, s*0.18, s*0.13);    // hammer head, carried forward
        ctx.restore();
        break;
      }
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
      const facing = creatureFacing(e);
      if (facing === 'up') {
        // Back: both wings spread from behind, a ridged back, the horned head beyond
        // and the tail coming down the middle toward the viewer. No face, no breath.
        const dwb = Math.sin(Date.now()/120 + phase) * 0.2 + 1;
        ctx.fillStyle = '#a02010';
        ctx.beginPath(); ctx.moveTo(cx - s*0.10, py + s*0.44); ctx.lineTo(px + s*0.04, py + s*0.22/dwb); ctx.lineTo(px + s*0.18, py + s*0.62); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(cx + s*0.10, py + s*0.44); ctx.lineTo(px + s*0.96, py + s*0.22/dwb); ctx.lineTo(px + s*0.82, py + s*0.62); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#c8341c';
        ctx.beginPath(); ctx.ellipse(cx, py + s*0.56, s*0.20, s*0.26, 0, 0, Math.PI*2); ctx.fill();   // back
        ctx.fillStyle = '#a02010';                                                                  // spine ridge
        [0.42,0.54,0.66].forEach(fy => { ctx.beginPath(); ctx.moveTo(cx - s*0.06, py + s*fy); ctx.lineTo(cx, py + s*(fy-0.08)); ctx.lineTo(cx + s*0.06, py + s*fy); ctx.closePath(); ctx.fill(); });
        ctx.fillStyle = '#c8341c';
        ctx.beginPath(); ctx.arc(cx, py + s*0.28, s*0.16, 0, Math.PI*2); ctx.fill();                 // back of the head
        ctx.fillStyle = '#5a1408';                                                                  // horns
        ctx.beginPath(); ctx.moveTo(px + s*0.42, py + s*0.16); ctx.lineTo(px + s*0.32, py + s*0.04); ctx.lineTo(px + s*0.48, py + s*0.14); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(px + s*0.58, py + s*0.16); ctx.lineTo(px + s*0.68, py + s*0.04); ctx.lineTo(px + s*0.52, py + s*0.14); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#c8341c'; ctx.lineWidth = Math.max(2, s*0.07);
        ctx.beginPath(); ctx.moveTo(cx, py + s*0.80); ctx.lineTo(cx + Math.sin(Date.now()/180+phase)*s*0.10, py + s); ctx.stroke();   // tail, nearest
        break;
      }
      if (facing !== 'down') {
        // Side, drawn facing right: one edge-on wing, a narrower body, one horn and
        // one eye, the snout and a spark of breath out to the right, tail behind.
        ctx.save();
        mirrorIfLeft(facing, cx);
        const dws = Math.sin(Date.now()/120 + phase) * 0.2 + 1;
        ctx.fillStyle = '#a02010';
        ctx.beginPath(); ctx.moveTo(cx - s*0.02, py + s*0.44); ctx.lineTo(px + s*0.22, py + s*0.22/dws); ctx.lineTo(px + s*0.32, py + s*0.58); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#c8341c';
        ctx.beginPath(); ctx.ellipse(cx - s*0.02, py + s*0.56, s*0.16, s*0.26, 0, 0, Math.PI*2); ctx.fill();   // body
        ctx.strokeStyle = '#c8341c'; ctx.lineWidth = Math.max(2, s*0.06);
        ctx.beginPath(); ctx.moveTo(cx - s*0.10, py + s*0.74); ctx.lineTo(px + s*0.10 + Math.sin(Date.now()/180+phase)*s*0.08, py + s); ctx.stroke();   // tail behind
        ctx.fillStyle = '#e0492a';
        ctx.beginPath(); ctx.arc(px + s*0.58, py + s*0.30, s*0.15, 0, Math.PI*2); ctx.fill();       // head
        ctx.fillRect(px + s*0.66, py + s*0.30, s*0.12, s*0.07);                                    // snout
        ctx.fillStyle = '#5a1408';
        ctx.beginPath(); ctx.moveTo(px + s*0.52, py + s*0.18); ctx.lineTo(px + s*0.42, py + s*0.04); ctx.lineTo(px + s*0.58, py + s*0.16); ctx.closePath(); ctx.fill();   // one horn
        ctx.fillStyle = '#ffd23a'; ctx.fillRect(px + s*0.60, py + s*0.26, s*0.05, s*0.04);
        ctx.fillStyle = '#000'; ctx.fillRect(px + s*0.62, py + s*0.27, s*0.02, s*0.03);
        ctx.fillStyle = `rgba(255,170,50,${0.5+flap*0.4})`;
        ctx.beginPath(); ctx.arc(px + s*0.84, py + s*0.36, s*0.06, 0, Math.PI*2); ctx.fill();       // breath spark
        ctx.restore();
        break;
      }
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
      const facing = creatureFacing(e);
      if (facing === 'up') {
        // Back: the same column of fire, but the white-hot core sits on the face
        // side, so from behind it reads darker, with embers drifting off the back.
        const t = Date.now();
        const wb = Math.sin(t/220 + phase)*s*0.05, wc = Math.sin(t/170 + phase)*s*0.05;
        ctx.fillStyle = '#b8300f';
        ctx.beginPath();
        ctx.moveTo(px + s*0.16, py + s*0.92);
        ctx.quadraticCurveTo(px + s*0.14 + wb, py + s*0.46, cx - s*0.04 + wb, py + s*0.02);
        ctx.quadraticCurveTo(px + s*0.84 + wb, py + s*0.50, px + s*0.84, py + s*0.92);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ff6a1e';
        ctx.beginPath();
        ctx.moveTo(px + s*0.24, py + s*0.92);
        ctx.quadraticCurveTo(px + s*0.22 + wc, py + s*0.50, cx + s*0.04 + wc, py + s*0.16);
        ctx.quadraticCurveTo(px + s*0.76 + wc, py + s*0.54, px + s*0.76, py + s*0.92);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffb038';
        ctx.beginPath();
        ctx.moveTo(px + s*0.34, py + s*0.92);
        ctx.quadraticCurveTo(px + s*0.32 - wc, py + s*0.56, cx - s*0.06 - wc, py + s*0.30);
        ctx.quadraticCurveTo(px + s*0.64 - wc, py + s*0.60, px + s*0.64, py + s*0.92);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = `rgba(255,176,56,${0.6+flap*0.4})`;                        // embers off the back
        [[0.24,0.30],[0.34,0.14],[0.20,0.06]].forEach(([fx,fy],i) => {
          const rise = (t/700 + i/3) % 1;
          ctx.fillRect(px + s*(fx + Math.sin(t/300+i+phase)*0.03), py + s*(fy + 0.5 - rise*0.5), s*0.04, s*0.04);
        });
        break;
      }
      if (facing !== 'down') {
        // Side, drawn facing right: a narrower column leaning right, the core and the
        // single dark eye on the face side, embers trailing off the back.
        ctx.save();
        mirrorIfLeft(facing, cx);
        const t = Date.now();
        const wb = Math.sin(t/220 + phase)*s*0.05, wc = Math.sin(t/170 + phase)*s*0.05;
        ctx.fillStyle = '#b8300f';
        ctx.beginPath(); ctx.moveTo(px + s*0.22, py + s*0.92); ctx.quadraticCurveTo(px + s*0.20 + wb, py + s*0.46, px + s*0.58 + wb, py + s*0.04); ctx.quadraticCurveTo(px + s*0.78 + wb, py + s*0.52, px + s*0.78, py + s*0.92); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ff6a1e';
        ctx.beginPath(); ctx.moveTo(px + s*0.30, py + s*0.92); ctx.quadraticCurveTo(px + s*0.30 + wc, py + s*0.50, px + s*0.62 + wc, py + s*0.20); ctx.quadraticCurveTo(px + s*0.72 + wc, py + s*0.56, px + s*0.70, py + s*0.92); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffb038';
        ctx.beginPath(); ctx.moveTo(px + s*0.46, py + s*0.92); ctx.quadraticCurveTo(px + s*0.50 - wc, py + s*0.62, px + s*0.60 - wc, py + s*0.38); ctx.quadraticCurveTo(px + s*0.68 - wc, py + s*0.66, px + s*0.66, py + s*0.92); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffe79a';
        ctx.beginPath(); ctx.moveTo(px + s*0.52, py + s*0.92); ctx.quadraticCurveTo(px + s*0.56, py + s*0.72, px + s*0.62, py + s*0.54); ctx.quadraticCurveTo(px + s*0.68, py + s*0.74, px + s*0.64, py + s*0.92); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#2a0a04';
        ctx.beginPath(); ctx.arc(px + s*0.62, py + s*0.44, s*0.045, 0, Math.PI*2); ctx.fill();   // one eye
        ctx.fillStyle = `rgba(255,176,56,${0.6+flap*0.4})`;                        // embers off the back
        [[0.26,0.30],[0.20,0.14]].forEach(([fx,fy],i) => {
          const rise = (t/700 + i/2) % 1;
          ctx.fillRect(px + s*(fx + Math.sin(t/300+i+phase)*0.03), py + s*(fy + 0.5 - rise*0.5), s*0.04, s*0.04);
        });
        ctx.restore();
        break;
      }
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
      const facing = creatureFacing(e);
      if (facing === 'up') {
        // Back: both pairs of wing from behind, a ridged back with the heat of the
        // throat showing through it, the horned crest beyond, tail coming at you.
        const dwb = Math.sin(Date.now()/130 + phase) * 0.18 + 1;
        ctx.fillStyle = '#8a1808';
        ctx.beginPath(); ctx.moveTo(cx - s*0.14, py + s*0.40); ctx.lineTo(px - s*0.02, py + s*0.26/dwb); ctx.lineTo(px + s*0.14, py + s*0.66); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(cx + s*0.14, py + s*0.40); ctx.lineTo(px + s*1.02, py + s*0.26/dwb); ctx.lineTo(px + s*0.86, py + s*0.66); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#a82212';
        ctx.beginPath(); ctx.moveTo(cx - s*0.12, py + s*0.42); ctx.lineTo(px + s*0.06, py + s*0.32/dwb); ctx.lineTo(px + s*0.20, py + s*0.60); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(cx + s*0.12, py + s*0.42); ctx.lineTo(px + s*0.94, py + s*0.32/dwb); ctx.lineTo(px + s*0.80, py + s*0.60); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#bb2a16';
        ctx.beginPath(); ctx.ellipse(cx, py + s*0.56, s*0.22, s*0.30, 0, 0, Math.PI*2); ctx.fill();   // back
        ctx.fillStyle = '#8a1808';                                                                  // spine ridge
        [0.38,0.50,0.62,0.74].forEach(fy => { ctx.beginPath(); ctx.moveTo(cx - s*0.07, py + s*fy); ctx.lineTo(cx, py + s*(fy-0.09)); ctx.lineTo(cx + s*0.07, py + s*fy); ctx.closePath(); ctx.fill(); });
        ctx.fillStyle = `rgba(255,180,50,${0.3+flap*0.3})`;                                         // the heat, through the back
        ctx.beginPath(); ctx.arc(cx, py + s*0.66, s*0.07, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#cc3418';
        ctx.beginPath(); ctx.arc(cx, py + s*0.26, s*0.17, 0, Math.PI*2); ctx.fill();                 // back of the head
        ctx.fillStyle = '#5a1408';                                                                  // horn crest
        [0.38,0.5,0.62].forEach(fx => { ctx.beginPath(); ctx.moveTo(px + s*fx, py + s*0.14); ctx.lineTo(px + s*(fx+0.02), py + s*0.0); ctx.lineTo(px + s*(fx+0.08), py + s*0.14); ctx.closePath(); ctx.fill(); });
        ctx.strokeStyle = '#bb2a16'; ctx.lineWidth = Math.max(2, s*0.08);
        ctx.beginPath(); ctx.moveTo(cx, py + s*0.84); ctx.lineTo(cx + Math.sin(Date.now()/170+phase)*s*0.12, py + s); ctx.stroke();   // tail, nearest
        break;
      }
      if (facing !== 'down') {
        // Side, drawn facing right: neck and snout in profile, one wing, one horn,
        // one eye, the throat glow under the jaw, tail behind.
        ctx.save();
        mirrorIfLeft(facing, cx);
        const dws = Math.sin(Date.now()/130 + phase) * 0.18 + 1;
        ctx.fillStyle = '#8a1808';
        ctx.beginPath(); ctx.moveTo(cx - s*0.04, py + s*0.42); ctx.lineTo(px + s*0.16, py + s*0.24/dws); ctx.lineTo(px + s*0.34, py + s*0.62); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#a82212';
        ctx.beginPath(); ctx.moveTo(cx - s*0.02, py + s*0.44); ctx.lineTo(px + s*0.24, py + s*0.32/dws); ctx.lineTo(px + s*0.36, py + s*0.56); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#bb2a16';
        ctx.beginPath(); ctx.ellipse(cx - s*0.04, py + s*0.58, s*0.18, s*0.28, 0, 0, Math.PI*2); ctx.fill();   // body
        ctx.fillStyle = '#d8562a';
        ctx.beginPath(); ctx.ellipse(cx + s*0.06, py + s*0.64, s*0.08, s*0.16, 0, 0, Math.PI*2); ctx.fill();   // belly edge
        ctx.strokeStyle = '#bb2a16'; ctx.lineWidth = Math.max(2, s*0.07);
        ctx.beginPath(); ctx.moveTo(cx - s*0.16, py + s*0.76); ctx.lineTo(px + s*0.06 + Math.sin(Date.now()/170+phase)*s*0.10, py + s); ctx.stroke();   // tail behind
        ctx.fillStyle = '#cc3418';
        ctx.beginPath(); ctx.arc(px + s*0.56, py + s*0.30, s*0.16, 0, Math.PI*2); ctx.fill();       // head
        ctx.fillRect(px + s*0.62, py + s*0.30, s*0.16, s*0.09);                                    // snout
        ctx.fillStyle = '#5a1408';
        ctx.beginPath(); ctx.moveTo(px + s*0.50, py + s*0.18); ctx.lineTo(px + s*0.36, py + s*0.02); ctx.lineTo(px + s*0.58, py + s*0.16); ctx.closePath(); ctx.fill();   // one horn
        ctx.fillStyle = `rgba(255,180,50,${0.5+flap*0.45})`;
        ctx.beginPath(); ctx.arc(px + s*0.66, py + s*0.42, s*0.07, 0, Math.PI*2); ctx.fill();       // throat glow
        ctx.fillStyle = '#ffd23a'; ctx.fillRect(px + s*0.60, py + s*0.26, s*0.06, s*0.05);
        ctx.fillStyle = '#000'; ctx.fillRect(px + s*0.62, py + s*0.27, s*0.025, s*0.035);
        ctx.restore();
        break;
      }
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

    case 'magma_tyrant': {
      const facing = creatureFacing(e);
      if (facing === 'up') {
        // Back: the same hulking obsidian back, lava still coursing through it and up
        // its spine, the basalt crown and horns, no face and no maw.
        if (e.boss) {
          const auraR = s*0.62 + Math.sin(Date.now()/220)*s*0.04;
          const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, auraR);
          aura.addColorStop(0, 'rgba(255,110,30,0.42)'); aura.addColorStop(1, 'rgba(255,60,10,0)');
          ctx.fillStyle = aura; ctx.fillRect(cx-auraR, cy-auraR, auraR*2, auraR*2);
        }
        ctx.fillStyle = '#241410'; ctx.fillRect(px + s*0.30, py + s*0.68, s*0.16, s*0.24); ctx.fillRect(px + s*0.54, py + s*0.68, s*0.16, s*0.24);   // legs
        ctx.fillStyle = '#2a1a14';                                                          // back of the torso
        ctx.beginPath();
        ctx.moveTo(px + s*0.22, py + s*0.72); ctx.lineTo(px + s*0.28, py + s*0.30); ctx.lineTo(px + s*0.50, py + s*0.20);
        ctx.lineTo(px + s*0.72, py + s*0.30); ctx.lineTo(px + s*0.78, py + s*0.72); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#3a241a'; ctx.beginPath(); ctx.moveTo(px + s*0.72, py + s*0.30); ctx.lineTo(px + s*0.50, py + s*0.20); ctx.lineTo(px + s*0.52, py + s*0.60); ctx.lineTo(px + s*0.70, py + s*0.62); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#1a0e0a';                                                          // basalt spine
        [0.34,0.48,0.62].forEach(fy => { ctx.beginPath(); ctx.moveTo(cx - s*0.09, py + s*fy); ctx.lineTo(cx, py + s*(fy-0.11)); ctx.lineTo(cx + s*0.09, py + s*fy); ctx.closePath(); ctx.fill(); });
        const glowb = 0.6 + flap*0.4;                                                       // molten cracks
        ctx.strokeStyle = `rgba(255,120,30,${glowb})`; ctx.lineWidth = Math.max(2, s*0.05); ctx.lineCap='round';
        ctx.beginPath();
        ctx.moveTo(cx, py + s*0.26); ctx.lineTo(cx - s*0.04, py + s*0.46); ctx.lineTo(cx + s*0.02, py + s*0.66); ctx.lineTo(cx, py + s*0.72);
        ctx.moveTo(px + s*0.34, py + s*0.36); ctx.lineTo(px + s*0.40, py + s*0.58);
        ctx.moveTo(px + s*0.66, py + s*0.36); ctx.lineTo(px + s*0.60, py + s*0.58);
        ctx.moveTo(px + s*0.30, py + s*0.70); ctx.lineTo(px + s*0.70, py + s*0.70);
        ctx.stroke();
        ctx.strokeStyle = `rgba(255,225,120,${glowb})`; ctx.lineWidth = Math.max(1, s*0.02); ctx.stroke(); ctx.lineCap='butt';
        ctx.fillStyle = '#241410'; ctx.beginPath(); ctx.arc(cx, py + s*0.22, s*0.15, 0, Math.PI*2); ctx.fill();   // back of the head
        ctx.fillStyle = '#1a0e0a';                                                          // basalt crown
        [0.36,0.5,0.64].forEach(fx => { ctx.beginPath(); ctx.moveTo(px + s*fx, py + s*0.12); ctx.lineTo(px + s*(fx+0.02), py - s*0.02); ctx.lineTo(px + s*(fx+0.08), py + s*0.12); ctx.closePath(); ctx.fill(); });
        break;
      }
      if (facing !== 'down') {
        // Side, drawn facing right: the titan in profile, one leg, one white-hot eye,
        // the maw open to the right, the lava still coursing through its flank.
        ctx.save();
        mirrorIfLeft(facing, cx);
        if (e.boss) {
          const auraR = s*0.62 + Math.sin(Date.now()/220)*s*0.04;
          const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, auraR);
          aura.addColorStop(0, 'rgba(255,110,30,0.42)'); aura.addColorStop(1, 'rgba(255,60,10,0)');
          ctx.fillStyle = aura; ctx.fillRect(cx-auraR, cy-auraR, auraR*2, auraR*2);
        }
        ctx.fillStyle = '#241410'; ctx.fillRect(px + s*0.42, py + s*0.68, s*0.18, s*0.24);   // near leg
        ctx.fillStyle = '#2a1a14';                                                          // torso in profile
        ctx.beginPath();
        ctx.moveTo(px + s*0.28, py + s*0.72); ctx.lineTo(px + s*0.32, py + s*0.32); ctx.lineTo(px + s*0.54, py + s*0.22);
        ctx.lineTo(px + s*0.68, py + s*0.34); ctx.lineTo(px + s*0.66, py + s*0.72); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#3a241a'; ctx.beginPath(); ctx.moveTo(px + s*0.54, py + s*0.22); ctx.lineTo(px + s*0.68, py + s*0.34); ctx.lineTo(px + s*0.64, py + s*0.62); ctx.lineTo(px + s*0.50, py + s*0.60); ctx.closePath(); ctx.fill();
        const glows = 0.6 + flap*0.4;                                                       // molten cracks
        ctx.strokeStyle = `rgba(255,120,30,${glows})`; ctx.lineWidth = Math.max(2, s*0.05); ctx.lineCap='round';
        ctx.beginPath();
        ctx.moveTo(px + s*0.38, py + s*0.30); ctx.lineTo(px + s*0.46, py + s*0.50); ctx.lineTo(px + s*0.38, py + s*0.70);
        ctx.moveTo(px + s*0.60, py + s*0.36); ctx.lineTo(px + s*0.56, py + s*0.58);
        ctx.moveTo(px + s*0.32, py + s*0.70); ctx.lineTo(px + s*0.64, py + s*0.70);
        ctx.stroke();
        ctx.strokeStyle = `rgba(255,225,120,${glows})`; ctx.lineWidth = Math.max(1, s*0.02); ctx.stroke(); ctx.lineCap='butt';
        ctx.fillStyle = '#241410'; ctx.beginPath(); ctx.arc(px + s*0.58, py + s*0.24, s*0.14, 0, Math.PI*2); ctx.fill();   // head in profile
        ctx.fillRect(px + s*0.64, py + s*0.24, s*0.12, s*0.10);                                                  // jaw
        ctx.fillStyle = '#1a0e0a';                                                          // crown, in profile
        [0.44,0.54].forEach(fx => { ctx.beginPath(); ctx.moveTo(px + s*fx, py + s*0.14); ctx.lineTo(px + s*(fx+0.03), py - s*0.02); ctx.lineTo(px + s*(fx+0.10), py + s*0.14); ctx.closePath(); ctx.fill(); });
        ctx.fillStyle = `rgba(255,235,150,${0.85+flap*0.15})`;
        ctx.fillRect(px + s*0.62, py + s*0.20, s*0.06, s*0.05);                             // one white-hot eye
        ctx.fillStyle = `rgba(255,120,30,${glows})`; ctx.fillRect(px + s*0.68, py + s*0.30, s*0.10, s*0.03);   // maw, open forward
        ctx.restore();
        break;
      }
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
  }
}

registerEnemyArt(drawVolcanicCreature, [
  'magmin', 'fire_snake', 'azer', 'red_wyrmling', 'fire_elemental', 'young_red_dragon',
  'magma_tyrant',
]);
