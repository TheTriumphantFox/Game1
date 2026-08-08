// ─── Prologue: "Ashfall" ──────────────────────────────────────────────────────
// The five opening beats, as data. Every line here is verbatim from
// .claude/skills/hyrule-quest/references/prologue-script.md — that file is the
// script, this one is the staging. If a line needs to change, change it there
// first and copy it across, so the writing and the build can't drift.
//
// Structure mirrors the script exactly:
//   Beat 1  The House       — family, tutorial prompts, the errand is given
//   Beat 2  The Village     — the fetch quest, driven by NPC dialogue not cutscene
//   Beat 3  The Warning     — the sky changes
//   Beat 4  Ashfall         — the Emperor, the fire, the run home
//   Beat 5  What's Left     — Grandmother, the bow, revenge_triggered, title card
//
// Beats 1, 3, 4 and 5 are cutscene step arrays (see cutscene.js). Beat 2 isn't:
// it's the player walking around a village talking to people, which is just the
// game. It's driven by flags and the talkPrologueNpc handler below.
//
// The one rule that outranks everything else in this file: Grandmother's dying
// words are a PARTIAL truth on purpose. Nothing here may confirm or contradict
// the midgame reveal that the village had a hand in the original pact. See the
// story bible before touching Beat 5.

// ─── The cast ─────────────────────────────────────────────────────────────────
// Prologue villagers are ordinary villager records (same shape as everything in
// villagers.js) plus a `pgTalk` key naming their dialogue handler. They persist
// through savedVillagers like any other villager.
const PG_CAST = [
  { pgTalk: 'mother',      kind: 'Mother',      at: 'motherAt',
    robe: '#7a4a66', hair: '#4a3020', skin: '#e8c0a0' },
  { pgTalk: 'father',      kind: 'Father',      at: 'fatherAt',
    robe: '#3a5a7a', hair: '#2a1c12', skin: '#d8b088' },
  { pgTalk: 'grandmother', kind: 'Grandmother', at: 'grandmotherAt',
    robe: '#5a5a6a', hair: '#e0e0e0', skin: '#e0bfa0' },
  { pgTalk: 'merchant',    kind: 'Wren',        at: 'merchantAt',
    robe: '#6a5a2a', hair: '#3a2a14', skin: '#e0b898' },
  { pgTalk: 'child',       kind: 'Nettie',      at: 'childAt',   size: 0.72,
    robe: '#7a6a2a', hair: '#c8a050', skin: '#e8c8a8' },
  { pgTalk: 'friend',      kind: 'Bram',        at: 'friendAt',
    robe: '#4a6a4a', hair: '#5a3a1a', skin: '#dcb490' },
  { pgTalk: 'elder',       kind: 'Old Hendricks', at: 'elderAt',
    robe: '#5a4a3a', hair: '#d8d0c0', skin: '#d8b494' },
  { pgTalk: 'watcher',     kind: 'Sella',       at: 'watcherAt',
    robe: '#6a3a4a', hair: '#2a2018', skin: '#e4bc98' },
];

// Stand the cast up on map 0 and persist them. Called once, when the prologue
// starts. Runs after spawnVillagersForMap(0) has already placed the Gatekeeper,
// so it appends rather than replacing.
function spawnPrologueCast() {
  let nextId = villagers.reduce((mx, v) => Math.max(mx, v.id || 0), -1) + 1;
  for (const c of PG_CAST) {
    // Never double-cast. Starting a second new game without a reload, or any
    // path that runs the opening twice, would otherwise stack a second Mother on
    // top of the first — and the beats that remove cast members by name would
    // then only remove one of each.
    if (villagers.some(v => v.pgTalk === c.pgTalk)) continue;
    const spot = HOME[c.at];
    villagers.push({
      id: nextId++,
      kind: c.kind,
      pgTalk: c.pgTalk,
      robe: c.robe, hair: c.hair, skin: c.skin,
      size: c.size || 1,
      x: spot.x, y: spot.y,
      renderX: spot.x, renderY: spot.y,
      // Everyone holds their mark. This is staging, not a crowd simulation — a
      // mother who wanders off mid-scene is a mother the player can't find.
      stationary: true,
      dir: { x: 0, y: 1 },
      timer: 0, stepMs: 9999,
    });
  }
  saveVillagersToMap(0);
}

