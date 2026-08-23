// ─── Projectiles, particles, damage numbers ───────────────────────────────────
// Projectiles use tile-float coordinates (tx, ty). Arrows and enemy spells
// move at constant velocity; bombs are stationary and explode on fuse timeout.

let projectiles = [];
let particles = [];
let damageNumbers = [];
// Pickup items dropped on the ground (e.g. HP hearts from killed enemies).
let drops = [];

// Reference frame duration (60 FPS). Projectile velocities and `life` counts,
// and particle motion, were all tuned per-frame at 60 FPS; scaling their updates
// by (dt / FRAME_MS) makes travel distance and lifetime depend on elapsed time
// rather than frame rate, so gameplay is identical across machines. At a steady
// 60 FPS the factor is ~1, reproducing the original feel exactly.
const FRAME_MS = 1000 / 60;

// Visual metadata for enemy-trophy drops. Shared by stepDrops (pickup particles
// and message) and drawDrop (ground sprite glow / glyph). Inventory key is the
// plural of the trophy id (fang → player.fangs). Every trophy here is also
// sellable at the General Store (TROPHY_SELL in shop.js).
// Derived from the TROPHIES registry (config.js), keyed by singular trophy id.
const TROPHY_META = {};
for (const t of TROPHIES) TROPHY_META[t.id] = { icon: t.icon, label: t.label, color: t.color };
// Snowball — a non-enemy drop (bombed from ice-region SNOW_DRIFTs), so it isn't in
// the TROPHIES registry; it still needs ground/pickup metadata here.
TROPHY_META.snowball = { icon: '⚪', label: 'Snowball', color: '#eef6ff' };

// Burst of particles at a canvas-pixel point (convert tiles with screenPX first).
// `opts` is optional and every field defaults to the original behaviour, so the
// existing five-argument calls are untouched:
//   gravity  per-frame downward acceleration (default 0.06; negative rises)
//   life     base lifetime in 60fps frames (default 25 + up to 20 random)
//   spread   initial speed multiplier (default 1)
//   fade     lifetime at which alpha reaches full (default 50; see render())
function spawnParticle(wx, wy, color, n = 6, size = 3, opts) {
  const o = opts || {};
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = (1 + Math.random() * 3) * (o.spread === undefined ? 1 : o.spread);
    const life = (o.life === undefined ? 25 : o.life) + Math.random() * 20;
    particles.push({
      x: wx, y: wy,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life,
      color,
      size: size * (0.5 + Math.random()),
      gravity: o.gravity,
      fade: o.fade === undefined ? 50 : o.fade
    });
  }
}

// Rising embers — the fire equivalent of spawnParticle's hit-spark burst.
// Negative gravity and a long life, because embers climb and linger; the stock
// burst falls and is gone in three quarters of a second.
function spawnEmbers(wx, wy, n = 10) {
  const colors = ['#ffb347', '#ff7a1f', '#ffdf7a', '#e04a10'];
  spawnParticle(wx, wy, colors[Math.floor(Math.random() * colors.length)], n, 2.2, {
    gravity: -0.035, life: 70, spread: 0.5, fade: 90
  });
}

// Opposite-element vulnerability: any enemy that deals an element is weak to
// that element's opposite (see OPPOSITE in elements.js). 50% chance per hit to
// take an extra (floor(level/5) + 1) d4 of the opposite element's damage —
// always at least 1d4, so the vulnerability is in effect from level 1 and grows
// by another die every 5 levels. `level` is swordLevel for sword swings and
// bowLevel for arrows. No-op when the enemy has no element, has no defined
// opposite, or the 50% roll fails.
function rollOppositeVuln(e, level, force) {
  if (!e.element) return;
  const oppId = OPPOSITE[e.element];
  if (!oppId) return;
  // The Dragonbane (#15) "ignores resistance": it skips the 50% roll (always procs)
  // and bites 3 dice deeper, so the opposite-element damage always lands and hard.
  if (!force && Math.random() >= 0.5) return;
  let dice = Math.floor((level || 0) / 5) + 1;
  if (force) dice += 3;
  let bonus = 0;
  for (let d = 0; d < dice; d++) bonus += 1 + Math.floor(Math.random() * 4);
  e.hp -= bonus;
  const oppElem = elementInfo(oppId);
  if (!oppElem) return;
  damageNumbers.push({
    entity: e,
    val: `${oppElem.icon}${bonus}`,
    color: oppElem.color,
    life: 1100,
    rise: -16
  });
  const esp = screenPX(e.x, e.y);
  spawnParticle(esp.x, esp.y, oppElem.color, 4, 2);
}

