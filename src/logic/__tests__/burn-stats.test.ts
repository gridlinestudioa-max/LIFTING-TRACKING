import { describe, expect, it } from '@jest/globals';

import {
  DEFAULT_HOME,
  baseBurn,
  baseInputs,
  bestSets,
  burnAccuracy,
  cardioReport,
  coutFor,
  dayBurn,
  defaultState,
  e1rm,
  kDays,
  liftRecords,
  liftSummary,
  missingForBurn,
  moveWidget,
  normalize,
  recentPRs,
  restingBurn,
  sessionBurn,
  visibleWidgets,
  workoutBurn,
  workoutLine,
  workoutMinutes,
  type CardioSession,
  type Profile,
  type Workout,
} from '..';

const me: Profile = { sex: 'male', birthday: '1990-01-01', heightIn: 70, weightLb: 180, tracker: 'none', daily: 'desk' };
const body = { sex: 'male' as const, age: 36, heightIn: 70, weightLb: 180 };

describe('calories burned estimate', () => {
  it('needs body stats and daily movement', () => {
    expect(baseInputs({ tracker: 'none' }, '2026-10-14')).toBeNull();
    expect(missingForBurn({ tracker: 'none', sex: 'male', heightIn: 70 }, '2026-10-14')).toBe('birthday, weight and how much you move in a day');
    expect(missingForBurn(me, '2026-10-14')).toBeNull();
  });

  it('scales the base with daily movement and uses steps when given', () => {
    const b = baseInputs(me, '2026-10-14')!;
    const rest = restingBurn(b);
    expect(rest).toBeGreaterThan(1700);
    expect(rest).toBeLessThan(1850);
    expect(baseBurn(b)).toBeCloseTo(rest * 1.2);
    expect(baseBurn({ ...b, daily: 'labor' })).toBeCloseTo(rest * 1.7);
    const steps = baseBurn({ ...b, steps: 10000 });
    // 10k steps for a 180 lb, 5'10" person: about 300 kcal above a sitting base.
    expect(steps - rest * 1.15).toBeGreaterThan(250);
    expect(steps - rest * 1.15).toBeLessThan(400);
    // Body fat switches to Katch-McArdle.
    expect(restingBurn({ ...b, bodyFat: 15 })).toBeCloseTo(370 + 21.6 * 180 * 0.45359237 * 0.85);
  });

  it('rates accuracy by what is filled in', () => {
    expect(burnAccuracy(me)).toEqual({ level: 'basic', add: ['your average daily steps', 'your body fat %'] });
    expect(burnAccuracy({ ...me, steps: 8000 }).level).toBe('good');
    expect(burnAccuracy({ ...me, steps: 8000, bodyFat: 18 }).level).toBe('best');
  });

  it('estimates workouts sensibly', () => {
    const run: CardioSession = { id: 'r', date: '2026-10-14', type: 'run', miles: 5, secs: 45 * 60 };
    // About 1 kcal per kg per km: 81.6 kg × 8.05 km.
    expect(sessionBurn(run, body)).toBe(Math.round(81.6466 * 8.04672));
    expect(sessionBurn({ ...run, kcal: 612 }, body)).toBe(612);
    const hr = sessionBurn({ ...run, hr: 150 }, body)!;
    expect(hr).toBeGreaterThan(500);
    expect(hr).toBeLessThan(800);
    const ride = sessionBurn({ id: 'b', date: '2026-10-14', type: 'bike', miles: 15, secs: 3600 }, body)!;
    expect(ride).toBeGreaterThan(600);
    expect(ride).toBeLessThan(800);
    expect(sessionBurn({ id: 'x', date: '2026-10-14', type: 'elliptical' }, body)).toBeNull();
    const w: Workout = { id: 'w', date: '2026-10-14', name: 'Push', done: true, exercises: [{ exId: 'a', name: 'Bench', unit: 'lb', repMin: 8, repMax: 12, inc: 5, sets: Array(16).fill({ w: 135, reps: 10, done: true }) }] };
    expect(workoutMinutes(w)).toBe(40);
    expect(workoutMinutes({ ...w, start: 0 + 1, end: 1 + 55 * 60000 })).toBe(55);
    expect(workoutBurn(w, 180)).toBe(Math.round(3.5 * 81.6466 * (40 / 60)));
    expect(workoutLine(w)).toBe('1 exercise · 16 sets · 40 min');
  });

  it('adds the day up and fills calories out for the history', () => {
    const st = defaultState();
    st.profile = me;
    st.cardio.sessions = [{ id: 'r', date: '2026-10-14', type: 'run', miles: 3, secs: 1800 }];
    st.meals['2026-10-14'] = [{ id: 'e', name: 'Food', serving: '1', qty: 1, n: { kcal: 2000, protein: 0, carbs: 0, fat: 0 }, tags: [], at: 600 }];
    const d = dayBurn(st, '2026-10-14')!;
    expect(d.parts).toEqual([{ label: 'Run', kcal: sessionBurn(st.cardio.sessions[0], body)! }]);
    expect(d.total).toBe(d.base + d.parts[0].kcal);
    expect(coutFor(st, '2026-10-14', '2026-10-14')).toBe(d.total);
    expect(coutFor(st, '2026-10-15', '2026-10-14')).toBeNull();
    st.days['2026-10-14'] = { cout: 3000 };
    expect(coutFor(st, '2026-10-14', '2026-10-14')).toBe(3000);
    expect(kDays(st)[0].cout).toBe(3000);
    expect(dayBurn({ ...st, profile: { ...me, tracker: 'garmin' } }, '2026-10-14')).toBeNull();
    const back = normalize(JSON.parse(JSON.stringify({ ...st, profile: { ...me, steps: 9000, bodyFat: 20 } })));
    expect(back.profile).toMatchObject({ tracker: 'none', daily: 'desk', steps: 9000, bodyFat: 20 });
  });
});

