import { describe, expect, it } from '@jest/globals';

import {
  ALL_EXERCISES,
  addDays,
  byWeek,
  calorieSummary,
  effectivePlan,
  formPlan,
  madeUpBy,
  makeupCandidates,
  cumulative,
  dailyWindow,
  defaultState,
  fmtTime,
  formFromLog,
  headline,
  kcalInfo,
  level,
  logFromForm,
  loggedWeights,
  mondayOf,
  normalize,
  normalizeTimeInput,
  paceText,
  parseTime,
  planFor,
  progressStats,
  raceDay,
  sgn,
  snapStart,
  status,
  submitError,
  targetFor,
  weeklyRunRows,
  type TrackerState,
} from '..';

const START = '2026-10-05';

function stateWith(logs: TrackerState['logs'] = {}, goal: number | null = null): TrackerState {
  return { ...defaultState(), goal, logs };
}

function allLifts(ids: string[], done: boolean) {
  return Object.fromEntries(ids.map((id) => [id, { w: 1, done }]));
}
const PUSH = ['tri', 'bench', 'skull', 'peck', 'ohp'];

describe('plan mapping', () => {
  it('2026-10-05 is Push, week 1', () => {
    const p = planFor(START, '2026-10-05')!;
    expect(p.type).toBe('push');
    expect(p.w).toBe(0);
  });
  it('2026-10-11 is a 7 mi long run', () => {
    expect(planFor(START, '2026-10-11')).toEqual({ w: 0, type: 'long', miles: 7, race: false });
  });
  it('2026-12-27 is race day (13.1)', () => {
    expect(planFor(START, '2026-12-27')).toEqual({ w: 11, type: 'long', miles: 13.1, race: true });
    expect(raceDay(START)).toBe('2026-12-27');
  });
  it('weekly layout Mon..Sun', () => {
    const types = [0, 1, 2, 3, 4, 5, 6].map((i) => planFor(START, addDays(START, i))!.type);
    expect(types).toEqual(['push', 'tempo', 'pull', 'legs', 'easy', 'rest', 'long']);
  });
  it('outside the plan is null', () => {
    expect(planFor(START, '2026-10-04')).toBeNull();
    expect(planFor(START, '2026-12-28')).toBeNull();
  });
  it('easy and tempo miles follow the rules', () => {
    const easy = (w: number) => planFor(START, addDays(START, w * 7 + 4))!.miles;
    const tempo = (w: number) => planFor(START, addDays(START, w * 7 + 1))!.miles;
    expect([0, 10, 11].map(easy)).toEqual([3, 3, 2]);
    expect([0, 3, 4, 8, 9, 11].map(tempo)).toEqual([3, 3, 4, 4, 3, 3]);
  });
  it('long runs by week', () => {
    const longs = Array.from({ length: 12 }, (_, w) => planFor(START, addDays(START, w * 7 + 6))!.miles);
    expect(longs).toEqual([7, 8, 9, 7, 10, 11, 8, 12, 10, 8, 6, 13.1]);
  });
  it('start snaps to Monday', () => {
    expect(snapStart('2026-10-08')).toBe('2026-10-05');
    expect(snapStart('2026-10-11')).toBe('2026-10-05');
    expect(mondayOf('2026-10-05')).toBe('2026-10-05');
  });
});

describe('target weights', () => {
  const base = defaultState().base;
  const at = (id: string) => [0, 3, 6, 9].map((w) => targetFor(base, id, w));
  it('shoulder press 40/45/50/55', () => expect(at('ohp')).toEqual([40, 45, 50, 55]));
  it('leg press 7/8/9/10 plates', () => expect(at('lpress')).toEqual([7, 8, 9, 10]));
  it('biceps cable 50/52.5/55/57.5', () => expect(at('bicable')).toEqual([50, 52.5, 55, 57.5]));
  it('weeks 1-3 share a weight', () => {
    expect([0, 1, 2].map((w) => targetFor(base, 'ohp', w))).toEqual([40, 40, 40]);
  });
  it('editing base recalculates', () => {
    expect(targetFor({ ...base, ohp: 50 }, 'ohp', 9)).toBe(65);
  });
});