// Resolve an incoming hit against the player's defenses and apply the HP loss.
// Two layers, in order:
//   1. Elemental armor — blocks 50–80% of matching-element damage, scaling with
//      the worn armor's upgrade level (see applyElementalArmor / elements.js).
//   2. Flat armor — at armor level N (≥2), each hit absorbs
//      ((N-1)d4 - N) damage, clamped to 0. So the scaling is:
//        +2 → 1d4 - 2  (avg ≈0.75)
//        +3 → 2d4 - 3  (avg ≈2.06)
//        +4 → 3d4 - 4  (avg ≈3.52)
//        +5 → 4d4 - 5  (avg ≈5.02)
//      Each additional Armor point adds another d4 of mitigation while the
//      flat -N modifier keeps low rolls modest, so heavy armor really shines
//      on big hits.
// The post-armor damage is floored at 1 so every hit that gets past i-frames
// still registers. Damage numbers are tagged with 🛡 when armor blocked any
// portion of the hit so the player can see the proc.
function damagePlayer(rawDmg, hitElement) {
  // Herbalist Elixir — a full elemental immunity buff nullifies all matching-
  // element damage outright (stronger than elemental armor's -50%). Off-element
  // hits fall through to the normal armor/HP path below.
  if (hitElement && player.immunityElement === hitElement && (player.immunityTimer || 0) > 0) {
    const psp = screenPX(player.x, player.y);
    const elem = SWORD_ELEMENTS[hitElement];
    spawnParticle(psp.x, psp.y, elem ? elem.color : '#ffffff', 8, 3);
    damageNumbers.push({
      entity: 'player',
      val: `${elem ? elem.icon : ''}IMMUNE`,
      color: elem ? elem.color : '#ffffff',
      life: 1100, rise: -6
    });
    return 0;
  }

  // Opposite-element armor is a liability. Wearing the armor whose element is the
  // enemy's opposite (see OPPOSITE) leaves you exposed to its attacks: 50% chance
  // the hit lands doubled. This mirrors how that same enemy is itself vulnerable
  // to its opposite element (rollOppositeVuln) — the pairing, turned against you.
  let doubled = false;
  if (hitElement
      && player.activeArmorElement === OPPOSITE[hitElement]
      && Math.random() < 0.5) {
    rawDmg *= 2;
    doubled = true;
  }

  const { dmg: afterElem, resisted } = applyElementalArmor(rawDmg, hitElement);

  // Flat armor roll. Only activates at +2 Armor and only when there's enough
  // damage left to actually shave — skipping the roll when afterElem === 1
  // keeps the min-1 floor from wasting a die.
  //
  // While an elemental armor is worn it REPLACES the hero's plain forged armor
  // with its own ore-upgraded defense (level × 2: +2/+4/+6/+8/+10). A freshly
  // forged elemental armor (level 0 → +0) therefore gives no flat mitigation
  // until upgraded — the trade for its elemental block. Plain player.armor only
  // applies when no elemental armor is equipped.
  let armorBlock = 0;
  let armorLv = player.armor || 0;
  if (player.activeArmorElement) {
    armorLv = elementalArmorPhys(player.activeArmorElement);
  }
  if (armorLv >= 2 && afterElem > 1) {
    // (N-1) d4 dice, then a single -N modifier applied to the sum. Negatives
    // are *not* clamped here — they're kept so the residual below can detect
    // a "huge over-absorption" full block.
    const dice = armorLv - 1;
    let total = -armorLv;
    for (let d = 0; d < dice; d++) total += 1 + Math.floor(Math.random() * 4);
    armorBlock = total;
  }

  // Residual damage after armor. Normally we floor at 1 so every hit that
  // gets past i-frames still nicks the player. But if armor over-absorbed by
  // 15 or more (residual ≤ -15) the hit is fully nullified — armor just ate
  // the entire blow. armorBlock can also be negative on a bad roll; the
  // Math.max(0, …) further below clamps it for the "did armor proc?" check.
  const residual = afterElem - Math.max(0, armorBlock);
  const finalDmg = (afterElem - armorBlock) <= -15 ? 0 : Math.max(1, residual);
  armorBlock = Math.max(0, armorBlock);

  // Temporary HP (green hearts) soaks the post-armor hit before real HP does.
  // Any overflow past the temp pool spills onto real HP.
  let tempAbsorbed = 0;
  if ((player.tempHp || 0) > 0 && finalDmg > 0) {
    tempAbsorbed = Math.min(player.tempHp, finalDmg);
    player.tempHp -= tempAbsorbed;
  }
  const hpDmg = finalDmg - tempAbsorbed;
  player.hp -= hpDmg;
  if (hpDmg > 0 && typeof buzz === 'function') buzz([0, 35, 25, 35]);

  const psp = screenPX(player.x, player.y);
  if (finalDmg === 0) {
    // Full armor block — armor over-absorbed the hit by 15+. Show a bright
    // "🛡 BLOCK" indicator so the proc is clearly visible.
    spawnParticle(psp.x, psp.y, '#ffee88', 10, 4);
    spawnParticle(psp.x, psp.y, '#ffffff',  6, 3);
    damageNumbers.push({
      entity: 'player',
      val: '🛡BLOCK',
      color: '#ffee88',
      life: 1200, rise: -6
    });
  } else if (tempAbsorbed > 0 && hpDmg === 0) {
    // Temporary HP soaked the entire hit — green indicator, no real HP lost.
    spawnParticle(psp.x, psp.y, '#3fc24a', 8, 3);
    spawnParticle(psp.x, psp.y, '#aaffaa', 5, 2);
    damageNumbers.push({ entity: 'player', val: `💚${tempAbsorbed}`, color: '#5fe070', life: 1100, rise: 0 });
  } else if (resisted && SWORD_ELEMENTS[resisted]) {
    // Elemental resist already happened; tag with the element icon. If flat
    // armor *also* shaved damage, the 🛡 in front doubles as that indicator.
    const elem = SWORD_ELEMENTS[resisted];
    spawnParticle(psp.x, psp.y, elem.color, 6, 3);
    damageNumbers.push({
      entity: 'player',
      val: `🛡${elem.icon}${hpDmg}`,
      color: elem.color,
      life: 1100, rise: 0
    });
  } else if (armorBlock > 0) {
    // Plain flat-armor block — silvery damage number with the shield prefix.
    spawnParticle(psp.x, psp.y, '#dddddd', 5, 3);
    damageNumbers.push({
      entity: 'player',
      val: `🛡${hpDmg}`,
      color: '#dddddd',
      life: 1100, rise: 0
    });
  } else {
    spawnParticle(psp.x, psp.y, '#ff2222', 5, 3);
    damageNumbers.push({ entity: 'player', val: hpDmg, color: '#ff4444', life: 1000, rise: 0 });
  }
  // Opposite-armor double-damage proc — a bright floating marker (in the enemy
  // element's colour) so the reason the hit landed so hard is obvious.
  if (doubled && finalDmg > 0) {
    const oppElem = elementInfo(hitElement);
    spawnParticle(psp.x, psp.y, oppElem ? oppElem.color : '#ff2222', 8, 3);
    damageNumbers.push({
      entity: 'player',
      val: `${oppElem ? oppElem.icon : ''}‼×2`,
      color: oppElem ? oppElem.color : '#ff2222',
      life: 1200, rise: -16
    });
  }
  return finalDmg;
}

// Convert tile coordinates to canvas pixel coordinates (camera-relative).
//
// There are two anchor contracts in this renderer and they are both correct:
//
//   screenPX(tx, ty)  gives the TILE CENTRE. Its ~84 callers are particle
//                     spawns and damage-number anchors, which want a body
//                     centre, not ground contact. Re-anchoring them to the feet
//                     would drop every burst half a tile.
//   footBox(...)      gives a sprite box planted on the GROUND (projection.js).
//                     Actors use this, so height reads correctly and boots meet
//                     their own shadow.
//
// Expressed through worldX/worldY so there is one source of camera math rather
// than two copies of the same subtraction. Numerically identical to what this
// returned before.
function screenPX(tx, ty) {
  return {
    x: worldX(tx + 0.5),
    y: worldY(ty + 0.5)
  };
}

// ─── Spawn projectiles (player actions) ───────────────────────────────────────
function firePlayerArrow() {
  // The bow is Grandmother's, and the player doesn't have it until she gives it
  // to them in the prologue's last beat. Before that the shot simply doesn't
  // happen — there is no bow to draw.
  if (!player.hasBow) { showMsg('🏹 You have no bow.', 1200); return; }
  // If an elemental arrow is nocked AND there's at least one of that type
  // available, consume it. Otherwise fall back to a plain arrow (and reset
  // the nocked element so the radial menu doesn't keep claiming it's active).
  // Plain arrows are now a real inventory item (player.arrows.plain); when
  // stock hits zero the shot is suppressed instead of firing for free.
  let element = null;
  player.arrows = player.arrows || {};
  const active = player.activeArrowElement;
  if (active && (player.arrows[active] || 0) > 0) {
    element = active;
    player.arrows[active]--;
    if (player.arrows[active] <= 0) {
      // Auto-fall-back when we run dry on the active type
      player.activeArrowElement = null;
    }
  } else {
    // Plain arrow path — consume from stock.
    if ((player.arrows.plain || 0) <= 0) {
      showMsg('🏹 Out of arrows!', 1200);
      return;
    }
    player.arrows.plain--;
  }
  // The arrow is still spawned immediately for gameplay, but the sprite now
  // shows the draw/release action for the same window the player sees the bow.
  player.bowTimer = 280;
  if (typeof buzz === 'function') buzz(12);
  const elemColor = element ? SWORD_ELEMENTS[element]?.color : null;
  projectiles.push({
    tx: player.x + 0.5, ty: player.y + 0.5,
    vx: player.swordDir.x * 0.35, vy: player.swordDir.y * 0.35,
    dmg: player.bowLevel * 2 + 1,
    type: 'arrow', life: 120,
    color: elemColor || '#ddaa44',
    element
  });
}

// ─── Bomb throw arc ───────────────────────────────────────────────────────────
// A bomb used to APPEAR three tiles ahead of the hero. It is thrown now, and
// travels there on a ballistic arc over the first part of its fuse.
//
// The landing tile and the total fuse are deliberately unchanged, and the bomb
// snaps to the exact landing coordinate when the flight ends. So it detonates in
// the same place, at the same moment, for the same damage as before: what is new
// is that you can see it leave his hand. Anything else would be a balance change
// wearing a rendering change's clothes.
//
// Frames here are 60 FPS-referenced, the same unit `life` and `step` use.
const BOMB_FLIGHT_FRAMES = 16;     // of the 50-frame fuse; the rest is spent lit
const BOMB_GRAVITY = 0.028;        // world units per frame per frame, +z is up

// Launch speed that brings the arc back to z = 0 exactly as the flight ends.
// Integrating z += vz, vz -= g over n steps from z = 0 gives
// z(n) = n*vz0 - g*n*(n-1)/2, so z(n) = 0 at vz0 = g*(n-1)/2. Derived rather
// than written as a literal, so tuning either constant cannot desync the two
// and leave the bomb landing above or below the ground.
const BOMB_THROW_VZ = BOMB_GRAVITY * (BOMB_FLIGHT_FRAMES - 1) / 2;

