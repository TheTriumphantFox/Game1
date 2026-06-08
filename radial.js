// ─── Radial inventory menu ───────────────────────────────────────────────────
// Opens with 'V' (or Escape to close). One ring is visible at a time; the player
// cycles five flat rings and picks an item within each:
//
//   Rings (cycle ▲ prev / ▼ next, empty rings skipped):
//     • swords     → base sword + each owned elemental sword
//     • arrows     → bow + plain & elemental arrows
//     • consumables→ Bomb + Health Potion
//     • drops      → passive pickups (rupees, herbals, fangs, …)
//     • armor      → Armor (only when the player has some)
//
//   ◀ / ▶  → previous / next item within the current ring (wraps)
//   ▲ / ▼  → previous / next ring
//
// Navigating auto-equips the highlighted weapon — no Enter needed. Consumables
// (potion drink / bomb drop) are skipped by auto-equip and fired only on an
// explicit Enter / click, or via the C quick-use key.

let radialMenuOpen = false;
let radialMenuOpenTime = 0;
let radialRingIndex = 0;     // index into RADIAL_RINGS
let radialItemIndex = 0;     // selected item within the current ring
// The consumable bound to the C quick-use key + HUD [C] slot, stored by *type*
// so it survives the item going out of stock. Defaults to Bomb; updated whenever
// the player highlights a consumable in any ring.
let inventorySelectionType = 'bomb';
// Per-ring highlight memory, keyed by ring name and stored by item type so
// switching rings (or reopening the menu) restores the last item chosen there
// instead of snapping back to index 0.
const ringSelectionType = {};

const radialMouse = { x: 0, y: 0 };

// All rings share one radius so swapping rings doesn't visibly resize.
const RADIAL_RADIUS = 150;

// Passive drop items (rupees, herbals, monster trophies). They have no action —
// they're displayed for at-a-glance inventory tracking. Kept in one table so the
// drops ring stays a single source of truth for "everything off the ground."
const PASSIVE_DROPS = [
  { type: 'rupees',  icon: '💎', label: 'Rupees',  key: 'rupees'  },
  { type: 'herbals', icon: '🌿', label: 'Herbal',  key: 'herbals' },
  { type: 'fangs',   icon: '🦷', label: 'Fang',    key: 'fangs'   },
  { type: 'fingers', icon: '🫳', label: 'Finger',  key: 'fingers' },
  { type: 'bones',   icon: '🦴', label: 'Bone',    key: 'bones'   },
  { type: 'wings',   icon: '🪶', label: 'Wing',    key: 'wings'   },
  { type: 'organs',  icon: '🫀', label: 'Organ',   key: 'organs'  },
  { type: 'feathers',icon: '🪶', label: 'Feather', key: 'feathers'},
  { type: 'bonemeal',icon: '🧂', label: 'Bone Meal', key: 'bonemeal' },
];

