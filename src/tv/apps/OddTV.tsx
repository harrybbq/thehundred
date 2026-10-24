// ODD ONE OUT on the TV: placeholder until it's built.
import type { OddGame } from '../../lib/types';
import type { AppTvProps } from './AppGameTV';
import { TopLine } from './kit';

export function OddTV({ host }: AppTvProps<OddGame>) {
  return <div className="ag"><div className="ag-room" /><TopLine title="ODD ONE OUT"><button className="ag-key" onClick={() => host('stop')}>END IT</button></TopLine></div>;
}
