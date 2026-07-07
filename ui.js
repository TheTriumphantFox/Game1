// ─── HUD updates and toast messages ───────────────────────────────────────────
// Reads from `player`, `currentMap()`, `mapsVisited`. updateHUD runs every
// frame, so it caches its DOM refs and per-section input signatures and only
// touches the DOM when a section's inputs actually changed — innerHTML/
// textContent writes force style recalc and SVG reparses even for identical
// values.

// Render one HP heart as inline SVG, divided into `total` angular wedges. HP is
// spent from the top-right wedge clockwise, so the empty wedges are the first
// (total - filled) going clockwise from the top, and the `filled` remaining HP
// keeps the rest red. Radial slices are clipped to a heart silhouette so the
// segments still divide angularly while the overall shape reads as a heart.
let _hpHeartId = 0;
function hpPieSVG(filled, total = 6, size = 16, fillColor = '#e24b4a') {
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
    const color = i >= total - filled ? fillColor : '#111';
    slices += `<path d="M${cx},${cy} L${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 0,1 ${x1.toFixed(2)},${y1.toFixed(2)} Z" fill="${color}" stroke="#000" stroke-width="0.5"/>`;
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" style="vertical-align:middle;margin-right:2px"><defs><clipPath id="${id}"><path d="${heart}"/></clipPath></defs><g clip-path="url(#${id})">${slices}</g><path d="${heart}" fill="none" stroke="#000" stroke-width="0.8"/></svg>`;
}

// One-time HUD element lookup + last-written signature per HUD section.
let _hudEls = null;
const _hudLast = {};
function hudEls() {
  if (_hudEls) return _hudEls;
  const $ = id => document.getElementById(id);
  _hudEls = {
    hearts: $('hearts'), rupees: $('rupees'), level: $('level'),
    xp: $('xp'), xpnext: $('xpnext'), roomName: $('roomName'),
    sword: $('ws-sword'), bow: $('ws-bow'), bomb: $('ws-bomb'),
    armor: $('ws-armor'), immunity: $('ws-immunity'), interact: $('ws-interact'),
  };
  return _hudEls;
}

function updateHUD() {
  const el = hudEls(), last = _hudLast;

  // Hearts: 6 HP per pie. Each slice goes black as that HP point is lost.
  // Temporary HP — green hearts of the same shape, to the right of the red ones.
  const temp = player.tempHp || 0;
  const heartsSig = player.hp + '/' + player.maxHp + '/' + temp;
  if (last.hearts !== heartsSig) {
    last.hearts = heartsSig;
    let h = '';
    for (let i = 0; i < player.maxHp; i += 6) {
      const inSlot = Math.max(0, Math.min(6, player.hp - i));
      h += hpPieSVG(inSlot, 6);
    }
    for (let i = 0; i < temp; i += 6) {
      const inSlot = Math.max(0, Math.min(6, temp - i));
      h += hpPieSVG(inSlot, 6, 16, '#3fc24a');
    }
    el.hearts.innerHTML = h;
  }
  if (last.rupees !== player.rupees) { last.rupees = player.rupees; el.rupees.textContent = player.rupees; }
  if (last.level  !== player.level)  { last.level  = player.level;  el.level.textContent  = player.level; }
  if (last.xp     !== player.xp)     { last.xp     = player.xp;     el.xp.textContent     = player.xp; }
  if (last.xpNext !== player.xpNext) { last.xpNext = player.xpNext; el.xpnext.textContent = player.xpNext; }
  const room = currentMap().name;
  if (last.room !== room) { last.room = room; el.roomName.textContent = room; }

  // The sword slot label changes to reflect the currently wielded elemental
  // sword (or the plain "Sword" when none is equipped); the highlight tracks
  // the active weapon. Mirrors the bow slot logic below.
  if (el.sword) {
    const se = player.activeSwordElement;
    const elem = (se && typeof SWORD_ELEMENTS !== 'undefined') ? SWORD_ELEMENTS[se] : null;
    const active = player.weapon === 'sword';
    const sig = (elem ? se : '') + '|' + active;
    if (last.sword !== sig) {
      last.sword = sig;
      if (elem) el.sword.innerHTML = `⚔️${elemIconHTML(elem, 14)} ${elem.label} Sword [Z]`;
      else      el.sword.textContent = '⚔️ Sword [Z]';
      el.sword.className = 'weapon-slot' + (active ? ' weapon-active' : '');
    }
  }
  // The bow slot label changes to reflect the currently nocked elemental
  // arrow (or "Bow" when none is selected / out of arrows).
  if (el.bow) {
    const ae = player.activeArrowElement;
    const stock = ae && player.arrows ? (player.arrows[ae] || 0) : 0;
    const elem = (ae && stock > 0 && typeof SWORD_ELEMENTS !== 'undefined') ? SWORD_ELEMENTS[ae] : null;
    const active = player.weapon === 'bow';
    const sig = (elem ? ae + ':' + stock : '') + '|' + active;
    if (last.bow !== sig) {
      last.bow = sig;
      if (elem) el.bow.innerHTML = `🏹${elemIconHTML(elem, 14)} ${elem.label} Arrow x${stock} [X]`;
      else      el.bow.textContent = '🏹 Bow [X]';
      el.bow.className = 'weapon-slot' + (active ? ' weapon-active' : '');
    }
  }
  // The [C] slot mirrors the C-bound consumable wherever it currently lives
  // (Bomb in the weapons ring, Potion in the inventory ring); falls back to Bomb.
  if (el.bomb && typeof radialFindItem === 'function') {
    const sel = radialFindItem(inventorySelectionType) || radialFindItem('bomb');
    if (sel) {
      const active = player.weapon === sel.type;
      const sig = sel.icon + '|' + sel.label + '|' + active;
      if (last.bomb !== sig) {
        last.bomb = sig;
        el.bomb.textContent = `${sel.icon} ${sel.label} [C]`;
        el.bomb.className = 'weapon-slot' + (active ? ' weapon-active' : '');
      }
    }
  }
  // Active elemental armor slot — only visible while an elemental armor is
  // actually worn. Hidden completely otherwise (no flat-armor placeholder).
  if (el.armor) {
    const ae = player.activeArmorElement;
    const elem = (ae && typeof SWORD_ELEMENTS !== 'undefined') ? SWORD_ELEMENTS[ae] : null;
    const phys = elem && (typeof elementalArmorPhys === 'function') ? elementalArmorPhys(ae) : 0;
    const pct  = elem && (typeof elementalArmorBlockPct === 'function') ? elementalArmorBlockPct(ae) : 50;
    const sig = elem ? ae + '+' + phys + '-' + pct : '';
    if (last.armor !== sig) {
      last.armor = sig;
      if (elem) {
        el.armor.innerHTML = `🛡${elemIconHTML(elem, 14)} ${elem.label} +${phys}·−${pct}%`;
        el.armor.className = 'weapon-slot weapon-active';
        el.armor.style.display = '';
      } else {
        el.armor.style.display = 'none';
      }
    }
  }
  // Active Elixir immunity slot — shows the element and seconds remaining while a
  // Herbalist Elixir buff is up; hidden otherwise. (Rewrites once per second.)
  if (el.immunity) {
    const ie = player.immunityElement;
    const on = ie && (player.immunityTimer || 0) > 0 &&
               typeof SWORD_ELEMENTS !== 'undefined' && SWORD_ELEMENTS[ie];
    const secs = on ? Math.ceil((player.immunityTimer || 0) / 1000) : 0;
    const sig = on ? ie + ':' + secs : '';
    if (last.immunity !== sig) {
      last.immunity = sig;
      if (on) {
        const elem = SWORD_ELEMENTS[ie];
        el.immunity.innerHTML = `${elemIconHTML(elem, 14)} Immune ${secs}s`;
        el.immunity.className = 'weapon-slot weapon-active';
        el.immunity.style.display = '';
      } else {
        el.immunity.style.display = 'none';
      }
    }
  }
  // Interaction hint slot — appears after [C] only when SPACE can interact with
  // something nearby (talk/shop in town, or open an adjacent chest).
  if (el.interact && typeof interactionHint === 'function') {
    const hint = interactionHint() || '';
    if (last.interact !== hint) {
      last.interact = hint;
      if (hint) { el.interact.textContent = hint; el.interact.style.display = ''; }
      else      { el.interact.style.display = 'none'; }
    }
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
