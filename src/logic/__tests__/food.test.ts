import { describe, expect, it } from '@jest/globals';

import {
  DEFAULT_DIET,
  STARTER_FOODS,
  calorieSummary,
  cinFor,
  defaultState,
  entryFromFood,
  entryTotals,
  evaluateDay,
  fastHeadline,
  fastState,
  fmtClock,
  foodError,
  inWindow,
  macroKcal,
  isAdjusted,
  minsSinceLastMeal,
  normalize,
  parseClock,
  previewEntry,
  quickEntry,
  recentFoodIds,
  searchFoods,
  submitError,
  sumTotals,
  planFor,
  withStyle,
  type DietSettings,
  type Food,
  type FoodEntry,
} from '..';

const food = (id: string): Food => {
  const f = STARTER_FOODS.find((x) => x.id === id);
  if (!f) throw new Error(id);
  return f;
};
const at = (h: number, m = 0) => h * 60 + m;
const eat = (id: string, time: number, qty = 1, eid = `${id}@${time}`): FoodEntry => entryFromFood(food(id), qty, time, eid);

const fast168: DietSettings = { ...DEFAULT_DIET, fasting: { eatHours: 8, start: at(12) } };
const keto = withStyle(DEFAULT_DIET, 'keto');

describe('nutrition', () => {
  it('scales by servings and computes net carbs', () => {
    const t = entryTotals({ n: food('oats').n, qty: 2 });
    expect(t.kcal).toBe(300);
    expect(t.carbs).toBe(54);
    expect(t.netCarbs).toBe(46);
  });

  it('sums a day', () => {
    const t = sumTotals([eat('egg', at(8), 3), eat('banana', at(8))]);
    expect(t.kcal).toBe(72 * 3 + 105);
    expect(t.protein).toBeCloseTo(6.3 * 3 + 1.3);
  });

  it('starter foods are self-consistent', () => {
    const ids = new Set<string>();
    STARTER_FOODS.forEach((f) => {
      expect(ids.has(f.id)).toBe(false);
      ids.add(f.id);
      expect(foodError(f)).toBeNull();
      // Label calories within 15% (or 15 kcal) of 4/4/9. Alcohol has its own ~7 kcal/g, so skip it.
      if (f.tags.includes('alcohol')) return;
      const est = f.n.protein * 4 + f.n.carbs * 4 + f.n.fat * 9;
      expect(Math.abs(est - f.n.kcal)).toBeLessThanOrEqual(Math.max(15, f.n.kcal * 0.15));
    });
  });

  it('macro calories leave out fiber (protein bar label adds up)', () => {
    expect(macroKcal({ kcal: 190, protein: 21, carbs: 22, fat: 8, fiber: 14 })).toBe(188);
  });

  it('validates a new food', () => {
    expect(foodError({ name: '', serving: '1', n: { kcal: 1, protein: 0, carbs: 0, fat: 0 } })).toMatch(/name/);
    expect(foodError({ name: 'x', serving: '1', n: { kcal: 1, protein: 0, carbs: 2, fat: 0, fiber: 3 } })).toMatch(/Fiber/);
    expect(foodError({ name: 'x', serving: '1', n: { kcal: -1, protein: 0, carbs: 0, fat: 0 } })).toMatch(/negative/);
  });
});

describe('clock', () => {
  it('parses typed times', () => {
    expect(parseClock('7')).toBe(at(7));
    expect(parseClock('7pm')).toBe(at(19));
    expect(parseClock('7:30 PM')).toBe(at(19, 30));
    expect(parseClock('7.30p')).toBe(at(19, 30));
    expect(parseClock('730pm')).toBe(at(19, 30));
    expect(parseClock('19:30')).toBe(at(19, 30));
    expect(parseClock('1930')).toBe(at(19, 30));
    expect(parseClock('12am')).toBe(0);
    expect(parseClock('12pm')).toBe(at(12));
    expect(parseClock('25')).toBeNull();
    expect(parseClock('13pm')).toBeNull();
    expect(parseClock('7:75')).toBeNull();
    expect(parseClock('soon')).toBeNull();
  });

  it('formats 12-hour times', () => {
    expect(fmtClock(0)).toBe('12:00 AM');
    expect(fmtClock(at(12))).toBe('12:00 PM');
    expect(fmtClock(at(20, 5))).toBe('8:05 PM');
    expect(fmtClock(at(25))).toBe('1:00 AM');
  });
});

