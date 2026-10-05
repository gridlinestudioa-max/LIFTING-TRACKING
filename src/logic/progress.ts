import { LONG, PLAN_DAYS, PLAN_WEEKS, TYPES } from './config';
import { MONTHS, addDays, toD } from './dates';
import { fmt } from './format';
import { level, planFor, status } from './plan';
import type { TrackerState } from './types';

export interface ProgressStats {
  done: number;
  planned: number;
  missedOrPartial: number;
  skipped: number;
  miles: number;
  longest: number;
  /** Total miles and seconds over runs that have a time (for average pace). */
  paceMiles: number;
  paceSecs: number;
  liftDone: number;
}

export function progressStats(state: TrackerState, today: string): ProgressStats {
  let planned = 0, done = 0, missedOrPartial = 0, skipped = 0;
  for (let i = 0; i < PLAN_DAYS; i++) {
    const s = addDays(state.start, i);
    const p = planFor(state.start, s);
    if (p && p.type !== 'rest' && s <= today) {
      const st = status(state, s, today);
      if (st === 'done') done++;
      if (st === 'missed' || st === 'partial') missedOrPartial++;
      if (st === 'skipped') skipped++;
      // planned = non-rest days up to today that are past or done
      if (st !== 'open') planned++;
      else if (level(state, s) === 2) planned++;
    }
  }
  let miles = 0, longest = 0, paceMiles = 0, paceSecs = 0, liftDone = 0;
  Object.keys(state.logs).forEach((k) => {
    const l = state.logs[k];
    const p = planFor(state.start, k);
    if (l.miles! > 0) {
      miles += l.miles!;
      if (l.miles! > longest) longest = l.miles!;
      if (l.secs! > 0) {
        paceMiles += l.miles!;
        paceSecs += l.secs!;
      }
    }
    if (p && TYPES[p.type].kind === 'lift' && level(state, k) === 2) liftDone++;
  });
  return { done, planned, missedOrPartial, skipped, miles, longest, paceMiles, paceSecs, liftDone };
}

export interface BarRow {
  label: string;
  planned: number;
  actual: number;
}

/** Long run per week (the Sunday run) and total weekly running miles. */
export function weeklyRunRows(state: TrackerState): { long: BarRow[]; week: BarRow[] } {
  const long: BarRow[] = [];
  const week: BarRow[] = [];
  for (let w = 0; w < PLAN_WEEKS; w++) {
    const ws = addDays(state.start, w * 7);
    let pw = 0, aw = 0;
    for (let d = 0; d < 7; d++) {
      const ds = addDays(ws, d);
      const pp = planFor(state.start, ds);
      if (pp) pw += pp.miles;
      const lg = state.logs[ds];
      if (lg && lg.miles! > 0) aw += lg.miles!;
    }
    const sun = state.logs[addDays(ws, 6)];
    long.push({ label: `W${w + 1}`, planned: LONG[w], actual: sun && sun.miles! > 0 ? sun.miles! : 0 });
    week.push({ label: `W${w + 1}`, planned: pw, actual: aw });
  }
  return { long, week };
}

/** Checked weights for a lift, in date order. */
export function loggedWeights(state: TrackerState, id: string): number[] {
  const pts: number[] = [];
  Object.keys(state.logs)
    .sort()
    .forEach((k) => {
      const e = state.logs[k].lifts?.[id];
      if (e && e.done && Number.isFinite(e.w)) pts.push(e.w);
    });
  return pts;
}

/** Header line: "Week 3 of 12 · long run this week: 9 mi" etc. */
export function headline(state: TrackerState, today: string): string {
  const p = planFor(state.start, today);
  if (p) return `Week ${p.w + 1} of ${PLAN_WEEKS} · long run this week: ${fmt(LONG[p.w])} mi`;
  if (today < state.start) {
    const d = toD(state.start);
    return `Plan starts ${MONTHS[d.getMonth()]} ${d.getDate()}`;
  }
  return '12-week plan complete';
}
