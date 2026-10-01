// Spoken lines on the TV via the browser's speechSynthesis (no files). Used to call players to the TV by name,
// because a phone buzz doesn't reach a phone locked in a pocket. Obeys the TV's sound switch; a no-op without speech.
import { soundEnabled } from './sound';

const synth = (): SpeechSynthesis | null =>
  typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;

let voice: SpeechSynthesisVoice | null = null;
let picked = false;

// deep, dramatic voices by name where the platform has them; otherwise any en-GB, then any English voice
const DEEP = /daniel|george|arthur|oliver|ryan|thomas|\bmale\b|david|guy|fred|alex/i;
function pickVoice() {
  const s = synth(); if (!s) return;
  const vs = s.getVoices(); if (!vs.length) return;
  const en = vs.filter(v => /^en/i.test(v.lang));
  const gb = en.filter(v => /en[-_]gb/i.test(v.lang));
  voice = gb.find(v => DEEP.test(v.name)) ?? gb[0] ?? en.find(v => DEEP.test(v.name)) ?? en[0] ?? null;
  picked = true;
}
(() => {
  const s = synth(); if (!s) return;
  try { pickVoice(); s.addEventListener?.('voiceschanged', pickVoice); } catch { /* ignore */ }
})();

// held here so Chrome can't garbage-collect a playing utterance (which would swallow its `end` event)
let current: SpeechSynthesisUtterance | null = null;

function utter(text: string) {
  if (!picked) pickVoice();
  const u = new SpeechSynthesisUtterance(text);
  if (voice) { u.voice = voice; u.lang = voice.lang; } else u.lang = 'en-GB';
  u.rate = 0.9; u.pitch = 0.8; u.volume = 1;
  return u;
}

/** Say a line, cutting off anything still being said. */
export function speak(text: string) {
  const s = synth(); if (!s || !soundEnabled() || !text.trim()) return;
  try { s.cancel(); current = utter(text); s.speak(current); } catch { /* ignore */ }
}

/** Say a line and resolve when it has finished (or failed, or been cut off). Never hangs: a cap based on
 *  the length of the line resolves it anyway, because some browsers drop the `end` event. */
export function say(text: string): Promise<void> {
  const s = synth(); if (!s || !soundEnabled() || !text.trim()) return Promise.resolve();
  return new Promise<void>(resolve => {
    let done = false;
    const finish = () => { if (done) return; done = true; clearTimeout(cap); resolve(); };
    const cap = setTimeout(finish, Math.max(2500, text.length * 130));
    try {
      s.cancel();
      const u = utter(text);
      u.onend = finish; u.onerror = finish;
      current = u; s.speak(u);
    } catch { finish(); }
  });
}

export function stopSpeaking() {
  try { synth()?.cancel(); } catch { /* ignore */ }
  current = null;
}