// How tall terrain has to be to stop a thrown bomb, in world units.
//
// A deliberate threshold, NOT the arc's own height. Physically the bomb only
// reaches 0.896, so letting its arc decide would have it turned back by a
// PLATEAU (1.20) or a CLIFF (1.40), and by a fence of waist-high furniture. The
// call was that a bomb clears terrain and is stopped by BUILT things, so this is
// set to the wall height: 1.60 catches all twelve 1.60 wall types (WALL,
// CAVE_WALL, SHRINE_WALL, BLIGHTED/POISON/SHADOW_WALL, SHRINE_GATE,
// CASTLE_WINDOW, BANNER, MANGROVE, CLOUDWALL, STORM_CLOUD), TREE at 1.80, and
// everything above. ROCK 0.40, RUBBLE 0.35, BURNT_WALL 0.50, PLATEAU 1.20 and
// CLIFF 1.40 are all still cleared.
//
// This ENDS bombing through walls, which the throw arc had preserved from the
// days when a bomb simply appeared three tiles away. Worth knowing: a bomb
// thrown at a nearby wall now stops against it and detonates about a tile from
// the hero, well inside the 2-tile blast, so throwing one at a wall you are
// standing next to will hurt.
const BOMB_THROW_CLEARANCE = 1.60;

function placePlayerBomb() {
  // Bombs are a finite consumable now — no bombs, no boom.
  if ((player.bombs || 0) <= 0) {
    showMsg('💣 Out of bombs — buy some at the General Store.', 1500);
    return;
  }
  player.bombs--;
  if (typeof updateHUD === 'function') updateHUD();
  if (typeof buzz === 'function') buzz(20);
  const bx = player.x + player.swordDir.x * 3;
  const by = player.y + player.swordDir.y * 3;
  // Unchanged landing point. It is kept on the projectile so the landing can be
  // snapped to it exactly, instead of trusting a float sum over a variable
  // number of frames to arrive on the tile it was aimed at.
  const destX = bx + 0.5, destY = by + 0.5;
  const fromX = player.x + 0.5, fromY = player.y + 0.5;
  projectiles.push({
    tx: fromX, ty: fromY,
    vx: (destX - fromX) / BOMB_FLIGHT_FRAMES,
    vy: (destY - fromY) / BOMB_FLIGHT_FRAMES,
    z: 0, vz: BOMB_THROW_VZ,
    flight: BOMB_FLIGHT_FRAMES,
    destX, destY,
    dmg: 7 + player.swordLevel,
    type: 'bomb', life: 50, color: '#333'
  });
}

// ─── Sword swing (instant, AoE in front of player) ────────────────────────────
function doSwordSwing() {
  if (typeof buzz === 'function') buzz(15);
  player.swordTimer = 180;
  player.weapon = 'sword';
  const tx = player.x + player.swordDir.x;
  const ty = player.y + player.swordDir.y;
  const sp = screenPX(tx, ty);
  spawnParticle(sp.x, sp.y, '#ffee88', 4, 3);
  enemies.filter(e => !e.dead && !e.dormant).forEach(e => {
    if (Math.abs(e.x - tx) <= 1 && Math.abs(e.y - ty) <= 1) {
      // Base physical damage
      const baseDmg = player.swordLevel + Math.floor(Math.random() * 3);
      e.hp -= baseDmg;
      damageNumbers.push({ entity: e, val: baseDmg, color: '#ff4444', life: 1000, rise: 0 });

      // Elemental enemies are vulnerable to their opposite element: 50% chance
      // per hit to take an extra 1d4 of it (always at least 1d4 from Lv1, plus
      // another die every 5 sword levels). The Dragonbane forces a guaranteed,
      // deepened proc — it ignores resistance (#15).
      const dragon = player.activeSwordElement === 'dragonbane';
      rollOppositeVuln(e, player.swordLevel, dragon);

      // Elemental damage — ONLY the currently equipped elemental sword adds
      // its 1d4 hit. (Elemental swords are specific weapons; switching swords
      // changes which element applies, instead of stacking all owned elements.)
      if (player.activeSwordElement) {
        const elem = SWORD_ELEMENTS[player.activeSwordElement];
        if (elem) {
          // Elemental sword: 1d4 + a flat +2 per upgrade level. Dragonbane instead
          // hits for its own capstone bonus (1d12 + 12), above any elemental ceiling.
          const elemDmg = dragon
            ? dragonbaneSwordBonus()
            : 1 + Math.floor(Math.random() * 4) + elementalSwordBonus(player.activeSwordElement);
          e.hp -= elemDmg;
          damageNumbers.push({
            entity: e,
            val: `${elem.icon}${elemDmg}`,
            color: elem.color,
            life: 1100,
            rise: -8
          });
          const esp = screenPX(e.x, e.y);
          spawnParticle(esp.x, esp.y, elem.color, 4, 2);
        }
      }

      if (e.hp <= 0) killEnemy(e);
    }
  });

  // Cut down soft foliage in the swing. Flowers, mushrooms, flowering cacti, and
  // bones all have 1 HP, so a single swing clears them. Same 3x3 zone as the
  // enemy hit. Each cut tile reverts to the map's natural ground (grass in
  // forest, sand in desert/water, snow in ice, …) and may leave a pickup behind.
  const map = mapData();
  const ground = mapGroundTile();
  // #9 Missing Gatherer reward: +N extra forage per pick in a region whose gatherer
  // has been rescued (player.forageBonus).
  const forageRid = (typeof currentMap === 'function' && currentMap()) ? regionIdForMap(currentMap()) : null;
  const forageBonus = (forageRid && player.forageBonus && player.forageBonus[forageRid]) || 0;
  const ctc = Math.round(tx), ctr = Math.round(ty);
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    const tr = ctr + dr, tc = ctc + dc;
    if (tr <= 0 || tr >= MROWS - 1 || tc <= 0 || tc >= MCOLS - 1) continue;
    const tile = map[tr][tc];
    if (typeof tryShrineStrike === 'function' && tryShrineStrike(tc, tr, player.activeSwordElement || null)) continue;
    // A sealed shrine in the swing zone: the strike tries to break its seal with
    // the equipped elemental sword (see tryUnsealShrine in world.js). Handled here,
    // never cut like foliage.
    if (tile === T.SEALED_SHRINE) {
      if (typeof tryUnsealShrine === 'function') tryUnsealShrine(tc, tr, player.activeSwordElement || null);
      continue;
    }
    // drop type and drop chance per cuttable tile (all revert to the map ground)
    let dropType = null, dropChance = 0;
    if      (tile === T.FLOWER)           { dropType = 'herbal';   dropChance = 0.50; }
    else if (tile === T.MUSHROOM)         { dropType = 'mushroom'; dropChance = 0.50; }
    else if (tile === T.FERN)             { dropType = 'fiddlehead'; dropChance = 0.50; }
    else if (tile === T.FLOWERING_CACTUS) { dropType = 'herbal';   dropChance = 0.50; }
    else if (tile === T.DESERT_SUCCULENT) { dropType = 'aloe';     dropChance = 0.50; }
    else if (tile === T.BONES)            { dropType = 'bonemeal'; dropChance = 0.50; }
    else if (tile === T.BONE_PILE)        { dropType = 'bonemeal';   dropChance = 0.50; }
    else if (tile === T.WITHERED_SHRUB)   { dropType = 'witherwood'; dropChance = 0.45; }
    else if (tile === T.CORPSE_FLOWER)    { dropType = 'gravebloom'; dropChance = 0.45; }
    else if (tile === T.WINTER_BERRY_BUSH){ dropType = 'winterberry'; dropChance = 0.60; }
    else if (tile === T.FROST_LILY)       { dropType = 'frostpetal';  dropChance = 0.50; }
    else if (tile === T.FROST_FERN)       { dropType = 'frostfern';   dropChance = 0.50; }
    else if (tile === T.STONES)           { dropType = 'stone';     dropChance = 0.50; }
    else if (tile === T.SEASHELL)         { dropType = 'seashell';  dropChance = 0.50; }
    else if (tile === T.CORAL)            { dropType = 'coral';     dropChance = 0.50; }
    else if (tile === T.MOUNTAIN_SAGE)    { dropType = 'sage';      dropChance = 0.50; }
    else if (tile === T.MOSS_CLUMP)       { dropType = 'moss';      dropChance = 0.50; }
    else if (tile === T.CRYSTAL_CLUSTER)  { dropType = 'crystal';   dropChance = 0.45; }
    else if (tile === T.SKY_BLOOM)        { dropType = 'skypetal';  dropChance = 0.50; }
    else if (tile === T.WIND_REED)        { dropType = 'windseed';  dropChance = 0.50; }
    else if (tile === T.STORM_THISTLE)    { dropType = 'thistledown'; dropChance = 0.45; }
    else if (tile === T.VOLT_BLOOM)       { dropType = 'voltpetal';  dropChance = 0.50; }
    else if (tile === T.SPARK_REED)       { dropType = 'sparkseed';  dropChance = 0.50; }
    else if (tile === T.FULGURITE)        { dropType = 'fulgurite';  dropChance = 0.45; }
    else if (tile === T.RADIANT_BLOOM)    { dropType = 'mote';       dropChance = 0.50; }
    else if (tile === T.GLOW_REED)        { dropType = 'sunseed';    dropChance = 0.50; }
    else if (tile === T.LUMEN_SHARD)      { dropType = 'prism';      dropChance = 0.45; }
    else if (tile === T.CATTAIL)          { dropType = 'reedpith';   dropChance = 0.50; }
    else if (tile === T.SWAMP_FERN)       { dropType = 'herbal';     dropChance = 0.50; }
    else if (tile === T.SWAMP_MUSHROOM)   { dropType = 'mushroom';   dropChance = 0.50; }
    else if (tile === T.GIANT_BLOOM)      { dropType = 'manapetal';  dropChance = 0.55; }
    else if (tile === T.VERDANT_FERN)     { dropType = 'heartfrond'; dropChance = 0.55; }
    else if (tile === T.GIANT_MUSHROOM)   { dropType = 'glowcap';    dropChance = 0.55; }
    else if (tile === T.EMBER_FLOWER)     { dropType = 'emberbloom'; dropChance = 0.50; }
    else if (tile === T.SULFUR_SHRUB)     { dropType = 'sulfurmoss'; dropChance = 0.50; }
    else if (tile === T.GLOOM_BLOOM)      { dropType = 'duskcap';    dropChance = 0.55; }
    else if (tile === T.VOID_FROND)       { dropType = 'voidpetal';  dropChance = 0.55; }
    else continue;
    map[tr][tc] = ground;
    if (dropType && Math.random() < dropChance) {
      drops.push({
        type: dropType, val: 1 + forageBonus,
        x: tc, y: tr,
        life: 10000, bob: 0, collected: false
      });
    }
  }
}

