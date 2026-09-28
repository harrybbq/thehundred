// Web Audio sound effects (no files) — ported from v1.
let ctx: AudioContext | null = null;
let noiseBuf: AudioBuffer | null = null;
let enabled = (() => { try { return localStorage.getItem('th-sound') !== 'off'; } catch { return true; } })();

export const soundEnabled = () => enabled;
export function setSoundEnabled(v: boolean) { enabled = v; try { localStorage.setItem('th-sound', v ? 'on' : 'off'); } catch { /* ignore */ } }

function ac() {
  if (!enabled) return null;
  try {
    if (!ctx) { const AC = window.AudioContext || (window as any).webkitAudioContext; if (!AC) return null; ctx = new AC(); }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch { return null; }
}
function tone({ freq = 440, to = 0, type = 'sine' as OscillatorType, dur = 0.15, vol = 0.2, when = 0, attack = 0.005 }) {
  const c = ac(); if (!c) return;
  const t = c.currentTime + when, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.05);
}
function noise({ dur = 0.2, vol = 0.2, when = 0, freq = 1200, type = 'lowpass' as BiquadFilterType }) {
  const c = ac(); if (!c) return;
  if (!noiseBuf) { noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const t = c.currentTime + when, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = noiseBuf; f.type = type; f.frequency.value = freq;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(c.destination); s.start(t); s.stop(t + dur + 0.05);
}
const notes = (list: [number, number, number?][], o: { type?: OscillatorType; vol: number; dur: number }) =>
  list.forEach(([f, w, d]) => tone({ ...o, freq: f, when: w, dur: d ?? o.dur }));

export const Sound = {
  unlock: () => { ac(); },
  tick()   { tone({ freq: 1900, type: 'square', dur: 0.025, vol: 0.06 }); noise({ dur: 0.02, vol: 0.12, freq: 4000, type: 'highpass' }); },
  pop()    { tone({ freq: 260, to: 900, dur: 0.12, vol: 0.25 }); tone({ freq: 500, to: 1400, dur: 0.1, vol: 0.15, when: 0.06 }); tone({ freq: 700, to: 1800, dur: 0.08, vol: 0.1, when: 0.12 }); },
  down()   { tone({ freq: 500, to: 200, dur: 0.18, vol: 0.18, type: 'triangle' }); },
  thud()   { tone({ freq: 140, to: 45, dur: 0.3, vol: 0.5 }); noise({ dur: 0.15, vol: 0.3, freq: 700 }); },
  reveal() { Sound.thud(); notes([[392, 0.05], [494, 0.05], [587, 0.05], [784, 0.05, 0.6]], { type: 'sawtooth', vol: 0.07, dur: 0.5 }); },
  fanfare(){ notes([[523, 0], [659, 0.12], [784, 0.24], [1047, 0.36, 0.7]], { type: 'triangle', vol: 0.22, dur: 0.25 }); notes([[523, 0.36, 0.7], [659, 0.36, 0.7]], { type: 'sawtooth', vol: 0.05, dur: 0.7 }); },
  win()    { notes([[523, 0], [659, 0.15], [784, 0.3], [1047, 0.45], [784, 0.6], [1047, 0.75, 1.4]], { type: 'triangle', vol: 0.25, dur: 0.2 }); notes([[262, 0.75, 1.4], [330, 0.75, 1.4], [392, 0.75, 1.4]], { type: 'sawtooth', vol: 0.06, dur: 1.4 }); },
  lose()   { notes([[392, 0, 0.45], [370, 0.5, 0.45], [349, 1, 0.45]], { type: 'sawtooth', vol: 0.12, dur: 0.45 }); tone({ freq: 330, to: 200, type: 'sawtooth', dur: 1.6, vol: 0.12, when: 1.5 }); },
  heal()   { [660, 880, 1100, 1320, 1760].forEach((f, i) => tone({ freq: f, to: f * 1.02, dur: 0.5, vol: 0.12, when: i * 0.08 })); noise({ dur: 0.8, vol: 0.05, freq: 6000, type: 'highpass' }); },
  love()   { tone({ freq: 90, to: 50, dur: 0.18, vol: 0.5 }); tone({ freq: 90, to: 50, dur: 0.18, vol: 0.4, when: 0.22 }); notes([[784, 0.4], [988, 0.5], [1175, 0.6, 0.6]], { vol: 0.1, dur: 0.3 }); },
  beep()   { tone({ freq: 880, type: 'square', dur: 0.12, vol: 0.08 }); },
  alarm()  { for (let i = 0; i < 4; i++) { tone({ freq: 988, type: 'square', dur: 0.14, vol: 0.12, when: i * 0.3 }); tone({ freq: 740, type: 'square', dur: 0.14, vol: 0.12, when: i * 0.3 + 0.15 }); } },
  scrooge() { notes([[659, 0], [622, 0.1], [659, 0.2], [494, 0.3], [587, 0.4], [523, 0.5], [440, 0.6, 0.5]], { type: 'square', vol: 0.07, dur: 0.1 }); noise({ dur: 0.6, vol: 0.08, freq: 3000, type: 'bandpass', when: 0.6 }); },
  drumroll(){ for (let i = 0; i < 24; i++) noise({ dur: 0.06, vol: 0.05 + i * 0.006, freq: 900, when: i * 0.07 }); },
  clunk()  { tone({ freq: 90, to: 40, dur: 0.25, vol: 0.45 }); noise({ dur: 0.08, vol: 0.35, freq: 2400, type: 'bandpass' }); tone({ freq: 1400, type: 'square', dur: 0.03, vol: 0.05, when: 0.02 }); },
  scratch(){ for (let i = 0; i < 3; i++) noise({ dur: 0.32, vol: 0.22, freq: 3200 + i * 500, type: 'bandpass', when: i * 0.38 }); tone({ freq: 220, to: 110, type: 'sawtooth', dur: 0.9, vol: 0.05, when: 0.2 }); },
  staticNoise(){ noise({ dur: 1.4, vol: 0.18, freq: 5000, type: 'highpass' }); noise({ dur: 1.4, vol: 0.1, freq: 900, type: 'bandpass' }); },
  siren()  { for (let i = 0; i < 3; i++) tone({ freq: 520, to: 980, type: 'sawtooth', dur: 0.55, vol: 0.09, when: i * 0.6 }); tone({ freq: 70, to: 40, dur: 0.8, vol: 0.5 }); },
  gavel()  { tone({ freq: 180, to: 60, dur: 0.18, vol: 0.55 }); noise({ dur: 0.1, vol: 0.4, freq: 1800 }); },
  curse()  { tone({ freq: 110, to: 55, type: 'sawtooth', dur: 1.2, vol: 0.12 }); tone({ freq: 117, to: 58, type: 'sawtooth', dur: 1.2, vol: 0.1 }); },
};
