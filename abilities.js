// ─── Shrine and elemental-armor abilities, in the world ───────────────────────
// Stage 9's other half. shrines.js builds the puzzles and hands out the five
// rewards; this file is what owning one actually does once the hero walks back
// out of the shrine. Kept apart from shrines.js because the two have different
// lifetimes: a shrine matters for the twenty minutes you are inside it, and an
// ability matters for the rest of the game, in ice fields and the tower, neither
// of which shrines.js should have to know about.
//
//   Frost Grip    passive — boots that bite. Cancels the ice slide.
//   Ember Lantern passive — INERT since fog of war was removed; its only effect
//                 was restoring the necrotic region's shortened sight.
//   Arcane Sight  passive — reads what was written and hidden. Rune marks
//                 (T.RUNE_MARK) are invisible ground without it.
//   Updraft Glide ACTIVE  — rides a thermal across a gap. Equipped, then [F].
//   Shadow Step   ACTIVE  — one step through one wall. Equipped, then [F].
//
// The two actives, whether supplied by a shrine or by worn Air/Shadow armor,
// share one equipped slot and one button, because the alternative
// is two more keys on a keyboard that already uses Z X C V P 1 2 3 and four
// arrows, and a fourth touch button for something used twice an hour.

// ─── The equipped slot ────────────────────────────────────────────────────────
// `player.equippedAbility` holds an id from ACTIVE_ABILITIES, or null. Declared
// in all three of the places this codebase requires a save field to exist (the
// player literal in player.js, DEFAULT_PLAYER in save.js, and the resetGame
// assignment in save.js) so an older save defaults it rather than inheriting it.
const ACTIVE_ABILITIES = ['updraftGlide', 'shadowStep'];

function abilityIsActive(id) { return ACTIVE_ABILITIES.includes(id); }

// Air and Shadow armor supply their traversal action while worn. They take over
// the shared [F] slot temporarily without rewriting player.equippedAbility, so
// taking the armor off restores the shrine ability the player had selected.
function armorActiveAbility() {
  if (typeof wearingElementalArmor !== 'function') return null;
  if (wearingElementalArmor('air')) return 'updraftGlide';
  if (wearingElementalArmor('shadow')) return 'shadowStep';
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
  frostGrip: 'Frost Grip', updraftGlide: 'Updraft Glide', emberLantern: 'Ember Lantern',
  arcaneSight: 'Arcane Sight', shadowStep: 'Shadow Step',
};
const ABILITY_ICONS = {
  frostGrip: '❄', updraftGlide: '🜁', emberLantern: '🔥', arcaneSight: '✦', shadowStep: '◐',
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
  const ok = (id === 'updraftGlide') ? tryUpdraftGlide() : tryShadowStep();
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
// already inviting you to want. Range is four tiles, which clears the accent
// pools and rift channels the region builders lay down and does not clear a
// deep-water border.
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
// Six, and the number is measured rather than picked. Escaping the map is
// structurally impossible at any range — a glide only lands on a non-gap
// non-solid tile, and every map's border ring is solid, so the loop breaks
// there — which means the only real question is shortcut shape. Six is the
// LANDING step, so what this newly clears is gaps four and five tiles wide
// (verified: a 3-wide gap crosses either way, 4 and 5 need the armor, 6 stops
// both). The big inland water bodies that shape forest, water and mana maps run
// 37, 65 and 50 tiles across and stay uncrossable.
const GLIDE_ARMOR_RANGE = 6;

function isGlideGap(t) {
  return t === T.WATER || t === T.DEEP_WATER || t === T.MEDIUM_WATER ||
         t === T.LAVA || t === T.SHADOW_RIFT || t === T.BOG_POOL ||
         t === T.OASIS_WATER || t === T.FOUNTAIN_WATER;
}

function tryUpdraftGlide() {
  const map = mapData();
  const d = abilityFacing();
  const range = (typeof wearingElementalArmor === 'function' && wearingElementalArmor('air'))
    ? GLIDE_ARMOR_RANGE : GLIDE_RANGE;
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
    landAbilityStep(x, y, '🜁 You ride the updraft across.');
    return true;
  }
  showMsg('🜁 Nothing to glide across from here.', 1500);
  return false;
}

