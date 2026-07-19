// ─── Game loop, input, and boot ───────────────────────────────────────────────
// Wires the per-frame update/render and the keyboard/touch input. Everything
// game-state-related lives in the other modules; this file just orchestrates.

// ─── Title screen gate ────────────────────────────────────────────────────────
// The loop starts running at boot (so the world renders behind the title), but
// the world is frozen until the player picks New Game or Load Game. The render
// keeps drawing underneath the opaque #title-overlay.
let gameStarted = false;

function showTitleScreen() {
  gameStarted = false;
  document.getElementById('title-overlay').classList.add('open');
}
// Reveal the world and unfreeze the loop. Idempotent — safe to call from the
// New Game button or after a save loads.
function startGame() {
  gameStarted = true;
  document.getElementById('title-overlay').classList.remove('open');
}
// New Game from the title: boot already built a fresh world, so just ask for
// the hero's name, then drop the title and greet the player.
function titleNewGame() {
  openNamePrompt(name => {
    player.heroName = name;
    startGame();
    showMapMsg('🛏️ You awaken in your cabin. Step outside to begin your adventure.');
  });
}

// ─── Hero name prompt ─────────────────────────────────────────────────────────
// Modal asking for the hero's name before a new game begins. The name lands on
// player.heroName (persisted in saves) and labels save slots in save.js.
let namePromptOpen = false;
let namePromptConfirm = null;   // callback invoked with the chosen name

function openNamePrompt(onConfirm) {
  namePromptOpen = true;
  namePromptConfirm = onConfirm;
  const input = document.getElementById('name-input');
  input.value = '';
  document.getElementById('name-overlay').classList.add('open');
  input.focus();
}
// Cancel — closes the prompt, revealing whatever was underneath (title screen
// or the running game); the pending new-game callback is dropped.
function closeNamePrompt() {
  namePromptOpen = false;
  namePromptConfirm = null;
  document.getElementById('name-overlay').classList.remove('open');
}
function confirmNamePrompt() {
  const input = document.getElementById('name-input');
  const name = input.value.trim();
  if (!name) { input.focus(); return; }   // a name is required
  const cb = namePromptConfirm;
  closeNamePrompt();
  if (cb) cb(name);
}
// Enter confirms, Escape cancels. Registered on the input itself so keystrokes
// while typing never reach the gameplay keydown handler below.
document.getElementById('name-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') confirmNamePrompt();
  if (e.key === 'Escape') closeNamePrompt();
  e.stopPropagation();
});

function update(dt) {
  // Frozen on the title screen — no world stepping until a game is chosen.
  if (!gameStarted) return;
  // Pause the entire world while the radial inventory menu is open. Render is
  // still called every frame so the menu animates, and the HUD still refreshes
  // (so the menu's purchases / item use visually update), but every dt-based
  // state change is frozen.
  if ((typeof radialMenuOpen !== 'undefined' && radialMenuOpen) ||
      (typeof ledgerOpen     !== 'undefined' && ledgerOpen)     ||
      (typeof statsPageOpen  !== 'undefined' && statsPageOpen)  ||
      (typeof worldMapOpen   !== 'undefined' && worldMapOpen)   ||
      (typeof victoryOpen    !== 'undefined' && victoryOpen)) {
    updateHUD();
    return;
  }
  // Cooldowns
  if (player.invincible    > 0) player.invincible    -= dt;
  if (attackCooldown       > 0) attackCooldown       -= dt;
  if (bowCooldown          > 0) bowCooldown          -= dt;
  if (bombCooldown         > 0) bombCooldown         -= dt;
  if (transitionCooldown   > 0) transitionCooldown   -= dt;
  if (player.swordTimer    > 0) player.swordTimer    -= dt;
  // Elixir elemental immunity counts down; clear it (and notify) when it lapses.
  if (player.immunityTimer > 0) {
    player.immunityTimer -= dt;
    if (player.immunityTimer <= 0) {
      player.immunityTimer = 0;
      const elem = (player.immunityElement)
        ? SWORD_ELEMENTS[player.immunityElement] : null;
      showMsg(`${elem ? elem.icon : '⚗️'} Elemental immunity faded.`, 1500);
      player.immunityElement = null;
    }
  }
  moveTimer += dt;

  // Quick weapon switch
  if (keys['1']) player.weapon = 'sword';
  if (keys['2']) player.weapon = 'bow';
  if (keys['3']) player.weapon = 'bomb';

  // Movement (also handles pickup + map transitions)
  stepPlayerMovement();

  // Whirlpool suction — grabs the hero when swimming within a tile of one
  stepWhirlpoolPull(dt);

  // Attacks
  const actZ = keys[' '] || keys['z'] || keys['Z'];
  const actX = keys['x'] || keys['X'];
  const actC = keys['c'] || keys['C'];

  // Weapons are sheathed inside an active village — the boss is dead, the
  // shops are open, no swinging swords or chucking bombs in town.
  const cm = currentMap();
  const weaponsLocked = cm && cm.type === 'village' && cm.activated;

  if (actZ && attackCooldown <= 0 && !weaponsLocked) {
    attackCooldown = 280;
    doSwordSwing();
  }
  if (actX && bowCooldown <= 0 && !weaponsLocked) {
    bowCooldown = 350;
    player.weapon = 'bow';
    firePlayerArrow();
  }
  // 'C' uses whichever item is currently selected in the inventory ring of the
  // radial menu (defaults to Bomb). useSelectedInventoryItem returns the
  // cooldown to apply so hold-to-spam respects per-item rate limits.
  if (actC && bombCooldown <= 0 && !weaponsLocked) {
    bombCooldown = useSelectedInventoryItem();
  }

  // World step — order matches the original monolith
  const map = mapData();
  stepEnemyRanged(dt);
  stepProjectiles(dt, map);
  stepEnemies(dt, map);
  stepVillagers(dt, map);
  stepDrops(dt);
  stepParticles(dt);
  tickCamera(dt);   // smooth scroll toward target each frame

  updateHUD();
}

