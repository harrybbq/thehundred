// TAG TEAM CHESS on the phone: placeholder until it's built.
import type { ChessGame } from '../../lib/types';
import type { AppPhoneProps } from './AppGamePhone';

export function ChessPhone({ bar }: AppPhoneProps<ChessGame>) {
  return <div className="pu-app ap-phone">{bar()}<div className="pu-hero">TAG TEAM CHESS</div><div className="pu-body">Look at the TV.</div></div>;
}
