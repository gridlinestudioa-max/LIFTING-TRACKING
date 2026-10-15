import { describe, expect, it } from '@jest/globals';

import { CYCLE_PRESETS, activeCycle, countdown, fastSecondsLeft, window24, bmr, calTarget, cycleStatus, dayProgress, defaultState, kcalInfo, normalize, onTarget, planFor, startCycle, tdee, type DayLog, type Stats } from '..';

const man: Stats = { sex: 'male', age: 30, heightIn: 70, weightLb: 180, activity: 'moderate', goal: 'maintain' };
const small: Stats = { sex: 'female', age: 40, heightIn: 61, weightLb: 118, activity: 'sedentary', goal: 'maintain' };
const preset = (id: string) => CYCLE_PRESETS.find((p) => p.id === id)!;

describe('cut and bulk plans', () => {
  it('works out a standard cut from body weight', () => {
    const p = planFor(preset('cut-standard'), man);
    // 0.75% of 180 lb = 1.35 lb a week = 675 kcal a day, rounded to 670.
    expect(p.delta).toBe(-670);
    expect(p.intake).toBe(Math.round((Math.round(tdee(man) / 10) * 10 - 670) / 10) * 10);
    expect(p.proteinG).toBeLessThanOrEqual(180);
    expect(p.blocked).toBeNull();
  });

  it('never goes below the safe minimum or resting burn, or past 25% of burn', () => {
    for (const p of CYCLE_PRESETS.filter((x) => x.kind === 'cut')) {
      const plan = planFor(p, small);
      if (plan.blocked) continue;
      expect(plan.intake).toBeGreaterThanOrEqual(Math.max(1200, Math.round(bmr(small) / 10) * 10));
      expect(-plan.delta).toBeLessThanOrEqual(0.25 * plan.burn + 10);
    }
  });

  it('blocks a cut when underweight and a bulk at a BMI of 30 or more', () => {
    expect(planFor(preset('cut-gentle'), { ...man, weightLb: 120 }).blocked).toMatch(/healthy range/);
    expect(planFor(preset('bulk-lean'), { ...man, weightLb: 230 }).blocked).toMatch(/healthier/);
  });

  it('caps a bulk at 500 kcal over', () => {
    expect(planFor(preset('bulk-standard'), { ...man, weightLb: 210, heightIn: 76 }).delta).toBeLessThanOrEqual(500);
  });

  it('sets the calorie target while it runs, and tracks progress', () => {
    const s = defaultState();
    s.goal = 300;
    s.cycle = startCycle(planFor(preset('cut-gentle'), man), man, '2026-10-01');
    expect(calTarget(s, '2026-10-15')).toBe(-s.cycle.delta);
    expect(calTarget(s, '2027-06-01')).toBe(300);
    expect(activeCycle(s.cycle, '2026-12-23')).not.toBeNull();
    expect(activeCycle(s.cycle, '2026-12-24')).toBeNull();
    const st = cycleStatus(s.cycle, '2026-10-15', 178.4);
    expect(st.week).toBe(3);
    expect(st.verdict).toBe('On track');
    // Survives a save and load.
    expect(normalize(JSON.parse(JSON.stringify(s))).cycle).toEqual(s.cycle);
  });
});

describe('calorie targets', () => {
  it('reads deficit, surplus and maintenance targets', () => {
    expect(onTarget(600, 500)).toBe(true);
    expect(onTarget(400, 500)).toBe(false);
    expect(onTarget(-300, -250)).toBe(true);
    expect(onTarget(-700, -250)).toBe(false);
    expect(onTarget(-100, -250)).toBe(false);
    expect(onTarget(150, 0)).toBe(true);
    expect(kcalInfo(2000, 2500, 500).text).toBe('Deficit: 500 kcal · on target ✓');
    expect(kcalInfo(2800, 2500, -250).text).toBe('Surplus: 300 kcal · on target ✓');
  });
});

describe('day progress', () => {
  const day = (s: string, cardio: string | null, lift: string | null, n: number | null = null) =>
    ({ s, cardio: cardio ? { mark: cardio } : null, lift: lift ? { mark: lift } : null, net: n }) as unknown as DayLog;
  it('says whether everything was done', () => {
    expect(dayProgress(day('2026-10-10', 'done', 'done'), '2026-10-15', null).result).toBe('all');
    expect(dayProgress(day('2026-10-10', 'done', 'missed'), '2026-10-15', null)).toEqual({ total: 2, done: 1, result: 'some' });
    expect(dayProgress(day('2026-10-10', 'missed', null), '2026-10-15', null).result).toBe('missed');
    expect(dayProgress(day('2026-10-15', 'planned', null), '2026-10-15', null).result).toBe('planned');
    expect(dayProgress(day('2026-10-10', null, null), '2026-10-15', null).result).toBe('rest');
    // Food counts from the first day calories were logged: off target, or not logged, isn't done.
    const food = { target: 500, since: '2026-10-01' };
    expect(dayProgress(day('2026-10-10', 'done', null, 100), '2026-10-15', food)).toEqual({ total: 2, done: 1, result: 'some' });
    expect(dayProgress(day('2026-10-10', 'done', null), '2026-10-15', food)).toEqual({ total: 2, done: 1, result: 'some' });
    expect(dayProgress(day('2026-10-10', 'done', null, 600), '2026-10-15', food).result).toBe('all');
    // Before you started logging food, workouts alone decide it.
    expect(dayProgress(day('2026-09-20', 'done', null), '2026-10-15', food).result).toBe('all');
    // No target: logging calories is enough.
    expect(dayProgress(day('2026-10-10', 'done', null, -300), '2026-10-15', { target: null, since: '2026-10-01' }).result).toBe('all');
  });
});

describe('fasting countdown', () => {
  it('shows the window in 24-hour time and counts down to the next change', () => {
    const f = { eatHours: 8, start: 12 * 60 };
    expect(window24(f)).toBe('12:00–20:00');
    expect(window24({ eatHours: 6, start: 20 * 60 })).toBe('20:00–02:00');
    // 16:17:45: open, 3 h 42 min 15 s left.
    expect(fastSecondsLeft(f, 16 * 3600 + 17 * 60 + 45)).toEqual({ open: true, secs: 3 * 3600 + 42 * 60 + 15 });
    expect(countdown(3 * 3600 + 42 * 60 + 15)).toBe('3:42:15');
    // 10:00:00: fasting, 2 h until it opens.
    expect(fastSecondsLeft(f, 10 * 3600)).toEqual({ open: false, secs: 7200 });
  });
});
