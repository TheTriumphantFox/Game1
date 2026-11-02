// Luminous creatures and their boss. Reached through ENEMY_ART (render-enemies.js),
// which also draws what every creature shares: shadow, auras, HP bar and name tag.

function drawLuminousCreature(e, ts, s, px, py, cx, cy, flap, phase, fb, bob, boxTop) {
  switch (e.type) {
    case 'pegasus': {
      const pwf = Math.sin(Date.now()/120 + phase)*0.2 + 1;
      // Wing
      ctx.fillStyle = '#e8eef8';
      ctx.beginPath(); ctx.moveTo(cx, py + s*0.46); ctx.lineTo(px + s*0.12, py + s*0.18/pwf); ctx.lineTo(px + s*0.36, py + s*0.32); ctx.lineTo(px + s*0.34, py + s*0.56); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.moveTo(cx - s*0.02, py + s*0.46); ctx.lineTo(px + s*0.18, py + s*0.26/pwf); ctx.lineTo(px + s*0.30, py + s*0.42); ctx.closePath(); ctx.fill();
      // Body
      ctx.fillStyle = '#f4f6fb';
      ctx.beginPath(); ctx.ellipse(px + s*0.42, py + s*0.62, s*0.28, s*0.16, 0, 0, Math.PI*2); ctx.fill();
      // Neck + head (right)
      ctx.fillStyle = '#f4f6fb';
      ctx.beginPath(); ctx.moveTo(px + s*0.60, py + s*0.56); ctx.lineTo(px + s*0.74, py + s*0.30); ctx.lineTo(px + s*0.84, py + s*0.34); ctx.lineTo(px + s*0.72, py + s*0.60); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(px + s*0.80, py + s*0.30, s*0.10, 0, Math.PI*2); ctx.fill();
      // Mane
      ctx.fillStyle = '#ffe89a';
      ctx.beginPath(); ctx.moveTo(px + s*0.70, py + s*0.30); ctx.lineTo(px + s*0.62, py + s*0.52); ctx.lineTo(px + s*0.70, py + s*0.52); ctx.closePath(); ctx.fill();
      // Eye + legs
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(px + s*0.83, py + s*0.28, s*0.02, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#e0e4ee';
      [0.30,0.42,0.54].forEach(fx => ctx.fillRect(px + s*fx, py + s*0.76, s*0.06, s*0.16));
      break;
    }
    case 'couatl': {
      const cwf = Math.sin(Date.now()/110 + phase)*0.25 + 1;
      // Feathered wings
      ctx.fillStyle = '#3aa0c0';
      ctx.beginPath(); ctx.moveTo(cx - s*0.04, py + s*0.44); ctx.lineTo(px + s*0.04, py + s*0.18/cwf); ctx.lineTo(px + s*0.24, py + s*0.34); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + s*0.04, py + s*0.44); ctx.lineTo(px + s*0.96, py + s*0.18/cwf); ctx.lineTo(px + s*0.76, py + s*0.34); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#caa840';
      ctx.beginPath(); ctx.moveTo(cx - s*0.02, py + s*0.44); ctx.lineTo(px + s*0.14, py + s*0.28/cwf); ctx.lineTo(px + s*0.26, py + s*0.40); ctx.closePath(); ctx.fill();
      // Coiled body
      ctx.strokeStyle = '#e0b84a'; ctx.lineWidth = Math.max(4, s*0.14); ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(px + s*0.30, py + s*0.88);
      ctx.quadraticCurveTo(px + s*0.74, py + s*0.78, px + s*0.52, py + s*0.56);
      ctx.quadraticCurveTo(px + s*0.34, py + s*0.40, cx, py + s*0.34);
      ctx.stroke();
      // Head
      ctx.fillStyle = '#f0cc5a';
      ctx.beginPath(); ctx.arc(cx, py + s*0.30, s*0.14, 0, Math.PI*2); ctx.fill();
      // Eyes (glowing)
      ctx.fillStyle = `rgba(255,250,200,${0.7+flap*0.3})`;
      ctx.fillRect(cx - s*0.07, py + s*0.28, s*0.04, s*0.04); ctx.fillRect(cx + s*0.03, py + s*0.28, s*0.04, s*0.04);
      // Halo arc
      ctx.strokeStyle = `rgba(255,240,160,${0.4+flap*0.3})`; ctx.lineWidth = Math.max(1.5, s*0.03);
      ctx.beginPath(); ctx.arc(cx, py + s*0.22, s*0.18, Math.PI*1.1, Math.PI*1.9); ctx.stroke();
      break;
    }
    case 'unicorn': {
      // Body
      ctx.fillStyle = '#f6f4fa';
      ctx.beginPath(); ctx.ellipse(px + s*0.42, py + s*0.62, s*0.28, s*0.16, 0, 0, Math.PI*2); ctx.fill();
      // Neck + head (right)
      ctx.fillStyle = '#f6f4fa';
      ctx.beginPath(); ctx.moveTo(px + s*0.60, py + s*0.56); ctx.lineTo(px + s*0.74, py + s*0.28); ctx.lineTo(px + s*0.86, py + s*0.32); ctx.lineTo(px + s*0.74, py + s*0.60); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(px + s*0.82, py + s*0.28, s*0.11, 0, Math.PI*2); ctx.fill();
      // Spiral horn (glowing)
      ctx.strokeStyle = `rgba(255,240,170,${0.7+flap*0.3})`; ctx.lineWidth = Math.max(2, s*0.05);
      ctx.beginPath(); ctx.moveTo(px + s*0.86, py + s*0.20); ctx.lineTo(px + s*0.98, py + s*0.02); ctx.stroke();
      ctx.fillStyle = '#fff4c0';
      ctx.beginPath(); ctx.arc(px + s*0.98, py + s*0.02, s*0.03, 0, Math.PI*2); ctx.fill();
      // Mane
      ctx.fillStyle = '#ffd0e0';
      ctx.beginPath(); ctx.moveTo(px + s*0.70, py + s*0.28); ctx.lineTo(px + s*0.60, py + s*0.54); ctx.lineTo(px + s*0.70, py + s*0.54); ctx.closePath(); ctx.fill();
      // Eye + legs
      ctx.fillStyle = '#5a3aaa'; ctx.beginPath(); ctx.arc(px + s*0.84, py + s*0.26, s*0.025, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#e6e2ee';
      [0.30,0.42,0.54].forEach(fx => ctx.fillRect(px + s*fx, py + s*0.76, s*0.06, s*0.16));
      break;
    }
    case 'ki_rin': {
      // Glow
      const kga = ctx.createRadialGradient(cx, cy, 0, cx, cy, s*0.5);
      kga.addColorStop(0, `rgba(255,230,140,${0.25+flap*0.2})`);
      kga.addColorStop(1, 'rgba(255,230,140,0)');
      ctx.fillStyle = kga; ctx.fillRect(fb.x - s*0.1, fb.y - s*0.1, s*1.2, s*1.2);
      // Sinuous body
      ctx.strokeStyle = '#e8c24a'; ctx.lineWidth = Math.max(4, s*0.15); ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(px + s*0.14, py + s*0.86);
      ctx.quadraticCurveTo(px + s*0.46, py + s*0.74, px + s*0.46, py + s*0.52);
      ctx.quadraticCurveTo(px + s*0.46, py + s*0.34, px + s*0.66, py + s*0.28);
      ctx.stroke();
      // Flame-mane
      ctx.fillStyle = '#ffae3a';
      [[0.40,0.40],[0.36,0.52],[0.40,0.64]].forEach(([fx,fy]) => { ctx.beginPath(); ctx.moveTo(px + s*fx, py + s*fy); ctx.lineTo(px + s*(fx-0.12), py + s*(fy-0.04)); ctx.lineTo(px + s*fx, py + s*(fy+0.08)); ctx.closePath(); ctx.fill(); });
      // Head
      ctx.fillStyle = '#f4cc5a';
      ctx.beginPath(); ctx.arc(px + s*0.70, py + s*0.26, s*0.14, 0, Math.PI*2); ctx.fill();
      // Antlers
      ctx.strokeStyle = '#caa030'; ctx.lineWidth = Math.max(2, s*0.04);
      ctx.beginPath(); ctx.moveTo(px + s*0.66, py + s*0.16); ctx.lineTo(px + s*0.60, py + s*0.04); ctx.moveTo(px + s*0.74, py + s*0.16); ctx.lineTo(px + s*0.80, py + s*0.04); ctx.stroke();
      // Eye
      ctx.fillStyle = 'rgba(255,255,220,0.9)'; ctx.fillRect(px + s*0.72, py + s*0.24, s*0.05, s*0.04);
      ctx.fillStyle = '#000'; ctx.fillRect(px + s*0.735, py + s*0.25, s*0.02, s*0.03);
      break;
    }
    case 'deva': {
      const dvf = Math.sin(Date.now()/130 + phase)*0.15 + 1;
      // Feathered wings
      ctx.fillStyle = '#f2f4fa';
      ctx.beginPath(); ctx.moveTo(cx - s*0.06, py + s*0.40); ctx.lineTo(px + s*0.02, py + s*0.14/dvf); ctx.lineTo(px + s*0.10, py + s*0.26); ctx.lineTo(px + s*0.16, py + s*0.40); ctx.lineTo(px + s*0.10, py + s*0.56); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + s*0.06, py + s*0.40); ctx.lineTo(px + s*0.98, py + s*0.14/dvf); ctx.lineTo(px + s*0.90, py + s*0.26); ctx.lineTo(px + s*0.84, py + s*0.40); ctx.lineTo(px + s*0.90, py + s*0.56); ctx.closePath(); ctx.fill();
      // Robe
      ctx.fillStyle = '#e6ecf6';
      ctx.beginPath(); ctx.moveTo(px + s*0.34, py + s*0.40); ctx.lineTo(px + s*0.66, py + s*0.40); ctx.lineTo(px + s*0.74, py + s*0.90); ctx.lineTo(px + s*0.26, py + s*0.90); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffd86a'; ctx.fillRect(px + s*0.34, py + s*0.56, s*0.32, s*0.05);
      // Head
      ctx.fillStyle = '#f0d8c0';
      ctx.beginPath(); ctx.arc(cx, py + s*0.30, s*0.14, 0, Math.PI*2); ctx.fill();
      // Halo
      ctx.strokeStyle = `rgba(255,240,150,${0.6+flap*0.4})`; ctx.lineWidth = Math.max(2, s*0.04);
      ctx.beginPath(); ctx.arc(cx, py + s*0.14, s*0.12, 0, Math.PI*2); ctx.stroke();
      // Serene eyes
      ctx.fillStyle = 'rgba(180,210,255,0.9)';
      ctx.fillRect(cx - s*0.07, py + s*0.28, s*0.04, s*0.03); ctx.fillRect(cx + s*0.03, py + s*0.28, s*0.04, s*0.03);
      break;
    }
    case 'planetar': {
      const plf = Math.sin(Date.now()/130 + phase)*0.15 + 1;
      // Radiance
      const pla = ctx.createRadialGradient(cx, cy, 0, cx, cy, s*0.55);
      pla.addColorStop(0, `rgba(255,250,210,${0.25+flap*0.2})`);
      pla.addColorStop(1, 'rgba(255,250,210,0)');
      ctx.fillStyle = pla; ctx.fillRect(fb.x - s*0.1, fb.y - s*0.1, s*1.2, s*1.2);
      // Wings
      ctx.fillStyle = '#fbfcff';
      ctx.beginPath(); ctx.moveTo(cx - s*0.06, py + s*0.38); ctx.lineTo(px - s*0.02, py + s*0.10/plf); ctx.lineTo(px + s*0.12, py + s*0.24); ctx.lineTo(px + s*0.16, py + s*0.40); ctx.lineTo(px + s*0.08, py + s*0.58); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + s*0.06, py + s*0.38); ctx.lineTo(px + s*1.02, py + s*0.10/plf); ctx.lineTo(px + s*0.88, py + s*0.24); ctx.lineTo(px + s*0.84, py + s*0.40); ctx.lineTo(px + s*0.92, py + s*0.58); ctx.closePath(); ctx.fill();
      // Robe
      ctx.fillStyle = '#dfe8f2';
      ctx.beginPath(); ctx.moveTo(px + s*0.34, py + s*0.40); ctx.lineTo(px + s*0.66, py + s*0.40); ctx.lineTo(px + s*0.72, py + s*0.90); ctx.lineTo(px + s*0.28, py + s*0.90); ctx.closePath(); ctx.fill();
      // Head (green-skinned angel)
      ctx.fillStyle = '#a8d0a0';
      ctx.beginPath(); ctx.arc(cx, py + s*0.28, s*0.14, 0, Math.PI*2); ctx.fill();
      // Halo
      ctx.strokeStyle = `rgba(255,245,170,${0.7+flap*0.3})`; ctx.lineWidth = Math.max(2, s*0.05);
      ctx.beginPath(); ctx.arc(cx, py + s*0.12, s*0.13, 0, Math.PI*2); ctx.stroke();
      // Glowing eyes
      ctx.fillStyle = '#ffffff'; ctx.fillRect(cx - s*0.07, py + s*0.26, s*0.04, s*0.03); ctx.fillRect(cx + s*0.03, py + s*0.26, s*0.04, s*0.03);
      // Radiant greatsword
      ctx.fillStyle = `rgba(255,250,200,${0.7+flap*0.3})`;
      ctx.fillRect(px + s*0.74, py + s*0.36, s*0.05, s*0.52);
      ctx.fillStyle = '#ffd86a'; ctx.fillRect(px + s*0.70, py + s*0.36, s*0.13, s*0.04);
      break;
    }
    case 'seraph_judge': {
      if (e.boss) {
        const auraR = s*0.64 + Math.sin(Date.now()/220)*s*0.05;
        const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, auraR);
        aura.addColorStop(0, `rgba(255,245,180,${0.45+flap*0.2})`); aura.addColorStop(1, 'rgba(255,245,180,0)');
        ctx.fillStyle = aura; ctx.fillRect(cx-auraR, cy-auraR, auraR*2, auraR*2);
      }
      // Six wings (three pairs)
      const swf = Math.sin(Date.now()/150 + phase)*0.12 + 1;
      ctx.fillStyle = '#fbf6e0';
      [[0.20,0.18],[0.14,0.40],[0.20,0.62]].forEach(([wx,wy]) => {
        ctx.beginPath(); ctx.moveTo(cx - s*0.04, py + s*(wy+0.06)); ctx.lineTo(px + s*(wx-0.06), py + s*wy/swf); ctx.lineTo(px + s*(wx+0.10), py + s*(wy+0.10)); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(cx + s*0.04, py + s*(wy+0.06)); ctx.lineTo(px + s*(1-wx+0.06), py + s*wy/swf); ctx.lineTo(px + s*(1-wx-0.10), py + s*(wy+0.10)); ctx.closePath(); ctx.fill();
      });
      // Robe
      ctx.fillStyle = '#fff4d0';
      ctx.beginPath(); ctx.moveTo(px + s*0.36, py + s*0.40); ctx.lineTo(px + s*0.64, py + s*0.40); ctx.lineTo(px + s*0.72, py + s*0.90); ctx.lineTo(px + s*0.28, py + s*0.90); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffe08a'; ctx.fillRect(px + s*0.36, py + s*0.56, s*0.28, s*0.05);
      // Radiant head
      ctx.fillStyle = '#fff0c0';
      ctx.beginPath(); ctx.arc(cx, py + s*0.28, s*0.13, 0, Math.PI*2); ctx.fill();
      // Halo
      ctx.strokeStyle = `rgba(255,235,140,${0.7+flap*0.3})`; ctx.lineWidth = Math.max(2, s*0.05);
      ctx.beginPath(); ctx.arc(cx, py + s*0.10, s*0.13, 0, Math.PI*2); ctx.stroke();
      // Blazing eyes
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx - s*0.07, py + s*0.26, s*0.04, s*0.04); ctx.fillRect(cx + s*0.03, py + s*0.26, s*0.04, s*0.04);
      // Radiant greatsword (center-front, vertical)
      ctx.fillStyle = `rgba(255,250,210,${0.8+flap*0.2})`;
      ctx.fillRect(cx - s*0.025, py + s*0.40, s*0.05, s*0.46);
      ctx.fillStyle = '#ffd86a'; ctx.fillRect(cx - s*0.10, py + s*0.40, s*0.20, s*0.04);
      break;
    }
  }
}

registerEnemyArt(drawLuminousCreature, [
  'pegasus', 'couatl', 'unicorn', 'ki_rin', 'deva', 'planetar', 'seraph_judge',
]);
