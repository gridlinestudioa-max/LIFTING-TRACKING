// Body stats and the daily targets suggested from them. Pure logic, no React.
//
// Sources for the numbers:
// - Calories burned at rest: Mifflin-St Jeor equation (Mifflin et al., 1990), times a standard activity factor.
// - Protein: 0.8 g/kg is the RDA minimum; 1.2 to 2.0 g/kg is the range for active people and lifting
//   (International Society of Sports Nutrition position stand, 2017). Plant protein is digested a little less well,
//   so vegan targets are 10% higher.
// - Carbs: 45 to 65% of calories (US Dietary Reference Intakes, AMDR). Keto: about 20 g net. Low carb: under 130 g.
// - Fat: 20 to 35% of calories (AMDR). Low fat: 25%.
// - Sugar: the app counts total sugar (fruit and milk included), so it uses the EU/UK reference intake for total
//   sugars, 90 g per 2,000 kcal, scaled to your calories.

import type { DailyMove, Tracker } from './burn';
import { todayString } from './dates';
import type { Limits, StyleId } from './diet';
import { fmtInt } from './format';

export type Sex = 'male' | 'female';
export type Activity = 'sedentary' | 'light' | 'moderate' | 'active' | 'very';
export type Goal = 'lose' | 'loseSlow' | 'maintain' | 'gain';

/** Body stats as saved. Every field is optional; suggestions need sex, birthday (or age), height and weight. */
export interface Profile {
  sex?: Sex;
  /** 'YYYY-MM-DD'. */
  birthday?: string;
  /** Saved by earlier versions, before birthdays. Used only when there's no birthday. */
  age?: number;
  /** Height in inches. */
  heightIn?: number;
  /** Weight in pounds. */
  weightLb?: number;
  activity?: Activity;
  goal?: Goal;
  /** How calories burned are tracked: a device, or 'none' for the app's estimate. */
  tracker?: Tracker;
  /** Movement outside workouts, for the estimate. */
  daily?: DailyMove;
  /** Average steps a day, for a better estimate. */
  steps?: number;
  /** Body fat %, for a better resting estimate. */
  bodyFat?: number;
}

/** Everything the calorie and macro formulas need. */
export interface Stats {
  sex: Sex;
  age: number;
  heightIn: number;
  weightLb: number;
  activity: Activity;
  goal: Goal;
}

/** Used for suggestions when activity or goal isn't set. */
export const DEFAULT_ACTIVITY: Activity = 'light';
export const DEFAULT_GOAL: Goal = 'maintain';
/** Suggested targets are for adults. */
export const MIN_AGE = 18;

/** Whole years from a birthday to a date. */
export function ageOn(birthday: string, today: string): number {
  const [by, bm, bd] = birthday.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}

/** Age today, from the birthday (or the age saved by earlier versions). */
export function ageOf(p: Profile | null, today: string = todayString()): number | null {
  if (p?.birthday) return ageOn(p.birthday, today);
  return p?.age ?? null;
}

/** The stats the formulas need, or null when something's missing (or under 18). Activity and goal have defaults. */
export function statsOf(p: Profile | null, today: string = todayString()): Stats | null {
  if (!p) return null;
  const age = ageOf(p, today);
  if (!p.sex || age == null || age < MIN_AGE || !p.heightIn || !p.weightLb) return null;
  return { sex: p.sex, age, heightIn: p.heightIn, weightLb: p.weightLb, activity: p.activity ?? DEFAULT_ACTIVITY, goal: p.goal ?? DEFAULT_GOAL };
}

/** What's still needed for suggestions, in words ("sex and height"), or null when there's enough. */
export function missingForSuggestions(p: Profile | null, today: string = todayString()): string | null {
  const age = ageOf(p, today);
  if (age != null && age < MIN_AGE) return 'an age of 18 or over (suggestions are for adults)';
  const miss = [!p?.sex && 'sex', age == null && 'birthday', !p?.heightIn && 'height', !p?.weightLb && 'weight'].filter(Boolean) as string[];
  if (!miss.length) return null;
  return miss.length === 1 ? miss[0] : `${miss.slice(0, -1).join(', ')} and ${miss[miss.length - 1]}`;
}
export const ACTIVITY: { id: Activity; label: string; blurb: string; factor: number }[] = [
  { id: 'sedentary', label: 'Sedentary', blurb: 'Desk job, little exercise.', factor: 1.2 },
  { id: 'light', label: 'Light', blurb: 'Exercise 1 to 3 days a week.', factor: 1.375 },
  { id: 'moderate', label: 'Moderate', blurb: 'Exercise 3 to 5 days a week.', factor: 1.55 },
  { id: 'active', label: 'Active', blurb: 'Hard exercise 6 to 7 days a week.', factor: 1.725 },
  { id: 'very', label: 'Very active', blurb: 'Training twice a day, or a physical job plus training.', factor: 1.9 },
];

