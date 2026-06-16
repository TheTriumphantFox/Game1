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
const TROPHY_META = {
  fang:      { icon: '🦷', label: 'Fang',           color: '#f0eedd' },
  finger:    { icon: '🫳', label: 'Finger',         color: '#d8a070' },
  bone:      { icon: '🦴', label: 'Bone',           color: '#f4ead8' },
  wing:      { icon: '🪶', label: 'Wing',           color: '#aaccff' },
  organ:     { icon: '🫀', label: 'Organ',          color: '#aa3344' },
  feather:   { icon: '🪶', label: 'Feather',        color: '#c8b890' },
  silk:      { icon: '🕸️', label: 'Silk',           color: '#ddddee' },
  talisman:  { icon: '📿', label: 'Talisman',       color: '#aa66cc' },
  ember:     { icon: '🔥', label: 'Ember',          color: '#ff7733' },
  venom:     { icon: '☠️', label: 'Venom Sac',      color: '#88cc44' },
  fin:       { icon: '🐟', label: 'Fin',            color: '#5599cc' },
  pearl:     { icon: '🦪', label: 'Pearl',          color: '#f0e8dd' },
  core:      { icon: '💠', label: 'Elemental Core', color: '#66ccff' },
  shard:     { icon: '🧊', label: 'Ice Shard',      color: '#aaddee' },
  pelt:      { icon: '🧥', label: 'Pelt',           color: '#aa8855' },
  tusk:      { icon: '🦣', label: 'Tusk',           color: '#e8dcc0' },
  scale:     { icon: '🐉', label: 'Dragon Scale',   color: '#44aa66' },
  stone:     { icon: '🪨', label: 'Stone Shard',    color: '#8a857a' },
  spark:     { icon: '⚡', label: 'Storm Spark',    color: '#ffee33' },
  horn:      { icon: '🦄', label: 'Horn',           color: '#ffeeff' },
  mote:      { icon: '✨', label: 'Light Mote',     color: '#ffee88' },
  ectoplasm: { icon: '👻', label: 'Ectoplasm',      color: '#ccddee' },
  eye:       { icon: '👁️', label: 'Eye',            color: '#cc88dd' },
  brain:     { icon: '🧠', label: 'Brain',          color: '#ffaabb' },
  // Not a monster trophy — packed powder blasted out of ice-region SNOW_DRIFTs
  // (50% per drift bombed). Sold at the General Store like bone meal.
  snowball:  { icon: '⚪', label: 'Snowball',       color: '#eef6ff' },
};

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

// Forest-enemy necrotic vulnerability: 50% chance per hit to take an extra
// floor(level/5) d4 of necrotic damage. `level` is swordLevel for sword
// swings and bowLevel for arrows. No-op when the enemy isn't flagged, when
// the level threshold isn't met, or the roll fails.
function rollNecroticVuln(e, level) {
  if (!e.necroticVuln || typeof SWORD_ELEMENTS === 'undefined') return;
  const dice = Math.floor((level || 0) / 5);
  if (dice <= 0 || Math.random() >= 0.5) return;
  let necDmg = 0;
  for (let d = 0; d < dice; d++) necDmg += 1 + Math.floor(Math.random() * 4);
  e.hp -= necDmg;
  const necElem = SWORD_ELEMENTS.necrotic;
  damageNumbers.push({
    entity: e,
    val: `${necElem.icon}${necDmg}`,
    color: necElem.color,
    life: 1100,
    rise: -16
  });
  const esp = screenPX(e.x, e.y);
  spawnParticle(esp.x, esp.y, necElem.color, 4, 2);
}

// Resolve an incoming hit against the player's defenses and apply the HP loss.
// Two layers, in order:
//   1. Elemental armor — halves matching-element damage (see applyElementalArmor).
//   2. Flat armor (player.armor) — at armor level N (≥2), each hit absorbs
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
  const { dmg: afterElem, resisted } = (typeof applyElementalArmor === 'function')
    ? applyElementalArmor(rawDmg, hitElement)
    : { dmg: rawDmg, resisted: null };

  // Flat armor roll. Only activates at +2 Armor and only when there's enough
  // damage left to actually shave — skipping the roll when afterElem === 1
  // keeps the min-1 floor from wasting a die.
  let armorBlock = 0;
  const armorLv = player.armor || 0;
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

      // Forest enemies are vulnerable to necrotic damage: 50% chance per hit
      // to take an extra 1d4 necrotic per 5 sword levels (none below Lv5).
      rollNecroticVuln(e, player.swordLevel);

      // Elemental damage — ONLY the currently equipped elemental sword adds
      // its 1d4 hit. (Elemental swords are specific weapons; switching swords
      // changes which element applies, instead of stacking all owned elements.)
      if (player.activeSwordElement && typeof SWORD_ELEMENTS !== 'undefined') {
        const elem = SWORD_ELEMENTS[player.activeSwordElement];
        if (elem) {
          const elemDmg = 1 + Math.floor(Math.random() * 4);
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
    else if (tile === T.FLOWERING_CACTUS) { dropType = 'herbal';   dropChance = 0.50; }
    else if (tile === T.BONES)            { dropType = 'bonemeal'; dropChance = 0.50; }
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
  enemies.filter(e => !e.dead).forEach(e => {
    e.timer -= dt;
    if (e.timer > 0) return;
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
      damagePlayer(1, e.element);
      player.invincible = 900;
      if (player.hp <= 0) respawn();
    }
  });
}

// ─── Enemy ranged fire ────────────────────────────────────────────────────────
function stepEnemyRanged(dt) {
  enemies.filter(e => !e.dead && e.ranged).forEach(e => {
    e.shootTimer -= dt;
    if (e.shootTimer > 0) return;
    e.shootTimer = 1800 + Math.random() * 1200;

    const dx = player.x - e.x, dy = player.y - e.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist >= 18) return;  // out of range

    projectiles.push({
      tx: e.x + 0.5, ty: e.y + 0.5,
      vx: (dx / dist) * 0.25, vy: (dy / dist) * 0.25,
      dmg: e.dmg, type: 'enemy', life: 130, color: e.color,
      element: e.element || null
    });
  });
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
      enemies.filter(e => !e.dead).forEach(e => {
        const dx = e.x - p.tx, dy = e.y - p.ty;
        if (Math.abs(dx) <= BLAST && Math.abs(dy) <= BLAST) {
          e.hp -= p.dmg;
          damageNumbers.push({ entity: e, val: p.dmg, color: '#ff4444', life: 1000, rise: 0 });
          if (e.hp <= 0) killEnemy(e);
        }
      });
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
      enemies.filter(e => !e.dead).forEach(e => {
        const dx = e.x - p.tx, dy = e.y - p.ty;
        if (Math.abs(dx) < 0.9 && Math.abs(dy) < 0.9) {
          e.hp -= p.dmg;
          const esp = screenPX(e.x, e.y);
          damageNumbers.push({ entity: e, val: p.dmg, color: '#ff4444', life: 1000, rise: 0 });
          spawnParticle(esp.x, esp.y, p.color || '#ddaa44', 4, 2);
          // Forest enemies: 50% chance per arrow hit to take an extra 1d4
          // necrotic per 5 bow levels (none below Lv5).
          rollNecroticVuln(e, player.bowLevel);
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
      });
    } else if (p.type === 'enemy') {
      const dx = player.x - p.tx, dy = player.y - p.ty;
      if (Math.abs(dx) < 0.8 && Math.abs(dy) < 0.8 && player.invincible <= 0) {
        damagePlayer(1, p.element);
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
