// ─── Sword elemental traits ───────────────────────────────────────────────────
// Each element the player owns adds an extra 1d4 damage roll of that element
// to every successful sword swing. Multiple elements stack — a sword with
// Fire + Ice will deal base + 1d4 fire + 1d4 ice per hit.
//
// Each elemental sword is forged at its home region's Blacksmith (see
// forgeRegionalSword in shop.js) and stored on `player.swordElements` as a list of
// element ids. Each element has its own colour so the damage numbers visually
// distinguish their source.

const SWORD_ELEMENTS = {
  fire:      { id: 'fire',      label: 'Fire',      icon: '🔥', color: '#ff6622' },
  water:     { id: 'water',     label: 'Water',     icon: '💧', color: '#3a88ff' },
  ice:       { id: 'ice',       label: 'Ice',       icon: '❄',  color: '#88ddff' },
  lightning: { id: 'lightning', label: 'Lightning', icon: '⚡', color: '#ffee33' },
  earth:     { id: 'earth',     label: 'Earth',     icon: '🪨', color: '#5a3210' },
  air:       { id: 'air',       label: 'Air',       icon: '💨', color: '#cccccc' },
  luminous:  { id: 'luminous',  label: 'Luminous',  icon: '✨', color: '#ffee66' },
  necrotic:  { id: 'necrotic',  label: 'Necrotic',  icon: '💀', color: '#aa66dd' },
  poison:    { id: 'poison',    label: 'Poison',    icon: '☠',  color: '#88cc44' },
  mana:      { id: 'mana',      label: 'Mana',      icon: '🔮', color: '#cc44ff' },
  volcanic:  { id: 'volcanic',  label: 'Volcanic',  icon: '🌋', color: '#ff3311' },
  shadow:    { id: 'shadow',    label: 'Shadow',    icon: '🌑', color: '#8b5cf6' },
  // #15 Dragonbane — the capstone blade, not a regional element. It is forged once
  // (see forgeDragonbane in shop-blacksmith.js), never dropped or region-bound, and
  // must be excluded anywhere the 12 regional elements are enumerated (region maps,
  // sealed-shrine rolls). Its damage is handled specially in doSwordSwing.
  dragonbane: { id: 'dragonbane', label: 'Dragonbane', icon: '🐲', color: '#ff2a00', capstone: true }
};

// Every regional (non-capstone) element id — use this, not Object.keys(SWORD_ELEMENTS),
// wherever only the 12 wieldable region elements are meant (shrine rolls, etc.).
const REGION_ELEMENT_IDS = Object.keys(SWORD_ELEMENTS).filter(id => !SWORD_ELEMENTS[id].capstone);

// Each regional armor carries one exploration power in addition to its physical
// defense and matching-element block. This registry is the UI/design authority;
// the individual mechanics stay with the systems they affect (movement in
// player.js, active traversal in abilities.js, and regional hazards in main.js).
// Every description below is written against the armor's LEVEL, because every one
// of these powers scales with it now (see armorAbilityStep at the foot of this
// file, and the individual curves in abilities.js / player.js / enemies.js).
const ELEMENTAL_ARMOR_ABILITIES = {
  fire:      { label: 'Desert Walker', description: 'Cross quicksand safely, bake half as fast, and stride the dunes faster each level.', status: 'ready' },
  water:     { label: 'Deep Swim', description: 'Swim through medium-depth water, faster each level.', status: 'ready' },
  ice:       { label: 'Ice Grip', description: 'Walk the drifts at full pace, pacify dormant ice golems, and slide less on ice each level.', status: 'ready' },
  earth:     { label: 'Cliff Climb', description: 'Climb raised cliff faces, pacify dormant stone golems, and climb faster each level.', status: 'ready' },
  volcanic:  { label: 'Heat Vent', description: 'Halves the caldera\'s overheat again with every level; immune at level 6.', status: 'ready' },
  air:       { label: 'Updraft Glide', description: 'Glide a gap 2 tiles wide per armor level, up to 12. Not under a roof.', status: 'ready' },
  lightning: { label: 'Storm Grounding', description: 'Stretches the region storm-strike timer ×3 per level; silent at level 6.', status: 'ready' },
  luminous:  { label: 'Radiant Aura', description: 'Burns enemy shots from the air — one per level, recharging faster each level.', status: 'ready' },
  necrotic:  { label: 'Grave Command', description: 'Walk cursed ground unharmed and raise one allied skeleton per armor level.', status: 'ready' },
  poison:    { label: 'Miasma Ward', description: 'Halves spore and miasma damage again with every level; immune at level 6.', status: 'ready' },
  mana:      { label: 'Arcane Mending', description: 'Knits your wounds as you travel — 1 HP every 12s, down to every 2s at level 6.', status: 'ready' },
  shadow:    { label: 'Umbral Veil', description: 'Enemies notice you 20% later per level, up to 80% at level 6.', status: 'ready' },
};

