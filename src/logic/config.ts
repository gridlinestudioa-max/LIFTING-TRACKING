// Plan constants. Change the plan here; everything else derives from these.

export const START_DEFAULT = '2026-10-05';
export const PLAN_WEEKS = 12;
export const PLAN_DAYS = PLAN_WEEKS * 7; // 84
export const STORAGE_KEY = 'mm_tracker_v1';

/** Long run miles for weeks 1..12. Week 12 Sunday is race day. */
export const LONG: readonly number[] = [7, 8, 9, 7, 10, 11, 8, 12, 10, 8, 6, 13.1];

export type DayType = 'push' | 'pull' | 'legs' | 'tempo' | 'easy' | 'long' | 'rest';
export type Kind = 'lift' | 'run' | 'rest';
export type LiftGroup = 'push' | 'pull' | 'legs';

/** Weekly layout, Monday..Sunday. */
export const DOW: readonly DayType[] = ['push', 'tempo', 'pull', 'legs', 'easy', 'rest', 'long'];

export const TYPES: Record<DayType, { label: string; kind: Kind }> = {
  push: { label: 'Push', kind: 'lift' },
  pull: { label: 'Pull', kind: 'lift' },
  legs: { label: 'Legs', kind: 'lift' },
  tempo: { label: 'Tempo', kind: 'run' },
  easy: { label: 'Easy', kind: 'run' },
  long: { label: 'Long', kind: 'run' },
  rest: { label: 'Rest', kind: 'rest' },
};

/** Easy run miles for week index w (0-based). */
export function easyMiles(w: number): number {
  return w === 11 ? 2 : 3;
}

/** Tempo run miles for week index w (0-based). */
export function tempoMiles(w: number): number {
  return w < 4 ? 3 : w < 9 ? 4 : 3;
}

/** Weights go up every BUMP_EVERY weeks (W4, W7, W10). */
export const BUMP_EVERY = 3;

export interface Exercise {
  id: string;
  name: string;
  sets: string;
  /** Week 1 weight (already the first bump). */
  w: number;
  /** Bump size. */
  inc: number;
  unit: 'lb' | 'PL';
}

export const LIFTS: Record<LiftGroup, Exercise[]> = {
  push: [
    { id: 'tri', name: 'Tricep extension', sets: '3×15', w: 35, inc: 5, unit: 'lb' },
    { id: 'bench', name: 'Dumbbell bench (each)', sets: '3×8', w: 45, inc: 5, unit: 'lb' },
    { id: 'skull', name: 'EZ bar skull crushers', sets: '3×15', w: 35, inc: 5, unit: 'lb' },
    { id: 'peck', name: 'Pec deck', sets: '3×10', w: 100, inc: 5, unit: 'lb' },
    { id: 'ohp', name: 'Shoulder press', sets: '3×10', w: 40, inc: 5, unit: 'lb' },
  ],
  pull: [
    { id: 'row', name: 'Seated cable row, wide', sets: '3×10', w: 110, inc: 5, unit: 'lb' },
    { id: 'bicable', name: 'Biceps cable', sets: '3×12', w: 50, inc: 2.5, unit: 'lb' },
    { id: 'lat', name: 'Lat pulldown cable', sets: '3×10', w: 110, inc: 5, unit: 'lb' },
    { id: 'curl', name: 'Bicep curls', sets: '3×10', w: 35, inc: 5, unit: 'lb' },
    { id: 'face', name: 'Face pulls / rear delt', sets: '3×15', w: 85, inc: 5, unit: 'lb' },
  ],
  legs: [
    { id: 'lpress', name: 'Leg press (plates)', sets: '3×8', w: 7, inc: 1, unit: 'PL' },
    { id: 'rdl', name: 'Romanian deadlift', sets: '3×10', w: 65, inc: 5, unit: 'lb' },
    { id: 'lcurl', name: 'Leg curl', sets: '3×10', w: 120, inc: 5, unit: 'lb' },
    { id: 'lext', name: 'Leg extension', sets: '3×10', w: 130, inc: 5, unit: 'lb' },
  ],
};

export const LIFT_GROUPS: readonly LiftGroup[] = ['push', 'pull', 'legs'];
export const ALL_EXERCISES: Exercise[] = [...LIFTS.push, ...LIFTS.pull, ...LIFTS.legs];
export const EXERCISE_BY_ID: Record<string, Exercise> = Object.fromEntries(
  ALL_EXERCISES.map((e) => [e.id, e]),
);

/** A run counts as done when logged miles >= this share of planned miles. */
export const RUN_DONE_RATIO = 0.9;

export const RUN_TIPS: Record<'long' | 'tempo' | 'easy' | 'race', string> = {
  long: 'Slow and conversational.',
  tempo: 'Comfortably hard, or intervals.',
  easy: 'Easy, relaxed pace.',
  race: 'Race day. Start easy.',
};

export const REST_TEXT = 'Bike commute only, no extra training.';
