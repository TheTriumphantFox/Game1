// Earth creatures and their boss. Reached through ENEMY_ART (render-enemies.js),
// which also draws what every creature shares: shadow, auras, HP bar and name tag.

function drawEarthCreature(e, ts, s, px, py, cx, cy, flap, phase, fb, bob, boxTop) {
  switch (e.type) {
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
  }
}

registerEnemyArt(drawEarthCreature, [
  'displacer', 'gargoyle', 'ankheg', 'bulette', 'earth_elemental', 'stone_giant',
  'gaia_colossus',
]);
