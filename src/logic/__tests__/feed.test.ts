import { describe, expect, it } from '@jest/globals';

import { defaultState, feedDay, feedItems, shortDayLabel } from '..';

const today = '2026-10-15';

function state() {
  const s = defaultState();
  const ex = (w: number, reps: number) => ({ exId: 'bench', name: 'Bench press', unit: 'lb' as const, repMin: 5, repMax: 8, inc: 5, sets: [{ w, reps, done: true }] });
  s.lifting.workouts = [
    { id: 'w1', date: '2026-10-10', name: 'Push', done: true, exercises: [ex(135, 5)] },
    { id: 'w2', date: '2026-10-14', name: 'Push', done: true, exercises: [ex(145, 5)], start: 1000, end: 1000 + 3600_000 },
    { id: 'w3', date: '2026-10-15', name: 'Pull', done: false, exercises: [] },
  ];
  s.cardio.sessions = [
    { id: 'c1', date: '2026-10-12', type: 'run', miles: 3, secs: 1500 },
    { id: 'c2', date: '2026-10-20', type: 'run', miles: 3, secs: 1500 },
  ];
  return s;
}

describe('feed', () => {
  it('lists finished activities, newest first, without future or unfinished ones', () => {
    expect(feedItems(state(), today).map((i) => i.id)).toEqual(['w2', 'c1', 'w1']);
  });

  it('marks a lift personal record and shows stats', () => {
    const w2 = feedItems(state(), today).find((i) => i.id === 'w2')!;
    expect(w2.prs).toEqual(['Bench press']);
    expect(w2.stats).toEqual([
      { label: 'Exercises', value: '1' },
      { label: 'Sets', value: '1' },
      { label: 'Volume', value: '725 lb' },
      { label: 'Time', value: '1h' },
    ]);
    expect(feedItems(state(), today).find((i) => i.id === 'w1')!.prs).toEqual([]);
  });

  it('filters, and leaves out sections that are off', () => {
    expect(feedItems(state(), today, 'cardio').map((i) => i.id)).toEqual(['c1']);
    const s = state();
    s.settings.sections = { food: true, cardio: false, lifting: true };
    expect(feedItems(s, today).every((i) => i.kind === 'lift')).toBe(true);
  });

  it('names the day', () => {
    expect(feedDay(today, today, shortDayLabel)).toBe('Today');
    expect(feedDay('2026-10-14', today, shortDayLabel)).toBe('Yesterday');
  });
});
