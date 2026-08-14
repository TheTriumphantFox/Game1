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
  // The Emperor's crown rolling to the hero's feet (tower.js) — up here with
  // them for the same reason: it rolls during a `wait` step of the death scene,
  // and everything below the freeze chain is stopped while that step runs.
  if (typeof stepEmperorCrown === 'function') stepEmperorCrown(dt);
  // Pause the entire world while the radial inventory menu is open. Render is
  // still called every frame so the menu animates, and the HUD still refreshes
  // (so the menu's purchases / item use visually update), but every dt-based
  // state change is frozen.
  // shopOpen / portalOpen / modalMode were missing from this list. They gate
  // *input* (the keydown chain below, and gameplayTouchBlocked) but not the world,
  // so the hero kept walking under an open shop or save dialog — far enough to hit
  // tryTransition() and leave the map with the modal still up. That gap is also why
  // closeShopModals has to force-clear `keys` on the way out (shop-core.js): it was
  // treating the symptom. modalMode is the save/load modal (save.js), null when shut.
  if ((typeof radialMenuOpen    !== 'undefined' && radialMenuOpen)    ||
      (typeof ledgerOpen        !== 'undefined' && ledgerOpen)        ||
      (typeof statsPageOpen     !== 'undefined' && statsPageOpen)     ||
      (typeof worldMapOpen      !== 'undefined' && worldMapOpen)      ||
      (typeof sysMenuOpen       !== 'undefined' && sysMenuOpen)       ||
      (typeof modalMode         !== 'undefined' && modalMode)         ||
      (typeof shopOpen          !== 'undefined' && shopOpen)          ||
      (typeof portalOpen        !== 'undefined' && portalOpen)        ||
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
  if (player.punchTimer    > 0) player.punchTimer    -= dt;
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
  if (typeof updateShrinePuzzle === 'function') updateShrinePuzzle(dt);
  if (typeof stepAbilityCooldown === 'function') stepAbilityCooldown(dt);
  // The Emperor's HP thresholds (tower.js). Watched per frame rather than hooked
  // into the eight places that subtract enemy HP. After the freeze chain on
  // purpose: while the 50% line's box is still up, the 15% line waits its turn.
  if (typeof stepFinalBoss === 'function') stepFinalBoss(dt);

  // Quick weapon switch. [2] does nothing until Grandmother's Bow is in hand.
  if (keys['1'] && player.hasSword) player.weapon = 'sword';
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

  // [Z] is the sword once there is one, and a punch until then. The punch is
  // deliberately NOT behind weaponsLocked: that lock covers the home village, and
  // the home village is where Beat 2's dog encounter teaches this very button. It
  // is safe to leave open because the punch can only ever harm the dog (see
  // doPunch) — there is nothing in a peaceful town for it to break.
  // The one exception to the punch's exemption: while the village is burning,
  // the encounter is unbeatable by design and there must be nothing to swing at
  // and no way to try. Beat 2's dog is long resolved by then, so nothing is lost.
  const burningNow = typeof hasFlag === 'function' && hasFlag('village_burning');
  if (actZ && attackCooldown <= 0) {
    if (!player.hasSword) {
      if (!burningNow) {
        attackCooldown = 280;
        doPunch();
      }
    } else if (!weaponsLocked) {
      attackCooldown = 280;
      doSwordSwing();
    }
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
  // The dog's phase change and its two exits, before the beat check below — so a
  // chase that ends this frame lets Beat 3 fire on the same frame.
  if (typeof stepPrologueDog === 'function') stepPrologueDog(dt);
  // Beat 3's birds and wind.
  if (typeof stepPrologueAmbience === 'function') stepPrologueAmbience(dt);
  if (typeof checkPrologueTriggers === 'function') checkPrologueTriggers();

  updateHUD();
}

// ─── Input ────────────────────────────────────────────────────────────────────
// Set both the literal e.key and its case-folded variant for single-char keys.
// This keeps the letter actions (Z / X / C / V / P) consistent when Shift is
// pressed or released while one is held: browsers report keyup with the
// post-Shift case (e.g. 'Z' if Shift was down), which would otherwise leave the
// lower-case 'z' stuck on. Movement is arrow-keys only and unaffected.
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
  // Nothing reaches the world before a game is chosen. update() early-returns on
  // this same flag, which freezes world *stepping* — but these handlers act on
  // the keypress directly and fire regardless: under the opaque title overlay,
  // SPACE looted the map-0 chest, V opened the radial menu, P drank a potion,
  // Tab toggled the minimap. The name prompt runs before the game starts and
  // owns its own input (it's on the input element, which stops propagation).
  if (!gameStarted && !namePromptOpen) return;
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
  if (typeof sysMenuOpen !== 'undefined' && sysMenuOpen) {
    // Esc — or V again — closes the game menu.
    if (e.key === 'Escape' || e.key === 'v' || e.key === 'V') closeSysMenu();
    return;   // game menu swallows gameplay input
  }
  // The save / load modal (save.js; modalMode is 'save' | 'load', null when shut).
  // This branch was missing, and it is the one modal with a TEXT FIELD in it — so
  // every gameplay key fired while the player typed a save name: SPACE was
  // preventDefault()ed and never reached the input (you could not type a space in a
  // save name at all), V opened the radial menu on top of the dialog, Z swung the
  // sword, P drank a potion. Deliberately no 'v' close here, unlike the panels
  // above: V is a letter someone may well want in a save name, and the modal has its
  // own ✕ Close. Escape closes, everything else is swallowed.
  if (typeof modalMode !== 'undefined' && modalMode) {
    if (e.key === 'Escape') closeModal();
    return;   // save/load modal swallows gameplay input
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
    // Hendricks' dog, while it is still sitting in the gate. It is an enemy, not
    // a villager, so it needs its own line here.
    if (typeof tryDogInteraction === 'function' && tryDogInteraction()) {
      e.preventDefault();
      return;
    }
    if (typeof tryShrineInteraction === 'function' && tryShrineInteraction()) {
      e.preventDefault();
      return;
    }
    // A hidden rune mark under or beside the hero (abilities.js). Before chests
    // and after everything else: it is a no-op without Arcane Sight, and a rune
    // trail is laid on open ground where nothing else competes for the press.
    if (typeof tryRuneMarkInteraction === 'function' && tryRuneMarkInteraction()) {
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
      ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) {
    cancelAutoNav();
  }
  setKey(e.key, true);
  if (e.key === 'Tab') { e.preventDefault(); if (!e.repeat) showMinimap = !showMinimap; }
  // 'P' drinks one Health Potion (fires on the press itself, not while held)
  if (e.key === 'p' || e.key === 'P') { e.preventDefault(); if (!e.repeat) usePotion(); }
  // 'F' uses the equipped shrine ability — Updraft Glide or Shadow Step
  // (abilities.js). On the press, never on the repeat: both of them move the
  // hero, and holding the key should not walk them across a lake.
  if (e.key === 'f' || e.key === 'F') {
    e.preventDefault();
    if (!e.repeat && typeof useEquippedAbility === 'function') useEquippedAbility();
  }
  if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
    e.preventDefault();
  }
});
document.addEventListener('keyup', e => { setKey(e.key, false); });

