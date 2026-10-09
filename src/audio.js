// 音：ボイス（事前生成mp3）＋ WebAudio で合成する効果音・BGM
export class Audio {
  constructor() {
    this.ctx = null; this.buffers = {}; this.muted = false;
    this.voiceCooldown = 0; this.current = null; this.talkLevel = 0;
    this.lastByCat = {};
  }
  async init(lines) {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = 0.9; this.master.connect(c.destination);
    this.sfx = c.createGain(); this.sfx.gain.value = 0.7; this.sfx.connect(this.master);
    this.music = c.createGain(); this.music.gain.value = 0.32; this.music.connect(this.master);
    this.voice = c.createGain(); this.voice.gain.value = 1.0;
    this.analyser = c.createAnalyser(); this.analyser.fftSize = 512;
    this.voice.connect(this.analyser); this.analyser.connect(this.master);
    this.abuf = new Float32Array(this.analyser.fftSize);
    // noise buffer
    const nb = c.createBuffer(1, c.sampleRate * 2, c.sampleRate); const d = nb.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noise = nb;
    this.startMusic();
    await Promise.all(lines.map(async (k) => {
      try {
        const r = await fetch(`assets/voice/${k}.mp3`); const ab = await r.arrayBuffer();
        this.buffers[k] = await c.decodeAudioData(ab);
      } catch (e) { console.warn('voice load failed', k, e); }
    }));
  }
  resume() { this.ctx && this.ctx.state !== 'running' && this.ctx.resume(); }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05); }
  // ---------- voice ----------
  say(cat, keys, { force = false, cooldown = 3.5, rate = 1 } = {}) {
    if (!this.ctx) return false;
    const now = this.ctx.currentTime;
    if (!force && (this.current && now < this.current.end)) return false;
    if (!force && now < this.voiceCooldown) return false;
    const last = this.lastByCat[cat];
    const avail = keys.filter((k) => this.buffers[k] && k !== (last && last.k));
    const k = avail.length ? avail[Math.floor(Math.random() * avail.length)] : keys.find((k) => this.buffers[k]);
    if (!k) return false;
    if (this.current && force) { try { this.current.src.stop(); } catch (e) { } }
    const src = this.ctx.createBufferSource(); src.buffer = this.buffers[k];
    src.playbackRate.value = rate * (0.98 + Math.random() * 0.04);
    src.connect(this.voice); src.start();
    const dur = src.buffer.duration / src.playbackRate.value;
    this.current = { src, end: now + dur, k };
    this.voiceCooldown = now + dur + cooldown;
    this.lastByCat[cat] = { k, t: now };
    return k;
  }
  get speaking() { return this.current && this.ctx && this.ctx.currentTime < this.current.end; }
  level() {
    if (!this.analyser || !this.speaking) { this.talkLevel *= 0.8; return 0; }
    this.analyser.getFloatTimeDomainData(this.abuf);
    let s = 0; for (let i = 0; i < this.abuf.length; i++) s += this.abuf[i] * this.abuf[i];
    const rms = Math.sqrt(s / this.abuf.length);
    this.talkLevel = Math.max(rms * 4, this.talkLevel * 0.75);
    return this.talkLevel;
  }
  // ---------- sfx ----------
  env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
  thump(freq = 70, vol = 0.6, dec = 0.25, pan = 0) {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(freq * 2.2, t); o.frequency.exponentialRampToValueAtTime(freq, t + 0.08);
    const g = c.createGain(); this.env(g, t, 0.005, vol, dec);
    const p = c.createStereoPanner ? c.createStereoPanner() : null;
    o.connect(g); if (p) { p.pan.value = pan; g.connect(p); p.connect(this.sfx); } else g.connect(this.sfx);
    o.start(t); o.stop(t + dec + 0.1);
  }
  footstep(size = 1, dist = 5) {
    const v = Math.min(1, 1.2 / (1 + dist * 0.12)) * Math.min(1.6, 0.5 + size * 0.5);
    this.thump(55 / Math.sqrt(size), 0.35 * v, 0.18 + size * 0.05);
    // heel click
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2400; f.Q.value = 4;
    const g = c.createGain(); this.env(g, t, 0.002, 0.25 * v, 0.06);
    s.connect(f); f.connect(g); g.connect(this.sfx); s.start(t, Math.random()); s.stop(t + 0.1);
  }
  slap(strength = 1) {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 900;
    const f2 = c.createBiquadFilter(); f2.type = 'peaking'; f2.frequency.value = 2600; f2.gain.value = 8;
    const g = c.createGain(); this.env(g, t, 0.001, 0.9 * strength, 0.09);
    s.connect(f); f.connect(f2); f2.connect(g); g.connect(this.sfx); s.start(t, Math.random()); s.stop(t + 0.15);
    // belly "purun" wobble
    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.25);
    const lfo = c.createOscillator(); lfo.frequency.value = 16; const lg = c.createGain(); lg.gain.value = 25; lfo.connect(lg); lg.connect(o.frequency);
    const g2 = c.createGain(); this.env(g2, t, 0.004, 0.5 * strength, 0.3);
    o.connect(g2); g2.connect(this.sfx); o.start(t); lfo.start(t); o.stop(t + 0.4); lfo.stop(t + 0.4);
  }
  crash(size = 1) {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = this.noise; s.loop = true;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(2200, t); f.frequency.exponentialRampToValueAtTime(180, t + 1.6);
    const g = c.createGain(); this.env(g, t, 0.01, Math.min(1, 0.5 + size * 0.2), 1.6 + size * 0.3);
    s.connect(f); f.connect(g); g.connect(this.sfx); s.start(t); s.stop(t + 2.4);
    this.thump(38, 0.9, 0.7);
    // glass tinkles
    for (let i = 0; i < 6; i++) {
      const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = 2500 + Math.random() * 3000;
      const gg = c.createGain(); const tt = t + 0.1 + Math.random() * 0.6; this.env(gg, tt, 0.002, 0.08, 0.12);
      o.connect(gg); gg.connect(this.sfx); o.start(tt); o.stop(tt + 0.2);
    }
  }
  grow() {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(60, t); o.frequency.exponentialRampToValueAtTime(140, t + 1.4);
    const lfo = c.createOscillator(); lfo.frequency.setValueAtTime(7, t); lfo.frequency.linearRampToValueAtTime(14, t + 1.4);
    const lg = c.createGain(); lg.gain.value = 18; lfo.connect(lg); lg.connect(o.frequency);
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600; f.Q.value = 6;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
    o.connect(f); f.connect(g); g.connect(this.sfx); o.start(t); lfo.start(t); o.stop(t + 1.9); lfo.stop(t + 1.9);
    this.thump(45, 0.7, 0.9);
  }
  ui(f = 880) {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
    const g = c.createGain(); this.env(g, t, 0.003, 0.2, 0.15); o.connect(g); g.connect(this.sfx); o.start(t); o.stop(t + 0.2);
  }
  sting() { // grabbed!
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime;
    [311, 330, 466].forEach((f, i) => {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = (i - 1) * 12;
      const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 1400;
      const g = c.createGain(); this.env(g, t, 0.01, 0.12, 1.2); o.connect(fl); fl.connect(g); g.connect(this.sfx); o.start(t); o.stop(t + 1.3);
    });
  }
  // ---------- music: eerie pad + heartbeat whose tempo follows danger ----------
  startMusic() {
    const c = this.ctx; const t = c.currentTime;
    const pad = c.createGain(); pad.gain.value = 0.0; pad.connect(this.music); this.pad = pad;
    pad.gain.setTargetAtTime(0.5, t, 2);
    const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 520; fl.Q.value = 2; fl.connect(pad);
    [55, 82.4, 103.8, 110.3].forEach((f, i) => {
      const o = c.createOscillator(); o.type = i % 2 ? 'triangle' : 'sawtooth'; o.frequency.value = f; o.detune.value = (Math.random() - .5) * 14;
      const g = c.createGain(); g.gain.value = 0.12; o.connect(g); g.connect(fl); o.start();
      const l = c.createOscillator(); l.frequency.value = 0.05 + Math.random() * 0.1; const lg = c.createGain(); lg.gain.value = 0.06; l.connect(lg); lg.connect(g.gain); l.start();
    });
    this.danger = 0; this.nextBeat = t + 1;
  }
  tick(danger) {
    if (!this.ctx) return; const c = this.ctx; const t = c.currentTime;
    this.danger = danger;
    if (t > this.nextBeat) {
      const bpm = 60 + danger * 90;
      this.thump(48, 0.18 + danger * 0.35, 0.18); setTimeout(() => this.thump(44, 0.12 + danger * 0.25, 0.2), 150);
      this.nextBeat = t + 60 / bpm;
    }
  }
}
