// ─── Sound effects ────────────────────────────────────────────────────────────
// Every game sound except two recorded ones (the boss scream in player.js and
// the dragon roar in prologue.js) is synthesized here from the voices the music
// already uses (musicVoices, music.js): pulse waves at three duty cycles, the
// stepped NES triangle, and the two LFSR noise modes. That keeps the effects in
// the soundtrack's palette, adds no audio files, and works over file://, where
// a page cannot fetch its own sibling files.
//
// One entry point: sfx('name'). It is silent before the first click or key (the
// browser rule unlockMusic in music.js already handles), when muted, and at
// volume 0. Effects go to their own bus straight to the speakers, not under the
// music's master, so muting the music leaves them on. The Sound effects slider
// (sfxGain, config.js) sets each sound's level as it fires.
//
// Every number below (pitches, lengths, levels) was set by eye and by the peak
// table in sfx-check.html, not by ear. Tune them there.

const SFX_MAX_VOICES = 10;   // sounds allowed to ring at once; a crowd fight stays readable
const SFX_GAP_MS = 45;       // the same sound can't restart sooner than this

// 'C5' → Hz, through music.js's own note parser so both files read pitch alike.
function sfxHz(n) { return 440 * Math.pow(2, (parseNoteName(n) - 69) / 12); }

