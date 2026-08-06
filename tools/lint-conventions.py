#!/usr/bin/env python3
"""
lint-conventions.py — convention checker for Hyrule Quest.

Scans the repo for the things that quietly break this project:
constraint violations that only show up as a blank page over file://,
world objects that skipped the coordinate registry, malformed enemy
stat blocks, and story flags wired up on only one end.

Usage:
    python lint-conventions.py                 # scan repo containing this script's parent
    python lint-conventions.py path/to/repo
    python lint-conventions.py --quiet         # only print problems

Exit code is 1 if any ERROR was found, 0 otherwise — so it can gate a commit.

-------------------------------------------------------------------
CONFIG — adjust these to match the repo, then the rest just works.
-------------------------------------------------------------------
"""

# Function/method calls that count as "registering something in the coordinate
# registry". Hyrule Quest has NO such call anywhere in the codebase — there is
# no registerEntity()/registerTile()-style API. `world.js`'s "world coordinate
# registry" (worldMaps[] / worldGrid{}) only tracks which generated MAP sits at
# which (gx, gy) grid cell; it is never called per-entity. Enemy/chest/shrine
# positions are plain `{x, y}` written straight into generated tile arrays or
# enemyDefs objects during procedural generation. Left empty on purpose — see
# check_registration below, which will flag nearly everything as a result.
# This is a known, inherent false-positive source for this repo, not a config
# gap: there is no call to point this list at.
REGISTRY_CALLS = []

# Files that are ALLOWED to contain raw coordinate literals — the registry
# itself, map/level data, and anything explicitly authored as data. Hyrule
# Quest has no separate mapdata/levels/spawns files — world placement is
# computed inline inside the generation code itself, so those files are the
# real equivalent here.
COORD_LITERAL_ALLOWED = [
    "world",
    "mapgen",
    "enemies",
    "regions",
    "config",
    "map-helpers",
    "connectivity",
]

# Every enemy definition should carry these keys — the real DND_ENEMIES shape
# in enemies.js. Note: this project tracks no "ac" (armor class) or to-hit —
# combat is real-time/contact-based, not dice-roll based, so those tabletop
# fields have no equivalent here. "spd" (not "speed") is the real key name.
ENEMY_REQUIRED_FIELDS = ["name", "hp", "spd", "dmg", "xp", "color", "size", "cr"]

# Filename fragments that identify enemy definition files. Only enemies.js
# exists in this repo — no monster/creature/bestiary/statblock files.
ENEMY_FILE_HINTS = ["enemies"]

# Filename fragments for files that must stay seeded/reproducible. The real
# generation files are mapgen-terrain.js, mapgen-foliage.js, mapgen-caves.js,
# mapgen-village.js, mapgen-tower.js, mapgen-biomes.js, and world.js.
GENERATION_FILE_HINTS = ["mapgen", "world"]

# Directories to skip entirely.
SKIP_DIRS = {".git", "node_modules", ".claude", "tools", "saves", "backup"}

# -------------------------------------------------------------------

import os
import re
import sys

ERROR, WARN, INFO = "ERROR", "WARN", "INFO"

findings = []


def report(level, path, line_no, message, snippet=""):
    findings.append((level, path, line_no, message, snippet.strip()[:100]))


def js_files(root):
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fn in filenames:
            if fn.endswith((".js", ".html")):
                yield os.path.join(dirpath, fn)


def rel(root, path):
    return os.path.relpath(path, root).replace("\\", "/")


def strip_comments(line):
    """Crude but adequate: drop // comments so they don't trigger checks."""
    return re.sub(r"//.*$", "", line)


# ---------------- checks ----------------

