// Starter routines offered during setup. Exercise ids are from the built-in library ("x:" + free-exercise-db id).
// No starting weights: the first workout asks for them, then progression takes over.

import type { LiftingData, Routine, RoutineItem } from './lifting';

const it = (id: string, sets: number, repMin: number, repMax: number): RoutineItem => ({ exId: `x:${id}`, sets, repMin, repMax });

export interface Template {
  id: string;
  name: string;
  blurb: string;
  routines: Routine[];
  /** Routine id per weekday, Monday = 0. */
  schedule: (string | null)[];
}

const push: Routine = {
  id: 't:push',
  name: 'Push',
  items: [
    it('Barbell_Bench_Press_-_Medium_Grip', 3, 6, 10),
    it('Dumbbell_Shoulder_Press', 3, 8, 12),
    it('Incline_Dumbbell_Press', 3, 8, 12),
    it('Side_Lateral_Raise', 3, 12, 15),
    it('Triceps_Pushdown', 3, 10, 15),
  ],
};
const pull: Routine = {
  id: 't:pull',
  name: 'Pull',
  items: [
    it('Bent_Over_Barbell_Row', 3, 6, 10),
    it('Wide-Grip_Lat_Pulldown', 3, 8, 12),
    it('Seated_Cable_Rows', 3, 10, 12),
    it('Face_Pull', 3, 12, 15),
    it('Barbell_Curl', 3, 8, 12),
  ],
};
const legs: Routine = {
  id: 't:legs',
  name: 'Legs',
  items: [
    it('Barbell_Squat', 3, 5, 8),
    it('Romanian_Deadlift', 3, 8, 10),
    it('Leg_Press', 3, 10, 12),
    it('Lying_Leg_Curls', 3, 10, 12),
    it('Standing_Calf_Raises', 3, 10, 15),
  ],
};
const upper: Routine = {
  id: 't:upper',
  name: 'Upper',
  items: [
    it('Barbell_Bench_Press_-_Medium_Grip', 3, 6, 10),
    it('Bent_Over_Barbell_Row', 3, 6, 10),
    it('Dumbbell_Shoulder_Press', 3, 8, 12),
    it('Wide-Grip_Lat_Pulldown', 3, 8, 12),
    it('Barbell_Curl', 2, 10, 12),
    it('Triceps_Pushdown', 2, 10, 12),
  ],
};
const lower: Routine = {
  id: 't:lower',
  name: 'Lower',
  items: [
    it('Barbell_Squat', 3, 5, 8),
    it('Romanian_Deadlift', 3, 8, 10),
    it('Leg_Press', 3, 10, 12),
    it('Seated_Leg_Curl', 3, 10, 12),
    it('Standing_Calf_Raises', 3, 10, 15),
  ],
};
const fullA: Routine = {
  id: 't:fullA',
  name: 'Full body A',
  items: [it('Barbell_Squat', 3, 5, 8), it('Barbell_Bench_Press_-_Medium_Grip', 3, 6, 10), it('Bent_Over_Barbell_Row', 3, 6, 10), it('Plank', 3, 30, 60)],
};
const fullB: Routine = {
  id: 't:fullB',
  name: 'Full body B',
  items: [it('Romanian_Deadlift', 3, 8, 10), it('Dumbbell_Shoulder_Press', 3, 8, 12), it('Wide-Grip_Lat_Pulldown', 3, 8, 12), it('Dumbbell_Lunges', 3, 8, 12)],
};

export const TEMPLATES: Template[] = [
  { id: 'ppl', name: 'Push / pull / legs', blurb: '3 days: Mon, Wed, Fri.', routines: [push, pull, legs], schedule: ['t:push', null, 't:pull', null, 't:legs', null, null] },
  { id: 'ul', name: 'Upper / lower', blurb: '4 days: Mon, Tue, Thu, Fri.', routines: [upper, lower], schedule: ['t:upper', 't:lower', null, 't:upper', 't:lower', null, null] },
  { id: 'full', name: 'Full body', blurb: '3 days, alternating A and B: Mon, Wed, Fri.', routines: [fullA, fullB], schedule: ['t:fullA', null, 't:fullB', null, 't:fullA', null, null] },
];

/** Add a template's routines (copies with fresh ids) and use its schedule. Existing routines are kept. */
export function applyTemplate(l: LiftingData, t: Template, newId: () => string): LiftingData {
  const map = new Map<string, string>();
  const routines = t.routines.map((r) => {
    const id = newId();
    map.set(r.id, id);
    return { ...r, id, items: r.items.map((i) => ({ ...i })) };
  });
  return { ...l, routines: [...l.routines, ...routines], schedule: t.schedule.map((s) => (s ? (map.get(s) ?? null) : null)) };
}