// ─── Shadow Step ──────────────────────────────────────────────────────────────
// One step through one wall: up to two solid tiles thick, landing on the first
// open tile beyond. Two is deliberate — every wall in this game that is meant to
// be a boundary (region borders, tower curtain walls, the cave shell) is thicker
// than that, and every wall that is meant to be an obstacle is thinner.
const SHADOW_STEP_RANGE = 3;
const SHADOW_STEP_MAX_WALL = 2;

function tryShadowStep() {
  const map = mapData();
  const d = abilityFacing();
  let wall = 0;
  for (let step = 1; step <= SHADOW_STEP_RANGE; step++) {
    const x = player.x + d.x * step, y = player.y + d.y * step;
    // Never step off the map, and never through its outermost ring — that ring
    // is what map transitions read, and phasing into it would fire one.
    if (x < 1 || y < 1 || x >= MCOLS - 1 || y >= MROWS - 1) break;
    const solid = isSolid(map, x, y) ||
      (typeof shrineDynamicSolidAt === 'function' && shrineDynamicSolidAt(currentMap(), x, y));
    if (solid) {
      wall++;
      if (wall > SHADOW_STEP_MAX_WALL) break;
      continue;
    }
    if (!wall) break;              // no wall crossed; that is just walking
    if (enemies.some(e => !e.dead && e.x === x && e.y === y)) break;
    landAbilityStep(x, y, '◐ You step through the dark and out the other side.');
    return true;
  }
  showMsg('◐ Too thick to step through.', 1500);
  return false;
}

