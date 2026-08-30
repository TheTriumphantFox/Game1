#!/usr/bin/env python3
"""Independent verifier for tools/make-villager-sheet.lua.

Lives OUTSIDE the delegated worker's writable tree on purpose: the worker gets
autonomous bash+edit inside the project, so a verifier it can reach is a
verifier it can satisfy by editing. Exit 0 only if every check passes.
"""
import json, re, subprocess, sys, os
from PIL import Image

G = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
os.chdir(G)

FRAME, BODY, PER_DIR, DIRS = 96, 48, 6, ["down", "up", "left", "right"]
SHEET_COLS = 24
FOOT_F = 0.96

# The key colours the sheet is allowed to contain. Anything else is a failure:
# villager-sprite.js recolours by exact match, so a stray anti-aliased or
# hand-picked colour would survive recolouring and show up as a coloured speck.
KEYS = {
    "robe_d": (0x7f, 0x00, 0x00), "robe_m": (0xbf, 0x00, 0x00), "robe_l": (0xff, 0x00, 0x00),
    "hair_d": (0x00, 0x7f, 0x00), "hair_m": (0x00, 0xff, 0x00),
    "skin_d": (0x00, 0x00, 0x7f), "skin_m": (0x00, 0x00, 0xbf), "skin_l": (0x00, 0x00, 0xff),
}
FIXED = {
    "outline": (0x12, 0x10, 0x0c), "boot_d": (0x2a, 0x1c, 0x0d),
    "boot": (0x4a, 0x33, 0x19), "belt": (0x6d, 0x4d, 0x28),
    "eye": (0x1a, 0x1a, 0x22), "white": (0xff, 0xff, 0xff),
}
ALLOWED = set(KEYS.values()) | set(FIXED.values())

fails = []
def check(cond, msg):
    if not cond:
        fails.append(msg)
    return cond

def run(cmd):
    p = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    return p.returncode, (p.stdout + p.stderr)

# ── 1. the generator runs ────────────────────────────────────────────────────
rc, out = run("aseprite -b --script-param out=villager-sheet.aseprite "
              "--script tools/make-villager-sheet.lua")
if not check(rc == 0, f"generator exited {rc}: {out.strip()[:400]}"):
    print("FAIL\n" + "\n".join(fails)); sys.exit(1)

rc, out = run(f"aseprite -b villager-sheet.aseprite --sheet villager-sheet.png "
              f"--data villager-sheet.json --format json-array --sheet-type rows "
              f"--sheet-columns {SHEET_COLS} --list-tags")
if not check(rc == 0, f"sheet export exited {rc}: {out.strip()[:400]}"):
    print("FAIL\n" + "\n".join(fails)); sys.exit(1)

# ── 2. atlas exists, parses, and describes the layout we asked for ───────────
if not check(os.path.exists("villager-atlas.js"), "villager-atlas.js not written"):
    print("FAIL\n" + "\n".join(fails)); sys.exit(1)
src = open("villager-atlas.js").read()
check("VILLAGER_ATLAS" in src, "atlas does not assign VILLAGER_ATLAS")
def num(k):
    m = re.search(k + r":\s*(\d+)", src)
    return int(m.group(1)) if m else None
for k, want in [("frame", FRAME), ("body", BODY), ("perDir", PER_DIR),
                ("sheetCols", SHEET_COLS)]:
    check(num(k) == want, f"atlas {k} is {num(k)}, expected {want}")
m = re.search(r"dirRow: \{([^}]*)\}", src)
check(m is not None, "atlas has no dirRow")
if m:
    rows = {a: int(b) for a, b in re.findall(r"(\w+): (\d+)", m.group(1))}
    check(set(rows) == set(DIRS), f"dirRow keys {sorted(rows)} != {sorted(DIRS)}")
m = re.search(r"anims: \{(.*?)\n  \}", src, re.S)
check(m is not None, "atlas has no anims")
anims = {}
if m:
    anims = {a: [int(x) for x in b.split(",")]
             for a, b in re.findall(r"(\w+): \[([^\]]*)\]", m.group(1))}
    check(set(anims) == {"idle", "walk"}, f"anims {sorted(anims)} != ['idle','walk']")
    check(anims.get("idle", [0, 0])[1] == 2, "idle must have 2 frames")
    check(anims.get("walk", [0, 0])[1] == 4, "walk must have 4 frames")

