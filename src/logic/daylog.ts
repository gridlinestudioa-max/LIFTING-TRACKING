// One day across the whole app, for the Home calendar: cardio planned and done, lifting scheduled and
// done, food eaten, calories in and out, and the body log. Works for past days, today and future days.
// Pure logic, no React.

import { coutFor } from './burn';
import { cinFor, net, onTarget } from './calories';
import { dayStatus, plannedOn, type CardioSession, type CardioType, type PlannedWorkout } from './cardio';
import { fmt } from './format';
import { scheduledRoutine, type Routine, type Workout } from './lifting';
import { sumTotals, type FoodEntry, type Totals } from './nutrition';
import { METERS_PER_MILE } from './plans';
import type { DayInfo, TrackerState } from './types';

/** Green: done. Red: missed. Amber: part done. Grey: still to do, or skipped. */
export type DayMark = 'done' | 'missed' | 'partial' | 'planned' | 'skipped';

export const SHORT_SPORT: Record<CardioType, string> = {
  run: 'Run', bike: 'Ride', swim: 'Swim', walk: 'Walk', hike: 'Hike', row: 'Row', elliptical: 'Ellip', other: 'Cardio',
};

export interface DayCardio {
  planned: PlannedWorkout[];
  sessions: CardioSession[];
  mark: DayMark | null;
  /** "Run 5", "Ride 20", "Swim 750": what was done, else what's planned. */
  label: string | null;
}

export interface DayLift {
  routine: Routine | null;
  workout: Workout | null;
  mark: DayMark | null;
  /** The workout or routine name. */
  label: string | null;
}

export interface DayLog {
  s: string;
  cardio: DayCardio | null;
  lift: DayLift | null;
  food: { totals: Totals; entries: FoodEntry[] } | null;
  cin: number | null;
  cout: number | null;
  /** Deficit (positive) or surplus (negative) when both are known. */
  net: number | null;
  info: DayInfo;
}

const amount = (type: CardioType, miles: number) => (type === 'swim' ? fmt(Math.round(miles * METERS_PER_MILE)) : fmt(Math.round(miles * 10) / 10));

function cardioDay(state: TrackerState, s: string, today: string): DayCardio {
  const c = state.cardio;
  const planned = plannedOn(c.plan, s);
  const sessions = c.sessions.filter((x) => x.date === s);
  const st = dayStatus(c, s, today);
  let mark: DayMark | null =
    st === 'done' || st === 'moved' ? 'done' : st === 'missed' ? 'missed' : st === 'partial' ? 'partial' : st === 'skipped' ? 'skipped' : st === 'open' ? 'planned' : null;
  if (!mark && sessions.length) mark = 'done';
  // Logged anything on a day with a plan still open (later today): show it as done.
  if (mark === 'planned' && sessions.length && s <= today) mark = 'done';
  let label: string | null = null;
  if (sessions.length) {
    const x = sessions[0];
    const miles = sessions.filter((y) => y.type === x.type).reduce((t, y) => t + (y.miles ?? 0), 0);
    label = miles > 0 ? `${SHORT_SPORT[x.type]} ${amount(x.type, miles)}` : SHORT_SPORT[x.type];
  } else if (planned.length) {
    const p = planned[0];
    label = p.race ? 'Race' : `${SHORT_SPORT[p.sport]} ${amount(p.sport, p.miles)}`;
  }
  return { planned, sessions, mark, label };
}

/** Lifting on one day: the routine scheduled, the workout logged, and whether it was done. */
export function liftDay(state: TrackerState, s: string, today: string, since: string | null): DayLift {
  const l = state.lifting;
  const routine = scheduledRoutine(l, s);
  const workout = l.workouts.find((w) => w.date === s && w.done) ?? l.workouts.find((w) => w.date === s) ?? null;
  let mark: DayMark | null = null;
  if (workout?.done) mark = 'done';
  else if (workout) mark = 'planned';
  // A scheduled day counts as missed only once lifting is under way, so days before you started aren't red.
  else if (routine) mark = s < today ? (since && s >= since ? 'missed' : null) : 'planned';
  const label = workout?.name ?? (mark ? (routine?.name ?? null) : null);
  return { routine, workout, mark, label };
}

/** Everything about one day. Sections that are switched off come back null. */
export function dayLog(state: TrackerState, s: string, today: string, liftSince?: string | null): DayLog {
  const on = state.settings.sections;
  const since = liftSince !== undefined ? liftSince : firstWorkout(state);
  const entries = state.meals[s] ?? [];
  const cin = on.food ? cinFor(state, s) : null;
  const cout = coutFor(state, s, today);
  return {
    s,
    cardio: on.cardio ? cardioDay(state, s, today) : null,
    lift: on.lifting ? liftDay(state, s, today, since) : null,
    food: on.food && entries.length ? { totals: sumTotals(entries), entries } : null,
    cin,
    cout,
    net: cin != null && cout != null ? net(cin, cout) : null,
    info: state.days[s] ?? {},
  };
}

/** The first day a workout was logged, or null. */
export function firstWorkout(state: TrackerState): string | null {
  let first: string | null = null;
  for (const w of state.lifting.workouts) if (!first || w.date < first) first = w.date;
  return first;
}

/**
 * How a day went, all things considered: every planned workout done (and the calorie target hit, when
 * there is one and the day is over) is 'all'; some of it is 'some'; none of it on a past day is 'missed'.
 * Today and future days with something to do are 'planned' until it's done. Nothing planned is 'rest'.
 */
export type DayResult = 'all' | 'some' | 'missed' | 'planned' | 'rest';

export interface DayProgress {
  /** Things to do that day: each workout, plus the calorie target once the day is over. */
  total: number;
  done: number;
  result: DayResult;
}

/**
 * How a day went. Workouts planned (or done) count, and so does food: from the first day you logged
 * calories, each day up to today needs calories in and out logged, and on target when you have one. So
 * a day is only "all done" when every part of it is.
 */
export function dayProgress(d: DayLog, today: string, food: { target: number | null; since: string | null } | null): DayProgress {
  let total = 0;
  let done = 0;
  let partial = false;
  for (const m of [d.cardio?.mark ?? null, d.lift?.mark ?? null]) {
    if (!m || m === 'skipped') continue;
    total++;
    if (m === 'done') done++;
    if (m === 'partial') partial = true;
  }
  // Food counts once you've started logging it, and only for days that have begun.
  if (food && food.since != null && d.s >= food.since && d.s <= today) {
    total++;
    if (d.net != null && (food.target == null || onTarget(d.net, food.target))) done++;
  }
  let result: DayResult;
  if (!total) result = 'rest';
  else if (done === total) result = 'all';
  else if (done > 0 || partial) result = 'some';
  else result = d.s >= today ? 'planned' : 'missed';
  return { total, done, result };
}
