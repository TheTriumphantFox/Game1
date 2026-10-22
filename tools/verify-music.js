// verify-music.js — node check of the song data. No browser needed.
//
//   node tools/verify-music.js            # validate every song, every mood
//   node tools/verify-music.js forest     # also print that song's arrangements
//
// Loads music-songs.js and music.js the way the page does (classic scripts
// sharing one global scope) and runs musicValidateSongs(): every section's
// melody must span its chords in whole bars, every style must exist, and every
// song must render in calm, normal and intense. Exit code 1 on any problem.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const ctx = vm.createContext({ console, Math, JSON, Object, Array, Set, Number, String, Error, parseInt });
for (const f of ['music-songs.js', 'music.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
}
const problems = vm.runInContext('musicValidateSongs()', ctx);
const ids = vm.runInContext('Object.keys(MUSIC_SONGS)', ctx);

for (const id of process.argv.slice(2)) {
  const summary = vm.runInContext(`(${(function (id) {
    return ['calm', 'normal', 'intense'].map(m => {
      const a = renderArrangement(id, m, {});
      const steps = a.sections.reduce((n, s) => n + s.len, 0);
      return `${m.padEnd(8)} ${a.sections.map(s => s.name + '×' + s.len / a.bar).join(' ')}  ` +
             `${(steps * a.stepDur).toFixed(1)}s loop, step ${(a.stepDur * 1000).toFixed(0)}ms`;
    }).join('\n');
  }).toString()})(${JSON.stringify(id)})`, ctx);
  console.log(`── ${id}\n${summary}`);
}

console.log(`${ids.length} songs: ${ids.join(', ')}`);
if (problems.length) {
  console.log(`${problems.length} problem(s):\n  ` + problems.join('\n  '));
  process.exit(1);
}
console.log('all songs valid in every mood');
