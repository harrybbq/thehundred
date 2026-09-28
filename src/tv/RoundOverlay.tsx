// TV punishment flow: spotlight "[NAME] IS FACING THE WHEEL" → victim spins on their
// phone → wheel animates to the server-chosen landings (twice if cursed, chained on
// "spin again") → reveal → ~10s "any last words" window (Jester re-spin) → ACCEPT.
// A Medic heal plays SAVED. A forged heal plays SAVED, then a pen strikes it out,
// then the wheel spins anyway.
import { useEffect, useRef, useState } from 'react';
import type { GameState, Landing, Round } from '../lib/types';
import type { Act } from './TvRoom';
import { Wheel, type WheelHandle } from '../components/Wheel';
import { Polaroid } from '../components/ui';
import { Sound } from '../fx/sound';
import { burst, centerOf } from '../fx/effects';
import { sleep } from '../lib/util';

const WINDOW_MS = 10000;
const played = new Set<string>();        // spin sequences / saves already animated this session

export function RoundOverlay({ state, round, act, enqueue, now }: {
  state: GameState; round: Round; act: Act; enqueue: (fn: () => Promise<void> | void) => Promise<void>; now: () => number;
}) {
  const wheel = useRef<WheelHandle>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [card, setCard] = useState<null | { label: string; text: string; kind: string }>(null);
  const [animating, setAnimating] = useState(false);
  const [saved, setSaved] = useState(false);
  const [forge, setForge] = useState<0 | 1 | 2>(0);          // 1 = SAVED frame, 2 = struck out
  const victim = state.players.find(p => p.id === round.victim_id);
  const segments = round.wheel ?? state.room.wheel;

  // Spin sequence for each new spin_seq (queued behind any Jester animation)
  useEffect(() => {
    if (round.phase !== 'spinning') return;
    const key = `${round.id}:${round.spin_seq}`;
    if (played.has(key)) return;
    played.add(key);
    const t = setTimeout(() => enqueue(async () => {
      setAnimating(true); setCard(null);
      if (round.forged && !played.has('forge:' + round.id)) {
        played.add('forge:' + round.id);
        setForge(1); Sound.heal();
        await sleep(1900);
        setForge(2); Sound.scratch();
        await sleep(1300);
        Sound.thud();
        await sleep(1500);
        setForge(0);
      }
      await sleep(400);
      let lastSpin = 0;
      for (const l of round.landings) {
        if (l.spin > 1 && l.spin !== lastSpin) {
          setCard({ label: '☠ CURSED', text: 'SECOND SPIN', kind: 'curse' }); Sound.curse(); await sleep(1600); setCard(null);
        }
        lastSpin = l.spin;
        await wheel.current?.spinTo(l.idx);
        await sleep(350);
        setCard(landingCard(l)); Sound.clunk();
        const [x, y] = centerOf(stageRef.current);
        if (l.kind === 'safe') burst(x, y, { count: 60, speed: 14, colors: ['#a4ff5a', '#eaffd4'] });
        else burst(x, y, { count: 50, speed: 12, colors: ['#ff8a1e', '#ffe2b8', '#3a2a1a'] });
        await sleep(l.kind === 'normal' ? 2600 : 2000);
        setCard(null);
      }
      setAnimating(false);
      await act('round_revealed', { round_id: round.id, spin_seq: round.spin_seq }).catch(() => {});
    }), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round.id, round.spin_seq, round.phase]);

  // SAVED by the Medic
  useEffect(() => {
    if (round.phase !== 'saved' || played.has('saved:' + round.id)) { if (round.phase === 'saved') setSaved(true); return; }
    played.add('saved:' + round.id);
    enqueue(async () => {
      setSaved(true); Sound.heal();
      const [x, y] = centerOf(stageRef.current);
      burst(x, y, { count: 120, colors: ['#a4ff5a', '#eaffd4', '#ffffff'], shape: 'cross', size: 26, speed: 18 });
      await sleep(2600);
    });
  }, [round.id, round.phase, enqueue]);

  const revealedAt = round.revealed_at ? Date.parse(round.revealed_at) : null;
  const windowLeft = round.phase === 'revealed' && revealedAt ? Math.max(0, revealedAt + WINDOW_MS - now()) : 0;
  const punishments = round.landings.filter(l => l.kind === 'normal');
  const waiting = round.phase === 'waiting';
  const greenish = saved || forge === 1;
  const spinningNow = round.phase === 'spinning' && animating && !card && !forge;

  return (
    <div className={'overlay wheel-overlay' + (waiting ? ' waiting' : '') + (greenish ? ' saved' : '')}>
      {waiting && <><div className="spot" /><div className="lamp-shade" /></>}
      <div className="wheel-head">
        <div className="kicker">{waiting ? 'NOW' : 'PUNISHMENT FOR'}</div>
        <div className="wh-victim">
          {victim && <Polaroid url={victim.selfie_url} name={victim.name} clip />}
          <div>
            <div className="wh-name">{victim ? victim.name.toUpperCase() : '???'}{waiting && ' IS FACING THE WHEEL'}</div>
            <div className="wh-reason">{round.reason.toUpperCase()}{(round.cursed || victim?.cursed) && <span className="curse"> · CURSED: DOUBLE SPIN ☠</span>}</div>
          </div>
        </div>
      </div>

      <div className="wheel-wrap" ref={stageRef}>
        <Wheel ref={wheel} segments={segments} bulbs={saved ? 'off' : spinningNow ? 'chase' : 'on'}
          dim={!!card || greenish || forge > 0 || (round.phase === 'revealed' && !animating)} />
        {card && (
          <div className={'wheel-result ' + card.kind}>
            <div className="wr-label">{card.label}</div>
            <div className="wr-text" style={{ ['--wrs' as any]: card.text.length > 36 ? 0.068 : card.text.length > 22 ? 0.082 : card.text.length > 12 ? 0.1 : 0.13 }}>{card.text}</div>
          </div>
        )}
        {round.phase === 'revealed' && !animating && !card && (
          <div className="wheel-result summary">
            <div className="wr-label">{punishments.length ? (punishments.length > 1 ? 'PUNISHMENTS' : 'YOUR PUNISHMENT') : 'PHEW'}</div>
            {punishments.length ? punishments.map((l, i) => <div key={i} className="wr-text small">{l.text.toUpperCase()}{l.mult > 1 ? ` ×${l.mult}` : ''}</div>)
              : <div className="wr-text small">NOTHING TO DO</div>}
          </div>
        )}
        {(saved || forge > 0) && (
          <div className="wheel-result saved-card">
            <div className="saved-glow" />
            <div className="saved-stamp">SAVED!</div>
            <div className="saved-sub">SOMEBODY HAD YOUR BACK</div>
            {forge === 2 && <>
              <svg className="forge-line" viewBox="0 0 1000 1000" preserveAspectRatio="none">
                <path d="M130 420 C 300 380, 420 560, 560 470 S 800 380, 880 560" />
                <path d="M160 600 C 360 520, 600 640, 860 470" style={{ animationDelay: '.45s' }} />
              </svg>
              <div className="forged-stamp">FORGED</div>
            </>}
          </div>
        )}
      </div>

      <div className="wheel-actions">
        {waiting && <>
          <div className="wheel-hint">{(victim?.name ?? 'They').toUpperCase()}: hit <b>SPIN</b> on your phone</div>
          <button className="key" onClick={() => act('spin', { round_id: round.id }).catch(() => {})}>SPIN FOR THEM</button>
          <button className="key" onClick={() => act('cancel_round', { round_id: round.id, requeue: true }).catch(() => {})}>BACK TO QUEUE</button>
        </>}
        {round.phase === 'spinning' && !forge && <div className="clunk">CLUNK · CLUNK · CLUNK</div>}
        {forge > 0 && <div className="clunk">{forge === 1 ? 'A HEAL WAS WRITTEN…' : '…AND SOMEONE REWROTE IT'}</div>}
        {round.phase === 'revealed' && !animating && (windowLeft > 0
          ? <div className="last-words">Any last words… <b>{Math.ceil(windowLeft / 1000)}</b></div>
          : <button className="big-btn accept" onClick={() => act('accept', { round_id: round.id }).catch(() => {})}>ACCEPT<small>LOG IT</small></button>)}
        {round.phase === 'saved' && <button className="big-btn heal" onClick={() => act('finish_saved', { round_id: round.id }).catch(() => {})}>CONTINUE</button>}
      </div>
      {round.phase !== 'spinning' && !animating && (
        <button className="key close-x" title="Cancel this punishment" onClick={() => act('cancel_round', { round_id: round.id }).catch(() => {})}>✕</button>
      )}
    </div>
  );
}

function landingCard(l: Landing) {
  if (l.kind === 'safe') return { label: 'PHEW', text: l.text.toUpperCase(), kind: 'safe' };
  if (l.kind === 'again') return { label: 'UH OH…', text: `SPIN AGAIN ×${l.mult * 2}`, kind: 'again' };
  return { label: l.graffiti ? 'JESTER GRAFFITI' : l.mult > 1 ? `×${l.mult} PUNISHMENT` : 'YOUR PUNISHMENT', text: (l.mult > 1 ? `${l.text} ×${l.mult}` : l.text).toUpperCase(), kind: 'normal' };
}
