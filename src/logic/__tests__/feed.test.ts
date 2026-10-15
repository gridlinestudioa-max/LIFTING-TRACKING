import { describe, expect, it } from '@jest/globals';

import { cardioMedals, defaultState, feedDay, feedItems, liftBoards, liftMedals, shortDayLabel } from '..';

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

  it('gives medals for places on your record lists, and shows stats', () => {
    const w2 = feedItems(state(), today).find((i) => i.id === 'w2')!;
    expect(w2.medals).toEqual([{ rank: 1, label: 'Bench press' }]);
    expect(w2.stats).toEqual([
      { label: 'Exercises', value: '1' },
      { label: 'Sets', value: '1' },
      { label: 'Volume', value: '725 lb' },
      { label: 'Time', value: '1h' },
    ]);
    // Last of two isn't 2nd place.
    expect(feedItems(state(), today).find((i) => i.id === 'w1')!.medals).toEqual([]);
  });

  it('filters, and leaves out sections that are off', () => {
    expect(feedItems(state(), today, 'cardio').map((i) => i.id)).toEqual(['c1']);
    const s = state();
    s.settings.sections = { food: true, cardio: false, lifting: true };
    expect(feedItems(s, today).every((i) => i.kind === 'lift')).toBe(true);
  });

  it('ranks runs 1st, 2nd and 3rd, but only with something below', () => {
    const s = state();
    s.cardio.sessions = [
      { id: 'a', date: '2026-10-01', type: 'run', miles: 3, secs: 1500 },
      { id: 'b', date: '2026-10-02', type: 'run', miles: 5, secs: 2600 },
      { id: 'c', date: '2026-10-03', type: 'run', miles: 4, secs: 2000 },
      { id: 'd', date: '2026-10-04', type: 'run', miles: 2, secs: 1000 },
    ];
    const m = cardioMedals(s.cardio, today);
    expect(m.get('b')).toContainEqual({ rank: 1, label: 'Longest run' });
    expect(m.get('c')).toContainEqual({ rank: 2, label: 'Longest run' });
    expect(m.get('a')).toContainEqual({ rank: 3, label: 'Longest run' });
    expect((m.get('d') ?? []).some((x) => x.label === 'Longest run')).toBe(false);
    // Medals come best first.
    expect(m.get('a')!.map((x) => x.rank)).toEqual([...m.get('a')!.map((x) => x.rank)].sort());
  });

  it('builds lift record lists, best first', () => {
    const b = liftBoards(state().lifting, today);
    expect(b).toHaveLength(1);
    expect(b[0].top.map((e) => e.workoutId)).toEqual(['w2', 'w1']);
    expect(liftMedals(state().lifting, today).get('w2')).toEqual([{ rank: 1, label: 'Bench press' }]);
  });

  it('names the day', () => {
    expect(feedDay(today, today, shortDayLabel)).toBe('Today');
    expect(feedDay('2026-10-14', today, shortDayLabel)).toBe('Yesterday');
  });
});
