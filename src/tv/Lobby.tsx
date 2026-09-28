// Lobby: huge room code + QR for the join link, players appearing live with a
// ✓ once they've redeemed a role code (never the role itself).
import type { GameState } from '../lib/types';
import type { Act } from './TvRoom';
import { Avatar, QR } from '../components/ui';

export function Lobby({ state, onClose, onSettings }: { state: GameState; act: Act; onClose: () => void; onSettings: () => void }) {
  const url = `${location.origin}/join/${state.room.code}`;
  const redeemed = state.players.filter(p => p.has_role).length;
  return (
    <div className="overlay lobby">
      <div className="lobby-left">
        <div className="lobby-kicker">JOIN ON YOUR PHONE</div>
        <QR text={url} className="lobby-qr" />
        <div className="lobby-url">{url.replace(/^https?:\/\//, '')}</div>
        <div className="lobby-code-label">ROOM CODE</div>
        <div className="lobby-code">{state.room.code}</div>
      </div>
      <div className="lobby-right">
        <div className="lobby-head">
          <div className="ph-title">{state.players.length} JOINED</div>
          <div className="ph-stats"><b>{redeemed}</b> / {state.players.length} ROLE CODES ENTERED</div>
        </div>
        <div className="lobby-grid">
          {state.players.map(p => (
            <div key={p.id} className="lobby-player">
              <Avatar url={p.selfie_url} name={p.name} />
              <div className="lp-name">{p.name}</div>
              <div className={'lp-tick' + (p.has_role ? ' on' : '')}>{p.has_role ? '✓' : '…'}</div>
            </div>
          ))}
          {!state.players.length && <div className="muted big-muted">Scan the code to join 👉</div>}
        </div>
        <div className="lobby-actions">
          <a className="btn" href={`/cards/${state.room.code}`} target="_blank" rel="noreferrer">🖨 ROLE CARDS</a>
          <button className="btn" onClick={onSettings}>⚙ SETUP</button>
          <button className="btn-beer lobby-go" onClick={onClose}>{state.room.status === 'lobby' ? "LET'S GO 🍻" : 'BACK TO GAME'}</button>
        </div>
      </div>
    </div>
  );
}
