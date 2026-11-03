// Mana and arcane creatures and their boss. Reached through ENEMY_ART (render-enemies.js),
// which also draws what every creature shares: shadow, auras, HP bar and name tag.

function drawManaCreature(e, ts, s, px, py, cx, cy, flap, phase, fb, bob, boxTop) {
  switch (e.type) {
    case 'beholder': {
      const facing = creatureFacing(e);
      if (facing === 'up') {
        // Back: the same sphere and stalk spread from behind - shading the other way, no central eye, no maw.
        ctx.fillStyle = '#1a2a14';
        ctx.beginPath(); ctx.arc(cx, cy, s*0.44, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#3a5a28';
        ctx.beginPath(); ctx.arc(cx, cy, s*0.40, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#557a32';
        ctx.beginPath(); ctx.arc(cx + s*0.06, cy - s*0.06, s*0.32, 0, Math.PI*2); ctx.fill();
        // Eye stalks, still all round the shell
        const stalkPhaseB = Date.now() / 180 + phase;
        for (let iB = 0; iB < 6; iB++) {
          const aB = iB * Math.PI / 3 - Math.PI / 6 + Math.sin(stalkPhaseB + iB) * 0.1;
          const tipB = { x: cx + Math.cos(aB) * s*0.55, y: cy + Math.sin(aB) * s*0.55 };
          ctx.strokeStyle = '#557a32'; ctx.lineWidth = Math.max(2, s*0.05);
          ctx.beginPath(); ctx.moveTo(cx + Math.cos(aB) * s*0.40, cy + Math.sin(aB) * s*0.40); ctx.lineTo(tipB.x, tipB.y); ctx.stroke();
          ctx.fillStyle = '#88cc44';
          ctx.beginPath(); ctx.arc(tipB.x, tipB.y, s*0.06, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = '#000';
          ctx.beginPath(); ctx.arc(tipB.x, tipB.y, s*0.03, 0, Math.PI*2); ctx.fill();
        }
        // The knuckled seam where the big eye would be
        ctx.strokeStyle = '#3a5a28'; ctx.lineWidth = Math.max(2, s*0.06);
        ctx.beginPath(); ctx.moveTo(cx, cy - s*0.30); ctx.lineTo(cx, cy + s*0.32); ctx.stroke();
        ctx.fillStyle = '#3a5a28';
        [0.18,0.30].forEach(fr => { ctx.beginPath(); ctx.arc(cx, cy + s*fr, s*0.05, 0, Math.PI*2); ctx.fill(); });
        break;
      }
      if (facing !== 'down') {
        // Side, facing right: the shell in profile, the stalks fanned over back and front, one big eye forward.
        ctx.save();
        mirrorIfLeft(facing, cx);
        ctx.fillStyle = '#1a2a14';
        ctx.beginPath(); ctx.arc(cx, cy, s*0.42, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#3a5a28';
        ctx.beginPath(); ctx.arc(cx, cy, s*0.38, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#557a32';
        ctx.beginPath(); ctx.arc(cx - s*0.10, cy - s*0.04, s*0.28, 0, Math.PI*2); ctx.fill();
        const stalkPhaseS = Date.now() / 180 + phase;
        for (let iS = 0; iS < 5; iS++) {
          const aS = Math.PI*(-0.95 + iS*0.30) + Math.sin(stalkPhaseS + iS) * 0.1;
          const tipS = { x: cx + Math.cos(aS) * s*0.53, y: cy + Math.sin(aS) * s*0.53 };
          ctx.strokeStyle = '#557a32'; ctx.lineWidth = Math.max(2, s*0.05);
          ctx.beginPath(); ctx.moveTo(cx + Math.cos(aS) * s*0.38, cy + Math.sin(aS) * s*0.38); ctx.lineTo(tipS.x, tipS.y); ctx.stroke();
          ctx.fillStyle = '#88cc44';
          ctx.beginPath(); ctx.arc(tipS.x, tipS.y, s*0.06, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = '#000';
          ctx.beginPath(); ctx.arc(tipS.x, tipS.y, s*0.03, 0, Math.PI*2); ctx.fill();
        }
        // Central eye in profile, set on the forward side
        ctx.fillStyle = `rgba(255,210,60,${0.7 + flap * 0.3})`;
        ctx.beginPath(); ctx.ellipse(px + s*0.62, cy, s*0.11, s*0.16, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#ffe080';
        ctx.beginPath(); ctx.ellipse(px + s*0.63, cy, s*0.075, s*0.11, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.ellipse(px + s*0.65, cy, s*0.03, s*0.07, 0, 0, Math.PI*2); ctx.fill();
        // Tooth-fanged maw under the eye
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.ellipse(px + s*0.56, cy + s*0.28, s*0.12, s*0.05, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fff';
        for (let iT = 0; iT < 4; iT++) ctx.fillRect(px + s*0.48 + iT * s*0.06, cy + s*0.26, s*0.03, s*0.04);
        ctx.restore();
        break;
      }
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
      const facing = creatureFacing(e);
      if (facing === 'up') {
        // Back: the same hunch from behind, spine ridge and knuckles, no eye and no grin.
        ctx.fillStyle = '#5a4a6a';
        ctx.beginPath(); ctx.ellipse(cx, py + s*0.66, s*0.28, s*0.26, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#6e5a82';
        ctx.beginPath(); ctx.ellipse(cx, py + s*0.52, s*0.19, s*0.15, 0, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#4a3a5a'; ctx.lineWidth = Math.max(2, s*0.04); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(cx, py + s*0.42); ctx.lineTo(cx, py + s*0.88); ctx.stroke();
        ctx.fillStyle = '#4a3a5a';
        [0.52,0.64,0.76].forEach(fy => { ctx.beginPath(); ctx.arc(cx, py + s*fy, s*0.035, 0, Math.PI*2); ctx.fill(); });
        // arms held in close to the body, claws showing
        ctx.strokeStyle = '#4a3a5a'; ctx.lineWidth = Math.max(2, s*0.05);
        ctx.beginPath(); ctx.moveTo(px + s*0.34, py + s*0.54); ctx.lineTo(px + s*0.22, py + s*0.74); ctx.moveTo(px + s*0.66, py + s*0.54); ctx.lineTo(px + s*0.78, py + s*0.74); ctx.stroke();
        ctx.strokeStyle = '#c8b8d0'; ctx.lineWidth = Math.max(1.5, s*0.03);
        [[0.20,0.74],[0.24,0.78],[0.76,0.74],[0.80,0.78]].forEach(([fx,fy]) => { ctx.beginPath(); ctx.moveTo(px + s*fx, py + s*(fy-0.06)); ctx.lineTo(px + s*fx, py + s*fy); ctx.stroke(); });
        // back of the head: a crest and a seam, no eye
        ctx.fillStyle = '#6e5a82';
        ctx.beginPath(); ctx.arc(cx, py + s*0.34, s*0.17, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#5a4a6a';
        ctx.beginPath(); ctx.moveTo(cx, py + s*0.16); ctx.lineTo(cx + s*0.05, py + s*0.30); ctx.lineTo(cx - s*0.05, py + s*0.30); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#4a3a5a'; ctx.lineWidth = Math.max(2, s*0.03);
        ctx.beginPath(); ctx.moveTo(cx, py + s*0.30); ctx.lineTo(cx, py + s*0.50); ctx.stroke();
        break;
      }
      if (facing !== 'down') {
        // Side, facing right: a narrower hunch, one eye set forward, both arms reaching ahead.
        ctx.save();
        mirrorIfLeft(facing, cx);
        ctx.fillStyle = '#5a4a6a';
        ctx.beginPath(); ctx.ellipse(px + s*0.48, py + s*0.64, s*0.17, s*0.24, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#6e5a82';
        ctx.beginPath(); ctx.ellipse(px + s*0.44, py + s*0.56, s*0.11, s*0.14, 0, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#4a3a5a'; ctx.lineWidth = Math.max(2, s*0.05); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(px + s*0.56, py + s*0.54); ctx.lineTo(px + s*0.80, py + s*0.72); ctx.stroke();
        ctx.strokeStyle = '#c8b8d0'; ctx.lineWidth = Math.max(1.5, s*0.03);
        [[0.80,0.78],[0.84,0.74],[0.86,0.80]].forEach(([fx,fy]) => { ctx.beginPath(); ctx.moveTo(px + s*fx, py + s*(fy-0.06)); ctx.lineTo(px + s*fx, py + s*fy); ctx.stroke(); });
        // head in profile: one huge eye forward, brow ridge over it
        ctx.fillStyle = '#6e5a82';
        ctx.beginPath(); ctx.arc(px + s*0.56, py + s*0.34, s*0.16, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = `rgba(180,120,220,${0.5+flap*0.3})`;
        ctx.beginPath(); ctx.arc(px + s*0.62, py + s*0.34, s*0.11, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#e0c0ff';
        ctx.beginPath(); ctx.arc(px + s*0.63, py + s*0.34, s*0.075, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#2a0a3a';
        ctx.beginPath(); ctx.arc(px + s*0.64, py + s*0.34, s*0.035, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#4a3a5a'; ctx.lineWidth = Math.max(2, s*0.03);
        ctx.beginPath(); ctx.moveTo(px + s*0.50, py + s*0.24); ctx.lineTo(px + s*0.70, py + s*0.28); ctx.stroke();
        ctx.fillStyle = '#1a0a1a'; ctx.fillRect(px + s*0.64, py + s*0.44, s*0.08, s*0.03);
        ctx.restore();
        break;
      }
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
      const facing = creatureFacing(e);
      if (facing === 'up') {
        // Back: the empty armour from behind - cloak, shield and sword on the other hands, no visor.
        // Sword (now left)
        ctx.fillStyle = '#c8cee0'; ctx.fillRect(px + s*0.15, py + s*0.16, s*0.05, s*0.56);
        ctx.fillStyle = '#8a7038'; ctx.fillRect(px + s*0.09, py + s*0.70, s*0.16, s*0.05);
        // Shield (now right)
        ctx.fillStyle = '#4a5066';
        ctx.beginPath(); ctx.moveTo(px + s*0.74, py + s*0.40); ctx.lineTo(px + s*0.94, py + s*0.40); ctx.lineTo(px + s*0.94, py + s*0.66); ctx.lineTo(px + s*0.84, py + s*0.78); ctx.lineTo(px + s*0.74, py + s*0.66); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#6a7088'; ctx.fillRect(px + s*0.81, py + s*0.46, s*0.06, s*0.20);
        // Back plate, shaded away from the light
        ctx.fillStyle = '#586078'; ctx.fillRect(px + s*0.32, py + s*0.40, s*0.36, s*0.40);
        ctx.fillStyle = '#4a5066'; ctx.fillRect(px + s*0.50, py + s*0.40, s*0.18, s*0.40);
        // Cloak hung from the pauldrons
        ctx.fillStyle = '#3a4054';
        ctx.beginPath(); ctx.moveTo(px + s*0.34, py + s*0.42); ctx.lineTo(px + s*0.66, py + s*0.42); ctx.lineTo(px + s*0.72, py + s*0.86); ctx.lineTo(px + s*0.28, py + s*0.86); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#6a7088'; ctx.lineWidth = Math.max(1.5, s*0.02);
        ctx.beginPath(); ctx.moveTo(cx, py + s*0.44); ctx.lineTo(cx, py + s*0.84); ctx.stroke();
        // Back of the great helm: a crest band, no visor glow
        ctx.fillStyle = '#6a7290';
        ctx.beginPath(); ctx.arc(cx, py + s*0.26, s*0.16, Math.PI, 0); ctx.fill();
        ctx.fillRect(px + s*0.34, py + s*0.26, s*0.32, s*0.14);
        ctx.fillStyle = '#4a5066'; ctx.fillRect(px + s*0.46, py + s*0.12, s*0.08, s*0.28);
        ctx.strokeStyle = '#3a4054'; ctx.lineWidth = 1.5;
        [0.30,0.36].forEach(fy => { ctx.beginPath(); ctx.moveTo(px + s*0.36, py + s*fy); ctx.lineTo(px + s*0.64, py + s*fy); ctx.stroke(); });
        break;
      }
      if (facing !== 'down') {
        // Side, facing right: a narrow breastplate, the helm's face plate forward, shield and sword ahead.
        ctx.save();
        mirrorIfLeft(facing, cx);
        ctx.fillStyle = '#586078'; ctx.fillRect(px + s*0.36, py + s*0.40, s*0.26, s*0.40);
        ctx.fillStyle = '#6a7290'; ctx.fillRect(px + s*0.36, py + s*0.40, s*0.10, s*0.40);
        ctx.strokeStyle = '#3a4054'; ctx.lineWidth = 1.5;
        [0.50,0.62,0.72].forEach(fy => { ctx.beginPath(); ctx.moveTo(px + s*0.36, py + s*fy); ctx.lineTo(px + s*0.62, py + s*fy); ctx.stroke(); });
        // Helm in profile, visor slit on the forward face
        ctx.fillStyle = '#6a7290';
        ctx.beginPath(); ctx.arc(px + s*0.50, py + s*0.26, s*0.16, Math.PI, 0); ctx.fill();
        ctx.fillRect(px + s*0.34, py + s*0.26, s*0.32, s*0.14);
        ctx.fillStyle = '#586078'; ctx.fillRect(px + s*0.58, py + s*0.20, s*0.10, s*0.20);
        ctx.fillStyle = `rgba(180,120,255,${0.6+flap*0.4})`;
        ctx.fillRect(px + s*0.60, py + s*0.28, s*0.07, s*0.04);
        // Shield carried forward, seen edge-on
        ctx.fillStyle = '#4a5066'; ctx.fillRect(px + s*0.66, py + s*0.42, s*0.10, s*0.34);
        ctx.fillStyle = '#6a7088'; ctx.fillRect(px + s*0.68, py + s*0.48, s*0.03, s*0.20);
        // Sword carried forward
        ctx.fillStyle = '#c8cee0'; ctx.fillRect(px + s*0.80, py + s*0.20, s*0.05, s*0.50);
        ctx.fillStyle = '#8a7038'; ctx.fillRect(px + s*0.74, py + s*0.68, s*0.16, s*0.05);
        ctx.restore();
        break;
      }
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
      const facing = creatureFacing(e);
      if (facing === 'up') {
        // Back: the same aura and robe from behind, the back of the head smooth with cranial ridges, no face.
        const mfaB = ctx.createRadialGradient(cx, py + s*0.30, 0, cx, py + s*0.30, s*0.4);
        mfaB.addColorStop(0, `rgba(160,90,220,${0.3+flap*0.25})`);
        mfaB.addColorStop(1, 'rgba(160,90,220,0)');
        ctx.fillStyle = mfaB; ctx.fillRect(fb.x - s*0.1, fb.y - s*0.1, s*1.2, s*1.2);
        // Robe seen from behind: broader shoulders, light on the other side
        ctx.fillStyle = '#3a2a52';
        ctx.beginPath(); ctx.moveTo(px + s*0.28, py + s*0.42); ctx.lineTo(px + s*0.72, py + s*0.42); ctx.lineTo(px + s*0.80, py + s*0.90); ctx.lineTo(px + s*0.20, py + s*0.90); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#4a3668'; ctx.fillRect(px + s*0.50, py + s*0.42, s*0.22, s*0.48);
        ctx.strokeStyle = '#3a2a52'; ctx.lineWidth = Math.max(2, s*0.03);
        ctx.beginPath(); ctx.moveTo(cx, py + s*0.44); ctx.lineTo(cx, py + s*0.88); ctx.stroke();
        // Back of the head: a seam down the middle and a furrow each side, no eyes, no tentacles
        ctx.fillStyle = '#7a55a0';
        ctx.beginPath(); ctx.arc(cx, py + s*0.30, s*0.18, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#9070b8'; ctx.lineWidth = Math.max(2, s*0.03);
        ctx.beginPath();
        ctx.moveTo(cx - s*0.10, py + s*0.18); ctx.quadraticCurveTo(cx - s*0.14, py + s*0.32, cx - s*0.06, py + s*0.44);
        ctx.moveTo(cx + s*0.10, py + s*0.18); ctx.quadraticCurveTo(cx + s*0.14, py + s*0.32, cx + s*0.06, py + s*0.44);
        ctx.stroke();
        ctx.strokeStyle = '#3a2a52';
        ctx.beginPath(); ctx.moveTo(cx, py + s*0.12); ctx.lineTo(cx, py + s*0.47); ctx.stroke();
        break;
      }
      if (facing !== 'down') {
        // Side, facing right: a narrow robe, the head in profile with one eye, tentacles trailing below it.
        ctx.save();
        mirrorIfLeft(facing, cx);
        const mfaS = ctx.createRadialGradient(cx, py + s*0.30, 0, cx, py + s*0.30, s*0.4);
        mfaS.addColorStop(0, `rgba(160,90,220,${0.3+flap*0.25})`);
        mfaS.addColorStop(1, 'rgba(160,90,220,0)');
        ctx.fillStyle = mfaS; ctx.fillRect(fb.x - s*0.1, fb.y - s*0.1, s*1.2, s*1.2);
        ctx.fillStyle = '#3a2a52';
        ctx.beginPath(); ctx.moveTo(px + s*0.36, py + s*0.42); ctx.lineTo(px + s*0.64, py + s*0.42); ctx.lineTo(px + s*0.70, py + s*0.90); ctx.lineTo(px + s*0.30, py + s*0.90); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#4a3668'; ctx.fillRect(px + s*0.36, py + s*0.42, s*0.14, s*0.48);
        // Bulbous head in profile, crown patch up back, one eye forward
        ctx.fillStyle = '#7a55a0';
        ctx.beginPath(); ctx.arc(px + s*0.54, py + s*0.30, s*0.17, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#9070b8';
        ctx.beginPath(); ctx.ellipse(px + s*0.48, py + s*0.22, s*0.10, s*0.07, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#e8e0f0'; ctx.fillRect(px + s*0.62, py + s*0.30, s*0.06, s*0.03);
        // Four face tentacles, trailing below the head and reaching forward
        ctx.strokeStyle = '#7a55a0'; ctx.lineWidth = Math.max(2, s*0.05); ctx.lineCap = 'round';
        for (let i=0;i<4;i++){ const tx = px + s*(0.54 + i*0.05); const wob = Math.sin(Date.now()/160 + i + phase)*s*0.05; ctx.beginPath(); ctx.moveTo(tx, py + s*0.42); ctx.quadraticCurveTo(tx + s*0.05 + wob, py + s*0.50, tx + s*0.09 + wob*1.4, py + s*0.56); ctx.stroke(); }
        ctx.restore();
        break;
      }
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
      const facing = creatureFacing(e);
      if (facing === 'up') {
        // Back: the red armour and cloak from behind, greatsword in the other hand, no eyes.
        // Silver greatsword (now left)
        ctx.fillStyle = '#d8dce8'; ctx.fillRect(px + s*0.15, py + s*0.10, s*0.05, s*0.66);
        ctx.fillStyle = '#e0b040'; ctx.fillRect(px + s*0.10, py + s*0.72, s*0.15, s*0.05);
        // Armor body, light on the other side
        ctx.fillStyle = '#7a2a2a'; ctx.fillRect(px + s*0.30, py + s*0.40, s*0.40, s*0.46);
        ctx.fillStyle = '#9a3a3a'; ctx.fillRect(px + s*0.50, py + s*0.40, s*0.20, s*0.46);
        ctx.fillStyle = '#e0b040'; ctx.fillRect(px + s*0.30, py + s*0.56, s*0.40, s*0.04);
        // Cloak hung at the pauldrons
        ctx.fillStyle = '#7a2a2a';
        ctx.beginPath(); ctx.moveTo(px + s*0.34, py + s*0.42); ctx.lineTo(px + s*0.66, py + s*0.42); ctx.lineTo(px + s*0.74, py + s*0.90); ctx.lineTo(px + s*0.26, py + s*0.90); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#9a3a3a'; ctx.lineWidth = Math.max(2, s*0.03);
        ctx.beginPath(); ctx.moveTo(cx, py + s*0.44); ctx.lineTo(cx, py + s*0.88); ctx.stroke();
        // Spiky pauldrons
        ctx.fillStyle = '#caa030';
        ctx.beginPath(); ctx.moveTo(px + s*0.28, py + s*0.42); ctx.lineTo(px + s*0.22, py + s*0.30); ctx.lineTo(px + s*0.38, py + s*0.40); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(px + s*0.72, py + s*0.42); ctx.lineTo(px + s*0.78, py + s*0.30); ctx.lineTo(px + s*0.62, py + s*0.40); ctx.closePath(); ctx.fill();
        // Back of the head, pointed ears still out, a shaved crest, no eyes
        ctx.fillStyle = '#bcc24a';
        ctx.beginPath(); ctx.arc(cx, py + s*0.28, s*0.15, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#a4aa3a';
        ctx.beginPath(); ctx.moveTo(px + s*0.38, py + s*0.26); ctx.lineTo(px + s*0.28, py + s*0.16); ctx.lineTo(px + s*0.42, py + s*0.30); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(px + s*0.62, py + s*0.26); ctx.lineTo(px + s*0.72, py + s*0.16); ctx.lineTo(px + s*0.58, py + s*0.30); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#a4aa3a'; ctx.lineWidth = Math.max(2, s*0.03);
        ctx.beginPath(); ctx.moveTo(cx, py + s*0.14); ctx.lineTo(cx, py + s*0.41); ctx.stroke();
        break;
      }
      if (facing !== 'down') {
        // Side, facing right: a narrow torso, one ear and one eye, greatsword carried forward.
        ctx.save();
        mirrorIfLeft(facing, cx);
        ctx.fillStyle = '#7a2a2a'; ctx.fillRect(px + s*0.38, py + s*0.40, s*0.26, s*0.46);
        ctx.fillStyle = '#9a3a3a'; ctx.fillRect(px + s*0.38, py + s*0.40, s*0.12, s*0.46);
        ctx.fillStyle = '#e0b040'; ctx.fillRect(px + s*0.38, py + s*0.56, s*0.26, s*0.04);
        ctx.fillStyle = '#caa030';
        ctx.beginPath(); ctx.moveTo(px + s*0.36, py + s*0.42); ctx.lineTo(px + s*0.32, py + s*0.28); ctx.lineTo(px + s*0.54, py + s*0.40); ctx.closePath(); ctx.fill();
        // Head in profile: nose ridge forward, one pointed ear back, one eye
        ctx.fillStyle = '#bcc24a';
        ctx.beginPath(); ctx.arc(px + s*0.54, py + s*0.28, s*0.14, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(px + s*0.64, py + s*0.22); ctx.lineTo(px + s*0.72, py + s*0.30); ctx.lineTo(px + s*0.64, py + s*0.34); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#a4aa3a';
        ctx.beginPath(); ctx.moveTo(px + s*0.44, py + s*0.26); ctx.lineTo(px + s*0.34, py + s*0.16); ctx.lineTo(px + s*0.48, py + s*0.30); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#1a1a06'; ctx.fillRect(px + s*0.58, py + s*0.26, s*0.04, s*0.04);
        // Silver greatsword carried forward
        ctx.fillStyle = '#d8dce8'; ctx.fillRect(px + s*0.80, py + s*0.14, s*0.05, s*0.60);
        ctx.fillStyle = '#e0b040'; ctx.fillRect(px + s*0.75, py + s*0.70, s*0.15, s*0.05);
        ctx.restore();
        break;
      }
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
      const facing = creatureFacing(e);
      if (facing === 'up') {
        // Back: the robe from behind, sash off the middle, tiger skull with ears and stripes, no face.
        ctx.fillStyle = '#7a2030';
        ctx.beginPath(); ctx.moveTo(px + s*0.28, py + s*0.42); ctx.lineTo(px + s*0.72, py + s*0.42); ctx.lineTo(px + s*0.80, py + s*0.90); ctx.lineTo(px + s*0.20, py + s*0.90); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#9a2a3a'; ctx.fillRect(px + s*0.30, py + s*0.42, s*0.40, s*0.48);
        ctx.fillStyle = '#e0b848'; ctx.fillRect(px + s*0.56, py + s*0.42, s*0.06, s*0.48);
        // Back of the tiger head, ears out
        ctx.fillStyle = '#d88a3a';
        ctx.beginPath(); ctx.arc(cx, py + s*0.28, s*0.18, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(px + s*0.36, py + s*0.16, s*0.06, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(px + s*0.64, py + s*0.16, s*0.06, 0, Math.PI*2); ctx.fill();
        // Stripes down the skull and over the shoulders
        ctx.strokeStyle = '#3a1a0a'; ctx.lineWidth = Math.max(1.5, s*0.03);
        ctx.beginPath();
        ctx.moveTo(cx - s*0.10, py + s*0.16); ctx.lineTo(cx - s*0.07, py + s*0.38);
        ctx.moveTo(cx + s*0.10, py + s*0.16); ctx.lineTo(cx + s*0.07, py + s*0.38);
        ctx.moveTo(cx, py + s*0.12); ctx.lineTo(cx, py + s*0.44);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(px + s*0.32, py + s*0.50); ctx.lineTo(px + s*0.44, py + s*0.56);
        ctx.moveTo(px + s*0.68, py + s*0.50); ctx.lineTo(px + s*0.56, py + s*0.56);
        ctx.moveTo(px + s*0.32, py + s*0.68); ctx.lineTo(px + s*0.44, py + s*0.74);
        ctx.moveTo(px + s*0.68, py + s*0.68); ctx.lineTo(px + s*0.56, py + s*0.74);
        ctx.stroke();
        break;
      }
      if (facing !== 'down') {
        // Side, facing right: a narrow robe, one ear and one eye, the muzzle out in front.
        ctx.save();
        mirrorIfLeft(facing, cx);
        ctx.fillStyle = '#7a2030';
        ctx.beginPath(); ctx.moveTo(px + s*0.36, py + s*0.42); ctx.lineTo(px + s*0.64, py + s*0.42); ctx.lineTo(px + s*0.70, py + s*0.90); ctx.lineTo(px + s*0.30, py + s*0.90); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#9a2a3a'; ctx.fillRect(px + s*0.36, py + s*0.42, s*0.12, s*0.48);
        ctx.fillStyle = '#e0b848'; ctx.fillRect(px + s*0.48, py + s*0.42, s*0.05, s*0.48);
        // Tiger head in profile: one ear back, muzzle and fang forward
        ctx.fillStyle = '#d88a3a';
        ctx.beginPath(); ctx.arc(px + s*0.54, py + s*0.28, s*0.17, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(px + s*0.44, py + s*0.14, s*0.06, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#f0e0d0';
        ctx.beginPath(); ctx.ellipse(px + s*0.68, py + s*0.34, s*0.09, s*0.06, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#1a0a0a'; ctx.fillRect(px + s*0.71, py + s*0.31, s*0.05, s*0.02);
        ctx.fillStyle = '#fff'; ctx.fillRect(px + s*0.70, py + s*0.33, s*0.02, s*0.04);
        ctx.fillStyle = `rgba(255,210,60,${0.7+flap*0.3})`;
        ctx.fillRect(px + s*0.60, py + s*0.25, s*0.05, s*0.04);
        ctx.strokeStyle = '#3a1a0a'; ctx.lineWidth = Math.max(1.5, s*0.03);
        ctx.beginPath();
        ctx.moveTo(px + s*0.44, py + s*0.16); ctx.lineTo(px + s*0.48, py + s*0.24);
        ctx.moveTo(px + s*0.54, py + s*0.14); ctx.lineTo(px + s*0.56, py + s*0.22);
        ctx.stroke();
        ctx.restore();
        break;
      }
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
      const facing = creatureFacing(e);
      if (facing === 'up') {
        // Back: the rift and runes still there, the hood seen from behind with a seam, no face, orb in the other hand.
        if (e.boss) {
          const auraRB = s*0.62 + Math.sin(Date.now()/220)*s*0.04;
          const auraB = ctx.createRadialGradient(cx, cy, 0, cx, cy, auraRB);
          auraB.addColorStop(0, 'rgba(170,100,240,0.42)'); auraB.addColorStop(1, 'rgba(170,100,240,0)');
          ctx.fillStyle = auraB; ctx.fillRect(cx-auraRB, cy-auraRB, auraRB*2, auraRB*2);
        }
        // Void rift behind
        ctx.fillStyle = '#0a0418';
        ctx.beginPath(); ctx.arc(cx, py + s*0.42, s*0.40, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = `rgba(180,110,255,${0.4+flap*0.4})`; ctx.lineWidth = Math.max(1.5, s*0.03);
        for (let iB=0;iB<3;iB++){ ctx.beginPath(); ctx.arc(cx, py + s*0.42, s*(0.40 - iB*0.06), Date.now()/800 + iB, Date.now()/800 + iB + 2.2); ctx.stroke(); }
        // Floating runes
        ctx.fillStyle = '#c8a0ff';
        for (let iB=0;iB<5;iB++){ const aB = Date.now()/600 + iB*1.26; ctx.fillRect(cx + Math.cos(aB)*s*0.34 - s*0.012, py + s*0.42 + Math.sin(aB)*s*0.30 - s*0.012, s*0.025, s*0.025); }
        // Robe from behind: broader shoulders, light on the far side, a fold down the middle
        ctx.fillStyle = '#3a1f5a';
        ctx.beginPath(); ctx.moveTo(px + s*0.30, py + s*0.42); ctx.lineTo(px + s*0.70, py + s*0.42); ctx.lineTo(px + s*0.80, py + s*0.92); ctx.lineTo(px + s*0.20, py + s*0.92); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#4e2c78';
        ctx.beginPath(); ctx.moveTo(px + s*0.50, py + s*0.42); ctx.lineTo(px + s*0.70, py + s*0.42); ctx.lineTo(px + s*0.80, py + s*0.92); ctx.lineTo(px + s*0.50, py + s*0.92); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#3a1f5a'; ctx.lineWidth = Math.max(2, s*0.03);
        ctx.beginPath(); ctx.moveTo(cx, py + s*0.44); ctx.lineTo(cx, py + s*0.90); ctx.stroke();
        // Back of the hood: the same peak with a seam, and the rim lying over the shoulders
        ctx.fillStyle = '#2a1444';
        ctx.beginPath(); ctx.moveTo(px + s*0.34, py + s*0.40); ctx.lineTo(cx, py + s*0.10); ctx.lineTo(px + s*0.66, py + s*0.40); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(px + s*0.36, py + s*0.40); ctx.lineTo(px + s*0.64, py + s*0.40); ctx.lineTo(px + s*0.58, py + s*0.58); ctx.lineTo(px + s*0.42, py + s*0.58); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#4e2c78'; ctx.lineWidth = Math.max(2, s*0.03);
        ctx.beginPath(); ctx.moveTo(cx, py + s*0.12); ctx.lineTo(cx, py + s*0.56); ctx.stroke();
        // Arcane orb in the other hand
        ctx.fillStyle = `rgba(190,120,255,${0.6+flap*0.4})`;
        ctx.beginPath(); ctx.arc(px + s*0.18, py + s*0.56, s*0.08, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#f0e0ff';
        ctx.beginPath(); ctx.arc(px + s*0.20, py + s*0.54, s*0.03, 0, Math.PI*2); ctx.fill();
        break;
      }
      if (facing !== 'down') {
        // Side, facing right: a narrow robe, the hood's opening forward with one eye, orb held ahead.
        ctx.save();
        mirrorIfLeft(facing, cx);
        if (e.boss) {
          const auraRS = s*0.62 + Math.sin(Date.now()/220)*s*0.04;
          const auraS = ctx.createRadialGradient(cx, cy, 0, cx, cy, auraRS);
          auraS.addColorStop(0, 'rgba(170,100,240,0.42)'); auraS.addColorStop(1, 'rgba(170,100,240,0)');
          ctx.fillStyle = auraS; ctx.fillRect(cx-auraRS, cy-auraRS, auraRS*2, auraRS*2);
        }
        // Void rift behind
        ctx.fillStyle = '#0a0418';
        ctx.beginPath(); ctx.arc(cx, py + s*0.42, s*0.38, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = `rgba(180,110,255,${0.4+flap*0.4})`; ctx.lineWidth = Math.max(1.5, s*0.03);
        for (let iS=0;iS<3;iS++){ ctx.beginPath(); ctx.arc(cx, py + s*0.42, s*(0.38 - iS*0.06), Date.now()/800 + iS, Date.now()/800 + iS + 2.2); ctx.stroke(); }
        ctx.fillStyle = '#c8a0ff';
        for (let iS=0;iS<4;iS++){ const aS = Date.now()/600 + iS*1.57; ctx.fillRect(cx + Math.cos(aS)*s*0.32 - s*0.012, py + s*0.42 + Math.sin(aS)*s*0.28 - s*0.012, s*0.025, s*0.025); }
        // Robe in profile
        ctx.fillStyle = '#3a1f5a';
        ctx.beginPath(); ctx.moveTo(px + s*0.36, py + s*0.42); ctx.lineTo(px + s*0.64, py + s*0.42); ctx.lineTo(px + s*0.72, py + s*0.92); ctx.lineTo(px + s*0.28, py + s*0.92); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#4e2c78';
        ctx.beginPath(); ctx.moveTo(px + s*0.36, py + s*0.42); ctx.lineTo(px + s*0.50, py + s*0.42); ctx.lineTo(px + s*0.50, py + s*0.92); ctx.lineTo(px + s*0.28, py + s*0.92); ctx.closePath(); ctx.fill();
        // Hood in profile: peak tipped back, opening and one eye forward
        ctx.fillStyle = '#2a1444';
        ctx.beginPath(); ctx.moveTo(px + s*0.32, py + s*0.44); ctx.lineTo(px + s*0.48, py + s*0.10); ctx.lineTo(px + s*0.70, py + s*0.32); ctx.lineTo(px + s*0.62, py + s*0.44); ctx.closePath(); ctx.fill();
        ctx.fillStyle = `rgba(200,140,255,${0.7+flap*0.3})`;
        ctx.fillRect(px + s*0.58, py + s*0.32, s*0.05, s*0.04);
        // Arcane orb held ahead
        ctx.fillStyle = `rgba(190,120,255,${0.6+flap*0.4})`;
        ctx.beginPath(); ctx.arc(px + s*0.80, py + s*0.56, s*0.08, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#f0e0ff';
        ctx.beginPath(); ctx.arc(px + s*0.78, py + s*0.54, s*0.03, 0, Math.PI*2); ctx.fill();
        ctx.restore();
        break;
      }
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
