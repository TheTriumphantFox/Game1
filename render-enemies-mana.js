// Mana and arcane creatures and their boss. Reached through ENEMY_ART (render-enemies.js),
// which also draws what every creature shares: shadow, auras, HP bar and name tag.

function drawManaCreature(e, ts, s, px, py, cx, cy, flap, phase, fb, bob, boxTop) {
  switch (e.type) {
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
    case 'nothic': {
      // Hunched body
      ctx.fillStyle = '#5a4a6a';
      ctx.beginPath(); ctx.ellipse(cx, py + s*0.64, s*0.26, s*0.24, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#6e5a82';
      ctx.beginPath(); ctx.ellipse(cx - s*0.05, py + s*0.60, s*0.16, s*0.16, 0, 0, Math.PI*2); ctx.fill();
      // Spindly arms + claws
      ctx.strokeStyle = '#4a3a5a'; ctx.lineWidth = Math.max(2, s*0.05); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(px + s*0.30, py + s*0.56); ctx.lineTo(px + s*0.10, py + s*0.78); ctx.moveTo(px + s*0.70, py + s*0.56); ctx.lineTo(px + s*0.90, py + s*0.78); ctx.stroke();
      ctx.strokeStyle = '#c8b8d0'; ctx.lineWidth = Math.max(1.5, s*0.03);
      [[0.08,0.78],[0.12,0.82],[0.88,0.78],[0.92,0.82]].forEach(([fx,fy]) => { ctx.beginPath(); ctx.moveTo(px + s*fx, py + s*(fy-0.06)); ctx.lineTo(px + s*fx, py + s*fy); ctx.stroke(); });
      // Head
      ctx.fillStyle = '#6e5a82';
      ctx.beginPath(); ctx.arc(cx, py + s*0.34, s*0.18, 0, Math.PI*2); ctx.fill();
      // One huge glowing eye
      ctx.fillStyle = `rgba(180,120,220,${0.5+flap*0.3})`;
      ctx.beginPath(); ctx.arc(cx, py + s*0.34, s*0.13, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#e0c0ff';
      ctx.beginPath(); ctx.arc(cx, py + s*0.34, s*0.09, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#2a0a3a';
      ctx.beginPath(); ctx.arc(cx, py + s*0.34, s*0.045, 0, Math.PI*2); ctx.fill();
      // Jagged grin
      ctx.fillStyle = '#1a0a1a'; ctx.fillRect(px + s*0.42, py + s*0.50, s*0.16, s*0.03);
      break;
    }
    case 'helmed_horror': {
      // Shield (left)
      ctx.fillStyle = '#4a5066';
      ctx.beginPath(); ctx.moveTo(px + s*0.06, py + s*0.40); ctx.lineTo(px + s*0.26, py + s*0.40); ctx.lineTo(px + s*0.26, py + s*0.66); ctx.lineTo(px + s*0.16, py + s*0.78); ctx.lineTo(px + s*0.06, py + s*0.66); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#6a7088'; ctx.fillRect(px + s*0.13, py + s*0.46, s*0.06, s*0.20);
      // Cuirass
      ctx.fillStyle = '#586078'; ctx.fillRect(px + s*0.32, py + s*0.40, s*0.36, s*0.40);
      ctx.fillStyle = '#6a7290'; ctx.fillRect(px + s*0.32, py + s*0.40, s*0.18, s*0.40);
      ctx.strokeStyle = '#3a4054'; ctx.lineWidth = 1.5;
      [0.50,0.62,0.72].forEach(fy => { ctx.beginPath(); ctx.moveTo(px + s*0.32, py + s*fy); ctx.lineTo(px + s*0.68, py + s*fy); ctx.stroke(); });
      // Great helm
      ctx.fillStyle = '#6a7290';
      ctx.beginPath(); ctx.arc(cx, py + s*0.26, s*0.16, Math.PI, 0); ctx.fill();
      ctx.fillRect(px + s*0.34, py + s*0.26, s*0.32, s*0.14);
      // Visor glow
      ctx.fillStyle = `rgba(180,120,255,${0.6+flap*0.4})`;
      ctx.fillRect(px + s*0.38, py + s*0.28, s*0.24, s*0.04);
      // Sword (right)
      ctx.fillStyle = '#c8cee0'; ctx.fillRect(px + s*0.80, py + s*0.16, s*0.05, s*0.56);
      ctx.fillStyle = '#8a7038'; ctx.fillRect(px + s*0.74, py + s*0.70, s*0.16, s*0.05);
      break;
    }
    case 'mind_flayer': {
      // Psionic aura
      const mfa = ctx.createRadialGradient(cx, py + s*0.30, 0, cx, py + s*0.30, s*0.4);
      mfa.addColorStop(0, `rgba(160,90,220,${0.3+flap*0.25})`);
      mfa.addColorStop(1, 'rgba(160,90,220,0)');
      ctx.fillStyle = mfa; ctx.fillRect(fb.x - s*0.1, fb.y - s*0.1, s*1.2, s*1.2);
      // Robe
      ctx.fillStyle = '#3a2a52';
      ctx.beginPath(); ctx.moveTo(px + s*0.30, py + s*0.42); ctx.lineTo(px + s*0.70, py + s*0.42); ctx.lineTo(px + s*0.78, py + s*0.90); ctx.lineTo(px + s*0.22, py + s*0.90); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#4a3668'; ctx.fillRect(px + s*0.30, py + s*0.42, s*0.20, s*0.48);
      // Bulbous head
      ctx.fillStyle = '#7a55a0';
      ctx.beginPath(); ctx.arc(cx, py + s*0.30, s*0.18, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#9070b8';
      ctx.beginPath(); ctx.arc(cx - s*0.05, py + s*0.26, s*0.11, 0, Math.PI*2); ctx.fill();
      // Eyes
      ctx.fillStyle = '#e8e0f0'; ctx.fillRect(cx - s*0.10, py + s*0.28, s*0.06, s*0.03); ctx.fillRect(cx + s*0.04, py + s*0.28, s*0.06, s*0.03);
      // Four writhing face tentacles
      ctx.strokeStyle = '#7a55a0'; ctx.lineWidth = Math.max(2, s*0.05); ctx.lineCap = 'round';
      for (let i=0;i<4;i++){ const tx = cx - s*0.12 + i*s*0.08; const wob = Math.sin(Date.now()/160 + i + phase)*s*0.05; ctx.beginPath(); ctx.moveTo(tx, py + s*0.40); ctx.quadraticCurveTo(tx + wob, py + s*0.50, tx + wob*1.4, py + s*0.58); ctx.stroke(); }
      break;
    }
    case 'githyanki': {
      // Armor body
      ctx.fillStyle = '#7a2a2a'; ctx.fillRect(px + s*0.30, py + s*0.40, s*0.40, s*0.46);
      ctx.fillStyle = '#9a3a3a'; ctx.fillRect(px + s*0.30, py + s*0.40, s*0.20, s*0.46);
      ctx.fillStyle = '#e0b040'; ctx.fillRect(px + s*0.30, py + s*0.56, s*0.40, s*0.04);
      // Spiky pauldrons
      ctx.fillStyle = '#caa030';
      ctx.beginPath(); ctx.moveTo(px + s*0.28, py + s*0.42); ctx.lineTo(px + s*0.22, py + s*0.30); ctx.lineTo(px + s*0.38, py + s*0.40); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px + s*0.72, py + s*0.42); ctx.lineTo(px + s*0.78, py + s*0.30); ctx.lineTo(px + s*0.62, py + s*0.40); ctx.closePath(); ctx.fill();
      // Head (yellow-green)
      ctx.fillStyle = '#bcc24a';
      ctx.beginPath(); ctx.arc(cx, py + s*0.28, s*0.15, 0, Math.PI*2); ctx.fill();
      // Pointed ears
      ctx.fillStyle = '#a4aa3a';
      ctx.beginPath(); ctx.moveTo(px + s*0.38, py + s*0.26); ctx.lineTo(px + s*0.28, py + s*0.16); ctx.lineTo(px + s*0.42, py + s*0.30); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px + s*0.62, py + s*0.26); ctx.lineTo(px + s*0.72, py + s*0.16); ctx.lineTo(px + s*0.58, py + s*0.30); ctx.closePath(); ctx.fill();
      // Eyes
      ctx.fillStyle = '#1a1a06'; ctx.fillRect(px + s*0.44, py + s*0.26, s*0.04, s*0.04); ctx.fillRect(px + s*0.53, py + s*0.26, s*0.04, s*0.04);
      // Silver greatsword
      ctx.fillStyle = '#d8dce8'; ctx.fillRect(px + s*0.80, py + s*0.10, s*0.05, s*0.66);
      ctx.fillStyle = '#e0b040'; ctx.fillRect(px + s*0.75, py + s*0.72, s*0.15, s*0.05);
      break;
    }
    case 'rakshasa': {
      // Fine robe
      ctx.fillStyle = '#7a2030';
      ctx.beginPath(); ctx.moveTo(px + s*0.30, py + s*0.42); ctx.lineTo(px + s*0.70, py + s*0.42); ctx.lineTo(px + s*0.78, py + s*0.90); ctx.lineTo(px + s*0.22, py + s*0.90); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#9a2a3a'; ctx.fillRect(px + s*0.44, py + s*0.42, s*0.12, s*0.48);
      ctx.fillStyle = '#e0b848'; ctx.fillRect(px + s*0.46, py + s*0.42, s*0.08, s*0.48);
      // Tiger head
      ctx.fillStyle = '#d88a3a';
      ctx.beginPath(); ctx.arc(cx, py + s*0.28, s*0.18, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#f0e0d0';
      ctx.beginPath(); ctx.arc(cx, py + s*0.34, s*0.10, 0, Math.PI*2); ctx.fill();
      // Ears
      ctx.fillStyle = '#d88a3a';
      ctx.beginPath(); ctx.arc(px + s*0.36, py + s*0.16, s*0.06, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + s*0.64, py + s*0.16, s*0.06, 0, Math.PI*2); ctx.fill();
      // Stripes
      ctx.strokeStyle = '#3a1a0a'; ctx.lineWidth = Math.max(1.5, s*0.03);
      ctx.beginPath(); ctx.moveTo(px + s*0.36, py + s*0.18); ctx.lineTo(px + s*0.40, py + s*0.26); ctx.moveTo(px + s*0.64, py + s*0.18); ctx.lineTo(px + s*0.60, py + s*0.26); ctx.moveTo(cx, py + s*0.12); ctx.lineTo(cx, py + s*0.20); ctx.stroke();
      // Glowing eyes
      ctx.fillStyle = `rgba(255,210,60,${0.7+flap*0.3})`;
      ctx.fillRect(px + s*0.42, py + s*0.26, s*0.06, s*0.04); ctx.fillRect(px + s*0.54, py + s*0.26, s*0.06, s*0.04);
      // Fanged snout
      ctx.fillStyle = '#1a0a0a'; ctx.fillRect(px + s*0.46, py + s*0.36, s*0.08, s*0.03);
      ctx.fillStyle = '#fff'; ctx.fillRect(px + s*0.46, py + s*0.36, s*0.02, s*0.04); ctx.fillRect(px + s*0.53, py + s*0.36, s*0.02, s*0.04);
      break;
    }
    case 'archmage_void': {
      if (e.boss) {
        const auraR = s*0.62 + Math.sin(Date.now()/220)*s*0.04;
        const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, auraR);
        aura.addColorStop(0, 'rgba(170,100,240,0.42)'); aura.addColorStop(1, 'rgba(170,100,240,0)');
        ctx.fillStyle = aura; ctx.fillRect(cx-auraR, cy-auraR, auraR*2, auraR*2);
      }
      // Void rift behind
      ctx.fillStyle = '#0a0418';
      ctx.beginPath(); ctx.arc(cx, py + s*0.42, s*0.40, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = `rgba(180,110,255,${0.4+flap*0.4})`; ctx.lineWidth = Math.max(1.5, s*0.03);
      for (let i=0;i<3;i++){ ctx.beginPath(); ctx.arc(cx, py + s*0.42, s*(0.40 - i*0.06), Date.now()/800 + i, Date.now()/800 + i + 2.2); ctx.stroke(); }
      // Floating runes
      ctx.fillStyle = '#c8a0ff';
      for (let i=0;i<5;i++){ const a = Date.now()/600 + i*1.26; ctx.fillRect(cx + Math.cos(a)*s*0.34 - s*0.012, py + s*0.42 + Math.sin(a)*s*0.30 - s*0.012, s*0.025, s*0.025); }
      // Robe
      ctx.fillStyle = '#3a1f5a';
      ctx.beginPath(); ctx.moveTo(px + s*0.32, py + s*0.42); ctx.lineTo(px + s*0.68, py + s*0.42); ctx.lineTo(px + s*0.78, py + s*0.92); ctx.lineTo(px + s*0.22, py + s*0.92); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#4e2c78';
      ctx.beginPath(); ctx.moveTo(px + s*0.32, py + s*0.42); ctx.lineTo(px + s*0.50, py + s*0.42); ctx.lineTo(px + s*0.50, py + s*0.92); ctx.lineTo(px + s*0.22, py + s*0.92); ctx.closePath(); ctx.fill();
      // Hood
      ctx.fillStyle = '#2a1444';
      ctx.beginPath(); ctx.moveTo(px + s*0.34, py + s*0.40); ctx.lineTo(cx, py + s*0.10); ctx.lineTo(px + s*0.66, py + s*0.40); ctx.closePath(); ctx.fill();
      // Glowing eyes in hood
      ctx.fillStyle = `rgba(200,140,255,${0.7+flap*0.3})`;
      ctx.fillRect(px + s*0.42, py + s*0.30, s*0.06, s*0.04); ctx.fillRect(px + s*0.52, py + s*0.30, s*0.06, s*0.04);
      // Arcane orb in hand
      ctx.fillStyle = `rgba(190,120,255,${0.6+flap*0.4})`;
      ctx.beginPath(); ctx.arc(px + s*0.82, py + s*0.56, s*0.08, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#f0e0ff';
      ctx.beginPath(); ctx.arc(px + s*0.80, py + s*0.54, s*0.03, 0, Math.PI*2); ctx.fill();
      break;
    }
  }
}

registerEnemyArt(drawManaCreature, [
  'beholder', 'nothic', 'helmed_horror', 'mind_flayer', 'githyanki', 'rakshasa',
  'archmage_void',
]);