// Each ring is a function returning live items so values track player state
// without us having to rebuild on every change.
const RADIAL_RINGS = [
  // ── Swords: base sword + each owned elemental sword ──────────────────────────
  { name: 'swords', radius: RADIAL_RADIUS, getItems: () => {
      const lv = player.swordLevel || 1;
      const items = [
        { type: 'sword', icon: '⚔', label: 'Sword',
          val: () => 'Lv' + (player.swordLevel || 1),
          dmg: () => `${lv}-${lv + 2}`,
          action: () => { player.weapon = 'sword'; player.activeSwordElement = null; },
          isActive: () => player.weapon === 'sword' && !player.activeSwordElement }
      ];
      for (const id of (player.swordElements || [])) {
        const elem = (typeof SWORD_ELEMENTS !== 'undefined') ? SWORD_ELEMENTS[id] : null;
        if (!elem) continue;
        items.push({
          type: 'sword_' + id,
          icon: elem.icon,
          label: elem.label + ' Sword',
          val: () => 'Lv' + (player.swordLevel || 1),
          dmg: () => `${lv}-${lv + 2}+${elem.icon}1-4`,
          action: () => { player.weapon = 'sword'; player.activeSwordElement = id; },
          isActive: () => player.weapon === 'sword' && player.activeSwordElement === id
        });
      }
      return items;
    }},
  // ── Bow / arrows: base bow + plain stock + one slot per elemental arrow ───────
  { name: 'arrows', radius: RADIAL_RADIUS, getItems: () => {
      const bowDmg = (player.bowLevel || 1) * 2 + 1;
      const items = [
        { type: 'bow', icon: '🏹', label: 'Bow',
          val: () => 'Lv' + (player.bowLevel || 1),
          dmg: () => String(bowDmg),
          action: () => { player.weapon = 'bow'; player.activeArrowElement = null; },
          isActive: () => player.weapon === 'bow' && !player.activeArrowElement }
      ];
      const arrows = player.arrows || {};
      if ((arrows.plain || 0) > 0) {
        items.push({ type: 'bow_plain', icon: '➳', label: 'Plain Arrow',
          val: () => 'x' + (player.arrows.plain || 0),
          dmg: () => String(bowDmg),
          action: () => { player.weapon = 'bow'; player.activeArrowElement = null; },
          isActive: () => player.weapon === 'bow' && !player.activeArrowElement });
      }
      for (const id of Object.keys(arrows)) {
        if (id === 'plain') continue;
        const count = arrows[id] || 0;
        if (count <= 0) continue;
        const elem = (typeof SWORD_ELEMENTS !== 'undefined') ? SWORD_ELEMENTS[id] : null;
        if (!elem) continue;
        items.push({
          type: 'bow_' + id,
          icon: '🏹' + elem.icon,
          label: elem.label + ' Arrow',
          val: () => 'x' + (player.arrows[id] || 0),
          dmg: () => `${bowDmg}+${elem.icon}1-4`,
          action: () => { player.weapon = 'bow'; player.activeArrowElement = id; },
          isActive: () => player.weapon === 'bow' && player.activeArrowElement === id
        });
      }
      return items;
    }},
  // ── Consumables: every consumable except arrows (Bomb + Health Potion) ───────
  { name: 'consumables', radius: RADIAL_RADIUS, getItems: () => {
      const items = [
        { type: 'bomb', icon: '💣', label: 'Bomb',
          val: () => '∞',
          dmg: () => String(7 + (player.swordLevel || 1)),
          consumable: true,
          action: () => { player.weapon = 'bomb'; placePlayerBomb(); },
          isActive: () => player.weapon === 'bomb' }
      ];
      if ((player.potions || 0) > 0) {
        items.push({ type: 'potion', icon: '🧪', label: 'Health Potion',
          val: () => 'x' + (player.potions || 0),
          consumable: true,
          action: () => usePotion() });
      }
      if ((player.medPotions || 0) > 0) {
        items.push({ type: 'medpotion', icon: '🍶', label: 'Medium Potion',
          val: () => 'x' + (player.medPotions || 0),
          consumable: true,
          action: () => useMedPotion() });
      }
      return items;
    }},
  // ── Drops: passive pickups the player has collected ──────────────────────────
  { name: 'drops', radius: RADIAL_RADIUS, getItems: () => {
      const items = [];
      for (const d of PASSIVE_DROPS) {
        const n = player[d.key] || 0;
        if (n <= 0) continue;
        items.push({ type: d.type, icon: d.icon, label: d.label,
          val: () => 'x' + (player[d.key] || 0),
          action: null });
      }
      return items;
    }},
  // ── Armor: base armor pad + each owned elemental armor ──────────────────────
  // The base entry just summarizes flat armor; the elemental entries are
  // equippable — picking one halves incoming damage of that element.
  { name: 'armor', radius: RADIAL_RADIUS, getItems: () => {
      const items = [];
      if (player.armor && player.armor > 0) {
        items.push({ type: 'armor', icon: '🛡', label: 'Armor',
          val: () => '+' + (player.armor || 0),
          action: () => { player.activeArmorElement = null; },
          isActive: () => !player.activeArmorElement });
      } else {
        // Always offer an "unequip" slot so the player can drop their
        // elemental armor even without any flat armor points.
        items.push({ type: 'armor', icon: '🛡', label: 'No Armor',
          val: () => '—',
          action: () => { player.activeArmorElement = null; },
          isActive: () => !player.activeArmorElement });
      }
      for (const id of (player.armorElements || [])) {
        const elem = (typeof SWORD_ELEMENTS !== 'undefined') ? SWORD_ELEMENTS[id] : null;
        if (!elem) continue;
        items.push({
          type: 'armor_' + id,
          icon: '🛡' + elem.icon,
          label: elem.label + ' Armor',
          val: () => '−50% ' + elem.icon,
          action: () => { player.activeArmorElement = id; },
          isActive: () => player.activeArmorElement === id
        });
      }
      return items;
    }},
];

