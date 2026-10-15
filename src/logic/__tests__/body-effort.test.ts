import { describe, expect, it } from '@jest/globals';

import {
  DEFAULT_HOME,
  EMPTY_CARDIO,
  addDays,
  cleanSleep,
  cleanSteps,
  cleanWater,
  cleanWeight,
  dailyEffort,
  defaultState,
  fmtSleep,
  hrWeight,
  loadStatus,
  maxHrFor,
  normalize,
  normalizeHome,
  parseSleep,
  recentAverage,
  sessionEffort,
  trainingLoad,
  visibleWidgets,
  weeklyEffort,
  weightChange,
  weightSeries,
  weightTrend,
  type CardioData,
  type CardioSession,
  type DayInfo,
  type Profile,
} from '..';

const TODAY = '2026-10-14';

const run = (date: string, secs: number, extra: Partial<CardioSession> = {}): CardioSession => ({
  id: `r${date}${secs}${Math.random()}`,
  date,
  type: 'run',
  miles: secs / 600,
  secs,
  ...extra,
});
const cardio = (...sessions: CardioSession[]): CardioData => ({ ...EMPTY_CARDIO, sessions, skips: [] });

describe('body log: reading what people type', () => {
  it('reads sleep in the ways people write it', () => {
    expect(parseSleep('7:30')).toBe(450);
    expect(parseSleep('7h 30m')).toBe(450);
    expect(parseSleep('7h30')).toBe(450);
    expect(parseSleep('7h')).toBe(420);
    expect(parseSleep('7.5')).toBe(450);
    expect(parseSleep('7.5h')).toBe(450);
    expect(parseSleep('90m')).toBe(90);
    expect(parseSleep('8')).toBe(480);
  });

  it('refuses sleep that is empty, unreadable, zero, or over a day', () => {
    expect(parseSleep('')).toBeNull();
    expect(parseSleep(null)).toBeNull();
    expect(parseSleep('abc')).toBeNull();
    expect(parseSleep('0')).toBeNull();
    expect(parseSleep('25')).toBeNull();
    expect(parseSleep('7:75')).toBeNull();
    expect(parseSleep('24')).toBe(1440);
  });

  it('shows sleep as hours and minutes', () => {
    expect(fmtSleep(450)).toBe('7h 30m');
    expect(fmtSleep(480)).toBe('8h');
    expect(fmtSleep(45)).toBe('45m');
  });

  it('keeps believable values and drops typos', () => {
    expect(cleanWeight(180.46)).toBe(180.5);
    expect(cleanWeight(18)).toBeUndefined();
    expect(cleanWeight(1800)).toBeUndefined();
    expect(cleanWeight('abc')).toBeUndefined();
    expect(cleanWeight(null)).toBeUndefined();
    expect(cleanWater(64.4)).toBe(64);
    expect(cleanWater(0)).toBeUndefined();
    expect(cleanWater(5000)).toBeUndefined();
    expect(cleanSleep(450)).toBe(450);
    expect(cleanSleep(2000)).toBeUndefined();
    expect(cleanSteps(8234.6)).toBe(8235);
    expect(cleanSteps(-5)).toBeUndefined();
    expect(cleanSteps(1_000_000)).toBeUndefined();
  });

  it('is kept, cleaned, when saved data is loaded', () => {
    const s = normalize({
      v: 2,
      days: {
        '2026-10-13': { weightLb: 181.2, waterOz: 48, sleepMins: 440, steps: 9100 },
        '2026-10-14': { weightLb: 5, waterOz: 99999, sleepMins: 0, steps: 'lots' },
      },
    });
    expect(s.days['2026-10-13']).toEqual({ weightLb: 181.2, waterOz: 48, sleepMins: 440, steps: 9100 });
    // Everything on that day was a typo, so the day isn't kept at all.
    expect(s.days['2026-10-14']).toBeUndefined();
  });
});

