// ─── Radial inventory menu ───────────────────────────────────────────────────
// Opens with 'I' (or Escape to close). Three concentric rings emerge from the
// player and contain:
//   • Inner   ring → Inventory items (Health Potion)
//   • Middle  ring → Armor
//   • Outer   ring → Weapons (Sword / Bow / Bomb)
//
// Hovering a slot highlights it; clicking activates its action. Clicking
// outside any slot closes the menu.

let radialMenuOpen = false;
let radialMenuOpenTime = 0;
// Only one ring is visible at a time; arrow keys navigate.
//   ▲ / ▼  → previous / next ring (inner → middle → outer, wraps)
//   ◀ / ▶  → previous / next item within the ring (wraps)
//   Enter  → activate selected item
let radialRingIndex = 0;
let radialItemIndex = 0;
// Persisted across menu opens: which inventory item the player picked last,
// stored by *type* (not index) so the selection survives items being filtered
// out of the inventory ring (e.g. running out of potions). `C` activates the
// inventory item with this type when it's currently in the ring.
let inventorySelectionType = 'bomb';
const radialMouse = { x: 0, y: 0 };

// Each ring is a function returning live items so the values track player state
// without us having to rebuild on every change.
// All rings share the same radius so swapping rings doesn't visibly resize.
const RADIAL_RADIUS = 150;

const RADIAL_RINGS = [
  { name: 'inventory', radius: RADIAL_RADIUS, getItems: () => {
      const items = [];
      // Potions only listed when the player actually carries one.
      if ((player.potions || 0) > 0) {
        items.push({ type: 'potion', icon: '🧪', label: 'Health Potion',
          val: () => 'x' + (player.potions || 0),
          action: () => usePotion() });
      }
      // Bombs are an infinite resource and stay listed.
      items.push({ type: 'bomb',   icon: '💣', label: 'Bomb',
        val: () => '∞',
        dmg: () => String(7 + (player.swordLevel || 1)),
        action: () => { player.weapon = 'bomb'; placePlayerBomb(); } });
      return items;
    }},
  { name: 'armor', radius: RADIAL_RADIUS, getItems: () => {
      // No armor → nothing to show. Empty rings are skipped during navigation.
      if (!player.armor || player.armor <= 0) return [];
      return [{ type: 'armor', icon: '🛡', label: 'Armor',
        val: () => '+' + (player.armor || 0),
        action: null }];
    }},
  // Melee — base sword + each owned elemental sword.
  { name: 'swords', radius: RADIAL_RADIUS, getItems: () => {
      const lv = player.swordLevel || 1;
      const items = [
        { type: 'sword', icon: '⚔', label: 'Sword',
          val: () => 'Lv' + (player.swordLevel || 1),
          dmg: () => `${lv}-${lv + 2}`,
          action: () => { player.weapon = 'sword'; player.activeSwordElement = null; },
          isActive: () => player.weapon === 'sword' && !player.activeSwordElement }
      ];
      const owned = player.swordElements || [];
      for (const id of owned) {
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
  // Ranged — base bow + one slot per elemental arrow type currently in stock.
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
      for (const id of Object.keys(arrows)) {
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
    }}
];

// Index into the current inventory ring items of the saved selection type,
// or 0 if that type isn't currently listed.
function inventoryIndexForSelection() {
  const items = RADIAL_RINGS[0].getItems();
  const idx = items.findIndex(it => it.type === inventorySelectionType);
  return idx >= 0 ? idx : 0;
}

function toggleRadialMenu() {
  if (radialMenuOpen) { closeRadialMenu(); return; }
  radialMenuOpen = true;
  radialMenuOpenTime = Date.now();
  // Find the first ring with items so we never open on an empty ring.
  radialRingIndex = 0;
  for (let i = 0; i < RADIAL_RINGS.length; i++) {
    if (RADIAL_RINGS[i].getItems().length > 0) { radialRingIndex = i; break; }
  }
  radialItemIndex = (radialRingIndex === 0) ? inventoryIndexForSelection() : 0;
  if (typeof clearAllKeys === 'function') clearAllKeys();
}

function closeRadialMenu() {
  if (!radialMenuOpen) return;
  radialMenuOpen = false;
  if (typeof clearAllKeys === 'function') clearAllKeys();
}

// ─── Keyboard navigation ──────────────────────────────────────────────────────
function radialNavRing(delta) {
  if (!radialMenuOpen) return;
  const N = RADIAL_RINGS.length;
  // Skip rings with zero items.
  let idx = radialRingIndex;
  for (let i = 0; i < N; i++) {
    idx = ((idx + delta) % N + N) % N;
    if (RADIAL_RINGS[idx].getItems().length > 0) break;
  }
  radialRingIndex = idx;
  radialItemIndex = (radialRingIndex === 0) ? inventoryIndexForSelection() : 0;
  radialMenuOpenTime = Date.now();   // replay emerge animation for the new ring
}

function radialNavItem(delta) {
  if (!radialMenuOpen) return;
  const items = RADIAL_RINGS[radialRingIndex].getItems();
  const N = items.length;
  if (N === 0) return;
  radialItemIndex = ((radialItemIndex + delta) % N + N) % N;
  // Persist inventory-ring selection (by type) so the C key works across
  // any future changes to the inventory list.
  if (radialRingIndex === 0) inventorySelectionType = items[radialItemIndex].type;
}

function radialActivateSelected() {
  if (!radialMenuOpen) return;
  const items = RADIAL_RINGS[radialRingIndex].getItems();
  const item = items[radialItemIndex];
  if (item && item.action) {
    item.action();
    updateHUD();
  }
}

// Called by the C key in the game loop. Returns ms of cooldown so the gameplay
// timer can throttle hold-to-spam (matches the old bomb behaviour).
function useSelectedInventoryItem() {
  const items = RADIAL_RINGS[0].getItems();
  // Prefer the persisted-by-type selection; if that item isn't currently in
  // the inventory ring (e.g. potion ran out), fall back to the first listed
  // item so the C key isn't silently dead. The HUD's [C] slot already does
  // the same fallback so behaviour stays consistent.
  let item = items.find(it => it.type === inventorySelectionType);
  if (!item) item = items[0];
  if (!item) return 0;
  if (item.type === 'potion') {
    const before = player.potions;
    usePotion();
    return (before > player.potions) ? 600 : 0;
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
  const ring = RADIAL_RINGS[radialRingIndex];
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
    if (radialRingIndex === 0) inventorySelectionType = slot.item.type;
    if (slot.item.action) slot.item.action();
    updateHUD();
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
  const ring = RADIAL_RINGS[radialRingIndex];

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
    // Each weapon slot can declare its own "active" predicate so we can
    // distinguish e.g. base-sword vs Fire-sword vs Ice-sword.
    const activeWeapon = slot.ring === 'weapons' &&
      (typeof slot.item.isActive === 'function'
        ? slot.item.isActive()
        : player.weapon === slot.item.type);

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

  // Ring name (e.g. "INVENTORY")
  ctx.font = 'bold 13px monospace';
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#000';
  ctx.strokeText(ring.name.toUpperCase(), pcx, pcy - 14);
  ctx.fillStyle = '#ffd070';
  ctx.fillText(ring.name.toUpperCase(), pcx, pcy - 14);

  // Ring index (1/3)
  ctx.font = '10px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText(`${radialRingIndex + 1}/${RADIAL_RINGS.length}`, pcx, pcy);

  // Selected item label
  const selItem = ring.getItems()[radialItemIndex];
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
  ctx.fillText('▲▼ ring   ◀▶ item   Enter select   V/Esc close', PW / 2, PH - 24);

  ctx.restore();
}
