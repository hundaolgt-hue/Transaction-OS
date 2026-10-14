"""Tiny numpy synth for ad soundtracks: pads, pulse, plucks and UI foley synced to scene times.

Usage (see SKILL.md, "Soundtrack"):
    import sys; sys.path.insert(0, '<skill>/scripts')
    from score_lib import Score, midi
    sc = Score(20.0)
    sc.bed(starts=[0, 3, 8, 15], chords=[[38,50,53,57,60], ...], bpm=110, beat_from=3, beat_to=19.4)
    sc.add(1.2, sc.impact(0.8), 0.32, send=.4)          # one-shot events at exact on-screen times
    sc.finish('score.wav')

All sounds are synthesized, so there is nothing to license. You cannot listen to the result in this
environment: check levels with sc.report() and a spectrogram, and tell the user to listen before posting.
"""
import math, wave
import numpy as np

SR = 48000


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def tarr(d):
    return np.arange(int(d * SR)) / SR


def onepole(x, fc):
    """One-pole low-pass; fc may be an array (time-varying cutoff)."""
    fc = np.broadcast_to(np.asarray(fc, float), x.shape)
    a = np.exp(-2 * np.pi * fc / SR)
    y = np.empty_like(x); s = 0.0
    for i in range(len(x)):
        s = (1 - a[i]) * x[i] + a[i] * s; y[i] = s
    return y


