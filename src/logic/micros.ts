// Sodium, added sugar, vitamins and minerals: which ones the app tracks, their units, and daily reference
// amounts for adults (US Dietary Reference Intakes and Dietary Guidelines). Pure logic, no React.
//
// Foods only carry these when their source lists them (the USDA foods and many Open Food Facts products
// do; quick adds and older entries don't), so totals count what's known and say how much was covered.

import type { FoodEntry, Nutrients } from './nutrition';
import type { Sex } from './profile';

export type MicroKey = 'sodium' | 'addedSugar' | 'potassium' | 'calcium' | 'iron' | 'magnesium' | 'vitC' | 'vitD' | 'b12';

export interface MicroDef {
  key: MicroKey;
  label: string;
  unit: 'mg' | 'µg' | 'g';
  /** USDA FoodData Central nutrient id. */
  usda: number | null;
  /** Open Food Facts nutriment name (per 100 g, in grams) and the factor to this unit. */
  off: [string, number] | null;
  /** 'limit': stay under it (sodium, added sugar). 'target': aim to reach it. */
  kind: 'limit' | 'target';
}

export const MICROS: MicroDef[] = [
  { key: 'sodium', label: 'Sodium', unit: 'mg', usda: 1093, off: ['sodium', 1000], kind: 'limit' },
  { key: 'addedSugar', label: 'Added sugar', unit: 'g', usda: 1235, off: ['added-sugars', 1], kind: 'limit' },
  { key: 'potassium', label: 'Potassium', unit: 'mg', usda: 1092, off: ['potassium', 1000], kind: 'target' },
  { key: 'calcium', label: 'Calcium', unit: 'mg', usda: 1087, off: ['calcium', 1000], kind: 'target' },
  { key: 'iron', label: 'Iron', unit: 'mg', usda: 1089, off: ['iron', 1000], kind: 'target' },
  { key: 'magnesium', label: 'Magnesium', unit: 'mg', usda: 1090, off: ['magnesium', 1000], kind: 'target' },
  { key: 'vitC', label: 'Vitamin C', unit: 'mg', usda: 1162, off: ['vitamin-c', 1000], kind: 'target' },
  { key: 'vitD', label: 'Vitamin D', unit: 'µg', usda: 1114, off: ['vitamin-d', 1e6], kind: 'target' },
  { key: 'b12', label: 'Vitamin B12', unit: 'µg', usda: 1178, off: ['vitamin-b12', 1e6], kind: 'target' },
];

export const MICRO_KEYS = MICROS.map((m) => m.key);
export const MICRO_BY_KEY = Object.fromEntries(MICROS.map((m) => [m.key, m])) as Record<MicroKey, MicroDef>;

/**
 * The daily reference amount for an adult: a limit for sodium and added sugar, otherwise the recommended
 * intake. `kcal` is the day's calorie target (added sugar is under 10% of calories). Sex and age refine it
 * when known; otherwise the higher (men's) number is used.
 */
export function microTarget(key: MicroKey, sex: Sex | null, age: number | null, kcal: number | null): number {
  const f = sex === 'female';
  const a = age ?? 30;
  switch (key) {
    case 'sodium':
      return 2300;
    case 'addedSugar':
      return Math.round(((kcal ?? 2000) * 0.1) / 4);
    case 'potassium':
      return f ? 2600 : 3400;
    case 'calcium':
      return (f && a > 50) || a > 70 ? 1200 : 1000;
    case 'iron':
      return f && a <= 50 ? 18 : 8;
    case 'magnesium':
      return f ? (a < 31 ? 310 : 320) : a < 31 ? 400 : 420;
    case 'vitC':
      return f ? 75 : 90;
    case 'vitD':
      return a > 70 ? 20 : 15;
    case 'b12':
      return 2.4;
  }
}

/** Fiber to aim for: 14 g per 1,000 kcal, or 25 g (women) / 38 g (men) without a calorie target. */
export function fiberTarget(sex: Sex | null, kcal: number | null): number {
  if (kcal) return Math.round((kcal / 1000) * 14);
  return sex === 'female' ? 25 : 38;
}

export interface MicroDay {
  /** Total from the foods that list it. */
  sum: number;
  /** Share of the day's calories from foods that list it, 0..1. */
  covered: number;
}

/** A day's amount of one nutrient, and how much of the day's food it was known for. */
export function microDay(entries: readonly Pick<FoodEntry, 'n' | 'qty'>[], key: MicroKey): MicroDay | null {
  let sum = 0;
  let known = 0;
  let total = 0;
  for (const e of entries) {
    const kcal = e.n.kcal * e.qty;
    total += kcal;
    const v = e.n[key];
    if (v != null) {
      sum += v * e.qty;
      known += kcal;
    }
  }
  if (!entries.length || known === 0) return null;
  return { sum, covered: total > 0 ? known / total : 1 };
}

/** Copies the micronutrients that are present, scaled. */
export function scaleMicros(n: Nutrients, f: number, out: Nutrients): void {
  for (const k of MICRO_KEYS) {
    const v = n[k];
    if (v != null) out[k] = Math.round(v * f * 1000) / 1000;
  }
}
