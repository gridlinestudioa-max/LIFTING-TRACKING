// Personal leaderboard: your top efforts for running, riding, swimming and each lift, ranked, and the
// 1st / 2nd / 3rd place medals each activity holds. Pure logic, no React.
//
// Race-distance times come from the fastest average pace over at least that distance (whole sessions,
// not splits), the same way the stats page projects best efforts. A recorded run's fastest mile split
// counts for the mile.

import type { CardioData, CardioSession } from './cardio';
import type { LiftingData, Unit } from './lifting';
import { METERS_PER_MILE } from './plans';
import { e1rm } from './stats';

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

/** Every effort in each category for a sport, best first. Categories with nothing logged yet are left out. */
function rankedBoards(c: CardioData, sport: BoardSport, today: string): RecordBoard[] {
  const xs = c.sessions.filter((x) => x.type === sport && x.date <= today);
  return SPECS[sport]
    .map((s) => {
      const top = xs
        .map((x) => ({ value: s.value(x), date: x.date, sessionId: x.id }))
        .filter((e): e is RecordEntry => e.value != null && Number.isFinite(e.value) && e.value > 0)
        // Ties go to whoever did it first.
        .sort((a, b) => (s.lowerIsBetter ? a.value - b.value : b.value - a.value) || a.date.localeCompare(b.date));
      return { id: s.id, label: s.label, kind: s.kind, top };
    })
    .filter((b) => b.top.length);
}

/** Your top 5 in each category for a sport. Categories with nothing logged yet are left out. */
export function personalBoard(c: CardioData, sport: BoardSport, today: string): RecordBoard[] {
  return rankedBoards(c, sport, today).map((b) => ({ ...b, top: b.top.slice(0, 5) }));
}

/** Records a session holds right now: #1 in a category with something to beat ("5K", "Longest run"). */
export function recordsSetBy(c: CardioData, x: CardioSession, today: string): string[] {
  if (x.type !== 'run' && x.type !== 'bike' && x.type !== 'swim') return [];
  return personalBoard(c, x.type, today)
    .filter((b) => b.top.length > 1 && b.top[0].sessionId === x.id)
    .map((b) => b.label);
}

// ---------- Medals ----------

/** A place on one of your record lists: 1st, 2nd or 3rd best ever in a category. */
export interface Medal {
  rank: 1 | 2 | 3;
  /** The category: "5K", "Longest run", or a lift's name. */
  label: string;
}

export const ORDINAL = ['1st', '2nd', '3rd'] as const;

/**
 * Hands out medals from best-first lists: the top 3 of each, but only with something below them (your
 * only run isn't a record, and your slower of two isn't 2nd place).
 */
function award(out: Map<string, Medal[]>, label: string, ids: string[]) {
  ids.slice(0, 3).forEach((id, i) => {
    if (ids.length <= i + 1) return;
    out.set(id, [...(out.get(id) ?? []), { rank: (i + 1) as 1 | 2 | 3, label }]);
  });
}

const byRank = (a: Medal, b: Medal) => a.rank - b.rank || a.label.localeCompare(b.label);

/** Medals each run, ride and swim holds right now, by session id, best first. */
export function cardioMedals(c: CardioData, today: string): Map<string, Medal[]> {
  const out = new Map<string, Medal[]>();
  for (const s of BOARD_SPORTS) for (const b of rankedBoards(c, s.id, today)) award(out, b.label, b.top.map((e) => e.sessionId));
  out.forEach((m) => m.sort(byRank));
  return out;
}

/** One workout's best set of an exercise, ranked by estimated one-rep max. */
export interface LiftEntry {
  workoutId: string;
  date: string;
  w: number;
  reps: number;
  e1rm: number;
}

export interface LiftBoard {
  exId: string;
  name: string;
  unit: Unit;
  /** Every workout with the lift, best first. */
  top: LiftEntry[];
}

/** For each lift you've done with weight, every workout's best set, best first (sets of 12 reps or fewer). */
export function liftBoards(l: LiftingData, today: string): LiftBoard[] {
  const boards = new Map<string, LiftBoard>();
  for (const wk of l.workouts) {
    if (!wk.done || wk.date > today) continue;
    for (const ex of wk.exercises) {
      let best: LiftEntry | null = null;
      for (const s of ex.sets) {
        if (!s.done || !s.w || !s.reps || s.reps > 12) continue;
        const est = e1rm(s.w, s.reps);
        if (!best || est > best.e1rm) best = { workoutId: wk.id, date: wk.date, w: s.w, reps: s.reps, e1rm: est };
      }
      if (!best) continue;
      const b = boards.get(ex.exId) ?? { exId: ex.exId, name: ex.name, unit: ex.unit, top: [] };
      // The same lift twice in one workout: keep the better.
      const same = b.top.findIndex((e) => e.workoutId === wk.id);
      if (same < 0) b.top.push(best);
      else if (best.e1rm > b.top[same].e1rm) b.top[same] = best;
      boards.set(ex.exId, b);
    }
  }
  return [...boards.values()]
    .map((b) => ({ ...b, top: b.top.sort((a, x) => x.e1rm - a.e1rm || a.date.localeCompare(x.date)) }))
    .sort((a, b) => b.top.length - a.top.length || a.name.localeCompare(b.name));
}

/** Medals each finished lifting workout holds right now, by workout id, best first. */
export function liftMedals(l: LiftingData, today: string): Map<string, Medal[]> {
  const out = new Map<string, Medal[]>();
  for (const b of liftBoards(l, today)) award(out, b.name, b.top.map((e) => e.workoutId));
  out.forEach((m) => m.sort(byRank));
  return out;
}
