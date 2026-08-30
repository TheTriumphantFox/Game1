---
name: repo-inside-google-drive
description: "The Game1 working copy sits inside a Google Drive synced folder, which injects desktop.ini into .git and creates fake broken refs."
metadata:
  node_type: memory
  type: project
  modified: 2026-08-27T21:30:00.000Z
---

**Resolved on the current machine, verified 2026-08-30.** The working copy now
sits at `/home/hm/Projects/Game1/Game1` on Linux, outside any sync client.
`find .git -name desktop.ini -type f` returns zero, and there is no nested
`.git/.git`. Keep this note as the reason not to move the repo back under a
synced folder, not as a description of the present state.

On the original machine the repo lived at `C:\Users\corte\MACortese42\Game1\Game1`,
and `MACortese42` is a **Google Drive File Stream** synced folder, not an
ordinary directory. Drive writes a folder-icon `desktop.ini` into every folder
it syncs, and it does not skip `.git`.

**What that produced,** measured on 2026-08-27: 475 `desktop.ini` files inside
`.git`, including one in every `objects/` subdirectory; 192 of them sitting in
`refs/` where git read them as refs, so `git fsck` reported 192
`badRefContent` errors and every `git branch` printed "ignoring broken ref";
and a nested empty `.git/.git/` skeleton (config, HEAD, hook samples, nothing
else). No object corruption resulted, and `git fsck` was otherwise clean apart
from ordinary dangling blobs.

**Why it matters:** this is cosmetic until it is not. A sync client writing into
a live `.git` while git is writing to it is a real corruption risk, and the
nested `.git/.git` is evidence that something already copied a git directory
into itself. It also makes `git fsck` output useless for spotting genuine
problems, because 192 fake errors bury anything real.

**How to apply:** the fix is not to keep deleting the files, because Drive
recreates them. Keep the working copy **outside** any synced folder (Drive,
OneDrive, Dropbox) and let GitHub be the sync mechanism, which is what it is
for. If the repo must stay in a synced folder, exclude it from syncing at the
client rather than at git.

To clear the noise when it recurs, from the repo root:

```
find .git -name desktop.ini -type f -delete
```

`desktop.ini` is already in `.gitignore`, so the working tree copies never get
committed. That rule does nothing about the ones inside `.git`, which is a
different problem: git does not consult `.gitignore` for its own directory.

Related: [[project-renamed-stormdrift]] for where the repo actually sits.