// When the page loses focus or visibility, any held keys never get their
// keyup event — drop them all so movement/bow don't keep firing on return.
window.addEventListener('blur', () => { clearAllKeys(); dropTouchState(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { clearAllKeys(); dropTouchState(); }
});
// A touch in flight gets no touchend when the page goes away — forget the stick
// and any pending tap so neither resumes on return.
function dropTouchState() {
  if (typeof joyEnd === 'function') joyEnd();
  canvasTap = null;
}

// ─── Touch: the movement pad ────────────────────────────────────────────────
// An anchored virtual stick living in the bottom-left corner of the canvas
// (mirroring the action buttons in the bottom-right — same edge gap, see
// --touch-gap in game.css). Movement comes from the pad and nowhere else: a
// thumb has to land on it to steer, so the rest of the canvas is free for taps
// (hero → menu, interactable → walk to it) and the hero can't be walked off by a
// stray touch. The centre never moves; the knob just tracks the finger.
//
// Direction is fed to stepPlayerMovement as the same arrow keys the keyboard
// uses, so nothing downstream needs to know a thumb is driving. How *far* the
// knob is pushed sets the pace: at the dead-zone edge the hero creeps at
// JOY_SLOW_SCALE of walk speed, at the rim he's at full speed, and it ramps
// smoothly between (see joySpeedScale, read by stepPlayerMovement's step gate).
// While the radial menu (drawn on the canvas) is open, canvas touches drive the
// menu instead.
const touchJoystick = { active: false, id: null, cx: 0, cy: 0, x: 0, y: 0, mag: 0,
                        steered: false };
const JOY_DEAD  = 14;   // px — below this from centre: stand still
const JOY_R     = 46;   // px — pad radius (drawTouchJoystick draws this size)
const JOY_GAP   = 20;   // px — gap to the canvas edge; keep in sync with the
                        // --touch-gap CSS var the action buttons use
const JOY_SLOP  = 22;   // px — extra grab radius around the pad for fat thumbs
const JOY_SLOW_SCALE = 0.45;  // pace just outside the dead-zone, vs full speed

// Double-tapping the pad cycles the view (normal → zoomed out → full-screen
// minimap). That used to be a double-tap on the weapon bar, which touch mode
// hides — so both the zoomed-out view and the minimap were unreachable on a
// phone. Only a tap that never steered counts, so it can't fire mid-walk.
let joyLastTapMs = 0;
const JOY_DOUBLE_MS = 320;

// A touch that starts off the pad can only ever be a tap — tracked separately so
// it survives alongside a thumb that's steering, and so a drag isn't mistaken
// for one. { id, x, y, sx, sy } while a candidate is down, else null.
//
// There's deliberately no time limit. Back when a canvas hold walked the hero, a
// tap had to be quick to be told apart from steering; movement lives on the pad
// now, so a press off the pad has no other meaning however long it's held — and
// holding a thumb on the hero for half a second is exactly what people do.
let canvasTap = null;
const TAP_SLOP = 12;    // px — drift past this and it's a drag, not a tap

// Where the anchored pad lives, in canvas-local px: bottom-left corner, held
// clear of a landscape notch and the home indicator (safeInsetLeft/Bottom,
// resolved in resizeCanvas — both 0 on a phone without them). Touch mode hides
// every bottom bar, so the canvas runs to the very edge of the screen and the
// pad is what has to do the insetting.
function joyHome() {
  const inset = n => (typeof n === 'number' ? n : 0);
  const left   = JOY_GAP + inset(safeInsetLeft);
  const bottom = JOY_GAP + inset(safeInsetBottom);
  return { x: left + JOY_R, y: canvas.height - bottom - JOY_R };
}
// The pad is a touch-mode control, and it hides with the action buttons so a
// thumb can't steer under the radial menu or a modal.
function joyPadVisible() {
  if (typeof uiModeIsTouch !== 'function' || !uiModeIsTouch()) return false;
  if (typeof radialMenuOpen !== 'undefined' && radialMenuOpen) return false;
  return !gameplayTouchBlocked();
}
function joyInPad(x, y) {
  const h = joyHome();
  return Math.hypot(x - h.x, y - h.y) <= JOY_R + JOY_SLOP;
}

function joyClearKeys() {
  keys['ArrowUp'] = keys['ArrowDown'] = keys['ArrowLeft'] = keys['ArrowRight'] = false;
}
function joyEnd() {
  // A hold that never left the dead-zone was a tap on the pad, not steering —
  // remember when, so a second one lands as a double-tap.
  if (touchJoystick.active && !touchJoystick.steered) joyLastTapMs = Date.now();
  touchJoystick.active = false;
  touchJoystick.id = null;
  touchJoystick.mag = 0;
  touchJoystick.steered = false;
  joyClearKeys();
}
// Translate the knob offset into 8-way arrow-key presses via its angle octant,
// and record how far it's pushed (0…1 across the usable travel) for the pace.
function joyUpdate(x, y) {
  // Something took over mid-hold (the menu ring opened, a shop popped up) — let
  // go of the stick rather than walking the hero around under it.
  if (!joyPadVisible()) { joyEnd(); return; }
  const dx = x - touchJoystick.cx, dy = y - touchJoystick.cy;
  const dist = Math.hypot(dx, dy);
  touchJoystick.x = x; touchJoystick.y = y;
  joyClearKeys();
  if (dist < JOY_DEAD) { touchJoystick.mag = 0; return; }   // dead-zone → stand still
  touchJoystick.mag = Math.min((dist - JOY_DEAD) / (JOY_R - JOY_DEAD), 1);
  touchJoystick.steered = true;                // left the dead-zone: a walk, not a tap
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

// Walk pace as a multiplier on normal speed, for whoever is driving: 1 for the
// keyboard and for tap-to-travel (no stick held), and a push-proportional ramp
// while a thumb is on the pad. stepPlayerMovement divides its step interval by
// this, so terrain penalties (mud, water) still stack on top.
function joySpeedScale() {
  if (!touchJoystick.active || touchJoystick.mag <= 0) return 1;
  return JOY_SLOW_SCALE + touchJoystick.mag * (1 - JOY_SLOW_SCALE);
}

// A DOM overlay (shop / portal / ledger / save modal) is capturing input, or the
// full-screen minimap view is up — the canvas shouldn't walk/attack underneath it.
function gameplayTouchBlocked() {
  return (typeof shopOpen   !== 'undefined' && shopOpen)   ||
         (typeof portalOpen !== 'undefined' && portalOpen) ||
         (typeof ledgerOpen !== 'undefined' && ledgerOpen) ||
         (typeof statsPageOpen !== 'undefined' && statsPageOpen) ||
         (typeof worldMapOpen !== 'undefined' && worldMapOpen) ||
         (typeof sysMenuOpen !== 'undefined' && sysMenuOpen) ||
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
  // The full-screen minimap blocks gameplay input, which would leave a touch
  // player trapped in it (the view control is the pad, and the pad is hidden
  // there) — so while it's up, a tap anywhere steps the view on instead.
  if (typeof viewMode !== 'undefined' && viewMode === 2) {
    if (typeof cycleViewMode === 'function') cycleViewMode();
    e.preventDefault();
    return;
  }
  if (gameplayTouchBlocked()) { return; }
  const t = e.changedTouches[0];
  const rect = canvas.getBoundingClientRect();
  const x = t.clientX - rect.left, y = t.clientY - rect.top;
  // On the pad → steer. Anywhere else → a tap candidate and nothing more; the
  // hero only ever walks from the pad.
  if (!touchJoystick.active && joyPadVisible() && joyInPad(x, y)) {
    const home = joyHome();
    // Two pad taps in quick succession cycle the view rather than walking.
    if (Date.now() - joyLastTapMs < JOY_DOUBLE_MS) {
      joyLastTapMs = 0;
      if (typeof cycleViewMode === 'function') cycleViewMode();
      e.preventDefault();
      return;
    }
    touchJoystick.active = true;
    touchJoystick.id = t.identifier;
    touchJoystick.cx = home.x;
    touchJoystick.cy = home.y;
    joyUpdate(x, y);
  } else if (!canvasTap) {
    canvasTap = { id: t.identifier, x, y, sx: x, sy: y };
  }
  e.preventDefault();
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  const rect = canvas.getBoundingClientRect();
  for (const t of e.changedTouches) {
    const x = t.clientX - rect.left, y = t.clientY - rect.top;
    if (touchJoystick.active && t.identifier === touchJoystick.id) {
      joyUpdate(x, y);
      e.preventDefault();
    } else if (canvasTap && t.identifier === canvasTap.id) {
      canvasTap.x = x; canvasTap.y = y;
      // Drifted too far to still be a tap — drop it rather than firing an
      // interaction where the finger ended up.
      if (Math.hypot(x - canvasTap.sx, y - canvasTap.sy) > TAP_SLOP) canvasTap = null;
      e.preventDefault();
    }
  }
}, { passive: false });

function onCanvasTouchEnd(e) {
  for (const t of e.changedTouches) {
    if (touchJoystick.active && t.identifier === touchJoystick.id) {
      joyEnd();
      e.preventDefault();
    } else if (canvasTap && t.identifier === canvasTap.id) {
      // A touch off the pad that stayed put is a tap, however long it was held.
      // Weapons live on the action buttons, so it's contextual: on the hero it
      // opens the menu; next to an interactable it talks/loots; elsewhere it's a
      // no-op. A cancelled touch (the browser took it for a gesture) is not.
      const wasTap = e.type !== 'touchcancel';
      const tapX = canvasTap.x, tapY = canvasTap.y;
      canvasTap = null;
      if (wasTap && !gameplayTouchBlocked()) handleCanvasTap(tapX, tapY);
      e.preventDefault();
    }
  }
}

// Map a canvas tap (in canvas-local px) to a world action. The camera transform
// is sx = (worldCol - camC) * TILE_PX (see render.js), so it inverts cleanly.
//   • tap on/adjacent-to the hero  → open the radial menu
//   • tap on an interactable       → walk to it (auto-path), then talk / open / travel
//   • tap on open ground           → nothing (movement lives on the pad)
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
    if (typeof villagerAt === 'function' && villagerAt(c, r)) return false;
    if (player.activeArmorElement === 'water' && map[r] && map[r][c] === T.MEDIUM_WATER) return true;
    if (typeof shrineDynamicSolidAt === 'function' && shrineDynamicSolidAt(currentMap(),c,r)) return false;
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

  if (typeof findTappedShrineInteractable === 'function') {
    const shrineTarget = findTappedShrineInteractable(wx, wy, passable, idx);
    if (shrineTarget) return shrineTarget;
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
    if (typeof villagerAt === 'function' && villagerAt(c, r)) return false;
    if (canSwimMedium && map[r] && map[r][c] === T.MEDIUM_WATER) return true;
    if (typeof shrineDynamicSolidAt === 'function' && shrineDynamicSolidAt(currentMap(),c,r)) return false;
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
  // The punch is exempt from the town lock for the same reason as the keyboard
  // path in update() — Beat 2 teaches it inside the home village, and it can't
  // hurt anything but the dog. Checked before the lock, not after.
  if (kind === 'sword' && !player.hasSword) {
    const burning = typeof hasFlag === 'function' && hasFlag('village_burning');
    if (!burning && attackCooldown <= 0) { attackCooldown = 280; doPunch(); }
    updateHUD();
    return;
  }
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
  if (typeof tryDogInteraction === 'function' && tryDogInteraction()) return;
  if (typeof tryShrineInteraction === 'function' && tryShrineInteraction()) return;
  if (typeof tryRuneMarkInteraction === 'function' && tryRuneMarkInteraction()) return;
  if (typeof tryChestInteraction === 'function') tryChestInteraction();
});

