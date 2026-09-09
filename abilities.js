// ─── Shrine and elemental-armor abilities, in the world ───────────────────────
// Stage 9's other half. shrines.js builds the puzzles and hands out the rewards;
// this file is what owning one actually does once the hero walks back out of the
// shrine. Kept apart from shrines.js because the two have different lifetimes: a
// shrine matters for the twenty minutes you are inside it, and an ability matters
// for the rest of the game, in ice fields and the tower, neither of which
// shrines.js should have to know about.
//
// The reward set was five abilities and is now ONE. Twelve of the thirteen
// regional shrines give a Heart Container instead, because four of the five
// abilities had stopped earning their slot:
//
//   Frost Grip    RETIRED — Ice armor supplies the grip (frostGripHolds below).
//   Ember Lantern RETIRED — inert since fog of war was removed; its only effect
//                 was restoring the necrotic region's shortened sight.
//   Updraft Glide RETIRED as a shrine reward — Air armor supplies it, and now
//                 supplies a range that scales with the armor's level, which a
//                 fixed shrine grant could never do.
//   Shadow Step   RETIRED outright, from the armor and the shrine both. Shadow
//                 armor's power is the Umbral Veil now (shadowDetectionScale,
//                 elements.js), so nothing in the game steps through walls.
//   Arcane Sight  KEPT, from the Mana region's shrine. Passive — reads what was
//                 written and hidden. Rune marks (T.RUNE_MARK) are invisible
//                 ground without it, and nothing else in the game grants it, so
//                 converting this one to a heart would strand its caches.
//
// That leaves exactly one ACTIVE ability, Updraft Glide, and it arrives only by
// wearing Air armor. It keeps the equipped slot and the [F] key it always had —
// the slot is generic and costs nothing to keep, and it is what the touch
// ability button reads.

// ─── The equipped slot ────────────────────────────────────────────────────────
// `player.equippedAbility` holds an id from ACTIVE_ABILITIES, or null. Declared
// in all three of the places this codebase requires a save field to exist (the
// player literal in player.js, DEFAULT_PLAYER in save.js, and the resetGame
// assignment in save.js) so an older save defaults it rather than inheriting it.
// One entry, and it is armor-supplied rather than shrine-granted (see the header).
// Kept as a list rather than collapsed to a constant because every consumer —
// the radial ring, the touch button, the save field's validation — is written
// against the set, and a second active is a plausible thing to add later.
const ACTIVE_ABILITIES = ['updraftGlide'];

function abilityIsActive(id) { return ACTIVE_ABILITIES.includes(id); }

// Air armor supplies its traversal action while worn, and is now the only source
// of one. It fills the [F] slot without rewriting player.equippedAbility, which
// is what makes taking the armor off leave the button empty rather than stuck.
function armorActiveAbility() {
  if (typeof wearingElementalArmor !== 'function') return null;
  if (wearingElementalArmor('air')) return 'updraftGlide';
  return null;
}

// The equipped active, validated on read: an ability the hero doesn't own (or a
// stale id from an older save) reads as nothing equipped rather than as a button
// that silently fails. An active armor traversal takes temporary priority.
function equippedAbility() {
  const armorAbility = armorActiveAbility();
  if (armorAbility) return armorAbility;
  const id = player.equippedAbility;
  if (!id || !abilityIsActive(id)) return null;
  return hasAbility(id) ? id : null;
}

// Equip, idempotently. Deliberately NOT a toggle: radialAutoPick (radial.js)
// fires the highlighted item's action as you navigate onto it, so a toggle would
// unequip the ability simply by opening the ring on it. There is no reason to
// want an empty slot anyway — the passives don't use it.
function setEquippedAbility(id) {
  if (!abilityIsActive(id) || !hasAbility(id)) return false;
  player.equippedAbility = id;
  if (typeof updateHUD === 'function') updateHUD();
  return true;
}

// Auto-equip the first active ability the hero earns, so the shrine that grants
// Updraft Glide doesn't also require a trip through the menu before the button
// does anything. Called from claimShrineReward.
function autoEquipAbility(id) {
  if (!abilityIsActive(id)) return;
  if (!player.equippedAbility) player.equippedAbility = id;
}

const ABILITY_LABELS = {
  updraftGlide: 'Updraft Glide', arcaneSight: 'Arcane Sight',
};
const ABILITY_ICONS = {
  updraftGlide: '🜁', arcaneSight: '✦',
};

// ─── [F] / the touch ability button ───────────────────────────────────────────
let abilityCooldown = 0;
const ABILITY_COOLDOWN_MS = 700;

function stepAbilityCooldown(dt) {
  if (abilityCooldown > 0) abilityCooldown -= dt;
}

function useEquippedAbility() {
  if (abilityCooldown > 0) return false;
  const id = equippedAbility();
  if (!id) {
    // Owning one and having none equipped is a different problem from owning
    // none at all, and the hero should be told which.
    const owned = ACTIVE_ABILITIES.filter(a => hasAbility(a));
    if (owned.length) showMsg('No ability equipped. Open the menu ring and choose one.', 2000);
    return false;
  }
  const ok = tryUpdraftGlide();
  abilityCooldown = ok ? ABILITY_COOLDOWN_MS : 250;
  return ok;
}

// Which way the hero is pointing. swordDir is the facing this game keeps for
// everything else (sword swings, chest prompts), so the abilities use it too
// rather than inventing a second notion of "forward".
function abilityFacing() {
  const d = player.swordDir || { x: 0, y: 1 };
  if (!d.x && !d.y) return { x: 0, y: 1 };
  return d;
}

// ─── Updraft Glide ────────────────────────────────────────────────────────────
// Crosses a GAP, not a wall. That distinction is the whole design: letting the
// hero fly over trees and mountains would delete the shape of every map in the
// game, while crossing water, lava and chasms opens shortcuts the terrain was
// already inviting you to want.
//
// GLIDE_RANGE, four tiles, is no longer a range anybody normally glides at: the
// Air shrine that granted this ability is a Heart Container now, and the armor
// has its own level curve below. It survives for two reasons, both real:
//
//   • It is a GENERATION CONTRACT. ensureAbilitySecret places its glide islets
//     within it (hasShore, at the foot of this file), so every islet in every
//     world already built sits 3 or 4 tiles off its shore. Changing this number
//     moves islets that already exist.
//   • It is what a save made before the shrine change still glides at. Such a
//     hero has `updraftGlide` in their ability bag and no Air armor, which is a
//     combination the code below still resolves rather than silently taking a
//     power away that they earned under the old rules.
const GLIDE_RANGE = 4;

