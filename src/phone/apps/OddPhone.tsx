// ODD ONE OUT on the phone (the Odd One Out canvas). One decision per screen:
//   intro    what the game is; I'M IN
//   card     YOUR CARD: hold to read (the famous person, or that you're the odd one out), then I'VE READ IT
//   clues    YOUR TURN (say up to 3 words, DONE) or who's talking and when you're up; your card on a hold bar
//   vote     who's the odd one out? tap them, then the Check screen; then wait
//   caught   the odd one out: ONE GUESS, out loud. Everyone else: who it was
//   answer   the name; the host decides on the TV
//   pick     the odd one out named it: who takes it (then the Check screen)
//   result   your part in the round: wrongly accused, guessed wrong, picked, got away with it, or safe
//   final    whether you go in the queue
// The card is only ever on screen while a finger is on it, and the folder looks the same on every phone (the odd one
// out's too) until it's held.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { OddGame, Player } from '../../lib/types';
import type { AppPhoneProps } from './AppGamePhone';
import { Check, Facts, Key, Photo, PlayerRow, buzz } from '../kit';
import { secsTo } from '../../tv/apps/kit';
import { andList, fitPx } from '../../tv/apps/OddTV';
import { errText } from '../../lib/backend';
import { toast } from '../../fx/effects';
import { Sound } from '../../fx/sound';
import '../../styles/odd.css';

const ordinal = (n: number) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'));
const TIMES = ['', 'once', 'twice', 'three times', 'four times'];

// ---------- hold to read: the Detective's press-and-hold (PhoneHome HoldToRead), for a card that never burns ----------
// Nothing shows until the finger has stayed down for ARM_MS (a tap or a wobble does nothing), the finger is captured
// (sliding off doesn't let go), and the card hides the moment it lets go.
const ARM_MS = 450;
function useHold() {
  const [phase, setPhase] = useState<'idle' | 'arming' | 'open'>('idle');
  const [arm, setArm] = useState(0);
  const [seen, setSeen] = useState(false);
  const since = useRef(0), raf = useRef(0), ph = useRef(phase);
  ph.current = phase;
  const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  const loop = () => {
    if (ph.current !== 'arming') return;
    const k = Math.min(1, (performance.now() - since.current) / ARM_MS);
    setArm(k);
    if (k >= 1) { ph.current = 'open'; setPhase('open'); setSeen(true); buzz(40); return; }
    raf.current = requestAnimationFrame(loop);
  };
  const down = (e: React.PointerEvent) => {
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ignore */ }
    cancelAnimationFrame(raf.current);
    since.current = performance.now(); ph.current = 'arming'; setPhase('arming'); setArm(0);
    raf.current = requestAnimationFrame(loop);
  };
  const up = () => { cancelAnimationFrame(raf.current); ph.current = 'idle'; setPhase('idle'); setArm(0); };
  return {
    open: phase === 'open', arming: phase === 'arming', arm: still ? 0 : arm, seen,
    bind: { onPointerDown: down, onPointerUp: up, onPointerCancel: up, onContextMenu: (e: React.MouseEvent) => e.preventDefault() },
  };
}

const Print = ({ size, w = 2.2 }: { size: number; w?: number }) => (
  <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
    {['M10 30c-1-2.5-1.5-5-1.5-7.5C8.5 14 15.4 7 24 7s15.5 7 15.5 15.5c0 3-.4 5.7-1.2 8',
      'M15 36c-1.6-3.6-2.5-8-2.5-13.5C12.5 16.3 17.7 11 24 11s11.5 5.3 11.5 11.5c0 4.3-.6 8.6-1.8 12.5',
      'M20 40c-2-4.5-3.5-10.5-3.5-17.5 0-4.1 3.4-7.5 7.5-7.5s7.5 3.4 7.5 7.5c0 6-.9 11.7-2.6 16.8',
      'M24 22.5c0 7 1 12.6 3 18'].map(d => <path key={d} d={d} fill="none" stroke="#3a2a14" strokeWidth={w} strokeLinecap="round" />)}
  </svg>
);

