// ─── Dialogue box ─────────────────────────────────────────────────────────────
// A speaker-attributed, multi-line conversation box with a typewriter reveal and
// press-to-advance. Built for the prologue's scripted beats, but deliberately
// generic: `startDialogue(lines, onDone)` knows nothing about the prologue and
// villagers.js can adopt it for real conversations later.
//
// What was here before: villagers fired a single random string from VILLAGER_CHAT
// through showMsg() as a 5-second toast (see tryVillagerInteraction). That's still
// there and still fine for ambient one-liners — this is the system for lines that
// are *written*, where who is speaking and what order it comes in both matter.
//
// The box sits in the bottom third and does NOT black out the scene, because the
// prologue needs the player to watch the village burn while the grandmother talks.
// That's why it isn't a .shop-overlay.
//
// Input: `dialogueOpen` gates gameplay keys in main.js exactly the way shopOpen
// and victoryOpen do. Space / Enter / click advances.

let dialogueOpen = false;

let _dlgLines = [];         // queue of { speaker, text, paren }
let _dlgIndex = 0;          // which line is showing
let _dlgOnDone = null;      // callback fired after the last line is dismissed
let _dlgRevealed = 0;       // characters of the current line revealed so far
let _dlgTimer = 0;          // ms accumulated toward the next character

// Milliseconds per revealed character. Slow enough to read at, fast enough that
// nobody sits waiting — and skippable, so it never costs the player time.
const DLG_CHAR_MS = 22;

// Open a conversation. `lines` is an array of:
//   { speaker: 'GRANDMOTHER', text: 'There you are.', paren: 'weak, but steady' }
// `speaker` and `paren` are both optional — a line with neither is narration.
// `onDone` fires once, after the final line is dismissed.
//
// Calling this while a conversation is already open replaces it. That's a bug
// in the caller rather than a supported use, but replacing beats deadlocking.
function startDialogue(lines, onDone) {
  if (!lines || !lines.length) { if (onDone) onDone(); return; }
  _dlgLines = lines;
  _dlgIndex = 0;
  _dlgOnDone = onDone || null;
  dialogueOpen = true;
  document.getElementById('dialogue-overlay').classList.add('open');
  _showDialogueLine();
}

// Render the current line with nothing revealed yet; the typewriter fills it in
// from stepDialogue().
function _showDialogueLine() {
  const line = _dlgLines[_dlgIndex] || {};
  const nameEl  = document.getElementById('dialogue-speaker');
  const parenEl = document.getElementById('dialogue-paren');
  const textEl  = document.getElementById('dialogue-text');

  nameEl.textContent = line.speaker || '';
  nameEl.style.display = line.speaker ? '' : 'none';
  parenEl.textContent = line.paren ? `(${line.paren})` : '';
  parenEl.style.display = line.paren ? '' : 'none';
  // Narration (no speaker) reads as stage direction, not as someone talking.
  textEl.classList.toggle('narration', !line.speaker);
  textEl.textContent = '';

  _dlgRevealed = 0;
  _dlgTimer = 0;
  _updateDialoguePrompt();
}

// Advance the typewriter. Called every frame from update() in main.js — note it
// runs *before* the freeze early-return, so text keeps revealing while the world
// is paused underneath.
function stepDialogue(dt) {
  if (!dialogueOpen) return;
  const line = _dlgLines[_dlgIndex];
  if (!line) return;
  const full = line.text || '';
  if (_dlgRevealed >= full.length) return;

  _dlgTimer += dt;
  while (_dlgTimer >= DLG_CHAR_MS && _dlgRevealed < full.length) {
    _dlgTimer -= DLG_CHAR_MS;
    _dlgRevealed++;
  }
  document.getElementById('dialogue-text').textContent = full.slice(0, _dlgRevealed);
  if (_dlgRevealed >= full.length) _updateDialoguePrompt();
}

// The ▼ blinker only appears once the line is fully revealed, so it reads as
// "ready for you" rather than as decoration.
function _updateDialoguePrompt() {
  const line = _dlgLines[_dlgIndex] || {};
  const done = _dlgRevealed >= (line.text || '').length;
  const el = document.getElementById('dialogue-prompt');
  el.style.visibility = done ? 'visible' : 'hidden';
}

// Space / Enter / click. First press completes a still-typing line; the next
// moves to the following line, or closes on the last.
function advanceDialogue() {
  if (!dialogueOpen) return;
  const line = _dlgLines[_dlgIndex];
  const full = (line && line.text) || '';
  if (_dlgRevealed < full.length) {
    _dlgRevealed = full.length;
    document.getElementById('dialogue-text').textContent = full;
    _updateDialoguePrompt();
    return;
  }
  _dlgIndex++;
  if (_dlgIndex >= _dlgLines.length) { closeDialogue(); return; }
  _showDialogueLine();
}

function closeDialogue() {
  dialogueOpen = false;
  document.getElementById('dialogue-overlay').classList.remove('open');
  // Drop any keys held while the box was up. The shop modals do the same on
  // close (see closeShopModals) because a key pressed during an overlay never
  // gets its keyup routed to the gameplay handler, and the player walks off on
  // their own the moment control returns.
  if (typeof clearAllKeys === 'function') clearAllKeys();
  const cb = _dlgOnDone;
  _dlgLines = [];
  _dlgIndex = 0;
  _dlgOnDone = null;
  if (cb) cb();
}

// Convenience for a single unattributed line — used for the script's narration
// beats ("Beat. Silence. Then a distant roar.").
function sayNarration(text, onDone) {
  startDialogue([{ text }], onDone);
}
