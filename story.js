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
