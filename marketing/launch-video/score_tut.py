import numpy as np, wave, math
SR = 48000
DUR = 50.0
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
STARTS = [0, 4.0, 8.4, 12.8, 17.2, 21.6, 26.2, 30.6, 37.6, 42.0, 46.4]
CHORDS = [[50, 57, 62, 64, 69],[50, 57, 62, 66, 69, 76],[47, 54, 59, 62, 66, 73],[43, 50, 55, 59, 62, 69],[45, 52, 57, 61, 64, 71],[50, 57, 62, 66, 69, 76],[47, 54, 59, 62, 66, 73],[43, 50, 55, 59, 62, 69],[45, 52, 57, 59, 64, 69],[43, 50, 55, 62, 66, 71],[38, 50, 57, 62, 66, 69, 76]]
def pad_note(f, d, bright=1.0):
    t = tarr(d); sig = np.zeros_like(t)
    for det in (-0.0035, 0.0, 0.0035):
        ph = rng.uniform(0, 2 * np.pi)
        for hmn in range(1, 7):
            sig += (1 / hmn ** (1.9 - 0.4 * bright)) * np.sin(2 * np.pi * f * (1 + det) * hmn * t + ph * hmn)
    return sig * (0.85 + 0.15 * np.sin(2 * np.pi * 0.3 * t + rng.uniform(0, 6))) / 6
def env_ar(n, a, r):
    e = np.ones(n); na = int(a * SR); nr = int(r * SR)
    e[:na] = np.linspace(0, 1, na) ** 2
    if nr: e[-nr:] *= np.linspace(1, 0, nr) ** 1.5
    return e
for k, st in enumerate(STARTS):
    last = k == len(STARTS) - 1
    en = DUR if last else STARTS[k + 1]
    d = (DUR - st) if last else (en - st + 1.0)
    ch = CHORDS[k]
    for j, m in enumerate(ch):
        s = pad_note(midi(m), d, 0.6 + 0.4 * k / 10) * env_ar(int(d * SR), 1.2 if k == 0 else .6, 1.2 if last else 1.0)
        add(st - (0 if k == 0 else 0.2), s, (0.05 if m > 55 else 0.06) * (0.7 if k == 0 else 1), pan=(-0.5 + j / max(1, len(ch) - 1)) * 0.8, send=0.5)
    root = midi(ch[0] - 12 if ch[0] > 40 else ch[0]); t = tarr(d)
    add(st, np.sin(2 * np.pi * root * t) * env_ar(len(t), 0.5, 1.0), 0.10 if k >= 2 else 0.06)

def kick(g=1.0):
    t = tarr(0.6); f = 42 + 85 * np.exp(-t / 0.045)
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.22) + 0.15 * rng.standard_normal(len(t)) * np.exp(-t / 0.004)) * g
def hat():
    t = tarr(0.08); n = np.diff(np.concatenate([[0], rng.standard_normal(len(t))]))
    return n * np.exp(-t / 0.018) * 0.5
BPM = 100; beat = 60 / BPM
tb = 4.0; bi = 0
while tb < 46.2:
    add(tb, kick(), 0.22 if bi % 2 == 0 else 0.12); add(tb + beat / 2, hat(), 0.05, pan=0.3)
    if bi % 2: add(tb, hat(), 0.035, pan=-0.3)
    tb += beat; bi += 1
def pluck(f, d=0.5):
    t = tarr(d); return (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t) * np.exp(-t / 0.05)) * np.exp(-t / 0.16)
tb = 4.0; idx = 0
while tb < 46.2:
    k = max(i for i, s in enumerate(STARTS) if s <= tb + 1e-6); tones = [m + 12 for m in CHORDS[k][1:]]
    m = tones[[0, 2, 1, 3, 2, 4, 1, 3][idx % 8] % len(tones)]
    add(tb, pluck(midi(m)), 0.035 + 0.015 * (idx % 4 == 0), pan=0.5 * math.sin(idx * 0.9), send=0.6)
    tb += beat / 2; idx += 1

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
    t = tarr(d); f = f0 * (f1 / f0) ** (t / d); ph = 2 * np.pi * np.cumsum(f) / SR
    return (np.sin(ph) + 0.3 * np.sin(2 * ph)) * (t / d) ** 1.8 * 0.5
