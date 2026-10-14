// Converts data saved by the first version of the app (one 12-week run + push/pull/legs plan, one log per day)
// into the current shape. Nothing logged is dropped:
//   - calories in/out and notes -> days
//   - runs -> cardio sessions, counted toward the plan run they were for; the plan stays on
//   - skipped runs -> plan skips
//   - push/pull/legs -> three routines (same exercises, names and weights) on Mon/Wed/Thu, and every
//     logged lift day -> a finished workout
//   - food, diet, body stats and the deficit goal carry over as they were

import { dayDiff } from './dates';

const PLAN_DAYS = 84;
type OldType = 'push' | 'pull' | 'legs' | 'tempo' | 'easy' | 'long' | 'rest';
const DOW: OldType[] = ['push', 'tempo', 'pull', 'legs', 'easy', 'rest', 'long'];
const RUNS = new Set<OldType>(['tempo', 'easy', 'long']);
const GROUP_NAME = { push: 'Push day', pull: 'Pull day', legs: 'Leg day' } as const;
type Group = keyof typeof GROUP_NAME;

/** The old plan's lifts: id, name, reps per set, week-1 weight, step, unit, main muscle, equipment. */
const OLD_LIFTS: Record<Group, { id: string; name: string; sets: number; reps: number; w: number; inc: number; unit: 'lb' | 'plates'; muscle: string; equipment: string }[]> = {
  push: [
    { id: 'tri', name: 'Tricep extension', sets: 3, reps: 15, w: 35, inc: 5, unit: 'lb', muscle: 'triceps', equipment: 'cable' },
    { id: 'bench', name: 'Dumbbell bench (each)', sets: 3, reps: 8, w: 45, inc: 5, unit: 'lb', muscle: 'chest', equipment: 'dumbbell' },
    { id: 'skull', name: 'EZ bar skull crushers', sets: 3, reps: 15, w: 35, inc: 5, unit: 'lb', muscle: 'triceps', equipment: 'e-z curl bar' },
    { id: 'peck', name: 'Pec deck', sets: 3, reps: 10, w: 100, inc: 5, unit: 'lb', muscle: 'chest', equipment: 'machine' },
    { id: 'ohp', name: 'Shoulder press', sets: 3, reps: 10, w: 40, inc: 5, unit: 'lb', muscle: 'shoulders', equipment: 'dumbbell' },
  ],
  pull: [
    { id: 'row', name: 'Seated cable row, wide', sets: 3, reps: 10, w: 110, inc: 5, unit: 'lb', muscle: 'middle back', equipment: 'cable' },
    { id: 'bicable', name: 'Biceps cable', sets: 3, reps: 12, w: 50, inc: 2.5, unit: 'lb', muscle: 'biceps', equipment: 'cable' },
    { id: 'lat', name: 'Lat pulldown cable', sets: 3, reps: 10, w: 110, inc: 5, unit: 'lb', muscle: 'lats', equipment: 'cable' },
    { id: 'curl', name: 'Bicep curls', sets: 3, reps: 10, w: 35, inc: 5, unit: 'lb', muscle: 'biceps', equipment: 'dumbbell' },
    { id: 'face', name: 'Face pulls / rear delt', sets: 3, reps: 15, w: 85, inc: 5, unit: 'lb', muscle: 'shoulders', equipment: 'cable' },
  ],
  legs: [
    { id: 'lpress', name: 'Leg press', sets: 3, reps: 8, w: 7, inc: 1, unit: 'plates', muscle: 'quadriceps', equipment: 'machine' },
    { id: 'rdl', name: 'Romanian deadlift', sets: 3, reps: 10, w: 65, inc: 5, unit: 'lb', muscle: 'hamstrings', equipment: 'barbell' },
    { id: 'lcurl', name: 'Leg curl', sets: 3, reps: 10, w: 120, inc: 5, unit: 'lb', muscle: 'hamstrings', equipment: 'machine' },
    { id: 'lext', name: 'Leg extension', sets: 3, reps: 10, w: 130, inc: 5, unit: 'lb', muscle: 'quadriceps', equipment: 'machine' },
  ],
};

/** Data from the first version: has a plan start, lift weights or day logs, and no version number. */
export function isV1(s: unknown): boolean {
  if (!s || typeof s !== 'object') return false;
  const o = s as Record<string, unknown>;
  return o.v == null && ('logs' in o || 'base' in o || 'start' in o);
}

const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** The rep range for an old fixed rep count: the old count is the bottom, 4 more is the top. */
export function rangeFor(reps: number): { repMin: number; repMax: number } {
  return { repMin: reps, repMax: reps + 4 };
}

