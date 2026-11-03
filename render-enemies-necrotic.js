// Necrotic creatures and their boss. Reached through ENEMY_ART (render-enemies.js),
// which also draws what every creature shares: shadow, auras, HP bar and name tag.
// The Forest Lich is here too: it shares the ordinary lich's drawing.

function drawNecroticCreature(e, ts, s, px, py, cx, cy, flap, phase, fb, bob, boxTop) {
  switch (e.type) {
    case 'skeleton': {
      const facing = creatureFacing(e);
      if (facing === 'up') {
        // Back: ribs and a wide spine, shoulder blades, a blank skull with its seam.
        ctx.fillStyle = '#d6d4b6';
        ctx.fillRect(px + s*0.30, py + s*0.44, s*0.40, s*0.40);
        ctx.fillStyle = '#a8a48a';
        for (let i = 0; i < 3; i++) ctx.fillRect(px + s*0.32, py + s*0.50 + i * s*0.08, s*0.36, s*0.03);
        ctx.fillStyle = '#7d7464';
        ctx.fillRect(px + s*0.46, py + s*0.44, s*0.08, s*0.40);
        ctx.fillStyle = '#a8a48a';
        ctx.fillRect(px + s*0.32, py + s*0.46, s*0.12, s*0.09);
        ctx.fillRect(px + s*0.56, py + s*0.46, s*0.12, s*0.09);
        ctx.fillStyle = '#d6d4b6';
        ctx.fillRect(px + s*0.26, py + s*0.82, s*0.48, s*0.10);
        ctx.fillStyle = '#e8e6c8';
        ctx.beginPath(); ctx.arc(cx, py + s*0.26, s*0.22, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#a8a48a';
        ctx.fillRect(px + s*0.48, py + s*0.06, s*0.04, s*0.20);
        ctx.fillRect(px + s*0.32, py + s*0.16, s*0.36, s*0.04);
        ctx.strokeStyle = '#d6d4b6';
        ctx.lineWidth = Math.max(2, s*0.06);
        ctx.beginPath();
        ctx.moveTo(px + s*0.18, py + s*0.50); ctx.lineTo(px + s*0.06, py + s*0.40);
        ctx.moveTo(px + s*0.82, py + s*0.50); ctx.lineTo(px + s*0.94, py + s*0.40);
        ctx.stroke();
        break;
      }
      if (facing !== 'down') {
        // Side, drawn facing right: narrow ribs, one socket, the jaw jutting right.
        ctx.save();
        mirrorIfLeft(facing, cx);
        ctx.fillStyle = '#d6d4b6';
        ctx.fillRect(px + s*0.40, py + s*0.44, s*0.24, s*0.40);
        ctx.fillStyle = '#a8a48a';
        ctx.fillRect(px + s*0.40, py + s*0.44, s*0.05, s*0.40);
        for (let i = 0; i < 3; i++) ctx.fillRect(px + s*0.45, py + s*0.50 + i * s*0.08, s*0.18, s*0.03);
        ctx.fillStyle = '#d6d4b6';
        ctx.fillRect(px + s*0.36, py + s*0.82, s*0.30, s*0.10);
        ctx.fillStyle = '#e8e6c8';
        ctx.beginPath(); ctx.arc(px + s*0.54, py + s*0.26, s*0.20, 0, Math.PI*2); ctx.fill();
        ctx.fillRect(px + s*0.58, py + s*0.32, s*0.16, s*0.06);
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.arc(px + s*0.62, py + s*0.26, s*0.05, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = `rgba(180,220,255,${0.4 + flap * 0.5})`;
        ctx.fillRect(px + s*0.60, py + s*0.24, s*0.04, s*0.04);
        ctx.fillStyle = '#000';
        ctx.fillRect(px + s*0.62, py + s*0.34, s*0.10, s*0.03);
        ctx.strokeStyle = '#d6d4b6';
        ctx.lineWidth = Math.max(2, s*0.06);
        ctx.beginPath();
        ctx.moveTo(px + s*0.56, py + s*0.50); ctx.lineTo(px + s*0.76, py + s*0.42);
        ctx.moveTo(px + s*0.48, py + s*0.52); ctx.lineTo(px + s*0.66, py + s*0.56);
        ctx.stroke();
        ctx.restore();
        break;
      }
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
      const facing = creatureFacing(e);
      if (facing === 'up') {
        // Back: the same hunch, a spine seam, ragged coat hem and a bare head.
        ctx.fillStyle = '#4a5e2e'; ctx.fillRect(px + s*0.20, py + s*0.42, s*0.60, s*0.46);
        ctx.fillStyle = '#5a7038'; ctx.fillRect(px + s*0.50, py + s*0.42, s*0.30, s*0.46);
        ctx.fillStyle = '#2a3a18';
        ctx.fillRect(px + s*0.47, py + s*0.44, s*0.06, s*0.42);
        ctx.fillRect(px + s*0.30, py + s*0.60, s*0.06, s*0.20);
        ctx.fillRect(px + s*0.62, py + s*0.66, s*0.06, s*0.16);
        ctx.beginPath();
        ctx.moveTo(px + s*0.20, py + s*0.86); ctx.lineTo(px + s*0.30, py + s*0.92); ctx.lineTo(px + s*0.40, py + s*0.86);
        ctx.lineTo(px + s*0.52, py + s*0.92); ctx.lineTo(px + s*0.64, py + s*0.86); ctx.lineTo(px + s*0.80, py + s*0.90);
        ctx.lineTo(px + s*0.80, py + s*0.80); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#5a7038';
        ctx.beginPath(); ctx.arc(cx, py + s*0.30, s*0.24, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#2a3a18';
        ctx.beginPath(); ctx.arc(cx, py + s*0.28, s*0.24, Math.PI, 0); ctx.fill();
        ctx.fillRect(px + s*0.30, py + s*0.22, s*0.06, s*0.08);
        ctx.fillRect(px + s*0.64, py + s*0.22, s*0.06, s*0.08);
        ctx.fillStyle = '#5a7038';
        ctx.fillRect(px + s*0.04, py + s*0.48, s*0.18, s*0.10);
        ctx.fillRect(px + s*0.78, py + s*0.48, s*0.18, s*0.10);
        break;
      }
      if (facing !== 'down') {
        // Side, facing right: a narrow hunch, one sunken eye, the jaw out in front.
        ctx.save();
        mirrorIfLeft(facing, cx);
        ctx.fillStyle = '#4a5e2e'; ctx.fillRect(px + s*0.32, py + s*0.44, s*0.36, s*0.44);
        ctx.fillStyle = '#5a7038'; ctx.fillRect(px + s*0.50, py + s*0.44, s*0.18, s*0.44);
        ctx.fillStyle = '#2a3a18';
        ctx.fillRect(px + s*0.34, py + s*0.62, s*0.06, s*0.18);
        for (let i = 0; i < 3; i++) ctx.fillRect(px + s*(0.34 + i*0.11), py + s*0.84, s*0.07, s*0.08);
        ctx.fillStyle = '#5a7038';
        ctx.beginPath(); ctx.arc(px + s*0.58, py + s*0.30, s*0.22, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#7a9048';
        ctx.beginPath(); ctx.arc(px + s*0.56, py + s*0.28, s*0.16, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#5a7038';
        ctx.beginPath(); ctx.moveTo(px + s*0.70, py + s*0.24); ctx.lineTo(px + s*0.84, py + s*0.34); ctx.lineTo(px + s*0.70, py + s*0.42); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#0a0a06';
        ctx.fillRect(px + s*0.64, py + s*0.26, s*0.08, s*0.06);
        ctx.fillStyle = '#ffeebb';
        ctx.fillRect(px + s*0.68, py + s*0.27, s*0.02, s*0.02);
        ctx.fillStyle = '#993322';
        ctx.fillRect(px + s*0.72, py + s*0.42, s*0.04, s*0.06);
        ctx.fillStyle = '#5a7038';
        ctx.fillRect(px + s*0.52, py + s*0.48, s*0.30, s*0.10);
        ctx.restore();
        break;
      }
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
    case 'vampire': {
      const facing = creatureFacing(e);
      if (facing === 'up') {
        // Back: the cape spread over the whole back, slicked hair, no face.
        ctx.fillStyle = '#1a0612';
        ctx.beginPath();
        ctx.moveTo(px + s*0.50, py + s*0.36);
        ctx.lineTo(px + s*0.06, py + s*0.86);
        ctx.lineTo(px + s*0.94, py + s*0.86);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#2a0a18';
        ctx.fillRect(px + s*0.32, py + s*0.40, s*0.36, s*0.42);
        ctx.fillStyle = '#12040c';
        ctx.fillRect(px + s*0.48, py + s*0.38, s*0.04, s*0.46);
        ctx.fillStyle = '#aa1122';
        ctx.fillRect(px + s*0.32, py + s*0.66, s*0.36, s*0.06);
        ctx.fillStyle = '#0a0606';
        ctx.beginPath(); ctx.arc(cx, py + s*0.28, s*0.20, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#3a2a28';
        ctx.fillRect(px + s*0.34, py + s*0.16, s*0.32, s*0.03);
        ctx.fillRect(px + s*0.36, py + s*0.26, s*0.28, s*0.03);
        ctx.fillStyle = '#f0e0d8';
        ctx.fillRect(px + s*0.44, py + s*0.44, s*0.12, s*0.06);
        break;
      }
      if (facing !== 'down') {
        // Side, facing right: cape swept back, the pale face uncovered, one red eye.
        ctx.save();
        mirrorIfLeft(facing, cx);
        ctx.fillStyle = '#1a0612';
        ctx.beginPath();
        ctx.moveTo(px + s*0.52, py + s*0.40);
        ctx.lineTo(px + s*0.10, py + s*0.84);
        ctx.lineTo(px + s*0.46, py + s*0.84);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#2a0a18';
        ctx.fillRect(px + s*0.38, py + s*0.42, s*0.26, s*0.42);
        ctx.fillStyle = '#aa1122';
        ctx.fillRect(px + s*0.38, py + s*0.66, s*0.26, s*0.06);
        ctx.fillStyle = '#0a0606';
        ctx.beginPath(); ctx.arc(px + s*0.50, py + s*0.28, s*0.20, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#f0e0d8';
        ctx.beginPath(); ctx.arc(px + s*0.56, py + s*0.28, s*0.18, 0, Math.PI*2); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(px + s*0.68, py + s*0.24); ctx.lineTo(px + s*0.78, py + s*0.32); ctx.lineTo(px + s*0.68, py + s*0.40);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ff0022';
        ctx.fillRect(px + s*0.62, py + s*0.26, s*0.06, s*0.05);
        ctx.fillStyle = '#fff';
        ctx.fillRect(px + s*0.66, py + s*0.36, s*0.03, s*0.05);
        ctx.restore();
        break;
      }
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
      const facing = creatureFacing(e);
      if (facing === 'up') {
        // Back: the same robe and aura, the hood seen from behind, a fold down the spine.
        const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, s*0.55);
        aura.addColorStop(0, `rgba(100,160,200,${0.45 + flap * 0.25})`);
        aura.addColorStop(1, 'rgba(100,160,200,0)');
        ctx.fillStyle = aura;
        ctx.fillRect(fb.x - s*0.1, fb.y - s*0.1, s*1.2, s*1.2);
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
        ctx.fillStyle = '#1a2a38';
        ctx.fillRect(px + s*0.48, py + s*0.36, s*0.04, s*0.50);
        ctx.fillStyle = '#0a1218';
        ctx.beginPath(); ctx.arc(cx, py + s*0.24, s*0.28, Math.PI, 0); ctx.fill();
        ctx.fillRect(px + s*0.22, py + s*0.24, s*0.56, s*0.12);
        ctx.beginPath();
        ctx.moveTo(px + s*0.40, py + s*0.36); ctx.lineTo(cx, py + s*0.54); ctx.lineTo(px + s*0.60, py + s*0.36);
        ctx.closePath(); ctx.fill();
        break;
      }
      if (facing !== 'down') {
        // Side, facing right: a narrow robe, the hood in profile, one glowing eye.
        ctx.save();
        mirrorIfLeft(facing, cx);
        const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, s*0.55);
        aura.addColorStop(0, `rgba(100,160,200,${0.45 + flap * 0.25})`);
        aura.addColorStop(1, 'rgba(100,160,200,0)');
        ctx.fillStyle = aura;
        ctx.fillRect(fb.x - s*0.1, fb.y - s*0.1, s*1.2, s*1.2);
        ctx.fillStyle = '#2a3a4a';
        ctx.beginPath();
        ctx.moveTo(px + s*0.32, py + s*0.30);
        ctx.lineTo(px + s*0.70, py + s*0.30);
        for (let i = 4; i >= 0; i--) {
          const fx = px + s*0.32 + (s*0.38) * (i/4);
          const fy = py + s*0.90 + Math.sin(Date.now()/240 + phase + i*0.6) * s*0.05;
          ctx.lineTo(fx, fy);
        }
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#0a1218';
        ctx.beginPath();
        ctx.moveTo(px + s*0.26, py + s*0.38);
        ctx.lineTo(px + s*0.32, py + s*0.08);
        ctx.lineTo(px + s*0.64, py + s*0.14);
        ctx.lineTo(px + s*0.74, py + s*0.32);
        ctx.lineTo(px + s*0.56, py + s*0.40);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = `rgba(140,220,255,${0.7 + flap * 0.3})`;
        ctx.fillRect(px + s*0.58, py + s*0.26, s*0.08, s*0.05);
        ctx.restore();
        break;
      }
      // Aura
      const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, s*0.55);
      aura.addColorStop(0, `rgba(100,160,200,${0.45 + flap * 0.25})`);
      aura.addColorStop(1, 'rgba(100,160,200,0)');
      ctx.fillStyle = aura;
      ctx.fillRect(fb.x - s*0.1, fb.y - s*0.1, s*1.2, s*1.2);
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
    case 'lich':
    case 'lich_boss': {
      const facing = creatureFacing(e);
      if (facing === 'up') {
        // Back: the same robe and crown, a blank skull with its seam, the orb in the far hand.
        if (e.boss) {
          const auraR = s*0.65 + Math.sin(Date.now()/220) * s*0.04;
          const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, auraR);
          aura.addColorStop(0, 'rgba(180, 60, 255, 0.45)'); aura.addColorStop(1, 'rgba(180, 60, 255, 0)');
          ctx.fillStyle = aura; ctx.fillRect(cx - auraR, cy - auraR, auraR*2, auraR*2);
        }
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
        ctx.fillStyle = 'rgba(0,0,0,0.40)';
        ctx.fillRect(px + s*0.40, py + s*0.38, s*0.20, s*0.45);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(px + s*0.47, py + s*0.34, s*0.06, s*0.56);
        ctx.fillStyle = '#e8e4c0';
        ctx.beginPath(); ctx.arc(cx, py + s*0.26, s*0.22, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#b0ac90';
        ctx.fillRect(px + s*0.48, py + s*0.06, s*0.04, s*0.20);
        ctx.fillRect(px + s*0.32, py + s*0.16, s*0.36, s*0.04);
        ctx.fillStyle = '#ffcc00';
        ctx.fillRect(px + s*0.32, py + s*0.06, s*0.36, s*0.06);
        [0.34, 0.42, 0.50, 0.58, 0.66].forEach(fx => {
          ctx.beginPath();
          ctx.moveTo(px + s*fx, py + s*0.06); ctx.lineTo(px + s*(fx + 0.04), py + s*0.06); ctx.lineTo(px + s*(fx + 0.02), py - s*0.02);
          ctx.closePath(); ctx.fill();
        });
        const orbY = py + s*0.50 + Math.sin(Date.now()/180 + phase) * s*0.04;
        ctx.fillStyle = `rgba(220,120,255,${0.6 + flap * 0.4})`;
        ctx.beginPath(); ctx.arc(px + s*0.90, orbY, s*0.10, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(px + s*0.90, orbY, s*0.04, 0, Math.PI*2); ctx.fill();
        break;
      }
      if (facing !== 'down') {
        // Side, facing right: a narrow robe, the skull in profile, one soul eye, the orb ahead.
        ctx.save();
        mirrorIfLeft(facing, cx);
        if (e.boss) {
          const auraR = s*0.65 + Math.sin(Date.now()/220) * s*0.04;
          const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, auraR);
          aura.addColorStop(0, 'rgba(180, 60, 255, 0.45)');
          aura.addColorStop(1, 'rgba(180, 60, 255, 0)');
          ctx.fillStyle = aura;
          ctx.fillRect(cx - auraR, cy - auraR, auraR*2, auraR*2);
        }
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.moveTo(px + s*0.34, py + s*0.34);
        ctx.lineTo(px + s*0.70, py + s*0.34);
        for (let i = 5; i >= 0; i--) {
          const fx = px + s*0.34 + (s*0.36) * (i/5);
          const fy = py + s*0.92 + Math.sin(Date.now()/220 + phase + i*0.5) * s*0.04;
          ctx.lineTo(fx, fy);
        }
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.40)';
        ctx.fillRect(px + s*0.36, py + s*0.38, s*0.14, s*0.45);
        ctx.fillStyle = '#e8e4c0';
        ctx.beginPath(); ctx.arc(px + s*0.54, py + s*0.26, s*0.20, 0, Math.PI*2); ctx.fill();
        ctx.fillRect(px + s*0.58, py + s*0.32, s*0.16, s*0.06);
        ctx.fillStyle = '#000';
        ctx.fillRect(px + s*0.60, py + s*0.34, s*0.12, s*0.03);
        ctx.fillStyle = `rgba(180,80,255,${0.7 + flap * 0.3})`;
        ctx.fillRect(px + s*0.60, py + s*0.24, s*0.08, s*0.05);
        ctx.fillStyle = '#fff';
        ctx.fillRect(px + s*0.62, py + s*0.25, s*0.03, s*0.03);
        ctx.fillStyle = '#ffcc00';
        ctx.fillRect(px + s*0.36, py + s*0.06, s*0.34, s*0.06);
        ctx.beginPath();
        ctx.moveTo(px + s*0.40, py + s*0.06); ctx.lineTo(px + s*0.44, py - s*0.02); ctx.lineTo(px + s*0.48, py + s*0.06);
        ctx.moveTo(px + s*0.54, py + s*0.06); ctx.lineTo(px + s*0.58, py - s*0.02); ctx.lineTo(px + s*0.62, py + s*0.06);
        ctx.closePath(); ctx.fill();
        const orbY = py + s*0.50 + Math.sin(Date.now()/180 + phase) * s*0.04;
        ctx.fillStyle = `rgba(220,120,255,${0.6 + flap * 0.4})`;
        ctx.beginPath(); ctx.arc(px + s*0.80, orbY, s*0.10, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(px + s*0.80, orbY, s*0.04, 0, Math.PI*2); ctx.fill();
        ctx.restore();
        break;
      }
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
    case 'ghost': {
      const facing = creatureFacing(e);
      if (facing === 'up') {
        // Back: the same shroud seen from behind, no face, one fold seam down the middle.
        ctx.fillStyle = `rgba(200,220,230,${0.4+flap*0.15})`;
        ctx.beginPath();
        ctx.moveTo(px + s*0.26, py + s*0.34);
        ctx.bezierCurveTo(px + s*0.20, py + s*0.10, px + s*0.80, py + s*0.10, px + s*0.74, py + s*0.34);
        ctx.lineTo(px + s*0.74, py + s*0.74);
        for (let i=4;i>=0;i--){ const fx = px + s*0.30 + s*0.40*(i/4); const fy = py + s*0.86 + Math.sin(Date.now()/200 + phase + i)*s*0.05; ctx.lineTo(fx, fy); }
        ctx.lineTo(px + s*0.26, py + s*0.74);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(230,245,250,0.3)';
        ctx.beginPath(); ctx.ellipse(cx + s*0.04, py + s*0.34, s*0.12, s*0.16, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = 'rgba(80,140,170,0.35)';
        ctx.fillRect(px + s*0.48, py + s*0.18, s*0.04, s*0.62);
        break;
      }
      if (facing !== 'down') {
        // Side, facing right: a narrow shroud, one hollow eye, the mouth forward.
        ctx.save();
        mirrorIfLeft(facing, cx);
        ctx.fillStyle = `rgba(200,220,230,${0.4+flap*0.15})`;
        ctx.beginPath();
        ctx.moveTo(px + s*0.34, py + s*0.40);
        ctx.bezierCurveTo(px + s*0.32, py + s*0.10, px + s*0.72, py + s*0.10, px + s*0.68, py + s*0.40);
        ctx.lineTo(px + s*0.66, py + s*0.72);
        for (let i=3;i>=0;i--){ const fx = px + s*0.36 + s*0.30*(i/3); const fy = py + s*0.86 + Math.sin(Date.now()/200 + phase + i)*s*0.05; ctx.lineTo(fx, fy); }
        ctx.lineTo(px + s*0.34, py + s*0.72);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(230,245,250,0.3)';
        ctx.beginPath(); ctx.ellipse(px + s*0.50, py + s*0.36, s*0.10, s*0.14, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = `rgba(80,140,170,${0.7+flap*0.3})`;
        ctx.beginPath(); ctx.ellipse(px + s*0.62, py + s*0.30, s*0.05, s*0.07, 0, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(px + s*0.66, py + s*0.46, s*0.04, s*0.07, 0, 0, Math.PI*2); ctx.fill();
        ctx.restore();
        break;
      }
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
    case 'death_knight': {
      const facing = creatureFacing(e);
      if (facing === 'up') {
        // Back: the cape over the armour, the helm from behind with its horns, sword on the far side.
        if (e.boss) {
          const auraR = s*0.62 + Math.sin(Date.now()/220)*s*0.04;
          const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, auraR);
          aura.addColorStop(0, 'rgba(170,90,220,0.42)'); aura.addColorStop(1, 'rgba(170,90,220,0)');
          ctx.fillStyle = aura; ctx.fillRect(cx-auraR, cy-auraR, auraR*2, auraR*2);
        }
        ctx.fillStyle = '#2a2238'; ctx.fillRect(px + s*0.32, py + s*0.70, s*0.14, s*0.22); ctx.fillRect(px + s*0.54, py + s*0.70, s*0.14, s*0.22);
        ctx.fillStyle = '#1a1428';
        ctx.beginPath();
        ctx.moveTo(px + s*0.28, py + s*0.36); ctx.lineTo(px + s*0.18, py + s*0.84); ctx.lineTo(px + s*0.82, py + s*0.84); ctx.lineTo(px + s*0.72, py + s*0.36);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#120e1c';
        ctx.fillRect(px + s*0.48, py + s*0.38, s*0.04, s*0.44);
        ctx.beginPath();
        ctx.moveTo(px + s*0.26, py + s*0.38); ctx.lineTo(px + s*0.20, py + s*0.80); ctx.lineTo(px + s*0.32, py + s*0.74); ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(px + s*0.74, py + s*0.38); ctx.lineTo(px + s*0.80, py + s*0.80); ctx.lineTo(px + s*0.68, py + s*0.74); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#3a3050'; ctx.fillRect(px + s*0.30, py + s*0.36, s*0.40, s*0.10);
        ctx.fillStyle = '#2a2238';
        ctx.beginPath(); ctx.moveTo(px + s*0.26, py + s*0.38); ctx.lineTo(px + s*0.16, py + s*0.26); ctx.lineTo(px + s*0.40, py + s*0.36); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(px + s*0.74, py + s*0.38); ctx.lineTo(px + s*0.84, py + s*0.26); ctx.lineTo(px + s*0.60, py + s*0.36); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.arc(cx, py + s*0.24, s*0.16, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#4e4270';
        ctx.fillRect(px + s*0.47, py + s*0.10, s*0.06, s*0.28);
        ctx.fillStyle = '#2a2238';
        ctx.beginPath(); ctx.moveTo(px + s*0.38, py + s*0.14); ctx.lineTo(px + s*0.30, py + s*0.0); ctx.lineTo(px + s*0.46, py + s*0.12); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(px + s*0.62, py + s*0.14); ctx.lineTo(px + s*0.70, py + s*0.0); ctx.lineTo(px + s*0.54, py + s*0.12); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffcc00'; ctx.fillRect(px + s*0.42, py + s*0.08, s*0.16, s*0.04);
        ctx.fillStyle = '#5a4e78'; ctx.fillRect(px + s*0.13, py + s*0.10, s*0.05, s*0.64);
        ctx.fillStyle = `rgba(180,90,255,${0.5+flap*0.4})`; ctx.fillRect(px + s*0.145, py + s*0.14, s*0.02, s*0.56);
        ctx.fillStyle = '#3a3050'; ctx.fillRect(px + s*0.08, py + s*0.72, s*0.16, s*0.05);
        break;
      }
      if (facing !== 'down') {
        // Side, facing right: armour in profile, one horn, one eye, the blade held ahead.
        ctx.save();
        mirrorIfLeft(facing, cx);
        if (e.boss) {
          const auraR = s*0.62 + Math.sin(Date.now()/220)*s*0.04;
          const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, auraR);
          aura.addColorStop(0, 'rgba(170,90,220,0.42)'); aura.addColorStop(1, 'rgba(170,90,220,0)');
          ctx.fillStyle = aura; ctx.fillRect(cx-auraR, cy-auraR, auraR*2, auraR*2);
        }
        ctx.fillStyle = '#2a2238'; ctx.fillRect(px + s*0.40, py + s*0.70, s*0.13, s*0.22); ctx.fillRect(px + s*0.55, py + s*0.70, s*0.13, s*0.22);
        ctx.fillStyle = '#1a1428';
        ctx.beginPath(); ctx.moveTo(px + s*0.44, py + s*0.38); ctx.lineTo(px + s*0.16, py + s*0.82); ctx.lineTo(px + s*0.40, py + s*0.76); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#3a3050'; ctx.fillRect(px + s*0.38, py + s*0.36, s*0.30, s*0.40);
        ctx.fillStyle = '#4e4270'; ctx.fillRect(px + s*0.52, py + s*0.36, s*0.16, s*0.40);
        ctx.fillStyle = '#2a2238';
        ctx.beginPath(); ctx.moveTo(px + s*0.40, py + s*0.38); ctx.lineTo(px + s*0.32, py + s*0.26); ctx.lineTo(px + s*0.62, py + s*0.36); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.arc(px + s*0.54, py + s*0.24, s*0.16, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#d8d2bc';
        ctx.beginPath(); ctx.ellipse(px + s*0.60, py + s*0.26, s*0.09, s*0.11, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#2a2238';
        ctx.fillRect(px + s*0.50, py + s*0.14, s*0.20, s*0.06);
        ctx.fillStyle = `rgba(180,90,255,${0.7+flap*0.3})`;
        ctx.beginPath(); ctx.arc(px + s*0.62, py + s*0.26, s*0.04, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#000'; ctx.fillRect(px + s*0.60, py + s*0.32, s*0.08, s*0.05);
        ctx.fillStyle = '#2a2238';
        ctx.beginPath(); ctx.moveTo(px + s*0.46, py + s*0.14); ctx.lineTo(px + s*0.36, py + s*0.0); ctx.lineTo(px + s*0.54, py + s*0.12); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffcc00'; ctx.fillRect(px + s*0.44, py + s*0.08, s*0.20, s*0.04);
        ctx.fillStyle = '#5a4e78'; ctx.fillRect(px + s*0.78, py + s*0.16, s*0.05, s*0.56);
        ctx.fillStyle = `rgba(180,90,255,${0.5+flap*0.4})`; ctx.fillRect(px + s*0.795, py + s*0.20, s*0.02, s*0.48);
        ctx.fillStyle = '#3a3050'; ctx.fillRect(px + s*0.72, py + s*0.70, s*0.16, s*0.05);
        ctx.restore();
        break;
      }
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
  }
}

registerEnemyArt(drawNecroticCreature, [
  'skeleton', 'zombie', 'vampire', 'wraith', 'lich', 'lich_boss', 'ghost',
  'death_knight',
]);
