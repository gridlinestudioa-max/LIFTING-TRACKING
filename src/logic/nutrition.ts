// Foods, the food log, and nutrition totals. Pure logic, no React.

/** Food groups a diet can rule out. Kept on each food so diets like vegan or paleo can read them. */
export type FoodTag = 'meat' | 'fish' | 'dairy' | 'egg' | 'grain' | 'legume' | 'sugar' | 'alcohol';

export const FOOD_TAGS: { id: FoodTag; label: string }[] = [
  { id: 'meat', label: 'Meat or poultry' },
  { id: 'fish', label: 'Fish or seafood' },
  { id: 'dairy', label: 'Dairy' },
  { id: 'egg', label: 'Eggs' },
  { id: 'grain', label: 'Grains' },
  { id: 'legume', label: 'Beans, peanuts or soy' },
  { id: 'sugar', label: 'Added sugar' },
  { id: 'alcohol', label: 'Alcohol' },
];

export const TAG_LABEL: Record<FoodTag, string> = Object.fromEntries(FOOD_TAGS.map((t) => [t.id, t.label])) as Record<
  FoodTag,
  string
>;

/** Nutrition for one serving. Grams except kcal. */
export interface Nutrients {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
}

/** A household measure for a food: "1 cup" weighs 140 g. */
export interface Portion {
  label: string;
  g: number;
}

/** Weigh it: the amount is in grams. */
export const GRAMS: Portion = { label: 'g', g: 1 };

/** USDA FNDDS (foods as eaten), USDA SR Legacy (ingredients), or Open Food Facts (branded, online). */
export type FoodSource = 'fndds' | 'sr' | 'off';

export const SOURCE_LABEL: Record<FoodSource, string> = { fndds: 'USDA', sr: 'USDA', off: 'Open Food Facts' };

export interface Food {
  id: string;
  name: string;
  brand?: string;
  /** What one serving is, e.g. "1 cup (158 g)". */
  serving: string;
  /** Nutrition for one serving. */
  n: Nutrients;
  tags: FoodTag[];
  /** Added by the user (editable, saved on the device). */
  custom?: boolean;
  /** Where a database food came from. */
  src?: FoodSource;
  /** Nutrition per 100 g, when the food has weights. `serving`/`n` are then the first portion. */
  per100?: Nutrients;
  /** Household measures with weights; the first is the default serving. */
  portions?: Portion[];
}

/**
 * One thing eaten. Nutrition and tags are copied from the food when it's logged, so editing or
 * deleting a food later never rewrites what was already eaten.
 */
export interface FoodEntry {
  id: string;
  /** The food it came from, or undefined for a quick add. */
  foodId?: string;
  name: string;
  serving: string;
  /** Number of servings. */
  qty: number;
  /** Per serving. */
  n: Nutrients;
  tags: FoodTag[];
  /** Minutes after midnight, local time. */
  at: number;
}

export interface Totals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  /** Carbs minus fiber, never below 0. */
  netCarbs: number;
}

export const ZERO_TOTALS: Totals = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, netCarbs: 0 };

export function entryTotals(e: Pick<FoodEntry, 'n' | 'qty'>): Totals {
  const q = e.qty;
  const fiber = (e.n.fiber ?? 0) * q;
  const carbs = e.n.carbs * q;
  return {
    kcal: e.n.kcal * q,
    protein: e.n.protein * q,
    carbs,
    fat: e.n.fat * q,
    fiber,
    sugar: (e.n.sugar ?? 0) * q,
    netCarbs: Math.max(0, carbs - fiber),
  };
}

export function sumTotals(entries: readonly Pick<FoodEntry, 'n' | 'qty'>[]): Totals {
  return entries.reduce<Totals>((a, e) => {
    const t = entryTotals(e);
    return {
      kcal: a.kcal + t.kcal,
      protein: a.protein + t.protein,
      carbs: a.carbs + t.carbs,
      fat: a.fat + t.fat,
      fiber: a.fiber + t.fiber,
      sugar: a.sugar + t.sugar,
      netCarbs: a.netCarbs + t.netCarbs,
    };
  }, ZERO_TOTALS);
}

/** Share of calories from fat, 0..100. Null when there are no calories. */
export function fatPct(t: Totals): number | null {
  return t.kcal > 0 ? ((t.fat * 9) / t.kcal) * 100 : null;
}

/** Entries sorted by time eaten. */
export function byTime(entries: readonly FoodEntry[]): FoodEntry[] {
  return [...entries].sort((a, b) => a.at - b.at);
}

