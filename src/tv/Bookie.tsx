// THE BOOKIE on the TV. Public facts only: how many bets are in, that they've closed, and (after the game's own reveal)
// who called it. Never the picks, the per-option counts or anyone's caps.
//   BookieStrip     a ticket stub on the WANTED poster screen: THE BOOKIE · 7 BETS IN · CLOSES AT GO
//   BetsClosed      a rubber stamp at GO
//   BookieBanner    "3 CALLED IT" with the winners' photos, after the reveal has finished (TvRoom times it)
// Motion is transform/opacity only; prefers-reduced-motion gets the still versions (src/styles/bookie.css).
import type { Player } from '../lib/types';
import { initials } from '../lib/util';

export function BookieStrip({ n }: { n: number }) {
  return (
    <div className="bk-strip" aria-label={`The bookie: ${n} bets in. Closes at go.`}>
      <span className="bk-notch l" /><span className="bk-notch r" />
      <b>THE BOOKIE</b><i>·</i><span><em key={n} className="bk-n">{n}</em> BET{n === 1 ? '' : 'S'} IN</span><i>·</i><span>CLOSES AT GO</span>
    </div>
  );
}

export function BetsClosed() {
  return <div className="bk-closed" aria-label="Bets closed"><span>BETS CLOSED</span></div>;
}

const MAX_FACES = 6;
export function BookieBanner({ winners }: { winners: Player[] }) {
  const k = winners.length;
  const faces = winners.slice(0, MAX_FACES);
  return (
    <div className="bk-ban-wrap">
      <div className="bk-ban">
        <div className="bk-ban-kick">THE BOOKIE</div>
        <div className="bk-ban-title">{k ? `${k} CALLED IT` : 'NOBODY CALLED IT'}</div>
        {k > 0 && <div className="bk-ban-faces">
          {faces.map(p => (
            <div key={p.id} className="bk-face">
              {p.selfie_url ? <img src={p.selfie_url} alt="" draggable={false} /> : <span>{initials(p.name)}</span>}
              <b>{p.name.toUpperCase()}</b>
            </div>
          ))}
          {k > MAX_FACES && <div className="bk-more">+{k - MAX_FACES}</div>}
        </div>}
        <div className="bk-ban-sub">{k ? 'THEY SPLIT THE POT' : 'EVERYONE GETS THEIR CAPS BACK'}</div>
      </div>
    </div>
  );
}
