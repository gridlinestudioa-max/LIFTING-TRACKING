// Friends and their leaderboard. What each person shares is a small summary of what they choose:
// cardio (totals and bests by sport), lifting (workout counts and top lifts) and food (daily averages).
// Never routes, notes, single meals, weight or anything else. Phone numbers are matched by a one-way
// hash, so the server never stores the number itself. Pure logic, no React.

import { kDays } from './calories';
import type { CardioData } from './cardio';
import { addDays, mondayOf } from './dates';
import { sumTotals } from './nutrition';
import { METERS_PER_MILE } from './plans';
import type { BoardSport } from './records';
import { liftRecords, liftSummary } from './stats';
import type { TrackerState } from './types';

/** What a person shares with friends. Cardio is on by default (it feeds the leaderboard). */
export interface Sharing {
  cardio: boolean;
  lifting: boolean;
  food: boolean;
}

export const DEFAULT_SHARING: Sharing = { cardio: true, lifting: false, food: false };

export function normalizeSharing(v: unknown): Sharing {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const pick = (k: keyof Sharing) => (typeof o[k] === 'boolean' ? (o[k] as boolean) : DEFAULT_SHARING[k]);
  return { cardio: pick('cardio'), lifting: pick('lifting'), food: pick('food') };
}

/**
 * A phone number in international form ("+15551234567"), or null. Numbers without a country code are
 * read as US/Canada when they have 10 digits.
 */
export function normalizePhone(raw: string): string | null {
  const t = raw.trim();
  let d = t.replace(/\D/g, '');
  if (t.startsWith('00')) d = d.slice(2);
  else if (!t.startsWith('+')) {
    if (d.length === 10) d = `1${d}`;
    else if (!(d.length === 11 && d.startsWith('1'))) return null;
  }
  return d.length >= 8 && d.length <= 15 ? `+${d}` : null;
}

/** What gets hashed for a number, so other apps' hashes of the same number don't match ours. */
export const phoneHashInput = (e164: string) => `training-tracker:phone:${e164}`;

export interface SportSummary {
  /** Miles this week (since `week`), this month and this year. */
  weekMi: number;
  weekN: number;
  weekSecs: number;
  monthMi: number;
  yearMi: number;
  /** Longest session ever, miles. */
  longest: number;
  /** Fastest: seconds for a 5K (run), average mph (ride), seconds per 100 m (swim). Null without one. */
  best: number | null;
}

export interface BoardSummary {
  v: 1;
  /** The Monday the week totals started. */
  week: string;
  month: string;
  year: string;
  /** Cardio by sport, when shared. */
  run?: SportSummary;
  bike?: SportSummary;
  swim?: SportSummary;
  lifting?: LiftShare;
  food?: FoodShare;
}

export interface LiftShare {
  weekN: number;
  monthN: number;
  total: number;
  /** Weeks in a row with a workout. */
  streak: number;
  /** Best estimated one-rep max for up to 5 lifts, heaviest first. */
  top: { name: string; e1rm: number; unit: 'lb' | 'plates' }[];
}

export interface FoodShare {
  /** Of the last 7 days, how many have food logged. */
  days: number;
  /** Averages over those days; null without any. */
  kcal: number | null;
  protein: number | null;
  /** Average deficit (positive) or surplus (negative) over the last 7 days with calories in and out. */
  deficit: number | null;
}

/** Workout counts and top lifts to share. */
export function liftShare(state: TrackerState, today: string): LiftShare {
  const s = liftSummary(state.lifting, today);
  const top = liftRecords(state.lifting)
    .map((r) => ({ name: r.name.slice(0, 40), e1rm: Math.round(r.best.e1rm), unit: r.unit }))
    .sort((a, b) => b.e1rm - a.e1rm)
    .slice(0, 5);
  const month = today.slice(0, 7);
  return {
    weekN: s.thisWeek,
    monthN: state.lifting.workouts.filter((w) => w.done && w.date.startsWith(month) && w.date <= today).length,
    total: s.total,
    streak: s.streak,
    top,
  };
}

/** Food averages over the last 7 days to share. */
export function foodShare(state: TrackerState, today: string): FoodShare {
  const from = addDays(today, -6);
  const days = Object.entries(state.meals).filter(([d, list]) => d >= from && d <= today && list.length);
  const tot = days.map(([, list]) => sumTotals(list));
  const avg = (f: (t: (typeof tot)[number]) => number) => (tot.length ? Math.round(tot.reduce((a, t) => a + f(t), 0) / tot.length) : null);
  const k = kDays(state).filter((d) => d.s >= from && d.s <= today);
  return {
    days: days.length,
    kcal: avg((t) => t.kcal),
    protein: avg((t) => t.protein),
    deficit: k.length ? Math.round(k.reduce((a, d) => a + d.net, 0) / k.length) : null,
  };
}

