-- Build the GROUNDED player sprite sheet for Hero of Stormdrift: the same
-- character as tools/make-hero-sheet.lua, re-proportioned and re-rimmed to sit
-- in the world the rest of the art builds.
--
-- THIS IS THE SHEET THE GAME SHIPS. It began as a second option beside
-- tools/make-hero-sheet.lua and was chosen; hero-sheet.png and hero-atlas.js are
-- now its output, copied over the tall sheet's. That other file is kept because
-- it is the only record of the tall design, not because anything loads it.
--
-- It still writes to -grounded names by default rather than straight over the
-- shipped files, so a regeneration can be looked at before it replaces anything.
-- Landing a new build is the four copies at the bottom of this header.
--
-- Three changes from the tall sheet, the first two answering "she does not look
-- like she lives here" and the third a depth bug that predates both:
--
--   1. HEIGHT. The tall sheet stands 60.5px: 1.26 tiles, 4.9 heads. Measured
--      against what is actually in the world, that is tall. The built
--      environment is modular at one tile -- village-sheet.png is 3x8 cells of
--      48 and a door is a single 48x48 cell -- so she is 1.26 doorways. The
--      villagers are 56px. Natural props are no anchor at all: forest canopies
--      run 2.0x2.6 tiles, boulders 1.85x1.4, bushes about 1x0.9, stumps 0.7x0.5.
--
--      SQUASH compresses the BODY only -- neck to sole -- and leaves the head at
--      its full 12.4px, because the head is what makes a face resolve at this
--      size and shrinking it is how the 46px sheet ended up a 3.0-head chibi.
--
--      The default is 0.86, which puts her at 56x28 of art: LEVEL WITH A
--      VILLAGER, which is the anchor that was chosen. villager-sheet.png
--      measures 20x56 on the same 48px body box, so hero and townsfolk now stand
--      the same height, both 1.17 tiles, and the protagonist is no longer the
--      tallest thing in a village by six pixels. That is 4.4 heads, still inside
--      the 4..5 band the tall sheet's own note calls readable.
--
--      TUNE AGAINST THE ALPHA BOUNDING BOX, NOT THE PRINTED FIGURE. The line
--      this script prints is the ANATOMICAL figure, hair-top to sole, which at
--      0.86 is 54.1px. The drawn sprite measures 56px, because tintedRim adds a
--      pixel above the hair and below the soles. Those two numbers are two
--      pixels apart and it is the bounding box that has to match the villagers,
--      since that is how the villagers' own 56px was measured. Picking 0.90 off
--      the printed 55.9 lands a 58px sprite.
--
--   2. RIM. The world has no ink outline. Near-black covers 0% of a ground tile,
--      4% of the village set and 8% of the forest props, against 24% of the tall
--      hero sheet -- nearly all of it one flat #0e0c08 keyline. tintedRim below
--      replaces it with the neighbouring pixel's own colour, darkened, which is
--      how the trees and rocks hold their edges.
--
--   3. DEPTH FACING NORTH. Everything she carries used to be painted on last in
--      every facing, which put the blade and the bow on top of her own back when
--      she faced away. drawFrame now separates what she is HOLDING from what her
--      LIMBS are doing, and facing up the held gear goes down before the cloak
--      and the body so she occludes it. The carried sword disappears behind her
--      entirely at that angle; the bow keeps the arc that clears her shoulder,
--      and a swing still reads because the blade sweeps out past her silhouette.
--
-- drawBow and drawFist were rewritten too -- the bow was a chevron rotated flat
-- across her chest head-on, the punch a constant-width rod from her sternum to a
-- disc. See the comments on those two functions.
--
-- Everything else -- palette, anatomy, frame layout, atlas contract -- is
-- unchanged from the tall sheet: same 128px frames, same 26 columns, same 208
-- frames, same anim table, and an atlas that differs by one line (swordLen 30
-- against 35, because the blade is a body-relative reach and follows the squash).
--
-- Regenerate (run from the repo root):
--   aseprite -b --script-param out=hero-grounded.aseprite ^
--            --script-param atlas=hero-atlas-grounded.js ^
--            --script tools/make-hero-sheet-grounded.lua
--   aseprite -b hero-grounded.aseprite --sheet hero-sheet-grounded.png ^
--            --data hero-sheet-grounded.json ^
--            --format json-array --sheet-type rows --sheet-columns 26 --list-tags
--
-- Then, once the -grounded output looks right, land it:
--   cp hero-sheet-grounded.png  hero-sheet.png
--   cp hero-sheet-grounded.json hero-sheet.json
--   cp hero-grounded.aseprite   hero-sheet.aseprite
--   cp hero-atlas-grounded.js   hero-atlas.js
--
-- squash= is a dial, not a constant. Four settings worth knowing:
-- (all heights are the drawn alpha bounding box, the number that matters)
--   0.72  49px, near the old 46px sheet the tall one replaced
--   0.80  53px, about one doorway
--   0.86  56px, THE DEFAULT: level with a villager
--   0.90  58px
--   1.00  62px, reproduces the tall sheet exactly
--
-- Original header follows.
--
-- Drawn from the painted character portrait (hero-portrait.png) rather than
-- from drawPlayer().
--
-- The portrait is the character's real design: a female elf knight in dark
-- weathered plate, a large verdigris tree-of-life shield on her off arm, a heavy
-- forest cloak, long swept-back ears, and the sword carried high.
--
-- 128x128 frames. Per direction: unarmed idle(2) + walk(4) + punch(4) + jump(4)
-- + swim(4) + climb(4), sword idle(2) + walk(4) + jump(4), and bow idle(2)
-- + walk(4) + jump(4) + fire(5) = 52 frames. Four directions make 208 frames,
-- tagged per animation. The extra states are deliberately authored here rather
-- than faked with canvas transforms: the shield, cloak, ears, bow, and sword all
-- need different silhouettes when the hero leaves the ground or enters water.
--
-- Step 1 also writes hero-atlas.js, the frame layout the game reads at runtime.
--
-- Regenerate (run from the repo root):
--   aseprite -b --script-param out=hero-sheet.aseprite --script tools/make-hero-sheet.lua
--   aseprite -b hero-sheet.aseprite --sheet hero-sheet.png --data hero-sheet.json ^
--            --format json-array --sheet-type rows --sheet-columns 26 --list-tags
--
-- Two steps because the sprite the script builds is not left "open" for the
-- CLI's own --sheet/--data flags to see when they are chained onto the same
-- invocation as --script; --list-tags is required or frameTags is omitted
-- from the JSON.
--
-- SHEET-COLUMNS IS 26, NOT 52. A direction's 52 frames wrap across two sheet
-- rows, so the whole sheet is 3328x1024 rather than 6656x512. Two reasons: a
-- texture over 4096 in any dimension is where mobile GPUs start refusing to
-- hardware-accelerate a drawImage source, and the game ships touch controls. The
-- atlas carries both numbers (perDir and sheetCols) and hero-sprite.js does the
-- wrap, so this is a layout choice the generator owns rather than a constant the
-- renderer has to be told about separately.

----------------------------------------------------------------------
-- geometry
----------------------------------------------------------------------
-- FRAME vs BODY BOX vs FIGURE. Three different things, easy to conflate:
--
--   * BODY BOX (S = 48) is the ground footprint. render.js maps it onto one
--     TILE_PX tile, so S:TILE_PX is 1:1 and the art is pixel-perfect on screen.
--     It is NOT the character's height and never was.
--   * FIGURE is how tall she actually stands: 1.26 * S, about 60px, rising well
--     ABOVE the body box. Everything above y=0 in fraction space is overhang.
--   * FRAME (128) is the canvas each pose is drawn into, sized to hold the
--     figure plus a raised blade plus a downward swing.
--
-- The previous sheet made the figure FIT the body box, which is why she was
-- 40x46px and read as a chibi with antenna ears: at ~3 heads tall there was no
-- room for a face, for shoulders, or for a leg to bend. Letting her overhang
-- the tile is the whole point of this revision. The renderer already allowed it
-- ("the surplus is deliberate overhang ... allowed to spill outside the tile"),
-- so nothing outside this file had to change to make room.
local W, H   = 128, 128
local DIRS   = { "down", "up", "left", "right" }
local N_IDLE, N_WALK, N_PUNCH, N_JUMP = 2, 4, 4, 4
local N_SWIM, N_CLIMB, N_BOW, N_SWING = 4, 4, 5, 5
-- unarmed idle+walk+punch+jump+swim+climb, then sword and bow sets
local PER_DIR = N_IDLE + N_WALK + N_PUNCH + N_JUMP + N_SWIM + N_CLIMB +
                N_IDLE + N_WALK + N_JUMP + N_IDLE + N_WALK + N_JUMP + N_BOW + N_SWING
-- Frames per row in the exported PNG. See the header note.
local SHEET_COLS = 26
local S       = 48.0
-- Body box centred in the frame: (128 - 48) / 2. The 40px of margin above it is
-- what the head, the pauldrons and the raised blade live in.
local OX, OY  = 40.0, 40.0

-- Where the boot SOLES sit, as a fraction down the body box. This is the hero's
-- foot row, and it is the number the renderer plants on the ground.
local FOOT_F = 0.96

-- How much of the tall sheet's BODY height to keep. 1.0 reproduces it exactly;
-- the default 0.86 lands her at villager height. Only the body scales -- see the
-- anatomy note below for why the head is deliberately left alone.
local SQUASH = tonumber(app.params["squash"] or "0.86")

local lib = dofile("tools/aseprite-lib.lua")

