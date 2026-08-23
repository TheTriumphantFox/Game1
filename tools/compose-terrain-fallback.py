"""Compose runtime terrain atlases when Aseprite is unavailable.

The Lua generator remains the authored source. This fallback reuses silhouettes
from completed region sheets, applies the target concept palette, and writes the
PNG, JSON, and plain-script atlas files consumed by the game.
"""

from __future__ import annotations

import argparse
import colorsys
import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parent.parent
GROUND_NAMES = [
    "ground_a", "ground_b", "ground_c", "ground_d",
    "ground_dark_a", "ground_dark_b",
    "pave_a", "pave_b", "pave_c", "pave_d",
    "plaza_a", "plaza_b", "plaza_c", "plaza_d",
    "dirt_a", "dirt_b", "water_a", "water_b", "deep_a", "deep_b",
    "lava_a", "lava_b",
]
PROP_NAMES = [
    "growth_big_a", "growth_big_b", "growth_big_c", "growth_big_d",
    "growth_big_e", "growth_mid_a", "growth_mid_b", "growth_mid_c",
    "growth_small_a", "growth_small_b", "growth_alt_a", "growth_alt_b",
    "shrub_a", "shrub_b", "shrub_c", "bloom_a", "bloom_b", "bloom_c",
    "boulder_a", "boulder_b", "landmark", "rockwall_a", "rockwall_b",
    "rockwall_c", "gate_pillar", "gate_arch", "debris_a", "debris_b",
]

PALETTES = {
    "mana": {
        "ground": ["163b45", "1d4b55", "275b64", "326b73", "43808a"],
        "ground_dark": ["102d37", "153a46", "1d4653", "275866", "356b77"],
        "foliage": ["173752", "214c64", "2e6070", "477b86", "6a959d"],
        "foliage2": ["3a2d68", "58408f", "7458bc", "9270df", "b89aff"],
        "pave": ["665e80", "7d7395", "958aa9", "aa9ec2", "bcb0d1"],
        "plaza": ["887e9e", "9c91b1", "afa2c8", "c0b4d5", "d1c6e2"],
        "water": ["17647c", "1d7690", "2788a1", "389bad", "58afbd"],
        "deep": ["0b3047", "104159", "17536c", "20667e", "2c7a90"],
        "rock": ["12344e", "17617a", "258aa0", "40bfd0", "81edf1"],
        "trim": ["514e6b", "696581", "837d99", "9c95b0", "b7aec9"],
        "bark": ["2b1f35", "463451", "624a69", "7b607d", "967b96"],
        "dirt": ["23454d", "31565d", "42696f", "587d82", "719297"],
        "pale": ["a9a8bd", "bbb9cc", "cbc9da", "dedbeb", "eeeafa"],
    },
    "shadow": {
        "ground": ["0d0b12", "15121b", "201b26", "2b252f", "393239"],
        "ground_dark": ["050407", "0a0810", "100d17", "171220", "21182c"],
        "foliage": ["0c0912", "171022", "261638", "3a2254", "59367a"],
        "foliage2": ["2a1744", "432366", "63378f", "8555b7", "ab82d8"],
        "pave": ["332c31", "463d41", "5a5052", "706666", "8d837e"],
        "plaza": ["565052", "6c6667", "807a7b", "969091", "aca7a7"],
        "water": ["12182c", "1a2340", "243052", "304064", "40547a"],
        "deep": ["020205", "05040a", "090713", "100b1d", "191128"],
        "rock": ["020204", "07070b", "0d0c12", "171420", "282332"],
        "trim": ["252127", "39343a", "50494e", "6a6265", "8a8385"],
        "bark": ["030205", "08060c", "100b16", "1a1124", "291a38"],
        "dirt": ["100d14", "1b171e", "272127", "342c31", "443a3e"],
        "pale": ["8e8997", "aaa4b3", "c2bccb", "d8d2df", "eee9f3"],
    },
}


