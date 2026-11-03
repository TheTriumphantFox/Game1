// Poison creatures and their boss. Reached through ENEMY_ART (render-enemies.js),
// which also draws what every creature shares: shadow, auras, HP bar and name tag.

function drawPoisonCreature(e, ts, s, px, py, cx, cy, flap, phase, fb, bob, boxTop) {
  switch (e.type) {
    case 'troll': {
      const facing = creatureFacing(e);
      if (facing === 'up') {
        // Back: the same hulk, no face, hair down the back, club in the other hand.
        ctx.fillStyle = '#456a30'; ctx.fillRect(px + s*0.12, py + s*0.30, s*0.76, s*0.60);
        ctx.fillStyle = '#5a8a3a'; ctx.fillRect(px + s*0.48, py + s*0.30, s*0.40, s*0.60);
        // spine down the back
        ctx.fillStyle = '#456a30';
        [0.44,0.56,0.68,0.80].forEach(fy => { ctx.beginPath(); ctx.moveTo(cx - s*0.05, py + s*fy); ctx.lineTo(cx, py + s*(fy-0.08)); ctx.lineTo(cx + s*0.05, py + s*fy); ctx.closePath(); ctx.fill(); });
        // back of the head, mostly shaggy hair, neck showing below
        ctx.fillStyle = '#5a8a3a';
        ctx.beginPath(); ctx.arc(cx, py + s*0.22, s*0.22, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#456a30';
        ctx.beginPath(); ctx.arc(cx, py + s*0.18, s*0.22, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(px + s*0.30, py + s*0.30); ctx.lineTo(px + s*0.34, py + s*0.44); ctx.lineTo(px + s*0.40, py + s*0.30); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(px + s*0.60, py + s*0.30); ctx.lineTo(px + s*0.66, py + s*0.44); ctx.lineTo(px + s*0.70, py + s*0.30); ctx.closePath(); ctx.fill();
        // Club, now in the left hand
        ctx.fillStyle = '#3a2410';
        ctx.fillRect(px + s*0.06, py + s*0.30, s*0.10, s*0.42);
        ctx.fillStyle = '#553a18';
        ctx.beginPath(); ctx.arc(px + s*0.11, py + s*0.28, s*0.10, 0, Math.PI*2); ctx.fill();
        break;
      }
      if (facing !== 'down') {
        // Side, drawn facing right: hunched, one eye, a long nose, the club forward.
        ctx.save();
        mirrorIfLeft(facing, cx);
        ctx.fillStyle = '#456a30';
        ctx.beginPath(); ctx.moveTo(px + s*0.42, py + s*0.04); ctx.lineTo(px + s*0.22, py + s*0.50); ctx.lineTo(px + s*0.54, py + s*0.42); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#456a30'; ctx.fillRect(px + s*0.26, py + s*0.30, s*0.40, s*0.60);
        ctx.fillStyle = '#5a8a3a'; ctx.fillRect(px + s*0.26, py + s*0.30, s*0.22, s*0.60);
        ctx.fillStyle = '#5a8a3a';
        ctx.beginPath(); ctx.arc(px + s*0.56, py + s*0.24, s*0.18, 0, Math.PI*2); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(px + s*0.62, py + s*0.18); ctx.lineTo(px + s*0.92, py + s*0.28); ctx.lineTo(px + s*0.62, py + s*0.34);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#f0e6c0';
        ctx.beginPath(); ctx.moveTo(px + s*0.66, py + s*0.30); ctx.lineTo(px + s*0.70, py + s*0.42); ctx.lineTo(px + s*0.74, py + s*0.30); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#000'; ctx.fillRect(px + s*0.58, py + s*0.18, s*0.07, s*0.05);
        ctx.fillStyle = '#ffaa44'; ctx.fillRect(px + s*0.60, py + s*0.19, s*0.02, s*0.03);
        ctx.fillStyle = '#5a8a3a'; ctx.fillRect(px + s*0.54, py + s*0.40, s*0.14, s*0.26);
        ctx.fillStyle = '#3a2410'; ctx.fillRect(px + s*0.78, py + s*0.34, s*0.10, s*0.40);
        ctx.fillStyle = '#553a18';
        ctx.beginPath(); ctx.arc(px + s*0.83, py + s*0.32, s*0.10, 0, Math.PI*2); ctx.fill();
        ctx.restore();
        break;
      }
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
    case 'treant': {
      const facing = creatureFacing(e);
      if (facing === 'up') {
        // Back: bark, grain and crown from behind, a seam up the trunk, no face.
        ctx.fillStyle = '#2a3a1a';
        ctx.fillRect(px + s*0.30, py + s*0.40, s*0.40, s*0.50);
        ctx.fillStyle = '#3a4a22';
        ctx.fillRect(px + s*0.50, py + s*0.40, s*0.20, s*0.50);
        ctx.fillStyle = '#1a2a0a';
        ctx.fillRect(px + s*0.48, py + s*0.42, s*0.04, s*0.46);
        ctx.strokeStyle = '#1a2a0a';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(px + s*0.66, py + s*0.46 + i*s*0.14); ctx.lineTo(px + s*0.34, py + s*0.46 + i*s*0.14 + s*0.04); ctx.stroke(); }
        ctx.fillStyle = '#1a2a0a';
        ctx.fillRect(px + s*0.20, py + s*0.86, s*0.18, s*0.10);
        ctx.fillRect(px + s*0.62, py + s*0.86, s*0.18, s*0.10);
        ctx.fillStyle = '#3a6a22';
        [[0.50,0.26],[0.24,0.38],[0.76,0.38],[0.32,0.14],[0.68,0.14],[0.50,0.04]].forEach(([fx,fy]) => { ctx.beginPath(); ctx.arc(px + s*fx, py + s*fy, s*0.18, 0, Math.PI*2); ctx.fill(); });
        // shaded underside of the crown, and the branch tips pushing through
        ctx.fillStyle = '#2a3a1a';
        [[0.30,0.40],[0.56,0.30],[0.72,0.42]].forEach(([fx,fy]) => { ctx.beginPath(); ctx.arc(px + s*fx, py + s*fy, s*0.11, 0, Math.PI*2); ctx.fill(); });
        ctx.fillStyle = '#4a8a32';
        [[0.44,0.10],[0.64,0.20]].forEach(([fx,fy]) => { ctx.beginPath(); ctx.arc(px + s*fx, py + s*fy, s*0.09, 0, Math.PI*2); ctx.fill(); });
        ctx.strokeStyle = '#2a3a1a';
        ctx.lineWidth = Math.max(3, s*0.10);
        ctx.beginPath(); ctx.moveTo(px + s*0.30, py + s*0.54); ctx.lineTo(px + s*0.06, py + s*0.36); ctx.moveTo(px + s*0.70, py + s*0.54); ctx.lineTo(px + s*0.94, py + s*0.36); ctx.stroke();
        break;
      }
      if (facing !== 'down') {
        // Side, drawn facing right: a narrower trunk, one eye, one arm forward.
        ctx.save();
        mirrorIfLeft(facing, cx);
        ctx.fillStyle = '#2a3a1a';
        ctx.fillRect(px + s*0.34, py + s*0.40, s*0.30, s*0.50);
        ctx.fillStyle = '#3a4a22';
        ctx.fillRect(px + s*0.34, py + s*0.40, s*0.14, s*0.50);
        ctx.strokeStyle = '#1a2a0a';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(px + s*0.38, py + s*0.46 + i*s*0.14); ctx.lineTo(px + s*0.60, py + s*0.46 + i*s*0.14 + s*0.04); ctx.stroke(); }
        ctx.fillStyle = '#1a2a0a';
        ctx.fillRect(px + s*0.26, py + s*0.86, s*0.16, s*0.10);
        ctx.fillRect(px + s*0.56, py + s*0.86, s*0.16, s*0.10);
        ctx.fillStyle = '#3a6a22';
        [[0.44,0.30],[0.26,0.34],[0.60,0.32],[0.36,0.18],[0.54,0.16]].forEach(([fx,fy]) => { ctx.beginPath(); ctx.arc(px + s*fx, py + s*fy, s*0.16, 0, Math.PI*2); ctx.fill(); });
        ctx.fillStyle = '#4a8a32';
        [[0.40,0.24],[0.52,0.18]].forEach(([fx,fy]) => { ctx.beginPath(); ctx.arc(px + s*fx, py + s*fy, s*0.10, 0, Math.PI*2); ctx.fill(); });
        ctx.strokeStyle = '#2a3a1a';
        ctx.lineWidth = Math.max(3, s*0.10);
        ctx.beginPath(); ctx.moveTo(px + s*0.62, py + s*0.52); ctx.lineTo(px + s*0.88, py + s*0.38); ctx.stroke();
        ctx.fillStyle = `rgba(255,90,30,${0.7 + flap * 0.3})`;
        ctx.fillRect(px + s*0.52, py + s*0.50, s*0.08, s*0.06);
        ctx.fillStyle = '#0a1206';
        ctx.fillRect(px + s*0.56, py + s*0.62, s*0.10, s*0.04);
        ctx.restore();
        break;
      }
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
    case 'carrion_crawler': {
      const facing = creatureFacing(e);
      if (facing === 'up') {
        // Back: carapace, spine spikes and the hood of the head, no face.
        ctx.fillStyle = '#7a8a2e';
        ctx.beginPath(); ctx.ellipse(cx, py + s*0.62, s*0.20, s*0.30, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#5a6820';
        ctx.beginPath(); ctx.ellipse(cx, py + s*0.62, s*0.15, s*0.26, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#94a43a';
        [0.44,0.56,0.68,0.80].forEach(fy => { ctx.beginPath(); ctx.moveTo(cx - s*0.05, py + s*fy); ctx.lineTo(cx, py + s*(fy-0.09)); ctx.lineTo(cx + s*0.05, py + s*fy); ctx.closePath(); ctx.fill(); });
        ctx.strokeStyle = '#4a5818'; ctx.lineWidth = Math.max(1.5, s*0.03); ctx.lineCap = 'round';
        [0.50,0.62,0.74,0.86].forEach(fy => { ctx.beginPath(); ctx.moveTo(px + s*0.32, py + s*fy); ctx.lineTo(px + s*0.16, py + s*(fy+0.06)); ctx.moveTo(px + s*0.68, py + s*fy); ctx.lineTo(px + s*0.84, py + s*(fy+0.06)); ctx.stroke(); });
        ctx.fillStyle = '#94a43a';
        ctx.beginPath(); ctx.arc(cx, py + s*0.28, s*0.16, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#5a6820'; ctx.lineWidth = Math.max(1.5, s*0.03);
        ctx.beginPath(); ctx.moveTo(cx - s*0.13, py + s*0.32); ctx.quadraticCurveTo(cx, py + s*0.14, cx + s*0.13, py + s*0.32); ctx.stroke();
        break;
      }
      if (facing !== 'down') {
        // Side, drawn facing right: a narrower body, one eye, tentacles forward.
        ctx.save();
        mirrorIfLeft(facing, cx);
        ctx.fillStyle = '#7a8a2e';
        ctx.beginPath(); ctx.ellipse(px + s*0.42, py + s*0.62, s*0.22, s*0.24, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#94a43a';
        ctx.beginPath(); ctx.ellipse(px + s*0.40, py + s*0.60, s*0.14, s*0.18, 0, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#5a6820'; ctx.lineWidth = 1.5;
        [0.30,0.42,0.54].forEach(fx => { ctx.beginPath(); ctx.moveTo(px + s*fx, py + s*0.44); ctx.lineTo(px + s*fx, py + s*0.80); ctx.stroke(); });
        ctx.strokeStyle = '#4a5818'; ctx.lineWidth = Math.max(1.5, s*0.03); ctx.lineCap = 'round';
        [[0.34,0.90],[0.50,0.92]].forEach(([fx,fy]) => { ctx.beginPath(); ctx.moveTo(px + s*fx, py + s*0.70); ctx.lineTo(px + s*(fx-0.06), py + s*fy); ctx.stroke(); });
        ctx.fillStyle = '#94a43a';
        ctx.beginPath(); ctx.arc(px + s*0.66, py + s*0.34, s*0.15, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#aa66aa'; ctx.lineWidth = Math.max(1.5, s*0.03); ctx.lineCap = 'round';
        for (let i=0;i<4;i++){ const a = (i-1.5)*0.36; const wob = Math.sin(Date.now()/150 + i + phase)*0.2; ctx.beginPath(); ctx.moveTo(px + s*0.76, py + s*0.40); ctx.lineTo(px + s*0.76 + Math.cos(a+wob)*s*0.16, py + s*0.40 + Math.sin(a+wob)*s*0.16); ctx.stroke(); }
        ctx.fillStyle = '#1a2206'; ctx.fillRect(px + s*0.68, py + s*0.30, s*0.04, s*0.04);
        ctx.restore();
        break;
      }
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
      const facing = creatureFacing(e);
      if (facing === 'up') {
        // Back: the same body and legs, eye-stalks up but no maw, a warty ridge down the back.
        ctx.fillStyle = '#7a7a3a';
        ctx.beginPath(); ctx.ellipse(cx, py + s*0.62, s*0.34, s*0.26, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#92923f';
        ctx.beginPath(); ctx.ellipse(cx + s*0.04, py + s*0.56, s*0.24, s*0.18, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#5a5a28';
        [0.24,0.46,0.68].forEach(fx => ctx.fillRect(px + s*fx, py + s*0.80, s*0.10, s*0.14));
        [0.48,0.58,0.68].forEach(fy => { ctx.beginPath(); ctx.arc(cx, py + s*fy, s*0.05, 0, Math.PI*2); ctx.fill(); });
        ctx.strokeStyle = '#7a7a3a'; ctx.lineWidth = Math.max(2, s*0.05); ctx.lineCap = 'round';
        const owb = Math.sin(Date.now()/200 + phase)*s*0.04;
        ctx.beginPath(); ctx.moveTo(px + s*0.38, py + s*0.40); ctx.lineTo(px + s*0.30 + owb, py + s*0.14); ctx.moveTo(px + s*0.62, py + s*0.40); ctx.lineTo(px + s*0.70 - owb, py + s*0.14); ctx.stroke();
        ctx.fillStyle = '#ffcc33';
        ctx.beginPath(); ctx.arc(px + s*0.30 + owb, py + s*0.12, s*0.05, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(px + s*0.70 - owb, py + s*0.12, s*0.05, 0, Math.PI*2); ctx.fill();
        break;
      }
      if (facing !== 'down') {
        // Side, drawn facing right: a narrower bulk, one stalk, the maw out front.
        ctx.save();
        mirrorIfLeft(facing, cx);
        ctx.fillStyle = '#7a7a3a';
        ctx.beginPath(); ctx.ellipse(px + s*0.44, py + s*0.62, s*0.26, s*0.24, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#92923f';
        ctx.beginPath(); ctx.ellipse(px + s*0.42, py + s*0.56, s*0.18, s*0.16, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#5a5a28';
        [0.30,0.52].forEach(fx => ctx.fillRect(px + s*fx, py + s*0.80, s*0.10, s*0.14));
        ctx.fillStyle = '#2a1a14';
        ctx.beginPath(); ctx.ellipse(px + s*0.66, py + s*0.60, s*0.16, s*0.10, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#d8d0b0';
        for (let i=0;i<4;i++) ctx.fillRect(px + s*0.54 + i*s*0.07, py + s*0.54, s*0.025, s*0.05);
        ctx.strokeStyle = '#7a7a3a'; ctx.lineWidth = Math.max(2, s*0.05); ctx.lineCap = 'round';
        const ows = Math.sin(Date.now()/200 + phase)*s*0.04;
        ctx.beginPath(); ctx.moveTo(px + s*0.50, py + s*0.42); ctx.lineTo(px + s*0.60 + ows, py + s*0.16); ctx.stroke();
        ctx.fillStyle = '#ffcc33';
        ctx.beginPath(); ctx.arc(px + s*0.60 + ows, py + s*0.14, s*0.05, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.arc(px + s*0.62 + ows, py + s*0.14, s*0.02, 0, Math.PI*2); ctx.fill();
        ctx.restore();
        break;
      }
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
      const facing = creatureFacing(e);
      if (facing === 'up') {
        // Back: both wings from behind, a ridged back, the frill horns, no eye.
        const gub = Math.sin(Date.now()/120 + phase)*0.2 + 1;
        ctx.fillStyle = '#2a5a2a';
        ctx.beginPath(); ctx.moveTo(px + s*0.06, py + s*0.36/gub); ctx.lineTo(px + s*0.48, py + s*0.34); ctx.lineTo(px + s*0.30, py + s*0.60); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(px + s*0.94, py + s*0.36/gub); ctx.lineTo(px + s*0.52, py + s*0.34); ctx.lineTo(px + s*0.70, py + s*0.60); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#3a6e34';
        ctx.beginPath(); ctx.ellipse(cx, py + s*0.56, s*0.20, s*0.30, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#2a5a2a';
        [0.42,0.52,0.62,0.72].forEach(fy => { ctx.beginPath(); ctx.moveTo(cx - s*0.04, py + s*fy); ctx.lineTo(cx, py + s*(fy-0.07)); ctx.lineTo(cx + s*0.04, py + s*fy); ctx.closePath(); ctx.fill(); });
        ctx.fillStyle = '#4a8240';
        ctx.beginPath(); ctx.arc(cx, py + s*0.26, s*0.17, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#2a5a2a';
        ctx.beginPath(); ctx.moveTo(px + s*0.42, py + s*0.18); ctx.lineTo(px + s*0.30, py + s*0.04); ctx.lineTo(px + s*0.48, py + s*0.16); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(px + s*0.58, py + s*0.18); ctx.lineTo(px + s*0.70, py + s*0.04); ctx.lineTo(px + s*0.52, py + s*0.16); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#3a6e34'; ctx.lineWidth = Math.max(2, s*0.06);
        ctx.beginPath(); ctx.moveTo(cx, py + s*0.82); ctx.lineTo(cx - Math.sin(Date.now()/180+phase)*s*0.20, py + s); ctx.stroke();
        break;
      }
      if (facing !== 'down') {
        // Side, drawn facing right: a long neck, the snout out to the right, one wing, one eye.
        ctx.save();
        mirrorIfLeft(facing, cx);
        const gus = Math.sin(Date.now()/120 + phase)*0.2 + 1;
        ctx.fillStyle = '#2a5a2a';
        ctx.beginPath(); ctx.moveTo(px + s*0.26, py + s*0.40/gus); ctx.lineTo(px + s*0.52, py + s*0.34); ctx.lineTo(px + s*0.40, py + s*0.58); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#3a6e34';
        ctx.beginPath(); ctx.ellipse(px + s*0.44, py + s*0.56, s*0.20, s*0.28, 0, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#3a6e34'; ctx.lineWidth = Math.max(4, s*0.14); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(px + s*0.50, py + s*0.46); ctx.lineTo(px + s*0.66, py + s*0.30); ctx.stroke();
        ctx.fillStyle = '#4a8240';
        ctx.beginPath(); ctx.arc(px + s*0.68, py + s*0.28, s*0.14, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#3a6e34';
        ctx.fillRect(px + s*0.78, py + s*0.28, s*0.12, s*0.07);
        ctx.fillStyle = '#2a5a2a';
        ctx.beginPath(); ctx.moveTo(px + s*0.60, py + s*0.20); ctx.lineTo(px + s*0.46, py + s*0.08); ctx.lineTo(px + s*0.64, py + s*0.18); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ddee44'; ctx.fillRect(px + s*0.72, py + s*0.24, s*0.06, s*0.05);
        ctx.fillStyle = '#000'; ctx.fillRect(px + s*0.74, py + s*0.25, s*0.02, s*0.03);
        ctx.fillStyle = `rgba(150,220,80,${0.5+flap*0.3})`;
        ctx.beginPath(); ctx.arc(px + s*0.94, py + s*0.36, s*0.06, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#3a6e34'; ctx.lineWidth = Math.max(2, s*0.06);
        ctx.beginPath(); ctx.moveTo(px + s*0.28, py + s*0.66); ctx.lineTo(px + s*0.06, py + s*0.88); ctx.stroke();
        ctx.restore();
        break;
      }
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
      const facing = creatureFacing(e);
      if (facing === 'down') {
        // Front: reared up, the round maw open straight at the viewer.
        ctx.strokeStyle = '#5e2e5e'; ctx.lineWidth = Math.max(6, s*0.32); ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(px + s*0.32, py + s*0.94);
        ctx.quadraticCurveTo(px + s*0.26, py + s*0.58, cx, py + s*0.42);
        ctx.stroke();
        ctx.strokeStyle = '#7a417a'; ctx.lineWidth = Math.max(3, s*0.16);
        ctx.beginPath();
        ctx.moveTo(px + s*0.34, py + s*0.92);
        ctx.quadraticCurveTo(px + s*0.30, py + s*0.60, cx, py + s*0.44);
        ctx.stroke();
        ctx.strokeStyle = '#3e1e3e'; ctx.lineWidth = Math.max(1.5, s*0.03);
        [[0.26,0.78],[0.24,0.62],[0.34,0.50]].forEach(([fx,fy]) => { ctx.beginPath(); ctx.arc(px + s*fx, py + s*fy, s*0.13, 0.3, 2.8); ctx.stroke(); });
        ctx.fillStyle = '#3a1a3a';
        ctx.beginPath(); ctx.arc(cx, py + s*0.30, s*0.21, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#1a0a1a';
        ctx.beginPath(); ctx.arc(cx, py + s*0.30, s*0.13, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#e0d8c0';
        for (let i=0;i<8;i++){ const a = i*Math.PI/4 + Date.now()/600; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a)*s*0.13, py + s*0.30 + Math.sin(a)*s*0.13); ctx.lineTo(cx + Math.cos(a)*s*0.20, py + s*0.30 + Math.sin(a)*s*0.20); ctx.lineTo(cx + Math.cos(a+0.3)*s*0.14, py + s*0.30 + Math.sin(a+0.3)*s*0.14); ctx.closePath(); ctx.fill(); }
        break;
      }
      if (facing === 'up') {
        // Back: the body arching away, a blunt ringed body end to the viewer, no maw.
        ctx.strokeStyle = '#5e2e5e'; ctx.lineWidth = Math.max(6, s*0.26); ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(px + s*0.84, py + s*0.92);
        ctx.quadraticCurveTo(px + s*0.90, py + s*0.50, px + s*0.60, py + s*0.34);
        ctx.quadraticCurveTo(px + s*0.38, py + s*0.22, cx - s*0.04, py + s*0.22);
        ctx.stroke();
        ctx.strokeStyle = '#7a417a'; ctx.lineWidth = Math.max(3, s*0.12);
        ctx.beginPath();
        ctx.moveTo(px + s*0.82, py + s*0.90);
        ctx.quadraticCurveTo(px + s*0.86, py + s*0.52, px + s*0.60, py + s*0.36);
        ctx.stroke();
        ctx.strokeStyle = '#3e1e3e'; ctx.lineWidth = Math.max(1.5, s*0.03);
        [[0.84,0.78],[0.87,0.62],[0.76,0.44],[0.58,0.34]].forEach(([fx,fy]) => { ctx.beginPath(); ctx.arc(px + s*fx, py + s*fy, s*0.13, 0.3, 2.8); ctx.stroke(); });
        ctx.fillStyle = '#5e2e5e';
        ctx.beginPath(); ctx.ellipse(px + s*0.84, py + s*0.90, s*0.17, s*0.13, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#7a417a';
        ctx.beginPath(); ctx.ellipse(px + s*0.84, py + s*0.88, s*0.12, s*0.09, 0, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#3e1e3e';
        ctx.beginPath(); ctx.ellipse(px + s*0.84, py + s*0.88, s*0.07, s*0.05, 0, 0, Math.PI*2); ctx.stroke();
        break;
      }
      // Side. This was always the worm's only view, the head up and to the right.
      ctx.save();
      mirrorIfLeft(facing, cx);
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
      ctx.restore();
      break;
    }
    case 'hydra_queen': {
      const facing = creatureFacing(e);
      if (facing === 'up') {
        if (e.boss) {
          const aur = s*0.62 + Math.sin(Date.now()/220)*s*0.04;
          const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, aur);
          gr.addColorStop(0, 'rgba(120,200,70,0.38)'); gr.addColorStop(1, 'rgba(120,200,70,0)');
          ctx.fillStyle = gr; ctx.fillRect(cx-aur, cy-aur, aur*2, aur*2);
        }
        // Back: the same body and necks, the backs of the heads crested, no faces.
        ctx.fillStyle = '#4a7a2a';
        ctx.beginPath(); ctx.ellipse(cx, py + s*0.72, s*0.34, s*0.22, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#5e9636';
        ctx.beginPath(); ctx.ellipse(cx + s*0.04, py + s*0.68, s*0.24, s*0.15, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#4a7a2a';
        [0.62,0.72,0.82].forEach(fy => { ctx.beginPath(); ctx.moveTo(cx - s*0.05, py + s*fy); ctx.lineTo(cx, py + s*(fy-0.07)); ctx.lineTo(cx + s*0.05, py + s*fy); ctx.closePath(); ctx.fill(); });
        [[0.12,0.30,0.105],[0.30,0.12,0.09],[0.50,0.02,0.08],[0.70,0.12,0.09],[0.88,0.30,0.105]].forEach(([hx,hy,hr], i) => {
          const swy = Math.sin(Date.now()/220 + phase + i*1.3)*s*0.03;
          ctx.strokeStyle = '#5e9636'; ctx.lineWidth = Math.max(3, s*(hr*0.8)); ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(cx, py + s*0.62); ctx.quadraticCurveTo(px + s*(hx+0.06) + swy, py + s*(hy+0.30), px + s*hx + swy, py + s*(hy+0.12)); ctx.stroke();
          ctx.fillStyle = '#6faa3e';
          ctx.beginPath(); ctx.arc(px + s*hx + swy, py + s*(hy+0.10), s*hr, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = '#4a7a2a';
          ctx.beginPath(); ctx.moveTo(px + s*hx + swy - s*0.05, py + s*(hy+0.04)); ctx.lineTo(px + s*hx + swy, py + s*(hy-0.06)); ctx.lineTo(px + s*hx + swy + s*0.05, py + s*(hy+0.04)); ctx.closePath(); ctx.fill();
        });
        break;
      }
      if (facing !== 'down') {
        if (e.boss) {
          const aur = s*0.62 + Math.sin(Date.now()/220)*s*0.04;
          const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, aur);
          gr.addColorStop(0, 'rgba(120,200,70,0.38)'); gr.addColorStop(1, 'rgba(120,200,70,0)');
          ctx.fillStyle = gr; ctx.fillRect(cx-aur, cy-aur, aur*2, aur*2);
        }
        // Side, drawn facing right: a narrower bulk, four necks, every head to the right.
        ctx.save();
        mirrorIfLeft(facing, cx);
        ctx.fillStyle = '#4a7a2a';
        ctx.beginPath(); ctx.ellipse(px + s*0.42, py + s*0.72, s*0.26, s*0.20, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#5e9636';
        ctx.beginPath(); ctx.ellipse(px + s*0.40, py + s*0.68, s*0.18, s*0.13, 0, 0, Math.PI*2); ctx.fill();
        [[0.58,0.06],[0.70,0.18],[0.78,0.30],[0.62,0.42]].forEach(([hx,hy], i) => {
          const swy = Math.sin(Date.now()/220 + phase + i*1.3)*s*0.03;
          ctx.strokeStyle = '#5e9636'; ctx.lineWidth = Math.max(3, s*0.08); ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(px + s*0.44, py + s*0.60); ctx.quadraticCurveTo(px + s*0.54 + swy, py + s*(hy+0.36), px + s*hx + swy, py + s*(hy+0.10)); ctx.stroke();
          ctx.fillStyle = '#6faa3e';
          ctx.beginPath(); ctx.arc(px + s*hx + swy, py + s*(hy+0.08), s*0.085, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = '#5e9636';
          ctx.fillRect(px + s*hx + swy + s*0.05, py + s*(hy+0.08), s*0.10, s*0.05);
          ctx.fillStyle = `rgba(220,255,120,${0.7+flap*0.3})`;
          ctx.fillRect(px + s*hx + swy + s*0.01, py + s*(hy+0.03), s*0.03, s*0.03);
          ctx.fillStyle = '#dff0c0';
          ctx.fillRect(px + s*hx + swy + s*0.06, py + s*(hy+0.13), s*0.015, s*0.03);
        });
        ctx.fillStyle = `rgba(150,230,80,${0.6+flap*0.4})`;
        ctx.beginPath(); ctx.arc(px + s*0.90, py + s*0.52, s*0.03, 0, Math.PI*2); ctx.fill();
        ctx.restore();
        break;
      }
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
    case 'toxic_bloom': {
      // A fungal bloom, rooted to its tile. The important part is not the plant
      // but the TELL: the cloud swells visibly for the last 900ms before it
      // bursts, and that ring is drawn from the same number the damage fires on
      // (bloomSwell, enemies.js). A rooted enemy hitting an area with no wind-up
      // would be unreadable, so the swell is the mechanic, not decoration.
      const sw = (typeof bloomSwell === 'function') ? bloomSwell(e) : 0;
      const rad = (typeof BLOOM_RADIUS !== 'undefined') ? BLOOM_RADIUS : 2.6;

      // The threatened ground, faint at all times so the footprint is knowable
      // before it ever fires, and bright as it swells.
      ctx.save();
      ctx.globalAlpha = 0.07 + 0.30 * sw;
      const gg = ctx.createRadialGradient(cx, py + s*0.55, 0, cx, py + s*0.55, rad * ts);
      gg.addColorStop(0, '#c8e08a');
      gg.addColorStop(1, 'rgba(138,184,58,0)');
      ctx.fillStyle = gg;
      ctx.beginPath(); ctx.arc(cx, py + s*0.55, rad * ts, 0, Math.PI*2); ctx.fill();
      ctx.restore();

      // Root cluster and stalk
      ctx.fillStyle = '#4a5a2a';
      ctx.beginPath(); ctx.ellipse(cx, py + s*0.90, s*0.30, s*0.10, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#6a7a38';
      ctx.fillRect(cx - s*0.06, py + s*0.52, s*0.12, s*0.40);

      // The sac, inflating with the swell — the plant itself shows the wind-up.
      const bulge = 1 + 0.28 * sw;
      ctx.fillStyle = '#8ab83a';
      ctx.beginPath();
      ctx.ellipse(cx, py + s*0.44, s*0.28*bulge, s*0.24*bulge, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = `rgba(200,224,138,${0.35 + 0.5*sw})`;
      ctx.beginPath();
      ctx.ellipse(cx - s*0.08, py + s*0.38, s*0.10*bulge, s*0.08*bulge, 0, 0, Math.PI*2);
      ctx.fill();

      // Spore pores, opening as it fills
      ctx.fillStyle = '#3d5218';
      for (let i = 0; i < 4; i++) {
        const a = i * 1.57 + 0.4;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a)*s*0.15, py + s*0.44 + Math.sin(a)*s*0.12,
                s*(0.022 + 0.026*sw), 0, Math.PI*2);
        ctx.fill();
      }
      break;
    }
  }
}

registerEnemyArt(drawPoisonCreature, [
  'troll', 'treant', 'carrion_crawler', 'otyugh', 'green_dragon', 'purple_worm',
  'hydra_queen', 'toxic_bloom',
]);
