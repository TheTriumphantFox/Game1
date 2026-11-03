// Lightning creatures and their boss. Reached through ENEMY_ART (render-enemies.js),
// which also draws what every creature shares: shadow, auras, HP bar and name tag.

function drawLightningCreature(e, ts, s, px, py, cx, cy, flap, phase, fb, bob, boxTop) {
  switch (e.type) {
    case 'will_o_wisp': {
      // Outer glow
      const wg = ctx.createRadialGradient(cx, cy, 0, cx, cy, s*0.5);
      wg.addColorStop(0, `rgba(200,255,120,${0.6+flap*0.3})`);
      wg.addColorStop(1, 'rgba(180,255,80,0)');
      ctx.fillStyle = wg; ctx.fillRect(fb.x - s*0.1, fb.y - s*0.1, s*1.2, s*1.2);
      // Electric tendrils
      ctx.strokeStyle = `rgba(230,255,160,${0.5+flap*0.5})`; ctx.lineWidth = Math.max(1.5, s*0.03);
      for (let i=0;i<4;i++){ const a = Date.now()/200 + i*Math.PI/2 + phase; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a)*s*0.34, cy + Math.sin(a)*s*0.34 + Math.sin(Date.now()/90+i)*s*0.04); ctx.stroke(); }
      // Core
      ctx.fillStyle = '#eaffc0';
      ctx.beginPath(); ctx.arc(cx, cy, s*0.16, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(cx - s*0.03, cy - s*0.03, s*0.07, 0, Math.PI*2); ctx.fill();
      break;
    }
    case 'blue_wyrmling': {
      const facing = creatureFacing(e);
      if (facing === 'up') {
        // Back: wings spread, the back of the head with ear frills, a chevron spine, a tail.
        const ubf = Math.sin(Date.now()/120 + phase)*0.2 + 1;
        ctx.fillStyle = '#2f6aaa';
        ctx.beginPath(); ctx.moveTo(px + s*0.06, py + s*0.42/ubf); ctx.lineTo(px + s*0.46, py + s*0.42); ctx.lineTo(px + s*0.30, py + s*0.60); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(px + s*0.94, py + s*0.42/ubf); ctx.lineTo(px + s*0.54, py + s*0.42); ctx.lineTo(px + s*0.70, py + s*0.60); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#3a82cc'; ctx.lineWidth = Math.max(2, s*0.06);
        ctx.beginPath(); ctx.moveTo(cx, py + s*0.76); ctx.lineTo(cx + Math.sin(Date.now()/180 + phase)*s*0.18, py + s*0.98); ctx.stroke();
        ctx.fillStyle = '#3a82cc';
        ctx.beginPath(); ctx.ellipse(cx, py + s*0.56, s*0.20, s*0.26, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#2f6aaa';
        [0.44,0.54,0.64].forEach(fy => { ctx.beginPath(); ctx.moveTo(cx - s*0.05, py + s*(fy+0.05)); ctx.lineTo(cx, py + s*(fy-0.02)); ctx.lineTo(cx + s*0.05, py + s*(fy+0.05)); ctx.closePath(); ctx.fill(); });
        ctx.fillStyle = '#4a92dd';
        ctx.beginPath(); ctx.arc(cx, py + s*0.30, s*0.16, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#2f6aaa';
        ctx.beginPath(); ctx.moveTo(cx - s*0.13, py + s*0.24); ctx.lineTo(cx - s*0.24, py + s*0.16); ctx.lineTo(cx - s*0.09, py + s*0.36); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(cx + s*0.13, py + s*0.24); ctx.lineTo(cx + s*0.24, py + s*0.16); ctx.lineTo(cx + s*0.09, py + s*0.36); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#2f6aaa'; ctx.lineWidth = Math.max(1.5, s*0.03);
        ctx.beginPath(); ctx.moveTo(cx, py + s*0.16); ctx.lineTo(cx, py + s*0.44); ctx.stroke();
        break;
      }
      if (facing !== 'down') {
        // Side, drawn facing right: one eye, snout and horn forward, one wing, tail behind.
        ctx.save();
        mirrorIfLeft(facing, cx);
        const wbf = Math.sin(Date.now()/120 + phase)*0.2 + 1;
        ctx.strokeStyle = '#3a82cc'; ctx.lineWidth = Math.max(2, s*0.06);
        ctx.beginPath(); ctx.moveTo(px + s*0.38, py + s*0.70); ctx.lineTo(px + s*0.16 + Math.sin(Date.now()/180 + phase)*s*0.06, py + s*0.94); ctx.stroke();
        ctx.fillStyle = '#245a90';
        ctx.beginPath(); ctx.moveTo(px + s*0.28, py + s*0.34/wbf); ctx.lineTo(px + s*0.50, py + s*0.40); ctx.lineTo(px + s*0.32, py + s*0.56); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#3a82cc';
        ctx.beginPath(); ctx.ellipse(cx - s*0.04, py + s*0.56, s*0.16, s*0.26, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#2f6aaa';
        ctx.beginPath(); ctx.moveTo(px + s*0.40, py + s*0.42/wbf); ctx.lineTo(px + s*0.64, py + s*0.44); ctx.lineTo(px + s*0.44, py + s*0.66); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#4a92dd';
        ctx.beginPath(); ctx.arc(px + s*0.62, py + s*0.32, s*0.15, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(px + s*0.66, py + s*0.26); ctx.lineTo(px + s*0.82, py + s*0.33); ctx.lineTo(px + s*0.66, py + s*0.40); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#dfeeff';
        ctx.beginPath(); ctx.moveTo(px + s*0.72, py + s*0.26); ctx.lineTo(px + s*0.76, py + s*0.10); ctx.lineTo(px + s*0.79, py + s*0.27); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffee44'; ctx.fillRect(px + s*0.62, py + s*0.28, s*0.05, s*0.04);
        ctx.fillStyle = '#000'; ctx.fillRect(px + s*0.64, py + s*0.29, s*0.02, s*0.03);
        ctx.strokeStyle = `rgba(255,240,120,${0.6+flap*0.4})`; ctx.lineWidth = Math.max(1.5, s*0.03);
        ctx.beginPath(); ctx.moveTo(px + s*0.82, py + s*0.37); ctx.lineTo(px + s*0.90, py + s*0.43); ctx.lineTo(px + s*0.84, py + s*0.47); ctx.lineTo(px + s*0.92, py + s*0.53); ctx.stroke();
        ctx.fillStyle = '#2f6aaa'; ctx.fillRect(px + s*0.44, py + s*0.76, s*0.08, s*0.14);
        ctx.fillStyle = '#245a90'; ctx.fillRect(px + s*0.30, py + s*0.76, s*0.07, s*0.11);
        ctx.restore();
        break;
      }
      const bwf = Math.sin(Date.now()/120 + phase)*0.2 + 1;
      // Wings
      ctx.fillStyle = '#2f6aaa';
      ctx.beginPath(); ctx.moveTo(px + s*0.10, py + s*0.40/bwf); ctx.lineTo(px + s*0.48, py + s*0.38); ctx.lineTo(px + s*0.30, py + s*0.58); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px + s*0.90, py + s*0.40/bwf); ctx.lineTo(px + s*0.52, py + s*0.38); ctx.lineTo(px + s*0.70, py + s*0.58); ctx.closePath(); ctx.fill();
      // Body
      ctx.fillStyle = '#3a82cc';
      ctx.beginPath(); ctx.ellipse(cx, py + s*0.56, s*0.20, s*0.26, 0, 0, Math.PI*2); ctx.fill();
      // Head
      ctx.fillStyle = '#4a92dd';
      ctx.beginPath(); ctx.arc(cx, py + s*0.30, s*0.16, 0, Math.PI*2); ctx.fill();
      // Nose horn (blue dragon signature)
      ctx.fillStyle = '#dfeeff';
      ctx.beginPath(); ctx.moveTo(cx, py + s*0.18); ctx.lineTo(cx - s*0.03, py + s*0.04); ctx.lineTo(cx + s*0.04, py + s*0.18); ctx.closePath(); ctx.fill();
      // Spark breath
      ctx.strokeStyle = `rgba(255,240,120,${0.6+flap*0.4})`; ctx.lineWidth = Math.max(1.5, s*0.03);
      ctx.beginPath(); ctx.moveTo(cx, py + s*0.42); ctx.lineTo(cx + s*0.06, py + s*0.50); ctx.lineTo(cx - s*0.02, py + s*0.54); ctx.lineTo(cx + s*0.04, py + s*0.62); ctx.stroke();
      // Eye
      ctx.fillStyle = '#ffee44'; ctx.fillRect(cx - s*0.08, py + s*0.26, s*0.05, s*0.04);
      ctx.fillStyle = '#000'; ctx.fillRect(cx - s*0.065, py + s*0.27, s*0.02, s*0.03);
      break;
    }
    case 'behir': {
      const facing = creatureFacing(e);
      if (facing === 'down') {
        // Head on: the coil rising between two front legs, both eyes, a spark each side.
        ctx.save();
        ctx.strokeStyle = '#23598f'; ctx.lineWidth = Math.max(6, s*0.22); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(cx - s*0.16, py + s*0.88); ctx.quadraticCurveTo(cx + s*0.20, py + s*0.74, cx - s*0.02, py + s*0.56); ctx.quadraticCurveTo(cx - s*0.20, py + s*0.44, cx, py + s*0.30); ctx.stroke();
        ctx.strokeStyle = '#3a78b8'; ctx.lineWidth = Math.max(3, s*0.10);
        ctx.beginPath(); ctx.moveTo(cx - s*0.16, py + s*0.88); ctx.quadraticCurveTo(cx + s*0.20, py + s*0.74, cx - s*0.02, py + s*0.56); ctx.quadraticCurveTo(cx - s*0.20, py + s*0.44, cx, py + s*0.30); ctx.stroke();
        ctx.fillStyle = '#23598f';
        ctx.beginPath(); ctx.ellipse(cx, py + s*0.82, s*0.30, s*0.13, 0, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#1a4570'; ctx.lineWidth = Math.max(1.5, s*0.04);
        [[0.26,0.86,-0.05],[0.40,0.90,-0.03],[0.60,0.90,0.03],[0.74,0.86,0.05]].forEach(([fx,fy,dx]) => { ctx.beginPath(); ctx.moveTo(px + s*fx, py + s*fy); ctx.lineTo(px + s*(fx+dx), py + s*(fy+0.10)); ctx.stroke(); });
        ctx.fillStyle = '#23598f';
        ctx.beginPath(); ctx.moveTo(cx - s*0.14, py + s*0.20); ctx.lineTo(cx - s*0.26, py + s*0.12); ctx.lineTo(cx - s*0.10, py + s*0.32); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(cx + s*0.14, py + s*0.20); ctx.lineTo(cx + s*0.26, py + s*0.12); ctx.lineTo(cx + s*0.10, py + s*0.32); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#3a78b8';
        ctx.beginPath(); ctx.arc(cx, py + s*0.24, s*0.18, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#1a4570'; ctx.fillRect(cx - s*0.07, py + s*0.32, s*0.14, s*0.04);
        ctx.fillStyle = '#ffee44'; ctx.fillRect(cx - s*0.11, py + s*0.20, s*0.06, s*0.05); ctx.fillRect(cx + s*0.05, py + s*0.20, s*0.06, s*0.05);
        ctx.fillStyle = '#000'; ctx.fillRect(cx - s*0.09, py + s*0.21, s*0.02, s*0.03); ctx.fillRect(cx + s*0.07, py + s*0.21, s*0.02, s*0.03);
        ctx.strokeStyle = `rgba(255,240,120,${0.5+flap*0.5})`; ctx.lineWidth = Math.max(1.5, s*0.03);
        ctx.beginPath(); ctx.moveTo(cx - s*0.26, py + s*0.26); ctx.lineTo(cx - s*0.18, py + s*0.32); ctx.lineTo(cx - s*0.24, py + s*0.36); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx + s*0.26, py + s*0.26); ctx.lineTo(cx + s*0.18, py + s*0.32); ctx.lineTo(cx + s*0.24, py + s*0.36); ctx.stroke();
        ctx.restore();
        break;
      }
      if (facing === 'up') {
        // From behind: the coil leaning the other way, a spine down it, the back of the head.
        ctx.save();
        ctx.strokeStyle = '#23598f'; ctx.lineWidth = Math.max(5, s*0.18); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(cx + s*0.14, py + s*0.88); ctx.quadraticCurveTo(cx - s*0.18, py + s*0.74, cx + s*0.02, py + s*0.56); ctx.quadraticCurveTo(cx + s*0.18, py + s*0.44, cx, py + s*0.30); ctx.stroke();
        ctx.strokeStyle = '#3a78b8'; ctx.lineWidth = Math.max(2, s*0.08);
        ctx.beginPath(); ctx.moveTo(cx + s*0.14, py + s*0.88); ctx.quadraticCurveTo(cx - s*0.18, py + s*0.74, cx + s*0.02, py + s*0.56); ctx.quadraticCurveTo(cx + s*0.18, py + s*0.44, cx, py + s*0.30); ctx.stroke();
        ctx.fillStyle = '#23598f';
        ctx.beginPath(); ctx.ellipse(cx, py + s*0.82, s*0.30, s*0.13, 0, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#1a4570'; ctx.lineWidth = Math.max(1.5, s*0.04);
        [[0.26,0.86,-0.05],[0.40,0.90,-0.03],[0.60,0.90,0.03],[0.74,0.86,0.05]].forEach(([fx,fy,dx]) => { ctx.beginPath(); ctx.moveTo(px + s*fx, py + s*fy); ctx.lineTo(px + s*(fx+dx), py + s*(fy+0.10)); ctx.stroke(); });
        ctx.fillStyle = '#1a4570';
        [[0.78,0.80],[0.66,0.66],[0.58,0.52],[0.52,0.40]].forEach(([fx,fy]) => { ctx.beginPath(); ctx.moveTo(px + s*(fx-0.05), py + s*(fy+0.04)); ctx.lineTo(px + s*fx, py + s*(fy-0.04)); ctx.lineTo(px + s*(fx+0.05), py + s*(fy+0.04)); ctx.closePath(); ctx.fill(); });
        ctx.fillStyle = '#23598f';
        ctx.beginPath(); ctx.moveTo(cx - s*0.13, py + s*0.20); ctx.lineTo(cx - s*0.24, py + s*0.12); ctx.lineTo(cx - s*0.09, py + s*0.32); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(cx + s*0.13, py + s*0.20); ctx.lineTo(cx + s*0.24, py + s*0.12); ctx.lineTo(cx + s*0.09, py + s*0.32); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#3a78b8';
        ctx.beginPath(); ctx.arc(cx, py + s*0.24, s*0.17, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#23598f'; ctx.lineWidth = Math.max(2, s*0.05);
        ctx.beginPath(); ctx.moveTo(cx, py + s*0.08); ctx.lineTo(cx, py + s*0.40); ctx.stroke();
        ctx.strokeStyle = `rgba(255,240,120,${0.5+flap*0.5})`; ctx.lineWidth = Math.max(1.5, s*0.03);
        ctx.beginPath(); ctx.moveTo(cx - s*0.24, py + s*0.24); ctx.lineTo(cx - s*0.16, py + s*0.30); ctx.lineTo(cx - s*0.22, py + s*0.34); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx + s*0.24, py + s*0.24); ctx.lineTo(cx + s*0.16, py + s*0.30); ctx.lineTo(cx + s*0.22, py + s*0.34); ctx.stroke();
        ctx.restore();
        break;
      }
      // Side. This was always the behir's only view, drawn facing right.
      ctx.save();
      mirrorIfLeft(facing, cx);
      // Long sinuous body
      ctx.strokeStyle = '#23598f'; ctx.lineWidth = Math.max(5, s*0.18); ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(px + s*0.10, py + s*0.84);
      ctx.quadraticCurveTo(px + s*0.40, py + s*0.86, px + s*0.50, py + s*0.60);
      ctx.quadraticCurveTo(px + s*0.60, py + s*0.34, cx + s*0.06, py + s*0.24);
      ctx.stroke();
      ctx.strokeStyle = '#3a78b8'; ctx.lineWidth = Math.max(2, s*0.08);
      ctx.beginPath();
      ctx.moveTo(px + s*0.12, py + s*0.82);
      ctx.quadraticCurveTo(px + s*0.40, py + s*0.84, px + s*0.50, py + s*0.60);
      ctx.stroke();
      // Many little legs
      ctx.strokeStyle = '#1a4570'; ctx.lineWidth = Math.max(1.5, s*0.04);
      [[0.20,0.84],[0.34,0.84],[0.48,0.66],[0.55,0.46]].forEach(([fx,fy]) => { ctx.beginPath(); ctx.moveTo(px + s*fx, py + s*fy); ctx.lineTo(px + s*(fx-0.04), py + s*(fy+0.12)); ctx.stroke(); });
      // Head
      ctx.fillStyle = '#3a78b8';
      ctx.beginPath(); ctx.arc(cx + s*0.06, py + s*0.22, s*0.15, 0, Math.PI*2); ctx.fill();
      // Crackle
      ctx.strokeStyle = `rgba(255,240,120,${0.5+flap*0.5})`; ctx.lineWidth = Math.max(1.5, s*0.03);
      ctx.beginPath(); ctx.moveTo(cx + s*0.12, py + s*0.14); ctx.lineTo(cx + s*0.20, py + s*0.20); ctx.lineTo(cx + s*0.14, py + s*0.24); ctx.stroke();
      // Eye
      ctx.fillStyle = '#ffee44'; ctx.fillRect(cx + s*0.02, py + s*0.18, s*0.05, s*0.04);
      ctx.fillStyle = '#000'; ctx.fillRect(cx + s*0.035, py + s*0.19, s*0.02, s*0.03);
      ctx.restore();
      break;
    }
    case 'young_blue_dragon': {
      const facing = creatureFacing(e);
      if (facing === 'up') {
        // Back: both wings from behind, the back of the head, a spined ridge, the tail.
        const tbf = Math.sin(Date.now()/120 + phase)*0.2 + 1;
        ctx.fillStyle = '#2a5e9a';
        ctx.beginPath(); ctx.moveTo(px + s*0.02, py + s*0.38/tbf); ctx.lineTo(px + s*0.48, py + s*0.36); ctx.lineTo(px + s*0.26, py + s*0.64); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(px + s*0.98, py + s*0.38/tbf); ctx.lineTo(px + s*0.52, py + s*0.36); ctx.lineTo(px + s*0.74, py + s*0.64); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#3a78b8';
        ctx.beginPath(); ctx.moveTo(px + s*0.08, py + s*0.40/tbf); ctx.lineTo(px + s*0.46, py + s*0.38); ctx.lineTo(px + s*0.28, py + s*0.58); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(px + s*0.92, py + s*0.40/tbf); ctx.lineTo(px + s*0.54, py + s*0.38); ctx.lineTo(px + s*0.72, py + s*0.58); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#3a7ec0'; ctx.lineWidth = Math.max(2, s*0.06);
        ctx.beginPath(); ctx.moveTo(cx, py + s*0.80); ctx.lineTo(cx + Math.sin(Date.now()/180+phase)*s*0.20, py + s); ctx.stroke();
        ctx.fillStyle = '#3a7ec0';
        ctx.beginPath(); ctx.ellipse(cx, py + s*0.54, s*0.22, s*0.30, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#2a5e9a';
        [0.40,0.52,0.64].forEach(fy => { ctx.beginPath(); ctx.moveTo(cx - s*0.06, py + s*(fy+0.06)); ctx.lineTo(cx, py + s*(fy-0.03)); ctx.lineTo(cx + s*0.06, py + s*(fy+0.06)); ctx.closePath(); ctx.fill(); });
        ctx.fillStyle = '#4a8ed0';
        ctx.beginPath(); ctx.arc(cx, py + s*0.26, s*0.17, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#2a5e9a';
        ctx.beginPath(); ctx.moveTo(cx - s*0.14, py + s*0.20); ctx.lineTo(cx - s*0.26, py + s*0.10); ctx.lineTo(cx - s*0.10, py + s*0.34); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(cx + s*0.14, py + s*0.20); ctx.lineTo(cx + s*0.26, py + s*0.10); ctx.lineTo(cx + s*0.10, py + s*0.34); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#2a5e9a'; ctx.lineWidth = Math.max(2, s*0.04);
        ctx.beginPath(); ctx.moveTo(cx, py + s*0.10); ctx.lineTo(cx, py + s*0.42); ctx.stroke();
        break;
      }
      if (facing !== 'down') {
        // Side, drawn facing right: one eye, the horned snout forward, one wing, tail behind.
        ctx.save();
        mirrorIfLeft(facing, cx);
        const pbf = Math.sin(Date.now()/120 + phase)*0.2 + 1;
        ctx.strokeStyle = '#3a7ec0'; ctx.lineWidth = Math.max(2, s*0.06);
        ctx.beginPath(); ctx.moveTo(px + s*0.34, py + s*0.72); ctx.lineTo(px + s*0.10 + Math.sin(Date.now()/180+phase)*s*0.08, py + s*0.98); ctx.stroke();
        ctx.fillStyle = '#2a5e9a';
        ctx.beginPath(); ctx.moveTo(px + s*0.22, py + s*0.30/pbf); ctx.lineTo(px + s*0.50, py + s*0.38); ctx.lineTo(px + s*0.30, py + s*0.56); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#3a7ec0';
        ctx.beginPath(); ctx.ellipse(cx - s*0.06, py + s*0.56, s*0.18, s*0.28, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#3a78b8';
        ctx.beginPath(); ctx.moveTo(px + s*0.36, py + s*0.34/pbf); ctx.lineTo(px + s*0.66, py + s*0.42); ctx.lineTo(px + s*0.42, py + s*0.66); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#2a5e9a'; ctx.fillRect(px + s*0.42, py + s*0.78, s*0.10, s*0.16);
        ctx.fillStyle = '#3a7ec0'; ctx.fillRect(px + s*0.56, py + s*0.78, s*0.10, s*0.18);
        ctx.fillStyle = '#4a8ed0';
        ctx.beginPath(); ctx.arc(px + s*0.64, py + s*0.32, s*0.16, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(px + s*0.68, py + s*0.26); ctx.lineTo(px + s*0.86, py + s*0.34); ctx.lineTo(px + s*0.68, py + s*0.42); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#dfeeff';
        ctx.beginPath(); ctx.moveTo(px + s*0.74, py + s*0.24); ctx.lineTo(px + s*0.80, py + s*0.06); ctx.lineTo(px + s*0.82, py + s*0.26); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffee44'; ctx.fillRect(px + s*0.62, py + s*0.28, s*0.06, s*0.05);
        ctx.fillStyle = '#000'; ctx.fillRect(px + s*0.64, py + s*0.29, s*0.02, s*0.03);
        ctx.strokeStyle = `rgba(255,245,140,${0.6+flap*0.4})`; ctx.lineWidth = Math.max(2, s*0.04);
        ctx.beginPath(); ctx.moveTo(px + s*0.86, py + s*0.38); ctx.lineTo(px + s*0.94, py + s*0.48); ctx.lineTo(px + s*0.86, py + s*0.54); ctx.lineTo(px + s*0.96, py + s*0.64); ctx.stroke();
        ctx.restore();
        break;
      }
      const dbf = Math.sin(Date.now()/120 + phase)*0.2 + 1;
      // Wings
      ctx.fillStyle = '#2a5e9a';
      ctx.beginPath(); ctx.moveTo(px + s*0.04, py + s*0.36/dbf); ctx.lineTo(px + s*0.48, py + s*0.34); ctx.lineTo(px + s*0.28, py + s*0.62); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px + s*0.96, py + s*0.36/dbf); ctx.lineTo(px + s*0.52, py + s*0.34); ctx.lineTo(px + s*0.72, py + s*0.62); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#3a78b8';
      ctx.beginPath(); ctx.moveTo(px + s*0.10, py + s*0.38/dbf); ctx.lineTo(px + s*0.46, py + s*0.36); ctx.lineTo(px + s*0.30, py + s*0.56); ctx.closePath(); ctx.fill();
      // Body
      ctx.fillStyle = '#3a7ec0';
      ctx.beginPath(); ctx.ellipse(cx, py + s*0.54, s*0.22, s*0.30, 0, 0, Math.PI*2); ctx.fill();
      // Head
      ctx.fillStyle = '#4a8ed0';
      ctx.beginPath(); ctx.arc(cx, py + s*0.26, s*0.17, 0, Math.PI*2); ctx.fill();
      // Big nose horn
      ctx.fillStyle = '#dfeeff';
      ctx.beginPath(); ctx.moveTo(cx, py + s*0.12); ctx.lineTo(cx - s*0.04, py - s*0.02); ctx.lineTo(cx + s*0.05, py + s*0.12); ctx.closePath(); ctx.fill();
      // Lightning breath
      ctx.strokeStyle = `rgba(255,245,140,${0.6+flap*0.4})`; ctx.lineWidth = Math.max(2, s*0.04);
      ctx.beginPath(); ctx.moveTo(cx, py + s*0.40); ctx.lineTo(cx + s*0.08, py + s*0.50); ctx.lineTo(cx - s*0.02, py + s*0.56); ctx.lineTo(cx + s*0.06, py + s*0.66); ctx.stroke();
      // Eye
      ctx.fillStyle = '#ffee44'; ctx.fillRect(px + s*0.46, py + s*0.24, s*0.07, s*0.05);
      ctx.fillStyle = '#000'; ctx.fillRect(px + s*0.49, py + s*0.25, s*0.02, s*0.03);
      // Tail
      ctx.strokeStyle = '#3a7ec0'; ctx.lineWidth = Math.max(2, s*0.06);
      ctx.beginPath(); ctx.moveTo(cx, py + s*0.80); ctx.lineTo(cx + Math.sin(Date.now()/180+phase)*s*0.20, py + s); ctx.stroke();
      break;
    }
    case 'storm_giant': {
      const facing = creatureFacing(e);
      if (facing === 'up') {
        // Back: the same bulk and aura, hair down the back, the bolt now in the other hand.
        const uba = ctx.createRadialGradient(cx, cy, 0, cx, cy, s*0.55);
        uba.addColorStop(0, `rgba(150,180,255,${0.2+flap*0.2})`); uba.addColorStop(1, 'rgba(150,180,255,0)');
        ctx.fillStyle = uba; ctx.fillRect(fb.x - s*0.1, fb.y - s*0.1, s*1.2, s*1.2);
        ctx.fillStyle = '#6f86b8'; ctx.fillRect(px + s*0.30, py + s*0.66, s*0.16, s*0.26); ctx.fillRect(px + s*0.54, py + s*0.66, s*0.16, s*0.26);
        ctx.fillStyle = '#8298c8'; ctx.fillRect(px + s*0.26, py + s*0.30, s*0.48, s*0.42);
        ctx.fillStyle = '#6f86b8'; ctx.fillRect(px + s*0.26, py + s*0.30, s*0.24, s*0.42);
        ctx.strokeStyle = '#6f86b8'; ctx.lineWidth = Math.max(2, s*0.04);
        ctx.beginPath(); ctx.moveTo(cx, py + s*0.32); ctx.lineTo(cx, py + s*0.70); ctx.stroke();
        ctx.fillStyle = '#9aaed8';
        ctx.beginPath(); ctx.arc(cx, py + s*0.20, s*0.16, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#dfe6f4';
        ctx.beginPath(); ctx.arc(cx, py + s*0.18, s*0.17, Math.PI, 0); ctx.fill();
        ctx.fillRect(px + s*0.36, py + s*0.18, s*0.28, s*0.24);
        ctx.strokeStyle = `rgba(255,245,140,${0.6+flap*0.4})`; ctx.lineWidth = Math.max(2, s*0.04);
        ctx.beginPath(); ctx.moveTo(px + s*0.18, py + s*0.16); ctx.lineTo(px + s*0.10, py + s*0.34); ctx.lineTo(px + s*0.20, py + s*0.42); ctx.lineTo(px + s*0.10, py + s*0.62); ctx.stroke();
        break;
      }
      if (facing !== 'down') {
        // Side, drawn facing right: one glowing eye, the beard in profile, the bolt held ahead.
        ctx.save();
        mirrorIfLeft(facing, cx);
        const sba = ctx.createRadialGradient(cx, cy, 0, cx, cy, s*0.55);
        sba.addColorStop(0, `rgba(150,180,255,${0.2+flap*0.2})`); sba.addColorStop(1, 'rgba(150,180,255,0)');
        ctx.fillStyle = sba; ctx.fillRect(fb.x - s*0.1, fb.y - s*0.1, s*1.2, s*1.2);
        ctx.fillStyle = '#6f86b8'; ctx.fillRect(px + s*0.36, py + s*0.66, s*0.14, s*0.26); ctx.fillRect(px + s*0.52, py + s*0.66, s*0.14, s*0.26);
        ctx.fillStyle = '#8298c8'; ctx.fillRect(px + s*0.34, py + s*0.30, s*0.34, s*0.42);
        ctx.fillStyle = '#9aaed8'; ctx.fillRect(px + s*0.34, py + s*0.30, s*0.18, s*0.42);
        ctx.fillStyle = '#dfe6f4';
        ctx.beginPath(); ctx.arc(px + s*0.53, py + s*0.18, s*0.17, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(px + s*0.42, py + s*0.34, s*0.07, s*0.12, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#9aaed8';
        ctx.beginPath(); ctx.arc(px + s*0.58, py + s*0.20, s*0.15, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#dfe6f4';
        ctx.beginPath(); ctx.moveTo(px + s*0.54, py + s*0.26); ctx.lineTo(px + s*0.72, py + s*0.28); ctx.lineTo(px + s*0.64, py + s*0.40); ctx.lineTo(px + s*0.52, py + s*0.34); ctx.closePath(); ctx.fill();
        ctx.fillStyle = `rgba(220,240,255,${0.7+flap*0.3})`; ctx.fillRect(px + s*0.62, py + s*0.16, s*0.05, s*0.04);
        ctx.strokeStyle = '#8298c8'; ctx.lineWidth = Math.max(2, s*0.08);
        ctx.beginPath(); ctx.moveTo(px + s*0.56, py + s*0.40); ctx.lineTo(px + s*0.78, py + s*0.44); ctx.stroke();
        ctx.strokeStyle = `rgba(255,245,140,${0.6+flap*0.4})`; ctx.lineWidth = Math.max(2, s*0.04);
        ctx.beginPath(); ctx.moveTo(px + s*0.82, py + s*0.16); ctx.lineTo(px + s*0.90, py + s*0.34); ctx.lineTo(px + s*0.80, py + s*0.42); ctx.lineTo(px + s*0.90, py + s*0.62); ctx.stroke();
        ctx.restore();
        break;
      }
      // Static aura
      const sgaa = ctx.createRadialGradient(cx, cy, 0, cx, cy, s*0.55);
      sgaa.addColorStop(0, `rgba(150,180,255,${0.2+flap*0.2})`);
      sgaa.addColorStop(1, 'rgba(150,180,255,0)');
      ctx.fillStyle = sgaa; ctx.fillRect(fb.x - s*0.1, fb.y - s*0.1, s*1.2, s*1.2);
      // Legs
      ctx.fillStyle = '#6f86b8'; ctx.fillRect(px + s*0.30, py + s*0.66, s*0.16, s*0.26); ctx.fillRect(px + s*0.54, py + s*0.66, s*0.16, s*0.26);
      // Torso
      ctx.fillStyle = '#8298c8'; ctx.fillRect(px + s*0.26, py + s*0.30, s*0.48, s*0.42);
      ctx.fillStyle = '#9aaed8'; ctx.fillRect(px + s*0.26, py + s*0.30, s*0.24, s*0.42);
      // Head
      ctx.fillStyle = '#9aaed8';
      ctx.beginPath(); ctx.arc(cx, py + s*0.20, s*0.16, 0, Math.PI*2); ctx.fill();
      // Hair / beard
      ctx.fillStyle = '#dfe6f4'; ctx.fillRect(px + s*0.40, py + s*0.22, s*0.20, s*0.14);
      // Glowing eyes
      ctx.fillStyle = `rgba(220,240,255,${0.7+flap*0.3})`; ctx.fillRect(px + s*0.42, py + s*0.18, s*0.05, s*0.04); ctx.fillRect(px + s*0.53, py + s*0.18, s*0.05, s*0.04);
      // Lightning bolt in hand
      ctx.strokeStyle = `rgba(255,245,140,${0.6+flap*0.4})`; ctx.lineWidth = Math.max(2, s*0.04);
      ctx.beginPath(); ctx.moveTo(px + s*0.82, py + s*0.16); ctx.lineTo(px + s*0.90, py + s*0.34); ctx.lineTo(px + s*0.80, py + s*0.42); ctx.lineTo(px + s*0.90, py + s*0.62); ctx.stroke();
      break;
    }
    case 'storm_lord': {
      const facing = creatureFacing(e);
      if (facing === 'up') {
        // Back: crown, bolts and scepter stay, the face goes; cape and seam down the armour.
        if (e.boss) {
          const aurB = s*0.60 + Math.sin(Date.now()/220)*s*0.04;
          const auraB = ctx.createRadialGradient(cx, cy, 0, cx, cy, aurB);
          auraB.addColorStop(0, `rgba(255,225,90,${0.35+flap*0.15})`); auraB.addColorStop(1, 'rgba(255,225,90,0)');
          ctx.fillStyle = auraB; ctx.fillRect(cx-aurB, cy-aurB, aurB*2, aurB*2);
        }
        ctx.strokeStyle = `rgba(255,245,150,${0.5+flap*0.5})`; ctx.lineWidth = Math.max(1.5, s*0.03);
        for (let i=0;i<3;i++){ const a = Date.now()/300 + i*2.1 + phase; const r1=s*0.40, r2=s*0.56;
          ctx.beginPath(); ctx.moveTo(cx+Math.cos(a)*r1, cy+Math.sin(a)*r1); ctx.lineTo(cx+Math.cos(a+0.2)*r2, cy+Math.sin(a+0.2)*r2); ctx.lineTo(cx+Math.cos(a+0.1)*r1, cy+Math.sin(a+0.1)*r1); ctx.stroke(); }
        ctx.fillStyle = '#8a6e1e';
        ctx.beginPath(); ctx.moveTo(px + s*0.30, py + s*0.36); ctx.lineTo(px + s*0.16, py + s*0.90); ctx.lineTo(px + s*0.84, py + s*0.90); ctx.lineTo(px + s*0.70, py + s*0.36); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#7a6420'; ctx.fillRect(px + s*0.32, py + s*0.68, s*0.14, s*0.24); ctx.fillRect(px + s*0.54, py + s*0.68, s*0.14, s*0.24);
        ctx.fillStyle = '#caa830'; ctx.fillRect(px + s*0.28, py + s*0.36, s*0.44, s*0.38);
        ctx.fillStyle = '#e6c84a'; ctx.fillRect(px + s*0.50, py + s*0.36, s*0.22, s*0.38);
        ctx.strokeStyle = '#8a6e1e'; ctx.lineWidth = Math.max(2, s*0.05);
        ctx.beginPath(); ctx.moveTo(cx, py + s*0.38); ctx.lineTo(cx, py + s*0.72); ctx.stroke();
        ctx.fillStyle = '#8a6e1e';
        ctx.beginPath(); ctx.moveTo(px + s*0.26, py + s*0.38); ctx.lineTo(px + s*0.18, py + s*0.28); ctx.lineTo(px + s*0.40, py + s*0.36); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(px + s*0.74, py + s*0.38); ctx.lineTo(px + s*0.82, py + s*0.28); ctx.lineTo(px + s*0.60, py + s*0.36); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#e6c84a';
        ctx.beginPath(); ctx.arc(cx, py + s*0.24, s*0.14, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#caa830'; ctx.lineWidth = Math.max(2, s*0.04);
        ctx.beginPath(); ctx.moveTo(cx, py + s*0.10); ctx.lineTo(cx, py + s*0.38); ctx.stroke();
        ctx.fillStyle = '#fff2a0';
        [0.36,0.44,0.50,0.56,0.64].forEach(fx => { ctx.beginPath(); ctx.moveTo(px+s*fx, py+s*0.14); ctx.lineTo(px+s*(fx+0.02), py-s*0.02); ctx.lineTo(px+s*(fx+0.05), py+s*0.14); ctx.closePath(); ctx.fill(); });
        ctx.strokeStyle = `rgba(255,245,150,${0.7+flap*0.3})`; ctx.lineWidth = Math.max(2, s*0.05);
        ctx.beginPath(); ctx.moveTo(px + s*0.16, py + s*0.10); ctx.lineTo(px + s*0.08, py + s*0.34); ctx.lineTo(px + s*0.18, py + s*0.44); ctx.lineTo(px + s*0.08, py + s*0.70); ctx.stroke();
        break;
      }
      if (facing !== 'down') {
        // Side, drawn facing right: one eye, the crown in profile, the scepter held ahead.
        ctx.save();
        mirrorIfLeft(facing, cx);
        if (e.boss) {
          const aurS = s*0.60 + Math.sin(Date.now()/220)*s*0.04;
          const auraS = ctx.createRadialGradient(cx, cy, 0, cx, cy, aurS);
          auraS.addColorStop(0, `rgba(255,225,90,${0.35+flap*0.15})`); auraS.addColorStop(1, 'rgba(255,225,90,0)');
          ctx.fillStyle = auraS; ctx.fillRect(cx-aurS, cy-aurS, aurS*2, aurS*2);
        }
        ctx.strokeStyle = `rgba(255,245,150,${0.5+flap*0.5})`; ctx.lineWidth = Math.max(1.5, s*0.03);
        for (let i=0;i<3;i++){ const a = Date.now()/300 + i*2.1 + phase; const r1=s*0.40, r2=s*0.56;
          ctx.beginPath(); ctx.moveTo(cx+Math.cos(a)*r1, cy+Math.sin(a)*r1); ctx.lineTo(cx+Math.cos(a+0.2)*r2, cy+Math.sin(a+0.2)*r2); ctx.lineTo(cx+Math.cos(a+0.1)*r1, cy+Math.sin(a+0.1)*r1); ctx.stroke(); }
        ctx.fillStyle = '#8a6e1e';
        ctx.beginPath(); ctx.moveTo(px + s*0.44, py + s*0.38); ctx.lineTo(px + s*0.22, py + s*0.88); ctx.lineTo(px + s*0.44, py + s*0.88); ctx.lineTo(px + s*0.52, py + s*0.38); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#7a6420'; ctx.fillRect(px + s*0.40, py + s*0.68, s*0.13, s*0.24); ctx.fillRect(px + s*0.56, py + s*0.68, s*0.13, s*0.24);
        ctx.fillStyle = '#caa830'; ctx.fillRect(px + s*0.38, py + s*0.36, s*0.30, s*0.38);
        ctx.fillStyle = '#e6c84a'; ctx.fillRect(px + s*0.38, py + s*0.36, s*0.16, s*0.38);
        ctx.fillStyle = '#8a6e1e';
        ctx.beginPath(); ctx.moveTo(px + s*0.36, py + s*0.38); ctx.lineTo(px + s*0.28, py + s*0.28); ctx.lineTo(px + s*0.58, py + s*0.36); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#e6c84a';
        ctx.beginPath(); ctx.arc(px + s*0.60, py + s*0.24, s*0.14, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fff2a0';
        [0.50,0.57,0.64,0.71].forEach(fx => { ctx.beginPath(); ctx.moveTo(px+s*fx, py+s*0.14); ctx.lineTo(px+s*(fx+0.02), py-s*0.02); ctx.lineTo(px+s*(fx+0.05), py+s*0.14); ctx.closePath(); ctx.fill(); });
        ctx.fillStyle = 'rgba(255,250,180,0.85)'; ctx.fillRect(px + s*0.64, py + s*0.22, s*0.05, s*0.04);
        ctx.strokeStyle = '#caa830'; ctx.lineWidth = Math.max(2, s*0.07);
        ctx.beginPath(); ctx.moveTo(px + s*0.58, py + s*0.44); ctx.lineTo(px + s*0.78, py + s*0.46); ctx.stroke();
        ctx.strokeStyle = `rgba(255,245,150,${0.7+flap*0.3})`; ctx.lineWidth = Math.max(2, s*0.05);
        ctx.beginPath(); ctx.moveTo(px + s*0.84, py + s*0.10); ctx.lineTo(px + s*0.92, py + s*0.34); ctx.lineTo(px + s*0.82, py + s*0.44); ctx.lineTo(px + s*0.92, py + s*0.70); ctx.stroke();
        ctx.restore();
        break;
      }
      if (e.boss) {
        const auraR = s*0.60 + Math.sin(Date.now()/220)*s*0.04;
        const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, auraR);
        aura.addColorStop(0, `rgba(255,225,90,${0.35+flap*0.15})`); aura.addColorStop(1, 'rgba(255,225,90,0)');
        ctx.fillStyle = aura; ctx.fillRect(cx-auraR, cy-auraR, auraR*2, auraR*2);
      }
      // Crackling bolts
      ctx.strokeStyle = `rgba(255,245,150,${0.5+flap*0.5})`; ctx.lineWidth = Math.max(1.5, s*0.03);
      for (let i=0;i<3;i++){ const a = Date.now()/300 + i*2.1 + phase; const r1=s*0.40, r2=s*0.56;
        ctx.beginPath(); ctx.moveTo(cx+Math.cos(a)*r1, cy+Math.sin(a)*r1); ctx.lineTo(cx+Math.cos(a+0.2)*r2, cy+Math.sin(a+0.2)*r2); ctx.lineTo(cx+Math.cos(a+0.1)*r1, cy+Math.sin(a+0.1)*r1); ctx.stroke(); }
      // Legs
      ctx.fillStyle = '#7a6420'; ctx.fillRect(px + s*0.32, py + s*0.68, s*0.14, s*0.24); ctx.fillRect(px + s*0.54, py + s*0.68, s*0.14, s*0.24);
      // Armored torso
      ctx.fillStyle = '#caa830'; ctx.fillRect(px + s*0.28, py + s*0.36, s*0.44, s*0.38);
      ctx.fillStyle = '#e6c84a'; ctx.fillRect(px + s*0.28, py + s*0.36, s*0.22, s*0.38);
      // Pauldrons
      ctx.fillStyle = '#8a6e1e';
      ctx.beginPath(); ctx.moveTo(px + s*0.26, py + s*0.38); ctx.lineTo(px + s*0.18, py + s*0.28); ctx.lineTo(px + s*0.40, py + s*0.36); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px + s*0.74, py + s*0.38); ctx.lineTo(px + s*0.82, py + s*0.28); ctx.lineTo(px + s*0.60, py + s*0.36); ctx.closePath(); ctx.fill();
      // Head
      ctx.fillStyle = '#e6c84a';
      ctx.beginPath(); ctx.arc(cx, py + s*0.24, s*0.14, 0, Math.PI*2); ctx.fill();
      // Lightning crown
      ctx.fillStyle = '#fff2a0';
      [0.36,0.44,0.50,0.56,0.64].forEach(fx => { ctx.beginPath(); ctx.moveTo(px+s*fx, py+s*0.14); ctx.lineTo(px+s*(fx+0.02), py-s*0.02); ctx.lineTo(px+s*(fx+0.05), py+s*0.14); ctx.closePath(); ctx.fill(); });
      // Glowing eyes
      ctx.fillStyle = 'rgba(255,250,180,0.85)';
      ctx.fillRect(px + s*0.43, py + s*0.22, s*0.05, s*0.04); ctx.fillRect(px + s*0.52, py + s*0.22, s*0.05, s*0.04);
      // Bolt scepter (right)
      ctx.strokeStyle = `rgba(255,245,150,${0.7+flap*0.3})`; ctx.lineWidth = Math.max(2, s*0.05);
      ctx.beginPath(); ctx.moveTo(px + s*0.84, py + s*0.10); ctx.lineTo(px + s*0.92, py + s*0.34); ctx.lineTo(px + s*0.82, py + s*0.44); ctx.lineTo(px + s*0.92, py + s*0.70); ctx.stroke();
      break;
    }
  }
}

registerEnemyArt(drawLightningCreature, [
  'will_o_wisp', 'blue_wyrmling', 'behir', 'young_blue_dragon', 'storm_giant',
  'storm_lord',
]);
