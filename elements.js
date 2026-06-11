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
  earth:     { id: 'earth',     label: 'Earth',     icon: '🧱', color: '#8a5a2a' },
  air:       { id: 'air',       label: 'Air',       icon: '💨', color: '#cccccc' },
  luminous:  { id: 'luminous',  label: 'Luminous',  icon: '✨', color: '#ffee66' },
  necrotic:  { id: 'necrotic',  label: 'Necrotic',  icon: '💀', color: '#aa66dd' },
  poison:    { id: 'poison',    label: 'Poison',    icon: '☠',  color: '#88cc44' },
  mana:      { id: 'mana',      label: 'Mana',      icon: '🔮', color: '#cc44ff' }
};

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
// One armor per element. When equipped (player.activeArmorElement), incoming
// damage of the matching element is multiplied by ELEMENTAL_ARMOR_REDUCTION,
// floored to a minimum of 1. Non-matching damage is unaffected.
const ELEMENTAL_ARMOR_REDUCTION = 0.5;

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
// if no reduction applied. Callers use the element id to color the damage
// number so the player sees their armor proc.
function applyElementalArmor(rawDmg, hitElement) {
  if (!hitElement || rawDmg <= 0) return { dmg: rawDmg, resisted: null };
  const active = player && player.activeArmorElement;
  if (active !== hitElement) return { dmg: rawDmg, resisted: null };
  const reduced = Math.max(1, Math.floor(rawDmg * ELEMENTAL_ARMOR_REDUCTION));
  if (reduced >= rawDmg) return { dmg: rawDmg, resisted: null };
  return { dmg: reduced, resisted: hitElement };
}
