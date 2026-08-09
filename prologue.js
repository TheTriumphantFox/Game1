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

// Remove cast members from the world outright.
function pgRemove(...who) {
  villagers = villagers.filter(v => !who.includes(v.pgTalk));
  saveVillagersToMap(0);
}

// Leave the fire's victims standing where they are instead of deleting them.
// Beat 4 used to call pgRemove here — the script's "implied, not shown" — but a
// village the player can still walk back through, and still be spoken to in, is
// a harder thing to leave behind. They hold their marks; talking to one spends
// its last words, and saying them is what takes it (see talkPrologueNpc).
// Anyone the player never reaches is cleared when the prologue closes.
function pgWound(...who) {
  for (const v of villagers) {
    if (!who.includes(v.pgTalk)) continue;
    v.pgDying = true;    // routes them to their last words (talkPrologueNpc)
    v.pgFallen = true;   // and lays them on the ground (drawVillager)
  }
  saveVillagersToMap(0);
}

// Move a cast member to a new mark, keeping their render position in step so they
// don't slide across the map from wherever they were standing.
function pgMoveTo(who, spot) {
  const v = pgFind(who);
  if (!v || !spot) return;
  v.x = spot.x; v.y = spot.y;
  v.renderX = v.x; v.renderY = v.y;
}

// Turn one of the dying into a body. It keeps its pose and its place on the map
// and stops being someone the player can talk to. `pgTalk` goes with `pgDying`,
// which matters more than it looks: `village_burning` is cleared at the end of
// the prologue, so a corpse that kept its talk key would fall straight back
// through to its cheerful Beat 1 line.
function pgLayToRest(v) {
  if (!v) return;
  delete v.pgTalk;
  delete v.pgDying;
  v.pgFallen = true;   // stays on the ground (drawVillager)
  v.pgDead   = true;   // and out of reach (tryVillagerInteraction)
}

// Everyone still dying when the prologue ends is laid down where they fell, and
// stays there for the rest of the game. Elderbrook is never rebuilt and never
// repopulated; leaving the bodies in the ash is the difference between a village
// that was destroyed and one that was merely emptied.
function pgLayOutTheDead() {
  for (const v of villagers) if (v.pgDying) pgLayToRest(v);
  saveVillagersToMap(0);
}

// The four shopkeepers of the market row, by the role key they carry.
const PG_SHOP_ROLES = ['inn', 'store', 'herb', 'smith'];

