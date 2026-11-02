// Ice creatures and their boss. Reached through ENEMY_ART (render-enemies.js),
// which also draws what every creature shares: shadow, auras, HP bar and name tag.

function drawIceCreature(e, ts, s, px, py, cx, cy, flap, phase, fb, bob, boxTop) {
  switch (e.type) {
    case 'ice_mephit': {
      const iwf = Math.sin(Date.now()/100 + phase) * 0.25 + 1;
      // Crystal wings
      ctx.fillStyle = 'rgba(170,220,240,0.8)';
      ctx.beginPath(); ctx.moveTo(cx - s*0.10, py + s*0.44); ctx.lineTo(px + s*0.02, py + s*0.28/iwf); ctx.lineTo(px + s*0.08, py + s*0.56); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + s*0.10, py + s*0.44); ctx.lineTo(px + s*0.98, py + s*0.28/iwf); ctx.lineTo(px + s*0.92, py + s*0.56); ctx.closePath(); ctx.fill();
      // Body
      ctx.fillStyle = '#7fc0dd';
      ctx.beginPath(); ctx.arc(cx, py + s*0.54, s*0.24, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#aee0f0';
      ctx.beginPath(); ctx.arc(cx - s*0.06, py + s*0.50, s*0.16, 0, Math.PI*2); ctx.fill();
      // Head
      ctx.fillStyle = '#7fc0dd';
      ctx.beginPath(); ctx.arc(cx, py + s*0.30, s*0.16, 0, Math.PI*2); ctx.fill();
      // Ice-shard horns
      ctx.fillStyle = '#dff4ff';
      ctx.beginPath(); ctx.moveTo(cx - s*0.10, py + s*0.20); ctx.lineTo(cx - s*0.14, py + s*0.04); ctx.lineTo(cx - s*0.04, py + s*0.18); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + s*0.10, py + s*0.20); ctx.lineTo(cx + s*0.14, py + s*0.04); ctx.lineTo(cx + s*0.04, py + s*0.18); ctx.closePath(); ctx.fill();
      // Eyes
      ctx.fillStyle = `rgba(220,250,255,${0.7+flap*0.3})`;
      ctx.fillRect(cx - s*0.08, py + s*0.28, s*0.05, s*0.04);
      ctx.fillRect(cx + s*0.03, py + s*0.28, s*0.05, s*0.04);
      break;
    }
    case 'winter_wolf': {
      // Body
      ctx.fillStyle = '#cfe2ee'; ctx.fillRect(px + s*0.10, py + s*0.38, s*0.70, s*0.40);
      ctx.fillStyle = '#eaf4fa'; ctx.fillRect(px + s*0.10, py + s*0.38, s*0.70, s*0.18);
      // Head (right)
      ctx.fillStyle = '#cfe2ee';
      ctx.beginPath(); ctx.arc(px + s*0.74, py + s*0.38, s*0.20, 0, Math.PI*2); ctx.fill();
      // Snout + frost breath
      ctx.fillStyle = '#b0ccdc'; ctx.fillRect(px + s*0.84, py + s*0.38, s*0.12, s*0.10);
      ctx.fillStyle = `rgba(200,235,255,${0.4+flap*0.3})`;
      ctx.beginPath(); ctx.arc(px + s*1.00, py + s*0.44, s*0.06, 0, Math.PI*2); ctx.fill();
      // Ear
      ctx.fillStyle = '#b0ccdc';
      ctx.beginPath(); ctx.moveTo(px + s*0.62, py + s*0.18); ctx.lineTo(px + s*0.66, py + s*0.32); ctx.lineTo(px + s*0.74, py + s*0.24); ctx.closePath(); ctx.fill();
      // Ice-blue eye
      ctx.fillStyle = '#3aa0ff'; ctx.fillRect(px + s*0.78, py + s*0.32, s*0.05, s*0.05);
      // Legs
      const wlp = Math.sin(Date.now()/180 + phase) > 0;
      ctx.fillStyle = '#b0ccdc';
      [0.14,0.34,0.52,0.70].forEach((fx,idx) => { const ll = (idx%2===(wlp?0:1))?s*0.20:s*0.24; ctx.fillRect(px + s*fx, py + s*0.74, s*0.10, ll); });
      // Frost on back
      ctx.fillStyle = '#ffffff';
      [0.22,0.40,0.58].forEach(fx => ctx.fillRect(px + s*fx, py + s*0.36, s*0.06, s*0.04));
      break;
    }
    case 'yeti': {
      // Shaggy body
      ctx.fillStyle = '#e6eef2'; ctx.fillRect(px + s*0.18, py + s*0.34, s*0.64, s*0.56);
      // Fur tufts
      ctx.fillStyle = '#cdd9e0';
      for (let i=0;i<6;i++){ ctx.beginPath(); ctx.moveTo(px + s*0.18 + i*s*0.11, py + s*0.90); ctx.lineTo(px + s*0.23 + i*s*0.11, py + s*0.80); ctx.lineTo(px + s*0.28 + i*s*0.11, py + s*0.90); ctx.closePath(); ctx.fill(); }
      // Head
      ctx.fillStyle = '#e6eef2';
      ctx.beginPath(); ctx.arc(cx, py + s*0.28, s*0.24, 0, Math.PI*2); ctx.fill();
      // Blue face patch
      ctx.fillStyle = '#9fc4dd';
      ctx.beginPath(); ctx.ellipse(cx, py + s*0.32, s*0.14, s*0.16, 0, 0, Math.PI*2); ctx.fill();
      // Angry eyes
      ctx.fillStyle = '#1a3a5a';
      ctx.fillRect(px + s*0.42, py + s*0.28, s*0.06, s*0.04);
      ctx.fillRect(px + s*0.54, py + s*0.28, s*0.06, s*0.04);
      // Fanged mouth
      ctx.fillStyle = '#0a2030'; ctx.fillRect(px + s*0.42, py + s*0.40, s*0.18, s*0.05);
      ctx.fillStyle = '#fff';
      ctx.fillRect(px + s*0.44, py + s*0.40, s*0.03, s*0.05);
      ctx.fillRect(px + s*0.55, py + s*0.40, s*0.03, s*0.05);
      // Arms + claws
      ctx.fillStyle = '#e6eef2';
      ctx.fillRect(px + s*0.06, py + s*0.42, s*0.16, s*0.12);
      ctx.fillRect(px + s*0.78, py + s*0.42, s*0.16, s*0.12);
      ctx.fillStyle = '#dfe8ee';
      [0.06,0.12,0.18].forEach(fx => ctx.fillRect(px + s*fx, py + s*0.54, s*0.03, s*0.06));
      [0.78,0.84,0.90].forEach(fx => ctx.fillRect(px + s*fx, py + s*0.54, s*0.03, s*0.06));
      break;
    }
    case 'mammoth': {
      // Body mass
      ctx.fillStyle = '#6a4a2a';
      ctx.beginPath(); ctx.ellipse(cx, py + s*0.56, s*0.40, s*0.30, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#82602f';
      ctx.beginPath(); ctx.ellipse(cx - s*0.04, py + s*0.50, s*0.30, s*0.22, 0, 0, Math.PI*2); ctx.fill();
      // Shaggy fur skirt
      ctx.fillStyle = '#553a1f';
      for (let i=0;i<7;i++) { ctx.beginPath(); ctx.moveTo(px + s*0.16 + i*s*0.10, py + s*0.82); ctx.lineTo(px + s*0.20 + i*s*0.10, py + s*0.94); ctx.lineTo(px + s*0.24 + i*s*0.10, py + s*0.82); ctx.closePath(); ctx.fill(); }
      // Head
      ctx.fillStyle = '#82602f';
      ctx.beginPath(); ctx.arc(px + s*0.70, py + s*0.46, s*0.22, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#6a4a2a';
      ctx.beginPath(); ctx.arc(px + s*0.70, py + s*0.30, s*0.12, 0, Math.PI*2); ctx.fill();
      // Trunk
      ctx.strokeStyle = '#82602f'; ctx.lineWidth = Math.max(4, s*0.12); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(px + s*0.78, py + s*0.50); ctx.quadraticCurveTo(px + s*0.96, py + s*0.66, px + s*0.86, py + s*0.86); ctx.stroke();
      // Tusk
      ctx.strokeStyle = '#f0e6cc'; ctx.lineWidth = Math.max(3, s*0.07);
      ctx.beginPath(); ctx.moveTo(px + s*0.66, py + s*0.58); ctx.quadraticCurveTo(px + s*0.62, py + s*0.84, px + s*0.78, py + s*0.84); ctx.stroke();
      // Eye
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(px + s*0.74, py + s*0.42, s*0.03, 0, Math.PI*2); ctx.fill();
      break;
    }
    case 'white_dragon': {
      const dwf = Math.sin(Date.now()/120 + phase) * 0.2 + 1;
      // Wings
      ctx.fillStyle = '#a9d2e6';
      ctx.beginPath(); ctx.moveTo(px + s*0.04, py + s*0.38/dwf); ctx.lineTo(px + s*0.48, py + s*0.34); ctx.lineTo(px + s*0.28, py + s*0.62); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px + s*0.96, py + s*0.38/dwf); ctx.lineTo(px + s*0.52, py + s*0.34); ctx.lineTo(px + s*0.72, py + s*0.62); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#d6ecf5';
      ctx.beginPath(); ctx.moveTo(px + s*0.10, py + s*0.40/dwf); ctx.lineTo(px + s*0.46, py + s*0.38); ctx.lineTo(px + s*0.30, py + s*0.56); ctx.closePath(); ctx.fill();
      // Body
      ctx.fillStyle = '#cfe6f0';
      ctx.beginPath(); ctx.ellipse(cx, py + s*0.54, s*0.22, s*0.30, 0, 0, Math.PI*2); ctx.fill();
      // Head
      ctx.fillStyle = '#e6f3f8';
      ctx.beginPath(); ctx.arc(cx, py + s*0.26, s*0.17, 0, Math.PI*2); ctx.fill();
      // Frill horns
      ctx.fillStyle = '#9fc4dd';
      ctx.beginPath(); ctx.moveTo(px + s*0.42, py + s*0.16); ctx.lineTo(px + s*0.30, py + s*0.04); ctx.lineTo(px + s*0.48, py + s*0.14); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px + s*0.58, py + s*0.16); ctx.lineTo(px + s*0.70, py + s*0.04); ctx.lineTo(px + s*0.52, py + s*0.14); ctx.closePath(); ctx.fill();
      // Frost breath
      ctx.fillStyle = `rgba(200,235,255,${0.4+flap*0.3})`;
      ctx.beginPath(); ctx.arc(cx, py + s*0.40, s*0.07, 0, Math.PI*2); ctx.fill();
      // Eye
      ctx.fillStyle = '#3aa0ff'; ctx.fillRect(px + s*0.46, py + s*0.24, s*0.07, s*0.05);
      ctx.fillStyle = '#000'; ctx.fillRect(px + s*0.49, py + s*0.25, s*0.02, s*0.03);
      // Tail
      ctx.strokeStyle = '#cfe6f0'; ctx.lineWidth = Math.max(2, s*0.06);
      ctx.beginPath(); ctx.moveTo(cx, py + s*0.80); ctx.lineTo(cx + Math.sin(Date.now()/180+phase)*s*0.20, py + s); ctx.stroke();
      break;
    }
    case 'frost_giant': {
      // Legs
      ctx.fillStyle = '#7fa6c2'; ctx.fillRect(px + s*0.30, py + s*0.66, s*0.16, s*0.26); ctx.fillRect(px + s*0.54, py + s*0.66, s*0.16, s*0.26);
      // Torso
      ctx.fillStyle = '#8fb6d2'; ctx.fillRect(px + s*0.26, py + s*0.30, s*0.48, s*0.42);
      ctx.fillStyle = '#a6cbe2'; ctx.fillRect(px + s*0.26, py + s*0.30, s*0.24, s*0.42);
      // Fur kilt
      ctx.fillStyle = '#d8e6ee'; ctx.fillRect(px + s*0.26, py + s*0.60, s*0.48, s*0.10);
      // Head
      ctx.fillStyle = '#a6cbe2';
      ctx.beginPath(); ctx.arc(cx, py + s*0.20, s*0.16, 0, Math.PI*2); ctx.fill();
      // Beard
      ctx.fillStyle = '#e8f2f8'; ctx.fillRect(px + s*0.40, py + s*0.24, s*0.20, s*0.12);
      // Eyes
      ctx.fillStyle = '#1a3a5a'; ctx.fillRect(px + s*0.42, py + s*0.18, s*0.05, s*0.04); ctx.fillRect(px + s*0.53, py + s*0.18, s*0.05, s*0.04);
      // Ice axe
      ctx.strokeStyle = '#5a4428'; ctx.lineWidth = Math.max(2, s*0.05);
      ctx.beginPath(); ctx.moveTo(px + s*0.80, py + s*0.20); ctx.lineTo(px + s*0.80, py + s*0.86); ctx.stroke();
      ctx.fillStyle = 'rgba(200,235,255,0.9)';
      ctx.beginPath(); ctx.moveTo(px + s*0.74, py + s*0.20); ctx.lineTo(px + s*0.96, py + s*0.16); ctx.lineTo(px + s*0.86, py + s*0.34); ctx.closePath(); ctx.fill();
      break;
    }
    case 'frost_titan': {
      if (e.boss) {
        const auraR = s*0.62 + Math.sin(Date.now()/220)*s*0.04;
        const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, auraR);
        aura.addColorStop(0, 'rgba(160,220,255,0.40)'); aura.addColorStop(1, 'rgba(160,220,255,0)');
        ctx.fillStyle = aura; ctx.fillRect(cx-auraR, cy-auraR, auraR*2, auraR*2);
      }
      // Legs
      ctx.fillStyle = '#6fa6cc'; ctx.fillRect(px + s*0.30, py + s*0.68, s*0.16, s*0.24); ctx.fillRect(px + s*0.54, py + s*0.68, s*0.16, s*0.24);
      // Torso
      ctx.fillStyle = '#8cc4e6'; ctx.fillRect(px + s*0.24, py + s*0.34, s*0.52, s*0.40);
      ctx.fillStyle = '#aadcf4'; ctx.fillRect(px + s*0.24, py + s*0.34, s*0.26, s*0.40);
      // Shoulder ice shards
      ctx.fillStyle = '#dff2ff';
      [[0.22,0.36],[0.30,0.30],[0.70,0.30],[0.78,0.36]].forEach(([fx,fy]) => { ctx.beginPath(); ctx.moveTo(px+s*fx, py+s*fy); ctx.lineTo(px+s*(fx+0.03), py+s*(fy-0.16)); ctx.lineTo(px+s*(fx+0.08), py+s*fy); ctx.closePath(); ctx.fill(); });
      // Head
      ctx.fillStyle = '#aadcf4';
      ctx.beginPath(); ctx.arc(cx, py + s*0.22, s*0.17, 0, Math.PI*2); ctx.fill();
      // Icicle beard
      ctx.fillStyle = '#e8f6ff';
      [0.40,0.47,0.54,0.61].forEach(fx => { ctx.beginPath(); ctx.moveTo(px+s*fx, py+s*0.28); ctx.lineTo(px+s*(fx+0.02), py+s*0.42); ctx.lineTo(px+s*(fx+0.05), py+s*0.28); ctx.closePath(); ctx.fill(); });
      // Ice crown
      ctx.fillStyle = '#dff2ff';
      [0.34,0.42,0.50,0.58,0.66].forEach(fx => { ctx.beginPath(); ctx.moveTo(px+s*fx, py+s*0.12); ctx.lineTo(px+s*(fx+0.02), py-s*0.04); ctx.lineTo(px+s*(fx+0.05), py+s*0.12); ctx.closePath(); ctx.fill(); });
      // Glowing eyes
      ctx.fillStyle = `rgba(120,220,255,${0.7+flap*0.3})`;
      ctx.fillRect(px + s*0.42, py + s*0.20, s*0.06, s*0.05); ctx.fillRect(px + s*0.53, py + s*0.20, s*0.06, s*0.05);
      // Ice greatsword (right)
      ctx.fillStyle = 'rgba(210,240,255,0.92)';
      ctx.beginPath(); ctx.moveTo(px + s*0.82, py + s*0.06); ctx.lineTo(px + s*0.88, py + s*0.20); ctx.lineTo(px + s*0.85, py + s*0.74); ctx.lineTo(px + s*0.79, py + s*0.74); ctx.lineTo(px + s*0.76, py + s*0.20); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#6fa6cc'; ctx.fillRect(px + s*0.74, py + s*0.74, s*0.16, s*0.05);
      break;
    }
  }
}

registerEnemyArt(drawIceCreature, [
  'ice_mephit', 'winter_wolf', 'yeti', 'mammoth', 'white_dragon', 'frost_giant',
  'frost_titan',
]);