/** Everything this person chose to share, as of today. */
export function shareSummary(state: TrackerState, today: string, share: Sharing): BoardSummary {
  const base = boardSummary(state.cardio, today);
  const out: BoardSummary = { v: 1, week: base.week, month: base.month, year: base.year };
  if (share.cardio) Object.assign(out, { run: base.run, bike: base.bike, swim: base.swim });
  if (share.lifting) out.lifting = liftShare(state, today);
  if (share.food) out.food = foodShare(state, today);
  return out;
}

const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

/** The summary to share with friends. */
export function boardSummary(c: CardioData, today: string): Required<Pick<BoardSummary, 'run' | 'bike' | 'swim'>> & BoardSummary {
  const week = mondayOf(today);
  const month = today.slice(0, 7);
  const year = today.slice(0, 4);
  const sport = (s: BoardSport): SportSummary => {
    const xs = c.sessions.filter((x) => x.type === s && x.date <= today);
    const wk = xs.filter((x) => x.date >= week);
    const mi = (list: typeof xs) => round(list.reduce((t, x) => t + (x.miles ?? 0), 0));
    const timed = xs.filter((x) => x.miles && x.secs);
    let best: number | null = null;
    if (s === 'run') {
      const k5 = 5000 / METERS_PER_MILE;
      const fits = timed.filter((x) => x.miles! >= k5 * 0.98).map((x) => (x.secs! / x.miles!) * k5);
      best = fits.length ? Math.round(Math.min(...fits)) : null;
    } else if (s === 'bike') {
      const fits = timed.filter((x) => x.miles! >= 5).map((x) => x.miles! / (x.secs! / 3600));
      best = fits.length ? round(Math.max(...fits), 1) : null;
    } else {
      const m100 = 100 / METERS_PER_MILE;
      const fits = timed.filter((x) => x.miles! >= m100 * 2 * 0.98).map((x) => (x.secs! / x.miles!) * m100);
      best = fits.length ? Math.round(Math.min(...fits)) : null;
    }
    return {
      weekMi: mi(wk),
      weekN: wk.length,
      weekSecs: wk.reduce((t, x) => t + (x.secs ?? 0), 0),
      monthMi: mi(xs.filter((x) => x.date.startsWith(month))),
      yearMi: mi(xs.filter((x) => x.date.startsWith(year))),
      longest: round(Math.max(0, ...xs.map((x) => x.miles ?? 0))),
      best,
    };
  };
  return { v: 1, week, month, year, run: sport('run'), bike: sport('bike'), swim: sport('swim') };
}

export type BoardMetric = 'week' | 'month' | 'year' | 'longest' | 'best';

export const BOARD_METRICS: { id: BoardMetric; label: string }[] = [
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: 'year', label: 'This year' },
  { id: 'longest', label: 'Longest' },
  { id: 'best', label: 'Fastest' },
];

/** What "Fastest" means for each sport. */
export const BEST_LABEL: Record<BoardSport, string> = { run: '5K time', bike: 'Average speed (5 mi+)', swim: 'Pace per 100 m' };

/** Lower is better for fastest runs and swims (times); higher for rides (speed). */
export const bestLowerIsBetter = (s: BoardSport) => s !== 'bike';

/** Checks a summary from the server. Old or broken ones read as null. */
export function readSummary(v: unknown): BoardSummary | null {
  const o = v as BoardSummary | null;
  if (!o || o.v !== 1 || typeof o.week !== 'string') return null;
  return o;
}

/** A person's number for a metric, as of today: totals from an earlier week/month/year count as 0. */
export function metricValue(s: BoardSummary, sport: BoardSport, m: BoardMetric, today: string): number | null {
  const x = s[sport];
  if (!x) return null;
  switch (m) {
    case 'week':
      return s.week === mondayOf(today) ? x.weekMi : 0;
    case 'month':
      return s.month === today.slice(0, 7) ? x.monthMi : 0;
    case 'year':
      return s.year === today.slice(0, 4) ? x.yearMi : 0;
    case 'longest':
      return x.longest;
    case 'best':
      return x.best;
  }
}

export interface BoardPerson {
  id: string;
  name: string;
  me: boolean;
  summary: BoardSummary | null;
}

/** People ranked for a sport and metric. Ties share a rank; people with nothing for "Fastest" go last, unranked. */
export function rankBoard(people: BoardPerson[], sport: BoardSport, m: BoardMetric, today: string): { p: BoardPerson; value: number | null; rank: number | null }[] {
  const low = m === 'best' && bestLowerIsBetter(sport);
  const rows = people.map((p) => {
    const v = p.summary ? metricValue(p.summary, sport, m, today) : null;
    return { p, value: v != null && (m !== 'best' || v > 0) ? v : null };
  });
  const ranked = rows.filter((r) => r.value != null).sort((a, b) => (low ? a.value! - b.value! : b.value! - a.value!) || a.p.name.localeCompare(b.p.name));
  const out = ranked.map((r, i) => ({ ...r, rank: i }));
  for (let i = 1; i < out.length; i++) if (out[i].value === out[i - 1].value) out[i].rank = out[i - 1].rank;
  return [
    ...out.map((r) => ({ ...r, rank: r.rank + 1 })),
    ...rows.filter((r) => r.value == null).map((r) => ({ ...r, rank: null })),
  ];
}