describe('time and pace', () => {
  it('3 mi in 27:30 gives 9:10 /mi', () => {
    expect(paceText(3, parseTime('27:30'))).toBe('9:10 /mi');
  });
  it('time input 58 is 58 minutes', () => {
    expect(parseTime('58')).toBe(58 * 60);
    expect(normalizeTimeInput('58')).toBe('58:00');
  });
  it('parses m:ss and h:mm:ss', () => {
    expect(parseTime('58:30')).toBe(3510);
    expect(parseTime('1:58:30')).toBe(7110);
    expect(parseTime('')).toBeNull();
    expect(parseTime('abc')).toBeNull();
    expect(parseTime('1:2:3:4')).toBeNull();
  });
  it('formats seconds', () => {
    expect(fmtTime(7110)).toBe('1:58:30');
    expect(fmtTime(3510)).toBe('58:30');
  });
  it('pace is empty without miles or time', () => {
    expect(paceText(0, 100)).toBe('');
    expect(paceText(3, null)).toBe('');
  });
});

describe('status', () => {
  const TODAY = '2026-10-20';
  it('lift day all checked gives done', () => {
    const s = stateWith({ '2026-10-05': { submitted: true, lifts: allLifts(PUSH, true) } });
    expect(status(s, '2026-10-05', TODAY)).toBe('done');
  });
  it('2 of 5 checked on a past day gives partial', () => {
    const lifts = { ...allLifts(PUSH, false), tri: { w: 35, done: true }, bench: { w: 45, done: true } };
    const s = stateWith({ '2026-10-05': { submitted: true, lifts } });
    expect(status(s, '2026-10-05', TODAY)).toBe('partial');
  });
  it('run of 2.7 of 3 mi gives done (90% rule)', () => {
    const s = stateWith({ '2026-10-06': { submitted: true, miles: 2.7 } });
    expect(status(s, '2026-10-06', TODAY)).toBe('done');
  });
  it('run under 90% on a past day is partial', () => {
    const s = stateWith({ '2026-10-06': { submitted: true, miles: 2.6 } });
    expect(status(s, '2026-10-06', TODAY)).toBe('partial');
  });
  it('past day with nothing gives missed', () => {
    expect(status(stateWith(), '2026-10-05', TODAY)).toBe('missed');
  });
  it('today and future are open', () => {
    expect(status(stateWith(), TODAY, TODAY)).toBe('open');
    expect(status(stateWith(), '2026-10-27', TODAY)).toBe('open');
  });
  it('rest days are always rest; outside plan is null', () => {
    expect(status(stateWith(), '2026-10-10', TODAY)).toBe('rest');
    expect(status(stateWith(), '2026-10-01', TODAY)).toBeNull();
  });
  it('unsubmitted logs change nothing', () => {
    const s = stateWith({ '2026-10-05': { submitted: false, lifts: allLifts(PUSH, true) } });
    expect(level(s, '2026-10-05')).toBe(0);
    expect(status(s, '2026-10-05', TODAY)).toBe('missed');
  });
  it('calories never affect status', () => {
    const s = stateWith({ '2026-10-06': { submitted: true, cin: 2000, cout: 3000 } });
    expect(status(s, '2026-10-06', TODAY)).toBe('missed');
  });
});

describe('calories', () => {
  it('in 2200, out 2700 gives Deficit 500', () => {
    expect(kcalInfo(2200, 2700, null)).toEqual({ text: 'Deficit: 500 kcal', tone: 'ok' });
  });
  it('with goal 400 it shows goal met', () => {
    expect(kcalInfo(2200, 2700, 400).text).toBe('Deficit: 500 kcal · goal met ✓');
  });
  it('short of goal', () => {
    expect(kcalInfo(2200, 2700, 1700).text).toBe('Deficit: 500 kcal · 1,200 short of goal');
  });
  it('in 2500, out 2400 gives Surplus 100', () => {
    expect(kcalInfo(2500, 2400, 400)).toEqual({ text: 'Surplus: 100 kcal', tone: 'bad' });
  });
  it('needs both numbers', () => {
    expect(kcalInfo(2200, null, null).tone).toBe('mute');
  });
  it('summary, cumulative and by-week', () => {
    const s = stateWith(
      {
        '2026-10-05': { submitted: true, cin: 2200, cout: 2700 },
        '2026-10-06': { submitted: true, cin: 2500, cout: 2400 },
        '2026-10-12': { submitted: true, cin: 2000, cout: 2600 },
        '2026-10-13': { submitted: true, miles: 3 },
      },
      400,
    );
    expect(calorieSummary(s)).toEqual({ days: 3, total: 1000, avg: 1000 / 3, hit: 2 });
    expect(calorieSummary({ ...s, goal: null }).hit).toBe(2);
    expect(cumulative(s).map((p) => p.v)).toEqual([500, 400, 1000]);
    const wk = byWeek(s);
    expect(wk.map((w) => [w.week, w.days, w.avgNet])).toEqual([[1, 2, 200], [2, 1, 600]]);
    expect(sgn(-1234.4)).toBe('−1,234');
  });
  it('daily window: early in plan shows start + 14 days', () => {
    const w = dailyWindow(stateWith(), '2026-10-07');
    expect(w[0].s).toBe(START);
    expect(w).toHaveLength(14);
  });
  it('daily window: last 3 weeks, clamped to plan end', () => {
    const w = dailyWindow(stateWith(), '2026-11-20');
    expect(w).toHaveLength(21);
    expect(w[20].s).toBe('2026-11-20');
    const end = dailyWindow(stateWith(), '2027-02-01');
    expect(end[end.length - 1].s).toBe('2026-12-27');
  });
});

