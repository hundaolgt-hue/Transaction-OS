import numpy as np, wave, math
SR = 48000
DUR = 60.0
N = int(SR * DUR)
rng = np.random.default_rng(7)
L = np.zeros(N); R = np.zeros(N)
REVL = np.zeros(N); REVR = np.zeros(N)   # reverb send

def midi(m): return 440.0 * 2 ** ((m - 69) / 12)
def put(buf, start, sig, gain=1.0):
    i = int(start * SR)
    if i >= N: return
    if i < 0: sig = sig[-i:]; i = 0
    n = min(len(sig), N - i)
    buf[i:i + n] += sig[:n] * gain
def add(start, sig, gain=1.0, pan=0.0, send=0.0):
    gl = math.cos((pan + 1) * math.pi / 4); gr = math.sin((pan + 1) * math.pi / 4)
    put(L, start, sig, gain * gl * 1.414); put(R, start, sig, gain * gr * 1.414)
    if send: put(REVL, start, sig, gain * send * gl); put(REVR, start, sig, gain * send * gr)
def tarr(d): return np.arange(int(d * SR)) / SR
def onepole(x, fc):  # fc: scalar or array
    fc = np.broadcast_to(np.asarray(fc, float), x.shape)
    a = np.exp(-2 * np.pi * fc / SR); y = np.empty_like(x); s = 0.0
    for i in range(len(x)):
        s = (1 - a[i]) * x[i] + a[i] * s; y[i] = s
    return y

# ---------------- scene grid ----------------
STARTS = [0, 4.55, 9.6, 16.5, 23.2, 28.3, 34.3, 40.5, 45.5, 50.5, 55.8]
CHORDS = [  # midi notes (D major world)
    [50, 57, 62, 64, 69],      # Dadd9
    [50, 57, 62, 66, 69, 76],  # Dmaj9-ish
    [47, 54, 59, 62, 66, 73],  # Bm9
    [43, 50, 55, 59, 62, 69],  # Gmaj9
    [45, 52, 57, 61, 64, 71],  # A6/9
    [47, 54, 59, 62, 66, 69],  # Bm7
    [43, 50, 55, 62, 66, 71],  # Gmaj7
    [42, 49, 54, 57, 61, 69],  # F#m7
    [43, 50, 55, 59, 62, 69],  # Gmaj9
    [45, 52, 57, 59, 64, 69],  # Asus
    [38, 50, 57, 62, 66, 69, 76],  # D (final bloom)
]

# ---------------- pad ----------------
def pad_note(f, d, bright=1.0):
    t = tarr(d); sig = np.zeros_like(t)
    for det in (-0.0035, 0.0, 0.0035):
        ph = rng.uniform(0, 2 * np.pi)
        for hmn in range(1, 7):
            amp = 1 / hmn ** (1.9 - 0.4 * bright)
            sig += amp * np.sin(2 * np.pi * f * (1 + det) * hmn * t + ph * hmn)
    lfo = 0.85 + 0.15 * np.sin(2 * np.pi * 0.23 * t + rng.uniform(0, 6))
    return sig * lfo / 6
def env_ar(n, a, r):
    e = np.ones(n); na = int(a * SR); nr = int(r * SR)
    e[:na] = np.linspace(0, 1, na) ** 2
    if nr: e[-nr:] *= np.linspace(1, 0, nr) ** 1.5
    return e
for k, st in enumerate(STARTS):
    en = STARTS[k + 1] if k + 1 < len(STARTS) else DUR
    d = en - st + 1.6
    if k == len(STARTS) - 1: d = DUR - st
    ch = CHORDS[k]
    for j, m in enumerate(ch):
        s = pad_note(midi(m), d, bright=0.6 + 0.4 * (k / 10)) * env_ar(int(d * SR), 1.0 if k else 2.5, 1.6 if k < 10 else 2.2)
        g = 0.05 if m > 55 else 0.06
        if k == 0: g *= 0.7
        add(st - (0 if k == 0 else 0.25), s, g, pan=(-0.5 + j / max(1, len(ch) - 1)) * 0.8, send=0.5)
    # sub root
    root = midi(ch[0] - 12 if ch[0] > 40 else ch[0])
    t = tarr(d); sub = np.sin(2 * np.pi * root * t) * env_ar(len(t), 0.8, 1.2)
    add(st, sub, 0.10 if k >= 2 else 0.06)

# ---------------- percussion ----------------
def kick(g=1.0):
    t = tarr(0.6); f = 42 + 85 * np.exp(-t / 0.045)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return (np.sin(ph) * np.exp(-t / 0.22) + 0.15 * rng.standard_normal(len(t)) * np.exp(-t / 0.004)) * g