// ─── Current ring helpers ──────────────────────────────────────────────────────
function radialCurrentRing()  { return RADIAL_RINGS[radialRingIndex]; }
function radialCurrentItems() { return radialCurrentRing().getItems(); }
function radialCurrentName()  { return radialCurrentRing().name; }

// ─── Selection memory ──────────────────────────────────────────────────────────
// Index into `items` of the ring's saved selection type, or 0 if absent.
function indexForSelectionName(items, name) {
  const idx = items.findIndex(it => it.type === ringSelectionType[name]);
  return idx >= 0 ? idx : 0;
}
// Remember the highlighted item for its ring, and bind the C quick-use key when
// it's a consumable (so C keeps firing whatever consumable was last selected).
function rememberSelection(name, item) {
  if (!item) return;
  ringSelectionType[name] = item.type;
  if (item.consumable) inventorySelectionType = item.type;
}

// Find an item by type across all rings (used by the C key / HUD [C] slot).
function radialFindItem(type) {
  for (const ring of RADIAL_RINGS) {
    const it = ring.getItems().find(i => i.type === type);
    if (it) return it;
  }
  return null;
}

function toggleRadialMenu() {
  if (radialMenuOpen) { closeRadialMenu(); return; }
  radialMenuOpen = true;
  radialMenuOpenTime = Date.now();
  // Reopen on the last-used ring; if it's since emptied, fall back to the first
  // ring that still has items so we never open on an empty ring.
  if (RADIAL_RINGS[radialRingIndex].getItems().length === 0) {
    for (let i = 0; i < RADIAL_RINGS.length; i++) {
      if (RADIAL_RINGS[i].getItems().length > 0) { radialRingIndex = i; break; }
    }
  }
  const items = RADIAL_RINGS[radialRingIndex].getItems();
  radialItemIndex = indexForSelectionName(items, RADIAL_RINGS[radialRingIndex].name);
  if (typeof clearAllKeys === 'function') clearAllKeys();
}

function closeRadialMenu() {
  if (!radialMenuOpen) return;
  radialMenuOpen = false;
  if (typeof clearAllKeys === 'function') clearAllKeys();
}

// ─── Keyboard navigation ──────────────────────────────────────────────────────
// Cycle to the next/previous non-empty ring (▲ = -1, ▼ = +1).
function radialNavRing(delta) {
  if (!radialMenuOpen) return;
  const N = RADIAL_RINGS.length;
  let idx = radialRingIndex;
  for (let i = 0; i < N; i++) {
    idx = ((idx + delta) % N + N) % N;
    if (RADIAL_RINGS[idx].getItems().length > 0) break;
  }
  radialRingIndex = idx;
  const items = RADIAL_RINGS[idx].getItems();
  radialItemIndex = indexForSelectionName(items, RADIAL_RINGS[idx].name);
  radialMenuOpenTime = Date.now();   // replay emerge animation for the new ring
  radialAutoPick();
}

function radialNavItem(delta) {
  if (!radialMenuOpen) return;
  const items = radialCurrentItems();
  const N = items.length;
  if (N === 0) return;
  radialItemIndex = ((radialItemIndex + delta) % N + N) % N;
  rememberSelection(radialCurrentName(), items[radialItemIndex]);
  radialAutoPick();
}

// Auto-equip the highlighted item so navigating it "picks" it without Enter.
// Consumables (potions) and world-affecting items (bombs) are excluded — they'd
// be used up just by scrolling past — so they stay merely selected and are fired
// only on an explicit Enter/click or the C key.
function radialAutoPick() {
  const item = radialCurrentItems()[radialItemIndex];
  if (item && item.action && !item.consumable) {
    item.action();
    updateHUD();
  }
}

function radialActivateSelected() {
  if (!radialMenuOpen) return;
  const item = radialCurrentItems()[radialItemIndex];
  if (item && item.action) {
    item.action();
    updateHUD();
  }
}

