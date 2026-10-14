// Training stats in the style of Strava's: totals by period, averages, records and best efforts for cardio,
// and the lifting equivalents (workouts, sets, time, personal records). Pure logic, no React.

import { sessionBurn, workoutMinutes } from './burn';
import type { CardioData, CardioSession, CardioType } from './cardio';
import { addDays, mondayOf } from './dates';
import type { LiftingData, Unit, Workout } from './lifting';
import { ageOf, type Profile } from './profile';

// ---------- Lifting ----------

export function setsDone(w: Workout): number {
  return w.exercises.reduce((t, x) => t + x.sets.filter((s) => s.done).length, 0);
}

export function repsDone(w: Workout): number {
  return w.exercises.reduce((t, x) => t + x.sets.filter((s) => s.done).reduce((r, s) => r + (s.reps ?? 0), 0), 0);
}

/** "5 exercises · 18 sets · 52 min". */
export function workoutLine(w: Workout): string {
  const n = w.exercises.filter((x) => x.sets.some((s) => s.done)).length;
  const sets = setsDone(w);
  const mins = workoutMinutes(w);
  return [`${n} exercise${n === 1 ? '' : 's'}`, `${sets} set${sets === 1 ? '' : 's'}`, mins ? `${mins} min` : null].filter(Boolean).join(' · ');
}

/** Estimated one-rep max (Epley). Only sets of 1 to 12 reps give a fair estimate. */
export function e1rm(weight: number, reps: number): number {
  return reps === 1 ? weight : weight * (1 + reps / 30);
}

export interface BestSet {
  date: string;
  w: number;
  reps: number;
  e1rm: number;
}

/** The best set (highest estimated 1RM) of each finished workout that had the exercise, oldest first. */
export function bestSets(l: LiftingData, exId: string): BestSet[] {
  const out: BestSet[] = [];
  for (const wk of l.workouts.filter((x) => x.done).sort((a, b) => a.date.localeCompare(b.date))) {
    let best: BestSet | null = null;
    for (const x of wk.exercises.filter((e) => e.exId === exId)) {
      for (const s of x.sets) {
        if (!s.done || !s.w || !s.reps || s.reps > 12) continue;
        const est = e1rm(s.w, s.reps);
        if (!best || est > best.e1rm) best = { date: wk.date, w: s.w, reps: s.reps, e1rm: est };
      }
    }
    if (best) out.push(best);
  }
  return out;
}

export interface LiftRecord {
  exId: string;
  name: string;
  unit: Unit;
  /** Best set ever. */
  best: BestSet;
  /** Latest workout's best set. */
  last: BestSet;
  /** Estimated 1RM change from the first workout to the latest. */
  change: number;
  sessions: number;
  /** Estimated 1RM by workout, for a trend line. */
  trend: number[];
}

/** Each exercise you've lifted with weight: best set, latest, and how much the estimated max has moved. */
export function liftRecords(l: LiftingData): LiftRecord[] {
  const names = new Map<string, { name: string; unit: Unit }>();
  for (const w of l.workouts.filter((x) => x.done)) for (const x of w.exercises) names.set(x.exId, { name: x.name, unit: x.unit });
  const order = [...new Set([...l.routines.flatMap((r) => r.items.map((i) => i.exId)), ...names.keys()])];
  const out: LiftRecord[] = [];
  for (const exId of order) {
    const hist = bestSets(l, exId);
    const meta = names.get(exId);
    if (!hist.length || !meta) continue;
    const best = hist.reduce((a, b) => (b.e1rm > a.e1rm ? b : a));
    out.push({
      exId,
      name: meta.name,
      unit: meta.unit,
      best,
      last: hist[hist.length - 1],
      change: hist[hist.length - 1].e1rm - hist[0].e1rm,
      sessions: hist.length,
      trend: hist.map((h) => Math.round(h.e1rm)),
    });
  }
  return out;
}