// The Air ARMOR's glide reaches further than the shrine reward's. This is the
// armor's real power: its slow-fall is flavour, because ledge drops deal no
// damage, and cutting 35% off the speed of a harmless fall is not an ability.
// Deliberately left as flavour rather than repaired by adding fall damage —
// that would retune every desert mesa and Earth causeway in the game, none of
// which were laid out against a fall cost.
//
// A SEPARATE constant, not a bigger GLIDE_RANGE, because GLIDE_RANGE is also a
// generation contract: ensureAbilitySecret places its secret islets within it
// (see hasShore below), and raising it would move islets that already exist.
//
// The range is a LEVEL curve, not one number: 2 tiles at armor level 1 up to 12
// at level 6 (+2 per level). Level 0, a freshly forged armor, reads as level 1
// like every other armor ability (armorAbilityStep, elements.js).
//
// Escaping the map is structurally impossible at any range — a glide only lands
// on a non-gap non-solid tile, and every map's border ring is solid, so the loop
// breaks there — which means the only question is shortcut shape. The range is
// the LANDING step, so a level-6 glide clears gaps up to 11 tiles wide. The big
// inland water bodies that shape the forest, water and mana maps run 37, 65 and
// 50 tiles across and stay uncrossable at every level, which is the invariant
// the old flat 6 was chosen to protect.
//
// GLIDE_ARMOR_RANGE_MIN is the level-1 range and is the number every generation
// and connectivity contract must be written against: a route that only exists at
// level 6 is a route a player can lose by forging a fresh armor.
const GLIDE_ARMOR_RANGE_PER_LEVEL = 2;
const GLIDE_ARMOR_RANGE_MIN = GLIDE_ARMOR_RANGE_PER_LEVEL;      // level 1
const GLIDE_ARMOR_RANGE_MAX = GLIDE_ARMOR_RANGE_PER_LEVEL * 6;  // level 6

function glideArmorRange() {
  const step = (typeof armorAbilityStep === 'function') ? armorAbilityStep('air') : 0;
  return step ? GLIDE_ARMOR_RANGE_PER_LEVEL * step : 0;
}

// The glide is a thermal, and there is no sky under a mountain. Caves, sky caves
// and dungeons are all roofed interiors, so the armor's traversal is simply not
// available in them — which also keeps the maze generators' loop connections
// (mapgen-caves.js) the only thing that decides how a cave is crossed.
const GLIDE_ROOFED_TYPES = new Set(['cave', 'cave_chain', 'sky_cave', 'dungeon',
                                    'whirlpool_grotto', 'house', 'castle_tower']);

function glideRoofedHere() {
  const cm = (typeof currentMap === 'function') ? currentMap() : null;
  return !!(cm && GLIDE_ROOFED_TYPES.has(cm.type));
}

function isGlideGap(t) {
  return t === T.WATER || t === T.DEEP_WATER || t === T.MEDIUM_WATER ||
         t === T.LAVA || t === T.SHADOW_RIFT || t === T.BOG_POOL ||
         t === T.OASIS_WATER || t === T.FOUNTAIN_WATER;
}

function tryUpdraftGlide() {
  if (glideRoofedHere()) {
    showMsg('🜁 There is no updraft under a roof.', 1500);
    return false;
  }
  const map = mapData();
  const d = abilityFacing();
  // The armor's levelled range, or the old shrine reward's flat four for a save
  // that earned Updraft Glide before that shrine became a Heart Container.
  const range = glideArmorRange() || GLIDE_RANGE;
  let sawGap = false;
  for (let step = 1; step <= range; step++) {
    const x = player.x + d.x * step, y = player.y + d.y * step;
    if (x < 0 || y < 0 || x >= MCOLS || y >= MROWS) break;
    const t = map[y][x];
    if (isGlideGap(t)) { sawGap = true; continue; }
    // A solid non-gap tile stops the glide dead — you can ride a thermal over
    // open water, not through a mountainside.
    if (isSolid(map, x, y) || (typeof shrineDynamicSolidAt === 'function' &&
        shrineDynamicSolidAt(currentMap(), x, y))) break;
    if (!sawGap) break;            // nothing was crossed; that is just walking
    if (enemies.some(e => !e.dead && e.x === x && e.y === y)) break;
    landAbilityStep(x, y, '🜁 You ride the updraft across.', true);
    return true;
  }
  showMsg('🜁 Nothing to glide across from here.', 1500);
  return false;
}

// Presentation only: logical arrival and its hooks still happen exactly once,
// immediately, as before. No extra invulnerability, range or cooldown changes.
// Not saved; snap-camera transitions discard it, including load and respawn.
let glideVisual = null;
const GLIDE_VISUAL_MS = 640;

function stepGlideVisual(dt) {
  const g = glideVisual;
  if (!g) return false;
  if (g.mapId !== currentMapId || player.hp <= 0) { glideVisual = null; return false; }
  g.t = Math.min(GLIDE_VISUAL_MS, g.t + dt);
  const p = g.t / GLIDE_VISUAL_MS;
  const travel = Math.max(0, Math.min(1, (p - 0.18) / 0.68));
  const eased = travel * travel * (3 - 2 * travel);
  player.renderX = g.fromX + (player.x - g.fromX) * eased;
  player.renderY = g.fromY + (player.y - g.fromY) * eased;
  g.lift = 1.65 * Math.sin(Math.PI * p);
  if (p >= 1) glideVisual = null;
  return true;
}

function glideVisualLift() {
  return glideVisual && glideVisual.mapId === currentMapId ? glideVisual.lift : 0;
}

// Land a completed ability move. Shared so both abilities snap the camera and
// run the arrival hooks the same way an ordinary step would.
function landAbilityStep(x, y, message, glide = false) {
  const fromX = player.renderX, fromY = player.renderY;
  player.x = x; player.y = y;
  player.renderX = x; player.renderY = y;
  if (glide) {
    glideVisual = { mapId: currentMapId, fromX, fromY, t: 0, lift: 0 };
    player.renderX = fromX; player.renderY = fromY;
  } else {
    glideVisual = null;
    const sp = screenPX(x, y);
    spawnParticle(sp.x, sp.y, '#c58ae8', 14, 3);
  }
  if (typeof clampCam === 'function') clampCam(false);
  if (typeof onShrinePlayerStep === 'function') onShrinePlayerStep();
  if (typeof buzz === 'function') buzz(14);
  showMsg(message, 1400);
  minimapDirty = true;
}

// ─── Regional armor runtime effects ──────────────────────────────────────────
// Traversal checks remain in the movement functions they affect. This driver owns
// only effects that need a clock: Lightning strikes and Luminous stun pulses.
//
// Both of these are UNTUNED and want playtesting rather than argument. They are
// gathered here as named constants for that reason: changing the feel of either
// should be a one-line edit at the top of the file, not a hunt through the two
// functions below for a bare number.

// Lightning: how long the storm waits between strikes on an exposed hero, and
// what one costs. The window is wide on purpose — a predictable metronome is
// something you learn to walk around, and this should feel like weather.
const STORM_STRIKE_MIN_MS = 6000;
const STORM_STRIKE_VAR_MS = 8000;   // actual delay is MIN + rand * VAR → 6-14s
const STORM_STRIKE_DAMAGE = 6;
const STORM_STRIKE_IFRAME_MS = 900; // matches every other damage source

// Lightning armor used to stop the storm timer dead at any level. It now stretches
// it instead: ×3 per level, so level 1 waits 18–42s between strikes and level 5
// waits 90–210s, and only level 6 switches the storm off completely — which is the
// flat behaviour the armor used to have from the moment it was forged.
const STORM_ARMOR_DELAY_PER_LEVEL = 3;
function stormStrikeDelayScale() {
  const step = (typeof armorAbilityStep === 'function') ? armorAbilityStep('lightning') : 0;
  if (!step) return 1;
  return step >= 6 ? Infinity : STORM_ARMOR_DELAY_PER_LEVEL * step;
}

