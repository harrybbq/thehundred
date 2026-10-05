// THE CAPS SHOP on the TV. Public facts only:
//   soundboard  someone paid 5 caps for a sting: it plays here, with a small chip ("THE SOUNDBOARD · PULEASE").
//               Anonymous: the chip never names anyone. It never waits behind a scene (it's a toast, not a scene),
//               and a spoken line never cuts off a name summons (it falls back to a synth sting instead).
//   bribe       the one at the wheel paid off their own spin (TvRoom shows a banner; the re-spin itself is the
//               RoundOverlay reacting to spin_seq, as for the Scrooge's re-spin, without the Scrooge's scene).
// Graffiti and the golden ticket need nothing here: graffiti is announced from state.graffiti like the Scrooge's, and
// the ticket shows only when it saves you (the round's SAVED phase).
// Motion is transform/opacity only; prefers-reduced-motion gets a plain show/hide (src/styles/bookie.css).
import type { ShopSound } from '../lib/types';
import { Sound, soundEnabled } from '../fx/sound';
import { isSpeaking, speak } from '../fx/speak';

export const SOUND_MS = 3800;

/** The six stings: what the chip says, and the line the TV's voice says (null = a synth sound). */
export const STINGS: Record<ShopSound, { label: string; line: string | null }> = {
  pulease: { label: 'PULEASE', line: 'Puh-leease!' },
  relax: { label: 'RELAX', line: 'Relax.' },
  one_maybe_two: { label: 'ONE MAYBE TWO', line: 'One. Maybe two.' },
  airhorn: { label: 'AIRHORN', line: null },
  trombone: { label: 'SAD TROMBONE', line: null },
  drumroll: { label: 'DRUMROLL', line: null },
};
export const isSting = (x: unknown): x is ShopSound => typeof x === 'string' && x in STINGS;

/** Play one sting through the TV's sound (obeys the TV's sound switch). */
export function playSting(sound: ShopSound) {
  if (!soundEnabled()) return;
  const st = STINGS[sound];
  if (st.line) {
    // a summons is being read out: never cut a player's name off; a little bell instead
    if (isSpeaking() || typeof window === 'undefined' || !('speechSynthesis' in window)) { Sound.ding(); return; }
    Sound.chime();
    setTimeout(() => speak(st.line!), 260);
    return;
  }
  if (sound === 'airhorn') Sound.airhorn();
  else if (sound === 'trombone') Sound.sadTrombone();
  else Sound.drumrollCrash();
}

/** The chip in the corner: THE SOUNDBOARD · PULEASE (no name: it's anonymous). */
export function SoundChip({ sound }: { sound: ShopSound }) {
  return (
    <div className="sb-chip" role="status" aria-label={`The soundboard: ${STINGS[sound].label}`}>
      <svg className="sb-ic" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 9.5h4l5-4v13l-5-4H4z" />
        <path className="w1" d="M16 9a4 4 0 0 1 0 6" />
        <path className="w2" d="M18.5 6.5a7.5 7.5 0 0 1 0 11" />
      </svg>
      <div><small>THE SOUNDBOARD</small><b>{STINGS[sound].label}</b></div>
    </div>
  );
}
