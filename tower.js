// ─── Final castle tower — runtime logic ───────────────────────────────────────
// Entry from the last village's castle gate, the pinnacle's victory payoff, and
// the victory overlay. Map generation lives in mapgen-tower.js; floor factory in
// world.js (createTowerFloorMap); stair transitions in player.js. Plain <script>
// globals (see index.html load order).

// True while the victory overlay is up — main.js pauses the world on it, like
// the other modals.
let victoryOpen = false;

// Walk out the final village's castle-gate exit → enter tower floor 1. The
// tower id memoizes into villageMap.caveLinks['tower'] (a string key like the
// cave links, so the existing save plumbing round-trips it for free) — leaving
// and re-entering returns to the same tower, with every cleared floor's state
// intact via savedEnemies.
function enterCastleTower(villageMap, dir) {
  saveEnemyStateToMap(currentMapId);
  saveVillagersToMap(currentMapId);
  // Leaving the village strips its King's Hoard, same as any other exit.
  removeVillageBossChest(villageMap);

  villageMap.caveLinks = villageMap.caveLinks || {};
  let towerId = villageMap.caveLinks['tower'];
  if (towerId == null) {
    // Return landing: just inside the castle-side gate.
    const rx = dir === 'left' ? 1 : dir === 'right' ? MCOLS - 2 : EXIT_COL;
    const ry = dir === 'up'   ? 1 : dir === 'down'  ? MROWS - 2 : EXIT_ROW;
    towerId = createTowerFloorMap(villageMap.id, rx, ry, 1);
    villageMap.caveLinks['tower'] = towerId;
  }
  currentMapId = towerId;
  const land = worldMaps[towerId].entryLand;
  player.x = land.x; player.y = land.y;
  spawnEnemiesForMap(towerId);
  spawnVillagersForMap(towerId);
  transitionCooldown = 400;
  minimapDirty = true;
  clampCam(true);
  showMapMsg('🏰 The Final Castle — its tower climbs beyond sight. Floor 1/14.');
  // Auto-save on arrival at each tower floor (floor 1 here) so a death in the
  // deadly climb restores the hero to the floor it began on, not the cabin.
  if (typeof autoSave === 'function') autoSave('Castle Tower — Floor 1');
}

// The dragon's death raises a King's-Hoard-class chest on the throne dais and
// showers the hoard in rubies. Mirrors placeVillageBossChest, at the pinnacle's
// fixed dais coordinates (see buildTowerPinnacleMap).
function placeTowerHoardChest(cm) {
  if (!cm || cm.type !== 'castle_tower' || !cm.map) return;
  const m = cm.map;
  let bcr = 31, bcc = 74;                       // heart of the marble dais
  if (m[bcr][bcc] === T.BOSS_CHEST_TL) return;  // already raised
  // Chests are solid — nudge south a row if the hero stands right there.
  if (player.y >= bcr && player.y <= bcr + 1 && player.x >= bcc && player.x <= bcc + 1) bcr += 2;
  m[bcr    ][bcc    ] = T.BOSS_CHEST_TL;
  m[bcr    ][bcc + 1] = T.BOSS_CHEST_TR;
  m[bcr + 1][bcc    ] = T.BOSS_CHEST_BL;
  m[bcr + 1][bcc + 1] = T.BOSS_CHEST_BR;
  minimapDirty = true;
  // Ruby shower across the hoard — the dragon's fortune spills loose. Long
  // lifetime so nothing evaporates while the victory screen is up.
  let placed = 0, tries = 0;
  while (placed < 40 && tries < 400) {
    tries++;
    const r = rnd(38, 52), c = rnd(62, 86);
    if (m[r] && m[r][c] === T.HOARD) {
      drops.push({
        type: 'ruby', val: 20 + Math.floor(Math.random() * 30),
        x: c, y: r, life: 600000, bob: 0, collected: false
      });
      placed++;
    }
  }
  const sp = screenPX(bcc, bcr);
  spawnParticle(sp.x, sp.y, '#ffdd33', 28, 6);
  spawnParticle(sp.x, sp.y, '#ff6622', 20, 5);
}

