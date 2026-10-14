import { describe, expect, it } from '@jest/globals';

import { cinFor, nextTarget, normalize, runStatus, scheduledRoutine, type TrackerState } from '..';

// Saved by the first version: plan from Oct 5, a few weeks of runs, lifts, calories and a swap.
const V1 = {
  start: '2026-10-05',
  goal: 400,
  base: { tri: 35, bench: 50, skull: 35, peck: 100, ohp: 40, row: 110, bicable: 50, lat: 110, curl: 35, face: 85, lpress: 7, rdl: 65, lcurl: 120, lext: 130 },
  logs: {
    // Mon push: 3 of 5 lifts checked, calories.
    '2026-10-05': {
      submitted: true,
      lifts: { tri: { w: 35, done: true }, bench: { w: 50, done: true }, skull: { w: 35, done: false }, peck: { w: 105, done: true }, ohp: { w: 40, done: false } },
      cin: 2200,
      cout: 2700,
      note: 'felt good',
    },
    // Tue tempo, 3 mi in 27:30.
    '2026-10-06': { submitted: true, miles: 3, secs: 1650, cin: 2400, cout: 2900 },
    // Wed pull skipped, calories only.
    '2026-10-07': { submitted: true, skipped: true, cin: 2000 },
    // Fri easy run skipped.
    '2026-10-09': { submitted: true, skipped: true },
    // Sat rest day: did Friday's easy run here instead.
    '2026-10-10': { submitted: true, makeupFor: '2026-10-09', swap: 'easy', miles: 3.1 },
    // Sun long run, 7 mi.
    '2026-10-11': { submitted: true, miles: 7, secs: 4200 },
    // Mon: did legs instead of push.
    '2026-10-12': { submitted: true, swap: 'legs', lifts: { lpress: { w: 7, done: true }, rdl: { w: 65, done: true }, lcurl: { w: 120, done: true }, lext: { w: 130, done: true } } },
  },
  foods: [],
  meals: {},
  diet: { fasting: null, style: 'none', limits: {}, exclude: [] },
  foodLog: true,
  profile: null,
};

describe('bringing first-version data forward', () => {
  const st: TrackerState = normalize(JSON.parse(JSON.stringify(V1)));

  it('is the new format and asks the user to finish setup', () => {
    expect(st.v).toBe(2);
    expect(st.settings.onboarded).toBe(false);
    expect(st.settings.sections).toEqual({ food: true, cardio: true, lifting: true });
    expect(st.goal).toBe(400);
  });

  it('keeps calories and notes', () => {
    expect(st.days['2026-10-05']).toEqual({ cin: 2200, cout: 2700, note: 'felt good' });
    expect(cinFor(st, '2026-10-07')).toBe(2000);
  });

  it('keeps every run, counted toward the right plan run', () => {
    expect(st.cardio.plan).toEqual({ start: '2026-10-05' });
    const runs = st.cardio.sessions.map((x) => [x.date, x.miles, x.secs ?? null, x.planDay ?? null]);
    expect(runs).toEqual([
      ['2026-10-06', 3, 1650, '2026-10-06'],
      ['2026-10-10', 3.1, null, '2026-10-09'],
      ['2026-10-11', 7, 4200, '2026-10-11'],
    ]);
    const today = '2026-10-14';
    expect(runStatus(st.cardio, '2026-10-06', today)).toBe('done');
    expect(runStatus(st.cardio, '2026-10-09', today)).toBe('moved'); // done on Saturday
    expect(runStatus(st.cardio, '2026-10-11', today)).toBe('done');
    expect(runStatus(st.cardio, '2026-10-13', today)).toBe('missed'); // week 2 tempo, nothing logged
  });

  it('keeps run skips (but not the one made up later)', () => {
    expect(st.cardio.skips).toEqual(['2026-10-09']);
  });

  it('turns push/pull/legs into routines on the same days, with the same exercises', () => {
    expect(st.lifting.routines.map((r) => r.name)).toEqual(['Push day', 'Pull day', 'Leg day']);
    expect(st.lifting.exercises).toHaveLength(14);
    expect(scheduledRoutine(st.lifting, '2026-10-19')!.name).toBe('Push day'); // Monday
    expect(scheduledRoutine(st.lifting, '2026-10-21')!.name).toBe('Pull day'); // Wednesday
    expect(scheduledRoutine(st.lifting, '2026-10-22')!.name).toBe('Leg day'); // Thursday
    expect(scheduledRoutine(st.lifting, '2026-10-20')).toBeNull();
    const bench = st.lifting.routines[0].items.find((i) => i.exId === 'm:bench')!;
    expect(bench).toMatchObject({ sets: 3, repMin: 8, repMax: 12, inc: 5, start: 50 });
    expect(st.lifting.exercises.find((e) => e.id === 'm:lpress')!.unit).toBe('plates');
  });

  it('keeps each lift day as a finished workout (skipped days dropped)', () => {
    expect(st.lifting.workouts.map((w) => [w.date, w.name])).toEqual([
      ['2026-10-05', 'Push day'],
      ['2026-10-12', 'Leg day'],
    ]);
    const push = st.lifting.workouts[0];
    const peck = push.exercises.find((x) => x.exId === 'm:peck')!;
    expect(peck.sets).toEqual([
      { w: 105, reps: 10, done: true },
      { w: 105, reps: 10, done: true },
      { w: 105, reps: 10, done: true },
    ]);
    expect(push.exercises.find((x) => x.exId === 'm:skull')!.sets.every((s) => !s.done)).toBe(true);
  });

  it('progression continues from the logged weights', () => {
    const plan = { sets: 3, repMin: 10, repMax: 14, inc: 5, start: 100 };
    // 3 × 10 at 105 is in range but not the top: stay at 105.
    expect(nextTarget('m:peck', st.lifting.workouts, plan)).toMatchObject({ weight: 105, reason: 'hold' });
  });

  it('is only migrated once', () => {
    const again = normalize(JSON.parse(JSON.stringify(st)));
    expect(again).toEqual(st);
  });
});
