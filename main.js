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
    // Straight into the opening beat — no "you awaken" banner, because the
    // prologue's first scene does the establishing itself. Note this path does
    // NOT call resetGame: boot already built a fresh world with the home village
    // at map 0. The in-game 🆕 New button does reset, and hooks the prologue at
    // the end of resetGame instead.
    if (typeof startPrologue === 'function') startPrologue();
  });
}

// Start a new game and skip straight past the prologue, with its outcomes (the
// bow, the flags, the ruined village) already applied. Offered on the title
// screen for a second playthrough.
function titleNewGameSkip() {
  openNamePrompt(name => {
    player.heroName = name;
    startGame();
    if (typeof skipPrologue === 'function') skipPrologue();
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
  // Scripted beats tick BEFORE the freeze chain below, deliberately: a cutscene
  // step that blocks the world still needs its own timer advanced, and the
  // dialogue typewriter still needs to type. Move these after the early return
  // and every timed cutscene step deadlocks.
  if (typeof stepDialogue === 'function') stepDialogue(dt);
  if (typeof stepCutscene === 'function') stepCutscene(dt);
  // Pause the entire world while the radial inventory menu is open. Render is
  // still called every frame so the menu animates, and the HUD still refreshes
  // (so the menu's purchases / item use visually update), but every dt-based
  // state change is frozen.
  if ((typeof radialMenuOpen    !== 'undefined' && radialMenuOpen)    ||
      (typeof ledgerOpen        !== 'undefined' && ledgerOpen)        ||
      (typeof statsPageOpen     !== 'undefined' && statsPageOpen)     ||
      (typeof worldMapOpen      !== 'undefined' && worldMapOpen)      ||
      (typeof victoryOpen       !== 'undefined' && victoryOpen)       ||
      (typeof dialogueOpen      !== 'undefined' && dialogueOpen)      ||
      (typeof cutsceneBlocking  !== 'undefined' && cutsceneBlocking)) {
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

  // Quick weapon switch. [2] does nothing until Grandmother's Bow is in hand.
  if (keys['1']) player.weapon = 'sword';
  if (keys['2'] && player.hasBow) player.weapon = 'bow';
  if (keys['3']) player.weapon = 'bomb';

  // Tap-to-travel: inject movement toward a tapped interactable, then interact.
  // Runs before stepPlayerMovement so its keys are consumed this same frame.
  advanceAutoNav(dt);

  // Movement (also handles pickup + map transitions)
  stepPlayerMovement();

  // Whirlpool suction — grabs the hero when swimming within a tile of one
  stepWhirlpoolPull(dt);

  // Attacks
  const actZ = keys[' '] || keys['z'] || keys['Z'];
  const actX = keys['x'] || keys['X'];
  const actC = keys['c'] || keys['C'];

  // Weapons are sheathed inside an active village — the boss is dead, the
  // shops are open, no swinging swords or chucking bombs in town. Same lock
  // covers the home village: peaceful before the fire, and during the fire the
  // encounter is unbeatable by design, so there must be nothing to swing at and
  // no way to try.
  const cm = currentMap();
  const weaponsLocked = !!cm && ((cm.type === 'village' && cm.activated) ||
                                 cm.type === 'homevillage');

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

  // Prologue beat triggers — checked against the player's position rather than
  // fired from a tile, so there's no invisible line to walk around. No-op once
  // the prologue is done.
  if (typeof checkPrologueTriggers === 'function') checkPrologueTriggers();

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
  if (typeof dialogueOpen !== 'undefined' && dialogueOpen) {
    // Space / Enter advance a scripted conversation. Nothing else gets through —
    // in particular Escape does NOT skip, because these lines are the story.
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); advanceDialogue(); }
    return;   // dialogue box swallows gameplay input
  }
  if (typeof cutsceneInputLocked !== 'undefined' && cutsceneInputLocked) {
    return;   // a scripted beat is driving — the player isn't
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
  // Escape dismisses the newest toast. Sticky toasts (dur = 0) sit there until
  // an input clears them, and a keyboard player shouldn't have to reach for the
  // mouse to do it. Falls through when nothing is up — Escape is otherwise
  // unbound during gameplay, only inside the overlay branches above.
  if (e.key === 'Escape' && typeof dismissTopToast === 'function' && dismissTopToast()) {
    e.preventDefault();
    return;
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
  // Any manual movement/interact key cancels an in-progress tap-to-travel walk.
  if (autoNav && typeof cancelAutoNav === 'function' &&
      ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' ',
       'w','a','s','d','W','A','S','D'].includes(e.key)) {
    cancelAutoNav();
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
  autoNav = null;                              // steering by hand overrides tap-to-travel
                                               // (keys are re-set just below, so no stale press)
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
         (typeof dialogueOpen !== 'undefined' && dialogueOpen) ||
         (typeof cutsceneInputLocked !== 'undefined' && cutsceneInputLocked) ||
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
      // A quick touch that never left the dead-zone is a tap. Weapons now live on
      // the left-side action buttons, so a canvas tap is contextual: on the hero
      // it opens the menu; next to an interactable it talks/loots; elsewhere it's
      // a no-op. A drag (moved) or long hold was movement, so it just ends.
      const wasTap = !touchJoystick.moved && (Date.now() - touchJoystick.startTime) < TAP_MS;
      const tapX = touchJoystick.x, tapY = touchJoystick.y;
      joyEnd();
      if (wasTap && !gameplayTouchBlocked()) handleCanvasTap(tapX, tapY);
      e.preventDefault();
      break;
    }
  }
}

// Map a canvas tap (in canvas-local px) to a world action. The camera transform
// is sx = (worldCol - camC) * TILE_PX (see render.js), so it inverts cleanly.
//   • tap on/adjacent-to the hero  → open the radial menu
//   • tap on an interactable       → walk to it (auto-path), then talk / open / travel
//   • tap on open ground           → nothing (movement is the joystick drag)
function handleCanvasTap(x, y) {
  const ts = (typeof TILE_PX !== 'undefined' && TILE_PX) ? TILE_PX : 48;
  const wx = camC + x / ts, wy = camR + y / ts;         // tap → world tile coords
  cancelAutoNav();                                       // a fresh tap overrides any walk

  // On (or right at) the hero → toggle the inventory / menu ring.
  if (Math.hypot(wx - (player.x + 0.5), wy - (player.y + 0.5)) < 0.9) {
    if (typeof toggleRadialMenu === 'function') toggleRadialMenu();
    return;
  }

  // Tapped an interactable (villager / chest / portal-keeper)? Head for it.
  const target = findTappedInteractable(wx, wy);
  if (!target) return;                                   // open ground → no-op

  // Already adjacent → interact right away; otherwise auto-path to an adjacent
  // tile and fire the interaction on arrival.
  if (target.adjacentNow()) { target.act(); return; }
  const path = findPathToGoals(target.goals);
  if (!path) return;                                     // no walkable route
  autoNav = { path, i: 0, act: target.act, mapRef: currentMap(),
              lastPos: player.x + ',' + player.y, stuckMs: 0 };
}

// ─── Tap-to-travel (auto-path) ───────────────────────────────────────────────
// A tap on a distant villager / chest walks the hero there and then interacts.
// We drive the existing grid movement by injecting arrow-key presses toward the
// next path tile (so terrain speed, collision and animation all stay identical
// to a hand-walked route); on arrival the stored interaction fires.
let autoNav = null;   // { path:[[c,r]…], i, act, mapRef, lastPos, stuckMs } | null

function cancelAutoNav() {
  if (!autoNav) return;
  autoNav = null;
  if (typeof joyClearKeys === 'function') joyClearKeys();
}

// Identify a tapped interactable near world point (wx,wy). Returns a descriptor
// with the interaction fn, an adjacency test, and the walkable goal tiles to
// path toward — or null if nothing interactable is under/next to the tap.
function findTappedInteractable(wx, wy) {
  const idx = (c, r) => r * MCOLS + c;
  const map = mapData();
  const passable = (c, r) => {
    if (c < 0 || r < 0 || c >= MCOLS || r >= MROWS) return false;
    if (player.activeArmorElement === 'water' && map[r] && map[r][c] === T.MEDIUM_WATER) return true;
    return !isSolid(map, c, r);
  };

  // Villagers (incl. shopkeepers / Gatekeeper) — nearest one within ~1.2 tiles of
  // the tap wins, so a fat-finger tap that lands just off the sprite still counts.
  if (typeof villagers !== 'undefined' && villagers && villagers.length) {
    let best = null, bestD = 1.2;
    for (const v of villagers) {
      const d = Math.hypot((v.x + 0.5) - wx, (v.y + 0.5) - wy);
      if (d < bestD) { bestD = d; best = v; }
    }
    if (best) {
      const goals = new Set();
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (!dc && !dr) continue;
        const c = best.x + dc, r = best.y + dr;
        if (passable(c, r)) goals.add(idx(c, r));
      }
      return {
        goals,
        adjacentNow: () => Math.abs(best.x - player.x) <= 1 && Math.abs(best.y - player.y) <= 1,
        act: () => { if (typeof tryVillagerInteraction === 'function') tryVillagerInteraction(); },
      };
    }
  }

  // Chest tiles — check the tapped tile and its immediate neighbours (large / boss
  // chests span 2 tiles), pick the closest chest cell to the tap.
  const tc = Math.floor(wx), tr = Math.floor(wy);
  let cc = -1, cr = -1, bestD = Infinity;
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    const c = tc + dc, r = tr + dr;
    if (c < 0 || r < 0 || c >= MCOLS || r >= MROWS) continue;
    if (!isChestTile(map[r][c])) continue;
    const d = Math.hypot((c + 0.5) - wx, (r + 0.5) - wy);
    if (d < bestD) { bestD = d; cc = c; cr = r; }
  }
  if (cc >= 0) {
    const goals = new Set();
    for (const [dc, dr] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const c = cc + dc, r = cr + dr;
      if (passable(c, r)) goals.add(idx(c, r));
    }
    return {
      goals,
      adjacentNow: () => Math.abs(cc - player.x) + Math.abs(cr - player.y) === 1,
      act: () => { if (typeof tryChestInteraction === 'function') tryChestInteraction(); },
    };
  }
  return null;
}

