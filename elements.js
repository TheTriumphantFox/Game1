// ─── Sword elemental traits ───────────────────────────────────────────────────
// Each element the player owns adds an extra 1d4 damage roll of that element
// to every successful sword swing. Multiple elements stack — a sword with
// Fire + Ice will deal base + 1d4 fire + 1d4 ice per hit.
//
// Elements are bought from the General Store (see shop.js / STORE_ITEMS) and
// stored on `player.swordElements` as a list of element ids. Each element has
// its own colour so the damage numbers visually distinguish their source.

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
  mana:      { id: 'mana',      label: 'Mana',      icon: '🔮', color: '#cc44ff' }
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

// Roll one 1d4 per equipped element. Returns a list of { element, dmg } so the
// caller can both subtract HP and spawn one damage number per element.
function rollSwordElementalDamage() {
  const out = [];
  const equipped = (player && player.swordElements) || [];
  for (const elemId of equipped) {
    const elem = SWORD_ELEMENTS[elemId];
    if (!elem) continue;
    out.push({ element: elem, dmg: 1 + Math.floor(Math.random() * 4) });   // 1d4
  }
  return out;
}

// Grant an elemental trait to the player's sword. Idempotent — re-granting
// the same element is a no-op.
function grantSwordElement(elemId) {
  if (!SWORD_ELEMENTS[elemId]) return false;
  player.swordElements = player.swordElements || [];
  if (!player.swordElements.includes(elemId)) {
    player.swordElements.push(elemId);
    return true;
  }
  return false;
}

// ─── Elemental armor ─────────────────────────────────────────────────────────
// One armor per element, forged at its home region's Blacksmith and then upgraded
// sequentially through the five ore tiers (see shop.js). An armor's upgrade level
// (0–5, stored on player.armorUpgrades[id]) drives two stats while it is worn:
//   • Physical defense = level × 2, matching the ore-armor bonus (+2/+4/+6/+8/+10).
//     While worn this REPLACES the hero's plain flat armor (see damagePlayer).
//   • An elemental block % that steps up on the 1st / 3rd / 5th upgrades:
//       level 0 → 50%, levels 1–2 → 60%, levels 3–4 → 70%, level 5 → 80% blocked.
// Only the active armor (player.activeArmorElement) applies; non-matching damage
// is unaffected.

// Upgrade level (0–5) of an owned elemental armor; 0 if unowned / freshly forged.
function armorUpgradeLevel(elemId) {
  return (player && player.armorUpgrades && player.armorUpgrades[elemId]) || 0;
}

// Physical-armor value an elemental armor grants while worn = level × 2, matching
// the ore tier its last upgrade used (Grimsilver +2 … Eclipsium +10).
function elementalArmorPhys(elemId) {
  return armorUpgradeLevel(elemId) * 2;
}

// % of matching-element damage blocked at a given upgrade level. Steps up on the
// 1st / 3rd / 5th upgrade.
function elementalBlockPctForLevel(lv) {
  if (lv >= 5) return 80;
  if (lv >= 3) return 70;
  if (lv >= 1) return 60;
  return 50;
}

// Block % of an owned armor (for UI), and the inverse "fraction that gets through"
// used to scale incoming damage.
function elementalArmorBlockPct(elemId) {
  return elementalBlockPctForLevel(armorUpgradeLevel(elemId));
}
function elementalArmorThrough(elemId) {
  return (100 - elementalArmorBlockPct(elemId)) / 100;   // 50/60/70/80% → 0.5/0.4/0.3/0.2
}

function grantArmorElement(elemId) {
  if (!SWORD_ELEMENTS[elemId]) return false;
  player.armorElements = player.armorElements || [];
  if (!player.armorElements.includes(elemId)) {
    player.armorElements.push(elemId);
    return true;
  }
  return false;
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