def rgb(value: str) -> tuple[int, int, int]:
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))


def ramp_color(ramp: list[str], lightness: float) -> tuple[int, int, int]:
    pos = max(0.0, min(1.0, lightness)) * (len(ramp) - 1)
    lo = int(pos)
    hi = min(len(ramp) - 1, lo + 1)
    mix = pos - lo
    a, b = rgb(ramp[lo]), rgb(ramp[hi])
    return tuple(round(a[i] + (b[i] - a[i]) * mix) for i in range(3))


def recolor(image: Image.Image, palette: dict[str, list[str]], mode: str) -> Image.Image:
    out = Image.new("RGBA", image.size)
    source = image.convert("RGBA")
    pixels = []
    pixel_data = (
        source.get_flattened_data()
        if hasattr(source, "get_flattened_data")
        else source.getdata()
    )
    for r, g, b, a in pixel_data:
        if not a:
            pixels.append((0, 0, 0, 0))
            continue
        h, light, sat = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
        hue = h * 360
        level = max(0.0, min(1.0, light * 1.18))
        if mode == "tree":
            family = "foliage" if 55 <= hue <= 185 and sat > 0.12 else "bark"
        elif mode == "mana_crystal":
            family = "rock"
        elif mode == "mana_plant":
            family = "foliage2" if sat > 0.18 and light > 0.20 else "foliage"
        elif mode == "mana_bloom":
            family = "foliage2" if sat > 0.18 else "pale"
        elif mode == "shadow_stone":
            family = "rock"
            # The source spires are already dark. Lift their internal range so
            # the umbral silhouettes retain readable violet-black facets.
            level = max(0.18, min(1.0, 0.12 + light * 2.5))
        elif mode == "shadow_plant":
            family = "foliage2" if light > 0.20 or sat > 0.18 else "foliage"
        elif mode == "shadow_bloom":
            family = "pale" if sat < 0.20 and light > 0.38 else "foliage2"
        elif mode == "trim":
            family = "trim"
        else:
            family = mode
        nr, ng, nb = ramp_color(palette[family], level)
        pixels.append((nr, ng, nb, a))
    out.putdata(pixels)
    return out


