// TAG TEAM CHESS on the TV: placeholder until it's built.
import type { ChessGame } from '../../lib/types';
import type { AppTvProps } from './AppGameTV';
import { TopLine } from './kit';

export function ChessTV({ host }: AppTvProps<ChessGame>) {
  return <div className="ap"><div className="ap-room" /><TopLine title="TAG TEAM CHESS"><button className="ap-key" onClick={() => host('stop')}>END IT</button></TopLine></div>;
}
