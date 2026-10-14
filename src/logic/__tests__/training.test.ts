import { describe, expect, it } from '@jest/globals';

import {
  EMPTY_CARDIO,
  EMPTY_LIFTING,
  TEMPLATES,
  applyTemplate,
  cardioStats,
  defaultIncrement,
  defaultPlanDay,
  liftWeek,
  loadExercises,
  nextTarget,
  parseExercises,
  planDayOptions,
  planRun,
  planWeekRows,
  progressionSummary,
  raceDay,
  runStatus,
  searchExercises,
  syncAction,
  targetNote,
  weeklyTotals,
  workoutFromRoutine,
  type CardioData,
  type Exercise,
  type LiftingData,
  type Workout,
  type WorkoutExercise,
} from '..';
import exerciseFile from '../data/exercises.json';

const START = '2026-10-05';
const plan = { start: START };
const cardio = (over: Partial<CardioData> = {}): CardioData => ({ ...EMPTY_CARDIO, plan, sessions: [], skips: [], ...over });

describe('half-marathon plan', () => {
  it('runs on Tue, Fri, Sun with the old mileage', () => {
    expect(planRun(plan, '2026-10-05')).toBeNull(); // Monday: no run
    expect(planRun(plan, '2026-10-06')).toEqual({ w: 0, type: 'tempo', miles: 3, race: false });
    expect(planRun(plan, '2026-10-11')).toMatchObject({ type: 'long', miles: 7 });
    expect(raceDay(START)).toBe('2026-12-27');
    expect(planRun(plan, '2026-12-27')).toMatchObject({ type: 'long', miles: 13.1, race: true });
    expect(planRun(plan, '2026-12-28')).toBeNull();
    expect(planRun(null, '2026-10-06')).toBeNull();
  });

  it('statuses: 90% rule, partial, missed, skipped, moved', () => {
    const today = '2026-10-14';
    const c = cardio({
      sessions: [
        { id: 'a', date: '2026-10-06', type: 'run', miles: 2.7, planDay: '2026-10-06' }, // 90% of 3
        { id: 'b', date: '2026-10-11', type: 'run', miles: 4, planDay: '2026-10-11' }, // 4 of 7
        { id: 'c', date: '2026-10-10', type: 'run', miles: 3, planDay: '2026-10-09' }, // Fri run done Sat
      ],
      skips: ['2026-10-13'],
    });
    expect(runStatus(c, '2026-10-06', today)).toBe('done');
    expect(runStatus(c, '2026-10-11', today)).toBe('partial');
    expect(runStatus(c, '2026-10-09', today)).toBe('moved');
    expect(runStatus(c, '2026-10-13', today)).toBe('skipped');
    expect(runStatus(c, '2026-10-16', today)).toBe('open');
    expect(runStatus(cardio(), '2026-10-06', today)).toBe('missed');
  });

  it('a run on a plan day counts toward it by default; other cardio does not', () => {
    const c = cardio();
    expect(defaultPlanDay(c, '2026-10-06', 'run')).toBe('2026-10-06');
    expect(defaultPlanDay(c, '2026-10-06', 'bike')).toBeUndefined();
    expect(defaultPlanDay(c, '2026-10-07', 'run')).toBeUndefined();
  });

  it('a run on another day can count toward an open run this week or a recent miss', () => {
    const today = '2026-10-15';
    const c = cardio({ sessions: [{ id: 'a', date: '2026-10-13', type: 'run', miles: 3, planDay: '2026-10-13' }] });
    // Thursday Oct 15: this week's Fri easy and Sun long are open; last Fri and Sun (Oct 9, 11) were missed.
    // Last Tuesday's tempo (Oct 6) is more than a week back, and this Tuesday's is done.
    expect(planDayOptions(c, '2026-10-15', today).map((o) => o.s)).toEqual(['2026-10-09', '2026-10-11', '2026-10-16', '2026-10-18']);
  });

  it('stats and weekly bars', () => {
    const c = cardio({
      sessions: [
        { id: 'a', date: '2026-10-06', type: 'run', miles: 3, secs: 1650, planDay: '2026-10-06' },
        { id: 'b', date: '2026-10-11', type: 'run', miles: 7, secs: 4200, planDay: '2026-10-11' },
        { id: 'c', date: '2026-10-08', type: 'bike', miles: 10, secs: 2400 },
      ],
    });
    const st = cardioStats(c, '2026-10-12');
    expect(st).toMatchObject({ sessions: 3, miles: 20, longestRun: 7, paceMiles: 10, paceSecs: 5850, planDone: 2, planMissed: 1, planDue: 3 });
    const rows = planWeekRows(c);
    expect(rows.long[0]).toEqual({ label: 'W1', planned: 7, actual: 7 });
    expect(rows.week[0]).toEqual({ label: 'W1', planned: 13, actual: 10 }); // the ride isn't running miles
    const wk = weeklyTotals(c, '2026-10-12', 2);
    expect(wk).toEqual([
      { start: '2026-10-05', miles: 20, secs: 8250 },
      { start: '2026-10-12', miles: 0, secs: 0 },
    ]);
  });
});

