// The numbers behind the Progress graphs: one value per bar (a day, week or month) for cardio, lifting and
// food, and the history of personal records. Pure logic, no React.
//
// Methods, used the same way everywhere:
//   - Pace is total time over total distance for the bar, so longer runs count more.
//   - Heart rate is averaged by duration (a 60-minute run counts twice a 30-minute one).
//   - Estimated one-rep max uses Epley (weight × (1 + reps / 30)), from sets of 12 reps or fewer.
//   - Sets per muscle group: each finished set counts once, toward the exercise's main muscle group.
//     Secondary muscles (the triceps in a bench press) aren't counted, so nothing is counted twice.
//   - Food averages use days with food logged only, so a day you didn't log doesn't drag them down.

import type { CardioSession } from './cardio';
import { MUSCLE_GROUPS, type Exercise, type LiftingData, type Workout } from './lifting';
import { microDay, type MicroKey } from './micros';
import { MEALS, mealOf, sumTotals, type FoodEntry, type MealSlot, type Totals } from './nutrition';
import { bucketOf, type Bucket } from './ranges';
import { e1rm } from './stats';

type Bars = (number | null)[];

const empty = (b: Bucket[]): Bars => b.map(() => null);

/** Adds `v` into its bucket. */
function add(acc: number[], b: Bucket[], s: string, v: number) {
  const i = bucketOf(b, s);
  if (i >= 0) acc[i] += v;
}

// ---------- Cardio ----------

export interface CardioBars {
  miles: Bars;
  /** Seconds per mile. */
  pace: Bars;
  count: Bars;
  avgMiles: Bars;
  hr: Bars;
  /** Minutes. */
  minutes: Bars;
}

/** Everything for the cardio graphs, for one sport's sessions. */
export function cardioBars(sessions: readonly CardioSession[], buckets: Bucket[]): CardioBars {
  const z = () => buckets.map(() => 0);
  const miles = z(), paceMi = z(), paceS = z(), count = z(), hrW = z(), hrS = z(), secs = z();
  for (const x of sessions) {
    add(count, buckets, x.date, 1);
    add(miles, buckets, x.date, x.miles ?? 0);
    add(secs, buckets, x.date, x.secs ?? 0);
    if (x.miles && x.secs && x.miles >= 0.1) {
      add(paceMi, buckets, x.date, x.miles);
      add(paceS, buckets, x.date, x.secs);
    }
    if (x.hr && x.secs) {
      add(hrW, buckets, x.date, x.hr * x.secs);
      add(hrS, buckets, x.date, x.secs);
    }
  }
  return {
    miles: miles.map((v, i) => (count[i] ? Math.round(v * 100) / 100 : null)),
    pace: paceMi.map((m, i) => (m ? paceS[i] / m : null)),
    count: count.map((v) => (v ? v : null)),
    avgMiles: miles.map((v, i) => (count[i] && v ? Math.round((v / count[i]) * 100) / 100 : null)),
    hr: hrS.map((s, i) => (s ? Math.round(hrW[i] / s) : null)),
    minutes: secs.map((v) => (v ? Math.round(v / 60) : null)),
  };
}

// ---------- Lifting ----------

const groupOfMuscle = new Map(MUSCLE_GROUPS.flatMap((g) => g.muscles.map((m) => [m, g.id] as const)));

/** The muscle group an exercise counts toward: its first main muscle's group. */
export function muscleGroupOf(ex: Pick<Exercise, 'primary'> | undefined): string | null {
  for (const m of ex?.primary ?? []) {
    const g = groupOfMuscle.get(m);
    if (g) return g;
  }
  return null;
}

const doneSets = (w: Workout, exId?: string | null) =>
  w.exercises.filter((e) => !exId || e.exId === exId).flatMap((e) => e.sets.filter((s) => s.done));

/** Minutes from start to finish, when the workout was timed (5 minutes to 4 hours). */
export function timedMinutes(w: Workout): number | null {
  if (!w.start || !w.end || w.end <= w.start) return null;
  const m = (w.end - w.start) / 60000;
  return m >= 5 && m <= 240 ? Math.round(m) : null;
}

export interface LiftBars {
  workouts: Bars;
  /** Average reps per finished set (for one exercise, or all). */
  reps: Bars;
  /** Average minutes per timed workout. */
  minutes: Bars;
}