/** Personal records set in the last `days` days: a new best estimated max for an exercise. */
export function recentPRs(l: LiftingData, today: string, days = 28): { name: string; date: string; set: BestSet; unit: Unit }[] {
  const from = addDays(today, -days + 1);
  const out: { name: string; date: string; set: BestSet; unit: Unit }[] = [];
  for (const r of liftRecords(l)) {
    const hist = bestSets(l, r.exId);
    let top = 0;
    for (const h of hist) {
      if (h.e1rm > top) {
        if (top > 0 && h.date >= from) out.push({ name: r.name, date: h.date, set: h, unit: r.unit });
        top = h.e1rm;
      }
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

export interface LiftSummary {
  total: number;
  last4: number;
  thisWeek: number;
  /** Average workouts a week over the last 12 weeks. */
  perWeek: number;
  /** Weeks in a row (ending this week or last) with at least one workout. */
  streak: number;
  sets: number;
  reps: number;
  /** Average minutes a workout. */
  avgMins: number;
  /** Workouts in each of the last 12 weeks, oldest first. */
  weeks: { start: string; n: number }[];
}

export function liftSummary(l: LiftingData, today: string): LiftSummary {
  const done = l.workouts.filter((w) => w.done);
  const monday = mondayOf(today);
  const weeks = Array.from({ length: 12 }, (_, i) => {
    const start = addDays(monday, -7 * (11 - i));
    const end = addDays(start, 6);
    return { start, n: done.filter((w) => w.date >= start && w.date <= end).length };
  });
  let streak = 0;
  // This week still counts as "in a row" before its first workout.
  const byWeek = [...weeks].reverse();
  for (let i = 0; i < byWeek.length; i++) {
    if (byWeek[i].n > 0) streak++;
    else if (i > 0) break;
  }
  const mins = done.map(workoutMinutes).filter((m) => m > 0);
  return {
    total: done.length,
    last4: done.filter((w) => w.date > addDays(today, -28) && w.date <= today).length,
    thisWeek: weeks[11].n,
    perWeek: weeks.reduce((t, w) => t + w.n, 0) / 12,
    streak,
    sets: done.reduce((t, w) => t + setsDone(w), 0),
    reps: done.reduce((t, w) => t + repsDone(w), 0),
    avgMins: mins.length ? Math.round(mins.reduce((a, b) => a + b, 0) / mins.length) : 0,
    weeks,
  };
}

// ---------- Cardio ----------

export type SportGroup = 'run' | 'bike' | 'swim' | 'walk' | 'other';

export const SPORT_GROUPS: { id: SportGroup; label: string; types: CardioType[] }[] = [
  { id: 'run', label: 'Run', types: ['run'] },
  { id: 'bike', label: 'Ride', types: ['bike'] },
  { id: 'swim', label: 'Swim', types: ['swim'] },
  { id: 'walk', label: 'Walk and hike', types: ['walk', 'hike'] },
  { id: 'other', label: 'Other', types: ['row', 'elliptical', 'other'] },
];

export function groupOf(t: CardioType): SportGroup {
  return SPORT_GROUPS.find((g) => g.types.includes(t))!.id;
}

export interface CardioTotals {
  count: number;
  miles: number;
  secs: number;
  elevFt: number;
  kcal: number;
}

function totals(xs: CardioSession[], profile: Profile | null, today: string): CardioTotals {
  const age = ageOf(profile, today);
  const body = profile?.sex && age != null && profile.heightIn && profile.weightLb
    ? { sex: profile.sex, age, heightIn: profile.heightIn, weightLb: profile.weightLb, bodyFat: profile.bodyFat }
    : null;
  return xs.reduce<CardioTotals>(
    (t, x) => ({
      count: t.count + 1,
      miles: t.miles + (x.miles ?? 0),
      secs: t.secs + (x.secs ?? 0),
      elevFt: t.elevFt + (x.elevFt ?? 0),
      kcal: t.kcal + (x.kcal ?? (body ? (sessionBurn(x, body) ?? 0) : 0)),
    }),
    { count: 0, miles: 0, secs: 0, elevFt: 0, kcal: 0 },
  );
}

/** Seconds a mile from sessions with both distance and time. Null without any. */
export function avgPace(xs: CardioSession[]): number | null {
  const timed = xs.filter((x) => x.miles && x.secs);
  const mi = timed.reduce((t, x) => t + x.miles!, 0);
  return mi > 0 ? timed.reduce((t, x) => t + x.secs!, 0) / mi : null;
}

/** Common race distances, in miles, for best efforts. */
export const EFFORTS: { label: string; miles: number }[] = [
  { label: '1 mile', miles: 1 },
  { label: '5K', miles: 3.10686 },
  { label: '10K', miles: 6.21371 },
  { label: 'Half marathon', miles: 13.1094 },
  { label: 'Marathon', miles: 26.2188 },
];

export interface CardioReport {
  sessions: CardioSession[];
  week: CardioTotals;
  month: CardioTotals;
  year: CardioTotals;
  all: CardioTotals;
  /** Averages over all sessions of the sport. */
  avgMiles: number | null;
  avgSecs: number | null;
  /** Seconds a mile. */
  avgPace: number | null;
  avgHr: number | null;
  longest: CardioSession | null;
  fastest: CardioSession | null;
  biggestClimb: CardioSession | null;
  /** Projected time at each distance from your fastest pace over at least that far (whole sessions, not splits). */
  efforts: { label: string; secs: number; date: string }[];
  /** Miles a week, last 12 weeks, oldest first. */
  weeks: { start: string; miles: number; secs: number; count: number }[];
}

/** Everything for one sport (or all of them): Strava's profile stats, from logged sessions. */
export function cardioReport(c: CardioData, profile: Profile | null, today: string, group: SportGroup | 'all'): CardioReport {
  const xs = c.sessions
    .filter((x) => x.date <= today && (group === 'all' || groupOf(x.type) === group))
    .sort((a, b) => b.date.localeCompare(a.date));
  const monday = mondayOf(today);
  const month = today.slice(0, 7);
  const year = today.slice(0, 4);
  const withMiles = xs.filter((x) => x.miles);
  const withSecs = xs.filter((x) => x.secs);
  const withHr = xs.filter((x) => x.hr);
  const timed = xs.filter((x) => x.miles && x.secs);
  const pace = (x: CardioSession) => x.secs! / x.miles!;
  const efforts =
    group === 'run'
      ? EFFORTS.map((e) => {
          const fits = timed.filter((x) => x.miles! >= e.miles * 0.98);
          if (!fits.length) return null;
          const best = fits.reduce((a, b) => (pace(b) < pace(a) ? b : a));
          return { label: e.label, secs: pace(best) * e.miles, date: best.date };
        }).filter((e): e is { label: string; secs: number; date: string } => !!e)
      : [];
  const weeks = Array.from({ length: 12 }, (_, i) => {
    const start = addDays(monday, -7 * (11 - i));
    const end = addDays(start, 6);
    const w = xs.filter((x) => x.date >= start && x.date <= end);
    return { start, miles: w.reduce((t, x) => t + (x.miles ?? 0), 0), secs: w.reduce((t, x) => t + (x.secs ?? 0), 0), count: w.length };
  });
  return {
    sessions: xs,
    week: totals(xs.filter((x) => x.date >= monday), profile, today),
    month: totals(xs.filter((x) => x.date.startsWith(month)), profile, today),
    year: totals(xs.filter((x) => x.date.startsWith(year)), profile, today),
    all: totals(xs, profile, today),
    avgMiles: withMiles.length ? withMiles.reduce((t, x) => t + x.miles!, 0) / withMiles.length : null,
    avgSecs: withSecs.length ? withSecs.reduce((t, x) => t + x.secs!, 0) / withSecs.length : null,
    avgPace: avgPace(xs),
    avgHr: withHr.length ? Math.round(withHr.reduce((t, x) => t + x.hr!, 0) / withHr.length) : null,
    longest: withMiles.length ? withMiles.reduce((a, b) => (b.miles! > a.miles! ? b : a)) : null,
    fastest: timed.length ? timed.reduce((a, b) => (pace(b) < pace(a) ? b : a)) : null,
    biggestClimb: xs.filter((x) => x.elevFt).reduce<CardioSession | null>((a, b) => (!a || b.elevFt! > a.elevFt! ? b : a), null),
    efforts,
    weeks,
  };
}
