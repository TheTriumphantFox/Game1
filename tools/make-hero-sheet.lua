-- Build the player sprite sheet for The RPG Game, drawn from the painted
-- character portrait (hero-portrait.png) rather than from drawPlayer().
--
-- The portrait is the character's real design and differs from what the game
-- currently draws procedurally: a female elf knight in dark weathered plate,
-- a large verdigris tree-of-life shield on her off arm, a heavy forest cloak,
-- long swept-back ears, and the sword carried high. drawPlayer's bright-silver
-- palette and missing shield are approximations of that art; this sheet goes
-- back to the source.
--
-- 96x96 frames. Per direction: unarmed idle(2) + walk(4) + punch(4) + jump(4)
-- + swim(4) + climb(4), sword idle(2) + walk(4) + jump(4), and bow idle(2)
-- + walk(4) + jump(4) + fire(5) = 52 frames. Four directions make 208 frames,
-- tagged per animation. The extra states are deliberately authored here rather
-- than faked with canvas transforms: the shield, cloak, ears, bow, and sword all
-- need different silhouettes when the hero leaves the ground or enters water.
--
-- Step 1 also writes hero-atlas.js, the frame layout the game reads at runtime.
--
-- Regenerate (run from the repo root; verified byte-identical to the
-- committed hero-sheet.png/.json/.aseprite on aseprite 1.3.18.2-dev):
--   aseprite -b --script-param out=hero-sheet.aseprite --script tools/make-hero-sheet.lua
--   aseprite -b hero-sheet.aseprite --sheet hero-sheet.png --data hero-sheet.json ^
--            --format json-array --sheet-type rows --sheet-columns 52 --list-tags
--
-- Two steps because the sprite the script builds is not left "open" for the
-- CLI's own --sheet/--data flags to see when they are chained onto the same
-- invocation as --script; --list-tags is required or frameTags is omitted
-- from the JSON.

-- Frame 96, body 48. The frame is deliberately twice the body: everything is
-- authored as a fraction of the 48px BODY box, and the surplus is overhang room
-- for the raised blade, the ear tips, the cloak, and the downward swings.
--
-- It was 64, which left 8px of margin each side and 7 above. That was not
-- enough: measured on the old sheet, art reached x=0, x=63 and y=0 in three of
-- the four direction rows, so poses were being cut off at the frame edge rather
-- than merely filling it. heroSwordTip's own comment admitted as much, calling
-- the drawn blade "shorter than the 1.25 tiles the hitbox uses, because the full
-- reach does not fit in a 64px frame". 24px of margin all round fixes that.
local W, H   = 96, 96
local DIRS   = { "down", "up", "left", "right" }
local N_IDLE, N_WALK, N_PUNCH, N_JUMP = 2, 4, 4, 4
local N_SWIM, N_CLIMB, N_BOW, N_SWING = 4, 4, 5, 5
-- unarmed idle+walk+punch+jump+swim+climb, then sword and bow sets
local PER_DIR = N_IDLE + N_WALK + N_PUNCH + N_JUMP + N_SWIM + N_CLIMB +
                N_IDLE + N_WALK + N_JUMP + N_IDLE + N_WALK + N_JUMP + N_BOW + N_SWING
local S       = 48.0
local OX, OY  = 24.0, 24.0

-- Where the boot SOLES sit, as a fraction down the body box. This is the hero's
-- foot row, and it is the number the renderer plants on the ground.
--
-- It is 0.96, not 1.0: the character does not quite fill her own body box. That
-- is fine and stays as authored, but it used to be invisible, and the renderer
-- planted the body box BOTTOM instead, which left her floating 2px above the
-- ground at TILE_PX 48. Naming it here, using it in drawLegs, and shipping it in
-- the atlas is what lets the renderer plant the feet rather than the box.
local FOOT_F = 0.96

local lib = dofile("tools/aseprite-lib.lua")

----------------------------------------------------------------------
-- palette sampled from hero-portrait.png
----------------------------------------------------------------------
local hex = lib.hex

local STEEL_D  = hex('#3f4340')   -- weathered plate, deep shadow
local STEEL    = hex('#636761')
local STEEL_L  = hex('#9aa09a')
local STEEL_H  = hex('#c6ccc4')   -- rim light
local CLOAK_D  = hex('#253a20')
local CLOAK    = hex('#3b5c31')
local CLOAK_L  = hex('#56803f')
local HAIR_D   = hex('#9c7530')
local HAIR     = hex('#d0a54a')
local HAIR_L   = hex('#f2dc93')
local SKIN     = hex('#ecc9a0')
local SKIN_D   = hex('#c39a72')
local EAR_T    = hex('#d9a184')   -- ears catch warm backlight in the portrait
local GOLD     = hex('#b8934a')
local GOLD_D   = hex('#7e6229')
local SHIELD_F = hex('#6d7f58')   -- verdigris field
local SHIELD_D = hex('#4d5c3e')
local TREE     = hex('#dfe3da')   -- silver tree of life
local LEATHER  = hex('#5a4128')
local LEATHER_D= hex('#33230f')
local EYE      = hex('#4a7a5e')   -- green
local WHITE    = hex('#ffffff')
local OUTLINE  = hex('#12100c')

