// Cardio: any session (run, ride, swim, ...) logged freely, plus an optional training plan (plans.ts).
// Pure logic, no React.

import { DONE_RATIO } from './config';
import { addDays, dayDiff, weekdayIndex } from './dates';
import { fmt } from './format';
import { METERS_PER_MILE, PLAN_BY_ID, isPlanId, toMiles, type CardioPlan, type PlanDef, type Sport, type WorkoutKind } from './plans';

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
  /** Distance in miles (swims too: shown in meters). */
  miles?: number;
  /** Duration in seconds. */
  secs?: number;
  note?: string;
  /**
   * The planned workout this session counts toward: the plan date, matched with this session's sport
   * (a run on a plan day, or a planned workout made up on another day).
   */
  planDay?: string;
}

export interface CardioData {
  /** The training plan, if any. `start` is a Monday. */
  plan: CardioPlan | null;
  sessions: CardioSession[];
  /** Planned workouts skipped on purpose: "date|sport" (or just "date", from earlier versions: the whole day). */
  skips: string[];
}

export const EMPTY_CARDIO: CardioData = { plan: null, sessions: [], skips: [] };

// ---------- Distances ----------

/** "3.1 mi", or "750 m" for swims. */
export function distText(type: CardioType, miles: number): string {
  if (type === 'swim') return `${Math.round(miles * METERS_PER_MILE).toLocaleString('en-US')} m`;
  return `${fmt(Math.round(miles * 100) / 100)} mi`;
}

// ---------- The plan ----------

export const KIND_LABEL: Record<WorkoutKind, string> = {
  easy: 'Easy', tempo: 'Tempo', intervals: 'Intervals', long: 'Long', brick: 'Brick', race: 'Race',
};

/** Shorter labels for calendar cells. */
export const KIND_SHORT: Record<WorkoutKind, string> = { ...KIND_LABEL, intervals: 'Speed' };

/** Where a new plan starts by default: today if it's a Monday, otherwise next Monday (so nothing starts out missed). */
export function defaultPlanStart(today: string): string {
  const wd = weekdayIndex(today);
  return wd === 0 ? today : addDays(today, 7 - wd);
}

export const KIND_TIPS: Record<WorkoutKind, string> = {
  easy: 'Easy, relaxed effort. You could hold a conversation.',
  tempo: 'Comfortably hard: steady, a bit below race effort.',
  intervals: 'Hard efforts with easy recoveries, e.g. 4–6 × 3 minutes hard, 2 minutes easy.',
  long: 'Slow and steady. Finishing matters more than speed.',
  brick: 'Bike, then run straight after. It trains your legs for the switch.',
  race: 'Race day. Start easy, finish strong.',
};

export const SPORT_LABEL: Record<Sport, string> = { run: 'Run', bike: 'Ride', swim: 'Swim' };

/** One planned workout on one date. */
export interface PlannedWorkout {
  date: string;
  /** 0-based plan week. */
  w: number;
  sport: Sport;
  kind: WorkoutKind;
  /** Planned distance in miles (as sessions store it). */
  miles: number;
  race: boolean;
}

export const planDef = (plan: CardioPlan | null): PlanDef | null => (plan ? PLAN_BY_ID[plan.id] ?? null : null);

/** Number of weeks, or null for a plan that repeats with no end. */
export const planWeeks = (plan: CardioPlan | null): number | null => planDef(plan)?.weeks ?? null;

/** Race day, or null (no plan, or a plan without a race). */
export function raceDay(plan: CardioPlan | null): string | null {
  const def = planDef(plan);
  if (!plan || !def?.race || def.weeks == null) return null;
  return addDays(plan.start, (def.weeks - 1) * 7 + def.race.day);
}

/** Last day of the plan (race day for race plans), or null when it never ends. */
export function planEnd(plan: CardioPlan | null): string | null {
  const weeks = planWeeks(plan);
  return plan && weeks != null ? (raceDay(plan) ?? addDays(plan.start, weeks * 7 - 1)) : null;
}

/** Plan week (0-based) for a date, or null outside the plan. */
export function planWeek(plan: CardioPlan | null, s: string): number | null {
  if (!plan || !planDef(plan)) return null;
  const diff = dayDiff(s, plan.start);
  if (diff < 0) return null;
  const weeks = planWeeks(plan);
  if (weeks != null && diff >= weeks * 7) return null;
  return Math.floor(diff / 7);
}

