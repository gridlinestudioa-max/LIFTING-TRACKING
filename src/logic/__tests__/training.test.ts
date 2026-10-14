import { describe, expect, it } from '@jest/globals';

import {
  EMPTY_CARDIO,
  EMPTY_LIFTING,
  DAY_COUNTS,
  SPLITS,
  applyTemplate,
  liftingPlan,
  cardioStats,
  defaultIncrement,
  defaultPlanDay,
  liftWeek,
  loadExercises,
  nextTarget,
  parseExercises,
  PLANS,
  allPlanned,
  dayStatus,
  defaultPlanStart,
  distText,
  normalizeCardio,
  planDayOptions,
  planEnd,
  planWeek,
  planWeekRows,
  plannedFor,
  plannedOn,
  progressionSummary,
  raceDay,
  workoutStatus,
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
const plan = { id: 'run-half', start: START };
const cardio = (over: Partial<CardioData> = {}): CardioData => ({ ...EMPTY_CARDIO, plan, sessions: [], skips: [], ...over });
const one = (p: CardioData['plan'], s: string) => {
  const list = plannedOn(p, s);
  return list.length ? { w: list[0].w, kind: list[0].kind, miles: list[0].miles, race: list[0].race } : null;
};
const runOn = (c: CardioData, s: string, today: string) => workoutStatus(c, plannedFor(c.plan, s, 'run')!, today);

describe('half-marathon plan', () => {
  it('runs on Tue, Fri, Sun with the old mileage', () => {
    expect(one(plan, '2026-10-05')).toBeNull(); // Monday: no run
    expect(one(plan, '2026-10-06')).toEqual({ w: 0, kind: 'tempo', miles: 3, race: false });
    expect(one(plan, '2026-10-11')).toMatchObject({ kind: 'long', miles: 7 });
    expect(raceDay(plan)).toBe('2026-12-27');
    expect(one(plan, '2026-12-27')).toMatchObject({ kind: 'race', miles: 13.1, race: true });
    expect(one(plan, '2026-12-28')).toBeNull();
    expect(one(null, '2026-10-06')).toBeNull();
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
    expect(runOn(c, '2026-10-06', today)).toBe('done');
    expect(runOn(c, '2026-10-11', today)).toBe('partial');
    expect(runOn(c, '2026-10-09', today)).toBe('moved');
    expect(runOn(c, '2026-10-13', today)).toBe('skipped');
    expect(runOn(c, '2026-10-16', today)).toBe('open');
    expect(runOn(cardio(), '2026-10-06', today)).toBe('missed');
    expect(dayStatus(c, '2026-10-06', today)).toBe('done');
    expect(dayStatus(c, '2026-10-07', today)).toBeNull();
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

  it('plans saved before there was a choice are the half marathon', () => {
    expect(normalizeCardio({ plan: { start: START } }).plan).toEqual({ id: 'run-half', start: START });
    expect(normalizeCardio({ plan: { id: 'nope', start: START } }).plan).toBeNull();
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
    expect(rows.sports).toHaveLength(1);
    expect(rows.sports[0].rows[0]).toEqual({ label: 'W1', planned: 13, actual: 10 }); // the ride isn't running miles
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


describe('cardio plans', () => {
  it('every plan has workouts, sensible distances and a race on its last day', () => {
    for (const p of PLANS) {
      const c = { id: p.id, start: START };
      const all = allPlanned(c, '2026-10-14');
      expect(all.length).toBeGreaterThan(0);
      for (const wk of all) expect(wk.miles).toBeGreaterThan(0);
      if (p.weeks != null && p.race) {
        expect(raceDay(c)).toBe(planEnd(c));
        const race = plannedOn(c, raceDay(c)!);
        expect(race.every((x) => x.race)).toBe(true);
        expect(race.map((x) => x.sport)).toEqual(p.race.parts.map((x) => x.sport));
      }
    }
    expect(PLANS.map((p) => p.id)).toHaveLength(19);
  });

  it('a new plan starts next Monday (or today, on a Monday)', () => {
    expect(defaultPlanStart('2026-10-14')).toBe('2026-10-19');
    expect(defaultPlanStart('2026-10-19')).toBe('2026-10-19');
    expect(defaultPlanStart('2026-10-18')).toBe('2026-10-19');
  });

  it('maintenance plans repeat with no end', () => {
    const c = { id: 'run-maint', start: START };
    expect(planEnd(c)).toBeNull();
    expect(planWeek(c, '2027-06-01')).toBe(34);
    expect(plannedOn(c, '2027-06-01').map((x) => x.kind)).toEqual(['easy']); // a Tuesday
  });

  it('swims are planned in meters and stored as miles', () => {
    const c = { id: 'swim-1500', start: START };
    const race = plannedOn(c, raceDay(c)!)[0];
    expect(distText('swim', race.miles)).toBe('1,500 m');
    expect(distText('run', 3.1)).toBe('3.1 mi');
  });

  it('triathlon: brick days have a ride and a run; race day is all three', () => {
    const c = { id: 'tri-sprint', start: START };
    expect(plannedOn(c, '2026-10-10').map((x) => `${x.sport}:${x.kind}`)).toEqual(['bike:brick', 'run:brick']);
    const race = plannedOn(c, raceDay(c)!);
    expect(race.map((x) => distText(x.sport, x.miles))).toEqual(['750 m', '12.4 mi', '3.1 mi']);
    // A swim on race day counts toward the swim only.
    const data: CardioData = { plan: c, sessions: [{ id: 's', date: raceDay(c)!, type: 'swim', miles: race[0].miles, planDay: raceDay(c)! }], skips: [] };
    expect(race.map((wk) => workoutStatus(data, wk, raceDay(c)!))).toEqual(['done', 'open', 'open']);
    expect(dayStatus(data, raceDay(c)!, raceDay(c)!)).toBe('open');
    // Skipping one sport leaves the others.
    const sk = { ...data, sessions: [], skips: [`${raceDay(c)}|bike`] };
    expect(race.map((wk) => workoutStatus(sk, wk, raceDay(c)!))).toEqual(['open', 'skipped', 'open']);
  });

  it('weekly bars per sport', () => {
    const rows = planWeekRows({ plan: { id: 'tri-sprint', start: START }, sessions: [], skips: [] });
    expect(rows.sports.map((x) => x.sport)).toEqual(['swim', 'run', 'bike']);
    expect(rows.long).toEqual([]);
  });
});

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

  it('every split has a plan for 3 to 7 days, with library exercises, on that many days', () => {
    for (const sp of SPLITS) {
      for (const d of DAY_COUNTS) {
        const t = liftingPlan(sp.id, d);
        expect(t.schedule.filter(Boolean)).toHaveLength(d);
        for (const id of t.schedule) if (id) expect(t.routines.some((x) => x.id === id)).toBe(true);
        for (const r of t.routines) for (const i of r.items) expect(ids.has(i.exId)).toBe(true);
        if (sp.id !== 'custom') for (const r of t.routines) expect(r.items.length).toBeGreaterThanOrEqual(4);
      }
    }
  });

  it('a plan repeats a workout when there are more days than workouts', () => {
    const t = liftingPlan('full', 6);
    expect(t.routines.map((r) => r.name)).toEqual(['Full body A', 'Full body B', 'Full body C']);
    expect(t.schedule).toEqual(['t:fullA', 't:fullB', 't:fullC', 't:fullA', 't:fullB', 't:fullC', null]);
    expect(liftingPlan('custom', 4).routines.map((r) => r.name)).toEqual(['Day 1', 'Day 2', 'Day 3', 'Day 4']);
  });

  it('applying a template adds its routines and schedule', () => {
    let n = 0;
    const l = applyTemplate(EMPTY_LIFTING, liftingPlan('ppl', 3), () => `r${++n}`);
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