export function liftBars(workouts: readonly Workout[], buckets: Bucket[], exId: string | null = null): LiftBars {
  const z = () => buckets.map(() => 0);
  const n = z(), reps = z(), sets = z(), mins = z(), timed = z();
  for (const w of workouts) {
    if (!w.done) continue;
    add(n, buckets, w.date, 1);
    for (const s of doneSets(w, exId)) {
      if (s.reps) {
        add(reps, buckets, w.date, s.reps);
        add(sets, buckets, w.date, 1);
      }
    }
    const m = timedMinutes(w);
    if (m != null) {
      add(mins, buckets, w.date, m);
      add(timed, buckets, w.date, 1);
    }
  }
  return {
    workouts: n.map((v) => (v ? v : null)),
    reps: sets.map((s, i) => (s ? Math.round((reps[i] / s) * 10) / 10 : null)),
    minutes: timed.map((t, i) => (t ? Math.round(mins[i] / t) : null)),
  };
}

/** Best estimated one-rep max for an exercise in each bar. */
export function e1rmBars(workouts: readonly Workout[], buckets: Bucket[], exId: string): Bars {
  const out = empty(buckets);
  for (const w of workouts) {
    if (!w.done) continue;
    const i = bucketOf(buckets, w.date);
    if (i < 0) continue;
    for (const s of doneSets(w, exId)) {
      if (!s.w || !s.reps || s.reps > 12) continue;
      const v = Math.round(e1rm(s.w, s.reps));
      if (out[i] == null || v > (out[i] as number)) out[i] = v;
    }
  }
  return out;
}

/** Finished sets per muscle group in each bar. */
export function muscleBars(workouts: readonly Workout[], buckets: Bucket[], groupOf: (exId: string) => string | null): Record<string, number[]> {
  const out: Record<string, number[]> = Object.fromEntries(MUSCLE_GROUPS.map((g) => [g.id, buckets.map(() => 0)]));
  for (const w of workouts) {
    if (!w.done) continue;
    const i = bucketOf(buckets, w.date);
    if (i < 0) continue;
    for (const e of w.exercises) {
      const g = groupOf(e.exId);
      if (!g) continue;
      out[g][i] += e.sets.filter((s) => s.done).length;
    }
  }
  return out;
}

/** Exercises with weights in finished workouts, most-done first. */
export function liftedExercises(l: LiftingData): { exId: string; name: string; sessions: number }[] {
  const m = new Map<string, { exId: string; name: string; sessions: number }>();
  for (const w of l.workouts) {
    if (!w.done) continue;
    for (const e of w.exercises) {
      if (!e.sets.some((s) => s.done)) continue;
      const cur = m.get(e.exId) ?? { exId: e.exId, name: e.name, sessions: 0 };
      cur.sessions++;
      m.set(e.exId, cur);
    }
  }
  return [...m.values()].sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name));
}

// ---------- Food ----------

export interface FoodDay {
  s: string;
  t: Totals;
  entries: FoodEntry[];
}

/** Days with food logged, oldest first, up to `today`. */
export function foodDays(meals: Record<string, FoodEntry[]>, today: string): FoodDay[] {
  return Object.keys(meals)
    .filter((s) => s <= today && meals[s]?.length)
    .sort()
    .map((s) => ({ s, t: sumTotals(meals[s]), entries: meals[s] }));
}

/** The average of a daily value over logged days in each bar. Days where `v` is null don't count. */
export function avgBars(days: readonly FoodDay[], buckets: Bucket[], v: (d: FoodDay) => number | null): Bars {
  const sum = buckets.map(() => 0);
  const n = buckets.map(() => 0);
  for (const d of days) {
    const x = v(d);
    if (x == null) continue;
    const i = bucketOf(buckets, d.s);
    if (i < 0) continue;
    sum[i] += x;
    n[i]++;
  }
  return sum.map((s, i) => (n[i] ? s / n[i] : null));
}

/** Calories from each macro: 4 kcal per g of protein and carbs, 9 per g of fat. */
export const macroCalories = (t: Pick<Totals, 'protein' | 'carbs' | 'fat'>) => ({ protein: t.protein * 4, carbs: t.carbs * 4, fat: t.fat * 9 });

/** A day's amount of a micronutrient (or null when none of its foods list it). */
export const microOf = (d: FoodDay, key: MicroKey) => microDay(d.entries, key)?.sum ?? null;

