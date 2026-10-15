// The body log: weight, water, sleep and steps for each day, entered by hand (a device can't fill these
// in yet). Validation, parsing, and the weight trend. Pure logic, no React.

import { addDays } from './dates';
import { fmt } from './format';
import type { DayInfo } from './types';

export type BodyKey = 'weightLb' | 'waterOz' | 'sleepMins' | 'steps';

/** Values outside these are treated as typos and ignored. */
export const BODY_LIMITS: Record<BodyKey, { min: number; max: number }> = {
  weightLb: { min: 50, max: 700 },
  waterOz: { min: 1, max: 400 },
  sleepMins: { min: 1, max: 24 * 60 },
  steps: { min: 1, max: 200_000 },
};

const within = (key: BodyKey, v: number) => Number.isFinite(v) && v >= BODY_LIMITS[key].min && v <= BODY_LIMITS[key].max;

/** Weight to a tenth of a pound, or undefined when it isn't a believable weight. */
export function cleanWeight(v: unknown): number | undefined {
  const n = Math.round(Number(v) * 10) / 10;
  return v != null && within('weightLb', n) ? n : undefined;
}

export function cleanWater(v: unknown): number | undefined {
  const n = Math.round(Number(v));
  return v != null && within('waterOz', n) ? n : undefined;
}

export function cleanSleep(v: unknown): number | undefined {
  const n = Math.round(Number(v));
  return v != null && within('sleepMins', n) ? n : undefined;
}

export function cleanSteps(v: unknown): number | undefined {
  const n = Math.round(Number(v));
  return v != null && within('steps', n) ? n : undefined;
}

/**
 * Sleep as typed: "7:30", "7h 30m", "7h", "7.5" (hours), or "90m". Returns minutes, or null when it
 * isn't readable or isn't between a minute and 24 hours.
 */
export function parseSleep(text: string | null | undefined): number | null {
  const t = (text ?? '').trim().toLowerCase().replace(/\s+/g, '');
  if (!t) return null;
  let mins: number | null = null;
  let m: RegExpMatchArray | null;
  if ((m = t.match(/^(\d{1,2}):([0-5]?\d)$/))) mins = Number(m[1]) * 60 + Number(m[2]);
  else if ((m = t.match(/^(\d{1,2})h(?:([0-5]?\d)m?)?$/))) mins = Number(m[1]) * 60 + Number(m[2] ?? 0);
  else if ((m = t.match(/^(\d{1,4})m(?:in)?$/))) mins = Number(m[1]);
  else if ((m = t.match(/^(\d{1,2}(?:\.\d+)?)h?$/))) mins = Math.round(Number(m[1]) * 60);
  return mins != null && within('sleepMins', mins) ? mins : null;
}

/** "7h 30m", "45m", "8h". */
export function fmtSleep(mins: number): string {
  const m = Math.round(mins);
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return `${r}m`;
  return r ? `${h}h ${r}m` : `${h}h`;
}

/** Ounces as a readable amount: "64 oz". */
export const fmtWater = (oz: number) => `${fmt(Math.round(oz))} oz`;

// ---------- Averages ----------

/** The average of a body value over the last `n` days (today included), and how many of them had one. */
export function recentAverage(days: Record<string, DayInfo>, key: BodyKey, today: string, n = 7): { avg: number | null; logged: number } {
  const from = addDays(today, -(n - 1));
  const vals: number[] = [];
  for (const [s, d] of Object.entries(days)) {
    const v = d[key];
    if (v != null && s >= from && s <= today) vals.push(v);
  }
  return { avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null, logged: vals.length };
}

// ---------- Weight ----------

export interface WeightPoint {
  s: string;
  v: number;
}

/** Logged weights over the last `span` days, oldest first. */
export function weightSeries(days: Record<string, DayInfo>, today: string, span = 90): WeightPoint[] {
  const from = addDays(today, -(span - 1));
  return Object.entries(days)
    .filter(([s, d]) => d.weightLb != null && s >= from && s <= today)
    .map(([s, d]) => ({ s, v: d.weightLb! }))
    .sort((a, b) => a.s.localeCompare(b.s));
}

/**
 * Weight smoothed over a week: at each logged day, the average of the weights logged in the 7 days up to
 * and including it. Day-to-day swings (water, food, timing) mostly wash out, so this shows the real direction.
 */
export function weightTrend(series: WeightPoint[]): WeightPoint[] {
  return series.map((p, i) => {
    const from = addDays(p.s, -6);
    const win = series.slice(0, i + 1).filter((q) => q.s >= from);
    return { s: p.s, v: win.reduce((t, q) => t + q.v, 0) / win.length };
  });
}

/**
 * How the weight trend has moved over the last `days` days: latest trend minus the trend at the latest
 * logged day on or before that far back. Null until there's a weight from that long ago.
 */
export function weightChange(series: WeightPoint[], days: number): number | null {
  if (series.length < 2) return null;
  const trend = weightTrend(series);
  const last = trend[trend.length - 1];
  const cutoff = addDays(last.s, -days);
  const base = [...trend].reverse().find((p) => p.s <= cutoff);
  return base ? Math.round((last.v - base.v) * 10) / 10 : null;
}
