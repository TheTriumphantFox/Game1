// ─── HUD updates and toast messages ───────────────────────────────────────────
// Stateless — reads from `player`, `currentMap()`, `mapsVisited`.

// Render one HP pie as inline SVG. `filled` red slices clockwise from the top,
// remaining slices black. Slices have a thin dark separator to make cuts visible.
function hpPieSVG(filled, total = 6, size = 16) {
  const cx = size / 2, cy = size / 2, r = size / 2 - 1;
  const sweep = (Math.PI * 2) / total;
  let slices = '';
  for (let i = 0; i < total; i++) {
    const a0 = i * sweep - Math.PI / 2;
    const a1 = (i + 1) * sweep - Math.PI / 2;
    const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    const color = i < filled ? '#e24b4a' : '#111';
    slices += `<path d="M${cx},${cy} L${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 0,1 ${x1.toFixed(2)},${y1.toFixed(2)} Z" fill="${color}" stroke="#000" stroke-width="0.6"/>`;
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="vertical-align:middle;margin-right:2px">${slices}</svg>`;
}

function updateHUD() {
  // Hearts: 6 HP per pie. Each slice goes black as that HP point is lost.
  let h = '';
  for (let i = 0; i < player.maxHp; i += 6) {
    const inSlot = Math.max(0, Math.min(6, player.hp - i));
    h += hpPieSVG(inSlot, 6);
  }
  document.getElementById('hearts').innerHTML = h;
  document.getElementById('rupees').textContent = player.rupees;
  document.getElementById('level').textContent = player.level;
  document.getElementById('xp').textContent = player.xp;
  document.getElementById('xpnext').textContent = player.xpNext;
  document.getElementById('roomName').textContent = currentMap().name;
  document.getElementById('mapcount').textContent = `${mapsVisited}`;
  document.getElementById('potions').textContent = player.potions || 0;

  // Active weapon highlight (sword / bow)
  ['sword', 'bow'].forEach(w => {
    document.getElementById('ws-' + w).className =
      'weapon-slot' + (player.weapon === w ? ' weapon-active' : '');
  });
  // The bow slot label changes to reflect the currently nocked elemental
  // arrow (or "Bow" when none is selected / out of arrows).
  const bowSlot = document.getElementById('ws-bow');
  if (bowSlot) {
    const ae = player.activeArrowElement;
    const stock = ae && player.arrows ? (player.arrows[ae] || 0) : 0;
    if (ae && stock > 0 && typeof SWORD_ELEMENTS !== 'undefined' && SWORD_ELEMENTS[ae]) {
      const elem = SWORD_ELEMENTS[ae];
      bowSlot.textContent = `🏹${elem.icon} ${elem.label} Arrow x${stock} [X]`;
    } else {
      bowSlot.textContent = '🏹 Bow [X]';
    }
  }
  // The [C] slot dynamically mirrors whichever inventory item is selected.
  const cSlot = document.getElementById('ws-bomb');
  if (cSlot && typeof RADIAL_RINGS !== 'undefined') {
    const invItems = RADIAL_RINGS[0].getItems();
    const sel = invItems.find(it => it.type === inventorySelectionType) || invItems[0];
    if (sel) cSlot.textContent = `${sel.icon} ${sel.label} [C]`;
    cSlot.className = 'weapon-slot' + ((sel && player.weapon === sel.type) ? ' weapon-active' : '');
  }
}

// Show a transient message in the message bar. dur=0 means permanent;
// any positive dur is currently treated as 5s for a consistent read time.
function showMsg(t, dur = 5000) {
  const el = document.getElementById('msg-bar');
  el.textContent = t;
  if (dur > 0) {
    setTimeout(() => {
      // Only clear if the message hasn't been overwritten in the meantime
      if (el.textContent === t) el.textContent = '';
    }, 5000);
  }
}
