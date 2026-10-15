import { describe, expect, it } from '@jest/globals';

import { dayLog, defaultState, type TrackerState } from '..';

const today = '2026-10-15'; // Thursday

function state(): TrackerState {
  const s = defaultState();
  s.lifting.routines = [{ id: 'r1', name: 'Push', items: [] }];
  // Push on Mondays and Thursdays.
  s.lifting.schedule = ['r1', null, null, 'r1', null, null, null];
  s.lifting.workouts = [
    { id: 'w1', date: '2026-10-05', name: 'Push', done: true, exercises: [] },
    { id: 'w2', date: '2026-10-12', name: 'Push', done: true, exercises: [] },
  ];
  s.cardio.sessions = [{ id: 'c1', date: '2026-10-13', type: 'run', miles: 5.02, secs: 2700 }];
  s.days['2026-10-13'] = { cout: 2600 };
  s.meals['2026-10-13'] = [{ id: 'e1', name: 'Oats', serving: '1', qty: 1, n: { kcal: 2200, protein: 120, carbs: 250, fat: 60 }, tags: [], at: 480 }];
  return s;
}

describe('day log', () => {
  it('marks lifting done, missed and planned', () => {
    const s = state();
    expect(dayLog(s, '2026-10-12', today).lift).toMatchObject({ mark: 'done', label: 'Push' });
    // Thursday Oct 8: scheduled, nothing logged.
    expect(dayLog(s, '2026-10-08', today).lift).toMatchObject({ mark: 'missed', label: 'Push' });
    expect(dayLog(s, '2026-10-19', today).lift).toMatchObject({ mark: 'planned', label: 'Push' });
    expect(dayLog(s, '2026-10-14', today).lift).toMatchObject({ mark: null, label: null });
  });

  it('shows cardio done with its distance, and the deficit', () => {
    const d = dayLog(state(), '2026-10-13', today);
    expect(d.cardio).toMatchObject({ mark: 'done', label: 'Run 5' });
    expect(d.food?.totals.kcal).toBe(2200);
    expect(d.net).toBe(400);
  });

  it('leaves days before lifting started unmarked, and empty days empty', () => {
    const d = dayLog(state(), '2026-09-01', today);
    expect(d.cardio).toMatchObject({ mark: null, label: null });
    expect(d.lift?.mark).toBeNull();
    expect(d.net).toBeNull();
  });

  it('drops sections that are switched off', () => {
    const s = state();
    s.settings.sections = { food: false, cardio: true, lifting: false };
    const d = dayLog(s, '2026-10-13', today);
    expect(d.lift).toBeNull();
    expect(d.food).toBeNull();
  });
});