// Find a cast member by their pgTalk name, or null if they're gone.
function pgFind(who) {
  return villagers.find(v => v.pgTalk === who) || null;
}

// Remove cast members from the world. Used when the fire takes them: the script
// is explicit that the parents' fate is "implied, not shown", so they simply
// aren't there any more.
function pgRemove(...who) {
  villagers = villagers.filter(v => !who.includes(v.pgTalk));
  saveVillagersToMap(0);
}

// The prologue's tutorial prompts name keyboard keys, which is worse than
// useless on a phone — there is no Space bar to press, and movement is the
// on-screen pad. Route every one of them through here so touch mode simply
// doesn't get them; the touch scheme teaches itself from the controls on screen
// (and the title screen's hint, reworded per mode in refreshControlHints).
//
// On desktop they time out on their own rather than sitting there until
// dismissed: long enough to read the keys and try them, then gone. One knob for
// all three prompts.
const PG_HINT_MS = 9000;

// What Grandmother hands over in Beat 1, once. The player starts with nothing
// (STARTING_ITEM_AMOUNT is 0), so this is the opening stock of Minor Healing
// Potions — and on touch it's what the potion button is for.
const GRAN_POTION_GIFT = 5;
function pgKeyHint(text) {
  if (typeof uiModeIsTouch === 'function' && uiModeIsTouch()) return;
  showMsg(text, PG_HINT_MS);
}

// ─── Dialogue dispatch (Beat 2, and anyone spoken to out of turn) ─────────────
// What each character says depends on which flags are set. Called from
// tryVillagerInteraction in villagers.js.
function talkPrologueNpc(v) {
  const lines = PG_LINES[v.pgTalk];
  if (!lines) return;
  const said = lines();
  if (said) startDialogue(said.lines, said.then || null);
}

const PG_LINES = {
  mother: () => {
    if (hasFlag('fetch_quest_complete')) return { lines: [
      { speaker: 'MOTHER', text: "That was quick. Set it by the hearth, would you?" }] };
    if (hasFlag('fetch_quest_active')) return { lines: [
      { speaker: 'MOTHER', text: "Wren's stall, on the square. Before they pack up." }] };
    // First time: this is what starts the errand, and Beat 2 with it.
    return {
      lines: [
        { speaker: 'MOTHER', text: "Up already? Good — I need someone to run to the market before the stalls close." },
      ],
      then: () => {
        setFlag('fetch_quest_active');
        showMapMsg('📜 Fetch the package from Wren at the market.');
        pgKeyHint('WASD / Arrows to move · Space to talk');
      }
    };
  },

  father: () => ({ lines: [
    { speaker: 'FATHER', text: "Take the west road, it's faster. Mind the Hendricks' dog, he still doesn't like strangers." },
  ], then: () => pgKeyHint('Space interacts — with people, doors and whatever is in your way') }),

  grandmother: () => {
    // Beat 5 has its own staging and doesn't come through here.
    if (hasFlag('village_burning')) return null;
    const firstTime = !hasFlag('gran_potions_given');
    return {
      lines: [
        { speaker: 'GRANDMOTHER', paren: 'not looking up',
          text: "Bring me back something sweet, if there's any left. And don't dawdle — the sky's an odd color today." },
        // She hands over the player's entire starting stock of potions. The line
        // is deliberately mundane — a grandmother packing off a child who skins
        // their knees. It must not read as foresight: she does not know what is
        // coming, and the midgame reveal depends on her never having hinted.
        ...(firstTime ? [{ speaker: 'GRANDMOTHER',
          text: "Take the little green ones from the shelf. You always come back scraped." }] : []),
        // The script's beat: she looks at the bow, and at the sky, and says nothing
        // more. Narration rather than a line, because the point is what she doesn't
        // say. Do not have her explain it — the whole story depends on her not.
        { text: "She glances at the bow resting against the wall beside her, then back out the window. She doesn't explain." },
      ],
      then: firstTime ? () => {
        setFlag('gran_potions_given');
        const got = addItem('potions', GRAN_POTION_GIFT);
        showMsg(`🧪 Grandmother gives you ${got} ${regionPotionName('forest')}s.`, 4000);
        updateHUD();
      } : null
    };
  },

  merchant: () => {
    if (hasFlag('fetch_quest_complete')) return { lines: [
      { speaker: 'WREN', text: "Go on, get it home while it's warm. And tell your grandmother I asked after her." }] };
    if (hasFlag('fetch_quest_active')) return {
      lines: [
        { speaker: 'WREN', text: "Your mother's package. Last one — I was about to pack up." },
        { text: "You take the bundle. It's still warm." },
      ],
      then: () => {
        setFlag('fetch_quest_complete');
        showMapMsg('📜 Head home.');
      }
    };
    return { lines: [
      { speaker: 'WREN', text: "Half sold out already. Come back with a reason and I'll find you something." }] };
  },

  child: () => ({ lines: [
    { speaker: 'NETTIE', text: "I can hop the whole square without touching a crack. Watch. No — watch properly." },
  ] }),

  friend: () => ({ lines: [
    { speaker: 'BRAM', text: "Errands again? You'll be running this village by winter at that rate." },
  ] }),

  elder: () => ({ lines: [
    { speaker: 'OLD HENDRICKS', text: "Dog's on the west road. He's not vicious, he's just got opinions." },
    // Elders carrying unease about the old days is the right register per the
    // story bible — evasive, never explanatory.
    { speaker: 'OLD HENDRICKS', text: "Your grandmother and I are the last two who remember this place before the road came through. She talks about it even less than I do." },
  ] }),

  watcher: () => ({ lines: [
    { speaker: 'SELLA', text: "Wind's turned. Smells like a storm that can't decide." },
  ] }),
};

