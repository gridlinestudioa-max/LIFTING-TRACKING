// Lifting: an exercise library, routines on a weekly schedule, logged workouts (sets × reps × weight),
// and double progression. Pure logic, no React.
//
// Double progression: each exercise has a rep range (e.g. 3 × 8–12). Keep the weight until you get the
// top of the range on every set, then add weight (5 lb upper body, 10 lb lower body) and start again at the
// bottom of the range. Three sessions in a row below the bottom of the range drops the weight about 10%.

import { addDays, weekdayIndex } from './dates';

export type Unit = 'lb' | 'plates';

export interface Exercise {
  id: string;
  name: string;
  equipment: string;
  primary: string[];
  secondary: string[];
  mechanic?: string;
  level?: string;
  instructions?: string[];
  /** Image URL, for library exercises. */
  image?: string;
  /** Made by the user. */
  custom?: boolean;
  /** Weight unit. Plates for machines counted in plates. */
  unit?: Unit;
}

export interface RoutineItem {
  exId: string;
  sets: number;
  repMin: number;
  repMax: number;
  /** Weight added when the top of the range is reached. Defaults by exercise (see `defaultIncrement`). */
  inc?: number;
  /** Starting weight when there's no history. */
  start?: number;
}

export interface Routine {
  id: string;
  name: string;
  items: RoutineItem[];
}

export interface WSet {
  /** Weight used (lb or plates); null for bodyweight or not entered. */
  w: number | null;
  reps: number | null;
  done: boolean;
}

/** An exercise in a workout. The rep range and increment are copied in, so history doesn't change later. */
export interface WorkoutExercise {
  exId: string;
  name: string;
  unit: Unit;
  repMin: number;
  repMax: number;
  inc: number;
  sets: WSet[];
}

export interface Workout {
  id: string;
  date: string;
  /** Routine it was started from, if any. */
  routineId?: string;
  name: string;
  /** Finished. Only finished workouts count toward progression and stats. */
  done: boolean;
  exercises: WorkoutExercise[];
  note?: string;
}

export interface LiftingData {
  /** Exercises the user made. The library ones aren't stored. */
  exercises: Exercise[];
  routines: Routine[];
  /** Routine id for each weekday, Monday = 0. */
  schedule: (string | null)[];
  workouts: Workout[];
}

export const EMPTY_LIFTING: LiftingData = { exercises: [], routines: [], schedule: [null, null, null, null, null, null, null], workouts: [] };

export const MUSCLE_GROUPS: { id: string; label: string; muscles: string[] }[] = [
  { id: 'chest', label: 'Chest', muscles: ['chest'] },
  { id: 'back', label: 'Back', muscles: ['lats', 'middle back', 'lower back', 'traps'] },
  { id: 'shoulders', label: 'Shoulders', muscles: ['shoulders'] },
  { id: 'arms', label: 'Arms', muscles: ['biceps', 'triceps', 'forearms'] },
  { id: 'legs', label: 'Legs', muscles: ['quadriceps', 'hamstrings', 'glutes', 'calves', 'adductors', 'abductors'] },
  { id: 'core', label: 'Core', muscles: ['abdominals'] },
];

export const EQUIPMENT = ['barbell', 'dumbbell', 'cable', 'machine', 'body only', 'kettlebells', 'e-z curl bar', 'bands', 'other'];

const LOWER = new Set(['quadriceps', 'hamstrings', 'glutes', 'calves', 'adductors', 'abductors', 'lower back']);

export function isLowerBody(e: Pick<Exercise, 'primary'>): boolean {
  return e.primary.some((m) => LOWER.has(m));
}

export function isBodyweight(e: Pick<Exercise, 'equipment'>): boolean {
  return e.equipment === 'body only';
}

/** Weight added per step: 1 plate, 0 for bodyweight, 10 lb for lower body on a bar or machine, else 5 lb. */
export function defaultIncrement(e: Pick<Exercise, 'primary' | 'equipment' | 'unit'>): number {
  if (e.unit === 'plates') return 1;
  if (isBodyweight(e)) return 0;
  if (isLowerBody(e) && ['barbell', 'machine', 'other', 'cable'].includes(e.equipment)) return 10;
  return 5;
}