describe('search', () => {
  const custom: Food = { id: 'c1', name: 'Protein bar', brand: 'Quest', serving: '1 bar', n: { kcal: 190, protein: 21, carbs: 22, fat: 8, fiber: 14 }, tags: ['dairy'], custom: true };
  const all = [...STARTER_FOODS, custom];

  it('matches every word, name prefix first', () => {
    expect(searchFoods(all, 'rice').slice(0, 2).map((f) => f.id).sort()).toEqual(['brownrice', 'rice']);
    expect(searchFoods(all, 'ba')[0].id).toBe('bacon'); // name prefix beats a later word
    expect(searchFoods(all, 'brown rice').map((f) => f.id)).toEqual(['brownrice']);
  });

  it('searches brand and ignores case', () => {
    expect(searchFoods(all, 'QUEST')[0].id).toBe('c1');
  });

  it('puts recent foods first on an empty query', () => {
    expect(searchFoods(all, '', ['tuna', 'egg']).slice(0, 2).map((f) => f.id)).toEqual(['tuna', 'egg']);
  });

  it('lists recent food ids, newest first', () => {
    const meals = { '2026-10-13': [eat('egg', at(8))], '2026-10-14': [eat('tuna', at(12)), eat('apple', at(15))] };
    expect(recentFoodIds(meals)).toEqual(['apple', 'tuna', 'egg']);
  });
});

describe('fasting', () => {
  it('knows when the window is open (16:8 from noon)', () => {
    const f = fast168.fasting!;
    expect(inWindow(f, at(11, 59))).toBe(false);
    expect(inWindow(f, at(12))).toBe(true);
    expect(inWindow(f, at(19, 59))).toBe(true);
    expect(inWindow(f, at(20))).toBe(false);
  });

  it('handles a window that crosses midnight', () => {
    const f = { eatHours: 6, start: at(21) }; // 9 PM – 3 AM
    expect(inWindow(f, at(23))).toBe(true);
    expect(inWindow(f, at(2, 59))).toBe(true);
    expect(inWindow(f, at(3))).toBe(false);
    expect(fastState(f, at(1))).toEqual({ open: true, changeAt: at(3), minsUntil: 120 });
  });

  it('says whether you can eat now', () => {
    const f = fast168.fasting!;
    expect(fastState(f, at(9, 30))).toEqual({ open: false, changeAt: at(12), minsUntil: 150 });
    expect(fastState(f, at(18))).toEqual({ open: true, changeAt: at(20), minsUntil: 120 });
    expect(fastState(f, at(21))).toEqual({ open: false, changeAt: at(12), minsUntil: 900 });
    expect(fastHeadline(f, at(9, 30)).title).toMatch(/Fasting/);
    expect(fastHeadline(f, at(9, 30)).detail).toBe('Eating window opens at 12:00 PM (in 2h 30m)');
    expect(fastHeadline(f, at(13)).title).toBe('You can eat now');
  });

  it('flags food outside the window, but not black coffee', () => {
    const r = evaluateDay(fast168, [eat('coffee', at(7)), eat('egg', at(9)), eat('chicken', at(13))], false);
    expect(r.verdict).toBe('off');
    expect(Object.keys(r.flags)).toEqual(['egg@540']);
    expect(evaluateDay(fast168, [eat('coffee', at(7)), eat('chicken', at(13))], false).verdict).toBe('on');
  });

  it('counts hours since the last meal across midnight', () => {
    expect(minsSinceLastMeal([], [eat('chicken', at(19, 30))], at(9))).toBe(13 * 60 + 30);
    expect(minsSinceLastMeal([eat('coffee', at(7))], [eat('chicken', at(19))], at(9))).toBe(14 * 60);
    expect(minsSinceLastMeal([eat('egg', at(12))], [], at(13))).toBe(60);
    expect(minsSinceLastMeal([], [], at(9))).toBeNull();
  });

  it('previews eating during a fast', () => {
    const p = previewEntry(fast168, [], eat('egg', at(9)), at(9))!;
    expect(p.tone).toBe('bad');
    expect(p.lines[0]).toMatch(/fasting right now.*12:00 PM/);
    expect(previewEntry(fast168, [], eat('egg', at(13)), at(9))!.tone).toBe('ok');
    expect(previewEntry(fast168, [], eat('coffee', at(9)), at(9))!.tone).toBe('ok');
  });
});