// ---------- Lifting ----------

const bench: Exercise = { id: 'x:bench', name: 'Barbell Bench Press', equipment: 'barbell', primary: ['chest'], secondary: [] };
const squat: Exercise = { id: 'x:squat', name: 'Barbell Squat', equipment: 'barbell', primary: ['quadriceps'], secondary: [] };
const pushup: Exercise = { id: 'x:pushup', name: 'Pushups', equipment: 'body only', primary: ['chest'], secondary: [] };

const ex = (exId: string, w: number | null, reps: (number | null)[], range: [number, number] = [8, 12], inc = 5): WorkoutExercise => ({
  exId,
  name: exId,
  unit: 'lb',
  repMin: range[0],
  repMax: range[1],
  inc,
  sets: reps.map((r) => ({ w, reps: r, done: r != null })),
});
const workout = (date: string, ...exercises: WorkoutExercise[]): Workout => ({ id: date, date, name: 'W', done: true, exercises });
const plan3 = { sets: 3, repMin: 8, repMax: 12, inc: 5, start: 135 };

describe('double progression', () => {
  it('starts at the starting weight', () => {
    expect(nextTarget('x:bench', [], plan3)).toMatchObject({ weight: 135, reason: 'start' });
  });

  it('holds until every set hits the top of the range, then adds weight', () => {
    const w1 = workout('2026-10-01', ex('x:bench', 135, [12, 11, 10]));
    expect(nextTarget('x:bench', [w1], plan3)).toMatchObject({ weight: 135, reason: 'hold' });
    const w2 = workout('2026-10-03', ex('x:bench', 135, [12, 12, 12]));
    expect(nextTarget('x:bench', [w1, w2], plan3)).toMatchObject({ weight: 140, reason: 'up' });
  });

  it('three sessions below the range drops about 10%', () => {
    const miss = (d: string) => workout(d, ex('x:bench', 200, [8, 7, 6]));
    expect(nextTarget('x:bench', [miss('2026-10-01')], plan3)).toMatchObject({ weight: 200, reason: 'miss', misses: 1 });
    expect(nextTarget('x:bench', [miss('2026-10-01'), miss('2026-10-03')], plan3)).toMatchObject({ misses: 2 });
    expect(nextTarget('x:bench', [miss('2026-10-01'), miss('2026-10-03'), miss('2026-10-05')], plan3)).toMatchObject({
      weight: 180,
      reason: 'deload',
      misses: 0,
    });
  });

  it('a session in range resets the miss count', () => {
    const ws = [
      workout('2026-10-01', ex('x:bench', 200, [8, 7, 6])),
      workout('2026-10-03', ex('x:bench', 200, [9, 9, 8])),
      workout('2026-10-05', ex('x:bench', 200, [8, 7, 6])),
    ];
    expect(nextTarget('x:bench', ws, plan3)).toMatchObject({ weight: 200, misses: 1 });
  });

  it('skipping sets counts as a miss; unfinished workouts are ignored', () => {
    const skipped = workout('2026-10-01', ex('x:bench', 135, [12, 12, null]));
    expect(nextTarget('x:bench', [skipped], plan3).reason).toBe('miss');
    const open = { ...workout('2026-10-02', ex('x:bench', 135, [12, 12, 12])), done: false };
    expect(nextTarget('x:bench', [open], plan3).reason).toBe('start');
  });

  it('weight you choose to change carries forward', () => {
    const w = workout('2026-10-01', ex('x:bench', 145, [10, 9, 9]));
    expect(nextTarget('x:bench', [w], plan3).weight).toBe(145);
  });

  it('increments: 5 lb upper body, 10 lb lower body on a bar or machine, plates, bodyweight', () => {
    expect(defaultIncrement(bench)).toBe(5);
    expect(defaultIncrement(squat)).toBe(10);
    expect(defaultIncrement({ ...squat, equipment: 'dumbbell' })).toBe(5);
    expect(defaultIncrement({ ...squat, unit: 'plates' })).toBe(1);
    expect(defaultIncrement(pushup)).toBe(0);
  });

  it('bodyweight: progress by reps, with a nudge to add weight', () => {
    const w = workout('2026-10-01', ex('x:pushup', null, [15, 15, 15], [10, 15], 0));
    const t = nextTarget('x:pushup', [w], { sets: 3, repMin: 10, repMax: 15, inc: 0 });
    expect(t).toMatchObject({ weight: null, reason: 'up' });
    expect(targetNote(t, 'lb', true)).toMatch(/harder version/);
  });

  it('notes say why', () => {
    const t = nextTarget('x:bench', [workout('2026-10-03', ex('x:bench', 135, [12, 12, 12]))], plan3);
    expect(targetNote(t)).toBe('You hit 12 on every set last time, so the weight goes up to 140 lb.');
  });
});

