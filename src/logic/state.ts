import { EMPTY_CARDIO, normalizeCardio } from './cardio';
import { DEFAULT_DIET, normalizeDiet } from './diet';
import { EMPTY_LIFTING, normalizeLifting } from './lifting';
import { isV1, migrateV1 } from './migrate';
import type { Food, FoodEntry, FoodTag, Nutrients, Portion } from './nutrition';
import { TAG_LABEL } from './nutrition';
import { normalizeProfile } from './profile';
import type { DayInfo, Sections, TrackerState } from './types';

export const ALL_SECTIONS: Sections = { food: true, cardio: true, lifting: true };

export function defaultState(): TrackerState {
  return {
    v: 2,
    updatedAt: 0,
    settings: { name: '', sections: { ...ALL_SECTIONS }, onboarded: false },
    goal: null,
    days: {},
    foods: [],
    meals: {},
    diet: { ...DEFAULT_DIET, limits: {}, exclude: [] },
    profile: null,
    cardio: { ...EMPTY_CARDIO, sessions: [], skips: [] },
    lifting: { ...EMPTY_LIFTING, exercises: [], routines: [], schedule: [...EMPTY_LIFTING.schedule], workouts: [] },
  };
}

const isDate = (k: string) => /^\d{4}-\d{2}-\d{2}$/.test(k);

/** Accepts anything (parsed JSON), including data saved by the first version of the app, and returns valid data. */
export function normalize(s: unknown): TrackerState {
  if (isV1(s)) return normalize(migrateV1(s as Record<string, unknown>));
  const d = defaultState();
  if (!s || typeof s !== 'object') return d;
  const src = s as Record<string, any>;
  if (typeof src.updatedAt === 'number' && Number.isFinite(src.updatedAt)) d.updatedAt = src.updatedAt;

  const st = src.settings ?? {};
  if (typeof st.name === 'string') d.settings.name = st.name.slice(0, 60);
  if (st.sections && typeof st.sections === 'object') {
    (['food', 'cardio', 'lifting'] as const).forEach((k) => {
      if (typeof st.sections[k] === 'boolean') d.settings.sections[k] = st.sections[k];
    });
  }
  d.settings.onboarded = st.onboarded === true;

  if (typeof src.goal === 'number' && src.goal > 0) d.goal = src.goal;
  if (src.days && typeof src.days === 'object') {
    Object.keys(src.days).forEach((k) => {
      const x = src.days[k];
      if (!isDate(k) || !x || typeof x !== 'object') return;
      const day: DayInfo = {};
      if (typeof x.cin === 'number' && x.cin >= 0) day.cin = x.cin;
      if (typeof x.cout === 'number' && x.cout >= 0) day.cout = x.cout;
      if (typeof x.note === 'string' && x.note) day.note = x.note;
      if (Object.keys(day).length) d.days[k] = day;
    });
  }

  if (Array.isArray(src.foods)) {
    d.foods = src.foods
      .map((f: any) => {
        const n = nutrients(f?.n);
        if (!f || typeof f.id !== 'string' || typeof f.name !== 'string' || !n) return null;
        const food: Food = { id: f.id, name: f.name, serving: typeof f.serving === 'string' ? f.serving : '1 serving', n, tags: tags(f.tags) };
        // Foods saved before database sources existed were all made by the user.
        if (f.custom === true || !f.src) food.custom = true;
        if (f.src === 'off' || f.src === 'fndds' || f.src === 'sr') food.src = f.src;
        if (typeof f.brand === 'string' && f.brand) food.brand = f.brand;
        const per100 = nutrients(f.per100);
        const portions: Portion[] = Array.isArray(f.portions)
          ? f.portions.filter((p: any) => p && typeof p.label === 'string' && Number(p.g) > 0).map((p: any) => ({ label: p.label, g: Number(p.g) }))
          : [];
        if (per100 && portions.length) {
          food.per100 = per100;
          food.portions = portions;
        }
        return food;
      })
      .filter((f: Food | null): f is Food => f !== null);
  }
  if (src.meals && typeof src.meals === 'object') {
    Object.keys(src.meals).forEach((k) => {
      if (!isDate(k) || !Array.isArray(src.meals[k])) return;
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
  d.profile = normalizeProfile(src.profile);
  d.cardio = normalizeCardio(src.cardio);
  d.lifting = normalizeLifting(src.lifting);
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
