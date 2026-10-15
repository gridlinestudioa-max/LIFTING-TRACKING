import { describe, expect, it } from '@jest/globals';

import {
  avgBars,
  cardioBars,
  cardioRecordHistory,
  defaultState,
  e1rmBars,
  foodDays,
  liftBars,
  liftRecordHistory,
  macroTargets,
  microDay,
  muscleBars,
  muscleGroupOf,
  normalize,
  parseUsda,
  spanAt,
  type CardioSession,
  type Workout,
} from '..';

const today = '2026-10-15';

describe('bar sizes', () => {
  it('uses the bar size asked for in each range', () => {
    const plan = { week: 'day', month: 'week', year: 'week', all: 'month' } as const;
    expect(spanAt('week', today, null, plan).buckets).toHaveLength(7);
    const m = spanAt('month', today, null, plan);
    expect(m.grain).toBe('week');
    expect(m.buckets.length).toBeGreaterThanOrEqual(5);
    expect(spanAt('year', today, null, plan).buckets.length).toBeGreaterThanOrEqual(48);
  });
});

describe('cardio bars', () => {
  const runs: CardioSession[] = [
    { id: 'a', date: '2026-10-13', type: 'run', miles: 3, secs: 1800, hr: 150 },
    { id: 'b', date: '2026-10-13', type: 'run', miles: 6, secs: 3240, hr: 140 },
    { id: 'c', date: '2026-10-14', type: 'run', miles: 4 },
  ];
  it('weights pace by distance and heart rate by time', () => {
    const b = cardioBars(runs, spanAt('week', today, null, { week: 'day', month: 'day', year: 'day', all: 'day' }).buckets);
    // Oct 13 is the 5th of the last 7 days (Oct 9 to 15).
    expect(b.miles[4]).toBe(9);
    expect(b.count[4]).toBe(2);
    expect(b.pace[4]).toBeCloseTo((1800 + 3240) / 9);
    expect(b.hr[4]).toBe(Math.round((150 * 1800 + 140 * 3240) / 5040));
    expect(b.avgMiles[4]).toBe(4.5);
    expect(b.pace[5]).toBeNull();
    expect(b.minutes[4]).toBe(84);
  });
  it('tracks records as they improve', () => {
    const h = cardioRecordHistory(runs, 1);
    expect(h.longest.map((p) => p.v)).toEqual([6]);
    expect(h.fastest).toHaveLength(1);
  });
});

describe('lifting bars', () => {
  const ex = (exId: string, sets: [number, number][]) => ({ exId, name: exId, unit: 'lb' as const, repMin: 5, repMax: 8, inc: 5, sets: sets.map(([w, reps]) => ({ w, reps, done: true })) });
  const ws: Workout[] = [
    { id: '1', date: '2026-10-12', name: 'A', done: true, start: 0, end: 0, exercises: [ex('bench', [[135, 8], [135, 8]]), ex('row', [[100, 10]])] },
    { id: '2', date: '2026-10-14', name: 'A', done: true, start: 1, end: 1 + 50 * 60000, exercises: [ex('bench', [[155, 8], [185, 1]])] },
  ];
  const buckets = spanAt('week', today, null, { week: 'day', month: 'day', year: 'day', all: 'day' }).buckets;
  it('counts workouts, reps per set and timed minutes', () => {
    const b = liftBars(ws, buckets);
    expect(b.workouts.filter(Boolean)).toEqual([1, 1]);
    expect(b.reps[3]).toBe(Math.round((26 / 3) * 10) / 10);
    expect(b.minutes[3]).toBeNull();
    expect(b.minutes[5]).toBe(50);
    expect(liftBars(ws, buckets, 'row').reps[3]).toBe(10);
  });
  it('estimates one-rep max with Epley, ignoring sets over 12 reps', () => {
    expect(e1rmBars(ws, buckets, 'bench')[3]).toBe(Math.round(135 * (1 + 8 / 30)));
    expect(e1rmBars(ws, buckets, 'bench')[5]).toBe(Math.round(155 * (1 + 8 / 30)));
  });
  it('keeps estimated and actual one-rep records apart', () => {
    const s = defaultState();
    s.lifting.workouts = ws;
    const h = liftRecordHistory(s.lifting, 'bench');
    expect(h.estimated.map((p) => p.s)).toEqual(['2026-10-12', '2026-10-14']);
    expect(h.actual).toEqual([{ s: '2026-10-14', v: 185, text: '185 × 1' }]);
  });
  it('counts each set once, toward the main muscle group', () => {
    expect(muscleGroupOf({ primary: ['chest'] })).toBe('chest');
    expect(muscleGroupOf({ primary: ['lats'] })).toBe('back');
    const m = muscleBars(ws, buckets, (id) => (id === 'bench' ? 'chest' : 'back'));
    expect(m.chest[3]).toBe(2);
    expect(m.back[3]).toBe(1);
    expect(m.chest[5]).toBe(2);
  });
});

describe('food bars', () => {
  it('averages over logged days only, and knows what nutrients were listed', () => {
    const s = defaultState();
    const e = (kcal: number, extra = {}) => ({ id: String(kcal), name: 'x', serving: '1', qty: 1, n: { kcal, protein: 10, carbs: 20, fat: 5, ...extra }, tags: [], at: 480 });
    s.meals['2026-10-13'] = [e(2000, { sodium: 1500 }), e(500)];
    s.meals['2026-10-14'] = [e(1500)];
    const days = foodDays(s.meals, today);
    const b = avgBars(days, spanAt('week', today, null, { week: 'week', month: 'week', year: 'week', all: 'week' }).buckets, (d) => d.t.kcal);
    // Oct 13 (2,500) and Oct 14 (1,500) share a week: 2,000 a logged day.
    expect(b.filter((v) => v != null)).toEqual([2000]);
    expect(microDay(s.meals['2026-10-13'], 'sodium')).toEqual({ sum: 1500, covered: 0.8 });
    expect(microDay(s.meals['2026-10-14'], 'sodium')).toBeNull();
    // Saved and loaded, sodium stays.
    expect(normalize(JSON.parse(JSON.stringify(s))).meals['2026-10-13'][0].n.sodium).toBe(1500);
  });
  it('works out macro targets from calories', () => {
    expect(macroTargets(2000, 150, null, null)).toEqual({ protein: 150, fat: 67, carbs: 199 });
    expect(macroTargets(null, 120, null, null)).toEqual({ protein: 120, carbs: null, fat: null });
  });
  it('reads vitamins and minerals from the USDA file', () => {
    const foods = parseUsda({ v: 2, tags: [], micros: ['sodium', 'addedSugar', 'vitC'], foods: [['u1', 'Orange', 1, 47, 0.9, 12, 0.1, 2.4, 9, 0, [['1 fruit', 100]], [0, null, 53.2]]] });
    expect(foods[0].n).toMatchObject({ sodium: 0, vitC: 53.2 });
    expect(foods[0].n.addedSugar).toBeUndefined();
  });
});

describe('hidden graphs setting', () => {
  it('keeps valid graph ids only, once each', () => {
    const s = normalize({ v: 2, settings: { hiddenGraphs: ['food:micros', 'food:micros', 'cardio:hr', 'bad id', 7, 'x'.repeat(40) + ':y'] } });
    expect(s.settings.hiddenGraphs).toEqual(['food:micros', 'cardio:hr']);
    expect(normalize({}).settings.hiddenGraphs).toEqual([]);
  });
});
