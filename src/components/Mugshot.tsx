// A role's booking-photo mugshot (src/cards/mugshots.js). The markup is built from fixed data, never user input.
import type { CSSProperties } from 'react';
import { MUGSHOTS } from '../cards/mugshots.js';

export function Mugshot({ role, className = '', style }: { role: string; className?: string; style?: CSSProperties }) {
  return <span className={'mugshot ' + className} style={style} role="img" aria-label={`${role} mugshot`} dangerouslySetInnerHTML={{ __html: MUGSHOTS[role] ?? '' }} />;
}
