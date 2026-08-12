// ─── Cutscene sequencer ───────────────────────────────────────────────────────
// A data-driven step runner for scripted beats. A cutscene is a plain array of
// step objects; playCutscene() walks it, stepCutscene(dt) advances the live one
// each frame, and the whole thing is over when the array runs out.
//
// The point of this file is that prologue.js can *read* like the script it was
// written from, instead of being a nest of setTimeout callbacks. Adding a beat
// should mean adding a line to an array.
//
// ─── Three flags, because they mean three different things ───
// `cutsceneActive`      — a scene is playing. Drives stepCutscene; nothing else.
// `cutsceneInputLocked` — swallow gameplay keydown and block the touch pad, so
//                         the player can't drive the hero. On for the whole
//                         scene by default; a `control: true` step hands the
//                         keys back *without* ending the scene, which is what
//                         Beat 4's run home needs — the player drives, but the
//                         cutscene is still standing by to fire Beat 5 on
//                         arrival (see the `awaitPlayerNear` step).
// `cutsceneBlocking`    — the *current step* wants the world frozen (dialogue, a
//                         timed wait, a camera pan). Joins the freeze OR-chain in
//                         update(). Steps that need the world to keep stepping —
//                         `walkPlayer`, `awaitPlayerNear` — clear it.
//
// All three are read via `typeof` guards in main.js, matching how every other
// overlay flag in this codebase is wired.
//
// Note that stepCutscene() and stepDialogue() are called from update() *before*
// the freeze early-return, so a blocking step still gets its timer ticked. That
// ordering is load-bearing: put them after the return and every timed step
// deadlocks.

let cutsceneActive = false;
let cutsceneInputLocked = false;
let cutsceneBlocking = false;

let _csSteps = [];        // the step array being played
let _csIndex = 0;         // which step is live
let _csOnDone = null;     // fired once, after the last step resolves
let _csStep = null;       // the live step object
let _csElapsed = 0;       // ms spent on the live step
let _csFrom = null;       // tween start values, captured when a step begins

// The Emperor during the prologue. Deliberately NOT an entry in `enemies` — he
// is a drawn actor with a position and nothing else, so there is no entity to
// target and the "unbeatable by design" encounter is unbeatable for free rather
// than by disabling combat against a real creature. Rendered in render.js.
//   { x, y, alt, scale, wing, shadow } | null
//   alt   — altitude in tiles; drives how far the ground shadow is offset
//   wing  — wingbeat phase, advanced here so it animates while the world is frozen
let prologueEmperor = null;

// Start a cutscene. Replaces any cutscene already running (a caller bug, but
// replacing beats deadlocking).
function playCutscene(steps, onDone) {
  if (!steps || !steps.length) { if (onDone) onDone(); return; }
  _csSteps = steps;
  _csIndex = -1;
  _csOnDone = onDone || null;
  cutsceneActive = true;
  cutsceneInputLocked = true;
  // Drop anything the player was holding when the scene started, and kill any
  // tap-to-travel route — both would otherwise keep driving the hero under us.
  if (typeof clearAllKeys === 'function') clearAllKeys();
  if (typeof cancelAutoNav === 'function') cancelAutoNav();
  _csAdvance();
}

// Move to the next step, resolving instant steps in a loop so a run of them
// costs one frame rather than one frame each.
function _csAdvance() {
  for (;;) {
    _csIndex++;
    if (_csIndex >= _csSteps.length) { _csFinish(); return; }
    _csStep = _csSteps[_csIndex];
    _csElapsed = 0;
    _csFrom = null;
    if (!_csBeginStep(_csStep)) return;   // step takes time — hand back to the loop
  }
}