const wk = (id: string, date: string, sets: [number, number][], exId = 'bench'): Workout => ({
  id,
  date,
  name: 'Push',
  done: true,
  exercises: [{ exId, name: 'Bench press', unit: 'lb', repMin: 6, repMax: 10, inc: 5, sets: sets.map(([w, reps]) => ({ w, reps, done: true })) }],
});

describe('lifting stats', () => {
  const L = {
    exercises: [],
    routines: [],
    schedule: [null, null, null, null, null, null, null],
    workouts: [wk('a', '2026-09-01', [[135, 10], [145, 8]]), wk('b', '2026-09-20', [[155, 8]]), wk('c', '2026-10-13', [[165, 6], [150, 10]])],
  };
  it('finds the best set by estimated max', () => {
    expect(e1rm(100, 1)).toBe(100);
    expect(e1rm(135, 10)).toBeCloseTo(180);
    expect(bestSets(L, 'bench').map((b) => `${b.w}x${b.reps}`)).toEqual(['145x8', '155x8', '150x10']);
    const [r] = liftRecords(L);
    expect(r.best).toMatchObject({ w: 150, reps: 10, date: '2026-10-13' });
    expect(Math.round(r.change)).toBe(Math.round(e1rm(150, 10) - e1rm(145, 8)));
    expect(r.trend).toHaveLength(3);
    expect(recentPRs(L, '2026-10-14').map((p) => p.date)).toEqual(['2026-10-13', '2026-09-20']);
  });
  it('counts workouts by week', () => {
    const s = liftSummary(L, '2026-10-14');
    expect(s.total).toBe(3);
    expect(s.last4).toBe(2);
    expect(s.thisWeek).toBe(1);
    expect(s.streak).toBe(1);
    expect(s.sets).toBe(5);
    expect(s.weeks).toHaveLength(12);
  });
});

describe('cardio report', () => {
  it('totals by period and finds records and best efforts', () => {
    const c = {
      plan: null,
      skips: [],
      sessions: [
        { id: '1', date: '2026-01-10', type: 'run' as const, miles: 3.2, secs: 30 * 60 },
        { id: '2', date: '2026-10-01', type: 'run' as const, miles: 6.3, secs: 54 * 60, elevFt: 300, hr: 150 },
        { id: '3', date: '2026-10-13', type: 'run' as const, miles: 4, secs: 34 * 60 },
        { id: '4', date: '2026-10-13', type: 'bike' as const, miles: 20, secs: 3600 },
      ],
    };
    const r = cardioReport(c, me, '2026-10-14', 'run');
    expect(r.all.count).toBe(3);
    expect(r.week.count).toBe(1);
    expect(r.month.count).toBe(2);
    expect(r.year.miles).toBeCloseTo(13.5);
    expect(r.all.elevFt).toBe(300);
    expect(r.longest?.id).toBe('2');
    expect(r.fastest?.id).toBe('3');
    expect(r.avgHr).toBe(150);
    expect(r.efforts.map((e) => e.label)).toEqual(['1 mile', '5K', '10K']);
    expect(r.efforts[1].secs).toBeCloseTo(((34 * 60) / 4) * 3.10686);
    expect(r.efforts[2].secs).toBeCloseTo(((54 * 60) / 6.3) * 6.21371);
    expect(cardioReport(c, me, '2026-10-14', 'all').all.count).toBe(4);
  });
});

describe('home cards', () => {
  it('keeps chosen cards in order and hides ones for tabs that are off', () => {
    expect(normalize({}).settings.home).toEqual(DEFAULT_HOME);
    expect(normalize({ settings: { home: ['week', 'nope', 'week', 'protein'] } }).settings.home).toEqual(['week', 'protein']);
    expect(visibleWidgets(['workout', 'protein', 'plan'], { food: false, cardio: true, lifting: true })).toEqual(['workout', 'plan']);
    expect(moveWidget(['a', 'b', 'c'] as never, 'c' as never, -1)).toEqual(['a', 'c', 'b']);
    expect(moveWidget(['a', 'b'] as never, 'a' as never, -1)).toEqual(['a', 'b']);
  });
});