// One oscillator note. `f1` sweeps the pitch (exponentially) across the note.
// The envelope rises over `attack`, holds for `hold` of the length, then decays
// exponentially to silence at the end. `vib` adds a light vibrato in cents.
function sfxOsc(ctx, out, wave, t, dur, f0, f1, vol, o) {
  o = o || {};
  const osc = ctx.createOscillator();
  osc.setPeriodicWave(wave);
  osc.frequency.setValueAtTime(f0, t);
  if (f1 && f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain();
  const a = o.attack || 0.004;
  const holdEnd = t + Math.max(a, dur * (o.hold || 0));
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + a);
  g.gain.setValueAtTime(vol, holdEnd);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  if (o.vib) {
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.frequency.value = 6;
    lg.gain.value = o.vib;
    lfo.connect(lg); lg.connect(osc.detune);
    lfo.start(t); lfo.stop(t + dur + 0.02);
  }
  osc.connect(g); g.connect(out);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

// A burst of noise. `r0` to `r1` sweeps the playback rate (the pitch of the
// hiss); `lp` or `bp` is [startHz, endHz] for a low-pass or band-pass filter.
function sfxNoise(ctx, out, buf, t, dur, r0, r1, vol, o) {
  o = o || {};
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.playbackRate.setValueAtTime(r0, t);
  if (r1 && r1 !== r0) src.playbackRate.exponentialRampToValueAtTime(r1, t + dur);
  let node = src;
  const filt = o.lp ? ['lowpass', o.lp] : o.bp ? ['bandpass', o.bp] : null;
  if (filt) {
    const f = ctx.createBiquadFilter();
    f.type = filt[0];
    f.Q.value = o.q || (filt[0] === 'bandpass' ? 2 : 0.7);
    f.frequency.setValueAtTime(filt[1][0], t);
    if (filt[1][1]) f.frequency.exponentialRampToValueAtTime(filt[1][1], t + dur);
    src.connect(f);
    node = f;
  }
  const g = ctx.createGain();
  const a = o.attack || 0.003;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + a);
  if (o.hold) g.gain.setValueAtTime(vol, t + dur * o.hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  node.connect(g); g.connect(out);
  // Start somewhere different in the loop each time so no two hits are identical.
  src.start(t, (t * 7919) % buf.duration);
  src.stop(t + dur + 0.02);
}

// A run of short notes, `step` seconds apart, each `len` long.
function sfxSeq(ctx, out, wave, t, notes, step, len, vol, o) {
  notes.forEach((n, i) => { if (n) sfxOsc(ctx, out, wave, t + i * step, len, sfxHz(n), null, vol, o); });
}

// ─── The sounds ───────────────────────────────────────────────────────────────
// vol:  the sound's level with the slider at 100 (sfxGain squares the slider).
// len:  seconds until it is silent; the voice cap and the offline render use it.
// duck: [ms, depth] to dip the music under it (musicDuck), for the big moments.
// group: where sfx-check.html files it.
const SFX = {
  // ── Combat ──
  swing: { group: 'combat', vol: 0.75, len: 0.14,
    play: (c, o, v, t) => sfxNoise(c, o, v.noiseLong, t, 0.14, 0.5, 1.2, 0.6, { bp: [700, 2600], q: 1.2, attack: 0.03 }) },
  // Mostly noise: a pitched sweep on top read as hollow (hm, 2026-11-16).
  hit: { group: 'combat', vol: 0.5, len: 0.1,
    play: (c, o, v, t) => {
      sfxNoise(c, o, v.noiseLong, t, 0.09, 0.9, 0.35, 0.9, { lp: [5000, 1200] });
      sfxNoise(c, o, v.noiseShort, t, 0.025, 0.7, 0.5, 0.35);   // the crack on contact
      sfxOsc(c, o, v.triangle, t, 0.045, 130, 55, 0.6);          // a short thump for weight
    } },
  punch: { group: 'combat', vol: 0.55, len: 0.1,
    play: (c, o, v, t) => {
      sfxOsc(c, o, v.triangle, t, 0.1, 170, 60, 1);
      sfxNoise(c, o, v.noiseLong, t, 0.04, 0.3, 0.2, 0.4, { lp: [1200] });
    } },
  arrow: { group: 'combat', vol: 0.4, len: 0.12,
    play: (c, o, v, t) => {
      sfxOsc(c, o, v.triangle, t, 0.06, 520, 300, 0.8);
      sfxNoise(c, o, v.noiseLong, t + 0.01, 0.11, 1.0, 0.6, 0.35, { bp: [3500, 1500], q: 3 });
    } },
  arrowHit: { group: 'combat', vol: 0.45, len: 0.08,
    play: (c, o, v, t) => {
      sfxNoise(c, o, v.noiseShort, t, 0.04, 1.2, 0.8, 0.5);
      sfxOsc(c, o, v.triangle, t, 0.08, 420, 180, 0.8);
    } },
  // An airy toss, falling in pitch as the bomb arcs away. No tone in it, so it
  // can't be mistaken for the door's knock; lower and falling, unlike the
  // sword swing's rising whoosh.
  bombThrow: { group: 'combat', vol: 0.7, len: 0.18,
    play: (c, o, v, t) => sfxNoise(c, o, v.noiseLong, t, 0.18, 0.9, 0.4, 0.8, { bp: [1800, 420], q: 1.6, attack: 0.015 }) },
  blast: { group: 'combat', vol: 0.34, len: 0.75, duck: [500, 0.35],
    play: (c, o, v, t) => {
      sfxOsc(c, o, v.triangle, t, 0.35, 120, 32, 1);
      sfxNoise(c, o, v.noiseLong, t, 0.75, 0.35, 0.05, 0.9, { lp: [5000, 250] });
    } },
  hurt: { group: 'combat', vol: 0.5, len: 0.18, gap: 120,
    play: (c, o, v, t) => {
      sfxOsc(c, o, v.pulse[0.5], t, 0.16, 700, 180, 0.45);
      sfxNoise(c, o, v.noiseLong, t, 0.06, 0.5, 0.3, 0.4, { lp: [2500] });
    } },
  block: { group: 'combat', vol: 0.6, len: 0.3,
    play: (c, o, v, t) => {
      sfxOsc(c, o, v.pulse[0.25], t, 0.3, sfxHz('G6'), null, 0.35);
      sfxOsc(c, o, v.pulse[0.125], t + 0.03, 0.27, sfxHz('D7'), null, 0.25);
    } },
  // A hard, bright burst that drops fast, over a low punch.
  kill: { group: 'combat', vol: 0.33, len: 0.3,
    play: (c, o, v, t) => {
      sfxNoise(c, o, v.noiseLong, t, 0.3, 1.0, 0.12, 0.9, { lp: [9000, 600], attack: 0.001 });
      sfxNoise(c, o, v.noiseShort, t, 0.06, 0.9, 0.4, 0.4, { attack: 0.001 });
      sfxOsc(c, o, v.pulse[0.5], t, 0.13, 900, 70, 0.4, { attack: 0.001 });
      sfxOsc(c, o, v.triangle, t, 0.16, 150, 38, 0.9, { attack: 0.001 });
    } },
  death: { group: 'combat', vol: 0.33, len: 1.5, duck: [1600, 0.15], gap: 1000,
    play: (c, o, v, t) => {
      sfxSeq(c, o, v.pulse[0.5], t, ['E5', 'C5', 'A4', 'F4', 'D4', 'B3'], 0.13, 0.16, 0.4);
      sfxOsc(c, o, v.triangle, t + 0.78, 0.7, sfxHz('E2'), sfxHz('A1'), 1, { hold: 0.3 });
    } },
  golem: { group: 'combat', vol: 0.35, len: 0.9, duck: [600, 0.5],
    play: (c, o, v, t) => {
      sfxOsc(c, o, v.triangle, t, 0.9, 50, 75, 1, { attack: 0.15, hold: 0.4 });
      sfxNoise(c, o, v.noiseLong, t, 0.9, 0.08, 0.12, 0.6, { lp: [500], attack: 0.15, hold: 0.4 });
    } },
  // Soft and plant-like: a muffled pod pop, then a slow breathy puff of spores
  // with a faint leafy rustle on top. Nothing bright or sharp.
  bloom: { group: 'combat', vol: 0.4, len: 0.7,
    play: (c, o, v, t) => {
      sfxOsc(c, o, v.triangle, t, 0.09, 170, 115, 0.5, { attack: 0.01 });
      sfxNoise(c, o, v.noiseLong, t + 0.02, 0.65, 0.35, 0.2, 0.7, { lp: [1400, 300], attack: 0.08 });
      sfxNoise(c, o, v.noiseLong, t + 0.05, 0.45, 0.6, 0.4, 0.15, { bp: [2200, 1500], q: 0.8, attack: 0.06 });
    } },

  // ── Progress ──
  pickup: { group: 'progress', vol: 0.35, len: 0.12, gap: 60,
    play: (c, o, v, t) => {
      sfxOsc(c, o, v.pulse[0.5], t, 0.05, sfxHz('B5'), null, 0.4, { hold: 0.6 });
      sfxOsc(c, o, v.pulse[0.5], t + 0.05, 0.07, sfxHz('E6'), null, 0.4, { hold: 0.4 });
    } },
  chest: { group: 'progress', vol: 0.4, len: 0.55,
    play: (c, o, v, t) => {
      sfxSeq(c, o, v.triangle, t, ['C5', 'E5', 'G5', 'C6'], 0.07, 0.09, 0.9);
      sfxOsc(c, o, v.pulse[0.125], t + 0.28, 0.26, sfxHz('E7'), null, 0.25, { vib: 20 });
    } },
  potion: { group: 'progress', vol: 0.4, len: 0.32,
    play: (c, o, v, t) => {
      for (let i = 0; i < 3; i++) sfxOsc(c, o, v.triangle, t + i * 0.09, 0.08, 300 + i * 90, 520 + i * 120, 0.9);
    } },
  levelUp: { group: 'progress', vol: 0.4, len: 1.0, duck: [900, 0.25], gap: 400,
    play: (c, o, v, t) => {
      sfxSeq(c, o, v.pulse[0.25], t, ['C5', 'E5', 'G5', 'C6'], 0.08, 0.09, 0.45);
      sfxOsc(c, o, v.pulse[0.25], t + 0.32, 0.65, sfxHz('E6'), null, 0.4, { hold: 0.5, vib: 18 });
      sfxOsc(c, o, v.pulse[0.5], t + 0.32, 0.65, sfxHz('C6'), null, 0.3, { hold: 0.5 });
      sfxSeq(c, o, v.triangle, t, ['C3', 'G3', 'C4'], 0.16, 0.2, 0.9);
    } },
  forge: { group: 'progress', vol: 0.4, len: 0.7,
    play: (c, o, v, t) => {
      for (const at of [0, 0.22]) {
        sfxNoise(c, o, v.noiseShort, t + at, 0.05, 1.4, 1.0, 0.6);
        sfxOsc(c, o, v.pulse[0.125], t + at, 0.45, sfxHz('A6'), null, 0.3);
        sfxOsc(c, o, v.pulse[0.25], t + at, 0.45, sfxHz('E7') * 1.01, null, 0.2);   // slightly sharp: the ring of struck steel
      }
    } },
  reward: { group: 'progress', vol: 0.3, len: 0.6, duck: [500, 0.35], gap: 300,
    play: (c, o, v, t) => {
      sfxSeq(c, o, v.pulse[0.25], t, ['G4', 'C5', 'E5'], 0.07, 0.08, 0.45);
      sfxOsc(c, o, v.pulse[0.25], t + 0.21, 0.38, sfxHz('G5'), null, 0.45, { hold: 0.5 });
      sfxOsc(c, o, v.triangle, t + 0.21, 0.38, sfxHz('C4'), null, 0.9, { hold: 0.5 });
    } },
  shrineOpen: { group: 'progress', vol: 0.35, len: 1.0, duck: [800, 0.3],
    play: (c, o, v, t) => {
      sfxOsc(c, o, v.triangle, t, 0.9, 110, 220, 1, { attack: 0.1, hold: 0.5 });
      sfxSeq(c, o, v.pulse[0.125], t + 0.25, ['E6', 'A6', 'E7'], 0.12, 0.35, 0.22, { vib: 25 });
    } },
  shrineSolved: { group: 'progress', vol: 0.38, len: 1.4, duck: [1200, 0.25], gap: 1000,
    play: (c, o, v, t) => {
      sfxSeq(c, o, v.pulse[0.125], t, ['A4', 'C#5', 'E5', 'A5', 'E5', 'A5', 'C#6'], 0.09, 0.12, 0.4);
      sfxOsc(c, o, v.pulse[0.25], t + 0.63, 0.75, sfxHz('E6'), null, 0.35, { hold: 0.5, vib: 20 });
      sfxOsc(c, o, v.triangle, t, 1.35, sfxHz('A2'), null, 0.9, { hold: 0.6 });
    } },

  // ── World ──
  glide: { group: 'world', vol: 0.45, len: 0.45,
    play: (c, o, v, t) => {
      sfxOsc(c, o, v.pulse[0.5], t, 0.35, 280, 900, 0.3);
      sfxNoise(c, o, v.noiseLong, t, 0.45, 0.4, 0.9, 0.5, { bp: [500, 2400], q: 1.5, attack: 0.08 });
    } },
  land: { group: 'world', vol: 0.45, len: 0.12,
    play: (c, o, v, t) => {
      sfxOsc(c, o, v.triangle, t, 0.1, 180, 70, 0.9);
      sfxNoise(c, o, v.noiseLong, t, 0.12, 0.4, 0.2, 0.45, { lp: [1800, 500] });
    } },
  door: { group: 'world', vol: 0.4, len: 0.1,
    play: (c, o, v, t) => {
      sfxOsc(c, o, v.triangle, t, 0.09, 210, 150, 0.9);
      sfxNoise(c, o, v.noiseLong, t, 0.05, 0.3, 0.2, 0.25, { lp: [1500] });
    } },

  // ── Interface (quiet) ──
  uiOpen: { group: 'interface', vol: 0.2, len: 0.06,
    play: (c, o, v, t) => sfxOsc(c, o, v.pulse[0.25], t, 0.06, 900, 1400, 0.4) },
  uiClose: { group: 'interface', vol: 0.2, len: 0.06,
    play: (c, o, v, t) => sfxOsc(c, o, v.pulse[0.25], t, 0.06, 1400, 900, 0.4) },
  buy: { group: 'interface', vol: 0.21, len: 0.2,
    play: (c, o, v, t) => {
      sfxOsc(c, o, v.pulse[0.5], t, 0.06, sfxHz('B5'), null, 0.4, { hold: 0.7 });
      sfxOsc(c, o, v.pulse[0.5], t + 0.06, 0.14, sfxHz('E6'), null, 0.4, { hold: 0.3 });
    } },
  sell: { group: 'interface', vol: 0.21, len: 0.24,
    play: (c, o, v, t) => sfxSeq(c, o, v.pulse[0.5], t, ['E6', 'B5', 'E6'], 0.06, 0.08, 0.4, { hold: 0.5 }) },
  talk: { group: 'interface', vol: 0.22, len: 0.03,
    play: (c, o, v, t) => sfxOsc(c, o, v.pulse[0.125], t, 0.03, 1250, null, 0.4) },
  toggle: { group: 'interface', vol: 0.2, len: 0.03, gap: 80,
    play: (c, o, v, t) => sfxOsc(c, o, v.pulse[0.25], t, 0.03, 1050, null, 0.4) },
};

// ─── Playing ──────────────────────────────────────────────────────────────────
// The bus ends in a limiter. One sound peaks at 0.7 at most (sfx-check.html's
// table), but a blast over a hit over a kill can sum past 1, and the browser
// clips that hard. The compressor only acts above -6 dB, so a lone sound is
// untouched. Threshold and ratio set by eye.
function sfxMakeBus(ctx) {
  const bus = ctx.createGain();
  const lim = ctx.createDynamicsCompressor();
  lim.threshold.value = -6;
  lim.knee.value = 3;
  lim.ratio.value = 12;
  lim.attack.value = 0.002;
  lim.release.value = 0.12;
  bus.connect(lim);
  lim.connect(ctx.destination);
  return bus;
}

const _sfxLast = {};   // name → performance.now() of its last start
let _sfxEnds = [];     // audio-clock end times of the sounds still ringing

function sfx(name) {
  const def = SFX[name];
  if (!def) return;
  const ctx = (typeof musicCtx !== 'undefined') ? musicCtx : null;
  if (!ctx || ctx.state !== 'running') return;   // before the first gesture, or tab hidden
  const level = (typeof sfxGain === 'function') ? sfxGain(def.vol) : def.vol;
  if (level <= 0) return;
  const nowMs = performance.now();
  if (nowMs - (_sfxLast[name] || -1e9) < (def.gap || SFX_GAP_MS)) return;
  const t = ctx.currentTime;
  _sfxEnds = _sfxEnds.filter(e => e > t);
  if (_sfxEnds.length >= SFX_MAX_VOICES) return;
  _sfxLast[name] = nowMs;
  _sfxEnds.push(t + def.len);
  if (!ctx._sfxBus) ctx._sfxBus = sfxMakeBus(ctx);
  const g = ctx.createGain();
  g.gain.value = level;
  g.connect(ctx._sfxBus);
  try { def.play(ctx, g, musicVoices(ctx), t + 0.005); }
  catch (e) { console.warn('sfx:', name, e.message); return; }
  if (def.duck && typeof musicDuck === 'function') musicDuck(def.duck[0], def.duck[1]);
}

// ─── The dragon's roar ────────────────────────────────────────────────────────
// The one effect that is a recording: Breviceps, "Dragon: Several roars, growls
// and snarls" (freesound.org/s/479380, CC0, public domain), cut into four
// different roars so no moment repeats another. tools/cut-dragon-roars.py makes
// the files from the original download. The far one is the same kind of cut,
// muffled and given an echo, because Beat 3's line is "a long way off, a roar".
//
// Media elements, not fetch + decodeAudioData: an <audio> loads by its own path,
// which works over file://, where fetching a sibling file does not. One element
// per roar, decoded at load and rewound on replay (the scream's pattern,
// SCREAM_POOL in player.js), so there is no decode lag at the cue.
const DRAGON_ROARS = {
  //        file                          base level  music duck [ms, depth]
  // Levels set from measurement (every file is normalised to a 0.89 peak):
  // strike is the loudest moment, the far roar matches the old generated one.
  // Each duck holds for about the roar's length less its fade (the files run
  // 5.7 / 5.4 / 3.7 / 2.2 s).
  far:     { file: 'dragon-roar-far.wav',     vol: 0.65, duck: [3600, 0.2] },   // Beat 3, the warning
  strike:  { file: 'dragon-roar-strike.wav',  vol: 0.7,  duck: [4200, 0.15] },  // Beat 4, with the breath
  wake:    { file: 'dragon-roar-wake.wav',    vol: 0.9,  duck: [3000, 0.15] },  // throne room, the hoard uncoils
  wounded: { file: 'dragon-roar-wounded.wav', vol: 0.65, duck: [1800, 0.2] },   // 50% HP, before his line
  // Every fire breath in the fight, 2.4 to 3.3 s apart, so short (1.8 s), a
  // little under the scripted roars, and no duck: a dip every few seconds
  // would make the fight music pump.
  breath:  { file: 'dragon-roar-breath.wav',  vol: 0.5,  duck: null },          // each breath in the fight
};
for (const k in DRAGON_ROARS) {
  if (typeof Audio === 'undefined') break;
  const a = new Audio(DRAGON_ROARS[k].file);
  a.preload = 'auto';
  DRAGON_ROARS[k].audio = a;
}
function playDragonRoar(kind) {
  const r = DRAGON_ROARS[kind] || DRAGON_ROARS.far;
  if (!r.audio) return;
  const vol = (typeof sfxGain === 'function') ? sfxGain(r.vol) : r.vol;
  if (vol <= 0) return;
  r.audio.volume = Math.min(1, vol);
  try { r.audio.currentTime = 0; } catch (_) {}
  // Rejects before the first click or key; the scene plays on regardless.
  r.audio.play().catch(() => {});
  if (r.duck && typeof musicDuck === 'function') musicDuck(r.duck[0], r.duck[1]);
}

// ─── Offline render (verification) ────────────────────────────────────────────
// Render one sound at slider 100 to an AudioBuffer, for sfx-check.html's peak
// table. Same play function as the game, on an OfflineAudioContext.
function sfxRenderOffline(name) {
  const def = SFX[name];
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const sr = 44100;
  const ctx = new OAC(1, Math.ceil(sr * (def.len + 0.15)), sr);
  const g = ctx.createGain();
  g.gain.value = def.vol;
  g.connect(ctx.destination);
  def.play(ctx, g, musicVoices(ctx), 0.005);
  return ctx.startRendering();
}

// Peak, loudest 50 ms RMS, and audible length (until it stays under -50 dB).
function sfxMeasure(buf) {
  const d = buf.getChannelData(0), sr = buf.sampleRate;
  let peak = 0, last = 0;
  for (let i = 0; i < d.length; i++) {
    const a = Math.abs(d[i]);
    if (a > peak) peak = a;
    if (a > 0.00316) last = i;
  }
  const win = Math.floor(sr * 0.05);
  let best = 0;
  for (let s = 0; s + win <= d.length; s += Math.floor(win / 2)) {
    let sum = 0;
    for (let i = s; i < s + win; i++) sum += d[i] * d[i];
    best = Math.max(best, Math.sqrt(sum / win));
  }
  return { peak, rms: best, audible: last / sr };
}
