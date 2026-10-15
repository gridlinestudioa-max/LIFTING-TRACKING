// Cutting, bulking and maintenance phases: a daily calorie target worked out from what you burn, a protein
// target, and how fast your weight should move. Pure logic, no React.
//
// The plans stay inside widely used, conservative ranges:
//   - Losing 0.5 to 1% of body weight a week, and never more than 1,000 kcal a day under, or 25% of what you
//     burn; never eating below the larger of your resting burn and 1,200 (women) / 1,500 (men) kcal.
//   - Gaining 0.25 to 0.5% a week, no more than 500 kcal a day over (most of a faster gain is fat).
//   - Protein 1.6 to 2.2 g per kg of body weight (more while cutting, to keep muscle).
//   - Cuts of up to 12 weeks, then a maintenance break. No cut when underweight; no bulk when the BMI is
//     30 or more.
// It's general guidance for healthy adults, not medical advice.

import { addDays, dayDiff } from './dates';
import { fmt, fmtInt } from './format';
import { MIN_KCAL, bmr, kgOf, tdee, type Stats } from './profile';

export type CycleKind = 'cut' | 'maintain' | 'bulk';

export type CyclePresetId = 'cut-gentle' | 'cut-standard' | 'cut-mini' | 'maintain' | 'diet-break' | 'bulk-lean' | 'bulk-standard';

export interface CyclePreset {
  id: CyclePresetId;
  kind: CycleKind;
  name: string;
  blurb: string;
  /** Weight change a week, as a percent of body weight (negative to lose). */
  ratePct: number;
  weeks: number;
  /** Protein, g per kg of body weight. */
  proteinPerKg: number;
}

export const CYCLE_PRESETS: CyclePreset[] = [
  { id: 'cut-gentle', kind: 'cut', name: 'Gentle cut', blurb: 'Slow and easy to stick to. Best for keeping muscle and energy for training.', ratePct: -0.5, weeks: 12, proteinPerKg: 2.0 },
  { id: 'cut-standard', kind: 'cut', name: 'Standard cut', blurb: 'A steady pace most people can keep up while still training hard.', ratePct: -0.75, weeks: 10, proteinPerKg: 2.2 },
  { id: 'cut-mini', kind: 'cut', name: 'Mini cut', blurb: 'A short, faster cut to trim down between bulks. Keep it short.', ratePct: -1, weeks: 4, proteinPerKg: 2.2 },
  { id: 'maintain', kind: 'maintain', name: 'Maintain', blurb: 'Eat what you burn. Good for recomposition: building muscle while staying the same weight.', ratePct: 0, weeks: 8, proteinPerKg: 1.8 },
  { id: 'diet-break', kind: 'maintain', name: 'Diet break', blurb: 'Two weeks at maintenance after a cut, to recover before cutting again or bulking.', ratePct: 0, weeks: 2, proteinPerKg: 1.8 },
  { id: 'bulk-lean', kind: 'bulk', name: 'Lean bulk', blurb: 'A small surplus to build muscle with as little fat gain as possible.', ratePct: 0.25, weeks: 16, proteinPerKg: 1.8 },
  { id: 'bulk-standard', kind: 'bulk', name: 'Bulk', blurb: 'A bit faster. Suits newer lifters who can build muscle quickly.', ratePct: 0.5, weeks: 12, proteinPerKg: 1.8 },
];

export const CYCLE_KIND_LABEL: Record<CycleKind, string> = { cut: 'Cut', maintain: 'Maintain', bulk: 'Bulk' };

/** A phase you're on. */
export interface Cycle {
  preset: CyclePresetId;
  kind: CycleKind;
  start: string;
  weeks: number;
  startWeightLb: number;
  /** Calories to eat a day. */
  intake: number;
  /** Calories a day versus what you burn: negative under (cut), positive over (bulk). */
  delta: number;
  proteinG: number;
}

export interface CyclePlan {
  preset: CyclePreset;
  /** Why this plan isn't offered right now, or null. */
  blocked: string | null;
  burn: number;
  intake: number;
  delta: number;
  proteinG: number;
  /** Expected change a week, lb (negative to lose). */
  weeklyLb: number;
  endWeightLb: number;
  /** Things the numbers were adjusted for. */
  notes: string[];
}

const BMI = (s: Stats) => (703 * s.weightLb) / (s.heightIn * s.heightIn);
const r10 = (v: number) => Math.round(v / 10) * 10;

