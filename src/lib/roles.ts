import type { Role, Team } from './types';

export const ROLE_ORDER: Role[] = ['intruder', 'betrayer', 'forger', 'medic', 'detective', 'lovebird', 'cursed', 'jester', 'drinker'];

// Stamp inks from the style tiles (they sit on manila paper).
export const ROLES: Record<Role, { label: string; icon: string; color: string; team: Team; short: string }> = {
  intruder:  { label: 'Intruder',  icon: '🗡', color: '#c2371f', team: 'guilty',   short: 'Stop the group hitting 100. Sabotage quietly. Name a player\'s secret role to blow their cover — one Hit per game, and your streak lasts until you guess wrong.' },
  betrayer:  { label: 'Betrayer',  icon: '🐍', color: '#b8560f', team: 'drinkers', short: 'Find the Intruder: two accusations. Right and you join the Guilty. Wrong and you drink. If the Intruder is caught, their knife passes to you.' },
  forger:    { label: 'Forger',    icon: '✒', color: '#5c2a54', team: 'guilty',   short: 'When the Medic writes a heal, you\'ll know. Forge it once tonight and the "saved" victim faces the wheel anyway. You never learn whose heal it was.' },
  medic:     { label: 'Medic',     icon: '✚', color: '#3f7a14', team: 'drinkers', short: 'Two heals tonight. Heal anyone ahead of time and their next spin is cancelled. Not yourself. A Forger may be rewriting your work.' },
  detective: { label: 'Detective', icon: '🔍', color: '#2a4d69', team: 'drinkers', short: 'One investigation per game: learn if a player is Guilty. The answer shows for three seconds while you hold it, then it\'s gone.' },
  lovebird:  { label: 'Lovebird',  icon: '💘', color: '#9e2f42', team: 'drinkers', short: 'You share every punishment with your partner. Secret until your first one together.' },
  cursed:    { label: 'Cursed',    icon: '☠', color: '#1b1712', team: 'drinkers', short: 'Your punishments are doubled. Beat someone in a game to pass the curse on — the host approves.' },
  jester:    { label: 'Jester',    icon: '🃏', color: '#8a6a00', team: 'chaos',    short: 'Pure chaos, no side. Re-spin the wheel, swap the victim, scrawl graffiti on the wheel.' },
  drinker:   { label: 'Drinker',   icon: '🍺', color: '#1d5a5c', team: 'drinkers', short: 'No powers. Drink, watch, and unmask the Guilty.' },
};

export const TEAMS: Record<Team, { label: string; color: string; blurb: string }> = {
  drinkers: { label: 'DRINKERS', color: '#1d5a5c', blurb: 'You win if the group hits the target by the deadline.' },
  guilty:   { label: 'GUILTY',   color: '#c2371f', blurb: 'You win if the group falls short at the deadline.' },
  chaos:    { label: 'CHAOS',    color: '#8a6a00', blurb: 'You serve no side. Make the night unforgettable.' },
};

// Roles the Intruder may name with a Hit (never Drinker or Cursed).
export const HIT_ROLES: Role[] = ['betrayer', 'forger', 'medic', 'detective', 'lovebird', 'jester'];

// Printed card blurbs — deliberately similar lengths so reading time gives nothing away.
export const CARD_TEXT: Record<Role, string> = {
  intruder:  'You are the INTRUDER. Stop the group reaching the target: hide beers, pour them away, slow everyone down. Guess a player\'s secret role on your phone to blow their cover. Keep guessing right and your knife stays sharp.',
  betrayer:  'You are the BETRAYER. An Intruder hides in this room and you want in. Accuse who you think it is from your phone, but only twice. Guess right and you join the Guilty. If the Intruder is caught, their knife passes to you.',
  forger:    'You are the FORGER, working for the Guilty. When the Medic writes a heal, your phone will know about it. Forge it once tonight and the saved victim still faces the wheel. You will never learn whose heal you rewrote.',
  medic:     'You are the MEDIC. You carry two heals for the whole night. Pick anyone on your phone and their next punishment is cancelled before they spin. You can never heal yourself. Beware: a Forger may be rewriting your work.',
  detective: 'You are the DETECTIVE. Once per game you can quietly investigate a player from your phone and learn if they are Guilty. The answer flashes for three seconds only, so nobody sees proof. Steer the trials and trust nobody.',
  lovebird:  'You are a LOVEBIRD. Somewhere out there is your other half, and your phone will tell you exactly who. From now on you share everything: when one of you is punished, so is the other. You stay secret until your first punishment.',
  cursed:    'You are CURSED. Everyone can see the skull on your card, and every punishment you face is doubled because the wheel spins twice. Beat someone in a game and you can pass the curse on to them from your phone once the host approves.',
  jester:    'You are the JESTER. You serve no side, only chaos. From your phone you can force a re-spin of the wheel, swap the victim for someone else just before they spin, and scrawl your own punishment onto the wheel. Nobody sees who.',
  drinker:   'You are a DRINKER. No tricks, no secret powers, just loyalty to the group and a thirst for victory. Keep the beers flowing, keep your eyes open, and watch for anyone hiding drinks or pouring them away. Unmask the Guilty.',
};
