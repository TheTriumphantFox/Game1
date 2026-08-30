#!/usr/bin/env python3
"""Decode a sprite sheet PNG to a raw RGBA dump for tools/sprite-harness.js.

node has no PNG decoder and this project has no dependencies, so the harness
reads pixels from a flat file instead. Writes sheet.raw + sheet.json beside
this script. Run from the repo root:  python3 tools/dump-sheet.py [sheet.png]
"""
import json, os, sys
from PIL import Image

here = os.path.dirname(os.path.abspath(__file__))
src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(here, '..', 'villager-sheet.png')
im = Image.open(src).convert('RGBA')
open(os.path.join(here, 'sheet.raw'), 'wb').write(im.tobytes())
json.dump({'width': im.width, 'height': im.height},
          open(os.path.join(here, 'sheet.json'), 'w'))
print('dumped %s %dx%d' % (os.path.basename(src), im.width, im.height))
