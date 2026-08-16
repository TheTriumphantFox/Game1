// ─── Performance readout ──────────────────────────────────────────────────────
// An opt-in on-screen timer for render(), built for one job: measuring the 2.5D
// renderer on a real phone at TILE_PX 24, which is the worst case for the depth
// merge and the one number a desktop cannot answer.
//
// OFF unless the URL ends in #perf. That is the toggle on purpose: a phone has
// no console and no spare keyboard, every gesture in this game is already spoken
// for, and a hash costs nothing to type and nothing to leave in the codebase.
// With no hash this file wraps nothing and draws nothing.
//
// Loaded after render.js so `render` exists to wrap, and before main.js so the
// wrapper is installed before the frame loop captures anything.

const PERF_ON = typeof location !== 'undefined' &&
                /(^|[#&])perf\b/.test(location.hash || '');

if (PERF_ON) (function () {
  const SAMPLES = 120;          // ~2s at 60fps, enough to ride out a GC pause
  const times = [];             // render() ms, newest last
  let extruded = 0;             // tall tiles drawn this frame
  let lastExtruded = 0;

  // Count extrusions without paying for a wrapper on the hot path when the HUD
  // is off: this whole block only runs under the hash.
  if (typeof drawTileExtrusion === 'function') {
    const realExtrude = drawTileExtrusion;
    drawTileExtrusion = function () {
      extruded++;
      return realExtrude.apply(this, arguments);
    };
  }

  const pct = (sorted, p) => sorted.length
    ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : 0;

  function drawReadout() {
    const sorted = times.slice().sort((a, b) => a - b);
    const med = pct(sorted, 0.5), p95 = pct(sorted, 0.95), worst = sorted[sorted.length - 1] || 0;
    // 16.7ms is the 60fps frame budget every measurement in this project is
    // quoted against, so show the share of it rather than a bare millisecond
    // count that means nothing on an unfamiliar device.
    const share = Math.round((med / 16.7) * 100);
    const lines = [
      'render  ' + med.toFixed(2) + ' ms   (' + share + '% of 16.7)',
      'p95 ' + p95.toFixed(2) + '   worst ' + worst.toFixed(2),
      'TILE_PX ' + TILE_PX + '   extruded ' + lastExtruded,
      'samples ' + times.length + '/' + SAMPLES
    ];

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    let w = 0;
    for (const l of lines) w = Math.max(w, ctx.measureText(l).width);
    const pad = 8, x = 10, y = 10, lh = 17;
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(x, y, w + pad * 2, lines.length * lh + pad * 2);
    // Green under half the budget, amber past it, red past the whole thing.
    ctx.fillStyle = med > 16.7 ? '#ff5555' : med > 8.35 ? '#ffcc44' : '#66dd77';
    ctx.fillText(lines[0], x + pad, y + pad);
    ctx.fillStyle = '#cdd3dc';
    for (let i = 1; i < lines.length; i++) ctx.fillText(lines[i], x + pad, y + pad + i * lh);
    ctx.restore();
  }

  // Wrap render() rather than editing it, so nothing in the renderer has to know
  // this exists and the file can be deleted without leaving a trace behind.
  const realRender = render;
  render = function () {
    extruded = 0;
    const t0 = performance.now();
    realRender.apply(this, arguments);
    const dt = performance.now() - t0;
    lastExtruded = extruded;
    // Timed BEFORE the readout is drawn, so the HUD never measures itself.
    times.push(dt);
    if (times.length > SAMPLES) times.shift();
    drawReadout();
  };

  if (typeof console !== 'undefined' && console.log) {
    console.log('perf HUD on (#perf). Zoom out to TILE_PX 24 for the worst case.');
  }
})();
