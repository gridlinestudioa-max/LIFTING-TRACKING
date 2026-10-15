import { coutFor } from './burn';
import { activeCycle } from './cycle';
import { addDays, dayDiff, mondayOf, todayString } from './dates';
import { fmtInt } from './format';
import { sumTotals } from './nutrition';
import type { TrackerState } from './types';

export type Tone = 'ok' | 'bad' | 'warn' | 'mute';

/** Net is always out - in (positive = deficit). */
export function net(cin: number, cout: number): number {
  return cout - cin;
}

/**
 * The day's calorie target as a net (positive = deficit, negative = surplus, 0 = eat what you burn): from a
 * cut, bulk or maintenance phase while one runs, otherwise the deficit goal. Null when there's neither.
 */
export function calTarget(state: TrackerState, today: string = todayString()): number | null {
  const c = activeCycle(state.cycle, today);
  if (c) return -c.delta;
  return state.goal != null && state.goal > 0 ? state.goal : null;
}

/** How close to the target counts as hitting it when the aim is a surplus or eating what you burn. */
export const TARGET_BAND = 200;

/**
 * Whether a day hit the target. A deficit target: at least that deficit. A surplus target: at least that
 * surplus, but not more than 300 over it. Eating what you burn: within 200 kcal either way.
 */
export function onTarget(n: number, target: number): boolean {
  if (target > 0) return n >= target;
  if (target < 0) return n <= target && n >= target - 300;
  return Math.abs(n) <= TARGET_BAND;
}

/** "500 kcal deficit a day", "250 kcal surplus a day", "Eat what you burn". */
export function targetText(target: number): string {
  if (target === 0) return 'Eat what you burn';
  return `${fmtInt(Math.abs(target))} kcal ${target > 0 ? 'deficit' : 'surplus'} a day`;
}

export function kcalInfo(
  cin: number | null | undefined,
  cout: number | null | undefined,
  target: number | null,
): { text: string; tone: Tone } {
  if (cin == null || cout == null || !Number.isFinite(cin) || !Number.isFinite(cout)) {
    return { text: 'Enter both to see your deficit', tone: 'mute' };
  }
  const n = net(cin, cout);
  const a = fmtInt(Math.abs(n));
  let text = n >= 0 ? `Deficit: ${a} kcal` : `Surplus: ${a} kcal`;
  if (target != null) {
    if (onTarget(n, target)) text += ' · on target ✓';
    else if (target > 0) text += ` · ${fmtInt(Math.round(target - n))} short of your target`;
    else if (target < 0) text += n > target ? ` · eat ${fmtInt(Math.round(n - target))} more to hit your target` : ' · over your target';
    else text += ' · off target';
  }
  const good = target == null ? n >= 0 : onTarget(n, target);
  return { text, tone: good ? 'ok' : target == null ? 'bad' : 'warn' };
}

/** Calories eaten from the food log, or null when food tracking is off or nothing is logged that day. */
export function foodKcal(state: TrackerState, s: string): number | null {
  const m = state.meals[s];
  return state.settings.sections.food && m && m.length ? Math.round(sumTotals(m).kcal) : null;
}

/** Total calories in: the number typed plus the food log. Null when neither has anything. */
export function totalIn(typed: number | null | undefined, food: number | null): number | null {
  return typed == null && food == null ? null : (typed ?? 0) + (food ?? 0);
}

/** Calories in for a day: the number typed for the day plus the food log total. */
export function cinFor(state: TrackerState, s: string): number | null {
  return totalIn(state.days[s]?.cin, foodKcal(state, s));
}

export interface KDay {
  s: string;
  cin: number;
  cout: number;
  net: number;
}

/** Days with both calories in and out, sorted by date. */
export function kDays(state: TrackerState): KDay[] {
  const keys = new Set([...Object.keys(state.days), ...Object.keys(state.meals)]);
  return [...keys]
    .sort()
    .map((k) => {
      const cout = coutFor(state, k);
      const cin = cinFor(state, k);
      return cin != null && cout != null ? { s: k, cin, cout, net: net(cin, cout) } : null;
    })
    .filter((d): d is KDay => d !== null);
}

export interface CalorieSummary {
  days: number;
  total: number;
  avg: number;
  /** Days on target (or days in a deficit if there's no target). */
  hit: number;
}

export function calorieSummary(state: TrackerState, today: string = todayString()): CalorieSummary {
  const ds = kDays(state);
  const n = ds.length;
  const total = ds.reduce((a, d) => a + d.net, 0);
  // Each day against the target in force that day (a plan's, or the deficit goal).
  const anyTarget = calTarget(state, today) != null || state.goal != null;
  const hit = ds.filter((d) => {
    const t = calTarget(state, d.s);
    return t != null ? onTarget(d.net, t) : !anyTarget && d.net > 0;
  }).length;
  return { days: n, total, avg: n ? total / n : 0, hit };
}

/** Daily deficit bars for the 21 days ending today (or ending the last logged day, if that's later). */
export function dailyWindow(state: TrackerState, today: string): { s: string; v: number | null }[] {
  const byDate: Record<string, number> = {};
  kDays(state).forEach((d) => {
    byDate[d.s] = d.net;
  });
  const out: { s: string; v: number | null }[] = [];
  for (let i = 20; i >= 0; i--) {
    const key = addDays(today, -i);
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
  /** Monday of the week. */
  start: string;
  days: number;
  avgIn: number;
  avgOut: number;
  avgNet: number;
}

/** Averages per calendar week (Mon–Sun), newest first, only weeks with data. */
export function byWeek(state: TrackerState): WeekCalories[] {
  const groups = new Map<string, KDay[]>();
  for (const d of kDays(state)) {
    const m = mondayOf(d.s);
    groups.set(m, [...(groups.get(m) ?? []), d]);
  }
  return [...groups.entries()]
    .sort((a, b) => dayDiff(b[0], a[0]))
    .map(([start, wk]) => {
      const avg = (f: 'cin' | 'cout' | 'net') => wk.reduce((t, d) => t + d[f], 0) / wk.length;
      return { start, days: wk.length, avgIn: avg('cin'), avgOut: avg('cout'), avgNet: avg('net') };
    });
}