// ─── The Emperor ──────────────────────────────────────────────────────────────
// Stage 10. The Adult Red Dragon coiled around the ruined throne is the Red
// Dragon Emperor, and this scene is where the game says so. Everything the
// prologue withheld and the fortune tellers circled lands here and nowhere
// earlier: that Grandmother's family ruled, that they refused him a crown, that
// he took it, and that the ones who helped him take it were her own village.
//
// ─── The contradiction in the script, and how it is resolved ───
// DOCX v3's pre-fight line has a wizard "promise me a crown and give me this
// instead", while its dying monologue has the Emperor take the crown himself
// from the ruling family. Both cannot be true, and the checklist says to
// reconcile them in favour of the monologue, which is the load-bearing reveal.
// So: the wizard never had a crown to give. He sold the Emperor the LONG
// DRAUGHT, and what the Emperor wanted from it was time. The crown he wears is
// the one he took by force, with Elderbrook's help. The Draught is what changed
// his shape, and what the land has been paying for ever since — it is the blight
// (see corruption.js, which is the same story told in tiles).
//
// ─── The rule the rest of the game is written against ───
// Nothing before this scene may confirm any of it. If a line elsewhere ever
// starts to, that line is wrong, not this one.
const EMPEROR_LINE_50 = 0.50;   // HP fraction that fires the mid-fight line
const EMPEROR_LINE_15 = 0.15;   // ...and the stagger
const EMPEROR_STAGGER_MS = 2200;

// The pre-fight scene. Replaces the one-line "the gold shifts and slides" wake
// the pinnacle used to do: the dragon stays asleep until the scene has played,
// and the scene is what wakes it.
function playEmperorIntro(dragon) {
  if (typeof playCutscene !== 'function') { dragon.dormant = false; return; }
  setFlag('boss_intro_seen');
  const at = { x: dragon.x, y: dragon.y };
  playCutscene([
    { letterbox: 1, ms: 600 },
    { pan: at, ms: 1400 },
    { run: () => {
        const sp = screenPX(dragon.x, dragon.y);
        spawnParticle(sp.x, sp.y, '#ff6622', 24, 6);
        spawnParticle(sp.x, sp.y, '#ffd24a', 16, 4);
      } },
    { shake: 6, ms: 900 },
    { say: [
      { text: "The hoard shifts. What you took for the shape of the gold uncoils from the throne and looks at you." },
      { speaker: 'THE EMPEROR',
        text: "You made it further than the others. There were more than you'd think." },
      { speaker: 'THE EMPEROR',
        text: "Your grandmother would be proud. Or ashamed. I could never tell with her." },
      { text: "Scales shift, catching what is left of the light." },
      { speaker: 'THE EMPEROR',
        text: "She never told you, did she. What her family took from mine. What I took back." },
      // The reconciled line. He asked a wizard for time, not for a crown.
      { speaker: 'THE EMPEROR',
        text: "I did not choose this shape. A wizard sold me the Long Draught and swore it was years in a cup. It was. It is still pouring." },
      { speaker: 'THE EMPEROR',
        text: "I have worn it a long time now. Long enough to forget what I looked like before." },
      { speaker: 'THE EMPEROR',
        text: "Draw your bow, then. Let's see if her aim was as good as her arrows." },
    ] },
    { letterbox: 0, ms: 500 },
    { camFollow: true },
    { run: () => {
        dragon.dormant = false;
        nameTheEmperor(dragon);
        showMapMsg('🐉 THE RED DRAGON EMPEROR RISES');
      } },
  ]);
}

// The confirmation, on the HP bar. Up to this moment the creature has been the
// "ADULT RED DRAGON" everywhere it is named — in its stat block, on its tag, in
// the bestiary of anyone who has fought one. The scene is where the game says
// who he actually is, so the tag changes with it and stays changed (the name
// rides along in savedEnemies, so a reload keeps it).
function nameTheEmperor(dragon) {
  if (dragon) dragon.name = 'THE RED DRAGON EMPEROR';
}

// Per-frame threshold watch. Called from update() (main.js) rather than hung off
// the eight places that subtract from an enemy's HP — a fraction check that runs
// once a frame is both cheaper to reason about and impossible to miss from a new
// damage source. Each line is one-shot through a story flag, so neither replays
// after a reload mid-fight.
function stepFinalBoss(dt) {
  const cm = (typeof currentMap === 'function') ? currentMap() : null;
  if (!cm || cm.type !== 'castle_tower' || cm.floorIdx !== 14) return;
  if (typeof enemies === 'undefined') return;
  const boss = enemies.find(e => e.finalBoss && !e.dead && !e.dormant);
  if (!boss || !boss.maxHp) return;
  if (boss.humanFlickerT > 0) boss.humanFlickerT -= dt;
  const frac = boss.hp / boss.maxHp;

  if (frac <= EMPEROR_LINE_50 && !hasFlag('boss_line_50')) {
    setFlag('boss_line_50');
    sayNPC('THE EMPEROR',
      "Good. Good. You've spent your whole life practicing for this and didn't even know it.");
    return;
  }
  if (frac <= EMPEROR_LINE_15 && !hasFlag('boss_line_15')) {
    setFlag('boss_line_15');
    // He reels: stopped where he stands (stepEnemies honours staggerT) and, for
    // as long as it lasts, the thing under the dragon shows through
    // (drawEmperorFlicker, render-enemies.js).
    boss.staggerT = EMPEROR_STAGGER_MS;
    boss.humanFlickerT = EMPEROR_STAGGER_MS;
    const sp = screenPX(boss.x, boss.y);
    spawnParticle(sp.x, sp.y, '#ffe9c0', 20, 3);
    shakeMag = 8; shakeMs = 700;
    startDialogue([
      { speaker: 'THE EMPEROR', paren: 'staggering', text: "Wait. Wait..." },
      { text: "For a moment the dragon flickers, and underneath it there is something almost human." },
      { speaker: 'THE EMPEROR',
        text: "I did not want this. None of us did. We only wanted more time." },
    ]);
  }
}

