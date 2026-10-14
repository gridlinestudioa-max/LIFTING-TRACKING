// Calories burned ("calories out") for people without a watch that tracks it. Pure logic, no React.
//
// A day's estimate is a base (what you burn living your day, before workouts) plus each workout logged.
//
// Base:
// - Resting burn: Katch-McArdle (370 + 21.6 × lean mass in kg) when body fat % is known, else Mifflin-St Jeor.
// - Daily movement: with average steps, resting × 1.15 (digesting food and basic movement) plus the steps
//   (walking costs about 0.5 kcal per kg per km above rest; a step is about 0.414 × height). Without steps,
//   resting × a factor for how much you move outside workouts (1.2 desk to 1.7 physical job).
// Workouts, counted above resting so they add to the base without double counting:
// - Calories from a watch or app on the workout, when entered.
// - Average heart rate: Keytel et al. (2005) equations, minus resting burn for the same time.
// - Runs, walks and hikes with a distance: about 1.0 (run), 0.5 (walk) and 0.65 (hike) kcal per kg per km,
//   plus climbing (body weight × height gained ÷ 25% muscle efficiency).
// - Otherwise METs from the 2024 Compendium of Physical Activities (cycling by speed, swimming by pace,
//   lifting 4.5), minus 1 MET for rest.

import type { CardioSession, CardioType } from './cardio';
import { todayString } from './dates';
import type { Workout } from './lifting';
import { ageOf, bmr, kgOf, type Profile, type Sex } from './profile';
import type { TrackerState } from './types';

/** How someone tracks calories burned. */
export type Tracker = 'apple' | 'fitbit' | 'garmin' | 'samsung' | 'whoop' | 'oura' | 'other' | 'none';

export const TRACKERS: { id: Tracker; label: string }[] = [
  { id: 'apple', label: 'Apple Watch' },
  { id: 'fitbit', label: 'Fitbit' },
  { id: 'garmin', label: 'Garmin' },
  { id: 'samsung', label: 'Samsung Galaxy Watch' },
  { id: 'whoop', label: 'Whoop' },
  { id: 'oura', label: 'Oura Ring' },
  { id: 'other', label: 'Another watch or app' },
  { id: 'none', label: 'Nothing: estimate it for me' },
];

export const TRACKER_LABEL: Record<Tracker, string> = Object.fromEntries(TRACKERS.map((t) => [t.id, t.label])) as Record<Tracker, string>;

/** How much you move on a normal day, not counting workouts. */
export type DailyMove = 'desk' | 'standing' | 'onfeet' | 'labor';

export const DAILY_MOVES: { id: DailyMove; label: string; hint: string; factor: number }[] = [
  { id: 'desk', label: 'Mostly sitting', hint: 'Desk job, driving, studying.', factor: 1.2 },
  { id: 'standing', label: 'Some standing and walking', hint: 'Teacher, retail, lab work, busy at home.', factor: 1.35 },
  { id: 'onfeet', label: 'On my feet most of the day', hint: 'Nurse, server, warehouse picker.', factor: 1.5 },
  { id: 'labor', label: 'Physical work', hint: 'Construction, landscaping, moving.', factor: 1.7 },
];

export interface BaseInputs {
  sex: Sex;
  age: number;
  heightIn: number;
  weightLb: number;
  daily?: DailyMove;
  steps?: number;
  bodyFat?: number;
}

/** Whether the app should estimate calories burned for this person. */
export function estimatesBurn(p: Profile | null): boolean {
  return p?.tracker === 'none';
}

/** The stats the base estimate needs, or null with what's missing. */
export function baseInputs(p: Profile | null, today: string = todayString()): BaseInputs | null {
  const age = ageOf(p, today);
  if (!p?.sex || age == null || age < 13 || !p.heightIn || !p.weightLb) return null;
  if (!p.daily && !p.steps) return null;
  const out: BaseInputs = { sex: p.sex, age, heightIn: p.heightIn, weightLb: p.weightLb };
  if (p.daily) out.daily = p.daily;
  if (p.steps) out.steps = p.steps;
  if (p.bodyFat) out.bodyFat = p.bodyFat;
  return out;
}

/** What the estimate still needs, in words, or null when it can be made. */
export function missingForBurn(p: Profile | null, today: string = todayString()): string | null {
  const age = ageOf(p, today);
  const miss = [
    !p?.sex && 'sex',
    age == null && 'birthday',
    !p?.heightIn && 'height',
    !p?.weightLb && 'weight',
    !p?.daily && !p?.steps && 'how much you move in a day',
  ].filter(Boolean) as string[];
  if (!miss.length) return null;
  return miss.length === 1 ? miss[0] : `${miss.slice(0, -1).join(', ')} and ${miss[miss.length - 1]}`;
}

export type Accuracy = 'basic' | 'good' | 'best';

/** How good the estimate can be with what's been given, and what would make it better. */
export function burnAccuracy(p: Profile | null): { level: Accuracy; add: string[] } {
  const add: string[] = [];
  if (!p?.steps) add.push('your average daily steps');
  if (!p?.bodyFat) add.push('your body fat %');
  return { level: add.length === 0 ? 'best' : add.length === 1 ? 'good' : 'basic', add };
}

/** Calories burned at rest: Katch-McArdle with body fat, else Mifflin-St Jeor. */
export function restingBurn(b: BaseInputs): number {
  if (b.bodyFat && b.bodyFat > 2 && b.bodyFat < 70) return 370 + 21.6 * kgOf(b.weightLb) * (1 - b.bodyFat / 100);
  return bmr({ sex: b.sex, age: b.age, heightIn: b.heightIn, weightLb: b.weightLb, activity: 'sedentary', goal: 'maintain' });
}