// Land a completed ability move. Shared so both abilities snap the camera and
// run the arrival hooks the same way an ordinary step would.
function landAbilityStep(x, y, message) {
  player.x = x; player.y = y;
  player.renderX = x; player.renderY = y;
  const sp = screenPX(x, y);
  spawnParticle(sp.x, sp.y, '#c58ae8', 14, 3);
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

// Luminous: the radiant pulse that stuns what is standing beside the hero.
// Bosses reel rather than stun, because a boss frozen every four seconds is not
// a fight. FIRST_MS is the delay before the very first pulse after equipping,
// short enough that the armor visibly does something when you put it on.
const RADIANT_PULSE_MS = 4000;
const RADIANT_PULSE_FIRST_MS = 800;
const RADIANT_PULSE_RADIUS = 4;     // tiles, straight-line distance
const RADIANT_STUN_MS = 1100;
const RADIANT_BOSS_STAGGER_MS = 300;

// Necrotic: cursed ground is PASSABLE and drains instead of blocking. That is
// the whole design — a wall would gate the region behind armor forged inside it,
// and every region has to be completable without its own armor. A drain lets a
// determined hero cross a short stretch at a cost and makes the armor the thing
// that turns a crossing into a stroll. Generation keeps it off T.PATH so the
// roads stay clean and only the fields either side bite.
const CURSED_DRAIN_MS = 1200;
const CURSED_DRAIN_DAMAGE = 1;

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
  if (worn(spec.immuneArmor)) { player.heat = 0; heatTickMs = 0; return; }

  const onHot = spec.hot().includes(map[player.y][player.x]);
  const sec = dt / 1000;
  if (onHot) {
    const scale = worn(spec.slowArmor) ? HEAT_ARMOR_FILL_SCALE : 1;
    player.heat = Math.min(1, (player.heat || 0) + spec.fillPerSec * scale * sec);
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
let luminousPulseMs = RADIANT_PULSE_FIRST_MS;
let cursedDrainMs = 0;
let heatTickMs = 0;

function randomLightningDelay() {
  return STORM_STRIKE_MIN_MS + Math.random() * STORM_STRIKE_VAR_MS;
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

  // Wearing Lightning armor pauses the timer exactly where it is, so no strike
  // can queue behind a menu or land immediately when the armor is removed.
  if (exposedLightning) {
    if (!(typeof wearingElementalArmor === 'function' && wearingElementalArmor('lightning'))) {
      lightningStrikeMs -= dt;
      if (lightningStrikeMs <= 0) {
        lightningStrikeMs = randomLightningDelay();
        strikePlayerWithRegionalLightning();
      }
    }
  }

  // Radiant armor releases a short-range pulse rather than permanently freezing
  // everything beside the hero. Bosses reel only briefly; ordinary enemies take
  // the full stun.
  if (typeof wearingElementalArmor === 'function' && wearingElementalArmor('luminous')) {
    luminousPulseMs -= dt;
    if (luminousPulseMs <= 0) {
      luminousPulseMs = RADIANT_PULSE_MS;
      pulseLuminousArmor();
    }
  } else {
    luminousPulseMs = RADIANT_PULSE_FIRST_MS;
  }

  stepCursedGround(dt);
  stepRegionalHeat(dt);
  stepQuicksand(dt);
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

function pulseLuminousArmor() {
  const radius = RADIANT_PULSE_RADIUS;
  let stunned = 0;
  for (const e of enemies) {
    if (e.dead || e.dormant) continue;
    if (Math.hypot(e.x - player.x, e.y - player.y) > radius) continue;
    e.staggerT = Math.max(e.staggerT || 0,
      e.boss ? RADIANT_BOSS_STAGGER_MS : RADIANT_STUN_MS);
    const esp = screenPX(e.x, e.y);
    spawnParticle(esp.x, esp.y, '#fff4a8', 5, 2);
    stunned++;
  }
  const sp = screenPX(player.x, player.y);
  spawnParticle(sp.x, sp.y, '#fff7c2', 20, 5);
  if (stunned && typeof buzz === 'function') buzz(10);
}

// ─── Frost Grip ───────────────────────────────────────────────────────────────
// Ice armor now supplies the regional grip. The older shrine reward remains a
// compatibility fallback so existing saves do not lose a permanent power they
// already earned while the shrine reward set is redesigned.
function frostGripHolds() {
  const armorGrip = typeof wearingElementalArmor === 'function' && wearingElementalArmor('ice');
  const shrineGrip = typeof hasAbility === 'function' && hasAbility('frostGrip');
  return armorGrip || shrineGrip;
}

// ─── Ember Lantern ────────────────────────────────────────────────────────────
// CURRENTLY INERT. The lantern's whole mechanic was the fog of war: the necrotic
// region's pall cut the walking reveal radius from 12 tiles to 8, and carrying
// the lantern gave that sight back. Fog of war has been removed from the game,
// so there is no sight to take away and nothing left for the lantern to restore.
//
// The ability is still awarded by the necrotic shrine and still shows in the
// ability list (see ABILITY_IDS in player.js, SHRINE_REWARDS in shrines.js) —
// it just has no effect until it is given a new one.

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

// ─── The three secrets, stamped onto a map ────────────────────────────────────
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
const SECRET_KINDS = ['glide', 'shadow', 'rune'];

function ensureAbilitySecret(mapObj) {
  if (!mapObj || mapObj.abilitySecret !== undefined) return;
  if (!mapObj.map) return;
  // Overworld only: villages, caves, shrines, the tower and the ruin all have
  // hand-built layouts that a stamp could land in the middle of.
  const skip = new Set(['village', 'homevillage', 'house', 'shrine', 'castle_tower',
                        'cave', 'cave_chain', 'sky_cave', 'dungeon', 'whirlpool_grotto']);
  if (skip.has(mapObj.type) || mapObj.sealed) { mapObj.abilitySecret = null; return; }
  const kind = SECRET_KINDS[Math.abs(mapObj.id) % SECRET_KINDS.length];
  const placed = kind === 'glide'  ? placeGlideIslet(mapObj)
               : kind === 'shadow' ? placeShadowAlcove(mapObj)
               :                     placeRuneTrail(mapObj);
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

// A pocket hollowed inside a run of solid terrain: a chest walled in on all four
// sides, two tiles deep from open ground — visible from the outside, and
// unreachable without stepping through the wall.
function placeShadowAlcove(mapObj) {
  const m = mapObj.map;
  const solidAt = (mm, c, r) => {
    const t = mm[r] && mm[r][c];
    return t !== undefined && SOLID_TILES.has(t);
  };
  const spot = scanForSecretSpot(mapObj, (mm, c, r) => {
    // A 3×3 of solid with open ground exactly two tiles to its west, so the
    // wall between the hero and the pocket is two thick — the deepest a Shadow
    // Step reaches, and one more than an ordinary map's scenery.
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!solidAt(mm, c + dc, r + dr)) return false;
    }
    return !solidAt(mm, c - 3, r) && !isSolid(mm, c - 3, r);
  });
  if (!spot) return false;
  m[spot.y][spot.x] = T.CHEST;
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
