// Behavioural verifier for villager-sprite.js. Exit 0 only if every check passes.
//
// Every check here exists because a structural check missed the corresponding
// bug in a previous run. In particular:
//   * "two different palettes must produce different pixels" catches a tint
//     function that ignores its palette arguments and shades the mask instead.
//   * "moving sx must move the sprite by the same amount" catches a draw that
//     takes its destination from the SOURCE frame coordinate.
// Both of those files parsed cleanly and had every expected function.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const H = require('./sprite-harness.js');

const G = require('path').join(__dirname, '..');
const SCRATCH = __dirname;

const fails = [];
const ok = (cond, msg) => { if (!cond) fails.push(msg); return cond; };

// ── load the sheet + the files under test into one sandbox ──────────────────
const sheet = H.loadRaw(path.join(SCRATCH, 'sheet.raw'), path.join(SCRATCH, 'sheet.json'));
const env = H.makeEnv(sheet);
env.console = console;
const sandbox = vm.createContext(env);

// Both files are concatenated into ONE script before running.
//
// They have to be. A top-level `const` in a vm script lands in that script's
// own lexical scope, not on the sandbox object — so running them separately
// leaves villager-sprite.js unable to see VILLAGER_ATLAS, and leaves the
// verifier unable to see either. This is the same reason `window.ctx = g` does
// not work in the real game: config.js declares `let ctx`, which is a lexical
// binding and not a property of window.
//
// The trailing export block is what bridges that scope back out. `ctx` is
// deliberately NOT declared anywhere here, so a bare `ctx` inside the loader
// resolves to the sandbox global and the verifier can swap it per probe.
const parts = [];
for (const f of ['villager-atlas.js', 'villager-sprite.js']) {
  const p = path.join(G, f);
  if (!fs.existsSync(p)) { console.log('FAIL\n  - missing ' + f); process.exit(1); }
  parts.push(fs.readFileSync(p, 'utf8'));
}
parts.push(`
  globalThis.__api = {
    VILLAGER_ATLAS: typeof VILLAGER_ATLAS !== 'undefined' ? VILLAGER_ATLAS : undefined,
    villagerSheetReady:  typeof villagerSheetReady  !== 'undefined' ? villagerSheetReady  : undefined,
    villagerFrameXY:     typeof villagerFrameXY     !== 'undefined' ? villagerFrameXY     : undefined,
    villagerTinted:      typeof villagerTinted      !== 'undefined' ? villagerTinted      : undefined,
    drawVillagerSprite:  typeof drawVillagerSprite  !== 'undefined' ? drawVillagerSprite  : undefined,
  };
`);
try {
  vm.runInContext(parts.join('\n;\n'), sandbox, { filename: 'villager-sprite.bundle.js' });
} catch (e) {
  console.log('FAIL\n  - loading threw: ' + e.message);
  process.exit(1);
}
const S = sandbox.__api;
S.ctx = undefined;
// probes assign the live context onto the sandbox global, not onto S
const setCtx = (g) => { sandbox.ctx = g; };

// ── 1. required entry points ────────────────────────────────────────────────
for (const fn of ['villagerSheetReady', 'villagerFrameXY', 'villagerTinted', 'drawVillagerSprite']) {
  ok(typeof S[fn] === 'function', `${fn} is not defined as a function`);
}
if (fails.length) { console.log('FAIL\n' + fails.map(f => '  - ' + f).join('\n')); process.exit(1); }

ok(S.villagerSheetReady() === true, 'villagerSheetReady() is false after the image loaded');

// ── 2. frame indexing wraps by sheetCols ────────────────────────────────────
const A = S.VILLAGER_ATLAS;
{
  // Accept either field naming. The spec asks for {frameX, frameY} — named that
  // so a source position can never be confused with a destination — but this
  // check is about the ARITHMETIC, not the property names, and it failed a
  // correct file once purely because the spec's contract changed underneath it.
  const xy = p => ({ x: p.frameX !== undefined ? p.frameX : p.x,
                     y: p.frameY !== undefined ? p.frameY : p.y });
  const a = xy(S.villagerFrameXY('down', 0)), b = xy(S.villagerFrameXY('down', 1));
  ok(a.x === 0 && a.y === 0, `frame(down,0) = ${JSON.stringify(a)}, expected {0,0}`);
  ok(b.x === A.frame && b.y === 0, `frame(down,1) = ${JSON.stringify(b)}, expected {${A.frame},0}`);
  const last = xy(S.villagerFrameXY('down', A.perDir - 1));
  ok(last.x + A.frame <= sheet.width && last.y + A.frame <= sheet.height,
     `frame(down,${A.perDir - 1}) = ${JSON.stringify(last)} falls outside the ${sheet.width}x${sheet.height} sheet`);
}

// ── 3. the recolour actually uses its palette ───────────────────────────────
const KEYS = [[127,0,0],[191,0,0],[255,0,0],[0,127,0],[0,255,0],[0,0,127],[0,0,191],[0,0,255]];
const shade = (c, f) => Math.max(0, Math.min(255, Math.round(f > 1 ? c + (255 - c) * (f - 1) : c * f)));
const rgb = h => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];

function pixels(canvas) {
  return canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
}

const FARMER = ['#8a5520', '#3a2010', '#e8c8a0'];
const ELDER  = ['#445588', '#cccccc', '#d8b890'];

const tF = S.villagerTinted(...FARMER);
const tE = S.villagerTinted(...ELDER);
ok(tF && tE, 'villagerTinted returned null for a valid palette');

