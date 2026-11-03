// Shadow creatures and their boss. Reached through ENEMY_ART (render-enemies.js),
// which also draws what every creature shares: shadow, auras, HP bar and name tag.

function drawShadowCreature(e, ts, s, px, py, cx, cy, flap, phase, fb, bob, boxTop) {
  switch (e.type) {

    // ─── Shadow region ─────────────────────────────────────────────────
    case 'shade': {
      const facing = creatureFacing(e);
      if (facing === 'up') {
        // Back: the same smoke and the same wavering hem, a pointed hood and a seam,
        // and no eyes at all.
        const auraB = ctx.createRadialGradient(cx, cy, 0, cx, cy, s*0.55);
        auraB.addColorStop(0, `rgba(120,80,190,${0.4+flap*0.22})`); auraB.addColorStop(1, 'rgba(70,40,120,0)');
        ctx.fillStyle = auraB; ctx.fillRect(fb.x - s*0.1, fb.y - s*0.1, s*1.2, s*1.2);
        ctx.fillStyle = '#160f22';
        ctx.beginPath();
        ctx.moveTo(px + s*0.34, py + s*0.26); ctx.lineTo(px + s*0.66, py + s*0.26);
        ctx.lineTo(px + s*0.80, py + s*0.80);
        for (let iB=6;iB>=0;iB--){ const xB=px + s*0.20 + s*0.60*(iB/6); const yB=py + s*0.94 + Math.sin(Date.now()/220+phase+iB*0.7)*s*0.06; ctx.lineTo(xB, yB); }
        ctx.lineTo(px + s*0.20, py + s*0.80);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#221636';                                                        // wispy arms, hanging inboard
        ctx.beginPath(); ctx.moveTo(px + s*0.30, py + s*0.34); ctx.lineTo(px + s*0.16, py + s*0.58); ctx.lineTo(px + s*0.34, py + s*0.52); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(px + s*0.70, py + s*0.34); ctx.lineTo(px + s*0.84, py + s*0.58); ctx.lineTo(px + s*0.66, py + s*0.52); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#0c0814';                                                        // hood, seen from behind
        ctx.beginPath(); ctx.moveTo(px + s*0.24, py + s*0.44); ctx.lineTo(cx, py + s*0.02); ctx.lineTo(px + s*0.76, py + s*0.44); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#221636';
        ctx.beginPath(); ctx.ellipse(cx, py + s*0.42, s*0.24, s*0.08, 0, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#221636'; ctx.lineWidth = Math.max(1.5, s*0.03);               // seam down the smoke
        ctx.beginPath(); ctx.moveTo(cx, py + s*0.46); ctx.lineTo(cx, py + s*0.74); ctx.stroke();
        break;
      }
      if (facing !== 'down') {
        // Side, drawn facing right: a narrower column of smoke, the hood's peak thrown
        // back, one eye in the forward opening.
        ctx.save();
        mirrorIfLeft(facing, cx);
        const auraS = ctx.createRadialGradient(cx, cy, 0, cx, cy, s*0.55);
        auraS.addColorStop(0, `rgba(120,80,190,${0.4+flap*0.22})`); auraS.addColorStop(1, 'rgba(70,40,120,0)');
        ctx.fillStyle = auraS; ctx.fillRect(fb.x - s*0.1, fb.y - s*0.1, s*1.2, s*1.2);
        ctx.fillStyle = '#160f22';
        ctx.beginPath();
        ctx.moveTo(px + s*0.38, py + s*0.26); ctx.lineTo(px + s*0.64, py + s*0.26);
        for (let iS=5;iS>=0;iS--){ const xS=px + s*0.38 + s*0.26*(iS/5); const yS=py + s*0.94 + Math.sin(Date.now()/220+phase+iS*0.7)*s*0.06; ctx.lineTo(xS, yS); }
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#221636';                                                        // the near arm, reaching forward
        ctx.beginPath(); ctx.moveTo(px + s*0.62, py + s*0.34); ctx.lineTo(px + s*0.82, py + s*0.52); ctx.lineTo(px + s*0.60, py + s*0.50); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#0c0814';                                                        // head void in profile
        ctx.beginPath(); ctx.ellipse(px + s*0.56, py + s*0.24, s*0.14, s*0.18, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#160f22';                                                        // the hood, peak swept back
        ctx.beginPath(); ctx.moveTo(px + s*0.64, py + s*0.04); ctx.lineTo(px + s*0.20, py + s*0.32); ctx.lineTo(px + s*0.58, py + s*0.42); ctx.closePath(); ctx.fill();
        ctx.fillStyle = `rgba(170,120,240,${0.75+flap*0.25})`;                            // one eye, forward
        ctx.fillRect(px + s*0.62, py + s*0.22, s*0.06, s*0.05);
        ctx.restore();
        break;
      }
      // A drifting shadow — a smoky black humanoid with a wavering hem and two cold
      // violet eyes, wrapped in a dark aura. Insubstantial.
      const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, s*0.55);
      aura.addColorStop(0, `rgba(120,80,190,${0.4+flap*0.22})`); aura.addColorStop(1, 'rgba(70,40,120,0)');
      ctx.fillStyle = aura; ctx.fillRect(fb.x - s*0.1, fb.y - s*0.1, s*1.2, s*1.2);
      ctx.fillStyle = '#160f22';
      ctx.beginPath();
      ctx.moveTo(px + s*0.24, py + s*0.26); ctx.lineTo(px + s*0.76, py + s*0.26);
      for (let i=6;i>=0;i--){ const fx=px + s*0.24 + s*0.52*(i/6); const fy=py + s*0.94 + Math.sin(Date.now()/220+phase+i*0.7)*s*0.06; ctx.lineTo(fx, fy); }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#221636';                                                          // wispy arms
      ctx.beginPath(); ctx.moveTo(px + s*0.24, py + s*0.34); ctx.lineTo(px + s*0.10, py + s*0.56); ctx.lineTo(px + s*0.30, py + s*0.50); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px + s*0.76, py + s*0.34); ctx.lineTo(px + s*0.90, py + s*0.56); ctx.lineTo(px + s*0.70, py + s*0.50); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#0c0814';
      ctx.beginPath(); ctx.arc(cx, py + s*0.24, s*0.16, 0, Math.PI*2); ctx.fill();        // head void
      ctx.fillStyle = `rgba(170,120,240,${0.75+flap*0.25})`;
      ctx.fillRect(px + s*0.40, py + s*0.22, s*0.07, s*0.05); ctx.fillRect(px + s*0.53, py + s*0.22, s*0.07, s*0.05);   // eyes
      break;
    }
    case 'shadow_mastiff': {
      const facing = creatureFacing(e);
      if (facing === 'down' || facing === 'up') {
        // The gloom it wears, the same one the side view carries.
        const auraF = ctx.createRadialGradient(cx, py + s*0.55, 0, cx, py + s*0.55, s*0.5);
        auraF.addColorStop(0, `rgba(110,70,180,${0.3+flap*0.2})`); auraF.addColorStop(1, 'rgba(60,30,110,0)');
        ctx.fillStyle = auraF; ctx.fillRect(fb.x - s*0.1, fb.y - s*0.1, s*1.2, s*1.2);
        if (facing === 'up') {
          // Back: rump to the viewer, the head small beyond it, a smoky tail down the
          // middle of it. No eye, no maw.
          ctx.fillStyle = '#120c1c';
          ctx.beginPath(); ctx.ellipse(cx, py + s*0.62, s*0.30, s*0.22, 0, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = '#221636';
          ctx.beginPath(); ctx.ellipse(cx, py + s*0.56, s*0.22, s*0.10, 0, 0, Math.PI*2); ctx.fill();
          ctx.strokeStyle = '#221636'; ctx.lineWidth = Math.max(2, s*0.05);                // spine
          ctx.beginPath(); ctx.moveTo(cx, py + s*0.42); ctx.lineTo(cx, py + s*0.62); ctx.stroke();
          ctx.strokeStyle = '#120c1c'; ctx.lineWidth = Math.max(2, s*0.07);                // tail, down the middle
          ctx.beginPath(); ctx.moveTo(cx, py + s*0.70); ctx.lineTo(cx + Math.sin(Date.now()/200+phase)*s*0.06, py + s*0.88); ctx.stroke();
          ctx.fillStyle = '#120c1c';
          [0.24,0.38,0.56,0.70].forEach(xB => ctx.fillRect(px + s*xB, py + s*0.78, s*0.08, s*0.14));
          ctx.beginPath(); ctx.arc(cx, py + s*0.30, s*0.15, 0, Math.PI*2); ctx.fill();      // the head, further off
          ctx.fillStyle = '#221636';                                                       // ears out to the sides
          ctx.beginPath(); ctx.moveTo(px + s*0.34, py + s*0.26); ctx.lineTo(px + s*0.38, py + s*0.12); ctx.lineTo(px + s*0.46, py + s*0.28); ctx.closePath(); ctx.fill();
          ctx.beginPath(); ctx.moveTo(px + s*0.66, py + s*0.26); ctx.lineTo(px + s*0.62, py + s*0.12); ctx.lineTo(px + s*0.54, py + s*0.28); ctx.closePath(); ctx.fill();
          break;
        }
        // Head on: the broad chest, both ears, both cold eyes, the maw and its fangs.
        ctx.fillStyle = '#120c1c'; ctx.fillRect(px + s*0.22, py + s*0.46, s*0.56, s*0.34);
        ctx.fillStyle = '#221636'; ctx.fillRect(px + s*0.22, py + s*0.46, s*0.56, s*0.14);
        ctx.fillStyle = '#120c1c';
        [0.24,0.36,0.56,0.68].forEach(xF => ctx.fillRect(px + s*xF, py + s*0.78, s*0.08, s*0.14));
        ctx.beginPath(); ctx.arc(cx, py + s*0.40, s*0.21, 0, Math.PI*2); ctx.fill();        // head
        ctx.fillStyle = '#221636'; ctx.fillRect(px + s*0.42, py + s*0.44, s*0.16, s*0.10);  // muzzle
        ctx.fillStyle = '#120c1c'; ctx.fillRect(px + s*0.46, py + s*0.46, s*0.08, s*0.05);  // nose
        ctx.fillStyle = '#120c1c';                                                         // ears
        ctx.beginPath(); ctx.moveTo(px + s*0.30, py + s*0.32); ctx.lineTo(px + s*0.34, py + s*0.14); ctx.lineTo(px + s*0.44, py + s*0.32); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(px + s*0.70, py + s*0.32); ctx.lineTo(px + s*0.66, py + s*0.14); ctx.lineTo(px + s*0.56, py + s*0.32); ctx.closePath(); ctx.fill();
        ctx.fillStyle = `rgba(180,130,245,${0.75+flap*0.25})`;                             // both eyes
        ctx.fillRect(px + s*0.36, py + s*0.36, s*0.06, s*0.05); ctx.fillRect(px + s*0.58, py + s*0.36, s*0.06, s*0.05);
        ctx.fillStyle = '#e8e0f2'; ctx.fillRect(px + s*0.44, py + s*0.54, s*0.03, s*0.04);  // fangs
        ctx.fillStyle = '#e8e0f2'; ctx.fillRect(px + s*0.53, py + s*0.54, s*0.03, s*0.04);
        break;
      }
      // Side. This was always the mastiff's only view, drawn facing right.
      ctx.save();
      mirrorIfLeft(facing, cx);
      // A hound of living shadow — a low black dog wreathed in gloom, a spectral
      // violet eye, a maw of pale fangs, and a smoky tail. Shadowy aura.
      const aura = ctx.createRadialGradient(cx, py + s*0.55, 0, cx, py + s*0.55, s*0.5);
      aura.addColorStop(0, `rgba(110,70,180,${0.3+flap*0.2})`); aura.addColorStop(1, 'rgba(60,30,110,0)');
      ctx.fillStyle = aura; ctx.fillRect(fb.x - s*0.1, fb.y - s*0.1, s*1.2, s*1.2);
      ctx.fillStyle = '#120c1c'; ctx.fillRect(px + s*0.14, py + s*0.46, s*0.62, s*0.34);
      ctx.fillStyle = '#221636'; ctx.fillRect(px + s*0.14, py + s*0.46, s*0.62, s*0.14);
      ctx.fillStyle = '#120c1c';
      ctx.beginPath(); ctx.arc(px + s*0.74, py + s*0.46, s*0.18, 0, Math.PI*2); ctx.fill();   // head
      ctx.fillStyle = '#221636'; ctx.fillRect(px + s*0.84, py + s*0.46, s*0.12, s*0.08);      // snout
      ctx.fillStyle = '#120c1c';                                                              // ear
      ctx.beginPath(); ctx.moveTo(px + s*0.64, py + s*0.30); ctx.lineTo(px + s*0.68, py + s*0.42); ctx.lineTo(px + s*0.76, py + s*0.32); ctx.closePath(); ctx.fill();
      ctx.fillStyle = `rgba(180,130,245,${0.75+flap*0.25})`; ctx.fillRect(px + s*0.78, py + s*0.42, s*0.05, s*0.04);   // eye
      ctx.fillStyle = '#e8e0f2'; ctx.fillRect(px + s*0.86, py + s*0.52, s*0.08, s*0.02);      // fangs
      ctx.fillStyle = '#120c1c';                                                              // legs
      [0.20,0.40,0.58].forEach(fx => ctx.fillRect(px + s*fx, py + s*0.78, s*0.08, s*0.14));
      ctx.strokeStyle = '#221636'; ctx.lineWidth = Math.max(2, s*0.06);
      ctx.beginPath(); ctx.moveTo(px + s*0.14, py + s*0.50); ctx.lineTo(px - s*0.02, py + s*0.36 + Math.sin(Date.now()/200+phase)*s*0.04); ctx.stroke();   // tail
      ctx.restore();
      break;
    }
    case 'bodak': {
      const facing = creatureFacing(e);
      if (facing === 'up') {
        // Back: the same gaunt torso, a spine where the ribs were, the back of the
        // skull seamed across. The killing gaze does not show from behind.
        ctx.fillStyle = '#3a3348';
        ctx.beginPath(); ctx.moveTo(px + s*0.34, py + s*0.40); ctx.lineTo(px + s*0.66, py + s*0.40); ctx.lineTo(px + s*0.60, py + s*0.90); ctx.lineTo(px + s*0.40, py + s*0.90); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#4a4258'; ctx.fillRect(px + s*0.50, py + s*0.40, s*0.10, s*0.50);
        ctx.strokeStyle = '#221c30'; ctx.lineWidth = Math.max(2, s*0.04); ctx.lineCap='round';   // spine
        ctx.beginPath(); ctx.moveTo(cx, py + s*0.42); ctx.lineTo(cx, py + s*0.86); ctx.stroke();
        for (let iB=0;iB<4;iB++){ ctx.beginPath(); ctx.moveTo(cx - s*0.06, py + s*(0.48+iB*0.10)); ctx.lineTo(cx + s*0.06, py + s*(0.48+iB*0.10)); ctx.stroke(); }
        ctx.lineCap='butt';
        ctx.strokeStyle = '#3a3348'; ctx.lineWidth = Math.max(2, s*0.05); ctx.lineCap='round';   // arms
        ctx.beginPath(); ctx.moveTo(px + s*0.34, py + s*0.44); ctx.lineTo(px + s*0.20, py + s*0.70);
        ctx.moveTo(px + s*0.66, py + s*0.44); ctx.lineTo(px + s*0.80, py + s*0.70); ctx.stroke(); ctx.lineCap='butt';
        ctx.fillStyle = '#4a4258';
        ctx.beginPath(); ctx.arc(cx, py + s*0.26, s*0.16, 0, Math.PI*2); ctx.fill();       // back of the skull
        ctx.fillStyle = '#3a3348'; ctx.fillRect(px + s*0.40, py + s*0.34, s*0.20, s*0.06); // nape band
        ctx.strokeStyle = '#221c30'; ctx.lineWidth = 1;                                    // cranial seam
        ctx.beginPath(); ctx.moveTo(cx, py + s*0.10); ctx.lineTo(cx, py + s*0.34); ctx.stroke();
        break;
      }
      if (facing !== 'down') {
        // Side, drawn facing right: a thin hunched torso, one arm, the skull in
        // profile with its burning gaze set forward.
        ctx.save();
        mirrorIfLeft(facing, cx);
        ctx.fillStyle = '#3a3348';
        ctx.beginPath(); ctx.moveTo(px + s*0.42, py + s*0.40); ctx.lineTo(px + s*0.60, py + s*0.40); ctx.lineTo(px + s*0.56, py + s*0.90); ctx.lineTo(px + s*0.44, py + s*0.90); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#4a4258'; ctx.fillRect(px + s*0.44, py + s*0.40, s*0.08, s*0.50);
        ctx.strokeStyle = '#221c30'; ctx.lineWidth = 1;                                     // ribs, forward
        for (let iS=0;iS<3;iS++){ ctx.beginPath(); ctx.moveTo(px + s*0.46, py + s*(0.48+iS*0.08)); ctx.lineTo(px + s*0.58, py + s*(0.48+iS*0.08)); ctx.stroke(); }
        ctx.strokeStyle = '#3a3348'; ctx.lineWidth = Math.max(2, s*0.05); ctx.lineCap='round';   // the near arm
        ctx.beginPath(); ctx.moveTo(px + s*0.56, py + s*0.44); ctx.lineTo(px + s*0.74, py + s*0.68); ctx.stroke(); ctx.lineCap='butt';
        ctx.fillStyle = '#4a4258';
        ctx.beginPath(); ctx.ellipse(px + s*0.54, py + s*0.26, s*0.13, s*0.16, 0, 0, Math.PI*2); ctx.fill();   // skull, face to the right
        ctx.fillStyle = '#221c30'; ctx.fillRect(px + s*0.56, py + s*0.30, s*0.10, s*0.06);  // jaw shadow
        ctx.fillStyle = `rgba(180,120,255,${0.8+flap*0.2})`;                               // one burning eye
        ctx.beginPath(); ctx.arc(px + s*0.60, py + s*0.24, s*0.055, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#f0e6ff'; ctx.beginPath(); ctx.arc(px + s*0.62, py + s*0.24, s*0.02, 0, Math.PI*2); ctx.fill();
        ctx.restore();
        break;
      }
      // A bodak — a gaunt grey-violet corpse hollowed by the void, its killing gaze
      // a single burning eye. Emaciated undead humanoid.
      ctx.fillStyle = '#3a3348';
      ctx.beginPath(); ctx.moveTo(px + s*0.34, py + s*0.40); ctx.lineTo(px + s*0.66, py + s*0.40); ctx.lineTo(px + s*0.60, py + s*0.90); ctx.lineTo(px + s*0.40, py + s*0.90); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#4a4258'; ctx.fillRect(px + s*0.40, py + s*0.40, s*0.10, s*0.50);
      ctx.strokeStyle = '#221c30'; ctx.lineWidth = 1;                                     // ribs
      for (let i=0;i<3;i++){ ctx.beginPath(); ctx.moveTo(px + s*0.40, py + s*(0.48+i*0.08)); ctx.lineTo(px + s*0.60, py + s*(0.48+i*0.08)); ctx.stroke(); }
      ctx.strokeStyle = '#3a3348'; ctx.lineWidth = Math.max(2, s*0.05); ctx.lineCap='round';   // arms
      ctx.beginPath(); ctx.moveTo(px + s*0.34, py + s*0.44); ctx.lineTo(px + s*0.20, py + s*0.70);
      ctx.moveTo(px + s*0.66, py + s*0.44); ctx.lineTo(px + s*0.80, py + s*0.70); ctx.stroke(); ctx.lineCap='butt';
      ctx.fillStyle = '#4a4258';
      ctx.beginPath(); ctx.arc(cx, py + s*0.26, s*0.16, 0, Math.PI*2); ctx.fill();        // skull
      ctx.fillStyle = '#221c30'; ctx.fillRect(px + s*0.42, py + s*0.30, s*0.16, s*0.06);  // jaw shadow
      ctx.fillStyle = `rgba(180,120,255,${0.8+flap*0.2})`;
      ctx.beginPath(); ctx.arc(cx, py + s*0.24, s*0.055, 0, Math.PI*2); ctx.fill();       // gaze
      ctx.fillStyle = '#f0e6ff'; ctx.beginPath(); ctx.arc(cx, py + s*0.24, s*0.02, 0, Math.PI*2); ctx.fill();
      break;
    }
    case 'nightmare': {
      const facing = creatureFacing(e);
      if (facing === 'down' || facing === 'up') {
        // The legs and their violet hoof flames, animated as the side view animates.
        ctx.fillStyle = '#0e0a18';
        [0.24,0.38,0.56,0.70].forEach((xB,idx) => { const ll=(idx%2? s*0.22:s*0.18); ctx.fillRect(px + s*xB, py + s*0.70, s*0.08, ll); });
        ctx.fillStyle = `rgba(150,90,240,${0.6+flap*0.4})`;
        [0.24,0.38,0.56,0.70].forEach(xB => ctx.fillRect(px + s*xB, py + s*0.90, s*0.08, s*0.06));
        ctx.fillStyle = '#161020'; ctx.beginPath(); ctx.ellipse(cx, py + s*0.56, s*0.30, s*0.18, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#221636'; ctx.beginPath(); ctx.ellipse(cx, py + s*0.50, s*0.20, s*0.10, 0, 0, Math.PI*2); ctx.fill();
        if (facing === 'up') {
          // Back: the rump to the viewer, a tail of unlight hanging down the middle,
          // the neck and ears small beyond it. No eye, no muzzle.
          ctx.strokeStyle = '#221636'; ctx.lineWidth = Math.max(2, s*0.06);                 // tail
          ctx.beginPath(); ctx.moveTo(cx, py + s*0.62); ctx.lineTo(cx + Math.sin(Date.now()/200+phase)*s*0.05, py + s*0.86); ctx.stroke();
          ctx.fillStyle = `rgba(150,90,240,${0.6+flap*0.4})`;
          ctx.beginPath(); ctx.arc(cx + Math.sin(Date.now()/200+phase)*s*0.05, py + s*0.88, s*0.05, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = '#161020'; ctx.fillRect(cx - s*0.10, py + s*0.22, s*0.20, s*0.24);  // neck, seen from behind
          ctx.beginPath(); ctx.moveTo(px + s*0.36, py + s*0.22); ctx.lineTo(px + s*0.40, py + s*0.08); ctx.lineTo(px + s*0.48, py + s*0.22); ctx.closePath(); ctx.fill();   // ears
          ctx.beginPath(); ctx.moveTo(px + s*0.64, py + s*0.22); ctx.lineTo(px + s*0.60, py + s*0.08); ctx.lineTo(px + s*0.52, py + s*0.22); ctx.closePath(); ctx.fill();
          ctx.fillStyle = `rgba(150,90,240,${0.6+flap*0.4})`;                               // mane flames along the crest
          [0.40,0.50,0.60].forEach((xB,i) => { const fl=Math.sin(Date.now()/110+i+phase)*s*0.04; ctx.beginPath(); ctx.moveTo(px + s*xB, py + s*0.26); ctx.lineTo(px + s*(xB+0.03), py + s*0.06 - fl); ctx.lineTo(px + s*(xB+0.06), py + s*0.26); ctx.closePath(); ctx.fill(); });
          break;
        }
        // Head on: the wide chest, the long face between the eyes, the mane burning
        // behind the crest, both ears up.
        ctx.fillStyle = '#161020';
        ctx.beginPath(); ctx.ellipse(cx, py + s*0.36, s*0.16, s*0.22, 0, 0, Math.PI*2); ctx.fill();   // head
        ctx.fillStyle = '#0e0a18'; ctx.beginPath(); ctx.ellipse(cx, py + s*0.48, s*0.11, s*0.09, 0, 0, Math.PI*2); ctx.fill();   // muzzle
        ctx.fillStyle = '#161020';
        ctx.beginPath(); ctx.moveTo(px + s*0.34, py + s*0.24); ctx.lineTo(px + s*0.38, py + s*0.08); ctx.lineTo(px + s*0.48, py + s*0.24); ctx.closePath(); ctx.fill();     // ears
        ctx.beginPath(); ctx.moveTo(px + s*0.66, py + s*0.24); ctx.lineTo(px + s*0.62, py + s*0.08); ctx.lineTo(px + s*0.52, py + s*0.24); ctx.closePath(); ctx.fill();
        ctx.fillStyle = `rgba(150,90,240,${0.6+flap*0.4})`;                                 // mane flames, behind the head
        [0.28,0.62].forEach((xB,i) => { const fl=Math.sin(Date.now()/110+i+phase)*s*0.04; ctx.beginPath(); ctx.moveTo(px + s*xB, py + s*0.44); ctx.lineTo(px + s*(xB+0.04), py + s*0.20 - fl); ctx.lineTo(px + s*(xB+0.08), py + s*0.44); ctx.closePath(); ctx.fill(); });
        ctx.fillStyle = `rgba(200,140,255,${0.8+flap*0.2})`;                                // ember eyes
        ctx.fillRect(px + s*0.38, py + s*0.32, s*0.05, s*0.04); ctx.fillRect(px + s*0.57, py + s*0.32, s*0.05, s*0.04);
        ctx.fillStyle = '#0e0a18'; ctx.fillRect(px + s*0.44, py + s*0.50, s*0.04, s*0.03); ctx.fillRect(px + s*0.52, py + s*0.50, s*0.04, s*0.03);   // nostrils
        break;
      }
      // Side. This was always the nightmare's only view, drawn facing right.
      ctx.save();
      mirrorIfLeft(facing, cx);
      // A nightmare — a coal-black steed with a mane and hooves of violet flame,
      // eyes like embers. Fiery-maned horse.
      ctx.fillStyle = '#0e0a18';                                                          // legs
      [0.22,0.38,0.56,0.70].forEach((fx,idx) => { const ll=(idx%2? s*0.22:s*0.18); ctx.fillRect(px + s*fx, py + s*0.70, s*0.08, ll); });
      ctx.fillStyle = `rgba(150,90,240,${0.6+flap*0.4})`;                                  // hoof flames
      [0.22,0.38,0.56,0.70].forEach(fx => ctx.fillRect(px + s*fx, py + s*0.90, s*0.08, s*0.06));
      ctx.fillStyle = '#161020'; ctx.beginPath(); ctx.ellipse(cx, py + s*0.56, s*0.30, s*0.18, 0, 0, Math.PI*2); ctx.fill();   // body
      ctx.fillStyle = '#221636'; ctx.beginPath(); ctx.ellipse(cx - s*0.04, py + s*0.50, s*0.20, s*0.10, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#161020';                                                          // neck + head (right)
      ctx.beginPath(); ctx.moveTo(px + s*0.66, py + s*0.52); ctx.lineTo(px + s*0.80, py + s*0.24); ctx.lineTo(px + s*0.92, py + s*0.28); ctx.lineTo(px + s*0.82, py + s*0.52); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#0e0a18'; ctx.fillRect(px + s*0.86, py + s*0.24, s*0.10, s*0.10);  // muzzle
      ctx.fillStyle = `rgba(150,90,240,${0.6+flap*0.4})`;                                  // mane flames
      [0.60,0.68,0.76].forEach((fx,i)=>{ const fl=Math.sin(Date.now()/110+i+phase)*s*0.04; ctx.beginPath(); ctx.moveTo(px + s*fx, py + s*0.44); ctx.lineTo(px + s*(fx+0.03), py + s*0.22 - fl); ctx.lineTo(px + s*(fx+0.07), py + s*0.44); ctx.closePath(); ctx.fill(); });
      ctx.fillStyle = `rgba(200,140,255,${0.8+flap*0.2})`; ctx.fillRect(px + s*0.84, py + s*0.30, s*0.05, s*0.04);   // ember eye
      ctx.restore();
      break;
    }
    case 'shadow_demon': {
      const facing = creatureFacing(e);
      if (facing === 'up') {
        // Back: the wings held wide and low, the horns, a spine and a tail. No eyes,
        // no grin.
        const wfB = Math.sin(Date.now()/100 + phase) * 0.22 + 1;
        ctx.fillStyle = '#160f24';                                                        // wings, seen from behind
        ctx.beginPath(); ctx.moveTo(cx - s*0.06, py + s*0.40); ctx.lineTo(px - s*0.02, py + s*0.26/wfB); ctx.lineTo(px + s*0.10, py + s*0.48); ctx.lineTo(px + s*0.04, py + s*0.66); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(cx + s*0.06, py + s*0.40); ctx.lineTo(px + s*1.02, py + s*0.26/wfB); ctx.lineTo(px + s*0.90, py + s*0.48); ctx.lineTo(px + s*0.96, py + s*0.66); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#0e0a18';                                                        // smoky body
        ctx.beginPath();
        ctx.moveTo(px + s*0.34, py + s*0.34); ctx.lineTo(px + s*0.66, py + s*0.34);
        for (let iB=5;iB>=0;iB--){ const xB=px + s*0.34 + s*0.32*(iB/5); const yB=py + s*0.92 + Math.sin(Date.now()/200+phase+iB)*s*0.05; ctx.lineTo(xB, yB); }
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#2a1e40'; ctx.lineWidth = Math.max(1.5, s*0.03); ctx.lineCap='round';   // arms hanging
        ctx.beginPath(); ctx.moveTo(px + s*0.34, py + s*0.50); ctx.lineTo(px + s*0.26, py + s*0.68); ctx.moveTo(px + s*0.66, py + s*0.50); ctx.lineTo(px + s*0.74, py + s*0.68); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, py + s*0.40); ctx.lineTo(cx, py + s*0.78); ctx.stroke();    // spine
        ctx.beginPath(); ctx.moveTo(cx, py + s*0.80); ctx.quadraticCurveTo(px + s*0.72, py + s*0.88, px + s*0.70, py + s*1.00); ctx.stroke();   // tail
        ctx.lineCap='butt';
        ctx.fillStyle = '#0e0a18';                                                        // horns
        ctx.beginPath(); ctx.moveTo(px + s*0.40, py + s*0.20); ctx.lineTo(px + s*0.32, py + s*0.06); ctx.lineTo(px + s*0.48, py + s*0.18); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(px + s*0.60, py + s*0.20); ctx.lineTo(px + s*0.68, py + s*0.06); ctx.lineTo(px + s*0.52, py + s*0.18); ctx.closePath(); ctx.fill();
        break;
      }
      if (facing !== 'down') {
        // Side, drawn facing right: one wing over the body, one horn, one eye, the
        // fanged jaw poking forward.
        ctx.save();
        mirrorIfLeft(facing, cx);
        const wfS = Math.sin(Date.now()/100 + phase) * 0.22 + 1;
        ctx.fillStyle = '#160f24';                                                        // the far wing, behind
        ctx.beginPath(); ctx.moveTo(cx - s*0.02, py + s*0.42); ctx.lineTo(px + s*0.06, py + s*0.22/wfS); ctx.lineTo(px + s*0.16, py + s*0.42); ctx.lineTo(px + s*0.12, py + s*0.58); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#0e0a18';                                                        // smoky body, narrow
        ctx.beginPath();
        ctx.moveTo(px + s*0.42, py + s*0.34); ctx.lineTo(px + s*0.62, py + s*0.34);
        for (let iS=4;iS>=0;iS--){ const xS=px + s*0.42 + s*0.20*(iS/4); const yS=py + s*0.92 + Math.sin(Date.now()/200+phase+iS)*s*0.05; ctx.lineTo(xS, yS); }
        ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(px + s*0.62, py + s*0.28); ctx.lineTo(px + s*0.74, py + s*0.30); ctx.lineTo(px + s*0.62, py + s*0.38); ctx.closePath(); ctx.fill();   // the jaw, forward
        ctx.strokeStyle = '#2a1e40'; ctx.lineWidth = Math.max(1.5, s*0.03); ctx.lineCap='round';   // the near claw, forward
        ctx.beginPath(); ctx.moveTo(px + s*0.58, py + s*0.52); ctx.lineTo(px + s*0.76, py + s*0.62); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, py + s*0.42); ctx.quadraticCurveTo(px + s*0.30, py + s*0.60, px + s*0.26, py + s*0.80); ctx.stroke();   // tail, trailing back
        ctx.lineCap='butt';
        ctx.fillStyle = '#0e0a18';                                                        // one horn
        ctx.beginPath(); ctx.moveTo(px + s*0.52, py + s*0.20); ctx.lineTo(px + s*0.44, py + s*0.06); ctx.lineTo(px + s*0.62, py + s*0.18); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#160f24';                                                        // the near wing, over the body
        ctx.beginPath(); ctx.moveTo(cx + s*0.02, py + s*0.44); ctx.lineTo(px + s*0.14, py + s*0.30/wfS); ctx.lineTo(px + s*0.26, py + s*0.50); ctx.lineTo(px + s*0.20, py + s*0.66); ctx.closePath(); ctx.fill();
        ctx.fillStyle = `rgba(180,120,255,${0.8+flap*0.2})`;                              // one eye, forward
        ctx.fillRect(px + s*0.56, py + s*0.26, s*0.06, s*0.04);
        ctx.fillStyle = '#fff'; ctx.fillRect(px + s*0.68, py + s*0.32, s*0.02, s*0.03);   // one fang
        ctx.restore();
        break;
      }
      // A shadow demon — a winged blot of darkness with hooked claws and a fanged
      // violet grin, its bat-wings beating. Ranged terror.
      const wf = Math.sin(Date.now()/100 + phase) * 0.22 + 1;
      ctx.fillStyle = '#160f24';                                                          // wings
      ctx.beginPath(); ctx.moveTo(cx - s*0.06, py + s*0.42); ctx.lineTo(px + s*0.0, py + s*0.20/wf); ctx.lineTo(px + s*0.06, py + s*0.40); ctx.lineTo(px + s*0.02, py + s*0.56); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + s*0.06, py + s*0.42); ctx.lineTo(px + s*1.0, py + s*0.20/wf); ctx.lineTo(px + s*0.94, py + s*0.40); ctx.lineTo(px + s*0.98, py + s*0.56); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#0e0a18';                                                          // smoky body
      ctx.beginPath();
      ctx.moveTo(px + s*0.34, py + s*0.34); ctx.lineTo(px + s*0.66, py + s*0.34);
      for (let i=5;i>=0;i--){ const fx=px + s*0.34 + s*0.32*(i/5); const fy=py + s*0.92 + Math.sin(Date.now()/200+phase+i)*s*0.05; ctx.lineTo(fx, fy); }
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#2a1e40'; ctx.lineWidth = Math.max(1.5, s*0.03); ctx.lineCap='round';   // claws
      ctx.beginPath(); ctx.moveTo(px + s*0.34, py + s*0.52); ctx.lineTo(px + s*0.24, py + s*0.66); ctx.moveTo(px + s*0.66, py + s*0.52); ctx.lineTo(px + s*0.76, py + s*0.66); ctx.stroke(); ctx.lineCap='butt';
      ctx.fillStyle = '#0e0a18';                                                          // horns
      ctx.beginPath(); ctx.moveTo(px + s*0.40, py + s*0.20); ctx.lineTo(px + s*0.32, py + s*0.06); ctx.lineTo(px + s*0.48, py + s*0.18); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px + s*0.60, py + s*0.20); ctx.lineTo(px + s*0.68, py + s*0.06); ctx.lineTo(px + s*0.52, py + s*0.18); ctx.closePath(); ctx.fill();
      ctx.fillStyle = `rgba(180,120,255,${0.8+flap*0.2})`;                                 // eyes
      ctx.fillRect(px + s*0.40, py + s*0.26, s*0.06, s*0.04); ctx.fillRect(px + s*0.54, py + s*0.26, s*0.06, s*0.04);
      ctx.strokeStyle = `rgba(190,140,255,${0.6+flap*0.3})`; ctx.lineWidth = Math.max(1, s*0.025);   // grin
      ctx.beginPath(); ctx.arc(cx, py + s*0.34, s*0.08, 0.15*Math.PI, 0.85*Math.PI); ctx.stroke();
      break;
    }
    case 'nightwalker': {
      const facing = creatureFacing(e);
      if (facing === 'up') {
        // Back: a mantle over the shoulders, a spine down the smoke, the long arms
        // hanging straight. A featureless head with a ridge, and no eyes.
        const auraB = ctx.createRadialGradient(cx, cy, 0, cx, cy, s*0.6);
        auraB.addColorStop(0, `rgba(90,50,160,${0.4+flap*0.2})`); auraB.addColorStop(1, 'rgba(40,20,80,0)');
        ctx.fillStyle = auraB; ctx.fillRect(fb.x - s*0.15, fb.y - s*0.15, s*1.3, s*1.3);
        ctx.fillStyle = '#080510';                                                        // long torso
        ctx.beginPath(); ctx.moveTo(px + s*0.38, py + s*0.28); ctx.lineTo(px + s*0.62, py + s*0.28); ctx.lineTo(px + s*0.58, py + s*0.88); ctx.lineTo(px + s*0.42, py + s*0.88); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(px + s*0.24, py + s*0.48); ctx.lineTo(px + s*0.40, py + s*0.26); ctx.lineTo(px + s*0.60, py + s*0.26); ctx.lineTo(px + s*0.76, py + s*0.48); ctx.lineTo(px + s*0.66, py + s*0.62); ctx.lineTo(px + s*0.34, py + s*0.62); ctx.closePath(); ctx.fill();   // mantle
        ctx.strokeStyle = '#080510'; ctx.lineWidth = Math.max(2.5, s*0.06); ctx.lineCap='round';   // long arms, hanging
        ctx.beginPath();
        ctx.moveTo(px + s*0.36, py + s*0.32); ctx.lineTo(px + s*0.26, py + s*0.62); ctx.lineTo(px + s*0.24, py + s*0.92);
        ctx.moveTo(px + s*0.64, py + s*0.32); ctx.lineTo(px + s*0.74, py + s*0.62); ctx.lineTo(px + s*0.76, py + s*0.92);
        ctx.stroke(); ctx.lineCap='butt';
        ctx.fillStyle = '#080510'; ctx.fillRect(px + s*0.42, py + s*0.86, s*0.07, s*0.14); ctx.fillRect(px + s*0.51, py + s*0.86, s*0.07, s*0.14);   // legs
        ctx.strokeStyle = `rgba(120,80,200,${0.3+flap*0.3})`; ctx.lineWidth = Math.max(2, s*0.03);   // spine
        ctx.beginPath(); ctx.moveTo(cx, py + s*0.30); ctx.lineTo(cx, py + s*0.84); ctx.stroke();
        ctx.fillStyle = '#05030a';
        ctx.beginPath(); ctx.ellipse(cx, py + s*0.20, s*0.12, s*0.18, 0, 0, Math.PI*2); ctx.fill();   // head, from behind
        ctx.fillStyle = '#080510'; ctx.fillRect(cx - s*0.05, py + s*0.30, s*0.10, s*0.06);  // the nape
        ctx.strokeStyle = `rgba(120,80,200,${0.3+flap*0.3})`; ctx.lineWidth = Math.max(1, s*0.02);   // void wisps
        for (let iB=0;iB<3;iB++){ const wB=0.34+iB*0.16; ctx.beginPath(); ctx.moveTo(px + s*wB, py + s*0.6); ctx.lineTo(px + s*(wB-0.04*Math.sin(Date.now()/300+iB)), py + s*0.3); ctx.stroke(); }
        break;
      }
      if (facing !== 'down') {
        // Side, drawn facing right: a narrow column, the head in profile with one
        // pinprick eye set forward, one long arm reaching ahead.
        ctx.save();
        mirrorIfLeft(facing, cx);
        const auraS = ctx.createRadialGradient(cx, cy, 0, cx, cy, s*0.6);
        auraS.addColorStop(0, `rgba(90,50,160,${0.4+flap*0.2})`); auraS.addColorStop(1, 'rgba(40,20,80,0)');
        ctx.fillStyle = auraS; ctx.fillRect(fb.x - s*0.15, fb.y - s*0.15, s*1.3, s*1.3);
        ctx.fillStyle = '#080510';                                                        // long torso, narrow
        ctx.beginPath(); ctx.moveTo(px + s*0.44, py + s*0.28); ctx.lineTo(px + s*0.60, py + s*0.28); ctx.lineTo(px + s*0.56, py + s*0.88); ctx.lineTo(px + s*0.46, py + s*0.88); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#080510'; ctx.lineWidth = Math.max(2.5, s*0.06); ctx.lineCap='round';   // the far arm, behind
        ctx.beginPath(); ctx.moveTo(px + s*0.46, py + s*0.34); ctx.lineTo(px + s*0.36, py + s*0.62); ctx.lineTo(px + s*0.34, py + s*0.90); ctx.stroke();
        ctx.fillStyle = '#080510'; ctx.fillRect(px + s*0.46, py + s*0.86, s*0.08, s*0.14);  // the near leg
        ctx.strokeStyle = '#080510'; ctx.lineWidth = Math.max(2.5, s*0.06);                 // the near arm, reaching
        ctx.beginPath(); ctx.moveTo(px + s*0.58, py + s*0.34); ctx.lineTo(px + s*0.74, py + s*0.60); ctx.lineTo(px + s*0.80, py + s*0.88); ctx.stroke();
        ctx.lineCap='butt';
        ctx.fillStyle = '#05030a';
        ctx.beginPath(); ctx.ellipse(px + s*0.54, py + s*0.20, s*0.11, s*0.17, 0, 0, Math.PI*2); ctx.fill();   // head in profile
        ctx.fillStyle = `rgba(190,140,255,${0.85+flap*0.15})`;                             // one pinprick eye, forward
        ctx.beginPath(); ctx.arc(px + s*0.61, py + s*0.18, s*0.025, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = `rgba(120,80,200,${0.3+flap*0.3})`; ctx.lineWidth = Math.max(1, s*0.02);   // void wisps
        for (let iS=0;iS<2;iS++){ const wS=0.30+iS*0.10; ctx.beginPath(); ctx.moveTo(px + s*wS, py + s*0.6); ctx.lineTo(px + s*(wS+0.04*Math.sin(Date.now()/300+iS)), py + s*0.3); ctx.stroke(); }
        ctx.restore();
        break;
      }
      // A nightwalker — a towering, impossibly gaunt figure of absolute darkness that
      // radiates the void: long-limbed, a featureless head, two pinprick violet eyes,
      // wisps of unlight rising off it. The waste's apex horror.
      const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, s*0.6);
      aura.addColorStop(0, `rgba(90,50,160,${0.4+flap*0.2})`); aura.addColorStop(1, 'rgba(40,20,80,0)');
      ctx.fillStyle = aura; ctx.fillRect(fb.x - s*0.15, fb.y - s*0.15, s*1.3, s*1.3);
      ctx.fillStyle = '#080510';                                                          // long torso
      ctx.beginPath(); ctx.moveTo(px + s*0.38, py + s*0.28); ctx.lineTo(px + s*0.62, py + s*0.28); ctx.lineTo(px + s*0.58, py + s*0.88); ctx.lineTo(px + s*0.42, py + s*0.88); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#080510'; ctx.lineWidth = Math.max(2.5, s*0.06); ctx.lineCap='round';   // long arms
      ctx.beginPath();
      ctx.moveTo(px + s*0.38, py + s*0.34); ctx.lineTo(px + s*0.20, py + s*0.60); ctx.lineTo(px + s*0.16, py + s*0.90);
      ctx.moveTo(px + s*0.62, py + s*0.34); ctx.lineTo(px + s*0.80, py + s*0.60); ctx.lineTo(px + s*0.84, py + s*0.90);
      ctx.stroke(); ctx.lineCap='butt';
      ctx.fillStyle = '#080510'; ctx.fillRect(px + s*0.42, py + s*0.86, s*0.07, s*0.14); ctx.fillRect(px + s*0.51, py + s*0.86, s*0.07, s*0.14);   // legs
      ctx.fillStyle = '#05030a';
      ctx.beginPath(); ctx.ellipse(cx, py + s*0.20, s*0.13, s*0.17, 0, 0, Math.PI*2); ctx.fill();   // head
      ctx.fillStyle = `rgba(190,140,255,${0.85+flap*0.15})`;                              // pinprick eyes
      ctx.beginPath(); ctx.arc(cx - s*0.05, py + s*0.18, s*0.025, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + s*0.05, py + s*0.18, s*0.025, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = `rgba(120,80,200,${0.3+flap*0.3})`; ctx.lineWidth = Math.max(1, s*0.02);   // void wisps
      for (let i=0;i<3;i++){ const wx=0.3+i*0.2; ctx.beginPath(); ctx.moveTo(px + s*wx, py + s*0.6); ctx.lineTo(px + s*(wx+0.04*Math.sin(Date.now()/300+i)), py + s*0.3); ctx.stroke(); }
      break;
    }
    case 'eclipse_sovereign': {
      // Blinded: its read has failed and it is open. Drawn as a ring of pale
      // light around it, because the whole fight hinges on the player knowing
      // WHEN to commit, and a boss that is only situationally vulnerable has to
      // say so rather than leave it to be inferred from damage numbers.
      if (typeof sovereignIsBlind === 'function' && sovereignIsBlind()) {
        const t = Date.now() / 260;
        ctx.save();
        ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t);
        ctx.strokeStyle = '#e8dcff';
        ctx.lineWidth = Math.max(2, s * 0.06);
        ctx.beginPath();
        ctx.ellipse(cx, py + s * 0.55, s * 0.52, s * 0.42, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      const facing = creatureFacing(e);
      if (facing === 'up') {
        // Back: the same eclipse and the same crown, the cloak flung wide, the hood
        // seen from behind. No gaze, no jewel.
        if (e.boss) {
          const aurB = s*0.66 + Math.sin(Date.now()/220)*s*0.05;
          const auraB = ctx.createRadialGradient(cx, cy, 0, cx, cy, aurB);
          auraB.addColorStop(0, 'rgba(150,90,230,0.42)'); auraB.addColorStop(1, 'rgba(80,40,140,0)');
          ctx.fillStyle = auraB; ctx.fillRect(cx-aurB, cy-aurB, aurB*2, aurB*2);
        }
        ctx.fillStyle = '#050310';                                                        // black sun
        ctx.beginPath(); ctx.arc(cx, py + s*0.34, s*0.30, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = `rgba(180,130,255,${0.45+flap*0.4})`; ctx.lineWidth = Math.max(1.5, s*0.02);   // corona
        for (let iB=0;iB<12;iB++){ const aB=iB*Math.PI/6 + Date.now()/1600; const r1B=s*0.31, r2B=s*0.31+s*0.06*(0.6+0.4*Math.sin(Date.now()/300+iB));
          ctx.beginPath(); ctx.moveTo(cx+Math.cos(aB)*r1B, py+s*0.34+Math.sin(aB)*r1B); ctx.lineTo(cx+Math.cos(aB)*r2B, py+s*0.34+Math.sin(aB)*r2B); ctx.stroke(); }
        ctx.fillStyle = '#120b22';                                                        // cloak, flung wide
        ctx.beginPath(); ctx.moveTo(px + s*0.30, py + s*0.40); ctx.lineTo(px + s*0.70, py + s*0.40); ctx.lineTo(px + s*0.88, py + s*0.94); ctx.lineTo(px + s*0.12, py + s*0.94); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#1e1236'; ctx.beginPath(); ctx.moveTo(px + s*0.50, py + s*0.40); ctx.lineTo(px + s*0.70, py + s*0.40); ctx.lineTo(px + s*0.88, py + s*0.94); ctx.lineTo(px + s*0.50, py + s*0.94); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = `rgba(160,110,240,${0.5+flap*0.3})`; ctx.lineWidth = Math.max(1, s*0.02);   // folds
        ctx.beginPath(); ctx.moveTo(cx, py + s*0.42); ctx.lineTo(cx, py + s*0.92);
        ctx.moveTo(px + s*0.34, py + s*0.52); ctx.lineTo(px + s*0.26, py + s*0.92);
        ctx.moveTo(px + s*0.66, py + s*0.52); ctx.lineTo(px + s*0.74, py + s*0.92); ctx.stroke();
        ctx.fillStyle = '#080512';                                                        // hood, from behind
        ctx.beginPath(); ctx.moveTo(px + s*0.26, py + s*0.46); ctx.lineTo(cx, py + s*0.04); ctx.lineTo(px + s*0.74, py + s*0.46); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#1e1236'; ctx.beginPath(); ctx.ellipse(cx, py + s*0.44, s*0.24, s*0.07, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#2a1a44';                                                        // crown band and its spikes
        ctx.fillRect(cx - s*0.17, py + s*0.14, s*0.34, s*0.05);
        [0.36,0.44,0.5,0.56,0.64].forEach((xB,i)=>{ const th=(i===2?0.14:0.08); ctx.beginPath(); ctx.moveTo(px + s*xB, py + s*0.18); ctx.lineTo(px + s*(xB+0.02), py + s*(0.18-th)); ctx.lineTo(px + s*(xB+0.05), py + s*0.18); ctx.closePath(); ctx.fill(); });
        break;
      }
      if (facing !== 'down') {
        // Side, drawn facing right: the robe in profile with its train behind, the
        // hood leaning forward, one star eye, the eclipse off the shoulder.
        ctx.save();
        mirrorIfLeft(facing, cx);
        if (e.boss) {
          const aurS = s*0.66 + Math.sin(Date.now()/220)*s*0.05;
          const auraS = ctx.createRadialGradient(cx, cy, 0, cx, cy, aurS);
          auraS.addColorStop(0, 'rgba(150,90,230,0.42)'); auraS.addColorStop(1, 'rgba(80,40,140,0)');
          ctx.fillStyle = auraS; ctx.fillRect(cx-aurS, cy-aurS, aurS*2, aurS*2);
        }
        ctx.fillStyle = '#050310';                                                        // the black sun, behind
        ctx.beginPath(); ctx.arc(px + s*0.32, py + s*0.36, s*0.26, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = `rgba(180,130,255,${0.45+flap*0.4})`; ctx.lineWidth = Math.max(1.5, s*0.02);   // corona
        for (let iS=0;iS<8;iS++){ const aS=iS*Math.PI/4 + Date.now()/1600; const r1S=s*0.27, r2S=s*0.27+s*0.06*(0.6+0.4*Math.sin(Date.now()/300+iS));
          ctx.beginPath(); ctx.moveTo(px+s*0.32+Math.cos(aS)*r1S, py+s*0.36+Math.sin(aS)*r1S); ctx.lineTo(px+s*0.32+Math.cos(aS)*r2S, py+s*0.36+Math.sin(aS)*r2S); ctx.stroke(); }
        ctx.fillStyle = '#120b22';                                                        // robe in profile
        ctx.beginPath(); ctx.moveTo(px + s*0.42, py + s*0.40); ctx.lineTo(px + s*0.62, py + s*0.40); ctx.lineTo(px + s*0.72, py + s*0.94); ctx.lineTo(px + s*0.34, py + s*0.94); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#1e1236'; ctx.beginPath(); ctx.moveTo(px + s*0.42, py + s*0.40); ctx.lineTo(px + s*0.52, py + s*0.40); ctx.lineTo(px + s*0.52, py + s*0.94); ctx.lineTo(px + s*0.34, py + s*0.94); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(px + s*0.42, py + s*0.52); ctx.lineTo(px + s*0.18, py + s*0.94); ctx.lineTo(px + s*0.34, py + s*0.94); ctx.closePath(); ctx.fill();   // the train
        ctx.strokeStyle = `rgba(160,110,240,${0.5+flap*0.3})`; ctx.lineWidth = Math.max(1, s*0.02);   // fold
        ctx.beginPath(); ctx.moveTo(px + s*0.56, py + s*0.44); ctx.lineTo(px + s*0.60, py + s*0.92); ctx.stroke();
        ctx.fillStyle = '#080512';                                                        // hood in profile, peak swept back
        ctx.beginPath(); ctx.moveTo(px + s*0.68, py + s*0.44); ctx.lineTo(px + s*0.58, py + s*0.08); ctx.lineTo(px + s*0.26, py + s*0.28); ctx.lineTo(px + s*0.44, py + s*0.44); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#2a1a44';                                                        // crown spikes, forward
        [0.50,0.58].forEach((xB,i)=>{ const th=(i===0?0.12:0.08); ctx.beginPath(); ctx.moveTo(px + s*xB, py + s*0.18); ctx.lineTo(px + s*(xB+0.02), py + s*(0.18-th)); ctx.lineTo(px + s*(xB+0.05), py + s*0.18); ctx.closePath(); ctx.fill(); });
        ctx.fillStyle = `rgba(190,140,255,${0.7+flap*0.3})`; ctx.fillRect(px + s*0.58, py + s*0.06, s*0.05, s*0.04);   // the jewel, forward
        ctx.fillStyle = `rgba(200,150,255,${0.85+flap*0.15})`;                            // one star eye
        ctx.beginPath(); ctx.arc(px + s*0.60, py + s*0.30, s*0.035, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px + s*0.60, py + s*0.30, s*0.012, 0, Math.PI*2); ctx.fill();
        ctx.restore();
        break;
      }
      // The Eclipse Sovereign — the final horror. A regal void-figure crowned before
      // a black sun ringed with a shifting corona, its robe woven of unlight, its
      // gaze two cold violet stars. Boss: a violet void aura + eclipse disc behind.
      if (e.boss) {
        const auraR = s*0.66 + Math.sin(Date.now()/220)*s*0.05;
        const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, auraR);
        aura.addColorStop(0, 'rgba(150,90,230,0.42)'); aura.addColorStop(1, 'rgba(80,40,140,0)');
        ctx.fillStyle = aura; ctx.fillRect(cx-auraR, cy-auraR, auraR*2, auraR*2);
      }
      ctx.fillStyle = '#050310';                                                          // black sun
      ctx.beginPath(); ctx.arc(cx, py + s*0.34, s*0.30, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = `rgba(180,130,255,${0.45+flap*0.4})`; ctx.lineWidth = Math.max(1.5, s*0.02);   // corona
      for (let i=0;i<12;i++){ const a=i*Math.PI/6 + Date.now()/1600; const r1=s*0.31, r2=s*0.31+s*0.06*(0.6+0.4*Math.sin(Date.now()/300+i));
        ctx.beginPath(); ctx.moveTo(cx+Math.cos(a)*r1, py+s*0.34+Math.sin(a)*r1); ctx.lineTo(cx+Math.cos(a)*r2, py+s*0.34+Math.sin(a)*r2); ctx.stroke(); }
      ctx.fillStyle = '#120b22';                                                          // robe
      ctx.beginPath(); ctx.moveTo(px + s*0.30, py + s*0.40); ctx.lineTo(px + s*0.70, py + s*0.40); ctx.lineTo(px + s*0.80, py + s*0.94); ctx.lineTo(px + s*0.20, py + s*0.94); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#1e1236'; ctx.beginPath(); ctx.moveTo(px + s*0.30, py + s*0.40); ctx.lineTo(px + s*0.50, py + s*0.40); ctx.lineTo(px + s*0.50, py + s*0.94); ctx.lineTo(px + s*0.20, py + s*0.94); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = `rgba(160,110,240,${0.5+flap*0.3})`; ctx.lineWidth = Math.max(1, s*0.02);   // trim
      ctx.beginPath(); ctx.moveTo(px + s*0.50, py + s*0.42); ctx.lineTo(px + s*0.50, py + s*0.92); ctx.stroke();
      ctx.fillStyle = '#080512';                                                          // hood/head void
      ctx.beginPath(); ctx.moveTo(px + s*0.34, py + s*0.40); ctx.lineTo(cx, py + s*0.12); ctx.lineTo(px + s*0.66, py + s*0.40); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#2a1a44';                                                          // jagged crown
      [0.36,0.44,0.5,0.56,0.64].forEach((fx,i)=>{ const th=(i===2?0.14:0.08); ctx.beginPath(); ctx.moveTo(px + s*fx, py + s*0.18); ctx.lineTo(px + s*(fx+0.02), py + s*(0.18-th)); ctx.lineTo(px + s*(fx+0.05), py + s*0.18); ctx.closePath(); ctx.fill(); });
      ctx.fillStyle = `rgba(190,140,255,${0.7+flap*0.3})`; ctx.fillRect(px + s*0.47, py + s*0.06, s*0.06, s*0.04);   // crown jewel
      ctx.fillStyle = `rgba(200,150,255,${0.85+flap*0.15})`;                              // star eyes
      ctx.beginPath(); ctx.arc(px + s*0.44, py + s*0.30, s*0.035, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + s*0.56, py + s*0.30, s*0.035, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(px + s*0.44, py + s*0.30, s*0.012, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + s*0.56, py + s*0.30, s*0.012, 0, Math.PI*2); ctx.fill();
      break;
    }
  }
}

registerEnemyArt(drawShadowCreature, [
  'shade', 'shadow_mastiff', 'bodak', 'nightmare', 'shadow_demon', 'nightwalker',
  'eclipse_sovereign',
]);