// ─── Punch (the pre-weapon action) ────────────────────────────────────────────
// What [Z] does before Grandmother's Sword exists. It is not a weapon and is not
// meant to become one: the prologue needs the player to have *something* to press
// so Beat 2's dog encounter can teach the action button, and that is the whole of
// its job. It deals exactly 1 damage, and only to Hendricks' dog. Nothing else in
// the game, story or otherwise, can be harmed by it.
//
// Enforced by target rather than by context (a "prologue only" check) on purpose:
// the rule in the design notes is about what a fist can hurt, not about where the
// player is standing, so a fist that stays harmless is one fewer thing to reason
// about if the punch ever survives past the prologue.
//
// The dog is spawned by stage 4 and does not exist yet. It must carry this key —
// see PUNCHABLE_ENEMY below — or the punch will bounce off it like everything else.
const PUNCHABLE_ENEMY = 'hendricks_dog';
const PUNCH_DAMAGE = 1;

function doPunch() {
  if (typeof buzz === 'function') buzz(10);
  player.punchTimer = 150;
  const tx = player.x + player.swordDir.x;
  const ty = player.y + player.swordDir.y;
  const sp = screenPX(tx, ty);
  spawnParticle(sp.x, sp.y, '#e8c8a8', 3, 2);

  // A single tile in front, not the sword's 3x3 — a fist has no reach.
  let connected = false;
  for (const e of enemies) {
    if (e.dead || e.dormant) continue;
    if (Math.round(e.x) !== Math.round(tx) || Math.round(e.y) !== Math.round(ty)) continue;
    connected = true;
    if (e.type !== PUNCHABLE_ENEMY) {
      // Everything else shrugs it off. Said out loud rather than silently doing
      // nothing, so the player learns the fist is not the answer here.
      if (typeof showMsg === 'function') showMsg('👊 Your fist does nothing.', 1200);
      continue;
    }
    e.hp -= PUNCH_DAMAGE;
    damageNumbers.push({ entity: e, val: PUNCH_DAMAGE, color: '#ff4444', life: 1000, rise: 0 });
    // Deliberately no killEnemy call: the dog cannot be killed. It breaks off and
    // runs at 1 HP, which is stage 4's business — this only ever takes it down to
    // that point. Clamping here as well means a stray extra hit can't drop it to 0
    // even if that flee check is late.
    if (e.hp < 1) e.hp = 1;
  }
  if (!connected && typeof showMsg === 'function') showMsg('👊 You swing at nothing.', 900);
}

// ─── Enemy AI step ────────────────────────────────────────────────────────────
// Per-enemy movement timer; ranged enemies keep distance, melee enemies pursue.
function stepEnemies(dt, map) {
  // Per-tick occupancy index of live enemies so the "is the target tile taken?"
  // check below is O(1) instead of re-scanning every enemy (was O(n²) per
  // frame). A count Map (not a Set) so overlapping spawns don't free a tile
  // that's still held; kept in sync as enemies move so later movers still see
  // earlier moves — preserving the original enemies.some() semantics exactly.
  const tkey = (x, y) => y * MCOLS + x;
  const occ = new Map();
  for (const o of enemies) {
    if (o.dead) continue;
    const k = tkey(o.x, o.y);
    occ.set(k, (occ.get(k) || 0) + 1);
  }

  for (const e of enemies) {
    // Altitude eases every frame, ahead of every gate below it. A hovering
    // enemy is still stepped while it is dormant or staggered, because both of
    // those want it to settle back DOWN rather than hang in the air, and the
    // step-cadence gate further down would otherwise move it a third of a tile
    // at a time. Purely visual: see the `hover` note in enemies.js.
    if (!e.dead) stepEnemyHover(e, dt, map);
    if (e.dead || e.dormant) continue;      // the dormant dragon sleeps
    // Staggered: reeling, and neither moving nor attacking until it passes. Set
    // by the Emperor's 15% threshold (tower.js) and general enough for anything
    // else that ever needs to be stopped without being made dormant — dormant
    // is a sleeping enemy, this is an interrupted one.
    if (e.staggerT > 0) { e.staggerT -= dt; continue; }
    e.timer -= dt;
    if (e.timer > 0) continue;
    e.timer = e.spd;

    const dx = player.x - e.x, dy = player.y - e.y;
    const dist = Math.abs(dx) + Math.abs(dy);
    let emx = 0, emy = 0;

    if (e.ranged) {
      // Try to stay 5-9 tiles away from player
      if (dist < 5) {
        emx = -Math.sign(dx); emy = 0;
        if (!emx) emy = -Math.sign(dy);
      } else if (dist > 9) {
        emx = Math.sign(dx); emy = 0;
        if (Math.abs(dy) > Math.abs(dx)) { emx = 0; emy = Math.sign(dy); }
      } else {
        // In the sweet spot — random strafe
        const d = [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}][Math.floor(Math.random() * 4)];
        emx = d.x; emy = d.y;
      }
    } else {
      // Melee — pursue if within aggro range
      if (dist < 8) {
        emx = Math.sign(dx); emy = 0;
        if (Math.abs(dy) > Math.abs(dx)) { emx = 0; emy = Math.sign(dy); }
      } else {
        const d = [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}][Math.floor(Math.random() * 4)];
        emx = d.x; emy = d.y;
      }
    }

    const nx = e.x + emx, ny = e.y + emy;
    // Don't walk into other enemies, the player, or solid terrain. Aquatic
    // enemies (swims) also treat the medium-water shelf as open ground.
    const nkey = tkey(nx, ny);
    // Exclude e's own count when the "move" is a no-op back onto its own tile.
    const selfHere = (nx === e.x && ny === e.y) ? 1 : 0;
    const otherEnemy = ((occ.get(nkey) || 0) - selfHere) > 0;
    const onPlayer = (nx === player.x && ny === player.y);
    const onVillager = typeof villagerAt === 'function' && villagerAt(nx, ny);
    // Fliers (the dragon) soar over every solid tile — walls, pillars, lava —
    // gated only by an explicit in-bounds clamp (isSolid returns true out of
    // bounds AND the border ring is solid, so without this a flier could never
    // leave a wall's edge — or worse, drift off-map).
    const inBounds = nx >= 1 && ny >= 1 && nx <= MCOLS - 2 && ny <= MROWS - 2;
    // The step-up gate (5d), the same rule the hero walks by. Without it an
    // enemy strolls up a one-tile shelf as if it were floor, and worse, strolls
    // OFF the far side into the air. Stepping down is allowed; drawEnemy puts
    // it at the height of whatever it is standing on either way.
    //
    // Fliers are exempt for the same reason they ignore walls: `flies` means it
    // is not walking on the ground at all.
    const stepsUpTooFar = !e.flies && stepUpBlocked(map, e.x, e.y, nx, ny);
    const blocked = e.flies
      ? !inBounds
      : (stepsUpTooFar ||
         (isSolid(map, nx, ny) && !(e.swims && isMediumWater(map, nx, ny))));
    if (!blocked && !otherEnemy && !onPlayer && !onVillager) {
      const okey = tkey(e.x, e.y);
      occ.set(okey, (occ.get(okey) || 0) - 1);
      e.x = nx; e.y = ny;
      occ.set(nkey, (occ.get(nkey) || 0) + 1);
    }

    // Melee contact damage (re-check distance after move)
    const mdx = player.x - e.x, mdy = player.y - e.y;
    if (Math.abs(mdx) <= 1 && Math.abs(mdy) <= 1 && player.invincible <= 0 && !e.ranged) {
      damagePlayer(e.dmg, e.element);
      player.invincible = 900;
      if (player.hp <= 0) respawn();
    }
  }
}