// ─── Touch mode: the bottom-right action pad ─────────────────────────────────
// Which scheme is showing is decided in config.js (html[data-ui]) and the CSS
// hides whichever bar isn't in use. The pad's buttons are bound unconditionally
// — they're display:none in desktop mode, and the mode can now flip mid-session,
// so binding them behind a one-shot capability check would leave them dead.
//
// The action pad fires directly on tap — no select-then-tap dance. Each sets
// player.weapon first so the active ring (updateHUD) tracks the last button
// used; triggerAction then runs the same cooldown / weapons-locked guards as
// the keyboard path. (triggerAction already sets 'bow'/'item' internally, but
// setting it here keeps the highlight correct even when a shot is on cooldown.)
bindTap('ta-sword', () => { player.weapon = 'sword'; triggerAction('sword'); });
bindTap('ta-bow',   () => { player.weapon = 'bow';   triggerAction('bow');   });
// The third button drinks a Health Potion outright — the touch answer to the P
// key. Deliberately not routed through triggerAction: a potion is not a weapon,
// so it still works in the villages where weapons are locked. It shares the item
// cooldown so holding the button can't chain-drink a whole satchel, and only
// arms that cooldown when a potion was actually drunk (usePotion no-ops at full
// HP or empty, and says so).
bindTap('ta-potion', () => {
  if (bombCooldown > 0) return;
  const before = player.potions || 0;
  usePotion();
  if ((player.potions || 0) < before) { bombCooldown = 600; buzz(12); }
});
// The fourth button is the touch half of [F]: the equipped shrine ability. Bound
// unconditionally like the rest of the pad; updateHUD is what shows and hides it,
// because until the Air shrine falls there is nothing for it to do.
bindTap('ta-ability', () => {
  if (typeof useEquippedAbility === 'function') useEquippedAbility();
});