// Set a step up. Returns true if it resolved instantly (so _csAdvance should
// keep going), false if it needs frames.
function _csBeginStep(s) {
  cutsceneBlocking = true;   // the default; individual steps opt out below

  // ─── Instant steps ───
  // Note there is deliberately no `flag:` step type. Story flags are set through
  // `run: () => setFlag('x')` so that a literal setFlag call exists in the source
  // — tools/lint-conventions.py greps for exactly that, and a flag set through a
  // data field is invisible to it ("checked but never set").
  if (s.run) { s.run(); return true; }
  if (s.tiles) {
    s.tiles(mapData(), currentMap());
    minimapDirty = true;
    return true;
  }
  if (s.face) {
    player.swordDir = { x: s.face.x || 0, y: s.face.y || 0 };
    return true;
  }
  if (s.emperor !== undefined) {
    // `emperor: null` dismisses him; an object sets or merges his state.
    prologueEmperor = s.emperor ? { alt: 0, scale: 1, wing: 0, ...(prologueEmperor || {}), ...s.emperor } : null;
    return true;
  }
  if (s.teleport) {
    if (s.teleport.mapId !== undefined) currentMapId = s.teleport.mapId;
    player.x = s.teleport.x; player.y = s.teleport.y;
    player.renderX = player.x; player.renderY = player.y;
    if (typeof revealWalk === 'function') revealWalk(currentMap(), player.x, player.y);
    camOverride = null;   // a jump cut takes the camera with it
    clampCam(true);
    minimapDirty = true;
    return true;
  }
  if (s.banner) { showMapMsg(s.banner); return true; }
  if (s.msg)    { showMsg(s.msg); return true; }
  if (s.shake !== undefined) {
    // Fire-and-forget: the shake decays on its own in render.js, so the scene
    // moves on immediately and the ground keeps rocking under the next line.
    shakeMag = s.shake;
    shakeMs  = s.ms || 600;
    return true;
  }
  if (s.camFollow) { camOverride = null; cutsceneBlocking = false; return true; }
  if (s.control !== undefined) {
    // Hand the keys back (control: true) or take them again (control: false)
    // *without* ending the scene — Beat 4's run home is the player driving while
    // the cutscene stands by. Taking control back re-clears held keys so the
    // hero doesn't keep sprinting into the next beat.
    cutsceneInputLocked = !s.control;
    if (!s.control && typeof clearAllKeys === 'function') clearAllKeys();
    cutsceneBlocking = false;
    return true;
  }

  // ─── Timed / awaited steps ───
  if (s.say) {
    startDialogue(s.say, () => { if (cutsceneActive) _csAdvance(); });
    return false;
  }
  if (s.wait !== undefined) return false;          // pure timer, handled below
  if (s.fade !== undefined) { _csFrom = fadeLevel; return false; }
  if (s.letterbox !== undefined) {
    _csFrom = letterboxLevel;
    cutsceneBlocking = false;   // bars slide in over live action
    return false;
  }
  if (s.pan) {
    _csFrom = { c: camC, r: camR };
    camOverride = { c: camC, r: camR };
    return false;
  }
  if (s.walkPlayer) {
    // Ride the existing tap-to-travel pathing so terrain speed, collision and
    // walk animation are identical to a hand-walked route (see advanceAutoNav).
    // The world must keep stepping for that to run, hence non-blocking.
    cutsceneBlocking = false;
    const goals = new Set([s.walkPlayer.y * MCOLS + s.walkPlayer.x]);
    const path = findPathToGoals(goals);
    if (!path) return true;   // no route — don't strand the scene, just skip
    autoNav = { path, i: 0, act: null, mapRef: currentMap(),
                lastPos: player.x + ',' + player.y, stuckMs: 0 };
    return false;
  }
  if (s.emperorFly) {
    _csFrom = prologueEmperor ? { ...prologueEmperor } : null;
    cutsceneBlocking = s.freeze !== false;
    return false;
  }
  if (s.awaitPlayerNear) {
    // Park the scene until the hero walks somewhere. Pairs with `control: true`
    // to make a player-driven stretch part of a cutscene rather than a gap
    // between two of them — no polling flag, no second entry point.
    cutsceneBlocking = false;
    return false;
  }

  return true;   // unrecognised step — skip rather than hang
}

