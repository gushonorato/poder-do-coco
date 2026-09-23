// Áudio do PODER DO COCÔ: efeitos sintetizados (WebAudio), músicas chiptune
// sequenciadas e reprodução das falas (com nível para lip-sync e fallback
// speechSynthesis pt-BR). Sem dependências.

const SFX_VOL = 0.55;
const MUSIC_VOL = 0.3;
const VOICE_VOL = 1.0;
const DUCK_LEVEL = 0.25;
// Ajuste fino de volume por efeito (medido offline para ficarem equilibrados).
const SFX_GAIN = {
  jump: 4.3, fart: 0.8, plop: 1.8, splat: 3.2, enemyDie: 3, hurt: 1.8, pickup: 2.7, power: 2.3,
  bossHit: 3.7, checkpoint: 2.4, cheer: 1.7, select: 3.3, step: 4, cage: 1.3, throw: 1.3, bark: 1.4,
};
const LOOKAHEAD = 0.12; // s de música agendada à frente
const TICK_MS = 25;

let ctx = null;
let bus = null; // { master, sfx, music, duck, voice }
let muted = false;
let userPaused = false;
let gestureHooked = false;
let pendingMusic = null;
let currentSong = null; // SongPlayer
let schedTimer = null;
const players = new Set();
const lastSfx = {};
let activeSfx = 0;

try { muted = localStorage.getItem('pdc_muted') === '1'; } catch (e) { /* sem storage */ }

// ---------------------------------------------------------------- utilidades

const offlineCtxs = new WeakSet();
const noiseCache = new WeakMap();
const waveCache = new WeakMap();

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function getNoise(ac) {
  let b = noiseCache.get(ac);
  if (!b) {
    const len = Math.floor(ac.sampleRate * 2);
    b = ac.createBuffer(1, len, ac.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    noiseCache.set(ac, b);
  }
  return b;
}

// Onda de pulso (duty variável) calculada por DFT de uma onda amostrada.
function getPulse(ac, duty) {
  let m = waveCache.get(ac);
  if (!m) { m = {}; waveCache.set(ac, m); }
  const key = 'p' + duty;
  if (!m[key]) {
    const N = 2048, H = 48;
    const real = new Float32Array(H), imag = new Float32Array(H);
    for (let n = 1; n < H; n++) {
      let re = 0, im = 0;
      for (let k = 0; k < N; k++) {
        const x = k / N < duty ? 1 : -1;
        const a = (2 * Math.PI * n * k) / N;
        re += x * Math.cos(a);
        im += x * Math.sin(a);
      }
      real[n] = (2 / N) * re;
      imag[n] = (2 / N) * im;
    }
    m[key] = ac.createPeriodicWave(real, imag);
  }
  return m[key];
}

// Envelope percussivo: sobe rápido e decai exponencialmente.
function decayEnv(param, t, peak, dur, attack = 0.004) {
  param.setValueAtTime(0.0001, t);
  param.linearRampToValueAtTime(peak, t + attack);
  param.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, attack + 0.01));
}

// "Voz" de efeito: agrupa nós para limpar depois.
function makeVoice(ac, dest, t, opts = {}) {
  const nodes = [];
  const out = ac.createGain();
  out.gain.value = opts.vol != null ? opts.vol : 1;
  out.connect(dest);
  nodes.push(out);
  let end = t;
  const v = {
    ac, t, out,
    p: opts.pitch || 1,
    gain(val = 1) {
      const g = ac.createGain();
      g.gain.value = val;
      nodes.push(g);
      return g;
    },
    osc(type, freq, start = t, stop = t + 0.5) {
      const o = ac.createOscillator();
      if (typeof type === 'string') o.type = type; else o.setPeriodicWave(type);
      o.frequency.value = freq;
      o.frequency.setValueAtTime(freq, start);
      o.start(start);
      o.stop(stop);
      end = Math.max(end, stop);
      nodes.push(o);
      return o;
    },
    noise(start = t, stop = t + 0.5) {
      const s = ac.createBufferSource();
      s.buffer = getNoise(ac);
      s.loop = true;
      s.start(start, Math.random() * 1.5);
      s.stop(stop);
      end = Math.max(end, stop);
      nodes.push(s);
      return s;
    },
    filter(type, freq, Q = 1) {
      const f = ac.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = Q;
      nodes.push(f);
      return f;
    },
    lfo(type, rate, depth, target, start = t, stop = t + 0.5) {
      const o = v.osc(type, rate, start, stop);
      const g = v.gain(depth);
      o.connect(g).connect(target);
      return { osc: o, depth: g };
    },
    finish() {
      if (offlineCtxs.has(ac)) return;
      activeSfx++;
      const ms = Math.max(0, (end - ac.currentTime + 0.25) * 1000);
      setTimeout(() => {
        activeSfx--;
        for (const n of nodes) { try { n.disconnect(); } catch (e) { /* já desconectado */ } }
      }, ms);
    },
  };
  return v;
}

// Nota curta de onda de pulso (usada em vários efeitos).
function blip(v, freq, start, dur, vol, duty = 0.25) {
  const o = v.osc(getPulse(v.ac, duty), freq, start, start + dur + 0.02);
  const g = v.gain(0);
  decayEnv(g.gain, start, vol, dur);
  o.connect(g).connect(v.out);
  return o;
}

// ---------------------------------------------------------------- efeitos