describe('progress', () => {
  const TODAY = '2026-10-08'; // Thursday of week 1
  const s = stateWith({
    '2026-10-05': { submitted: true, lifts: allLifts(PUSH, true) },
    '2026-10-06': { submitted: true, miles: 3, secs: 1650 },
    '2026-10-08': { submitted: true, lifts: { lpress: { w: 7, done: true } } },
    '2026-10-11': { submitted: true, miles: 7, secs: 4200 },
  });
  it('stats', () => {
    const st = progressStats(s, TODAY);
    // Mon done, Tue done, Wed missed, Thu open (partial, not counted)
    expect(st.done).toBe(2);
    expect(st.planned).toBe(3);
    expect(st.missedOrPartial).toBe(1);
    expect(st.miles).toBe(10);
    expect(st.longest).toBe(7);
    expect(paceText(st.paceMiles, st.paceSecs)).toBe('9:45 /mi');
    expect(st.liftDone).toBe(1);
  });
  it('weekly rows', () => {
    const { long, week } = weeklyRunRows(s);
    expect(long[0]).toEqual({ label: 'W1', planned: 7, actual: 7 });
    expect(week[0]).toEqual({ label: 'W1', planned: 13, actual: 10 });
    expect(week[11].planned).toBe(3 + 2 + 13.1);
  });
  it('logged weights only counts checked entries', () => {
    expect(loggedWeights(s, 'tri')).toEqual([1]);
    expect(loggedWeights(s, 'rdl')).toEqual([]);
  });
  it('headline', () => {
    expect(headline(s, TODAY)).toBe('Week 1 of 12 · long run this week: 7 mi');
    expect(headline(s, '2026-10-01')).toBe('Plan starts October 5');
    expect(headline(s, '2027-01-01')).toBe('12-week plan complete');
  });
});

describe('form and submit', () => {
  const st = defaultState();
  it('lift form prefills targets and round-trips', () => {
    const p = planFor(START, addDays(START, 21))!; // week 4 push
    const f = formFromLog(st, p, undefined);
    expect(f.lifts.ohp).toEqual({ w: '45', done: false });
    f.lifts.ohp = { w: '50', done: true };
    f.lifts.tri.w = '';
    const log = logFromForm(st, p, f);
    expect(log.lifts!.ohp).toEqual({ w: 50, done: true });
    expect(log.lifts!.tri).toEqual({ w: 40, done: false });
    expect(submitError(p, log)).toBeNull();
  });
  it('run day needs miles or calories', () => {
    const p = planFor(START, '2026-10-06')!;
    const empty = formFromLog(st, p, undefined);
    expect(submitError(p, logFromForm(st, p, empty))).toBe('Enter your miles or calories first.');
    const log = logFromForm(st, p, { ...empty, miles: '3', time: '27:30' });
    expect(log).toEqual({ miles: 3, secs: 1650 });
    expect(submitError(p, log)).toBeNull();
    expect(submitError(p, logFromForm(st, p, { ...empty, cin: '2000' }))).toBeNull();
  });
  it('rest day needs calories', () => {
    const p = planFor(START, '2026-10-10')!;
    const empty = formFromLog(st, p, undefined);
    expect(submitError(p, logFromForm(st, p, { ...empty, note: 'hi' }))).toBe('Enter your calories first.');
    expect(submitError(p, logFromForm(st, p, { ...empty, cout: '2500' }))).toBeNull();
  });
});

describe('normalize', () => {
  it('returns defaults for junk', () => {
    expect(normalize(null)).toEqual(defaultState());
    expect(Object.keys(normalize({}).base)).toHaveLength(ALL_EXERCISES.length);
  });
  it('migrates mins to secs and marks old logs submitted', () => {
    const n = normalize({ start: '2026-11-02', goal: 300, base: { ohp: 50 }, logs: { '2026-11-03': { miles: 3, mins: 30 } } });
    expect(n.start).toBe('2026-11-02');
    expect(n.goal).toBe(300);
    expect(n.base.ohp).toBe(50);
    expect(n.base.tri).toBe(35);
    expect(n.logs['2026-11-03']).toEqual({ miles: 3, secs: 1800, submitted: true });
  });
  it('ignores non-positive goal', () => {
    expect(normalize({ goal: 0 }).goal).toBeNull();
  });
});

