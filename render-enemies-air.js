// Air creatures and their boss. Reached through ENEMY_ART (render-enemies.js),
// which also draws what every creature shares: shadow, auras, HP bar and name tag.

function drawAirCreature(e, ts, s, px, py, cx, cy, flap, phase, fb, bob, boxTop) {
  switch (e.type) {
    case 'wyvern': {
      const facing = creatureFacing(e);
      if (facing === 'up') {
        // Back: the same wings and horns from behind, the tail down the middle with its stinger.
        const wfU = Math.sin(Date.now()/120 + phase) * 0.2 + 1;
        ctx.fillStyle = '#5a3a18';
        ctx.beginPath(); ctx.moveTo(px + s*0.06, py + s*0.22 / wfU); ctx.lineTo(px + s*0.50, py + s*0.34); ctx.lineTo(px + s*0.30, py + s*0.58); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(px + s*0.94, py + s*0.22 / wfU); ctx.lineTo(px + s*0.50, py + s*0.34); ctx.lineTo(px + s*0.70, py + s*0.58); ctx.closePath(); ctx.fill();
        // The loose membrane hanging off the back of each wing
        ctx.fillStyle = '#3a2410';
        ctx.beginPath(); ctx.moveTo(px + s*0.06, py + s*0.22 / wfU); ctx.lineTo(px + s*0.30, py + s*0.58); ctx.lineTo(px + s*0.14, py + s*0.46); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(px + s*0.94, py + s*0.22 / wfU); ctx.lineTo(px + s*0.70, py + s*0.58); ctx.lineTo(px + s*0.86, py + s*0.46); ctx.closePath(); ctx.fill();
        // Body from behind, spine and shoulder blades
        ctx.fillStyle = '#7a5022';
        ctx.beginPath(); ctx.ellipse(cx, py + s*0.52, s*0.20, s*0.28, 0, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#5a3a18'; ctx.lineWidth = Math.max(2, s*0.05);
        ctx.beginPath(); ctx.moveTo(cx, py + s*0.28); ctx.lineTo(cx, py + s*0.76); ctx.stroke();
        ctx.lineWidth = Math.max(2, s*0.03);
        ctx.beginPath(); ctx.moveTo(cx - s*0.16, py + s*0.40); ctx.lineTo(cx, py + s*0.50); ctx.lineTo(cx + s*0.16, py + s*0.40); ctx.stroke();
        // Back of the head and the same two horns
        ctx.fillStyle = '#5a3a18';
        ctx.beginPath(); ctx.arc(cx, py + s*0.26, s*0.16, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#3a2410';
        ctx.beginPath(); ctx.moveTo(px + s*0.42, py + s*0.18); ctx.lineTo(px + s*0.36, py + s*0.04); ctx.lineTo(px + s*0.48, py + s*0.16); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(px + s*0.58, py + s*0.18); ctx.lineTo(px + s*0.64, py + s*0.04); ctx.lineTo(px + s*0.52, py + s*0.16); ctx.closePath(); ctx.fill();
        // Tail and stinger
        const tailU = cx + Math.sin(Date.now()/180 + phase) * s*0.16;
        ctx.strokeStyle = '#7a5022'; ctx.lineWidth = Math.max(2, s*0.06);
        ctx.beginPath(); ctx.moveTo(cx, py + s*0.78); ctx.lineTo(tailU, py + s*0.96); ctx.stroke();
        ctx.fillStyle = '#3a2410';
        ctx.beginPath(); ctx.moveTo(tailU - s*0.05, py + s*0.94); ctx.lineTo(tailU, py + s*1.04); ctx.lineTo(tailU + s*0.05, py + s*0.94); ctx.closePath(); ctx.fill();
        break;
      }
      if (facing !== 'down') {
        // Side, facing right: one wing, one eye, one horn, the snout forward, the tail behind.
        ctx.save();
        mirrorIfLeft(facing, cx);
        const wfS = Math.sin(Date.now()/120 + phase) * 0.2 + 1;
        // Far wing
        ctx.fillStyle = '#5a3a18';
        ctx.beginPath(); ctx.moveTo(px + s*0.22, py + s*0.36/wfS); ctx.lineTo(px + s*0.54, py + s*0.42); ctx.lineTo(px + s*0.42, py + s*0.62); ctx.closePath(); ctx.fill();
        // Tail sweeping behind, stinger tipped up
        const tailS = Math.sin(Date.now()/180 + phase) * s*0.06;
        ctx.strokeStyle = '#7a5022'; ctx.lineWidth = Math.max(2, s*0.06);
        ctx.beginPath(); ctx.moveTo(px + s*0.36, py + s*0.66); ctx.quadraticCurveTo(px + s*0.12, py + s*0.76 + tailS, px + s*0.04, py + s*0.52); ctx.stroke();
        ctx.fillStyle = '#3a2410';
        ctx.beginPath(); ctx.moveTo(px + s*0.09, py + s*0.54); ctx.lineTo(px - s*0.04, py + s*0.40); ctx.lineTo(px + s*0.12, py + s*0.46); ctx.closePath(); ctx.fill();
        // Body in profile
        ctx.fillStyle = '#7a5022';
        ctx.beginPath(); ctx.ellipse(px + s*0.54, py + s*0.58, s*0.18, s*0.26, 0, 0, Math.PI*2); ctx.fill();
        // Head, snout forward, one horn back
        ctx.fillStyle = '#5a3a18';
        ctx.beginPath(); ctx.arc(px + s*0.62, py + s*0.28, s*0.15, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(px + s*0.70, py + s*0.24); ctx.lineTo(px + s*0.88, py + s*0.32); ctx.lineTo(px + s*0.70, py + s*0.40); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#3a2410';
        ctx.beginPath(); ctx.moveTo(px + s*0.56, py + s*0.18); ctx.lineTo(px + s*0.48, py + s*0.04); ctx.lineTo(px + s*0.62, py + s*0.16); ctx.closePath(); ctx.fill();
        // One eye
        ctx.fillStyle = '#ffaa44'; ctx.fillRect(px + s*0.64, py + s*0.26, s*0.07, s*0.05);
        ctx.fillStyle = '#000'; ctx.fillRect(px + s*0.67, py + s*0.27, s*0.02, s*0.03);
        // Near wing folded over the body, one leg
        ctx.fillStyle = '#5a3a18';
        ctx.beginPath(); ctx.moveTo(px + s*0.54, py + s*0.44); ctx.lineTo(px + s*0.30, py + s*0.48); ctx.lineTo(px + s*0.44, py + s*0.72); ctx.lineTo(px + s*0.60, py + s*0.64); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#5a3a18'; ctx.lineWidth = Math.max(2, s*0.05);
        ctx.beginPath(); ctx.moveTo(px + s*0.52, py + s*0.82); ctx.lineTo(px + s*0.54, py + s*0.96); ctx.stroke();
        ctx.restore();
        break;
      }
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
      const facing = creatureFacing(e);
      if (facing === 'up') {
        // Back: the same wings, a fan of tail feathers, the back of the head in wild hair.
        const hwfU = Math.sin(Date.now()/110 + phase)*0.3 + 1;
        ctx.fillStyle = '#7a6030';
        ctx.beginPath(); ctx.moveTo(cx - s*0.06, py + s*0.42); ctx.lineTo(px + s*0.0, py + s*0.20/hwfU); ctx.lineTo(px + s*0.16, py + s*0.30); ctx.lineTo(px + s*0.14, py + s*0.56); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(cx + s*0.06, py + s*0.42); ctx.lineTo(px + s*1.0, py + s*0.20/hwfU); ctx.lineTo(px + s*0.84, py + s*0.30); ctx.lineTo(px + s*0.86, py + s*0.56); ctx.closePath(); ctx.fill();
        // Torso from behind, with the spine down the middle
        ctx.fillStyle = '#9a7c40';
        ctx.beginPath(); ctx.ellipse(cx, py + s*0.56, s*0.16, s*0.22, 0, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#7a6030'; ctx.lineWidth = Math.max(2, s*0.03);
        ctx.beginPath(); ctx.moveTo(cx, py + s*0.38); ctx.lineTo(cx, py + s*0.72); ctx.stroke();
        // Tail feathers fanned out below the torso
        ctx.fillStyle = '#5a4420';
        for (let i=0;i<5;i++){ const tf = (i-2)*0.30; ctx.beginPath(); ctx.moveTo(cx, py + s*0.66); ctx.lineTo(cx + Math.sin(tf)*s*0.34, py + s*(0.94 - Math.abs(i-2)*0.03)); ctx.lineTo(cx + Math.sin(tf)*s*0.14, py + s*0.70); ctx.closePath(); ctx.fill(); }
        // Back of the head and the same wild hair
        ctx.fillStyle = '#5a4420';
        ctx.beginPath(); ctx.arc(cx, py + s*0.30, s*0.14, 0, Math.PI*2); ctx.fill();
        for (let i=0;i<5;i++){ ctx.beginPath(); ctx.moveTo(cx - s*0.12 + i*s*0.06, py + s*0.22); ctx.lineTo(cx - s*0.16 + i*s*0.06, py + s*0.06); ctx.lineTo(cx - s*0.08 + i*s*0.06, py + s*0.20); ctx.closePath(); ctx.fill(); }
        // Talons
        ctx.strokeStyle = '#3a2c14'; ctx.lineWidth = Math.max(2, s*0.04); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(cx - s*0.06, py + s*0.78); ctx.lineTo(cx - s*0.10, py + s*0.90); ctx.moveTo(cx + s*0.06, py + s*0.78); ctx.lineTo(cx + s*0.10, py + s*0.90); ctx.stroke();
        break;
      }
      if (facing !== 'down') {
        // Side, drawn facing right: one wing, one eye, a jutting jaw, one talon.
        ctx.save();
        mirrorIfLeft(facing, cx);
        const hwfS = Math.sin(Date.now()/110 + phase)*0.3 + 1;
        // Far wing behind the body
        ctx.fillStyle = '#7a6030';
        ctx.beginPath(); ctx.moveTo(cx - s*0.02, py + s*0.42); ctx.lineTo(px + s*0.14, py + s*0.22/hwfS); ctx.lineTo(px + s*0.30, py + s*0.34); ctx.lineTo(px + s*0.28, py + s*0.58); ctx.closePath(); ctx.fill();
        // Tail feathers behind
        ctx.fillStyle = '#5a4420';
        ctx.beginPath(); ctx.moveTo(px + s*0.42, py + s*0.62); ctx.lineTo(px + s*0.18, py + s*0.80); ctx.lineTo(px + s*0.40, py + s*0.78); ctx.closePath(); ctx.fill();
        // Torso in profile
        ctx.fillStyle = '#caa86a';
        ctx.beginPath(); ctx.ellipse(px + s*0.54, py + s*0.56, s*0.12, s*0.22, 0, 0, Math.PI*2); ctx.fill();
        // Head with the jaw jutting right
        ctx.fillStyle = '#caa86a';
        ctx.beginPath(); ctx.arc(px + s*0.60, py + s*0.30, s*0.13, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(px + s*0.68, py + s*0.26); ctx.lineTo(px + s*0.78, py + s*0.32); ctx.lineTo(px + s*0.66, py + s*0.38); ctx.closePath(); ctx.fill();
        // Wild hair streaming back
        ctx.fillStyle = '#5a4420';
        for (let i=0;i<4;i++){ ctx.beginPath(); ctx.moveTo(px + s*(0.56 - i*0.05), py + s*0.22); ctx.lineTo(px + s*(0.44 - i*0.06), py + s*0.08); ctx.lineTo(px + s*(0.52 - i*0.05), py + s*0.24); ctx.closePath(); ctx.fill(); }
        // One eye
        ctx.fillStyle = '#fff'; ctx.fillRect(px + s*0.62, py + s*0.28, s*0.04, s*0.04);
        ctx.fillStyle = '#000'; ctx.fillRect(px + s*0.63, py + s*0.29, s*0.02, s*0.02);
        // Near wing folded over the body
        ctx.fillStyle = '#9a7c40';
        ctx.beginPath(); ctx.moveTo(px + s*0.50, py + s*0.44); ctx.lineTo(px + s*0.28, py + s*0.46); ctx.lineTo(px + s*0.42, py + s*0.70); ctx.lineTo(px + s*0.60, py + s*0.62); ctx.closePath(); ctx.fill();
        // One talon
        ctx.strokeStyle = '#3a2c14'; ctx.lineWidth = Math.max(2, s*0.04); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(px + s*0.54, py + s*0.78); ctx.lineTo(px + s*0.58, py + s*0.90); ctx.stroke();
        ctx.restore();
        break;
      }
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
      const facing = creatureFacing(e);
      if (facing === 'down') {
        // Front: two wings, the eagle head with its beak between two eyes, chest and forelegs.
        const grfD = Math.sin(Date.now()/120 + phase)*0.2 + 1;
        ctx.fillStyle = '#9a7c40';
        ctx.beginPath(); ctx.moveTo(cx - s*0.04, py + s*0.44); ctx.lineTo(px + s*0.02, py + s*0.18/grfD); ctx.lineTo(px + s*0.22, py + s*0.32); ctx.lineTo(px + s*0.26, py + s*0.56); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(cx + s*0.04, py + s*0.44); ctx.lineTo(px + s*0.98, py + s*0.18/grfD); ctx.lineTo(px + s*0.78, py + s*0.32); ctx.lineTo(px + s*0.74, py + s*0.56); ctx.closePath(); ctx.fill();
        // Lion haunches behind the chest
        ctx.fillStyle = '#b8915a';
        ctx.beginPath(); ctx.ellipse(cx, py + s*0.66, s*0.24, s*0.18, 0, 0, Math.PI*2); ctx.fill();
        // Chest
        ctx.fillStyle = '#caa86a';
        ctx.fillRect(px + s*0.40, py + s*0.50, s*0.20, s*0.34);
        // Eagle head, brow tufts, beak down the middle
        ctx.fillStyle = '#e8e2d0';
        ctx.beginPath(); ctx.arc(cx, py + s*0.34, s*0.16, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#9a7c40';
        ctx.beginPath(); ctx.moveTo(cx - s*0.14, py + s*0.24); ctx.lineTo(cx - s*0.22, py + s*0.14); ctx.lineTo(cx - s*0.06, py + s*0.22); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(cx + s*0.14, py + s*0.24); ctx.lineTo(cx + s*0.22, py + s*0.14); ctx.lineTo(cx + s*0.06, py + s*0.22); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffc23a';
        ctx.beginPath(); ctx.moveTo(cx - s*0.05, py + s*0.40); ctx.lineTo(cx, py + s*0.54); ctx.lineTo(cx + s*0.05, py + s*0.40); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffcc33'; ctx.beginPath(); ctx.arc(cx - s*0.08, py + s*0.30, s*0.05, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + s*0.08, py + s*0.30, s*0.05, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(cx - s*0.08, py + s*0.30, s*0.025, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + s*0.08, py + s*0.30, s*0.025, 0, Math.PI*2); ctx.fill();
        // Forelegs
        ctx.fillStyle = '#9a7c40';
        ctx.fillRect(px + s*0.38, py + s*0.80, s*0.08, s*0.12); ctx.fillRect(px + s*0.54, py + s*0.80, s*0.08, s*0.12);
        break;
      }
      if (facing === 'up') {
        // Back: both wings, the back of the eagle head, lion haunches and the tail down the middle.
        const grfU = Math.sin(Date.now()/120 + phase)*0.2 + 1;
        ctx.fillStyle = '#9a7c40';
        ctx.beginPath(); ctx.moveTo(cx - s*0.04, py + s*0.44); ctx.lineTo(px + s*0.02, py + s*0.18/grfU); ctx.lineTo(px + s*0.22, py + s*0.32); ctx.lineTo(px + s*0.26, py + s*0.56); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(cx + s*0.04, py + s*0.44); ctx.lineTo(px + s*0.98, py + s*0.18/grfU); ctx.lineTo(px + s*0.78, py + s*0.32); ctx.lineTo(px + s*0.74, py + s*0.56); ctx.closePath(); ctx.fill();
        // Lion hindquarters, spine and hind legs
        ctx.fillStyle = '#b8915a';
        ctx.beginPath(); ctx.ellipse(cx, py + s*0.64, s*0.26, s*0.20, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#9a7c40';
        ctx.fillRect(px + s*0.34, py + s*0.80, s*0.09, s*0.12); ctx.fillRect(px + s*0.57, py + s*0.80, s*0.09, s*0.12);
        // Lion tail hanging down the back, tufted at the end
        ctx.strokeStyle = '#8a6a38'; ctx.lineWidth = Math.max(2, s*0.05);
        ctx.beginPath(); ctx.moveTo(cx, py + s*0.70); ctx.quadraticCurveTo(cx + s*0.06, py + s*0.86, cx - s*0.02, py + s*0.98); ctx.stroke();
        ctx.fillStyle = '#9a7c40';
        ctx.beginPath(); ctx.ellipse(cx - s*0.02, py + s*0.99, s*0.05, s*0.06, 0, 0, Math.PI*2); ctx.fill();
        // Back of the head with its feather ruff, no face
        ctx.fillStyle = '#e8e2d0';
        ctx.beginPath(); ctx.arc(cx, py + s*0.34, s*0.16, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#9a7c40';
        ctx.beginPath(); ctx.arc(cx, py + s*0.36, s*0.11, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#e8e2d0';
        ctx.beginPath(); ctx.moveTo(cx - s*0.14, py + s*0.24); ctx.lineTo(cx - s*0.22, py + s*0.14); ctx.lineTo(cx - s*0.06, py + s*0.22); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(cx + s*0.14, py + s*0.24); ctx.lineTo(cx + s*0.22, py + s*0.14); ctx.lineTo(cx + s*0.06, py + s*0.22); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#8a6a38'; ctx.lineWidth = Math.max(2, s*0.03);
        ctx.beginPath(); ctx.moveTo(cx, py + s*0.44); ctx.lineTo(cx, py + s*0.60); ctx.stroke();
        break;
      }
      // Side. This was always the griffon's only view, drawn facing right.
      ctx.save();
      mirrorIfLeft(facing, cx);
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
      ctx.restore();
      break;
    }
    case 'manticore': {
      const facing = creatureFacing(e);
      if (facing === 'up') {
        // Back: the same wings, a full mane with no face, the spiked tail over the back.
        const mcfU = Math.sin(Date.now()/120 + phase)*0.2 + 1;
        ctx.fillStyle = '#6a3a24';
        ctx.beginPath(); ctx.moveTo(cx, py + s*0.40); ctx.lineTo(px + s*0.10, py + s*0.14/mcfU); ctx.lineTo(px + s*0.30, py + s*0.26); ctx.lineTo(px + s*0.26, py + s*0.50); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(cx, py + s*0.40); ctx.lineTo(px + s*0.90, py + s*0.14/mcfU); ctx.lineTo(px + s*0.70, py + s*0.26); ctx.lineTo(px + s*0.74, py + s*0.50); ctx.closePath(); ctx.fill();
        // Lion body from behind, spine down the middle
        ctx.fillStyle = '#9a5a36';
        ctx.beginPath(); ctx.ellipse(cx, py + s*0.62, s*0.30, s*0.20, 0, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#7a4426'; ctx.lineWidth = Math.max(2, s*0.04);
        ctx.beginPath(); ctx.moveTo(cx, py + s*0.46); ctx.lineTo(cx, py + s*0.80); ctx.stroke();
        // Back of the head inside the mane, no face
        ctx.fillStyle = '#7a4426';
        ctx.beginPath(); ctx.arc(cx, py + s*0.40, s*0.20, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#9a5a36';
        ctx.beginPath(); ctx.arc(cx, py + s*0.42, s*0.12, 0, Math.PI*2); ctx.fill();
        // The spiked tail arcing up over the back
        ctx.strokeStyle = '#9a5a36'; ctx.lineWidth = Math.max(2, s*0.05);
        ctx.beginPath(); ctx.moveTo(cx + s*0.12, py + s*0.72); ctx.quadraticCurveTo(cx + s*0.30, py + s*0.44, cx + s*0.06, py + s*0.20); ctx.stroke();
        ctx.fillStyle = '#e8e0c8';
        [[0.06,0.20],[0.00,0.27],[0.14,0.26]].forEach(([fx,fy]) => { ctx.beginPath(); ctx.moveTo(cx + s*fx, py + s*fy); ctx.lineTo(cx + s*(fx+0.02), py + s*(fy-0.10)); ctx.lineTo(cx + s*(fx+0.05), py + s*fy); ctx.closePath(); ctx.fill(); });
        break;
      }
      if (facing !== 'down') {
        // Side, facing right: one wing, one eye, the muzzle forward, the tail over the back.
        ctx.save();
        mirrorIfLeft(facing, cx);
        const mcfS = Math.sin(Date.now()/120 + phase)*0.2 + 1;
        // Far wing
        ctx.fillStyle = '#6a3a24';
        ctx.beginPath(); ctx.moveTo(cx - s*0.02, py + s*0.40); ctx.lineTo(px + s*0.16, py + s*0.16/mcfS); ctx.lineTo(px + s*0.34, py + s*0.28); ctx.lineTo(px + s*0.30, py + s*0.50); ctx.closePath(); ctx.fill();
        // Lion body and legs, narrower than the front
        ctx.fillStyle = '#9a5a36';
        ctx.beginPath(); ctx.ellipse(px + s*0.46, py + s*0.62, s*0.24, s*0.18, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillRect(px + s*0.30, py + s*0.76, s*0.08, s*0.16); ctx.fillRect(px + s*0.56, py + s*0.76, s*0.08, s*0.16);
        // Mane, head and muzzle jutting right
        ctx.fillStyle = '#7a4426';
        ctx.beginPath(); ctx.arc(px + s*0.60, py + s*0.42, s*0.18, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#c89a6a';
        ctx.beginPath(); ctx.arc(px + s*0.66, py + s*0.44, s*0.11, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(px + s*0.72, py + s*0.38); ctx.lineTo(px + s*0.86, py + s*0.46); ctx.lineTo(px + s*0.70, py + s*0.52); ctx.closePath(); ctx.fill();
        // One eye, one fang
        ctx.fillStyle = '#330000'; ctx.fillRect(px + s*0.68, py + s*0.40, s*0.04, s*0.04);
        ctx.fillStyle = '#fff'; ctx.fillRect(px + s*0.74, py + s*0.50, s*0.02, s*0.03);
        // Near wing folded over the body
        ctx.fillStyle = '#6a3a24';
        ctx.beginPath(); ctx.moveTo(px + s*0.46, py + s*0.44); ctx.lineTo(px + s*0.22, py + s*0.46); ctx.lineTo(px + s*0.38, py + s*0.68); ctx.lineTo(px + s*0.56, py + s*0.60); ctx.closePath(); ctx.fill();
        // Spiked tail arcing forward over the back
        ctx.strokeStyle = '#9a5a36'; ctx.lineWidth = Math.max(2, s*0.05);
        ctx.beginPath(); ctx.moveTo(px + s*0.26, py + s*0.60); ctx.quadraticCurveTo(px + s*0.08, py + s*0.36, px + s*0.32, py + s*0.20); ctx.stroke();
        ctx.fillStyle = '#e8e0c8';
        [[0.32,0.20],[0.24,0.26],[0.40,0.25]].forEach(([fx,fy]) => { ctx.beginPath(); ctx.moveTo(px + s*fx, py + s*fy); ctx.lineTo(px + s*(fx+0.02), py + s*(fy-0.10)); ctx.lineTo(px + s*(fx+0.05), py + s*fy); ctx.closePath(); ctx.fill(); });
        ctx.restore();
        break;
      }
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
      const facing = creatureFacing(e);
      if (facing === 'up') {
        // Back: the same vortex seen from behind, so its tilt runs the other way, with no face.
        const spinU = Date.now()/300 + phase;
        for (let i=0;i<4;i++){
          const rU = s*0.36 - i*s*0.06;
          ctx.strokeStyle = `rgba(210,225,240,${0.25 + i*0.12})`;
          ctx.lineWidth = Math.max(2, s*0.06);
          ctx.beginPath();
          ctx.ellipse(cx, py + s*0.30 + i*s*0.14, rU, rU*0.5, -Math.sin(spinU+i)*0.4, 0, Math.PI*2);
          ctx.stroke();
        }
        // Wispy core
        ctx.fillStyle = 'rgba(235,242,250,0.5)';
        ctx.beginPath(); ctx.ellipse(cx, py + s*0.46, s*0.16, s*0.26, 0, 0, Math.PI*2); ctx.fill();
        // The swirl's ridge down the back
        ctx.strokeStyle = 'rgba(210,225,240,0.75)'; ctx.lineWidth = Math.max(2, s*0.05);
        for (let i=0;i<3;i++){ ctx.beginPath(); ctx.arc(cx, py + s*(0.32 + i*0.13), s*(0.10 + i*0.04), Math.PI*0.15, Math.PI*0.85); ctx.stroke(); }
        // Wisp tufts off the shoulders
        ctx.fillStyle = 'rgba(235,242,250,0.45)';
        for (let i=0;i<3;i++){ ctx.beginPath(); ctx.ellipse(cx + (i-1)*s*0.24, py + s*(0.24 + (i%2)*0.08), s*0.08, s*0.05, 0, 0, Math.PI*2); ctx.fill(); }
        break;
      }
      if (facing !== 'down') {
        // Side, facing right: a narrower stack of rings, one eye, wisps trailing behind.
        ctx.save();
        mirrorIfLeft(facing, cx);
        const spinS = Date.now()/300 + phase;
        for (let i=0;i<4;i++){
          const rS = s*0.26 - i*s*0.04;
          ctx.strokeStyle = `rgba(210,225,240,${0.25 + i*0.12})`;
          ctx.lineWidth = Math.max(2, s*0.06);
          ctx.beginPath();
          ctx.ellipse(px + s*0.52, py + s*0.30 + i*s*0.14, rS, rS*0.6, Math.sin(spinS+i)*0.3, 0, Math.PI*2);
          ctx.stroke();
        }
        // Wispy core
        ctx.fillStyle = 'rgba(235,242,250,0.5)';
        ctx.beginPath(); ctx.ellipse(px + s*0.52, py + s*0.46, s*0.12, s*0.26, 0, 0, Math.PI*2); ctx.fill();
        // One eye
        ctx.fillStyle = `rgba(255,255,255,${0.7+flap*0.3})`;
        ctx.beginPath(); ctx.arc(px + s*0.60, py + s*0.36, s*0.05, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#88aacc';
        ctx.beginPath(); ctx.arc(px + s*0.62, py + s*0.36, s*0.02, 0, Math.PI*2); ctx.fill();
        // Gust reaching forward, wisps trailing behind
        ctx.strokeStyle = 'rgba(235,242,250,0.55)'; ctx.lineWidth = Math.max(1.5, s*0.04);
        ctx.beginPath(); ctx.moveTo(px + s*0.68, py + s*0.52); ctx.lineTo(px + s*0.88, py + s*0.56); ctx.stroke();
        for (let i=0;i<3;i++){ ctx.beginPath(); ctx.moveTo(px + s*0.34, py + s*(0.32 + i*0.15)); ctx.quadraticCurveTo(px + s*0.12, py + s*(0.28 + i*0.15), px + s*0.02, py + s*(0.40 + i*0.15)); ctx.stroke(); }
        ctx.restore();
        break;
      }
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
      const facing = creatureFacing(e);
      if (facing === 'up') {
        // Back: the same wings, a broad fan of back feathers, the back of the head with no face.
        const rwfU = Math.sin(Date.now()/100 + phase)*0.28 + 1;
        ctx.fillStyle = '#6a4f30';
        ctx.beginPath(); ctx.moveTo(cx - s*0.04, py + s*0.46); ctx.lineTo(px - s*0.06, py + s*0.16/rwfU); ctx.lineTo(px + s*0.22, py + s*0.30); ctx.lineTo(px + s*0.30, py + s*0.56); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(cx + s*0.04, py + s*0.46); ctx.lineTo(px + s*1.06, py + s*0.16/rwfU); ctx.lineTo(px + s*0.78, py + s*0.30); ctx.lineTo(px + s*0.70, py + s*0.56); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#8a6a40';
        ctx.beginPath(); ctx.moveTo(px + s*1.06, py + s*0.16/rwfU); ctx.lineTo(px + s*0.88, py + s*0.22); ctx.lineTo(px + s*0.98, py + s*0.34); ctx.closePath(); ctx.fill();
        // The body, then the back feathers fanned over it
        ctx.fillStyle = '#7a5c38';
        ctx.beginPath(); ctx.ellipse(cx, py + s*0.60, s*0.22, s*0.26, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#8a6a40';
        for (let i=0;i<5;i++){ const bf = (i-2)*0.34; ctx.beginPath(); ctx.moveTo(cx, py + s*0.44); ctx.lineTo(cx + Math.sin(bf)*s*0.46, py + s*(0.74 - Math.abs(i-2)*0.05)); ctx.lineTo(cx + Math.sin(bf)*s*0.16, py + s*0.50); ctx.closePath(); ctx.fill(); }
        // Tail feathers
        ctx.fillStyle = '#6a4f30';
        for (let i=0;i<3;i++){ const tf = (i-1)*0.26; ctx.beginPath(); ctx.moveTo(cx, py + s*0.74); ctx.lineTo(cx + Math.sin(tf)*s*0.30, py + s*0.96); ctx.lineTo(cx + Math.sin(tf)*s*0.10, py + s*0.76); ctx.closePath(); ctx.fill(); }
        // Back of the head, no beak and no eyes
        ctx.fillStyle = '#b8a878';
        ctx.beginPath(); ctx.arc(cx, py + s*0.34, s*0.15, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#8a6a40';
        ctx.beginPath(); ctx.arc(cx, py + s*0.36, s*0.09, 0, Math.PI*2); ctx.fill();
        break;
      }
      if (facing !== 'down') {
        // Side, facing right: one wing, one eye, the beak forward, tail feathers behind.
        ctx.save();
        mirrorIfLeft(facing, cx);
        const rwfS = Math.sin(Date.now()/100 + phase)*0.28 + 1;
        // Far wing
        ctx.fillStyle = '#6a4f30';
        ctx.beginPath(); ctx.moveTo(cx - s*0.02, py + s*0.44); ctx.lineTo(px + s*0.16, py + s*0.14/rwfS); ctx.lineTo(px + s*0.36, py + s*0.30); ctx.lineTo(px + s*0.34, py + s*0.56); ctx.closePath(); ctx.fill();
        // Tail feathers behind
        ctx.fillStyle = '#6a4f30';
        ctx.beginPath(); ctx.moveTo(px + s*0.38, py + s*0.64); ctx.lineTo(px + s*0.02, py + s*0.76); ctx.lineTo(px + s*0.36, py + s*0.86); ctx.closePath(); ctx.fill();
        // Body in profile
        ctx.fillStyle = '#7a5c38';
        ctx.beginPath(); ctx.ellipse(px + s*0.54, py + s*0.62, s*0.16, s*0.26, 0, 0, Math.PI*2); ctx.fill();
        // Head with the beak jutting forward
        ctx.fillStyle = '#b8a878';
        ctx.beginPath(); ctx.arc(px + s*0.62, py + s*0.34, s*0.15, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#ffc23a';
        ctx.beginPath(); ctx.moveTo(px + s*0.72, py + s*0.30); ctx.lineTo(px + s*0.94, py + s*0.40); ctx.lineTo(px + s*0.72, py + s*0.48); ctx.closePath(); ctx.fill();
        // One eye
        ctx.fillStyle = '#ffcc33'; ctx.beginPath(); ctx.arc(px + s*0.66, py + s*0.32, s*0.04, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(px + s*0.67, py + s*0.32, s*0.02, 0, Math.PI*2); ctx.fill();
        // Near wing folded over the body, and the legs
        ctx.fillStyle = '#8a6a40';
        ctx.beginPath(); ctx.moveTo(px + s*0.54, py + s*0.46); ctx.lineTo(px + s*0.30, py + s*0.50); ctx.lineTo(px + s*0.46, py + s*0.74); ctx.lineTo(px + s*0.62, py + s*0.66); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffc23a';
        ctx.fillRect(px + s*0.50, py + s*0.86, s*0.08, s*0.10); ctx.fillRect(px + s*0.62, py + s*0.86, s*0.08, s*0.10);
        ctx.restore();
        break;
      }
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
      const facing = creatureFacing(e);
      if (facing === 'up') {
        // Back: the same figure over its whirlwind, turban and mantle, no face.
        if (e.boss) {
          const auraR2 = s*0.58 + Math.sin(Date.now()/220)*s*0.04;
          const aura2 = ctx.createRadialGradient(cx, cy, 0, cx, cy, auraR2);
          aura2.addColorStop(0, 'rgba(190,210,240,0.35)'); aura2.addColorStop(1, 'rgba(190,210,240,0)');
          ctx.fillStyle = aura2; ctx.fillRect(cx-auraR2, cy-auraR2, auraR2*2, auraR2*2);
        }
        // Vortex tail
        ctx.fillStyle = 'rgba(150,180,220,0.55)';
        ctx.beginPath();
        ctx.moveTo(px + s*0.34, py + s*0.56);
        ctx.quadraticCurveTo(px + s*0.10, py + s*0.78, cx + Math.sin(Date.now()/200+phase)*s*0.10, py + s*0.96);
        ctx.quadraticCurveTo(px + s*0.90, py + s*0.78, px + s*0.66, py + s*0.56);
        ctx.closePath(); ctx.fill();
        // Swirl lines, turning the other way seen from behind
        ctx.strokeStyle = 'rgba(220,235,250,0.6)'; ctx.lineWidth = Math.max(1.5, s*0.03);
        for (let i=0;i<3;i++){ ctx.beginPath(); ctx.ellipse(cx, py + s*0.70 + i*s*0.08, s*0.18 - i*s*0.04, s*0.05, -Math.sin(Date.now()/260+i)*0.4, 0, Math.PI*2); ctx.stroke(); }
        // Torso and the mantle across the shoulders
        ctx.fillStyle = '#9fb8d8';
        ctx.beginPath(); ctx.moveTo(px + s*0.30, py + s*0.58); ctx.lineTo(px + s*0.36, py + s*0.34); ctx.lineTo(px + s*0.64, py + s*0.34); ctx.lineTo(px + s*0.70, py + s*0.58); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#7f98b8';
        ctx.beginPath(); ctx.moveTo(px + s*0.26, py + s*0.42); ctx.lineTo(px + s*0.36, py + s*0.34); ctx.lineTo(px + s*0.64, py + s*0.34); ctx.lineTo(px + s*0.74, py + s*0.42); ctx.lineTo(px + s*0.68, py + s*0.62); ctx.lineTo(px + s*0.32, py + s*0.62); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#3a6ad0';
        ctx.fillRect(px + s*0.34, py + s*0.54, s*0.32, s*0.07);
        ctx.strokeStyle = '#b8cde6'; ctx.lineWidth = Math.max(2, s*0.03);
        ctx.beginPath(); ctx.moveTo(cx, py + s*0.38); ctx.lineTo(cx, py + s*0.54); ctx.stroke();
        // Arms crossed behind the back
        ctx.strokeStyle = '#9fb8d8'; ctx.lineWidth = Math.max(4, s*0.10); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(px + s*0.30, py + s*0.44); ctx.lineTo(px + s*0.58, py + s*0.54); ctx.moveTo(px + s*0.70, py + s*0.44); ctx.lineTo(px + s*0.42, py + s*0.54); ctx.stroke();
        // Head and turban from behind: no gem, no beard, no eyes
        ctx.fillStyle = '#b8cde6';
        ctx.beginPath(); ctx.arc(cx, py + s*0.24, s*0.15, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#3a6ad0';
        ctx.beginPath(); ctx.arc(cx, py + s*0.16, s*0.16, Math.PI, 0); ctx.fill();
        ctx.fillRect(px + s*0.36, py + s*0.14, s*0.28, s*0.06);
        ctx.beginPath(); ctx.arc(cx, py + s*0.22, s*0.05, 0, Math.PI*2); ctx.fill();
        break;
      }
      if (facing !== 'down') {
        // Side, facing right: the figure in profile, one eye, the beard and the gem forward.
        ctx.save();
        mirrorIfLeft(facing, cx);
        if (e.boss) {
          const auraR3 = s*0.58 + Math.sin(Date.now()/220)*s*0.04;
          const aura3 = ctx.createRadialGradient(cx, cy, 0, cx, cy, auraR3);
          aura3.addColorStop(0, 'rgba(190,210,240,0.35)'); aura3.addColorStop(1, 'rgba(190,210,240,0)');
          ctx.fillStyle = aura3; ctx.fillRect(cx-auraR3, cy-auraR3, auraR3*2, auraR3*2);
        }
        // Vortex tail sweeping behind
        ctx.fillStyle = 'rgba(150,180,220,0.55)';
        ctx.beginPath();
        ctx.moveTo(px + s*0.42, py + s*0.56);
        ctx.quadraticCurveTo(px + s*0.14, py + s*0.74 + Math.sin(Date.now()/200+phase)*s*0.06, px + s*0.06, py + s*0.94);
        ctx.quadraticCurveTo(px + s*0.74, py + s*0.80, px + s*0.66, py + s*0.56);
        ctx.closePath(); ctx.fill();
        // Swirl lines
        ctx.strokeStyle = 'rgba(220,235,250,0.6)'; ctx.lineWidth = Math.max(1.5, s*0.03);
        for (let i=0;i<3;i++){ ctx.beginPath(); ctx.ellipse(px + s*0.46, py + s*0.70 + i*s*0.08, s*0.18 - i*s*0.04, s*0.05, Math.sin(Date.now()/260+i)*0.4, 0, Math.PI*2); ctx.stroke(); }
        // Torso in profile
        ctx.fillStyle = '#9fb8d8';
        ctx.beginPath(); ctx.moveTo(px + s*0.38, py + s*0.58); ctx.lineTo(px + s*0.42, py + s*0.34); ctx.lineTo(px + s*0.64, py + s*0.34); ctx.lineTo(px + s*0.68, py + s*0.58); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#b8cde6';
        ctx.fillRect(px + s*0.50, py + s*0.34, s*0.12, s*0.24);
        // One arm reaching forward
        ctx.strokeStyle = '#9fb8d8'; ctx.lineWidth = Math.max(4, s*0.10); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(px + s*0.46, py + s*0.44); ctx.lineTo(px + s*0.68, py + s*0.54); ctx.stroke();
        // Head, turban, gem at the front of the band, beard at the jaw, one glowing eye
        ctx.fillStyle = '#b8cde6';
        ctx.beginPath(); ctx.arc(px + s*0.56, py + s*0.24, s*0.15, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#3a6ad0';
        ctx.beginPath(); ctx.arc(px + s*0.56, py + s*0.16, s*0.16, Math.PI, 0); ctx.fill();
        ctx.fillRect(px + s*0.42, py + s*0.14, s*0.28, s*0.06);
        ctx.fillStyle = `rgba(255,230,120,${0.7+flap*0.3})`;
        ctx.beginPath(); ctx.arc(px + s*0.68, py + s*0.15, s*0.04, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#dfe8f4'; ctx.fillRect(px + s*0.58, py + s*0.30, s*0.14, s*0.12);
        ctx.fillStyle = `rgba(220,245,255,${0.7+flap*0.3})`;
        ctx.fillRect(px + s*0.60, py + s*0.22, s*0.05, s*0.04);
        ctx.restore();
        break;
      }
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
