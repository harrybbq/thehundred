// Lobby: QR on a polaroid, huge sodium room code, suspects pinned up live with a
// tick once they've redeemed a role code (never the role itself).
import type { GameState } from '../lib/types';
import type { Act } from './TvRoom';
import { Polaroid, QR } from '../components/ui';
import { safePx, useFitScale } from './stage';

/** The widest polaroid (stage px) that fits n of them in the lobby's grid. The lobby is a zoomed 1920-wide stage
 *  (tv.css), so the grid is 1920 minus the QR column, the gaps and the margins wide; its height is what the screen
 *  leaves under the heading and above the keys (more on a 16:10 screen). A polaroid is ~34px taller than wide. */
function cardWidth(n: number, z: number) {
  const safe = safePx() / z, gridW = 1920 - 2 * (safe + 44) - 640 - 72;
  const gridH = innerHeight / z - 2 * (safe + 34) - 70 - 2 * 30 - 104 - 24;
  for (let w = 210; w > 80; w -= 4) {
    const cols = Math.max(1, Math.floor((gridW + 26) / (w + 26))), rows = Math.ceil(Math.max(1, n) / cols);
    if (rows * (w + 34) + (rows - 1) * 36 <= gridH) return w;
  }
  return 80;
}

export function Lobby({ state, onClose, onSettings, onMenu }: { state: GameState; act: Act; onClose: () => void; onSettings: () => void; onMenu: () => void }) {
  const url = `${location.origin}/join/${state.room.code}`;
  const redeemed = state.players.filter(p => p.has_role).length;
  const pw = cardWidth(state.players.length, useFitScale());   // re-sized on resize and on a TV EDGE MARGIN change
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
        <div className="lobby-grid" style={{ ['--pw' as string]: pw + 'px' }}>
          {state.players.map(p => (
            <div key={p.id} className="lobby-player">
              <Polaroid url={p.selfie_url} name={p.name} caption={p.name.toUpperCase()} pin />
              {p.has_role && <div className="lp-tick">✓</div>}
            </div>
          ))}
          {!state.players.length && <div className="big-muted">Scan the code. Take a selfie. Trust nobody.</div>}
        </div>
        <div className="lobby-actions">
          <button className="key" onClick={onMenu} title="Back to the main menu">⌂ MENU</button>
          <a className="key" href={`/cards/${state.room.code}`} target="_blank" rel="noreferrer">ROLE CARDS</a>
          <button className="key" onClick={onSettings}>SETUP</button>
          <button className="key sodium lobby-go" onClick={onClose}>{state.room.status === 'lobby' ? "LET'S GO" : 'BACK TO GAME'}</button>
        </div>
      </div>
    </div>
  );
}
