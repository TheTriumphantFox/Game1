#!/usr/bin/env python3
"""Synthesize dragon-roar.wav for The RPG Game's prologue Beat 3.

The script's cue is "a long way off, a roar" — so this is deliberately a DISTANT
roar: slow attack, heavy low-pass (air absorbs highs over distance), and a long
reverberant tail off the treeline. Nothing here is sampled; it is built from
oscillators and noise so the file can be committed without a licence question.

Structure:
  * a low fundamental gliding 82 Hz -> 48 Hz, with 6 harmonics
  * a 27 Hz amplitude "growl" plus a slower 5.5 Hz wobble, for the rasp
  * band-limited noise for breath, enveloped to swell after the voice starts
  * one-pole low-pass at ~800 Hz for distance
  * three decaying delay taps as a crude valley reverb
"""

import math
import random
import struct
import wave

SR = 22050
DUR = 3.2
N = int(SR * DUR)
random.seed(20260810)   # reproducible: same file every run


def env(i):
    """Overall amplitude envelope: slow swell, held, long fall."""
    t = i / N
    if t < 0.18:
        return (t / 0.18) ** 1.6                      # distant swell, not a crack
    if t < 0.45:
        return 1.0
    return max(0.0, (1.0 - (t - 0.45) / 0.55)) ** 1.5  # long fall


def breath_env(i):
    """Breath noise comes in under the voice and outlasts it slightly."""
    t = i / N
    if t < 0.25:
        return (t / 0.25) ** 2
    return max(0.0, 1.0 - (t - 0.25) / 0.75) ** 1.2


voice_phase = 0.0
samples = []
for i in range(N):
    t = i / SR
    frac = i / N

    # Fundamental glides down as the breath runs out.
    f0 = 82.0 - 34.0 * (frac ** 0.7)
    voice_phase += 2 * math.pi * f0 / SR

    # Harmonic stack. Slight detune per partial gives the rasp some width.
    v = 0.0
    for h, amp in ((1, 1.0), (2, 0.62), (3, 0.40), (4, 0.24), (5, 0.13), (6, 0.07)):
        detune = 1.0 + (h - 1) * 0.0015
        v += amp * math.sin(voice_phase * h * detune)
    v /= 2.46

    # Growl: fast AM for the rasp, slow AM for the heave of the lungs.
    growl = 1.0 - 0.34 * (0.5 + 0.5 * math.sin(2 * math.pi * 27.0 * t))
    heave = 1.0 - 0.16 * (0.5 + 0.5 * math.sin(2 * math.pi * 5.5 * t))
    v *= growl * heave

    n = random.uniform(-1.0, 1.0)
    samples.append(v * env(i) * 0.80 + n * breath_env(i) * 0.42)

# ── Band-limit the breath and the whole signal for distance ──────────────────
# Two cascaded one-pole low-passes at ~800 Hz. Over a few hundred metres of air
# the top end is simply gone, and that is most of what makes a sound read as far
# away rather than quiet.
def lowpass(buf, cutoff):
    a = math.exp(-2 * math.pi * cutoff / SR)
    y = 0.0
    out = []
    for x in buf:
        y = (1 - a) * x + a * y
        out.append(y)
    return out


samples = lowpass(lowpass(samples, 800.0), 1400.0)

# High-pass (subtract a very low one-pole) to stop DC/rumble build-up.
low = lowpass(samples, 28.0)
samples = [s - l for s, l in zip(samples, low)]

# ── Valley reverb: a few decaying taps off the treeline ──────────────────────
out = list(samples)
for delay_ms, gain in ((95, 0.34), (185, 0.20), (330, 0.11), (520, 0.06)):
    d = int(SR * delay_ms / 1000)
    for i in range(d, len(out)):
        out[i] += samples[i - d] * gain
# The tail needs somewhere to go, so pad and let the last taps ring out.
tail = int(SR * 0.6)
out.extend(0.0 for _ in range(tail))
for delay_ms, gain in ((95, 0.34), (185, 0.20), (330, 0.11), (520, 0.06)):
    d = int(SR * delay_ms / 1000)
    for i in range(len(samples), min(len(out), len(samples) + d)):
        src = i - d
        if 0 <= src < len(samples):
            out[i] += samples[src] * gain

# Fade the very end so the file cannot click on the last sample.
fade = int(SR * 0.25)
for k in range(fade):
    out[len(out) - fade + k] *= (1 - k / fade)

peak = max(abs(s) for s in out) or 1.0
scale = 0.88 / peak
pcm = b''.join(struct.pack('<h', int(max(-1.0, min(1.0, s * scale)) * 32767)) for s in out)

path = r'C:\Users\corte\MACortese42\Game1\Game1\dragon-roar.wav'
with wave.open(path, 'wb') as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm)

print(f'wrote {path}')
print(f'  {len(out)} frames, {len(out)/SR:.2f}s, {len(pcm)+44} bytes')
