// ─── Music: the songs ─────────────────────────────────────────────────────────
// Data only; music.js plays it. One entry per track: the thirteen region themes
// (keyed by REGIONS[i].id) and one song per non-region map type.
//
// ─── Shape of a song ───
//   title      name shown in the jukebox (music-check.html)
//   key        tonic pitch class ('G', 'Eb', 'F#') — also what the regional
//              map-type songs are transposed to (see musicRegionTranspose)
//   scale      SCALES name in music.js — drives the diatonic harmony styles
//   bpm        beats per minute, a "beat" being `beat` steps
//   bar        steps per bar; a step is the grid every line is written on
//              (sixteenths throughout: 4/4 is bar 16 beat 4, 6/8 is bar 12 beat 6)
//   groups     optional beat grouping of a bar in steps (7/8 as [4, 4, 6])
//   sub        steps per eighth note (2 on a sixteenth grid)
//   swing      0..1 fraction of an eighth that every second eighth is pushed late
//   chordUnit  steps one chord token spans (defaults to a whole bar)
//   lead       pulse-1 voice: { duty, vol, vib }
//   bass       triangle style for the normal mood  (BASS_STYLES in music.js)
//   harmony    pulse-2 style for the normal mood   (HARMONY_STYLES)
//   drums      noise style for the normal mood     (drumBar)
//   calm / intense   per-mood overrides of any of: tempo, lead, bass, harmony,
//              drums, fills, form, brighten. Anything left out takes the
//              shared recipe (MOOD_RECIPES): calm is slower, softer, no drums,
//              broken chords over held roots; intense is faster, a thin 12.5 %
//              lead an octave up, thirds under it, octave bass, full kit + fills.
//   calmBrighten  shift a minor-mode song toward its parallel major when calm
//   sections   A, B (the normal loop), C (the boss bridge, intense only),
//              K (optional: a calm-only section; calm otherwise plays A)
//              each { chords, mel, counter? } — see parseLine / parseChords:
//              'G4:3' is a note held three steps, '.:2' rests, '-' extends the
//              previous note, '|' is a bar line for the reader and is ignored.
//
// Every section's melody must span exactly its chords; tools/verify-music.js
// and musicValidateSongs() check that and render every song in every mood.

// Elderbrook's tune, shared with the ruins below. Kept outside MUSIC_SONGS
// because the ruins are the same notes in C minor, not a second composition.
const ELDERBROOK_A = 'E5:4 G5:4 E5:4 C5:4 | F5:4 A5:4 G5:4 F5:4 | E5:6 D5:2 C5:8 | D5:8 B4:4 G4:4 |' +
                     'C5:4 E5:4 A5:8 | A5:4 G5:4 F5:4 A5:4 | G5:8 E5:4 D5:4 | C5:12 .:4';
const ELDERBROOK_B = 'A4:4 C5:4 F5:6 E5:2 | D5:4 G5:4 B5:6 A5:2 | G5:4 E5:4 B4:8 | C5:4 E5:4 A5:8 |' +
                     'A5:6 G5:2 F5:4 C5:4 | B4:4 D5:4 G5:8 | G5:4 E5:4 D5:4 C5:4 | C5:8 .:8';
// C major → C natural minor: lower every E, A and B a semitone.
function toCMinor(mel) { return mel.replace(/\b([EAB])(\d)/g, '$1b$2'); }