/** The workouts planned on a date (none on rest days and outside the plan). */
export function plannedOn(plan: CardioPlan | null, s: string): PlannedWorkout[] {
  const def = planDef(plan);
  const w = planWeek(plan, s);
  if (!def || w == null) return [];
  const day = weekdayIndex(s);
  const last = def.weeks != null && w === def.weeks - 1;
  if (last && def.race && def.race.day === day) {
    return def.race.parts.map((p) => ({ date: s, w, sport: p.sport, kind: 'race', miles: toMiles(p.sport, p.dist), race: true }));
  }
  return def.slots
    .filter((x) => x.day === day)
    .map((x) => ({ date: s, w, sport: x.sport, kind: x.kind, miles: toMiles(x.sport, x.dist(w)), race: false }));
}

/** The workout of one sport planned on a date, if any. */
export function plannedFor(plan: CardioPlan | null, s: string, sport: CardioType): PlannedWorkout | null {
  return plannedOn(plan, s).find((x) => x.sport === sport) ?? null;
}

/** Sessions counting toward a planned workout. */
export function sessionsToward(c: CardioData, wk: { date: string; sport: Sport }): CardioSession[] {
  return c.sessions.filter((x) => x.planDay === wk.date && x.type === wk.sport);
}

/** Distance (miles) logged toward a planned workout. */
export function milesToward(c: CardioData, wk: { date: string; sport: Sport }): number {
  return sessionsToward(c, wk).reduce((t, x) => t + (x.miles ?? 0), 0);
}

export const skipKey = (wk: { date: string; sport: Sport }) => `${wk.date}|${wk.sport}`;

export function isSkipped(c: CardioData, wk: { date: string; sport: Sport }): boolean {
  return c.skips.includes(skipKey(wk)) || c.skips.includes(wk.date);
}

export type RunStatus = 'done' | 'partial' | 'missed' | 'skipped' | 'moved' | 'open';

/**
 * Status of a planned workout. 'moved' = done on another day. Done at 90% of the planned distance;
 * partial and missed only once the day has passed.
 */
export function workoutStatus(c: CardioData, wk: PlannedWorkout, today: string): RunStatus {
  const mine = sessionsToward(c, wk);
  const miles = mine.reduce((t, x) => t + (x.miles ?? 0), 0);
  if (miles >= wk.miles * DONE_RATIO) return mine.every((x) => x.date === wk.date) ? 'done' : 'moved';
  if (isSkipped(c, wk)) return 'skipped';
  if (wk.date < today) return miles > 0 ? 'partial' : 'missed';
  return 'open';
}

/** One status for a whole day's plan (for the calendar), or null with nothing planned. */
export function dayStatus(c: CardioData, s: string, today: string): RunStatus | null {
  const list = plannedOn(c.plan, s).map((wk) => workoutStatus(c, wk, today));
  if (!list.length) return null;
  const all = (...v: RunStatus[]) => list.every((x) => v.includes(x));
  if (all('done', 'moved', 'skipped') && list.some((x) => x === 'done' || x === 'moved')) return list.every((x) => x === 'moved') ? 'moved' : 'done';
  if (all('skipped')) return 'skipped';
  if (list.includes('open')) return 'open';
  if (all('missed', 'skipped')) return 'missed';
  return 'partial';
}

/**
 * Planned workouts a session of `sport` on day s could count toward: the one planned that day, others this
 * plan week that aren't done yet, and ones skipped or missed in the past 7 days.
 */
export function planDayOptions(c: CardioData, s: string, today: string, sport: CardioType = 'run'): { s: string; wk: PlannedWorkout }[] {
  const out: { s: string; wk: PlannedWorkout }[] = [];
  const week = planWeek(c.plan, s);
  for (let d = -7; d <= 6; d++) {
    const k = addDays(s, d);
    const wk = plannedFor(c.plan, k, sport);
    if (!wk) continue;
    if (d === 0) {
      out.push({ s: k, wk });
      continue;
    }
    const st = workoutStatus(c, wk, today);
    const sameWeek = week != null && wk.w === week;
    const open = st === 'open' || st === 'missed' || st === 'partial' || st === 'skipped';
    if (!open) continue;
    if (sameWeek || (d < 0 && (st === 'missed' || st === 'skipped' || st === 'partial'))) out.push({ s: k, wk });
  }
  return out.sort((a, b) => (a.s === s ? -1 : b.s === s ? 1 : a.s.localeCompare(b.s)));
}