// Per-frame driver. Called from update() ahead of the freeze early-return.
function stepCutscene(dt) {
  if (!cutsceneActive || !_csStep) return;
  const s = _csStep;
  _csElapsed += dt;

  // The Emperor's wings beat regardless of which step is live, so he never
  // freezes mid-air while someone is talking.
  if (prologueEmperor) prologueEmperor.wing = (prologueEmperor.wing + dt / 420) % 1;

  // Dialogue drives its own completion through the startDialogue callback.
  if (s.say) return;

  if (s.wait !== undefined) {
    if (_csElapsed >= s.wait) _csAdvance();
    return;
  }
  if (s.fade !== undefined) {
    const t = _csTween(s.ms);
    fadeLevel = _csFrom + (s.fade - _csFrom) * t;
    if (t >= 1) _csAdvance();
    return;
  }
  if (s.letterbox !== undefined) {
    const t = _csTween(s.ms);
    letterboxLevel = _csFrom + (s.letterbox - _csFrom) * t;
    if (t >= 1) _csAdvance();
    return;
  }
  if (s.pan) {
    const t = _csTween(s.ms);
    const dest = _csCamFor(s.pan.x, s.pan.y);
    camOverride = { c: _csFrom.c + (dest.c - _csFrom.c) * t,
                    r: _csFrom.r + (dest.r - _csFrom.r) * t };
    camC = camOverride.c; camR = camOverride.r;
    if (t >= 1) _csAdvance();
    return;
  }
  if (s.walkPlayer) {
    // autoNav clears itself on arrival (or when it gives up after being blocked).
    if (!autoNav) _csAdvance();
    return;
  }
  if (s.awaitPlayerNear) {
    const g = s.awaitPlayerNear;
    const d = Math.abs(player.x - g.x) + Math.abs(player.y - g.y);
    if (d <= (g.dist === undefined ? 1 : g.dist)) _csAdvance();
    return;
  }
  if (s.emperorFly) {
    const t = _csTween(s.ms);
    const from = _csFrom || { x: s.emperorFly.x, y: s.emperorFly.y, alt: 0, scale: 1 };
    prologueEmperor = {
      ...(prologueEmperor || {}),
      x:     from.x     + ((s.emperorFly.x     !== undefined ? s.emperorFly.x     : from.x)     - from.x)     * t,
      y:     from.y     + ((s.emperorFly.y     !== undefined ? s.emperorFly.y     : from.y)     - from.y)     * t,
      alt:   from.alt   + ((s.emperorFly.alt   !== undefined ? s.emperorFly.alt   : from.alt)   - from.alt)   * t,
      scale: from.scale + ((s.emperorFly.scale !== undefined ? s.emperorFly.scale : from.scale) - from.scale) * t,
    };
    if (t >= 1) _csAdvance();
    return;
  }
}

// Eased 0→1 progress through the live step. Smoothstep, because linear camera
// pans and linear fades both read as mechanical.
function _csTween(ms) {
  const d = ms || 500;
  const t = Math.max(0, Math.min(1, _csElapsed / d));
  return t * t * (3 - 2 * t);
}

// Camera position that centers tile (x, y), clamped to the map exactly the way
// clampCam does — so a pan can't reveal the void past a map edge.
function _csCamFor(x, y) {
  const halfVC = PW / TILE_PX / 2;
  const halfVR = PH / TILE_PX / 2;
  const maxC = Math.max(0, MCOLS - PW / TILE_PX);
  const maxR = Math.max(0, MROWS - PH / TILE_PX);
  return { c: Math.max(0, Math.min(maxC, x - halfVC + 0.5)),
           r: Math.max(0, Math.min(maxR, y - halfVR + 0.5)) };
}

function _csFinish() {
  cutsceneActive = false;
  cutsceneInputLocked = false;
  cutsceneBlocking = false;
  camOverride = null;
  _csStep = null;
  _csSteps = [];
  _csIndex = 0;
  if (typeof clearAllKeys === 'function') clearAllKeys();
  const cb = _csOnDone;
  _csOnDone = null;
  clampCam(true);
  if (cb) cb();
}

// Abort whatever is playing. Used by the skip-prologue path and by load-game, so
// loading a save from inside a cutscene doesn't leave the world frozen forever.
function cancelCutscene() {
  if (!cutsceneActive) return;
  _csOnDone = null;
  if (typeof dialogueOpen !== 'undefined' && dialogueOpen) closeDialogue();
  prologueEmperor = null;
  fadeLevel = 0;
  letterboxLevel = 0;
  shakeMag = 0; shakeMs = 0;
  _csFinish();
}
