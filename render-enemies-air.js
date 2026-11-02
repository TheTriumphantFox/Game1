// Air creatures and their boss. Reached through ENEMY_ART (render-enemies.js),
// which also draws what every creature shares: shadow, auras, HP bar and name tag.

function drawAirCreature(e, ts, s, px, py, cx, cy, flap, phase, fb, bob, boxTop) {
  switch (e.type) {
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
  }
}

registerEnemyArt(drawAirCreature, [
  'wyvern', 'harpy', 'griffon', 'manticore', 'air_elemental', 'roc', 'wind_djinn',
]);
