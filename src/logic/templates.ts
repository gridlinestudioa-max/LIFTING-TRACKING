// Lifting plans: a split (push/pull/legs, upper/lower, full body, body part, or your own) for 3 to 7 days a week.
// Exercise ids are from the built-in library ("x:" + free-exercise-db id). No starting weights: the first
// workout asks for them, then progression takes over. When a plan has more days than distinct workouts,
// a workout repeats in the week (e.g. Upper A on Monday and Friday) and progression carries across both.

import type { LiftingData, Routine, RoutineItem } from './lifting';

const it = (id: string, sets: number, repMin: number, repMax: number): RoutineItem => ({ exId: `x:${id}`, sets, repMin, repMax });
const r = (id: string, name: string, items: RoutineItem[]): Routine => ({ id: `t:${id}`, name, items });

// ---------- Workouts ----------

const pushA = r('pushA', 'Push', [
  it('Barbell_Bench_Press_-_Medium_Grip', 3, 6, 10),
  it('Dumbbell_Shoulder_Press', 3, 8, 12),
  it('Incline_Dumbbell_Press', 3, 8, 12),
  it('Side_Lateral_Raise', 3, 12, 15),
  it('Triceps_Pushdown', 3, 10, 15),
]);
const pullA = r('pullA', 'Pull', [
  it('Bent_Over_Barbell_Row', 3, 6, 10),
  it('Wide-Grip_Lat_Pulldown', 3, 8, 12),
  it('Seated_Cable_Rows', 3, 10, 12),
  it('Face_Pull', 3, 12, 15),
  it('Barbell_Curl', 3, 8, 12),
]);
const legsA = r('legsA', 'Legs', [
  it('Barbell_Squat', 3, 5, 8),
  it('Romanian_Deadlift', 3, 8, 10),
  it('Leg_Press', 3, 10, 12),
  it('Lying_Leg_Curls', 3, 10, 12),
  it('Standing_Calf_Raises', 3, 10, 15),
]);
const pushB = r('pushB', 'Push B', [
  it('Barbell_Incline_Bench_Press_-_Medium_Grip', 3, 6, 10),
  it('Standing_Military_Press', 3, 6, 10),
  it('Dips_-_Chest_Version', 3, 8, 12),
  it('Cable_Crossover', 3, 12, 15),
  it('Lying_Triceps_Press', 3, 10, 12),
]);
const pullB = r('pullB', 'Pull B', [
  it('Barbell_Deadlift', 3, 4, 6),
  it('Pullups', 3, 6, 10),
  it('One-Arm_Dumbbell_Row', 3, 8, 12),
  it('Reverse_Flyes', 3, 12, 15),
  it('Hammer_Curls', 3, 10, 12),
]);
const legsB = r('legsB', 'Legs B', [
  it('Front_Barbell_Squat', 3, 6, 8),
  it('Barbell_Hip_Thrust', 3, 8, 12),
  it('Leg_Extensions', 3, 12, 15),
  it('Seated_Leg_Curl', 3, 10, 12),
  it('Seated_Calf_Raise', 3, 12, 15),
]);
const upperA = r('upperA', 'Upper A', [
  it('Barbell_Bench_Press_-_Medium_Grip', 3, 6, 10),
  it('Bent_Over_Barbell_Row', 3, 6, 10),
  it('Dumbbell_Shoulder_Press', 3, 8, 12),
  it('Wide-Grip_Lat_Pulldown', 3, 8, 12),
  it('Barbell_Curl', 2, 10, 12),
  it('Triceps_Pushdown', 2, 10, 12),
]);
const lowerA = r('lowerA', 'Lower A', [
  it('Barbell_Squat', 3, 5, 8),
  it('Romanian_Deadlift', 3, 8, 10),
  it('Leg_Press', 3, 10, 12),
  it('Seated_Leg_Curl', 3, 10, 12),
  it('Standing_Calf_Raises', 3, 10, 15),
]);
const upperB = r('upperB', 'Upper B', [
  it('Standing_Military_Press', 3, 6, 10),
  it('Pullups', 3, 6, 10),
  it('Incline_Dumbbell_Press', 3, 8, 12),
  it('Seated_Cable_Rows', 3, 10, 12),
  it('Hammer_Curls', 2, 10, 12),
  it('Lying_Triceps_Press', 2, 10, 12),
]);
const lowerB = r('lowerB', 'Lower B', [
  it('Barbell_Deadlift', 3, 4, 6),
  it('Front_Barbell_Squat', 3, 6, 8),
  it('Barbell_Walking_Lunge', 3, 8, 12),
  it('Leg_Extensions', 3, 12, 15),
  it('Seated_Calf_Raise', 3, 12, 15),
]);
const fullA = r('fullA', 'Full body A', [
  it('Barbell_Squat', 3, 5, 8),
  it('Barbell_Bench_Press_-_Medium_Grip', 3, 6, 10),
  it('Bent_Over_Barbell_Row', 3, 6, 10),
  it('Plank', 3, 30, 60),
]);
const fullB = r('fullB', 'Full body B', [
  it('Romanian_Deadlift', 3, 8, 10),
  it('Dumbbell_Shoulder_Press', 3, 8, 12),
  it('Wide-Grip_Lat_Pulldown', 3, 8, 12),
  it('Dumbbell_Lunges', 3, 8, 12),
]);
const fullC = r('fullC', 'Full body C', [
  it('Leg_Press', 3, 10, 12),
  it('Incline_Dumbbell_Press', 3, 8, 12),
  it('Seated_Cable_Rows', 3, 10, 12),
  it('Hanging_Leg_Raise', 3, 8, 15),
]);
const fullD = r('fullD', 'Full body D', [
  it('Barbell_Deadlift', 3, 4, 6),
  it('Dips_-_Chest_Version', 3, 8, 12),
  it('Pullups', 3, 6, 10),
  it('Goblet_Squat', 3, 10, 15),
]);
const chestTri = r('chestTri', 'Chest & triceps', [
  it('Barbell_Bench_Press_-_Medium_Grip', 4, 6, 10),
  it('Incline_Dumbbell_Press', 3, 8, 12),
  it('Cable_Crossover', 3, 12, 15),
  it('Triceps_Pushdown', 3, 10, 15),
  it('Lying_Triceps_Press', 3, 10, 12),
]);
const backBi = r('backBi', 'Back & biceps', [
  it('Bent_Over_Barbell_Row', 4, 6, 10),
  it('Wide-Grip_Lat_Pulldown', 3, 8, 12),
  it('One-Arm_Dumbbell_Row', 3, 8, 12),
  it('Barbell_Curl', 3, 8, 12),
  it('Hammer_Curls', 3, 10, 12),
]);
const legsShoulders = r('legsShoulders', 'Legs & shoulders', [
  it('Barbell_Squat', 4, 5, 8),
  it('Romanian_Deadlift', 3, 8, 10),
  it('Leg_Press', 3, 10, 12),
  it('Dumbbell_Shoulder_Press', 3, 8, 12),
  it('Side_Lateral_Raise', 3, 12, 15),
]);
const chest = r('chest', 'Chest', [
  it('Barbell_Bench_Press_-_Medium_Grip', 4, 6, 10),
  it('Barbell_Incline_Bench_Press_-_Medium_Grip', 3, 8, 10),
  it('Dumbbell_Bench_Press', 3, 8, 12),
  it('Dumbbell_Flyes', 3, 10, 15),
  it('Dips_-_Chest_Version', 3, 8, 12),
]);
const back = r('back', 'Back', [
  it('Barbell_Deadlift', 3, 4, 6),
  it('Pullups', 3, 6, 10),
  it('Bent_Over_Barbell_Row', 3, 6, 10),
  it('Seated_Cable_Rows', 3, 10, 12),
  it('Straight-Arm_Pulldown', 3, 12, 15),
]);
const legs = r('legs', 'Legs', [
  it('Barbell_Squat', 4, 5, 8),
  it('Leg_Press', 3, 10, 12),
  it('Romanian_Deadlift', 3, 8, 10),
  it('Leg_Extensions', 3, 12, 15),
  it('Lying_Leg_Curls', 3, 10, 12),
  it('Standing_Calf_Raises', 4, 10, 15),
]);
const quads = r('quads', 'Legs: quads', [
  it('Barbell_Squat', 4, 5, 8),
  it('Hack_Squat', 3, 8, 12),
  it('Leg_Press', 3, 10, 12),
  it('Leg_Extensions', 3, 12, 15),
  it('Standing_Calf_Raises', 4, 10, 15),
]);
const hamsGlutes = r('hamsGlutes', 'Legs: hamstrings & glutes', [
  it('Romanian_Deadlift', 4, 6, 10),
  it('Barbell_Hip_Thrust', 3, 8, 12),
  it('Lying_Leg_Curls', 3, 10, 12),
  it('Barbell_Walking_Lunge', 3, 8, 12),
  it('Seated_Calf_Raise', 3, 12, 15),
]);
const shoulders = r('shoulders', 'Shoulders', [
  it('Standing_Military_Press', 4, 6, 10),
  it('Arnold_Dumbbell_Press', 3, 8, 12),
  it('Side_Lateral_Raise', 4, 12, 15),
  it('Reverse_Flyes', 3, 12, 15),
  it('Barbell_Shrug', 3, 10, 12),
]);
const arms = r('arms', 'Arms', [
  it('Close-Grip_Barbell_Bench_Press', 3, 6, 10),
  it('Barbell_Curl', 3, 8, 12),
  it('EZ-Bar_Skullcrusher', 3, 8, 12),
  it('Incline_Dumbbell_Curl', 3, 10, 12),
  it('Triceps_Pushdown', 3, 10, 15),
  it('Hammer_Curls', 3, 10, 12),
]);
const shouldersArms = r('shouldersArms', 'Shoulders & arms', [
  it('Standing_Military_Press', 3, 6, 10),
  it('Side_Lateral_Raise', 3, 12, 15),
  it('Reverse_Flyes', 3, 12, 15),
  it('Barbell_Curl', 3, 8, 12),
  it('Lying_Triceps_Press', 3, 8, 12),
]);
const core = r('core', 'Core & conditioning', [
  it('Hanging_Leg_Raise', 3, 8, 15),
  it('Cable_Crunch', 3, 12, 15),
  it('Russian_Twist', 3, 15, 20),
  it('Plank', 3, 30, 60),
  it('Farmers_Walk', 3, 30, 60),
]);

