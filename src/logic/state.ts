import { ALL_EXERCISES, START_DEFAULT } from './config';
import { mondayOf } from './dates';
import type { DayLog, TrackerState } from './types';

export function defaultState(): TrackerState {
  const base: Record<string, number> = {};
  ALL_EXERCISES.forEach((e) => {
    base[e.id] = e.w;
  });
  return { start: START_DEFAULT, base, goal: null, logs: {} };
}

/** Accepts anything (parsed JSON) and returns a valid state, migrating old fields. */
export function normalize(s: unknown): TrackerState {
  const d = defaultState();
  if (!s || typeof s !== 'object') return d;
  const src = s as Record<string, any>;
  if (typeof src.start === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(src.start)) d.start = src.start;
  if (typeof src.goal === 'number' && src.goal > 0) d.goal = src.goal;
  if (src.base && typeof src.base === 'object') {
    Object.keys(d.base).forEach((k) => {
      if (typeof src.base[k] === 'number') d.base[k] = src.base[k];
    });
  }
  if (src.logs && typeof src.logs === 'object') {
    const logs: Record<string, DayLog> = {};
    Object.keys(src.logs).forEach((k) => {
      const l = src.logs[k];
      if (!l || typeof l !== 'object') return;
      const copy: Record<string, any> = { ...l };
      if (copy.mins > 0 && !(copy.secs > 0)) copy.secs = copy.mins * 60;
      delete copy.mins;
      if (copy.submitted === undefined) copy.submitted = true;
      logs[k] = copy as DayLog;
    });
    d.logs = logs;
  }
  return d;
}

/** Any chosen date snaps back to that week's Monday. */
export function snapStart(dateStr: string): string {
  return mondayOf(dateStr);
}
