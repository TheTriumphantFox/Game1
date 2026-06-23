// ─── Game loop, input, and boot ───────────────────────────────────────────────
// Wires the per-frame update/render and the keyboard/touch input. Everything
// game-state-related lives in the other modules; this file just orchestrates.

function update(dt) {
  // Pause the entire world while the radial inventory menu is open. Render is
  // still called every frame so the menu animates, and the HUD still refreshes
  // (so the menu's purchases / item use visually update), but every dt-based
  // state change is frozen.
  if ((typeof radialMenuOpen !== 'undefined' && radialMenuOpen) ||
      (typeof ledgerOpen     !== 'undefined' && ledgerOpen)) {
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
      const elem = (typeof SWORD_ELEMENTS !== 'undefined' && player.immunityElement)
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
  if (typeof shopOpen !== 'undefined' && shopOpen) {
    if (e.key === 'Escape') closeShopModals();
    return;   // shop modal swallows gameplay input
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
window.addEventListener('blur', clearAllKeys);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) clearAllKeys();
});

// Touch — tap to swing, swipe to walk
let touchStart = { x: 0, y: 0 };
canvas.addEventListener('touchstart', e => {
  const t = e.touches[0];
  touchStart = { x: t.clientX, y: t.clientY };
  e.preventDefault();
}, { passive: false });
canvas.addEventListener('touchend', e => {
  const t = e.changedTouches[0];
  const dx = t.clientX - touchStart.x, dy = t.clientY - touchStart.y;
  const adx = Math.abs(dx), ady = Math.abs(dy);
  if (adx < 12 && ady < 12) {
    keys['z'] = true; setTimeout(() => keys['z'] = false, 120);
  } else if (adx > ady) {
    const k = dx > 0 ? 'ArrowRight' : 'ArrowLeft';
    keys[k] = true; setTimeout(() => keys[k] = false, 160);
  } else {
    const k = dy > 0 ? 'ArrowDown' : 'ArrowUp';
    keys[k] = true; setTimeout(() => keys[k] = false, 160);
  }
  e.preventDefault();
}, { passive: false });

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
  showMapMsg('🛏️ You awaken in your cabin. Step outside to begin your adventure.');
  requestAnimationFrame(loop);
});
