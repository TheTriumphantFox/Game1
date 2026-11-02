// ─── Enemy sprites ────────────────────────────────────────────────────────────
// drawEnemy, split out of render.js (~2600 lines of hand-drawn per-type pixel
// art). Plain <script> globals — loaded before render.js in index.html. Calls
// drawElementFX (still in render.js) at runtime, which is fine for load order.

// ─── Adult Red Dragon soft FX ─────────────────────────────────────────────────
// Split out of the `adult_red_dragon` switch arm so the sprite-sheet path and
// the procedural fallback draw identical effects. These stay procedural on
// purpose: gradients and per-particle alpha animate better live than baked into
// frames, and each keeps its own period.

function dragonAura(cx, cy, s, tt) {
  const r = s * 0.62 + Math.sin(tt / 200) * s * 0.05;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, 'rgba(255,110,30,0.38)');
  g.addColorStop(1, 'rgba(180,40,10,0)');
  ctx.fillStyle = g;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
}

function dragonFurnace(cx, py, s, furn) {
  const g = ctx.createRadialGradient(cx, py + s * 0.46, 0, cx, py + s * 0.46, s * 0.14);
  g.addColorStop(0, `rgba(255,220,90,${0.55 + furn * 0.40})`);
  g.addColorStop(1, 'rgba(255,120,30,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, py + s * 0.46, s * 0.14, 0, Math.PI * 2); ctx.fill();
}

function dragonEmbers(cx, py, s, tt, phase) {
  for (let i = 0; i < 5; i++) {
    const ph = ((tt / 800) + i * 0.21 + phase * 0.13) % 1;
    const ex = cx + Math.sin(tt / 210 + i * 1.9) * s * 0.30;
    const ey = py + s * 0.55 - ph * s * 0.55;
    ctx.fillStyle = `rgba(255,${120 + Math.floor(ph * 110)},40,${(1 - ph) * 0.85})`;
    ctx.fillRect(ex - 1, ey - 1, 2.5, 2.5);
  }
}

function dragonSmoke(px, pyd, s, tt, phase) {
  for (let i = 0; i < 3; i++) {
    const ph = ((tt / 1600) + i * 0.33 + phase * 0.1) % 1;
    const wx = px + s * 0.13 + Math.sin(tt / 500 + i * 2.1) * s * 0.03;
    const wy = pyd + s * 0.70 - ph * s * 0.30;
    ctx.fillStyle = `rgba(120,110,110,${(1 - ph) * 0.40})`;
    ctx.beginPath(); ctx.arc(wx, wy, s * (0.015 + ph * 0.030), 0, Math.PI * 2); ctx.fill();
  }
}

// ─── Enemy sprites ────────────────────────────────────────────────────────────
// Each type has hand-drawn pixel art. Generic fallback at the end.
// A risen skeleton ally (enemies.js). Deliberately drawn NOT to be mistaken for
// the necrotic region's own `skeleton` enemy, which shares its bones: allies
// carry a violet armor-glow and a soft ground light in the Mana/Necrotic purple,
// and enemies carry neither. In a fight in the necrotic wastes there will be
// skeletons on both sides, and a player who cannot tell them apart at a glance
// cannot tell whether they are winning.
function drawSkeletonAlly(a, ts) {
  const s = ts;
  const fb = footBox(a.renderX, a.renderY, 0, s);
  const px = fb.x, cx = fb.x + s / 2;
  const phase = (a.id || 0) * 1.7;
  const bob = Math.sin(Date.now() / 240 + phase) * s * 0.02;
  const py = fb.y + bob;
  // Rising: the first 400ms are spent clawing up out of the ground, drawn by
  // clipping the body against a floor line that sweeps up as it emerges.
  const age = Date.now() - (a.bornAt || 0);
  const rise = Math.max(0, Math.min(1, age / 400));

  if (typeof groundShadow === 'function') groundShadow(a.renderX, a.renderY, 0, 0.24, 0.06, 0.32);

  ctx.save();
  ctx.beginPath();
  ctx.rect(px - s, py + s * (1 - rise) - s * 0.05, s * 3, s * 1.2);
  ctx.clip();

  // The violet aura that marks it as yours.
  ctx.globalAlpha = 0.30 + 0.14 * Math.sin(Date.now() / 300 + phase);
  ctx.fillStyle = '#8a5fd0';
  ctx.beginPath(); ctx.ellipse(cx, py + s * 0.60, s * 0.30, s * 0.34, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;

  const BONE = '#d8d2c0', BONE_D = '#a89e88';
  const facing = a.dir.x ? (a.dir.x > 0 ? 'right' : 'left') : (a.dir.y < 0 ? 'up' : 'down');
  const swing = (a.attackT || 0) > 0 ? s*0.10 : 0;
  if (facing === 'up') {
    // Back: legs, the spine down the middle of the ribs, and a blank skull.
    ctx.fillStyle = BONE_D;
    ctx.fillRect(cx - s*0.11, py + s*0.68, s*0.07, s*0.26);
    ctx.fillRect(cx + s*0.04, py + s*0.68, s*0.07, s*0.26);
    ctx.fillStyle = BONE;
    ctx.fillRect(cx - s*0.13, py + s*0.40, s*0.26, s*0.28);
    ctx.strokeStyle = BONE_D;
    ctx.lineWidth = Math.max(1, s*0.025);
    for (let i = 0; i < 3; i++) {
      const ry = py + s*(0.45 + i*0.07);
      ctx.beginPath(); ctx.moveTo(cx - s*0.13, ry); ctx.lineTo(cx + s*0.13, ry); ctx.stroke();
    }
    ctx.fillStyle = '#7d7464';
    ctx.fillRect(cx - s*0.025, py + s*0.40, s*0.05, s*0.28);
    ctx.fillStyle = BONE_D;
    ctx.fillRect(cx + s*0.14, py + s*0.42 - swing, s*0.06, s*0.24);
    ctx.fillRect(cx - s*0.20, py + s*0.42, s*0.06, s*0.24);
    ctx.fillStyle = BONE;
    ctx.beginPath(); ctx.ellipse(cx, py + s*0.30, s*0.13, s*0.12, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = BONE_D;
    ctx.beginPath(); ctx.ellipse(cx, py + s*0.35, s*0.09, s*0.05, 0, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  } else if (facing !== 'down') {
    // Side, drawn facing right: narrow ribs, one eye, a stride and a forward arm.
    ctx.save();
    mirrorIfLeft(facing, cx);
    const stride = Math.sin(Date.now() / 180 + phase) * s*0.03;
    ctx.fillStyle = BONE_D;
    ctx.fillRect(cx - s*0.09 - stride, py + s*0.68, s*0.07, s*0.26);
    ctx.fillRect(cx + s*0.02 + stride, py + s*0.68, s*0.07, s*0.26);
    ctx.fillStyle = BONE;
    ctx.fillRect(cx - s*0.09, py + s*0.40, s*0.18, s*0.28);
    ctx.strokeStyle = BONE_D;
    ctx.lineWidth = Math.max(1, s*0.025);
    for (let i = 0; i < 3; i++) {
      const ry = py + s*(0.45 + i*0.07);
      ctx.beginPath(); ctx.moveTo(cx - s*0.05, ry); ctx.lineTo(cx + s*0.09, ry); ctx.stroke();
    }
    ctx.fillStyle = '#7d7464';
    ctx.fillRect(cx - s*0.09, py + s*0.40, s*0.04, s*0.28);
    ctx.fillStyle = BONE;
    ctx.beginPath(); ctx.ellipse(cx + s*0.02, py + s*0.30, s*0.12, s*0.12, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillRect(cx + s*0.02, py + s*0.34, s*0.11, s*0.05);
    ctx.fillStyle = '#2a2030';
    ctx.fillRect(cx + s*0.05, py + s*0.28, s*0.06, s*0.04);
    ctx.fillStyle = '#c9a4ff';
    ctx.fillRect(cx + s*0.07, py + s*0.29, s*0.03, s*0.02);
    ctx.fillStyle = BONE_D;
    if (swing) ctx.fillRect(cx - s*0.01, py + s*0.40, s*0.24, s*0.06);
    else ctx.fillRect(cx - s*0.02, py + s*0.42, s*0.06, s*0.24);
    ctx.restore();
    ctx.restore();
  } else {
  // Legs
  ctx.fillStyle = BONE_D;
  ctx.fillRect(cx - s*0.11, py + s*0.68, s*0.07, s*0.26);
  ctx.fillRect(cx + s*0.04, py + s*0.68, s*0.07, s*0.26);
  // Ribcage
  ctx.fillStyle = BONE;
  ctx.fillRect(cx - s*0.13, py + s*0.40, s*0.26, s*0.28);
  ctx.strokeStyle = BONE_D;
  ctx.lineWidth = Math.max(1, s*0.025);
  for (let i = 0; i < 3; i++) {
    const ry = py + s*(0.45 + i*0.07);
    ctx.beginPath(); ctx.moveTo(cx - s*0.13, ry); ctx.lineTo(cx + s*0.13, ry); ctx.stroke();
  }
  // Arms — the leading one raised when it is swinging
  ctx.fillStyle = BONE_D;
  ctx.fillRect(cx - s*0.20, py + s*0.42 - swing, s*0.06, s*0.24);
  ctx.fillRect(cx + s*0.14, py + s*0.42, s*0.06, s*0.24);
  // Skull
  ctx.fillStyle = BONE;
  ctx.beginPath(); ctx.ellipse(cx, py + s*0.30, s*0.13, s*0.12, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#2a2030';
  ctx.fillRect(cx - s*0.07, py + s*0.28, s*0.05, s*0.04);
  ctx.fillRect(cx + s*0.02, py + s*0.28, s*0.05, s*0.04);
  // Violet eye-lights: the clearest single tell that this one is on your side.
  ctx.fillStyle = '#c9a4ff';
  ctx.fillRect(cx - s*0.065, py + s*0.29, s*0.03, s*0.02);
  ctx.fillRect(cx + s*0.032, py + s*0.29, s*0.03, s*0.02);
  ctx.restore();
  }

  // A hurt ally shows it, so the player can choose to pull the fight off one.
  if (a.hp < a.maxHp) {
    const w = s * 0.44, h = Math.max(2, s * 0.045);
    const bx = cx - w / 2, by = py + s * 0.16;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(bx, by, w, h);
    ctx.fillStyle = '#a97fe0';
    ctx.fillRect(bx, by, w * Math.max(0, a.hp / a.maxHp), h);
  }
}

// ─── Per-creature art ─────────────────────────────────────────────────────────
// Each creature's drawing lives in its home region's file (render-enemies-<region>.js)
// and registers itself here by type. All the scripts load at startup, so a boss drawn
// in its village and in the tower's throne hall is the same drawing from the same
// file. An art function returns true only when it has already closed the draw
// (restored ctx) and drawEnemy must stop.
const ENEMY_ART = Object.create(null);
function registerEnemyArt(fn, types) { for (const t of types) ENEMY_ART[t] = fn; }

// Which way a creature reads on screen: 'down', 'up', 'left' or 'right'. A melee
// creature shows its real facing (stepEnemies, projectiles.js), so the player can see
// which side is safe. A ranged one has no facing, so it simply watches the hero. A
// sleeper has not noticed anyone and shows its front.
function creatureFacing(e) {
  if (e.dormant) return 'down';
  const f = (!e.ranged && e.face) || meleeHeading(player.x - e.x, player.y - e.y);
  if (f.x) return f.x > 0 ? 'right' : 'left';
  return f.y < 0 ? 'up' : 'down';
}
// Side views are drawn facing right. Call inside ctx.save()/restore(): this mirrors
// them about the body's centre when the creature faces left.
function mirrorIfLeft(facing, cx) {
  if (facing === 'left') { ctx.translate(cx * 2, 0); ctx.scale(-1, 1); }
}

function drawEnemy(e, ts) {
  // Tile corner. Still needed: the one-tile aura backdrops in the art files, and
  // the HP bar / name tag centring, anchor to the TILE, not to the sprite box.
  const sx = (e.x - camC) * ts, sy = (e.y - camR) * ts;

  // A SLEEPING GOLEM IS A RUBBLE PILE, and the pile has to be able to hide.
  //
  // It draws at one tile rather than at the creature's own size, which is 3 —
  // a three-tile heap of rubble is not rubble, it is a landmark. Everything
  // else that would give it away is turned off with it: the elemental aura
  // below, and the sleeping name tag at the end of this function. The minimap
  // skips them too (drawMinimap, render.js).
  //
  // Deliberately keyed on `dormant && isGolem` and not on `dormant` alone. The
  // other dormant creature in the game is the final-boss dragon, which is meant
  // to be seen and keeps its tag.
  const dormantPile = !!e.dormant && typeof isGolem === 'function' && isGolem(e);
  // The render scale. Every `e.size` below reads this instead, so the shadow and
  // the aura shrink with the body rather than ringing a one-tile pile with a
  // three-tile mark.
  const drawSize = dormantPile ? 1 : e.size;
  const s = ts * drawSize;

  // The sprite box is planted on the ground instead of being centred in its
  // tile. At size 1.0 this is exactly the box it always was, because the old
  // (ts - s) / 2 offsets were both 0 there. At every other size it puts the
  // creature's feet on its own shadow: a size-0.6 goblin used to stand 21px
  // above its shadow and the size-2.8 dragon hovered 43px above its own.
  //
  // boxTop is the UN-bobbed top edge. HP bars and tags read that, so they stay
  // still while the body idles, which is what the old `oy` did.
  // groundZ is the surface it stands on (a ledge top, 5d), e.z is hover above
  // that. Lifted by the sum, with the shadow left down on the surface itself.
  const fb = footBox(e.x, e.y, (e.z || 0) + (e.groundZ || 0), s);
  const boxTop = fb.y;

  // The 14 one-tile aura backdrops in the art files paint through `fb` too. They
  // build a radial gradient centred on (cx, cy) and then fill a rectangle with
  // it, so the rectangle has to be the box or the gradient is clipped
  // off-centre: a size-1.65 storm giant put its gradient centre 15.6px above
  // the middle of a tile-anchored rect, which roughly doubled the alpha at the
  // rect's top edge and turned it into a visible seam.
  //
  // Deliberately fb and not px/py: the rect never included the idle bob while
  // the gradient always did, so a tiny wobble between the two is existing
  // behaviour. Using fb keeps that untouched and keeps size 1.0 byte-identical,
  // since fb.x/fb.y/s are exactly sx/sy/ts there.

  // Per-enemy idle bob — phase by id so a swarm doesn't bob in unison.
  const phase = (e.id || 0) * 0.74;
  const bob = Math.sin(Date.now() / 220 + phase) * 1.6;
  // Faster wing/aura pulse for ranged/flying types
  const flap = Math.sin(Date.now() / 90 + phase) * 0.5 + 0.5;
  // Damage flash: brief white tint when recently hit (e.hp < e.maxHp by a bit
  // doesn't track recency, but invincible doesn't apply — use a synthetic
  // 'lastHit' set elsewhere if needed; default off).
  const hurt = e.hurtT && e.hurtT > 0 ? Math.min(1, e.hurtT / 150) : 0;

  const px = fb.x, py = fb.y + bob;
  // Body centre, which the ~400 cx/cy sites in the art files draw against. It
  // has to track the box rather than the tile, or a sprite drawn partly from
  // px/py and partly from cx/cy would tear itself apart at any size but 1.0.
  // Identical to the old sx + ts/2, sy + ts/2 at size 1.0.
  const cx = fb.x + s / 2, cy = fb.y + s / 2 + bob;

  ctx.save();

  // ── Shadow under feet ────────────────────────────────────────────────
  // Skipped for a cutscene actor: the prologue's Red Dragon Emperor is drawn
  // with a bespoke altitude shadow by drawPrologueEmperor (render.js), and a
  // second one under him would be a new mark on screen.
  //
  // This is NOT quite a no-op, and the earlier claim here that his copy of the
  // ellipse was hidden behind his own body was wrong. Measured against a
  // pre-Phase-2 build at Beat 3's closest state (scale 1.5, alt 5, so a sprite
  // 8.25 tiles tall), a sliver of it did show: 49 pixels of ~844,000, max
  // channel delta 12, every one of them very slightly lighter. It is the bottom
  // arc of the ellipse, which the measured band (x 565 to 691, 5 rows) matches
  // to within a few pixels. The beat's other three scripted states are byte
  // identical.
  //
  // Restoring exact parity is not the right fix and would be a bigger change
  // than the one it undoes. The old ellipse sat at the tile row the sprite was
  // CENTRED on; drawing it now, from the foot row, would put it about 174px
  // lower. So the sliver goes, deliberately.
  if (!e.cutsceneActor) {
    groundShadow(e.x, e.y, (e.z || 0) + (e.groundZ || 0), 0.30 * drawSize,
                 0.07 * drawSize, 0.38, 0, undefined, e.groundZ || 0);
  }

  // ── Elemental aura (behind the sprite) ───────────────────────────────
  // Enemies whose attacks carry an element wear that element's signature FX,
  // so the threat reads at a glance and matches its projectiles/contact hits.
  // Skipped for a sleeping golem: an elemental aura is exactly the "something
  // lives here" tell the pile is trying not to have.
  if (e.element && !dormantPile) {
    drawElementFX(cx, cy, ts * 0.6 * drawSize, e.element, 0.55, (e.id || 0) * 0.37);
  }

  // ── Blight aura (behind the sprite, over the elemental one) ──────────
  // The corrupted template's only visual tell — it deliberately does not change
  // the creature's size, because "bigger" already means Greater. A blighted
  // elemental creature wears both auras (see corruption.js).
  // Skipped for a sleeping golem for the same reason as the elemental aura: a
  // pile breathing violet in an uncleansed region is not hiding.
  if (e.corrupted && !dormantPile && typeof drawCorruptedEnemyAura === 'function') {
    drawCorruptedEnemyAura(e, cx, cy, ts * 0.52 * drawSize);
  }

  // ── Per-type sprite (uses px/py which include the bob offset) ────────
  const art = ENEMY_ART[e.type] || drawFallbackCreature;
  if (art(e, ts, s, px, py, cx, cy, flap, phase, fb, bob, boxTop) === true) return;

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
  // A sleeping golem is untargetable AND unlabelled. It gets no tag at all,
  // because the tag is the loudest tell there is: a pile that announces itself
  // in text is not blending into anything.
  if (dormantPile) { ctx.restore(); return; }
  // The dormant dragon is untargetable — no HP bar, just a slumbering tag.
  if (e.dormant) {
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#000';
    const tag = `💤 ${e.name}`;
    ctx.strokeText(tag, sx + ts / 2, boxTop - 6);
    ctx.fillStyle = '#ffb066';
    ctx.fillText(tag, sx + ts / 2, boxTop - 6);
    ctx.textAlign = 'left';
    ctx.restore();
    return;
  }
  const barW = ts * drawSize * 0.92;
  const barX = fb.x + s * 0.04, barY = boxTop - 8;
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
  if (e.boss || e.hp / difficultyHpMul() > 80) {
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
