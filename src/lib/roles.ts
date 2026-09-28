import type { Role } from './types';

export const ROLE_ORDER: Role[] = ['intruder', 'betrayer', 'medic', 'lovebird', 'cursed', 'jester', 'drinker'];

export const ROLES: Record<Role, { label: string; icon: string; color: string; short: string }> = {
  intruder: { label: 'Intruder', icon: '🗡️', color: '#ff3b3b', short: 'Stop the group hitting the target. Sabotage quietly. Don\'t get caught.' },
  betrayer: { label: 'Betrayer', icon: '🐍', color: '#ff8a1f', short: 'Find the Intruder and join them. Two guesses. Wrong guess = you drink.' },
  medic:    { label: 'Medic',    icon: '✚',  color: '#39ff88', short: 'Two heals tonight. Heal someone before they spin. Not yourself.' },
  lovebird: { label: 'Lovebird', icon: '💘', color: '#ff2d95', short: 'You share every punishment with your partner. Secret until the first one.' },
  cursed:   { label: 'Cursed',   icon: '💀', color: '#b04dff', short: 'Your punishments are doubled. Beat someone in a game to pass the curse.' },
  jester:   { label: 'Jester',   icon: '🃏', color: '#22e6ff', short: 'Pure chaos. Re-spin the wheel, swap the victim, graffiti the wheel.' },
  drinker:  { label: 'Drinker',  icon: '🍺', color: '#ffd23f', short: 'No powers. Drink, watch, and unmask the Intruder.' },
};

// Printed card blurbs — deliberately similar lengths so reading time gives nothing away.
export const CARD_TEXT: Record<Role, string> = {
  intruder: 'You are the INTRUDER. Quietly stop the group reaching the target before the deadline: hide beers, pour them away, slow everyone down. Never get caught. If the tally is short when time runs out, you win the night.',
  betrayer: 'You are the BETRAYER. Somewhere in this room hides an Intruder, and you want in. Accuse who you think it is from your phone, but you only get two guesses. Guess right and you secretly share their win. Guess wrong and you drink.',
  medic:    'You are the MEDIC. You carry two heals for the whole night. When someone is called up to the wheel, heal them from your phone before they spin and their punishment is cancelled. You can never heal yourself, so choose wisely.',
  lovebird: 'You are a LOVEBIRD. Somewhere out there is your other half, and your phone will tell you exactly who. From now on you share everything: when one of you is punished, so is the other. You stay secret until your first punishment.',
  cursed:   'You are CURSED. Everyone can see the skull on your card, and every punishment you face is doubled because the wheel spins twice. Beat someone in a game and you can pass the curse on to them from your phone once the host approves.',
  jester:   'You are the JESTER. You serve no side, only chaos. From your phone you can force a re-spin of the wheel, swap the victim for someone else just before they spin, and scrawl your own punishment onto the wheel. Nobody sees who.',
  drinker:  'You are a DRINKER. No tricks, no secret powers, just loyalty to the group and a thirst for victory. Keep the beers flowing, keep your eyes open, and watch for anyone hiding drinks or pouring them away. Unmask the Intruder.',
};
