# Handoff: Audit fixes H1 through H3, M1 through M3, L1
_Last updated 2026-09-07: H1, H2, H3, M1, M2, M3, and L1 are all implemented and browser-verified. Nothing from this audit pass remains uncommitted-but-unfixed._

## Goal
Finish the confirmed reliability findings in `/home/hm/Projects/Game1/Game1` one at a time. H1 checkpoint isolation, H2 armor-aware overworld connectivity, H3 save-size growth, M1 name-prompt freeze, M2 Controls-modal focus navigation, M3 malformed-load-data handling, and L1 lifetime death count are all implemented in the current uncommitted worktree. Do not discard the existing changes.

## State

### Completed and verified

- **H1, new-run checkpoint isolation:** `main.js` title new-game paths and `save.js` `resetGame()` call `initializeNewRunCheckpoint()`. It clears only the rolling autosave and in-memory checkpoint; named slots remain untouched.
- **H2, overworld connectivity:** `connectivity.js` now roots the armor-free flood at one open exit, joins every other open exit deterministically, and validates medium-water, ledge-face, feature, Air-glide, and Shadow-step routes under the combined Water/Earth/Air/Shadow model. Armor switching is allowed only on ordinary ground, matching the one-active-armor runtime. `tools/verify-connectivity.js` and `connectivity-check.html` are the development verifier.
- **H3, compact saves:** `save.js` emits `SAVE_FORMAT_VERSION = 2`. Seeded dirty maps store sparse flat-index tile deltas against deterministic regeneration. Unseeded maps use tagged RLE or a raw packed fallback. `map-helpers.js` owns the codecs. The loader retains a raw decoder for convenience, but preserving pre-v2 saves was not a requirement.
- **Development checks:** `tools/verify-save-size.js` and `save-size-check.html` reproduce the audit workload. One changed tile on 180 seeded maps produced a 194,721-character payload, stored successfully in Firefox, and round-tripped all changed maps. Marking all 548 generated maps visited produced about 328 KB; nine copies stored successfully.
- **M1, name-prompt freeze:** `main.js`'s `update()` freeze-chain was missing `namePromptOpen`. It only mattered mid-run: `titleNewGame()`/`titleNewGameSkip()` open the prompt before `gameStarted` is true, so the title-screen path was already frozen, but the in-game 🆕 New button (`newGame()` in `save.js`) opens the prompt via `openNamePrompt(name => resetGame(name))` while `gameStarted` is already true — enemies, cooldowns, and held movement kept ticking behind the modal. Added `namePromptOpen` to the freeze condition alongside the other modal flags. Verified in-browser: `attackCooldown` set to 5, prompt opened, `update(1.0)` called, cooldown still 5 (frozen); previously it would have dropped to 4.
- **M2, Controls modal focus navigation:** `controlsCaptureKey()` (`sysmenu.js`) returned `true` for every key while the window was open — even when idle, not capturing a rebind — and the caller in `main.js` unconditionally called `e.preventDefault()` whenever it returned `true`. That blocked Tab, Shift+Tab, Enter, and Space from ever reaching the browser's native focus-move/button-activate behavior, so a keyboard user couldn't Tab between the window's buttons or press Enter/Space to activate one. Fixed by having `controlsCaptureKey()` return `false` (not `true`) for Tab/Enter/Space when idle; `main.js` now has a second guard (`if (controlsOpen) return;`) right after the capture check so those keys still don't leak through to gameplay, they just aren't `preventDefault()`ed. Verified in-browser via dispatched `KeyboardEvent`s: `Tab`/`Enter`/`Space` now have `defaultPrevented === false` while the window is open and idle; an ordinary gameplay key (`w`) still has `defaultPrevented === true`. Note: the window's own `renderControlsWindow()` rebuilds `#controls-modal`'s `innerHTML` on every button click, which drops DOM focus back to `<body>` after each click — that's a pre-existing, separate quirk of the innerHTML re-render pattern (not a Tab-swallowing bug) and wasn't part of this finding; flagging it here rather than fixing it in this pass.
- **M3, malformed load data / save-index:** Two related fixes in `save.js`. (1) `getSaveIndex()` called `JSON.parse()` on the `stormdrift_index` localStorage key with no guard; a corrupted index threw straight out of `renderSlotList()` and broke the save/load modal entirely. Now wrapped in try/catch, returns `{}` on any parse failure or non-object result, logs via `console.warn`. (2) `applyLoadData()` used to mutate `player`, `currentMapId`, `worldMaps`, and a dozen other globals progressively as it walked the save payload; a malformed payload (missing fields, or a per-map entry that fails during rebuild — e.g. `rebuildSeededMapFromLite`'s `Map delta has no seeded recipe`) could throw partway through, after some globals were already overwritten with the new save's data and others weren't, leaving the live game a hybrid of the old session and a half-applied load. The original body is now `applyLoadDataUnsafe()`; the new `applyLoadData()` snapshots every global the function can touch, runs `applyLoadDataUnsafe()` in a try/catch, and on any throw restores every snapshotted value before rethrowing — callers (`doLoad`, `doLoadAuto`, `reloadLastSave`) already catch and report the failure and needed no changes. `applyLoadDataUnsafe()` also now validates up front (`data` is an object, `data.player` is an object, `data.worldMapsLite` is a non-empty array) and throws before touching any live state if not. Verified in-browser: corrupting `stormdrift_index` no longer throws from `getSaveIndex()`; calling `applyLoadData()` with no `worldMapsLite` throws and leaves `player`/`currentMapId`/`worldMaps` completely unchanged; forcing a real throw deeper in the per-map rebuild step (null `mapSeed` with a `mapDelta` present) after `player` had already been reassigned still fully restores `player.heroName`, `currentMapId`, and the `worldMaps` array reference to their pre-load values.
- **L1, lifetime death count:** `respawn()` (`player.js`) called `reloadLastSave()` (which overwrites `player` — including `player.deaths` — from the checkpoint's own stored value) and only *then* did `player.deaths = (player.deaths || 0) + 1`, so every respawn against the same stale checkpoint reset the counter to "checkpoint's deaths + 1" instead of accumulating. Fixed by reading `player.deaths` into a local `lifetimeDeaths` constant *before* `reloadLastSave()` runs, and assigning that (not a post-reload re-read) in both the reload-succeeded and return-to-start branches. Verified in-browser: seeded a checkpoint with a stale `deaths: 3`, set live `player.deaths = 5`, called `respawn()` twice — result was 6 then 7, not 4 then 4.

The current worktree is uncommitted. Changed tracked files include `CODEX_HANDOFF.md`, `abilities.js`, `connectivity.js`, `elemental-armor-implementation-notes.md`, `main.js`, `map-helpers.js`, `mapgen-biomes.js`, `mapgen-foliage.js`, `mapgen-tower.js`, `player.js`, `save.js`, and `sysmenu.js`. New development files are `connectivity-check.html`, `save-size-check.html`, `tools/verify-connectivity.js`, and `tools/verify-save-size.js`.

Verification completed against this worktree:

- `node --check` passed for all root and tool JavaScript files.
- `python tools/lint-conventions.py` reported 0 errors; remaining warnings and note are pre-existing (`perf-hud.js`, `world.js`, `prologue.js`).
- `git diff --check` passed and all 66 `index.html` script references exist.
- Direct `file://` Firefox boot, skip-prologue flow, named save round-trip, H2 connectivity, H3 save-size storage, and full-world generation passed with no page errors.
- H2 verifier covered 260 seeded maps with zero failures, including Forest seed 4 and Fire seed 1 regressions.

One performance caveat: the first save after many dirty seeded maps rebuilds their baselines, measured at about 2.4 seconds for the 180-map synthetic workload. The cached repeat save measured about 90 ms.

### Remaining audit findings

None open from this pass. M1, M2, M3, and L1 are implemented and verified (see the bullets above); no further findings from this audit round are outstanding.

One thing noticed but deliberately not fixed here, since it wasn't part of this audit and is a separate concern: the Controls window's `renderControlsWindow()` rebuilds `#controls-modal`'s `innerHTML` on every button click, which drops DOM focus back to `<body>` after each click. Worth a look if keyboard-only navigation of that window becomes a priority beyond "Tab/Enter/Space aren't swallowed."

## Next Steps

1. Review the uncommitted H1-H3-M1-M2-M3-L1 diff and commit it through the normal project workflow. Do not reset or discard it.
2. Re-run syntax, convention lint, and a targeted browser pass after any further change, the same way each finding above was verified.

## Dead Ends

- Full-map Base64 for every changed seeded map reproduced the H3 quota failure, so it was replaced with sparse deltas. RLE remains the fallback when a delta would be larger.
- H2's old flood through `T.MEDIUM_WATER` was not retained because runtime movement treats it as solid without Water armor. The final graph models Water and Earth standing states plus Air and Shadow active traversal instead.
- Legacy save migration was intentionally not expanded after the user authorized breaking compatibility for this H3 pass.

## Environment

The game is a flat classic-script project with no build or dependency step. Open `/home/hm/Projects/Game1/Game1/index.html` directly over `file://`; do not add a server or module requirement. `connectivity-check.html` and `save-size-check.html` are development harnesses that boot the real game and inject their verifier scripts.

Useful checks:

```text
node --check <changed-file.js>
python tools/lint-conventions.py
```

The browser checks use headless Firefox with Playwright in the existing environment. No development server, watcher, or other session-owned long-running process was left running.