// ─── Input ────────────────────────────────────────────────────────────────────
// Set both the literal e.key and its case-folded variant for single-char keys.
// This keeps movement consistent when Shift is pressed/released mid-stride:
// browsers report keyup with the post-Shift case (e.g. 'D' if Shift was held),
// which would otherwise leave the lower-case 'd' stuck on.
function setKey(key, value) {
  keys[key] = value;
  if (typeof key === 'string' && key.length === 1) {
    const lo = key.toLowerCase(), up = key.toUpperCase();
    if (lo !== up) { keys[lo] = value; keys[up] = value; }
  }
}

function clearAllKeys() {
  for (const k of Object.keys(keys)) keys[k] = false;
}

document.addEventListener('keydown', e => {
  if (namePromptOpen) {
    if (e.key === 'Escape') closeNamePrompt();
    return;   // name prompt swallows gameplay input
  }
  if (typeof shopOpen !== 'undefined' && shopOpen) {
    if (e.key === 'Escape') closeShopModals();
    return;   // shop modal swallows gameplay input
  }
  if (typeof victoryOpen !== 'undefined' && victoryOpen) {
    // Enter / Esc / Space dismiss the victory screen back into the world.
    if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') continueFromVictory();
    return;   // victory overlay swallows gameplay input
  }
  if (typeof portalOpen !== 'undefined' && portalOpen) {
    if (e.key === 'Escape') closePortalModal();
    return;   // portal modal swallows gameplay input
  }
  if (typeof ledgerOpen !== 'undefined' && ledgerOpen) {
    // Esc — or V again, the key that opened the path — closes the ledger.
    if (e.key === 'Escape' || e.key === 'v' || e.key === 'V') closeDropLedger();
    return;   // ledger modal swallows gameplay input
  }
  if (typeof statsPageOpen !== 'undefined' && statsPageOpen) {
    // Esc — or V again — closes the character sheet.
    if (e.key === 'Escape' || e.key === 'v' || e.key === 'V') closeStatsPage();
    return;   // stats modal swallows gameplay input
  }
  if (typeof worldMapOpen !== 'undefined' && worldMapOpen) {
    // Esc — or V again — closes the world map. +/- and 0 zoom / fit.
    if (e.key === 'Escape' || e.key === 'v' || e.key === 'V') closeWorldMap();
    else if (e.key === '+' || e.key === '=') worldMapZoom(1.25);
    else if (e.key === '-' || e.key === '_') worldMapZoom(0.8);
    else if (e.key === '0') worldMapResetView();
    return;   // world map swallows gameplay input
  }
  // 'V' toggles the radial inventory menu (works whether open or closed)
  if (e.key === 'v' || e.key === 'V') {
    e.preventDefault();
    if (!e.repeat) toggleRadialMenu();
    return;
  }
  // While the radial menu is open, arrow keys navigate the menu and all other
  // gameplay input is swallowed.
  if (typeof radialMenuOpen !== 'undefined' && radialMenuOpen) {
    if (e.key === 'Escape') { closeRadialMenu(); return; }
    if (e.repeat) return;
    if (e.key === 'ArrowUp')    { e.preventDefault(); radialNavRing(-1); return; }
    if (e.key === 'ArrowDown')  { e.preventDefault(); radialNavRing( 1); return; }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); radialNavItem(-1); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); radialNavItem( 1); return; }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); radialActivateSelected(); return; }
    return;
  }
  // Space-bar is the interact key. Pressed once (not held):
  //   1. In an active village, talk to an adjacent villager / open a shop.
  //   2. Otherwise (and in villages with no villager adjacent), open an
  //      adjacent chest — chests are solid, so this is how you loot them.
  // Either interaction swallows the keypress so SPACE doesn't also swing.
  if (e.key === ' ' && !e.repeat) {
    // Talk to an adjacent villager / shopkeeper / Gatekeeper. Safe to try on
    // any map: it's a no-op unless a villager is adjacent (the cabin only has
    // the portal Gatekeeper; villages have the full crowd).
    if (typeof tryVillagerInteraction === 'function' && tryVillagerInteraction()) {
      e.preventDefault();
      return;
    }
    if (typeof tryChestInteraction === 'function' && tryChestInteraction()) {
      e.preventDefault();
      return;
    }
  }
  setKey(e.key, true);
  if (e.key === 'Tab') { e.preventDefault(); if (!e.repeat) showMinimap = !showMinimap; }
  // 'P' drinks one Health Potion (fires on the press itself, not while held)
  if (e.key === 'p' || e.key === 'P') { e.preventDefault(); if (!e.repeat) usePotion(); }
  if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
    e.preventDefault();
  }
});
document.addEventListener('keyup', e => { setKey(e.key, false); });