----------------------------------------------------------------------
-- rasteriser (px/polyPx/ellipsePx/linePx/outlineSilhouette live in
-- tools/aseprite-lib.lua, shared with make-dragon-sheet.lua; only the
-- fraction-of-S wrappers below stay local, since they close over this
-- script's own W, H, OX, OY, S)
----------------------------------------------------------------------
local raster = lib.newRaster(W, H)
local px, polyPx, ellipsePx, linePx, outlineSilhouette =
  raster.px, raster.polyPx, raster.ellipsePx, raster.linePx, raster.outlineSilhouette

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

local function ellipseF(img, fcx, fcy, frx, fry, c)
  ellipsePx(img, X(fcx), Y(fcy), frx * S, fry * S, c)
end

-- lineF's width is a fraction of S, matching every other *F function here
-- and matching make-dragon-sheet.lua (which is the version this reconciles
-- to -- the hero sheet previously took line width in raw pixels while the
-- dragon sheet took a fraction of S). LINE_W is every hero call site's
-- previous literal pixel width (1.0) re-expressed as that fraction; S
-- cancels out exactly (verified: (1.0/S)*S == 1.0 in Lua's double
-- arithmetic for S=48), so this is a pure reconciliation, not a redraw.
local LINE_W = 1.0 / S

local function lineF(img, fx0, fy0, fx1, fy1, wf, c)
  linePx(img, X(fx0), Y(fy0), X(fx1), Y(fy1), wf * S, c)
end

----------------------------------------------------------------------
-- pieces
----------------------------------------------------------------------

-- Heavy forest cloak. Hangs from the shoulders and stops above the boots so
-- the legs stay legible; sway trails the walk cycle.
local function drawCloak(img, sway, bob)
  local b = bob
  polyF(img, { {0.28,0.33+b}, {0.72,0.33+b}, {0.84+sway,0.82+b}, {0.16+sway,0.82+b} }, CLOAK_D)
  polyF(img, { {0.28,0.33+b}, {0.50,0.33+b}, {0.50+sway,0.82+b}, {0.16+sway,0.82+b} }, CLOAK)
  lineF(img, 0.50, 0.36+b, 0.50+sway, 0.81+b, LINE_W, CLOAK_D)
  lineF(img, 0.34, 0.40+b, 0.27+sway, 0.81+b, LINE_W, CLOAK_L)
  lineF(img, 0.66, 0.40+b, 0.74+sway, 0.81+b, LINE_W, hex('#1b2b17'))
end

-- Armoured legs with plated greaves, and boots. `swing` moves the feet through
-- the walk cycle: vertically head-on, fore/aft in profile.
local function drawLegs(img, facing, swing, bob)
  local isSide = (facing == 'left' or facing == 'right')
  local b = bob
  local aX, bX, aY, bY = 0.34, 0.53, b, b
  if isSide then
    aX, bX = 0.34 + swing * 1.6, 0.50 - swing * 1.6
  else
    aY, bY = b + swing, b - swing
  end
  -- back leg first so the near leg overlaps it
  for _, L in ipairs({ { bX, bY, STEEL_D, LEATHER_D }, { aX, aY, STEEL, LEATHER } }) do
    local lx, ly, plate, boot = L[1], L[2], L[3], L[4]
    rectF(img, lx, 0.72 + ly, 0.13, 0.16, plate)
    rectF(img, lx, 0.72 + ly, 0.13, 0.02, STEEL_L)     -- knee cop
    rectF(img, lx - 0.01, 0.86 + ly, 0.15, 0.09, boot)
    rectF(img, lx - 0.01, 0.86 + ly, 0.15, 0.02, LEATHER)
    -- The sole, derived from FOOT_F so the declared foot row and the drawn one
    -- cannot drift apart. Was the literal 0.935; FOOT_F - 0.025 is the same
    -- number, now stated once.
    rectF(img, lx - 0.01, FOOT_F - 0.025 + ly, 0.15, 0.025, hex('#1a1206'))
  end
end

-- Torso: female cuirass with the portrait's deep V neckline, layered pauldrons,
-- bronze filigree, belt and the green sash that hangs off it.
local function drawTorso(img, facing, bob)
  local isSide = (facing == 'left' or facing == 'right')
  local b = bob
  local L, R = 0.30, 0.70
  if isSide then L, R = 0.34, 0.66 end

  -- tassets / skirt plates
  polyF(img, { {L+0.02,0.60+b}, {R-0.02,0.60+b}, {R+0.02,0.74+b}, {L-0.02,0.74+b} }, LEATHER)
  polyF(img, { {0.50,0.60+b}, {R-0.02,0.60+b}, {R+0.02,0.74+b}, {0.50,0.74+b} }, LEATHER_D)
  lineF(img, 0.38, 0.62+b, 0.36, 0.73+b, LINE_W, STEEL_D)
  lineF(img, 0.62, 0.62+b, 0.64, 0.73+b, LINE_W, STEEL_D)

  -- cuirass
  polyF(img, { {L,0.37+b}, {R,0.37+b}, {R,0.55+b}, {0.50,0.63+b}, {L,0.55+b} }, STEEL)
  polyF(img, { {0.50,0.37+b}, {R,0.37+b}, {R,0.55+b}, {0.50,0.63+b} }, STEEL_D)
  -- breast curve highlights
  ellipseF(img, 0.42, 0.455+b, 0.075, 0.065, STEEL_L)
  ellipseF(img, 0.585, 0.455+b, 0.075, 0.065, STEEL)
  ellipseF(img, 0.405, 0.44+b, 0.035, 0.03, STEEL_H)
  -- deep V neckline
  polyF(img, { {0.415,0.365+b}, {0.585,0.365+b}, {0.50,0.50+b} }, SKIN_D)
  polyF(img, { {0.435,0.365+b}, {0.565,0.365+b}, {0.50,0.475+b} }, SKIN)
  lineF(img, 0.415, 0.365+b, 0.50, 0.50+b, LINE_W, GOLD)
  lineF(img, 0.585, 0.365+b, 0.50, 0.50+b, LINE_W, GOLD_D)
  -- bronze filigree down the flanks
  lineF(img, L+0.03, 0.40+b, L+0.05, 0.54+b, LINE_W, GOLD_D)
  lineF(img, R-0.03, 0.40+b, R-0.05, 0.54+b, LINE_W, GOLD_D)

  -- belt, buckle, and the green sash hanging from it
  rectF(img, L-0.01, 0.575+b, (R-L)+0.02, 0.045, LEATHER_D)
  rectF(img, 0.475, 0.567+b, 0.055, 0.06, GOLD)
  rectF(img, 0.489, 0.582+b, 0.026, 0.032, GOLD_D)
  polyF(img, { {0.40,0.60+b}, {0.50,0.60+b}, {0.48,0.80+b}, {0.37,0.78+b} }, CLOAK)
  lineF(img, 0.43, 0.63+b, 0.42, 0.77+b, LINE_W, CLOAK_D)

  -- pauldrons: layered plates with a bright top edge
  -- Concentric shells lit toward lib.LIGHT_DIR: rim in shadow, crown of the
  -- plate catching the highlight. STEEL_RAMP is dark-to-light
  -- (STEEL_D, STEEL, STEEL_L, STEEL_H); lib.ramp(_, (i-1)/3) reproduces
  -- STEEL_D, STEEL_L, STEEL_H exactly (the plain STEEL step is unused here,
  -- same as before this was expressed as a ramp).
  local STEEL_RAMP = { STEEL_D, STEEL, STEEL_L, STEEL_H }
  local function pauldron(cx)
    ellipseF(img, cx, 0.415+b, 0.095, 0.075, lib.ramp(STEEL_RAMP, 0/3))
    ellipseF(img, cx, 0.405+b, 0.085, 0.062, lib.ramp(STEEL_RAMP, 2/3))
    ellipseF(img, cx, 0.392+b, 0.070, 0.042, lib.ramp(STEEL_RAMP, 3/3))
    lineF(img, cx-0.075, 0.445+b, cx+0.075, 0.445+b, LINE_W, GOLD_D)
  end
  assert(lib.LIGHT_DIR.y < 0, "STEEL_RAMP is ordered dark-to-light assuming an overhead/upper light")
  if isSide then
    pauldron(facing == 'left' and 0.38 or 0.62)
    rectF(img, facing == 'left' and 0.34 or 0.54, 0.46+b, 0.12, 0.14, LEATHER)
    rectF(img, facing == 'left' and 0.34 or 0.54, 0.50+b, 0.12, 0.035, STEEL_L)  -- vambrace
  else
    pauldron(0.24); pauldron(0.76)
    rectF(img, 0.20, 0.46+b, 0.10, 0.15, LEATHER)
    rectF(img, 0.70, 0.46+b, 0.10, 0.15, LEATHER)
    rectF(img, 0.20, 0.50+b, 0.10, 0.035, STEEL_L)
    rectF(img, 0.70, 0.50+b, 0.10, 0.035, STEEL_L)
  end
end

-- The signature piece: a big verdigris shield with the silver tree of life,
-- carried on the off arm. Absent from drawPlayer entirely.
local function drawShield(img, facing, bob)
  if facing == 'up' then return end          -- reads as the shield's back
  local cx = (facing == 'left') and 0.22 or 0.78
  if facing == 'right' then cx = 0.80 end
  if facing == 'left'  then cx = 0.20 end
  local cy = 0.52 + bob
  local rx, ry = 0.165, 0.205

  ellipseF(img, cx, cy, rx, ry, STEEL_L)                 -- rim
  ellipseF(img, cx, cy, rx * 0.86, ry * 0.88, SHIELD_D)  -- rolled edge
  ellipseF(img, cx, cy, rx * 0.74, ry * 0.78, SHIELD_F)  -- field
  -- engraved border dots
  ellipseF(img, cx, cy - ry * 0.86, 0.016, 0.014, STEEL_H)
  ellipseF(img, cx, cy + ry * 0.86, 0.016, 0.014, STEEL_H)

  -- Tree of life. Everything is 1px with field showing between: a filled
  -- canopy at this size collapses the whole emblem into a white smear.
  local tx, ty = X(cx), Y(cy)
  local RX, RY = rx * S, ry * S
  linePx(img, tx, ty + RY*0.60, tx, ty - RY*0.18, 1.4, TREE)          -- trunk
  linePx(img, tx, ty + RY*0.16, tx - RX*0.44, ty - RY*0.16, 1.0, TREE)
  linePx(img, tx, ty + RY*0.16, tx + RX*0.44, ty - RY*0.16, 1.0, TREE)
  linePx(img, tx, ty - RY*0.14, tx - RX*0.34, ty - RY*0.50, 1.0, TREE)
  linePx(img, tx, ty - RY*0.14, tx + RX*0.34, ty - RY*0.50, 1.0, TREE)
  -- leaf clusters at the branch tips only
  ellipsePx(img, tx,             ty - RY*0.46, 1.6, 1.4, TREE)
  ellipsePx(img, tx - RX*0.40,   ty - RY*0.56, 1.3, 1.2, TREE)
  ellipsePx(img, tx + RX*0.40,   ty - RY*0.56, 1.3, 1.2, TREE)
  ellipsePx(img, tx - RX*0.50,   ty - RY*0.20, 1.2, 1.1, TREE)
  ellipsePx(img, tx + RX*0.50,   ty - RY*0.20, 1.2, 1.1, TREE)
  -- root flare
  linePx(img, tx, ty + RY*0.60, tx - RX*0.26, ty + RY*0.70, 1.0, TREE)
  linePx(img, tx, ty + RY*0.60, tx + RX*0.26, ty + RY*0.70, 1.0, TREE)
end

-- Head: long swept ears, windswept blonde, green eyes.
local function drawHead(img, facing, bob)
  local b = bob

  if facing == 'up' then
    -- back of the head: the mane, plus the windswept lock trailing to one side
    polyF(img, { {0.60,0.16+b}, {0.74,0.20+b}, {0.86,0.46+b}, {0.70,0.44+b} }, HAIR_D)
    ellipseF(img, 0.50, 0.22+b, 0.195, 0.175, HAIR_D)
    ellipseF(img, 0.50, 0.205+b, 0.165, 0.145, HAIR)
    ellipseF(img, 0.50, 0.165+b, 0.105, 0.065, HAIR_L)
    lineF(img, 0.42, 0.13+b, 0.40, 0.30+b, LINE_W, HAIR_D)
    lineF(img, 0.58, 0.13+b, 0.61, 0.30+b, LINE_W, HAIR_D)
    -- ear tips just clear the hair
    polyF(img, { {0.31,0.20+b}, {0.19,0.13+b}, {0.315,0.26+b} }, EAR_T)
    polyF(img, { {0.69,0.20+b}, {0.81,0.13+b}, {0.685,0.26+b} }, EAR_T)
    return
  end

  -- hair mass behind the head, sweeping to the character's right
  polyF(img, { {0.58,0.14+b}, {0.74,0.19+b}, {0.88,0.44+b}, {0.68,0.42+b} }, HAIR_D)
  lineF(img, 0.70, 0.22+b, 0.84, 0.41+b, LINE_W, HAIR)
  ellipseF(img, 0.50, 0.21+b, 0.185, 0.165, HAIR_D)

  -- long pointed ears, angled up and back
  if facing == 'right' then
    polyF(img, { {0.34,0.175+b}, {0.19,0.10+b}, {0.35,0.255+b} }, EAR_T)
    lineF(img, 0.33, 0.175+b, 0.22, 0.125+b, LINE_W, SKIN_D)
  elseif facing == 'left' then
    polyF(img, { {0.66,0.175+b}, {0.81,0.10+b}, {0.65,0.255+b} }, EAR_T)
    lineF(img, 0.67, 0.175+b, 0.78, 0.125+b, LINE_W, SKIN_D)
  else
    polyF(img, { {0.345,0.18+b}, {0.20,0.105+b}, {0.355,0.26+b} }, EAR_T)
    polyF(img, { {0.655,0.18+b}, {0.80,0.105+b}, {0.645,0.26+b} }, EAR_T)
    lineF(img, 0.335, 0.18+b, 0.23, 0.13+b, LINE_W, SKIN_D)
    lineF(img, 0.665, 0.18+b, 0.77, 0.13+b, LINE_W, SKIN_D)
  end

  -- face
  ellipseF(img, 0.50, 0.225+b, 0.135, 0.145, SKIN_D)
  ellipseF(img, 0.492, 0.215+b, 0.115, 0.125, SKIN)

  -- swept fringe, parted off-centre as in the portrait
  polyF(img, { {0.355,0.09+b}, {0.65,0.09+b}, {0.66,0.20+b}, {0.545,0.145+b},
               {0.47,0.205+b}, {0.40,0.15+b}, {0.35,0.21+b} }, HAIR)
  rectF(img, 0.43, 0.088+b, 0.15, 0.022, HAIR_L)
  lineF(img, 0.40, 0.115+b, 0.375, 0.19+b, LINE_W, HAIR_D)
  lineF(img, 0.62, 0.115+b, 0.645, 0.19+b, LINE_W, HAIR_D)

  if facing == 'down' then
    rectF(img, 0.405, 0.215+b, 0.055, 0.042, EYE)
    rectF(img, 0.545, 0.215+b, 0.055, 0.042, EYE)
    rectF(img, 0.418, 0.222+b, 0.018, 0.016, WHITE)
    rectF(img, 0.558, 0.222+b, 0.018, 0.016, WHITE)
    rectF(img, 0.402, 0.202+b, 0.06, 0.012, HAIR_D)
    rectF(img, 0.542, 0.202+b, 0.06, 0.012, HAIR_D)
    rectF(img, 0.492, 0.252+b, 0.018, 0.016, SKIN_D)
    rectF(img, 0.468, 0.283+b, 0.062, 0.012, hex('#b07f63'))
  else
    local ex = (facing == 'right') and 0.545 or 0.40
    rectF(img, ex, 0.215+b, 0.07, 0.042, EYE)
    rectF(img, ex + ((facing == 'right') and 0.04 or 0.0), 0.222+b, 0.016, 0.016, WHITE)
    rectF(img, ex, 0.202+b, 0.07, 0.012, HAIR_D)
    rectF(img, (facing == 'right') and 0.615 or 0.365, 0.255+b, 0.02, 0.016, SKIN_D)

    -- A lock swept across the far side of the face. In profile only one eye is
    -- ever visible, which reads as a missing eye rather than a hidden one; this
    -- covers where the second would sit, stopping short of the near eye.
    if facing == 'right' then
      polyF(img, { {0.385,0.095+b}, {0.545,0.095+b}, {0.535,0.185+b},
                   {0.495,0.265+b}, {0.435,0.245+b}, {0.380,0.160+b} }, HAIR)
      lineF(img, 0.500, 0.115+b, 0.478, 0.250+b, LINE_W, HAIR_D)
      lineF(img, 0.435, 0.110+b, 0.416, 0.220+b, LINE_W, HAIR_L)
    else
      polyF(img, { {0.615,0.095+b}, {0.455,0.095+b}, {0.465,0.185+b},
                   {0.505,0.265+b}, {0.565,0.245+b}, {0.620,0.160+b} }, HAIR)
      lineF(img, 0.500, 0.115+b, 0.522, 0.250+b, LINE_W, HAIR_D)
      lineF(img, 0.565, 0.110+b, 0.584, 0.220+b, LINE_W, HAIR_L)
    end
  end
end

----------------------------------------------------------------------
-- sword
----------------------------------------------------------------------
-- Sword hand, as a position in the BODY box rather than the frame.
--
-- These were the literals 32 and 30, tuned when the frame was 64 and the body
-- box sat at (8, 7). Both are exact fractions of the 48px body there
-- (X(0.5) = 32, Y(23/48) = 30), so this is the same point, now expressed so it
-- follows the body box instead of the frame corner. Enlarging the frame is what
-- exposed the difference: the blade and fist stayed pinned to absolute
-- coordinates while the body moved down, tearing them off the arm.
--
-- SW_HILT and SW_LEN are deliberately NOT converted. They are LENGTHS, and the
-- body is still 48px at any frame size, so a distance in pixels is still the
-- distance it was. Only positions had to move.
local SW_CX, SW_CY    = X(0.5), Y(23.0 / 48.0)
local SW_HILT, SW_LEN = 10.0, 30.0
local BASE_ANGLE = { down = math.pi/2, up = -math.pi/2, left = math.pi, right = 0.0 }
-- Carried high, as in the portrait. Pivoted at the sword hand (opposite the
-- shield) and angled near-vertical so the blade rises beside the head instead
-- of cutting across her face.
local IDLE_ANGLE = { down = -1.75, up = -1.75, left = -1.35, right = -1.75 }
-- Same conversion: these were 23/41 and 34, which are X(15/48), X(33/48) and
-- Y(27/48) under the old 64px geometry.
local IDLE_PIVOT = {
  down  = { X(15.0 / 48.0), Y(27.0 / 48.0) },
  up    = { X(15.0 / 48.0), Y(27.0 / 48.0) },
  left  = { X(33.0 / 48.0), Y(27.0 / 48.0) },
  right = { X(15.0 / 48.0), Y(27.0 / 48.0) },
}

local function drawBlade(img, a, bob, trail, cx, cy0)
  local cy = cy0 + bob * S
  local bx, by = cx + math.cos(a)*SW_HILT, cy + math.sin(a)*SW_HILT
  local tx, ty = cx + math.cos(a)*SW_LEN,  cy + math.sin(a)*SW_LEN
  local mx, my = cx + math.cos(a)*(SW_LEN-5), cy + math.sin(a)*(SW_LEN-5)
  local gx, gy = cx + math.cos(a)*3.0, cy + math.sin(a)*3.0
  local nx, ny = -math.sin(a), math.cos(a)

  if trail then
    for k = 2, 1, -1 do
      local ta = a - 0.26*k
      linePx(img, cx+math.cos(ta)*(SW_HILT+3), cy+math.sin(ta)*(SW_HILT+3),
                  cx+math.cos(ta)*(SW_LEN-2),  cy+math.sin(ta)*(SW_LEN-2),
                  (k==2) and 1.0 or 1.8, (k==2) and STEEL_D or STEEL_L)
    end
  end

  linePx(img, bx, by, tx, ty, 5.4, OUTLINE)
  linePx(img, bx+nx*5.5, by+ny*5.5, bx-nx*5.5, by-ny*5.5, 4.6, OUTLINE)
  linePx(img, gx, gy, bx, by, 4.2, OUTLINE)

  -- grip, pommel, and the portrait's ornate swept crossguard
  linePx(img, gx, gy, bx, by, 2.6, LEATHER_D)
  linePx(img, gx, gy, bx, by, 1.0, LEATHER)
  ellipsePx(img, gx, gy, 2.2, 2.2, GOLD)
  ellipsePx(img, gx, gy, 1.0, 1.0, GOLD_D)
  linePx(img, bx+nx*4.6, by+ny*4.6, bx-nx*4.6, by-ny*4.6, 2.8, STEEL_L)
  linePx(img, bx+nx*4.6, by+ny*4.6, bx-nx*4.6, by-ny*4.6, 1.0, STEEL_D)
  ellipsePx(img, bx+nx*4.6, by+ny*4.6, 1.4, 1.4, GOLD)
  ellipsePx(img, bx-nx*4.6, by-ny*4.6, 1.4, 1.4, GOLD)

  -- blade: body, tapered point, fuller, lit edge
  linePx(img, bx, by, mx, my, 3.6, STEEL_L)
  linePx(img, mx, my, tx, ty, 1.8, STEEL_L)
  linePx(img, bx, by, mx, my, 1.0, STEEL)
  linePx(img, bx-nx*1.3, by-ny*1.3, mx-nx*1.3, my-ny*1.3, 1.0, STEEL_H)
end

----------------------------------------------------------------------
-- punch: the pre-weapon jab. player.hasSword is false until prologue Beat 5,
-- and render.js is explicit that no blade may be drawn before the player owns
-- one -- so the unarmed poses carry no sword at all.
----------------------------------------------------------------------
local DIR_VEC = { down = {0,1}, up = {0,-1}, left = {-1,0}, right = {1,0} }

local function drawFist(img, facing, phase, bob)
  local d = DIR_VEC[facing]
  local reach = math.sin(phase * math.pi) * S * 0.55
  -- Was the literal 30, the same point SW_CY names. Shares it now so the fist
  -- and the blade cannot end up anchored to different places.
  local cy0 = SW_CY + bob * S
  local cx, cy = SW_CX + d[1]*reach, cy0 + d[2]*reach
  local r = S * 0.095
  -- forearm back to the body
  linePx(img, SW_CX + d[1]*5, cy0 + d[2]*5, cx, cy, r*1.25, OUTLINE)
  linePx(img, SW_CX + d[1]*5, cy0 + d[2]*5, cx, cy, r*0.75, LEATHER)
  linePx(img, SW_CX + d[1]*6, cy0 + d[2]*6, cx - d[1]*r*1.4, cy - d[2]*r*1.4, r*0.4, STEEL_L)
  -- fist
  ellipsePx(img, cx, cy, r*1.35, r*1.35, OUTLINE)
  ellipsePx(img, cx, cy, r*1.00, r*1.00, SKIN_D)
  ellipsePx(img, cx - r*0.22, cy - r*0.22, r*0.70, r*0.70, SKIN)
end

-- Mid-air pose. The body keeps its normal proportions so the renderer's real
-- player.z can lift it cleanly; only the legs and arms change silhouette here.
local function drawJumpPose(img, facing, phase, bob)
  local d = DIR_VEC[facing]
  local side = { -d[2], d[1] }
  local tuck = math.sin(phase * math.pi)
  local cy0 = SW_CY + bob * S
  local lift = S * (0.04 + tuck * 0.09)

  -- Arms open for balance, with the leading hand slightly higher.
  for sign = -1, 1 do
    local spread = S * (0.17 + tuck * 0.04)
    local handX = SW_CX + side[1] * sign * spread + d[1] * S * 0.06
    local handY = cy0 + side[2] * sign * spread + d[2] * S * 0.06 - lift
    linePx(img, SW_CX + side[1] * sign * 5, cy0 + side[2] * sign * 5,
                handX, handY, S * 0.10, OUTLINE)
    linePx(img, SW_CX + side[1] * sign * 5, cy0 + side[2] * sign * 5,
                handX, handY, S * 0.060, LEATHER)
    ellipsePx(img, handX, handY, S * 0.075, S * 0.075, SKIN_D)
  end

  -- Tucked knees and boots, alternating slightly so the loop has a clear rhythm.
  for sign = -1, 1 do
    local kneeX = SW_CX + side[1] * sign * S * 0.12 + d[1] * S * 0.06
    local kneeY = Y(0.79) + side[2] * sign * S * 0.12 - lift
    local bootX = kneeX + d[1] * S * 0.08
    local bootY = kneeY + d[2] * S * 0.08
    linePx(img, kneeX, kneeY, bootX, bootY, S * 0.12, OUTLINE)
    linePx(img, kneeX, kneeY, bootX, bootY, S * 0.07, LEATHER)
    ellipsePx(img, bootX, bootY, S * 0.09, S * 0.06, LEATHER_D)
  end
end

-- Compact recurved bow. The string pulls back through the five fire frames and
-- the arrow stays nocked until release, so the action reads at low frame rates.
local function drawBow(img, facing, phase, bob)
  local d = DIR_VEC[facing]
  local side = { -d[2], d[1] }
  local handX = SW_CX + d[1] * S * 0.15
  local handY = SW_CY + d[2] * S * 0.15 + bob * S
  local bowCX = handX + d[1] * S * 0.05
  local bowCY = handY + d[2] * S * 0.02
  local span = S * 0.22
  local curve = S * 0.065
  local draw = S * (0.05 + phase * 0.12)
  local topX = bowCX + side[1] * span + d[1] * curve
  local topY = bowCY + side[2] * span + d[2] * curve
  local botX = bowCX - side[1] * span + d[1] * curve
  local botY = bowCY - side[2] * span + d[2] * curve
  local stringX = bowCX - d[1] * draw
  local stringY = bowCY - d[2] * draw

  -- Arms reach into a two-handed draw stance.
  linePx(img, SW_CX + side[1] * S * 0.08, SW_CY + side[2] * S * 0.08 + bob*S,
              bowCX, bowCY, S * 0.12, OUTLINE)
  linePx(img, SW_CX + side[1] * S * 0.08, SW_CY + side[2] * S * 0.08 + bob*S,
              bowCX, bowCY, S * 0.07, LEATHER)
  linePx(img, SW_CX - side[1] * S * 0.08, SW_CY - side[2] * S * 0.08 + bob*S,
              stringX, stringY, S * 0.10, OUTLINE)
  linePx(img, SW_CX - side[1] * S * 0.08, SW_CY - side[2] * S * 0.08 + bob*S,
              stringX, stringY, S * 0.055, LEATHER)

  -- Bow limbs, string, and arrow shaft. A dark pass keeps the silhouette crisp
  -- against bright terrain; the warm pass picks up the portrait's equipment.
  linePx(img, topX, topY, bowCX, bowCY, S * 0.075, OUTLINE)
  linePx(img, bowCX, bowCY, botX, botY, S * 0.075, OUTLINE)
  linePx(img, topX, topY, bowCX, bowCY, S * 0.040, GOLD_D)
  linePx(img, bowCX, bowCY, botX, botY, S * 0.040, GOLD)
  linePx(img, topX, topY, stringX, stringY, S * 0.018, STEEL_L)
  linePx(img, stringX, stringY, botX, botY, S * 0.018, STEEL_L)

  local arrowEndX = stringX + d[1] * S * 0.42
  local arrowEndY = stringY + d[2] * S * 0.42
  linePx(img, stringX - d[1] * S * 0.10, stringY - d[2] * S * 0.10,
              arrowEndX, arrowEndY, S * 0.040, OUTLINE)
  linePx(img, stringX - d[1] * S * 0.08, stringY - d[2] * S * 0.08,
              arrowEndX, arrowEndY, S * 0.018, STEEL_H)
  linePx(img, arrowEndX, arrowEndY,
              arrowEndX - d[1] * S * 0.06 + side[1] * S * 0.04,
              arrowEndY - d[2] * S * 0.06 + side[2] * S * 0.04, S * 0.018, STEEL_H)
  linePx(img, arrowEndX, arrowEndY,
              arrowEndX - d[1] * S * 0.06 - side[1] * S * 0.04,
              arrowEndY - d[2] * S * 0.06 - side[2] * S * 0.04, S * 0.018, STEEL_H)
end

-- Swimming keeps the upper body recognizable while render.js clips the lower
-- half at the waterline. Alternating paddles make it read as movement, not a
-- standing sprite behind a translucent tile.
local function drawSwimPose(img, facing, phase, bob)
  local d = DIR_VEC[facing]
  local side = { -d[2], d[1] }
  local stroke = math.sin(phase * math.pi * 2)
  local cy0 = SW_CY + bob * S
  for sign = -1, 1 do
    local reach = S * (0.13 + 0.08 * math.max(0, stroke * sign))
    local handX = SW_CX + d[1] * S * 0.05 + side[1] * sign * reach
    local handY = cy0 + d[2] * S * 0.05 + side[2] * sign * reach - S * 0.08
    linePx(img, SW_CX + side[1] * sign * S * 0.08, cy0 + side[2] * sign * S * 0.08,
                handX, handY, S * 0.11, OUTLINE)
    linePx(img, SW_CX + side[1] * sign * S * 0.08, cy0 + side[2] * sign * S * 0.08,
                handX, handY, S * 0.06, LEATHER)
    ellipsePx(img, handX, handY, S * 0.075, S * 0.075, SKIN_D)
  end
end

-- Short alternating hand motion for the existing CLIMB ramp state.
local function drawClimbPose(img, facing, phase, bob)
  local d = DIR_VEC[facing]
  local side = { -d[2], d[1] }
  local stroke = math.sin(phase * math.pi * 2)
  local cy0 = SW_CY + bob * S
  for sign = -1, 1 do
    local handX = SW_CX + side[1] * sign * S * 0.14 + d[1] * S * 0.04
    local handY = cy0 + side[2] * sign * S * 0.14 + d[2] * S * 0.04 - S * (0.06 + stroke * sign * 0.04)
    linePx(img, SW_CX + side[1] * sign * 4, cy0 + side[2] * sign * 4,
                handX, handY, S * 0.11, OUTLINE)
    linePx(img, SW_CX + side[1] * sign * 4, cy0 + side[2] * sign * 4,
                handX, handY, S * 0.06, LEATHER)
    ellipsePx(img, handX, handY, S * 0.07, S * 0.07, SKIN_D)
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
    swing = math.sin(t * math.pi * 2) * 0.045
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
      swing = math.sin(t * math.pi * 2) * 0.045
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

  drawCloak(img, sway, bob)
  -- Lift the legs inside the authored frame as well as lifting the whole frame
  -- with player.z. This makes a hop read as knees tucked, not a standing pose
  -- translated upward.
  drawLegs(img, facing, swing, bob + (airborne and -0.12 or 0))
  drawTorso(img, facing, bob)
  -- Bow and swim poses use both arms, so hiding the shield keeps those silhouettes
  -- readable. The armed jump and climb retain the signature tree shield.
  if not BOW_KINDS[kind] and not SWIM_KINDS[kind] then
    drawShield(img, facing, bob)
  end
  drawHead(img, facing, bob)
  outlineSilhouette(img, OUTLINE)

  if punchPhase then
    drawFist(img, facing, punchPhase, bob)
  elseif kind == 'jump' or kind == 'jump_armed' or kind == 'jump_bow' then
    if kind == 'jump_bow' then
      drawBow(img, facing, 0.72, bob)
    else
      drawJumpPose(img, facing, actionPhase, bob)
      if kind == 'jump_armed' then
        drawBlade(img, IDLE_ANGLE[facing], bob, false, IDLE_PIVOT[facing][1], IDLE_PIVOT[facing][2])
      end
    end
  elseif kind == 'swim' then
    drawSwimPose(img, facing, actionPhase, bob)
  elseif CLIMB_KINDS[kind] then
    drawClimbPose(img, facing, actionPhase, bob)
    if kind == 'climb_armed' then
      drawBlade(img, IDLE_ANGLE[facing], bob, false, IDLE_PIVOT[facing][1], IDLE_PIVOT[facing][2])
    end
  elseif BOW_KINDS[kind] then
    drawBow(img, facing, actionPhase, bob)
  elseif ARMED[kind] then
    drawBlade(img, a, bob, trail, pcx, pcy)
  end
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
  { 'walk_bow',   N_WALK, 0.11  },
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

af:write("// GENERATED by tools/make-hero-sheet.lua. Do not edit by hand.\n")
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
af:write(string.format("  cols: %d,\n", PER_DIR))
-- Row per direction, in this script's DIRS order, which is the order the frames
-- were written in and therefore the order the sheet rows come out in.
af:write("  dirRow: {")
for d = 1, #DIRS do
  af:write(string.format("%s %s: %d", d > 1 and "," or "", DIRS[d], d - 1))
end
af:write(" },\n")
-- anim -> [startColumn, frameCount, msPerFrame]. Columns are relative to the
-- start of a direction's row, which is how the blit indexes them.
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