export const GOALS: { id: Goal; label: string; blurb: string; delta: number }[] = [
  { id: 'lose', label: 'Lose weight', blurb: 'About 1 lb a week (500 kcal a day under what you burn).', delta: -500 },
  { id: 'loseSlow', label: 'Lose slowly', blurb: 'About ½ lb a week (250 kcal a day under).', delta: -250 },
  { id: 'maintain', label: 'Maintain', blurb: 'Eat about what you burn.', delta: 0 },
  { id: 'gain', label: 'Gain slowly', blurb: 'About ½ lb a week (250 kcal a day over), for building muscle.', delta: 250 },
];

/** Lowest calorie target the app suggests without medical supervision. */
export const MIN_KCAL: Record<Sex, number> = { female: 1200, male: 1500 };

const KG_PER_LB = 0.45359237;
const CM_PER_IN = 2.54;

export const kgOf = (lb: number) => lb * KG_PER_LB;

/** Calories burned at complete rest (Mifflin-St Jeor). */
export function bmr(p: Stats): number {
  const base = 10 * kgOf(p.weightLb) + 6.25 * p.heightIn * CM_PER_IN - 5 * p.age;
  return base + (p.sex === 'male' ? 5 : -161);
}

/** Calories burned in a typical day, activity included. */
export function tdee(p: Stats): number {
  const f = ACTIVITY.find((a) => a.id === p.activity)?.factor ?? 1.2;
  return bmr(p) * f;
}

/** Daily calories for the goal, rounded to 10, never below the safe minimum. */
export function calorieTarget(p: Stats): number {
  const delta = GOALS.find((g) => g.id === p.goal)?.delta ?? 0;
  return Math.max(MIN_KCAL[p.sex], Math.round((tdee(p) + delta) / 10) * 10);
}

/** True when the goal had to be raised to the safe minimum. */
export function hitFloor(p: Stats): boolean {
  const delta = GOALS.find((g) => g.id === p.goal)?.delta ?? 0;
  return Math.round((tdee(p) + delta) / 10) * 10 < MIN_KCAL[p.sex];
}

/** Protein in g per kg of body weight, by activity, raised for high-protein and vegan diets. */
export function proteinPerKg(p: Stats, style: StyleId): number {
  let g = p.activity === 'sedentary' ? 1.0 : p.activity === 'light' ? 1.2 : 1.6;
  if (style === 'highprotein') g = Math.min(2.2, g + 0.6);
  if (style === 'vegan') g *= 1.1;
  return g;
}

export interface Targets {
  limits: Limits;
  /** One line per limit saying where the number comes from. */
  why: Partial<Record<keyof Limits, string>>;
}

const r5 = (v: number) => Math.round(v / 5) * 5;

/** Suggested daily targets for a profile and food style. */
export function suggestTargets(p: Stats, style: StyleId): Targets {
  const kcal = calorieTarget(p);
  const goal = GOALS.find((g) => g.id === p.goal)!;
  const limits: Limits = {};
  const why: Targets['why'] = {};

  limits.kcalMax = kcal;
  why.kcalMax = hitFloor(p)
    ? `Raised to the safe minimum of ${fmtInt(MIN_KCAL[p.sex])} kcal.`
    : `You burn about ${fmtInt(Math.round(tdee(p) / 10) * 10)} kcal a day. ${goal.label}: ${goal.delta === 0 ? 'no change' : `${goal.delta > 0 ? '+' : '−'}${Math.abs(goal.delta)} kcal`}.`;

  const ppk = proteinPerKg(p, style);
  limits.proteinMin = r5(kgOf(p.weightLb) * ppk);
  why.proteinMin = `${Math.round(ppk * 10) / 10} g per kg of body weight${style === 'vegan' ? ' (plant protein, +10%)' : ''}.`;

  if (style === 'keto') {
    limits.netCarbsMax = 20;
    why.netCarbsMax = 'Keto: about 20 g net carbs keeps you in ketosis.';
  } else if (style === 'lowcarb') {
    limits.netCarbsMax = Math.min(130, Math.max(50, r5((kcal * 0.2) / 4)));
    why.netCarbsMax = 'Low carb: about 20% of calories, under 130 g.';
  } else {
    limits.netCarbsMax = r5((kcal * 0.65) / 4);
    why.netCarbsMax = 'Up to 65% of calories (the healthy range is 45 to 65%).';
  }

  if (style !== 'keto') {
    limits.sugarMax = r5((90 * kcal) / 2000);
    why.sugarMax = 'Total sugar, fruit and milk included: 90 g per 2,000 kcal.';
  }

  if (style === 'lowfat') {
    limits.fatPctMax = 25;
    why.fatPctMax = 'Low fat: 25% of calories.';
  } else if (style !== 'keto') {
    limits.fatPctMax = 35;
    why.fatPctMax = 'Up to 35% of calories (the healthy range is 20 to 35%).';
  }

  return { limits, why };
}

