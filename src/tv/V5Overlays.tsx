// Aaron's Plate on the TV: a grill of sausages, one lying sideways (the dirty one).
// (Holy Nova, the Locker, the Walk of Shame and Blessed live in Scenes.tsx.)
import { useEffect, useRef } from 'react';
import { useStageScale } from './Scenes';
import type { GameState, Plate, Player } from '../lib/types';
import type { Act } from './TvRoom';
import { initials } from '../lib/util';
import { Sound } from '../fx/sound';

function Photo({ p }: { p?: Player }) {
  return p?.selfie_url
    ? <img className="jr-photo" src={p.selfie_url} alt={p.name} draggable={false} />
    : <div className="jr-photo jr-blank">{initials(p?.name ?? '?')}</div>;
}

// ---------------------------------------------------------------- Aaron's Plate
// Clean sausages lie flat (with a little jitter); the dirty one is turned sideways —
// "he placed it sideways, so obviously it was the dirty one". Only the TV shows it.
const jitter = (i: number) => ((i * 53) % 13) - 6;
export function PlateOverlay({ state, plate, act, now, onClose }: { state: GameState; plate: Plate; act: Act; now: () => number; onClose: () => void }) {
  const scale = useStageScale();
  const closing = useRef(false);
  const open = plate.status === 'open';
  const left = Math.max(0, Date.parse(plate.ends_at) - now());
  const byIdx = new Map(Object.entries(plate.picks).map(([pid, i]) => [i, state.players.find(p => p.id === pid)]));
  const loser = state.players.find(p => p.id === plate.loser);
  const cols = plate.n <= 6 ? 3 : plate.n <= 12 ? 4 : 5;

  // time's up → serve (the server fills in anyone who didn't pick)
  useEffect(() => {
    if (open && left <= 0 && !closing.current) {
      closing.current = true;
      act('bbq_close', { plate_id: plate.id }).catch(() => { closing.current = false; });
    }
  });
  const played = useRef(false);
  useEffect(() => {
    if (!open && !played.current) { played.current = true; Sound.lose(); setTimeout(() => Sound.thud(), 500); }
  }, [open]);
  useEffect(() => { Sound.fanfare(); }, []);

  return (
    <div className="jr-ov bbq-ov">
      <div className="jr-stage" style={{ transform: `scale(${scale})` }}>
        <div className={'bbq-scene' + (open ? '' : ' served')}>
          <div className="bbq-head">
            <div className="bbq-kick">{open ? 'Someone has fired up the BBQ' : 'Served'}</div>
            <div className="bbq-title">AARON'S PLATE</div>
            <div className="bbq-sub">{open
              ? <>One of these fell on the balcony. <b>Pick a sausage on your phone</b> before they're gone.</>
              : <>“Aaron swears it's fine.”</>}</div>
          </div>
          <div className="bbq-grill" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
            {Array.from({ length: plate.n }, (_, i) => {
              const dirty = plate.dirty === i;
              const who = byIdx.get(i);
              return (
                <div key={i} className={'bbq-cell' + (who ? ' taken' : '') + (!open && dirty ? ' reveal' : '') + (!open && !dirty ? ' clean' : '')}>
                  <div className={'sausage' + (dirty ? ' side' : '')} style={{ ['--j' as any]: `${dirty ? 90 : jitter(i)}deg` }}>
                    <i className="mark" /><i className="mark" /><i className="mark" />
                    {!open && dirty && <><i className="dirt a" /><i className="dirt b" /><i className="dirt c" /></>}
                  </div>
                  <div className="bbq-num">{i + 1}</div>
                  {who && <div className="bbq-who"><Photo p={who} /><span>{who.name.toUpperCase()}</span></div>}
                  {!open && dirty && <div className="bbq-flies">🪰</div>}
                </div>
              );
            })}
          </div>
          {open
            ? <div className="bbq-timer"><b>{Math.ceil(left / 1000)}</b>s · {Object.keys(plate.picks).length} / {plate.n} taken</div>
            : <div className="bbq-result">
                {loser ? <><div className="bbq-loser"><Photo p={loser} /></div><div><div className="bbq-ate">{loser.name.toUpperCase()}</div><div className="bbq-ate-sub">ATE THE DIRTY SAUSAGE · INTO THE QUEUE</div></div></> : <div className="bbq-ate-sub">NOBODY ATE IT. AARON'S DISAPPOINTED.</div>}
                <button className="jr-btn inline" onClick={onClose}>CLOSE</button>
              </div>}
        </div>
        <div className="jr-grain top" />
      </div>
    </div>
  );
}