if (tF && tE) {
  const dF = pixels(tF), dE = pixels(tE);

  // no key colour may survive
  let leftover = 0;
  for (let i = 0; i < dF.length; i += 4) {
    if (dF[i+3] === 0) continue;
    for (const k of KEYS) if (dF[i]===k[0] && dF[i+1]===k[1] && dF[i+2]===k[2]) { leftover++; break; }
  }
  ok(leftover === 0,
     `${leftover} pixels still carry a raw key colour — the recolour missed them ` +
     `(a factor of exactly 1.00 is the usual cause, and it covers the largest area)`);

  // two palettes must NOT produce the same image
  let diff = 0;
  for (let i = 0; i < dF.length; i += 4) if (dF[i] !== dE[i] || dF[i+1] !== dE[i+1] || dF[i+2] !== dE[i+2]) diff++;
  ok(diff > 0,
     'two different palettes produced identical pixels — villagerTinted is ignoring ' +
     'its robe/hair/skin arguments and shading the mask instead of the target colour');

  // and the shades must be the target colour, not the key colour
  const [robe, hair, skin] = FARMER.map(rgb);
  const want = {
    robe_d: [robe, 0.62], robe_m: [robe, 1.00], robe_l: [robe, 1.28],
    hair_d: [hair, 0.70], hair_m: [hair, 1.00],
    skin_d: [skin, 0.72], skin_m: [skin, 1.00], skin_l: [skin, 1.22],
  };
  const seen = new Set();
  for (let i = 0; i < dF.length; i += 4) if (dF[i+3]) seen.add(dF[i]+','+dF[i+1]+','+dF[i+2]);
  for (const [name, [tgt, f]] of Object.entries(want)) {
    const exp = tgt.map(c => shade(c, f)).join(',');
    ok(seen.has(exp), `no pixel at ${name} = ${exp} (target colour shaded by ${f})`);
  }

  // cached, not rebuilt
  ok(S.villagerTinted(...FARMER) === tF, 'villagerTinted is not caching by palette');
}

// bad palette must be refused rather than throwing
let threw = false, bad;
try { bad = S.villagerTinted('nonsense', '#ffffff', '#000000'); } catch (e) { threw = true; }
ok(!threw, 'villagerTinted threw on a malformed colour instead of returning null');
ok(bad === null || bad === undefined, 'villagerTinted accepted a malformed colour');

// ── 4. the draw honours sx/sy ───────────────────────────────────────────────
function probe(sx, sy, s) {
  const c = new H.Canvas(); c.width = 240; c.height = 160;
  const g = c.getContext('2d');
  setCtx(g);
  const drew = S.drawVillagerSprite({ id: 3, robe: FARMER[0], hair: FARMER[1], skin: FARMER[2] },
                                    sx, sy, s, 'down', false);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  let x0 = 1e9, x1 = -1, y1 = -1, n = 0;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    if (d[(y * c.width + x) * 4 + 3] > 0) { n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y > y1) y1 = y; }
  }
  return { drew, x0, x1, y1, n };
}

const TS = A.body;
const p1 = probe(20, 40, TS), p2 = probe(90, 40, TS);
ok(p1.drew !== false, 'drawVillagerSprite returned false for a ready sheet and valid villager');
ok(p1.n > 0, 'drawVillagerSprite drew nothing');
ok(p2.x0 - p1.x0 === 70,
   `moving sx by 70 moved the sprite by ${p2.x0 - p1.x0}px — the destination X is not ` +
   `derived from sx (a common cause: using the SOURCE frame x from villagerFrameXY)`);

const p3 = probe(20, 40, TS);
ok(p3.y1 === p1.y1, 'vertical position is unstable between identical calls');
// Soles land on the TILE BOTTOM, sy + s, plus at most 1px of outline.
//
// Not sy + footF*body — that mixes a frame-space fraction with a screen offset,
// and this check asserted it on the first pass and failed correct code. The
// footF term cancels out of the anchoring entirely:
//   sole = destY + (bodyOY + footF*body)*k
//        = sy + s*(1 - footF) - bodyOY*k + bodyOY*k + footF*body*k
//        = sy + s*(1 - footF) + footF*s        (since k = s/body)
//        = sy + s
// which is the point: footF decides where the soles sit INSIDE the art, and the
// anchoring exists to put that row on the ground whatever value it takes.
const wantSole = 40 + TS;
ok(p1.y1 >= wantSole - 1.5 && p1.y1 <= wantSole + 1.5,
   `sole row at ${p1.y1}, expected ~${wantSole} (the tile bottom, sy + s) — villager floats or sinks`);

// smoothing flag restored
{
  const c = new H.Canvas(); c.width = 200; c.height = 140;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = true;
  setCtx(g);
  S.drawVillagerSprite({ id: 1, robe: FARMER[0], hair: FARMER[1], skin: FARMER[2] }, 20, 40, TS, 'down', false);
  ok(g.imageSmoothingEnabled === true, 'drawVillagerSprite did not restore ctx.imageSmoothingEnabled');
}

// ── 5. degrade, do not throw ────────────────────────────────────────────────
try {
  const r = S.drawVillagerSprite({ id: 1 }, 20, 40, TS, 'down', false);
  ok(r === false, 'drawVillagerSprite should return false for a villager with no palette');
} catch (e) {
  ok(false, 'drawVillagerSprite threw on a villager with no palette: ' + e.message);
}
try {
  S.drawVillagerSprite({ id: 1, robe: FARMER[0], hair: FARMER[1], skin: FARMER[2] },
                       20, 40, TS, 'sideways', false);
} catch (e) {
  ok(false, 'drawVillagerSprite threw on an unknown facing: ' + e.message);
}

if (fails.length) {
  console.log('FAIL (' + fails.length + ')');
  for (const f of fails) console.log('  - ' + f);
  process.exit(1);
}
console.log('PASS — recolour uses the palette, frames index in-bounds, draw honours sx/sy, degrades cleanly');