def frame(sheet: Image.Image, index: int, width: int, height: int) -> Image.Image:
    x = (index % 4) * width
    y = (index // 4) * height
    return sheet.crop((x, y, x + width, y + height))


def ground_family(index: int) -> str:
    if index < 4:
        return "ground"
    if index < 6:
        return "ground_dark"
    if index < 10:
        return "pave"
    if index < 14:
        return "plaza"
    if index < 16:
        return "dirt"
    if index < 18:
        return "water"
    return "deep"


def prop_recipe(region: str, index: int) -> tuple[str, int, str]:
    if region == "mana":
        if index <= 9:
            return "forest", index, "tree"
        if index <= 11:
            return "lightning", index, "mana_crystal"
        if index <= 14:
            return "forest", index, "mana_plant"
        if index <= 17:
            return "forest", index, "mana_bloom"
        if index <= 19:
            return "earth", 15 + index - 18, "mana_crystal"
        if index == 20:
            return "forest", 0, "tree"
        if index <= 23:
            return "lightning", 10 + index - 21, "mana_crystal"
        if index <= 25:
            return "forest", index, "trim"
        if index == 26:
            return "lightning", 26, "mana_crystal"
        return "forest", 27, "mana_bloom"
    if index <= 2:
        return "lightning", index, "shadow_stone"
    if index <= 4:
        return "earth", index, "shadow_stone"
    if index <= 6:
        return "lightning", index, "shadow_stone"
    if index <= 11:
        return "earth", index, "shadow_stone"
    if index <= 14:
        return "lightning", index, "shadow_plant"
    if index <= 17:
        return "necrotic", index, "shadow_bloom"
    if index <= 23:
        return "earth", index, "shadow_stone"
    if index <= 25:
        return "earth", index, "trim"
    return "earth", index, "shadow_stone" if index == 26 else "shadow_bloom"


def build_ground(region: str, palette: dict[str, list[str]]) -> Path:
    source = Image.open(ROOT / "terrain-forest-ground.png").convert("RGBA")
    out = Image.new("RGBA", (192, 288))
    for index in range(22):
        tile = recolor(frame(source, index, 48, 48), palette, ground_family(index))
        out.alpha_composite(tile, ((index % 4) * 48, (index // 4) * 48))
    path = ROOT / f"terrain-{region}-ground.png"
    out.save(path)
    return path


def build_props(region: str, palette: dict[str, list[str]]) -> Path:
    sheets: dict[str, Image.Image] = {}
    out = Image.new("RGBA", (384, 1008))
    for index in range(28):
        source_region, source_index, mode = prop_recipe(region, index)
        if source_region not in sheets:
            sheets[source_region] = Image.open(
                ROOT / f"terrain-{source_region}-props.png"
            ).convert("RGBA")
        prop = recolor(frame(sheets[source_region], source_index, 96, 144), palette, mode)
        out.alpha_composite(prop, ((index % 4) * 96, (index // 4) * 144))
    path = ROOT / f"terrain-{region}-props.png"
    out.save(path)
    return path


def metadata(region: str, kind: str, names: list[str], width: int, height: int) -> dict:
    frames = []
    total = 24 if kind == "ground" else 28
    for index in range(total):
        box = {"x": (index % 4) * width, "y": (index // 4) * height,
               "w": width, "h": height}
        frames.append({
            "filename": f"terrain-{region}-{kind} {index}.aseprite",
            "frame": box, "rotated": False, "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": width, "h": height},
            "sourceSize": {"w": width, "h": height}, "duration": 100,
        })
    return {"frames": frames, "meta": {
        "app": "tools/compose-terrain-fallback.py", "version": "1",
        "image": f"terrain-{region}-{kind}.png", "format": "RGBA8888",
        "size": {"w": width * 4, "h": height * ((total + 3) // 4)}, "scale": "1",
    }}


def write_support_files(region: str) -> None:
    for kind, names, width, height in (
        ("ground", GROUND_NAMES, 48, 48), ("props", PROP_NAMES, 96, 144)
    ):
        data = metadata(region, kind, names, width, height)
        (ROOT / f"terrain-{region}-{kind}.json").write_text(
            json.dumps(data, separators=(",", ":")), encoding="utf-8"
        )

    ground_frames = "\n".join(f"    {name}: {i}," for i, name in enumerate(GROUND_NAMES))
    prop_frames = "\n".join(f"    {name}: {i}," for i, name in enumerate(PROP_NAMES))
    atlas = (
        "// GENERATED terrain atlas. See tools/make-terrain-sheet.lua.\n"
        "window.TERRAIN_ATLAS = window.TERRAIN_ATLAS || {};\n"
        f'window.TERRAIN_ATLAS["{region}"] = {{\n'
        f"  ground: {{ tile: 48, cols: 4, sheet: 'terrain-{region}-ground.png', frames: {{\n"
        f"{ground_frames}\n"
        "  } },\n"
        f"  props: {{ w: 96, h: 144, cols: 4, footX: 48, footY: 138, sheet: 'terrain-{region}-props.png', frames: {{\n"
        f"{prop_frames}\n"
        "  } },\n"
        "};\n"
    )
    (ROOT / f"terrain-{region}-atlas.js").write_text(atlas, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("region", choices=sorted(PALETTES))
    args = parser.parse_args()
    build_ground(args.region, PALETTES[args.region])
    build_props(args.region, PALETTES[args.region])
    write_support_files(args.region)
    print(f"wrote terrain-{args.region} runtime atlas")


if __name__ == "__main__":
    main()
