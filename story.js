// ─── Story flags ──────────────────────────────────────────────────────────────
// The single home for narrative state. Everything the story needs to remember
// between sessions — which prologue beat has played, whether the village has
// burned, whether the player has a reason to hate the Emperor — lives in one
// bag on the player object: `player.flags`.
//
// Why here and not on `player` as named fields: the quest dictionaries in
// player.js (collectorQuests, guildQuests, …) are per-region and mechanical —
// they carry status plus payload and are read by the systems that own them.
// Story flags are one-shot switches read from anywhere, and a field per beat
// would mean touching the three-site save convention every time a scene is
// written. One bag, declared once.
//
// Persistence is free: save.js serializes `player` whole, so anything set here
// is in the next save. `flags: {}` is declared in all three of the places this
// codebase requires (the player literal in player.js, DEFAULT_PLAYER in
// save.js, and the resetGame assignment in save.js), and applyLoadData clones
// it so an old save can't alias the shared default.
//
// Note for future work: the world coordinate registry in world.js is NOT this.
// It tracks which generated map sits at which grid cell and has no flag API.

// Flags currently in use. This list is documentation, not enforcement —
// setFlag accepts any name — but keep it current, because "what story state
// exists?" is otherwise unanswerable without grepping the whole repo.
//
//   prologue_started      the opening cutscene has begun (Beat 1)
//   fetch_quest_active    Mother has sent the player to the market (Beat 2)
//   fetch_quest_complete  the errand item is in hand; objective is "Head home"
//   gran_potions_given    Grandmother has handed over the starting potions (Beat 1)
//   village_burning       the Emperor has struck; map 0 is charring (Beat 4)
//   revenge_triggered     Grandmother's dying words have landed (Beat 5)
//   prologue_complete     title card shown; the open world begins
//
// Declared here, set by the beats/systems that own them (see the stage they
// belong to in main-quest-implementation-todo.md). Listed now so the whole flag
// vocabulary is in one place rather than appearing a stage at a time:
//
//   Beat 2 — Hendricks' dog (stage 4)
//   dog_blocking          the dog is at the gate as the pre-package obstacle
//   dog_resolved          the encounter is over by any route; Beat 3 may now fire
//   dog_fled              …specifically because it was punched down to 1 HP
//   dog_outrun            …specifically because the player outran it instead
//
//   Midgame fortune tellers (stage 8) — one per telling, in progression order
//   fortune_water         the crown predates the dragon
//   fortune_volcanic      the Emperor began human and wanted more time
//   fortune_luminous      a ruling house vanished during the takeover
//   fortune_mana          Elderbrook's oldest records were deliberately erased
//
//   Corruption spread (stage 8)
//   corruption_level      NOT a boolean — the highest region index the blight has
//                         reached. Read with getFlag, not hasFlag (0 is falsy and
//                         is a real value: the forest has been reached).
//
//   Final boss (stage 10) — one-shots, so no line ever replays on a reload
//   boss_intro_seen       the pre-fight throne-room cutscene has played
//   boss_line_50          the 50% HP line has fired
//   boss_line_15          the 15% HP stagger and flicker have fired
//   boss_monologue_done   the dying monologue finished; wonGame may now be set
//
// See .claude/skills/the-rpg-game/references/prologue-script.md for the beats
// these correspond to.

// Set a flag. Defaults to true because nearly every use is "this happened".
function setFlag(name, val = true) {
  if (!player.flags) player.flags = {};
  player.flags[name] = val;
}

// Raw value — use when a flag carries something other than a boolean.
function getFlag(name) {
  return player.flags ? player.flags[name] : undefined;
}

// Truthiness test. The common case; safe on a player whose flags bag is missing
// entirely (an old save mid-load, before applyLoadData has run).
function hasFlag(name) {
  return !!getFlag(name);
}

// Remove a flag outright. Rare — prefer setFlag(name, false) when "it happened
// and then stopped" is meaningful. Used for transient beats like
// `village_burning`, which should not linger once the fire is out.
function clearFlag(name) {
  if (player.flags) delete player.flags[name];
}