describe('food styles', () => {
  it('keto: net carb limit with close and over', () => {
    expect(keto.limits).toEqual({ netCarbsMax: 20 });
    const ok = evaluateDay(keto, [eat('egg', at(8), 3), eat('avocado', at(12))], false);
    expect(ok.verdict).toBe('on');
    const close = evaluateDay(keto, [eat('greekyog', at(8), 3)], false); // 18.3 g
    expect(close.verdict).toBe('close');
    const over = evaluateDay(keto, [eat('egg', at(8)), eat('banana', at(9)), eat('apple', at(10))], false);
    expect(over.verdict).toBe('off');
    // The banana (23.9 g) crosses the limit; the apple after it is also over.
    expect(Object.keys(over.flags).sort()).toEqual(['apple@600', 'banana@540']);
    expect(over.checks.find((c) => c.key === 'netCarbsMax')!.note).toMatch(/over/);
  });

  it('keto: previews a food that would go over', () => {
    const p = previewEntry(keto, [eat('greekyog', at(8))], eat('banana', at(12)), at(12))!;
    expect(p.tone).toBe('bad');
    expect(p.lines[0]).toMatch(/Puts you over your net carbs limit/);
    const fine = previewEntry(keto, [], eat('egg', at(8)), at(8))!;
    expect(fine.tone).toBe('ok');
    expect(fine.lines).toContain('19.6 g net carbs left after this.');
  });

  it('vegan: flags animal foods', () => {
    const v = withStyle(DEFAULT_DIET, 'vegan');
    const r = evaluateDay(v, [eat('tofu', at(12)), eat('cheddar', at(13))], false);
    expect(r.verdict).toBe('off');
    expect(r.flags['cheddar@780']).toEqual(['Has dairy']);
    expect(previewEntry(v, [], eat('egg', at(8)), null)!.lines[0]).toMatch(/Has eggs/);
    expect(evaluateDay(v, [eat('tofu', at(12)), eat('broccoli', at(12))], false).verdict).toBe('on');
  });

  it('paleo rules out grains, beans and dairy', () => {
    const p = withStyle(DEFAULT_DIET, 'paleo');
    expect(evaluateDay(p, [eat('pb', at(10))], false).verdict).toBe('off');
    expect(evaluateDay(p, [eat('salmon', at(10)), eat('sweetpotato', at(10))], false).verdict).toBe('on');
  });

  it('high protein: a minimum is pending today, missed once the day is over', () => {
    const hp = withStyle(DEFAULT_DIET, 'highprotein');
    const entries = [eat('chicken', at(12), 2)]; // 69.2 g
    expect(evaluateDay(hp, entries, false).verdict).toBe('on');
    expect(evaluateDay(hp, entries, false).checks[0].note).toBe('80.8 g to go');
    expect(evaluateDay(hp, entries, true).verdict).toBe('off');
    expect(evaluateDay(hp, [eat('chicken', at(12), 5)], true).verdict).toBe('on');
  });

  it('low fat: share of calories from fat', () => {
    const lf = withStyle(DEFAULT_DIET, 'lowfat');
    expect(evaluateDay(lf, [eat('rice', at(12)), eat('chicken', at(12))], false).verdict).toBe('on');
    expect(evaluateDay(lf, [eat('almonds', at(12))], false).verdict).toBe('off');
  });

  it('combines fasting, a style and a calorie limit', () => {
    const d: DietSettings = { ...withStyle(fast168, 'keto'), limits: { netCarbsMax: 20, kcalMax: 1800 } };
    expect(evaluateDay(d, [eat('chicken', at(13), 2), eat('broccoli', at(18))], false).verdict).toBe('on');
    const r = evaluateDay(d, [eat('chicken', at(13), 10)], false);
    expect(r.verdict).toBe('off');
    expect(r.checks.find((c) => c.key === 'kcalMax')!.tone).toBe('bad');
  });

  it('switching style keeps the calorie limit and loads the preset', () => {
    const d = withStyle({ ...DEFAULT_DIET, limits: { kcalMax: 2000, netCarbsMax: 30 } }, 'vegan');
    expect(d.limits).toEqual({ kcalMax: 2000 });
    expect(d.exclude).toEqual(['meat', 'fish', 'dairy', 'egg']);
    expect(isAdjusted(d)).toBe(false);
    expect(isAdjusted({ ...keto, limits: { netCarbsMax: 30 } })).toBe(true);
  });

  it('no rules means nothing to judge', () => {
    expect(evaluateDay(DEFAULT_DIET, [eat('cola', at(12))], false).verdict).toBe('none');
    expect(previewEntry(DEFAULT_DIET, [], eat('cola', at(12)), null)).toBeNull();
  });
});

