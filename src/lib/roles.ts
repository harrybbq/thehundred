import type { Player, Role, Team } from './types';

export const ROLE_ORDER: Role[] = ['intruder', 'betrayer', 'forger', 'medic', 'detective', 'skank', 'davyjones', 'lovebird', 'cursed', 'scrooge', 'jester', 'assassin', 'drinker', 'angel'];
/** Modifiers sit on top of a dealt card (any role, Saboteurs included); they are not cards of their own. */
export const MODIFIERS: Role[] = ['lovebird', 'cursed'];
/** Roles that are dealt as cards (the Angel is handed out by the host instead). */
export const CARD_ROLES: Role[] = ROLE_ORDER.filter(r => !MODIFIERS.includes(r) && r !== 'angel');
export const MODIFIER_TEXT: Record<'lovebird' | 'cursed', string> = {
  lovebird: 'MODIFIER: LOVEBIRD. Your phone names your partner. You share every punishment, whatever your role.',
  cursed:   'MODIFIER: CURSED. The TV shows your skull and every spin you face is doubled. Beat someone in a game to pass it on.',
};

// Stamp inks from the style tiles (they sit on manila paper).
export const ROLES: Record<Role, { label: string; icon: string; color: string; team: Team; short: string }> = {
  intruder:  { label: 'Intruder',  icon: '🗡', color: '#c2371f', team: 'guilty',   short: 'Stop the group hitting 100. At Level 1 you have no powers yet: slow the room down. Talk people out of the next beer, keep them nursing their drinks. At Level 2, the Hit: name a player\'s secret role to blow their cover (one per game; the streak lasts until you guess wrong). At Level 3 a miss still gives a clue; at Level 4 you get the BOMB: a hot potato passed phone to phone until it blows.' },
  betrayer:  { label: 'Betrayer',  icon: '🐍', color: '#b8560f', team: 'drinkers', short: 'Find the Intruder: two accusations from Level 2 (three at Level 3, plus a hint at Level 4). Right and you join the Saboteurs. Wrong and you drink. If the Intruder is caught, their knife passes to you.' },
  forger:    { label: 'Forger',    icon: '✒', color: '#5c2a54', team: 'guilty',   short: 'When the Medic writes a heal, you\'ll know. At Level 2, once, frame a player: the Detective will read them as a Saboteur. At Level 3, forge a heal once and the "saved" victim faces the wheel anyway. You never learn whose. At Level 4 you become the OATHBREAKER: once per game, rewrite the name on a waiting punishment.' },
  medic:     { label: 'Medic',     icon: '✚', color: '#3f7a14', team: 'drinkers', short: 'Heal anyone ahead of time and their next spin is cancelled. Not yourself. One heal at Level 2, two at Level 3. At Level 4 you become the SURGEON: one self-heal, and your heals can\'t be forged. A Forger may be rewriting your work.' },
  detective: { label: 'Detective', icon: '🔍', color: '#2a4d69', team: 'drinkers', short: 'One investigation per game, from Level 2. At Level 2 a reading lumps your target in with 2 others; from Level 3 with 1 other. At Level 4 you become JUDGE DREDD. Hold to read: 3 seconds, once.' },
  lovebird:  { label: 'Lovebird',  icon: '💘', color: '#9e2f42', team: 'drinkers', short: 'A modifier on top of any card, even a Saboteur\'s. You share every punishment with your partner. When the pair is revealed, the TV shows the heart but not your role.' },
  cursed:    { label: 'Cursed',    icon: '☠', color: '#1b1712', team: 'drinkers', short: 'A modifier on top of any card, even a Saboteur\'s. Everyone sees the skull; nobody sees your role. Every spin you face is doubled. Beat someone in a game to pass it on (the host approves).' },
  skank:     { label: 'Skank',     icon: '🧌', color: '#4f6b1f', team: 'drinkers', short: 'A lowly goblin nobody rates. Every beer you log on your phone secretly counts double for the team (triple at Level 4). Nobody sees the bonus until time runs out. From Level 3, once per game: Aaron\'s Plate. At Level 4 you become THE GOBSHITE.' },
  davyjones: { label: 'Davy Jones', icon: '⚓', color: '#1f5f7a', team: 'drinkers', short: 'From Level 2, once per game, drag someone down to your Locker to protect them: no punishments (only one waits for them), but no powers or vote either, for 15 minutes. At Level 4 you become THE KRAKEN: Walk the Plank.' },
  scrooge:   { label: 'Scrooge',   icon: '🎩', color: '#8a6a00', team: 'chaos',    short: 'No side, pure spite. From Level 2: re-spin the wheel and swap the victim. Level 3: two re-spins, and scrawl graffiti on the wheel. Level 4: three re-spins, a second swap, and Penny Drop: the whole room calls your coin.' },
  jester:    { label: 'Jester',    icon: '🃏', color: '#6b2f8f', team: 'chaos',    short: 'No side. You want to be convicted. If a Trial votes you out you\'re revealed, and you pick one of the people who voted for you to take a ×3 punishment. Once a night. At Level 4 you become PENNYWISE: Jack-in-the-Box.' },
  assassin:  { label: 'Assassin',  icon: '🎯', color: '#4a4a52', team: 'guilty',   short: 'A Saboteur. From Level 2, once per game, DODGE: throw at someone and they guess left, right or high to dodge. At Level 4 you become the NINJA: once per game, a silent shuriken nobody can dodge.' },
  angel:     { label: 'Angel',     icon: '😇', color: '#c9a227', team: 'drinkers', short: 'For the one who isn\'t drinking. Public, and never punished or tried. Holy Nova adds 10% of the target to the tally once a night (never over the line), and once a night you can bless a wheel punishment into SAFE for good.' },
  drinker:   { label: 'Drinker',   icon: '🍺', color: '#1d5a5c', team: 'drinkers', short: 'No powers. Drink, watch, and unmask the Saboteurs. Every level you reach pays you 5 caps.' },
};