// ─── Beat 1 — The House ───────────────────────────────────────────────────────
// Entry point for a new game. Everything after this is driven by the player.
function startPrologue() {
  setFlag('prologue_started');
  spawnPrologueCast();
  playCutscene([
    { letterbox: 1, ms: 500 },
    { fade: 0, ms: 1 },                       // start from clear, not black
    { banner: '🏡 ' + HOME_VILLAGE_NAME + ' — morning' },
    { wait: 900 },
    { pan: HOME.grandmotherAt, ms: 1200 },
    { say: [
      { text: "Your grandmother is at the window, where she always is. The bow she never talks about is leaning against the wall beside her." },
    ] },
    { pan: HOME.spawn, ms: 900 },
    { camFollow: true },
    { letterbox: 0, ms: 400 },
    { run: () => {
        showMapMsg('🏡 Home. Your mother needs something from the market.');
        pgKeyHint('WASD / Arrows to move · Space to talk');
      } },
  ]);
}

// ─── Beat 3 — The Warning ─────────────────────────────────────────────────────
// Fires when the player heads home with the package. Hooked to movement rather
// than to a tile, so there's no invisible trigger line to walk around: see
// checkPrologueTriggers below.
function playWarningBeat() {
  setFlag('warning_seen');
  playCutscene([
    { letterbox: 1, ms: 400 },
    { banner: '🌥️ The light changes.' },
    { wait: 1200 },
    // A shadow crosses the ground. He is too far to make out clearly yet — the
    // script is specific about that, so he is drawn tiny, high, and moving fast.
    { emperor: { x: HOME.center.x - 30, y: HOME.center.y - 24, alt: 26, scale: 0.30 } },
    { emperorFly: { x: HOME.center.x + 34, y: HOME.center.y - 14, alt: 26, scale: 0.30 }, ms: 2600 },
    { say: [
      { text: "Birds go up off the rooftops all at once. Around the square, people stop and look at the sky." },
      { speaker: 'VILLAGER', paren: 'offscreen', text: "...Do you feel that?" },
    ] },
    { emperor: null },
    { wait: 700 },
    { shake: 5, ms: 1400 },
    { say: [{ text: "Silence. Then, a long way off, a roar." }] },
    { wait: 500 },
  ], playAshfallBeat);
}