const SFX = {
  jump(v) {
    const { t, p } = v;
    const o = v.osc(getPulse(v.ac, 0.25), 240 * p, t, t + 0.22);
    o.frequency.exponentialRampToValueAtTime(720 * p, t + 0.11);
    o.frequency.exponentialRampToValueAtTime(640 * p, t + 0.2);
    const g = v.gain(0);
    decayEnv(g.gain, t, 0.22, 0.21);
    o.connect(g).connect(v.out);
  },

  // O pum! Sempre um pouco diferente.
  fart(v) {
    const { t } = v;
    let p = v.p;
    const kind = pick(['short', 'long', 'squeak', 'wobble', 'long', 'short']);
    let dur, f0, fEnd, rate, rateEnd;
    switch (kind) {
      case 'short': dur = rand(0.16, 0.24); f0 = rand(95, 130); fEnd = f0 * rand(0.7, 0.85); rate = rand(36, 45); rateEnd = rate; break;
      case 'long': dur = rand(0.34, 0.45); f0 = rand(70, 98); fEnd = f0 * rand(0.6, 0.78); rate = rand(25, 31); rateEnd = rate * rand(1.2, 1.45); break;
      case 'squeak': dur = rand(0.24, 0.34); f0 = rand(125, 150); fEnd = f0 * rand(1.25, 1.5); rate = rand(38, 45); rateEnd = rate * 1.1; break;
      default: dur = rand(0.28, 0.4); f0 = rand(80, 110); fEnd = f0 * rand(0.65, 0.8); rate = rand(27, 35); rateEnd = rate * 0.8; break;
    }
    // cocô grande (pitch < 1) = pum mais longo e mais grave
    if (p < 1) dur *= Math.min(1.6, 1 / Math.sqrt(p));
    f0 *= p; fEnd *= p;
    const stop = t + dur + 0.08;

    const src = v.osc('sawtooth', f0 * 0.8, t, stop);
    src.frequency.linearRampToValueAtTime(f0, t + 0.03);
    src.frequency.linearRampToValueAtTime(f0 * rand(0.9, 1.12), t + dur * 0.5);
    src.frequency.exponentialRampToValueAtTime(fEnd, t + dur);

    const sub = v.osc('square', f0 * 0.5, t, stop);
    sub.frequency.exponentialRampToValueAtTime(fEnd * 0.5, t + dur);
    const subG = v.gain(0.35);
    sub.connect(subG);

    // "flap" rápido que dá o prrrrt: modula frequência e amplitude
    const flap = v.osc('square', rate, t, stop);
    flap.frequency.linearRampToValueAtTime(rateEnd, t + dur);
    const fm = v.gain(f0 * 0.22);
    flap.connect(fm).connect(src.frequency);
    const am = v.gain(0.55);
    const amDepth = v.gain(0.45);
    flap.connect(amDepth).connect(am.gain);

    const n = v.noise(t, stop);
    const nbp = v.filter('bandpass', Math.min(900, f0 * 3.2), 1.1);
    const ng = v.gain(0.55);
    n.connect(nbp).connect(ng).connect(am);

    src.connect(am);
    subG.connect(am);
    const lp = v.filter('lowpass', rand(650, 1000), 2.5);
    lp.frequency.setValueAtTime(lp.frequency.value, t);
    lp.frequency.linearRampToValueAtTime(lp.frequency.value * 0.7, t + dur);
    const env = v.gain(0);
    am.connect(lp).connect(env).connect(v.out);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.95, t + 0.012);
    env.gain.setValueAtTime(0.95, t + dur * 0.72);
    env.gain.linearRampToValueAtTime(0.0, t + dur);

    // "pffft" no final
    const tail = v.noise(t + dur * 0.8, t + dur + 0.08);
    const tf = v.filter('bandpass', 1400, 0.8);
    const tg = v.gain(0);
    decayEnv(tg.gain, t + dur * 0.8, 0.12, dur * 0.2 + 0.07, 0.02);
    tail.connect(tf).connect(tg).connect(v.out);
  },

  plop(v) {
    const { t, p } = v;
    const o = v.osc('sine', 520 * p, t, t + 0.15);
    o.frequency.exponentialRampToValueAtTime(110 * p, t + 0.09);
    const g = v.gain(0);
    decayEnv(g.gain, t, 0.6, 0.13);
    o.connect(g).connect(v.out);
    const n = v.noise(t, t + 0.06);
    const f = v.filter('lowpass', 900);
    const ng = v.gain(0);
    decayEnv(ng.gain, t, 0.3, 0.045);
    n.connect(f).connect(ng).connect(v.out);
    const o2 = v.osc('sine', 300 * p, t + 0.07, t + 0.17);
    o2.frequency.exponentialRampToValueAtTime(760 * p, t + 0.15);
    const g2 = v.gain(0);
    decayEnv(g2.gain, t + 0.07, 0.22, 0.08);
    o2.connect(g2).connect(v.out);
  },

  splat(v) {
    const { t, p } = v;
    const n = v.noise(t, t + 0.25);
    const bp = v.filter('bandpass', 2200 * p, 1.4);
    bp.frequency.setValueAtTime(2200 * p, t);
    bp.frequency.exponentialRampToValueAtTime(350 * p, t + 0.18);
    const g = v.gain(0);
    decayEnv(g.gain, t, 0.9, 0.2);
    n.connect(bp).connect(g).connect(v.out);
    const o = v.osc('sine', 210 * p, t, t + 0.16);
    o.frequency.exponentialRampToValueAtTime(60 * p, t + 0.12);
    const og = v.gain(0);
    decayEnv(og.gain, t, 0.55, 0.14);
    o.connect(og).connect(v.out);
    const n2 = v.noise(t + 0.035, t + 0.15);
    const lp = v.filter('lowpass', 650);
    const g2 = v.gain(0);
    decayEnv(g2.gain, t + 0.035, 0.45, 0.1);
    n2.connect(lp).connect(g2).connect(v.out);
  },

  enemyDie(v) {
    const { t, p } = v;
    const n = v.noise(t, t + 0.34);
    const lp = v.filter('lowpass', 3500, 2);
    lp.frequency.setValueAtTime(3500, t);
    lp.frequency.exponentialRampToValueAtTime(280, t + 0.3);
    const g = v.gain(0);
    decayEnv(g.gain, t, 0.55, 0.3, 0.01);
    n.connect(lp).connect(g).connect(v.out);
    [1319, 1568, 2093].forEach((f, i) => blip(v, f * p, t + 0.05 + i * 0.055, 0.1, 0.13));
  },

  hurt(v) {
    const { t, p } = v;
    [740, 587, 466].forEach((f, i) => {
      const s = t + i * 0.085;
      const o = blip(v, f * p, s, 0.13, 0.17, 0.5);
      o.frequency.exponentialRampToValueAtTime(f * p * 0.94, s + 0.12);
    });
  },

  pickup(v) {
    const { t, p } = v;
    blip(v, 988 * p, t, 0.07, 0.2);
    blip(v, 1319 * p, t + 0.065, 0.28, 0.2);
  },

  power(v) {
    const { t, p } = v;
    [523, 659, 784, 1047, 1319, 1568, 2093].forEach((f, i) => {
      blip(v, f * p, t + i * 0.045, 0.16, 0.16);
      blip(v, f * p * 2, t + i * 0.045 + 0.13, 0.1, 0.05, 0.125);
    });
  },

  bossHit(v) {
    const { t, p } = v;
    const o = v.osc('square', 190 * p, t, t + 0.13);
    o.frequency.exponentialRampToValueAtTime(70 * p, t + 0.1);
    const g = v.gain(0);
    decayEnv(g.gain, t, 0.3, 0.12);
    const lp = v.filter('lowpass', 1600);
    o.connect(lp).connect(g).connect(v.out);
    const n = v.noise(t, t + 0.07);
    const hp = v.filter('highpass', 2000);
    const ng = v.gain(0);
    decayEnv(ng.gain, t, 0.35, 0.06);
    n.connect(hp).connect(ng).connect(v.out);
  },

  bossRoar(v) {
    const { t, p } = v;
    const dur = 1.05;
    const stop = t + dur + 0.05;
    const mk = (detune) => {
      const o = v.osc('sawtooth', 95 * p, t, stop);
      o.detune.value = detune;
      o.frequency.linearRampToValueAtTime(145 * p, t + 0.25);
      o.frequency.linearRampToValueAtTime(122 * p, t + 0.6);
      o.frequency.exponentialRampToValueAtTime(62 * p, t + dur);
      return o;
    };
    const o1 = mk(0), o2 = mk(22);
    const am = v.gain(0.5);
    v.lfo('square', 31, 0.45, am.gain, t, stop);
    o1.connect(am); o2.connect(am);
    const n = v.noise(t, stop);
    const nb = v.filter('bandpass', 650, 1);
    const ng = v.gain(0.4);
    n.connect(nb).connect(ng).connect(am);
    const f1 = v.filter('bandpass', 500, 5);
    f1.frequency.setValueAtTime(480, t);
    f1.frequency.linearRampToValueAtTime(820, t + 0.35);
    f1.frequency.linearRampToValueAtTime(560, t + dur);
    const f2 = v.filter('bandpass', 900, 6);
    f2.frequency.setValueAtTime(880, t);
    f2.frequency.linearRampToValueAtTime(1250, t + 0.35);
    f2.frequency.linearRampToValueAtTime(950, t + dur);
    const body = v.filter('lowpass', 420, 1);
    const g1 = v.gain(1.4), g2 = v.gain(0.9), g3 = v.gain(0.5);
    const env = v.gain(0);
    am.connect(f1).connect(g1).connect(env);
    am.connect(f2).connect(g2).connect(env);
    am.connect(body).connect(g3).connect(env);
    env.connect(v.out);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.9, t + 0.09);
    env.gain.setValueAtTime(0.9, t + dur * 0.7);
    env.gain.linearRampToValueAtTime(0, t + dur);
  },

  bossDie(v) {
    const { t, p } = v;
    for (let i = 0; i < 7; i++) {
      const s = t + i * 0.17 + rand(0, 0.05);
      const n = v.noise(s, s + 0.25);
      const lp = v.filter('lowpass', rand(700, 2200));
      const g = v.gain(0);
      decayEnv(g.gain, s, 0.55, 0.2);
      n.connect(lp).connect(g).connect(v.out);
      const o = v.osc('sine', 130 * p, s, s + 0.22);
      o.frequency.exponentialRampToValueAtTime(40 * p, s + 0.2);
      const og = v.gain(0);
      decayEnv(og.gain, s, 0.4, 0.2);
      o.connect(og).connect(v.out);
    }
    const slide = v.osc(getPulse(v.ac, 0.25), 900 * p, t + 0.2, t + 1.9);
    slide.frequency.exponentialRampToValueAtTime(55 * p, t + 1.85);
    v.lfo('sine', 8, 25 * p, slide.frequency, t + 0.2, t + 1.9);
    const sg = v.gain(0);
    sg.gain.setValueAtTime(0, t + 0.2);
    sg.gain.linearRampToValueAtTime(0.12, t + 0.3);
    sg.gain.linearRampToValueAtTime(0, t + 1.85);
    slide.connect(sg).connect(v.out);
  },

  checkpoint(v) {
    const { t, p } = v;
    [784, 1047, 1319, 1568].forEach((f, i) => blip(v, f * p, t + i * 0.07, 0.1, 0.17));
    blip(v, 2093 * p, t + 0.28, 0.4, 0.17);
    blip(v, 1568 * p, t + 0.28, 0.4, 0.08, 0.5);
  },

  // "Au!" — fonte rica + formantes que deslizam de /a/ para /u/.
  bark(v) {
    const { t, p } = v;
    const dur = rand(0.15, 0.2);
    const f0 = rand(330, 400) * p;
    const stop = t + dur + 0.03;
    const o = v.osc('sawtooth', f0 * 0.85, t, stop);
    o.frequency.linearRampToValueAtTime(f0 * 1.25, t + 0.03);
    o.frequency.exponentialRampToValueAtTime(f0 * 0.68, t + dur);
    const o2 = v.osc('square', f0 * 0.85 * 1.01, t, stop);
    o2.frequency.linearRampToValueAtTime(f0 * 1.26, t + 0.03);
    o2.frequency.exponentialRampToValueAtTime(f0 * 0.69, t + dur);
    const n = v.noise(t, stop);
    const src = v.gain(1);
    const o2g = v.gain(0.4);
    const ng = v.gain(0.5);
    o.connect(src);
    o2.connect(o2g).connect(src);
    n.connect(ng).connect(src);
    const rough = v.gain(0.7);
    v.lfo('square', 55, 0.3, rough.gain, t, stop);
    src.connect(rough);
    const f1 = v.filter('bandpass', 900, 4);
    f1.frequency.setValueAtTime(950, t);
    f1.frequency.exponentialRampToValueAtTime(430, t + dur);
    const f2 = v.filter('bandpass', 1500, 6);
    f2.frequency.setValueAtTime(1550, t);
    f2.frequency.exponentialRampToValueAtTime(820, t + dur);
    const f1g = v.gain(2.2), f2g = v.gain(1.4);
    const env = v.gain(0);
    rough.connect(f1).connect(f1g).connect(env);
    rough.connect(f2).connect(f2g).connect(env);
    env.connect(v.out);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(1, t + 0.012);
    env.gain.setValueAtTime(1, t + dur * 0.35);
    env.gain.exponentialRampToValueAtTime(0.001, t + dur);
  },

  cage(v) {
    const { t, p } = v;
    // rangido
    const c = v.osc('sawtooth', 85 * p, t, t + 0.42);
    c.frequency.linearRampToValueAtTime(135 * p, t + 0.36);
    const cf = v.filter('bandpass', 1400, 8);
    const cam = v.gain(0.5);
    v.lfo('square', 23, 0.5, cam.gain, t, t + 0.42);
    const cenv = v.gain(0);
    cenv.gain.setValueAtTime(0, t);
    cenv.gain.linearRampToValueAtTime(1.4, t + 0.03);
    cenv.gain.setValueAtTime(1.4, t + 0.3);
    cenv.gain.linearRampToValueAtTime(0, t + 0.38);
    c.connect(cam).connect(cf).connect(cenv).connect(v.out);
    // clank metálico
    const s = t + 0.38;
    const base = 380 * p;
    [[1, 0.28, 0.7], [2.76, 0.2, 0.5], [5.4, 0.13, 0.35], [8.93, 0.08, 0.25]].forEach(([r, a, d]) => {
      const o = v.osc(r < 2 ? 'triangle' : 'sine', base * r, s, s + d + 0.05);
      const g = v.gain(0);
      decayEnv(g.gain, s, a, d, 0.002);
      o.connect(g).connect(v.out);
    });
    const n = v.noise(s, s + 0.06);
    const hp = v.filter('highpass', 3000);
    const ng = v.gain(0);
    decayEnv(ng.gain, s, 0.3, 0.05, 0.002);
    n.connect(hp).connect(ng).connect(v.out);
  },

  cheer(v) {
    const { t, p } = v;
    [523, 659, 784, 1047].forEach((f, i) => blip(v, f * p, t + i * 0.06, 0.1, 0.16));
    [1047, 1319, 1568].forEach((f) => {
      blip(v, f * p, t + 0.26, 0.45, 0.1);
      const o = v.osc('triangle', f * p / 2, t + 0.26, t + 0.75);
      const g = v.gain(0);
      decayEnv(g.gain, t + 0.26, 0.12, 0.45);
      o.connect(g).connect(v.out);
    });
  },

  select(v) {
    const { t, p } = v;
    blip(v, 988 * p, t, 0.045, 0.14);
    blip(v, 1319 * p, t + 0.045, 0.07, 0.14);
  },

  stomp(v) {
    const { t, p } = v;
    const o = v.osc('sine', 115 * p, t, t + 0.48);
    o.frequency.exponentialRampToValueAtTime(34 * p, t + 0.4);
    const g = v.gain(0);
    decayEnv(g.gain, t, 1.0, 0.45);
    o.connect(g).connect(v.out);
    const n = v.noise(t, t + 0.38);
    const lp = v.filter('lowpass', 420);
    const ng = v.gain(0);
    decayEnv(ng.gain, t, 0.8, 0.35);
    n.connect(lp).connect(ng).connect(v.out);
    const tr = v.osc('triangle', 62 * p, t, t + 0.15);
    const tg = v.gain(0);
    decayEnv(tg.gain, t, 0.5, 0.13);
    tr.connect(tg).connect(v.out);
  },

  throw(v) {
    const { t, p } = v;
    const n = v.noise(t, t + 0.33);
    const bp = v.filter('bandpass', 400 * p, 3);
    bp.frequency.setValueAtTime(400 * p, t);
    bp.frequency.exponentialRampToValueAtTime(2200 * p, t + 0.12);
    bp.frequency.exponentialRampToValueAtTime(700 * p, t + 0.3);
    const g = v.gain(0);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.9, t + 0.1);
    g.gain.linearRampToValueAtTime(0, t + 0.31);
    n.connect(bp).connect(g).connect(v.out);
  },

  // "MUÁ-há-há-há-háaa" do Constipador
  laugh(v) {
    const { t, p } = v;
    const syl = [
      { d: 0.3, f: [150, 195, 150] },
      { d: 0.13, f: [185, 165] },
      { d: 0.13, f: [172, 152] },
      { d: 0.13, f: [160, 140] },
      { d: 0.26, f: [150, 95] },
    ];
    let s = t;
    for (const [i, sy] of syl.entries()) {
      const stop = s + sy.d + 0.04;
      const o = v.osc('sawtooth', sy.f[0] * p, s, stop);
      if (sy.f.length === 3) {
        o.frequency.linearRampToValueAtTime(sy.f[1] * p, s + sy.d * 0.4);
        o.frequency.exponentialRampToValueAtTime(sy.f[2] * p, s + sy.d);
      } else {
        o.frequency.exponentialRampToValueAtTime(sy.f[1] * p, s + sy.d);
      }
      v.lfo('sine', 7, 4 * p, o.frequency, s, stop);
      const f1 = v.filter('bandpass', i === 0 ? 420 : 760, 4);
      if (i === 0) { // "mu" -> "á"
        f1.frequency.setValueAtTime(420, s);
        f1.frequency.linearRampToValueAtTime(760, s + sy.d * 0.5);
      }
      const f2 = v.filter('bandpass', 1200, 6);
      const body = v.filter('lowpass', 520);
      const g1 = v.gain(2.0), g2 = v.gain(1.1), g3 = v.gain(0.5);
      const env = v.gain(0);
      o.connect(f1).connect(g1).connect(env);
      o.connect(f2).connect(g2).connect(env);
      o.connect(body).connect(g3).connect(env);
      env.connect(v.out);
      env.gain.setValueAtTime(0, s);
      env.gain.linearRampToValueAtTime(0.85, s + 0.025);
      env.gain.setValueAtTime(0.85, s + sy.d * 0.6);
      env.gain.linearRampToValueAtTime(0, s + sy.d);
      if (i > 0) { // aspirado do "h"
        const n = v.noise(s - 0.03, s + 0.05);
        const nb = v.filter('bandpass', 1300, 1);
        const ng = v.gain(0);
        decayEnv(ng.gain, s - 0.03, 0.35, 0.07, 0.01);
        n.connect(nb).connect(ng).connect(v.out);
      }
      s += sy.d + 0.05;
    }
  },

  thunder(v) {
    const { t } = v;
    const dur = 2.4;
    const n = v.noise(t, t + dur);
    const lp = v.filter('lowpass', 1500, 0.7);
    lp.frequency.setValueAtTime(1500, t);
    lp.frequency.exponentialRampToValueAtTime(150, t + dur);
    const env = v.gain(0);
    const e = env.gain;
    e.setValueAtTime(0, t);
    e.linearRampToValueAtTime(1.0, t + 0.02);
    e.linearRampToValueAtTime(0.3, t + 0.08);
    e.linearRampToValueAtTime(0.9, t + 0.12);
    e.linearRampToValueAtTime(0.35, t + 0.25);
    e.linearRampToValueAtTime(0.8, t + 0.3);
    e.exponentialRampToValueAtTime(0.001, t + dur);
    n.connect(lp).connect(env).connect(v.out);
    const r = v.osc('sine', 48, t, t + 1.9);
    const rg = v.gain(0);
    decayEnv(rg.gain, t, 0.6, 1.8, 0.05);
    r.connect(rg).connect(v.out);
  },

  step(v) {
    const { t } = v;
    const n = v.noise(t, t + 0.04);
    const lp = v.filter('lowpass', 1500);
    const g = v.gain(0);
    decayEnv(g.gain, t, 0.12, 0.03);
    n.connect(lp).connect(g).connect(v.out);
  },
};

