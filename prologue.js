// ─── Prologue: "Ashfall" ──────────────────────────────────────────────────────
// The five opening beats, as data. Every line here is verbatim from
// .claude/skills/the-rpg-game/references/prologue-script.md — that file is the
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
  adoptShopkeeperAsWren();
  spawnPrologueDog();
  saveVillagersToMap(0);
}

// Wren is the village shopkeeper, not a second merchant behind a stall. The
// errand in Beat 2 sends the player to the store door like any other shop, which
// is what teaches shop interaction in the same trip — so rather than standing up
// a duplicate NPC, the keeper placeShopkeepers already put behind that counter is
// given her name and her lines.
//
// She keeps `role: 'store'`, so once the errand is done she is simply the
// shopkeeper again: tryVillagerInteraction tries the prologue handler first and
// falls through to the store modal when PG_LINES.merchant declines (see
// talkPrologueNpc's return value).
function adoptShopkeeperAsWren() {
  const keeper = villagers.find(v => v.role === 'store');
  if (!keeper || keeper.pgTalk) return;
  keeper.kind = 'Wren';
  keeper.pgTalk = 'merchant';
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
// Three of the four trades survive the fire. The script is explicit about which:
// the innkeeper, the shopkeeper and the herbalist are still there afterwards, on
// the same marks they started on, and the blacksmith is not.
//
// The survivors keep their `role`, which is the whole of being a shop as far as
// tryVillagerInteraction is concerned — so they go on trading, on the terms
// hvRuinShops sets (nothing left on the shelves, forest prices, the plain 1d4
// brew). They are NOT given pgTalk/pgDying/pgFallen: they are standing people,
// not bodies, and routing them to last words would kill three characters the
// story needs alive.
const PG_SHOP_SURVIVORS = ['inn', 'store', 'herb'];

function pgCloseShops() {
  for (const v of villagers) {
    if (!PG_SHOP_ROLES.includes(v.role)) continue;
    if (PG_SHOP_SURVIVORS.includes(v.role)) continue;   // inn / store / herb live
    // The blacksmith, and anyone else the row ever gains.
    v.pgTalk = 'shop_' + v.role;
    delete v.role;
    v.pgDying = true;    // last words instead of a shop counter
    v.pgFallen = true;   // and down in the ash with everyone else
  }
  hvRuinShops(worldMaps[0]);
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

// ─── Hendricks' dog ───────────────────────────────────────────────────────────
// The prologue's one creature, and the only thing in the game the player's fists
// can touch. It runs in two phases off the errand:
//
//   Blocking  — before the package. It sits in the gate's single road tile, so
//               the way to the shopkeeper is shut. Dormant: it does not move and
//               does not attack. SPACE beside it calms it aside (dog_blocking
//               clears, it slinks off the road). Not combat, and not resolution:
//               the encounter proper hasn't happened yet.
//   Chasing   — once the package is in hand. It wakes up and comes after the
//               player for 1 damage a touch. Ends one of two ways, both of which
//               set dog_resolved: two punches breaks its nerve (dog_fled), or the
//               player simply gets away from it (dog_outrun).
//
// It is an enemy rather than a villager because that is what gets it pursuit,
// contact damage and tile blocking for free (a dormant enemy still blocks — see
// `blocked` in stepPlayerMovement). What it does NOT get is a death: doPunch
// clamps it at 1 HP and never calls killEnemy, and weapons are locked in the home
// village anyway, so there is no way to kill Old Hendricks' dog in this game.
const DOG_TYPE = 'hendricks_dog';
const DOG_FLEE_HP = 1;          // it breaks off here rather than dying
const DOG_ESCAPE_TILES = 12;    // this far away, for DOG_ESCAPE_MS, and it gives up
const DOG_ESCAPE_MS = 2500;
let dogEscapeTimer = 0;

function pgDog() {
  return enemies.find(e => e.type === DOG_TYPE && !e.dead) || null;
}

// Stand the dog up in the gate. Called from spawnPrologueCast, and again on load
// (restorePrologueAmbience) because enemies live in savedEnemies, not the cast.
function spawnPrologueDog() {
  if (hasFlag('dog_resolved')) return;
  if (pgDog()) return;
  const chasing = hasFlag('fetch_quest_complete');
  // getFlag, not hasFlag: this needs to tell "shooed aside already" (the flag was
  // explicitly set to false) apart from "never met the dog" (no flag at all), and
  // hasFlag collapses both to false.
  const alreadyShooed = getFlag('dog_blocking') === false;
  const spot = (alreadyShooed && !chasing)
    ? HOME.dogShooedTo      // already shooed aside, errand not yet done
    : HOME.dogAt;
  const base = DND_ENEMIES[DOG_TYPE];
  // Same field-for-field shape spawnEnemiesForMap builds (enemies.js). Built by
  // hand rather than through an enemyDef because the dog is placed by the script,
  // not rolled into a map's roster — but every field still has to be here, or the
  // renderer and the AI read undefined off it (the name label did exactly that).
  enemies.push({
    id: enemies.reduce((mx, e) => Math.max(mx, e.id || 0), -1) + 1,
    type: DOG_TYPE, x: spot.x, y: spot.y,
    renderX: spot.x, renderY: spot.y,
    hp: base.hp, maxHp: base.hp,
    spd: base.spd, dmg: base.dmg, xp: 0,
    color: base.color, size: base.size || 1,
    name: base.name,
    ranged: false, swims: false, boss: false,
    flies: false, breath: null,
    // Asleep at the wheel until the package is picked up. Dormant enemies still
    // occupy their tile, which is exactly the "blocks the path" the script wants.
    dormant: !chasing,
    finalBoss: false, tier15: false, element: null,
    timer: 0, dead: false, shootTimer: 0,
  });
  if (!chasing && !hasFlag('dog_resolved')) setFlag('dog_blocking');
}

// SPACE beside the dog while it is still blocking. Calms it and moves it aside.
// Returns true when it handled the keypress.
function tryDogInteraction() {
  if (currentMapId !== 0) return false;
  const d = pgDog();
  if (!d || !d.dormant) return false;
  if (Math.abs(d.x - player.x) > 1 || Math.abs(d.y - player.y) > 1) return false;
  d.x = HOME.dogShooedTo.x; d.y = HOME.dogShooedTo.y;
  d.renderX = d.x; d.renderY = d.y;
  setFlag('dog_blocking', false);
  startDialogue([
    { text: "The dog plants itself in the gap and growls, more nervous than angry." },
    { text: "You hold a hand out low and talk to it. It thinks about it, then slinks off the road to watch you from the fence." },
  ]);
  return true;
}

// Per-frame. Wakes the dog when the package is picked up, then watches for the
// player getting clear of it. Called from update() in main.js.
function stepPrologueDog(dt) {
  if (currentMapId !== 0 || hasFlag('dog_resolved')) return;
  const d = pgDog();
  if (!d) return;

  // The package is in hand: it comes after them. (The chase is ordinary enemy AI
  // from here — stepEnemies moves it, contact does its 1 damage.)
  if (d.dormant && hasFlag('fetch_quest_complete')) {
    d.dormant = false;
    clearFlag('dog_blocking');
    showMapMsg("🐕 Hendricks' dog has found you.");
    return;
  }
  if (d.dormant) return;

  // Broke its nerve. doPunch clamps it at DOG_FLEE_HP and never kills it, so this
  // is the only way the punching route ends.
  if (d.hp <= DOG_FLEE_HP) {
    resolveDog('fled', '🐕 The dog yelps, breaks off, and bolts for home.');
    return;
  }

  // Or the player simply left it behind. Distance has to hold for a couple of
  // seconds so that ducking round a building for one frame isn't an escape.
  const far = Math.abs(d.x - player.x) + Math.abs(d.y - player.y) >= DOG_ESCAPE_TILES;
  dogEscapeTimer = far ? dogEscapeTimer + dt : 0;
  if (dogEscapeTimer >= DOG_ESCAPE_MS) {
    resolveDog('outrun', '🐕 You have outrun the dog. It gives up and trots home.');
  }
}

// One exit for both routes, so neither can forget to set dog_resolved — which is
// what Beat 3 waits on (see checkPrologueTriggers).
function resolveDog(how, msg) {
  const d = pgDog();
  if (d) d.dead = true;
  dogEscapeTimer = 0;
  setFlag(how === 'fled' ? 'dog_fled' : 'dog_outrun');
  clearFlag('dog_blocking');
  setFlag('dog_resolved');
  saveEnemyStateToMap(0);
  showMapMsg(msg);
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
  // Returns whether the prologue actually claimed this conversation. Wren is the
  // store keeper as well as a cast member, so when her handler declines, the
  // caller needs to know to fall through to the shop modal rather than swallow
  // the keypress (see tryVillagerInteraction in villagers.js).
  const lines = PG_LINES[v.pgTalk];
  if (!lines) return false;
  const said = lines();
  if (!said) return false;
  startDialogue(said.lines, said.then || null);
  return true;
}

const PG_LINES = {
  mother: () => {
    if (hasFlag('fetch_quest_complete')) return { lines: [
      { speaker: 'MOTHER', text: "That was quick. Set it by the hearth, would you?" }] };
    if (hasFlag('fetch_quest_active')) return { lines: [
      { speaker: 'MOTHER', text: "Wren's, before they close up. One package, that's all." }] };
    // First time: this is what starts the errand, and Beat 2 with it.
    return {
      lines: [
        { speaker: 'MOTHER', text: "Up already? Good, I need someone to run to the shopkeeper's before they close up." },
      ],
      then: () => {
        setFlag('fetch_quest_active');
        // Belt and braces: the errand is undeliverable if nobody is carrying the
        // package, and the keeper is only Wren because spawnPrologueCast renamed
        // her. Idempotent, so calling it again here costs nothing and closes the
        // gap if the cast ever stands up before the shopkeepers do.
        adoptShopkeeperAsWren();
        showMapMsg('📜 Fetch the package from Wren the shopkeeper.');
        pgKeyHint('Arrow keys to move · Space to talk');
      }
    };
  },

  father: () => ({ lines: [
    { speaker: 'FATHER', text: "Take the shortcut past the mill, it's faster. Mind the Hendricks' dog, he still doesn't like strangers." },
  ], then: () => pgKeyHint('Space interacts with people, doors and whatever is in your way') }),

  grandmother: () => {
    // Beat 5 has its own staging and doesn't come through here.
    if (hasFlag('village_burning')) return null;
    const firstTime = !hasFlag('gran_potions_given');
    return {
      lines: [
        { speaker: 'GRANDMOTHER', paren: 'not looking up',
          text: "Bring me back something sweet, if there's any left. And don't dawdle. The sky's an odd color today." },
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

  // Wren is the store keeper (see adoptShopkeeperAsWren), so this handler only
  // claims the conversation while the errand is live. Returning null hands her
  // back to the shop modal, which is how Beat 2 teaches shop interaction without
  // a second NPC to maintain.
  merchant: () => {
    if (hasFlag('prologue_complete')) return null;
    // She lives through the fire, but she is not open for business in the middle
    // of it. One line, and no shop counter until the ash settles.
    if (hasFlag('village_burning')) return { lines: [
      { speaker: 'WREN', text: "Go. Never mind the shop, never mind any of it. Go and find your family." }] };
    if (hasFlag('fetch_quest_complete')) return { lines: [
      { speaker: 'WREN', text: "Go on, get it home while it's warm. And tell your grandmother I asked after her." }] };
    if (hasFlag('fetch_quest_active')) return {
      lines: [
        { speaker: 'WREN', text: "Your mother's package. Last one, I was about to close up." },
        { text: "You take the bundle. It's still warm." },
      ],
      then: () => {
        setFlag('fetch_quest_complete');
        showMapMsg('📜 Head home.');
      }
    };
    return null;   // no errand yet: she is just the shopkeeper
  },

  child: () => ({ lines: [
    { speaker: 'NETTIE', text: "I can hop the whole square without touching a crack. Watch. No, watch properly." },
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
    { speaker: 'OLD HENDRICKS', text: "Your grandmother. Is she..." },
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
  //
  // Only the blacksmith's is reachable now. The innkeeper, the shopkeeper and the
  // herbalist survive Ashfall (see PG_SHOP_SURVIVORS), so they are never routed
  // to last words. Their three sets are kept rather than deleted: if the survivor
  // list is ever narrowed, the lines they'd need are already written.
  shop_inn: [
    { speaker: 'INNKEEPER', text: "Beds all turned down upstairs. Nobody's coming in now." },
  ],
  shop_store: [
    { speaker: 'SHOPKEEPER', text: "Take what you need off the shelves. Don't stand there counting it out." },
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
        pgKeyHint('Arrow keys to move · Space to talk');
      } },
  ]);
}

// ─── Beat 3 staging ───────────────────────────────────────────────────────────
// The script's ambient shift is four things happening at once: birds go up, the
// villagers stop and look, the wind picks up, and a shadow crosses the ground.
// The shadow was already staged (the emperor steps below). These are the other
// three, as things the player watches rather than lines the player reads.

// The roar. One voice, loaded the way the Wilhelm scream is (see SCREAM_POOL in
// player.js): a media element loads by its own path, which works over file://,
// where fetch + decodeAudioData does not. Bundled locally — the game has to run
// with the machine offline.
const ROAR_AUDIO = new Audio('dragon-roar.wav');
ROAR_AUDIO.preload = 'auto';
ROAR_AUDIO.volume = 0.55;
function playDragonRoar() {
  try { ROAR_AUDIO.currentTime = 0; } catch (_) {}
  // Rejects if the player hasn't clicked yet; the beat plays on regardless.
  ROAR_AUDIO.play().catch(() => {});
}

// Birds off the rooftops. Not enemies and not villagers — they exist for about
// two seconds, have no collision and no state worth saving, so they are their
// own tiny list rather than anything the rest of the game has to know about.
let prologueBirds = [];

function pgScatterBirds() {
  prologueBirds = [];
  // Off the rooftops, so they come from where the buildings are rather than out
  // of empty air. The positions live with the rest of the map's landmarks
  // (HOME.roosts, mapgen-prologue.js).
  for (const r of HOME.roosts) {
    const n = 3 + (r.x + r.y) % 3;          // 3-5 per roost, deterministic
    for (let i = 0; i < n; i++) {
      const ang = ((r.x * 7 + r.y * 13 + i * 29) % 360) * Math.PI / 180;
      // Velocities are per millisecond, so they look far smaller than they are.
      // Over a ~2.8s life these work out at roughly 10 tiles of drift and 7 of
      // climb, which is a flock leaving the rooftops — an earlier pass had them
      // an order of magnitude faster and they were off the screen in half a
      // second, before the player could register what had moved.
      prologueBirds.push({
        x: r.x + (i % 3) * 0.4, y: r.y + (i % 2) * 0.4,
        vx: Math.cos(ang) * 0.0022 + 0.0016,   // drifting broadly east, away
        vy: -Math.abs(Math.sin(ang)) * 0.0026 - 0.0010,
        alt: 0, rise: 0.0022 + (i % 4) * 0.0004,
        flap: (r.x + i) * 0.9,
        life: 2600 + (i % 5) * 200,
      });
    }
  }
}

function stepPrologueBirds(dt) {
  if (!prologueBirds.length) return;
  for (const b of prologueBirds) {
    b.x += b.vx * dt; b.y += b.vy * dt;
    b.alt += b.rise * dt;
    b.life -= dt;
  }
  prologueBirds = prologueBirds.filter(b => b.life > 0);
}

// Wind. A level that ramps up and holds for the rest of the beat; render.js
// draws it as streaks blowing across the map (drawPrologueWind).
let prologueWind = 0;
let prologueWindTarget = 0;
function pgRaiseWind(to) { prologueWindTarget = to; }
function stepPrologueWind(dt) {
  if (prologueWind === prologueWindTarget) return;
  const rate = dt / 900;
  prologueWind += Math.sign(prologueWindTarget - prologueWind) *
                  Math.min(rate, Math.abs(prologueWindTarget - prologueWind));
}

// Everyone stops and looks up. `lookUp` turns them to face away from the camera
// (north is "up" in a top-down view) and is read by drawVillager for the tilted
// head. They stay like that until the fire gives them something else to do.
function pgVillagersLookUp() {
  for (const v of villagers) {
    if (v.pgDead || v.pgFallen) continue;
    v.lookUp = true;
    v.dir = { x: 0, y: -1 };
  }
}

// Per-frame driver for the three of them. Called from update() in main.js.
function stepPrologueAmbience(dt) {
  stepPrologueBirds(dt);
  stepPrologueWind(dt);
  stepPrologueBreath(dt);
}

// Put the weather away. The birds are gone by now on their own, but the wind and
// the upturned faces are held states: the three survivors of Ashfall would
// otherwise still be staring at a sky that has been empty for the rest of the
// game. Called when the prologue closes, and on load for a save written after it.
function pgClearAmbience() {
  prologueBirds = [];
  prologueWind = 0;
  prologueWindTarget = 0;
  prologueBreath = null;
  for (const v of villagers) delete v.lookUp;
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
    // Birds first, then the heads turn, then the wind. Staged in that order and
    // spaced apart because they are a sequence of tells, not one event: the
    // animals know before the people do, and the people know before the sky
    // shows them anything.
    { run: () => pgScatterBirds() },
    { wait: 700 },
    { run: () => pgVillagersLookUp() },
    { run: () => pgRaiseWind(1) },
    { wait: 900 },
    // A shadow crosses the ground. He is too far to make out clearly yet — the
    // script is specific about that, so he is drawn tiny, high, and moving fast.
    { emperor: { x: HOME.center.x - 30, y: HOME.center.y - 24, alt: 26, scale: 0.30 } },
    { emperorFly: { x: HOME.center.x + 34, y: HOME.center.y - 14, alt: 26, scale: 0.30 }, ms: 2600 },
    { say: [
      { speaker: 'VILLAGER', paren: 'offscreen', text: "...Do you feel that?" },
    ] },
    { emperor: null },
    { wait: 700 },
    // The roar itself. Sound and shake together, then the line — the player
    // should hear it before they are told they heard it.
    { run: () => playDragonRoar() },
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
    //
    // The breath goes first and the charring follows it, so the fire is visibly
    // the cause rather than the two being simultaneous. pgBreathe sweeps a wall
    // of flame out of the Emperor and across the screen (drawPrologueBreath).
    { run: () => pgBreathe(C) },
    { wait: 500 },
    { run: () => {
        burnLevel = 0.35;
        pgEmberBurst(C, 40);
        // "Player HP is reduced to 3." Exactly 3, set rather than subtracted:
        // the hero is meant to reach the house on their last legs no matter what
        // they walked in with, and a fixed floor is the only way that beat lands
        // the same for a full-health player and a scraped-up one. tempHp is
        // cleared with it, or a green-heart buffer bought before the errand would
        // survive a dragon.
        player.hp = Math.min(3, player.maxHp);
        player.tempHp = 0;
        if (typeof updateHUD === 'function') updateHUD();
      } },
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
        // Wren is deliberately absent from this list. She is the shopkeeper, and
        // the shopkeeper is one of the three the script keeps alive.
        pgWound('child', 'friend', 'elder', 'watcher', 'mother', 'father');
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

// ─── The dragon's breath ──────────────────────────────────────────────────────
// The flame sweep of Beat 4's opening strike: a wall of fire that leaves the
// Emperor and crosses the whole screen. State only — drawPrologueBreath in
// render.js paints it, and stepPrologueBreath advances it.
//
// A timed sweep rather than a cutscene step so the charring passes can run over
// the top of it: the fire is still crossing while the tiles behind it blacken,
// which is what makes the flame read as the cause of the ruin instead of a
// flourish that happens next to it.
let prologueBreath = null;
const BREATH_MS = 1900;

function pgBreathe(from) {
  prologueBreath = { x: from.x, y: from.y, t: 0, ms: BREATH_MS };
}

function stepPrologueBreath(dt) {
  if (!prologueBreath) return;
  prologueBreath.t += dt;
  if (prologueBreath.t >= prologueBreath.ms) prologueBreath = null;
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
    // The fire took the lock off the chest, so the room the player walks into is
    // the room the script describes: her, the bow out of reach, and the chest
    // already open beside her.
    { run: () => pgBurnChestOpen() },
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
      // The chest, called out here rather than left for the player to notice: it
      // is the second half of the script's image of this room, and her last
      // instruction depends on the player already knowing it is standing open.
      { text: "The household chest stands open beside her. Its lock has burned away." },
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

    // The partial truth, verbatim from DOCX v3 bar its em dashes (dialogue in this
    // game has none — see the checklist's stage 1). Read the story bible before
    // editing a word of it. Two things it must do and no more: tell the player the
    // crown was given to him by people now long dead, and make the attack personal
    // ("he was after you"). It must NOT say who those people were, why he came for
    // this family, or anything about a wizard or a potion — the midgame fortune
    // tellers and the final-boss scene are where that lands, and they only land if
    // she leaves the hole.
    { say: [
      { speaker: 'GRANDMOTHER',
        text: "He's no dragon of legend, child. Not truly. That crown he wears, it isn't his by right. It was promised to him, a long time ago, by people who should have known better. By people who are long dead..." },
      { speaker: 'GRANDMOTHER',
        text: "He was after us... he was after you..." },
      { text: "Her hand closes weakly around yours." },
      { speaker: 'GRANDMOTHER',
        text: "Don't let it be for nothing. Take the bow and what's in the chest. Find out what he took, and what he's still taking. And when you're standing in front of him..." },
      { speaker: 'GRANDMOTHER', paren: 'the faintest, tired smile',
        text: "...don't miss." },
    ] },

    // She goes still. The held beat: no music, no prompt, no banner, no message,
    // nothing on screen but the room. Everything that would break it is on the
    // other side of the wait.
    { wait: 2600 },
    { run: () => {
        // She stays where she fell, like everyone else. Removing her here would
        // have the room tidy itself while the player is still standing in it.
        pgLayToRest(pgFind('grandmother'));
        saveVillagersToMap(0);
      } },
    { wait: 1200 },

    // Then the chest, which is the last thing she asked for. Walked to rather
    // than granted from across the room: the sword is the one item in the game
    // the player is told where to find, and the walk is what makes taking it an
    // action instead of a notification. walkPlayer skips itself if the route is
    // somehow blocked, so the grant below cannot be stranded behind it.
    { walkPlayer: { x: HOME.chest.x, y: HOME.chest.y - 1 } },
    { say: [
      { text: "The lock is gone, burned through. Inside, wrapped and unburnt, is a sword, and a quiver of ten plain arrows." },
    ] },
    { run: () => {
        grantGrandmothersWeapons();
        // No revenge damage bonus here, deliberately: the DOCX floats one as an
        // option and the checklist says not this pass.
        setFlag('revenge_triggered');
      } },
    { say: [{ text: "Grandmother's Bow and Grandmother's Sword. Hers, and her mother's before that." }] },

    { fade: 1, ms: 2200 },
    { wait: 800 },
    { run: () => {
        burnLevel = 0.25;      // the fire burns down but the ruin keeps smouldering
        letterboxLevel = 0;
        showMapMsg('⚔️  T H E   R P G   G A M E');
      } },
    { wait: 2600 },
    { fade: 0, ms: 1600 },
    { run: () => setFlag('prologue_complete') },
    { run: () => pgClearAmbience() },
    // Whoever the player didn't get back to dies where they lie. Spoken to or
    // not, everyone stays visible from here on — the ruin keeps its dead.
    { run: () => pgLayOutTheDead() },
    // The fire is out. Clearing this keeps a played run's flag bag identical to
    // a skipped one (see skipPrologue) — if the two diverge, anything that later
    // reads story state behaves differently depending on how the player got here.
    { run: () => clearFlag('village_burning') },
    { run: () => {
        // Both weapons are new, so say what they're on. Desktop only: pgKeyHint
        // drops it in touch mode, where the two weapon buttons on screen are the
        // lesson. Held back until here rather than fired with the grant, because
        // a nine-second toast raised in the same breath would still be sitting on
        // top of the title card.
        pgKeyHint('Z swings the sword · X draws the bow · 1 and 2 switch between them');
        showMsg('Step outside. South, out of the village.', 0);
        if (typeof autoSave === 'function') autoSave();
      } },
  ]);
}

// The grant itself. One place, so the skip-prologue path and Beat 5 can't drift.
// Both weapons, not just the bow: the sword is what's in the chest she tells the
// player to open, and a hero who leaves this room with only a bow can never get a
// sword at all (nothing else in the game grants one). The bow is what gets
// equipped — the sword is left to normal weapon selection.
function grantGrandmothersWeapons() {
  player.hasBow = true;
  player.hasSword = true;
  player.arrows = player.arrows || {};
  player.arrows.plain = Math.max(player.arrows.plain || 0, 10);
  // Take the bow off the floor. It has been a visible object since Beat 1 (see
  // GRAN_BOW / HOME.bowRestAt), so leaving the prop lying there after the player
  // is told to pick it up would read as having failed to. Both of its possible
  // resting places are cleared, because skipPrologue grants the weapons without
  // the fire ever having moved it.
  const home = worldMaps[0];
  if (home && home.map) {
    const clear = (p, to) => { if (home.map[p.y][p.x] === T.GRAN_BOW) home.map[p.y][p.x] = to; };
    clear(HOME.bowAt, T.SCORCHED_FLOOR);
    clear(HOME.bowRestAt, T.FLOOR);
    if (typeof minimapDirty !== 'undefined') minimapDirty = true;
  }
  // The bow is what she puts in their hands, so the bow is what's drawn when the
  // scene ends. The sword is left to normal weapon selection — it is already in
  // the [Z] slot, the [1] key and the radial's swords ring, all three of which
  // switch on player.hasSword and were empty until this line ran.
  player.weapon = 'bow';
  updateHUD();
  // [Z] stopped being a punch a moment ago. The title-screen control hint names
  // whichever it currently is, so it has to be repainted (refreshControlHints,
  // main.js) rather than left promising fists to the next hero who reads it.
  if (typeof refreshControlHints === 'function') refreshControlHints();
}

// The chest's lock burns off in Ashfall, and the chest stands open from Beat 5
// onward. "Open" is map state rather than a tile of its own — the same
// `openedChests` set the renderer reads for every other chest in the game (see
// isHomeStoryChest / handlePickup in player.js), so the burnt lid costs no new
// tile type, no art, no minimap colour and no burn rule, and it persists through
// save/load for free.
function pgBurnChestOpen() {
  const home = worldMaps[0];
  if (!home || !home.openedChests) return;
  home.openedChests.add(`${HOME.chest.x},${HOME.chest.y}`);
  minimapDirty = true;
}

// ─── Objective markers ────────────────────────────────────────────────────────
// Where the errand is pointing, right now. Two of them, one per leg: Wren while
// the package is out, then the family home's door on the way back. Drawn in
// world space from render.js (after the villagers, so nothing paints over them).
//
// The door marker is a tile position rather than a villager glyph because the
// person who wants the package back is standing inside the house, and a marker
// only her own walls can hide is no marker at all.
function prologueObjective() {
  if (currentMapId !== 0) return null;
  if (hasFlag('warning_seen')) return null;      // the sky is the objective now
  if (hasFlag('fetch_quest_complete')) return { at: HOME.door, glyph: '🏠' };
  if (hasFlag('fetch_quest_active')) {
    const wren = villagers.find(v => v.pgTalk === 'merchant');
    if (wren) return { at: { x: wren.x, y: wren.y - 1 }, glyph: '📦' };
    return { at: HOME.shops.store.door, glyph: '📦' };
  }
  return null;
}

// Paint it. Same bobbing, stroked glyph the escort markers use (villagers.js), so
// an objective reads as the same kind of thing everywhere in the game.
function drawPrologueObjective(ts) {
  const obj = prologueObjective();
  if (!obj) return;
  const sp = screenPX(obj.at.x, obj.at.y);
  const bob = Math.sin(Date.now() / 300) * (ts * 0.06);
  ctx.font = `bold ${Math.round(ts * 0.5)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 2;
  ctx.fillStyle = '#ffdd33';
  ctx.strokeText(obj.glyph, sp.x, sp.y - ts * 0.55 + bob);
  ctx.fillText(obj.glyph, sp.x, sp.y - ts * 0.55 + bob);
  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
}

// ─── Trigger check ────────────────────────────────────────────────────────────
// How close to HOME.door the player has to get for Beat 3 to fire, in tiles.
const WARNING_RADIUS = 7;
// Beat 3 fires when the player carries the package back toward the family home.
// Checked per-frame from update() rather than from a tile, so there's no seam
// the player can walk around, and no trigger tile to render.
function checkPrologueTriggers() {
  if (!hasFlag('fetch_quest_complete')) return;
  // The dog has to be done with, either way it ends. Beat 3 drops the sky on the
  // village and locks the player into the run home; firing it mid-chase would
  // strand a live enemy in a scene that has no combat in it, and would cut the
  // tutorial the encounter exists to deliver.
  if (!hasFlag('dog_resolved')) return;
  if (hasFlag('warning_seen')) return;
  if (currentMapId !== 0) return;
  // Within seven tiles of the front door, by straight-line distance. A radius
  // rather than the old "north of the square and roughly on the road" box: the
  // box could be entered from the side without ever heading home, and could be
  // skirted entirely by looping round the back of the house.
  const dx = player.x - HOME.door.x, dy = player.y - HOME.door.y;
  if (dx * dx + dy * dy <= WARNING_RADIUS * WARNING_RADIUS) {
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
  // The dog encounter is behind a skipped run too, or Beat 3's gate would hold a
  // skipped hero forever and the flag bag would differ from a played one.
  setFlag('dog_resolved');
  setFlag('dog_outrun');
  clearFlag('dog_blocking');
  setFlag('warning_seen');
  setFlag('revenge_triggered');
  setFlag('prologue_complete');
  clearFlag('village_burning');
  // The strike leaves the hero on 3 HP, so a skipped run has to arrive on 3 as
  // well. Everything this function sets has to match what the beats set, or the
  // two entry points into the open world are not the same game.
  player.hp = Math.min(3, player.maxHp);
  player.tempHp = 0;
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
    // Wren survives here too, for the same reason she does in the played run.
    pgWound('child', 'friend', 'elder', 'watcher', 'mother', 'father');
    pgCloseShops();               // kills the smith, ruins the surviving three
    pgLayToRest(pgFind('grandmother'));
    pgLayOutTheDead();
    home.map = buildRuinedHomeVillage();
  } else {
    spawnVillagersForMap(0);      // legacy map 0 (the old starter cabin)
  }
  // Both of these run AFTER the ruin is rebuilt, not before, because both of them
  // edit it: the grant lifts Grandmother's Bow off the floor, and a rebuilt ruin
  // lays a fresh one back down (hvPinGrandmother). Granting first left the bow
  // prop lying in a room the hero had supposedly just picked it up from.
  pgBurnChestOpen();
  grantGrandmothersWeapons();
  placePlayerInFamilyHome(home);
  burnLevel = 0.25;
  minimapDirty = true;
  revealWalk(currentMap(), player.x, player.y);
  clampCam(true);
  updateHUD();
  // Same card Beat 5 shows. It said HYRULE QUEST, which is the pre-rename title
  // and the one thing a skipped prologue put on screen that a played one never
  // did (see the storage-key migration in config.js for the rename itself).
  showMapMsg('⚔️  T H E   R P G   G A M E');
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
  // The dog lives in savedEnemies, which a save written before it existed does
  // not have, and which a mid-prologue save may have captured while it was still
  // dormant in the gate. spawnPrologueDog is a no-op when it is already standing
  // or already dealt with, so this only fills the gap.
  if (currentMapId === 0 && hasFlag('prologue_started') && !hasFlag('prologue_complete')) {
    adoptShopkeeperAsWren();
    spawnPrologueDog();
  }
  // The birds and the wind are transient and don't belong in a save; the
  // upturned faces do, right up until the prologue ends. Past that, clear them.
  prologueBirds = [];
  prologueWind = prologueWindTarget = 0;
  if (hasFlag('prologue_complete')) pgClearAmbience();
  migratePrologueAftermath();
}

// Bring a save written before this stage into line with what Beat 5 now leaves
// behind. Two things, both on map 0 and both harmless to re-apply:
//
//   • the chest stands open. Saves from before the lock burned off stored it
//     shut, and the player is already carrying what was in it.
//   • the bow is gone from the floor. Only skipped runs are affected — the old
//     skip granted the weapons and *then* rebuilt the ruin, which laid a second
//     bow back down beside her (fixed in skipPrologue), and that stray prop is
//     in the stored tiles of any save written after one.
//
// Keyed on revenge_triggered rather than prologue_complete: that is the flag that
// means she handed both weapons over, and it is set a few seconds earlier.
function migratePrologueAftermath() {
  if (!hasFlag('revenge_triggered')) return;
  const home = worldMaps[0];
  if (!home || home.type !== 'homevillage') return;
  pgBurnChestOpen();
  if (home.map && home.map[HOME.bowAt.y][HOME.bowAt.x] === T.GRAN_BOW) {
    home.map[HOME.bowAt.y][HOME.bowAt.x] = T.SCORCHED_FLOOR;
    minimapDirty = true;
  }
}
