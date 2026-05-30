// ─── Projectiles, particles, damage numbers ───────────────────────────────────
// Projectiles use tile-float coordinates (tx, ty). Arrows and enemy spells
// move at constant velocity; bombs are stationary and explode on fuse timeout.

let projectiles = [];
let particles = [];
let damageNumbers = [];
// Pickup items dropped on the ground (e.g. HP hearts from killed enemies).
let drops = [];

// Visual metadata for enemy-trophy drops. Shared by stepDrops (pickup particles
// and message) and drawDrop (ground sprite glow / glyph).
const TROPHY_META = {
  fang:   { icon: '🦷', label: 'Fang',   color: '#f0eedd' },
  finger: { icon: '🫳', label: 'Finger', color: '#d8a070' },
  bone:   { icon: '🦴', label: 'Bone',   color: '#f4ead8' },
  wing:   { icon: '🪶', label: 'Wing',   color: '#aaccff' },
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

  // Cut down soft foliage in the swing. Flowers and mushrooms have 1 HP, so a
  // single swing clears them back to grass. Same 3x3 zone as the enemy hit.
  // Cut flowers have a 50% chance to leave behind a Herbal pickup.
  const map = mapData();
  const ctc = Math.round(tx), ctr = Math.round(ty);
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    const tr = ctr + dr, tc = ctc + dc;
    if (tr <= 0 || tr >= MROWS - 1 || tc <= 0 || tc >= MCOLS - 1) continue;
    const tile = map[tr][tc];
    if (tile !== T.FLOWER && tile !== T.MUSHROOM) continue;
    map[tr][tc] = T.GRASS;
    if (tile === T.FLOWER && Math.random() < 0.50) {
      drops.push({
        type: 'herbal', val: 1,
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
    // Don't walk into other enemies, the player, or solid terrain
    const otherEnemy = enemies.some(o => !o.dead && o !== e && o.x === nx && o.y === ny);
    const onPlayer = (nx === player.x && ny === player.y);
    if (!isSolid(map, nx, ny) && !otherEnemy && !onPlayer) {
      e.x = nx; e.y = ny;
    }

    // Melee contact damage (re-check distance after move)
    const mdx = player.x - e.x, mdy = player.y - e.y;
    if (Math.abs(mdx) <= 1 && Math.abs(mdy) <= 1 && player.invincible <= 0 && !e.ranged) {
      player.hp -= 1;
      player.invincible = 900;
      const psp = screenPX(player.x, player.y);
      spawnParticle(psp.x, psp.y, '#ff2222', 5, 3);
      damageNumbers.push({ entity: 'player', val: 1, color: '#ff4444', life: 1000, rise: 0 });
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
      dmg: e.dmg, type: 'enemy', life: 130, color: e.color
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
        const taken = p.dmg;
        player.hp -= taken;
        player.invincible = 900;
        const psp = screenPX(player.x, player.y);
        spawnParticle(psp.x, psp.y, '#ff2222', 8, 3);
        damageNumbers.push({ entity: 'player', val: taken, color: '#ff4444', life: 1000, rise: 0 });
        if (player.hp <= 0) respawn();
      }
      // Destroy rocks in blast radius. Each broken rock has a 40% chance to
      // drop a single rupee on its tile. Use floor (not round) so the
      // tile-centered bomb position (bx + 0.5) maps to its actual tile bx.
      const btc = Math.floor(p.tx), btr = Math.floor(p.ty);
      for (let dr = -BLAST; dr <= BLAST; dr++) for (let dc = -BLAST; dc <= BLAST; dc++) {
        const tr = btr + dr, tc = btc + dc;
        if (tr > 0 && tr < MROWS - 1 && tc > 0 && tc < MCOLS - 1 && map[tr][tc] === T.ROCK) {
          // 5% chance the rock concealed a cave tunnel — wins over rupee roll
          if (Math.random() < 0.05) {
            map[tr][tc] = T.CAVE_ENTRANCE;
            showMsg('🕳️ The blast reveals a hidden tunnel!', 5000);
          } else {
            map[tr][tc] = T.GRASS;
            if (Math.random() < 0.40) {
              drops.push({
                type: 'rupee', val: 1,
                x: tc, y: tr,
                life: 10000, bob: 0, collected: false
              });
            }
          }
        }
      }
      p.life = -999;
      return;
    }

    p.tx += p.vx; p.ty += p.vy;
    const pc = Math.floor(p.tx), pr = Math.floor(p.ty);
    if (isSolid(map, pc, pr)) { p.life = -999; return; }

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
        player.hp -= 1;
        player.invincible = 800;
        const psp = screenPX(player.x, player.y);
        spawnParticle(psp.x, psp.y, '#ff2222', 6, 3);
        damageNumbers.push({ entity: 'player', val: 1, color: '#ff4444', life: 1000, rise: 0 });
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
      } else if (d.type === 'fang' || d.type === 'finger' ||
                 d.type === 'bone' || d.type === 'wing') {
        // Enemy trophy collectibles. Inventory key is the plural of the drop
        // type (fangs, fingers, bones, wings).
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