/** Calories per meal for a day. */
export function mealKcal(d: FoodDay): Record<MealSlot, number> {
  const out = Object.fromEntries(MEALS.map((m) => [m.id, 0])) as Record<MealSlot, number>;
  for (const e of d.entries) out[mealOf(e)] += e.n.kcal * e.qty;
  return out;
}

/** Daily macro targets in grams: protein from the diet, fat at 30% of calories (or the diet's cap), carbs the rest. */
export function macroTargets(kcal: number | null, proteinMin: number | null, fatPctMax: number | null, netCarbsMax: number | null): { protein: number | null; carbs: number | null; fat: number | null } {
  if (!kcal) return { protein: proteinMin, carbs: netCarbsMax, fat: null };
  const protein = proteinMin ?? Math.round((kcal * 0.25) / 4);
  const fat = Math.round((kcal * (fatPctMax != null ? Math.min(fatPctMax, 35) : 30)) / 100 / 9);
  const carbs = netCarbsMax ?? Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { protein, carbs, fat };
}

// ---------- Personal records ----------

export interface RecordPoint {
  s: string;
  v: number;
  /** "185 lb × 5", "5.0 mi", "7:45 /mi". */
  text: string;
}

/** Each time a lift's best went up: estimated one-rep max (any set of 2–12 reps) and real singles (1 rep). */
export function liftRecordHistory(l: LiftingData, exId: string): { estimated: RecordPoint[]; actual: RecordPoint[] } {
  const estimated: RecordPoint[] = [];
  const actual: RecordPoint[] = [];
  let bestE = 0;
  let bestA = 0;
  for (const w of [...l.workouts].filter((x) => x.done).sort((a, b) => a.date.localeCompare(b.date) || (a.end ?? 0) - (b.end ?? 0))) {
    for (const s of doneSets(w, exId)) {
      if (!s.w || !s.reps) continue;
      if (s.reps === 1 && s.w > bestA) {
        bestA = s.w;
        actual.push({ s: w.date, v: s.w, text: `${s.w} × 1` });
      }
      if (s.reps >= 2 && s.reps <= 12) {
        const v = Math.round(e1rm(s.w, s.reps));
        if (v > bestE) {
          bestE = v;
          estimated.push({ s: w.date, v, text: `${s.w} × ${s.reps}` });
        }
      }
    }
  }
  return { estimated: dedupeDay(estimated), actual: dedupeDay(actual) };
}

/** Each time a cardio best improved: longest distance, and fastest pace over at least `minMiles`. */
export function cardioRecordHistory(sessions: readonly CardioSession[], minMiles: number): { longest: RecordPoint[]; fastest: RecordPoint[] } {
  const longest: RecordPoint[] = [];
  const fastest: RecordPoint[] = [];
  let far = 0;
  let quick = Infinity;
  for (const x of [...sessions].sort((a, b) => a.date.localeCompare(b.date))) {
    if (x.miles && x.miles > far) {
      far = x.miles;
      longest.push({ s: x.date, v: Math.round(x.miles * 100) / 100, text: '' });
    }
    if (x.miles && x.secs && x.miles >= minMiles) {
      const p = x.secs / x.miles;
      if (p < quick) {
        quick = p;
        fastest.push({ s: x.date, v: p, text: '' });
      }
    }
  }
  return { longest: dedupeDay(longest), fastest: dedupeDay(fastest) };
}

/** Keeps the last record of each day. */
function dedupeDay(pts: RecordPoint[]): RecordPoint[] {
  const out: RecordPoint[] = [];
  for (const p of pts) {
    if (out.length && out[out.length - 1].s === p.s) out[out.length - 1] = p;
    else out.push(p);
  }
  return out;
}

/** Records set within a date range. */
export const recordsIn = (pts: RecordPoint[], from: string, to: string) => pts.filter((p) => p.s >= from && p.s <= to);

// ---------- Muscle map, heart-rate zones, climbing, training-day eating ----------

/** Muscles drawn on the muscle map, as the exercise library names them. */
export const MAP_MUSCLES = [
  'chest', 'shoulders', 'biceps', 'triceps', 'forearms', 'abdominals', 'quadriceps', 'adductors', 'abductors',
  'calves', 'traps', 'lats', 'middle back', 'lower back', 'glutes', 'hamstrings', 'neck',
] as const;
export type MapMuscle = (typeof MAP_MUSCLES)[number];