/** Short unique id for foods and entries. */
export function newId(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** Build a log entry from a food. */
export function entryFromFood(food: Food, qty: number, at: number, id = newId('e'), portion?: Portion): FoodEntry {
  const p = portion && food.per100 ? portion : null;
  return {
    id,
    foodId: food.id,
    name: food.brand ? `${food.name} (${food.brand})` : food.name,
    serving: p ? portionText(p) : food.serving,
    qty,
    n: p ? scaleNutrients(food.per100!, p.g / 100) : { ...food.n },
    tags: [...food.tags],
    at,
  };
}

/**
 * Nutrients times a factor. Kept to 3 decimals, not rounded for display, since a per-gram value
 * gets multiplied back up (150 g of rice) and early rounding would throw that off.
 */
export function scaleNutrients(n: Nutrients, f: number): Nutrients {
  const r = (v: number) => Math.round(v * f * 1000) / 1000;
  const out: Nutrients = { kcal: r(n.kcal), protein: r(n.protein), carbs: r(n.carbs), fat: r(n.fat) };
  if (n.fiber != null) out.fiber = r(n.fiber);
  if (n.sugar != null) out.sugar = r(n.sugar);
  return out;
}

const fmtG = (g: number) => String(Math.round(g * 10) / 10);

/** "1 cup (140 g)", or "1 g" for the grams portion. Labels that already give the weight are left alone. */
export function portionText(p: Portion): string {
  if (p.label === GRAMS.label) return '1 g';
  return /\d\s*g\b|\(\d+(?:\.\d+)?\s*g\)/.test(p.label) ? p.label : `${p.label} (${fmtG(p.g)} g)`;
}

/** How an entry's amount reads: "150 g", "1 cup (140 g)", "2 × 1 cup (140 g)". */
export function amountText(e: Pick<FoodEntry, 'qty' | 'serving'>): string {
  const q = Math.round(e.qty * 100) / 100;
  if (e.serving === '1 g') return `${q} g`;
  return q === 1 ? e.serving : `${q} × ${e.serving}`;
}

/** The portions to offer for a food: its own (or one serving), plus grams when it has weights. */
export function portionsFor(food: Food): Portion[] {
  if (!food.per100) return [];
  const own = food.portions?.length ? food.portions : [{ label: '100 g', g: 100 }];
  return [...own, GRAMS];
}

/** Build a database food from per-100 g nutrition and its portions; the first portion is the default. */
export function foodWithPortions(f: Omit<Food, 'serving' | 'n'>, per100: Nutrients, portions: Portion[]): Food {
  const ps = portions.filter((p) => p.g > 0);
  const first = ps[0] ?? { label: '100 g', g: 100 };
  return { ...f, per100, portions: ps.length ? ps : [first], serving: portionText(first), n: scaleNutrients(per100, first.g / 100) };
}

/** A calories-only entry (macros optional). */
export function quickEntry(name: string, n: Nutrients, at: number, id = newId('e')): FoodEntry {
  return { id, name: name.trim() || 'Quick add', serving: '1 serving', qty: 1, n, tags: [], at };
}

// ---------- Clock times ----------

/** Minutes after midnight for a Date (local). */
export function minutesOf(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

/** 750 -> "12:30 PM". Wraps past midnight. */
export function fmtClock(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const mm = m % 60;
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${String(mm).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`;
}

/**
 * Parse a typed time to minutes after midnight, or null.
 * Accepts "7", "7pm", "7:30 pm", "7.30p", "730pm", "19:30", "1930", "12a".
 * Without am/pm, 1..11 is read as given on a 24-hour clock ("7" = 7:00 AM, "19" = 7:00 PM).
 */
export function parseClock(input: string): number | null {
  const t = input.trim().toLowerCase().replace(/\s+/g, '').replace(/\./g, ':');
  const m = /^(\d{1,4})(?::(\d{2}))?(a|am|p|pm)?$/.exec(t);
  if (!m) return null;
  let h: number;
  let min: number;
  if (m[2] != null) {
    h = Number(m[1]);
    min = Number(m[2]);
  } else if (m[1].length >= 3) {
    h = Number(m[1].slice(0, -2));
    min = Number(m[1].slice(-2));
  } else {
    h = Number(m[1]);
    min = 0;
  }
  if (min > 59) return null;
  const ap = m[3];
  if (ap) {
    if (h < 1 || h > 12) return null;
    if (h === 12) h = 0;
    if (ap.startsWith('p')) h += 12;
  } else if (h > 23) {
    return null;
  }
  return h * 60 + min;
}

/** "2h 05m", "45m". */
export function fmtDuration(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h > 0 ? `${h}h ${String(r).padStart(2, '0')}m` : `${r}m`;
}

// ---------- Search ----------

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const tokenize = (s: string) => norm(s).split(/[^a-z0-9%]+/).filter(Boolean);

interface Indexed {
  name: string;
  /** Words of the name and brand. */
  words: string[];
}
const index = new WeakMap<Food, Indexed>();
function indexed(f: Food): Indexed {
  let x = index.get(f);
  if (!x) {
    x = { name: norm(f.name), words: tokenize(`${f.name} ${f.brand ?? ''}`) };
    index.set(f, x);
  }
  return x;
}

/**
 * Foods where every query word starts a word of the name or brand ("ham" finds ham, not graham).
 * Best first: your own foods and recent foods, name starting with the query, the first part of the
 * name (before the comma) matching, foods as eaten (FNDDS) over ingredients, then shorter names.
 * An empty query returns recent foods only.
 */
export function searchFoods(foods: readonly Food[], query: string, recent: readonly string[] = [], limit = 50): Food[] {
  const q = norm(query.trim());
  const qWords = tokenize(query);
  const recentRank = new Map(recent.map((id, i) => [id, i]));
  if (!qWords.length) {
    const byId = new Map(foods.map((f) => [f.id, f]));
    return recent.map((id) => byId.get(id)).filter((f): f is Food => !!f).slice(0, limit);
  }
  const scored: { f: Food; score: number }[] = [];
  for (const f of foods) {
    const x = indexed(f);
    if (!qWords.every((w) => x.words.some((t) => t.startsWith(w)))) continue;
    let score = 0;
    const head = x.name.split(',')[0].trim();
    if (x.name.startsWith(q)) score += 300;
    if (head === q || head === `${q}s` || `${head}s` === q) score += 200;
    // Words matched whole (not just as a prefix).
    score += qWords.filter((w) => x.words.includes(w)).length * 20;
    // USDA names lead with the main food ("Rice, white, ..."), so a query word there counts most.
    if (qWords.includes(x.words[0])) score += 80;
    const r = recentRank.get(f.id);
    if (r != null) score += 400 - Math.min(r, 99);
    if (f.custom) score += 150;
    if (f.src === 'fndds') score += 40;
    score -= Math.min(x.name.length, 120) * 0.6;
    scored.push({ f, score });
  }
  scored.sort((a, b) => b.score - a.score || a.f.name.localeCompare(b.f.name));
  return scored.slice(0, limit).map((s) => s.f);
}

/** Food ids from the log, most recently eaten first, no repeats. */
export function recentFoodIds(meals: Record<string, FoodEntry[]>, limit = 20): string[] {
  const out: string[] = [];
  const days = Object.keys(meals).sort().reverse();
  for (const d of days) {
    for (const e of byTime(meals[d]).reverse()) {
      if (e.foodId && !out.includes(e.foodId)) out.push(e.foodId);
      if (out.length >= limit) return out;
    }
  }
  return out;
}

/** Problems with a food the user is creating, or null if it can be saved. */
export function foodError(f: { name: string; serving: string; n: Nutrients }): string | null {
  if (!f.name.trim()) return 'Give the food a name.';
  if (!f.serving.trim()) return 'Say what one serving is, e.g. "1 cup" or "100 g".';
  const vals = [f.n.kcal, f.n.protein, f.n.carbs, f.n.fat, f.n.fiber ?? 0, f.n.sugar ?? 0];
  if (vals.some((v) => !Number.isFinite(v) || v < 0)) return 'Nutrition numbers can’t be negative.';
  if ((f.n.fiber ?? 0) > f.n.carbs) return 'Fiber is part of carbs, so it can’t be more than carbs.';
  if ((f.n.sugar ?? 0) > f.n.carbs) return 'Sugar is part of carbs, so it can’t be more than carbs.';
  return null;
}

/**
 * Calories implied by the macros: 4 per g protein and net carbs, 9 per g fat. Fiber is left out
 * since it adds little, which is how high-fiber labels (protein bars) add up.
 * Used to warn when a typed label doesn't add up.
 */
export function macroKcal(n: Nutrients): number {
  return n.protein * 4 + Math.max(0, n.carbs - (n.fiber ?? 0)) * 4 + n.fat * 9;
}
