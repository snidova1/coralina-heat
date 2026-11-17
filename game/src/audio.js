// All sound is synthesised with WebAudio at run time: the engine (sawtooth harmonics through a
// filter that opens with revs), tyre squeal, the police siren wail, gunshots and punches from shaped
// noise, crashes, explosions, horns, UI blips, mission jingles, and three generative radio stations.
const STATIONS = [
  { name: 'BAYWAVE 98.4 · SYNTH SUNSET', bpm: 100, root: 45, scale: [0, 3, 5, 7, 10], style: 'synth' },
  { name: 'TIDE 104 · DEMBOW DEL MAR', bpm: 96, root: 43, scale: [0, 2, 3, 7, 8], style: 'dembow' },
  { name: 'KCOR 88.1 · NIGHT DRIVE', bpm: 84, root: 40, scale: [0, 3, 5, 7, 10], style: 'chill' },
  { name: 'RADIO OFF', style: 'off' },
];

export class AudioEngine {
  constructor(game) {
    this.game = game;
    this.ctx = null;
    this.master = 0.8;
    this.musicVolume = 0.5;
    this.station = 0;
    this.engine = null;
    this.siren = null;
  }

  /** Must be called from a user gesture (the title menu does). */
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.out = this.ctx.createGain();
    this.out.gain.value = this.master;
    const comp = this.ctx.createDynamicsCompressor();
    this.out.connect(comp);
    comp.connect(this.ctx.destination);
    this.sfx = this.ctx.createGain();
    this.sfx.connect(this.out);
    this.music = this.ctx.createGain();
    this.music.gain.value = 0;
    this.music.connect(this.out);
    this.noiseBuf = this.ctx.createBuffer(1, this.ctx.sampleRate * 1.5, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.nextNote = 0;
    this.step = 0;
    setInterval(() => this.schedule(), 90);
  }

  setVolume(master, music) {
    this.master = master;
    this.musicVolume = music;
    if (this.out) this.out.gain.value = master;
  }

  get stationName() { return STATIONS[this.station].name; }

  // ---------- helpers ----------

  distGain(pos) {
    if (!pos) return 1;
    const c = this.game.camera.position;
    const d = Math.hypot(pos.x - c.x, pos.z - c.z);
    return Math.max(0, 1 - d / 120);
  }