describe('food log and calories in', () => {
  const S = '2026-10-14';

  it('calories in = typed on the day + food log', () => {
    const st = defaultState();
    st.logs[S] = { submitted: true, cout: 2800 };
    expect(cinFor(st, S)).toBeNull();
    st.logs[S].cin = 500;
    expect(cinFor(st, S)).toBe(500);
    st.meals[S] = [eat('chicken', at(12), 2), quickEntry('Lunch out', { kcal: 900, protein: 0, carbs: 0, fat: 0 }, at(13), 'q')];
    expect(cinFor(st, S)).toBe(500 + 370 + 900);
    delete st.logs[S].cin;
    expect(cinFor(st, S)).toBe(1270);
    expect(calorieSummary(st).total).toBe(2800 - 1270);
  });

  it('food log off: only the typed number counts, logged food is kept', () => {
    const st = defaultState();
    st.logs[S] = { submitted: true, cin: 2000, cout: 2800 };
    st.meals[S] = [eat('chicken', at(12), 2)];
    st.foodLog = false;
    expect(cinFor(st, S)).toBe(2000);
    expect(st.meals[S]).toHaveLength(1);
    // A day with only food logged has no calories in while the food log is off.
    delete st.logs[S].cin;
    expect(cinFor(st, S)).toBeNull();
    expect(normalize(JSON.parse(JSON.stringify(st))).foodLog).toBe(false);
    expect(normalize({}).foodLog).toBe(true);
  });

  it('typed calories count toward the diet calorie limit', () => {
    const d: DietSettings = { ...DEFAULT_DIET, limits: { kcalMax: 1000 } };
    const entries = [eat('chicken', at(12), 2)]; // 370
    expect(evaluateDay(d, entries, false).verdict).toBe('on');
    expect(evaluateDay(d, entries, false, 700).verdict).toBe('off');
    expect(evaluateDay(d, [], false, 1200).checks[0].tone).toBe('bad');
    expect(previewEntry(d, [], eat('chicken', at(12), 2), null, 700)!.tone).toBe('bad');
  });

  it('food logged counts as calories when submitting a rest day', () => {
    const st = defaultState();
    const rest = planFor(st.start, '2026-10-10')!;
    expect(submitError(rest, {})).toMatch(/calories/);
    expect(submitError(rest, {}, true)).toBeNull();
  });

  it('saves and restores foods, the log and the diet', () => {
    const st = defaultState();
    st.foods = [{ id: 'c1', name: 'Bar', serving: '1 bar', n: { kcal: 200, protein: 20, carbs: 20, fat: 7 }, tags: ['dairy'], custom: true }];
    st.meals[S] = [eat('egg', at(8), 2)];
    st.diet = withStyle(fast168, 'keto');
    const back = normalize(JSON.parse(JSON.stringify(st)));
    expect(back.foods).toEqual(st.foods);
    expect(back.meals).toEqual(st.meals);
    expect(back.diet).toEqual(st.diet);
  });

  it('old saved data without food loads with empty food fields', () => {
    const back = normalize({ start: '2026-10-05', logs: {} });
    expect(back.foods).toEqual([]);
    expect(back.meals).toEqual({});
    expect(back.diet).toEqual(DEFAULT_DIET);
  });

  it('drops malformed entries', () => {
    const back = normalize({ meals: { [S]: [{ id: 'x', n: { kcal: 'a' }, qty: 1, at: 10 }, { id: 'y', n: { kcal: 50 }, qty: 1, at: 2000 }] }, diet: { style: 'nope', fasting: { eatHours: 30, start: 0 } } });
    expect(back.meals).toEqual({});
    expect(back.diet.style).toBe('none');
    expect(back.diet.fasting).toBeNull();
  });
});
