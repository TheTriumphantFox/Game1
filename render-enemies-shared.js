// Creatures that belong to no single region: the golems (one drawing, twelve
// regions), the Adult Red Dragon (the tower's alone), Hendricks' dog (the prologue),
// and the fallback for any type with no art of its own.

function drawSharedCreature(e, ts, s, px, py, cx, cy, flap, phase, fb, bob, boxTop) {
  switch (e.type) {
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
    case 'adult_red_dragon': {
      // The final boss — an adult red dragon. Two poses: DORMANT, coiled asleep
      // on the crest of its hoard (wings folded, eyes shut, smoke curling from
      // its nostrils, flanks swelling with slow breath); and AWAKE, rearing
      // with vast ribbed wings, a furnace glowing in its chest, and burning
      // slit eyes. Size 2.8 — it dwarfs every other creature in the game.
      const tt = Date.now();

      // ── Sprite-sheet path (dragon-sheet.png, see dragon-sprite.js) ──────
      // One blit stands in for the creature; the soft FX around it stay
      // procedural. Falls through to the art below until the sheet loads, and
      // permanently if it fails.
      if (dragonSheetReady()) {
        const anim = dragonPickAnim(e);
        if (anim === 'dormant') {
          const pyd = boxTop;                      // no idle bob — it's asleep
          drawDragonSprite(px, pyd, s, 'dormant', phase);
          dragonSmoke(px, pyd, s, tt, phase);
        } else {
          dragonAura(cx, cy, s, tt);
          // breathe is a one-shot driven by e.breathT counting down
          const t = (anim === 'breathe')
            ? 1 - Math.max(0, Math.min(1, e.breathT / DRAGON_BREATH_ANIM_MS))
            : undefined;
          drawDragonSprite(px, py, s, anim, phase, t);
          // The furnace glow sits in his chest, which the breath plume covers —
          // skip it mid-breath so it doesn't burn through the flame.
          if (anim !== 'breathe') {
            dragonFurnace(cx, py, s, Math.sin(tt / 260 + phase) * 0.5 + 0.5);
          }
          dragonEmbers(cx, py, s, tt, phase);
        }
        break;
      }

      if (e.dormant) {
        // ── Asleep on the gold ──
        const pyd = boxTop;                        // no idle bob — it's asleep
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
        dragonSmoke(px, pyd, s, tt, phase);
        ctx.lineCap = 'butt';
        break;
      }
      // ── Awake — the fight ──
      // Fiery boss aura behind everything.
      dragonAura(cx, cy, s, tt);
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
      dragonFurnace(cx, py, s, furn);
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
      dragonEmbers(cx, py, s, tt, phase);
      ctx.lineCap = 'butt';
      break;
    }
    case 'sandstone_golem':
    case 'coral_golem':
    case 'ice_golem':
    case 'stone_golem':
    case 'obsidian_golem':
    case 'cloud_golem':
    case 'fulgurite_golem':
    case 'lumen_golem':
    case 'bone_golem':
    case 'mire_golem':
    case 'rune_golem':
    case 'umbral_golem': {
      // One body, twelve palettes — the same reasoning as the shared state
      // machine in enemies.js. A golem is a blocky humanoid slab, and the only
      // thing that really differs between the regions is what it is carved from.
      //
      // `pile` is the fourth colour and it is not a shade of the body: it is the
      // region's own GROUND, taken from TILE_COLORS, because the sleeping heap
      // has to read as rubble that belongs to this map rather than as a golem
      // sitting down. `dark`/`mid` still shade it, so the heap has form.
      const GP = {
        sandstone_golem: { dark:'#a07840', mid:'#c89858', lite:'#e0bc84', eye:'#ffd27a', pile:'#d4b070' },
        coral_golem:     { dark:'#a04a38', mid:'#e8765a', lite:'#f4a08c', eye:'#ffe0b0', pile:'#d4b070' },
        ice_golem:       { dark:'#5f93ad', mid:'#8fc4dc', lite:'#c8ecf8', eye:'#d8f4ff', pile:'#e4ecf2' },
        stone_golem:     { dark:'#5e5a52', mid:'#8a857a', lite:'#a8a296', eye:'#ffd27a', pile:'#8a8174' },
        obsidian_golem:  { dark:'#241d22', mid:'#3a2f36', lite:'#584a54', eye:'#ff6a22', pile:'#4a3b34' },
        cloud_golem:     { dark:'#8b98ac', mid:'#bcc8de', lite:'#e6eef8', eye:'#ffffff', pile:'#dde6f2' },
        fulgurite_golem: { dark:'#2c4a80', mid:'#4a7ab8', lite:'#7ec8ff', eye:'#ffee33', pile:'#313749' },
        lumen_golem:     { dark:'#c0a054', mid:'#e8cc84', lite:'#fff0bc', eye:'#ffffff', pile:'#f5edd8' },
        bone_golem:      { dark:'#8a8068', mid:'#c4b898', lite:'#e8dcc0', eye:'#aa66dd', pile:'#3a2a3a' },
        mire_golem:      { dark:'#3a4a1c', mid:'#5a6e2c', lite:'#8aa044', eye:'#b8e04a', pile:'#566b2c' },
        rune_golem:      { dark:'#1c4a30', mid:'#2e7d4f', lite:'#5aa878', eye:'#cc44ff', pile:'#2e7d4f' },
        umbral_golem:    { dark:'#140f20', mid:'#2a2340', lite:'#443a60', eye:'#8b5cf6', pile:'#241d33' },
      }[e.type];
      const woke = !e.dormant;

      // ── Asleep: a heap of region-coloured rubble ────────────────────────
      // It is NOT a bowed statue any more. A statue is recognisably a golem, and
      // the brief is that a sleeping one should be indistinguishable from the
      // scenery until it stands up. Three overlapping mounds in the region's own
      // ground colour, hashed off the tile so a field of them is not one stamp
      // repeated, and nothing lit anywhere on it.
      //
      // The cost of this is real and it is deliberate: there is no way to tell a
      // golem from a rock until it wakes. Placement is what makes that fair —
      // never within 5 tiles of a road, never within 2 of cuttable rubble
      // (makeGolemDefs, enemies.js) — so a hero can only ever meet one by
      // walking well off the path into open ground.
      if (!woke) {
        const h = ((e.x * 71 + e.y * 59) % 7) / 7;         // 0..1, fixed per tile
        // The heap is a SHADE off its region's floor rather than exactly it.
        //
        // Painted in the literal floor colour it does not read as a pile at all:
        // shot against real terrain in all twelve regions, five of them
        // (sandstone, stone, fulgurite, lumen, umbral) came out as bare ground
        // with two chips floating on it. Blending in means looking like scenery,
        // not looking like nothing — the player should see a heap of rubble and
        // think nothing of it, which is a different thing from seeing no heap.
        //
        // Which way to push depends on the region: a pale floor wants the heap
        // darker and a dark floor wants it lifted, or half the world gets a pile
        // that is invisible in the other direction.
        const pn = parseInt(GP.pile.slice(1), 16);
        const lum = (((pn >> 16) & 255) * 0.299 + ((pn >> 8) & 255) * 0.587 + (pn & 255) * 0.114) / 255;
        const heap = _shadeHex(GP.pile, lum > 0.45 ? 0.80 : 1.45);
        // The heap sits ON the foot line and stands about half a tile, which is
        // GOLEM_STAND_Z: the height the hero can step onto it from. A pile drawn
        // shorter than the thing it lets you climb is a lie the player finds out
        // about with their feet.
        const foot = py + s * 0.95;
        const mound = (fx, rx, ry, fill) => {
          ctx.fillStyle = fill;
          ctx.beginPath();
          ctx.ellipse(px + s * fx, foot, s * rx, s * ry, 0, Math.PI, 0);
          ctx.fill();
        };
        mound(0.32 + h * 0.05, 0.26, 0.30, _shadeHex(heap, 0.78));   // back left shoulder
        mound(0.70 - h * 0.05, 0.24, 0.26, _shadeHex(heap, 0.90));   // back right shoulder
        mound(0.50, 0.42, 0.44, heap);                               // the heap itself
        // A rim of the floor's own colour along the foot, so the heap sits IN
        // the ground rather than on top of it like a sticker.
        ctx.fillStyle = GP.pile;
        ctx.beginPath();
        ctx.ellipse(px + s * 0.50, foot, s * 0.44, s * 0.07, 0, Math.PI, 0);
        ctx.fill();
        // Chips of the darker stone on the crown, so it has texture at a glance
        // instead of reading as one smooth blob.
        ctx.fillStyle = _shadeHex(heap, 0.66);
        ctx.fillRect(px + s * (0.34 + h * 0.12), foot - s * 0.30, s * 0.11, s * 0.09);
        ctx.fillRect(px + s * (0.58 - h * 0.10), foot - s * 0.20, s * 0.09, s * 0.08);
        ctx.fillStyle = _shadeHex(heap, 1.20);
        ctx.fillRect(px + s * (0.46 + h * 0.06), foot - s * 0.38, s * 0.08, s * 0.07);
        ctx.restore();
        return true;   // the dormant pile is finished: no HP bar, no tag
      }
      const bob = Math.sin(Date.now()/260 + phase) * s*0.02;
      const top = py + bob;
      const glow = 0.55 + 0.45*Math.sin(Date.now()/220 + phase);

      // THE BODY IS STRETCHED TO FILL ITS BOX, and this is the one thing here
      // that is not just art.
      //
      // Everything below is authored between 0.12 and 0.96 of the sprite box, so
      // a golem at size 3 measured 2.52 tiles tall rather than the three the
      // design asks for. Restating fifteen coordinates to fix that would be
      // fifteen chances to typo a slab into a stack of loose rectangles, so the
      // whole body is scaled about its own foot line instead. Vertical only —
      // the slab's width is already right, and stretching it sideways would make
      // a golem look inflated rather than tall.
      const GOLEM_FILL = 1 / 0.84;
      ctx.save();
      ctx.translate(0, top + s * 0.96);
      ctx.scale(1, GOLEM_FILL);
      ctx.translate(0, -(top + s * 0.96));

      // Legs
      ctx.fillStyle = GP.dark;
      ctx.fillRect(px + s*0.28, top + s*0.66, s*0.16, s*0.30);
      ctx.fillRect(px + s*0.56, top + s*0.66, s*0.16, s*0.30);
      // Torso
      ctx.fillStyle = GP.mid;
      ctx.fillRect(px + s*0.24, top + s*0.34, s*0.52, s*0.36);
      ctx.fillStyle = GP.lite;                                  // lit shoulder
      ctx.fillRect(px + s*0.24, top + s*0.34, s*0.26, s*0.36);
      // Arms, raised a little off the body.
      ctx.fillStyle = GP.dark;
      const armY = top + s*0.36;
      ctx.fillRect(px + s*0.12, armY, s*0.14, s*0.34);
      ctx.fillRect(px + s*0.74, armY, s*0.14, s*0.34);
      // Head
      ctx.fillStyle = GP.mid;
      ctx.fillRect(px + s*0.34, top + s*0.12, s*0.32, s*0.24);
      // Seams, lit as running veins now that it is moving.
      ctx.strokeStyle = `rgba(255,220,150,${0.35 + 0.4*glow})`;
      ctx.lineWidth = Math.max(1, s*0.035);
      ctx.beginPath();
      ctx.moveTo(px + s*0.30, top + s*0.44); ctx.lineTo(px + s*0.52, top + s*0.52);
      ctx.lineTo(px + s*0.42, top + s*0.66);
      ctx.stroke();
      // Obsidian awake is MOLTEN, not merely lit. Its shell cracks into running
      // lava, which is the visual half of the heat it is now radiating at the
      // hero (moltenHeatAt, enemies.js) — the fight has to look like the reason
      // the overheat bar is climbing, or the bar reads as unrelated.
      if (e.type === 'obsidian_golem') {
        const flow = Date.now() / 380 + phase;
        ctx.fillStyle = `rgba(255,106,34,${0.45 + 0.30 * Math.sin(flow)})`;
        ctx.fillRect(px + s*0.24, top + s*0.34, s*0.52, s*0.36);   // core glow
        ctx.fillStyle = `rgba(255,196,90,${0.30 + 0.25 * Math.sin(flow * 1.4)})`;
        ctx.fillRect(px + s*0.34, top + s*0.12, s*0.32, s*0.24);   // head glow
        // Lava running down the body: short vertical runs on their own phases,
        // so it drips rather than pulses as one block.
        ctx.strokeStyle = 'rgba(255,140,40,0.75)';
        ctx.lineWidth = Math.max(1, s*0.04);
        for (let i = 0; i < 3; i++) {
          const rx = px + s * (0.32 + i * 0.16);
          const run = (Math.sin(flow + i * 1.9) * 0.5 + 0.5) * s * 0.24;
          ctx.beginPath();
          ctx.moveTo(rx, top + s*0.40);
          ctx.lineTo(rx, top + s*0.40 + run);
          ctx.stroke();
        }
        // Embers coming off it.
        ctx.fillStyle = 'rgba(255,220,150,0.55)';
        for (let i = 0; i < 2; i++) {
          const a = flow * 1.6 + i * 3.1;
          ctx.fillRect(px + s * (0.42 + 0.18 * Math.sin(a)),
                       top + s * (0.30 - 0.22 * ((a * 0.3) % 1)), s*0.05, s*0.05);
        }
      }

      // Eyes. Everything from the sleeping return down is the awake body, so
      // there is nothing left to guard on: a pile has no eyes to draw.
      ctx.fillStyle = GP.eye;
      const ey = top + s*0.20;
      ctx.fillRect(px + s*0.39, ey, s*0.07, s*0.05);
      ctx.fillRect(px + s*0.54, ey, s*0.07, s*0.05);
      ctx.restore();
      break;
    }
  }
}

registerEnemyArt(drawSharedCreature, [
  'hendricks_dog', 'adult_red_dragon', 'sandstone_golem', 'coral_golem', 'ice_golem',
  'stone_golem', 'obsidian_golem', 'cloud_golem', 'fulgurite_golem', 'lumen_golem',
  'bone_golem', 'mire_golem', 'rune_golem', 'umbral_golem',
]);

// Any type with no art of its own: a stylized blob with eyes.
function drawFallbackCreature(e, ts, s, px, py, cx, cy, flap, phase, fb, bob, boxTop) {
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