function wearingElementalArmor(elemId) {
  return !!(player && player.activeArmorElement === elemId);
}

function elementalArmorAbility(elemId) {
  return ELEMENTAL_ARMOR_ABILITIES[elemId] || null;
}

// Armor-specific exceptions to ordinary tile solidity. Kept here so direct
// movement and tap-to-travel cannot disagree about a route.
function elementalArmorTraversesTile(map, c, r) {
  if (!map || !map[r]) return false;
  const t = map[r][c];
  if (wearingElementalArmor('water') && t === T.MEDIUM_WATER) return true;
  if (wearingElementalArmor('earth') && t === T.LEDGE_FACE) return true;
  return false;
}

// Changing armor while the hero is standing somewhere ONLY that armor lets them
// stand is how a run ends: measured, taking Water armor off in the middle of a
// medium-water pond leaves 0 of 8 legal moves, and there is no damage source out
// there to die out of, so the save is stuck for good.
//
// Refused rather than repaired. An eject-to-shore would also clear it, but it
// teleports the hero somewhere they did not ask to go, and the refusal explains
// itself where a silent teleport does not.
//
// Written against the traversal rule rather than against water, so any armor
// that grants passage later is covered without anyone having to remember this.
// Earth does not trigger it in practice — stepping DOWN off a ledge face is
// never blocked, so a hero on a face always has an exit — but the check is the
// same one either way.
function armorChangeBlockedHere() {
  if (typeof player === 'undefined' || !player) return false;
  const map = (typeof mapData === 'function') ? mapData() : null;
  if (!map || !map[player.y]) return false;
  return elementalArmorTraversesTile(map, player.x, player.y);
}

// The one place armor is equipped or dropped. The radial's three entries (equip,
// and the two "no armor" variants) all come through here so the guard cannot be
// bypassed by whichever one a player happens to reach for. Returns whether the
// change actually happened.
function setActiveArmorElement(id) {
  if (armorChangeBlockedHere()) {
    const worn = SWORD_ELEMENTS[player.activeArmorElement];
    if (typeof showMsg === 'function') {
      showMsg(`🛡 Not here — without the ${worn ? worn.label : 'worn'} Armor you would have nowhere to stand.`, 2200);
    }
    return false;
  }
  player.activeArmorElement = id;
  return true;
}

// #15 Dragonbane hit: a flat bonus far above any elemental sword's ceiling
// (a maxed elemental sword tops out at 1d4 + 12). Rolls 1d12 + 12 → 13..24, and its
// swing also forces a guaranteed, deepened opposite-element proc (see rollOppositeVuln
// / doSwordSwing) so nothing resists it.
function dragonbaneSwordBonus() { return 12 + (1 + Math.floor(Math.random() * 12)); }

// Display info (icon/label/color) for any element id.
function elementInfo(id) {
  return SWORD_ELEMENTS[id] || null;
}

