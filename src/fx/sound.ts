// Web Audio sound effects (no files): everything is synthesised. All sound runs through one master bus with a
// compressor, so a scene can stack effects without clipping the TV's speakers.
// Scenes time their sounds to their animation beats with cues([[ms, fn], ...]) (cancelled on unmount).
let ctx: AudioContext | null = null;
let bus: AudioNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let enabled = (() => { try { return localStorage.getItem('th-sound') !== 'off'; } catch { return true; } })();

export const soundEnabled = () => enabled;
export function setSoundEnabled(v: boolean) { enabled = v; try { localStorage.setItem('th-sound', v ? 'on' : 'off'); } catch { /* ignore */ } }

function ac() {
  if (!enabled) return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext; if (!AC) return null;
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor(), master = ctx.createGain();
      comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 6; comp.attack.value = .003; comp.release.value = .25;
      master.gain.value = .9;
      comp.connect(master).connect(ctx.destination);
      bus = comp;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch { return null; }
}
const out = (c: AudioContext) => bus ?? c.destination;
/** The shared AudioContext (null when sound is off), for scenes that synthesise their own effects. */
export const audioCtx = () => ac();
/** Where scenes that build their own graphs should connect (the master bus). */
export const audioOut = () => { const c = ac(); return c ? out(c) : null; };