// ---------------------------------------------------------------- música

const NOTE_BASE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function noteMidi(name) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error('nota inválida: ' + name);
  return (parseInt(m[3], 10) + 1) * 12 + NOTE_BASE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
const midiFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

// "C5/4 r/2 E5/2" -> eventos {step, len, midi}
function parseSeq(str) {
  const evs = [];
  let step = 0;
  for (const tok of str.trim().split(/\s+/)) {
    const [n, l] = tok.split('/');
    const len = parseInt(l, 10);
    if (n !== 'r') evs.push({ step, len, midi: noteMidi(n) });
    step += len;
  }
  return { evs, length: step };
}

function parseChord(sym) {
  const m = /^([A-G])([#b]?)(.*)$/.exec(sym);
  const root = (NOTE_BASE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12;
  const q = m[3];
  let iv = [0, 4, 7];
  if (q === 'm') iv = [0, 3, 7];
  else if (q === '7') iv = [0, 4, 7, 10];
  else if (q === 'm7') iv = [0, 3, 7, 10];
  else if (q === 'dim') iv = [0, 3, 6];
  return { root, iv };
}

// Um acorde por meio compasso (8 passos). "F G" divide o compasso.
function halfBarChords(chords) {
  const out = [];
  for (const c of chords) {
    const parts = c.split(/\s+/);
    out.push(parseChord(parts[0]), parseChord(parts[1] || parts[0]));
  }
  return out;
}

const BASS_STYLES = {
  bounce: [[0, 2, 0], [2, 2, 12], [4, 2, 7], [6, 2, 12]],
  drive: [[0, 2, 0], [2, 2, 0], [4, 2, 12], [6, 2, 0]],
  baiao: [[0, 3, 0], [3, 3, 7], [6, 2, 12]],
  half: [[0, 8, 0]],
  quarter: [[0, 4, 0], [4, 4, 7]],
};

function genBass(chords, style) {
  const evs = [];
  halfBarChords(chords).forEach((ch, i) => {
    const base = ch.root <= 6 ? 48 + ch.root : 36 + ch.root;
    for (const [off, len, iv] of BASS_STYLES[style]) evs.push({ step: i * 8 + off, len, midi: base + iv });
  });
  return evs;
}

function genArp(chords, { rate = 2, oct = 5 }) {
  const evs = [];
  halfBarChords(chords).forEach((ch, i) => {
    const base = (oct + 1) * 12 + ch.root - (ch.root > 7 ? 12 : 0);
    const tones = [...ch.iv.slice(0, 3), 12];
    let k = 0;
    for (let s = 0; s < 8; s += rate) evs.push({ step: i * 8 + s, len: rate, midi: base + tones[k++ % tones.length] });
  });
  return evs;
}

function compileSong(name, def) {
  const warnings = [];
  const bars = def.chords.length;
  const length = bars * 16;
  const byStep = Array.from({ length }, () => []);
  for (const tr of def.tracks) {
    const vol = tr.vol != null ? tr.vol : 1;
    if (tr.drums) {
      const pat = (Array.isArray(tr.drums) ? tr.drums.join('') : tr.drums).replace(/\s+/g, '');
      if (length % pat.length) warnings.push(`${name}: bateria com ${pat.length} passos não divide ${length}`);
      for (let s = 0; s < length; s++) {
        const ch = pat[s % pat.length];
        if (ch !== '.') byStep[s].push({ drum: ch, vol });
      }
      continue;
    }
    let evs, trLen;
    if (tr.seq) {
      const parsed = parseSeq(Array.isArray(tr.seq) ? tr.seq.join(' ') : tr.seq);
      evs = parsed.evs; trLen = parsed.length;
      if (length % trLen) warnings.push(`${name}: trilha ${tr.inst} com ${trLen} passos (esperado ${length})`);
    } else if (tr.bass) {
      evs = genBass(def.chords, tr.bass); trLen = length;
    } else if (tr.arp) {
      evs = genArp(def.chords, tr.arp); trLen = length;
    }
    for (let rep = 0; rep * trLen < length; rep++) {
      for (const e of evs) {
        const s = e.step + rep * trLen;
        if (s < length) byStep[s].push({ inst: tr.inst, freq: midiFreq(e.midi + (tr.transpose || 0)), len: e.len, vol });
      }
    }
  }
  return { name, bpm: def.bpm, loop: def.loop, stepDur: 60 / def.bpm / 4, length, byStep, warnings, tail: def.tail || 1.2 };
}

// Instrumentos (ac, destino, freq, início, duração, volume)
const INST = {
  lead(ac, dest, f, t, dur, vol) { pulseNote(ac, dest, f, t, dur, vol, 0.25, true); },
  square(ac, dest, f, t, dur, vol) { pulseNote(ac, dest, f, t, dur, vol, 0.5, true); },
  arp(ac, dest, f, t, dur, vol) {
    const o = ac.createOscillator();
    o.setPeriodicWave(getPulse(ac, 0.125));
    o.frequency.value = f;
    const g = ac.createGain();
    decayEnv(g.gain, t, vol, 0.13, 0.003);
    o.connect(g).connect(dest);
    o.start(t); o.stop(t + 0.16);
    o.onended = () => { o.disconnect(); g.disconnect(); };
  },
  arpSoft(ac, dest, f, t, dur, vol) {
    const o = ac.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    const g = ac.createGain();
    decayEnv(g.gain, t, vol, 0.3, 0.003);
    o.connect(g).connect(dest);
    o.start(t); o.stop(t + 0.32);
    o.onended = () => { o.disconnect(); g.disconnect(); };
  },
  // caixinha de música: triângulo + oitava senoidal com decaimento
  soft(ac, dest, f, t, dur, vol) {
    const o = ac.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    const o2 = ac.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = f * 2;
    const g2 = ac.createGain();
    g2.gain.value = 0.3;
    const g = ac.createGain();
    const end = t + Math.min(1.4, dur + 0.45);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(vol * 0.35, t + Math.max(0.05, dur * 0.8));
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    o.connect(g); o2.connect(g2).connect(g); g.connect(dest);
    o.start(t); o2.start(t); o.stop(end + 0.02); o2.stop(end + 0.02);
    o.onended = () => { o.disconnect(); o2.disconnect(); g2.disconnect(); g.disconnect(); };
  },
  // sanfona: dois pulsos levemente desafinados + tremolo
  sanfona(ac, dest, f, t, dur, vol) {
    const o1 = ac.createOscillator();
    o1.setPeriodicWave(getPulse(ac, 0.5));
    o1.frequency.value = f;
    o1.detune.value = -7;
    const o2 = ac.createOscillator();
    o2.setPeriodicWave(getPulse(ac, 0.25));
    o2.frequency.value = f;
    o2.detune.value = 7;
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2600;
    const trem = ac.createGain();
    trem.gain.value = 0.85;
    const lfo = ac.createOscillator();
    lfo.frequency.value = 6.5;
    const lfoG = ac.createGain();
    lfoG.gain.value = 0.15;
    lfo.connect(lfoG).connect(trem.gain);
    const g = ac.createGain();
    const rel = t + Math.max(0.04, dur - 0.015);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.setValueAtTime(vol * 0.85, rel);
    g.gain.linearRampToValueAtTime(0, rel + 0.06);
    o1.connect(lp); o2.connect(lp); lp.connect(trem).connect(g).connect(dest);
    const stop = rel + 0.08;
    [o1, o2, lfo].forEach((o) => { o.start(t); o.stop(stop); });
    o1.onended = () => { [o1, o2, lfo, lfoG, lp, trem, g].forEach((n) => n.disconnect()); };
  },
  bass(ac, dest, f, t, dur, vol) {
    const o = ac.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    const g = ac.createGain();
    const rel = t + Math.max(0.05, dur * 0.9);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.004);
    g.gain.setValueAtTime(vol * 0.9, rel);
    g.gain.linearRampToValueAtTime(0, rel + 0.04);
    o.connect(g).connect(dest);
    o.start(t); o.stop(rel + 0.05);
    o.onended = () => { o.disconnect(); g.disconnect(); };
  },
};

function pulseNote(ac, dest, f, t, dur, vol, duty, vibrato) {
  const o = ac.createOscillator();
  o.setPeriodicWave(getPulse(ac, duty));
  o.frequency.value = f;
  const g = ac.createGain();
  const hold = t + Math.max(0.08, dur - 0.02);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.006);
  g.gain.linearRampToValueAtTime(vol * 0.6, t + 0.08);
  g.gain.setValueAtTime(vol * 0.6, hold);
  g.gain.linearRampToValueAtTime(0, hold + 0.04);
  o.connect(g).connect(dest);
  const stop = hold + 0.05;
  let lfo = null, lg = null;
  if (vibrato && dur > 0.28) {
    lfo = ac.createOscillator();
    lfo.frequency.value = 5.5;
    lg = ac.createGain();
    lg.gain.setValueAtTime(0, t);
    lg.gain.linearRampToValueAtTime(0, t + 0.12);
    lg.gain.linearRampToValueAtTime(f * 0.008, t + 0.3);
    lfo.connect(lg).connect(o.frequency);
    lfo.start(t); lfo.stop(stop);
  }
  o.start(t); o.stop(stop);
  o.onended = () => { o.disconnect(); g.disconnect(); if (lfo) { lfo.disconnect(); lg.disconnect(); } };
}

function drumNoise(ac, dest, t, vol, type, freq, dur, Q = 1) {
  const s = ac.createBufferSource();
  s.buffer = getNoise(ac);
  const f = ac.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = Q;
  const g = ac.createGain();
  decayEnv(g.gain, t, vol, dur, 0.002);
  s.connect(f).connect(g).connect(dest);
  s.start(t, Math.random() * 1.5);
  s.stop(t + dur + 0.02);
  s.onended = () => { s.disconnect(); f.disconnect(); g.disconnect(); };
}

function drumTone(ac, dest, t, vol, type, f0, f1, dur) {
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.8);
  const g = ac.createGain();
  decayEnv(g.gain, t, vol, dur, 0.002);
  o.connect(g).connect(dest);
  o.start(t); o.stop(t + dur + 0.02);
  o.onended = () => { o.disconnect(); g.disconnect(); };
}