// When the page loses focus or visibility, any held keys never get their
// keyup event — drop them all so movement/bow don't keep firing on return.
window.addEventListener('blur', () => { clearAllKeys(); if (typeof joyEnd === 'function') joyEnd(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { clearAllKeys(); if (typeof joyEnd === 'function') joyEnd(); }
});

// ─── Touch: floating joystick ───────────────────────────────────────────────
// A drag-and-hold virtual stick. The first canvas touch drops a stick centre;
// holding in any direction walks the hero that way continuously by pressing the
// same arrow keys the keyboard uses (so stepPlayerMovement needs no changes). As
// the finger wanders, the centre trails it (capped at JOY_LEASH) so the *current*
// hold direction is always what steers — "if the hold moves, that's the new
// direction." A dead-zone in the middle means a still finger stands still.
// While the radial menu (drawn on the canvas) is open, canvas touches drive the
// menu instead of movement.
const touchJoystick = { active: false, id: null, cx: 0, cy: 0, x: 0, y: 0, startTime: 0, moved: false };
const JOY_DEAD  = 14;   // px — below this from centre: stand still
const JOY_LEASH = 46;   // px — max the centre trails behind the finger
const TAP_MS    = 250;  // a canvas touch shorter than this that never left the
                        // dead-zone is a "tap" — it fires the selected weapon

function joyClearKeys() {
  keys['ArrowUp'] = keys['ArrowDown'] = keys['ArrowLeft'] = keys['ArrowRight'] = false;
}
function joyEnd() {
  touchJoystick.active = false;
  touchJoystick.id = null;
  joyClearKeys();
}
// Re-anchor the centre toward the finger (leashed), then translate the offset
// into 8-way arrow-key presses via its angle octant.
function joyUpdate(x, y) {
  let dx = x - touchJoystick.cx, dy = y - touchJoystick.cy;
  const dist = Math.hypot(dx, dy);
  if (dist > JOY_LEASH) {
    touchJoystick.cx = x - dx / dist * JOY_LEASH;
    touchJoystick.cy = y - dy / dist * JOY_LEASH;
    dx = x - touchJoystick.cx; dy = y - touchJoystick.cy;
  }
  touchJoystick.x = x; touchJoystick.y = y;
  joyClearKeys();
  if (Math.hypot(dx, dy) < JOY_DEAD) return;   // dead-zone → no movement
  touchJoystick.moved = true;                  // left the dead-zone → it's a drag, not a tap
  // Screen space: angle 0°=right, 90°=down, 180°=left, 270°=up. Each key is on
  // for the 180° arc facing its way, so diagonals light two keys at once.
  const a = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
  if (a < 67.5 || a > 292.5)  keys['ArrowRight'] = true;
  if (a > 112.5 && a < 247.5) keys['ArrowLeft']  = true;
  if (a > 22.5  && a < 157.5) keys['ArrowDown']  = true;
  if (a > 202.5 && a < 337.5) keys['ArrowUp']    = true;
}

// A DOM overlay (shop / portal / ledger / save modal) is capturing input, or the
// full-screen minimap view is up — the canvas shouldn't walk/attack underneath it.
function gameplayTouchBlocked() {
  return (typeof shopOpen   !== 'undefined' && shopOpen)   ||
         (typeof portalOpen !== 'undefined' && portalOpen) ||
         (typeof ledgerOpen !== 'undefined' && ledgerOpen) ||
         (typeof statsPageOpen !== 'undefined' && statsPageOpen) ||
         (typeof worldMapOpen !== 'undefined' && worldMapOpen) ||
         (typeof viewMode !== 'undefined' && viewMode === 2);
}

canvas.addEventListener('touchstart', e => {
  ensureWakeLock();
  // Radial menu is drawn on the canvas — route taps to it, not to movement.
  if (typeof radialMenuOpen !== 'undefined' && radialMenuOpen) {
    const t = e.changedTouches[0];
    if (typeof radialTouchAt === 'function') radialTouchAt(t.clientX, t.clientY);
    e.preventDefault();
    return;
  }
  if (gameplayTouchBlocked() || touchJoystick.active) { return; }
  const t = e.changedTouches[0];
  const rect = canvas.getBoundingClientRect();
  const x = t.clientX - rect.left, y = t.clientY - rect.top;
  touchJoystick.active = true;
  touchJoystick.id = t.identifier;
  touchJoystick.cx = x; touchJoystick.cy = y;
  touchJoystick.startTime = Date.now();
  touchJoystick.moved = false;
  joyUpdate(x, y);
  e.preventDefault();
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  if (!touchJoystick.active) return;
  const rect = canvas.getBoundingClientRect();
  for (const t of e.changedTouches) {
    if (t.identifier === touchJoystick.id) {
      joyUpdate(t.clientX - rect.left, t.clientY - rect.top);
      e.preventDefault();
      break;
    }
  }
}, { passive: false });

function onCanvasTouchEnd(e) {
  if (!touchJoystick.active) return;
  for (const t of e.changedTouches) {
    if (t.identifier === touchJoystick.id) {
      // A quick touch that never left the dead-zone is a tap → fire the selected
      // weapon. A drag (moved) or long hold was movement, so it just ends.
      const wasTap = !touchJoystick.moved && (Date.now() - touchJoystick.startTime) < TAP_MS;
      joyEnd();
      if (wasTap && !gameplayTouchBlocked()) activateSelectedWeapon();
      e.preventDefault();
      break;
    }
  }
}
canvas.addEventListener('touchend',    onCanvasTouchEnd, { passive: false });
canvas.addEventListener('touchcancel', onCanvasTouchEnd, { passive: false });

// ─── On-screen action buttons ────────────────────────────────────────────────
// The weapon-bar slots double as tap controls on touch. Each routes through the
// same cooldown / weapons-locked guards as the keyboard path in update(); pointer
// events fire instantly and skip the synthetic ghost-click.
function triggerAction(kind) {
  const cm = currentMap();
  const weaponsLocked = cm && cm.type === 'village' && cm.activated;
  if (weaponsLocked) return;
  if (kind === 'sword' && attackCooldown <= 0) {
    attackCooldown = 280; doSwordSwing();
  } else if (kind === 'bow' && bowCooldown <= 0) {
    bowCooldown = 350; player.weapon = 'bow'; firePlayerArrow();
  } else if (kind === 'item' && bombCooldown <= 0) {
    bombCooldown = useSelectedInventoryItem();
  }
  updateHUD();
}

function bindTap(id, fn) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('pointerdown', e => { e.preventDefault(); fn(e); });
}

