// Effort: one number for how hard a cardio session was, and a fitness / fatigue trend built from it.
// These are our own estimates in the spirit of Strava's Relative Effort and Fitness graph (whose formulas
// aren't published), not copies of them. Pure logic, no React.
//
// Method:
// - With an average heart rate: the idea behind Edwards' TRIMP. Minutes are weighted by how hard the heart was
//   working, from 1 (about half of max heart rate) up to 5 (max). It uses the session's average, so it's coarser
//   than time-in-zone.
// - Without one: how hard it felt, 1 to 10 ("session RPE", Foster et al., 2001), mapped onto the same 1 to 5 weights.
// - With neither: a typical weight for the sport, so the session still counts a little.
// - Fitness and fatigue: exponentially weighted averages of daily effort over 42 and 7 days (the Banister
//   impulse-response model that most training apps build on).
// Max heart rate comes from age (Tanaka et al., 2001: 208 - 0.7 x age), raised to the highest max you've logged.

import type { CardioData, CardioSession, CardioType } from './cardio';
import { addDays, mondayOf } from './dates';
import { ageOf, type Profile } from './profile';

export type EffortBasis = 'hr' | 'rpe' | 'time';

export interface Effort {
  /** Effort points: roughly minutes weighted by intensity, so an hour at a steady pace is about 150 to 200. */
  score: number;
  basis: EffortBasis;
}

/** Typical intensity weight when all we know is the sport. */
const TYPE_WEIGHT: Record<CardioType, number> = { walk: 1.5, hike: 2.5, run: 3, bike: 2.5, swim: 3, row: 3, elliptical: 2.5, other: 2 };

/** Used when there's no age to estimate from. */
const DEFAULT_MAX_HR = 190;
/** A logged "max heart rate" above this is more likely a sensor glitch than a real maximum. */
const MAX_PLAUSIBLE_HR = 220;

/** Intensity weight, 1 to 5, from an average heart rate as a share of max: 50% is 1, each further 10% adds 1, 90% and up is 5. */
export function hrWeight(hr: number, maxHr: number): number {
  return Math.min(5, Math.max(1, 1 + (hr / maxHr - 0.5) / 0.1));
}

/** Estimated max heart rate: from age when known, raised to the highest max heart rate you've logged. */
export function maxHrFor(profile: Profile | null, c: CardioData, today: string): number {
  const age = ageOf(profile, today);
  const est = age != null && age > 0 ? 208 - 0.7 * age : DEFAULT_MAX_HR;
  const seen = c.sessions.reduce((m, x) => (x.maxHr && x.maxHr <= MAX_PLAUSIBLE_HR ? Math.max(m, x.maxHr) : m), 0);
  return Math.max(est, seen);
}

/** The effort of one session, or null when there's no time to base it on. */
export function sessionEffort(x: CardioSession, maxHr: number): Effort | null {
  if (!x.secs || x.secs <= 0) return null;
  const mins = x.secs / 60;
  if (x.hr) return { score: Math.round(mins * hrWeight(x.hr, maxHr)), basis: 'hr' };
  if (x.rpe) return { score: Math.round(mins * (x.rpe / 2)), basis: 'rpe' };
  return { score: Math.round(mins * TYPE_WEIGHT[x.type]), basis: 'time' };
}

/** Total effort for each date that has any. */
export function dailyEffort(c: CardioData, profile: Profile | null, today: string): Map<string, number> {
  const maxHr = maxHrFor(profile, c, today);
  const out = new Map<string, number>();
  for (const x of c.sessions) {
    if (x.date > today) continue;
    const e = sessionEffort(x, maxHr);
    if (e) out.set(x.date, (out.get(x.date) ?? 0) + e.score);
  }
  return out;
}

/** Effort for each of the last `weeks` weeks (Monday to Sunday), oldest first. */
export function weeklyEffort(c: CardioData, profile: Profile | null, today: string, weeks = 12): { start: string; effort: number }[] {
  const per = dailyEffort(c, profile, today);
  const monday = mondayOf(today);
  return Array.from({ length: weeks }, (_, i) => {
    const start = addDays(monday, -7 * (weeks - 1 - i));
    let effort = 0;
    for (let d = 0; d < 7; d++) effort += per.get(addDays(start, d)) ?? 0;
    return { start, effort };
  });
}

// ---------- Fitness and fatigue ----------

export interface LoadDay {
  s: string;
  effort: number;
  /** Long-term load: effort averaged over about 6 weeks. Rises slowly with steady training. */
  fitness: number;
  /** Short-term load: effort averaged over about a week. Jumps after hard weeks. */
  fatigue: number;
}

const K_FITNESS = 1 - Math.exp(-1 / 42);
const K_FATIGUE = 1 - Math.exp(-1 / 7);
/** How far back to start warming the averages up. */
const WARMUP_DAYS = 420;

/** Daily effort, fitness and fatigue for the last `days` days, ending today. Empty without any timed sessions. */
export function trainingLoad(c: CardioData, profile: Profile | null, today: string, days = 84): LoadDay[] {
  const per = dailyEffort(c, profile, today);
  if (!per.size) return [];
  const first = [...per.keys()].sort()[0];
  const floor = addDays(today, -WARMUP_DAYS);
  let fitness = 0;
  let fatigue = 0;
  const out: LoadDay[] = [];
  for (let s = first > floor ? first : floor; s <= today; s = addDays(s, 1)) {
    const effort = per.get(s) ?? 0;
    fitness += (effort - fitness) * K_FITNESS;
    fatigue += (effort - fatigue) * K_FATIGUE;
    out.push({ s, effort, fitness, fatigue });
  }
  return out.slice(-days);
}

export type LoadStatus = 'rested' | 'steady' | 'building' | 'fast';

/** Enough history for the ratio to mean something. */
const MIN_HISTORY_DAYS = 21;
/** Below this the trend is just noise (an hour of easy effort every couple of weeks). */
const MIN_FITNESS = 8;

/**
 * Where this week sits against your recent norm, from the latest day of `trainingLoad`: fatigue over fitness.
 * Null until there are three weeks of history. This is a rough guide to how fast you're ramping up, not medical advice.
 */
export function loadStatus(series: LoadDay[]): { id: LoadStatus; label: string; ratio: number } | null {
  const last = series[series.length - 1];
  if (!last || series.length < MIN_HISTORY_DAYS || last.fitness < MIN_FITNESS) return null;
  const ratio = last.fatigue / last.fitness;
  if (ratio < 0.8) return { id: 'rested', label: 'Lighter than usual', ratio };
  if (ratio <= 1.3) return { id: 'steady', label: 'Steady', ratio };
  if (ratio <= 1.5) return { id: 'building', label: 'Building', ratio };
  return { id: 'fast', label: 'Ramping up fast', ratio };
}
