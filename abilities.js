// ─── Shrine abilities, in the world ───────────────────────────────────────────
// Stage 9's other half. shrines.js builds the puzzles and hands out the five
// rewards; this file is what owning one actually does once the hero walks back
// out of the shrine. Kept apart from shrines.js because the two have different
// lifetimes: a shrine matters for the twenty minutes you are inside it, and an
// ability matters for the rest of the game, in ice fields and necrotic fog and
// the tower, none of which shrines.js should have to know about.
//
//   Frost Grip    passive — boots that bite. Cancels the ice slide.
//   Ember Lantern passive — a light that the pall cannot eat. Restores the
//                 necrotic region's shortened sight.
//   Arcane Sight  passive — reads what was written and hidden. Rune marks
//                 (T.RUNE_MARK) are invisible ground without it.
//   Updraft Glide ACTIVE  — rides a thermal across a gap. Equipped, then [F].
//   Shadow Step   ACTIVE  — one step through one wall. Equipped, then [F].
//
// The two actives share one equipped slot and one button, because the alternative
// is two more keys on a keyboard that already uses Z X C V P 1 2 3 and four
// arrows, and a fourth touch button for something used twice an hour.

// ─── The equipped slot ────────────────────────────────────────────────────────
// `player.equippedAbility` holds an id from ACTIVE_ABILITIES, or null. Declared
// in all three of the places this codebase requires a save field to exist (the
// player literal in player.js, DEFAULT_PLAYER in save.js, and the resetGame
// assignment in save.js) so an older save defaults it rather than inheriting it.
const ACTIVE_ABILITIES = ['updraftGlide', 'shadowStep'];

function abilityIsActive(id) { return ACTIVE_ABILITIES.includes(id); }

// The equipped active, validated on read: an ability the hero doesn't own (or a
// stale id from an older save) reads as nothing equipped rather than as a button
// that silently fails.
function equippedAbility() {
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

function isGlideGap(t) {
  return t === T.WATER || t === T.DEEP_WATER || t === T.MEDIUM_WATER ||
         t === T.LAVA || t === T.SHADOW_RIFT || t === T.BOG_POOL ||
         t === T.OASIS_WATER || t === T.FOUNTAIN_WATER;
}

function tryUpdraftGlide() {
  const map = mapData();
  const d = abilityFacing();
  let sawGap = false;
  for (let step = 1; step <= GLIDE_RANGE; step++) {
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

// Land a completed ability move. Shared so both abilities snap the camera, wake
// the fog and run the arrival hooks the same way an ordinary step would — a
// teleport that skips revealAround leaves the hero standing in the dark.
function landAbilityStep(x, y, message) {
  player.x = x; player.y = y;
  player.renderX = x; player.renderY = y;
  const sp = screenPX(x, y);
  spawnParticle(sp.x, sp.y, '#c58ae8', 14, 3);
  if (typeof revealWalk === 'function') revealWalk(currentMap(), x, y);
  if (typeof clampCam === 'function') clampCam(false);
  if (typeof onShrinePlayerStep === 'function') onShrinePlayerStep();
  if (typeof buzz === 'function') buzz(14);
  showMsg(message, 1400);
  minimapDirty = true;
}

// ─── Frost Grip ───────────────────────────────────────────────────────────────
// The ice slide (stepPlayerMovement, player.js) keeps a released walk input live
// for ICE_SLIDE_MS while the hero stands on T.ICE. Frost Grip simply ends that:
// the boots bite, the hero stops where they meant to stop. Read from player.js
// rather than acted on here, because the slide is one branch in the middle of
// the movement step and reaching into it from outside would be worse.
function frostGripHolds() {
  return typeof hasAbility === 'function' && hasAbility('frostGrip');
}

// ─── Ember Lantern ────────────────────────────────────────────────────────────
// The necrotic region is a pall: without a light, walking reveals 8 tiles
// instead of 12 (see walkRevealRadius in fog.js). The Ember Lantern gives the
// region back its ordinary sight — and, since a cleansed region reveals 14, a
// cleansed necrotic region with the lantern reveals 14 like anywhere else.
//
// Reducing the radius rather than adding a darkness overlay is deliberate: fog
// is already this game's language for "you cannot see there", it persists per
// map, and it shows up on the minimap for free. A second darkness system would
// have to be taught all three.
const NECROTIC_REVEAL = 8;

function necroticSightPenalty(mapObj) {
  if (!mapObj) return false;
  if (typeof mapRegionIndex !== 'function') return false;
  const region = REGIONS[mapRegionIndex(mapObj)];
  if (!region || region.id !== 'necrotic') return false;
  return !(typeof hasAbility === 'function' && hasAbility('emberLantern'));
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
// sides, two tiles deep from open ground. Visible once the fog is off it, and
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