// On TOUCH, tapping a weapon slot only *selects* it (sets the highlighted
// weapon); a later tap on the game screen is what actually swings/fires/uses it.
// A mouse click keeps the old instant-fire feel (desktop is unchanged).
function selectTouchWeapon(kind) {
  if (kind === 'sword')     player.weapon = 'sword';
  else if (kind === 'bow')  player.weapon = 'bow';
  else /* item */           player.weapon = (typeof inventorySelectionType !== 'undefined')
                                            ? inventorySelectionType : 'bomb';
  if (typeof buzz === 'function') buzz(8);
  updateHUD();   // the weapon-bar highlight tracks player.weapon
}

// Fire whichever weapon the touch player has selected (called by a screen tap).
function activateSelectedWeapon() {
  if (player.weapon === 'sword')     triggerAction('sword');
  else if (player.weapon === 'bow')  triggerAction('bow');
  else                               triggerAction('item');
}

function weaponSlotTap(kind, e) {
  if (e && (e.pointerType === 'touch' || e.pointerType === 'pen')) selectTouchWeapon(kind);
  else triggerAction(kind);   // mouse / desktop: instant fire, as before
}

bindTap('ws-sword', e => weaponSlotTap('sword', e));
bindTap('ws-bow',   e => weaponSlotTap('bow',   e));
bindTap('ws-bomb',  e => weaponSlotTap('item',  e));
bindTap('ws-menu',  () => { if (typeof toggleRadialMenu === 'function') toggleRadialMenu(); });
bindTap('ws-interact', () => {
  if (typeof tryVillagerInteraction === 'function' && tryVillagerInteraction()) return;
  if (typeof tryChestInteraction === 'function') tryChestInteraction();
});

