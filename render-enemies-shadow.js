// Shadow creatures and their boss. Reached through ENEMY_ART (render-enemies.js),
// which also draws what every creature shares: shadow, auras, HP bar and name tag.

function drawShadowCreature(e, ts, s, px, py, cx, cy, flap, phase, fb, bob, boxTop) {
  switch (e.type) {

    // ─── Shadow region ─────────────────────────────────────────────────
    case 'shade': {
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
      break;
    }
    case 'bodak': {
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
      break;
    }
    case 'shadow_demon': {
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