// ─── The dying monologue ──────────────────────────────────────────────────────
// Called from killEnemy instead of the old immediate victory. Nothing about
// winning happens until the last line is dismissed: `wonGame`, the hoard chest
// and the victory overlay are all on the far side of this scene, because the
// reveal is the ending and a victory banner over the top of it would be the game
// congratulating the player mid-sentence.
function playEmperorDeath(dragon, cm) {
  const finish = () => {
    setFlag('boss_monologue_done');
    player.wonGame = true;
    if (typeof placeTowerHoardChest === 'function') placeTowerHoardChest(cm);
    if (typeof showVictoryScreen === 'function') showVictoryScreen();
    if (typeof autoSave === 'function') autoSave('The Emperor falls');
  };
  // Already heard it. Only reachable by an unusual route (a save carrying the
  // flag whose dragon is somehow alive again), but the ending is the one scene
  // in the game that must never play twice, so it is checked rather than
  // assumed. Straight to the payout.
  if (hasFlag('boss_monologue_done')) { finish(); return; }
  if (typeof playCutscene !== 'function') { finish(); return; }
  const at = { x: dragon.x, y: dragon.y };
  playCutscene([
    { letterbox: 1, ms: 700 },
    { pan: at, ms: 1200 },
    { say: [
      { speaker: 'THE EMPEROR', paren: 'dying',
        text: "So this is how it ends. Not with the curse lifted. Just spent." },
      // The reveal. Grandmother's family, and Elderbrook's part in it, are said
      // out loud here for the first and only time in the game.
      { speaker: 'THE EMPEROR',
        text: "Your grandmother's family ruled this land once. Kindly enough that when I came asking for a crown of my own, they refused me. So I took it." },
      { speaker: 'THE EMPEROR',
        text: "And the ones who helped me take it, the ones who thought they were buying themselves safety... that was your village. Long before you were born." },
      { speaker: 'THE EMPEROR',
        text: "That is the truth she could not tell you. The one no one living was supposed to tell you." },
      { speaker: 'THE EMPEROR', paren: 'quieter now, almost gentle',
        text: "Don't miss, she said. You didn't." },
    ] },
    { wait: 900 },
    // He goes still, and the crown comes off him. It rolls across the dais and
    // stops at the hero's feet, which is the last thing the script asks for and
    // the only piece of it the player watches rather than reads.
    { run: () => rollEmperorCrown(at) },
    { wait: 2600 },
    { say: [{ text: "The crown comes to rest against your boot. It is lighter than it looks, and it is still warm." }] },
    { fade: 1, ms: 2000 },
    { wait: 600 },
    { run: () => {
        letterboxLevel = 0;
        showMapMsg('⚔️  T H E   R P G   G A M E   ·   E P I L O G U E');
      } },
    { wait: 3000 },
    { fade: 0, ms: 1400 },
    { run: finish },
  ]);
}

// The man under the dragon, for as long as the stagger lasts. A pale standing
// figure the size of the hero, drawn over the sprite at a flicker — no face, no
// detail, because the script says "something almost human" and the moment it
// resolves into a specific person it stops being that. Called from drawEnemy
// (render-enemies.js); `s` is the enemy's drawn sprite size.
function drawEmperorFlicker(e, cx, cy, s) {
  const t = Date.now();
  // Guttering rather than pulsing: mostly present, dropping out at intervals a
  // sine wave wouldn't give.
  const flick = 0.55 + 0.45 * Math.sin(t / 55) * Math.sin(t / 130);
  if (flick < 0.25) return;
  const h = s * 0.72, w = h * 0.30;
  const top = cy - h * 0.55;
  ctx.save();
  ctx.globalAlpha = Math.min(0.85, flick * 0.8);
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = 'rgba(255, 233, 192, 0.55)';
  // Torso and legs as one tapered column, then shoulders, then the head.
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.5, top + h);
  ctx.lineTo(cx - w * 0.42, top + h * 0.32);
  ctx.lineTo(cx + w * 0.42, top + h * 0.32);
  ctx.lineTo(cx + w * 0.5, top + h);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx, top + h * 0.30, w * 0.72, h * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, top + h * 0.14, h * 0.13, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ─── The crown ────────────────────────────────────────────────────────────────