// Double-tap the empty part of the weapon bar (not a weapon slot) to cycle the
// three view modes: normal → zoomed-out → full-screen minimap → normal.
(() => {
  const bar = document.getElementById('weapon-bar');
  if (!bar) return;
  let lastTap = 0;
  bar.addEventListener('pointerup', e => {
    // Ignore taps that land on an actual slot — those select a weapon.
    if (e.target.closest && e.target.closest('.weapon-slot')) { lastTap = 0; return; }
    const now = Date.now();
    if (now - lastTap < 320) { lastTap = 0; e.preventDefault(); cycleViewMode(); }
    else lastTap = now;
  });
})();

// ─── Fullscreen + screen wake-lock ───────────────────────────────────────────
// Keep the screen awake during play; re-acquire after the tab is backgrounded
// (browsers drop the lock on visibility change). All best-effort / feature-gated.
let wakeLock = null;
async function ensureWakeLock() {
  try {
    if ('wakeLock' in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    }
  } catch (_) { /* denied or unsupported — ignore */ }
}
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) ensureWakeLock();
});
function toggleFullscreen() {
  const el = document.documentElement;
  if (!document.fullscreenElement && !document.webkitFullscreenElement) {
    (el.requestFullscreen || el.webkitRequestFullscreen || (() => {})).call(el);
  } else {
    (document.exitFullscreen || document.webkitExitFullscreen || (() => {})).call(document);
  }
}

// ─── Main loop ────────────────────────────────────────────────────────────────
let lastTime = 0;
function loop(ts) {
  const dt = Math.min(ts - lastTime, 80);   // clamp huge dt (tab refocus)
  lastTime = ts;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
// Defer first resize so the bottom bars have measurable offsetHeight values.
requestAnimationFrame(() => {
  resizeCanvas();
  // Fill in starting inventory pieces that needed SWORD_ELEMENTS (loaded after
  // player.js). Idempotent on reload — newGame / applyLoadData re-seed too.
  applyStartingInventory(player);
  initWorld();
  revealAround(currentMap(), player.x, player.y, 12);
  spawnEnemiesForMap(0);
  spawnVillagersForMap(0);
  clampCam(true);
  updateHUD();
  showTitleScreen();   // freeze on the title until New Game / Load Game is picked
  requestAnimationFrame(loop);
});
