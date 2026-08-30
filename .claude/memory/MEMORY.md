## How I should work here

- [Prose style](prose-style.md): no em dashes in anything user-facing, including markdown deliverables and commit messages.
- [Verify facts before stating](verify-facts-before-stating.md): check claims against the source; hedge with "i think..." when unconfirmable.
- [Memories decay](memories-decay.md): treat notes as hypotheses about the past; audit the whole set against the code at handoff points.
- [Claude's mistake log](claude-mistake-log.md): running error log, plus the pattern behind them: a cheap secondary signal standing in for the primary source.
- [Verifiers fail correct code](verifiers-fail-correct-code.md): suspect my own check and my own spec before blaming the tool or the model.
- [User's mistake log](user-mistake-log.md): running record of the user's mistakes and how they self-corrected. Empty so far.

## The project

- [Project renamed to Hero of Stormdrift](project-renamed-stormdrift.md): repo, folders and older docs still say Game1; the git repo is the inner Game1/Game1.
- [Repo inside Google Drive](repo-inside-google-drive.md): historical; resolved by the Linux move, keep as the reason not to put it back under a sync client.
- [Umbral Sanctum work](umbral-sanctum-work.md): shadow-village skin and Obsidian Spire; unfinished, gate orientation blocks it.
- [perf-hud.js is temporary](perf-hud-temporary.md): diagnostic only; remove before release, three edits.

## Art pipeline

- [Aseprite for all artwork](aseprite-for-all-artwork.md): every sprite and tile comes from a tools/make-*-sheet.lua, never procedural drawing code.
- [Hero canon art](hero-canon-art.md): hero-portrait.png is the real player design; 128px frames, hero-atlas.js is generated, drawPlayer() is only the fallback.
- [Sprite scale decisions](sprite-scale-decisions.md): 1.25 tiles, portrait-faithful, body box is footprint not height; new sheets must match.
- [NPC sprite project](npc-sprite-project.md): replace every NPC/player sprite; hero shipped hi-res, villagers half done, a low-res revert was tried and abandoned.
- [Sprite verifier tooling](sprite-verifier-tooling.md): headless sprite checks in tools/, still untracked.
- [Dev shot harness](dev-shot-harness.md): iframe harness to screenshot any map or region; watch the burnLevel fire wash.

## Adjacent work

- [Triumphant Gaming logo](triumphant-gaming-logo.md): chosen concept, palette, brand/ assets, and the two unfinished fixes.
- [ComfyUI lowvram constraint](comfyui-lowvram-constraint.md): remind user to close ollama before ComfyUI work; 6GB GPU, tiled VAE decode as fallback.
