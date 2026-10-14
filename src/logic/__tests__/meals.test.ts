import { describe, expect, it } from '@jest/globals';

import {
  amountText,
  bumpTally,
  copyEntries,
  daysWithMeal,
  defaultState,
  entryFromFood,
  mealAt,
  mealEntries,
  mealOf,
  normalize,
  piecesIn,
  searchFoods,
  sumTotals,
  tallyCount,
  tallyEntry,
  tallyUnit,
  type Food,
  type FoodEntry,
} from '..';

const mint: Food = { id: 'f-mint', name: 'Mint', serving: '1 mint', n: { kcal: 10, protein: 0, carbs: 2.5, fat: 0 }, tags: ['sugar'], custom: true };
const rice: Food = {
  id: 'f-rice',
  name: 'Rice',
  serving: '1 cup (158 g)',
  n: { kcal: 205, protein: 4, carbs: 45, fat: 0.4 },
  per100: { kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 },
  portions: [{ label: '1 cup', g: 158 }],
  tags: ['grain'],
  src: 'sr',
};
const at = (h: number, m = 0) => h * 60 + m;
const e = (id: string, time: number, meal?: FoodEntry['meal']): FoodEntry => ({ ...entryFromFood(mint, 1, time, id), ...(meal ? { meal } : {}) });

describe('meals', () => {
  it('places entries without a meal by time of day', () => {
    expect(mealAt(at(7, 30))).toBe('breakfast');
    expect(mealAt(at(12))).toBe('lunch');
    expect(mealAt(at(15, 30))).toBe('snack');
    expect(mealAt(at(18, 45))).toBe('dinner');
    expect(mealAt(at(23))).toBe('snack');
    expect(mealAt(at(2))).toBe('snack');
    expect(mealOf({ at: at(7), meal: 'dinner' })).toBe('dinner');
  });

  it('groups a day by meal, leaving tally entries out', () => {
    const list = [e('a', at(12, 30)), e('b', at(12), 'lunch'), e('c', at(8)), bumpTally([], mint, 2, at(13))[0]];
    expect(mealEntries(list, 'lunch').map((x) => x.id)).toEqual(['b', 'a']);
    expect(mealEntries(list, 'breakfast').map((x) => x.id)).toEqual(['c']);
    expect(mealEntries(list, 'snack')).toEqual([]);
  });

  it('finds earlier days with a meal, newest first', () => {
    const meals = { '2026-10-13': [e('a', at(12))], '2026-10-11': [e('b', at(13), 'lunch')], '2026-10-12': [e('c', at(8))] };
    expect(daysWithMeal(meals, '2026-10-14', 'lunch')).toEqual(['2026-10-13', '2026-10-11']);
    expect(daysWithMeal(meals, '2026-10-14', 'dinner')).toEqual([]);
    expect(daysWithMeal(meals, '2026-10-13', 'lunch')).toEqual(['2026-10-11']);
  });

  it('copies entries with new ids, the target meal and the same times', () => {
    const src = [e('a', at(12, 15)), { ...e('b', at(12, 30)), note: 'no cheese' }];
    const out = copyEntries(src, 'lunch');
    expect(out.map((x) => x.id)).not.toContain('a');
    expect(new Set(out.map((x) => x.id)).size).toBe(2);
    expect(out.map((x) => [x.at, x.meal, x.name])).toEqual([
      [at(12, 15), 'lunch', 'Mint'],
      [at(12, 30), 'lunch', 'Mint'],
    ]);
    expect(out[1].note).toBe('no cheese');
    expect(sumTotals(out).kcal).toBe(20);
  });
});

describe('tally', () => {
  it('counts up and down in one entry per food per day', () => {
    let day: FoodEntry[] = [e('x', at(9))];
    day = bumpTally(day, mint, 1, at(10));
    day = bumpTally(day, mint, 1, at(11));
    day = bumpTally(day, mint, 1, at(14));
    expect(day).toHaveLength(2);
    const t = tallyEntry(day, mint.id)!;
    expect(t.qty).toBe(3);
    expect(t.at).toBe(at(14));
    expect(t.tally).toBe(true);
    expect(sumTotals(day).kcal).toBe(40);
    day = bumpTally(day, mint, -1, at(15));
    expect(tallyEntry(day, mint.id)!.qty).toBe(2);
    expect(tallyEntry(day, mint.id)!.at).toBe(at(14));
    day = bumpTally(bumpTally(day, mint, -1, at(15)), mint, -1, at(15));
    expect(tallyEntry(day, mint.id)).toBeUndefined();
    expect(day.map((x) => x.id)).toEqual(['x']);
    expect(bumpTally([], mint, -1, at(9))).toEqual([]);
  });

  it('counts the chosen measure for foods with weights', () => {
    const f: Food = { ...rice, tally: true, tallyPortion: { label: '1 tbsp', g: 10 } };
    const [t] = bumpTally([], f, 2, at(9));
    expect(t.serving).toBe('1 tbsp (10 g)');
    expect(t.n.kcal).toBe(13);
    expect(bumpTally([], { ...rice, tally: true }, 1, at(9))[0].n.kcal).toBe(205);
  });
});