def hat():
    t = tarr(0.08); n = rng.standard_normal(len(t)); n = np.diff(np.concatenate([[0], n]))
    return n * np.exp(-t / 0.018) * 0.5
BPM = 112; beat = 60 / BPM
tb = 9.6
while tb < 55.4:
    inbar = round((tb - 9.6) / beat) % 4
    add(tb, kick(), 0.30 if inbar in (0, 2) else 0.18)
    add(tb + beat / 2, hat(), 0.05, pan=0.3)
    if inbar in (1, 3): add(tb, hat(), 0.035, pan=-0.3)
    tb += beat

# arpeggio plucks (16ths at low level) from scene 3 on
def pluck(f, d=0.5):
    t = tarr(d); e = np.exp(-t / 0.16)
    return (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t) * np.exp(-t / 0.05)) * e
tb = 9.6; idx = 0
while tb < 55.4:
    k = max(i for i, s in enumerate(STARTS) if s <= tb + 1e-6)
    ch = CHORDS[k]; tones = [m + 12 for m in ch[1:]]
    pattern = [0, 2, 1, 3, 2, 4, 1, 3]
    m = tones[pattern[idx % 8] % len(tones)]
    add(tb, pluck(midi(m)), 0.035 + 0.015 * (idx % 4 == 0), pan=0.5 * math.sin(idx * 0.9), send=0.6)
    tb += beat / 2; idx += 1

# ---------------- FX ----------------
def tick(f=3200, g=1.0):
    t = tarr(0.05)
    return (np.sin(2 * np.pi * f * t) * np.exp(-t / 0.008) + 0.12 * rng.standard_normal(len(t)) * np.exp(-t / 0.0015)) * g
def blip(f, d=0.35):
    t = tarr(d); return (np.sin(2 * np.pi * f * t) + 0.2 * np.sin(6 * np.pi * f * t)) * np.exp(-t / 0.09)
def whoosh(d=1.1, peak=0.85):
    n = int(d * SR); x = rng.standard_normal(n); t = np.arange(n) / n
    env = np.where(t < peak, (t / peak) ** 2.5, np.exp(-(t - peak) / (1 - peak) * 4))
    fc = 200 + 2600 * env
    return onepole(onepole(x, fc), fc) * env * 1.6
def impact(g=1.0):
    t = tarr(2.4); f = 32 + 40 * np.exp(-t / 0.12)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.7)
    nz = onepole(onepole(rng.standard_normal(len(t)), 500), 500) * np.exp(-t / 0.25) * 3.0
    return (body + nz) * g
def riser(d, f0, f1):
    t = tarr(d); f = f0 * (f1 / f0) ** (t / d)
    ph = 2 * np.pi * np.cumsum(f) / SR
    e = (t / d) ** 1.8
    return (np.sin(ph) + 0.3 * np.sin(2 * ph)) * e * 0.5
def bell(f, d=3.0):
    t = tarr(d); s = np.zeros_like(t)
    for r_, a, dec in ((1, 1, 1.4), (2.01, .5, .7), (3.02, .25, .4), (4.17, .15, .25)):
        s += a * np.sin(2 * np.pi * f * r_ * t) * np.exp(-t / dec)
    return s * np.minimum(1, t * 400)

# S1 words
for i, tt in enumerate([0.45, 1.55, 2.65]):
    add(tt, bell(midi([74, 76, 78][i]), 2.5), 0.06, pan=[-.3, .3, 0][i], send=0.9)
    add(tt, kick(0.5), 0.15)
add(3.75, whoosh(1.05, .93), 0.22, send=0.4)
add(3.6, riser(1.15, 200, 1600), 0.05, send=0.5)
add(4.72, impact(), 0.45, send=0.5)
# logo
add(4.75, riser(1.5, 600, 1200), 0.02, send=1)
for j, m in enumerate([74, 78, 81, 86]):
    add(5.75 + j * 0.06, bell(midi(m), 3.5), 0.05, pan=-.4 + j * .27, send=1.0)
for i in range(5): add(5.8 + i * 0.07, tick(5200 - i * 200, .4), 0.08, pan=-.3 + i * .15)
# transitions
for st in STARTS[2:]:
    add(st - 0.95, whoosh(1.1, .86), 0.10, pan=0, send=0.35)
    add(st, impact(0.55 if st < 55 else 1.0), 0.28 if st < 55 else 0.5, send=0.4)
# S3 counter ticks
def eoe(x): return 1 if x >= 1 else 1 - 2 ** (-10 * x)
last = -1; lastt = -1
for i in range(0, 3000):
    tt = 9.6 + 0.3 + i * 0.001
    v = round(80 * eoe(min(1, max(0, (tt - 9.9) / 2.5))))
    if v != last and tt - lastt > 0.03:
        add(tt, tick(2600 + v * 12, .5), 0.07, pan=0.2 * math.sin(v)); last = v; lastt = tt
