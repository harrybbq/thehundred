// Lobby: QR on a polaroid, huge sodium room code, suspects pinned up live with a
// tick once they've redeemed a role code (never the role itself).
import type { GameState } from '../lib/types';
import type { Act } from './TvRoom';
import { Polaroid, QR } from '../components/ui';

export function Lobby({ state, onClose, onSettings }: { state: GameState; act: Act; onClose: () => void; onSettings: () => void }) {
  const url = `${location.origin}/join/${state.room.code}`;
  const redeemed = state.players.filter(p => p.has_role).length;
  return (
    <div className="overlay lobby">
      <div className="rain" /><div className="fence" />
      <div className="lobby-left">
        <div className="kicker">JOIN ON YOUR PHONE</div>
        <div className="lobby-qrwrap"><QR text={url} className="lobby-qr" /></div>
        <div className="lobby-url">{url.replace(/^https?:\/\//, '')}</div>
        <div className="kicker">ROOM CODE</div>
        <div className="lobby-code">{state.room.code}</div>
      </div>
      <div className="lobby-right">
        <div className="lobby-head">
          <div className="t"><b>{state.players.length} IN THE ROOM</b><span>one of them is lying</span></div>
          <div className="c"><b>{redeemed}</b> / {state.players.length} CODES ENTERED</div>
        </div>
        <div className="lobby-grid">
          {state.players.map(p => (
            <div key={p.id} className="lobby-player">
              <Polaroid url={p.selfie_url} name={p.name} caption={p.name.toUpperCase()} pin />
              {p.has_role && <div className="lp-tick">✓</div>}
            </div>
          ))}
          {!state.players.length && <div className="big-muted">Scan the code. Take a selfie. Trust nobody.</div>}
        </div>
        <div className="lobby-actions">
          <a className="key" href={`/cards/${state.room.code}`} target="_blank" rel="noreferrer">ROLE CARDS</a>
          <button className="key" onClick={onSettings}>SETUP</button>
          <button className="key sodium lobby-go" onClick={onClose}>{state.room.status === 'lobby' ? "LET'S GO" : 'BACK TO GAME'}</button>
        </div>
      </div>
    </div>
  );
}