const DRUM = {
  k: (ac, d, t, v) => { drumTone(ac, d, t, 0.6 * v, 'sine', 150, 42, 0.14); drumNoise(ac, d, t, 0.08 * v, 'lowpass', 2000, 0.01); },
  s: (ac, d, t, v) => { drumNoise(ac, d, t, 0.26 * v, 'highpass', 1200, 0.12); drumTone(ac, d, t, 0.14 * v, 'triangle', 200, 170, 0.08); },
  h: (ac, d, t, v) => drumNoise(ac, d, t, 0.07 * v, 'highpass', 7000, 0.03),
  o: (ac, d, t, v) => drumNoise(ac, d, t, 0.08 * v, 'highpass', 6500, 0.15),
  t: (ac, d, t, v) => { drumTone(ac, d, t, 0.05 * v, 'sine', 4186, 4186, 0.05); drumTone(ac, d, t, 0.03 * v, 'sine', 6150, 6150, 0.04); },
  T: (ac, d, t, v) => { drumTone(ac, d, t, 0.06 * v, 'sine', 4186, 4186, 0.3); drumTone(ac, d, t, 0.035 * v, 'sine', 6150, 6150, 0.22); },
  c: (ac, d, t, v) => { drumNoise(ac, d, t, 0.14 * v, 'bandpass', 1800, 0.04, 2); drumNoise(ac, d, t + 0.012, 0.1 * v, 'bandpass', 1900, 0.05, 2); },
  x: (ac, d, t, v) => drumNoise(ac, d, t, 0.13 * v, 'highpass', 5000, 1.0),
  X: (ac, d, t, v) => { DRUM.k(ac, d, t, v); DRUM.x(ac, d, t, v); },
  z: (ac, d, t, v) => { drumTone(ac, d, t, 0.5 * v, 'sine', 115, 58, 0.22); drumNoise(ac, d, t, 0.05 * v, 'lowpass', 900, 0.03); },
};