/** A preset worked out for someone, with the safety limits applied. */
export function planFor(preset: CyclePreset, s: Stats): CyclePlan {
  const burn = r10(tdee(s));
  const bmi = BMI(s);
  const notes: string[] = [];
  let blocked: string | null = null;
  if (preset.kind === 'cut' && bmi < 18.5) blocked = 'Your weight is already under the healthy range for your height, so a cut isn’t recommended. Try Maintain or a Lean bulk.';
  if (preset.kind === 'bulk' && bmi >= 30) blocked = 'At your current weight, maintaining or a gentle cut is the healthier place to start.';

  let delta = (((preset.ratePct / 100) * s.weightLb) * 3500) / 7;
  if (preset.kind === 'cut') {
    const most = Math.min(1000, 0.25 * burn);
    if (-delta > most) {
      delta = -most;
      notes.push(`Kept to ${fmtInt(r10(most))} kcal a day under, the most that’s sensible for you.`);
    }
    const floor = Math.max(MIN_KCAL[s.sex], r10(bmr(s)));
    if (burn + delta < floor) {
      delta = floor - burn;
      notes.push(`Raised so you eat at least ${fmtInt(floor)} kcal a day.`);
    }
    if (delta > -150 && !blocked) blocked = 'You’re already eating close to the safe minimum for your size, so a cut wouldn’t do much. Try Maintain.';
  }
  if (preset.kind === 'bulk' && delta > 500) {
    delta = 500;
    notes.push('Kept to 500 kcal a day over: a bigger surplus mostly adds fat.');
  }
  delta = r10(delta);
  const intake = r10(burn + delta);
  // Protein: never more than 1 g per lb, which is plenty for anyone.
  const proteinG = Math.round(Math.min(kgOf(s.weightLb) * preset.proteinPerKg, s.weightLb) / 5) * 5;
  const weeklyLb = (delta * 7) / 3500;
  if (preset.kind === 'cut' && preset.weeks > 4) notes.push('After the cut, spend at least two weeks at maintenance (a diet break).');
  return { preset, blocked, burn, intake, delta, proteinG, weeklyLb, endWeightLb: Math.round((s.weightLb + weeklyLb * preset.weeks) * 10) / 10, notes };
}

export function startCycle(plan: CyclePlan, s: Stats, start: string): Cycle {
  return { preset: plan.preset.id, kind: plan.preset.kind, start, weeks: plan.preset.weeks, startWeightLb: s.weightLb, intake: plan.intake, delta: plan.delta, proteinG: plan.proteinG };
}

export const cycleEnd = (c: Cycle) => addDays(c.start, c.weeks * 7 - 1);

/** The phase in force today, or null when there isn't one (or it's over). */
export function activeCycle(c: Cycle | null, today: string): Cycle | null {
  return c && today >= c.start && today <= cycleEnd(c) ? c : null;
}

export interface CycleStatus {
  week: number;
  daysLeft: number;
  /** Where your weight should be by now, lb. */
  expectedLb: number;
  /** Your smoothed weight now, or null without weigh-ins. */
  trendLb: number | null;
  /** "On track", "Losing faster than planned", ... */
  verdict: string | null;
}

/** How a phase is going. `trendLb` is your smoothed weight (from the body log). */
export function cycleStatus(c: Cycle, today: string, trendLb: number | null): CycleStatus {
  const days = Math.max(0, dayDiff(today, c.start));
  const week = Math.min(c.weeks, Math.floor(days / 7) + 1);
  const expectedLb = Math.round((c.startWeightLb + ((c.delta * days) / 3500)) * 10) / 10;
  let verdict: string | null = null;
  if (trendLb != null && days >= 10) {
    const off = trendLb - expectedLb;
    const tol = Math.max(1, c.startWeightLb * 0.005);
    if (Math.abs(off) <= tol) verdict = 'On track';
    else if (c.kind === 'cut') verdict = off < 0 ? 'Losing faster than planned: eat a little more' : 'Losing slower than planned';
    else if (c.kind === 'bulk') verdict = off > 0 ? 'Gaining faster than planned: eat a little less' : 'Gaining slower than planned';
    else verdict = off > 0 ? 'Weight creeping up' : 'Weight drifting down';
  }
  return { week, daysLeft: Math.max(0, dayDiff(cycleEnd(c), today)), expectedLb, trendLb, verdict };
}

/** "Cut: 500 kcal under a day", "Bulk: 250 kcal over a day", "Maintain: eat what you burn". */
export function cycleLine(c: Cycle): string {
  if (c.kind === 'maintain' || c.delta === 0) return 'Eat about what you burn';
  return `${fmtInt(Math.abs(c.delta))} kcal ${c.delta < 0 ? 'under' : 'over'} what you burn a day`;
}

export function normalizeCycle(v: unknown): Cycle | null {
  const o = v as Cycle | null;
  if (!o || typeof o !== 'object') return null;
  const p = CYCLE_PRESETS.find((x) => x.id === o.preset);
  if (!p || typeof o.start !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.start)) return null;
  const nums = [o.weeks, o.startWeightLb, o.intake, o.delta, o.proteinG];
  if (!nums.every((x) => typeof x === 'number' && Number.isFinite(x))) return null;
  return { preset: p.id, kind: p.kind, start: o.start, weeks: Math.max(1, Math.min(52, Math.round(o.weeks))), startWeightLb: o.startWeightLb, intake: o.intake, delta: Math.max(-1000, Math.min(500, o.delta)), proteinG: o.proteinG };
}

/** Plain words for an expected weekly change: "about 1.2 lb a week". */
export const weeklyText = (lb: number) => (Math.abs(lb) < 0.05 ? 'about the same weight' : `about ${fmt(Math.round(Math.abs(lb) * 10) / 10)} lb a week`);
