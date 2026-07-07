// ─── Projectiles, particles, damage numbers ───────────────────────────────────
// Projectiles use tile-float coordinates (tx, ty). Arrows and enemy spells
// move at constant velocity; bombs are stationary and explode on fuse timeout.

let projectiles = [];
let particles = [];
let damageNumbers = [];
// Pickup items dropped on the ground (e.g. HP hearts from killed enemies).
let drops = [];

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

function spawnParticle(wx, wy, color, n = 6, size = 3) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 1 + Math.random() * 3;
    particles.push({
      x: wx, y: wy,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 25 + Math.random() * 20,
      color,
      size: size * (0.5 + Math.random())
    });
  }
}

// Opposite-element vulnerability: any enemy that deals an element is weak to
// that element's opposite (see OPPOSITE in elements.js). 50% chance per hit to
// take an extra (floor(level/5) + 1) d4 of the opposite element's damage —
// always at least 1d4, so the vulnerability is in effect from level 1 and grows
// by another die every 5 levels. `level` is swordLevel for sword swings and
// bowLevel for arrows. No-op when the enemy has no element, has no defined
// opposite, or the 50% roll fails.
function rollOppositeVuln(e, level) {
  if (!e.element || typeof OPPOSITE === 'undefined') return;
  const oppId = OPPOSITE[e.element];
  if (!oppId) return;
  if (Math.random() >= 0.5) return;
  const dice = Math.floor((level || 0) / 5) + 1;
  let bonus = 0;
  for (let d = 0; d < dice; d++) bonus += 1 + Math.floor(Math.random() * 4);
  e.hp -= bonus;
  const oppElem = (typeof elementInfo === 'function') ? elementInfo(oppId) : null;
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
    const elem = (typeof SWORD_ELEMENTS !== 'undefined') ? SWORD_ELEMENTS[hitElement] : null;
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
  if (hitElement && typeof OPPOSITE !== 'undefined'
      && player.activeArmorElement === OPPOSITE[hitElement]
      && Math.random() < 0.5) {
    rawDmg *= 2;
    doubled = true;
  }

  const { dmg: afterElem, resisted } = (typeof applyElementalArmor === 'function')
    ? applyElementalArmor(rawDmg, hitElement)
    : { dmg: rawDmg, resisted: null };

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
  if (player.activeArmorElement && typeof elementalArmorPhys === 'function') {
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
  } else if (resisted && typeof SWORD_ELEMENTS !== 'undefined' && SWORD_ELEMENTS[resisted]) {
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
    const oppElem = (typeof elementInfo === 'function') ? elementInfo(hitElement) : null;
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
function screenPX(tx, ty) {
  return {
    x: (tx - camC + 0.5) * TILE_PX,
    y: (ty - camR + 0.5) * TILE_PX
  };
}

// ─── Spawn projectiles (player actions) ───────────────────────────────────────
function firePlayerArrow() {
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
  const elemColor = (element && typeof SWORD_ELEMENTS !== 'undefined') ? SWORD_ELEMENTS[element]?.color : null;
  projectiles.push({
    tx: player.x + 0.5, ty: player.y + 0.5,
    vx: player.swordDir.x * 0.35, vy: player.swordDir.y * 0.35,
    dmg: player.bowLevel * 2 + 1,
    type: 'arrow', life: 120,
    color: elemColor || '#ddaa44',
    element
  });
}

function placePlayerBomb() {
  const bx = player.x + player.swordDir.x * 3;
  const by = player.y + player.swordDir.y * 3;
  projectiles.push({
    tx: bx + 0.5, ty: by + 0.5,
    vx: 0, vy: 0,
    dmg: 7 + player.swordLevel,
    type: 'bomb', life: 50, color: '#333'
  });
}

// ─── Sword swing (instant, AoE in front of player) ────────────────────────────
function doSwordSwing() {
  player.swordTimer = 180;
  player.weapon = 'sword';
  const tx = player.x + player.swordDir.x;
  const ty = player.y + player.swordDir.y;
  const sp = screenPX(tx, ty);
  spawnParticle(sp.x, sp.y, '#ffee88', 4, 3);
  enemies.filter(e => !e.dead).forEach(e => {
    if (Math.abs(e.x - tx) <= 1 && Math.abs(e.y - ty) <= 1) {
      // Base physical damage
      const baseDmg = player.swordLevel + Math.floor(Math.random() * 3);
      e.hp -= baseDmg;
      damageNumbers.push({ entity: e, val: baseDmg, color: '#ff4444', life: 1000, rise: 0 });

      // Elemental enemies are vulnerable to their opposite element: 50% chance
      // per hit to take an extra 1d4 of it per 5 sword levels (none below Lv5).
      rollOppositeVuln(e, player.swordLevel);

      // Elemental damage — ONLY the currently equipped elemental sword adds
      // its 1d4 hit. (Elemental swords are specific weapons; switching swords
      // changes which element applies, instead of stacking all owned elements.)
      if (player.activeSwordElement && typeof SWORD_ELEMENTS !== 'undefined') {
        const elem = SWORD_ELEMENTS[player.activeSwordElement];
        if (elem) {
          // Base 1d4 + a flat +2 per upgrade level (0–10, see swordUpgradeLevel).
          const bonus = (typeof elementalSwordBonus === 'function')
            ? elementalSwordBonus(player.activeSwordElement) : 0;
          const elemDmg = 1 + Math.floor(Math.random() * 4) + bonus;
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
  const ctc = Math.round(tx), ctr = Math.round(ty);
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    const tr = ctr + dr, tc = ctc + dc;
    if (tr <= 0 || tr >= MROWS - 1 || tc <= 0 || tc >= MCOLS - 1) continue;
    const tile = map[tr][tc];
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
        type: dropType, val: 1,
        x: tc, y: tr,
        life: 10000, bob: 0, collected: false
      });
    }
  }
}

// ─── Enemy AI step ────────────────────────────────────────────────────────────
// Per-enemy movement timer; ranged enemies keep distance, melee enemies pursue.
function stepEnemies(dt, map) {
  for (const e of enemies) {
    if (e.dead) continue;
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
    const otherEnemy = enemies.some(o => !o.dead && o !== e && o.x === nx && o.y === ny);
    const onPlayer = (nx === player.x && ny === player.y);
    const blocked = isSolid(map, nx, ny) && !(e.swims && isMediumWater(map, nx, ny));
    if (!blocked && !otherEnemy && !onPlayer) {
      e.x = nx; e.y = ny;
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
    if (e.dead || !e.ranged) continue;
    e.shootTimer -= dt;
    if (e.shootTimer > 0) continue;
    e.shootTimer = 1800 + Math.random() * 1200;

    const dx = player.x - e.x, dy = player.y - e.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
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
function stepProjectiles(dt, map) {
  projectiles.forEach(p => {
    p.life--;

    if (p.type === 'bomb') {
      if (p.life > 0) return;
      // Fuse expired — explode. Everything within 2 tiles (Chebyshev) takes
      // the full damage: enemies, the player (if not invincible), and any
      // ROCK tiles in range.
      const bsp = screenPX(p.tx, p.ty);
      spawnParticle(bsp.x, bsp.y, '#ff8800', 20, 6);
      const BLAST = 2;
      // Enemies
      for (const e of enemies) {
        if (e.dead) continue;
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
      // 40% chance to drop 1–20 rupees on its tile; each flattened drift has a
      // 50% chance to leave a sellable snowball. Use floor (not round) so the
      // tile-centered bomb position (bx + 0.5) maps to its actual tile bx.
      const btc = Math.floor(p.tx), btr = Math.floor(p.ty);
      for (let dr = -BLAST; dr <= BLAST; dr++) for (let dc = -BLAST; dc <= BLAST; dc++) {
        const tr = btr + dr, tc = btc + dc;
        if (tr <= 0 || tr >= MROWS - 1 || tc <= 0 || tc >= MCOLS - 1) continue;
        if (map[tr][tc] === T.ROCK) {
          // 5% chance the rock concealed a cave tunnel — wins over rupee roll
          if (Math.random() < 0.05) {
            map[tr][tc] = T.CAVE_ENTRANCE;
            showMapMsg('🕳️ The blast reveals a hidden tunnel!');
          } else {
            map[tr][tc] = mapGroundTile();
            if (Math.random() < 0.40) {
              drops.push({
                type: 'rupee', val: 1 + Math.floor(Math.random() * 20),  // 1..20
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
      p.life = -999;
      return;
    }

    p.tx += p.vx; p.ty += p.vy;
    const pc = Math.floor(p.tx), pr = Math.floor(p.ty);
    // Arrows and spells fly over the medium-water shelf even though it's
    // solid to walkers; everything else solid (incl. deep water) stops them.
    if (isSolid(map, pc, pr) && !isMediumWater(map, pc, pr)) { p.life = -999; return; }

    if (p.type === 'arrow') {
      for (const e of enemies) {
        if (e.dead) continue;
        const dx = e.x - p.tx, dy = e.y - p.ty;
        if (Math.abs(dx) < 0.9 && Math.abs(dy) < 0.9) {
          e.hp -= p.dmg;
          const esp = screenPX(e.x, e.y);
          damageNumbers.push({ entity: e, val: p.dmg, color: '#ff4444', life: 1000, rise: 0 });
          spawnParticle(esp.x, esp.y, p.color || '#ddaa44', 4, 2);
          // Elemental enemies: 50% chance per arrow hit to take an extra 1d4
          // of their opposite element per 5 bow levels (none below Lv5).
          rollOppositeVuln(e, player.bowLevel);
          // Elemental arrow: extra 1d4 of its element
          if (p.element && typeof SWORD_ELEMENTS !== 'undefined') {
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
      } else if (d.type === 'rupee') {
        addItem('rupees', d.val);
        const sp = screenPX(d.x, d.y);
        spawnParticle(sp.x, sp.y, '#22cc44', 10, 3);
        spawnParticle(sp.x, sp.y, '#aaffcc', 6, 2);
        showMsg(`💎 +${d.val} Rupee`, 1500);
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
        showMsg(`🧪 +${d.val} Health Potion (now ${player.potions})`, 1500);
      } else if (d.type === 'arrows') {
        // Plain arrows: d.element is null/'plain' → stocks player.arrows.plain.
        // Elemental arrows: d.element is the SWORD_ELEMENTS id.
        const el = d.element || 'plain';
        addArrow(el, d.val);
        const elem = (el !== 'plain' && typeof SWORD_ELEMENTS !== 'undefined' && SWORD_ELEMENTS[el])
          || { label: '', icon: '🏹', color: '#ddaa44' };
        const sp = screenPX(d.x, d.y);
        spawnParticle(sp.x, sp.y, elem.color, 10, 3);
        const label = el === 'plain' ? 'Arrow' : (elem.label + ' Arrow');
        showMsg(`${elem.icon} +${d.val} ${label}${d.val > 1 ? 's' : ''} (x${player.arrows[el]})`, 1800);
      }
      d.collected = true;
    }
  }
  drops = drops.filter(d => !d.collected && d.life > 0);
}

function stepParticles(dt) {
  particles.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.06;  // mild gravity
    p.life--;
  });
  particles = particles.filter(p => p.life > 0);
  // Damage numbers float upward above their entity and fade over 1000ms.
  damageNumbers.forEach(d => {
    d.rise += (dt || 16) * 0.05;   // ~50px of float over 1000ms
    d.life -= (dt || 16);
  });
  damageNumbers = damageNumbers.filter(d => d.life > 0);
}