const MUSIC_SONGS = {

// ═══ Regions ══════════════════════════════════════════════════════════════════

// 1 · Forest — the opening theme. Its first bar is the motif the title and the
// final battle quote.
forest: {
  title: 'Whispering Grove', key: 'G', scale: 'mixolydian', bpm: 112,
  bar: 12, beat: 6, sub: 2,
  lead: { duty: 0.25 }, bass: 'walk', harmony: 'arp', drums: 'light',
  sections: {
    A: { chords: 'G F C G Em C F D',
         mel: 'D5:4 B4:2 G4:4 B4:2 | C5:4 A4:2 F4:4 A4:2 | G4:2 A4:2 B4:2 C5:4 E5:2 | D5:8 B4:2 D5:2 |' +
              'E5:4 D5:2 B4:4 G4:2 | C5:4 E5:2 G5:4 E5:2 | F5:4 E5:2 D5:4 C5:2 | D5:6 A4:2 B4:2 C5:2' },
    B: { chords: 'C G Am F C G F D',
         mel: 'E5:6 G5:4 E5:2 | D5:6 B4:4 D5:2 | C5:4 B4:2 A4:4 C5:2 | F5:8 E5:2 C5:2 |' +
              'E5:4 G5:2 C6:4 G5:2 | B5:4 A5:2 G5:4 D5:2 | A5:4 G5:2 F5:4 E5:2 | F#5:4 E5:2 D5:4 .:2' },
    C: { chords: 'Em C Am D',
         mel: 'B4:2 E5:2 G5:2 B5:4 G5:2 | C6:4 B5:2 G5:4 E5:2 | A5:2 C6:2 A5:2 E5:4 C5:2 | D5:2 F#5:2 A5:2 D6:4 C6:2' },
  },
},


// 2 · Fire (desert) — a snake-charmer line, grace notes and all, over the drone.
fire: {
  title: 'Scorching Dunes', key: 'D', scale: 'phrydom', bpm: 100,
  bar: 16, beat: 4, sub: 2, calmBrighten: true,
  lead: { duty: 0.25, vibDepth: 22 }, bass: 'drone', harmony: 'offbeat', drums: 'maqsum',
  sections: {
    A: { chords: 'D D Eb D Gm Cm Eb D',
         mel: 'A4:2 Bb4:1 A4:1 G4:2 F#4:2 G4:2 A4:6 | Bb4:1 A4:1 G4:2 F#4:2 Eb4:2 D4:8 |' +
              'Eb4:2 F#4:2 G4:2 A4:2 Bb4:4 A4:2 G4:2 | A4:12 .:4 |' +
              'D5:2 Eb5:1 D5:1 C5:2 Bb4:2 C5:2 D5:6 | Eb5:2 D5:2 C5:2 Bb4:2 A4:2 G4:2 A4:4 |' +
              'Bb4:2 A4:2 G4:2 F#4:2 G4:2 Eb4:2 F#4:4 | D4:10 A3:2 D4:2 F#4:2' },
    B: { chords: 'Gm Gm D D Cm Eb D D',
         mel: 'G5:4 F#5:2 G5:2 A5:2 Bb5:2 A5:4 | G5:2 F#5:2 Eb5:2 D5:2 G5:8 |' +
              'F#5:4 Eb5:2 D5:2 C5:2 Bb4:2 A4:4 | D5:12 .:4 |' +
              'C5:2 D5:1 C5:1 Bb4:2 A4:2 G4:4 Eb5:4 | D5:2 Eb5:2 F#5:2 G5:2 A5:4 G5:4 |' +
              'F#5:2 Eb5:2 D5:2 C5:2 Bb4:2 A4:2 G4:2 F#4:2 | D4:8 .:4 A4:4' },
    C: { chords: 'Eb D Eb D',
         mel: 'Bb5:2 A5:2 G5:2 A5:2 Bb5:2 A5:2 G5:2 F#5:2 | A5:4 F#5:2 D5:2 A5:4 F#5:4 |' +
              'G5:2 F#5:2 Eb5:2 F#5:2 G5:2 A5:2 Bb5:4 | A5:8 D5:2 Eb5:2 F#5:2 G5:2' },
  },
},

// 3 · Water — rolling arpeggio waves on pulse 2, a little swing.
water: {
  title: 'Tidepool Reach', key: 'Eb', scale: 'lydian', bpm: 96,
  bar: 16, beat: 4, sub: 2, swing: 0.15,
  lead: { duty: 0.25 }, bass: 'walk', harmony: 'wave', drums: 'shuffle',
  sections: {
    A: { chords: 'Eb F Gm F Cm Bb F F',
         mel: 'G4:4 Bb4:4 Eb5:6 D5:2 | C5:4 A4:4 F4:6 G4:2 | Bb4:4 D5:4 G5:4 F5:2 D5:2 | C5:12 .:4 |' +
              'Eb5:4 D5:2 C5:2 G4:4 C5:4 | D5:4 C5:2 Bb4:2 F4:4 Bb4:4 | A4:4 C5:4 F5:4 Eb5:2 C5:2 | A4:8 .:6 F4:2' },
    B: { chords: 'Cm F Bb Eb Cm F Bb F',
         mel: 'G5:6 F5:2 Eb5:4 C5:4 | F5:6 Eb5:2 C5:4 A4:4 | D5:6 C5:2 Bb4:4 F5:4 | G5:12 .:4 |' +
              'Eb5:4 G5:4 C6:4 Bb5:2 G5:2 | A5:4 F5:4 C5:4 A4:4 | Bb4:4 D5:4 F5:4 D5:4 | C5:8 A4:4 F4:4' },
    C: { chords: 'Gm Cm F F',
         mel: 'D5:2 G5:2 Bb5:2 D6:2 Bb5:2 G5:2 D5:2 Bb4:2 | Eb5:2 G5:2 C6:4 G5:2 Eb5:2 C5:4 |' +
              'F5:2 A5:2 C6:2 A5:2 F5:2 C5:2 A4:2 C5:2 | A5:4 G5:4 F5:4 Eb5:2 D5:2' },
  },
},

// 4 · Ice — sparse 12.5 % bells and their echo, no drums until something wakes.
ice: {
  title: 'Frostbite Plain', key: 'B', scale: 'dorian', bpm: 84,
  bar: 16, beat: 4, sub: 2, calmBrighten: true, echoDelay: 3,
  lead: { duty: 0.125, vol: 0.7 }, bass: 'roots', harmony: 'echo', drums: 'none',
  sections: {
    A: { chords: 'Bm E Bm E G A Bm Bm',
         mel: 'F#5:2 .:2 B5:2 .:2 A5:2 F#5:2 .:4 | G#5:4 .:2 E5:2 .:8 | D5:2 .:2 F#5:2 .:2 B5:4 .:4 |' +
              'C#6:2 .:2 B5:2 .:2 G#5:8 | B5:2 .:2 A5:2 .:2 G5:4 D5:4 | E5:2 .:2 F#5:2 .:2 A5:4 C#6:4 |' +
              'B5:8 F#5:4 D5:4 | B4:12 .:4' },
    B: { chords: 'G D A E G A F#m F#m',
         mel: 'D6:2 .:2 B5:2 .:2 G5:8 | A5:2 .:2 F#5:2 .:2 D5:8 | C#6:2 .:2 A5:2 .:2 E5:4 .:4 | B5:4 G#5:4 E5:8 |' +
              'G5:2 A5:2 B5:4 D6:4 B5:4 | C#6:4 A5:4 E5:8 | F#5:2 .:2 A5:2 .:2 C#6:4 A5:4 | F#5:8 .:8' },
    C: { chords: 'Bm G A F#',
         mel: 'B5:2 F#5:2 D5:2 F#5:2 B5:2 F#5:2 D5:2 B4:2 | G5:2 D5:2 B4:2 D5:2 G5:2 B5:2 D6:4 |' +
              'C#6:2 A5:2 E5:2 A5:2 C#6:2 E5:2 A5:4 | A#5:4 C#6:4 F#5:4 A#5:4' },
  },
},

// 5 · Earth — the most drum-forward region: a march on scree.
earth: {
  title: 'Granite Pass', key: 'E', scale: 'pentminor', bpm: 90,
  bar: 16, beat: 4, sub: 2, calmBrighten: true,
  lead: { duty: 0.5, vol: 0.75 }, bass: 'march', harmony: 'offbeat', drums: 'march',
  intense: { bass: 'gallop' },
  sections: {
    A: { chords: 'Em D C D Em D C B',
         mel: 'E4:3 E4:1 G4:2 A4:2 B4:4 A4:2 G4:2 | A4:3 A4:1 D5:4 B4:2 A4:2 G4:4 | G4:3 G4:1 E4:2 G4:2 A4:4 B4:2 A4:2 |' +
              'A4:8 D4:4 G4:2 A4:2 | B4:3 B4:1 D5:2 E5:2 D5:4 B4:2 A4:2 | D5:3 D5:1 A4:2 B4:2 D5:4 E5:2 D5:2 |' +
              'E5:4 D5:2 B4:2 A4:2 G4:2 E4:4 | D#4:4 F#4:4 B4:8' },
    B: { chords: 'Am Am Em Em C D Em Em',
         mel: 'A4:4 C5:2 E5:2 E5:4 D5:2 C5:2 | A4:8 .:4 E4:2 A4:2 | B4:4 D5:2 E5:2 G5:4 E5:2 D5:2 | E5:8 .:4 B4:2 D5:2 |' +
              'E5:3 E5:1 G5:2 E5:2 D5:4 C5:2 B4:2 | A4:3 A4:1 B4:2 D5:2 F#5:4 E5:2 D5:2 | E5:4 B4:4 G4:4 B4:4 | E4:12 .:4' },
    C: { chords: 'Em G D B',
         mel: 'E5:2 E5:2 G5:2 E5:2 B5:4 A5:2 G5:2 | G5:2 G5:2 B5:2 G5:2 D6:4 B5:2 A5:2 |' +
              'A5:2 A5:2 F#5:2 D5:2 A5:4 F#5:2 E5:2 | D#5:4 F#5:4 B5:4 A5:2 F#5:2' },
  },
},

// 6 · Volcanic — driving eighths, chromatic bass leaning into every change.
volcanic: {
  title: 'Cinderpath', key: 'C', scale: 'harmonic', bpm: 132,
  bar: 16, beat: 4, sub: 2, calmBrighten: true,
  lead: { duty: 0.25 }, bass: 'pulse', harmony: 'stabs', drums: 'rumble',
  sections: {
    A: { chords: 'Cm Ab Fm G Cm Ab Db G',
         mel: 'C5:2 Eb5:2 G5:2 C6:2 B5:2 G5:2 Eb5:2 G5:2 | Ab5:4 G5:2 F5:2 Eb5:4 C5:4 |' +
              'F5:2 Ab5:2 C6:2 Ab5:2 G5:2 F5:2 Eb5:2 D5:2 | B4:4 D5:4 G5:6 .:2 |' +
              'C5:2 Eb5:2 G5:2 C6:2 D6:2 C6:2 B5:2 G5:2 | Ab5:6 G5:2 F5:4 Eb5:4 | Db5:4 F5:4 Ab5:4 F5:4 |' +
              'G5:4 F5:2 Eb5:2 D5:2 B4:2 G4:4' },
    B: { chords: 'Fm Fm Cm Cm Ab G Ab G',
         mel: 'F4:2 F4:2 Ab4:2 C5:2 F5:4 Eb5:2 C5:2 | Db5:4 C5:2 Ab4:2 F4:8 | G4:2 G4:2 C5:2 Eb5:2 G5:4 F5:2 Eb5:2 |' +
              'D5:4 Eb5:4 C5:8 | C5:2 Eb5:2 Ab5:2 C6:2 Ab5:4 Eb5:4 | B4:2 D5:2 G5:2 B5:2 G5:4 D5:4 |' +
              'Ab5:2 G5:2 F5:2 Eb5:2 F5:2 Eb5:2 D5:2 C5:2 | B4:4 G4:4 D5:4 B4:4' },
    C: { chords: 'Cm Db Bdim G',
         mel: 'C6:1 B5:1 C6:2 G5:2 Eb5:2 C6:1 B5:1 C6:2 G5:2 Eb5:2 | Db6:1 C6:1 Db6:2 Ab5:2 F5:2 Db6:1 C6:1 Db6:2 Ab5:2 F5:2 |' +
              'B5:2 D6:2 B5:2 Ab5:2 F5:2 D5:2 B4:2 D5:2 | G5:2 B5:2 D6:2 B5:2 G5:4 .:4' },
  },
},

// 7 · Air — a waltz that leaps: oom on the triangle, pah-pah on pulse 2.
air: {
  title: 'Skywharf', key: 'F', scale: 'lydian', bpm: 120,
  bar: 12, beat: 4, sub: 2,
  lead: { duty: 0.25 }, bass: 'waltz', harmony: 'pahs', drums: 'waltz',
  calm: { bass: 'waltz', harmony: 'pahs' },
  sections: {
    A: { chords: 'F G Am F Dm G C C',
         mel: 'C5:4 F5:4 A5:4 | B5:8 G5:4 | A5:4 E5:4 C5:4 | F5:8 .:4 |' +
              'D5:4 A5:4 D6:4 | B5:6 A5:2 G5:4 | E5:4 G5:4 C6:4 | G5:8 E5:2 D5:2' },
    B: { chords: 'Dm Am G C Dm Em F G',
         mel: 'F5:4 A5:4 D6:4 | C6:8 A5:4 | B5:4 D6:4 G5:4 | E5:8 .:4 |' +
              'D5:2 E5:2 F5:4 A5:4 | G5:2 A5:2 B5:4 E6:4 | C6:4 A5:4 F5:4 | G5:4 B5:4 D6:4' },
    C: { chords: 'Am G F G',
         mel: 'E6:2 C6:2 A5:2 E5:2 A5:2 C6:2 | D6:2 B5:2 G5:2 D5:2 G5:2 B5:2 | C6:2 A5:2 F5:2 C5:2 F5:2 A5:2 | B5:4 G5:4 D5:4' },
  },
},

// 8 · Lightning — staccato sixteenths that never sit on the beat for long.
lightning: {
  title: 'Sparkfen', key: 'A', scale: 'minor', bpm: 150,
  bar: 16, beat: 4, sub: 2, calmBrighten: true,
  lead: { duty: 0.25, vib: false }, bass: 'pulse', harmony: 'offbeat', drums: 'snaps',
  sections: {
    A: { chords: 'Am Am F G Am Am F E',
         mel: 'A4:1 .:1 A4:1 .:1 C5:1 .:1 E5:2 .:2 A5:1 .:1 G5:1 .:1 E5:2 | D5:1 .:1 E5:1 .:1 C5:2 A4:2 .:2 E4:1 .:1 A4:2 B4:2 |' +
              'C5:1 .:1 C5:1 .:1 F5:2 .:2 A5:1 .:1 G5:1 .:1 F5:2 C5:2 | G5:1 .:1 D5:1 .:1 B4:2 G4:2 .:2 D5:2 G5:2 B5:2 |' +
              'E5:1 .:1 E5:1 .:1 A5:2 .:2 C6:1 .:1 B5:1 .:1 A5:2 E5:2 | G5:1 .:1 E5:1 .:1 C5:2 E5:2 .:2 A5:2 G5:2 E5:2 |' +
              'F5:2 E5:2 D5:2 C5:2 E5:2 D5:2 C5:2 B4:2 | G#4:2 B4:2 E5:2 G#5:2 B5:4 .:4' },
    B: { chords: 'Dm Dm Am Am F G E E',
         mel: 'D5:1 .:1 F5:1 .:1 A5:2 .:2 D6:1 .:1 C6:1 .:1 A5:2 F5:2 | F5:2 .:2 E5:2 D5:2 A4:4 .:4 |' +
              'E5:1 .:1 A5:1 .:1 C6:2 .:2 E5:1 .:1 A5:1 .:1 C6:2 A5:2 | B5:2 A5:2 G5:2 E5:2 A5:4 .:4 |' +
              'A5:1 .:1 F5:1 .:1 C5:2 F5:2 A5:2 C6:2 .:2 A5:2 | B5:1 .:1 G5:1 .:1 D5:2 G5:2 B5:2 D6:2 .:2 B5:2 |' +
              'G#5:2 E5:2 B4:2 E5:2 G#5:2 B5:2 G#5:2 E5:2 | E5:4 .:4 B4:2 C5:2 D5:2 E5:2' },
    C: { chords: 'Am F Dm E',
         mel: 'A5:1 E5:1 C5:1 E5:1 A5:1 E5:1 C5:1 E5:1 A5:1 E5:1 C6:1 E5:1 A5:1 E5:1 C5:1 E5:1 |' +
              'A5:1 F5:1 C5:1 F5:1 A5:1 F5:1 C5:1 F5:1 C6:1 A5:1 F5:1 A5:1 C6:1 A5:1 F5:1 A5:1 |' +
              'D6:1 A5:1 F5:1 A5:1 D6:1 A5:1 F5:1 A5:1 D6:1 A5:1 F5:1 D5:1 F5:1 A5:1 D6:1 A5:1 |' +
              'B5:2 G#5:2 E5:2 B4:2 G#5:4 E5:4' },
  },
},

// 9 · Luminous — a hymn: two pulses moving in thirds.
luminous: {
  title: 'Sunhalo Reach', key: 'D', scale: 'major', bpm: 104,
  bar: 16, beat: 4, sub: 2,
  lead: { duty: 0.5, vol: 0.8 }, bass: 'walk', harmony: 'thirds', drums: 'light',
  intense: { harmony: 'arp' },
  sections: {
    A: { chords: 'D A Bm F#m G D Em A',
         mel: 'F#5:4 E5:4 D5:4 F#5:4 | E5:8 C#5:4 E5:4 | D5:4 F#5:4 B5:4 A5:4 | A5:8 F#5:8 |' +
              'G5:4 F#5:4 E5:4 D5:4 | F#5:4 A5:4 D6:8 | B5:4 A5:4 G5:4 E5:4 | E5:8 C#5:4 A4:4' },
    B: { chords: 'G A F#m Bm Em A D D',
         mel: 'B5:6 A5:2 G5:4 D5:4 | C#6:6 B5:2 A5:8 | A5:4 F#5:4 C#5:4 F#5:4 | D6:8 B5:8 |' +
              'G5:4 B5:4 E6:4 D6:4 | C#6:4 B5:4 A5:4 E5:4 | F#5:4 A5:4 D6:4 A5:4 | D6:12 .:4' },
    C: { chords: 'Bm G Em F#',
         mel: 'B4:2 D5:2 F#5:2 B5:2 F#5:2 D5:2 B4:2 D5:2 | G5:4 B5:4 D6:4 B5:4 |' +
              'E5:2 G5:2 B5:2 E6:2 B5:2 G5:2 E5:2 G5:2 | A#5:4 C#6:4 F#5:8' },
  },
},

// 10 · Necrotic — a dirge. The flat fifth (E against B♭) is the region's colour.
necrotic: {
  title: 'Witherfen', key: 'Bb', scale: 'locrian', bpm: 72,
  bar: 16, beat: 4, sub: 2, calmBrighten: true,
  lead: { duty: 0.5, vol: 0.75, vibDepth: 20 }, bass: 'roots', harmony: 'broken', drums: 'bones',
  calm: { harmony: 'arp' },
  sections: {
    A: { chords: 'Bbm Gb Bbdim Bbm Ebm Gb B Bbm',
         mel: 'F4:8 E4:4 F4:4 | Gb4:6 F4:2 Db4:8 | E4:4 Db4:4 Bb3:8 | Bb3:12 .:4 |' +
              'Eb4:4 Gb4:4 Bb4:4 Ab4:4 | Gb4:8 F4:4 Db4:4 | F#4:4 D#4:4 B3:8 | Bb3:8 Db4:4 E4:4' },
    B: { chords: 'Ebm Ebm Bbm Bbm Gb B Bbdim Bbm',
         mel: 'Bb4:6 Ab4:2 Gb4:8 | Eb5:8 Db5:4 Bb4:4 | Db5:6 Bb4:2 F4:8 | E5:8 Db5:8 |' +
              'Gb4:4 Bb4:4 Db5:4 Gb5:4 | F#5:8 D#5:4 B4:4 | E5:4 Db5:4 Bb4:4 E4:4 | F4:12 .:4' },
    C: { chords: 'Bbm B Bbdim E',
         mel: 'Bb4:2 Db5:2 F5:2 Bb5:2 F5:2 Db5:2 Bb4:2 F4:2 | B4:2 D#5:2 F#5:2 B5:2 F#5:2 D#5:2 B4:2 F#4:2 |' +
              'Bb4:2 Db5:2 E5:2 Bb5:2 E5:2 Db5:2 Bb4:2 E4:2 | E5:4 G#5:4 B5:8' },
  },
},

// 11 · Poison — 7/8 (2+2+3), a lead that wobbles and a bass that crawls.
poison: {
  title: 'Venomvale', key: 'F#', scale: 'phrygian', bpm: 250,
  bar: 14, beat: 2, groups: [4, 4, 6], sub: 2, calmBrighten: true,
  lead: { duty: 0.25, vibDepth: 40 }, bass: 'creep', harmony: 'offbeat', drums: 'light',
  sections: {
    A: { chords: 'F#m G F#m G Em D G F#m',
         mel: 'F#4:2 G4:2 A4:2 G4:2 F#4:4 C#4:2 | G4:2 A4:2 B4:2 A4:2 G4:6 | A4:2 G4:2 F#4:2 E4:2 F#4:4 A4:2 |' +
              'B4:4 D5:4 C#5:2 B4:2 G4:2 | E5:2 D5:2 B4:2 G4:2 E4:6 | F#4:2 A4:2 D5:2 C#5:2 A4:6 |' +
              'B4:2 D5:2 G5:2 F#5:2 D5:2 B4:2 G4:2 | F#4:8 G4:2 F#4:4' },
    B: { chords: 'Bm Bm G G Em F#m G G',
         mel: 'B4:2 C#5:2 D5:2 C#5:2 B4:4 F#4:2 | D5:2 E5:2 F#5:2 E5:2 D5:6 | G5:4 F#5:4 E5:2 D5:2 B4:2 | D5:8 .:6 |' +
              'E5:2 F#5:2 G5:2 F#5:2 E5:4 B4:2 | C#5:2 D5:2 E5:2 D5:2 C#5:6 | B4:2 A4:2 G4:2 A4:2 B4:2 D5:2 G5:2 | F#5:6 G5:2 F#5:6' },
    C: { chords: 'F#m G Em C',
         mel: 'F#5:1 G5:1 F#5:2 C#5:2 A4:2 F#5:1 G5:1 F#5:2 C#5:2 | G5:1 A5:1 G5:2 D5:2 B4:2 G5:1 A5:1 G5:2 D5:2 |' +
              'E5:2 G5:2 B5:2 G5:2 E5:6 | C5:2 E5:2 G5:2 E5:2 C5:2 G4:2 E4:2' },
  },
},

// 12 · Mana — the NES fast-arpeggio chord, and a whole-tone turn in the middle.
mana: {
  title: 'Arcanum Reach', key: 'Ab', scale: 'lydian', bpm: 108,
  bar: 16, beat: 4, sub: 2,
  lead: { duty: 0.25 }, bass: 'walk', harmony: 'arpchord', drums: 'light',
  calm: { harmony: 'arpchord' },
  sections: {
    A: { chords: 'Ab Bb Cm Bb Fm Gm Eb Eb',
         mel: 'C5:4 Eb5:4 Ab5:6 G5:2 | F5:4 D5:4 Bb4:6 C5:2 | Eb5:4 G5:4 C6:4 Bb5:2 G5:2 | Bb5:12 .:4 |' +
              'Ab5:4 F5:4 C5:4 F5:4 | G5:4 Bb5:4 D6:4 C6:2 Bb5:2 | G5:4 Eb5:4 Bb4:4 Eb5:4 | G5:8 F5:4 D5:4' },
    B: { chords: 'Fm Caug Ab Caug Bb Gm Eb Eb',
         mel: 'F5:4 Ab5:4 C6:4 Ab5:4 | E5:4 G#5:4 C6:4 G#5:4 | Eb5:4 C5:4 Ab4:4 C5:4 | E5:2 F#5:2 G#5:2 A#5:2 C6:8 |' +
              'D5:4 F5:4 Bb5:4 F5:4 | G5:4 D5:4 Bb4:4 D5:4 | Eb5:4 G5:4 Bb5:4 G5:4 | Bb5:8 G5:4 Eb5:4' },
    C: { chords: 'Bb Caug Ab Eb',
         mel: 'D6:2 Bb5:2 F5:2 D5:2 F5:2 Bb5:2 D6:4 | C6:2 G#5:2 E5:2 C5:2 E5:2 G#5:2 C6:4 |' +
              'Ab5:2 Eb5:2 C5:2 Ab4:2 C5:2 Eb5:2 Ab5:4 | G5:4 Bb5:4 Eb5:8' },
  },
},

// 13 · Shadow — almost nothing: a heartbeat, a thin lead, and long silences.
// Its opening fall (5-3-2-1) is Elderbrook's cadence in a minor key.
shadow: {
  title: 'Duskfen', key: 'C#', scale: 'minor', bpm: 80,
  bar: 16, beat: 4, sub: 2, calmBrighten: true,
  lead: { duty: 0.125, vol: 0.6 }, bass: 'heart', harmony: 'none', drums: 'heartbeat',
  sections: {
    A: { chords: 'C#m C#m A A F#m F#m G# G#',
         mel: 'G#4:8 .:8 | .:8 E4:2 D#4:2 C#4:4 | E4:12 .:4 | .:16 |' +
              'A4:8 G#4:4 F#4:4 | C#5:12 .:4 | G#4:4 C5:4 D#5:8 | .:16' },
    B: { chords: 'A A F#m F#m D D G# G#',
         mel: 'C#5:8 .:4 B4:4 | A4:12 .:4 | .:8 F#4:4 A4:4 | C#5:16 |' +
              'D5:8 .:4 A4:4 | F#4:12 .:4 | G#4:4 .:4 G#4:4 .:4 | G#4:8 .:8' },
    C: { chords: 'C#m D C#m G#',
         mel: 'C#5:2 E5:2 G#5:2 C#6:2 G#5:2 E5:2 C#5:2 G#4:2 | D5:2 F#5:2 A5:2 D6:2 A5:2 F#5:2 D5:2 A4:2 |' +
              'E5:2 G#5:2 C#6:2 E6:2 C#6:2 G#5:2 E5:2 C#5:2 | D#5:4 G#5:4 C6:8' },
  },
},

// ═══ Places ═══════════════════════════════════════════════════════════════════

// The title screen: the forest motif, stated in full and in 4/4.
title: {
  title: 'Hero of Stormdrift', key: 'G', scale: 'major', bpm: 116,
  bar: 16, beat: 4, sub: 2,
  lead: { duty: 0.25 }, bass: 'march', harmony: 'offbeat', drums: 'march',
  sections: {
    A: { chords: 'G F C D G Em C D',
         mel: 'D5:6 B4:2 G4:4 B4:4 | C5:6 A4:2 F4:4 A4:4 | G4:2 A4:2 B4:2 C5:2 E5:4 D5:4 | D5:8 F#5:4 A5:4 |' +
              'G5:6 D5:2 B4:4 D5:4 | E5:6 B4:2 G4:4 B4:4 | C5:4 E5:4 G5:4 C6:4 | B5:4 A5:4 F#5:4 D5:4' },
    B: { chords: 'C D Bm Em C D G G',
         mel: 'E5:6 G5:2 C6:8 | D6:6 C6:2 A5:8 | B5:4 A5:4 F#5:4 D5:4 | E5:4 G5:4 B5:8 |' +
              'C6:4 B5:4 A5:4 G5:4 | F#5:4 G5:4 A5:4 D6:4 | G5:8 D5:4 B4:4 | G4:12 .:4' },
  },
},

// Elderbrook before the fire: warm and plain. Its closing fall G-E-D-C is the
// Shadow theme's opening, in a major key — the game never says so.
elderbrook: {
  title: 'Elderbrook', key: 'C', scale: 'major', bpm: 92,
  bar: 16, beat: 4, sub: 2,
  lead: { duty: 0.5, vol: 0.7 }, bass: 'walk', harmony: 'broken', drums: 'light',
  sections: {
    A: { chords: 'C F C G Am F G C', mel: ELDERBROOK_A },
    B: { chords: 'F G Em Am F G C C', mel: ELDERBROOK_B },
  },
},

// Elderbrook after the fire: the same tune in C minor, slower, no drums. While
// the village is actually burning (Ashfall, before the prologue completes) it
// plays in its intense arrangement. It is never calm: Elderbrook stays ruined.
ruins: {
  title: 'Ashfall', key: 'C', scale: 'minor', bpm: 72,
  bar: 16, beat: 4, sub: 2,
  lead: { duty: 0.5, vol: 0.6 }, bass: 'roots', harmony: 'none', drums: 'none',
  intense: { tempo: 1.4, bass: 'pulse', harmony: 'stabs', drums: 'rumble' },
  sections: {
    A: { chords: 'Cm Fm Cm Gm Ab Fm Gm Cm', mel: toCMinor(ELDERBROOK_A) },
    B: { chords: 'Fm Gm Eb Ab Fm Gm Cm Cm', mel: toCMinor(ELDERBROOK_B) },
  },
},

// A house: a music box in 3/4 and a clock.
house: {
  title: 'Hearthside', key: 'F', scale: 'major', bpm: 84,
  bar: 12, beat: 4, sub: 2,
  lead: { duty: 0.125, vol: 0.5, vib: false }, bass: 'waltz', harmony: 'pahs', drums: 'tick',
  sections: {
    A: { chords: 'F C Dm Am Bb F Gm C',
         mel: 'A5:4 C6:4 A5:4 | G5:4 E5:4 C5:4 | F5:4 A5:4 D6:4 | C6:8 E5:4 |' +
              'D6:4 Bb5:4 F5:4 | A5:4 F5:4 C5:4 | Bb5:4 G5:4 D5:4 | E5:8 .:4' },
    B: { chords: 'Bb C Am Dm Gm C F F',
         mel: 'F5:4 D5:4 Bb4:4 | E5:4 G5:4 C6:4 | A5:4 E5:4 C5:4 | D5:8 F5:4 |' +
              'G5:4 Bb5:4 D6:4 | C6:4 Bb5:4 G5:4 | A5:8 C5:4 | F5:8 .:4' },
  },
},

// Caves (in the region's key): dripping arpeggios over a low triangle.
cave: {
  title: 'Hidden Cave', key: 'A', scale: 'minor', bpm: 76,
  bar: 16, beat: 4, sub: 2,
  lead: { duty: 0.5, vol: 0.55 }, bass: 'roots', harmony: 'arp', drums: 'drip',
  sections: {
    A: { chords: 'Am Am F F Dm Dm E E',
         mel: 'E5:8 .:8 | .:8 C5:4 B4:4 | A4:12 .:4 | .:8 C5:4 F5:4 | E5:8 D5:8 | .:8 A4:4 F4:4 | G#4:8 B4:8 | E5:12 .:4' },
    B: { chords: 'C C G G F F E E',
         mel: 'G5:8 E5:8 | .:8 C5:4 E5:4 | D5:12 .:4 | .:8 B4:4 D5:4 | C5:8 A4:8 | .:8 F4:4 A4:4 | B4:8 G#4:8 | E4:12 .:4' },
    C: { chords: 'Am F Dm E',
         mel: 'A4:2 C5:2 E5:2 A5:2 E5:2 C5:2 A4:2 E4:2 | F4:2 A4:2 C5:2 F5:2 C5:2 A4:2 F4:2 C4:2 |' +
              'D5:2 F5:2 A5:2 D6:2 A5:2 F5:2 D5:2 A4:2 | E5:4 G#5:4 B5:8' },
  },
},

// Dungeons (in the region's key): a stepwise minor march.
dungeon: {
  title: 'Dungeon', key: 'D', scale: 'minor', bpm: 100,
  bar: 16, beat: 4, sub: 2,
  lead: { duty: 0.25 }, bass: 'march', harmony: 'offbeat', drums: 'march',
  sections: {
    A: { chords: 'Dm Dm C C Bb Bb A A',
         mel: 'D4:4 E4:4 F4:4 G4:4 | A4:8 G4:4 F4:4 | E4:4 F4:4 G4:4 A4:4 | G4:8 F4:4 E4:4 |' +
              'D4:4 F4:4 Bb4:4 A4:4 | G4:4 F4:4 D4:8 | C#4:4 E4:4 A4:4 G4:4 | E4:4 C#4:4 A3:8' },
    B: { chords: 'Gm Gm Dm Dm Bb C Dm A',
         mel: 'Bb4:4 A4:4 G4:4 D5:4 | C5:4 Bb4:4 A4:8 | F4:4 G4:4 A4:4 D5:4 | C5:4 A4:4 F4:8 |' +
              'D5:4 C5:4 Bb4:4 F4:4 | E4:4 G4:4 C5:8 | D5:4 A4:4 F4:4 D4:4 | C#4:4 E4:4 A4:8' },
    C: { chords: 'Dm Bb Gm A',
         mel: 'D5:2 F5:2 A5:2 F5:2 D5:2 A4:2 F4:2 A4:2 | Bb4:2 D5:2 F5:2 D5:2 Bb4:2 F4:2 D4:2 F4:2 |' +
              'G4:2 Bb4:2 D5:2 G5:2 D5:2 Bb4:2 G4:2 Bb4:2 | A4:4 C#5:4 E5:4 A5:4' },
  },
},

// Sky caves (in the region's key): airy, and everything echoes.
sky_cave: {
  title: 'Sky Cave', key: 'D', scale: 'lydian', bpm: 88,
  bar: 16, beat: 4, sub: 2, echoDelay: 4,
  lead: { duty: 0.25, vol: 0.65 }, bass: 'roots', harmony: 'echo', drums: 'none',
  sections: {
    A: { chords: 'D E D E Bm A G A',
         mel: 'A5:6 F#5:2 D5:8 | G#5:6 E5:2 B4:8 | F#5:4 A5:4 D6:8 | B5:12 .:4 |' +
              'D6:4 B5:4 F#5:8 | E5:4 A5:4 C#6:8 | B5:4 G5:4 D5:8 | E5:12 .:4' },
    B: { chords: 'G A F#m Bm G A D D',
         mel: 'D5:4 G5:4 B5:8 | C#6:4 A5:4 E5:8 | F#5:4 A5:4 C#6:8 | B5:12 .:4 |' +
              'G5:4 B5:4 D6:8 | C#6:4 E5:4 A5:8 | F#5:8 A5:8 | D6:12 .:4' },
  },
},

// Whirlpool grottos (in the region's key): chromatic swirls on a two-octave wave.
grotto: {
  title: 'Whirlpool Grotto', key: 'E', scale: 'minor', bpm: 104,
  bar: 16, beat: 4, sub: 2,
  lead: { duty: 0.25 }, bass: 'pedal', harmony: 'wave', drums: 'shuffle',
  sections: {
    A: { chords: 'Em Em C C Am Am B B',
         mel: 'E5:2 D#5:2 E5:2 G5:2 B5:4 A#5:2 B5:2 | G5:4 F#5:2 F5:2 E5:8 | E5:2 D#5:2 E5:2 G5:2 C6:4 B5:2 C6:2 |' +
              'G5:4 F#5:2 F5:2 E5:8 | C5:2 B4:2 C5:2 E5:2 A5:4 G#5:2 A5:2 | E5:4 D#5:2 D5:2 C5:8 |' +
              'D#5:2 E5:2 F#5:2 G5:2 A5:2 A#5:2 B5:4 | F#5:8 D#5:4 B4:4' },
    B: { chords: 'Am Am Em Em C B Em Em',
         mel: 'A4:4 C5:4 E5:4 A5:4 | G#5:4 A5:4 E5:8 | G4:4 B4:4 E5:4 G5:4 | F#5:4 G5:4 E5:8 |' +
              'E5:2 G5:2 C6:2 G5:2 E5:2 C5:2 G4:2 C5:2 | D#5:2 F#5:2 B5:2 F#5:2 D#5:2 B4:2 F#4:2 B4:2 | E5:4 B4:4 G4:4 B4:4 | E4:12 .:4' },
    C: { chords: 'Em C Am B',
         mel: 'E5:1 F5:1 E5:1 D#5:1 E5:2 B4:2 E5:1 F5:1 E5:1 D#5:1 E5:2 G5:2 | C6:1 C#6:1 C6:1 B5:1 C6:2 G5:2 E5:2 G5:2 C6:4 |' +
              'A5:2 G#5:2 G5:2 F#5:2 F5:2 E5:2 D#5:2 D5:2 | D#5:4 F#5:4 B5:8' },
  },
},

// Shrines (in the region's key): slow and patient — a puzzle, not a fight.
shrine: {
  title: 'Shrine', key: 'D', scale: 'dorian', bpm: 70,
  bar: 16, beat: 4, sub: 2,
  lead: { duty: 0.5, vol: 0.55 }, bass: 'roots', harmony: 'broken', drums: 'tick',
  sections: {
    A: { chords: 'Dm G Dm G F C G Dm',
         mel: 'A4:4 D5:4 E5:4 F5:4 | B4:8 D5:8 | A4:4 F5:4 E5:4 D5:4 | G4:12 .:4 |' +
              'C5:4 F5:4 A5:4 G5:4 | E5:8 G5:8 | D5:4 B4:4 G4:4 B4:4 | D5:12 .:4' },
    B: { chords: 'Am Em F G Am Em G G',
         mel: 'E5:4 A5:4 C6:8 | B5:8 G5:8 | A5:4 C6:4 F5:8 | G5:12 .:4 |' +
              'C6:4 B5:4 A5:4 E5:4 | G5:8 E5:8 | D5:4 G5:4 B5:4 A5:4 | G5:12 .:4' },
  },
},

// The castle tower: an ominous climb. Each floor nudges the tempo up, every
// fourth floor lifts the key a semitone (musicTarget), pulse 2 joins from
// floor 3 and the drums from floor 6.
tower: {
  title: 'Castle Tower', key: 'A', scale: 'harmonic', bpm: 92,
  bar: 16, beat: 4, sub: 2, levelTempo: 0.012, levelGate: { p2: 3, noi: 6 },
  lead: { duty: 0.25 }, bass: 'pulse', harmony: 'stabs', drums: 'driving',
  sections: {
    A: { chords: 'Am Am F F Dm Dm E E',
         mel: 'A4:4 C5:4 B4:2 A4:2 E5:4 | D5:4 C5:2 B4:2 A4:8 | F4:4 A4:4 G#4:2 A4:2 C5:4 | B4:4 A4:2 G#4:2 F4:8 |' +
              'D4:4 F4:4 E4:2 F4:2 A4:4 | G#4:4 A4:2 B4:2 D5:8 | E5:4 D5:2 C5:2 B4:4 G#4:4 | E4:12 .:4' },
    B: { chords: 'Am G F E Am G F E',
         mel: 'C5:4 E5:4 A5:8 | B5:4 G5:4 D5:8 | C5:4 F5:4 A5:8 | G#5:4 E5:4 B4:8 |' +
              'A5:2 G#5:2 A5:2 B5:2 C6:4 B5:2 A5:2 | G5:2 F#5:2 G5:2 A5:2 B5:4 A5:2 G5:2 |' +
              'F5:2 E5:2 F5:2 G5:2 A5:4 G#5:2 F5:2 | E5:8 D5:4 B4:4' },
    C: { chords: 'Am Bb Am E',
         mel: 'A5:2 E5:2 C5:2 E5:2 A5:2 E5:2 C6:4 | Bb5:2 F5:2 D5:2 F5:2 Bb5:2 F5:2 D6:4 |' +
              'C6:2 A5:2 E5:2 A5:2 C6:2 E6:2 C6:2 A5:2 | G#5:4 B5:4 E5:8' },
  },
},

// The final battle, once the dragon wakes. G minor against the forest's G
// major — and the third section is the forest motif itself, come home.
finale: {
  title: 'The Last Flight', key: 'G', scale: 'minor', bpm: 140,
  bar: 16, beat: 4, sub: 2,
  lead: { duty: 0.25 }, bass: 'octaves', harmony: 'stabs', drums: 'intense',
  intense: { harmony: 'stabs' },
  sections: {
    A: { chords: 'Gm Gm Eb F Gm Gm Eb D',
         mel: 'G4:2 G4:2 Bb4:2 D5:2 G5:4 F5:2 D5:2 | Eb5:2 D5:2 C5:2 Bb4:2 A4:4 Bb4:4 | G4:2 G4:2 Bb4:2 Eb5:2 G5:4 F5:2 Eb5:2 |' +
              'F5:4 C5:4 A4:4 C5:4 | D5:2 D5:2 G5:2 Bb5:2 D6:4 C6:2 Bb5:2 | A5:2 G5:2 F5:2 D5:2 G5:8 |' +
              'Eb5:2 G5:2 Bb5:2 G5:2 Eb5:2 Bb4:2 G4:2 Bb4:2 | A4:4 D5:4 F#5:4 A5:4' },
    B: { chords: 'Cm Cm Gm Gm Ab Ab D D',
         mel: 'C5:2 Eb5:2 G5:2 C6:2 G5:2 Eb5:2 C5:2 Eb5:2 | D5:4 Eb5:4 F5:4 G5:4 | Bb4:2 D5:2 G5:2 Bb5:2 G5:2 D5:2 Bb4:2 D5:2 |' +
              'C5:4 D5:4 Eb5:4 F5:4 | Ab5:4 G5:4 F5:4 Eb5:4 | C6:4 Bb5:4 Ab5:4 Eb5:4 |' +
              'D5:2 F#5:2 A5:2 D6:2 A5:2 F#5:2 D5:2 A4:2 | D5:8 A4:4 F#4:4' },
    C: { chords: 'G F C G Em C F D',
         mel: 'D5:6 B4:2 G4:4 B4:4 | C5:6 A4:2 F4:4 A4:4 | G4:2 A4:2 B4:2 C5:2 E5:4 D5:4 | D5:12 B4:2 D5:2 |' +
              'E5:6 D5:2 B4:4 G4:4 | C5:4 E5:4 G5:8 | F5:4 E5:4 D5:4 C5:4 | D5:8 F#5:4 A5:4' },
  },
},

};