// ─── Elemental visual signatures ───────────────────────────────────────────────
// One source of truth for how each element *looks* in the world. Every place an
// element manifests — a glowing sword swing, a trailing arrow, a worn armor's
// aura, an elemental enemy and its attacks — renders from this table so a given
// element reads the same everywhere (see drawElementFX in render.js).
//
//   style : the animated motif drawn around the source
//     glow  → soft radiant halo + twinkles   (luminous, mana)
//     mist  → dark drifting smoke wisps       (shadow, necrotic)
//     flame → flickering upward tongues       (fire)
//     erupt → crater blasting lava bombs       (volcanic)
//     drip  → clinging, falling droplets      (poison/"acid")
//     bubble→ rising bubbles + wet sheen      (water)
//     frost → radiating crystalline spikes    (ice)
//     spark → jittering electric arcs         (lightning)
//     dust  → orbiting pebbles & grit         (earth)
//     wind  → curved swirling gusts           (air)
//   c1 : core colour   c2 : bright/accent (or deep shade for mist)
const ELEMENT_FX = {
  fire:      { style: 'flame',  c1: '#ff5511', c2: '#ffdd44' },
  volcanic:  { style: 'erupt',  c1: '#ff3311', c2: '#ffb733' },
  water:     { style: 'bubble', c1: '#3a88ff', c2: '#bfe6ff' },
  ice:       { style: 'frost',  c1: '#88ddff', c2: '#eaffff' },
  lightning: { style: 'spark',  c1: '#ffee33', c2: '#ffffcc' },
  earth:     { style: 'dust',   c1: '#7a5228', c2: '#b98a4a' },
  air:       { style: 'wind',   c1: '#cfd6dd', c2: '#ffffff' },
  luminous:  { style: 'glow',   c1: '#ffee66', c2: '#fffdd6' },
  necrotic:  { style: 'mist',   c1: '#aa66dd', c2: '#3a1f52' },
  poison:    { style: 'drip',   c1: '#88cc44', c2: '#c6ff5a' },
  mana:      { style: 'glow',   c1: '#cc44ff', c2: '#f0c2ff' },
  shadow:    { style: 'mist',   c1: '#6a3aa8', c2: '#0e0820' },
  dragonbane:{ style: 'flame',  c1: '#ff3300', c2: '#ffcc22' }
};

// Visual signature for an element id (or null if none / unknown).
function elementFX(id) {
  return ELEMENT_FX[id] || null;
}

// ─── Opposite-element pairings ─────────────────────────────────────────────────
// Every enemy that deals an element is vulnerable to that element's opposite:
// hitting it has a chance to add bonus damage of OPPOSITE[element] (see
// rollOppositeVuln). Every pairing is bidirectional — Volcanic and Shadow are now
// full wieldable elements with their own regions, so Ice enemies bleed Volcanic
// and Volcanic enemies bleed Ice, etc.
const OPPOSITE = {
  fire:      'water',    water:     'fire',
  ice:       'volcanic', volcanic:  'ice',
  lightning: 'shadow',   shadow:    'lightning',
  earth:     'air',      air:       'earth',
  luminous:  'necrotic', necrotic:  'luminous',
  poison:    'mana',     mana:      'poison'
};

// ─── Earth's custom stone symbol ───────────────────────────────────────────────
// Emoji glyphs render in their own fixed colours, so the grey 🪨 rock can't be
// tinted to the dark brown we want. Earth's symbol is therefore a hand-drawn SVG
// stone instead, exposed two ways: `iconUri` (a data: URL) for HTML rows in the
// shop, and `iconImg` (a preloaded Image) that the radial menu draws onto its
// canvas. The plain `icon` emoji stays as a fallback for plain-text toasts —
// showMsg writes via textContent, which can't render an <img>.
const EARTH_ROCK_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
    '<g stroke="#1f1107" stroke-width="3" stroke-linejoin="round">' +
      '<path d="M9 42 L7 29 L21 16 L41 13 L55 27 L56 43 L40 55 L20 53 Z" fill="#5a3210"/>' +
      '<path d="M21 16 L41 13 L44 31 L23 34 Z" fill="#80511f"/>' +
      '<path d="M41 13 L55 27 L56 43 L44 31 Z" fill="#42260c"/>' +
      '<path d="M20 53 L23 34 L44 31 L40 55 Z" fill="#2f1c08"/>' +
    '</g>' +
    '<circle cx="29" cy="24" r="2.3" fill="#9a6a34"/>' +
    '<circle cx="37" cy="42" r="1.8" fill="#6a4018"/>' +
  '</svg>';
const EARTH_ROCK_URI = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(EARTH_ROCK_SVG);
SWORD_ELEMENTS.earth.iconUri = EARTH_ROCK_URI;
if (typeof Image !== 'undefined') {
  const _earthRockImg = new Image();
  _earthRockImg.src = EARTH_ROCK_URI;
  SWORD_ELEMENTS.earth.iconImg = _earthRockImg;
}

