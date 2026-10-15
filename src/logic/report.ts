// A summary of a day, week, month or year across calories, cardio, lifting and the body log, for the PDF
// report on the Progress tab. Only the sections the person uses are included. Pure logic, no React.

import { calTarget, cinFor, net, onTarget } from './calories';
import { coutFor, workoutMinutes } from './burn';
import type { CardioType } from './cardio';
import { MONTHS, addDays, daysInMonth, mondayOf, pad, shortDayLabel, toD } from './dates';
import { fmt } from './format';
import { MEALS, mealOf, sumTotals, type Totals } from './nutrition';
import { METERS_PER_MILE } from './plans';
import { recentPRs, setsDone, workoutLine } from './stats';
import { fmtTime, paceText } from './time';
import type { TrackerState } from './types';

export type ReportPeriod = 'day' | 'week' | 'month' | 'year';

export const REPORT_PERIODS: { id: ReportPeriod; label: string; every: string }[] = [
  { id: 'day', label: 'Day', every: 'Daily' },
  { id: 'week', label: 'Week', every: 'Weekly' },
  { id: 'month', label: 'Month', every: 'Monthly' },
  { id: 'year', label: 'Year', every: 'Yearly' },
];

export interface ReportSpan {
  period: ReportPeriod;
  from: string;
  to: string;
  /** "Tuesday, Oct 14, 2026", "Week of Oct 13, 2026", "October 2026", "2026". */
  title: string;
}

/** The day, week (Monday to Sunday), month or year that contains `anchor`. */
export function reportSpan(period: ReportPeriod, anchor: string): ReportSpan {
  const d = toD(anchor);
  const y = d.getFullYear();
  if (period === 'day') return { period, from: anchor, to: anchor, title: `${shortDayLabel(anchor)}, ${y}` };
  if (period === 'week') {
    const from = mondayOf(anchor);
    const to = addDays(from, 6);
    return { period, from, to, title: `Week of ${MONTHS[toD(from).getMonth()]} ${toD(from).getDate()}, ${toD(from).getFullYear()}` };
  }
  if (period === 'month') {
    const m = d.getMonth();
    return { period, from: `${y}-${pad(m + 1)}-01`, to: `${y}-${pad(m + 1)}-${pad(daysInMonth(y, m))}`, title: `${MONTHS[m]} ${y}` };
  }
  return { period, from: `${y}-01-01`, to: `${y}-12-31`, title: String(y) };
}

/** The last finished period before `today`: yesterday, last week, last month or last year. */
export function lastFinished(period: ReportPeriod, today: string): ReportSpan {
  const cur = reportSpan(period, today);
  return reportSpan(period, addDays(cur.from, -1));
}

/** One bar of a chart: a day, or a month for a year. */
export interface ReportBar {
  label: string;
  v: number | null;
}

export interface ReportCalories {
  daysLogged: number;
  avgIn: number | null;
  avgOut: number | null;
  /** Average daily deficit (positive) or surplus (negative). */
  avgNet: number | null;
  totalNet: number;
  /** Calorie target as a net (positive deficit, negative surplus), or null. */
  goal: number | null;
  daysAtGoal: number;
  /** Average per logged day. */
  macros: Totals | null;
  /** Deficit by day (or by month, averaged, for a year). */
  bars: ReportBar[];
  /** For a single day: what was eaten, by meal. */
  meals: { label: string; items: { name: string; kcal: number }[] }[];
}

export interface ReportCardio {
  count: number;
  miles: number;
  secs: number;
  bySport: { label: string; count: number; dist: string; secs: number }[];
  longest: string | null;
  /** Miles by day (or by month for a year). */
  bars: ReportBar[];
  /** The activities themselves (newest first), for a day, week or month. */
  list: { date: string; text: string }[];
}

export interface ReportLifting {
  workouts: number;
  sets: number;
  /** Pounds lifted (weight × reps of finished sets in lb). */
  volume: number;
  minutes: number;
  bars: ReportBar[];
  list: { date: string; text: string }[];
  prs: string[];
}

export interface ReportBody {
  weightFrom: number | null;
  weightTo: number | null;
  avgSleepMins: number | null;
  avgSteps: number | null;
  avgWaterOz: number | null;
}

export interface Report {
  span: ReportSpan;
  name: string;
  calories: ReportCalories | null;
  cardio: ReportCardio | null;
  lifting: ReportLifting | null;
  body: ReportBody | null;
  notes: { date: string; text: string }[];
}