/** Calories from walking a number of steps, above rest. */
export function stepsBurn(b: BaseInputs, steps: number): number {
  const km = (steps * 0.414 * b.heightIn * 2.54) / 100000;
  return 0.5 * kgOf(b.weightLb) * km;
}

/** What you burn in a day before workouts. */
export function baseBurn(b: BaseInputs): number {
  const rest = restingBurn(b);
  if (b.steps) return rest * 1.15 + stepsBurn(b, b.steps);
  const f = DAILY_MOVES.find((d) => d.id === b.daily)?.factor ?? 1.2;
  return rest * f;
}

// ---------- Workouts ----------

const MET: Record<CardioType, number> = { run: 9.8, walk: 3.5, hike: 6, bike: 7.5, swim: 7, row: 7, elliptical: 5, other: 5 };

/** Cycling MET by average speed (mph). */
function bikeMet(mph: number): number {
  return mph < 10 ? 4 : mph < 12 ? 6.8 : mph < 14 ? 8 : mph < 16 ? 10 : mph < 20 ? 12 : 15.8;
}

/** Swimming MET by pace (meters a minute). */
function swimMet(mPerMin: number): number {
  return mPerMin < 35 ? 5.8 : mPerMin < 50 ? 8.3 : 10;
}

/** Calories a heart-rate reading implies, per minute (Keytel 2005). */
function hrKcalPerMin(sex: Sex, hr: number, kg: number, age: number): number {
  const k = sex === 'male' ? -55.0969 + 0.6309 * hr + 0.1988 * kg + 0.2017 * age : -20.4022 + 0.4472 * hr - 0.1263 * kg + 0.074 * age;
  return Math.max(0, k / 4.184);
}

/** Calories a cardio session added above resting. Null without enough to go on (no time and no distance). */
export function sessionBurn(x: CardioSession, b: Pick<BaseInputs, 'sex' | 'age' | 'weightLb' | 'heightIn' | 'bodyFat'>): number | null {
  if (x.kcal) return x.kcal;
  const kg = kgOf(b.weightLb);
  const mins = x.secs ? x.secs / 60 : null;
  const restPerMin = restingBurn({ ...b }) / 1440;
  const climb = x.elevFt ? (kg * x.elevFt * 0.3048 * 9.81) / (4184 * 0.25) : 0;
  if (x.hr && mins) return Math.round(Math.max(0, hrKcalPerMin(b.sex, x.hr, kg, b.age) - restPerMin) * mins);
  const km = x.miles ? x.miles * 1.609344 : null;
  if (km && (x.type === 'run' || x.type === 'walk' || x.type === 'hike')) {
    const perKgKm = x.type === 'run' ? 1.0 : x.type === 'walk' ? 0.5 : 0.65;
    return Math.round(perKgKm * kg * km + climb);
  }
  let met = MET[x.type];
  if (x.type === 'bike' && x.miles && mins) met = bikeMet(x.miles / (mins / 60));
  if (x.type === 'swim' && x.miles && mins) met = swimMet((x.miles * 1609.344) / mins);
  let m = mins;
  // Distance but no time: assume a typical pace for the sport.
  if (m == null && x.miles) m = x.miles * (x.type === 'bike' ? 4 : x.type === 'swim' ? 35 : x.type === 'row' ? 8 : 12);
  if (m == null) return null;
  return Math.round((met - 1) * kg * (m / 60) + climb);
}

/** How long a lifting workout took, in minutes: the clock if it was timed, else about 2.5 minutes a set. */
export function workoutMinutes(w: Workout): number {
  if (w.start && w.end && w.end > w.start) {
    const m = (w.end - w.start) / 60000;
    if (m >= 5 && m <= 240) return Math.round(m);
  }
  const sets = w.exercises.reduce((t, x) => t + x.sets.filter((s) => s.done).length, 0);
  return Math.round(sets * 2.5);
}

/** Calories a lifting workout added above resting (resistance training, about 4.5 METs). */
export function workoutBurn(w: Workout, weightLb: number): number {
  return Math.round(3.5 * kgOf(weightLb) * (workoutMinutes(w) / 60));
}

export interface BurnPart {
  label: string;
  kcal: number;
}

export interface DayBurn {
  total: number;
  base: number;
  parts: BurnPart[];
}

const SESSION_LABEL: Record<CardioType, string> = {
  run: 'Run', walk: 'Walk', hike: 'Hike', bike: 'Ride', swim: 'Swim', row: 'Row', elliptical: 'Elliptical', other: 'Cardio',
};

/** The estimate for a day: base plus each workout. Null when the app isn't estimating or can't yet. */
export function dayBurn(state: TrackerState, day: string): DayBurn | null {
  const p = state.profile;
  if (!estimatesBurn(p)) return null;
  const b = baseInputs(p, day);
  if (!b) return null;
  const base = Math.round(baseBurn(b));
  const parts: BurnPart[] = [];
  if (state.settings.sections.cardio) {
    for (const x of state.cardio.sessions.filter((s) => s.date === day)) {
      const k = sessionBurn(x, b);
      if (k) parts.push({ label: SESSION_LABEL[x.type], kcal: k });
    }
  }
  if (state.settings.sections.lifting) {
    for (const w of state.lifting.workouts.filter((w) => w.done && w.date === day)) {
      const k = workoutBurn(w, b.weightLb);
      if (k) parts.push({ label: w.name, kcal: k });
    }
  }
  return { base, parts, total: base + parts.reduce((t, x) => t + x.kcal, 0) };
}

/** Calories out for a day: what was typed, or the estimate. */
export function coutFor(state: TrackerState, day: string, today: string = todayString()): number | null {
  const typed = state.days[day]?.cout;
  if (typed != null) return typed;
  return day <= today ? (dayBurn(state, day)?.total ?? null) : null;
}