// A drawn prop with a position and nothing else, exactly like the prologue's
// Emperor (cutscene.js): there is no entity to collide with, nothing to pick up
// and nothing to save. It rolls from wherever he fell to the hero's feet and
// then simply stays on the floor of the throne room for the rest of the session.
//   { x, y, tx, ty, t, ms } | null
let emperorCrown = null;

function rollEmperorCrown(from) {
  emperorCrown = {
    x: from.x, y: from.y,
    tx: player.x, ty: player.y + 0.6,
    t: 0, ms: 2200,
  };
  const sp = screenPX(from.x, from.y);
  spawnParticle(sp.x, sp.y, '#ffd24a', 18, 3);
}

function stepEmperorCrown(dt) {
  if (!emperorCrown || emperorCrown.t >= emperorCrown.ms) return;
  emperorCrown.t = Math.min(emperorCrown.ms, emperorCrown.t + dt);
}

// Paint it, from render.js after the entities. A gold circlet seen edge-on while
// it rolls (it spins, so its width pinches and swells) and flat once it stops.
function drawEmperorCrown(ts) {
  if (!emperorCrown) return;
  const c = emperorCrown;
  const p = Math.min(1, c.t / c.ms);
  const e = 1 - Math.pow(1 - p, 3);          // rolls out fast, settles slow
  const wx = c.x + (c.tx - c.x) * e;
  const wy = c.y + (c.ty - c.y) * e;
  // A low arc so it reads as rolling across a floor rather than sliding on it.
  const hop = Math.abs(Math.sin(p * Math.PI * 5)) * (1 - p) * ts * 0.18;
  const sx = (wx - camC) * ts + ts / 2;
  const sy = (wy - camR) * ts + ts / 2 - hop;
  const rolling = p < 1;
  // Edge-on while rolling: the circlet's apparent width is its spin, and it
  // flattens out to a ring the moment it comes to rest.
  const spin = rolling ? Math.abs(Math.cos(c.t / 90)) : 1;
  const rw = ts * 0.34 * (rolling ? (0.25 + spin * 0.75) : 1);
  const rh = ts * (rolling ? 0.34 : 0.16);
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(sx, (wy - camR) * ts + ts * 0.78, rw * 0.9, ts * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = Math.max(2, ts * 0.10);
  ctx.strokeStyle = '#ffd24a';
  ctx.beginPath();
  ctx.ellipse(sx, sy, rw, rh, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = Math.max(1, ts * 0.035);
  ctx.beginPath();
  ctx.ellipse(sx, sy - rh * 0.18, rw * 0.86, rh * 0.7, 0, Math.PI * 1.05, Math.PI * 1.85);
  ctx.stroke();
  // The points of the circlet, once it is lying still enough to make them out.
  if (!rolling) {
    ctx.fillStyle = '#ffe98a';
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(sx + Math.cos(a) * rw, sy + Math.sin(a) * rh, Math.max(1, ts * 0.045), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// ─── Victory overlay ──────────────────────────────────────────────────────────
function showVictoryScreen() {
  victoryOpen = true;
  const el = document.getElementById('victory-stats');
  if (el) {
    const rows = [];
    if (player && player.level != null) rows.push(`⚔️ Hero Level <b>${player.level}</b>`);
    if (player && player.rubies != null) rows.push(`💎 <b>${player.rubies}</b> rubies amassed`);
    if (typeof mapsVisited !== 'undefined') rows.push(`🗺️ <b>${mapsVisited}</b> areas explored`);
    rows.push(`🏰 <b>${REGIONS.length}</b> elemental regions conquered`);
    // Named for who he turned out to be, not for what the bestiary called him.
    rows.push(`🐉 The <b>Red Dragon Emperor</b> lies slain`);
    el.innerHTML = rows.map(r => `<div class="victory-stat">${r}</div>`).join('');
  }
  const ov = document.getElementById('victory-overlay');
  if (ov) ov.classList.add('open');
}

function continueFromVictory() {
  victoryOpen = false;
  const ov = document.getElementById('victory-overlay');
  if (ov) ov.classList.remove('open');
  showMapMsg('👑 The realm is saved — its treasures are yours to claim.');
}
