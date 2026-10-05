import { PLAN_WEEKS } from './config';
import { addDays, dayDiff } from './dates';
import { fmtInt } from './format';
import { planEnd } from './plan';
import type { TrackerState } from './types';

export type Tone = 'ok' | 'bad' | 'warn' | 'mute';

/** Net is always out - in (positive = deficit). */
export function net(cin: number, cout: number): number {
  return cout - cin;
}

export function kcalInfo(
  cin: number | null | undefined,
  cout: number | null | undefined,
  goal: number | null,
): { text: string; tone: Tone } {
  if (cin == null || cout == null || !Number.isFinite(cin) || !Number.isFinite(cout)) {
    return { text: 'Enter both to see your deficit', tone: 'mute' };
  }
  const n = net(cin, cout);
  const a = fmtInt(Math.abs(n));
  let text = n >= 0 ? `Deficit: ${a} kcal` : `Surplus: ${a} kcal`;
  if (goal != null && goal > 0 && n >= 0) {
    const diff = Math.round(n - goal);
    text += diff >= 0 ? ' · goal met ✓' : ` · ${fmtInt(Math.abs(diff))} short of goal`;
  }
  return { text, tone: n >= 0 ? 'ok' : 'bad' };
}

export interface KDay {
  s: string;
  cin: number;
  cout: number;
  net: number;
}

/** Logged days with both calorie numbers, sorted by date. */
export function kDays(state: TrackerState): KDay[] {
  return Object.keys(state.logs)
    .sort()
    .map((k) => {
      const l = state.logs[k];
      return l && l.cin != null && l.cout != null
        ? { s: k, cin: l.cin, cout: l.cout, net: net(l.cin, l.cout) }
        : null;
    })
    .filter((d): d is KDay => d !== null);
}

export interface CalorieSummary {
  days: number;
  total: number;
  avg: number;
  /** Days at or above goal (or days in a deficit if no goal). */
  hit: number;
}

export function calorieSummary(state: TrackerState): CalorieSummary {
  const ds = kDays(state);
  const n = ds.length;
  const total = ds.reduce((a, d) => a + d.net, 0);
  const goal = state.goal;
  const hit =
    goal != null && goal > 0
      ? ds.filter((d) => d.net >= goal).length
      : ds.filter((d) => d.net > 0).length;
  return { days: n, total, avg: n ? total / n : 0, hit };
}

/**
 * Daily deficit bar window: ~last 3 weeks ending today.
 * If fewer than 14 days since start, show start + 14 days. Clamped to plan end.
 * (Unlike the prototype, a date long after the plan shows the plan's last 3 weeks, not nothing.)
 */
export function dailyWindow(state: TrackerState, today: string): { s: string; v: number | null }[] {
  const pe = planEnd(state.start);
  let endS = today > pe ? pe : today;
  let stS = addDays(endS, -20);
  if (stS < state.start) stS = state.start;
  if (dayDiff(endS, stS) < 13) endS = addDays(stS, 13);
  if (endS > pe) endS = pe;
  const byDate: Record<string, number> = {};
  kDays(state).forEach((d) => {
    byDate[d.s] = d.net;
  });
  const n = dayDiff(endS, stS) + 1;
  const out: { s: string; v: number | null }[] = [];
  for (let i = 0; i < n; i++) {
    const key = addDays(stS, i);
    out.push({ s: key, v: byDate[key] ?? null });
  }
  return out;
}

/** Running total of net over logged days. */
export function cumulative(state: TrackerState): { s: string; v: number }[] {
  let cum = 0;
  return kDays(state).map((d) => {
    cum += d.net;
    return { s: d.s, v: cum };
  });
}

export interface WeekCalories {
  week: number; // 1-based
  days: number;
  avgIn: number;
  avgOut: number;
  avgNet: number;
}

/** Per plan week averages, only weeks with data. */
export function byWeek(state: TrackerState): WeekCalories[] {
  const ds = kDays(state);
  const rows: WeekCalories[] = [];
  for (let w = 0; w < PLAN_WEEKS; w++) {
    const wk = ds.filter((d) => {
      const df = dayDiff(d.s, state.start);
      return df >= w * 7 && df < w * 7 + 7;
    });
    if (!wk.length) continue;
    const avg = (f: 'cin' | 'cout' | 'net') => wk.reduce((t, d) => t + d[f], 0) / wk.length;
    rows.push({ week: w + 1, days: wk.length, avgIn: avg('cin'), avgOut: avg('cout'), avgNet: avg('net') });
  }
  return rows;
}