def check_constraints(root, path, lines):
    """The file:// hard constraints. These are always errors."""
    name = rel(root, path)
    for i, raw in enumerate(lines, 1):
        line = strip_comments(raw)

        if re.search(r"^\s*import\s+[\w{*]", line) or re.search(r"^\s*export\s+(default\s+|const\s+|function\s+|class\s+|\{)", line):
            report(ERROR, name, i, "ES module syntax — blocked over file://", raw)

        if re.search(r"\bimport\s*\(", line):
            report(ERROR, name, i, "dynamic import() — blocked over file://", raw)

        if re.search(r'type\s*=\s*["\']module["\']', line):
            report(ERROR, name, i, 'script type="module" — blocked over file://', raw)

        if re.search(r"\bfetch\s*\(|new\s+XMLHttpRequest", line):
            report(ERROR, name, i, "network/file read — cannot read local files over file://", raw)

        if re.search(r"https?://", line) and not re.search(r"https?://(www\.)?w3\.org", line):
            report(ERROR, name, i, "external URL — game must run offline", raw)


def check_coordinates(root, path, lines):
    """Raw x/y literals in gameplay code instead of registry lookups."""
    name = rel(root, path)
    lowered = name.lower()
    if any(hint in lowered for hint in COORD_LITERAL_ALLOWED):
        return

    pattern = re.compile(r"\b[xy]\s*[:=]\s*-?\d+\b")
    for i, raw in enumerate(lines, 1):
        line = strip_comments(raw)
        matches = pattern.findall(line)
        # Two or more on one line is almost certainly a placed position.
        if len(matches) >= 2:
            report(WARN, name, i, "hardcoded coordinate pair — should come from the registry", raw)


def check_registration(root, path, lines):
    """Entities that look placed in the world but never register themselves."""
    name = rel(root, path)
    text = "".join(lines)
    if any(hint in name.lower() for hint in COORD_LITERAL_ALLOWED):
        return

    looks_placed = re.search(r"\bspawn\w*\s*\(|\bplace\w*\s*\(|new\s+(Entity|Enemy|Npc|NPC|Chest|Shrine|Trigger)\b", text)
    if looks_placed and not any(call in text for call in REGISTRY_CALLS):
        report(WARN, name, 0, "places world objects but never calls the coordinate registry")


def check_enemies(root, path, lines):
    """Enemy stat blocks missing required fields."""
    name = rel(root, path)
    if not any(hint in name.lower() for hint in ENEMY_FILE_HINTS):
        return

    text = "".join(lines)
    # Find object literals that mention a CR — a decent proxy for a stat block.
    for match in re.finditer(r"\{[^{}]*\bcr\b[^{}]*\}", text, re.IGNORECASE | re.DOTALL):
        block = match.group(0)
        line_no = text[: match.start()].count("\n") + 1
        missing = [f for f in ENEMY_REQUIRED_FIELDS
                   if not re.search(r"\b" + re.escape(f) + r"\b\s*:", block, re.IGNORECASE)]
        if missing:
            label = re.search(r"name\s*:\s*[\"']([^\"']+)", block)
            who = label.group(1) if label else "unnamed stat block"
            report(ERROR, name, line_no, f"{who}: missing field(s) {', '.join(missing)}")


def check_seeding(root, path, lines):
    """Bare Math.random() inside generation code breaks reproducible seeds."""
    name = rel(root, path)
    if not any(hint in name.lower() for hint in GENERATION_FILE_HINTS):
        return
    for i, raw in enumerate(lines, 1):
        line = strip_comments(raw)
        if "Math.random" in line:
            report(WARN, name, i, "Math.random() in generation code — same seed must give same map", raw)