----------------------------------------------------------------------
-- anatomy
----------------------------------------------------------------------
-- The figure's vertical landmarks, as fractions of S measured DOWN from the
-- body box top. Negative is above the box, which is where the entire upper body
-- now lives.
--
-- Stated once, here, because the old file scattered the same landmarks as bare
-- literals through five draw functions -- the belt was 0.575 in drawTorso and
-- 0.60 in the sash polygon and 0.62 in the tasset seam, and nothing said which
-- was the real waist. Moving a landmark now moves every part that references it.
--
-- Proportion check: SKULL_TOP..CHIN is 0.258 * S = 12.4px of head against a
-- HAIR_TOP..SOLE figure of 1.26 * S = 60.5px, so she stands 4.9 heads tall. The
-- old sheet was 3.0. Four to five is the readable range for a sprite this size:
-- below four the head eats the silhouette, above five the face stops resolving.
local A_TALL = {
  HAIR_TOP  = -0.300,   -- top of the hair mass (the silhouette's true top)
  SKULL_TOP = -0.278,
  HAIRLINE  = -0.240,
  BROW      = -0.190,
  EYE       = -0.163,   -- eye ROW centre
  NOSE      = -0.112,
  MOUTH     = -0.078,
  CHIN      = -0.020,
  NECK      =  0.014,
  SHOULDER  =  0.046,   -- shoulder line / pauldron seat
  CHEST     =  0.140,   -- bust, breastplate curve
  RIBS      =  0.250,
  WAIST     =  0.330,
  BELT_T    =  0.358,
  BELT_B    =  0.412,
  HIP       =  0.430,
  TASSET_B  =  0.605,   -- bottom of the skirt plates
  THIGH     =  0.620,
  KNEE      =  0.760,
  SHIN      =  0.810,
  BOOT_T    =  0.855,
  SOLE      =  FOOT_F,
}

-- The squash, applied in two parts, because a uniform scale is the wrong tool:
-- it would shrink the head along with everything else and land back at the chibi
-- the tall sheet was drawn to escape.
--
--   * BODY (everything below the chin) compresses TOWARD THE SOLE, so the foot
--     row stays exactly where the renderer plants it and only the torso and legs
--     lose height.
--   * HEAD (the chin and everything above it) keeps every internal span -- skull,
--     brow, eye row, nose, mouth -- and is translated down as one block to sit on
--     the new neck. The chin-to-neck gap is preserved, so the head is not driven
--     into the shoulders.
--
-- At SQUASH 0.86: body 45.4px -> 39.1px, head still 12.4px, anatomical figure
-- 54.1px, which draws as a 56px sprite once the rim is on -- 1.17 tiles and
-- 4.4 heads, the villagers' height.
local HEAD_SPAN = A_TALL.CHIN - A_TALL.HAIR_TOP   -- hair mass through chin
local NECK_GAP  = A_TALL.NECK - A_TALL.CHIN       -- how far the chin clears the neck
local BODY_SPAN = FOOT_F - A_TALL.NECK

local NECK_NEW = FOOT_F - BODY_SPAN * SQUASH
local HEAD_DY  = (NECK_NEW - NECK_GAP) - A_TALL.CHIN

local A = {}
for name, f in pairs(A_TALL) do
  if f <= A_TALL.CHIN then
    A[name] = f + HEAD_DY                       -- head block: translate
  else
    A[name] = FOOT_F - (FOOT_F - f) * SQUASH    -- body: compress toward the sole
  end
end
A.SOLE = FOOT_F

print(string.format(
  "squash=%.2f  figure=%.1fpx (%.2f tiles)  head=%.1fpx  %.2f heads",
  SQUASH, (FOOT_F - A.HAIR_TOP) * S, FOOT_F - A.HAIR_TOP,
  (A.CHIN - A.SKULL_TOP) * S, (FOOT_F - A.HAIR_TOP) / (A.CHIN - A.SKULL_TOP)))

-- Half-widths, as fractions of S out from the centre line at 0.5.
local HW = {
  HEAD   = 0.098,   -- face, ear to ear
  SKULL  = 0.104,
  HAIR   = 0.132,   -- hair mass, wider than the skull it sits on
  NECK   = 0.042,
  SHLD   = 0.132,   -- core torso at the shoulder
  PAUL   = 0.212,   -- outer edge of a pauldron
  CHEST  = 0.122,
  WAIST  = 0.090,
  HIP    = 0.118,
  TASSET = 0.130,
}

----------------------------------------------------------------------
-- palette
----------------------------------------------------------------------
-- Measured off hero-portrait.png by median-cut clustering each region rather
-- than eyedropping single pixels, then pushed apart in value for sprite
-- legibility. The portrait is lit by warm green forest light, so a literal copy
-- of its clusters comes out olive and muddy; the hue relationships are kept and
-- the value separation is widened, because a 60px figure has to read against
-- snow, lava and shadow terrain alike.
--
-- Three corrections to the old palette, all of them things the portrait plainly
-- shows and the previous sheet got wrong:
--   * The plate is WEATHERED WARM GREY-BROWN, not bright blue-silver. Its
--     clusters run #19150a..#bdad88 -- there is no cool grey anywhere in it.
--   * The cloak is near-black forest green (#0d1408..#5c7139), several stops
--     darker than the old #3b5c31, which read as a bright leaf green.
--   * Her eyes are BLUE. The old sheet used #4a7a5e, a green.
local hex = lib.hex

-- weathered plate, dark to light. PLATE_6 is the etched filigree and the rim
-- light, and is deliberately near-white: it is the only thing on her that is,
-- so it is what the eye catches first.
local PLATE_0  = hex('#15130c')
local PLATE_1  = hex('#2b2719')
local PLATE_2  = hex('#453d29')
local PLATE_3  = hex('#645a41')
local PLATE_4  = hex('#8e846a')
local PLATE_5  = hex('#c2b79b')
local PLATE_6  = hex('#ece3d0')
local PLATE_RAMP = { PLATE_0, PLATE_1, PLATE_2, PLATE_3, PLATE_4, PLATE_5, PLATE_6 }

-- forest cloak and the sash off the belt
local CLOAK_0  = hex('#0d1408')
local CLOAK_1  = hex('#1a2711')
local CLOAK_2  = hex('#2c3d1a')
local CLOAK_3  = hex('#42552a')
local CLOAK_4  = hex('#5c7139')

-- sandy blonde, not the old canary gold
local HAIR_0   = hex('#4a3a1c')
local HAIR_1   = hex('#6f5a2e')
local HAIR_2   = hex('#9c8146')
local HAIR_3   = hex('#c6a866')
local HAIR_4   = hex('#ecd9a4')

local SKIN_0   = hex('#6e4724')
local SKIN_1   = hex('#a8784d')
local SKIN_2   = hex('#cd9a70')
local SKIN_3   = hex('#e8c096')
local EAR_T    = hex('#dda87e')   -- ears catch warm backlight in the portrait

-- shield: weathered sage field, silver tree, steel rim
local SH_0     = hex('#232418')
local SH_1     = hex('#3c4030')
local SH_2     = hex('#5c6349')
local SH_3     = hex('#828a6b')
local SILVER   = hex('#dcd6c2')

local LTHR_0   = hex('#2a1c0d')
local LTHR_1   = hex('#4a3319')
local LTHR_2   = hex('#6d4d28')

local BRONZE   = hex('#b08a45')
local BRONZE_D = hex('#71542a')
local EYE_L    = hex('#a8c6d2')   -- pale blue, per the portrait
local EYE_D    = hex('#4d7285')
local LIP      = hex('#a86a55')
local WHITE    = hex('#ffffff')
-- Interior structural cores (blade, bow stave, limb cores). Lifted off the old
-- near-black: at #0e0c08 they read as ink, and nothing else in the world is
-- inked. Dark enough to still separate a limb from the torso behind it.
local OUTLINE  = hex('#241f14')

----------------------------------------------------------------------
-- rasteriser (px/polyPx/ellipsePx/linePx/outlineSilhouette live in
-- tools/aseprite-lib.lua, shared with make-dragon-sheet.lua; only the
-- fraction-of-S wrappers below stay local, since they close over this
-- script's own W, H, OX, OY, S)
----------------------------------------------------------------------
local raster = lib.newRaster(W, H)
local px, polyPx, ellipsePx, linePx, outlineSilhouette =
  raster.px, raster.polyPx, raster.ellipsePx, raster.linePx, raster.outlineSilhouette

-- Environment-matched rim, in place of lib.outlineSilhouette's flat keyline.
--
-- Same shape of pass -- every transparent pixel touching the silhouette -- but
-- the colour comes from the art instead of a constant: take the solid neighbour
-- that pixel touches and darken it. A steel pauldron gets a steel rim, the cloak
-- a green one, hair a brown one, which is how the trees and rocks in the terrain
-- sheets hold their edges.
--
-- ONE neighbour, in a fixed order, rather than the average of all of them. The
-- average version blends a new colour at every corner where two materials meet:
-- it took the sheet from 36 colours to 140, against 28-31 for the terrain and
-- village sheets, and a rim that gradients between materials reads as
-- anti-aliasing rather than as pixel art. Sampling one neighbour adds at most
-- one rim colour per source colour and keeps the edge hard.
--
-- Reads the solid mask from a snapshot taken before anything is written, so the
-- rim can never sample a rim pixel and creep outward a second ring.
local RIM_MUL = 0.42
local RIM_N = { {-1, 0}, {1, 0}, {0, -1}, {0, 1} }
local function tintedRim(img, mul)
  local solid = {}
  for y = 0, H - 1 do
    solid[y] = {}
    for x = 0, W - 1 do
      solid[y][x] = app.pixelColor.rgbaA(img:getPixel(x, y)) > 0
    end
  end
  for y = 0, H - 1 do
    for x = 0, W - 1 do
      if not solid[y][x] then
        local src = nil
        for i = 1, #RIM_N do
          local nx, ny = x + RIM_N[i][1], y + RIM_N[i][2]
          if nx >= 0 and nx < W and ny >= 0 and ny < H and solid[ny][nx] then
            src = img:getPixel(nx, ny)
            break
          end
        end
        if src then
          img:drawPixel(x, y, app.pixelColor.rgba(
            math.floor(app.pixelColor.rgbaR(src) * mul),
            math.floor(app.pixelColor.rgbaG(src) * mul),
            math.floor(app.pixelColor.rgbaB(src) * mul), 255))
        end
      end
    end
  end
end

local function X(f) return OX + f * S end
local function Y(f) return OY + f * S end

local function rectF(img, fx, fy, fw, fh, c)
  local ix0 = math.floor(X(fx) + 0.5)
  local iy0 = math.floor(Y(fy) + 0.5)
  local ix1 = math.floor(X(fx) + fw * S + 0.5)
  local iy1 = math.floor(Y(fy) + fh * S + 0.5)
  if ix1 <= ix0 then ix1 = ix0 + 1 end
  if iy1 <= iy0 then iy1 = iy0 + 1 end
  for y = iy0, iy1 - 1 do
    for x = ix0, ix1 - 1 do px(img, x, y, c) end
  end
end

local function polyF(img, P, c)
  local Q = {}
  for i = 1, #P do Q[i] = { X(P[i][1]), Y(P[i][2]) } end
  polyPx(img, Q, c)
end

local function ellipseF(img, fcx, fcy, frx, fry, c, rot)
  ellipsePx(img, X(fcx), Y(fcy), frx * S, fry * S, c, rot)
end

-- lineF's width is a fraction of S, matching every other *F function here and
-- matching make-dragon-sheet.lua. LINE_W is one pixel expressed as that
-- fraction; S cancels exactly, so a LINE_W call is a true hairline at any S.
local LINE_W = 1.0 / S

local function lineF(img, fx0, fy0, fx1, fy1, wf, c)
  linePx(img, X(fx0), Y(fy0), X(fx1), Y(fy1), wf * S, c)
end

-- One body pixel, as a fraction of S.
--
-- The face is drawn in multiples of this rather than in free fractions. At a
-- 10px-wide face an eye is two pixels, and "two pixels" only survives rectF's
-- floor-and-round if both edges land on integers -- 0.048 of S is 2.3px, which
-- rounds to 2 or 3 depending on where it starts, and an eye that is 3px on one
-- side of the face and 2px on the other reads as a squint. X(k*PXF) is an
-- integer for every integer k, so anything built out of PXF is exact.
local PXF = 1.0 / 48.0

-- Mirror helper. Every part below is authored for the character's own right
-- side and reflected about the centre line for her left, so a pauldron cannot
-- end up a different shape on one shoulder than the other.
local function mx(f) return 1.0 - f end

----------------------------------------------------------------------
-- pieces
----------------------------------------------------------------------

-- Heavy forest cloak, hung from the shoulders and falling behind the legs.
--
-- It is drawn FIRST, before any of her, so it is pure backdrop: the figure is
-- read against it rather than through it. `sway` trails the walk cycle and
-- `bob` rides the whole body.
--
-- The hem stops at the knee rather than the ankle. A full-length cloak on a
-- 60px figure swallows both legs and the walk cycle stops reading as walking --
-- which is exactly what happened on the old sheet, where the legs were four
-- visible pixels under a cloak that reached the boots.
local function drawCloak(img, sway, bob)
  local b = bob
  local topL, topR = 0.5 - HW.SHLD - 0.01, 0.5 + HW.SHLD + 0.01
  local hemL, hemR = 0.5 - 0.215 + sway, 0.5 + 0.215 + sway
  local hem = A.KNEE

  -- Body of the cloak: a trapezoid widening to the hem, split down the middle
  -- so one half stays a stop darker and the fold reads.
  --
  -- CLOAK_1/CLOAK_2 rather than CLOAK_0/CLOAK_1. The darkest two stops of the
  -- portrait's near-black green are honest to the source but disappear against
  -- the game's own dark terrain -- shadow, necrotic and cave floors are all
  -- darker than #1a2711, and the cloak simply stopped existing on them. Lifting
  -- it one stop keeps it unmistakably a deep forest green while giving the
  -- silhouette an edge the outline pass can bite on.
  polyF(img, { {topL, A.SHOULDER+b}, {topR, A.SHOULDER+b},
               {hemR, hem+b}, {hemL, hem+b} }, CLOAK_1)
  polyF(img, { {topL, A.SHOULDER+b}, {0.5, A.SHOULDER+b},
               {0.5 + sway*0.6, hem+b}, {hemL, hem+b} }, CLOAK_2)

  -- Fold lines. Fanning from the shoulders to the hem, not parallel, so the
  -- cloth reads as hanging off a body instead of as a flat sheet.
  lineF(img, 0.5,        A.SHOULDER+0.03+b, 0.5+sway*0.6, hem-0.01+b, LINE_W, CLOAK_0)
  lineF(img, topL+0.045, A.SHOULDER+0.05+b, hemL+0.05,    hem-0.01+b, LINE_W, CLOAK_3)
  lineF(img, topR-0.045, A.SHOULDER+0.05+b, hemR-0.05,    hem-0.01+b, LINE_W, CLOAK_0)

  -- Lit top edge where the cloth crests the shoulders, per lib.LIGHT_DIR.
  lineF(img, topL+0.02, A.SHOULDER+0.005+b, topR-0.02, A.SHOULDER+0.005+b, LINE_W, CLOAK_4)

  -- Ragged hem: three notches, so the bottom edge is not a ruler line.
  polyF(img, { {hemL+0.06, hem-0.02+b}, {hemL+0.11, hem-0.02+b},
               {hemL+0.085, hem+0.03+b} }, CLOAK_1)
  polyF(img, { {hemR-0.11, hem-0.02+b}, {hemR-0.06, hem-0.02+b},
               {hemR-0.085, hem+0.025+b} }, CLOAK_1)
end

-- Armoured legs: thigh, knee cop, greave, boot. `swing` moves the feet through
-- the walk cycle -- vertically head-on, fore/aft in profile.
--
-- There are now four segments where the old sheet had two flat rects, which is
-- what 25px of leg buys over 11px: a knee that bends and a boot that is a boot
-- rather than a brown square.
local function drawLegs(img, facing, swing, bob)
  local isSide = (facing == 'left' or facing == 'right')
  local b = bob

  -- Per leg: x offset, y offset, plate ramp index, boot colour.
  -- Back leg first so the near leg overlaps it.
  -- Ramp indices 2 and 3, not 2 and 4. The greaves used to sit at PLATE_4 with
  -- PLATE_5/PLATE_6 knee cops, which made her shins the brightest thing below
  -- the neck -- the eye went straight to her boots. Legs are in shadow on a
  -- figure lit from above; the bright plate belongs on the pauldrons.
  local legs
  if isSide then
    legs = { { swing * 1.7, 0, 2, LTHR_0 }, { -swing * 1.7, 0, 3, LTHR_1 } }
  else
    legs = { { -0.082, -swing, 2, LTHR_0 }, { 0.082, swing, 3, LTHR_1 } }
  end

  for _, L in ipairs(legs) do
    local dx, dy, shade, boot = L[1], L[2], L[3], L[4]
    local cx = 0.5 + dx
    local hw = 0.055
    local plate  = PLATE_RAMP[shade]
    local plateL = PLATE_RAMP[math.min(7, shade + 2)]

    -- thigh -> knee: a taper, wider at the hip
    polyF(img, { {cx-hw-0.008, A.THIGH+dy+b}, {cx+hw+0.008, A.THIGH+dy+b},
                 {cx+hw-0.006, A.KNEE+dy+b},  {cx-hw+0.006, A.KNEE+dy+b} }, plate)
    -- knee cop: the disc that makes a leg look jointed
    ellipseF(img, cx, A.KNEE+dy+b, hw+0.004, 0.030, plateL)
    ellipseF(img, cx, A.KNEE-0.006+dy+b, hw-0.014, 0.018, PLATE_RAMP[math.min(7, shade + 2)])
    -- greave
    polyF(img, { {cx-hw+0.006, A.KNEE+0.012+dy+b}, {cx+hw-0.006, A.KNEE+0.012+dy+b},
                 {cx+hw-0.010, A.BOOT_T+dy+b},     {cx-hw+0.010, A.BOOT_T+dy+b} }, plate)
    lineF(img, cx-0.016, A.SHIN+dy+b, cx-0.018, A.BOOT_T-0.006+dy+b, LINE_W, plateL)
    -- boot: a toe box forward of the ankle, not a rectangle
    local toe = isSide and ((facing == 'left') and -0.030 or 0.030) or 0.0
    polyF(img, { {cx-hw, A.BOOT_T+dy+b}, {cx+hw, A.BOOT_T+dy+b},
                 {cx+hw+math.max(0,toe), FOOT_F+dy+b},
                 {cx-hw+math.min(0,toe), FOOT_F+dy+b} }, boot)
    rectF(img, cx-hw, A.BOOT_T+dy+b, hw*2, 0.014, LTHR_2)   -- cuff
    -- The sole, derived from FOOT_F so the declared foot row and the drawn one
    -- cannot drift apart.
    rectF(img, cx-hw+math.min(0,toe), FOOT_F-0.020+dy+b,
               hw*2+math.abs(toe), 0.020, hex('#160f06'))
  end
end

-- Torso: the portrait's female cuirass -- deep V neckline with a scalloped
-- silver border, etched filigree, layered pauldrons, a leather baldric across
-- the chest, belt, and the green sash hanging off it.
local function drawTorso(img, facing, bob)
  local isSide = (facing == 'left' or facing == 'right')
  local b = bob
  local shld  = isSide and (HW.SHLD * 0.72) or HW.SHLD
  local chest = isSide and (HW.CHEST * 0.74) or HW.CHEST
  local waist = isSide and (HW.WAIST * 0.80) or HW.WAIST
  local hip   = isSide and (HW.HIP * 0.80) or HW.HIP

  -- ── tassets / skirt plates (under the belt, over the thighs) ──
  local tw = isSide and (HW.TASSET * 0.76) or HW.TASSET
  polyF(img, { {0.5-hip, A.HIP+b}, {0.5+hip, A.HIP+b},
               {0.5+tw, A.TASSET_B+b}, {0.5-tw, A.TASSET_B+b} }, PLATE_2)
  polyF(img, { {0.5, A.HIP+b}, {0.5+hip, A.HIP+b},
               {0.5+tw, A.TASSET_B+b}, {0.5, A.TASSET_B+b} }, PLATE_1)
  -- three plates, seams between them
  lineF(img, 0.5-hip*0.42, A.HIP+0.012+b, 0.5-tw*0.46, A.TASSET_B-0.008+b, LINE_W, PLATE_0)
  lineF(img, 0.5+hip*0.42, A.HIP+0.012+b, 0.5+tw*0.46, A.TASSET_B-0.008+b, LINE_W, PLATE_0)
  lineF(img, 0.5-tw, A.TASSET_B-0.014+b, 0.5+tw, A.TASSET_B-0.014+b, LINE_W, PLATE_3)

  -- ── cuirass ──
  -- Shoulder -> chest -> nipped waist -> flared hip, as four points a side.
  polyF(img, { {0.5-shld, A.SHOULDER+b}, {0.5+shld, A.SHOULDER+b},
               {0.5+chest, A.CHEST+b},   {0.5+waist, A.WAIST+b},
               {0.5+hip*0.92, A.HIP+b},  {0.5-hip*0.92, A.HIP+b},
               {0.5-waist, A.WAIST+b},   {0.5-chest, A.CHEST+b} }, PLATE_3)
  -- her left side turns away from the light
  polyF(img, { {0.5, A.SHOULDER+b}, {0.5+shld, A.SHOULDER+b},
               {0.5+chest, A.CHEST+b}, {0.5+waist, A.WAIST+b},
               {0.5+hip*0.92, A.HIP+b}, {0.5, A.HIP+b} }, PLATE_2)

  -- breast curve: two domes, the near one catching the highlight
  ellipseF(img, 0.5-chest*0.44, A.CHEST+b, chest*0.46, 0.052, PLATE_4)
  ellipseF(img, 0.5+chest*0.44, A.CHEST+b, chest*0.46, 0.052, PLATE_3)
  ellipseF(img, 0.5-chest*0.52, A.CHEST-0.018+b, chest*0.24, 0.022, PLATE_5)

  -- ── deep V neckline with the portrait's pointed silver border ──
  local vw, vd = chest * 0.50, A.CHEST + 0.038
  polyF(img, { {0.5-vw, A.SHOULDER+0.014+b}, {0.5+vw, A.SHOULDER+0.014+b},
               {0.5, vd+b} }, SKIN_0)
  polyF(img, { {0.5-vw*0.72, A.SHOULDER+0.018+b}, {0.5+vw*0.72, A.SHOULDER+0.018+b},
               {0.5, vd-0.022+b} }, SKIN_1)
  lineF(img, 0.5-vw, A.SHOULDER+0.014+b, 0.5, vd+b, LINE_W, PLATE_6)
  lineF(img, 0.5+vw, A.SHOULDER+0.014+b, 0.5, vd+b, LINE_W, PLATE_5)

  -- ── gorget: the collar plate the V hangs from, with its pendant ──
  polyF(img, { {0.5-shld*0.56, A.NECK+b}, {0.5+shld*0.56, A.NECK+b},
               {0.5+shld*0.44, A.SHOULDER+0.020+b}, {0.5-shld*0.44, A.SHOULDER+0.020+b} }, PLATE_3)
  lineF(img, 0.5-shld*0.34, A.NECK+0.006+b, 0.5+shld*0.34, A.NECK+0.006+b, LINE_W, PLATE_5)
  polyF(img, { {0.5-0.020, A.SHOULDER+0.010+b}, {0.5+0.020, A.SHOULDER+0.010+b},
               {0.5, A.SHOULDER+0.052+b} }, PLATE_6)

  -- ── etched filigree down the flanks ──
  -- One scroll a side. Near-white on dark plate is the portrait's loudest
  -- signature and the cheapest way to say "not plain armour" in two pixels.
  lineF(img, 0.5-chest*0.86, A.CHEST+0.030+b, 0.5-waist*0.92, A.WAIST-0.016+b, LINE_W, PLATE_5)
  lineF(img, 0.5+chest*0.86, A.CHEST+0.030+b, 0.5+waist*0.92, A.WAIST-0.016+b, LINE_W, PLATE_4)
  lineF(img, 0.5-chest*0.30, A.RIBS+b,        0.5-chest*0.56, A.RIBS+0.036+b, LINE_W, PLATE_4)
  lineF(img, 0.5+chest*0.30, A.RIBS+b,        0.5+chest*0.56, A.RIBS+0.036+b, LINE_W, PLATE_2)

  -- ── leather baldric across the chest ──
  if not isSide then
    lineF(img, 0.5-shld*0.90, A.SHOULDER+0.052+b, 0.5+waist*0.80, A.WAIST-0.010+b, 0.030, LTHR_1)
    lineF(img, 0.5-shld*0.90, A.SHOULDER+0.052+b, 0.5+waist*0.80, A.WAIST-0.010+b, 0.010, LTHR_2)
    rectF(img, 0.5+waist*0.10, A.RIBS+0.014+b, 0.030, 0.026, BRONZE)
  end

  -- ── belt, buckle, and the green sash hanging from it ──
  rectF(img, 0.5-waist-0.012, A.BELT_T+b, (waist+0.012)*2, A.BELT_B-A.BELT_T, LTHR_1)
  rectF(img, 0.5-waist-0.012, A.BELT_T+b, (waist+0.012)*2, 0.010, LTHR_2)
  rectF(img, 0.5-0.026, A.BELT_T-0.006+b, 0.052, (A.BELT_B-A.BELT_T)+0.012, BRONZE)
  rectF(img, 0.5-0.012, A.BELT_T+0.010+b, 0.024, 0.024, BRONZE_D)
  -- sash: hangs from the belt on her right, past the tassets
  -- Half the width it was. At full width it spanned the tassets, so everything
  -- below the belt came out green and the skirt plates -- the piece that says
  -- "armour" rather than "dress" -- were never visible at all.
  polyF(img, { {0.5-0.104, A.BELT_B+b}, {0.5-0.050, A.BELT_B+b},
               {0.5-0.062, A.TASSET_B+0.060+b}, {0.5-0.116, A.TASSET_B+0.030+b} }, CLOAK_2)
  lineF(img, 0.5-0.086, A.BELT_B+0.020+b, 0.5-0.078, A.TASSET_B+0.020+b, LINE_W, CLOAK_3)

  -- ── pauldrons and arms ──
  -- Concentric shells lit toward lib.LIGHT_DIR: rim in shadow, crown of the
  -- plate catching the highlight, one etched line across the lip.
  assert(lib.LIGHT_DIR.y < 0, "PLATE_RAMP is ordered dark-to-light assuming an overhead/upper light")
  local function pauldron(cx, lit)
    local t = lit and 0 or -1
    ellipseF(img, cx, A.SHOULDER+0.026+b, 0.086, 0.062, PLATE_RAMP[2])
    ellipseF(img, cx, A.SHOULDER+0.014+b, 0.076, 0.050, PLATE_RAMP[4+t])
    ellipseF(img, cx, A.SHOULDER+0.002+b, 0.060, 0.034, PLATE_RAMP[5+t])
    ellipseF(img, cx, A.SHOULDER-0.008+b, 0.038, 0.018, PLATE_RAMP[6+t])
    -- etched scroll on the lip
    lineF(img, cx-0.056, A.SHOULDER+0.042+b, cx+0.056, A.SHOULDER+0.042+b, LINE_W, PLATE_6)
    lineF(img, cx-0.030, A.SHOULDER+0.020+b, cx+0.030, A.SHOULDER+0.026+b, LINE_W, PLATE_5)
  end

  -- upper arm + vambrace hanging off a pauldron
  local function arm(cx, shade)
    polyF(img, { {cx-0.042, A.SHOULDER+0.040+b}, {cx+0.042, A.SHOULDER+0.040+b},
                 {cx+0.038, A.RIBS+b}, {cx-0.038, A.RIBS+b} }, LTHR_1)
    polyF(img, { {cx-0.038, A.RIBS+b}, {cx+0.038, A.RIBS+b},
                 {cx+0.034, A.WAIST+0.050+b}, {cx-0.034, A.WAIST+0.050+b} }, PLATE_RAMP[shade])
    lineF(img, cx-0.030, A.RIBS+0.014+b, cx+0.030, A.RIBS+0.014+b, LINE_W, PLATE_RAMP[math.min(7,shade+2)])
    -- gauntlet
    ellipseF(img, cx, A.WAIST+0.062+b, 0.040, 0.030, PLATE_RAMP[math.min(7,shade+1)])
  end

  if isSide then
    local near = (facing == 'left') and (0.5 - 0.088) or (0.5 + 0.088)
    pauldron(near, true)
    arm(near, 4)
  else
    pauldron(0.5 - HW.PAUL + 0.086, true)
    pauldron(0.5 + HW.PAUL - 0.086, false)
    arm(0.5 - HW.PAUL + 0.070, 4)
    arm(0.5 + HW.PAUL - 0.070, 2)
  end
end

-- The signature piece: the big tree-of-life shield, carried on her off (left)
-- arm. In the portrait it is a heater -- rounded shoulders tapering to a point
-- -- with a heavy scrolled steel rim and a weathered sage field, not the flat
-- disc the old sheet drew.
-- The tree of life, hand-set at 9x13. This is the one thing on the sheet that
-- is a bitmap rather than a shape, and it has to be.
--
-- Three generated versions failed before this, all the same way: the emblem
-- read as a little humanoid. The cause is not the drawing technique -- a filled
-- canopy with holes punched in it turned into a face just as readily as 1px
-- boughs turned into arms. The cause is the BRANCH COUNT. One vertical stroke,
-- one pair of limbs off it and anything at all on top is a person, and the eye
-- settles on that long before it considers a tree.
--
-- What breaks it is three tiers -- nobody has six arms -- widening toward the
-- bottom, with the trunk forking at the top instead of ending in a crown pixel.
-- And once the design is that specific, generating it is worse than writing it
-- out: linePx puts a disc at every step, so two branches three rows apart merge
-- into a blob and the gaps between them become the eyes of the next face. At
-- 9x13 every pixel is a decision, so every pixel is written down.
local TREE_OF_LIFE = {
  "...#.#...",
  "....#....",
  ".#..#..#.",
  "..#.#.#..",
  "...###...",
  "....#....",
  "#...#...#",
  ".#..#..#.",
  "..#.#.#..",
  "...###...",
  "....#....",
  "...#.#...",
  "..#...#..",
}

-- Whether the shield is on the arm NEAR the camera, and so covers her body,
-- rather than the far arm, where it shows from behind her.
--
-- She carries it on her LEFT arm, which decides this per facing and is not a
-- free choice: facing the camera her left is screen-right; facing screen-left
-- (west) her left hand swings toward the camera, so the shield is near; facing
-- screen-right (east) her left hand swings away, so it is behind her. The first
-- pass drew it in front on BOTH profiles, which made her left-handed walking one
-- way and right-handed walking the other, with the sword and shield trading arms
-- mid-stride.
local function shieldInFront(facing) return facing ~= 'right' end

local function drawShield(img, facing, bob)
  if facing == 'up' then return end          -- reads as the shield's back
  local cx = 0.5 + 0.205
  if facing == 'left'  then cx = 0.5 - 0.170 end
  -- Facing east: peeking out from behind her back, which is to screen-left.
  if facing == 'right' then cx = 0.5 - 0.104 end
  -- Sized off the torso, not picked: the boss of the shield covers her from
  -- shoulder to hip, which is what a heater is for. The first attempt ran it
  -- from above the bust to below the tassets and 14px wide, which buried the
  -- entire cuirass -- the shield WAS the character.
  local top, bot = A.CHEST - 0.030 + bob, A.HIP + 0.105 + bob
  local hw  = (facing == 'down') and 0.122 or 0.116   -- slightly foreshortened in profile
  local sho = top + (bot - top) * 0.34                 -- widest point

  -- Silhouette: heater. Two shoulders, straight flanks, a point at the bottom.
  local function heater(inset, col)
    local w = hw - inset
    polyF(img, { {cx-w,        sho},
                 {cx-w*0.94,   top + inset*0.6},
                 {cx-w*0.52,   top + inset*0.3},
                 {cx,          top + inset*0.25},
                 {cx+w*0.52,   top + inset*0.3},
                 {cx+w*0.94,   top + inset*0.6},
                 {cx+w,        sho},
                 {cx+w*0.60,   bot - inset*1.4},
                 {cx,          bot - inset},
                 {cx-w*0.60,   bot - inset*1.4} }, col)
  end

  heater(0.000, PLATE_1)      -- rim, in shadow
  heater(0.010, PLATE_4)      -- rim, lit
  heater(0.022, SH_0)         -- rolled edge
  heater(0.030, SH_1)         -- field
  -- field gradient: her near side catches the light, the far side falls away
  polyF(img, { {cx-hw+0.034, sho-0.030}, {cx-0.006, top+0.036},
               {cx-0.006, bot-0.034}, {cx-hw*0.52, bot-0.050} }, SH_2)

  -- scrollwork on the rim: two studs a side, which is all that resolves
  for _, t in ipairs({ 0.24, 0.62 }) do
    local y = top + (bot - top) * t
    local w = (hw - 0.016) * (1.0 - math.max(0, (t - 0.55)) * 1.5)
    ellipseF(img, cx - w, y, 0.010, 0.010, PLATE_6)
    ellipseF(img, cx + w, y, 0.010, 0.010, PLATE_4)
  end

  -- ── tree of life ──
  -- Silver is the brightest value on the whole figure, so the emblem is drawn
  -- with a strict budget: a 1px trunk, four boughs, and five leaf pixels. The
  -- first attempt used a 1.8px trunk, six boughs and seven 1.7px leaf blobs,
  -- which on an 11px-wide field covered most of it -- the shield read as a
  -- white paddle and pulled every eye away from her face. A tree at this size
  -- is suggested, not drawn: what has to survive is "pale emblem, branching".
  -- The emblem is a hand-set BITMAP, not strokes. See TREE_OF_LIFE above.
  local tx, ty = X(cx), Y(top + (bot - top) * 0.46)
  local x0 = math.floor(tx - #TREE_OF_LIFE[1] / 2 + 0.5)
  local y0 = math.floor(ty - #TREE_OF_LIFE / 2 + 0.5)
  for r = 1, #TREE_OF_LIFE do
    local row = TREE_OF_LIFE[r]
    for c = 1, #row do
      if row:sub(c, c) == '#' then px(img, x0 + c - 1, y0 + r - 1, SILVER) end
    end
  end
end

----------------------------------------------------------------------
-- head
----------------------------------------------------------------------
-- Long swept-back ears, a braided crown over sandy blonde, blue eyes.
--
-- The old head was a 14px dome with the ears sticking out HORIZONTALLY, which
-- at that size read as antennae. Here the ears rake up and back at about 35
-- degrees off horizontal -- the portrait's angle -- so they sit against the hair
-- mass instead of projecting off the silhouette.

-- The braid crown that runs back from the temples in the portrait. Two strands
-- of alternating shade; at this size the alternation IS the braid.
local function drawBraid(img, x0, y0, x1, y1)
  local n = 4
  for i = 0, n do
    local t = i / n
    local bx, by = x0 + (x1-x0)*t, y0 + (y1-y0)*t
    ellipseF(img, bx, by, 0.019, 0.015, (i % 2 == 0) and HAIR_4 or HAIR_2)
  end
end

local function drawHead(img, facing, bob)
  local b = bob
  local cy = (A.SKULL_TOP + A.CHIN) / 2 + b     -- head centre
  local ry = (A.CHIN - A.SKULL_TOP) / 2

  -- ── neck ──
  rectF(img, 0.5 - HW.NECK, A.CHIN - 0.010 + b, HW.NECK*2, A.NECK - A.CHIN + 0.024, SKIN_1)
  rectF(img, 0.5 - HW.NECK, A.CHIN - 0.010 + b, HW.NECK*2, 0.020, SKIN_0)

  if facing == 'up' then
    -- ── back of the head ──
    -- The long fall of hair down her back, then the skull, then the braid seen
    -- from behind. No face, and the ear tips only just clear the hair.
    -- The fall NARROWS toward the small of her back. Drawn as a widening
    -- trapezoid it came out a bell the width of her shoulders, which at this
    -- size is a mushroom cap or a hood, not hair -- there was no neck and no
    -- shoulder line, so the whole back view was one pale dome.
    polyF(img, { {0.5-HW.SKULL, A.EYE+b}, {0.5+HW.SKULL, A.EYE+b},
                 {0.5+HW.HAIR, A.CHIN+0.030+b},
                 {0.5+HW.SKULL-0.020, A.CHEST+0.055+b},
                 {0.5-HW.SKULL+0.020, A.CHEST+0.055+b},
                 {0.5-HW.HAIR, A.CHIN+0.030+b} }, HAIR_1)
    polyF(img, { {0.5-HW.SKULL, A.EYE+b}, {0.5-0.010, A.EYE+b},
                 {0.5-0.024, A.CHEST+0.050+b},
                 {0.5-HW.SKULL+0.020, A.CHEST+0.055+b},
                 {0.5-HW.HAIR, A.CHIN+0.030+b} }, HAIR_2)
    -- ear tips, angled up and back, just proud of the hair
    polyF(img, { {0.5-HW.SKULL+0.010, A.BROW+0.010+b}, {0.5-HW.HAIR-0.030, A.HAIRLINE+0.026+b},
                 {0.5-HW.SKULL+0.014, A.EYE+0.030+b} }, EAR_T)
    polyF(img, { {0.5+HW.SKULL-0.010, A.BROW+0.010+b}, {0.5+HW.HAIR+0.030, A.HAIRLINE+0.026+b},
                 {0.5+HW.SKULL-0.014, A.EYE+0.030+b} }, EAR_T)
    -- skull
    ellipseF(img, 0.5, cy - 0.020, HW.HAIR, ry*0.96, HAIR_2)
    ellipseF(img, 0.5, cy - 0.044, HW.HAIR*0.80, ry*0.62, HAIR_3)
    ellipseF(img, 0.5 - 0.026, cy - 0.070, HW.HAIR*0.44, ry*0.28, HAIR_4)
    -- braid, arcing across the back of the crown
    drawBraid(img, 0.5-HW.SKULL-0.004, A.BROW-0.006+b, 0.5+HW.SKULL+0.004, A.BROW-0.006+b)
    -- strand partings down the fall
    lineF(img, 0.5-0.054, A.CHIN+b, 0.5-0.068, A.CHEST+0.030+b, LINE_W, HAIR_0)
    lineF(img, 0.5+0.058, A.CHIN+b, 0.5+0.070, A.CHEST+0.030+b, LINE_W, HAIR_0)
    lineF(img, 0.5+0.006, A.CHIN+0.020+b, 0.5+0.012, A.CHEST+0.040+b, LINE_W, HAIR_3)
    return
  end

  local side = (facing == 'left' or facing == 'right')
  -- Which way she looks, as a signed x direction. Only meaningful in profile.
  local d = (facing == 'right') and 1 or -1

  -- ── hair mass behind the head ──
  -- Front-on it falls symmetrically off both shoulders; in profile it is all
  -- swept to the trailing side, which is what makes a profile read as a profile
  -- before any facial feature does.
  if side then
    polyF(img, { {0.5-d*0.020, A.HAIRLINE+b}, {0.5-d*HW.HAIR-d*0.020, A.BROW+b},
                 {0.5-d*HW.HAIR-d*0.046, A.CHEST+0.030+b},
                 {0.5-d*0.030, A.CHEST+0.070+b}, {0.5+d*0.040, A.CHIN+b} }, HAIR_1)
    polyF(img, { {0.5-d*0.040, A.HAIRLINE+0.020+b}, {0.5-d*HW.HAIR-d*0.010, A.EYE+b},
                 {0.5-d*HW.HAIR-d*0.020, A.CHEST+0.010+b},
                 {0.5-d*0.050, A.CHEST+0.040+b} }, HAIR_2)
  else
    -- Two falls of hair, one either side of the face, tapering to a point at
    -- the collarbone rather than running straight down. The first attempt drew
    -- one full-width rectangle from brow to chest, which framed the face in a
    -- blonde block -- with the face at SKIN_1 and the hair at HAIR_2 (nearly the
    -- same value) the two merged into a single tan mass. Darker hair at the
    -- sides plus a taper is what separates them.
    for _, sx in ipairs({ -1, 1 }) do
      polyF(img, { {0.5 + sx*(HW.HEAD-0.010), A.BROW+b},
                   {0.5 + sx*HW.HAIR,         A.EYE+b},
                   {0.5 + sx*(HW.HAIR+0.008), A.CHIN+0.040+b},
                   {0.5 + sx*(HW.HEAD-0.020), A.NECK+0.050+b} }, HAIR_1)
    end
    -- the long lock the portrait sweeps over her right shoulder, past the others
    polyF(img, { {0.5+HW.HEAD-0.006, A.EYE+b}, {0.5+HW.HAIR+0.010, A.EYE+0.024+b},
                 {0.5+HW.HAIR+0.020, A.CHEST+0.060+b},
                 {0.5+HW.HEAD-0.010, A.CHEST+0.030+b} }, HAIR_2)
    lineF(img, 0.5+HW.HAIR-0.004, A.CHIN+b, 0.5+HW.HAIR+0.006, A.CHEST+0.030+b,
          LINE_W, HAIR_3)
  end

  -- ── ears: long, raked up and back ──
  -- The rake is about 35 degrees above horizontal, measured off the portrait.
  -- The first attempt ran them from the brow to above the skull, which is ~70
  -- degrees, and at 5px long that is indistinguishable from a horn: the tip
  -- cleared the top of the head, so the silhouette grew two spikes. Keeping the
  -- tip BELOW A.HAIRLINE is what makes them read as ears -- they have to sit
  -- against the hair mass, not stick out over it.
  local function ear(sx)
    -- sx is -1 for her right ear (screen left), +1 for her left.
    local rootX, rootY = 0.5 + sx * (HW.HEAD - 0.012), A.EYE - 0.004 + b
    local tipX,  tipY  = 0.5 + sx * (HW.HEAD + 0.070), A.HAIRLINE + 0.030 + b
    polyF(img, { {rootX, rootY - 0.024}, {tipX, tipY},
                 {rootX + sx*0.006, rootY + 0.032} }, EAR_T)
    -- inner fold, one shade down, stopping short of the tip
    lineF(img, rootX + sx*0.004, rootY + 0.002,
               rootX + sx*0.046, tipY + 0.020, LINE_W, SKIN_0)
  end
  if side then ear(d) else ear(-1); ear(1) end

  -- ── face ──
  -- Base is SKIN_2 with SKIN_1 as the shadow, not the other way round. The
  -- first attempt lit the face at SKIN_1 (#a8784d), which sits within one value
  -- step of HAIR_2 (#9c8146) -- against the hair it vanished. The face has to be
  -- the lightest large area on the figure or the eye has nowhere to land.
  local fcx = 0.5 + (side and d * 0.016 or 0)
  ellipseF(img, fcx, cy, HW.HEAD, ry, SKIN_1)
  ellipseF(img, fcx - 0.006, cy - 0.006, HW.HEAD - 0.010, ry - 0.012, SKIN_2)
  -- jaw taper: narrow the chin so the head is not an egg
  polyF(img, { {fcx-HW.HEAD, A.NOSE+b}, {fcx+HW.HEAD, A.NOSE+b},
               {fcx+HW.HEAD*0.46, A.CHIN+b}, {fcx-HW.HEAD*0.46, A.CHIN+b} }, SKIN_2)
  ellipseF(img, fcx - HW.HEAD*0.34, A.BROW + 0.020 + b, HW.HEAD*0.40, 0.024, SKIN_3)  -- cheek light

  if side then
    -- nose and lips break the profile edge
    polyF(img, { {fcx + d*(HW.HEAD-0.014), A.BROW+0.026+b},
                 {fcx + d*(HW.HEAD+0.026), A.NOSE+b},
                 {fcx + d*(HW.HEAD-0.010), A.NOSE+0.012+b} }, SKIN_2)
    -- Inside the face edge. Run out to HW.HEAD + 0.006 it protruded past the
    -- silhouette, and the outline pass then wrapped it -- giving her a beak.
    lineF(img, fcx + d*(HW.HEAD-0.014), A.MOUTH+b,
               fcx + d*(HW.HEAD-0.048), A.MOUTH+b, LINE_W, LIP)
    -- one eye, set toward the face's leading edge
    rectF(img, fcx + d*0.030 - 0.021, A.EYE + b, 0.042, 0.026, EYE_D)
    rectF(img, fcx + d*0.034 - 0.010, A.EYE + 0.004 + b, 0.020, 0.016, EYE_L)
    rectF(img, fcx + d*0.030 - 0.023, A.EYE - 0.020 + b, 0.046, 0.012, HAIR_0)   -- brow
  else
    -- ── eyes ──
    -- A 2x2 eye: a dark lash pixel row over a blue iris row, with a dark brow
    -- one pixel above and a pixel of skin between brow and lash. That is the
    -- entire budget on a 10px-wide face, and everything here is in whole
    -- PXF units so the two eyes are pixel-identical mirror images.
    --
    -- The first attempt used free fractions (0.048 wide, 0.028 tall) which
    -- rasterised to a 2.3 x 1.3px smear -- the iris inside it came out under a
    -- pixel, so both eyes read as solid blue bars, like eyeliner.
    for _, sx in ipairs({ -1, 1 }) do
      -- x0 of a 2px eye, 61 and 65 in frame pixels, symmetric about 64
      local ex = 0.5 + ((sx < 0) and (-3 * PXF) or (1 * PXF))
      rectF(img, ex, A.EYE - 1*PXF + b, 2*PXF, 1*PXF, hex('#4a3626'))  -- lash
      rectF(img, ex, A.EYE + b,         2*PXF, 1*PXF, EYE_D)
      rectF(img, ex + ((sx < 0) and 0 or 1*PXF), A.EYE + b, 1*PXF, 1*PXF, EYE_L)
      rectF(img, ex - ((sx < 0) and 1*PXF or 0), A.EYE - 3*PXF + b, 3*PXF, 1*PXF, HAIR_0)
    end
    -- nose: a shadow, not a shape
    rectF(img, 0.5 - 1*PXF, A.NOSE + b, 1*PXF, 1*PXF, SKIN_0)
    -- mouth
    rectF(img, 0.5 - 2*PXF, A.MOUTH + b, 3*PXF, 1*PXF, LIP)
  end

  -- ── fringe and braid over the hairline ──
  if side then
    polyF(img, { {fcx - d*HW.HEAD - d*0.010, A.HAIRLINE - 0.016 + b},
                 {fcx + d*(HW.HEAD+0.010), A.HAIRLINE + 0.004 + b},
                 {fcx + d*(HW.HEAD-0.006), A.BROW - 0.004 + b},
                 {fcx + d*0.010, A.HAIRLINE + 0.030 + b},
                 {fcx - d*HW.HEAD - d*0.014, A.BROW + 0.020 + b} }, HAIR_2)
    ellipseF(img, fcx - d*0.010, A.SKULL_TOP + 0.026 + b, HW.SKULL, 0.044, HAIR_2)
    ellipseF(img, fcx - d*0.022, A.SKULL_TOP + 0.018 + b, HW.SKULL*0.64, 0.026, HAIR_3)
    drawBraid(img, fcx + d*(HW.HEAD-0.010), A.HAIRLINE + 0.010 + b,
                   fcx - d*(HW.HEAD+0.026), A.BROW + 0.026 + b)
  else
    -- Skull cap of hair, sitting ON the hairline rather than over the brow.
    --
    -- The fringe used to reach A.BROW + 0.026, one pixel above the eyes, which
    -- left literally no forehead: hair, then eyes. A face needs the brow ridge
    -- visible or it reads as a wig with holes cut in it. The cap now stops at
    -- A.HAIRLINE and only the swept part of the fringe dips past it, on her
    -- right side alone, as the portrait's off-centre parting does.
    ellipseF(img, 0.5, A.SKULL_TOP + 0.028 + b, HW.SKULL + 0.010, 0.046, HAIR_2)
    ellipseF(img, 0.5 - 0.018, A.SKULL_TOP + 0.018 + b, HW.SKULL*0.62, 0.026, HAIR_3)
    rectF(img, 0.5 - 2*PXF, A.SKULL_TOP + 0.004 + b, 3*PXF, 1*PXF, HAIR_4)
    -- fringe: dips to the brow on her right, tucked back on her left
    polyF(img, { {0.5-HW.SKULL-0.006, A.HAIRLINE-0.020+b},
                 {0.5+HW.SKULL+0.006, A.HAIRLINE-0.020+b},
                 {0.5+HW.SKULL+0.002, A.HAIRLINE+0.012+b},
                 {0.5+0.016,          A.HAIRLINE-0.004+b},
                 {0.5-0.030,          A.HAIRLINE+0.018+b},
                 {0.5-HW.SKULL-0.002, A.BROW+0.004+b} }, HAIR_2)
    lineF(img, 0.5-0.046, A.HAIRLINE-0.010+b, 0.5-0.070, A.BROW+0.002+b, LINE_W, HAIR_1)
    lineF(img, 0.5+0.048, A.HAIRLINE-0.012+b, 0.5+0.068, A.HAIRLINE+0.008+b, LINE_W, HAIR_3)
    -- braid crown, temple to temple across the top of the fringe
    drawBraid(img, 0.5-HW.SKULL-0.004, A.HAIRLINE-0.006+b,
                   0.5+HW.SKULL+0.004, A.HAIRLINE-0.010+b)
  end
end

----------------------------------------------------------------------
-- sword
----------------------------------------------------------------------
-- The swing PIVOT, as a position in the BODY box rather than the frame, so it
-- follows the body box when the frame changes size. SW_HILT and SW_LEN are
-- LENGTHS in body pixels and stay raw numbers: the body is still 48px at any
-- frame size, so a distance in pixels is still the distance it was.
--
-- SW_LEN grew from 30 to 35 with the figure. It is set from the anatomy rather
-- than picked: a sword she can actually swing is about as long as her arm plus
-- her torso, and A.WAIST - A.CHIN is that reach. The tip now clears her hair by
-- a couple of pixels in the idle carry, which the 46px figure had no room for.
local SW_CX, SW_CY    = X(0.5), Y(A.CHEST)
-- Both are body-relative reaches, so they follow the squash. Leaving a 35px
-- blade on a 51px figure would read as a greatsword she cannot lift.
local SW_HILT, SW_LEN = 11.0 * SQUASH, 35.0 * SQUASH
local BASE_ANGLE = { down = math.pi/2, up = -math.pi/2, left = math.pi, right = 0.0 }
-- Carried high, as in the portrait. Pivoted at the sword hand (opposite the
-- shield) and angled near-vertical so the blade rises beside the head instead
-- of cutting across her face.
local IDLE_ANGLE = { down = -1.75, up = -1.75, left = -1.35, right = -1.80 }
-- Her RIGHT hand, which is screen-left when she faces us and screen-right when
-- she faces away. In profile the sword arm is the far arm, so the hilt sits just
-- behind the centre line rather than out at the shoulder.
local IDLE_PIVOT = {
  down  = { X(0.358), Y(A.WAIST + 0.052) },
  up    = { X(0.642), Y(A.WAIST + 0.052) },
  left  = { X(0.548), Y(A.WAIST + 0.040) },
  right = { X(0.452), Y(A.WAIST + 0.040) },
}

local function drawBlade(img, a, bob, trail, cx, cy0)
  local cy = cy0 + bob * S
  local bx, by = cx + math.cos(a)*SW_HILT, cy + math.sin(a)*SW_HILT
  local tx, ty = cx + math.cos(a)*SW_LEN,  cy + math.sin(a)*SW_LEN
  local mx2, my = cx + math.cos(a)*(SW_LEN-6), cy + math.sin(a)*(SW_LEN-6)
  local gx, gy = cx + math.cos(a)*3.0, cy + math.sin(a)*3.0
  local nx, ny = -math.sin(a), math.cos(a)

  if trail then
    for k = 2, 1, -1 do
      local ta = a - 0.26*k
      linePx(img, cx+math.cos(ta)*(SW_HILT+3), cy+math.sin(ta)*(SW_HILT+3),
                  cx+math.cos(ta)*(SW_LEN-2),  cy+math.sin(ta)*(SW_LEN-2),
                  (k==2) and 1.0 or 2.0, (k==2) and PLATE_2 or PLATE_5)
    end
  end

  linePx(img, bx, by, tx, ty, 5.6, OUTLINE)
  linePx(img, bx+nx*6.0, by+ny*6.0, bx-nx*6.0, by-ny*6.0, 4.8, OUTLINE)
  linePx(img, gx, gy, bx, by, 4.4, OUTLINE)

  -- grip, pommel, and the portrait's ornate swept crossguard
  linePx(img, gx, gy, bx, by, 2.8, LTHR_0)
  linePx(img, gx, gy, bx, by, 1.2, LTHR_2)
  ellipsePx(img, gx, gy, 2.4, 2.4, BRONZE)
  ellipsePx(img, gx, gy, 1.1, 1.1, BRONZE_D)
  linePx(img, bx+nx*5.0, by+ny*5.0, bx-nx*5.0, by-ny*5.0, 3.0, PLATE_5)
  linePx(img, bx+nx*5.0, by+ny*5.0, bx-nx*5.0, by-ny*5.0, 1.0, PLATE_2)
  ellipsePx(img, bx+nx*5.0, by+ny*5.0, 1.5, 1.5, BRONZE)
  ellipsePx(img, bx-nx*5.0, by-ny*5.0, 1.5, 1.5, BRONZE)

  -- blade: body, tapered point, fuller, lit edge
  linePx(img, bx, by, mx2, my, 3.8, PLATE_4)
  linePx(img, mx2, my, tx, ty, 2.0, PLATE_4)
  linePx(img, bx, by, mx2, my, 1.2, PLATE_2)
  linePx(img, bx-nx*1.4, by-ny*1.4, mx2-nx*1.4, my-ny*1.4, 1.0, PLATE_6)
end

----------------------------------------------------------------------
-- action poses
--
-- punch: the pre-weapon jab. player.hasSword is false until prologue Beat 5,
-- and render.js is explicit that no blade may be drawn before the player owns
-- one -- so the unarmed poses carry no sword at all.
----------------------------------------------------------------------
local DIR_VEC = { down = {0,1}, up = {0,-1}, left = {-1,0}, right = {1,0} }

-- Shoulder anchor every action pose reaches from. Was SW_CX/SW_CY, the swing
-- pivot, which is the body's centre of rotation and sits lower than the actual
-- shoulder -- fine when the torso was 11px tall and everything overlapped
-- anyway, wrong now that there is a distinguishable shoulder to hang an arm on.
local AR_CX, AR_CY = X(0.5), Y(A.SHOULDER + 0.070)

-- A jab, rebuilt. The old one was a constant-width line from X(0.5) to a disc:
-- no shoulder, no joint, no taper, and a 0.58*S reach that put the fist past
-- her knees facing down and past her own arm's length in profile. It read as a
-- mallet on a broom handle, which is what it was.
--
-- Three things make a limb read as a limb at this size: it hangs off a shoulder
-- rather than the sternum, it has an elbow that straightens as the punch lands,
-- and it tapers -- plate upper arm into a narrower leather vambrace.
local function drawFist(img, facing, phase, bob)
  local d = DIR_VEC[facing]
  local side = { -d[2], d[1] }
  local profile = (facing == 'left' or facing == 'right')
  local t = math.sin(phase * math.pi)        -- 0 at both ends, 1 fully extended
  local cy0 = AR_CY + bob * S

  -- The free hand throws it. drawShield seats the heater screen-right facing
  -- down, so her shield hand is her left and the jab is her RIGHT: screen-left
  -- facing the camera, screen-right facing away. `side` already flips between
  -- those two facings, so the same sign gives the same physical arm.
  local sSign = 1

  local shx, shy
  if profile then
    shx = AR_CX + d[1] * S * 0.045
    shy = cy0   - S * 0.012
  else
    shx = AR_CX + side[1] * sSign * HW.SHLD * S * 0.88
    shy = cy0
  end

  -- Head-on the punch travels along the camera axis. In this projection that
  -- axis is screen-DOWN, so a jab at the viewer drops the fist toward her belt
  -- and swells it, and a jab away from the viewer disappears behind her --
  -- which is why the two head-on facings get different reaches rather than one
  -- symmetric number. At a single shared 0.13 all four frames were identical
  -- and the pose did not read as a punch in either direction.
  local headOn = (facing == 'down') and 0.30 or 0.14
  local reach = t * S * (profile and 0.40 or headOn)
  -- and it crosses slightly toward her centre line, because a straight punch
  -- comes off the shoulder and finishes in front of the sternum.
  local cross = profile and 0 or (S * 0.045 * t)
  local fx = shx + d[1] * reach - side[1] * sSign * cross
  local fy = shy + d[2] * reach - side[2] * sSign * cross

  -- Elbow: perpendicular to the punch, straightening as it lands. In profile it
  -- always drops, because an elbow that rises is a chicken wing.
  local ux, uy
  if profile then ux, uy = 0, 1 else ux, uy = side[1] * sSign, side[2] * sSign end
  -- A floor under the bend, so the arm still has a joint in it at full
  -- extension. Perfectly straight is the pose that reads as a broom handle.
  local bend = (1 - t) * S * 0.085 + S * 0.022
  local ex = shx + d[1] * reach * 0.52 + ux * bend
  local ey = shy + d[2] * reach * 0.52 + uy * bend

  -- Dark pass first: drawFrame calls this AFTER tintedRim, so the arm carries
  -- its own silhouette or it has none.
  linePx(img, shx, shy, ex, ey, S * 0.108, OUTLINE)
  linePx(img, ex, ey, fx, fy, S * 0.086, OUTLINE)
  linePx(img, shx, shy, ex, ey, S * 0.072, PLATE_2)
  linePx(img, ex, ey, fx, fy, S * 0.048, LTHR_1)
  linePx(img, shx, shy, shx + (ex - shx) * 0.7, shy + (ey - shy) * 0.7, S * 0.032, PLATE_4)

  -- Pauldron over the joint, so the arm hangs off armour instead of sprouting
  -- out of the cuirass.
  ellipsePx(img, shx, shy, S * 0.064, S * 0.056, OUTLINE)
  ellipsePx(img, shx, shy, S * 0.048, S * 0.042, PLATE_3)
  ellipsePx(img, shx - S * 0.012, shy - S * 0.014, S * 0.028, S * 0.022, PLATE_5)

  -- Gauntleted fist: wider than it is tall, with a knuckle line across it. A
  -- circle with a highlight is a ball bearing.
  -- Head-on the fist is the part coming at the camera, so it grows through the
  -- punch. That, not travel, is what sells a jab you are looking down. Facing
  -- away it is going the other way and stays small.
  local r = profile and (S * 0.050)
        or ((facing == 'down') and (S * (0.050 + 0.026 * t)) or (S * 0.046))
  ellipsePx(img, fx, fy, r * 1.34, r * 1.16, OUTLINE)
  ellipsePx(img, fx, fy, r * 0.98, r * 0.82, PLATE_3)
  ellipsePx(img, fx - S * 0.008, fy - S * 0.012, r * 0.56, r * 0.42, PLATE_5)
  linePx(img, fx + ux * r * 0.72 + d[1] * r * 0.30, fy + uy * r * 0.72 + d[2] * r * 0.30,
              fx - ux * r * 0.72 + d[1] * r * 0.30, fy - uy * r * 0.72 + d[2] * r * 0.30,
              S * 0.016, PLATE_1)
end

-- Mid-air pose. The body keeps its normal proportions so the renderer's real
-- player.z can lift it cleanly; only the legs and arms change silhouette here.
local function drawJumpPose(img, facing, phase, bob)
  local d = DIR_VEC[facing]
  local side = { -d[2], d[1] }
  local tuck = math.sin(phase * math.pi)
  local cy0 = AR_CY + bob * S
  local lift = S * (0.04 + tuck * 0.09)

  -- Arms open for balance, with the leading hand slightly higher.
  for sign = -1, 1, 2 do
    local spread = S * (0.19 + tuck * 0.05)
    local handX = AR_CX + side[1] * sign * spread + d[1] * S * 0.06
    local handY = cy0 + side[2] * sign * spread + d[2] * S * 0.06 - lift
    linePx(img, AR_CX + side[1] * sign * 5, cy0 + side[2] * sign * 5,
                handX, handY, S * 0.095, OUTLINE)
    linePx(img, AR_CX + side[1] * sign * 5, cy0 + side[2] * sign * 5,
                handX, handY, S * 0.055, LTHR_1)
    ellipsePx(img, handX, handY, S * 0.062, S * 0.062, PLATE_3)
  end

  -- Tucked knees and boots, alternating slightly so the loop has a clear rhythm.
  for sign = -1, 1, 2 do
    local kneeX = AR_CX + side[1] * sign * S * 0.10 + d[1] * S * 0.05
    local kneeY = Y(A.KNEE) + side[2] * sign * S * 0.10 - lift
    local bootX = kneeX + d[1] * S * 0.09
    local bootY = kneeY + d[2] * S * 0.09
    linePx(img, kneeX, kneeY, bootX, bootY, S * 0.115, OUTLINE)
    linePx(img, kneeX, kneeY, bootX, bootY, S * 0.070, PLATE_2)
    ellipsePx(img, bootX, bootY, S * 0.085, S * 0.058, LTHR_0)
  end
end

-- Compact recurved bow. The string pulls back through the five fire frames and
-- the arrow stays nocked until release, so the action reads at low frame rates.
-- A longbow stands UPRIGHT whichever way the archer faces. The old version
-- rotated the whole stave into the facing's perpendicular, which laid it flat
-- across her chest facing down, and it built the limbs from two straight
-- segments meeting at the grip -- a chevron, and at 29px of stave a chevron
-- crossed by an arrow reads as an X, not a bow.
--
-- So: the stave is a real arc, always vertical on screen, and the FACING only
-- decides how much of its curve the camera can see. In profile the bow plane is
-- square to the camera and the whole curve shows. Head-on the plane is edge on,
-- the curve nearly straightens, and the arrow is pointing at the lens -- so
-- there is no shaft left to draw, only its head.
local function drawBow(img, facing, phase, bob)
  local d = DIR_VEC[facing]
  local side = { -d[2], d[1] }
  local profile = (facing == 'left' or facing == 'right')
  local cy0 = AR_CY + bob * S

  -- Head-on, an archer's bow is NOT on their centre line -- it is out on the
  -- bow-arm side with the string hand back at the cheek. Drawn down the middle
  -- it crosses her face, which is what the first pass did: a vertical stave
  -- over her nose reads as a stick, not a weapon. She is right-handed (the
  -- shield rides her left), so the stave sits screen-right facing the camera
  -- and screen-left facing away.
  local hand = (facing == 'down') and 1 or -1

  local gx, gy, span, bulge
  if profile then
    gx, gy = AR_CX + d[1] * S * 0.15, cy0 + S * 0.02
    span   = S * 0.29                       -- half the stave, on screen
    bulge  = d[1] * S * 0.110
  else
    gx, gy = AR_CX + hand * S * 0.185, cy0 + S * 0.02
    span   = S * 0.26
    -- Seen at three-quarters rather than square on, so the arc shows less of
    -- itself -- but more than the 2px the head-on case had, which just made
    -- the stave look bent by accident.
    bulge  = hand * S * 0.075
  end

  local topX, topY = gx, gy - span
  local botX, botY = gx, gy + span
  local ctlX, ctlY = gx + bulge * 2, gy     -- quadratic control; apex lands on bulge

  local function arcPt(t)
    local u = 1 - t
    return u*u*topX + 2*u*t*ctlX + t*t*botX,
           u*u*topY + 2*u*t*ctlY + t*t*botY
  end
  local function stave(w, col)
    local ax, ay = arcPt(0)
    for i = 1, 12 do
      local bx, by = arcPt(i / 12)
      linePx(img, ax, ay, bx, by, w, col)
      ax, ay = bx, by
    end
  end

  local apexX, apexY = arcPt(0.5)           -- where her bow hand grips
  local draw = S * (0.05 + phase * 0.15)

  -- Nock. In profile it pulls straight back along the aim; head-on it pulls to
  -- the cheek, because "back" is into the screen.
  local nockX, nockY
  if profile then
    nockX, nockY = gx - d[1] * draw, gy + S * 0.01
  else
    -- Drawn to the cheek: inboard toward the face and up, which is where a
    -- string hand actually anchors.
    nockX = gx - hand * (draw * 1.5 + S * 0.02)
    nockY = gy - S * 0.085
  end

  -- Arms. The bow arm reaches to the grip, the draw arm back to the nock.
  local function arm(ox, oy, tx, ty, w)
    linePx(img, ox, oy, tx, ty, w, OUTLINE)
    linePx(img, ox, oy, tx, ty, w * 0.58, LTHR_1)
  end
  local bowShX = AR_CX + (profile and d[1] * S * 0.035 or hand * S * 0.085)
  local bowShY = cy0 - S * 0.010
  local drwShX = AR_CX - (profile and d[1] * S * 0.035 or hand * S * 0.075)
  local drwShY = cy0 + S * 0.020
  arm(bowShX, bowShY, apexX, apexY, S * 0.100)
  arm(drwShX, drwShY, nockX, nockY, S * 0.088)

  stave(S * 0.060, OUTLINE)
  stave(S * 0.032, BRONZE)
  linePx(img, topX, topY, nockX, nockY, S * 0.016, PLATE_5)
  linePx(img, nockX, nockY, botX, botY, S * 0.016, PLATE_5)

  -- Grip and draw hands, over the stave and string they hold.
  ellipsePx(img, apexX, apexY, S * 0.048, S * 0.042, OUTLINE)
  ellipsePx(img, apexX, apexY, S * 0.034, S * 0.028, LTHR_2)
  ellipsePx(img, nockX, nockY, S * 0.042, S * 0.038, OUTLINE)
  ellipsePx(img, nockX, nockY, S * 0.028, S * 0.024, LTHR_2)

  if profile then
    -- Only the HEAD is bright. Run in near-white the full shaft read as a beam
    -- of light being fired rather than a nocked arrow.
    local tipX = nockX + d[1] * S * 0.36
    local tipY = nockY
    linePx(img, nockX - d[1] * S * 0.06, nockY, tipX, tipY, S * 0.038, OUTLINE)
    linePx(img, nockX - d[1] * S * 0.05, nockY, tipX, tipY, S * 0.016, LTHR_2)
    linePx(img, tipX - d[1] * S * 0.05, tipY, tipX, tipY, S * 0.016, PLATE_6)
    linePx(img, nockX, nockY, nockX - d[1] * S * 0.055, nockY - S * 0.032, S * 0.016, PLATE_5)
    linePx(img, nockX, nockY, nockX - d[1] * S * 0.055, nockY + S * 0.032, S * 0.016, PLATE_5)
  elseif facing == 'down' then
    -- Aimed at the camera: a 17px shaft foreshortens to nothing, so all that is
    -- honest to draw is the head, sitting on the string hand.
    ellipsePx(img, apexX + bulge * 0.3, apexY, S * 0.030, S * 0.030, OUTLINE)
    ellipsePx(img, apexX + bulge * 0.3, apexY, S * 0.016, S * 0.016, PLATE_6)
  end
end

-- Swimming keeps the upper body recognizable while render.js clips the lower
-- half at the waterline. Alternating paddles make it read as movement, not a
-- standing sprite behind a translucent tile.
local function drawSwimPose(img, facing, phase, bob)
  local d = DIR_VEC[facing]
  local side = { -d[2], d[1] }
  local stroke = math.sin(phase * math.pi * 2)
  local cy0 = AR_CY + bob * S
  for sign = -1, 1, 2 do
    local reach = S * (0.15 + 0.09 * math.max(0, stroke * sign))
    local handX = AR_CX + d[1] * S * 0.05 + side[1] * sign * reach
    local handY = cy0 + d[2] * S * 0.05 + side[2] * sign * reach - S * 0.06
    linePx(img, AR_CX + side[1] * sign * S * 0.08, cy0 + side[2] * sign * S * 0.08,
                handX, handY, S * 0.100, OUTLINE)
    linePx(img, AR_CX + side[1] * sign * S * 0.08, cy0 + side[2] * sign * S * 0.08,
                handX, handY, S * 0.055, LTHR_1)
    ellipsePx(img, handX, handY, S * 0.062, S * 0.062, PLATE_3)
  end
end

-- Short alternating hand motion for the existing CLIMB ramp state.
local function drawClimbPose(img, facing, phase, bob)
  local d = DIR_VEC[facing]
  local side = { -d[2], d[1] }
  local stroke = math.sin(phase * math.pi * 2)
  local cy0 = AR_CY + bob * S
  for sign = -1, 1, 2 do
    local handX = AR_CX + side[1] * sign * S * 0.15 + d[1] * S * 0.04
    -- No standing lift term. AR_CY is already the shoulder, so subtracting a
    -- further 0.10 of S put both hands at chin height, over her face.
    local handY = cy0 + side[2] * sign * S * 0.15 + d[2] * S * 0.04 - S * (stroke * sign * 0.05)
    linePx(img, AR_CX + side[1] * sign * 4, cy0 + side[2] * sign * 4,
                handX, handY, S * 0.100, OUTLINE)
    linePx(img, AR_CX + side[1] * sign * 4, cy0 + side[2] * sign * 4,
                handX, handY, S * 0.055, LTHR_1)
    ellipsePx(img, handX, handY, S * 0.060, S * 0.060, PLATE_3)
  end
end

----------------------------------------------------------------------
-- frame assembly
----------------------------------------------------------------------
local ARMED = { idle_armed = true, walk_armed = true, jump_armed = true, sword = true,
                climb_armed = true }
local BOW_KINDS = { idle_bow = true, walk_bow = true, jump_bow = true, bow = true }
local SWIM_KINDS = { swim = true }
local CLIMB_KINDS = { climb = true, climb_armed = true }

local function drawFrame(img, facing, kind, i, n)
  local bob, sway, swing, a, trail = 0, 0, 0, IDLE_ANGLE[facing], false
  local pcx, pcy = IDLE_PIVOT[facing][1], IDLE_PIVOT[facing][2]
  local punchPhase, actionPhase = nil, nil
  local airborne = false

  if kind == 'idle' or kind == 'idle_armed' then
    bob = (i == 2) and (1.0 / S) or 0
  elseif kind == 'walk' or kind == 'walk_armed' then
    local t = (i - 1) / n
    -- The stride opens up with the longer leg: 0.045 of S was a 2px step on an
    -- 11px leg, and on a 25px leg it barely reads.
    swing = math.sin(t * math.pi * 2) * 0.062
    bob   = (math.abs(math.sin(t * math.pi * 2)) > 0.5) and (-1.0 / S) or 0
    sway  = -math.sin(t * math.pi * 2) * 0.05
  elseif kind == 'jump' or kind == 'jump_armed' or kind == 'jump_bow' then
    actionPhase = (i - 0.5) / n
    airborne = true
    sway = -math.sin(actionPhase * math.pi) * 0.04
  elseif kind == 'swim' then
    actionPhase = (i - 1) / n
    sway = -math.sin(actionPhase * math.pi * 2) * 0.04
  elseif CLIMB_KINDS[kind] then
    actionPhase = (i - 1) / n
    sway = -math.sin(actionPhase * math.pi * 2) * 0.035
    bob = -1.0 / S
  elseif BOW_KINDS[kind] then
    actionPhase = (i - 1) / math.max(1, n - 1)
    if kind == 'idle_bow' then
      actionPhase = 0.72
    elseif kind == 'walk_bow' then
      local t = (i - 1) / n
      swing = math.sin(t * math.pi * 2) * 0.062
      bob = (math.abs(math.sin(t * math.pi * 2)) > 0.5) and (-1.0 / S) or 0
      sway = -math.sin(t * math.pi * 2) * 0.05
      actionPhase = 0.72
    end
  elseif kind == 'punch' then
    -- Sampled off the endpoints: sin(0) and sin(pi) are both zero reach, which
    -- parks the fist on her chest instead of showing a jab.
    punchPhase = (i - 0.5) / n
    bob = (punchPhase > 0.3 and punchPhase < 0.7) and (-1.0 / S) or 0
  elseif kind == 'sword' then -- sword: pivots at the body centre so the arc reads as a real sweep
    local phase = (i - 1) / (n - 1)
    local arc = math.pi * 0.85
    a = BASE_ANGLE[facing] - arc/2 + arc*phase
    trail = phase > 0.05
    bob = (phase > 0.15 and phase < 0.85) and (-1.0 / S) or 0
    pcx, pcy = SW_CX, SW_CY
  end

  -- Bow and swim poses use both arms, so hiding the shield keeps those
  -- silhouettes readable. The armed jump and climb retain the signature shield.
  local shield = not BOW_KINDS[kind] and not SWIM_KINDS[kind]

  -- What she is HOLDING, kept separate from what her LIMBS are doing, because
  -- the two need different depths facing north. Facing away from the camera she
  -- stands between it and her own gear, so the blade and the bow go down first
  -- and everything else paints over them. Drawn last -- as they were, and as
  -- they still are in the other three facings -- they sat on top of her back.
  --
  -- Ahead of the cloak, not just ahead of the torso: the cloak hangs down the
  -- side of her the camera can see, so it occludes a carried weapon too.
  local function drawHeld()
    if BOW_KINDS[kind] then
      drawBow(img, facing, (kind == 'jump_bow') and 0.72 or actionPhase, bob)
    elseif kind == 'jump_armed' or kind == 'climb_armed' then
      drawBlade(img, IDLE_ANGLE[facing], bob, false,
                IDLE_PIVOT[facing][1], IDLE_PIVOT[facing][2])
    elseif ARMED[kind] then
      drawBlade(img, a, bob, trail, pcx, pcy)
    end
  end

  -- Her own arms and legs. These stay in front in every facing: they are the
  -- near side of her whichever way she is turned.
  local function drawLimbs()
    if punchPhase then
      drawFist(img, facing, punchPhase, bob)
    elseif kind == 'jump' or kind == 'jump_armed' then
      drawJumpPose(img, facing, actionPhase, bob)
    elseif kind == 'swim' then
      drawSwimPose(img, facing, actionPhase, bob)
    elseif CLIMB_KINDS[kind] then
      drawClimbPose(img, facing, actionPhase, bob)
    end
  end

  local behind = (facing == 'up')

  if behind then drawHeld() end
  drawCloak(img, sway, bob)
  -- On the facing where the shield rides her FAR arm it has to go down before
  -- the body, so the torso overlaps it rather than the other way round.
  if shield and not shieldInFront(facing) then drawShield(img, facing, bob) end
  -- Lift the legs inside the authored frame as well as lifting the whole frame
  -- with player.z. This makes a hop read as knees tucked, not a standing pose
  -- translated upward.
  drawLegs(img, facing, swing, bob + (airborne and -0.12 or 0))
  drawTorso(img, facing, bob)
  if shield and shieldInFront(facing) then drawShield(img, facing, bob) end
  drawHead(img, facing, bob)
  tintedRim(img, RIM_MUL)

  drawLimbs()
  if not behind then drawHeld() end
end

local KINDS = {
  { 'idle',       N_IDLE,  0.28  },   -- unarmed: before prologue Beat 5
  { 'walk',       N_WALK,  0.11  },
  { 'punch',      N_PUNCH, 0.037 },   -- punchTimer is 150ms
  { 'jump',       N_JUMP,  0.09  },
  { 'swim',       N_SWIM,  0.14  },
  { 'climb',      N_CLIMB, 0.11  },
  { 'idle_armed', N_IDLE,  0.28  },   -- armed: sword carried high
  { 'walk_armed', N_WALK,  0.11  },
  { 'jump_armed', N_JUMP,  0.09  },
  { 'idle_bow',   N_IDLE,  0.28  },
  { 'walk_bow',   N_WALK,  0.11  },
  { 'jump_bow',   N_JUMP,  0.09  },
  { 'bow',        N_BOW,   0.056 },   -- bowTimer is 280ms
  { 'sword',      N_SWING, 0.036 },   -- swordTimer is 180ms
}

local spr = Sprite(W, H, ColorMode.RGB)
local lay = spr.layers[1]
lay.name = "hero"

local total = #DIRS * PER_DIR
while #spr.frames < total do spr:newFrame() end

for d = 1, #DIRS do
  local facing = DIRS[d]
  local base = (d - 1) * PER_DIR
  local cursor = 0
  for _, K in ipairs(KINDS) do
    local kind, n, dur = K[1], K[2], K[3]
    for i = 1, n do
      local f = base + cursor + i
      local img = Image(W, H, ColorMode.RGB)
      img:clear()
      drawFrame(img, facing, kind, i, n)
      if lay:cel(f) then spr:deleteCel(lay, f) end
      spr:newCel(lay, f, img, Point(0, 0))
      spr.frames[f].duration = dur
    end
    local tag = spr:newTag(base + cursor + 1, base + cursor + n)
    tag.name = kind .. "_" .. facing
    cursor = cursor + n
  end
end

spr:saveAs(app.params["out"])
print("wrote " .. app.params["out"] .. "  frames=" .. #spr.frames .. " tags=" .. #spr.tags)

----------------------------------------------------------------------
-- hero-atlas.js
----------------------------------------------------------------------
-- The frame layout, emitted as a plain global assignment for the game to read.
--
-- This exists because hero-sprite.js used to hardcode a copy of every constant
-- in this file (frame size, body box, column count, per-animation start/length/
-- duration) with a comment telling the next person to remember to change both.
-- That is a drift hazard with no upside: the numbers all live here already.
--
-- It is a .js file rather than the .json Aseprite emits alongside the sheet,
-- because the game is opened from file://, where fetch and XHR cannot read a
-- sibling file. A <script> tag assigning a global is the project's standing
-- answer to that, and hero-sheet.json stays a build artefact for humans.
--
-- Written from THIS script's own constants rather than parsed back out of the
-- sheet, so the atlas cannot describe a layout the generator did not author.
local atlasPath = app.params["atlas"] or "hero-atlas.js"
local af = io.open(atlasPath, "wb")
if not af then
  error("cannot write " .. atlasPath .. " (run from the repo root)")
end

local ms = function (sec) return math.floor(sec * 1000 + 0.5) end

af:write("// GENERATED by tools/make-hero-sheet-grounded.lua. Do not edit by hand.\n")
af:write("//\n")
af:write("// Regenerate with the two commands in that script's header, from the\n")
af:write("// repo root. This file is written by step 1, alongside the .aseprite.\n")
af:write("//\n")
af:write("// Loaded as a plain script (no modules, no fetch) so it works from\n")
af:write("// file://, and read by hero-sprite.js.\n")
af:write("const HERO_ATLAS = {\n")
af:write(string.format("  frame: %d,\n", W))
af:write(string.format("  body: %d,\n", math.floor(S + 0.5)))
af:write(string.format("  bodyOX: %d,\n", math.floor(OX + 0.5)))
af:write(string.format("  bodyOY: %d,\n", math.floor(OY + 0.5)))
-- Foot row, as a fraction down the body box. The renderer plants THIS on the
-- ground, not the body box bottom, which is what stops the hero floating.
af:write(string.format("  footF: %s,\n", tostring(FOOT_F)))
-- Blade reach for the swing, in BODY pixels, so the elemental sword FX can
-- burst from the tip. Shipped rather than duplicated in hero-sprite.js: the two
-- copies of "30" drifting apart is exactly the class of bug the atlas exists to
-- prevent, and this one grew to 35 when the figure did.
af:write(string.format("  swordLen: %d,\n", math.floor(SW_LEN + 0.5)))
-- Frames per DIRECTION (the anim columns), and frames per SHEET ROW. They are
-- equal only when a direction fits on one row; here a direction's 52 frames wrap
-- across two rows of 26, so hero-sprite.js must divide rather than assume.
af:write(string.format("  perDir: %d,\n", PER_DIR))
af:write(string.format("  sheetCols: %d,\n", SHEET_COLS))
-- Row per direction, in this script's DIRS order, which is the order the frames
-- were written in and therefore the order the sheet rows come out in.
af:write("  dirRow: {")
for d = 1, #DIRS do
  af:write(string.format("%s %s: %d", d > 1 and "," or "", DIRS[d], d - 1))
end
af:write(" },\n")
-- anim -> [startColumn, frameCount, msPerFrame]. Columns are relative to the
-- start of a direction's run of frames, which is how the blit indexes them.
af:write("  anims: {\n")
local cursor = 0
for _, K in ipairs(KINDS) do
  af:write(string.format("    %s: [%d, %d, %d],\n", K[1], cursor, K[2], ms(K[3])))
  cursor = cursor + K[2]
end
af:write("  },\n")
af:write("};\n")
af:close()
print("wrote " .. atlasPath)