// The Radiant Aura is now ONE mechanic: it burns enemy projectiles out of the
// air before they reach the hero. The stun pulse it used to fire alongside this —
// a 4-tile radius that froze ordinary enemies for 1.1s and staggered bosses — was
// removed outright, boss variant included. A shield the player can read the state
// of is a better ability than a shield plus an invisible crowd-control aura, and
// the pulse was doing most of the armor's work without ever being visible as a
// choice.
//
// This shield REPLACED the armor's original reveal power, which was fiction for as
// long as it existed — fog of war was removed from the game, so there was nothing
// for a light to uncover, and Luminous was the only armor whose stated ability did
// not do anything.
//
// A shot dies at the RIM of the aura, not on the hero, because that is what makes
// it read as a shield rather than as invisible damage immunity: the player sees the
// arrow stop short in the light.
//
// It holds a CHARGE of shots and then recharges, and both halves scale with the
// armor's level. One shot at a time is the difference between an aura and a
// blanket immunity — Luminous is tier 8 of 13 and most of the rosters above it are
// full of ranged enemies, so catching an entire volley for free would flatten the
// last five regions. The level curve is what buys the volley back: level 1 eats one
// shot every 3s, level 6 eats six and is ready again in one.
//
// Untuned, and deliberately so — like the rest of this system it wants playtesting
// rather than argument, and both curves are one line each to change.
const LUMINOUS_BLOCK_RADIUS = 2.2;
const LUMINOUS_RECHARGE_BASE_MS = 3000;   // level 0/1
const LUMINOUS_RECHARGE_MIN_MS  = 1000;   // level 6
let luminousBlockCdMs = 0;
let luminousCharge = 0;      // shots left in the current charge; refilled on recharge

// Shots one charge holds: +1 per level from 1 at level 0/1 up to 6 at level 6.
function luminousBlockCapacity() {
  return (typeof armorAbilityStep === 'function') ? armorAbilityStep('luminous') : 0;
}

// How long a spent charge takes to come back: 3s at level 0/1, easing to 1s at
// level 6 in even steps.
function luminousRechargeMs() {
  const step = luminousBlockCapacity();
  if (!step) return LUMINOUS_RECHARGE_BASE_MS;
  const span = LUMINOUS_RECHARGE_BASE_MS - LUMINOUS_RECHARGE_MIN_MS;
  return LUMINOUS_RECHARGE_BASE_MS - (span * (step - 1)) / 5;
}

// Called from the projectile step for each live enemy shot. Returns true when
// the aura has eaten it.
function luminousAuraBlocks(px, py) {
  const cap = luminousBlockCapacity();
  if (!cap) return false;
  if (luminousBlockCdMs > 0) return false;
  // Measured against the hero's tile CENTRE, not their tile index. Projectiles
  // carry centre coordinates (stepEnemyRanged spawns them at e.x + 0.5), so
  // comparing them to the integer player.x put the aura half a tile off: a shot
  // two tiles east measured as 2.5 and slipped through, while the same shot from
  // the west measured 1.5 and was caught. A shield that works on one side is
  // worse than no shield, because the player learns to trust it.
  if (Math.hypot(px - (player.x + 0.5), py - (player.y + 0.5)) > LUMINOUS_BLOCK_RADIUS) return false;
  // Charges are counted down, not tracked as a stored pool: the aura is full
  // whenever it is off cooldown, so equipping the armor or levelling it up never
  // leaves the player holding a stale, smaller charge.
  if (luminousCharge <= 0) luminousCharge = cap;
  luminousCharge--;
  if (luminousCharge <= 0) luminousBlockCdMs = luminousRechargeMs();
  const sp = screenPX(px, py);
  spawnParticle(sp.x, sp.y, '#ffe89a', 12, 4);
  spawnParticle(sp.x, sp.y, '#fff7d0', 8, 3);
  if (typeof buzz === 'function') buzz(8);
  return true;
}

// Is the aura charged? Read by the renderer so the ring dims while recovering —
// a shield the player cannot see the state of is a shield they cannot plan
// around.
function luminousAuraReady() {
  return luminousBlockCapacity() > 0 && luminousBlockCdMs <= 0;
}

// Necrotic: cursed ground is PASSABLE and drains instead of blocking. That is
// the whole design — a wall would gate the region behind armor forged inside it,
// and every region has to be completable without its own armor. A drain lets a
// determined hero cross a short stretch at a cost and makes the armor the thing
// that turns a crossing into a stroll. Generation keeps it off T.PATH so the
// roads stay clean and only the fields either side bite.
const CURSED_DRAIN_MS = 1200;
const CURSED_DRAIN_DAMAGE = 1;

// ─── The Miasma Ward, by level ───────────────────────────────────────────────
// Poison armor used to be flat immunity to both poison sources — the drifting
// miasma here and the toxic blooms' spore bursts (enemies.js). It is a level
// curve now: each level halves the damage a hit does AND doubles the interval
// between hits, and only level 6 is the free crossing the armor used to be from
// the moment it was forged.
//
// Damage floors at 1 rather than rounding away, so every level below 6 still
// costs something real; the interval doubling is what actually carries the curve
// (level 5 is one point of damage every 32 seconds).
//
// Both helpers pass their input straight through when the armor is not worn, so
// callers can wrap the unwarded numbers unconditionally.
function poisonWardDamage(base) {
  const step = (typeof armorAbilityStep === 'function') ? armorAbilityStep('poison') : 0;
  if (!step) return base;
  if (step >= 6) return 0;
  return Math.max(1, Math.round(base * Math.pow(0.5, step)));
}
function poisonWardIntervalMs(baseMs) {
  const step = (typeof armorAbilityStep === 'function') ? armorAbilityStep('poison') : 0;
  if (!step) return baseMs;
  return baseMs * Math.pow(2, step);
}

// ─── Miasma ──────────────────────────────────────────────────────────────────
// The poison wastes breathe. Fixed vents in the ground emit gas, which drifts
// downwind, pools where terrain holds it, and cannot cross a wall.
//
// This is the only system in the game with a real frame-budget risk, so the
// shape of it is chosen for cost as much as for feel:
//
//   • The field is a Float32Array over the tile grid, allocated lazily and ONLY
//     on maps that actually have vents. Every other map pays nothing at all.
//   • It ticks at MIASMA_TICK_MS, not per frame. Gas moves at the speed of
//     weather; simulating it 60 times a second would buy nothing visible and
//     cost sixty times as much. At 8Hz the whole field is ~22.5k cells eight
//     times a second, which is far below what a per-frame pass would be.
//   • Rendering only touches VISIBLE tiles (~2600 at TILE_PX 24), so the draw
//     cost is bounded by the viewport rather than by the map.
//
// Wind is per-map and fixed, derived from the map id rather than rolled, so a
// map's gas always blows the same way and re-entering it is not a new puzzle.
const MIASMA_TICK_MS = 125;          // 8Hz
const MIASMA_EMIT = 0.55;            // density added at a vent each tick
const MIASMA_SPREAD = 0.22;          // how much a cell shares with neighbours
const MIASMA_DECAY = 0.982;          // per tick, so a cut-off cloud fades out
const MIASMA_WIND_BIAS = 2.2;        // downwind neighbour weight vs upwind
const MIASMA_HURT_AT = 0.18;         // density that starts costing HP
const MIASMA_DAMAGE_MS = 1000;
const MIASMA_DAMAGE = 2;
const MIASMA_MIN = 0.004;            // below this a cell is snapped to zero

let miasmaAccMs = 0;
let miasmaHurtMs = 0;

