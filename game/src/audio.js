// Synthesized WebAudio sound: no files, no network. A tiny voice system —
// short oscillator/noise blips for blowing, trapping, shattering, chains,
// hits, pickups and UI. Everything is guarded so a missing AudioContext
// (or the muted flag) simply stays silent.

export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.master = null;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  tone(freq, dur, type = 'sine', vol = 0.2, slideTo = null, delay = 0) {
    if (this.muted || !this.ensure()) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain); gain.connect(this.master);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  noise(dur, vol = 0.2, freq = 1200, delay = 0) {
    if (this.muted || !this.ensure()) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass'; filter.frequency.value = freq; filter.Q.value = 0.8;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter); filter.connect(gain); gain.connect(this.master);
    src.start(t0);
  }

  blow() { this.noise(0.12, 0.05, 700); }
  trap() { this.tone(520, 0.09, 'sine', 0.16, 880); }
  pop() { this.noise(0.08, 0.14, 2000); this.tone(300, 0.06, 'triangle', 0.1, 90); }
  shatter(chain = 1) {
    this.noise(0.16, 0.24, 2600);
    this.tone(1180, 0.12, 'triangle', 0.14, 320);
    if (chain >= 2) this.tone(1480, 0.14, 'triangle', 0.13, 420, 0.05);
    if (chain >= 4) this.tone(1860, 0.18, 'triangle', 0.12, 520, 0.1);
  }
  freeze() { this.tone(1900, 0.22, 'sine', 0.1, 2400); this.noise(0.2, 0.06, 3400); }
  boom() { this.noise(0.3, 0.3, 300); this.tone(120, 0.3, 'sine', 0.26, 40); }
  hurt() { this.tone(200, 0.14, 'sawtooth', 0.14, 80); }
  dash() { this.noise(0.1, 0.08, 1000); }
  pickup() { this.tone(920, 0.06, 'sine', 0.09, 1320); }
  uiClick() { this.tone(660, 0.05, 'square', 0.07, 660); }
  waveClear() { [523, 659, 784].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.13, null, i * 0.09)); }
  victory() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.24, 'triangle', 0.14, null, i * 0.12)); }
  defeat() { [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.26, 'triangle', 0.13, null, i * 0.14)); }
  bossRoar() { this.tone(90, 0.5, 'sawtooth', 0.2, 55); this.noise(0.4, 0.12, 240); }
}