/** Round to the nearest step (2.5 lb when there's no step). */
export function roundTo(w: number, step: number): number {
  const s = step > 0 ? step : 2.5;
  return Math.max(0, Math.round(w / s) * s);
}

// ---------- Progression ----------

export type TargetReason = 'start' | 'up' | 'hold' | 'miss' | 'deload';

export interface Target {
  /** Weight to use next time (null = bodyweight / not set). */
  weight: number | null;
  sets: number;
  repMin: number;
  repMax: number;
  reason: TargetReason;
  /** Sessions in a row below the bottom of the range. */
  misses: number;
  /** The last time this exercise was done: weight and reps per set. */
  last?: { date: string; sets: WSet[] };
}

/** Did every planned set get done at the top of the range? */
function result(x: WorkoutExercise): { weight: number | null; top: boolean; miss: boolean } | null {
  const done = x.sets.filter((s) => s.done && s.reps != null && s.reps > 0);
  if (!done.length) return null;
  const ws = done.map((s) => s.w).filter((w): w is number => w != null && w > 0);
  const weight = ws.length ? Math.max(...ws) : null;
  // Sets at the working weight (or bodyweight).
  const working = done.filter((s) => (weight == null ? true : s.w === weight));
  const top = x.sets.length > 0 && working.length >= x.sets.length && working.every((s) => s.reps! >= x.repMax);
  const miss = done.length < x.sets.length || done.some((s) => s.reps! < x.repMin);
  return { weight, top, miss };
}

/**
 * What to do next time for an exercise, from finished workouts. `plan` is the routine's
 * sets, rep range, increment and starting weight.
 */
export function nextTarget(
  exId: string,
  workouts: readonly Workout[],
  plan: { sets: number; repMin: number; repMax: number; inc: number; start?: number },
): Target {
  const history = workouts
    .filter((w) => w.done)
    .sort((a, b) => a.date.localeCompare(b.date))
    .flatMap((w) => w.exercises.filter((x) => x.exId === exId).map((x) => ({ date: w.date, x })));

  let weight: number | null = plan.start ?? null;
  let misses = 0;
  let reason: TargetReason = 'start';
  let last: Target['last'];
  for (const { date, x } of history) {
    const r = result(x);
    if (!r) continue;
    last = { date, sets: x.sets };
    const used = r.weight ?? weight;
    if (r.top) {
      weight = used == null ? null : used + x.inc;
      misses = 0;
      reason = 'up';
    } else if (r.miss) {
      misses++;
      if (misses >= 3 && used != null) {
        weight = roundTo(used * 0.9, x.inc);
        misses = 0;
        reason = 'deload';
      } else {
        weight = used;
        reason = 'miss';
      }
    } else {
      weight = used;
      misses = 0;
      reason = 'hold';
    }
  }
  return { weight, sets: plan.sets, repMin: plan.repMin, repMax: plan.repMax, reason, misses, last };
}

/** One line saying why the target is what it is. */
export function targetNote(t: Target, unit: Unit = 'lb', bodyweight = false): string {
  const u = unit === 'plates' ? 'plates' : 'lb';
  const range = `${t.repMin}–${t.repMax}`;
  switch (t.reason) {
    case 'start':
      return t.weight != null ? `Starting weight. Aim for ${range} reps.` : `Aim for ${range} reps.`;
    case 'up':
      return bodyweight || t.weight == null
        ? `You hit ${t.repMax} on every set. Add weight or a harder version.`
        : `You hit ${t.repMax} on every set last time, so the weight goes up to ${fmtW(t.weight)} ${u}.`;
    case 'hold':
      return `Same weight. Get ${t.repMax} reps on every set to move up.`;
    case 'miss':
      return `Below ${t.repMin} reps last time (${t.misses} of 3). Same weight; three in a row and it drops 10%.`;
    case 'deload':
      return `Three sessions under ${t.repMin} reps, so the weight drops about 10% to rebuild.`;
  }
}

export const fmtW = (w: number) => String(Math.round(w * 100) / 100);