type Card = OddGame['mine'];
/** The folder: HOLD TO READ on every phone; the card inside only while it's held. */
function Fold({ card, hold }: { card: Card; hold: ReturnType<typeof useHold> }) {
  const odd = !!card?.odd;
  const famous = (card?.famous ?? '').toUpperCase();
  return (
    <button type="button" className={'oo-fold' + (hold.open || hold.arming ? ' oo-down' : '')} {...hold.bind}
      aria-label={hold.open ? 'Your card, open while you hold it' : 'Hold to read your card'}>
      <div className="oo-fold-tab"><span>CLASSIFIED</span></div>
      {hold.arming && hold.arm > 0 && <i className="oo-arm" style={{ transform: `scaleX(${hold.arm})` }} />}
      {hold.open && card ? (
        <div className="oo-slip">
          <div className="oo-slip-k">YOUR FAMOUS PERSON</div>
          {odd
            ? <div className="oo-slip-v oo-odd">YOU'RE THE ODD ONE OUT</div>
            : <div className="oo-slip-v" style={{ fontSize: fitPx(famous, 270, 74, 3) }}>{famous}</div>}
          <div className="oo-slip-rl" />
          <div className="oo-slip-tx">{odd
            ? 'Everyone else has the same famous person. Listen, blend in, and work out who it is.'
            : "When it's your turn, say up to 3 words about them."}</div>
          <div className="oo-slip-hold"><i />LET GO TO HIDE IT</div>
        </div>
      ) : (
        <div className="oo-fold-face">
          <Print size={132} />
          <div className="oo-fold-t">{hold.arming ? 'KEEP HOLDING' : 'HOLD TO READ'}</div>
          <div className="oo-fold-s">{hold.arming ? 'Shield your screen.' : 'Keep your finger on it.'}</div>
        </div>
      )}
    </button>
  );
}

