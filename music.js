// ─── Music ────────────────────────────────────────────────────────────────────
// An NES-style chiptune engine and the rule that picks what it plays. The songs
// themselves are data in music-songs.js; this file turns that data into sound.
//
// ─── The voices ───
// Four channels, the 2A03's: two pulse waves (12.5 / 25 / 50 % duty), a 4-bit
// stepped triangle for the bass, and LFSR noise (long mode for drums, short
// mode for the metallic clicks). Plus the kick, a pitch-dropping triangle blip
// standing in for the DMC sample channel. Every waveform and both noise tables
// are built here in code — nothing is fetched, because a file:// page cannot
// fetch, and there are no audio files to ship.
//
// ─── What plays ───
// stepMusic() runs every frame from main.js's loop and DERIVES the wanted
// { track, mood } from game state, acting only when that answer changes. It is
// deliberately not a hook on map transitions: currentMapId is assigned in about
// twenty places, and the same "derive it every frame" idiom is what keeps the
// blight overlay (corruption.js) from ever getting out of step.
//
//   mood 'intense' — a live, awake enemy with `boss: true` is on the map: a
//                    region boss in its uncleared village, a Guild Quarry, a
//                    bounty elite, the woken dragon.
//   mood 'calm'    — a restored village: type 'village' and `activated`, which
//                    activateVillage() sets when the last defender falls.
//   mood 'normal'  — everything else.
//
// Each region has its own song (keyed by REGIONS[i].id). Every non-region map
// type has its own song too, and the cave / dungeon / sky-cave / grotto / shrine
// songs are transposed into the current region's key so a forest cave and a
// necrotic cave are the same tune in different keys.
//
// ─── How a mood changes ───
// All three moods of one song are arrangements of the same sections over the
// same bar grid — the melody and chords are written once; the accompaniment
// styles, tempo and lead voicing are what the mood swaps. So a mood change waits
// for the next bar line and carries on from the same section and bar rather than
// restarting. A track change fades the old song out and starts the new at bar 1.
//
// The music preference (volume, mute) is a device setting like the key bindings
// and lives in localStorage, never in a save.

const MUSIC_PREF_KEY = 'stormdrift_music';
const MUSIC_LOOKAHEAD = 0.12;     // seconds scheduled ahead of the audio clock
const MUSIC_TICK_MS = 25;         // how often the scheduler tops the queue up
const MUSIC_FADE = 0.6;           // track-change fade-out, seconds
const MUSIC_MASTER = 0.55;        // headroom under the SFX at volume 100

// Channel mix. Pulse waves are harmonically dense and read far louder than
// their gain suggests, so they sit well under the triangle.
const MUSIC_MIX = { p1: 0.15, p2: 0.10, tri: 0.34, noi: 0.30 };

// ─── Preference ───────────────────────────────────────────────────────────────
let musicPref = { volume: 70, muted: false };
(function loadMusicPref() {
  try {
    const raw = (typeof localStorage !== 'undefined') ? localStorage.getItem(MUSIC_PREF_KEY) : null;
    if (!raw) return;
    const p = JSON.parse(raw);
    if (p && typeof p.volume === 'number') musicPref.volume = Math.max(0, Math.min(100, Math.round(p.volume)));
    if (p && typeof p.muted === 'boolean') musicPref.muted = p.muted;
  } catch (_) { /* unreadable pref — keep the defaults */ }
})();
function saveMusicPref() {
  try { localStorage.setItem(MUSIC_PREF_KEY, JSON.stringify(musicPref)); } catch (_) { /* ignore */ }
}
function musicSetVolume(v) {
  musicPref.volume = Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
  saveMusicPref();
  applyMusicVolume();
}
function musicSetMuted(m) {
  musicPref.muted = !!m;
  saveMusicPref();
  applyMusicVolume();
}
function musicLevel() {
  if (musicPref.muted) return 0;
  const v = musicPref.volume / 100;
  return v * v * MUSIC_MASTER;   // perceptual curve — linear sliders feel all-or-nothing
}

// ─── Pitch, scales, chords ────────────────────────────────────────────────────
const NOTE_BASE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