// The gas field for a map, or null if this map has no vents. Built once and
// cached on the map object; never saved — gas is weather, not terrain.
function miasmaField(mapObj) {
  if (!mapObj || !mapObj.map) return null;
  if (mapObj._gas !== undefined) return mapObj._gas;
  const vents = [];
  for (let r = 0; r < MROWS; r++)
    for (let c = 0; c < MCOLS; c++)
      if (mapObj.map[r][c] === T.GAS_VENT) vents.push(r * MCOLS + c);
  if (!vents.length) { mapObj._gas = null; return null; }
  // Wind from the map id: stable across visits, different between maps.
  const h = ((mapObj.id || 0) * 2654435761) >>> 0;
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
  const w = dirs[h % dirs.length];
  mapObj._gas = {
    a: new Float32Array(MROWS * MCOLS),
    b: new Float32Array(MROWS * MCOLS),
    vents, wx: w[0], wy: w[1],
    // The frontier: indices that currently hold gas. See diffuseMiasma.
    active: vents.slice(),
    mark: new Uint8Array(MROWS * MCOLS),
  };
  return mapObj._gas;
}

function miasmaAt(mapObj, c, r) {
  const g = miasmaField(mapObj);
  if (!g || c < 0 || r < 0 || c >= MCOLS || r >= MROWS) return 0;
  return g.a[r * MCOLS + c];
}

function stepMiasma(dt) {
  const cm = (typeof currentMap === 'function') ? currentMap() : null;
  const g = miasmaField(cm);
  if (!g) { miasmaAccMs = 0; miasmaHurtMs = 0; return; }

  miasmaAccMs += dt;
  // One tick per interval, and at most a couple if the tab was backgrounded —
  // catching up on thirty seconds of missed weather would be a stall for no
  // visible gain.
  let ticks = 0;
  while (miasmaAccMs >= MIASMA_TICK_MS && ticks < 2) {
    miasmaAccMs -= MIASMA_TICK_MS;
    ticks++;
    diffuseMiasma(cm, g);
  }
  if (miasmaAccMs > MIASMA_TICK_MS) miasmaAccMs = 0;

  hurtInMiasma(cm, dt);
}

function diffuseMiasma(mapObj, g) {
  const map = mapObj.map;
  const a = g.a, b = g.b, mark = g.mark;
  for (const i of g.vents) a[i] = Math.min(1, a[i] + MIASMA_EMIT);
  if (!g.active.includes(g.vents[0])) g.active.push(...g.vents);

  // Simulated over an ACTIVE FRONTIER — the cells that hold gas, plus the ring
  // they can spread into — rather than over the grid or a bounding box. This is
  // the difference between the system being affordable and not, and both of the
  // simpler options were measured and rejected:
  //
  //   whole grid (22,500 cells)   0.95 ms/tick
  //   bounding box                0.58 ms/tick  — but the box round three vents
  //                                               spread across the map is 94x82,
  //                                               7,700 cells to move 85 tiles
  //                                               of gas. An AABB is the wrong
  //                                               shape for scattered sources.
  //   active frontier             see below
  //
  // Cost now scales with the amount of GAS, not with the map or the spread of
  // the vents, which is the only one of the three that stays flat as maps or
  // vent counts grow.
  //
  // `mark` dedupes candidates without allocating a Set per tick, and is cleared
  // only over the cells actually touched, so it too costs the frontier and not
  // the grid.
  const wx = g.wx, wy = g.wy;
  const cand = [];
  for (const i of g.active) {
    const c = i % MCOLS, r = (i / MCOLS) | 0;
    for (let k = 0; k < 5; k++) {
      const dc = k === 1 ? 1 : k === 2 ? -1 : 0;
      const dr = k === 3 ? 1 : k === 4 ? -1 : 0;
      const nc = c + dc, nr = r + dr;
      if (nc < 1 || nr < 1 || nc >= MCOLS - 1 || nr >= MROWS - 1) continue;
      const ni = nr * MCOLS + nc;
      if (mark[ni]) continue;
      if (isSolid(map, nc, nr)) { b[ni] = 0; continue; }
      mark[ni] = 1;
      cand.push(ni);
    }
  }

  const next = [];
  for (const i of cand) {
    const c = i % MCOLS, r = (i / MCOLS) | 0;
    let acc = a[i] * (1 - MIASMA_SPREAD);
    let wsum = 0, gsum = 0;
    for (let k = 0; k < 4; k++) {
      const dc = k === 0 ? 1 : k === 1 ? -1 : 0;
      const dr = k === 2 ? 1 : k === 3 ? -1 : 0;
      const nc = c + dc, nr = r + dr;
      if (isSolid(map, nc, nr)) continue;
      // A neighbour lying UPWIND of this cell blows its gas into it, which is
      // what makes a plume lean instead of spreading as a circle.
      const upwind = (dc === -wx && dc !== 0) || (dr === -wy && dr !== 0);
      const w = upwind ? MIASMA_WIND_BIAS : 1;
      wsum += w;
      gsum += a[nr * MCOLS + nc] * w;
    }
    if (wsum > 0) acc += (gsum / wsum) * MIASMA_SPREAD;
    acc *= MIASMA_DECAY;
    const v = acc < MIASMA_MIN ? 0 : (acc > 1 ? 1 : acc);
    b[i] = v;
    if (v > 0) next.push(i);
  }
  for (const i of cand) mark[i] = 0;

  g.active = next;
  g.a = b; g.b = a;
}

function hurtInMiasma(mapObj, dt) {
  // The Miasma Ward is a level curve now (poisonWardDamage / poisonWardIntervalMs
  // above): less damage, far less often, and nothing at all at level 6.
  const damage = poisonWardDamage(MIASMA_DAMAGE);
  if (!damage) { miasmaHurtMs = 0; return; }
  const interval = poisonWardIntervalMs(MIASMA_DAMAGE_MS);
  const d = miasmaAt(mapObj, player.x, player.y);
  if (d < MIASMA_HURT_AT) { miasmaHurtMs = 0; return; }
  miasmaHurtMs += dt;
  if (miasmaHurtMs < interval) return;
  miasmaHurtMs -= interval;
  const sp = screenPX(player.x, player.y);
  spawnParticle(sp.x, sp.y, '#8ab83a', 6, 3);
  player.hp -= damage;
  if (typeof damageNumbers !== 'undefined') {
    damageNumbers.push({ entity: 'player', val: `\u2620${damage}`,
      color: '#a8d84a', life: 900, rise: -4 });
  }
  if (typeof buzz === 'function') buzz(16);
  if (player.hp <= 0) respawn();
}

// ─── Mana regeneration ───────────────────────────────────────────────────────
// The Arcane armor knits the hero back together as they walk. Unlike every other
// regional armor power this is not tied to a hazard or a tile — it is simply on,
// everywhere, which matches how the other POWERS behave even though the hazards
// they answer are regional (Deep Swim swims any medium water, the Umbral Veil
// dims the hero to every roster in the game).
//
// It ticks through combat rather than pausing after a hit. That was a deliberate
// choice and it is safe at this rate: 1 HP every 4s is 0.25 HP/s against enemy
// hits of 6 to 19, so it can never out-heal anything shooting at you. It removes
// the tedium of walking back to an Inn between fights without touching what
// happens during one, and Health Potions stay the fast answer.
//
// It does NOT tick while a menu, shop or dialogue is open, because this runs
// from the clock driver below and that sits after update()'s modal early-return
// (main.js). Idling in the pause screen to heal is not a strategy.
const MANA_REGEN_MS = 4000;
const MANA_REGEN_HP = 1;