/** HOLD TO SEE YOUR CARD: the card again, small, while the finger is on it. */
function HoldBar({ card }: { card: Card }) {
  const hold = useHold();
  const famous = (card?.famous ?? '').toUpperCase();
  return (
    <button type="button" className={'oo-holdbar' + (hold.open || hold.arming ? ' oo-down' : '')} {...hold.bind}
      aria-label={hold.open ? 'Your card, open while you hold it' : 'Hold to see your card'}>
      {hold.arming && hold.arm > 0 && <i className="oo-arm" style={{ transform: `scaleX(${hold.arm})` }} />}
      <Print size={36} w={3} />
      {hold.open && card
        ? <span className="oo-hb-card"><small>YOUR FAMOUS PERSON</small>
            {card.odd ? <b className="oo-odd">YOU'RE THE ODD ONE OUT</b> : <b style={{ fontSize: fitPx(famous, 250, 40, 2) }}>{famous}</b>}</span>
        : <span>{hold.arming ? 'KEEP HOLDING…' : 'HOLD TO SEE YOUR CARD'}</span>}
    </button>
  );
}

/** A polaroid of someone, for the phone (their selfie, or initials). */
const Face = ({ p, sm }: { p?: Player; sm?: boolean }) => (
  <div className={'oo-face' + (sm ? ' oo-sm' : '')}><Photo p={p} /><div className="oo-face-cap">{p?.name ?? '?'}</div></div>
);
const Stamp = ({ children, tone = '' }: { children: ReactNode; tone?: '' | 'oo-bone' | 'oo-green' | 'oo-gold' }) => (
  <div className="oo-ph-stamp"><div className={'oo-stamp oo-slam ' + tone}>{children}</div></div>
);
const PhTimer = ({ secs, of }: { secs: number; of: number }) => (
  <div className="oo-ph-timer">
    <div className={'oo-ph-bar' + (secs <= 5 ? ' oo-low' : '')}><i style={{ transform: `scaleX(${Math.max(0, Math.min(1, secs / of))})` }} /></div>
    <div className="oo-ph-secs">{secs}</div>
  </div>
);

export function OddPhone({ s, g, me, now, bar, move }: AppPhoneProps<OddGame>) {
  const secs = secsTo(g.until, now);
  const byId = (id?: string | null) => (id ? s.players.find(p => p.id === id) : undefined);
  const nm = (id?: string | null) => byId(id)?.name ?? '?';
  const NM = (id?: string | null) => nm(id).toUpperCase();
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState<string | null>(null);                 // vote / pick: who's on the Check screen
  useEffect(() => { setSel(null); setBusy(false); }, [g.phase, g.n]);
  const send = (args: Record<string, unknown>, then?: () => void) => {
    setBusy(true);
    return move(args).then(() => { then?.(); }).catch(e => toast(errText(e), 3000)).finally(() => setBusy(false));
  };

  const card = g.mine;
  const L = g.last;
  const amOdd = !!card?.odd || (!!L && L.odd === me.id);
  const myTurn = g.phase === 'clues' && g.order[g.turn] === me.id;
  const voted = g.voted.includes(me.id) || !!card?.vote;

  // buzz when it's you: your turn to speak, the vote, caught, your pick
  const cue = g.phase === 'clues' ? (myTurn ? `turn:${g.n}:${g.turn}` : '')
    : g.phase === 'vote' && !voted ? `vote:${g.n}`
    : g.phase === 'caught' && amOdd ? `caught:${g.n}`
    : g.phase === 'pick' && amOdd ? `pick:${g.n}` : '';
  useEffect(() => { if (cue) { buzz(cue.startsWith('caught') ? [300, 120, 300] : [200, 80, 200]); Sound.beep(); } }, [cue]);
  // the round's end, on your phone: a sting for you
  const lost = g.phase === 'result' && !!L?.losers?.includes(me.id);
  const lastPhase = useRef(g.phase);
  useEffect(() => {
    if (lastPhase.current !== 'result' && g.phase === 'result' && L) {
      if (lost) { buzz(300); Sound.down(); } else Sound.win();
    }
    lastPhase.current = g.phase;
  }, [g.phase]);

  const sub = g.n > 0 ? `ROUND ${g.n} OF ${g.of}` : 'ODD ONE OUT';
  const shell = (body: ReactNode, cls = '') => <div className={'pu-app ag-phone oo-phone ' + cls}>{bar(sub)}{body}</div>;
  const tv = (b: ReactNode, small: ReactNode, hot = false) => <div className={'oo-ph-note' + (hot ? ' oo-hot' : '')}><b>{b}</b>{small}</div>;

  // ---------------- intro ----------------
  if (g.phase === 'intro') {
    const here = g.here.includes(me.id);
    return shell(<>
      <div className="pu-kick pu-c-sodium" style={{ marginTop: 8 }}>ODD ONE OUT · {g.of} ROUNDS</div>
      <div className="pu-hero">SAME NAME.<br />EXCEPT ONE.</div>
      <div className="pu-body pu-c-bone2">Every phone gets the same famous person, except the odd one out's. Say up to 3 words each, out loud. Then vote out the odd one out.</div>
      <Facts facts={[{ icon: 'tv', text: 'Look at the TV', small: here ? `The first round starts in ${secs}s, or when everyone is in` : 'The rules are up there' },
                     { icon: 'tap', text: here ? "You're in" : "Tap I'M IN when you're ready", hot: !here }]} />
      <div className="pu-keys">
        <Key lg disabled={here || busy} icon={here ? 'check' : undefined} onClick={() => send({ op: 'here' })}>{here ? "YOU'RE IN" : "I'M IN"}</Key>
      </div>
    </>);
  }

  // ---------------- card: hold to read ----------------
  if (g.phase === 'card') return shell(<CardScreen key={g.n} card={card} read={g.read.includes(me.id)} left={g.players.length - g.read.length} busy={busy}
    onRead={() => send({ op: 'read' })} />);

  // ---------------- clues ----------------
  if (g.phase === 'clues') {
    if (myTurn) {
      return shell(<>
        <div className="pu-kick">THE CLUES</div>
        <div className="oo-turn-hero">YOUR TURN</div>
        <div className="oo-ph-say">Say up to 3 words about your famous person. Out loud, so the room hears.</div>
        <PhTimer secs={secs} of={20} />
        <div className="pu-keys" style={{ gap: 16 }}>
          <HoldBar card={card} />
          <Key lg disabled={busy} onClick={() => send({ op: 'done', turn: g.turn })}>DONE</Key>
        </div>
      </>, 'oo-turn');
    }
    const cur = g.order[g.turn];
    const mine = g.order.indexOf(me.id);
    const line = mine < g.turn ? "You've said yours. Listen for the odd one out."
      : mine === g.turn + 1 ? "You're next. Get your 3 words ready."
      : `Listen. You're ${ordinal(mine + 1)}, after ${nm(g.order[mine - 1])}.`;
    return shell(<>
      <div className="pu-kick">THE CLUES</div>
      <Face p={byId(cur)} />
      <div className="oo-ph-big" style={{ marginTop: 14, fontSize: Math.min(60, fitPx(`${NM(cur)} IS TALKING`, 340, 60, 2)) }}>{NM(cur)} IS TALKING</div>
      <div className="oo-ph-say oo-dim pu-center">{line}</div>
      <div className="pu-keys"><HoldBar card={card} /></div>
    </>);
  }

  // ---------------- vote ----------------
  if (g.phase === 'vote') {
    const who = g.players.filter(id => id !== me.id).map(byId).filter((p): p is Player => !!p);
    if (sel && !voted) {
      const p = byId(sel);
      return shell(<Check face={p} question={`VOTE ${NM(sel)}?`} cost="You think they're the odd one out. You can't change it after."
        yes="YES, VOTE" busy={busy} onNo={() => setSel(null)} onYes={() => send({ op: 'vote', player_id: sel }, () => buzz(60))} />);
    }
    if (voted) {
      const left = g.players.length - g.voted.length;
      return shell(<>
        <div className="pu-kick">THE VOTE</div>
        <Stamp tone="oo-green">VOTE IN</Stamp>
        <div className="pu-hero pu-center" style={{ marginTop: 24 }}>NOW WAIT</div>
        <div className="pu-body pu-center pu-c-bone2">{left > 0 ? `Waiting for ${left} more. The vote closes when everyone's in.` : 'Everyone is in.'}</div>
        {tv('Look at the TV.', 'If the odd one out is caught, they get one guess at the name.')}
      </>);
    }
    return shell(<>
      <div className="pu-kick">THE VOTE</div>
      <div className="pu-display" style={{ fontSize: 52, lineHeight: .9 }}>WHO'S THE ODD ONE OUT?</div>
      <div className="pu-small">Tap who you think it is. You'll check it on the next screen.</div>
      <div className="pu-grid2 pu-picker">{who.map(p => <PlayerRow key={p.id} p={p} onPick={() => { buzz(20); setSel(p.id); }} />)}</div>
    </>);
  }

  // ---------------- caught ----------------
  if (g.phase === 'caught' && L) {
    if (amOdd) {
      return shell(<>
        <div className="pu-kick">THE VOTE IS IN</div>
        <Stamp>CAUGHT</Stamp>
        <div className="oo-ph-big" style={{ marginTop: 30, fontSize: 84 }}>ONE GUESS</div>
        <div className="oo-ph-say pu-center">Say the famous person's name out loud. The host checks it on the TV.</div>
        {tv('Right: you pick who takes the punishment.', 'Wrong: it\'s yours.', true)}
      </>, 'pu-red');
    }
    return shell(<>
      <div className="pu-kick">THE VOTE IS IN</div>
      <Face p={byId(L.odd)} sm />
      <div className="pu-center" style={{ marginTop: -38, position: 'relative', zIndex: 2 }}><Stamp>CAUGHT</Stamp></div>
      <div className="oo-ph-big" style={{ marginTop: 12, fontSize: Math.min(56, fitPx(`${NM(L.odd)} WAS THE ODD ONE OUT`, 340, 56, 3)) }}>{NM(L.odd)} WAS THE ODD ONE OUT</div>
      <div className="oo-ph-say oo-dim pu-center">They get one guess at the name, out loud.</div>
      {tv('Look at the TV.', `Right: ${nm(L.odd)} picks who takes the punishment. It could be you.`)}
    </>);
  }

  // ---------------- answer: the host judges ----------------
  if (g.phase === 'answer' && L) {
    const famous = (L.famous ?? '').toUpperCase();
    return shell(<>
      <div className="pu-kick">THE NAME</div>
      <div className="oo-ph-file" style={{ marginTop: 12 }}>
        <div className="oo-ph-file-k">THE FAMOUS PERSON WAS</div>
        <div className="oo-ph-file-v" style={{ fontSize: fitPx(famous, 310, 64, 3) }}>{famous}</div>
      </div>
      <div className="oo-ph-big" style={{ marginTop: 26, fontSize: 48 }}>{amOdd ? 'DID YOU SAY IT?' : `DID ${NM(L.odd)} SAY IT?`}</div>
      <div className="oo-ph-say oo-dim pu-center">The host decides, on the TV.</div>
      {tv('Look at the TV.', amOdd ? 'Got it: you pick who takes it. Wrong: it\'s yours.' : `Got it: ${nm(L.odd)} picks who takes it.`)}
    </>, amOdd ? 'pu-red' : '');
  }

  // ---------------- pick: the odd one out named it ----------------
  if (g.phase === 'pick' && L) {
    if (amOdd) {
      const who = g.players.map(byId).filter((p): p is Player => !!p && p.id !== me.id && p.public_role !== 'angel' && !p.locked_until);
      if (sel) {
        return shell(<Check face={byId(sel)} question={`${NM(sel)} TAKES IT?`} cost="They lose this round instead of you. You can't change it after."
          yes="YES, THEM" busy={busy} onNo={() => setSel(null)} onYes={() => send({ op: 'pick', player_id: sel }, () => buzz(60))} />);
      }
      return shell(<>
        <div className="ag-ph-row"><div className="pu-kick">YOU NAMED IT</div><div className="oo-ph-secs" style={{ fontSize: 30 }}>0:{String(secs).padStart(2, '0')}</div></div>
        <div className="oo-ph-big oo-green" style={{ fontSize: 56, textAlign: 'left' }}>YOU GOT AWAY WITH IT</div>
        <div className="pu-small" style={{ color: 'var(--bone)' }}>Pick who takes the punishment instead. You'll check it on the next screen.</div>
        <div className="pu-grid2 pu-picker">{who.map(p => <PlayerRow key={p.id} p={p} onPick={() => { buzz(20); setSel(p.id); }} />)}</div>
        <div className="oo-ph-fine">Not the Angel, and nobody in the Locker. Out of time: it's picked at random.</div>
      </>, 'oo-named');
    }
    return shell(<>
      <div className="pu-kick">THE NAME</div>
      <Face p={byId(L.odd)} sm />
      <div className="oo-ph-big oo-green" style={{ marginTop: 14, fontSize: Math.min(60, fitPx(`${NM(L.odd)} NAMED IT`, 340, 60, 2)) }}>{NM(L.odd)} NAMED IT</div>
      <div className="oo-ph-say oo-dim pu-center">{nm(L.odd)} is picking who takes the punishment.</div>
      <PhTimer secs={secs} of={45} />
      {tv('Look at the TV.', 'Pray it isn\'t you.')}
    </>);
  }

  // ---------------- result: your part in the round ----------------
  if (g.phase === 'result' && L) {
    const famous = (L.famous ?? '').toUpperCase();
    const losers = L.losers ?? [];
    const angelOut = L.outcome === 'escaped' && L.tops.includes(me.id) && !losers.includes(me.id);
    const foot = tv('Watch the TV.', g.n >= g.of ? 'Case closed is next.' : 'The next round starts soon.');
    const nameFile = (
      <div className="oo-ph-file" style={{ marginTop: 6 }}>
        <div className="oo-ph-file-k">THE FAMOUS PERSON WAS</div>
        <div className="oo-ph-file-v" style={{ fontSize: fitPx(famous, 310, 44, 2) }}>{famous}</div>
      </div>
    );
    let stamp: ReactNode, tone: '' | 'oo-bone' | 'oo-green' | 'oo-gold', head: string, headTone: string, body: string;
    if (losers.includes(me.id)) {
      if (L.outcome === 'escaped') { stamp = 'INNOCENT'; tone = 'oo-bone'; head = 'WRONGLY ACCUSED'; headTone = 'oo-red';
        body = "You weren't the odd one out, but the room voted you out. You go in the punishment queue when the game ends."; }
      else if (L.outcome === 'wrong') { stamp = 'WRONG'; tone = ''; head = 'NO WAY OUT'; headTone = 'oo-red';
        body = 'Caught, and the name was wrong. You go in the punishment queue when the game ends.'; }
      else { stamp = 'PICKED'; tone = ''; head = L.random ? 'PICKED AT RANDOM' : `${NM(L.odd)} PICKED YOU`; headTone = 'oo-red';
        body = `${nm(L.odd)} was the odd one out and named it${L.random ? ", then didn't pick in time" : ''}. You go in the punishment queue when the game ends.`; }
    } else if (amOdd) {
      stamp = 'SAFE'; tone = 'oo-green'; headTone = 'oo-green';
      if (L.outcome === 'escaped') { head = 'YOU GOT AWAY WITH IT';
        body = losers.length ? `The room voted out ${andList(losers.map(nm))}.` : L.tops.length ? 'The room voted out the Angel, who is never punished.' : 'Nobody voted.'; }
      else { head = 'YOU NAMED IT'; body = L.picked ? (L.random ? `Out of time: ${nm(L.picked)} was picked at random.` : `You picked ${nm(L.picked)}. They take it.`) : 'Nobody was left to pick.'; }
    } else if (angelOut) {
      stamp = 'THE ANGEL'; tone = 'oo-gold'; head = 'NEVER PUNISHED'; headTone = 'oo-amber';
      body = 'The room voted you out, but the Angel is never punished.';
    } else {
      stamp = 'SAFE'; tone = 'oo-green'; headTone = '';
      head = L.outcome === 'escaped' ? `${NM(L.odd)} GOT AWAY WITH IT` : L.outcome === 'wrong' ? `${NM(L.odd)} GUESSED WRONG` : `${NM(L.odd)} NAMED IT`;
      body = losers.length ? `${andList(losers.map(nm))} ${losers.length === 1 ? 'goes' : 'go'} in the punishment queue. Not you.` : 'Nobody loses this round.';
    }
    return shell(<>
      <div className="pu-kick">{L.outcome === 'escaped' ? 'THE VOTE IS IN' : 'THE ROUND IS OVER'}</div>
      <Stamp tone={tone}>{stamp}</Stamp>
      <div className={'oo-ph-big ' + headTone} style={{ marginTop: 22, fontSize: Math.min(64, fitPx(head, 340, 64, 2)) }}>{head}</div>
      <div className="oo-ph-say pu-center" style={{ fontSize: 21 }}>{body}</div>
      {nameFile}
      {foot}
    </>, losers.includes(me.id) ? 'pu-red' : '');
  }

  // ---------------- final ----------------
  const n = g.losses?.[me.id] ?? 0;
  return shell(<>
    <div className="pu-kick pu-c-sodium pu-center" style={{ marginTop: 16 }}>ODD ONE OUT · CASE CLOSED</div>
    <Stamp tone={n ? '' : 'oo-green'}>{n ? (n > 1 ? `LOST ${(TIMES[n] ?? `${n} TIMES`).toUpperCase()}` : 'LOST') : 'SAFE'}</Stamp>
    <div className={'oo-ph-big ' + (n ? 'oo-red' : 'oo-green')} style={{ marginTop: 26, fontSize: 64 }}>{n ? 'INTO THE QUEUE' : 'YOU GOT OFF'}</div>
    <div className="pu-body pu-center pu-c-bone2">{n
      ? `You lost ${n === 1 ? 'a round' : `${n} rounds`}. You go in the punishment queue${n > 1 ? ' ' + (TIMES[n] ?? `${n} times`) : ''}.`
      : "You didn't lose a round. You're safe."}</div>
    {tv('Look at the TV.', 'Next: the Champ, the Slacker, then the Trial.')}
  </>, n ? 'pu-red' : '');
}

/** YOUR CARD: hold to read; I'VE READ IT once you have. */
function CardScreen({ card, read, left, busy, onRead }: { card: Card; read: boolean; left: number; busy: boolean; onRead: () => void }) {
  const hold = useHold();
  return <>
    <div className="pu-kick">YOUR CARD</div>
    <Fold card={card} hold={hold} />
    <div className="oo-ph-tip">{read ? `Hold it again any time. Waiting for ${left} more.` : "Hold it, read it, let go. Don't show anyone."}</div>
    <div className="pu-keys">
      <Key lg disabled={!(hold.seen || read) || read || busy} icon={read ? 'check' : undefined} onClick={onRead}>{read ? 'READ' : "I'VE READ IT"}</Key>
    </div>
  </>;
}