// ─── Beat 4 — Ashfall ─────────────────────────────────────────────────────────
// The Emperor descends, the village burns, and the player runs home. Input is
// locked for the strike and handed back for the run — the cutscene stays live
// through both (see the `control` and `awaitPlayerNear` steps in cutscene.js).
function playAshfallBeat() {
  const C = HOME.center;
  playCutscene([
    { run: () => setFlag('village_burning') },
    { pan: C, ms: 900 },
    // He comes in high and fast, then drops onto the square.
    { emperor: { x: C.x, y: C.y - 40, alt: 30, scale: 0.5 } },
    { emperorFly: { x: C.x, y: C.y - 6, alt: 20, scale: 1.0 }, ms: 1600 },
    { shake: 4, ms: 900 },
    { emperorFly: { x: C.x, y: C.y - 2, alt: 5, scale: 1.5 }, ms: 1400 },
    { shake: 12, ms: 1200 },
    { say: [{ text: "He lands in the square he has never had any reason to know the name of." }] },

    // The strike. Fire crosses the screen and the tiles start to char — the
    // charring is staged in three passes so it visibly spreads outward rather
    // than cutting to a finished ruin.
    { run: () => { burnLevel = 0.35; pgEmberBurst(C, 40); } },
    { shake: 16, ms: 1600 },
    { tiles: m => charHomeVillage(m, 14) },
    { wait: 700 },
    { run: () => { burnLevel = 0.7; pgEmberBurst(C, 30); } },
    { tiles: m => charHomeVillage(m, 30) },
    { wait: 700 },
    { run: () => { burnLevel = 1; } },
    { tiles: m => charHomeVillage(m, 52) },
    { wait: 600 },

    // He lifts off again, unhurried. Nothing here can hurt him and he knows it.
    { emperorFly: { x: C.x, y: C.y - 30, alt: 28, scale: 0.6 }, ms: 2400 },
    { emperor: null },

    // The neighbours are gone. Wren is the one the player is most likely to have
    // spoken to, so she is the one left standing — the script's "one NPC seen for
    // the last time here, no dialogue, just a visual beat".
    { run: () => pgRemove('child', 'friend', 'elder', 'watcher', 'mother', 'father') },
    { camFollow: true },
    { letterbox: 0, ms: 400 },
    { banner: '🔥 Get home.' },

    // Hand the keys back. The scene stays live, waiting on the doorway.
    { control: true },
    { awaitPlayerNear: { x: HOME.door.x, y: HOME.door.y, dist: 1 } },
    { control: false },
  ], playWhatsLeftBeat);
}

// A burst of embers at a village tile. Wraps the coordinate conversion, because
// spawnParticle takes canvas pixels and everything in this file thinks in tiles.
function pgEmberBurst(at, n) {
  const p = screenPX(at.x, at.y);
  spawnEmbers(p.x, p.y, n);
}

// ─── Beat 5 — What's Left ─────────────────────────────────────────────────────
function playWhatsLeftBeat() {
  playCutscene([
    { letterbox: 1, ms: 500 },
    // Lay the fallen timber and move Grandmother under it. Wren doesn't follow
    // the player inside.
    { tiles: m => hvPinGrandmother(m) },
    { run: () => {
        pgRemove('merchant');
        const g = pgFind('grandmother');
        if (g) {
          g.x = HOME.dyingAt.x; g.y = HOME.dyingAt.y;
          g.renderX = g.x; g.renderY = g.y;
          saveVillagersToMap(0);
        }
      } },
    { teleport: { x: HOME.door.x, y: HOME.door.y - 1 } },
    { banner: '🏚️ What\'s left of home' },
    { wait: 900 },
    { say: [
      { text: "The roof is half down. No sign of your mother or your father." },
    ] },
    { pan: HOME.dyingAt, ms: 1400 },
    { say: [
      { text: "Your grandmother is pinned under a fallen beam near the hearth. Her bow is lying just out of her reach." },
      { speaker: 'GRANDMOTHER', paren: 'weak, but steady',
        text: "There you are. Good. I was afraid I'd... go without saying it." },
    ] },

    // She reaches for the bow and can't quite get it; the player picks it up.
    // The script allows either staging — this is the one where the player acts,
    // because the whole game is about what they do next.
    { camFollow: true },
    { walkPlayer: { x: HOME.bowAt.x, y: HOME.bowAt.y } },
    { say: [
      { text: "She reaches for the bow. Her hand stops short. You pick it up." },
      { speaker: 'GRANDMOTHER',
        text: "That bow was mine, once. And my mother's before that. I hoped you'd never need it." },
    ] },
    { wait: 600 },

    // The partial truth. Read the story bible before editing a word of this.
    { say: [
      { speaker: 'GRANDMOTHER',
        text: "He's no dragon of legend, child. Not truly. That crown he wears — it isn't his by right. It was promised to him, a long time ago, by people who should have known better. I know that much. I don't know all of it. No one living does anymore." },
      { speaker: 'GRANDMOTHER',
        text: "But I know this — the ones who made that promise thought they were buying us time. They were wrong." },
      { text: "Her hand closes weakly around yours." },
      { speaker: 'GRANDMOTHER',
        text: "Don't let it be for nothing. Take the bow. Find out what he took, and what he's still taking. And when you're standing in front of him —" },
      { speaker: 'GRANDMOTHER', paren: 'the faintest, tired smile',
        text: "— don't miss." },
    ] },

    // The held beat. No music, no prompt, just stillness — so no banner, no
    // message, nothing on screen but the room.
    { wait: 2600 },
    { run: () => {
        grantGrandmothersBow();
        pgRemove('grandmother');
      } },
    { say: [{ text: "Grandmother's Bow — hers, and her mother's before that. Press [X] to draw it." }] },
    { run: () => setFlag('revenge_triggered') },

    { fade: 1, ms: 2200 },
    { wait: 800 },
    { run: () => {
        burnLevel = 0.25;      // the fire burns down but the ruin keeps smouldering
        letterboxLevel = 0;
        showMapMsg('⚔️  H Y R U L E   Q U E S T');
      } },
    { wait: 2600 },
    { fade: 0, ms: 1600 },
    { run: () => setFlag('prologue_complete') },
    // The fire is out. Clearing this keeps a played run's flag bag identical to
    // a skipped one (see skipPrologue) — if the two diverge, anything that later
    // reads story state behaves differently depending on how the player got here.
    { run: () => clearFlag('village_burning') },
    { run: () => {
        showMsg('Step outside. South, out of the village.', 0);
        if (typeof autoSave === 'function') autoSave();
      } },
  ]);
}