const SONG_DEFS = {
  title: {
    bpm: 140, loop: true,
    chords: ['C', 'F', 'G', 'C', 'Am', 'F', 'G', 'G'],
    tracks: [
      { inst: 'lead', vol: 0.2, seq: [
        'G4/2 C5/2 C5/2 E5/2 G5/6 E5/2',
        'F5/2 E5/2 D5/2 C5/2 A5/8',
        'G5/2 F5/2 E5/2 D5/2 B4/4 D5/4',
        'C5/4 E5/4 G5/4 C6/4',
        'A5/2 G5/2 E5/2 C5/2 E5/4 A5/4',
        'C6/4 A5/4 F5/4 A5/4',
        'B5/2 A5/2 G5/2 F5/2 D5/4 G5/4',
        'B5/4 D6/4 G5/8',
      ] },
      { inst: 'bass', vol: 0.34, bass: 'bounce' },
      { inst: 'arp', vol: 0.05, arp: { rate: 2, oct: 5 } },
      { drums: 'k.hhs.h.k.hhs.hs' },
    ],
  },

  level1: {
    bpm: 125, loop: true,
    chords: ['C', 'G', 'Am', 'F', 'C', 'G', 'F G', 'C', 'F', 'G', 'Em', 'Am', 'Dm', 'G', 'C Am', 'Dm G'],
    tracks: [
      { inst: 'lead', vol: 0.19, seq: [
        'E5/2 G5/2 C6/4 B5/2 G5/2 E5/4',
        'D5/2 G5/2 B5/4 A5/2 G5/2 D5/4',
        'C5/2 E5/2 A5/4 G5/2 E5/2 C5/2 E5/2',
        'F5/4 E5/2 D5/2 C5/4 r/4',
        'E5/2 G5/2 C6/4 D6/2 C6/2 G5/4',
        'B5/2 A5/2 G5/4 D5/2 E5/2 G5/4',
        'A5/4 G5/2 F5/2 D5/4 B4/4',
        'C5/8 r/4 G4/2 B4/2',
        'A4/2 C5/2 F5/4 E5/2 F5/2 A5/4',
        'G5/4 D5/2 G5/2 B5/4 A5/4',
        'G5/2 B5/2 E6/4 D6/2 B5/2 G5/4',
        'A5/6 G5/2 E5/4 C5/4',
        'D5/2 F5/2 A5/4 C6/4 A5/4',
        'B5/4 G5/2 A5/2 B5/4 D6/4',
        'C6/4 G5/4 A5/4 E5/4',
        'F5/4 D5/4 B4/4 G4/4',
      ] },
      { inst: 'bass', vol: 0.34, bass: 'bounce' },
      { inst: 'arp', vol: 0.045, arp: { rate: 2, oct: 5 } },
      { drums: 'k.h.s.h.k.k.s.hh' },
    ],
  },

  level2: {
    bpm: 118, loop: true,
    chords: ['G', 'G', 'F', 'G', 'G', 'C', 'D7', 'G', 'C', 'G', 'D', 'G', 'C', 'G', 'D7', 'G'],
    tracks: [
      { inst: 'sanfona', vol: 0.15, seq: [
        'D5/3 G5/3 A5/2 B5/3 A5/3 G5/2',
        'F5/3 G5/3 D5/2 B4/4 D5/4',
        'C5/3 F5/3 A5/2 C6/3 A5/3 F5/2',
        'G5/6 r/2 D5/2 E5/2 F5/2 F#5/2',
        'G5/3 B5/3 D6/2 B5/3 G5/3 D5/2',
        'E5/3 G5/3 C6/2 B5/3 A5/3 G5/2',
        'F#5/3 A5/3 C6/2 A5/3 F#5/3 D5/2',
        'G5/8 r/4 D5/2 E5/2',
        'E5/2 E5/2 G5/2 E5/2 C5/4 E5/4',
        'D5/2 D5/2 B4/2 D5/2 G5/8',
        'F#5/3 E5/3 D5/2 E5/3 F#5/3 A5/2',
        'G5/6 B5/2 A5/4 G5/4',
        'C6/3 B5/3 A5/2 G5/3 E5/3 C5/2',
        'B4/3 D5/3 G5/2 B5/3 A5/3 G5/2',
        'A5/4 F#5/4 C6/4 A5/4',
        'G5/4 D5/4 G4/8',
      ] },
      { inst: 'bass', vol: 0.36, bass: 'baiao' },
      { inst: 'arp', vol: 0.035, arp: { rate: 4, oct: 5 } },
      { drums: 'z..z..c.z..z..c.' },
      { drums: 'ttTtttTtttTtttTt' },
    ],
  },

  boss: {
    bpm: 150, loop: true,
    chords: ['Am', 'Am', 'F', 'G', 'Am', 'Am', 'E', 'E'],
    tracks: [
      { inst: 'square', vol: 0.15, seq: [
        'A4/2 C5/2 E5/2 A5/2 G#5/2 A5/2 E5/4',
        'C6/2 B5/2 A5/2 E5/2 C5/4 E5/4',
        'F5/2 A5/2 C6/2 A5/2 F5/2 C5/2 F5/4',
        'G5/2 B5/2 D6/2 B5/2 G5/2 D5/2 B4/4',
        'A5/2 A5/2 G5/2 A5/2 C6/4 A5/4',
        'E6/2 D6/2 C6/2 B5/2 A5/4 E5/4',
        'G#5/2 B5/2 E6/4 D6/2 B5/2 G#5/4',
        'E5/4 G#5/4 B5/4 r/4',
      ] },
      { inst: 'bass', vol: 0.36, bass: 'drive' },
      { inst: 'arp', vol: 0.04, arp: { rate: 1, oct: 4 } },
      { drums: 'k.hks.h.k.hks.hh' },
    ],
  },

  cutscene: {
    bpm: 96, loop: true,
    chords: ['F', 'C', 'Dm', 'Bb', 'F', 'C', 'Bb', 'C'],
    tracks: [
      { inst: 'soft', vol: 0.3, seq: [
        'A5/4 C6/4 A5/4 F5/4',
        'G5/4 E5/4 C5/8',
        'F5/4 A5/4 D6/4 C6/4',
        'Bb5/8 A5/4 G5/4',
        'A5/4 C6/4 F6/4 E6/4',
        'D6/4 C6/4 G5/8',
        'F5/4 G5/4 A5/4 Bb5/4',
        'G5/8 E5/8',
      ] },
      { inst: 'bass', vol: 0.3, bass: 'half' },
      { inst: 'arpSoft', vol: 0.1, arp: { rate: 2, oct: 4 } },
      { drums: 'h.......h.......', vol: 0.8 },
    ],
  },

  danger: {
    bpm: 120, loop: true,
    chords: ['Em', 'Em', 'Em', 'Em'],
    tracks: [
      { inst: 'square', vol: 0.13, seq: [
        'E5/2 r/2 D#5/2 r/2 E5/2 r/2 G5/4',
        'F#5/2 r/2 F5/2 r/2 E5/8',
        'E5/2 r/2 D#5/2 r/2 E5/2 r/2 A#5/4',
        'A5/2 G#5/2 G5/2 F#5/2 F5/4 E5/4',
      ] },
      { inst: 'bass', vol: 0.4, seq: [
        'E3/2 r/2 E3/2 r/2 E3/2 r/2 F3/2 F#3/2',
        'G3/2 r/2 G3/2 r/2 F#3/2 r/2 F3/2 r/2',
        'E3/2 r/2 E3/2 r/2 E3/2 r/2 F3/2 F#3/2',
        'B2/4 A#2/4 A2/4 B2/4',
      ] },
      { drums: 'k...s...k.k.s...' },
    ],
  },

  victory: {
    bpm: 140, loop: false, tail: 1.5,
    chords: ['C', 'F', 'G', 'C'],
    tracks: [
      { inst: 'lead', vol: 0.2, seq: [
        'G4/2 C5/2 E5/2 G5/6 E5/2 G5/2',
        'A5/2 A5/2 A5/2 C6/6 A5/2 C6/2',
        'D6/4 B5/4 G5/2 A5/2 B5/2 D6/2',
        'C6/12 r/4',
      ] },
      { inst: 'lead', vol: 0.09, transpose: -5, seq: [
        'G4/2 C5/2 E5/2 G5/6 E5/2 G5/2',
        'A5/2 A5/2 A5/2 C6/6 A5/2 C6/2',
        'D6/4 B5/4 G5/2 A5/2 B5/2 D6/2',
        'C6/12 r/4',
      ] },
      { inst: 'bass', vol: 0.34, bass: 'quarter' },
      { drums: [
        'k.s.k.s.k.s.ksss',
        'k.s.k.s.k.s.ksss',
        'k.s.k.s.k.s.ksss',
        'X...............',
      ] },
    ],
  },

  rescue: {
    bpm: 90, loop: false, tail: 1.6,
    chords: ['F Bb', 'C F'],
    tracks: [
      { inst: 'soft', vol: 0.32, seq: [
        'C6/4 A5/4 Bb5/4 D6/4',
        'C6/6 A5/2 F5/8',
      ] },
      { inst: 'bass', vol: 0.3, bass: 'half' },
      { inst: 'arpSoft', vol: 0.11, arp: { rate: 1, oct: 4 } },
    ],
  },
};

