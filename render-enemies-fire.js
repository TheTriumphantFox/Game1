// Fire and desert creatures and their boss. Reached through ENEMY_ART (render-enemies.js),
// which also draws what every creature shares: shadow, auras, HP bar and name tag.

function drawFireCreature(e, ts, s, px, py, cx, cy, flap, phase, fb, bob, boxTop) {
  switch (e.type) {
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
      ctx.fillStyle = ha; ctx.fillRect(fb.x - s*0.1, fb.y - s*0.1, s*1.2, s*1.2);
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
      ctx.fillStyle = sga; ctx.fillRect(fb.x - s*0.1, fb.y - s*0.1, s*1.2, s*1.2);
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
  }
}

registerEnemyArt(drawFireCreature, [
  'cultist', 'mummy_lord', 'magma_mephit', 'gnoll', 'hell_hound', 'giant_scorpion',
  'salamander',
]);
