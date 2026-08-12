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
    hearts: $('hearts'), rubies: $('rubies'), level: $('level'),
    xp: $('xp'), xpnext: $('xpnext'), roomName: $('roomName'),
    sword: $('ws-sword'), bow: $('ws-bow'), bomb: $('ws-bomb'),
    armor: $('ws-armor'), immunity: $('ws-immunity'), interact: $('ws-interact'),
    // Touch action pad (bottom-right buttons) — present only on touch devices.
    taWrap: $('touch-actions'), taSword: $('ta-sword'), taBow: $('ta-bow'),
    taPotion: $('ta-potion'), taAbility: $('ta-ability'),
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
  if (last.rubies !== player.rubies) { last.rubies = player.rubies; el.rubies.textContent = player.rubies; }
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
    const elem = se ? SWORD_ELEMENTS[se] : null;
    const active = player.weapon === 'sword';
    // Before Grandmother's Sword, the slot advertises the fists instead. Unlike
    // the bow slot below it isn't hidden outright: [Z] still does something, and
    // Beat 2's dog encounter exists specifically to teach that button, so it
    // needs a visible control. Naming it "Punch" gives nothing away — the sword
    // is never mentioned until she tells the player to open the chest.
    const sig = (elem ? se : '') + '|' + active + '|' + (player.hasSword ? 1 : 0);
    if (last.sword !== sig) {
      last.sword = sig;
      if (!player.hasSword)  el.sword.textContent = '👊 Punch [Z]';
      else if (elem) el.sword.innerHTML = `⚔️${elemIconHTML(elem, 14)} ${elem.label} Sword [Z]`;
      else      el.sword.textContent = '⚔️ Sword [Z]';
      el.sword.className = 'weapon-slot' + (active ? ' weapon-active' : '');
    }
  }
  // The bow slot label changes to reflect the currently nocked elemental
  // arrow (or "Bow" when none is selected / out of arrows).
  if (el.bow) {
    // No bow, no slot. Hidden rather than greyed out: before the prologue's last
    // beat the player has never seen a bow, so an empty slot would be a spoiler.
    el.bow.style.display = player.hasBow ? '' : 'none';
    const ae = player.activeArrowElement;
    const stock = ae && player.arrows ? (player.arrows[ae] || 0) : 0;
    const elem = (ae && stock > 0) ? SWORD_ELEMENTS[ae] : null;
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
    const elem = ae ? SWORD_ELEMENTS[ae] : null;
    const phys = elem && elementalArmorPhys(ae);
    const pct  = elem && elementalArmorBlockPct(ae);
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
               SWORD_ELEMENTS[ie];
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

  // ── Touch action pad ──────────────────────────────────────────────────────
  // Mirror the weapon-bar state onto the three action buttons, and hang the
  // potion count off the third one. The whole pad hides while the menu ring or a
  // blocking overlay is up so a tap can't fire underneath it.
  if (el.taWrap) {
    const menuUp  = (typeof radialMenuOpen !== 'undefined' && radialMenuOpen) ||
                    (typeof gameplayTouchBlocked === 'function' && gameplayTouchBlocked());
    if (last.taHidden !== menuUp) {
      last.taHidden = menuUp;
      el.taWrap.classList.toggle('hidden', menuUp);
    }
    const potions = player.potions || 0;
    const w = player.weapon;
    // The equipped shrine ability, if there is one (abilities.js). Part of the
    // signature so the fourth button appears the moment the Air shrine pays out.
    const abil = (typeof equippedAbility === 'function') ? equippedAbility() : null;
    const sig = potions + '|' + w + '|' + (player.hasBow ? 1 : 0) + '|' + (player.hasSword ? 1 : 0) +
                '|' + (abil || '');
    if (last.taSig !== sig) {
      last.taSig = sig;
      if (el.taSword) {
        // Same swap as the weapon bar: the melee button is a fist until the sword
        // is won. It stays on screen (it's the button Beat 2 teaches) rather than
        // hiding the way the bow button does.
        el.taSword.textContent = player.hasSword ? '⚔️' : '👊';
        el.taSword.title = player.hasSword ? 'Sword' : 'Punch';
        el.taSword.classList.toggle('active', w === 'sword');
      }
      // The touch bow button follows the weapon bar: gone until the bow is won.
      if (el.taBow)   el.taBow.style.display = player.hasBow ? '' : 'none';
      if (el.taBow)   el.taBow.classList.toggle('active', w === 'bow');
      // The potion button carries its own stock count and greys out at zero —
      // it's a quick-drink, not a weapon, so it never takes the `active` ring.
      if (el.taPotion) {
        el.taPotion.dataset.count = potions;
        el.taPotion.classList.toggle('empty', potions <= 0);
      }
      // The ability button only exists once one of the two active abilities is
      // owned, and wears whichever is equipped. Nothing equipped but one owned
      // still shows it — tapping then says how to equip, which is more useful
      // than a button that quietly isn't there.
      if (el.taAbility) {
        const owned = (typeof ACTIVE_ABILITIES !== 'undefined')
          ? ACTIVE_ABILITIES.filter(a => typeof hasAbility === 'function' && hasAbility(a)) : [];
        el.taAbility.style.display = owned.length ? '' : 'none';
        if (owned.length) {
          const icons = (typeof ABILITY_ICONS !== 'undefined') ? ABILITY_ICONS : {};
          const names = (typeof ABILITY_LABELS !== 'undefined') ? ABILITY_LABELS : {};
          el.taAbility.textContent = abil ? (icons[abil] || '✦') : '✦';
          el.taAbility.title = abil ? names[abil] : 'No ability equipped';
          el.taAbility.classList.toggle('empty', !abil);
        }
      }
    }
  }
}