/** Problems with the stats entered, or null when they can be saved. Only what's filled in is checked. */
export function profileError(p: Profile, today: string = todayString()): string | null {
  if (p.birthday != null) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.birthday) || p.birthday > today) return 'Choose a birthday in the past.';
    const age = ageOn(p.birthday, today);
    if (age > 120) return 'Check the birth year.';
  }
  if (p.heightIn != null && !(p.heightIn >= 48 && p.heightIn <= 96)) return 'Enter a height from 4 ft to 8 ft, or leave it blank.';
  if (p.weightLb != null && !(p.weightLb >= 70 && p.weightLb <= 700)) return 'Enter a weight from 70 to 700 lb, or leave it blank.';
  if (p.steps != null && !(p.steps >= 500 && p.steps <= 60000)) return 'Enter steps from 500 to 60,000, or leave it blank.';
  if (p.bodyFat != null && !(p.bodyFat >= 3 && p.bodyFat <= 60)) return 'Enter body fat from 3 to 60%, or leave it blank.';
  return null;
}

/** 70 -> "5 ft 10 in". */
export function heightText(inches: number): string {
  const ft = Math.floor(inches / 12);
  const i = Math.round(inches - ft * 12);
  return i === 12 ? `${ft + 1} ft 0 in` : `${ft} ft ${i} in`;
}

/** "Male · 36 years · 5 ft 10 in · 180 lb", from whatever is filled in. */
export function profileSummary(p: Profile, today: string = todayString()): string {
  const age = ageOf(p, today);
  return [
    p.sex === 'male' ? 'Male' : p.sex === 'female' ? 'Female' : null,
    age != null ? `${age} years` : null,
    p.heightIn ? heightText(p.heightIn) : null,
    p.weightLb ? `${Math.round(p.weightLb * 10) / 10} lb` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Accepts anything (parsed JSON) and returns the valid stats in it, or null when there are none. */
export function normalizeProfile(src: unknown): Profile | null {
  if (!src || typeof src !== 'object') return null;
  const s = src as Record<string, unknown>;
  const p: Profile = {};
  if (s.sex === 'male' || s.sex === 'female') p.sex = s.sex;
  if (typeof s.birthday === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.birthday)) p.birthday = s.birthday;
  else if (Number(s.age) >= 1 && Number(s.age) <= 120) p.age = Math.round(Number(s.age));
  const h = Number(s.heightIn);
  if (h >= 48 && h <= 96) p.heightIn = h;
  const w = Number(s.weightLb);
  if (w >= 70 && w <= 700) p.weightLb = w;
  if (ACTIVITY.some((a) => a.id === s.activity)) p.activity = s.activity as Activity;
  if (GOALS.some((g) => g.id === s.goal)) p.goal = s.goal as Goal;
  if (['apple', 'fitbit', 'garmin', 'samsung', 'whoop', 'oura', 'other', 'none'].includes(s.tracker as string)) p.tracker = s.tracker as Tracker;
  if (['desk', 'standing', 'onfeet', 'labor'].includes(s.daily as string)) p.daily = s.daily as DailyMove;
  const steps = Number(s.steps);
  if (steps >= 500 && steps <= 60000) p.steps = Math.round(steps);
  const bf = Number(s.bodyFat);
  if (bf >= 3 && bf <= 60) p.bodyFat = bf;
  return Object.keys(p).length ? p : null;
}
