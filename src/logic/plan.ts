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
}

export function planFor(start: string, s: string): PlanDay | null {
  const diff = dayDiff(s, start);
  if (diff < 0 || diff >= PLAN_DAYS) return null;
  const w = Math.floor(diff / 7);
  const type = DOW[diff % 7];
  let miles = 0;
  if (type === 'easy') miles = easyMiles(w);
  if (type === 'tempo') miles = tempoMiles(w);
  if (type === 'long') miles = LONG[w];
  return { w, type, miles, race: w === LONG.length - 1 && type === 'long' };
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
  const p = planFor(state.start, s);
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

export type DayStatus = 'done' | 'partial' | 'missed' | 'skipped' | 'open' | 'rest';

/** Day status, or null if outside the plan. Calories never affect status. */
export function status(state: TrackerState, s: string, today: string): DayStatus | null {
  const p = planFor(state.start, s);
  if (!p) return null;
  if (TYPES[p.type].kind === 'rest') return 'rest';
  const l = state.logs[s];
  if (l && l.submitted && l.skipped) return 'skipped';
  const lv = level(state, s);
  if (lv === 2) return 'done';
  if (s < today) return lv === 1 ? 'partial' : 'missed';
  return 'open';
}