describe('food details', () => {
  it('keeps details, tally and meals through a save and load', () => {
    const st = defaultState();
    st.foods = [{ ...mint, note: 'sugar free', tally: true }, { ...rice, tally: true, tallyPortion: { label: '1 tbsp', g: 10 } }];
    st.meals['2026-10-14'] = [{ ...entryFromFood(st.foods[0], 1, at(12)), meal: 'lunch' }, ...bumpTally([], mint, 3, at(13))];
    const back = normalize(JSON.parse(JSON.stringify(st)));
    expect(back.foods[0]).toMatchObject({ note: 'sugar free', tally: true });
    expect(back.foods[1].tallyPortion).toEqual({ label: '1 tbsp', g: 10 });
    expect(back.meals['2026-10-14'][0]).toMatchObject({ meal: 'lunch', note: 'sugar free' });
    expect(back.meals['2026-10-14'][1]).toMatchObject({ tally: true, qty: 3, meal: 'snack' });
    const old = normalize({ v: 2, meals: { '2026-10-14': [{ id: 'e1', n: { kcal: 5 }, qty: 1, at: 600, meal: 'brunch' }] } });
    expect(old.meals['2026-10-14'][0].meal).toBeUndefined();
  });

  it('finds two foods with the same name by their details', () => {
    const a: Food = { ...mint, id: 'a', name: 'Chili', note: 'Mom’s recipe' };
    const b: Food = { ...mint, id: 'b', name: 'Chili', note: 'Canned, low sodium' };
    expect(searchFoods([a, b], 'chili').map((f) => f.id).sort()).toEqual(['a', 'b']);
    expect(searchFoods([a, b], 'chili canned').map((f) => f.id)).toEqual(['b']);
  });
});

describe('tally by the piece', () => {
  const mints: Food = { id: 'f-wg', name: 'Wintergreen mints', serving: '4 pieces (8 g)', n: { kcal: 20, protein: 0, carbs: 5, fat: 0 }, tags: [], custom: true, tally: true };

  it('reads pieces from serving labels', () => {
    expect(piecesIn('4 pieces (8 g)')).toBe(4);
    expect(piecesIn('3 mints')).toBe(3);
    expect(piecesIn('4pc')).toBe(4);
    expect(piecesIn('1 cup (158 g)')).toBeNull();
    expect(piecesIn('30 g')).toBeNull();
    expect(piecesIn('2 tbsp (32 g)')).toBeNull();
  });

  it('counts pieces, a quarter of a serving each', () => {
    let day = bumpTally([], mints, 1, at(10));
    day = bumpTally(day, mints, 2, at(11));
    const t = tallyEntry(day, mints.id)!;
    expect(t.qty).toBe(3);
    expect(t.serving).toBe('1 piece');
    expect(sumTotals(day).kcal).toBe(15);
    expect(amountText(t)).toBe('3 pieces');
  });

  it('lets the food say how many pieces, or 1 to count servings', () => {
    expect(tallyUnit({ ...mints, serving: '1 roll', pieces: 12 }).n.kcal).toBeCloseTo(20 / 12, 2);
    expect(tallyUnit({ ...mints, pieces: 1 }).serving).toBe('4 pieces (8 g)');
  });

  it('switches a count made by the serving over to pieces', () => {
    const old = bumpTally([], { ...mints, pieces: 1 }, 2, at(9)); // 2 servings = 8 pieces
    expect(tallyCount(old[0], mints)).toBe(8);
    const day = bumpTally(old, mints, 1, at(10));
    expect(tallyEntry(day, mints.id)).toMatchObject({ qty: 9, serving: '1 piece' });
    expect(sumTotals(day).kcal).toBe(45);
  });

  it('keeps pieces through a save and load', () => {
    const st = defaultState();
    st.foods = [{ ...mints, pieces: 4 }];
    expect(normalize(JSON.parse(JSON.stringify(st))).foods[0].pieces).toBe(4);
  });
});