// Shut the market row when the fire takes it. The keepers stay standing with
// everyone else, but as people rather than shopfronts: dropping `role` closes
// the modal they'd otherwise open, and the pgTalk key routes them to their last
// words instead (tryVillagerInteraction checks pgTalk first). The map's shop
// bookkeeping goes either way, so the ruin is never a trading post again.
function pgCloseShops() {
  for (const v of villagers) {
    if (!PG_SHOP_ROLES.includes(v.role)) continue;
    v.pgTalk = 'shop_' + v.role;
    delete v.role;
    v.pgDying = true;    // last words instead of a shop counter
    v.pgFallen = true;   // and down in the ash with everyone else
  }
  hvCloseShops(worldMaps[0]);
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
  // The dying come first, so a wounded NPC never falls back to their cheerful
  // Beat 2 line. Saying the last words is what takes them: the dialogue's
  // completion callback is what removes them from the world.
  if (v.pgDying) {
    const last = PG_LAST_WORDS[v.pgTalk];
    const rest = () => { pgLayToRest(v); saveVillagersToMap(0); };
    if (!last) { rest(); return; }
    startDialogue(last, rest);
    return;
  }
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

// ─── Last words (Beat 4, after the strike) ────────────────────────────────────
// One conversation each, for anyone the player thinks to go back for. Plain line
// arrays rather than PG_LINES' flag-branching functions: there is only one state
// left to be in, and each of these is only ever read once — talking to someone
// here removes them.
//
// Register, per the story bible: grounded and specific, quiet rather than epic.
// Most of these call back to that character's Beat 2 line, because the gap
// between the two is the whole point and nobody here has a speech in them.
//
// Old Hendricks is the one to be careful with. He is the only other villager who
// remembers what Grandmother remembers, and he must NOT close the gap her dying
// words leave open — the midgame reveal depends on the player having been told
// something incomplete. He gets as far as saying there is something, and no
// further. Do not finish his sentence for him in a later edit.
const PG_LAST_WORDS = {
  mother: [
    { speaker: 'MOTHER', paren: 'barely above a whisper',
      text: "The package. You set it by the hearth, like I asked. You did that." },
    { text: "She doesn't ask where anyone else is. You think she already knows." },
  ],

  father: [
    { speaker: 'FATHER', text: "Told you the west road was faster. Should have sent you that way this morning too." },
    { speaker: 'FATHER', paren: 'his hand closing on your sleeve',
      text: "Your grandmother's still in the house. Go on. Don't argue with me, not this once." },
  ],

  grandmother: null,   // Beat 5 stages hers; she is never spoken to out here.

  merchant: [
    { speaker: 'WREN', text: "Last one. I did tell you it was the last one." },
    { speaker: 'WREN', paren: 'looking past you, up the road toward your house',
      text: "Go on. Get it home while it's warm." },
  ],

  child: [
    { speaker: 'NETTIE', text: "I did it. The whole square, not one crack. And you weren't even watching." },
    { text: "She wants you to say you saw it. So you tell her you saw it." },
  ],

  friend: [
    { speaker: 'BRAM', text: "Running this village by winter. That's what I said, wasn't it." },
    { speaker: 'BRAM', paren: 'trying for the laugh and not finding it',
      text: "Get out of here. Someone has to." },
  ],

  elder: [
    { speaker: 'OLD HENDRICKS', text: "Your grandmother. Is she—" },
    { speaker: 'OLD HENDRICKS', paren: 'giving up on the question',
      text: "There's a thing she should have told you. Years back. I said so at the time and she knows I said it." },
    { text: "He looks like a man working up to the rest of it. He doesn't get there." },
  ],

  watcher: [
    { speaker: 'SELLA', text: "A storm that couldn't decide. That's what I said. That's what I said." },
  ],

  // The market row. Shorter — the player may have done no more than buy arrows
  // from these four, and a stranger's death shouldn't be given a bigger speech
  // than Nettie's.
  shop_inn: [
    { speaker: 'INNKEEPER', text: "Beds all turned down upstairs. Nobody's coming in now." },
  ],
  shop_store: [
    { speaker: 'SHOPKEEPER', text: "Take what you need off the shelves. Don't— don't stand there counting it out." },
  ],
  shop_herb: [
    { speaker: 'HERBALIST', text: "I've a remedy for most things that come through that door. Not for this one." },
  ],
  shop_smith: [
    { speaker: 'BLACKSMITH', text: "That blade of yours. Keep an edge on it. Promise me that much and go." },
  ],
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

    // The village is dying, but it's still standing there to be walked through.
    // Everyone the player met in Beat 2 keeps their mark, and each has one thing
    // left to say to anyone who goes back for them (PG_LAST_WORDS). The run home
    // is still the objective — none of this is required, and a player who runs
    // straight for the house reaches the same ruin either way.
    { run: () => {
        // The parents are out of the house by now, on the road, coming the other
        // way. Staged here rather than left on their Beat 1 marks so Beat 5's
        // "No sign of your mother or your father" stays true of the room, and so
        // the player passes them on the run home instead of finding them
        // standing in the middle of Grandmother's scene.
        pgMoveTo('mother', HOME.motherFellAt);
        pgMoveTo('father', HOME.fatherFellAt);
        pgWound('child', 'friend', 'elder', 'watcher', 'mother', 'father', 'merchant');
      } },
    { run: () => pgCloseShops() },
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
    // Lay the fallen timber and move Grandmother under it. Anyone still dying out
    // in the village is left where they are for the length of this scene — they're
    // outside and this is indoors — and cleared when it ends (pgClearDead). The
    // window for going back for them was the run home, which is the point: the
    // player chooses between the people behind them and the house ahead.
    { tiles: m => hvPinGrandmother(m) },
    { run: () => {
        const g = pgFind('grandmother');
        if (g) {
          g.x = HOME.dyingAt.x; g.y = HOME.dyingAt.y;
          g.renderX = g.x; g.renderY = g.y;
          // Pinned under the beam, so she lies down with everyone else. pgFallen
          // and not pgDying: the pose is all she takes from that state — this
          // scene owns her dialogue, and pgDying would route her to last words
          // she doesn't have and delete her mid-beat.
          g.pgFallen = true;
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
        // She stays where she fell, like everyone else. Removing her here would
        // have the room tidy itself while the player is still standing in it.
        pgLayToRest(pgFind('grandmother'));
        saveVillagersToMap(0);
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
    // Whoever the player didn't get back to dies where they lie. Spoken to or
    // not, everyone stays visible from here on — the ruin keeps its dead.
    { run: () => pgLayOutTheDead() },
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
  // Rebuild map 0 as the finished ruin — and leave the same dead in it that a
  // played run does. Rather than a second copy of that logic, run the real
  // sequence: stand everyone up on the village while it's still standing, let
  // the fire take them, then lay the bodies out. Order matters — the keepers
  // only spawn while the market row is open, so pgCloseShops comes after them.
  const home = worldMaps[0];
  currentMapId = 0;
  villagers = [];
  if (home && home.type === 'homevillage') {
    home.savedVillagers = null;
    spawnVillagersForMap(0);      // the portal Gatekeeper + the four keepers
    spawnPrologueCast();          // the family, the neighbours, Wren
    pgMoveTo('mother', HOME.motherFellAt);
    pgMoveTo('father', HOME.fatherFellAt);
    pgMoveTo('grandmother', HOME.dyingAt);
    pgWound('child', 'friend', 'elder', 'watcher', 'mother', 'father', 'merchant');
    pgCloseShops();               // also clears the map's shop bookkeeping
    pgLayToRest(pgFind('grandmother'));
    pgLayOutTheDead();
    home.map = buildRuinedHomeVillage();
  } else {
    spawnVillagersForMap(0);      // legacy map 0 (the old starter cabin)
  }
  placePlayerInFamilyHome(home);
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
