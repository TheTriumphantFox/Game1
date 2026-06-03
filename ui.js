// ─── HUD updates and toast messages ───────────────────────────────────────────
// Stateless — reads from `player`, `currentMap()`, `mapsVisited`.

// Render one HP heart as inline SVG. `filled` red wedges clockwise from the top,
// remaining wedges black. Radial slices are clipped to a heart silhouette so the
// 6 segments still divide angularly while the overall shape reads as a heart.
let _hpHeartId = 0;
function hpPieSVG(filled, total = 6, size = 16) {
  const id = `hpclip${++_hpHeartId}`;
  // Heart silhouette in a 24x24 reference box; wedge center sits at its visual
  // middle so the top wedge runs through the lobe dip.
  const heart = 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41 .81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z';
  const cx = 12, cy = 12, r = 24;
  const sweep = (Math.PI * 2) / total;
  let slices = '';
  for (let i = 0; i < total; i++) {
    const a0 = i * sweep - Math.PI / 2;
    const a1 = (i + 1) * sweep - Math.PI / 2;
    const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    const color = i < filled ? '#e24b4a' : '#111';
    slices += `<path d="M${cx},${cy} L${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 0,1 ${x1.toFixed(2)},${y1.toFixed(2)} Z" fill="${color}" stroke="#000" stroke-width="0.5"/>`;
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" style="vertical-align:middle;margin-right:2px"><defs><clipPath id="${id}"><path d="${heart}"/></clipPath></defs><g clip-path="url(#${id})">${slices}</g><path d="${heart}" fill="none" stroke="#000" stroke-width="0.8"/></svg>`;
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

  // Active weapon highlight (sword / bow)
  ['sword', 'bow'].forEach(w => {
    document.getElementById('ws-' + w).className =
      'weapon-slot' + (player.weapon === w ? ' weapon-active' : '');
  });
  // The sword slot label changes to reflect the currently wielded elemental
  // sword (or the plain "Sword" when none is equipped). Mirrors the bow label
  // logic below.
  const swordSlot = document.getElementById('ws-sword');
  if (swordSlot) {
    const se = player.activeSwordElement;
    if (se && typeof SWORD_ELEMENTS !== 'undefined' && SWORD_ELEMENTS[se]) {
      const elem = SWORD_ELEMENTS[se];
      swordSlot.textContent = `⚔️${elem.icon} ${elem.label} Sword [Z]`;
    } else {
      swordSlot.textContent = '⚔️ Sword [Z]';
    }
  }
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
  // The [C] slot mirrors the C-bound consumable wherever it currently lives
  // (Bomb in the weapons ring, Potion in the inventory ring); falls back to Bomb.
  const cSlot = document.getElementById('ws-bomb');
  if (cSlot && typeof radialFindItem === 'function') {
    const sel = radialFindItem(inventorySelectionType) || radialFindItem('bomb');
    if (sel) {
      cSlot.textContent = `${sel.icon} ${sel.label} [C]`;
      cSlot.className = 'weapon-slot' + ((player.weapon === sel.type) ? ' weapon-active' : '');
    }
  }
  // Active elemental armor slot — only visible while an elemental armor is
  // actually worn. Hidden completely otherwise (no flat-armor placeholder).
  const armorSlot = document.getElementById('ws-armor');
  if (armorSlot) {
    const ae = player.activeArmorElement;
    if (ae && typeof SWORD_ELEMENTS !== 'undefined' && SWORD_ELEMENTS[ae]) {
      const elem = SWORD_ELEMENTS[ae];
      armorSlot.textContent = `🛡${elem.icon} ${elem.label} (−50%)`;
      armorSlot.className = 'weapon-slot weapon-active';
      armorSlot.style.display = '';
    } else {
      armorSlot.style.display = 'none';
    }
  }
  // Interaction hint slot — appears after [C] only when SPACE can interact with
  // something nearby (talk/shop in town, or open an adjacent chest).
  const iSlot = document.getElementById('ws-interact');
  if (iSlot && typeof interactionHint === 'function') {
    const hint = interactionHint();
    if (hint) { iSlot.textContent = hint; iSlot.style.display = ''; }
    else      { iSlot.style.display = 'none'; }
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

// Show a map/area message in the large top-third banner. Used for all
// map-related events (entering an area, a village awakening, revealing a cave,
// etc.). Displays for the typical read period (5s) then fades out.
let _mapBannerTimer = null;
function showMapMsg(t) {
  const el = document.getElementById('map-banner');
  if (!el) { showMsg(t); return; }   // fallback if the overlay isn't present
  el.textContent = t;
  el.classList.add('show');
  if (_mapBannerTimer) clearTimeout(_mapBannerTimer);
  _mapBannerTimer = setTimeout(() => {
    // Only hide if this exact message is still showing (not overwritten since)
    if (el.textContent === t) el.classList.remove('show');
  }, 5000);
}
