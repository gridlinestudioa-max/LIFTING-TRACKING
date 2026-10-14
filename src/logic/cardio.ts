// Cardio: any session (run, ride, swim, ...) logged freely, plus an optional 12-week half-marathon plan.
// Pure logic, no React.

import { LONG, PLAN_DAYS, PLAN_WEEKS, RUN_DONE_RATIO, easyMiles, tempoMiles } from './config';
import { addDays, dayDiff, weekdayIndex } from './dates';

export type CardioType = 'run' | 'walk' | 'hike' | 'bike' | 'swim' | 'row' | 'elliptical' | 'other';

export const CARDIO_TYPES: { id: CardioType; label: string; distance: boolean }[] = [
  { id: 'run', label: 'Run', distance: true },
  { id: 'walk', label: 'Walk', distance: true },
  { id: 'hike', label: 'Hike', distance: true },
  { id: 'bike', label: 'Bike', distance: true },
  { id: 'swim', label: 'Swim', distance: true },
  { id: 'row', label: 'Row', distance: true },
  { id: 'elliptical', label: 'Elliptical', distance: false },
  { id: 'other', label: 'Other', distance: false },
];

export const CARDIO_LABEL: Record<CardioType, string> = Object.fromEntries(CARDIO_TYPES.map((t) => [t.id, t.label])) as Record<
  CardioType,
  string
>;

export interface CardioSession {
  id: string;
  date: string;
  type: CardioType;
  miles?: number;
  /** Duration in seconds. */
  secs?: number;
  note?: string;
  /** The plan run this session counts toward (a run on a plan day, or a plan run done on another day). */
  planDay?: string;
}

export interface CardioData {
  /** The 12-week half-marathon plan, if turned on. `start` is a Monday. */
  plan: { start: string } | null;
  sessions: CardioSession[];
  /** Plan run days skipped on purpose. */
  skips: string[];
}

export const EMPTY_CARDIO: CardioData = { plan: null, sessions: [], skips: [] };

// ---------- The half-marathon plan ----------

export type RunType = 'tempo' | 'easy' | 'long';

export const RUN_LABEL: Record<RunType, string> = { tempo: 'Tempo', easy: 'Easy', long: 'Long' };

export const RUN_TIPS: Record<RunType | 'race', string> = {
  long: 'Slow and conversational.',
  tempo: 'Comfortably hard, or intervals.',
  easy: 'Easy, relaxed pace.',
  race: 'Race day. Start easy.',
};

/** Runs by weekday (Mon = 0): Tue tempo, Fri easy, Sun long. Other days are off the run plan. */
const RUN_DAYS: Record<number, RunType> = { 1: 'tempo', 4: 'easy', 6: 'long' };

export interface PlanRun {
  /** 0-based week. */
  w: number;
  type: RunType;
  miles: number;
  race: boolean;
}

export function runMiles(type: RunType, w: number): number {
  return type === 'easy' ? easyMiles(w) : type === 'tempo' ? tempoMiles(w) : LONG[w];
}

/** The planned run on a date, or null (no plan, outside it, or not a run day). */
export function planRun(plan: CardioData['plan'], s: string): PlanRun | null {
  if (!plan) return null;
  const diff = dayDiff(s, plan.start);
  if (diff < 0 || diff >= PLAN_DAYS) return null;
  const type = RUN_DAYS[diff % 7];
  if (!type) return null;
  const w = Math.floor(diff / 7);
  return { w, type, miles: runMiles(type, w), race: w === PLAN_WEEKS - 1 && type === 'long' };
}

/** Plan week (0-based) for a date, or null outside the plan. */
export function planWeek(plan: CardioData['plan'], s: string): number | null {
  if (!plan) return null;
  const diff = dayDiff(s, plan.start);
  return diff < 0 || diff >= PLAN_DAYS ? null : Math.floor(diff / 7);
}

export function raceDay(start: string): string {
  return addDays(start, PLAN_DAYS - 1);
}

/** Sessions counting toward a plan run day. */
export function sessionsFor(c: CardioData, planDay: string): CardioSession[] {
  return c.sessions.filter((x) => x.planDay === planDay);
}

/** Miles run toward a plan day. */
export function milesToward(c: CardioData, planDay: string): number {
  return sessionsFor(c, planDay).reduce((t, x) => t + (x.miles ?? 0), 0);
}

export type RunStatus = 'done' | 'partial' | 'missed' | 'skipped' | 'moved' | 'open';

/**
 * Status of a plan run day. 'moved' = done on another day. A run counts as done at
 * 90% of the planned miles; partial and missed only once the day has passed.
 */
export function runStatus(c: CardioData, s: string, today: string): RunStatus | null {
  const p = planRun(c.plan, s);
  if (!p) return null;
  const mine = sessionsFor(c, s);
  const miles = mine.reduce((t, x) => t + (x.miles ?? 0), 0);
  if (miles >= p.miles * RUN_DONE_RATIO) return mine.every((x) => x.date === s) ? 'done' : 'moved';
  if (c.skips.includes(s)) return 'skipped';
  if (s < today) return miles > 0 ? 'partial' : 'missed';
  return 'open';
}

/**
 * Plan runs a session on day s could count toward: the run planned that day, other plan runs
 * in the same week that aren't done yet, and runs skipped or missed in the past 7 days.
 */
