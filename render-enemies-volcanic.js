// Volcanic creatures and their boss. Reached through ENEMY_ART (render-enemies.js),
// which also draws what every creature shares: shadow, auras, HP bar and name tag.

function drawVolcanicCreature(e, ts, s, px, py, cx, cy, flap, phase, fb, bob, boxTop) {
  switch (e.type) {
    // ─── Volcanic region ───────────────────────────────────────────────
    case 'magmin': {
      // A small molten imp — a lump of cracked black rock lit from within by lava,
      // trailing heat, with two burning eyes. Fiery aura pulse.
      const ga = ctx.createRadialGradient(cx, cy, 0, cx, cy, s*0.5);
      ga.addColorStop(0, `rgba(255,120,30,${0.32+flap*0.22})`); ga.addColorStop(1, 'rgba(255,60,10,0)');
      ctx.fillStyle = ga; ctx.fillRect(fb.x - s*0.1, fb.y - s*0.1, s*1.2, s*1.2);
      ctx.fillStyle = '#2a1206';
      ctx.beginPath(); ctx.arc(cx, py + s*0.58, s*0.26, 0, Math.PI*2); ctx.fill();       // body
      ctx.fillRect(px + s*0.24, py + s*0.72, s*0.16, s*0.20); ctx.fillRect(px + s*0.60, py + s*0.72, s*0.16, s*0.20);   // legs
      ctx.strokeStyle = `rgba(255,140,40,${0.6+flap*0.4})`; ctx.lineWidth = Math.max(1.5, s*0.05); ctx.lineCap='round';   // lava cracks
      ctx.beginPath();
      ctx.moveTo(cx - s*0.14, py + s*0.48); ctx.lineTo(cx - s*0.02, py + s*0.60); ctx.lineTo(cx - s*0.12, py + s*0.72);
      ctx.moveTo(cx + s*0.12, py + s*0.50); ctx.lineTo(cx + s*0.02, py + s*0.62);
      ctx.stroke(); ctx.lineCap='butt';
      ctx.fillStyle = '#2a1206';
      ctx.beginPath(); ctx.arc(cx, py + s*0.32, s*0.17, 0, Math.PI*2); ctx.fill();        // head
      ctx.fillStyle = `rgba(255,210,80,${0.75+flap*0.25})`;
      ctx.fillRect(cx - s*0.09, py + s*0.30, s*0.06, s*0.05); ctx.fillRect(cx + s*0.03, py + s*0.30, s*0.06, s*0.05);   // eyes
      ctx.fillStyle = '#ff6a1e'; ctx.fillRect(cx - s*0.05, py + s*0.40, s*0.10, s*0.03);  // mouth
      break;
    }
    case 'fire_snake': {
      // A serpent of living fire — a coiling ember body brightening toward a flat
      // viper head with a glowing forked tongue. Heat shimmer.
      const ga = ctx.createRadialGradient(cx, cy, 0, cx, cy, s*0.5);
      ga.addColorStop(0, `rgba(255,110,30,${0.28+flap*0.2})`); ga.addColorStop(1, 'rgba(255,60,10,0)');
      ctx.fillStyle = ga; ctx.fillRect(fb.x - s*0.1, fb.y - s*0.1, s*1.2, s*1.2);
      ctx.strokeStyle = '#b8300f'; ctx.lineWidth = Math.max(3, s*0.14); ctx.lineCap='round';
      ctx.beginPath();
      ctx.moveTo(px + s*0.14, py + s*0.86);
      ctx.quadraticCurveTo(px + s*0.86, py + s*0.80, px + s*0.44, py + s*0.56);
      ctx.quadraticCurveTo(px + s*0.14, py + s*0.40, px + s*0.62, py + s*0.28);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,150,50,${0.7+flap*0.3})`; ctx.lineWidth = Math.max(1.5, s*0.06); ctx.stroke();
      ctx.lineCap='butt';
      ctx.fillStyle = '#d23a12';
      ctx.beginPath(); ctx.ellipse(px + s*0.66, py + s*0.26, s*0.15, s*0.10, -0.3, 0, Math.PI*2); ctx.fill();   // head
      ctx.fillStyle = '#ffdf6a'; ctx.fillRect(px + s*0.70, py + s*0.22, s*0.05, s*0.04);
      ctx.fillStyle = '#000'; ctx.fillRect(px + s*0.72, py + s*0.23, s*0.02, s*0.02);
      ctx.strokeStyle = `rgba(255,200,60,${0.7+flap*0.3})`; ctx.lineWidth = Math.max(1, s*0.025);   // tongue
      ctx.beginPath(); ctx.moveTo(px + s*0.80, py + s*0.28); ctx.lineTo(px + s*0.92, py + s*0.26); ctx.stroke();
      break;
    }
    case 'azer': {
      // A fire dwarf smith — brass-skinned, a beard and crest of live flame, a heavy
      // hammer in hand. Squat armored humanoid.
      ctx.fillStyle = '#7a4a1c'; ctx.fillRect(px + s*0.30, py + s*0.70, s*0.14, s*0.22); ctx.fillRect(px + s*0.52, py + s*0.70, s*0.14, s*0.22);   // legs
      ctx.fillStyle = '#5a3414'; ctx.fillRect(px + s*0.28, py + s*0.54, s*0.40, s*0.22);   // apron
      ctx.fillStyle = '#c78a34'; ctx.fillRect(px + s*0.30, py + s*0.38, s*0.36, s*0.24);   // brass torso
      ctx.fillStyle = '#e2ab54'; ctx.fillRect(px + s*0.30, py + s*0.38, s*0.18, s*0.24);
      ctx.fillStyle = '#c78a34';
      ctx.beginPath(); ctx.arc(cx - s*0.02, py + s*0.28, s*0.15, 0, Math.PI*2); ctx.fill();   // head
      ctx.fillStyle = `rgba(255,140,30,${0.7+flap*0.3})`;                                    // flame beard + crest
      [0.34,0.44,0.54].forEach((fx,i)=>{ const fl=Math.sin(Date.now()/110+i+phase)*s*0.03;
        ctx.beginPath(); ctx.moveTo(px + s*fx, py + s*0.36); ctx.lineTo(px + s*(fx+0.03), py + s*0.50 + fl); ctx.lineTo(px + s*(fx+0.06), py + s*0.36); ctx.closePath(); ctx.fill(); });
      ctx.beginPath(); ctx.moveTo(cx - s*0.10, py + s*0.16); ctx.lineTo(cx - s*0.02, py + s*0.0); ctx.lineTo(cx + s*0.06, py + s*0.16); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffe070'; ctx.fillRect(cx - s*0.08, py + s*0.26, s*0.05, s*0.04); ctx.fillRect(cx + s*0.02, py + s*0.26, s*0.05, s*0.04);   // eyes
      ctx.strokeStyle = '#5a3414'; ctx.lineWidth = Math.max(2, s*0.05); ctx.beginPath(); ctx.moveTo(px + s*0.78, py + s*0.24); ctx.lineTo(px + s*0.78, py + s*0.80); ctx.stroke();   // hammer haft
      ctx.fillStyle = '#8a8078'; ctx.fillRect(px + s*0.68, py + s*0.16, s*0.20, s*0.14);   // hammer head
      break;
    }
    case 'red_wyrmling': {
      // A red dragon wyrmling — scarlet scales, ribbed wings, a horned head with a
      // spark of fire breath. Small, quick, airborne.
      const dwf = Math.sin(Date.now()/120 + phase) * 0.2 + 1;
      ctx.fillStyle = '#a02010';
      ctx.beginPath(); ctx.moveTo(px + s*0.06, py + s*0.40/dwf); ctx.lineTo(px + s*0.46, py + s*0.36); ctx.lineTo(px + s*0.28, py + s*0.60); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px + s*0.94, py + s*0.40/dwf); ctx.lineTo(px + s*0.54, py + s*0.36); ctx.lineTo(px + s*0.72, py + s*0.60); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#c8341c';
      ctx.beginPath(); ctx.ellipse(cx, py + s*0.54, s*0.20, s*0.26, 0, 0, Math.PI*2); ctx.fill();   // body
      ctx.fillStyle = '#e0492a';
      ctx.beginPath(); ctx.arc(cx, py + s*0.28, s*0.16, 0, Math.PI*2); ctx.fill();       // head
      ctx.fillStyle = '#5a1408';                                                          // horns
      ctx.beginPath(); ctx.moveTo(px + s*0.42, py + s*0.16); ctx.lineTo(px + s*0.32, py + s*0.04); ctx.lineTo(px + s*0.48, py + s*0.14); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px + s*0.58, py + s*0.16); ctx.lineTo(px + s*0.68, py + s*0.04); ctx.lineTo(px + s*0.52, py + s*0.14); ctx.closePath(); ctx.fill();
      ctx.fillStyle = `rgba(255,170,50,${0.5+flap*0.4})`; ctx.beginPath(); ctx.arc(cx, py + s*0.42, s*0.06, 0, Math.PI*2); ctx.fill();   // breath spark
      ctx.fillStyle = '#ffd23a'; ctx.fillRect(px + s*0.46, py + s*0.26, s*0.06, s*0.04);
      ctx.fillStyle = '#000'; ctx.fillRect(px + s*0.48, py + s*0.27, s*0.02, s*0.03);
      ctx.strokeStyle = '#c8341c'; ctx.lineWidth = Math.max(2, s*0.06);
      ctx.beginPath(); ctx.moveTo(cx, py + s*0.78); ctx.lineTo(cx + Math.sin(Date.now()/180+phase)*s*0.18, py + s); ctx.stroke();   // tail
      break;
    }
    case 'fire_elemental': {
      // A body of living flame — layered tongues of fire rising from the ground,
      // brightening to a white-hot core with two dark eyes. Fully animated.
      const t = Date.now();
      const flame = (fx, w, hgt, colr, spd) => {
        ctx.fillStyle = colr;
        ctx.beginPath();
        ctx.moveTo(px + s*(fx - w), py + s*0.92);
        for (let i=0;i<=6;i++){ const p=i/6; const wob=Math.sin(t/spd + p*6 + phase + fx*4)*s*0.05*(1-p);
          ctx.lineTo(px + s*fx + wob - Math.sin(p*Math.PI)*s*w*0.2, py + s*(0.92 - hgt*p)); }
        for (let i=6;i>=0;i--){ const p=i/6; const wob=Math.sin(t/spd + p*6 + phase + fx*4)*s*0.05*(1-p);
          ctx.lineTo(px + s*fx + wob + Math.sin(p*Math.PI)*s*w*0.2 + s*w*(1-p)*0.4, py + s*(0.92 - hgt*p)); }
        ctx.closePath(); ctx.fill();
      };
      flame(0.5, 0.34, 0.92, '#b8300f', 220);
      flame(0.46, 0.24, 0.80, '#ff6a1e', 170);
      flame(0.52, 0.16, 0.66, '#ffb038', 130);
      flame(0.49, 0.08, 0.50, '#ffe79a', 100);
      ctx.fillStyle = '#2a0a04';                                                          // eyes
      ctx.beginPath(); ctx.arc(cx - s*0.07, py + s*0.44, s*0.045, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + s*0.07, py + s*0.44, s*0.045, 0, Math.PI*2); ctx.fill();
      break;
    }
    case 'young_red_dragon': {
      // A young red dragon — a heavy scarlet wyrm with great ribbed wings, a horned
      // crest, and a hot glow building in its throat. Ranged breath attacker.
      const dwf = Math.sin(Date.now()/130 + phase) * 0.18 + 1;
      ctx.fillStyle = '#8a1808';
      ctx.beginPath(); ctx.moveTo(px + s*0.02, py + s*0.34/dwf); ctx.lineTo(px + s*0.44, py + s*0.30); ctx.lineTo(px + s*0.22, py + s*0.64); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px + s*0.98, py + s*0.34/dwf); ctx.lineTo(px + s*0.56, py + s*0.30); ctx.lineTo(px + s*0.78, py + s*0.64); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#a82212';
      ctx.beginPath(); ctx.moveTo(px + s*0.08, py + s*0.38/dwf); ctx.lineTo(px + s*0.42, py + s*0.34); ctx.lineTo(px + s*0.26, py + s*0.56); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px + s*0.92, py + s*0.38/dwf); ctx.lineTo(px + s*0.58, py + s*0.34); ctx.lineTo(px + s*0.74, py + s*0.56); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#bb2a16';
      ctx.beginPath(); ctx.ellipse(cx, py + s*0.56, s*0.22, s*0.30, 0, 0, Math.PI*2); ctx.fill();   // body
      ctx.fillStyle = '#d8562a'; ctx.beginPath(); ctx.ellipse(cx, py + s*0.62, s*0.10, s*0.18, 0, 0, Math.PI*2); ctx.fill();   // belly
      ctx.fillStyle = '#cc3418';
      ctx.beginPath(); ctx.arc(cx, py + s*0.26, s*0.17, 0, Math.PI*2); ctx.fill();       // head
      ctx.fillStyle = '#5a1408';                                                          // horn crest
      [0.38,0.5,0.62].forEach(fx=>{ ctx.beginPath(); ctx.moveTo(px + s*fx, py + s*0.14); ctx.lineTo(px + s*(fx+0.02), py + s*0.0); ctx.lineTo(px + s*(fx+0.08), py + s*0.14); ctx.closePath(); ctx.fill(); });
      ctx.fillStyle = `rgba(255,180,50,${0.5+flap*0.45})`; ctx.beginPath(); ctx.arc(cx, py + s*0.40, s*0.08, 0, Math.PI*2); ctx.fill();   // throat glow
      ctx.fillStyle = '#ffd23a'; ctx.fillRect(px + s*0.46, py + s*0.24, s*0.07, s*0.05);
      ctx.fillStyle = '#000'; ctx.fillRect(px + s*0.49, py + s*0.25, s*0.025, s*0.035);
      ctx.strokeStyle = '#bb2a16'; ctx.lineWidth = Math.max(2, s*0.07);
      ctx.beginPath(); ctx.moveTo(cx, py + s*0.82); ctx.lineTo(cx + Math.sin(Date.now()/170+phase)*s*0.22, py + s); ctx.stroke();   // tail
      break;
    }

    case 'magma_tyrant': {
      // A colossal molten titan — a hulking body of fissured black obsidian coursing
      // with lava, a crown of jagged basalt, and a white-hot maw. Boss: an orange
      // heat aura; cracks and eyes pulse.
      if (e.boss) {
        const auraR = s*0.62 + Math.sin(Date.now()/220)*s*0.04;
        const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, auraR);
        aura.addColorStop(0, 'rgba(255,110,30,0.42)'); aura.addColorStop(1, 'rgba(255,60,10,0)');
        ctx.fillStyle = aura; ctx.fillRect(cx-auraR, cy-auraR, auraR*2, auraR*2);
      }
      ctx.fillStyle = '#241410'; ctx.fillRect(px + s*0.30, py + s*0.68, s*0.16, s*0.24); ctx.fillRect(px + s*0.54, py + s*0.68, s*0.16, s*0.24);   // legs
      ctx.fillStyle = '#2a1a14';                                                          // torso
      ctx.beginPath();
      ctx.moveTo(px + s*0.22, py + s*0.72); ctx.lineTo(px + s*0.28, py + s*0.30); ctx.lineTo(px + s*0.50, py + s*0.20);
      ctx.lineTo(px + s*0.72, py + s*0.30); ctx.lineTo(px + s*0.78, py + s*0.72); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#3a241a'; ctx.beginPath(); ctx.moveTo(px + s*0.28, py + s*0.30); ctx.lineTo(px + s*0.50, py + s*0.20); ctx.lineTo(px + s*0.48, py + s*0.60); ctx.lineTo(px + s*0.30, py + s*0.62); ctx.closePath(); ctx.fill();
      const glow = 0.6 + flap*0.4;                                                        // molten cracks
      ctx.strokeStyle = `rgba(255,120,30,${glow})`; ctx.lineWidth = Math.max(2, s*0.05); ctx.lineCap='round';
      ctx.beginPath();
      ctx.moveTo(px + s*0.36, py + s*0.28); ctx.lineTo(px + s*0.44, py + s*0.48); ctx.lineTo(px + s*0.36, py + s*0.70);
      ctx.moveTo(px + s*0.62, py + s*0.30); ctx.lineTo(px + s*0.56, py + s*0.52); ctx.lineTo(px + s*0.64, py + s*0.70);
      ctx.moveTo(px + s*0.30, py + s*0.70); ctx.lineTo(px + s*0.70, py + s*0.70);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,225,120,${glow})`; ctx.lineWidth = Math.max(1, s*0.02); ctx.stroke(); ctx.lineCap='butt';
      ctx.fillStyle = '#241410'; ctx.beginPath(); ctx.arc(cx, py + s*0.22, s*0.15, 0, Math.PI*2); ctx.fill();   // head
      ctx.fillStyle = '#1a0e0a';                                                          // basalt crown
      [0.36,0.5,0.64].forEach(fx=>{ ctx.beginPath(); ctx.moveTo(px + s*fx, py + s*0.12); ctx.lineTo(px + s*(fx+0.02), py - s*0.02); ctx.lineTo(px + s*(fx+0.08), py + s*0.12); ctx.closePath(); ctx.fill(); });
      ctx.fillStyle = `rgba(255,235,150,${0.85+flap*0.15})`;                              // white-hot eyes
      ctx.fillRect(cx - s*0.09, py + s*0.20, s*0.06, s*0.05); ctx.fillRect(cx + s*0.03, py + s*0.20, s*0.06, s*0.05);
      ctx.fillStyle = `rgba(255,120,30,${glow})`; ctx.fillRect(cx - s*0.06, py + s*0.30, s*0.12, s*0.03);   // maw
      break;
    }
  }
}

registerEnemyArt(drawVolcanicCreature, [
  'magmin', 'fire_snake', 'azer', 'red_wyrmling', 'fire_elemental', 'young_red_dragon',
  'magma_tyrant',
]);