function tone({ freq = 440, to = 0, type = 'sine' as OscillatorType, dur = 0.15, vol = 0.2, when = 0, attack = 0.005, vib = 0, vibRate = 6 }) {
  const c = ac(); if (!c) return;
  const t = c.currentTime + when, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  if (vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = vibRate; lg.gain.value = vib; l.connect(lg).connect(o.frequency); l.start(t); l.stop(t + dur + .05); }
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out(c)); o.start(t); o.stop(t + dur + 0.05);
}
function noise({ dur = 0.2, vol = 0.2, when = 0, freq = 1200, to = 0, type = 'lowpass' as BiquadFilterType, q = 1, attack = 0 }) {
  const c = ac(); if (!c) return;
  if (!noiseBuf) { noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const t = c.currentTime + when, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = noiseBuf; s.loop = true; f.type = type; f.Q.value = q; f.frequency.setValueAtTime(freq, t);
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  if (attack) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); } else g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(out(c)); s.start(t, Math.random()); s.stop(t + dur + 0.05);
}
/** a sawtooth through a filter that opens and closes: a muted brass "wah" */
function wah({ freq = 233, to = 0, dur = .6, vol = .16, when = 0, vib = 0 }) {
  const c = ac(); if (!c) return;
  const t = c.currentTime + when, o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
  o.type = 'sawtooth'; o.frequency.setValueAtTime(freq, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  if (vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 5.5; lg.gain.value = vib; l.connect(lg).connect(o.frequency); l.start(t + dur * .35); l.stop(t + dur + .05); }
  f.type = 'lowpass'; f.Q.value = 6;
  f.frequency.setValueAtTime(350, t); f.frequency.exponentialRampToValueAtTime(1500, t + dur * .25); f.frequency.exponentialRampToValueAtTime(420, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .04); g.gain.setValueAtTime(vol, t + dur * .75); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(f).connect(g).connect(out(c)); o.start(t); o.stop(t + dur + .05);
}
const notes = (list: [number, number, number?][], o: { type?: OscillatorType; vol: number; dur: number }) =>
  list.forEach(([f, w, d]) => tone({ ...o, freq: f, when: w, dur: d ?? o.dur }));
/** a struck metal: a few inharmonic partials ringing down */
const metal = (base: number, dur: number, vol: number, when = 0) =>
  [1, 1.52, 2.46, 3.9].forEach((k, i) => tone({ freq: base * k, dur: dur / (1 + i * .6), vol: vol / (1 + i), when, attack: .002 }));

/** Schedule sounds at ms offsets (e.g. an animation's beats). Returns a cancel function for cleanup. */
export function cues(list: [number, () => void][]) {
  const T = list.map(([ms, f]) => window.setTimeout(f, ms));
  return () => T.forEach(clearTimeout);
}

export const Sound = {
  unlock: () => { ac(); },
  // ---------------------------------------------------------------- the originals
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

  // ---------------------------------------------------------------- movement
  /** air moving: a filtered noise swell (up = rising pitch) */
  whoosh(dur = .35, up = true, vol = .22) { noise({ dur, vol, freq: up ? 400 : 2600, to: up ? 2600 : 400, type: 'bandpass', q: 1.2, attack: dur * .45 }); },
  /** something heavy sliding on a steel rail, ending on a detent click */
  slide()  { noise({ dur: .5, vol: .2, freq: 300, to: 1100, type: 'bandpass', q: 1.5, attack: .15 }); noise({ dur: .45, vol: .06, freq: 3200, type: 'bandpass', q: 6, attack: .1 }); tone({ freq: 2100, type: 'square', dur: .02, vol: .07, when: .47 }); tone({ freq: 160, to: 90, dur: .1, vol: .25, when: .47 }); },
  /** a thing falling from high up: a descending whistle */
  fall(dur = .7) { tone({ freq: 2400, to: 500, dur, vol: .06, attack: .05 }); },

  // ---------------------------------------------------------------- impacts
  /** the Bomb: sub thump, a long rumble, debris crackle */
  boom()   {
    tone({ freq: 90, to: 28, dur: 1.1, vol: .8, attack: .003 });
    noise({ dur: 1.6, vol: .7, freq: 1200, to: 120, type: 'lowpass', q: .7 });
    noise({ dur: .25, vol: .5, freq: 3500, type: 'highpass' });
    for (let i = 0; i < 14; i++) noise({ dur: .03 + Math.random() * .04, vol: .08 + Math.random() * .1, freq: 2000 + Math.random() * 4000, type: 'bandpass', q: 3, when: .12 + Math.random() * .9 });
  },
  /** a burning fuse fizz (the last beat before the boom; never tied to the real fuse) */
  fizz(dur = .33) { noise({ dur, vol: .12, freq: 5000, to: 8000, type: 'highpass', attack: .05 }); },
  /** a plastic traffic cone landing: a hollow bonk */
  cone()   { tone({ freq: 420, to: 290, type: 'triangle', dur: .16, vol: .3 }); noise({ dur: .06, vol: .2, freq: 1500, type: 'bandpass', q: 2 }); tone({ freq: 380, to: 330, type: 'triangle', dur: .1, vol: .12, when: .12 }); },
  /** a rubber stamp slamming down on paper */
  stamp()  { tone({ freq: 150, to: 60, dur: .14, vol: .5 }); noise({ dur: .09, vol: .35, freq: 900, type: 'bandpass', q: .8 }); },
  /** a paper poster slapped onto a wall */
  slap()   { noise({ dur: .1, vol: .45, freq: 1300, type: 'bandpass', q: .7 }); tone({ freq: 110, to: 60, dur: .1, vol: .3 }); },
  /** a soft landing (a hat, a chain) */
  plop()   { tone({ freq: 220, to: 120, dur: .12, vol: .3 }); noise({ dur: .05, vol: .12, freq: 700 }); },
  /** a shuriken biting in: a wooden thunk and a ting */
  stab()   { tone({ freq: 190, to: 75, dur: .16, vol: .55 }); noise({ dur: .06, vol: .35, freq: 1600, type: 'bandpass' }); metal(2600, .35, .06, .01); },
  /** a shuriken glancing off brick: ricochet */
  ricochet() { tone({ freq: 3200, to: 1500, dur: .3, vol: .08, vib: 60, vibRate: 30 }); noise({ dur: .08, vol: .25, freq: 4500, type: 'highpass' }); },
  /** someone going overboard: a big splash and bubbles */
  splash() { noise({ dur: 1.3, vol: .55, freq: 2400, to: 300, type: 'lowpass' }); noise({ dur: .3, vol: .3, freq: 5000, type: 'highpass' }); for (let i = 0; i < 7; i++) tone({ freq: 350 + Math.random() * 500, to: 700 + Math.random() * 600, dur: .07, vol: .06, when: .35 + i * .11 + Math.random() * .05 }); },

  // ---------------------------------------------------------------- machinery
  /** the LED marquee buzzing on */
  ledOn()  { tone({ freq: 120, type: 'sawtooth', dur: .22, vol: .05 }); tone({ freq: 240, type: 'square', dur: .06, vol: .03, when: .1 }); noise({ dur: .03, vol: .08, freq: 5000, type: 'highpass', when: .09 }); },
  /** a small brass click (counters ticking up, stations lighting) */
  countTick() { tone({ freq: 1250, type: 'triangle', dur: .035, vol: .12 }); noise({ dur: .02, vol: .08, freq: 3000, type: 'highpass' }); },
  /** a bell: the count lands */
  ding()   { metal(1320, 1.4, .14); },
  /** a crank ratchet: n turns of `clicks` clicks, each turn lasting `turn` seconds */
  ratchet(n = 1, turn = .56, clicks = 8) { for (let k = 0; k < n * clicks; k++) { const w = k * turn / clicks; tone({ freq: 2300, type: 'square', dur: .012, vol: .07, when: w }); noise({ dur: .015, vol: .09, freq: 3500, type: 'highpass', when: w }); } },
  /** a wheel knocked into a spin: clicks that slow down over dur */
  wheelSpin(dur = 1.5, clicks = 18) { for (let i = 0; i < clicks; i++) { const k = i / clicks, w = dur * (1 - Math.pow(1 - k, 2)); tone({ freq: 1900, type: 'square', dur: .012, vol: .06, when: w }); } },
  /** a jack-in-the-box: the spring boing, then a clown horn */
  boing()  { tone({ freq: 160, to: 760, dur: .35, vol: .3, vib: 70, vibRate: 22 }); notes([[330, .32, .22], [415, .32, .22]], { type: 'square', vol: .09, dur: .22 }); notes([[330, .58, .3], [415, .58, .3]], { type: 'square', vol: .09, dur: .3 }); },
  /** coins: clinks bouncing into a tray, then a ringing wobble */
  coinDrop() { [0, .16, .28, .36, .41].forEach((w, i) => metal(2400 - i * 60, .25, .12 / (1 + i * .4), w)); tone({ freq: 1800, dur: .9, vol: .05, when: .45, vib: 30, vibRate: 12 }); },
  /** a heavy coin slammed flat: a clang */
  clang()  { metal(880, 1.3, .22); tone({ freq: 120, to: 50, dur: .25, vol: .5 }); noise({ dur: .12, vol: .3, freq: 2200, type: 'bandpass' }); },
  /** a dot-matrix ticket printer chattering for dur */
  printer(dur = .6) { for (let w = 0; w < dur; w += .028) { tone({ freq: 900 + Math.random() * 300, type: 'square', dur: .012, vol: .04, when: w }); } noise({ dur, vol: .05, freq: 1800, type: 'bandpass', q: 4 }); },
  /** a camera flash: shutter click, a second click, the flash whine */
  shutter() { noise({ dur: .025, vol: .35, freq: 6000, type: 'highpass' }); noise({ dur: .03, vol: .25, freq: 3000, type: 'bandpass', when: .07 }); tone({ freq: 3200, to: 6500, dur: .35, vol: .03, when: .02 }); },
  /** a marker squeaking across a board */
  marker(dur = .12) { noise({ dur, vol: .07, freq: 3200 + Math.random() * 1200, type: 'bandpass', q: 9, attack: .02 }); },
  /** "tee-hee!": a snide little giggle */
  giggle() { [988, 880, 988, 784, 880, 698].forEach((f, i) => tone({ freq: f, type: 'square', dur: .05, vol: .06, when: i * .075 + (i > 2 ? .08 : 0) })); },
  /** one sad trombone note (i = 0, 1, 2: WAH… WAH… WAHHHH…) */
  trombone(i = 0) { const f = [233, 220, 208][i] ?? 208; wah({ freq: f, to: i === 2 ? f * .94 : 0, dur: i === 2 ? 1.3 : .5, vol: .15, vib: i === 2 ? 9 : 0 }); },

  // ---------------------------------------------------------------- the phone (your own action or your own danger only)
  /** the bomb lands on YOUR phone */
  bombHere() { for (let i = 0; i < 3; i++) tone({ freq: 1180, type: 'square', dur: .09, vol: .1, when: i * .16 }); tone({ freq: 70, to: 40, dur: .3, vol: .4 }); },
  /** a lever thrown: a heavy clunk with a ratchet catch */
  lever()  { Sound.clunk(); tone({ freq: 2100, type: 'square', dur: .015, vol: .06, when: .12 }); },
  /** DONE */
  chime()  { tone({ freq: 880, dur: .25, vol: .12 }); tone({ freq: 1320, dur: .5, vol: .12, when: .1 }); },
};
