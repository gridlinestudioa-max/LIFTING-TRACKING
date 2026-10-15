// The built-in USDA food list (src/logic/data/usda-foods.json, made by scripts/build-usda-foods.py).
// It's about 2.3 MB, so it's loaded the first time it's needed, not at app start.

import { MICRO_KEYS, type MicroKey } from './micros';
import { FOOD_TAGS, foodWithPortions, type Food, type FoodTag, type Nutrients, type Portion } from './nutrition';

type UsdaRecord = [string, string, 0 | 1, number, number, number, number, number, number, number, [string, number][], (number | null)[]?];

export interface UsdaFile {
  v: number;
  tags: string[];
  /** Keys of the last field (sodium, vitamins, ...), from version 2. */
  micros?: string[];
  foods: UsdaRecord[];
}

/** Turn the compact file into foods. Nutrients in the file are per 100 g. */
export function parseUsda(file: UsdaFile): Food[] {
  const tagIds = file.tags as FoodTag[];
  // The file's tag order must match the app's; anything unknown is dropped.
  const known = new Set(FOOD_TAGS.map((t) => t.id));
  const microKeys = (file.micros ?? []).map((k) => (MICRO_KEYS as string[]).includes(k) ? (k as MicroKey) : null);
  return file.foods.map(([id, name, src, kcal, protein, carbs, fat, fiber, sugar, mask, portions, micros]) => {
    const tags = tagIds.filter((t, i) => mask & (1 << i) && known.has(t));
    const ps: Portion[] = portions.map(([label, g]) => ({ label, g }));
    const per100: Nutrients = { kcal, protein, carbs, fat, fiber, sugar };
    micros?.forEach((v, i) => {
      const k = microKeys[i];
      if (k && v != null) per100[k] = v;
    });
    return foodWithPortions({ id, name, tags, src: src === 0 ? 'fndds' : 'sr' }, per100, ps);
  });
}

let cache: Promise<Food[]> | null = null;

/** All USDA foods. Loads once; later calls share the result. */
export function loadUsdaFoods(): Promise<Food[]> {
  cache ??= import('./data/usda-foods.json').then((m) => parseUsda((m.default ?? m) as unknown as UsdaFile));
  return cache;
}
