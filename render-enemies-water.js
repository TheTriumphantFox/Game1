// Water creatures and their boss. Reached through ENEMY_ART (render-enemies.js),
// which also draws what every creature shares: shadow, auras, HP bar and name tag.

function drawWaterCreature(e, ts, s, px, py, cx, cy, flap, phase, fb, bob, boxTop) {
  switch (e.type) {
    case 'sahuagin': {
      // Body
      ctx.fillStyle = '#2f6a5c'; ctx.fillRect(px + s*0.28, py + s*0.42, s*0.40, s*0.46);
      ctx.fillStyle = '#3f8a78'; ctx.fillRect(px + s*0.28, py + s*0.42, s*0.20, s*0.46);
      // Dorsal fin
      ctx.fillStyle = '#1f4a40';
      ctx.beginPath(); ctx.moveTo(cx, py + s*0.18); ctx.lineTo(px + s*0.40, py + s*0.40); ctx.lineTo(px + s*0.60, py + s*0.40); ctx.closePath(); ctx.fill();
      // Head
      ctx.fillStyle = '#3f8a78';
      ctx.beginPath(); ctx.arc(cx, py + s*0.32, s*0.18, 0, Math.PI*2); ctx.fill();
      // Gills
      ctx.strokeStyle = '#1f4a40'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(px + s*0.34, py + s*0.34); ctx.lineTo(px + s*0.38, py + s*0.40); ctx.moveTo(px + s*0.30, py + s*0.38); ctx.lineTo(px + s*0.34, py + s*0.44); ctx.stroke();
      // Fish eyes
      ctx.fillStyle = '#ffdd55';
      ctx.beginPath(); ctx.arc(px + s*0.42, py + s*0.30, s*0.05, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + s*0.58, py + s*0.30, s*0.05, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(px + s*0.42, py + s*0.30, s*0.02, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + s*0.58, py + s*0.30, s*0.02, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#0a1a18'; ctx.fillRect(px + s*0.42, py + s*0.40, s*0.16, s*0.04);
      // Trident
      ctx.strokeStyle = '#bcae90'; ctx.lineWidth = Math.max(2, s*0.05);
      ctx.beginPath(); ctx.moveTo(px + s*0.80, py + s*0.12); ctx.lineTo(px + s*0.80, py + s*0.92);
      ctx.moveTo(px + s*0.72, py + s*0.14); ctx.lineTo(px + s*0.72, py + s*0.02);
      ctx.moveTo(px + s*0.80, py + s*0.12); ctx.lineTo(px + s*0.80, py - s*0.02);
      ctx.moveTo(px + s*0.88, py + s*0.14); ctx.lineTo(px + s*0.88, py + s*0.02);
      ctx.stroke();
      break;
    }
    case 'kuo_toa': {
      // Hunched body
      ctx.fillStyle = '#5a7a68';
      ctx.beginPath(); ctx.ellipse(cx, py + s*0.60, s*0.26, s*0.28, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#6f9080';
      ctx.beginPath(); ctx.ellipse(cx - s*0.05, py + s*0.56, s*0.18, s*0.20, 0, 0, Math.PI*2); ctx.fill();
      // Head
      ctx.fillStyle = '#6f9080';
      ctx.beginPath(); ctx.arc(cx, py + s*0.30, s*0.18, 0, Math.PI*2); ctx.fill();
      // Bulging eyes on stalks
      ctx.fillStyle = '#5a7a68';
      ctx.fillRect(px + s*0.30, py + s*0.20, s*0.06, s*0.06);
      ctx.fillRect(px + s*0.64, py + s*0.20, s*0.06, s*0.06);
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(px + s*0.32, py + s*0.18, s*0.07, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + s*0.68, py + s*0.18, s*0.07, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(px + s*0.32, py + s*0.18, s*0.03, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + s*0.68, py + s*0.18, s*0.03, 0, Math.PI*2); ctx.fill();
      // Gaping mouth
      ctx.fillStyle = '#0a1a14';
      ctx.beginPath(); ctx.arc(cx, py + s*0.40, s*0.07, 0, Math.PI*2); ctx.fill();
      // Spindly arms
      ctx.strokeStyle = '#5a7a68'; ctx.lineWidth = Math.max(2, s*0.05); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(px + s*0.30, py + s*0.50); ctx.lineTo(px + s*0.10, py + s*0.64); ctx.moveTo(px + s*0.70, py + s*0.50); ctx.lineTo(px + s*0.90, py + s*0.64); ctx.stroke();
      break;
    }
    case 'hunter_shark': {
      // Torpedo body
      ctx.fillStyle = '#54707c';
      ctx.beginPath(); ctx.ellipse(cx, py + s*0.56, s*0.40, s*0.18, 0, 0, Math.PI*2); ctx.fill();
      // Pale belly
      ctx.fillStyle = '#aab8bf';
      ctx.beginPath(); ctx.ellipse(cx, py + s*0.64, s*0.34, s*0.09, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#54707c';
      // Tail fin (left)
      ctx.beginPath(); ctx.moveTo(px + s*0.06, py + s*0.56); ctx.lineTo(px - s*0.04, py + s*0.40); ctx.lineTo(px - s*0.04, py + s*0.72); ctx.closePath(); ctx.fill();
      // Dorsal fin
      ctx.beginPath(); ctx.moveTo(cx - s*0.02, py + s*0.40); ctx.lineTo(cx + s*0.10, py + s*0.18); ctx.lineTo(cx + s*0.18, py + s*0.42); ctx.closePath(); ctx.fill();
      // Pectoral fin
      ctx.beginPath(); ctx.moveTo(cx + s*0.04, py + s*0.66); ctx.lineTo(cx - s*0.02, py + s*0.84); ctx.lineTo(cx + s*0.16, py + s*0.68); ctx.closePath(); ctx.fill();
      // Gill slits
      ctx.strokeStyle = '#36505a'; ctx.lineWidth = 1.5;
      for (let i=0;i<3;i++){ ctx.beginPath(); ctx.moveTo(px + s*0.62 + i*s*0.05, py + s*0.48); ctx.lineTo(px + s*0.62 + i*s*0.05, py + s*0.62); ctx.stroke(); }
      // Eye
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(px + s*0.80, py + s*0.52, s*0.035, 0, Math.PI*2); ctx.fill();
      // Toothy grin
      ctx.fillStyle = '#0a1a1e'; ctx.fillRect(px + s*0.80, py + s*0.60, s*0.16, s*0.04);
      ctx.fillStyle = '#fff';
      for (let i=0;i<4;i++) ctx.fillRect(px + s*0.81 + i*s*0.04, py + s*0.60, s*0.015, s*0.04);
      break;
    }
    case 'merrow': {
      // Hulking body
      ctx.fillStyle = '#2f5a7a'; ctx.fillRect(px + s*0.18, py + s*0.36, s*0.58, s*0.54);
      ctx.fillStyle = '#3f7090'; ctx.fillRect(px + s*0.18, py + s*0.36, s*0.30, s*0.54);
      // Spiny back fin
      ctx.fillStyle = '#1f4055';
      [0.22,0.34,0.46].forEach(fx => { ctx.beginPath(); ctx.moveTo(px + s*fx, py + s*0.36); ctx.lineTo(px + s*(fx+0.04), py + s*0.18); ctx.lineTo(px + s*(fx+0.10), py + s*0.36); ctx.closePath(); ctx.fill(); });
      // Head
      ctx.fillStyle = '#3f7090';
      ctx.beginPath(); ctx.arc(cx + s*0.02, py + s*0.26, s*0.20, 0, Math.PI*2); ctx.fill();
      // Underbite teeth
      ctx.fillStyle = '#0a2030'; ctx.fillRect(px + s*0.42, py + s*0.34, s*0.22, s*0.06);
      ctx.fillStyle = '#e8f0f0';
      for (let i=0;i<5;i++) ctx.fillRect(px + s*0.43 + i*s*0.045, py + s*0.36, s*0.02, s*0.05);
      // Yellow eyes
      ctx.fillStyle = '#ffdd44';
      ctx.fillRect(px + s*0.44, py + s*0.22, s*0.06, s*0.05);
      ctx.fillRect(px + s*0.58, py + s*0.22, s*0.06, s*0.05);
      ctx.fillStyle = '#000';
      ctx.fillRect(px + s*0.46, py + s*0.23, s*0.02, s*0.03);
      ctx.fillRect(px + s*0.60, py + s*0.23, s*0.02, s*0.03);
      // Harpoon
      ctx.strokeStyle = '#3a2410'; ctx.lineWidth = Math.max(2, s*0.05);
      ctx.beginPath(); ctx.moveTo(px + s*0.84, py + s*0.16); ctx.lineTo(px + s*0.84, py + s*0.92); ctx.stroke();
      ctx.fillStyle = '#bcb0a0';
      ctx.beginPath(); ctx.moveTo(px + s*0.84, py + s*0.06); ctx.lineTo(px + s*0.78, py + s*0.20); ctx.lineTo(px + s*0.90, py + s*0.20); ctx.closePath(); ctx.fill();
      break;
    }
    case 'sea_hag': {
      // Sickly aura
      const sha = ctx.createRadialGradient(cx, cy, 0, cx, cy, s*0.5);
      sha.addColorStop(0, `rgba(90,180,90,${0.25 + flap*0.2})`);
      sha.addColorStop(1, 'rgba(90,180,90,0)');
      ctx.fillStyle = sha; ctx.fillRect(fb.x - s*0.1, fb.y - s*0.1, s*1.2, s*1.2);
      // Ragged robe
      ctx.fillStyle = '#2f5a3a';
      ctx.beginPath(); ctx.moveTo(px + s*0.26, py + s*0.40); ctx.lineTo(px + s*0.74, py + s*0.40);
      for (let i=6;i>=0;i--){ const fx = px + s*0.26 + s*0.48*(i/6); const fy = py + s*0.90 + Math.sin(Date.now()/240 + phase + i*0.6)*s*0.04; ctx.lineTo(fx, fy); }
      ctx.closePath(); ctx.fill();
      // Green face
      ctx.fillStyle = '#5a8a4a';
      ctx.beginPath(); ctx.arc(cx, py + s*0.30, s*0.18, 0, Math.PI*2); ctx.fill();
      // Stringy hair
      ctx.strokeStyle = '#3a5a2a'; ctx.lineWidth = Math.max(1.5, s*0.03);
      [0.30,0.40,0.60,0.70].forEach(fx => { ctx.beginPath(); ctx.moveTo(px + s*fx, py + s*0.18); ctx.lineTo(px + s*(fx-0.04), py + s*0.46); ctx.stroke(); });
      // Crooked nose
      ctx.fillStyle = '#4a7a3a';
      ctx.beginPath(); ctx.moveTo(cx, py + s*0.30); ctx.lineTo(cx - s*0.04, py + s*0.40); ctx.lineTo(cx + s*0.04, py + s*0.38); ctx.closePath(); ctx.fill();
      // Glowing eyes
      ctx.fillStyle = `rgba(200,255,120,${0.7+flap*0.3})`;
      ctx.fillRect(px + s*0.40, py + s*0.26, s*0.06, s*0.04);
      ctx.fillRect(px + s*0.54, py + s*0.26, s*0.06, s*0.04);
      // Clawed casting hand + hex orb
      ctx.strokeStyle = '#5a8a4a'; ctx.lineWidth = Math.max(2, s*0.05); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(px + s*0.70, py + s*0.50); ctx.lineTo(px + s*0.90, py + s*0.40); ctx.stroke();
      ctx.fillStyle = `rgba(160,255,120,${0.6+flap*0.4})`;
      ctx.beginPath(); ctx.arc(px + s*0.92, py + s*0.38, s*0.06, 0, Math.PI*2); ctx.fill();
      break;
    }
    case 'water_elemental': {
      // Translucent body
      ctx.fillStyle = 'rgba(40,130,200,0.55)';
      ctx.beginPath();
      ctx.moveTo(px + s*0.10, py + s*0.90);
      ctx.bezierCurveTo(px + s*0.0, py + s*0.40, px + s*0.30, py + s*0.10 + Math.sin(Date.now()/200+phase)*s*0.04, cx, py + s*0.16);
      ctx.bezierCurveTo(px + s*0.70, py + s*0.10, px + s*1.0, py + s*0.40, px + s*0.90, py + s*0.90);
      ctx.closePath(); ctx.fill();
      // Inner highlight
      ctx.fillStyle = 'rgba(120,200,255,0.5)';
      ctx.beginPath(); ctx.ellipse(cx - s*0.06, py + s*0.50, s*0.18, s*0.30, 0, 0, Math.PI*2); ctx.fill();
      // Foam crest
      ctx.fillStyle = 'rgba(230,250,255,0.8)';
      for (let i=0;i<4;i++){ ctx.beginPath(); ctx.arc(px + s*0.28 + i*s*0.16, py + s*0.20 + Math.sin(Date.now()/160+i+phase)*s*0.03, s*0.05, 0, Math.PI*2); ctx.fill(); }
      // Eyes
      ctx.fillStyle = '#eaffff';
      ctx.beginPath(); ctx.arc(px + s*0.42, py + s*0.46, s*0.06, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + s*0.60, py + s*0.46, s*0.06, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#1a4a6a';
      ctx.beginPath(); ctx.arc(px + s*0.42, py + s*0.46, s*0.03, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + s*0.60, py + s*0.46, s*0.03, 0, Math.PI*2); ctx.fill();
      break;
    }
    case 'kraken_boss': {
      if (e.boss) {
        const auraR = s*0.62 + Math.sin(Date.now()/220)*s*0.04;
        const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, auraR);
        aura.addColorStop(0, 'rgba(40,140,210,0.40)'); aura.addColorStop(1, 'rgba(40,140,210,0)');
        ctx.fillStyle = aura; ctx.fillRect(cx-auraR, cy-auraR, auraR*2, auraR*2);
      }
      // Writhing tentacles
      ctx.lineCap = 'round';
      for (let pass=0; pass<2; pass++){
        ctx.strokeStyle = pass ? '#3a96d8' : '#1f6aa0';
        ctx.lineWidth = pass ? Math.max(1.5, s*0.03) : Math.max(3, s*0.07);
        for (let i=0;i<6;i++){
          const t = (i-2.5)/2.5;
          const baseX = cx + t*s*0.22;
          const sway = Math.sin(Date.now()/240 + phase + i)*s*0.12;
          ctx.beginPath();
          ctx.moveTo(baseX, py + s*(0.52 + pass*0.02));
          ctx.quadraticCurveTo(baseX + t*s*0.30, py + s*0.74, cx + t*s*0.46 + sway, py + s*(0.96 - pass*0.02));
          ctx.stroke();
        }
      }
      // Mantle / head
      ctx.fillStyle = '#2a7ec0';
      ctx.beginPath();
      ctx.moveTo(cx, py + s*0.04);
      ctx.quadraticCurveTo(px + s*0.16, py + s*0.30, px + s*0.26, py + s*0.56);
      ctx.quadraticCurveTo(cx, py + s*0.68, px + s*0.74, py + s*0.56);
      ctx.quadraticCurveTo(px + s*0.84, py + s*0.30, cx, py + s*0.04);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#3a96d8';
      ctx.beginPath(); ctx.ellipse(cx - s*0.05, py + s*0.30, s*0.15, s*0.22, 0, 0, Math.PI*2); ctx.fill();
      // Glowing eyes
      ctx.fillStyle = `rgba(255,240,140,${0.7+flap*0.3})`;
      ctx.beginPath(); ctx.arc(px + s*0.40, py + s*0.40, s*0.08, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + s*0.60, py + s*0.40, s*0.08, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.fillRect(px + s*0.385, py + s*0.38, s*0.03, s*0.07);
      ctx.fillRect(px + s*0.585, py + s*0.38, s*0.03, s*0.07);
      // Beak
      ctx.fillStyle = '#0a2a3a';
      ctx.beginPath(); ctx.moveTo(cx - s*0.06, py + s*0.52); ctx.lineTo(cx, py + s*0.62); ctx.lineTo(cx + s*0.06, py + s*0.52); ctx.closePath(); ctx.fill();
      break;
    }
  }
}

registerEnemyArt(drawWaterCreature, [
  'sahuagin', 'kuo_toa', 'hunter_shark', 'merrow', 'sea_hag', 'water_elemental',
  'kraken_boss',
]);