PENTA = [62, 64, 66, 69, 71, 74, 76, 78, 81, 83, 86, 88]
for i in range(10): add(9.6 + 4.4 + i * 0.1, blip(midi(PENTA[i])), 0.05, pan=-.4 + i * .08, send=.6)
# S4 BOQ rows + total
for i in range(8): add(16.5 + 1.0 + i * 0.17, tick(3000 + i * 150, .8), 0.09, pan=.3)
for i in range(8): add(16.5 + 1.35 + i * 0.17 + .9, blip(midi(PENTA[i + 2]), .25), 0.03, pan=-.2)
add(16.5 + 3.1, riser(2.5, 300, 1400), 0.035, send=.6)
add(16.5 + 5.55, bell(midi(81), 3), 0.08, send=1); add(16.5 + 5.55, bell(midi(86), 3), 0.05, send=1)
# S5 bars
for i in range(12): add(23.2 + 0.7 + i * 0.1, blip(midi(PENTA[11 - i] if i < 12 else 62)), 0.045, pan=-.5 + i * .09, send=.6)
add(23.2 + 4.2, bell(midi(78), 2.5), 0.06, send=1)
# S6 gantt rows
for i in range(23): add(28.3 + 0.7 + i * 0.07, tick(2400 + (i % 6) * 220, .6), 0.06, pan=-.4 + (i % 9) * .1)
add(28.3 + 2.4, riser(2.2, 250, 900), 0.03, send=.6)
for i in range(3): add(28.3 + 3.4 + i * .18 + 1.6, blip(midi([74, 78, 81][i])), 0.05, send=.7)
# S7 s-curve
add(34.3 + 1.6, riser(3.3, 180, 1100), 0.05, send=.7)
for m in range(1, 12): add(34.3 + 1.6 + 3.3 * (m / 11) ** 1.0 * 0.95, tick(2800 + m * 90, .6), 0.06, pan=-.5 + m * .09)
add(34.3 + 5.0, bell(midi(81), 3), 0.08, send=1); add(34.3 + 5.0, bell(midi(85), 3), 0.04, send=1)
# S8 donut
for i, tt in enumerate([0.65, 1.9, 2.45, 2.75]): add(40.5 + tt, blip(midi([69, 74, 78, 81][i]), .4), 0.05, send=.7)
for i in range(4): add(40.5 + 1.6 + i * .14, tick(3400, .6), 0.06, pan=.3)
# S9 tiles
for i in range(4):
    add(45.5 + 0.6 + i * 0.2 - 0.15, whoosh(0.45, .6), 0.05, pan=-.5 if i % 2 == 0 else .5)
    add(45.5 + 0.6 + i * 0.2 + 1.85, blip(midi([74, 78, 81, 86][i])), 0.045, send=.7)
# S10 dashboard
for i in range(10): add(50.5 + 0.8 + i * 0.1, tick(3000 + i * 120, .6), 0.06, pan=-.4 + i * .08)
add(50.5 + 2.6, whoosh(1.6, .5), 0.06, pan=.4)
# end
for j, m in enumerate([62, 69, 74, 78, 81]):
    add(55.8 + 0.7 + j * 0.05, bell(midi(m), 4.5), 0.06, pan=-.5 + j * .25, send=1.2)

# ---------------- reverb ----------------
def conv(x, ir):
    n = len(x) + len(ir); nf = 1 << (n - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, nf) * np.fft.rfft(ir, nf), nf)[:len(x)]
ti = tarr(3.0)
irL = onepole(rng.standard_normal(len(ti)), 4500) * np.exp(-ti / 0.75); irR = onepole(rng.standard_normal(len(ti)), 4500) * np.exp(-ti / 0.75)
irL /= np.sqrt((irL ** 2).sum()); irR /= np.sqrt((irR ** 2).sum())
L += conv(REVL, irL) * 0.9; R += conv(REVR, irR) * 0.9

# ---------------- master ----------------
L = onepole(L, 11000); R = onepole(R, 11000)
mix = np.stack([L, R], 1)
t = np.arange(N) / SR
fade = np.minimum(1, t / 0.4) * np.clip((DUR - t) / 2.0, 0, 1) ** 1.5
mix *= fade[:, None]
mix = np.tanh(mix * 1.6) / 1.6
mix /= np.abs(mix).max() / 0.89
pcm = (mix * 32767).astype(np.int16)
with wave.open('score.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('ok', np.sqrt((mix ** 2).mean()))
