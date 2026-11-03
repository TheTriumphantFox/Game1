// Luminous creatures and their boss. Reached through ENEMY_ART (render-enemies.js),
// which also draws what every creature shares: shadow, auras, HP bar and name tag.

function drawLuminousCreature(e, ts, s, px, py, cx, cy, flap, phase, fb, bob, boxTop) {
  switch (e.type) {
    case 'pegasus': {
      const facing = creatureFacing(e);
      if (facing === 'up') {
        // Back: wings from behind, the rump, the tail, the back of the head with its ears.
        const pgfU = Math.sin(Date.now()/120 + phase)*0.2 + 1;
        ctx.fillStyle = '#e8eef8';
        ctx.beginPath(); ctx.moveTo(cx - s*0.06, py + s*0.52); ctx.lineTo(px + s*0.02, py + s*0.16/pgfU); ctx.lineTo(px + s*0.20, py + s*0.34); ctx.lineTo(px + s*0.24, py + s*0.60); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(cx + s*0.06, py + s*0.52); ctx.lineTo(px + s*0.98, py + s*0.16/pgfU); ctx.lineTo(px + s*0.80, py + s*0.34); ctx.lineTo(px + s*0.76, py + s*0.60); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffe89a';
        ctx.beginPath(); ctx.moveTo(cx - s*0.05, py + s*0.56); ctx.lineTo(cx + s*0.05, py + s*0.56); ctx.lineTo(cx + s*0.08, py + s*0.94); ctx.lineTo(cx - s*0.08, py + s*0.94); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#f4f6fb';
        ctx.beginPath(); ctx.ellipse(cx, py + s*0.60, s*0.21, s*0.22, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#e0e4ee';
        ctx.fillRect(cx - s*0.19, py + s*0.80, s*0.08, s*0.12); ctx.fillRect(cx + s*0.11, py + s*0.80, s*0.08, s*0.12);
        ctx.fillStyle = '#f4f6fb';
        ctx.beginPath(); ctx.moveTo(cx - s*0.07, py + s*0.50); ctx.lineTo(cx - s*0.05, py + s*0.34); ctx.lineTo(cx + s*0.05, py + s*0.34); ctx.lineTo(cx + s*0.07, py + s*0.50); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.ellipse(cx, py + s*0.28, s*0.12, s*0.12, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#ffe89a';
        ctx.beginPath(); ctx.moveTo(cx - s*0.05, py + s*0.41); ctx.lineTo(cx + s*0.05, py + s*0.41); ctx.lineTo(cx + s*0.03, py + s*0.50); ctx.lineTo(cx - s*0.03, py + s*0.50); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#e0e4ee'; ctx.lineWidth = Math.max(2, s*0.03);
        ctx.beginPath(); ctx.moveTo(cx, py + s*0.17); ctx.lineTo(cx, py + s*0.39); ctx.stroke();
        ctx.fillStyle = '#e0e4ee';
        ctx.beginPath(); ctx.moveTo(cx - s*0.10, py + s*0.22); ctx.lineTo(cx - s*0.15, py + s*0.09); ctx.lineTo(cx - s*0.02, py + s*0.17); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(cx + s*0.10, py + s*0.22); ctx.lineTo(cx + s*0.15, py + s*0.09); ctx.lineTo(cx + s*0.02, py + s*0.17); ctx.closePath(); ctx.fill();
        break;
      }
      if (facing !== 'down') {
        // Side. This was always the pegasus's only view, drawn facing right.
        ctx.save();
        mirrorIfLeft(facing, cx);
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
        ctx.restore();
        break;
      }
      // Front: wings spread wide, the face full-on with two eyes, ears and the forelock.
      const pgfD = Math.sin(Date.now()/120 + phase)*0.2 + 1;
      ctx.fillStyle = '#e8eef8';
      ctx.beginPath(); ctx.moveTo(cx - s*0.06, py + s*0.52); ctx.lineTo(px + s*0.02, py + s*0.16/pgfD); ctx.lineTo(px + s*0.20, py + s*0.34); ctx.lineTo(px + s*0.24, py + s*0.60); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + s*0.06, py + s*0.52); ctx.lineTo(px + s*0.98, py + s*0.16/pgfD); ctx.lineTo(px + s*0.80, py + s*0.34); ctx.lineTo(px + s*0.76, py + s*0.60); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.moveTo(cx - s*0.04, py + s*0.52); ctx.lineTo(px + s*0.12, py + s*0.26/pgfD); ctx.lineTo(px + s*0.24, py + s*0.44); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + s*0.04, py + s*0.52); ctx.lineTo(px + s*0.88, py + s*0.26/pgfD); ctx.lineTo(px + s*0.76, py + s*0.44); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#f4f6fb';
      ctx.beginPath(); ctx.ellipse(cx, py + s*0.64, s*0.18, s*0.22, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx - s*0.08, py + s*0.52); ctx.lineTo(cx - s*0.06, py + s*0.34); ctx.lineTo(cx + s*0.06, py + s*0.34); ctx.lineTo(cx + s*0.08, py + s*0.52); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx, py + s*0.28, s*0.12, s*0.13, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx, py + s*0.36, s*0.08, s*0.06, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#e0e4ee';
      ctx.beginPath(); ctx.moveTo(cx - s*0.10, py + s*0.20); ctx.lineTo(cx - s*0.14, py + s*0.08); ctx.lineTo(cx - s*0.02, py + s*0.16); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + s*0.10, py + s*0.20); ctx.lineTo(cx + s*0.14, py + s*0.08); ctx.lineTo(cx + s*0.02, py + s*0.16); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffe89a';
      ctx.beginPath(); ctx.moveTo(cx - s*0.05, py + s*0.17); ctx.lineTo(cx, py + s*0.10); ctx.lineTo(cx + s*0.05, py + s*0.17); ctx.lineTo(cx + s*0.02, py + s*0.27); ctx.lineTo(cx - s*0.02, py + s*0.27); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(cx - s*0.07, py + s*0.26, s*0.02, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + s*0.07, py + s*0.26, s*0.02, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#e0e4ee';
      ctx.fillRect(cx - s*0.12, py + s*0.78, s*0.07, s*0.14); ctx.fillRect(cx + s*0.05, py + s*0.78, s*0.07, s*0.14);
      break;
    }
    case 'couatl': {
      const facing = creatureFacing(e);
      if (facing === 'up') {
        // Back: the same wings from behind, the coil bending the other way, a feather ruff, no face.
        const cwU = Math.sin(Date.now()/110 + phase)*0.25 + 1;
        ctx.fillStyle = '#3aa0c0';
        ctx.beginPath(); ctx.moveTo(cx - s*0.04, py + s*0.44); ctx.lineTo(px + s*0.04, py + s*0.18/cwU); ctx.lineTo(px + s*0.24, py + s*0.34); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(cx + s*0.04, py + s*0.44); ctx.lineTo(px + s*0.96, py + s*0.18/cwU); ctx.lineTo(px + s*0.76, py + s*0.34); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#caa840';
        ctx.beginPath(); ctx.moveTo(cx + s*0.02, py + s*0.44); ctx.lineTo(px + s*0.86, py + s*0.28/cwU); ctx.lineTo(px + s*0.74, py + s*0.40); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#e0b84a'; ctx.lineWidth = Math.max(4, s*0.14); ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(px + s*0.70, py + s*0.88);
        ctx.quadraticCurveTo(px + s*0.26, py + s*0.78, px + s*0.48, py + s*0.56);
        ctx.quadraticCurveTo(px + s*0.66, py + s*0.40, cx, py + s*0.34);
        ctx.stroke();
        // Feather tufts along the spine of the coil
        ctx.fillStyle = '#caa840';
        [[0.66,0.82],[0.40,0.68],[0.56,0.48]].forEach(([fx,fy]) => { ctx.beginPath(); ctx.moveTo(px + s*fx, py + s*fy); ctx.lineTo(px + s*(fx+0.10), py + s*(fy-0.10)); ctx.lineTo(px + s*(fx+0.12), py + s*(fy+0.06)); ctx.closePath(); ctx.fill(); });
        // Back of the head in a feather ruff, plus the halo arc
        ctx.fillStyle = '#f0cc5a';
        ctx.beginPath(); ctx.arc(cx, py + s*0.30, s*0.13, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#caa840';
        for (let i=0;i<7;i++){ const pf = Math.PI*2*i/7 - Math.PI/2; ctx.beginPath(); ctx.moveTo(cx + Math.cos(pf)*s*0.05, py + s*(0.30 + Math.sin(pf)*0.05)); ctx.lineTo(cx + Math.cos(pf-0.30)*s*0.23, py + s*(0.30 + Math.sin(pf-0.30)*0.23)); ctx.lineTo(cx + Math.cos(pf+0.30)*s*0.23, py + s*(0.30 + Math.sin(pf+0.30)*0.23)); ctx.closePath(); ctx.fill(); }
        ctx.strokeStyle = `rgba(255,240,160,${0.4+flap*0.3})`; ctx.lineWidth = Math.max(1.5, s*0.03);
        ctx.beginPath(); ctx.arc(cx, py + s*0.22, s*0.18, Math.PI*1.1, Math.PI*1.9); ctx.stroke();
        break;
      }
      if (facing !== 'down') {
        // Side, drawn facing right: one eye, the jaw forward, one wing over the coil.
        ctx.save();
        mirrorIfLeft(facing, cx);
        const cwS = Math.sin(Date.now()/110 + phase)*0.25 + 1;
        // Far wing behind the body
        ctx.fillStyle = '#3aa0c0';
        ctx.beginPath(); ctx.moveTo(cx - s*0.02, py + s*0.44); ctx.lineTo(px + s*0.16, py + s*0.18/cwS); ctx.lineTo(px + s*0.36, py + s*0.36); ctx.closePath(); ctx.fill();
        // Coil in profile, rising to the head
        ctx.strokeStyle = '#e0b84a'; ctx.lineWidth = Math.max(4, s*0.14); ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(px + s*0.18, py + s*0.88);
        ctx.quadraticCurveTo(px + s*0.48, py + s*0.80, px + s*0.36, py + s*0.62);
        ctx.quadraticCurveTo(px + s*0.28, py + s*0.42, px + s*0.58, py + s*0.32);
        ctx.stroke();
        // Head with the jaw jutting right
        ctx.fillStyle = '#f0cc5a';
        ctx.beginPath(); ctx.arc(px + s*0.62, py + s*0.30, s*0.13, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(px + s*0.70, py + s*0.26); ctx.lineTo(px + s*0.86, py + s*0.32); ctx.lineTo(px + s*0.70, py + s*0.38); ctx.closePath(); ctx.fill();
        // One glowing eye
        ctx.fillStyle = `rgba(255,250,200,${0.7+flap*0.3})`;
        ctx.fillRect(px + s*0.64, py + s*0.27, s*0.05, s*0.04);
        // Near wing folded over the coil
        ctx.fillStyle = '#caa840';
        ctx.beginPath(); ctx.moveTo(px + s*0.42, py + s*0.48); ctx.lineTo(px + s*0.22, py + s*0.30/cwS); ctx.lineTo(px + s*0.46, py + s*0.36); ctx.closePath(); ctx.fill();
        // Halo arc
        ctx.strokeStyle = `rgba(255,240,160,${0.4+flap*0.3})`; ctx.lineWidth = Math.max(1.5, s*0.03);
        ctx.beginPath(); ctx.arc(px + s*0.60, py + s*0.22, s*0.17, Math.PI*1.1, Math.PI*1.9); ctx.stroke();
        ctx.restore();
        break;
      }
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
      const facing = creatureFacing(e);
      if (facing === 'up') {
        // Back: rump and tail, the back of the head with its ears and the horn above it.
        ctx.fillStyle = '#ffd0e0';
        ctx.beginPath(); ctx.moveTo(cx - s*0.05, py + s*0.56); ctx.lineTo(cx + s*0.05, py + s*0.56); ctx.lineTo(cx + s*0.08, py + s*0.94); ctx.lineTo(cx - s*0.08, py + s*0.94); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#f6f4fa';
        ctx.beginPath(); ctx.ellipse(cx, py + s*0.60, s*0.21, s*0.22, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#e6e2ee';
        ctx.fillRect(cx - s*0.19, py + s*0.80, s*0.08, s*0.12); ctx.fillRect(cx + s*0.11, py + s*0.80, s*0.08, s*0.12);
        ctx.fillStyle = '#f6f4fa';
        ctx.beginPath(); ctx.moveTo(cx - s*0.07, py + s*0.50); ctx.lineTo(cx - s*0.05, py + s*0.34); ctx.lineTo(cx + s*0.05, py + s*0.34); ctx.lineTo(cx + s*0.07, py + s*0.50); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.ellipse(cx, py + s*0.28, s*0.12, s*0.12, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#ffd0e0';
        ctx.beginPath(); ctx.moveTo(cx - s*0.05, py + s*0.41); ctx.lineTo(cx + s*0.05, py + s*0.41); ctx.lineTo(cx + s*0.03, py + s*0.50); ctx.lineTo(cx - s*0.03, py + s*0.50); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#e6e2ee'; ctx.lineWidth = Math.max(2, s*0.03);
        ctx.beginPath(); ctx.moveTo(cx, py + s*0.17); ctx.lineTo(cx, py + s*0.39); ctx.stroke();
        ctx.fillStyle = '#e6e2ee';
        ctx.beginPath(); ctx.moveTo(cx - s*0.10, py + s*0.22); ctx.lineTo(cx - s*0.15, py + s*0.09); ctx.lineTo(cx - s*0.02, py + s*0.17); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(cx + s*0.10, py + s*0.22); ctx.lineTo(cx + s*0.15, py + s*0.09); ctx.lineTo(cx + s*0.02, py + s*0.17); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = `rgba(255,240,170,${0.7+flap*0.3})`; ctx.lineWidth = Math.max(2, s*0.05);
        ctx.beginPath(); ctx.moveTo(cx, py + s*0.16); ctx.lineTo(cx, py + s*0.04); ctx.stroke();
        ctx.fillStyle = '#fff4c0';
        ctx.beginPath(); ctx.arc(cx, py + s*0.04, s*0.03, 0, Math.PI*2); ctx.fill();
        break;
      }
      if (facing !== 'down') {
        // Side. This was always the unicorn's only view, drawn facing right.
        ctx.save();
        mirrorIfLeft(facing, cx);
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
        ctx.restore();
        break;
      }
      // Front: the horn straight up over the face, two eyes, ears and the mane at both sides.
      ctx.fillStyle = '#f6f4fa';
      ctx.beginPath(); ctx.ellipse(cx, py + s*0.64, s*0.18, s*0.22, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx - s*0.08, py + s*0.52); ctx.lineTo(cx - s*0.06, py + s*0.34); ctx.lineTo(cx + s*0.06, py + s*0.34); ctx.lineTo(cx + s*0.08, py + s*0.52); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx, py + s*0.28, s*0.12, s*0.13, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx, py + s*0.36, s*0.08, s*0.06, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#ffd0e0';
      ctx.beginPath(); ctx.moveTo(cx - s*0.13, py + s*0.20); ctx.lineTo(cx - s*0.19, py + s*0.40); ctx.lineTo(cx - s*0.09, py + s*0.40); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + s*0.13, py + s*0.20); ctx.lineTo(cx + s*0.19, py + s*0.40); ctx.lineTo(cx + s*0.09, py + s*0.40); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#e6e2ee';
      ctx.beginPath(); ctx.moveTo(cx - s*0.10, py + s*0.20); ctx.lineTo(cx - s*0.14, py + s*0.08); ctx.lineTo(cx - s*0.02, py + s*0.16); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + s*0.10, py + s*0.20); ctx.lineTo(cx + s*0.14, py + s*0.08); ctx.lineTo(cx + s*0.02, py + s*0.16); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = `rgba(255,240,170,${0.7+flap*0.3})`; ctx.lineWidth = Math.max(2, s*0.05);
      ctx.beginPath(); ctx.moveTo(cx, py + s*0.18); ctx.lineTo(cx, py + s*0.02); ctx.stroke();
      ctx.fillStyle = '#fff4c0';
      ctx.beginPath(); ctx.arc(cx, py + s*0.02, s*0.03, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#5a3aaa';
      ctx.beginPath(); ctx.arc(cx - s*0.07, py + s*0.26, s*0.025, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + s*0.07, py + s*0.26, s*0.025, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#e6e2ee';
      ctx.fillRect(cx - s*0.12, py + s*0.78, s*0.07, s*0.14); ctx.fillRect(cx + s*0.05, py + s*0.78, s*0.07, s*0.14);
      break;
    }
    case 'ki_rin': {
      const facing = creatureFacing(e);
      if (facing === 'up') {
        // Back: the same glow, the coil bending the other way, a flame crest down the back, no face.
        const kgaU = ctx.createRadialGradient(cx, cy, 0, cx, cy, s*0.5);
        kgaU.addColorStop(0, `rgba(255,230,140,${0.25+flap*0.2})`);
        kgaU.addColorStop(1, 'rgba(255,230,140,0)');
        ctx.fillStyle = kgaU; ctx.fillRect(fb.x - s*0.1, fb.y - s*0.1, s*1.2, s*1.2);
        ctx.strokeStyle = '#e8c24a'; ctx.lineWidth = Math.max(4, s*0.15); ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx + s*0.12, py + s*0.86);
        ctx.quadraticCurveTo(cx - s*0.14, py + s*0.74, cx + s*0.04, py + s*0.52);
        ctx.quadraticCurveTo(cx + s*0.10, py + s*0.36, cx, py + s*0.30);
        ctx.stroke();
        // Flame crest down the spine
        ctx.fillStyle = '#ffae3a';
        [[0.02,0.76],[-0.06,0.60],[0.02,0.44]].forEach(([ox,fy]) => { ctx.beginPath(); ctx.moveTo(cx + s*ox, py + s*fy); ctx.lineTo(cx + s*(ox-0.12), py + s*(fy-0.05)); ctx.lineTo(cx + s*(ox+0.02), py + s*(fy+0.08)); ctx.closePath(); ctx.fill(); });
        // Back of the head: crown tuft, seam and both antlers
        ctx.fillStyle = '#f4cc5a';
        ctx.beginPath(); ctx.arc(cx, py + s*0.26, s*0.13, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#ffae3a';
        [[-0.06,0.16],[0.0,0.13],[0.06,0.16]].forEach(([ox,fy]) => { ctx.beginPath(); ctx.moveTo(cx + s*ox, py + s*fy); ctx.lineTo(cx + s*(ox+0.03), py + s*(fy-0.10)); ctx.lineTo(cx + s*(ox+0.07), py + s*fy); ctx.closePath(); ctx.fill(); });
        ctx.strokeStyle = '#e8c24a'; ctx.lineWidth = Math.max(2, s*0.03);
        ctx.beginPath(); ctx.moveTo(cx, py + s*0.15); ctx.lineTo(cx, py + s*0.38); ctx.stroke();
        ctx.strokeStyle = '#caa030'; ctx.lineWidth = Math.max(2, s*0.04);
        ctx.beginPath(); ctx.moveTo(cx - s*0.06, py + s*0.16); ctx.lineTo(cx - s*0.12, py + s*0.04); ctx.moveTo(cx + s*0.06, py + s*0.16); ctx.lineTo(cx + s*0.12, py + s*0.04); ctx.stroke();
        break;
      }
      if (facing !== 'down') {
        // Side, drawn facing right: one eye, the muzzle forward, one antler showing.
        ctx.save();
        mirrorIfLeft(facing, cx);
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
        ctx.restore();
        break;
      }
      // Front: the head full-on with both antlers, the flame-mane on both sides, the glow.
      const kgaF = ctx.createRadialGradient(cx, cy, 0, cx, cy, s*0.5);
      kgaF.addColorStop(0, `rgba(255,230,140,${0.25+flap*0.2})`);
      kgaF.addColorStop(1, 'rgba(255,230,140,0)');
      ctx.fillStyle = kgaF; ctx.fillRect(fb.x - s*0.1, fb.y - s*0.1, s*1.2, s*1.2);
      ctx.strokeStyle = '#e8c24a'; ctx.lineWidth = Math.max(4, s*0.15); ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - s*0.12, py + s*0.86);
      ctx.quadraticCurveTo(cx + s*0.14, py + s*0.74, cx - s*0.02, py + s*0.52);
      ctx.quadraticCurveTo(cx - s*0.08, py + s*0.38, cx, py + s*0.32);
      ctx.stroke();
      // Flame-mane on both sides
      ctx.fillStyle = '#ffae3a';
      [[-1,-0.12,-0.24],[1,0.12,0.24]].forEach(([sg,ox,ox2]) => { [0.74,0.58].forEach(fy => { ctx.beginPath(); ctx.moveTo(cx + s*ox, py + s*fy); ctx.lineTo(cx + s*ox2, py + s*(fy-0.05)); ctx.lineTo(cx + s*ox, py + s*(fy+0.08)); ctx.closePath(); ctx.fill(); }); });
      // Head, muzzle, both eyes
      ctx.fillStyle = '#f4cc5a';
      ctx.beginPath(); ctx.arc(cx, py + s*0.28, s*0.14, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx, py + s*0.36, s*0.08, s*0.05, 0, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#caa030'; ctx.lineWidth = Math.max(2, s*0.04);
      ctx.beginPath(); ctx.moveTo(cx - s*0.06, py + s*0.16); ctx.lineTo(cx - s*0.12, py + s*0.04); ctx.moveTo(cx + s*0.06, py + s*0.16); ctx.lineTo(cx + s*0.12, py + s*0.04); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,220,0.9)'; ctx.fillRect(cx - s*0.10, py + s*0.25, s*0.05, s*0.04); ctx.fillRect(cx + s*0.05, py + s*0.25, s*0.05, s*0.04);
      ctx.fillStyle = '#000'; ctx.fillRect(cx - s*0.085, py + s*0.26, s*0.02, s*0.03); ctx.fillRect(cx + s*0.065, py + s*0.26, s*0.02, s*0.03);
      break;
    }
    case 'deva': {
      const facing = creatureFacing(e);
      if (facing === 'up') {
        // Back: wings spread, the robe and sash from behind, hair down the back, no face.
        const dvfU = Math.sin(Date.now()/130 + phase)*0.15 + 1;
        ctx.fillStyle = '#f2f4fa';
        ctx.beginPath(); ctx.moveTo(cx - s*0.06, py + s*0.40); ctx.lineTo(px + s*0.02, py + s*0.14/dvfU); ctx.lineTo(px + s*0.10, py + s*0.26); ctx.lineTo(px + s*0.16, py + s*0.40); ctx.lineTo(px + s*0.10, py + s*0.56); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(cx + s*0.06, py + s*0.40); ctx.lineTo(px + s*0.98, py + s*0.14/dvfU); ctx.lineTo(px + s*0.90, py + s*0.26); ctx.lineTo(px + s*0.84, py + s*0.40); ctx.lineTo(px + s*0.90, py + s*0.56); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#e6ecf6';
        ctx.beginPath(); ctx.moveTo(px + s*0.34, py + s*0.40); ctx.lineTo(px + s*0.66, py + s*0.40); ctx.lineTo(px + s*0.74, py + s*0.90); ctx.lineTo(px + s*0.26, py + s*0.90); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffd86a'; ctx.fillRect(px + s*0.34, py + s*0.56, s*0.32, s*0.05);
        ctx.strokeStyle = '#cfd8e6'; ctx.lineWidth = Math.max(2, s*0.03);
        ctx.beginPath(); ctx.moveTo(cx, py + s*0.42); ctx.lineTo(cx, py + s*0.88); ctx.stroke();
        // Hair over the back of the head
        ctx.fillStyle = '#c8a888';
        ctx.beginPath(); ctx.moveTo(cx - s*0.16, py + s*0.50); ctx.lineTo(cx - s*0.15, py + s*0.24); ctx.quadraticCurveTo(cx, py + s*0.12, cx + s*0.15, py + s*0.24); ctx.lineTo(cx + s*0.16, py + s*0.50); ctx.lineTo(cx + s*0.08, py + s*0.44); ctx.lineTo(cx, py + s*0.52); ctx.lineTo(cx - s*0.08, py + s*0.44); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = `rgba(255,240,150,${0.6+flap*0.4})`; ctx.lineWidth = Math.max(2, s*0.04);
        ctx.beginPath(); ctx.arc(cx, py + s*0.14, s*0.12, 0, Math.PI*2); ctx.stroke();
        break;
      }
      if (facing !== 'down') {
        // Side, drawn facing right: one eye, the nose forward, hair in a bun, one wing over the robe.
        ctx.save();
        mirrorIfLeft(facing, cx);
        const dvfS = Math.sin(Date.now()/130 + phase)*0.15 + 1;
        ctx.fillStyle = '#f2f4fa';
        ctx.beginPath(); ctx.moveTo(cx - s*0.02, py + s*0.40); ctx.lineTo(px + s*0.12, py + s*0.14/dvfS); ctx.lineTo(px + s*0.24, py + s*0.28); ctx.lineTo(px + s*0.22, py + s*0.56); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#e6ecf6';
        ctx.beginPath(); ctx.moveTo(px + s*0.42, py + s*0.40); ctx.lineTo(px + s*0.62, py + s*0.40); ctx.lineTo(px + s*0.68, py + s*0.90); ctx.lineTo(px + s*0.36, py + s*0.90); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffd86a'; ctx.fillRect(px + s*0.40, py + s*0.56, s*0.26, s*0.05);
        ctx.fillStyle = '#f2f4fa';
        ctx.beginPath(); ctx.moveTo(px + s*0.52, py + s*0.44); ctx.lineTo(px + s*0.32, py + s*0.28/dvfS); ctx.lineTo(px + s*0.46, py + s*0.42); ctx.lineTo(px + s*0.54, py + s*0.62); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#c8a888';
        ctx.beginPath(); ctx.arc(px + s*0.44, py + s*0.26, s*0.11, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(px + s*0.34, py + s*0.32, s*0.07, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#f0d8c0';
        ctx.beginPath(); ctx.arc(px + s*0.56, py + s*0.30, s*0.13, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(px + s*0.66, py + s*0.28); ctx.lineTo(px + s*0.74, py + s*0.33); ctx.lineTo(px + s*0.66, py + s*0.37); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(180,210,255,0.9)'; ctx.fillRect(px + s*0.60, py + s*0.28, s*0.04, s*0.03);
        ctx.strokeStyle = `rgba(255,240,150,${0.6+flap*0.4})`; ctx.lineWidth = Math.max(2, s*0.04);
        ctx.beginPath(); ctx.arc(px + s*0.54, py + s*0.12, s*0.12, 0, Math.PI*2); ctx.stroke();
        ctx.restore();
        break;
      }
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
      const facing = creatureFacing(e);
      if (facing === 'up') {
        // Back: the radiance, wings spread, the robe from behind, hair, the sword on the far hand.
        const plfU = Math.sin(Date.now()/130 + phase)*0.15 + 1;
        const plaU = ctx.createRadialGradient(cx, cy, 0, cx, cy, s*0.55);
        plaU.addColorStop(0, `rgba(255,250,210,${0.25+flap*0.2})`);
        plaU.addColorStop(1, 'rgba(255,250,210,0)');
        ctx.fillStyle = plaU; ctx.fillRect(fb.x - s*0.1, fb.y - s*0.1, s*1.2, s*1.2);
        ctx.fillStyle = '#fbfcff';
        ctx.beginPath(); ctx.moveTo(cx - s*0.06, py + s*0.38); ctx.lineTo(px - s*0.02, py + s*0.10/plfU); ctx.lineTo(px + s*0.12, py + s*0.24); ctx.lineTo(px + s*0.16, py + s*0.40); ctx.lineTo(px + s*0.08, py + s*0.58); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(cx + s*0.06, py + s*0.38); ctx.lineTo(px + s*1.02, py + s*0.10/plfU); ctx.lineTo(px + s*0.88, py + s*0.24); ctx.lineTo(px + s*0.84, py + s*0.40); ctx.lineTo(px + s*0.92, py + s*0.58); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#dfe8f2';
        ctx.beginPath(); ctx.moveTo(px + s*0.34, py + s*0.40); ctx.lineTo(px + s*0.66, py + s*0.40); ctx.lineTo(px + s*0.72, py + s*0.90); ctx.lineTo(px + s*0.28, py + s*0.90); ctx.closePath(); ctx.fill();
        ctx.fillStyle = `rgba(255,250,200,${0.7+flap*0.3})`;
        ctx.fillRect(px + s*0.21, py + s*0.36, s*0.05, s*0.52);
        ctx.fillStyle = '#ffd86a'; ctx.fillRect(px + s*0.17, py + s*0.36, s*0.13, s*0.04);
        // Hair down the back of the head, no face
        ctx.fillStyle = '#7ea874';
        ctx.beginPath(); ctx.moveTo(cx - s*0.16, py + s*0.48); ctx.lineTo(cx - s*0.15, py + s*0.22); ctx.quadraticCurveTo(cx, py + s*0.10, cx + s*0.15, py + s*0.22); ctx.lineTo(cx + s*0.16, py + s*0.48); ctx.lineTo(cx + s*0.08, py + s*0.42); ctx.lineTo(cx, py + s*0.50); ctx.lineTo(cx - s*0.08, py + s*0.42); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = `rgba(255,245,170,${0.7+flap*0.3})`; ctx.lineWidth = Math.max(2, s*0.05);
        ctx.beginPath(); ctx.arc(cx, py + s*0.12, s*0.13, 0, Math.PI*2); ctx.stroke();
        break;
      }
      if (facing !== 'down') {
        // Side, drawn facing right: one glowing eye, the greatsword held forward, one wing.
        ctx.save();
        mirrorIfLeft(facing, cx);
        const plfS = Math.sin(Date.now()/130 + phase)*0.15 + 1;
        const plaS = ctx.createRadialGradient(cx, cy, 0, cx, cy, s*0.55);
        plaS.addColorStop(0, `rgba(255,250,210,${0.25+flap*0.2})`);
        plaS.addColorStop(1, 'rgba(255,250,210,0)');
        ctx.fillStyle = plaS; ctx.fillRect(fb.x - s*0.1, fb.y - s*0.1, s*1.2, s*1.2);
        ctx.fillStyle = '#fbfcff';
        ctx.beginPath(); ctx.moveTo(cx - s*0.02, py + s*0.38); ctx.lineTo(px + s*0.10, py + s*0.10/plfS); ctx.lineTo(px + s*0.24, py + s*0.26); ctx.lineTo(px + s*0.22, py + s*0.58); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#dfe8f2';
        ctx.beginPath(); ctx.moveTo(px + s*0.40, py + s*0.40); ctx.lineTo(px + s*0.62, py + s*0.40); ctx.lineTo(px + s*0.68, py + s*0.90); ctx.lineTo(px + s*0.34, py + s*0.90); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#fbfcff';
        ctx.beginPath(); ctx.moveTo(px + s*0.52, py + s*0.42); ctx.lineTo(px + s*0.30, py + s*0.24/plfS); ctx.lineTo(px + s*0.46, py + s*0.40); ctx.lineTo(px + s*0.56, py + s*0.62); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#7ea874';
        ctx.beginPath(); ctx.arc(px + s*0.44, py + s*0.24, s*0.11, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(px + s*0.34, py + s*0.30, s*0.07, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#a8d0a0';
        ctx.beginPath(); ctx.arc(px + s*0.56, py + s*0.28, s*0.13, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(px + s*0.66, py + s*0.26); ctx.lineTo(px + s*0.74, py + s*0.31); ctx.lineTo(px + s*0.66, py + s*0.35); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.fillRect(px + s*0.60, py + s*0.26, s*0.04, s*0.03);
        ctx.fillStyle = `rgba(255,250,200,${0.7+flap*0.3})`;
        ctx.fillRect(px + s*0.72, py + s*0.36, s*0.05, s*0.52);
        ctx.fillStyle = '#ffd86a'; ctx.fillRect(px + s*0.68, py + s*0.36, s*0.13, s*0.04);
        ctx.strokeStyle = `rgba(255,245,170,${0.7+flap*0.3})`; ctx.lineWidth = Math.max(2, s*0.05);
        ctx.beginPath(); ctx.arc(px + s*0.54, py + s*0.10, s*0.13, 0, Math.PI*2); ctx.stroke();
        ctx.restore();
        break;
      }
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
      const facing = creatureFacing(e);
      if (facing === 'up') {
        // Back: six wings spread, the robe from behind, radiant hair, no face, no sword.
        const swfU = Math.sin(Date.now()/150 + phase)*0.12 + 1;
        ctx.fillStyle = '#fbf6e0';
        [[0.20,0.18],[0.14,0.40],[0.20,0.62]].forEach(([wx,wy]) => {
          ctx.beginPath(); ctx.moveTo(cx - s*0.04, py + s*(wy+0.06)); ctx.lineTo(px + s*(wx-0.06), py + s*wy/swfU); ctx.lineTo(px + s*(wx+0.10), py + s*(wy+0.10)); ctx.closePath(); ctx.fill();
          ctx.beginPath(); ctx.moveTo(cx + s*0.04, py + s*(wy+0.06)); ctx.lineTo(px + s*(1-wx+0.06), py + s*wy/swfU); ctx.lineTo(px + s*(1-wx-0.10), py + s*(wy+0.10)); ctx.closePath(); ctx.fill();
        });
        ctx.fillStyle = '#fff4d0';
        ctx.beginPath(); ctx.moveTo(px + s*0.36, py + s*0.40); ctx.lineTo(px + s*0.64, py + s*0.40); ctx.lineTo(px + s*0.72, py + s*0.90); ctx.lineTo(px + s*0.28, py + s*0.90); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffe08a'; ctx.fillRect(px + s*0.36, py + s*0.56, s*0.28, s*0.05);
        ctx.strokeStyle = '#e8d8a8'; ctx.lineWidth = Math.max(2, s*0.03);
        ctx.beginPath(); ctx.moveTo(cx, py + s*0.42); ctx.lineTo(cx, py + s*0.88); ctx.stroke();
        // Hair down the back of the head
        ctx.fillStyle = '#e8c878';
        ctx.beginPath(); ctx.moveTo(cx - s*0.16, py + s*0.48); ctx.lineTo(cx - s*0.15, py + s*0.22); ctx.quadraticCurveTo(cx, py + s*0.10, cx + s*0.15, py + s*0.22); ctx.lineTo(cx + s*0.16, py + s*0.48); ctx.lineTo(cx + s*0.08, py + s*0.42); ctx.lineTo(cx, py + s*0.50); ctx.lineTo(cx - s*0.08, py + s*0.42); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = `rgba(255,235,140,${0.7+flap*0.3})`; ctx.lineWidth = Math.max(2, s*0.05);
        ctx.beginPath(); ctx.arc(cx, py + s*0.10, s*0.13, 0, Math.PI*2); ctx.stroke();
        break;
      }
      if (facing !== 'down') {
        // Side, drawn facing right: one blazing eye, three wings on the near side, the sword forward.
        ctx.save();
        mirrorIfLeft(facing, cx);
        const swfS = Math.sin(Date.now()/150 + phase)*0.12 + 1;
        ctx.fillStyle = '#fbf6e0';
        [[0.30,0.20],[0.24,0.42],[0.28,0.62]].forEach(([wx,wy]) => {
          ctx.beginPath(); ctx.moveTo(px + s*0.50, py + s*(wy+0.06)); ctx.lineTo(px + s*(wx-0.10), py + s*wy/swfS); ctx.lineTo(px + s*(wx+0.06), py + s*(wy+0.12)); ctx.closePath(); ctx.fill();
        });
        ctx.fillStyle = '#fff4d0';
        ctx.beginPath(); ctx.moveTo(px + s*0.42, py + s*0.40); ctx.lineTo(px + s*0.62, py + s*0.40); ctx.lineTo(px + s*0.68, py + s*0.90); ctx.lineTo(px + s*0.36, py + s*0.90); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffe08a'; ctx.fillRect(px + s*0.40, py + s*0.56, s*0.26, s*0.05);
        ctx.fillStyle = '#e8c878';
        ctx.beginPath(); ctx.arc(px + s*0.45, py + s*0.24, s*0.10, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(px + s*0.36, py + s*0.30, s*0.07, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fff0c0';
        ctx.beginPath(); ctx.arc(px + s*0.56, py + s*0.28, s*0.12, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(px + s*0.66, py + s*0.26); ctx.lineTo(px + s*0.73, py + s*0.31); ctx.lineTo(px + s*0.66, py + s*0.35); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.fillRect(px + s*0.60, py + s*0.26, s*0.04, s*0.04);
        ctx.fillStyle = `rgba(255,250,210,${0.8+flap*0.2})`;
        ctx.fillRect(px + s*0.66, py + s*0.44, s*0.05, s*0.46);
        ctx.fillStyle = '#ffd86a'; ctx.fillRect(px + s*0.62, py + s*0.44, s*0.16, s*0.04);
        ctx.strokeStyle = `rgba(255,235,140,${0.7+flap*0.3})`; ctx.lineWidth = Math.max(2, s*0.05);
        ctx.beginPath(); ctx.arc(px + s*0.54, py + s*0.10, s*0.13, 0, Math.PI*2); ctx.stroke();
        ctx.restore();
        break;
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