/** The planned workout a new session on day s counts toward by default: that day's, if it's the same sport. */
export function defaultPlanDay(c: CardioData, s: string, type: CardioType): string | undefined {
  return plannedFor(c.plan, s, type) ? s : undefined;
}

/** Every planned workout from the start to the end (or, for plans with no end, through the week of `today`). */
export function allPlanned(plan: CardioPlan | null, today: string): PlannedWorkout[] {
  if (!plan || !planDef(plan)) return [];
  const end = planEnd(plan) ?? addDays(today, 6 - weekdayIndex(today));
  const out: PlannedWorkout[] = [];
  for (let s = plan.start; s <= end; s = addDays(s, 1)) out.push(...plannedOn(plan, s));
  return out;
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
  /** Planned workouts: done (or done on another day), due so far (anything not still open), missed or partial, skipped. */
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
  for (const wk of allPlanned(c.plan, today)) {
    const st = workoutStatus(c, wk, today);
    if (st === 'done' || st === 'moved') planDone++;
    if (st === 'missed' || st === 'partial') planMissed++;
    if (st === 'skipped') planSkipped++;
    if (st !== 'open') planDue++;
  }
  return { sessions: c.sessions.length, miles, secs, longestRun, paceMiles, paceSecs, planDone, planDue, planMissed, planSkipped };
}

export interface WeekBar {
  label: string;
  planned: number;
  actual: number;
}

/**
 * Plan weeks, for plans with an end: per sport, total distance planned vs logged (miles), and for
 * single-sport plans the long session (planned vs the most logged toward a long day).
 */
export function planWeekRows(c: CardioData): { sports: { sport: Sport; rows: WeekBar[] }[]; long: WeekBar[] } {
  const def = planDef(c.plan);
  if (!c.plan || !def || def.weeks == null) return { sports: [], long: [] };
  const sports = [...new Set(def.slots.map((x) => x.sport))];
  const bySport = new Map<Sport, WeekBar[]>(sports.map((sp) => [sp, []]));
  const long: WeekBar[] = [];
  for (let w = 0; w < def.weeks; w++) {
    const ws = addDays(c.plan.start, w * 7);
    const planned = new Map<Sport, number>();
    const actual = new Map<Sport, number>();
    let longPlanned = 0, longActual = 0;
    for (let d = 0; d < 7; d++) {
      const ds = addDays(ws, d);
      for (const wk of plannedOn(c.plan, ds)) {
        planned.set(wk.sport, (planned.get(wk.sport) ?? 0) + wk.miles);
        if (wk.kind === 'long' || wk.kind === 'race') {
          longPlanned = Math.max(longPlanned, wk.miles);
          longActual = Math.max(longActual, milesToward(c, wk));
        }
      }
      for (const x of c.sessions) if (x.date === ds && bySport.has(x.type as Sport)) actual.set(x.type as Sport, (actual.get(x.type as Sport) ?? 0) + (x.miles ?? 0));
    }
    for (const sp of sports) bySport.get(sp)!.push({ label: `W${w + 1}`, planned: planned.get(sp) ?? 0, actual: actual.get(sp) ?? 0 });
    long.push({ label: `W${w + 1}`, planned: longPlanned, actual: longActual });
  }
  return { sports: sports.map((sport) => ({ sport, rows: bySport.get(sport)! })), long: sports.length === 1 ? long : [] };
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
  const okDate = (d: unknown): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
  // Plans saved before there was a choice of plans were the half marathon.
  const plan: CardioPlan | null =
    s.plan && okDate(s.plan.start) && (s.plan.id == null || isPlanId(s.plan.id)) ? { id: s.plan.id ?? 'run-half', start: s.plan.start } : null;
  const types = new Set(CARDIO_TYPES.map((t) => t.id));
  const sessions: CardioSession[] = Array.isArray(s.sessions)
    ? s.sessions
        .filter((x: any) => x && typeof x.id === 'string' && okDate(x.date) && types.has(x.type))
        .map((x: any) => {
          const out: CardioSession = { id: x.id, date: x.date, type: x.type };
          if (Number(x.miles) > 0) out.miles = Number(x.miles);
          if (Number(x.secs) > 0) out.secs = Number(x.secs);
          if (typeof x.note === 'string' && x.note) out.note = x.note;
          if (okDate(x.planDay)) out.planDay = x.planDay;
          return out;
        })
    : [];
  const skips = Array.isArray(s.skips)
    ? s.skips.filter((d: unknown) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}(\|(run|bike|swim))?$/.test(d))
    : [];
  return { plan, sessions, skips };
}