# ── 3. sheet geometry ────────────────────────────────────────────────────────
im = Image.open("villager-sheet.png").convert("RGBA")
total = len(DIRS) * PER_DIR
check(im.size == (SHEET_COLS * FRAME, ((total + SHEET_COLS - 1) // SHEET_COLS) * FRAME),
      f"sheet is {im.size}, expected {(SHEET_COLS*FRAME, FRAME)}")

# ── 4. every frame non-empty, correctly proportioned, foot-planted ───────────
soles, heights, widths = [], [], []
for d_i, d in enumerate(DIRS):
    for col in range(PER_DIR):
        gi = d_i * PER_DIR + col
        x, y = (gi % SHEET_COLS) * FRAME, (gi // SHEET_COLS) * FRAME
        fr = im.crop((x, y, x + FRAME, y + FRAME))
        bb = fr.getbbox()
        if not check(bb is not None, f"frame {d}/{col} is empty"):
            continue
        widths.append(bb[2] - bb[0]); heights.append(bb[3] - bb[1]); soles.append(bb[3])

if heights:
    check(min(heights) >= 46 and max(heights) <= 62,
          f"figure height {min(heights)}..{max(heights)} outside 46..62px")
    # The floor is 12, not 18. A body IS narrower seen from the side than
    # head-on, and the profile facings legitimately come out around 14px against
    # the front view's 20px — an 18px floor was written when the sheet was
    # front-facing only and it failed correct profile art. What the floor is
    # actually guarding against is a facing that collapsed to a sliver.
    check(min(widths) >= 12 and max(widths) <= 44,
          f"figure width {min(widths)}..{max(widths)} outside 12..44px")
    # ... and the front view must still be wider than the profile, or the side
    # branch is not actually narrowing the body.
    check(max(widths) > min(widths),
          "every facing is the same width — the profile branch is not narrowing "
          "the tunic, so the side views will read as front views")
    # Soles land on the declared foot row, +1px for the outline the silhouette
    # pass adds below them.
    #
    # The BOUND is asymmetric on purpose. The walk cycle swings the legs
    # vertically by up to WALK_SWING*S, so a planted foot in a walk frame
    # legitimately sits that far BELOW the rest row -- that is the step. An
    # earlier version of this check compared max(soles) against the rest row
    # and failed a correct sheet at 73 vs 70, i.e. it was rejecting the walk
    # cycle it had itself asked for. What actually must not happen is a foot
    # ABOVE the rest row (the villager floating), so that side stays tight.
    WALK_SWING = 0.055
    want_sole = 24 + FOOT_F * BODY + 1      # OY + FOOT_F*S, + outline
    lo, hi = want_sole - 1.5, want_sole + WALK_SWING * BODY + 1.5
    check(min(soles) >= lo,
          f"highest sole {min(soles)} is above the rest row {want_sole:.0f} "
          f"— villager floats")
    check(max(soles) <= hi,
          f"lowest sole {max(soles)} exceeds rest row + walk swing ({hi:.0f})")

# ── 5. palette: key colours only ─────────────────────────────────────────────
seen = {}
for (r, g, b, a) in im.getdata():
    if a == 0:
        continue
    seen[(r, g, b)] = seen.get((r, g, b), 0) + 1
stray = {c: n for c, n in seen.items() if c not in ALLOWED}
check(not stray,
      "non-key colours in sheet (recolouring matches exactly, so these would "
      f"survive as coloured specks): {sorted(stray.items(), key=lambda kv:-kv[1])[:6]}")
# and each key must actually be USED, or the recolour has nothing to hit
for name, c in KEYS.items():
    check(seen.get(c, 0) > 0, f"key colour {name} {c} never drawn")

# ── 6. the four facings must be genuinely different, and `up` faceless ──────
# A generator that adds directions to the atlas but keeps drawing the same body
# passes every check above: the frames are non-empty, the palette is clean and
# the feet are planted. Only comparing the facings to each other catches it.
EYE = (0x1a, 0x1a, 0x22)
sigs, eyecount = {}, {}
for d_i, d in enumerate(DIRS):
    gi = d_i * PER_DIR                      # idle frame 0 of this facing
    x, y = (gi % SHEET_COLS) * FRAME, (gi // SHEET_COLS) * FRAME
    fr = im.crop((x, y, x + FRAME, y + FRAME))
    sigs[d] = fr.tobytes()
    eyecount[d] = sum(1 for px_ in fr.getdata() if px_[3] and px_[:3] == EYE)

for a in range(len(DIRS)):
    for b_ in range(a + 1, len(DIRS)):
        da, db = DIRS[a], DIRS[b_]
        check(sigs[da] != sigs[db],
              f"facings '{da}' and '{db}' are pixel-identical — the generator is "
              f"drawing one body for several directions")

check(eyecount.get("up", 0) == 0,
      f"the 'up' facing has {eyecount.get('up', 0)} eye pixels — that is a face "
      f"drawn on the back of a head")
for d in ("down", "left", "right"):
    check(eyecount.get(d, 0) > 0, f"the '{d}' facing has no eye pixels")
check(eyecount.get("down", 0) > eyecount.get("left", 0),
      f"'down' should show two eyes and a profile one ('down'={eyecount.get('down')}, "
      f"'left'={eyecount.get('left')})")

if fails:
    print("FAIL (%d)" % len(fails))
    for f in fails:
        print("  - " + f)
    sys.exit(1)
print("PASS — %d frames, height %d..%d, width %d..%d, %d distinct colours, all keys used"
      % (total, min(heights), max(heights), min(widths), max(widths), len(seen)))