// Breadth-first search on the current map from the hero to the nearest tile in
// `goalSet` (a Set of r*MCOLS+c cell indices). Returns the path as [c,r] steps
// (start-exclusive, goal-inclusive), or null if no route is found within the cap.
function findPathToGoals(goalSet) {
  if (!goalSet || goalSet.size === 0) return null;
  const map = mapData();
  const N = MROWS * MCOLS;
  const idx = (c, r) => r * MCOLS + c;
  const canSwimMedium = player.activeArmorElement === 'water';
  const passable = (c, r) => {
    if (c < 0 || r < 0 || c >= MCOLS || r >= MROWS) return false;
    if (canSwimMedium && map[r] && map[r][c] === T.MEDIUM_WATER) return true;
    return !isSolid(map, c, r);
  };
  const prev = new Int32Array(N).fill(-1);
  const seen = new Uint8Array(N);
  const start = idx(player.x, player.y);
  const queue = [[player.x, player.y]];
  seen[start] = 1;
  let head = 0, nodes = 0, goalCell = -1;
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (head < queue.length && nodes < 8000) {
    const [c, r] = queue[head++]; nodes++;
    if (goalSet.has(idx(c, r))) { goalCell = idx(c, r); break; }
    for (const [dc, dr] of DIRS) {
      const nc = c + dc, nr = r + dr, ni = idx(nc, nr);
      if (nc < 0 || nr < 0 || nc >= MCOLS || nr >= MROWS) continue;
      if (seen[ni] || !passable(nc, nr)) continue;
      seen[ni] = 1; prev[ni] = idx(c, r);
      queue.push([nc, nr]);
    }
  }
  if (goalCell < 0) return null;
  const path = [];
  for (let cur = goalCell; cur !== start && cur >= 0; cur = prev[cur]) {
    path.push([cur % MCOLS, Math.floor(cur / MCOLS)]);
  }
  path.reverse();
  return path;
}

