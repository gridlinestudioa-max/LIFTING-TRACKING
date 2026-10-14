// Open Food Facts (https://world.openfoodfacts.org): branded and packaged foods, searched online.
// Data is © Open Food Facts contributors, under the Open Database License (ODbL); the app shows that credit.
// The search API allows about 10 searches a minute per user, so the app only searches when asked.

import { foodWithPortions, type Food, type FoodTag, type Nutrients, type Portion } from './nutrition';

const BASE = 'https://world.openfoodfacts.org';
const FIELDS = [
  'code',
  'product_name',
  'product_name_en',
  'brands',
  'serving_size',
  'serving_quantity',
  'serving_quantity_unit',
  'nutriments',
  'countries_tags',
  'categories_tags',
  'allergens_tags',
  'ingredients_analysis_tags',
].join(',');

/** A product as the API returns it (only the fields we ask for, all optional). */
export interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_en?: string;
  brands?: string | string[];
  serving_size?: string;
  serving_quantity?: number | string;
  serving_quantity_unit?: string;
  nutriments?: Record<string, number | string | undefined>;
  countries_tags?: string[];
  categories_tags?: string[];
  allergens_tags?: string[];
  ingredients_analysis_tags?: string[];
}

const numOf = (v: unknown): number | null => {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
};

const ALLERGEN_TAGS: Record<string, FoodTag> = {
  'en:milk': 'dairy',
  'en:eggs': 'egg',
  'en:fish': 'fish',
  'en:crustaceans': 'fish',
  'en:molluscs': 'fish',
  'en:gluten': 'grain',
  'en:peanuts': 'legume',
  'en:soybeans': 'legume',
  'en:lupin': 'legume',
};

const CATEGORY_TAGS: [RegExp, FoodTag][] = [
  [/^en:(meats?|poultry|beef|pork|chicken|hams?|sausages?|bacon|prepared-meats|meat-based-products)/, 'meat'],
  [/^en:(fishes|seafood|fish-and-seafood|canned-fishes|tunas|salmons|shrimps)/, 'fish'],
  [/^en:(dairies|cheeses|milks|yogurts|fermented-milk-products|butters|creams)$/, 'dairy'],
  [/^en:eggs$/, 'egg'],
  [/^en:(breads|cereals-and-their-products|breakfast-cereals|pastas|biscuits|cakes|crackers|rices)$/, 'grain'],
  [/^en:(legumes|legumes-and-their-products|beans|lentils|chickpeas|peanut-butters|tofus)$/, 'legume'],
  [/^en:(sweets|confectioneries|candies|chocolates|sodas|sweetened-beverages|sugary-snacks|desserts|ice-creams)$/, 'sugar'],
  [/^en:(alcoholic-beverages|beers|wines|spirits|liquors|ciders)$/, 'alcohol'],
];

/** Food groups for diets, from allergens, categories and the vegan/vegetarian analysis. A best guess. */
export function offTags(p: OffProduct): FoodTag[] {
  const tags = new Set<FoodTag>();
  for (const a of p.allergens_tags ?? []) if (ALLERGEN_TAGS[a]) tags.add(ALLERGEN_TAGS[a]);
  for (const c of p.categories_tags ?? []) for (const [re, t] of CATEGORY_TAGS) if (re.test(c)) tags.add(t);
  const analysis = p.ingredients_analysis_tags ?? [];
  // Not vegetarian but no fish found: it's meat.
  if (analysis.includes('en:non-vegetarian') && !tags.has('fish')) tags.add('meat');
  const added = numOf(p.nutriments?.['added-sugars_100g']);
  if (added != null && added > 0) tags.add('sugar');
  return [...tags];
}