const SONGS = {};
for (const [name, def] of Object.entries(SONG_DEFS)) SONGS[name] = compileSong(name, def);

function scheduleStep(ac, dest, song, step, time) {
  for (const ev of song.byStep[step]) {
    if (ev.drum) DRUM[ev.drum](ac, dest, time, ev.vol);
    else INST[ev.inst](ac, dest, ev.freq, time, ev.len * song.stepDur, ev.vol);
  }
}

class SongPlayer {
  constructor(song) {
    this.song = song;
    this.name = song.name;
    this.gain = ctx.createGain();
    this.gain.gain.setValueAtTime(0, ctx.currentTime);
    this.gain.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.08);
    this.gain.connect(bus.music);
    this.step = 0;
    this.time = ctx.currentTime + 0.08;
    this.active = true;
  }
  tick() {
    if (!this.active) return;
    const now = ctx.currentTime;
    // aba ficou para trás (timer estrangulado): pula sem acumular notas
    while (this.time < now - 0.05) { this.time += this.song.stepDur; this.step++; }
    while (this.time < now + LOOKAHEAD) {
      if (!this.song.loop && this.step >= this.song.length) {
        this.active = false;
        const g = this.gain;
        setTimeout(() => { try { g.disconnect(); } catch (e) { /* ok */ } }, (this.song.tail + 0.5) * 1000 + (this.time - now) * 1000);
        players.delete(this);
        return;
      }
      scheduleStep(ctx, this.gain, this.song, this.step % this.song.length, this.time);
      this.time += this.song.stepDur;
      this.step++;
    }
  }
  stop(fade) {
    this.active = false;
    players.delete(this);
    const t = ctx.currentTime;
    const g = this.gain;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(0, t + Math.max(0.01, fade));
    setTimeout(() => { try { g.disconnect(); } catch (e) { /* ok */ } }, (fade + 1.6) * 1000);
  }
}