// Called by the C key in the game loop. Returns ms of cooldown so the gameplay
// timer can throttle hold-to-spam (matches the old bomb behaviour).
function useSelectedInventoryItem() {
  // Resolve the C-bound consumable; fall back to Bomb so the key is never dead.
  let item = radialFindItem(inventorySelectionType);
  if (!item || !item.consumable) item = radialFindItem('bomb');
  if (!item) return 0;
  if (item.type === 'potion') {
    const before = player.potions;
    usePotion();
    return (before > player.potions) ? 600 : 0;
  }
  if (item.type === 'medpotion') {
    const before = player.medPotions;
    useMedPotion();
    return (before > player.medPotions) ? 600 : 0;
  }
  if (item.type === 'bomb') {
    player.weapon = 'bomb';
    placePlayerBomb();
    return 1200;
  }
  return 0;
}

// Smooth emerge: 0 → 1 over 250 ms with a cubic ease-out.
function radialEase() {
  const t = Math.min(1, (Date.now() - radialMenuOpenTime) / 250);
  return 1 - Math.pow(1 - t, 3);
}

// Compute slot positions for the active ring only.
function radialSlots() {
  if (!radialMenuOpen) return [];
  const ease = radialEase();
  const pcx = (player.renderX - camC + 0.5) * TILE_PX;
  const pcy = (player.renderY - camR + 0.5) * TILE_PX;
  const ring = radialCurrentRing();
  const items = ring.getItems();
  const r = ring.radius * ease;
  const N = items.length;
  const slots = [];
  for (let i = 0; i < N; i++) {
    const angle = -Math.PI / 2 + (i / N) * Math.PI * 2;
    slots.push({
      x: pcx + Math.cos(angle) * r,
      y: pcy + Math.sin(angle) * r,
      radius: 28 * ease,
      item: items[i],
      ring: ring.name,
      index: i,
      selected: i === radialItemIndex
    });
  }
  return slots;
}

function radialHoveredSlot() {
  if (!radialMenuOpen) return null;
  for (const slot of radialSlots()) {
    const dx = radialMouse.x - slot.x, dy = radialMouse.y - slot.y;
    if (dx * dx + dy * dy <= slot.radius * slot.radius) return slot;
  }
  return null;
}

// Mouse listeners — track position and resolve clicks to slot actions.
function radialOnMouseMove(e) {
  if (!radialMenuOpen) return;
  const rect = canvas.getBoundingClientRect();
  radialMouse.x = e.clientX - rect.left;
  radialMouse.y = e.clientY - rect.top;
}

function radialOnClick(e) {
  if (!radialMenuOpen) return;
  const rect = canvas.getBoundingClientRect();
  radialMouse.x = e.clientX - rect.left;
  radialMouse.y = e.clientY - rect.top;
  const slot = radialHoveredSlot();
  if (slot) {
    radialItemIndex = slot.index;   // sync keyboard selection to mouse
    rememberSelection(radialCurrentName(), slot.item);
    if (slot.item.action) { slot.item.action(); updateHUD(); }
  } else {
    closeRadialMenu();
  }
}

canvas.addEventListener('mousemove', radialOnMouseMove);
canvas.addEventListener('click',     radialOnClick);

