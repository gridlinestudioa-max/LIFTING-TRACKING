// Personal leaderboard: your top efforts for running, riding and swimming, ranked. Pure logic, no React.
//
// Race-distance times come from the fastest average pace over at least that distance (whole sessions,
// not splits), the same way the stats page projects best efforts. A recorded run's fastest mile split
// counts for the mile.

import type { CardioData, CardioSession } from './cardio';
import { METERS_PER_MILE } from './plans';

export type BoardSport = 'run' | 'bike' | 'swim';

export const BOARD_SPORTS: { id: BoardSport; label: string }[] = [
  { id: 'run', label: 'Running' },
  { id: 'bike', label: 'Riding' },
  { id: 'swim', label: 'Swimming' },
];

/** How a record's value reads: a time, a distance in miles (meters for swims), mph, feet, or seconds a mile / 100 m. */
export type RecordKind = 'time' | 'miles' | 'mph' | 'feet' | 'pace' | 'pace100';

export interface RecordEntry {
  value: number;
  date: string;
  sessionId: string;
}

export interface RecordBoard {
  id: string;
  label: string;
  kind: RecordKind;
  /** Best first, up to 5. */
  top: RecordEntry[];
}

const MI = (m: number) => m / METERS_PER_MILE;

interface Spec {
  id: string;
  label: string;
  kind: RecordKind;
  lowerIsBetter: boolean;
  value: (x: CardioSession) => number | null;
}

const pace = (x: CardioSession) => (x.miles && x.secs ? x.secs / x.miles : null);

/** Projected time over `miles` from a session at least that long. */
const effort = (miles: number) => (x: CardioSession) => {
  const p = pace(x);
  return p != null && x.miles! >= miles * 0.98 ? p * miles : null;
};

const longest = (x: CardioSession) => x.miles ?? null;
const longestTime = (x: CardioSession) => x.secs ?? null;
const climb = (x: CardioSession) => x.elevFt ?? null;

const SPECS: Record<BoardSport, Spec[]> = {
  run: [
    {
      id: 'mile', label: 'Fastest mile', kind: 'time', lowerIsBetter: true,
      value: (x) => {
        const split = x.splits?.length ? Math.min(...x.splits) : null;
        const avg = effort(1)(x);
        return split != null && avg != null ? Math.min(split, avg) : (split ?? avg);
      },
    },
    { id: '5k', label: '5K', kind: 'time', lowerIsBetter: true, value: effort(MI(5000)) },
    { id: '10k', label: '10K', kind: 'time', lowerIsBetter: true, value: effort(MI(10000)) },
    { id: 'half', label: 'Half marathon', kind: 'time', lowerIsBetter: true, value: effort(13.1094) },
    { id: 'marathon', label: 'Marathon', kind: 'time', lowerIsBetter: true, value: effort(26.2188) },
    { id: 'longest', label: 'Longest run', kind: 'miles', lowerIsBetter: false, value: longest },
    { id: 'pace', label: 'Fastest pace (1 mi or more)', kind: 'pace', lowerIsBetter: true, value: (x) => (x.miles && x.miles >= 1 ? pace(x) : null) },
    { id: 'climb', label: 'Most climbing', kind: 'feet', lowerIsBetter: false, value: climb },
  ],
  bike: [
    { id: 'longest', label: 'Longest ride', kind: 'miles', lowerIsBetter: false, value: longest },
    {
      id: 'speed', label: 'Fastest average (5 mi or more)', kind: 'mph', lowerIsBetter: false,
      value: (x) => (x.miles && x.secs && x.miles >= 5 ? x.miles / (x.secs / 3600) : null),
    },
    { id: '10mi', label: '10 miles', kind: 'time', lowerIsBetter: true, value: effort(10) },
    { id: '40k', label: '40K', kind: 'time', lowerIsBetter: true, value: effort(MI(40000)) },
    { id: 'century', label: '100 miles', kind: 'time', lowerIsBetter: true, value: effort(100) },
    { id: 'time', label: 'Longest time', kind: 'time', lowerIsBetter: false, value: longestTime },
    { id: 'climb', label: 'Most climbing', kind: 'feet', lowerIsBetter: false, value: climb },
  ],
  swim: [
    { id: '100m', label: '100 m', kind: 'time', lowerIsBetter: true, value: effort(MI(100)) },
    { id: '400m', label: '400 m', kind: 'time', lowerIsBetter: true, value: effort(MI(400)) },
    { id: '1500m', label: '1500 m', kind: 'time', lowerIsBetter: true, value: effort(MI(1500)) },
    { id: 'longest', label: 'Longest swim', kind: 'miles', lowerIsBetter: false, value: longest },
    { id: 'time', label: 'Longest time', kind: 'time', lowerIsBetter: false, value: longestTime },
  ],
};

/** Your top 5 in each category for a sport. Categories with nothing logged yet are left out. */
export function personalBoard(c: CardioData, sport: BoardSport, today: string): RecordBoard[] {
  const xs = c.sessions.filter((x) => x.type === sport && x.date <= today);
  return SPECS[sport]
    .map((s) => {
      const top = xs
        .map((x) => ({ value: s.value(x), date: x.date, sessionId: x.id }))
        .filter((e): e is RecordEntry => e.value != null && Number.isFinite(e.value) && e.value > 0)
        // Ties go to whoever did it first.
        .sort((a, b) => (s.lowerIsBetter ? a.value - b.value : b.value - a.value) || a.date.localeCompare(b.date))
        .slice(0, 5);
      return { id: s.id, label: s.label, kind: s.kind, top };
    })
    .filter((b) => b.top.length);
}

/** Records a session holds right now: #1 in a category with something to beat ("5K", "Longest run"). */
export function recordsSetBy(c: CardioData, x: CardioSession, today: string): string[] {
  if (x.type !== 'run' && x.type !== 'bike' && x.type !== 'swim') return [];
  return personalBoard(c, x.type, today)
    .filter((b) => b.top.length > 1 && b.top[0].sessionId === x.id)
    .map((b) => b.label);
}