  noise(duration, filterType, freq, gain, attack = 0.002, q = 1, when = 0) {
    if (!this.ctx || gain <= 0.001) return;
    const t = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfx);
    src.start(t, Math.random() * 0.5);
    src.stop(t + duration + 0.05);
  }

  tone(freq, duration, type = 'sine', gain = 0.2, when = 0, dest = null, slideTo = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + duration);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    o.connect(g);
    g.connect(dest || this.sfx);
    o.start(t);
    o.stop(t + duration + 0.05);
  }

  // ---------- effects ----------

  gunshot(power = 1, pos = null) {
    const k = this.distGain(pos) * power;
    this.noise(0.25, 'lowpass', 2400, 0.9 * k, 0.001);
    this.noise(0.6, 'lowpass', 300, 0.6 * k, 0.001);
    this.tone(140, 0.12, 'square', 0.25 * k, 0, null, 50);
  }

  punch() { this.noise(0.12, 'lowpass', 500, 0.8); this.tone(90, 0.1, 'sine', 0.5, 0, null, 50); }
  swing() { this.noise(0.15, 'bandpass', 1200, 0.15, 0.04, 0.8); }
  thud(pos) { this.noise(0.2, 'lowpass', 220, 0.7 * this.distGain(pos)); }
  click() { this.tone(1400, 0.04, 'square', 0.08); }
  reload() { this.tone(900, 0.04, 'square', 0.1); this.tone(600, 0.05, 'square', 0.1, 0.5); this.noise(0.08, 'highpass', 3000, 0.2, 0.002, 1, 0.9); }
  door() { this.noise(0.18, 'lowpass', 400, 0.5); this.tone(120, 0.12, 'sine', 0.2); }
  pickup() { this.tone(880, 0.1, 'triangle', 0.2); this.tone(1320, 0.18, 'triangle', 0.2, 0.08); }
  ui() { this.tone(660, 0.06, 'triangle', 0.12); }

  crash(strength) {
    this.noise(0.5, 'lowpass', 900, 0.9 * strength);
    this.noise(0.25, 'highpass', 2500, 0.4 * strength, 0.001, 1, 0.03);
  }

  explosion(pos) {
    const k = Math.max(0.25, this.distGain(pos));
    this.noise(1.6, 'lowpass', 260, 1.2 * k, 0.005);
    this.noise(0.6, 'lowpass', 1600, 0.6 * k, 0.002);
  }

  horn(pos, mine = false) {
    const k = mine ? 0.5 : 0.35 * this.distGain(pos);
    this.tone(415, 0.45, 'square', k * 0.4);
    this.tone(523, 0.45, 'square', k * 0.3);
  }

  jingle(kind) {
    const seqs = {
      start: [[392, 0], [523, 0.12], [659, 0.24]],
      pass: [[523, 0], [659, 0.14], [784, 0.28], [1046, 0.42], [784, 0.62], [1046, 0.76]],
      fail: [[392, 0], [330, 0.2], [262, 0.4], [196, 0.6]],
      cash: [[1318, 0], [1760, 0.07]],
    };
    for (const [f, w] of seqs[kind] || []) {
      this.tone(f, 0.3, 'square', 0.09, w);
      this.tone(f / 2, 0.3, 'triangle', 0.12, w);
    }
  }

  // ---------- the player's engine, sirens and the radio ----------

  startEngine(vehicle) {
    if (!this.ctx) return;
    this.stopEngine();
    const c = this.ctx;
    const o1 = c.createOscillator();
    const o2 = c.createOscillator();
    o1.type = 'sawtooth';
    o2.type = 'square';
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 400;
    const g = c.createGain();
    g.gain.value = 0;
    o1.connect(f);
    o2.connect(f);
    f.connect(g);
    g.connect(this.sfx);
    o1.start();
    o2.start();
    const sq = c.createBufferSource();
    sq.buffer = this.noiseBuf;
    sq.loop = true;
    const sf = c.createBiquadFilter();
    sf.type = 'bandpass';
    sf.frequency.value = 1800;
    sf.Q.value = 6;
    const sg = c.createGain();
    sg.gain.value = 0;
    sq.connect(sf);
    sf.connect(sg);
    sg.connect(this.sfx);
    sq.start();
    this.engine = { o1, o2, f, g, sq, sg, vehicle };
    this.music.gain.setTargetAtTime(STATIONS[this.station].style === 'off' ? 0 : this.musicVolume * 0.35, c.currentTime, 0.3);
  }

  stopEngine() {
    if (!this.engine) return;
    const e = this.engine;
    e.o1.stop(); e.o2.stop(); e.sq.stop();
    this.engine = null;
    if (this.ctx) this.music.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4);
  }

  nextStation() {
    this.station = (this.station + 1) % STATIONS.length;
    if (this.ctx) this.music.gain.setTargetAtTime(STATIONS[this.station].style === 'off' ? 0 : this.musicVolume * 0.35, this.ctx.currentTime, 0.2);
    if (this.game.hud) this.game.hud.toast(this.stationName, 2);
  }

  update() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const e = this.engine;
    if (e) {
      const v = e.vehicle;
      const sp = Math.abs(v.speed);
      const gearSpan = 14;
      const gear = Math.min(5, Math.floor(sp / gearSpan));
      const rpm = 0.25 + ((sp - gear * gearSpan) / gearSpan) * 0.75 + (v.controls.throttle > 0 ? 0.1 : 0);
      const base = (v.type === 'sports' ? 55 : v.type === 'pickup' ? 38 : 46) * (1 + rpm * 1.6 + gear * 0.08);
      e.o1.frequency.setTargetAtTime(base, t, 0.05);
      e.o2.frequency.setTargetAtTime(base * 0.5, t, 0.05);
      e.f.frequency.setTargetAtTime(300 + rpm * 1800 * (v.controls.throttle > 0 ? 1 : 0.5), t, 0.08);
      e.g.gain.setTargetAtTime(0.06 + rpm * 0.08, t, 0.1);
      e.sg.gain.setTargetAtTime(v.skid && sp > 5 ? 0.25 : 0, t, 0.05);
    }
    // the nearest siren wails
    const g = this.game;
    let nearest = Infinity;
    if (g.police) for (const v of g.police.cars) if (v.siren) nearest = Math.min(nearest, v.position.distanceTo(g.camera.position));
    if (g.player.vehicle && g.player.vehicle.siren) nearest = 5;
    const sirenGain = nearest < 150 ? 0.12 * (1 - nearest / 150) : 0;
    if (sirenGain > 0 && !this.siren) {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.45;
      const depth = this.ctx.createGain();
      depth.gain.value = 260;
      lfo.connect(depth);
      depth.connect(o.frequency);
      o.frequency.value = 900;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 2200;
      const gg = this.ctx.createGain();
      gg.gain.value = 0;
      o.connect(f);
      f.connect(gg);
      gg.connect(this.sfx);
      o.start();
      lfo.start();
      this.siren = { o, lfo, gg };
    }
    if (this.siren) {
      this.siren.gg.gain.setTargetAtTime(sirenGain, t, 0.2);
      if (sirenGain === 0 && nearest === Infinity) {
        this.sirenOffT = (this.sirenOffT || 0) + 1;
        if (this.sirenOffT > 120) { this.siren.o.stop(); this.siren.lfo.stop(); this.siren = null; this.sirenOffT = 0; }
      } else this.sirenOffT = 0;
    }
  }

  /** The radio: a step sequencer that writes a few bars ahead, per station style. */
  schedule() {
    const c = this.ctx;
    if (!c) return;
    const st = STATIONS[this.station];
    if (st.style === 'off') { this.nextNote = c.currentTime + 0.1; return; }
    const spb = 60 / st.bpm / 4;
    if (this.nextNote < c.currentTime) this.nextNote = c.currentTime + 0.05;
    while (this.nextNote < c.currentTime + 0.4) {
      this.playStep(st, this.step, this.nextNote, spb);
      this.nextNote += spb;
      this.step = (this.step + 1) % 64;
    }
  }

  playStep(st, step, when, spb) {
    const c = this.ctx;
    const dest = this.music;
    const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
    const bar = Math.floor(step / 16);
    const chord = [0, 5, 3, 7][bar];
    const s = step % 16;
    const kick = (t) => { const o = c.createOscillator(); const g = c.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15); g.gain.setValueAtTime(0.7, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2); o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.25); };
    const hat = (t, v = 0.12) => { const src = c.createBufferSource(); src.buffer = this.noiseBuf; const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000; const g = c.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05); src.connect(f); f.connect(g); g.connect(dest); src.start(t, Math.random()); src.stop(t + 0.06); };
    const snare = (t) => { const src = c.createBufferSource(); src.buffer = this.noiseBuf; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; const g = c.createGain(); g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18); src.connect(f); f.connect(g); g.connect(dest); src.start(t, Math.random()); src.stop(t + 0.2); };
    const note = (n, t, len, type, v) => { const o = c.createOscillator(); o.type = type; o.frequency.value = midi(n); const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400; const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + len); o.connect(f); f.connect(g); g.connect(dest); o.start(t); o.stop(t + len + 0.05); };
    const root = st.root + chord;
    if (st.style === 'synth') {
      if (s % 4 === 0) kick(when);
      if (s % 8 === 4) snare(when);
      if (s % 2 === 1) hat(when);
      note(root + (s % 2 ? 12 : 0), when, spb * 0.9, 'sawtooth', 0.09);
      if (s === 0) [12, 15, 19].forEach((i) => note(root + i + 12, when, spb * 15, 'triangle', 0.035));
      if (s % 3 === 0) note(root + 24 + st.scale[(step * 7) % st.scale.length], when, spb * 1.5, 'square', 0.025);
    } else if (st.style === 'dembow') {
      if (s === 0 || s === 8) kick(when);
      if (s === 3 || s === 6 || s === 11 || s === 14) snare(when);
      if (s % 2 === 0) hat(when, 0.08);
      if (s % 4 === 0) note(root, when, spb * 3, 'sine', 0.25);
      if (s === 2 || s === 10) note(root + 24 + st.scale[(step >> 2) % st.scale.length], when, spb * 2, 'triangle', 0.06);
    } else {
      if (s === 0 || s === 10) kick(when);
      if (s === 8) snare(when);
      if (s % 4 === 2) hat(when, 0.06);
      if (s === 0) [0, 7, 15, 22].forEach((i) => note(root + i + 12, when, spb * 16, 'sine', 0.04));
      if (s % 4 === 0) note(root, when, spb * 3.5, 'triangle', 0.18);
    }
  }
}