// Per-frame driver: nudge the hero one step along the planned path, or fire the
// stored interaction once the path is spent. Called from update() ahead of
// stepPlayerMovement so the injected keys are consumed the same frame.
function advanceAutoNav(dt) {
  if (!autoNav) return;
  // The route belongs to one map — a transition invalidates it.
  if (typeof currentMap === 'function' && autoNav.mapRef !== currentMap()) { cancelAutoNav(); return; }

  // Skip any leading tiles we've already reached (a step may cover one per frame).
  while (autoNav.i < autoNav.path.length &&
         player.x === autoNav.path[autoNav.i][0] && player.y === autoNav.path[autoNav.i][1]) {
    autoNav.i++;
  }
  // Path spent → we should be adjacent; run the interaction and stop.
  if (autoNav.i >= autoNav.path.length) {
    const fn = autoNav.act;
    cancelAutoNav();
    if (typeof fn === 'function') fn();
    return;
  }
  // Give up if we've made no progress for a while (blocked by a wandering enemy,
  // a moved villager, etc.) so the hero can't march in place forever.
  const posKey = player.x + ',' + player.y;
  if (posKey === autoNav.lastPos) {
    autoNav.stuckMs += (dt || 16);
    if (autoNav.stuckMs > 1600) { cancelAutoNav(); return; }
  } else {
    autoNav.lastPos = posKey; autoNav.stuckMs = 0;
  }
  // Press the arrow key(s) toward the next tile (BFS steps are orthogonal, so
  // exactly one axis differs). joyClearKeys wipes last frame's injected keys.
  if (typeof joyClearKeys === 'function') joyClearKeys();
  const [nc, nr] = autoNav.path[autoNav.i];
  if      (nc < player.x) keys['ArrowLeft']  = true;
  else if (nc > player.x) keys['ArrowRight'] = true;
  if      (nr < player.y) keys['ArrowUp']    = true;
  else if (nr > player.y) keys['ArrowDown']  = true;
}
canvas.addEventListener('touchend',    onCanvasTouchEnd, { passive: false });
canvas.addEventListener('touchcancel', onCanvasTouchEnd, { passive: false });

