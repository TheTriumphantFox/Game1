#!/usr/bin/env python3
"""Cut the game's four dragon roars from Breviceps' CC0 recording.

Source: Breviceps, "Dragon: Several roars, growls and snarls",
https://freesound.org/s/479380/ (Creative Commons 0, public domain).
The original is a 60 s, 48 kHz stereo WAV of 11 MB; only the cuts are
committed, as small mono files.

    python3 tools/cut-dragon-roars.py SOURCE.wav --list
        Finds every separate sound in the recording (runs above a level,
        split at gaps of quiet) and prints start, length and loudness.
    python3 tools/cut-dragon-roars.py SOURCE.wav --audition DIR
        Writes each found sound to DIR as cand-NN.wav for listening.
    python3 tools/cut-dragon-roars.py SOURCE.wav
        Writes the four game files, using the cut points in CUTS below.

Every game file is mono, 22.05 kHz, 16-bit (the old generated roar's
format), faded in and out so it cannot click, and peak-normalised to
PEAK. The far roar is also low-passed and given a short echo, because
Beat 3's line is "a long way off, a roar". Needs ffmpeg on PATH.
"""

import argparse
import os
import struct
import subprocess
import sys
import wave

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.dirname(HERE)
PEAK = 0.89          # -1 dB: room under full scale without sounding quiet
SR_OUT = 22050

# name -> (start s, end s) in the source, from --list (candidate numbers in
# the comments). Chosen by measurement, not by ear: the recording repeats some
# takes (00/08, 02/07 and 04/05 measure nearly alike), so each pick differs in
# shape. Swap a pair of numbers here to use a different take.
CUTS = {
    'strike':  (40.62, 45.98),   # 09: the loudest in the file, deep, peaks at 0.6 s
    'wake':    (56.18, 59.88),   # 12: slowest to build, the only one rising in pitch
    'wounded': (8.16, 10.36),    # 02: short and bright, falls 790 -> 210 Hz like a cry
    'far':     (10.92, 14.68),   # 03: the deepest and steadiest; survives the muffling
}
# The far roar: everything above this is "too close" (air eats highs over
# distance), plus a few echoes off the treeline.
FAR_FILTER = 'lowpass=f=700,aecho=0.8:0.6:180|420|760:0.35|0.22|0.12,volume=0.9'


def mono_samples(path):
    """Decode any audio file to mono float samples at 22.05 kHz via ffmpeg."""
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR_OUT),
                          '-f', 's16le', '-'], check=True, capture_output=True).stdout
    n = len(raw) // 2
    return [v / 32768 for v in struct.unpack('<%dh' % n, raw)]


def find_sounds(x, sr=SR_OUT, win_s=0.02, on_db=-30, gap_s=0.35, min_s=0.4):
    """Runs of 20 ms windows louder than on_db (relative to the loudest window),
    merged across gaps shorter than gap_s. Returns [(start, end, peak, rms)]."""
    win = int(sr * win_s)
    rms = []
    for i in range(0, len(x) - win, win):
        seg = x[i:i + win]
        rms.append((sum(v * v for v in seg) / win) ** 0.5)
    top = max(rms) or 1
    thr = top * 10 ** (on_db / 20)
    runs, cur = [], None
    for i, r in enumerate(rms):
        if r >= thr:
            if cur and (i - cur[1]) * win_s <= gap_s:
                cur[1] = i
            else:
                if cur: runs.append(cur)
                cur = [i, i]
    if cur: runs.append(cur)
    out = []
    for a, b in runs:
        s, e = a * win_s, (b + 1) * win_s
        if e - s < min_s: continue
        seg = x[int(s * sr):int(e * sr)]
        out.append((s, e, max(abs(v) for v in seg), max(rms[a:b + 1])))
    return out


def write_cut(src, start, end, dest, extra=None):
    """Trim, fade 15 ms in and 120 ms out, apply `extra`, normalise to PEAK."""
    dur = end - start
    af = f'afade=t=in:d=0.015,afade=t=out:st={max(0, dur - 0.12):.3f}:d=0.12'
    if extra: af += ',' + extra
    tmp = dest + '.tmp.wav'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{start:.3f}', '-t', f'{dur + (1.2 if extra else 0):.3f}',
                    '-i', src, '-ac', '1', '-ar', str(SR_OUT), '-af', af, '-c:a', 'pcm_s16le', tmp], check=True)
    with wave.open(tmp) as w:
        frames = w.readframes(w.getnframes())
    vals = struct.unpack('<%dh' % (len(frames) // 2), frames)
    gain = PEAK * 32767 / max(1, max(abs(v) for v in vals))
    vals = [max(-32768, min(32767, int(round(v * gain)))) for v in vals]
    with wave.open(dest, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR_OUT)
        w.writeframes(struct.pack('<%dh' % len(vals), *vals))
    os.remove(tmp)
    return len(vals) / SR_OUT


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('source')
    ap.add_argument('--list', action='store_true')
    ap.add_argument('--audition')
    a = ap.parse_args()
    x = mono_samples(a.source)
    sounds = find_sounds(x)
    if a.list or a.audition:
        print(f'{len(x) / SR_OUT:.1f} s of audio, {len(sounds)} separate sounds')
        for i, (s, e, pk, r) in enumerate(sounds):
            print(f'  {i:2d}  {s:6.2f}-{e:6.2f}  {e - s:5.2f} s  peak {pk:.2f}  loudest 20 ms {r:.3f}')
            if a.audition:
                os.makedirs(a.audition, exist_ok=True)
                write_cut(a.source, s, e, os.path.join(a.audition, f'cand-{i:02d}.wav'))
        return
    missing = [k for k, v in CUTS.items() if not v]
    if missing: sys.exit('no cut points yet for: ' + ', '.join(missing) + ' (run --list)')
    for name, (s, e) in CUTS.items():
        dest = os.path.join(GAME, f'dragon-roar-{name}.wav')
        secs = write_cut(a.source, s, e, dest, FAR_FILTER if name == 'far' else None)
        print(f'{os.path.basename(dest)}: {secs:.2f} s, {os.path.getsize(dest) // 1024} KB')


if __name__ == '__main__':
    main()
