// Earth creatures and their boss. Reached through ENEMY_ART (render-enemies.js),
// which also draws what every creature shares: shadow, auras, HP bar and name tag.

function drawEarthCreature(e, ts, s, px, py, cx, cy, flap, phase, fb, bob, boxTop) {
  switch (e.type) {
    case 'displacer': {
      const facing = creatureFacing(e);
      if (facing === 'down') {
        // Front: chest to the viewer, the head between two tentacles raised and swaying.
        ctx.fillStyle = '#22153a';
        ctx.beginPath(); ctx.ellipse(cx, py + s*0.56, s*0.25, s*0.14, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#3a2a55';
        ctx.beginPath(); ctx.ellipse(cx, py + s*0.68, s*0.21, s*0.16, 0, 0, Math.PI*2); ctx.fill();
        // Front paws
        ctx.fillStyle = '#22153a';
        ctx.fillRect(px + s*0.36, py + s*0.76, s*0.09, s*0.12);
        ctx.fillRect(px + s*0.55, py + s*0.76, s*0.09, s*0.12);
        // Head
        ctx.fillStyle = '#3a2a55';
        ctx.beginPath(); ctx.arc(cx, py + s*0.38, s*0.16, 0, Math.PI*2); ctx.fill();
        // Two tentacles (animated), with tip pads
        ctx.strokeStyle = '#554488';
        ctx.lineWidth = Math.max(2, s*0.06);
        ctx.lineCap = 'round';
        [-1, 1].forEach((side, i) => {
          const sway = Math.sin(Date.now()/200 + phase + i) * s*0.10;
          ctx.beginPath();
          ctx.moveTo(cx + side*s*0.08, py + s*0.34);
          ctx.quadraticCurveTo(cx + side*s*0.20, py + s*0.20, cx + side*s*0.24 + sway, py + s*0.06);
          ctx.stroke();
          ctx.fillStyle = '#aa66dd';
          ctx.beginPath(); ctx.arc(cx + side*s*0.24 + sway, py + s*0.06, s*0.05, 0, Math.PI*2); ctx.fill();
        });
        // Eyes
        ctx.fillStyle = '#ffcc44';
        ctx.fillRect(px + s*0.42, py + s*0.38, s*0.05, s*0.04);
        ctx.fillRect(px + s*0.53, py + s*0.38, s*0.05, s*0.04);
        break;
      }
      if (facing === 'up') {
        // Back: haunches to the viewer, spine and tail down the middle, tentacles still waving.
        ctx.fillStyle = '#22153a';
        ctx.beginPath(); ctx.ellipse(cx, py + s*0.66, s*0.26, s*0.18, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#3a2a55';
        ctx.beginPath(); ctx.ellipse(cx, py + s*0.50, s*0.21, s*0.14, 0, 0, Math.PI*2); ctx.fill();
        // Hind legs
        ctx.fillStyle = '#22153a';
        ctx.fillRect(px + s*0.31, py + s*0.74, s*0.10, s*0.12);
        ctx.fillRect(px + s*0.59, py + s*0.74, s*0.10, s*0.12);
        // Spine ridge
        ctx.strokeStyle = '#22153a'; ctx.lineWidth = Math.max(2, s*0.04);
        ctx.beginPath(); ctx.moveTo(cx, py + s*0.40); ctx.lineTo(cx, py + s*0.72); ctx.stroke();
        // Back of the head, no face
        ctx.fillStyle = '#3a2a55';
        ctx.beginPath(); ctx.arc(cx, py + s*0.38, s*0.14, 0, Math.PI*2); ctx.fill();
        // Two tentacles seen from behind (animated), with tip pads
        ctx.strokeStyle = '#554488';
        ctx.lineWidth = Math.max(2, s*0.06);
        ctx.lineCap = 'round';
        [-1, 1].forEach((side, i) => {
          const sway = Math.sin(Date.now()/200 + phase + i) * s*0.10;
          ctx.beginPath();
          ctx.moveTo(cx + side*s*0.10, py + s*0.32);
          ctx.quadraticCurveTo(cx + side*s*0.22, py + s*0.18, cx + side*s*0.26 + sway, py + s*0.08);
          ctx.stroke();
          ctx.fillStyle = '#aa66dd';
          ctx.beginPath(); ctx.arc(cx + side*s*0.26 + sway, py + s*0.08, s*0.05, 0, Math.PI*2); ctx.fill();
        });
        // Tail hanging down the middle of the rump
        const dtail = Math.sin(Date.now()/200 + phase) * s*0.06;
        ctx.strokeStyle = '#3a2a55'; ctx.lineWidth = Math.max(2, s*0.05);
        ctx.beginPath();
        ctx.moveTo(cx, py + s*0.70);
        ctx.quadraticCurveTo(cx + dtail, py + s*0.82, cx + dtail*1.5, py + s*0.90);
        ctx.stroke();
        break;
      }
      // Side. This was always the displacer's only view, drawn facing left.
      ctx.save();
      if (facing === 'right') { ctx.translate(cx * 2, 0); ctx.scale(-1, 1); }
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
      ctx.restore();
      break;
    }
    case 'gargoyle': {
      const facing = creatureFacing(e);
      if (facing === 'up') {
        // Back: wings spread seen from behind, spine ridge down the stone back, horns, no face.
        const gwb = Math.sin(Date.now()/140 + phase)*0.15 + 1;
        ctx.fillStyle = '#5a564e';
        ctx.beginPath(); ctx.moveTo(cx - s*0.06, py + s*0.42); ctx.lineTo(px + s*0.02, py + s*0.22/gwb); ctx.lineTo(px + s*0.16, py + s*0.46); ctx.lineTo(px + s*0.10, py + s*0.56); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(cx + s*0.06, py + s*0.42); ctx.lineTo(px + s*0.98, py + s*0.22/gwb); ctx.lineTo(px + s*0.84, py + s*0.46); ctx.lineTo(px + s*0.90, py + s*0.56); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#4a463e'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(cx - s*0.06, py + s*0.42); ctx.lineTo(px + s*0.08, py + s*0.32); ctx.moveTo(cx + s*0.06, py + s*0.42); ctx.lineTo(px + s*0.92, py + s*0.32); ctx.stroke();
        // Back of the crouched body, shaded away from the light
        ctx.fillStyle = '#6f6a60'; ctx.fillRect(px + s*0.32, py + s*0.46, s*0.36, s*0.40);
        ctx.fillStyle = '#5a564e'; ctx.fillRect(px + s*0.32, py + s*0.46, s*0.18, s*0.40);
        // Spine ridge
        ctx.fillStyle = '#4a463e'; ctx.fillRect(px + s*0.47, py + s*0.48, s*0.06, s*0.34);
        // Back of the head, horns still showing
        ctx.fillStyle = '#6f6a60';
        ctx.beginPath(); ctx.arc(cx, py + s*0.34, s*0.16, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#4a463e';
        ctx.beginPath(); ctx.moveTo(px + s*0.40, py + s*0.24); ctx.lineTo(px + s*0.34, py + s*0.10); ctx.lineTo(px + s*0.46, py + s*0.22); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(px + s*0.60, py + s*0.24); ctx.lineTo(px + s*0.66, py + s*0.10); ctx.lineTo(px + s*0.54, py + s*0.22); ctx.closePath(); ctx.fill();
        // Knobby tail along the spine
        ctx.strokeStyle = '#5a564e'; ctx.lineWidth = Math.max(2, s*0.05);
        ctx.beginPath(); ctx.moveTo(cx, py + s*0.84); ctx.lineTo(px + s*0.58, py + s*0.88); ctx.stroke();
        break;
      }
      if (facing !== 'down') {
        // Side, drawn facing right: one wing edge-on, one eye, a stone snout.
        ctx.save();
        mirrorIfLeft(facing, cx);
        const gsf = Math.sin(Date.now()/140 + phase)*0.15 + 1;
        // Far wing, just showing past the shoulder
        ctx.fillStyle = '#4a463e';
        ctx.beginPath(); ctx.moveTo(cx - s*0.02, py + s*0.40); ctx.lineTo(px + s*0.14, py + s*0.22/gsf); ctx.lineTo(px + s*0.26, py + s*0.36); ctx.lineTo(px + s*0.22, py + s*0.54); ctx.closePath(); ctx.fill();
        // Crouched body in profile
        ctx.fillStyle = '#6f6a60'; ctx.fillRect(px + s*0.30, py + s*0.46, s*0.34, s*0.40);
        ctx.fillStyle = '#827c70'; ctx.fillRect(px + s*0.30, py + s*0.46, s*0.16, s*0.40);
        // Near wing, edge-on: a narrow upright slab
        ctx.fillStyle = '#5a564e';
        ctx.beginPath(); ctx.moveTo(cx + s*0.02, py + s*0.42); ctx.lineTo(px + s*0.44, py + s*0.16/gsf); ctx.lineTo(px + s*0.58, py + s*0.32); ctx.lineTo(px + s*0.52, py + s*0.54); ctx.closePath(); ctx.fill();
        // Head in profile with the snout to the right
        ctx.fillStyle = '#827c70';
        ctx.beginPath(); ctx.arc(px + s*0.56, py + s*0.34, s*0.16, 0, Math.PI*2); ctx.fill();
        ctx.fillRect(px + s*0.64, py + s*0.34, s*0.16, s*0.08);
        // One horn
        ctx.fillStyle = '#4a463e';
        ctx.beginPath(); ctx.moveTo(px + s*0.50, py + s*0.24); ctx.lineTo(px + s*0.44, py + s*0.10); ctx.lineTo(px + s*0.58, py + s*0.22); ctx.closePath(); ctx.fill();
        // One glowing eye + snarl
        ctx.fillStyle = `rgba(255,210,120,${0.6+flap*0.3})`;
        ctx.fillRect(px + s*0.60, py + s*0.32, s*0.06, s*0.04);
        ctx.fillStyle = '#2a2620'; ctx.fillRect(px + s*0.68, py + s*0.40, s*0.10, s*0.03);
        // Near leg and claw
        ctx.fillStyle = '#6f6a60'; ctx.fillRect(px + s*0.44, py + s*0.70, s*0.14, s*0.16);
        ctx.restore();
        break;
      }
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
      const facing = creatureFacing(e);
      if (facing === 'down') {
        // Front: the head plate low and forward, segments receding behind it, legs out both sides.
        ctx.strokeStyle = '#3e3618'; ctx.lineWidth = Math.max(1.5, s*0.04); ctx.lineCap = 'round';
        [[0.56,0.16],[0.44,0.13],[0.32,0.10]].forEach(([fy,half]) => {
          ctx.beginPath();
          ctx.moveTo(cx - s*half, py + s*fy); ctx.lineTo(cx - s*(half+0.18), py + s*0.84);
          ctx.moveTo(cx + s*half, py + s*fy); ctx.lineTo(cx + s*(half+0.18), py + s*0.84);
          ctx.stroke();
        });
        ctx.fillStyle = '#5e5226';
        [[0.30,0.11],[0.42,0.14],[0.56,0.17]].forEach(([fy,rx]) => { ctx.beginPath(); ctx.ellipse(cx, py + s*fy, s*rx, s*0.10, 0, 0, Math.PI*2); ctx.fill(); });
        ctx.fillStyle = '#7a6c34';
        [[0.29,0.07],[0.41,0.09],[0.55,0.11]].forEach(([fy,rx]) => { ctx.beginPath(); ctx.ellipse(cx, py + s*(fy-0.02), s*rx, s*0.05, 0, 0, Math.PI*2); ctx.fill(); });
        // Armored head, nearest the viewer
        ctx.fillStyle = '#7a6c34';
        ctx.beginPath(); ctx.ellipse(cx, py + s*0.68, s*0.20, s*0.14, 0, 0, Math.PI*2); ctx.fill();
        // Mandibles spread
        ctx.strokeStyle = '#3e3618'; ctx.lineWidth = Math.max(2, s*0.05);
        ctx.beginPath();
        ctx.moveTo(px + s*0.38, py + s*0.74); ctx.lineTo(px + s*0.24, py + s*0.88);
        ctx.moveTo(px + s*0.62, py + s*0.74); ctx.lineTo(px + s*0.76, py + s*0.88);
        ctx.stroke();
        // Eyes + acid drip
        ctx.fillStyle = '#1a1606'; ctx.fillRect(px + s*0.42, py + s*0.62, s*0.04, s*0.04); ctx.fillRect(px + s*0.54, py + s*0.62, s*0.04, s*0.04);
        ctx.fillStyle = `rgba(150,220,80,${0.6+flap*0.4})`;
        ctx.beginPath(); ctx.arc(cx, py + s*0.80, s*0.04, 0, Math.PI*2); ctx.fill();
        break;
      }
      if (facing === 'up') {
        // Back: the soft abdomen nearest the viewer, segments running away to a small dark head plate.
        ctx.strokeStyle = '#3e3618'; ctx.lineWidth = Math.max(1.5, s*0.04); ctx.lineCap = 'round';
        [[0.62,0.17],[0.48,0.14],[0.36,0.11]].forEach(([fy,half]) => {
          ctx.beginPath();
          ctx.moveTo(cx - s*half, py + s*fy); ctx.lineTo(cx - s*(half+0.14), py + s*0.84);
          ctx.moveTo(cx + s*half, py + s*fy); ctx.lineTo(cx + s*(half+0.14), py + s*0.84);
          ctx.stroke();
        });
        ctx.fillStyle = '#5e5226';
        [[0.66,0.19],[0.50,0.16],[0.38,0.13],[0.28,0.10]].forEach(([fy,rx]) => { ctx.beginPath(); ctx.ellipse(cx, py + s*fy, s*rx, s*0.11, 0, 0, Math.PI*2); ctx.fill(); });
        // Ridge down the back, and spiracles along the flanks
        ctx.strokeStyle = '#3e3618'; ctx.lineWidth = Math.max(1.5, s*0.03);
        ctx.beginPath(); ctx.moveTo(cx, py + s*0.24); ctx.lineTo(cx, py + s*0.76); ctx.stroke();
        ctx.fillStyle = '#7a6c34';
        [[0.62,0.10],[0.50,0.09],[0.38,0.07]].forEach(([fy,off]) => {
          ctx.fillRect(cx - s*off, py + s*fy, s*0.03, s*0.03);
          ctx.fillRect(cx + s*off - s*0.03, py + s*fy, s*0.03, s*0.03);
        });
        // The head, far off and unlit: a plain dark plate, no face
        ctx.fillStyle = '#3e3618';
        ctx.beginPath(); ctx.ellipse(cx, py + s*0.20, s*0.10, s*0.07, 0, 0, Math.PI*2); ctx.fill();
        break;
      }
      // Side. This was always the ankheg's only view, drawn facing left.
      ctx.save();
      if (facing === 'right') { ctx.translate(cx * 2, 0); ctx.scale(-1, 1); }
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
      ctx.restore();
      break;
    }
    case 'bulette': {
      const facing = creatureFacing(e);
      if (facing === 'down') {
        // Front: the jawed head forward, the plate-armoured back behind it, the fin as a narrow spike.
        ctx.fillStyle = '#4e463e';
        ctx.beginPath(); ctx.ellipse(cx, py + s*0.60, s*0.26, s*0.20, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#635a50';
        ctx.beginPath(); ctx.ellipse(cx, py + s*0.54, s*0.18, s*0.12, 0, 0, Math.PI*2); ctx.fill();
        // Plate seams across the armour
        ctx.strokeStyle = '#2e2820'; ctx.lineWidth = 1.5;
        [0.50,0.60,0.70].forEach(fy => { ctx.beginPath(); ctx.moveTo(px + s*0.28, py + s*fy); ctx.lineTo(px + s*0.72, py + s*fy); ctx.stroke(); });
        // Dorsal fin rising behind the head
        ctx.fillStyle = '#3a342c';
        ctx.beginPath(); ctx.moveTo(cx - s*0.07, py + s*0.46); ctx.lineTo(cx, py + s*0.14); ctx.lineTo(cx + s*0.07, py + s*0.46); ctx.closePath(); ctx.fill();
        // Head and jaws, nearest the viewer
        ctx.fillStyle = '#635a50';
        ctx.beginPath(); ctx.ellipse(cx, py + s*0.72, s*0.22, s*0.13, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#1a160e'; ctx.fillRect(px + s*0.32, py + s*0.76, s*0.36, s*0.06);
        ctx.fillStyle = '#e8e0c8';
        for (let i=0;i<5;i++) ctx.fillRect(px + s*0.34 + i*s*0.07, py + s*0.76, s*0.02, s*0.05);
        // Eyes + stubby legs
        ctx.fillStyle = '#ffcc33'; ctx.fillRect(px + s*0.40, py + s*0.66, s*0.04, s*0.03); ctx.fillRect(px + s*0.56, py + s*0.66, s*0.04, s*0.03);
        ctx.fillStyle = '#3a342c';
        [0.28,0.62].forEach(fx => ctx.fillRect(px + s*fx, py + s*0.80, s*0.10, s*0.12));
        break;
      }
      if (facing === 'up') {
        // Back: the armoured rump to the viewer, the fin edge-on running away to a blank head plate.
        ctx.fillStyle = '#4e463e';
        ctx.beginPath(); ctx.ellipse(cx, py + s*0.66, s*0.28, s*0.18, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#635a50';
        ctx.beginPath(); ctx.ellipse(cx, py + s*0.52, s*0.20, s*0.13, 0, 0, Math.PI*2); ctx.fill();
        // Plate seams across the back
        ctx.strokeStyle = '#2e2820'; ctx.lineWidth = 1.5;
        [0.58,0.68,0.78].forEach(fy => { ctx.beginPath(); ctx.moveTo(px + s*0.26, py + s*fy); ctx.lineTo(px + s*0.74, py + s*fy); ctx.stroke(); });
        // Dorsal fin, edge-on down the middle; the head is beyond it and shows nothing
        ctx.fillStyle = '#3a342c';
        ctx.beginPath(); ctx.moveTo(cx - s*0.06, py + s*0.56); ctx.lineTo(cx, py + s*0.14); ctx.lineTo(cx + s*0.06, py + s*0.56); ctx.closePath(); ctx.fill();
        // Stubby legs
        ctx.fillStyle = '#3a342c';
        [0.22,0.68].forEach(fx => ctx.fillRect(px + s*fx, py + s*0.78, s*0.10, s*0.14));
        // Short tail, nearest the viewer
        ctx.beginPath(); ctx.moveTo(cx - s*0.06, py + s*0.80); ctx.lineTo(cx + s*0.06, py + s*0.80); ctx.lineTo(cx, py + s*0.92); ctx.closePath(); ctx.fill();
        break;
      }
      // Side. This was always the bulette's only view, drawn facing right.
      ctx.save();
      mirrorIfLeft(facing, cx);
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
      ctx.restore();
      break;
    }
    case 'earth_elemental': {
      const facing = creatureFacing(e);
      if (facing === 'up') {
        // Back: the same mound from behind - no eyes, and a ridge of jagged stone up the spine.
        ctx.fillStyle = '#6a5d40';
        ctx.beginPath();
        ctx.moveTo(px + s*0.14, py + s*0.90); ctx.lineTo(px + s*0.22, py + s*0.52); ctx.lineTo(px + s*0.36, py + s*0.32);
        ctx.lineTo(px + s*0.50, py + s*0.22); ctx.lineTo(px + s*0.66, py + s*0.34); ctx.lineTo(px + s*0.86, py + s*0.54); ctx.lineTo(px + s*0.82, py + s*0.90);
        ctx.closePath(); ctx.fill();
        // Lighter facet, now on the far side
        ctx.fillStyle = '#84764e';
        ctx.beginPath(); ctx.moveTo(px + s*0.56, py + s*0.30); ctx.lineTo(px + s*0.74, py + s*0.42); ctx.lineTo(px + s*0.66, py + s*0.62); ctx.lineTo(px + s*0.52, py + s*0.54); ctx.closePath(); ctx.fill();
        // Ridge of loose stone down the back
        ctx.fillStyle = '#5a4e34';
        [[0.36,0.46],[0.46,0.34],[0.56,0.44]].forEach(([fx,fy]) => {
          ctx.beginPath(); ctx.moveTo(px + s*(fx-0.06), py + s*fy); ctx.lineTo(px + s*fx, py + s*(fy-0.12)); ctx.lineTo(px + s*(fx+0.06), py + s*fy); ctx.closePath(); ctx.fill();
        });
        // Cracks + moss
        ctx.strokeStyle = '#3e3622'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(px + s*0.30, py + s*0.40); ctx.lineTo(px + s*0.34, py + s*0.86); ctx.moveTo(px + s*0.68, py + s*0.44); ctx.lineTo(px + s*0.70, py + s*0.86); ctx.stroke();
        ctx.fillStyle = '#5a7a30';
        ctx.fillRect(px + s*0.22, py + s*0.62, s*0.10, s*0.04);
        ctx.fillRect(px + s*0.62, py + s*0.70, s*0.10, s*0.04);
        break;
      }
      if (facing !== 'down') {
        // Side, drawn facing right: the mound in profile, one gem eye under a jutting brow.
        ctx.save();
        mirrorIfLeft(facing, cx);
        ctx.fillStyle = '#6a5d40';
        ctx.beginPath();
        ctx.moveTo(px + s*0.20, py + s*0.90); ctx.lineTo(px + s*0.22, py + s*0.44); ctx.lineTo(px + s*0.38, py + s*0.22);
        ctx.lineTo(px + s*0.62, py + s*0.20); ctx.lineTo(px + s*0.76, py + s*0.42); ctx.lineTo(px + s*0.74, py + s*0.90);
        ctx.closePath(); ctx.fill();
        // A shoulder of rock jutting forward
        ctx.fillStyle = '#6a5d40';
        ctx.beginPath(); ctx.moveTo(px + s*0.66, py + s*0.40); ctx.lineTo(px + s*0.90, py + s*0.50); ctx.lineTo(px + s*0.66, py + s*0.60); ctx.closePath(); ctx.fill();
        // Lighter facet
        ctx.fillStyle = '#84764e';
        ctx.beginPath(); ctx.moveTo(px + s*0.34, py + s*0.26); ctx.lineTo(px + s*0.56, py + s*0.22); ctx.lineTo(px + s*0.52, py + s*0.52); ctx.lineTo(px + s*0.32, py + s*0.54); ctx.closePath(); ctx.fill();
        // Cracks + moss
        ctx.strokeStyle = '#3e3622'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(px + s*0.30, py + s*0.30); ctx.lineTo(px + s*0.34, py + s*0.88); ctx.moveTo(px + s*0.56, py + s*0.40); ctx.lineTo(px + s*0.58, py + s*0.86); ctx.stroke();
        ctx.fillStyle = '#5a7a30';
        ctx.fillRect(px + s*0.24, py + s*0.50, s*0.10, s*0.04);
        ctx.fillRect(px + s*0.60, py + s*0.66, s*0.10, s*0.04);
        // One glowing gem eye
        ctx.fillStyle = `rgba(255,200,90,${0.6+flap*0.3})`;
        ctx.fillRect(px + s*0.58, py + s*0.42, s*0.07, s*0.05);
        ctx.restore();
        break;
      }
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
      const facing = creatureFacing(e);
      if (facing === 'up') {
        // Back: the stone frame from behind, spine ridge, and the boulder in the other hand.
        ctx.fillStyle = '#75706a'; ctx.fillRect(px + s*0.30, py + s*0.66, s*0.16, s*0.26); ctx.fillRect(px + s*0.54, py + s*0.66, s*0.16, s*0.26);
        // Back of the torso: shoulders broader than the waist
        ctx.fillStyle = '#857f76';
        ctx.beginPath();
        ctx.moveTo(px + s*0.24, py + s*0.72); ctx.lineTo(px + s*0.28, py + s*0.32); ctx.lineTo(px + s*0.72, py + s*0.32); ctx.lineTo(px + s*0.76, py + s*0.72);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#75706a'; ctx.fillRect(px + s*0.28, py + s*0.32, s*0.22, s*0.40);
        // Spine ridge
        ctx.fillStyle = '#5e594f'; ctx.fillRect(px + s*0.47, py + s*0.34, s*0.06, s*0.36);
        // Back of the head, no brow and no eyes
        ctx.fillStyle = '#857f76';
        ctx.beginPath(); ctx.arc(cx, py + s*0.22, s*0.15, 0, Math.PI*2); ctx.fill();
        // Cracks across the shoulders
        ctx.strokeStyle = '#5e594f'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(px + s*0.30, py + s*0.40); ctx.lineTo(px + s*0.44, py + s*0.46); ctx.moveTo(px + s*0.70, py + s*0.40); ctx.lineTo(px + s*0.56, py + s*0.46); ctx.stroke();
        // Boulder in hand, now on the far side of the body
        ctx.fillStyle = '#6a655c';
        ctx.beginPath(); ctx.arc(px + s*0.16, py + s*0.42, s*0.14, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#807a70';
        ctx.beginPath(); ctx.arc(px + s*0.12, py + s*0.38, s*0.07, 0, Math.PI*2); ctx.fill();
        break;
      }
      if (facing !== 'down') {
        // Side, drawn facing right: one eye under the brow, the boulder carried forward.
        ctx.save();
        mirrorIfLeft(facing, cx);
        // Legs, the near one forward
        ctx.fillStyle = '#75706a'; ctx.fillRect(px + s*0.32, py + s*0.66, s*0.16, s*0.26);
        ctx.fillStyle = '#857f76'; ctx.fillRect(px + s*0.50, py + s*0.66, s*0.16, s*0.26);
        // Torso in profile
        ctx.fillStyle = '#857f76'; ctx.fillRect(px + s*0.32, py + s*0.30, s*0.34, s*0.42);
        ctx.fillStyle = '#9a948a'; ctx.fillRect(px + s*0.32, py + s*0.30, s*0.16, s*0.42);
        // Head in profile, heavy brow and one eye
        ctx.fillStyle = '#9a948a';
        ctx.beginPath(); ctx.arc(px + s*0.54, py + s*0.20, s*0.15, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#5e594f'; ctx.fillRect(px + s*0.56, py + s*0.16, s*0.14, s*0.04);
        ctx.fillStyle = '#1a1812'; ctx.fillRect(px + s*0.60, py + s*0.18, s*0.05, s*0.04);
        // Cracks
        ctx.strokeStyle = '#5e594f'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(px + s*0.38, py + s*0.36); ctx.lineTo(px + s*0.44, py + s*0.66); ctx.stroke();
        // The near arm out in front, boulder in its hand
        ctx.fillStyle = '#857f76'; ctx.fillRect(px + s*0.62, py + s*0.34, s*0.12, s*0.22);
        ctx.fillStyle = '#6a655c';
        ctx.beginPath(); ctx.arc(px + s*0.80, py + s*0.44, s*0.14, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#807a70';
        ctx.beginPath(); ctx.arc(px + s*0.76, py + s*0.40, s*0.07, 0, Math.PI*2); ctx.fill();
        ctx.restore();
        break;
      }
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
    case 'gaia_colossus': {
      const facing = creatureFacing(e);
      if (facing === 'up') {
        // Back: no core and no face - a spine of boulders down the craggy back, moss on the shoulders.
        if (e.boss) {
          const auraRb = s*0.60 + Math.sin(Date.now()/220)*s*0.04;
          const auraB = ctx.createRadialGradient(cx, cy, 0, cx, cy, auraRb);
          auraB.addColorStop(0, 'rgba(210,150,60,0.32)'); auraB.addColorStop(1, 'rgba(210,150,60,0)');
          ctx.fillStyle = auraB; ctx.fillRect(cx-auraRb, cy-auraRb, auraRb*2, auraRb*2);
        }
        // Boulder legs
        ctx.fillStyle = '#5e5436'; ctx.fillRect(px + s*0.28, py + s*0.70, s*0.18, s*0.22); ctx.fillRect(px + s*0.54, py + s*0.70, s*0.18, s*0.22);
        // Craggy back, shoulders wider than the waist
        ctx.fillStyle = '#6e6242';
        ctx.beginPath();
        ctx.moveTo(px + s*0.20, py + s*0.74); ctx.lineTo(px + s*0.24, py + s*0.34); ctx.lineTo(px + s*0.38, py + s*0.26);
        ctx.lineTo(px + s*0.62, py + s*0.26); ctx.lineTo(px + s*0.76, py + s*0.34); ctx.lineTo(px + s*0.80, py + s*0.74);
        ctx.closePath(); ctx.fill();
        // Spine of boulders
        ctx.fillStyle = '#867748';
        [[0.40,0.64],[0.50,0.52],[0.60,0.40]].forEach(([fx,fy]) => {
          ctx.beginPath(); ctx.moveTo(px + s*(fx-0.07), py + s*fy); ctx.lineTo(px + s*fx, py + s*(fy-0.13)); ctx.lineTo(px + s*(fx+0.07), py + s*fy); ctx.closePath(); ctx.fill();
        });
        // Boulder fists
        ctx.fillStyle = '#5e5436';
        ctx.beginPath(); ctx.arc(px + s*0.16, py + s*0.58, s*0.12, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(px + s*0.84, py + s*0.58, s*0.12, 0, Math.PI*2); ctx.fill();
        // Back of the head
        ctx.fillStyle = '#6e6242';
        ctx.beginPath(); ctx.arc(cx, py + s*0.22, s*0.12, 0, Math.PI*2); ctx.fill();
        // Moss on the shoulders
        ctx.fillStyle = '#4a6a28';
        ctx.fillRect(px + s*0.26, py + s*0.36, s*0.12, s*0.04);
        ctx.fillRect(px + s*0.62, py + s*0.40, s*0.12, s*0.04);
        // Molten veins still glowing through the stone
        ctx.strokeStyle = `rgba(255,140,40,${0.4+flap*0.3})`; ctx.lineWidth = Math.max(1.5, s*0.03);
        ctx.beginPath(); ctx.moveTo(px + s*0.34, py + s*0.68); ctx.lineTo(px + s*0.30, py + s*0.44); ctx.moveTo(px + s*0.66, py + s*0.68); ctx.lineTo(px + s*0.70, py + s*0.46); ctx.stroke();
        break;
      }
      if (facing !== 'down') {
        // Side, drawn facing right: the core glowing at the chest, one fist thrust forward.
        ctx.save();
        mirrorIfLeft(facing, cx);
        if (e.boss) {
          const auraRs = s*0.60 + Math.sin(Date.now()/220)*s*0.04;
          const auraS = ctx.createRadialGradient(cx, cy, 0, cx, cy, auraRs);
          auraS.addColorStop(0, 'rgba(210,150,60,0.32)'); auraS.addColorStop(1, 'rgba(210,150,60,0)');
          ctx.fillStyle = auraS; ctx.fillRect(cx-auraRs, cy-auraRs, auraRs*2, auraRs*2);
        }
        // Boulder legs, the near one forward
        ctx.fillStyle = '#5e5436'; ctx.fillRect(px + s*0.28, py + s*0.70, s*0.18, s*0.22);
        ctx.fillStyle = '#6e6242'; ctx.fillRect(px + s*0.50, py + s*0.70, s*0.18, s*0.22);
        // Torso in profile
        ctx.fillStyle = '#6e6242';
        ctx.beginPath();
        ctx.moveTo(px + s*0.26, py + s*0.74); ctx.lineTo(px + s*0.30, py + s*0.34); ctx.lineTo(px + s*0.44, py + s*0.26);
        ctx.lineTo(px + s*0.66, py + s*0.28); ctx.lineTo(px + s*0.72, py + s*0.46); ctx.lineTo(px + s*0.68, py + s*0.74);
        ctx.closePath(); ctx.fill();
        // Molten core, seen through the side of the chest
        ctx.fillStyle = `rgba(255,150,40,${0.6+flap*0.4})`;
        ctx.beginPath(); ctx.arc(px + s*0.60, py + s*0.50, s*0.09, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#ffd070';
        ctx.beginPath(); ctx.arc(px + s*0.60, py + s*0.50, s*0.045, 0, Math.PI*2); ctx.fill();
        // Glowing cracks
        ctx.strokeStyle = `rgba(255,140,40,${0.4+flap*0.3})`; ctx.lineWidth = Math.max(1.5, s*0.03);
        ctx.beginPath(); ctx.moveTo(px + s*0.58, py + s*0.40); ctx.lineTo(px + s*0.42, py + s*0.30); ctx.moveTo(px + s*0.58, py + s*0.60); ctx.lineTo(px + s*0.46, py + s*0.70); ctx.stroke();
        // The near fist thrust forward, the far one behind
        ctx.fillStyle = '#5e5436';
        ctx.beginPath(); ctx.arc(px + s*0.80, py + s*0.56, s*0.12, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#6e6242';
        ctx.beginPath(); ctx.arc(px + s*0.24, py + s*0.60, s*0.11, 0, Math.PI*2); ctx.fill();
        // Head in profile, moss crest and one eye
        ctx.fillStyle = '#6e6242';
        ctx.beginPath(); ctx.arc(px + s*0.50, py + s*0.20, s*0.12, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#4a6a28'; ctx.fillRect(px + s*0.40, py + s*0.26, s*0.12, s*0.04);
        ctx.fillStyle = `rgba(255,180,60,${0.7+flap*0.3})`;
        ctx.fillRect(px + s*0.54, py + s*0.18, s*0.05, s*0.04);
        ctx.restore();
        break;
      }
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
  }
}

registerEnemyArt(drawEarthCreature, [
  'displacer', 'gargoyle', 'ankheg', 'bulette', 'earth_elemental', 'stone_giant',
  'gaia_colossus',
]);
