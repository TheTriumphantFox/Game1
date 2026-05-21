// ─── Sword elemental traits ───────────────────────────────────────────────────
// Each element the player owns adds an extra 1d4 damage roll of that element
// to every successful sword swing. Multiple elements stack — a sword with
// Fire + Ice will deal base + 1d4 fire + 1d4 ice per hit.
//
// Elements are bought from the General Store (see shop.js / STORE_ITEMS) and
// stored on `player.swordElements` as a list of element ids. Each element has
// its own colour so the damage numbers visually distinguish their source.

const SWORD_ELEMENTS = {
  poison:   { id: 'poison',   label: 'Poison',   icon: '☠',  color: '#88cc44' },
  necrotic: { id: 'necrotic', label: 'Necrotic', icon: '💀', color: '#aa66dd' },
  fire:     { id: 'fire',     label: 'Fire',     icon: '🔥', color: '#ff6622' },
  ice:      { id: 'ice',      label: 'Ice',      icon: '❄',  color: '#88ddff' },
  water:    { id: 'water',    label: 'Water',    icon: '💧', color: '#3a88ff' },
  wind:     { id: 'wind',     label: 'Wind',     icon: '💨', color: '#cccccc' },
  luminous: { id: 'luminous', label: 'Luminous', icon: '✨', color: '#ffee66' }
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
