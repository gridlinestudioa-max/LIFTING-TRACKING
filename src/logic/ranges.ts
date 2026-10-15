// Time ranges for charts: the last week, month or year, or all time, split into buckets (days, weeks or
// months) with labels. Pure logic, no React.

import { DAY_NAMES, MONTHS, addDays, dayDiff, mondayOf, toD, weekdayIndex } from './dates';

export type Range = 'week' | 'month' | 'year' | 'all';

export const RANGES: { id: Range; label: string }[] = [
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
  { id: 'all', label: 'All' },
];

export type Grain = 'day' | 'week' | 'month';

export interface Bucket {
  /** First and last day, inclusive. */
  start: string;
  end: string;
  /** Short axis label: "Mon", "14", "Mar 3", "Mar", "Mar ’25". */
  label: string;
}

export interface RangeSpan {
  /** First day in the range. */
  from: string;
  to: string;
  grain: Grain;
  buckets: Bucket[];
  /** "Last 7 days", "Last 30 days", "Last 12 months", "Since Mar 3, 2025". */
  caption: string;
  /** "day", "week", "month": for "miles per week". */
  per: Grain;
}

const mon = (s: string) => MONTHS[toD(s).getMonth()].slice(0, 3);
const monthStart = (s: string) => `${s.slice(0, 8)}01`;

function addMonths(s: string, n: number): string {
  const d = toD(monthStart(s));
  d.setMonth(d.getMonth() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function dayBuckets(from: string, to: string, label: (s: string) => string): Bucket[] {
  const out: Bucket[] = [];
  for (let s = from; s <= to; s = addDays(s, 1)) out.push({ start: s, end: s, label: label(s) });
  return out;
}

function weekBuckets(from: string, to: string): Bucket[] {
  const out: Bucket[] = [];
  for (let s = mondayOf(from); s <= to; s = addDays(s, 7)) {
    out.push({ start: s < from ? from : s, end: addDays(s, 6) > to ? to : addDays(s, 6), label: `${mon(s)} ${toD(s).getDate()}` });
  }
  return out;
}

function monthBuckets(from: string, to: string): Bucket[] {
  const years = from.slice(0, 4) !== to.slice(0, 4);
  const out: Bucket[] = [];
  for (let s = monthStart(from); s <= to; s = addMonths(s, 1)) {
    const last = addDays(addMonths(s, 1), -1);
    // The year only where it changes: the first bar and each January.
    const showYear = years && (!out.length || s.slice(5, 7) === '01');
    out.push({ start: s < from ? from : s, end: last > to ? to : last, label: showYear ? `${mon(s)} ’${s.slice(2, 4)}` : mon(s) });
  }
  return out;
}

/** The days and buckets a chart shows for a range. `first` is the earliest date with data (for All). */
export function rangeSpan(range: Range, today: string, first?: string | null): RangeSpan {
  if (range === 'week') {
    const from = addDays(today, -6);
    return { from, to: today, grain: 'day', per: 'day', caption: 'Last 7 days', buckets: dayBuckets(from, today, (s) => DAY_NAMES[weekdayIndex(s)]) };
  }
  if (range === 'month') {
    const from = addDays(today, -29);
    return { from, to: today, grain: 'day', per: 'day', caption: 'Last 30 days', buckets: dayBuckets(from, today, (s) => String(toD(s).getDate())) };
  }
  if (range === 'year' || !first || first > today) {
    const from = addMonths(today, -11);
    return { from, to: today, grain: 'month', per: 'month', caption: 'Last 12 months', buckets: monthBuckets(from, today) };
  }
  const span = dayDiff(today, first);
  const d = toD(first);
  const caption = `Since ${mon(first)} ${d.getDate()}, ${d.getFullYear()}`;
  if (span < 31) return { from: first, to: today, grain: 'day', per: 'day', caption, buckets: dayBuckets(first, today, (s) => String(toD(s).getDate())) };
  if (span < 190) return { from: first, to: today, grain: 'week', per: 'week', caption, buckets: weekBuckets(first, today) };
  return { from: first, to: today, grain: 'month', per: 'month', caption, buckets: monthBuckets(first, today) };
}

/** Adds up a value per bucket. Items outside the range are ignored. */
export function sumByBucket<T>(items: readonly T[], date: (t: T) => string, value: (t: T) => number, buckets: Bucket[]): number[] {
  const out = buckets.map(() => 0);
  for (const it of items) {
    const s = date(it);
    const i = bucketIndex(buckets, s);
    if (i >= 0) out[i] += value(it);
  }
  return out;
}

/** Averages a value per bucket over the items in it; null for an empty bucket. */
export function avgByBucket<T>(items: readonly T[], date: (t: T) => string, value: (t: T) => number, buckets: Bucket[]): (number | null)[] {
  const sum = buckets.map(() => 0);
  const n = buckets.map(() => 0);
  for (const it of items) {
    const i = bucketIndex(buckets, date(it));
    if (i >= 0) {
      sum[i] += value(it);
      n[i]++;
    }
  }
  return sum.map((v, i) => (n[i] ? v / n[i] : null));
}

function bucketIndex(buckets: Bucket[], s: string): number {
  if (!buckets.length || s < buckets[0].start || s > buckets[buckets.length - 1].end) return -1;
  let lo = 0;
  let hi = buckets.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (s < buckets[mid].start) hi = mid - 1;
    else if (s > buckets[mid].end) lo = mid + 1;
    else return mid;
  }
  return -1;
}

/** Round axis ticks from 0 (or below, for negatives) to at least `hi`: 0, 5, 10 or 0, 250, 500. */
export function niceTicks(lo: number, hi: number, count = 3): number[] {
  const min = Math.min(0, lo);
  let max = Math.max(0, hi);
  if (max - min < 1e-9) max = min + 1;
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw || 1));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const start = Math.floor(min / step) * step;
  const out: number[] = [];
  for (let v = start; v < max + step - 1e-9; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}

/** "per day", "per week", "per month". */
export const perText = (g: Grain) => `per ${g}`;