const SPORT: Record<CardioType, string> = {
  run: 'Running', bike: 'Cycling', swim: 'Swimming', walk: 'Walking', hike: 'Hiking', row: 'Rowing', elliptical: 'Elliptical', other: 'Other',
};

const dist = (type: CardioType, miles: number) =>
  type === 'swim' ? `${fmt(Math.round(miles * METERS_PER_MILE))} m` : `${fmt(Math.round(miles * 10) / 10)} mi`;

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  for (let s = from; s <= to; s = addDays(s, 1)) out.push(s);
  return out;
}

/** Bars for the span: one per day, or one per month for a year. `v` gives a day's value (null: nothing). */
function bars(span: ReportSpan, days: string[], v: (s: string) => number | null, mode: 'sum' | 'avg'): ReportBar[] {
  if (span.period === 'year') {
    return MONTHS.map((m, i) => {
      const xs = days.filter((s) => toD(s).getMonth() === i).map(v).filter((x): x is number => x != null);
      return { label: m.slice(0, 1), v: xs.length ? (mode === 'sum' ? xs.reduce((a, b) => a + b, 0) : avg(xs)) : null };
    });
  }
  // Every day of the week or month, so the chart keeps its shape part-way through; days ahead are empty.
  const last = days[days.length - 1];
  return eachDay(span.from, span.to).map((s) => ({ label: span.period === 'week' ? shortDayLabel(s).slice(0, 3) : String(toD(s).getDate()), v: s <= last ? v(s) : null }));
}