function ensureScheduler() {
  if (schedTimer) return;
  schedTimer = setInterval(() => {
    if (!ctx || ctx.state !== 'running') return;
    for (const p of players) p.tick();
    if (players.size === 0) { clearInterval(schedTimer); schedTimer = null; }
  }, TICK_MS);
}

// ---------------------------------------------------------------- voz

const voices = {}; // name -> { url, text, ab, buffer, failed, loading, decoding }
let voiceCur = null; // { name, src, resolve, timer, speech }
let analyser = null;
let analyserBuf = null;
let level = 0;
let levelTime = 0;

function decodeBuffer(ab) {
  return new Promise((res, rej) => {
    try {
      const p = ctx.decodeAudioData(ab, res, rej);
      if (p && p.then) p.then(res, rej);
    } catch (e) { rej(e); }
  });
}

function decodeVoice(entry) {
  if (entry.buffer || entry.failed || !entry.ab || !ctx) return entry.decoding || Promise.resolve();
  if (!entry.decoding) {
    const ab = entry.ab;
    entry.ab = null;
    entry.decoding = decodeBuffer(ab)
      .then((b) => { entry.buffer = b; })
      .catch(() => { entry.failed = true; });
  }
  return entry.decoding;
}

function duck(on) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const g = bus.duck.gain;
  g.cancelScheduledValues(t);
  g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime(on ? DUCK_LEVEL : 1, t + (on ? 0.15 : 0.5));
}

function estimateSpeech(text) { return Math.max(1.5, (text || '').length * 0.075); }

function pickPtVoice() {
  if (!('speechSynthesis' in window)) return null;
  const list = speechSynthesis.getVoices() || [];
  const pt = list.filter((v) => /^pt(-|_)?BR/i.test(v.lang));
  const any = pt.length ? pt : list.filter((v) => /^pt/i.test(v.lang));
  const fem = any.find((v) => /luciana|female|feminin|francisca|vit[oó]ria|google portugu/i.test(v.name));
  return fem || any[0] || null;
}

function speak(text, onEnd) {
  if (!('speechSynthesis' in window) || !text) { const tm = setTimeout(onEnd, estimateSpeech(text) * 1000); return () => clearTimeout(tm); }
  let done = false;
  const finish = () => { if (!done) { done = true; clearTimeout(safety); onEnd(); } };
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'pt-BR';
  const vv = pickPtVoice();
  if (vv) u.voice = vv;
  u.rate = 1.0;
  u.pitch = 1.15;
  u.onend = finish;
  u.onerror = finish;
  const safety = setTimeout(finish, (estimateSpeech(text) + 3) * 1000);
  try { speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) { finish(); }
  return () => { done = true; clearTimeout(safety); try { speechSynthesis.cancel(); } catch (e) { /* ok */ } };
}

// ---------------------------------------------------------------- grafo

function buildGraph() {
  const master = ctx.createGain();
  master.gain.value = muted ? 0 : 1;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -12;
  comp.knee.value = 6;
  comp.ratio.value = 6;
  comp.attack.value = 0.003;
  comp.release.value = 0.15;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -2;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.08;
  master.connect(comp).connect(limiter).connect(ctx.destination);
  const sfx = ctx.createGain(); sfx.gain.value = SFX_VOL; sfx.connect(master);
  const duckG = ctx.createGain(); duckG.gain.value = 1; duckG.connect(master);
  const music = ctx.createGain(); music.gain.value = MUSIC_VOL; music.connect(duckG);
  const voice = ctx.createGain(); voice.gain.value = VOICE_VOL; voice.connect(master);
  analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  analyserBuf = new Float32Array(analyser.fftSize);
  analyser.connect(voice);
  bus = { master, sfx, music, duck: duckG, voice };
}

function hookGestures() {
  if (gestureHooked) return;
  gestureHooked = true;
  const kick = () => {
    if (ctx && !userPaused && ctx.state !== 'running' && ctx.state !== 'closed') ctx.resume().catch(() => {});
  };
  ['pointerup', 'touchend', 'keydown', 'mousedown'].forEach((ev) => window.addEventListener(ev, kick, { passive: true }));
}

// ---------------------------------------------------------------- API

