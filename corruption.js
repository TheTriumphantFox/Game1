// ─── The blight, as a map layer ───────────────────────────────────────────────
// Stage 8. The Withering Crown's corruption spreading region by region, and
// being pushed back one shrine at a time. Three things live here, because they
// are three faces of one piece of story state:
//
//   • which regions are currently blighted     (corruptionLevel / isRegionCorrupted)
//   • what a blighted map looks like           (drawCorruptionOverlay)
//   • what a blighted creature is              (the corrupted enemy template)
//
// Plain-script global, like every other file here. Loaded after shrines.js
// (which owns the cleansing trigger) and before the render and gameplay files
// that call into it; every cross-file call is `typeof`-guarded in the caller,
// so nothing here has to exist at parse time for the rest of the game to boot.
//
// ─── What this is NOT ───
// The necrotic region's `BLIGHT` terrain (regions.js, tier 9) is ordinary biome
// ground with an unfortunate name. It is not story state, it does not spread,
// and nothing here reads or writes it. The two are deliberately distinct in
// play as well as in code: necrotic ground is sickly olive *terrain*, and this
// is a violet wash laid *over* whatever terrain is underneath. Standing in a
// blighted necrotic region shows both at once, which is the point.
//
// ─── Why an overlay and not a tile swap ───
// Corruption never mutates `mapObj.map`. It is derived, every frame, from one
// story flag and the shrine quest table, so cleansing a region is a state
// change rather than a second pass over 22,500 tiles per map — and there is no
// way for a half-applied tile swap to survive in a save and strand a region
// looking blighted after it was cleansed.

// The spread's reach: the highest region index the blight has touched. Stored
// as the `corruption_level` story flag (see story.js), which is an INDEX and
// not a boolean — 0 means "the forest has been reached", which is a real value
// and a falsy one at the same time, so it must be read with getFlag.
//
// Absent, it derives: the blight arrives with the Emperor, so a finished
// prologue means the forest is already touched. Deriving rather than writing
// the flag in Beat 5 keeps every pre-stage-8 save correct without a migration.
function corruptionLevel() {
  const raw = (typeof getFlag === 'function') ? getFlag('corruption_level') : undefined;
  if (typeof raw === 'number') return raw;
  return (typeof hasFlag === 'function' && hasFlag('prologue_complete')) ? 0 : -1;
}

// Push the spread out to a newly opened region. Called when the world's notion
// of the current region advances (player.js, where a cleared village opens the
// next region). Monotonic: the blight never recedes on its own, only region by
// region as each shrine is solved.
function advanceCorruption(regionIdx) {
  if (typeof setFlag !== 'function') return;
  if (!Number.isInteger(regionIdx) || regionIdx < 0) return;
  if (regionIdx <= corruptionLevel()) return;
  setFlag('corruption_level', regionIdx);
  const region = (typeof REGIONS !== 'undefined') ? REGIONS[regionIdx] : null;
  if (region && typeof showMapMsg === 'function') {
    showMapMsg(`🜄 The blight has reached the ${region.id} region.`);
  }
}

// A region is clean once its shrine is solved — solved, not reward-claimed. The
// puzzle is the act that restores the place; walking back out with the heart
// container is bookkeeping.
function isRegionCleansed(regionIdx) {
  if (typeof shrineQuest !== 'function') return false;
  const q = shrineQuest(regionIdx);
  return !!q && q.status === 'solved';
}

function isRegionCorrupted(regionIdx) {
  if (!Number.isInteger(regionIdx) || regionIdx < 0) return false;
  if (regionIdx > corruptionLevel()) return false;
  return !isRegionCleansed(regionIdx);
}

// Which region a map belongs to. `regionIdx` is authoritative where it exists;
// `biome` is the fallback for older saves and for maps built before the field
// was universal.
function mapRegionIndex(mapObj) {
  if (!mapObj) return -1;
  if (Number.isInteger(mapObj.regionIdx)) return mapObj.regionIdx;
  if (typeof REGIONS === 'undefined') return -1;
  return REGIONS.findIndex(r => r.id === mapObj.biome);
}