export function migrateV1(src: Record<string, any>): Record<string, unknown> {
  const start = isDate(src.start) ? src.start : '2026-10-05';
  const logs: Record<string, any> = src.logs && typeof src.logs === 'object' ? src.logs : {};
  const base: Record<string, number> = src.base && typeof src.base === 'object' ? src.base : {};

  const planType = (s: string): OldType | null => {
    const diff = dayDiff(s, start);
    return diff < 0 || diff >= PLAN_DAYS ? null : DOW[diff % 7];
  };
  const effective = (s: string, l: any): OldType | null => {
    const own = planType(s);
    if (!own) return null;
    if (l?.makeupFor && isDate(l.makeupFor)) {
      const other = planType(l.makeupFor);
      if (other && other !== 'rest') return other;
    }
    if (l?.swap && DOW.includes(l.swap) && l.swap !== 'rest') return l.swap;
    return own;
  };

  const dates = Object.keys(logs).filter(isDate).sort();
  const submitted = (l: any) => l && typeof l === 'object' && l.submitted !== false;

  // Calories and notes.
  const days: Record<string, any> = {};
  for (const s of dates) {
    const l = logs[s];
    if (!submitted(l)) continue;
    const d: Record<string, unknown> = {};
    if (typeof l.cin === 'number') d.cin = l.cin;
    if (typeof l.cout === 'number') d.cout = l.cout;
    if (typeof l.note === 'string' && l.note) d.note = l.note;
    if (Object.keys(d).length) days[s] = d;
  }

  // Runs and skips.
  const sessions: any[] = [];
  const skips: string[] = [];
  for (const s of dates) {
    const l = logs[s];
    if (!submitted(l)) continue;
    const t = effective(s, l);
    if (l.skipped && t && RUNS.has(t) && !l.swap && !l.makeupFor) skips.push(s);
    const miles = Number(l.miles);
    if (miles > 0) {
      const x: Record<string, unknown> = { id: `m:run:${s}`, date: s, type: 'run', miles };
      if (Number(l.secs) > 0) x.secs = Number(l.secs);
      if (l.makeupFor && isDate(l.makeupFor) && RUNS.has(planType(l.makeupFor) as OldType)) x.planDay = l.makeupFor;
      else if (!l.swap && !l.makeupFor && RUNS.has(planType(s) as OldType)) x.planDay = s;
      sessions.push(x);
    } else if (typeof l.mins === 'number' && l.mins > 0 && RUNS.has(t as OldType)) {
      // Very old logs stored minutes without miles: keep the time.
      sessions.push({ id: `m:run:${s}`, date: s, type: 'run', secs: l.mins * 60 });
    }
  }

  // Lifting: the old exercises as the user's own, three routines, and the logged lift days.
  const lastWeek = dates.length ? Math.max(0, Math.min(11, Math.floor(dayDiff(dates[dates.length - 1], start) / 7))) : 0;
  const exercises: any[] = [];
  const routines: any[] = [];
  (Object.keys(OLD_LIFTS) as Group[]).forEach((g) => {
    const items = OLD_LIFTS[g].map((e) => {
      exercises.push({ id: `m:${e.id}`, name: e.name, equipment: e.equipment, primary: [e.muscle], secondary: [], unit: e.unit });
      const b = typeof base[e.id] === 'number' ? base[e.id] : e.w;
      // Where the old plan had the weight by the last logged week (it went up every 3 weeks).
      const startW = +(b + e.inc * Math.floor(lastWeek / 3)).toFixed(2);
      return { exId: `m:${e.id}`, sets: e.sets, ...rangeFor(e.reps), inc: e.inc, start: startW };
    });
    routines.push({ id: `m:${g}`, name: GROUP_NAME[g], items });
  });
  const workouts: any[] = [];
  for (const s of dates) {
    const l = logs[s];
    if (!submitted(l) || l.skipped || !l.lifts || typeof l.lifts !== 'object') continue;
    const t = effective(s, l);
    if (t !== 'push' && t !== 'pull' && t !== 'legs') continue;
    const ex = OLD_LIFTS[t].map((e) => {
      const rec = l.lifts[e.id];
      const w = rec && typeof rec.w === 'number' ? rec.w : null;
      const done = !!rec?.done;
      const { repMin, repMax } = rangeFor(e.reps);
      return {
        exId: `m:${e.id}`,
        name: e.name,
        unit: e.unit,
        repMin,
        repMax,
        inc: e.inc,
        // Checked = all sets done at the old target reps.
        sets: Array.from({ length: e.sets }, () => ({ w, reps: done ? e.reps : null, done })),
      };
    });
    if (!ex.some((x) => x.sets.some((st) => st.done))) continue;
    workouts.push({ id: `m:lift:${s}`, date: s, routineId: `m:${t}`, name: GROUP_NAME[t], done: true, exercises: ex });
  }

  return {
    v: 2,
    updatedAt: 1,
    settings: { name: '', sections: { food: src.foodLog !== false, cardio: true, lifting: true }, onboarded: false },
    goal: src.goal ?? null,
    days,
    foods: src.foods,
    meals: src.meals,
    diet: src.diet,
    profile: src.profile,
    cardio: { plan: { id: 'run-half', start }, sessions, skips },
    lifting: { exercises, routines, schedule: ['m:push', null, 'm:pull', 'm:legs', null, null, null], workouts },
  };
}