export const audio = {
  sfxNames: Object.keys(SFX),
  musicNames: Object.keys(SONG_DEFS),

  unlock() {
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { ctx = new AC(); }
        buildGraph();
        hookGestures();
      }
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* ok */ }
      if (ctx.state !== 'running' && !userPaused) ctx.resume().catch(() => {});
      // buffer silencioso destrava o iOS
      const b = ctx.createBuffer(1, 1, 22050);
      const s = ctx.createBufferSource();
      s.buffer = b;
      s.connect(ctx.destination);
      s.start(0);
      s.onended = () => s.disconnect();
      // aquece o speechSynthesis no gesto (exigência do iOS)
      if ('speechSynthesis' in window && !audio._speechWarm) {
        audio._speechWarm = true;
        try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } catch (e) { /* ok */ }
      }
      for (const e of Object.values(voices)) decodeVoice(e);
      if (pendingMusic) { const m = pendingMusic; pendingMusic = null; audio.playMusic(m); }
    } catch (e) {
      console.warn('[audio] unlock falhou', e);
    }
  },

  sfx(name, opts) {
    if (!ctx || muted || userPaused || !SFX[name]) return;
    if (ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const gap = name === 'step' ? 0.08 : 0.03;
    if (lastSfx[name] != null && now - lastSfx[name] < gap) return;
    if (activeSfx > 28) return;
    lastSfx[name] = now;
    try {
      const o = opts || {};
      const v = makeVoice(ctx, bus.sfx, now + 0.005, { pitch: o.pitch, vol: (o.vol != null ? o.vol : 1) * (SFX_GAIN[name] || 1) });
      SFX[name](v);
      v.finish();
    } catch (e) {
      console.warn('[audio] sfx', name, e);
    }
  },

  playMusic(name) {
    if (!SONGS[name]) return;
    if (!ctx) { pendingMusic = name; return; }
    if (currentSong && currentSong.name === name && currentSong.active) return;
    if (currentSong && currentSong.active) currentSong.stop(0.3);
    currentSong = new SongPlayer(SONGS[name]);
    players.add(currentSong);
    ensureScheduler();
  },

  stopMusic(fadeSec = 0.5) {
    pendingMusic = null;
    if (currentSong && currentSong.active) currentSong.stop(fadeSec);
    currentSong = null;
  },

  get musicName() { return currentSong && currentSong.active ? currentSong.name : null; },

  loadVoice(name, url, fallbackText) {
    const entry = voices[name] || (voices[name] = {});
    entry.url = url;
    entry.text = fallbackText || entry.text || '';
    if (entry.loading) return entry.loading;
    entry.loading = fetch(url)
      .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
      .then((ab) => { entry.ab = ab; return decodeVoice(entry); })
      .catch(() => { entry.failed = true; });
    return entry.loading;
  },

  playVoice(name) {
    audio.stopVoice();
    const entry = voices[name];
    if (!entry) return Promise.resolve();
    return new Promise((resolve) => {
      const cur = { name, resolve, t0: performance.now() };
      voiceCur = cur;
      const end = () => {
        if (cur.ended) return;
        cur.ended = true;
        if (cur.timer) clearTimeout(cur.timer);
        if (voiceCur === cur) { voiceCur = null; duck(false); }
        resolve();
      };
      cur.end = end;
      const start = () => {
        if (voiceCur !== cur) return;
        // sem áudio (mudo/bloqueado): mantém o tempo da fala para as cenas
        if (!ctx || muted || ctx.state !== 'running') {
          const dur = entry.buffer ? entry.buffer.duration : estimateSpeech(entry.text);
          cur.simulated = true;
          cur.timer = setTimeout(end, dur * 1000);
          return;
        }
        if (entry.buffer) {
          const src = ctx.createBufferSource();
          src.buffer = entry.buffer;
          src.connect(analyser);
          src.onended = () => { src.disconnect(); end(); };
          cur.src = src;
          duck(true);
          src.start(ctx.currentTime + 0.02);
          return;
        }
        cur.simulated = true;
        duck(true);
        cur.cancelSpeech = speak(entry.text, end);
      };
      const wait = entry.loading ? entry.loading.then(() => decodeVoice(entry)) : Promise.resolve();
      wait.then(start, start);
    });
  },

  stopVoice() {
    const cur = voiceCur;
    if (!cur) return;
    if (cur.src) { try { cur.src.onended = null; cur.src.stop(); cur.src.disconnect(); } catch (e) { /* ok */ } }
    if (cur.cancelSpeech) cur.cancelSpeech();
    if (cur.end) cur.end();
  },

  voiceLevel() {
    const now = performance.now();
    const dt = Math.min(0.1, (now - levelTime) / 1000 || 0.016);
    levelTime = now;
    let target = 0;
    if (voiceCur && !voiceCur.ended) {
      if (voiceCur.src && analyser) {
        analyser.getFloatTimeDomainData(analyserBuf);
        let sum = 0;
        for (let i = 0; i < analyserBuf.length; i++) sum += analyserBuf[i] * analyserBuf[i];
        const rms = Math.sqrt(sum / analyserBuf.length);
        target = Math.min(1, Math.max(0, (rms - 0.015) * 5));
      } else if (voiceCur.simulated) {
        const s = (now - voiceCur.t0) / 1000;
        target = Math.max(0, Math.abs(Math.sin(s * 11) * Math.sin(s * 3.7 + 1)) * 0.9 + (Math.random() - 0.5) * 0.15);
      }
    }
    const k = 1 - Math.exp(-dt * (target > level ? 30 : 12));
    level += (target - level) * k;
    return Math.max(0, Math.min(1, level));
  },

  voiceDuration(name) {
    const e = voices[name];
    return e && e.buffer ? e.buffer.duration : null;
  },

  get muted() { return muted; },

  setMuted(m) {
    muted = !!m;
    try { localStorage.setItem('pdc_muted', muted ? '1' : '0'); } catch (e) { /* ok */ }
    if (ctx) {
      const t = ctx.currentTime;
      bus.master.gain.cancelScheduledValues(t);
      bus.master.gain.setValueAtTime(bus.master.gain.value, t);
      bus.master.gain.linearRampToValueAtTime(muted ? 0 : 1, t + 0.05);
    }
    if (muted && voiceCur && voiceCur.cancelSpeech) { try { speechSynthesis.cancel(); } catch (e) { /* ok */ } }
  },

  pause() {
    userPaused = true;
    if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {});
    try { if ('speechSynthesis' in window) speechSynthesis.pause(); } catch (e) { /* ok */ }
  },

  resume() {
    userPaused = false;
    if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {});
    try { if ('speechSynthesis' in window) speechSynthesis.resume(); } catch (e) { /* ok */ }
  },

  // ---- apoio a testes: renderiza efeito/música num OfflineAudioContext
  _songInfo() {
    return Object.values(SONGS).map((s) => ({ name: s.name, bpm: s.bpm, seconds: +(s.length * s.stepDur).toFixed(2), loop: s.loop, warnings: s.warnings }));
  },

  _renderOffline(kind, name, seconds) {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const sr = 44100;
    const oc = new OAC(1, Math.ceil(sr * seconds), sr);
    offlineCtxs.add(oc);
    const comp = oc.createDynamicsCompressor();
    comp.threshold.value = -12; comp.knee.value = 6; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.15;
    const lim = oc.createDynamicsCompressor();
    lim.threshold.value = -2; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.08;
    comp.connect(lim).connect(oc.destination);
    const g = oc.createGain();
    g.connect(comp);
    if (kind === 'sfx') {
      g.gain.value = SFX_VOL;
      const v = makeVoice(oc, g, 0.01, { vol: SFX_GAIN[name] || 1 });
      SFX[name](v);
    } else {
      g.gain.value = MUSIC_VOL;
      const song = SONGS[name];
      const steps = Math.ceil(seconds / song.stepDur);
      for (let s = 0; s < steps; s++) {
        if (!song.loop && s >= song.length) break;
        scheduleStep(oc, g, song, s % song.length, 0.02 + s * song.stepDur);
      }
    }
    return oc.startRendering();
  },
};