def bell(f, d=3.0):
    t = tarr(d); s = np.zeros_like(t)
    for r_, a, dec in ((1, 1, 1.4), (2.01, .5, .7), (3.02, .25, .4), (4.17, .15, .25)):
        s += a * np.sin(2 * np.pi * f * r_ * t) * np.exp(-t / dec)
    return s * np.minimum(1, t * 400)
def eoe(x): return 1 if x >= 1 else 1 - 2 ** (-10 * x)
PENTA = [62, 64, 66, 69, 71, 74, 76, 78, 81, 83, 86, 88]
# intro
add(0.1, bell(midi(74), 3), 0.05, send=1); add(0.7, bell(midi(81), 3), 0.05, send=1)
add(0.7, kick(0.5), 0.12)
# scene transitions: soft whoosh + light impact
for st in STARTS[1:]:
    add(st - 0.8, whoosh(0.9, .86), 0.07, send=0.35)
    add(st, impact(0.4 if st < 46 else 0.9), 0.18 if st < 46 else 0.4, send=0.4)
# highlight blips & bullet ticks per step scene
STEP = {4.0: ([1.5, 3.1], [1.6, 3.1, 3.7]), 8.4: ([1.4, 2.4, 3.3], [1.4, 2.4, 3.3]), 12.8: ([1.5, 3.2], [1.5, 3.1, 3.7]),
        17.2: ([1.3, 2.4, 3.4], [1.3, 2.4, 3.4]), 21.6: ([1.2, 3.4], [1.2, 2.6, 3.5]), 26.2: ([1.6, 3.0], [1.5, 2.8, 3.6]),
        42.0: ([1.2, 2.3, 3.4], [1.2, 2.3, 3.4])}
for st, (hls, bls) in STEP.items():
    for j, tt in enumerate(hls): add(st + tt, blip(midi(PENTA[4 + j * 2]), .3), 0.035, pan=.2, send=.6)
    for j, tt in enumerate(bls): add(st + tt, tick(3000 + j * 200, .7), 0.07, pan=-.2)
    add(st + 0.7, tick(4200, .5), 0.05)  # tag chip
# step 4 screen swap
add(21.6 + 2.3, whoosh(0.6, .7), 0.05, pan=.3)
# monthly ring nodes
for i in range(5): add(30.6 + 0.7 + 3.3 * i / 5, bell(midi([74, 76, 78, 81, 83][i]), 1.8), 0.06, pan=-.4 + i * .2, send=.9)
add(30.6 + 4.2, whoosh(0.8, .6), 0.06)
add(30.6 + 5.2, blip(midi(81), .3), 0.04, send=.6)
# check toggles
for i in range(7): add(37.6 + 1.5 + i * .22, blip(midi(PENTA[3 + i]), .25), 0.045, pan=-.3 + i * .1, send=.5)
add(37.6 + 3.1, bell(midi(86), 2.5), 0.07, send=1); add(37.6 + 3.1, bell(midi(81), 2.5), 0.05, send=1)
# outro
for j, m in enumerate([62, 69, 74, 78, 81]): add(46.4 + 0.6 + j * 0.05, bell(midi(m), 3.5), 0.06, pan=-.5 + j * .25, send=1.2)

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
fade = np.minimum(1, t / 0.4) * np.clip((DUR - t) / 1.8, 0, 1) ** 1.5
mix *= fade[:, None]
mix = np.tanh(mix * 1.6) / 1.6
mix /= np.abs(mix).max() / 0.89
pcm = (mix * 32767).astype(np.int16)
with wave.open('score_tut.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('ok', np.sqrt((mix ** 2).mean()))