describe('routines and workouts', () => {
  const lib = new Map([bench, squat, pushup].map((e) => [e.id, e]));
  const exById = (id: string) => lib.get(id);
  const L: LiftingData = {
    ...EMPTY_LIFTING,
    routines: [
      {
        id: 'r1',
        name: 'Full body',
        items: [
          { exId: 'x:bench', sets: 3, repMin: 8, repMax: 12, start: 135 },
          { exId: 'x:squat', sets: 3, repMin: 5, repMax: 8, start: 185 },
        ],
      },
    ],
    schedule: ['r1', null, 'r1', null, 'r1', null, null],
    workouts: [workout('2026-10-12', ex('x:bench', 135, [12, 12, 12]), ex('x:squat', 185, [8, 8, 8], [5, 8], 10))],
  };

  it('a workout from a routine starts at each target weight', () => {
    const w = workoutFromRoutine(L, L.routines[0], '2026-10-14', exById, 'w2');
    expect(w.exercises.map((x) => [x.name, x.sets.length, x.sets[0].w, x.inc])).toEqual([
      ['Barbell Bench Press', 3, 140, 5],
      ['Barbell Squat', 3, 195, 10],
    ]);
    expect(w.done).toBe(false);
  });

  it('finishing shows what changes next time', () => {
    const w = workoutFromRoutine(L, L.routines[0], '2026-10-14', exById, 'w2');
    w.exercises[0].sets = [12, 12, 12].map((r) => ({ w: 140, reps: r, done: true }));
    w.exercises[1].sets = [6, 6, 5].map((r) => ({ w: 195, reps: r, done: true }));
    const s = progressionSummary(L, w);
    expect(s.map((x) => [x.name, x.from, x.to])).toEqual([
      ['Barbell Bench Press', 140, 145],
      ['Barbell Squat', 195, 195],
    ]);
  });

  it('this week: scheduled and done', () => {
    const wk = liftWeek(L, '2026-10-14');
    expect(wk.map((d) => [d.day, d.routine?.name ?? null, !!d.done])).toEqual([
      ['2026-10-12', 'Full body', true],
      ['2026-10-13', null, false],
      ['2026-10-14', 'Full body', false],
      ['2026-10-15', null, false],
      ['2026-10-16', 'Full body', false],
      ['2026-10-17', null, false],
      ['2026-10-18', null, false],
    ]);
  });
});

describe('exercise library', () => {
  const all = parseExercises(exerciseFile as unknown as Parameters<typeof parseExercises>[0]);

  it('has the common lifts, with muscles and images', () => {
    expect(all.length).toBeGreaterThan(700);
    const b = all.find((e) => e.name === 'Barbell Bench Press - Medium Grip')!;
    expect(b.primary).toEqual(['chest']);
    expect(b.equipment).toBe('barbell');
    expect(b.image).toMatch(/^https:\/\/raw\.githubusercontent\.com\/yuhonas\/free-exercise-db\/main\/exercises\/.+\.jpg$/);
    expect(new Set(all.map((e) => e.id)).size).toBe(all.length);
    expect(typeof loadExercises).toBe('function');
  });

  it('search: word starts, your own exercises first, muscle filter', () => {
    const mine: Exercise = { id: 'c1', name: 'Bench press, hotel gym', equipment: 'machine', primary: ['chest'], secondary: [], custom: true };
    const r = searchExercises([...all, mine], 'bench press');
    expect(r[0].id).toBe('c1');
    expect(r.slice(1, 6).every((e) => /bench press/i.test(e.name))).toBe(true);
    expect(searchExercises(all, 'squat', ['chest'])).toEqual([]);
    expect(searchExercises(all, 'lat pulldown').map((e) => e.name)).toContain('Wide-Grip Lat Pulldown');
  });
});

describe('templates and sync rules', () => {
  const all = parseExercises(exerciseFile as unknown as Parameters<typeof parseExercises>[0]);
  const ids = new Set(all.map((e) => e.id));

  it('every template exercise is in the library', () => {
    for (const t of TEMPLATES) for (const r of t.routines) for (const i of r.items) expect(ids.has(i.exId)).toBe(true);
  });

  it('applying a template adds its routines and schedule', () => {
    let n = 0;
    const l = applyTemplate(EMPTY_LIFTING, TEMPLATES[0], () => `r${++n}`);
    expect(l.routines.map((r) => [r.id, r.name])).toEqual([
      ['r1', 'Push'],
      ['r2', 'Pull'],
      ['r3', 'Legs'],
    ]);
    expect(l.schedule).toEqual(['r1', null, 'r2', null, 'r3', null, null]);
  });

  it('sync: newer copy wins; first sign-in uploads', () => {
    expect(syncAction(5, null, true)).toBe('push');
    expect(syncAction(0, null, false)).toBe('none');
    expect(syncAction(5, { updatedAt: 9 }, true)).toBe('pull');
    expect(syncAction(9, { updatedAt: 5 }, true)).toBe('push');
    expect(syncAction(5, { updatedAt: 5 }, true)).toBe('none');
  });
});