export const TEAMS: Record<Team, { label: string; color: string; blurb: string }> = {
  drinkers: { label: 'DRINKERS', color: '#1d5a5c', blurb: 'You win if the group hits the target by the deadline.' },
  guilty:   { label: 'SABOTEURS',   color: '#c2371f', blurb: 'You win if the group falls short at the deadline.' },
  chaos:    { label: 'CHAOS',    color: '#8a6a00', blurb: 'You serve no side. Make the night unforgettable.' },
};

// Roles the Intruder may name with a Hit: real roles only, never Drinker or a modifier (Lovebird, Cursed).
export const HIT_ROLES: Role[] = ['betrayer', 'forger', 'medic', 'detective', 'skank', 'davyjones', 'scrooge', 'jester', 'assassin'];

// Printed card blurbs — deliberately similar lengths so reading time gives nothing away.
export const CARD_TEXT: Record<Role, string> = {
  intruder:  'You are the INTRUDER. Stop the group reaching the target: talk people out of the next beer, slow everyone down. From 3 beers, guess a player\'s secret role on your phone to blow their cover. Guess right and your knife stays sharp.',
  betrayer:  'You are the BETRAYER. An Intruder hides in this room and you want in. From 3 beers, accuse who you think it is; drinking earns more tries and a hint. Guess right, join the Saboteurs. Caught Intruder? Their knife is yours.',
  forger:    'You are the FORGER, a Saboteur. When the Medic writes a heal, your phone knows. From 6 beers, forge it once and the saved victim still spins. From 3 beers you can frame a player once: the Detective reads them as a Saboteur.',
  medic:     'You are the MEDIC. Heal anyone from your phone before they spin and their punishment is cancelled, but never yourself. Your first heal unlocks at 3 beers, more as you drink. Beware: a Forger may be rewriting your work.',
  detective: 'You are the DETECTIVE. From 3 beers, once per game, quietly investigate a player from your phone. Sober, your readings are vague; the more you drink, the sharper they get. Each answer flashes for three seconds only. Trust nobody.',
  lovebird:  'You are a LOVEBIRD. Somewhere out there is your other half, and your phone will tell you exactly who. From now on you share everything: when one of you is punished, so is the other. You stay secret until your first punishment.',
  cursed:    'You are CURSED. Everyone can see the skull on your card, and every punishment you face is doubled because the wheel spins twice. Beat someone in a game and you can pass the curse on to them from your phone once the host approves.',
  skank:     'You are the SKANK, a lowly goblin on the Drinkers\' side. Nobody rates you, but every beer you log on your phone secretly counts double for the team, triple from 9 beers. The bonus is only revealed when time runs out.',
  scrooge:   'You are the SCROOGE. You serve no side and begrudge everyone their fun. From 3 beers your phone can force a re-spin of the wheel, swap the victim for someone else just before they spin, and scrawl your own punishment onto it.',
  jester:    'You are the JESTER. You serve no side and you WANT to be convicted. Act shifty and get the room to vote you out at a Trial: then you pick one of your accusers to take a triple punishment. At 9 beers you become PENNYWISE.',
  davyjones: 'You are DAVY JONES. From 3 beers, once per game, drag someone down to your Locker from your phone to save them from the wheel. While they sleep with the fishes they skip punishments, but lose their powers and vote for a while.',
  assassin:  'You are the ASSASSIN, a Saboteur. From 3 beers, once per game, throw at someone from your phone: they guess left, right or high to dodge, or go to the wheel. At 9 beers you become the NINJA and your shuriken can\'t be dodged.',
  angel:     'You are the ANGEL, watching over a room of drinkers. You never drink and you are never punished. Holy Nova adds a tenth of the target to the tally, and your blessing turns one wheel punishment into SAFE for the rest of the night.',
  drinker:   'You are a DRINKER. No tricks, no secret powers, just loyalty to the group and a thirst for victory. Keep the beers flowing, keep your eyes open, and watch for anyone hiding drinks or pouring them away. Unmask the Saboteurs.',
};