describe('body log: averages and weight trend', () => {
  const days: Record<string, DayInfo> = {
    '2026-10-14': { sleepMins: 480, steps: 10000 },
    '2026-10-13': { sleepMins: 420 },
    '2026-10-12': { steps: 6000 },
    '2026-10-01': { sleepMins: 60 },
    '2026-10-15': { sleepMins: 999 },
  };

  it('averages only the days in the window that have a value', () => {
    expect(recentAverage(days, 'sleepMins', TODAY, 7)).toEqual({ avg: 450, logged: 2 });
    expect(recentAverage(days, 'steps', TODAY, 7)).toEqual({ avg: 8000, logged: 2 });
    expect(recentAverage(days, 'waterOz', TODAY, 7)).toEqual({ avg: null, logged: 0 });
  });

  it('lists weights oldest first, inside the window', () => {
    const d: Record<string, DayInfo> = {
      '2026-10-14': { weightLb: 180 },
      '2026-10-10': { weightLb: 182 },
      '2026-05-01': { weightLb: 200 },
      '2026-10-20': { weightLb: 150 },
    };
    expect(weightSeries(d, TODAY, 90)).toEqual([
      { s: '2026-10-10', v: 182 },
      { s: '2026-10-14', v: 180 },
    ]);
  });

  it('smooths weight over the week up to each day', () => {
    const t = weightTrend([
      { s: '2026-10-01', v: 184 },
      { s: '2026-10-03', v: 182 },
      { s: '2026-10-08', v: 180 },
    ]);
    expect(t[0].v).toBe(184);
    expect(t[1].v).toBe(183);
    // Oct 1 is 7 days before Oct 8, outside the window; Oct 3 is inside.
    expect(t[2].v).toBe(181);
  });

  it('reports the change in the trend, once there is enough history', () => {
    expect(weightChange([{ s: '2026-10-14', v: 180 }], 28)).toBeNull();
    const s = Array.from({ length: 5 }, (_, i) => ({ s: addDays('2026-09-01', i * 7), v: 190 - i * 2 }));
    // Each weekly weight is alone in its 7-day window, so the trend equals the weights: 190, 188, 186, 184, 182.
    expect(weightChange(s, 28)).toBe(-8);
    expect(weightChange(s, 90)).toBeNull();
  });
});

describe('effort of a session', () => {
  it('weights heart rate from half of max (1) to max (5)', () => {
    expect(hrWeight(95, 190)).toBeCloseTo(1, 5);
    expect(hrWeight(133, 190)).toBeCloseTo(3, 5);
    expect(hrWeight(171, 190)).toBeCloseTo(5, 5);
    expect(hrWeight(190, 190)).toBe(5);
    expect(hrWeight(60, 190)).toBe(1);
  });

  it('uses heart rate first', () => {
    // An hour at 70% of a 190 max is weight 3: 180 points.
    expect(sessionEffort(run('2026-10-10', 3600, { hr: 133 }), 190)).toEqual({ score: 180, basis: 'hr' });
    expect(sessionEffort(run('2026-10-10', 3600, { hr: 133, rpe: 10 }), 190)?.basis).toBe('hr');
  });

  it('falls back to how it felt, then to the sport', () => {
    expect(sessionEffort(run('2026-10-10', 1800, { rpe: 6 }), 190)).toEqual({ score: 90, basis: 'rpe' });
    expect(sessionEffort(run('2026-10-10', 3600), 190)).toEqual({ score: 180, basis: 'time' });
    expect(sessionEffort(run('2026-10-10', 3600, { type: 'walk' }), 190)).toEqual({ score: 90, basis: 'time' });
  });

  it('needs a time to go on', () => {
    expect(sessionEffort({ id: 'x', date: '2026-10-10', type: 'run', miles: 3 }, 190)).toBeNull();
  });

  it('estimates max heart rate from age, raised to what has actually been logged', () => {
    const p: Profile = { birthday: '1990-01-01' };
    // 36 years old: 208 - 0.7 x 36
    expect(maxHrFor(p, EMPTY_CARDIO, TODAY)).toBeCloseTo(182.8, 5);
    expect(maxHrFor(p, cardio(run('2026-10-01', 1800, { maxHr: 195 })), TODAY)).toBe(195);
    // A glitchy reading above 220 isn't believed.
    expect(maxHrFor(p, cardio(run('2026-10-01', 1800, { maxHr: 238 })), TODAY)).toBeCloseTo(182.8, 5);
    expect(maxHrFor(null, EMPTY_CARDIO, TODAY)).toBe(190);
  });

  it('adds up a day and ignores the future', () => {
    const c = cardio(run('2026-10-10', 1800), run('2026-10-10', 1800), run('2026-10-20', 3600));
    const per = dailyEffort(c, null, TODAY);
    expect(per.get('2026-10-10')).toBe(180);
    expect(per.has('2026-10-20')).toBe(false);
  });

  it('totals each of the last weeks, Monday to Sunday', () => {
    // Oct 14, 2026 is a Wednesday, so this week began Monday Oct 12.
    const c = cardio(run('2026-10-12', 3600), run('2026-10-13', 3600), run('2026-10-05', 1200));
    const w = weeklyEffort(c, null, TODAY, 3);
    expect(w.map((x) => x.start)).toEqual(['2026-09-28', '2026-10-05', '2026-10-12']);
    // 20 minutes of running is 60 points; two hours-long runs this week are 180 each.
    expect(w.map((x) => x.effort)).toEqual([0, 60, 360]);
  });
});

