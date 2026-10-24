// ODD ONE OUT on the phone: placeholder until it's built.
import type { OddGame } from '../../lib/types';
import type { AppPhoneProps } from './AppGamePhone';

export function OddPhone({ bar }: AppPhoneProps<OddGame>) {
  return <div className="pu-app ap-phone">{bar()}<div className="pu-hero">ODD ONE OUT</div><div className="pu-body">Look at the TV.</div></div>;
}