// Map types the blight is never drawn on, and never spawns blighted creatures in:
//
//   homevillage — Elderbrook. It is ash and stays ash; a violet wash over a
//                 burnt village would read as "this can be cleansed", and the
//                 one thing the story is firm about is that it cannot.
//   house       — the old starter cabin interior.
//   shrine      — the cure. A blighted shrine interior undercuts the whole act.
//   castle_tower— the Emperor's own tower. It is the source, not a casualty,
//                 and the finale has its own staging (stage 10).
const CORRUPTION_EXEMPT_TYPES = new Set(['homevillage', 'house', 'shrine', 'castle_tower']);

function isMapCorrupted(mapObj) {
  if (!mapObj || CORRUPTION_EXEMPT_TYPES.has(mapObj.type)) return false;
  return isRegionCorrupted(mapRegionIndex(mapObj));
}

// ─── Cleansing ────────────────────────────────────────────────────────────────
// Called from setShrineSolved (shrines.js) the moment the puzzle falls. Two
// things happen at once, and both are the shrine's payoff:
//   1. the overlay stops being drawn on that region's maps (derived — free)
//   2. everything still alive in the region sheds the corrupted template
// There used to be a third — the fog lifting wider and the village revealed
// whole — but fog of war has been removed from the game, so every map already
// reads in full from the moment it is entered.
function cleanseRegionCorruption(regionIdx) {
  if (!Number.isInteger(regionIdx)) return;
  syncCorruptionForRegion(regionIdx);
  if (typeof minimapDirty !== 'undefined') minimapDirty = true;
  const region = (typeof REGIONS !== 'undefined') ? REGIONS[regionIdx] : null;
  if (region && typeof showMapMsg === 'function') {
    showMapMsg(`✦ The blight lifts from the ${region.id} region.`);
  }
}

// ─── The corrupted enemy template ─────────────────────────────────────────────
// A multiplier over a base stat block rather than a second hand-authored
// creature, following the village "Greater" tier (`tier15` in makeEnemyDefs)
// exactly — that precedent exists so a base creature stays authored once, and a
// blighted roster is the same argument a second time.
//
// 1.5×, where Greater is 2×. Reasoning, since this is the one number here that
// can wreck a fight:
//   • Damage multipliers land 1:1 on damage taken. Every melee enemy in the
//     game already ticks faster than the player's 900 ms i-frame floor, so DPS
//     is dmg × 1000/900 and a ×N on `dmg` is a ×N on the damage the hero takes.
//   • It stacks with Greater in a boss village: 2 × 1.5 = 3× base. At 2× it
//     would have been 4×, which is a different fight, not a harder one.
//   • It is worn for a whole region, unlike Greater, which is worn for one
//     arena. A tax you pay for twenty maps has to be lighter than one you pay
//     for a single fight.
//   • XP rises with it, so the extra effort pays.
// Anchored to `tier15` as the shipped precedent and to the observed HP-ratio
// table in the enemy-forge skill — NOT to a playtest-confirmed reference
// enemy, because this repo does not have one yet.
//
// Size is deliberately untouched: Greater already owns "bigger", and the aura
// (drawCorruptedEnemyAura, render-enemies.js) is this template's tell.
const CORRUPTION_HP_MUL  = 1.5;
const CORRUPTION_DMG_MUL = 1.5;
const CORRUPTION_XP_MUL  = 1.5;

// Who can catch it. Bosses are exempt, which also covers Guild Quarries and
// bounty elites (both carry `boss: true`) — those are hand-tuned set pieces
// with their own multipliers over the same base, and stacking a third one on
// top would make a quest target's difficulty depend on story state. The
// prologue dog can't be reached by this anyway (map 0 is exempt), but it is
// clamped at 1 HP by hand and would not survive the arithmetic.
function isCorruptible(e) {
  return !!e && !e.dead && !e.boss && !e.finalBoss && !e.dormant &&
         typeof DND_ENEMIES !== 'undefined' && !!DND_ENEMIES[e.type];
}