describe('fitness and fatigue', () => {
  it('is empty with nothing timed logged', () => {
    expect(trainingLoad(EMPTY_CARDIO, null, TODAY)).toEqual([]);
    expect(trainingLoad(cardio({ id: 'x', date: '2026-10-10', type: 'run', miles: 3 }), null, TODAY)).toEqual([]);
  });

  it('rises faster for short-term fatigue than long-term fitness after one session', () => {
    const [d] = trainingLoad(cardio(run(TODAY, 3600)), null, TODAY);
    // 180 points on day one: 180 x (1 - e^(-1/42)) and 180 x (1 - e^(-1/7)).
    expect(d.effort).toBe(180);
    expect(d.fitness).toBeCloseTo(180 * (1 - Math.exp(-1 / 42)), 6);
    expect(d.fatigue).toBeCloseTo(180 * (1 - Math.exp(-1 / 7)), 6);
    expect(d.fatigue).toBeGreaterThan(d.fitness);
  });

  it('returns the last N days, ending today', () => {
    const c = cardio(run(addDays(TODAY, -200), 3600));
    const s = trainingLoad(c, null, TODAY, 30);
    expect(s).toHaveLength(30);
    expect(s[29].s).toBe(TODAY);
    expect(s[0].s).toBe(addDays(TODAY, -29));
  });

  it('says nothing until there are three weeks of history', () => {
    const tenDays = Array.from({ length: 10 }, (_, i) => run(addDays(TODAY, -9 + i), 3600));
    expect(loadStatus(trainingLoad(cardio(...tenDays), null, TODAY))).toBeNull();
  });

  it('reads steady training as steady', () => {
    const c = cardio(...Array.from({ length: 120 }, (_, i) => run(addDays(TODAY, -119 + i), 3600)));
    const st = loadStatus(trainingLoad(c, null, TODAY));
    expect(st?.id).toBe('steady');
    expect(st!.ratio).toBeGreaterThan(0.95);
    expect(st!.ratio).toBeLessThan(1.1);
  });

  it('notices a rest after steady training', () => {
    const c = cardio(...Array.from({ length: 110 }, (_, i) => run(addDays(TODAY, -119 + i), 3600)));
    expect(loadStatus(trainingLoad(c, null, TODAY))?.id).toBe('rested');
  });

  it('flags a sudden jump after a quiet stretch', () => {
    const quiet = Array.from({ length: 9 }, (_, i) => run(addDays(TODAY, -70 + i * 7), 3600));
    const burst = Array.from({ length: 7 }, (_, i) => run(addDays(TODAY, -6 + i), 3600));
    const st = loadStatus(trainingLoad(cardio(...quiet, ...burst), null, TODAY));
    expect(st?.id).toBe('fast');
  });
});

describe('home cards for the body log', () => {
  it('leaves everyone’s existing Home as it was', () => {
    expect(DEFAULT_HOME).toEqual(['workout', 'calories', 'protein', 'week']);
    expect(normalizeHome(['workout', 'water', 'weight', 'nope'])).toEqual(['workout', 'water', 'weight']);
  });

  it('shows body cards whatever tabs are on, and drops the old training load card', () => {
    const s = defaultState();
    const home = ['weight', 'water', 'sleep', 'steps'] as const;
    expect(visibleWidgets([...home], { ...s.settings.sections, cardio: false })).toEqual([...home]);
    expect(normalizeHome(['weight', 'load'])).toEqual(['weight']);
  });
});