// Reword every on-screen hint that assumes one input scheme, and relabel the
// two 🎮 mode buttons. Called by applyUiMode/setUiMode (config.js) on every
// change, so the text tracks a live switch instead of being baked in at boot.
function refreshControlHints() {
  const touch = (typeof uiModeIsTouch === 'function') ? uiModeIsTouch() : false;

  const titleHint = document.getElementById('title-hint');
  if (titleHint) {
    // The desktop hint names the [Z] action, so it has to say what [Z] actually
    // does right now. A hero who hasn't reached Beat 5 has no sword, and naming
    // one on the title screen would promise a weapon the prologue spends its
    // whole length withholding.
    const melee = player.hasSword ? 'sword' : 'punch';
    titleHint.textContent = touch
      ? 'Left pad: move · Tap hero: menu · Right buttons: attack'
      : `Arrow keys: move · Z: ${melee} · V: menu`;
  }

  const label = (typeof uiModeLabel === 'function') ? uiModeLabel() : '';
  const titleBtn = document.getElementById('title-ui-mode');
  if (titleBtn) titleBtn.textContent = '🎮 Controls: ' + label;
  // The in-game copy of this button lived in the save row, which is gone — the
  // radial MENU ring's Controls entry reads uiModeLabel() itself, so there's
  // nothing else to repaint here.
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
  revealWalk(currentMap(), player.x, player.y);
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