// ---------- Workouts ----------

/** The routine scheduled for a date, or null. */
export function scheduledRoutine(l: LiftingData, s: string): Routine | null {
  const id = l.schedule[weekdayIndex(s)];
  return (id && l.routines.find((r) => r.id === id)) || null;
}

/** A new workout from a routine, with each exercise's sets prefilled at its target weight. */
export function workoutFromRoutine(
  l: LiftingData,
  r: Routine,
  date: string,
  exById: (id: string) => Exercise | undefined,
  id: string,
): Workout {
  return {
    id,
    date,
    routineId: r.id,
    name: r.name,
    done: false,
    exercises: r.items.map((it) => workoutExercise(l, it, exById)),
  };
}

/** An exercise as it starts in a workout: planned sets at the target weight, reps blank. */
export function workoutExercise(l: LiftingData, it: RoutineItem, exById: (id: string) => Exercise | undefined): WorkoutExercise {
  const ex = exById(it.exId);
  const inc = it.inc ?? (ex ? defaultIncrement(ex) : 5);
  const t = nextTarget(it.exId, l.workouts, { sets: it.sets, repMin: it.repMin, repMax: it.repMax, inc, start: it.start });
  return {
    exId: it.exId,
    name: ex?.name ?? 'Exercise',
    unit: ex?.unit ?? 'lb',
    repMin: it.repMin,
    repMax: it.repMax,
    inc,
    sets: Array.from({ length: it.sets }, () => ({ w: t.weight, reps: null, done: false })),
  };
}

/** Defaults for adding an exercise outside a routine: the last range used, or 3 × 8–12. */
export function defaultItem(l: LiftingData, exId: string): RoutineItem {
  for (const w of [...l.workouts].sort((a, b) => b.date.localeCompare(a.date))) {
    const x = w.exercises.find((e) => e.exId === exId);
    if (x) return { exId, sets: x.sets.length || 3, repMin: x.repMin, repMax: x.repMax, inc: x.inc };
  }
  for (const r of l.routines) {
    const it = r.items.find((i) => i.exId === exId);
    if (it) return it;
  }
  return { exId, sets: 3, repMin: 8, repMax: 12 };
}

/** The workout in progress (not finished), if any. */
export function activeWorkout(l: LiftingData): Workout | null {
  return l.workouts.find((w) => !w.done) ?? null;
}

/** Total weight × reps over done sets (lb only). */
export function volume(w: Workout): number {
  let v = 0;
  for (const x of w.exercises) {
    if (x.unit !== 'lb') continue;
    for (const s of x.sets) if (s.done && s.w && s.reps) v += s.w * s.reps;
  }
  return v;
}

/** What changed for each exercise when a workout is finished: next time's target vs this time. */
export function progressionSummary(l: LiftingData, w: Workout): { name: string; from: number | null; to: number | null; note: string; unit: Unit }[] {
  const others = l.workouts.filter((x) => x.id !== w.id);
  const withThis = [...others, { ...w, done: true }];
  return w.exercises.map((x) => {
    const plan = { sets: x.sets.length, repMin: x.repMin, repMax: x.repMax, inc: x.inc };
    const before = nextTarget(x.exId, others, plan);
    const after = nextTarget(x.exId, withThis, { ...plan, start: before.weight ?? undefined });
    return { name: x.name, from: before.weight, to: after.weight, note: targetNote(after, x.unit, after.weight == null), unit: x.unit };
  });
}

/** Heaviest weight lifted for an exercise in each finished workout, oldest first. */
export function weightHistory(l: LiftingData, exId: string): { date: string; w: number }[] {
  const out: { date: string; w: number }[] = [];
  for (const wk of [...l.workouts].filter((x) => x.done).sort((a, b) => a.date.localeCompare(b.date))) {
    for (const x of wk.exercises) {
      if (x.exId !== exId) continue;
      const ws = x.sets.filter((s) => s.done && s.w != null && s.w > 0).map((s) => s.w!);
      if (ws.length) out.push({ date: wk.date, w: Math.max(...ws) });
    }
  }
  return out;
}

