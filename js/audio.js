// Syntezowane efekty dźwiękowe (Web Audio API) – bez plików audio.
export class Sfx {
  constructor() {
    this.enabled = true;
    this.ctx = null;
  }

  ensure() {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 2;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  env(g, t, a, peak, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  noise({ dur = 0.5, type = 'bandpass', f0 = 400, f1 = 2000, q = 1, gain = 0.4, attack = 0.05, delay = 0 }) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filt = ctx.createBiquadFilter();
    filt.type = type;
    filt.Q.value = q;
    filt.frequency.setValueAtTime(f0, t);
    filt.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    this.env(g, t, attack, gain, dur);
    src.connect(filt).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  tone({ freq = 440, to = null, dur = 0.4, type = 'sine', gain = 0.2, attack = 0.01, delay = 0 }) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    this.env(g, t, attack, gain, dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  select() {
    this.tone({ freq: 1318, dur: 0.18, gain: 0.08 });
    this.tone({ freq: 1975, dur: 0.25, gain: 0.04, delay: 0.04 });
  }

  chime() {
    [880, 1175, 1568, 2093].forEach((f, i) => {
      this.tone({ freq: f, dur: 0.9, gain: 0.07, delay: i * 0.07, type: 'sine' });
      this.tone({ freq: f * 2.01, dur: 0.5, gain: 0.015, delay: i * 0.07, type: 'triangle' });
    });
  }

  whoosh(dur = 0.8) {
    this.noise({ dur, type: 'bandpass', f0: 250, f1: 1800, q: 2.5, gain: 0.25, attack: dur * 0.5 });
  }

  zap() {
    this.tone({ freq: 1600, to: 180, dur: 0.45, type: 'sawtooth', gain: 0.06 });
    this.noise({ dur: 0.4, type: 'highpass', f0: 3000, f1: 800, gain: 0.12, attack: 0.01 });
  }

  crash() {
    this.noise({ dur: 1.2, type: 'lowpass', f0: 4000, f1: 150, q: 0.7, gain: 0.7, attack: 0.005 });
    this.tone({ freq: 90, to: 35, dur: 0.7, type: 'sine', gain: 0.5, attack: 0.005 });
    for (let i = 0; i < 6; i++) {
      this.noise({ dur: 0.08, type: 'bandpass', f0: 2500 + Math.random() * 2000, f1: 1200, q: 4, gain: 0.15, attack: 0.002, delay: 0.1 + Math.random() * 0.6 });
    }
  }

  thud() {
    this.tone({ freq: 120, to: 45, dur: 0.3, type: 'sine', gain: 0.35, attack: 0.003 });
    this.noise({ dur: 0.18, type: 'lowpass', f0: 900, f1: 200, gain: 0.25, attack: 0.003 });
  }

  check() {
    this.tone({ freq: 220, dur: 0.9, type: 'triangle', gain: 0.12 });
    this.tone({ freq: 233, dur: 0.9, type: 'triangle', gain: 0.12 });
    this.tone({ freq: 440, dur: 0.6, type: 'sine', gain: 0.05, delay: 0.1 });
  }

  fanfare() {
    [523, 659, 784, 1046, 784, 1046].forEach((f, i) => this.tone({ freq: f, dur: 0.5, type: 'triangle', gain: 0.1, delay: i * 0.16 }));
  }
}