// 'C#4' / 'Bb3' / 'G5' → MIDI number (C4 = 60). null if it isn't a note.
function parseNoteName(s) {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(s);
  if (!m) return null;
  let n = NOTE_BASE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return n + (parseInt(m[3], 10) + 1) * 12;
}
// 'F#' → pitch class 6.
function parsePitchClass(s) {
  const m = /^([A-G])(#|b)?$/.exec(s);
  if (!m) return null;
  return (NOTE_BASE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12;
}
function midiHz(m) { return 440 * Math.pow(2, (m - 69) / 12); }

const SCALES = {
  major:      [0, 2, 4, 5, 7, 9, 11],
  minor:      [0, 2, 3, 5, 7, 8, 10],
  dorian:     [0, 2, 3, 5, 7, 9, 10],
  phrygian:   [0, 1, 3, 5, 7, 8, 10],
  lydian:     [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  locrian:    [0, 1, 3, 5, 6, 8, 10],
  harmonic:   [0, 2, 3, 5, 7, 8, 11],
  phrydom:    [0, 1, 4, 5, 7, 8, 10],   // Phrygian dominant — the desert's Hijaz colour
  pentminor:  [0, 3, 5, 7, 10],
  pentmajor:  [0, 2, 4, 7, 9],
  whole:      [0, 2, 4, 6, 8, 10],
};

const CHORD_QUALITIES = {
  '':     [0, 4, 7],      'm':    [0, 3, 7],      '5':    [0, 7, 12],
  '7':    [0, 4, 7, 10],  'm7':   [0, 3, 7, 10],  'maj7': [0, 4, 7, 11],
  'dim':  [0, 3, 6],      'aug':  [0, 4, 8],      'm7b5': [0, 3, 6, 10],
  'dim7': [0, 3, 6, 9],   'sus2': [0, 2, 7],      'sus4': [0, 5, 7],
  'add9': [0, 4, 7, 14],  'madd9':[0, 3, 7, 14],  '6':    [0, 4, 7, 9],
  'm6':   [0, 3, 7, 9],
};
// 'Em7' / 'Bb' / 'D/F#' → { root: pitch class, tones: [semitones above root], bass }.
function parseChord(s) {
  const m = /^([A-G](?:#|b)?)([a-z0-9]*)(?:\/([A-G](?:#|b)?))?$/.exec(s);
  if (!m || !(m[2] in CHORD_QUALITIES)) return null;
  const root = parsePitchClass(m[1]);
  return { root, tones: CHORD_QUALITIES[m[2]].slice(), bass: m[3] ? parsePitchClass(m[3]) : root };
}

// The calm mood's "toward major": every minor-mode colour note (♭2 ♭3 ♭5 ♭6) is
// raised a semitone relative to the song's root. Applied note by note it maps a
// minor song onto its parallel major consistently — chords included — while ♭7
// is kept, which leaves the warm Mixolydian colour rather than a leading tone.
const BRIGHTEN = { 1: 2, 3: 4, 6: 7, 8: 9 };
function brightenNote(n, root) {
  const rel = ((n - root) % 12 + 12) % 12;
  return (rel in BRIGHTEN) ? n + (BRIGHTEN[rel] - rel) : n;
}
function brightenScale(scale) {
  return [...new Set(scale.map(s => (s in BRIGHTEN) ? BRIGHTEN[s] : s))].sort((a, b) => a - b);
}

// ─── Parsing the song text ────────────────────────────────────────────────────
// Melody: whitespace-separated tokens, one per step unless a `:n` duration is
// given. 'G4:3' is a note held 3 steps, '.:2' two steps of rest, '-:4' extends
// the previous note. '|' is a bar line for the reader and is ignored.
function parseLine(str) {
  const events = [];   // { at, n, len }
  let at = 0;
  for (const tok of String(str || '').split(/[\s|]+/)) {
    if (!tok) continue;
    const [head, durS] = tok.split(':');
    const d = durS ? parseInt(durS, 10) : 1;
    if (!(d > 0)) throw new Error(`bad duration in "${tok}"`);
    if (head === '.') { at += d; continue; }
    if (head === '-') {
      const last = events[events.length - 1];
      if (!last || last.at + last.len !== at) throw new Error(`hold "${tok}" with nothing to hold`);
      last.len += d; at += d; continue;
    }
    const n = parseNoteName(head);
    if (n === null) throw new Error(`bad note "${tok}"`);
    events.push({ at, n, len: d });
    at += d;
  }
  return { events, len: at };
}
// Chords: one token per `unit` steps ('G:2' spans two units, '-' extends).
function parseChords(str, unit) {
  const out = [];   // per-step chord objects
  for (const tok of String(str || '').split(/[\s|]+/)) {
    if (!tok) continue;
    const [head, durS] = tok.split(':');
    const d = (durS ? parseInt(durS, 10) : 1) * unit;
    let ch;
    if (head === '-') {
      ch = out[out.length - 1];
      if (!ch) throw new Error('chord hold with nothing to hold');
    } else {
      ch = parseChord(head);
      if (!ch) throw new Error(`bad chord "${tok}"`);
      ch = Object.assign({ id: out.length }, ch);
    }
    for (let i = 0; i < d; i++) out.push(ch);
  }
  return out;
}

// ─── Song → arrangement ───────────────────────────────────────────────────────
// Mood recipes. A song may override any field per mood (song.calm, song.intense).
const MOOD_RECIPES = {
  // triVol: the triangle has no volume control on the real chip, but a held
  // triangle root is the loudest thing in the mix, so calm sets it well back.
  calm:    { tempo: 0.8,  lead: { duty: 0.5,   vol: 0.55 }, harmony: 'broken', bass: 'roots',
             drums: 'none', fills: false, form: null, brighten: undefined, triVol: 0.45 },
  normal:  { tempo: 1.0,  lead: {},                         fills: false, form: null, triVol: 0.85 },
  intense: { tempo: 1.15, lead: { duty: 0.125, vol: 1.0, octUp: true }, harmony: 'thirds',
             bass: 'octaves', drums: 'intense', fills: true, form: null, triVol: 0.9 },
};

function songMoodSpec(song, mood) {
  const r = MOOD_RECIPES[mood] || MOOD_RECIPES.normal;
  const o = song[mood] || {};
  const lead = Object.assign({ duty: 0.25, vol: 0.85, vib: true }, song.lead || {}, r.lead, o.lead || {});
  const pick = k => (k in o) ? o[k] : (k in r && r[k] !== undefined && mood !== 'normal') ? r[k] : song[k];
  const defForm = mood === 'calm'
    ? (song.sections.K ? ['K'] : ['A'])
    : mood === 'intense'
      ? ['A', 'B', 'C'].filter(s => song.sections[s])
      : ['A', 'B'].filter(s => song.sections[s]);
  return {
    tempo: ('tempo' in o) ? o.tempo : r.tempo,
    lead,
    harmony: pick('harmony') || 'none',
    bass: pick('bass') || 'roots',
    drums: pick('drums') || 'none',
    fills: ('fills' in o) ? o.fills : r.fills,
    triVol: ('triVol' in o) ? o.triVol : r.triVol,
    brighten: mood === 'calm' && (('brighten' in o) ? o.brighten : !!song.calmBrighten),
    form: o.form || (song.form && song.form[mood]) || defForm,
  };
}

// Beat grouping of one bar, as step offsets: 4/4 in 16ths → [0, 4, 8, 12].
function barGroups(song) {
  const groups = song.groups || Array(Math.round(song.bar / song.beat)).fill(song.beat);
  const starts = [];
  let acc = 0;
  for (const g of groups) { starts.push(acc); acc += g; }
  return { groups, starts };
}

// Root pitch placed in a register: the lowest instance of `pc` at or above `lo`.
function placePC(pc, lo) { return lo + ((pc - lo) % 12 + 12) % 12; }
function chordTonesAt(ch, lo) {
  const r = placePC(ch.root, lo);
  return ch.tones.map(t => r + t);
}
function nearestScaleBelow(n, steps, scaleAbs) {
  // scaleAbs: sorted list of absolute MIDI scale notes; move `steps` degrees down.
  let i = scaleAbs.length - 1;
  while (i > 0 && scaleAbs[i] > n) i--;
  return scaleAbs[Math.max(0, i - steps)];
}

// ─ Bass (triangle) styles ─ Each returns events {at, n, len} for one bar.
const BASS_LO = 40;   // E2: the triangle's root register
const BASS_STYLES = {
  none: () => [],
  // Held roots, re-struck on every chord change and every other beat — the calm bass.
  roots(ctx) {
    const out = [];
    const hits = new Set([0]);
    ctx.starts.forEach((s, i) => { if (i % 2 === 0) hits.add(s); });
    for (let s = 1; s < ctx.bar; s++) if (ctx.chordAt(s) !== ctx.chordAt(s - 1)) hits.add(s);
    const arr = [...hits].sort((a, b) => a - b);
    arr.forEach((s, i) => {
      const end = (i + 1 < arr.length) ? arr[i + 1] : ctx.bar;
      out.push({ at: s, n: placePC(ctx.chordAt(s).bass, BASS_LO), len: end - s });
    });
    return out;
  },
  // Quarter-note walk: root, fifth, octave, then a chromatic approach to the next root.
  walk(ctx) {
    return ctx.starts.map((s, i) => {
      const ch = ctx.chordAt(s);
      const r = placePC(ch.bass, BASS_LO);
      const g = ctx.groups[i];
      let n;
      if (i === 0) n = r;
      else if (i === ctx.starts.length - 1) {
        const next = placePC(ctx.nextBarChord().bass, BASS_LO);
        n = (next === r) ? r + 7 : next + (next > r ? -1 : 1);
      } else n = (i % 2 === 1) ? r + 7 : r + 12;
      return { at: s, n, len: Math.max(1, g - 1) };
    });
  },
  // The key's root held under everything, struck once a bar — the desert drone.
  drone(ctx) {
    return [{ at: 0, n: placePC(ctx.keyRoot, BASS_LO), len: ctx.bar }];
  },
  // Root / octave eighths — the intense default.
  octaves(ctx) {
    const out = [];
    for (let s = 0, k = 0; s < ctx.bar; s += ctx.sub, k++) {
      const r = placePC(ctx.chordAt(s).bass, BASS_LO);
      out.push({ at: s, n: (k % 2) ? r + 12 : r, len: Math.max(1, ctx.sub - 1) });
    }
    return out;
  },
  // Root on strong beats, fifth on weak, a sixteenth pickup into each strong beat.
  march(ctx) {
    const out = [];
    ctx.starts.forEach((s, i) => {
      const r = placePC(ctx.chordAt(s).bass, BASS_LO);
      const g = ctx.groups[i];
      out.push({ at: s, n: (i % 2) ? r + 7 : r, len: Math.max(1, g - 2) });
      if (i % 2 === 1 && g >= 3) out.push({ at: s + g - 1, n: r - 5 + 12, len: 1 });
    });
    return out;
  },
  // Driving repeated eighths on the root; the last one leans toward the next chord.
  pulse(ctx) {
    const out = [];
    for (let s = 0; s < ctx.bar; s += ctx.sub) {
      const r = placePC(ctx.chordAt(s).bass, BASS_LO);
      let n = r;
      if (s + ctx.sub >= ctx.bar) {
        const next = placePC(ctx.nextBarChord().bass, BASS_LO);
        if (next !== r) n = next + (next > r ? -1 : 1);
      }
      out.push({ at: s, n, len: Math.max(1, ctx.sub - 1) });
    }
    return out;
  },
  // Oom: the root on the downbeat only, the pahs belong to pulse 2 — Air's waltz.
  waltz(ctx) {
    const r = placePC(ctx.chordAt(0).bass, BASS_LO);
    return [{ at: 0, n: r, len: Math.max(1, (ctx.starts[1] || ctx.bar) - 1) }];
  },
  // Root / fifth eighths, low — a pedal that still moves.
  pedal(ctx) {
    const out = [];
    for (let s = 0, k = 0; s < ctx.bar; s += ctx.sub, k++) {
      const r = placePC(ctx.chordAt(s).bass, BASS_LO);
      out.push({ at: s, n: (k % 2) ? r + 7 : r, len: Math.max(1, ctx.sub - 1) });
    }
    return out;
  },
  // Lub-dub once a bar, then silence — the Shadow region's heartbeat.
  heart(ctx) {
    const r = placePC(ctx.chordAt(0).bass, BASS_LO);
    return [{ at: 0, n: r, len: 2 }, { at: 3, n: r, len: 3 }];
  },
  // Eighth plus two sixteenths per beat on the root.
  gallop(ctx) {
    const out = [];
    ctx.starts.forEach((s, i) => {
      const r = placePC(ctx.chordAt(s).bass, BASS_LO);
      const g = ctx.groups[i];
      out.push({ at: s, n: r, len: Math.max(1, Math.floor(g / 2) - 1) });
      if (g >= 4) { out.push({ at: s + g / 2, n: r, len: 1 }); out.push({ at: s + g / 2 + 1, n: r + 12, len: 1 }); }
    });
    return out;
  },
  // A root that slips a semitone up and back each beat — the poison bog's crawl.
  creep(ctx) {
    const bend = [0, 1, 0, -1, 0, 1, 2];
    return ctx.starts.map((s, i) => {
      const r = placePC(ctx.chordAt(s).bass, BASS_LO);
      return { at: s, n: r + bend[i % bend.length], len: Math.max(1, ctx.groups[i] - 1) };
    });
  },
};

// ─ Harmony (pulse 2) styles ─ Return events {at, n, len, vol, arp?} for one bar.
const HARM_LO = 55;   // G3: bottom of the accompaniment register
const HARMONY_STYLES = {
  none: () => [],
  // Sixteenth arpeggio climbing the chord.
  arp(ctx) {
    const out = [];
    for (let s = 0; s < ctx.bar; s++) {
      const t = chordTonesAt(ctx.chordAt(s), HARM_LO + 5);
      out.push({ at: s, n: t[s % t.length], len: 1, vol: 0.5 });
    }
    return out;
  },
  // Up-and-down over two octaves — rolling water.
  wave(ctx) {
    const out = [];
    for (let s = 0; s < ctx.bar; s++) {
      const base = chordTonesAt(ctx.chordAt(s), HARM_LO);
      const t = base.concat(base.map(x => x + 12));
      const cyc = t.concat(t.slice(1, -1).reverse());
      out.push({ at: s, n: cyc[(ctx.barIdx * ctx.bar + s) % cyc.length], len: 1, vol: 0.45 });
    }
    return out;
  },
  // A delayed, quiet copy of the lead — the classic NES echo.
  echo(ctx) {
    const d = ctx.song.echoDelay || 3;
    return ctx.leadInBar(-d).map(e => ({ at: e.at, n: e.n, len: e.len, vol: 0.38 }));
  },
  // A diatonic third under every lead note.
  thirds(ctx) {
    return ctx.leadInBar(0).map(e => ({ at: e.at, n: nearestScaleBelow(e.n, 2, ctx.scaleAbs), len: e.len, vol: 0.55 }));
  },
  // A diatonic sixth under — a wider, hollower harmony.
  sixths(ctx) {
    return ctx.leadInBar(0).map(e => ({ at: e.at, n: nearestScaleBelow(e.n, 5, ctx.scaleAbs), len: e.len, vol: 0.5 }));
  },
  // Chord stabs on the eighth offbeats.
  offbeat(ctx) {
    const out = [];
    let k = 0;
    for (let s = ctx.sub; s < ctx.bar; s += ctx.sub * 2) {
      const t = chordTonesAt(ctx.chordAt(s), HARM_LO + 5);
      out.push({ at: s, n: t[k++ % t.length], len: 1, vol: 0.45 });
    }
    return out;
  },
  // One chord tone per beat, held — the calm mood's slow broken chord.
  broken(ctx) {
    const order = [0, 1, 2, 1];
    return ctx.starts.map((s, i) => {
      const t = chordTonesAt(ctx.chordAt(s), HARM_LO + 5);
      return { at: s, n: t[order[(ctx.barIdx * ctx.starts.length + i) % order.length] % t.length], len: ctx.groups[i], vol: 0.4 };
    });
  },
  // The NES fast-arpeggio chord: one voice cycling the chord tones fifty times a
  // second, held across each chord. Mana's signature.
  arpchord(ctx) {
    const out = [];
    let s = 0;
    while (s < ctx.bar) {
      const ch = ctx.chordAt(s);
      let e = s + 1;
      while (e < ctx.bar && ctx.chordAt(e) === ch && !ctx.starts.includes(e)) e++;
      out.push({ at: s, n: chordTonesAt(ch, HARM_LO + 5)[0], arp: chordTonesAt(ch, HARM_LO + 5), len: e - s, vol: 0.38 });
      s = e;
    }
    return out;
  },
  // Stabs on the weak beats plus the offbeats — the intense comp for driving songs.
  stabs(ctx) {
    const out = [];
    ctx.starts.forEach((s, i) => {
      if (i % 2 === 0) return;
      const t = chordTonesAt(ctx.chordAt(s), HARM_LO + 5);
      out.push({ at: s, n: t[1 % t.length], len: 2, vol: 0.5 });
    });
    return out.concat(HARMONY_STYLES.offbeat(ctx).filter(e => !out.some(o => o.at === e.at)));
  },
  // Pah-pah: chord tones on every beat after the first — the waltz's other half.
  pahs(ctx) {
    return ctx.starts.slice(1).map((s, i) => {
      const t = chordTonesAt(ctx.chordAt(s), HARM_LO + 5);
      return { at: s, n: t[1 + (i % 2)] || t[0], len: Math.max(1, ctx.groups[i + 1] - 1), vol: 0.42 };
    });
  },
  // The section's own written counter-melody.
  counter(ctx) {
    return ctx.counterInBar().map(e => ({ at: e.at, n: e.n, len: e.len, vol: 0.5 }));
  },
};

// ─ Drums (noise + kick) ─ kinds: k kick, s snare, h hat, o open hat, c click, r rumble.
function drumBar(kind, ctx) {
  const st = ctx.starts, bar = ctx.bar, sub = ctx.sub;
  const out = [];
  const add = (at, k, vol) => { if (at >= 0 && at < bar) out.push({ at, k, vol: vol == null ? 1 : vol }); };
  const eighths = () => { for (let s = 0; s < bar; s += sub) add(s, 'h', (s % (sub * 2)) ? 0.5 : 0.7); };
  switch (kind) {
    case 'none': break;
    case 'light':
      st.forEach((s, i) => add(s, (i % 2) ? 's' : 'k', (i % 2) ? 0.7 : 0.9));
      for (let s = sub; s < bar; s += sub * 2) add(s, 'h', 0.45);
      break;
    case 'waltz':
      add(0, 'k', 1); st.slice(1).forEach(s => { add(s, 'h', 0.6); add(s + sub, 'h', 0.35); });
      break;
    case 'march':
      st.forEach((s, i) => {
        add(s, (i % 2) ? 's' : 'k', 1);
        if (i % 2 === 0) add(s, 's', 0.55);
        add(s + sub, 's', 0.4);
        if (i === st.length - 1) { add(s + sub + 1, 's', 0.55); }
      });
      break;
    case 'driving':
      st.forEach((s, i) => { add(s, 'k', 1); if (i % 2) add(s, 's', 0.85); });
      eighths();
      add(bar - sub, 'o', 0.5);
      break;
    case 'intense':
      st.forEach((s, i) => { add(s, 'k', 1); if (i % 2) add(s, 's', 0.95); });
      add(st[st.length - 1] + sub, 'k', 0.8);
      for (let s = 0; s < bar; s++) add(s, 'h', (s % sub) ? 0.3 : 0.5);
      break;
    case 'heartbeat':
      add(0, 'k', 0.75); add(3, 'k', 0.55);
      break;
    case 'snaps':
      add(0, 'k', 1); add(Math.floor(bar / 2), 'k', 0.8);
      for (let s = 0; s < bar; s++) if (s % 3 === 0 && s % 4 !== 0) add(s, 'c', 0.8);
      add(st[1] || Math.floor(bar / 2), 's', 0.7);
      break;
    case 'bones':
      add(0, 'k', 0.6);
      [0, 3, 7, 10, 11].forEach(s => add(Math.round(s * bar / 16), 'c', 0.55));
      break;
    case 'rumble':
      add(0, 'r', 0.9);
      st.forEach((s, i) => { add(s, 'k', 0.9); if (i % 2) add(s, 's', 0.8); });
      break;
    case 'shuffle':
      add(0, 'k', 0.8); add(st[Math.floor(st.length / 2)] || 0, 'k', 0.6);
      st.forEach((s, i) => { if (i % 2) add(s, 's', 0.45); });
      eighths();
      break;
    case 'maqsum': // doum-tek-·-tek-doum-·-tek-· — the desert's darbuka
      [0, 8].forEach(s => add(Math.round(s * bar / 16), 'k', 0.9));
      [2, 6, 12].forEach(s => add(Math.round(s * bar / 16), 'h', 0.85));
      [4, 10, 14].forEach(s => add(Math.round(s * bar / 16), 'h', 0.3));
      break;
    case 'drip':   // a lone click now and then — caves
      add(0, 'c', 0.35); add(Math.round(bar * 0.6875), 'c', 0.25);
      break;
    case 'tick':   // a clock — the house
      st.forEach(s => add(s, 'c', 0.22));
      break;
    default:
      throw new Error(`unknown drum style "${kind}"`);
  }
  return out;
}
// The last half bar of a section in intense: a snare run that climbs in volume.
function drumFill(ctx) {
  const out = [];
  const from = Math.floor(ctx.bar / 2);
  for (let s = from; s < ctx.bar; s++) out.push({ at: s, k: 's', vol: 0.45 + 0.55 * (s - from) / (ctx.bar - from) });
  out.push({ at: 0, k: 'k', vol: 1 });
  return out;
}

// Build one playable arrangement: every section in the mood's form, rendered
// into per-step event slots for the four channels.
// opts: { transpose (semitones), level (tower floor) }
function renderArrangement(trackId, mood, opts) {
  const song = MUSIC_SONGS[trackId];
  if (!song) throw new Error(`no song "${trackId}"`);
  opts = opts || {};
  const spec = songMoodSpec(song, mood);
  const tr = opts.transpose || 0;
  const level = opts.level || 0;
  const keyRoot = parsePitchClass(song.key) + tr;
  let scale = SCALES[song.scale || 'major'];
  if (!scale) throw new Error(`unknown scale "${song.scale}"`);
  if (spec.brighten) scale = brightenScale(scale);
  const scaleAbs = [];
  for (let o = 0; o < 11; o++) for (const d of scale) scaleAbs.push(o * 12 + ((keyRoot % 12) + 12) % 12 + d);
  scaleAbs.sort((a, b) => a - b);

  const { groups, starts } = barGroups(song);
  const bar = song.bar;
  const sub = song.sub || 2;
  const gate = song.levelGate || {};
  const levelTempo = song.levelTempo ? 1 + song.levelTempo * level : 1;
  const stepDur = 60 / (song.bpm * spec.tempo * levelTempo) / song.beat;
  const lead = spec.lead;


  const sections = spec.form.map(name => {
    const sec = song.sections[name];
    if (!sec) throw new Error(`${trackId}: form names missing section ${name}`);
    const unit = song.chordUnit || bar;
    const chords = parseChords(sec.chords, unit).map(c => Object.assign({}, c, { root: c.root + tr, bass: c.bass + tr }));
    const len = chords.length;
    const fix = n => {
      let x = n + tr;
      return spec.brighten ? brightenNote(x, keyRoot) : x;
    };
    if (spec.brighten) chords.forEach(c => {
      const r = brightenNote(c.root, keyRoot);
      c.tones = c.tones.map(t => brightenNote(c.root + t, keyRoot) - r);
      c.bass = brightenNote(c.bass, keyRoot);
      c.root = r;
    });
    // Brightened chord objects were copied per step; re-link equal neighbours so
    // the "did the chord change" tests compare identity, as written.
    for (let i = 1; i < len; i++) if (chords[i].id === chords[i - 1].id) chords[i] = chords[i - 1];
    const mel = parseLine(sec.mel);
    // Lift the intense lead an octave, section by section, unless that would push
    // it above E6 — a 12.5 % pulse up there stops being a melody and starts hurting.
    const secMax = Math.max(0, ...mel.events.map(e => e.n));
    const leadShift = (lead.octUp && secMax + tr + 12 <= 88) ? 12 : 0;
    const ctr = sec.counter ? parseLine(sec.counter) : null;
    const leadEv = mel.events.map(e => ({ at: e.at, n: fix(e.n) + leadShift, len: e.len }));
    const ctrEv = ctr ? ctr.events.map(e => ({ at: e.at, n: fix(e.n), len: e.len })) : [];

    const slots = { p1: new Array(len).fill(null), p2: new Array(len).fill(null),
                    tri: new Array(len).fill(null), noi: new Array(len).fill(null) };
    const put = (ch, at, ev) => {
      if (at < 0 || at >= len) return;
      if (ch === 'noi') (slots.noi[at] = slots.noi[at] || []).push(ev);
      else slots[ch][at] = ev;
    };
    for (const e of leadEv) put('p1', e.at, { n: e.n, len: e.len, vol: lead.vol, duty: lead.duty, vib: lead.vib, vibDepth: lead.vibDepth });

    const bars = Math.ceil(len / bar);
    for (let b = 0; b < bars; b++) {
      const b0 = b * bar;
      const ctx = {
        song, bar, sub, groups, starts, keyRoot, scaleAbs, barIdx: b,
        chordAt: s => chords[Math.min(len - 1, b0 + s)],
        nextBarChord: () => chords[(b0 + bar) % len],
        // Lead events overlapping this bar, offset by `shift` steps (wrapping in
        // the section), with bar-relative `at`.
        leadInBar: shift => leadEv.map(e => ({ at: ((e.at - shift) % len + len) % len - b0, n: e.n, len: e.len }))
                                  .filter(e => e.at >= 0 && e.at < bar),
        counterInBar: () => ctrEv.filter(e => e.at >= b0 && e.at < b0 + bar).map(e => ({ at: e.at - b0, n: e.n, len: e.len })),
      };
      if (!(level < (gate.tri || 0))) {
        const bs = BASS_STYLES[spec.bass];
        if (!bs) throw new Error(`unknown bass style "${spec.bass}"`);
        for (const e of bs(ctx)) put('tri', b0 + e.at, { n: e.n, len: Math.min(e.len, len - b0 - e.at), vol: spec.triVol });
      }
      if (!(level < (gate.p2 || 0))) {
        const hs = HARMONY_STYLES[spec.harmony];
        if (!hs) throw new Error(`unknown harmony style "${spec.harmony}"`);
        const duty = (song.harmonyDuty != null) ? song.harmonyDuty : (spec.harmony === 'echo' ? lead.duty : 0.5);
        for (const e of hs(ctx)) put('p2', b0 + e.at, { n: e.n, len: Math.min(e.len, len - b0 - e.at), vol: e.vol, duty, arp: e.arp });
      }
      if (!(level < (gate.noi || 0))) {
        const lastBar = b === bars - 1;
        const evs = (spec.fills && lastBar && spec.drums !== 'none') ? drumBar(spec.drums, ctx).filter(e => e.at < bar / 2).concat(drumFill(ctx).filter(e => e.at >= bar / 2))
                                                                     : drumBar(spec.drums, ctx);
        for (const e of evs) put('noi', b0 + e.at, { k: e.k, vol: e.vol });
      }
    }
    return { name, len, slots };
  });
  return { trackId, mood, stepDur, bar, swing: song.swing || 0, sub, sections };
}

// ─── Validation (also runs under node: tools/verify-music.js) ─────────────────
function musicValidateSongs() {
  const problems = [];
  if (typeof MUSIC_SONGS === 'undefined') return ['MUSIC_SONGS is not defined'];
  for (const [id, song] of Object.entries(MUSIC_SONGS)) {
    try {
      if (parsePitchClass(song.key) === null) problems.push(`${id}: bad key ${song.key}`);
      if (!(song.bpm > 0) || !(song.bar > 0) || !(song.beat > 0)) problems.push(`${id}: bpm/bar/beat missing`);
      const g = barGroups(song);
      if (g.groups.reduce((a, b) => a + b, 0) !== song.bar) problems.push(`${id}: groups do not sum to bar`);
      for (const [name, sec] of Object.entries(song.sections)) {
        const ch = parseChords(sec.chords, song.chordUnit || song.bar);
        const mel = parseLine(sec.mel);
        if (ch.length % song.bar) problems.push(`${id}.${name}: chords span ${ch.length} steps, not whole bars of ${song.bar}`);
        if (mel.len !== ch.length) problems.push(`${id}.${name}: melody is ${mel.len} steps, chords ${ch.length}`);
        if (sec.counter) {
          const c = parseLine(sec.counter);
          if (c.len !== ch.length) problems.push(`${id}.${name}: counter is ${c.len} steps, chords ${ch.length}`);
        }
      }
      for (const mood of ['calm', 'normal', 'intense']) renderArrangement(id, mood, {});
    } catch (e) {
      problems.push(`${id}: ${e.message}`);
    }
  }
  return problems;
}

// ─── Synthesis ────────────────────────────────────────────────────────────────
// Per-context caches: periodic waves and noise buffers belong to one AudioContext.
function musicVoices(ctx) {
  if (ctx._sdVoices) return ctx._sdVoices;
  const H = 48;
  const pulse = {};
  for (const d of [0.125, 0.25, 0.5]) {
    const re = new Float32Array(H), im = new Float32Array(H);
    for (let n = 1; n < H; n++) re[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * d);
    pulse[d] = ctx.createPeriodicWave(re, im);
  }
  // The 2A03 triangle is a 32-step staircase, not a clean triangle — the steps
  // are its buzz. Take the Fourier series of that staircase directly.
  const N = 512, tri = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const step = Math.floor(i * 32 / N);
    const lvl = step < 16 ? 15 - step : step - 16;
    tri[i] = (lvl / 7.5) - 1;
  }
  const tre = new Float32Array(H), tim = new Float32Array(H);
  for (let n = 1; n < H; n++) {
    let a = 0, b = 0;
    for (let i = 0; i < N; i++) { const ph = 2 * Math.PI * n * i / N; a += tri[i] * Math.cos(ph); b += tri[i] * Math.sin(ph); }
    tre[n] = 2 * a / N; tim[n] = 2 * b / N;
  }
  const triangle = ctx.createPeriodicWave(tre, tim);
  // Noise from the 15-bit LFSR, both modes: long (feedback from bit 1) is the
  // hiss of drums; short (bit 6) loops after 93 steps and rings metallic.
  const lfsr = (mode, count) => {
    const out = new Float32Array(count);
    let reg = 1;
    for (let i = 0; i < count; i++) {
      const fb = (reg ^ (reg >> (mode ? 6 : 1))) & 1;
      reg = (reg >> 1) | (fb << 14);
      out[i] = (reg & 1) ? -0.8 : 0.8;
    }
    return out;
  };
  const mkBuf = data => {
    const b = ctx.createBuffer(1, data.length, ctx.sampleRate);
    b.copyToChannel ? b.copyToChannel(data, 0) : b.getChannelData(0).set(data);
    return b;
  };
  const longLen = ctx.sampleRate;   // one second of hiss, looped
  const shortSeq = lfsr(1, 93);
  const shortData = new Float32Array(93 * 64);
  for (let i = 0; i < shortData.length; i++) shortData[i] = shortSeq[i % 93];
  ctx._sdVoices = { pulse, triangle, noiseLong: mkBuf(lfsr(0, longLen)), noiseShort: mkBuf(shortData) };
  return ctx._sdVoices;
}

function playTone(ctx, dest, wave, t, dur, freqs, vol, opts) {
  const osc = ctx.createOscillator();
  osc.setPeriodicWave(wave);
  const g = ctx.createGain();
  osc.connect(g); g.connect(dest);
  if (freqs.length > 1) {
    // Fast arpeggio: step through the chord at 50 Hz for the note's length.
    const rate = 1 / 50;
    for (let k = 0, tt = t; tt < t + dur; k++, tt += rate) osc.frequency.setValueAtTime(freqs[k % freqs.length], tt);
  } else {
    osc.frequency.setValueAtTime(freqs[0], t);
  }
  const rel = 0.018;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.003);
  if (opts && opts.decay) g.gain.setTargetAtTime(vol * opts.decay, t + 0.01, 0.12);
  g.gain.setValueAtTime(opts && opts.decay ? vol * opts.decay : vol, Math.max(t + 0.004, t + dur - rel));
  g.gain.linearRampToValueAtTime(0, t + dur);
  if (opts && opts.vib && dur > 0.32) {
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.frequency.value = 5.5;
    lg.gain.setValueAtTime(0, t);
    lg.gain.setValueAtTime(0, t + 0.16);
    lg.gain.linearRampToValueAtTime(opts.vibDepth || 16, t + 0.36);
    lfo.connect(lg); lg.connect(osc.detune);
    lfo.start(t); lfo.stop(t + dur + 0.02);
  }
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

const DRUM_KINDS = {
  //       buffer   rate   decay  vol
  s: { buf: 'noiseLong',  rate: 0.32, decay: 0.10, vol: 0.55 },
  h: { buf: 'noiseLong',  rate: 1.0,  decay: 0.025, vol: 0.22 },
  o: { buf: 'noiseLong',  rate: 1.0,  decay: 0.12, vol: 0.18 },
  c: { buf: 'noiseShort', rate: 1.6,  decay: 0.018, vol: 0.30 },
  r: { buf: 'noiseLong',  rate: 0.06, decay: 0.45, vol: 0.40 },
};
function playDrum(ctx, dest, voices, t, kind, vol) {
  if (kind === 'k') {
    // The kick: a triangle blip diving from 160 Hz to 45 Hz, like a DMC kick sample.
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.setPeriodicWave(voices.triangle);
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.09);
    g.gain.setValueAtTime(0.9 * vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
    osc.connect(g); g.connect(dest);
    osc.start(t); osc.stop(t + 0.15);
    return;
  }
  const d = DRUM_KINDS[kind];
  if (!d) return;
  const src = ctx.createBufferSource();
  src.buffer = voices[d.buf];
  src.loop = true;
  src.playbackRate.value = d.rate;
  const g = ctx.createGain();
  g.gain.setValueAtTime(d.vol * vol, t);
  g.gain.setTargetAtTime(0, t + 0.004, d.decay / 3);
  src.connect(g); g.connect(dest);
  // Start somewhere different in the loop each hit so no two snares are identical.
  const off = (t * 7919) % 0.9;
  src.start(t, off);
  src.stop(t + d.decay * 2 + 0.05);
}

// ─── Player ───────────────────────────────────────────────────────────────────
// One playing song on one context. `pump(until)` schedules every step that
// starts before `until`; the realtime path calls it from a timer, the offline
// renderer calls it once with the whole duration.
function MusicPlayer(ctx, dest) {
  this.ctx = ctx;
  this.voices = musicVoices(ctx);
  this.bus = ctx.createGain();
  this.bus.connect(dest);
  this.ch = {};
  for (const k of Object.keys(MUSIC_MIX)) {
    this.ch[k] = ctx.createGain();
    this.ch[k].gain.value = MUSIC_MIX[k];
    this.ch[k].connect(this.bus);
  }
  this.arr = null;
  this.secIdx = 0;
  this.step = 0;
  this.next = 0;
  this.pending = null;   // { arr } waiting for the next bar line
  this.stopped = false;
}
MusicPlayer.prototype.start = function (arr, when) {
  this.arr = arr;
  this.secIdx = 0;
  this.step = 0;
  this.next = when;
};
// Queue a different arrangement of the same song (a mood change) for the next bar.
MusicPlayer.prototype.queue = function (arr) { this.pending = arr; };
MusicPlayer.prototype._swapAtBar = function () {
  const nu = this.pending, cur = this.arr.sections[this.secIdx];
  this.pending = null;
  let idx = nu.sections.findIndex(s => s.name === cur.name);
  let step = this.step;
  if (idx < 0) { idx = 0; }
  const len = nu.sections[idx].len;
  if (step >= len) step = (Math.floor(step / nu.bar) * nu.bar) % len;
  this.arr = nu;
  this.secIdx = idx;
  this.step = step;
};
MusicPlayer.prototype.pump = function (until) {
  if (!this.arr || this.stopped) return;
  const ctx = this.ctx, v = this.voices;
  // The guard only exists to stop a zero step length looping forever.
  let guard = 0;
  while (this.next < until && guard++ < 200000) {
    if (this.pending && this.step % this.arr.bar === 0) this._swapAtBar();
    const arr = this.arr, sec = arr.sections[this.secIdx], s = this.step;
    const sd = arr.stepDur;
    // Swing pushes every second eighth late.
    const swung = (arr.swing && (s % (arr.sub * 2)) === arr.sub) ? arr.swing * sd * arr.sub : 0;
    const t = this.next + swung;
    const p1 = sec.slots.p1[s], p2 = sec.slots.p2[s], tri = sec.slots.tri[s], noi = sec.slots.noi[s];
    if (p1) playTone(ctx, this.ch.p1, v.pulse[p1.duty] || v.pulse[0.25], t, p1.len * sd, [midiHz(p1.n)], p1.vol, { vib: p1.vib, vibDepth: p1.vibDepth, decay: 0.7 });
    if (p2) playTone(ctx, this.ch.p2, v.pulse[p2.duty] || v.pulse[0.5], t, p2.len * sd,
                     p2.arp ? p2.arp.map(midiHz) : [midiHz(p2.n)], p2.vol, { decay: 0.6 });
    if (tri) playTone(ctx, this.ch.tri, v.triangle, t, Math.max(sd * 0.5, tri.len * sd - 0.01), [midiHz(tri.n)], tri.vol, null);
    if (noi) for (const d of noi) playDrum(ctx, this.ch.noi, v, t, d.k, d.vol);
    this.next += sd;
    this.step++;
    if (this.step >= sec.len) { this.step = 0; this.secIdx = (this.secIdx + 1) % arr.sections.length; }
  }
};
MusicPlayer.prototype.fadeOut = function (at, secs) {
  this.stopped = true;
  const g = this.bus.gain;
  g.cancelScheduledValues(at);
  g.setValueAtTime(g.value, at);
  g.linearRampToValueAtTime(0, at + secs);
  const bus = this.bus;
  setTimeout(() => { try { bus.disconnect(); } catch (_) {} }, (secs + 0.5) * 1000);
};

// ─── Realtime engine ──────────────────────────────────────────────────────────
let musicCtx = null;
let musicMaster = null;    // volume
let musicDuckGain = null;  // under the volume: SFX ducking
let musicPlayer = null;
let musicTimer = null;
let musicCurrent = null;   // { trackKey, track, mood, opts }
let musicWanted = null;    // the latest target, held until audio is unlocked
let musicForced = false;   // the jukebox drives it by hand
const _arrCache = {};

function arrangementFor(track, mood, opts) {
  const key = `${track}|${mood}|${opts.transpose || 0}|${opts.level || 0}`;
  if (!_arrCache[key]) _arrCache[key] = renderArrangement(track, mood, opts);
  return _arrCache[key];
}

function musicUnlocked() { return !!musicCtx; }

function unlockMusic() {
  if (musicCtx) {
    if (musicCtx.state === 'suspended' && !(typeof document !== 'undefined' && document.hidden)) musicCtx.resume();
    return;
  }
  const AC = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return;
  try {
    musicCtx = new AC();
  } catch (_) { return; }
  musicDuckGain = musicCtx.createGain();
  musicMaster = musicCtx.createGain();
  musicDuckGain.connect(musicMaster);
  musicMaster.connect(musicCtx.destination);
  applyMusicVolume();
  musicTimer = setInterval(musicTick, MUSIC_TICK_MS);
  if (musicWanted) applyMusicTarget(musicWanted);
}

function applyMusicVolume() {
  if (!musicMaster) return;
  const t = musicCtx.currentTime;
  musicMaster.gain.cancelScheduledValues(t);
  musicMaster.gain.setValueAtTime(musicMaster.gain.value, t);
  musicMaster.gain.linearRampToValueAtTime(musicLevel(), t + 0.08);
}

function musicTick() {
  if (!musicCtx || musicCtx.state !== 'running' || !musicPlayer) return;
  const now = musicCtx.currentTime;
  // A long main-thread stall leaves the queue in the past. Jump ahead rather
  // than firing every overdue note at once.
  if (musicPlayer.next < now - 0.25) musicPlayer.next = now + 0.02;
  musicPlayer.pump(now + MUSIC_LOOKAHEAD);
}

// Point the engine at a { track, mood, opts } target. Same song: queue the
// mood for the next bar. Different song (or key/floor): fade and restart.
function applyMusicTarget(target) {
  musicWanted = target;
  if (!musicCtx) return;
  const opts = target.opts || {};
  const trackKey = `${target.track}|${opts.transpose || 0}|${opts.level || 0}`;
  let arr;
  try { arr = arrangementFor(target.track, target.mood, opts); }
  catch (e) { console.warn('music:', e.message); return; }
  if (musicCurrent && musicCurrent.trackKey === trackKey && musicPlayer && !musicPlayer.stopped) {
    if (musicCurrent.mood !== target.mood) musicPlayer.queue(arr);
    musicCurrent = { trackKey, track: target.track, mood: target.mood, opts };
    return;
  }
  const now = musicCtx.currentTime;
  let startAt = now + 0.05;
  if (musicPlayer) { musicPlayer.fadeOut(now, MUSIC_FADE); startAt = now + MUSIC_FADE; }
  musicPlayer = new MusicPlayer(musicCtx, musicDuckGain);
  musicPlayer.start(arr, startAt);
  musicCurrent = { trackKey, track: target.track, mood: target.mood, opts };
}

function musicStop() {
  if (musicPlayer && musicCtx) musicPlayer.fadeOut(musicCtx.currentTime, MUSIC_FADE);
  musicPlayer = null;
  musicCurrent = null;
}

// Dip the music under a sound effect for `ms`.
function musicDuck(ms, depth) {
  if (!musicDuckGain) return;
  const t = musicCtx.currentTime, g = musicDuckGain.gain;
  const low = (depth == null) ? 0.3 : depth;
  g.cancelScheduledValues(t);
  g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime(low, t + 0.05);
  g.setValueAtTime(low, t + ms / 1000);
  g.linearRampToValueAtTime(1, t + ms / 1000 + 0.4);
}

// The jukebox (music-check.html) takes the wheel; stepMusic stops steering.
function musicForce(track, mood, opts) {
  musicForced = true;
  applyMusicTarget({ track, mood: mood || 'normal', opts: opts || {} });
}

function musicNowPlaying() {
  if (!musicPlayer || !musicPlayer.arr || !musicCurrent) return null;
  const sec = musicPlayer.arr.sections[musicPlayer.secIdx];
  return { track: musicCurrent.track, mood: musicCurrent.mood, opts: musicCurrent.opts,
           section: sec.name, bar: Math.floor(musicPlayer.step / musicPlayer.arr.bar) + 1,
           bars: sec.len / musicPlayer.arr.bar, pendingMood: musicPlayer.pending ? musicPlayer.pending.mood : null };
}

// ─── What the game wants to hear ──────────────────────────────────────────────
// Map types whose song is transposed into the region's key.
const MUSIC_REGIONAL_TYPES = { cave: 'cave', cave_chain: 'cave', dungeon: 'dungeon', sky_cave: 'sky_cave',
                               whirlpool_grotto: 'grotto', shrine: 'shrine' };

function musicRegionIdx(cm) {
  let idx = (typeof mapRegionIndex === 'function') ? mapRegionIndex(cm) : -1;
  if (idx < 0 && Number.isInteger(cm.sourceTier)) idx = cm.sourceTier;
  return idx;
}
function musicRegionTranspose(regionIdx, track) {
  if (typeof REGIONS === 'undefined' || !REGIONS[regionIdx]) return 0;
  const reg = MUSIC_SONGS[REGIONS[regionIdx].id];
  const own = MUSIC_SONGS[track];
  if (!reg || !own) return 0;
  let d = (parsePitchClass(reg.key) - parsePitchClass(own.key) + 12) % 12;
  if (d > 6) d -= 12;   // the nearer way round: never more than a tritone
  return d;
}

function musicTarget() {
  if (typeof gameStarted !== 'undefined' && !gameStarted) return { track: 'title', mood: 'normal' };
  const cm = (typeof worldMaps !== 'undefined' && typeof currentMapId !== 'undefined') ? worldMaps[currentMapId] : null;
  if (!cm) return null;
  const live = (typeof enemies !== 'undefined' && Array.isArray(enemies)) ? enemies : [];
  const awake = e => e && !e.dead && !e.dormant;
  if (live.some(e => awake(e) && e.finalBoss)) return { track: 'finale', mood: 'intense' };
  const bossUp = live.some(e => awake(e) && e.boss);
  let mood = bossUp ? 'intense' : 'normal';
  const flag = f => (typeof hasFlag === 'function') && hasFlag(f);

  if (cm.type === 'homevillage') {
    if (!flag('village_burning')) return { track: 'elderbrook', mood: 'normal' };
    // The burning itself plays the ruins theme at full tension; after it, the
    // ruin is quiet for good. Never calm — Elderbrook is not restored.
    return { track: 'ruins', mood: flag('prologue_complete') ? 'normal' : 'intense' };
  }
  if (cm.type === 'house') return { track: 'house', mood: 'normal' };
  if (cm.type === 'castle_tower') {
    const level = Number.isInteger(cm.floorIdx) ? cm.floorIdx : 0;
    return { track: 'tower', mood, opts: { level, transpose: Math.floor(level / 4) } };
  }
  if (MUSIC_REGIONAL_TYPES[cm.type]) {
    const track = MUSIC_REGIONAL_TYPES[cm.type];
    return { track, mood, opts: { transpose: musicRegionTranspose(musicRegionIdx(cm), track) } };
  }
  if (cm.type === 'village' && cm.activated && !bossUp) mood = 'calm';
  const idx = musicRegionIdx(cm);
  const id = (typeof REGIONS !== 'undefined' && REGIONS[idx]) ? REGIONS[idx].id : 'forest';
  return { track: MUSIC_SONGS[id] ? id : 'forest', mood };
}

let _musicLastKey = '';
function stepMusic() {
  if (musicForced || typeof MUSIC_SONGS === 'undefined') return;
  const t = musicTarget();
  if (!t) return;
  const o = t.opts || {};
  const key = `${t.track}|${t.mood}|${o.transpose || 0}|${o.level || 0}`;
  if (key === _musicLastKey) return;
  _musicLastKey = key;
  applyMusicTarget(t);
}

// ─── Offline render (verification) ────────────────────────────────────────────
// Render `seconds` of a track × mood to an AudioBuffer, for tools/verify-music.js
// and the jukebox's "check all" button.
function musicRenderOffline(track, mood, opts, seconds) {
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const sr = 22050;
  const ctx = new OAC(1, Math.ceil(sr * seconds), sr);
  const p = new MusicPlayer(ctx, ctx.destination);
  p.start(renderArrangement(track, mood, opts || {}), 0.01);
  p.pump(seconds);
  return ctx.startRendering();
}

// ─── Browser wiring ───────────────────────────────────────────────────────────
// Browsers refuse to make sound before the page has been touched, so the
// context is created on the first click or key — title music starts then.
if (typeof document !== 'undefined') {
  const unlock = () => unlockMusic();
  document.addEventListener('pointerdown', unlock, true);
  document.addEventListener('keydown', unlock, true);
  document.addEventListener('touchstart', unlock, true);
  // Silence while the tab is hidden; carry on where it left off on return.
  document.addEventListener('visibilitychange', () => {
    if (!musicCtx) return;
    if (document.hidden) musicCtx.suspend();
    else musicCtx.resume();
  });
}
