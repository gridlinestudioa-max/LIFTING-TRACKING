import { ALL_EXERCISES, START_DEFAULT } from './config';
import { mondayOf } from './dates';
import { DEFAULT_DIET, normalizeDiet } from './diet';
import type { Food, FoodEntry, FoodTag, Nutrients } from './nutrition';
import { TAG_LABEL } from './nutrition';
import type { DayLog, TrackerState } from './types';

export function defaultState(): TrackerState {
  const base: Record<string, number> = {};
  ALL_EXERCISES.forEach((e) => {
    base[e.id] = e.w;
  });
  return { start: START_DEFAULT, base, goal: null, logs: {}, foods: [], meals: {}, diet: { ...DEFAULT_DIET, limits: {}, exclude: [] }, foodLog: true };
}

/** Accepts anything (parsed JSON) and returns a valid state, migrating old fields. */
export function normalize(s: unknown): TrackerState {
  const d = defaultState();
  if (!s || typeof s !== 'object') return d;
  const src = s as Record<string, any>;
  if (typeof src.start === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(src.start)) d.start = src.start;
  if (typeof src.goal === 'number' && src.goal > 0) d.goal = src.goal;
  if (src.base && typeof src.base === 'object') {
    Object.keys(d.base).forEach((k) => {
      if (typeof src.base[k] === 'number') d.base[k] = src.base[k];
    });
  }
  if (src.logs && typeof src.logs === 'object') {
    const logs: Record<string, DayLog> = {};
    Object.keys(src.logs).forEach((k) => {
      const l = src.logs[k];
      if (!l || typeof l !== 'object') return;
      const copy: Record<string, any> = { ...l };
      if (copy.mins > 0 && !(copy.secs > 0)) copy.secs = copy.mins * 60;
      delete copy.mins;
      if (copy.submitted === undefined) copy.submitted = true;
      logs[k] = copy as DayLog;
    });
    d.logs = logs;
  }
  if (Array.isArray(src.foods)) {
    d.foods = src.foods
      .map((f: any) => {
        const n = nutrients(f?.n);
        if (!f || typeof f.id !== 'string' || typeof f.name !== 'string' || !n) return null;
        const food: Food = { id: f.id, name: f.name, serving: typeof f.serving === 'string' ? f.serving : '1 serving', n, tags: tags(f.tags), custom: true };
        if (typeof f.brand === 'string' && f.brand) food.brand = f.brand;
        return food;
      })
      .filter((f: Food | null): f is Food => f !== null);
  }
  if (src.meals && typeof src.meals === 'object') {
    Object.keys(src.meals).forEach((k) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || !Array.isArray(src.meals[k])) return;
      const list = src.meals[k]
        .map((e: any): FoodEntry | null => {
          const n = nutrients(e?.n);
          const at = Number(e?.at);
          const qty = Number(e?.qty);
          if (!e || typeof e.id !== 'string' || !n || !(at >= 0 && at < 1440) || !(qty > 0)) return null;
          const out: FoodEntry = {
            id: e.id,
            name: typeof e.name === 'string' ? e.name : 'Food',
            serving: typeof e.serving === 'string' ? e.serving : '1 serving',
            qty,
            n,
            tags: tags(e.tags),
            at: Math.round(at),
          };
          if (typeof e.foodId === 'string') out.foodId = e.foodId;
          return out;
        })
        .filter((e: FoodEntry | null): e is FoodEntry => e !== null);
      if (list.length) d.meals[k] = list;
    });
  }
  d.diet = normalizeDiet(src.diet);
  d.foodLog = src.foodLog !== false;
  return d;
}

function nutrients(n: any): Nutrients | null {
  if (!n || typeof n !== 'object') return null;
  const v = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : null);
  const kcal = v(n.kcal);
  if (kcal == null) return null;
  const out: Nutrients = { kcal, protein: v(n.protein) ?? 0, carbs: v(n.carbs) ?? 0, fat: v(n.fat) ?? 0 };
  if (v(n.fiber) != null) out.fiber = v(n.fiber)!;
  if (v(n.sugar) != null) out.sugar = v(n.sugar)!;
  return out;
}

function tags(t: unknown): FoodTag[] {
  return Array.isArray(t) ? (t.filter((x) => typeof x === 'string' && x in TAG_LABEL) as FoodTag[]) : [];
}

/** Any chosen date snaps back to that week's Monday. */
export function snapStart(dateStr: string): string {
  return mondayOf(dateStr);
}