describe('skip', () => {
  const TODAY = '2026-10-20';
  const st = defaultState();
  it('a skipped day shows as skipped, not missed, on past and future days', () => {
    const s = stateWith({
      '2026-10-05': { submitted: true, skipped: true },
      '2026-10-27': { submitted: true, skipped: true, cin: 2000, cout: 2400 },
    });
    expect(status(s, '2026-10-05', TODAY)).toBe('skipped');
    expect(status(s, '2026-10-27', TODAY)).toBe('skipped');
    expect(level(s, '2026-10-05')).toBe(0);
  });
  it('skip drops workout fields but keeps calories and notes', () => {
    const p = planFor(START, '2026-10-06')!;
    const f = { ...formFromLog(st, p, undefined), miles: '3', cin: '2100', cout: '2600', note: 'sick', skipped: true };
    const log = logFromForm(st, p, f);
    expect(log).toEqual({ skipped: true, cin: 2100, cout: 2600, note: 'sick' });
    expect(calorieSummary(stateWith({ '2026-10-06': { ...log, submitted: true } })).total).toBe(500);
  });
  it('a skip can be submitted with nothing else', () => {
    const p = planFor(START, '2026-10-06')!;
    const log = logFromForm(st, p, { ...formFromLog(st, p, undefined), skipped: true });
    expect(submitError(p, log)).toBeNull();
  });
  it('round-trips through the form and can be undone', () => {
    const p = planFor(START, '2026-10-05')!;
    const f = formFromLog(st, p, { submitted: true, skipped: true, cin: 2000 });
    expect(f.skipped).toBe(true);
    expect(logFromForm(st, p, { ...f, skipped: false }).skipped).toBeUndefined();
  });
  it('rest days ignore skip', () => {
    const p = planFor(START, '2026-10-10')!;
    expect(logFromForm(st, p, { ...formFromLog(st, p, undefined), skipped: true }).skipped).toBeUndefined();
  });
  it('progress counts skipped separately from missed', () => {
    const s = stateWith({ '2026-10-05': { submitted: true, skipped: true } });
    const ps = progressStats(s, '2026-10-08');
    expect(ps.skipped).toBe(1);
    expect(ps.missedOrPartial).toBe(2); // Tue, Wed
    expect(ps.planned).toBe(3);
  });
});