// ---------- drink levels: beers logged on your own phone make powers stronger ----------
// Level 1 is pacified: no role has an active power until Level 2. The server decides the level (it is also capped at
// games finished + 1 until the last 2 hours), so the client never works it out from beers: it reads players[].level.
export type Level = 1 | 2 | 3 | 4;
/** Beers each level needs (L1..L4). */
export const LEVEL_BEERS: readonly number[] = [0, 3, 6, 9];
/** Only for a server that doesn't send `level` yet: the uncapped level from beers. */
const levelFromBeers = (beers: number): Level => (beers >= 9 ? 4 : beers >= 6 ? 3 : beers >= 3 ? 2 : 1);
/** A player's drink level (public). */
export const levelOf = (p: Pick<Player, 'beers' | 'level'>): Level => p.level ?? levelFromBeers(p.beers);

/** What each level gives (L1..L4; null = the role doesn't scale). Knife holders use the Intruder row. */
export const PERKS: Partial<Record<Role, [string, string, string, string]>> = {
  medic:     ['No powers yet', '1 heal', '2 heals', 'SURGEON: one self-heal, and your heals can\'t be forged'],
  detective: ['No powers yet', 'Investigate: each reading covers 3 people', 'Sharper: readings cover 2 people', 'JUDGE DREDD: readings cover 2, plus a Walk of Shame once per game'],
  davyjones: ['No powers yet', 'The Locker: 15 minutes, once per game', 'The Locker, once per game', 'THE KRAKEN: the Locker, plus Walk the Plank'],
  intruder:  ['No powers yet: slow the room down. Talk them out of the next beer.', 'The Hit: name the exact role', 'A miss still tells you if they\'re a Drinker', 'The BOMB: a hot potato passed phone to phone, once per game'],
  betrayer:  ['No powers yet', '2 accusations', '3 accusations', '3 accusations + a hint: the Intruder is one of 3 names'],
  skank:     ['Each beer counts ×2 (secret)', 'Each beer counts ×2', 'Each beer counts ×2, plus Aaron\'s Plate once per game', 'THE GOBSHITE: each beer counts ×3'],
  forger:    ['No powers yet', 'Frame a player', 'Frame a player, forge a heal', 'OATHBREAKER: plus Forged Orders once per game (move a waiting punishment)'],
  jester:    ['Revenge if convicted', 'Revenge if convicted', 'Revenge if convicted', 'PENNYWISE: plus Jack-in-the-Box once per game'],
  assassin:  ['No powers yet', 'Dodge, once per game', 'Dodge, once per game', 'NINJA: a shuriken nobody can dodge, once per game'],
  scrooge:   ['No powers yet', '1 re-spin, 1 swap', '2 re-spins, 1 swap, wheel graffiti', '3 re-spins, 2 swaps, plus Penny Drop'],
  drinker:   ['No powers. Just drink.', '+5 caps', '+5 caps', '+5 caps'],
};

/** Level 4 names (the Assassin's Ninja included). */
export const EVOLVED = {
  surgeon: 'SURGEON', dredd: 'JUDGE DREDD', ninja: 'NINJA', kraken: 'THE KRAKEN',
  gobshite: 'THE GOBSHITE', pennywise: 'PENNYWISE', oathbreaker: 'OATHBREAKER',
} as const;
export type Evolution = keyof typeof EVOLVED;
