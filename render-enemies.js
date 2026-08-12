// ─── Enemy sprites ────────────────────────────────────────────────────────────
// drawEnemy, split out of render.js (~2600 lines of hand-drawn per-type pixel
// art). Plain <script> globals — loaded before render.js in index.html. Calls
// drawElementFX (still in render.js) at runtime, which is fine for load order.

// ─── Enemy sprites ────────────────────────────────────────────────────────────
// Each type has hand-drawn pixel art. Generic fallback at the end.
function drawEnemy(e, ts) {
  const sx = (e.x - camC) * ts, sy = (e.y - camR) * ts;
  const s = ts * e.size;
  const ox = (ts - s) / 2, oy = (ts - s) / 2;

  // Per-enemy idle bob — phase by id so a swarm doesn't bob in unison.
  const phase = (e.id || 0) * 0.74;
  const bob = Math.sin(Date.now() / 220 + phase) * 1.6;
  // Faster wing/aura pulse for ranged/flying types
  const flap = Math.sin(Date.now() / 90 + phase) * 0.5 + 0.5;
  // Damage flash: brief white tint when recently hit (e.hp < e.maxHp by a bit
  // doesn't track recency, but invincible doesn't apply — use a synthetic
  // 'lastHit' set elsewhere if needed; default off).
  const hurt = e.hurtT && e.hurtT > 0 ? Math.min(1, e.hurtT / 150) : 0;

  const px = sx + ox, py = sy + oy + bob;
  const cx = sx + ts / 2, cy = sy + ts / 2 + bob;

  ctx.save();

  // ── Shadow under feet ────────────────────────────────────────────────
  ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
  ctx.beginPath();
  ctx.ellipse(sx + ts / 2, sy + ts * 0.93, ts * 0.30 * e.size, ts * 0.07 * e.size, 0, 0, Math.PI * 2);
  ctx.fill();

  // ── Elemental aura (behind the sprite) ───────────────────────────────
  // Enemies whose attacks carry an element wear that element's signature FX,
  // so the threat reads at a glance and matches its projectiles/contact hits.
  if (e.element) {
    drawElementFX(cx, cy, ts * 0.6 * e.size, e.element, 0.55, (e.id || 0) * 0.37);
  }

  // ── Blight aura (behind the sprite, over the elemental one) ──────────
  // The corrupted template's only visual tell — it deliberately does not change
  // the creature's size, because "bigger" already means Greater. A blighted
  // elemental creature wears both auras (see corruption.js).
  if (e.corrupted && typeof drawCorruptedEnemyAura === 'function') {
    drawCorruptedEnemyAura(e, cx, cy, ts * 0.52 * e.size);
  }

  // ── Per-type sprite (uses px/py which include the bob offset) ────────
  switch (e.type) {
    case 'goblin': {
      // Body
      ctx.fillStyle = '#2a5520'; ctx.fillRect(px + s*0.18, py + s*0.46, s*0.64, s*0.40);
      ctx.fillStyle = '#3a6a28'; ctx.fillRect(px + s*0.18, py + s*0.46, s*0.32, s*0.40);  // light side
      // Loincloth
      ctx.fillStyle = '#7a5018'; ctx.fillRect(px + s*0.22, py + s*0.66, s*0.56, s*0.10);
      // Head
      ctx.fillStyle = '#558844';
      ctx.beginPath(); ctx.arc(cx, py + s*0.30, s*0.26, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#3f6a30';   // shaded right
      ctx.beginPath(); ctx.arc(cx + s*0.06, py + s*0.32, s*0.22, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#558844';
      ctx.beginPath(); ctx.arc(cx - s*0.03, py + s*0.28, s*0.21, 0, Math.PI*2); ctx.fill();
      // Pointed ears
      ctx.fillStyle = '#3f6a30';
      ctx.beginPath();
      ctx.moveTo(px + s*0.18, py + s*0.30); ctx.lineTo(px + s*0.06, py + s*0.18); ctx.lineTo(px + s*0.22, py + s*0.38);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(px + s*0.82, py + s*0.30); ctx.lineTo(px + s*0.94, py + s*0.18); ctx.lineTo(px + s*0.78, py + s*0.38);
      ctx.closePath(); ctx.fill();
      // Horns
      ctx.fillStyle = '#2a1408';
      ctx.fillRect(px + s*0.30, py + s*0.04, s*0.10, s*0.16);
      ctx.fillRect(px + s*0.60, py + s*0.04, s*0.10, s*0.16);
      // Eyes (red, with white pupil dots)
      ctx.fillStyle = '#000'; ctx.fillRect(px + s*0.34, py + s*0.28, s*0.10, s*0.07);
      ctx.fillStyle = '#000'; ctx.fillRect(px + s*0.56, py + s*0.28, s*0.10, s*0.07);
      ctx.fillStyle = '#ff3322';
      ctx.fillRect(px + s*0.36, py + s*0.30, s*0.06, s*0.04);
      ctx.fillRect(px + s*0.58, py + s*0.30, s*0.06, s*0.04);
      ctx.fillStyle = '#ffeebb';
      ctx.fillRect(px + s*0.40, py + s*0.31, s*0.02, s*0.02);
      ctx.fillRect(px + s*0.62, py + s*0.31, s*0.02, s*0.02);
      // Sneer (tiny tooth)
      ctx.fillStyle = '#fff';
      ctx.fillRect(px + s*0.46, py + s*0.42, s*0.03, s*0.04);
      break;
    }
    case 'wolf': {
      // Body
      ctx.fillStyle = '#5a3a20'; ctx.fillRect(px + s*0.10, py + s*0.36, s*0.72, s*0.40);
      ctx.fillStyle = '#74502a'; ctx.fillRect(px + s*0.10, py + s*0.36, s*0.72, s*0.18);
      // Head (right-leaning, snout pointing right)
      ctx.fillStyle = '#5a3a20';
      ctx.beginPath(); ctx.arc(px + s*0.74, py + s*0.36, s*0.20, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#74502a';
      ctx.beginPath(); ctx.arc(px + s*0.72, py + s*0.32, s*0.16, 0, Math.PI*2); ctx.fill();
      // Snout
      ctx.fillStyle = '#3a2410';
      ctx.fillRect(px + s*0.84, py + s*0.36, s*0.12, s*0.10);
      ctx.fillStyle = '#000';
      ctx.fillRect(px + s*0.94, py + s*0.38, s*0.04, s*0.04);
      // Ears
      ctx.fillStyle = '#3a2410';
      ctx.beginPath();
      ctx.moveTo(px + s*0.62, py + s*0.18);
      ctx.lineTo(px + s*0.66, py + s*0.30);
      ctx.lineTo(px + s*0.74, py + s*0.22);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(px + s*0.78, py + s*0.18);
      ctx.lineTo(px + s*0.86, py + s*0.20);
      ctx.lineTo(px + s*0.82, py + s*0.30);
      ctx.closePath(); ctx.fill();
      // Yellow eye
      ctx.fillStyle = '#ffd040';
      ctx.fillRect(px + s*0.78, py + s*0.30, s*0.05, s*0.05);
      ctx.fillStyle = '#000';
      ctx.fillRect(px + s*0.80, py + s*0.31, s*0.02, s*0.03);
      // Legs (animated stagger)
      const legPhase = Math.sin(Date.now()/180 + phase) > 0;
      ctx.fillStyle = '#3a2410';
      [0.14, 0.36, 0.54, 0.72].forEach((cx2, idx) => {
        const legLen = (idx % 2 === (legPhase ? 0 : 1)) ? s*0.20 : s*0.24;
        ctx.fillRect(px + s*cx2, py + s*0.74, s*0.10, legLen);
      });
      // Tail
      ctx.strokeStyle = '#3a2410';
      ctx.lineWidth = Math.max(2, s*0.06);
      ctx.beginPath();
      ctx.moveTo(px + s*0.10, py + s*0.48);
      ctx.lineTo(px - s*0.04, py + s*0.34);
      ctx.stroke();
      break;
    }
    case 'hendricks_dog': {
      // Old Hendricks' dog. Deliberately not a small wolf: floppy ears, a collar,
      // cream socks and a stubby muzzle, so it reads as somebody's animal rather
      // than as the prologue's first monster. It is the one creature in the game
      // that cannot be killed, and it should look like it doesn't deserve to be.
      //
      // The pose carries its state, because the two phases of the encounter want
      // opposite body language: planted and growling while it blocks the gate
      // (dormant), running flat out once it is chasing.
      const dGrowl = !!e.dormant;
      // Face the player. Everything below is drawn right-facing and mirrored about
      // the sprite's centre line when it needs to look the other way — the dog sits
      // in a gap the player walks up to, so having its back turned looked wrong.
      const dFaceLeft = (typeof player !== 'undefined') && player.x < e.x;
      ctx.save();
      if (dFaceLeft) { ctx.translate(cx * 2, 0); ctx.scale(-1, 1); }

      const FUR      = '#9a7b46';
      const FUR_LIT  = '#b8955e';
      const FUR_DARK = '#6d5430';
      const SOCK     = '#e2cda6';

      // Legs, in two pairs — rear under the haunches, front under the chest, so
      // the four of them read as a dog's stance instead of four posts. The stride
      // stays small enough that a leg never walks out from under the body.
      const dStride = dGrowl ? 0 : (Math.sin(Date.now() / 110 + phase) * s * 0.055);
      ctx.fillStyle = FUR_DARK;
      ctx.fillRect(px + s*0.21 - dStride, py + s*0.70, s*0.10, s*0.22);   // rear far
      ctx.fillRect(px + s*0.57 + dStride, py + s*0.70, s*0.10, s*0.22);   // front far
      ctx.fillStyle = SOCK;
      ctx.fillRect(px + s*0.21 - dStride, py + s*0.86, s*0.10, s*0.06);
      ctx.fillRect(px + s*0.57 + dStride, py + s*0.86, s*0.10, s*0.06);

      // Tail: down and stiff while growling, up and streaming while running.
      ctx.strokeStyle = FUR_DARK;
      ctx.lineWidth = Math.max(2, s * 0.09);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(px + s*0.18, py + s*0.52);
      if (dGrowl) ctx.quadraticCurveTo(px + s*0.04, py + s*0.62, px + s*0.02, py + s*0.80);
      else        ctx.quadraticCurveTo(px - s*0.02, py + s*0.44, px + s*0.04, py + s*0.26);
      ctx.stroke();

      // Body — a low slung barrel, dipped at the shoulders when it is growling.
      const dCrouch = dGrowl ? s*0.04 : 0;
      ctx.fillStyle = FUR;
      ctx.beginPath();
      ctx.ellipse(px + s*0.46, py + s*0.60 + dCrouch, s*0.30, s*0.19, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = FUR_LIT;   // lit along the spine
      ctx.beginPath();
      ctx.ellipse(px + s*0.44, py + s*0.53 + dCrouch, s*0.26, s*0.10, 0, 0, Math.PI*2);
      ctx.fill();

      // The near pair, in front of the barrel. Same two groupings as the far pair,
      // offset the opposite way so the gait alternates.
      ctx.fillStyle = FUR;
      ctx.fillRect(px + s*0.30 + dStride, py + s*0.70 + dCrouch, s*0.11, s*0.22 - dCrouch);
      ctx.fillRect(px + s*0.66 - dStride, py + s*0.70 + dCrouch, s*0.11, s*0.22 - dCrouch);
      ctx.fillStyle = SOCK;
      ctx.fillRect(px + s*0.30 + dStride, py + s*0.86, s*0.11, s*0.06);
      ctx.fillRect(px + s*0.66 - dStride, py + s*0.86, s*0.11, s*0.06);

      // Head, carried low and forward in the growl.
      const dHeadX = px + s*0.76, dHeadY = py + s*0.42 + dCrouch * 1.6;
      ctx.fillStyle = FUR;
      ctx.beginPath(); ctx.arc(dHeadX, dHeadY, s*0.20, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = FUR_LIT;
      ctx.beginPath(); ctx.arc(dHeadX - s*0.03, dHeadY - s*0.05, s*0.15, 0, Math.PI*2); ctx.fill();

      // Floppy ear hanging down the near cheek — the single clearest "dog, not
      // wolf" cue, so it gets a full rounded lobe rather than a triangle.
      ctx.fillStyle = FUR_DARK;
      ctx.beginPath();
      ctx.ellipse(dHeadX - s*0.15, dHeadY + s*0.02, s*0.08, s*0.15, -0.25, 0, Math.PI*2);
      ctx.fill();

      // Muzzle + nose.
      ctx.fillStyle = SOCK;
      ctx.beginPath();
      ctx.ellipse(dHeadX + s*0.16, dHeadY + s*0.07, s*0.12, s*0.08, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = '#241a12';
      ctx.beginPath(); ctx.arc(dHeadX + s*0.27, dHeadY + s*0.05, s*0.045, 0, Math.PI*2); ctx.fill();

      // Bared teeth while it is growling — small, and only in that pose.
      if (dGrowl) {
        ctx.fillStyle = '#fffaf0';
        ctx.fillRect(dHeadX + s*0.14, dHeadY + s*0.12, s*0.10, s*0.035);
        ctx.fillStyle = '#241a12';
        ctx.fillRect(dHeadX + s*0.17, dHeadY + s*0.12, s*0.012, s*0.035);
      }

      // Eye — a worried little dot with a catchlight.
      ctx.fillStyle = '#241a12';
      ctx.beginPath(); ctx.arc(dHeadX + s*0.05, dHeadY - s*0.04, s*0.04, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath(); ctx.arc(dHeadX + s*0.065, dHeadY - s*0.055, s*0.015, 0, Math.PI*2); ctx.fill();
      // Raised brow. Costs four pixels and does most of the "nervous, not vicious".
      ctx.strokeStyle = FUR_DARK;
      ctx.lineWidth = Math.max(1, s*0.025);
      ctx.beginPath();
      ctx.moveTo(dHeadX - s*0.01, dHeadY - s*0.12);
      ctx.lineTo(dHeadX + s*0.10, dHeadY - s*0.10);
      ctx.stroke();

      // Hendricks' collar. It belongs to someone, and that is the whole point.
      ctx.strokeStyle = '#a33a2e';
      ctx.lineWidth = Math.max(2, s*0.07);
      ctx.beginPath();
      ctx.moveTo(dHeadX - s*0.16, dHeadY + s*0.16);
      ctx.lineTo(dHeadX - s*0.06, dHeadY + s*0.21);
      ctx.stroke();
      ctx.fillStyle = '#e8c24a';   // brass tag
      ctx.beginPath(); ctx.arc(dHeadX - s*0.10, dHeadY + s*0.24, s*0.035, 0, Math.PI*2); ctx.fill();

      ctx.lineCap = 'butt';
      ctx.restore();
      break;
    }
    case 'skeleton': {
      // Ribcage
      ctx.fillStyle = '#d6d4b6';
      ctx.fillRect(px + s*0.30, py + s*0.44, s*0.40, s*0.40);
      ctx.fillStyle = '#a8a48a';
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(px + s*0.32, py + s*0.50 + i * s*0.08, s*0.36, s*0.03);
      }
      // Spine
      ctx.fillStyle = '#a8a48a';
      ctx.fillRect(px + s*0.48, py + s*0.44, s*0.04, s*0.40);
      // Pelvis
      ctx.fillStyle = '#d6d4b6';
      ctx.fillRect(px + s*0.26, py + s*0.82, s*0.48, s*0.10);
      // Skull
      ctx.fillStyle = '#e8e6c8';
      ctx.beginPath(); ctx.arc(cx, py + s*0.26, s*0.22, 0, Math.PI*2); ctx.fill();
      // Eye sockets
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(px + s*0.40, py + s*0.26, s*0.05, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + s*0.60, py + s*0.26, s*0.05, 0, Math.PI*2); ctx.fill();
      // Soul-flame in sockets
      ctx.fillStyle = `rgba(180,220,255,${0.4 + flap * 0.5})`;
      ctx.fillRect(px + s*0.38, py + s*0.24, s*0.04, s*0.04);
      ctx.fillRect(px + s*0.58, py + s*0.24, s*0.04, s*0.04);
      // Jaw / teeth
      ctx.fillStyle = '#000';
      ctx.fillRect(px + s*0.40, py + s*0.36, s*0.20, s*0.05);
      ctx.fillStyle = '#e8e6c8';
      for (let i = 0; i < 4; i++) ctx.fillRect(px + s*0.42 + i * s*0.045, py + s*0.36, s*0.02, s*0.05);
      // Arm bones holding a bow (ranged enemy)
      ctx.strokeStyle = '#d6d4b6';
      ctx.lineWidth = Math.max(2, s*0.06);
      ctx.beginPath();
      ctx.moveTo(px + s*0.18, py + s*0.50); ctx.lineTo(px + s*0.06, py + s*0.40);
      ctx.moveTo(px + s*0.82, py + s*0.50); ctx.lineTo(px + s*0.94, py + s*0.40);
      ctx.stroke();
      break;
    }
    case 'zombie': {
      // Body — slumped pose
      ctx.fillStyle = '#4a5e2e'; ctx.fillRect(px + s*0.20, py + s*0.42, s*0.60, s*0.46);
      ctx.fillStyle = '#5a7038'; ctx.fillRect(px + s*0.20, py + s*0.42, s*0.30, s*0.46);
      // Tattered clothing rips
      ctx.fillStyle = '#2a3a18';
      ctx.fillRect(px + s*0.28, py + s*0.62, s*0.06, s*0.18);
      ctx.fillRect(px + s*0.66, py + s*0.66, s*0.06, s*0.16);
      // Head — green-grey skin, dripping
      ctx.fillStyle = '#5a7038';
      ctx.beginPath(); ctx.arc(cx, py + s*0.30, s*0.24, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#7a9048';
      ctx.beginPath(); ctx.arc(cx - s*0.04, py + s*0.28, s*0.18, 0, Math.PI*2); ctx.fill();
      // Sunken eyes
      ctx.fillStyle = '#0a0a06';
      ctx.fillRect(px + s*0.36, py + s*0.26, s*0.08, s*0.06);
      ctx.fillRect(px + s*0.56, py + s*0.26, s*0.08, s*0.06);
      ctx.fillStyle = '#ffeebb';
      ctx.fillRect(px + s*0.40, py + s*0.27, s*0.02, s*0.02);
      ctx.fillRect(px + s*0.60, py + s*0.27, s*0.02, s*0.02);
      // Drool / blood
      ctx.fillStyle = '#993322';
      ctx.fillRect(px + s*0.46, py + s*0.42, s*0.04, s*0.06);
      // Outstretched arms
      ctx.fillStyle = '#5a7038';
      ctx.fillRect(px + s*0.04, py + s*0.48, s*0.18, s*0.10);
      ctx.fillRect(px + s*0.78, py + s*0.48, s*0.18, s*0.10);
      break;
    }
    case 'cultist': {
      // Robe
      ctx.fillStyle = '#4a2266'; ctx.fillRect(px + s*0.18, py + s*0.34, s*0.64, s*0.58);
      ctx.fillStyle = '#3a1a52';
      ctx.beginPath();
      ctx.moveTo(px + s*0.18, py + s*0.34); ctx.lineTo(px + s*0.50, py + s*0.34); ctx.lineTo(px + s*0.50, py + s*0.92); ctx.lineTo(px + s*0.18, py + s*0.92);
      ctx.closePath(); ctx.fill();
      // Hood (overhang)
      ctx.fillStyle = '#1a0a26';
      ctx.beginPath();
      ctx.moveTo(px + s*0.20, py + s*0.36);
      ctx.lineTo(px + s*0.50, py + s*0.10);
      ctx.lineTo(px + s*0.80, py + s*0.36);
      ctx.closePath(); ctx.fill();
      // Glowing eyes in shadow
      ctx.fillStyle = `rgba(255,140,200,${0.6 + flap * 0.4})`;
      ctx.fillRect(px + s*0.40, py + s*0.28, s*0.06, s*0.04);
      ctx.fillRect(px + s*0.54, py + s*0.28, s*0.06, s*0.04);
      // Tassel
      ctx.fillStyle = '#ffd070';
      ctx.fillRect(px + s*0.48, py + s*0.50, s*0.04, s*0.10);
      break;
    }
    case 'dryad': {
      // Body — leafy bark
      ctx.fillStyle = '#3a6a2a'; ctx.fillRect(px + s*0.22, py + s*0.42, s*0.56, s*0.46);
      ctx.fillStyle = '#4a8a3a';
      // Leaf cluster crown
      [
        [0.5, 0.18], [0.32, 0.22], [0.68, 0.22], [0.40, 0.10], [0.60, 0.10]
      ].forEach(([fx, fy]) => {
        ctx.beginPath();
        ctx.ellipse(px + s*fx, py + s*fy, s*0.12, s*0.08, 0, 0, Math.PI*2);
        ctx.fill();
      });
      // Face
      ctx.fillStyle = '#d7a868';
      ctx.beginPath(); ctx.arc(cx, py + s*0.36, s*0.18, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.fillRect(px + s*0.40, py + s*0.34, s*0.06, s*0.05);
      ctx.fillRect(px + s*0.54, py + s*0.34, s*0.06, s*0.05);
      // Bark cracks
      ctx.strokeStyle = '#1a3a14';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px + s*0.32, py + s*0.50); ctx.lineTo(px + s*0.38, py + s*0.78);
      ctx.moveTo(px + s*0.66, py + s*0.50); ctx.lineTo(px + s*0.60, py + s*0.78);
      ctx.stroke();
      break;
    }
    case 'troll': {
      // Hulking body
      ctx.fillStyle = '#456a30'; ctx.fillRect(px + s*0.12, py + s*0.30, s*0.76, s*0.60);
      ctx.fillStyle = '#5a8a3a'; ctx.fillRect(px + s*0.12, py + s*0.30, s*0.40, s*0.60);
      // Head
      ctx.fillStyle = '#5a8a3a';
      ctx.beginPath(); ctx.arc(cx, py + s*0.22, s*0.22, 0, Math.PI*2); ctx.fill();
      // Tusks
      ctx.fillStyle = '#f0e6c0';
      ctx.beginPath();
      ctx.moveTo(px + s*0.40, py + s*0.32); ctx.lineTo(px + s*0.43, py + s*0.46); ctx.lineTo(px + s*0.47, py + s*0.32);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(px + s*0.53, py + s*0.32); ctx.lineTo(px + s*0.57, py + s*0.46); ctx.lineTo(px + s*0.60, py + s*0.32);
      ctx.closePath(); ctx.fill();
      // Tiny eyes
      ctx.fillStyle = '#000';
      ctx.fillRect(px + s*0.40, py + s*0.20, s*0.07, s*0.05);
      ctx.fillRect(px + s*0.53, py + s*0.20, s*0.07, s*0.05);
      ctx.fillStyle = '#ffaa44';
      ctx.fillRect(px + s*0.42, py + s*0.21, s*0.02, s*0.03);
      ctx.fillRect(px + s*0.55, py + s*0.21, s*0.02, s*0.03);
      // Club
      ctx.fillStyle = '#3a2410';
      ctx.fillRect(px + s*0.84, py + s*0.30, s*0.10, s*0.42);
      ctx.fillStyle = '#553a18';
      ctx.beginPath(); ctx.arc(px + s*0.89, py + s*0.28, s*0.10, 0, Math.PI*2); ctx.fill();
      break;
    }
    case 'wyvern': {
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
    case 'vampire': {
      // Cape
      ctx.fillStyle = '#1a0612';
      ctx.beginPath();
      ctx.moveTo(px + s*0.50, py + s*0.40);
      ctx.lineTo(px + s*0.06, py + s*0.86);
      ctx.lineTo(px + s*0.94, py + s*0.86);
      ctx.closePath(); ctx.fill();
      // Body
      ctx.fillStyle = '#2a0a18';
      ctx.fillRect(px + s*0.32, py + s*0.42, s*0.36, s*0.42);
      // Red sash
      ctx.fillStyle = '#aa1122';
      ctx.fillRect(px + s*0.32, py + s*0.66, s*0.36, s*0.06);
      // Pale face
      ctx.fillStyle = '#f0e0d8';
      ctx.beginPath(); ctx.arc(cx, py + s*0.28, s*0.20, 0, Math.PI*2); ctx.fill();
      // Slicked hair
      ctx.fillStyle = '#0a0606';
      ctx.fillRect(px + s*0.30, py + s*0.10, s*0.40, s*0.12);
      // Red eyes
      ctx.fillStyle = '#ff0022';
      ctx.fillRect(px + s*0.36, py + s*0.28, s*0.07, s*0.05);
      ctx.fillRect(px + s*0.57, py + s*0.28, s*0.07, s*0.05);
      // Fangs
      ctx.fillStyle = '#fff';
      ctx.fillRect(px + s*0.44, py + s*0.38, s*0.03, s*0.05);
      ctx.fillRect(px + s*0.53, py + s*0.38, s*0.03, s*0.05);
      break;
    }
    case 'wraith': {
      // Aura
      const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, s*0.55);
      aura.addColorStop(0, `rgba(100,160,200,${0.45 + flap * 0.25})`);
      aura.addColorStop(1, 'rgba(100,160,200,0)');
      ctx.fillStyle = aura;
      ctx.fillRect(sx - ts*0.1, sy - ts*0.1, ts*1.2, ts*1.2);
      // Tattered robe — wavering bottom
      ctx.fillStyle = '#2a3a4a';
      ctx.beginPath();
      ctx.moveTo(px + s*0.20, py + s*0.30);
      ctx.lineTo(px + s*0.80, py + s*0.30);
      for (let i = 6; i >= 0; i--) {
        const fx = px + s*0.20 + (s*0.60) * (i/6);
        const fy = py + s*0.90 + Math.sin(Date.now()/240 + phase + i*0.6) * s*0.05;
        ctx.lineTo(fx, fy);
      }
      ctx.closePath(); ctx.fill();
      // Hood shadow
      ctx.fillStyle = '#0a1218';
      ctx.beginPath();
      ctx.moveTo(px + s*0.22, py + s*0.34);
      ctx.lineTo(px + s*0.50, py + s*0.10);
      ctx.lineTo(px + s*0.78, py + s*0.34);
      ctx.closePath(); ctx.fill();
      // Glowing eyes
      ctx.fillStyle = `rgba(140,220,255,${0.7 + flap * 0.3})`;
      ctx.fillRect(px + s*0.38, py + s*0.24, s*0.08, s*0.05);
      ctx.fillRect(px + s*0.54, py + s*0.24, s*0.08, s*0.05);
      break;
    }
    case 'pixie': {
      // Trailing sparkles
      for (let i = 0; i < 4; i++) {
        const a = Date.now()/300 + i + phase;
        ctx.fillStyle = `rgba(180,220,255,${0.4 + 0.4 * Math.sin(a)})`;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * s*0.32, cy + Math.sin(a) * s*0.32, s*0.04, 0, Math.PI*2);
        ctx.fill();
      }
      // Wings (translucent, fluttering)
      const wing = 1 + Math.sin(Date.now()/60 + phase) * 0.4;
      ctx.fillStyle = `rgba(200,220,255,${0.4 + flap * 0.2})`;
      ctx.beginPath();
      ctx.ellipse(cx - s*0.22, cy - s*0.04, s*0.20 * wing, s*0.14, -0.3, 0, Math.PI*2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + s*0.22, cy - s*0.04, s*0.20 * wing, s*0.14, 0.3, 0, Math.PI*2);
      ctx.fill();
      // Body
      ctx.fillStyle = '#88aaff';
      ctx.beginPath(); ctx.arc(cx, cy, s*0.20, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#c0d8ff';
      ctx.beginPath(); ctx.arc(cx - s*0.05, cy - s*0.04, s*0.14, 0, Math.PI*2); ctx.fill();
      // Tiny eyes
      ctx.fillStyle = '#000';
      ctx.fillRect(cx - s*0.08, cy - s*0.02, s*0.03, s*0.03);
      ctx.fillRect(cx + s*0.05, cy - s*0.02, s*0.03, s*0.03);
      break;
    }
    case 'displacer': {
      // Body (long panther shape)
      ctx.fillStyle = '#22153a';
      ctx.beginPath(); ctx.ellipse(cx, py + s*0.62, s*0.36, s*0.20, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#3a2a55';
      ctx.beginPath(); ctx.ellipse(cx - s*0.04, py + s*0.58, s*0.26, s*0.15, 0, 0, Math.PI*2); ctx.fill();
      // Head
      ctx.fillStyle = '#3a2a55';
      ctx.beginPath(); ctx.arc(px + s*0.26, py + s*0.46, s*0.18, 0, Math.PI*2); ctx.fill();
      // Two tentacles (animated)
      ctx.strokeStyle = '#554488';
      ctx.lineWidth = Math.max(2, s*0.06);
      ctx.lineCap = 'round';
      [-1, 1].forEach((side, i) => {
        const sway = Math.sin(Date.now()/200 + phase + i) * s*0.10;
        ctx.beginPath();
        ctx.moveTo(px + s*0.20, py + s*0.40);
        ctx.quadraticCurveTo(px + (0.04 + side*0.0) * s, py + s*(0.18 + i*0.05), px + s*0.06 + sway, py + s*0.06);
        ctx.stroke();
      });
      // Tentacle tip pads
      ctx.fillStyle = '#aa66dd';
      [-1, 1].forEach((side, i) => {
        const sway = Math.sin(Date.now()/200 + phase + i) * s*0.10;
        ctx.beginPath(); ctx.arc(px + s*0.06 + sway, py + s*0.06, s*0.05, 0, Math.PI*2); ctx.fill();
      });
      // Eyes
      ctx.fillStyle = '#ffcc44';
      ctx.fillRect(px + s*0.20, py + s*0.42, s*0.05, s*0.04);
      ctx.fillRect(px + s*0.30, py + s*0.42, s*0.05, s*0.04);
      // Tail
      ctx.strokeStyle = '#3a2a55';
      ctx.lineWidth = Math.max(2, s*0.05);
      ctx.beginPath();
      ctx.moveTo(px + s*0.84, py + s*0.60);
      ctx.lineTo(px + s*0.98, py + s*0.42 + Math.sin(Date.now()/200 + phase) * s*0.04);
      ctx.stroke();
      break;
    }
    case 'beholder': {
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
    case 'treant': {
      // Bark trunk
      ctx.fillStyle = '#2a3a1a';
      ctx.fillRect(px + s*0.30, py + s*0.40, s*0.40, s*0.50);
      ctx.fillStyle = '#3a4a22';
      ctx.fillRect(px + s*0.30, py + s*0.40, s*0.20, s*0.50);
      // Bark grain
      ctx.strokeStyle = '#1a2a0a';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(px + s*0.34, py + s*0.46 + i * s*0.14);
        ctx.lineTo(px + s*0.66, py + s*0.46 + i * s*0.14 + s*0.04);
        ctx.stroke();
      }
      // Roots
      ctx.fillStyle = '#1a2a0a';
      ctx.fillRect(px + s*0.20, py + s*0.86, s*0.18, s*0.10);
      ctx.fillRect(px + s*0.62, py + s*0.86, s*0.18, s*0.10);
      // Leafy crown
      ctx.fillStyle = '#3a6a22';
      [[0.50, 0.30], [0.30, 0.34], [0.70, 0.34], [0.40, 0.20], [0.60, 0.20], [0.50, 0.12]].forEach(([fx, fy]) => {
        ctx.beginPath(); ctx.arc(px + s*fx, py + s*fy, s*0.16, 0, Math.PI*2); ctx.fill();
      });
      ctx.fillStyle = '#4a8a32';
      [[0.45, 0.26], [0.58, 0.30], [0.50, 0.16]].forEach(([fx, fy]) => {
        ctx.beginPath(); ctx.arc(px + s*fx, py + s*fy, s*0.10, 0, Math.PI*2); ctx.fill();
      });
      // Branch arms
      ctx.strokeStyle = '#2a3a1a';
      ctx.lineWidth = Math.max(3, s*0.10);
      ctx.beginPath();
      ctx.moveTo(px + s*0.30, py + s*0.50);
      ctx.lineTo(px + s*0.06, py + s*0.32);
      ctx.moveTo(px + s*0.70, py + s*0.50);
      ctx.lineTo(px + s*0.94, py + s*0.32);
      ctx.stroke();
      // Glowing eyes
      ctx.fillStyle = `rgba(255,90,30,${0.7 + flap * 0.3})`;
      ctx.fillRect(px + s*0.40, py + s*0.50, s*0.08, s*0.06);
      ctx.fillRect(px + s*0.54, py + s*0.50, s*0.08, s*0.06);
      // Gnarled mouth
      ctx.fillStyle = '#0a1206';
      ctx.fillRect(px + s*0.44, py + s*0.62, s*0.12, s*0.04);
      break;
    }
    case 'owlbear': {
      // Body
      ctx.fillStyle = '#4a3208'; ctx.fillRect(px + s*0.16, py + s*0.34, s*0.68, s*0.56);
      ctx.fillStyle = '#7a5018'; ctx.fillRect(px + s*0.16, py + s*0.34, s*0.34, s*0.56);
      // Chest tuft
      ctx.fillStyle = '#c8a464';
      ctx.beginPath(); ctx.ellipse(cx, py + s*0.62, s*0.18, s*0.20, 0, 0, Math.PI*2); ctx.fill();
      // Head (rounded owl head)
      ctx.fillStyle = '#8a6622';
      ctx.beginPath(); ctx.arc(cx, py + s*0.28, s*0.28, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#a07a30';
      ctx.beginPath(); ctx.arc(cx - s*0.06, py + s*0.26, s*0.22, 0, Math.PI*2); ctx.fill();
      // Big owl eyes
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(px + s*0.40, py + s*0.26, s*0.10, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + s*0.60, py + s*0.26, s*0.10, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#ffaa00';
      ctx.beginPath(); ctx.arc(px + s*0.40, py + s*0.26, s*0.07, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + s*0.60, py + s*0.26, s*0.07, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(px + s*0.40, py + s*0.26, s*0.035, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + s*0.60, py + s*0.26, s*0.035, 0, Math.PI*2); ctx.fill();
      // Beak
      ctx.fillStyle = '#552a08';
      ctx.beginPath();
      ctx.moveTo(px + s*0.46, py + s*0.34);
      ctx.lineTo(px + s*0.54, py + s*0.34);
      ctx.lineTo(px + s*0.50, py + s*0.42);
      ctx.closePath(); ctx.fill();
      // Ear tufts
      ctx.fillStyle = '#4a3208';
      ctx.beginPath(); ctx.moveTo(px + s*0.24, py + s*0.10); ctx.lineTo(px + s*0.30, py + s*0.04); ctx.lineTo(px + s*0.34, py + s*0.14); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px + s*0.76, py + s*0.10); ctx.lineTo(px + s*0.70, py + s*0.04); ctx.lineTo(px + s*0.66, py + s*0.14); ctx.closePath(); ctx.fill();
      // Claws
      ctx.fillStyle = '#f0e0a0';
      ctx.fillRect(px + s*0.18, py + s*0.86, s*0.04, s*0.06);
      ctx.fillRect(px + s*0.78, py + s*0.86, s*0.04, s*0.06);
      break;
    }
    case 'lich':
    case 'lich_boss': {
      // Boss aura
      if (e.boss) {
        const auraR = s*0.65 + Math.sin(Date.now()/220) * s*0.04;
        const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, auraR);
        aura.addColorStop(0, 'rgba(180, 60, 255, 0.45)');
        aura.addColorStop(1, 'rgba(180, 60, 255, 0)');
        ctx.fillStyle = aura;
        ctx.fillRect(cx - auraR, cy - auraR, auraR*2, auraR*2);
      }
      // Tattered robe (sway)
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.moveTo(px + s*0.22, py + s*0.34);
      ctx.lineTo(px + s*0.78, py + s*0.34);
      for (let i = 7; i >= 0; i--) {
        const fx = px + s*0.22 + (s*0.56) * (i/7);
        const fy = py + s*0.92 + Math.sin(Date.now()/220 + phase + i*0.5) * s*0.04;
        ctx.lineTo(fx, fy);
      }
      ctx.closePath(); ctx.fill();
      // Inner shadow
      ctx.fillStyle = 'rgba(0,0,0,0.40)';
      ctx.fillRect(px + s*0.40, py + s*0.38, s*0.20, s*0.45);
      // Skull head
      ctx.fillStyle = '#e8e4c0';
      ctx.beginPath(); ctx.arc(cx, py + s*0.26, s*0.22, 0, Math.PI*2); ctx.fill();
      // Jaw
      ctx.fillStyle = '#000';
      ctx.fillRect(px + s*0.40, py + s*0.36, s*0.20, s*0.06);
      ctx.fillStyle = '#e8e4c0';
      for (let i = 0; i < 4; i++) ctx.fillRect(px + s*0.41 + i * s*0.046, py + s*0.36, s*0.024, s*0.06);
      // Glowing soul eyes
      ctx.fillStyle = `rgba(180,80,255,${0.7 + flap * 0.3})`;
      ctx.fillRect(px + s*0.38, py + s*0.24, s*0.08, s*0.05);
      ctx.fillRect(px + s*0.54, py + s*0.24, s*0.08, s*0.05);
      ctx.fillStyle = '#fff';
      ctx.fillRect(px + s*0.40, py + s*0.25, s*0.03, s*0.03);
      ctx.fillRect(px + s*0.56, py + s*0.25, s*0.03, s*0.03);
      // Crown
      ctx.fillStyle = '#ffcc00';
      ctx.fillRect(px + s*0.32, py + s*0.06, s*0.36, s*0.06);
      [0.34, 0.42, 0.50, 0.58, 0.66].forEach(fx => {
        ctx.beginPath();
        ctx.moveTo(px + s*fx, py + s*0.06);
        ctx.lineTo(px + s*(fx + 0.04), py + s*0.06);
        ctx.lineTo(px + s*(fx + 0.02), py - s*0.02);
        ctx.closePath(); ctx.fill();
      });
      // Floating spell-orb
      const orbY = py + s*0.50 + Math.sin(Date.now()/180 + phase) * s*0.04;
      ctx.fillStyle = `rgba(220,120,255,${0.6 + flap * 0.4})`;
      ctx.beginPath(); ctx.arc(px + s*0.10, orbY, s*0.10, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(px + s*0.10, orbY, s*0.04, 0, Math.PI*2); ctx.fill();
      break;
    }
    case 'mummy_lord': {
      // Amber boss aura
      if (e.boss) {
        const auraR = s*0.65 + Math.sin(Date.now()/220) * s*0.04;
        const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, auraR);
        aura.addColorStop(0, 'rgba(230, 180, 60, 0.45)');
        aura.addColorStop(1, 'rgba(230, 180, 60, 0)');
        ctx.fillStyle = aura;
        ctx.fillRect(cx - auraR, cy - auraR, auraR*2, auraR*2);
      }
      // Bandaged body
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.moveTo(px + s*0.26, py + s*0.32);
      ctx.lineTo(px + s*0.74, py + s*0.32);
      ctx.lineTo(px + s*0.70, py + s*0.92);
      ctx.lineTo(px + s*0.30, py + s*0.92);
      ctx.closePath(); ctx.fill();
      // Bandage wrap lines (sway slightly so it reads as cloth)
      ctx.strokeStyle = 'rgba(120,90,40,0.55)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 5; i++) {
        const wy = py + s*(0.40 + i*0.11) + Math.sin(Date.now()/300 + phase + i) * s*0.01;
        ctx.beginPath();
        ctx.moveTo(px + s*0.28, wy);
        ctx.lineTo(px + s*0.72, wy + s*0.03);
        ctx.stroke();
      }
      // Crossed arm bandages
      ctx.strokeStyle = 'rgba(120,90,40,0.7)';
      ctx.beginPath(); ctx.moveTo(px + s*0.30, py + s*0.44); ctx.lineTo(px + s*0.70, py + s*0.62); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px + s*0.70, py + s*0.44); ctx.lineTo(px + s*0.30, py + s*0.62); ctx.stroke();
      // Head (wrapped, with an exposed face slit)
      ctx.fillStyle = '#e8d8a8';
      ctx.beginPath(); ctx.arc(cx, py + s*0.24, s*0.22, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(120,90,40,0.5)';
      ctx.fillRect(px + s*0.30, py + s*0.16, s*0.40, s*0.02);
      ctx.fillRect(px + s*0.30, py + s*0.30, s*0.40, s*0.02);
      // Pharaoh nemes headdress — gold band with blue stripes
      ctx.fillStyle = '#ffcc33';
      ctx.fillRect(px + s*0.26, py + s*0.06, s*0.48, s*0.07);
      ctx.fillStyle = '#2a6ac0';
      for (let i = 0; i < 4; i++) ctx.fillRect(px + s*0.29 + i*s*0.12, py + s*0.06, s*0.04, s*0.07);
      // Lappets framing the face
      ctx.fillStyle = '#ffcc33';
      ctx.fillRect(px + s*0.22, py + s*0.12, s*0.06, s*0.26);
      ctx.fillRect(px + s*0.72, py + s*0.12, s*0.06, s*0.26);
      // Glowing eyes
      ctx.fillStyle = `rgba(120,220,200,${0.7 + flap * 0.3})`;
      ctx.fillRect(px + s*0.38, py + s*0.22, s*0.08, s*0.05);
      ctx.fillRect(px + s*0.54, py + s*0.22, s*0.08, s*0.05);
      ctx.fillStyle = '#fff';
      ctx.fillRect(px + s*0.40, py + s*0.23, s*0.03, s*0.03);
      ctx.fillRect(px + s*0.56, py + s*0.23, s*0.03, s*0.03);
      break;
    }
    case 'giant_spider': {
      // Legs — 4 per side, skittering
      ctx.strokeStyle = '#241c2e'; ctx.lineWidth = Math.max(2, s*0.05); ctx.lineCap = 'round';
      for (let i = 0; i < 4; i++) {
        const ly = py + s*0.40 + i * s*0.10;
        const k = Math.sin(Date.now()/160 + phase + i) * s*0.04;
        ctx.beginPath();
        ctx.moveTo(cx - s*0.10, py + s*0.54); ctx.lineTo(px + s*0.02, ly + k);
        ctx.moveTo(cx + s*0.10, py + s*0.54); ctx.lineTo(px + s*0.98, ly - k);
        ctx.stroke();
      }
      // Abdomen
      ctx.fillStyle = '#352841';
      ctx.beginPath(); ctx.ellipse(cx, py + s*0.66, s*0.26, s*0.22, 0, 0, Math.PI*2); ctx.fill();
      // Hourglass marking
      ctx.fillStyle = '#aa3344';
      ctx.beginPath(); ctx.moveTo(cx, py + s*0.56); ctx.lineTo(cx - s*0.06, py + s*0.66); ctx.lineTo(cx, py + s*0.76); ctx.lineTo(cx + s*0.06, py + s*0.66); ctx.closePath(); ctx.fill();
      // Cephalothorax
      ctx.fillStyle = '#4a3a55';
      ctx.beginPath(); ctx.arc(cx, py + s*0.42, s*0.16, 0, Math.PI*2); ctx.fill();
      // Cluster of red eyes
      ctx.fillStyle = '#ff3344';
      [[-0.06,0.38],[0.06,0.38],[-0.03,0.44],[0.03,0.44]].forEach(([ex,ey]) => ctx.fillRect(cx + s*ex, py + s*ey, s*0.03, s*0.03));
      // Fangs
      ctx.fillStyle = '#e8e0d0';
      ctx.fillRect(cx - s*0.05, py + s*0.50, s*0.03, s*0.05);
      ctx.fillRect(cx + s*0.02, py + s*0.50, s*0.03, s*0.05);
      break;
    }
    case 'magma_mephit': {
      // Wings (small bat wings, flapping)
      const mwf = Math.sin(Date.now()/100 + phase) * 0.25 + 1;
      ctx.fillStyle = '#6a1a0a';
      ctx.beginPath(); ctx.moveTo(cx - s*0.10, py + s*0.44); ctx.lineTo(px + s*0.02, py + s*0.30/mwf); ctx.lineTo(px + s*0.08, py + s*0.56); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + s*0.10, py + s*0.44); ctx.lineTo(px + s*0.98, py + s*0.30/mwf); ctx.lineTo(px + s*0.92, py + s*0.56); ctx.closePath(); ctx.fill();
      // Body — dark crust
      ctx.fillStyle = '#3a1408';
      ctx.beginPath(); ctx.arc(cx, py + s*0.54, s*0.24, 0, Math.PI*2); ctx.fill();
      // Glowing lava cracks
      ctx.strokeStyle = `rgba(255,140,40,${0.6 + flap*0.4})`; ctx.lineWidth = Math.max(1.5, s*0.04);
      ctx.beginPath();
      ctx.moveTo(cx - s*0.12, py + s*0.46); ctx.lineTo(cx - s*0.02, py + s*0.58); ctx.lineTo(cx - s*0.10, py + s*0.66);
      ctx.moveTo(cx + s*0.10, py + s*0.44); ctx.lineTo(cx + s*0.02, py + s*0.56);
      ctx.stroke();
      // Head
      ctx.fillStyle = '#3a1408';
      ctx.beginPath(); ctx.arc(cx, py + s*0.30, s*0.16, 0, Math.PI*2); ctx.fill();
      // Horns
      ctx.fillStyle = '#1a0a04';
      ctx.beginPath(); ctx.moveTo(cx - s*0.10, py + s*0.20); ctx.lineTo(cx - s*0.16, py + s*0.06); ctx.lineTo(cx - s*0.04, py + s*0.18); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + s*0.10, py + s*0.20); ctx.lineTo(cx + s*0.16, py + s*0.06); ctx.lineTo(cx + s*0.04, py + s*0.18); ctx.closePath(); ctx.fill();
      // Burning eyes
      ctx.fillStyle = `rgba(255,210,80,${0.7 + flap*0.3})`;
      ctx.fillRect(cx - s*0.08, py + s*0.28, s*0.05, s*0.04);
      ctx.fillRect(cx + s*0.03, py + s*0.28, s*0.05, s*0.04);
      break;
    }
    case 'gnoll': {
      // Body
      ctx.fillStyle = '#6a5226'; ctx.fillRect(px + s*0.26, py + s*0.42, s*0.42, s*0.46);
      ctx.fillStyle = '#84682e'; ctx.fillRect(px + s*0.26, py + s*0.42, s*0.21, s*0.46);
      // Spear
      ctx.strokeStyle = '#3a2410'; ctx.lineWidth = Math.max(2, s*0.05);
      ctx.beginPath(); ctx.moveTo(px + s*0.80, py + s*0.10); ctx.lineTo(px + s*0.80, py + s*0.92); ctx.stroke();
      ctx.fillStyle = '#bcb0a0';
      ctx.beginPath(); ctx.moveTo(px + s*0.80, py + s*0.02); ctx.lineTo(px + s*0.74, py + s*0.18); ctx.lineTo(px + s*0.86, py + s*0.18); ctx.closePath(); ctx.fill();
      // Hyena head (snout right)
      ctx.fillStyle = '#84682e';
      ctx.beginPath(); ctx.arc(px + s*0.44, py + s*0.30, s*0.20, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#6a5226'; ctx.fillRect(px + s*0.52, py + s*0.30, s*0.20, s*0.12);
      ctx.fillStyle = '#1a1206'; ctx.fillRect(px + s*0.70, py + s*0.32, s*0.04, s*0.04);
      // Mane spikes
      ctx.fillStyle = '#4a3a1a';
      [0.30,0.40,0.50].forEach(fx => { ctx.beginPath(); ctx.moveTo(px + s*fx, py + s*0.14); ctx.lineTo(px + s*(fx+0.04), py + s*0.02); ctx.lineTo(px + s*(fx+0.08), py + s*0.16); ctx.closePath(); ctx.fill(); });
      // Eye + teeth
      ctx.fillStyle = '#ffcc33'; ctx.fillRect(px + s*0.46, py + s*0.26, s*0.06, s*0.04);
      ctx.fillStyle = '#000'; ctx.fillRect(px + s*0.48, py + s*0.27, s*0.02, s*0.02);
      ctx.fillStyle = '#fff'; ctx.fillRect(px + s*0.58, py + s*0.40, s*0.10, s*0.03);
      break;
    }
    case 'hell_hound': {
      // Flame aura
      const ha = ctx.createRadialGradient(cx, py + s*0.55, 0, cx, py + s*0.55, s*0.5);
      ha.addColorStop(0, `rgba(255,120,30,${0.35 + flap*0.25})`);
      ha.addColorStop(1, 'rgba(255,60,10,0)');
      ctx.fillStyle = ha; ctx.fillRect(sx - ts*0.1, sy - ts*0.1, ts*1.2, ts*1.2);
      // Body
      ctx.fillStyle = '#1a1010'; ctx.fillRect(px + s*0.14, py + s*0.46, s*0.62, s*0.34);
      ctx.fillStyle = '#33201c'; ctx.fillRect(px + s*0.14, py + s*0.46, s*0.62, s*0.16);
      // Head (right)
      ctx.fillStyle = '#1a1010';
      ctx.beginPath(); ctx.arc(px + s*0.74, py + s*0.46, s*0.18, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#33201c'; ctx.fillRect(px + s*0.84, py + s*0.46, s*0.12, s*0.08);
      // Ear
      ctx.fillStyle = '#1a1010';
      ctx.beginPath(); ctx.moveTo(px + s*0.64, py + s*0.30); ctx.lineTo(px + s*0.68, py + s*0.40); ctx.lineTo(px + s*0.74, py + s*0.32); ctx.closePath(); ctx.fill();
      // Burning eye + maw
      ctx.fillStyle = `rgba(255,180,40,${0.7 + flap*0.3})`; ctx.fillRect(px + s*0.78, py + s*0.42, s*0.05, s*0.04);
      ctx.fillStyle = '#ff5510'; ctx.fillRect(px + s*0.86, py + s*0.52, s*0.08, s*0.03);
      // Legs
      ctx.fillStyle = '#1a1010';
      [0.20,0.40,0.58].forEach(fx => ctx.fillRect(px + s*fx, py + s*0.78, s*0.08, s*0.14));
      // Flame mane flicker
      ctx.fillStyle = `rgba(255,140,30,${0.6 + flap*0.4})`;
      [0.30,0.44,0.58].forEach((fx,i) => { const fl = Math.sin(Date.now()/110 + i + phase)*s*0.04; ctx.beginPath(); ctx.moveTo(px + s*fx, py + s*0.46); ctx.lineTo(px + s*(fx+0.03), py + s*0.30 - fl); ctx.lineTo(px + s*(fx+0.07), py + s*0.46); ctx.closePath(); ctx.fill(); });
      break;
    }
    case 'giant_scorpion': {
      // Body segments
      ctx.fillStyle = '#7a5e22';
      ctx.beginPath(); ctx.ellipse(cx, py + s*0.60, s*0.22, s*0.16, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#94772e';
      ctx.beginPath(); ctx.ellipse(cx, py + s*0.56, s*0.16, s*0.10, 0, 0, Math.PI*2); ctx.fill();
      // Legs
      ctx.strokeStyle = '#5a4418'; ctx.lineWidth = Math.max(1.5, s*0.04); ctx.lineCap = 'round';
      for (let i=0;i<3;i++){ const ly = py + s*0.56 + i*s*0.08; ctx.beginPath(); ctx.moveTo(cx - s*0.12, ly); ctx.lineTo(px + s*0.04, ly + s*0.10); ctx.moveTo(cx + s*0.12, ly); ctx.lineTo(px + s*0.96, ly + s*0.10); ctx.stroke(); }
      // Pincers
      ctx.fillStyle = '#94772e';
      ctx.beginPath(); ctx.arc(px + s*0.16, py + s*0.46, s*0.10, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + s*0.84, py + s*0.46, s*0.10, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#5a4418';
      ctx.fillRect(px + s*0.08, py + s*0.40, s*0.06, s*0.10);
      ctx.fillRect(px + s*0.86, py + s*0.40, s*0.06, s*0.10);
      // Tail arcing over
      ctx.fillStyle = '#7a5e22';
      [[0.62,0.50],[0.70,0.38],[0.74,0.24],[0.70,0.12]].forEach(([fx,fy]) => { ctx.beginPath(); ctx.arc(px + s*fx, py + s*fy, s*0.06, 0, Math.PI*2); ctx.fill(); });
      // Stinger
      ctx.fillStyle = '#3a2a0a';
      ctx.beginPath(); ctx.moveTo(px + s*0.66, py + s*0.10); ctx.lineTo(px + s*0.60, py + s*0.02); ctx.lineTo(px + s*0.74, py + s*0.10); ctx.closePath(); ctx.fill();
      // Eyes
      ctx.fillStyle = '#1a1206';
      ctx.fillRect(cx - s*0.05, py + s*0.52, s*0.03, s*0.03);
      ctx.fillRect(cx + s*0.02, py + s*0.52, s*0.03, s*0.03);
      break;
    }
    case 'salamander': {
      // Heat glow
      const sga = ctx.createRadialGradient(cx, cy, 0, cx, cy, s*0.5);
      sga.addColorStop(0, `rgba(255,110,30,${0.3 + flap*0.2})`);
      sga.addColorStop(1, 'rgba(255,60,10,0)');
      ctx.fillStyle = sga; ctx.fillRect(sx - ts*0.1, sy - ts*0.1, ts*1.2, ts*1.2);
      // Coiled serpent body
      ctx.strokeStyle = '#cc3a14'; ctx.lineWidth = Math.max(4, s*0.16); ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(px + s*0.16, py + s*0.86);
      ctx.quadraticCurveTo(px + s*0.92, py + s*0.78, px + s*0.60, py + s*0.54);
      ctx.quadraticCurveTo(px + s*0.30, py + s*0.34, cx, py + s*0.26);
      ctx.stroke();
      ctx.strokeStyle = '#ff6a2a'; ctx.lineWidth = Math.max(2, s*0.07);
      ctx.beginPath();
      ctx.moveTo(px + s*0.18, py + s*0.84);
      ctx.quadraticCurveTo(px + s*0.86, py + s*0.76, px + s*0.58, py + s*0.54);
      ctx.stroke();
      // Head
      ctx.fillStyle = '#cc3a14';
      ctx.beginPath(); ctx.arc(cx, py + s*0.24, s*0.16, 0, Math.PI*2); ctx.fill();
      // Snake eyes
      ctx.fillStyle = '#ffe070';
      ctx.fillRect(cx - s*0.08, py + s*0.20, s*0.05, s*0.04);
      ctx.fillRect(cx + s*0.03, py + s*0.20, s*0.05, s*0.04);
      ctx.fillStyle = '#000';
      ctx.fillRect(cx - s*0.06, py + s*0.21, s*0.015, s*0.03);
      ctx.fillRect(cx + s*0.05, py + s*0.21, s*0.015, s*0.03);
      // Forked tongue
      ctx.strokeStyle = '#ffcc40'; ctx.lineWidth = Math.max(1.5, s*0.03);
      ctx.beginPath(); ctx.moveTo(cx, py + s*0.34); ctx.lineTo(cx, py + s*0.42); ctx.stroke();
      break;
    }
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
      ctx.fillStyle = sha; ctx.fillRect(sx - ts*0.1, sy - ts*0.1, ts*1.2, ts*1.2);
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
    case 'gargoyle': {
      const gwf = Math.sin(Date.now()/140 + phase)*0.15 + 1;
      // Stone wings
      ctx.fillStyle = '#5a564e';
      ctx.beginPath(); ctx.moveTo(cx - s*0.06, py + s*0.40); ctx.lineTo(px + s*0.0, py + s*0.20/gwf); ctx.lineTo(px + s*0.10, py + s*0.30); ctx.lineTo(px + s*0.06, py + s*0.54); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + s*0.06, py + s*0.40); ctx.lineTo(px + s*1.0, py + s*0.20/gwf); ctx.lineTo(px + s*0.90, py + s*0.30); ctx.lineTo(px + s*0.94, py + s*0.54); ctx.closePath(); ctx.fill();
      // Crouched body
      ctx.fillStyle = '#6f6a60'; ctx.fillRect(px + s*0.30, py + s*0.46, s*0.40, s*0.40);
      ctx.fillStyle = '#827c70'; ctx.fillRect(px + s*0.30, py + s*0.46, s*0.20, s*0.40);
      // Head
      ctx.fillStyle = '#827c70';
      ctx.beginPath(); ctx.arc(cx, py + s*0.34, s*0.17, 0, Math.PI*2); ctx.fill();
      // Horns
      ctx.fillStyle = '#4a463e';
      ctx.beginPath(); ctx.moveTo(px + s*0.40, py + s*0.24); ctx.lineTo(px + s*0.34, py + s*0.10); ctx.lineTo(px + s*0.46, py + s*0.22); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px + s*0.60, py + s*0.24); ctx.lineTo(px + s*0.66, py + s*0.10); ctx.lineTo(px + s*0.54, py + s*0.22); ctx.closePath(); ctx.fill();
      // Glowing eyes + snarl
      ctx.fillStyle = `rgba(255,210,120,${0.6+flap*0.3})`;
      ctx.fillRect(px + s*0.42, py + s*0.32, s*0.06, s*0.04); ctx.fillRect(px + s*0.54, py + s*0.32, s*0.06, s*0.04);
      ctx.fillStyle = '#2a2620'; ctx.fillRect(px + s*0.44, py + s*0.42, s*0.12, s*0.03);
      // Crack
      ctx.strokeStyle = '#4a463e'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(px + s*0.40, py + s*0.52); ctx.lineTo(px + s*0.48, py + s*0.70); ctx.stroke();
      break;
    }
    case 'ankheg': {
      // Segmented body (arched)
      const segs = [[0.20,0.62],[0.34,0.54],[0.48,0.50],[0.62,0.54],[0.76,0.62]];
      ctx.fillStyle = '#5e5226';
      segs.forEach(([fx,fy]) => { ctx.beginPath(); ctx.ellipse(px + s*fx, py + s*fy, s*0.12, s*0.10, 0, 0, Math.PI*2); ctx.fill(); });
      ctx.fillStyle = '#7a6c34';
      segs.forEach(([fx,fy]) => { ctx.beginPath(); ctx.ellipse(px + s*fx, py + s*(fy-0.02), s*0.07, s*0.05, 0, 0, Math.PI*2); ctx.fill(); });
      // Legs
      ctx.strokeStyle = '#3e3618'; ctx.lineWidth = Math.max(1.5, s*0.04); ctx.lineCap = 'round';
      [0.30,0.48,0.66].forEach(fx => { ctx.beginPath(); ctx.moveTo(px + s*fx, py + s*0.62); ctx.lineTo(px + s*(fx-0.06), py + s*0.84); ctx.moveTo(px + s*fx, py + s*0.62); ctx.lineTo(px + s*(fx+0.06), py + s*0.84); ctx.stroke(); });
      // Head
      ctx.fillStyle = '#7a6c34';
      ctx.beginPath(); ctx.arc(px + s*0.18, py + s*0.46, s*0.14, 0, Math.PI*2); ctx.fill();
      // Mandibles
      ctx.strokeStyle = '#3e3618'; ctx.lineWidth = Math.max(2, s*0.05);
      ctx.beginPath(); ctx.moveTo(px + s*0.10, py + s*0.42); ctx.lineTo(px + s*0.0, py + s*0.38); ctx.moveTo(px + s*0.10, py + s*0.52); ctx.lineTo(px + s*0.0, py + s*0.56); ctx.stroke();
      // Acid drip
      ctx.fillStyle = `rgba(150,220,80,${0.6+flap*0.4})`;
      ctx.beginPath(); ctx.arc(px + s*0.02, py + s*0.48, s*0.04, 0, Math.PI*2); ctx.fill();
      // Eyes
      ctx.fillStyle = '#1a1606'; ctx.fillRect(px + s*0.16, py + s*0.42, s*0.03, s*0.03); ctx.fillRect(px + s*0.22, py + s*0.42, s*0.03, s*0.03);
      break;
    }
    case 'bulette': {
      // Armored body
      ctx.fillStyle = '#4e463e';
      ctx.beginPath(); ctx.ellipse(cx, py + s*0.62, s*0.38, s*0.24, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#635a50';
      ctx.beginPath(); ctx.ellipse(cx - s*0.04, py + s*0.56, s*0.28, s*0.16, 0, 0, Math.PI*2); ctx.fill();
      // Plate segments
      ctx.strokeStyle = '#2e2820'; ctx.lineWidth = 1.5;
      [0.36,0.50,0.64].forEach(fx => { ctx.beginPath(); ctx.moveTo(px + s*fx, py + s*0.42); ctx.lineTo(px + s*fx, py + s*0.80); ctx.stroke(); });
      // Dorsal fin (signature)
      ctx.fillStyle = '#3a342c';
      ctx.beginPath(); ctx.moveTo(cx - s*0.10, py + s*0.40); ctx.lineTo(cx, py + s*0.10); ctx.lineTo(cx + s*0.14, py + s*0.42); ctx.closePath(); ctx.fill();
      // Head + jaws (right)
      ctx.fillStyle = '#635a50';
      ctx.beginPath(); ctx.arc(px + s*0.80, py + s*0.58, s*0.16, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#1a160e'; ctx.fillRect(px + s*0.80, py + s*0.62, s*0.16, s*0.06);
      ctx.fillStyle = '#e8e0c8';
      for (let i=0;i<4;i++) ctx.fillRect(px + s*0.81 + i*s*0.04, py + s*0.62, s*0.02, s*0.05);
      // Eye + stubby legs
      ctx.fillStyle = '#ffcc33'; ctx.fillRect(px + s*0.82, py + s*0.52, s*0.04, s*0.03);
      ctx.fillStyle = '#3a342c';
      [0.28,0.50].forEach(fx => ctx.fillRect(px + s*fx, py + s*0.80, s*0.10, s*0.12));
      break;
    }
    case 'earth_elemental': {
      // Rocky mass
      ctx.fillStyle = '#6a5d40';
      ctx.beginPath();
      ctx.moveTo(px + s*0.16, py + s*0.90); ctx.lineTo(px + s*0.10, py + s*0.46); ctx.lineTo(px + s*0.30, py + s*0.24);
      ctx.lineTo(px + s*0.54, py + s*0.16); ctx.lineTo(px + s*0.74, py + s*0.26); ctx.lineTo(px + s*0.92, py + s*0.48); ctx.lineTo(px + s*0.86, py + s*0.90);
      ctx.closePath(); ctx.fill();
      // Lighter facet
      ctx.fillStyle = '#84764e';
      ctx.beginPath(); ctx.moveTo(px + s*0.30, py + s*0.26); ctx.lineTo(px + s*0.52, py + s*0.18); ctx.lineTo(px + s*0.46, py + s*0.46); ctx.lineTo(px + s*0.26, py + s*0.50); ctx.closePath(); ctx.fill();
      // Cracks + moss
      ctx.strokeStyle = '#3e3622'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(px + s*0.40, py + s*0.20); ctx.lineTo(px + s*0.44, py + s*0.88); ctx.moveTo(px + s*0.62, py + s*0.30); ctx.lineTo(px + s*0.66, py + s*0.86); ctx.stroke();
      ctx.fillStyle = '#5a7a30';
      ctx.fillRect(px + s*0.20, py + s*0.44, s*0.10, s*0.04);
      ctx.fillRect(px + s*0.66, py + s*0.40, s*0.10, s*0.04);
      // Glowing gem eyes
      ctx.fillStyle = `rgba(255,200,90,${0.6+flap*0.3})`;
      ctx.fillRect(px + s*0.40, py + s*0.44, s*0.07, s*0.05);
      ctx.fillRect(px + s*0.54, py + s*0.44, s*0.07, s*0.05);
      break;
    }
    case 'stone_giant': {
      // Legs
      ctx.fillStyle = '#75706a'; ctx.fillRect(px + s*0.30, py + s*0.66, s*0.16, s*0.26); ctx.fillRect(px + s*0.54, py + s*0.66, s*0.16, s*0.26);
      // Torso
      ctx.fillStyle = '#857f76'; ctx.fillRect(px + s*0.26, py + s*0.30, s*0.48, s*0.42);
      ctx.fillStyle = '#9a948a'; ctx.fillRect(px + s*0.26, py + s*0.30, s*0.24, s*0.42);
      // Head
      ctx.fillStyle = '#9a948a';
      ctx.beginPath(); ctx.arc(cx, py + s*0.20, s*0.16, 0, Math.PI*2); ctx.fill();
      // Heavy brow + deep eyes
      ctx.fillStyle = '#5e594f'; ctx.fillRect(px + s*0.40, py + s*0.16, s*0.20, s*0.04);
      ctx.fillStyle = '#1a1812'; ctx.fillRect(px + s*0.42, py + s*0.18, s*0.05, s*0.04); ctx.fillRect(px + s*0.53, py + s*0.18, s*0.05, s*0.04);
      // Cracks
      ctx.strokeStyle = '#5e594f'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(px + s*0.34, py + s*0.36); ctx.lineTo(px + s*0.40, py + s*0.66); ctx.moveTo(px + s*0.60, py + s*0.34); ctx.lineTo(px + s*0.56, py + s*0.64); ctx.stroke();
      // Boulder in hand
      ctx.fillStyle = '#6a655c';
      ctx.beginPath(); ctx.arc(px + s*0.86, py + s*0.42, s*0.14, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#807a70';
      ctx.beginPath(); ctx.arc(px + s*0.82, py + s*0.38, s*0.07, 0, Math.PI*2); ctx.fill();
      break;
    }
    case 'harpy': {
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
      break;
    }
    case 'manticore': {
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
    case 'will_o_wisp': {
      // Outer glow
      const wg = ctx.createRadialGradient(cx, cy, 0, cx, cy, s*0.5);
      wg.addColorStop(0, `rgba(200,255,120,${0.6+flap*0.3})`);
      wg.addColorStop(1, 'rgba(180,255,80,0)');
      ctx.fillStyle = wg; ctx.fillRect(sx - ts*0.1, sy - ts*0.1, ts*1.2, ts*1.2);
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
      break;
    }
    case 'young_blue_dragon': {
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
      // Static aura
      const sgaa = ctx.createRadialGradient(cx, cy, 0, cx, cy, s*0.55);
      sgaa.addColorStop(0, `rgba(150,180,255,${0.2+flap*0.2})`);
      sgaa.addColorStop(1, 'rgba(150,180,255,0)');
      ctx.fillStyle = sgaa; ctx.fillRect(sx - ts*0.1, sy - ts*0.1, ts*1.2, ts*1.2);
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
      ctx.fillStyle = kga; ctx.fillRect(sx - ts*0.1, sy - ts*0.1, ts*1.2, ts*1.2);
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
      ctx.fillStyle = pla; ctx.fillRect(sx - ts*0.1, sy - ts*0.1, ts*1.2, ts*1.2);
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
    case 'ghost': {
      // Translucent body with wavy tail
      ctx.fillStyle = `rgba(200,220,230,${0.4+flap*0.15})`;
      ctx.beginPath();
      ctx.moveTo(px + s*0.26, py + s*0.34);
      ctx.bezierCurveTo(px + s*0.20, py + s*0.10, px + s*0.80, py + s*0.10, px + s*0.74, py + s*0.34);
      ctx.lineTo(px + s*0.74, py + s*0.74);
      for (let i=4;i>=0;i--){ const fx = px + s*0.30 + s*0.40*(i/4); const fy = py + s*0.86 + Math.sin(Date.now()/200 + phase + i)*s*0.05; ctx.lineTo(fx, fy); }
      ctx.lineTo(px + s*0.26, py + s*0.74);
      ctx.closePath(); ctx.fill();
      // Inner glow
      ctx.fillStyle = 'rgba(230,245,250,0.3)';
      ctx.beginPath(); ctx.ellipse(cx - s*0.04, py + s*0.34, s*0.12, s*0.16, 0, 0, Math.PI*2); ctx.fill();
      // Hollow eyes + mouth
      ctx.fillStyle = `rgba(80,140,170,${0.7+flap*0.3})`;
      ctx.beginPath(); ctx.ellipse(px + s*0.42, py + s*0.30, s*0.05, s*0.07, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(px + s*0.58, py + s*0.30, s*0.05, s*0.07, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx, py + s*0.46, s*0.05, s*0.08, 0, 0, Math.PI*2); ctx.fill();
      break;
    }
    case 'carrion_crawler': {
      // Long body
      ctx.fillStyle = '#7a8a2e';
      ctx.beginPath(); ctx.ellipse(cx, py + s*0.62, s*0.20, s*0.30, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#94a43a';
      ctx.beginPath(); ctx.ellipse(cx - s*0.04, py + s*0.60, s*0.12, s*0.24, 0, 0, Math.PI*2); ctx.fill();
      // Segment ridges
      ctx.strokeStyle = '#5a6820'; ctx.lineWidth = 1.5;
      [0.46,0.58,0.70,0.82].forEach(fy => { ctx.beginPath(); ctx.moveTo(px + s*0.32, py + s*fy); ctx.lineTo(px + s*0.68, py + s*fy); ctx.stroke(); });
      // Many legs
      ctx.strokeStyle = '#4a5818'; ctx.lineWidth = Math.max(1.5, s*0.03); ctx.lineCap = 'round';
      [0.50,0.62,0.74,0.86].forEach(fy => { ctx.beginPath(); ctx.moveTo(px + s*0.32, py + s*fy); ctx.lineTo(px + s*0.16, py + s*(fy+0.06)); ctx.moveTo(px + s*0.68, py + s*fy); ctx.lineTo(px + s*0.84, py + s*(fy+0.06)); ctx.stroke(); });
      // Head
      ctx.fillStyle = '#94a43a';
      ctx.beginPath(); ctx.arc(cx, py + s*0.28, s*0.16, 0, Math.PI*2); ctx.fill();
      // Writhing tentacle mouth
      ctx.strokeStyle = '#aa66aa'; ctx.lineWidth = Math.max(1.5, s*0.03); ctx.lineCap = 'round';
      for (let i=0;i<5;i++){ const a = -Math.PI/2 + (i-2)*0.4; const wob = Math.sin(Date.now()/150 + i + phase)*0.2; ctx.beginPath(); ctx.moveTo(cx, py + s*0.36); ctx.lineTo(cx + Math.cos(a+wob)*s*0.16, py + s*0.36 + Math.sin(a+wob)*s*0.16); ctx.stroke(); }
      // Eyes
      ctx.fillStyle = '#1a2206'; ctx.fillRect(cx - s*0.06, py + s*0.24, s*0.03, s*0.03); ctx.fillRect(cx + s*0.03, py + s*0.24, s*0.03, s*0.03);
      break;
    }
    case 'otyugh': {
      // Bloated body
      ctx.fillStyle = '#7a7a3a';
      ctx.beginPath(); ctx.ellipse(cx, py + s*0.62, s*0.34, s*0.26, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#92923f';
      ctx.beginPath(); ctx.ellipse(cx - s*0.04, py + s*0.56, s*0.24, s*0.18, 0, 0, Math.PI*2); ctx.fill();
      // Three stumpy legs
      ctx.fillStyle = '#5a5a28';
      [0.24,0.46,0.68].forEach(fx => ctx.fillRect(px + s*fx, py + s*0.80, s*0.10, s*0.14));
      // Big toothy maw
      ctx.fillStyle = '#2a1a14';
      ctx.beginPath(); ctx.ellipse(cx, py + s*0.62, s*0.20, s*0.09, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#d8d0b0';
      for (let i=0;i<6;i++) ctx.fillRect(cx - s*0.18 + i*s*0.06, py + s*0.56, s*0.025, s*0.05);
      // Tentacle eye-stalks
      ctx.strokeStyle = '#7a7a3a'; ctx.lineWidth = Math.max(2, s*0.05); ctx.lineCap = 'round';
      const ow = Math.sin(Date.now()/200 + phase)*s*0.04;
      ctx.beginPath(); ctx.moveTo(px + s*0.38, py + s*0.40); ctx.lineTo(px + s*0.30 + ow, py + s*0.14); ctx.moveTo(px + s*0.62, py + s*0.40); ctx.lineTo(px + s*0.70 - ow, py + s*0.14); ctx.stroke();
      ctx.fillStyle = '#ffcc33';
      ctx.beginPath(); ctx.arc(px + s*0.30 + ow, py + s*0.12, s*0.05, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + s*0.70 - ow, py + s*0.12, s*0.05, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(px + s*0.30 + ow, py + s*0.12, s*0.02, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + s*0.70 - ow, py + s*0.12, s*0.02, 0, Math.PI*2); ctx.fill();
      break;
    }
    case 'green_dragon': {
      const dgf = Math.sin(Date.now()/120 + phase)*0.2 + 1;
      // Wings
      ctx.fillStyle = '#2a5a2a';
      ctx.beginPath(); ctx.moveTo(px + s*0.04, py + s*0.36/dgf); ctx.lineTo(px + s*0.48, py + s*0.34); ctx.lineTo(px + s*0.28, py + s*0.62); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px + s*0.96, py + s*0.36/dgf); ctx.lineTo(px + s*0.52, py + s*0.34); ctx.lineTo(px + s*0.72, py + s*0.62); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#3a7a3a';
      ctx.beginPath(); ctx.moveTo(px + s*0.10, py + s*0.38/dgf); ctx.lineTo(px + s*0.46, py + s*0.36); ctx.lineTo(px + s*0.30, py + s*0.56); ctx.closePath(); ctx.fill();
      // Body
      ctx.fillStyle = '#3a6e34';
      ctx.beginPath(); ctx.ellipse(cx, py + s*0.54, s*0.22, s*0.30, 0, 0, Math.PI*2); ctx.fill();
      // Head + swept frill
      ctx.fillStyle = '#4a8240';
      ctx.beginPath(); ctx.arc(cx, py + s*0.26, s*0.17, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#2a5a2a';
      ctx.beginPath(); ctx.moveTo(px + s*0.40, py + s*0.20); ctx.lineTo(px + s*0.28, py + s*0.30); ctx.lineTo(px + s*0.42, py + s*0.30); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px + s*0.60, py + s*0.20); ctx.lineTo(px + s*0.72, py + s*0.30); ctx.lineTo(px + s*0.58, py + s*0.30); ctx.closePath(); ctx.fill();
      // Poison breath
      ctx.fillStyle = `rgba(150,220,80,${0.5+flap*0.3})`;
      ctx.beginPath(); ctx.arc(cx, py + s*0.44, s*0.06, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + s*0.04, py + s*0.54, s*0.05, 0, Math.PI*2); ctx.fill();
      // Eye
      ctx.fillStyle = '#ddee44'; ctx.fillRect(px + s*0.46, py + s*0.24, s*0.07, s*0.05);
      ctx.fillStyle = '#000'; ctx.fillRect(px + s*0.49, py + s*0.25, s*0.02, s*0.03);
      // Tail
      ctx.strokeStyle = '#3a6e34'; ctx.lineWidth = Math.max(2, s*0.06);
      ctx.beginPath(); ctx.moveTo(cx, py + s*0.80); ctx.lineTo(cx + Math.sin(Date.now()/180+phase)*s*0.20, py + s); ctx.stroke();
      break;
    }
    case 'purple_worm': {
      // Massive segmented body (arching up)
      ctx.strokeStyle = '#5e2e5e'; ctx.lineWidth = Math.max(6, s*0.26); ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(px + s*0.16, py + s*0.92);
      ctx.quadraticCurveTo(px + s*0.10, py + s*0.50, px + s*0.40, py + s*0.34);
      ctx.quadraticCurveTo(px + s*0.62, py + s*0.22, cx + s*0.04, py + s*0.22);
      ctx.stroke();
      ctx.strokeStyle = '#7a417a'; ctx.lineWidth = Math.max(3, s*0.12);
      ctx.beginPath();
      ctx.moveTo(px + s*0.18, py + s*0.90);
      ctx.quadraticCurveTo(px + s*0.14, py + s*0.52, px + s*0.40, py + s*0.36);
      ctx.stroke();
      // Segment rings
      ctx.strokeStyle = '#3e1e3e'; ctx.lineWidth = Math.max(1.5, s*0.03);
      [[0.16,0.78],[0.13,0.62],[0.24,0.44],[0.42,0.34]].forEach(([fx,fy]) => { ctx.beginPath(); ctx.arc(px + s*fx, py + s*fy, s*0.13, 0.3, 2.8); ctx.stroke(); });
      // Round maw
      ctx.fillStyle = '#3a1a3a';
      ctx.beginPath(); ctx.arc(cx + s*0.10, py + s*0.24, s*0.16, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#1a0a1a';
      ctx.beginPath(); ctx.arc(cx + s*0.10, py + s*0.24, s*0.10, 0, Math.PI*2); ctx.fill();
      // Ring of teeth
      ctx.fillStyle = '#e0d8c0';
      for (let i=0;i<8;i++){ const a = i*Math.PI/4 + Date.now()/600; ctx.beginPath(); ctx.moveTo(cx + s*0.10 + Math.cos(a)*s*0.10, py + s*0.24 + Math.sin(a)*s*0.10); ctx.lineTo(cx + s*0.10 + Math.cos(a)*s*0.15, py + s*0.24 + Math.sin(a)*s*0.15); ctx.lineTo(cx + s*0.10 + Math.cos(a+0.3)*s*0.11, py + s*0.24 + Math.sin(a+0.3)*s*0.11); ctx.closePath(); ctx.fill(); }
      break;
    }
    case 'nothic': {
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
      // Psionic aura
      const mfa = ctx.createRadialGradient(cx, py + s*0.30, 0, cx, py + s*0.30, s*0.4);
      mfa.addColorStop(0, `rgba(160,90,220,${0.3+flap*0.25})`);
      mfa.addColorStop(1, 'rgba(160,90,220,0)');
      ctx.fillStyle = mfa; ctx.fillRect(sx - ts*0.1, sy - ts*0.1, ts*1.2, ts*1.2);
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
    case 'gaia_colossus': {
      if (e.boss) {
        const auraR = s*0.60 + Math.sin(Date.now()/220)*s*0.04;
        const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, auraR);
        aura.addColorStop(0, 'rgba(210,150,60,0.32)'); aura.addColorStop(1, 'rgba(210,150,60,0)');
        ctx.fillStyle = aura; ctx.fillRect(cx-auraR, cy-auraR, auraR*2, auraR*2);
      }
      // Boulder legs
      ctx.fillStyle = '#5e5436'; ctx.fillRect(px + s*0.28, py + s*0.70, s*0.18, s*0.22); ctx.fillRect(px + s*0.54, py + s*0.70, s*0.18, s*0.22);
      // Craggy torso
      ctx.fillStyle = '#6e6242';
      ctx.beginPath();
      ctx.moveTo(px + s*0.22, py + s*0.74); ctx.lineTo(px + s*0.18, py + s*0.36); ctx.lineTo(px + s*0.34, py + s*0.24);
      ctx.lineTo(px + s*0.66, py + s*0.24); ctx.lineTo(px + s*0.82, py + s*0.36); ctx.lineTo(px + s*0.78, py + s*0.74);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#867748';
      ctx.beginPath(); ctx.moveTo(px + s*0.34, py + s*0.26); ctx.lineTo(px + s*0.50, py + s*0.24); ctx.lineTo(px + s*0.46, py + s*0.52); ctx.lineTo(px + s*0.26, py + s*0.54); ctx.closePath(); ctx.fill();
      // Glowing molten core
      ctx.fillStyle = `rgba(255,150,40,${0.6+flap*0.4})`;
      ctx.beginPath(); ctx.arc(cx, py + s*0.50, s*0.10, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#ffd070';
      ctx.beginPath(); ctx.arc(cx, py + s*0.50, s*0.05, 0, Math.PI*2); ctx.fill();
      // Glowing cracks
      ctx.strokeStyle = `rgba(255,140,40,${0.4+flap*0.3})`; ctx.lineWidth = Math.max(1.5, s*0.03);
      ctx.beginPath(); ctx.moveTo(cx, py + s*0.40); ctx.lineTo(px + s*0.32, py + s*0.30); ctx.moveTo(cx, py + s*0.60); ctx.lineTo(px + s*0.70, py + s*0.70); ctx.stroke();
      // Boulder fists
      ctx.fillStyle = '#5e5436';
      ctx.beginPath(); ctx.arc(px + s*0.16, py + s*0.58, s*0.12, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + s*0.84, py + s*0.58, s*0.12, 0, Math.PI*2); ctx.fill();
      // Head
      ctx.fillStyle = '#6e6242';
      ctx.beginPath(); ctx.arc(cx, py + s*0.20, s*0.13, 0, Math.PI*2); ctx.fill();
      // Moss patches
      ctx.fillStyle = '#4a6a28';
      ctx.fillRect(px + s*0.30, py + s*0.26, s*0.10, s*0.04);
      ctx.fillRect(px + s*0.60, py + s*0.30, s*0.12, s*0.04);
      // Eyes
      ctx.fillStyle = `rgba(255,180,60,${0.7+flap*0.3})`;
      ctx.fillRect(px + s*0.43, py + s*0.18, s*0.05, s*0.04); ctx.fillRect(px + s*0.52, py + s*0.18, s*0.05, s*0.04);
      break;
    }
    case 'wind_djinn': {
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
    case 'storm_lord': {
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
    case 'death_knight': {
      if (e.boss) {
        const auraR = s*0.62 + Math.sin(Date.now()/220)*s*0.04;
        const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, auraR);
        aura.addColorStop(0, 'rgba(170,90,220,0.42)'); aura.addColorStop(1, 'rgba(170,90,220,0)');
        ctx.fillStyle = aura; ctx.fillRect(cx-auraR, cy-auraR, auraR*2, auraR*2);
      }
      // Armored legs
      ctx.fillStyle = '#2a2238'; ctx.fillRect(px + s*0.32, py + s*0.70, s*0.14, s*0.22); ctx.fillRect(px + s*0.54, py + s*0.70, s*0.14, s*0.22);
      // Tattered cape
      ctx.fillStyle = '#1a1428';
      ctx.beginPath(); ctx.moveTo(px + s*0.26, py + s*0.38); ctx.lineTo(px + s*0.20, py + s*0.80); ctx.lineTo(px + s*0.32, py + s*0.74); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px + s*0.74, py + s*0.38); ctx.lineTo(px + s*0.80, py + s*0.80); ctx.lineTo(px + s*0.68, py + s*0.74); ctx.closePath(); ctx.fill();
      // Cuirass
      ctx.fillStyle = '#3a3050'; ctx.fillRect(px + s*0.28, py + s*0.36, s*0.44, s*0.40);
      ctx.fillStyle = '#4e4270'; ctx.fillRect(px + s*0.28, py + s*0.36, s*0.22, s*0.40);
      // Spiked pauldrons
      ctx.fillStyle = '#2a2238';
      ctx.beginPath(); ctx.moveTo(px + s*0.26, py + s*0.38); ctx.lineTo(px + s*0.16, py + s*0.26); ctx.lineTo(px + s*0.40, py + s*0.36); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px + s*0.74, py + s*0.38); ctx.lineTo(px + s*0.84, py + s*0.26); ctx.lineTo(px + s*0.60, py + s*0.36); ctx.closePath(); ctx.fill();
      // Skull face in helm
      ctx.fillStyle = '#d8d2bc';
      ctx.beginPath(); ctx.arc(cx, py + s*0.24, s*0.15, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = `rgba(180,90,255,${0.7+flap*0.3})`;
      ctx.beginPath(); ctx.arc(px + s*0.44, py + s*0.24, s*0.04, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + s*0.56, py + s*0.24, s*0.04, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#000'; ctx.fillRect(px + s*0.46, py + s*0.30, s*0.08, s*0.05);
      // Horned crown helm
      ctx.fillStyle = '#2a2238';
      ctx.beginPath(); ctx.moveTo(px + s*0.38, py + s*0.14); ctx.lineTo(px + s*0.30, py + s*0.0); ctx.lineTo(px + s*0.46, py + s*0.12); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px + s*0.62, py + s*0.14); ctx.lineTo(px + s*0.70, py + s*0.0); ctx.lineTo(px + s*0.54, py + s*0.12); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffcc00'; ctx.fillRect(px + s*0.42, py + s*0.08, s*0.16, s*0.04);
      // Runeblade (right)
      ctx.fillStyle = '#5a4e78'; ctx.fillRect(px + s*0.82, py + s*0.10, s*0.05, s*0.64);
      ctx.fillStyle = `rgba(180,90,255,${0.5+flap*0.4})`; ctx.fillRect(px + s*0.835, py + s*0.14, s*0.02, s*0.56);
      ctx.fillStyle = '#3a3050'; ctx.fillRect(px + s*0.76, py + s*0.72, s*0.16, s*0.05);
      break;
    }
    case 'hydra_queen': {
      if (e.boss) {
        const auraR = s*0.62 + Math.sin(Date.now()/220)*s*0.04;
        const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, auraR);
        aura.addColorStop(0, 'rgba(120,200,70,0.38)'); aura.addColorStop(1, 'rgba(120,200,70,0)');
        ctx.fillStyle = aura; ctx.fillRect(cx-auraR, cy-auraR, auraR*2, auraR*2);
      }
      // Body mass
      ctx.fillStyle = '#4a7a2a';
      ctx.beginPath(); ctx.ellipse(cx, py + s*0.72, s*0.34, s*0.22, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#5e9636';
      ctx.beginPath(); ctx.ellipse(cx - s*0.04, py + s*0.68, s*0.24, s*0.15, 0, 0, Math.PI*2); ctx.fill();
      // Five necks + heads
      const necks = [[0.20,0.16],[0.36,0.06],[0.50,0.02],[0.64,0.06],[0.80,0.16]];
      necks.forEach(([hx,hy], i) => {
        const sway = Math.sin(Date.now()/220 + phase + i*1.3)*s*0.03;
        ctx.strokeStyle = '#5e9636'; ctx.lineWidth = Math.max(3, s*0.08); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(cx, py + s*0.58); ctx.quadraticCurveTo(px + s*hx + sway, py + s*0.40, px + s*hx + sway, py + s*(hy+0.10)); ctx.stroke();
        ctx.fillStyle = '#6faa3e';
        ctx.beginPath(); ctx.arc(px + s*hx + sway, py + s*(hy+0.08), s*0.085, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#5e9636';
        ctx.fillRect(px + s*hx + sway - s*0.02, py + s*(hy+0.10), s*0.10, s*0.05);
        ctx.fillStyle = `rgba(220,255,120,${0.7+flap*0.3})`;
        ctx.fillRect(px + s*hx + sway - s*0.03, py + s*(hy+0.04), s*0.03, s*0.03);
        ctx.fillStyle = '#dff0c0';
        ctx.fillRect(px + s*hx + sway + s*0.02, py + s*(hy+0.14), s*0.015, s*0.03);
      });
      // Poison drip from center head
      ctx.fillStyle = `rgba(150,230,80,${0.6+flap*0.4})`;
      ctx.beginPath(); ctx.arc(px + s*0.50, py + s*0.20, s*0.03, 0, Math.PI*2); ctx.fill();
      break;
    }
    case 'archmage_void': {
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
    // ─── Volcanic region ───────────────────────────────────────────────
    case 'magmin': {
      // A small molten imp — a lump of cracked black rock lit from within by lava,
      // trailing heat, with two burning eyes. Fiery aura pulse.
      const ga = ctx.createRadialGradient(cx, cy, 0, cx, cy, s*0.5);
      ga.addColorStop(0, `rgba(255,120,30,${0.32+flap*0.22})`); ga.addColorStop(1, 'rgba(255,60,10,0)');
      ctx.fillStyle = ga; ctx.fillRect(sx - ts*0.1, sy - ts*0.1, ts*1.2, ts*1.2);
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
      ctx.fillStyle = ga; ctx.fillRect(sx - ts*0.1, sy - ts*0.1, ts*1.2, ts*1.2);
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

    // ─── Shadow region ─────────────────────────────────────────────────
    case 'shade': {
      // A drifting shadow — a smoky black humanoid with a wavering hem and two cold
      // violet eyes, wrapped in a dark aura. Insubstantial.
      const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, s*0.55);
      aura.addColorStop(0, `rgba(120,80,190,${0.4+flap*0.22})`); aura.addColorStop(1, 'rgba(70,40,120,0)');
      ctx.fillStyle = aura; ctx.fillRect(sx - ts*0.1, sy - ts*0.1, ts*1.2, ts*1.2);
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
      ctx.fillStyle = aura; ctx.fillRect(sx - ts*0.1, sy - ts*0.1, ts*1.2, ts*1.2);
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
      ctx.fillStyle = aura; ctx.fillRect(sx - ts*0.15, sy - ts*0.15, ts*1.3, ts*1.3);
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
    case 'eclipse_sovereign': {
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
    case 'adult_red_dragon': {
      // The final boss — an adult red dragon. Two poses: DORMANT, coiled asleep
      // on the crest of its hoard (wings folded, eyes shut, smoke curling from
      // its nostrils, flanks swelling with slow breath); and AWAKE, rearing
      // with vast ribbed wings, a furnace glowing in its chest, and burning
      // slit eyes. Size 2.8 — it dwarfs every other creature in the game.
      const tt = Date.now();
      if (e.dormant) {
        // ── Asleep on the gold ──
        const pyd = sy + oy;                       // no idle bob — it's asleep
        const breath = Math.sin(tt / 900 + phase) * 0.5 + 0.5;   // slow swell
        const bw = 1 + breath * 0.035;
        // Coiled tail wrapping the body — drawn first, underneath.
        ctx.strokeStyle = '#7a1206'; ctx.lineWidth = Math.max(4, s * 0.10);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.ellipse(cx, pyd + s * 0.60, s * 0.42, s * 0.28, 0, Math.PI * 0.15, Math.PI * 1.55);
        ctx.stroke();
        // Tail spade tip.
        ctx.fillStyle = '#7a1206';
        ctx.beginPath();
        ctx.moveTo(px + s * 0.86, pyd + s * 0.44);
        ctx.lineTo(px + s * 0.98, pyd + s * 0.38);
        ctx.lineTo(px + s * 0.92, pyd + s * 0.52);
        ctx.closePath(); ctx.fill();
        // Body mass — a heavy scarlet mound, swelling with each breath.
        ctx.fillStyle = '#8a1408';
        ctx.beginPath(); ctx.ellipse(cx + s * 0.04, pyd + s * 0.58, s * 0.34 * bw, s * 0.24 * bw, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#a01d0c';
        ctx.beginPath(); ctx.ellipse(cx + s * 0.02, pyd + s * 0.54, s * 0.28 * bw, s * 0.18 * bw, 0, 0, Math.PI * 2); ctx.fill();
        // Folded wings — two dark ridges laid along the back, scalloped edges.
        ctx.fillStyle = '#5e0e04';
        ctx.beginPath();
        ctx.moveTo(px + s * 0.28, pyd + s * 0.42);
        ctx.quadraticCurveTo(cx, pyd + s * 0.30, px + s * 0.74, pyd + s * 0.44);
        ctx.quadraticCurveTo(px + s * 0.62, pyd + s * 0.52, px + s * 0.50, pyd + s * 0.50);
        ctx.quadraticCurveTo(px + s * 0.38, pyd + s * 0.52, px + s * 0.28, pyd + s * 0.42);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#4a0a02'; ctx.lineWidth = Math.max(1, s * 0.015);
        for (const fx of [0.36, 0.48, 0.60]) {     // folded wing-finger ridges
          ctx.beginPath();
          ctx.moveTo(px + s * fx, pyd + s * 0.44);
          ctx.lineTo(px + s * (fx + 0.10), pyd + s * 0.36);
          ctx.stroke();
        }
        // Back spines along the coil.
        ctx.fillStyle = '#4a0a02';
        for (const fx of [0.30, 0.42, 0.54, 0.66]) {
          ctx.beginPath();
          ctx.moveTo(px + s * fx, pyd + s * 0.40);
          ctx.lineTo(px + s * (fx + 0.03), pyd + s * 0.33);
          ctx.lineTo(px + s * (fx + 0.06), pyd + s * 0.40);
          ctx.closePath(); ctx.fill();
        }
        // Head at rest on its forepaws, lower-left, eyes closed.
        ctx.fillStyle = '#a01d0c';
        ctx.beginPath(); ctx.ellipse(px + s * 0.24, pyd + s * 0.70, s * 0.15, s * 0.11, -0.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#b82a12';
        ctx.beginPath(); ctx.ellipse(px + s * 0.15, pyd + s * 0.73, s * 0.09, s * 0.06, -0.2, 0, Math.PI * 2); ctx.fill();  // snout
        // Backswept horns.
        ctx.fillStyle = '#3a2a20';
        ctx.beginPath();
        ctx.moveTo(px + s * 0.28, pyd + s * 0.62);
        ctx.lineTo(px + s * 0.40, pyd + s * 0.54);
        ctx.lineTo(px + s * 0.32, pyd + s * 0.66);
        ctx.closePath(); ctx.fill();
        // Closed eye — a thin dark slit.
        ctx.strokeStyle = '#2a0604'; ctx.lineWidth = Math.max(1, s * 0.014);
        ctx.beginPath();
        ctx.moveTo(px + s * 0.20, pyd + s * 0.685);
        ctx.lineTo(px + s * 0.26, pyd + s * 0.675);
        ctx.stroke();
        // Lazy smoke wisps curling up from the nostrils.
        for (let i = 0; i < 3; i++) {
          const ph2 = ((tt / 1600) + i * 0.33 + phase * 0.1) % 1;
          const wx = px + s * 0.13 + Math.sin(tt / 500 + i * 2.1) * s * 0.03;
          const wy = pyd + s * 0.70 - ph2 * s * 0.30;
          ctx.fillStyle = `rgba(120,110,110,${(1 - ph2) * 0.40})`;
          ctx.beginPath(); ctx.arc(wx, wy, s * (0.015 + ph2 * 0.030), 0, Math.PI * 2); ctx.fill();
        }
        ctx.lineCap = 'butt';
        break;
      }
      // ── Awake — the fight ──
      // Fiery boss aura behind everything.
      const auraR = s * 0.62 + Math.sin(tt / 200) * s * 0.05;
      const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, auraR);
      aura.addColorStop(0, 'rgba(255,110,30,0.38)');
      aura.addColorStop(1, 'rgba(180,40,10,0)');
      ctx.fillStyle = aura; ctx.fillRect(cx - auraR, cy - auraR, auraR * 2, auraR * 2);
      // Vast ribbed wings, beating on the flap phase, with membrane struts.
      const wf = 1 + Math.sin(tt / 130 + phase) * 0.22;
      ctx.fillStyle = '#6e1004';
      ctx.beginPath();                                          // left wing
      ctx.moveTo(cx - s * 0.08, py + s * 0.36);
      ctx.quadraticCurveTo(px - s * 0.06, py + s * (0.10 / wf), px + s * 0.00, py + s * 0.30 / wf);
      ctx.lineTo(px + s * 0.10, py + s * 0.52);
      ctx.quadraticCurveTo(px + s * 0.22, py + s * 0.62, cx - s * 0.08, py + s * 0.52);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();                                          // right wing
      ctx.moveTo(cx + s * 0.08, py + s * 0.36);
      ctx.quadraticCurveTo(px + s * 1.06, py + s * (0.10 / wf), px + s * 1.00, py + s * 0.30 / wf);
      ctx.lineTo(px + s * 0.90, py + s * 0.52);
      ctx.quadraticCurveTo(px + s * 0.78, py + s * 0.62, cx + s * 0.08, py + s * 0.52);
      ctx.closePath(); ctx.fill();
      // Membrane inner glow + wing-finger struts.
      ctx.fillStyle = 'rgba(200,60,20,0.55)';
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.08, py + s * 0.38);
      ctx.quadraticCurveTo(px + s * 0.06, py + s * (0.16 / wf), px + s * 0.08, py + s * 0.34 / wf);
      ctx.lineTo(cx - s * 0.10, py + s * 0.48);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx + s * 0.08, py + s * 0.38);
      ctx.quadraticCurveTo(px + s * 0.94, py + s * (0.16 / wf), px + s * 0.92, py + s * 0.34 / wf);
      ctx.lineTo(cx + s * 0.10, py + s * 0.48);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#3a0802'; ctx.lineWidth = Math.max(1, s * 0.015);
      for (const [tx2, tyf] of [[0.02, 0.30], [0.10, 0.22], [0.18, 0.18]]) {
        ctx.beginPath(); ctx.moveTo(cx - s * 0.08, py + s * 0.40);
        ctx.lineTo(px + s * tx2, py + s * (tyf / wf)); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx + s * 0.08, py + s * 0.40);
        ctx.lineTo(px + s * (1 - tx2), py + s * (tyf / wf)); ctx.stroke();
      }
      // Lashing tail (under the body).
      ctx.strokeStyle = '#8a1408'; ctx.lineWidth = Math.max(3, s * 0.07);
      ctx.lineCap = 'round';
      const tlash = Math.sin(tt / 170 + phase) * s * 0.20;
      ctx.beginPath();
      ctx.moveTo(cx, py + s * 0.78);
      ctx.quadraticCurveTo(cx + tlash * 0.5, py + s * 0.92, cx + tlash, py + s * 1.02);
      ctx.stroke();
      ctx.fillStyle = '#6e1004';                                // tail spade
      ctx.beginPath();
      ctx.moveTo(cx + tlash, py + s * 1.02);
      ctx.lineTo(cx + tlash - s * 0.05, py + s * 0.96);
      ctx.lineTo(cx + tlash + s * 0.05, py + s * 0.96);
      ctx.closePath(); ctx.fill();
      // Rearing torso.
      ctx.fillStyle = '#9a1808';
      ctx.beginPath(); ctx.ellipse(cx, py + s * 0.54, s * 0.22, s * 0.30, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#b02410';
      ctx.beginPath(); ctx.ellipse(cx - s * 0.04, py + s * 0.50, s * 0.16, s * 0.24, 0, 0, Math.PI * 2); ctx.fill();
      // Belly plates.
      ctx.fillStyle = '#d8703a';
      ctx.beginPath(); ctx.ellipse(cx, py + s * 0.60, s * 0.09, s * 0.18, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#a84c22'; ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.07, py + s * (0.48 + i * 0.07));
        ctx.lineTo(cx + s * 0.07, py + s * (0.48 + i * 0.07));
        ctx.stroke();
      }
      // Furnace glow building in the chest.
      const furn = Math.sin(tt / 260 + phase) * 0.5 + 0.5;
      const fg = ctx.createRadialGradient(cx, py + s * 0.46, 0, cx, py + s * 0.46, s * 0.14);
      fg.addColorStop(0, `rgba(255,220,90,${0.55 + furn * 0.40})`);
      fg.addColorStop(1, 'rgba(255,120,30,0)');
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.arc(cx, py + s * 0.46, s * 0.14, 0, Math.PI * 2); ctx.fill();
      // Forelimbs with talons.
      ctx.strokeStyle = '#8a1408'; ctx.lineWidth = Math.max(2, s * 0.05);
      ctx.beginPath(); ctx.moveTo(cx - s * 0.16, py + s * 0.56); ctx.lineTo(cx - s * 0.26, py + s * 0.70); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + s * 0.16, py + s * 0.56); ctx.lineTo(cx + s * 0.26, py + s * 0.70); ctx.stroke();
      ctx.fillStyle = '#2a1a12';
      for (const sgn of [-1, 1])
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.moveTo(cx + sgn * s * 0.26 + i * s * 0.025, py + s * 0.70);
          ctx.lineTo(cx + sgn * s * 0.26 + i * s * 0.025 + s * 0.012, py + s * 0.745);
          ctx.lineTo(cx + sgn * s * 0.26 + i * s * 0.025 + s * 0.024, py + s * 0.70);
          ctx.closePath(); ctx.fill();
        }
      // Neck + horned head.
      ctx.fillStyle = '#a81f0c';
      ctx.beginPath(); ctx.ellipse(cx, py + s * 0.30, s * 0.10, s * 0.13, 0, 0, Math.PI * 2); ctx.fill();  // neck
      ctx.fillStyle = '#b8260e';
      ctx.beginPath(); ctx.ellipse(cx, py + s * 0.20, s * 0.14, s * 0.11, 0, 0, Math.PI * 2); ctx.fill();  // skull
      // Great backswept horns.
      ctx.fillStyle = '#3a2a20';
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.10, py + s * 0.14);
      ctx.quadraticCurveTo(cx - s * 0.22, py + s * 0.02, cx - s * 0.26, py - s * 0.06);
      ctx.lineTo(cx - s * 0.18, py + s * 0.06);
      ctx.quadraticCurveTo(cx - s * 0.14, py + s * 0.12, cx - s * 0.06, py + s * 0.16);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx + s * 0.10, py + s * 0.14);
      ctx.quadraticCurveTo(cx + s * 0.22, py + s * 0.02, cx + s * 0.26, py - s * 0.06);
      ctx.lineTo(cx + s * 0.18, py + s * 0.06);
      ctx.quadraticCurveTo(cx + s * 0.14, py + s * 0.12, cx + s * 0.06, py + s * 0.16);
      ctx.closePath(); ctx.fill();
      // Brow crest spikes.
      ctx.fillStyle = '#4a0a02';
      for (const fx of [-0.05, 0.0, 0.05]) {
        ctx.beginPath();
        ctx.moveTo(cx + s * fx - s * 0.02, py + s * 0.12);
        ctx.lineTo(cx + s * fx, py + s * 0.05);
        ctx.lineTo(cx + s * fx + s * 0.02, py + s * 0.12);
        ctx.closePath(); ctx.fill();
      }
      // Open jaw with fire building inside.
      ctx.fillStyle = '#8a1408';
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.10, py + s * 0.24);
      ctx.lineTo(cx, py + s * 0.34);
      ctx.lineTo(cx + s * 0.10, py + s * 0.24);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = `rgba(255,170,40,${0.6 + furn * 0.4})`;
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.06, py + s * 0.25);
      ctx.lineTo(cx, py + s * 0.31);
      ctx.lineTo(cx + s * 0.06, py + s * 0.25);
      ctx.closePath(); ctx.fill();
      // Teeth.
      ctx.fillStyle = '#f4ead8';
      for (const fx of [-0.07, -0.03, 0.01, 0.05]) {
        ctx.beginPath();
        ctx.moveTo(cx + s * fx, py + s * 0.24);
        ctx.lineTo(cx + s * fx + s * 0.012, py + s * 0.27);
        ctx.lineTo(cx + s * fx + s * 0.024, py + s * 0.24);
        ctx.closePath(); ctx.fill();
      }
      // Burning slit eyes.
      ctx.fillStyle = `rgba(255,210,60,${0.85 + furn * 0.15})`;
      ctx.beginPath(); ctx.ellipse(cx - s * 0.06, py + s * 0.18, s * 0.030, s * 0.018, -0.3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx + s * 0.06, py + s * 0.18, s * 0.030, s * 0.018, 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.fillRect(cx - s * 0.065, py + s * 0.168, s * 0.012, s * 0.026);
      ctx.fillRect(cx + s * 0.055, py + s * 0.168, s * 0.012, s * 0.026);
      // Rising embers around the beast.
      for (let i = 0; i < 5; i++) {
        const ph3 = ((tt / 800) + i * 0.21 + phase * 0.13) % 1;
        const ex2 = cx + Math.sin(tt / 210 + i * 1.9) * s * 0.30;
        const ey2 = py + s * 0.55 - ph3 * s * 0.55;
        ctx.fillStyle = `rgba(255,${120 + Math.floor(ph3 * 110)},40,${(1 - ph3) * 0.85})`;
        ctx.fillRect(ex2 - 1, ey2 - 1, 2.5, 2.5);
      }
      ctx.lineCap = 'butt';
      break;
    }
    default: {
      // Generic fallback: a stylized blob with eyes
      ctx.fillStyle = e.color;
      ctx.beginPath(); ctx.ellipse(cx, py + s*0.55, s*0.32, s*0.36, 0, 0, Math.PI*2); ctx.fill();
      // Highlight
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath(); ctx.ellipse(cx - s*0.10, py + s*0.42, s*0.12, s*0.10, 0, 0, Math.PI*2); ctx.fill();
      // Eyes
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(px + s*0.40, py + s*0.46, s*0.06, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + s*0.60, py + s*0.46, s*0.06, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(px + s*0.40, py + s*0.46, s*0.03, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + s*0.60, py + s*0.46, s*0.03, 0, Math.PI*2); ctx.fill();
    }
  }

  // ── The Emperor's almost-human flicker ───────────────────────────────
  // Over the sprite, not behind it: the point of the beat is that something
  // else shows THROUGH him for a moment. Only ever set on the final boss, and
  // only for the length of the 15% stagger (stepFinalBoss, tower.js).
  if (e.humanFlickerT > 0 && typeof drawEmperorFlicker === 'function') {
    drawEmperorFlicker(e, cx, cy, s);
  }

  // ── HP bar — pill background with gradient fill ──────────────────────
  // A cutscene actor isn't a creature: no HP bar, no name tag, nothing that
  // suggests it can be fought. The prologue's Red Dragon Emperor comes through
  // here (see drawPrologueEmperor in render.js) purely to reuse this art — he is
  // never in `enemies`, so there is nothing to target and the unwinnable
  // encounter is unwinnable without disabling anything.
  if (e.cutsceneActor) { ctx.restore(); return; }
  // The dormant dragon is untargetable — no HP bar, just a slumbering tag.
  if (e.dormant) {
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#000';
    const tag = `💤 ${e.name}`;
    ctx.strokeText(tag, sx + ts / 2, sy + oy - 6);
    ctx.fillStyle = '#ffb066';
    ctx.fillText(tag, sx + ts / 2, sy + oy - 6);
    ctx.textAlign = 'left';
    ctx.restore();
    return;
  }
  const barW = ts * e.size * 0.92;
  const barX = sx + ox + s * 0.04, barY = sy + oy - 8;
  const barH = 5;
  ctx.fillStyle = '#000';
  ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(barX, barY, barW, barH);
  const pct = Math.max(0, e.hp / e.maxHp);
  if (pct > 0) {
    const grad = ctx.createLinearGradient(barX, 0, barX + barW * pct, 0);
    if (pct > 0.5)      { grad.addColorStop(0, '#22aa22'); grad.addColorStop(1, '#66ee66'); }
    else if (pct > 0.25){ grad.addColorStop(0, '#cc8800'); grad.addColorStop(1, '#ffcc44'); }
    else                { grad.addColorStop(0, '#882222'); grad.addColorStop(1, '#ee4444'); }
    ctx.fillStyle = grad;
    ctx.fillRect(barX, barY, barW * pct, barH);
    // Specular line
    ctx.fillStyle = 'rgba(255,255,255,0.30)';
    ctx.fillRect(barX, barY, barW * pct, 1);
  }

  // Boss / elite name tag
  if (e.boss || e.hp > 80) {
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#000';
    ctx.strokeText(e.name, sx + ts / 2, barY - 3);
    ctx.fillStyle = e.boss ? '#ff66ff' : '#ffcc00';
    ctx.fillText(e.name, sx + ts / 2, barY - 3);
    ctx.textAlign = 'left';
  }

  ctx.restore();
}
