-- Shared low-level rasterisation helpers for tools/make-hero-sheet.lua and
-- tools/make-dragon-sheet.lua.
--
-- Both scripts draw into an Image in raw pixel space using these
-- primitives. The fraction-of-S wrappers (X/Y, polyF, ellipseF, lineF,
-- rectF) stay in each script because they close over that script's own W,
-- H, OX, OY, S, which differ between the hero and dragon sheets.
--
-- Loaded with dofile("tools/aseprite-lib.lua"), which resolves relative to
-- the process's current working directory and NOTHING else. There is no
-- fallback to the running script's own directory: invoking either script
-- with any other cwd fails with
--   cannot open tools/aseprite-lib.lua: No such file or directory
-- and exit code 127, before a single pixel is drawn. That is why both
-- header comments say "run from the repo root". It fails loudly rather
-- than silently emitting a wrong sheet, so this is a documented
-- precondition rather than a bug worth working around.

local M = {}

function M.hex(h)
  return app.pixelColor.rgba(
    tonumber(h:sub(2, 3), 16),
    tonumber(h:sub(4, 5), 16),
    tonumber(h:sub(6, 7), 16), 255)
end

----------------------------------------------------------------------
-- lighting convention
----------------------------------------------------------------------

-- Light direction both palettes were authored against: upper-left, low
-- angle. Neither script computes shading from this vector -- each palette
-- is hand-picked per surface (e.g. STEEL_D/STEEL/STEEL_L/STEEL_H, or
-- CROWN_D/CROWN/CROWN_L) -- but every highlight placement (the cuirass
-- breast curve, the pauldrons, the crown band's glint) is consistent with
-- it. ramp() below assumes this ordering when a caller lists a ramp table
-- dark-to-light.
M.LIGHT_DIR = { x = -0.55, y = -0.75, z = 0.35 }

-- Look up a shade step in an ordered dark-to-light ramp table. `t` in
-- [0,1] selects across the ramp: 0.0 is colors[1] (darkest, away from
-- M.LIGHT_DIR), 1.0 is colors[#colors] (lightest, facing it). Passing
-- (i-1)/(#colors-1) for an integer step i returns colors[i] exactly, so
-- ramp() is a drop-in replacement for a direct table index.
function M.ramp(colors, t)
  local n = #colors
  if n == 0 then return nil end
  local i = math.floor(t * (n - 1) + 0.5) + 1
  if i < 1 then i = 1 elseif i > n then i = n end
  return colors[i]
end

----------------------------------------------------------------------
-- rasteriser, parameterised over one script's own frame size
----------------------------------------------------------------------

-- Build the raw-pixel-space rasteriser for a W x H image. Each script calls
-- this once, near the top, with its own frame size.
function M.newRaster(W, H)
  local R = {}

  function R.px(img, x, y, c)
    x = math.floor(x); y = math.floor(y)
    if x < 0 or y < 0 or x >= W or y >= H then return end
    img:drawPixel(x, y, c)
  end

  function R.polyPx(img, P, c)
    local miny, maxy = 1e9, -1e9
    for i = 1, #P do
      if P[i][2] < miny then miny = P[i][2] end
      if P[i][2] > maxy then maxy = P[i][2] end
    end
    for y = math.max(0, math.floor(miny)), math.min(H - 1, math.ceil(maxy)) do
      local yc, xs, n = y + 0.5, {}, #P
      for i = 1, n do
        local j = (i % n) + 1
        local ax, ay, bx, by = P[i][1], P[i][2], P[j][1], P[j][2]
        if (ay <= yc and by > yc) or (by <= yc and ay > yc) then
          xs[#xs + 1] = ax + (yc - ay) / (by - ay) * (bx - ax)
        end
      end
      table.sort(xs)
      for k = 1, #xs - 1, 2 do
        for x = math.floor(xs[k] + 0.5), math.floor(xs[k + 1] + 0.5) - 1 do
          R.px(img, x, y, c)
        end
      end
    end
  end

  -- rot is optional (radians); omitted or 0 matches the hero sheet's
  -- original non-rotating ellipsePx exactly. The wider bounding box used
  -- when rx ~= ry only widens the scan area -- the
  -- (rxp/rx)^2+(ryp/ry)^2<=1 acceptance test still selects exactly the
  -- same pixels as the narrower, rotation-free version did.
  function R.ellipsePx(img, cx, cy, rx, ry, c, rot)
    rot = rot or 0
    local ca, sa = math.cos(-rot), math.sin(-rot)
    local rr = math.max(rx, ry)
    for y = math.max(0, math.floor(cy - rr)), math.min(H - 1, math.ceil(cy + rr)) do
      for x = math.max(0, math.floor(cx - rr)), math.min(W - 1, math.ceil(cx + rr)) do
        local ux, uy = x + 0.5 - cx, y + 0.5 - cy
        local rxp, ryp = ux * ca - uy * sa, ux * sa + uy * ca
        if (rxp / rx) ^ 2 + (ryp / ry) ^ 2 <= 1.0 then R.px(img, x, y, c) end
      end
    end
  end

  function R.linePx(img, x0, y0, x1, y1, wdt, c)
    local dx, dy = x1 - x0, y1 - y0
    local steps = math.max(1, math.ceil(math.max(math.abs(dx), math.abs(dy)) * 2))
    local r = wdt / 2
    for i = 0, steps do
      local t = i / steps
      local cx, cy = x0 + dx * t, y0 + dy * t
      for y = math.floor(cy - r), math.ceil(cy + r) do
        for x = math.floor(cx - r), math.ceil(cx + r) do
          local ddx, ddy = x + 0.5 - cx, y + 0.5 - cy
          if ddx * ddx + ddy * ddy <= r * r + 0.25 then R.px(img, x, y, c) end
        end
      end
    end
  end

  function R.outlineSilhouette(img, col)
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
          if (x > 0 and solid[y][x - 1]) or (x < W - 1 and solid[y][x + 1]) or
             (y > 0 and solid[y - 1][x]) or (y < H - 1 and solid[y + 1][x]) then
            img:drawPixel(x, y, col)
          end
        end
      end
    end
  end

  return R
end

return M