// The rate is a level curve: 1 HP every 12s at level 0/1, easing in even steps to
// 1 HP every 2s at level 6. The old flat 4000ms is now what level 5 gives.
//
// The safety argument above still holds at the fast end: 1 HP every 2s is 0.5
// HP/s against enemy hits of 6 to 19, so even a maxed Arcane armor cannot
// out-heal anything shooting at you.
const MANA_REGEN_SLOW_MS = 12000;   // level 0/1
const MANA_REGEN_FAST_MS = 2000;    // level 6
function manaRegenIntervalMs() {
  const step = (typeof armorAbilityStep === 'function') ? armorAbilityStep('mana') : 0;
  if (!step) return MANA_REGEN_MS;
  return MANA_REGEN_SLOW_MS - ((MANA_REGEN_SLOW_MS - MANA_REGEN_FAST_MS) * (step - 1)) / 5;
}

// ─── Regional heat ───────────────────────────────────────────────────────────
// ONE meter, two regions. Desert heatstroke and Volcanic overheat are the same
// mechanic with different numbers, so this is built as a table rather than
// twice: adding Volcanic later is an entry here plus its escalating thresholds,
// not a second implementation that drifts from this one.
//
// The shape in both cases: heat builds only while the hero stands on that
// region's HOT tiles, cools everywhere else, and costs HP only once the meter is
// full. That last part is the point — a bare ambient drain is a tax you cannot
// play around, whereas a meter with a visible ramp is a route-planning problem.
// Generation keeps the hot fields off T.PATH, so the roads are always cool and
// the cost is only ever paid by leaving them.
//
// The region's own armor HALVES the fill rate rather than stopping it. Relief,
// not immunity: the armor should make a long crossing survivable without making
// the region's defining hazard vanish.
//
// Two armor roles per region, which is what lets Fire armor matter in a region
// that is not its own. `immuneArmor` removes the meter outright; `slowArmor`
// halves the fill. Volcanic overheat has both — its own armor answers it
// completely, and Fire armor is the partial substitute for a hero who has not
// reached tier 5 yet. Desert heatstroke has only the slow role, deliberately:
// Fire armor is relief there, not immunity.
const HEAT_ARMOR_FILL_SCALE = 0.5;

// The region's OWN armor is a level curve rather than a flat switch-off: each
// level halves the fill again (level 1 → 50%, level 2 → 25%, … level 5 → 3%) and
// level 6 removes the meter entirely, which is the immunity this armor used to
// grant at every level. Only Volcanic has an `immuneArmor`; desert heatstroke is
// unchanged, since Fire armor is its `slowArmor` and was never immunity there.
//
// Returns null when the region's own armor is not being worn, so the caller can
// still fall through to the `slowArmor` half-rate.
const HEAT_LEVEL_HALVING = 0.5;
function heatOwnArmorFillScale(spec) {
  const own = spec && spec.immuneArmor;
  const step = (own && typeof armorAbilityStep === 'function') ? armorAbilityStep(own) : 0;
  if (!step) return null;
  return step >= 6 ? 0 : Math.pow(HEAT_LEVEL_HALVING, step);
}
const HEAT_REGIONS = {
  fire: {
    slowArmor: 'fire',
    hot: () => [T.DUNE, T.QUICKSAND].filter(v => v !== undefined),
    fillPerSec: 0.135,      // ~7.4s of unbroken dune to reach full from cold
    coolPerSec: 0.34,       // and ~3s in the shade to shed it again
    tickMs: 1000,
    damage: 1,
    label: 'Heatstroke',
    icon: '🥵',
    // Desert heat is a single threshold: it costs nothing until it is full.
    stages: [],
  },
  volcanic: {
    immuneArmor: 'volcanic',
    slowArmor: 'fire',
    hot: () => [T.MAGMA_CRACK].filter(v => v !== undefined),
    fillPerSec: 0.115,      // ~8.7s over open fissures from cold
    coolPerSec: 0.26,       // ~3.8s to shed a full bar
    tickMs: 900,
    damage: 2,
    label: 'Overheat',
    icon: '🌋',
    // Volcanic heat STACKS rather than waiting for full, so it is felt long
    // before it kills. Each stage costs something different.
    //
    // On `sluggish`: this is implemented as a longer step interval, NOT as
    // dropped, delayed or randomised input. Degrading a player's actual controls
    // is an accessibility problem — it breaks anyone relying on assistive input
    // or fixed timing, and it makes the game feel broken rather than hot.
    // Slowing the hero reads as heat exhaustion, stays completely predictable,
    // and every input still lands exactly when it was pressed.
    stages: [
      { at: 0.40, haze: 0.35, moveMul: 1.0 },
      { at: 0.70, haze: 0.70, moveMul: 1.45 },
      { at: 1.00, haze: 1.00, moveMul: 1.8 },
    ],
  },
};

// The strongest stage whose threshold the current heat has passed, or null.
// Read by the movement step and the renderer, so both agree about how bad it is.
function heatStage(spec, heat) {
  if (!spec || !spec.stages || !spec.stages.length) return null;
  let hit = null;
  for (const st of spec.stages) if (heat >= st.at) hit = st;
  return hit;
}

// How much the current region's heat is slowing the hero, as a step multiplier.
// 1 when there is no heat region, no heat, or the armor answers it.
function heatMoveMultiplier() {
  const cm = (typeof currentMap === 'function') ? currentMap() : null;
  const spec = heatRegionFor(cm);
  if (!spec) return 1;
  const st = heatStage(spec, player.heat || 0);
  return st ? st.moveMul : 1;
}

// 0..1 haze strength for the renderer.
function heatHazeLevel() {
  const cm = (typeof currentMap === 'function') ? currentMap() : null;
  const spec = heatRegionFor(cm);
  if (!spec) return 0;
  const st = heatStage(spec, player.heat || 0);
  return st ? st.haze : 0;
}

function heatRegionFor(mapObj) {
  if (!mapObj) return null;
  const spec = HEAT_REGIONS[mapObj.biome];
  // Villages and interiors are shelter. Only the open region map bakes.
  if (!spec || mapObj.type !== mapObj.biome) return null;
  return spec;
}