class Score:
    def __init__(self, dur, seed=7):
        self.dur = dur; self.N = int(SR * dur)
        self.rng = np.random.default_rng(seed)
        self.L = np.zeros(self.N); self.R = np.zeros(self.N)
        self.RL = np.zeros(self.N); self.RR = np.zeros(self.N)

    # ---------- mixing ----------
    def _put(self, buf, start, sig, gain):
        i = int(start * SR)
        if i >= self.N: return
        if i < 0: sig = sig[-i:]; i = 0
        n = min(len(sig), self.N - i)
        buf[i:i + n] += sig[:n] * gain

    def add(self, start, sig, gain=1.0, pan=0.0, send=0.0):
        """Place a sound at `start` seconds. pan -1..1, send = reverb amount."""
        gl = math.cos((pan + 1) * math.pi / 4); gr = math.sin((pan + 1) * math.pi / 4)
        self._put(self.L, start, sig, gain * gl * 1.414); self._put(self.R, start, sig, gain * gr * 1.414)
        if send:
            self._put(self.RL, start, sig, gain * send * gl); self._put(self.RR, start, sig, gain * send * gr)

    # ---------- instruments ----------
    def pad_note(self, f, d, bright=1.0):
        t = tarr(d); sig = np.zeros_like(t)
        for det in (-0.0035, 0.0, 0.0035):
            ph = self.rng.uniform(0, 2 * np.pi)
            for h in range(1, 7):
                sig += (1 / h ** (1.9 - 0.4 * bright)) * np.sin(2 * np.pi * f * (1 + det) * h * t + ph * h)
        return sig * (0.85 + 0.15 * np.sin(2 * np.pi * 0.3 * t + self.rng.uniform(0, 6))) / 6

    @staticmethod
    def env(n, a, r):
        e = np.ones(n); na = int(a * SR); nr = int(r * SR)
        e[:na] = np.linspace(0, 1, na) ** 2
        if nr: e[-nr:] *= np.linspace(1, 0, nr) ** 1.5
        return e

    def kick(self, g=1.0):
        t = tarr(0.6); f = 42 + 85 * np.exp(-t / 0.045)
        return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.22)
                + 0.15 * self.rng.standard_normal(len(t)) * np.exp(-t / 0.004)) * g

    def hat(self):
        t = tarr(0.08); n = np.diff(np.concatenate([[0], self.rng.standard_normal(len(t))]))
        return n * np.exp(-t / 0.018) * 0.5

    def pluck(self, f, d=0.5):
        t = tarr(d)
        return (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t) * np.exp(-t / 0.05)) * np.exp(-t / 0.16)

    def tick(self, f=3200, g=1.0):
        """UI tick: rows landing, counters, cards. Keep gain ~0.05-0.09."""
        t = tarr(0.05)
        return (np.sin(2 * np.pi * f * t) * np.exp(-t / 0.008)
                + 0.12 * self.rng.standard_normal(len(t)) * np.exp(-t / 0.0015)) * g

    def blip(self, f, d=0.35):
        t = tarr(d); return (np.sin(2 * np.pi * f * t) + 0.2 * np.sin(6 * np.pi * f * t)) * np.exp(-t / 0.09)

    def whoosh(self, d=1.1, peak=0.85):
        """Transition swell; place it ~0.8 s before a scene cut."""
        n = int(d * SR); x = self.rng.standard_normal(n); t = np.arange(n) / n
        env = np.where(t < peak, (t / peak) ** 2.5, np.exp(-(t - peak) / (1 - peak) * 4))
        fc = 200 + 2600 * env
        return onepole(onepole(x, fc), fc) * env * 1.6

    def impact(self, g=1.0):
        """Deep cinematic hit for scene cuts and headline landings."""
        t = tarr(2.4); f = 32 + 40 * np.exp(-t / 0.12)
        body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.7)
        nz = onepole(onepole(self.rng.standard_normal(len(t)), 500), 500) * np.exp(-t / 0.25) * 3.0
        return (body + nz) * g

    def riser(self, d, f0, f1):
        t = tarr(d); f = f0 * (f1 / f0) ** (t / d); ph = 2 * np.pi * np.cumsum(f) / SR
        return (np.sin(ph) + 0.3 * np.sin(2 * ph)) * (t / d) ** 1.8 * 0.5

    def bell(self, f, d=3.0):
        t = tarr(d); s = np.zeros_like(t)
        for r_, a, dec in ((1, 1, 1.4), (2.01, .5, .7), (3.02, .25, .4), (4.17, .15, .25)):
            s += a * np.sin(2 * np.pi * f * r_ * t) * np.exp(-t / dec)
        return s * np.minimum(1, t * 400)

    # ---------- foley ----------
    def clack(self, f=1500, g=1.0):
        """Wooden hit (dominoes, stamps, Enter key)."""
        t = tarr(0.25); n = onepole(self.rng.standard_normal(len(t)), 3000) * np.exp(-t / 0.006)
        body = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.035) + 0.5 * np.sin(2 * np.pi * f * 2.7 * t) * np.exp(-t / 0.02)
        return (n * 1.5 + body) * g

    def keyclick(self, g=1.0):
        t = tarr(0.06)
        return (onepole(self.rng.standard_normal(len(t)), 4000) * np.exp(-t / 0.004) * 2
                + np.sin(2 * np.pi * 900 * t) * np.exp(-t / 0.012)) * g

    def scribble(self, d=0.3):
        """Pen on paper."""
        t = tarr(d); n = self.rng.standard_normal(len(t))
        env = (0.5 + 0.5 * np.sin(2 * np.pi * 14 * t)) * np.minimum(1, t * 30) * np.minimum(1, (d - t) * 30)
        return onepole(n - onepole(n, 1500), 6000) * env * 0.8

    def crumple(self, d=0.6):
        t = tarr(d); n = self.rng.standard_normal(len(t)) * (self.rng.random(len(t)) > .97)
        return onepole(n, 5000) * np.exp(-t / 0.25) * 6

    def alarm(self, d=0.9):
        t = tarr(d)
        return (np.sign(np.sin(2 * np.pi * 110 * t)) * .3 + np.sin(2 * np.pi * 116.5 * t)) * np.exp(-t / 0.4) * np.minimum(1, t * 60)

    # ---------- music bed ----------
    def bed(self, starts, chords, bpm=110, beat_from=None, beat_to=None, arp=True):
        """Pads + sub that change chord at each scene start, plus a soft pulse (kick/hat) and arpeggio
        between beat_from and beat_to. Minor chords for the problem/hook, major once the product arrives."""
        assert len(starts) == len(chords)
        for k, st in enumerate(starts):
            last = k == len(starts) - 1
            d = (self.dur - st) if last else (starts[k + 1] - st + 1.0)
            ch = chords[k]
            for j, m in enumerate(ch):
                s = self.pad_note(midi(m), d, 0.6 + 0.4 * k / max(1, len(starts) - 1)) * self.env(int(d * SR), 1.2 if k == 0 else .6, 1.2 if last else 1.0)
                self.add(st - (0 if k == 0 else 0.2), s, (0.05 if m > 55 else 0.06) * (0.7 if k == 0 else 1),
                         pan=(-0.5 + j / max(1, len(ch) - 1)) * 0.8, send=0.5)
            root = midi(ch[0] - 12 if ch[0] > 40 else ch[0]); t = tarr(d)
            self.add(st, np.sin(2 * np.pi * root * t) * self.env(len(t), 0.5, 1.0), 0.10 if k >= 1 else 0.06)
        if beat_from is None: return
        beat = 60 / bpm; tb = beat_from; bi = 0
        while tb < beat_to:
            self.add(tb, self.kick(), 0.26 if bi % 2 == 0 else 0.15); self.add(tb + beat / 2, self.hat(), 0.05, pan=0.3)
            if bi % 2: self.add(tb, self.hat(), 0.035, pan=-0.3)
            tb += beat; bi += 1
        if not arp: return
        tb = beat_from; idx = 0
        while tb < beat_to:
            k = max(i for i, s in enumerate(starts) if s <= tb + 1e-6); tones = [m + 12 for m in chords[k][1:]]
            m = tones[[0, 2, 1, 3, 2, 4, 1, 3][idx % 8] % len(tones)]
            self.add(tb, self.pluck(midi(m)), 0.035 + 0.015 * (idx % 4 == 0), pan=0.5 * math.sin(idx * 0.9), send=0.6)
            tb += beat / 2; idx += 1

    def transitions(self, cuts, final_gain=1.0):
        """Whoosh into + impact on every scene cut (skip t=0)."""
        for i, st in enumerate(cuts):
            last = i == len(cuts) - 1
            self.add(st - 0.85, self.whoosh(0.95, .86), 0.09, send=0.35)
            self.add(st, self.impact(final_gain if last else 0.55), 0.42 if last else 0.26, send=0.4)

    # ---------- render ----------
    def finish(self, path, fade_out=0.8):
        t3 = tarr(3.0)
        def conv(x, ir):
            n = len(x) + len(ir); nf = 1 << (n - 1).bit_length()
            return np.fft.irfft(np.fft.rfft(x, nf) * np.fft.rfft(ir, nf), nf)[:len(x)]
        irs = []
        for _ in range(2):
            ir = onepole(self.rng.standard_normal(len(t3)), 4500) * np.exp(-t3 / 0.75); irs.append(ir / np.sqrt((ir ** 2).sum()))
        L = self.L + conv(self.RL, irs[0]) * 0.9; R = self.R + conv(self.RR, irs[1]) * 0.9
        L = onepole(L, 11000); R = onepole(R, 11000)
        mix = np.stack([L, R], 1); t = np.arange(self.N) / SR
        mix *= (np.minimum(1, t / 0.4) * np.clip((self.dur - t) / fade_out, 0, 1) ** 1.5)[:, None]
        mix = np.tanh(mix * 1.6) / 1.6; mix /= np.abs(mix).max() / 0.89
        self.mix = mix
        with wave.open(path, 'wb') as w:
            w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix * 32767).astype(np.int16).tobytes())
        return path

    def report(self):
        """Per-second RMS in dBFS; flat ~-15 dB is healthy, spikes above -8 dB mean a hit is too loud."""
        m = self.mix; out = []
        for i in range(int(self.dur)):
            seg = m[i * SR:(i + 1) * SR]; out.append(20 * np.log10(np.sqrt((seg ** 2).mean()) + 1e-9))
        return ' '.join(f'{x:.0f}' for x in out)