// The stats this creature would have with `corrupted` set to `on`. Recomputed
// from the base entry rather than by multiplying and later dividing the live
// values: floating-point round trips drift, and this way "uncorrupted" is
// exactly the number spawnEnemiesForMap would have produced for the same
// creature, forever.
function corruptedStatsFor(e, on) {
  const base = DND_ENEMIES[e.type];
  if (!base) return null;
  const g = e.tier15 ? 2 : 1;                       // the Greater tier, if any
  const c = on ? 1 : 0;
  const hpMul  = g * (c ? CORRUPTION_HP_MUL  : 1);
  const dmgMul = g * (c ? CORRUPTION_DMG_MUL : 1);
  const xpMul  = g * (c ? CORRUPTION_XP_MUL  : 1);
  const greaterName = e.tier15 ? `Greater ${base.name}` : base.name;
  return {
    maxHp: Math.round(base.hp * hpMul),
    dmg:   Math.round(base.dmg * dmgMul),
    // The global half-XP rebalance is applied last here for the same reason it
    // is in spawnEnemiesForMap: so both paths floor the same product.
    xp:    Math.floor(base.xp * xpMul * 0.5),
    name:  c ? `Blighted ${greaterName}` : greaterName,
  };
}

// Put the template on, or take it off. Current HP is carried across as a
// PERCENTAGE, which is the checklist's requirement and also the only humane
// answer: a hero who has fought something down to a sliver should not watch it
// heal because they solved a puzzle, and a full-health creature should not drop
// to two thirds because the blight arrived.
function setEnemyCorrupted(e, on) {
  on = !!on;
  if (!isCorruptible(e)) return false;
  if (!!e.corrupted === on) return false;
  const stats = corruptedStatsFor(e, on);
  if (!stats) return false;
  const pct = (e.maxHp > 0) ? (e.hp / e.maxHp) : 1;
  e.corrupted = on;
  e.maxHp = stats.maxHp;
  e.hp = Math.max(1, Math.min(stats.maxHp, Math.round(pct * stats.maxHp)));
  e.dmg = stats.dmg;
  e.xp = stats.xp;
  e.name = stats.name;
  return true;
}

// Bring a whole list into line with what its map should look like now. Used on
// every map entry (spawnEnemiesForMap) as well as on cleansing, because a map
// the hero left blighted can be re-entered after the region was cleansed, and
// its `savedEnemies` remember the stats they were saved with.
function syncEnemyListCorruption(list, on) {
  if (!list) return 0;
  let changed = 0;
  for (const e of list) if (setEnemyCorrupted(e, on)) changed++;
  return changed;
}

// Every map in one region, live list included. `enemies` is the live copy of
// whichever map the hero is standing on; a map object's `savedEnemies` is the
// copy everywhere else, and both have to move together or walking out and back
// in would undo the cleansing.
function syncCorruptionForRegion(regionIdx) {
  if (typeof worldMaps === 'undefined') return;
  for (const m of worldMaps) {
    if (!m || mapRegionIndex(m) !== regionIdx) continue;
    const on = isMapCorrupted(m);
    if (m.savedEnemies) syncEnemyListCorruption(m.savedEnemies, on);
    if (typeof currentMapId !== 'undefined' && m.id === currentMapId &&
        typeof enemies !== 'undefined') {
      syncEnemyListCorruption(enemies, on);
    }
  }
}