// ─── Enemy ranged fire ────────────────────────────────────────────────────────
function stepEnemyRanged(dt) {
  for (const e of enemies) {
    if (e.dead || !e.ranged || e.dormant) continue;
    // Purely cosmetic: how long the breath animation has left to play. Set when
    // the flame fan spawns below, read by dragon-sprite.js. Nothing about damage,
    // reach or cadence depends on it.
    if (e.breathT > 0) e.breathT -= dt;
    e.shootTimer -= dt;
    if (e.shootTimer > 0) continue;
    e.shootTimer = 1800 + Math.random() * 1200;

    const dx = player.x - e.x, dy = player.y - e.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Dragon fire breath — a 5-shot fan of flame with longer reach than the
    // stock single ball, and `overWalls` so the airborne dragon can rake the
    // hall (and anything hiding behind a pillar) from anywhere.
    if (e.breath === 'fire') {
      e.shootTimer = 2400 + Math.random() * 900;
      if (dist >= 26 || dist === 0) continue;
      e.breathT = DRAGON_BREATH_ANIM_MS;      // cosmetic; see dragon-sprite.js
      const base = Math.atan2(dy, dx);
      for (let k = -2; k <= 2; k++) {
        const a = base + k * 0.18;
        projectiles.push({
          tx: e.x + 0.5, ty: e.y + 0.5,
          vx: Math.cos(a) * 0.30, vy: Math.sin(a) * 0.30,
          dmg: e.dmg, type: 'enemy', life: 110, color: '#ff6622',
          element: 'fire', overWalls: true
        });
      }
      continue;
    }

    if (dist >= 18) continue;  // out of range

    projectiles.push({
      tx: e.x + 0.5, ty: e.y + 0.5,
      vx: (dx / dist) * 0.25, vy: (dy / dist) * 0.25,
      dmg: e.dmg, type: 'enemy', life: 130, color: e.color,
      element: e.element || null
    });
  }
}

// ─── Projectile physics + collision ───────────────────────────────────────────
// Does terrain at (c, r) stop a projectile flying at height z?
//
// The height table's gameplay use: a shot is stopped only by terrain taller than
// it is flying, so something lobbed over a ROCK (0.40) clears it while a WALL
// (1.60) still eats it.
//
// Two guards make this provably identical to the flat solid test it replaces,
// which is what lets it land while every projectile in the game is still flat:
//
//  1. The solid test stays in FRONT of the height compare. Height alone would be
//     wrong in the other direction: the passable low props carry a real height
//     for the renderer and have never blocked a shot, and a pure height compare
//     would have a fern eat an arrow.
//  2. A shot at z = 0 is stopped by everything solid, without consulting the
//     table at all. That matters because solid does NOT imply tall: liquids are
//     solid and are listed at 0 on purpose (see TILE_HEIGHT_SPEC, config.js), so
//     a bare `TILE_HEIGHT[t] > z` compare would start letting arrows sail across
//     lava and deep water. Only a shot with real altitude can clear anything.
//
// The `!(z > 0)` form rather than `z <= 0` is deliberate: it also catches a NaN
// z, which fails every comparison, and treats it as blocking rather than as a
// projectile that passes through the world.
function projectileBlockedAt(map, c, r, z) {
  if (!isSolid(map, c, r) || isMediumWater(map, c, r)) return false;
  // Out of bounds reads as solid and has no tile to measure. Always blocking,
  // which is what keeps a shot from sailing off the edge of the map.
  if (r < 0 || c < 0 || r >= MROWS || c >= MCOLS) return true;
  if (!(z > 0)) return true;
  return TILE_HEIGHT[map[r][c]] >= z;
}

