// ─── Game loop, input, and boot ───────────────────────────────────────────────
// Wires the per-frame update/render and the keyboard/touch input. Everything
// game-state-related lives in the other modules; this file just orchestrates.

function update(dt) {
  // Pause the entire world while the radial inventory menu is open. Render is
  // still called every frame so the menu animates, and the HUD still refreshes
  // (so the menu's purchases / item use visually update), but every dt-based
  // state change is frozen.
  if (typeof radialMenuOpen !== 'undefined' && radialMenuOpen) {
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
  moveTimer += dt;

  // Quick weapon switch
  if (keys['1']) player.weapon = 'sword';
  if (keys['2']) player.weapon = 'bow';
  if (keys['3']) player.weapon = 'bomb';

  // Movement (also handles pickup + map transitions)
  stepPlayerMovement();

  // Attacks
  const actZ = keys[' '] || keys['z'] || keys['Z'];
  const actX = keys['x'] || keys['X'];
  const actC = keys['c'] || keys['C'];

  if (actZ && attackCooldown <= 0) {
    attackCooldown = 280;
    doSwordSwing();
  }
  if (actX && bowCooldown <= 0) {
    bowCooldown = 350;
    player.weapon = 'bow';
    firePlayerArrow();
  }
  // 'C' uses whichever item is currently selected in the inventory ring of the
  // radial menu (defaults to Bomb). useSelectedInventoryItem returns the
  // cooldown to apply so hold-to-spam respects per-item rate limits.
  if (actC && bombCooldown <= 0) {
    bombCooldown = useSelectedInventoryItem();
  }

  // World step — order matches the original monolith
  const map = mapData();
  stepEnemyRanged(dt);
  stepProjectiles(dt, map);
  stepEnemies(dt, map);
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
  initWorld();
  revealAround(currentMap(), player.x, player.y, 12);
  spawnEnemiesForMap(0);
  clampCam(true);
  updateHUD();
  showMsg('🌲 You awaken in the Enchanted Forest… find the village after 20 maps!', 4000);
  requestAnimationFrame(loop);
});