function stepRegionalHeat(dt) {
  const cm = (typeof currentMap === 'function') ? currentMap() : null;
  const spec = heatRegionFor(cm);
  if (!spec) { player.heat = 0; heatTickMs = 0; return; }
  const map = (typeof mapData === 'function') ? mapData() : null;
  if (!map || !map[player.y]) return;

  // The region's own armor takes the meter off the board entirely — no fill, no
  // stages, no bar. Checked before anything else so an immune hero never carries
  // a stale reading from before they equipped it.
  const worn = (id) => id && typeof wearingElementalArmor === 'function' && wearingElementalArmor(id);
  const ownScale = heatOwnArmorFillScale(spec);
  if (ownScale === 0) { player.heat = 0; heatTickMs = 0; return; }

  const onHot = spec.hot().includes(map[player.y][player.x]);
  const sec = dt / 1000;
  const scale = ownScale !== null ? ownScale
              : worn(spec.slowArmor) ? HEAT_ARMOR_FILL_SCALE : 1;
  // A molten obsidian golem is a heat source in its own right (moltenHeatAt,
  // enemies.js), so a fight beside one cooks the hero even on cool ground. Added
  // to the tile's own contribution rather than replacing it: standing on a
  // fissure while one bears down is the worst place to be, and should read that
  // way. Zero in every region that has no molten golems, which is all of them
  // but Volcanic.
  const molten = (typeof moltenHeatAt === 'function')
    ? moltenHeatAt(player.x, player.y) : 0;
  const gain = ((onHot ? spec.fillPerSec : 0) + molten) * scale;
  if (gain > 0) {
    player.heat = Math.min(1, (player.heat || 0) + gain * sec);
  } else {
    player.heat = Math.max(0, (player.heat || 0) - spec.coolPerSec * sec);
  }

  if ((player.heat || 0) < 1) { heatTickMs = 0; return; }
  // Full. Bleed on the meter's own clock until the hero gets off the hot ground.
  heatTickMs += dt;
  if (heatTickMs < spec.tickMs) return;
  heatTickMs -= spec.tickMs;
  const sp = screenPX(player.x, player.y);
  spawnParticle(sp.x, sp.y, '#ff9a3c', 6, 3);
  player.hp -= spec.damage;
  if (typeof damageNumbers !== 'undefined') {
    damageNumbers.push({ entity: 'player', val: `${spec.icon}${spec.damage}`,
      color: '#ffb066', life: 900, rise: -4 });
  }
  if (typeof buzz === 'function') buzz(18);
  if (player.hp <= 0) respawn();
}

// ─── Quicksand ───────────────────────────────────────────────────────────────
// Passable, and it drowns you. Standing on it sinks the hero on a clock; reach
// the bottom and the run ends there and respawns. Fire armor walks it as if it
// were sand.
//
// Harsh on purpose, and made fair by generation rather than by mercy: quicksand
// never sits on T.PATH, so it is only ever met by leaving the road, and the sink
// clock is long enough that one wrong step is a scare rather than a death. It
// also drains the moment the hero is clear, so the danger is committing deep
// into a field, not brushing an edge.
const QUICKSAND_SINK_MS = 2600;     // stood still on it, from clear to drowned
const QUICKSAND_RISE_MS = 1300;     // and how fast it lets go once you are out
const QUICKSAND_MOVE_MUL = 3;       // wading is three times slower than walking

// INVARIANT, and it is tighter than it looks. These three numbers together buy
// the hero floor(SINK_MS / (MOVE_MS * MOVE_MUL)) steps before drowning: at
// today's values, 2600 / (153 * 3) = 5 steps. Measured over ten desert maps, the
// deepest a quicksand tile ever sits from open ground is 4, so every tile is
// escapable — by exactly one step.
//
// That margin is the design: react at once and you live, dither and you do not.
// It is also one careless change from becoming a guaranteed death. Widening the
// blot radius in addDesertHazards (mapgen-biomes.js), slowing MOVE_MS, or
// raising MOVE_MUL all eat it. If any of those move, re-measure the deepest tile
// against the step budget before shipping.

function inQuicksand() {
  const map = (typeof mapData === 'function') ? mapData() : null;
  if (!map || !map[player.y]) return false;
  if (map[player.y][player.x] !== T.QUICKSAND) return false;
  return !(typeof wearingElementalArmor === 'function' && wearingElementalArmor('fire'));
}

function stepQuicksand(dt) {
  if (!inQuicksand()) {
    if (player.sink > 0) player.sink = Math.max(0, player.sink - dt / QUICKSAND_RISE_MS);
    return;
  }
  const before = player.sink || 0;
  player.sink = Math.min(1, before + dt / QUICKSAND_SINK_MS);
  // One warning, once, on the way down — a hero who does not know they are
  // sinking has no reason to run.
  if (before < 0.25 && player.sink >= 0.25) showMsg('🏜️ You are sinking!', 1600);
  const sp = screenPX(player.x, player.y);
  if (Math.random() < 0.25) spawnParticle(sp.x, sp.y, '#a8834a', 4, 2);
  if (player.sink < 1) return;
  player.sink = 0;
  player.hp = 0;
  showMsg('🏜️ The sand closes over you.', 2200);
  respawn();
}

let stormExposed = false;
let lightningStrikeMs = 0;
let cursedDrainMs = 0;
let heatTickMs = 0;
let manaRegenMs = 0;

function randomLightningDelay() {
  return (STORM_STRIKE_MIN_MS + Math.random() * STORM_STRIKE_VAR_MS) * stormStrikeDelayScale();
}

function stepElementalArmorEffects(dt) {
  const cm = (typeof currentMap === 'function') ? currentMap() : null;
  if (!cm) return;

  // The storm timer belongs to the STORM, not to the map. Keying it on map id
  // reset the countdown every time the hero crossed a map edge, so stepping one
  // tile out of Lightning territory and back dodged every strike in the region
  // for free. It restarts only on entering exposure from somewhere sheltered —
  // walking out of a sky cave should not be met with an instant bolt.
  const exposedLightning = typeof isStormExposedMap === 'function' && isStormExposedMap(cm);
  if (exposedLightning && !stormExposed) lightningStrikeMs = randomLightningDelay();
  stormExposed = exposedLightning;

  // A level-6 Lightning armor pauses the timer exactly where it is, so no strike
  // can queue behind a menu or land immediately when the armor is taken off. Every
  // level below 6 runs the clock, just far more slowly (stormStrikeDelayScale).
  // The stretch is applied when a wait is ROLLED, not continuously, so a level-up
  // or an armor swap only takes effect from the next strike onward.
  if (exposedLightning && stormStrikeDelayScale() !== Infinity) {
    // A wait rolled while a level-6 armor was on is Infinity; re-roll it rather
    // than subtracting dt from infinity forever once the armor comes off.
    if (!isFinite(lightningStrikeMs)) lightningStrikeMs = randomLightningDelay();
    lightningStrikeMs -= dt;
    if (lightningStrikeMs <= 0) {
      lightningStrikeMs = randomLightningDelay();
      strikePlayerWithRegionalLightning();
    }
  }

  stepCursedGround(dt);
  stepRegionalHeat(dt);
  stepQuicksand(dt);
  stepManaRegen(dt);
  stepMiasma(dt);
  if (luminousBlockCdMs > 0) {
    luminousBlockCdMs -= dt;
    if (luminousBlockCdMs <= 0) luminousCharge = luminousBlockCapacity();
  }
}

function stepManaRegen(dt) {
  if (!(typeof wearingElementalArmor === 'function' && wearingElementalArmor('mana'))) {
    manaRegenMs = 0;
    return;
  }
  // Nothing to do at full health, and the clock is held at zero rather than
  // allowed to run — so the first tick after taking a hit is a full interval
  // away instead of landing instantly off banked time.
  if (player.hp >= player.maxHp || player.hp <= 0) { manaRegenMs = 0; return; }
  const interval = manaRegenIntervalMs();
  manaRegenMs += dt;
  if (manaRegenMs < interval) return;
  manaRegenMs -= interval;
  player.hp = Math.min(player.maxHp, player.hp + MANA_REGEN_HP);
  // Real HP only. The green temp-HP pool is granted by items and is deliberately
  // not something the armor tops back up.
  const sp = screenPX(player.x, player.y);
  spawnParticle(sp.x, sp.y, '#cc44ff', 5, 2);
  spawnParticle(sp.x, sp.y, '#e8b0ff', 3, 2);
  if (typeof updateHUD === 'function') updateHUD();
}