// ─── On-screen action buttons ────────────────────────────────────────────────
// The weapon-bar slots double as tap controls on touch. Each routes through the
// same cooldown / weapons-locked guards as the keyboard path in update(); pointer
// events fire instantly and skip the synthetic ghost-click.
function triggerAction(kind) {
  const cm = currentMap();
  const weaponsLocked = !!cm && ((cm.type === 'village' && cm.activated) ||
                                 cm.type === 'homevillage');
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

// ─── Touch mode: the left action pad ─────────────────────────────────────────
// Which scheme is showing is decided in config.js (html[data-ui]) and the CSS
// hides whichever bar isn't in use. The pad's buttons are bound unconditionally
// — they're display:none in desktop mode, and the mode can now flip mid-session,
// so binding them behind a one-shot capability check would leave them dead.
//
// The left pad fires directly on tap — no select-then-tap dance. Each sets
// player.weapon first so the active ring (updateHUD) tracks the last button
// used; triggerAction then runs the same cooldown / weapons-locked guards as
// the keyboard path. (triggerAction already sets 'bow'/'item' internally, but
// setting it here keeps the highlight correct even when a shot is on cooldown.)
bindTap('ta-sword', () => { player.weapon = 'sword'; triggerAction('sword'); });
bindTap('ta-bow',   () => { player.weapon = 'bow';   triggerAction('bow');   });
bindTap('ta-item',  () => {
  player.weapon = (typeof inventorySelectionType !== 'undefined') ? inventorySelectionType : 'bomb';
  triggerAction('item');
});

// Reword every on-screen hint that assumes one input scheme, and relabel the
// two 🎮 mode buttons. Called by applyUiMode/setUiMode (config.js) on every
// change, so the text tracks a live switch instead of being baked in at boot.
function refreshControlHints() {
  const touch = (typeof uiModeIsTouch === 'function') ? uiModeIsTouch() : false;

  const titleHint = document.getElementById('title-hint');
  if (titleHint) {
    titleHint.textContent = touch
      ? 'Drag: move · Tap hero: menu · Left buttons: attack'
      : 'WASD / Arrows: move · Z: sword · V: menu';
  }

  const label = (typeof uiModeLabel === 'function') ? uiModeLabel() : '';
  const titleBtn = document.getElementById('title-ui-mode');
  if (titleBtn) titleBtn.textContent = '🎮 Controls: ' + label;
  const rowBtn = document.getElementById('ui-mode-btn');
  if (rowBtn) rowBtn.textContent = '🎮 ' + label;
}
// config.js set data-ui before this file loaded, so the initial apply was a
// no-op for the hints — paint them once now that the function exists.
refreshControlHints();

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
// This used to be the body of a requestAnimationFrame callback, to "defer first
// resize so the bottom bars have measurable offsetHeight values". The deferral
// wasn't buying that: these scripts run at the end of <body> with the
// stylesheets already applied, and reading offsetHeight forces a synchronous
// layout, so the bars measure correctly right here.
//
// What the rAF *did* buy was a world that never gets built when no frame is
// produced — rAF doesn't fire in a background tab, so loading the game into one
// left worldMaps empty, no title screen, and every global half-initialised until
// the tab was focused. Boot is plain code now; only the render loop, which
// genuinely wants frames, still goes through rAF.
function boot() {
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
  // Re-measure once a frame has actually been painted. Belt and braces for the
  // late-layout case the old rAF was reaching for (a bar that reflows after
  // first paint) — but now it only corrects the canvas size, and the world is
  // already up whether or not this ever runs.
  requestAnimationFrame(() => { resizeCanvas(); });
  requestAnimationFrame(loop);
}

// Scripts sit at the end of <body>, so the DOM is normally complete already and
// this runs immediately; the listener is the fallback if that ever changes.
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