def collect_flags(root):
    """Story flags: set on one end, read on the other. Mismatches are bugs."""
    set_flags, read_flags = {}, {}
    set_pat = re.compile(r"""(?:setFlag|flags\.set|setStoryFlag)\s*\(\s*["']([\w.]+)["']""")
    alt_set = re.compile(r"""flags\s*\[\s*["']([\w.]+)["']\s*\]\s*=""")
    read_pat = re.compile(r"""(?:getFlag|hasFlag|flags\.get|flags\.has|checkFlag)\s*\(\s*["']([\w.]+)["']""")
    alt_read = re.compile(r"""flags\s*\[\s*["']([\w.]+)["']\s*\]\s*(?!=[^=])""")

    for path in js_files(root):
        name = rel(root, path)
        try:
            with open(path, encoding="utf-8", errors="replace") as fh:
                for i, raw in enumerate(fh, 1):
                    line = strip_comments(raw)
                    for m in set_pat.finditer(line):
                        set_flags.setdefault(m.group(1), (name, i))
                    for m in alt_set.finditer(line):
                        set_flags.setdefault(m.group(1), (name, i))
                    for m in read_pat.finditer(line):
                        read_flags.setdefault(m.group(1), (name, i))
                    for m in alt_read.finditer(line):
                        read_flags.setdefault(m.group(1), (name, i))
        except OSError:
            continue

    for flag, (name, i) in read_flags.items():
        if flag not in set_flags:
            report(ERROR, name, i, f"story flag '{flag}' is checked but never set")
    for flag, (name, i) in set_flags.items():
        if flag not in read_flags:
            report(INFO, name, i, f"story flag '{flag}' is set but never checked (may be planned)")


def check_load_order(root):
    """Script tags in index.html are the dependency graph — make sure they exist."""
    index = os.path.join(root, "index.html")
    if not os.path.isfile(index):
        report(WARN, "index.html", 0, "not found at repo root — expected entry point")
        return
    with open(index, encoding="utf-8", errors="replace") as fh:
        html = fh.read()
    srcs = re.findall(r'<script[^>]+src\s*=\s*["\']([^"\']+)["\']', html)
    for src in srcs:
        if src.startswith(("http://", "https://", "//")):
            continue
        target = os.path.normpath(os.path.join(root, src))
        if not os.path.isfile(target):
            report(ERROR, "index.html", 0, f"script tag points at missing file: {src}")

    # Loose files in src/ that index.html never loads.
    src_dir = os.path.join(root, "src")
    if os.path.isdir(src_dir):
        loaded = {os.path.normpath(os.path.join(root, s)) for s in srcs}
        for dirpath, dirnames, filenames in os.walk(src_dir):
            dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
            for fn in filenames:
                if fn.endswith(".js"):
                    full = os.path.normpath(os.path.join(dirpath, fn))
                    if full not in loaded:
                        report(WARN, rel(root, full), 0, "not referenced by any script tag in index.html")


# ---------------- main ----------------

def main():
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    quiet = "--quiet" in sys.argv or "-q" in sys.argv

    if args:
        root = os.path.abspath(args[0])
    else:
        here = os.path.dirname(os.path.abspath(__file__))
        root = os.path.dirname(here) if os.path.basename(here) == "tools" else here

    if not os.path.isdir(root):
        print(f"Not a directory: {root}")
        return 2

    if not quiet:
        print(f"Scanning {root}\n")

    for path in js_files(root):
        try:
            with open(path, encoding="utf-8", errors="replace") as fh:
                lines = fh.readlines()
        except OSError:
            continue
        check_constraints(root, path, lines)
        if path.endswith(".js"):
            check_coordinates(root, path, lines)
            check_registration(root, path, lines)
            check_enemies(root, path, lines)
            check_seeding(root, path, lines)

    collect_flags(root)
    check_load_order(root)

    order = {ERROR: 0, WARN: 1, INFO: 2}
    findings.sort(key=lambda f: (order[f[0]], f[1], f[2]))

    counts = {ERROR: 0, WARN: 0, INFO: 0}
    for level, path, line_no, message, snippet in findings:
        counts[level] += 1
        where = f"{path}:{line_no}" if line_no else path
        print(f"[{level:5}] {where}: {message}")
        if snippet:
            print(f"          {snippet}")

    if not findings:
        print("Clean — no convention problems found.")
    else:
        print(f"\n{counts[ERROR]} error(s), {counts[WARN]} warning(s), {counts[INFO]} note(s).")

    return 1 if counts[ERROR] else 0


if __name__ == "__main__":
    sys.exit(main())