// The grant itself. One place, so the skip-prologue path and Beat 5 can't drift.
function grantGrandmothersBow() {
  player.hasBow = true;
  player.arrows = player.arrows || {};
  player.arrows.plain = Math.max(player.arrows.plain || 0, 10);
  player.weapon = 'bow';
  updateHUD();
}

// ─── Trigger check ────────────────────────────────────────────────────────────
// Beat 3 fires when the player carries the package back toward the family home.
// Checked per-frame from update() rather than from a tile, so there's no seam
// the player can walk around, and no trigger tile to render.
function checkPrologueTriggers() {
  if (!hasFlag('fetch_quest_complete')) return;
  if (hasFlag('warning_seen')) return;
  if (currentMapId !== 0) return;
  // Far enough back up the road that the village is behind them.
  if (player.y <= HOME.center.y + 2 && Math.abs(player.x - HOME.center.x) < 14) {
    playWarningBeat();
  }
}

// ─── Skip ─────────────────────────────────────────────────────────────────────
// Land in the world with the prologue's outcomes already applied. For testing,
// and for anyone starting their second hero who doesn't want to watch it again.
// Everything it sets must match what the beats set, or a skipped run diverges.
function skipPrologue() {
  if (typeof cancelCutscene === 'function') cancelCutscene();
  setFlag('prologue_started');
  setFlag('fetch_quest_active');
  setFlag('fetch_quest_complete');
  setFlag('warning_seen');
  setFlag('revenge_triggered');
  setFlag('prologue_complete');
  clearFlag('village_burning');
  grantGrandmothersBow();
  // Rebuild map 0 as the finished ruin and clear the cast out of it.
  const home = worldMaps[0];
  if (home && home.type === 'homevillage') {
    home.map = buildRuinedHomeVillage();
    home.savedVillagers = null;
  }
  currentMapId = 0;
  villagers = [];
  placePlayerInFamilyHome(home);
  spawnVillagersForMap(0);      // re-places the portal Gatekeeper
  burnLevel = 0.25;
  minimapDirty = true;
  revealAround(currentMap(), player.x, player.y, 12);
  clampCam(true);
  updateHUD();
  showMapMsg('⚔️  H Y R U L E   Q U E S T');
}

// ─── Restoring a save ─────────────────────────────────────────────────────────
// A save can be written mid-prologue. Cutscene state itself is not saved (a
// half-played scene isn't a resumable thing), so loading drops the player back
// into player control with the flags they had — which is exactly where the
// script's non-cutscene stretches already put them. What this does restore is
// the ambient state that lives outside the flag bag.
function restorePrologueAmbience() {
  if (typeof cancelCutscene === 'function') cancelCutscene();
  burnLevel = hasFlag('prologue_complete') ? 0.25
            : hasFlag('village_burning')   ? 1
            : 0;
}