// Cursed ground bites whoever stands on it. Reads the tile under the hero each
// frame rather than hooking the movement step, because standing STILL on it has
// to hurt too — a drain you can wait out by not moving is not a hazard.
//
// The clock resets the moment the hero steps clear, so crossing a two-tile
// finger of it costs nothing and wading into the middle of a field costs plenty.
// That is the intended shape: the hazard scales with how far in you commit.
function stepCursedGround(dt) {
  const map = (typeof mapData === 'function') ? mapData() : null;
  if (!map || !map[player.y] || map[player.y][player.x] !== T.CURSED_GROUND) {
    cursedDrainMs = 0;
    return;
  }
  // Necrotic armor is passage, not resistance: the drain stops dead rather than
  // being reduced, so the armor reads as the key to the region's own ground.
  if (typeof wearingElementalArmor === 'function' && wearingElementalArmor('necrotic')) {
    cursedDrainMs = 0;
    return;
  }
  cursedDrainMs += dt;
  if (cursedDrainMs < CURSED_DRAIN_MS) return;
  cursedDrainMs -= CURSED_DRAIN_MS;

  const sp = screenPX(player.x, player.y);
  spawnParticle(sp.x, sp.y, '#8a6aa8', 6, 3);
  spawnParticle(sp.x, sp.y, '#3a2a3a', 4, 2);
  // Deliberately bypasses the i-frame gate that guards enemy hits. Those exist
  // so one contact cannot land twice; this is a tick on its own clock, and
  // routing it through invincibility would let the hero park on cursed ground
  // behind the i-frames of an unrelated hit and take nothing.
  player.hp -= CURSED_DRAIN_DAMAGE;
  if (typeof damageNumbers !== 'undefined') {
    damageNumbers.push({ entity: 'player', val: `☠${CURSED_DRAIN_DAMAGE}`,
      color: '#a86ad8', life: 900, rise: -4 });
  }
  if (typeof buzz === 'function') buzz(18);
  if (player.hp <= 0) respawn();
}

function strikePlayerWithRegionalLightning() {
  if (typeof triggerPlayerStormStrike === 'function') triggerPlayerStormStrike();
  const sp = screenPX(player.x, player.y);
  spawnParticle(sp.x, sp.y, '#fff7a8', 18, 5);
  spawnParticle(sp.x, sp.y, '#8ebcff', 14, 4);
  if (player.invincible > 0) return;
  damagePlayer(STORM_STRIKE_DAMAGE, 'lightning');
  player.invincible = STORM_STRIKE_IFRAME_MS;
  showMsg('⚡ The storm strikes you!', 1500);
  if (player.hp <= 0) respawn();
}

// ─── Frost Grip ───────────────────────────────────────────────────────────────
// Ice armor supplies the regional grip, and is now the only thing that does. The
// shrine reward that used to grant it as a permanent power was a compatibility
// fallback pending exactly this redesign; the Ice shrine gives a Heart Container
// now, so the fallback is gone and this reads from the armor alone.
//
// The GRIP is what scales with the armor's level, not the hero's pace. The first
// version of this scaled snow-drift walking speed instead, on the same +20%/level
// curve as Fire, Water and Earth — and that curve starts below the unarmored
// speed, so a level-1 Ice armor crossed a SNOW_DRIFT more slowly than crossing it
// with no armor at all. An armor that is worse than bare feet at the level you
// forge it at is not a curve with a slow start, it is a bug the player will read
// as one. Ice's drift relief is a flat full-speed walk at every level now (see
// terrainMs, player.js), and the level buys traction instead.
//
// Traction is the better thing for it to buy anyway: the ice slide is the ice
// region's actual signature, and "I stop where I meant to" is something the player
// feels every single step rather than only in the drifts.
//
// Level 1 cuts a fifth of the slide; level 6 cancels it outright, which is exactly
// the flat behaviour this armor used to give the moment it was worn.
const FROST_GRIP_MIN_PCT = 20;    // level 1
const FROST_GRIP_MAX_PCT = 100;   // level 6 — no slide at all

// How long a released walk input keeps carrying the hero across an ICE sheet.
// `baseMs` is the unarmored ICE_SLIDE_MS; 0 means they stop dead.
function iceSlideMs(baseMs) {
  const step = (typeof armorAbilityStep === 'function') ? armorAbilityStep('ice') : 0;
  if (!step) return baseMs;
  const cut = FROST_GRIP_MIN_PCT +
              ((FROST_GRIP_MAX_PCT - FROST_GRIP_MIN_PCT) * (step - 1)) / 5;
  return baseMs * (1 - cut / 100);
}

// Does the hero stop dead on ice? Only a level-6 armor does, now that the slide is
// graded. Kept as its own predicate rather than folded into the caller because it
// is the question anything OTHER than the movement step would want to ask.
function frostGripHolds() {
  return iceSlideMs(1) <= 0;
}

// ─── Arcane Sight and the rune marks ──────────────────────────────────────────
// A hidden rune path: a short trail of T.RUNE_MARK tiles ending at a cache. The
// tiles are passable and, without Arcane Sight, draw as the map's own ground —
// the hero has walked over dozens of them by the time they get the ability, and
// that is the intended feeling when they turn around and start seeing them.
//
// The cache is claimed by interacting with any mark on the trail, once per map,
// recorded in the map's `openedChests` set under a `rune_` key. That set already
// persists through save/load and already distinguishes the big and boss chests
// by prefix, so the hidden caches cost no new save field.
function runeCacheKey(mapObj) { return `rune_${mapObj.id}`; }

function canSeeRunes() {
  return typeof hasAbility === 'function' && hasAbility('arcaneSight');
}

// SPACE beside (or on) a rune mark. Returns true when it handled the press.
function tryRuneMarkInteraction() {
  const cm = currentMap();
  if (!cm || !cm.map) return false;
  if (!canSeeRunes()) return false;              // invisible ground without it
  const map = mapData();
  const spots = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
  let found = false;
  for (const [dx, dy] of spots) {
    const x = player.x + dx, y = player.y + dy;
    if (x < 0 || y < 0 || x >= MCOLS || y >= MROWS) continue;
    if (map[y][x] === T.RUNE_MARK) { found = true; break; }
  }
  if (!found) return false;
  const key = runeCacheKey(cm);
  if (cm.openedChests.has(key)) {
    showMsg('✦ The runes are spent. Someone read them already: you.', 1600);
    return true;
  }
  cm.openedChests.add(key);
  grantRuneCache(cm);
  return true;
}

// What a cache holds. Deliberately the same shape of haul as a small chest, and
// keyed to the region it was found in, so a secret is worth the detour without
// being a second progression track.
function grantRuneCache(cm) {
  const regionId = (typeof regionIdForMap === 'function') ? regionIdForMap(cm) : 'forest';
  const parts = [];
  if (typeof addRegionPotions === 'function') {
    const got = addRegionPotions(regionId, 3);
    if (got && got.got) parts.push(`🧪 ${got.got} ${got.label}${got.got === 1 ? '' : 's'}`);
  }
  if (typeof addItem === 'function') parts.push(`💎 ${addItem('rubies', 120)} Rubies`);
  const regionIdx = (typeof mapRegionIndex === 'function') ? mapRegionIndex(cm) : 0;
  if (typeof oreForRegionIdx === 'function' && typeof addItem === 'function') {
    const ore = oreForRegionIdx(Math.max(0, regionIdx));
    if (ore) parts.push(`${ore.icon} ${addItem(ore.id, 2)} ${ore.label} ore`);
  }
  const sp = screenPX(player.x, player.y);
  spawnParticle(sp.x, sp.y, '#c9a2ff', 22, 4);
  if (typeof updateHUD === 'function') updateHUD();
  showMapMsg(`✦ A rune cache opens! ${parts.join(' · ')}`);
}

