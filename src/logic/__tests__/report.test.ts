import { describe, expect, it } from '@jest/globals';

import { buildReport, defaultState, lastFinished, reportEmpty, reportSpan, type TrackerState } from '..';
import { reportPdf } from '../reportPdf';

const today = '2026-10-15'; // Thursday

function state(): TrackerState {
  const s = defaultState();
  s.settings.name = 'Sam';
  s.lifting.workouts = [
    {
      id: 'w1', date: '2026-10-13', name: 'Push', done: true, start: 1, end: 1 + 45 * 60000,
      exercises: [{ exId: 'bench', name: 'Bench press', unit: 'lb', repMin: 5, repMax: 8, inc: 5, sets: [{ w: 135, reps: 8, done: true }, { w: 135, reps: 6, done: true }, { w: 135, reps: 5, done: false }] }],
    },
    { id: 'w2', date: '2026-09-30', name: 'Pull', done: true, exercises: [] },
  ];
  s.cardio.sessions = [
    { id: 'c1', date: '2026-10-14', type: 'run', miles: 5, secs: 2700 },
    { id: 'c2', date: '2026-10-12', type: 'swim', miles: 0.5, secs: 1200 },
  ];
  s.days['2026-10-13'] = { cout: 2600, weightLb: 180, note: 'Felt strong' };
  s.days['2026-10-14'] = { weightLb: 179 };
  s.meals['2026-10-13'] = [{ id: 'e1', name: 'Oats', serving: '1', qty: 1, n: { kcal: 2200, protein: 120, carbs: 250, fat: 60 }, tags: [], at: 480 }];
  return s;
}

describe('report spans', () => {
  it('finds the day, week, month and year', () => {
    expect(reportSpan('week', today)).toMatchObject({ from: '2026-10-12', to: '2026-10-18' });
    expect(reportSpan('month', today)).toMatchObject({ from: '2026-10-01', to: '2026-10-31', title: 'October 2026' });
    expect(reportSpan('year', today)).toMatchObject({ from: '2026-01-01', to: '2026-12-31' });
    expect(lastFinished('week', today)).toMatchObject({ from: '2026-10-05', to: '2026-10-11' });
    expect(lastFinished('day', today)).toMatchObject({ from: '2026-10-14' });
    expect(lastFinished('month', today)).toMatchObject({ from: '2026-09-01', to: '2026-09-30' });
  });
});

describe('report', () => {
  it('sums a week across calories, cardio, lifting and body', () => {
    const r = buildReport(state(), reportSpan('week', today), today);
    expect(r.cardio).toMatchObject({ count: 2, miles: 5 });
    expect(r.cardio?.bars.map((b) => b.v)).toEqual([null, null, 5, null, null, null, null]);
    expect(r.lifting).toMatchObject({ workouts: 1, sets: 2, volume: 135 * 14, minutes: 45 });
    expect(r.calories).toMatchObject({ daysLogged: 1, totalNet: 400 });
    expect(r.body).toMatchObject({ weightFrom: 180, weightTo: 179 });
    expect(r.notes).toEqual([{ date: '2026-10-13', text: 'Felt strong' }]);
    expect(reportEmpty(r)).toBe(false);
  });

  it('lists a day’s meals and leaves out switched-off sections', () => {
    const s = state();
    s.settings.sections = { food: true, cardio: false, lifting: false };
    const r = buildReport(s, reportSpan('day', '2026-10-13'), today);
    expect(r.cardio).toBeNull();
    expect(r.lifting).toBeNull();
    expect(r.calories?.meals).toEqual([{ label: 'Breakfast', items: [{ name: 'Oats', kcal: 2200 }] }]);
  });

  it('is empty when nothing was logged', () => {
    expect(reportEmpty(buildReport(defaultState(), reportSpan('week', today), today))).toBe(true);
  });

  it('makes a PDF', async () => {
    for (const p of ['day', 'week', 'month', 'year'] as const) {
      const bytes = await reportPdf(buildReport(state(), reportSpan(p, '2026-10-13'), today), 'Oct 15, 2026');
      expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe('%PDF-');
    }
  });
});