// ─── The overlay ──────────────────────────────────────────────────────────────
// Palette-shifted tiles, per the design decision, done as a `multiply` pass:
// multiplying by a violet darkens and shifts a tile's own colours instead of
// hiding them under a flat film, so blighted grass still reads as grass and
// blighted sand still reads as sand. A plain alpha wash washes everything
// toward one colour and the map stops being legible.
//
// The blotching is a coordinate hash, not randomness: the same tile is always
// eaten to the same depth, so the creep holds still while the hero walks
// through it and looks identical after a reload.
const CORRUPTION_VEIL = '#5f2f7e';    // multiplied in — a deep bruised violet
const CORRUPTION_MOTE = '#d9a6ff';    // the specks that drift over the worst of it
// How hard the blotch field is pushed away from its middle. 1 is the raw noise
// (hazy); higher separates clean ground from eaten ground more sharply, at the
// cost of the gradient between them getting shorter. Past ~3 the patches start
// to look cut out rather than spread.
const CORRUPTION_CONTRAST = 2.2;

function corruptionTileNoise(c, r) {
  // Cheap integer hash, same family as the tile-variant hashes in render.js.
  let h = (c * 73856093) ^ (r * 19349663);
  h = (h ^ (h >>> 13)) >>> 0;
  return (h % 1024) / 1024;
}

// ─── The blotch field ─────────────────────────────────────────────────────────
// How eaten this particular tile is, 0 to 1. Everything about how the blight
// *reads* comes from here, so it is worth being precise about what it does and
// why it isn't simpler.
//
// Per-tile noise alone is even static: every tile lands somewhere in the same
// range, so raising the intensity just darkens the whole screen uniformly. A
// coarse hash over square blocks fixes the evenness but trades it for a visible
// grid — hard, axis-aligned edges where one block's value gives way to the
// next's, which reads as tiling rather than rot.
//
// So: smooth value noise instead. Sample the hash at the corners of a lattice
// and interpolate between them (smoothstep on the fraction, so the blend eases
// in and out rather than running straight), which gives soft irregular gradients
// with no seams. Two octaves at different scales and offsets, the coarse one
// carrying most of the weight, so there are big slow stretches of rot with
// smaller mottling inside them.
//
// Then a contrast curve, which is the part that actually makes it blotchy: raw
// noise clusters around the middle and looks like haze. Pushing values toward
// 0 and 1 gives ground that is either largely clean or badly eaten, with the
// in-between narrow enough to read as an edge.
function corruptionValueNoise(c, r, scale, seed) {
  const fx = c / scale, fy = r / scale;
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const tx = fx - x0, ty = fy - y0;
  // Smoothstep the blend factors — linear interpolation leaves visible creases
  // along the lattice lines.
  const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  const h = (x, y) => corruptionTileNoise(x + seed, y + seed * 7);
  const n00 = h(x0, y0),     n10 = h(x0 + 1, y0);
  const n01 = h(x0, y0 + 1), n11 = h(x0 + 1, y0 + 1);
  const top = n00 + (n10 - n00) * sx;
  const bot = n01 + (n11 - n01) * sx;
  return top + (bot - top) * sy;
}

function corruptionPatchNoise(c, r) {
  // Coarse stretches, with finer mottling laid over them.
  const coarse = corruptionValueNoise(c, r, 9, 977);
  const fine   = corruptionValueNoise(c, r, 4, 331);
  let v = coarse * 0.68 + fine * 0.32;
  // Two octaves summed pile up around the middle, and smoothstep on its own
  // can't drag enough of that out to the ends — it only steepens what is
  // already off-centre. So stretch about the midpoint first (values past the
  // ends clamp, which is the point: they become flat clean and flat rotten),
  // then steepen twice. Measured over 4,000 tiles this leaves ~26% of the map
  // clearly clean, ~38% clearly eaten and only ~17% in the middling band that
  // reads as haze; the same field without the stretch left 36% in that band.
  v = Math.max(0, Math.min(1, (v - 0.5) * CORRUPTION_CONTRAST + 0.5));
  v = v * v * (3 - 2 * v);
  v = v * v * (3 - 2 * v);
  return v;
}