/** A summary of everything logged in the span. Days after `today` count as not logged yet. */
export function buildReport(state: TrackerState, span: ReportSpan, today: string): Report {
  const on = state.settings.sections;
  const last = span.to < today ? span.to : today;
  const days = eachDay(span.from, last);
  const inSpan = (s: string) => s >= span.from && s <= last;

  let calories: ReportCalories | null = null;
  if (on.food) {
    const logged = days
      .map((s) => ({ s, cin: cinFor(state, s), cout: coutFor(state, s, today) }))
      .filter((d): d is { s: string; cin: number; cout: number | null } => d.cin != null);
    const nets = logged.filter((d) => d.cout != null).map((d) => ({ s: d.s, v: net(d.cin, d.cout as number) }));
    const netOf = new Map(nets.map((d) => [d.s, d.v]));
    const eaten = days.filter((s) => (state.meals[s] ?? []).length);
    const tot = eaten.map((s) => sumTotals(state.meals[s] ?? []));
    const macros = tot.length
      ? (Object.fromEntries(Object.keys(tot[0]).map((k) => [k, Math.round(tot.reduce((t, x) => t + x[k as keyof Totals], 0) / tot.length)])) as unknown as Totals)
      : null;
    const goal = calTarget(state, last);
    const entries = span.period === 'day' ? (state.meals[span.from] ?? []) : [];
    calories = {
      daysLogged: logged.length,
      avgIn: avg(logged.map((d) => d.cin)),
      avgOut: avg(logged.filter((d) => d.cout != null).map((d) => d.cout as number)),
      avgNet: avg(nets.map((d) => d.v)),
      totalNet: nets.reduce((t, d) => t + d.v, 0),
      goal,
      daysAtGoal: nets.filter((d) => {
        const t = calTarget(state, d.s);
        return t != null ? onTarget(d.v, t) : goal == null && d.v > 0;
      }).length,
      macros,
      bars: span.period === 'day' ? [] : bars(span, days, (s) => netOf.get(s) ?? null, 'avg'),
      meals: MEALS.map((m) => ({
        label: m.label,
        items: entries.filter((e) => mealOf(e) === m.id).map((e) => ({ name: e.name, kcal: Math.round(e.n.kcal * e.qty) })),
      })).filter((m) => m.items.length),
    };
  }

  let cardio: ReportCardio | null = null;
  if (on.cardio) {
    const xs = state.cardio.sessions.filter((x) => inSpan(x.date)).sort((a, b) => b.date.localeCompare(a.date));
    const groups = new Map<CardioType, { count: number; miles: number; secs: number }>();
    for (const x of xs) {
      const g = groups.get(x.type) ?? { count: 0, miles: 0, secs: 0 };
      g.count++;
      g.miles += x.miles ?? 0;
      g.secs += x.secs ?? 0;
      groups.set(x.type, g);
    }
    const land = xs.filter((x) => x.type !== 'swim');
    const longest = land.reduce<(typeof land)[number] | null>((m, x) => ((x.miles ?? 0) > (m?.miles ?? 0) ? x : m), null);
    cardio = {
      count: xs.length,
      miles: land.reduce((t, x) => t + (x.miles ?? 0), 0),
      secs: xs.reduce((t, x) => t + (x.secs ?? 0), 0),
      bySport: [...groups].map(([type, g]) => ({ label: SPORT[type], count: g.count, dist: g.miles ? dist(type, g.miles) : '', secs: g.secs })),
      longest: longest?.miles ? `${dist(longest.type, longest.miles)} ${SPORT[longest.type].toLowerCase()}, ${shortDayLabel(longest.date)}` : null,
      bars: span.period === 'day' ? [] : bars(span, days, (s) => {
        const m = land.filter((x) => x.date === s).reduce((t, x) => t + (x.miles ?? 0), 0);
        return m ? Math.round(m * 10) / 10 : null;
      }, 'sum'),
      list: span.period === 'year' ? [] : xs.slice(0, 40).map((x) => {
        const pace = x.type === 'run' || x.type === 'walk' || x.type === 'hike' ? paceText(x.miles, x.secs) : '';
        return {
          date: x.date,
          text: [SPORT[x.type], x.miles ? dist(x.type, x.miles) : null, x.secs ? fmtTime(x.secs) : null, pace || null].filter(Boolean).join(' · '),
        };
      }),
    };
  }

  let lifting: ReportLifting | null = null;
  if (on.lifting) {
    const ws = state.lifting.workouts.filter((w) => w.done && inSpan(w.date)).sort((a, b) => b.date.localeCompare(a.date));
    let volume = 0;
    for (const w of ws) for (const e of w.exercises) if (e.unit === 'lb') for (const s of e.sets) if (s.done && s.w && s.reps) volume += s.w * s.reps;
    const minutes = ws.reduce((t, w) => t + workoutMinutes(w), 0);
    const spanDays = days.length;
    const prs = recentPRs(state.lifting, last, Math.max(1, spanDays))
      .filter((p) => inSpan(p.date))
      .slice(0, 12)
      .map((p) => `${p.name}: ${fmt(p.set.w)} ${p.unit === 'plates' ? 'plates' : 'lb'} × ${p.set.reps} (${shortDayLabel(p.date)})`);
    lifting = {
      workouts: ws.length,
      sets: ws.reduce((t, w) => t + setsDone(w), 0),
      volume: Math.round(volume),
      minutes,
      bars: span.period === 'day' ? [] : bars(span, days, (s) => ws.filter((w) => w.date === s).length || null, 'sum'),
      list: span.period === 'year' ? [] : ws.slice(0, 40).map((w) => ({ date: w.date, text: `${w.name} · ${workoutLine(w)}` })),
      prs,
    };
  }

  const info = days.map((s) => state.days[s]).filter(Boolean);
  const weights = days.map((s) => state.days[s]?.weightLb).filter((x): x is number => x != null);
  const sleep = info.map((d) => d.sleepMins).filter((x): x is number => x != null);
  const steps = info.map((d) => d.steps).filter((x): x is number => x != null);
  const water = info.map((d) => d.waterOz).filter((x): x is number => x != null);
  const body: ReportBody | null =
    weights.length || sleep.length || steps.length || water.length
      ? {
          weightFrom: weights[0] ?? null,
          weightTo: weights.length > 1 ? weights[weights.length - 1] : null,
          avgSleepMins: avg(sleep),
          avgSteps: avg(steps),
          avgWaterOz: avg(water),
        }
      : null;

  const notes = days.filter((s) => state.days[s]?.note).map((s) => ({ date: s, text: state.days[s].note as string }));

  return { span, name: state.settings.name, calories, cardio, lifting, body, notes: notes.slice(-20) };
}

/** True when nothing at all was logged in the span. */
export function reportEmpty(r: Report): boolean {
  return !r.calories?.daysLogged && !r.cardio?.count && !r.lifting?.workouts && !r.body && !r.notes.length;
}

/** "potter-week-2026-10-13.pdf" style file name. */
export function reportFileName(r: Report): string {
  return `training-${r.span.period}-${r.span.from}.pdf`;
}
