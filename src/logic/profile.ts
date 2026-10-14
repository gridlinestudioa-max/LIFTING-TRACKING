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

import type { Limits, StyleId } from './diet';
import { fmtInt } from './format';

export type Sex = 'male' | 'female';
export type Activity = 'sedentary' | 'light' | 'moderate' | 'active' | 'very';
export type Goal = 'lose' | 'loseSlow' | 'maintain' | 'gain';

export interface Profile {
  sex: Sex;
  age: number;
  /** Height in inches. */
  heightIn: number;
  /** Weight in pounds. */
  weightLb: number;
  activity: Activity;
  goal: Goal;
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
export function bmr(p: Profile): number {
  const base = 10 * kgOf(p.weightLb) + 6.25 * p.heightIn * CM_PER_IN - 5 * p.age;
  return base + (p.sex === 'male' ? 5 : -161);
}

/** Calories burned in a typical day, activity included. */
export function tdee(p: Profile): number {
  const f = ACTIVITY.find((a) => a.id === p.activity)?.factor ?? 1.2;
  return bmr(p) * f;
}

/** Daily calories for the goal, rounded to 10, never below the safe minimum. */
export function calorieTarget(p: Profile): number {
  const delta = GOALS.find((g) => g.id === p.goal)?.delta ?? 0;
  return Math.max(MIN_KCAL[p.sex], Math.round((tdee(p) + delta) / 10) * 10);
}

/** True when the goal had to be raised to the safe minimum. */
export function hitFloor(p: Profile): boolean {
  const delta = GOALS.find((g) => g.id === p.goal)?.delta ?? 0;
  return Math.round((tdee(p) + delta) / 10) * 10 < MIN_KCAL[p.sex];
}

/** Protein in g per kg of body weight, by activity, raised for high-protein and vegan diets. */
export function proteinPerKg(p: Profile, style: StyleId): number {
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
export function suggestTargets(p: Profile, style: StyleId): Targets {
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

/** Problems with the stats, or null when they can be saved. */
export function profileError(p: Partial<Profile>): string | null {
  if (!p.sex) return 'Choose male or female (the calorie formula differs).';
  if (!(p.age! >= 18 && p.age! <= 100)) return 'Enter an age from 18 to 100. Suggestions are for adults.';
  if (!(p.heightIn! >= 48 && p.heightIn! <= 96)) return 'Enter a height from 4 ft to 8 ft.';
  if (!(p.weightLb! >= 70 && p.weightLb! <= 700)) return 'Enter a weight from 70 to 700 lb.';
  if (!p.activity) return 'Choose how active you are.';
  if (!p.goal) return 'Choose a goal.';
  return null;
}

/** 70 -> "5 ft 10 in". */
export function heightText(inches: number): string {
  const ft = Math.floor(inches / 12);
  const i = Math.round(inches - ft * 12);
  return i === 12 ? `${ft + 1} ft 0 in` : `${ft} ft ${i} in`;
}

/** Accepts anything (parsed JSON) and returns a valid profile, or null. */
export function normalizeProfile(src: unknown): Profile | null {
  if (!src || typeof src !== 'object') return null;
  const s = src as Record<string, unknown>;
  const p: Partial<Profile> = {
    sex: s.sex === 'male' || s.sex === 'female' ? s.sex : undefined,
    age: Number(s.age),
    heightIn: Number(s.heightIn),
    weightLb: Number(s.weightLb),
    activity: ACTIVITY.some((a) => a.id === s.activity) ? (s.activity as Activity) : undefined,
    goal: GOALS.some((g) => g.id === s.goal) ? (s.goal as Goal) : undefined,
  };
  return profileError(p) ? null : (p as Profile);
}