// ---------- Splits ----------

export type SplitId = 'ppl' | 'ul' | 'full' | 'bodypart' | 'custom';
export const DAY_COUNTS = [3, 4, 5, 6, 7] as const;
export type DayCount = (typeof DAY_COUNTS)[number];

/** Which weekdays (Monday = 0) to train, by days a week: rest days spread out where possible. */
export const TRAINING_DAYS: Record<DayCount, number[]> = {
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
  5: [0, 1, 2, 4, 5],
  6: [0, 1, 2, 3, 4, 5],
  7: [0, 1, 2, 3, 4, 5, 6],
};

export const SPLITS: { id: SplitId; name: string; blurb: string; week: Record<DayCount, Routine[]> | null }[] = [
  {
    id: 'ppl', name: 'Push / pull / legs',
    blurb: 'Pushing muscles (chest, shoulders, triceps), pulling muscles (back, biceps), then legs.',
    week: {
      3: [pushA, pullA, legsA],
      4: [pushA, pullA, legsA, upperA],
      5: [pushA, pullA, legsA, upperA, lowerA],
      6: [pushA, pullA, legsA, pushB, pullB, legsB],
      7: [pushA, pullA, legsA, pushB, pullB, legsB, core],
    },
  },
  {
    id: 'ul', name: 'Upper / lower',
    blurb: 'Alternate upper-body and lower-body days.',
    week: {
      3: [upperA, lowerA, fullA],
      4: [upperA, lowerA, upperB, lowerB],
      5: [upperA, lowerA, upperB, lowerB, shouldersArms],
      6: [upperA, lowerA, upperB, lowerB, upperA, lowerA],
      7: [upperA, lowerA, upperB, lowerB, upperA, lowerA, core],
    },
  },
  {
    id: 'full', name: 'Full body',
    blurb: 'Every workout trains the whole body, with different exercises each day.',
    week: {
      3: [fullA, fullB, fullC],
      4: [fullA, fullB, fullC, fullD],
      5: [fullA, fullB, fullC, fullD, fullA],
      6: [fullA, fullB, fullC, fullA, fullB, fullC],
      7: [fullA, fullB, fullC, fullD, fullA, fullB, core],
    },
  },
  {
    id: 'bodypart', name: 'Body part split',
    blurb: 'One or two muscle groups a day, with more exercises for each.',
    week: {
      3: [chestTri, backBi, legsShoulders],
      4: [chestTri, backBi, legs, shouldersArms],
      5: [chest, back, legs, shoulders, arms],
      6: [chest, back, quads, shoulders, arms, hamsGlutes],
      7: [chest, back, quads, shoulders, arms, hamsGlutes, core],
    },
  },
  {
    id: 'custom', name: 'Custom',
    blurb: 'Empty workouts on the days you train. Add exercises from the library.',
    week: null,
  },
];

