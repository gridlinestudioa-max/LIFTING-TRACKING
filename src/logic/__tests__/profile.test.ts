import { describe, expect, it } from '@jest/globals';

import {
  DEFAULT_DIET,
  activeDiet,
  bmr,
  calorieTarget,
  defaultState,
  dietName,
  editOwnLimits,
  evaluateDay,
  heightText,
  normalize,
  normalizeDiet,
  profileError,
  suggestTargets,
  tdee,
  withStyle,
  type Profile,
} from '..';

// 30-year-old man, 5 ft 10 in, 180 lb, moderately active, losing weight.
const him: Profile = { sex: 'male', age: 30, heightIn: 70, weightLb: 180, activity: 'moderate', goal: 'lose' };
// 35-year-old woman, 5 ft 4 in, 140 lb, sedentary, losing weight.
const her: Profile = { sex: 'female', age: 35, heightIn: 64, weightLb: 140, activity: 'sedentary', goal: 'lose' };

describe('calories', () => {
  it('Mifflin-St Jeor resting burn', () => {
    // 10 × 81.65 kg + 6.25 × 177.8 cm − 5 × 30 + 5 = 1,782.6
    expect(bmr(him)).toBeCloseTo(1782.6, 0);
    // 10 × 63.5 + 6.25 × 162.56 − 175 − 161 = 1,315.0
    expect(bmr(her)).toBeCloseTo(1315.0, 0);
  });

  it('activity and goal', () => {
    expect(tdee(him)).toBeCloseTo(1782.6 * 1.55, 0); // 2,763
    expect(calorieTarget(him)).toBe(2260); // 2,763 − 500, rounded to 10
    expect(calorieTarget({ ...him, goal: 'maintain' })).toBe(2760);
    expect(calorieTarget({ ...him, goal: 'gain' })).toBe(3010);
  });

  it('never suggests below the safe minimum', () => {
    // 1,315 × 1.2 − 500 = 1,078, raised to 1,200.
    expect(calorieTarget(her)).toBe(1200);
    expect(suggestTargets(her, 'none').why.kcalMax).toMatch(/safe minimum of 1,200/);
  });
});

describe('suggested targets by diet', () => {
  it('standard', () => {
    const t = suggestTargets(him, 'none').limits;
    expect(t.kcalMax).toBe(2260);
    expect(t.proteinMin).toBe(130); // 1.6 × 81.65 kg = 130.6
    expect(t.netCarbsMax).toBe(365); // 65% of 2,260 / 4 = 367
    expect(t.sugarMax).toBe(100); // 90 × 2,260 / 2,000 = 101.7
    expect(t.fatPctMax).toBe(35);
  });

  it('change with the diet', () => {
    expect(suggestTargets(him, 'keto').limits).toEqual({ kcalMax: 2260, proteinMin: 130, netCarbsMax: 20 });
    expect(suggestTargets(him, 'lowcarb').limits.netCarbsMax).toBe(115); // 20% of 2,260 / 4 = 113
    expect(suggestTargets(him, 'highprotein').limits.proteinMin).toBe(180); // 2.2 g/kg
    expect(suggestTargets(him, 'vegan').limits.proteinMin).toBe(145); // 1.76 g/kg
    expect(suggestTargets(him, 'lowfat').limits.fatPctMax).toBe(25);
  });

  it('less protein when less active', () => {
    expect(suggestTargets(her, 'none').limits.proteinMin).toBe(65); // 1.0 × 63.5 kg
  });
});

describe('suggested vs your own numbers', () => {
  it('suggested targets are the default once there is a profile', () => {
    const d = withStyle(DEFAULT_DIET, 'keto');
    expect(d.auto).toBe(true);
    expect(activeDiet(d, null).limits).toEqual({ netCarbsMax: 20 }); // no profile: the preset
    expect(activeDiet(d, him).limits).toEqual(suggestTargets(him, 'keto').limits);
    expect(dietName(d, him)).toBe('Keto · suggested targets');
  });

  it('editing starts from the suggestions and keeps your numbers', () => {
    const d = editOwnLimits(withStyle(DEFAULT_DIET, 'none'), him);
    expect(d.auto).toBe(false);
    expect(d.limits).toEqual(suggestTargets(him, 'none').limits);
    const mine = { ...d, limits: { ...d.limits, kcalMax: 2000 } };
    expect(activeDiet(mine, him).limits.kcalMax).toBe(2000);
    expect(dietName(mine, him)).toBe('your own targets');
  });

  it('the day is checked against the suggested numbers', () => {
    const d = withStyle(DEFAULT_DIET, 'none');
    // No food rules at all without a profile; with one, calories and protein are checked.
    expect(evaluateDay(activeDiet(d, null), [], true).checks).toEqual([]);
    const keys = evaluateDay(activeDiet(d, him), [], true).checks.map((c) => c.key);
    expect(keys).toEqual(['kcalMax', 'netCarbsMax', 'sugarMax', 'proteinMin', 'fatPctMax']);
  });

  it('diets saved before suggestions keep their numbers', () => {
    expect(normalizeDiet({ style: 'keto', limits: { netCarbsMax: 30 } }).auto).toBe(false);
    expect(normalizeDiet(undefined).auto).toBe(true);
  });
});

describe('profile', () => {
  it('validates', () => {
    expect(profileError(him)).toBeNull();
    expect(profileError({ ...him, age: 16 })).toMatch(/adults/);
    expect(profileError({ ...him, heightIn: 30 })).toMatch(/height/);
    expect(profileError({ ...him, weightLb: NaN })).toMatch(/weight/);
    expect(profileError({ ...him, sex: undefined })).toMatch(/male or female/);
  });

  it('saves and restores', () => {
    const st = defaultState();
    expect(st.profile).toBeNull();
    st.profile = him;
    expect(normalize(JSON.parse(JSON.stringify(st))).profile).toEqual(him);
    expect(normalize({ profile: { ...him, age: 'old' } }).profile).toBeNull();
  });

  it('formats height', () => {
    expect(heightText(70)).toBe('5 ft 10 in');
    expect(heightText(71.6)).toBe('6 ft 0 in');
  });
});
