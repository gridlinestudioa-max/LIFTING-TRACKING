import { describe, expect, it } from '@jest/globals';

import {
  GRAMS,
  amountText,
  entryFromFood,
  entryTotals,
  evaluateDay,
  foodFromOff,
  isBarcode,
  parseUsda,
  normalize,
  offByBarcode,
  defaultState,
  portionText,
  portionsFor,
  searchFoods,
  searchOff,
  withStyle,
  DEFAULT_DIET,
  type Food,
} from '..';
import product from '../__fixtures__/off-product-cheerios.json';
import search from '../__fixtures__/off-search-quest-bar.json';
import usdaFile from '../data/usda-foods.json';

describe('USDA food list', () => {
  let foods: Food[] = [];
  const byName = (prefix: string) => foods.find((f) => f.name.startsWith(prefix))!;

  it('loads every food with nutrition and a default serving', () => {
    // The app loads this file lazily with import(); here it's read directly.
    foods = parseUsda(usdaFile as unknown as Parameters<typeof parseUsda>[0]);
    expect(foods.length).toBeGreaterThan(12000);
    expect(new Set(foods.map((f) => f.id)).size).toBe(foods.length);
    for (const f of foods) {
      expect(f.per100).toBeDefined();
      expect(f.portions!.length).toBeGreaterThan(0);
      expect(Number.isFinite(f.n.kcal)).toBe(true);
    }
  });

  it('has real USDA values', () => {
    const egg = byName('Egg, whole, raw, fresh');
    expect(egg.per100!.kcal).toBe(143);
    expect(egg.serving).toBe('1 large (50 g)');
    expect(egg.n.kcal).toBeCloseTo(71.5);
    expect(egg.tags).toEqual(['egg']);
    expect(byName('Pizza, cheese, from frozen').tags.sort()).toEqual(['dairy', 'grain']);
    expect(byName('Banana, raw').tags).toEqual([]);
  });

  it('finds what people type, best first', () => {
    const top = (q: string) => searchFoods(foods, q, [], 5).map((f) => f.name);
    expect(top('banana')[0]).toMatch(/^Banana/);
    expect(top('chicken breast')[0]).toMatch(/^Chicken breast/);
    expect(top('white rice')[0]).toMatch(/^Rice, white/);
    expect(top('ham').every((n) => !/graham/i.test(n))).toBe(true);
  });

  it('logs by portion or by weight', () => {
    const rice = byName('Rice, white, cooked, NS as to fat');
    const ps = portionsFor(rice);
    expect(ps[ps.length - 1]).toBe(GRAMS);
    const cup = ps.find((p) => p.label === '1 cup, cooked')!;
    const e = entryFromFood(rice, 2, 720, 'e1', cup);
    expect(e.serving).toBe('1 cup, cooked (163 g)');
    expect(entryTotals(e).kcal).toBeCloseTo(2 * 129 * 1.63, 1);
    const g = entryFromFood(rice, 150, 720, 'e2', GRAMS);
    expect(amountText(g)).toBe('150 g');
    expect(entryTotals(g).kcal).toBeCloseTo(1.29 * 150, 0);
  });

  it('diets read the tags', () => {
    const vegan = withStyle(DEFAULT_DIET, 'vegan');
    const cheesePizza = entryFromFood(byName('Pizza, cheese, from frozen'), 1, 720, 'p');
    expect(evaluateDay(vegan, [cheesePizza], false).flags.p).toEqual(['Has dairy']);
  });
});

describe('portions', () => {
  it('adds the weight to a label unless it has one', () => {
    expect(portionText({ label: '1 cup', g: 140 })).toBe('1 cup (140 g)');
    expect(portionText({ label: '1 bar (60 g)', g: 60 })).toBe('1 bar (60 g)');
    expect(portionText(GRAMS)).toBe('1 g');
    expect(amountText({ qty: 2, serving: '1 cup (140 g)' })).toBe('2 × 1 cup (140 g)');
  });
});

describe('Open Food Facts', () => {
  const okFetch = (body: unknown, status = 200) => async () => ({ ok: status < 400, status, json: async () => body });

  it('reads a product (real API response)', () => {
    const f = foodFromOff(product.product)!;
    expect(f.id).toBe('o0016000275263');
    expect(f.name).toBe('Cheerios');
    expect(f.brand).toBe('General Mills');
    expect(f.serving).toBe('1 ½ cup (39 g)');
    expect(Math.round(f.n.kcal)).toBe(140);
    expect(f.n.protein).toBeCloseTo(5);
    expect(f.tags.sort()).toEqual(['grain', 'sugar']);
  });

  it('reads search results, US first, with allergens as diet tags', () => {
    const foods = search.products.map(foodFromOff).filter(Boolean) as Food[];
    expect(foods).toHaveLength(6);
    const bar = foods[0];
    expect(bar.serving).toBe('1 serving (60 g)');
    expect(Math.round(bar.n.kcal)).toBe(190);
    expect(bar.tags.sort()).toEqual(['dairy', 'legume']);
  });

  it('treats fiber above carbs as EU-style carbs', () => {
    const f = foodFromOff({ code: '1', product_name: 'Bar', nutriments: { 'energy-kcal_100g': 300, carbohydrates_100g: 4, fiber_100g: 13 } })!;
    expect(f.per100!.carbs).toBe(17);
  });

  it('skips products without calories', () => {
    expect(foodFromOff({ code: '1', product_name: 'Mystery', nutriments: {} })).toBeNull();
    expect(foodFromOff({ code: '2', product_name: 'Kj only', nutriments: { energy_100g: 418.4 } })!.per100!.kcal).toBe(100);
  });

  it('searches and looks up barcodes', async () => {
    expect((await searchOff('quest bar', { fetch: okFetch(search) })).length).toBe(6);
    expect((await offByBarcode('0016000275263', { fetch: okFetch(product) })).name).toBe('Cheerios');
    await expect(offByBarcode('0000000000017', { fetch: okFetch({ status: 0 }) })).rejects.toThrow(/No product with barcode/);
    await expect(searchOff('x', { fetch: okFetch({}, 429) })).rejects.toThrow(/busy/);
    await expect(searchOff('x', { fetch: async () => { throw new TypeError('offline'); } })).rejects.toThrow(/connection/);
    expect(isBarcode('0016000275263')).toBe(true);
    expect(isBarcode('quest 60')).toBe(false);
  });

  it('a logged product is saved on the device with its portions', () => {
    const st = defaultState();
    st.foods = [foodFromOff(product.product)!];
    const back = normalize(JSON.parse(JSON.stringify(st)));
    expect(back.foods[0]).toEqual(st.foods[0]);
    expect(back.foods[0].custom).toBeUndefined();
  });
});