export interface Template {
  id: string;
  name: string;
  blurb: string;
  routines: Routine[];
  /** Routine id per weekday, Monday = 0. */
  schedule: (string | null)[];
}

/** A split for a number of days a week: the routines and which day each is on. */
export function liftingPlan(split: SplitId, days: DayCount): Template {
  const def = SPLITS.find((s) => s.id === split)!;
  const on = TRAINING_DAYS[days];
  const list = def.week ? def.week[days] : on.map((_, i) => r(`day${i + 1}`, `Day ${i + 1}`, []));
  const schedule: (string | null)[] = [null, null, null, null, null, null, null];
  on.forEach((d, i) => (schedule[d] = list[i].id));
  // Each workout once, in the order of the week.
  const routines = list.filter((x, i) => list.indexOf(x) === i);
  return { id: `${split}-${days}`, name: `${def.name}, ${days} days`, blurb: def.blurb, routines, schedule };
}

/** "Mon: Push · Tue: Pull · …" */
export function planDays(t: Template, dayNames: string[]): string {
  return t.schedule
    .map((id, i) => (id ? `${dayNames[i]}: ${t.routines.find((x) => x.id === id)!.name}` : null))
    .filter(Boolean)
    .join(' · ');
}

/**
 * Use a plan: add its routines (copies with fresh ids) and its schedule. Existing routines are kept
 * (so past workouts still have them) but come off the schedule.
 */
export function applyTemplate(l: LiftingData, t: Template, newId: () => string): LiftingData {
  const map = new Map<string, string>();
  const routines = t.routines.map((x) => {
    const id = newId();
    map.set(x.id, id);
    return { ...x, id, items: x.items.map((i) => ({ ...i })) };
  });
  return { ...l, routines: [...l.routines, ...routines], schedule: t.schedule.map((s) => (s ? (map.get(s) ?? null) : null)) };
}
