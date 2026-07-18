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