function drawCorruptionOverlay(ts, startC, startR, endC, endR) {
  const mapObj = (typeof currentMap === 'function') ? currentMap() : null;
  if (!isMapCorrupted(mapObj)) return;
  const now = Date.now();
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = CORRUPTION_VEIL;
  for (let mr = startR; mr <= endR; mr++) {
    if (mr < 0 || mr >= MROWS) continue;
    for (let mc = startC; mc <= endC; mc++) {
      if (mc < 0 || mc >= MCOLS) continue;
      const n = corruptionTileNoise(mc, mr);
      const patch = corruptionPatchNoise(mc, mr);
      // A slow swell, offset per tile so the whole screen doesn't breathe in
      // unison. Small: the blight is meant to look sick, not animated.
      const pulse = 0.5 + 0.5 * Math.sin(now / 1700 + (mc + mr) * 0.4);
      // 0.12 on ground the rot has barely touched, up past 0.85 in the middle of
      // a bad patch. Nearly all of that swing is the blotch field, so what the
      // eye reads is the shape of the patches; the per-tile term is grain inside
      // them and the pulse is the slow breath underneath. The floor is set so
      // the AVERAGE darkness lands about where it did before the field was
      // sharpened — this trades evenness for contrast, it doesn't just add more.
      ctx.globalAlpha = 0.12 + patch * 0.62 + n * 0.09 + pulse * 0.06;
      const sx = Math.floor((mc - camC) * ts);
      const sy = Math.floor((mr - camR) * ts);
      ctx.fillRect(sx, sy, Math.ceil(ts) + 1, Math.ceil(ts) + 1);
    }
  }
  // The specks, over the top and in normal blending — a multiplied highlight is
  // not a highlight. Only the tiles the hash ate deepest get one.
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = CORRUPTION_MOTE;
  for (let mr = startR; mr <= endR; mr++) {
    if (mr < 0 || mr >= MROWS) continue;
    for (let mc = startC; mc <= endC; mc++) {
      if (mc < 0 || mc >= MCOLS) continue;
      const patch = corruptionPatchNoise(mc, mr);
      // Motes belong to the rot, not to the map: clean ground never carries one
      // however the per-tile hash rolls, and inside a bad patch most tiles do.
      // That is a second thing drawing the eye to the same shapes the veil does.
      if (patch < 0.35) continue;
      const n = corruptionTileNoise(mc, mr);
      if (n < 0.78 - patch * 0.55) continue;
      const drift = Math.sin(now / 900 + n * 12) * ts * 0.18;
      const sx = (mc - camC) * ts + ts * (0.25 + n * 0.4);
      const sy = (mr - camR) * ts + ts * 0.5 + drift;
      ctx.globalAlpha = 0.18 + patch * 0.40;
      ctx.beginPath();
      ctx.arc(sx, sy, Math.max(1, ts * (0.05 + patch * 0.045)), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// The creature tell, drawn behind the sprite from drawEnemy (render-enemies.js)
// next to the elemental aura, so a blighted creature reads at a glance and a
// blighted *elemental* creature wears both.
function drawCorruptedEnemyAura(e, cx, cy, radius) {
  const t = Date.now() / 1000 + (e.id || 0) * 0.61;
  const pulse = 0.5 + 0.5 * Math.sin(t * 2.1);
  ctx.save();
  const g = ctx.createRadialGradient(cx, cy, radius * 0.15, cx, cy, radius * (1.05 + pulse * 0.12));
  g.addColorStop(0, 'rgba(122, 74, 148, 0)');
  g.addColorStop(0.62, `rgba(122, 74, 148, ${0.30 + pulse * 0.16})`);
  g.addColorStop(1, 'rgba(38, 12, 48, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * (1.05 + pulse * 0.12), 0, Math.PI * 2);
  ctx.fill();
  // Three motes orbiting on the same hash-free clock the aura pulses on.
  ctx.fillStyle = CORRUPTION_MOTE;
  for (let i = 0; i < 3; i++) {
    const a = t * 1.3 + i * (Math.PI * 2 / 3);
    const rr = radius * (0.78 + 0.10 * Math.sin(t * 1.9 + i));
    ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 2.4 + i * 1.7);
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.72, Math.max(1, radius * 0.09), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
