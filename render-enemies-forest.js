// Forest creatures and their boss. Reached through ENEMY_ART (render-enemies.js),
// which also draws what every creature shares: shadow, auras, HP bar and name tag.

function drawForestCreature(e, ts, s, px, py, cx, cy, flap, phase, fb, bob, boxTop) {
  switch (e.type) {
    case 'goblin': {
      const facing = creatureFacing(e);
      if (facing === 'up') {
        // Back: the same body and horns, with no face and a spine.
        ctx.fillStyle = '#2a5520'; ctx.fillRect(px + s*0.18, py + s*0.46, s*0.64, s*0.40);
        ctx.fillStyle = '#3a6a28'; ctx.fillRect(px + s*0.50, py + s*0.46, s*0.32, s*0.40);
        ctx.fillStyle = '#21451a'; ctx.fillRect(px + s*0.47, py + s*0.48, s*0.06, s*0.18);
        ctx.fillStyle = '#7a5018'; ctx.fillRect(px + s*0.22, py + s*0.66, s*0.56, s*0.10);
        ctx.fillStyle = '#3f6a30';
        ctx.beginPath();
        ctx.moveTo(px + s*0.18, py + s*0.30); ctx.lineTo(px + s*0.06, py + s*0.18); ctx.lineTo(px + s*0.22, py + s*0.38);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(px + s*0.82, py + s*0.30); ctx.lineTo(px + s*0.94, py + s*0.18); ctx.lineTo(px + s*0.78, py + s*0.38);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#2a1408';
        ctx.fillRect(px + s*0.30, py + s*0.04, s*0.10, s*0.16);
        ctx.fillRect(px + s*0.60, py + s*0.04, s*0.10, s*0.16);
        ctx.fillStyle = '#4a7a38';
        ctx.beginPath(); ctx.arc(cx, py + s*0.30, s*0.26, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#3f6a30';
        ctx.beginPath(); ctx.arc(cx, py + s*0.36, s*0.17, 0, Math.PI*2); ctx.fill();
        break;
      }
      if (facing !== 'down') {
        // Side, drawn facing right: one ear, one horn, one eye and a jutting jaw.
        ctx.save();
        mirrorIfLeft(facing, cx);
        ctx.fillStyle = '#2a5520'; ctx.fillRect(px + s*0.28, py + s*0.46, s*0.42, s*0.40);
        ctx.fillStyle = '#3a6a28'; ctx.fillRect(px + s*0.28, py + s*0.46, s*0.20, s*0.40);
        ctx.fillStyle = '#7a5018'; ctx.fillRect(px + s*0.26, py + s*0.66, s*0.46, s*0.10);
        ctx.fillStyle = '#2a1408'; ctx.fillRect(px + s*0.48, py + s*0.04, s*0.10, s*0.16);
        ctx.fillStyle = '#558844';
        ctx.beginPath(); ctx.arc(px + s*0.52, py + s*0.30, s*0.25, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#3f6a30';
        ctx.beginPath(); ctx.arc(px + s*0.74, py + s*0.36, s*0.09, 0, Math.PI*2); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(px + s*0.36, py + s*0.26); ctx.lineTo(px + s*0.12, py + s*0.14); ctx.lineTo(px + s*0.38, py + s*0.38);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#000'; ctx.fillRect(px + s*0.58, py + s*0.26, s*0.12, s*0.08);
        ctx.fillStyle = '#ff3322'; ctx.fillRect(px + s*0.60, py + s*0.28, s*0.08, s*0.05);
        ctx.fillStyle = '#ffeebb'; ctx.fillRect(px + s*0.66, py + s*0.29, s*0.02, s*0.02);
        ctx.fillStyle = '#fff'; ctx.fillRect(px + s*0.74, py + s*0.40, s*0.03, s*0.04);
        ctx.fillStyle = '#3f6a30'; ctx.fillRect(px + s*0.46, py + s*0.48, s*0.12, s*0.26);
        ctx.restore();
        break;
      }
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
      const facing = creatureFacing(e);
      if (facing === 'down' || facing === 'up') {
        const wolfLegs = Math.sin(Date.now()/180 + phase) > 0;
        ctx.fillStyle = '#3a2410';
        [0.28, 0.62].forEach((lx, idx) => {
          const legLen = (idx % 2 === (wolfLegs ? 0 : 1)) ? s*0.20 : s*0.24;
          ctx.fillRect(px + s*lx, py + s*0.74, s*0.10, legLen);
        });
        if (facing === 'up') {
          // Rump to the viewer: body, the head beyond it, and the tail down the middle.
          ctx.fillStyle = '#3a2410';
          ctx.beginPath();
          ctx.moveTo(px + s*0.34, py + s*0.12); ctx.lineTo(px + s*0.38, py + s*0.28); ctx.lineTo(px + s*0.46, py + s*0.18);
          ctx.closePath(); ctx.fill();
          ctx.beginPath();
          ctx.moveTo(px + s*0.66, py + s*0.12); ctx.lineTo(px + s*0.62, py + s*0.28); ctx.lineTo(px + s*0.54, py + s*0.18);
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#5a3a20';
          ctx.beginPath(); ctx.arc(cx, py + s*0.30, s*0.17, 0, Math.PI*2); ctx.fill();
          ctx.fillRect(px + s*0.24, py + s*0.38, s*0.52, s*0.38);
          ctx.fillStyle = '#74502a'; ctx.fillRect(px + s*0.24, py + s*0.38, s*0.52, s*0.16);
          ctx.strokeStyle = '#3a2410';
          ctx.lineWidth = Math.max(2, s*0.08);
          ctx.beginPath();
          ctx.moveTo(cx, py + s*0.46);
          ctx.lineTo(cx, py + s*0.72);
          ctx.stroke();
          break;
        }
        // Head on: the head over the chest, both eyes, the muzzle and the nose.
        ctx.fillStyle = '#5a3a20'; ctx.fillRect(px + s*0.24, py + s*0.42, s*0.52, s*0.34);
        ctx.fillStyle = '#74502a'; ctx.fillRect(px + s*0.24, py + s*0.42, s*0.52, s*0.12);
        ctx.fillStyle = '#3a2410';
        ctx.beginPath();
        ctx.moveTo(px + s*0.30, py + s*0.12); ctx.lineTo(px + s*0.36, py + s*0.30); ctx.lineTo(px + s*0.46, py + s*0.20);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(px + s*0.70, py + s*0.12); ctx.lineTo(px + s*0.64, py + s*0.30); ctx.lineTo(px + s*0.54, py + s*0.20);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#5a3a20';
        ctx.beginPath(); ctx.arc(cx, py + s*0.36, s*0.20, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#74502a';
        ctx.beginPath(); ctx.arc(cx, py + s*0.32, s*0.16, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#3a2410'; ctx.fillRect(px + s*0.42, py + s*0.38, s*0.16, s*0.14);
        ctx.fillStyle = '#000'; ctx.fillRect(px + s*0.46, py + s*0.38, s*0.08, s*0.05);
        ctx.fillStyle = '#ffd040';
        ctx.fillRect(px + s*0.36, py + s*0.29, s*0.06, s*0.05);
        ctx.fillRect(px + s*0.58, py + s*0.29, s*0.06, s*0.05);
        ctx.fillStyle = '#000';
        ctx.fillRect(px + s*0.38, py + s*0.30, s*0.02, s*0.03);
        ctx.fillRect(px + s*0.60, py + s*0.30, s*0.02, s*0.03);
        break;
      }
      // Side. This was always the wolf's only view, drawn facing right.
      ctx.save();
      mirrorIfLeft(facing, cx);
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
      ctx.restore();
      break;
    }
    case 'dryad': {
      const facing = creatureFacing(e);
      if (facing === 'up') {
        // Back: bark, a leaf cloak over the shoulders and leaf-hair down the back. No face.
        ctx.fillStyle = '#3a6a2a'; ctx.fillRect(px + s*0.22, py + s*0.42, s*0.56, s*0.46);
        ctx.fillStyle = '#4a8a3a';
        ctx.beginPath(); ctx.ellipse(cx, py + s*0.50, s*0.30, s*0.13, 0, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(px + s*0.24, py + s*0.62, s*0.13, s*0.09, 0.5, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(px + s*0.76, py + s*0.62, s*0.13, s*0.09, -0.5, 0, Math.PI*2); ctx.fill();
        [
          [0.5, 0.18], [0.32, 0.22], [0.68, 0.22], [0.40, 0.10], [0.60, 0.10]
        ].forEach(([fx, fy]) => {
          ctx.beginPath();
          ctx.ellipse(px + s*fx, py + s*fy, s*0.12, s*0.08, 0, 0, Math.PI*2);
          ctx.fill();
        });
        ctx.fillStyle = '#4a8a3a';
        ctx.beginPath(); ctx.arc(cx, py + s*0.36, s*0.18, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#3a6a2a';
        ctx.fillRect(cx - s*0.04, py + s*0.22, s*0.08, s*0.34);
        ctx.strokeStyle = '#1a3a14';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx - s*0.10, py + s*0.30); ctx.lineTo(cx - s*0.14, py + s*0.54);
        ctx.moveTo(cx + s*0.10, py + s*0.30); ctx.lineTo(cx + s*0.14, py + s*0.54);
        ctx.stroke();
        break;
      }
      if (facing !== 'down') {
        // Side, drawn facing right: narrow trunk, profile face, hair trailing left.
        ctx.save();
        mirrorIfLeft(facing, cx);
        ctx.fillStyle = '#3a6a2a'; ctx.fillRect(px + s*0.32, py + s*0.42, s*0.36, s*0.46);
        ctx.fillStyle = '#4a8a3a';
        ctx.beginPath(); ctx.ellipse(px + s*0.50, py + s*0.52, s*0.17, s*0.10, 0, 0, Math.PI*2); ctx.fill();
        // hair trailing back to the left
        ctx.beginPath();
        ctx.moveTo(px + s*0.44, py + s*0.24); ctx.lineTo(px + s*0.16, py + s*0.40); ctx.lineTo(px + s*0.44, py + s*0.44);
        ctx.closePath(); ctx.fill();
        [
          [0.58, 0.18], [0.42, 0.20], [0.66, 0.10]
        ].forEach(([fx, fy]) => {
          ctx.beginPath();
          ctx.ellipse(px + s*fx, py + s*fy, s*0.12, s*0.08, 0, 0, Math.PI*2);
          ctx.fill();
        });
        ctx.fillStyle = '#d7a868';
        ctx.beginPath(); ctx.arc(px + s*0.56, py + s*0.36, s*0.17, 0, Math.PI*2); ctx.fill();
        ctx.fillRect(px + s*0.70, py + s*0.34, s*0.04, s*0.05);
        ctx.fillStyle = '#000';
        ctx.fillRect(px + s*0.62, py + s*0.33, s*0.05, s*0.05);
        ctx.strokeStyle = '#1a3a14';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(px + s*0.42, py + s*0.52); ctx.lineTo(px + s*0.46, py + s*0.80);
        ctx.stroke();
        ctx.restore();
        break;
      }
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
    case 'pixie': {
      const facing = creatureFacing(e);
      if (facing === 'up') {
        // Back: the same glow and wings, a darker body and a pale spine, no face.
        for (let i = 0; i < 4; i++) {
          const a = Date.now()/300 + i + phase;
          ctx.fillStyle = `rgba(180,220,255,${0.4 + 0.4 * Math.sin(a)})`;
          ctx.beginPath();
          ctx.arc(cx + Math.cos(a) * s*0.32, cy + Math.sin(a) * s*0.32, s*0.04, 0, Math.PI*2);
          ctx.fill();
        }
        const wingB = 1 + Math.sin(Date.now()/60 + phase) * 0.4;
        ctx.fillStyle = `rgba(200,220,255,${0.4 + flap * 0.2})`;
        ctx.beginPath();
        ctx.ellipse(cx - s*0.22, cy - s*0.04, s*0.20 * wingB, s*0.14, -0.3, 0, Math.PI*2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx + s*0.22, cy - s*0.04, s*0.20 * wingB, s*0.14, 0.3, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = '#5566aa';
        ctx.beginPath(); ctx.arc(cx, cy, s*0.20, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#88aaff';
        ctx.beginPath(); ctx.arc(cx, cy + s*0.02, s*0.12, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#c0d8ff';
        ctx.fillRect(cx - s*0.02, cy - s*0.14, s*0.04, s*0.24);
        break;
      }
      if (facing !== 'down') {
        // Side, drawn facing right: a narrower swarm, wings edge-on, one eye.
        ctx.save();
        mirrorIfLeft(facing, cx);
        for (let i = 0; i < 4; i++) {
          const a = Date.now()/300 + i + phase;
          ctx.fillStyle = `rgba(180,220,255,${0.4 + 0.4 * Math.sin(a)})`;
          ctx.beginPath();
          ctx.arc(cx + Math.cos(a) * s*0.32, cy + Math.sin(a) * s*0.32, s*0.04, 0, Math.PI*2);
          ctx.fill();
        }
        const wingS = 1 + Math.sin(Date.now()/60 + phase) * 0.4;
        ctx.fillStyle = `rgba(200,220,255,${0.4 + flap * 0.2})`;
        ctx.beginPath();
        ctx.ellipse(cx - s*0.10, cy - s*0.06, s*0.06 * wingS, s*0.22, -0.2, 0, Math.PI*2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx - s*0.04, cy - s*0.06, s*0.05 * wingS, s*0.20, 0.2, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = '#88aaff';
        ctx.beginPath(); ctx.ellipse(cx + s*0.02, cy, s*0.14, s*0.20, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#c0d8ff';
        ctx.beginPath(); ctx.ellipse(cx + s*0.05, cy - s*0.04, s*0.09, s*0.13, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#000';
        ctx.fillRect(cx + s*0.07, cy - s*0.04, s*0.03, s*0.03);
        ctx.restore();
        break;
      }
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
    case 'owlbear': {
      const facing = creatureFacing(e);
      if (facing === 'up') {
        // Back: a feathered mantle over the shoulders, heels, and no face.
        ctx.fillStyle = '#4a3208'; ctx.fillRect(px + s*0.16, py + s*0.34, s*0.68, s*0.56);
        ctx.fillStyle = '#7a5018'; ctx.fillRect(px + s*0.50, py + s*0.34, s*0.34, s*0.56);
        ctx.fillStyle = '#8a6622';
        ctx.beginPath(); ctx.ellipse(cx, py + s*0.48, s*0.28, s*0.20, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#6a4c14';
        for (let i = 0; i < 3; i++) {
          ctx.beginPath(); ctx.arc(cx + s*(i - 1)*0.15, py + s*0.60, s*0.08, 0, Math.PI); ctx.fill();
        }
        ctx.fillStyle = '#4a3208';
        ctx.beginPath(); ctx.moveTo(px + s*0.24, py + s*0.10); ctx.lineTo(px + s*0.30, py + s*0.04); ctx.lineTo(px + s*0.34, py + s*0.14); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(px + s*0.76, py + s*0.10); ctx.lineTo(px + s*0.70, py + s*0.04); ctx.lineTo(px + s*0.66, py + s*0.14); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#8a6622';
        ctx.beginPath(); ctx.arc(cx, py + s*0.28, s*0.28, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#74561c';
        ctx.beginPath(); ctx.arc(cx, py + s*0.32, s*0.20, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#2e1f05';
        ctx.fillRect(px + s*0.20, py + s*0.84, s*0.16, s*0.06);
        ctx.fillRect(px + s*0.64, py + s*0.84, s*0.16, s*0.06);
        break;
      }
      if (facing !== 'down') {
        // Side, drawn facing right: chest forward, one huge eye, the beak in profile.
        ctx.save();
        mirrorIfLeft(facing, cx);
        ctx.fillStyle = '#4a3208'; ctx.fillRect(px + s*0.20, py + s*0.34, s*0.56, s*0.56);
        ctx.fillStyle = '#7a5018'; ctx.fillRect(px + s*0.20, py + s*0.34, s*0.28, s*0.56);
        ctx.fillStyle = '#c8a464';
        ctx.beginPath(); ctx.ellipse(px + s*0.70, py + s*0.62, s*0.09, s*0.20, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#4a3208';
        ctx.beginPath(); ctx.moveTo(px + s*0.40, py + s*0.10); ctx.lineTo(px + s*0.44, py + s*0.02); ctx.lineTo(px + s*0.52, py + s*0.12); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#8a6622';
        ctx.beginPath(); ctx.arc(px + s*0.56, py + s*0.28, s*0.26, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#a07a30';
        ctx.beginPath(); ctx.arc(px + s*0.54, py + s*0.26, s*0.20, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(px + s*0.66, py + s*0.26, s*0.10, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#ffaa00';
        ctx.beginPath(); ctx.arc(px + s*0.67, py + s*0.26, s*0.07, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.arc(px + s*0.69, py + s*0.26, s*0.035, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#552a08';
        ctx.beginPath();
        ctx.moveTo(px + s*0.78, py + s*0.30);
        ctx.lineTo(px + s*0.92, py + s*0.36);
        ctx.lineTo(px + s*0.76, py + s*0.42);
        ctx.closePath(); ctx.fill();
        // The near arm, a shade off the body and rounded, so it reads as a limb.
        ctx.fillStyle = '#5f4210';
        ctx.beginPath(); ctx.ellipse(px + s*0.46, py + s*0.60, s*0.09, s*0.23, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#f0e0a0';
        ctx.fillRect(px + s*0.54, py + s*0.84, s*0.04, s*0.06);
        ctx.fillRect(px + s*0.70, py + s*0.86, s*0.04, s*0.06);
        ctx.restore();
        break;
      }
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
    case 'giant_spider': {
      const facing = creatureFacing(e);
      if (facing === 'up') {
        // Back: the abdomen toward the viewer with spinnerets, the head hidden, no eyes.
        ctx.strokeStyle = '#241c2e'; ctx.lineWidth = Math.max(2, s*0.05); ctx.lineCap = 'round';
        for (let i = 0; i < 4; i++) {
          const ly = py + s*0.40 + i * s*0.10;
          const k = Math.sin(Date.now()/160 + phase + i) * s*0.04;
          ctx.beginPath();
          ctx.moveTo(cx - s*0.10, py + s*0.54); ctx.lineTo(px + s*0.02, ly + k);
          ctx.moveTo(cx + s*0.10, py + s*0.54); ctx.lineTo(px + s*0.98, ly - k);
          ctx.stroke();
        }
        ctx.fillStyle = '#4a3a55';
        ctx.beginPath(); ctx.arc(cx, py + s*0.32, s*0.13, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#352841';
        ctx.beginPath(); ctx.ellipse(cx, py + s*0.56, s*0.30, s*0.28, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#4a3a55';
        ctx.beginPath(); ctx.ellipse(cx - s*0.05, py + s*0.80, s*0.05, s*0.04, 0, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(cx + s*0.05, py + s*0.80, s*0.05, s*0.04, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#aa3344';
        ctx.beginPath(); ctx.moveTo(cx, py + s*0.42); ctx.lineTo(cx - s*0.07, py + s*0.56); ctx.lineTo(cx, py + s*0.70); ctx.lineTo(cx + s*0.07, py + s*0.56); ctx.closePath(); ctx.fill();
        break;
      }
      if (facing !== 'down') {
        // Side, drawn facing right: head and eyes to the right, abdomen to the left.
        ctx.save();
        mirrorIfLeft(facing, cx);
        ctx.strokeStyle = '#241c2e'; ctx.lineWidth = Math.max(2, s*0.05); ctx.lineCap = 'round';
        for (let i = 0; i < 4; i++) {
          const k = Math.sin(Date.now()/160 + phase + i) * s*0.04;
          ctx.beginPath();
          ctx.moveTo(cx, py + s*0.56); ctx.lineTo(px + s*0.20 + i*s*0.16, py + s*0.86 + k);
          ctx.stroke();
        }
        ctx.fillStyle = '#352841';
        ctx.beginPath(); ctx.ellipse(px + s*0.30, py + s*0.52, s*0.26, s*0.22, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#4a3a55';
        ctx.beginPath(); ctx.arc(px + s*0.72, py + s*0.52, s*0.15, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#ff3344';
        [[0.78,0.46],[0.84,0.50],[0.78,0.54]].forEach(([ex,ey]) => ctx.fillRect(px + s*ex, py + s*ey, s*0.03, s*0.03));
        ctx.fillStyle = '#e8e0d0';
        ctx.fillRect(px + s*0.80, py + s*0.62, s*0.03, s*0.05);
        ctx.restore();
        break;
      }
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
  }
}

registerEnemyArt(drawForestCreature, [
  'goblin', 'wolf', 'dryad', 'pixie', 'owlbear', 'giant_spider',
]);