/** A product as a food, or null when it has no name or no calories. */
export function foodFromOff(p: OffProduct): Food | null {
  const name = (p.product_name_en || p.product_name || '').trim();
  const code = (p.code ?? '').trim();
  const nm = p.nutriments ?? {};
  let kcal = numOf(nm['energy-kcal_100g']);
  if (kcal == null) {
    const kj = numOf(nm['energy_100g']);
    if (kj != null) kcal = kj / 4.184;
  }
  if (!name || !code || kcal == null) return null;
  const g = (k: string) => numOf(nm[`${k}_100g`]) ?? 0;
  let carbs = g('carbohydrates');
  const fiber = g('fiber');
  // EU labels give carbs without fiber; US labels include it. Fiber above carbs can only be the EU way.
  if (fiber > carbs) carbs += fiber;
  const per100: Nutrients = {
    kcal: Math.round(kcal * 10) / 10,
    protein: g('proteins'),
    carbs,
    fat: g('fat'),
    fiber,
    sugar: Math.min(g('sugars'), carbs),
  };

  const portions: Portion[] = [];
  const sq = numOf(p.serving_quantity);
  const unit = (p.serving_quantity_unit ?? 'g').toLowerCase();
  // Liquids are given in ml; treat 1 ml as 1 g (close enough for drinks).
  if (sq && sq > 0 && (unit === 'g' || unit === 'ml')) {
    const size = (p.serving_size ?? '').trim();
    // "60 g" says nothing more than the weight; "1 bar (60 g)" or "1 ½ cup (39 g)" is worth keeping.
    const label = !size || /^[\d.,]+\s*(g|ml)$/i.test(size) ? '1 serving' : size;
    portions.push({ label, g: sq });
  }
  portions.push({ label: '100 g', g: 100 });

  const brands = Array.isArray(p.brands) ? p.brands : (p.brands ?? '').split(',');
  const brand = brands.map((b) => b.trim()).find(Boolean);
  const food = foodWithPortions({ id: `o${code}`, name, tags: offTags(p), src: 'off' }, per100, portions);
  if (brand) food.brand = brand;
  return food;
}

/** True when the query looks like a barcode (8 to 14 digits). */
export function isBarcode(q: string): boolean {
  return /^\d{8,14}$/.test(q.trim());
}

export class OffError extends Error {
  constructor(
    message: string,
    readonly kind: 'network' | 'busy' | 'notfound',
  ) {
    super(message);
  }
}

type Fetch = (url: string, init?: { headers?: Record<string, string>; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

async function getJson(url: string, fetchFn: Fetch, headers?: Record<string, string>, signal?: AbortSignal): Promise<unknown> {
  let res;
  try {
    res = await fetchFn(url, { headers, signal });
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw e;
    throw new OffError('Couldn’t reach Open Food Facts. Check your connection and try again.', 'network');
  }
  if (res.status === 404) throw new OffError('Not found on Open Food Facts.', 'notfound');
  if (res.status === 429 || res.status === 503) {
    throw new OffError('Open Food Facts is busy. Wait a minute and try again.', 'busy');
  }
  if (!res.ok) throw new OffError('Open Food Facts didn’t answer. Try again in a moment.', 'network');
  try {
    return await res.json();
  } catch {
    // Under load the API can return an HTML error page instead of JSON.
    throw new OffError('Open Food Facts is busy. Wait a minute and try again.', 'busy');
  }
}

/** US products first (the app is in miles and pounds), then the rest; products without calories dropped. */
export function rankOff(products: OffProduct[]): Food[] {
  const us = (p: OffProduct) => (p.countries_tags ?? []).includes('en:united-states');
  const seen = new Set<string>();
  return [...products.filter(us), ...products.filter((p) => !us(p))]
    .map(foodFromOff)
    .filter((f): f is Food => {
      if (!f || seen.has(f.id)) return false;
      seen.add(f.id);
      return true;
    });
}

/** Search branded foods by name. */
export async function searchOff(query: string, opts: { fetch: Fetch; headers?: Record<string, string>; signal?: AbortSignal }): Promise<Food[]> {
  const q = encodeURIComponent(query.trim());
  const url = `${BASE}/cgi/search.pl?search_terms=${q}&search_simple=1&action=process&json=1&page_size=30&sort_by=unique_scans_n&fields=${FIELDS}`;
  const data = (await getJson(url, opts.fetch, opts.headers, opts.signal)) as { products?: OffProduct[] };
  return rankOff(data?.products ?? []);
}

/** Look up one product by barcode. */
export async function offByBarcode(code: string, opts: { fetch: Fetch; headers?: Record<string, string>; signal?: AbortSignal }): Promise<Food> {
  const url = `${BASE}/api/v2/product/${encodeURIComponent(code.trim())}.json?fields=${FIELDS}`;
  const missing = new OffError(`No product with barcode ${code.trim()} on Open Food Facts.`, 'notfound');
  let data: { status?: number; product?: OffProduct };
  try {
    data = (await getJson(url, opts.fetch, opts.headers, opts.signal)) as typeof data;
  } catch (e) {
    throw e instanceof OffError && e.kind === 'notfound' ? missing : e;
  }
  const food = data?.product && data.status !== 0 ? foodFromOff({ code: code.trim(), ...data.product }) : null;
  if (!food) throw missing;
  return food;
}