export function planDayOptions(c: CardioData, s: string, today: string): { s: string; run: PlanRun }[] {
  const out: { s: string; run: PlanRun }[] = [];
  const week = planWeek(c.plan, s);
  for (let d = -7; d <= 6; d++) {
    const k = addDays(s, d);
    const run = planRun(c.plan, k);
    if (!run) continue;
    if (d === 0) {
      out.push({ s: k, run });
      continue;
    }
    const st = runStatus(c, k, today);
    const sameWeek = week != null && run.w === week;
    const open = st === 'open' || st === 'missed' || st === 'partial' || st === 'skipped';
    if (!open) continue;
    if (sameWeek || (d < 0 && (st === 'missed' || st === 'skipped' || st === 'partial'))) out.push({ s: k, run });
  }
  return out.sort((a, b) => (a.s === s ? -1 : b.s === s ? 1 : a.s.localeCompare(b.s)));
}

/** The plan run a new session on day s counts toward by default: that day's planned run, if it's a run. */
export function defaultPlanDay(c: CardioData, s: string, type: CardioType): string | undefined {
  return type === 'run' && planRun(c.plan, s) ? s : undefined;
}

// ---------- Stats ----------

export interface CardioStats {
  sessions: number;
  miles: number;
  secs: number;
  longestRun: number;
  /** Over runs that have both distance and time. */
  paceMiles: number;
  paceSecs: number;
  /** Plan runs: done (or done on another day), due so far (anything not still open), missed or partial, skipped. */
  planDone: number;
  planDue: number;
  planMissed: number;
  planSkipped: number;
}

export function cardioStats(c: CardioData, today: string): CardioStats {
  let miles = 0, secs = 0, longestRun = 0, paceMiles = 0, paceSecs = 0;
  for (const x of c.sessions) {
    miles += x.miles ?? 0;
    secs += x.secs ?? 0;
    if (x.type === 'run') {
      if ((x.miles ?? 0) > longestRun) longestRun = x.miles!;
      if (x.miles! > 0 && x.secs! > 0) {
        paceMiles += x.miles!;
        paceSecs += x.secs!;
      }
    }
  }
  let planDone = 0, planDue = 0, planMissed = 0, planSkipped = 0;
  if (c.plan) {
    for (let i = 0; i < PLAN_DAYS; i++) {
      const s = addDays(c.plan.start, i);
      const st = runStatus(c, s, today);
      if (!st) continue;
      if (st === 'done' || st === 'moved') planDone++;
      if (st === 'missed' || st === 'partial') planMissed++;
      if (st === 'skipped') planSkipped++;
      if (st !== 'open') planDue++;
    }
  }
  return { sessions: c.sessions.length, miles, secs, longestRun, paceMiles, paceSecs, planDone, planDue, planMissed, planSkipped };
}

export interface WeekBar {
  label: string;
  planned: number;
  actual: number;
}

/** Plan weeks: the long run (planned vs the longest run toward a long day) and total running miles. */
export function planWeekRows(c: CardioData): { long: WeekBar[]; week: WeekBar[] } {
  const long: WeekBar[] = [];
  const week: WeekBar[] = [];
  if (!c.plan) return { long, week };
  for (let w = 0; w < PLAN_WEEKS; w++) {
    const ws = addDays(c.plan.start, w * 7);
    let planned = 0, actual = 0, longActual = 0;
    for (let d = 0; d < 7; d++) {
      const ds = addDays(ws, d);
      const run = planRun(c.plan, ds);
      if (run) planned += run.miles;
      if (run?.type === 'long') longActual = Math.max(longActual, milesToward(c, ds));
      for (const x of c.sessions) if (x.date === ds && x.type === 'run') actual += x.miles ?? 0;
    }
    long.push({ label: `W${w + 1}`, planned: LONG[w], actual: longActual });
    week.push({ label: `W${w + 1}`, planned, actual });
  }
  return { long, week };
}

/** Distance and time by calendar week (Mon–Sun), for the last `n` weeks ending with the week of `today`. */
export function weeklyTotals(c: CardioData, today: string, n = 8): { start: string; miles: number; secs: number }[] {
  const monday = addDays(today, -weekdayIndex(today));
  const out: { start: string; miles: number; secs: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const start = addDays(monday, -7 * i);
    const end = addDays(start, 6);
    let miles = 0, secs = 0;
    for (const x of c.sessions) {
      if (x.date >= start && x.date <= end) {
        miles += x.miles ?? 0;
        secs += x.secs ?? 0;
      }
    }
    out.push({ start, miles, secs });
  }
  return out;
}

/** Accepts anything (parsed JSON) and returns valid cardio data. */
export function normalizeCardio(src: unknown): CardioData {
  const s = (src && typeof src === 'object' ? src : {}) as Record<string, any>;
  const plan =
    s.plan && typeof s.plan.start === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.plan.start) ? { start: s.plan.start as string } : null;
  const types = new Set(CARDIO_TYPES.map((t) => t.id));
  const sessions: CardioSession[] = Array.isArray(s.sessions)
    ? s.sessions
        .filter((x: any) => x && typeof x.id === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.date) && types.has(x.type))
        .map((x: any) => {
          const out: CardioSession = { id: x.id, date: x.date, type: x.type };
          if (Number(x.miles) > 0) out.miles = Number(x.miles);
          if (Number(x.secs) > 0) out.secs = Number(x.secs);
          if (typeof x.note === 'string' && x.note) out.note = x.note;
          if (typeof x.planDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.planDay)) out.planDay = x.planDay;
          return out;
        })
    : [];
  const skips = Array.isArray(s.skips) ? s.skips.filter((d: unknown) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) : [];
  return { plan, sessions, skips };
}