describe('rest day workouts', () => {
  const TODAY = '2026-10-20';
  const st = defaultState();
  const SAT = '2026-10-10'; // week 1 rest day
  const sat = planFor(START, SAT)!;

  it('pick any workout: uses this week\'s miles/weights and normal status rules', () => {
    const f = { ...formFromLog(st, sat, undefined), swap: 'long' as const, miles: '7' };
    expect(formPlan(st, sat, f)).toMatchObject({ type: 'long', miles: 7, w: 0, swapped: true });
    const log = logFromForm(st, sat, f);
    expect(log).toEqual({ swap: 'long', miles: 7 });
    expect(submitError(sat, log)).toBeNull();
    const s = stateWith({ [SAT]: { ...log, submitted: true } });
    expect(effectivePlan(s, SAT)!.type).toBe('long');
    expect(status(s, SAT, TODAY)).toBe('done');
  });

  it('a swapped run needs miles or calories like any run day', () => {
    const f = { ...formFromLog(st, sat, undefined), swap: 'easy' as const };
    expect(submitError(sat, logFromForm(st, sat, f))).toBe('Enter your miles or calories first.');
  });

  it('a lift swap logs that day\'s lifts at target weights', () => {
    const f = { ...formFromLog(st, sat, undefined), swap: 'legs' as const };
    const log = logFromForm(st, sat, f);
    expect(log.swap).toBe('legs');
    expect(Object.keys(log.lifts!)).toEqual(['lpress', 'rdl', 'lcurl', 'lext']);
    expect(log.lifts!.lpress).toEqual({ w: 7, done: false });
  });

  it('moving a skipped workout links it and shows the skipped day as moved', () => {
    const logs = { '2026-10-11': { submitted: true, skipped: true } }; // Sun long run skipped
    const s0 = stateWith(logs);
    expect(makeupCandidates(s0, SAT).map((m) => m.s)).toEqual(['2026-10-11']);
    const f = { ...formFromLog(s0, sat, undefined), makeupFor: '2026-10-11', swap: 'long' as const, miles: '7' };
    const log = logFromForm(s0, sat, f);
    expect(log).toEqual({ swap: 'long', makeupFor: '2026-10-11', miles: 7 });
    const s = stateWith({ ...logs, [SAT]: { ...log, submitted: true } });
    expect(madeUpBy(s, '2026-10-11')).toBe(SAT);
    expect(status(s, '2026-10-11', TODAY)).toBe('moved');
    expect(status(s, SAT, TODAY)).toBe('done');
    // the long run chart counts it for that week
    expect(weeklyRunRows(s).long[0].actual).toBe(7);
  });

  it('a makeup uses the original day\'s week for weights and miles', () => {
    const s0 = stateWith({ '2026-10-26': { submitted: true, skipped: true } }); // W4 Mon push
    const restW3 = planFor(START, '2026-10-24')!; // W3 Sat
    const p = formPlan(s0, restW3, { ...formFromLog(s0, restW3, undefined), makeupFor: '2026-10-26', swap: 'push' });
    expect(p.w).toBe(3);
    expect(targetFor(s0.base, 'ohp', p.w)).toBe(45);
  });

  it('progress: moved day is not counted; the rest-day workout is', () => {
    const s = stateWith({
      '2026-10-11': { submitted: true, skipped: true },
      [SAT]: { submitted: true, swap: 'long', makeupFor: '2026-10-11', miles: 7 },
    });
    const ps = progressStats(s, '2026-10-11');
    expect(ps.skipped).toBe(0);
    // Mon-Fri missed (5) + Sat done; Sun moved -> not counted
    expect(ps.done).toBe(1);
    expect(ps.planned).toBe(6);
  });

  it('a skip already made up elsewhere is not offered again; going back to rest clears it', () => {
    const s = stateWith({
      '2026-10-11': { submitted: true, skipped: true },
      '2026-10-17': { submitted: true, swap: 'long', makeupFor: '2026-10-11' },
    });
    expect(makeupCandidates(s, SAT)).toEqual([]);
    expect(makeupCandidates(s, '2026-10-17').map((m) => m.s)).toEqual(['2026-10-11']);
    const f = { ...formFromLog(s, sat, undefined), swap: '' as const, makeupFor: '', cin: '2000' };
    expect(logFromForm(s, sat, f)).toEqual({ cin: 2000 });
  });
});

describe('doing a different workout on a scheduled day', () => {
  const TODAY = '2026-10-20';
  const st = defaultState();
  const THU = '2026-10-08'; // week 1 legs day
  const thu = planFor(START, THU)!;

  it('a run instead of legs logs the miles and counts as done', () => {
    const f = { ...formFromLog(st, thu, undefined), swap: 'easy' as const, miles: '6' };
    expect(formPlan(st, thu, f)).toMatchObject({ type: 'easy', miles: 3, w: 0, swapped: true });
    const log = logFromForm(st, thu, f);
    expect(log).toEqual({ swap: 'easy', miles: 6 });
    expect(submitError(thu, log)).toBeNull();
    const s = stateWith({ [THU]: { ...log, submitted: true } });
    expect(effectivePlan(s, THU)!.type).toBe('easy');
    expect(status(s, THU, TODAY)).toBe('done');
    expect(progressStats(s, TODAY).miles).toBe(6);
  });

  it('a different lift group logs that group\'s lifts', () => {
    const log = logFromForm(st, thu, { ...formFromLog(st, thu, undefined), swap: 'push' });
    expect(log.swap).toBe('push');
    expect(Object.keys(log.lifts!)).toEqual(['tri', 'bench', 'skull', 'peck', 'ohp']);
  });

  it('picking the scheduled type (or nothing) is not a swap', () => {
    expect(formPlan(st, thu, { ...formFromLog(st, thu, undefined), swap: 'legs' }).swapped).toBeUndefined();
    expect(logFromForm(st, thu, { ...formFromLog(st, thu, undefined), swap: 'legs' }).swap).toBeUndefined();
  });

  it('a swap wins over a stale skip flag', () => {
    const log = logFromForm(st, thu, { ...formFromLog(st, thu, undefined), swap: 'easy', miles: '6', skipped: true });
    expect(log).toEqual({ swap: 'easy', miles: 6 });
  });

  it('a workout day never makes up another day', () => {
    const s0 = stateWith({ '2026-10-05': { submitted: true, skipped: true } });
    const p = formPlan(s0, thu, { ...formFromLog(s0, thu, undefined), makeupFor: '2026-10-05', swap: 'push' });
    expect(p.makeupFor).toBeUndefined();
    expect(p.type).toBe('push');
  });
});