// ─── Toast notifications ─────────────────────────────────────────────────────
// Every transient message in the game goes through here. This replaces the two
// surfaces that used to exist side by side — the #msg-bar strip under the HUD
// and the #map-banner overlay — with one stack of dismissible cards.
//
// showMsg() and showMapMsg() keep their old signatures on purpose: they are
// called from ~180 places across 17 files, and the point of this change is the
// presentation, not the call sites. showMapMsg() is now the high-emphasis
// `banner` variant of the same toast rather than a separate widget.
//
// A toast leaves the screen when its timer runs out OR when the player clicks /
// taps it (Escape dismisses the newest — see the gameplay keydown handler in
// main.js). `dur = 0` means no timer at all: the toast is *sticky* and only a
// player input clears it, which is what the boss-defeat message wants.
//
// Note that scripted NPC conversation deliberately does NOT come through here —
// talking to someone opens the dialogue box (see sayNPC in dialogue.js), which
// freezes the world and waits for a keypress. Toasts are for things that happen
// *to* the player; the dialogue box is for someone speaking *to* them.

const TOAST_MAX        = 4;      // visible at once; the oldest retires past this
const TOAST_DEFAULT_MS = 5000;   // showMsg's read period when none is given
const TOAST_BANNER_MS  = 6000;   // map/area messages get a beat longer

// Live toasts, oldest first: { el, text, kind, count, countEl, timer }
let _toasts = [];

function _toastStack() {
  return document.getElementById('toast-stack');
}

// Raise a toast. `kind` is 'msg' (default) or 'banner'; `dur` is ms, or 0 for a
// sticky toast that only an input removes.
function showToast(text, { kind = 'msg', dur = TOAST_DEFAULT_MS } = {}) {
  const stack = _toastStack();
  if (!stack) return null;   // no host element (e.g. a tools/ harness page)

  // An identical message that re-fires while its toast is still up bumps a ×N
  // badge and restarts the timer. Without this, walking through a cluster of
  // the same pickup buries the screen in copies of one line.
  const dupe = _toasts.find(t => t.text === text && t.kind === kind);
  if (dupe) {
    dupe.count++;
    dupe.countEl.textContent = '×' + dupe.count;
    dupe.countEl.style.display = '';
    _toastArm(dupe, dur);
    return dupe;
  }

  const el = document.createElement('div');
  el.className = 'toast' + (kind === 'banner' ? ' banner' : '');

  const body = document.createElement('span');
  body.textContent = text;
  el.appendChild(body);

  const countEl = document.createElement('span');
  countEl.className = 'toast-count';
  countEl.style.display = 'none';
  el.appendChild(countEl);

  // A sticky toast has to say so — otherwise it just looks stuck.
  if (!(dur > 0)) {
    const hint = document.createElement('span');
    hint.className = 'toast-hint';
    hint.textContent = 'click or press Esc to dismiss';
    el.appendChild(hint);
  }

  const toast = { el, text, kind, count: 1, countEl, timer: null };
  // Clicking the card dismisses it. stopPropagation so the tap doesn't also
  // reach the canvas underneath and kick off a tap-to-travel walk.
  el.addEventListener('click', e => { e.stopPropagation(); dismissToast(toast); });

  stack.appendChild(el);
  _toasts.push(toast);
  // The entrance animates itself from CSS (@keyframes toast-in) — no rAF here on
  // purpose; see the note on .toast in game.css.

  // Past the cap something has to go, so a burst of kills can't wall off the
  // view. Retire the oldest *timed* toast first: a sticky one is waiting on an
  // input by definition, and evicting it on a timer the player never saw would
  // be exactly the thing sticky exists to prevent. Only when every toast is
  // sticky does the oldest of those go — otherwise four unread ones would
  // deadlock the stack and no further message could ever appear.
  while (_toasts.length > TOAST_MAX) {
    const victim = _toasts.find(t => t !== toast && t.timer) ||
                   _toasts.find(t => t !== toast) || _toasts[0];
    dismissToast(victim);
  }

  _toastArm(toast, dur);
  return toast;
}

// (Re)start a toast's auto-dismiss timer. dur <= 0 leaves it sticky.
function _toastArm(toast, dur) {
  if (toast.timer) { clearTimeout(toast.timer); toast.timer = null; }
  if (dur > 0) toast.timer = setTimeout(() => dismissToast(toast), dur);
}

// Fade a toast out and drop it. Safe to call twice — the second call no-ops
// because the toast is already off the live list.
function dismissToast(toast) {
  if (!toast) return;
  const i = _toasts.indexOf(toast);
  if (i < 0) return;
  _toasts.splice(i, 1);
  if (toast.timer) { clearTimeout(toast.timer); toast.timer = null; }
  toast.el.classList.add('toast-out');
  // Matches the longest transition in .toast (0.25s) with a little slack.
  setTimeout(() => { if (toast.el.parentNode) toast.el.parentNode.removeChild(toast.el); }, 300);
}

// Dismiss the newest toast — what Escape does during gameplay. Returns true if
// there was one, so the key handler knows whether it consumed the press.
function dismissTopToast() {
  if (!_toasts.length) return false;
  dismissToast(_toasts[_toasts.length - 1]);
  return true;
}

function clearAllToasts() {
  for (const t of _toasts.slice()) dismissToast(t);
}

// Show a transient message. `dur` is honoured now (the old message bar accepted
// it and then hardcoded 5s regardless); dur = 0 is sticky until dismissed.
function showMsg(t, dur = TOAST_DEFAULT_MS) {
  return showToast(t, { kind: 'msg', dur });
}

// Show a map/area message — entering an area, a village awakening, revealing a
// cave. Same stack, bigger and brighter card.
function showMapMsg(t, dur = TOAST_BANNER_MS) {
  return showToast(t, { kind: 'banner', dur });
}