/**
 * How hard one workout worked each muscle, 0..1: each finished set counts 1 for the exercise's main
 * muscles and ½ for the muscles that help, then scaled so the most-worked muscle is 1.
 */
export function muscleLoad(w: Workout, byId: (exId: string) => Pick<Exercise, 'primary' | 'secondary'> | undefined): Partial<Record<MapMuscle, number>> {
  const raw: Partial<Record<string, number>> = {};
  for (const e of w.exercises) {
    const n = e.sets.filter((s) => s.done).length;
    const ex = byId(e.exId);
    if (!n || !ex) continue;
    for (const m of ex.primary) raw[m] = (raw[m] ?? 0) + n;
    for (const m of ex.secondary) raw[m] = (raw[m] ?? 0) + n / 2;
  }
  const top = Math.max(0, ...MAP_MUSCLES.map((m) => raw[m] ?? 0));
  const out: Partial<Record<MapMuscle, number>> = {};
  if (top) for (const m of MAP_MUSCLES) if (raw[m]) out[m] = raw[m]! / top;
  return out;
}

/** Heart-rate zones as a share of max heart rate: Z1 under 60%, then 60–70, 70–80, 80–90 and 90% or more. */
export const HR_ZONES = [
  { id: 1, label: 'Zone 1', name: 'Very easy', from: 0 },
  { id: 2, label: 'Zone 2', name: 'Easy', from: 0.6 },
  { id: 3, label: 'Zone 3', name: 'Moderate', from: 0.7 },
  { id: 4, label: 'Zone 4', name: 'Hard', from: 0.8 },
  { id: 5, label: 'Zone 5', name: 'Max', from: 0.9 },
] as const;

/** Max heart rate: the highest you've recorded, or 220 minus your age, whichever is higher. Null without either. */
export function maxHeartRate(sessions: readonly Pick<CardioSession, 'hr' | 'maxHr'>[], age: number | null): number | null {
  const seen = Math.max(0, ...sessions.map((x) => x.maxHr ?? 0));
  const est = age ? 220 - age : 0;
  const m = Math.max(seen, est);
  return m >= 100 ? m : null;
}

/** The zone (1–5) for a heart rate. */
export function zoneOf(hr: number, max: number): number {
  const f = hr / max;
  let z = 1;
  for (const x of HR_ZONES) if (f >= x.from) z = x.id;
  return z;
}

/**
 * Minutes in each zone by bucket. Sessions only carry an average heart rate, so each session's moving
 * time goes to the zone of its average.
 */
export function zoneBars(sessions: readonly CardioSession[], buckets: Bucket[], max: number): number[][] {
  const out = HR_ZONES.map(() => buckets.map(() => 0));
  for (const x of sessions) {
    if (!x.hr || !x.secs) continue;
    const i = bucketOf(buckets, x.date);
    if (i < 0) continue;
    out[zoneOf(x.hr, max) - 1][i] += Math.round(x.secs / 60);
  }
  return out;
}

/** Feet climbed by bucket (null where nothing with climbing was logged). */
export function climbBars(sessions: readonly CardioSession[], buckets: Bucket[]): (number | null)[] {
  const out: (number | null)[] = buckets.map(() => null);
  for (const x of sessions) {
    if (!x.elevFt) continue;
    const i = bucketOf(buckets, x.date);
    if (i >= 0) out[i] = (out[i] ?? 0) + x.elevFt;
  }
  return out;
}

export interface DayTypeAverages {
  days: number;
  kcal: number;
  protein: number;
  carbs: number;
}

/** Average eating on days you trained (any finished cardio or lifting) and on rest days, among logged days. */
export function trainingDayEating(days: readonly FoodDay[], trained: (s: string) => boolean): { training: DayTypeAverages | null; rest: DayTypeAverages | null } {
  const avg = (xs: readonly FoodDay[]): DayTypeAverages | null =>
    xs.length
      ? {
          days: xs.length,
          kcal: xs.reduce((t, d) => t + d.t.kcal, 0) / xs.length,
          protein: xs.reduce((t, d) => t + d.t.protein, 0) / xs.length,
          carbs: xs.reduce((t, d) => t + d.t.carbs, 0) / xs.length,
        }
      : null;
  return { training: avg(days.filter((d) => trained(d.s))), rest: avg(days.filter((d) => !trained(d.s))) };
}
