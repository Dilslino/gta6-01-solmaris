// WebAudio-only sound: every effect is synthesized, no audio files, no network.
// The context is created lazily on the first user gesture; shot mode never touches it.
let ctx = null;
let master = null;
let enabled = true;
let engineOsc = null;
let engineGain = null;
let sirenOsc = null;
let sirenGain = null;

export function initAudio() {
  if (ctx || typeof window === 'undefined') return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
  } catch { /* sound is optional */ }
}
export function resumeAudio() { if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); }
export function setAudioEnabled(v) { enabled = v; if (master) master.gain.value = v ? 0.35 : 0; }

function tone(freq, dur, type, vol, slideTo) {
  if (!ctx || !enabled) return;
  try {
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  } catch { /* ignore */ }
}
function noise(dur, vol, lowpass) {
  if (!ctx || !enabled) return;
  try {
    const t = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = lowpass || 1200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol || 0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t);
  } catch { /* ignore */ }
}

export const sfx = {
  click() { tone(660, 0.07, 'square', 0.12); },
  pickup() { tone(520, 0.09, 'sine', 0.2); setTimeout(() => tone(780, 0.12, 'sine', 0.2), 70); },
  cash() { tone(880, 0.08, 'sine', 0.2); setTimeout(() => tone(1174, 0.14, 'sine', 0.2), 80); },
  shot() { noise(0.14, 0.4, 900); tone(180, 0.1, 'sawtooth', 0.15, 60); },
  punch() { noise(0.08, 0.3, 500); },
  crash() { noise(0.25, 0.45, 400); tone(90, 0.2, 'sawtooth', 0.2, 40); },
  steal() { tone(300, 0.12, 'square', 0.15, 500); },
  sirenBlip() { tone(900, 0.15, 'sine', 0.12, 1400); },
  mission() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'triangle', 0.2), i * 110)); },
  fail() { [400, 300, 200].forEach((f, i) => setTimeout(() => tone(f, 0.2, 'sawtooth', 0.15), i * 130)); },
  heal() { tone(440, 0.12, 'sine', 0.15, 660); },
};

export function setEngine(on, speedRatio) {
  if (!ctx || !enabled) { if (engineOsc) { try { engineOsc.stop(); } catch {} engineOsc = null; } return; }
  try {
    if (on && !engineOsc) {
      engineOsc = ctx.createOscillator();
      engineGain = ctx.createGain();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 60;
      engineGain.gain.value = 0.05;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 400;
      engineOsc.connect(f); f.connect(engineGain); engineGain.connect(master);
      engineOsc.start();
    } else if (!on && engineOsc) {
      engineOsc.stop(); engineOsc = null; engineGain = null;
    }
    if (engineOsc) {
      engineOsc.frequency.value = 55 + speedRatio * 140;
      engineGain.gain.value = 0.03 + speedRatio * 0.05;
    }
  } catch { /* ignore */ }
}

export function setSiren(on) {
  if (!ctx || !enabled) return;
  try {
    if (on && !sirenOsc) {
      sirenOsc = ctx.createOscillator();
      sirenGain = ctx.createGain();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 800;
      sirenGain.gain.value = 0.045;
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.8;
      lfoGain.gain.value = 350;
      lfo.connect(lfoGain); lfoGain.connect(sirenOsc.frequency);
      sirenOsc.connect(sirenGain); sirenGain.connect(master);
      sirenOsc.start(); lfo.start();
      sirenOsc._lfo = lfo;
    } else if (!on && sirenOsc) {
      sirenOsc._lfo.stop();
      sirenOsc.stop(); sirenOsc = null; sirenGain = null;
    }
  } catch { /* ignore */ }
}
