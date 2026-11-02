// Necrotic creatures and their boss. Reached through ENEMY_ART (render-enemies.js),
// which also draws what every creature shares: shadow, auras, HP bar and name tag.
// The Forest Lich is here too: it shares the ordinary lich's drawing.

function drawNecroticCreature(e, ts, s, px, py, cx, cy, flap, phase, fb, bob, boxTop) {
  switch (e.type) {
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