function stepProjectiles(dt, map) {
  // How many 60 FPS-equivalent frames elapsed this tick (dt is real ms, clamped
  // to 80 in the main loop). Scales both lifetime and travel so speed/range are
  // frame-rate independent.
  const step = (dt || FRAME_MS) / FRAME_MS;
  projectiles.forEach(p => {
    p.life -= step;

    if (p.type === 'bomb') {
      // In flight: carry it toward the landing tile on the arc. Same gravity
      // idiom as stepParticles, so the game has one model of a falling thing
      // rather than two that can drift apart.
      if (p.flight > 0) {
        p.flight -= step;
        if (p.flight <= 0) {
          // Landed. Snap to the aimed tile and kill the residual vertical
          // speed, so the detonation coordinate is exactly what it always was
          // no matter how the frames divided up.
          p.flight = 0;
          p.tx = p.destX; p.ty = p.destY;
          p.z = 0; p.vz = 0;
        } else {
          const prevX = p.tx, prevY = p.ty;
          p.tx += p.vx * step; p.ty += p.vy * step;
          p.z += p.vz * step;
          p.vz -= BOMB_GRAVITY * step;
          if (p.z < 0) p.z = 0;
          // Tall terrain stops the throw. Reuses the same gate arrows go
          // through, passing the bomb's clearance instead of its arc height, so
          // there is one answer to "does this terrain stop a projectile" rather
          // than a second rule that can drift from the first.
          //
          // On a block the bomb drops where it was the instant before, not on
          // the tile it failed to enter, so it never detonates inside a wall.
          // destX/destY move with it, so the landing snap above cannot pull it
          // forward through the thing that just stopped it.
          if (projectileBlockedAt(map, Math.floor(p.tx), Math.floor(p.ty),
                                  BOMB_THROW_CLEARANCE)) {
            p.tx = prevX; p.ty = prevY;
            p.destX = prevX; p.destY = prevY;
            p.flight = 0; p.z = 0; p.vz = 0;
          }
        }
      }
      if (p.life > 0) return;
      // Fuse expired — explode. Everything within 2 tiles (Chebyshev) takes
      // the full damage: enemies, the player (if not invincible), and any
      // ROCK tiles in range.
      const bsp = screenPX(p.tx, p.ty);
      spawnParticle(bsp.x, bsp.y, '#ff8800', 20, 6);
      const BLAST = 2;
      // Enemies (the dormant dragon is untargetable until it wakes)
      for (const e of enemies) {
        if (e.dead || e.dormant) continue;
        const dx = e.x - p.tx, dy = e.y - p.ty;
        if (Math.abs(dx) <= BLAST && Math.abs(dy) <= BLAST) {
          e.hp -= p.dmg;
          damageNumbers.push({ entity: e, val: p.dmg, color: '#ff4444', life: 1000, rise: 0 });
          if (e.hp <= 0) killEnemy(e);
        }
      }
      // The player — bombs are risky! Same radius, respects i-frames.
      const pdx = player.x - p.tx, pdy = player.y - p.ty;
      if (Math.abs(pdx) <= BLAST && Math.abs(pdy) <= BLAST && player.invincible <= 0) {
        // Bombs are mundane explosions — no element tag, no armor reduction.
        damagePlayer(p.dmg, null);
        player.invincible = 900;
        if (player.hp <= 0) respawn();
      }
      // Destroy rocks and snow drifts in blast radius. Each broken rock has a
      // 40% chance to drop 1–20 rubies on its tile; each flattened drift has a
      // 50% chance to leave a sellable snowball. Use floor (not round) so the
      // tile-centered bomb position (bx + 0.5) maps to its actual tile bx.
      const btc = Math.floor(p.tx), btr = Math.floor(p.ty);
      for (let dr = -BLAST; dr <= BLAST; dr++) for (let dc = -BLAST; dc <= BLAST; dc++) {
        const tr = btr + dr, tc = btc + dc;
        if (tr <= 0 || tr >= MROWS - 1 || tc <= 0 || tc >= MCOLS - 1) continue;
        if (map[tr][tc] === T.ROCK) {
          // 5% chance the rock concealed a cave tunnel — wins over ruby roll
          if (Math.random() < 0.05) {
            map[tr][tc] = T.CAVE_ENTRANCE;
            showMapMsg('🕳️ The blast reveals a hidden tunnel!');
          } else {
            map[tr][tc] = mapGroundTile();
            if (Math.random() < 0.40) {
              drops.push({
                type: 'ruby', val: 1 + Math.floor(Math.random() * 20),  // 1..20
                x: tc, y: tr,
                life: 10000, bob: 0, collected: false
              });
            }
          }
        } else if (map[tr][tc] === T.SNOW_DRIFT) {
          // The blast flattens the drift to open snow; half the time the
          // packed powder survives as a snowball.
          map[tr][tc] = T.SNOW;
          if (Math.random() < 0.50) {
            drops.push({
              type: 'snowball', val: 1,
              x: tc, y: tr,
              life: 10000, bob: 0, collected: false
            });
          }
        }
      }
      // The blast rewrote tiles, so the renderer's memoized per-map tile scans
      // are stale. Nothing it can break today is IN those lists (it only takes
      // ROCK and SNOW_DRIFT), but the depth layer reads a cached list of tall
      // tiles and a stale one fails silently, by drawing a wall that is gone.
      if (typeof invalidateTallTiles === 'function') invalidateTallTiles(currentMap());
      p.life = -999;
      return;
    }

    p.tx += p.vx * step; p.ty += p.vy * step;
    const pc = Math.floor(p.tx), pr = Math.floor(p.ty);
    if (p.type === 'arrow' && typeof tryShrineStrike === 'function' &&
        tryShrineStrike(pc, pr, p.element || null)) { p.life = -999; return; }
    // Arrows and spells fly over the medium-water shelf even though it's
    // solid to walkers; everything else solid (incl. deep water) stops them.
    // Dragon breath (`overWalls`) crosses every solid tile, so it needs its
    // own off-map kill (isSolid no longer stops it at the border).
    if (p.overWalls) {
      if (pc < 0 || pr < 0 || pc >= MCOLS || pr >= MROWS) { p.life = -999; return; }
    } else if (projectileBlockedAt(map, pc, pr, p.z || 0)) { p.life = -999; return; }

    if (p.type === 'arrow') {
      // An arrow passing over a sealed shrine strikes it — try to break the seal
      // with the arrow's element (see tryUnsealShrine in world.js).
      if (map[pr] && map[pr][pc] === T.SEALED_SHRINE && typeof tryUnsealShrine === 'function') {
        tryUnsealShrine(pc, pr, p.element || null);
        p.life = -999;
        return;
      }
      for (const e of enemies) {
        if (e.dead || e.dormant) continue;   // arrows pass over the sleeping dragon
        const dx = e.x - p.tx, dy = e.y - p.ty;
        if (Math.abs(dx) < 0.9 && Math.abs(dy) < 0.9) {
          e.hp -= p.dmg;
          const esp = screenPX(e.x, e.y);
          damageNumbers.push({ entity: e, val: p.dmg, color: '#ff4444', life: 1000, rise: 0 });
          spawnParticle(esp.x, esp.y, p.color || '#ddaa44', 4, 2);
          // Elemental enemies: 50% chance per arrow hit to take an extra 1d4
          // of their opposite element (always at least 1d4 from Lv1, plus
          // another die every 5 bow levels).
          rollOppositeVuln(e, player.bowLevel);
          // Elemental arrow: extra 1d4 of its element
          if (p.element) {
            const elem = SWORD_ELEMENTS[p.element];
            if (elem) {
              const elemDmg = 1 + Math.floor(Math.random() * 4);
              e.hp -= elemDmg;
              damageNumbers.push({
                entity: e,
                val: `${elem.icon}${elemDmg}`,
                color: elem.color,
                life: 1100, rise: -8
              });
              spawnParticle(esp.x, esp.y, elem.color, 6, 2);
            }
          }
          if (e.hp <= 0) killEnemy(e);
          p.life = -999;
          // One arrow, one target: stop scanning so a single shot can't damage
          // multiple enemies sharing (or crowded onto) the same tile.
          break;
        }
      }
    } else if (p.type === 'enemy') {
      const dx = player.x - p.tx, dy = player.y - p.ty;
      if (Math.abs(dx) < 0.8 && Math.abs(dy) < 0.8 && player.invincible <= 0) {
        damagePlayer(p.dmg, p.element);
        player.invincible = 800;
        p.life = -999;
        if (player.hp <= 0) respawn();
      }
    }
  });
  projectiles = projectiles.filter(p => p.life > 0);
}

