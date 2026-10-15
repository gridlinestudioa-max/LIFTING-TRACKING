import { describe, expect, it } from '@jest/globals';

import { avgByBucket, defaultState, niceTicks, normalize, rangeSpan, readSummary, shareSummary, sumByBucket, type TrackerState } from '..';

describe('chart ranges', () => {
  const today = '2026-10-15'; // a Thursday

  it('week: the last 7 days by day', () => {
    const r = rangeSpan('week', today);
    expect(r.buckets).toHaveLength(7);
    expect(r.from).toBe('2026-10-09');
    expect(r.buckets[6]).toMatchObject({ start: today, label: 'Thu' });
    expect(r.caption).toBe('Last 7 days');
  });

  it('month: the last 30 days by day', () => {
    const r = rangeSpan('month', today);
    expect(r.buckets).toHaveLength(30);
    expect(r.buckets[0].start).toBe('2026-09-16');
  });

  it('year: 12 months, the last one cut at today', () => {
    const r = rangeSpan('year', today);
    expect(r.buckets).toHaveLength(12);
    expect(r.buckets[0]).toMatchObject({ start: '2025-11-01', label: 'Nov ’25' });
    expect(r.buckets[11]).toMatchObject({ start: '2026-10-01', end: today });
  });

  it('all: days, weeks or months depending on how far back', () => {
    expect(rangeSpan('all', today, '2026-10-01').grain).toBe('day');
    const w = rangeSpan('all', today, '2026-07-01');
    expect(w.grain).toBe('week');
    expect(w.buckets[0].start).toBe('2026-07-01');
    expect(w.caption).toBe('Since Jul 1, 2026');
    expect(rangeSpan('all', today, '2024-02-10').grain).toBe('month');
    expect(rangeSpan('all', today, null).caption).toBe('Last 12 months');
  });

  it('adds up and averages into buckets', () => {
    const b = rangeSpan('week', today).buckets;
    const items = [{ d: '2026-10-15', v: 3 }, { d: '2026-10-15', v: 2 }, { d: '2026-10-10', v: 4 }, { d: '2026-09-01', v: 99 }];
    expect(sumByBucket(items, (x) => x.d, (x) => x.v, b)).toEqual([0, 4, 0, 0, 0, 0, 5]);
    expect(avgByBucket(items, (x) => x.d, (x) => x.v, b)).toEqual([null, 4, null, null, null, null, 2.5]);
  });

  it('picks round axis ticks', () => {
    expect(niceTicks(0, 9)).toEqual([0, 5, 10]);
    expect(niceTicks(0, 1300)).toEqual([0, 500, 1000, 1500]);
    expect(niceTicks(-400, 600)).toEqual([-500, 0, 500, 1000]);
    expect(niceTicks(0, 0)).toEqual([0, 0.5, 1]);
  });
});

describe('sharing', () => {
  const today = '2026-10-15';
  const state = (): TrackerState => {
    const s = defaultState();
    s.cardio.sessions = [{ id: 'c1', date: '2026-10-14', type: 'run', miles: 4, secs: 2000 }];
    s.lifting.workouts = [
      { id: 'w1', date: '2026-10-13', name: 'Push', done: true, exercises: [{ exId: 'bench', name: 'Bench press', unit: 'lb', repMin: 5, repMax: 8, inc: 5, sets: [{ w: 185, reps: 5, done: true }] }] },
    ] as TrackerState['lifting']['workouts'];
    s.meals['2026-10-14'] = [{ id: 'e1', name: 'Oats', serving: '1 cup', qty: 1, n: { kcal: 300, protein: 10, carbs: 50, fat: 5 }, tags: [], at: 480 }];
    return s;
  };

  it('defaults to cardio only and survives a save and load', () => {
    const s = defaultState();
    expect(s.settings.share).toEqual({ cardio: true, lifting: false, food: false });
    const back = normalize(JSON.parse(JSON.stringify({ ...s, settings: { ...s.settings, share: { cardio: false, lifting: true, food: 'yes' } } })));
    expect(back.settings.share).toEqual({ cardio: false, lifting: true, food: false });
  });

  it('only includes what is shared', () => {
    const s = state();
    const cardioOnly = shareSummary(s, today, { cardio: true, lifting: false, food: false });
    expect(cardioOnly.run?.weekMi).toBe(4);
    expect(cardioOnly.lifting).toBeUndefined();
    expect(cardioOnly.food).toBeUndefined();

    const rest = shareSummary(s, today, { cardio: false, lifting: true, food: true });
    expect(rest.run).toBeUndefined();
    expect(rest.lifting).toMatchObject({ weekN: 1, monthN: 1, total: 1 });
    expect(rest.lifting!.top[0]).toMatchObject({ name: 'Bench press', unit: 'lb' });
    expect(rest.food).toMatchObject({ days: 1, kcal: 300, protein: 10 });
    // Nothing about single foods leaves the device.
    expect(JSON.stringify(rest)).not.toContain('Oats');
    expect(readSummary(JSON.parse(JSON.stringify(rest)))).not.toBeNull();
  });
});
