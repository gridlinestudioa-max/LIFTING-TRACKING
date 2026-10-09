import {
  BUMP_EVERY,
  DOW,
  EXERCISE_BY_ID,
  LIFTS,
  LONG,
  PLAN_DAYS,
  RUN_DONE_RATIO,
  TYPES,
  easyMiles,
  tempoMiles,
  type DayType,
  type LiftGroup,
} from './config';
import { addDays, dayDiff } from './dates';
import type { DayLog, TrackerState } from './types';

export interface PlanDay {
  /** 0-based week index. */
  w: number;
  type: DayType;
  miles: number;
  race: boolean;
  /** A different workout done instead of the scheduled one. */
  swapped?: boolean;
  /** The skipped day this workout makes up for. */
  makeupFor?: string;
}

/** Planned miles for a day type in week index w. */
export function milesFor(type: DayType, w: number): number {
  if (type === 'easy') return easyMiles(w);
  if (type === 'tempo') return tempoMiles(w);
  if (type === 'long') return LONG[w];
  return 0;
}

export function planFor(start: string, s: string): PlanDay | null {
  const diff = dayDiff(s, start);
  if (diff < 0 || diff >= PLAN_DAYS) return null;
  const w = Math.floor(diff / 7);
  const type = DOW[diff % 7];
  return { w, type, miles: milesFor(type, w), race: w === LONG.length - 1 && type === 'long' };
}

/**
 * A day's plan once a different workout is swapped in. On a rest day, making up a
 * skipped day uses that day's workout (its week's weights and miles). Otherwise the
 * chosen type in this week; on a workout day this replaces the scheduled workout.
 */
export function planWithSwap(state: TrackerState, base: PlanDay, swap?: DayType | '', makeupFor?: string): PlanDay {
  if (base.type === 'rest' && makeupFor) {
    const op = planFor(state.start, makeupFor);
    if (op && op.type !== 'rest') return { ...op, race: false, swapped: true, makeupFor };
  }
  if (swap && swap !== 'rest' && swap !== base.type) {
    return { w: base.w, type: swap, miles: milesFor(swap, base.w), race: false, swapped: true };
  }
  return base;
}

/** The plan for a day including a submitted swap. */
export function effectivePlan(state: TrackerState, s: string): PlanDay | null {
  const p = planFor(state.start, s);
  if (!p) return null;
  const l = state.logs[s];
  return l && l.submitted ? planWithSwap(state, p, l.swap, l.makeupFor) : p;
}

/** The rest day (submitted) that made up for skipped day s, if any. */
export function madeUpBy(state: TrackerState, s: string): string | null {
  for (const k of Object.keys(state.logs)) {
    const l = state.logs[k];
    if (l.submitted && l.makeupFor === s && planFor(state.start, k)?.type === 'rest') return k;
  }
  return null;
}

/** Skipped workouts within a week either side of rest day s that could be moved to it. */
export function makeupCandidates(state: TrackerState, s: string): { s: string; plan: PlanDay }[] {
  const out: { s: string; plan: PlanDay }[] = [];
  for (let d = -7; d <= 7; d++) {
    if (d === 0) continue;
    const k = addDays(s, d);
    const p = planFor(state.start, k);
    const l = state.logs[k];
    if (!p || p.type === 'rest' || !l || !l.submitted || !l.skipped) continue;
    const by = madeUpBy(state, k);
    if (by && by !== s) continue;
    out.push({ s: k, plan: p });
  }
  return out;
}

export function raceDay(start: string): string {
  return addDays(start, PLAN_DAYS - 1);
}

export function planEnd(start: string): string {
  return addDays(start, PLAN_DAYS - 1);
}

/** Target weight for a lift in week index w: base + inc * floor(w / 3). */
export function targetFor(base: Record<string, number>, id: string, w: number): number {
  const e = EXERCISE_BY_ID[id];
  const b = base[id] ?? e.w;
  return +(b + e.inc * Math.floor(w / BUMP_EVERY)).toFixed(2);
}

/** Count of checked exercises for a lift day. */
export function liftsDone(group: LiftGroup, log: DayLog | undefined): number {
  if (!log || !log.lifts) return 0;
  return LIFTS[group].filter((e) => log.lifts![e.id]?.done).length;
}

/** 0 = nothing, 1 = partial, 2 = complete. Only submitted logs count. */
export function level(state: TrackerState, s: string): 0 | 1 | 2 {
  const p = effectivePlan(state, s);
  const l = state.logs[s];
  if (!p || !l || !l.submitted || l.skipped) return 0;
  const kind = TYPES[p.type].kind;
  if (kind === 'run') {
    if (!(l.miles! > 0)) return 0;
    return l.miles! >= p.miles * RUN_DONE_RATIO ? 2 : 1;
  }
  if (kind === 'lift') {
    const group = p.type as LiftGroup;
    const n = liftsDone(group, l);
    return n === LIFTS[group].length ? 2 : n > 0 ? 1 : 0;
  }
  return 0;
}

/** 'moved' = skipped, and made up on a rest day. */
export type DayStatus = 'done' | 'partial' | 'missed' | 'skipped' | 'moved' | 'open' | 'rest';

/** Day status, or null if outside the plan. Calories never affect status. */
export function status(state: TrackerState, s: string, today: string): DayStatus | null {
  const p = effectivePlan(state, s);
  if (!p) return null;
  if (TYPES[p.type].kind === 'rest') return 'rest';
  const l = state.logs[s];
  if (l && l.submitted && l.skipped) return madeUpBy(state, s) ? 'moved' : 'skipped';
  const lv = level(state, s);
  if (lv === 2) return 'done';
  if (s < today) return lv === 1 ? 'partial' : 'missed';
  return 'open';
}