// Inline-HTML markup for an element's symbol. Elements with a custom `iconUri`
// (currently just Earth) render as an <img>; everything else uses its emoji.
function elemIconHTML(elem, px) {
  px = px || 18;
  if (elem && elem.iconUri) {
    return `<img src="${elem.iconUri}" width="${px}" height="${px}" ` +
           `style="vertical-align:-3px" alt="${elem.label || ''}">`;
  }
  return elem ? elem.icon : '';
}

// ─── Elemental sword upgrades ─────────────────────────────────────────────────
// Each owned elemental sword can be upgraded sequentially through the six ore
// tiers at the Blacksmith (see shop.js), exactly like elemental armor. An upgrade
// level (0–6, stored on player.swordUpgrades[id]) adds a flat +2 damage per level
// to that sword's elemental hit — Lv0 +0 … Lv6 +12 on top of the base 1d4 roll
// (see the swing in projectiles.js).

// Upgrade level (0–6) of an owned elemental sword; 0 if unowned / freshly dropped.
function swordUpgradeLevel(elemId) {
  return (player && player.swordUpgrades && player.swordUpgrades[elemId]) || 0;
}

// Flat bonus damage an elemental sword adds at its upgrade level = level × 2,
// matching the ore tier its last upgrade used (Grimsilver +2 … Voidsteel +12).
function elementalSwordBonus(elemId) {
  return swordUpgradeLevel(elemId) * 2;
}

// ─── Elemental armor ─────────────────────────────────────────────────────────
// One armor per element, forged at its home region's Blacksmith and then upgraded
// sequentially through the six ore tiers (see shop.js). An armor's upgrade level
// (0–6, stored on player.armorUpgrades[id]) drives two stats while it is worn:
//   • Physical defense = level × 2, matching the ore-armor bonus (+2/+4/+6/+8/+10/+12).
//     While worn this REPLACES the hero's plain flat armor (see damagePlayer).
//   • An elemental block % that steps up on the 1st / 3rd / 5th / 6th upgrades:
//       level 0 → 40%, levels 1–2 → 50%, levels 3–4 → 60%, level 5 → 70%,
//       level 6 → 80% blocked.
// Only the active armor (player.activeArmorElement) applies; non-matching damage
// is unaffected.

// Upgrade level (0–6) of an owned elemental armor; 0 if unowned / freshly forged.
function armorUpgradeLevel(elemId) {
  return (player && player.armorUpgrades && player.armorUpgrades[elemId]) || 0;
}

// Physical-armor value an elemental armor grants while worn = level × 2, matching
// the ore tier its last upgrade used (Grimsilver +2 … Voidsteel +12).
function elementalArmorPhys(elemId) {
  return armorUpgradeLevel(elemId) * 2;
}

// % of matching-element damage blocked at a given upgrade level. Steps up on the
// 1st / 3rd / 5th / 6th upgrade.
function elementalBlockPctForLevel(lv) {
  if (lv >= 6) return 80;
  if (lv >= 5) return 70;
  if (lv >= 3) return 60;
  if (lv >= 1) return 50;
  return 40;
}

// Block % of an owned armor (for UI), and the inverse "fraction that gets through"
// used to scale incoming damage.
function elementalArmorBlockPct(elemId) {
  return elementalBlockPctForLevel(armorUpgradeLevel(elemId));
}
function elementalArmorThrough(elemId) {
  return (100 - elementalArmorBlockPct(elemId)) / 100;   // 40/50/60/70/80% → 0.6/0.5/0.4/0.3/0.2
}

// Apply the active elemental armor's resistance to an incoming hit. Returns
// the (possibly reduced) damage and the element id that was resisted, or null
// if no reduction applied. The block fraction scales with the armor's upgrade
// level. Callers use the element id to color the damage number on a proc.
function applyElementalArmor(rawDmg, hitElement) {
  if (!hitElement || rawDmg <= 0) return { dmg: rawDmg, resisted: null };
  const active = player && player.activeArmorElement;
  if (active !== hitElement) return { dmg: rawDmg, resisted: null };
  const reduced = Math.max(1, Math.floor(rawDmg * elementalArmorThrough(active)));
  if (reduced >= rawDmg) return { dmg: rawDmg, resisted: null };
  return { dmg: reduced, resisted: hitElement };
}