// Drop physics: bob animation, lifespan, pickup detection.
function stepDrops(dt) {
  for (const d of drops) {
    d.life -= (dt || 16);
    d.bob = (d.bob || 0) + (dt || 16);
    // Pickup when player stands on the drop's tile
    if (!d.collected && d.life > 0 && d.x === player.x && d.y === player.y) {
      if (d.type === 'hp') {
        const before = player.hp;
        player.hp = Math.min(player.maxHp, player.hp + d.val);
        const gained = player.hp - before;
        const sp = screenPX(d.x, d.y);
        spawnParticle(sp.x, sp.y, '#ff4488', 10, 3);
        spawnParticle(sp.x, sp.y, '#ffaacc', 6, 2);
        if (gained > 0) showMsg(`❤️ +${gained} HP`, 1500);
      } else if (d.type === 'ruby') {
        addItem('rubies', d.val);
        const sp = screenPX(d.x, d.y);
        spawnParticle(sp.x, sp.y, '#22cc44', 10, 3);
        spawnParticle(sp.x, sp.y, '#aaffcc', 6, 2);
        showMsg(`💎 +${d.val} Ruby`, 1500);
      } else if (d.type === 'herbal') {
        addItem('herbals', d.val);
        const sp = screenPX(d.x, d.y);
        spawnParticle(sp.x, sp.y, '#5fbf3a', 10, 3);
        spawnParticle(sp.x, sp.y, '#aaff88', 6, 2);
        showMsg(`🌿 +${d.val} Herbal (now ${player.herbals})`, 1500);
      } else if (d.type === 'mushroom') {
        addItem('mushrooms', d.val);
        const sp = screenPX(d.x, d.y);
        spawnParticle(sp.x, sp.y, '#c8704a', 10, 3);
        spawnParticle(sp.x, sp.y, '#f0dac0', 6, 2);
        showMsg(`🍄 +${d.val} Mushroom (now ${player.mushrooms})`, 1500);
      } else if (d.type === 'bonemeal') {
        addItem('bonemeal', d.val);
        const sp = screenPX(d.x, d.y);
        spawnParticle(sp.x, sp.y, '#e8e0c8', 10, 3);
        spawnParticle(sp.x, sp.y, '#fffaf0', 6, 2);
        showMsg(`🦴 +${d.val} Bone Meal (now ${player.bonemeal})`, 1500);
      } else if (d.type === 'witherwood') {
        addItem('witherwood', d.val);
        const sp = screenPX(d.x, d.y);
        spawnParticle(sp.x, sp.y, '#6a5a52', 10, 3);
        spawnParticle(sp.x, sp.y, '#a08c80', 6, 2);
        showMsg(`🪵 +${d.val} Witherwood (now ${player.witherwood})`, 1500);
      } else if (d.type === 'gravebloom') {
        addItem('graveblooms', d.val);
        const sp = screenPX(d.x, d.y);
        spawnParticle(sp.x, sp.y, '#9aa86a', 10, 3);
        spawnParticle(sp.x, sp.y, '#c4d09a', 6, 2);
        showMsg(`🥀 +${d.val} Grave Bloom (now ${player.graveblooms})`, 1500);
      } else if (d.type === 'winterberry') {
        addItem('winterberries', d.val);
        const sp = screenPX(d.x, d.y);
        spawnParticle(sp.x, sp.y, '#6a4aa8', 10, 3);
        spawnParticle(sp.x, sp.y, '#b89ae0', 6, 2);
        showMsg(`🫐 +${d.val} Winter Berry (now ${player.winterberries})`, 1500);
      } else if (d.type === 'frostpetal') {
        addItem('frostpetals', d.val);
        const sp = screenPX(d.x, d.y);
        spawnParticle(sp.x, sp.y, '#bfe2f5', 10, 3);
        spawnParticle(sp.x, sp.y, '#eaf6fd', 6, 2);
        showMsg(`💮 +${d.val} Frost Petal (now ${player.frostpetals})`, 1500);
      } else if (d.type === 'seashell') {
        addItem('seashells', d.val);
        const sp = screenPX(d.x, d.y);
        spawnParticle(sp.x, sp.y, '#e8b8a0', 10, 3);
        spawnParticle(sp.x, sp.y, '#f6e6d6', 6, 2);
        showMsg(`🐚 +${d.val} Seashell (now ${player.seashells})`, 1500);
      } else if (d.type === 'coral') {
        addItem('corals', d.val);
        const sp = screenPX(d.x, d.y);
        spawnParticle(sp.x, sp.y, '#e8765a', 10, 3);
        spawnParticle(sp.x, sp.y, '#ffa98e', 6, 2);
        showMsg(`🪸 +${d.val} Coral (now ${player.corals})`, 1500);
      } else if (d.type === 'sage') {
        addItem('sage', d.val);
        const sp = screenPX(d.x, d.y);
        spawnParticle(sp.x, sp.y, '#7c9a6a', 10, 3);
        spawnParticle(sp.x, sp.y, '#b8cfa2', 6, 2);
        showMsg(`🌿 +${d.val} Sage (now ${player.sage})`, 1500);
      } else if (d.type === 'moss') {
        addItem('moss', d.val);
        const sp = screenPX(d.x, d.y);
        spawnParticle(sp.x, sp.y, '#5a7a3a', 10, 3);
        spawnParticle(sp.x, sp.y, '#8fb060', 6, 2);
        showMsg(`🌱 +${d.val} Moss (now ${player.moss})`, 1500);
      } else if (d.type === 'crystal') {
        addItem('crystals', d.val);
        const sp = screenPX(d.x, d.y);
        spawnParticle(sp.x, sp.y, '#a87fd0', 10, 3);
        spawnParticle(sp.x, sp.y, '#d8c0f0', 6, 2);
        showMsg(`🔮 +${d.val} Crystal (now ${player.crystals})`, 1500);
      } else if (d.type === 'skypetal') {
        addItem('skypetals', d.val);
        const sp = screenPX(d.x, d.y);
        spawnParticle(sp.x, sp.y, '#f2a8d0', 10, 3);
        spawnParticle(sp.x, sp.y, '#ffd6ec', 6, 2);
        showMsg(`🌸 +${d.val} Sky Petal (now ${player.skypetals})`, 1500);
      } else if (d.type === 'windseed') {
        addItem('windseeds', d.val);
        const sp = screenPX(d.x, d.y);
        spawnParticle(sp.x, sp.y, '#d8c47a', 10, 3);
        spawnParticle(sp.x, sp.y, '#f0e2a6', 6, 2);
        showMsg(`🌾 +${d.val} Wind Seed (now ${player.windseeds})`, 1500);
      } else if (d.type === 'thistledown') {
        addItem('thistledown', d.val);
        const sp = screenPX(d.x, d.y);
        spawnParticle(sp.x, sp.y, '#a8d0f0', 10, 3);
        spawnParticle(sp.x, sp.y, '#dcefff', 6, 2);
        showMsg(`💨 +${d.val} Thistle Down (now ${player.thistledown})`, 1500);
      } else if (d.type === 'voltpetal') {
        addItem('voltpetals', d.val);
        const sp = screenPX(d.x, d.y);
        spawnParticle(sp.x, sp.y, '#7ec8ff', 10, 3);
        spawnParticle(sp.x, sp.y, '#d6f0ff', 6, 2);
        showMsg(`🌼 +${d.val} Volt Petal (now ${player.voltpetals})`, 1500);
      } else if (d.type === 'sparkseed') {
        addItem('sparkseeds', d.val);
        const sp = screenPX(d.x, d.y);
        spawnParticle(sp.x, sp.y, '#ffe27a', 10, 3);
        spawnParticle(sp.x, sp.y, '#fff6c8', 6, 2);
        showMsg(`🌾 +${d.val} Spark Seed (now ${player.sparkseeds})`, 1500);
      } else if (d.type === 'fulgurite') {
        addItem('fulgurites', d.val);
        const sp = screenPX(d.x, d.y);
        spawnParticle(sp.x, sp.y, '#b3a6ff', 10, 3);
        spawnParticle(sp.x, sp.y, '#e8e0ff', 6, 2);
        showMsg(`🔷 +${d.val} Fulgurite (now ${player.fulgurites})`, 1500);
      } else if (d.type === 'mote') {
        addItem('motes', d.val);
        const sp = screenPX(d.x, d.y);
        spawnParticle(sp.x, sp.y, '#ffe8a0', 10, 3);
        spawnParticle(sp.x, sp.y, '#fffbe8', 6, 2);
        showMsg(`✨ +${d.val} Light Mote (now ${player.motes})`, 1500);
      } else if (d.type === 'manapetal') {
        addItem('manapetals', d.val);
        const sp = screenPX(d.x, d.y);
        spawnParticle(sp.x, sp.y, '#b46ce0', 10, 3);
        spawnParticle(sp.x, sp.y, '#e8d2f6', 6, 2);
        showMsg(`🪻 +${d.val} Mana Petal (now ${player.manapetals})`, 1500);
      } else if (d.type === 'heartfrond') {
        addItem('heartfronds', d.val);
        const sp = screenPX(d.x, d.y);
        spawnParticle(sp.x, sp.y, '#63c874', 10, 3);
        spawnParticle(sp.x, sp.y, '#bfeec8', 6, 2);
        showMsg(`🍃 +${d.val} Heart Frond (now ${player.heartfronds})`, 1500);
      } else if (d.type === 'glowcap') {
        addItem('glowcaps', d.val);
        const sp = screenPX(d.x, d.y);
        spawnParticle(sp.x, sp.y, '#a070d8', 10, 3);
        spawnParticle(sp.x, sp.y, '#ddc8f2', 6, 2);
        showMsg(`🍄 +${d.val} Glow Cap (now ${player.glowcaps})`, 1500);
      } else if (d.type === 'fiddlehead') {
        addItem('fiddleheads', d.val);
        const sp = screenPX(d.x, d.y);
        spawnParticle(sp.x, sp.y, '#3f9a3a', 10, 3);
        spawnParticle(sp.x, sp.y, '#9ad08a', 6, 2);
        showMsg(`🌿 +${d.val} Fiddlehead (now ${player.fiddleheads})`, 1500);
      } else if (d.type === 'aloe') {
        addItem('aloe', d.val);
        const sp = screenPX(d.x, d.y);
        spawnParticle(sp.x, sp.y, '#5aa86a', 10, 3);
        spawnParticle(sp.x, sp.y, '#a8d8b0', 6, 2);
        showMsg(`🪴 +${d.val} Aloe (now ${player.aloe})`, 1500);
      } else if (d.type === 'frostfern') {
        addItem('frostferns', d.val);
        const sp = screenPX(d.x, d.y);
        spawnParticle(sp.x, sp.y, '#a8d8c0', 10, 3);
        spawnParticle(sp.x, sp.y, '#e0f2ea', 6, 2);
        showMsg(`❄️ +${d.val} Frost Fern (now ${player.frostferns})`, 1500);
      } else if (d.type === 'sunseed') {
        addItem('sunseeds', d.val);
        const sp = screenPX(d.x, d.y);
        spawnParticle(sp.x, sp.y, '#f4e6b0', 10, 3);
        spawnParticle(sp.x, sp.y, '#fff6d6', 6, 2);
        showMsg(`🌟 +${d.val} Sun Seed (now ${player.sunseeds})`, 1500);
      } else if (d.type === 'prism') {
        addItem('prisms', d.val);
        const sp = screenPX(d.x, d.y);
        spawnParticle(sp.x, sp.y, '#fdf0c8', 10, 3);
        spawnParticle(sp.x, sp.y, '#ffffff', 6, 2);
        showMsg(`🔆 +${d.val} Prism Shard (now ${player.prisms})`, 1500);
      } else if (d.type === 'reedpith') {
        addItem('reedpith', d.val);
        const sp = screenPX(d.x, d.y);
        spawnParticle(sp.x, sp.y, '#c8b86a', 10, 3);
        spawnParticle(sp.x, sp.y, '#e8dca6', 6, 2);
        showMsg(`🌾 +${d.val} Reed Pith (now ${player.reedpith})`, 1500);
      } else if (d.type === 'emberbloom') {
        addItem('emberblooms', d.val);
        const sp = screenPX(d.x, d.y);
        spawnParticle(sp.x, sp.y, '#ff9944', 10, 3);
        spawnParticle(sp.x, sp.y, '#ffc890', 6, 2);
        showMsg(`🏵️ +${d.val} Emberbloom (now ${player.emberblooms})`, 1500);
      } else if (d.type === 'sulfurmoss') {
        addItem('sulfurmoss', d.val);
        const sp = screenPX(d.x, d.y);
        spawnParticle(sp.x, sp.y, '#c9b23a', 10, 3);
        spawnParticle(sp.x, sp.y, '#e8dc7a', 6, 2);
        showMsg(`🍂 +${d.val} Sulfur Moss (now ${player.sulfurmoss})`, 1500);
      } else if (d.type === 'duskcap') {
        addItem('duskcaps', d.val);
        const sp = screenPX(d.x, d.y);
        spawnParticle(sp.x, sp.y, '#9a86c4', 10, 3);
        spawnParticle(sp.x, sp.y, '#c4b8e0', 6, 2);
        showMsg(`🍄 +${d.val} Duskcap (now ${player.duskcaps})`, 1500);
      } else if (d.type === 'voidpetal') {
        addItem('voidpetals', d.val);
        const sp = screenPX(d.x, d.y);
        spawnParticle(sp.x, sp.y, '#6f4fb0', 10, 3);
        spawnParticle(sp.x, sp.y, '#a488e0', 6, 2);
        showMsg(`🌌 +${d.val} Void Petal (now ${player.voidpetals})`, 1500);
      } else if (d.type === 'ore') {
        // Raw region ore dropped by a slain enemy. The specific ore id is on
        // d.ore; its inventory key is the id itself (see ORE_TYPES / chest ore).
        addItem(d.ore, d.val);
        const ore = (typeof ORE_TYPES !== 'undefined')
          ? ORE_TYPES.find(o => o.id === d.ore) : null;
        const sp = screenPX(d.x, d.y);
        spawnParticle(sp.x, sp.y, ore ? ore.color : '#b9bcc6', 10, 3);
        spawnParticle(sp.x, sp.y, '#ffffff', 6, 2);
        const icon = ore ? ore.icon : '⛏️';
        const label = ore ? ore.label : 'Ore';
        showMsg(`${icon} +${d.val} ${label} ore (now ${player[d.ore] || 0})`, 1500);
      } else if (TROPHY_META[d.type]) {
        // Enemy trophy collectibles. Inventory key is the plural of the drop
        // type (fangs, fingers, bones, wings, organs, feathers, scales, …).
        const key = d.type + 's';
        addItem(key, d.val);
        const meta = TROPHY_META[d.type];
        const sp = screenPX(d.x, d.y);
        spawnParticle(sp.x, sp.y, meta.color, 10, 3);
        showMsg(`${meta.icon} +${d.val} ${meta.label} (now ${player[key]})`, 1500);
      } else if (d.type === 'potion') {
        addItem('potions', d.val);
        const sp = screenPX(d.x, d.y);
        spawnParticle(sp.x, sp.y, '#ff66aa', 10, 3);
        spawnParticle(sp.x, sp.y, '#ffccdd', 6, 2);
        showMsg(`🧪 +${d.val} ${regionPotionName('forest')} (now ${player.potions})`, 1500);
      } else if (d.type === 'arrows') {
        // Plain arrows: d.element is null/'plain' → stocks player.arrows.plain.
        // Elemental arrows: d.element is the SWORD_ELEMENTS id.
        const el = d.element || 'plain';
        addArrow(el, d.val);
        const elem = (el !== 'plain' && SWORD_ELEMENTS[el])
          || { label: '', icon: '🏹', color: '#ddaa44' };
        const sp = screenPX(d.x, d.y);
        spawnParticle(sp.x, sp.y, elem.color, 10, 3);
        const label = el === 'plain' ? 'Arrow' : (elem.label + ' Arrow');
        showMsg(`${elem.icon} +${d.val} ${label}${d.val > 1 ? 's' : ''} (x${player.arrows[el]})`, 1800);
      } else if (d.type === 'guildhead') {
        // The Guild Quarry's severed head — the token to return to the recruiter.
        // The quest already advanced on the kill; picking up the drop just confirms
        // it (idempotent) with a flourish.
        player.guildQuests = player.guildQuests || {};
        const gq = player.guildQuests[d.region];
        if (gq && gq.status === 'active') gq.status = 'head';
        const nm = (gq && DND_ENEMIES[gq.creature]) ? DND_ENEMIES[gq.creature].name : 'the beast';
        const sp = screenPX(d.x, d.y);
        spawnParticle(sp.x, sp.y, '#cc3344', 12, 4);
        spawnParticle(sp.x, sp.y, '#ffccaa', 8, 2);
        showMsg(`🗡️ Claimed the ${nm}'s Head — bring it to the Guild recruiter.`, 3000);
      }
      d.collected = true;
    }
  }
  drops = drops.filter(d => !d.collected && d.life > 0);
}

function stepParticles(dt) {
  // Same 60 FPS-referenced scaling as projectiles so particle motion and
  // lifetime are frame-rate independent.
  const step = (dt || FRAME_MS) / FRAME_MS;
  particles.forEach(p => {
    p.x += p.vx * step;
    p.y += p.vy * step;
    // Mild gravity by default; embers pass a negative value so they rise.
    p.vy += (p.gravity === undefined ? 0.06 : p.gravity) * step;
    p.life -= step;
  });
  particles = particles.filter(p => p.life > 0);
  // Damage numbers float upward above their entity and fade over 1000ms.
  damageNumbers.forEach(d => {
    d.rise += (dt || 16) * 0.05;   // ~50px of float over 1000ms
    d.life -= (dt || 16);
  });
  damageNumbers = damageNumbers.filter(d => d.life > 0);
}
