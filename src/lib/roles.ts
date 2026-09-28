import type { Role, Team } from './types';

export const ROLE_ORDER: Role[] = ['intruder', 'betrayer', 'forger', 'medic', 'detective', 'lovebird', 'cursed', 'jester', 'drinker'];
/** Modifiers sit on top of a dealt card (any role, Saboteurs included); they are not cards of their own. */
export const MODIFIERS: Role[] = ['lovebird', 'cursed'];
/** Roles that are dealt as cards. */
export const CARD_ROLES: Role[] = ROLE_ORDER.filter(r => !MODIFIERS.includes(r));
export const MODIFIER_TEXT: Record<'lovebird' | 'cursed', string> = {
  lovebird: 'MODIFIER: LOVEBIRD. Your phone names your partner. You share every punishment, whatever your role.',
  cursed:   'MODIFIER: CURSED. The TV shows your skull and every spin you face is doubled. Beat someone in a game to pass it on.',
};

// Stamp inks from the style tiles (they sit on manila paper).
export const ROLES: Record<Role, { label: string; icon: string; color: string; team: Team; short: string }> = {
  intruder:  { label: 'Intruder',  icon: '🗡', color: '#c2371f', team: 'guilty',   short: 'Stop the group hitting 100. Name a player\'s secret role to blow their cover: one Hit per game, the streak lasts until you guess wrong. At 4 beers a miss still gives a clue; at 8, one miss is forgiven.' },
  betrayer:  { label: 'Betrayer',  icon: '🐍', color: '#b8560f', team: 'drinkers', short: 'Find the Intruder: two accusations (three from 4 beers, plus a hint at 8). Right and you join the Saboteurs. Wrong and you drink. If the Intruder is caught, their knife passes to you.' },
  forger:    { label: 'Forger',    icon: '✒', color: '#5c2a54', team: 'guilty',   short: 'When the Medic writes a heal, you\'ll know. Forge it once and the "saved" victim faces the wheel anyway. You never learn whose. Once, frame a player: the Detective will read them as a Saboteur.' },
  medic:     { label: 'Medic',     icon: '✚', color: '#3f7a14', team: 'drinkers', short: 'One heal per drink level (1, then 2 at 4 beers, 3 at 8). Heal anyone ahead of time and their next spin is cancelled. Not yourself. A Forger may be rewriting your work.' },
  detective: { label: 'Detective', icon: '🔍', color: '#2a4d69', team: 'drinkers', short: 'One investigation per game. Sober, a reading lumps your target in with 2 others; at 4 beers with 1 other; at 8 beers it\'s exact. Hold to read: 3 seconds, once.' },
  lovebird:  { label: 'Lovebird',  icon: '💘', color: '#9e2f42', team: 'drinkers', short: 'A modifier on top of any card, even a Saboteur\'s. You share every punishment with your partner. When the pair is revealed, the TV shows the heart but not your role.' },
  cursed:    { label: 'Cursed',    icon: '☠', color: '#1b1712', team: 'drinkers', short: 'A modifier on top of any card, even a Saboteur\'s. Everyone sees the skull; nobody sees your role. Every spin you face is doubled. Beat someone in a game to pass it on (the host approves).' },
  jester:    { label: 'Jester',    icon: '🃏', color: '#8a6a00', team: 'chaos',    short: 'Pure chaos, no side. Re-spin the wheel (once per drink level), swap the victim (twice at 8 beers), scrawl graffiti on the wheel.' },
  drinker:   { label: 'Drinker',   icon: '🍺', color: '#1d5a5c', team: 'drinkers', short: 'No powers. Drink, watch, and unmask the Saboteurs.' },
};

export const TEAMS: Record<Team, { label: string; color: string; blurb: string }> = {
  drinkers: { label: 'DRINKERS', color: '#1d5a5c', blurb: 'You win if the group hits the target by the deadline.' },
  guilty:   { label: 'SABOTEURS',   color: '#c2371f', blurb: 'You win if the group falls short at the deadline.' },
  chaos:    { label: 'CHAOS',    color: '#8a6a00', blurb: 'You serve no side. Make the night unforgettable.' },
};

// Roles the Intruder may name with a Hit: real roles only, never Drinker or a modifier (Lovebird, Cursed).
export const HIT_ROLES: Role[] = ['betrayer', 'forger', 'medic', 'detective', 'jester'];

// Printed card blurbs — deliberately similar lengths so reading time gives nothing away.
export const CARD_TEXT: Record<Role, string> = {
  intruder:  'You are the INTRUDER. Stop the group reaching the target: hide beers, pour them away, slow everyone down. Guess a player\'s secret role on your phone to blow their cover. Keep guessing right and your knife stays sharp.',
  betrayer:  'You are the BETRAYER. An Intruder hides in this room and you want in. Accuse who you think it is from your phone; drinking earns more tries and a hint. Guess right, join the Saboteurs. Caught Intruder? Their knife is yours.',
  forger:    'You are the FORGER, working for the Saboteurs. When the Medic writes a heal, your phone knows. Forge it once and the saved victim still spins. Once a night you can frame a player too: the Detective will read them as a Saboteur.',
  medic:     'You are the MEDIC. Heal anyone from your phone before they spin and their punishment is cancelled, but never yourself. You start with one heal and unlock more as you drink. Beware: a Forger may be rewriting your work.',
  detective: 'You are the DETECTIVE. Once per game, quietly investigate a player from your phone. Sober, your readings are vague; the more you drink, the sharper they get. Each answer flashes for three seconds only. Trust nobody.',
  lovebird:  'You are a LOVEBIRD. Somewhere out there is your other half, and your phone will tell you exactly who. From now on you share everything: when one of you is punished, so is the other. You stay secret until your first punishment.',
  cursed:    'You are CURSED. Everyone can see the skull on your card, and every punishment you face is doubled because the wheel spins twice. Beat someone in a game and you can pass the curse on to them from your phone once the host approves.',
  jester:    'You are the JESTER. You serve no side, only chaos. From your phone you can force a re-spin of the wheel, swap the victim for someone else just before they spin, and scrawl your own punishment onto the wheel. Nobody sees who.',
  drinker:   'You are a DRINKER. No tricks, no secret powers, just loyalty to the group and a thirst for victory. Keep the beers flowing, keep your eyes open, and watch for anyone hiding drinks or pouring them away. Unmask the Saboteurs.',
};

// ---------- drink levels: beers logged on your own phone make powers stronger ----------
export const levelFor = (beers: number): 1 | 2 | 3 => (beers >= 8 ? 3 : beers >= 4 ? 2 : 1);
/** Beers still needed for the next level, or null at level 3. */
export const toNextLevel = (beers: number) => (beers >= 8 ? null : (beers >= 4 ? 8 : 4) - beers);

/** What each level gives (null = the role doesn't scale). Knife holders use the Intruder row. */
export const PERKS: Partial<Record<Role, [string, string, string]>> = {
  medic:     ['1 heal', '2 heals', '3 heals'],
  detective: ['Vague: each reading covers 3 people', 'Sharper: readings cover 2 people', 'Exact: readings cover just your target'],
  intruder:  ['Name the exact role', 'A miss still tells you if they\'re a Drinker', 'One miss a night is forgiven'],
  betrayer:  ['2 accusations', '3 accusations', '3 accusations + a hint: the Intruder is one of 3 names'],
  jester:    ['1 re-spin, 1 swap', '2 re-spins, 1 swap', '3 re-spins, 2 swaps'],
};