// ─── Armor ability level-scaling ─────────────────────────────────────────────
// Every regional armor's exploration power scales with the same 0–6 upgrade
// level its defense and block % already use, instead of switching on all-or-
// nothing the moment the armor is worn. The individual curves stay with the
// systems they affect (movement in player.js, traversal in abilities.js,
// hazards and enemy senses in abilities.js / enemies.js / projectiles.js); this
// is the one place that says what "level" means to those curves.
//
// ONE step scale, 1–6, shared by all twelve. Level 0 — a freshly forged, never
// upgraded armor — reads as step 1 rather than as step 0, because a step of 0
// means "the ability does nothing", and an armor whose power only switches on
// after the first ore upgrade is an armor that appears broken when you forge
// it. The design table says the same thing where it bothers to mention level 0
// (Luminous: "3 seconds at level 0/1").
//
// 0 means the armor is NOT worn, so every caller can gate on the same value it
// scales by.
function armorAbilityStep(elemId) {
  if (!wearingElementalArmor(elemId)) return 0;
  return Math.max(1, Math.min(6, armorUpgradeLevel(elemId)));
}

// The shared movement curve for Fire, Water and Earth: the armors whose power is
// "cross this region's slow ground faster". Speed is a fraction of full walking
// speed and climbs +20% of it per level, so level 5 exactly matches open ground
// and level 6 is a genuine 120% sprint.
//
// This is DELIBERATELY a regression at low levels, confirmed with the owner:
// levels 1–4 are slower than the flat relief these armors grant today, and on a
// DUNE levels 1–2 are slower than crossing it with no armor at all. Fire is left
// that way on purpose — it buys quicksand safety and half the heat fill at the
// same time, so the slow start costs a player something they are still gaining
// elsewhere. Water and Earth have no unarmored comparison at all, since their
// tiles are impassable without the armor.
//
// ICE IS NOT ON THIS CURVE, and that is the one place the design moved after it
// was built. Snow-drift relief was the whole of what Ice armor did on that tile,
// so a curve starting below the unarmored trudge left a freshly forged armor
// strictly worse than no armor with nothing to show for it. Ice grants a flat
// full-speed drift walk instead, and its LEVEL scales the ice slide (iceSlideMs,
// abilities.js) — traction is the ice region's real signature anyway, and the
// player feels it on every step rather than only in the drifts.
const ARMOR_SPEED_PER_LEVEL = 0.20;

// Step interval for a tile this armor answers, or null when it does not apply
// (armor not worn). `baseMs` is the hero's unencumbered MOVE_MS.
function armorTerrainStepMs(elemId, baseMs) {
  const step = armorAbilityStep(elemId);
  if (!step) return null;
  return baseMs / (ARMOR_SPEED_PER_LEVEL * step);
}

// ─── Shadow: the Umbral Veil ─────────────────────────────────────────────────
// Shadow armor no longer teleports the hero through walls (Shadow Step is retired
// outright — see abilities.js). What it does instead is make the hero harder to
// notice: every distance an enemy uses to decide it has seen you shrinks by 20%
// at level 1, down to 80% at level 6, in even steps.
//
// "Every distance" is currently two, which is every distance the game actually
// has: the radius at which a dormant golem wakes (stepGolems, enemies.js) and the
// range at which a ranged enemy will open fire, including the dragon's breath
// fan (stepEnemyRanged, projectiles.js). Melee pursuit is deliberately NOT in the
// set — a melee enemy that has already closed to arm's length has not detected
// you at a distance, it has walked into you.
const SHADOW_VEIL_MIN_PCT = 20;   // level 1
const SHADOW_VEIL_MAX_PCT = 80;   // level 6

// Multiplier to apply to a detection distance: 1 with no Shadow armor worn,
// 0.8 at level 1, 0.2 at level 6.
function shadowDetectionScale() {
  const step = armorAbilityStep('shadow');
  if (!step) return 1;
  const pct = SHADOW_VEIL_MIN_PCT +
              ((SHADOW_VEIL_MAX_PCT - SHADOW_VEIL_MIN_PCT) * (step - 1)) / 5;
  return 1 - pct / 100;
}

// A detection distance with the veil applied. Safe to call from files that load
// before this one; callers pass their own unveiled number.
function veiledDetectionRange(base) {
  return base * shadowDetectionScale();
}