// ─── The secrets, stamped onto a map ──────────────────────────────────────────
// One per qualifying overworld map, chosen by map id so a given world always
// puts the same secret in the same place, and so the three stay evenly mixed
// rather than clustering. Called on map entry (spawnEnemiesForMap's caller in
// player.js) and idempotent — `abilitySecret` on the map object records that the
// pass has run, so a re-entry never stamps a second one.
//
// Every one of them is ADDITIVE and enclosed: a chest inside a pocket of solid
// terrain, an islet in the middle of water, a trail of passable marks. None of
// them can cut a route, so none of them can strand a map's connectivity — which
// is why they are safe to stamp after generation rather than during it.
// There were three. The shadow alcove — a chest walled into a two-tile-thick
// pocket, reachable only by Shadow Step — went with the ability: nothing in the
// game steps through walls any more, so an alcove would be a chest the player can
// see for the rest of the run and never open.
const SECRET_KINDS = ['glide', 'rune'];

function ensureAbilitySecret(mapObj) {
  if (!mapObj || mapObj.abilitySecret !== undefined) return;
  if (!mapObj.map) return;
  // Overworld only: villages, caves, shrines, the tower and the ruin all have
  // hand-built layouts that a stamp could land in the middle of.
  const skip = new Set(['village', 'homevillage', 'house', 'shrine', 'castle_tower',
                        'cave', 'cave_chain', 'sky_cave', 'dungeon', 'whirlpool_grotto']);
  if (skip.has(mapObj.type) || mapObj.sealed) { mapObj.abilitySecret = null; return; }
  const kind = SECRET_KINDS[Math.abs(mapObj.id) % SECRET_KINDS.length];
  const placed = kind === 'glide' ? placeGlideIslet(mapObj) : placeRuneTrail(mapObj);
  mapObj.abilitySecret = placed ? kind : null;
  if (placed && typeof minimapDirty !== 'undefined') minimapDirty = true;
}

// Walk the map in a fixed order and hand each candidate cell to `test`. Fixed
// order, not sampled: the same map must always produce the same secret in the
// same place, whether it is being stamped for the first time or rebuilt from a
// save that predates this pass.
function scanForSecretSpot(mapObj, test) {
  const m = mapObj.map;
  for (let r = 12; r < MROWS - 12; r++) {
    for (let c = 12; c < MCOLS - 12; c++) {
      if (test(m, c, r)) return { x: c, y: r };
    }
  }
  return null;
}

// An islet out in the water: a chest you can see from the bank and cannot walk
// to. Two conditions, and the second one is the one that matters — a 5×5 of
// unbroken water around it, so it is genuinely an island, AND a shore within
// gliding distance, so it is genuinely reachable. Without the second test this
// happily drops a chest in the middle of a forty-tile lake and no ability in the
// game can ever get to it.
function placeGlideIslet(mapObj) {
  const m = mapObj.map;
  const isGap = t => t !== undefined && isGlideGap(t);
  const allWater = (mm, c, r, rad) => {
    for (let dr = -rad; dr <= rad; dr++) for (let dc = -rad; dc <= rad; dc++) {
      const t = mm[r + dr] && mm[r + dr][c + dc];
      if (!isGap(t)) return false;
    }
    return true;
  };
  // A shore the hero can launch from: open ground GLIDE_RANGE tiles or fewer
  // away in one straight line, with nothing but water in between. The glide
  // lands on the first non-gap tile it meets, so the islet's standing tile is
  // exactly where they arrive.
  //
  // Three to four tiles, which an Air armor clears from level 2 up
  // (glideArmorRange). Level 1's two-tile glide is short of it — deliberately:
  // the islet is a secret, and one upgrade is a fair price for it.
  const hasShore = (mm, c, r) => {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      for (let d = 3; d <= GLIDE_RANGE; d++) {
        const x = c + dx * d, y = r + dy * d;
        const t = mm[y] && mm[y][x];
        if (t === undefined) break;
        if (isGap(t)) continue;                 // still water, keep looking out
        if (isSolid(mm, x, y) || isChestTile(t)) break;   // a cliff, not a beach
        return true;
      }
    }
    return false;
  };
  const spot = scanForSecretSpot(mapObj, (mm, c, r) => allWater(mm, c, r, 2) && hasShore(mm, c, r));
  if (!spot) return false;
  // The islet itself: one standing tile with the chest beside it, so the hero
  // lands somewhere rather than onto the chest.
  m[spot.y][spot.x] = mapObj.biome === 'ice' ? T.SNOW : T.SAND;
  m[spot.y][spot.x + 1] = T.CHEST;
  return true;
}

// A trail of rune marks leading to nothing anyone can see. Laid on open ground
// so it is walkable before and after the ability, which is the point: the hero
// has been crossing them for hours.
function placeRuneTrail(mapObj) {
  const m = mapObj.map;
  const open = (mm, c, r) => mm[r] && mm[r][c] !== undefined && !isSolid(mm, c, r) &&
                             !isChestTile(mm[r][c]);
  const spot = scanForSecretSpot(mapObj, (mm, c, r) => {
    for (let i = 0; i < 5; i++) if (!open(mm, c + i, r)) return false;
    // Away from anything else interesting: five plain ground tiles in a row.
    return true;
  });
  if (!spot) return false;
  for (let i = 0; i < 5; i++) m[spot.y][spot.x + i] = T.RUNE_MARK;
  return true;
}

// How a rune mark draws. Ordinary regional ground without Arcane Sight — the
// tile is genuinely indistinguishable, not merely subtle — and a ring of glyphs
// with it. Called from drawTileProcedural (render-tiles.js).
function drawRuneMark(col, row, x, y, s) {
  const cm = (typeof currentMap === 'function') ? currentMap() : null;
  const ground = (cm && typeof regionById === 'function')
    ? regionById(cm.biome).ground : T.GRASS;
  if (typeof drawTileProcedural === 'function') drawTileProcedural(col, row, ground, x, y, s);
  if (!canSeeRunes()) return;
  const t = Date.now() / 700 + (col * 0.7 + row * 1.1);
  const a = 0.45 + 0.25 * Math.sin(t);
  ctx.save();
  ctx.strokeStyle = `rgba(201, 162, 255, ${a})`;
  ctx.lineWidth = Math.max(1, s * 0.05);
  ctx.beginPath();
  ctx.arc(x + s / 2, y + s / 2, s * 0.30, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = `rgba(230, 210, 255, ${a})`;
  for (let i = 0; i < 4; i++) {
    const ang = t * 0.4 + i * (Math.PI / 2);
    ctx.fillRect(x + s / 2 + Math.cos(ang) * s * 0.30 - s * 0.04,
                 y + s / 2 + Math.sin(ang) * s * 0.30 - s * 0.04,
                 s * 0.08, s * 0.08);
  }
  ctx.restore();
}