// ─── Renderer ─────────────────────────────────────────────────────────────────
function drawRadialMenu() {
  if (!radialMenuOpen) return;
  const ease = radialEase();
  const pcx = (player.renderX - camC + 0.5) * TILE_PX;
  const pcy = (player.renderY - camR + 0.5) * TILE_PX;
  const ring = radialCurrentRing();

  ctx.save();

  // Dim the world
  ctx.fillStyle = `rgba(0, 0, 0, ${0.45 * ease})`;
  ctx.fillRect(0, 0, PW, PH);

  // Single dashed guide for the active ring
  ctx.strokeStyle = `rgba(255, 220, 120, ${0.35 * ease})`;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.arc(pcx, pcy, ring.radius * ease, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  const hovered = radialHoveredSlot();
  const slots = radialSlots();

  for (const slot of slots) {
    const isHover    = hovered === slot;
    const isSelected = slot.selected;
    // Each weapon item declares its own "active" predicate so we can distinguish
    // base-sword vs Fire-sword, bow vs arrow type, equipped bomb, etc.
    const activeWeapon = typeof slot.item.isActive === 'function'
      ? slot.item.isActive()
      : false;

    // Selection / hover glow
    if (isSelected || isHover) {
      const g = ctx.createRadialGradient(slot.x, slot.y, 0, slot.x, slot.y, slot.radius * 2.4);
      g.addColorStop(0, 'rgba(255, 220, 120, 0.65)');
      g.addColorStop(1, 'rgba(255, 220, 120, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(slot.x - slot.radius * 2.4, slot.y - slot.radius * 2.4,
                   slot.radius * 4.8, slot.radius * 4.8);
    }

    // Slot disk
    ctx.fillStyle = activeWeapon ? '#3a5a2a'
                   : isSelected   ? '#2a4a2a'
                   : isHover      ? '#1c321c'
                                  : '#0e1a0e';
    ctx.beginPath();
    ctx.arc(slot.x, slot.y, slot.radius, 0, Math.PI * 2);
    ctx.fill();
    // Border
    ctx.strokeStyle = activeWeapon ? '#a0ff66'
                     : isSelected   ? '#ffd070'
                     : isHover      ? '#cca050'
                                    : '#4a6a4a';
    ctx.lineWidth = (isSelected || activeWeapon) ? 3 : 2;
    ctx.stroke();

    // Icon
    ctx.fillStyle = '#fff';
    ctx.font = `${Math.round(slot.radius * 1.05)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(slot.item.icon, slot.x, slot.y);

    // Value badge below
    const v = slot.item.val();
    if (v) {
      ctx.font = 'bold 12px monospace';
      const w = Math.ceil(ctx.measureText(v).width) + 10;
      const bx = slot.x, by = slot.y + slot.radius + 12;
      ctx.fillStyle = '#0a1a0a';
      ctx.fillRect(bx - w / 2, by - 8, w, 16);
      ctx.strokeStyle = '#4a6a4a';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx - w / 2, by - 8, w, 16);
      ctx.fillStyle = '#ffcc44';
      ctx.fillText(v, bx, by);
    }
    // Damage badge (only for items that deal damage)
    if (typeof slot.item.dmg === 'function') {
      const d = slot.item.dmg();
      if (d) {
        ctx.font = 'bold 11px monospace';
        const label = '⚔' + d;
        const w = Math.ceil(ctx.measureText(label).width) + 10;
        const bx = slot.x, by = slot.y + slot.radius + 30;
        ctx.fillStyle = '#2a0a0a';
        ctx.fillRect(bx - w / 2, by - 8, w, 16);
        ctx.strokeStyle = '#6a2a2a';
        ctx.lineWidth = 1;
        ctx.strokeRect(bx - w / 2, by - 8, w, 16);
        ctx.fillStyle = '#ff7a7a';
        ctx.fillText(label, bx, by);
      }
    }
  }

  // ── Center: ring name + chevrons + selected-item label ────────────────────
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Up chevron
  ctx.font = 'bold 14px monospace';
  ctx.fillStyle = 'rgba(255,220,120,0.85)';
  ctx.fillText('▲', pcx, pcy - 32);

  // Ring name (e.g. "SWORDS")
  ctx.font = 'bold 13px monospace';
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#000';
  ctx.strokeText(ring.name.toUpperCase(), pcx, pcy - 14);
  ctx.fillStyle = '#ffd070';
  ctx.fillText(ring.name.toUpperCase(), pcx, pcy - 14);

  // Ring index (1/5)
  ctx.font = '10px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText(`${radialRingIndex + 1}/${RADIAL_RINGS.length}`, pcx, pcy);

  // Selected item label
  const selItem = radialCurrentItems()[radialItemIndex];
  if (selItem) {
    ctx.font = 'bold 12px monospace';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.strokeText(selItem.label, pcx, pcy + 16);
    ctx.fillStyle = '#fff';
    ctx.fillText(selItem.label, pcx, pcy + 16);
  }

  // Down chevron
  ctx.font = 'bold 14px monospace';
  ctx.fillStyle = 'rgba(255,220,120,0.85)';
  ctx.fillText('▼', pcx, pcy + 34);

  // Bottom-of-screen hint
  ctx.font = '11px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.textAlign = 'center';
  ctx.fillText('▲▼ ring   ◀▶ item   Enter use   V/Esc close', PW / 2, PH - 24);

  ctx.restore();
}