/** Finished workouts in the 7 days ending `today`, and this week's (Mon–Sun) scheduled days done. */
export function liftWeek(l: LiftingData, today: string): { day: string; routine: Routine | null; done: Workout | null }[] {
  const monday = addDays(today, -weekdayIndex(today));
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(monday, i);
    return {
      day,
      routine: scheduledRoutine(l, day),
      done: l.workouts.find((w) => w.done && w.date === day) ?? null,
    };
  });
}

// ---------- Saved data ----------

const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const pos = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : d);

/** Accepts anything (parsed JSON) and returns valid lifting data. */
export function normalizeLifting(src: unknown): LiftingData {
  const s = (src && typeof src === 'object' ? src : {}) as Record<string, any>;
  const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  const exercises: Exercise[] = Array.isArray(s.exercises)
    ? s.exercises
        .filter((e: any) => e && typeof e.id === 'string' && typeof e.name === 'string')
        .map((e: any) => {
          const out: Exercise = { id: e.id, name: e.name, equipment: typeof e.equipment === 'string' ? e.equipment : 'other', primary: strs(e.primary), secondary: strs(e.secondary), custom: true };
          if (e.unit === 'plates') out.unit = 'plates';
          return out;
        })
    : [];
  const item = (i: any): RoutineItem | null => {
    if (!i || typeof i.exId !== 'string') return null;
    const repMin = Math.round(pos(i.repMin, 8));
    const out: RoutineItem = { exId: i.exId, sets: Math.round(pos(i.sets, 3)), repMin, repMax: Math.max(repMin, Math.round(pos(i.repMax, 12))) };
    if (typeof i.inc === 'number' && i.inc >= 0) out.inc = i.inc;
    if (typeof i.start === 'number' && i.start >= 0) out.start = i.start;
    return out;
  };
  const routines: Routine[] = Array.isArray(s.routines)
    ? s.routines
        .filter((r: any) => r && typeof r.id === 'string')
        .map((r: any) => ({ id: r.id, name: typeof r.name === 'string' ? r.name : 'Workout', items: (Array.isArray(r.items) ? r.items : []).map(item).filter(Boolean) as RoutineItem[] }))
    : [];
  const ids = new Set(routines.map((r) => r.id));
  const schedule = Array.from({ length: 7 }, (_, i) => {
    const v = Array.isArray(s.schedule) ? s.schedule[i] : null;
    return typeof v === 'string' && ids.has(v) ? v : null;
  });
  const set = (x: any): WSet => ({
    w: typeof x?.w === 'number' && Number.isFinite(x.w) && x.w >= 0 ? x.w : null,
    reps: typeof x?.reps === 'number' && Number.isFinite(x.reps) && x.reps >= 0 ? Math.round(x.reps) : null,
    done: !!x?.done,
  });
  const workouts: Workout[] = Array.isArray(s.workouts)
    ? s.workouts
        .filter((w: any) => w && typeof w.id === 'string' && isDate(w.date))
        .map((w: any) => {
          const out: Workout = {
            id: w.id,
            date: w.date,
            name: typeof w.name === 'string' ? w.name : 'Workout',
            done: !!w.done,
            exercises: (Array.isArray(w.exercises) ? w.exercises : [])
              .filter((x: any) => x && typeof x.exId === 'string')
              .map((x: any) => {
                const repMin = Math.round(pos(x.repMin, 8));
                return {
                  exId: x.exId,
                  name: typeof x.name === 'string' ? x.name : 'Exercise',
                  unit: x.unit === 'plates' ? 'plates' : 'lb',
                  repMin,
                  repMax: Math.max(repMin, Math.round(pos(x.repMax, 12))),
                  inc: typeof x.inc === 'number' && x.inc >= 0 ? x.inc : 5,
                  sets: (Array.isArray(x.sets) ? x.sets : []).map(set),
                } as WorkoutExercise;
              }),
          };
          if (typeof w.routineId === 'string') out.routineId = w.routineId;
          if (typeof w.note === 'string' && w.note) out.note = w.note;
          return out;
        })
    : [];
  return { exercises, routines, schedule, workouts };
}
